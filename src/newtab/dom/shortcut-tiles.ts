// Which elements are shortcut tiles, the tiles in order, and a tile's icon.
import { queryHtmlElement, queryHtmlElements } from '../../shared/dom-lookup';
import type { LayoutRect } from '../cross-surface-drag';

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

export { getShortcutReorderTiles, getShortcutTileIcon, getShortcutTileLayoutRect, isShortcutFolderAnchor };
