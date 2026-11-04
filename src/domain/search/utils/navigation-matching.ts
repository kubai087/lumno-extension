// Matching open tabs and navigation results: comparable URLs, tab match
// URLs, direct navigation matches and promoting a strong navigation match.
import type { BlacklistRule } from '../../blacklist-utils';
import type { SuggestionLike } from '../types';
import { normalizeHost } from './direct-navigation';
import { matchesSearchQueryText } from './query-intent';
import type { IntentItem, QueryTextContext } from './query-intent';
import { findSearchLiteral, normalizeSearchText, splitSearchTerms } from './text-normalize';
import type { TitleMatchOptions } from './text-matching';

interface CollectMatchesOptions extends TitleMatchOptions {
  isUrlBlockedBySearchBlacklist?: (url: string | undefined, blacklistItems: readonly BlacklistRule[]) => boolean;
}

interface DirectNavigationOptions {
  // The address the query names, when the caller already worked it out.
  directNavigationUrl?: string;
  getDirectNavigationUrl?: (rawQuery: string) => unknown;
}

// How the surface wants open tabs among the results treated.
interface OpenTabMatchOptions extends DirectNavigationOptions {
  rawQuery?: string;
  query?: string;
  primaryHighlightIndex?: number;
  prioritizeCurrentPageMatch?: boolean;
  currentTabId?: number;
}

interface OpenTabMatch {
  index: number;
  reason: '' | 'currentOpenTab';
}

interface StrongNavigationOptions extends DirectNavigationOptions {
  getUrlDisplay?: (url: string) => string;
}

function collectSearchMatches<T extends IntentItem>(
  items: readonly T[] | null | undefined,
  context: QueryTextContext,
  searchBlacklistItems: readonly BlacklistRule[],
  options?: CollectMatchesOptions | null
): T[] {
  const settings: CollectMatchesOptions = options && typeof options === 'object' ? options : {};
  const isUrlBlocked = typeof settings.isUrlBlockedBySearchBlacklist === 'function'
    ? settings.isUrlBlockedBySearchBlacklist
    : () => false;
  return (items || []).filter((item) => (
    matchesSearchQueryText(item, context, settings) &&
    !isUrlBlocked(item && item.url, searchBlacklistItems)
  ));
}

function buildComparableNavigationUrl(url: unknown): string {
  try {
    const parsed = new URL(String(url || '').trim());
    parsed.protocol = String(parsed.protocol || '').toLowerCase();
    parsed.hostname = normalizeHost(parsed.hostname);
    if ((parsed.protocol === 'http:' && parsed.port === '80') || (parsed.protocol === 'https:' && parsed.port === '443')) {
      parsed.port = '';
    }
    parsed.hash = '';
    parsed.pathname = parsed.pathname !== '/' ? (parsed.pathname.replace(/\/+$/, '') || '/') : '/';
    return parsed.toString();
  } catch (e) {
    return String(url || '').trim().toLowerCase();
  }
}

// includeSearch: false leaves the query string out.
function buildTabMatchUrl(url: unknown, options?: { includeSearch?: boolean } | null): string {
  if (!url) {
    return '';
  }
  const settings: { includeSearch?: boolean } = options && typeof options === 'object' ? options : {};
  try {
    const parsed = new URL(String(url));
    const protocol = String(parsed.protocol || '').toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') {
      return String(url).trim().toLowerCase();
    }
    const hostname = normalizeHost(parsed.hostname);
    const authority = parsed.port ? `${hostname}:${parsed.port}` : hostname;
    let path = parsed.pathname || '/';
    path = path.replace(/\/+$/, '');
    if (!path) {
      path = '/';
    }
    const search = settings.includeSearch === false ? '' : (parsed.search || '');
    return `${authority}${path}${search}`;
  } catch (e) {
    return String(url).trim().toLowerCase();
  }
}

function getDirectNavigationUrlForQuery(rawQuery: string, options?: DirectNavigationOptions | null): string {
  const settings: DirectNavigationOptions = options && typeof options === 'object' ? options : {};
  if (typeof settings.getDirectNavigationUrl !== 'function') {
    return '';
  }
  try {
    return String(settings.getDirectNavigationUrl(rawQuery) || '').trim();
  } catch (e) {
    return '';
  }
}

