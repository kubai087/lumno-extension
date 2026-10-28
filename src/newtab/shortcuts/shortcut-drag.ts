// Pointer-driven shortcut reordering and dragging shortcuts onto bookmarks.
import { isElementNode, isHtmlElement } from '../../shared/dom-guards';
import { queryHtmlElement, queryHtmlElements } from '../../shared/dom-lookup';
import type { BookmarkDragSession } from '../bookmarks/bookmark-drag';
import type { BookmarkDragController } from '../bookmarks/bookmark-drag-controller';
import type { BookmarkMoveHistory } from '../bookmarks/bookmark-move-history';
import type { BookmarksRuntime } from '../bookmarks/bookmarks-runtime';
import { hasBookmarkFolder } from '../cross-surface-drag';
import type { DragDropTarget, LayoutRect, ShortcutStackTarget, SurfaceDragState } from '../cross-surface-drag';
import * as LumnoNewtabDismissStack from '../dismiss-stack';
import * as LumnoNewtabDragClickGuard from '../drag-click-guard';
import type { FormatMessage, ShowToast, Translate } from '../newtab-types';
import type { BookmarksTopbarRuntime } from '../react/bookmarks-topbar';
import type { ShortcutContextMenu } from './shortcut-context-menu';
import type { ShortcutIconMap } from './shortcut-icon-store';
import type { ShortcutPageActions } from './shortcut-page-actions';
import type { PersistShortcuts, ShortcutInsertionSlot } from './shortcut-types';
import type { ShortcutsController } from './shortcuts-controller';
import { getShortcutUrl, isShortcutFolder } from '../../domain/shortcuts/normalize';
import type { ShortcutItem } from '../../domain/shortcuts/types';
import * as NEWTAB_CROSS_SURFACE_DRAG from '../cross-surface-drag';
import * as NEWTAB_BOOKMARK_MOVE_HISTORY from '../bookmarks/bookmark-move-history';
import * as FOLDER_REFERENCES from '../../domain/bookmark-folder-reference';

interface ShortcutDragState {
  shortcutGrid: HTMLElement | null;
  shortcutDragState: ShortcutDragSession | null;
  bookmarkDragState: BookmarkDragSession | null;
  newtabShortcuts: ShortcutItem[];
  // Custom icon images by shortcut id.
  newtabShortcutIcons: ShortcutIconMap;
  addShortcutButton: HTMLElement | null;
  // While an undoable change runs, no other may start.
  bookmarkMoveHistoryBusy: boolean;
  bookmarkTopbarRuntime: BookmarksTopbarRuntime | null;
  bookmarkGrid: HTMLElement | null;
}

interface ShortcutDragDeps {
  getShortcutReorderTiles: ShortcutPageActions['getShortcutReorderTiles'];
  refreshShortcutTileCacheFromDom: ShortcutPageActions['refreshShortcutTileCacheFromDom'];
  getShortcutTileId: ShortcutPageActions['getShortcutTileId'];
  getShortcutTileById: ShortcutPageActions['getShortcutTileById'];
  renderShortcuts(): void;
  flushDeferredShortcutRender(): void;
  resetShortcutDockHover(): void;
  persistShortcuts: PersistShortcuts;
  bookmarkMoveHistory: Pick<BookmarkMoveHistory, 'push'>;
  hideCursorTooltip(): void;
  closeBookmarkCascadeMenu(options?: { animate?: boolean }): void;
  hideShortcutTooltip(): void;
  isEmptyBookmarkRootHidden: BookmarkDragController['isEmptyBookmarkRootHidden'];
  renderCurrentBookmarkPage(): void;
  isBookmarkTopbarMode(): boolean;
  isBookmarkCascadeSurfaceAtPoint: BookmarkDragController['isBookmarkCascadeSurfaceAtPoint'];
  getExternalBookmarkSurfacePoint: BookmarkDragController['getExternalBookmarkSurfacePoint'];
  isPointOverShortcutDropSurface: BookmarkDragController['isPointOverShortcutDropSurface'];
  clearBookmarkDragPageSwitch: BookmarkDragController['clearBookmarkDragPageSwitch'];
  clearBookmarkDragFolderSwitch: BookmarkDragController['clearBookmarkDragFolderSwitch'];
  clearDragDropTarget: BookmarkDragController['clearDragDropTarget'];
  scheduleWallpaperAdaptiveToneUpdate(): void;
  getBookmarkDragPageSwitchDirection: BookmarkDragController['getBookmarkDragPageSwitchDirection'];
  scheduleBookmarkDragPageSwitch: BookmarkDragController['scheduleBookmarkDragPageSwitch'];
  getShortcutFolderDropTargetAt: BookmarkDragController['getShortcutFolderDropTargetAt'];
  getExternalBookmarkDropTarget: BookmarkDragController['getExternalBookmarkDropTarget'];
  setDragDropTarget: BookmarkDragController['setDragDropTarget'];
  scheduleBookmarkDragFolderSwitch: BookmarkDragController['scheduleBookmarkDragFolderSwitch'];
  getShortcutById(shortcutId: unknown): ShortcutItem | null;
  isValidExternalBookmarkDropTarget: BookmarkDragController['isValidExternalBookmarkDropTarget'];
  bookmarksRuntime: Pick<BookmarksRuntime, 'getNode' | 'getFolderItems'>;
  getShortcutFolderId: ShortcutsController['getShortcutFolderId'];
  queueBookmarkLayoutAnimation: BookmarkDragController['queueBookmarkLayoutAnimation'];
  applyBookmarkShortcutTransfer: BookmarkDragController['applyBookmarkShortcutTransfer'];
  applyShortcutStack: BookmarkDragController['applyShortcutStack'];
  getFolderItemIconForShortcut: ShortcutsController['getFolderItemIconForShortcut'];
  showToast: ShowToast;
  hideToast(): void;
  t: Translate;
  formatMessage: FormatMessage;
  getBookmarkUndoShortcutLabel: BookmarkDragController['getBookmarkUndoShortcutLabel'];
  refreshShortcutFolderReferences(): Promise<unknown>;
  isShortcutContextMenuNode: ShortcutContextMenu['isShortcutContextMenuNode'];
  getShortcutTileFromNode: ShortcutPageActions['getShortcutTileFromNode'];
  closeShortcutContextMenu(): void;
  moveShortcutGroupToIndex(groupId: string, targetIndex: number): Promise<boolean>;
  fitShortcutGroupColumns(): boolean;
  pageState: ShortcutDragState;
}

// A shortcut tile being pressed or dragged.
interface ShortcutDragSession extends SurfaceDragState {
  pointerId: number;
  tile: HTMLElement;
  shortcutId: string;
  // The shortcuts as they were when the press began.
  originalShortcuts: ShortcutItem[];
  bookmarkId: string;
  startX: number;
  startY: number;
  // Where the pointer holds the tile, from its corner.
  grabOffsetX: number;
  grabOffsetY: number;
  translateX: number;
  translateY: number;
  moveFrameId: number;
  hasReordered: boolean;
  // The folder hint toast shows while over a stack target.
  stackHintVisible?: boolean;
  // A tile the grid slid under the still pointer; no stack target until
  // the pointer leaves it.
  stackHeldTile?: HTMLElement | null;
}

