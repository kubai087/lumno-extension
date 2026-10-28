// A slider's value while it is dragged and not yet saved: the appearance
// panel shows it, the page draws with it, and the next stored value of that
// setting replaces it.
import type { Setting } from '../domain/settings/define';
import type { SettingsStore } from '../platform/settings-store';
import { createStore } from '../shared/state/store';
import type { Store } from '../shared/state/store';

class SettingPreview {
  // Previewed values by setting key.
  readonly store: Store<{ values: ReadonlyMap<string, unknown> }> = createStore<{ values: ReadonlyMap<string, unknown> }>({ values: new Map<string, unknown>() });
  private readonly settings: Pick<SettingsStore, 'get' | 'set' | 'subscribe'>;

  constructor(settings: Pick<SettingsStore, 'get' | 'set' | 'subscribe'>) {
    this.settings = settings;
  }

  // The value the page shows: a dragged slider's, else the stored one.
  get<T>(setting: Setting<T>): T {
    const { values } = this.store.getSnapshot();
    return values.has(setting.key) ? setting.parse(values.get(setting.key)) : this.settings.get(setting);
  }

  show<T>(setting: Setting<T>, value: T): void {
    const values = new Map(this.store.getSnapshot().values);
    values.set(setting.key, value);
    this.store.setState({ values });
  }

  // The panel's change: saved to the settings, or only shown while its
  // slider is dragged.
  set<T>(setting: Setting<T>, value: unknown, options?: { persist?: boolean } | null): T {
    const nextValue = setting.parse(value);
    if (options && options.persist) {
      void this.settings.set(setting, nextValue).catch(() => {});
    } else {
      this.show(setting, nextValue);
    }
    return nextValue;
  }

  // A stored value replaces the preview of its setting.
  follow(settings: readonly Setting<unknown>[]): void {
    settings.forEach((setting) => this.settings.subscribe(setting, () => this.drop(setting)));
  }

  private drop(setting: Setting<unknown>): void {
    const { values } = this.store.getSnapshot();
    if (values.has(setting.key)) {
      const next = new Map(values);
      next.delete(setting.key);
      this.store.setState({ values: next });
    }
  }
}

export { SettingPreview };
