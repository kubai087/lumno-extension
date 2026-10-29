// Bookmark grid paging: page slicing, pager buttons, grid height lock and
// animated page switches.
import { isHtmlElement, isSvgElement } from '../../shared/dom-guards';
import * as LumnoNewtabCrossSurfaceDrag from '../cross-surface-drag';
import type { BookmarkItem } from './bookmarks-store';
import * as NEWTAB_BOOKMARKS_STORE from './bookmarks-store';
import type { BookmarksShown } from './bookmarks-shown';
import type { SettingsStore } from '../../platform/settings-store';
import { bookmarkViewMode } from '../../domain/settings/bookmarks';
import type { BookmarkSectionParts } from './bookmark-section-parts';
import type { DragSessions } from '../drag-sessions';
import { bookmarkSectionEvents } from './bookmark-section-events';


interface BookmarkPagerDeps {
  getBookmarkLimit(): number;
  updateBookmarkHeader(): void;
  getBookmarkGridColumnCount(): number;
  updateBookmarkSectionPosition(options?: { preserveSearchEntryLayout?: boolean }): void;
  now?: () => number;
  bookmarksShown: Pick<BookmarksShown, 'allItems' | 'currentFolderId' | 'currentPage' | 'drawn' | 'pageAnimating' | 'pagerAvailability' | 'renderSignature' | 'rootFolderId' | 'rootTotalCount' | 'rootVisibleCount' | 'setPageAnimating' | 'setPagerAvailability' | 'showPage'>;
  bookmarkGrid: HTMLElement;
  settings: Pick<SettingsStore, 'get'>;
  bookmarkParts: Pick<BookmarkSectionParts, 'view'>;
  dragSessions: Pick<DragSessions, 'bookmark' | 'recentCardDragging' | 'shortcutDragging'>;
  shortcutSection: HTMLElement;
  setBookmarkSurfaceVisible(visible: boolean): void;
}

interface PageSlide {
  startedAt: number;
  cards: Element[];
  finish(): void;
}

