// A bookmark drag's session, its floating preview, and where the pointer
// would drop it in the grid or bar.
import { isHtmlElement } from '../../shared/dom-guards';
import type {
  DragDropTarget,
  GridInsertionTarget,
  LayoutRect,
  MarkerPosition,
  SurfaceDragState
} from '../cross-surface-drag';
import type { BookmarkCardElement, BookmarkItem as CardItem } from '../react/bookmarks';
import type { BookmarkItem } from '../bookmarks/bookmarks-store';

// A bookmark card, or a row of the cascade menu, that a drag starts on.
type BookmarkDragSource = HTMLElement &
  Pick<BookmarkCardElement, '_xBookmarkItem' | '_xTitleText' | '_xDeactivateBookmarkHoverVisual'>;

interface BookmarkLayoutItem {
  card: BookmarkDragSource;
  rect: LayoutRect;
}

interface BookmarkDragSession extends SurfaceDragState {
  pointerId: number;
  card: BookmarkDragSource;
  bookmarkId: string;
  parentId: string;
  sourceKind: 'cascade' | 'card';
  isFolder: boolean;
  itemTitle: string;
  originalIndex: number;
  // The items and the page's cards as they were, to put back on cancel.
  originalAllItems: BookmarkItem[];
  originalPageCardIds: string[];
  originalPageIndex: number;
  startX: number;
  startY: number;
  grabOffsetX: number;
  grabOffsetY: number;
  baseLeft: number;
  baseTop: number;
  translateX: number;
  translateY: number;
  moveFrameId: number;
  pageIndex: number;
  // The other cards of the page and where they are.
  layoutItems: BookmarkLayoutItem[];
  dragPreviewElement: HTMLElement | null;
  dragPreviewOffsetX: number;
  dragPreviewOffsetY: number;
  keepCascadeOpenAfterDrop: boolean;
  isDragging: boolean;
  hasReordered: boolean;
  // Where the dragged card was drawn when it dropped.
  draggedVisualRect?: { left: number; top: number; right: number; bottom: number; width: number; height: number } | null;
}

// The parts of a session the preview helpers use.
type PreviewSession = Pick<BookmarkDragSession, 'card' | 'isFolder' | 'sourceKind'> &
  Partial<Pick<BookmarkDragSession,
    'bookmarkId' | 'dragPreviewElement' | 'baseLeft' | 'baseTop' | 'grabOffsetX' | 'grabOffsetY' |
    'dragPreviewOffsetX' | 'dragPreviewOffsetY'>>;

type VisualSession = Pick<BookmarkDragSession, 'card' | 'dragPreviewElement' | 'baseLeft' | 'baseTop' |
  'grabOffsetX' | 'grabOffsetY' | 'dragPreviewOffsetX' | 'dragPreviewOffsetY' | 'translateX' | 'translateY'>;

interface ViewportWindow {
  innerWidth: number;
  innerHeight: number;
}

type RectInput = Partial<Pick<LayoutRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height' | 'centerY'>>;

const DEFAULT_PREVIEW_POINTER_GAP_PX = 10;
const DEFAULT_PREVIEW_VIEWPORT_EDGE_PX = 8;
const DEFAULT_GRID_INSERTION_HIT_ZONE_PX = 8;
const DEFAULT_GRID_COLUMN_GAP_PX = 12;

function getAttribute(element: Pick<Element, 'getAttribute'> | null | undefined, name: string): string | null {
  return element && typeof element.getAttribute === 'function'
    ? element.getAttribute(name)
    : null;
}

function hasClass(element: Pick<Element, 'classList'> | null | undefined, className: string): boolean {
  return Boolean(
    element &&
    element.classList &&
    typeof element.classList.contains === 'function' &&
    element.classList.contains(className)
  );
}

function getRectCenterY(rect: RectInput | null | undefined): number {
  const centerY = Number(rect && rect.centerY);
  if (Number.isFinite(centerY)) {
    return centerY;
  }
  const top = Number(rect && rect.top);
  const height = Number(rect && rect.height);
  return Number.isFinite(top) && Number.isFinite(height)
    ? top + (height / 2)
    : NaN;
}

function getLayoutItemIndex(layoutItem: BookmarkLayoutItem | null | undefined): number {
  const card = layoutItem ? layoutItem.card : null;
  const bookmarkItem = card && card._xBookmarkItem;
  const attributeIndex = Number(getAttribute(card, 'data-bookmark-index'));
  const fallbackIndex = Number(bookmarkItem && bookmarkItem.index);
  return Number.isFinite(attributeIndex) ? attributeIndex : fallbackIndex;
}

