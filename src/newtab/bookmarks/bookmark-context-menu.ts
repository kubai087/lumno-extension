// Right-click menu for bookmark cards and folders.
import type { Disposition } from '../../domain/navigation-disposition';
import { isElementNode } from '../../shared/dom-guards';
import type { SelectMenuOption } from '../../shared/react/select-menu/menu-options';
import * as LumnoNewtabDismissStack from '../dismiss-stack';
import type { ContextMenuParts, SelectMenuController, Translate } from '../newtab-types';
import type { SelectMenuInstance } from '../react/select-menu';
import type { ShortcutSite } from '../shortcuts/shortcut-types';
import type { BookmarkDragSession } from './bookmark-drag';
import type { BookmarksRuntime } from './bookmarks-runtime';
import * as NEWTAB_BOOKMARKS_STORE from './bookmarks-store';
import { BOOKMARK_CONTEXT_MENU_EDIT_VALUE, BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE, FOLDER_COLOR_CONTEXT_MENU_VALUE, NEWTAB_CONTEXT_MENU_OPEN_VALUE } from '../menu-values';
import type { SurfaceLocale } from '../../shared/i18n/surface-locale';
import type { BookmarkSectionParts } from './bookmark-section-parts';

// The bookmark a context menu was opened for.
interface BookmarkContextTarget {
  bookmarkId: string;
  title: string;
  url: string;
  parentId: string;
  index: number;
  isFolder: boolean;
  sourceKind: 'cascade' | 'card';
  element: HTMLElement;
}

type BookmarkContextMenuParts = ContextMenuParts;

interface BookmarkContextMenuState {
  bookmarkDragState: BookmarkDragSession | null;
}

// A right-click on a bookmark card or a cascade row.
interface BookmarkItemContextMenuEvent {
  event: MouseEvent;
  item: { id?: string | number; title?: string; url?: string; type?: string; parentId?: string | number; index?: number };
  element: HTMLElement;
  parentFolderId?: string;
  sourceKind?: string;
}

interface BookmarkContextMenuDeps {
  bookmarksRuntime: BookmarksRuntime;
  t: Translate;
  openFolderColorPicker(folderId: string, title: string, sourceElement?: HTMLElement | null): Promise<void>;
  openExternalNewTabUrl(url: string, disposition: Disposition): unknown;
  openBookmarkEditor(target: BookmarkContextTarget): void;
  openBookmarkFolderTabGroupConfirmation(target: BookmarkContextTarget): void;
  deleteBookmarkFromContextTarget(target: BookmarkContextTarget): boolean;
  hasShortcutForSite(site: ShortcutSite): boolean;
  addSiteToShortcuts(site: ShortcutSite): unknown;
  hasShortcutForBookmarkFolder(bookmarkId: string): boolean;
  addBookmarkFolderToShortcuts(bookmarkId: string): Promise<boolean>;
  closeShortcutContextMenu(): void;
  closeRecentContextMenu(): void;
  hideCursorTooltip(): void;
  bookmarkContextMenuSelectController: SelectMenuController;
  bookmarkParts: Pick<BookmarkSectionParts, 'cascade' | 'view'>;
  pageState: BookmarkContextMenuState;
  locale: Pick<SurfaceLocale, 'store'>;
}

