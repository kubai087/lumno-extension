const assert = require('assert');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const {
  createPreview,
  createSession,
  getFolderSwitchTarget,
  getFloatingPreviewPosition,
  getGridInsertionTarget,
  getTopbarDropPoint,
  getLayoutShiftDelta,
  isPointInsideElement,
  shouldKeepCascadeOpenAfterDrop,
  updateVisualPosition
} = require(path.join(repoRoot, 'src', 'newtab', 'dom', 'bookmark-drag.ts'));

function createClassList(names) {
  const values = new Set(names);
  return {
    contains(name) {
      return values.has(name);
    }
  };
}

function createCard(options) {
  const config = options && typeof options === 'object' ? options : {};
  const attributes = new Map([
    ['data-bookmark-index', String(config.index)]
  ]);
  return {
    _xBookmarkItem: config.item || null,
    _xTitleText: config.title || '',
    classList: createClassList(config.classNames || []),
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    }
  };
}

function createRect(left, top, width, height) {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    centerY: top + (height / 2)
  };
}

const sourceItems = [{ id: 'folder' }, { id: 'link' }];
const sourcePageIds = ['folder', 'link'];
const folderCard = createCard({
  classNames: ['x-nt-bookmark-cascade-item--folder'],
  index: 3,
  title: 'Design'
});
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

assert.strictEqual(session.sourceKind, 'cascade');
assert.strictEqual(session.isFolder, true);
assert.strictEqual(session.originalIndex, 3);
assert.strictEqual(session.originalPageIndex, -1);
assert.strictEqual(session.startX, 120);
assert.strictEqual(session.pendingPointerY, 180);
assert.strictEqual(session.folderSwitchTimerId, 0);
assert.strictEqual(session.folderSwitchTargetId, '');
assert.strictEqual(session.folderSwitchPendingId, '');
assert.notStrictEqual(session.originalAllItems, sourceItems);
assert.notStrictEqual(session.originalPageCardIds, sourcePageIds);
sourceItems.push({ id: 'later' });
sourcePageIds.push('later');
assert.strictEqual(session.originalAllItems.length, 2);
assert.strictEqual(session.originalPageCardIds.length, 2);

const previewAttributes = new Map([
  ['data-active', 'true'],
  ['data-bookmark-context-menu-open', 'true'],
  ['data-bookmark-copy-action-visible', 'true'],
  ['data-hover-suppressed', 'true']
]);
const previewClasses = new Set([
  'x-nt-bookmark-cascade-item',
  'x-nt-bookmark-card--hover',
  'x-nt-bookmark-card--folder-expanded'
]);
const clonedPreviewActions = [
  {
    removed: false,
    remove() {
      this.removed = true;
    }
  }
];
const previewNode = {
  nodeType: 1,
  namespaceURI: 'http://www.w3.org/1999/xhtml',
  classList: {
    add(...names) {
      names.forEach((name) => previewClasses.add(name));
    },
    remove(...names) {
      names.forEach((name) => previewClasses.delete(name));
    }
  },
  querySelector() {
    return null;
  },
  querySelectorAll(selector) {
    if (selector === '.x-nt-bookmark-copy-action, .x-nt-bookmark-cascade-copy-trigger') {
      return clonedPreviewActions;
    }
    return [];
  },
  removeAttribute(name) {
    previewAttributes.delete(name);
  },
  setAttribute(name, value) {
    previewAttributes.set(name, String(value));
  },
  style: {}
};
const previewSourceCard = {
  cloneNode() {
    return previewNode;
  },
  getBoundingClientRect() {
    return createRect(120, 180, 240, 32);
  }
};
const documentBody = {
  children: [],
  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
  }
};
const previewSession = {
  card: previewSourceCard,
  isFolder: false,
  sourceKind: 'cascade'
};
const cascadePreview = createPreview(previewSession, {
  documentObj: { body: documentBody }
});
assert.strictEqual(cascadePreview, previewNode);
assert.deepStrictEqual(
  documentBody.children,
  [previewNode],
  'a cascade drag preview should use an independent body-level fixed layer'
);
assert.strictEqual(previewClasses.has('x-nt-bookmark-cascade-drag-preview'), true);
assert.strictEqual(previewAttributes.get('data-bookmark-drag-preview'), 'true');
assert.strictEqual(previewAttributes.has('data-active'), false);
assert.strictEqual(previewAttributes.has('data-bookmark-context-menu-open'), false);
assert.strictEqual(previewAttributes.has('data-bookmark-copy-action-visible'), false);
assert.strictEqual(previewAttributes.has('data-hover-suppressed'), false);
assert.strictEqual(previewClasses.has('x-nt-bookmark-card--hover'), false);
assert.strictEqual(previewClasses.has('x-nt-bookmark-card--folder-expanded'), false);
assert.strictEqual(
  clonedPreviewActions.every((element) => element.removed),
  true,
  'drag previews should not clone copy controls from their source card'
);

