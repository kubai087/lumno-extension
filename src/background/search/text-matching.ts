// Matching titles to a query: the title matcher with its pinyin readings,
// the query context, and where a result's title shows the query.
import * as SETTINGS from '../../domain/settings';
import { getShownSearchResultSourceTypes } from '../../domain/settings';
import { loadWorkerLazyModule } from '../../platform/worker-lazy';
import { readPinyinApi, readSearchTitleHanReadings, readSearchUsualHanReading } from '../../domain/search/pinyin-api';
import { PINYIN_DATA_SCRIPT_PATH, getImportScripts, workerSettings } from '../worker-context';
import type {
  SearchPolicy,
  SearchQueryContext,
  SearchRankingOptions,
  SearchSourceType,
  SearchTextMatcher
} from '../../domain/search/types';
import type { PinyinApi } from '../../domain/search/pinyin-api';
import type { SuggestionRow } from './types';
import * as BoundedCache from '../../domain/bounded-cache';
import * as SearchTextNormalize from '../../domain/search/utils/text-normalize';
import * as SearchDirectNavigation from '../../domain/search/utils/direct-navigation';
import * as SearchSearchPolicy from '../../domain/search/utils/search-policy';
import * as SearchSelectionStats from '../../domain/search/utils/selection-stats';
import * as TextMatching from '../../domain/search/utils/text-matching';

// Titles whose units (and pinyin readings) were built for matching, about
// 1 KB each. It holds the Han-title history and the bookmarks, so typing one
// more letter never rebuilds them.
const BACKGROUND_TITLE_PINYIN_CACHE_MAX_ENTRIES = 6144;

let titleTextMatcher: SearchTextMatcher | null = null;

// Fuzzy pinyin (模糊音) is off unless the reader turns it on in Options.

function loadSearchResultSourceTypes(): Promise<SearchSourceType[]> {
  return workerSettings.ready.then(() => getShownSearchResultSourceTypes(workerSettings));
}

function loadSearchFuzzyPinyinEnabled(): Promise<boolean> {
  return workerSettings.ready.then(() => workerSettings.get(SETTINGS.searchFuzzyPinyinEnabled));
}

// Titles were indexed with the readings of the old choice, so they are
// indexed again.
workerSettings.subscribe(SETTINGS.searchFuzzyPinyinEnabled, () => {
  if (titleTextMatcher) {
    titleTextMatcher.clear();
  }
});


let pinyinProApi: PinyinApi | null = null;
let pinyinProImportAttempted = false;

// pinyin-pro, imported on first use; null when it could not be loaded, in
// which case titles still match by their own text.
function getPinyinPro(): PinyinApi | null {
  if (!pinyinProApi && !pinyinProImportAttempted) {
    pinyinProImportAttempted = true;
    pinyinProApi = readPinyinApi(loadWorkerLazyModule(
      'pinyin', chrome.runtime.getURL(PINYIN_DATA_SCRIPT_PATH), getImportScripts()));
  }
  return pinyinProApi;
}

// Each Han character of a title reads as it is said in the title and as it
// is usually said (readSearchTitleHanReadings): 重庆 matches "chongqing"
// and "zhongqing", 银行 "yinhang" and "yinxing", while 和平 is not "huping".
// Usual readings depend on the character alone, so a few thousand entries
// cover every title.
const hanUsualReadingCache = new Map<string, string>();
const hanFuzzyReadingsCache = new Map<string, string[]>();
const BACKGROUND_HAN_READINGS_CACHE_MAX_ENTRIES = 8192;

