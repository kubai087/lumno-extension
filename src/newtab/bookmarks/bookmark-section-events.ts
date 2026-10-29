// What happens to the bookmark section that other parts follow.
// `drawn`: the cards of a folder's page are on screen; a drag waiting for
// that folder moves on. `loaded`: the section's data arrived and is drawn.
import { createEventBus } from '../../shared/state/events';

interface BookmarkSectionEvents {
  drawn: { folderId: string };
  loaded: null;
}

const bookmarkSectionEvents = createEventBus<BookmarkSectionEvents>();

export { bookmarkSectionEvents };
