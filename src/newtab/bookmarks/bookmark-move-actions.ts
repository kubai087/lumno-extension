// The bookmark changes the move history records, and undoing or redoing
// each: a reorder or a move across folders after a drag, a delete from a
// context menu, and the shortcut changes that share the same history.
import type { DragDropTarget } from '../cross-surface-drag';
import type { FormatMessage, ShowToast, Translate } from '../newtab-types';
import type { PersistShortcuts, ShortcutIconChange } from '../shortcuts/shortcut-types';
import type { CascadeRefreshOptions } from './bookmark-cascade-menu';
import type { BookmarkDragSession } from './bookmark-drag';
import { getMoveDestination, getUndoShortcutLabels } from './bookmark-drag-rules';
import type { BookmarkLocation, BookmarkMoveHistory, ShortcutGroupDeleteRecord } from './bookmark-move-history';
import type { BookmarkShortcutTransfer } from './bookmark-shortcut-transfer';
import type { BookmarkNode } from './bookmarks-store';
import type { BookmarksRuntime } from './bookmarks-runtime';
import { isShortcutFolder } from '../../domain/shortcuts/normalize';
import * as NEWTAB_BOOKMARK_MOVE_HISTORY from './bookmark-move-history';
import * as NEWTAB_CROSS_SURFACE_DRAG from '../cross-surface-drag';
import { DEFAULT_MAX_SHORTCUTS } from '../../domain/shortcuts/constants';
import type { ShortcutList } from '../shortcuts/shortcut-list';
import type { BookmarksShown } from './bookmarks-shown';
import type { BookmarkSectionParts } from './bookmark-section-parts';

interface BookmarkMoveActionsState {
  // While an undoable change runs, no other may start.
  bookmarkMoveHistoryBusy: boolean;
}

interface BookmarkMoveActionsDeps {
  bookmarksRuntime: BookmarksRuntime;
  bookmarkMoveHistory: BookmarkMoveHistory;
  transfer: Pick<BookmarkShortcutTransfer, 'applyBookmarkShortcutTransfer' | 'applyShortcutStack'>;
  applyShortcutGroupDeleteRecord(record: ShortcutGroupDeleteRecord, isUndo: boolean): Promise<boolean>;
  persistShortcuts: PersistShortcuts;
  refreshShortcutFolderReferences(): Promise<unknown>;
  scheduleWallpaperAdaptiveToneUpdate(): void;
  markBookmarkTreeDirty(options?: { preserveCascadeOpen?: boolean }): void;
  loadBookmarks(options?: { force?: boolean }): unknown;
  refreshOpenBookmarkCascadeMenu(refreshOptions?: CascadeRefreshOptions): Promise<boolean>;
  // Notes where the bookmark cards are, so the next render slides them; and
  // forgets that note when the change failed.
  queueLayoutAnimation(excludedBookmarkId: unknown): void;
  dropLayoutAnimation(): void;
  showToast: ShowToast;
  t: Translate;
  formatMessage: FormatMessage;
  shortcutList: Pick<ShortcutList, 'items'>;
  bookmarksShown: Pick<BookmarksShown, 'allItems' | 'currentFolderId'>;
  bookmarkParts: Pick<BookmarkSectionParts, 'cascade'>;
  pageState: BookmarkMoveActionsState;
}

// A context menu's bookmark, to delete.
interface BookmarkDeleteTarget {
  bookmarkId: string;
  title?: string;
  parentId?: string;
  index?: number;
  sourceKind?: string;
}

