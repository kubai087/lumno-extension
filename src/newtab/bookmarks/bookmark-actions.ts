// Bookmark actions started from the page: editing a bookmark in the
// shortcut dialog, opening a folder as a tab group after confirmation, and
// the bookmark context menu's copy.
import type { BookmarkTabGroupReply } from '../../domain/messages';
import * as LumnoMessaging from '../../platform/messaging';
import type { SelectMenuOption } from '../../shared/react/select-menu/menu-options';
import type { ContextMenuParts, FormatMessage, SelectMenuController, ShowToast, Translate } from '../newtab-types';
import type { ShortcutDialogOpenOptions } from '../react/shortcut-dialog';
import type { BookmarkCascadeRuntime } from './bookmark-cascade-menu';
import type { BookmarkContextTarget } from './bookmark-context-menu';
import type { BookmarksRuntime } from './bookmarks-runtime';
import type { FolderItemIcon } from './folder-item-icons';
import * as NEWTAB_BOOKMARKS_STORE from './bookmarks-store';
import { BOOKMARK_CONTEXT_MENU_EDIT_VALUE, BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE, NEWTAB_CONTEXT_MENU_OPEN_VALUE, SHORTCUT_DIALOG_ITEM_BOOKMARK, SHORTCUT_DIALOG_ITEM_FOLDER } from '../menu-values';

// The bookmark an action is for, as far as the actions read it.
type BookmarkEditTarget = Pick<BookmarkContextTarget, 'bookmarkId' | 'isFolder' | 'title'> &
  Partial<Pick<BookmarkContextTarget, 'url' | 'sourceKind'>> & { element: HTMLElement | null };

interface BookmarkActionsState {
  bookmarkContextMenu: ContextMenuParts | null;
  bookmarkContextMenuSelectController: SelectMenuController | null;
  bookmarkContextMenuTarget: BookmarkContextTarget | null;
  bookmarkCascadeRuntime: BookmarkCascadeRuntime | null;
}

interface BookmarkActionsDeps {
  t: Translate;
  getBookmarkContextMenuOptions(target?: BookmarkContextTarget | null): SelectMenuOption[];
  bookmarksRuntime: BookmarksRuntime;
  openShortcutDialog(options: ShortcutDialogOpenOptions): unknown;
  formatMessage: FormatMessage;
  showToast: ShowToast;
  // Whether the open folder menu belongs to a folder shortcut.
  isShortcutFolderAnchor(anchor: HTMLElement | null): boolean;
  getFolderItemIcon(bookmarkId: string): FolderItemIcon | null;
  SHORTCUT_DIALOG_MODE_EDIT: string;
  getFolderItemIconUrl(bookmarkId: string, url: string): string;
  getBrowserPageFaviconUrl(url: string): string;
  pageState: BookmarkActionsState;
}

