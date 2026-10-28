// Loading and rendering the bookmark and recent-site sections.
import { queryHtmlElement } from '../shared/dom-lookup';
import type { AppearanceModes } from './appearance-modes';
import type { BookmarkCascadeActions } from './bookmarks/bookmark-cascade-actions';
import type { BookmarkDragSession } from './bookmarks/bookmark-drag';
import type { BookmarkDragController } from './bookmarks/bookmark-drag-controller';
import type { BookmarkPager } from './bookmarks/bookmark-pager';
import type { BookmarkItem } from './bookmarks/bookmarks-store';
import type { BookmarksRuntime } from './bookmarks/bookmarks-runtime';
import type { PageLayout } from './page-layout';
import type { PagePreferences } from './page-preferences';
import type { BookmarksViewController } from './react/bookmarks';
import type { RecentSitesViewController } from './react/recent-sites';
import type { RecentCardDrag } from './recent/recent-card-drag';
import type { RecentSitesController } from './recent/recent-sites-controller';
import type { RecentSources } from './recent/recent-sources';
import type { SectionHeaders } from './section-headers';
import type { ShortcutDrag, ShortcutDragSession } from './shortcuts/shortcut-drag';
import type { ShortcutsController } from './shortcuts/shortcuts-controller';
import type { PageFavicons } from './theme/page-favicons';
import type { UrlPolicy } from './url-policy';
import type { RecentSite } from '../domain/recent-sites-store';
import type { SettingPreview } from './setting-preview';
import type { SettingsStore } from '../platform/settings-store';
import { bookmarkCount, bookmarkViewMode } from '../domain/settings/bookmarks';
import { recentMode } from '../domain/settings/recent-sites';
import { isRecord } from '../platform/storage-call';

interface SectionLoadOptions {
  force?: boolean;
  skipFaviconWait?: boolean;
  // The section data revision the load was asked for; a newer one drops it.
  sectionDataRevision?: number;
}

interface SectionLoadersState {
  // Goes up whenever the section data is replaced, so loads asked for
  // before then land nowhere.
  sectionDataRevision: number;
  initialThemeApplied: boolean;
  bookmarkDragState: BookmarkDragSession | null;
  shortcutDragState: ShortcutDragSession | null;
  bookmarkGrid: HTMLElement | null;
  bookmarksView: Pick<BookmarksViewController, 'render' | 'clear'> | null;
  bookmarkCurrentFolderId: string;
  bookmarkRootFolderId: string;
  bookmarkRenderSignature: string;
  bookmarkAllItems: BookmarkItem[];
  bookmarkRootTotalCount: number;
  bookmarkRootVisibleCount: number;
  bookmarkCurrentPage: number;
  bookmarkLoadedOnce: boolean;
  newtabShortcuts: ReadonlyArray<{ type?: string }>;
  recentSitesView: Pick<RecentSitesViewController, 'render' | 'clear'> | null;
  recentSourceItems: RecentSite[];
  recentRenderSignature: string;
  recentLoadedOnce: boolean;
}

