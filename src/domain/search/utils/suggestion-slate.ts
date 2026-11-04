// Composing and ranking the suggestion slate shown under the input.
import type { SuggestionLike } from '../types';
import { findSearchOpenTabMatchIndex } from './navigation-matching';
import { SEARCH_POLICY } from './search-policy';
import { findProviderForSiteSearchSuggestion } from './site-search-matching';
import { isKeywordSearchSuggestion, isSearchActionSuggestion, isSearchEngineSuggestion } from './engine-suggestions';
import type { AutocompleteCandidate, PrimaryHighlightReason, RankSlateOptions, RankedSlate } from './slate-types';
import { compactSearchQuery } from './text-normalize';

// The rows picked so far, up to the limit.
interface SlatePicks<T> {
  selected: T[];
  picked: Set<T>;
  limit: number;
}

function pickSlateRow<T>(picks: SlatePicks<T>, suggestion: T | undefined): boolean {
  if (!suggestion || picks.picked.has(suggestion) || picks.selected.length >= picks.limit) {
    return false;
  }
  picks.selected.push(suggestion);
  picks.picked.add(suggestion);
  return true;
}

// Picks rows in order until the slate has `target` rows.
function pickSlateRowsUntil<T>(picks: SlatePicks<T>, rows: readonly T[], target: number): void {
  for (let i = 0; i < rows.length && picks.selected.length < target; i += 1) {
    pickSlateRow(picks, rows[i]);
  }
}

function readSlateLimit(options: { limit?: number } | null | undefined): number {
  const rawLimit = Number(options && typeof options === 'object' ? options.limit : undefined);
  const fallbackLimit = Number(SEARCH_POLICY.displaySuggestionLimit) || 10;
  return Number.isInteger(rawLimit) && rawLimit >= 5 && rawLimit <= 12 ? rawLimit : fallbackLimit;
}

// Local rows fill the rest, with history and bookmarks each held to half
// of it; the rows over that cap come back for whatever room is left.
// `localSourceCounts` holds the local rows already picked, by source.
function pickLocalRows<T extends SuggestionLike>(picks: SlatePicks<T>, localSuggestions: readonly T[], localSlotTarget: number,
  localSourceCounts: Map<string, number> = new Map()): T[] {
  const localSourceCap = Math.max(1, Math.ceil(localSlotTarget / 2));
  const deferred: T[] = [];
  for (let i = 0; i < localSuggestions.length && picks.selected.length < picks.limit; i += 1) {
    const suggestion = localSuggestions[i];
    const sourceType = suggestion && (suggestion.type === 'history' || suggestion.type === 'bookmark') ? suggestion.type : '';
    const sourceCount = sourceType ? (localSourceCounts.get(sourceType) || 0) : 0;
    if (sourceType && sourceCount >= localSourceCap) {
      deferred.push(suggestion);
    } else if (pickSlateRow(picks, suggestion) && sourceType) {
      localSourceCounts.set(sourceType, sourceCount + 1);
    }
  }
  return deferred;
}

// A bookmark, history or top site row whose title is the query itself,
// spaces and case aside: what the person most likely meant to open.
function isExactLocalTitleMatch(suggestion: SuggestionLike, compactQuery: string): boolean {
  return Boolean(compactQuery) &&
    (suggestion.type === 'bookmark' || suggestion.type === 'history' || suggestion.type === 'topSite') &&
    compactSearchQuery(suggestion.title) === compactQuery;
}

// Search first: the search row, then a local row titled exactly as typed,
// then engine suggestions to about 60% of the slate and local rows the rest.
function composeSearchFirstSuggestionSlate<T extends SuggestionLike>(
  list: ReadonlyArray<T | null | undefined> | null | undefined,
  options?: { limit?: number; query?: string } | null
): T[] {
  const suggestions: T[] = Array.isArray(list) ? list.filter((item): item is T => Boolean(item)) : [];
  const limit = readSlateLimit(options);
  const searchSlotTarget = Math.ceil(limit * 0.6);
  const searchActions = suggestions.filter(isSearchActionSuggestion);
  const engineSuggestions = suggestions.filter(isSearchEngineSuggestion);
  const localSuggestions = suggestions.filter((suggestion) => !isKeywordSearchSuggestion(suggestion));
  const compactQuery = compactSearchQuery(options && typeof options === 'object' ? options.query : '');
  const exactLocalMatch = localSuggestions.find((suggestion) => isExactLocalTitleMatch(suggestion, compactQuery));
  const picks: SlatePicks<T> = { selected: [], picked: new Set(), limit };
  const localSourceCounts = new Map<string, number>();

  pickSlateRow(picks, searchActions[0]);
  // It counts as a local row, so the search rows keep their share.
  if (exactLocalMatch && pickSlateRow(picks, exactLocalMatch) && exactLocalMatch.type !== 'topSite') {
    localSourceCounts.set(String(exactLocalMatch.type), 1);
  }
  pickSlateRowsUntil(picks, engineSuggestions, searchSlotTarget + (exactLocalMatch ? 1 : 0));
  const deferredLocal = pickLocalRows(picks, localSuggestions, Math.max(0, limit - searchSlotTarget), localSourceCounts);
  pickSlateRowsUntil(picks, engineSuggestions, limit);
  pickSlateRowsUntil(picks, deferredLocal, limit);
  pickSlateRowsUntil(picks, searchActions.slice(1), limit);
  suggestions.forEach((suggestion) => pickSlateRow(picks, suggestion));
  return [
    ...picks.selected,
    ...suggestions.filter((suggestion) => !picks.picked.has(suggestion))
  ];
}