function createSession(options: {
  event?: Pick<PointerEvent, 'pointerId' | 'clientX' | 'clientY'> | null;
  card: BookmarkDragSource;
  bookmarkItem?: CardItem | BookmarkItem | null;
  bookmarkId?: unknown;
  parentId?: unknown;
  sourceKind?: string;
  isFolder?: boolean;
  itemTitle?: string;
  allItems?: readonly BookmarkItem[];
  pageCardIds?: readonly string[];
  pageIndex?: number;
}): BookmarkDragSession {
  const config = options;
  const event = config.event || { pointerId: 0, clientX: NaN, clientY: NaN };
  const card = config.card;
  const bookmarkItem = config.bookmarkItem && typeof config.bookmarkItem === 'object'
    ? config.bookmarkItem
    : null;
  const pageIndex = Number(config.pageIndex);
  const itemIndex = bookmarkItem ? Number(bookmarkItem.index) : NaN;
  const attributeIndex = Number(getAttribute(card, 'data-bookmark-index'));
  const isFolder = typeof config.isFolder === 'boolean'
    ? config.isFolder
    : Boolean(
      (bookmarkItem && bookmarkItem.type === 'folder') ||
      hasClass(card, 'x-nt-bookmark-card--folder') ||
      hasClass(card, 'x-nt-bookmark-cascade-item--folder')
    );

  return {
    pointerId: event.pointerId,
    card,
    bookmarkId: String(config.bookmarkId || ''),
    parentId: String(config.parentId || ''),
    sourceKind: config.sourceKind === 'cascade' ? 'cascade' : 'card',
    isFolder,
    itemTitle: String(
      config.itemTitle ||
      (bookmarkItem && bookmarkItem.title) ||
      (card && card._xTitleText) ||
      ''
    ),
    originalIndex: Number.isFinite(itemIndex)
      ? itemIndex
      : Math.max(0, Number.isFinite(attributeIndex) ? attributeIndex : 0),
    originalAllItems: Array.isArray(config.allItems) ? config.allItems.slice() : [],
    originalPageCardIds: Array.isArray(config.pageCardIds)
      ? config.pageCardIds.slice()
      : [],
    originalPageIndex: Number.isFinite(pageIndex) ? pageIndex : 0,
    startX: Number(event.clientX),
    startY: Number(event.clientY),
    grabOffsetX: 0,
    grabOffsetY: 0,
    baseLeft: 0,
    baseTop: 0,
    translateX: 0,
    translateY: 0,
    pendingPointerX: Number(event.clientX),
    pendingPointerY: Number(event.clientY),
    moveFrameId: 0,
    pageIndex: Number.isFinite(pageIndex) ? pageIndex : 0,
    layoutItems: [],
    dropTarget: null,
    dragPreviewElement: null,
    dragPreviewOffsetX: 0,
    dragPreviewOffsetY: 0,
    pageSwitchTimerId: 0,
    pageSwitchDirection: 0,
    pageSwitchButton: null,
    folderSwitchTimerId: 0,
    folderSwitchTargetId: '',
    folderSwitchElement: null,
    folderSwitchPendingId: '',
    keepCascadeOpenAfterDrop: false,
    isDragging: false,
    hasReordered: false
  };
}

// The breadcrumb step a drag rests on, to open that folder.
function getFolderSwitchTarget(
  currentFolderId: unknown,
  dropTarget: DragDropTarget | null
): { folderId: string; element: HTMLElement | null } | null {
  if (!dropTarget || dropTarget.kind !== 'breadcrumb') {
    return null;
  }
  const folderId = String(dropTarget.folderId || '').trim();
  if (!folderId || folderId === String(currentFolderId || '')) {
    return null;
  }
  return {
    folderId,
    element: dropTarget.element || null
  };
}

function shouldKeepCascadeOpenAfterDrop(sourceKind: string, dropTarget: DragDropTarget | null): boolean {
  return Boolean(
    sourceKind === 'cascade' &&
    dropTarget &&
    dropTarget.surface === 'cascade'
  );
}

// The floating preview while there is one, else the card itself.
function getVisualElement(state: Pick<BookmarkDragSession, 'card' | 'dragPreviewElement'> | null | undefined): HTMLElement | null {
  return state && state.dragPreviewElement
    ? state.dragPreviewElement
    : state && state.card
      ? state.card
      : null;
}

