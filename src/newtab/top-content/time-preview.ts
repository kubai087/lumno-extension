// A clock slider's value while it is dragged and not yet saved: the
// appearance panel sets it, the clock draws with it, and the next stored
// value replaces it.
import { newtabTimeFontSize, newtabTimeOpacity } from '../../domain/settings/newtab-time';
import type { SettingsStore } from '../../platform/settings-store';
import { createStore } from '../../shared/state/store';
import type { Store } from '../../shared/state/store';

interface TimePreviewState {
  fontSize?: number;
  opacity?: number;
}

class TimePreview {
  readonly store: Store<TimePreviewState> = createStore<TimePreviewState>({});
  private readonly settings: Pick<SettingsStore, 'get'>;

  constructor(settings: Pick<SettingsStore, 'get'>) {
    this.settings = settings;
  }

  // The size and opacity the clock shows.
  get fontSize(): number {
    const { fontSize } = this.store.getSnapshot();
    return fontSize === undefined ? this.settings.get(newtabTimeFontSize) : fontSize;
  }

  get opacity(): number {
    const { opacity } = this.store.getSnapshot();
    return opacity === undefined ? this.settings.get(newtabTimeOpacity) : opacity;
  }

  show(value: TimePreviewState): void {
    this.store.setState(value);
  }

  clear(): void {
    const { fontSize, opacity } = this.store.getSnapshot();
    if (fontSize !== undefined || opacity !== undefined) {
      this.store.setState({ fontSize: undefined, opacity: undefined });
    }
  }
}

export { TimePreview };
