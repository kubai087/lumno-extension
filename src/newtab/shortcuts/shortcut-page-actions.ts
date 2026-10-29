// Shortcut tiles on the page: finding a tile and its shortcut, the
// context menu's options, and opening a shortcut to edit.
import { isElementNode, isHtmlElement } from '../../shared/dom-guards';
import { queryHtmlElements } from '../../shared/dom-lookup';
import type { SelectMenuOption } from '../../shared/react/select-menu/menu-options';
import type { BookmarkEditTarget } from '../bookmarks/bookmark-actions';
import type { BookmarksRuntime } from '../bookmarks/bookmarks-runtime';
import type { Translate } from '../newtab-types';
import type { ShortcutContextTarget } from './shortcut-types';
import { isShortcutFolder } from '../../domain/shortcuts/normalize';
import type { ShortcutGroup, ShortcutItem } from '../../domain/shortcuts/types';
import * as ShortcutConstants from '../../domain/shortcuts/constants';
import * as NEWTAB_BOOKMARKS_STORE from '../bookmarks/bookmarks-store';
import { BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE, FOLDER_COLOR_CONTEXT_MENU_VALUE, NEWTAB_CONTEXT_MENU_OPEN_VALUE, SHORTCUT_CONTEXT_MENU_EDIT_VALUE, SHORTCUT_CONTEXT_MENU_HIDE_ADD_VALUE, SHORTCUT_CONTEXT_MENU_REMOVE_VALUE, SHORTCUT_GROUP_MENU_VALUES } from '../menu-values';
import { DEFAULT_MAX_SHORTCUTS } from '../../domain/shortcuts/constants';
import type { ShortcutList } from './shortcut-list';
import type { ShortcutData } from './shortcut-data';
import type { ShortcutDialogActions } from './shortcut-dialog-actions';


interface ShortcutPageActionsDeps {
  t: Translate;
  getShortcutGroups(): ShortcutGroup[];
  bookmarksRuntime: BookmarksRuntime;
  getShortcutFolderId(shortcut: ShortcutItem): string;
  getShortcutById: ShortcutData['getShortcutById'];
  openShortcutDialog: ShortcutDialogActions['openShortcutDialog'];
  // The tiles drawn now, kept in DOM order.
  shortcutTiles: HTMLElement[];
  openBookmarkEditor(target: BookmarkEditTarget): void;
  getShortcutTitle(shortcut: ShortcutItem): string;
  getShortcutIconDataUrl(shortcutId: string): string;
  shortcutList: Pick<ShortcutList, 'items'>;
  shortcutGrid: HTMLElement;
}

