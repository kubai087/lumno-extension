// Finding the bookmark cards in the grid and measuring where they sit.
import { isElementNode, isHtmlTag } from '../../shared/dom-guards';
import { queryHtmlTags } from '../../shared/dom-lookup';
import type { LayoutRect } from '../cross-surface-drag';
import type { BookmarkCardElement } from '../react/bookmarks';

function getBookmarkCardFromNode(node: EventTarget | null): BookmarkCardElement | null {
  const card = isElementNode(node) ? node.closest('.x-nt-bookmark-card') : null;
  return isHtmlTag(card, 'div') ? card : null;
}

function getBookmarkCardId(card: Element | null | undefined): string {
  return card ? card.getAttribute('data-bookmark-id') || '' : '';
}

// The cards a drag can move, in the order they are drawn.
function getBookmarkReorderCards(grid: HTMLElement): BookmarkCardElement[] {
  return queryHtmlTags(grid, '.x-nt-bookmark-card[data-bookmark-draggable="true"]', 'div');
}

function getBookmarkCardLayoutRect(card: Element | null): LayoutRect | null {
  if (!card) {
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

export { getBookmarkCardFromNode, getBookmarkCardId, getBookmarkCardLayoutRect, getBookmarkReorderCards };
