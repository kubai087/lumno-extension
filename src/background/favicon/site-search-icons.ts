// High-resolution icons for site-search providers: their cache and warmup.
import * as LumnoShortcutFaviconStore from '../../platform/shortcut-favicon-store';
import * as SHORTCUT_ICON_MAP from '../../domain/shortcut-icon-map';
import { readSiteSearchProviders } from '../../domain/search/site-search-provider-reader';
import { providerStorageRuntime, warnBackgroundFailure, workerSettings } from '../worker-context';
import type { ShortcutFaviconStore } from '../../platform/shortcut-favicon-store';
import type { SiteSearchProvider } from '../../domain/search/types';
import { NEWTAB_SHORTCUT_LIST_SETTINGS, newtabShortcutFaviconCache, newtabShortcutIcons, newtabShortcutsLocalOverflow } from '../../domain/settings/newtab-shortcuts';
import * as SearchSettings from '../../domain/settings/search';

import { fetchShortcutFaviconData } from './shortcut-icons';
import type { ShortcutIconResult, SiteSearchIconWarmItem, SiteSearchShortcutIconSources } from './types';
import * as BundledIcons from '../../domain/favicon/shortcut-favicon/bundled-icons';
import * as ShortcutIconCache from '../../domain/favicon/shortcut-favicon/persisted';
import * as ShortcutIcons from '../../domain/favicon/shortcut-favicon/shortcut-icons';
import type { CachedIconMap } from '../../domain/favicon/shortcut-favicon/types';
import * as ShortcutStoragePlan from '../../domain/shortcuts/storage-plan';

const SITE_SEARCH_ICON_STORAGE_KEY = SearchSettings.siteSearchIconCache.key;
const SITE_SEARCH_ICON_CACHE_OPTIONS = ShortcutIconCache.SITE_SEARCH_CACHE_OPTIONS;
const SITE_SEARCH_PINNED_ICON_KEYS = new Set(Object.keys(BundledIcons.SITE_SEARCH_PINNED_ICON_ASSETS));

const SITE_SEARCH_ICON_WARM_CONCURRENCY = 2;


let siteSearchIconStore: Readonly<ShortcutFaviconStore> | null = null;

let siteSearchIconCache: CachedIconMap | null = null;

let siteSearchIconCacheLoadPromise: Promise<CachedIconMap> | null = null;

let siteSearchIconCacheWriteTimer: ReturnType<typeof setTimeout> | null = null;

let siteSearchIconCacheRevision = 0;

let siteSearchIconWarmActiveCount = 0;

const siteSearchIconWarmQueue: SiteSearchIconWarmItem[] = [];

const siteSearchIconWarmPending = new Set<string>();

// The shortcut data site-search icons follow; see loadSiteSearchShortcutIconSources.


function getSiteSearchIconStore(): Readonly<ShortcutFaviconStore> {
  if (siteSearchIconStore) {
    return siteSearchIconStore;
  }
  siteSearchIconStore = LumnoShortcutFaviconStore.createSiteSearchIconStore({
    chromeApi: chrome,
    storageArea: (chrome && chrome.storage && chrome.storage.local) ? chrome.storage.local : null
  });
  return siteSearchIconStore;
}

function loadSiteSearchIconCache(): Promise<CachedIconMap> {
  if (siteSearchIconCache) {
    return Promise.resolve(siteSearchIconCache);
  }
  if (siteSearchIconCacheLoadPromise) {
    return siteSearchIconCacheLoadPromise;
  }
  const store = getSiteSearchIconStore();
  if (!store || typeof store.readAll !== 'function') {
    const empty: CachedIconMap = {};
    siteSearchIconCache = empty;
    return Promise.resolve(empty);
  }
  siteSearchIconCacheLoadPromise = store.readAll()
    .then((cache) => {
      const loaded: CachedIconMap = cache && typeof cache === 'object' ? cache : {};
      siteSearchIconCache = loaded;
      return loaded;
    })
    .catch(() => {
      const empty: CachedIconMap = {};
      siteSearchIconCache = empty;
      return empty;
    });
  return siteSearchIconCacheLoadPromise;
}

function hasUsableCachedSiteSearchProviderIcon(provider: SiteSearchProvider): boolean {
  const icon = BundledIcons.getSiteSearchProviderIcon(
    siteSearchIconCache || {},
    provider,
    Date.now(),
    SITE_SEARCH_ICON_CACHE_OPTIONS
  );
  return String(icon || '').startsWith('data:');
}

