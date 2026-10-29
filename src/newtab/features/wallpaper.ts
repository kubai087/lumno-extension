// The wallpaper and what follows its reveal: the section panel settings,
// the wallpaper page and its first image, the appearance ready once both
// are in, and the page's entry motion.
import * as NEWTAB_ENTRY_MOTION from '../entry-motion';
import * as LumnoNewtabSectionPanelSettings from '../section-panel-settings';
import * as NEWTAB_WALLPAPER_PAGE from '../wallpaper/wallpaper-page';
import { bookmarkColumns, bookmarkCount, bookmarkFolderIconsVisible, bookmarkViewMode, recentCount, recentMode } from '../../domain/settings';
import { BOOKMARK_TOPBAR_LAYOUT_ACTION, BOOKMARK_TOPBAR_PICK_COLOR_ACTION, BOOKMARK_TOPBAR_SURFACE_MODE_ACTION } from '../menu-values';
import type { PageContext } from '../app/context';
import type { ShellFeature } from './shell';
import type { BookmarkStoreFeature } from './bookmark-store';
import type { ShortcutStoreFeature } from './shortcut-store';
import type { NavigationFeature } from './navigation';
import type { BookmarkMenusFeature } from './bookmark-menus';
import type { ThemeFeature } from './theme';
import type { LayoutFeature } from './layout';
import type { TopContentFeature } from './top-content';

interface WallpaperFeatureDeps {
  shell: ShellFeature;
  bookmarkStore: BookmarkStoreFeature;
  shortcutStore: ShortcutStoreFeature;
  navigation: NavigationFeature;
  bookmarkMenus: BookmarkMenusFeature;
  theme: ThemeFeature;
  layout: LayoutFeature;
  topContent: TopContentFeature;
}

