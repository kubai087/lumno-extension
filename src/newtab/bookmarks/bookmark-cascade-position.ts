// Where the bookmark cascade menu and its submenus open, and the triangle
// the pointer may cross towards an open submenu without closing it.

// A DOMRect, or as much of one as a caller has.
type RectLike = Partial<Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>>;

interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

// A point, or a pointer event's client position.
interface PointLike {
  x?: number;
  y?: number;
  clientX?: number;
  clientY?: number;
}

interface ViewportSize {
  width?: number;
  height?: number;
}

interface PlacementOptions {
  viewport?: ViewportSize;
  // The gap to the anchor or parent level.
  spacing?: number;
  viewportPadding?: number;
  viewportTopPadding?: number;
  // The room kept below the menu; at least `viewportPadding`.
  viewportBottomPadding?: number;
}

interface RootPlacement {
  left: number;
  top: number;
  horizontal: 'left' | 'right';
  vertical: 'below' | 'above';
}

interface SubmenuPlacement {
  left: number;
  top: number;
  side: 'left' | 'right';
}

function toFiniteNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeRect(rect: RectLike | null | undefined): Rect {
  const source = rect || {};
  const left = toFiniteNumber(source.left, 0);
  const top = toFiniteNumber(source.top, 0);
  const width = Math.max(0, toFiniteNumber(source.width, toFiniteNumber(source.right, left) - left));
  const height = Math.max(0, toFiniteNumber(source.height, toFiniteNumber(source.bottom, top) - top));
  const right = toFiniteNumber(source.right, left + width);
  const bottom = toFiniteNumber(source.bottom, top + height);
  return { left, right, top, bottom, width, height };
}

function normalizeViewport(viewport: ViewportSize | null | undefined): { width: number; height: number } {
  const source = viewport || {};
  return {
    width: Math.max(0, toFiniteNumber(source.width, 0)),
    height: Math.max(0, toFiniteNumber(source.height, 0))
  };
}

function normalizePoint(point: PointLike | null | undefined): Point | null {
  const source = point || {};
  const x = Object.hasOwn(source, 'x') ? source.x : source.clientX;
  const y = Object.hasOwn(source, 'y') ? source.y : source.clientY;
  const normalizedX = Number(x);
  const normalizedY = Number(y);
  if (!Number.isFinite(normalizedX) || !Number.isFinite(normalizedY)) {
    return null;
  }
  return { x: normalizedX, y: normalizedY };
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }
  return Math.max(min, Math.min(value, max));
}

function roundPlacement<T extends { left: number; top: number }>(placement: T): T {
  return {
    ...placement,
    left: Math.round(placement.left),
    top: Math.round(placement.top)
  };
}

function parseCssTransformTranslate(transform: unknown): Point {
  const text = typeof transform === 'string' ? transform.trim() : '';
  if (!text || text === 'none') {
    return { x: 0, y: 0 };
  }
  const matrixMatch = text.match(/^matrix\(([^)]+)\)$/);
  if (matrixMatch) {
    const values = matrixMatch[1].split(',').map((part) => Number.parseFloat(part.trim()));
    return {
      x: Number.isFinite(values[4]) ? values[4] : 0,
      y: Number.isFinite(values[5]) ? values[5] : 0
    };
  }
  const matrix3dMatch = text.match(/^matrix3d\(([^)]+)\)$/);
  if (matrix3dMatch) {
    const values = matrix3dMatch[1].split(',').map((part) => Number.parseFloat(part.trim()));
    return {
      x: Number.isFinite(values[12]) ? values[12] : 0,
      y: Number.isFinite(values[13]) ? values[13] : 0
    };
  }
  return { x: 0, y: 0 };
}

// The rect without the translation in the element's transform.
function getTranslateNeutralRect(rect: RectLike | null | undefined, transform: unknown): Rect {
  const source = normalizeRect(rect);
  const translate = parseCssTransformTranslate(transform);
  return {
    left: source.left - translate.x,
    right: source.right - translate.x,
    top: source.top - translate.y,
    bottom: source.bottom - translate.y,
    width: source.width,
    height: source.height
  };
}

function getPlacementOptions(
  source: PlacementOptions
): { spacing: number; padding: number; topPadding: number; bottomPadding: number } {
  const padding = Math.max(0, toFiniteNumber(source.viewportPadding, 8));
  return {
    spacing: toFiniteNumber(source.spacing, 8),
    padding,
    topPadding: Math.max(
      padding,
      toFiniteNumber(source.viewportTopPadding, padding)
    ),
    bottomPadding: Math.max(
      padding,
      toFiniteNumber(source.viewportBottomPadding, padding)
    )
  };
}