function scheduleSiteSearchIconCacheWrite(): void {
  if (siteSearchIconCacheWriteTimer !== null) {
    return;
  }
  siteSearchIconCacheWriteTimer = setTimeout(() => {
    siteSearchIconCacheWriteTimer = null;
    const store = getSiteSearchIconStore();
    if (!store || typeof store.writeAll !== 'function' || !siteSearchIconCache) {
      return;
    }
    const writeRevision = siteSearchIconCacheRevision;
    const writeSnapshot = siteSearchIconCache;
    store.writeAll(writeSnapshot).then((savedCache) => {
      if (siteSearchIconCacheRevision === writeRevision) {
        siteSearchIconCache = savedCache;
        return;
      }
      scheduleSiteSearchIconCacheWrite();
    }).catch(warnBackgroundFailure('Failed to save the site search icon cache.'));
  }, 700);
}

function pruneSiteSearchProviderIconCache(providers: readonly SiteSearchProvider[]): boolean {
  if (!siteSearchIconCache) {
    return false;
  }
  const pageUrls = providers.flatMap((provider) => {
    const providerKey = String(provider && provider.key || '').trim().toLowerCase();
    if (SITE_SEARCH_PINNED_ICON_KEYS.has(providerKey)) {
      return [];
    }
    const pageUrl = BundledIcons.getSiteSearchProviderPageUrl(provider);
    return pageUrl ? [pageUrl] : [];
  });
  const nextCache = ShortcutIconCache.retainCachedIcons(
    siteSearchIconCache,
    pageUrls,
    Date.now(),
    SITE_SEARCH_ICON_CACHE_OPTIONS
  );
  if (JSON.stringify(nextCache) === JSON.stringify(siteSearchIconCache)) {
    return false;
  }
  siteSearchIconCache = nextCache;
  siteSearchIconCacheRevision += 1;
  scheduleSiteSearchIconCacheWrite();
  return true;
}

function cacheSiteSearchProviderIcon(pageUrl: string, result: ShortcutIconResult | null): boolean {
  if (!result || !result.data) {
    return false;
  }
  const nextCache = ShortcutIconCache.setCachedIcon(
    siteSearchIconCache || {},
    pageUrl,
    result.data,
    result.sourceUrl,
    Date.now(),
    SITE_SEARCH_ICON_CACHE_OPTIONS
  );
  const cacheKey = ShortcutIconCache.getCacheKey(pageUrl);
  const nextEntry = cacheKey && nextCache ? nextCache[cacheKey] : null;
  if (!nextEntry || nextEntry.dataUrl !== result.data) {
    return false;
  }
  siteSearchIconCache = nextCache;
  siteSearchIconCacheRevision += 1;
  scheduleSiteSearchIconCacheWrite();
  return true;
}

function drainSiteSearchIconWarmQueue(): void {
  while (siteSearchIconWarmActiveCount < SITE_SEARCH_ICON_WARM_CONCURRENCY &&
      siteSearchIconWarmQueue.length > 0) {
    const item = siteSearchIconWarmQueue.shift();
    if (!item || !item.pageUrl) {
      continue;
    }
    if (hasUsableCachedSiteSearchProviderIcon(item.provider)) {
      siteSearchIconWarmPending.delete(item.pageUrl);
      continue;
    }
    siteSearchIconWarmActiveCount += 1;
    fetchShortcutFaviconData(item.pageUrl, item.preferredTheme, item.explicitIcon)
      .then((result) => {
        cacheSiteSearchProviderIcon(item.pageUrl, result);
      })
      .catch(() => {}) // Unreachable sites keep their bundled icon.
      .finally(() => {
        siteSearchIconWarmActiveCount = Math.max(0, siteSearchIconWarmActiveCount - 1);
        siteSearchIconWarmPending.delete(item.pageUrl);
        drainSiteSearchIconWarmQueue();
      });
  }
}


