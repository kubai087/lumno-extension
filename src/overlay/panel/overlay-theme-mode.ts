// The theme the overlay is drawn in: system, light or dark. The panel
// applies it; commands and keys step to the next one from it.
import type { ThemeMode } from '../../domain/settings/appearance';

class OverlayThemeMode {
  private current: ThemeMode = 'system';

  get mode(): ThemeMode {
    return this.current;
  }

  set(mode: ThemeMode): void {
    this.current = mode;
  }
}

export { OverlayThemeMode };
