// Site search providers and aggregate searches in the overlay: their
// URLs and icons, running an interactive provider and recording a
// selection. The lists themselves are the catalog's.
import * as BundledIcons from '../../domain/favicon/shortcut-favicon/bundled-icons';
import * as AGGREGATE_SEARCH_SURFACE from '../../domain/search/aggregate-search-surface';
import type { SiteSearchProvider } from '../../domain/search/types';
import type { InputModeProvider } from '../../shared/search/input-mode/types';
import type { ActivationEvent } from './result-activation';
import type { FaviconUrlResolver } from '../../domain/favicon/resolver';
import * as FaviconUrlKinds from '../../domain/favicon/url-kinds';
import type { SiteSearchIconCache } from '../../shared/search/site-search-icon-cache';
import * as ShortcutIconCache from '../../domain/favicon/shortcut-favicon/persisted';
import type { OverlayFaviconRuntime } from '../dom/favicon-view';
import { isAggregateSearchProvider } from '../../domain/search/aggregate-search-store';
import type { SiteSearchRunner } from '../../shared/search-panel/site-search/runner';
import type { ResultActivation } from '../../shared/search-panel/result-activation';

interface SiteSearchProvidersDeps {
  siteSearchRunner: SiteSearchRunner;
  favicons: Pick<OverlayFaviconRuntime, 'requestFaviconData'>;
  resultActivation: ResultActivation;
  finishOverlayResultActivation(event: ActivationEvent | null, canOpenInBackground: boolean): boolean;
  getOverlayFaviconUrlResolver(): FaviconUrlResolver | null;
  siteSearchIconCache: Pick<SiteSearchIconCache, 'icons'>;
  // Favicon images already fetched, as data: URLs by address.
  faviconDataCache: Map<string, string>;
}

function createSiteSearchProviders(deps: SiteSearchProvidersDeps) {
  const {
    siteSearchRunner,
    favicons,
    resultActivation,
    finishOverlayResultActivation,
    getOverlayFaviconUrlResolver,
    siteSearchIconCache,
    faviconDataCache
  } = deps;

  // Runs a site search, an interactive provider or an aggregate search;
  // true when a tab opened at once, so the panel may close.
  // Runs the query in the tab or tabs the activation asks for; an
  // aggregate search finishes the activation once its sources opened.
  function openSiteSearchProviderQuery(provider: InputModeProvider | null, query: string, event: ActivationEvent | null): boolean {
    if (!isAggregateSearchProvider(provider)) {
      return siteSearchRunner.run(provider, query, resultActivation.getDisposition(event));
    }
    return siteSearchRunner.run(provider, query, resultActivation.getNewTabDisposition(event), {
      onSuccess(response) {
        const feedbackDelayMs = AGGREGATE_SEARCH_SURFACE.getSuccessFeedbackDelayMs(response);
        if (feedbackDelayMs > 0) {
          window.setTimeout(() => finishOverlayResultActivation(event, true), feedbackDelayMs);
          return;
        }
        finishOverlayResultActivation(event, true);
      }
    });
  }

  function getProviderIcon(provider: Partial<SiteSearchProvider>): string {
    const resolver = getOverlayFaviconUrlResolver();
    if (!resolver) {
      return '';
    }
    const iconUrl = BundledIcons.getSiteSearchProviderIcon(
      siteSearchIconCache.icons, provider, Date.now(), {
        ...ShortcutIconCache.SITE_SEARCH_CACHE_OPTIONS,
        resolveAssetUrl: (path: string) => chrome.runtime.getURL(path)
      }
    );
    return resolver.getProviderFaviconUrl(BundledIcons.getSiteSearchProviderPageUrl(provider), iconUrl);
  }

  // Input-mode icons load straight into an <img> in the page, which cannot
  // load the browser's _favicon cache; those arrive as data: URLs from the
  // background, and the provider keeps its glyph until one is cached.
  function toPageRenderableIconUrl(iconUrl: string, pageUrl: string): string {
    if (!FaviconUrlKinds.isExtensionFaviconEndpointUrl(iconUrl)) {
      return iconUrl;
    }
    const cachedData = faviconDataCache.get(iconUrl);
    if (cachedData) {
      return cachedData;
    }
    favicons.requestFaviconData(iconUrl, pageUrl).catch(() => null);
    return '';
  }

  function getPageRenderableProviderIcon(provider: Partial<SiteSearchProvider> | null | undefined): string {
    if (!provider) {
      return '';
    }
    return toPageRenderableIconUrl(getProviderIcon(provider), BundledIcons.getSiteSearchProviderPageUrl(provider));
  }

  return {
    openSiteSearchProviderQuery,
    getProviderIcon,
    toPageRenderableIconUrl,
    getPageRenderableProviderIcon
  };
}

export { createSiteSearchProviders };
export type { SiteSearchProvidersDeps };