function getLayoutShiftDelta(
  beforeRect: RectInput | null | undefined,
  afterRect: RectInput | null | undefined,
  options?: { horizontalOnly?: boolean }
): { dx: number; dy: number } | null {
  const beforeLeft = Number(beforeRect && beforeRect.left);
  const beforeTop = Number(beforeRect && beforeRect.top);
  const afterLeft = Number(afterRect && afterRect.left);
  const afterTop = Number(afterRect && afterRect.top);
  if (!Number.isFinite(beforeLeft) || !Number.isFinite(beforeTop) ||
      !Number.isFinite(afterLeft) || !Number.isFinite(afterTop)) {
    return null;
  }
  const config = options && typeof options === 'object' ? options : {};
  return {
    dx: beforeLeft - afterLeft,
    dy: config.horizontalOnly === true ? 0 : beforeTop - afterTop
  };
}

interface RenderClosedFolderIconDetail {
  bookmarkId: string;
  folderIcon: Element;
  preview: HTMLElement;
  state: PreviewSession;
}

interface PreviewOptions {
  documentObj?: Pick<Document, 'body'> | null;
  // Draws the preview's folder icon closed.
  renderClosedFolderIcon?(detail: RenderClosedFolderIconDetail): void;
}

function resetPreviewFolderVisual(state: PreviewSession, preview: HTMLElement, options?: PreviewOptions): void {
  if (!state.isFolder) {
    return;
  }
  preview.classList.remove(
    'x-nt-bookmark-card--folder-expanded',
    'x-nt-bookmark-card--hover'
  );
  const folderIcon = preview.querySelector(
    '.x-nt-bookmark-icon--figma, .x-nt-bookmark-cascade-icon--folder'
  );
  if (!folderIcon) {
    return;
  }
  const config = options || {};
  if (typeof config.renderClosedFolderIcon === 'function') {
    config.renderClosedFolderIcon({
      bookmarkId: String(state.bookmarkId || 'folder'),
      folderIcon,
      preview,
      state
    });
  }
  folderIcon.setAttribute('aria-hidden', 'true');
}

// A copy of the dragged card that floats over the page while it moves.
function createPreview(state: PreviewSession | null | undefined, options?: PreviewOptions): HTMLElement | null {
  const config = options || {};
  const documentObj = config.documentObj ||
    (typeof document !== 'undefined' ? document : null);
  if (!state || !state.card || !documentObj || !documentObj.body) {
    return null;
  }
  const rect = state.card.getBoundingClientRect();
  const preview = state.card.cloneNode(true);
  if (!isHtmlElement(preview)) {
    return null;
  }
  const isCascadeSource = state.sourceKind === 'cascade';
  const isTopbarCardSource = Boolean(
    !isCascadeSource &&
    getAttribute(state.card, 'data-bookmark-view-mode') === 'top'
  );
  const previewWidth = isCascadeSource
    ? Math.min(rect.width, 196)
    : Math.min(rect.width, 208);
  preview.classList.add(
    isCascadeSource
      ? 'x-nt-bookmark-cascade-drag-preview'
      : 'x-nt-bookmark-card-drag-preview'
  );
  if (isTopbarCardSource) {
    preview.classList.add(
      'x-nt-bookmark-card-drag-preview--topbar'
    );
  }
  [
    'id',
    'data-bookmark-drop-target',
    'data-bookmark-insert-position',
    'data-bookmark-dragging',
    'data-bookmark-dropping',
    'data-bookmark-id',
    'data-bookmark-parent-id',
    'data-bookmark-index',
    'data-bookmark-draggable',
    'data-active',
    'data-bookmark-context-menu-open',
    'data-bookmark-copy-action-visible',
    'data-hover-suppressed',
    'aria-expanded'
  ].forEach((name) => preview.removeAttribute(name));
  preview.classList.remove(
    'x-nt-bookmark-card--hover',
    'x-nt-bookmark-card--folder-expanded'
  );
  preview.setAttribute('aria-hidden', 'true');
  preview.setAttribute('data-bookmark-drag-preview', 'true');
  preview.tabIndex = -1;
  preview.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
  preview.querySelectorAll(
    '.x-nt-bookmark-copy-action, .x-nt-bookmark-cascade-copy-trigger'
  ).forEach((element) => {
    element.remove();
  });
  resetPreviewFolderVisual(state, preview, config);
  preview.style.left = `${rect.left}px`;
  preview.style.top = `${rect.top}px`;
  preview.style.width = `${previewWidth}px`;
  preview.style.height = `${rect.height}px`;
  preview.style.willChange = 'transform';
  documentObj.body.appendChild(preview);
  state.dragPreviewElement = preview;
  state.baseLeft = rect.left;
  state.baseTop = rect.top;
  state.grabOffsetX = Math.min(18, Math.max(0, previewWidth / 2));
  state.grabOffsetY = Math.min(16, Math.max(0, rect.height / 2));
  state.dragPreviewOffsetX = 10;
  state.dragPreviewOffsetY = 8;
  return preview;
}

