// Search: result order, sources, limits and tabs, site and aggregate
// searches, the default engine, blocklists, and what search remembers.
import type { SearchSourceType } from '../search/types';
import { defineSetting } from './define';
import type { Setting } from './define';
import { newtabZenMode } from './newtab-page';
import { custom, flag, opaque } from './schema';

// Whether search engine suggestions or matching pages come first.
type SearchResultPriority = 'search' | 'autocomplete';

// Where a result opened in a new tab goes.
type SearchResultTabPosition = 'afterCurrent' | 'beforeCurrent' | 'end';

const SEARCH_RESULT_SOURCE_TYPES: readonly SearchSourceType[] = Object.freeze(['topSite', 'bookmark', 'history']);

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

// A source type, also under the names older versions stored; '' when unknown.
function normalizeSearchResultSourceType(value: unknown): SearchSourceType | '' {
  const raw = String(value || '').trim();
  if (raw === 'topSite' || raw === 'topSites' || raw === 'frequent' || raw === 'common') {
    return 'topSite';
  }
  if (raw === 'bookmark' || raw === 'bookmarks') {
    return 'bookmark';
  }
  if (raw === 'history') {
    return 'history';
  }
  return '';
}

const searchResultPriority = defineSetting({
  key: '_x_extension_search_result_priority_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: custom((value): SearchResultPriority => (value === 'search' ? 'search' : 'autocomplete'))
});

// The browser content search lists; an empty list turns them all off. Older
// versions stored a comma-separated string and other names for the types.
const searchResultSourceTypes = defineSetting({
  key: '_x_extension_search_result_source_types_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: custom((value): SearchSourceType[] => {
    if (isUnknownArray(value) && value.length === 0) {
      return [];
    }
    const rawItems: unknown[] = isUnknownArray(value)
      ? value
      : (typeof value === 'string' ? value.split(/[\s,]+/) : []);
    const selected: SearchSourceType[] = [];
    for (const item of rawItems) {
      const type = normalizeSearchResultSourceType(item);
      if (!type || selected.includes(type)) {
        continue;
      }
      selected.push(type);
    }
    return selected.length > 0 ? selected : SEARCH_RESULT_SOURCE_TYPES.slice();
  })
});

// What decides the browser content search shows.
const SHOWN_SEARCH_RESULT_SOURCE_SETTINGS: readonly Setting<unknown>[] = Object.freeze([searchResultSourceTypes, newtabZenMode]);

// The browser content search shows: none in zen mode, which doubles as a
// presentation mode, else the chosen types.
function getShownSearchResultSourceTypes(settings: { get<T>(setting: Setting<T>): T }): SearchSourceType[] {
  return settings.get(newtabZenMode) ? [] : settings.get(searchResultSourceTypes);
}

const searchResultDisplayLimit = defineSetting({
  key: '_x_extension_search_result_display_limit_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: custom((value) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 5 && parsed <= 10 ? parsed : 10;
  })
});

const searchResultTabPosition = defineSetting({
  key: '_x_extension_search_result_tab_position_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: custom((value): SearchResultTabPosition => (
    value === 'afterCurrent' || value === 'beforeCurrent' ? value : 'end'
  ))
});

const searchFuzzyPinyinEnabled = defineSetting({
  key: '_x_extension_search_fuzzy_pinyin_enabled_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: flag(false)
});

const numberShortcutInstantEnabled = defineSetting({
  key: '_x_extension_number_shortcut_instant_enabled_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: flag(false)
});

const macosCtrlSuggestionNavigationEnabled = defineSetting({
  key: '_x_extension_macos_ctrl_suggestion_navigation_enabled_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: flag(false)
});

// The default search engine's id; the engines belong to domain/search.
const defaultSearchEngine = defineSetting({
  key: '_x_extension_default_search_engine_2024_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: opaque()
});

// Custom site searches and the built-in ones turned off; the formats belong
// to shared/search/site-search-store.ts.
const siteSearchCustom = defineSetting({
  key: '_x_extension_site_search_custom_2024_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: opaque()
});