const topbarPreviewClasses = new Set(['x-nt-bookmark-card']);
const topbarPreviewNode = {
  nodeType: 1,
  namespaceURI: 'http://www.w3.org/1999/xhtml',
  classList: {
    add(...names) {
      names.forEach((name) => topbarPreviewClasses.add(name));
    },
    remove(...names) {
      names.forEach((name) => topbarPreviewClasses.delete(name));
    }
  },
  querySelector() {
    return null;
  },
  querySelectorAll() {
    return [];
  },
  removeAttribute() {},
  setAttribute() {},
  style: {}
};
const topbarPreview = createPreview({
  card: {
    cloneNode() {
      return topbarPreviewNode;
    },
    getAttribute(name) {
      return name === 'data-bookmark-view-mode' ? 'top' : null;
    },
    getBoundingClientRect() {
      return createRect(40, 18, 154, 28);
    }
  },
  isFolder: true,
  sourceKind: 'card'
}, {
  documentObj: { body: documentBody }
});
assert.strictEqual(topbarPreview, topbarPreviewNode);
assert.strictEqual(
  topbarPreviewClasses.has(
    'x-nt-bookmark-card-drag-preview--topbar'
  ),
  true,
  'topbar cards should retain their compact layout in the body-level drag preview'
);
assert.strictEqual(topbarPreview.style.width, '154px');
assert.strictEqual(topbarPreview.style.height, '28px');

assert.deepStrictEqual(
  getFloatingPreviewPosition({
    pointerX: 100,
    pointerY: 120,
    previewWidth: 200,
    previewHeight: 60,
    viewportWidth: 1000,
    viewportHeight: 800
  }),
  { left: 110, top: 130 },
  'the drag preview should stay one pointer gap away in open viewport space'
);
assert.deepStrictEqual(
  getFloatingPreviewPosition({
    pointerX: 990,
    pointerY: 790,
    previewWidth: 200,
    previewHeight: 60,
    viewportWidth: 1000,
    viewportHeight: 800
  }),
  { left: 780, top: 720 },
  'the drag preview should flip before crossing the right or bottom viewport edge'
);

const previewStyle = {};
const previewElement = {
  offsetHeight: 60,
  offsetWidth: 200,
  style: previewStyle
};
const previewState = {
  baseLeft: 100,
  baseTop: 100,
  card: {},
  dragPreviewElement: previewElement,
  dragPreviewOffsetX: 10,
  dragPreviewOffsetY: 8,
  grabOffsetX: 18,
  grabOffsetY: 16
};
assert.deepStrictEqual(
  updateVisualPosition(previewState, 990, 790, {
    windowObj: { innerHeight: 800, innerWidth: 1000 }
  }),
  { left: 780, top: 720 }
);
assert.strictEqual(previewStyle.left, '780px');
assert.strictEqual(previewStyle.top, '720px');
assert.strictEqual(previewStyle.transform, 'translate3d(0, 0, 0)');

assert.deepStrictEqual(
  getLayoutShiftDelta(
    createRect(360, 32, 154, 28),
    createRect(120, 18, 154, 28)
  ),
  { dx: 240, dy: 14 },
  'grid and cascade drops should preserve two-dimensional layout shifts'
);
assert.deepStrictEqual(
  getLayoutShiftDelta(
    createRect(360, 32, 154, 28),
    createRect(120, 18, 154, 28),
    { horizontalOnly: true }
  ),
  { dx: 240, dy: 0 },
  'topbar drops should animate horizontally without a vertical return'
);