// What site search needs from the New Tab shortcuts: the list, uploaded
// icons, and the saved online-icon snapshots. Kept until one of them changes.
// Resolves null when they cannot be read whole, so a bad read keeps the
// icons already written instead of dropping them.
function loadSiteSearchShortcutIconSources(): Promise<SiteSearchShortcutIconSources | null> {
  return workerSettings.ready.then((): SiteSearchShortcutIconSources | null => {
    const values = Object.fromEntries(NEWTAB_SHORTCUT_LIST_SETTINGS.map((setting) => [setting.key, workerSettings.getStored(setting)]));
    const syncActive = providerStorageRuntime.getActiveAreaName() === 'sync';
    const state = ShortcutStoragePlan.readShortcutState(values, syncActive ? workerSettings.getStored(newtabShortcutsLocalOverflow) : undefined);
    if (state.torn) {
      return null;
    }
    return {
      shortcuts: state.items,
      shortcutIcons: SHORTCUT_ICON_MAP.normalizeIconMap(workerSettings.getStored(newtabShortcutIcons)),
      shortcutFavicons: ShortcutIconCache.normalizeCacheMap(workerSettings.getStored(newtabShortcutFaviconCache))
    };
  });
}

// What site search icons follow from the New Tab shortcuts.
const SITE_SEARCH_SHORTCUT_ICON_SETTINGS = Object.freeze([
  ...NEWTAB_SHORTCUT_LIST_SETTINGS,
  newtabShortcutsLocalOverflow,
  newtabShortcutIcons,
  newtabShortcutFaviconCache
]);

function applySiteSearchShortcutIcons(providers: readonly SiteSearchProvider[]): Promise<void> {
  return loadSiteSearchShortcutIconSources().then((sources) => {
    if (!sources || !siteSearchIconCache) {
      return;
    }
    const nextCache = ShortcutIcons.applySiteSearchShortcutIcons(
      siteSearchIconCache,
      ShortcutIcons.getSiteSearchShortcutIcons(
        providers,
        sources.shortcuts,
        sources.shortcutIcons,
        sources.shortcutFavicons
      ),
      Date.now(),
      SITE_SEARCH_ICON_CACHE_OPTIONS
    );
    if (nextCache) {
      siteSearchIconCache = nextCache;
      siteSearchIconCacheRevision += 1;
      scheduleSiteSearchIconCacheWrite();
    }
  });
}

function scheduleSiteSearchProviderIconWarmup(providers: unknown, preferredTheme?: unknown): void {
  const items = readSiteSearchProviders(providers);
  if (items.length === 0) {
    return;
  }
  loadSiteSearchIconCache().then(() => applySiteSearchShortcutIcons(items)).then(() => {
    pruneSiteSearchProviderIconCache(items);
    items.forEach((provider) => {
      const explicitIcon = BundledIcons.getSiteSearchProviderExplicitIcon(provider);
      const pageUrl = BundledIcons.getSiteSearchProviderPageUrl(provider);
      const providerKey = String(provider && provider.key || '').trim().toLowerCase();
      if (SITE_SEARCH_PINNED_ICON_KEYS.has(providerKey)) {
        return;
      }
      if (!pageUrl || hasUsableCachedSiteSearchProviderIcon(provider) || siteSearchIconWarmPending.has(pageUrl)) {
        return;
      }
      siteSearchIconWarmPending.add(pageUrl);
      siteSearchIconWarmQueue.push({
        provider,
        pageUrl,
        explicitIcon,
        preferredTheme: String(preferredTheme || '')
      });
    });
    drainSiteSearchIconWarmQueue();
  }).catch(warnBackgroundFailure('Failed to warm site search icons.'));
}

export {
  SITE_SEARCH_ICON_CACHE_OPTIONS,
  SITE_SEARCH_ICON_STORAGE_KEY,
  SITE_SEARCH_ICON_WARM_CONCURRENCY,
  SITE_SEARCH_PINNED_ICON_KEYS,
  SITE_SEARCH_SHORTCUT_ICON_SETTINGS,
  applySiteSearchShortcutIcons,
  cacheSiteSearchProviderIcon,
  drainSiteSearchIconWarmQueue,
  getSiteSearchIconStore,
  hasUsableCachedSiteSearchProviderIcon,
  loadSiteSearchIconCache,
  loadSiteSearchShortcutIconSources,
  pruneSiteSearchProviderIconCache,
  scheduleSiteSearchIconCacheWrite,
  scheduleSiteSearchProviderIconWarmup,
  siteSearchIconCache,
  siteSearchIconCacheLoadPromise,
  siteSearchIconCacheRevision,
  siteSearchIconCacheWriteTimer,
  siteSearchIconStore,
  siteSearchIconWarmActiveCount,
  siteSearchIconWarmPending,
  siteSearchIconWarmQueue
};
