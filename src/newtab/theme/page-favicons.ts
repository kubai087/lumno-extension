// Favicons on the page: the persisted favicon, data and site theme caches,
// the favicon view runtime that renders icons with their fallbacks, and the
// favicon sources suggestions and themes resolve from.
import type { FaviconDataEntry, FaviconUrlEntry, SiteThemeEntry } from '../../domain/favicon/favicon-cache';
import * as NEWTAB_FAVICON_CACHE from '../../platform/favicon-cache';
import type * as Color from '../../domain/color';
import type { ThemeVariant } from '../../shared/favicon/favicon-theme';
import type { SiteSearchProviders } from '../search/site-search-providers';
import type { ShortcutsController } from '../shortcuts/shortcuts-controller';
import * as NEWTAB_FAVICON_VIEW from './favicon-view';
import type { SiteThemeResolver } from './site-theme-resolver';
import type { ThemeSubject } from './theme-types';
import * as FaviconDecisionLog from '../../domain/favicon/decision-log';
import * as FaviconHostPolicy from '../../domain/favicon/host-policy';
import * as FaviconResolver from '../../domain/favicon/resolver';
import type { FaviconUrlResolver } from '../../domain/favicon/resolver';
import * as FaviconThemeColor from '../../domain/favicon/theme-color';
import type { ThemeRgb } from '../../domain/favicon/types';
import * as FaviconUrlKinds from '../../domain/favicon/url-kinds';
import { FAVICON_CACHE_BOOT_WAIT_MS } from '../newtab-config';
import type { FaviconParts } from './favicon-parts';


interface PageFaviconsDeps {
  normalizeFaviconHost(hostname: unknown): string;
  isPersistableTheme: SiteThemeResolver['isPersistableTheme'];
  normalizeAccentRgb: SiteThemeResolver['normalizeAccentRgb'];
  parseCssColor: typeof Color.parseCssColor;
  getThemeSource: SiteThemeResolver['getThemeSource'];
  isLowConfidenceTheme: SiteThemeResolver['isLowConfidenceTheme'];
  normalizeThemeConfidence: SiteThemeResolver['normalizeThemeConfidence'];
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
  isUrlBlockedByFaviconRequestBlacklist(url: string): boolean;
  themeColorCache: Map<string, ThemeVariant>;
  normalizeHost(hostname: string): string;
  getThemeSourcePriority: SiteThemeResolver['getThemeSourcePriority'];
  extractAverageColor(image: HTMLImageElement): ThemeRgb | null;
  buildThemeFromAccent: SiteThemeResolver['buildThemeFromAccent'];
  setResolvedThemeForHost: SiteThemeResolver['setResolvedThemeForHost'];
  getShortcutFaviconCandidateUrl: ShortcutsController['getShortcutFaviconCandidateUrl'];
  getShortcutFaviconDataUrl: ShortcutsController['getShortcutFaviconDataUrl'];
  getProviderIcon: SiteSearchProviders['getProviderIcon'];
  getProviderFaviconPageUrl: SiteSearchProviders['getProviderFaviconPageUrl'];
  faviconParts: Pick<FaviconParts, 'dataCache' | 'mount'>;
}

