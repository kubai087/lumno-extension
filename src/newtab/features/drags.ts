// The shortcut tiles and the drags across the page: the tiles drawn from
// the shortcuts, and the shortcut, bookmark and recent card drags with the
// moves they make.
import * as NEWTAB_BOOKMARK_DRAG_CONTROLLER from '../bookmarks/bookmark-drag-controller';
import * as NEWTAB_RECENT_CARD_DRAG from '../recent/recent-card-drag';
import * as NEWTAB_SHORTCUT_DRAG from '../shortcuts/shortcut-drag';
import * as NEWTAB_SHORTCUTS_CONTROLLER from '../shortcuts/shortcuts-controller';
import type { PageContext } from '../app/context';
import type { ShellFeature } from './shell';
import type { BookmarkStoreFeature } from './bookmark-store';
import type { ShortcutStoreFeature } from './shortcut-store';
import type { TransfersFeature } from './transfers';
import type { NavigationFeature } from './navigation';
import type { BookmarkMenusFeature } from './bookmark-menus';
import type { ShortcutMenusFeature } from './shortcut-menus';
import type { SearchCoreFeature } from './search-core';
import type { RecentCoreFeature } from './recent-core';
import type { ThemeFeature } from './theme';
import type { LayoutFeature } from './layout';
import type { SectionsFeature } from './sections';

interface DragsFeatureDeps {
  shell: ShellFeature;
  bookmarkStore: BookmarkStoreFeature;
  shortcutStore: ShortcutStoreFeature;
  transfers: TransfersFeature;
  navigation: NavigationFeature;
  bookmarkMenus: BookmarkMenusFeature;
  shortcutMenus: ShortcutMenusFeature;
  searchCore: SearchCoreFeature;
  recentCore: RecentCoreFeature;
  theme: ThemeFeature;
  layout: LayoutFeature;
  sections: SectionsFeature;
}

