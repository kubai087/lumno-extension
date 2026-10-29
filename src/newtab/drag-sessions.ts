// The drags running on the page: a bookmark card's, a shortcut tile's and a
// recent site card's. Each drag module starts and ends its own; the others
// read them so two drags never run at once and the page keeps still while
// one does.
import type { BookmarkDragSession } from './bookmarks/bookmark-drag';
import type { RecentCardDragSession } from './recent/recent-card-drag';
import type { ShortcutDragSession } from './shortcuts/shortcut-drag';

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
