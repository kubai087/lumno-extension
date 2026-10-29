// Which elements are shortcut tiles, and a tile's icon.
import { queryHtmlElement } from '../../shared/dom-lookup';

// Whether a folder menu opened from a folder shortcut, not a bookmark.
function isShortcutFolderAnchor(element: Element | null | undefined): boolean {
  return Boolean(element && element.classList.contains('x-nt-shortcut-tile'));
}

function getShortcutTileIcon(tile: HTMLElement | null | undefined): HTMLElement | null {
  return tile ? queryHtmlElement(tile, '.x-nt-shortcut-icon') : null;
}

export { getShortcutTileIcon, isShortcutFolderAnchor };
