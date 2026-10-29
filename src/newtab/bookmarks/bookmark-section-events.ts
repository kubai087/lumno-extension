// What happens to the bookmark section that other parts follow.
// `changed`: this page changed the bookmarks (a move, an edit, an undo);
// the section loads them again, and an open folder menu, when kept, draws
// again (`cascadeRefresh` says which row slides in from where).
// `drawn`: the cards of a folder's page are on screen; a drag waiting for
// that folder moves on. `loaded`: the section's data arrived and is drawn.
// `shownChanged`: the section shows another folder or view mode, so its
// data loads again (`force` draws even unchanged data).
// `pageRequested`: the header's pager asks for the page `step` away.
// `topbarStyled`: the top bar took a new layout or background, which the
// page's top inset follows, and the header's display menu when `menu`.
import { createEventBus } from '../../shared/state/events';
import type { BookmarkTopbarLayout } from '../react/bookmarks-topbar';
import type { CascadeRefreshOptions } from './bookmark-cascade-menu';

interface BookmarkSectionEvents {
  changed: { keepCascadeOpen: boolean; cascadeRefresh?: CascadeRefreshOptions };
  drawn: { folderId: string };
  loaded: null;
  shownChanged: { force: boolean };
  pageRequested: { step: -1 | 1 };
  topbarStyled: { layout: BookmarkTopbarLayout; menu: boolean };
}

const bookmarkSectionEvents = createEventBus<BookmarkSectionEvents>();

export { bookmarkSectionEvents };
