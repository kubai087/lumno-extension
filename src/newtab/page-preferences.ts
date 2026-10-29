// New Tab display preferences: normalizing, loading and applying the shortcut,
// auto-focus, simple mode and search result settings.
import type * as LumnoSettings from '../domain/settings';
import type { PageLayout } from './page-layout';
import * as SettingsStorage from '../platform/settings-storage';
import { newtabInputAutoFocusEnabled } from '../domain/settings/newtab-page';
import type { SettingsStore } from '../platform/settings-store';
import type { SettingPreview } from './setting-preview';
import { NEWTAB_SHORTCUT_COLUMNS_MAX, NEWTAB_SHORTCUT_COLUMNS_MIN, NEWTAB_SHORTCUT_WIDTH_MAX, NEWTAB_SHORTCUT_WIDTH_MIN, newtabShortcutAddVisible, newtabShortcutColumns, newtabShortcutDockMagnificationEnabled, newtabShortcutGap, newtabShortcutSize, newtabShortcutsVisible } from '../domain/settings/newtab-shortcuts';
import * as SETTINGS from '../domain/settings';
import { SEARCH_WIDTH_CONFIG } from './layout';

// Whether a change is only shown or also saved.
type PersistOptions = { persist?: boolean } | null | undefined;


interface PagePreferencesDeps {
  settings: Pick<SettingsStore, 'get' | 'include' | 'set' | 'subscribe'>;
  preview: Pick<SettingPreview, 'get' | 'set'>;
  getBookmarkGridColumnCount: PageLayout['getBookmarkGridColumnCount'];
}

function createPagePreferences(deps: PagePreferencesDeps) {
  const {
    settings,
    preview,
    getBookmarkGridColumnCount
  } = deps;


  function normalizeNewtabWidthMode(value: unknown) {
    return SETTINGS.newtabWidthMode.parse(value);
  }

  function normalizeNewtabSearchWidth(
    value: unknown,
    options?: Parameters<typeof LumnoSettings.normalizeNewtabSearchWidth>[1]
  ): ReturnType<typeof LumnoSettings.normalizeNewtabSearchWidth> {
    return SETTINGS.normalizeNewtabSearchWidth(value, { ...SEARCH_WIDTH_CONFIG, ...options });
  }

  function normalizeNewtabShortcutsVisible(value: unknown) {
    return SETTINGS.newtabShortcutsVisible.parse(value);
  }

  function normalizeNewtabShortcutAddVisible(value: unknown) {
    return SETTINGS.newtabShortcutAddVisible.parse(value);
  }

  function normalizeNewtabShortcutDockMagnificationEnabled(value: unknown) {
    return SETTINGS.newtabShortcutDockMagnificationEnabled.parse(value);
  }

  function normalizeNewtabShortcutColumns(value: unknown) {
    return SETTINGS.newtabShortcutColumns.parse(value);
  }

  function normalizeNewtabShortcutSize(value: unknown) {
    return SETTINGS.newtabShortcutSize.parse(value);
  }

  function normalizeNewtabShortcutGap(value: unknown) {
    return SETTINGS.newtabShortcutGap.parse(value);
  }

  function inferNewtabShortcutColumnsFromWidth(value: unknown) {
    return SETTINGS.inferNewtabShortcutColumnsFromWidth(value, {
      widthMin: NEWTAB_SHORTCUT_WIDTH_MIN,
      widthMax: NEWTAB_SHORTCUT_WIDTH_MAX,
      columnsMin: NEWTAB_SHORTCUT_COLUMNS_MIN,
      columnsMax: NEWTAB_SHORTCUT_COLUMNS_MAX
    });
  }

  function normalizeNewtabInputAutoFocusEnabled(value: unknown) {
    return SETTINGS.newtabInputAutoFocusEnabled.parse(value);
  }

  function cacheNewtabInputAutoFocusEnabled(value: unknown): void {
    SettingsStorage.cacheNewtabInputAutoFocusEnabled(value);
  }

  function normalizeNewtabFeedbackButtonVisible(value: unknown) {
    return SETTINGS.newtabFeedbackButtonVisible.parse(value);
  }

  function normalizeNewtabAppearanceButtonVisible(value: unknown) {
    return SETTINGS.newtabAppearanceButtonVisible.parse(value);
  }

  function setNewtabShortcutsVisible(enabled: unknown, options?: PersistOptions): boolean {
    return preview.set(newtabShortcutsVisible, enabled, options);
  }

  function setNewtabShortcutAddVisible(enabled: unknown, options?: PersistOptions): boolean {
    return preview.set(newtabShortcutAddVisible, enabled, options);
  }

  function setNewtabShortcutDockMagnificationEnabled(enabled: unknown, options?: PersistOptions): boolean {
    return preview.set(newtabShortcutDockMagnificationEnabled, enabled, options);
  }

  function setNewtabShortcutColumns(value: unknown, options?: PersistOptions): number {
    return preview.set(newtabShortcutColumns, value, options);
  }

  function setNewtabShortcutSize(value: unknown, options?: PersistOptions): number {
    return preview.set(newtabShortcutSize, value, options);
  }

  function setNewtabShortcutGap(value: unknown, options?: PersistOptions): number {
    return preview.set(newtabShortcutGap, value, options);
  }

  // Keeps the page's quick copy and the panel current once the setting is
  // read, and on every change.
  function followNewtabInputAutoFocus(): Promise<boolean> {
    const apply = () => {
      cacheNewtabInputAutoFocusEnabled(settings.get(newtabInputAutoFocusEnabled));
      return settings.get(newtabInputAutoFocusEnabled);
    };
    settings.subscribe(newtabInputAutoFocusEnabled, apply);
    return settings.include(newtabInputAutoFocusEnabled).then(apply);
  }

  const initialNewtabInputAutoFocusReadyTask = followNewtabInputAutoFocus();

  function normalizeZenModeEnabled(value: unknown) {
    return value === true;
  }

  // The bookmarks one page holds; `columns` asks what it would be with
  // another column setting.
  function getBookmarkLimit(columns?: number): number {
    const normalized = preview.get(SETTINGS.bookmarkCount);
    if (normalized <= 0) {
      return 8;
    }
    const rows = Math.max(1, Math.round(normalized / 4));
    // Use the actual rendered column count so "show N rows" remains accurate on responsive layouts.
    return rows * Math.max(1, getBookmarkGridColumnCount(columns));
  }

  return {
    normalizeNewtabWidthMode,
    normalizeNewtabSearchWidth,
    normalizeNewtabShortcutsVisible,
    normalizeNewtabShortcutAddVisible,
    normalizeNewtabShortcutDockMagnificationEnabled,
    normalizeNewtabShortcutColumns,
    normalizeNewtabShortcutSize,
    normalizeNewtabShortcutGap,
    inferNewtabShortcutColumnsFromWidth,
    normalizeNewtabInputAutoFocusEnabled,
    normalizeNewtabFeedbackButtonVisible,
    normalizeNewtabAppearanceButtonVisible,
    setNewtabShortcutsVisible,
    setNewtabShortcutAddVisible,
    setNewtabShortcutDockMagnificationEnabled,
    setNewtabShortcutColumns,
    setNewtabShortcutSize,
    setNewtabShortcutGap,
    initialNewtabInputAutoFocusReadyTask,
    normalizeZenModeEnabled,
    getBookmarkLimit
  };
}

type PagePreferences = ReturnType<typeof createPagePreferences>;

export { createPagePreferences };
export type { PagePreferences, PagePreferencesDeps };
