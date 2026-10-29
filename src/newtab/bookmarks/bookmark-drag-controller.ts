// Bookmark card layout animation, drag and drop (within the grid, across
// folders and onto shortcuts) and the bookmark move undo history.
import type { ShortcutAreaScroll } from '../dom/shortcut-area-scroll';
import type { BookmarkCascadeActions } from './bookmark-cascade-actions';
import { getShortcutInsertionSlotAt, getShortcutReorderTiles, getShortcutTileId, getShortcutTileLayoutRect, placeShortcutDragTile } from '../dom/shortcut-tiles';
import { getBookmarkCardFromNode, getBookmarkCardId, getBookmarkCardLayoutRect, getBookmarkReorderCards } from '../dom/bookmark-cards';
import { BOOKMARK_REORDER_EASING } from '../dom/bookmark-layout-animation';
import type { BookmarkLayoutAnimation } from '../dom/bookmark-layout-animation';
import { isElementNode, isHtmlElement, isHtmlTag, isEditableElement } from '../../shared/dom-guards';
import { createSvgElement } from '../../shared/ui/svg-tree';
import type { BlockedDropTarget, DragDropTarget, FolderDropTarget, GridInsertionTarget, ShortcutInsertionTarget, SurfaceDragState } from '../cross-surface-drag';
import * as LumnoNewtabDragClickGuard from '../drag-click-guard';
import type { BookmarkCardElement } from '../react/bookmarks';
import type { BookmarkCascadeRuntime, CascadeItemEventDetail } from '../dom/bookmark-cascade-menu';
import type { BookmarkDragSession, BookmarkDragSource, BookmarkLayoutItem } from '../dom/bookmark-drag';
import type * as FolderIcon from '../dom/folder-icon';
import { describeFolderIcon } from './bookmark-folder-icon';
import type { BookmarkItem } from './bookmarks-store';
import * as BOOKMARK_DRAG_RULES from './bookmark-drag-rules';
import type { BookmarkMoveActions } from './bookmark-move-actions';
import type { BookmarkDeleteTarget } from './bookmark-move-actions';
import type { BookmarkShortcutTransfer } from './bookmark-shortcut-transfer';
import type { AnimationRect } from './bookmark-drag-rules';
import type { BookmarksRuntime } from './bookmarks-runtime';
import { isShortcutFolder } from '../../domain/shortcuts/normalize';
import type { ShortcutItem } from '../../domain/shortcuts/types';
import * as ShortcutNormalize from '../../domain/shortcuts/normalize';
import type { SettingPreview } from '../setting-preview';
import { bookmarkCount, bookmarkViewMode } from '../../domain/settings/bookmarks';
import type { SettingsStore } from '../../platform/settings-store';
import * as NEWTAB_BOOKMARK_DRAG from '../dom/bookmark-drag';
import * as NEWTAB_CROSS_SURFACE_DRAG from '../cross-surface-drag';
import * as NEWTAB_BOOKMARK_MOVE_HISTORY from './bookmark-move-history';
import { DEFAULT_MAX_SHORTCUTS } from '../../domain/shortcuts/constants';
import type { ShortcutList } from '../shortcuts/shortcut-list';
import type { BookmarksShown } from './bookmarks-shown';
import type { BookmarkSectionParts } from './bookmark-section-parts';
import type { MoveHistoryLock } from './move-history-lock';
import type { DragSessions } from '../drag-sessions';
import { setFolderPathMorphState } from '../dom/folder-icon';
import { bookmarkSectionEvents } from './bookmark-section-events';


