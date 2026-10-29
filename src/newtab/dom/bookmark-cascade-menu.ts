import * as LumnoNewtabDismissStack from '../dismiss-stack';
import type { BlockedDropTarget, CascadeDropTarget } from '../cross-surface-drag';
import type { DismissStack } from '../dismiss-stack';
import type { BindCursorTooltip, Translate } from '../newtab-types';
import type {
  CascadeLevelModel,
  CascadeMenuHandlers,
  CascadeMenuView,
  CascadeRowModel
} from '../react/bookmark-cascade-view';
import { createCascadeMenu } from '../react/bookmark-cascade-view';
import { isHtmlElement, isNode } from '../../shared/dom-guards';
import { queryHtmlElements } from '../../shared/dom-lookup';
import type * as MenuSurface from '../../shared/ui/menu-surface';
import type { TooltipController } from '../../shared/ui/tooltip';
import type * as CascadePosition from '../bookmarks/bookmark-cascade-position';
import type { Point, PointLike, Rect, RootPlacement, SubmenuPlacement } from '../bookmarks/bookmark-cascade-position';
import type { BookmarkItem } from '../bookmarks/bookmarks-store';

// An element the menu opens from. The view that drew it hooks in to show
// its menu as open: it draws its own expanded state and active look.
type BookmarkMenuAnchor = HTMLElement & {
  _xSetBookmarkMenuVisualActive?: (active: boolean, options?: { instant?: boolean }) => void;
};

// The parts of the window the menu uses; tests pass their own.
interface CascadeWindow {
  innerWidth?: number;
  innerHeight?: number;
  performance?: { now(): number };
  setTimeout?(callback: () => void, delay: number): number;
  clearTimeout?(timerId: number): void;
  requestAnimationFrame?(callback: () => void): number;
  matchMedia?(query: string): { matches: boolean };
  getComputedStyle?(element: Element): { transform: string };
}

// Pulling the rows on either side of an insertion point apart.
interface InsertionGapApi {
  getInsertionGapNeighbors(
    items: Element[],
    anchor: Element | null,
    markerPosition: string
  ): { before: Element | null; after: Element | null };
  setInsertionGap(owner: object, before: Element | null, after: Element | null): void;
}

interface CascadeItemEventDetail<E extends Event = Event> {
  event: E;
  item: BookmarkItem;
  element: HTMLButtonElement;
  parentFolderId: string;
}

interface CascadeOpenUrlOptions {
  openInBackgroundTab: boolean;
  // Option/Alt: the other of the current and a new tab.
  openInOtherTab: boolean;
  anchor: BookmarkMenuAnchor | null;
}

interface FaviconFallbackOptions {
  primaryUrl: string;
  browserUrl: string;
}

interface BookmarkCascadeMenuOptions {
  documentObj?: Document | null;
  windowObj?: CascadeWindow | null;
  dismissStack?: DismissStack | null;
  positionUtils?: Partial<typeof CascadePosition>;
  crossSurfaceDrag?: InsertionGapApi | null;
  menuSurface?: Partial<Pick<typeof MenuSurface, 'open' | 'close'>> | null;
  t?: Translate;
  sanitizeDisplayText?(value: unknown): string;
  getHostFromUrl?(url: string): string;
  getSiteDisplayName?(host: string, title: string): string;
  getUrlDisplay?(url: string): string;
  initFolderPathMorph?(icon: Element): void;
  playFolderPathMorph?(icon: Element, toHover: boolean): void;
  attachFaviconWithFallbacks?(image: HTMLImageElement, url: string, host: string, options: FaviconFallbackOptions): void;
  // An icon chosen for the site, or ''.
  getItemIconUrl?(item: BookmarkItem, anchor: BookmarkMenuAnchor | null): string;
  isLocalNetworkHost?(host: string): boolean;
  getChromeFaviconUrl?(url: string): string;
  getBrowserPageFaviconUrl?(url: string): string;
  ensureReady?(forceReload: boolean): Promise<boolean>;
  getItems?(folderId: string): readonly BookmarkItem[];
  navigateToUrl?(url: string): void;
  openUrl?(url: string, options: CascadeOpenUrlOptions): void;
  bindCursorTooltip?: BindCursorTooltip;
  hideCursorTooltip?(): void;
  hideTopActionTooltip?(): void;
  copyTooltipController?: Pick<TooltipController, 'show' | 'hide'> | null;
  copyUrl?(url: string): unknown;
  shouldSuppressHover?(target: Element, event: Event | PointLike | null): boolean;
  onItemPointerDown?(detail: CascadeItemEventDetail<PointerEvent>): void;
  onItemContextMenu?(detail: CascadeItemEventDetail<MouseEvent> & { sourceKind: 'cascade' }): void;
  // True right after a press on an open context menu, so it does not open
  // the item underneath.
  isActivationSuppressed?(): boolean;
  shouldKeepOpenForExternalNode?(node: EventTarget | null): boolean;
  getViewportTopPadding?(): number;
}

// What a row shows that stays the same while its level is open.
interface CascadeRowContent {
  key: string;
  item: BookmarkItem;
  isFolder: boolean;
  title: string;
  folderIconSuffix: string;
  iconUrl: string;
  iconMonochrome: boolean;
  iconAlt: string;
}

interface CascadeLevelEntry {
  // Names the level's drawing; a level drawn afresh gets a new one.
  key: string;
  folderId: string;
  folderTitle: string;
  levelIndex: number;
  rows: CascadeRowContent[];
  // The folder row in the level above whose submenu this is; '' for the root.
  triggerKey: string;
  // The selected row, or ''.
  activeKey: string;
  // Rows crossed on the way to an open submenu, which show no hover meanwhile.
  suppressedKeys: Set<string>;
  // Set once the view has drawn the level.
  levelElement: HTMLElement | null;
  surfaceOpened: boolean;
  placement?: RootPlacement | SubmenuPlacement;
}

interface HoverIntentTask {
  levelIndex: number;
  key: string;
  triggerElement: HTMLElement;
  allowWhenSuppressed?: boolean;
  run: () => void;
  // Until then the pointer may still be on its way to an open submenu.
  safeUntil?: number;
}

// A pointer position and how it was given, for hover intent.
type HoverPointer = PointLike & { pointerType?: string };

type CascadeMarkerPosition = 'before' | 'after';

interface CascadeRefreshOptions {
  // The row that was dragged slides from where it was dropped.
  draggedBookmarkId?: string;
  draggedRect?: Rect | null;
}

type CascadeDropMatch =
  | {
    kind: 'insertion';
    entry: CascadeLevelEntry;
    // The row the marker sits by; none in an empty level.
    button?: HTMLElement;
    folderId: string;
    index: number;
    element: HTMLElement | null;
    markerElement: HTMLElement | null;
    markerPosition: CascadeMarkerPosition;
  }
  | {
    kind: 'cascade';
    entry: CascadeLevelEntry;
    button: HTMLElement;
    folderId: string;
    title: string;
    element: HTMLElement;
  };

// Where a drag over the menu would drop: into a folder row, or between
// two rows; 'blocked' over the menu where nothing takes the drop.
type CascadeDragTarget = CascadeDropTarget | BlockedDropTarget;

const BOOKMARK_CASCADE_SUBMENU_GAP_PX = -8;
const BOOKMARK_CASCADE_HOVER_DELAY_MS = 220;
const BOOKMARK_CASCADE_CLOSE_DELAY_MS = 360;
const BOOKMARK_CASCADE_SAFE_RECHECK_MS = 80;
const BOOKMARK_CASCADE_SAFE_MAX_MS = 1200;
const BOOKMARK_CASCADE_SAFE_EDGE_ZONE_PX = 90;
const BOOKMARK_CASCADE_DRAG_OPEN_DELAY_MS = 420;
const BOOKMARK_CASCADE_FOLDER_DROP_MIN_RATIO = 0.38;
const BOOKMARK_CASCADE_FOLDER_DROP_MAX_RATIO = 0.62;
const BOOKMARK_CASCADE_REORDER_ANIMATION_MS = 180;
const BOOKMARK_CASCADE_REORDER_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

function noop(): void {}

const DISMISS_LAYER_KEY = 'bookmark-cascade-menu';

// The page passes its shared dismiss stack; on its own (tests) the menu
// keeps a stack of one for its document.
function createOwnDismissStack(documentObj: Document | null): DismissStack | null {
  return documentObj ? LumnoNewtabDismissStack.createDismissStack({ documentObj }) : null;
}

