// Finding the bookmark cards in the grid, measuring where they sit, and the
// copy of a page that slides out when the page turns.
import { isElementNode, isHtmlElement, isHtmlTag, isSvgElement } from '../../shared/dom-guards';
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

// Every card in the grid, in the order it is drawn.
function getBookmarkCards(grid: HTMLElement): BookmarkCardElement[] {
  return queryHtmlTags(grid, '.x-nt-bookmark-card', 'div');
}

// Whether a pointer event landed on a card's copy button.
function isBookmarkCopyActionTarget(target: EventTarget | null | undefined): boolean {
  return isElementNode(target) && Boolean(target.closest('.x-nt-bookmark-copy-action'));
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

// One row of the grid: a card's height and the gap below it.
function measureBookmarkRow(grid: HTMLElement): { cardHeight: number; rowGap: number } {
  const firstCard = grid.querySelector('.x-nt-bookmark-card');
  return {
    cardHeight: firstCard ? firstCard.getBoundingClientRect().height : 51,
    rowGap: Number.parseFloat(window.getComputedStyle(grid).rowGap) || 16
  };
}

// A still copy of the page of cards on screen, laid over the grid, that
// slides out while the next page's cards slide in.
function createOutgoingBookmarkPage(grid: HTMLElement, gridStyle: CSSStyleDeclaration): HTMLElement | null {
  const outgoing = grid.cloneNode(true);
  if (!isHtmlElement(outgoing)) {
    return null;
  }
  outgoing.removeAttribute('id');
  outgoing.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
  outgoing.setAttribute('aria-hidden', 'true');
  outgoing.inert = true;
  // The copied cards still name lenses that go with the cards React is about to replace, and a
  // missing filter voids a backdrop-filter, so they slide out with their blur alone. The marker
  // keeps the liquid surfaces from building lenses for a page that is leaving.
  outgoing.setAttribute('data-bookmark-page-outgoing', 'true');
  outgoing.querySelectorAll('*').forEach((element) => {
    if (isHtmlElement(element) || isSvgElement(element)) element.style.removeProperty('--x-nt-glass-refraction');
  });
  Object.assign(outgoing.style, {
    position: 'absolute', inset: '0', width: '100%', display: 'grid',
    gridTemplateColumns: gridStyle.gridTemplateColumns,
    columnGap: gridStyle.columnGap, rowGap: gridStyle.rowGap,
    alignContent: 'start', pointerEvents: 'none'
  });
  return outgoing;
}

export { createOutgoingBookmarkPage, getBookmarkCardFromNode, getBookmarkCards, isBookmarkCopyActionTarget, measureBookmarkRow, getBookmarkCardId, getBookmarkCardLayoutRect, getBookmarkReorderCards };
