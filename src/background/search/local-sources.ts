// The browser's local sources a search reads (history, top sites,
// bookmarks, open tabs), with short-lived caches the browser's own change
// events invalidate.
import * as BROWSER_PROFILE from '../../platform/browser-profile';
import { getResolvedTabUrl, isLumnoSearchFallbackUrl } from '../browser-urls-service';
import type { SearchPolicy } from '../../domain/search/types';
import { withTimeout } from './timeout';
import type { BookmarkItem, BookmarkNodeInfo, HistoryRemoval, OpenTabItem, TimedCache } from './types';
import * as SearchTextNormalize from '../../domain/search/utils/text-normalize';

const LOCAL_SUGGEST_SOURCE_TIMEOUT_MS = 800;

const LOCAL_SEARCH_INDEX_WARMUP_TIMEOUT_MS = 80;

const HISTORY_FALLBACK_CACHE_TTL_MS = 45 * 1000;

const TOP_SITES_CACHE_TTL_MS = 30 * 1000;

const BOOKMARK_TREE_CACHE_TTL_MS = 2 * 60 * 1000;

let historyFallbackCache: TimedCache<chrome.history.HistoryItem> = {
  expiresAt: 0,
  items: []
};

// History pages whose titles hold Han characters, from further back than the
// recent list. Pinyin and initials ("wxds") can only be matched against
// titles already in hand, because the browser's history search reads typed
// text. New visits land in the recent list, so this one only refreshes on a
// long interval; removed history leaves it at once.
const HAN_TITLE_HISTORY_CACHE_TTL_MS = 10 * 60 * 1000;

let hanTitleHistoryCache: TimedCache<chrome.history.HistoryItem> = {
  expiresAt: 0,
  items: []
};

let hanTitleHistoryRequest: Promise<chrome.history.HistoryItem[]> | null = null;

let topSitesCache: TimedCache<chrome.topSites.MostVisitedURL> = {
  expiresAt: 0,
  items: []
};

let localSearchSourceCacheListenersBound = false;

let bookmarkTreeIndexCache: { expiresAt: number; map: Map<string, BookmarkNodeInfo> | null } = {
  expiresAt: 0,
  map: null
};

let bookmarkItemsCache: TimedCache<BookmarkItem> = {
  expiresAt: 0,
  items: []
};

let bookmarkItemsPromise: Promise<BookmarkItem[]> | null = null;

let bookmarkTreeCacheListenersBound = false;


function deleteHistoryUrlFromSearch(
  targetUrl: string,
  sendResponse: (reply: { ok: boolean; reason?: string; url?: string }) => void
): true | void {
  if (!targetUrl) {
    sendResponse({ ok: false, reason: 'invalid-url' });
    return;
  }
  if (!chrome.history || typeof chrome.history.deleteUrl !== 'function') {
    sendResponse({ ok: false, reason: 'history-api-unavailable' });
    return;
  }
  chrome.history.deleteUrl({ url: targetUrl }, () => {
    if (chrome.runtime && chrome.runtime.lastError) {
      sendResponse({ ok: false, reason: chrome.runtime.lastError.message || 'delete-history-failed' });
      return;
    }
    invalidateLocalSearchSourceCaches();
    sendResponse({ ok: true, url: targetUrl });
  });
  return true;
}

function callChromeApiWithTimeout<T>(invoke: (done: (value: T) => void) => void, fallbackValue: T, timeoutMs: number): Promise<T> {
  return withTimeout(new Promise<T>((resolve) => {
    let settled = false;
    const finish = (value: T): void => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
    };
    try {
      invoke(finish);
    } catch (_error) {
      finish(fallbackValue);
    }
  }), timeoutMs, fallbackValue);
}

function invalidateBookmarkTreeCache(): void {
  bookmarkTreeIndexCache = {
    expiresAt: 0,
    map: null
  };
  bookmarkItemsCache = {
    expiresAt: 0,
    items: []
  };
  bookmarkItemsPromise = null;
}

function invalidateLocalSearchSourceCaches(): void {
  historyFallbackCache = {
    expiresAt: 0,
    items: []
  };
  topSitesCache = {
    expiresAt: 0,
    items: []
  };
}

