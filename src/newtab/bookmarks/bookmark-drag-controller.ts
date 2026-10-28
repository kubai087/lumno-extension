// Bookmark card layout animation, drag and drop (within the grid, across
// folders and onto shortcuts) and the bookmark move undo history.
import type * as FolderReferences from '../../domain/bookmark-folder-reference';
import type { FolderBindingRuntime } from '../../platform/bookmark-folder-bindings';
import { isElementNode, isHtmlElement, isHtmlTag } from '../../shared/dom-guards';
import { queryHtmlTags } from '../../shared/dom-lookup';
import { createSvgElement } from '../../shared/ui/svg-tree';
import type * as CrossSurfaceDrag from '../cross-surface-drag';
import type {
  BlockedDropTarget,
  DragDropTarget,
  FolderDropTarget,
  GridInsertionTarget,
  LayoutRect,
  ShortcutInsertionTarget,
  SurfaceDragState
} from '../cross-surface-drag';
import * as LumnoNewtabDragClickGuard from '../drag-click-guard';
import type { FormatMessage, ShowToast, Translate } from '../newtab-types';
import type { BookmarkCardElement } from '../react/bookmarks';
import type { BookmarksTopbarRuntime } from '../react/bookmarks-topbar';
import type { PersistShortcuts, ShortcutInsertionSlot } from '../shortcuts/shortcut-types';
import type { BookmarkCascadeRuntime, CascadeItemEventDetail, CascadeRefreshOptions } from './bookmark-cascade-menu';
import type * as BookmarkDrag from './bookmark-drag';
import type { BookmarkDragSession, BookmarkDragSource, BookmarkLayoutItem } from './bookmark-drag';
import type * as FolderIcon from './bookmark-folder-icon';
import { describeFolderIcon } from './bookmark-folder-icon';
import type * as MoveHistory from './bookmark-move-history';
import type { BookmarkMoveHistory, ShortcutGroupDeleteRecord } from './bookmark-move-history';
import type { BookmarkItem } from './bookmarks-store';
import * as BOOKMARK_DRAG_RULES from './bookmark-drag-rules';
import * as BOOKMARK_MOVE_ACTIONS from './bookmark-move-actions';
import type { BookmarkDeleteTarget } from './bookmark-move-actions';
import * as BOOKMARK_SHORTCUT_TRANSFER from './bookmark-shortcut-transfer';
import type { AnimationRect } from './bookmark-drag-rules';
import type { BookmarksRuntime } from './bookmarks-runtime';
import type { FolderItemIcon, FolderItemIconMap } from './folder-item-icons';
import { isShortcutFolder } from '../../domain/shortcuts/normalize';
import type { ShortcutGroup, ShortcutItem } from '../../domain/shortcuts/types';
import * as ShortcutNormalize from '../../domain/shortcuts/normalize';
import type { SettingPreview } from '../setting-preview';
import { bookmarkCount } from '../../domain/settings/bookmarks';

interface BookmarkDragControllerState {
  bookmarkGrid: HTMLElement | null;
  bookmarkAllItems: BookmarkItem[];
  bookmarkCurrentPage: number;
  bookmarkCurrentFolderId: string;
  bookmarkRootFolderId: string;
  currentBookmarkViewMode: string;
  bookmarkTopbarRuntime: BookmarksTopbarRuntime | null;
  bookmarkLoadedOnce: boolean;
  bookmarkCascadeRuntime: BookmarkCascadeRuntime | null;
  shortcutSection: HTMLElement | null;
  shortcutGrid: HTMLElement | null;
  addShortcutButton: HTMLElement | null;
  bookmarkDragState: BookmarkDragSession | null;
  newtabShortcuts: ShortcutItem[];
  // Custom icon images by shortcut id.
  newtabShortcutIcons: Record<string, string>;
  // While an undoable change runs, no other may start.
  bookmarkMoveHistoryBusy: boolean;
  bookmarkPagerPrevButton: HTMLElement | null;
  bookmarkPagerNextButton: HTMLElement | null;
  bookmarkPageAnimating: boolean;
}

interface BookmarkDragControllerDeps {
  preview: Pick<SettingPreview, 'get'>;
  isBookmarkTopbarMode(): boolean;
  getBookmarkLimit(): number;
  NEWTAB_BOOKMARK_DRAG: typeof BookmarkDrag;
  initFolderPathMorph: typeof FolderIcon.initFolderPathMorph;
  setFolderPathMorphState: typeof FolderIcon.setFolderPathMorphState;
  isContentSectionVisible(section: HTMLElement | null): boolean;
  bookmarkSection: HTMLElement | null;
  bookmarksRuntime: BookmarksRuntime;
  NEWTAB_CROSS_SURFACE_DRAG: typeof CrossSurfaceDrag;
  NEWTAB_BOOKMARK_MOVE_HISTORY: typeof MoveHistory;
  getShortcutById(id: string): ShortcutItem | null;
  // The local bookmark folder a folder shortcut shows.
  getShortcutFolderId(shortcut: ShortcutItem): string;
  getShortcutReorderTiles(): HTMLElement[];
  getShortcutTileLayoutRect(tile: HTMLElement | null): LayoutRect | null;
  getShortcutStoreOptions(): Parameters<typeof ShortcutNormalize.createShortcutRecord>[1];
  getShortcutInsertionSlotAt(pointerX: number, pointerY: number, excludedTile: HTMLElement | null): ShortcutInsertionSlot;
  MAX_NEWTAB_SHORTCUTS: number;
  getShortcutTileId(tile: HTMLElement | null | undefined): string;
  FOLDER_REFERENCES: Pick<typeof FolderReferences, 'describe' | 'createEntryId'>;
  bookmarkMoveHistory: BookmarkMoveHistory;
  showToast: ShowToast;
  t: Translate;
  refreshShortcutFolderReferences(): Promise<unknown>;
  shortcutFolderRuntime: Pick<FolderBindingRuntime, 'bind' | 'flush'>;
  getFolderItemIcon?(bookmarkId: string): FolderItemIcon | null;
  updateFolderItemIcons(changes: Readonly<Record<string, FolderItemIcon | null>>): Promise<FolderItemIconMap>;
  persistShortcuts: PersistShortcuts;
  markBookmarkTreeDirty(options?: { preserveCascadeOpen?: boolean }): void;
  loadBookmarks(options?: { force?: boolean }): unknown;
  getBookmarkPageCount(): number;
  isBookmarkSurfaceDragStateActive(state: SurfaceDragState): boolean;
  openBookmarkCascadeMenu(...args: Parameters<BookmarkCascadeRuntime['open']>): void;
  navigateBookmarkFolder(folderId: string): void;
  // Shows another page of the bookmarks during a drag; false when it cannot.
  switchBookmarkPageDuringDrag(page: number): boolean;
  setShortcutDragTileTransform(state: SurfaceDragState, pointerX: number, pointerY: number): void;
  scheduleWallpaperAdaptiveToneUpdate(): void;
  formatMessage: FormatMessage;
  isShortcutDragActive(): boolean;
  hideCursorTooltip(): void;
  isEditableElement(element: Element): boolean;
  closeBookmarkCascadeMenu(options?: { animate?: boolean }): void;
  renderCurrentBookmarkPage(): void;
  applyShortcutGroupDeleteRecord(record: ShortcutGroupDeleteRecord, isUndo: boolean): Promise<boolean>;
  // Scrolls the shortcuts while a drag rests near their edge.
  autoScrollShortcutArea(pointerX: number, pointerY: number): boolean;
  closeBookmarkContextMenu(): void;
  getShortcutGroups?(): ShortcutGroup[];
  isWebDavBackingUpShortcuts?(): Promise<boolean>;
  pageState: BookmarkDragControllerState;
}

interface PendingLayoutAnimation {
  folderId: string;
  page: number;
  excludedBookmarkId: string;
  draggedBookmarkId: string;
  draggedRect: AnimationRect | null;
  rects: Map<string, LayoutRect>;
}

type InsertLineTarget = GridInsertionTarget | ShortcutInsertionTarget;

// An insertion or folder row of the open cascade menu.
type CascadeDropTargetLike = Extract<DragDropTarget, { surface: 'cascade'; kind: 'insertion' | 'cascade' }>;

// The grid insertion line or shortcut gap a drop target draws, and what it
// sits by.
type InsertionGapKey = [string, string, HTMLElement | null];

