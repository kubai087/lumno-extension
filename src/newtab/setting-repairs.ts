// New Tab keeps the stored copy of its settings in their normal form: once
// a setting is read, an invalid stored value is written back normalized, and
// a missing one gets its default unless this device still has a local copy
// waiting to move into sync. Some settings are only repaired when invalid,
// so a missing one keeps following the default.
import type { Setting } from '../domain/settings/define';
import type { StorageAreaLike, StorageItems } from '../domain/storage-port';
import type { SettingsStore } from '../platform/settings-store';
import * as SettingsStorage from '../platform/settings-storage';

interface RepairLists {
  // Repaired when invalid or missing.
  saved: readonly Setting<unknown>[];
  // Repaired only when invalid.
  invalidOnly?: readonly Setting<unknown>[];
}

function repairStoredSettings(
  settings: Pick<SettingsStore, 'include' | 'get' | 'getStored'>,
  area: StorageAreaLike | null,
  lists: RepairLists
): Promise<void> {
  const invalidOnly = lists.invalidOnly || [];
  const all = lists.saved.concat(invalidOnly);
  return settings.include(all).then(() => {
    const stored: StorageItems = {};
    const repairs: StorageItems = {};
    all.forEach((setting) => {
      const raw = settings.getStored(setting);
      const value = settings.get(setting);
      stored[setting.key] = raw;
      if (raw !== value && (raw !== undefined || !invalidOnly.includes(setting))) {
        repairs[setting.key] = value;
      }
    });
    if (Object.keys(repairs).length > 0) {
      SettingsStorage.writeSettingRepairs(chrome, area, repairs, stored);
    }
  });
}

export { repairStoredSettings };
