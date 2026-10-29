// The bookmark section's mounted parts: the view that draws the cards, the
// folder menu that cascades from a card or a folder shortcut, and the top
// bar the bookmarks show in while in top bar mode. Each is null until the
// section is made.
import type { BookmarkCascadeRuntime } from '../dom/bookmark-cascade-menu';
import type { BookmarksTopbarRuntime } from '../react/bookmarks-topbar';
import type { BookmarksViewController } from '../react/bookmarks';
import { createViewStore } from '../../shared/react/view-store';

class BookmarkSectionParts {
  private bookmarksView: BookmarksViewController | null = null;
  private cascadeMenu: BookmarkCascadeRuntime | null = null;
  private topbarRuntime: BookmarksTopbarRuntime | null = null;
  // The bookmark whose context menu is open, which its card shows.
  readonly contextMenuBookmark = createViewStore<{ id: string | null }>({ id: null });

  get view(): BookmarksViewController | null {
    return this.bookmarksView;
  }

  get cascade(): BookmarkCascadeRuntime | null {
    return this.cascadeMenu;
  }

  get topbar(): BookmarksTopbarRuntime | null {
    return this.topbarRuntime;
  }

  mount(parts: { view: BookmarksViewController; cascade: BookmarkCascadeRuntime; topbar: BookmarksTopbarRuntime }): void {
    this.bookmarksView = parts.view;
    this.cascadeMenu = parts.cascade;
    this.topbarRuntime = parts.topbar;
  }
}

export { BookmarkSectionParts };
