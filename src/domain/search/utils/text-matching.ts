// Matching a query against an index: compact matching, the reusable
// matcher and title highlight ranges.
import type {
  SearchQueryContext,
  SearchRange,
  SearchRankingOptions,
  SearchTextIndex,
  SearchTextMatch,
  SearchTextMatcher,
  SearchTextMatcherOptions
} from '../types';
import { getHangulCarriedQuery } from './keyboard-layouts';
import { buildSearchTextIndex, resolveSearchTextIndexReadings } from './text-index';
import { SEARCH_HAN_PATTERN, SEARCH_LETTER_ALTERNATES, SEARCH_TEXT_MATCHER_CACHE_MAX_ENTRIES, compactSearchQuery, foldSearchCharacter, normalizeSearchText, allowsSearchMidWordMatch } from './text-normalize';

import { extendSearchRangesOverMarks, findSearchUnitPieces, findSearchUnitRun, getSearchUnitStepRange, mergeSearchRanges } from './unit-paths';

// The options getSearchTitleUnitMatch reads.
type TitleMatchOptions = Pick<SearchRankingOptions, 'titleMatcher'>;

// The parts of the query context highlighting reads.
type HighlightContext = Partial<Pick<SearchQueryContext, 'queryLower' | 'coreQueryTerms'>>;


// Finds the query in the text: as one run first ("wxds", "wxdushu" and
// "weixinds" all find 微信读书, "vscode" finds Visual Studio Code, "gh ck"
// finds "GitHub 仓库"), then in pieces. Readings come from the simplified
// form, so "taiwan" finds 臺灣 too. One run outranks pieces, and pieces in
// the query's order outrank pieces out of it.
function matchSearchTextIndex(index: SearchTextIndex | null | undefined, query: unknown): SearchTextMatch | null {
  const compact = compactSearchQuery(query);
  if (!compact || !index || !(index.count > 0)) {
    return null;
  }
  if (/[a-z]/.test(compact)) {
    resolveSearchTextIndexReadings(index);
  }
  const result = matchSearchTextCompact(index, compact);
  const carried = result ? '' : getHangulCarriedQuery(compact);
  return carried ? matchSearchTextCompact(index, carried) : result;
}

function matchSearchTextCompact(index: SearchTextIndex, compact: string): SearchTextMatch | null {
  const run = findSearchUnitRun(index, compact);
  if (run) {
    const shape = run.shape;
    let score = 14;
    if (shape.exact) {
      score = 42;
    } else if (shape.anchored) {
      score = 28;
    } else if (shape.segmentStart) {
      score = 20;
    } else if (shape.abbreviation) {
      score = 16;
    }
    return {
      score,
      reason: `${shape.abbreviation ? 'initials' : 'full'}-${shape.exact ? 'exact' : (shape.anchored ? 'prefix' : 'contains')}`,
      usesPinyin: shape.usesPinyin,
      abbreviation: shape.abbreviation,
      anchored: shape.anchored,
      exact: shape.exact,
      pieces: 1,
      ranges: mergeSearchRanges(run.path.map((step) => getSearchUnitStepRange(index, step)))
    };
  }
  const pieces = findSearchUnitPieces(index, compact);
  if (!pieces) {
    return null;
  }
  const starts = pieces.map((piece) => piece.path[0].unit);
  const inOrder = starts.every((unit, i) => i === 0 || unit > starts[i - 1]);
  return {
    score: Math.max(4, (inOrder ? 12 : 8) - (pieces.length - 2) * 2),
    reason: inOrder ? 'pieces-in-order' : 'pieces-reordered',
    usesPinyin: pieces.some((piece) => piece.shape.usesPinyin),
    abbreviation: false,
    anchored: starts[0] === 0,
    exact: false,
    pieces: pieces.length,
    ranges: mergeSearchRanges(pieces.flatMap((piece) => (
      piece.path.map((step) => getSearchUnitStepRange(index, step))
    )))
  };
}

// Cheap checks before building an index. Han characters in the query are
// matched as themselves, so the title must hold every one of them. Without
// Han characters in the title every unit is the title's own letters, so the
// query's letters have to appear in order.
function canSearchTextMatchQuery(text: string, compact: string): boolean {
  const folded = normalizeSearchText(text);
  if (SEARCH_HAN_PATTERN.test(folded)) {
    return Array.from(compact).every((character) => (
      !SEARCH_HAN_PATTERN.test(character) || folded.includes(character)
    ));
  }
  if (SEARCH_HAN_PATTERN.test(compact)) {
    return false;
  }
  // Korean initials and half-typed syllables are not the title's own text.
  if (/[\p{Script=Hangul}]/u.test(compact) && /[\p{Script=Hangul}]/u.test(folded)) {
    return true;
  }
  // Second spellings ("mueller" for Müller) add letters to the title's own.
  let letters = folded;
  if (Array.from(SEARCH_LETTER_ALTERNATES.keys()).some((letter) => text.includes(letter))) {
    letters = '';
    for (const character of text) {
      letters += (SEARCH_LETTER_ALTERNATES.get(character) || foldSearchCharacter(character)).toLowerCase();
    }
  }
  let position = 0;
  for (let i = 0; i < letters.length && position < compact.length; i += 1) {
    if (letters.charAt(i) === compact.charAt(position)) {
      position += 1;
    }
  }
  return position === compact.length;
}

