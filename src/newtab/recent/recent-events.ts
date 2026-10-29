// What happens to the recent site cards: the site a context menu is open on,
// which its card shows as the menu's target; a card pressed, which may start
// a drag; and `cardsStale`, what the cards show changed (pinned or hidden
// sites, progress tracking), so they draw again from the items last read.
import { createEventBus } from '../../shared/state/events';
import type { RecentSitesViewOptions } from '../react/recent-sites';

interface RecentEvents {
  // The site's URL, or null once the menu closed.
  contextMenuSite: string | null;
  cardsStale: null;
  cardPointerDown: Parameters<NonNullable<RecentSitesViewOptions['onCardPointerDown']>>[0];
}

const recentEvents = createEventBus<RecentEvents>();

export { recentEvents };
