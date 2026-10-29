// The slide bookmark cards make after a move: where the cards sat is noted
// before the change, and once the moved bookmarks are drawn each card
// slides from there to its new place.
import { bookmarkViewMode } from '../../domain/settings/bookmarks';
import type { SettingsStore } from '../../platform/settings-store';
import type { LayoutRect } from '../cross-surface-drag';
import * as NEWTAB_CROSS_SURFACE_DRAG from '../cross-surface-drag';
import { getBookmarkCardId, getBookmarkCardLayoutRect, getBookmarkReorderCards } from '../dom/bookmark-cards';
import type { BookmarkCardElement } from '../react/bookmarks';
import * as NEWTAB_BOOKMARK_DRAG from './bookmark-drag';
import * as BOOKMARK_DRAG_RULES from './bookmark-drag-rules';
import type { AnimationRect } from './bookmark-drag-rules';
import { bookmarkSectionEvents } from './bookmark-section-events';
import type { BookmarksShown } from './bookmarks-shown';

const BOOKMARK_REORDER_ANIMATION_MS = 180;
const BOOKMARK_REORDER_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

interface PendingLayoutAnimation {
  folderId: string;
  page: number;
  excludedBookmarkId: string;
  draggedBookmarkId: string;
  draggedRect: AnimationRect | null;
  rects: Map<string, LayoutRect>;
}

class BookmarkLayoutAnimation {
  private pending: PendingLayoutAnimation | null = null;
  // The timers that end each card's slide.
  private readonly timers = new WeakMap<HTMLElement, number>();
  private readonly grid: HTMLElement;
  private readonly shown: Pick<BookmarksShown, 'currentFolderId' | 'currentPage'>;
  private readonly settings: Pick<SettingsStore, 'get'>;

  constructor(
    grid: HTMLElement,
    shown: Pick<BookmarksShown, 'currentFolderId' | 'currentPage'>,
    settings: Pick<SettingsStore, 'get'>
  ) {
    this.grid = grid;
    this.shown = shown;
    this.settings = settings;
    // A move's slide plays once the moved bookmarks are drawn.
    bookmarkSectionEvents.on('loaded', () => {
      this.play();
    });
  }

  private clearCard(card: HTMLElement): void {
    const timer = this.timers.get(card);
    if (timer) {
      window.clearTimeout(timer);
      this.timers.delete(card);
    }
    card.style.removeProperty('transition');
    card.style.removeProperty('will-change');
    if (card.getAttribute('data-bookmark-dragging') !== 'true' &&
        card.getAttribute('data-bookmark-dropping') !== 'true') {
      card.style.removeProperty('transform');
    }
  }

  private measure(): Map<string, LayoutRect> {
    const rects = new Map<string, LayoutRect>();
    getBookmarkReorderCards(this.grid).forEach((card) => {
      const bookmarkId = getBookmarkCardId(card);
      const rect = getBookmarkCardLayoutRect(card);
      if (bookmarkId && rect) {
        rects.set(bookmarkId, rect);
      }
    });
    return rects;
  }

  // Notes where the cards are, so the next render slides them from there.
  queue(
    excludedBookmarkId: unknown,
    animationOptions?: { draggedBookmarkId?: string; draggedRect?: AnimationRect | null }
  ): void {
    const options = animationOptions || {};
    const rects = this.measure();
    const draggedRect = BOOKMARK_DRAG_RULES.normalizeAnimationRect(options.draggedRect);
    this.pending = rects.size > 0 || draggedRect
      ? {
        folderId: String(this.shown.currentFolderId || ''),
        page: this.shown.currentPage,
        excludedBookmarkId: String(excludedBookmarkId || ''),
        draggedBookmarkId: String(options.draggedBookmarkId || ''),
        draggedRect,
        rects
      }
      : null;
  }

  // Forgets the slide noted for a change that failed.
  drop(): void {
    this.pending = null;
  }

  play(): boolean {
    const pending = this.pending;
    this.pending = null;
    if (!pending ||
        pending.folderId !== String(this.shown.currentFolderId || '') ||
        pending.page !== this.shown.currentPage ||
        NEWTAB_CROSS_SURFACE_DRAG.prefersReducedMotion(window)) {
      return false;
    }
    const grid = this.grid;
    const shifts: { card: BookmarkCardElement; dx: number; dy: number }[] = [];
    getBookmarkReorderCards(this.grid).forEach((card) => {
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
      this.clearCard(card);
      const before = isDraggedCard
        ? pending.draggedRect
        : pending.rects.get(bookmarkId);
      const after = getBookmarkCardLayoutRect(card);
      if (!before || !after) {
        return;
      }
      const delta = NEWTAB_BOOKMARK_DRAG.getLayoutShiftDelta(before, after, {
        horizontalOnly: this.settings.get(bookmarkViewMode) === 'top'
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
        this.timers.set(card, window.setTimeout(() => {
          this.timers.delete(card);
          this.clearCard(card);
        }, BOOKMARK_REORDER_ANIMATION_MS + 80));
      });
    });
    return true;
  }
}

export { BookmarkLayoutAnimation, BOOKMARK_REORDER_EASING };
