// The page as a whole: following the window's visibility, focus and system
// theme, warming the favicon caches, the glass surfaces, resizing, and the
// page's keyboard shortcuts.
import * as NEWTAB_PAGE_KEYBOARD from '../page-keyboard';
import * as NEWTAB_PAGE_RESIZE from '../page-resize';
import * as NEWTAB_GLASS_SURFACES from '../theme/glass-surfaces';
import type { PageContext } from '../app/context';
import type { ShellFeature } from './shell';
import type { BookmarkStoreFeature } from './bookmark-store';
import type { TransfersFeature } from './transfers';
import type { BookmarkMenusFeature } from './bookmark-menus';
import type { SearchCoreFeature } from './search-core';
import type { RecentCoreFeature } from './recent-core';
import type { ThemeFeature } from './theme';
import type { LayoutFeature } from './layout';
import type { TopContentFeature } from './top-content';
import type { SectionsFeature } from './sections';
import type { DragsFeature } from './drags';
import type { SectionViewsFeature } from './section-views';
import type { SearchUiFeature } from './search-ui';

interface PageFeatureDeps {
  shell: ShellFeature;
  bookmarkStore: BookmarkStoreFeature;
  transfers: TransfersFeature;
  bookmarkMenus: BookmarkMenusFeature;
  searchCore: SearchCoreFeature;
  recentCore: RecentCoreFeature;
  theme: ThemeFeature;
  layout: LayoutFeature;
  topContent: TopContentFeature;
  sections: SectionsFeature;
  drags: DragsFeature;
  sectionViews: SectionViewsFeature;
  searchUi: SearchUiFeature;
}

function createPageFeature(ctx: PageContext, deps: PageFeatureDeps) {
  const { settings } = ctx;
  const suggestionsContainer = ctx.structure.suggestions.container;
  const { dismissStack, dragSessions, faviconCacheRuntime, hideToast, searchBox } = deps.shell;
  const { bookmarksShown } = deps.bookmarkStore;
  const { performBookmarkMoveHistoryAction } = deps.transfers;
  const {
    isFolderColorPickerOpen,
    positionBookmarkCascadeLevels,
    syncBookmarkTopbarSurfaceAppearance
  } = deps.bookmarkMenus;
  const { modeActions, scheduleThemeResolutionFlush, suggestionModifiers } = deps.searchCore;
  const { recentShown } = deps.recentCore;
  const { refreshThemeAwareFavicons, scheduleThemeAwareFaviconRescue, syncSystemThemeMode } = deps.theme;
  const {
    applyBookmarkGridColumns,
    applyNewtabShortcutColumns,
    applyNewtabWidthMode,
    applyRecentGridColumns,
    getBookmarkLimit,
    keepBookmarkPageAnchorAfterLimitChange,
    rememberSearchEntryViewport,
    updateBookmarkSectionPosition,
    updateSuggestionsFloatingLayout,
    viewportActivity
  } = deps.layout;
  const {
    animateRecentResizeLayout,
    cancelRecentResizeLayoutAnimations,
    captureRecentCardLayout,
    shouldAnimateNewtabLayoutShift
  } = deps.topContent;
  const { renderCurrentBookmarkPage, updateBookmarkGridHeightLock } = deps.sections;
  const { finishBookmarkDrag, finishShortcutDrag, recentCardDrag } = deps.drags;
  const { renderRecentSites } = deps.sectionViews;
  const { numberShortcutOptions, suggestionItems, tabKey } = deps.searchUi;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') {
      rememberSearchEntryViewport();
      hideToast();
    }
    if (document.visibilityState !== 'visible') {
      return;
    }
    syncSystemThemeMode();
  });
  window.addEventListener('pageshow', () => {
    hideToast();
    syncSystemThemeMode();
  });
  window.addEventListener('focus', () => {
    hideToast();
    syncSystemThemeMode();
  });
  window.addEventListener('blur', hideToast);
  window.addEventListener('pagehide', hideToast);

  // Kick off favicon cache warmup early; theme tint work flushes when storage is ready.
  void faviconCacheRuntime.ensureCachesReady().then(() => {
    scheduleThemeResolutionFlush(0);
    refreshThemeAwareFavicons();
    scheduleThemeAwareFaviconRescue();
  });

  const {
    followNewtabGlassStyle
  } = NEWTAB_GLASS_SURFACES.createGlassSurfaces({
    settings,
    syncBookmarkTopbarSurfaceAppearance
  });

  NEWTAB_PAGE_RESIZE.createPageResize({
    bookmarksShown,
    recentShown,
    modeActions,
    getBookmarkLimit,
    applyNewtabWidthMode,
    applyNewtabShortcutColumns,
    shouldAnimateNewtabLayoutShift,
    captureRecentCardLayout,
    applyRecentGridColumns,
    applyBookmarkGridColumns,
    keepBookmarkPageAnchorAfterLimitChange,
    renderCurrentBookmarkPage,
    updateBookmarkGridHeightLock,
    updateBookmarkSectionPosition,
    positionBookmarkCascadeLevels,
    updateSuggestionsFloatingLayout,
    cancelRecentResizeLayoutAnimations,
    renderRecentSites,
    animateRecentResizeLayout,
    viewport: viewportActivity
  });

  NEWTAB_PAGE_KEYBOARD.createPageKeyboard({
    isFolderColorPickerOpen,
    finishRecentCardDrag: recentCardDrag.finishRecentCardDrag,
    dragSessions,
    suggestionsContainer,
    searchBox,
    suggestionModifiers,
    handleSearchTabKey: tabKey.handle,
    dismissStack,
    finishShortcutDrag,
    finishBookmarkDrag,
    performBookmarkMoveHistoryAction,
    suggestionItems,
    numberShortcutOptions
  });

  return {
    followNewtabGlassStyle
  };
}

type PageFeature = ReturnType<typeof createPageFeature>;

export { createPageFeature };
export type { PageFeature };
