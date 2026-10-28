// Right-click menu for shortcut tiles and the add-shortcut tile.
import type { Disposition } from '../../domain/navigation-disposition';
import { isElementNode, isNode } from '../../shared/dom-guards';
import type { SelectMenuOption } from '../../shared/react/select-menu/menu-options';
import type { BookmarkEditTarget } from '../bookmarks/bookmark-actions';
import * as LumnoNewtabDismissStack from '../dismiss-stack';
import type { ContextMenuParts, SelectMenuController, Translate } from '../newtab-types';
import type { SelectMenuInstance } from '../react/select-menu';
import type { ShortcutContextMenuMark } from '../react/shortcuts';
import type { ShortcutDock } from './shortcut-dock';
import type { ShortcutContextTarget } from './shortcut-types';
import { isShortcutFolder } from '../../domain/shortcuts/normalize';
import type { ShortcutItem } from '../../domain/shortcuts/types';
import { BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE, FOLDER_COLOR_CONTEXT_MENU_VALUE, NEWTAB_CONTEXT_MENU_OPEN_VALUE, SHORTCUT_CONTEXT_MENU_EDIT_VALUE, SHORTCUT_CONTEXT_MENU_HIDE_ADD_VALUE, SHORTCUT_CONTEXT_MENU_REMOVE_VALUE, SHORTCUT_GROUP_MENU_VALUES } from '../menu-values';

interface ShortcutContextMenuState {
  shortcutContextMenu: ContextMenuParts | null;
  shortcutContextMenuSelectController: SelectMenuController | null;
  shortcutContextMenuTarget: ShortcutContextTarget | null;
  shortcutGrid: HTMLElement | null;
  shortcutSection: HTMLElement | null;
  addShortcutButton: HTMLElement | null;
}

interface ShortcutContextMenuDeps {
  // Draws the mark on what the menu is open for, or clears it.
  setShortcutContextMenuMark(mark: ShortcutContextMenuMark | null): void;
  getShortcutDockIcon: ShortcutDock['getShortcutDockIcon'];
  setShortcutDockHover: ShortcutDock['setShortcutDockHover'];
  resetShortcutDockHover(): void;
  getShortcutTileFromNode(node: EventTarget | null): HTMLElement | null;
  getShortcutById(shortcutId: unknown): ShortcutItem | null;
  hideShortcutAddFromContextMenu(sourceElement: HTMLElement): void;
  openFolderColorPicker(folderId: string, title: string, sourceElement?: HTMLElement | null): Promise<void>;
  getShortcutFolderId(shortcut: ShortcutItem): string;
  openShortcutEditor(shortcut: ShortcutItem, sourceElement: HTMLElement | null): void;
  // Opens a folder shortcut's menu, or its site.
  openShortcutUrl(shortcut: ShortcutItem): unknown;
  openExternalNewTabUrl(url: string, disposition: Disposition): unknown;
  removeShortcutById(shortcutId: string): unknown;
  openBookmarkFolderTabGroupConfirmation(target: BookmarkEditTarget): void;
  t: Translate;
  getShortcutContextMenuOptions(target?: ShortcutContextTarget | null): SelectMenuOption[];
  closeRecentContextMenu(): void;
  hideShortcutTooltip(): void;
  getShortcutTileId(tile: Element | null | undefined): string;
  openShortcutGroupDialog(groupId: string, sourceElement: HTMLElement): void;
  openShortcutAddDialog(sourceElement: HTMLElement, groupId?: string): void;
  moveShortcutGroup(groupId: string, offset: number): unknown;
  deleteShortcutGroup(groupId: string, keepSites: boolean): unknown;
  confirmDeleteShortcutGroupWithSites(groupId: string, sourceElement: HTMLElement): void;
  pageState: ShortcutContextMenuState;
}