const hitElement = {
  getBoundingClientRect() {
    return createRect(20, 30, 80, 40);
  }
};
assert.strictEqual(isPointInsideElement(hitElement, 20, 30), true);
assert.strictEqual(isPointInsideElement(hitElement, 101, 50), false);
assert.strictEqual(isPointInsideElement(hitElement, NaN, 50), false);

const rootHeading = {};
assert.deepStrictEqual(
  getFolderSwitchTarget('nested', {
    kind: 'breadcrumb',
    folderId: '1',
    element: rootHeading
  }),
  {
    folderId: '1',
    element: rootHeading
  },
  'hovering the Bookmarks heading from a nested folder should target root navigation'
);
assert.strictEqual(
  getFolderSwitchTarget('1', {
    kind: 'breadcrumb',
    folderId: '1',
    element: rootHeading
  }),
  null,
  'the current folder should not schedule another drag navigation'
);
assert.strictEqual(
  getFolderSwitchTarget('nested', {
    kind: 'card',
    folderId: '1',
    element: rootHeading
  }),
  null,
  'folder cards should stay direct drop targets instead of navigation targets'
);
assert.strictEqual(
  shouldKeepCascadeOpenAfterDrop('cascade', {
    kind: 'insertion',
    surface: 'cascade'
  }),
  true,
  'a drop within the cascade should preserve its open menu'
);
assert.strictEqual(
  shouldKeepCascadeOpenAfterDrop('cascade', {
    kind: 'insertion',
    surface: 'grid'
  }),
  false,
  'a cascade item moved to the outer grid should close the source menu'
);
assert.strictEqual(
  shouldKeepCascadeOpenAfterDrop('cascade', {
    kind: 'breadcrumb'
  }),
  false,
  'a cascade item moved through the root heading should close the source menu'
);

const gridRect = createRect(100, 100, 800, 80);
const gridElement = {
  getBoundingClientRect() {
    return gridRect;
  }
};
const firstCard = createCard({ index: 0, item: { index: 0 } });
const secondCard = createCard({ index: 1, item: { index: 1 } });
const layoutItems = [
  { card: firstCard, rect: createRect(112, 100, 188, 80) },
  { card: secondCard, rect: createRect(312, 100, 188, 80) }
];

const firstTarget = getGridInsertionTarget({
  columnGap: '12px',
  folderId: '1',
  gridElement,
  layoutItems,
  pageStartIndex: 0,
  pointerX: 100,
  pointerY: 140
});
assert.strictEqual(firstTarget.index, 0);
assert.strictEqual(firstTarget.markerOffsetPx, 6);
assert.strictEqual(firstTarget.isPageStartBoundary, true);

assert.strictEqual(
  getGridInsertionTarget({
    columnGap: '12px',
    folderId: '1',
    gridElement,
    layoutItems,
    pageStartIndex: 0,
    pointerX: 97,
    pointerY: 140
  }),
  null,
  'the pointer should stop targeting insertion after leaving the eight-pixel boundary zone'
);

const middleTarget = getGridInsertionTarget({
  columnGap: '12px',
  folderId: '1',
  gridElement,
  layoutItems,
  pageStartIndex: 0,
  pointerX: 306,
  pointerY: 140
});
assert.strictEqual(middleTarget.index, 1);
assert.strictEqual(middleTarget.markerOffsetPx, 206);
assert.strictEqual(middleTarget.markerPosition, 'before');

const topbarGridRect = createRect(100, 20, 800, 36);
const topbarGridElement = {
  getBoundingClientRect() {
    return topbarGridRect;
  }
};
const topbarTarget = getGridInsertionTarget({
  columnGap: '12px',
  folderId: '1',
  gridElement: topbarGridElement,
  layoutItems: [
    { card: firstCard, rect: createRect(112, 24, 188, 28) },
    { card: secondCard, rect: createRect(312, 24, 188, 28) }
  ],
  markerVerticalInsetPx: 3,
  pageStartIndex: 0,
  pointerX: 306,
  pointerY: 38
});
assert.strictEqual(topbarTarget.markerTopPx, 7);
assert.strictEqual(topbarTarget.markerHeightPx, 22);

