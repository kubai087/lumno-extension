// Bookmarks and shortcuts trading places: a bookmark dropped on the
// shortcuts (moved, or copied while the bookmark stays), and two website
// shortcuts stacked into a new bookmark folder. Each step writes its
// destination before it removes its source, rolls back what it wrote when
// a later step fails, and goes on the move history to undo.
import type { FolderBindingRuntime } from '../../platform/bookmark-folder-bindings';
import type { FormatMessage, ShowToast, Translate } from '../newtab-types';
import type { PersistShortcuts, ShortcutIconChange } from '../shortcuts/shortcut-types';
import type {
  BookmarkMoveHistory,
  ShortcutDeleteRecord,
  ShortcutStackRecord,
  TransferRecord
} from './bookmark-move-history';
import type { BookmarkNode } from './bookmarks-store';
import type { BookmarksRuntime } from './bookmarks-runtime';
import type { FolderItemIcon, FolderItemIconMap } from './folder-item-icons';
import { isShortcutFolder } from '../../domain/shortcuts/normalize';
import type { ShortcutFolder, ShortcutGroup, ShortcutItem } from '../../domain/shortcuts/types';
import * as ShortcutNormalize from '../../domain/shortcuts/normalize';
import * as NEWTAB_CROSS_SURFACE_DRAG from '../cross-surface-drag';
import * as NEWTAB_BOOKMARK_MOVE_HISTORY from './bookmark-move-history';
import * as FOLDER_REFERENCES from '../../domain/bookmark-folder-reference';
import { DEFAULT_MAX_SHORTCUTS } from '../../domain/shortcuts/constants';
import type { ShortcutList } from '../shortcuts/shortcut-list';
import type { BookmarkSectionParts } from './bookmark-section-parts';

interface BookmarkShortcutTransferState {
  // While an undoable change runs, no other may start.
  bookmarkMoveHistoryBusy: boolean;
}

interface BookmarkShortcutTransferDeps {
  bookmarksRuntime: BookmarksRuntime;
  getShortcutStoreOptions(): Parameters<typeof ShortcutNormalize.createShortcutRecord>[1];
  // The local bookmark folder a folder shortcut shows.
  getShortcutFolderId(shortcut: ShortcutItem): string;
  getShortcutGroups?(): ShortcutGroup[];
  bookmarkMoveHistory: BookmarkMoveHistory;
  shortcutFolderRuntime: Pick<FolderBindingRuntime, 'bind' | 'flush'>;
  getFolderItemIcon?(bookmarkId: string): FolderItemIcon | null;
  updateFolderItemIcons(changes: Readonly<Record<string, FolderItemIcon | null>>): Promise<FolderItemIconMap>;
  persistShortcuts: PersistShortcuts;
  refreshShortcutFolderReferences(): Promise<unknown>;
  isWebDavBackingUpShortcuts?(): Promise<boolean>;
  markBookmarkTreeDirty(options?: { preserveCascadeOpen?: boolean }): void;
  loadBookmarks(options?: { force?: boolean }): unknown;
  refreshOpenBookmarkCascadeMenu(): Promise<boolean>;
  // Notes where the bookmark cards are, so the next render slides them; and
  // forgets that note when the change failed.
  queueLayoutAnimation(excludedBookmarkId: string): void;
  dropLayoutAnimation(): void;
  showToast: ShowToast;
  t: Translate;
  formatMessage: FormatMessage;
  shortcutList: Pick<ShortcutList, 'icons' | 'items'>;
  bookmarkParts: Pick<BookmarkSectionParts, 'cascade'>;
  pageState: BookmarkShortcutTransferState;
}

// Where a bookmark joins the shortcuts as `record`.
interface ShortcutDropPlan {
  record: ShortcutItem | null;
  index: number;
  groupId: string;
}