function createBookmarkMoveActions(deps: BookmarkMoveActionsDeps) {
  const {
    bookmarkParts,
    bookmarksShown,
    shortcutList,
    bookmarksRuntime,
    bookmarkMoveHistory,
    transfer,
    applyShortcutGroupDeleteRecord,
    persistShortcuts,
    refreshShortcutFolderReferences,
    scheduleWallpaperAdaptiveToneUpdate,
    markBookmarkTreeDirty,
    loadBookmarks,
    refreshOpenBookmarkCascadeMenu,
    queueLayoutAnimation,
    dropLayoutAnimation,
    showToast,
    t,
    formatMessage
  } = deps;
  const { applyBookmarkShortcutTransfer, applyShortcutStack } = transfer;

  // The page state object shared with newtab.ts and the other modules.
  const pageState = deps.pageState;

  // Where the card the drag reordered sits among its folder's bookmarks.
  function getBookmarkMoveDestination(bookmarkId: unknown): BookmarkLocation | null {
    return getMoveDestination(bookmarksShown.allItems, bookmarkId, bookmarksShown.currentFolderId);
  }

  function getBookmarkDeleteRecord(target: BookmarkDeleteTarget | null) {
    if (!target || !target.bookmarkId) {
      return null;
    }
    const node = bookmarksRuntime.getNode(target.bookmarkId);
    if (!node) {
      return null;
    }
    return NEWTAB_BOOKMARK_MOVE_HISTORY.createDeleteRecord({
      bookmarkId: String(node.id || target.bookmarkId),
      title: String(node.title || target.title || ''),
      parentId: String(node.parentId || target.parentId || ''),
      index: Number.isFinite(Number(node.index)) ? Number(node.index) : target.index,
      snapshot: node
    });
  }

  function deleteBookmarkFromContextTarget(target: BookmarkDeleteTarget | null): boolean {
    if (!target || !target.bookmarkId || pageState.bookmarkMoveHistoryBusy) {
      return false;
    }
    pageState.bookmarkMoveHistoryBusy = true;
    const keepCascadeOpen = Boolean(
      target.sourceKind === 'cascade' &&
      bookmarkParts.cascade &&
      bookmarkParts.cascade.isOpen()
    );
    bookmarksRuntime.runControlledMutation(() => {
      return bookmarksRuntime.ensureReady(false).then(() => {
        const record = getBookmarkDeleteRecord(target);
        if (!record) {
          throw new Error('Bookmark snapshot is unavailable.');
        }
        queueLayoutAnimation(record.bookmarkId);
        return bookmarksRuntime.remove(record.bookmarkId, {
          recursive: !record.snapshot.url
        }).then(() => {
          bookmarkMoveHistory.push(record);
          markBookmarkTreeDirty({ preserveCascadeOpen: keepCascadeOpen });
          loadBookmarks({ force: true });
          if (keepCascadeOpen) {
            refreshOpenBookmarkCascadeMenu();
          }
          return true;
        });
      });
    }).catch((error) => {
      dropLayoutAnimation();
      console.warn('[Lumno] Failed to delete bookmark', error);
      showToast(t('bookmarks_delete_failed', 'Could not delete bookmark'), true);
    }).finally(() => {
      pageState.bookmarkMoveHistoryBusy = false;
    });
    return true;
  }

  function getBookmarkMoveRecord(
    state: BookmarkDragSession | null,
    destination: BookmarkLocation | null,
    movedNode: BookmarkNode | null
  ) {
    if (!state || !destination) {
      return null;
    }
    const movedIndex = movedNode ? Number(movedNode.index) : NaN;
    return NEWTAB_BOOKMARK_MOVE_HISTORY.createMoveRecord({
      bookmarkId: state.bookmarkId,
      title: state.itemTitle,
      from: {
        parentId: state.parentId,
        index: state.originalIndex
      },
      to: {
        parentId: String((movedNode && movedNode.parentId) || destination.parentId || ''),
        index: Number.isFinite(movedIndex) ? movedIndex : destination.index
      }
    });
  }

  function getBookmarkUndoShortcutLabel(): string {
    return getUndoShortcutLabels(navigator).undo;
  }

  function getBookmarkRedoShortcutLabel(): string {
    return getUndoShortcutLabels(navigator).redo;
  }

  function finishPersistedBookmarkMove(
    state: BookmarkDragSession,
    destination: BookmarkLocation,
    movedNode: BookmarkNode | null
  ): boolean {
    const record = getBookmarkMoveRecord(state, destination, movedNode);
    if (record) {
      bookmarkMoveHistory.push(record);
    }
    const keepCascadeOpen = Boolean(state.keepCascadeOpenAfterDrop);
    markBookmarkTreeDirty({ preserveCascadeOpen: keepCascadeOpen });
    loadBookmarks({ force: true });
    if (keepCascadeOpen) {
      refreshOpenBookmarkCascadeMenu({
        draggedBookmarkId: String(state.bookmarkId || ''),
        draggedRect: state.draggedVisualRect
      });
    }
    return true;
  }

  function persistBookmarkDragOrder(state: BookmarkDragSession): Promise<boolean> {
    if (!state || !state.bookmarkId) {
      return Promise.resolve(false);
    }
    const destination = getBookmarkMoveDestination(state.bookmarkId);
    if (!destination) {
      return Promise.resolve(false);
    }
    return bookmarksRuntime.runControlledMutation(() => {
      return bookmarksRuntime.move(state.bookmarkId, destination).then((movedNode) => {
        return finishPersistedBookmarkMove(state, destination, movedNode);
      });
    }).catch((error) => {
      console.warn('[Lumno] Failed to reorder bookmark', error);
      markBookmarkTreeDirty();
      loadBookmarks({ force: true });
      showToast(t('bookmarks_move_failed', 'Could not move bookmark'), true);
      return false;
    });
  }

  function persistBookmarkCrossLevelMove(state: BookmarkDragSession, target: DragDropTarget): Promise<boolean> {
    if (target.kind === 'blocked' || target.surface === 'shortcuts' || !target.folderId) {
      return Promise.resolve(false);
    }
    const targetFolderId = String(target.folderId);
    const targetItems = bookmarksRuntime.getFolderItems(targetFolderId);
    const rawTargetIndex = target.kind === 'insertion' && Number.isFinite(Number(target.index))
      ? Number(target.index)
      : targetItems.length;
    const shouldPreserveTargetPageSlot = target.surface === 'grid' &&
      target.preservePageSlot === true &&
      String(state.parentId || '') === targetFolderId &&
      Number(state.originalIndex) < rawTargetIndex;
    const destinationIndex = shouldPreserveTargetPageSlot
      ? NEWTAB_BOOKMARK_MOVE_HISTORY.getMoveApiDestinationIndex({
        sourceParentId: state.parentId,
        sourceIndex: state.originalIndex,
        targetParentId: targetFolderId,
        targetIndex: rawTargetIndex
      })
      : rawTargetIndex;
    const destination = {
      parentId: targetFolderId,
      index: destinationIndex
    };
    return bookmarksRuntime.runControlledMutation(() => {
      return bookmarksRuntime.move(state.bookmarkId, destination).then((movedNode) => {
        return finishPersistedBookmarkMove(state, destination, movedNode);
      });
    }).catch((error) => {
      console.warn('[Lumno] Failed to move bookmark across folders', error);
      markBookmarkTreeDirty();
      loadBookmarks({ force: true });
      showToast(t('bookmarks_move_failed', 'Could not move bookmark'), true);
      return false;
    });
  }

  function performBookmarkMoveHistoryAction(direction: 'undo' | 'redo'): boolean {
    if (pageState.bookmarkMoveHistoryBusy) {
      return false;
    }
    const isUndo = direction === 'undo';
    const record = isUndo ? bookmarkMoveHistory.peekUndo() : bookmarkMoveHistory.peekRedo();
    if (!record) {
      return false;
    }
    pageState.bookmarkMoveHistoryBusy = true;
    if (record.kind === 'shortcut-reorder') {
      const next = NEWTAB_CROSS_SURFACE_DRAG.planShortcutReorder({
        shortcuts: shortcutList.items,
        sourceOrder: isUndo ? record.toOrder : record.fromOrder,
        order: isUndo ? record.fromOrder : record.toOrder,
        groups: isUndo ? record.fromGroups : record.toGroups
      });
      if (!next) {
        pageState.bookmarkMoveHistoryBusy = false;
        showToast(t('toast_error', 'Operation failed. Please try again.'), true);
        return true;
      }
      persistShortcuts(next, '', undefined, { animateLayout: true }).then((saved) => {
        if (!saved) return;
        if (isUndo) bookmarkMoveHistory.commitUndo();
        else bookmarkMoveHistory.commitRedo();
        scheduleWallpaperAdaptiveToneUpdate();
      }).finally(() => { pageState.bookmarkMoveHistoryBusy = false; });
      return true;
    }
    if (record.kind === 'transfer') {
      queueLayoutAnimation('');
      applyBookmarkShortcutTransfer(record, isUndo).then((saved) => {
        if (!saved) return;
        if (isUndo) bookmarkMoveHistory.commitUndo();
        else bookmarkMoveHistory.commitRedo();
        if (!record.snapshot.url) {
          showToast(formatMessage(
            isUndo ? 'bookmarks_move_undone' : 'bookmarks_move_redone',
            isUndo ? 'Move undone · {shortcut} to redo' : 'Move restored · {shortcut} to undo',
            { shortcut: isUndo ? getBookmarkRedoShortcutLabel() : getBookmarkUndoShortcutLabel() }
          ));
        }
      }).finally(() => {
        pageState.bookmarkMoveHistoryBusy = false;
        if (shortcutList.items.some((item) => isShortcutFolder(item))) return refreshShortcutFolderReferences();
        return undefined;
      });
      return true;
    }
    if (record.kind === 'shortcut-stack') {
      queueLayoutAnimation('');
      applyShortcutStack(record, isUndo).then((saved) => {
        if (!saved) return;
        if (isUndo) bookmarkMoveHistory.commitUndo();
        else bookmarkMoveHistory.commitRedo();
        showToast(formatMessage(
          isUndo ? 'newtab_shortcuts_stack_undone' : 'newtab_shortcuts_stack_redone',
          isUndo ? 'Folder creation undone · {shortcut} to redo' : 'Folder created again · {shortcut} to undo',
          { shortcut: isUndo ? getBookmarkRedoShortcutLabel() : getBookmarkUndoShortcutLabel() }
        ));
      }).finally(() => {
        pageState.bookmarkMoveHistoryBusy = false;
        if (shortcutList.items.some((item) => isShortcutFolder(item))) return refreshShortcutFolderReferences();
        return undefined;
      });
      return true;
    }
    if (record.kind === 'shortcut-group-delete') {
      applyShortcutGroupDeleteRecord(record, isUndo).then((saved) => {
        if (!saved) {
          showToast(t('toast_error', 'Operation failed. Please try again.'), true);
          return;
        }
        if (isUndo) bookmarkMoveHistory.commitUndo();
        else bookmarkMoveHistory.commitRedo();
        showToast(formatMessage(
          isUndo ? 'newtab_shortcuts_group_delete_undone' : 'newtab_shortcuts_group_delete_redone',
          isUndo ? 'Group restored · {shortcut} to redo' : 'Group deleted · {shortcut} to undo',
          { shortcut: isUndo ? getBookmarkRedoShortcutLabel() : getBookmarkUndoShortcutLabel() }
        ));
      }).finally(() => { pageState.bookmarkMoveHistoryBusy = false; });
      return true;
    }
    if (record.kind === 'shortcut-delete' || record.kind === 'shortcut-add') {
      // Undoing a removal puts the shortcut back; undoing an addition takes it out.
      const restores = (record.kind === 'shortcut-delete') === isUndo;
      const snapshot = record.snapshot;
      const exists = shortcutList.items.some((item) => item.id === snapshot.id ||
        (isShortcutFolder(snapshot)
          ? !snapshot.folderRef && isShortcutFolder(item) && !item.folderRef && item.folderId === snapshot.folderId
          : !isShortcutFolder(item) && item.url === snapshot.url));
      if (restores && (exists || shortcutList.items.length >= DEFAULT_MAX_SHORTCUTS)) {
        pageState.bookmarkMoveHistoryBusy = false;
        showToast(t('toast_error', 'Operation failed. Please try again.'), true);
        return true;
      }
      const next = shortcutList.items.slice();
      if (restores) {
        next.splice(Math.min(record.index, next.length), 0, snapshot);
      } else {
        const index = next.findIndex((item) => item.id === snapshot.id);
        if (index >= 0) next.splice(index, 1);
      }
      const iconChange: ShortcutIconChange | undefined = restores && record.iconDataUrl
        ? { shortcutId: snapshot.id, action: 'replace', dataUrl: record.iconDataUrl }
        : undefined;
      const messages = record.kind === 'shortcut-add'
        ? (isUndo
          ? ['newtab_shortcuts_add_undone', 'Shortcut add undone · {shortcut} to redo']
          : ['newtab_shortcuts_add_redone', 'Shortcut added again · {shortcut} to undo'])
        : (isUndo
          ? ['newtab_shortcuts_remove_undone', 'Shortcut restored · {shortcut} to redo']
          : ['newtab_shortcuts_remove_redone', 'Shortcut removed · {shortcut} to undo']);
      persistShortcuts(next, '', iconChange, { animateLayout: true }).then((saved) => {
        if (!saved) return;
        if (isUndo) bookmarkMoveHistory.commitUndo();
        else bookmarkMoveHistory.commitRedo();
        showToast(formatMessage(messages[0], messages[1], {
          shortcut: isUndo ? getBookmarkRedoShortcutLabel() : getBookmarkUndoShortcutLabel()
        }));
      }).finally(() => { pageState.bookmarkMoveHistoryBusy = false; });
      return true;
    }
    const keepCascadeOpen = Boolean(
      bookmarkParts.cascade &&
      bookmarkParts.cascade.isOpen()
    );
    if (record.kind === 'delete') {
      queueLayoutAnimation(
        isUndo
          ? ''
          : String((record.runtime && record.runtime.currentBookmarkId) || record.bookmarkId || '')
      );
      const deleteAction = bookmarksRuntime.runControlledMutation(() => {
        return isUndo
          ? bookmarksRuntime.restore(record.snapshot, {
            parentId: record.parentId,
            index: record.index
          }).then((node) => {
            bookmarkMoveHistory.remapBookmarkId(record.bookmarkId, node && node.id);
            if (record.runtime) {
              record.runtime.currentBookmarkId = String((node && node.id) || '');
            }
          })
          : bookmarksRuntime.remove(
            bookmarkMoveHistory.resolveBookmarkId(record.bookmarkId || (record.runtime && record.runtime.currentBookmarkId)),
            { recursive: !record.snapshot.url }
          ).then(() => {
            if (record.runtime) {
              record.runtime.currentBookmarkId = '';
            }
          });
      });
      deleteAction.then(() => {
        if (isUndo) {
          bookmarkMoveHistory.commitUndo();
          showToast(formatMessage(
            'bookmarks_delete_undone',
            'Deletion undone · {shortcut} to delete again',
            { shortcut: getBookmarkRedoShortcutLabel() }
          ));
        } else {
          bookmarkMoveHistory.commitRedo();
          showToast(formatMessage(
            'bookmarks_delete_redone',
            'Deletion restored · {shortcut} to undo',
            { shortcut: getBookmarkUndoShortcutLabel() }
          ));
        }
        markBookmarkTreeDirty({ preserveCascadeOpen: keepCascadeOpen });
        loadBookmarks({ force: true });
        if (keepCascadeOpen) {
          refreshOpenBookmarkCascadeMenu();
        }
      }).catch((error) => {
        dropLayoutAnimation();
        console.warn('[Lumno] Failed to restore bookmark deletion history', error);
        showToast(t('bookmarks_delete_failed', 'Could not delete bookmark'), true);
      }).finally(() => {
        pageState.bookmarkMoveHistoryBusy = false;
      });
      return true;
    }
    const source = isUndo ? record.to : record.from;
    const target = isUndo ? record.from : record.to;
    const destination = {
      parentId: target.parentId,
      index: NEWTAB_BOOKMARK_MOVE_HISTORY.getMoveApiDestinationIndex({
        sourceParentId: source.parentId,
        sourceIndex: source.index,
        targetParentId: target.parentId,
        targetIndex: target.index
      })
    };
    bookmarksRuntime.runControlledMutation(() => {
      return bookmarksRuntime.move(bookmarkMoveHistory.resolveBookmarkId(record.bookmarkId), destination);
    }).then(() => {
      if (isUndo) {
        bookmarkMoveHistory.commitUndo();
        showToast(formatMessage(
          'bookmarks_move_undone',
          'Move undone · {shortcut} to redo',
          { shortcut: getBookmarkRedoShortcutLabel() }
        ));
      } else {
        bookmarkMoveHistory.commitRedo();
        showToast(formatMessage(
          'bookmarks_move_redone',
          'Move restored · {shortcut} to undo',
          { shortcut: getBookmarkUndoShortcutLabel() }
        ));
      }
      markBookmarkTreeDirty({ preserveCascadeOpen: keepCascadeOpen });
      loadBookmarks({ force: true });
      if (keepCascadeOpen) {
        refreshOpenBookmarkCascadeMenu();
      }
    }).catch((error) => {
      dropLayoutAnimation();
      console.warn('[Lumno] Failed to restore bookmark move history', error);
      showToast(t('bookmarks_move_failed', 'Could not move bookmark'), true);
    }).finally(() => {
      pageState.bookmarkMoveHistoryBusy = false;
    });
    return true;
  }

  return {
    deleteBookmarkFromContextTarget,
    getBookmarkUndoShortcutLabel,
    persistBookmarkDragOrder,
    persistBookmarkCrossLevelMove,
    performBookmarkMoveHistoryAction
  };
}

export { createBookmarkMoveActions };
export type { BookmarkDeleteTarget, BookmarkMoveActionsState };