function createBookmarkPager(deps: BookmarkPagerDeps) {
  const {
    bookmarkGrid,
    bookmarksShown,
    getBookmarkLimit,
    updateBookmarkHeader,
    getBookmarkGridColumnCount,
    updateBookmarkSectionPosition,
    settings,
    bookmarkParts,
    dragSessions,
    shortcutSection,
    setBookmarkSurfaceVisible
  } = deps;


  function getBookmarkPageCount(): number {
    if (settings.get(bookmarkViewMode) === 'top') {
      return 1;
    }
    const total = Array.isArray(bookmarksShown.allItems) ? bookmarksShown.allItems.length : 0;
    return Math.max(1, Math.ceil(total / getBookmarkLimit()));
  }

  function getBookmarkPageItems(): BookmarkItem[] {
    if (!Array.isArray(bookmarksShown.allItems) || bookmarksShown.allItems.length === 0) {
      return [];
    }
    if (settings.get(bookmarkViewMode) === 'top') {
      bookmarksShown.showPage(0);
      return bookmarksShown.allItems.slice();
    }
    const pageCount = getBookmarkPageCount();
    bookmarksShown.showPage(Math.min(Math.max(0, bookmarksShown.currentPage), pageCount - 1));
    return NEWTAB_BOOKMARKS_STORE.getBookmarkPageItems(
      bookmarksShown.allItems,
      bookmarksShown.currentPage,
      getBookmarkLimit()
    );
  }

  function updateBookmarkPagerState(): void {
    const pageCount = getBookmarkPageCount();
    const atStart = bookmarksShown.currentPage <= 0;
    const atEnd = bookmarksShown.currentPage >= (pageCount - 1);
    const previous = !atStart;
    const next = !atEnd;
    const current = bookmarksShown.pagerAvailability;
    if (current.previous === previous && current.next === next) {
      return;
    }
    bookmarksShown.setPagerAvailability({ previous, next });
    updateBookmarkHeader();
  }

  function updateBookmarkGridHeightLock(): void {
    if (!bookmarkGrid) {
      return;
    }
    if (bookmarkGrid.getAttribute('data-bookmark-empty-drop-surface') === 'true') {
      bookmarkGrid.style.setProperty(
        'min-height',
        `${settings.get(bookmarkViewMode) === 'top' ? 44 : 64}px`
      );
      return;
    }
    if (settings.get(bookmarkViewMode) === 'top') {
      bookmarkGrid.style.removeProperty('min-height');
      return;
    }
    const total = Array.isArray(bookmarksShown.allItems) ? bookmarksShown.allItems.length : 0;
    const cols = getBookmarkGridColumnCount();
    const firstCard = bookmarkGrid.querySelector('.x-nt-bookmark-card');
    const cardHeight = firstCard ? firstCard.getBoundingClientRect().height : 51;
    const gridStyle = window.getComputedStyle(bookmarkGrid);
    const rowGap = Number.parseFloat(gridStyle.rowGap) || 16;
    const isAtRoot = String(bookmarksShown.currentFolderId || '') === String(bookmarksShown.rootFolderId || '1');
    const pageLimit = getBookmarkLimit();
    let targetItemCount = 0;

    if (isAtRoot) {
      if (total <= pageLimit) {
        bookmarkGrid.style.removeProperty('min-height');
        return;
      }
      targetItemCount = pageLimit;
    } else {
      if (bookmarksShown.rootTotalCount > pageLimit) {
        targetItemCount = pageLimit;
      } else {
        targetItemCount = Math.max(0, bookmarksShown.rootVisibleCount);
      }
      if (targetItemCount <= 0) {
        if (total <= pageLimit) {
          bookmarkGrid.style.removeProperty('min-height');
          return;
        }
        targetItemCount = pageLimit;
      }
    }

    const rowsPerPage = Math.max(1, Math.ceil(targetItemCount / cols));
    const minHeight = (rowsPerPage * cardHeight) + ((rowsPerPage - 1) * rowGap);
    bookmarkGrid.style.setProperty('min-height', `${Math.ceil(minHeight)}px`);
  }

  // A page slide lasts PAGE_SLIDE_MS. Past PAGE_SLIDE_INTERRUPTIBLE_MS the new
  // page is ~97% of the way in, so the next turn may start from where its
  // cards are; a turn asked for before then waits for that point.
  const PAGE_SLIDE_MS = 520;
  const PAGE_SLIDE_INTERRUPTIBLE_MS = 260;
  const now = typeof deps.now === 'function' ? deps.now : () => performance.now();
  let pageSlide: PageSlide | null = null;
  let queuedPage: number | null = null;
  let queuedPageTimer = 0;

  function clearQueuedBookmarkPage(): void {
    if (queuedPageTimer) window.clearTimeout(queuedPageTimer);
    queuedPageTimer = 0;
    queuedPage = null;
  }

  function queueBookmarkPage(targetPage: number, slide: PageSlide): void {
    if (targetPage === bookmarksShown.currentPage) {
      clearQueuedBookmarkPage();
      return;
    }
    queuedPage = targetPage;
    if (queuedPageTimer) return;
    const wait = Math.max(0, PAGE_SLIDE_INTERRUPTIBLE_MS - (now() - slide.startedAt));
    queuedPageTimer = window.setTimeout(() => {
      const page = queuedPage;
      queuedPageTimer = 0;
      queuedPage = null;
      if (page !== null) switchBookmarkPage(page);
    }, wait);
  }

  // The horizontal offset an interrupted slide has left on a card.
  function readSlideOffset(element: Element | undefined): number {
    const transform = element ? window.getComputedStyle(element).transform : '';
    if (!transform || transform === 'none' || typeof DOMMatrixReadOnly !== 'function') return 0;
    return new DOMMatrixReadOnly(transform).m41 || 0;
  }

  function renderCurrentBookmarkPage(): void {
    clearQueuedBookmarkPage();
    if (pageSlide) pageSlide.finish();
    renderBookmarks(getBookmarkPageItems());
    updateBookmarkPagerState();
  }

  function switchBookmarkPageDuringDrag(nextPage: number): boolean {
    const pageCount = getBookmarkPageCount();
    const targetPage = Math.min(Math.max(0, Number(nextPage) || 0), pageCount - 1);
    if (targetPage === bookmarksShown.currentPage || bookmarksShown.pageAnimating) {
      return false;
    }
    bookmarksShown.showPage(targetPage);
    renderCurrentBookmarkPage();
    updateBookmarkSectionPosition();
    return true;
  }

  function switchBookmarkPage(nextPage: number): void {
    const pageCount = getBookmarkPageCount();
    const targetPage = Math.min(Math.max(0, Number(nextPage) || 0), pageCount - 1);
    if (pageSlide && now() - pageSlide.startedAt < PAGE_SLIDE_INTERRUPTIBLE_MS) {
      queueBookmarkPage(targetPage, pageSlide);
      return;
    }
    clearQueuedBookmarkPage();
    if (targetPage === bookmarksShown.currentPage) {
      return;
    }
    const grid = bookmarkGrid;
    const crossSurfaceDrag = LumnoNewtabCrossSurfaceDrag;
    const motionDisabled = document.documentElement.getAttribute('data-lumno-motion-effects') === 'off';
    if (!grid || typeof grid.animate !== 'function' || motionDisabled ||
        (crossSurfaceDrag && crossSurfaceDrag.prefersReducedMotion(window))) {
      bookmarksShown.showPage(targetPage);
      renderCurrentBookmarkPage();
      updateBookmarkSectionPosition();
      return;
    }
    // Pick up from where an interrupted slide left the cards, so they never jump.
    const carry = pageSlide ? readSlideOffset(pageSlide.cards[0]) : 0;
    if (pageSlide) pageSlide.finish();
    const direction = targetPage > bookmarksShown.currentPage ? 1 : -1;
    const gridStyle = window.getComputedStyle(grid);
    const distance = grid.getBoundingClientRect().width + (Number.parseFloat(gridStyle.columnGap) || 0);
    const outgoing = grid.cloneNode(true);
    if (!isHtmlElement(outgoing)) {
      return;
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
    bookmarksShown.showPage(targetPage);
    renderCurrentBookmarkPage();
    updateBookmarkSectionPosition();
    const incomingCards = Array.from(grid.children);
    // Clip only across the slide, so the cards' shadows above and below stay drawn.
    const previousOverflow = grid.style.getPropertyValue('overflow-x');
    const previousPriority = grid.style.getPropertyPriority('overflow-x');
    grid.style.setProperty('overflow-x', 'clip');
    grid.appendChild(outgoing);
    bookmarksShown.setPageAnimating(true);
    // Slide directly to the destination with a long, smooth deceleration.
    const timing: KeyframeAnimationOptions = { duration: PAGE_SLIDE_MS, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'both' };
    const slideFrames = (from: number, to: number): Keyframe[] => [
      { transform: `translateX(${from}px)`, offset: 0 },
      { transform: `translateX(${to}px)`, offset: 1 }
    ];
    const animations = [outgoing.animate(slideFrames(carry, -direction * distance), timing),
      ...incomingCards.map((card) => card.animate(slideFrames(direction * distance, 0), timing))];
    const startTime = animations[0].startTime;
    if (startTime !== null) animations.forEach((animation) => { animation.startTime = startTime; });
    const slide: PageSlide = {
      startedAt: now(),
      cards: incomingCards,
      finish() {
        if (pageSlide !== slide) return;
        pageSlide = null;
        animations.forEach((animation) => animation.cancel());
        outgoing.remove();
        if (previousOverflow) grid.style.setProperty('overflow-x', previousOverflow, previousPriority);
        else grid.style.removeProperty('overflow-x');
        bookmarksShown.setPageAnimating(false);
      }
    };
    pageSlide = slide;
    Promise.all(animations.map((animation) => animation.finished)).then(slide.finish).catch(slide.finish);
  }

  // Wheel and trackpad paging. A trackpad swipe arrives as a stream of events
  // (finger movement, then momentum) and turns one page; each mouse wheel
  // notch turns one page.
  const WHEEL_GESTURE_GAP_MS = 160;
  const WHEEL_TURN_DISTANCE_PX = 6;
  const WHEEL_REVERSE_MIN_PX = 4;
  const wheelGesture = { lastAt: -Infinity, horizontal: false, sign: 0, notched: false,
    total: 0, turned: false, peak: 0, floor: 0 };

  // Chrome reports a trackpad's wheelDelta as -3x its pixel delta; a mouse
  // notch is a multiple of 120 that does not follow that ratio.
  function isWheelNotch(event: WheelEvent, horizontal: boolean): boolean {
    if (event.deltaMode === 1 || event.deltaMode === 2) return true;
    // wheelDeltaX and wheelDeltaY are Chrome's own.
    const wheelDelta = horizontal
      ? ('wheelDeltaX' in event ? Number(event.wheelDeltaX) || 0 : 0)
      : ('wheelDeltaY' in event ? Number(event.wheelDeltaY) || 0 : 0);
    const delta = Number(horizontal ? event.deltaX : event.deltaY) || 0;
    return wheelDelta !== 0 && wheelDelta % 120 === 0 && Math.abs(wheelDelta + delta * 3) >= 1;
  }

  function handleBookmarkWheel(event: WheelEvent): void {
    if (!event || event.ctrlKey || getBookmarkPageCount() <= 1) {
      return;
    }
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerWidth : 1;
    const deltaX = (Number(event.deltaX) || 0) * unit;
    const deltaY = (Number(event.deltaY) || 0) * unit;
    if (!deltaX && !deltaY) {
      return;
    }
    event.preventDefault();
    const gesture = wheelGesture;
    const at = Number.isFinite(event.timeStamp) && event.timeStamp > 0 ? event.timeStamp : now();
    // A gesture keeps the axis it started on, so trackpad drift on the other
    // axis cannot split one swipe into two.
    const ongoing = at - gesture.lastAt <= WHEEL_GESTURE_GAP_MS;
    const horizontal = ongoing ? gesture.horizontal : Math.abs(deltaX) > Math.abs(deltaY);
    const delta = horizontal ? deltaX : deltaY;
    gesture.lastAt = at;
    if (!delta) {
      return;
    }
    const size = Math.abs(delta);
    const reversed = Math.sign(delta) !== gesture.sign && size >= WHEEL_REVERSE_MIN_PX;
    // Once a swipe has turned the page its momentum only slows down, so a
    // burst well above where it slowed to is a new swipe.
    const renewed = gesture.turned && !gesture.notched &&
      gesture.floor <= gesture.peak / 4 && size >= Math.max(16, gesture.floor * 3);
    if (!ongoing || reversed || renewed) {
      Object.assign(gesture, { horizontal, sign: Math.sign(delta), notched: isWheelNotch(event, horizontal),
        total: 0, turned: false, peak: 0, floor: 0 });
    } else if (Math.sign(delta) !== gesture.sign) {
      return;
    }
    gesture.total += size;
    if (size >= gesture.peak) {
      gesture.peak = size;
      gesture.floor = size;
    } else {
      gesture.floor = Math.min(gesture.floor, size);
    }
    if (!gesture.notched && (gesture.turned || gesture.total < WHEEL_TURN_DISTANCE_PX)) {
      return;
    }
    gesture.turned = true;
    const targetPage = bookmarksShown.currentPage + gesture.sign;
    if (targetPage >= 0 && targetPage < getBookmarkPageCount()) {
      switchBookmarkPage(targetPage);
    }
  }


  function isDragActive(): boolean {
    return Boolean((dragSessions.bookmark && dragSessions.bookmark.isDragging) ||
      dragSessions.shortcutDragging || dragSessions.recentCardDragging);
  }

  function getShortcutAreaLimit(): string {
    return shortcutSection.style.getPropertyValue('--x-nt-shortcuts-max-height');
  }

  function showEmptyBookmarkRoot(visible: boolean, keepForDrag: boolean): void {
    const limitBefore = getShortcutAreaLimit();
    const layoutOptions = isDragActive() ? { preserveSearchEntryLayout: true } : undefined;
    setBookmarkSurfaceVisible(visible);
    updateBookmarkGridHeightLock();
    updateBookmarkSectionPosition(layoutOptions);
    const limitAfter = getShortcutAreaLimit();
    const coversShortcuts = keepForDrag && limitAfter &&
      (!limitBefore || Number.parseFloat(limitAfter) < Number.parseFloat(limitBefore));
    if (!coversShortcuts) {
      return;
    }
    if (bookmarkGrid) {
      bookmarkGrid.removeAttribute('data-bookmark-empty-drop-surface');
    }
    setBookmarkSurfaceVisible(false);
    updateBookmarkGridHeightLock();
    updateBookmarkSectionPosition(layoutOptions);
  }

  // Draws a page of bookmarks into the grid, or the empty root.
  function renderBookmarks(items: BookmarkItem[] | null | undefined): void {
    if (!bookmarkParts.view) {
      return;
    }
    const normalizedItems = Array.isArray(items) ? items : [];
    const isAtRoot = String(bookmarksShown.currentFolderId || '') === String(bookmarksShown.rootFolderId || '1');
    const keepEmptyRootVisibleForDrag = Boolean(
      isAtRoot &&
      normalizedItems.length === 0 &&
      ((dragSessions.bookmark && dragSessions.bookmark.isDragging) ||
        dragSessions.shortcutDragging || dragSessions.recentCardDragging)
    );
    if (bookmarkGrid) {
      if (keepEmptyRootVisibleForDrag) {
        bookmarkGrid.setAttribute('data-bookmark-empty-drop-surface', 'true');
      } else {
        bookmarkGrid.removeAttribute('data-bookmark-empty-drop-surface');
      }
    }
    const renderResult = bookmarkParts.view.render(normalizedItems, {
      signature: bookmarksShown.renderSignature,
      folderId: bookmarksShown.currentFolderId,
      rootFolderId: bookmarksShown.rootFolderId,
      viewMode: settings.get(bookmarkViewMode),
      menuMode: settings.get(bookmarkViewMode) === 'list' || settings.get(bookmarkViewMode) === 'top'
    });
    bookmarkSectionEvents.emit('drawn', { folderId: String(bookmarksShown.currentFolderId || '') });
    if (!renderResult.changed) {
      if (normalizedItems.length === 0) {
        showEmptyBookmarkRoot(!isAtRoot || keepEmptyRootVisibleForDrag, keepEmptyRootVisibleForDrag);
      } else {
        setBookmarkSurfaceVisible(true);
        updateBookmarkGridHeightLock();
        updateBookmarkSectionPosition();
      }
      updateBookmarkPagerState();
      return;
    }
    bookmarksShown.drawn(renderResult.signature);
    if (normalizedItems.length === 0) {
      showEmptyBookmarkRoot(!isAtRoot || keepEmptyRootVisibleForDrag, keepEmptyRootVisibleForDrag);
      updateBookmarkPagerState();
      return;
    }
    setBookmarkSurfaceVisible(true);
    updateBookmarkPagerState();
    updateBookmarkGridHeightLock();
    updateBookmarkSectionPosition();
  }

  // The header's pager turns a page within the pages there are.
  bookmarkSectionEvents.on('pageRequested', ({ step }) => {
    const target = bookmarksShown.currentPage + step;
    if (target >= 0 && target < getBookmarkPageCount()) {
      switchBookmarkPage(target);
    }
  });
  return {
    getBookmarkPageCount,
    updateBookmarkPagerState,
    updateBookmarkGridHeightLock,
    renderCurrentBookmarkPage,
    switchBookmarkPageDuringDrag,
    switchBookmarkPage,
    handleBookmarkWheel
  };
}

type BookmarkPager = ReturnType<typeof createBookmarkPager>;

export { createBookmarkPager };
export type { BookmarkPager, BookmarkPagerDeps };
