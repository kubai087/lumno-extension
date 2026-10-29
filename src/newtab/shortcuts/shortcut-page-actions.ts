// Shortcut tiles on the page: finding a tile and its shortcut, the
// context menu's options, opening the shortcut dialog to add or edit, the
// icon plate color picker, and the copy the dialog and menus show.
import { isElementNode, isHtmlElement } from '../../shared/dom-guards';
import { queryHtmlElements } from '../../shared/dom-lookup';
import type { SelectMenuOption } from '../../shared/react/select-menu/menu-options';
import type { BookmarkEditTarget } from '../bookmarks/bookmark-actions';
import type { BookmarksRuntime } from '../bookmarks/bookmarks-runtime';
import type { FolderColorPicker } from '../bookmarks/folder-colors';
import type { BindTooltip, ContextMenuParts, SelectMenuController, ShowToast, Translate } from '../newtab-types';
import type { createFolderColorPickerApi } from '../react/folder-color-picker-lazy';
import type {
  IconPlateColorRequest,
  ShortcutDialogCloseOptions,
  ShortcutDialogController,
  ShortcutDialogOpenOptions
} from '../react/shortcut-dialog';
import type { ShortcutContextTarget } from './shortcut-types';
import { isShortcutFolder } from '../../domain/shortcuts/normalize';
import type { ShortcutGroup, ShortcutItem } from '../../domain/shortcuts/types';
import * as ShortcutConstants from '../../domain/shortcuts/constants';
import * as NEWTAB_BOOKMARKS_STORE from '../bookmarks/bookmarks-store';
import { BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE, FOLDER_COLOR_CONTEXT_MENU_VALUE, NEWTAB_CONTEXT_MENU_OPEN_VALUE, SHORTCUT_CONTEXT_MENU_EDIT_VALUE, SHORTCUT_CONTEXT_MENU_HIDE_ADD_VALUE, SHORTCUT_CONTEXT_MENU_REMOVE_VALUE, SHORTCUT_GROUP_MENU_VALUES } from '../menu-values';
import { DEFAULT_MAX_SHORTCUTS } from '../../domain/shortcuts/constants';

interface ShortcutPageActionsState {
  // The folder color picker, made the first time a plate color is picked.
  shortcutPlateColorPicker: FolderColorPicker | null;
  // Settles the plate color request that is open.
  shortcutPlateColorPick: ((color: string | null | undefined) => void) | null;
  shortcutDialogController: ShortcutDialogController | null;
  shortcutContextMenu: ContextMenuParts | null;
  shortcutContextMenuSelectController: SelectMenuController | null;
  shortcutContextMenuTarget: ShortcutContextTarget | null;
  newtabShortcuts: ShortcutItem[];
  shortcutSection: HTMLElement | null;
  shortcutGrid: HTMLElement | null;
}

interface ShortcutPageActionsDeps {
  folderColorApi: ReturnType<typeof createFolderColorPickerApi> | undefined;
  t: Translate;
  bindShortcutDialogTooltip: BindTooltip;
  hideShortcutDialogTooltip(): void;
  readSavedFolderColors(): Promise<unknown>;
  saveSavedFolderColors(colors: string[]): Promise<void>;
  getShortcutGroups(): ShortcutGroup[];
  bookmarksRuntime: BookmarksRuntime;
  getShortcutFolderId(shortcut: ShortcutItem): string;
  updateBookmarkContextMenuLanguageStrings(): void;
  updateRecentContextMenuLanguageStrings(): void;
  createShortcutDialogComponent(): Promise<ShortcutDialogController | null>;
  showToast: ShowToast;
  // The tiles drawn now, kept in DOM order.
  shortcutTiles: HTMLElement[];
  openBookmarkEditor(target: BookmarkEditTarget): void;
  getShortcutTitle(shortcut: ShortcutItem): string;
  getShortcutIconDataUrl(shortcutId: string): string;
  pageState: ShortcutPageActionsState;
}

