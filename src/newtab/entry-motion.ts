// The New Tab entry animation and the ready signal once the viewport settles.
import type { ViewportActivity } from './viewport-activity';

interface EntryMotionState {
  // When the wallpaper was revealed (performance.now()).
  wallpaperShownAt: number;
}

// S is the layout's record of the viewport, which the entry motion only
// hands back to it.
interface EntryMotionDeps<S> {
  // The search box's container, which takes the entry state too.
  root: HTMLElement;
  shouldSkipNewtabEntryMotion(): boolean;
  updateBookmarkSectionPosition(): void;
  finishWordmarkEntryAnimation(): void;
  rememberSearchEntryViewport(): void;
  getSearchEntryViewportSnapshot(): S;
  hasSearchEntryViewportChanged(snapshot: S): boolean;
  viewport: Pick<ViewportActivity, 'revision' | 'locked' | 'store'>;
  // Runs once the entry animation finished or was skipped.
  onEntryDone(): void;
  pageState: EntryMotionState;
}

function createEntryMotion<S>(deps: EntryMotionDeps<S>) {
  const {
    root,
    shouldSkipNewtabEntryMotion,
    updateBookmarkSectionPosition,
    finishWordmarkEntryAnimation,
    rememberSearchEntryViewport,
    getSearchEntryViewportSnapshot,
    hasSearchEntryViewportChanged,
    viewport: viewportActivity
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  const NEWTAB_INITIAL_VIEWPORT_SETTLE_MS = 32;
  const NEWTAB_ENTRY_ANIMATION_TOTAL_MS = 260;
  // The wallpaper leads: the content starts entering at least this long after the wallpaper
  // showed (pageState.wallpaperShownAt), so the two never land in the same moment.
  const NEWTAB_WALLPAPER_LEAD_MS = 60;
  // Compared at reveal time: a viewport that never changed while the page loaded has settled.
  const startupViewport = getSearchEntryViewportSnapshot();
  let newtabReadySettleTimer = 0;
  let newtabEntryAnimationTimer = 0;
  let newtabWallpaperLeadTimer = 0;
  // Set once the page asked to be shown; it shows when the viewport settles.
  let readyRequested = false;
  let entryDone = false;

  function finishEntry(): void {
    if (!entryDone) {
      entryDone = true;
      deps.onEntryDone();
    }
  }

  // A resize while the page waits to show restarts the wait.
  let lastRevision = viewportActivity.revision;
  viewportActivity.store.subscribe(() => {
    if (viewportActivity.revision === lastRevision) {
      return;
    }
    lastRevision = viewportActivity.revision;
    if (readyRequested && document.body && document.body.getAttribute('data-nt-ready') !== '1') {
      scheduleNewtabReadyAfterViewportSettle();
    }
  });

  function getWallpaperLeadDelay(): number {
    const shownAt = Number(pageState.wallpaperShownAt) || 0;
    // The search shortcut's focus reload keeps the old page on screen until
    // this one is ready, so nothing lands at once and the lead only delays it.
    if (!shownAt || !document.body || document.body.getAttribute('data-wallpaper-active') !== 'true' ||
        document.documentElement.getAttribute('data-nt-focus-resume') === 'true') {
      return 0;
    }
    return Math.max(0, shownAt + NEWTAB_WALLPAPER_LEAD_MS - performance.now());
  }

  function finishNewtabEntryAnimation(): void {
    if (newtabEntryAnimationTimer) {
      window.clearTimeout(newtabEntryAnimationTimer);
      newtabEntryAnimationTimer = 0;
    }
    if (document.body && document.body.getAttribute('data-nt-enter') === 'run') {
      document.body.setAttribute('data-nt-enter', 'done');
      root.setAttribute('data-lumno-search-entry', 'done');
      finishEntry();
    }
  }

  function startNewtabEntryAnimation(): void {
    if (!document.body) {
      return;
    }
    if (newtabEntryAnimationTimer) {
      window.clearTimeout(newtabEntryAnimationTimer);
      newtabEntryAnimationTimer = 0;
    }
    const reduceMotion = shouldSkipNewtabEntryMotion();
    const entryState = reduceMotion ? 'done' : 'run';
    document.body.setAttribute('data-nt-enter', entryState);
    root.setAttribute('data-lumno-search-entry', entryState);
    if (reduceMotion) {
      finishEntry();
      return;
    }
    newtabEntryAnimationTimer = window.setTimeout(
      finishNewtabEntryAnimation,
      NEWTAB_ENTRY_ANIMATION_TOTAL_MS
    );
  }

  function revealNewtabWithoutEntryMotion(): void {
    if (!document.body) {
      return;
    }
    if (newtabReadySettleTimer) {
      window.clearTimeout(newtabReadySettleTimer);
      newtabReadySettleTimer = 0;
    }
    updateBookmarkSectionPosition();
    document.body.setAttribute('data-nt-enter', 'done');
    root.setAttribute('data-lumno-search-entry', 'done');
    finishWordmarkEntryAnimation();
    document.body.setAttribute('data-nt-ready', '1');
    finishEntry();
    rememberSearchEntryViewport();
  }

  function scheduleNewtabReadyAfterViewportSettle(): void {
    if (!readyRequested ||
        !document.body ||
        document.body.getAttribute('data-nt-ready') === '1') {
      return;
    }
    if (shouldSkipNewtabEntryMotion()) {
      revealNewtabWithoutEntryMotion();
      return;
    }
    if (newtabReadySettleTimer) {
      window.clearTimeout(newtabReadySettleTimer);
    }
    const viewport = getSearchEntryViewportSnapshot();
    const viewportRevision = viewportActivity.revision;
    const revealAfterViewportSettles = () => {
      newtabReadySettleTimer = 0;
      if (viewportActivity.locked ||
          viewportRevision !== viewportActivity.revision ||
          hasSearchEntryViewportChanged(viewport)) {
        scheduleNewtabReadyAfterViewportSettle();
        return;
      }
      updateBookmarkSectionPosition();
      requestAnimationFrame(() => {
        if (viewportActivity.locked ||
            viewportRevision !== viewportActivity.revision ||
            hasSearchEntryViewportChanged(viewport)) {
          scheduleNewtabReadyAfterViewportSettle();
          return;
        }
        document.body.setAttribute('data-nt-ready', '1');
        startNewtabEntryAnimation();
        rememberSearchEntryViewport();
      });
    };
    // The wait only debounces resizes that arrive while the New Tab opens (the resize listener bumps
    // the revision). Without any since the page started, skip it; the frame check below still runs.
    if (viewportRevision === 0 &&
        !viewportActivity.locked &&
        !hasSearchEntryViewportChanged(startupViewport)) {
      revealAfterViewportSettles();
      return;
    }
    newtabReadySettleTimer = window.setTimeout(revealAfterViewportSettles, NEWTAB_INITIAL_VIEWPORT_SETTLE_MS);
  }

  function markNewtabReady(): void {
    if (!document.body || newtabWallpaperLeadTimer) {
      return;
    }
    const leadDelay = getWallpaperLeadDelay();
    if (leadDelay > 0) {
      newtabWallpaperLeadTimer = window.setTimeout(() => {
        newtabWallpaperLeadTimer = 0;
        readyRequested = true;
        scheduleNewtabReadyAfterViewportSettle();
      }, leadDelay);
      return;
    }
    readyRequested = true;
    scheduleNewtabReadyAfterViewportSettle();
  }

  return {
    finishNewtabEntryAnimation,
    markNewtabReady
  };
}

type EntryMotion = ReturnType<typeof createEntryMotion>;

export { createEntryMotion };
export type { EntryMotion, EntryMotionDeps, EntryMotionState };