function pinExactSearchActionSecond<T extends SuggestionLike>(list: ReadonlyArray<T | null | undefined> | null | undefined): T[] {
  const suggestions: T[] = Array.isArray(list) ? list.filter((item): item is T => Boolean(item)) : [];
  if (suggestions.length < 2) {
    return suggestions;
  }
  const searchActionIndex = suggestions.findIndex(isSearchActionSuggestion);
  const primaryResultIndex = suggestions.findIndex((suggestion) => (
    !isKeywordSearchSuggestion(suggestion)
  ));
  if (searchActionIndex < 0 || primaryResultIndex < 0) {
    return suggestions;
  }
  const primaryResult = suggestions[primaryResultIndex];
  const searchAction = suggestions[searchActionIndex];
  const remainingSuggestions = suggestions.filter((suggestion, index) => (
    index !== primaryResultIndex && index !== searchActionIndex
  ));
  return [primaryResult, searchAction, ...remainingSuggestions];
}

function findAutocompleteCandidateSuggestionIndex<T extends SuggestionLike>(
  list: T[],
  candidate: AutocompleteCandidate,
  getUrlDisplay: (url: string | undefined) => string
): number {
  const completion = String(candidate && candidate.completion || '').toLowerCase();
  return list.findIndex((suggestion) => {
    if (!suggestion || suggestion.type === 'newtab') {
      return false;
    }
    if (candidate.url && suggestion.url === candidate.url) {
      return true;
    }
    const suggestionUrlText = getUrlDisplay(suggestion.url);
    if (suggestionUrlText && suggestionUrlText.toLowerCase() === completion) {
      return true;
    }
    return Boolean(suggestion.title && suggestion.title.toLowerCase().startsWith(completion));
  });
}

function moveSuggestionToFront<T>(list: T[], index: number): void {
  if (index > 0) {
    const [suggestion] = list.splice(index, 1);
    list.unshift(suggestion);
  }
}

// Orders a default-mode suggestion slate (no slash command, scope or
// site-search tag active) and decides which row the input highlights first:
// a strong navigation match, the autocomplete target, an inline site search,
// a top site, the page the panel was opened from, or else the first row.
// Shared by the Overlay and the New Tab search box, which supply their own
// matchers.
// Returns a new list; `suggestions` itself is not reordered.
// The list being ranked and the row Enter will open.
interface SlateRanking<T> {
  list: T[];
  primaryHighlightIndex: number;
  primaryHighlightReason: PrimaryHighlightReason;
}

function highlightFirst<T>(ranking: SlateRanking<T>, reason: PrimaryHighlightReason): void {
  ranking.primaryHighlightIndex = 0;
  ranking.primaryHighlightReason = reason;
}

// A strong navigation match moves first and is the row Enter opens; a top
// site match moves up behind it.
function promoteLocalMatches<T extends SuggestionLike>(
  ranking: SlateRanking<T>,
  config: RankSlateOptions<T>,
  trimmedRawQuery: string
): { strongNavigationMatch: T | null; topSiteMatch: T | null } {
  const strongNavigationMatch = config.matchers.promoteStrongNavigationMatch(ranking.list, trimmedRawQuery);
  if (strongNavigationMatch) {
    highlightFirst(ranking, 'navigation');
  }
  return { strongNavigationMatch, topSiteMatch: config.matchers.promoteTopSiteMatch(ranking.list, trimmedRawQuery) };
}

// The row the browser would autocomplete moves first.
function promoteAutocomplete<T extends SuggestionLike>(ranking: SlateRanking<T>, config: RankSlateOptions<T>, rawQuery: string): void {
  const autocompleteCandidate = config.matchers.getAutocompleteCandidate(config.autocompleteSuggestions, rawQuery);
  if (autocompleteCandidate) {
    moveSuggestionToFront(ranking.list, findAutocompleteCandidateSuggestionIndex(
      ranking.list,
      autocompleteCandidate,
      config.matchers.getUrlDisplay
    ));
    highlightFirst(ranking, 'autocomplete');
  }
}

// The page the panel was opened from moves first when it matches, so Enter
// switches back to it. Other open tabs keep their rank.
function promoteOpenTab<T extends SuggestionLike>(ranking: SlateRanking<T>, config: RankSlateOptions<T>, trimmedRawQuery: string): void {
  if (!config.openTabMatch) {
    return;
  }
  const openTabMatch = findSearchOpenTabMatchIndex(ranking.list, Object.assign({}, config.openTabMatch, {
    rawQuery: trimmedRawQuery,
    primaryHighlightIndex: ranking.primaryHighlightIndex
  }));
  if (openTabMatch.index >= 0) {
    moveSuggestionToFront(ranking.list, openTabMatch.index);
    highlightFirst(ranking, 'currentOpenTab');
  }
}

