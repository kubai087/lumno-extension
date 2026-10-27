// The reader's own change to a setting: the store shows it at once and
// writes it; a failed write leaves the stored value to show again.
import type { Setting } from '../../domain/settings/define';
import type { SettingsStore } from '../../platform/settings-store';

function saveSetting<V>(store: Pick<SettingsStore, 'set'>, setting: Setting<V>, value: V): void {
  void store.set(setting, value).catch(() => {});
}

export { saveSetting };
