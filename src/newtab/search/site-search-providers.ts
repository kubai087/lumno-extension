// Site search and aggregate search providers: running them, icons, labels
// and the trigger/scope lookups used by the search input. The lists
// themselves are the catalog's.
import * as BundledIcons from '../../domain/favicon/shortcut-favicon/bundled-icons';
import type { OpenDisposition } from '../../domain/messages';
import type * as AggregateSearchStore from '../../domain/search/aggregate-search-store';
import type { AggregateScopeProvider, AggregateSearch } from '../../domain/search/aggregate-search-store';
import type * as AggregateSearchSurface from '../../domain/search/aggregate-search-surface';
import type {
  SiteSearchProvider
} from '../../domain/search/types';
import * as LumnoMessaging from '../../platform/messaging';
import type { ShowToast, Translate } from '../newtab-types';
import { getAggregateSearchId } from './search-types';
import type { FaviconUrlResolver } from '../../domain/favicon/resolver';
import * as SearchSiteSearchProviders from '../../domain/search/utils/site-search-providers';
import type { SiteSearchIconCache } from '../../shared/search/site-search-icon-cache';
import * as ShortcutIconCache from '../../domain/favicon/shortcut-favicon/persisted';
import { isInteractiveSiteSearchProvider } from '../../domain/search/utils/site-search-providers';
import { isAggregateSearchProvider } from '../../domain/search/aggregate-search-store';

interface SiteSearchProvidersDeps {
  AGGREGATE_SEARCH_STORE: Pick<typeof AggregateSearchStore, 'isAggregateSearchProvider' | 'createScopeProvider'>;
  AGGREGATE_SEARCH_SURFACE: Pick<typeof AggregateSearchSurface, 'createAggregateSearchRequestController'>;
  showToast: ShowToast;
  t: Translate;
  navigateToUrl(url: string): void;
  getPageFaviconUrlResolver(): Pick<FaviconUrlResolver, 'getProviderFaviconUrl'> | null;
  siteSearchIconCache: Pick<SiteSearchIconCache, 'icons'>;
  getExtensionResourceUrl(resourcePath: string): string;
  getHelpCenterLocale?(): string;
}

function createSiteSearchProviders(deps: SiteSearchProvidersDeps) {
  const {
    AGGREGATE_SEARCH_STORE,
    AGGREGATE_SEARCH_SURFACE,
    showToast,
    t,
    navigateToUrl,
    getPageFaviconUrlResolver,
    siteSearchIconCache,
    getExtensionResourceUrl,
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










  function getProviderHost(provider: Partial<SiteSearchProvider> | null | undefined): string {
    return SearchSiteSearchProviders.getSiteSearchProviderHost(provider);
  }





  return {
    buildSearchUrl,
    runSiteSearchProviderQuery,
    getProviderFaviconPageUrl,
    getProviderIcon,
    createAggregateSearchScopeProvider,
    getProviderHost,
  };
}

type SiteSearchProviders = ReturnType<typeof createSiteSearchProviders>;

export { createSiteSearchProviders };
export type { SiteSearchProviders, SiteSearchProvidersDeps };
