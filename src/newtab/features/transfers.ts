// Moves between the bookmarks and the shortcuts, and the bookmark moves
// with their undo and redo.
import * as BOOKMARK_SHORTCUT_TRANSFER from '../bookmarks/bookmark-shortcut-transfer';
import * as BOOKMARK_MOVE_ACTIONS from '../bookmarks/bookmark-move-actions';
import type { PageContext } from '../app/context';
import type { ShellFeature } from './shell';
import type { BookmarkStoreFeature } from './bookmark-store';
import type { ShortcutStoreFeature } from './shortcut-store';

interface TransfersFeatureDeps {
  shell: ShellFeature;
  bookmarkStore: BookmarkStoreFeature;
  shortcutStore: ShortcutStoreFeature;
}

function createTransfersFeature(ctx: PageContext, deps: TransfersFeatureDeps) {
  const { formatMessage, t } = ctx;
  const { historyLock, showToast } = deps.shell;
  const {
    bookmarkLayoutAnimation,
    bookmarkMoveHistory,
    bookmarkParts,
    bookmarksRuntime,
    bookmarksShown
  } = deps.bookmarkStore;
  const {
    applyShortcutGroupDeleteRecord,
    getFolderItemIcon,
    getShortcutFolderId,
    getShortcutGroups,
    getShortcutStoreOptions,
    isWebDavBackingUpShortcuts,
    persistShortcuts,
    refreshShortcutFolderReferences,
    shortcutFolderRuntime,
    shortcutList,
    updateFolderItemIcons
  } = deps.shortcutStore;

  const {
    hasShortcutForBookmarkFolder,
    addBookmarkFolderToShortcuts,
    moveBookmarkToShortcuts,
    applyBookmarkShortcutTransfer,
    applyShortcutStack
  } = BOOKMARK_SHORTCUT_TRANSFER.createBookmarkShortcutTransfer({
    historyLock,
    bookmarkParts,
    shortcutList,
    bookmarksRuntime,
    getShortcutStoreOptions,
    getShortcutFolderId,
    getShortcutGroups,
    bookmarkMoveHistory,
    shortcutFolderRuntime,
    getFolderItemIcon,
    updateFolderItemIcons,
    persistShortcuts,
    refreshShortcutFolderReferences,
    isWebDavBackingUpShortcuts,
    layoutAnimation: bookmarkLayoutAnimation,
    showToast,
    t,
    formatMessage
  });
  const {
    deleteBookmarkFromContextTarget,
    persistBookmarkDragOrder,
    persistBookmarkCrossLevelMove,
    performBookmarkMoveHistoryAction
  } = BOOKMARK_MOVE_ACTIONS.createBookmarkMoveActions({
    historyLock,
    bookmarkParts,
    bookmarksShown,
    shortcutList,
    bookmarksRuntime,
    bookmarkMoveHistory,
    transfer: { applyBookmarkShortcutTransfer, applyShortcutStack },
    applyShortcutGroupDeleteRecord,
    persistShortcuts,
    refreshShortcutFolderReferences,
    layoutAnimation: bookmarkLayoutAnimation,
    showToast,
    t,
    formatMessage
  });

  return {
    addBookmarkFolderToShortcuts,
    applyBookmarkShortcutTransfer,
    applyShortcutStack,
    deleteBookmarkFromContextTarget,
    hasShortcutForBookmarkFolder,
    moveBookmarkToShortcuts,
    performBookmarkMoveHistoryAction,
    persistBookmarkCrossLevelMove,
    persistBookmarkDragOrder
  };
}

type TransfersFeature = ReturnType<typeof createTransfersFeature>;

export { createTransfersFeature };
export type { TransfersFeature };
