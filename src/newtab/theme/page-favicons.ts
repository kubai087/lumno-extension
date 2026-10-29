// Favicons on the page: the persisted favicon, data and site theme caches,
// the favicon view runtime that renders icons with their fallbacks, and the
// favicon sources suggestions and themes resolve from.
import type { ThemeVariant } from '../../shared/favicon/favicon-theme';
import * as NEWTAB_FAVICON_VIEW from '../dom/favicon-view';
import type { SiteThemeResolver } from './site-theme-resolver';
import * as FaviconThemeColor from '../../domain/favicon/theme-color';
import type { ThemeRgb } from '../../domain/favicon/types';
import type { FaviconParts } from './favicon-parts';
import type { UrlPolicy } from '../url-policy';
import type { PageFaviconCache } from './page-favicon-cache';


interface PageFaviconsDeps {
  getThemeSource: SiteThemeResolver['getThemeSource'];
  getExtensionFaviconUrl(pageUrl: string): string;
  getGstaticFaviconUrl(pageUrl: string): string;
  getChromeFaviconUrl(pageUrl: string): string;
  isOwnExtensionUrl(url: string): boolean;
  shouldBlockFaviconForHost(hostname: string): boolean;
  shouldAvoidDirectFaviconForHost(hostname: string): boolean;
  isNewtabEnhancedFaviconFetchEnabled(pageUrl: string): boolean;
  // Why icon services are off for a page: 'global-off', 'exclusion', or ''.
  getNewtabStrictFaviconReason(pageUrl: string): string;
  getHostFromUrl(url: string): string;
  isFaviconProxyUrl(url: string): boolean;
  themeHostCache: Map<string, ThemeVariant>;
  themeColorCache: Map<string, ThemeVariant>;
  normalizeHost(hostname: string): string;
  getThemeSourcePriority: SiteThemeResolver['getThemeSourcePriority'];
  extractAverageColor(image: HTMLImageElement): ThemeRgb | null;
  buildThemeFromAccent: SiteThemeResolver['buildThemeFromAccent'];
  setResolvedThemeForHost: SiteThemeResolver['setResolvedThemeForHost'];
  faviconParts: Pick<FaviconParts, 'dataCache' | 'mount'>;
  logFaviconDecision: UrlPolicy['logFaviconDecision'];
  setPersistedFaviconUrl: PageFaviconCache['setPersistedFaviconUrl'];
  getPersistedFaviconEntry: PageFaviconCache['getPersistedFaviconEntry'];
  setPersistedFaviconData: PageFaviconCache['setPersistedFaviconData'];
  isBlockedLocalFaviconUrl: PageFaviconCache['isBlockedLocalFaviconUrl'];
}

function createPageFavicons(deps: PageFaviconsDeps) {
  const {
    getThemeSource,
    getExtensionFaviconUrl,
    getGstaticFaviconUrl,
    getChromeFaviconUrl,
    isOwnExtensionUrl,
    shouldBlockFaviconForHost,
    shouldAvoidDirectFaviconForHost,
    isNewtabEnhancedFaviconFetchEnabled,
    getNewtabStrictFaviconReason,
    getHostFromUrl,
    isFaviconProxyUrl,
    themeHostCache,
    themeColorCache,
    normalizeHost,
    getThemeSourcePriority,
    extractAverageColor,
    buildThemeFromAccent,
    setResolvedThemeForHost,
    faviconParts,
    logFaviconDecision,
    setPersistedFaviconUrl,
    getPersistedFaviconEntry,
    setPersistedFaviconData,
    isBlockedLocalFaviconUrl
  } = deps;



  const faviconDataPending = new Map<string, Promise<string | null>>();
  const faviconViewRuntime = NEWTAB_FAVICON_VIEW.createFaviconViewRuntime({
    document,
    windowObj: window,
    chromeApi: chrome,
    getExtensionFaviconUrl,
    getGstaticFaviconUrl,
    getChromeFaviconUrl,
    isOwnExtensionUrl,
    isBlockedLocalFaviconUrl,
    shouldBlockFaviconForHost,
    shouldAvoidDirectFaviconForHost,
    isEnhancedFaviconFetchEnabled: isNewtabEnhancedFaviconFetchEnabled,
    getStrictFaviconReason: getNewtabStrictFaviconReason,
    logFaviconDecision,
    getHostFromUrl,
    getPersistedFaviconEntry,
    setPersistedFaviconUrl,
    setPersistedFaviconData,
    preloadThemeFromFavicon,
    faviconDataCache: faviconParts.dataCache,
    faviconDataPending,
    hasThemeForHost: (hostKey) => Boolean(hostKey && themeHostCache.has(hostKey))
  });
  faviconParts.mount(faviconViewRuntime);
  const applyFaviconOpticalShift = faviconViewRuntime.applyFaviconOpticalShift;
  const applyFaviconOpticalAlignment = faviconViewRuntime.applyFaviconOpticalAlignment;
  const applyFallbackIcon = faviconViewRuntime.applyFallbackIcon;
  const setFaviconSrcWithAnimation = faviconViewRuntime.setFaviconSrcWithAnimation;
  const attachFaviconData = faviconViewRuntime.attachFaviconData;
  const preloadIcon = faviconViewRuntime.preloadIcon;
  const warmIconCache = faviconViewRuntime.warmIconCache;
  const attachFaviconWithFallbacks = faviconViewRuntime.attachFaviconWithFallbacks;

  function preloadThemeFromFavicon(url: string, dataUrl: string, hostOverride?: string): void {
    const cachedTheme = themeColorCache.get(url);
    if (!url || (cachedTheme && !cachedTheme._xIsDefault)) {
      return;
    }
    const hostKey = normalizeHost(hostOverride || getHostFromUrl(url));
    const useHostCache = hostKey && (Boolean(hostOverride) || !isFaviconProxyUrl(url));
    const cachedHostTheme = useHostCache ? themeHostCache.get(hostKey) : undefined;
    if (
      cachedHostTheme &&
      getThemeSourcePriority(getThemeSource(cachedHostTheme), cachedHostTheme) > getThemeSourcePriority('favicon')
    ) {
      return;
    }
    if (!dataUrl) {
      return;
    }
    const image = new Image();
    image.onload = function() {
      const avg = extractAverageColor(image);
      // Generic globes would otherwise become the whole host's theme.
      if (!avg || FaviconThemeColor.isPlaceholderFaviconColor(avg)) {
        return;
      }
      const theme = buildThemeFromAccent(avg, 'favicon');
      themeColorCache.set(url, theme);
      if (useHostCache) {
        setResolvedThemeForHost(hostKey, theme, { iconUrl: url });
      }
    };
    image.onerror = function() {};
    image.src = dataUrl;
  }


  return {
    applyFaviconOpticalShift,
    applyFaviconOpticalAlignment,
    applyFallbackIcon,
    setFaviconSrcWithAnimation,
    attachFaviconData,
    preloadIcon,
    warmIconCache,
    attachFaviconWithFallbacks
  };
}

type PageFavicons = ReturnType<typeof createPageFavicons>;

export { createPageFavicons };
export type { PageFavicons, PageFaviconsDeps };
