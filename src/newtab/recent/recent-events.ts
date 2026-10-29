// Tells the recent site cards which site a context menu is open on, so its
// card shows as the menu's target.
import { createEventBus } from '../../shared/state/events';

interface RecentEvents {
  // The site's URL, or null once the menu closed.
  contextMenuSite: string | null;
}

const recentEvents = createEventBus<RecentEvents>();

export { recentEvents };
