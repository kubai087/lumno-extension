// The bookmarks: the browser's tree and the moves made on it with their
// undo history, the folder and page the section shows, the section's
// mounted parts, its cards and their slide after a move.
import * as NEWTAB_BOOKMARK_MOVE_HISTORY from '../bookmarks/bookmark-move-history';
import * as NEWTAB_BOOKMARKS_RUNTIME from '../bookmarks/bookmarks-runtime';
import * as NEWTAB_BOOKMARKS_STORE from '../bookmarks/bookmarks-store';
import { normalizeHost } from '../../domain/favicon/brand-accents';
import type { BookmarkCardElement } from '../react/bookmarks';
import { BookmarksShown } from '../bookmarks/bookmarks-shown';
import { BookmarkSectionParts } from '../bookmarks/bookmark-section-parts';
import { BookmarkLayoutAnimation } from '../dom/bookmark-layout-animation';
import type { PageContext } from '../app/context';

function createBookmarkStoreFeature(ctx: PageContext) {
  const { settings } = ctx;
  const pageStructureRuntime = ctx.structure;

  // The bookmark folder and page the section shows.
  const bookmarksShown = new BookmarksShown();
  // The bookmark section's view, folder menu and top bar, mounted with the section.
  const bookmarkParts = new BookmarkSectionParts();
  const bookmarksRuntime = NEWTAB_BOOKMARKS_RUNTIME.createBookmarksRuntime({
    chromeApi: typeof chrome !== 'undefined' ? chrome : null,
    store: NEWTAB_BOOKMARKS_STORE,
    normalizeHost
  });

  const bookmarkMoveHistory = NEWTAB_BOOKMARK_MOVE_HISTORY.createBookmarkMoveHistory({ maxEntries: 30 });

  // The slide bookmark cards make after a move, and the moves between the
  // bookmarks and the shortcuts, with their undo.
  const bookmarkLayoutAnimation = new BookmarkLayoutAnimation(pageStructureRuntime.bookmark.grid, bookmarksShown, settings);
  const bookmarkCards: BookmarkCardElement[] = [];

  return {
    bookmarkCards,
    bookmarkLayoutAnimation,
    bookmarkMoveHistory,
    bookmarkParts,
    bookmarksRuntime,
    bookmarksShown
  };
}

type BookmarkStoreFeature = ReturnType<typeof createBookmarkStoreFeature>;

export { createBookmarkStoreFeature };
export type { BookmarkStoreFeature };