interface BookmarkDragControllerDeps {
  settings: Pick<SettingsStore, 'get'>;
  preview: Pick<SettingPreview, 'get'>;
  getBookmarkLimit(): number;
  initFolderPathMorph: typeof FolderIcon.initFolderPathMorph;
  isContentSectionVisible(section: HTMLElement | null): boolean;
  bookmarkSection: HTMLElement | null;
  bookmarksRuntime: BookmarksRuntime;
  getShortcutById(id: string): ShortcutItem | null;
  // The local bookmark folder a folder shortcut shows.
  getShortcutFolderId(shortcut: ShortcutItem): string;
  getShortcutStoreOptions(): Parameters<typeof ShortcutNormalize.createShortcutRecord>[1];
  getBookmarkPageCount(): number;
  openBookmarkCascadeMenu(...args: Parameters<BookmarkCascadeRuntime['open']>): void;
  navigateBookmarkFolder(folderId: string): void;
  // Shows another page of the bookmarks during a drag; false when it cannot.
  switchBookmarkPageDuringDrag(page: number): boolean;
  hideCursorTooltip(): void;
  closeBookmarkCascadeMenu(options?: { animate?: boolean }): void;
  renderCurrentBookmarkPage(): void;
  // Scrolls the shortcuts while a drag rests near their edge.
  closeBookmarkContextMenu(): void;
  shortcutList: Pick<ShortcutList, 'icons' | 'items'>;
  shortcutSection: HTMLElement;
  shortcutGrid: HTMLElement;
  bookmarksShown: Pick<BookmarksShown, 'allItems' | 'currentFolderId' | 'currentPage' | 'loadedOnce' | 'pageAnimating' | 'rootFolderId' | 'setItems'>;
  bookmarkParts: Pick<BookmarkSectionParts, 'cascade' | 'topbar'>;
  bookmarkGrid: HTMLElement;
  bookmarkPagerPrevButton: HTMLElement;
  bookmarkPagerNextButton: HTMLElement;
  historyLock: Pick<MoveHistoryLock, 'busy' | 'hold' | 'release'>;
  dragSessions: Pick<DragSessions, 'bookmark' | 'isSurfaceDragRunning' | 'setBookmark' | 'shortcut' | 'shortcutDragging'>;
  getAddShortcutButton(): HTMLElement | null;
  syncOpenBookmarkCascadeAnchorVisual: BookmarkCascadeActions['syncOpenBookmarkCascadeAnchorVisual'];
  shortcutAreaScroll: Pick<ShortcutAreaScroll, 'step'>;
  bookmarkLayoutAnimation: Pick<BookmarkLayoutAnimation, 'queue'>;
  moveBookmarkToShortcuts: BookmarkShortcutTransfer['moveBookmarkToShortcuts'];
  persistBookmarkDragOrder: BookmarkMoveActions['persistBookmarkDragOrder'];
  persistBookmarkCrossLevelMove: BookmarkMoveActions['persistBookmarkCrossLevelMove'];
}


type InsertLineTarget = GridInsertionTarget | ShortcutInsertionTarget;

// An insertion or folder row of the open cascade menu.
type CascadeDropTargetLike = Extract<DragDropTarget, { surface: 'cascade'; kind: 'insertion' | 'cascade' }>;

// The grid insertion line or shortcut gap a drop target draws, and what it
// sits by.
type InsertionGapKey = [string, string, HTMLElement | null];