function removePreview(state: Pick<BookmarkDragSession, 'dragPreviewElement'> | null | undefined): void {
  if (!state || !state.dragPreviewElement) {
    return;
  }
  const preview = state.dragPreviewElement;
  state.dragPreviewElement = null;
  if (preview.parentNode) {
    preview.parentNode.removeChild(preview);
  }
}

function getFloatingPreviewPosition(options: {
  pointerX: number;
  pointerY: number;
  previewWidth?: number;
  previewHeight?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  pointerGapPx?: number;
  viewportEdgePx?: number;
}): { left: number; top: number } {
  const config = options;
  const pointerX = Number(config.pointerX);
  const pointerY = Number(config.pointerY);
  const previewWidth = Math.max(0, Number(config.previewWidth) || 0);
  const previewHeight = Math.max(0, Number(config.previewHeight) || 0);
  const viewportWidth = Math.max(0, Number(config.viewportWidth) || 0);
  const viewportHeight = Math.max(0, Number(config.viewportHeight) || 0);
  const pointerGapPx = Number.isFinite(Number(config.pointerGapPx))
    ? Math.max(0, Number(config.pointerGapPx))
    : DEFAULT_PREVIEW_POINTER_GAP_PX;
  const viewportEdgePx = Number.isFinite(Number(config.viewportEdgePx))
    ? Math.max(0, Number(config.viewportEdgePx))
    : DEFAULT_PREVIEW_VIEWPORT_EDGE_PX;
  let left = pointerX + pointerGapPx;
  let top = pointerY + pointerGapPx;
  if (left + previewWidth > viewportWidth - viewportEdgePx) {
    left = pointerX - previewWidth - pointerGapPx;
  }
  if (top + previewHeight > viewportHeight - viewportEdgePx) {
    top = pointerY - previewHeight - pointerGapPx;
  }
  left = Math.max(
    viewportEdgePx,
    Math.min(left, viewportWidth - previewWidth - viewportEdgePx)
  );
  top = Math.max(
    viewportEdgePx,
    Math.min(top, viewportHeight - previewHeight - viewportEdgePx)
  );
  return { left, top };
}