function createBookmarkDragController(deps: BookmarkDragControllerDeps) {
  const {
    preview,
    isBookmarkTopbarMode,
    getBookmarkLimit,
    NEWTAB_BOOKMARK_DRAG,
    initFolderPathMorph,
    setFolderPathMorphState,
    isContentSectionVisible,
    bookmarkSection,
    bookmarksRuntime,
    NEWTAB_CROSS_SURFACE_DRAG,
    NEWTAB_BOOKMARK_MOVE_HISTORY,
    getShortcutById,
    getShortcutFolderId,
    getShortcutReorderTiles,
    getShortcutTileLayoutRect,
    getShortcutStoreOptions,
    getShortcutInsertionSlotAt,
    MAX_NEWTAB_SHORTCUTS,
    getShortcutTileId,
    FOLDER_REFERENCES,
    bookmarkMoveHistory,
    showToast,
    t,
    refreshShortcutFolderReferences,
    shortcutFolderRuntime,
    getFolderItemIcon,
    updateFolderItemIcons,
    persistShortcuts,
    markBookmarkTreeDirty,
    loadBookmarks,
    getBookmarkPageCount,
    isBookmarkSurfaceDragStateActive,
    openBookmarkCascadeMenu,
    navigateBookmarkFolder,
    switchBookmarkPageDuringDrag,
    setShortcutDragTileTransform,
    scheduleWallpaperAdaptiveToneUpdate,
    formatMessage,
    isShortcutDragActive,
    hideCursorTooltip,
    isEditableElement,
    closeBookmarkCascadeMenu,
    renderCurrentBookmarkPage,
    applyShortcutGroupDeleteRecord,
    autoScrollShortcutArea,
    closeBookmarkContextMenu,
    getShortcutGroups,
    isWebDavBackingUpShortcuts
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  const BOOKMARK_DRAG_START_THRESHOLD_PX = 10;
  const BOOKMARK_REORDER_ANIMATION_MS = 180;
  const BOOKMARK_DROP_ANIMATION_MS = 210;
  const BOOKMARK_REORDER_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const BOOKMARK_DRAG_PAGE_SWITCH_DELAY_MS = 640;
  const BOOKMARK_DRAG_FOLDER_SWITCH_DELAY_MS = 640;
  let bookmarkPendingLayoutAnimation: PendingLayoutAnimation | null = null;
  const insertionGapOwner = {};
  let insertionGapKey: InsertionGapKey | null = null;
  // The timers that end each card's reorder slide and drop settle.
  const cardLayoutAnimationTimers = new WeakMap<HTMLElement, number>();
  const cardDropTimers = new WeakMap<HTMLElement, number>();

  function getBookmarkCardFromNode(node: EventTarget | null): BookmarkCardElement | null {
    const card = isElementNode(node) ? node.closest('.x-nt-bookmark-card') : null;
    return isHtmlTag(card, 'div') ? card : null;
  }

  function getBookmarkCardId(card: Element | null | undefined): string {
    return card ? card.getAttribute('data-bookmark-id') || '' : '';
  }

  function getBookmarkCardParentId(card: Element): string {
    return card.getAttribute('data-bookmark-parent-id') || '';
  }

  function getBookmarkReorderCards(): BookmarkCardElement[] {
    return pageState.bookmarkGrid
      ? queryHtmlTags(pageState.bookmarkGrid, '.x-nt-bookmark-card[data-bookmark-draggable="true"]', 'div')
      : [];
  }

  // The card's layout box, with each card of the page measured once.
  function getCardLayoutItems(cards: readonly BookmarkCardElement[]): BookmarkLayoutItem[] {
    const items: BookmarkLayoutItem[] = [];
    cards.forEach((card) => {
      const rect = getBookmarkCardLayoutRect(card);
      if (rect && rect.width > 0 && rect.height > 0) {
        items.push({ card, rect });
      }
    });
    return items;
  }

  function getBookmarkCardInsertionIndex(card: HTMLElement): number {
    return getBookmarkReorderCards().findIndex((item) => item === card);
  }

  function getBookmarkPageStartIndex(): number {
    if (isBookmarkTopbarMode()) {
      return 0;
    }
    return Math.max(0, pageState.bookmarkCurrentPage * getBookmarkLimit());
  }

  function getBookmarkCardLayoutRect(card: Element | null): LayoutRect | null {
    if (!card || !pageState.bookmarkGrid) {
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

  function clearBookmarkCardLayoutAnimation(card: HTMLElement): void {
    const timer = cardLayoutAnimationTimers.get(card);
    if (timer) {
      window.clearTimeout(timer);
      cardLayoutAnimationTimers.delete(card);
    }
    card.style.removeProperty('transition');
    card.style.removeProperty('will-change');
    if (card.getAttribute('data-bookmark-dragging') !== 'true' &&
        card.getAttribute('data-bookmark-dropping') !== 'true') {
      card.style.removeProperty('transform');
    }
  }

  function getBookmarkLayoutRectMapById(): Map<string, LayoutRect> {
    const rects = new Map<string, LayoutRect>();
    getBookmarkReorderCards().forEach((card) => {
      const bookmarkId = getBookmarkCardId(card);
      const rect = getBookmarkCardLayoutRect(card);
      if (bookmarkId && rect) {
        rects.set(bookmarkId, rect);
      }
    });
    return rects;
  }

  function getBookmarkDragVisualRect(state: BookmarkDragSession): AnimationRect | null {
    const visualElement = getBookmarkDragVisualElement(state);
    return visualElement
      ? BOOKMARK_DRAG_RULES.normalizeAnimationRect(visualElement.getBoundingClientRect())
      : null;
  }

  // Notes where the cards are, so the next render slides them from there.
  function queueBookmarkLayoutAnimation(
    excludedBookmarkId: unknown,
    animationOptions?: { draggedBookmarkId?: string; draggedRect?: AnimationRect | null }
  ): void {
    const options = animationOptions || {};
    const rects = getBookmarkLayoutRectMapById();
    const draggedRect = BOOKMARK_DRAG_RULES.normalizeAnimationRect(options.draggedRect);
    bookmarkPendingLayoutAnimation = rects.size > 0 || draggedRect
      ? {
        folderId: String(pageState.bookmarkCurrentFolderId || ''),
        page: pageState.bookmarkCurrentPage,
        excludedBookmarkId: String(excludedBookmarkId || ''),
        draggedBookmarkId: String(options.draggedBookmarkId || ''),
        draggedRect,
        rects
      }
      : null;
  }

  function playPendingBookmarkLayoutAnimation(): boolean {
    const pending = bookmarkPendingLayoutAnimation;
    bookmarkPendingLayoutAnimation = null;
    if (!pending || !pageState.bookmarkGrid ||
        pending.folderId !== String(pageState.bookmarkCurrentFolderId || '') ||
        pending.page !== pageState.bookmarkCurrentPage ||
        NEWTAB_CROSS_SURFACE_DRAG.prefersReducedMotion(window)) {
      return false;
    }
    const grid = pageState.bookmarkGrid;
    const shifts: { card: BookmarkCardElement; dx: number; dy: number }[] = [];
    getBookmarkReorderCards().forEach((card) => {
      const bookmarkId = getBookmarkCardId(card);
      const isDraggedCard = Boolean(
        bookmarkId &&
        bookmarkId === pending.draggedBookmarkId &&
        pending.draggedRect
      );
      if (!bookmarkId ||
          (bookmarkId === pending.excludedBookmarkId && !isDraggedCard) ||
          (!isDraggedCard && !pending.rects.has(bookmarkId))) {
        return;
      }
      clearBookmarkCardLayoutAnimation(card);
      const before = isDraggedCard
        ? pending.draggedRect
        : pending.rects.get(bookmarkId);
      const after = getBookmarkCardLayoutRect(card);
      if (!before || !after) {
        return;
      }
      const delta = NEWTAB_BOOKMARK_DRAG.getLayoutShiftDelta(before, after, {
        horizontalOnly: isBookmarkTopbarMode()
      });
      if (!delta) {
        return;
      }
      const { dx, dy } = delta;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        return;
      }
      shifts.push({ card, dx, dy });
    });
    if (shifts.length === 0) {
      return false;
    }
    shifts.forEach(({ card, dx, dy }) => {
      card.style.transition = 'none';
      card.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      card.style.willChange = 'transform';
    });
    void grid.offsetHeight;
    window.requestAnimationFrame(() => {
      shifts.forEach(({ card }) => {
        if (!card.isConnected) {
          return;
        }
        card.style.transition = `transform ${BOOKMARK_REORDER_ANIMATION_MS}ms ${BOOKMARK_REORDER_EASING}`;
        card.style.transform = 'translate3d(0, 0, 0)';
        cardLayoutAnimationTimers.set(card, window.setTimeout(() => {
          cardLayoutAnimationTimers.delete(card);
          clearBookmarkCardLayoutAnimation(card);
        }, BOOKMARK_REORDER_ANIMATION_MS + 80));
      });
    });
    return true;
  }

  function updateBookmarkDragLayoutCache(state: BookmarkDragSession | null): void {
    if (!state || !state.card) {
      return;
    }
    const draggedCard = state.card;
    state.layoutItems = getCardLayoutItems(getBookmarkReorderCards().filter((card) => card !== draggedCard));
    const draggedLayoutRect = getBookmarkCardLayoutRect(draggedCard);
    if (draggedLayoutRect && !state.dragPreviewElement) {
      state.baseLeft = draggedLayoutRect.left;
      state.baseTop = draggedLayoutRect.top;
    }
  }

  function cancelBookmarkDragMoveFrame(state: BookmarkDragSession): void {
    if (!state || !state.moveFrameId) {
      return;
    }
    window.cancelAnimationFrame(state.moveFrameId);
    state.moveFrameId = 0;
  }

  function getBookmarkDragVisualElement(state: BookmarkDragSession): HTMLElement | null {
    return NEWTAB_BOOKMARK_DRAG.getVisualElement(state);
  }

  function createBookmarkCascadeDragPreview(state: BookmarkDragSession): HTMLElement | null {
    return NEWTAB_BOOKMARK_DRAG.createPreview(state, {
      documentObj: document,
      renderClosedFolderIcon: ({ bookmarkId, folderIcon }) => {
        folderIcon.replaceChildren(createSvgElement(document, describeFolderIcon(`${bookmarkId}-drag-preview`, bookmarkId)));
        initFolderPathMorph(folderIcon);
        setFolderPathMorphState(folderIcon, false);
      }
    });
  }

  function removeBookmarkCascadeDragPreview(state: BookmarkDragSession): void {
    NEWTAB_BOOKMARK_DRAG.removePreview(state);
  }

  function setBookmarkDragCardTransform(state: BookmarkDragSession, pointerX: number, pointerY: number): void {
    NEWTAB_BOOKMARK_DRAG.updateVisualPosition(state, pointerX, pointerY, {
      windowObj: window
    });
  }

  function settleBookmarkDragCard(card: HTMLElement): void {
    card.setAttribute('data-bookmark-dropping', 'true');
    card.style.pointerEvents = '';
    const reducedMotion = NEWTAB_CROSS_SURFACE_DRAG.prefersReducedMotion(window);
    card.style.transition = reducedMotion
      ? 'none'
      : `transform ${BOOKMARK_DROP_ANIMATION_MS}ms ${BOOKMARK_REORDER_EASING}`;
    card.style.transform = 'translate3d(0, 0, 0)';
    const dropTimer = cardDropTimers.get(card);
    if (dropTimer) {
      window.clearTimeout(dropTimer);
    }
    cardDropTimers.set(card, window.setTimeout(() => {
      cardDropTimers.delete(card);
      card.removeAttribute('data-bookmark-dragging');
      card.removeAttribute('data-bookmark-dropping');
      card.style.removeProperty('transition');
      card.style.removeProperty('transform');
      card.style.removeProperty('will-change');
      card.style.pointerEvents = '';
    }, reducedMotion ? 0 : BOOKMARK_DROP_ANIMATION_MS + 90));
  }

  function isPointInsideBookmarkElement(element: HTMLElement | null, pointerX: number, pointerY: number): boolean {
    return NEWTAB_BOOKMARK_DRAG.isPointInsideElement(element, pointerX, pointerY);
  }

  function getBookmarkGridInsertionDropTarget(state: BookmarkDragSession, pointerX: number, pointerY: number): GridInsertionTarget | null {
    if (!pageState.bookmarkGrid || !Number.isFinite(pointerX) ||
        !Number.isFinite(pointerY)) {
      return null;
    }
    const computedStyle = window.getComputedStyle(pageState.bookmarkGrid);
    const pageStartIndex = getBookmarkPageStartIndex();
    const pageEndIndex = pageStartIndex + getBookmarkLimit();
    const originalIndex = Number(state.originalIndex);
    const isCrossPageDrag = !isBookmarkTopbarMode() &&
      state.sourceKind === 'card' &&
      String(state.parentId || '') === String(pageState.bookmarkCurrentFolderId || '') &&
      Number.isFinite(originalIndex) &&
      (originalIndex < pageStartIndex || originalIndex >= pageEndIndex);
    return NEWTAB_BOOKMARK_DRAG.getGridInsertionTarget({
      columnGap: computedStyle.columnGap,
      folderId: pageState.bookmarkCurrentFolderId,
      gridElement: pageState.bookmarkGrid,
      isCrossPageDrag,
      layoutItems: state.layoutItems,
      markerVerticalInsetPx: isBookmarkTopbarMode() ? 3 : 8,
      pageStartIndex,
      pointerX,
      pointerY
    });
  }

  function getBookmarkDropSurfaceElement(): HTMLElement | null {
    if (!pageState.bookmarkGrid || preview.get(bookmarkCount) <= 0) {
      return null;
    }
    if (isBookmarkTopbarMode()) {
      return pageState.bookmarkTopbarRuntime && pageState.bookmarkTopbarRuntime.isVisible()
        ? pageState.bookmarkTopbarRuntime.element
        : null;
    }
    return isContentSectionVisible(bookmarkSection) ? bookmarkSection : null;
  }

  function isEmptyBookmarkRootHidden(): boolean {
    return Boolean(
      preview.get(bookmarkCount) > 0 &&
      pageState.bookmarkLoadedOnce &&
      !getBookmarkDropSurfaceElement() &&
      String(pageState.bookmarkCurrentFolderId || '') === String(pageState.bookmarkRootFolderId || '1') &&
      pageState.bookmarkAllItems.length === 0
    );
  }

  // Where a drag from another surface meets the bookmarks: the point on
  // the bar's row of cards, or the point itself over the section.
  function getExternalBookmarkSurfacePoint(pointerX: number, pointerY: number): { x: number; y: number } | null {
    const surface = getBookmarkDropSurfaceElement();
    if (!surface) {
      return null;
    }
    if (isBookmarkTopbarMode()) {
      return NEWTAB_BOOKMARK_DRAG.getTopbarDropPoint({
        surfaceElement: surface,
        viewportElement: pageState.bookmarkTopbarRuntime ? pageState.bookmarkTopbarRuntime.viewport : null,
        pointerX,
        pointerY
      });
    }
    return NEWTAB_BOOKMARK_DRAG.isPointInsideElement(surface, pointerX, pointerY)
      ? { x: pointerX, y: pointerY } : null;
  }

  // Foreign items share the bookmark edge insertion zones. A folder's center
  // accepts its contents; ordinary cards snap to the nearest row boundary.
  function isValidExternalBookmarkDropTarget(state: SurfaceDragState | null, target: DragDropTarget | null): boolean {
    return BOOKMARK_DRAG_RULES.isExternalBookmarkDropAllowed(state, target, bookmarksRuntime.getNodeMap());
  }

  function resolveExternalBookmarkDropTarget(state: SurfaceDragState | null, dropTarget: DragDropTarget): DragDropTarget {
    let target = dropTarget;
    const shortcut = state && state.shortcutId ? getShortcutById(state.shortcutId) : null;
    if (shortcut && isShortcutFolder(shortcut) &&
        (target.kind === 'card' || target.kind === 'cascade') &&
        String(target.folderId) === String(getShortcutFolderId(shortcut))) {
      const source = bookmarksRuntime.getNodeMap().get(String(getShortcutFolderId(shortcut)));
      if (source && !source.url) {
        // Returning the alias to its original bookmark removes the shortcut
        // without trying to move the real folder into itself.
        target = {
          kind: 'return',
          surface: target.surface,
          bookmarkId: source.id,
          folderId: String(source.parentId || ''),
          title: target.title,
          element: target.element,
          markerElement: target.markerElement
        };
      }
    }
    const blocked: BlockedDropTarget = { kind: 'blocked', surface: target.surface || 'folder' };
    return isValidExternalBookmarkDropTarget(state, target) ? target : blocked;
  }

  function getShortcutFolderDropTargetAt(
    state: SurfaceDragState,
    pointerX: number,
    pointerY: number
  ): FolderDropTarget | BlockedDropTarget | null {
    if (!isPointOverShortcutDropSurface(pointerX, pointerY)) {
      return null;
    }
    const tile = getShortcutReorderTiles().find((candidate) => {
      if (!candidate.hasAttribute('data-bookmark-drop-folder-id') || candidate === state.tile) {
        return false;
      }
      const rect = getShortcutTileLayoutRect(candidate);
      return rect && pointerX >= rect.left + rect.width * 0.25 &&
        pointerX <= rect.right - rect.width * 0.25 && pointerY >= rect.top && pointerY <= rect.bottom;
    });
    if (!tile) {
      return null;
    }
    const target: FolderDropTarget = { kind: 'shortcut-folder', surface: 'folder', element: tile,
      folderId: tile.getAttribute('data-bookmark-drop-folder-id') || '',
      title: tile.getAttribute('data-shortcut-title') || '' };
    const bookmarkState = pageState.bookmarkDragState;
    const valid = bookmarkState && state === bookmarkState
      ? isValidBookmarkFolderDropTarget(bookmarkState, target)
      : isValidExternalBookmarkDropTarget(state, target);
    return valid ? target : { kind: 'blocked', surface: 'folder' };
  }

  // Where a drag from the shortcuts or the recent sites would drop on the
  // bookmarks: the open cascade menu, a folder, or a line in the grid.
  function getExternalBookmarkDropTarget(pointerX: number, pointerY: number, state: SurfaceDragState | null): DragDropTarget | null {
    if (pageState.bookmarkCascadeRuntime && pageState.bookmarkCascadeRuntime.isOpen()) {
      const cascadeTarget = pageState.bookmarkCascadeRuntime.updateDragPointer({ clientX: pointerX, clientY: pointerY });
      if (cascadeTarget) {
        return resolveExternalBookmarkDropTarget(state, cascadeTarget);
      }
      if (isBookmarkCascadeSurfaceAtPoint(pointerX, pointerY)) {
        return null;
      }
    }
    const surfacePoint = getExternalBookmarkSurfacePoint(pointerX, pointerY);
    const folderTarget = getBookmarkElementDropTarget(
      surfacePoint ? surfacePoint.x : pointerX,
      surfacePoint ? surfacePoint.y : pointerY
    );
    if (folderTarget && folderTarget.kind !== 'card') {
      return resolveExternalBookmarkDropTarget(state, folderTarget);
    }
    if (!surfacePoint) {
      return folderTarget ? resolveExternalBookmarkDropTarget(state, folderTarget) : null;
    }
    const grid = pageState.bookmarkGrid;
    if (!grid) {
      return folderTarget ? resolveExternalBookmarkDropTarget(state, folderTarget) : null;
    }
    const computedStyle = window.getComputedStyle(grid);
    const insertionTarget = NEWTAB_BOOKMARK_DRAG.getGridInsertionTarget({
      columnGap: computedStyle.columnGap,
      folderId: pageState.bookmarkCurrentFolderId,
      gridElement: grid,
      // Keep the shared narrow edge zones over folders so their centers can
      // still accept contents. Other points may snap anywhere in the row.
      hitZonePx: folderTarget ? undefined : grid.getBoundingClientRect().width,
      layoutItems: getCardLayoutItems(getBookmarkReorderCards()),
      markerVerticalInsetPx: isBookmarkTopbarMode() ? 3 : 8,
      pageStartIndex: getBookmarkPageStartIndex(),
      pointerX: surfacePoint.x,
      pointerY: surfacePoint.y
    });
    if (insertionTarget) {
      return resolveExternalBookmarkDropTarget(state, insertionTarget);
    }
    return folderTarget ? resolveExternalBookmarkDropTarget(state, folderTarget) : null;
  }

  // A scrolling shortcut section shows only part of its grid; the rest,
  // scrolled under the search box or the bottom dock, takes no drops.
  function isPointOverShortcutDropSurface(pointerX: number, pointerY: number): boolean {
    const section = pageState.shortcutSection;
    return Boolean(
      pageState.shortcutGrid &&
      isContentSectionVisible(section) &&
      !isBookmarkCascadeSurfaceAtPoint(pointerX, pointerY) &&
      NEWTAB_BOOKMARK_DRAG.isPointInsideElement(pageState.shortcutGrid, pointerX, pointerY) &&
      (!section || section.getAttribute('data-shortcuts-scrollable') !== 'true' ||
        NEWTAB_BOOKMARK_DRAG.isPointInsideElement(section, pointerX, pointerY))
    );
  }

  function getBookmarkDragShortcutDropTarget(state: BookmarkDragSession, pointerX: number, pointerY: number): ShortcutInsertionTarget | null {
    const node = bookmarksRuntime.getNodeMap().get(String(state.bookmarkId || ''));
    const record = node
      ? ShortcutNormalize.createShortcutRecord(
        state.isFolder
          ? { type: 'folder', folderId: node.id, title: node.title }
          : { title: node.title, url: node.url },
        getShortcutStoreOptions()
      )
      : null;
    return getShortcutInsertionDropTarget(record, pointerX, pointerY);
  }

  // Where `record` would join the shortcuts under the pointer, with the
  // line to show there; null (and a blocked cursor) when it cannot.
  function getShortcutInsertionDropTarget(record: ShortcutItem | null, pointerX: number, pointerY: number): ShortcutInsertionTarget | null {
    const slot = getShortcutInsertionSlotAt(pointerX, pointerY, null);
    const canMove = Boolean(NEWTAB_CROSS_SURFACE_DRAG.planBookmarkToShortcut({
      shortcuts: pageState.newtabShortcuts,
      record,
      index: slot.index,
      groupId: slot.groupId,
      getFolderId: getShortcutFolderId,
      maxShortcuts: MAX_NEWTAB_SHORTCUTS
    }));
    const anchorRect = slot.anchorRect || getShortcutTileLayoutRect(pageState.addShortcutButton);
    if (!canMove || !anchorRect || anchorRect.width <= 0) {
      document.body.setAttribute('data-drag-blocked', 'true');
      return null;
    }
    // The row shows no line: the two tiles beside the slot lean apart, and
    // the gap they open is the mark. A line read off-center beside icons
    // the dock magnifies, grows and nudges.
    return {
      kind: 'insertion',
      surface: 'shortcuts',
      index: slot.index < getShortcutReorderTiles().length
        ? pageState.newtabShortcuts.findIndex((item) => item.id === getShortcutTileId(getShortcutReorderTiles()[slot.index]))
        : pageState.newtabShortcuts.length,
      groupId: slot.groupId || '',
      record,
      element: null,
      anchorElement: slot.anchorTile,
      markerElement: null,
      markerPosition: slot.markerPosition
    };
  }

  const {
    hasShortcutForBookmarkFolder,
    addBookmarkFolderToShortcuts,
    moveBookmarkToShortcuts,
    applyBookmarkShortcutTransfer,
    applyShortcutStack
  } = BOOKMARK_SHORTCUT_TRANSFER.createBookmarkShortcutTransfer({
    bookmarksRuntime,
    NEWTAB_CROSS_SURFACE_DRAG,
    NEWTAB_BOOKMARK_MOVE_HISTORY,
    getShortcutStoreOptions,
    getShortcutFolderId,
    getShortcutGroups,
    MAX_NEWTAB_SHORTCUTS,
    FOLDER_REFERENCES,
    bookmarkMoveHistory,
    shortcutFolderRuntime,
    getFolderItemIcon,
    updateFolderItemIcons,
    persistShortcuts,
    refreshShortcutFolderReferences,
    isWebDavBackingUpShortcuts,
    markBookmarkTreeDirty,
    loadBookmarks,
    refreshOpenBookmarkCascadeMenu: () => refreshOpenBookmarkCascadeMenu(),
    queueLayoutAnimation: (excludedBookmarkId) => queueBookmarkLayoutAnimation(excludedBookmarkId),
    dropLayoutAnimation: () => {
      bookmarkPendingLayoutAnimation = null;
    },
    showToast,
    t,
    formatMessage,
    pageState
  });

  function isInsertLineDropTarget(target: DragDropTarget | null | undefined): target is InsertLineTarget {
    return Boolean(
      target &&
      target.kind === 'insertion' &&
      (target.surface === 'grid' || target.surface === 'shortcuts')
    );
  }

  function isSameLayoutRow(element: HTMLElement, anchor: HTMLElement): boolean {
    const height = Math.min(element.offsetHeight, anchor.offsetHeight) || 1;
    return Math.abs(element.offsetTop - anchor.offsetTop) < height / 2;
  }

  function getInsertLineNeighbors(
    state: SurfaceDragState | null,
    target: InsertLineTarget
  ): { before: HTMLElement | null; after: HTMLElement | null } {
    const isGrid = target.surface === 'grid';
    const dragged = state ? state.card || state.tile : null;
    const items: HTMLElement[] = (isGrid ? getBookmarkReorderCards() : getShortcutReorderTiles())
      .filter((item) => item !== dragged);
    const anchor = target.surface === 'grid' ? target.element : target.anchorElement;
    return NEWTAB_CROSS_SURFACE_DRAG.getInsertionGapNeighbors(
      items, anchor, target.markerPosition, isSameLayoutRow);
  }

  // Opens a small gap at a grid, bar or shortcut-row insertion point by
  // leaning its two neighbours apart. The line itself lives on the container.
  function syncInsertionGap(state: SurfaceDragState | null, target: DragDropTarget | null): void {
    const lineTarget = isInsertLineDropTarget(target) ? target : null;
    const key: InsertionGapKey | null = lineTarget
      ? [lineTarget.surface, lineTarget.markerPosition,
        lineTarget.surface === 'grid' ? lineTarget.element : lineTarget.anchorElement]
      : null;
    const previousKey = insertionGapKey;
    if (key && previousKey && key.every((part, index) => part === previousKey[index])) {
      return;
    }
    insertionGapKey = key;
    const { before, after } = lineTarget ? getInsertLineNeighbors(state, lineTarget) : { before: null, after: null };
    NEWTAB_CROSS_SURFACE_DRAG.setInsertionGap(insertionGapOwner, before, after);
  }

  function clearDropTargetMarker(marker: HTMLElement): void {
    marker.removeAttribute('data-bookmark-insert-position');
    marker.removeAttribute('data-insert-line-position');
    marker.style.removeProperty('--x-nt-insert-line-left');
    marker.style.removeProperty('--x-nt-insert-line-top');
    marker.style.removeProperty('--x-nt-insert-line-height');
    marker.removeAttribute('data-insert-line-motion');
  }

  function clearDragDropTarget(state: SurfaceDragState | null): void {
    if (!state) {
      return;
    }
    if (state.dropTarget && state.dropTarget.element) {
      state.dropTarget.element.removeAttribute('data-bookmark-drop-target');
    }
    if (state.dropTarget && state.dropTarget.markerElement) {
      clearDropTargetMarker(state.dropTarget.markerElement);
    }
    if (pageState.bookmarkCascadeRuntime) {
      pageState.bookmarkCascadeRuntime.clearDragTarget();
    }
    syncInsertionGap(state, null);
    state.dropTarget = null;
  }

  function restoreBookmarkDragPreview(state: BookmarkDragSession | null): void {
    const grid = pageState.bookmarkGrid;
    if (!state || !state.hasReordered || !Array.isArray(state.originalAllItems)) {
      return;
    }
    pageState.bookmarkAllItems = state.originalAllItems.slice();
    const cardsById = new Map(getBookmarkReorderCards().map((card) => [getBookmarkCardId(card), card]));
    (state.originalPageCardIds || []).forEach((bookmarkId) => {
      const card = cardsById.get(bookmarkId);
      if (grid && card && card.parentNode === grid) {
        grid.appendChild(card);
      }
    });
    state.pageIndex = state.originalPageIndex;
    state.hasReordered = false;
    updateBookmarkDragLayoutCache(state);
  }

  function isValidBookmarkFolderDropTarget(state: BookmarkDragSession | null, target: { folderId: string } | null): boolean {
    return Boolean(
      state &&
      target &&
      NEWTAB_BOOKMARK_MOVE_HISTORY.canMoveBookmarkToFolder({
        bookmarkId: state.bookmarkId,
        sourceParentId: state.parentId,
        targetFolderId: target.folderId,
        nodeMap: bookmarksRuntime.getNodeMap()
      })
    );
  }

  function isValidBookmarkInsertionDropTarget(
    state: BookmarkDragSession | null,
    target: GridInsertionTarget | CascadeDropTargetLike | null
  ): boolean {
    return Boolean(
      state &&
      target &&
      target.kind === 'insertion' &&
      NEWTAB_BOOKMARK_MOVE_HISTORY.canMoveBookmarkToLocation({
        bookmarkId: state.bookmarkId,
        sourceParentId: state.parentId,
        sourceIndex: state.originalIndex,
        targetParentId: target.folderId,
        targetIndex: target.index,
        nodeMap: bookmarksRuntime.getNodeMap()
      })
    );
  }

  function getBookmarkElementDropTarget(pointerX: number, pointerY: number): FolderDropTarget | null {
    const element = document.elementFromPoint(pointerX, pointerY);
    if (!element) {
      return null;
    }
    const breadcrumbTarget = element.closest('[data-bookmark-drop-folder-id]');
    if (isHtmlElement(breadcrumbTarget) && !breadcrumbTarget.classList.contains('x-nt-bookmark-card')) {
      return {
        folderId: breadcrumbTarget.getAttribute('data-bookmark-drop-folder-id') || '',
        title: breadcrumbTarget.getAttribute('data-bookmark-drop-folder-title') || '',
        element: breadcrumbTarget,
        kind: breadcrumbTarget.classList.contains('x-nt-shortcut-tile') ? 'shortcut-folder' : 'breadcrumb'
      };
    }
    const folderCardElement = element.closest('.x-nt-bookmark-card--folder[data-bookmark-id]');
    const folderCard: BookmarkCardElement | null = isHtmlTag(folderCardElement, 'div') ? folderCardElement : null;
    if (!folderCard) {
      return null;
    }
    const item = folderCard._xBookmarkItem || null;
    return {
      folderId: getBookmarkCardId(folderCard),
      title: String((item && item.title) || folderCard._xTitleText || ''),
      element: folderCard,
      kind: 'card'
    };
  }

  function isBookmarkCascadeSurfaceAtPoint(pointerX: number, pointerY: number): boolean {
    const element = document.elementFromPoint(pointerX, pointerY);
    return Boolean(element && element.closest('.x-nt-bookmark-cascade-menu'));
  }

  // Where a bookmark drag would drop across levels: the open cascade
  // menu, a folder, or a line in the grid.
  function getBookmarkCrossLevelDropTarget(state: BookmarkDragSession, pointerX: number, pointerY: number): DragDropTarget | null {
    let cascadeBlocked = false;
    const cascadeTarget = pageState.bookmarkCascadeRuntime
      ? pageState.bookmarkCascadeRuntime.updateDragPointer({ clientX: pointerX, clientY: pointerY })
      : null;
    if (cascadeTarget) {
      if (cascadeTarget.kind === 'blocked') {
        cascadeBlocked = true;
      } else {
        const isValidCascadeTarget = cascadeTarget.kind === 'insertion'
          ? isValidBookmarkInsertionDropTarget(state, cascadeTarget)
          : isValidBookmarkFolderDropTarget(state, cascadeTarget);
        if (!isValidCascadeTarget) {
          if (pageState.bookmarkCascadeRuntime) {
            pageState.bookmarkCascadeRuntime.clearDragTarget();
          }
          return null;
        }
        return cascadeTarget;
      }
    }

    const target = getBookmarkElementDropTarget(pointerX, pointerY);
    if (cascadeBlocked && isBookmarkCascadeSurfaceAtPoint(pointerX, pointerY)) {
      return null;
    }

    const insertionTarget = getBookmarkGridInsertionDropTarget(state, pointerX, pointerY);
    if (insertionTarget) {
      return isValidBookmarkInsertionDropTarget(state, insertionTarget)
        ? insertionTarget
        : null;
    }
    if (!target) {
      return null;
    }
    if (!isValidBookmarkFolderDropTarget(state, target)) {
      if (target.element) {
        target.element.removeAttribute('data-bookmark-drop-target');
      }
      return null;
    }
    return target;
  }

  function setDragDropTarget(state: SurfaceDragState | null, target: DragDropTarget | null): void {
    const previousTarget = state && state.dropTarget ? state.dropTarget : null;
    const previousElement = previousTarget ? previousTarget.element : null;
    const previousMarker = previousTarget ? previousTarget.markerElement : null;
    // An insertion anchor locates the line; it is not a highlighted folder target.
    const nextElement = target && target.kind !== 'insertion' ? target.element : null;
    const nextMarker = target ? target.markerElement : null;
    const isNextInsertLine = isInsertLineDropTarget(target);
    const nextMarkerAttribute = isNextInsertLine
      ? 'data-insert-line-position'
      : 'data-bookmark-insert-position';
    const previousInsertMotion = previousMarker
      ? previousMarker.getAttribute('data-insert-line-motion')
      : null;
    const isNewInsertLineTarget = Boolean(
      target && isInsertLineDropTarget(target) &&
      (
        !isInsertLineDropTarget(previousTarget) ||
        previousTarget.surface !== target.surface ||
        previousTarget.markerElement !== nextMarker ||
        previousTarget.markerPosition !== target.markerPosition ||
        getMarkerOffset(previousTarget) !== getMarkerOffset(target)
      )
    );
    if (previousElement && previousElement !== nextElement) {
      previousElement.removeAttribute('data-bookmark-drop-target');
    }
    if (previousMarker &&
        (previousMarker !== nextMarker ||
          previousMarker.getAttribute(nextMarkerAttribute) !==
            String((target && 'markerPosition' in target && target.markerPosition) || ''))) {
      clearDropTargetMarker(previousMarker);
    }
    if (!state) {
      return;
    }
    state.dropTarget = target || null;
    syncInsertionGap(state, target);
    if (nextElement) {
      nextElement.setAttribute('data-bookmark-drop-target', 'true');
    }
    if (!nextMarker || !target || target.kind !== 'insertion') {
      return;
    }
    nextMarker.setAttribute(nextMarkerAttribute, target.markerPosition);
    if (target.surface !== 'grid') {
      return;
    }
    setRestingInsertLine(nextMarker, target);
    if (isNewInsertLineTarget) {
      nextMarker.setAttribute(
        'data-insert-line-motion',
        previousInsertMotion === 'a' ? 'b' : 'a'
      );
    }
  }

  // A grid line's offset along the row; shortcut gaps draw no line.
  function getMarkerOffset(target: InsertLineTarget): number {
    return target.surface === 'grid' ? Number(target.markerOffsetPx) : NaN;
  }

  function setRestingInsertLine(nextMarker: HTMLElement, target: GridInsertionTarget): void {
    nextMarker.style.setProperty(
      '--x-nt-insert-line-left',
      `${Number(target.markerOffsetPx) || 0}px`
    );
    nextMarker.style.setProperty(
      '--x-nt-insert-line-top',
      `${Number(target.markerTopPx) || 0}px`
    );
    nextMarker.style.setProperty(
      '--x-nt-insert-line-height',
      `${Math.max(2, Number(target.markerHeightPx) || 0)}px`
    );
  }

  function getBookmarkDragPageSwitchDirection(pointerX: number, pointerY: number): number {
    if (pageState.bookmarkCurrentPage > 0 &&
        pageState.bookmarkPagerPrevButton &&
        pageState.bookmarkPagerPrevButton.getAttribute('aria-disabled') !== 'true' &&
        isPointInsideBookmarkElement(pageState.bookmarkPagerPrevButton, pointerX, pointerY)) {
      return -1;
    }
    const pageCount = getBookmarkPageCount();
    if (pageState.bookmarkCurrentPage < (pageCount - 1) &&
        pageState.bookmarkPagerNextButton &&
        pageState.bookmarkPagerNextButton.getAttribute('aria-disabled') !== 'true' &&
        isPointInsideBookmarkElement(pageState.bookmarkPagerNextButton, pointerX, pointerY)) {
      return 1;
    }
    return 0;
  }

  function clearBookmarkDragPageSwitch(state: SurfaceDragState | null): void {
    if (!state) {
      return;
    }
    if (state.pageSwitchTimerId) {
      window.clearTimeout(state.pageSwitchTimerId);
      state.pageSwitchTimerId = 0;
    }
    if (state.pageSwitchButton) {
      state.pageSwitchButton.removeAttribute('data-bookmark-drag-page-target');
    }
    state.pageSwitchButton = null;
    state.pageSwitchDirection = 0;
  }

  function clearBookmarkDragFolderSwitch(state: SurfaceDragState | null): void {
    if (!state) {
      return;
    }
    if (state.folderSwitchTimerId) {
      window.clearTimeout(state.folderSwitchTimerId);
      state.folderSwitchTimerId = 0;
    }
    if (state.folderSwitchElement) {
      state.folderSwitchElement.removeAttribute(
        'data-bookmark-drag-folder-target'
      );
    }
    state.folderSwitchElement = null;
    state.folderSwitchTargetId = '';
  }

  // Opens the folder a drag rests on: a folder card or shortcut opens its
  // menu, a breadcrumb step shows the folder in the grid.
  function scheduleBookmarkDragFolderSwitch(state: SurfaceDragState, dropTarget: DragDropTarget | null): boolean {
    const getSwitchTarget = (
      target: DragDropTarget | null
    ): { folderId: string; element: HTMLElement | null } | null => (
      target && (target.kind === 'card' || target.kind === 'shortcut-folder')
        ? { folderId: String(target.folderId), element: target.element }
        : NEWTAB_BOOKMARK_DRAG.getFolderSwitchTarget(pageState.bookmarkCurrentFolderId, target));
    const switchTarget = getSwitchTarget(dropTarget);
    if (!state || !switchTarget || !isBookmarkSurfaceDragStateActive(state) ||
        !state.isDragging) {
      clearBookmarkDragFolderSwitch(state);
      return false;
    }
    if (state.folderSwitchTargetId !== switchTarget.folderId ||
        state.folderSwitchElement !== switchTarget.element) {
      clearBookmarkDragFolderSwitch(state);
      state.folderSwitchTargetId = switchTarget.folderId;
      state.folderSwitchElement = switchTarget.element;
      if (state.folderSwitchElement) {
        state.folderSwitchElement.setAttribute(
          'data-bookmark-drag-folder-target',
          'true'
        );
      }
    }
    if (state.folderSwitchTimerId) {
      return true;
    }
    state.folderSwitchTimerId = window.setTimeout(() => {
      state.folderSwitchTimerId = 0;
      if (!isBookmarkSurfaceDragStateActive(state) || !state.isDragging) {
        clearBookmarkDragFolderSwitch(state);
        return;
      }
      const activeTarget = getSwitchTarget(state.dropTarget);
      if (!activeTarget ||
          activeTarget.folderId !== state.folderSwitchTargetId) {
        clearBookmarkDragFolderSwitch(state);
        return;
      }
      const targetFolderId = activeTarget.folderId;
      const activeDropTarget = state.dropTarget;
      clearBookmarkDragFolderSwitch(state);
      if (activeDropTarget && (activeDropTarget.kind === 'shortcut-folder' ||
          (activeDropTarget.kind === 'card' && (isBookmarkTopbarMode() || pageState.currentBookmarkViewMode === 'list')))) {
        openBookmarkCascadeMenu({ id: targetFolderId, title: activeDropTarget.title },
          activeTarget.element, { dragMode: true, shouldOpen: () => isBookmarkSurfaceDragStateActive(state) });
        return;
      }
      clearDragDropTarget(state);
      const bookmarkState = pageState.bookmarkDragState;
      if (bookmarkState && state === bookmarkState) {
        restoreBookmarkDragPreview(bookmarkState);
        setBookmarkDragCardTransform(bookmarkState, Number(state.pendingPointerX), Number(state.pendingPointerY));
      }
      state.folderSwitchPendingId = targetFolderId;
      navigateBookmarkFolder(targetFolderId);
    }, BOOKMARK_DRAG_FOLDER_SWITCH_DELAY_MS);
    return true;
  }

  function scheduleBookmarkDragPageSwitch(state: SurfaceDragState, direction: number): void {
    const normalizedDirection = direction < 0 ? -1 : direction > 0 ? 1 : 0;
    if (!state || !normalizedDirection || !isBookmarkSurfaceDragStateActive(state) || !state.isDragging) {
      clearBookmarkDragPageSwitch(state);
      return;
    }
    const button = normalizedDirection < 0
      ? pageState.bookmarkPagerPrevButton
      : pageState.bookmarkPagerNextButton;
    if (!button) {
      clearBookmarkDragPageSwitch(state);
      return;
    }
    if (state.pageSwitchDirection !== normalizedDirection ||
        state.pageSwitchButton !== button) {
      clearBookmarkDragPageSwitch(state);
      state.pageSwitchDirection = normalizedDirection;
      state.pageSwitchButton = button;
      button.setAttribute('data-bookmark-drag-page-target', 'true');
    }
    if (state.pageSwitchTimerId) {
      return;
    }
    state.pageSwitchTimerId = window.setTimeout(() => {
      state.pageSwitchTimerId = 0;
      if (!isBookmarkSurfaceDragStateActive(state) || !state.isDragging) {
        clearBookmarkDragPageSwitch(state);
        return;
      }
      const pointerX = Number(state.pendingPointerX);
      const pointerY = Number(state.pendingPointerY);
      if (getBookmarkDragPageSwitchDirection(pointerX, pointerY) !== normalizedDirection) {
        clearBookmarkDragPageSwitch(state);
        return;
      }
      clearDragDropTarget(state);
      clearBookmarkDragFolderSwitch(state);
      const bookmarkState = pageState.bookmarkDragState;
      const isBookmarkDrag = Boolean(bookmarkState && state === bookmarkState);
      if (bookmarkState && isBookmarkDrag) {
        restoreBookmarkDragPreview(bookmarkState);
      }
      if (!switchBookmarkPageDuringDrag(pageState.bookmarkCurrentPage + normalizedDirection)) {
        clearBookmarkDragPageSwitch(state);
        return;
      }
      if (bookmarkState && isBookmarkDrag) {
        updateBookmarkDragLayoutCache(bookmarkState);
        setBookmarkDragCardTransform(bookmarkState, pointerX, pointerY);
      } else {
        setShortcutDragTileTransform(state, pointerX, pointerY);
      }
      const nextDirection = getBookmarkDragPageSwitchDirection(pointerX, pointerY);
      if (nextDirection === normalizedDirection) {
        scheduleBookmarkDragPageSwitch(state, normalizedDirection);
      } else {
        clearBookmarkDragPageSwitch(state);
      }
    }, BOOKMARK_DRAG_PAGE_SWITCH_DELAY_MS);
  }

  function processBookmarkDragMove(state: BookmarkDragSession): void {
    if (!state || pageState.bookmarkDragState !== state || !state.isDragging) {
      return;
    }
    state.moveFrameId = 0;
    document.body.removeAttribute('data-drag-blocked');
    const pointerX = Number(state.pendingPointerX);
    const pointerY = Number(state.pendingPointerY);
    if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
      return;
    }
    if (state.folderSwitchPendingId) {
      clearBookmarkDragPageSwitch(state);
      clearDragDropTarget(state);
      setBookmarkDragCardTransform(state, pointerX, pointerY);
      return;
    }
    const topbarScrollDelta = pageState.bookmarkTopbarRuntime &&
      pageState.bookmarkTopbarRuntime.isActive() &&
      pageState.bookmarkTopbarRuntime.isVisible()
      ? pageState.bookmarkTopbarRuntime.autoScroll(pointerX, pointerY)
      : 0;
    if (topbarScrollDelta) {
      updateBookmarkDragLayoutCache(state);
      scheduleBookmarkDragMove(state, pointerX, pointerY);
    }
    if (isPointOverShortcutDropSurface(pointerX, pointerY) && autoScrollShortcutArea(pointerX, pointerY)) {
      scheduleBookmarkDragMove(state, pointerX, pointerY);
    }
    setBookmarkDragCardTransform(state, pointerX, pointerY);
    const pageSwitchDirection = getBookmarkDragPageSwitchDirection(pointerX, pointerY);
    if (pageSwitchDirection) {
      clearBookmarkDragFolderSwitch(state);
      clearDragDropTarget(state);
      restoreBookmarkDragPreview(state);
      setBookmarkDragCardTransform(state, pointerX, pointerY);
      scheduleBookmarkDragPageSwitch(state, pageSwitchDirection);
      return;
    }
    clearBookmarkDragPageSwitch(state);
    if (isPointOverShortcutDropSurface(pointerX, pointerY)) {
      clearBookmarkDragFolderSwitch(state);
      restoreBookmarkDragPreview(state);
      setBookmarkDragCardTransform(state, pointerX, pointerY);
      const folderTarget = getShortcutFolderDropTargetAt(state, pointerX, pointerY);
      if (folderTarget && folderTarget.kind === 'blocked') {
        document.body.setAttribute('data-drag-blocked', 'true');
        clearDragDropTarget(state);
        return;
      }
      const shortcutTarget = folderTarget || getBookmarkDragShortcutDropTarget(state, pointerX, pointerY);
      if (shortcutTarget) {
        setDragDropTarget(state, shortcutTarget);
        if (folderTarget) {
          scheduleBookmarkDragFolderSwitch(state, folderTarget);
        }
      } else {
        clearDragDropTarget(state);
      }
      return;
    }
    const crossLevelTarget = getBookmarkCrossLevelDropTarget(state, pointerX, pointerY);
    if (crossLevelTarget) {
      scheduleBookmarkDragFolderSwitch(state, crossLevelTarget);
      restoreBookmarkDragPreview(state);
      setBookmarkDragCardTransform(state, pointerX, pointerY);
      setDragDropTarget(state, crossLevelTarget);
      return;
    }
    clearBookmarkDragFolderSwitch(state);
    clearDragDropTarget(state);
    restoreBookmarkDragPreview(state);
    setBookmarkDragCardTransform(state, pointerX, pointerY);
  }

  function scheduleBookmarkDragMove(state: BookmarkDragSession | null, pointerX: number, pointerY: number): void {
    if (!state || !state.isDragging) {
      return;
    }
    state.pendingPointerX = pointerX;
    state.pendingPointerY = pointerY;
    if (state.moveFrameId) {
      return;
    }
    state.moveFrameId = window.requestAnimationFrame(() => {
      processBookmarkDragMove(state);
    });
  }

  const {
    deleteBookmarkFromContextTarget,
    getBookmarkUndoShortcutLabel,
    persistBookmarkDragOrder,
    persistBookmarkCrossLevelMove,
    performBookmarkMoveHistoryAction
  } = BOOKMARK_MOVE_ACTIONS.createBookmarkMoveActions({
    bookmarksRuntime,
    bookmarkMoveHistory,
    NEWTAB_BOOKMARK_MOVE_HISTORY,
    NEWTAB_CROSS_SURFACE_DRAG,
    transfer: { applyBookmarkShortcutTransfer, applyShortcutStack },
    applyShortcutGroupDeleteRecord,
    persistShortcuts,
    MAX_NEWTAB_SHORTCUTS,
    refreshShortcutFolderReferences,
    scheduleWallpaperAdaptiveToneUpdate,
    markBookmarkTreeDirty,
    loadBookmarks,
    refreshOpenBookmarkCascadeMenu: (refreshOptions) => refreshOpenBookmarkCascadeMenu(refreshOptions),
    queueLayoutAnimation: (excludedBookmarkId) => queueBookmarkLayoutAnimation(excludedBookmarkId),
    dropLayoutAnimation: () => {
      bookmarkPendingLayoutAnimation = null;
    },
    showToast,
    t,
    formatMessage,
    pageState
  });

  function refreshOpenBookmarkCascadeMenu(refreshOptions?: CascadeRefreshOptions): Promise<boolean> {
    if (!pageState.bookmarkCascadeRuntime || !pageState.bookmarkCascadeRuntime.isOpen()) {
      return Promise.resolve(false);
    }
    return pageState.bookmarkCascadeRuntime.refresh(refreshOptions).catch((error: unknown) => {
      console.warn('[Lumno] Failed to refresh bookmark cascade after move', error);
      return false;
    });
  }

  // Moves the open menu onto its folder's card or shortcut drawn anew.
  function syncOpenBookmarkCascadeAnchorVisual(): boolean {
    if (!pageState.bookmarkCascadeRuntime || !pageState.bookmarkCascadeRuntime.isOpen()) {
      return false;
    }
    const rootFolderId = String(pageState.bookmarkCascadeRuntime.getRootFolderId() || '');
    if (!rootFolderId) {
      return false;
    }
    const shortcutAnchor = getShortcutReorderTiles().find((tile) =>
      tile.getAttribute('data-bookmark-id') === rootFolderId
    );
    const currentShortcutAnchor = shortcutAnchor && shortcutAnchor.getAttribute('aria-expanded') === 'true';
    const nextAnchor = (currentShortcutAnchor && shortcutAnchor) || getBookmarkReorderCards().find((card) =>
      getBookmarkCardId(card) === rootFolderId
    ) || shortcutAnchor;
    return nextAnchor
      ? pageState.bookmarkCascadeRuntime.rebindAnchor(nextAnchor, { instant: true })
      : false;
  }

  function isBookmarkDragActive(): boolean {
    return Boolean(
      (pageState.bookmarkDragState && pageState.bookmarkDragState.isDragging) ||
      (pageState.bookmarkGrid && pageState.bookmarkGrid.getAttribute('data-bookmark-dragging') === 'true')
    );
  }

  function isBookmarkReorderInteractionActive(): boolean {
    return Boolean(pageState.bookmarkDragState || isBookmarkDragActive());
  }

  // Bookmark cards and cascade rows show no hover while a drag is on.
  function shouldSuppressBookmarkHover(target: Element | null | undefined): boolean {
    return Boolean(
      target &&
      (isBookmarkReorderInteractionActive() || isShortcutDragActive()) &&
      (
        target.classList.contains('x-nt-bookmark-card') ||
        target.closest('.x-nt-bookmark-card, .x-nt-bookmark-cascade-item')
      )
    );
  }

  function startBookmarkDrag(event: PointerEvent, card: BookmarkDragSource): void {
    if (!pageState.bookmarkGrid || !card || !pageState.bookmarkDragState || pageState.bookmarkDragState.card !== card) {
      return;
    }
    pageState.bookmarkDragState.isDragging = true;
    if (document.body) {
      document.body.setAttribute('data-drag-source', 'bookmark');
    }
    hideCursorTooltip();
    const activeElement = document.activeElement;
    if (isHtmlElement(activeElement) && isEditableElement(activeElement)) {
      activeElement.blur();
    }
    if (pageState.bookmarkDragState.sourceKind === 'cascade') {
      if (pageState.bookmarkCascadeRuntime) {
        pageState.bookmarkCascadeRuntime.setDragMode(true);
      }
    } else {
      closeBookmarkCascadeMenu();
    }
    if (pageState.bookmarkDragState.sourceKind !== 'cascade') {
      pageState.bookmarkGrid.setAttribute('data-bookmark-dragging', 'true');
    }
    card.setAttribute('data-bookmark-dragging', 'true');
    card.setAttribute('aria-grabbed', 'true');
    if (typeof card._xDeactivateBookmarkHoverVisual === 'function') {
      card._xDeactivateBookmarkHoverVisual();
    }
    card.style.pointerEvents = 'none';
    updateBookmarkDragLayoutCache(pageState.bookmarkDragState);
    createBookmarkCascadeDragPreview(pageState.bookmarkDragState);
    setBookmarkDragCardTransform(pageState.bookmarkDragState, Number(event.clientX), Number(event.clientY));
    try {
      card.setPointerCapture(event.pointerId);
    } catch (error) {
      // Pointer capture can fail if the browser already canceled the pointer.
    }
  }

  function clearBookmarkDragCardVisual(card: HTMLElement): void {
    const dropTimer = cardDropTimers.get(card);
    if (dropTimer) {
      window.clearTimeout(dropTimer);
      cardDropTimers.delete(card);
    }
    card.removeAttribute('data-bookmark-dragging');
    card.removeAttribute('data-bookmark-dropping');
    card.removeAttribute('aria-grabbed');
    card.style.removeProperty('transition');
    card.style.removeProperty('transform');
    card.style.removeProperty('will-change');
    card.style.pointerEvents = '';
  }

  function clearBookmarkDragSourceVisual(state: BookmarkDragSession): void {
    removeBookmarkCascadeDragPreview(state);
    clearBookmarkDragCardVisual(state.card);
  }

  function attachBookmarkDragDocumentListeners() {
    document.addEventListener('pointermove', handleBookmarkDragPointerMove, true);
    document.addEventListener('pointerup', handleBookmarkDragPointerUp, true);
    document.addEventListener('pointercancel', handleBookmarkDragPointerCancel, true);
    document.addEventListener('selectstart', handleBookmarkDragSelectStart, true);
  }

  function detachBookmarkDragDocumentListeners() {
    document.removeEventListener('pointermove', handleBookmarkDragPointerMove, true);
    document.removeEventListener('pointerup', handleBookmarkDragPointerUp, true);
    document.removeEventListener('pointercancel', handleBookmarkDragPointerCancel, true);
    document.removeEventListener('selectstart', handleBookmarkDragSelectStart, true);
  }

  function handleBookmarkDragSelectStart(event: Event): void {
    if (!pageState.bookmarkDragState) {
      return;
    }
    event.preventDefault();
  }

  // Ends the drag on the pointer's release (or cancel) and makes its drop.
  function finishBookmarkDrag(event: PointerEvent | null, finishOptions?: { canceled?: boolean }): void {
    if (!pageState.bookmarkDragState) {
      return;
    }
    if (event && pageState.bookmarkDragState.pointerId !== event.pointerId) {
      return;
    }
    if (document.body) {
      document.body.removeAttribute('data-drag-source');
      document.body.removeAttribute('data-drag-blocked');
    }
    const state = pageState.bookmarkDragState;
    detachBookmarkDragDocumentListeners();
    if (state.isDragging && state.moveFrameId) {
      cancelBookmarkDragMoveFrame(state);
      processBookmarkDragMove(state);
    }
    clearBookmarkDragPageSwitch(state);
    clearBookmarkDragFolderSwitch(state);
    const canceled = Boolean(finishOptions && finishOptions.canceled);
    const dropTarget = canceled ? null : state.dropTarget;
    state.draggedVisualRect = state.isDragging && dropTarget
      ? getBookmarkDragVisualRect(state)
      : null;
    clearDragDropTarget(state);
    const shouldKeepCascadeOpen =
      NEWTAB_BOOKMARK_DRAG.shouldKeepCascadeOpenAfterDrop(
        state.sourceKind,
        dropTarget
    );
    state.keepCascadeOpenAfterDrop = Boolean(dropTarget && shouldKeepCascadeOpen);
    if (state.isDragging) {
      if (shouldKeepCascadeOpen && pageState.bookmarkCascadeRuntime) {
        pageState.bookmarkCascadeRuntime.setDragMode(false);
      } else {
        closeBookmarkCascadeMenu({ animate: true });
      }
    }
    if (canceled) {
      restoreBookmarkDragPreview(state);
    }
    pageState.bookmarkDragState = null;
    document.body.removeAttribute('data-drag-blocked');
    state.folderSwitchPendingId = '';
    const card = state.card;
    if (pageState.bookmarkGrid) {
      pageState.bookmarkGrid.removeAttribute('data-bookmark-dragging');
    }
    if (card) {
      card.removeAttribute('aria-grabbed');
      try {
        card.releasePointerCapture(state.pointerId);
      } catch (error) {
        // Ignore stale pointer capture releases.
      }
      if (state.isDragging && dropTarget) {
        clearBookmarkDragSourceVisual(state);
      } else if (state.isDragging && state.sourceKind === 'cascade') {
        clearBookmarkDragSourceVisual(state);
      } else if (state.isDragging && state.dragPreviewElement) {
        clearBookmarkDragSourceVisual(state);
      } else if (state.isDragging) {
        settleBookmarkDragCard(card);
      } else {
        removeBookmarkCascadeDragPreview(state);
        card.removeAttribute('data-bookmark-dragging');
        card.removeAttribute('data-bookmark-dropping');
        card.style.pointerEvents = '';
      }
      if (state.isDragging) {
        LumnoNewtabDragClickGuard.getDragClickGuard().armAfterDrag(event, state.pointerId);
      }
    }
    if (state.isDragging && dropTarget && dropTarget.surface === 'shortcuts' && dropTarget.kind === 'insertion') {
      if (event) {
        event.preventDefault();
      }
      moveBookmarkToShortcuts(state, dropTarget);
    } else if (state.isDragging && dropTarget) {
      if (event) {
        event.preventDefault();
      }
      queueBookmarkLayoutAnimation(state.bookmarkId, {
        draggedBookmarkId: state.bookmarkId,
        draggedRect: state.draggedVisualRect
      });
      persistBookmarkCrossLevelMove(state, dropTarget);
    } else if (!canceled && state.isDragging && state.hasReordered) {
      if (event) {
        event.preventDefault();
      }
      queueBookmarkLayoutAnimation(state.bookmarkId, {
        draggedBookmarkId: state.bookmarkId,
        draggedRect: state.draggedVisualRect
      });
      persistBookmarkDragOrder(state);
    } else if (
      state.isDragging &&
      pageState.bookmarkGrid &&
      pageState.bookmarkGrid.getAttribute('data-bookmark-empty-drop-surface') ===
        'true'
    ) {
      renderCurrentBookmarkPage();
    }
  }

  function beginBookmarkDragPointerTracking(
    event: PointerEvent,
    card: BookmarkDragSource | null,
    bookmarkItem: BookmarkCardElement['_xBookmarkItem'] | BookmarkItem | null | undefined,
    sourceKind: 'card' | 'cascade'
  ): boolean {
    if (!event || !card || pageState.bookmarkDragState || pageState.bookmarkMoveHistoryBusy ||
        BOOKMARK_DRAG_RULES.isMacContextClick(event, navigator)) {
      return false;
    }
    const bookmarkId = getBookmarkCardId(card);
    const parentId = getBookmarkCardParentId(card);
    if (!card || !bookmarkId || !parentId ||
        card.getAttribute('data-bookmark-draggable') !== 'true' ||
        (event.pointerType === 'mouse' && event.button !== 0)) {
      return false;
    }
    hideCursorTooltip();
    closeBookmarkContextMenu();
    const isOpenCascadeAnchor = Boolean(
      sourceKind !== 'cascade' &&
      pageState.bookmarkCascadeRuntime &&
      pageState.bookmarkCascadeRuntime.isOpen() &&
      card.getAttribute('aria-expanded') === 'true'
    );
    if (sourceKind !== 'cascade' && !isOpenCascadeAnchor) {
      closeBookmarkCascadeMenu();
    }
    const pageIndex = sourceKind === 'cascade' ? -1 : getBookmarkCardInsertionIndex(card);
    const session = NEWTAB_BOOKMARK_DRAG.createSession({
      allItems: pageState.bookmarkAllItems,
      bookmarkItem,
      card,
      event,
      bookmarkId,
      parentId,
      pageIndex,
      pageCardIds: getBookmarkReorderCards().map((reorderCard) => getBookmarkCardId(reorderCard)),
      sourceKind
    });
    pageState.bookmarkDragState = session;
    attachBookmarkDragDocumentListeners();
    const rect = sourceKind === 'cascade'
      ? card.getBoundingClientRect()
      : getBookmarkCardLayoutRect(card) || card.getBoundingClientRect();
    session.grabOffsetX = Number(event.clientX) - rect.left;
    session.grabOffsetY = Number(event.clientY) - rect.top;
    session.baseLeft = rect.left;
    session.baseTop = rect.top;
    if (typeof card._xDeactivateBookmarkHoverVisual === 'function') {
      card._xDeactivateBookmarkHoverVisual();
    }
    return true;
  }

  function handleBookmarkDragPointerDown(event: PointerEvent): void {
    if (pageState.bookmarkPageAnimating || pageState.bookmarkDragState) {
      return;
    }
    if (isElementNode(event.target) && event.target.closest('.x-nt-bookmark-copy-action')) {
      return;
    }
    const card = getBookmarkCardFromNode(event.target);
    beginBookmarkDragPointerTracking(event, card, card && card._xBookmarkItem, 'card');
  }

  function handleBookmarkCascadeItemPointerDown(payload: CascadeItemEventDetail<PointerEvent>): void {
    const event = payload.event;
    const element = payload.element;
    const item = payload.item;
    if (pageState.bookmarkPageAnimating || pageState.bookmarkDragState || !event || !element || !item) {
      return;
    }
    beginBookmarkDragPointerTracking(event, element, item, 'cascade');
  }

  function handleBookmarkDragPointerMove(event: PointerEvent): void {
    if (!pageState.bookmarkDragState || pageState.bookmarkDragState.pointerId !== event.pointerId) {
      return;
    }
    const pointerX = Number(event.clientX);
    const pointerY = Number(event.clientY);
    if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
      return;
    }
    const dx = pointerX - pageState.bookmarkDragState.startX;
    const dy = pointerY - pageState.bookmarkDragState.startY;
    if (!pageState.bookmarkDragState.isDragging &&
        Math.hypot(dx, dy) < BOOKMARK_DRAG_START_THRESHOLD_PX) {
      return;
    }
    if (!pageState.bookmarkDragState.isDragging) {
      startBookmarkDrag(event, pageState.bookmarkDragState.card);
    }
    if (!pageState.bookmarkDragState.isDragging) {
      return;
    }
    event.preventDefault();
    scheduleBookmarkDragMove(pageState.bookmarkDragState, pointerX, pointerY);
  }

  function handleBookmarkDragPointerUp(event: PointerEvent): void {
    finishBookmarkDrag(event);
  }

  function handleBookmarkDragPointerCancel(event: PointerEvent): void {
    finishBookmarkDrag(event, { canceled: true });
  }

  return {
    queueBookmarkLayoutAnimation,
    playPendingBookmarkLayoutAnimation,
    updateBookmarkDragLayoutCache,
    setBookmarkDragCardTransform,
    isEmptyBookmarkRootHidden,
    getExternalBookmarkSurfacePoint,
    isValidExternalBookmarkDropTarget,
    getShortcutFolderDropTargetAt,
    getShortcutInsertionDropTarget,
    getExternalBookmarkDropTarget,
    isPointOverShortcutDropSurface,
    applyBookmarkShortcutTransfer,
    applyShortcutStack,
    clearDragDropTarget,
    isBookmarkCascadeSurfaceAtPoint,
    setDragDropTarget,
    getBookmarkDragPageSwitchDirection,
    clearBookmarkDragPageSwitch,
    clearBookmarkDragFolderSwitch,
    scheduleBookmarkDragFolderSwitch,
    scheduleBookmarkDragPageSwitch,
    scheduleBookmarkDragMove,
    deleteBookmarkFromContextTarget,
    addBookmarkFolderToShortcuts,
    hasShortcutForBookmarkFolder,
    getBookmarkUndoShortcutLabel,
    refreshOpenBookmarkCascadeMenu,
    syncOpenBookmarkCascadeAnchorVisual,
    performBookmarkMoveHistoryAction,
    isBookmarkDragActive,
    shouldSuppressBookmarkHover,
    finishBookmarkDrag,
    handleBookmarkDragPointerDown,
    handleBookmarkCascadeItemPointerDown
  };
}

type BookmarkDragController = ReturnType<typeof createBookmarkDragController>;

export { createBookmarkDragController };
export type {
  BookmarkDeleteTarget,
  BookmarkDragController,
  BookmarkDragControllerDeps,
  BookmarkDragControllerState
};