function createWallpaperFeature(ctx: PageContext, deps: WallpaperFeatureDeps) {
  const { formatMessage, localStorageArea, locale, preview, root, settings, t } = ctx;
  const pageStructureRuntime = ctx.structure;
  const shortcutGrid = ctx.structure.shortcut.grid;
  const topContentContainer = ctx.structure.topContent;
  const { appliedTheme, beginToast, hideTopActionTooltip, showToast, showTopActionTooltip } = deps.shell;
  const { bookmarkParts } = deps.bookmarkStore;
  const { shortcutGroupHeaders, shortcutTiles } = deps.shortcutStore;
  const { getFeedbackButton } = deps.navigation;
  const {
    bookmarkTopbarStorageKeys,
    getBookmarkTopbarLayout,
    getEffectiveBookmarkTopbarSurfaceMode,
    handleBookmarkModeMenuAction
  } = deps.bookmarkMenus;
  const {
    followTheme,
    getScopedThemeMode,
    getSelectedThemeMode,
    getThemeScope,
    setThemeMode,
    setThemeScope
  } = deps.theme;
  const {
    bottomDockParts,
    finishEntryAnimationWait,
    getEffectiveNewtabSearchWidth,
    getSearchEntryViewportSnapshot,
    hasSearchEntryViewportChanged,
    initialNewtabInputAutoFocusReadyTask,
    newtabEntryAnimationReadyPromise,
    rememberSearchEntryViewport,
    setNewtabSearchWidth,
    setNewtabShortcutAddVisible,
    setNewtabShortcutColumns,
    setNewtabShortcutDockMagnificationEnabled,
    setNewtabShortcutGap,
    setNewtabShortcutSize,
    setNewtabShortcutsVisible,
    updateBookmarkSectionPosition,
    viewportActivity
  } = deps.layout;
  const { finishWordmarkEntryAnimation, quoteRuntime, shouldSkipNewtabEntryMotion } = deps.topContent;

  const sectionPanelSettings = LumnoNewtabSectionPanelSettings.createRuntime({
    windowObj: window,
    chromeObj: chrome,
    t,
    watchedKeys: [
      bookmarkViewMode.key,
      bookmarkCount.key,
      bookmarkColumns.key,
      bookmarkFolderIconsVisible.key,
      recentMode.key,
      recentCount.key,
      ...bookmarkTopbarStorageKeys
    ],
    getBookmarkViewMode: () => settings.get(bookmarkViewMode),
    setBookmarkViewMode: (mode) => void settings.set(bookmarkViewMode, bookmarkViewMode.parse(mode)).catch(() => {}),
    getBookmarkCount: () => preview.get(bookmarkCount),
    setBookmarkCount: (value, options) => {
      preview.set(bookmarkCount, value, options);
    },
    getBookmarkColumns: () => preview.get(bookmarkColumns),
    setBookmarkColumns: (value, options) => {
      preview.set(bookmarkColumns, value, options);
    },
    getBookmarkFolderIconsVisible: () => preview.get(bookmarkFolderIconsVisible),
    setBookmarkFolderIconsVisible: (value, options) => {
      preview.set(bookmarkFolderIconsVisible, value, options);
    },
    // The bar's shape and background go through the same actions as its own menu.
    getBookmarkTopbarLayout: () => getBookmarkTopbarLayout(),
    setBookmarkTopbarLayout: (layout) => handleBookmarkModeMenuAction(`${BOOKMARK_TOPBAR_LAYOUT_ACTION}:${layout}`),
    getBookmarkTopbarSurfaceMode: () => getEffectiveBookmarkTopbarSurfaceMode(),
    setBookmarkTopbarSurfaceMode: (mode) => handleBookmarkModeMenuAction(
      `${BOOKMARK_TOPBAR_SURFACE_MODE_ACTION}:${mode}`
    ),
    pickBookmarkTopbarSurfaceColor: () => handleBookmarkModeMenuAction(BOOKMARK_TOPBAR_PICK_COLOR_ACTION),
    getRecentMode: () => settings.get(recentMode),
    setRecentMode: (mode) => void settings.set(recentMode, recentMode.parse(mode)).catch(() => {}),
    getRecentCount: () => preview.get(recentCount),
    setRecentCount: (value, options) => {
      preview.set(recentCount, value, options);
    }
  });

  const {
    wallpaperRuntime,
    bootstrapInitialWallpaper,
    markInitialWallpaperVisualReady,
    getWallpaperShownAt
  } = NEWTAB_WALLPAPER_PAGE.createWallpaperPage({
    topContentContainer,
    bookmarkPagerPrevButton: pageStructureRuntime.bookmark.previousButton,
    bookmarkTitleWrap: pageStructureRuntime.bookmark.titleWrap,
    bookmarkParts,
    recentHeader: pageStructureRuntime.recent.header,
    bottomDockParts,
    shortcutGrid,
    locale,
    appliedTheme,
    sectionPanelSettings,
    quoteRuntime,
    getFeedbackButton,
    settings,
    preview,
    shortcutTiles,
    shortcutGroupHeaders,
    getEffectiveBookmarkTopbarSurfaceMode,
    root,
    localStorageArea,
    t,
    formatMessage,
    getSelectedThemeMode,
    getScopedThemeMode,
    getThemeScope,
    setThemeMode,
    setThemeScope,
    showToast,
    beginToast,
    showTopActionTooltip,
    hideTopActionTooltip,
    getEffectiveNewtabSearchWidth,
    setNewtabSearchWidth,
    setNewtabShortcutsVisible,
    setNewtabShortcutAddVisible,
    setNewtabShortcutDockMagnificationEnabled,
    setNewtabShortcutColumns,
    setNewtabShortcutSize,
    setNewtabShortcutGap,
    newtabEntryAnimationReadyPromise,
    initialNewtabInputAutoFocusReadyTask,
    followTheme
  });

  const initialWallpaperOverlayReadyTask = wallpaperRuntime.bootstrapInitialWallpaperOverlay();
  const initialWallpaperVisualReadyTask = Promise.all([
    followTheme(),
    initialWallpaperOverlayReadyTask.then(() => bootstrapInitialWallpaper()),
    initialWallpaperOverlayReadyTask,
    wallpaperRuntime.bootstrapInitialWallpaperEffect()
  ]).then(() => wallpaperRuntime.waitForInitialWallpaperEffectVisual()).catch((error) => {
    console.warn('[Lumno] Initial new tab wallpaper setup failed.', error);
  }).then(() => {
    markInitialWallpaperVisualReady();
  });
  const initialAppearanceReadyTask = Promise.all([
    initialWallpaperVisualReadyTask,
    wallpaperRuntime.bootstrapInitialNewtabFavicon()
  ]).catch((error) => {
    console.warn('[Lumno] Initial new tab appearance setup failed.', error);
  });


  const {
    finishNewtabEntryAnimation,
    markNewtabReady
  } = NEWTAB_ENTRY_MOTION.createEntryMotion({
    getWallpaperShownAt,
    root,
    shouldSkipNewtabEntryMotion,
    updateBookmarkSectionPosition,
    finishWordmarkEntryAnimation,
    rememberSearchEntryViewport,
    getSearchEntryViewportSnapshot,
    hasSearchEntryViewportChanged,
    viewport: viewportActivity,
    onEntryDone: () => finishEntryAnimationWait()
  });

  return {
    finishNewtabEntryAnimation,
    initialAppearanceReadyTask,
    markNewtabReady,
    wallpaperRuntime
  };
}

type WallpaperFeature = ReturnType<typeof createWallpaperFeature>;

export { createWallpaperFeature };
export type { WallpaperFeature };
