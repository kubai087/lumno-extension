// Search engine suggestions: their scores, limits and kinds, and the
// policy for how many the slate shows.
import type { SuggestionLike } from '../types';
import { SEARCH_POLICY } from './search-policy';
import { getSearchNavigationRepresentativeSignal, isSearchLikelyBrandProductQuery } from './navigation-signals';
import type { EngineSuggestionLimits, EngineSuggestionPolicy, SlateContext } from './slate-types';
import { normalizeSearchText } from './text-normalize';

function getSearchEngineSuggestionScore(
  context: SlateContext,
  localSuggestions: ReadonlyArray<SuggestionLike | null | undefined> | null | undefined
): number {
  const candidates: ReadonlyArray<SuggestionLike | null | undefined> = Array.isArray(localSuggestions) ? localSuggestions : [];
  const hasStrongLocalDirectMatch = candidates.some((suggestion) => (
    suggestion &&
    suggestion.type !== 'googleSuggest' &&
    getSearchNavigationRepresentativeSignal(suggestion, context) >= 6
  ));

  if (context.intentType === 'brand') {
    return hasStrongLocalDirectMatch ? 18 : 48;
  }
  if (isSearchLikelyBrandProductQuery(context)) {
    return hasStrongLocalDirectMatch ? 34 : 78;
  }
  if (context.intentType === 'path' || context.intentType === 'revisit') {
    return 52;
  }
  if (context.hasInformationalIntent) {
    return 220;
  }
  return 160;
}

function getSearchEngineSuggestionLimit(value: unknown): number {
  const rawLimit = Number(value);
  return Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.floor(rawLimit)
    : SEARCH_POLICY.maxEngineSuggestions;
}

function normalizeSearchEngineSuggestionText(value: unknown): string {
  return String(value || '').trim();
}

// The engine's suggested queries, trimmed, without the query itself or
// repeats, up to the limit.
function normalizeSearchEngineSuggestions(items: unknown, query: unknown, options?: { limit?: number } | null): string[] {
  const suggestions: unknown[] = Array.isArray(items) ? items : [];
  const settings: { limit?: number } = options && typeof options === 'object' ? options : {};
  const limit = getSearchEngineSuggestionLimit(settings.limit);
  const queryText = normalizeSearchEngineSuggestionText(query);
  const queryKey = queryText.toLowerCase();
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (let i = 0; i < suggestions.length && normalized.length < limit; i += 1) {
    const suggestion = normalizeSearchEngineSuggestionText(suggestions[i]);
    if (!suggestion) {
      continue;
    }
    const suggestionKey = suggestion.toLowerCase();
    if (suggestionKey === queryKey || seen.has(suggestionKey)) {
      continue;
    }
    seen.add(suggestionKey);
    normalized.push(suggestion);
  }
  return normalized;
}

function isSearchEngineSuggestion(suggestion: SuggestionLike | null | undefined): boolean {
  return Boolean(suggestion && suggestion.type === 'googleSuggest');
}

// While the query's search engine suggestions are on their way: the last
// ones shown that still start with what is typed now, so the list keeps
// those rows instead of shrinking to the local ones and growing back on
// every key.
function carryOverEngineSuggestions<T extends SuggestionLike>(
  previous: ReadonlyArray<T | null | undefined> | null | undefined,
  query: unknown,
  previousQuery?: string
): T[] {
  const typed = normalizeSearchText(String(query || '').trim());
  if (!typed) {
    return [];
  }
  if (previousQuery !== undefined) {
    const origin = normalizeSearchText(previousQuery.trim());
    if (!origin || !typed.startsWith(origin)) return [];
  }
  return (Array.isArray(previous) ? previous : []).filter((suggestion): suggestion is T => {
    if (!suggestion || !isSearchEngineSuggestion(suggestion)) {
      return false;
    }
    const text = normalizeSearchText(String(suggestion.title || '').trim());
    return text.length > typed.length && text.startsWith(typed);
  });
}

function isSearchActionSuggestion(suggestion: SuggestionLike | null | undefined): boolean {
  return Boolean(suggestion && suggestion.type === 'newtab');
}

function isKeywordSearchSuggestion(suggestion: SuggestionLike | null | undefined): boolean {
  return isSearchEngineSuggestion(suggestion) || isSearchActionSuggestion(suggestion);
}

