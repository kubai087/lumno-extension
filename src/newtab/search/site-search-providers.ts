// Site search and aggregate search providers: running them, icons, labels
// and the trigger/scope lookups used by the search input. The lists
// themselves are the catalog's.
import * as BundledIcons from '../../domain/favicon/shortcut-favicon/bundled-icons';
import type * as AggregateSearchStore from '../../domain/search/aggregate-search-store';
import type { AggregateScopeProvider, AggregateSearch } from '../../domain/search/aggregate-search-store';
import type {
  SiteSearchProvider
} from '../../domain/search/types';
import type { FaviconUrlResolver } from '../../domain/favicon/resolver';
import * as SearchSiteSearchProviders from '../../domain/search/utils/site-search-providers';
import type { SiteSearchIconCache } from '../../shared/search/site-search-icon-cache';
import * as ShortcutIconCache from '../../domain/favicon/shortcut-favicon/persisted';

interface SiteSearchProvidersDeps {
  AGGREGATE_SEARCH_STORE: Pick<typeof AggregateSearchStore, 'isAggregateSearchProvider' | 'createScopeProvider'>;
  getPageFaviconUrlResolver(): Pick<FaviconUrlResolver, 'getProviderFaviconUrl'> | null;
  siteSearchIconCache: Pick<SiteSearchIconCache, 'icons'>;
  getExtensionResourceUrl(resourcePath: string): string;
}

function createSiteSearchProviders(deps: SiteSearchProvidersDeps) {
  const {
    AGGREGATE_SEARCH_STORE,
    getPageFaviconUrlResolver,
    siteSearchIconCache,
    getExtensionResourceUrl
  } = deps;










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
    getProviderFaviconPageUrl,
    getProviderIcon,
    createAggregateSearchScopeProvider,
    getProviderHost,
  };
}

type SiteSearchProviders = ReturnType<typeof createSiteSearchProviders>;

export { createSiteSearchProviders };
export type { SiteSearchProviders, SiteSearchProvidersDeps };
