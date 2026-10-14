(function(root) {
  // Loading and rendering the bookmark and recent-site sections.
  function createSectionLoaders(deps) {
    const {
      isShortcutDragActive,
      isRecentCardDragActive,
      resumeRecentCardDragAfterFolderSwitch,
      isBookmarkTopbarMode,
      scheduleShortcutDragMove,
      updateBookmarkDragLayoutCache,
      setBookmarkDragCardTransform,
      scheduleBookmarkDragMove,
      syncOpenBookmarkCascadeAnchorVisual,
      setBookmarkSurfaceVisible,
      updateBookmarkGridHeightLock,
      updateBookmarkSectionPosition,
      updateBookmarkPagerState,
      normalizeRecentSiteRecord,
      getRecentSiteUrlKey,
      writeHiddenRecentSites,
      shouldExcludeFromRecentSites,
      isRecentSiteHidden,
      mergeRecentSitesWithPinned,
      getRecentLimit,
      setContentSectionVisible,
      recentSection,
      bookmarksRuntime,
      closeBookmarkCascadeMenu,
      bootstrapInitialThemeMode,
      areFaviconRenderCachesReady,
      FAVICON_CACHE_BOOT_WAIT_MS,
      waitForFaviconRenderCaches,
      getTopBookmarks,
      getBookmarkLimit,
      getBookmarkPageCount,
      updateBookmarkBreadcrumb,
      renderCurrentBookmarkPage,
      playPendingBookmarkLayoutAnimation,
      renderShortcuts,
      getRecentSourceLimit,
      getRecentSites,
      MAX_PINNED_RECENT_SITES,
      beginSearchEntryRestoreLayoutLock
    } = deps;

    // Page state still owned by newtab.js; read and written through accessors.
    const pageState = deps.pageState;

    let bookmarkLoadToken = 0;
    let bookmarkDataDirty = true;
    let recentLoadToken = 0;
    let recentDataDirty = true;

    // A drag shows the empty bookmarks bar as a drop target. The search box
    // holds still meanwhile, so the dock grows over free space, and the bar
    // stays hidden when it would cover shortcuts: the shortcut area would
    // then shrink and scroll under the pointer.
    function isDragActive() {
      return Boolean((pageState.bookmarkDragState && pageState.bookmarkDragState.isDragging) ||
        isShortcutDragActive() || isRecentCardDragActive());
    }

    function getShortcutAreaLimit() {
      const section = typeof document !== 'undefined' && document.querySelector
        ? document.querySelector('.x-nt-shortcuts-section')
        : null;
      return section && section.style ? section.style.getPropertyValue('--x-nt-shortcuts-max-height') : '';
    }

    function showEmptyBookmarkRoot(visible, keepForDrag) {
      const limitBefore = getShortcutAreaLimit();
      const layoutOptions = isDragActive() ? { preserveSearchEntryLayout: true } : undefined;
      setBookmarkSurfaceVisible(visible);
      updateBookmarkGridHeightLock();
      updateBookmarkSectionPosition(layoutOptions);
      const limitAfter = getShortcutAreaLimit();
      const coversShortcuts = keepForDrag && limitAfter &&
        (!limitBefore || Number.parseFloat(limitAfter) < Number.parseFloat(limitBefore));
      if (!coversShortcuts) {
        return;
      }
      if (pageState.bookmarkGrid) {
        pageState.bookmarkGrid.removeAttribute('data-bookmark-empty-drop-surface');
      }
      setBookmarkSurfaceVisible(false);
      updateBookmarkGridHeightLock();
      updateBookmarkSectionPosition(layoutOptions);
    }

    function renderBookmarks(items) {
      const normalizedItems = Array.isArray(items) ? items : [];
      const isAtRoot = String(pageState.bookmarkCurrentFolderId || '') === String(pageState.bookmarkRootFolderId || '1');
      const keepEmptyRootVisibleForDrag = Boolean(
        isAtRoot &&
        normalizedItems.length === 0 &&
        ((pageState.bookmarkDragState && pageState.bookmarkDragState.isDragging) ||
          isShortcutDragActive() || isRecentCardDragActive())
      );
      if (pageState.bookmarkGrid) {
        if (keepEmptyRootVisibleForDrag) {
          pageState.bookmarkGrid.setAttribute('data-bookmark-empty-drop-surface', 'true');
        } else {
          pageState.bookmarkGrid.removeAttribute('data-bookmark-empty-drop-surface');
        }
      }
      const renderResult = pageState.bookmarksView.render(normalizedItems, {
        signature: pageState.bookmarkRenderSignature,
        folderId: pageState.bookmarkCurrentFolderId,
        rootFolderId: pageState.bookmarkRootFolderId,
        viewMode: pageState.currentBookmarkViewMode,
        menuMode: pageState.currentBookmarkViewMode === 'list' || isBookmarkTopbarMode()
      });
      if (pageState.shortcutDragState && pageState.shortcutDragState.isDragging &&
          pageState.shortcutDragState.folderSwitchPendingId === String(pageState.bookmarkCurrentFolderId || '')) {
        pageState.shortcutDragState.folderSwitchPendingId = '';
        scheduleShortcutDragMove(pageState.shortcutDragState, pageState.shortcutDragState.pendingPointerX, pageState.shortcutDragState.pendingPointerY);
      }
      resumeRecentCardDragAfterFolderSwitch(pageState.bookmarkCurrentFolderId);
      if (pageState.bookmarkDragState &&
          pageState.bookmarkDragState.isDragging &&
          pageState.bookmarkDragState.folderSwitchPendingId ===
            String(pageState.bookmarkCurrentFolderId || '')) {
        const activeDragState = pageState.bookmarkDragState;
        activeDragState.folderSwitchPendingId = '';
        updateBookmarkDragLayoutCache(activeDragState);
        setBookmarkDragCardTransform(
          activeDragState,
          Number(activeDragState.pendingPointerX),
          Number(activeDragState.pendingPointerY)
        );
        scheduleBookmarkDragMove(
          activeDragState,
          Number(activeDragState.pendingPointerX),
          Number(activeDragState.pendingPointerY)
        );
      }
      syncOpenBookmarkCascadeAnchorVisual();
      if (!renderResult.changed) {
        if (normalizedItems.length === 0) {
          showEmptyBookmarkRoot(!isAtRoot || keepEmptyRootVisibleForDrag, keepEmptyRootVisibleForDrag);
        } else {
          setBookmarkSurfaceVisible(true);
          updateBookmarkGridHeightLock();
          updateBookmarkSectionPosition();
        }
        updateBookmarkPagerState();
        return;
      }
      pageState.bookmarkRenderSignature = renderResult.signature;
      if (normalizedItems.length === 0) {
        showEmptyBookmarkRoot(!isAtRoot || keepEmptyRootVisibleForDrag, keepEmptyRootVisibleForDrag);
        updateBookmarkPagerState();
        return;
      }
      setBookmarkSurfaceVisible(true);
      updateBookmarkPagerState();
      updateBookmarkGridHeightLock();
      updateBookmarkSectionPosition();
    }

    function renderRecentSites(items) {
      if (pageState.currentRecentMode === 'custom') {
        pageState.recentSourceItems = Array.isArray(items) ? items.slice() : [];
        const customItems = deps.getCustomRecentPageItems(pageState.recentSourceItems, getRecentLimit());
        const result = pageState.recentSitesView.render(customItems, { signature: pageState.recentRenderSignature });
        pageState.recentRenderSignature = result.signature;
        deps.syncCustomRecentSitesUi();
        setContentSectionVisible(recentSection, getRecentLimit() > 0);
        updateBookmarkSectionPosition();
        return;
      }
      if (deps.syncCustomRecentSitesUi) deps.syncCustomRecentSitesUi();
      const sourceItems = Array.isArray(items) ? items : [];
      const resolvedHiddenUrls = new Set();
      sourceItems.forEach((item) => {
        const normalizedItem = normalizeRecentSiteRecord(item);
        if (!normalizedItem) {
          return;
        }
        const key = getRecentSiteUrlKey(normalizedItem);
        if (!key) {
          return;
        }
        const hiddenEntry = pageState.hiddenRecentSites.find((entry) => entry && entry.url === key);
        if (!hiddenEntry) {
          return;
        }
        if ((Number(normalizedItem.lastVisitTime) || 0) > (Number(hiddenEntry.lastVisitTime) || 0)) {
          resolvedHiddenUrls.add(key);
        }
      });
      if (resolvedHiddenUrls.size > 0) {
        writeHiddenRecentSites(
          pageState.hiddenRecentSites.filter((entry) => entry && !resolvedHiddenUrls.has(entry.url))
        );
      }
      const normalizedSourceItems = sourceItems
        .filter((item) => {
          const url = item && item.url ? String(item.url) : '';
          return !shouldExcludeFromRecentSites(url) && !isRecentSiteHidden(item);
        });
      pageState.recentSourceItems = normalizedSourceItems.slice();
      const mergedItems = mergeRecentSitesWithPinned(normalizedSourceItems, getRecentLimit());
      const renderResult = pageState.recentSitesView.render(mergedItems, {
        signature: pageState.recentRenderSignature
      });
      if (!renderResult.changed) {
        if (mergedItems.length === 0) {
          setContentSectionVisible(recentSection, false);
        } else {
          setContentSectionVisible(recentSection, true);
        }
        updateBookmarkSectionPosition();
        return;
      }
      pageState.recentRenderSignature = renderResult.signature;
      if (mergedItems.length === 0) {
        setContentSectionVisible(recentSection, false);
        updateBookmarkSectionPosition();
        return;
      }
      setContentSectionVisible(recentSection, true);
      updateBookmarkSectionPosition();
    }

    function markBookmarkDataDirty() {
      bookmarkDataDirty = true;
    }

    function markBookmarkTreeDirty(options) {
      const preserveCascadeOpen = Boolean(options && options.preserveCascadeOpen);
      bookmarkDataDirty = true;
      if (!options || options.skipRuntimeInvalidate !== true) {
        bookmarksRuntime.invalidate();
      }
      if (!preserveCascadeOpen) {
        closeBookmarkCascadeMenu();
      }
    }

    function markRecentDataDirty() {
      recentDataDirty = true;
    }

    function loadBookmarks(options) {
      const config = options || {};
      const requestedSectionDataRevision = Number.isFinite(Number(config.sectionDataRevision))
        ? Number(config.sectionDataRevision)
        : pageState.sectionDataRevision;
      if (!pageState.initialThemeApplied) {
        return bootstrapInitialThemeMode().then(() => loadBookmarks({
          ...config,
          sectionDataRevision: requestedSectionDataRevision
        }));
      }
      const forceReload = Boolean(config.force);
      const skipFaviconWait = Boolean(config.skipFaviconWait);
      if (!skipFaviconWait && !areFaviconRenderCachesReady()) {
        const waitMs = forceReload ? Math.min(80, FAVICON_CACHE_BOOT_WAIT_MS) : FAVICON_CACHE_BOOT_WAIT_MS;
        return waitForFaviconRenderCaches(waitMs).then(() => (
          loadBookmarks({
            ...config,
            force: forceReload,
            skipFaviconWait: true,
            sectionDataRevision: requestedSectionDataRevision
          })
        ));
      }
      if (!forceReload && !bookmarkDataDirty && pageState.bookmarkLoadedOnce) {
        updateBookmarkSectionPosition();
        return Promise.resolve();
      }
      const requestToken = ++bookmarkLoadToken;
      if (!pageState.currentBookmarkCount || pageState.currentBookmarkCount <= 0) {
        closeBookmarkCascadeMenu();
        pageState.bookmarkAllItems = [];
        pageState.bookmarkRootTotalCount = 0;
        pageState.bookmarkRootVisibleCount = 0;
        pageState.bookmarkCurrentPage = 0;
        pageState.bookmarkRenderSignature = '';
        pageState.bookmarksView.clear();
        setBookmarkSurfaceVisible(false);
        bookmarkDataDirty = false;
        pageState.bookmarkLoadedOnce = true;
        updateBookmarkSectionPosition();
        return Promise.resolve();
      }
      return getTopBookmarks(0, pageState.bookmarkCurrentFolderId).then((items) => {
        if (requestToken !== bookmarkLoadToken ||
            requestedSectionDataRevision !== pageState.sectionDataRevision) {
          return;
        }
        if (!pageState.currentBookmarkCount || pageState.currentBookmarkCount <= 0) {
          closeBookmarkCascadeMenu();
          pageState.bookmarkAllItems = [];
          pageState.bookmarkRootTotalCount = 0;
          pageState.bookmarkRootVisibleCount = 0;
          pageState.bookmarkCurrentPage = 0;
          pageState.bookmarkRenderSignature = '';
          pageState.bookmarksView.clear();
          setBookmarkSurfaceVisible(false);
          bookmarkDataDirty = false;
          pageState.bookmarkLoadedOnce = true;
          updateBookmarkSectionPosition();
          return;
        }
        pageState.bookmarkAllItems = Array.isArray(items) ? items : [];
        const isAtRoot = String(pageState.bookmarkCurrentFolderId || '') === String(pageState.bookmarkRootFolderId || '1');
        if (isAtRoot) {
          pageState.bookmarkRootTotalCount = pageState.bookmarkAllItems.length;
          pageState.bookmarkRootVisibleCount = Math.min(getBookmarkLimit(), pageState.bookmarkAllItems.length);
        }
        const pageCount = getBookmarkPageCount();
        if (pageState.bookmarkCurrentPage > (pageCount - 1)) {
          pageState.bookmarkCurrentPage = pageCount - 1;
        }
        if (pageState.bookmarkCurrentPage < 0) {
          pageState.bookmarkCurrentPage = 0;
        }
        updateBookmarkBreadcrumb();
        renderCurrentBookmarkPage();
        playPendingBookmarkLayoutAnimation();
        if (!isShortcutDragActive() && pageState.newtabShortcuts.some((shortcut) => shortcut.type === 'folder')) {
          renderShortcuts();
        }
        bookmarkDataDirty = false;
        pageState.bookmarkLoadedOnce = true;
      });
    }

    function loadRecentSites(options) {
      const config = options || {};
      const requestedSectionDataRevision = Number.isFinite(Number(config.sectionDataRevision))
        ? Number(config.sectionDataRevision)
        : pageState.sectionDataRevision;
      if (!pageState.initialThemeApplied) {
        return bootstrapInitialThemeMode().then(() => loadRecentSites({
          ...config,
          sectionDataRevision: requestedSectionDataRevision
        }));
      }
      const forceReload = Boolean(config.force);
      const skipFaviconWait = Boolean(config.skipFaviconWait);
      if (!skipFaviconWait && !areFaviconRenderCachesReady()) {
        const waitMs = forceReload ? Math.min(80, FAVICON_CACHE_BOOT_WAIT_MS) : FAVICON_CACHE_BOOT_WAIT_MS;
        return waitForFaviconRenderCaches(waitMs).then(() => (
          loadRecentSites({
            ...config,
            force: forceReload,
            skipFaviconWait: true,
            sectionDataRevision: requestedSectionDataRevision
          })
        ));
      }
      if (!forceReload && !recentDataDirty && pageState.recentLoadedOnce) {
        updateBookmarkSectionPosition();
        return Promise.resolve();
      }
      const requestToken = ++recentLoadToken;
      const recentSourceLimit = getRecentSourceLimit();
      if (!recentSourceLimit || recentSourceLimit <= 0) {
        pageState.recentRenderSignature = '';
        pageState.recentSourceItems = [];
        pageState.recentSitesView.clear();
        if (deps.syncCustomRecentSitesUi) deps.syncCustomRecentSitesUi();
        setContentSectionVisible(recentSection, false);
        recentDataDirty = false;
        pageState.recentLoadedOnce = true;
        updateBookmarkSectionPosition();
        return Promise.resolve();
      }
      const task = pageState.currentRecentMode === 'custom'
        ? deps.getCustomRecentSites()
        : getRecentSites(recentSourceLimit + MAX_PINNED_RECENT_SITES, pageState.currentRecentMode);
      return task.then((items) => {
        if (requestToken !== recentLoadToken ||
            requestedSectionDataRevision !== pageState.sectionDataRevision) {
          return;
        }
        const normalizedItems = Array.isArray(items) ? items : [];
        renderRecentSites(normalizedItems);
        recentDataDirty = false;
        pageState.recentLoadedOnce = true;
      });
    }

    function handleRecentVisibilityChange() {
      if (document.visibilityState !== 'visible') {
        return;
      }
      const shouldReloadRecent = recentDataDirty || !pageState.recentLoadedOnce;
      const shouldReloadBookmarks = bookmarkDataDirty || !pageState.bookmarkLoadedOnce;
      if (shouldReloadRecent || shouldReloadBookmarks) {
        beginSearchEntryRestoreLayoutLock();
      }
      if (shouldReloadRecent) {
        loadRecentSites();
      }
      if (shouldReloadBookmarks) {
        loadBookmarks();
      }
    }

    function forceReloadRecentSitesForI18n() {
      pageState.recentRenderSignature = '';
      pageState.bookmarkRenderSignature = '';
      markRecentDataDirty();
      markBookmarkDataDirty();
      loadRecentSites();
      loadBookmarks();
    }

    return {
      renderBookmarks,
      renderRecentSites,
      markBookmarkDataDirty,
      markBookmarkTreeDirty,
      markRecentDataDirty,
      loadBookmarks,
      loadRecentSites,
      handleRecentVisibilityChange,
      forceReloadRecentSitesForI18n
    };
  }

  root.LumnoNewtabSectionLoaders = { createSectionLoaders };
})(globalThis);
