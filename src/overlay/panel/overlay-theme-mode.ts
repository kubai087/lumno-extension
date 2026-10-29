// The theme the overlay is drawn in: system, light or dark. Commands, keys
// and the settings apply a mode here (`events.applied`), which the panel
// draws; they step to the next one from it.
import type { ThemeMode } from '../../domain/settings/appearance';
import { createEventBus } from '../../shared/state/events';

class OverlayThemeMode {
  private current: ThemeMode = 'system';
  readonly events = createEventBus<{ applied: { mode: ThemeMode } }>();

  get mode(): ThemeMode {
    return this.current;
  }

  set(mode: ThemeMode): void {
    this.current = mode;
  }

  // Draws the overlay in `mode`, even when it is the one shown.
  apply(mode: ThemeMode): void {
    this.current = mode;
    this.events.emit('applied', { mode });
  }
}

export { OverlayThemeMode };
