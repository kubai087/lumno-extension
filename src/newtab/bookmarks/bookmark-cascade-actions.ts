// Opening, closing and positioning the bookmark cascade menu, and the
// top-level bookmarks local search matches against.
import type { Translate } from '../newtab-types';
import type { BookmarkCascadeRuntime } from './bookmark-cascade-menu';
import type { BookmarkItem } from './bookmarks-store';
import type { BookmarksRuntime } from './bookmarks-runtime';
import type { BookmarksShown } from './bookmarks-shown';
import type { BookmarkSectionParts } from './bookmark-section-parts';


interface BookmarkCascadeActionsDeps {
  bookmarksRuntime: BookmarksRuntime;
  t: Translate;
  bookmarksShown: Pick<BookmarksShown, 'currentFolderId' | 'located' | 'rootFolderId'>;
  bookmarkParts: Pick<BookmarkSectionParts, 'cascade'>;
}

type CascadeOpenArgs = Parameters<BookmarkCascadeRuntime['open']>;
type CascadeCloseOptions = Parameters<BookmarkCascadeRuntime['close']>[0];

function createBookmarkCascadeActions(deps: BookmarkCascadeActionsDeps) {
  const {
    bookmarkParts,
    bookmarksShown,
    bookmarksRuntime,
    t
  } = deps;


  function openBookmarkCascadeMenu(item: CascadeOpenArgs[0], anchorElement: CascadeOpenArgs[1], options?: CascadeOpenArgs[2]): void {
    if (bookmarkParts.cascade) {
      bookmarkParts.cascade.open(item, anchorElement, {
        ...options,
        toggle: !options || options.dragMode !== true
      });
    }
  }

  // `{ animate: true }` folds the menu away rather than removing it at once.
  function closeBookmarkCascadeMenu(options?: CascadeCloseOptions): void {
    if (bookmarkParts.cascade) {
      bookmarkParts.cascade.close(options);
    }
  }

  function positionBookmarkCascadeLevels(): void {
    if (bookmarkParts.cascade) {
      bookmarkParts.cascade.positionLevels();
    }
  }

  function getTopBookmarks(limit: number, folderId?: string): Promise<BookmarkItem[]> {
    const parsedLimit = Math.floor(limit);
    const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 0;
    return bookmarksRuntime.readFolder(
      folderId || bookmarksShown.currentFolderId || bookmarksShown.rootFolderId,
      {
        limit: safeLimit,
        rootTitle: t('bookmarks_heading', '书签')
      }
    ).then((result) => {
      const rootFolderId = String(result.rootFolderId || '1');
      bookmarksShown.located(
        rootFolderId,
        String(result.folderId || rootFolderId),
        Array.isArray(result.path) ? result.path : [{ id: rootFolderId, title: t('bookmarks_heading', '书签') }]
      );
      return Array.isArray(result.items) ? result.items : [];
    });
  }

  return {
    openBookmarkCascadeMenu,
    closeBookmarkCascadeMenu,
    positionBookmarkCascadeLevels,
    getTopBookmarks
  };
}

type BookmarkCascadeActions = ReturnType<typeof createBookmarkCascadeActions>;

export { createBookmarkCascadeActions };
export type { BookmarkCascadeActions, BookmarkCascadeActionsDeps };
