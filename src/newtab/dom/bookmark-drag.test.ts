import { describe, expect, it } from 'vitest';
import {
  createPreview,
  createSession,
  getFloatingPreviewPosition,
  getFolderSwitchTarget,
  getGridInsertionTarget,
  getLayoutShiftDelta,
  getTopbarDropPoint,
  isPointInsideElement,
  shouldKeepCascadeOpenAfterDrop,
  updateVisualPosition,
  type BookmarkLayoutItem
} from './bookmark-drag';
import type { CascadeDropTarget, DragDropTarget, GridInsertionTarget, LayoutRect } from '../cross-surface-drag';
import type { BookmarkItem } from '../bookmarks/bookmarks-store';
import { createLayout } from '../../../tests/fakes/layout';
import { required } from '../../../tests/fakes/dom';

function rect(left: number, top: number, width: number, height: number): LayoutRect {
  return { left, top, right: left + width, bottom: top + height, width, height, centerX: left + width / 2, centerY: top + height / 2 };
}

function bookmark(id: string, index = 0): BookmarkItem {
  return { id, parentId: '1', index, title: id, url: `https://${id}.example/`, host: `${id}.example`, themeUrl: '', type: 'bookmark' };
}

function element(className = '', attributes: Record<string, string> = {}): HTMLElement {
  const node = document.createElement('div');
  node.className = className;
  Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
  return node;
}

// A card the grid lays out at `index`.
function card(index: number) {
  return Object.assign(element('x-nt-bookmark-card', { 'data-bookmark-index': String(index) }), { _xBookmarkItem: { index } });
}

function cascadeTarget(): CascadeDropTarget {
  return { kind: 'insertion', surface: 'cascade', folderId: '1', title: '', element: null, markerElement: null, markerPosition: '' };
}

function gridTarget(): GridInsertionTarget {
  const grid = element();
  return {
    kind: 'insertion', surface: 'grid', folderId: '1', index: 0, element: grid, markerElement: grid,
    markerPosition: 'before', markerOffsetPx: 0, markerTopPx: 0, markerHeightPx: 0
  };
}

describe('a bookmark drag session', () => {
  it('starts from the card, the pointer and copies of the lists it may restore', () => {
    const sourceItems = [bookmark('folder'), bookmark('link', 1)];
    const sourcePageIds = ['folder', 'link'];
    const folderCard = Object.assign(element('x-nt-bookmark-cascade-item--folder', { 'data-bookmark-index': '3' }), { _xTitleText: 'Design' });
    const session = createSession({
      allItems: sourceItems,
      bookmarkId: 'folder',
      bookmarkItem: { id: 'folder', index: 3, title: 'Design', type: 'folder' },
      card: folderCard,
      event: { clientX: 120, clientY: 180, pointerId: 7 },
      pageCardIds: sourcePageIds,
      pageIndex: -1,
      parentId: '1',
      sourceKind: 'cascade'
    });

    expect(session.sourceKind).toBe('cascade');
    expect(session.isFolder).toBe(true);
    expect(session.originalIndex).toBe(3);
    expect(session.originalPageIndex).toBe(-1);
    expect(session.startX).toBe(120);
    expect(session.pendingPointerY).toBe(180);
    expect(session.folderSwitchTimerId).toBe(0);
    expect(session.folderSwitchTargetId).toBe('');
    expect(session.folderSwitchPendingId).toBe('');
    expect(session.originalAllItems).not.toBe(sourceItems);
    expect(session.originalPageCardIds).not.toBe(sourcePageIds);
    sourceItems.push(bookmark('later', 2));
    sourcePageIds.push('later');
    expect(session.originalAllItems).toHaveLength(2);
    expect(session.originalPageCardIds).toHaveLength(2);
  });
});

