// What happens to the recent site cards: the site a context menu is open on,
// which its card shows as the menu's target, and a card pressed, which may
// start a drag.
import { createEventBus } from '../../shared/state/events';
import type { RecentSitesViewOptions } from '../react/recent-sites';

interface RecentEvents {
  // The site's URL, or null once the menu closed.
  contextMenuSite: string | null;
  cardPointerDown: Parameters<NonNullable<RecentSitesViewOptions['onCardPointerDown']>>[0];
}

const recentEvents = createEventBus<RecentEvents>();

export { recentEvents };