interface SectionLoadersDeps extends
  Pick<ShortcutDrag, 'isShortcutDragActive' | 'scheduleShortcutDragMove'>,
  Pick<BookmarkDragController,
    'updateBookmarkDragLayoutCache' | 'setBookmarkDragCardTransform' | 'scheduleBookmarkDragMove' |
    'syncOpenBookmarkCascadeAnchorVisual' | 'playPendingBookmarkLayoutAnimation'>,
  Pick<BookmarkPager,
    'updateBookmarkGridHeightLock' | 'updateBookmarkPagerState' | 'getBookmarkPageCount' | 'renderCurrentBookmarkPage'>,
  Pick<PageLayout,
    'updateBookmarkSectionPosition' | 'getRecentLimit' | 'getRecentSourceLimit' | 'setContentSectionVisible' |
    'beginSearchEntryRestoreLayoutLock'>,
  Pick<RecentSitesController,
    'normalizeRecentSiteRecord' | 'getRecentSiteUrlKey' | 'getHiddenRecentSites' | 'writeHiddenRecentSites' | 'isRecentSiteHidden' |
    'mergeRecentSitesWithPinned'>,
  Pick<UrlPolicy, 'shouldExcludeFromRecentSites'>,
  Pick<BookmarkCascadeActions, 'closeBookmarkCascadeMenu' | 'getTopBookmarks'>,
  Pick<AppearanceModes, 'followTheme'>,
  Pick<PageFavicons, 'areFaviconRenderCachesReady' | 'waitForFaviconRenderCaches'>,
  Pick<PagePreferences, 'getBookmarkLimit'>,
  Pick<ShortcutsController, 'renderShortcuts'>,
  Pick<RecentSources, 'getRecentSites'> {
  settings: Pick<SettingsStore, 'get'>;
  preview: Pick<SettingPreview, 'get'>;
  isRecentCardDragActive: RecentCardDrag['isRecentCardDragActive'];
  resumeRecentCardDragAfterFolderSwitch: RecentCardDrag['resumeRecentCardDragAfterFolderSwitch'];
  isBookmarkTopbarMode: SectionHeaders['isBookmarkTopbarMode'];
  setBookmarkSurfaceVisible: SectionHeaders['setBookmarkSurfaceVisible'];
  updateBookmarkHeader: SectionHeaders['updateBookmarkHeader'];
  recentSection: HTMLElement | null;
  bookmarksRuntime: Pick<BookmarksRuntime, 'invalidate'>;
  FAVICON_CACHE_BOOT_WAIT_MS: number;
  MAX_PINNED_RECENT_SITES: number;
  pageState: SectionLoadersState;
}

