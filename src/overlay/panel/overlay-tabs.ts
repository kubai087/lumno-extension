// The window's tabs the overlay lists and matches results against, and the
// tab it opened over. They come with the opening and are fetched again when
// the panel lists open tabs.
import type { OverlayTab } from '../../domain/messages';

class OverlayTabs {
  private list: OverlayTab[];
  private currentId: number | null;
  private fetched: boolean;

  constructor(tabs: OverlayTab[], currentTabId: number | null) {
    this.list = tabs;
    this.currentId = currentTabId;
    // The tabs the opening brought can be listed until fresh ones arrive.
    this.fetched = tabs.length > 0;
  }

  get tabs(): OverlayTab[] {
    return this.list;
  }

  get currentTabId(): number | null {
    return this.currentId;
  }

  // Whether there are tabs to list without asking the worker first.
  get ready(): boolean {
    return this.fetched;
  }

  // The tabs as the worker listed them, and the tab the overlay is over.
  received(tabs: OverlayTab[], currentTabId: number | null): void {
    this.list = tabs;
    this.currentId = currentTabId;
    this.fetched = true;
  }
}

export { OverlayTabs };
