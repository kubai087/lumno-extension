// The icon snapshots shortcut tiles show, saved by page URL and fetched a
// few at a time; the icons websites inside shortcut folders keep; and the
// icon choices the shortcut dialog offers.
import * as ShortcutIconCache from '../../domain/favicon/shortcut-favicon/persisted';
import * as BundledIcons from '../../domain/favicon/shortcut-favicon/bundled-icons';
import * as FaviconCanonical from '../../domain/favicon/canonical';
import * as SearchSiteSearchProviders from '../../domain/search/utils/site-search-providers';
import * as ShortcutNormalize from '../../domain/shortcuts/normalize';
import { getShortcutUrl, isShortcutFolder } from '../../domain/shortcuts/normalize';
import { isRecord } from '../../platform/storage-call';
import { faviconEnhancedFetchEnabled, faviconRequestBlacklist } from '../../domain/settings/search';
import { newtabShortcutFaviconCache } from '../../domain/settings/newtab-shortcuts';
import type { FaviconDataEntry } from '../../domain/favicon/favicon-cache';
import type { FaviconUrlResolver } from '../../domain/favicon/resolver';
import type { CachedIconMap, CachedIconSource } from '../../domain/favicon/shortcut-favicon/types';
import type { ShortcutIconSource, ShortcutItem, ShortcutLink } from '../../domain/shortcuts/types';
import type { FaviconCacheRuntime } from '../../platform/favicon-cache';
import type { SettingsStore } from '../../platform/settings-store';
import type { ShortcutFaviconStore } from '../../platform/shortcut-favicon-store';
import type { BookmarksRuntime } from '../bookmarks/bookmarks-runtime';
import type {
  FolderItemIcon,
  FolderItemIconMap,
  FolderItemIconStore,
  FolderItemShortcutSettings
} from '../bookmarks/folder-item-icons';
import type { SendRuntimeMessage } from '../newtab-types';
import type { OnlineShortcutIcon, ShortcutDialogPayload } from '../react/shortcut-dialog';
import type { ShortcutList } from './shortcut-list';
import { shortcutIconEvents } from './shortcut-icon-events';
import { shortcutEvents } from './shortcut-events';

interface ShortcutFaviconsDeps {
  settings: Pick<SettingsStore, 'getStored' | 'subscribe'>;
  shortcutList: Pick<ShortcutList, 'items'>;
  bookmarksRuntime: Pick<BookmarksRuntime, 'getNode' | 'getSnapshot'>;
  folderItemIconStore: Pick<FolderItemIconStore, 'get' | 'update'>;
  shortcutFaviconStore: Pick<ShortcutFaviconStore, 'readAll' | 'mergeAll' | 'retainAll'>;
  faviconCacheRuntime: Pick<FaviconCacheRuntime, 'ensureCachesReady'>;
  getPersistedFaviconDataEntry(cacheKey: string): FaviconDataEntry | null;
  getPageFaviconUrlResolver(): Pick<FaviconUrlResolver,
    'getShortcutFaviconCandidateUrl' | 'getShortcutFaviconFetchCandidates'> | null;
  getExtensionResourceUrl(resourcePath: string): string;
  sendRuntimeMessage: SendRuntimeMessage;
}

// The icon a website in a shortcut folder was given in the dialog.
interface FolderItemIconChoice {
  source: NonNullable<ShortcutDialogPayload['iconSource']>;
  action?: ShortcutDialogPayload['iconAction'];
  dataUrl?: string;
  onlineIcon?: OnlineShortcutIcon;
}

interface FaviconRequestTask {
  run(): Promise<string>;
  resolve(dataUrl: string): void;
}

function isCachedIconSource(value: unknown): value is CachedIconSource {
  return value === 'service' || value === 'favicon-is' || value === 'cache';
}

