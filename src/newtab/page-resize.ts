// Window resizes: re-measures the layout once per frame, and once more
// after the resize settles, without animating the blocks.
import type { SectionLoaders } from './section-loaders';
import type { RecentSite } from '../domain/recent-sites-store';
import type { SearchModeActions } from '../shared/search-panel/mode-actions';
import type { SiteSearchProvider } from '../domain/search/types';

// A card's place on screen before a layout change.
type CardLayout = Map<HTMLElement, { left: number; top: number }>;

interface PageResizeState {
  recentLoadedOnce: boolean;
  bookmarkLoadedOnce: boolean;
  recentSourceItems: RecentSite[];
  newtabReadyViewportRevision: number;
  // Holds the search box in place while the window is being resized.
  newtabResizeLayoutLocked: boolean;
  newtabReadyRequested: boolean;
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
  scheduleNewtabReadyAfterViewportSettle(): void;
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
    scheduleNewtabReadyAfterViewportSettle
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  const NEWTAB_RESIZE_DENSITY_SETTLE_MS = 140;

  let newtabResizeFrame = 0;
  let newtabResizeSettleTimer = 0;
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

  window.addEventListener('resize', () => {
    pageState.newtabReadyViewportRevision += 1;
    pageState.newtabResizeLayoutLocked = true;
    if (newtabResizeSettleTimer) {
      window.clearTimeout(newtabResizeSettleTimer);
    }
    // Releasing the lock re-centers the search box; layout motion eases it
    // there from where the resize held it.
    newtabResizeSettleTimer = window.setTimeout(() => {
      newtabResizeSettleTimer = 0;
      pageState.newtabResizeLayoutLocked = false;
      updateBookmarkSectionPosition();
    }, NEWTAB_RESIZE_DENSITY_SETTLE_MS);
    if (pageState.newtabReadyRequested &&
        document.body &&
        document.body.getAttribute('data-nt-ready') !== '1') {
      scheduleNewtabReadyAfterViewportSettle();
    }
    if (newtabResizeFrame) {
      return;
    }
    newtabResizeFrame = window.requestAnimationFrame(handleNewtabResize);
  }, { passive: true });
}

export { createPageResize };
export type { PageResizeDeps, PageResizeState };