describe('the drag preview', () => {
  it('copies a menu row into its own body-level layer without its state or copy controls', () => {
    const layout = createLayout();
    const row = element('x-nt-bookmark-cascade-item x-nt-bookmark-card--hover x-nt-bookmark-card--folder-expanded', {
      'data-active': 'true',
      'data-bookmark-context-menu-open': 'true',
      'data-bookmark-copy-action-visible': 'true',
      'data-hover-suppressed': 'true'
    });
    row.append(element('x-nt-bookmark-copy-action'), element('x-nt-bookmark-cascade-copy-trigger'));
    layout.place(row, { left: 120, top: 180, width: 240, height: 32 });

    const preview = required(createPreview({ card: row, isFolder: false, sourceKind: 'cascade' }), 'the preview');

    expect(Array.from(document.body.children)).toEqual([preview]);
    expect(preview.classList.contains('x-nt-bookmark-cascade-drag-preview')).toBe(true);
    expect(preview.getAttribute('data-bookmark-drag-preview')).toBe('true');
    ['data-active', 'data-bookmark-context-menu-open', 'data-bookmark-copy-action-visible', 'data-hover-suppressed']
      .forEach((name) => expect(preview.hasAttribute(name)).toBe(false));
    expect(preview.classList.contains('x-nt-bookmark-card--hover')).toBe(false);
    expect(preview.classList.contains('x-nt-bookmark-card--folder-expanded')).toBe(false);
    expect(preview.querySelectorAll('.x-nt-bookmark-copy-action, .x-nt-bookmark-cascade-copy-trigger')).toHaveLength(0);
  });

  it('keeps a top bar card compact', () => {
    const layout = createLayout();
    const topbarCard = element('x-nt-bookmark-card', { 'data-bookmark-view-mode': 'top' });
    layout.place(topbarCard, { left: 40, top: 18, width: 154, height: 28 });

    const preview = required(createPreview({ card: topbarCard, isFolder: true, sourceKind: 'card' }), 'the preview');

    expect(preview.classList.contains('x-nt-bookmark-card-drag-preview--topbar')).toBe(true);
    expect(preview.style.width).toBe('154px');
    expect(preview.style.height).toBe('28px');
  });

  it('stays one pointer gap away in open viewport space', () => {
    expect(getFloatingPreviewPosition({
      pointerX: 100, pointerY: 120, previewWidth: 200, previewHeight: 60, viewportWidth: 1000, viewportHeight: 800
    })).toEqual({ left: 110, top: 130 });
  });

  it('flips before crossing the right or bottom viewport edge', () => {
    expect(getFloatingPreviewPosition({
      pointerX: 990, pointerY: 790, previewWidth: 200, previewHeight: 60, viewportWidth: 1000, viewportHeight: 800
    })).toEqual({ left: 780, top: 720 });
  });

  it('moves the floating preview with the pointer', () => {
    const layout = createLayout();
    const preview = layout.measure(element(), { offsetWidth: 200, offsetHeight: 60 });
    const state = {
      baseLeft: 100, baseTop: 100, card: element(), dragPreviewElement: preview,
      dragPreviewOffsetX: 10, dragPreviewOffsetY: 8, grabOffsetX: 18, grabOffsetY: 16, translateX: 0, translateY: 0
    };

    expect(updateVisualPosition(state, 990, 790, { windowObj: { innerHeight: 800, innerWidth: 1000 } })).toEqual({ left: 780, top: 720 });
    expect(preview.style.left).toBe('780px');
    expect(preview.style.top).toBe('720px');
    expect(preview.style.transform).toBe('translate3d(0, 0, 0)');
  });
});

describe('the layout shift a drop animates', () => {
  it('keeps both axes for grid and cascade drops', () => {
    expect(getLayoutShiftDelta(rect(360, 32, 154, 28), rect(120, 18, 154, 28))).toEqual({ dx: 240, dy: 14 });
  });

  it('keeps only the horizontal shift in the top bar', () => {
    expect(getLayoutShiftDelta(rect(360, 32, 154, 28), rect(120, 18, 154, 28), { horizontalOnly: true })).toEqual({ dx: 240, dy: 0 });
  });
});

describe('hit testing an element', () => {
  it('takes points inside its box only', () => {
    const layout = createLayout();
    const target = layout.place(element(), { left: 20, top: 30, width: 80, height: 40 });

    expect(isPointInsideElement(target, 20, 30)).toBe(true);
    expect(isPointInsideElement(target, 101, 50)).toBe(false);
    expect(isPointInsideElement(target, NaN, 50)).toBe(false);
  });
});

describe('folder navigation while dragging', () => {
  const rootHeading = element();
  const breadcrumb: DragDropTarget = { kind: 'breadcrumb', folderId: '1', title: 'Bookmarks', element: rootHeading };

  it('targets the root heading from a nested folder', () => {
    expect(getFolderSwitchTarget('nested', breadcrumb)).toEqual({ folderId: '1', element: rootHeading });
  });

  it('does not navigate to the folder shown', () => {
    expect(getFolderSwitchTarget('1', breadcrumb)).toBeNull();
  });

  it('leaves folder cards as drop targets', () => {
    expect(getFolderSwitchTarget('nested', { ...breadcrumb, kind: 'card' })).toBeNull();
  });
});

describe('the cascade after a drop', () => {
  it('stays open for a drop within it', () => {
    expect(shouldKeepCascadeOpenAfterDrop('cascade', cascadeTarget())).toBe(true);
  });

  it('closes for a drop on the grid', () => {
    expect(shouldKeepCascadeOpenAfterDrop('cascade', gridTarget())).toBe(false);
  });

  it('closes for a drop through the root heading', () => {
    expect(shouldKeepCascadeOpenAfterDrop('cascade', { kind: 'breadcrumb', folderId: '1', title: '', element: element() })).toBe(false);
  });
});