function createShortcutFavicons(deps: ShortcutFaviconsDeps) {
  const {
    settings,
    shortcutList,
    bookmarksRuntime,
    folderItemIconStore,
    shortcutFaviconStore,
    faviconCacheRuntime,
    getPersistedFaviconDataEntry,
    getPageFaviconUrlResolver,
    getExtensionResourceUrl,
    sendRuntimeMessage
  } = deps;

  // Bumped when the favicon policy changes, so requests made before it are
  // dropped.
  let shortcutFaviconPolicyRevision = 0;
  // Saved favicon snapshots by page URL, and the ones not yet written.
  let newtabShortcutFavicons: CachedIconMap = {};
  let shortcutFaviconPendingCacheEntries: CachedIconMap = {};

  const shortcutFaviconPending = new Map<string, Promise<string>>();
  const shortcutFaviconRequestQueue: FaviconRequestTask[] = [];
  const SHORTCUT_FAVICON_MAX_CONCURRENT_REQUESTS = 3;
  let shortcutFaviconActiveRequestCount = 0;
  let shortcutFaviconCacheWriteTimer: number | null = null;

  // A new favicon policy drops the icon requests made under the old one and
  // draws the tiles under the new one.
  settings.subscribe([faviconRequestBlacklist, faviconEnhancedFetchEnabled], () => {
    shortcutFaviconPolicyRevision += 1;
    shortcutEvents.emit('stale', null);
  });

  // The first shortcut whose page is `pageUrl` (normalized).
  function findShortcutByPageUrl(pageUrl: string): ShortcutItem | undefined {
    return shortcutList.items.find((item) => ShortcutIconCache.normalizePageUrl(getShortcutUrl(item)) === pageUrl);
  }

  // A built-in choice only holds while this extension still packages artwork
  // for the URL; otherwise the tile resolves its icon automatically.
  function getShortcutIconSource(shortcut: ShortcutItem | null | undefined): ShortcutIconSource | undefined {
    if (!shortcut || isShortcutFolder(shortcut)) return undefined;
    const source = shortcut.iconSource;
    return source === 'builtin' && !getShortcutDialogBuiltinIconUrl(shortcut.url) ? undefined : source;
  }

  function getShortcutFaviconDataUrl(pageUrl: unknown): string {
    const normalizedPageUrl = ShortcutIconCache.normalizePageUrl(pageUrl);
    const source = getShortcutIconSource(findShortcutByPageUrl(normalizedPageUrl));
    if (source === 'builtin') return '';
    const entry = normalizedPageUrl ? newtabShortcutFavicons[normalizedPageUrl] : undefined;
    if (entry && isCachedIconSource(source)) {
      const savedSource = ShortcutIconCache.getCachedIconSource(entry);
      if (source !== savedSource) return '';
    }
    return ShortcutIconCache.getCachedIconDataUrl(newtabShortcutFavicons, pageUrl);
  }

  function getShortcutFaviconCandidateUrl(pageUrl: string): string {
    // A saved snapshot, including an explicit refresh, takes precedence over bundled defaults.
    if (getShortcutFaviconDataUrl(pageUrl)) {
      return '';
    }
    const normalizedPageUrl = ShortcutIconCache.normalizePageUrl(pageUrl);
    if (normalizedPageUrl && getShortcutIconSource(findShortcutByPageUrl(normalizedPageUrl)) !== 'builtin') return '';
    const resolver = getPageFaviconUrlResolver();
    return resolver ? resolver.getShortcutFaviconCandidateUrl(
      pageUrl, getShortcutDialogBuiltinIconUrl(pageUrl)
    ) : '';
  }

  function saveShortcutFaviconSnapshot(pageUrl: string, dataUrl: unknown, sourceUrl: unknown, replaceExisting?: boolean): string {
    const normalizedDataUrl = ShortcutIconCache.normalizeDataUrl(dataUrl);
    if (!normalizedDataUrl || !findShortcutByPageUrl(pageUrl)) {
      return '';
    }
    const savedDataUrl = getShortcutFaviconDataUrl(pageUrl);
    if (savedDataUrl && replaceExisting !== true) {
      return savedDataUrl;
    }
    newtabShortcutFavicons = ShortcutIconCache.setCachedIcon(
      newtabShortcutFavicons, pageUrl, normalizedDataUrl, sourceUrl
    );
    scheduleShortcutFaviconCacheWrite(pageUrl);
    shortcutIconEvents.emit('snapshotSaved', { pageUrl: ShortcutIconCache.normalizePageUrl(pageUrl) });
    return normalizedDataUrl;
  }

  function areShortcutFaviconEntriesEqual(left: CachedIconMap[string] | undefined, right: CachedIconMap[string] | undefined): boolean {
    return Boolean(left && right &&
      left.dataUrl === right.dataUrl &&
      left.sourceUrl === right.sourceUrl &&
      left.updatedAt === right.updatedAt);
  }

  // Websites inside shortcut folders keep their own icon choice; '' means
  // the automatic favicon.
  function getFolderItemIconUrl(bookmarkId: string, url: string): string {
    const entry = folderItemIconStore.get(bookmarkId);
    if (!entry) return '';
    return entry.iconSource === 'builtin' ? getShortcutDialogBuiltinIconUrl(url) : entry.dataUrl || '';
  }

  function getFolderItemIcon(bookmarkId: string): FolderItemIcon | null {
    return folderItemIconStore.get(bookmarkId);
  }

  // The icon a website shortcut keeps once moved into a folder, with the
  // plate and source the folder cannot show kept for its way back out.
  function getFolderItemIconForShortcut(shortcut: ShortcutLink, iconDataUrl: string | undefined): FolderItemIcon | null {
    const source = getShortcutIconSource(shortcut);
    let icon: FolderItemIcon | null = null;
    if (iconDataUrl) {
      icon = { iconSource: 'custom', dataUrl: iconDataUrl };
    } else if (source === 'builtin') {
      icon = { iconSource: 'builtin' };
    } else {
      const dataUrl = shortcut.url ? getShortcutFaviconDataUrl(shortcut.url) : '';
      icon = dataUrl ? { iconSource: source || 'cache', dataUrl } : null;
    }
    const settings: FolderItemShortcutSettings = {
      ...(!icon && source && source !== 'custom' ? { iconSource: source } : {}),
      ...(shortcut.iconPlate ? { iconPlate: shortcut.iconPlate } : {}),
      ...(shortcut.iconPlateColor ? { iconPlateColor: shortcut.iconPlateColor } : {})
    };
    const hasSettings = Object.keys(settings).length > 0;
    return icon || hasSettings ? { ...(icon || {}), ...(hasSettings ? { shortcut: settings } : {}) } : null;
  }

  function updateFolderItemIcons(changes: Readonly<Record<string, FolderItemIcon | null>>): Promise<FolderItemIconMap> {
    const snapshot = bookmarksRuntime.getSnapshot();
    return folderItemIconStore.update(changes, snapshot.ready ? (id) => snapshot.nodeMap.has(id) : undefined);
  }

  // The icon chosen in the edit dialog; the plate the site had as a
  // shortcut stays for when it becomes one again.
  function getNextFolderItemIcon(bookmarkId: string, url: string, iconState: FolderItemIconChoice): FolderItemIcon | null {
    const current = folderItemIconStore.get(bookmarkId);
    const image = getNextFolderItemImage(bookmarkId, url, iconState);
    const next: FolderItemIcon | null = image && { iconSource: image.iconSource, ...(image.dataUrl ? { dataUrl: image.dataUrl } : {}) };
    const kept = current && current.shortcut ? current.shortcut : null;
    const settings: FolderItemShortcutSettings = {
      ...(kept && kept.iconPlate ? { iconPlate: kept.iconPlate } : {}),
      ...(kept && kept.iconPlateColor ? { iconPlateColor: kept.iconPlateColor } : {})
    };
    const hasSettings = Object.keys(settings).length > 0;
    return next || hasSettings ? { ...(next || {}), ...(hasSettings ? { shortcut: settings } : {}) } : null;
  }

  function getNextFolderItemImage(bookmarkId: string, url: string, iconState: FolderItemIconChoice): FolderItemIcon | null {
    const current = folderItemIconStore.get(bookmarkId);
    const source = iconState.source;
    if (source === 'custom') {
      return iconState.action === 'replace' && iconState.dataUrl
        ? { iconSource: 'custom', dataUrl: iconState.dataUrl }
        : current && current.iconSource === 'custom' ? current : null;
    }
    if (source === 'builtin') return { iconSource: 'builtin' };
    const toPageUrl = (value: unknown): string =>
      ShortcutIconCache.normalizePageUrl(ShortcutNormalize.normalizeShortcutUrl(value));
    const pageUrl = toPageUrl(url);
    const onlineIcon = iconState.onlineIcon;
    if (onlineIcon && onlineIcon.dataUrl && pageUrl && onlineIcon.pageUrl === pageUrl) {
      return { iconSource: source, dataUrl: onlineIcon.dataUrl };
    }
    // An unchanged choice keeps its image until the URL changes.
    const node = bookmarksRuntime.getNode(bookmarkId);
    return current && current.iconSource === source && node && toPageUrl(node.url) === pageUrl ? current : null;
  }

  function getShortcutDialogOnlineIconUrl(url: string): string {
    const pageUrl = ShortcutNormalize.normalizeShortcutUrl(url);
    return pageUrl ? getShortcutFaviconDataUrl(pageUrl) || getShortcutFaviconCandidateUrl(pageUrl) : '';
  }

  function getShortcutDialogBuiltinIconUrl(url: unknown): string {
    const pageUrl = ShortcutNormalize.normalizeShortcutUrl(url);
    const assetPath = BundledIcons.getBundledShortcutIconAssetPath(
      pageUrl, SearchSiteSearchProviders.getDefaultSiteSearchProviders()
    );
    return assetPath ? getExtensionResourceUrl(assetPath) : '';
  }

  function getShortcutDialogOnlineIconSource(url: string): CachedIconSource | 'builtin' {
    const pageUrl = ShortcutIconCache.normalizePageUrl(
      ShortcutNormalize.normalizeShortcutUrl(url)
    );
    const shortcut = findShortcutByPageUrl(pageUrl);
    const iconSource = shortcut && !isShortcutFolder(shortcut) ? shortcut.iconSource : undefined;
    if (iconSource === 'builtin' || isCachedIconSource(iconSource)) {
      return iconSource;
    }
    const entry = pageUrl ? newtabShortcutFavicons[pageUrl] : undefined;
    if (entry && ShortcutIconCache.isCachedIconForPage(entry, pageUrl)) {
      return ShortcutIconCache.getCachedIconSource(entry);
    }
    return 'cache';
  }

  function isShortcutDialogIconSourceAvailable(source: CachedIconSource, url: string): boolean {
    const pageUrl = ShortcutNormalize.normalizeShortcutUrl(url);
    if (!pageUrl) return source === 'cache';
    const normalizedPageUrl = ShortcutIconCache.normalizePageUrl(pageUrl);
    const resolver = getPageFaviconUrlResolver();
    return normalizedPageUrl
      ? Boolean(resolver && resolver.getShortcutFaviconFetchCandidates(normalizedPageUrl, source).length)
      : source === 'cache';
  }

  function refreshShortcutDialogOnlineIcon(url: string, iconSource?: CachedIconSource): Promise<OnlineShortcutIcon | null> {
    const pageUrl = ShortcutNormalize.normalizeShortcutUrl(url);
    const normalizedPageUrl = ShortcutIconCache.normalizePageUrl(pageUrl);
    if (!normalizedPageUrl) {
      if (iconSource === 'service' || iconSource === 'favicon-is') return Promise.resolve(null);
      // Internal browser pages can only use their browser-provided icon.
      const browserIcon = pageUrl ? getShortcutFaviconCandidateUrl(pageUrl) : '';
      return Promise.resolve(browserIcon ? { dataUrl: browserIcon, pageUrl } : null);
    }
    const resolver = getPageFaviconUrlResolver();
    if (!resolver || resolver.getShortcutFaviconFetchCandidates(normalizedPageUrl, iconSource).length === 0) {
      return Promise.resolve(null);
    }
    const policyRevision = shortcutFaviconPolicyRevision;
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result: OnlineShortcutIcon | null): void => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      const timeoutId = window.setTimeout(() => finish(null), 8000);
      const sent = sendRuntimeMessage<'getShortcutFaviconData'>({
        action: 'getShortcutFaviconData',
        pageUrl: normalizedPageUrl,
        refresh: true,
        ...(isCachedIconSource(iconSource) ? { iconSource } : {})
      }, (response) => {
        window.clearTimeout(timeoutId);
        const dataUrl = ShortcutIconCache.normalizeDataUrl(response && response.data);
        finish(response && dataUrl && policyRevision === shortcutFaviconPolicyRevision
          ? { dataUrl, pageUrl: normalizedPageUrl, sourceUrl: String(response.sourceUrl || '') }
          : null);
      });
      if (!sent) {
        window.clearTimeout(timeoutId);
        finish(null);
      }
    });
  }

  function scheduleShortcutFaviconCacheWrite(pageUrl: string): void {
    const cacheKey = ShortcutIconCache.normalizePageUrl(pageUrl);
    const cacheEntry = cacheKey ? newtabShortcutFavicons[cacheKey] : undefined;
    if (cacheKey && cacheEntry) {
      shortcutFaviconPendingCacheEntries[cacheKey] = cacheEntry;
    }
    if (shortcutFaviconCacheWriteTimer !== null) {
      window.clearTimeout(shortcutFaviconCacheWriteTimer);
    }
    shortcutFaviconCacheWriteTimer = window.setTimeout(() => {
      shortcutFaviconCacheWriteTimer = null;
      const pendingEntries = { ...shortcutFaviconPendingCacheEntries };
      if (Object.keys(pendingEntries).length === 0) {
        return;
      }
      shortcutFaviconStore.mergeAll(pendingEntries).then((savedEntries) => {
        Object.keys(pendingEntries).forEach((key) => {
          if (areShortcutFaviconEntriesEqual(shortcutFaviconPendingCacheEntries[key], pendingEntries[key])) {
            delete shortcutFaviconPendingCacheEntries[key];
          }
        });
        newtabShortcutFavicons = ShortcutIconCache.normalizeCacheMap({
          ...savedEntries,
          ...shortcutFaviconPendingCacheEntries
        });
      }).catch(() => {});
    }, 120);
  }

  function drainShortcutFaviconRequestQueue(): void {
    while (shortcutFaviconActiveRequestCount < SHORTCUT_FAVICON_MAX_CONCURRENT_REQUESTS) {
      const task = shortcutFaviconRequestQueue.shift();
      if (!task) break;
      shortcutFaviconActiveRequestCount += 1;
      Promise.resolve().then(task.run).then(task.resolve, () => task.resolve('')).finally(() => {
        shortcutFaviconActiveRequestCount = Math.max(0, shortcutFaviconActiveRequestCount - 1);
        drainShortcutFaviconRequestQueue();
      });
    }
  }

  function enqueueShortcutFaviconRequest(run: () => Promise<string>): Promise<string> {
    return new Promise((resolve) => {
      shortcutFaviconRequestQueue.push({ run, resolve });
      drainShortcutFaviconRequestQueue();
    });
  }

  function resolveShortcutFaviconDataUrl(pageUrl: string): Promise<string> {
    const normalizedPageUrl = ShortcutIconCache.normalizePageUrl(pageUrl);
    if (!normalizedPageUrl) {
      return Promise.resolve('');
    }
    const iconSource = getShortcutIconSource(findShortcutByPageUrl(normalizedPageUrl));
    if (iconSource === 'builtin') return Promise.resolve('');
    const cachedDataUrl = getShortcutFaviconDataUrl(normalizedPageUrl);
    if (cachedDataUrl) {
      return Promise.resolve(cachedDataUrl);
    }
    const policyRevision = shortcutFaviconPolicyRevision;
    const requestKey = `${normalizedPageUrl}::${policyRevision}::${iconSource || 'auto'}`;
    const pending = shortcutFaviconPending.get(requestKey);
    if (pending) {
      return pending;
    }
    const promise = enqueueShortcutFaviconRequest(async () => {
      await faviconCacheRuntime.ensureCachesReady();
      if (!findShortcutByPageUrl(normalizedPageUrl) || policyRevision !== shortcutFaviconPolicyRevision) {
        return '';
      }
      const savedDataUrl = getShortcutFaviconDataUrl(normalizedPageUrl);
      if (savedDataUrl) {
        return savedDataUrl;
      }
      const cacheKey = FaviconCanonical.getFaviconPersistCacheKey(normalizedPageUrl);
      const existingEntry = getPersistedFaviconDataEntry(cacheKey);
      // The page favicon cache keeps no source URL.
      if (!iconSource && existingEntry && ShortcutIconCache.isCachedIconForPage(existingEntry, normalizedPageUrl) &&
          ShortcutIconCache.normalizeDataUrl(existingEntry.dataUrl)) {
        return saveShortcutFaviconSnapshot(normalizedPageUrl, existingEntry.dataUrl, '');
      }
      const resolver = getPageFaviconUrlResolver();
      if (!resolver || resolver.getShortcutFaviconFetchCandidates(normalizedPageUrl, iconSource).length === 0) {
        return '';
      }
      return new Promise<string>((resolve) => {
        let settled = false;
        const finish = (dataUrl: string): void => {
          if (settled) {
            return;
          }
          settled = true;
          resolve(dataUrl || '');
        };
        const timeoutId = window.setTimeout(() => finish(''), 8000);
        const sent = sendRuntimeMessage<'getShortcutFaviconData'>({
          action: 'getShortcutFaviconData',
          pageUrl: normalizedPageUrl,
          ...(isCachedIconSource(iconSource) ? { iconSource } : {})
        }, (response) => {
          window.clearTimeout(timeoutId);
          if (settled) {
            return;
          }
          const currentShortcut = findShortcutByPageUrl(normalizedPageUrl);
          if (!currentShortcut || getShortcutIconSource(currentShortcut) !== iconSource ||
              policyRevision !== shortcutFaviconPolicyRevision) {
            finish('');
            return;
          }
          finish(saveShortcutFaviconSnapshot(normalizedPageUrl,
            response && response.data, response && response.sourceUrl));
        });
        if (!sent) {
          window.clearTimeout(timeoutId);
          finish('');
        }
      });
    }).finally(() => {
      shortcutFaviconPending.delete(requestKey);
    });
    shortcutFaviconPending.set(requestKey, promise);
    return promise;
  }

  function loadShortcutFavicons(): Promise<CachedIconMap> {
    return shortcutFaviconStore.readAll()
      .then((cacheMap) => {
        newtabShortcutFavicons = ShortcutIconCache.normalizeCacheMap(cacheMap);
        return newtabShortcutFavicons;
      })
      .catch(() => {
        newtabShortcutFavicons = {};
        return newtabShortcutFavicons;
      });
  }

  function pruneShortcutFavicons(shortcuts: readonly ShortcutItem[]): void {
    const shortcutUrls = shortcuts.map(getShortcutUrl);
    const nextFavicons = ShortcutIconCache.retainCachedIcons(
      newtabShortcutFavicons,
      shortcutUrls
    );
    const changed = JSON.stringify(newtabShortcutFavicons) !== JSON.stringify(nextFavicons);
    newtabShortcutFavicons = nextFavicons;
    shortcutFaviconPendingCacheEntries = ShortcutIconCache.retainCachedIcons(
      shortcutFaviconPendingCacheEntries,
      shortcutUrls
    );
    if (changed) {
      shortcutFaviconStore.retainAll(shortcutUrls).catch(() => {});
    }
  }

  // Snapshots other pages save join the ones this page has not written yet.
  settings.subscribe(newtabShortcutFaviconCache, () => {
    const storedFavicons = settings.getStored(newtabShortcutFaviconCache);
    newtabShortcutFavicons = ShortcutIconCache.normalizeCacheMap({
      ...(isRecord(storedFavicons) ? storedFavicons : {}),
      ...shortcutFaviconPendingCacheEntries
    });
    shortcutEvents.emit('stale', null);
  });

  function getShortcutFaviconPolicyRevision(): number {
    return shortcutFaviconPolicyRevision;
  }

  return {
    getShortcutFaviconPolicyRevision,
    getShortcutFaviconDataUrl,
    getShortcutFaviconCandidateUrl,
    saveShortcutFaviconSnapshot,
    resolveShortcutFaviconDataUrl,
    loadShortcutFavicons,
    pruneShortcutFavicons,
    getFolderItemIconUrl,
    getFolderItemIcon,
    getFolderItemIconForShortcut,
    updateFolderItemIcons,
    getNextFolderItemIcon,
    getShortcutDialogOnlineIconUrl,
    getShortcutDialogBuiltinIconUrl,
    getShortcutDialogOnlineIconSource,
    isShortcutDialogIconSourceAvailable,
    refreshShortcutDialogOnlineIcon
  };
}

type ShortcutFavicons = ReturnType<typeof createShortcutFavicons>;

export { createShortcutFavicons };
export type { FolderItemIconChoice, ShortcutFavicons, ShortcutFaviconsDeps };