function createBookmarkShortcutTransfer(deps: BookmarkShortcutTransferDeps) {
  const {
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
    markBookmarkTreeDirty,
    loadBookmarks,
    refreshOpenBookmarkCascadeMenu,
    queueLayoutAnimation,
    dropLayoutAnimation,
    showToast,
    t,
    formatMessage
  } = deps;

  // The page state object shared with newtab.ts and the other modules.
  const pageState = deps.pageState;

  function hasShortcutForBookmarkFolder(bookmarkId: unknown): boolean {
    const id = String(bookmarkId || '');
    return Boolean(id) && shortcutList.items.some((item) => (
      item && isShortcutFolder(item) && String(getShortcutFolderId(item)) === id
    ));
  }

  // "Add to shortcuts" from a bookmark folder's context menu: the same
  // folder shortcut a drop makes, at the end of the last group. The folder
  // stays where it is and the step can be undone like a drop.
  function addBookmarkFolderToShortcuts(bookmarkId: unknown): Promise<boolean> {
    const node = bookmarksRuntime.getNode(String(bookmarkId || ''));
    if (!node || node.url || hasShortcutForBookmarkFolder(node.id)) {
      return Promise.resolve(false);
    }
    const record = ShortcutNormalize.createShortcutRecord(
      { type: 'folder', folderId: node.id, title: node.title },
      getShortcutStoreOptions()
    );
    if (!record) {
      return Promise.resolve(false);
    }
    if (shortcutList.items.length >= DEFAULT_MAX_SHORTCUTS) {
      showToast(formatMessage(
        'newtab_shortcuts_limit_reached',
        'You can add up to {count} shortcuts.',
        { count: DEFAULT_MAX_SHORTCUTS }
      ), true);
      return Promise.resolve(false);
    }
    const groups = typeof getShortcutGroups === 'function' ? getShortcutGroups() : [];
    const lastGroup = groups.length ? groups[groups.length - 1] : null;
    return moveBookmarkToShortcuts({ bookmarkId: node.id }, {
      record,
      index: shortcutList.items.length,
      groupId: lastGroup ? lastGroup.id : ''
    });
  }

  // Whether a bookmark sits in a folder shown as a shortcut, at any depth.
  function isInShortcutFolder(bookmarkId: unknown): boolean {
    const folderIds = new Set(shortcutList.items
      .filter((item) => item && isShortcutFolder(item))
      .map((item) => String(getShortcutFolderId(item) || ''))
      .filter(Boolean));
    let node = bookmarksRuntime.getNode(String(bookmarkId || ''));
    for (let depth = 0; node && node.parentId && depth < 64; depth += 1) {
      if (folderIds.has(String(node.parentId))) return true;
      node = bookmarksRuntime.getNode(String(node.parentId));
    }
    return false;
  }

  // A website bookmark moves into the shortcuts only while WebDAV backs
  // them up. Otherwise the drop adds a copy marked as coming from the
  // bookmarks and the bookmark stays, like a folder always does. A site
  // taken out of a shortcut folder always moves: it was already one of the
  // shortcuts, so leaving it in the folder would show it twice.
  function moveBookmarkToShortcuts(state: { bookmarkId: string }, target: ShortcutDropPlan): Promise<boolean> {
    const record = target.record;
    if (pageState.bookmarkMoveHistoryBusy || !record) return Promise.resolve(false);
    if (!isShortcutFolder(record) && isInShortcutFolder(state.bookmarkId)) {
      return transferBookmarkToShortcuts(state, target, false);
    }
    if (isShortcutFolder(record) || typeof isWebDavBackingUpShortcuts !== 'function') {
      return transferBookmarkToShortcuts(state, target, true);
    }
    pageState.bookmarkMoveHistoryBusy = true;
    return isWebDavBackingUpShortcuts().then((backedUp) => {
      pageState.bookmarkMoveHistoryBusy = false;
      return transferBookmarkToShortcuts(state, target, !backedUp);
    });
  }

  function transferBookmarkToShortcuts(
    state: { bookmarkId: string },
    target: ShortcutDropPlan,
    keepsBookmark: boolean
  ): Promise<boolean> {
    const targetRecord = target.record;
    if (pageState.bookmarkMoveHistoryBusy || !targetRecord) return Promise.resolve(false);
    const node = bookmarksRuntime.getNode(state.bookmarkId);
    if (!node) return Promise.resolve(false);
    const plan = NEWTAB_CROSS_SURFACE_DRAG.planBookmarkToShortcut({
      shortcuts: shortcutList.items,
      record: target.record,
      index: target.index,
      groupId: target.groupId,
      getFolderId: getShortcutFolderId,
      maxShortcuts: DEFAULT_MAX_SHORTCUTS
    });
    if (!plan) {
      return Promise.resolve(false);
    }
    const existingIndex = shortcutList.items.findIndex((item) => item.id === plan.shortcutId);
    const beforeShortcut = existingIndex >= 0 ? {
      snapshot: shortcutList.items[existingIndex],
      index: existingIndex,
      iconDataUrl: shortcutList.icons[plan.shortcutId]
    } : null;
    const isFolder = isShortcutFolder(targetRecord);
    if (isShortcutFolder(targetRecord)) {
      const index = plan.shortcuts.findIndex((item) => item.id === plan.shortcutId);
      const original = plan.shortcuts[index];
      if (!original || !isShortcutFolder(original)) return Promise.resolve(false);
      const folderId = String(targetRecord.folderId || getShortcutFolderId(original));
      const folderRef = FOLDER_REFERENCES.describe(folderId, bookmarksRuntime.getNodeMap());
      if (!folderRef) return Promise.resolve(false);
      const id = original.folderRef ? original.id : FOLDER_REFERENCES.createEntryId();
      const { folderId: _localId, ...entry } = original;
      plan.shortcuts[index] = { ...entry, id, folderRef };
      plan.shortcutId = id;
    }
    // A site from a shortcut folder becomes a shortcut with the icon it
    // showed there: the same source, and a custom image as its own.
    const itemIcon = isFolder || typeof getFolderItemIcon !== 'function'
      ? null
      : getFolderItemIcon(node.id) || null;
    let iconDataUrl = beforeShortcut ? beforeShortcut.iconDataUrl : '';
    if (!isFolder && !beforeShortcut) {
      const index = plan.shortcuts.findIndex((item) => item.id === plan.shortcutId);
      const current = plan.shortcuts[index];
      const settings = (itemIcon && itemIcon.shortcut) || {};
      const iconSource = (itemIcon && itemIcon.iconSource) || settings.iconSource;
      if (current && !isShortcutFolder(current)) {
        plan.shortcuts[index] = {
          ...current,
          ...(keepsBookmark ? { fromBookmark: true } : {}),
          ...(iconSource ? { iconSource } : {}),
          ...(settings.iconPlate ? { iconPlate: settings.iconPlate } : {}),
          ...(settings.iconPlateColor ? { iconPlateColor: settings.iconPlateColor } : {})
        };
      }
      if (itemIcon && itemIcon.iconSource === 'custom') iconDataUrl = itemIcon.dataUrl || '';
    }
    const afterIndex = plan.shortcuts.findIndex((item) => item.id === plan.shortcutId);
    const from = { parentId: node.parentId, index: node.index };
    const record = NEWTAB_BOOKMARK_MOVE_HISTORY.createTransferRecord({
      bookmarkId: node.id,
      snapshot: { title: node.title, url: node.url },
      from,
      to: keepsBookmark ? from : null,
      beforeShortcut,
      afterShortcut: {
        snapshot: plan.shortcuts[afterIndex],
        index: afterIndex,
        iconDataUrl
      },
      itemIcon
    });
    if (!record) return Promise.resolve(false);
    pageState.bookmarkMoveHistoryBusy = true;
    queueLayoutAnimation(state.bookmarkId);
    return applyBookmarkShortcutTransfer(record, false).then((saved) => {
      if (!saved) return false;
      bookmarkMoveHistory.push(record);
      if (isFolder) {
        showToast(t('newtab_shortcuts_folder_added', 'Folder added to shortcuts'));
      } else if (keepsBookmark && !beforeShortcut) {
        showToast(t('newtab_shortcuts_added', 'Shortcut added'));
      }
      return true;
    }).finally(() => {
      pageState.bookmarkMoveHistoryBusy = false;
      if (shortcutList.items.some((item) => isShortcutFolder(item))) return refreshShortcutFolderReferences();
      return undefined;
    });
  }

  // Moves a site between a bookmark and a shortcut, or back on undo: the
  // destination is saved first, and the source goes only once it holds.
  async function applyBookmarkShortcutTransfer(record: TransferRecord, isUndo: boolean): Promise<boolean> {
    const from = isUndo ? record.to : record.from;
    const to = isUndo ? record.from : record.to;
    const sourceShortcut = isUndo ? record.afterShortcut : record.beforeShortcut;
    const destinationShortcut = isUndo ? record.beforeShortcut : record.afterShortcut;
    const planShortcuts = (
      source: ShortcutDeleteRecord | null,
      destination: ShortcutDeleteRecord | null
    ): ShortcutItem[] | null => NEWTAB_CROSS_SURFACE_DRAG.planTransferShortcuts({
      shortcuts: shortcutList.items, source, destination, maxShortcuts: DEFAULT_MAX_SHORTCUTS
    });
    const persistShortcutState = async (items: ShortcutItem[], destination: ShortcutDeleteRecord | null): Promise<boolean> => {
      if (destination && isShortcutFolder(destination.snapshot)) {
        shortcutFolderRuntime.bind(destination.snapshot.id, record.bookmarkId);
        await shortcutFolderRuntime.flush();
      }
      const iconChange: ShortcutIconChange | undefined = destination && destination.iconDataUrl
        ? { shortcutId: destination.snapshot.id, action: 'replace', dataUrl: destination.iconDataUrl }
        : undefined;
      return persistShortcuts(items, '', iconChange, {
        syncOverflowShortcutId: destination ? destination.snapshot.id : undefined,
        animateLayout: true
      });
    };
    const rollbackState: { run: (() => Promise<unknown>) | null } = { run: null };
    let shortcutsSaved = false;
    const keepCascadeOpen = Boolean(bookmarkParts.cascade && bookmarkParts.cascade.isOpen());
    try {
      if (!planShortcuts(sourceShortcut, destinationShortcut)) {
        throw new Error('Shortcut transfer conflicts with the current shortcuts.');
      }
      return await bookmarksRuntime.runControlledMutation(async () => {
        await bookmarksRuntime.ensureReady(false);
        const bookmarkId = bookmarkMoveHistory.resolveBookmarkId(record.bookmarkId || record.runtime.currentBookmarkId);
        const node = from ? bookmarksRuntime.getNode(bookmarkId) : null;
        if (from && (!node || Boolean(node.url) !== Boolean(record.snapshot.url))) {
          throw new Error('The transferred bookmark is unavailable.');
        }
        let movedNode: BookmarkNode | null = node;
        if (to && !from) {
          const createdNode = await bookmarksRuntime.create({
            parentId: to.parentId, index: to.index,
            title: record.snapshot.title, url: record.snapshot.url
          });
          if (!createdNode || !createdNode.id) throw new Error('The restored bookmark id is unavailable.');
          movedNode = createdNode;
          rollbackState.run = () => bookmarksRuntime.remove(createdNode.id);
        } else if (to && from && node && (from.parentId !== to.parentId || from.index !== to.index)) {
          const originalLocation = { parentId: String(node.parentId), index: Number(node.index) || 0 };
          const relocatedNode = await bookmarksRuntime.move(bookmarkId, {
            parentId: to.parentId,
            index: NEWTAB_BOOKMARK_MOVE_HISTORY.getMoveApiDestinationIndex({
              sourceParentId: node.parentId, sourceIndex: node.index,
              targetParentId: to.parentId, targetIndex: to.index
            })
          });
          movedNode = relocatedNode;
          rollbackState.run = () => bookmarksRuntime.move(bookmarkId, {
            parentId: originalLocation.parentId,
            index: NEWTAB_BOOKMARK_MOVE_HISTORY.getMoveApiDestinationIndex({
              sourceParentId: relocatedNode.parentId, sourceIndex: relocatedNode.index,
              targetParentId: originalLocation.parentId, targetIndex: originalLocation.index
            })
          });
        }
        const nextShortcuts = planShortcuts(sourceShortcut, destinationShortcut);
        if (!nextShortcuts) throw new Error('Shortcuts changed during the transfer.');
        // A bookmark-only transfer leaves the shortcuts alone.
        if ((sourceShortcut || destinationShortcut) &&
            !await persistShortcutState(nextShortcuts, destinationShortcut)) {
          const rollback = rollbackState.run;
          rollbackState.run = null;
          if (rollback) await rollback();
          return false;
        }
        shortcutsSaved = Boolean(sourceShortcut || destinationShortcut);
        // The source goes only once the destination is known to hold the
        // site: a save can succeed yet keep a different list (a quota, a
        // duplicate the store folds away), and then removing the bookmark
        // would lose the site on both sides.
        if (!to && destinationShortcut &&
            !shortcutList.items.some((item) => item && item.id === destinationShortcut.snapshot.id)) {
          throw new Error('The shortcuts did not keep the transferred site.');
        }
        // Save the destination before removing the source. Folder aliases keep
        // the original tree, including every nested bookmark id.
        if (!to) {
          await bookmarksRuntime.remove(bookmarkId);
          if (record.snapshot.url) await updateFolderItemIcons({ [bookmarkId]: null }).catch(() => {});
        }
        if (to && !from && movedNode) {
          const restoredId = movedNode.id;
          await bookmarksRuntime.ensureReady(true);
          // A shortcut that left for the bookmarks comes back if its
          // bookmark is not there after all.
          if (sourceShortcut && !bookmarksRuntime.getNode(restoredId)) {
            throw new Error('The bookmarks did not keep the transferred site.');
          }
          if (record.itemIcon) await updateFolderItemIcons({ [restoredId]: record.itemIcon }).catch(() => {});
        }
        if (movedNode && to) {
          bookmarkMoveHistory.remapBookmarkId(record.bookmarkId, movedNode.id);
          record.runtime.currentBookmarkId = String(movedNode.id);
          record.runtime.location = { parentId: String(movedNode.parentId), index: Number(movedNode.index) || 0 };
        }
        return true;
      });
    } catch (error) {
      // Keep failures out of history and restore any completed destination write.
      try {
        const rollback = rollbackState.run;
        await bookmarksRuntime.runControlledMutation(async () => {
          if (rollback) await rollback();
          if (shortcutsSaved) {
            const originalShortcuts = planShortcuts(destinationShortcut, sourceShortcut);
            if (!originalShortcuts || !await persistShortcutState(originalShortcuts, sourceShortcut)) {
              throw new Error('Could not roll back shortcut transfer.');
            }
          }
        });
      } catch (rollbackError) {
        console.warn('[Lumno] Failed to roll back bookmark shortcut transfer', rollbackError);
      }
      dropLayoutAnimation();
      console.warn('[Lumno] Failed to transfer bookmark and shortcut', error);
      showToast(t('bookmarks_move_failed', 'Could not move bookmark'), true);
      return false;
    } finally {
      markBookmarkTreeDirty({ preserveCascadeOpen: keepCascadeOpen });
      loadBookmarks({ force: true });
      if (keepCascadeOpen) refreshOpenBookmarkCascadeMenu();
    }
  }

  // Shortcut folders are bookmark folders, so stacking two website shortcuts
  // creates one holding both sites and shows it where the stack target was.
  async function applyShortcutStack(record: ShortcutStackRecord, isUndo: boolean): Promise<boolean> {
    const keepCascadeOpen = Boolean(bookmarkParts.cascade && bookmarkParts.cascade.isOpen());
    const planShortcuts = (folderSnapshot: ShortcutFolder): ShortcutItem[] | null => NEWTAB_CROSS_SURFACE_DRAG.planShortcutStack({
      shortcuts: shortcutList.items,
      sources: record.sources,
      folder: { snapshot: folderSnapshot, index: record.folderShortcut.index, groupId: record.folderShortcut.groupId },
      undo: isUndo,
      maxShortcuts: DEFAULT_MAX_SHORTCUTS
    });
    const folderShortcutId = record.folderShortcut.id;
    // Only the folder entry's id decides whether the stack still fits; its
    // bookmark folder is not known until it is created.
    const folderStandIn: ShortcutFolder = {
      id: folderShortcutId,
      type: 'folder',
      title: record.runtime.title || record.snapshot.title,
      folderId: ''
    };
    const rollbackState: { run: (() => Promise<unknown>) | null } = { run: null };
    try {
      if (!planShortcuts(folderStandIn)) {
        throw new Error('Shortcut stack conflicts with the current shortcuts.');
      }
      return await bookmarksRuntime.runControlledMutation(async () => {
        await bookmarksRuntime.ensureReady(false);
        if (isUndo) {
          const folderId = bookmarkMoveHistory.resolveBookmarkId(record.bookmarkId);
          const node = bookmarksRuntime.getNode(folderId);
          if (!node || !NEWTAB_BOOKMARK_MOVE_HISTORY.isShortcutStackFolderIntact(node, record.snapshot)) {
            throw new Error('The stacked folder has changed.');
          }
          const nextShortcuts = planShortcuts(folderStandIn);
          const iconChanges = record.sources.filter((source) => source.iconDataUrl).map((source): ShortcutIconChange => ({
            shortcutId: source.snapshot.id, action: 'replace', dataUrl: source.iconDataUrl
          }));
          const previousShortcuts = shortcutList.items;
          if (!nextShortcuts || !await persistShortcuts(nextShortcuts, '', iconChanges, { animateLayout: true })) return false;
          try {
            await bookmarksRuntime.remove(folderId, { recursive: true });
          } catch (error) {
            await persistShortcuts(previousShortcuts, '');
            throw error;
          }
          await updateFolderItemIcons(Object.fromEntries((node.children || []).map((child) => [child.id, null])))
            .catch(() => {});
          // Redo recreates the folder where, and under the name, it was left.
          record.runtime.location = { parentId: String(node.parentId), index: Number(node.index) || 0 };
          record.runtime.title = String(node.title || '');
          record.runtime.currentBookmarkId = '';
          return true;
        }
        // New folders go to the end of the bookmarks bar shown on this page.
        const location = record.runtime.location;
        const parent = location ? bookmarksRuntime.getNode(location.parentId) : null;
        const children = parent && !parent.url && Array.isArray(parent.children) ? parent.children : null;
        const title = record.runtime.title || record.snapshot.title;
        const folderNode = await bookmarksRuntime.create({
          parentId: parent && children ? String(parent.id) : bookmarksRuntime.getRootFolderId(),
          ...(location && children ? { index: Math.min(location.index, children.length) } : {}),
          title
        });
        const folderId = String(folderNode && folderNode.id || '');
        if (!folderId) throw new Error('The stacked folder id is unavailable.');
        rollbackState.run = () => bookmarksRuntime.remove(folderId, { recursive: true });
        const itemIcons: Record<string, FolderItemIcon> = {};
        for (let index = 0; index < record.snapshot.children.length; index += 1) {
          const child = record.snapshot.children[index];
          const childNode = await bookmarksRuntime.create({ parentId: folderId, index, title: child.title, url: child.url });
          const itemIcon = record.itemIcons[index];
          if (childNode && childNode.id && itemIcon) itemIcons[childNode.id] = itemIcon;
        }
        await bookmarksRuntime.ensureReady(true);
        const folderRef = FOLDER_REFERENCES.describe(folderId, bookmarksRuntime.getNodeMap());
        if (!folderRef) throw new Error('The stacked folder cannot be referenced.');
        const nextShortcuts = planShortcuts({
          id: folderShortcutId, type: 'folder', folderRef, title
        });
        if (!nextShortcuts) throw new Error('Shortcuts changed while stacking.');
        shortcutFolderRuntime.bind(folderShortcutId, folderId);
        await shortcutFolderRuntime.flush();
        if (!await persistShortcuts(nextShortcuts, '', undefined, {
          syncOverflowShortcutId: folderShortcutId,
          animateLayout: true
        })) {
          const rollback = rollbackState.run;
          rollbackState.run = null;
          if (rollback) await rollback();
          return false;
        }
        rollbackState.run = null;
        await updateFolderItemIcons(itemIcons).catch(() => {});
        if (record.bookmarkId) bookmarkMoveHistory.remapBookmarkId(record.bookmarkId, folderId);
        record.runtime.currentBookmarkId = folderId;
        return true;
      });
    } catch (error) {
      const rollback = rollbackState.run;
      if (rollback) {
        try {
          await bookmarksRuntime.runControlledMutation(rollback);
        } catch (rollbackError) {
          console.warn('[Lumno] Failed to roll back shortcut stack', rollbackError);
        }
      }
      dropLayoutAnimation();
      console.warn('[Lumno] Failed to stack shortcuts', error);
      showToast(isUndo
        ? t('toast_error', 'Operation failed. Please try again.')
        : t('newtab_shortcuts_stack_failed', 'Could not create the folder'), true);
      return false;
    } finally {
      markBookmarkTreeDirty({ preserveCascadeOpen: keepCascadeOpen });
      loadBookmarks({ force: true });
      if (keepCascadeOpen) refreshOpenBookmarkCascadeMenu();
    }
  }

  return {
    hasShortcutForBookmarkFolder,
    addBookmarkFolderToShortcuts,
    moveBookmarkToShortcuts,
    applyBookmarkShortcutTransfer,
    applyShortcutStack
  };
}

type BookmarkShortcutTransfer = ReturnType<typeof createBookmarkShortcutTransfer>;

export { createBookmarkShortcutTransfer };
export type { BookmarkShortcutTransfer, BookmarkShortcutTransferState, ShortcutDropPlan };
