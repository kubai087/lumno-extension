// The window's resizes as the layout sees them: a revision each resize
// bumps, and a lock held while resizes keep coming, which keeps the search
// box in place; it releases once they have settled for a moment.
import { createStore } from '../shared/state/store';
import type { Store } from '../shared/state/store';

interface ViewportActivityState {
  revision: number;
  locked: boolean;
}

const RESIZE_SETTLE_MS = 140;

class ViewportActivity {
  readonly store: Store<ViewportActivityState> = createStore<ViewportActivityState>({ revision: 0, locked: false });
  private settleTimer = 0;

  get revision(): number {
    return this.store.getSnapshot().revision;
  }

  get locked(): boolean {
    return this.store.getSnapshot().locked;
  }

  // Follows the window's resizes for the page's lifetime.
  follow(win: Window): void {
    win.addEventListener('resize', () => {
      this.store.setState({ revision: this.revision + 1, locked: true });
      if (this.settleTimer) {
        win.clearTimeout(this.settleTimer);
      }
      this.settleTimer = win.setTimeout(() => {
        this.settleTimer = 0;
        this.store.setState({ locked: false });
      }, RESIZE_SETTLE_MS);
    }, { passive: true });
  }
}

export { ViewportActivity };
