// New Tab display preferences: normalizing, loading and applying the shortcut,
// auto-focus, simple mode and search result settings.
import type * as LumnoSettings from '../domain/settings';
import type { PageLayout } from './page-layout';
import type { WallpaperRuntime } from './wallpaper/wallpaper';
import * as SettingsStorage from '../platform/settings-storage';
import { newtabInputAutoFocusEnabled } from '../domain/settings/newtab-page';
import type { SettingsStore } from '../platform/settings-store';
import type { Setting } from '../domain/settings/define';
import type { SettingPreview } from './setting-preview';
import { newtabShortcutAddVisible, newtabShortcutColumns, newtabShortcutDockMagnificationEnabled, newtabShortcutGap, newtabShortcutSize, newtabShortcutsVisible } from '../domain/settings/newtab-shortcuts';

// Whether a change is only shown or also saved.
type PersistOptions = { persist?: boolean } | null | undefined;

interface PagePreferencesState {
  currentBookmarkCount: number;
  wallpaperRuntime: Pick<WallpaperRuntime, 'updateInputAutoFocusUi' | 'updateShortcutsUi'> | null;
}

interface PagePreferencesDeps {
  settings: Pick<SettingsStore, 'get' | 'include' | 'set' | 'subscribe'>;
  preview: Pick<SettingPreview, 'show'>;
  getBookmarkGridColumnCount: PageLayout['getBookmarkGridColumnCount'];
  SETTINGS: Pick<typeof LumnoSettings,
    'inferNewtabShortcutColumnsFromWidth' | 'bookmarkColumns' | 'bookmarkCount' |
    'bookmarkFolderIconsVisible' | 'macosCtrlSuggestionNavigationEnabled' |
    'newtabAppearanceButtonVisible' | 'newtabFeedbackButtonVisible' |
    'newtabInputAutoFocusEnabled' | 'normalizeNewtabSearchWidth' |
    'newtabShortcutAddVisible' | 'newtabShortcutColumns' |
    'newtabShortcutDockMagnificationEnabled' | 'newtabShortcutGap' |
    'newtabShortcutSize' | 'newtabShortcutsVisible' | 'newtabTimeFont' |
    'newtabTimeFontWeight' | 'newtabTimeSecondsVisible' |
    'newtabTopContentMode' | 'newtabWidthMode' |
    'numberShortcutInstantEnabled' | 'overlayTabPriority' |
    'searchResultPriority' | 'simpleModeEnabled' |
    'tabRankScoreDebug'>;
  NEWTAB_SEARCH_WIDTH_CONFIG: NonNullable<Parameters<typeof LumnoSettings.normalizeNewtabSearchWidth>[1]>;
  NEWTAB_SHORTCUT_COLUMNS_MIN: number;
  NEWTAB_SHORTCUT_COLUMNS_MAX: number;
  NEWTAB_SHORTCUT_WIDTH_MIN: number;
  NEWTAB_SHORTCUT_WIDTH_MAX: number;
  pageState: PagePreferencesState;
}

