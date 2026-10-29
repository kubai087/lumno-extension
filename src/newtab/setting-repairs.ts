// New Tab keeps the stored copy of its settings in their normal form: once
// a setting is read, an invalid stored value is written back normalized, and
// a missing one gets its default unless this device still has a local copy
// waiting to move into sync. Some settings are only repaired when invalid,
// so a missing one keeps following the default.
import { bookmarkColumns, bookmarkCount, bookmarkFolderIconsVisible, bookmarkViewMode, newtabShortcutColumns, newtabWidthMode, recentCount, recentMode } from '../domain/settings';
import { newtabShortcutAddVisible, newtabShortcutDockMagnificationEnabled, newtabShortcutGap, newtabShortcutSize, newtabShortcutsVisible } from '../domain/settings/newtab-shortcuts';
import { newtabTimeFont, newtabTimeFontWeight, newtabTimeSecondsVisible, newtabTopContentMode } from '../domain/settings/newtab-time';
import { newtabAppearanceButtonVisible, newtabFeedbackButtonVisible } from '../domain/settings/newtab-page';
import * as SearchSettings from '../domain/settings/search';
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

// The New Tab's settings that are kept normalized in storage.
const NEWTAB_SETTING_REPAIRS: RepairLists = {
  saved: [
    SearchSettings.tabRankScoreDebug,
    newtabTopContentMode,
    newtabTimeFontWeight,
    newtabTimeSecondsVisible,
    newtabFeedbackButtonVisible,
    newtabAppearanceButtonVisible,
    newtabShortcutsVisible,
    newtabShortcutAddVisible,
    newtabShortcutDockMagnificationEnabled,
    newtabShortcutSize,
    newtabShortcutGap,
    newtabWidthMode,
    recentCount,
    recentMode,
    bookmarkCount,
    bookmarkColumns,
    bookmarkFolderIconsVisible
  ],
  // A missing column count is worked out from the older width setting.
  invalidOnly: [
    newtabShortcutColumns,
    SearchSettings.searchResultPriority,
    SearchSettings.searchResultDisplayLimit,
    SearchSettings.faviconEnhancedFetchEnabled,
    newtabTimeFont,
    bookmarkViewMode
  ]
};

export { NEWTAB_SETTING_REPAIRS, repairStoredSettings };