// Navigation rows, then search rows (or the other way round with searchFirst).
function groupSearchSuggestionsByKind<T extends SuggestionLike>(
  list: ReadonlyArray<T | null | undefined> | null | undefined,
  options?: { searchFirst?: boolean } | null
): T[] {
  const suggestions: T[] = Array.isArray(list) ? list.filter((item): item is T => Boolean(item)) : [];
  const settings: { searchFirst?: boolean } = options && typeof options === 'object' ? options : {};
  const navigationSuggestions: T[] = [];
  const keywordSuggestions: T[] = [];
  suggestions.forEach((suggestion) => {
    if (isKeywordSearchSuggestion(suggestion)) {
      keywordSuggestions.push(suggestion);
    } else {
      navigationSuggestions.push(suggestion);
    }
  });
  return settings.searchFirst
    ? [...keywordSuggestions, ...navigationSuggestions]
    : [...navigationSuggestions, ...keywordSuggestions];
}


function hasLocalResultSuggestion(list: ReadonlyArray<SuggestionLike | null | undefined> | null | undefined): boolean {
  return (Array.isArray(list) ? list : []).some((suggestion) => (
    suggestion && !isKeywordSearchSuggestion(suggestion)
  ));
}

function areOnlyKeywordSearchSuggestions(list: ReadonlyArray<SuggestionLike | null | undefined> | null | undefined): boolean {
  const suggestions: ReadonlyArray<SuggestionLike | null | undefined> = Array.isArray(list) ? list : [];
  return suggestions.length > 0 && suggestions.every(isKeywordSearchSuggestion);
}

function getAutocompleteSearchSuggestionPool<T extends SuggestionLike>(list: readonly T[] | null | undefined): T[] {
  const suggestions: readonly T[] = Array.isArray(list) ? list : [];
  if (!hasLocalResultSuggestion(suggestions)) {
    return suggestions.slice();
  }
  return suggestions.filter((suggestion) => !isSearchEngineSuggestion(suggestion));
}

function getKeywordSearchSuggestionState<T extends SuggestionLike>(list: readonly T[] | null | undefined) {
  const suggestions: readonly T[] = Array.isArray(list) ? list : [];
  return {
    onlyKeywordSuggestions: areOnlyKeywordSearchSuggestions(suggestions),
    hasLocalResults: hasLocalResultSuggestion(suggestions),
    autocompleteSuggestions: getAutocompleteSearchSuggestionPool(suggestions)
  };
}

function getSearchEngineSuggestionPolicy(
  context: SlateContext,
  localSuggestions: ReadonlyArray<SuggestionLike | null | undefined> | null | undefined,
  policy?: EngineSuggestionLimits | null
): EngineSuggestionPolicy {
  const settings: EngineSuggestionLimits = policy && typeof policy === 'object' ? policy : {};
  const hasLocalResults = hasLocalResultSuggestion(localSuggestions);
  const baseScore = getSearchEngineSuggestionScore(context, localSuggestions);
  const maxEngineSuggestions = getSearchEngineSuggestionLimit(settings.maxEngineSuggestions);
  const rawLocalResultLimit = Number(settings.maxEngineSuggestionsWithLocalResults);
  const localResultLimit = Number.isFinite(rawLocalResultLimit) && rawLocalResultLimit > 0
    ? Math.floor(rawLocalResultLimit)
    : SEARCH_POLICY.maxEngineSuggestionsWithLocalResults;
  return {
    hasLocalResults,
    limit: hasLocalResults && settings.searchFirst !== true
      ? Math.min(localResultLimit, maxEngineSuggestions)
      : maxEngineSuggestions,
    score: hasLocalResults ? Math.min(baseScore, 1) : baseScore
  };
}

export {
  areOnlyKeywordSearchSuggestions,
  carryOverEngineSuggestions,
  getAutocompleteSearchSuggestionPool,
  getKeywordSearchSuggestionState,
  getSearchEngineSuggestionLimit,
  getSearchEngineSuggestionPolicy,
  getSearchEngineSuggestionScore,
  groupSearchSuggestionsByKind,
  hasLocalResultSuggestion,
  isKeywordSearchSuggestion,
  isSearchActionSuggestion,
  isSearchEngineSuggestion,
  normalizeSearchEngineSuggestionText,
  normalizeSearchEngineSuggestions
};
