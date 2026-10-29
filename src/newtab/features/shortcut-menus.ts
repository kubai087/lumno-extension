// Acting on shortcut tiles: finding a tile, opening a shortcut or its
// editor, the dock's magnification, and the shortcut context menu.
import * as NEWTAB_SHORTCUT_CONTEXT_MENU from '../shortcuts/shortcut-context-menu';
import * as NEWTAB_SHORTCUT_DOCK from '../dom/shortcut-dock';
import * as NEWTAB_SHORTCUT_PAGE_ACTIONS from '../shortcuts/shortcut-page-actions';
import type { PageContext } from '../app/context';
import type { ShellFeature } from './shell';
import type { BookmarkStoreFeature } from './bookmark-store';
import type { ShortcutStoreFeature } from './shortcut-store';
import type { NavigationFeature } from './navigation';
import type { BookmarkMenusFeature } from './bookmark-menus';

interface ShortcutMenusFeatureDeps {
  shell: ShellFeature;
  bookmarkStore: BookmarkStoreFeature;
  shortcutStore: ShortcutStoreFeature;
  navigation: NavigationFeature;
  bookmarkMenus: BookmarkMenusFeature;
}

function createShortcutMenusFeature(ctx: PageContext, deps: ShortcutMenusFeatureDeps) {
  const { locale, preview, settings, t } = ctx;
  const shortcutGrid = ctx.structure.shortcut.grid;
  const shortcutSection = ctx.structure.shortcut.section;
  const {
    bookmarkContextMenuSelectController,
    dragSessions,
    hideShortcutTooltip,
    recentContextMenuSelectController,
    shortcutContextMenuSelectController,
    showToast
  } = deps.shell;
  const { bookmarksRuntime } = deps.bookmarkStore;
  const {
    confirmDeleteShortcutGroupWithSites,
    deleteShortcutGroup,
    getShortcutById,
    getShortcutFolderId,
    getShortcutGroups,
    getShortcutIconDataUrl,
    getShortcutTitle,
    moveShortcutGroup,
    openShortcutAddDialog,
    openShortcutDialog,
    openShortcutGroupDialog,
    removeShortcutById,
    shortcutList
  } = deps.shortcutStore;
  const { openExternalNewTabUrl, openUrlFromNewtabCard } = deps.navigation;
  const {
    openBookmarkCascadeMenu,
    openBookmarkEditor,
    openBookmarkFolderTabGroupConfirmation,
    openFolderColorPicker
  } = deps.bookmarkMenus;

  const {
    openShortcutUrl,
    getShortcutContextMenuOptions,
    handleShortcutNativeDragStart,
    openShortcutEditor
  } = NEWTAB_SHORTCUT_PAGE_ACTIONS.createShortcutPageActions({
    showToast,
    openBookmarkCascadeMenu,
    openUrlFromNewtabCard,
    shortcutGrid,
    shortcutList,
    t,
    getShortcutGroups,
    bookmarksRuntime,
    getShortcutFolderId,
    getShortcutById,
    openShortcutDialog,
    openBookmarkEditor,
    getShortcutTitle,
    getShortcutIconDataUrl
  });

  const {
    applyNewtabShortcutDockMagnification,
    resetShortcutDockHover,
    setShortcutDockHover,
    holdShortcutDockHover,
    handleShortcutDockPointerOver,
    handleShortcutDockPointerMove,
    syncShortcutDockFolderMenu,
    followShortcutDockMagnification
  } = NEWTAB_SHORTCUT_DOCK.createShortcutDock({
    dragSessions,
    shortcutGrid,
    settings,
    preview
  });

  const {
    isShortcutContextMenuNode,
    closeShortcutContextMenu,
    handleShortcutContextMenu,
    openShortcutAddContextMenu,
    openShortcutGroupMenu
  } = NEWTAB_SHORTCUT_CONTEXT_MENU.createShortcutContextMenu({
    shortcutGrid,
    otherContextMenus: [bookmarkContextMenuSelectController, recentContextMenuSelectController],
    locale,
    settings,
    showToast,
    shortcutContextMenuSelectController,
    shortcutSection,
    setShortcutDockHover,
    resetShortcutDockHover,
    holdShortcutDockHover,
    getShortcutById,
    openFolderColorPicker,
    getShortcutFolderId,
    openShortcutEditor,
    openShortcutUrl,
    openExternalNewTabUrl,
    removeShortcutById,
    openBookmarkFolderTabGroupConfirmation,
    t,
    getShortcutContextMenuOptions,
    hideShortcutTooltip,
    openShortcutGroupDialog,
    openShortcutAddDialog,
    moveShortcutGroup,
    deleteShortcutGroup,
    confirmDeleteShortcutGroupWithSites
  });

  return {
    applyNewtabShortcutDockMagnification,
    closeShortcutContextMenu,
    followShortcutDockMagnification,
    handleShortcutContextMenu,
    handleShortcutDockPointerMove,
    handleShortcutDockPointerOver,
    handleShortcutNativeDragStart,
    isShortcutContextMenuNode,
    openShortcutAddContextMenu,
    openShortcutGroupMenu,
    openShortcutUrl,
    resetShortcutDockHover,
    syncShortcutDockFolderMenu
  };
}

type ShortcutMenusFeature = ReturnType<typeof createShortcutMenusFeature>;

export { createShortcutMenusFeature };
export type { ShortcutMenusFeature };
