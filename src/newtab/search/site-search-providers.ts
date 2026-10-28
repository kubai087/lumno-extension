// Site search and aggregate search providers: running them, icons, labels
// and the trigger/scope lookups used by the search input. The lists
// themselves are the catalog's.
import * as BundledIcons from '../../domain/favicon/shortcut-favicon/bundled-icons';
import type { OpenDisposition } from '../../domain/messages';
import type * as AggregateSearchStore from '../../domain/search/aggregate-search-store';
import type { AggregateScopeProvider, AggregateSearch } from '../../domain/search/aggregate-search-store';
import type * as AggregateSearchSurface from '../../domain/search/aggregate-search-surface';
import type {
  LocalSearchScope,
  LocalSearchScopeRule,
  SiteSearchProvider,
  SuggestionLike
} from '../../domain/search/types';
import * as LumnoMessaging from '../../platform/messaging';
import type { FormatMessage, ShowToast, Translate } from '../newtab-types';
import { getAggregateSearchId } from './search-types';
import type { ActiveLocalScope } from './search-types';
import type { RemixIconName } from '../../shared/ui/remix-icon';
import type { FaviconUrlResolver } from '../../domain/favicon/resolver';
import * as SearchNavigationMatching from '../../domain/search/utils/navigation-matching';
import * as SearchSiteSearchMatching from '../../domain/search/utils/site-search-matching';
import * as SearchSiteSearchProviders from '../../domain/search/utils/site-search-providers';
import * as SearchEngineSuggestions from '../../domain/search/utils/engine-suggestions';
import type { SiteSearchIconCache } from '../../shared/search/site-search-icon-cache';
import * as ShortcutIconCache from '../../domain/favicon/shortcut-favicon/persisted';
import { searchResultSourceTypes } from '../../domain/settings/search';
import type { SettingsStore } from '../../platform/settings-store';
import { isAiSiteSearchProvider, isInteractiveSiteSearchProvider } from '../../domain/search/utils/site-search-providers';
import { isAggregateSearchProvider } from '../../domain/search/aggregate-search-store';

interface SiteSearchProvidersDeps {
  settings: Pick<SettingsStore, 'get'>;
  AGGREGATE_SEARCH_STORE: Pick<typeof AggregateSearchStore, 'isAggregateSearchProvider' | 'createScopeProvider'>;
  AGGREGATE_SEARCH_SURFACE: Pick<typeof AggregateSearchSurface, 'createAggregateSearchRequestController'>;
  showToast: ShowToast;
  t: Translate;
  navigateToUrl(url: string): void;
  getPageFaviconUrlResolver(): Pick<FaviconUrlResolver, 'getProviderFaviconUrl'> | null;
  siteSearchIconCache: Pick<SiteSearchIconCache, 'icons'>;
  getExtensionResourceUrl(resourcePath: string): string;
  formatMessage: FormatMessage;
  getDirectNavigationUrl: NonNullable<Parameters<typeof SearchNavigationMatching.promoteStrongNavigationMatch>[2]>['getDirectNavigationUrl'];
  getUrlDisplay(url: string): string;
  getHelpCenterLocale?(): string;
}

