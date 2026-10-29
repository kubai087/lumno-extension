// The window's tabs a search surface lists and matches results against, and
// the tab the surface is in. The overlay gets them with its opening; both
// surfaces fetch them again when the panel lists open tabs.
import type { OverlayTab } from '../../domain/messages';

class OpenTabs {
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

  // The tabs as the worker listed them, and the tab the surface is in.
  received(tabs: OverlayTab[], currentTabId: number | null): void {
    this.list = tabs;
    this.currentId = currentTabId;
    this.fetched = true;
  }

  // Forgets the listed tabs until they are fetched again.
  clear(): void {
    this.list = [];
    this.fetched = false;
  }
}

export { OpenTabs };