function isDirectNavigationMatch(
  suggestion: SuggestionLike | null | undefined,
  rawQuery: string,
  options?: DirectNavigationOptions | null
): boolean {
  if (!suggestion || !suggestion.url) {
    return false;
  }
  const settings: DirectNavigationOptions = options && typeof options === 'object' ? options : {};
  const directUrl = String(settings.directNavigationUrl || getDirectNavigationUrlForQuery(rawQuery, settings) || '').trim();
  if (!directUrl) {
    return false;
  }
  return buildComparableNavigationUrl(suggestion.url) === buildComparableNavigationUrl(directUrl);
}

function findSearchOpenTabMatchIndex(
  list: ReadonlyArray<SuggestionLike | null | undefined> | null | undefined,
  options?: OpenTabMatchOptions | null
): OpenTabMatch {
  const suggestions: ReadonlyArray<SuggestionLike | null | undefined> = Array.isArray(list) ? list : [];
  const settings: OpenTabMatchOptions = options && typeof options === 'object' ? options : {};
  const rawQuery = String(settings.rawQuery || settings.query || '').trim();
  const primaryHighlightIndex = typeof settings.primaryHighlightIndex === 'number' && Number.isInteger(settings.primaryHighlightIndex)
    ? settings.primaryHighlightIndex
    : -1;
  const directNavigationPrimaryIndex = primaryHighlightIndex >= 0 ? primaryHighlightIndex : 0;
  const hasDirectNavigationPrimary = Boolean(
    suggestions[directNavigationPrimaryIndex] &&
    isDirectNavigationMatch(suggestions[directNavigationPrimaryIndex], rawQuery, settings)
  );
  const matchesPrimaryNavigationIntent = (suggestion: SuggestionLike) => (
    !hasDirectNavigationPrimary ||
    isDirectNavigationMatch(suggestion, rawQuery, settings)
  );
  const isEligibleOpenTab = (suggestion: SuggestionLike | null | undefined): suggestion is SuggestionLike => Boolean(
    suggestion &&
    suggestion.type !== 'newtab' &&
    typeof suggestion._xMatchedTabId === 'number' &&
    matchesPrimaryNavigationIntent(suggestion)
  );

  if (settings.prioritizeCurrentPageMatch && typeof settings.currentTabId === 'number') {
    const currentTabId = settings.currentTabId;
    const currentIndex = suggestions.findIndex((suggestion) => (
      isEligibleOpenTab(suggestion) &&
      suggestion._xMatchedTabId === currentTabId
    ));
    if (currentIndex >= 0) {
      return { index: currentIndex, reason: 'currentOpenTab' };
    }
  }

  return { index: -1, reason: '' };
}

function getNavigationSuggestionPathDepth(url: unknown): number {
  try {
    return new URL(String(url || '').trim()).pathname.split('/').filter(Boolean).length;
  } catch (e) {
    return Number.MAX_SAFE_INTEGER;
  }
}

function getDefaultNavigationUrlDisplay(url: unknown): string {
  try {
    const parsed = new URL(String(url || '').trim());
    return `${normalizeHost(parsed.hostname)}${parsed.pathname === '/' ? '' : parsed.pathname}`;
  } catch (e) {
    return String(url || '').trim();
  }
}

// A query that is a URL: the row going there, or a URL starting with it.
function scoreUrlQueryMatch(
  suggestion: SuggestionLike,
  query: string,
  directUrl: string,
  settings: StrongNavigationOptions
): number {
  const queryLower = query.toLowerCase();
  const getUrlDisplay = typeof settings.getUrlDisplay === 'function'
    ? settings.getUrlDisplay
    : getDefaultNavigationUrlDisplay;
  const suggestionUrlText = (getUrlDisplay(suggestion.url || '') || '').toLowerCase();
  const isDirectRow = suggestion.type === 'directUrl';
  const isDirectMatch = isDirectNavigationMatch(suggestion, query, { ...settings, directNavigationUrl: directUrl });
  if (!isDirectRow && isDirectMatch) {
    return 520;
  }
  if (suggestionUrlText && suggestionUrlText === queryLower) {
    return isDirectRow ? 420 : 480;
  }
  if (isDirectRow && isDirectMatch) {
    return 400;
  }
  if (suggestionUrlText && suggestionUrlText.startsWith(queryLower)) {
    return isDirectRow ? 320 : 280;
  }
  return 0;
}

