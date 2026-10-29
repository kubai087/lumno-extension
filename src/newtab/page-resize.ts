// Window resizes: re-measures the layout once per frame, and once more
// after the resize settles, without animating the blocks.
import type { SectionLoaders } from './section-loaders';
import type { RecentSite } from '../domain/recent-sites-store';
import type { SearchModeActions } from '../shared/search-panel/mode-actions';
import type { SiteSearchProvider } from '../domain/search/types';
import type { ViewportActivity } from './viewport-activity';

// A card's place on screen before a layout change.
type CardLayout = Map<HTMLElement, { left: number; top: number }>;

interface PageResizeState {
  recentLoadedOnce: boolean;
  bookmarkLoadedOnce: boolean;
  recentSourceItems: RecentSite[];
}

interface PageResizeDeps {
  modeActions: SearchModeActions<SiteSearchProvider>;
  getBookmarkLimit(): number;
  applyNewtabWidthMode(): void;
  applyNewtabShortcutColumns(): void;
  shouldAnimateNewtabLayoutShift(): boolean;
  captureRecentCardLayout(): CardLayout;
  // Each returns whether the grid's column count changed.
  applyRecentGridColumns(): boolean;
  applyBookmarkGridColumns(): boolean;
  keepBookmarkPageAnchorAfterLimitChange(previousLimit: number): void;
  renderCurrentBookmarkPage(): void;
  updateBookmarkGridHeightLock(): void;
  updateBookmarkSectionPosition(options?: { preserveSearchEntryLayout?: boolean; stabilizeDockDensity?: boolean }): void;
  positionBookmarkCascadeLevels(): void;
  updateSuggestionsFloatingLayout(): void;
  cancelRecentResizeLayoutAnimations(): void;
  renderRecentSites: SectionLoaders['renderRecentSites'];
  animateRecentResizeLayout(fromPositions: CardLayout | null): void;
  viewport: Pick<ViewportActivity, 'revision' | 'locked' | 'store'>;
  pageState: PageResizeState;
}

function createPageResize(deps: PageResizeDeps): void {
  const {
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
    viewport
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  let newtabResizeFrame = 0;
  function handleNewtabResize(): void {
    newtabResizeFrame = 0;
    const previousBookmarkLimit = getBookmarkLimit();
    applyNewtabWidthMode();
    applyNewtabShortcutColumns();
    const recentLayoutBefore = pageState.recentLoadedOnce && shouldAnimateNewtabLayoutShift()
      ? captureRecentCardLayout()
      : null;
    const recentColumnsChanged = applyRecentGridColumns();
    const bookmarkColumnsChanged = applyBookmarkGridColumns();
    modeActions.updateSiteSearchPrefixLayout();
    if (bookmarkColumnsChanged && pageState.bookmarkLoadedOnce) {
      keepBookmarkPageAnchorAfterLimitChange(previousBookmarkLimit);
      renderCurrentBookmarkPage();
    }
    updateBookmarkGridHeightLock();
    updateBookmarkSectionPosition({
      preserveSearchEntryLayout: true,
      stabilizeDockDensity: true
    });
    positionBookmarkCascadeLevels();
    updateSuggestionsFloatingLayout();
    if (recentColumnsChanged && pageState.recentLoadedOnce) {
      cancelRecentResizeLayoutAnimations();
      renderRecentSites(pageState.recentSourceItems);
      animateRecentResizeLayout(recentLayoutBefore);
    }
  }

  let last = viewport.store.getSnapshot();
  viewport.store.subscribe(() => {
    const next = viewport.store.getSnapshot();
    const resized = next.revision !== last.revision;
    const released = last.locked && !next.locked;
    last = next;
    // Releasing the lock re-centers the search box; layout motion eases it
    // there from where the resize held it.
    if (released) {
      updateBookmarkSectionPosition();
    }
    if (resized && !newtabResizeFrame) {
      newtabResizeFrame = window.requestAnimationFrame(handleNewtabResize);
    }
  });
}

export { createPageResize };
export type { PageResizeDeps, PageResizeState };