function removeHanTitleHistoryItems(removed: HistoryRemoval | null | undefined): void {
  if (!removed || removed.allHistory) {
    hanTitleHistoryCache = {
      expiresAt: 0,
      items: []
    };
    hanTitleHistoryRequest = null;
    return;
  }
  const removedUrls = new Set(Array.isArray(removed.urls) ? removed.urls : []);
  if (removedUrls.size > 0) {
    hanTitleHistoryCache = {
      ...hanTitleHistoryCache,
      items: hanTitleHistoryCache.items.filter((item) => !(item && item.url && removedUrls.has(item.url)))
    };
  }
}

function ensureLocalSearchSourceCacheListeners(): void {
  if (localSearchSourceCacheListenersBound || !chrome || !chrome.history) {
    return;
  }
  if (chrome.history.onVisited && typeof chrome.history.onVisited.addListener === 'function') {
    chrome.history.onVisited.addListener(invalidateLocalSearchSourceCaches);
  }
  if (chrome.history.onVisitRemoved && typeof chrome.history.onVisitRemoved.addListener === 'function') {
    chrome.history.onVisitRemoved.addListener(invalidateLocalSearchSourceCaches);
  }
  if (chrome.history.onVisitRemoved && typeof chrome.history.onVisitRemoved.addListener === 'function') {
    chrome.history.onVisitRemoved.addListener(removeHanTitleHistoryItems);
  }
  localSearchSourceCacheListenersBound = true;
}

function ensureBookmarkTreeCacheListeners(): void {
  if (bookmarkTreeCacheListenersBound || !chrome || !chrome.bookmarks) {
    return;
  }
  const events: Array<{ addListener(listener: () => void): void } | undefined> = [
    chrome.bookmarks.onCreated,
    chrome.bookmarks.onRemoved,
    chrome.bookmarks.onChanged,
    chrome.bookmarks.onMoved,
    chrome.bookmarks.onChildrenReordered,
    chrome.bookmarks.onImportEnded
  ];
  events.forEach((eventTarget) => {
    if (eventTarget && typeof eventTarget.addListener === 'function') {
      eventTarget.addListener(invalidateBookmarkTreeCache);
    }
  });
  bookmarkTreeCacheListenersBound = true;
}

function buildBookmarkNodeMap(tree: chrome.bookmarks.BookmarkTreeNode[] | null | undefined): Map<string, BookmarkNodeInfo> {
  const bookmarkNodeMap = new Map<string, BookmarkNodeInfo>();
  function indexBookmarkNodes(node: chrome.bookmarks.BookmarkTreeNode | null | undefined, parentId: string | null): void {
    if (!node || !node.id) {
      return;
    }
    bookmarkNodeMap.set(node.id, {
      title: node.title || '',
      parentId: parentId || null,
      hasUrl: Boolean(node.url)
    });
    if (Array.isArray(node.children)) {
      node.children.forEach((child) => indexBookmarkNodes(child, node.id));
    }
  }
  if (Array.isArray(tree)) {
    tree.forEach((node) => indexBookmarkNodes(node, null));
  }
  return bookmarkNodeMap;
}

function buildBookmarkItems(tree: chrome.bookmarks.BookmarkTreeNode[] | null | undefined): BookmarkItem[] {
  const items: BookmarkItem[] = [];
  function collectBookmarkNodes(node: chrome.bookmarks.BookmarkTreeNode | null | undefined): void {
    if (!node || !node.id) {
      return;
    }
    if (node.url) {
      items.push({
        id: node.id,
        parentId: node.parentId || null,
        title: node.title || '',
        url: node.url
      });
    }
    if (Array.isArray(node.children)) {
      node.children.forEach((child) => collectBookmarkNodes(child));
    }
  }
  if (Array.isArray(tree)) {
    tree.forEach((node) => collectBookmarkNodes(node));
  }
  return items;
}