function createSectionLoaders(deps: SectionLoadersDeps) {
  const {
    settings,
    preview,
    isShortcutDragActive,
    isRecentCardDragActive,
    resumeRecentCardDragAfterFolderSwitch,
    isBookmarkTopbarMode,
    scheduleShortcutDragMove,
    updateBookmarkDragLayoutCache,
    setBookmarkDragCardTransform,
    scheduleBookmarkDragMove,
    syncOpenBookmarkCascadeAnchorVisual,
    setBookmarkSurfaceVisible,
    updateBookmarkGridHeightLock,
    updateBookmarkSectionPosition,
    updateBookmarkPagerState,
    normalizeRecentSiteRecord,
    getRecentSiteUrlKey,
    getHiddenRecentSites,
    writeHiddenRecentSites,
    shouldExcludeFromRecentSites,
    isRecentSiteHidden,
    mergeRecentSitesWithPinned,
    getRecentLimit,
    setContentSectionVisible,
    recentSection,
    bookmarksRuntime,
    closeBookmarkCascadeMenu,
    followTheme,
    areFaviconRenderCachesReady,
    FAVICON_CACHE_BOOT_WAIT_MS,
    waitForFaviconRenderCaches,
    getTopBookmarks,
    getBookmarkLimit,
    getBookmarkPageCount,
    updateBookmarkHeader,
    renderCurrentBookmarkPage,
    playPendingBookmarkLayoutAnimation,
    renderShortcuts,
    getRecentSourceLimit,
    getRecentSites,
    MAX_PINNED_RECENT_SITES,
    beginSearchEntryRestoreLayoutLock
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  let bookmarkLoadToken = 0;
  let bookmarkDataDirty = true;
  let recentLoadToken = 0;
  let recentDataDirty = true;

  // A drag shows the empty bookmarks bar as a drop target. The search box
  // holds still meanwhile, so the dock grows over free space, and the bar
  // stays hidden when it would cover shortcuts: the shortcut area would
  // then shrink and scroll under the pointer.
  function getBookmarksView(): Pick<BookmarksViewController, 'render' | 'clear'> {
    if (!pageState.bookmarksView) {
      throw new Error('Bookmarks view unavailable');
    }
    return pageState.bookmarksView;
  }

  function getRecentSitesView(): Pick<RecentSitesViewController, 'render' | 'clear'> {
    if (!pageState.recentSitesView) {
      throw new Error('Recent sites view unavailable');
    }
    return pageState.recentSitesView;
  }

  function isDragActive(): boolean {
    return Boolean((pageState.bookmarkDragState && pageState.bookmarkDragState.isDragging) ||
      isShortcutDragActive() || isRecentCardDragActive());
  }

  function getShortcutAreaLimit(): string {
    const section = typeof document !== 'undefined'
      ? queryHtmlElement(document, '.x-nt-shortcuts-section')
      : null;
    return section && section.style ? section.style.getPropertyValue('--x-nt-shortcuts-max-height') : '';
  }

  function showEmptyBookmarkRoot(visible: boolean, keepForDrag: boolean): void {
    const limitBefore = getShortcutAreaLimit();
    const layoutOptions = isDragActive() ? { preserveSearchEntryLayout: true } : undefined;
    setBookmarkSurfaceVisible(visible);
    updateBookmarkGridHeightLock();
    updateBookmarkSectionPosition(layoutOptions);
    const limitAfter = getShortcutAreaLimit();
    const coversShortcuts = keepForDrag && limitAfter &&
      (!limitBefore || Number.parseFloat(limitAfter) < Number.parseFloat(limitBefore));
    if (!coversShortcuts) {
      return;
    }
    if (pageState.bookmarkGrid) {
      pageState.bookmarkGrid.removeAttribute('data-bookmark-empty-drop-surface');
    }
    setBookmarkSurfaceVisible(false);
    updateBookmarkGridHeightLock();
    updateBookmarkSectionPosition(layoutOptions);
  }

  function renderBookmarks(items: BookmarkItem[] | null | undefined): void {
    const normalizedItems = Array.isArray(items) ? items : [];
    const isAtRoot = String(pageState.bookmarkCurrentFolderId || '') === String(pageState.bookmarkRootFolderId || '1');
    const keepEmptyRootVisibleForDrag = Boolean(
      isAtRoot &&
      normalizedItems.length === 0 &&
      ((pageState.bookmarkDragState && pageState.bookmarkDragState.isDragging) ||
        isShortcutDragActive() || isRecentCardDragActive())
    );
    if (pageState.bookmarkGrid) {
      if (keepEmptyRootVisibleForDrag) {
        pageState.bookmarkGrid.setAttribute('data-bookmark-empty-drop-surface', 'true');
      } else {
        pageState.bookmarkGrid.removeAttribute('data-bookmark-empty-drop-surface');
      }
    }
    const renderResult = getBookmarksView().render(normalizedItems, {
      signature: pageState.bookmarkRenderSignature,
      folderId: pageState.bookmarkCurrentFolderId,
      rootFolderId: pageState.bookmarkRootFolderId,
      viewMode: settings.get(bookmarkViewMode),
      menuMode: settings.get(bookmarkViewMode) === 'list' || isBookmarkTopbarMode()
    });
    if (pageState.shortcutDragState && pageState.shortcutDragState.isDragging &&
        pageState.shortcutDragState.folderSwitchPendingId === String(pageState.bookmarkCurrentFolderId || '')) {
      pageState.shortcutDragState.folderSwitchPendingId = '';
      scheduleShortcutDragMove(pageState.shortcutDragState, pageState.shortcutDragState.pendingPointerX, pageState.shortcutDragState.pendingPointerY);
    }
    resumeRecentCardDragAfterFolderSwitch(pageState.bookmarkCurrentFolderId);
    if (pageState.bookmarkDragState &&
        pageState.bookmarkDragState.isDragging &&
        pageState.bookmarkDragState.folderSwitchPendingId ===
          String(pageState.bookmarkCurrentFolderId || '')) {
      const activeDragState = pageState.bookmarkDragState;
      activeDragState.folderSwitchPendingId = '';
      updateBookmarkDragLayoutCache(activeDragState);
      setBookmarkDragCardTransform(
        activeDragState,
        Number(activeDragState.pendingPointerX),
        Number(activeDragState.pendingPointerY)
      );
      scheduleBookmarkDragMove(
        activeDragState,
        Number(activeDragState.pendingPointerX),
        Number(activeDragState.pendingPointerY)
      );
    }
    syncOpenBookmarkCascadeAnchorVisual();
    if (!renderResult.changed) {
      if (normalizedItems.length === 0) {
        showEmptyBookmarkRoot(!isAtRoot || keepEmptyRootVisibleForDrag, keepEmptyRootVisibleForDrag);
      } else {
        setBookmarkSurfaceVisible(true);
        updateBookmarkGridHeightLock();
        updateBookmarkSectionPosition();
      }
      updateBookmarkPagerState();
      return;
    }
    pageState.bookmarkRenderSignature = renderResult.signature;
    if (normalizedItems.length === 0) {
      showEmptyBookmarkRoot(!isAtRoot || keepEmptyRootVisibleForDrag, keepEmptyRootVisibleForDrag);
      updateBookmarkPagerState();
      return;
    }
    setBookmarkSurfaceVisible(true);
    updateBookmarkPagerState();
    updateBookmarkGridHeightLock();
    updateBookmarkSectionPosition();
  }

  function renderRecentSites(items: RecentSite[] | null | undefined): void {
    const sourceItems = Array.isArray(items) ? items : [];
    const resolvedHiddenUrls = new Set<string>();
    sourceItems.forEach((item) => {
      const normalizedItem = normalizeRecentSiteRecord(item);
      if (!normalizedItem) {
        return;
      }
      const key = getRecentSiteUrlKey(normalizedItem);
      if (!key) {
        return;
      }
      const hiddenEntry = getHiddenRecentSites().find((entry) => entry && entry.url === key);
      if (!hiddenEntry) {
        return;
      }
      if ((Number(normalizedItem.lastVisitTime) || 0) > (Number(hiddenEntry.lastVisitTime) || 0)) {
        resolvedHiddenUrls.add(key);
      }
    });
    if (resolvedHiddenUrls.size > 0) {
      void writeHiddenRecentSites(
        getHiddenRecentSites().filter((entry) => entry && !resolvedHiddenUrls.has(entry.url))
      );
    }
    const normalizedSourceItems = sourceItems
      .filter((item) => {
        const url = item && item.url ? String(item.url) : '';
        return !shouldExcludeFromRecentSites(url) && !isRecentSiteHidden(item);
      });
    pageState.recentSourceItems = normalizedSourceItems.slice();
    const mergedItems = mergeRecentSitesWithPinned(normalizedSourceItems, getRecentLimit());
    const renderResult = getRecentSitesView().render(mergedItems, {
      signature: pageState.recentRenderSignature
    });
    if (!renderResult.changed) {
      if (mergedItems.length === 0) {
        setContentSectionVisible(recentSection, false);
      } else {
        setContentSectionVisible(recentSection, true);
      }
      updateBookmarkSectionPosition();
      return;
    }
    pageState.recentRenderSignature = renderResult.signature;
    if (mergedItems.length === 0) {
      setContentSectionVisible(recentSection, false);
      updateBookmarkSectionPosition();
      return;
    }
    setContentSectionVisible(recentSection, true);
    updateBookmarkSectionPosition();
  }

  function markBookmarkDataDirty(): void {
    bookmarkDataDirty = true;
  }

  function markBookmarkTreeDirty(options?: { preserveCascadeOpen?: boolean; skipRuntimeInvalidate?: boolean }): void {
    const preserveCascadeOpen = Boolean(options && options.preserveCascadeOpen);
    bookmarkDataDirty = true;
    if (!options || options.skipRuntimeInvalidate !== true) {
      bookmarksRuntime.invalidate();
    }
    if (!preserveCascadeOpen) {
      closeBookmarkCascadeMenu();
    }
  }

  function markRecentDataDirty(): void {
    recentDataDirty = true;
  }

  function loadBookmarks(options?: SectionLoadOptions): Promise<void> {
    const config = options || {};
    const requestedSectionDataRevision = Number.isFinite(Number(config.sectionDataRevision))
      ? Number(config.sectionDataRevision)
      : pageState.sectionDataRevision;
    if (!pageState.initialThemeApplied) {
      return followTheme().then(() => loadBookmarks({
        ...config,
        sectionDataRevision: requestedSectionDataRevision
      }));
    }
    const forceReload = Boolean(config.force);
    const skipFaviconWait = Boolean(config.skipFaviconWait);
    if (!skipFaviconWait && !areFaviconRenderCachesReady()) {
      const waitMs = forceReload ? Math.min(80, FAVICON_CACHE_BOOT_WAIT_MS) : FAVICON_CACHE_BOOT_WAIT_MS;
      return waitForFaviconRenderCaches(waitMs).then(() => (
        loadBookmarks({
          ...config,
          force: forceReload,
          skipFaviconWait: true,
          sectionDataRevision: requestedSectionDataRevision
        })
      ));
    }
    if (!forceReload && !bookmarkDataDirty && pageState.bookmarkLoadedOnce) {
      updateBookmarkSectionPosition();
      return Promise.resolve();
    }
    const requestToken = ++bookmarkLoadToken;
    if (!preview.get(bookmarkCount) || preview.get(bookmarkCount) <= 0) {
      closeBookmarkCascadeMenu();
      pageState.bookmarkAllItems = [];
      pageState.bookmarkRootTotalCount = 0;
      pageState.bookmarkRootVisibleCount = 0;
      pageState.bookmarkCurrentPage = 0;
      pageState.bookmarkRenderSignature = '';
      getBookmarksView().clear();
      setBookmarkSurfaceVisible(false);
      bookmarkDataDirty = false;
      pageState.bookmarkLoadedOnce = true;
      updateBookmarkSectionPosition();
      return Promise.resolve();
    }
    return getTopBookmarks(0, pageState.bookmarkCurrentFolderId).then((items) => {
      if (requestToken !== bookmarkLoadToken ||
          requestedSectionDataRevision !== pageState.sectionDataRevision) {
        return;
      }
      if (!preview.get(bookmarkCount) || preview.get(bookmarkCount) <= 0) {
        closeBookmarkCascadeMenu();
        pageState.bookmarkAllItems = [];
        pageState.bookmarkRootTotalCount = 0;
        pageState.bookmarkRootVisibleCount = 0;
        pageState.bookmarkCurrentPage = 0;
        pageState.bookmarkRenderSignature = '';
        getBookmarksView().clear();
        setBookmarkSurfaceVisible(false);
        bookmarkDataDirty = false;
        pageState.bookmarkLoadedOnce = true;
        updateBookmarkSectionPosition();
        return;
      }
      pageState.bookmarkAllItems = Array.isArray(items) ? items : [];
      const isAtRoot = String(pageState.bookmarkCurrentFolderId || '') === String(pageState.bookmarkRootFolderId || '1');
      if (isAtRoot) {
        pageState.bookmarkRootTotalCount = pageState.bookmarkAllItems.length;
        pageState.bookmarkRootVisibleCount = Math.min(getBookmarkLimit(), pageState.bookmarkAllItems.length);
      }
      const pageCount = getBookmarkPageCount();
      if (pageState.bookmarkCurrentPage > (pageCount - 1)) {
        pageState.bookmarkCurrentPage = pageCount - 1;
      }
      if (pageState.bookmarkCurrentPage < 0) {
        pageState.bookmarkCurrentPage = 0;
      }
      updateBookmarkHeader();
      renderCurrentBookmarkPage();
      playPendingBookmarkLayoutAnimation();
      if (pageState.newtabShortcuts.some((shortcut) => shortcut.type === 'folder')) {
        renderShortcuts();
      }
      bookmarkDataDirty = false;
      pageState.bookmarkLoadedOnce = true;
    });
  }

  function loadRecentSites(options?: SectionLoadOptions): Promise<void> {
    const config = options || {};
    const requestedSectionDataRevision = Number.isFinite(Number(config.sectionDataRevision))
      ? Number(config.sectionDataRevision)
      : pageState.sectionDataRevision;
    if (!pageState.initialThemeApplied) {
      return followTheme().then(() => loadRecentSites({
        ...config,
        sectionDataRevision: requestedSectionDataRevision
      }));
    }
    const forceReload = Boolean(config.force);
    const skipFaviconWait = Boolean(config.skipFaviconWait);
    if (!skipFaviconWait && !areFaviconRenderCachesReady()) {
      const waitMs = forceReload ? Math.min(80, FAVICON_CACHE_BOOT_WAIT_MS) : FAVICON_CACHE_BOOT_WAIT_MS;
      return waitForFaviconRenderCaches(waitMs).then(() => (
        loadRecentSites({
          ...config,
          force: forceReload,
          skipFaviconWait: true,
          sectionDataRevision: requestedSectionDataRevision
        })
      ));
    }
    if (!forceReload && !recentDataDirty && pageState.recentLoadedOnce) {
      updateBookmarkSectionPosition();
      return Promise.resolve();
    }
    const requestToken = ++recentLoadToken;
    const recentSourceLimit = getRecentSourceLimit();
    if (!recentSourceLimit || recentSourceLimit <= 0) {
      pageState.recentRenderSignature = '';
      pageState.recentSourceItems = [];
      getRecentSitesView().clear();
      setContentSectionVisible(recentSection, false);
      recentDataDirty = false;
      pageState.recentLoadedOnce = true;
      updateBookmarkSectionPosition();
      return Promise.resolve();
    }
    return getRecentSites(recentSourceLimit + MAX_PINNED_RECENT_SITES, settings.get(recentMode)).then((items) => {
      if (requestToken !== recentLoadToken ||
          requestedSectionDataRevision !== pageState.sectionDataRevision) {
        return;
      }
      const normalizedItems = Array.isArray(items) ? items : [];
      renderRecentSites(normalizedItems);
      recentDataDirty = false;
      pageState.recentLoadedOnce = true;
    });
  }

  function handleRecentVisibilityChange(): void {
    if (document.visibilityState !== 'visible') {
      return;
    }
    const shouldReloadRecent = recentDataDirty || !pageState.recentLoadedOnce;
    const shouldReloadBookmarks = bookmarkDataDirty || !pageState.bookmarkLoadedOnce;
    if (shouldReloadRecent || shouldReloadBookmarks) {
      beginSearchEntryRestoreLayoutLock();
    }
    if (shouldReloadRecent) {
      void loadRecentSites();
    }
    if (shouldReloadBookmarks) {
      void loadBookmarks();
    }
  }

  function forceReloadRecentSitesForI18n(): void {
    pageState.recentRenderSignature = '';
    pageState.bookmarkRenderSignature = '';
    markRecentDataDirty();
    markBookmarkDataDirty();
    void loadRecentSites();
    void loadBookmarks();
  }


  // Settings and the worker ask an open page to load a section again.
  if (chrome && chrome.runtime && chrome.runtime.onMessage && typeof chrome.runtime.onMessage.addListener === 'function') {
    chrome.runtime.onMessage.addListener((message: unknown) => {
      if (!isRecord(message) || message.action !== 'lumno:newtab-refresh-sections') {
        return;
      }
      const section = message.section || 'all';
      if (section === 'recent' || section === 'all') {
        markRecentDataDirty();
        void loadRecentSites({ force: true });
      }
      if (section === 'bookmarks' || section === 'all') {
        markBookmarkDataDirty();
        void loadBookmarks({ force: true });
      }
    });
  }
  return {
    renderBookmarks,
    renderRecentSites,
    markBookmarkDataDirty,
    markBookmarkTreeDirty,
    markRecentDataDirty,
    loadBookmarks,
    loadRecentSites,
    handleRecentVisibilityChange,
    forceReloadRecentSitesForI18n
  };
}

type SectionLoaders = ReturnType<typeof createSectionLoaders>;

export { createSectionLoaders };
export type { SectionLoadOptions, SectionLoaders, SectionLoadersDeps, SectionLoadersState };