// The order a reorder started from, and the tile it moved by hand.
interface ShortcutReorderOrigin {
  originalShortcuts: readonly ShortcutItem[];
  tile?: HTMLElement | null;
}

// A group title being pressed or dragged.
interface ShortcutGroupDragSession {
  pointerId: number;
  header: HTMLElement;
  groupId: string;
  startX: number;
  startY: number;
  grabOffsetX: number;
  grabOffsetY: number;
  isDragging: boolean;
  // The group's place among the other groups where it would land.
  targetIndex: number;
  ghost: HTMLElement | null;
  line: HTMLElement | null;
  frameId: number;
  pendingX: number;
  pendingY: number;
}

// A tile lifted out of a scrolling section, and the placeholder holding
// its slot.
interface ShortcutDragLift {
  placeholder: HTMLElement | null;
}

// Where a tile goes: beside an anchor, or at an index among the tiles.
type TileMoveSlot = Pick<ShortcutInsertionSlot, 'anchorTile' | 'markerPosition'>;

function createShortcutDrag(deps: ShortcutDragDeps) {
  const {
    getShortcutReorderTiles,
    refreshShortcutTileCacheFromDom,
    getShortcutTileId,
    getShortcutTileById,
    renderShortcuts,
    flushDeferredShortcutRender,
    resetShortcutDockHover,
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
    showToast,
    hideToast,
    t,
    formatMessage,
    getBookmarkUndoShortcutLabel,
    refreshShortcutFolderReferences,
    isShortcutContextMenuNode,
    getShortcutTileFromNode,
    closeShortcutContextMenu,
    moveShortcutGroupToIndex,
    fitShortcutGroupColumns
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  // Tiles lifted out of a scrolling section, and the timers of tiles that
  // slide or land.
  const dragLifts = new WeakMap<HTMLElement, ShortcutDragLift>();
  const layoutAnimationTimers = new WeakMap<HTMLElement, number>();
  const dropTimers = new WeakMap<HTMLElement, number>();

  // One click guard for every drag on the page (drag-click-guard.ts).
  function getDragClickGuard() {
    return LumnoNewtabDragClickGuard.getDragClickGuard();
  }

  const SHORTCUT_DRAG_START_THRESHOLD_PX = 10;
  const SHORTCUT_REORDER_ANIMATION_MS = 180;
  const SHORTCUT_DROP_ANIMATION_MS = 210;
  const SHORTCUT_REORDER_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const SHORTCUT_AREA_AUTO_SCROLL_EDGE_PX = 44;
  const SHORTCUT_AREA_AUTO_SCROLL_MAX_STEP_PX = 16;
  const SHORTCUT_AREA_AUTO_SCROLL_DELAY_MS = 220;
  const SHORTCUT_SLOT_SELECTOR = '.x-nt-shortcut-tile[data-shortcut-id], .x-nt-shortcut-group-empty';

  // The shortcut section scrolls only when it is taller than the room above
  // the bottom dock.
  function getShortcutScrollArea(): HTMLElement | null {
    const grid = pageState.shortcutGrid;
    const area = grid ? grid.closest('.x-nt-shortcuts-section') : null;
    return isHtmlElement(area) && area.getAttribute('data-shortcuts-scrollable') === 'true' ? area : null;
  }

  // Scrolls a step while a drag holds the pointer near the area's top or
  // bottom edge; the caller asks for another frame while it returns true.
  // A drag coming in from the dock crosses the bottom edge, so scrolling
  // waits until the pointer has stayed by an edge for a moment.
  let shortcutAreaEdgeSince = 0;
  let shortcutAreaEdgeCheckedAt = 0;
  function autoScrollShortcutArea(pointerX: number, pointerY: number): boolean {
    const area = getShortcutScrollArea();
    if (!area || !Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
      return false;
    }
    const rect = area.getBoundingClientRect();
    const edge = Math.min(SHORTCUT_AREA_AUTO_SCROLL_EDGE_PX, rect.height / 3);
    const inside = pointerX >= rect.left && pointerX <= rect.right && pointerY >= rect.top && pointerY <= rect.bottom;
    const depth = !inside ? 0 : pointerY < rect.top + edge
      ? -(rect.top + edge - pointerY)
      : pointerY > rect.bottom - edge ? pointerY - (rect.bottom - edge) : 0;
    const now = window.performance && typeof window.performance.now === 'function'
      ? window.performance.now() : Date.now();
    const resumed = now - shortcutAreaEdgeCheckedAt < 120;
    shortcutAreaEdgeCheckedAt = now;
    if (!depth) {
      shortcutAreaEdgeSince = 0;
      return false;
    }
    if (!shortcutAreaEdgeSince || !resumed) {
      shortcutAreaEdgeSince = now;
    }
    if (now - shortcutAreaEdgeSince < SHORTCUT_AREA_AUTO_SCROLL_DELAY_MS) {
      return true;
    }
    const step = Math.sign(depth) * Math.max(1, Math.round(SHORTCUT_AREA_AUTO_SCROLL_MAX_STEP_PX * Math.min(1, Math.abs(depth) / edge)));
    const before = area.scrollTop;
    area.scrollTop = before + step;
    return area.scrollTop !== before;
  }

  // A scrolling section would clip the dragged tile, so the tile leaves it
  // as a fixed element while a placeholder keeps its slot.
  function liftShortcutDragTile(tile: HTMLElement): void {
    if (dragLifts.has(tile) || !tile.parentNode || !getShortcutScrollArea()) {
      return;
    }
    const rect = tile.getBoundingClientRect();
    const placeholder = document.createElement('span');
    placeholder.className = 'x-nt-shortcut-drag-placeholder';
    placeholder.setAttribute('aria-hidden', 'true');
    tile.parentNode.insertBefore(placeholder, tile);
    dragLifts.set(tile, { placeholder });
    tile.setAttribute('data-shortcut-lifted', 'true');
    tile.style.setProperty('left', `${rect.left}px`);
    tile.style.setProperty('top', `${rect.top}px`);
  }

  // The placeholder holding a lifted tile's slot.
  function getDragPlaceholder(tile: HTMLElement | null | undefined): HTMLElement | null {
    const lift = tile ? dragLifts.get(tile) : undefined;
    return lift ? lift.placeholder : null;
  }

  function removeShortcutDragPlaceholder(tile: HTMLElement | null | undefined): void {
    const lift = tile ? dragLifts.get(tile) : undefined;
    if (lift && lift.placeholder && lift.placeholder.parentNode) {
      lift.placeholder.parentNode.removeChild(lift.placeholder);
    }
    if (lift) {
      lift.placeholder = null;
    }
  }

  function unliftShortcutDragTile(tile: HTMLElement | null | undefined): void {
    if (!tile || !dragLifts.has(tile)) {
      return;
    }
    removeShortcutDragPlaceholder(tile);
    dragLifts.delete(tile);
    tile.removeAttribute('data-shortcut-lifted');
    tile.style.removeProperty('left');
    tile.style.removeProperty('top');
  }

  // Everything in the grid that can shift when shortcuts move: tiles, the
  // add tile, group titles and empty groups' slots.
  function getShortcutLayoutElements(): HTMLElement[] {
    return pageState.shortcutGrid
      ? queryHtmlElements(pageState.shortcutGrid,
        '.x-nt-shortcut-tile, .x-nt-shortcut-group-header, .x-nt-shortcut-group-empty')
      : getShortcutReorderTiles();
  }

  function getShortcutTileRectMap(): Map<HTMLElement, DOMRect> {
    const rects = new Map<HTMLElement, DOMRect>();
    getShortcutLayoutElements().forEach((tile) => {
      rects.set(tile, tile.getBoundingClientRect());
    });
    return rects;
  }

  function getShortcutTileLayoutRect(tile: HTMLElement | null): LayoutRect | null {
    if (!tile || !pageState.shortcutGrid || typeof tile.offsetLeft !== 'number' ||
        typeof tile.offsetTop !== 'number') {
      return null;
    }
    const offsetParent = tile.offsetParent || pageState.shortcutGrid;
    const parentRect = offsetParent.getBoundingClientRect();
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

  function clearShortcutTileLayoutAnimation(tile: HTMLElement): void {
    const timer = layoutAnimationTimers.get(tile);
    if (timer) {
      window.clearTimeout(timer);
      layoutAnimationTimers.delete(tile);
    }
    tile.style.removeProperty('transition');
    if (tile.getAttribute('data-shortcut-dragging') !== 'true' &&
        tile.getAttribute('data-shortcut-dropping') !== 'true') {
      tile.style.removeProperty('transform');
    }
  }

  // Something that was hidden or not there has no place to slide from
  // (a hidden box measures at the page corner), so it fades in where it is.
  function enterShortcutLayoutElement(element: HTMLElement): void {
    if (typeof element.animate !== 'function' || NEWTAB_CROSS_SURFACE_DRAG.prefersReducedMotion(window)) {
      return;
    }
    element.animate([
      { opacity: 0, scale: '0.86' },
      { opacity: 1, scale: '1' }
    ], {
      duration: SHORTCUT_REORDER_ANIMATION_MS,
      easing: SHORTCUT_REORDER_EASING
    });
  }

  function animateShortcutLayoutShift(beforeRects: ReadonlyMap<HTMLElement, DOMRect>, draggedTile: HTMLElement | null): void {
    if (!pageState.shortcutGrid || NEWTAB_CROSS_SURFACE_DRAG.prefersReducedMotion(window)) {
      return;
    }
    const beforeById = new Map<string, DOMRect>();
    beforeRects.forEach((rect, element) => {
      const id = getShortcutLayoutId(element);
      if (id) beforeById.set(id, rect);
    });
    getShortcutLayoutElements().forEach((tile) => {
      if (tile === draggedTile) {
        return;
      }
      const before = beforeRects.get(tile) || beforeById.get(getShortcutLayoutId(tile));
      if (!before || !before.width || !before.height) {
        const shown = tile.getBoundingClientRect();
        if (shown.width && shown.height) {
          enterShortcutLayoutElement(tile);
        }
        return;
      }
      clearShortcutTileLayoutAnimation(tile);
      const after = tile.getBoundingClientRect();
      if (!after.width || !after.height) {
        return;
      }
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
        layoutAnimationTimers.set(tile, window.setTimeout(() => {
          layoutAnimationTimers.delete(tile);
          clearShortcutTileLayoutAnimation(tile);
        }, SHORTCUT_REORDER_ANIMATION_MS + 80));
      });
    });
  }

  // A tile the change took away (moved into a folder or the bookmarks, or
  // undone) shrinks out where it was instead of vanishing. It plays in a
  // layer beside the grid, which carries the grid's classes and state so the
  // tile keeps its look, while the grid's own render never meets it.
  const SHORTCUT_GHOST_ATTRIBUTES = ['data-shortcut-lifted', 'data-shortcut-dragging', 'data-shortcut-dropping',
    'data-drag-gap', 'data-bookmark-drop-target', 'data-shortcut-context-menu-open'];
  // A shortcut's tile can be drawn anew by a render (a folder whose contents
  // changed), so the before and after boxes are also paired by shortcut id.
  function getShortcutLayoutId(element: HTMLElement): string {
    return String(element.getAttribute('data-shortcut-id') || '');
  }

  function exitShortcutLayoutElements(beforeRects: ReadonlyMap<HTMLElement, DOMRect>): void {
    const grid = pageState.shortcutGrid;
    const host = grid && grid.parentNode;
    if (!grid || !host || NEWTAB_CROSS_SURFACE_DRAG.prefersReducedMotion(window)) {
      return;
    }
    const shownIds = new Set(getShortcutLayoutElements().map(getShortcutLayoutId).filter(Boolean));
    const removed: Array<[HTMLElement, DOMRect]> = [];
    beforeRects.forEach((rect, element) => {
      if (!element.isConnected && rect.width && rect.height &&
          !shownIds.has(getShortcutLayoutId(element)) &&
          element.classList.contains('x-nt-shortcut-tile') &&
          typeof element.animate === 'function') {
        removed.push([element, rect]);
      }
    });
    if (!removed.length) {
      return;
    }
    const layer = document.createElement('div');
    Array.from(grid.attributes).forEach((attribute) => {
      if (attribute.name === 'class' || attribute.name.startsWith('data-')) {
        layer.setAttribute(attribute.name, attribute.value);
      }
    });
    layer.setAttribute('aria-hidden', 'true');
    layer.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;min-height:0;max-width:none;' +
      'margin:0;padding:0;display:block;overflow:visible;pointer-events:none;';
    host.appendChild(layer);
    const origin = layer.getBoundingClientRect();
    removed.forEach(([tile, rect]) => {
      clearShortcutTileLayoutAnimation(tile);
      SHORTCUT_GHOST_ATTRIBUTES.forEach((name) => tile.removeAttribute(name));
      tile.removeAttribute('id');
      // No longer a tile to anything that looks for tiles; it keeps the
      // tile's box by hand.
      tile.classList.replace('x-nt-shortcut-tile', 'x-nt-shortcut-tile-ghost');
      Object.assign(tile.style, {
        display: 'grid',
        placeItems: 'center',
        boxSizing: 'border-box',
        padding: 'var(--x-nt-shortcut-tile-padding, 8px)',
        position: 'absolute',
        left: `${rect.left - origin.left}px`,
        top: `${rect.top - origin.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        margin: '0',
        transform: 'none',
        transition: 'none'
      });
      layer.appendChild(tile);
      tile.animate([
        { opacity: 1, scale: '1' },
        { opacity: 0, scale: '0.6' }
      ], {
        duration: SHORTCUT_REORDER_ANIMATION_MS,
        easing: SHORTCUT_REORDER_EASING,
        fill: 'forwards'
      });
    });
    window.setTimeout(() => {
      if (layer.parentNode) layer.parentNode.removeChild(layer);
    }, SHORTCUT_REORDER_ANIMATION_MS + 60);
  }

  // Runs a change that re-renders the shortcuts and slides whatever it moved
  // from where it was, so a re-centered grid glides instead of jumping; what
  // it added fades in and what it removed shrinks out.
  function animateShortcutLayoutChange<T>(change: () => T): T {
    const beforeRects = getShortcutTileRectMap();
    const result = change();
    exitShortcutLayoutElements(beforeRects);
    animateShortcutLayoutShift(beforeRects, null);
    return result;
  }

  // Puts the dragged tile under the pointer. `state` is whichever drag is
  // running; only a shortcut drag has a tile to move.
  function setShortcutDragTileTransform(state: SurfaceDragState | null, pointerX: number, pointerY: number): void {
    const session = pageState.shortcutDragState;
    if (!session || state !== session) {
      return;
    }
    applyShortcutDragTileTransform(session, pointerX, pointerY);
  }

  function applyShortcutDragTileTransform(state: ShortcutDragSession, pointerX: number, pointerY: number): void {
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

  // How long a dropped tile takes to land and lose its drag styles.
  function getShortcutDropSettleMs(): number {
    return NEWTAB_CROSS_SURFACE_DRAG.prefersReducedMotion(window) ? 0 : SHORTCUT_DROP_ANIMATION_MS + 90;
  }

  function settleShortcutDragTile(tile: HTMLElement): void {
    tile.setAttribute('data-shortcut-dropping', 'true');
    tile.style.pointerEvents = '';
    const reducedMotion = NEWTAB_CROSS_SURFACE_DRAG.prefersReducedMotion(window);
    tile.style.transition = reducedMotion
      ? 'none'
      : `transform ${SHORTCUT_DROP_ANIMATION_MS}ms ${SHORTCUT_REORDER_EASING}`;
    // A lifted tile lands on its placeholder, wherever the area scrolled.
    const placeholder = getDragPlaceholder(tile);
    const slotRect = placeholder && placeholder.isConnected
      ? placeholder.getBoundingClientRect()
      : null;
    tile.style.transform = slotRect
      ? `translate3d(${slotRect.left - (Number.parseFloat(tile.style.left) || 0)}px, ${slotRect.top - (Number.parseFloat(tile.style.top) || 0)}px, 0)`
      : 'translate3d(0, 0, 0)';
    const pendingDrop = dropTimers.get(tile);
    if (pendingDrop) {
      window.clearTimeout(pendingDrop);
    }
    dropTimers.set(tile, window.setTimeout(() => {
      dropTimers.delete(tile);
      tile.removeAttribute('data-shortcut-dragging');
      tile.removeAttribute('data-shortcut-dropping');
      unliftShortcutDragTile(tile);
      tile.style.removeProperty('transition');
      tile.style.removeProperty('transform');
      tile.style.removeProperty('will-change');
      tile.style.pointerEvents = '';
    }, getShortcutDropSettleMs()));
  }

  function getShortcutTileInsertionIndex(tile: HTMLElement): number {
    return getShortcutReorderTiles().indexOf(tile);
  }

  // Empty groups show a slot that takes drops like a tile. `index` counts
  // only the tiles before the insertion point; `groupId` is the group of the
  // tile or slot the pointer is beside.
  function getShortcutInsertionSlotAt(pointerX: number, pointerY: number, excludedTile: HTMLElement | null): ShortcutInsertionSlot {
    // The dragged tile filling an empty group hides that group's slot.
    // The slot keeps the tile's place, or the group's row would drop out
    // of reach and the next move would send the tile back, every move.
    const placeholder = getDragPlaceholder(excludedTile);
    const excludedSpot = placeholder && placeholder.isConnected ? placeholder : excludedTile;
    const getSlotRect = (tile: HTMLElement): LayoutRect | null => (excludedTile && tile.previousElementSibling === excludedTile &&
      tile.classList.contains('x-nt-shortcut-group-empty') && !tile.hidden
      ? getShortcutTileLayoutRect(excludedSpot)
      : getShortcutTileLayoutRect(tile));
    const layoutItems: Array<{ tile: HTMLElement; rect: LayoutRect }> = [];
    (pageState.shortcutGrid
      ? queryHtmlElements(pageState.shortcutGrid, SHORTCUT_SLOT_SELECTOR)
      : getShortcutReorderTiles()).forEach((tile) => {
      const rect = tile !== excludedTile ? getSlotRect(tile) : null;
      if (rect && rect.width > 0 && rect.height > 0) {
        layoutItems.push({ tile, rect });
      }
    });
    const slot = NEWTAB_CROSS_SURFACE_DRAG.getRowInsertionSlot(layoutItems, pointerX, pointerY);
    const anchor = slot.anchorIndex >= 0 ? layoutItems[slot.anchorIndex] : null;
    const insertionPoint = !anchor ? 0 : slot.markerPosition === 'after' ? slot.anchorIndex + 1 : slot.anchorIndex;
    return {
      index: layoutItems.slice(0, insertionPoint)
        .filter((item) => item.tile.hasAttribute('data-shortcut-id')).length,
      markerPosition: slot.markerPosition,
      anchorRect: anchor ? anchor.rect : null,
      anchorTile: anchor ? anchor.tile : null,
      groupId: anchor ? getShortcutTileGroupId(anchor.tile) : ''
    };
  }

  function getShortcutDragInsertionSlot(pointerX: number, pointerY: number): ShortcutInsertionSlot | null {
    if (!pageState.shortcutGrid || !pageState.shortcutDragState || !Number.isFinite(pointerX) ||
        !Number.isFinite(pointerY)) {
      return null;
    }
    return getShortcutInsertionSlotAt(pointerX, pointerY, pageState.shortcutDragState.tile);
  }

  function getShortcutGroupHeader(groupId: string | undefined): HTMLElement | null {
    return pageState.shortcutGrid && groupId
      ? queryHtmlElement(pageState.shortcutGrid, `.x-nt-shortcut-group-header[data-shortcut-group-id="${groupId}"]`)
      : null;
  }

  function getShortcutTileGroupId(tile: HTMLElement): string {
    return String(tile.getAttribute('data-shortcut-group-id') || '');
  }

  // Group titles sit between the tiles of different groups, so a tile goes
  // next to the tile the pointer is beside rather than before the next tile
  // in the list, which could already belong to the next group.
  function moveShortcutTileElement(tile: HTMLElement, targetIndex: number, slot: TileMoveSlot | null): boolean {
    const grid = pageState.shortcutGrid;
    if (!grid || tile.parentNode !== grid || !Number.isFinite(targetIndex)) {
      return false;
    }
    // A lifted tile keeps its placeholder right before it.
    const placeholder = getDragPlaceholder(tile);
    const lead = placeholder && placeholder.parentNode === grid ? placeholder : tile;
    const place = (reference: Node | null): boolean => {
      grid.insertBefore(tile, reference);
      if (lead !== tile) grid.insertBefore(lead, tile);
      refreshShortcutTileCacheFromDom();
      return true;
    };
    const anchor = slot && slot.anchorTile && slot.anchorTile !== tile && slot.anchorTile !== lead &&
      slot.anchorTile.parentNode === grid ? slot.anchorTile : null;
    if (slot && anchor) {
      // An empty group's slot stays after the tile that fills it.
      const after = slot.markerPosition === 'after' && !anchor.classList.contains('x-nt-shortcut-group-empty');
      const reference = after ? anchor.nextSibling : anchor;
      if (reference === tile || reference === lead || (after ? lead.previousSibling === anchor
        : tile.nextSibling === anchor)) {
        return false;
      }
      return place(reference);
    }
    const currentIndex = getShortcutTileInsertionIndex(tile);
    const remainingTiles = getShortcutReorderTiles().filter((item) => item !== tile);
    const boundedIndex = Math.max(0, Math.min(remainingTiles.length, targetIndex));
    if (currentIndex === boundedIndex) {
      return false;
    }
    return place(remainingTiles[boundedIndex] || pageState.addShortcutButton || null);
  }

  // Moves the shortcut to `targetIndex` among the other visible tiles and
  // into `targetGroupId` when given. Either change counts as a move.
  function moveShortcutItem(shortcutId: string, targetIndex: number, targetGroupId: string): boolean {
    if (!shortcutId || !Number.isFinite(targetIndex)) {
      return false;
    }
    const currentIndex = pageState.newtabShortcuts.findIndex((item) => item.id === shortcutId);
    if (currentIndex < 0) {
      return false;
    }
    const groupId = String(targetGroupId || '');
    const regroup = Boolean(groupId) && pageState.newtabShortcuts[currentIndex].groupId !== groupId;
    const tiles = getShortcutReorderTiles();
    const visibleIds = tiles.filter((tile) => getShortcutTileId(tile) !== shortcutId).map(getShortcutTileId);
    const visibleTargetIndex = Math.max(0, Math.min(visibleIds.length, Math.floor(targetIndex)));
    if (!regroup && tiles.findIndex((tile) => getShortcutTileId(tile) === shortcutId) === visibleTargetIndex) {
      return false;
    }
    const nextShortcuts = pageState.newtabShortcuts.slice();
    const removed = nextShortcuts.splice(currentIndex, 1)[0];
    const shortcutItem = regroup ? { ...removed, groupId } : removed;
    const anchorId = visibleIds[visibleTargetIndex];
    const anchorIndex = anchorId ? nextShortcuts.findIndex((item) => item.id === anchorId) : nextShortcuts.length;
    const boundedIndex = Math.max(0, anchorIndex);
    if (!regroup && currentIndex === boundedIndex) {
      return false;
    }
    nextShortcuts.splice(boundedIndex, 0, shortcutItem);
    pageState.newtabShortcuts = nextShortcuts;
    return true;
  }

  function restoreShortcutDragOrder(state: ShortcutReorderOrigin): void {
    if (state.tile && dragLifts.has(state.tile)) {
      // Back in the flow, the tile no longer aims at its fixed position.
      unliftShortcutDragTile(state.tile);
      state.tile.style.transition = 'none';
      state.tile.style.transform = '';
    }
    const originalOrder = state.originalShortcuts.map((item) => item.id);
    const restored = NEWTAB_CROSS_SURFACE_DRAG.planShortcutReorder({
      shortcuts: pageState.newtabShortcuts, order: originalOrder,
      groups: state.originalShortcuts.map((item) => item.groupId)
    });
    if (restored) pageState.newtabShortcuts = restored;
    // React has not committed the manually moved DOM order during the drag.
    // Each tile goes after the tile before it in its group, or after its
    // group's title when it is the first one.
    let visibleIndex = 0;
    let previousTile: HTMLElement | null = null;
    let previousGroupId: string | undefined | null = null;
    pageState.newtabShortcuts.forEach((shortcut) => {
      const tile = getShortcutTileById(shortcut.id);
      if (!tile) return;
      const anchor = previousTile && previousGroupId === shortcut.groupId
        ? previousTile
        : getShortcutGroupHeader(shortcut.groupId);
      moveShortcutTileElement(tile, visibleIndex++, anchor ? { anchorTile: anchor, markerPosition: 'after' } : null);
      previousTile = tile;
      previousGroupId = shortcut.groupId;
    });
    renderShortcuts();
    resetShortcutDockHover();
  }

  function persistShortcutOrder(state?: ShortcutReorderOrigin): Promise<ShortcutItem[]> {
    const record = state && NEWTAB_BOOKMARK_MOVE_HISTORY.createShortcutReorderRecord({
      fromOrder: state.originalShortcuts.map((item) => item.id),
      toOrder: pageState.newtabShortcuts.map((item) => item.id),
      fromGroups: state.originalShortcuts.map((item) => item.groupId),
      toGroups: pageState.newtabShortcuts.map((item) => item.groupId)
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

  // Alt+Arrow on a focused tile moves it one place, like a short drag:
  // past a group's edge it joins the neighboring group. It saves and
  // records undo the way a drop does, and keeps focus on the tile.
  function moveShortcutByKeyboard(shortcutId: string, direction: number): boolean {
    if (!shortcutId || (direction !== 1 && direction !== -1) || pageState.shortcutDragState ||
        pageState.bookmarkMoveHistoryBusy) {
      return false;
    }
    const tiles = getShortcutReorderTiles();
    const currentIndex = tiles.findIndex((tile) => getShortcutTileId(tile) === shortcutId);
    const neighbor = currentIndex >= 0 ? tiles[currentIndex + direction] : null;
    if (!neighbor) {
      return false;
    }
    const ownGroupId = getShortcutTileGroupId(tiles[currentIndex]);
    const neighborGroupId = getShortcutTileGroupId(neighbor);
    const crossesGroup = neighborGroupId !== ownGroupId;
    const state: ShortcutReorderOrigin = { originalShortcuts: pageState.newtabShortcuts.slice() };
    // Crossing into the next group keeps the index and changes the group.
    const targetIndex = crossesGroup ? currentIndex : currentIndex + direction;
    if (!moveShortcutItem(shortcutId, targetIndex, crossesGroup ? neighborGroupId : '')) {
      return false;
    }
    void persistShortcutOrder(state).then(() => {
      animateShortcutLayoutChange(renderShortcuts);
      scheduleWallpaperAdaptiveToneUpdate();
      const tile = getShortcutTileById(shortcutId);
      if (tile && document.activeElement !== tile) {
        tile.focus({ preventScroll: true });
      }
    });
    return true;
  }

  function startShortcutDrag(event: PointerEvent, state: ShortcutDragSession): void {
    const tile = state.tile;
    if (!pageState.shortcutGrid || pageState.shortcutDragState !== state) {
      return;
    }
    state.isDragging = true;
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
    liftShortcutDragTile(tile);
    applyShortcutDragTileTransform(state, Number(event.clientX), Number(event.clientY));
    if (typeof tile.setPointerCapture === 'function') {
      try {
        tile.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture can fail if the browser already canceled the pointer.
      }
    }
  }

  function cancelShortcutDragMoveFrame(state: ShortcutDragSession): void {
    if (!state || !state.moveFrameId) {
      return;
    }
    window.cancelAnimationFrame(state.moveFrameId);
    state.moveFrameId = 0;
  }

  function applyShortcutDragMove(state: ShortcutDragSession, pointerX: number, pointerY: number): void {
    if (state !== pageState.shortcutDragState || !state.isDragging ||
        !Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
      return;
    }
    applyShortcutDragTileTransform(state, pointerX, pointerY);
    document.body.removeAttribute('data-drag-blocked');
    const topbarPoint = isBookmarkTopbarMode() &&
      !isBookmarkCascadeSurfaceAtPoint(pointerX, pointerY)
      ? getExternalBookmarkSurfacePoint(pointerX, pointerY) : null;
    const topbar = pageState.bookmarkTopbarRuntime;
    if (topbarPoint && topbar && topbar.autoScroll(topbarPoint.x, topbarPoint.y)) {
      scheduleShortcutDragMove(state, pointerX, pointerY);
    }
    // Near the shortcut area's edges the area scrolls whatever is under the
    // pointer, so a tile there does not hold the drag as a stack target.
    if (isPointOverShortcutDropSurface(pointerX, pointerY) && autoScrollShortcutArea(pointerX, pointerY)) {
      scheduleShortcutDragMove(state, pointerX, pointerY);
    }
    if (updateShortcutDragBookmarkTarget(state, pointerX, pointerY)) {
      return;
    }
    if (!isPointOverShortcutDropSurface(pointerX, pointerY)) {
      return;
    }
    const slot = getShortcutDragInsertionSlot(pointerX, pointerY);
    const targetIndex = slot ? slot.index : -1;
    const targetGroupId = slot ? slot.groupId : '';
    const source = getShortcutById(state.shortcutId);
    const regroup = Boolean(targetGroupId && source && source.groupId !== targetGroupId);
    if (targetIndex < 0 || (!regroup && targetIndex === getShortcutTileInsertionIndex(state.tile))) {
      return;
    }
    const beforeRects = getShortcutTileRectMap();
    if (moveShortcutItem(state.shortcutId, targetIndex, targetGroupId)) {
      state.hasReordered = true;
      if (moveShortcutTileElement(state.tile, targetIndex, slot)) {
        // Before measuring, so a grid that hugs a longer or shorter row
        // slides to its new width with the tiles.
        if (fitShortcutGroupColumns()) {
          holdShortcutStackTargetUnderPointer(state, pointerX, pointerY);
        }
        animateShortcutLayoutShift(beforeRects, state.tile);
        applyShortcutDragTileTransform(state, pointerX, pointerY);
      }
    }
  }

  function flushShortcutDragMove(state: ShortcutDragSession): void {
    cancelShortcutDragMoveFrame(state);
    applyShortcutDragMove(
      state,
      Number(state.pendingPointerX),
      Number(state.pendingPointerY)
    );
    cancelShortcutDragMoveFrame(state);
  }

  function scheduleShortcutDragMove(state: ShortcutDragSession | null, pointerX: number, pointerY: number): void {
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

  // Renders asked for during the drag were held back (see renderShortcuts);
  // they run once whatever the drop does has finished and the dropped tile
  // has landed, so a render never cuts into its settle animation.
  // `event` is the pointer event that ended the drag.
  function finishShortcutDrag(event?: PointerEvent | null, options?: { cancel?: boolean }): void {
    if (!pageState.shortcutDragState) {
      return;
    }
    if (event && pageState.shortcutDragState.pointerId !== event.pointerId) {
      return;
    }
    const settleMs = pageState.shortcutDragState.isDragging ? getShortcutDropSettleMs() : 0;
    const outcome = endShortcutDrag(event, options);
    const flushAfterSettle = () => {
      window.setTimeout(flushDeferredShortcutRender, settleMs);
    };
    Promise.resolve(outcome).then(flushAfterSettle, flushAfterSettle);
  }

  function endShortcutDrag(event: PointerEvent | null | undefined, options?: { cancel?: boolean }): Promise<unknown> | undefined {
    const state = pageState.shortcutDragState;
    if (!state) {
      return undefined;
    }
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
    // Only a drag can leave a drag-mode folder menu open. A plain click must
    // keep an open folder menu, so the click itself can toggle it closed.
    if (state.isDragging) {
      closeBookmarkCascadeMenu({ animate: true });
    }
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
        } catch {
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
        getDragClickGuard().armAfterDrag(event || null, state.pointerId);
      }
    }
    if (bookmarkDropTarget) {
      // React removes or re-renders the tile; only its placeholder is ours.
      removeShortcutDragPlaceholder(tile);
      if (event) {
        event.preventDefault();
      }
      return bookmarkDropTarget.kind === 'shortcut-stack'
        ? stackShortcuts(state, bookmarkDropTarget)
        : moveShortcutToBookmarks(state, bookmarkDropTarget);
    }
    // The empty bookmarks bar shown for the drag hides again however the
    // drag ends.
    if (state.isDragging &&
        pageState.bookmarkGrid &&
        pageState.bookmarkGrid.getAttribute('data-bookmark-empty-drop-surface') === 'true') {
      renderCurrentBookmarkPage();
    }
    if (options && options.cancel && state.hasReordered) {
      restoreShortcutDragOrder(state);
      return undefined;
    }
    if (state.isDragging && state.hasReordered) {
      if (event) {
        event.preventDefault();
      }
      return persistShortcutOrder(state).then(() => {
        animateShortcutLayoutChange(renderShortcuts);
        scheduleWallpaperAdaptiveToneUpdate();
      });
    }
    if (options && options.cancel) {
      resetShortcutDockHover();
    }
    return undefined;
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

  function isShortcutDragActive(): boolean {
    return Boolean(pageState.shortcutDragState && pageState.shortcutDragState.isDragging);
  }

  function isBookmarkSurfaceDragStateActive(state: SurfaceDragState | null): boolean {
    return Boolean(state && state.isDragging && (state === pageState.bookmarkDragState || state === pageState.shortcutDragState));
  }

  function updateShortcutDragBookmarkTarget(state: ShortcutDragSession, pointerX: number, pointerY: number): boolean {
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
  function setShortcutStackHint(state: ShortcutDragSession, visible: boolean): void {
    if (Boolean(state.stackHintVisible) === visible) {
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
  function getShortcutStackTargetAt(state: ShortcutDragSession, pointerX: number, pointerY: number): ShortcutStackTarget | null {
    const source = getShortcutById(state.shortcutId);
    if (!source || isShortcutFolder(source) || !isPointOverShortcutDropSurface(pointerX, pointerY)) {
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
    if (state.stackHeldTile) {
      if (tile === state.stackHeldTile) {
        return null;
      }
      state.stackHeldTile = null;
    }
    const target = tile ? getShortcutById(getShortcutTileId(tile)) : null;
    return tile && target && !isShortcutFolder(target) && target.id !== source.id
      ? { kind: 'shortcut-stack', surface: 'shortcuts', element: tile, shortcutId: target.id }
      : null;
  }

  // A grid that re-centers slides every tile half a column under a pointer
  // that held still. A tile that lands under it is no stack target until
  // the pointer leaves it, or releasing where the drag showed a gap would
  // make a folder.
  function holdShortcutStackTargetUnderPointer(state: ShortcutDragSession, pointerX: number, pointerY: number): void {
    state.stackHeldTile = null;
    const target = getShortcutStackTargetAt(state, pointerX, pointerY);
    state.stackHeldTile = target ? target.element : null;
  }

  // Lands the tile back in the shortcuts, saving the order a drag left;
  // resolves false, for a drop that did not happen.
  function restoreDroppedShortcut(state: ShortcutDragSession): boolean {
    settleShortcutDragTile(state.tile);
    if (state.hasReordered) {
      void persistShortcutOrder().then(() => {
        renderShortcuts();
        scheduleWallpaperAdaptiveToneUpdate();
      });
    }
    return false;
  }

  function stackShortcuts(state: ShortcutDragSession, target: ShortcutStackTarget): Promise<boolean> {
    const source = getShortcutById(state.shortcutId);
    const destination = getShortcutById(target.shortcutId);
    const restoreShortcut = () => restoreDroppedShortcut(state);
    if (!source || !destination || isShortcutFolder(source) || isShortcutFolder(destination) ||
        pageState.bookmarkMoveHistoryBusy) {
      hideToast();
      return Promise.resolve(restoreShortcut());
    }
    // Indexes come from before the drag, so undo also reverts its reordering.
    const originalShortcuts = state.originalShortcuts;
    const toSource = (shortcut: ShortcutItem) => ({
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
          .findIndex((item) => item.id === destination.id),
        groupId: destination.groupId
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

  function moveShortcutToBookmarks(state: ShortcutDragSession, target: DragDropTarget): Promise<boolean> {
    const shortcut = getShortcutById(state.shortcutId);
    const restoreShortcut = () => restoreDroppedShortcut(state);
    if (!shortcut || pageState.bookmarkMoveHistoryBusy) {
      return Promise.resolve(restoreShortcut());
    }
    if (!isValidExternalBookmarkDropTarget(state, target) || !hasBookmarkFolder(target)) {
      return Promise.resolve(restoreShortcut());
    }
    const isFolder = isShortcutFolder(shortcut);
    const node = isFolder ? bookmarksRuntime.getNode(getShortcutFolderId(shortcut)) : null;
    if (isFolder && !node) {
      return Promise.resolve(restoreShortcut());
    }
    const from = node ? { parentId: node.parentId, index: node.index } : null;
    const to = node && String(node.parentId) === String(target.folderId) && target.kind !== 'insertion'
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
    const originalShortcuts = state.originalShortcuts;
    const record = NEWTAB_BOOKMARK_MOVE_HISTORY.createTransferRecord({
      bookmarkId: node && node.id,
      snapshot: node ? { title: node.title, url: '' } : { title: shortcut.title, url: getShortcutUrl(shortcut) },
      from,
      to,
      beforeShortcut: {
        snapshot: shortcut,
        index: originalShortcuts.findIndex((item) => item.id === shortcut.id),
        iconDataUrl: pageState.newtabShortcutIcons[shortcut.id]
      },
      // The site keeps its icon choice as a bookmark in a shortcut folder.
      itemIcon: isShortcutFolder(shortcut) ? null : getFolderItemIconForShortcut(shortcut, pageState.newtabShortcutIcons[shortcut.id])
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
      if (pageState.newtabShortcuts.some(isShortcutFolder)) void refreshShortcutFolderReferences();
    });
  }

  // Dragging a group title moves the whole group among the others. Its
  // tiles stay put while a line shows where the group will land.
  const SHORTCUT_GROUP_DRAG_START_THRESHOLD_PX = 6;
  let shortcutGroupDragState: ShortcutGroupDragSession | null = null;

  // Escape cancels a group drag before it closes any open layer.
  LumnoNewtabDismissStack.getDismissStack().register('shortcut-group-drag', {
    priority: 1,
    isOpen: () => Boolean(shortcutGroupDragState && shortcutGroupDragState.isDragging),
    close: () => finishShortcutGroupDrag(false, null)
  });

  function getShortcutGroupHeaders(): HTMLElement[] {
    return pageState.shortcutGrid
      ? queryHtmlElements(pageState.shortcutGrid, '.x-nt-shortcut-group-header')
      : [];
  }

  function handleShortcutGroupDragPointerDown(event: PointerEvent): void {
    const target = isElementNode(event.target) ? event.target : null;
    const header = target ? target.closest('.x-nt-shortcut-group-header') : null;
    if (!target || !isHtmlElement(header) || shortcutGroupDragState ||
        (event.pointerType === 'mouse' && event.button !== 0) ||
        header.hasAttribute('data-shortcut-group-editing') ||
        target.closest('.x-nt-shortcut-group-more, .x-nt-shortcut-group-input') ||
        getShortcutGroupHeaders().length < 2) {
      return;
    }
    const rect = header.getBoundingClientRect();
    shortcutGroupDragState = {
      pointerId: event.pointerId,
      header,
      groupId: String(header.getAttribute('data-shortcut-group-id') || ''),
      startX: Number(event.clientX),
      startY: Number(event.clientY),
      grabOffsetX: Number(event.clientX) - rect.left,
      grabOffsetY: Number(event.clientY) - rect.top,
      isDragging: false,
      targetIndex: -1,
      ghost: null,
      line: null,
      frameId: 0,
      pendingX: Number(event.clientX),
      pendingY: Number(event.clientY)
    };
    document.addEventListener('pointermove', handleShortcutGroupDragPointerMove, true);
    document.addEventListener('pointerup', handleShortcutGroupDragPointerUp, true);
    document.addEventListener('pointercancel', handleShortcutGroupDragPointerCancel, true);
  }

  function startShortcutGroupDrag(state: ShortcutGroupDragSession): void {
    state.isDragging = true;
    closeShortcutContextMenu();
    hideShortcutTooltip();
    resetShortcutDockHover();
    document.body.setAttribute('data-drag-source', 'shortcut-group');
    state.header.setAttribute('data-shortcut-group-dragging', 'true');
    const rect = state.header.getBoundingClientRect();
    const ghost = state.header.cloneNode(true);
    if (!isHtmlElement(ghost)) {
      return;
    }
    ghost.querySelectorAll('button.x-nt-shortcut-group-more').forEach((button) => button.remove());
    ghost.classList.add('x-nt-shortcut-group-ghost');
    ghost.removeAttribute('data-shortcut-group-id');
    ghost.removeAttribute('data-shortcut-group-dragging');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    const line = document.createElement('div');
    line.className = 'x-nt-shortcut-group-drop-line';
    line.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ghost);
    document.body.appendChild(line);
    state.ghost = ghost;
    state.line = line;
  }

  // The group lands before the first other group whose middle is below
  // the pointer; `targetIndex` is its index among the remaining groups.
  function updateShortcutGroupDrag(state: ShortcutGroupDragSession, pointerX: number, pointerY: number): void {
    const { ghost, line } = state;
    const grid = pageState.shortcutGrid;
    if (!ghost || !line || !grid) return;
    const left = Number.parseFloat(ghost.style.left) || 0;
    const top = Number.parseFloat(ghost.style.top) || 0;
    ghost.style.transform = `translate3d(${pointerX - state.grabOffsetX - left}px, ${pointerY - state.grabOffsetY - top}px, 0)`;
    if (autoScrollShortcutArea(pointerX, pointerY)) {
      scheduleShortcutGroupDragMove(state, pointerX, pointerY);
    }
    const headers = getShortcutGroupHeaders();
    const gridRect = grid.getBoundingClientRect();
    const blocks = headers.map((header, index) => {
      const rect = header.getBoundingClientRect();
      const next = headers[index + 1];
      const bottom = next ? next.getBoundingClientRect().top : gridRect.bottom;
      return { header, top: rect.top, bottom, left: rect.left, width: rect.width };
    }).filter((block) => block.header !== state.header);
    let targetIndex = blocks.findIndex((block) => pointerY < (block.top + block.bottom) / 2);
    if (targetIndex < 0) targetIndex = blocks.length;
    state.targetIndex = targetIndex;
    const anchor = blocks[targetIndex] || blocks[blocks.length - 1];
    if (!anchor) return;
    const area = getShortcutScrollArea();
    const areaRect = area ? area.getBoundingClientRect() : null;
    let lineY = blocks[targetIndex] ? anchor.top - 4 : anchor.bottom - 4;
    if (areaRect) lineY = Math.max(areaRect.top + 2, Math.min(areaRect.bottom - 2, lineY));
    line.style.left = `${anchor.left}px`;
    line.style.width = `${Math.max(0, gridRect.right - anchor.left - 8)}px`;
    line.style.top = `${Math.round(lineY)}px`;
  }

  function scheduleShortcutGroupDragMove(state: ShortcutGroupDragSession, pointerX: number, pointerY: number): void {
    state.pendingX = pointerX;
    state.pendingY = pointerY;
    if (state.frameId) return;
    state.frameId = window.requestAnimationFrame(() => {
      state.frameId = 0;
      if (state === shortcutGroupDragState && state.isDragging) {
        updateShortcutGroupDrag(state, state.pendingX, state.pendingY);
      }
    });
  }

  function handleShortcutGroupDragPointerMove(event: PointerEvent): void {
    const state = shortcutGroupDragState;
    if (!state || event.pointerId !== state.pointerId) return;
    const pointerX = Number(event.clientX);
    const pointerY = Number(event.clientY);
    if (!state.isDragging) {
      if (Math.hypot(pointerX - state.startX, pointerY - state.startY) < SHORTCUT_GROUP_DRAG_START_THRESHOLD_PX) return;
      startShortcutGroupDrag(state);
    }
    event.preventDefault();
    scheduleShortcutGroupDragMove(state, pointerX, pointerY);
  }

  // `release` is the pointer event that ended the drag; null for Escape.
  function finishShortcutGroupDrag(commit: boolean, release: PointerEvent | null): void {
    const state = shortcutGroupDragState;
    if (!state) return;
    shortcutGroupDragState = null;
    document.removeEventListener('pointermove', handleShortcutGroupDragPointerMove, true);
    document.removeEventListener('pointerup', handleShortcutGroupDragPointerUp, true);
    document.removeEventListener('pointercancel', handleShortcutGroupDragPointerCancel, true);
    if (state.frameId) window.cancelAnimationFrame(state.frameId);
    if (!state.isDragging) return;
    if (state.ghost) state.ghost.remove();
    if (state.line) state.line.remove();
    state.header.removeAttribute('data-shortcut-group-dragging');
    document.body.removeAttribute('data-drag-source');
    // The release would otherwise click the untitled group's title.
    getDragClickGuard().armAfterDrag(release, state.pointerId);
    if (commit && state.targetIndex >= 0) {
      void moveShortcutGroupToIndex(state.groupId, state.targetIndex);
    }
  }

  function handleShortcutGroupDragPointerUp(event: PointerEvent): void {
    if (shortcutGroupDragState && event.pointerId === shortcutGroupDragState.pointerId) {
      finishShortcutGroupDrag(true, event);
    }
  }

  function handleShortcutGroupDragPointerCancel(event: PointerEvent): void {
    if (shortcutGroupDragState && event.pointerId === shortcutGroupDragState.pointerId) {
      finishShortcutGroupDrag(false, event);
    }
  }

  function handleShortcutDragPointerDown(event: PointerEvent): void {
    if (pageState.bookmarkMoveHistoryBusy || isShortcutContextMenuNode(event.target)) {
      return;
    }
    const tile = getShortcutTileFromNode(event.target);
    if (!tile) {
      handleShortcutGroupDragPointerDown(event);
      return;
    }
    const shortcutId = getShortcutTileId(tile);
    if (!shortcutId || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }
    closeShortcutContextMenu();
    const rect = tile.getBoundingClientRect();
    pageState.shortcutDragState = {
      pointerId: event.pointerId,
      tile,
      shortcutId,
      originalShortcuts: pageState.newtabShortcuts.slice(),
      bookmarkId: getShortcutFolderId(getShortcutById(shortcutId)),
      pageSwitchTimerId: 0,
      pageSwitchDirection: 0,
      pageSwitchButton: null,
      folderSwitchTimerId: 0,
      folderSwitchTargetId: '',
      folderSwitchElement: null,
      folderSwitchPendingId: '',
      startX: Number(event.clientX),
      startY: Number(event.clientY),
      grabOffsetX: Number(event.clientX) - rect.left,
      grabOffsetY: Number(event.clientY) - rect.top,
      translateX: 0,
      translateY: 0,
      pendingPointerX: Number(event.clientX),
      pendingPointerY: Number(event.clientY),
      moveFrameId: 0,
      dropTarget: null,
      isDragging: false,
      hasReordered: false
    };
    attachShortcutDragDocumentListeners();
    if (typeof tile.setPointerCapture === 'function') {
      try {
        tile.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture can fail if the browser already canceled the pointer.
      }
    }
  }

  function handleShortcutDragPointerMove(event: PointerEvent): void {
    const state = pageState.shortcutDragState;
    if (!state || state.pointerId !== event.pointerId) {
      return;
    }
    const pointerX = Number(event.clientX);
    const pointerY = Number(event.clientY);
    if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
      return;
    }
    const dx = pointerX - state.startX;
    const dy = pointerY - state.startY;
    if (!state.isDragging &&
        Math.hypot(dx, dy) < SHORTCUT_DRAG_START_THRESHOLD_PX) {
      return;
    }
    if (!state.isDragging) {
      startShortcutDrag(event, state);
    }
    if (!state.isDragging) {
      return;
    }
    event.preventDefault();
    scheduleShortcutDragMove(state, pointerX, pointerY);
  }

  function handleShortcutDragPointerUp(event: PointerEvent): void {
    finishShortcutDrag(event);
  }

  function handleShortcutDragPointerCancel(event: PointerEvent): void {
    finishShortcutDrag(event, { cancel: true });
  }

  return {
    getShortcutTileLayoutRect,
    setShortcutDragTileTransform,
    getShortcutInsertionSlotAt,
    autoScrollShortcutArea,
    animateShortcutLayoutChange,
    scheduleShortcutDragMove,
    finishShortcutDrag,
    moveShortcutByKeyboard,
    isShortcutDragActive,
    isBookmarkSurfaceDragStateActive,
    handleShortcutDragPointerDown
  };
}

type ShortcutDrag = ReturnType<typeof createShortcutDrag>;

export { createShortcutDrag };
export type { ShortcutDrag, ShortcutDragDeps, ShortcutDragSession, ShortcutDragState };