function createShortcutContextMenu(deps: ShortcutContextMenuDeps) {
  // Escape closes the menu through the page's dismiss stack.
  const dismissStack = LumnoNewtabDismissStack.getDismissStack();
  const {
    setShortcutContextMenuMark,
    getShortcutDockIcon,
    setShortcutDockHover,
    resetShortcutDockHover,
    getShortcutTileFromNode,
    getShortcutById,
    hideShortcutAddFromContextMenu,
    openFolderColorPicker,
    getShortcutFolderId,
    openShortcutEditor,
    openShortcutUrl,
    openExternalNewTabUrl,
    removeShortcutById,
    openBookmarkFolderTabGroupConfirmation,
    t,
    getShortcutContextMenuOptions,
    closeRecentContextMenu,
    hideShortcutTooltip,
    getShortcutTileId,
    openShortcutGroupDialog,
    openShortcutAddDialog,
    moveShortcutGroup,
    deleteShortcutGroup,
    confirmDeleteShortcutGroupWithSites
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  const SHORTCUT_CONTEXT_MENU_MIN_WIDTH_PX = 124;
  const SHORTCUT_CONTEXT_MENU_MAX_WIDTH_PX = 180;
  const SHORTCUT_CONTEXT_MENU_PORTAL_Z_INDEX = 10040;
  const SHORTCUT_CONTEXT_MENU_PORTAL_OFFSET_PX = -6;

  function isShortcutContextMenuOpen(): boolean {
    return Boolean(
      pageState.shortcutContextMenu &&
      pageState.shortcutContextMenuSelectController &&
      pageState.shortcutContextMenuSelectController.isOpen(pageState.shortcutContextMenu.control)
    );
  }

  function isShortcutContextMenuNode(node: EventTarget | null): boolean {
    if (!isNode(node) || !pageState.shortcutContextMenu) {
      return false;
    }
    const { control, menu } = pageState.shortcutContextMenu;
    return control.contains(node) || menu.contains(node);
  }

  function clearShortcutContextMenuTileActive(): void {
    setShortcutContextMenuMark(null);
  }

  function setShortcutContextMenuTileActive(target: ShortcutContextTarget): void {
    clearShortcutContextMenuTileActive();
    setShortcutContextMenuMark(target.kind === 'shortcut'
      ? { kind: 'shortcut', shortcutId: target.shortcutId }
      : target.kind === 'group'
        ? { kind: 'group', groupId: target.groupId }
        : { kind: 'add' });
  }

  function getShortcutContextMenuAnchorElement(tile: HTMLElement): HTMLElement {
    return getShortcutDockIcon(tile) || tile;
  }

  function getShortcutContextMenuAnchorX(tile: HTMLElement): number | null {
    const anchor = getShortcutContextMenuAnchorElement(tile);
    const rect = anchor.getBoundingClientRect();
    const centerX = rect.left + (rect.width / 2);
    return Number.isFinite(centerX) ? centerX : null;
  }

  // Only a shortcut tile magnifies; a group title's menu button does not.
  function applyShortcutContextMenuDockHover(tile: HTMLElement | null): void {
    if (!tile || !tile.classList.contains('x-nt-shortcut-tile')) {
      return;
    }
    setShortcutDockHover(tile, getShortcutContextMenuAnchorX(tile), { settle: true });
  }

  function syncShortcutDockHoverFromPoint(clientX: unknown, clientY: unknown): void {
    const pointerX = Number(clientX);
    const pointerY = Number(clientY);
    if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY) ||
        typeof document.elementFromPoint !== 'function') {
      resetShortcutDockHover();
      return;
    }
    const tile = getShortcutTileFromNode(document.elementFromPoint(pointerX, pointerY));
    if (tile) {
      setShortcutDockHover(tile, pointerX);
      return;
    }
    resetShortcutDockHover();
  }

  // `syncHoverFromPointer` hands the dock to the pointer at the press that closed it.
  function closeShortcutContextMenu(options?: { syncHoverFromPointer?: boolean; clientX?: number; clientY?: number }): void {
    const closeOptions = options || {};
    if (!pageState.shortcutContextMenu || !pageState.shortcutContextMenuSelectController) {
      pageState.shortcutContextMenuTarget = null;
      clearShortcutContextMenuTileActive();
      return;
    }
    const wasOpen = isShortcutContextMenuOpen() || Boolean(pageState.shortcutContextMenuTarget);
    pageState.shortcutContextMenuSelectController.setOpen(pageState.shortcutContextMenu.control, false);
    pageState.shortcutContextMenuTarget = null;
    clearShortcutContextMenuTileActive();
    if (!wasOpen) {
      return;
    }
    if (closeOptions.syncHoverFromPointer) {
      syncShortcutDockHoverFromPoint(closeOptions.clientX, closeOptions.clientY);
      return;
    }
    resetShortcutDockHover();
  }

  function getShortcutContextMenuPoint(tile: HTMLElement): { x: number; y: number } {
    const rect = getShortcutContextMenuAnchorElement(tile).getBoundingClientRect();
    return {
      x: Math.round(rect.left + rect.width / 2),
      y: Math.round(rect.bottom)
    };
  }

  function setShortcutContextMenuPosition(tile: HTMLElement): void {
    if (!pageState.shortcutContextMenu) {
      return;
    }
    const point = getShortcutContextMenuPoint(tile);
    pageState.shortcutContextMenu.control.style.left = `${Math.round(point.x)}px`;
    pageState.shortcutContextMenu.control.style.top = `${Math.round(point.y)}px`;
  }

  function handleShortcutContextMenuAction(actionValue: unknown): void {
    const action = String(actionValue || '');
    const target = pageState.shortcutContextMenuTarget;
    const targetId = target && target.kind === 'shortcut'
      ? String(target.shortcutId || '')
      : '';
    const shortcut = getShortcutById(targetId);
    closeShortcutContextMenu();
    if (!target || !action) {
      return;
    }
    const sourceElement = target.tile;
    if (target.kind === 'add' && action === SHORTCUT_CONTEXT_MENU_HIDE_ADD_VALUE) {
      hideShortcutAddFromContextMenu(sourceElement);
      return;
    }
    if (action === SHORTCUT_GROUP_MENU_VALUES.create) {
      openShortcutGroupDialog('', sourceElement);
      return;
    }
    if (target.kind === 'add' && action === SHORTCUT_GROUP_MENU_VALUES.addShortcut) {
      openShortcutAddDialog(sourceElement);
      return;
    }
    if (target.kind === 'group') {
      handleShortcutGroupMenuAction(action, String(target.groupId || ''), sourceElement);
      return;
    }
    if (!shortcut) {
      return;
    }
    if (action === FOLDER_COLOR_CONTEXT_MENU_VALUE && isShortcutFolder(shortcut)) {
      openFolderColorPicker(getShortcutFolderId(shortcut), shortcut.title, sourceElement);
      return;
    }
    if (action === BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE && isShortcutFolder(shortcut)) {
      openBookmarkFolderTabGroupConfirmation({
        isFolder: true,
        bookmarkId: getShortcutFolderId(shortcut),
        title: shortcut.title,
        element: sourceElement
      });
      return;
    }
    if (action === SHORTCUT_CONTEXT_MENU_EDIT_VALUE) {
      openShortcutEditor(shortcut, sourceElement);
      return;
    }
    if (action === NEWTAB_CONTEXT_MENU_OPEN_VALUE) {
      if (isShortcutFolder(shortcut)) {
        openShortcutUrl(shortcut);
        return;
      }
      openExternalNewTabUrl(shortcut.url, 'newTab');
      return;
    }
    if (action === SHORTCUT_CONTEXT_MENU_REMOVE_VALUE) {
      removeShortcutById(targetId);
    }
  }

  function handleShortcutGroupMenuAction(action: string, groupId: string, sourceElement: HTMLElement): void {
    if (!groupId) {
      return;
    }
    if (action === SHORTCUT_GROUP_MENU_VALUES.rename) {
      openShortcutGroupDialog(groupId, sourceElement);
    } else if (action === SHORTCUT_GROUP_MENU_VALUES.addSite) {
      openShortcutAddDialog(sourceElement, groupId);
    } else if (action === SHORTCUT_GROUP_MENU_VALUES.moveUp) {
      moveShortcutGroup(groupId, -1);
    } else if (action === SHORTCUT_GROUP_MENU_VALUES.moveDown) {
      moveShortcutGroup(groupId, 1);
    } else if (action === SHORTCUT_GROUP_MENU_VALUES.delete) {
      deleteShortcutGroup(groupId, true);
    } else if (action === SHORTCUT_GROUP_MENU_VALUES.deleteWithSites) {
      confirmDeleteShortcutGroupWithSites(groupId, sourceElement);
    }
  }

  function handleShortcutContextMenuActionClick(event: MouseEvent): void {
    const target = event.target;
    const option = isElementNode(target)
      ? target.closest('._x_extension_select_option_2024_unique_')
      : null;
    if (!option || !pageState.shortcutContextMenu ||
        !pageState.shortcutContextMenu.menu.contains(option)) {
      return;
    }
    event.stopPropagation();
    handleShortcutContextMenuAction(option.getAttribute('data-value'));
  }

  // A button that opened the menu closes it when pressed again, instead
  // of the press closing it and the click opening it once more.
  let reopenBlockedAnchor: HTMLElement | null = null;

  // The menu's own outside-press handling may already have closed it, so
  // the menu's target, not its open state, says which button opened it.
  function handleShortcutContextMenuDocumentPointerDown(event: PointerEvent): void {
    const target = pageState.shortcutContextMenuTarget;
    if ((!target && !isShortcutContextMenuOpen()) || isShortcutContextMenuNode(event.target)) {
      return;
    }
    const anchor = target && target.kind !== 'shortcut' ? target.tile : null;
    reopenBlockedAnchor = anchor && isNode(event.target) && anchor.contains(event.target)
      ? anchor
      : null;
    closeShortcutContextMenu({
      syncHoverFromPointer: true,
      clientX: event.clientX,
      clientY: event.clientY
    });
  }

  dismissStack.register('shortcut-context-menu', {
    isOpen: () => Boolean(pageState.shortcutContextMenuTarget || isShortcutContextMenuOpen()),
    close: () => closeShortcutContextMenu()
  });

  function handleShortcutContextMenuDocumentFocusIn(event: FocusEvent): void {
    if (pageState.shortcutContextMenuTarget && !isShortcutContextMenuNode(event.target)) {
      closeShortcutContextMenu();
    }
  }

  function createShortcutContextMenu(): ContextMenuParts | null {
    if (!pageState.shortcutContextMenuSelectController) {
      return null;
    }
    const created: SelectMenuInstance | null = pageState.shortcutContextMenuSelectController.createSelect({
      id: '_x_extension_newtab_shortcut_context_menu_2026_unique_',
      selectId: '_x_extension_newtab_shortcut_context_menu_select_2026_unique_',
      className: 'x-nt-shortcut-context-menu',
      iconOnly: true,
      triggerIconName: 'ri-more-line',
      menuClassName: 'x-nt-shortcut-context-menu-portal',
      menuAlign: 'middle',
      menuWidth: 'content',
      menuMinWidth: SHORTCUT_CONTEXT_MENU_MIN_WIDTH_PX,
      menuMaxWidth: SHORTCUT_CONTEXT_MENU_MAX_WIDTH_PX,
      menuPortal: true,
      menuPortalZIndex: SHORTCUT_CONTEXT_MENU_PORTAL_Z_INDEX,
      menuPortalOffset: SHORTCUT_CONTEXT_MENU_PORTAL_OFFSET_PX,
      value: NEWTAB_CONTEXT_MENU_OPEN_VALUE,
      ariaLabel: t('newtab_shortcuts_context_menu_label', 'Shortcut actions'),
      options: getShortcutContextMenuOptions(),
      onAction(payload) {
        handleShortcutContextMenuAction(payload && payload.action);
      }
    });
    if (!created) {
      return null;
    }
    const control = created.wrapper;
    const select = created.select;
    const trigger = created.trigger;
    const menu = created.menu;
    trigger.tabIndex = -1;
    const stopContextMenuEvent = (event: Event): void => {
      event.stopPropagation();
    };
    [control, trigger, menu].forEach((element) => {
      element.addEventListener('pointerdown', stopContextMenuEvent);
      element.addEventListener('click', stopContextMenuEvent);
      element.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    });
    menu.addEventListener('click', handleShortcutContextMenuActionClick);
    document.addEventListener('pointerdown', handleShortcutContextMenuDocumentPointerDown, true);
    document.addEventListener('focusin', handleShortcutContextMenuDocumentFocusIn, true);
    (document.body || pageState.shortcutSection || document.documentElement).appendChild(control);
    return {
      control,
      select,
      trigger,
      menu
    };
  }

  function openShortcutContextMenu(target: ShortcutContextTarget): void {
    const tile = target.tile;
    const shortcutId = target.kind === 'shortcut'
      ? String(target.shortcutId || '')
      : '';
    if (!tile || (target.kind === 'shortcut' && !shortcutId) || (target.kind === 'group' && !target.groupId)) {
      return;
    }
    if (reopenBlockedAnchor === tile) {
      reopenBlockedAnchor = null;
      return;
    }
    reopenBlockedAnchor = null;
    if (!pageState.shortcutContextMenu) {
      pageState.shortcutContextMenu = createShortcutContextMenu();
    }
    if (!pageState.shortcutContextMenu || !pageState.shortcutContextMenuSelectController) {
      return;
    }
    closeRecentContextMenu();
    hideShortcutTooltip();
    resetShortcutDockHover();
    pageState.shortcutContextMenuTarget = target;
    setShortcutContextMenuTileActive(target);
    applyShortcutContextMenuDockHover(tile);
    setShortcutContextMenuPosition(tile);
    const defaultValue = target.kind === 'add'
      ? SHORTCUT_GROUP_MENU_VALUES.addShortcut
      : target.kind === 'group'
        ? SHORTCUT_GROUP_MENU_VALUES.rename
        : NEWTAB_CONTEXT_MENU_OPEN_VALUE;
    pageState.shortcutContextMenuSelectController.setOptions(
      pageState.shortcutContextMenu.control,
      getShortcutContextMenuOptions(target),
      defaultValue
    );
    pageState.shortcutContextMenu.select.value = defaultValue;
    pageState.shortcutContextMenuSelectController.sync(pageState.shortcutContextMenu.control);
    pageState.shortcutContextMenuSelectController.setOpen(pageState.shortcutContextMenu.control, true);
  }

  // A DOM or React contextmenu event on a tile.
  function handleShortcutContextMenu(
    event: Pick<MouseEvent, 'currentTarget' | 'target' | 'preventDefault' | 'stopPropagation'>
  ): void {
    const tile = getShortcutTileFromNode(event.currentTarget || event.target);
    if (!tile || !getShortcutTileId(tile)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    openShortcutContextMenu({
      kind: 'shortcut',
      shortcutId: getShortcutTileId(tile),
      tile
    });
  }

  function openShortcutGroupMenu(groupId: unknown, anchor: HTMLElement | null): void {
    if (!groupId || !anchor) {
      return;
    }
    openShortcutContextMenu({
      kind: 'group',
      groupId: String(groupId),
      tile: anchor
    });
  }

  function openShortcutAddContextMenu(sourceElement?: HTMLElement | null): void {
    const tile = sourceElement || pageState.addShortcutButton;
    if (!tile || tile.hidden) {
      return;
    }
    openShortcutContextMenu({
      kind: 'add',
      tile
    });
  }

  return {
    isShortcutContextMenuOpen,
    isShortcutContextMenuNode,
    clearShortcutContextMenuTileActive,
    applyShortcutContextMenuDockHover,
    closeShortcutContextMenu,
    handleShortcutContextMenu,
    openShortcutAddContextMenu,
    openShortcutGroupMenu
  };
}

type ShortcutContextMenu = ReturnType<typeof createShortcutContextMenu>;

export { createShortcutContextMenu };
export type { ShortcutContextMenu, ShortcutContextMenuDeps, ShortcutContextMenuState };