function getAllBookmarksCached(): Promise<BookmarkItem[]> {
  const now = Date.now();
  if (Array.isArray(bookmarkItemsCache.items) && bookmarkItemsCache.expiresAt > now) {
    return Promise.resolve(bookmarkItemsCache.items);
  }
  if (bookmarkItemsPromise) {
    return bookmarkItemsPromise;
  }
  if (!chrome || !chrome.bookmarks || typeof chrome.bookmarks.getTree !== 'function') {
    return Promise.resolve([]);
  }
  ensureBookmarkTreeCacheListeners();
  bookmarkItemsPromise = callChromeApiWithTimeout<BookmarkItem[]>((done) => {
    chrome.bookmarks.getTree((tree) => {
      const items = buildBookmarkItems(tree);
      const nodeMap = buildBookmarkNodeMap(tree);
      const expiresAt = Date.now() + BOOKMARK_TREE_CACHE_TTL_MS;
      bookmarkItemsCache = {
        items: items,
        expiresAt
      };
      bookmarkTreeIndexCache = {
        map: nodeMap,
        expiresAt
      };
      bookmarkItemsPromise = null;
      done(items);
    });
  }, [], LOCAL_SUGGEST_SOURCE_TIMEOUT_MS).catch((): BookmarkItem[] => {
    bookmarkItemsPromise = null;
    return [];
  });
  return bookmarkItemsPromise;
}

function getTopSitesCached(): Promise<chrome.topSites.MostVisitedURL[]> {
  const now = Date.now();
  if (topSitesCache.expiresAt > now && Array.isArray(topSitesCache.items)) {
    return Promise.resolve(topSitesCache.items);
  }
  // Edge's topSites lists its own promoted sites, not ones the user visits.
  if (!chrome || !chrome.topSites || typeof chrome.topSites.get !== 'function' ||
      BROWSER_PROFILE.getBrowserInternalScheme(navigator.userAgent) === 'edge://') {
    return Promise.resolve([]);
  }
  return callChromeApiWithTimeout<chrome.topSites.MostVisitedURL[]>((done) => {
    chrome.topSites.get((items) => {
      const list = Array.isArray(items) ? items : [];
      topSitesCache = {
        items: list,
        expiresAt: Date.now() + TOP_SITES_CACHE_TTL_MS
      };
      done(list);
    });
  }, [], LOCAL_SUGGEST_SOURCE_TIMEOUT_MS).catch((): chrome.topSites.MostVisitedURL[] => []);
}

function getFallbackHistoryItemsCached(policy: Partial<SearchPolicy> | null | undefined): Promise<chrome.history.HistoryItem[]> {
  const now = Date.now();
  if (historyFallbackCache.expiresAt > now && Array.isArray(historyFallbackCache.items)) {
    return Promise.resolve(historyFallbackCache.items);
  }
  if (!chrome || !chrome.history || typeof chrome.history.search !== 'function') {
    return Promise.resolve([]);
  }
  const settings = policy && typeof policy === 'object' ? policy : {};
  const fallbackMaxResults = Number(settings.fallbackHistoryMaxResults) > 0
    ? Math.floor(Number(settings.fallbackHistoryMaxResults))
    : 600;
  const fallbackWindowDays = Number(settings.fallbackHistoryWindowDays) > 0
    ? Number(settings.fallbackHistoryWindowDays)
    : 365;
  return callChromeApiWithTimeout<chrome.history.HistoryItem[]>((done) => {
    chrome.history.search({
      text: '',
      maxResults: fallbackMaxResults,
      startTime: Date.now() - (fallbackWindowDays * 24 * 60 * 60 * 1000)
    }, (items) => {
      const list = Array.isArray(items) ? items : [];
      historyFallbackCache = {
        items: list,
        expiresAt: Date.now() + HISTORY_FALLBACK_CACHE_TTL_MS
      };
      done(list);
    });
  }, [], LOCAL_SUGGEST_SOURCE_TIMEOUT_MS).catch((): chrome.history.HistoryItem[] => []);
}

