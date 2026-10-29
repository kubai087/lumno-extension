// The page's persisted favicon URL, icon data and site theme caches, read
// from storage once and kept in sync with other pages, and whether they are
// ready to draw from.
import type { FaviconDataEntry, FaviconUrlEntry, SiteThemeEntry } from '../../domain/favicon/favicon-cache';
import * as NEWTAB_FAVICON_CACHE from '../../platform/favicon-cache';
import * as FaviconHostPolicy from '../../domain/favicon/host-policy';
import * as FaviconUrlKinds from '../../domain/favicon/url-kinds';
import { FAVICON_CACHE_BOOT_WAIT_MS } from '../newtab-config';
import type { UrlPolicy } from '../url-policy';

interface PageFaviconCacheDeps {
  isUrlBlockedByFaviconRequestBlacklist: UrlPolicy['isUrlBlockedByFaviconRequestBlacklist'];
}

function createPageFaviconCache(deps: PageFaviconCacheDeps) {
  const { isUrlBlockedByFaviconRequestBlacklist } = deps;

  // A local or excluded icon is never fetched or kept.
  function isBlockedLocalFaviconUrl(url: string): boolean {
    const blockedByLocalRules = FaviconHostPolicy.isBlockedLocalFaviconUrl(url);
    return blockedByLocalRules ||
      (!FaviconHostPolicy.isAllowedFaviconProxyRequestUrl(url) && isUrlBlockedByFaviconRequestBlacklist(url));
  }

  const faviconCacheRuntime = NEWTAB_FAVICON_CACHE.createFaviconCache({
    storageArea: (chrome && chrome.storage && chrome.storage.local) ? chrome.storage.local : null,
    windowObj: window,
    normalizeFaviconHost: FaviconUrlKinds.normalizeFaviconHost,
    isBlockedLocalFaviconUrl,
    isChromeMonogramFaviconUrl: FaviconUrlKinds.isChromeMonogramFaviconUrl,
    faviconCacheBootWaitMs: FAVICON_CACHE_BOOT_WAIT_MS
  });

  function areFaviconRenderCachesReady(): boolean {
    return faviconCacheRuntime.isFaviconPersistLoaded() &&
      faviconCacheRuntime.isFaviconDataPersistLoaded() &&
      faviconCacheRuntime.isSiteThemePersistLoaded();
  }

  function waitForFaviconRenderCaches(maxWaitMs?: number): Promise<void> {
    if (areFaviconRenderCachesReady()) {
      return Promise.resolve();
    }
    return faviconCacheRuntime.waitForCachesOrTimeout(maxWaitMs);
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

  return {
    faviconCacheRuntime,
    isBlockedLocalFaviconUrl,
    areFaviconRenderCachesReady,
    waitForFaviconRenderCaches,
    isHostFaviconVisitDirty,
    setPersistedFaviconUrl,
    getPersistedFaviconEntry,
    getPersistedFaviconDataEntry,
    setPersistedFaviconData,
    getPersistedSiteThemeEntry
  };
}

type PageFaviconCache = ReturnType<typeof createPageFaviconCache>;

export { createPageFaviconCache };
export type { PageFaviconCache, PageFaviconCacheDeps };