function placeRootCascadeMenu(
  options?: PlacementOptions & { anchorRect?: RectLike; menuRect?: RectLike }
): RootPlacement {
  const source = options || {};
  const anchor = normalizeRect(source.anchorRect);
  const menu = normalizeRect(source.menuRect);
  const viewport = normalizeViewport(source.viewport);
  const { spacing, padding, topPadding, bottomPadding } = getPlacementOptions(source);
  const maxLeft = viewport.width - menu.width - padding;
  const maxTop = viewport.height - menu.height - bottomPadding;

  let left = anchor.left;
  let horizontal: RootPlacement['horizontal'] = 'left';
  if (left + menu.width > viewport.width - padding) {
    const rightAlignedLeft = anchor.right - menu.width;
    horizontal = 'right';
    left = rightAlignedLeft;
  }
  left = clamp(left, padding, maxLeft);

  const availableBelow = viewport.height - bottomPadding - anchor.bottom - spacing;
  const availableAbove = anchor.top - topPadding - spacing;
  const belowTop = anchor.bottom + spacing;
  const aboveTop = anchor.top - spacing - menu.height;
  const shouldOpenBelow = availableBelow >= menu.height || availableBelow >= availableAbove;
  const vertical: RootPlacement['vertical'] = shouldOpenBelow ? 'below' : 'above';
  const top = clamp(shouldOpenBelow ? belowTop : aboveTop, topPadding, maxTop);

  return roundPlacement({ left, top, horizontal, vertical });
}

function placeCascadeSubmenu(
  options?: PlacementOptions & { parentLevelRect?: RectLike; triggerRect?: RectLike; menuRect?: RectLike }
): SubmenuPlacement {
  const source = options || {};
  const parentLevel = normalizeRect(source.parentLevelRect);
  const trigger = normalizeRect(source.triggerRect);
  const menu = normalizeRect(source.menuRect);
  const viewport = normalizeViewport(source.viewport);
  const { spacing, padding, topPadding, bottomPadding } = getPlacementOptions(source);
  const maxLeft = viewport.width - menu.width - padding;
  const maxTop = viewport.height - menu.height - bottomPadding;

  const rightLeft = parentLevel.right + spacing;
  const leftLeft = parentLevel.left - spacing - menu.width;
  const fitsRight = rightLeft + menu.width <= viewport.width - padding;
  const fitsLeft = leftLeft >= padding;
  const roomRight = Math.max(0, viewport.width - padding - rightLeft);
  const roomLeft = Math.max(0, parentLevel.left - spacing - padding);

  let side: SubmenuPlacement['side'] = 'right';
  let left = rightLeft;
  if (!fitsRight && (fitsLeft || roomLeft > roomRight)) {
    side = 'left';
    left = leftLeft;
  }

  return roundPlacement({
    left: clamp(left, padding, maxLeft),
    top: clamp(trigger.top, topPadding, maxTop),
    side
  });
}

function buildCascadeSafeTriangle(
  options?: { pointer?: PointLike | null; submenuRect?: RectLike; side?: string }
): Point[] | null {
  const source = options || {};
  const pointer = normalizePoint(source.pointer);
  const submenu = normalizeRect(source.submenuRect);
  if (!pointer || submenu.width <= 0 || submenu.height <= 0) {
    return null;
  }
  const side = source.side === 'left' ? 'left' : 'right';
  const baseX = side === 'left' ? submenu.right : submenu.left;
  return [
    { x: pointer.x, y: pointer.y },
    { x: baseX, y: submenu.top },
    { x: baseX, y: submenu.bottom }
  ];
}

function getTriangleArea(a: Point, b: Point, c: Point): number {
  return Math.abs(
    ((b.x - a.x) * (c.y - a.y)) -
    ((c.x - a.x) * (b.y - a.y))
  );
}

function getPointSign(point: Point, a: Point, b: Point): number {
  return ((point.x - b.x) * (a.y - b.y)) - ((a.x - b.x) * (point.y - b.y));
}

function isPointInsideCascadeSafeTriangle(
  point: PointLike | null | undefined,
  triangle: readonly PointLike[] | null | undefined
): boolean {
  const normalizedPoint = normalizePoint(point);
  if (!normalizedPoint || !Array.isArray(triangle) || triangle.length < 3) {
    return false;
  }
  const a = normalizePoint(triangle[0]);
  const b = normalizePoint(triangle[1]);
  const c = normalizePoint(triangle[2]);
  if (!a || !b || !c || getTriangleArea(a, b, c) < 0.01) {
    return false;
  }
  const d1 = getPointSign(normalizedPoint, a, b);
  const d2 = getPointSign(normalizedPoint, b, c);
  const d3 = getPointSign(normalizedPoint, c, a);
  const hasNegative = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPositive = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNegative && hasPositive);
}

export {
  buildCascadeSafeTriangle,
  getTranslateNeutralRect,
  isPointInsideCascadeSafeTriangle,
  placeRootCascadeMenu,
  placeCascadeSubmenu
};
export type { Point, PointLike, Rect, RectLike, RootPlacement, SubmenuPlacement };
