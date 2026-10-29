// Loading and rendering the bookmark and recent-site sections.
import { queryHtmlElement } from '../shared/dom-lookup';
import type { AppearanceModes } from './appearance-modes';
import type { BookmarkCascadeActions } from './bookmarks/bookmark-cascade-actions';
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
import type { ShortcutDrag } from './shortcuts/shortcut-drag';
import type { ShortcutsController } from './shortcuts/shortcuts-controller';
import type { PageFavicons } from './theme/page-favicons';
import type { UrlPolicy } from './url-policy';
import type { RecentSite } from '../domain/recent-sites-store';
import type { SettingPreview } from './setting-preview';
import type { SettingsStore } from '../platform/settings-store';
import { bookmarkCount, bookmarkViewMode } from '../domain/settings/bookmarks';
import { recentMode } from '../domain/settings/recent-sites';
import { isRecord } from '../platform/storage-call';
import { FAVICON_CACHE_BOOT_WAIT_MS, MAX_PINNED_RECENT_SITES } from './newtab-config';
import type { AppliedThemeMode } from './theme/applied-theme-mode';
import type { ShortcutList } from './shortcuts/shortcut-list';
import type { RecentSitesShown } from './recent/recent-sites-shown';
import type { BookmarksShown } from './bookmarks/bookmarks-shown';
import type { BookmarkSectionParts } from './bookmarks/bookmark-section-parts';
import type { DragSessions } from './drag-sessions';

interface SectionLoadOptions {
  force?: boolean;
  skipFaviconWait?: boolean;
  // The section data revision the load was asked for; a newer one drops it.
  sectionDataRevision?: number;
}


interface SectionLoadersDeps extends
  Pick<ShortcutDrag, 'scheduleShortcutDragMove'>,
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
  resumeRecentCardDragAfterFolderSwitch: RecentCardDrag['resumeRecentCardDragAfterFolderSwitch'];
  isBookmarkTopbarMode: SectionHeaders['isBookmarkTopbarMode'];
  setBookmarkSurfaceVisible: SectionHeaders['setBookmarkSurfaceVisible'];
  updateBookmarkHeader: SectionHeaders['updateBookmarkHeader'];
  recentSection: HTMLElement | null;
  bookmarksRuntime: Pick<BookmarksRuntime, 'invalidate'>;
  appliedTheme: Pick<AppliedThemeMode, 'applied'>;
  shortcutList: Pick<ShortcutList, 'items'>;
  recentShown: Pick<RecentSitesShown, 'drawn' | 'forgetSignature' | 'loadedOnce' | 'markLoaded' | 'setItems' | 'signature'>;
  bookmarksShown: Pick<BookmarksShown, 'allItems' | 'clear' | 'currentFolderId' | 'currentPage' | 'drawn' | 'forgetSignature' | 'loadedOnce' | 'markLoaded' | 'renderSignature' | 'rootFolderId' | 'setItems' | 'setRootCounts' | 'showPage'>;
  bookmarkParts: Pick<BookmarkSectionParts, 'view'>;
  bookmarkGrid: HTMLElement;
  dragSessions: Pick<DragSessions, 'bookmark' | 'recentCardDragging' | 'shortcut' | 'shortcutDragging'>;
  recentSitesView: Pick<RecentSitesViewController, 'render' | 'clear'>;
}