interface RankFlags {
  rawQuery: string;
  trimmedRawQuery: string;
  siteSearchActive: boolean;
  preferAutocompleteFirst: boolean;
  onlyKeywordSuggestions: boolean;
  // Local matches may move first: no site search, no inline row, and the
  // browser's own suggestion goes first.
  canPromoteLocalMatches: boolean;
}

function readRankFlags<T>(config: RankSlateOptions<T>): RankFlags {
  const rawQuery = String(config.rawQuery || '');
  const siteSearchActive = Boolean(config.siteSearchActive);
  const preferAutocompleteFirst = config.preferAutocompleteFirst !== false;
  return {
    rawQuery,
    trimmedRawQuery: rawQuery.trim(),
    siteSearchActive,
    preferAutocompleteFirst,
    onlyKeywordSuggestions: Boolean(config.onlyKeywordSuggestions),
    canPromoteLocalMatches: !siteSearchActive && !config.inlineSuggestion && preferAutocompleteFirst
  };
}

// The local matches that move first, and the top site that matched.
function rankLocalMatches<T extends SuggestionLike>(ranking: SlateRanking<T>, config: RankSlateOptions<T>, flags: RankFlags): T | null {
  if (!flags.canPromoteLocalMatches) {
    return null;
  }
  const { strongNavigationMatch, topSiteMatch } = promoteLocalMatches(ranking, config, flags.trimmedRawQuery);
  if (!strongNavigationMatch && !flags.onlyKeywordSuggestions) {
    promoteAutocomplete(ranking, config, flags.rawQuery);
  }
  if (!strongNavigationMatch && topSiteMatch && !config.inlineSuggestion) {
    highlightFirst(ranking, 'topSite');
  }
  return topSiteMatch;
}

// The inline completion goes first and is what Enter opens.
function placeInlineSuggestion<T extends SuggestionLike>(ranking: SlateRanking<T>, config: RankSlateOptions<T>): void {
  if (!config.inlineSuggestion) {
    return;
  }
  ranking.list.unshift(config.inlineSuggestion);
  if (typeof config.matchers.filterSuggestions === 'function') {
    ranking.list = config.matchers.filterSuggestions(ranking.list);
  }
  highlightFirst(ranking, 'inline');
}

function finishRanking<T extends SuggestionLike>(ranking: SlateRanking<T>, config: RankSlateOptions<T>, flags: RankFlags): void {
  if (flags.preferAutocompleteFirst && !flags.siteSearchActive && config.query && !flags.onlyKeywordSuggestions) {
    promoteOpenTab(ranking, config, flags.trimmedRawQuery);
  }
  if (flags.preferAutocompleteFirst) {
    ranking.list = pinExactSearchActionSecond(ranking.list);
  }
  if (config.query && ranking.primaryHighlightIndex < 0 && ranking.list.length > 0) {
    highlightFirst(ranking, 'default');
  }
}

function rankSearchSuggestionSlate<T extends SuggestionLike>(
  suggestions: readonly T[] | null | undefined,
  options: RankSlateOptions<T>
): RankedSlate<T> {
  const config = options;
  const flags = readRankFlags(config);
  const ranking: SlateRanking<T> = {
    list: Array.isArray(suggestions) ? suggestions.slice() : [],
    primaryHighlightIndex: -1,
    primaryHighlightReason: 'none'
  };
  const topSiteMatch = rankLocalMatches(ranking, config, flags);
  const siteSearchTrigger = !flags.siteSearchActive && !config.inlineSuggestion
    ? config.matchers.getSiteSearchTriggerCandidate(config.triggerInput, config.providers, topSiteMatch)
    : null;
  placeInlineSuggestion(ranking, config);
  finishRanking(ranking, config, flags);
  const { list, primaryHighlightIndex, primaryHighlightReason } = ranking;
  const primarySuggestion = primaryHighlightIndex >= 0 ? (list[primaryHighlightIndex] || null) : null;
  return {
    suggestions: list,
    primaryHighlightIndex,
    primaryHighlightReason,
    primarySuggestion,
    mergedProvider: primaryHighlightIndex >= 0 ? findProviderForSiteSearchSuggestion(primarySuggestion, config.providers) : null,
    siteSearchTrigger
  };
}

export {
  composeSearchFirstSuggestionSlate,
  findAutocompleteCandidateSuggestionIndex,
  finishRanking,
  highlightFirst,
  moveSuggestionToFront,
  pickLocalRows,
  pickSlateRow,
  pickSlateRowsUntil,
  pinExactSearchActionSecond,
  placeInlineSuggestion,
  promoteAutocomplete,
  promoteLocalMatches,
  promoteOpenTab,
  rankLocalMatches,
  rankSearchSuggestionSlate,
  readRankFlags,
  readSlateLimit
};
export type {
  RankFlags,
  SlatePicks,
  SlateRanking
};
