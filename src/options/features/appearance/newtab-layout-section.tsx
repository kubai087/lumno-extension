// The layout of New Tab in the Appearance tab. A column count never saved
// shows the one inferred from the older width setting, without saving it.
import { useMemo } from 'react';
import {
  bookmarkColumns,
  bookmarkCount,
  bookmarkFolderIconsVisible,
  inferNewtabShortcutColumnsFromWidth,
  newtabAppearanceButtonVisible,
  newtabFeedbackButtonVisible,
  newtabInputAutoFocusEnabled,
  newtabShortcutAddVisible,
  newtabShortcutColumns,
  newtabShortcutDockMagnificationEnabled,
  newtabShortcutGap,
  newtabShortcutSize,
  newtabShortcutsVisible,
  newtabShortcutWidth,
  recentCount,
  recentMode
} from '../../../domain/settings';
import { useSetting } from '../../../shared/react/use-setting';
import { useMessages, useOptionsPage } from '../../app/context';
import { saveSetting } from '../../app/save-setting';
import {
  AppearanceNewtabLayoutSection as NewtabLayoutView,
  type AppearanceNewtabLayoutSectionHandlers
} from '../../react/appearance-newtab-layout-section';
import { getNewtabLayoutRows, getRecentRow, type NewtabLayoutValues } from './newtab-layout-rows';

const TOGGLES = [
  newtabInputAutoFocusEnabled,
  newtabShortcutsVisible,
  newtabShortcutAddVisible,
  newtabShortcutDockMagnificationEnabled,
  bookmarkFolderIconsVisible,
  newtabFeedbackButtonVisible,
  newtabAppearanceButtonVisible
];

export function NewtabLayoutSection() {
  const { settingsStore, notifyNewtab } = useOptionsPage();
  const t = useMessages();
  const storedColumns = useSetting(settingsStore, newtabShortcutColumns);
  // Read so the inferred count follows it.
  useSetting(settingsStore, newtabShortcutWidth);
  const values: NewtabLayoutValues = {
    autoFocus: useSetting(settingsStore, newtabInputAutoFocusEnabled),
    shortcutsVisible: useSetting(settingsStore, newtabShortcutsVisible),
    shortcutAdd: useSetting(settingsStore, newtabShortcutAddVisible),
    shortcutDock: useSetting(settingsStore, newtabShortcutDockMagnificationEnabled),
    shortcutColumns: settingsStore.getStored(newtabShortcutColumns) === undefined
      ? inferNewtabShortcutColumnsFromWidth(settingsStore.getStored(newtabShortcutWidth))
      : storedColumns,
    shortcutSize: useSetting(settingsStore, newtabShortcutSize),
    shortcutGap: useSetting(settingsStore, newtabShortcutGap),
    bookmarkCount: useSetting(settingsStore, bookmarkCount),
    bookmarkColumns: useSetting(settingsStore, bookmarkColumns),
    folderIcons: useSetting(settingsStore, bookmarkFolderIconsVisible),
    recentCount: useSetting(settingsStore, recentCount),
    recentMode: useSetting(settingsStore, recentMode),
    feedbackButton: useSetting(settingsStore, newtabFeedbackButtonVisible),
    appearanceButton: useSetting(settingsStore, newtabAppearanceButtonVisible)
  };
  const handlers = useMemo<AppearanceNewtabLayoutSectionHandlers>(() => ({
    rows: {
      onToggle(key, checked) {
        const setting = TOGGLES.find((entry) => entry.key === key);
        if (setting) {
          saveSetting(settingsStore, setting, checked);
        }
      },
      onSelect() {},
      onSlide(key, value) {
        switch (key) {
          case newtabShortcutColumns.key:
            saveSetting(settingsStore, newtabShortcutColumns, newtabShortcutColumns.parse(value));
            break;
          case newtabShortcutSize.key:
            saveSetting(settingsStore, newtabShortcutSize, newtabShortcutSize.parse(value));
            break;
          case newtabShortcutGap.key:
            saveSetting(settingsStore, newtabShortcutGap, newtabShortcutGap.parse(value));
            break;
          case bookmarkCount.key:
            // The slider counts rows of four bookmarks.
            saveSetting(settingsStore, bookmarkCount, bookmarkCount.parse(value * 4));
            notifyNewtab('bookmarks');
            break;
          case bookmarkColumns.key:
            saveSetting(settingsStore, bookmarkColumns, bookmarkColumns.parse(value));
            notifyNewtab('bookmarks');
            break;
        }
      }
    },
    // The recent site cards come in rows of four, up to two rows.
    onRecentCount(value) {
      saveSetting(settingsStore, recentCount, recentCount.parse(Math.round(value) * 4));
      notifyNewtab('recent');
    },
    onRecentMode(value) {
      saveSetting(settingsStore, recentMode, recentMode.parse(value));
      notifyNewtab('recent');
    }
  }), [settingsStore, notifyNewtab]);
  return (
    <NewtabLayoutView
      handlers={handlers}
      model={{ rows: getNewtabLayoutRows(t, values), recent: getRecentRow(t, values) }}
    />
  );
}
