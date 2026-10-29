// The recent sites the section last drew: the source items before the pinned
// sites are merged in, the signature of the cards drawn, and whether the
// section has loaded once. The section loaders draw them; parts that change
// what a card shows forget the signature and draw the items again.
import type { RecentSite } from '../../domain/recent-sites-store';
import { createViewStore } from '../../shared/react/view-store';
import type { RecentCardsState } from '../react/recent-sites';

function getRecentSitesSignature(items: RecentSite[]): string {
  if (!Array.isArray(items) || items.length === 0) {
    return '';
  }
  return items.map((item, index) => {
    const url = item?.url ? String(item.url) : '';
    const title = item?.title ? String(item.title) : '';
    const siteName = item?.siteName ? String(item.siteName) : '';
    const lastVisitTime = item?.lastVisitTime
      ? String(item.lastVisitTime)
      : '';
    const visitCount = item?.visitCount ? String(item.visitCount) : '';
    const base = `${index}::${url}::${title}::${siteName}::${lastVisitTime}::${visitCount}`;
    return item?.progressTracking === true ? `${base}::tracking` : base;
  }).join('\n');
}


class RecentSitesShown {
  private sourceItems: RecentSite[] = [];
  private drawnSignature = '';
  private loaded = false;
  // The cards the section draws.
  readonly cards = createViewStore<RecentCardsState>({ items: null });

  get items(): RecentSite[] {
    return this.sourceItems;
  }

  get loadedOnce(): boolean {
    return this.loaded;
  }

  setItems(items: RecentSite[]): void {
    this.sourceItems = items;
  }

  // Draws `items` unless they are the cards drawn; true when it drew.
  draw(items: RecentSite[]): boolean {
    const signature = getRecentSitesSignature(items);
    if (signature === this.drawnSignature) {
      return false;
    }
    this.drawnSignature = signature;
    this.cards.setState({ items: items.slice() });
    return true;
  }

  // Takes the cards away.
  clear(): void {
    this.cards.setState({ items: null });
  }

  // The next draw redraws every card.
  forgetSignature(): void {
    this.drawnSignature = '';
  }

  markLoaded(): void {
    this.loaded = true;
  }
}

export { RecentSitesShown };