// Moves the preview (or the card) with the pointer.
function updateVisualPosition(
  state: VisualSession | null | undefined,
  pointerX: number,
  pointerY: number,
  options?: { windowObj?: ViewportWindow | null; pointerGapPx?: number; viewportEdgePx?: number }
): { left: number; top: number } | null {
  const visualElement = getVisualElement(state);
  if (!state || !visualElement) {
    return null;
  }
  const baseLeft = Number(state.baseLeft) || 0;
  const baseTop = Number(state.baseTop) || 0;
  let nextX = pointerX - state.grabOffsetX - baseLeft +
    (Number(state.dragPreviewOffsetX) || 0);
  let nextY = pointerY - state.grabOffsetY - baseTop +
    (Number(state.dragPreviewOffsetY) || 0);
  if (state.dragPreviewElement === visualElement) {
    const config = options || {};
    const windowObj = config.windowObj ||
      (typeof window !== 'undefined' ? window : null);
    const position = getFloatingPreviewPosition({
      pointerX,
      pointerY,
      previewWidth: visualElement.offsetWidth || 0,
      previewHeight: visualElement.offsetHeight || 0,
      viewportWidth: windowObj ? windowObj.innerWidth : 0,
      viewportHeight: windowObj ? windowObj.innerHeight : 0,
      pointerGapPx: config.pointerGapPx,
      viewportEdgePx: config.viewportEdgePx
    });
    nextX = position.left - baseLeft;
    nextY = position.top - baseTop;
    state.translateX = nextX;
    state.translateY = nextY;
    visualElement.style.transition = 'none';
    visualElement.style.left = `${position.left}px`;
    visualElement.style.top = `${position.top}px`;
    visualElement.style.transform = 'translate3d(0, 0, 0)';
    return position;
  }
  state.translateX = nextX;
  state.translateY = nextY;
  visualElement.style.transition = 'none';
  visualElement.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`;
  return { left: baseLeft + nextX, top: baseTop + nextY };
}

function isPointInsideElement(element: Pick<Element, 'getBoundingClientRect'> | null | undefined, pointerX: number, pointerY: number): boolean {
  if (!element || !Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
    return false;
  }
  const rect = element.getBoundingClientRect();
  return pointerX >= rect.left && pointerX <= rect.right &&
    pointerY >= rect.top && pointerY <= rect.bottom;
}

interface Boundary {
  x: number;
  anchorItem: BookmarkLayoutItem;
  markerPosition: MarkerPosition;
}

// The line between two cards nearest the pointer, within the hit zone.
function getGridInsertionTarget(options: {
  gridElement?: HTMLElement | null;
  pointerX: number;
  pointerY: number;
  layoutItems?: readonly BookmarkLayoutItem[];
  isCrossPageDrag?: boolean;
  columnGap?: string;
  hitZonePx?: number;
  markerVerticalInsetPx?: number;
  folderId?: unknown;
  pageStartIndex?: number;
}): GridInsertionTarget | null {
  const config = options;
  const gridElement = config.gridElement || null;
  const pointerX = Number(config.pointerX);
  const pointerY = Number(config.pointerY);
  if (!gridElement || !Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
    return null;
  }
  const layoutItems = Array.isArray(config.layoutItems) ? config.layoutItems : [];
  const isCrossPageDrag = config.isCrossPageDrag === true;
  const pageLastItemIndex = layoutItems.reduce((lastIndex, item) => {
    const itemIndex = getLayoutItemIndex(item);
    return Number.isFinite(itemIndex) ? Math.max(lastIndex, itemIndex) : lastIndex;
  }, -1);
  const gridRect = gridElement.getBoundingClientRect();
  const computedColumnGap = Number.parseFloat(String(config.columnGap));
  const columnGap = Number.isFinite(computedColumnGap)
    ? Math.max(0, computedColumnGap)
    : DEFAULT_GRID_COLUMN_GAP_PX;
  const hitZonePx = Number.isFinite(Number(config.hitZonePx))
    ? Math.max(0, Number(config.hitZonePx))
    : DEFAULT_GRID_INSERTION_HIT_ZONE_PX;
  const markerVerticalInsetPx = Number.isFinite(
    Number(config.markerVerticalInsetPx)
  )
    ? Math.max(0, Number(config.markerVerticalInsetPx))
    : 8;
  const horizontalHitPadding = (columnGap / 2) + hitZonePx;
  if (pointerX < gridRect.left - horizontalHitPadding ||
      pointerX > gridRect.right + horizontalHitPadding ||
      pointerY < gridRect.top ||
      pointerY > gridRect.bottom) {
    return null;
  }
  if (!layoutItems.length) {
    return {
      kind: 'insertion',
      folderId: String(config.folderId || ''),
      index: 0,
      element: gridElement,
      markerElement: gridElement,
      markerPosition: 'before',
      markerOffsetPx: 4,
      markerTopPx: markerVerticalInsetPx,
      markerHeightPx: Math.max(
        2,
        gridRect.height - (markerVerticalInsetPx * 2)
      ),
      surface: 'grid'
    };
  }
  const rowHitItems = layoutItems.filter((item) =>
    item && item.rect &&
    pointerY >= item.rect.top && pointerY <= item.rect.bottom
  );
  if (!rowHitItems.length) {
    return null;
  }
  let nearestItem = rowHitItems[0];
  let nearestDistance = Math.abs(pointerY - getRectCenterY(nearestItem.rect));
  rowHitItems.forEach((item) => {
    const verticalDistance = Math.abs(pointerY - getRectCenterY(item.rect));
    if (verticalDistance < nearestDistance) {
      nearestDistance = verticalDistance;
      nearestItem = item;
    }
  });
  const rowCenterY = getRectCenterY(nearestItem.rect);
  const rowCards = layoutItems
    .filter((item) => {
      const itemCenterY = getRectCenterY(item && item.rect);
      return item && item.rect &&
        Number.isFinite(itemCenterY) &&
        Math.abs(itemCenterY - rowCenterY) <=
          Math.max(8, Math.min(item.rect.height, nearestItem.rect.height) / 2);
    })
    .sort((first, second) => first.rect.left - second.rect.left);
  const boundaries: Boundary[] = [];
  const firstItem = rowCards[0];
  const lastItem = rowCards[rowCards.length - 1];
  if (firstItem) {
    boundaries.push({
      x: firstItem.rect.left - (columnGap / 2),
      anchorItem: firstItem,
      markerPosition: 'before'
    });
  }
  for (let itemIndex = 1; itemIndex < rowCards.length; itemIndex += 1) {
    const previousItem = rowCards[itemIndex - 1];
    const nextItem = rowCards[itemIndex];
    boundaries.push({
      x: (previousItem.rect.right + nextItem.rect.left) / 2,
      anchorItem: nextItem,
      markerPosition: 'before'
    });
  }
  if (lastItem) {
    boundaries.push({
      x: lastItem.rect.right + (columnGap / 2),
      anchorItem: lastItem,
      markerPosition: 'after'
    });
  }
  let nearestBoundary: Boundary | null = null;
  let nearestBoundaryDistance = Infinity;
  for (const boundary of boundaries) {
    const distance = Math.abs(pointerX - boundary.x);
    if (distance < nearestBoundaryDistance) {
      nearestBoundary = boundary;
      nearestBoundaryDistance = distance;
    }
  }
  if (!nearestBoundary || nearestBoundaryDistance > hitZonePx) {
    return null;
  }
  const anchorItem = nearestBoundary.anchorItem;
  const anchorCard = anchorItem && anchorItem.card;
  if (!anchorCard) {
    return null;
  }
  const itemIndex = getLayoutItemIndex(anchorItem);
  if (!Number.isFinite(itemIndex)) {
    return null;
  }
  const markerPosition = nearestBoundary.markerPosition;
  const isPageStartBoundary = markerPosition === 'before' &&
    itemIndex === Number(config.pageStartIndex);
  const isPageEndBoundary = markerPosition === 'after' &&
    itemIndex === pageLastItemIndex;
  if (isCrossPageDrag && isPageEndBoundary) {
    return null;
  }
  return {
    kind: 'insertion',
    folderId: String(config.folderId || ''),
    index: itemIndex + (markerPosition === 'after' ? 1 : 0),
    element: anchorCard,
    markerElement: gridElement,
    markerPosition,
    // The compact bar clips its scrolling viewport. Keep the two-pixel
    // endpoint markers inside the grid instead of drawing in its outer gap.
    markerOffsetPx: Math.max(1, Math.min(gridRect.width - 1, nearestBoundary.x - gridRect.left)),
    markerTopPx: anchorItem.rect.top - gridRect.top + markerVerticalInsetPx,
    markerHeightPx: Math.max(
      2,
      anchorItem.rect.height - (markerVerticalInsetPx * 2)
    ),
    isPageStartBoundary,
    preservePageSlot: isCrossPageDrag,
    surface: 'grid'
  };
}

// Where a drag over the compact bar lands on its row of cards.
function getTopbarDropPoint(options: {
  surfaceElement?: HTMLElement | null;
  viewportElement?: HTMLElement | null;
  pointerX: number;
  pointerY: number;
}): { x: number; y: number } | null {
  const config = options;
  const surface = config.surfaceElement;
  const viewport = config.viewportElement;
  const x = Number(config.pointerX);
  const y = Number(config.pointerY);
  if (!surface || !viewport || !Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  const barRect = surface.getBoundingClientRect();
  const rowRect = viewport.getBoundingClientRect();
  // The compact bar's padding and a small approach area below it should
  // accept drops too. Keep the action buttons outside the drop surface.
  if (!rowRect.width || !rowRect.height || x < barRect.left ||
      x > rowRect.right || y < barRect.top || y > barRect.bottom + 16) {
    return null;
  }
  return {
    x: Math.max(rowRect.left, Math.min(rowRect.right - 1, x)),
    y: Math.max(rowRect.top + 1, Math.min(rowRect.bottom - 1, y))
  };
}

export {
  DEFAULT_GRID_INSERTION_HIT_ZONE_PX,
  DEFAULT_PREVIEW_POINTER_GAP_PX,
  DEFAULT_PREVIEW_VIEWPORT_EDGE_PX,
  createPreview,
  createSession,
  getFolderSwitchTarget,
  getFloatingPreviewPosition,
  getGridInsertionTarget,
  getTopbarDropPoint,
  getLayoutShiftDelta,
  getVisualElement,
  isPointInsideElement,
  removePreview,
  resetPreviewFolderVisual,
  shouldKeepCascadeOpenAfterDrop,
  updateVisualPosition
};
export type { BookmarkDragSession, BookmarkDragSource, BookmarkLayoutItem };
