// The recent sites the section last drew: the source items before the pinned
// sites are merged in, the signature of the cards drawn, and whether the
// section has loaded once. The section loaders draw them; parts that change
// what a card shows forget the signature and draw the items again.
import type { RecentSite } from '../../domain/recent-sites-store';

class RecentSitesShown {
  private sourceItems: RecentSite[] = [];
  private drawnSignature = '';
  private loaded = false;

  get items(): RecentSite[] {
    return this.sourceItems;
  }

  get signature(): string {
    return this.drawnSignature;
  }

  get loadedOnce(): boolean {
    return this.loaded;
  }

  setItems(items: RecentSite[]): void {
    this.sourceItems = items;
  }

  drawn(signature: string): void {
    this.drawnSignature = signature;
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
