// Acting on bookmarks from the page: editing one in the shortcut dialog,
// opening a folder as a tab group, the folder menu's opening and placing,
// folder colors, the bookmark context menu, and the bookmark bar's display
// settings and mode menu.
import * as NEWTAB_BOOKMARK_ACTIONS from '../bookmarks/bookmark-actions';
import * as NEWTAB_BOOKMARK_CASCADE_ACTIONS from '../bookmarks/bookmark-cascade-actions';
import * as NEWTAB_BOOKMARK_CONTEXT_MENU from '../bookmarks/bookmark-context-menu';
import * as NEWTAB_BOOKMARK_DISPLAY_SETTINGS from '../bookmarks/bookmark-display-settings';
import * as NEWTAB_FOLDER_COLORS from '../bookmarks/folder-colors';
import * as NEWTAB_BOOKMARK_MODE_MENU from '../bookmarks/bookmark-mode-menu';
import type { PageContext } from '../app/context';
import type { ShellFeature } from './shell';
import type { BookmarkStoreFeature } from './bookmark-store';
import type { ShortcutStoreFeature } from './shortcut-store';
import type { TransfersFeature } from './transfers';
import type { NavigationFeature } from './navigation';

interface BookmarkMenusFeatureDeps {
  shell: ShellFeature;
  bookmarkStore: BookmarkStoreFeature;
  shortcutStore: ShortcutStoreFeature;
  transfers: TransfersFeature;
  navigation: NavigationFeature;
}

function createBookmarkMenusFeature(ctx: PageContext, deps: BookmarkMenusFeatureDeps) {
  const { formatMessage, locale, settings, t } = ctx;
  const pageStructureRuntime = ctx.structure;
  const shortcutGrid = ctx.structure.shortcut.grid;
  const {
    appliedTheme,
    bindShortcutDialogTooltip,
    bookmarkContextMenuSelectController,
    dismissStack,
    dragSessions,
    getBrowserPageFaviconUrl,
    hideCursorTooltip,
    hideShortcutDialogTooltip,
    recentContextMenuSelectController,
    shortcutContextMenuSelectController,
    showToast
  } = deps.shell;
  const { bookmarkParts, bookmarksRuntime, bookmarksShown } = deps.bookmarkStore;
  const {
    addSiteToShortcuts,
    closeShortcutDialog,
    getFolderItemIcon,
    getFolderItemIconUrl,
    hasShortcutForSite,
    openShortcutDialog
  } = deps.shortcutStore;
  const {
    addBookmarkFolderToShortcuts,
    deleteBookmarkFromContextTarget,
    hasShortcutForBookmarkFolder
  } = deps.transfers;
  const { openExternalNewTabUrl } = deps.navigation;

  const {
    openBookmarkFolderTabGroupConfirmation,
    openBookmarkEditor
  } = NEWTAB_BOOKMARK_ACTIONS.createBookmarkActions({
    bookmarkParts,
    t,
    bookmarksRuntime,
    openShortcutDialog,
    formatMessage,
    showToast,
    getFolderItemIcon,
    getFolderItemIconUrl,
    getBrowserPageFaviconUrl
  });

  const {
    openBookmarkCascadeMenu,
    closeBookmarkCascadeMenu,
    syncOpenBookmarkCascadeAnchorVisual,
    positionBookmarkCascadeLevels,
    getTopBookmarks
  } = NEWTAB_BOOKMARK_CASCADE_ACTIONS.createBookmarkCascadeActions({
    shortcutGrid,
    bookmarkGrid: pageStructureRuntime.bookmark.grid,
    bookmarkParts,
    bookmarksShown,
    bookmarksRuntime,
    t
  });

  const {
    initFolderPathMorph,
    isFolderColorPickerOpen,
    scheduleFolderColorSync,
    loadFolderColors,
    openFolderColorPicker
  } = NEWTAB_FOLDER_COLORS.createFolderColors({
    settings,
    bookmarksRuntime,
    closeBookmarkCascadeMenu,
    closeShortcutDialog,
    hideCursorTooltip,
    t,
    bindShortcutDialogTooltip,
    hideShortcutDialogTooltip,
    showToast
  });
  dismissStack.setShouldIgnore(isFolderColorPickerOpen);

  const {
    isBookmarkContextMenuNode,
    closeBookmarkContextMenu,
    handleBookmarkItemContextMenu
  } = NEWTAB_BOOKMARK_CONTEXT_MENU.createBookmarkContextMenu({
    otherContextMenus: [shortcutContextMenuSelectController, recentContextMenuSelectController],
    dragSessions,
    bookmarkParts,
    locale,
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
    hideCursorTooltip
  });

  const {
    followBookmarkTopbar,
    bookmarkTopbarStorageKeys,
    getEffectiveBookmarkTopbarSurfaceMode,
    getBookmarkTopbarLayout,
    syncBookmarkTopbarSurfaceAppearance,
    handleBookmarkModeMenuAction
  } = NEWTAB_BOOKMARK_DISPLAY_SETTINGS.createBookmarkDisplaySettings({
    bookmarkParts,
    appliedTheme,
    settings,
    showToast,
    t
  });
  const initialBookmarkTopbarLayoutReady = followBookmarkTopbar();
  const { getBookmarkModeMenuOptions } = NEWTAB_BOOKMARK_MODE_MENU.createBookmarkModeMenu({
    settings,
    t,
    getEffectiveBookmarkTopbarSurfaceMode,
    getBookmarkTopbarLayout
  });

  return {
    bookmarkTopbarStorageKeys,
    closeBookmarkCascadeMenu,
    closeBookmarkContextMenu,
    getBookmarkModeMenuOptions,
    getBookmarkTopbarLayout,
    getEffectiveBookmarkTopbarSurfaceMode,
    getTopBookmarks,
    handleBookmarkItemContextMenu,
    handleBookmarkModeMenuAction,
    initFolderPathMorph,
    initialBookmarkTopbarLayoutReady,
    isBookmarkContextMenuNode,
    isFolderColorPickerOpen,
    loadFolderColors,
    openBookmarkCascadeMenu,
    openBookmarkEditor,
    openBookmarkFolderTabGroupConfirmation,
    openFolderColorPicker,
    positionBookmarkCascadeLevels,
    scheduleFolderColorSync,
    syncBookmarkTopbarSurfaceAppearance,
    syncOpenBookmarkCascadeAnchorVisual
  };
}

type BookmarkMenusFeature = ReturnType<typeof createBookmarkMenusFeature>;

export { createBookmarkMenusFeature };
export type { BookmarkMenusFeature };