function getTitleHanReadings(text: string, characters: string[]): string[][] | null {
  const pinyinApi = getPinyinPro();
  if (!pinyinApi) {
    return null;
  }
  const readings = readSearchTitleHanReadings(pinyinApi, text, characters, (character) => (
    getHanUsualReading(pinyinApi, character)
  ));
  if (!workerSettings.get(SETTINGS.searchFuzzyPinyinEnabled)) {
    return readings;
  }
  return readings.map((characterReadings) => {
    const key = characterReadings.join(',');
    const cached = hanFuzzyReadingsCache.get(key);
    if (cached) {
      return cached;
    }
    const expanded = SearchTextNormalize.expandSearchFuzzyPinyinReadings(characterReadings);
    BoundedCache.setBoundedCacheEntry(hanFuzzyReadingsCache, key, expanded, BACKGROUND_HAN_READINGS_CACHE_MAX_ENTRIES);
    return expanded;
  });
}

function getHanUsualReading(pinyinApi: PinyinApi, character: string): string {
  const cached = hanUsualReadingCache.get(character);
  if (cached !== undefined) {
    return cached;
  }
  const reading = readSearchUsualHanReading(pinyinApi, character);
  BoundedCache.setBoundedCacheEntry(hanUsualReadingCache, character, reading, BACKGROUND_HAN_READINGS_CACHE_MAX_ENTRIES);
  return reading;
}

function getTitleTextMatcher(): SearchTextMatcher | null {
  if (!titleTextMatcher && typeof TextMatching.createSearchTextMatcher === 'function') {
    titleTextMatcher = TextMatching.createSearchTextMatcher({
      getHanReadings: getTitleHanReadings,
      maxEntries: BACKGROUND_TITLE_PINYIN_CACHE_MAX_ENTRIES
    });
  }
  return titleTextMatcher;
}

function getBackgroundSearchPolicy(): Readonly<SearchPolicy> {
  return SearchSearchPolicy.SEARCH_POLICY;
}

// A query of Han characters alone, as a site's address would spell it: its
// pinyin and its initials: 知乎 is zhihu, 京东 is jd.
function getQueryHostSpellings(context: SearchQueryContext): string[] {
  const compact = typeof SearchTextNormalize.compactSearchQuery === 'function'
    ? SearchTextNormalize.compactSearchQuery(context.queryLower)
    : '';
  if (compact.length < 2 || compact.length > 8 ||
      !Array.from(compact).every((character) => SearchTextNormalize.hasSearchHanCharacters(character))) {
    return [];
  }
  const pinyinApi = getPinyinPro();
  if (!pinyinApi) {
    return [];
  }
  try {
    const syllables = pinyinApi.pinyin(compact, { toneType: 'none', type: 'array', v: true })
      .map((syllable) => String(syllable || '').toLowerCase().replace(/[^a-z]+/g, ''))
      .filter(Boolean);
    if (syllables.length !== compact.length) {
      return [];
    }
    const full = syllables.join('');
    const initials = syllables.map((syllable) => syllable.charAt(0)).join('');
    return full === initials ? [full] : [full, initials];
  } catch (_error) {
    return [];
  }
}

function buildBackgroundSearchQueryContext(query: unknown): SearchQueryContext {
  const context = SearchSelectionStats.buildSearchQueryContext(query);
  context.queryHostSpellings = getQueryHostSpellings(context);
  return context;
}

// Marks where a local result's title shows the query, by the same rules that
// matched it, so a pinyin or initials match marks the characters it spelled.
// The view uses the ranges only while its title text and query are these.
function attachSuggestionTitleHighlight<T extends SuggestionRow>(
  suggestion: T,
  context: SearchQueryContext,
  scoreOptions: SearchRankingOptions
): T {
  if (!suggestion || !suggestion.title) {
    return suggestion;
  }
  const text = SearchDirectNavigation.sanitizeDisplayText(suggestion.title);
  return {
    ...suggestion,
    titleHighlight: {
      text,
      query: String(context.lookupQuery || '').trim().toLowerCase(),
      ranges: TextMatching.getSearchTitleHighlightRanges(text, context, scoreOptions)
    }
  };
}


export {
  attachSuggestionTitleHighlight,
  buildBackgroundSearchQueryContext,
  getBackgroundSearchPolicy,
  getTitleTextMatcher,
  loadSearchFuzzyPinyinEnabled,
  loadSearchResultSourceTypes
};
