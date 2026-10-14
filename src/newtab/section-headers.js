(function(root) {
  // Headings, mode menus, pager labels and breadcrumbs for the bookmark and
  // recent-site sections.
  function createSectionHeaders(deps) {
    const {
      t,
      normalizeRecentMode,
      storageArea,
      RECENT_MODE_STORAGE_KEY,
      markRecentDataDirty,
      loadRecentSites,
      getNewtabVisualViewportInsets,
      BOOKMARK_TOPBAR_HEIGHT_PX,
      updateSearchEntryLayout,
      setContentSectionVisible,
      bookmarkSection,
      bookmarkCards,
      normalizeBookmarkViewMode,
      markBookmarkDataDirty,
      loadBookmarks,
      closeBookmarkCascadeMenu,
      persistBookmarkViewMode,
      showTopActionTooltip,
      hideTopActionTooltip
    } = deps;

    // Page state still owned by newtab.js; read and written through accessors.
    const pageState = deps.pageState;

    const NEWTAB_FLOATING_TOP_GAP_PX = 12;
    const BOOKMARK_CASCADE_TOPBAR_GAP_PX = 4;
    // Matches the floating bar's 8px top offset and 40px height in newtab.css.
    const BOOKMARK_TOPBAR_FLOATING_OCCUPIED_PX = 48;

    function updateRecentHeading() {
      if (!pageState.recentHeading) {
        return;
      }
      const custom = pageState.currentRecentMode === 'custom';
      const key = custom ? 'recent_mode_custom' : pageState.currentRecentMode === 'most' ? 'recent_heading_most' : 'recent_heading_latest';
      const fallback = custom ? 'Custom' : pageState.currentRecentMode === 'most' ? 'Most visited' : 'Recent visits';
      pageState.recentHeading.textContent = t(key, fallback);
    }

    function updateRecentModeMenu() {
      if (pageState.recentModeMenu && typeof pageState.recentModeMenu.update === 'function') {
        pageState.recentModeMenu.update();
      }
    }

    function setRecentMode(nextMode) {
      const mode = normalizeRecentMode(nextMode, 'latest');
      if (pageState.currentRecentMode === mode) {
        updateRecentModeMenu();
        return;
      }
      pageState.currentRecentMode = mode;
      updateRecentHeading();
      updateRecentModeMenu();
      if (storageArea) {
        storageArea.set({ [RECENT_MODE_STORAGE_KEY]: mode });
      }
      markRecentDataDirty();
      loadRecentSites({ force: true });
    }

    function canDismissRecentCard() {
      return true;
    }

    function updateBookmarkHeading() {
      if (!pageState.bookmarkHeading) {
        return;
      }
      pageState.bookmarkHeading.textContent = t('bookmarks_heading', '书签');
    }

    function isBookmarkTopbarMode() {
      return pageState.currentBookmarkViewMode === 'top';
    }

    function getNewtabTopOccupiedInsetPx() {
      const visualViewportTopInset = getNewtabVisualViewportInsets().top;
      const body = document.body;
      const bookmarkTopbarInset = body && body.getAttribute('data-nt-top-occupied') === 'true'
        ? (body.getAttribute('data-nt-top-layout') === 'floating'
          ? BOOKMARK_TOPBAR_FLOATING_OCCUPIED_PX
          : BOOKMARK_TOPBAR_HEIGHT_PX)
        : 0;
      return visualViewportTopInset + bookmarkTopbarInset;
    }

    function getNewtabViewportTopPaddingPx() {
      return getNewtabTopOccupiedInsetPx() + Math.min(8, NEWTAB_FLOATING_TOP_GAP_PX);
    }

    function getBookmarkCascadeViewportTopPaddingPx() {
      const occupiedTopInset = getNewtabTopOccupiedInsetPx();
      return occupiedTopInset > 0
        ? occupiedTopInset + BOOKMARK_CASCADE_TOPBAR_GAP_PX
        : 8;
    }

    function setNewtabTopOccupied(occupied) {
      if (!document.body) {
        return;
      }
      const nextValue = occupied === true ? 'true' : 'false';
      if (document.body.getAttribute('data-nt-top-occupied') === nextValue) {
        return;
      }
      document.body.setAttribute('data-nt-top-occupied', nextValue);
      refreshTopOccupiedLayout();
    }

    function setNewtabTopLayout(layout) {
      if (!document.body) {
        return;
      }
      const nextValue = layout === 'floating' ? 'floating' : 'docked';
      if (document.body.getAttribute('data-nt-top-layout') === nextValue) {
        return;
      }
      document.body.setAttribute('data-nt-top-layout', nextValue);
      if (document.body.getAttribute('data-nt-top-occupied') === 'true') {
        refreshTopOccupiedLayout();
      }
    }

    function refreshTopOccupiedLayout() {
      updateSearchEntryLayout();
      if (pageState.bookmarkCascadeRuntime &&
          typeof pageState.bookmarkCascadeRuntime.positionLevels === 'function' &&
          pageState.bookmarkCascadeRuntime.isOpen()) {
        pageState.bookmarkCascadeRuntime.positionLevels();
      }
    }

    function syncBookmarkSurfaceMode() {
      if (!pageState.bookmarkTopbarRuntime) {
        return;
      }
      if (isBookmarkTopbarMode()) {
        pageState.bookmarkTopbarRuntime.activate();
        setContentSectionVisible(bookmarkSection, false);
        pageState.bookmarkTopbarRuntime.setVisible(
          bookmarkCards.length > 0 && pageState.currentBookmarkCount > 0
        );
      } else {
        pageState.bookmarkTopbarRuntime.deactivate();
        setContentSectionVisible(
          bookmarkSection,
          bookmarkCards.length > 0 && pageState.currentBookmarkCount > 0
        );
      }
    }

    function setBookmarkSurfaceVisible(visible) {
      const nextVisible = visible === true;
      if (isBookmarkTopbarMode()) {
        setContentSectionVisible(bookmarkSection, false);
        if (pageState.bookmarkTopbarRuntime) {
          pageState.bookmarkTopbarRuntime.setVisible(nextVisible && !pageState.zenModeEnabled);
        }
        return;
      }
      if (pageState.bookmarkTopbarRuntime) {
        pageState.bookmarkTopbarRuntime.setVisible(false);
      }
      setContentSectionVisible(bookmarkSection, nextVisible);
    }

    function updateBookmarkModeMenu() {
      if (pageState.bookmarkModeMenu && typeof pageState.bookmarkModeMenu.update === 'function') {
        pageState.bookmarkModeMenu.update();
      }
      if (pageState.bookmarkGrid) {
        pageState.bookmarkGrid.setAttribute('data-view-mode', pageState.currentBookmarkViewMode);
      }
      if (document.body) {
        document.body.setAttribute('data-bookmark-view-mode', pageState.currentBookmarkViewMode);
      }
      syncBookmarkSurfaceMode();
    }

    function applyBookmarkViewMode(nextMode, options) {
      const config = options && typeof options === 'object' ? options : {};
      if (Object.prototype.hasOwnProperty.call(config, 'expectedRevision') &&
          config.expectedRevision !== pageState.bookmarkViewModeRevision) {
        return {
          applied: false,
          changed: false,
          mode: pageState.currentBookmarkViewMode,
          revision: pageState.bookmarkViewModeRevision
        };
      }
      const mode = normalizeBookmarkViewMode(nextMode);
      const changed = pageState.currentBookmarkViewMode !== mode;
      if (!changed) {
        updateBookmarkModeMenu();
        if (config.ensureLoaded === true && !pageState.bookmarkLoadedOnce) {
          pageState.bookmarkCurrentPage = 0;
          pageState.bookmarkRenderSignature = '';
          markBookmarkDataDirty();
          loadBookmarks(config.force === true ? { force: true } : undefined);
        }
        return {
          applied: true,
          changed: false,
          mode,
          revision: pageState.bookmarkViewModeRevision
        };
      }
      closeBookmarkCascadeMenu();
      pageState.currentBookmarkViewMode = mode;
      pageState.bookmarkViewModeRevision += 1;
      if (mode === 'top') {
        pageState.bookmarkCurrentFolderId = pageState.bookmarkRootFolderId;
      }
      pageState.bookmarkCurrentPage = 0;
      pageState.bookmarkRenderSignature = '';
      updateBookmarkModeMenu();
      if (config.persist === true) {
        persistBookmarkViewMode(mode);
      }
      markBookmarkDataDirty();
      loadBookmarks(config.force === true ? { force: true } : undefined);
      return {
        applied: true,
        changed: true,
        mode,
        revision: pageState.bookmarkViewModeRevision
      };
    }

    function setBookmarkViewMode(nextMode) {
      return applyBookmarkViewMode(nextMode, {
        persist: true,
        force: true
      });
    }

    function navigateBookmarkFolder(targetId) {
      const id = String(targetId || '').trim();
      if (!id) {
        return;
      }
      closeBookmarkCascadeMenu();
      pageState.bookmarkCurrentFolderId = id;
      pageState.bookmarkCurrentPage = 0;
      pageState.bookmarkRenderSignature = '';
      loadBookmarks({ force: true });
    }

    function updateBookmarkHeadingRootLinkState(isNested) {
      if (!pageState.bookmarkHeading) {
        return;
      }
      const nested = !!isNested;
      const rootLabel = t('bookmarks_heading', '书签');
      pageState.bookmarkHeading.setAttribute('data-bookmark-drop-folder-id', String(pageState.bookmarkRootFolderId || '1'));
      pageState.bookmarkHeading.setAttribute('data-bookmark-drop-folder-title', rootLabel);
      pageState.bookmarkHeading.classList.toggle('x-nt-bookmarks-heading--link', nested);
      pageState.bookmarkHeading._xCanNavigateRoot = nested;
      if (nested) {
        pageState.bookmarkHeading.setAttribute('role', 'button');
        pageState.bookmarkHeading.setAttribute('tabindex', '0');
        pageState.bookmarkHeading.setAttribute('aria-label', rootLabel);
        pageState.bookmarkHeading.title = rootLabel;
      } else {
        pageState.bookmarkHeading.removeAttribute('role');
        pageState.bookmarkHeading.removeAttribute('tabindex');
        pageState.bookmarkHeading.removeAttribute('aria-label');
        pageState.bookmarkHeading.removeAttribute('data-bookmark-drop-target');
        pageState.bookmarkHeading.title = '';
      }
    }

    function updateBookmarkPagerLabels() {
      if (pageState.bookmarkPagerPrevButton) {
        const prevLabel = t('bookmarks_page_prev', '上一页');
        pageState.bookmarkPagerPrevButton.setAttribute('aria-label', prevLabel);
        pageState.bookmarkPagerPrevButton.setAttribute('data-tooltip', prevLabel);
        pageState.bookmarkPagerPrevButton.removeAttribute('title');
      }
      if (pageState.bookmarkPagerNextButton) {
        const nextLabel = t('bookmarks_page_next', '下一页');
        pageState.bookmarkPagerNextButton.setAttribute('aria-label', nextLabel);
        pageState.bookmarkPagerNextButton.setAttribute('data-tooltip', nextLabel);
        pageState.bookmarkPagerNextButton.removeAttribute('title');
      }
      if (pageState.bookmarkOpenManagerButton) {
        const managerLabel = t('bookmarks_open_manager', '打开书签管理页');
        pageState.bookmarkOpenManagerButton.setAttribute('aria-label', managerLabel);
        pageState.bookmarkOpenManagerButton.setAttribute('data-tooltip', managerLabel);
        pageState.bookmarkOpenManagerButton.removeAttribute('title');
      }
    }

    function bindBookmarkPagerTooltip(button, getLabel) {
      if (!button || typeof getLabel !== 'function') {
        return;
      }
      const showTooltip = () => {
        const label = String(getLabel() || '').trim();
        if (!label) {
          return;
        }
        const inTopbar = Boolean(
          pageState.bookmarkTopbarRuntime &&
          pageState.bookmarkTopbarRuntime.element &&
          pageState.bookmarkTopbarRuntime.element.contains(button)
        );
        showTopActionTooltip(button, label, { placement: inTopbar ? 'bottom' : 'top' });
      };
      button.addEventListener('pointerenter', showTooltip);
      button.addEventListener('pointerleave', hideTopActionTooltip);
      button.addEventListener('focus', showTooltip);
      button.addEventListener('blur', hideTopActionTooltip);
    }

    function updateBookmarkBreadcrumb() {
      if (!pageState.bookmarkBreadcrumbController) {
        return;
      }
      const path = Array.isArray(pageState.bookmarkFolderPath) ? pageState.bookmarkFolderPath : [];
      if (path.length <= 1) {
        pageState.bookmarkBreadcrumbController.render({ items: [] });
        updateBookmarkHeadingRootLinkState(false);
        return;
      }
      updateBookmarkHeadingRootLinkState(true);
      pageState.bookmarkBreadcrumbController.render({
        items: path.slice(1).map((crumb) => {
        const title = String(crumb && crumb.title ? crumb.title : '').trim() || t('bookmarks_heading', '书签');
          return {
            id: String(crumb && crumb.id ? crumb.id : ''),
            title
          };
        })
      });
    }

    return {
      updateRecentHeading,
      updateRecentModeMenu,
      setRecentMode,
      canDismissRecentCard,
      updateBookmarkHeading,
      isBookmarkTopbarMode,
      getNewtabTopOccupiedInsetPx,
      getNewtabViewportTopPaddingPx,
      getBookmarkCascadeViewportTopPaddingPx,
      setNewtabTopOccupied,
      setNewtabTopLayout,
      syncBookmarkSurfaceMode,
      setBookmarkSurfaceVisible,
      updateBookmarkModeMenu,
      applyBookmarkViewMode,
      setBookmarkViewMode,
      navigateBookmarkFolder,
      updateBookmarkPagerLabels,
      bindBookmarkPagerTooltip,
      updateBookmarkBreadcrumb
    };
  }

  root.LumnoNewtabSectionHeaders = { createSectionHeaders };
})(globalThis);