function createBookmarkActions(deps: BookmarkActionsDeps) {
  const {
    t,
    getBookmarkContextMenuOptions,
    bookmarksRuntime,
    openShortcutDialog,
    formatMessage,
    showToast,
    isShortcutFolderAnchor,
    getFolderItemIcon,
    SHORTCUT_DIALOG_MODE_EDIT,
    getFolderItemIconUrl,
    getBrowserPageFaviconUrl
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  function updateBookmarkContextMenuLanguageStrings(): void {
    if (!pageState.bookmarkContextMenu || !pageState.bookmarkContextMenuSelectController) {
      return;
    }
    pageState.bookmarkContextMenu.trigger.setAttribute(
      'aria-label',
      t('bookmarks_context_menu_label', 'Bookmark actions')
    );
    pageState.bookmarkContextMenuSelectController.setOptions(
      pageState.bookmarkContextMenu.control,
      getBookmarkContextMenuOptions(pageState.bookmarkContextMenuTarget),
      pageState.bookmarkContextMenuTarget && pageState.bookmarkContextMenuTarget.isFolder
        ? BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE
        : pageState.bookmarkContextMenuTarget
          ? NEWTAB_CONTEXT_MENU_OPEN_VALUE
          : BOOKMARK_CONTEXT_MENU_EDIT_VALUE
    );
  }

  function requestBookmarkFolderTabGroup(folderId: string, title: string): Promise<BookmarkTabGroupReply> {
    return new Promise((resolve) => {
      if (!chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
        resolve({ ok: false, reason: 'runtime-unavailable' });
        return;
      }
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
        action: 'openBookmarkFolderInNewTabGroup',
        folderId,
        title
      }, (response) => {
        const error = chrome.runtime && chrome.runtime.lastError
          ? chrome.runtime.lastError.message || 'runtime-error'
          : '';
        resolve(error ? { ok: false, reason: error } : (response || { ok: false }));
      });
    });
  }

  function openBookmarkFolderTabGroupConfirmation(target: BookmarkEditTarget | null): void {
    if (!target || !target.isFolder || !target.bookmarkId) {
      return;
    }
    const node = bookmarksRuntime.getNode(target.bookmarkId);
    const count = NEWTAB_BOOKMARKS_STORE.collectFolderBookmarkUrls(node).length;
    if (count <= 0) {
      return;
    }
    const folderTitle = String((node && node.title) || target.title || '').trim() ||
      t('bookmarks_untitled_folder', 'Untitled folder');
    openShortcutDialog({
      sourceElement: target.element,
      confirmationTitle: formatMessage(
        'bookmarks_open_group_confirm_title',
        'Open {count} tabs?',
        { count }
      ),
      confirmationDescription: formatMessage(
        'bookmarks_open_group_confirm_description',
        'All bookmarks in “{folder}” and its subfolders will open in one tab group.',
        { folder: folderTitle }
      ),
      confirmLabel: t('bookmarks_open_group_confirm_button', 'Open'),
      async onConfirm() {
        const response = await requestBookmarkFolderTabGroup(
          String(target.bookmarkId),
          folderTitle
        );
        const openedCount = Math.max(0, Number(response && response.openedCount) || 0);
        const failedCount = Math.max(0, Number(response && response.failedCount) || 0);
        if (openedCount > 0 && failedCount > 0) {
          showToast(formatMessage(
            'bookmarks_open_group_partial_failed',
            'Opened {openedCount} tabs; {failedCount} could not be opened.',
            { openedCount, failedCount }
          ), true);
        } else if (!response || response.ok !== true) {
          showToast(t(
            'bookmarks_open_group_failed',
            'Could not open the bookmark folder'
          ), true);
        }
        return true;
      }
    });
  }

  function openBookmarkEditor(target: BookmarkEditTarget | null): void {
    if (!target || !target.bookmarkId) {
      return;
    }
    const node = bookmarksRuntime.getNode(target.bookmarkId);
    const isFolder = Boolean(target.isFolder);
    const url = isFolder ? '' : String((node && node.url) || target.url || '');
    // Websites in a folder opened from a shortcut choose an icon like shortcuts.
    const cascadeRuntime = pageState.bookmarkCascadeRuntime;
    const iconEditable = !isFolder && target.sourceKind === 'cascade' && cascadeRuntime !== null &&
      isShortcutFolderAnchor(cascadeRuntime.getAnchor());
    const icon = iconEditable ? getFolderItemIcon(target.bookmarkId) : null;
    openShortcutDialog({
      mode: SHORTCUT_DIALOG_MODE_EDIT,
      itemType: isFolder ? SHORTCUT_DIALOG_ITEM_FOLDER : SHORTCUT_DIALOG_ITEM_BOOKMARK,
      iconEditable,
      iconPreviewUrl: iconEditable
        ? getFolderItemIconUrl(target.bookmarkId, url) || getBrowserPageFaviconUrl(url) : '',
      shortcut: {
        id: String(target.bookmarkId),
        title: String((node && node.title) || target.title || ''),
        url,
        ...(icon && icon.iconSource ? { iconSource: icon.iconSource } : {}),
        ...(icon && icon.iconSource === 'custom' ? { iconDataUrl: icon.dataUrl } : {})
      },
      sourceElement: target.element
    });
  }

  return {
    updateBookmarkContextMenuLanguageStrings,
    openBookmarkFolderTabGroupConfirmation,
    openBookmarkEditor
  };
}

export { createBookmarkActions };
export type { BookmarkActionsDeps, BookmarkActionsState, BookmarkEditTarget };