function createBookmarkDragController(deps: BookmarkDragControllerDeps) {
  const {
    shortcutAreaScroll,
    syncOpenBookmarkCascadeAnchorVisual,
    bookmarkLayoutAnimation,
    moveBookmarkToShortcuts,
    persistBookmarkDragOrder,
    persistBookmarkCrossLevelMove,
    dragSessions,
    historyLock,
    bookmarkPagerNextButton,
    bookmarkPagerPrevButton,
    bookmarkGrid,
    bookmarkParts,
    bookmarksShown,
    shortcutGrid,
    shortcutSection,
    shortcutList,
    settings,
    preview,
    getBookmarkLimit,
    initFolderPathMorph,
    isContentSectionVisible,
    bookmarkSection,
    bookmarksRuntime,
    getShortcutById,
    getShortcutFolderId,
    getShortcutStoreOptions,
    getBookmarkPageCount,
    openBookmarkCascadeMenu,
    navigateBookmarkFolder,
    switchBookmarkPageDuringDrag,
    hideCursorTooltip,
    closeBookmarkCascadeMenu,
    renderCurrentBookmarkPage,
    closeBookmarkContextMenu,
    getAddShortcutButton
  } = deps;


  const BOOKMARK_DRAG_START_THRESHOLD_PX = 10;
  const BOOKMARK_DROP_ANIMATION_MS = 210;
  const BOOKMARK_DRAG_PAGE_SWITCH_DELAY_MS = 640;
  const BOOKMARK_DRAG_FOLDER_SWITCH_DELAY_MS = 640;
  const insertionGapOwner = {};
  let insertionGapKey: InsertionGapKey | null = null;
  // The timers that end each card's drop settle.
  const cardDropTimers = new WeakMap<HTMLElement, number>();

  function getBookmarkCardParentId(card: Element): string {
    return card.getAttribute('data-bookmark-parent-id') || '';
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
    return getBookmarkReorderCards(bookmarkGrid).findIndex((item) => item === card);
  }

  function getBookmarkPageStartIndex(): number {
    if (settings.get(bookmarkViewMode) === 'top') {
      return 0;
    }
    return Math.max(0, bookmarksShown.currentPage * getBookmarkLimit());
  }

  function getBookmarkDragVisualRect(state: BookmarkDragSession): AnimationRect | null {
    const visualElement = getBookmarkDragVisualElement(state);
    return visualElement
      ? BOOKMARK_DRAG_RULES.normalizeAnimationRect(visualElement.getBoundingClientRect())
      : null;
  }

  function updateBookmarkDragLayoutCache(state: BookmarkDragSession | null): void {
    if (!state || !state.card) {
      return;
    }
    const draggedCard = state.card;
    state.layoutItems = getCardLayoutItems(getBookmarkReorderCards(bookmarkGrid).filter((card) => card !== draggedCard));
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
    if (!bookmarkGrid || !Number.isFinite(pointerX) ||
        !Number.isFinite(pointerY)) {
      return null;
    }
    const computedStyle = window.getComputedStyle(bookmarkGrid);
    const pageStartIndex = getBookmarkPageStartIndex();
    const pageEndIndex = pageStartIndex + getBookmarkLimit();
    const originalIndex = Number(state.originalIndex);
    const isCrossPageDrag = settings.get(bookmarkViewMode) !== 'top' &&
      state.sourceKind === 'card' &&
      String(state.parentId || '') === String(bookmarksShown.currentFolderId || '') &&
      Number.isFinite(originalIndex) &&
      (originalIndex < pageStartIndex || originalIndex >= pageEndIndex);
    return NEWTAB_BOOKMARK_DRAG.getGridInsertionTarget({
      columnGap: computedStyle.columnGap,
      folderId: bookmarksShown.currentFolderId,
      gridElement: bookmarkGrid,
      isCrossPageDrag,
      layoutItems: state.layoutItems,
      markerVerticalInsetPx: settings.get(bookmarkViewMode) === 'top' ? 3 : 8,
      pageStartIndex,
      pointerX,
      pointerY
    });
  }

  function getBookmarkDropSurfaceElement(): HTMLElement | null {
    if (!bookmarkGrid || preview.get(bookmarkCount) <= 0) {
      return null;
    }
    if (settings.get(bookmarkViewMode) === 'top') {
      return bookmarkParts.topbar && bookmarkParts.topbar.isVisible()
        ? bookmarkParts.topbar.element
        : null;
    }
    return isContentSectionVisible(bookmarkSection) ? bookmarkSection : null;
  }

  function isEmptyBookmarkRootHidden(): boolean {
    return Boolean(
      preview.get(bookmarkCount) > 0 &&
      bookmarksShown.loadedOnce &&
      !getBookmarkDropSurfaceElement() &&
      String(bookmarksShown.currentFolderId || '') === String(bookmarksShown.rootFolderId || '1') &&
      bookmarksShown.allItems.length === 0
    );
  }

  // Where a drag from another surface meets the bookmarks: the point on
  // the bar's row of cards, or the point itself over the section.
  function getExternalBookmarkSurfacePoint(pointerX: number, pointerY: number): { x: number; y: number } | null {
    const surface = getBookmarkDropSurfaceElement();
    if (!surface) {
      return null;
    }
    if (settings.get(bookmarkViewMode) === 'top') {
      return NEWTAB_BOOKMARK_DRAG.getTopbarDropPoint({
        surfaceElement: surface,
        viewportElement: bookmarkParts.topbar ? bookmarkParts.topbar.viewport : null,
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
    const tile = getShortcutReorderTiles(shortcutGrid).find((candidate) => {
      if (!candidate.hasAttribute('data-bookmark-drop-folder-id') || candidate === state.tile) {
        return false;
      }
      const rect = getShortcutTileLayoutRect(shortcutGrid, candidate);
      return rect && pointerX >= rect.left + rect.width * 0.25 &&
        pointerX <= rect.right - rect.width * 0.25 && pointerY >= rect.top && pointerY <= rect.bottom;
    });
    if (!tile) {
      return null;
    }
    const target: FolderDropTarget = { kind: 'shortcut-folder', surface: 'folder', element: tile,
      folderId: tile.getAttribute('data-bookmark-drop-folder-id') || '',
      title: tile.getAttribute('data-shortcut-title') || '' };
    const bookmarkState = dragSessions.bookmark;
    const valid = bookmarkState && state === bookmarkState
      ? isValidBookmarkFolderDropTarget(bookmarkState, target)
      : isValidExternalBookmarkDropTarget(state, target);
    return valid ? target : { kind: 'blocked', surface: 'folder' };
  }

  // Where a drag from the shortcuts or the recent sites would drop on the
  // bookmarks: the open cascade menu, a folder, or a line in the grid.
  function getExternalBookmarkDropTarget(pointerX: number, pointerY: number, state: SurfaceDragState | null): DragDropTarget | null {
    if (bookmarkParts.cascade && bookmarkParts.cascade.isOpen()) {
      const cascadeTarget = bookmarkParts.cascade.updateDragPointer({ clientX: pointerX, clientY: pointerY });
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
    const grid = bookmarkGrid;
    if (!grid) {
      return folderTarget ? resolveExternalBookmarkDropTarget(state, folderTarget) : null;
    }
    const computedStyle = window.getComputedStyle(grid);
    const insertionTarget = NEWTAB_BOOKMARK_DRAG.getGridInsertionTarget({
      columnGap: computedStyle.columnGap,
      folderId: bookmarksShown.currentFolderId,
      gridElement: grid,
      // Keep the shared narrow edge zones over folders so their centers can
      // still accept contents. Other points may snap anywhere in the row.
      hitZonePx: folderTarget ? undefined : grid.getBoundingClientRect().width,
      layoutItems: getCardLayoutItems(getBookmarkReorderCards(bookmarkGrid)),
      markerVerticalInsetPx: settings.get(bookmarkViewMode) === 'top' ? 3 : 8,
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
    const section = shortcutSection;
    return Boolean(
      shortcutGrid &&
      isContentSectionVisible(section) &&
      !isBookmarkCascadeSurfaceAtPoint(pointerX, pointerY) &&
      NEWTAB_BOOKMARK_DRAG.isPointInsideElement(shortcutGrid, pointerX, pointerY) &&
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
    const slot = getShortcutInsertionSlotAt(shortcutGrid, pointerX, pointerY, null, null);
    const canMove = Boolean(NEWTAB_CROSS_SURFACE_DRAG.planBookmarkToShortcut({
      shortcuts: shortcutList.items,
      record,
      index: slot.index,
      groupId: slot.groupId,
      getFolderId: getShortcutFolderId,
      maxShortcuts: DEFAULT_MAX_SHORTCUTS
    }));
    const anchorRect = slot.anchorRect || getShortcutTileLayoutRect(shortcutGrid, getAddShortcutButton());
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
      index: slot.index < getShortcutReorderTiles(shortcutGrid).length
        ? shortcutList.items.findIndex((item) => item.id === getShortcutTileId(getShortcutReorderTiles(shortcutGrid)[slot.index]))
        : shortcutList.items.length,
      groupId: slot.groupId || '',
      record,
      element: null,
      anchorElement: slot.anchorTile,
      markerElement: null,
      markerPosition: slot.markerPosition
    };
  }

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
    const items: HTMLElement[] = (isGrid ? getBookmarkReorderCards(bookmarkGrid) : getShortcutReorderTiles(shortcutGrid))
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
    if (bookmarkParts.cascade) {
      bookmarkParts.cascade.clearDragTarget();
    }
    syncInsertionGap(state, null);
    state.dropTarget = null;
  }

  function restoreBookmarkDragPreview(state: BookmarkDragSession | null): void {
    const grid = bookmarkGrid;
    if (!state || !state.hasReordered || !Array.isArray(state.originalAllItems)) {
      return;
    }
    bookmarksShown.setItems(state.originalAllItems.slice());
    const cardsById = new Map(getBookmarkReorderCards(bookmarkGrid).map((card) => [getBookmarkCardId(card), card]));
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
    const cascadeTarget = bookmarkParts.cascade
      ? bookmarkParts.cascade.updateDragPointer({ clientX: pointerX, clientY: pointerY })
      : null;
    if (cascadeTarget) {
      if (cascadeTarget.kind === 'blocked') {
        cascadeBlocked = true;
      } else {
        const isValidCascadeTarget = cascadeTarget.kind === 'insertion'
          ? isValidBookmarkInsertionDropTarget(state, cascadeTarget)
          : isValidBookmarkFolderDropTarget(state, cascadeTarget);
        if (!isValidCascadeTarget) {
          if (bookmarkParts.cascade) {
            bookmarkParts.cascade.clearDragTarget();
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
    if (bookmarksShown.currentPage > 0 &&
        bookmarkPagerPrevButton &&
        bookmarkPagerPrevButton.getAttribute('aria-disabled') !== 'true' &&
        isPointInsideBookmarkElement(bookmarkPagerPrevButton, pointerX, pointerY)) {
      return -1;
    }
    const pageCount = getBookmarkPageCount();
    if (bookmarksShown.currentPage < (pageCount - 1) &&
        bookmarkPagerNextButton &&
        bookmarkPagerNextButton.getAttribute('aria-disabled') !== 'true' &&
        isPointInsideBookmarkElement(bookmarkPagerNextButton, pointerX, pointerY)) {
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
        : NEWTAB_BOOKMARK_DRAG.getFolderSwitchTarget(bookmarksShown.currentFolderId, target));
    const switchTarget = getSwitchTarget(dropTarget);
    if (!state || !switchTarget || !dragSessions.isSurfaceDragRunning(state) ||
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
      if (!dragSessions.isSurfaceDragRunning(state) || !state.isDragging) {
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
          (activeDropTarget.kind === 'card' && (settings.get(bookmarkViewMode) === 'top' || settings.get(bookmarkViewMode) === 'list')))) {
        openBookmarkCascadeMenu({ id: targetFolderId, title: activeDropTarget.title },
          activeTarget.element, { dragMode: true, shouldOpen: () => dragSessions.isSurfaceDragRunning(state) });
        return;
      }
      clearDragDropTarget(state);
      const bookmarkState = dragSessions.bookmark;
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
    if (!state || !normalizedDirection || !dragSessions.isSurfaceDragRunning(state) || !state.isDragging) {
      clearBookmarkDragPageSwitch(state);
      return;
    }
    const button = normalizedDirection < 0
      ? bookmarkPagerPrevButton
      : bookmarkPagerNextButton;
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
      if (!dragSessions.isSurfaceDragRunning(state) || !state.isDragging) {
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
      const bookmarkState = dragSessions.bookmark;
      const isBookmarkDrag = Boolean(bookmarkState && state === bookmarkState);
      if (bookmarkState && isBookmarkDrag) {
        restoreBookmarkDragPreview(bookmarkState);
      }
      if (!switchBookmarkPageDuringDrag(bookmarksShown.currentPage + normalizedDirection)) {
        clearBookmarkDragPageSwitch(state);
        return;
      }
      if (bookmarkState && isBookmarkDrag) {
        updateBookmarkDragLayoutCache(bookmarkState);
        setBookmarkDragCardTransform(bookmarkState, pointerX, pointerY);
      } else {
        if (dragSessions.shortcut && state === dragSessions.shortcut) {
          placeShortcutDragTile(dragSessions.shortcut, pointerX, pointerY);
        }
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
    if (!state || dragSessions.bookmark !== state || !state.isDragging) {
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
    const topbarScrollDelta = bookmarkParts.topbar &&
      bookmarkParts.topbar.isActive() &&
      bookmarkParts.topbar.isVisible()
      ? bookmarkParts.topbar.autoScroll(pointerX, pointerY)
      : 0;
    if (topbarScrollDelta) {
      updateBookmarkDragLayoutCache(state);
      scheduleBookmarkDragMove(state, pointerX, pointerY);
    }
    if (isPointOverShortcutDropSurface(pointerX, pointerY) && shortcutAreaScroll.step(pointerX, pointerY)) {
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


  function startBookmarkDrag(event: PointerEvent, card: BookmarkDragSource): void {
    if (!bookmarkGrid || !card || !dragSessions.bookmark || dragSessions.bookmark.card !== card) {
      return;
    }
    dragSessions.bookmark.isDragging = true;
    if (document.body) {
      document.body.setAttribute('data-drag-source', 'bookmark');
    }
    hideCursorTooltip();
    const activeElement = document.activeElement;
    if (isHtmlElement(activeElement) && isEditableElement(activeElement)) {
      activeElement.blur();
    }
    if (dragSessions.bookmark.sourceKind === 'cascade') {
      if (bookmarkParts.cascade) {
        bookmarkParts.cascade.setDragMode(true);
      }
    } else {
      closeBookmarkCascadeMenu();
    }
    if (dragSessions.bookmark.sourceKind !== 'cascade') {
      bookmarkGrid.setAttribute('data-bookmark-dragging', 'true');
    }
    card.setAttribute('data-bookmark-dragging', 'true');
    card.setAttribute('aria-grabbed', 'true');
    if (typeof card._xDeactivateBookmarkHoverVisual === 'function') {
      card._xDeactivateBookmarkHoverVisual();
    }
    card.style.pointerEvents = 'none';
    updateBookmarkDragLayoutCache(dragSessions.bookmark);
    createBookmarkCascadeDragPreview(dragSessions.bookmark);
    setBookmarkDragCardTransform(dragSessions.bookmark, Number(event.clientX), Number(event.clientY));
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
    if (!dragSessions.bookmark) {
      return;
    }
    event.preventDefault();
  }

  // Ends the drag on the pointer's release (or cancel) and makes its drop.
  function finishBookmarkDrag(event: PointerEvent | null, finishOptions?: { canceled?: boolean }): void {
    if (!dragSessions.bookmark) {
      return;
    }
    if (event && dragSessions.bookmark.pointerId !== event.pointerId) {
      return;
    }
    if (document.body) {
      document.body.removeAttribute('data-drag-source');
      document.body.removeAttribute('data-drag-blocked');
    }
    const state = dragSessions.bookmark;
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
      if (shouldKeepCascadeOpen && bookmarkParts.cascade) {
        bookmarkParts.cascade.setDragMode(false);
      } else {
        closeBookmarkCascadeMenu({ animate: true });
      }
    }
    if (canceled) {
      restoreBookmarkDragPreview(state);
    }
    dragSessions.setBookmark(null);
    document.body.removeAttribute('data-drag-blocked');
    state.folderSwitchPendingId = '';
    const card = state.card;
    if (bookmarkGrid) {
      bookmarkGrid.removeAttribute('data-bookmark-dragging');
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
      bookmarkLayoutAnimation.queue(state.bookmarkId, {
        draggedBookmarkId: state.bookmarkId,
        draggedRect: state.draggedVisualRect
      });
      persistBookmarkCrossLevelMove(state, dropTarget);
    } else if (!canceled && state.isDragging && state.hasReordered) {
      if (event) {
        event.preventDefault();
      }
      bookmarkLayoutAnimation.queue(state.bookmarkId, {
        draggedBookmarkId: state.bookmarkId,
        draggedRect: state.draggedVisualRect
      });
      persistBookmarkDragOrder(state);
    } else if (
      state.isDragging &&
      bookmarkGrid &&
      bookmarkGrid.getAttribute('data-bookmark-empty-drop-surface') ===
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
    if (!event || !card || dragSessions.bookmark || historyLock.busy ||
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
      bookmarkParts.cascade &&
      bookmarkParts.cascade.isOpen() &&
      card.getAttribute('aria-expanded') === 'true'
    );
    if (sourceKind !== 'cascade' && !isOpenCascadeAnchor) {
      closeBookmarkCascadeMenu();
    }
    const pageIndex = sourceKind === 'cascade' ? -1 : getBookmarkCardInsertionIndex(card);
    const session = NEWTAB_BOOKMARK_DRAG.createSession({
      allItems: bookmarksShown.allItems,
      bookmarkItem,
      card,
      event,
      bookmarkId,
      parentId,
      pageIndex,
      pageCardIds: getBookmarkReorderCards(bookmarkGrid).map((reorderCard) => getBookmarkCardId(reorderCard)),
      sourceKind
    });
    dragSessions.setBookmark(session);
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
    if (bookmarksShown.pageAnimating || dragSessions.bookmark) {
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
    if (bookmarksShown.pageAnimating || dragSessions.bookmark || !event || !element || !item) {
      return;
    }
    beginBookmarkDragPointerTracking(event, element, item, 'cascade');
  }

  function handleBookmarkDragPointerMove(event: PointerEvent): void {
    if (!dragSessions.bookmark || dragSessions.bookmark.pointerId !== event.pointerId) {
      return;
    }
    const pointerX = Number(event.clientX);
    const pointerY = Number(event.clientY);
    if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
      return;
    }
    const dx = pointerX - dragSessions.bookmark.startX;
    const dy = pointerY - dragSessions.bookmark.startY;
    if (!dragSessions.bookmark.isDragging &&
        Math.hypot(dx, dy) < BOOKMARK_DRAG_START_THRESHOLD_PX) {
      return;
    }
    if (!dragSessions.bookmark.isDragging) {
      startBookmarkDrag(event, dragSessions.bookmark.card);
    }
    if (!dragSessions.bookmark.isDragging) {
      return;
    }
    event.preventDefault();
    scheduleBookmarkDragMove(dragSessions.bookmark, pointerX, pointerY);
  }

  function handleBookmarkDragPointerUp(event: PointerEvent): void {
    finishBookmarkDrag(event);
  }

  function handleBookmarkDragPointerCancel(event: PointerEvent): void {
    finishBookmarkDrag(event, { canceled: true });
  }


  // A bookmark drag waiting for a folder to open moves on once its cards are drawn.
  bookmarkSectionEvents.on('drawn', ({ folderId }) => {
    const activeDragState = dragSessions.bookmark;
    if (activeDragState && activeDragState.isDragging && activeDragState.folderSwitchPendingId === folderId) {
      activeDragState.folderSwitchPendingId = '';
      updateBookmarkDragLayoutCache(activeDragState);
      setBookmarkDragCardTransform(
        activeDragState,
        Number(activeDragState.pendingPointerX),
        Number(activeDragState.pendingPointerY)
      );
      scheduleBookmarkDragMove(
        activeDragState,
        Number(activeDragState.pendingPointerX),
        Number(activeDragState.pendingPointerY)
      );
    }
    syncOpenBookmarkCascadeAnchorVisual();
  });
  return {
    updateBookmarkDragLayoutCache,
    setBookmarkDragCardTransform,
    isEmptyBookmarkRootHidden,
    getExternalBookmarkSurfacePoint,
    isValidExternalBookmarkDropTarget,
    getShortcutFolderDropTargetAt,
    getShortcutInsertionDropTarget,
    getExternalBookmarkDropTarget,
    isPointOverShortcutDropSurface,
    clearDragDropTarget,
    isBookmarkCascadeSurfaceAtPoint,
    setDragDropTarget,
    getBookmarkDragPageSwitchDirection,
    clearBookmarkDragPageSwitch,
    clearBookmarkDragFolderSwitch,
    scheduleBookmarkDragFolderSwitch,
    scheduleBookmarkDragPageSwitch,
    scheduleBookmarkDragMove,
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
  BookmarkDragControllerDeps
};