function createSiteSearchProviders(deps: SiteSearchProvidersDeps) {
  const {
    settings,
    AGGREGATE_SEARCH_STORE,
    AGGREGATE_SEARCH_SURFACE,
    showToast,
    t,
    navigateToUrl,
    getPageFaviconUrlResolver,
    siteSearchIconCache,
    getExtensionResourceUrl,
    formatMessage,
    getDirectNavigationUrl,
    getUrlDisplay,
    getHelpCenterLocale
  } = deps;


  let aggregateSearchRequestController: ReturnType<typeof AggregateSearchSurface.createAggregateSearchRequestController> | null = null;

  function buildSearchUrl(template: string | undefined, query: string, provider?: SiteSearchProvider | null): string {
    if (!template) {
      return '';
    }
    const url = template.replace(/\{query\}/g, encodeURIComponent(query));
    return provider && typeof getHelpCenterLocale === 'function'
      ? SearchSiteSearchProviders.withHelpCenterLocale(url, provider, getHelpCenterLocale())
      : url;
  }





  function getAggregateSearchRequestController(): ReturnType<typeof AggregateSearchSurface.createAggregateSearchRequestController> {
    if (aggregateSearchRequestController) {
      return aggregateSearchRequestController;
    }
    aggregateSearchRequestController = AGGREGATE_SEARCH_SURFACE.createAggregateSearchRequestController({
      chromeApi: chrome,
      onFeedback(descriptor) {
        showToast(t(descriptor.messageKey, descriptor.fallback), descriptor.isError);
      }
    });
    return aggregateSearchRequestController;
  }

  // Runs the query with the provider; false when it cannot.
  function runSiteSearchProviderQuery(provider: SiteSearchProvider | null | undefined, query: string, disposition?: OpenDisposition): boolean {
    const trimmedQuery = String(query || '').trim();
    if (!provider || !trimmedQuery) {
      return false;
    }
    const aggregateId = isAggregateSearchProvider(provider) ? getAggregateSearchId(provider) : '';
    if (aggregateId) {
      const normalizedDisposition = disposition || 'currentTab';
      const controller = getAggregateSearchRequestController();
      controller.run({
        aggregateId,
        disposition: normalizedDisposition,
        query: trimmedQuery
      });
      return true;
    }
    if (isInteractiveSiteSearchProvider(provider)) {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
        action: 'runSiteSearchProviderQuery',
        provider: provider,
        query: trimmedQuery,
        disposition: disposition || 'currentTab'
      });
      return true;
    }
    const siteUrl = buildSearchUrl(provider.template, trimmedQuery, provider);
    if (!siteUrl) {
      return false;
    }
    if (disposition === 'backgroundTab' || disposition === 'newTab') {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
        action: 'createTab',
        url: siteUrl,
        disposition
      });
      return true;
    }
    navigateToUrl(siteUrl);
    return true;
  }

  function getProviderFaviconPageUrl(provider: Partial<SiteSearchProvider> | null | undefined): string {
    return BundledIcons.getSiteSearchProviderPageUrl(provider);
  }

  function getProviderIcon(provider: Partial<SiteSearchProvider> | null | undefined): string {
    const resolver = getPageFaviconUrlResolver();
    if (!resolver) {
      return '';
    }
    const iconUrl = BundledIcons.getSiteSearchProviderIcon(
      siteSearchIconCache.icons, provider, Date.now(), {
        ...ShortcutIconCache.SITE_SEARCH_CACHE_OPTIONS,
        resolveAssetUrl: getExtensionResourceUrl
      }
    );
    return resolver.getProviderFaviconUrl(getProviderFaviconPageUrl(provider), iconUrl);
  }

  function createAggregateSearchScopeProvider(definition: AggregateSearch | null | undefined): AggregateScopeProvider | null {
    return AGGREGATE_SEARCH_STORE.createScopeProvider(definition);
  }

  function getSiteSearchDisplayName(provider: Partial<SiteSearchProvider> | null | undefined): string {
    if (!provider) {
      return t('site_search_default', '站内');
    }
    const mapping = SearchSiteSearchProviders.getSiteSearchProviderDisplayNameMessage(provider);
    if (mapping) {
      return t(mapping.messageKey, mapping.fallback);
    }
    return provider.name || provider.key || t('site_search_default', '站内');
  }

  function getSiteSearchActionTitle(provider: SiteSearchProvider | null | undefined, query?: string): string {
    const site = getSiteSearchDisplayName(provider);
    const queryText = String(query || '').trim();
    if (isAggregateSearchProvider(provider)) {
      return queryText
        ? formatMessage('aggregate_search_action_query', '使用{name}搜索“{query}”', {
            name: site,
            query: queryText
          })
        : formatMessage('aggregate_search_action', '使用{name}搜索', { name: site });
    }
    if (isAiSiteSearchProvider(provider)) {
      return queryText
        ? formatMessage('ask_ai_provider_query', '向 {site} 提问 "{query}"', { site, query: queryText })
        : formatMessage('ask_ai_provider', '向 {site} 提问', { site });
    }
    return queryText
      ? formatMessage('search_in_site_query', '在 {site} 中搜索 "{query}"', { site, query: queryText })
      : formatMessage('search_in_site', '在 {site} 中搜索', { site });
  }

  function getSiteSearchPrefixText(provider: SiteSearchProvider | null | undefined): string {
    if (isAiSiteSearchProvider(provider)) {
      return getSiteSearchDisplayName(provider);
    }
    return getSiteSearchDisplayName(provider) || formatMessage('search_in_site', '在 {site} 中搜索', {
      site: provider && provider.name ? provider.name : ''
    });
  }

  function getInlineSiteSearchCandidate(
    ...args: Parameters<typeof SearchSiteSearchMatching.getInlineSiteSearchCandidate>
  ): ReturnType<typeof SearchSiteSearchMatching.getInlineSiteSearchCandidate> {
    const [input, providers] = args;
    return SearchSiteSearchMatching.getInlineSiteSearchCandidate(input, providers);
  }

  function promoteStrongNavigationMatch<T extends SuggestionLike>(list: T[] | null | undefined, rawQuery: unknown): T | null {
    return SearchNavigationMatching.promoteStrongNavigationMatch(list, rawQuery, {
      getDirectNavigationUrl,
      getUrlDisplay
    });
  }

  function getKeywordSearchSuggestionState<T extends SuggestionLike>(list: readonly T[] | null | undefined) {
    return SearchEngineSuggestions.getKeywordSearchSuggestionState(list);
  }

  function matchesTopSitePrefix(suggestion: SuggestionLike | null | undefined, input: unknown): boolean {
    if (!suggestion || !(suggestion.type === 'topSite' || suggestion.isTopSite)) {
      return false;
    }
    const query = String(input || '').trim().toLowerCase();
    if (!query) {
      return false;
    }
    const titleText = String(suggestion.title || '').toLowerCase();
    if (titleText.startsWith(query)) {
      return true;
    }
    const urlText = getUrlDisplay(suggestion.url || '');
    if (!urlText) {
      return false;
    }
    const host = urlText.split('/')[0] || '';
    return host.toLowerCase().startsWith(query);
  }

  function getTopSiteMatchCandidate<T extends SuggestionLike>(list: readonly (T | null | undefined)[] | null | undefined, input: unknown): T | null {
    if (!list) {
      return null;
    }
    const query = String(input || '').trim();
    if (!query || /\s/.test(query)) {
      return null;
    }
    let fallback: T | null = null;
    for (let i = 0; i < list.length; i += 1) {
      const suggestion = list[i];
      if (!suggestion || !(suggestion.type === 'topSite' || suggestion.isTopSite)) {
        continue;
      }
      const urlText = getUrlDisplay(suggestion.url || '');
      const host = urlText ? (urlText.split('/')[0] || '') : '';
      if (host && host.toLowerCase().startsWith(query.toLowerCase())) {
        return suggestion;
      }
      if (!fallback && matchesTopSitePrefix(suggestion, query)) {
        fallback = suggestion;
      }
    }
    return fallback;
  }

  // Moves the top site the query starts to the front of `list` when it
  // leads the results; returns it, or null.
  function promoteTopSiteMatch<T extends SuggestionLike>(list: T[], queryText: unknown): T | null {
    const match = getTopSiteMatchCandidate(list, queryText);
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
    if (matchIndex === 0) {
      return list[0];
    }
    return null;
  }

  function getProviderHost(provider: Partial<SiteSearchProvider> | null | undefined): string {
    return SearchSiteSearchProviders.getSiteSearchProviderHost(provider);
  }

  function getSiteSearchTriggerCandidate(
    input: unknown,
    providers: Parameters<typeof SearchSiteSearchMatching.getSiteSearchTriggerCandidate>[1],
    topSiteMatch?: SuggestionLike | null
  ): ReturnType<typeof SearchSiteSearchMatching.getSiteSearchTriggerCandidate> {
    return SearchSiteSearchMatching.getSiteSearchTriggerCandidate(input, providers, topSiteMatch, {
      matchesTopSitePrefix
    });
  }

  function getLocalSearchScopeCandidate(
    input: unknown,
    rules: ReadonlyArray<LocalSearchScopeRule | null | undefined> | null | undefined
  ): LocalSearchScope | null {
    const scope = SearchSiteSearchProviders.findLocalSearchScope(input, rules);
    if (!scope || !settings.get(searchResultSourceTypes).includes(scope.sourceType)) {
      return null;
    }
    return scope;
  }

  function getLocalSearchScopeLabel(scope: ActiveLocalScope | null | undefined): string {
    const sourceType = scope && scope.sourceType ? scope.sourceType : '';
    if (sourceType === 'bookmark') {
      return t('search_tag_bookmark', '书签');
    }
    if (sourceType === 'history') {
      return t('search_tag_history', '历史');
    }
    if (sourceType === 'topSite') {
      return t('search_tag_top_site', '常用');
    }
    return '';
  }

  function getLocalSearchScopeIconName(sourceType: string): RemixIconName {
    if (sourceType === 'bookmark') {
      return 'ri-bookmark-3-line';
    }
    if (sourceType === 'history') {
      return 'ri-history-line';
    }
    return 'ri-star-line';
  }

  return {
    buildSearchUrl,
    runSiteSearchProviderQuery,
    getProviderFaviconPageUrl,
    getProviderIcon,
    createAggregateSearchScopeProvider,
    getSiteSearchDisplayName,
    getSiteSearchActionTitle,
    getSiteSearchPrefixText,
    getInlineSiteSearchCandidate,
    promoteStrongNavigationMatch,
    getKeywordSearchSuggestionState,
    getTopSiteMatchCandidate,
    promoteTopSiteMatch,
    getProviderHost,
    getSiteSearchTriggerCandidate,
    getLocalSearchScopeCandidate,
    getLocalSearchScopeLabel,
    getLocalSearchScopeIconName
  };
}

type SiteSearchProviders = ReturnType<typeof createSiteSearchProviders>;

export { createSiteSearchProviders };
export type { SiteSearchProviders, SiteSearchProvidersDeps };
