// The data the search ranking passes between its parts (search/utils/*,
// wired together in search-utils.ts) and hands to the surfaces that show
// results.

// Where a local result comes from.
type SearchSourceType = 'history' | 'bookmark' | 'topSite';

// A page from the browser: a history entry, bookmark, top site or open tab.
interface BrowserItem {
  id?: string | number;
  url: string;
  title?: string;
  lastVisitTime?: number;
  visitCount?: number;
  typedCount?: number;
  type?: string;
  isTopSite?: boolean;
}

// What the ranking reads from any row of a slate: local results, search
// engine suggestions ('googleSuggest'), the search action ('newtab'), open
// tabs and direct addresses. Rows carry more fields; functions that pass
// rows through keep them (they are generic over the row type).
interface SuggestionLike {
  type?: string;
  url?: string;
  title?: string;
  score?: number;
  isTopSite?: boolean;
  selectionBoost?: number;
  lastVisitTime?: number;
  visitCount?: number;
  typedCount?: number;
  // The open tab a row was matched to.
  _xMatchedTabId?: number;
}

// A local result as createSearchSuggestion builds it.
interface SearchSuggestion extends SuggestionLike {
  type: string;
  title: string;
  url: string;
  favicon: string;
  score: number;
  lastVisitTime: number;
  visitCount: number;
  typedCount: number;
  reasons: string[];
  // Added by the ranking for a site's home page it made up.
  isSyntheticDirect?: boolean;
  isBrandRepresentative?: boolean;
}

type SearchIntentType = 'navigation' | 'path' | 'revisit' | 'object' | 'brand';

// What one ranking pass knows about the query (buildSearchQueryContext).
interface SearchQueryContext {
  // The query as typed.
  lookupQuery: string;
  // Folded and lowercased.
  queryLower: string;
  // The query as title units spell it; empty when only plain text matching
  // applies.
  unitQuery: string;
  // The words of the query.
  coreQueryTerms: string[];
  // The words, and the whole query in front when it is more than one word.
  queryTerms: string[];
  intentType: SearchIntentType;
  hasSettingsIntent: boolean;
  hasInformationalIntent: boolean;
  // The query's pinyin and initials as a site's address may spell them
  // (知乎 as "zhihu"), filled in by the background.
  queryHostSpellings?: string[];
}

// Where a URL sits on its site, for ranking pages of one site apart.
type SearchClusterCategory =
  | 'unknown'
  | 'site-root'
  | 'section'
  | 'content'
  | 'landing'
  | 'docs'
  | 'utility'
  | 'action'
  | 'user'
  | 'repo-root'
  | 'repo-code'
  | 'repo-child'
  | 'repo-issues'
  | 'repo-pulls'
  | 'repo-discussions'
  | 'repo-actions'
  | 'repo-wiki'
  | 'repo-releases';

interface SearchClusterInfo {
  host: string;
  category: SearchClusterCategory;
  clusterKey: string;
  depth: number;
  path: string;
}

// How a site is treated by the ranking (direct-navigation.ts).
interface SearchSiteConfig {
  ignoreAllSearchParamsPaths?: Set<string>;
  directNavigationUrl?: string;
  directNavigationTitle?: string;
  repoAreaCategories?: Map<string, SearchClusterCategory>;
}

// How many of the query's words a candidate holds.
interface SearchTermCoverage {
  total: number;
  matchedCount: number;
  missingCount: number;
  allMatched: boolean;
}

// A unit kind of the text index: a word, a digit run, a Han character, or
// another single character.
type SearchUnitKind = 'w' | 'd' | 'h' | 'c';

// The readings of each Han character of a text, in order, as returned by
// the pinyin runtime: one reading or several per character.
type HanReadingsLookup = (text: string, characters: string[]) => unknown;

// A text split into the units a query spells (text-index.ts). Fields are
// compact because thousands of these stay cached.
interface SearchTextIndex {
  text: string;
  count: number;
  // One SearchUnitKind character per unit.
  kinds: string;
  // '1' where a unit starts a segment, '0' elsewhere.
  segments: string;
  // '1' where punctuation comes before a unit ("Home - Docs", "a|b"), '0'
  // where only a space or nothing does.
  breaks: string;
  texts: string[];
  // Start and end offset in text of each unit, as pairs.
  spans: number[];
  // Per unit whose letters are not one source character each: where each
  // letter ends.
  letterEnds: Record<number, number[]> | null;
  // Per unit with a second spelling ("mueller" for Müller).
  alternates: Record<number, string> | null;
  // Normalized pinyin readings of each Han unit, once resolved.
  readings: Array<string[] | null> | null;
  getHanReadings: HanReadingsLookup | null;
  readingsResolved: boolean;
}

interface SearchTextIndexOptions {
  getHanReadings?: HanReadingsLookup;
}

type SearchRange = [number, number];

// How a query matched a text through its units (text-matching.ts).
interface SearchTextMatch {
  score: number;
  reason: string;
  usesPinyin: boolean;
  abbreviation: boolean;
  anchored: boolean;
  exact: boolean;
  // 1 for one run; more when the query was found in pieces.
  pieces: number;
  ranges: SearchRange[];
}

// Keeps the indexes of recently seen titles.
interface SearchTextMatcher {
  getIndex(text: unknown): SearchTextIndex;
  match(text: unknown, query: unknown): SearchTextMatch | null;
  clear(): void;
}

