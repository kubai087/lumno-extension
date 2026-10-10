(function(root) {
  // Pointer-driven shortcut reordering and dragging shortcuts onto bookmarks.
  function createShortcutDrag(deps) {
    const {
      getShortcutReorderTiles,
      NEWTAB_CROSS_SURFACE_DRAG,
      refreshShortcutTileCacheFromDom,
      getShortcutTileId,
      getShortcutTileById,
      renderShortcuts,
      resetShortcutDockHover,
      NEWTAB_BOOKMARK_MOVE_HISTORY,
      persistShortcuts,
      bookmarkMoveHistory,
      hideCursorTooltip,
      closeBookmarkCascadeMenu,
      hideShortcutTooltip,
      isEmptyBookmarkRootHidden,
      renderCurrentBookmarkPage,
      isBookmarkTopbarMode,
      isBookmarkCascadeSurfaceAtPoint,
      getExternalBookmarkSurfacePoint,
      isPointOverShortcutDropSurface,
      clearBookmarkDragPageSwitch,
      clearBookmarkDragFolderSwitch,
      clearDragDropTarget,
      scheduleWallpaperAdaptiveToneUpdate,
      getBookmarkDragPageSwitchDirection,
      scheduleBookmarkDragPageSwitch,
      getShortcutFolderDropTargetAt,
      getExternalBookmarkDropTarget,
      setDragDropTarget,
      scheduleBookmarkDragFolderSwitch,
      getShortcutById,
      isValidExternalBookmarkDropTarget,
      bookmarksRuntime,
      getShortcutFolderId,
      queueBookmarkLayoutAnimation,
      applyBookmarkShortcutTransfer,
      applyShortcutStack,
      getFolderItemIconForShortcut,
      FOLDER_REFERENCES,
      showToast,
      hideToast,
      t,
      formatMessage,
      getBookmarkUndoShortcutLabel,
      refreshShortcutFolderReferences,
      isShortcutContextMenuNode,
      getShortcutTileFromNode,
      closeShortcutContextMenu
    } = deps;

    // Page state still owned by newtab.js; read and written through accessors.
    const pageState = deps.pageState;

    const SHORTCUT_DRAG_START_THRESHOLD_PX = 10;
    const SHORTCUT_REORDER_ANIMATION_MS = 180;
    const SHORTCUT_DROP_ANIMATION_MS = 210;
    const SHORTCUT_REORDER_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

    function getShortcutTileRectMap() {
      const rects = new Map();
      getShortcutReorderTiles().forEach((tile) => {
        if (tile && typeof tile.getBoundingClientRect === 'function') {
          rects.set(tile, tile.getBoundingClientRect());
        }
      });
      return rects;
    }

    function getShortcutTileLayoutRect(tile) {
      if (!tile || !pageState.shortcutGrid || typeof tile.offsetLeft !== 'number' ||
          typeof tile.offsetTop !== 'number') {
        return null;
      }
      const offsetParent = tile.offsetParent && typeof tile.offsetParent.getBoundingClientRect === 'function'
        ? tile.offsetParent
        : pageState.shortcutGrid;
      const parentRect = typeof offsetParent.getBoundingClientRect === 'function'
        ? offsetParent.getBoundingClientRect()
        : { left: 0, top: 0 };
      const width = Number(tile.offsetWidth) || 0;
      const height = Number(tile.offsetHeight) || 0;
      const left = parentRect.left + tile.offsetLeft;
      const top = parentRect.top + tile.offsetTop;
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

    function clearShortcutTileLayoutAnimation(tile) {
      if (!tile || !tile.style) {
        return;
      }
      if (tile._xShortcutLayoutAnimationTimer) {
        window.clearTimeout(tile._xShortcutLayoutAnimationTimer);
        tile._xShortcutLayoutAnimationTimer = 0;
      }
      tile.style.removeProperty('transition');
      if (tile.getAttribute && tile.getAttribute('data-shortcut-dragging') !== 'true' &&
          tile.getAttribute('data-shortcut-dropping') !== 'true') {
        tile.style.removeProperty('transform');
      }
    }

    function animateShortcutLayoutShift(beforeRects, draggedTile) {
      if (!beforeRects || !pageState.shortcutGrid) {
        return;
      }
      getShortcutReorderTiles().forEach((tile) => {
        if (!tile || tile === draggedTile || !tile.style || typeof tile.getBoundingClientRect !== 'function') {
          return;
        }
        const before = beforeRects.get(tile);
        if (!before) {
          return;
        }
        clearShortcutTileLayoutAnimation(tile);
        const after = tile.getBoundingClientRect();
        const dx = before.left - after.left;
        const dy = before.top - after.top;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
          return;
        }
        tile.style.transition = 'none';
        tile.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
        void tile.offsetWidth;
        window.requestAnimationFrame(() => {
          if (!tile.isConnected) {
            return;
          }
          tile.style.transition = `transform ${SHORTCUT_REORDER_ANIMATION_MS}ms ${SHORTCUT_REORDER_EASING}`;
          tile.style.transform = 'translate3d(0, 0, 0)';
          tile._xShortcutLayoutAnimationTimer = window.setTimeout(() => {
            tile._xShortcutLayoutAnimationTimer = 0;
            clearShortcutTileLayoutAnimation(tile);
          }, SHORTCUT_REORDER_ANIMATION_MS + 80);
        });
      });
    }

    function setShortcutDragTileTransform(state, pointerX, pointerY) {
      if (!state || !state.tile || !state.tile.style ||
          typeof state.tile.getBoundingClientRect !== 'function') {
        return;
      }
      const rect = state.tile.getBoundingClientRect();
      const currentX = Number(state.translateX) || 0;
      const currentY = Number(state.translateY) || 0;
      const baseLeft = rect.left - currentX;
      const baseTop = rect.top - currentY;
      const nextX = pointerX - state.grabOffsetX - baseLeft;
      const nextY = pointerY - state.grabOffsetY - baseTop;
      state.translateX = nextX;
      state.translateY = nextY;
      state.tile.style.transition = 'none';
      state.tile.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`;
    }

    function settleShortcutDragTile(tile) {
      if (!tile || !tile.style) {
        return;
      }
      tile.setAttribute('data-shortcut-dropping', 'true');
      tile.style.pointerEvents = '';
      tile.style.transition = `transform ${SHORTCUT_DROP_ANIMATION_MS}ms ${SHORTCUT_REORDER_EASING}`;
      tile.style.transform = 'translate3d(0, 0, 0)';
      if (tile._xShortcutDropTimer) {
        window.clearTimeout(tile._xShortcutDropTimer);
      }
      tile._xShortcutDropTimer = window.setTimeout(() => {
        tile._xShortcutDropTimer = 0;
        tile.removeAttribute('data-shortcut-dragging');
        tile.removeAttribute('data-shortcut-dropping');
        tile.style.removeProperty('transition');
        tile.style.removeProperty('transform');
        tile.style.removeProperty('will-change');
        tile.style.pointerEvents = '';
      }, SHORTCUT_DROP_ANIMATION_MS + 90);
    }

    function getShortcutTileInsertionIndex(tile) {
      if (!tile) {
        return -1;
      }
      return getShortcutReorderTiles().indexOf(tile);
    }

    function getShortcutInsertionSlotAt(pointerX, pointerY, excludedTile) {
      const layoutItems = getShortcutReorderTiles()
        .filter((tile) => tile && tile !== excludedTile)
        .map((tile) => ({
          tile,
          rect: getShortcutTileLayoutRect(tile)
        }))
        .filter((item) => item.rect && item.rect.width > 0 && item.rect.height > 0);
      const slot = NEWTAB_CROSS_SURFACE_DRAG.getRowInsertionSlot(layoutItems, pointerX, pointerY);
      return {
        index: slot.index,
        markerPosition: slot.markerPosition,
        anchorRect: slot.anchorIndex >= 0 ? layoutItems[slot.anchorIndex].rect : null,
        anchorTile: slot.anchorIndex >= 0 ? layoutItems[slot.anchorIndex].tile : null
      };
    }

    function getShortcutDragInsertionIndex(pointerX, pointerY) {
      if (!pageState.shortcutGrid || !pageState.shortcutDragState || !Number.isFinite(pointerX) ||
          !Number.isFinite(pointerY)) {
        return -1;
      }
      return getShortcutInsertionSlotAt(pointerX, pointerY, pageState.shortcutDragState.tile).index;
    }

    function moveShortcutTileElement(tile, targetIndex) {
      if (!pageState.shortcutGrid || !tile || tile.parentNode !== pageState.shortcutGrid ||
          !Number.isFinite(targetIndex)) {
        return false;
      }
      const currentIndex = getShortcutTileInsertionIndex(tile);
      const remainingTiles = getShortcutReorderTiles().filter((item) => item !== tile);
      const boundedIndex = Math.max(0, Math.min(remainingTiles.length, targetIndex));
      if (currentIndex === boundedIndex) {
        return false;
      }
      pageState.shortcutGrid.insertBefore(
        tile,
        remainingTiles[boundedIndex] || pageState.addShortcutButton || null
      );
      refreshShortcutTileCacheFromDom();
      return true;
    }

    function moveShortcutItem(shortcutId, targetIndex) {
      if (!shortcutId || !Number.isFinite(targetIndex)) {
        return false;
      }
      const currentIndex = pageState.newtabShortcuts.findIndex((item) => item && item.id === shortcutId);
      if (currentIndex < 0) {
        return false;
      }
      const tiles = getShortcutReorderTiles();
      const visibleIds = tiles.filter((tile) => getShortcutTileId(tile) !== shortcutId).map(getShortcutTileId);
      const visibleTargetIndex = Math.max(0, Math.min(visibleIds.length, Math.floor(targetIndex)));
      if (tiles.findIndex((tile) => getShortcutTileId(tile) === shortcutId) === visibleTargetIndex) {
        return false;
      }
      const nextShortcuts = pageState.newtabShortcuts.slice();
      const shortcutItem = nextShortcuts.splice(currentIndex, 1)[0];
      const anchorId = visibleIds[visibleTargetIndex];
      const anchorIndex = anchorId ? nextShortcuts.findIndex((item) => item.id === anchorId) : nextShortcuts.length;
      const boundedIndex = Math.max(0, anchorIndex);
      if (currentIndex === boundedIndex) {
        return false;
      }
      nextShortcuts.splice(boundedIndex, 0, shortcutItem);
      pageState.newtabShortcuts = nextShortcuts;
      return true;
    }

    function restoreShortcutDragOrder(state) {
      const originalOrder = state.originalShortcuts.map((item) => item.id);
      const restored = NEWTAB_CROSS_SURFACE_DRAG.planShortcutReorder({
        shortcuts: pageState.newtabShortcuts, order: originalOrder
      });
      if (restored) pageState.newtabShortcuts = restored;
      // React has not committed the manually moved DOM order during the drag.
      let visibleIndex = 0;
      pageState.newtabShortcuts.forEach((shortcut) => {
        const tile = getShortcutTileById(shortcut.id);
        if (tile) moveShortcutTileElement(tile, visibleIndex++);
      });
      renderShortcuts();
      resetShortcutDockHover();
    }

    function persistShortcutOrder(state) {
      const record = state && NEWTAB_BOOKMARK_MOVE_HISTORY.createShortcutReorderRecord({
        fromOrder: state.originalShortcuts.map((item) => item.id),
        toOrder: pageState.newtabShortcuts.map((item) => item.id)
      });
      if (state && !record) return Promise.resolve(pageState.newtabShortcuts);
      if (state) pageState.bookmarkMoveHistoryBusy = true;
      return persistShortcuts(pageState.newtabShortcuts, '', undefined, { render: false })
        .then((saved) => {
          if (saved && record) bookmarkMoveHistory.push(record);
          if (!saved && state) restoreShortcutDragOrder(state);
          return pageState.newtabShortcuts;
        }).finally(() => {
          if (state) pageState.bookmarkMoveHistoryBusy = false;
        });
    }

    function startShortcutDrag(event, tile) {
      if (!pageState.shortcutGrid || !tile || !pageState.shortcutDragState || pageState.shortcutDragState.tile !== tile) {
        return;
      }
      pageState.shortcutDragState.isDragging = true;
      hideCursorTooltip();
      closeBookmarkCascadeMenu();
      if (document.body) {
        document.body.setAttribute('data-drag-source', 'shortcut');
      }
      hideShortcutTooltip();
      resetShortcutDockHover();
      if (isEmptyBookmarkRootHidden()) {
        renderCurrentBookmarkPage();
      }
      pageState.shortcutGrid.setAttribute('data-shortcut-dragging', 'true');
      tile.setAttribute('data-shortcut-dragging', 'true');
      tile.setAttribute('aria-grabbed', 'true');
      tile.style.pointerEvents = 'none';
      tile.style.willChange = 'transform';
      setShortcutDragTileTransform(pageState.shortcutDragState, Number(event.clientX), Number(event.clientY));
      if (typeof tile.setPointerCapture === 'function') {
        try {
          tile.setPointerCapture(event.pointerId);
        } catch (error) {
          // Pointer capture can fail if the browser already canceled the pointer.
        }
      }
    }

    function cancelShortcutDragMoveFrame(state) {
      if (!state || !state.moveFrameId) {
        return;
      }
      window.cancelAnimationFrame(state.moveFrameId);
      state.moveFrameId = 0;
    }

    function applyShortcutDragMove(state, pointerX, pointerY) {
      if (!state || state !== pageState.shortcutDragState || !state.isDragging ||
          !Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
        return;
      }
      setShortcutDragTileTransform(state, pointerX, pointerY);
      document.body.removeAttribute('data-drag-blocked');
      const topbarPoint = isBookmarkTopbarMode() &&
        !isBookmarkCascadeSurfaceAtPoint(pointerX, pointerY)
        ? getExternalBookmarkSurfacePoint(pointerX, pointerY) : null;
      if (topbarPoint && pageState.bookmarkTopbarRuntime.autoScroll(topbarPoint.x, topbarPoint.y)) {
        scheduleShortcutDragMove(state, pointerX, pointerY);
      }
      if (updateShortcutDragBookmarkTarget(state, pointerX, pointerY)) {
        return;
      }
      if (!isPointOverShortcutDropSurface(pointerX, pointerY)) {
        return;
      }
      const targetIndex = getShortcutDragInsertionIndex(pointerX, pointerY);
      if (targetIndex < 0 || targetIndex === getShortcutTileInsertionIndex(state.tile)) {
        return;
      }
      const beforeRects = getShortcutTileRectMap();
      if (moveShortcutItem(state.shortcutId, targetIndex) &&
          moveShortcutTileElement(state.tile, targetIndex)) {
        animateShortcutLayoutShift(beforeRects, state.tile);
        setShortcutDragTileTransform(state, pointerX, pointerY);
        state.hasReordered = true;
      }
    }

    function flushShortcutDragMove(state) {
      if (!state) {
        return;
      }
      cancelShortcutDragMoveFrame(state);
      applyShortcutDragMove(
        state,
        Number(state.pendingPointerX),
        Number(state.pendingPointerY)
      );
      cancelShortcutDragMoveFrame(state);
    }

    function scheduleShortcutDragMove(state, pointerX, pointerY) {
      if (!state) {
        return;
      }
      state.pendingPointerX = pointerX;
      state.pendingPointerY = pointerY;
      if (state.moveFrameId) {
        return;
      }
      state.moveFrameId = window.requestAnimationFrame(() => {
        state.moveFrameId = 0;
        applyShortcutDragMove(
          state,
          Number(state.pendingPointerX),
          Number(state.pendingPointerY)
        );
      });
    }

    function suppressCanceledDragClick(element, flagName, pointerId) {
      if (element._xDragCancelClickCleanup) {
        element._xDragCancelClickCleanup();
      }
      element[flagName] = true;
      const cleanup = () => {
        document.removeEventListener('pointerup', onRelease, true);
        document.removeEventListener('pointercancel', onRelease, true);
        document.removeEventListener('pointerdown', onNextPress, true);
        delete element._xDragCancelClickCleanup;
      };
      const onRelease = (releaseEvent) => {
        if (releaseEvent.pointerId !== pointerId) {
          return;
        }
        cleanup();
        // A canceled drag can still generate a click when the held mouse is
        // released later. Keep suppression through that click's event turn.
        window.setTimeout(() => { element[flagName] = false; }, 0);
      };
      const onNextPress = () => {
        cleanup();
        element[flagName] = false;
      };
      element._xDragCancelClickCleanup = cleanup;
      document.addEventListener('pointerup', onRelease, true);
      document.addEventListener('pointercancel', onRelease, true);
      document.addEventListener('pointerdown', onNextPress, true);
    }

    function finishShortcutDrag(event, options) {
      if (!pageState.shortcutDragState) {
        return;
      }
      if (event && pageState.shortcutDragState.pointerId !== event.pointerId) {
        return;
      }
      const state = pageState.shortcutDragState;
      detachShortcutDragDocumentListeners();
      if (event && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
        state.pendingPointerX = event.clientX;
        state.pendingPointerY = event.clientY;
      }
      if (state.isDragging) {
        flushShortcutDragMove(state);
      }
      const bookmarkDropTarget = state.isDragging && !(options && options.cancel)
        ? state.dropTarget
        : null;
      if (state.stackHintVisible && !(bookmarkDropTarget && bookmarkDropTarget.kind === 'shortcut-stack')) {
        hideToast();
      }
      clearBookmarkDragPageSwitch(state);
      clearBookmarkDragFolderSwitch(state);
      clearDragDropTarget(state);
      pageState.shortcutDragState = null;
      document.body.removeAttribute('data-drag-blocked');
      closeBookmarkCascadeMenu();
      if (document.body) {
        document.body.removeAttribute('data-drag-source');
      }
      const tile = state.tile;
      if (pageState.shortcutGrid) {
        pageState.shortcutGrid.removeAttribute('data-shortcut-dragging');
      }
      if (tile) {
        tile.removeAttribute('aria-grabbed');
        if (typeof tile.releasePointerCapture === 'function') {
          try {
            tile.releasePointerCapture(state.pointerId);
          } catch (error) {
            // Ignore stale pointer capture releases.
          }
        }
        if (state.isDragging && !bookmarkDropTarget) {
          settleShortcutDragTile(tile);
        } else if (!state.isDragging) {
          tile.removeAttribute('data-shortcut-dragging');
          tile.removeAttribute('data-shortcut-dropping');
          tile.style.pointerEvents = '';
        }
        if (state.isDragging) {
          tile._xShortcutSuppressClick = true;
          if (event) {
            window.setTimeout(() => {
              tile._xShortcutSuppressClick = false;
            }, 0);
          } else {
            suppressCanceledDragClick(tile, '_xShortcutSuppressClick', state.pointerId);
          }
        }
      }
      if (bookmarkDropTarget) {
        if (event && typeof event.preventDefault === 'function') {
          event.preventDefault();
        }
        if (bookmarkDropTarget.kind === 'shortcut-stack') {
          stackShortcuts(state, bookmarkDropTarget);
        } else {
          moveShortcutToBookmarks(state, bookmarkDropTarget);
        }
        return;
      }
      if (options && options.cancel && state.hasReordered) {
        restoreShortcutDragOrder(state);
        return;
      }
      if (state.isDragging &&
          pageState.bookmarkGrid &&
          pageState.bookmarkGrid.getAttribute('data-bookmark-empty-drop-surface') === 'true') {
        renderCurrentBookmarkPage();
      }
      if (state.isDragging && state.hasReordered) {
        if (event && typeof event.preventDefault === 'function') {
          event.preventDefault();
        }
        persistShortcutOrder(state).then(() => {
          renderShortcuts();
          scheduleWallpaperAdaptiveToneUpdate();
        });
        return;
      }
      if (options && options.cancel) {
        resetShortcutDockHover();
      }
    }

    // Reordering re-inserts the captured tile, which drops pointer capture, and
    // the shortcut section ignores pointer events while a drag is lifted above
    // the bookmarks, so the session listens on the document like bookmark drags.
    function attachShortcutDragDocumentListeners() {
      document.addEventListener('pointermove', handleShortcutDragPointerMove, true);
      document.addEventListener('pointerup', handleShortcutDragPointerUp, true);
      document.addEventListener('pointercancel', handleShortcutDragPointerCancel, true);
    }

    function detachShortcutDragDocumentListeners() {
      document.removeEventListener('pointermove', handleShortcutDragPointerMove, true);
      document.removeEventListener('pointerup', handleShortcutDragPointerUp, true);
      document.removeEventListener('pointercancel', handleShortcutDragPointerCancel, true);
    }

    function isShortcutDragActive() {
      return Boolean(pageState.shortcutDragState && pageState.shortcutDragState.isDragging);
    }

    function isBookmarkSurfaceDragStateActive(state) {
      return Boolean(state && state.isDragging && (state === pageState.bookmarkDragState || state === pageState.shortcutDragState));
    }

    function updateShortcutDragBookmarkTarget(state, pointerX, pointerY) {
      if (state.folderSwitchPendingId) {
        return true;
      }
      const direction = getBookmarkDragPageSwitchDirection(pointerX, pointerY);
      if (direction) {
        clearDragDropTarget(state);
        clearBookmarkDragFolderSwitch(state);
        setShortcutStackHint(state, false);
        scheduleBookmarkDragPageSwitch(state, direction);
        return true;
      }
      clearBookmarkDragPageSwitch(state);
      const overBookmarks = Boolean(getExternalBookmarkSurfacePoint(pointerX, pointerY));
      const overCascade = isBookmarkCascadeSurfaceAtPoint(pointerX, pointerY);
      const dockFolder = getShortcutFolderDropTargetAt(state, pointerX, pointerY);
      const stackTarget = overCascade || overBookmarks || dockFolder
        ? null
        : getShortcutStackTargetAt(state, pointerX, pointerY);
      const target = overCascade || overBookmarks || dockFolder
        ? getExternalBookmarkDropTarget(pointerX, pointerY, state) || dockFolder
        : stackTarget;
      setShortcutStackHint(state, Boolean(stackTarget));
      if (target && target.kind === 'blocked') {
        document.body.setAttribute('data-drag-blocked', 'true');
        clearDragDropTarget(state);
        clearBookmarkDragFolderSwitch(state);
        return true;
      }
      if (target) {
        setDragDropTarget(state, target);
        scheduleBookmarkDragFolderSwitch(state, target);
      } else {
        clearDragDropTarget(state);
        clearBookmarkDragFolderSwitch(state);
      }
      return overBookmarks || overCascade || Boolean(dockFolder) || Boolean(stackTarget);
    }

    // While the folder backdrop shows, say what releasing does.
    function setShortcutStackHint(state, visible) {
      if (!state || Boolean(state.stackHintVisible) === visible) {
        return;
      }
      state.stackHintVisible = visible;
      if (visible) {
        showToast(t('newtab_shortcuts_stack_hint', 'Release to create a folder in the bookmarks bar'), false, { duration: 0 });
      } else {
        hideToast();
      }
    }

    // The middle of another website tile stacks the dragged website onto it,
    // like folder tiles accept it; the outer quarters still reorder.
    function getShortcutStackTargetAt(state, pointerX, pointerY) {
      const source = state && getShortcutById(state.shortcutId);
      if (!source || source.type === 'folder' || !isPointOverShortcutDropSurface(pointerX, pointerY)) {
        return null;
      }
      const tile = getShortcutReorderTiles().find((candidate) => {
        if (candidate === state.tile || candidate.hasAttribute('data-bookmark-drop-folder-id')) {
          return false;
        }
        const rect = getShortcutTileLayoutRect(candidate);
        return rect && pointerX >= rect.left + rect.width * 0.25 &&
          pointerX <= rect.right - rect.width * 0.25 && pointerY >= rect.top && pointerY <= rect.bottom;
      });
      const target = tile ? getShortcutById(getShortcutTileId(tile)) : null;
      return target && target.type !== 'folder' && target.id !== source.id
        ? { kind: 'shortcut-stack', surface: 'shortcuts', element: tile, shortcutId: target.id }
        : null;
    }

    function stackShortcuts(state, target) {
      const source = getShortcutById(state.shortcutId);
      const destination = getShortcutById(target.shortcutId);
      const restoreShortcut = () => {
        settleShortcutDragTile(state.tile);
        if (state.hasReordered) {
          persistShortcutOrder().then(() => {
            renderShortcuts();
            scheduleWallpaperAdaptiveToneUpdate();
          });
        }
        return false;
      };
      if (!source || !destination || source.type === 'folder' || destination.type === 'folder' ||
          pageState.bookmarkMoveHistoryBusy) {
        hideToast();
        return Promise.resolve(restoreShortcut());
      }
      // Indexes come from before the drag, so undo also reverts its reordering.
      const originalShortcuts = state.originalShortcuts || pageState.newtabShortcuts;
      const toSource = (shortcut) => ({
        snapshot: shortcut,
        index: originalShortcuts.findIndex((item) => item.id === shortcut.id),
        iconDataUrl: pageState.newtabShortcutIcons[shortcut.id]
      });
      const record = NEWTAB_BOOKMARK_MOVE_HISTORY.createShortcutStackRecord({
        snapshot: {
          title: t('newtab_shortcuts_new_folder_title', 'New folder'),
          children: [destination, source].map((shortcut) => ({ title: shortcut.title, url: shortcut.url }))
        },
        sources: [toSource(destination), toSource(source)],
        itemIcons: [destination, source].map((shortcut) => getFolderItemIconForShortcut(
          shortcut, pageState.newtabShortcutIcons[shortcut.id])),
        folderShortcut: {
          id: FOLDER_REFERENCES.createEntryId(),
          index: pageState.newtabShortcuts.filter((item) => item.id !== source.id)
            .findIndex((item) => item.id === destination.id)
        }
      });
      if (!record) {
        hideToast();
        return Promise.resolve(restoreShortcut());
      }
      pageState.bookmarkMoveHistoryBusy = true;
      queueBookmarkLayoutAnimation('');
      return applyShortcutStack(record, false).then((stacked) => {
        if (!stacked) return restoreShortcut();
        bookmarkMoveHistory.push({ ...record, bookmarkId: record.runtime.currentBookmarkId });
        showToast(formatMessage(
          'newtab_shortcuts_stacked_undo',
          'Folder created · {shortcut} to undo',
          { shortcut: getBookmarkUndoShortcutLabel() }
        ));
        return true;
      }).finally(() => {
        pageState.bookmarkMoveHistoryBusy = false;
        return refreshShortcutFolderReferences();
      });
    }

    function moveShortcutToBookmarks(state, target) {
      const shortcut = getShortcutById(state.shortcutId);
      const restoreShortcut = () => {
        settleShortcutDragTile(state.tile);
        if (state.hasReordered) {
          persistShortcutOrder().then(() => {
            renderShortcuts();
            scheduleWallpaperAdaptiveToneUpdate();
          });
        }
        return false;
      };
      if (!shortcut || pageState.bookmarkMoveHistoryBusy) {
        return Promise.resolve(restoreShortcut());
      }
      if (!isValidExternalBookmarkDropTarget(state, target)) {
        return Promise.resolve(restoreShortcut());
      }
      const isFolder = shortcut.type === 'folder';
      const node = isFolder ? bookmarksRuntime.getNode(getShortcutFolderId(shortcut)) : null;
      if (isFolder && !node) {
        return Promise.resolve(restoreShortcut());
      }
      const from = node ? { parentId: node.parentId, index: node.index } : null;
      const to = isFolder && String(node.parentId) === String(target.folderId) && target.kind !== 'insertion'
        ? from
        : {
          parentId: String(target.folderId),
          index: NEWTAB_BOOKMARK_MOVE_HISTORY.normalizeMoveDestinationIndex({
            sourceParentId: from && from.parentId,
            sourceIndex: from && from.index,
            targetParentId: target.folderId,
            targetIndex: target.kind === 'insertion'
              ? target.index : bookmarksRuntime.getFolderItems(target.folderId).length
          })
        };
      const originalShortcuts = state.originalShortcuts || pageState.newtabShortcuts;
      const record = NEWTAB_BOOKMARK_MOVE_HISTORY.createTransferRecord({
        bookmarkId: node && node.id,
        snapshot: { title: isFolder ? node.title : shortcut.title, url: isFolder ? '' : shortcut.url },
        from,
        to,
        beforeShortcut: {
          snapshot: shortcut,
          index: originalShortcuts.findIndex((item) => item.id === shortcut.id),
          iconDataUrl: pageState.newtabShortcutIcons[shortcut.id]
        }
      });
      if (!record) return Promise.resolve(restoreShortcut());
      pageState.bookmarkMoveHistoryBusy = true;
      queueBookmarkLayoutAnimation('');
      return applyBookmarkShortcutTransfer(record, false).then((moved) => {
        if (!moved) return restoreShortcut();
        bookmarkMoveHistory.push({
          ...record,
          bookmarkId: record.runtime.currentBookmarkId,
          to: record.runtime.location || record.to
        });
        if (isFolder) {
          showToast(t('newtab_shortcuts_moved_to_bookmarks', 'Moved to bookmarks'));
        }
        return true;
      }).finally(() => {
        pageState.bookmarkMoveHistoryBusy = false;
        if (pageState.newtabShortcuts.some((item) => item.type === 'folder')) return refreshShortcutFolderReferences();
      });
    }

    function handleShortcutDragPointerDown(event) {
      if (pageState.bookmarkMoveHistoryBusy || isShortcutContextMenuNode(event.target)) {
        return;
      }
      const tile = getShortcutTileFromNode(event.target);
      const shortcutId = getShortcutTileId(tile);
      if (!tile || !shortcutId || (event.pointerType === 'mouse' && event.button !== 0)) {
        return;
      }
      closeShortcutContextMenu();
      pageState.shortcutDragState = {
        pointerId: event.pointerId,
        tile,
        shortcutId,
        originalShortcuts: pageState.newtabShortcuts.slice(),
        bookmarkId: getShortcutFolderId(getShortcutById(shortcutId)),
        pageSwitchTimerId: 0,
        folderSwitchTimerId: 0,
        folderSwitchPendingId: '',
        startX: Number(event.clientX),
        startY: Number(event.clientY),
        grabOffsetX: 0,
        grabOffsetY: 0,
        translateX: 0,
        translateY: 0,
        pendingPointerX: Number(event.clientX),
        pendingPointerY: Number(event.clientY),
        moveFrameId: 0,
        dropTarget: null,
        isDragging: false,
        hasReordered: false
      };
      if (typeof tile.getBoundingClientRect === 'function') {
        const rect = tile.getBoundingClientRect();
        pageState.shortcutDragState.grabOffsetX = Number(event.clientX) - rect.left;
        pageState.shortcutDragState.grabOffsetY = Number(event.clientY) - rect.top;
      }
      attachShortcutDragDocumentListeners();
      if (typeof tile.setPointerCapture === 'function') {
        try {
          tile.setPointerCapture(event.pointerId);
        } catch (error) {
          // Pointer capture can fail if the browser already canceled the pointer.
        }
      }
    }

    function handleShortcutDragPointerMove(event) {
      if (!pageState.shortcutDragState || pageState.shortcutDragState.pointerId !== event.pointerId) {
        return;
      }
      const pointerX = Number(event.clientX);
      const pointerY = Number(event.clientY);
      if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
        return;
      }
      const dx = pointerX - pageState.shortcutDragState.startX;
      const dy = pointerY - pageState.shortcutDragState.startY;
      if (!pageState.shortcutDragState.isDragging &&
          Math.hypot(dx, dy) < SHORTCUT_DRAG_START_THRESHOLD_PX) {
        return;
      }
      if (!pageState.shortcutDragState.isDragging) {
        startShortcutDrag(event, pageState.shortcutDragState.tile);
      }
      if (!pageState.shortcutDragState.isDragging) {
        return;
      }
      event.preventDefault();
      scheduleShortcutDragMove(pageState.shortcutDragState, pointerX, pointerY);
    }

    function handleShortcutDragPointerUp(event) {
      finishShortcutDrag(event);
    }

    function handleShortcutDragPointerCancel(event) {
      finishShortcutDrag(event, { cancel: true });
    }

    return {
      getShortcutTileLayoutRect,
      setShortcutDragTileTransform,
      getShortcutInsertionSlotAt,
      scheduleShortcutDragMove,
      suppressCanceledDragClick,
      finishShortcutDrag,
      isShortcutDragActive,
      isBookmarkSurfaceDragStateActive,
      handleShortcutDragPointerDown
    };
  }

  root.LumnoNewtabShortcutDrag = { createShortcutDrag };
})(globalThis);
