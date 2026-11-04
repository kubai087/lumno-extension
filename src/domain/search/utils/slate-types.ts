// The shapes the suggestion slate modules share.
import type { SearchQueryContext, SiteSearchProvider } from '../types';
import type { OpenTabMatchOptions } from './navigation-matching';

type SlateContext = Pick<SearchQueryContext, 'queryLower' | 'queryTerms' | 'intentType' | 'hasSettingsIntent' |
  'hasInformationalIntent' | 'coreQueryTerms'>;

// The text an autocompletion would put in the input, and its page.
interface AutocompleteCandidate {
  url?: string;
  completion?: string;
}

// What the overlay and the New Tab search box supply to rank a slate.
interface SlateMatchers<T> {
  filterSuggestions?: (items: T[]) => T[];
  promoteStrongNavigationMatch: (list: T[], rawQuery: string) => T | null;
  promoteTopSiteMatch: (list: T[], rawQuery: string) => T | null;
  getSiteSearchTriggerCandidate: (
    input: unknown,
    providers: SiteSearchProvider[] | undefined,
    topSiteMatch: T | null
  ) => SiteSearchProvider | null;
  getAutocompleteCandidate: (suggestions: T[] | undefined, rawQuery: string) => AutocompleteCandidate | null;
  getUrlDisplay: (url: string | undefined) => string;
}

interface RankSlateOptions<T> {
  matchers: SlateMatchers<T>;
  query?: string;
  rawQuery?: string;
  triggerInput?: unknown;
  providers?: SiteSearchProvider[];
  inlineSuggestion?: T | null;
  siteSearchActive?: boolean;
  // false when the reader wants search rows before local results.
  preferAutocompleteFirst?: boolean;
  onlyKeywordSuggestions?: boolean;
  autocompleteSuggestions?: T[];
  openTabMatch?: OpenTabMatchOptions | null;
}

type PrimaryHighlightReason =
  | 'none' | 'navigation' | 'autocomplete' | 'inline' | 'topSite' | 'currentOpenTab' | 'default';

interface RankedSlate<T> {
  suggestions: T[];
  primaryHighlightIndex: number;
  primaryHighlightReason: PrimaryHighlightReason;
  primarySuggestion: T | null;
  mergedProvider: SiteSearchProvider | null;
  siteSearchTrigger: SiteSearchProvider | null;
}

interface EngineSuggestionPolicy {
  hasLocalResults: boolean;
  limit: number;
  score: number;
}

interface EngineSuggestionLimits {
  maxEngineSuggestions?: number;
  maxEngineSuggestionsWithLocalResults?: number;
  searchFirst?: boolean;
}

export type {
  AutocompleteCandidate,
  EngineSuggestionLimits,
  EngineSuggestionPolicy,
  PrimaryHighlightReason,
  RankSlateOptions,
  RankedSlate,
  SlateContext,
  SlateMatchers
};
