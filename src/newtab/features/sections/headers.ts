// The section headers and the bookmark pager: the recent and bookmark
// headings, the bookmark view mode and folder navigation, and turning the
// bookmark pages by the pager, a swipe or the wheel.
import * as NEWTAB_BOOKMARK_PAGER from '../../bookmarks/bookmark-pager';
import * as NEWTAB_SECTION_HEADERS from '../../section-headers';
import * as LumnoMessaging from '../../../platform/messaging';
import type { PageContext } from '../../app/context';
import type { ServicesPart } from '../shell/services';
import type { BookmarkStorePart } from '../stores/bookmark-store';
import type { BookmarkMenusPart } from '../menus/bookmark-menus';
import type { LayoutPart } from '../appearance/layout';

interface HeadersPartDeps {
  shell: ServicesPart;
  bookmarkStore: BookmarkStorePart;
  bookmarkMenus: BookmarkMenusPart;
  layout: LayoutPart;
}

function createHeadersPart(ctx: PageContext, deps: HeadersPartDeps) {
  const { locale, preview, settings, t } = ctx;
  const bookmarkSection = ctx.structure.bookmark.section;
  const pageStructureRuntime = ctx.structure;
  const shortcutSection = ctx.structure.shortcut.section;
  const { dragSessions, hideTopActionTooltip, showTopActionTooltip } = deps.shell;
  const { bookmarkCards, bookmarkParts, bookmarksShown } = deps.bookmarkStore;
  const {
    closeBookmarkCascadeMenu,
    getBookmarkModeMenuOptions,
    handleBookmarkModeMenuAction
  } = deps.bookmarkMenus;
  const {
    getBookmarkGridColumnCount,
    getBookmarkLimit,
    isContentSectionVisible,
    setContentSectionVisible,
    updateBookmarkSectionPosition,
    updateSearchEntryLayout
  } = deps.layout;

  const {
    updateBookmarkHeader,
    setNewtabTopOccupied,
    syncBookmarkSurfaceMode,
    setBookmarkSurfaceVisible,
    followBookmarkViewMode,
    navigateBookmarkFolder
  } = NEWTAB_SECTION_HEADERS.createSectionHeaders({
    locale,
    bookmarkGrid: pageStructureRuntime.bookmark.grid,
    bookmarkParts,
    bookmarksShown,
    preview,
    settings,
    t,
    updateSearchEntryLayout,
    setContentSectionVisible,
    bookmarkSection,
    bookmarkCards,
    closeBookmarkCascadeMenu,
    showTopActionTooltip,
    hideTopActionTooltip,
    bookmarkHeaderStore: pageStructureRuntime.bookmark.headerStore,
    getBookmarkModeMenuOptions,
    handleBookmarkModeMenuAction,
    openBookmarkManager: () => {
      if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
        return;
      }
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'openBookmarkManager' });
    }
  });

  const {
    getBookmarkPageCount,
    updateBookmarkPagerState,
    updateBookmarkGridHeightLock,
    renderCurrentBookmarkPage,
    switchBookmarkPageDuringDrag,
    handleBookmarkWheel
  } = NEWTAB_BOOKMARK_PAGER.createBookmarkPager({
    setBookmarkSurfaceVisible,
    shortcutSection,
    dragSessions,
    bookmarkParts,
    settings,
    bookmarkGrid: pageStructureRuntime.bookmark.grid,
    bookmarksShown,
    getBookmarkLimit,
    updateBookmarkHeader,
    getBookmarkGridColumnCount,
    updateBookmarkSectionPosition
  });
  // A swipe or wheel turn over the bookmarks turns their pages.
  bookmarkSection.addEventListener('wheel', (event) => {
    if (!event || !isContentSectionVisible(bookmarkSection)) {
      return;
    }
    handleBookmarkWheel(event);
  }, { passive: false });

  return {
    followBookmarkViewMode,
    getBookmarkPageCount,
    navigateBookmarkFolder,
    renderCurrentBookmarkPage,
    setBookmarkSurfaceVisible,
    setNewtabTopOccupied,
    switchBookmarkPageDuringDrag,
    syncBookmarkSurfaceMode,
    updateBookmarkGridHeightLock,
    updateBookmarkHeader,
    updateBookmarkPagerState
  };
}

type HeadersPart = ReturnType<typeof createHeadersPart>;

export { createHeadersPart };
export type { HeadersPart };