function createPagePreferences(deps: PagePreferencesDeps) {
  const {
    settings,
    preview,
    SETTINGS,
    NEWTAB_SEARCH_WIDTH_CONFIG,
    NEWTAB_SHORTCUT_COLUMNS_MIN,
    NEWTAB_SHORTCUT_COLUMNS_MAX,
    NEWTAB_SHORTCUT_WIDTH_MIN,
    NEWTAB_SHORTCUT_WIDTH_MAX,
    getBookmarkGridColumnCount
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  function normalizeNewtabWidthMode(value: unknown) {
    return SETTINGS.newtabWidthMode.parse(value);
  }

  function normalizeNewtabSearchWidth(
    value: unknown,
    options?: Parameters<typeof LumnoSettings.normalizeNewtabSearchWidth>[1]
  ): ReturnType<typeof LumnoSettings.normalizeNewtabSearchWidth> {
    return SETTINGS.normalizeNewtabSearchWidth(value, { ...NEWTAB_SEARCH_WIDTH_CONFIG, ...options });
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

  function updateNewtabInputAutoFocusUi(): void {
    if (pageState.wallpaperRuntime) {
      pageState.wallpaperRuntime.updateInputAutoFocusUi();
    }
  }


  function updateNewtabShortcutPreferencesUi(): void {
    if (pageState.wallpaperRuntime) {
      pageState.wallpaperRuntime.updateShortcutsUi();
    }
  }

  // The appearance panel's grid controls: a saved change goes to the
  // settings, a dragged one only shows until it is saved.
  function setShortcutGridSetting<T>(setting: Setting<T>, value: unknown, options?: PersistOptions): T {
    const nextValue = setting.parse(value);
    if (options && options.persist) {
      void settings.set(setting, nextValue);
    } else {
      preview.show(setting, nextValue);
    }
    return nextValue;
  }

  function setNewtabShortcutsVisible(enabled: unknown, options?: PersistOptions): boolean {
    return setShortcutGridSetting(newtabShortcutsVisible, enabled, options);
  }

  function setNewtabShortcutAddVisible(enabled: unknown, options?: PersistOptions): boolean {
    return setShortcutGridSetting(newtabShortcutAddVisible, enabled, options);
  }

  function setNewtabShortcutDockMagnificationEnabled(enabled: unknown, options?: PersistOptions): boolean {
    return setShortcutGridSetting(newtabShortcutDockMagnificationEnabled, enabled, options);
  }

  function setNewtabShortcutColumns(value: unknown, options?: PersistOptions): number {
    return setShortcutGridSetting(newtabShortcutColumns, value, options);
  }

  function setNewtabShortcutSize(value: unknown, options?: PersistOptions): number {
    return setShortcutGridSetting(newtabShortcutSize, value, options);
  }

  function setNewtabShortcutGap(value: unknown, options?: PersistOptions): number {
    return setShortcutGridSetting(newtabShortcutGap, value, options);
  }

  // Keeps the page's quick copy and the panel current once the setting is
  // read, and on every change.
  function followNewtabInputAutoFocus(): Promise<boolean> {
    const apply = () => {
      cacheNewtabInputAutoFocusEnabled(settings.get(newtabInputAutoFocusEnabled));
      updateNewtabInputAutoFocusUi();
      return settings.get(newtabInputAutoFocusEnabled);
    };
    settings.subscribe(newtabInputAutoFocusEnabled, apply);
    return settings.include(newtabInputAutoFocusEnabled).then(apply);
  }

  const initialNewtabInputAutoFocusReadyTask = followNewtabInputAutoFocus();

  function normalizeBookmarkFolderIconsVisible(value: unknown) {
    return SETTINGS.bookmarkFolderIconsVisible.parse(value);
  }

  function normalizeZenModeEnabled(value: unknown) {
    return value === true;
  }

  function normalizeBookmarkCount(value: unknown) {
    return SETTINGS.bookmarkCount.parse(value);
  }

  function getBookmarkLimit(): number {
    const normalized = normalizeBookmarkCount(pageState.currentBookmarkCount);
    if (normalized <= 0) {
      return 8;
    }
    const rows = Math.max(1, Math.round(normalized / 4));
    // Use the actual rendered column count so "show N rows" remains accurate on responsive layouts.
    const columns = Math.max(1, getBookmarkGridColumnCount());
    return rows * columns;
  }

  function normalizeBookmarkColumns(value: unknown) {
    return SETTINGS.bookmarkColumns.parse(value);
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
    updateNewtabInputAutoFocusUi,
    updateNewtabShortcutPreferencesUi,
    setNewtabShortcutsVisible,
    setNewtabShortcutAddVisible,
    setNewtabShortcutDockMagnificationEnabled,
    setNewtabShortcutColumns,
    setNewtabShortcutSize,
    setNewtabShortcutGap,
    initialNewtabInputAutoFocusReadyTask,
    normalizeBookmarkFolderIconsVisible,
    normalizeZenModeEnabled,
    normalizeBookmarkCount,
    getBookmarkLimit,
    normalizeBookmarkColumns
  };
}

type PagePreferences = ReturnType<typeof createPagePreferences>;

export { createPagePreferences };
export type { PagePreferences, PagePreferencesDeps, PagePreferencesState };