// A shortcut approaching the compact top bar can land in its padding or just
// below it; project that point into the row while excluding the action buttons.
const compactBar = { getBoundingClientRect: () => createRect(0, 0, 1000, 36) };
const compactViewport = { getBoundingClientRect: () => createRect(4, 4, 928, 28) };
const topbarPoint = (pointerX, pointerY) => getTopbarDropPoint({
  surfaceElement: compactBar,
  viewportElement: compactViewport,
  pointerX,
  pointerY
});
assert.deepStrictEqual(topbarPoint(500, 18), { x: 500, y: 18 });
assert.deepStrictEqual(topbarPoint(500, 0), { x: 500, y: 5 });
assert.deepStrictEqual(topbarPoint(500, 36), { x: 500, y: 31 });
assert.deepStrictEqual(topbarPoint(500, 52), { x: 500, y: 31 });
assert.deepStrictEqual(topbarPoint(0, 18), { x: 4, y: 18 });
assert.strictEqual(topbarPoint(500, 53), null, 'leaving the approach area clears the target');
assert.strictEqual(topbarPoint(950, 18), null, 'mode and manager buttons are not drop targets');
assert.strictEqual(topbarPoint(-1, 18), null);
assert.strictEqual(topbarPoint(500, -1), null);
assert.strictEqual(topbarPoint(NaN, 18), null);

const emptyTarget = getGridInsertionTarget({
  folderId: 'empty',
  gridElement,
  layoutItems: [],
  pageStartIndex: 0,
  pointerX: 120,
  pointerY: 140
});
assert.strictEqual(emptyTarget.index, 0);
assert.strictEqual(emptyTarget.element, gridElement);
assert.strictEqual(emptyTarget.markerHeightPx, 64);

const pagedGridRect = createRect(100, 100, 800, 180);
const pagedGridElement = {
  getBoundingClientRect() {
    return pagedGridRect;
  }
};
const pagedLayoutItems = [
  { card: createCard({ index: 8, item: { index: 8 } }), rect: createRect(112, 100, 188, 80) },
  { card: createCard({ index: 9, item: { index: 9 } }), rect: createRect(312, 100, 188, 80) },
  { card: createCard({ index: 10, item: { index: 10 } }), rect: createRect(112, 200, 188, 80) },
  { card: createCard({ index: 11, item: { index: 11 } }), rect: createRect(312, 200, 188, 80) }
];
function getCrossPageTarget(pointerX, pointerY) {
  return getGridInsertionTarget({
    columnGap: '12px',
    folderId: '1',
    gridElement: pagedGridElement,
    isCrossPageDrag: true,
    layoutItems: pagedLayoutItems,
    pageStartIndex: 8,
    pointerX,
    pointerY
  });
}

const crossPageFirstLeft = getCrossPageTarget(106, 140);
assert.strictEqual(crossPageFirstLeft.index, 8);
assert.strictEqual(crossPageFirstLeft.markerPosition, 'before');
assert.strictEqual(crossPageFirstLeft.preservePageSlot, true);

const crossPageFirstRight = getCrossPageTarget(306, 140);
assert.strictEqual(crossPageFirstRight.index, 9);
assert.strictEqual(crossPageFirstRight.markerPosition, 'before');
assert.strictEqual(crossPageFirstRight.preservePageSlot, true);

const crossPageLastLeft = getCrossPageTarget(306, 240);
assert.strictEqual(crossPageLastLeft.index, 11);
assert.strictEqual(crossPageLastLeft.markerPosition, 'before');
assert.strictEqual(crossPageLastLeft.preservePageSlot, true);

assert.strictEqual(
  getCrossPageTarget(506, 240),
  null,
  'a cross-page drag should not expose an insertion line after the page last item'
);

const samePageLastRight = getGridInsertionTarget({
  columnGap: '12px',
  folderId: '1',
  gridElement: pagedGridElement,
  isCrossPageDrag: false,
  layoutItems: pagedLayoutItems,
  pageStartIndex: 8,
  pointerX: 506,
  pointerY: 240
});
assert.strictEqual(samePageLastRight.index, 12);
assert.strictEqual(samePageLastRight.markerPosition, 'after');
assert.strictEqual(samePageLastRight.preservePageSlot, false);

console.log('New tab bookmark drag runtime tests passed.');