const GENERIC_NAVIGATION_TERMS: ReadonlySet<string> = new Set([
  'home', 'login', 'account', 'settings', 'dashboard', 'search', 'docs', 'help', 'api'
]);

// How the query appears in the title: a whole word, its start, or where
// another word starts. Inside a word ("over" in "Discover") it names no
// page strongly enough to lead the list.
function scoreTitleMatch(titleLower: string, queryLower: string): number {
  if (splitSearchTerms(titleLower).includes(queryLower)) {
    return 140;
  }
  if (titleLower.startsWith(queryLower)) {
    return 100;
  }
  return findSearchLiteral(titleLower, queryLower) === 'word' ? 42 : 0;
}

// Site roots rank first, deep pages lower.
function scorePathDepth(url: string | undefined): number {
  const depth = getNavigationSuggestionPathDepth(url);
  if (depth === 0) {
    return 90;
  }
  if (depth === 1) {
    return 36;
  }
  return Number.isFinite(depth) ? -Math.min(32, (depth - 1) * 8) : 0;
}

function scoreRowSource(suggestion: SuggestionLike): number {
  if (suggestion.type === 'bookmark') {
    return 16;
  }
  if (suggestion.type === 'history') {
    return 10;
  }
  return suggestion.type === 'topSite' || suggestion.isTopSite ? 12 : 0;
}

// A one-word query that names a page: the title, the page's depth, a home
// title, the source and earlier picks.
function scoreNameQueryMatch(suggestion: SuggestionLike, queryLower: string): number {
  if (/\s/.test(queryLower) || queryLower.length < 4 || GENERIC_NAVIGATION_TERMS.has(queryLower)) {
    return 0;
  }
  const titleLower = normalizeSearchText(suggestion.title);
  const titleScore = scoreTitleMatch(titleLower, queryLower);
  if (!titleScore) {
    return 0;
  }
  const homeTitleScore = /(^|[\s-])(home|首页)([\s-]|$)/i.test(titleLower) ? 28 : 0;
  const selectionBoost = Number(suggestion.selectionBoost) || 0;
  return titleScore + scorePathDepth(suggestion.url) + homeTitleScore + scoreRowSource(suggestion) +
    (selectionBoost > 0 ? Math.min(260, selectionBoost) : 0);
}

function getStrongNavigationMatchScore(
  suggestion: SuggestionLike | null | undefined,
  rawQuery: unknown,
  options?: StrongNavigationOptions | null
): number {
  const settings: StrongNavigationOptions = options && typeof options === 'object' ? options : {};
  if (!suggestion || !suggestion.url || suggestion.type === 'newtab' || suggestion.type === 'googleSuggest') {
    return 0;
  }
  const query = String(rawQuery || '').trim();
  if (!query) {
    return 0;
  }
  const directUrl = getDirectNavigationUrlForQuery(query, settings);
  return directUrl
    ? scoreUrlQueryMatch(suggestion, query, directUrl, settings)
    : scoreNameQueryMatch(suggestion, query.toLowerCase());
}

// Moves the strongest navigation match to the front of list (in place) and
// returns it; null when none is strong enough.
function promoteStrongNavigationMatch<T extends SuggestionLike>(
  list: T[] | null | undefined,
  rawQuery: unknown,
  options?: StrongNavigationOptions | null
): T | null {
  if (!Array.isArray(list)) {
    return null;
  }
  let bestIndex = -1;
  let bestScore = 0;
  for (let i = 0; i < list.length; i += 1) {
    const score = getStrongNavigationMatchScore(list[i], rawQuery, options);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  if (bestScore < 140 || bestIndex < 0) {
    return null;
  }
  if (bestIndex > 0) {
    const [picked] = list.splice(bestIndex, 1);
    list.unshift(picked);
    return picked;
  }
  return list[0] || null;
}

export {
  buildComparableNavigationUrl,
  buildTabMatchUrl,
  collectSearchMatches,
  findSearchOpenTabMatchIndex,
  getStrongNavigationMatchScore,
  isDirectNavigationMatch,
  promoteStrongNavigationMatch
};
export type { OpenTabMatch, OpenTabMatchOptions, StrongNavigationOptions };