function createShortcutPageActions(deps: ShortcutPageActionsDeps) {
  const {
    folderColorApi,
    t,
    bindShortcutDialogTooltip,
    hideShortcutDialogTooltip,
    readSavedFolderColors,
    saveSavedFolderColors,
    getShortcutGroups,
    bookmarksRuntime,
    getShortcutFolderId,
    updateBookmarkContextMenuLanguageStrings,
    updateRecentContextMenuLanguageStrings,
    createShortcutDialogComponent,
    showToast,
    shortcutTiles,
    openBookmarkEditor,
    getShortcutTitle,
    getShortcutIconDataUrl
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  let shortcutDialogLoadPromise: Promise<void> | null = null;
  let shortcutDialogOpenRevision = 0;

  // The folder color picker, over the shortcut dialog, for an icon's plate.
  // It shares the saved colors with folders; the shortcut dialog saves the
  // result. Resolves with a color, null to follow the icon, or undefined.
  async function pickShortcutIconPlateColor(request: IconPlateColorRequest): Promise<string | null | undefined> {
    if (!pageState.shortcutPlateColorPicker) {
      if (!folderColorApi) {
        return undefined;
      }
      try {
        pageState.shortcutPlateColorPicker = await folderColorApi.createFolderColorPicker({
          documentObj: document, t,
          bindTooltip: bindShortcutDialogTooltip,
          hideTooltip: hideShortcutDialogTooltip,
          readSavedColors: readSavedFolderColors,
          saveSavedColors: saveSavedFolderColors,
          onSubmit: (_id, color) => {
            pageState.shortcutPlateColorPick?.(color);
            return Promise.resolve();
          },
          onClose: () => pageState.shortcutPlateColorPick?.(undefined)
        });
      } catch {
        return undefined;
      }
    }
    // Narrowed here, for the promise below.
    const picker = pageState.shortcutPlateColorPicker;
    return new Promise((resolve) => {
      pageState.shortcutPlateColorPick = (color) => {
        pageState.shortcutPlateColorPick = null;
        resolve(color);
      };
      const label = t('newtab_shortcuts_icon_plate_color_label', 'Background color');
      picker.open({
        folderId: 'shortcut-icon-plate',
        title: request.title,
        color: request.color,
        presets: request.presets,
        previewImageUrl: request.imageUrl,
        labels: {
          dialog: label,
          picker: label,
          defaultColor: t('newtab_shortcuts_icon_plate_color_auto', 'From the icon')
        },
        sourceElement: request.sourceElement
      });
    });
  }

  function updateShortcutDialogLanguageStrings(): void {
    if (pageState.shortcutDialogController) {
      pageState.shortcutDialogController.updateLanguage();
    }
  }

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
      const hasSites = pageState.newtabShortcuts.some((item) => item.groupId === target.groupId);
      const option = (value: string, label: string, extra?: Partial<SelectMenuOption>): SelectMenuOption => (
        { action: value, value, label, ...(extra || {}) });
      return [
        option(SHORTCUT_GROUP_MENU_VALUES.rename, t('newtab_shortcuts_group_rename', 'Rename')),
        option(SHORTCUT_GROUP_MENU_VALUES.addSite, t('newtab_shortcuts_group_add_site', 'Add site'), {
          disabled: pageState.newtabShortcuts.length >= DEFAULT_MAX_SHORTCUTS
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

  function updateShortcutContextMenuLanguageStrings(): void {
    if (!pageState.shortcutContextMenu || !pageState.shortcutContextMenuSelectController) {
      return;
    }
    const label = t('newtab_shortcuts_context_menu_label', 'Shortcut actions');
    pageState.shortcutContextMenu.trigger.setAttribute('aria-label', label);
    pageState.shortcutContextMenuSelectController.setOptions(
      pageState.shortcutContextMenu.control,
      getShortcutContextMenuOptions(pageState.shortcutContextMenuTarget),
      pageState.shortcutContextMenuTarget && pageState.shortcutContextMenuTarget.kind === 'group'
        ? SHORTCUT_GROUP_MENU_VALUES.rename
        : pageState.shortcutContextMenuTarget && pageState.shortcutContextMenuTarget.kind === 'add'
        ? SHORTCUT_GROUP_MENU_VALUES.addShortcut
        : NEWTAB_CONTEXT_MENU_OPEN_VALUE
    );
  }

  // The tiles draw their own labels; this names the section's host and
  // updates the dialog and the menus.
  function updateShortcutLanguageStrings(): void {
    if (pageState.shortcutSection) {
      pageState.shortcutSection.setAttribute('aria-label', t('newtab_shortcuts_section_label', 'Shortcuts'));
    }
    updateShortcutDialogLanguageStrings();
    updateShortcutContextMenuLanguageStrings();
    updateBookmarkContextMenuLanguageStrings();
    updateRecentContextMenuLanguageStrings();
  }

  function closeShortcutDialog(options?: ShortcutDialogCloseOptions): void {
    shortcutDialogOpenRevision += 1;
    if (pageState.shortcutDialogController) {
      pageState.shortcutDialogController.close({
        ...(options || {}),
        force: true
      });
    }
  }

  async function openShortcutDialog(options: ShortcutDialogOpenOptions): Promise<void> {
    const revision = ++shortcutDialogOpenRevision;
    try {
      if (!pageState.shortcutDialogController) {
        if (!shortcutDialogLoadPromise) {
          shortcutDialogLoadPromise = createShortcutDialogComponent().then((controller) => {
            if (!controller) throw new Error('Shortcut dialog unavailable');
            pageState.shortcutDialogController = controller;
            controller.mount(document.body);
          }).finally(() => { shortcutDialogLoadPromise = null; });
        }
        await shortcutDialogLoadPromise;
      }
      if (revision === shortcutDialogOpenRevision && pageState.shortcutDialogController) {
        pageState.shortcutDialogController.open(options);
      }
    } catch (error) {
      console.warn('[Lumno] Failed to load shortcut dialog', error);
      if (revision === shortcutDialogOpenRevision) showToast(t('toast_error', 'Operation failed. Please try again.'), true);
    }
  }

  function getShortcutTileFromNode(node: EventTarget | null): HTMLElement | null {
    if (!pageState.shortcutGrid || !isElementNode(node)) {
      return null;
    }
    const tile = node.closest('.x-nt-shortcut-tile');
    return isHtmlElement(tile) && pageState.shortcutGrid.contains(tile) ? tile : null;
  }

  function getShortcutTileId(tile: Element | null | undefined): string {
    return tile ? tile.getAttribute('data-shortcut-id') || '' : '';
  }

  function refreshShortcutTileCacheFromDom(): void {
    if (!pageState.shortcutGrid) {
      return;
    }
    shortcutTiles.length = 0;
    queryHtmlElements(pageState.shortcutGrid, '.x-nt-shortcut-tile[data-shortcut-id]').forEach((tile) => {
      shortcutTiles.push(tile);
    });
  }

  function getShortcutReorderTiles(): HTMLElement[] {
    return pageState.shortcutGrid
      ? queryHtmlElements(pageState.shortcutGrid, '.x-nt-shortcut-tile[data-shortcut-id]')
      : [];
  }

  function getShortcutById(shortcutId: unknown): ShortcutItem | null {
    const id = String(shortcutId || '');
    if (!id) {
      return null;
    }
    return pageState.newtabShortcuts.find((item) => item && item.id === id) || null;
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
    pickShortcutIconPlateColor,
    getShortcutContextMenuOptions,
    updateShortcutLanguageStrings,
    closeShortcutDialog,
    openShortcutDialog,
    getShortcutTileFromNode,
    getShortcutTileId,
    refreshShortcutTileCacheFromDom,
    getShortcutReorderTiles,
    getShortcutById,
    getShortcutTileById,
    handleShortcutNativeDragStart,
    openShortcutEditor,
    isShortcutFolderAnchor
  };
}

type ShortcutPageActions = ReturnType<typeof createShortcutPageActions>;

export { createShortcutPageActions };
export type { ShortcutPageActions, ShortcutPageActionsDeps, ShortcutPageActionsState };
