(function(root) {
  // The New Tab entry animation and the ready signal once the viewport settles.
  function createEntryMotion(deps) {
    const {
      root,
      shouldSkipNewtabEntryMotion,
      updateBookmarkSectionPosition,
      finishWordmarkEntryAnimation,
      markNewtabStartupMilestone,
      rememberSearchEntryViewport,
      getSearchEntryViewportSnapshot,
      hasSearchEntryViewportChanged
    } = deps;

    // Page state still owned by newtab.js; read and written through accessors.
    const pageState = deps.pageState;

    const NEWTAB_INITIAL_VIEWPORT_SETTLE_MS = 32;
    const NEWTAB_ENTRY_ANIMATION_TOTAL_MS = 460;
    // Compared at reveal time: a viewport that never changed while the page loaded has settled.
    const startupViewport = getSearchEntryViewportSnapshot();
    let newtabReadySettleTimer = 0;
    let newtabEntryAnimationTimer = 0;

    function finishNewtabEntryAnimation() {
      if (newtabEntryAnimationTimer) {
        window.clearTimeout(newtabEntryAnimationTimer);
        newtabEntryAnimationTimer = 0;
      }
      if (document.body && document.body.getAttribute('data-nt-enter') === 'run') {
        document.body.setAttribute('data-nt-enter', 'done');
        root.setAttribute('data-lumno-search-entry', 'done');
        if (pageState.resolveNewtabEntryAnimationReady) {
          pageState.resolveNewtabEntryAnimationReady();
          pageState.resolveNewtabEntryAnimationReady = null;
        }
      }
    }

    function startNewtabEntryAnimation() {
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
        if (pageState.resolveNewtabEntryAnimationReady) {
          pageState.resolveNewtabEntryAnimationReady();
          pageState.resolveNewtabEntryAnimationReady = null;
        }
        return;
      }
      newtabEntryAnimationTimer = window.setTimeout(
        finishNewtabEntryAnimation,
        NEWTAB_ENTRY_ANIMATION_TOTAL_MS
      );
    }

    function revealNewtabWithoutEntryMotion() {
      if (!document.body) {
        return;
      }
      if (newtabReadySettleTimer) {
        window.clearTimeout(newtabReadySettleTimer);
        newtabReadySettleTimer = 0;
      }
      updateBookmarkSectionPosition({ releaseDockDensityLock: true });
      document.body.setAttribute('data-nt-enter', 'done');
      root.setAttribute('data-lumno-search-entry', 'done');
      finishWordmarkEntryAnimation();
      markNewtabStartupMilestone('ready-visible');
      document.body.setAttribute('data-nt-ready', '1');
      if (pageState.resolveNewtabEntryAnimationReady) {
        pageState.resolveNewtabEntryAnimationReady();
        pageState.resolveNewtabEntryAnimationReady = null;
      }
      rememberSearchEntryViewport();
    }

    function scheduleNewtabReadyAfterViewportSettle() {
      if (!pageState.newtabReadyRequested ||
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
      const viewportRevision = pageState.newtabReadyViewportRevision;
      const revealAfterViewportSettles = () => {
        newtabReadySettleTimer = 0;
        if (pageState.newtabResizeLayoutLocked ||
            viewportRevision !== pageState.newtabReadyViewportRevision ||
            hasSearchEntryViewportChanged(viewport)) {
          scheduleNewtabReadyAfterViewportSettle();
          return;
        }
        updateBookmarkSectionPosition({ releaseDockDensityLock: true });
        requestAnimationFrame(() => {
          if (pageState.newtabResizeLayoutLocked ||
              viewportRevision !== pageState.newtabReadyViewportRevision ||
              hasSearchEntryViewportChanged(viewport)) {
            scheduleNewtabReadyAfterViewportSettle();
            return;
          }
          markNewtabStartupMilestone('ready-visible');
          document.body.setAttribute('data-nt-ready', '1');
          startNewtabEntryAnimation();
          rememberSearchEntryViewport();
        });
      };
      // The wait only debounces resizes that arrive while the New Tab opens (the resize listener bumps
      // the revision). Without any since the page started, skip it; the frame check below still runs.
      if (viewportRevision === 0 &&
          !pageState.newtabResizeLayoutLocked &&
          !hasSearchEntryViewportChanged(startupViewport)) {
        revealAfterViewportSettles();
        return;
      }
      newtabReadySettleTimer = window.setTimeout(revealAfterViewportSettles, NEWTAB_INITIAL_VIEWPORT_SETTLE_MS);
    }

    function markNewtabReady() {
      if (!document.body) {
        return;
      }
      markNewtabStartupMilestone('ready-requested');
      pageState.newtabReadyRequested = true;
      scheduleNewtabReadyAfterViewportSettle();
    }

    return {
      finishNewtabEntryAnimation,
      scheduleNewtabReadyAfterViewportSettle,
      markNewtabReady
    };
  }

  root.LumnoNewtabEntryMotion = { createEntryMotion };
})(globalThis);
