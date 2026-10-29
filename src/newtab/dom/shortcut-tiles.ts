// Shortcut tiles in the grid: which elements are tiles, the tiles in order,
// a tile's icon, box and group, where a drop between them lands, and the
// dragged tile following the pointer.
import { queryHtmlElement, queryHtmlElements } from '../../shared/dom-lookup';
import * as NEWTAB_CROSS_SURFACE_DRAG from '../cross-surface-drag';
import type { LayoutRect } from '../cross-surface-drag';
import type { ShortcutDragSession } from '../shortcuts/shortcut-drag';
import type { ShortcutInsertionSlot } from '../shortcuts/shortcut-types';

// Whether a folder menu opened from a folder shortcut, not a bookmark.
function isShortcutFolderAnchor(element: Element | null | undefined): boolean {
  return Boolean(element && element.classList.contains('x-nt-shortcut-tile'));
}

function getShortcutTileIcon(tile: HTMLElement | null | undefined): HTMLElement | null {
  return tile ? queryHtmlElement(tile, '.x-nt-shortcut-icon') : null;
}

// The shortcuts' tiles in the order they are drawn.
function getShortcutReorderTiles(grid: HTMLElement): HTMLElement[] {
  return queryHtmlElements(grid, '.x-nt-shortcut-tile[data-shortcut-id]');
}

// A tile's box from its layout offsets, which a running transform leaves alone.
function getShortcutTileLayoutRect(grid: HTMLElement, tile: HTMLElement | null): LayoutRect | null {
  if (!tile || typeof tile.offsetLeft !== 'number' ||
      typeof tile.offsetTop !== 'number') {
    return null;
  }
  const offsetParent = tile.offsetParent || grid;
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

function getShortcutTileGroupId(tile: HTMLElement): string {
  return String(tile.getAttribute('data-shortcut-group-id') || '');
}

const SHORTCUT_SLOT_SELECTOR = '.x-nt-shortcut-tile[data-shortcut-id], .x-nt-shortcut-group-empty';

// Empty groups show a slot that takes drops like a tile. `index` counts
// only the tiles before the insertion point; `groupId` is the group of the
// tile or slot the pointer is beside.
// `excludedTile` is the dragged tile, left out; `excludedSpot` holds its
// place (its placeholder while lifted).
function getShortcutInsertionSlotAt(
  grid: HTMLElement,
  pointerX: number,
  pointerY: number,
  excludedTile: HTMLElement | null,
  excludedSpot: HTMLElement | null
): ShortcutInsertionSlot {
  // The dragged tile filling an empty group hides that group's slot.
  // The slot keeps the tile's place, or the group's row would drop out
  // of reach and the next move would send the tile back, every move.
  const getSlotRect = (tile: HTMLElement): LayoutRect | null => (excludedTile && tile.previousElementSibling === excludedTile &&
    tile.classList.contains('x-nt-shortcut-group-empty') && !tile.hidden
    ? getShortcutTileLayoutRect(grid, excludedSpot)
    : getShortcutTileLayoutRect(grid, tile));
  const layoutItems: Array<{ tile: HTMLElement; rect: LayoutRect }> = [];
  queryHtmlElements(grid, SHORTCUT_SLOT_SELECTOR).forEach((tile) => {
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

// Puts the dragged tile under the pointer, where it was grabbed.
function placeShortcutDragTile(state: ShortcutDragSession, pointerX: number, pointerY: number): void {
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

export {
  getShortcutInsertionSlotAt,
  getShortcutReorderTiles,
  getShortcutTileGroupId,
  getShortcutTileIcon,
  getShortcutTileLayoutRect,
  isShortcutFolderAnchor,
  placeShortcutDragTile
};