// Keeps the index of recently seen titles, so typing one more letter only
// walks the units again. Pinyin comes from getHanReadings(text, characters),
// which returns the readings of each Han character in order.
function createSearchTextMatcher(options?: SearchTextMatcherOptions | null): SearchTextMatcher {
  const settings: SearchTextMatcherOptions = options && typeof options === 'object' ? options : {};
  const maxEntries = Number(settings.maxEntries) >= 0
    ? Math.floor(Number(settings.maxEntries))
    : SEARCH_TEXT_MATCHER_CACHE_MAX_ENTRIES;
  const cache = new Map<string, SearchTextIndex>();
  const getIndex = (text: unknown): SearchTextIndex => {
    const key = String(text || '');
    const cached = cache.get(key);
    if (cached) {
      cache.delete(key);
      cache.set(key, cached);
      return cached;
    }
    const index = buildSearchTextIndex(key, settings);
    if (maxEntries > 0) {
      cache.set(key, index);
      while (cache.size > maxEntries) {
        const oldest = cache.keys().next().value;
        if (oldest === undefined) {
          break;
        }
        cache.delete(oldest);
      }
    }
    return index;
  };
  return {
    getIndex,
    match(text: unknown, query: unknown) {
      const source = String(text || '');
      const compact = compactSearchQuery(query);
      if (!source || !compact || !canSearchTextMatchQuery(source, compact)) {
        return null;
      }
      return matchSearchTextIndex(getIndex(source), compact);
    },
    clear() {
      cache.clear();
    }
  };
}

const DEFAULT_SEARCH_TEXT_MATCHER = createSearchTextMatcher();

function getSearchTitleMatcher(options?: TitleMatchOptions | null): SearchTextMatcher {
  const matcher = options && options.titleMatcher;
  return matcher && typeof matcher.match === 'function' ? matcher : DEFAULT_SEARCH_TEXT_MATCHER;
}

// Two letters at least, and more than a number: digits alone match the
// title text itself.
function isSearchUnitQueryEligible(term: unknown): boolean {
  const compact = compactSearchQuery(term);
  // One Hangul syllable may still be half typed ("서" on the way to 성).
  return (compact.length >= 2 && /\D/.test(compact)) ||
    (compact.length === 1 && /[\p{Script=Hangul}]/u.test(compact));
}

// A unit match the plain text checks already credit (the title holds the
// query as typed) adds nothing to the score.
// skipLiteral: no match where the title already holds the term as typed.
function getSearchTitleUnitMatch(
  title: unknown,
  term: unknown,
  options?: TitleMatchOptions | null,
  matchOptions?: { skipLiteral?: boolean } | null
): SearchTextMatch | null {
  const text = String(title || '');
  const extra: { skipLiteral?: boolean } = matchOptions && typeof matchOptions === 'object' ? matchOptions : {};
  if (!text || !isSearchUnitQueryEligible(term)) {
    return null;
  }
  const result = getSearchTitleMatcher(options).match(text, term);
  if (!result || !extra.skipLiteral) {
    return result;
  }
  return normalizeSearchText(text).includes(normalizeSearchText(term).trim()) ? null : result;
}

// Where a title shows the query: the text as typed, each term, and when
// neither is there literally, the units a pinyin or initials match spelled.
// A term shorter than four letters is only marked where a word starts, the
// way it matches, so "ai" marks OpenAI but not "Detail". Ranges index the
// given text.
function getSearchTitleHighlightRanges(
  title: unknown,
  context: HighlightContext | null | undefined,
  options?: TitleMatchOptions | null
): SearchRange[] {
  const text = String(title || '');
  const queryLower = context && context.queryLower ? String(context.queryLower) : '';
  if (!text || !queryLower) {
    return [];
  }
  // Word starts need no pinyin, so a Han query never loads the readings.
  const wordIndex = buildSearchTextIndex(text);
  const unitStarts = new Set(wordIndex.spans.filter((value, position) => position % 2 === 0));
  let foldedText = '';
  const foldedStarts: number[] = [];
  const foldedEnds: number[] = [];
  let offset = 0;
  Array.from(text).forEach((character) => {
    const start = offset;
    offset += character.length;
    Array.from(foldSearchCharacter(character).toLowerCase()).forEach((piece) => {
      foldedText += piece;
      for (let i = 0; i < piece.length; i += 1) {
        foldedStarts.push(start);
        foldedEnds.push(offset);
      }
    });
  });
  const ranges: SearchRange[] = [];
  const markLiteral = (needle: string) => {
    if (!needle) {
      return false;
    }
    const wordStartOnly = !allowsSearchMidWordMatch(needle);
    let found = false;
    let position = foldedText.indexOf(needle);
    while (position >= 0) {
      const start = foldedStarts[position];
      if (!wordStartOnly || unitStarts.has(start)) {
        ranges.push([start, foldedEnds[position + needle.length - 1]]);
        found = true;
      }
      position = foldedText.indexOf(needle, position + needle.length);
    }
    return found;
  };
  const markUnits = (term: string) => {
    const result = getSearchTitleUnitMatch(text, term, options);
    if (result) {
      ranges.push(...result.ranges);
      return true;
    }
    return false;
  };
  if (!markLiteral(queryLower) && !markUnits(queryLower)) {
    const terms = context && Array.isArray(context.coreQueryTerms) ? context.coreQueryTerms : [];
    terms.forEach((term) => {
      if (!markLiteral(term)) {
        markUnits(term);
      }
    });
  }
  return extendSearchRangesOverMarks(text, mergeSearchRanges(ranges));
}

export {
  DEFAULT_SEARCH_TEXT_MATCHER,
  canSearchTextMatchQuery,
  createSearchTextMatcher,
  getSearchTitleHighlightRanges,
  getSearchTitleMatcher,
  getSearchTitleUnitMatch,
  isSearchUnitQueryEligible,
  matchSearchTextCompact,
  matchSearchTextIndex
};
export type {
  HighlightContext,
  TitleMatchOptions
};