describe('the insertion line in the grid', () => {
  function grid(box: { left: number; top: number; width: number; height: number }) {
    const layout = createLayout();
    return layout.place(element(), box);
  }
  const firstCard = card(0);
  const secondCard = card(1);
  const layoutItems: BookmarkLayoutItem[] = [
    { card: firstCard, rect: rect(112, 100, 188, 80) },
    { card: secondCard, rect: rect(312, 100, 188, 80) }
  ];

  it('marks the start of the page at the left edge', () => {
    const target = required(getGridInsertionTarget({
      columnGap: '12px', folderId: '1', gridElement: grid({ left: 100, top: 100, width: 800, height: 80 }),
      layoutItems, pageStartIndex: 0, pointerX: 100, pointerY: 140
    }), 'the target');

    expect(target.index).toBe(0);
    expect(target.markerOffsetPx).toBe(6);
    expect(target.isPageStartBoundary).toBe(true);
  });

  it('stops targeting past the eight-pixel boundary zone', () => {
    expect(getGridInsertionTarget({
      columnGap: '12px', folderId: '1', gridElement: grid({ left: 100, top: 100, width: 800, height: 80 }),
      layoutItems, pageStartIndex: 0, pointerX: 97, pointerY: 140
    })).toBeNull();
  });

  it('marks the gap between two cards before the second', () => {
    const target = required(getGridInsertionTarget({
      columnGap: '12px', folderId: '1', gridElement: grid({ left: 100, top: 100, width: 800, height: 80 }),
      layoutItems, pageStartIndex: 0, pointerX: 306, pointerY: 140
    }), 'the target');

    expect(target.index).toBe(1);
    expect(target.markerOffsetPx).toBe(206);
    expect(target.markerPosition).toBe('before');
  });

  it('insets the line in the compact top bar', () => {
    const target = required(getGridInsertionTarget({
      columnGap: '12px', folderId: '1', gridElement: grid({ left: 100, top: 20, width: 800, height: 36 }),
      layoutItems: [{ card: firstCard, rect: rect(112, 24, 188, 28) }, { card: secondCard, rect: rect(312, 24, 188, 28) }],
      markerVerticalInsetPx: 3, pageStartIndex: 0, pointerX: 306, pointerY: 38
    }), 'the target');

    expect(target.markerTopPx).toBe(7);
    expect(target.markerHeightPx).toBe(22);
  });

  it('fills an empty grid', () => {
    const gridElement = grid({ left: 100, top: 100, width: 800, height: 80 });
    const target = required(getGridInsertionTarget({
      folderId: 'empty', gridElement, layoutItems: [], pageStartIndex: 0, pointerX: 120, pointerY: 140
    }), 'the target');

    expect(target.index).toBe(0);
    expect(target.element).toBe(gridElement);
    expect(target.markerHeightPx).toBe(64);
  });
});

describe('the insertion line on another page of the grid', () => {
  const pagedItems: BookmarkLayoutItem[] = [
    { card: card(8), rect: rect(112, 100, 188, 80) },
    { card: card(9), rect: rect(312, 100, 188, 80) },
    { card: card(10), rect: rect(112, 200, 188, 80) },
    { card: card(11), rect: rect(312, 200, 188, 80) }
  ];
  function target(pointerX: number, pointerY: number, isCrossPageDrag = true) {
    const layout = createLayout();
    return getGridInsertionTarget({
      columnGap: '12px', folderId: '1', gridElement: layout.place(element(), { left: 100, top: 100, width: 800, height: 180 }),
      isCrossPageDrag, layoutItems: pagedItems, pageStartIndex: 8, pointerX, pointerY
    });
  }

  it('keeps the page slot at the first card, either side, and before the last', () => {
    expect([target(106, 140), target(306, 140), target(306, 240)].map((found) => {
      const value = required(found, 'the target');
      return [value.index, value.markerPosition, value.preservePageSlot];
    })).toEqual([[8, 'before', true], [9, 'before', true], [11, 'before', true]]);
  });

  it('shows no line after the page last card', () => {
    expect(target(506, 240)).toBeNull();
  });

  it('shows one after the last card when dragging within the page', () => {
    const value = required(target(506, 240, false), 'the target');
    expect([value.index, value.markerPosition, value.preservePageSlot]).toEqual([12, 'after', false]);
  });
});

describe('a drop on the compact top bar', () => {
  // The bar's padding and just below it lead into its row; its action
  // buttons do not.
  function point(pointerX: number, pointerY: number) {
    const layout = createLayout();
    return getTopbarDropPoint({
      surfaceElement: layout.place(element(), { left: 0, top: 0, width: 1000, height: 36 }),
      viewportElement: layout.place(element(), { left: 4, top: 4, width: 928, height: 28 }),
      pointerX,
      pointerY
    });
  }

  it('projects the approach area into the row', () => {
    expect([point(500, 18), point(500, 0), point(500, 36), point(500, 52), point(0, 18)])
      .toEqual([{ x: 500, y: 18 }, { x: 500, y: 5 }, { x: 500, y: 31 }, { x: 500, y: 31 }, { x: 4, y: 18 }]);
  });

  it('clears the target past the approach area', () => {
    expect(point(500, 53)).toBeNull();
  });

  it('leaves the mode and manager buttons out', () => {
    expect(point(950, 18)).toBeNull();
  });

  it('ignores points outside the bar or not a number', () => {
    expect([point(-1, 18), point(500, -1), point(NaN, 18)]).toEqual([null, null, null]);
  });
});