function getHanTitleHistoryItemsCached(policy: Partial<SearchPolicy> | null | undefined): Promise<chrome.history.HistoryItem[]> {
  if (hanTitleHistoryCache.expiresAt > Date.now()) {
    return Promise.resolve(hanTitleHistoryCache.items);
  }
  if (hanTitleHistoryRequest) {
    return hanTitleHistoryRequest;
  }
  if (!chrome || !chrome.history || typeof chrome.history.search !== 'function') {
    return Promise.resolve([]);
  }
  const settings = policy && typeof policy === 'object' ? policy : {};
  const scanLimit = Number(settings.hanTitleHistoryScanLimit) > 0
    ? Math.floor(Number(settings.hanTitleHistoryScanLimit))
    : 5000;
  const windowDays = Number(settings.fallbackHistoryWindowDays) > 0
    ? Number(settings.fallbackHistoryWindowDays)
    : 365;
  const request: Promise<chrome.history.HistoryItem[]> = callChromeApiWithTimeout<chrome.history.HistoryItem[]>((done) => {
    chrome.history.search({
      text: '',
      maxResults: scanLimit,
      startTime: Date.now() - (windowDays * 24 * 60 * 60 * 1000)
    }, (items) => {
      const list = (Array.isArray(items) ? items : [])
        .filter((item) => item && SearchTextNormalize.hasSearchHanCharacters(item.title));
      if (hanTitleHistoryRequest === request) {
        hanTitleHistoryCache = {
          items: list,
          expiresAt: Date.now() + HAN_TITLE_HISTORY_CACHE_TTL_MS
        };
      }
      done(list);
    });
  }, [], LOCAL_SUGGEST_SOURCE_TIMEOUT_MS)
    .catch((): chrome.history.HistoryItem[] => [])
    .finally(() => {
      if (hanTitleHistoryRequest === request) {
        hanTitleHistoryRequest = null;
      }
    });
  hanTitleHistoryRequest = request;
  return request;
}

// The first typed letter starts the scan without waiting for it; the next
// keystrokes use it.
function getCachedHanTitleHistoryItemsOrWarm(policy: Partial<SearchPolicy>): Promise<chrome.history.HistoryItem[]> {
  if (hanTitleHistoryCache.expiresAt > Date.now()) {
    return Promise.resolve(hanTitleHistoryCache.items);
  }
  return withTimeout(
    getHanTitleHistoryItemsCached(policy),
    LOCAL_SEARCH_INDEX_WARMUP_TIMEOUT_MS,
    []
  );
}

function getCachedFallbackHistoryItemsOrWarm(policy: Partial<SearchPolicy>): Promise<chrome.history.HistoryItem[]> {
  const now = Date.now();
  if (historyFallbackCache.expiresAt > now && Array.isArray(historyFallbackCache.items)) {
    return Promise.resolve(historyFallbackCache.items);
  }
  return withTimeout(
    getFallbackHistoryItemsCached(policy),
    LOCAL_SEARCH_INDEX_WARMUP_TIMEOUT_MS,
    []
  );
}

function getCachedBookmarkItemsOrWarm(): Promise<BookmarkItem[]> {
  const now = Date.now();
  if (Array.isArray(bookmarkItemsCache.items) && bookmarkItemsCache.expiresAt > now) {
    return Promise.resolve(bookmarkItemsCache.items);
  }
  return withTimeout(
    getAllBookmarksCached(),
    LOCAL_SEARCH_INDEX_WARMUP_TIMEOUT_MS,
    []
  );
}

function getCachedBookmarkNodeMap(): Map<string, BookmarkNodeInfo> {
  const now = Date.now();
  if (bookmarkTreeIndexCache.map && bookmarkTreeIndexCache.expiresAt > now) {
    return bookmarkTreeIndexCache.map;
  }
  return new Map();
}

function getOpenTabSearchItems(): Promise<OpenTabItem[]> {
  if (!chrome || !chrome.tabs || typeof chrome.tabs.query !== 'function') {
    return Promise.resolve([]);
  }
  return callChromeApiWithTimeout<OpenTabItem[]>((done) => {
    chrome.tabs.query({}, (tabs) => {
      const items: OpenTabItem[] = [];
      (Array.isArray(tabs) ? tabs : []).forEach((tab) => {
        const url = getResolvedTabUrl(tab);
        if (!url || typeof tab.id !== 'number' || isLumnoSearchFallbackUrl(url)) {
          return;
        }
        items.push({
          title: String(tab.title || '').replace(/\s+/g, ' ').trim() || url,
          url,
          _xMatchedTabId: tab.id
        });
      });
      done(items);
    });
  }, [], LOCAL_SUGGEST_SOURCE_TIMEOUT_MS).catch((): OpenTabItem[] => []);
}


export {
  LOCAL_SUGGEST_SOURCE_TIMEOUT_MS,
  callChromeApiWithTimeout,
  deleteHistoryUrlFromSearch,
  ensureLocalSearchSourceCacheListeners,
  getCachedBookmarkItemsOrWarm,
  getCachedBookmarkNodeMap,
  getCachedFallbackHistoryItemsOrWarm,
  getCachedHanTitleHistoryItemsOrWarm,
  getOpenTabSearchItems,
  getTopSitesCached
};