const siteSearchDisabled = defineSetting({
  key: '_x_extension_site_search_disabled_2024_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: opaque()
});

// The format belongs to domain/search/aggregate-search-store.ts.
const aggregateSearches = defineSetting({
  key: '_x_extension_aggregate_searches_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: opaque()
});

const aggregateSearchAutoGroupEnabled = defineSetting({
  key: '_x_extension_aggregate_search_auto_group_enabled_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: flag(true)
});

// One flat record holds the reader's custom order for every Search sources
// list plus the search scope group order. Only short keys are stored, so the
// record stays well inside the 8 KB Chrome Sync item budget. The format
// belongs to domain/search/search-source-order.ts.
const searchSourceOrder = defineSetting({
  key: '_x_extension_search_source_order_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: opaque()
});

// Sites left out of results, and sites whose icons are never requested; the
// rules belong to domain/blacklist-utils.ts.
const searchBlacklist = defineSetting({
  key: '_x_extension_search_blacklist_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: opaque()
});

const faviconRequestBlacklist = defineSetting({
  key: '_x_extension_favicon_request_blacklist_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: opaque()
});

const faviconEnhancedFetchEnabled = defineSetting({
  key: '_x_extension_favicon_enhanced_fetch_enabled_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: flag(true)
});

// What was typed into the search box, for the arrow keys to bring back.
const searchInputHistory = defineSetting({
  key: '_x_extension_search_input_history_2026_unique_',
  area: 'device',
  schema: opaque()
});

// How often each result was chosen for a query, for ranking.
const searchSelectionStats = defineSetting({
  key: '_x_extension_search_selection_stats_2026_unique_',
  area: 'device',
  schema: opaque()
});

// Site search icons by provider, in their canonical size.
const siteSearchIconCache = defineSetting({
  key: '_x_extension_site_search_icon_cache_canonical_2026_unique_',
  area: 'cache',
  schema: opaque()
});

// Site icons the worker resolved: their URLs, their image data, and the
// theme colors read from them.
const faviconUrlCache = defineSetting({
  key: '_x_extension_favicon_url_cache_2024_unique_',
  area: 'cache',
  schema: opaque()
});

const faviconDataCache = defineSetting({
  key: '_x_extension_favicon_data_cache_2024_unique_',
  area: 'cache',
  schema: opaque()
});

const siteThemeCache = defineSetting({
  key: '_x_extension_site_theme_cache_2026_unique_',
  area: 'cache',
  schema: opaque()
});

// Hosts whose icons changed since the last visit and need fetching again.
const faviconVisitDirty = defineSetting({
  key: '_x_extension_favicon_visit_dirty_2026_unique_',
  area: 'cache',
  schema: opaque()
});

// Shows each tab's ranking score in the results (a developer aid).
const tabRankScoreDebug = defineSetting({
  key: '_x_extension_tab_rank_score_debug_2026_unique_',
  area: 'preferences',
  schema: flag(false)
});

export {
  SEARCH_RESULT_SOURCE_TYPES,
  SHOWN_SEARCH_RESULT_SOURCE_SETTINGS,
  aggregateSearchAutoGroupEnabled,
  aggregateSearches,
  defaultSearchEngine,
  faviconDataCache,
  faviconEnhancedFetchEnabled,
  faviconRequestBlacklist,
  faviconUrlCache,
  faviconVisitDirty,
  getShownSearchResultSourceTypes,
  macosCtrlSuggestionNavigationEnabled,
  normalizeSearchResultSourceType,
  numberShortcutInstantEnabled,
  searchBlacklist,
  searchFuzzyPinyinEnabled,
  searchInputHistory,
  searchResultDisplayLimit,
  searchResultPriority,
  searchResultSourceTypes,
  searchResultTabPosition,
  searchSelectionStats,
  searchSourceOrder,
  siteSearchCustom,
  siteSearchDisabled,
  siteSearchIconCache,
  siteThemeCache,
  tabRankScoreDebug
};
export type { SearchResultPriority, SearchResultTabPosition };
