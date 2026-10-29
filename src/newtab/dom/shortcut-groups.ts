// The shortcut groups' elements in the grid: their headers, the header a
// press can drag (not its menu button or title field), a dragged header's
// ghost and the line showing where it lands, and the placeholder that keeps
// a lifted tile's slot.
import { isElementNode, isHtmlElement } from '../../shared/dom-guards';
import { queryHtmlElement, queryHtmlElements, queryHtmlTags } from '../../shared/dom-lookup';

function getShortcutGroupHeaders(grid: HTMLElement): HTMLElement[] {
  return queryHtmlElements(grid, '.x-nt-shortcut-group-header');
}

function getShortcutGroupHeader(grid: HTMLElement, groupId: string | undefined): HTMLElement | null {
  return groupId ? queryHtmlElement(grid, `.x-nt-shortcut-group-header[data-shortcut-group-id="${groupId}"]`) : null;
}

function getDraggableShortcutGroupHeader(target: EventTarget | null): HTMLElement | null {
  if (!isElementNode(target) || target.closest('.x-nt-shortcut-group-more, .x-nt-shortcut-group-input')) {
    return null;
  }
  const header = target.closest('.x-nt-shortcut-group-header');
  return isHtmlElement(header) ? header : null;
}

// A copy of the header without its menu button, placed where the header is.
function createShortcutGroupGhost(header: HTMLElement): HTMLElement | null {
  const rect = header.getBoundingClientRect();
  const ghost = header.cloneNode(true);
  if (!isHtmlElement(ghost)) {
    return null;
  }
  ghost.querySelectorAll('button.x-nt-shortcut-group-more').forEach((button) => button.remove());
  ghost.classList.add('x-nt-shortcut-group-ghost');
  ghost.removeAttribute('data-shortcut-group-id');
  ghost.removeAttribute('data-shortcut-group-dragging');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.style.left = `${rect.left}px`;
  ghost.style.top = `${rect.top}px`;
  return ghost;
}

function createShortcutGroupDropLine(doc: Document): HTMLElement {
  const line = doc.createElement('div');
  line.className = 'x-nt-shortcut-group-drop-line';
  line.setAttribute('aria-hidden', 'true');
  return line;
}

function createShortcutDragPlaceholder(doc: Document): HTMLElement {
  const placeholder = doc.createElement('span');
  placeholder.className = 'x-nt-shortcut-drag-placeholder';
  placeholder.setAttribute('aria-hidden', 'true');
  return placeholder;
}

// The slots of the groups that hold no tile.
function getEmptyShortcutGroupSlots(grid: HTMLElement): HTMLButtonElement[] {
  return queryHtmlTags(grid, '.x-nt-shortcut-group-empty', 'button');
}

export {
  getEmptyShortcutGroupSlots,
  createShortcutDragPlaceholder,
  createShortcutGroupDropLine,
  createShortcutGroupGhost,
  getDraggableShortcutGroupHeader,
  getShortcutGroupHeader,
  getShortcutGroupHeaders
};