function createSectionLoaders(deps: SectionLoadersDeps) {
  const {
    dragSessions,
    bookmarkGrid,
    bookmarkParts,
    bookmarksShown,
    recentShown,
    shortcutList,
    appliedTheme,
    settings,
    preview,
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
    beginSearchEntryRestoreLayoutLock,
    recentSitesView
  } = deps;

  // Bumped by the startup pass; loads asked for under an older one are dropped when they land.
  let sectionDataRevision = 0;

  let bookmarkLoadToken = 0;
  let bookmarkDataDirty = true;
  let recentLoadToken = 0;
  let recentDataDirty = true;

  // A drag shows the empty bookmarks bar as a drop target. The search box
  // holds still meanwhile, so the dock grows over free space, and the bar
  // stays hidden when it would cover shortcuts: the shortcut area would
  // then shrink and scroll under the pointer.
  function getBookmarksView(): Pick<BookmarksViewController, 'render' | 'clear'> {
    if (!bookmarkParts.view) {
      throw new Error('Bookmarks view unavailable');
    }
    return bookmarkParts.view;
  }

  function isDragActive(): boolean {
    return Boolean((dragSessions.bookmark && dragSessions.bookmark.isDragging) ||
      dragSessions.shortcutDragging || dragSessions.recentCardDragging);
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
    if (bookmarkGrid) {
      bookmarkGrid.removeAttribute('data-bookmark-empty-drop-surface');
    }
    setBookmarkSurfaceVisible(false);
    updateBookmarkGridHeightLock();
    updateBookmarkSectionPosition(layoutOptions);
  }

  function renderBookmarks(items: BookmarkItem[] | null | undefined): void {
    const normalizedItems = Array.isArray(items) ? items : [];
    const isAtRoot = String(bookmarksShown.currentFolderId || '') === String(bookmarksShown.rootFolderId || '1');
    const keepEmptyRootVisibleForDrag = Boolean(
      isAtRoot &&
      normalizedItems.length === 0 &&
      ((dragSessions.bookmark && dragSessions.bookmark.isDragging) ||
        dragSessions.shortcutDragging || dragSessions.recentCardDragging)
    );
    if (bookmarkGrid) {
      if (keepEmptyRootVisibleForDrag) {
        bookmarkGrid.setAttribute('data-bookmark-empty-drop-surface', 'true');
      } else {
        bookmarkGrid.removeAttribute('data-bookmark-empty-drop-surface');
      }
    }
    const renderResult = getBookmarksView().render(normalizedItems, {
      signature: bookmarksShown.renderSignature,
      folderId: bookmarksShown.currentFolderId,
      rootFolderId: bookmarksShown.rootFolderId,
      viewMode: settings.get(bookmarkViewMode),
      menuMode: settings.get(bookmarkViewMode) === 'list' || isBookmarkTopbarMode()
    });
    if (dragSessions.shortcut && dragSessions.shortcut.isDragging &&
        dragSessions.shortcut.folderSwitchPendingId === String(bookmarksShown.currentFolderId || '')) {
      dragSessions.shortcut.folderSwitchPendingId = '';
      scheduleShortcutDragMove(dragSessions.shortcut, dragSessions.shortcut.pendingPointerX, dragSessions.shortcut.pendingPointerY);
    }
    resumeRecentCardDragAfterFolderSwitch(bookmarksShown.currentFolderId);
    if (dragSessions.bookmark &&
        dragSessions.bookmark.isDragging &&
        dragSessions.bookmark.folderSwitchPendingId ===
          String(bookmarksShown.currentFolderId || '')) {
      const activeDragState = dragSessions.bookmark;
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
    bookmarksShown.drawn(renderResult.signature);
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
    recentShown.setItems(normalizedSourceItems.slice());
    const mergedItems = mergeRecentSitesWithPinned(normalizedSourceItems, getRecentLimit());
    const renderResult = recentSitesView.render(mergedItems, {
      signature: recentShown.signature
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
    recentShown.drawn(renderResult.signature);
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
      : sectionDataRevision;
    if (!appliedTheme.applied) {
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
    if (!forceReload && !bookmarkDataDirty && bookmarksShown.loadedOnce) {
      updateBookmarkSectionPosition();
      return Promise.resolve();
    }
    const requestToken = ++bookmarkLoadToken;
    if (!preview.get(bookmarkCount) || preview.get(bookmarkCount) <= 0) {
      closeBookmarkCascadeMenu();
      bookmarksShown.clear();
      getBookmarksView().clear();
      setBookmarkSurfaceVisible(false);
      bookmarkDataDirty = false;
      bookmarksShown.markLoaded();
      updateBookmarkSectionPosition();
      return Promise.resolve();
    }
    return getTopBookmarks(0, bookmarksShown.currentFolderId).then((items) => {
      if (requestToken !== bookmarkLoadToken ||
          requestedSectionDataRevision !== sectionDataRevision) {
        return;
      }
      if (!preview.get(bookmarkCount) || preview.get(bookmarkCount) <= 0) {
        closeBookmarkCascadeMenu();
        bookmarksShown.clear();
        getBookmarksView().clear();
        setBookmarkSurfaceVisible(false);
        bookmarkDataDirty = false;
        bookmarksShown.markLoaded();
        updateBookmarkSectionPosition();
        return;
      }
      bookmarksShown.setItems(Array.isArray(items) ? items : []);
      const isAtRoot = String(bookmarksShown.currentFolderId || '') === String(bookmarksShown.rootFolderId || '1');
      if (isAtRoot) {
        bookmarksShown.setRootCounts(
          bookmarksShown.allItems.length,
          Math.min(getBookmarkLimit(), bookmarksShown.allItems.length)
        );
      }
      const pageCount = getBookmarkPageCount();
      if (bookmarksShown.currentPage > (pageCount - 1)) {
        bookmarksShown.showPage(pageCount - 1);
      }
      if (bookmarksShown.currentPage < 0) {
        bookmarksShown.showPage(0);
      }
      updateBookmarkHeader();
      renderCurrentBookmarkPage();
      playPendingBookmarkLayoutAnimation();
      if (shortcutList.items.some((shortcut) => shortcut.type === 'folder')) {
        renderShortcuts();
      }
      bookmarkDataDirty = false;
      bookmarksShown.markLoaded();
    });
  }

  function loadRecentSites(options?: SectionLoadOptions): Promise<void> {
    const config = options || {};
    const requestedSectionDataRevision = Number.isFinite(Number(config.sectionDataRevision))
      ? Number(config.sectionDataRevision)
      : sectionDataRevision;
    if (!appliedTheme.applied) {
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
    if (!forceReload && !recentDataDirty && recentShown.loadedOnce) {
      updateBookmarkSectionPosition();
      return Promise.resolve();
    }
    const requestToken = ++recentLoadToken;
    const recentSourceLimit = getRecentSourceLimit();
    if (!recentSourceLimit || recentSourceLimit <= 0) {
      recentShown.forgetSignature();
      recentShown.setItems([]);
      recentSitesView.clear();
      setContentSectionVisible(recentSection, false);
      recentDataDirty = false;
      recentShown.markLoaded();
      updateBookmarkSectionPosition();
      return Promise.resolve();
    }
    return getRecentSites(recentSourceLimit + MAX_PINNED_RECENT_SITES, settings.get(recentMode)).then((items) => {
      if (requestToken !== recentLoadToken ||
          requestedSectionDataRevision !== sectionDataRevision) {
        return;
      }
      const normalizedItems = Array.isArray(items) ? items : [];
      renderRecentSites(normalizedItems);
      recentDataDirty = false;
      recentShown.markLoaded();
    });
  }

  function handleRecentVisibilityChange(): void {
    if (document.visibilityState !== 'visible') {
      return;
    }
    const shouldReloadRecent = recentDataDirty || !recentShown.loadedOnce;
    const shouldReloadBookmarks = bookmarkDataDirty || !bookmarksShown.loadedOnce;
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
    recentShown.forgetSignature();
    bookmarksShown.forgetSignature();
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

  // One authoritative pass once every layout setting has settled, so cached
  // or default geometry never shows and then moves when the data arrives.
  function startSectionDataPass(): { recent: Promise<void>; bookmarks: Promise<void> } {
    sectionDataRevision += 1;
    return {
      recent: loadRecentSites({ force: true, sectionDataRevision }),
      bookmarks: loadBookmarks({ force: true, sectionDataRevision })
    };
  }
  return {
    startSectionDataPass,
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
export type { SectionLoadOptions, SectionLoaders, SectionLoadersDeps };
