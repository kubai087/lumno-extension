// What the typed text matches in the rows and the catalog: the top site it
// names, the address it leads to, the site search or local scope a trigger
// switches to and the site search it runs inline. Both search panels ask
// this one owner; only how a surface shows and opens an address differs.
import type { LocalSearchScope, LocalSearchScopeRule, SiteSearchProvider, SuggestionLike } from '../../domain/search/types';
import * as SearchNavigationMatching from '../../domain/search/utils/navigation-matching';
import * as SearchSiteSearchMatching from '../../domain/search/utils/site-search-matching';
import * as SearchSiteSearchProviders from '../../domain/search/utils/site-search-providers';
import { searchResultSourceTypes } from '../../domain/settings/search';
import type { SettingsStore } from '../../platform/settings-store';

type NavigationOptions = NonNullable<Parameters<typeof SearchNavigationMatching.promoteStrongNavigationMatch>[2]>;

interface SearchMatchingOptions {
  settings: Pick<SettingsStore, 'get'>;
  // An address as the surface shows it.
  getUrlDisplay(url: string): string;
  getDirectNavigationUrl: NavigationOptions['getDirectNavigationUrl'];
}

class SearchMatching {
  private readonly options: SearchMatchingOptions;

  constructor(options: SearchMatchingOptions) {
    this.options = options;
  }

  // Whether a top site's title or host starts with what was typed.
  readonly matchesTopSitePrefix = (suggestion: SuggestionLike | null | undefined, input: unknown): boolean => {
    if (!suggestion || !(suggestion.type === 'topSite' || suggestion.isTopSite)) {
      return false;
    }
    const query = String(input || '').trim().toLowerCase();
    if (!query) {
      return false;
    }
    if (String(suggestion.title || '').toLowerCase().startsWith(query)) {
      return true;
    }
    const urlText = this.options.getUrlDisplay(suggestion.url || '');
    return Boolean(urlText) && (urlText.split('/')[0] || '').toLowerCase().startsWith(query);
  };

  // The top site the typed word names: one whose host starts with it, else
  // one whose title does.
  readonly getTopSiteMatchCandidate = <T extends SuggestionLike>(
    list: readonly (T | null | undefined)[] | null | undefined,
    input: unknown
  ): T | null => {
    if (!Array.isArray(list)) {
      return null;
    }
    const query = String(input || '').trim();
    if (!query || /\s/.test(query)) {
      return null;
    }
    let fallback: T | null = null;
    for (const suggestion of list) {
      if (!suggestion || !(suggestion.type === 'topSite' || suggestion.isTopSite)) {
        continue;
      }
      const urlText = this.options.getUrlDisplay(suggestion.url || '');
      const host = urlText ? (urlText.split('/')[0] || '') : '';
      if (host && host.toLowerCase().startsWith(query.toLowerCase())) {
        return suggestion;
      }
      if (!fallback && this.matchesTopSitePrefix(suggestion, query)) {
        fallback = suggestion;
      }
    }
    return fallback;
  };

  // Puts the matching top site first when it is already the first result.
  readonly promoteTopSiteMatch = <T extends SuggestionLike>(list: T[], queryText: unknown): T | null => {
    const match = this.getTopSiteMatchCandidate(list, queryText);
    if (!match) {
      return null;
    }
    const matchIndex = list.indexOf(match);
    const firstResultIndex = list.findIndex((item) => item && item.type !== 'newtab');
    if (matchIndex !== firstResultIndex) {
      return null;
    }
    if (matchIndex > 0) {
      const [picked] = list.splice(matchIndex, 1);
      list.unshift(picked);
      return picked;
    }
    return matchIndex === 0 ? list[0] : null;
  };

  readonly promoteStrongNavigationMatch = <T extends SuggestionLike>(list: T[] | null | undefined, rawQuery: unknown): T | null => (
    SearchNavigationMatching.promoteStrongNavigationMatch(list, rawQuery, {
      getDirectNavigationUrl: this.options.getDirectNavigationUrl,
      getUrlDisplay: this.options.getUrlDisplay
    })
  );

  readonly getSiteSearchTriggerCandidate = (
    input: unknown,
    providers: Parameters<typeof SearchSiteSearchMatching.getSiteSearchTriggerCandidate>[1],
    topSiteMatch?: SuggestionLike | null
  ): SiteSearchProvider | null => (
    SearchSiteSearchMatching.getSiteSearchTriggerCandidate(input, providers, topSiteMatch, {
      matchesTopSitePrefix: this.matchesTopSitePrefix
    })
  );

  // The local scope a typed trigger narrows to, when its source is on.
  readonly getLocalSearchScopeCandidate = (
    input: unknown,
    rules: ReadonlyArray<LocalSearchScopeRule | null | undefined> | null | undefined
  ): LocalSearchScope | null => {
    const scope = SearchSiteSearchProviders.findLocalSearchScope(input, rules);
    return scope && this.options.settings.get(searchResultSourceTypes).includes(scope.sourceType) ? scope : null;
  };
}

export { SearchMatching };
