// Reloads the recent and bookmark sections when tabs, history or
// bookmarks change elsewhere, once the page is visible again.
import type { BookmarksRuntime } from './bookmarks/bookmarks-runtime';
import type { RecentSourceReads } from './recent/recent-source-reads';
import type { ShortcutList } from './shortcuts/shortcut-list';
import type { BookmarkSectionParts } from './bookmarks/bookmark-section-parts';


interface SectionReloadDeps {
  loadRecentSites(options: { force: boolean }): unknown;
  loadBookmarks(options: { force: boolean }): unknown;
  // The startup reads stop being shared once the history changes.
  recentSourceReads: Pick<RecentSourceReads, 'release'>;
  markRecentDataDirty(): void;
  bookmarksRuntime: Pick<BookmarksRuntime, 'subscribe'>;
  refreshShortcutFolderReferences(): void;
  scheduleFolderColorSync(): void;
  markBookmarkTreeDirty(options: { preserveCascadeOpen: boolean; skipRuntimeInvalidate: boolean }): void;
  bookmarkMoveHistory: { clear(): void };
  refreshOpenBookmarkCascadeMenu(): void;
  shortcutList: Pick<ShortcutList, 'items'>;
  bookmarkParts: Pick<BookmarkSectionParts, 'cascade'>;
}

function createSectionReload(deps: SectionReloadDeps) {
  const {
    bookmarkParts,
    shortcutList,
    loadRecentSites,
    loadBookmarks,
    recentSourceReads,
    markRecentDataDirty,
    bookmarksRuntime,
    refreshShortcutFolderReferences,
    scheduleFolderColorSync,
    markBookmarkTreeDirty,
    bookmarkMoveHistory,
    refreshOpenBookmarkCascadeMenu
  } = deps;


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
        recentSourceReads.release();
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
        bookmarkParts.cascade &&
        typeof bookmarkParts.cascade.isOpen === 'function' &&
        bookmarkParts.cascade.isOpen()
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
export type { SectionReload, SectionReloadDeps };