function createDragsFeature(ctx: PageContext, deps: DragsFeatureDeps) {
  const { formatMessage, locale, preview, settings, t } = ctx;
  const bookmarkSection = ctx.structure.bookmark.section;
  const pageStructureRuntime = ctx.structure;
  const shortcutGrid = ctx.structure.shortcut.grid;
  const shortcutSection = ctx.structure.shortcut.section;
  const {
    bindShortcutTooltip,
    dragSessions,
    hideCursorTooltip,
    hideShortcutTooltip,
    hideToast,
    hideTopActionTooltip,
    historyLock,
    showToast
  } = deps.shell;
  const {
    bookmarkLayoutAnimation,
    bookmarkMoveHistory,
    bookmarkParts,
    bookmarksRuntime,
    bookmarksShown
  } = deps.bookmarkStore;
  const {
    getFolderItemIconForShortcut,
    getShortcutById,
    getShortcutFolderId,
    getShortcutStoreOptions,
    moveShortcutGroupToIndex,
    openShortcutAddDialog,
    openShortcutGroupDialog,
    persistShortcuts,
    refreshShortcutFolderReferences,
    shortcutAreaScroll,
    shortcutData,
    shortcutFavicons,
    shortcutFolderRuntime,
    shortcutGroupHeaders,
    shortcutLayoutAnimation,
    shortcutList,
    shortcutTiles
  } = deps.shortcutStore;
  const {
    applyBookmarkShortcutTransfer,
    applyShortcutStack,
    moveBookmarkToShortcuts,
    persistBookmarkCrossLevelMove,
    persistBookmarkDragOrder
  } = deps.transfers;
  const { isMiddleClick } = deps.navigation;
  const {
    closeBookmarkCascadeMenu,
    closeBookmarkContextMenu,
    initFolderPathMorph,
    openBookmarkCascadeMenu,
    syncOpenBookmarkCascadeAnchorVisual
  } = deps.bookmarkMenus;
  const {
    applyNewtabShortcutDockMagnification,
    closeShortcutContextMenu,
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
  } = deps.shortcutMenus;
  const {
    getHostFromUrl,
    getImmediateThemeForSuggestion,
    getTileThemeOnSiteChange,
    queueThemeForTarget
  } = deps.searchCore;
  const { closeRecentContextMenu } = deps.recentCore;
  const { applyShortcutTileTheme, attachFaviconWithFallbacks } = deps.theme;
  const {
    applyNewtabShortcutLayoutPreferences,
    applyNewtabShortcutsVisibility,
    getBookmarkLimit,
    inferNewtabShortcutColumnsFromWidth,
    isCardActivationSuppressed,
    isContentSectionVisible,
    updateBookmarkSectionPosition
  } = deps.layout;
  const {
    getBookmarkPageCount,
    navigateBookmarkFolder,
    renderCurrentBookmarkPage,
    switchBookmarkPageDuringDrag
  } = deps.sections;

  const {
    getAddShortcutButton,
    renderShortcuts,
    flushDeferredShortcutRender,
    followNewtabShortcutPreferences,
    createShortcutsSection,
    fitShortcutGroupColumns
  } = NEWTAB_SHORTCUTS_CONTROLLER.createShortcutsController({
    openShortcutUrl,
    shortcutData,
    shortcutFavicons,
    locale,
    dragSessions,
    shortcutList,
    settings,
    shortcutFolderRuntime,
    shortcutLayoutAnimation,
    t,
    hideShortcutTooltip,
    closeShortcutContextMenu,
    syncOpenBookmarkCascadeAnchorVisual,
    applyNewtabShortcutsVisibility,
    updateBookmarkSectionPosition,
    applyNewtabShortcutLayoutPreferences,
    applyNewtabShortcutDockMagnification,
    inferNewtabShortcutColumnsFromWidth,
    formatMessage,
    resetShortcutDockHover,
    pageStructureRuntime,
    shortcutTiles,
    shortcutGroupHeaders,
    initFolderPathMorph,
    getHostFromUrl,
    getImmediateThemeForSuggestion,
    applyShortcutTileTheme,
    queueThemeForTarget,
    getTileThemeOnSiteChange,
    attachFaviconWithFallbacks,
    bindShortcutTooltip,
    isMiddleClick,
    isCardActivationSuppressed,
    handleShortcutContextMenu,
    handleShortcutNativeDragStart,
    openShortcutAddDialog,
    openShortcutGroupDialog,
    openShortcutAddContextMenu,
    handleShortcutDockPointerOver,
    handleShortcutDockPointerMove,
    syncShortcutDockFolderMenu,
    handleShortcutGroupMenu: openShortcutGroupMenu
  });

  const {
    isEmptyBookmarkRootHidden,
    getExternalBookmarkSurfacePoint,
    isValidExternalBookmarkDropTarget,
    getShortcutFolderDropTargetAt,
    getShortcutInsertionDropTarget,
    getExternalBookmarkDropTarget,
    isPointOverShortcutDropSurface,
    clearDragDropTarget,
    setDragDropTarget,
    getBookmarkDragPageSwitchDirection,
    clearBookmarkDragPageSwitch,
    clearBookmarkDragFolderSwitch,
    scheduleBookmarkDragFolderSwitch,
    scheduleBookmarkDragPageSwitch,
    finishBookmarkDrag,
    handleBookmarkDragPointerDown,
    handleBookmarkCascadeItemPointerDown
  } = NEWTAB_BOOKMARK_DRAG_CONTROLLER.createBookmarkDragController({
    shortcutAreaScroll,
    syncOpenBookmarkCascadeAnchorVisual,
    bookmarkLayoutAnimation,
    moveBookmarkToShortcuts,
    persistBookmarkDragOrder,
    persistBookmarkCrossLevelMove,
    dragSessions,
    historyLock,
    bookmarkPagerNextButton: pageStructureRuntime.bookmark.nextButton,
    bookmarkPagerPrevButton: pageStructureRuntime.bookmark.previousButton,
    bookmarkGrid: pageStructureRuntime.bookmark.grid,
    bookmarkParts,
    bookmarksShown,
    getAddShortcutButton,
    shortcutGrid,
    shortcutSection,
    shortcutList,
    settings,
    preview,
    getBookmarkLimit,
    initFolderPathMorph,
    isContentSectionVisible,
    bookmarkSection,
    bookmarksRuntime,
    getShortcutById,
    getShortcutFolderId,
    getShortcutStoreOptions,
    getBookmarkPageCount,
    openBookmarkCascadeMenu,
    navigateBookmarkFolder,
    switchBookmarkPageDuringDrag,
    hideCursorTooltip,
    closeBookmarkCascadeMenu,
    renderCurrentBookmarkPage,
    closeBookmarkContextMenu
  });

  createShortcutsSection();

  const {
    finishShortcutDrag
  } = NEWTAB_SHORTCUT_DRAG.createShortcutDrag({
    shortcutTiles,
    shortcutAreaScroll,
    shortcutLayoutAnimation,
    settings,
    dragSessions,
    historyLock,
    bookmarkGrid: pageStructureRuntime.bookmark.grid,
    bookmarkParts,
    getAddShortcutButton,
    shortcutGrid,
    shortcutList,
    renderShortcuts,
    flushDeferredShortcutRender,
    resetShortcutDockHover,
    persistShortcuts,
    bookmarkMoveHistory,
    hideCursorTooltip,
    closeBookmarkCascadeMenu,
    hideShortcutTooltip,
    isEmptyBookmarkRootHidden,
    renderCurrentBookmarkPage,
    getExternalBookmarkSurfacePoint,
    isPointOverShortcutDropSurface,
    clearBookmarkDragPageSwitch,
    clearBookmarkDragFolderSwitch,
    clearDragDropTarget,
    getBookmarkDragPageSwitchDirection,
    scheduleBookmarkDragPageSwitch,
    getShortcutFolderDropTargetAt,
    getExternalBookmarkDropTarget,
    setDragDropTarget,
    scheduleBookmarkDragFolderSwitch,
    getShortcutById,
    isValidExternalBookmarkDropTarget,
    bookmarksRuntime,
    getShortcutFolderId,
    bookmarkLayoutAnimation,
    applyBookmarkShortcutTransfer,
    applyShortcutStack,
    getFolderItemIconForShortcut,
    showToast,
    hideToast,
    t,
    formatMessage,
    refreshShortcutFolderReferences,
    isShortcutContextMenuNode,
    closeShortcutContextMenu,
    moveShortcutGroupToIndex,
    fitShortcutGroupColumns
  });

  const recentCardDrag = NEWTAB_RECENT_CARD_DRAG.createRecentCardDrag({
    settings,
    dragSessions,
    historyLock,
    bookmarkGrid: pageStructureRuntime.bookmark.grid,
    bookmarkParts,
    shortcutList,
    getShortcutStoreOptions,
    getShortcutFolderId,
    persistShortcuts,
    bookmarkMoveHistory,
    bookmarksRuntime,
    getExternalBookmarkSurfacePoint,
    getExternalBookmarkDropTarget,
    getShortcutFolderDropTargetAt,
    getShortcutInsertionDropTarget,
    isPointOverShortcutDropSurface,
    isValidExternalBookmarkDropTarget,
    shortcutAreaScroll,
    setDragDropTarget,
    clearDragDropTarget,
    getBookmarkDragPageSwitchDirection,
    scheduleBookmarkDragPageSwitch,
    clearBookmarkDragPageSwitch,
    scheduleBookmarkDragFolderSwitch,
    clearBookmarkDragFolderSwitch,
    applyBookmarkShortcutTransfer,
    bookmarkLayoutAnimation,
    isEmptyBookmarkRootHidden,
    renderCurrentBookmarkPage,
    closeBookmarkCascadeMenu,
    closeRecentContextMenu,
    hideCursorTooltip,
    hideTopActionTooltip,
    resetShortcutDockHover,
    showToast,
    t,
    formatMessage
  });

  return {
    finishBookmarkDrag,
    finishShortcutDrag,
    followNewtabShortcutPreferences,
    handleBookmarkCascadeItemPointerDown,
    handleBookmarkDragPointerDown,
    recentCardDrag
  };
}

type DragsFeature = ReturnType<typeof createDragsFeature>;

export { createDragsFeature };
export type { DragsFeature };
