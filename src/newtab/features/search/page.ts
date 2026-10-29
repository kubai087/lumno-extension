// The page as a whole: following the window's visibility, focus and system
// theme, warming the favicon caches, the glass surfaces, resizing, and the
// page's keyboard shortcuts.
import * as NEWTAB_PAGE_KEYBOARD from '../../page-keyboard';
import * as NEWTAB_PAGE_RESIZE from '../../page-resize';
import * as NEWTAB_GLASS_SURFACES from '../../theme/glass-surfaces';
import type { PageContext } from '../../app/context';
import type { ServicesPart } from '../shell/services';
import type { BookmarkStorePart } from '../stores/bookmark-store';
import type { TransfersPart } from '../stores/transfers';
import type { BookmarkMenusPart } from '../menus/bookmark-menus';
import type { SearchCorePart } from '../sources/search-core';
import type { RecentCorePart } from '../sources/recent-core';
import type { ThemePart } from '../appearance/theme';
import type { LayoutPart } from '../appearance/layout';
import type { TopContentPart } from '../appearance/top-content';
import type { HeadersPart } from '../sections/headers';
import type { DragsPart } from '../sections/drags';
import type { SectionViewsPart } from '../sections/section-views';
import type { SearchUiPart } from './search-ui';

interface PagePartDeps {
  shell: ServicesPart;
  bookmarkStore: BookmarkStorePart;
  transfers: TransfersPart;
  bookmarkMenus: BookmarkMenusPart;
  searchCore: SearchCorePart;
  recentCore: RecentCorePart;
  theme: ThemePart;
  layout: LayoutPart;
  topContent: TopContentPart;
  sections: HeadersPart;
  drags: DragsPart;
  sectionViews: SectionViewsPart;
  searchUi: SearchUiPart;
}

function createPagePart(ctx: PageContext, deps: PagePartDeps) {
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

type PagePart = ReturnType<typeof createPagePart>;

export { createPagePart };
export type { PagePart };
