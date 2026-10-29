// The page's layout: the section positions and grid sizes, the floating
// results' layout, the stored page preferences, the window's resizes, the
// bottom dock's parts, the wait for the entry animation, and the guard that
// keeps a drag's release from opening a card.
import * as NEWTAB_CARD_ACTIVATION_GUARD from '../../dom/card-activation-guard';
import * as NEWTAB_PAGE_LAYOUT from '../../page-layout';
import * as NEWTAB_PAGE_PREFERENCES from './page-preferences';
import * as NEWTAB_SUGGESTIONS_LAYOUT from '../../search/suggestions-layout';
import { ViewportActivity } from '../../viewport-activity';
import { BottomDockParts } from '../../shortcuts/bottom-dock-parts';
import type { PageContext } from '../../app/context';
import type { ServicesPart } from '../shell/services';
import type { BookmarkStorePart } from '../stores/bookmark-store';
import type { ShortcutStorePart } from '../stores/shortcut-store';
import type { ShortcutMenusPart } from '../menus/shortcut-menus';
import type { RecentCorePart } from '../sources/recent-core';

interface LayoutPartDeps {
  shell: ServicesPart;
  bookmarkStore: BookmarkStorePart;
  shortcutStore: ShortcutStorePart;
  shortcutMenus: ShortcutMenusPart;
  recentCore: RecentCorePart;
}

function createLayoutPart(ctx: PageContext, deps: LayoutPartDeps) {
  const { preview, settings } = ctx;
  const pageStructureRuntime = ctx.structure;
  const recentSection = ctx.structure.recent.section;
  const shortcutGrid = ctx.structure.shortcut.grid;
  const shortcutSection = ctx.structure.shortcut.section;
  const suggestionsContainer = ctx.structure.suggestions.container;
  const { searchBox } = deps.shell;
  const { bookmarksShown } = deps.bookmarkStore;
  const { closeShortcutDialog, getVisibleShortcuts, shortcutList } = deps.shortcutStore;
  const { closeShortcutContextMenu, resetShortcutDockHover } = deps.shortcutMenus;
  const { closeRecentContextMenu, recentPointer } = deps.recentCore;

  // The bottom dock's parts and the layout it drives, mounted with the dock.
  const bottomDockParts = new BottomDockParts();
  // Settles once the entry animation finished or was skipped.
  let finishEntryAnimationWait = (): void => {};
  const newtabEntryAnimationReadyPromise = new Promise<void>((resolve) => {
    finishEntryAnimationWait = resolve;
  });
  // The window's resizes, which hold the layout until they settle.
  const viewportActivity = new ViewportActivity();
  viewportActivity.follow(window);
  const { isCardActivationSuppressed } = NEWTAB_CARD_ACTIVATION_GUARD.createCardActivationGuard({ documentObj: document });

  const {
    syncSearchModeMenuResultOffset,
    setSuggestionsVisible,
    updateSuggestionsFloatingLayout
  } = NEWTAB_SUGGESTIONS_LAYOUT.createSuggestionsLayout({
    bottomDockParts,
    suggestionsContainer,
    searchBox
  });

  const {
    getBookmarkLimit,
    getBookmarkGridColumnCount,
    getEffectiveNewtabSearchWidth,
    getRecentLimit,
    getRecentSourceLimit,
    applyBookmarkGridColumns,
    keepBookmarkPageAnchorAfterLimitChange,
    applyRecentGridColumns,
    applyNewtabWidthMode,
    setNewtabSearchWidth,
    setContentSectionVisible,
    isContentSectionVisible,
    applyNewtabShortcutLayoutPreferences,
    applyNewtabShortcutColumns,
    applyNewtabShortcutsVisibility,
    getSearchEntryViewportSnapshot,
    hasSearchEntryViewportChanged,
    rememberSearchEntryViewport,
    beginSearchEntryRestoreLayoutLock,
    updateBookmarkSectionPosition,
    updateSearchEntryLayout,
    followShortcutGridLayout,
    followNewtabSearchWidth
  } = NEWTAB_PAGE_LAYOUT.createPageLayout({
    bookmarkGrid: pageStructureRuntime.bookmark.grid,
    bookmarksShown,
    recentSection,
    recentGrid: pageStructureRuntime.recent.grid,
    bottomDockParts,
    shortcutGrid,
    shortcutSection,
    shortcutList,
    preview,
    settings,
    updateSuggestionsFloatingLayout,
    closeRecentContextMenu,
    getVisibleShortcuts,
    resetShortcutDockHover,
    closeShortcutContextMenu,
    closeShortcutDialog,
    viewport: viewportActivity,
    recentPointer
  });

  const {
    inferNewtabShortcutColumnsFromWidth,
    setNewtabShortcutsVisible,
    setNewtabShortcutAddVisible,
    setNewtabShortcutDockMagnificationEnabled,
    setNewtabShortcutColumns,
    setNewtabShortcutSize,
    setNewtabShortcutGap,
    initialNewtabInputAutoFocusReadyTask
  } = NEWTAB_PAGE_PREFERENCES.createPagePreferences({
    preview,
    settings
  });

  return {
    applyBookmarkGridColumns,
    applyNewtabShortcutColumns,
    applyNewtabShortcutLayoutPreferences,
    applyNewtabShortcutsVisibility,
    applyNewtabWidthMode,
    applyRecentGridColumns,
    beginSearchEntryRestoreLayoutLock,
    bottomDockParts,
    finishEntryAnimationWait,
    followNewtabSearchWidth,
    followShortcutGridLayout,
    getBookmarkGridColumnCount,
    getBookmarkLimit,
    getEffectiveNewtabSearchWidth,
    getRecentLimit,
    getRecentSourceLimit,
    getSearchEntryViewportSnapshot,
    hasSearchEntryViewportChanged,
    inferNewtabShortcutColumnsFromWidth,
    initialNewtabInputAutoFocusReadyTask,
    isCardActivationSuppressed,
    isContentSectionVisible,
    keepBookmarkPageAnchorAfterLimitChange,
    newtabEntryAnimationReadyPromise,
    rememberSearchEntryViewport,
    setContentSectionVisible,
    setNewtabSearchWidth,
    setNewtabShortcutAddVisible,
    setNewtabShortcutColumns,
    setNewtabShortcutDockMagnificationEnabled,
    setNewtabShortcutGap,
    setNewtabShortcutSize,
    setNewtabShortcutsVisible,
    setSuggestionsVisible,
    syncSearchModeMenuResultOffset,
    updateBookmarkSectionPosition,
    updateSearchEntryLayout,
    updateSuggestionsFloatingLayout,
    viewportActivity
  };
}

type LayoutPart = ReturnType<typeof createLayoutPart>;

export { createLayoutPart };
export type { LayoutPart };