function createBookmarkContextMenu(deps: BookmarkContextMenuDeps) {
  const {
    bookmarkParts,
    bookmarkContextMenuSelectController,
    bookmarksRuntime,
    t,
    openFolderColorPicker,
    openExternalNewTabUrl,
    openBookmarkEditor,
    openBookmarkFolderTabGroupConfirmation,
    deleteBookmarkFromContextTarget,
    hasShortcutForSite,
    addSiteToShortcuts,
    hasShortcutForBookmarkFolder,
    addBookmarkFolderToShortcuts,
    closeShortcutContextMenu,
    closeRecentContextMenu,
    hideCursorTooltip,
    locale
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;
  // What the open menu acts on.
  let bookmarkContextMenuTarget: BookmarkContextTarget | null = null;
  // The menu, made the first time it opens.
  let bookmarkContextMenu: BookmarkContextMenuParts | null = null;

  const BOOKMARK_CONTEXT_MENU_REMOVE_VALUE = 'remove';
  const BOOKMARK_CONTEXT_MENU_ADD_SHORTCUT_VALUE = 'add-shortcut';
  const BOOKMARK_CONTEXT_MENU_MIN_WIDTH_PX = 124;
  const BOOKMARK_CONTEXT_MENU_MAX_WIDTH_PX = 240;
  const BOOKMARK_CONTEXT_MENU_PORTAL_Z_INDEX = 10060;
  const BOOKMARK_CONTEXT_MENU_PORTAL_OFFSET_PX = -6;

  function getBookmarkFolderOpenCount(target: BookmarkContextTarget | null | undefined): number {
    if (!target || !target.isFolder) {
      return 0;
    }
    const node = bookmarksRuntime.getNode(target.bookmarkId);
    return NEWTAB_BOOKMARKS_STORE.collectFolderBookmarkUrls(node).length;
  }

  function getBookmarkShortcutSite(target: BookmarkContextTarget): ShortcutSite {
    return { title: target.title, url: target.url };
  }

  function getBookmarkContextMenuOptions(target?: BookmarkContextTarget | null): SelectMenuOption[] {
    const options: SelectMenuOption[] = [];
    if (target && target.isFolder) {
      options.push({
        action: BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE,
        value: BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE,
        label: t('bookmarks_open_in_new_tab_group', 'Open in new tab group'),
        disabled: getBookmarkFolderOpenCount(target) <= 0
      });
      // Adds the folder as a folder shortcut; the folder itself stays.
      const isShortcut = hasShortcutForBookmarkFolder(target.bookmarkId);
      options.push({
        action: BOOKMARK_CONTEXT_MENU_ADD_SHORTCUT_VALUE,
        value: BOOKMARK_CONTEXT_MENU_ADD_SHORTCUT_VALUE,
        label: isShortcut
          ? t('newtab_shortcuts_already_added', 'Already in shortcuts')
          : t('recent_add_to_shortcuts', 'Add to shortcuts'),
        disabled: isShortcut
      });
    } else if (target && !target.isFolder) {
      options.push({
        action: NEWTAB_CONTEXT_MENU_OPEN_VALUE,
        value: NEWTAB_CONTEXT_MENU_OPEN_VALUE,
        label: t('newtab_open_in_new_tab', 'Open in new tab')
      });
      // Copies the site into the shortcuts and leaves the bookmark where
      // it is; dragging the bookmark onto the shortcuts moves it instead.
      const isShortcut = hasShortcutForSite(getBookmarkShortcutSite(target));
      options.push({
        action: BOOKMARK_CONTEXT_MENU_ADD_SHORTCUT_VALUE,
        value: BOOKMARK_CONTEXT_MENU_ADD_SHORTCUT_VALUE,
        label: isShortcut
          ? t('newtab_shortcuts_already_added', 'Already in shortcuts')
          : t('recent_add_to_shortcuts', 'Add to shortcuts'),
        disabled: isShortcut
      });
    }
    if (target && target.isFolder) {
      options.push({
        action: FOLDER_COLOR_CONTEXT_MENU_VALUE,
        value: FOLDER_COLOR_CONTEXT_MENU_VALUE,
        label: t('folder_color_change', 'Change color'),
        dividerBefore: true
      });
    }
    options.push(
      {
        action: BOOKMARK_CONTEXT_MENU_EDIT_VALUE,
        value: BOOKMARK_CONTEXT_MENU_EDIT_VALUE,
        label: target && target.isFolder
          ? t('folder_rename', 'Rename')
          : t('bookmarks_edit', 'Edit'),
        dividerBefore: options.length > 0 && !(target && target.isFolder)
      },
      {
        action: BOOKMARK_CONTEXT_MENU_REMOVE_VALUE,
        value: BOOKMARK_CONTEXT_MENU_REMOVE_VALUE,
        label: t('bookmarks_delete', 'Delete')
      }
    );
    return options;
  }

  function isBookmarkContextMenuOpen(): boolean {
    return Boolean(
      bookmarkContextMenu &&
      bookmarkContextMenuSelectController &&
      bookmarkContextMenuSelectController.isOpen(bookmarkContextMenu.control)
    );
  }

  function isBookmarkContextMenuNode(node: EventTarget | null): boolean {
    if (!isElementNode(node) || !bookmarkContextMenu) {
      return false;
    }
    const { control, menu } = bookmarkContextMenu;
    return control.contains(node) || menu.contains(node);
  }

  // The card or folder menu row the menu opened from shows it; none when closed.
  function setBookmarkContextMenuMark(target: BookmarkContextTarget | null): void {
    const cardId = target && target.sourceKind === 'card' ? target.bookmarkId : null;
    const rowId = target && target.sourceKind === 'cascade' ? target.bookmarkId : null;
    if (bookmarkParts.view) {
      bookmarkParts.view.setContextMenuBookmark(cardId);
    }
    if (bookmarkParts.cascade) {
      bookmarkParts.cascade.setContextMenuBookmark(rowId);
    }
  }

  function closeBookmarkContextMenu(): void {
    setBookmarkContextMenuMark(null);
    if (bookmarkContextMenu && bookmarkContextMenuSelectController) {
      bookmarkContextMenuSelectController.setOpen(bookmarkContextMenu.control, false);
    }
    bookmarkContextMenuTarget = null;
  }

  function getBookmarkContextMenuPoint(target: BookmarkContextTarget, event: MouseEvent | null | undefined): { x: number; y: number } {
    const clientX = Number(event && event.clientX);
    const clientY = Number(event && event.clientY);
    if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
      return { x: clientX, y: clientY };
    }
    const element = target.element;
    if (element) {
      const rect = element.getBoundingClientRect();
      return {
        x: rect.left + (rect.width / 2),
        y: rect.bottom
      };
    }
    return { x: 0, y: 0 };
  }

  function setBookmarkContextMenuPosition(target: BookmarkContextTarget, event: MouseEvent | null | undefined): void {
    if (!bookmarkContextMenu) {
      return;
    }
    const point = getBookmarkContextMenuPoint(target, event);
    bookmarkContextMenu.control.style.left = `${Math.round(point.x)}px`;
    bookmarkContextMenu.control.style.top = `${Math.round(point.y)}px`;
  }

  function handleBookmarkContextMenuAction(actionValue: unknown): void {
    const action = String(actionValue || '');
    const target = bookmarkContextMenuTarget;
    closeBookmarkContextMenu();
    if (!target || !action) {
      return;
    }
    if (action === FOLDER_COLOR_CONTEXT_MENU_VALUE && target.isFolder) {
      openFolderColorPicker(target.bookmarkId, target.title, target.element);
      return;
    }
    if (action === NEWTAB_CONTEXT_MENU_OPEN_VALUE) {
      openExternalNewTabUrl(target.url, 'newTab');
      return;
    }
    if (action === BOOKMARK_CONTEXT_MENU_ADD_SHORTCUT_VALUE) {
      if (target.isFolder) {
        addBookmarkFolderToShortcuts(target.bookmarkId);
      } else {
        addSiteToShortcuts(getBookmarkShortcutSite(target));
      }
      return;
    }
    if (action === BOOKMARK_CONTEXT_MENU_EDIT_VALUE) {
      openBookmarkEditor(target);
      return;
    }
    if (action === BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE) {
      openBookmarkFolderTabGroupConfirmation(target);
      return;
    }
    if (action === BOOKMARK_CONTEXT_MENU_REMOVE_VALUE) {
      deleteBookmarkFromContextTarget(target);
    }
  }

  function handleBookmarkContextMenuActionClick(event: MouseEvent): void {
    const target = event.target;
    const option = isElementNode(target)
      ? target.closest('._x_extension_select_option_2024_unique_')
      : null;
    if (!option || option.getAttribute('aria-disabled') === 'true' ||
        !bookmarkContextMenu ||
        !bookmarkContextMenu.menu.contains(option)) {
      return;
    }
    event.stopPropagation();
    handleBookmarkContextMenuAction(option.getAttribute('data-value'));
  }

  function handleBookmarkContextMenuDocumentPointerDown(event: PointerEvent): void {
    if (!isBookmarkContextMenuOpen() || isBookmarkContextMenuNode(event.target)) {
      return;
    }
    closeBookmarkContextMenu();
  }

  function createBookmarkContextMenu(): BookmarkContextMenuParts | null {
    if (!bookmarkContextMenuSelectController) {
      return null;
    }
    const created: SelectMenuInstance | null = bookmarkContextMenuSelectController.createSelect({
      id: '_x_extension_newtab_bookmark_context_menu_2026_unique_',
      selectId: '_x_extension_newtab_bookmark_context_menu_select_2026_unique_',
      className: 'x-nt-shortcut-context-menu x-nt-bookmark-context-menu',
      iconOnly: true,
      triggerIconName: 'ri-more-line',
      menuClassName: 'x-nt-shortcut-context-menu-portal x-nt-bookmark-context-menu-portal',
      menuAlign: 'middle',
      menuWidth: 'content',
      menuMinWidth: BOOKMARK_CONTEXT_MENU_MIN_WIDTH_PX,
      menuMaxWidth: BOOKMARK_CONTEXT_MENU_MAX_WIDTH_PX,
      menuPortal: true,
      menuPortalZIndex: BOOKMARK_CONTEXT_MENU_PORTAL_Z_INDEX,
      menuPortalOffset: BOOKMARK_CONTEXT_MENU_PORTAL_OFFSET_PX,
      value: BOOKMARK_CONTEXT_MENU_EDIT_VALUE,
      ariaLabel: t('bookmarks_context_menu_label', 'Bookmark actions'),
      options: getBookmarkContextMenuOptions(),
      onAction(payload) {
        handleBookmarkContextMenuAction(payload && payload.action);
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
    menu.addEventListener('click', handleBookmarkContextMenuActionClick);
    document.addEventListener('pointerdown', handleBookmarkContextMenuDocumentPointerDown, true);
    (document.body || document.documentElement).appendChild(control);
    return { control, select, trigger, menu };
  }

  function openBookmarkContextMenu(target: BookmarkContextTarget, event: MouseEvent): void {
    if (!target || !target.bookmarkId) {
      return;
    }
    if (!bookmarkContextMenu) {
      bookmarkContextMenu = createBookmarkContextMenu();
    }
    if (!bookmarkContextMenu || !bookmarkContextMenuSelectController) {
      return;
    }
    closeShortcutContextMenu();
    closeRecentContextMenu();
    closeBookmarkContextMenu();
    bookmarkContextMenuTarget = target;
    setBookmarkContextMenuMark(target);
    setBookmarkContextMenuPosition(target, event);
    bookmarkContextMenuSelectController.setOptions(
      bookmarkContextMenu.control,
      getBookmarkContextMenuOptions(target),
      target.isFolder
        ? BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE
        : NEWTAB_CONTEXT_MENU_OPEN_VALUE
    );
    bookmarkContextMenuSelectController.setOpen(bookmarkContextMenu.control, true);
  }

  // Opened over a folder menu, it is the layer Escape closes first.
  LumnoNewtabDismissStack.getDismissStack().register('bookmark-context-menu', {
    isOpen: isBookmarkContextMenuOpen,
    close: () => closeBookmarkContextMenu()
  });

  function handleBookmarkItemContextMenu(payload: BookmarkItemContextMenuEvent): void {
    const event = payload.event;
    const item = payload.item;
    const element = payload.element;
    if (!event || !item || !element || !item.id || pageState.bookmarkDragState) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    hideCursorTooltip();
    openBookmarkContextMenu({
      bookmarkId: String(item.id),
      title: String(item.title || ''),
      url: item.type === 'folder' ? '' : String(item.url || ''),
      parentId: String(item.parentId || payload.parentFolderId || ''),
      index: Number.isFinite(Number(item.index)) ? Number(item.index) : 0,
      isFolder: item.type === 'folder',
      sourceKind: payload.sourceKind === 'cascade' ? 'cascade' : 'card',
      element
    }, event);
  }


  function updateBookmarkContextMenuLanguageStrings(): void {
    if (!bookmarkContextMenu || !bookmarkContextMenuSelectController) {
      return;
    }
    bookmarkContextMenu.trigger.setAttribute(
      'aria-label',
      t('bookmarks_context_menu_label', 'Bookmark actions')
    );
    bookmarkContextMenuSelectController.setOptions(
      bookmarkContextMenu.control,
      getBookmarkContextMenuOptions(bookmarkContextMenuTarget),
      bookmarkContextMenuTarget && bookmarkContextMenuTarget.isFolder
        ? BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE
        : bookmarkContextMenuTarget
          ? NEWTAB_CONTEXT_MENU_OPEN_VALUE
          : BOOKMARK_CONTEXT_MENU_EDIT_VALUE
    );
  }
  // The menu draws its labels in the page's language.
  locale.store.subscribe(updateBookmarkContextMenuLanguageStrings);

  return {
    getBookmarkContextMenuOptions,
    isBookmarkContextMenuNode,
    closeBookmarkContextMenu,
    handleBookmarkItemContextMenu
  };
}

export { createBookmarkContextMenu };
export type {
  BookmarkContextMenuDeps,
  BookmarkContextMenuParts,
  BookmarkContextMenuState,
  BookmarkContextTarget,
  BookmarkItemContextMenuEvent
};
