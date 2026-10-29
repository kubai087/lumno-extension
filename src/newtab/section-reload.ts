// Reloads the recent and bookmark sections when tabs, history or
// bookmarks change elsewhere, once the page is visible again.
import type { BookmarksRuntime } from './bookmarks/bookmarks-runtime';
import type { ShortcutList } from './shortcuts/shortcut-list';

interface SectionReloadState {
  bookmarkCascadeRuntime: { isOpen?: () => boolean } | null;
}

interface SectionReloadDeps {
  loadRecentSites(options: { force: boolean }): unknown;
  loadBookmarks(options: { force: boolean }): unknown;
  releaseStartupRecentSourceReads(): void;
  markRecentDataDirty(): void;
  bookmarksRuntime: Pick<BookmarksRuntime, 'subscribe'>;
  refreshShortcutFolderReferences(): void;
  scheduleFolderColorSync(): void;
  markBookmarkTreeDirty(options: { preserveCascadeOpen: boolean; skipRuntimeInvalidate: boolean }): void;
  bookmarkMoveHistory: { clear(): void };
  refreshOpenBookmarkCascadeMenu(): void;
  shortcutList: Pick<ShortcutList, 'items'>;
  pageState: SectionReloadState;
}

function createSectionReload(deps: SectionReloadDeps) {
  const {
    shortcutList,
    loadRecentSites,
    loadBookmarks,
    releaseStartupRecentSourceReads,
    markRecentDataDirty,
    bookmarksRuntime,
    refreshShortcutFolderReferences,
    scheduleFolderColorSync,
    markBookmarkTreeDirty,
    bookmarkMoveHistory,
    refreshOpenBookmarkCascadeMenu
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  const NEWTAB_EXTERNAL_CHANGE_DEBOUNCE_MS = 120;

  let recentExternalChangeTimer = 0;
  let bookmarkExternalChangeTimer = 0;
  function scheduleRecentReloadIfVisible(): void {
    if (document.visibilityState !== 'visible') {
      return;
    }
    if (recentExternalChangeTimer) {
      window.clearTimeout(recentExternalChangeTimer);
    }
    recentExternalChangeTimer = window.setTimeout(() => {
      recentExternalChangeTimer = 0;
      if (document.visibilityState === 'visible') {
        loadRecentSites({ force: true });
      }
    }, NEWTAB_EXTERNAL_CHANGE_DEBOUNCE_MS);
  }

  function scheduleBookmarkReloadIfVisible(): void {
    if (document.visibilityState !== 'visible') {
      return;
    }
    if (bookmarkExternalChangeTimer) {
      window.clearTimeout(bookmarkExternalChangeTimer);
    }
    bookmarkExternalChangeTimer = window.setTimeout(() => {
      bookmarkExternalChangeTimer = 0;
      if (document.visibilityState === 'visible') {
        loadBookmarks({ force: true });
      }
    }, NEWTAB_EXTERNAL_CHANGE_DEBOUNCE_MS);
  }

  function bindRecentAndBookmarkChangeListeners(): void {
    if (chrome.history && chrome.history.onVisited && chrome.history.onVisited.addListener) {
      chrome.history.onVisited.addListener(() => {
        releaseStartupRecentSourceReads();
        markRecentDataDirty();
        scheduleRecentReloadIfVisible();
      });
    }
    bookmarksRuntime.subscribe((change) => {
      // Folder entries remain useful even when the bookmarks section is hidden.
      if (shortcutList.items.some((shortcut) => shortcut.type === 'folder')) {
        refreshShortcutFolderReferences();
      }
      scheduleFolderColorSync();
      const cascadeOpen = Boolean(
        pageState.bookmarkCascadeRuntime &&
        typeof pageState.bookmarkCascadeRuntime.isOpen === 'function' &&
        pageState.bookmarkCascadeRuntime.isOpen()
      );
      if (change.isControlled) {
        markBookmarkTreeDirty({
          preserveCascadeOpen: cascadeOpen,
          skipRuntimeInvalidate: true
        });
        return;
      }
      if (change.invalidatesHistory) {
        bookmarkMoveHistory.clear();
      }
      const shouldRefreshOpenCascade = change.shouldRefreshCascade && cascadeOpen;
      markBookmarkTreeDirty({
        preserveCascadeOpen: shouldRefreshOpenCascade,
        skipRuntimeInvalidate: true
      });
      scheduleBookmarkReloadIfVisible();
      if (shouldRefreshOpenCascade) {
        refreshOpenBookmarkCascadeMenu();
      }
    });
  }

  bindRecentAndBookmarkChangeListeners();

  return {
    scheduleRecentReloadIfVisible,
    scheduleBookmarkReloadIfVisible
  };
}

type SectionReload = ReturnType<typeof createSectionReload>;

export { createSectionReload };
export type { SectionReload, SectionReloadDeps, SectionReloadState };