function createPageFavicons(deps: PageFaviconsDeps) {
  const {
    normalizeFaviconHost,
    isPersistableTheme,
    normalizeAccentRgb,
    parseCssColor,
    getThemeSource,
    isLowConfidenceTheme,
    normalizeThemeConfidence,
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
    isUrlBlockedByFaviconRequestBlacklist,
    themeColorCache,
    normalizeHost,
    getThemeSourcePriority,
    extractAverageColor,
    buildThemeFromAccent,
    setResolvedThemeForHost,
    getShortcutFaviconCandidateUrl,
    getShortcutFaviconDataUrl,
    getProviderIcon,
    getProviderFaviconPageUrl,
    faviconParts
  } = deps;



  const faviconDataPending = new Map<string, Promise<string | null>>();
  const faviconCacheRuntime = NEWTAB_FAVICON_CACHE.createFaviconCache({
    storageArea: (chrome && chrome.storage && chrome.storage.local) ? chrome.storage.local : null,
    windowObj: window,
    normalizeFaviconHost,
    isBlockedLocalFaviconUrl,
    isChromeMonogramFaviconUrl,
    faviconCacheBootWaitMs: FAVICON_CACHE_BOOT_WAIT_MS
  });

  function isFaviconPersistLoaded(): boolean {
    return faviconCacheRuntime.isFaviconPersistLoaded();
  }

  function isFaviconDataPersistLoaded(): boolean {
    return faviconCacheRuntime.isFaviconDataPersistLoaded();
  }

  function isSiteThemePersistLoaded(): boolean {
    return faviconCacheRuntime.isSiteThemePersistLoaded();
  }

  function waitForFaviconCachesOrTimeout(maxWaitMs?: number): Promise<void> {
    return faviconCacheRuntime.waitForCachesOrTimeout(maxWaitMs);
  }

  function areFaviconRenderCachesReady(): boolean {
    return isFaviconPersistLoaded() && isFaviconDataPersistLoaded() && isSiteThemePersistLoaded();
  }

  function waitForFaviconRenderCaches(maxWaitMs?: number): Promise<void> {
    if (areFaviconRenderCachesReady()) {
      return Promise.resolve();
    }
    return waitForFaviconCachesOrTimeout(maxWaitMs);
  }

  function isHostFaviconVisitDirty(hostname: string): boolean {
    return faviconCacheRuntime.isHostVisitDirty(hostname);
  }

  function setPersistedFaviconUrl(cacheKey: string, url: string): void {
    faviconCacheRuntime.setPersistedUrl(cacheKey, url);
  }

  function getPersistedFaviconEntry(cacheKey: string): FaviconUrlEntry | null {
    return faviconCacheRuntime.getPersistedEntry(cacheKey);
  }

  function getPersistedFaviconDataEntry(cacheKey: string): FaviconDataEntry | null {
    return faviconCacheRuntime.getPersistedDataEntry(cacheKey);
  }

  function setPersistedFaviconData(cacheKey: string, dataUrl: string): void {
    faviconCacheRuntime.setPersistedData(cacheKey, dataUrl);
  }

  function getPersistedSiteThemeEntry(hostKey: string): SiteThemeEntry | null {
    return faviconCacheRuntime.getPersistedThemeEntry(hostKey);
  }

  // Stores a theme strong enough to keep; false when it is not one.
  function setPersistedSiteThemeEntry(hostKey: string, theme: ThemeVariant | null | undefined): boolean {
    if (!theme || !isPersistableTheme(theme)) {
      return false;
    }
    const accentRgb = normalizeAccentRgb(theme.accentRgb || parseCssColor(theme.accent));
    if (!accentRgb) {
      return false;
    }
    return faviconCacheRuntime.setPersistedThemeEntry(hostKey, {
      accentRgb,
      source: getThemeSource(theme),
      neutral: isLowConfidenceTheme(theme) || theme._xThemeNeutral === true,
      confidence: normalizeThemeConfidence(theme._xThemeConfidence, accentRgb)
    });
  }

  const logNewtabFaviconDecision = FaviconDecisionLog.createFaviconDecisionLogger({ surface: 'newtab' });
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
    logFaviconDecision: logNewtabFaviconDecision,
    getHostFromUrl,
    getPersistedFaviconEntry,
    getPersistedFaviconDataEntry,
    setPersistedFaviconUrl,
    setPersistedFaviconData,
    preloadThemeFromFavicon,
    faviconDataCache: faviconParts.dataCache,
    faviconDataPending,
    hasThemeForHost: (hostKey) => Boolean(hostKey && themeHostCache.has(hostKey))
  });
  faviconParts.mount({ cache: faviconCacheRuntime, view: faviconViewRuntime });
  const applyFaviconOpticalShift = faviconViewRuntime.applyFaviconOpticalShift;
  const applyFaviconOpticalAlignment = faviconViewRuntime.applyFaviconOpticalAlignment;
  const applyFallbackIcon = faviconViewRuntime.applyFallbackIcon;
  const setFaviconSrcWithAnimation = faviconViewRuntime.setFaviconSrcWithAnimation;
  const attachFaviconData = faviconViewRuntime.attachFaviconData;
  const preloadIcon = faviconViewRuntime.preloadIcon;
  const warmIconCache = faviconViewRuntime.warmIconCache;
  const attachFaviconWithFallbacks = faviconViewRuntime.attachFaviconWithFallbacks;

  function isAllowedFaviconProxyRequestUrl(url: string): boolean {
    return FaviconHostPolicy.isAllowedFaviconProxyRequestUrl(url);
  }

  function isBlockedLocalFaviconUrl(url: string): boolean {
    const blockedByLocalRules = FaviconHostPolicy.isBlockedLocalFaviconUrl(url);
    return blockedByLocalRules ||
      (!isAllowedFaviconProxyRequestUrl(url) && isUrlBlockedByFaviconRequestBlacklist(url));
  }

  function isChromeMonogramFaviconUrl(url: string): boolean {
    return FaviconUrlKinds.isChromeMonogramFaviconUrl(url);
  }

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

  const FAVICON_PROXY_SIZE = 128;
  let pageFaviconUrlResolver: FaviconUrlResolver | null = null;

  function getPageFaviconUrlResolver(): FaviconUrlResolver {
    if (!pageFaviconUrlResolver) {
      pageFaviconUrlResolver = FaviconResolver.createFaviconUrlResolver({
        chromeApi: chrome,
        size: FAVICON_PROXY_SIZE,
        shouldBlockFaviconForHost,
        shouldAvoidDirectFaviconForHost,
        isEnhancedFaviconFetchEnabled: isNewtabEnhancedFaviconFetchEnabled,
        getStrictFaviconReason: getNewtabStrictFaviconReason,
        logFaviconDecision: logNewtabFaviconDecision
      });
    }
    return pageFaviconUrlResolver;
  }

  function getThemeSourceForSuggestion(suggestion: ThemeSubject | null | undefined): string {
    if (suggestion && suggestion.type === 'shortcut') {
      const url = suggestion.url || '';
      return getShortcutFaviconCandidateUrl(url) || getShortcutFaviconDataUrl(url);
    }
    const resolver = getPageFaviconUrlResolver();
    if (suggestion && suggestion.provider) {
      return resolver.resolveFaviconSource(
        getProviderIcon(suggestion.provider), getProviderFaviconPageUrl(suggestion.provider)
      );
    }
    return resolver.resolveFaviconSource(suggestion && suggestion.favicon, suggestion && suggestion.url);
  }

  return {
    faviconCacheRuntime,
    areFaviconRenderCachesReady,
    waitForFaviconRenderCaches,
    isHostFaviconVisitDirty,
    getPersistedFaviconDataEntry,
    getPersistedSiteThemeEntry,
    setPersistedSiteThemeEntry,
    applyFaviconOpticalShift,
    applyFaviconOpticalAlignment,
    applyFallbackIcon,
    setFaviconSrcWithAnimation,
    attachFaviconData,
    preloadIcon,
    warmIconCache,
    attachFaviconWithFallbacks,
    getPageFaviconUrlResolver,
    getThemeSourceForSuggestion
  };
}

type PageFavicons = ReturnType<typeof createPageFavicons>;

export { createPageFavicons };
export type { PageFavicons, PageFaviconsDeps };
