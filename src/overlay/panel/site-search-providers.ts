// Site search providers and aggregate searches in the overlay: their
// URLs and icons, running an interactive provider and recording a
// selection. The lists themselves are the catalog's.
import * as BundledIcons from '../../domain/favicon/shortcut-favicon/bundled-icons';
import type { Disposition } from '../../domain/navigation-disposition';
import * as AGGREGATE_SEARCH_SURFACE from '../../domain/search/aggregate-search-surface';
import type { DisplayedSuggestion } from '../../domain/search/suggestion-action-model';
import type { SiteSearchProvider } from '../../domain/search/types';
import type { InputModeProvider } from '../../shared/search/input-mode/types';
import * as LumnoMessaging from '../../platform/messaging';
import type { ActivationEvent } from './result-activation';
import type { Translate } from './types';
import type { FaviconUrlResolver } from '../../domain/favicon/resolver';
import * as FaviconUrlKinds from '../../domain/favicon/url-kinds';
import * as SearchSiteSearchProviders from '../../domain/search/utils/site-search-providers';
import type { SiteSearchIconCache } from '../../shared/search/site-search-icon-cache';
import * as ShortcutIconCache from '../../domain/favicon/shortcut-favicon/persisted';
import type { OverlayFaviconRuntime } from '../favicon-view';
import { isInteractiveSiteSearchProvider } from '../../domain/search/utils/site-search-providers';
import { isAggregateSearchProvider } from '../../domain/search/aggregate-search-store';

interface SiteSearchProvidersDeps {
  favicons: Pick<OverlayFaviconRuntime, 'requestFaviconData'>;
  getHelpCenterLocale(): string;
  showOverlayToast(message: string, isError?: boolean): void;
  t: Translate;
  getSearchResultDisposition(event: ActivationEvent | null): Disposition;
  getSearchResultNewTabDisposition(event: ActivationEvent | null): 'backgroundTab' | 'newTab';
  finishOverlayResultActivation(event: ActivationEvent | null, canOpenInBackground: boolean): boolean;
  getOverlayFaviconUrlResolver(): FaviconUrlResolver | null;
  siteSearchIconCache: Pick<SiteSearchIconCache, 'icons'>;
  // Favicon images already fetched, as data: URLs by address.
  faviconDataCache: Map<string, string>;
}

function createSiteSearchProviders(deps: SiteSearchProvidersDeps) {
  const {
    favicons,
    getHelpCenterLocale,
    showOverlayToast,
    t,
    getSearchResultDisposition,
    getSearchResultNewTabDisposition,
    finishOverlayResultActivation,
    getOverlayFaviconUrlResolver,
    siteSearchIconCache,
    faviconDataCache
  } = deps;


  let aggregateSearchRequestController: ReturnType<typeof AGGREGATE_SEARCH_SURFACE.createAggregateSearchRequestController> | null = null;

  function buildSearchUrl(template: string, query: string, provider?: SiteSearchProvider | null): string {
    if (!template) {
      return '';
    }
    const url = template.replace(/\{query\}/g, encodeURIComponent(query));
    return provider ? SearchSiteSearchProviders.withHelpCenterLocale(url, provider, getHelpCenterLocale()) : url;
  }





  function getAggregateSearchRequestController(): ReturnType<typeof AGGREGATE_SEARCH_SURFACE.createAggregateSearchRequestController> {
    if (aggregateSearchRequestController) {
      return aggregateSearchRequestController;
    }
    const controller = AGGREGATE_SEARCH_SURFACE.createAggregateSearchRequestController({
      chromeApi: chrome,
      onFeedback(descriptor) {
        showOverlayToast(t(descriptor.messageKey, descriptor.fallback), descriptor.isError);
      }
    });
    aggregateSearchRequestController = controller;
    return controller;
  }

  // Runs a site search, an interactive provider or an aggregate search;
  // true when a tab opened at once, so the panel may close.
  function openSiteSearchProviderQuery(provider: InputModeProvider | null, query: string, event: ActivationEvent | null): boolean {
    const trimmedQuery = String(query || '').trim();
    if (!provider || !trimmedQuery) {
      return false;
    }
    if (isAggregateSearchProvider(provider) && provider.aggregateId) {
      const disposition = getSearchResultNewTabDisposition(event);
      const controller = getAggregateSearchRequestController();
      if (!controller) {
        showOverlayToast(t('toast_error', 'Operation failed. Please try again.'), true);
        return false;
      }
      controller.run({
        aggregateId: String(provider.aggregateId),
        disposition,
        query: trimmedQuery
      }, {
        onSuccess(response) {
          const feedbackDelayMs = AGGREGATE_SEARCH_SURFACE.getSuccessFeedbackDelayMs(response);
          if (feedbackDelayMs > 0) {
            window.setTimeout(() => {
              finishOverlayResultActivation(event, true);
            }, feedbackDelayMs);
            return;
          }
          finishOverlayResultActivation(event, true);
        }
      });
      return false;
    }
    if (isInteractiveSiteSearchProvider(provider)) {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
        action: 'runSiteSearchProviderQuery',
        provider: provider,
        query: trimmedQuery,
        disposition: getSearchResultDisposition(event)
      });
      return true;
    }
    const siteUrl = buildSearchUrl(provider.template || '', trimmedQuery, provider);
    if (!siteUrl) {
      return false;
    }
    LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
      action: 'createTab',
      url: siteUrl,
      disposition: getSearchResultDisposition(event)
    });
    return true;
  }

  // Teaches the ranking which result was picked for the query.
  function recordSearchSuggestionSelectionFromSuggestion(suggestion: DisplayedSuggestion, query: string, source: string): void {
    if (!suggestion || suggestion.forceSearch || suggestion.provider || !suggestion.url) {
      return;
    }
    try {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
        action: 'recordSearchSuggestionSelection',
        query: String(query || '').trim(),
        url: suggestion.url,
        title: suggestion.title || '',
        type: suggestion.type || 'history',
        source: source || 'overlay'
      });
    } catch (_error) {
      // Selection ranking is best-effort; never block opening the target.
    }
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
    buildSearchUrl,
    openSiteSearchProviderQuery,
    recordSearchSuggestionSelectionFromSuggestion,
    getProviderIcon,
    toPageRenderableIconUrl,
    getPageRenderableProviderIcon
  };
}

export { createSiteSearchProviders };
export type { SiteSearchProvidersDeps };