interface SearchTextMatcherOptions extends SearchTextIndexOptions {
  maxEntries?: number;
}

// A site search ("yt", "gh", an AI chat, a search engine, a custom one) as
// settings store it and the surfaces use it.
interface SiteSearchProvider {
  key: string;
  id?: string;
  aliases?: string[];
  name?: string;
  // URL with {query} where the query goes; an AI provider may have none.
  template?: string;
  // 'openAndSubmit' for providers whose page takes the query after loading.
  action?: string;
  submitStrategy?: string;
  // 'searchEngine', 'aiSearch' or ''.
  category?: string;
  disabled?: boolean;
  disabledReason?: string;
  icon?: string;
  iconUrl?: string;
  // The built-in provider an edited one started from.
  builtinKey?: string;
  directNavigationUrl?: string;
  directNavigationTitle?: string;
  _xIsCustom?: boolean;
  _xIsAggregateSearch?: boolean;
  _xIsDetectedSearchEngine?: boolean;
}

// A provider after normalizeSiteSearchProvider.
interface NormalizedSiteSearchProvider extends SiteSearchProvider {
  id: string;
  aliases: string[];
  name: string;
  template: string;
  action: string;
  submitStrategy: string;
  category: string;
  disabled: boolean;
  disabledReason: string;
  icon: string;
  iconUrl: string;
}

// The browser's default search engine, as the background detects it.
interface SearchEngineState {
  id?: string;
  name?: string;
  host?: string;
  searchTemplate?: string;
}

// A typed prefix that narrows search to one local source ("bm", "his").
interface LocalSearchScopeRule {
  searchSourceType?: string;
  keys?: string[];
}

interface LocalSearchScope {
  sourceType: SearchSourceType;
  trigger: string;
  key: string;
}

// The limits the ranking works within (SEARCH_POLICY in search-utils.ts).
interface SearchPolicy {
  lookupWindowDays: number;
  fallbackHistoryWindowDays: number;
  lookupMaxResults: number;
  fallbackHistoryMaxResults: number;
  hanTitleHistoryScanLimit: number;
  maxEngineSuggestions: number;
  maxEngineSuggestionsWithLocalResults: number;
  candidatePoolLimit: number;
  finalSuggestionLimit: number;
  displaySuggestionLimit: number;
  fallbackTopSiteLimit: number;
  topSiteRepresentativeHostLimit: number;
  topSiteRepresentativeClusterLimit: number;
  primaryHostLimit: number;
  primaryClusterLimit: number;
  secondaryHostLimit: number;
  secondaryClusterLimit: number;
  brandPrimaryFamilyLimit: number;
  brandSecondaryFamilyLimit: number;
  brandProtectedOpenTabLimit: number;
  brandDeepSelectionBoostLimit: number;
  genericBrandDeepTitlePenalty: number;
}

// How long and how much picked results are remembered.
interface SearchSelectionPolicy {
  retentionDays: number;
  maxQueries: number;
  maxEntriesPerQuery: number;
  maxSelectionBoost: number;
}

// The source types a selection is remembered under.
type SearchSelectionType = 'history' | 'bookmark' | 'topSite' | 'directUrl' | 'browserPage' | 'autocomplete';

interface SearchSelectionEntry {
  url: string;
  title: string;
  type: SearchSelectionType;
  count: number;
  lastSelectedAt: number;
}

interface SearchSelectionBucket {
  updatedAt: number;
  entries: Record<string, SearchSelectionEntry>;
}

// What the user picked for each query, stored in local storage.
interface SearchSelectionStats {
  version: 1;
  updatedAt: number;
  queries: Record<string, SearchSelectionBucket>;
}

interface SearchSelection {
  query?: string;
  url?: string;
  title?: string;
  type?: string;
}

// Options a ranking pass hands through its parts; each part reads the ones
// it needs.
interface SearchRankingOptions {
  // The clock, for tests.
  now?: number;
  titleMatcher?: SearchTextMatcher;
  isLocalNetworkHost?: (host: string) => boolean;
  isOwnExtensionUrl?: (url: string) => boolean;
  retentionDays?: number;
  maxQueries?: number;
  maxEntriesPerQuery?: number;
  maxSelectionBoost?: number;
  brandDeepSelectionBoostLimit?: number;
}

export type {
  BrowserItem,
  HanReadingsLookup,
  LocalSearchScope,
  LocalSearchScopeRule,
  NormalizedSiteSearchProvider,
  SearchClusterCategory,
  SearchClusterInfo,
  SearchEngineState,
  SearchIntentType,
  SearchPolicy,
  SearchQueryContext,
  SearchRange,
  SearchRankingOptions,
  SearchSelection,
  SearchSelectionBucket,
  SearchSelectionEntry,
  SearchSelectionPolicy,
  SearchSelectionStats,
  SearchSelectionType,
  SearchSiteConfig,
  SearchSourceType,
  SearchSuggestion,
  SearchTermCoverage,
  SearchTextIndex,
  SearchTextIndexOptions,
  SearchTextMatch,
  SearchTextMatcher,
  SearchTextMatcherOptions,
  SearchUnitKind,
  SiteSearchProvider,
  SuggestionLike
};
