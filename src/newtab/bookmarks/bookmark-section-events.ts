// What happens to the bookmark section that other parts follow.
// `changed`: this page changed the bookmarks (a move, an edit, an undo);
// the section loads them again, keeping an open folder menu if asked.
// `drawn`: the cards of a folder's page are on screen; a drag waiting for
// that folder moves on. `loaded`: the section's data arrived and is drawn.
import { createEventBus } from '../../shared/state/events';

interface BookmarkSectionEvents {
  changed: { keepCascadeOpen: boolean };
  drawn: { folderId: string };
  loaded: null;
}

const bookmarkSectionEvents = createEventBus<BookmarkSectionEvents>();

export { bookmarkSectionEvents };