function createShortcutPageActions(deps: ShortcutPageActionsDeps) {
  const {
    shortcutGrid,
    shortcutList,
    t,
    getShortcutGroups,
    bookmarksRuntime,
    getShortcutFolderId,
    getShortcutById,
    openShortcutDialog,
    shortcutTiles,
    openBookmarkEditor,
    getShortcutTitle,
    getShortcutIconDataUrl
  } = deps;

  function getShortcutContextMenuOptions(target?: ShortcutContextTarget | null): SelectMenuOption[] {
    const createGroupOption: SelectMenuOption = {
      action: SHORTCUT_GROUP_MENU_VALUES.create,
      value: SHORTCUT_GROUP_MENU_VALUES.create,
      label: t('newtab_shortcuts_group_new', 'New group')
    };
    if (target && target.kind === 'add') {
      return [
        {
          action: SHORTCUT_GROUP_MENU_VALUES.addShortcut,
          value: SHORTCUT_GROUP_MENU_VALUES.addShortcut,
          label: t('newtab_shortcuts_add_site', 'Add site')
        },
        { ...createGroupOption, disabled: getShortcutGroups().length >= ShortcutConstants.DEFAULT_MAX_SHORTCUT_GROUPS },
        {
          value: SHORTCUT_CONTEXT_MENU_HIDE_ADD_VALUE,
          label: t('newtab_shortcuts_hide_add', 'Hide'),
          dividerBefore: true
        }
      ];
    }
    if (target && target.kind === 'group') {
      const groups = getShortcutGroups();
      const index = groups.findIndex((group) => group.id === target.groupId);
      const hasSites = shortcutList.items.some((item) => item.groupId === target.groupId);
      const option = (value: string, label: string, extra?: Partial<SelectMenuOption>): SelectMenuOption => (
        { action: value, value, label, ...(extra || {}) });
      return [
        option(SHORTCUT_GROUP_MENU_VALUES.rename, t('newtab_shortcuts_group_rename', 'Rename')),
        option(SHORTCUT_GROUP_MENU_VALUES.addSite, t('newtab_shortcuts_group_add_site', 'Add site'), {
          disabled: shortcutList.items.length >= DEFAULT_MAX_SHORTCUTS
        }),
        option(SHORTCUT_GROUP_MENU_VALUES.moveUp, t('newtab_shortcuts_group_move_up', 'Move up'), {
          dividerBefore: true, disabled: index <= 0
        }),
        option(SHORTCUT_GROUP_MENU_VALUES.moveDown, t('newtab_shortcuts_group_move_down', 'Move down'), {
          disabled: index < 0 || index >= groups.length - 1
        }),
        { ...createGroupOption, disabled: groups.length >= ShortcutConstants.DEFAULT_MAX_SHORTCUT_GROUPS },
        option(SHORTCUT_GROUP_MENU_VALUES.delete, t('newtab_shortcuts_group_delete', 'Delete group'), {
          dividerBefore: true, disabled: groups.length <= 1
        }),
        ...(hasSites ? [option(SHORTCUT_GROUP_MENU_VALUES.deleteWithSites,
          t('newtab_shortcuts_group_delete_with_sites', 'Delete group and sites'), {
            disabled: groups.length <= 1
          })] : [])
      ];
    }
    const shortcut = target && target.kind === 'shortcut' ? getShortcutById(target.shortcutId) : null;
    if (shortcut && isShortcutFolder(shortcut)) {
      return [
        { action: NEWTAB_CONTEXT_MENU_OPEN_VALUE, value: NEWTAB_CONTEXT_MENU_OPEN_VALUE,
          label: t('newtab_shortcuts_open_folder', 'Open folder') },
        { action: BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE, value: BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE,
          label: t('bookmarks_open_in_new_tab_group', 'Open in new tab group'),
          disabled: NEWTAB_BOOKMARKS_STORE.collectFolderBookmarkUrls(
            bookmarksRuntime.getNode(getShortcutFolderId(shortcut))
          ).length <= 0 },
        { action: SHORTCUT_CONTEXT_MENU_EDIT_VALUE, value: SHORTCUT_CONTEXT_MENU_EDIT_VALUE,
          label: t('folder_rename', 'Rename'), dividerBefore: true },
        { action: FOLDER_COLOR_CONTEXT_MENU_VALUE, value: FOLDER_COLOR_CONTEXT_MENU_VALUE,
          label: t('folder_color_change', 'Change color') },
        { action: SHORTCUT_CONTEXT_MENU_REMOVE_VALUE, value: SHORTCUT_CONTEXT_MENU_REMOVE_VALUE,
          label: t('shortcuts_remove', 'Remove') }
      ];
    }
    return [
      {
        action: NEWTAB_CONTEXT_MENU_OPEN_VALUE,
        value: NEWTAB_CONTEXT_MENU_OPEN_VALUE,
        label: t('newtab_open_in_new_tab', 'Open in new tab')
      },
      {
        action: SHORTCUT_CONTEXT_MENU_EDIT_VALUE,
        value: SHORTCUT_CONTEXT_MENU_EDIT_VALUE,
        label: t('shortcuts_edit', 'Edit'),
        dividerBefore: true
      },
      {
        action: SHORTCUT_CONTEXT_MENU_REMOVE_VALUE,
        value: SHORTCUT_CONTEXT_MENU_REMOVE_VALUE,
        label: t('shortcuts_remove', 'Remove')
      }
    ];
  }


  function getShortcutTileFromNode(node: EventTarget | null): HTMLElement | null {
    if (!shortcutGrid || !isElementNode(node)) {
      return null;
    }
    const tile = node.closest('.x-nt-shortcut-tile');
    return isHtmlElement(tile) && shortcutGrid.contains(tile) ? tile : null;
  }

  function getShortcutTileId(tile: Element | null | undefined): string {
    return tile ? tile.getAttribute('data-shortcut-id') || '' : '';
  }

  function refreshShortcutTileCacheFromDom(): void {
    if (!shortcutGrid) {
      return;
    }
    shortcutTiles.length = 0;
    queryHtmlElements(shortcutGrid, '.x-nt-shortcut-tile[data-shortcut-id]').forEach((tile) => {
      shortcutTiles.push(tile);
    });
  }

  function getShortcutReorderTiles(): HTMLElement[] {
    return shortcutGrid
      ? queryHtmlElements(shortcutGrid, '.x-nt-shortcut-tile[data-shortcut-id]')
      : [];
  }


  function getShortcutTileById(shortcutId: unknown): HTMLElement | null {
    const id = String(shortcutId || '');
    if (!id) {
      return null;
    }
    return getShortcutReorderTiles().find((tile) => getShortcutTileId(tile) === id) || null;
  }

  // Tiles are dragged by pointer events, never natively.
  function handleShortcutNativeDragStart(event: Pick<Event, 'preventDefault'>): void {
    event.preventDefault();
  }

  function openShortcutEditor(shortcut: ShortcutItem | null, sourceElement: HTMLElement | null): void {
    if (!shortcut) {
      return;
    }
    if (isShortcutFolder(shortcut)) {
      openBookmarkEditor({ bookmarkId: getShortcutFolderId(shortcut), isFolder: true,
        title: getShortcutTitle(shortcut), element: sourceElement });
      return;
    }
    openShortcutDialog({
      mode: 'edit',
      shortcut: {
        ...shortcut,
        iconDataUrl: getShortcutIconDataUrl(shortcut.id)
      },
      sourceElement
    });
  }

  // Whether a folder menu opened from a folder shortcut, not a bookmark.
  function isShortcutFolderAnchor(element: HTMLElement | null | undefined): boolean {
    return Boolean(element && element.classList.contains('x-nt-shortcut-tile'));
  }

  return {
    getShortcutContextMenuOptions,
    getShortcutTileFromNode,
    getShortcutTileId,
    refreshShortcutTileCacheFromDom,
    getShortcutReorderTiles,
    getShortcutTileById,
    handleShortcutNativeDragStart,
    openShortcutEditor,
    isShortcutFolderAnchor
  };
}

type ShortcutPageActions = ReturnType<typeof createShortcutPageActions>;

export { createShortcutPageActions };
export type { ShortcutPageActions, ShortcutPageActionsDeps };