function createBookmarkCascadeMenuRuntime(options?: BookmarkCascadeMenuOptions) {
  const config = options || {};
  // An option given as null stays null; one left out takes the default.
  const documentObj = Object.hasOwn(config, 'documentObj')
    ? config.documentObj || null
    : (typeof document !== 'undefined' ? document : null);
  const windowObj: CascadeWindow | null = Object.hasOwn(config, 'windowObj')
    ? config.windowObj || null
    : (typeof window !== 'undefined' ? window : null);
  const dismissStack = config.dismissStack || createOwnDismissStack(documentObj);
  const positionUtils = config.positionUtils || {};
  const crossSurfaceDrag = config.crossSurfaceDrag || null;
  const insertionGapOwner = {};
  const menuSurface = config.menuSurface || null;
  const t: Translate = config.t || ((_key, fallback) => fallback || '');
  const sanitizeDisplayText = config.sanitizeDisplayText || ((value: unknown) => String(value || ''));
  const getHostFromUrl = config.getHostFromUrl || (() => '');
  const getSiteDisplayName = config.getSiteDisplayName || ((_host: string, title: string) => title || '');
  const getUrlDisplay = config.getUrlDisplay || ((url: string) => url || '');
  const initFolderPathMorph = config.initFolderPathMorph || noop;
  const playFolderPathMorph = config.playFolderPathMorph || noop;
  const attachFaviconWithFallbacks = config.attachFaviconWithFallbacks || noop;
  const getItemIconUrl = config.getItemIconUrl || (() => '');
  const isLocalNetworkHost = config.isLocalNetworkHost || (() => false);
  const getChromeFaviconUrl = config.getChromeFaviconUrl || (() => '');
  const getBrowserPageFaviconUrl = config.getBrowserPageFaviconUrl || (() => '');
  const ensureReady = config.ensureReady || (() => Promise.resolve(false));
  const getItems = config.getItems || (() => []);
  const navigateToUrl = config.navigateToUrl || noop;
  const openUrl = config.openUrl || ((url: string) => navigateToUrl(url));
  const bindCursorTooltip: BindCursorTooltip = config.bindCursorTooltip || (() => null);
  const hideCursorTooltip = config.hideCursorTooltip || noop;
  const hideTopActionTooltip = config.hideTopActionTooltip || noop;
  const copyTooltipController = config.copyTooltipController || null;
  const copyUrl = config.copyUrl || (() => Promise.resolve(false));
  const shouldSuppressHover = config.shouldSuppressHover || (() => false);
  const onItemPointerDown = config.onItemPointerDown || noop;
  const onItemContextMenu = config.onItemContextMenu || noop;
  const isActivationSuppressed = config.isActivationSuppressed || (() => false);
  const shouldKeepOpenForExternalNode = config.shouldKeepOpenForExternalNode || (() => false);
  const getViewportTopPadding = config.getViewportTopPadding || (() => 8);

  let bookmarkCascadeMenu: HTMLElement | null = null;
  let menuView: CascadeMenuView | null = null;
  // The level elements the view has drawn, by level key.
  const levelElements = new Map<string, HTMLElement>();
  let levelSerial = 0;
  // The bookmark whose context menu is open from a row, or ''.
  let contextMenuBookmarkId = '';
  let bookmarkCascadeAnchor: BookmarkMenuAnchor | null = null;
  let bookmarkCascadeOpenRequest: { folderId: string; anchorElement: BookmarkMenuAnchor; dragMode: boolean } | null = null;
  let bookmarkCascadeLevels: CascadeLevelEntry[] = [];
  let bookmarkCascadePointer: Point | null = null;
  let bookmarkCascadePreviousPointer: Point | null = null;
  let bookmarkCascadeHoverIntentTimer = 0;
  let bookmarkCascadeHoverIntentTask: HoverIntentTask | null = null;
  let bookmarkCascadeCloseTimer = 0;
  let bookmarkCascadeKeyboardLevelIndex = 0;
  let bookmarkCascadeDragMode = false;
  let bookmarkCascadeRefreshInProgress = false;
  let bookmarkCascadeDragTargetButton: HTMLElement | null = null;
  let bookmarkCascadeDragInsertionElement: HTMLElement | null = null;
  // The timer that ends each row's reorder animation.
  const rowLayoutAnimationTimers = new WeakMap<HTMLElement, number>();

  function setAnchorVisualActive(anchor: BookmarkMenuAnchor | null, active: boolean, visualOptions?: { instant?: boolean }): void {
    if (anchor && typeof anchor._xSetBookmarkMenuVisualActive === 'function') {
      anchor._xSetBookmarkMenuVisualActive(active, visualOptions);
    }
  }

  // A cascade row's wrapper around its button.
  function getRow(button: Element): HTMLElement | null {
    const row = button.closest('.x-nt-bookmark-cascade-row');
    return isHtmlElement(row) ? row : null;
  }

  // State changes mark the menu for drawing; it is drawn once the outermost
  // batch of changes ends, or at once outside a batch.
  let batchDepth = 0;
  let renderPending = false;

  function batch<T>(run: () => T): T {
    batchDepth += 1;
    try {
      return run();
    } finally {
      batchDepth -= 1;
      if (batchDepth === 0) {
        flushRender();
      }
    }
  }

  function invalidate(): void {
    renderPending = true;
    if (batchDepth === 0) {
      flushRender();
    }
  }

  // Draws pending changes now, e.g. before focusing or measuring a row.
  function flushRender(): void {
    if (!renderPending) {
      return;
    }
    renderPending = false;
    renderMenu();
  }

  function getRowKey(item: BookmarkItem, index: number): string {
    const id = String(item && item.id || '');
    return id ? `id:${id}` : `index:${index}`;
  }

  function getRowContent(entry: CascadeLevelEntry, key: string): CascadeRowContent | null {
    return entry.rows.find((row) => row.key === key) || null;
  }

  // Rows draw one item button each, in the level's order.
  function getRowButton(entry: CascadeLevelEntry | null, key: string): HTMLElement | null {
    if (!entry || !key) {
      return null;
    }
    const index = entry.rows.findIndex((row) => row.key === key);
    return index >= 0 ? getBookmarkCascadeLevelItems(entry.levelElement)[index] || null : null;
  }

  function getRowKeyForButton(entry: CascadeLevelEntry, button: HTMLElement): string {
    const index = getBookmarkCascadeLevelItems(entry.levelElement).indexOf(button);
    return index >= 0 && entry.rows[index] ? entry.rows[index].key : '';
  }

  // The anchor for the root level; the folder row for a submenu.
  function getTriggerElement(entry: CascadeLevelEntry): HTMLElement | null {
    return entry.levelIndex > 0
      ? getRowButton(getBookmarkCascadeLevelEntry(entry.levelIndex - 1), entry.triggerKey)
      : bookmarkCascadeAnchor;
  }

  function isRowExpanded(entry: CascadeLevelEntry, key: string): boolean {
    const child = getBookmarkCascadeLevelEntry(entry.levelIndex + 1);
    return Boolean(child && child.triggerKey === key);
  }

  function buildLevelModel(entry: CascadeLevelEntry): CascadeLevelModel {
    return {
      key: entry.key,
      levelIndex: entry.levelIndex,
      title: sanitizeDisplayText(entry.folderTitle),
      emptyLabel: t('bookmarks_empty_folder', 'No content'),
      rows: entry.rows.map((row, index): CascadeRowModel => {
        const parentId = String(row.item.parentId || entry.folderId || '');
        const bookmarkIndex = Number.isFinite(Number(row.item.index)) ? String(row.item.index) : '';
        return {
          key: row.key,
          isFolder: row.isFolder,
          title: row.title,
          bookmarkId: String(row.item.id || ''),
          parentId,
          bookmarkIndex,
          draggable: Boolean(row.item.id && parentId && bookmarkIndex !== ''),
          active: entry.activeKey === row.key,
          expanded: row.isFolder && isRowExpanded(entry, row.key),
          hoverSuppressed: entry.suppressedKeys.has(row.key),
          contextMenuOpen: contextMenuBookmarkId !== '' && contextMenuBookmarkId === String(row.item.id || ''),
          folderIconSuffix: row.folderIconSuffix,
          iconUrl: row.iconUrl,
          iconMonochrome: row.iconMonochrome,
          iconAlt: row.iconAlt,
          copyLabel: t('bookmarks_copy_url', 'Copy link')
        };
      })
    };
  }

  // Draws the open levels, then measures, places and opens the new ones.
  function renderMenu(): void {
    if (!menuView || !bookmarkCascadeMenu) {
      return;
    }
    menuView.render({ levels: bookmarkCascadeLevels.map(buildLevelModel) });
    bookmarkCascadeLevels.forEach((entry) => {
      entry.levelElement = levelElements.get(entry.key) || null;
      if (!entry.levelElement || entry.surfaceOpened) {
        return;
      }
      entry.surfaceOpened = true;
      lockBookmarkCascadeLevelWidth(entry.levelElement);
      positionBookmarkCascadeLevel(entry);
      openBookmarkCascadeLevelSurface(entry.levelElement);
    });
  }

  function setBookmarkCascadeDragMode(enabled: boolean): boolean {
    bookmarkCascadeDragMode = enabled === true;
    if (bookmarkCascadeMenu) {
      if (bookmarkCascadeDragMode) {
        bookmarkCascadeMenu.setAttribute('data-drag-mode', 'true');
      } else {
        bookmarkCascadeMenu.removeAttribute('data-drag-mode');
      }
    }
    if (!bookmarkCascadeDragMode) {
      clearBookmarkCascadeDragTarget();
      cancelBookmarkCascadeHoverIntent();
      cancelBookmarkCascadeDelayedClose();
    }
    return bookmarkCascadeDragMode;
  }

  function getNow(): number {
    return windowObj && windowObj.performance && typeof windowObj.performance.now === 'function'
      ? windowObj.performance.now()
      : Date.now();
  }

  function requestFrame(callback: () => void): number {
    if (windowObj && typeof windowObj.requestAnimationFrame === 'function') {
      return windowObj.requestAnimationFrame(callback);
    }
    if (windowObj && typeof windowObj.setTimeout === 'function') {
      return windowObj.setTimeout(callback, 16);
    }
    return 0;
  }

  function setTimer(callback: () => void, delay: number): number {
    return windowObj && typeof windowObj.setTimeout === 'function'
      ? windowObj.setTimeout(callback, delay)
      : 0;
  }

  function clearTimer(timerId: number): void {
    if (timerId && windowObj && typeof windowObj.clearTimeout === 'function') {
      windowObj.clearTimeout(timerId);
    }
  }

  function getBookmarkCascadePointFromEvent(event: PointLike | null | undefined): Point | null {
    if (!event) {
      return null;
    }
    const x = Number(event.clientX);
    const y = Number(event.clientY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }
    return { x, y };
  }

  function updateBookmarkCascadePointer(event: PointLike | null | undefined): Point | null {
    const point = getBookmarkCascadePointFromEvent(event);
    if (!point) {
      return bookmarkCascadePointer;
    }
    if (!bookmarkCascadePointer ||
        bookmarkCascadePointer.x !== point.x ||
        bookmarkCascadePointer.y !== point.y) {
      bookmarkCascadePreviousPointer = bookmarkCascadePointer;
      bookmarkCascadePointer = point;
    }
    return bookmarkCascadePointer;
  }

  function isBookmarkCascadeHoverSuppressed(target: Element, event: Event | PointLike | null): boolean {
    return shouldSuppressHover(target, event) === true;
  }

  function isPointInsideRect(
    point: Point | null,
    rect: Pick<Rect, 'left' | 'right' | 'top' | 'bottom'> | null
  ): boolean {
    return Boolean(
      point &&
      rect &&
      point.x >= rect.left &&
      point.x <= rect.right &&
      point.y >= rect.top &&
      point.y <= rect.bottom
    );
  }

  function getBookmarkCascadeLevelEntry(levelIndex: number): CascadeLevelEntry | null {
    const safeLevelIndex = Math.max(0, Math.floor(levelIndex) || 0);
    return bookmarkCascadeLevels.find((entry) => entry && entry.levelIndex === safeLevelIndex) || null;
  }

  function getBookmarkCascadeSubmenuSide(entry: CascadeLevelEntry | null, childRect: Rect | null): 'left' | 'right' {
    if (!entry) {
      return 'right';
    }
    if (entry.placement && 'side' in entry.placement) {
      return entry.placement.side === 'left' ? 'left' : 'right';
    }
    const attrSide = entry.levelElement ? entry.levelElement.getAttribute('data-side') : '';
    if (attrSide === 'left' || attrSide === 'right') {
      return attrSide;
    }
    const parentEntry = getBookmarkCascadeLevelEntry(entry.levelIndex - 1);
    const parentRect = parentEntry ? getBookmarkCascadeElementRect(parentEntry.levelElement) : null;
    if (parentRect && childRect && childRect.left < parentRect.left) {
      return 'left';
    }
    return 'right';
  }

  function buildBookmarkCascadeSafeTriangleForLevel(levelIndex: number, pointer: Point | null): Point[] | null {
    if (typeof positionUtils.buildCascadeSafeTriangle !== 'function') {
      return null;
    }
    const parentEntry = getBookmarkCascadeLevelEntry(levelIndex);
    const childEntry = getBookmarkCascadeLevelEntry(levelIndex + 1);
    if (!parentEntry || !parentEntry.activeKey || !childEntry || !childEntry.levelElement) {
      return null;
    }
    const childRect = getBookmarkCascadeElementRect(childEntry.levelElement);
    if (!childRect) {
      return null;
    }
    return positionUtils.buildCascadeSafeTriangle({
      pointer,
      submenuRect: childRect,
      side: getBookmarkCascadeSubmenuSide(childEntry, childRect)
    });
  }

  function isBookmarkCascadePointNearSubmenuEdge(point: Point | null, parentRect: Rect | null, side: 'left' | 'right'): boolean {
    if (!point || !parentRect || parentRect.width <= 0) {
      return false;
    }
    const edgeZone = Math.min(
      BOOKMARK_CASCADE_SAFE_EDGE_ZONE_PX,
      Math.max(56, parentRect.width * 0.43)
    );
    return side === 'left'
      ? point.x <= parentRect.left + edgeZone
      : point.x >= parentRect.right - edgeZone;
  }

  // Whether the pointer may be on its way into the level's open submenu.
  function shouldProtectBookmarkCascadeLevel(levelIndex: number, point?: Point | null): boolean {
    if (typeof positionUtils.isPointInsideCascadeSafeTriangle !== 'function') {
      return false;
    }
    const currentPoint = point || bookmarkCascadePointer;
    if (!currentPoint) {
      return false;
    }
    const parentEntry = getBookmarkCascadeLevelEntry(levelIndex);
    const childEntry = getBookmarkCascadeLevelEntry(levelIndex + 1);
    if (!parentEntry || !parentEntry.activeKey || !childEntry || !childEntry.levelElement) {
      return false;
    }
    const childRect = getBookmarkCascadeElementRect(childEntry.levelElement);
    if (isPointInsideRect(currentPoint, childRect)) {
      return true;
    }
    const submenuSide = getBookmarkCascadeSubmenuSide(childEntry, childRect);
    const parentRect = getBookmarkCascadeElementRect(parentEntry.levelElement);
    if (!isBookmarkCascadePointNearSubmenuEdge(currentPoint, parentRect, submenuSide)) {
      return false;
    }
    const triangle = buildBookmarkCascadeSafeTriangleForLevel(
      levelIndex,
      bookmarkCascadePreviousPointer || bookmarkCascadePointer
    );
    return positionUtils.isPointInsideCascadeSafeTriangle(currentPoint, triangle);
  }

  function getBookmarkCascadeViewport(): { width: number; height: number } {
    const docElement = documentObj ? documentObj.documentElement : null;
    return {
      width: (windowObj && windowObj.innerWidth) || (docElement && docElement.clientWidth) || 0,
      height: (windowObj && windowObj.innerHeight) || (docElement && docElement.clientHeight) || 0
    };
  }

  function cancelBookmarkCascadeHoverIntent(): void {
    if (bookmarkCascadeHoverIntentTimer) {
      clearTimer(bookmarkCascadeHoverIntentTimer);
      bookmarkCascadeHoverIntentTimer = 0;
    }
    if (bookmarkCascadeHoverIntentTask) {
      setRowSuppressed(bookmarkCascadeHoverIntentTask.levelIndex, bookmarkCascadeHoverIntentTask.key, false);
    }
    bookmarkCascadeHoverIntentTask = null;
  }

  function cancelBookmarkCascadeHoverIntentFor(triggerElement: HTMLElement): void {
    if (bookmarkCascadeHoverIntentTask &&
        bookmarkCascadeHoverIntentTask.triggerElement === triggerElement) {
      cancelBookmarkCascadeHoverIntent();
    }
  }

  function runBookmarkCascadeHoverIntentTask(): void {
    batch(runHoverIntentTaskNow);
  }

  function runHoverIntentTaskNow(): void {
    const task = bookmarkCascadeHoverIntentTask;
    bookmarkCascadeHoverIntentTimer = 0;
    if (!task || !bookmarkCascadeMenu || !task.triggerElement || !task.triggerElement.isConnected) {
      cancelBookmarkCascadeHoverIntent();
      return;
    }
    if (!task.allowWhenSuppressed && isBookmarkCascadeHoverSuppressed(task.triggerElement, null)) {
      cancelBookmarkCascadeHoverIntent();
      setRowSuppressed(task.levelIndex, task.key, true);
      return;
    }
    const point = bookmarkCascadePointer;
    const triggerRect = getBookmarkCascadeElementRect(task.triggerElement);
    const triggerHovered = task.triggerElement.matches(':hover');
    const pointInsideTrigger = point && triggerRect && isPointInsideRect(point, triggerRect);
    const now = getNow();
    const safeRemaining = task.safeUntil !== undefined && Number.isFinite(task.safeUntil) ? task.safeUntil - now : 0;
    if (shouldProtectBookmarkCascadeLevel(task.levelIndex, point) && safeRemaining > 0) {
      const recheckDelay = Math.max(16, Math.min(BOOKMARK_CASCADE_SAFE_RECHECK_MS, safeRemaining));
      bookmarkCascadeHoverIntentTimer = setTimer(
        runBookmarkCascadeHoverIntentTask,
        recheckDelay
      );
      return;
    }
    if (point && triggerRect && !pointInsideTrigger && !triggerHovered) {
      cancelBookmarkCascadeHoverIntent();
      return;
    }
    const run = task.run;
    cancelBookmarkCascadeHoverIntent();
    run();
  }

  function scheduleBookmarkCascadeHoverIntent(task: HoverIntentTask, event: PointerEvent | HoverPointer | null): void {
    if (!task.allowWhenSuppressed && isBookmarkCascadeHoverSuppressed(task.triggerElement, event)) {
      cancelBookmarkCascadeHoverIntent();
      setRowSuppressed(task.levelIndex, task.key, true);
      return;
    }
    const pointerType = event && typeof event.pointerType === 'string' ? event.pointerType : '';
    if (pointerType === 'touch') {
      cancelBookmarkCascadeHoverIntent();
      task.run();
      return;
    }
    updateBookmarkCascadePointer(event);
    cancelBookmarkCascadeHoverIntent();
    const delayMs = BOOKMARK_CASCADE_HOVER_DELAY_MS;
    const scheduledAt = getNow();
    bookmarkCascadeHoverIntentTask = {
      ...task,
      safeUntil: scheduledAt + BOOKMARK_CASCADE_SAFE_MAX_MS
    };
    bookmarkCascadeHoverIntentTimer = setTimer(runBookmarkCascadeHoverIntentTask, delayMs);
  }

  function cancelBookmarkCascadeDelayedClose(): void {
    if (bookmarkCascadeCloseTimer) {
      clearTimer(bookmarkCascadeCloseTimer);
      bookmarkCascadeCloseTimer = 0;
    }
  }

  function scheduleBookmarkCascadeDelayedClose(): void {
    if (!bookmarkCascadeMenu || bookmarkCascadeDragMode || bookmarkCascadeCloseTimer) {
      return;
    }
    bookmarkCascadeCloseTimer = setTimer(() => {
      bookmarkCascadeCloseTimer = 0;
      close();
    }, BOOKMARK_CASCADE_CLOSE_DELAY_MS);
  }

  function isBookmarkCascadePointInsideInteractiveArea(point: Point | null): boolean {
    if (!point || !bookmarkCascadeMenu) {
      return false;
    }
    const anchorRect = getBookmarkCascadeElementRect(bookmarkCascadeAnchor, {
      ignoreElementTranslate: true
    });
    if (isPointInsideRect(point, anchorRect)) {
      return true;
    }
    const rootEntry = getBookmarkCascadeLevelEntry(0);
    const rootRect = rootEntry ? getBookmarkCascadeElementRect(rootEntry.levelElement) : null;
    if (bookmarkCascadeDragMode && anchorRect && rootRect) {
      const bridgePadding = 10;
      const bridgeRect = {
        left: Math.min(anchorRect.left, rootRect.left) - bridgePadding,
        right: Math.max(anchorRect.right, rootRect.right) + bridgePadding,
        top: Math.min(anchorRect.top, rootRect.top) - bridgePadding,
        bottom: Math.max(anchorRect.bottom, rootRect.bottom) + bridgePadding
      };
      if (isPointInsideRect(point, bridgeRect)) {
        return true;
      }
    }
    for (let index = 0; index < bookmarkCascadeLevels.length; index += 1) {
      const entry = bookmarkCascadeLevels[index];
      if (entry && isPointInsideRect(point, getBookmarkCascadeElementRect(entry.levelElement))) {
        return true;
      }
      if (entry && shouldProtectBookmarkCascadeLevel(entry.levelIndex, point)) {
        return true;
      }
    }
    return false;
  }

  function handleBookmarkCascadeDocumentPointerMove(event: PointerEvent): void {
    if (!bookmarkCascadeMenu) {
      return;
    }
    const point = updateBookmarkCascadePointer(event);
    if (isBookmarkCascadePointInsideInteractiveArea(point)) {
      cancelBookmarkCascadeDelayedClose();
      return;
    }
    scheduleBookmarkCascadeDelayedClose();
  }

  function cancelBookmarkCascadeOpenRequest(): void {
    const pendingAnchor = bookmarkCascadeOpenRequest && bookmarkCascadeOpenRequest.anchorElement;
    bookmarkCascadeOpenRequest = null;
    if (pendingAnchor && pendingAnchor !== bookmarkCascadeAnchor) {
      setAnchorVisualActive(pendingAnchor, false);
    }
  }

  function prefersReducedMotion(): boolean {
    return Boolean(windowObj && typeof windowObj.matchMedia === 'function' &&
      windowObj.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // After a drop the menu folds back the way it opened instead of vanishing,
  // while the shortcuts settle around the site that left or joined it. It
  // takes no pointer and is no longer the open menu while it fades.
  const BOOKMARK_CASCADE_CLOSE_MS = 220;
  function foldBookmarkCascadeMenuAway(menu: HTMLElement, view: CascadeMenuView | null): void {
    menu.setAttribute('data-closing', 'true');
    menu.setAttribute('aria-hidden', 'true');
    // A drag-mode or refreshing menu holds its levels still; this one moves.
    menu.removeAttribute('data-drag-mode');
    menu.removeAttribute('data-refreshing');
    menu.style.pointerEvents = 'none';
    queryHtmlElements(menu, '[data-open="true"]').forEach((level) => {
      if (menuSurface && typeof menuSurface.close === 'function') {
        menuSurface.close(level);
      } else {
        level.setAttribute('data-open', 'false');
      }
    });
    const remove = () => {
      if (view) view.destroy();
      if (menu.parentNode) menu.parentNode.removeChild(menu);
    };
    if (windowObj && typeof windowObj.setTimeout === 'function') {
      windowObj.setTimeout(remove, BOOKMARK_CASCADE_CLOSE_MS);
    } else {
      remove();
    }
  }

  // `{ animate: true }` folds the menu away rather than removing it at once.
  function close(closeOptions?: { animate?: boolean; restoreFocus?: boolean }): void {
    const optionsForClose = closeOptions || {};
    cancelBookmarkCascadeOpenRequest();
    cancelBookmarkCascadeHoverIntent();
    cancelBookmarkCascadeDelayedClose();
    hideCursorTooltip();
    hideTopActionTooltip();
    if (copyTooltipController) {
      copyTooltipController.hide();
    }
    bookmarkCascadeKeyboardLevelIndex = 0;
    const anchorToRestore = bookmarkCascadeAnchor;
    clearBookmarkCascadeDragTarget();
    bookmarkCascadeDragMode = false;
    if (anchorToRestore) {
      setAnchorVisualActive(anchorToRestore, false);
    }
    bookmarkCascadeAnchor = null;
    bookmarkCascadeLevels = [];
    levelElements.clear();
    renderPending = false;
    const menuToRemove = bookmarkCascadeMenu;
    const viewToRemove = menuView;
    bookmarkCascadeMenu = null;
    menuView = null;
    if (menuToRemove && menuToRemove.parentNode && optionsForClose.animate && !prefersReducedMotion()) {
      foldBookmarkCascadeMenuAway(menuToRemove, viewToRemove);
    } else {
      if (viewToRemove) viewToRemove.destroy();
      if (menuToRemove && menuToRemove.parentNode) menuToRemove.parentNode.removeChild(menuToRemove);
    }
    setDocumentListenersAttached(false);
    bookmarkCascadePointer = null;
    bookmarkCascadePreviousPointer = null;
    if (optionsForClose.restoreFocus && anchorToRestore) {
      try {
        anchorToRestore.focus({ preventScroll: true });
      } catch (error) {
        anchorToRestore.focus();
      }
    }
  }

  function getBookmarkCascadeElementRect(
    element: HTMLElement | null,
    rectOptions?: { ignoreElementTranslate?: boolean }
  ): Rect | null {
    if (!element) {
      return null;
    }
    const rect = element.getBoundingClientRect();
    const width = element.offsetWidth || rect.width || 0;
    const height = element.offsetHeight || rect.height || 0;
    const normalizeMeasuredRect = (sourceRect: Pick<Rect, 'left' | 'top'>): Rect => ({
      left: sourceRect.left,
      right: sourceRect.left + width,
      top: sourceRect.top,
      bottom: sourceRect.top + height,
      width,
      height
    });
    if (rectOptions &&
        rectOptions.ignoreElementTranslate &&
        typeof positionUtils.getTranslateNeutralRect === 'function') {
      const style = (windowObj && typeof windowObj.getComputedStyle === 'function')
        ? windowObj.getComputedStyle(element)
        : null;
      return normalizeMeasuredRect(positionUtils.getTranslateNeutralRect(
        rect,
        style && style.transform
      ));
    }
    return normalizeMeasuredRect(rect);
  }

  function lockBookmarkCascadeLevelWidth(levelElement: HTMLElement): number {
    const rect = levelElement.getBoundingClientRect();
    const measuredWidth = Number(levelElement.offsetWidth) || Number(rect.width) || 0;
    if (!Number.isFinite(measuredWidth) || measuredWidth <= 0) {
      return 0;
    }
    const lockedWidth = Math.ceil(measuredWidth);
    levelElement.style.setProperty('width', `${lockedWidth}px`);
    return lockedWidth;
  }

  function openBookmarkCascadeLevelSurface(levelElement: HTMLElement): void {
    if (!levelElement) {
      return;
    }
    if (bookmarkCascadeRefreshInProgress) {
      levelElement.setAttribute('data-open', 'true');
      return;
    }
    if (menuSurface && typeof menuSurface.open === 'function') {
      menuSurface.open(levelElement, { requestAnimationFrame: requestFrame });
      return;
    }
    levelElement.setAttribute('data-open', 'true');
  }

  function applyBookmarkCascadePlacement(levelElement: HTMLElement, placement: RootPlacement | SubmenuPlacement): void {
    levelElement.style.setProperty('left', `${Math.round(placement.left)}px`);
    levelElement.style.setProperty('top', `${Math.round(placement.top)}px`);
    if ('side' in placement) {
      levelElement.setAttribute('data-side', placement.side);
    } else {
      levelElement.setAttribute('data-horizontal', placement.horizontal);
      levelElement.setAttribute('data-vertical', placement.vertical);
    }
  }

  function positionBookmarkCascadeLevel(entry: CascadeLevelEntry): void {
    if (!entry || !entry.levelElement || !bookmarkCascadeMenu) {
      return;
    }
    const levelRect = getBookmarkCascadeElementRect(entry.levelElement);
    if (!levelRect) {
      return;
    }
    const viewport = getBookmarkCascadeViewport();
    const viewportTopPadding = Math.max(8, Number(getViewportTopPadding()) || 8);
    if (entry.levelIndex <= 0) {
      const anchorRect = getBookmarkCascadeElementRect(bookmarkCascadeAnchor, {
        ignoreElementTranslate: true
      });
      if (!anchorRect || typeof positionUtils.placeRootCascadeMenu !== 'function') {
        return;
      }
      const placement = positionUtils.placeRootCascadeMenu({
        anchorRect,
        menuRect: levelRect,
        viewport,
        spacing: 8,
        viewportPadding: 8,
        viewportTopPadding
      });
      entry.placement = placement;
      applyBookmarkCascadePlacement(entry.levelElement, placement);
      return;
    }
    const parentEntry = getBookmarkCascadeLevelEntry(entry.levelIndex - 1);
    const parentLevelRect = getBookmarkCascadeElementRect(parentEntry ? parentEntry.levelElement : null);
    const triggerRect = getBookmarkCascadeElementRect(getTriggerElement(entry));
    if (!parentLevelRect || !triggerRect || typeof positionUtils.placeCascadeSubmenu !== 'function') {
      return;
    }
    const placement = positionUtils.placeCascadeSubmenu({
      parentLevelRect,
      triggerRect,
      menuRect: levelRect,
      viewport,
      spacing: BOOKMARK_CASCADE_SUBMENU_GAP_PX,
      viewportPadding: 8,
      viewportTopPadding
    });
    entry.placement = placement;
    applyBookmarkCascadePlacement(entry.levelElement, placement);
  }

  function positionBookmarkCascadeLevels(): void {
    if (!bookmarkCascadeMenu || bookmarkCascadeLevels.length === 0) {
      return;
    }
    bookmarkCascadeLevels.forEach((entry) => {
      positionBookmarkCascadeLevel(entry);
    });
  }

  function getBookmarkCascadeItems(folderId: unknown): readonly BookmarkItem[] {
    const id = String(folderId || '');
    const items = id ? getItems(id) : [];
    return Array.isArray(items) ? items : [];
  }

  function clearBookmarkCascadeLevelsFrom(levelIndex: number): void {
    if (!bookmarkCascadeMenu) {
      return;
    }
    const safeLevelIndex = Math.max(0, Math.floor(levelIndex) || 0);
    const remaining = bookmarkCascadeLevels.filter((entry) => entry.levelIndex < safeLevelIndex);
    if (remaining.length !== bookmarkCascadeLevels.length) {
      bookmarkCascadeLevels = remaining;
      invalidate();
    }
    if (bookmarkCascadeKeyboardLevelIndex >= safeLevelIndex) {
      bookmarkCascadeKeyboardLevelIndex = Math.max(0, safeLevelIndex - 1);
    }
    if (bookmarkCascadeHoverIntentTask &&
        bookmarkCascadeHoverIntentTask.levelIndex >= safeLevelIndex) {
      cancelBookmarkCascadeHoverIntent();
    }
  }

  function getBookmarkCascadeLevelItems(levelElement: HTMLElement | null | undefined): HTMLElement[] {
    if (!levelElement) {
      return [];
    }
    return queryHtmlElements(levelElement, '.x-nt-bookmark-cascade-item');
  }

  function getBookmarkCascadeRowAnimationKey(entry: CascadeLevelEntry, button: HTMLElement): string {
    const folderId = String(entry.folderId || '');
    const bookmarkId = String(button.getAttribute('data-bookmark-id') || '');
    return folderId && bookmarkId ? `${folderId}::${bookmarkId}` : '';
  }

  function getBookmarkCascadeRowRectMap(): Map<string, Rect> {
    const rects = new Map<string, Rect>();
    bookmarkCascadeLevels.forEach((entry) => {
      getBookmarkCascadeLevelItems(entry.levelElement).forEach((button) => {
        const key = getBookmarkCascadeRowAnimationKey(entry, button);
        const row = getRow(button);
        const rect = getBookmarkCascadeElementRect(row || button);
        if (key && rect) {
          rects.set(key, rect);
        }
      });
    });
    return rects;
  }

  function clearBookmarkCascadeRowLayoutAnimation(row: HTMLElement): void {
    const timer = rowLayoutAnimationTimers.get(row);
    if (timer) {
      clearTimer(timer);
      rowLayoutAnimationTimers.delete(row);
    }
    row.style.removeProperty('transition');
    row.style.removeProperty('transform');
    row.style.removeProperty('will-change');
  }

  // Rows that moved slide from where they were; a dragged row from where it
  // was dropped.
  function playBookmarkCascadeRowLayoutAnimation(
    beforeRects: ReadonlyMap<string, Rect>,
    animationOptions?: CascadeRefreshOptions
  ): boolean {
    if (!bookmarkCascadeMenu) {
      return false;
    }
    const optionsForAnimation = animationOptions || {};
    const draggedBookmarkId = String(optionsForAnimation.draggedBookmarkId || '');
    const draggedRect = optionsForAnimation.draggedRect || null;
    const shifts: { row: HTMLElement; dx: number; dy: number }[] = [];
    bookmarkCascadeLevels.forEach((entry) => {
      getBookmarkCascadeLevelItems(entry.levelElement).forEach((button) => {
        const bookmarkId = String(button.getAttribute('data-bookmark-id') || '');
        const key = getBookmarkCascadeRowAnimationKey(entry, button);
        const row = getRow(button);
        const before = bookmarkId && bookmarkId === draggedBookmarkId && draggedRect
          ? draggedRect
          : beforeRects.get(key);
        const after = getBookmarkCascadeElementRect(row || button);
        if (!row || !before || !after) {
          return;
        }
        const dx = Number(before.left) - Number(after.left);
        const dy = Number(before.top) - Number(after.top);
        if (!Number.isFinite(dx) || !Number.isFinite(dy) ||
            (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5)) {
          return;
        }
        clearBookmarkCascadeRowLayoutAnimation(row);
        shifts.push({ row, dx, dy });
      });
    });
    if (shifts.length === 0) {
      return false;
    }
    shifts.forEach(({ row, dx, dy }) => {
      row.style.setProperty('transition', 'none');
      row.style.setProperty('transform', `translate3d(${dx}px, ${dy}px, 0)`);
      row.style.setProperty('will-change', 'transform');
    });
    void bookmarkCascadeMenu.offsetHeight;
    requestFrame(() => {
      shifts.forEach(({ row }) => {
        if (!row.isConnected) {
          return;
        }
        row.style.setProperty(
          'transition',
          `transform ${BOOKMARK_CASCADE_REORDER_ANIMATION_MS}ms ${BOOKMARK_CASCADE_REORDER_EASING}`
        );
        row.style.setProperty('transform', 'translate3d(0, 0, 0)');
        rowLayoutAnimationTimers.set(row, setTimer(() => {
          rowLayoutAnimationTimers.delete(row);
          clearBookmarkCascadeRowLayoutAnimation(row);
        }, BOOKMARK_CASCADE_REORDER_ANIMATION_MS + 80));
      });
    });
    return true;
  }

  function setRowSuppressed(levelIndex: number, key: string, suppressed: boolean): void {
    const entry = getBookmarkCascadeLevelEntry(levelIndex);
    if (!entry || !key || entry.suppressedKeys.has(key) === suppressed) {
      return;
    }
    if (suppressed) {
      entry.suppressedKeys.add(key);
    } else {
      entry.suppressedKeys.delete(key);
    }
    invalidate();
  }

  function focusBookmarkCascadeItem(itemButton: HTMLElement): void {
    try {
      itemButton.focus({ preventScroll: true });
    } catch (error) {
      itemButton.focus();
    }
  }

  // Selects a row (or none); `focus` also moves keyboard focus to it.
  function setActiveRow(entry: CascadeLevelEntry, key: string, options?: { focus?: boolean }): void {
    entry.activeKey = key;
    entry.suppressedKeys.clear();
    invalidate();
    if (!key || !options || !options.focus) {
      return;
    }
    bookmarkCascadeKeyboardLevelIndex = entry.levelIndex;
    flushRender();
    const button = getRowButton(entry, key);
    if (button) {
      focusBookmarkCascadeItem(button);
    }
  }

  // The pointer entered another row (or none): the selected row and its
  // submenu give way, unless the pointer may be heading into that submenu.
  function clearBookmarkCascadePointerActiveItem(entry: CascadeLevelEntry, nextKey: string, event: PointerEvent): void {
    if (!entry.activeKey || entry.activeKey === nextKey) {
      return;
    }
    const point = updateBookmarkCascadePointer(event);
    if (shouldProtectBookmarkCascadeLevel(entry.levelIndex, point)) {
      setRowSuppressed(entry.levelIndex, nextKey, true);
      return;
    }
    clearBookmarkCascadeLevelsFrom(entry.levelIndex + 1);
    setActiveRow(entry, '');
  }

  function selectFirstBookmarkCascadeItemInLevel(levelIndex: number, options?: { focus?: boolean }): boolean {
    const entry = getBookmarkCascadeLevelEntry(levelIndex);
    const firstRow = entry ? entry.rows[0] : null;
    if (!entry || !firstRow) {
      return false;
    }
    setActiveRow(entry, firstRow.key, options);
    return true;
  }

  function getBookmarkCascadeKeyboardEntry(): CascadeLevelEntry | null {
    const activeElement = documentObj ? documentObj.activeElement : null;
    if (bookmarkCascadeMenu && activeElement && bookmarkCascadeMenu.contains(activeElement)) {
      for (let index = bookmarkCascadeLevels.length - 1; index >= 0; index -= 1) {
        const entry = bookmarkCascadeLevels[index];
        if (entry && entry.levelElement && entry.levelElement.contains(activeElement)) {
          return entry;
        }
      }
    }
    return getBookmarkCascadeLevelEntry(bookmarkCascadeKeyboardLevelIndex) ||
      bookmarkCascadeLevels[bookmarkCascadeLevels.length - 1] ||
      null;
  }

  function moveBookmarkCascadeKeyboardSelection(direction: number): boolean {
    const entry = getBookmarkCascadeKeyboardEntry();
    if (!entry || entry.rows.length === 0) {
      return false;
    }
    const count = entry.rows.length;
    const currentIndex = entry.rows.findIndex((row) => row.key === entry.activeKey);
    const offset = direction < 0 ? -1 : 1;
    const nextIndex = currentIndex < 0
      ? (offset > 0 ? 0 : count - 1)
      : (currentIndex + offset + count) % count;
    clearBookmarkCascadeLevelsFrom(entry.levelIndex + 1);
    setActiveRow(entry, entry.rows[nextIndex].key, { focus: true });
    return true;
  }

  function enterBookmarkCascadeKeyboardSubmenu(): boolean {
    const entry = getBookmarkCascadeKeyboardEntry();
    if (!entry) {
      return false;
    }
    const row = getRowContent(entry, entry.activeKey) || entry.rows[0] || null;
    if (!row || !row.isFolder) {
      return false;
    }
    openNestedLevel(entry, row.key, { focusChild: true });
    return true;
  }

  function leaveBookmarkCascadeKeyboardSubmenu(): boolean {
    const entry = getBookmarkCascadeKeyboardEntry();
    if (!entry || entry.levelIndex <= 0) {
      return false;
    }
    const parentEntry = getBookmarkCascadeLevelEntry(entry.levelIndex - 1);
    const parentKey = entry.triggerKey || (parentEntry ? parentEntry.activeKey : '');
    clearBookmarkCascadeLevelsFrom(entry.levelIndex);
    if (parentEntry && parentKey) {
      setActiveRow(parentEntry, parentKey, { focus: true });
    }
    return true;
  }

  function isBookmarkCascadeKeyboardTarget(target: EventTarget | null): boolean {
    if (!target) {
      return true;
    }
    const node = isNode(target) ? target : null;
    if (bookmarkCascadeMenu && bookmarkCascadeMenu.contains(node)) {
      return true;
    }
    if (bookmarkCascadeAnchor &&
        (target === bookmarkCascadeAnchor || bookmarkCascadeAnchor.contains(node))) {
      return true;
    }
    return Boolean(documentObj && (target === documentObj.body || target === documentObj.documentElement));
  }

  function handleBookmarkCascadeKeyboardNavigation(event: KeyboardEvent): boolean {
    if (!event || !bookmarkCascadeMenu || !isBookmarkCascadeKeyboardTarget(event.target)) {
      return false;
    }
    let handled = false;
    if (event.key === 'ArrowDown') {
      handled = moveBookmarkCascadeKeyboardSelection(1);
    } else if (event.key === 'ArrowUp') {
      handled = moveBookmarkCascadeKeyboardSelection(-1);
    } else if (event.key === 'ArrowRight') {
      handled = enterBookmarkCascadeKeyboardSubmenu();
    } else if (event.key === 'ArrowLeft') {
      handled = leaveBookmarkCascadeKeyboardSubmenu();
    }
    if (!handled) {
      return false;
    }
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  function getBrowserFaviconCandidateForBookmark(url: string, host: string): string {
    const pageUrl = String(url || '').trim();
    if (!pageUrl) {
      return '';
    }
    if (!/^https?:\/\//i.test(pageUrl)) {
      return /^[a-z][a-z0-9+.-]*:/i.test(pageUrl)
        ? getChromeFaviconUrl(pageUrl)
        : '';
    }
    return host && isLocalNetworkHost(host)
      ? getChromeFaviconUrl(pageUrl)
      : '';
  }

  function getPrimaryFaviconCandidateForBookmark(url: string): string {
    return getBrowserPageFaviconUrl(url);
  }

  function shouldOpenUrlInBackground(event: Event | { metaKey?: boolean; ctrlKey?: boolean } | null | undefined): boolean {
    if (!event) {
      return false;
    }
    const button = 'button' in event ? Number(event.button) : 0;
    return Boolean(('metaKey' in event && event.metaKey) || ('ctrlKey' in event && event.ctrlKey) || button === 1);
  }

  function openBookmarkCascadeUrl(url: string, event: Event, anchor: BookmarkMenuAnchor | null): void {
    openUrl(url, {
      openInBackgroundTab: shouldOpenUrlInBackground(event),
      openInOtherTab: 'altKey' in event && event.altKey === true,
      anchor
    });
  }


  function createRowContent(item: BookmarkItem, index: number): CascadeRowContent {
    const isFolder = item.type === 'folder';
    const title = sanitizeDisplayText(
      item.title || (item.url ? getUrlDisplay(item.url) : t('bookmarks_heading', 'Bookmarks'))
    );
    const id = String(item.id || '');
    let iconUrl = '';
    let iconAlt = '';
    if (!isFolder) {
      const host = item.host || getHostFromUrl(item.themeUrl || item.url || '') || '';
      iconAlt = getSiteDisplayName(host, item.title) || t('site_icon_alt', '站点');
      iconUrl = getItemIconUrl(item, bookmarkCascadeAnchor);
    }
    return {
      key: getRowKey(item, index),
      item,
      isFolder,
      title,
      folderIconSuffix: isFolder ? `${id || 'folder'}-cascade-${index}` : '',
      iconUrl,
      // Lumno's black glyph icons need inverting on dark menus.
      iconMonochrome: /\/glyph-(?:gh|gpt|mdn|wk|zw)\.svg(?:[?#]|$)/.test(iconUrl),
      iconAlt
    };
  }

  // Opens a level for the folder, replacing this level and any below it.
  function createBookmarkCascadeLevel(
    folderId: string,
    levelIndex: number,
    triggerKey: string,
    folderTitle: string
  ): CascadeLevelEntry | null {
    if (!bookmarkCascadeMenu || !menuView) {
      return null;
    }
    const safeLevelIndex = Math.max(0, Math.floor(levelIndex) || 0);
    clearBookmarkCascadeLevelsFrom(safeLevelIndex);
    const items = getBookmarkCascadeItems(folderId).filter((item) => {
      return Boolean(item && (item.url || item.type === 'folder'));
    });
    levelSerial += 1;
    const entry: CascadeLevelEntry = {
      key: `${safeLevelIndex}:${String(folderId || '')}:${levelSerial}`,
      folderId: String(folderId || ''),
      folderTitle: String(folderTitle || ''),
      levelIndex: safeLevelIndex,
      rows: items.map(createRowContent),
      triggerKey: safeLevelIndex > 0 ? triggerKey : '',
      activeKey: '',
      suppressedKeys: new Set(),
      levelElement: null,
      surfaceOpened: false
    };
    bookmarkCascadeLevels.push(entry);
    invalidate();
    return entry;
  }

  // Opens a folder row's submenu, or keeps the one already open for it.
  function openNestedLevel(entry: CascadeLevelEntry, key: string, openOptions?: { focusChild?: boolean }): void {
    const row = getRowContent(entry, key);
    if (!row || !row.isFolder) {
      return;
    }
    const existingChild = getBookmarkCascadeLevelEntry(entry.levelIndex + 1);
    const childEntry = existingChild && existingChild.folderId === String(row.item.id || '')
      ? existingChild
      : null;
    if (entry.activeKey !== key || !childEntry) {
      setActiveRow(entry, key);
    }
    const openedEntry = childEntry ||
      createBookmarkCascadeLevel(String(row.item.id || ''), entry.levelIndex + 1, key, row.item.title || '');
    if (openedEntry && openOptions && openOptions.focusChild) {
      selectFirstBookmarkCascadeItemInLevel(openedEntry.levelIndex, { focus: true });
    }
  }

  function activateLeafItem(entry: CascadeLevelEntry, key: string): void {
    setActiveRow(entry, key);
    clearBookmarkCascadeLevelsFrom(entry.levelIndex + 1);
  }

  function navigateLeafItem(row: CascadeRowContent, event: Event): void {
    cancelBookmarkCascadeHoverIntent();
    hideCursorTooltip();
    // Closing the menu clears its anchor.
    const anchor = bookmarkCascadeAnchor;
    if (!shouldOpenUrlInBackground(event)) {
      close();
    }
    openBookmarkCascadeUrl(row.item.url, event, anchor);
  }

  // Finds the row a view event came from; the menu may have changed since.
  function withRow(
    levelIndex: number,
    key: string,
    run: (entry: CascadeLevelEntry, row: CascadeRowContent) => void
  ): void {
    const entry = getBookmarkCascadeLevelEntry(levelIndex);
    const row = entry ? getRowContent(entry, key) : null;
    if (entry && row) {
      batch(() => run(entry, row));
    }
  }

  const viewHandlers: CascadeMenuHandlers = {
    onLevelElement(levelKey, element) {
      if (element) {
        levelElements.set(levelKey, element);
      } else {
        levelElements.delete(levelKey);
      }
    },
    onRowPointerEnter(levelIndex, key, event, button) {
      withRow(levelIndex, key, (entry, row) => {
        clearBookmarkCascadePointerActiveItem(entry, key, event);
        scheduleBookmarkCascadeHoverIntent({
          levelIndex,
          key,
          triggerElement: button,
          run: row.isFolder
            ? () => openNestedLevel(entry, key)
            : () => activateLeafItem(entry, key)
        }, event);
      });
    },
    onRowPointerLeave(levelIndex, key, event, button) {
      withRow(levelIndex, key, (entry, row) => {
        // Moving onto the row's copy button stays on the row.
        const rowElement = getRow(button);
        if (!row.isFolder && rowElement && isNode(event.relatedTarget) && rowElement.contains(event.relatedTarget)) {
          return;
        }
        cancelBookmarkCascadeHoverIntentFor(button);
        setRowSuppressed(levelIndex, key, false);
        clearBookmarkCascadePointerActiveItem(entry, '', event);
      });
    },
    onRowPointerDown(levelIndex, key, event, button) {
      withRow(levelIndex, key, (entry, row) => {
        onItemPointerDown({
          event,
          item: row.item,
          element: button,
          parentFolderId: String(row.item.parentId || entry.folderId || '')
        });
      });
    },
    onRowContextMenu(levelIndex, key, event, button) {
      withRow(levelIndex, key, (entry, row) => {
        onItemContextMenu({
          event,
          item: row.item,
          element: button,
          sourceKind: 'cascade',
          parentFolderId: String(row.item.parentId || entry.folderId || '')
        });
      });
    },
    onRowFocus(levelIndex, key) {
      withRow(levelIndex, key, (entry) => {
        cancelBookmarkCascadeHoverIntent();
        activateLeafItem(entry, key);
      });
    },
    onRowClick(levelIndex, key, event) {
      withRow(levelIndex, key, (entry, row) => {
        if (row.isFolder) {
          cancelBookmarkCascadeHoverIntent();
          openNestedLevel(entry, key);
          return;
        }
        if (isActivationSuppressed()) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        navigateLeafItem(row, event);
      });
    },
    onRowAuxClick(levelIndex, key, event) {
      withRow(levelIndex, key, (_entry, row) => {
        if (row.isFolder || Number(event.button) !== 1) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (!isActivationSuppressed()) {
          navigateLeafItem(row, event);
        }
      });
    },
    onRowKeyDown(levelIndex, key, event) {
      withRow(levelIndex, key, (entry, row) => {
        if (row.isFolder) {
          if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            cancelBookmarkCascadeHoverIntent();
            openNestedLevel(entry, key);
          }
          return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          navigateLeafItem(row, event);
        }
      });
    },
    onCopyShow(levelIndex, key, _event, copyButton) {
      withRow(levelIndex, key, (entry) => {
        cancelBookmarkCascadeHoverIntent();
        hideCursorTooltip();
        activateLeafItem(entry, key);
        if (copyTooltipController) {
          copyTooltipController.show(copyButton, t('bookmarks_copy_url', 'Copy link'), {
            placement: 'top',
            maxWidth: 200,
            spacing: 8
          });
        }
      });
    },
    onCopyHide() {
      if (copyTooltipController) {
        copyTooltipController.hide();
      }
    },
    onCopyClick(levelIndex, key, event) {
      withRow(levelIndex, key, (_entry, row) => {
        event.preventDefault();
        event.stopPropagation();
        hideCursorTooltip();
        if (copyTooltipController) {
          copyTooltipController.hide();
        }
        Promise.resolve().then(() => copyUrl(row.item.url)).catch(noop);
      });
    },
    onSiteIconMount(levelIndex, key, image) {
      const entry = getBookmarkCascadeLevelEntry(levelIndex);
      const row = entry ? getRowContent(entry, key) : null;
      if (!row) {
        return;
      }
      const url = row.item.url;
      const host = row.item.host || getHostFromUrl(row.item.themeUrl || url || '') || '';
      attachFaviconWithFallbacks(image, url, host, {
        primaryUrl: getPrimaryFaviconCandidateForBookmark(url),
        browserUrl: getBrowserFaviconCandidateForBookmark(url, host)
      });
    },
    onSiteButtonMount(button, getTitle) {
      bindCursorTooltip(button, getTitle, {
        maxWidth: 460,
        shouldShow: (_target, event) => shouldOpenUrlInBackground(event)
      });
    },
    onFolderIconMount(icon) {
      initFolderPathMorph(icon);
    },
    onFolderIconOpenChange(icon, open) {
      playFolderPathMorph(icon, open);
    }
  };

  // Opens the folder's menu from the anchor; `toggle` closes it when it is
  // already open, `dragMode` opens it as a drop target, and `shouldOpen`
  // may still cancel it once the bookmarks are read.
  function open(
    item: { id?: unknown; title?: string } | null,
    anchorElement: BookmarkMenuAnchor | null,
    openOptions?: { dragMode?: boolean; toggle?: boolean; shouldOpen?: () => boolean }
  ): void {
    const optionsForOpen = openOptions || {};
    const dragMode = optionsForOpen.dragMode === true;
    const folderId = String(item && item.id || '').trim();
    const folderTitle = String(item && item.title || '');
    if (!folderId || !anchorElement || !documentObj || !documentObj.body) {
      return;
    }
    if (optionsForOpen.toggle === true && !dragMode &&
        (isBookmarkCascadeMenuOpenFor(folderId, anchorElement, dragMode) ||
         (bookmarkCascadeOpenRequest &&
          bookmarkCascadeOpenRequest.folderId === folderId &&
          bookmarkCascadeOpenRequest.anchorElement === anchorElement &&
          bookmarkCascadeOpenRequest.dragMode === dragMode))) {
      close({ restoreFocus: true });
      return;
    }
    if (isBookmarkCascadeMenuOpenFor(folderId, anchorElement, dragMode)) {
      cancelBookmarkCascadeHoverIntent();
      cancelBookmarkCascadeDelayedClose();
      positionBookmarkCascadeLevels();
      return;
    }
    if (!dragMode && isBookmarkCascadeHoverSuppressed(anchorElement, null)) {
      setAnchorVisualActive(anchorElement, false);
      return;
    }
    cancelBookmarkCascadeOpenRequest();
    const openRequest = { folderId, anchorElement, dragMode };
    bookmarkCascadeOpenRequest = openRequest;
    Promise.resolve(ensureReady(false)).then((ready) => {
      if (bookmarkCascadeOpenRequest !== openRequest) {
        return;
      }
      bookmarkCascadeOpenRequest = null;
      if (typeof optionsForOpen.shouldOpen === 'function' && !optionsForOpen.shouldOpen()) {
        return;
      }
      if (!dragMode && isBookmarkCascadeHoverSuppressed(anchorElement, null)) {
        setAnchorVisualActive(anchorElement, false);
        return;
      }
      if (!ready || !anchorElement.isConnected || !documentObj.body) {
        setAnchorVisualActive(anchorElement, false);
        return;
      }
      if (isBookmarkCascadeMenuOpenFor(folderId, anchorElement, dragMode)) {
        cancelBookmarkCascadeHoverIntent();
        cancelBookmarkCascadeDelayedClose();
        positionBookmarkCascadeLevels();
        return;
      }
      batch(() => {
        close();
        bookmarkCascadeAnchor = anchorElement;
        setAnchorVisualActive(anchorElement, true);
        menuView = createCascadeMenu(documentObj, viewHandlers);
        bookmarkCascadeMenu = menuView.element;
        setDocumentListenersAttached(true);
        setBookmarkCascadeDragMode(dragMode);
        documentObj.body.appendChild(menuView.element);
        bookmarkCascadeKeyboardLevelIndex = 0;
        createBookmarkCascadeLevel(folderId, 0, '', folderTitle);
        if (!dragMode) {
          selectFirstBookmarkCascadeItemInLevel(0, { focus: true });
        }
      });
    });
  }

  function getBookmarkCascadeRootFolderId(): string {
    const rootEntry = getBookmarkCascadeLevelEntry(0);
    return rootEntry ? String(rootEntry.folderId || '') : '';
  }

  function isBookmarkCascadeMenuOpenFor(folderId: string, anchorElement: HTMLElement, dragMode: boolean): boolean {
    return Boolean(
      bookmarkCascadeMenu &&
      bookmarkCascadeAnchor === anchorElement &&
      getBookmarkCascadeRootFolderId() === folderId &&
      bookmarkCascadeDragMode === dragMode
    );
  }

  // Moves the open menu to a new anchor for the same folder, e.g. once the
  // card it opened from was drawn again.
  function rebindBookmarkCascadeAnchor(
    anchorElement: BookmarkMenuAnchor | null,
    rebindOptions?: { instant?: boolean }
  ): boolean {
    if (!bookmarkCascadeMenu || !anchorElement || !anchorElement.isConnected) {
      return false;
    }
    const rootFolderId = getBookmarkCascadeRootFolderId();
    const anchorFolderId = String(anchorElement.getAttribute('data-bookmark-id') || '');
    if (!rootFolderId || anchorFolderId !== rootFolderId) {
      return false;
    }
    const visualOptions = {
      instant: !rebindOptions || rebindOptions.instant !== false
    };
    const previousAnchor = bookmarkCascadeAnchor;
    if (previousAnchor && previousAnchor !== anchorElement) {
      setAnchorVisualActive(previousAnchor, false, visualOptions);
    }
    bookmarkCascadeAnchor = anchorElement;
    setAnchorVisualActive(anchorElement, true, visualOptions);
    positionBookmarkCascadeLevels();
    return true;
  }

  // Draws the open levels again from fresh bookmarks, keeping the open path.
  function refreshBookmarkCascadeMenu(refreshOptions?: CascadeRefreshOptions): Promise<boolean> {
    if (!bookmarkCascadeMenu || !bookmarkCascadeAnchor || bookmarkCascadeLevels.length === 0) {
      return Promise.resolve(false);
    }
    const menuAtRefreshStart = bookmarkCascadeMenu;
    const rowRectsBeforeRefresh = getBookmarkCascadeRowRectMap();
    const openPath = bookmarkCascadeLevels.map((entry) => ({
      folderId: entry.folderId,
      folderTitle: entry.folderTitle
    }));
    // The caller invalidates the shared runtime before refreshing. Reuse the
    // in-flight reload so the cascade and card surface cannot cancel each other.
    return Promise.resolve(ensureReady(false)).then((ready) => {
      const anchorAtRefresh = bookmarkCascadeAnchor;
      if (!ready ||
          bookmarkCascadeMenu !== menuAtRefreshStart ||
          !anchorAtRefresh ||
          !anchorAtRefresh.isConnected ||
          !openPath[0] ||
          !openPath[0].folderId) {
        return false;
      }
      cancelBookmarkCascadeHoverIntent();
      cancelBookmarkCascadeDelayedClose();
      clearBookmarkCascadeDragTarget();
      bookmarkCascadeRefreshInProgress = true;
      menuAtRefreshStart.setAttribute('data-refreshing', 'true');
      try {
        return batch(() => {
          const rootEntry = createBookmarkCascadeLevel(openPath[0].folderId, 0, '', openPath[0].folderTitle);
          if (!rootEntry) {
            return false;
          }
          for (let pathIndex = 1; pathIndex < openPath.length; pathIndex += 1) {
            const parentEntry = getBookmarkCascadeLevelEntry(pathIndex - 1);
            const pathItem = openPath[pathIndex];
            const row = parentEntry
              ? parentEntry.rows.find((candidate) => String(candidate.item.id || '') === pathItem.folderId)
              : null;
            if (!parentEntry || !row || !row.isFolder) {
              break;
            }
            openNestedLevel(parentEntry, row.key);
          }
          // Drawn while the refresh is in progress, so the levels open in place.
          flushRender();
          positionBookmarkCascadeLevels();
          playBookmarkCascadeRowLayoutAnimation(rowRectsBeforeRefresh, refreshOptions);
          return true;
        });
      } finally {
        bookmarkCascadeRefreshInProgress = false;
        requestFrame(() => {
          if (bookmarkCascadeMenu === menuAtRefreshStart) {
            menuAtRefreshStart.removeAttribute('data-refreshing');
          }
        });
      }
    });
  }

  function getBookmarkCascadeDragDropTargetAtPoint(point: Point | null): CascadeDropMatch | null {
    if (!point || !bookmarkCascadeMenu) {
      return null;
    }
    for (let levelIndex = bookmarkCascadeLevels.length - 1; levelIndex >= 0; levelIndex -= 1) {
      const entry = bookmarkCascadeLevels[levelIndex];
      const buttons = entry ? getBookmarkCascadeLevelItems(entry.levelElement) : [];
      if (entry && buttons.length === 0 && isPointInsideRect(point, getBookmarkCascadeElementRect(entry.levelElement))) {
        return { entry, kind: 'insertion', folderId: entry.folderId, index: 0,
          element: null, markerElement: null, markerPosition: 'before' };
      }
      const rows = buttons.map((button) => {
        const row = getRow(button);
        return {
          button,
          row,
          rect: getBookmarkCascadeElementRect(row || button)
        };
      });
      for (let itemIndex = 0; itemIndex < buttons.length; itemIndex += 1) {
        const rowEntry = rows[itemIndex];
        const button = rowEntry.button;
        const row = rowEntry.row;
        const rect = rowEntry.rect;
        if (!rect) {
          continue;
        }
        const previousRect = itemIndex > 0 ? rows[itemIndex - 1].rect : null;
        const nextRect = itemIndex < rows.length - 1 ? rows[itemIndex + 1].rect : null;
        const hitRect = {
          left: rect.left,
          right: rect.right,
          top: previousRect ? (previousRect.bottom + rect.top) / 2 : rect.top,
          bottom: nextRect ? (rect.bottom + nextRect.top) / 2 : rect.bottom
        };
        if (!isPointInsideRect(point, hitRect)) {
          continue;
        }
        const itemIndexValue = Number(button.getAttribute('data-bookmark-index'));
        if (!Number.isFinite(itemIndexValue)) {
          return null;
        }
        const relativeY = rect.height > 0
          ? Math.max(0, Math.min(1, (point.y - rect.top) / rect.height))
          : 0.5;
        const isFolder = button.getAttribute('data-type') === 'folder';
        if (isFolder &&
            relativeY >= BOOKMARK_CASCADE_FOLDER_DROP_MIN_RATIO &&
            relativeY <= BOOKMARK_CASCADE_FOLDER_DROP_MAX_RATIO) {
          return {
            button,
            entry,
            kind: 'cascade',
            folderId: button.getAttribute('data-bookmark-drop-folder-id') || '',
            title: button.getAttribute('data-bookmark-drop-folder-title') || '',
            element: button
          };
        }
        const markerPosition = isFolder
          ? (relativeY < BOOKMARK_CASCADE_FOLDER_DROP_MIN_RATIO ? 'before' : 'after')
          : (relativeY < 0.5 ? 'before' : 'after');
        return {
          button,
          entry,
          kind: 'insertion',
          folderId: String(entry.folderId || ''),
          index: itemIndexValue + (markerPosition === 'after' ? 1 : 0),
          element: row || button,
          markerElement: row || button,
          markerPosition
        };
      }
    }
    return null;
  }

  // Leans the rows above and below an insertion point apart.
  function syncBookmarkCascadeInsertionGap(
    row: HTMLElement | null,
    markerPosition: string,
    levelElement?: HTMLElement | null
  ): void {
    if (!crossSurfaceDrag) {
      return;
    }
    const rows = row && levelElement
      ? getBookmarkCascadeLevelItems(levelElement).map((button) => getRow(button) || button)
      : [];
    const { before, after } = crossSurfaceDrag.getInsertionGapNeighbors(rows, row, markerPosition);
    crossSurfaceDrag.setInsertionGap(insertionGapOwner, before, after);
  }

  function clearBookmarkCascadeDragTarget(): void {
    if (bookmarkCascadeDragTargetButton) {
      bookmarkCascadeDragTargetButton.removeAttribute('data-bookmark-drop-target');
    }
    if (bookmarkCascadeDragInsertionElement) {
      bookmarkCascadeDragInsertionElement.removeAttribute('data-bookmark-insert-position');
    }
    syncBookmarkCascadeInsertionGap(null, '');
    bookmarkCascadeDragTargetButton = null;
    bookmarkCascadeDragInsertionElement = null;
  }

  // Follows a drag over the open menu: marks the row it would drop on and
  // opens a folder it rests over.
  function updateBookmarkCascadeDragPointer(pointInput: PointLike | null | undefined): CascadeDragTarget | null {
    if (!bookmarkCascadeMenu || !bookmarkCascadeDragMode) {
      return null;
    }
    const point = getBookmarkCascadePointFromEvent(pointInput);
    if (!point) {
      return null;
    }
    updateBookmarkCascadePointer(pointInput);
    const match = getBookmarkCascadeDragDropTargetAtPoint(point);
    if (!match) {
      clearBookmarkCascadeDragTarget();
      const isInsideInteractiveArea = isBookmarkCascadePointInsideInteractiveArea(point);
      if (isInsideInteractiveArea) {
        cancelBookmarkCascadeDelayedClose();
      } else {
        scheduleBookmarkCascadeDelayedClose();
      }
      return isInsideInteractiveArea
        ? { kind: 'blocked', surface: 'cascade' }
        : null;
    }
    cancelBookmarkCascadeDelayedClose();
    const nextTargetButton = match.kind === 'cascade' ? match.button : null;
    const nextInsertionElement = match.kind === 'insertion' ? match.markerElement : null;
    const nextInsertionPosition = match.kind === 'insertion' ? match.markerPosition : '';
    const targetChanged = bookmarkCascadeDragTargetButton !== nextTargetButton ||
      bookmarkCascadeDragInsertionElement !== nextInsertionElement ||
      (nextInsertionElement &&
        nextInsertionElement.getAttribute('data-bookmark-insert-position') !== nextInsertionPosition);
    if (targetChanged) {
      clearBookmarkCascadeDragTarget();
      bookmarkCascadeDragTargetButton = nextTargetButton;
      bookmarkCascadeDragInsertionElement = nextInsertionElement;
      if (bookmarkCascadeDragTargetButton) {
        bookmarkCascadeDragTargetButton.setAttribute('data-bookmark-drop-target', 'true');
      }
      if (bookmarkCascadeDragInsertionElement) {
        bookmarkCascadeDragInsertionElement.setAttribute(
          'data-bookmark-insert-position',
          nextInsertionPosition
        );
      }
      syncBookmarkCascadeInsertionGap(
        bookmarkCascadeDragInsertionElement,
        nextInsertionPosition,
        match.entry.levelElement
      );
      const targetEntry = match.entry;
      const targetKey = match.kind === 'cascade' ? getRowKeyForButton(targetEntry, match.button) : '';
      const targetRow = targetKey ? getRowContent(targetEntry, targetKey) : null;
      if (targetRow && targetRow.isFolder && match.kind === 'cascade') {
        scheduleBookmarkCascadeHoverIntent({
          levelIndex: targetEntry.levelIndex,
          key: targetKey,
          triggerElement: match.button,
          allowWhenSuppressed: true,
          run: () => openNestedLevel(targetEntry, targetKey)
        }, {
          clientX: point.x,
          clientY: point.y,
          pointerType: 'mouse'
        });
        if (bookmarkCascadeHoverIntentTask) {
          clearTimer(bookmarkCascadeHoverIntentTimer);
          bookmarkCascadeHoverIntentTimer = setTimer(
            runBookmarkCascadeHoverIntentTask,
            BOOKMARK_CASCADE_DRAG_OPEN_DELAY_MS
          );
        }
      } else {
        cancelBookmarkCascadeHoverIntent();
      }
    }
    return match.kind === 'cascade'
      ? {
        folderId: match.folderId,
        title: match.title,
        element: match.element,
        markerElement: null,
        markerPosition: '',
        kind: match.kind,
        surface: 'cascade'
      }
      : {
        folderId: match.folderId,
        title: '',
        index: match.index,
        element: match.element,
        markerElement: match.markerElement,
        markerPosition: match.markerPosition,
        kind: match.kind,
        surface: 'cascade'
      };
  }

  function handleDocumentPointerDown(event: PointerEvent): void {
    if (!bookmarkCascadeMenu) {
      return;
    }
    const target = event.target;
    const node = isNode(target) ? target : null;
    if (bookmarkCascadeMenu.contains(node) ||
        (bookmarkCascadeAnchor && (target === bookmarkCascadeAnchor || bookmarkCascadeAnchor.contains(node))) ||
        shouldKeepOpenForExternalNode(target)) {
      return;
    }
    close();
  }

  // Escape goes through the page's dismiss stack, so it closes this menu
  // only when the menu is the top layer.
  function handleDocumentKeyDown(event: KeyboardEvent): void {
    if (!bookmarkCascadeMenu) {
      return;
    }
    batch(() => handleBookmarkCascadeKeyboardNavigation(event));
  }

  if (dismissStack) {
    dismissStack.register(DISMISS_LAYER_KEY, {
      isOpen: () => Boolean(bookmarkCascadeMenu),
      close: () => close({ restoreFocus: true })
    });
  }

  // The document listeners exist only while a menu is open.
  let documentListenersAttached = false;
  function setDocumentListenersAttached(attached: boolean): void {
    if (attached === documentListenersAttached || !documentObj) {
      return;
    }
    documentListenersAttached = attached;
    if (attached) {
      documentObj.addEventListener('pointerdown', handleDocumentPointerDown, true);
      documentObj.addEventListener('pointermove', handleBookmarkCascadeDocumentPointerMove, true);
      documentObj.addEventListener('keydown', handleDocumentKeyDown, true);
    } else {
      documentObj.removeEventListener('pointerdown', handleDocumentPointerDown, true);
      documentObj.removeEventListener('pointermove', handleBookmarkCascadeDocumentPointerMove, true);
      documentObj.removeEventListener('keydown', handleDocumentKeyDown, true);
    }
  }

  return Object.freeze({
    close,
    getRootFolderId: getBookmarkCascadeRootFolderId,
    getAnchor: () => bookmarkCascadeAnchor,
    isOpen: () => Boolean(bookmarkCascadeMenu),
    isDragMode: () => bookmarkCascadeDragMode,
    open,
    positionLevels: positionBookmarkCascadeLevels,
    rebindAnchor: rebindBookmarkCascadeAnchor,
    clearDragTarget: clearBookmarkCascadeDragTarget,
    refresh: refreshBookmarkCascadeMenu,
    setDragMode: setBookmarkCascadeDragMode,
    setContextMenuBookmark(id: string | null) {
      const nextId = id || '';
      if (nextId !== contextMenuBookmarkId) {
        contextMenuBookmarkId = nextId;
        invalidate();
      }
    },
    updateDragPointer: (pointInput: PointLike | null | undefined) =>
      batch(() => updateBookmarkCascadeDragPointer(pointInput))
  });
}

type BookmarkCascadeRuntime = ReturnType<typeof createBookmarkCascadeMenuRuntime>;

export { createBookmarkCascadeMenuRuntime };
export type {
  BookmarkCascadeMenuOptions,
  BookmarkCascadeRuntime,
  BookmarkMenuAnchor,
  CascadeDragTarget,
  CascadeItemEventDetail,
  CascadeRefreshOptions
};
