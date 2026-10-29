// The theme mode the page is drawn in (system, light or dark), after its
// scope and glass material are settled. The appearance modes apply it;
// commands step to the next one from it, and parts that must not draw
// before the first theme wait for it.
import type { ThemeMode } from '../../domain/settings/appearance';
import { createEventBus } from '../../shared/state/events';

class AppliedThemeMode {
  private current: ThemeMode = 'system';
  private appliedOnce = false;
  private settleFirst: () => void = () => {};
  // Settles once the first theme is applied.
  readonly firstApplied: Promise<void>;
  // `changed`: the page is drawn in another mode or in the other of light and dark.
  readonly events = createEventBus<{ changed: null }>();

  constructor() {
    this.firstApplied = new Promise<void>((resolve) => {
      this.settleFirst = resolve;
    });
  }

  get mode(): ThemeMode {
    return this.current;
  }

  // Whether a theme has been applied yet.
  get applied(): boolean {
    return this.appliedOnce;
  }

  set(mode: ThemeMode): void {
    this.current = mode;
  }

  // Called once the page is drawn in the mode set; `changed` when that is a
  // new mode or a new light or dark.
  markApplied(changed: boolean): void {
    if (changed) {
      this.events.emit('changed', null);
    }
    if (!this.appliedOnce) {
      this.appliedOnce = true;
      this.settleFirst();
    }
  }
}

export { AppliedThemeMode };
