(function(root) {
  // Bookmark card layout animation, drag and drop (within the grid, across
  // folders and onto shortcuts) and the bookmark move undo history.
  function createBookmarkDragController(deps) {
    const {
      isBookmarkTopbarMode,
      getBookmarkLimit,
      NEWTAB_BOOKMARK_DRAG,
      getFigmaFolderSvg,
      initFolderPathMorph,
      setFolderPathMorphState,
      isContentSectionVisible,
      bookmarkSection,
      bookmarksRuntime,
      NEWTAB_CROSS_SURFACE_DRAG,
      NEWTAB_BOOKMARK_MOVE_HISTORY,
      getShortcutById,
      getShortcutFolderId,
      getShortcutReorderTiles,
      getShortcutTileLayoutRect,
      NEWTAB_SHORTCUTS_STORE,
      getShortcutStoreOptions,
      getShortcutInsertionSlotAt,
      MAX_NEWTAB_SHORTCUTS,
      getShortcutTileId,
      FOLDER_REFERENCES,
      bookmarkMoveHistory,
      showToast,
      t,
      refreshShortcutFolderReferences,
      shortcutFolderRuntime,
      updateFolderItemIcons,
      persistShortcuts,
      markBookmarkTreeDirty,
      loadBookmarks,
      getBookmarkPageCount,
      isBookmarkSurfaceDragStateActive,
      openBookmarkCascadeMenu,
      navigateBookmarkFolder,
      switchBookmarkPageDuringDrag,
      setShortcutDragTileTransform,
      scheduleWallpaperAdaptiveToneUpdate,
      formatMessage,
      isShortcutDragActive,
      hideCursorTooltip,
      isEditableElement,
      closeBookmarkCascadeMenu,
      suppressCanceledDragClick,
      renderCurrentBookmarkPage,
      closeBookmarkContextMenu
    } = deps;

    // Page state still owned by newtab.js; read and written through accessors.
    const pageState = deps.pageState;

    const BOOKMARK_DRAG_START_THRESHOLD_PX = 10;
    const BOOKMARK_REORDER_ANIMATION_MS = 180;
    const BOOKMARK_DROP_ANIMATION_MS = 210;
    const BOOKMARK_REORDER_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
    const BOOKMARK_DRAG_CLICK_SUPPRESS_MS = 420;
    const BOOKMARK_DRAG_PAGE_SWITCH_DELAY_MS = 640;
    const BOOKMARK_DRAG_FOLDER_SWITCH_DELAY_MS = 640;
    let bookmarkPendingLayoutAnimation = null;
    const insertionGapOwner = {};

    function getBookmarkCardFromNode(node) {
      return node && typeof node.closest === 'function'
        ? node.closest('.x-nt-bookmark-card')
        : null;
    }

    function getBookmarkCardId(card) {
      return card && typeof card.getAttribute === 'function'
        ? card.getAttribute('data-bookmark-id') || ''
        : '';
    }

    function getBookmarkCardParentId(card) {
      return card && typeof card.getAttribute === 'function'
        ? card.getAttribute('data-bookmark-parent-id') || ''
        : '';
    }

    function getBookmarkReorderCards() {
      return pageState.bookmarkGrid
        ? Array.from(pageState.bookmarkGrid.querySelectorAll('.x-nt-bookmark-card[data-bookmark-draggable="true"]'))
        : [];
    }

    function getBookmarkCardInsertionIndex(card) {
      if (!card) {
        return -1;
      }
      return getBookmarkReorderCards().indexOf(card);
    }

    function getBookmarkCardAllIndex(bookmarkId) {
      const id = String(bookmarkId || '');
      return id
        ? pageState.bookmarkAllItems.findIndex((item) => item && String(item.id || '') === id)
        : -1;
    }

    function getBookmarkPageStartIndex() {
      if (isBookmarkTopbarMode()) {
        return 0;
      }
      return Math.max(0, pageState.bookmarkCurrentPage * getBookmarkLimit());
    }

    function getBookmarkCardLayoutRect(card) {
      if (!card || !pageState.bookmarkGrid || typeof card.getBoundingClientRect !== 'function') {
        return null;
      }
      const rect = card.getBoundingClientRect();
      const left = Number(rect && rect.left);
      const top = Number(rect && rect.top);
      const width = Number(rect && rect.width);
      const height = Number(rect && rect.height);
      if (!Number.isFinite(left) || !Number.isFinite(top) ||
          !Number.isFinite(width) || !Number.isFinite(height)) {
        return null;
      }
      return {
        left,
        top,
        right: left + width,
        bottom: top + height,
        width,
        height,
        centerX: left + (width / 2),
        centerY: top + (height / 2)
      };
    }

    function clearBookmarkCardLayoutAnimation(card) {
      if (!card || !card.style) {
        return;
      }
      if (card._xBookmarkLayoutAnimationTimer) {
        window.clearTimeout(card._xBookmarkLayoutAnimationTimer);
        card._xBookmarkLayoutAnimationTimer = 0;
      }
      card.style.removeProperty('transition');
      card.style.removeProperty('will-change');
      if (card.getAttribute && card.getAttribute('data-bookmark-dragging') !== 'true' &&
          card.getAttribute('data-bookmark-dropping') !== 'true') {
        card.style.removeProperty('transform');
      }
    }

    function getBookmarkCachedRectMap(state) {
      const rects = new Map();
      const layoutItems = Array.isArray(state && state.layoutItems) ? state.layoutItems : [];
      layoutItems.forEach((item) => {
        if (item && item.card && item.rect) {
          rects.set(item.card, item.rect);
        }
      });
      return rects;
    }

    function animateBookmarkLayoutShift(beforeRects, draggedCard) {
      if (!beforeRects || !pageState.bookmarkGrid) {
        return;
      }
      const cardsToAnimate = getBookmarkReorderCards().filter((card) =>
        card && card !== draggedCard && card.style && beforeRects.has(card)
      );
      cardsToAnimate.forEach(clearBookmarkCardLayoutAnimation);
      const shifts = [];
      cardsToAnimate.forEach((card) => {
        const before = beforeRects.get(card);
        const after = getBookmarkCardLayoutRect(card);
        if (!before || !after) {
          return;
        }
        const delta = NEWTAB_BOOKMARK_DRAG.getLayoutShiftDelta(before, after, {
          horizontalOnly: isBookmarkTopbarMode()
        });
        if (!delta) {
          return;
        }
        const { dx, dy } = delta;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
          return;
        }
        shifts.push({ card, dx, dy });
      });
      shifts.forEach(({ card, dx, dy }) => {
        card.style.transition = 'none';
        card.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      });
      window.requestAnimationFrame(() => {
        shifts.forEach(({ card }) => {
          if (!card.isConnected) {
            return;
          }
          card.style.transition = `transform ${BOOKMARK_REORDER_ANIMATION_MS}ms ${BOOKMARK_REORDER_EASING}`;
          card.style.transform = 'translate3d(0, 0, 0)';
          card._xBookmarkLayoutAnimationTimer = window.setTimeout(() => {
            card._xBookmarkLayoutAnimationTimer = 0;
            clearBookmarkCardLayoutAnimation(card);
          }, BOOKMARK_REORDER_ANIMATION_MS + 80);
        });
      });
    }

    function getBookmarkLayoutRectMapById() {
      const rects = new Map();
      getBookmarkReorderCards().forEach((card) => {
        const bookmarkId = getBookmarkCardId(card);
        const rect = getBookmarkCardLayoutRect(card);
        if (bookmarkId && rect) {
          rects.set(bookmarkId, rect);
        }
      });
      return rects;
    }

    function normalizeBookmarkAnimationRect(rect) {
      if (!rect) {
        return null;
      }
      const left = Number(rect.left);
      const top = Number(rect.top);
      const width = Number(rect.width);
      const height = Number(rect.height);
      if (!Number.isFinite(left) || !Number.isFinite(top) ||
          !Number.isFinite(width) || !Number.isFinite(height)) {
        return null;
      }
      return {
        left,
        top,
        right: Number.isFinite(Number(rect.right)) ? Number(rect.right) : left + width,
        bottom: Number.isFinite(Number(rect.bottom)) ? Number(rect.bottom) : top + height,
        width,
        height
      };
    }

    function getBookmarkDragVisualRect(state) {
      const visualElement = getBookmarkDragVisualElement(state);
      return visualElement && typeof visualElement.getBoundingClientRect === 'function'
        ? normalizeBookmarkAnimationRect(visualElement.getBoundingClientRect())
        : null;
    }

    function queueBookmarkLayoutAnimation(excludedBookmarkId, animationOptions) {
      const options = animationOptions && typeof animationOptions === 'object'
        ? animationOptions
        : {};
      const rects = getBookmarkLayoutRectMapById();
      const draggedRect = normalizeBookmarkAnimationRect(options.draggedRect);
      bookmarkPendingLayoutAnimation = rects.size > 0 || draggedRect
        ? {
          folderId: String(pageState.bookmarkCurrentFolderId || ''),
          page: pageState.bookmarkCurrentPage,
          excludedBookmarkId: String(excludedBookmarkId || ''),
          draggedBookmarkId: String(options.draggedBookmarkId || ''),
          draggedRect,
          rects
        }
        : null;
    }

    function playPendingBookmarkLayoutAnimation() {
      const pending = bookmarkPendingLayoutAnimation;
      bookmarkPendingLayoutAnimation = null;
      if (!pending || !pageState.bookmarkGrid ||
          pending.folderId !== String(pageState.bookmarkCurrentFolderId || '') ||
          pending.page !== pageState.bookmarkCurrentPage) {
        return false;
      }
      const shifts = [];
      getBookmarkReorderCards().forEach((card) => {
        const bookmarkId = getBookmarkCardId(card);
        const isDraggedCard = Boolean(
          bookmarkId &&
          bookmarkId === pending.draggedBookmarkId &&
          pending.draggedRect
        );
        if (!bookmarkId ||
            (bookmarkId === pending.excludedBookmarkId && !isDraggedCard) ||
            (!isDraggedCard && !pending.rects.has(bookmarkId))) {
          return;
        }
        clearBookmarkCardLayoutAnimation(card);
        const before = isDraggedCard
          ? pending.draggedRect
          : pending.rects.get(bookmarkId);
        const after = getBookmarkCardLayoutRect(card);
        if (!before || !after) {
          return;
        }
        const delta = NEWTAB_BOOKMARK_DRAG.getLayoutShiftDelta(before, after, {
          horizontalOnly: isBookmarkTopbarMode()
        });
        if (!delta) {
          return;
        }
        const { dx, dy } = delta;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
          return;
        }
        shifts.push({ card, dx, dy });
      });
      if (shifts.length === 0) {
        return false;
      }
      shifts.forEach(({ card, dx, dy }) => {
        card.style.transition = 'none';
        card.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
        card.style.willChange = 'transform';
      });
      void pageState.bookmarkGrid.offsetHeight;
      window.requestAnimationFrame(() => {
        shifts.forEach(({ card }) => {
          if (!card.isConnected) {
            return;
          }
          card.style.transition = `transform ${BOOKMARK_REORDER_ANIMATION_MS}ms ${BOOKMARK_REORDER_EASING}`;
          card.style.transform = 'translate3d(0, 0, 0)';
          card._xBookmarkLayoutAnimationTimer = window.setTimeout(() => {
            card._xBookmarkLayoutAnimationTimer = 0;
            clearBookmarkCardLayoutAnimation(card);
          }, BOOKMARK_REORDER_ANIMATION_MS + 80);
        });
      });
      return true;
    }

    function updateBookmarkDragLayoutCache(state) {
      if (!state || !state.card) {
        return;
      }
      const draggedCard = state.card;
      state.layoutItems = getBookmarkReorderCards()
        .filter((card) => card && card !== draggedCard)
        .map((card) => ({
          card,
          rect: getBookmarkCardLayoutRect(card)
        }))
        .filter((item) => item.rect && item.rect.width > 0 && item.rect.height > 0);
      const draggedLayoutRect = getBookmarkCardLayoutRect(draggedCard);
      if (draggedLayoutRect && !state.dragPreviewElement) {
        state.baseLeft = draggedLayoutRect.left;
        state.baseTop = draggedLayoutRect.top;
      }
    }

    function cancelBookmarkDragMoveFrame(state) {
      if (!state || !state.moveFrameId) {
        return;
      }
      window.cancelAnimationFrame(state.moveFrameId);
      state.moveFrameId = 0;
    }

    function getBookmarkDragVisualElement(state) {
      return NEWTAB_BOOKMARK_DRAG.getVisualElement(state);
    }

    function createBookmarkCascadeDragPreview(state) {
      return NEWTAB_BOOKMARK_DRAG.createPreview(state, {
        documentObj: document,
        renderClosedFolderIcon: ({ bookmarkId, folderIcon }) => {
          folderIcon.innerHTML = getFigmaFolderSvg(`${bookmarkId}-drag-preview`, bookmarkId);
          initFolderPathMorph(folderIcon);
          setFolderPathMorphState(folderIcon, false);
        }
      });
    }

    function removeBookmarkCascadeDragPreview(state) {
      NEWTAB_BOOKMARK_DRAG.removePreview(state);
    }

    function setBookmarkDragCardTransform(state, pointerX, pointerY) {
      NEWTAB_BOOKMARK_DRAG.updateVisualPosition(state, pointerX, pointerY, {
        windowObj: window
      });
    }

    function settleBookmarkDragCard(card) {
      if (!card || !card.style) {
        return;
      }
      card.setAttribute('data-bookmark-dropping', 'true');
      card.style.pointerEvents = '';
      card.style.transition = `transform ${BOOKMARK_DROP_ANIMATION_MS}ms ${BOOKMARK_REORDER_EASING}`;
      card.style.transform = 'translate3d(0, 0, 0)';
      if (card._xBookmarkDropTimer) {
        window.clearTimeout(card._xBookmarkDropTimer);
      }
      card._xBookmarkDropTimer = window.setTimeout(() => {
        card._xBookmarkDropTimer = 0;
        card.removeAttribute('data-bookmark-dragging');
        card.removeAttribute('data-bookmark-dropping');
        card.style.removeProperty('transition');
        card.style.removeProperty('transform');
        card.style.removeProperty('will-change');
        card.style.pointerEvents = '';
      }, BOOKMARK_DROP_ANIMATION_MS + 90);
    }

    function isPointInsideBookmarkElement(element, pointerX, pointerY) {
      return NEWTAB_BOOKMARK_DRAG.isPointInsideElement(element, pointerX, pointerY);
    }

    function getBookmarkGridInsertionDropTarget(state, pointerX, pointerY) {
      if (!pageState.bookmarkGrid || !state || !Number.isFinite(pointerX) ||
          !Number.isFinite(pointerY)) {
        return null;
      }
      const computedStyle = typeof window.getComputedStyle === 'function'
        ? window.getComputedStyle(pageState.bookmarkGrid)
        : null;
      const pageStartIndex = getBookmarkPageStartIndex();
      const pageEndIndex = pageStartIndex + getBookmarkLimit();
      const originalIndex = Number(state.originalIndex);
      const isCrossPageDrag = !isBookmarkTopbarMode() &&
        state.sourceKind === 'card' &&
        String(state.parentId || '') === String(pageState.bookmarkCurrentFolderId || '') &&
        Number.isFinite(originalIndex) &&
        (originalIndex < pageStartIndex || originalIndex >= pageEndIndex);
      return NEWTAB_BOOKMARK_DRAG.getGridInsertionTarget({
        columnGap: computedStyle ? computedStyle.columnGap : '',
        folderId: pageState.bookmarkCurrentFolderId,
        gridElement: pageState.bookmarkGrid,
        isCrossPageDrag,
        layoutItems: state && state.layoutItems,
        markerVerticalInsetPx: isBookmarkTopbarMode() ? 3 : 8,
        pageStartIndex,
        pointerX,
        pointerY
      });
    }

    function getBookmarkDropSurfaceElement() {
      if (!pageState.bookmarkGrid || pageState.currentBookmarkCount <= 0) {
        return null;
      }
      if (isBookmarkTopbarMode()) {
        return pageState.bookmarkTopbarRuntime && pageState.bookmarkTopbarRuntime.isVisible()
          ? pageState.bookmarkTopbarRuntime.element
          : null;
      }
      return isContentSectionVisible(bookmarkSection) ? bookmarkSection : null;
    }

    function isEmptyBookmarkRootHidden() {
      return Boolean(
        pageState.currentBookmarkCount > 0 &&
        pageState.bookmarkLoadedOnce &&
        !getBookmarkDropSurfaceElement() &&
        String(pageState.bookmarkCurrentFolderId || '') === String(pageState.bookmarkRootFolderId || '1') &&
        pageState.bookmarkAllItems.length === 0
      );
    }

    function getExternalBookmarkSurfacePoint(pointerX, pointerY) {
      const surface = getBookmarkDropSurfaceElement();
      if (!surface) {
        return null;
      }
      if (isBookmarkTopbarMode()) {
        return NEWTAB_BOOKMARK_DRAG.getTopbarDropPoint({
          surfaceElement: surface,
          viewportElement: pageState.bookmarkTopbarRuntime.viewport,
          pointerX,
          pointerY
        });
      }
      return NEWTAB_BOOKMARK_DRAG.isPointInsideElement(surface, pointerX, pointerY)
        ? { x: pointerX, y: pointerY } : null;
    }

    // Foreign items share the bookmark edge insertion zones. A folder's center
    // accepts its contents; ordinary cards snap to the nearest row boundary.
    function isValidExternalBookmarkDropTarget(state, target) {
      const nodeMap = bookmarksRuntime.getNodeMap();
      if (!target || !NEWTAB_CROSS_SURFACE_DRAG.isBookmarkFolderDropTarget(target.folderId, nodeMap)) {
        return false;
      }
      const destination = nodeMap.get(String(target.folderId));
      if (destination.unmodifiable) {
        return false;
      }
      if (target.kind === 'return') {
        const source = state && nodeMap.get(String(state.bookmarkId || ''));
        if (!source || source.url || !state.shortcutId ||
            String(target.bookmarkId) !== String(source.id) ||
            String(target.folderId) !== String(source.parentId)) {
          return false;
        }
      }
      return !state || !state.bookmarkId || !NEWTAB_BOOKMARK_MOVE_HISTORY.isFolderInsideBookmark(
        nodeMap, state.bookmarkId, target.folderId
      );
    }

    function resolveExternalBookmarkDropTarget(state, target) {
      const shortcut = state && state.shortcutId ? getShortcutById(state.shortcutId) : null;
      if (shortcut && shortcut.type === 'folder' && target &&
          (target.kind === 'card' || target.kind === 'cascade') &&
          String(target.folderId) === String(getShortcutFolderId(shortcut))) {
        const source = bookmarksRuntime.getNodeMap().get(String(getShortcutFolderId(shortcut)));
        if (source && !source.url) {
          // Returning the alias to its original bookmark removes the shortcut
          // without trying to move the real folder into itself.
          target = { ...target, kind: 'return', bookmarkId: source.id, folderId: source.parentId };
        }
      }
      return isValidExternalBookmarkDropTarget(state, target)
        ? target : { kind: 'blocked', surface: target && target.surface || 'folder' };
    }

    function getShortcutFolderDropTargetAt(state, pointerX, pointerY) {
      if (!isPointOverShortcutDropSurface(pointerX, pointerY)) {
        return null;
      }
      const tile = getShortcutReorderTiles().find((candidate) => {
        if (!candidate.hasAttribute('data-bookmark-drop-folder-id') || candidate === state.tile) {
          return false;
        }
        const rect = getShortcutTileLayoutRect(candidate);
        return rect && pointerX >= rect.left + rect.width * 0.25 &&
          pointerX <= rect.right - rect.width * 0.25 && pointerY >= rect.top && pointerY <= rect.bottom;
      });
      if (!tile) {
        return null;
      }
      const target = { kind: 'shortcut-folder', surface: 'folder', element: tile,
        folderId: tile.getAttribute('data-bookmark-drop-folder-id'),
        title: tile.getAttribute('data-shortcut-title') || '' };
      const valid = state === pageState.shortcutDragState
        ? isValidExternalBookmarkDropTarget(state, target)
        : isValidBookmarkFolderDropTarget(state, target);
      return valid ? target : { kind: 'blocked', surface: 'folder' };
    }

    function getExternalBookmarkDropTarget(pointerX, pointerY, state) {
      if (pageState.bookmarkCascadeRuntime && pageState.bookmarkCascadeRuntime.isOpen()) {
        const cascadeTarget = pageState.bookmarkCascadeRuntime.updateDragPointer({ clientX: pointerX, clientY: pointerY });
        if (cascadeTarget) {
          return resolveExternalBookmarkDropTarget(state, cascadeTarget);
        }
        if (isBookmarkCascadeSurfaceAtPoint(pointerX, pointerY)) {
          return null;
        }
      }
      const surfacePoint = getExternalBookmarkSurfacePoint(pointerX, pointerY);
      const folderTarget = getBookmarkElementDropTarget(
        surfacePoint ? surfacePoint.x : pointerX,
        surfacePoint ? surfacePoint.y : pointerY
      );
      if (folderTarget && folderTarget.kind !== 'card') {
        return resolveExternalBookmarkDropTarget(state, folderTarget);
      }
      if (!surfacePoint) {
        return folderTarget ? resolveExternalBookmarkDropTarget(state, folderTarget) : null;
      }
      const computedStyle = typeof window.getComputedStyle === 'function'
        ? window.getComputedStyle(pageState.bookmarkGrid)
        : null;
      const insertionTarget = NEWTAB_BOOKMARK_DRAG.getGridInsertionTarget({
        columnGap: computedStyle ? computedStyle.columnGap : '',
        folderId: pageState.bookmarkCurrentFolderId,
        gridElement: pageState.bookmarkGrid,
        // Keep the shared narrow edge zones over folders so their centers can
        // still accept contents. Other points may snap anywhere in the row.
        hitZonePx: folderTarget ? undefined : pageState.bookmarkGrid.getBoundingClientRect().width,
        layoutItems: getBookmarkReorderCards()
          .map((card) => ({
            card,
            rect: getBookmarkCardLayoutRect(card)
          }))
          .filter((item) => item.rect && item.rect.width > 0 && item.rect.height > 0),
        markerVerticalInsetPx: isBookmarkTopbarMode() ? 3 : 8,
        pageStartIndex: getBookmarkPageStartIndex(),
        pointerX: surfacePoint.x,
        pointerY: surfacePoint.y
      });
      if (insertionTarget) {
        return resolveExternalBookmarkDropTarget(state, insertionTarget);
      }
      return folderTarget ? resolveExternalBookmarkDropTarget(state, folderTarget) : null;
    }

    function isPointOverShortcutDropSurface(pointerX, pointerY) {
      return Boolean(
        pageState.shortcutGrid &&
        isContentSectionVisible(pageState.shortcutSection) &&
        !isBookmarkCascadeSurfaceAtPoint(pointerX, pointerY) &&
        NEWTAB_BOOKMARK_DRAG.isPointInsideElement(pageState.shortcutGrid, pointerX, pointerY)
      );
    }

    function getBookmarkDragShortcutDropTarget(state, pointerX, pointerY) {
      if (!state) {
        return null;
      }
      const node = bookmarksRuntime.getNodeMap().get(String(state.bookmarkId || ''));
      const record = node
        ? NEWTAB_SHORTCUTS_STORE.createShortcutRecord(
          state.isFolder
            ? { type: 'folder', folderId: node.id, title: node.title }
            : { title: node.title, url: node.url },
          getShortcutStoreOptions()
        )
        : null;
      const slot = getShortcutInsertionSlotAt(pointerX, pointerY, null);
      const canMove = Boolean(NEWTAB_CROSS_SURFACE_DRAG.planBookmarkToShortcut({
        shortcuts: pageState.newtabShortcuts,
        record,
        index: slot.index,
        getFolderId: getShortcutFolderId,
        maxShortcuts: MAX_NEWTAB_SHORTCUTS
      }));
      const anchorRect = slot.anchorRect || getShortcutTileLayoutRect(pageState.addShortcutButton);
      if (!canMove || !anchorRect || anchorRect.width <= 0) {
        document.body.setAttribute('data-drag-blocked', 'true');
        return null;
      }
      const gridRect = pageState.shortcutGrid.getBoundingClientRect();
      const columnGap = Number.parseFloat(window.getComputedStyle(pageState.shortcutGrid).columnGap) || 0;
      const markerX = slot.markerPosition === 'after'
        ? anchorRect.right + (columnGap / 2)
        : anchorRect.left - (columnGap / 2);
      const markerVerticalInsetPx = 8;
      return {
        kind: 'insertion',
        surface: 'shortcuts',
        index: slot.index < getShortcutReorderTiles().length
          ? pageState.newtabShortcuts.findIndex((item) => item.id === getShortcutTileId(getShortcutReorderTiles()[slot.index]))
          : pageState.newtabShortcuts.length,
        record,
        element: null,
        anchorElement: slot.anchorTile,
        markerElement: pageState.shortcutGrid,
        markerPosition: slot.markerPosition,
        markerOffsetPx: markerX - gridRect.left,
        markerTopPx: anchorRect.top - gridRect.top + markerVerticalInsetPx,
        markerHeightPx: anchorRect.height - (markerVerticalInsetPx * 2)
      };
    }

    function moveBookmarkToShortcuts(state, target) {
      if (pageState.bookmarkMoveHistoryBusy) return Promise.resolve(false);
      const node = bookmarksRuntime.getNode(state.bookmarkId);
      if (!node) return Promise.resolve(false);
      const plan = NEWTAB_CROSS_SURFACE_DRAG.planBookmarkToShortcut({
        shortcuts: pageState.newtabShortcuts,
        record: target.record,
        index: target.index,
        getFolderId: getShortcutFolderId,
        maxShortcuts: MAX_NEWTAB_SHORTCUTS
      });
      if (!plan) {
        return Promise.resolve(false);
      }
      const existingIndex = pageState.newtabShortcuts.findIndex((item) => item.id === plan.shortcutId);
      const beforeShortcut = existingIndex >= 0 ? {
        snapshot: pageState.newtabShortcuts[existingIndex],
        index: existingIndex,
        iconDataUrl: pageState.newtabShortcutIcons[plan.shortcutId]
      } : null;
      if (target.record.type === 'folder') {
        const index = plan.shortcuts.findIndex((item) => item.id === plan.shortcutId);
        const original = plan.shortcuts[index];
        const folderId = String(target.record.folderId || getShortcutFolderId(original));
        const folderRef = FOLDER_REFERENCES.describe(folderId, bookmarksRuntime.getNodeMap());
        if (!folderRef) return Promise.resolve(false);
        const id = original.folderRef ? original.id : FOLDER_REFERENCES.createEntryId();
        const { folderId: _localId, ...entry } = original;
        plan.shortcuts[index] = { ...entry, id, folderRef };
        plan.shortcutId = id;
      }
      const afterIndex = plan.shortcuts.findIndex((item) => item.id === plan.shortcutId);
      const isFolder = target.record.type === 'folder';
      const from = { parentId: node.parentId, index: node.index };
      const record = NEWTAB_BOOKMARK_MOVE_HISTORY.createTransferRecord({
        bookmarkId: node.id,
        snapshot: { title: node.title, url: node.url },
        from,
        to: isFolder ? from : null,
        beforeShortcut,
        afterShortcut: {
          snapshot: plan.shortcuts[afterIndex],
          index: afterIndex,
          iconDataUrl: beforeShortcut && beforeShortcut.iconDataUrl
        }
      });
      if (!record) return Promise.resolve(false);
      pageState.bookmarkMoveHistoryBusy = true;
      queueBookmarkLayoutAnimation(state.bookmarkId);
      return applyBookmarkShortcutTransfer(record, false).then((saved) => {
        if (!saved) return false;
        bookmarkMoveHistory.push(record);
        if (isFolder) {
          showToast(t('newtab_shortcuts_folder_added', 'Folder added to shortcuts'));
        }
        return true;
      }).finally(() => {
        pageState.bookmarkMoveHistoryBusy = false;
        if (pageState.newtabShortcuts.some((item) => item.type === 'folder')) return refreshShortcutFolderReferences();
      });
    }

    async function applyBookmarkShortcutTransfer(record, isUndo) {
      const from = isUndo ? record.to : record.from;
      const to = isUndo ? record.from : record.to;
      const sourceShortcut = isUndo ? record.afterShortcut : record.beforeShortcut;
      const destinationShortcut = isUndo ? record.beforeShortcut : record.afterShortcut;
      const planShortcuts = (source, destination) => NEWTAB_CROSS_SURFACE_DRAG.planTransferShortcuts({
        shortcuts: pageState.newtabShortcuts, source, destination, maxShortcuts: MAX_NEWTAB_SHORTCUTS
      });
      const persistShortcutState = async (items, destination) => {
        if (destination && destination.snapshot.type === 'folder') {
          shortcutFolderRuntime.bind(destination.snapshot.id, record.bookmarkId);
          await shortcutFolderRuntime.flush();
        }
        const iconChange = destination && destination.iconDataUrl
          ? { shortcutId: destination.snapshot.id, action: 'replace', dataUrl: destination.iconDataUrl }
          : undefined;
        return persistShortcuts(items, '', iconChange, {
          syncOverflowShortcutId: destination && destination.snapshot.id
        });
      };
      let rollbackBookmark = null;
      let shortcutsSaved = false;
      const keepCascadeOpen = Boolean(pageState.bookmarkCascadeRuntime && pageState.bookmarkCascadeRuntime.isOpen());
      try {
        if (!planShortcuts(sourceShortcut, destinationShortcut)) {
          throw new Error('Shortcut transfer conflicts with the current shortcuts.');
        }
        return await bookmarksRuntime.runControlledMutation(async () => {
          await bookmarksRuntime.ensureReady(false);
          const bookmarkId = bookmarkMoveHistory.resolveBookmarkId(record.bookmarkId || record.runtime.currentBookmarkId);
          const node = from ? bookmarksRuntime.getNode(bookmarkId) : null;
          if (from && (!node || Boolean(node.url) !== Boolean(record.snapshot.url))) {
            throw new Error('The transferred bookmark is unavailable.');
          }
          let movedNode = node;
          if (to && !from) {
            movedNode = await bookmarksRuntime.create({
              parentId: to.parentId, index: to.index,
              title: record.snapshot.title, url: record.snapshot.url
            });
            if (!movedNode || !movedNode.id) throw new Error('The restored bookmark id is unavailable.');
            rollbackBookmark = () => bookmarksRuntime.remove(movedNode.id);
          } else if (to && (from.parentId !== to.parentId || from.index !== to.index)) {
            const originalLocation = { parentId: String(node.parentId), index: Number(node.index) || 0 };
            movedNode = await bookmarksRuntime.move(bookmarkId, {
              parentId: to.parentId,
              index: NEWTAB_BOOKMARK_MOVE_HISTORY.getMoveApiDestinationIndex({
                sourceParentId: node.parentId, sourceIndex: node.index,
                targetParentId: to.parentId, targetIndex: to.index
              })
            });
            rollbackBookmark = () => bookmarksRuntime.move(bookmarkId, {
              parentId: originalLocation.parentId,
              index: NEWTAB_BOOKMARK_MOVE_HISTORY.getMoveApiDestinationIndex({
                sourceParentId: movedNode.parentId, sourceIndex: movedNode.index,
                targetParentId: originalLocation.parentId, targetIndex: originalLocation.index
              })
            });
          }
          const nextShortcuts = planShortcuts(sourceShortcut, destinationShortcut);
          if (!nextShortcuts) throw new Error('Shortcuts changed during the transfer.');
          if (!await persistShortcutState(nextShortcuts, destinationShortcut)) {
            if (rollbackBookmark) {
              await rollbackBookmark();
              rollbackBookmark = null;
            }
            return false;
          }
          shortcutsSaved = true;
          // Save the destination before removing the source. Folder aliases keep
          // the original tree, including every nested bookmark id.
          if (!to) await bookmarksRuntime.remove(bookmarkId);
          if (movedNode && to) {
            bookmarkMoveHistory.remapBookmarkId(record.bookmarkId, movedNode.id);
            record.runtime.currentBookmarkId = String(movedNode.id);
            record.runtime.location = { parentId: String(movedNode.parentId), index: Number(movedNode.index) || 0 };
          }
          return true;
        });
      } catch (error) {
        // Keep failures out of history and restore any completed destination write.
        try {
          await bookmarksRuntime.runControlledMutation(async () => {
            if (rollbackBookmark) await rollbackBookmark();
            if (shortcutsSaved) {
              const originalShortcuts = planShortcuts(destinationShortcut, sourceShortcut);
              if (!originalShortcuts || !await persistShortcutState(originalShortcuts, sourceShortcut)) {
                throw new Error('Could not roll back shortcut transfer.');
              }
            }
          });
        } catch (rollbackError) {
          console.warn('[Lumno] Failed to roll back bookmark shortcut transfer', rollbackError);
        }
        bookmarkPendingLayoutAnimation = null;
        console.warn('[Lumno] Failed to transfer bookmark and shortcut', error);
        showToast(t('bookmarks_move_failed', 'Could not move bookmark'), true);
        return false;
      } finally {
        markBookmarkTreeDirty({ preserveCascadeOpen: keepCascadeOpen });
        loadBookmarks({ force: true });
        if (keepCascadeOpen) refreshOpenBookmarkCascadeMenu();
      }
    }

    // Shortcut folders are bookmark folders, so stacking two website shortcuts
    // creates one holding both sites and shows it where the stack target was.
    async function applyShortcutStack(record, isUndo) {
      const keepCascadeOpen = Boolean(pageState.bookmarkCascadeRuntime && pageState.bookmarkCascadeRuntime.isOpen());
      const planShortcuts = (folderSnapshot) => NEWTAB_CROSS_SURFACE_DRAG.planShortcutStack({
        shortcuts: pageState.newtabShortcuts,
        sources: record.sources,
        folder: { snapshot: folderSnapshot, index: record.folderShortcut.index },
        undo: isUndo,
        maxShortcuts: MAX_NEWTAB_SHORTCUTS
      });
      const folderShortcutId = record.folderShortcut.id;
      let rollbackBookmark = null;
      try {
        if (!planShortcuts({ id: folderShortcutId, type: 'folder' })) {
          throw new Error('Shortcut stack conflicts with the current shortcuts.');
        }
        return await bookmarksRuntime.runControlledMutation(async () => {
          await bookmarksRuntime.ensureReady(false);
          if (isUndo) {
            const folderId = bookmarkMoveHistory.resolveBookmarkId(record.bookmarkId);
            const node = bookmarksRuntime.getNode(folderId);
            if (!NEWTAB_BOOKMARK_MOVE_HISTORY.isShortcutStackFolderIntact(node, record.snapshot)) {
              throw new Error('The stacked folder has changed.');
            }
            const nextShortcuts = planShortcuts({ id: folderShortcutId, type: 'folder' });
            const iconChanges = record.sources.filter((source) => source.iconDataUrl).map((source) => ({
              shortcutId: source.snapshot.id, action: 'replace', dataUrl: source.iconDataUrl
            }));
            const previousShortcuts = pageState.newtabShortcuts;
            if (!nextShortcuts || !await persistShortcuts(nextShortcuts, '', iconChanges)) return false;
            try {
              await bookmarksRuntime.remove(folderId, { recursive: true });
            } catch (error) {
              await persistShortcuts(previousShortcuts, '');
              throw error;
            }
            await updateFolderItemIcons(Object.fromEntries(node.children.map((child) => [child.id, null])))
              .catch(() => {});
            // Redo recreates the folder where, and under the name, it was left.
            record.runtime.location = { parentId: String(node.parentId), index: Number(node.index) || 0 };
            record.runtime.title = String(node.title || '');
            record.runtime.currentBookmarkId = '';
            return true;
          }
          // New folders go to the end of the bookmarks bar shown on this page.
          const location = record.runtime.location;
          const parent = location && bookmarksRuntime.getNode(location.parentId);
          const children = parent && !parent.url && Array.isArray(parent.children) ? parent.children : null;
          const title = record.runtime.title || record.snapshot.title;
          const folderNode = await bookmarksRuntime.create({
            parentId: children ? String(parent.id) : bookmarksRuntime.getRootFolderId(),
            ...(children ? { index: Math.min(location.index, children.length) } : {}),
            title
          });
          const folderId = String(folderNode && folderNode.id || '');
          if (!folderId) throw new Error('The stacked folder id is unavailable.');
          rollbackBookmark = () => bookmarksRuntime.remove(folderId, { recursive: true });
          const itemIcons = {};
          for (let index = 0; index < record.snapshot.children.length; index += 1) {
            const child = record.snapshot.children[index];
            const childNode = await bookmarksRuntime.create({ parentId: folderId, index, title: child.title, url: child.url });
            if (childNode && childNode.id && record.itemIcons[index]) itemIcons[childNode.id] = record.itemIcons[index];
          }
          await bookmarksRuntime.ensureReady(true);
          const folderRef = FOLDER_REFERENCES.describe(folderId, bookmarksRuntime.getNodeMap());
          if (!folderRef) throw new Error('The stacked folder cannot be referenced.');
          const now = Date.now();
          const nextShortcuts = planShortcuts({
            id: folderShortcutId, type: 'folder', folderRef, title, createdAt: now, updatedAt: now
          });
          if (!nextShortcuts) throw new Error('Shortcuts changed while stacking.');
          shortcutFolderRuntime.bind(folderShortcutId, folderId);
          await shortcutFolderRuntime.flush();
          if (!await persistShortcuts(nextShortcuts, '', undefined, { syncOverflowShortcutId: folderShortcutId })) {
            await rollbackBookmark();
            rollbackBookmark = null;
            return false;
          }
          rollbackBookmark = null;
          await updateFolderItemIcons(itemIcons).catch(() => {});
          if (record.bookmarkId) bookmarkMoveHistory.remapBookmarkId(record.bookmarkId, folderId);
          record.runtime.currentBookmarkId = folderId;
          return true;
        });
      } catch (error) {
        if (rollbackBookmark) {
          try {
            await bookmarksRuntime.runControlledMutation(rollbackBookmark);
          } catch (rollbackError) {
            console.warn('[Lumno] Failed to roll back shortcut stack', rollbackError);
          }
        }
        bookmarkPendingLayoutAnimation = null;
        console.warn('[Lumno] Failed to stack shortcuts', error);
        showToast(isUndo
          ? t('toast_error', 'Operation failed. Please try again.')
          : t('newtab_shortcuts_stack_failed', 'Could not create the folder'), true);
        return false;
      } finally {
        markBookmarkTreeDirty({ preserveCascadeOpen: keepCascadeOpen });
        loadBookmarks({ force: true });
        if (keepCascadeOpen) refreshOpenBookmarkCascadeMenu();
      }
    }

    function isInsertLineDropTarget(target) {
      return Boolean(
        target &&
        target.kind === 'insertion' &&
        (target.surface === 'grid' || target.surface === 'shortcuts')
      );
    }

    function isSameLayoutRow(element, anchor) {
      const height = Math.min(element.offsetHeight, anchor.offsetHeight) || 1;
      return Math.abs(element.offsetTop - anchor.offsetTop) < height / 2;
    }

    // Opens a small gap at a grid, bar or shortcut-row insertion point by
    // leaning its two neighbours apart. The line itself lives on the container.
    function syncInsertionGap(state, target) {
      const isLine = isInsertLineDropTarget(target);
      const key = isLine
        ? [target.surface, target.markerPosition, target.surface === 'grid' ? target.element : target.anchorElement]
        : null;
      const previousKey = insertionGapOwner.key;
      if (key && previousKey && key.every((part, index) => part === previousKey[index])) {
        return;
      }
      insertionGapOwner.key = key;
      let before = null;
      let after = null;
      if (isLine) {
        const isGrid = target.surface === 'grid';
        const dragged = state && (state.card || state.tile);
        const items = (isGrid ? getBookmarkReorderCards() : getShortcutReorderTiles())
          .filter((item) => item !== dragged);
        const anchor = isGrid ? target.element : target.anchorElement;
        ({ before, after } = NEWTAB_CROSS_SURFACE_DRAG.getInsertionGapNeighbors(
          items, anchor, target.markerPosition, isSameLayoutRow));
      }
      NEWTAB_CROSS_SURFACE_DRAG.setInsertionGap(insertionGapOwner, before, after);
    }

    function clearDropTargetMarker(marker) {
      marker.removeAttribute('data-bookmark-insert-position');
      marker.removeAttribute('data-insert-line-position');
      marker.style.removeProperty('--x-nt-insert-line-left');
      marker.style.removeProperty('--x-nt-insert-line-top');
      marker.style.removeProperty('--x-nt-insert-line-height');
      marker.removeAttribute('data-insert-line-motion');
    }

    function clearDragDropTarget(state) {
      if (!state) {
        return;
      }
      if (state.dropTarget && state.dropTarget.element) {
        state.dropTarget.element.removeAttribute('data-bookmark-drop-target');
      }
      if (state.dropTarget && state.dropTarget.markerElement) {
        clearDropTargetMarker(state.dropTarget.markerElement);
      }
      if (pageState.bookmarkCascadeRuntime && typeof pageState.bookmarkCascadeRuntime.clearDragTarget === 'function') {
        pageState.bookmarkCascadeRuntime.clearDragTarget();
      }
      syncInsertionGap(state, null);
      state.dropTarget = null;
    }

    function restoreBookmarkDragPreview(state) {
      if (!state || !state.hasReordered || !Array.isArray(state.originalAllItems)) {
        return;
      }
      pageState.bookmarkAllItems = state.originalAllItems.slice();
      const cardsById = new Map(getBookmarkReorderCards().map((card) => [getBookmarkCardId(card), card]));
      (state.originalPageCardIds || []).forEach((bookmarkId) => {
        const card = cardsById.get(bookmarkId);
        if (card && card.parentNode === pageState.bookmarkGrid) {
          pageState.bookmarkGrid.appendChild(card);
        }
      });
      state.pageIndex = state.originalPageIndex;
      state.hasReordered = false;
      updateBookmarkDragLayoutCache(state);
    }

    function isValidBookmarkFolderDropTarget(state, target) {
      return Boolean(
        state &&
        target &&
        NEWTAB_BOOKMARK_MOVE_HISTORY.canMoveBookmarkToFolder({
          bookmarkId: state.bookmarkId,
          sourceParentId: state.parentId,
          targetFolderId: target.folderId,
          nodeMap: bookmarksRuntime.getNodeMap()
        })
      );
    }

    function isValidBookmarkInsertionDropTarget(state, target) {
      return Boolean(
        state &&
        target &&
        target.kind === 'insertion' &&
        NEWTAB_BOOKMARK_MOVE_HISTORY.canMoveBookmarkToLocation({
          bookmarkId: state.bookmarkId,
          sourceParentId: state.parentId,
          sourceIndex: state.originalIndex,
          targetParentId: target.folderId,
          targetIndex: target.index,
          nodeMap: bookmarksRuntime.getNodeMap()
        })
      );
    }

    function getBookmarkElementDropTarget(pointerX, pointerY) {
      if (!document || typeof document.elementFromPoint !== 'function') {
        return null;
      }
      const element = document.elementFromPoint(pointerX, pointerY);
      if (!element || typeof element.closest !== 'function') {
        return null;
      }
      const breadcrumbTarget = element.closest('[data-bookmark-drop-folder-id]');
      if (breadcrumbTarget && !breadcrumbTarget.classList.contains('x-nt-bookmark-card')) {
        return {
          folderId: breadcrumbTarget.getAttribute('data-bookmark-drop-folder-id') || '',
          title: breadcrumbTarget.getAttribute('data-bookmark-drop-folder-title') || '',
          element: breadcrumbTarget,
          kind: breadcrumbTarget.classList.contains('x-nt-shortcut-tile') ? 'shortcut-folder' : 'breadcrumb'
        };
      }
      const folderCard = element.closest('.x-nt-bookmark-card--folder[data-bookmark-id]');
      if (!folderCard) {
        return null;
      }
      const item = folderCard._xBookmarkItem || null;
      return {
        folderId: getBookmarkCardId(folderCard),
        title: String((item && item.title) || folderCard._xTitleText || ''),
        element: folderCard,
        kind: 'card'
      };
    }

    function isBookmarkCascadeSurfaceAtPoint(pointerX, pointerY) {
      if (!document || typeof document.elementFromPoint !== 'function') {
        return false;
      }
      const element = document.elementFromPoint(pointerX, pointerY);
      return Boolean(
        element &&
        typeof element.closest === 'function' &&
        element.closest('.x-nt-bookmark-cascade-menu')
      );
    }

    function getBookmarkCrossLevelDropTarget(state, pointerX, pointerY) {
      let target = null;
      let cascadeBlocked = false;
      if (pageState.bookmarkCascadeRuntime && typeof pageState.bookmarkCascadeRuntime.updateDragPointer === 'function') {
        target = pageState.bookmarkCascadeRuntime.updateDragPointer({
          clientX: pointerX,
          clientY: pointerY
        });
      }
      if (target && target.kind === 'blocked') {
        cascadeBlocked = true;
      } else if (target) {
        const isValidCascadeTarget = target.kind === 'insertion'
          ? isValidBookmarkInsertionDropTarget(state, target)
          : isValidBookmarkFolderDropTarget(state, target);
        if (!isValidCascadeTarget) {
          if (pageState.bookmarkCascadeRuntime && typeof pageState.bookmarkCascadeRuntime.clearDragTarget === 'function') {
            pageState.bookmarkCascadeRuntime.clearDragTarget();
          }
          return null;
        }
        return target;
      }

      target = getBookmarkElementDropTarget(pointerX, pointerY);
      if (cascadeBlocked && isBookmarkCascadeSurfaceAtPoint(pointerX, pointerY)) {
        return null;
      }

      const insertionTarget = getBookmarkGridInsertionDropTarget(state, pointerX, pointerY);
      if (insertionTarget) {
        return isValidBookmarkInsertionDropTarget(state, insertionTarget)
          ? insertionTarget
          : null;
      }
      if (!target) {
        return null;
      }
      if (!isValidBookmarkFolderDropTarget(state, target)) {
        if (target.element) {
          target.element.removeAttribute('data-bookmark-drop-target');
        }
        return null;
      }
      return target;
    }

    function setDragDropTarget(state, target) {
      const previousTarget = state && state.dropTarget ? state.dropTarget : null;
      const previousElement = previousTarget ? previousTarget.element : null;
      const previousMarker = previousTarget ? previousTarget.markerElement : null;
      // An insertion anchor locates the line; it is not a highlighted folder target.
      const nextElement = target && target.kind !== 'insertion' ? target.element : null;
      const nextMarker = target ? target.markerElement : null;
      const isNextInsertLine = isInsertLineDropTarget(target);
      const nextMarkerAttribute = isNextInsertLine
        ? 'data-insert-line-position'
        : 'data-bookmark-insert-position';
      const previousInsertMotion = previousMarker
        ? previousMarker.getAttribute('data-insert-line-motion')
        : null;
      const isNewInsertLineTarget = Boolean(
        isNextInsertLine &&
        (
          !isInsertLineDropTarget(previousTarget) ||
          previousTarget.surface !== target.surface ||
          previousTarget.markerElement !== nextMarker ||
          previousTarget.markerPosition !== target.markerPosition ||
          Number(previousTarget.markerOffsetPx) !== Number(target.markerOffsetPx)
        )
      );
      if (previousElement && previousElement !== nextElement) {
        previousElement.removeAttribute('data-bookmark-drop-target');
      }
      if (previousMarker &&
          (previousMarker !== nextMarker ||
            previousMarker.getAttribute(nextMarkerAttribute) !==
              String((target && target.markerPosition) || ''))) {
        clearDropTargetMarker(previousMarker);
      }
      if (!state) {
        return;
      }
      state.dropTarget = target || null;
      syncInsertionGap(state, target);
      if (nextElement) {
        nextElement.setAttribute('data-bookmark-drop-target', 'true');
      }
      if (!nextMarker || target.kind !== 'insertion') {
        return;
      }
      nextMarker.setAttribute(nextMarkerAttribute, target.markerPosition);
      if (!isNextInsertLine) {
        return;
      }
      nextMarker.style.setProperty(
        '--x-nt-insert-line-left',
        `${Number(target.markerOffsetPx) || 0}px`
      );
      nextMarker.style.setProperty(
        '--x-nt-insert-line-top',
        `${Number(target.markerTopPx) || 0}px`
      );
      nextMarker.style.setProperty(
        '--x-nt-insert-line-height',
        `${Math.max(2, Number(target.markerHeightPx) || 0)}px`
      );
      if (isNewInsertLineTarget) {
        nextMarker.setAttribute(
          'data-insert-line-motion',
          previousInsertMotion === 'a' ? 'b' : 'a'
        );
      }
    }

    function getBookmarkDragPageSwitchDirection(pointerX, pointerY) {
      if (pageState.bookmarkCurrentPage > 0 &&
          pageState.bookmarkPagerPrevButton &&
          pageState.bookmarkPagerPrevButton.getAttribute('aria-disabled') !== 'true' &&
          isPointInsideBookmarkElement(pageState.bookmarkPagerPrevButton, pointerX, pointerY)) {
        return -1;
      }
      const pageCount = getBookmarkPageCount();
      if (pageState.bookmarkCurrentPage < (pageCount - 1) &&
          pageState.bookmarkPagerNextButton &&
          pageState.bookmarkPagerNextButton.getAttribute('aria-disabled') !== 'true' &&
          isPointInsideBookmarkElement(pageState.bookmarkPagerNextButton, pointerX, pointerY)) {
        return 1;
      }
      return 0;
    }

    function clearBookmarkDragPageSwitch(state) {
      if (!state) {
        return;
      }
      if (state.pageSwitchTimerId) {
        window.clearTimeout(state.pageSwitchTimerId);
        state.pageSwitchTimerId = 0;
      }
      if (state.pageSwitchButton) {
        state.pageSwitchButton.removeAttribute('data-bookmark-drag-page-target');
      }
      state.pageSwitchButton = null;
      state.pageSwitchDirection = 0;
    }

    function clearBookmarkDragFolderSwitch(state) {
      if (!state) {
        return;
      }
      if (state.folderSwitchTimerId) {
        window.clearTimeout(state.folderSwitchTimerId);
        state.folderSwitchTimerId = 0;
      }
      if (state.folderSwitchElement) {
        state.folderSwitchElement.removeAttribute(
          'data-bookmark-drag-folder-target'
        );
      }
      state.folderSwitchElement = null;
      state.folderSwitchTargetId = '';
    }

    function scheduleBookmarkDragFolderSwitch(state, dropTarget) {
      const getSwitchTarget = (target) => target && (target.kind === 'card' || target.kind === 'shortcut-folder')
        ? { folderId: String(target.folderId), element: target.element }
        : NEWTAB_BOOKMARK_DRAG.getFolderSwitchTarget(pageState.bookmarkCurrentFolderId, target);
      const switchTarget = getSwitchTarget(dropTarget);
      if (!state || !switchTarget || !isBookmarkSurfaceDragStateActive(state) ||
          !state.isDragging) {
        clearBookmarkDragFolderSwitch(state);
        return false;
      }
      if (state.folderSwitchTargetId !== switchTarget.folderId ||
          state.folderSwitchElement !== switchTarget.element) {
        clearBookmarkDragFolderSwitch(state);
        state.folderSwitchTargetId = switchTarget.folderId;
        state.folderSwitchElement = switchTarget.element;
        if (state.folderSwitchElement) {
          state.folderSwitchElement.setAttribute(
            'data-bookmark-drag-folder-target',
            'true'
          );
        }
      }
      if (state.folderSwitchTimerId) {
        return true;
      }
      state.folderSwitchTimerId = window.setTimeout(() => {
        state.folderSwitchTimerId = 0;
        if (!isBookmarkSurfaceDragStateActive(state) || !state.isDragging) {
          clearBookmarkDragFolderSwitch(state);
          return;
        }
        const activeTarget = getSwitchTarget(state.dropTarget);
        if (!activeTarget ||
            activeTarget.folderId !== state.folderSwitchTargetId) {
          clearBookmarkDragFolderSwitch(state);
          return;
        }
        const targetFolderId = activeTarget.folderId;
        clearBookmarkDragFolderSwitch(state);
        if (state.dropTarget.kind === 'shortcut-folder' ||
            (state.dropTarget.kind === 'card' && (isBookmarkTopbarMode() || pageState.currentBookmarkViewMode === 'list'))) {
          openBookmarkCascadeMenu({ id: targetFolderId, title: state.dropTarget.title, type: 'folder' },
            activeTarget.element, { dragMode: true, shouldOpen: () => isBookmarkSurfaceDragStateActive(state) });
          return;
        }
        clearDragDropTarget(state);
        if (state === pageState.bookmarkDragState) {
          restoreBookmarkDragPreview(state);
          setBookmarkDragCardTransform(state, Number(state.pendingPointerX), Number(state.pendingPointerY));
        }
        state.folderSwitchPendingId = targetFolderId;
        navigateBookmarkFolder(targetFolderId);
      }, BOOKMARK_DRAG_FOLDER_SWITCH_DELAY_MS);
      return true;
    }

    function scheduleBookmarkDragPageSwitch(state, direction) {
      const normalizedDirection = direction < 0 ? -1 : direction > 0 ? 1 : 0;
      if (!state || !normalizedDirection || !isBookmarkSurfaceDragStateActive(state) || !state.isDragging) {
        clearBookmarkDragPageSwitch(state);
        return;
      }
      const button = normalizedDirection < 0
        ? pageState.bookmarkPagerPrevButton
        : pageState.bookmarkPagerNextButton;
      if (!button) {
        clearBookmarkDragPageSwitch(state);
        return;
      }
      if (state.pageSwitchDirection !== normalizedDirection ||
          state.pageSwitchButton !== button) {
        clearBookmarkDragPageSwitch(state);
        state.pageSwitchDirection = normalizedDirection;
        state.pageSwitchButton = button;
        button.setAttribute('data-bookmark-drag-page-target', 'true');
      }
      if (state.pageSwitchTimerId) {
        return;
      }
      state.pageSwitchTimerId = window.setTimeout(() => {
        state.pageSwitchTimerId = 0;
        if (!isBookmarkSurfaceDragStateActive(state) || !state.isDragging) {
          clearBookmarkDragPageSwitch(state);
          return;
        }
        const pointerX = Number(state.pendingPointerX);
        const pointerY = Number(state.pendingPointerY);
        if (getBookmarkDragPageSwitchDirection(pointerX, pointerY) !== normalizedDirection) {
          clearBookmarkDragPageSwitch(state);
          return;
        }
        clearDragDropTarget(state);
        clearBookmarkDragFolderSwitch(state);
        if (state === pageState.bookmarkDragState) {
          restoreBookmarkDragPreview(state);
        }
        if (!switchBookmarkPageDuringDrag(pageState.bookmarkCurrentPage + normalizedDirection)) {
          clearBookmarkDragPageSwitch(state);
          return;
        }
        if (state === pageState.bookmarkDragState) {
          updateBookmarkDragLayoutCache(state);
          setBookmarkDragCardTransform(state, pointerX, pointerY);
        } else {
          setShortcutDragTileTransform(state, pointerX, pointerY);
        }
        const nextDirection = getBookmarkDragPageSwitchDirection(pointerX, pointerY);
        if (nextDirection === normalizedDirection) {
          scheduleBookmarkDragPageSwitch(state, normalizedDirection);
        } else {
          clearBookmarkDragPageSwitch(state);
        }
      }, BOOKMARK_DRAG_PAGE_SWITCH_DELAY_MS);
    }

    function processBookmarkDragMove(state) {
      if (!state || pageState.bookmarkDragState !== state || !state.isDragging) {
        return;
      }
      state.moveFrameId = 0;
      document.body.removeAttribute('data-drag-blocked');
      const pointerX = Number(state.pendingPointerX);
      const pointerY = Number(state.pendingPointerY);
      if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
        return;
      }
      if (state.folderSwitchPendingId) {
        clearBookmarkDragPageSwitch(state);
        clearDragDropTarget(state);
        setBookmarkDragCardTransform(state, pointerX, pointerY);
        return;
      }
      const topbarScrollDelta = pageState.bookmarkTopbarRuntime &&
        pageState.bookmarkTopbarRuntime.isActive() &&
        pageState.bookmarkTopbarRuntime.isVisible()
        ? pageState.bookmarkTopbarRuntime.autoScroll(pointerX, pointerY)
        : 0;
      if (topbarScrollDelta) {
        updateBookmarkDragLayoutCache(state);
        scheduleBookmarkDragMove(state, pointerX, pointerY);
      }
      setBookmarkDragCardTransform(state, pointerX, pointerY);
      const pageSwitchDirection = getBookmarkDragPageSwitchDirection(pointerX, pointerY);
      if (pageSwitchDirection) {
        clearBookmarkDragFolderSwitch(state);
        clearDragDropTarget(state);
        restoreBookmarkDragPreview(state);
        setBookmarkDragCardTransform(state, pointerX, pointerY);
        scheduleBookmarkDragPageSwitch(state, pageSwitchDirection);
        return;
      }
      clearBookmarkDragPageSwitch(state);
      if (isPointOverShortcutDropSurface(pointerX, pointerY)) {
        clearBookmarkDragFolderSwitch(state);
        restoreBookmarkDragPreview(state);
        setBookmarkDragCardTransform(state, pointerX, pointerY);
        const folderTarget = getShortcutFolderDropTargetAt(state, pointerX, pointerY);
        if (folderTarget && folderTarget.kind === 'blocked') {
          document.body.setAttribute('data-drag-blocked', 'true');
          clearDragDropTarget(state);
          return;
        }
        const shortcutTarget = folderTarget || getBookmarkDragShortcutDropTarget(state, pointerX, pointerY);
        if (shortcutTarget) {
          setDragDropTarget(state, shortcutTarget);
          if (folderTarget) {
            scheduleBookmarkDragFolderSwitch(state, folderTarget);
          }
        } else {
          clearDragDropTarget(state);
        }
        return;
      }
      const crossLevelTarget = getBookmarkCrossLevelDropTarget(state, pointerX, pointerY);
      if (crossLevelTarget) {
        scheduleBookmarkDragFolderSwitch(state, crossLevelTarget);
        restoreBookmarkDragPreview(state);
        setBookmarkDragCardTransform(state, pointerX, pointerY);
        setDragDropTarget(state, crossLevelTarget);
        return;
      }
      clearBookmarkDragFolderSwitch(state);
      clearDragDropTarget(state);
      restoreBookmarkDragPreview(state);
      setBookmarkDragCardTransform(state, pointerX, pointerY);
    }

    function scheduleBookmarkDragMove(state, pointerX, pointerY) {
      if (!state || !state.isDragging) {
        return;
      }
      state.pendingPointerX = pointerX;
      state.pendingPointerY = pointerY;
      if (state.moveFrameId) {
        return;
      }
      state.moveFrameId = window.requestAnimationFrame(() => {
        processBookmarkDragMove(state);
      });
    }

    function moveBookmarkCardElement(card, targetIndex) {
      if (!pageState.bookmarkGrid || !card || card.parentNode !== pageState.bookmarkGrid ||
          !Number.isFinite(targetIndex)) {
        return false;
      }
      const currentIndex = getBookmarkCardInsertionIndex(card);
      const remainingCards = getBookmarkReorderCards().filter((item) => item !== card);
      const boundedIndex = Math.max(0, Math.min(remainingCards.length, targetIndex));
      if (currentIndex === boundedIndex) {
        return false;
      }
      pageState.bookmarkGrid.insertBefore(card, remainingCards[boundedIndex] || null);
      return true;
    }

    function moveBookmarkItemInMemory(bookmarkId, targetAllIndex) {
      const currentIndex = getBookmarkCardAllIndex(bookmarkId);
      if (currentIndex < 0 || !Number.isFinite(targetAllIndex)) {
        return false;
      }
      const nextItems = pageState.bookmarkAllItems.slice();
      const movedItem = nextItems.splice(currentIndex, 1)[0];
      const boundedIndex = Math.max(0, Math.min(nextItems.length, targetAllIndex));
      if (currentIndex === boundedIndex) {
        return false;
      }
      nextItems.splice(boundedIndex, 0, movedItem);
      pageState.bookmarkAllItems = nextItems;
      return true;
    }

    function getBookmarkMoveDestination(bookmarkId) {
      const movedIndex = getBookmarkCardAllIndex(bookmarkId);
      if (movedIndex < 0) {
        return null;
      }
      const movedItem = pageState.bookmarkAllItems[movedIndex];
      const parentId = String((movedItem && movedItem.parentId) || pageState.bookmarkCurrentFolderId || '');
      if (!parentId) {
        return null;
      }
      const afterItem = pageState.bookmarkAllItems.slice(movedIndex + 1).find((item) =>
        item && String(item.parentId || parentId) === parentId && Number.isFinite(Number(item.index))
      );
      let destinationIndex = 0;
      if (afterItem) {
        destinationIndex = Number(afterItem.index);
      } else {
        const beforeItems = pageState.bookmarkAllItems.slice(0, movedIndex).reverse();
        const beforeItem = beforeItems.find((item) =>
          item && String(item.parentId || parentId) === parentId && Number.isFinite(Number(item.index))
        );
        destinationIndex = beforeItem ? Number(beforeItem.index) + 1 : 0;
      }
      return {
        parentId,
        index: Math.max(0, Math.round(destinationIndex))
      };
    }

    function getBookmarkDeleteRecord(target) {
      if (!target || !target.bookmarkId) {
        return null;
      }
      const node = bookmarksRuntime.getNode(target.bookmarkId);
      if (!node) {
        return null;
      }
      return NEWTAB_BOOKMARK_MOVE_HISTORY.createDeleteRecord({
        bookmarkId: String(node.id || target.bookmarkId),
        title: String(node.title || target.title || ''),
        parentId: String(node.parentId || target.parentId || ''),
        index: Number.isFinite(Number(node.index)) ? Number(node.index) : target.index,
        snapshot: node
      });
    }

    function deleteBookmarkFromContextTarget(target) {
      if (!target || !target.bookmarkId || pageState.bookmarkMoveHistoryBusy) {
        return false;
      }
      pageState.bookmarkMoveHistoryBusy = true;
      const keepCascadeOpen = Boolean(
        target.sourceKind === 'cascade' &&
        pageState.bookmarkCascadeRuntime &&
        typeof pageState.bookmarkCascadeRuntime.isOpen === 'function' &&
        pageState.bookmarkCascadeRuntime.isOpen()
      );
      bookmarksRuntime.runControlledMutation(() => {
        return bookmarksRuntime.ensureReady(false).then(() => {
          const record = getBookmarkDeleteRecord(target);
          if (!record) {
            throw new Error('Bookmark snapshot is unavailable.');
          }
          queueBookmarkLayoutAnimation(record.bookmarkId);
          return bookmarksRuntime.remove(record.bookmarkId, {
            recursive: !record.snapshot.url
          }).then(() => {
            bookmarkMoveHistory.push(record);
            markBookmarkTreeDirty({ preserveCascadeOpen: keepCascadeOpen });
            loadBookmarks({ force: true });
            if (keepCascadeOpen) {
              refreshOpenBookmarkCascadeMenu();
            }
            return true;
          });
        });
      }).catch((error) => {
        bookmarkPendingLayoutAnimation = null;
        console.warn('[Lumno] Failed to delete bookmark', error);
        showToast(t('bookmarks_delete_failed', 'Could not delete bookmark'), true);
      }).finally(() => {
        pageState.bookmarkMoveHistoryBusy = false;
      });
      return true;
    }

    function getBookmarkMoveRecord(state, destination, movedNode) {
      if (!state || !destination) {
        return null;
      }
      return NEWTAB_BOOKMARK_MOVE_HISTORY.createMoveRecord({
        bookmarkId: state.bookmarkId,
        title: state.itemTitle,
        from: {
          parentId: state.parentId,
          index: state.originalIndex
        },
        to: {
          parentId: String((movedNode && movedNode.parentId) || destination.parentId || ''),
          index: Number.isFinite(Number(movedNode && movedNode.index))
            ? Number(movedNode.index)
            : destination.index
        }
      });
    }

    function getBookmarkUndoShortcutLabel() {
      const isMac = /Mac|iPhone|iPad|iPod/i.test(String(navigator.platform || navigator.userAgent || ''));
      return isMac ? '⌘Z' : 'Ctrl+Z';
    }

    function getBookmarkRedoShortcutLabel() {
      const isMac = /Mac|iPhone|iPad|iPod/i.test(String(navigator.platform || navigator.userAgent || ''));
      return isMac ? '⇧⌘Z' : 'Ctrl+Shift+Z';
    }

    function refreshOpenBookmarkCascadeMenu(refreshOptions) {
      if (!pageState.bookmarkCascadeRuntime ||
          typeof pageState.bookmarkCascadeRuntime.isOpen !== 'function' ||
          !pageState.bookmarkCascadeRuntime.isOpen() ||
          typeof pageState.bookmarkCascadeRuntime.refresh !== 'function') {
        return Promise.resolve(false);
      }
      return Promise.resolve(pageState.bookmarkCascadeRuntime.refresh(refreshOptions)).catch((error) => {
        console.warn('[Lumno] Failed to refresh bookmark cascade after move', error);
        return false;
      });
    }

    function syncOpenBookmarkCascadeAnchorVisual() {
      if (!pageState.bookmarkCascadeRuntime ||
          typeof pageState.bookmarkCascadeRuntime.isOpen !== 'function' ||
          !pageState.bookmarkCascadeRuntime.isOpen() ||
          typeof pageState.bookmarkCascadeRuntime.getRootFolderId !== 'function' ||
          typeof pageState.bookmarkCascadeRuntime.rebindAnchor !== 'function') {
        return false;
      }
      const rootFolderId = String(pageState.bookmarkCascadeRuntime.getRootFolderId() || '');
      if (!rootFolderId) {
        return false;
      }
      const shortcutAnchor = getShortcutReorderTiles().find((tile) =>
        tile.getAttribute('data-bookmark-id') === rootFolderId
      );
      const currentShortcutAnchor = shortcutAnchor && shortcutAnchor.getAttribute('aria-expanded') === 'true';
      const nextAnchor = (currentShortcutAnchor && shortcutAnchor) || getBookmarkReorderCards().find((card) =>
        getBookmarkCardId(card) === rootFolderId
      ) || shortcutAnchor;
      return nextAnchor
        ? pageState.bookmarkCascadeRuntime.rebindAnchor(nextAnchor, { instant: true })
        : false;
    }

    function finishPersistedBookmarkMove(state, destination, movedNode) {
      const record = getBookmarkMoveRecord(state, destination, movedNode);
      if (record) {
        bookmarkMoveHistory.push(record);
      }
      const keepCascadeOpen = Boolean(state && state.keepCascadeOpenAfterDrop);
      markBookmarkTreeDirty({ preserveCascadeOpen: keepCascadeOpen });
      loadBookmarks({ force: true });
      if (keepCascadeOpen) {
        refreshOpenBookmarkCascadeMenu({
          draggedBookmarkId: String((state && state.bookmarkId) || ''),
          draggedRect: state && state.draggedVisualRect
        });
      }
      return true;
    }

    function persistBookmarkDragOrder(state) {
      if (!state || !state.bookmarkId) {
        return Promise.resolve(false);
      }
      const destination = getBookmarkMoveDestination(state.bookmarkId);
      if (!destination) {
        return Promise.resolve(false);
      }
      return bookmarksRuntime.runControlledMutation(() => {
        return bookmarksRuntime.move(state.bookmarkId, destination).then((movedNode) => {
          return finishPersistedBookmarkMove(state, destination, movedNode);
        });
      }).catch((error) => {
        console.warn('[Lumno] Failed to reorder bookmark', error);
        markBookmarkTreeDirty();
        loadBookmarks({ force: true });
        showToast(t('bookmarks_move_failed', 'Could not move bookmark'), true);
        return false;
      });
    }

    function persistBookmarkCrossLevelMove(state, target) {
      if (!state || !target || !target.folderId) {
        return Promise.resolve(false);
      }
      const targetFolderId = String(target.folderId);
      const targetItems = bookmarksRuntime.getFolderItems(targetFolderId);
      const rawTargetIndex = target.kind === 'insertion' && Number.isFinite(Number(target.index))
        ? Number(target.index)
        : targetItems.length;
      const shouldPreserveTargetPageSlot = target.kind === 'insertion' &&
        target.surface === 'grid' &&
        target.preservePageSlot === true &&
        String(state.parentId || '') === targetFolderId &&
        Number(state.originalIndex) < rawTargetIndex;
      const destinationIndex = shouldPreserveTargetPageSlot
        ? NEWTAB_BOOKMARK_MOVE_HISTORY.getMoveApiDestinationIndex({
          sourceParentId: state.parentId,
          sourceIndex: state.originalIndex,
          targetParentId: targetFolderId,
          targetIndex: rawTargetIndex
        })
        : rawTargetIndex;
      const destination = {
        parentId: targetFolderId,
        index: destinationIndex
      };
      return bookmarksRuntime.runControlledMutation(() => {
        return bookmarksRuntime.move(state.bookmarkId, destination).then((movedNode) => {
          return finishPersistedBookmarkMove(state, destination, movedNode);
        });
      }).catch((error) => {
        console.warn('[Lumno] Failed to move bookmark across folders', error);
        markBookmarkTreeDirty();
        loadBookmarks({ force: true });
        showToast(t('bookmarks_move_failed', 'Could not move bookmark'), true);
        return false;
      });
    }

    function performBookmarkMoveHistoryAction(direction) {
      if (pageState.bookmarkMoveHistoryBusy) {
        return false;
      }
      const isUndo = direction === 'undo';
      const record = isUndo ? bookmarkMoveHistory.peekUndo() : bookmarkMoveHistory.peekRedo();
      if (!record) {
        return false;
      }
      pageState.bookmarkMoveHistoryBusy = true;
      if (record.kind === 'shortcut-reorder') {
        const next = NEWTAB_CROSS_SURFACE_DRAG.planShortcutReorder({
          shortcuts: pageState.newtabShortcuts,
          sourceOrder: isUndo ? record.toOrder : record.fromOrder,
          order: isUndo ? record.fromOrder : record.toOrder
        });
        if (!next) {
          pageState.bookmarkMoveHistoryBusy = false;
          showToast(t('toast_error', 'Operation failed. Please try again.'), true);
          return true;
        }
        persistShortcuts(next, '').then((saved) => {
          if (!saved) return;
          if (isUndo) bookmarkMoveHistory.commitUndo();
          else bookmarkMoveHistory.commitRedo();
          scheduleWallpaperAdaptiveToneUpdate();
        }).finally(() => { pageState.bookmarkMoveHistoryBusy = false; });
        return true;
      }
      if (record.kind === 'transfer') {
        queueBookmarkLayoutAnimation('');
        applyBookmarkShortcutTransfer(record, isUndo).then((saved) => {
          if (!saved) return;
          if (isUndo) bookmarkMoveHistory.commitUndo();
          else bookmarkMoveHistory.commitRedo();
          if (!record.snapshot.url) {
            showToast(formatMessage(
              isUndo ? 'bookmarks_move_undone' : 'bookmarks_move_redone',
              isUndo ? 'Move undone · {shortcut} to redo' : 'Move restored · {shortcut} to undo',
              { shortcut: isUndo ? getBookmarkRedoShortcutLabel() : getBookmarkUndoShortcutLabel() }
            ));
          }
        }).finally(() => {
          pageState.bookmarkMoveHistoryBusy = false;
          if (pageState.newtabShortcuts.some((item) => item.type === 'folder')) return refreshShortcutFolderReferences();
        });
        return true;
      }
      if (record.kind === 'shortcut-stack') {
        queueBookmarkLayoutAnimation('');
        applyShortcutStack(record, isUndo).then((saved) => {
          if (!saved) return;
          if (isUndo) bookmarkMoveHistory.commitUndo();
          else bookmarkMoveHistory.commitRedo();
          showToast(formatMessage(
            isUndo ? 'newtab_shortcuts_stack_undone' : 'newtab_shortcuts_stack_redone',
            isUndo ? 'Folder creation undone · {shortcut} to redo' : 'Folder created again · {shortcut} to undo',
            { shortcut: isUndo ? getBookmarkRedoShortcutLabel() : getBookmarkUndoShortcutLabel() }
          ));
        }).finally(() => {
          pageState.bookmarkMoveHistoryBusy = false;
          if (pageState.newtabShortcuts.some((item) => item.type === 'folder')) return refreshShortcutFolderReferences();
        });
        return true;
      }
      if (record.kind === 'shortcut-delete') {
        const snapshot = record.snapshot;
        const exists = pageState.newtabShortcuts.some((item) => item.id === snapshot.id ||
          (snapshot.type === 'folder'
            ? !snapshot.folderRef && !item.folderRef && item.type === 'folder' && item.folderId === snapshot.folderId
            : item.url === snapshot.url));
        if (isUndo && (exists || pageState.newtabShortcuts.length >= MAX_NEWTAB_SHORTCUTS)) {
          pageState.bookmarkMoveHistoryBusy = false;
          showToast(t('toast_error', 'Operation failed. Please try again.'), true);
          return true;
        }
        const next = pageState.newtabShortcuts.slice();
        if (isUndo) {
          next.splice(Math.min(record.index, next.length), 0, snapshot);
        } else {
          const index = next.findIndex((item) => item.id === snapshot.id);
          if (index >= 0) next.splice(index, 1);
        }
        const iconChange = isUndo && record.iconDataUrl
          ? { shortcutId: snapshot.id, action: 'replace', dataUrl: record.iconDataUrl }
          : undefined;
        persistShortcuts(next, '', iconChange).then((saved) => {
          if (!saved) return;
          if (isUndo) bookmarkMoveHistory.commitUndo();
          else bookmarkMoveHistory.commitRedo();
          showToast(formatMessage(
            isUndo ? 'newtab_shortcuts_remove_undone' : 'newtab_shortcuts_remove_redone',
            isUndo ? 'Shortcut restored · {shortcut} to redo' : 'Shortcut removed · {shortcut} to undo',
            { shortcut: isUndo ? getBookmarkRedoShortcutLabel() : getBookmarkUndoShortcutLabel() }
          ));
        }).finally(() => { pageState.bookmarkMoveHistoryBusy = false; });
        return true;
      }
      const keepCascadeOpen = Boolean(
        pageState.bookmarkCascadeRuntime &&
        typeof pageState.bookmarkCascadeRuntime.isOpen === 'function' &&
        pageState.bookmarkCascadeRuntime.isOpen()
      );
      if (record.kind === 'delete') {
        queueBookmarkLayoutAnimation(
          isUndo
            ? ''
            : String((record.runtime && record.runtime.currentBookmarkId) || record.bookmarkId || '')
        );
        const deleteAction = bookmarksRuntime.runControlledMutation(() => {
          return isUndo
            ? bookmarksRuntime.restore(record.snapshot, {
              parentId: record.parentId,
              index: record.index
            }).then((node) => {
              bookmarkMoveHistory.remapBookmarkId(record.bookmarkId, node && node.id);
              if (record.runtime) {
                record.runtime.currentBookmarkId = String((node && node.id) || '');
              }
            })
            : bookmarksRuntime.remove(
              bookmarkMoveHistory.resolveBookmarkId(record.bookmarkId || (record.runtime && record.runtime.currentBookmarkId)),
              { recursive: !record.snapshot.url }
            ).then(() => {
              if (record.runtime) {
                record.runtime.currentBookmarkId = '';
              }
            });
        });
        deleteAction.then(() => {
          if (isUndo) {
            bookmarkMoveHistory.commitUndo();
            showToast(formatMessage(
              'bookmarks_delete_undone',
              'Deletion undone · {shortcut} to delete again',
              { shortcut: getBookmarkRedoShortcutLabel() }
            ));
          } else {
            bookmarkMoveHistory.commitRedo();
            showToast(formatMessage(
              'bookmarks_delete_redone',
              'Deletion restored · {shortcut} to undo',
              { shortcut: getBookmarkUndoShortcutLabel() }
            ));
          }
          markBookmarkTreeDirty({ preserveCascadeOpen: keepCascadeOpen });
          loadBookmarks({ force: true });
          if (keepCascadeOpen) {
            refreshOpenBookmarkCascadeMenu();
          }
        }).catch((error) => {
          bookmarkPendingLayoutAnimation = null;
          console.warn('[Lumno] Failed to restore bookmark deletion history', error);
          showToast(t('bookmarks_delete_failed', 'Could not delete bookmark'), true);
        }).finally(() => {
          pageState.bookmarkMoveHistoryBusy = false;
        });
        return true;
      }
      const source = isUndo ? record.to : record.from;
      const target = isUndo ? record.from : record.to;
      const destination = {
        parentId: target.parentId,
        index: NEWTAB_BOOKMARK_MOVE_HISTORY.getMoveApiDestinationIndex({
          sourceParentId: source.parentId,
          sourceIndex: source.index,
          targetParentId: target.parentId,
          targetIndex: target.index
        })
      };
      bookmarksRuntime.runControlledMutation(() => {
        return bookmarksRuntime.move(bookmarkMoveHistory.resolveBookmarkId(record.bookmarkId), destination);
      }).then(() => {
        if (isUndo) {
          bookmarkMoveHistory.commitUndo();
          showToast(formatMessage(
            'bookmarks_move_undone',
            'Move undone · {shortcut} to redo',
            { shortcut: getBookmarkRedoShortcutLabel() }
          ));
        } else {
          bookmarkMoveHistory.commitRedo();
          showToast(formatMessage(
            'bookmarks_move_redone',
            'Move restored · {shortcut} to undo',
            { shortcut: getBookmarkUndoShortcutLabel() }
          ));
        }
        markBookmarkTreeDirty({ preserveCascadeOpen: keepCascadeOpen });
        loadBookmarks({ force: true });
        if (keepCascadeOpen) {
          refreshOpenBookmarkCascadeMenu();
        }
      }).catch((error) => {
        bookmarkPendingLayoutAnimation = null;
        console.warn('[Lumno] Failed to restore bookmark move history', error);
        showToast(t('bookmarks_move_failed', 'Could not move bookmark'), true);
      }).finally(() => {
        pageState.bookmarkMoveHistoryBusy = false;
      });
      return true;
    }

    function isBookmarkDragActive() {
      return Boolean(
        (pageState.bookmarkDragState && pageState.bookmarkDragState.isDragging) ||
        (pageState.bookmarkGrid && pageState.bookmarkGrid.getAttribute('data-bookmark-dragging') === 'true')
      );
    }

    function isBookmarkReorderInteractionActive() {
      return Boolean(pageState.bookmarkDragState || isBookmarkDragActive());
    }

    function shouldSuppressBookmarkHover(target) {
      return Boolean(
        target &&
        (isBookmarkReorderInteractionActive() || isShortcutDragActive()) &&
        (
          (target.classList &&
            typeof target.classList.contains === 'function' &&
            target.classList.contains('x-nt-bookmark-card')) ||
          (typeof target.closest === 'function' &&
            target.closest('.x-nt-bookmark-card, .x-nt-bookmark-cascade-item'))
        )
      );
    }

    function startBookmarkDrag(event, card) {
      if (!pageState.bookmarkGrid || !card || !pageState.bookmarkDragState || pageState.bookmarkDragState.card !== card) {
        return;
      }
      pageState.bookmarkDragState.isDragging = true;
      if (document.body) {
        document.body.setAttribute('data-drag-source', 'bookmark');
      }
      hideCursorTooltip();
      const activeElement = document.activeElement;
      if (activeElement &&
          isEditableElement(activeElement) &&
          typeof activeElement.blur === 'function') {
        activeElement.blur();
      }
      if (pageState.bookmarkDragState.sourceKind === 'cascade') {
        if (pageState.bookmarkCascadeRuntime && typeof pageState.bookmarkCascadeRuntime.setDragMode === 'function') {
          pageState.bookmarkCascadeRuntime.setDragMode(true);
        }
      } else {
        closeBookmarkCascadeMenu();
      }
      if (pageState.bookmarkDragState.sourceKind !== 'cascade') {
        pageState.bookmarkGrid.setAttribute('data-bookmark-dragging', 'true');
      }
      card.setAttribute('data-bookmark-dragging', 'true');
      card.setAttribute('aria-grabbed', 'true');
      if (typeof card._xDeactivateBookmarkHoverVisual === 'function') {
        card._xDeactivateBookmarkHoverVisual();
      }
      card.style.pointerEvents = 'none';
      updateBookmarkDragLayoutCache(pageState.bookmarkDragState);
      createBookmarkCascadeDragPreview(pageState.bookmarkDragState);
      setBookmarkDragCardTransform(pageState.bookmarkDragState, Number(event.clientX), Number(event.clientY));
      if (typeof card.setPointerCapture === 'function') {
        try {
          card.setPointerCapture(event.pointerId);
        } catch (error) {
          // Pointer capture can fail if the browser already canceled the pointer.
        }
      }
    }

    function clearBookmarkDragCardVisual(card) {
      if (!card || !card.style) {
        return;
      }
      if (card._xBookmarkDropTimer) {
        window.clearTimeout(card._xBookmarkDropTimer);
        card._xBookmarkDropTimer = 0;
      }
      card.removeAttribute('data-bookmark-dragging');
      card.removeAttribute('data-bookmark-dropping');
      card.removeAttribute('aria-grabbed');
      card.style.removeProperty('transition');
      card.style.removeProperty('transform');
      card.style.removeProperty('will-change');
      card.style.pointerEvents = '';
    }

    function clearBookmarkDragSourceVisual(state) {
      if (!state) {
        return;
      }
      removeBookmarkCascadeDragPreview(state);
      clearBookmarkDragCardVisual(state.card);
    }

    function attachBookmarkDragDocumentListeners() {
      document.addEventListener('pointermove', handleBookmarkDragPointerMove, true);
      document.addEventListener('pointerup', handleBookmarkDragPointerUp, true);
      document.addEventListener('pointercancel', handleBookmarkDragPointerCancel, true);
      document.addEventListener('selectstart', handleBookmarkDragSelectStart, true);
    }

    function detachBookmarkDragDocumentListeners() {
      document.removeEventListener('pointermove', handleBookmarkDragPointerMove, true);
      document.removeEventListener('pointerup', handleBookmarkDragPointerUp, true);
      document.removeEventListener('pointercancel', handleBookmarkDragPointerCancel, true);
      document.removeEventListener('selectstart', handleBookmarkDragSelectStart, true);
    }

    function handleBookmarkDragSelectStart(event) {
      if (!pageState.bookmarkDragState || !event || typeof event.preventDefault !== 'function') {
        return;
      }
      event.preventDefault();
    }

    function finishBookmarkDrag(event, finishOptions) {
      if (!pageState.bookmarkDragState) {
        return;
      }
      if (event && pageState.bookmarkDragState.pointerId !== event.pointerId) {
        return;
      }
      if (document.body) {
        document.body.removeAttribute('data-drag-source');
        document.body.removeAttribute('data-drag-blocked');
      }
      const state = pageState.bookmarkDragState;
      detachBookmarkDragDocumentListeners();
      if (state.isDragging && state.moveFrameId) {
        cancelBookmarkDragMoveFrame(state);
        processBookmarkDragMove(state);
      }
      clearBookmarkDragPageSwitch(state);
      clearBookmarkDragFolderSwitch(state);
      const canceled = Boolean(finishOptions && finishOptions.canceled);
      const dropTarget = canceled ? null : state.dropTarget;
      state.draggedVisualRect = state.isDragging && dropTarget
        ? getBookmarkDragVisualRect(state)
        : null;
      clearDragDropTarget(state);
      const shouldKeepCascadeOpen =
        NEWTAB_BOOKMARK_DRAG.shouldKeepCascadeOpenAfterDrop(
          state.sourceKind,
          dropTarget
      );
      state.keepCascadeOpenAfterDrop = Boolean(dropTarget && shouldKeepCascadeOpen);
      if (state.isDragging) {
        if (shouldKeepCascadeOpen && pageState.bookmarkCascadeRuntime &&
            typeof pageState.bookmarkCascadeRuntime.setDragMode === 'function') {
          pageState.bookmarkCascadeRuntime.setDragMode(false);
        } else {
          closeBookmarkCascadeMenu();
        }
      }
      if (canceled) {
        restoreBookmarkDragPreview(state);
      }
      pageState.bookmarkDragState = null;
      document.body.removeAttribute('data-drag-blocked');
      state.folderSwitchPendingId = '';
      const card = state.card;
      if (pageState.bookmarkGrid) {
        pageState.bookmarkGrid.removeAttribute('data-bookmark-dragging');
      }
      if (card) {
        card.removeAttribute('aria-grabbed');
        if (typeof card.releasePointerCapture === 'function') {
          try {
            card.releasePointerCapture(state.pointerId);
          } catch (error) {
            // Ignore stale pointer capture releases.
          }
        }
        if (state.isDragging && dropTarget) {
          clearBookmarkDragSourceVisual(state);
        } else if (state.isDragging && state.sourceKind === 'cascade') {
          clearBookmarkDragSourceVisual(state);
        } else if (state.isDragging && state.dragPreviewElement) {
          clearBookmarkDragSourceVisual(state);
        } else if (state.isDragging) {
          settleBookmarkDragCard(card);
        } else {
          removeBookmarkCascadeDragPreview(state);
          card.removeAttribute('data-bookmark-dragging');
          card.removeAttribute('data-bookmark-dropping');
          card.style.pointerEvents = '';
        }
        if (state.isDragging) {
          card._xBookmarkSuppressClick = true;
          if (card._xBookmarkSuppressClickTimer) {
            window.clearTimeout(card._xBookmarkSuppressClickTimer);
          }
          if (event) {
            card._xBookmarkSuppressClickTimer = window.setTimeout(() => {
              card._xBookmarkSuppressClickTimer = 0;
              card._xBookmarkSuppressClick = false;
            }, BOOKMARK_DRAG_CLICK_SUPPRESS_MS);
          } else {
            card._xBookmarkSuppressClickTimer = 0;
            suppressCanceledDragClick(card, '_xBookmarkSuppressClick', state.pointerId);
          }
        }
      }
      if (state.isDragging && dropTarget && dropTarget.surface === 'shortcuts') {
        if (event && typeof event.preventDefault === 'function') {
          event.preventDefault();
        }
        moveBookmarkToShortcuts(state, dropTarget);
      } else if (state.isDragging && dropTarget) {
        if (event && typeof event.preventDefault === 'function') {
          event.preventDefault();
        }
        queueBookmarkLayoutAnimation(state.bookmarkId, {
          draggedBookmarkId: state.bookmarkId,
          draggedRect: state.draggedVisualRect
        });
        persistBookmarkCrossLevelMove(state, dropTarget);
      } else if (!canceled && state.isDragging && state.hasReordered) {
        if (event && typeof event.preventDefault === 'function') {
          event.preventDefault();
        }
        queueBookmarkLayoutAnimation(state.bookmarkId, {
          draggedBookmarkId: state.bookmarkId,
          draggedRect: state.draggedVisualRect
        });
        persistBookmarkDragOrder(state);
      } else if (
        state.isDragging &&
        pageState.bookmarkGrid &&
        pageState.bookmarkGrid.getAttribute('data-bookmark-empty-drop-surface') ===
          'true'
      ) {
        renderCurrentBookmarkPage();
      }
    }

    function beginBookmarkDragPointerTracking(event, card, bookmarkItem, sourceKind) {
      if (!event || !card || pageState.bookmarkDragState || pageState.bookmarkMoveHistoryBusy) {
        return false;
      }
      const bookmarkId = getBookmarkCardId(card);
      const parentId = getBookmarkCardParentId(card);
      if (!card || !bookmarkId || !parentId ||
          card.getAttribute('data-bookmark-draggable') !== 'true' ||
          (event.pointerType === 'mouse' && event.button !== 0)) {
        return false;
      }
      hideCursorTooltip();
      closeBookmarkContextMenu();
      const isOpenCascadeAnchor = Boolean(
        sourceKind !== 'cascade' &&
        pageState.bookmarkCascadeRuntime &&
        typeof pageState.bookmarkCascadeRuntime.isOpen === 'function' &&
        pageState.bookmarkCascadeRuntime.isOpen() &&
        card.getAttribute('aria-expanded') === 'true'
      );
      if (sourceKind !== 'cascade' && !isOpenCascadeAnchor) {
        closeBookmarkCascadeMenu();
      }
      const pageIndex = sourceKind === 'cascade' ? -1 : getBookmarkCardInsertionIndex(card);
      pageState.bookmarkDragState = NEWTAB_BOOKMARK_DRAG.createSession({
        allItems: pageState.bookmarkAllItems,
        bookmarkItem,
        card,
        event,
        bookmarkId,
        parentId,
        pageIndex,
        pageCardIds: getBookmarkReorderCards().map(getBookmarkCardId),
        sourceKind
      });
      attachBookmarkDragDocumentListeners();
      const rect = sourceKind === 'cascade' && typeof card.getBoundingClientRect === 'function'
        ? card.getBoundingClientRect()
        : getBookmarkCardLayoutRect(card) ||
        (typeof card.getBoundingClientRect === 'function' ? card.getBoundingClientRect() : null);
      if (rect) {
        pageState.bookmarkDragState.grabOffsetX = Number(event.clientX) - rect.left;
        pageState.bookmarkDragState.grabOffsetY = Number(event.clientY) - rect.top;
        pageState.bookmarkDragState.baseLeft = rect.left;
        pageState.bookmarkDragState.baseTop = rect.top;
      }
      if (typeof card._xDeactivateBookmarkHoverVisual === 'function') {
        card._xDeactivateBookmarkHoverVisual();
      }
      return true;
    }

    function handleBookmarkDragPointerDown(event) {
      if (pageState.bookmarkPageAnimating || pageState.bookmarkDragState) {
        return;
      }
      if (event.target && typeof event.target.closest === 'function' &&
          event.target.closest('.x-nt-bookmark-copy-action')) {
        return;
      }
      const card = getBookmarkCardFromNode(event.target);
      beginBookmarkDragPointerTracking(event, card, card && card._xBookmarkItem, 'card');
    }

    function handleBookmarkCascadeItemPointerDown(payload) {
      const event = payload && payload.event;
      const element = payload && payload.element;
      const item = payload && payload.item;
      if (pageState.bookmarkPageAnimating || pageState.bookmarkDragState || !event || !element || !item) {
        return;
      }
      beginBookmarkDragPointerTracking(event, element, item, 'cascade');
    }

    function handleBookmarkDragPointerMove(event) {
      if (!pageState.bookmarkDragState || pageState.bookmarkDragState.pointerId !== event.pointerId) {
        return;
      }
      const pointerX = Number(event.clientX);
      const pointerY = Number(event.clientY);
      if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
        return;
      }
      const dx = pointerX - pageState.bookmarkDragState.startX;
      const dy = pointerY - pageState.bookmarkDragState.startY;
      if (!pageState.bookmarkDragState.isDragging &&
          Math.hypot(dx, dy) < BOOKMARK_DRAG_START_THRESHOLD_PX) {
        return;
      }
      if (!pageState.bookmarkDragState.isDragging) {
        startBookmarkDrag(event, pageState.bookmarkDragState.card);
      }
      if (!pageState.bookmarkDragState.isDragging) {
        return;
      }
      event.preventDefault();
      scheduleBookmarkDragMove(pageState.bookmarkDragState, pointerX, pointerY);
    }

    function handleBookmarkDragPointerUp(event) {
      finishBookmarkDrag(event);
    }

    function handleBookmarkDragPointerCancel(event) {
      finishBookmarkDrag(event, { canceled: true });
    }

    return {
      queueBookmarkLayoutAnimation,
      playPendingBookmarkLayoutAnimation,
      updateBookmarkDragLayoutCache,
      setBookmarkDragCardTransform,
      isEmptyBookmarkRootHidden,
      getExternalBookmarkSurfacePoint,
      isValidExternalBookmarkDropTarget,
      getShortcutFolderDropTargetAt,
      getExternalBookmarkDropTarget,
      isPointOverShortcutDropSurface,
      applyBookmarkShortcutTransfer,
      applyShortcutStack,
      clearDragDropTarget,
      isBookmarkCascadeSurfaceAtPoint,
      setDragDropTarget,
      getBookmarkDragPageSwitchDirection,
      clearBookmarkDragPageSwitch,
      clearBookmarkDragFolderSwitch,
      scheduleBookmarkDragFolderSwitch,
      scheduleBookmarkDragPageSwitch,
      scheduleBookmarkDragMove,
      deleteBookmarkFromContextTarget,
      getBookmarkUndoShortcutLabel,
      refreshOpenBookmarkCascadeMenu,
      syncOpenBookmarkCascadeAnchorVisual,
      performBookmarkMoveHistoryAction,
      isBookmarkDragActive,
      shouldSuppressBookmarkHover,
      finishBookmarkDrag,
      handleBookmarkDragPointerDown,
      handleBookmarkCascadeItemPointerDown
    };
  }

  root.LumnoNewtabBookmarkDragController = { createBookmarkDragController };
})(globalThis);
