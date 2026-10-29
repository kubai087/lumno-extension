// The drags running on the page: a bookmark card's, a shortcut tile's and a
// recent site card's. Each drag module starts and ends its own; the others
// read them so two drags never run at once and the page keeps still while
// one does.
import type { BookmarkDragSession } from './dom/bookmark-drag';
import type { RecentCardDragSession } from './recent/recent-card-drag';
import type { ShortcutDragSession } from './shortcuts/shortcut-drag';
import type { SurfaceDragState } from './cross-surface-drag';

class DragSessions {
  private bookmarkSession: BookmarkDragSession | null = null;
  private shortcutSession: ShortcutDragSession | null = null;
  private recentCardSession: RecentCardDragSession | null = null;

  get bookmark(): BookmarkDragSession | null {
    return this.bookmarkSession;
  }

  get shortcut(): ShortcutDragSession | null {
    return this.shortcutSession;
  }

  get recentCard(): RecentCardDragSession | null {
    return this.recentCardSession;
  }

  // Whether a drag has left its threshold and moves its card or tile.
  get bookmarkDragging(): boolean {
    return Boolean(this.bookmarkSession && this.bookmarkSession.isDragging);
  }

  get shortcutDragging(): boolean {
    return Boolean(this.shortcutSession && this.shortcutSession.isDragging);
  }

  get recentCardDragging(): boolean {
    return Boolean(this.recentCardSession && this.recentCardSession.isDragging);
  }

  // Whether `state` is one of the running drags, past its threshold; a
  // recent card dragged over the bookmarks opens folders like the others.
  isSurfaceDragRunning(state: SurfaceDragState | null): boolean {
    return Boolean(state && state.isDragging && (state === this.bookmarkSession ||
      state === this.shortcutSession || state === this.recentCardSession));
  }

  setBookmark(session: BookmarkDragSession | null): void {
    this.bookmarkSession = session;
  }

  setShortcut(session: ShortcutDragSession | null): void {
    this.shortcutSession = session;
  }

  setRecentCard(session: RecentCardDragSession | null): void {
    this.recentCardSession = session;
  }
}

export { DragSessions };
