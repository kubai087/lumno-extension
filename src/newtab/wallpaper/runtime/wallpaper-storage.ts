// Wallpaper prefs in storage: synced and local values per mode, the
// overrides kept on one device, and the custom wallpaper records.
import type { Setting } from '../../../domain/settings/define';
import { newtabLocalWallpaper, newtabOnlineWallpaper, newtabWallpaper } from '../../../domain/settings/newtab-wallpaper';
import type { SettingsStore } from '../../../platform/settings-store';
import type { WallpaperLocalStore, WallpaperRecord } from '../../../shared/wallpaper-records';
import type { ShowToast, Translate } from '../../newtab-types';
import type { WallpaperSourceTab } from '../../react/wallpaper-panel/panel-model';
import type { WallpaperSources } from './wallpaper-sources';
import * as REMOTE_CONTENT from '../../remote-content';
import { NEWTAB_CUSTOM_WALLPAPER_ID, NEWTAB_LOCAL_WALLPAPER_DISABLED_VALUE, NEWTAB_WALLPAPER_DEFAULT_ID, NEWTAB_WALLPAPER_MODES, NEWTAB_WALLPAPER_MODE_DARK, NEWTAB_WALLPAPER_MODE_LIGHT, NEWTAB_WALLPAPER_PREFS_STORAGE_VERSION, WALLPAPER_SOURCE_TABS } from '../wallpaper-options';
import type {
  LocalWallpaperOverrides,
  WallpaperMode,
  WallpaperPrefs
} from './wallpaper-runtime-types';
import { isLinkWallpaperId } from './wallpaper-library';
import type { WallpaperLibrary } from './wallpaper-library';
import type { WallpaperChoice } from './wallpaper-choice';

// A value read from storage, and whether the key held one.
interface StoredValue {
  hasValue: boolean;
  value: unknown;
  // Read from the key online picks live under.
  fromOnlineKey?: boolean;
}

// The synced value: one ID for both modes, or an ID per mode.
type SyncedWallpaperValue = string | {
  version: number;
  sameForModes: boolean;
  light: string;
  dark: string;
};

// This device's value: one override for both modes, or one per mode.
type LocalWallpaperValue = string | {
  version: number;
  light: string;
  dark: string;
};

// How one mode's synced value resolves on this version.
interface SyncedModeResolution {
  id: string;
  // An upload the synced value named, to move to this device's overrides.
  localMigrationId: string;
  // Whether the stored value should be rewritten.
  sanitized: boolean;
  // An ID this version does not know, perhaps from a newer install.
  unrecognized?: boolean;
}

interface WallpaperStorageDeps extends Pick<WallpaperSources,
  'normalizeWallpaperMode' | 'isCustomWallpaperId' | 'getCustomWallpaperById' | 'cloneWallpaperPrefs' |
  'cloneLocalWallpaperOverrides' | 'normalizeNewtabWallpaperId' | 'getDefaultLocalWallpaperOverrides' |
  'getDefaultWallpaperPrefs' | 'getWallpaperById'> {
  settings: Pick<SettingsStore, 'getStored' | 'include' | 'set' | 'setMany'>;
  showToast: ShowToast;
  t: Translate;
  localWallpaperStore: Pick<WallpaperLocalStore,
    'normalizeRecord' | 'readAll' | 'readByIds' | 'write' | 'remove' | 'buildRecordFromFile'>;
  library: Pick<WallpaperLibrary, 'state' | 'setUploads'>;
  choice: WallpaperChoice;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function createWallpaperStorage(deps: WallpaperStorageDeps) {
  const {
    choice,
    library,
    settings,
    showToast,
    t,
    normalizeWallpaperMode,
    isCustomWallpaperId,
    getCustomWallpaperById,
    cloneWallpaperPrefs,
    cloneLocalWallpaperOverrides,
    normalizeNewtabWallpaperId,
    getDefaultLocalWallpaperOverrides,
    getDefaultWallpaperPrefs,
    getWallpaperById,
    localWallpaperStore
  } = deps;


  // A stored wallpaper value's ID: the value itself, or an object's id.
  function getRawWallpaperId(value: unknown): unknown {
    return isRecord(value) && value.id ? value.id : value;
  }

  // A setting's stored value once read, and whether one is stored; a
  // failed read stores none.
  function readStoredSetting(setting: Setting<unknown>): Promise<StoredValue> {
    return settings.include(setting).then(() => {
      const value = settings.getStored(setting);
      return { hasValue: typeof value !== 'undefined', value };
    }, (): StoredValue => ({ hasValue: false, value: undefined }));
  }

  function writeSetting(setting: Setting<unknown>, value: unknown, onError?: () => void): void {
    void settings.set(setting, value).catch(() => {
      if (typeof onError === 'function') {
        onError();
      }
    });
  }

  function isOnlineWallpaperId(value: unknown): boolean {
    const id = String(getRawWallpaperId(value) || '').trim();
    return Boolean(REMOTE_CONTENT.wallpaperFromId(id)) || isLinkWallpaperId(id);
  }

  // Versions without online wallpapers clear IDs they do not recognize, and that clear syncs to every device.
  // Online picks therefore live in their own key, leaving a built-in stand-in under the shared key.
  function buildSharedSyncedWallpaperValue(value: unknown): unknown {
    if (!isRecord(value)) {
      return isOnlineWallpaperId(value) ? NEWTAB_WALLPAPER_DEFAULT_ID : value;
    }
    const shared: Record<string, unknown> = { ...value };
    NEWTAB_WALLPAPER_MODES.forEach((mode) => {
      if (isOnlineWallpaperId(shared[mode])) {
        shared[mode] = NEWTAB_WALLPAPER_DEFAULT_ID;
      }
    });
    return shared;
  }

  // The online pick only counts while the shared key still holds its stand-in; any other value
  // means an older version changed the wallpaper since, and that newer choice wins.
  function mergeOnlineWallpaperValue(synced: StoredValue, online: StoredValue | null | undefined): StoredValue {
    const entry = online && online.hasValue ? online.value : null;
    if (!isRecord(entry) || !synced.hasValue ||
        !getWallpaperStorageRawIds(entry.value).some(isOnlineWallpaperId) ||
        getComparableSyncedWallpaperStorageValue(entry.shared) !==
          getComparableSyncedWallpaperStorageValue(synced.value)) {
      return synced;
    }
    return { hasValue: true, value: entry.value, fromOnlineKey: true };
  }

  function writeSyncedWallpaperValue(value: unknown, options?: { showError?: boolean } | null): void {
    const hasOnlineWallpaper = getWallpaperStorageRawIds(value).some(isOnlineWallpaperId);
    const shared = hasOnlineWallpaper ? buildSharedSyncedWallpaperValue(value) : value;
    void settings.setMany([
      [newtabWallpaper, shared],
      [newtabOnlineWallpaper, hasOnlineWallpaper ? { value, shared } : '']
    ]).catch(() => {
      if (options && options.showError) {
        showToast(t('newtab_wallpaper_save_error', 'Failed to save wallpaper'), true);
      }
    });
  }

  function writeLocalWallpaperValue(value: unknown, options?: { showError?: boolean } | null): void {
    writeSetting(newtabLocalWallpaper, value, () => {
      if (options && options.showError) {
        showToast(t('newtab_wallpaper_save_error', 'Failed to save wallpaper'), true);
      }
    });
  }

  function getWallpaperStorageModeValue(value: unknown, mode: unknown, fallback: unknown): unknown {
    if (!isRecord(value)) {
      return fallback;
    }
    const normalizedMode = normalizeWallpaperMode(mode);
    if (Object.prototype.hasOwnProperty.call(value, normalizedMode)) {
      return value[normalizedMode];
    }
    if (normalizedMode === NEWTAB_WALLPAPER_MODE_DARK &&
        Object.prototype.hasOwnProperty.call(value, NEWTAB_WALLPAPER_MODE_LIGHT)) {
      return value[NEWTAB_WALLPAPER_MODE_LIGHT];
    }
    if (Object.prototype.hasOwnProperty.call(value, 'id')) {
      return value.id;
    }
    return fallback;
  }

  function getWallpaperStorageRawIds(value: unknown): string[] {
    if (!isRecord(value)) {
      return [String(getRawWallpaperId(value) || '').trim()].filter(Boolean);
    }
    return NEWTAB_WALLPAPER_MODES
      .map((mode) => String(getRawWallpaperId(getWallpaperStorageModeValue(value, mode, '')) || '').trim())
      .filter(Boolean);
  }

  function shouldWaitForCustomWallpapers(value: unknown): boolean {
    return getWallpaperStorageRawIds(value).some((id) => {
      return id === NEWTAB_CUSTOM_WALLPAPER_ID || isCustomWallpaperId(id);
    });
  }

  function getStoredCustomWallpaperIds(storedValues: ReadonlyArray<StoredValue | null | undefined> | null | undefined): string[] {
    const ids: string[] = [];
    (storedValues || []).forEach((storedValue) => {
      if (!storedValue || !storedValue.hasValue) {
        return;
      }
      getWallpaperStorageRawIds(storedValue.value).forEach((id) => {
        if ((id === NEWTAB_CUSTOM_WALLPAPER_ID || isCustomWallpaperId(id)) && !ids.includes(id)) {
          ids.push(id);
        }
      });
    });
    return ids;
  }

  function hasLoadedStoredCustomWallpaper(id: string): boolean {
    if (id === NEWTAB_CUSTOM_WALLPAPER_ID) {
      return library.state.uploads.length > 0;
    }
    return Boolean(getCustomWallpaperById(id));
  }

  function getComparableSyncedWallpaperStorageValue(value: unknown): string {
    if (!isRecord(value)) {
      return String(getRawWallpaperId(value) || '');
    }
    return JSON.stringify({
      version: Number(value.version) || 0,
      sameForModes: value.sameForModes !== false,
      light: String(getWallpaperStorageModeValue(value, NEWTAB_WALLPAPER_MODE_LIGHT, '') || ''),
      dark: String(getWallpaperStorageModeValue(value, NEWTAB_WALLPAPER_MODE_DARK, '') || '')
    });
  }

  function buildSyncedWallpaperStorageValue(prefs: unknown): SyncedWallpaperValue {
    const normalized = cloneWallpaperPrefs(prefs);
    if (normalized.sameForModes && normalized.light === normalized.dark) {
      return normalized.light;
    }
    return {
      version: NEWTAB_WALLPAPER_PREFS_STORAGE_VERSION,
      sameForModes: normalized.sameForModes,
      light: normalized.light,
      dark: normalized.dark
    };
  }

  function getComparableLocalWallpaperStorageValue(value: unknown): string {
    if (!isRecord(value)) {
      return String(getRawWallpaperId(value) || '');
    }
    return JSON.stringify({
      version: Number(value.version) || 0,
      light: String(getWallpaperStorageModeValue(value, NEWTAB_WALLPAPER_MODE_LIGHT, '') || ''),
      dark: String(getWallpaperStorageModeValue(value, NEWTAB_WALLPAPER_MODE_DARK, '') || '')
    });
  }

  function buildLocalWallpaperStorageValue(overrides: unknown, sameForModes: boolean): LocalWallpaperValue {
    const normalized = cloneLocalWallpaperOverrides(overrides);
    if (sameForModes && (normalized.light || null) === (normalized.dark || null)) {
      return normalized.light || '';
    }
    if (!normalized.light && !normalized.dark) {
      return '';
    }
    return {
      version: NEWTAB_WALLPAPER_PREFS_STORAGE_VERSION,
      light: normalized.light || '',
      dark: normalized.dark || ''
    };
  }

  function resolveSyncedWallpaperModeValue(raw: unknown, hasRaw: boolean): SyncedModeResolution {
    const value = hasRaw ? raw : NEWTAB_WALLPAPER_DEFAULT_ID;
    if (shouldWaitForCustomWallpapers(value)) {
      const nextCustomId = normalizeNewtabWallpaperId(value);
      if (nextCustomId && isCustomWallpaperId(nextCustomId)) {
        return {
          id: NEWTAB_WALLPAPER_DEFAULT_ID,
          localMigrationId: nextCustomId,
          sanitized: true
        };
      }
      return {
        id: NEWTAB_WALLPAPER_DEFAULT_ID,
        localMigrationId: '',
        sanitized: true
      };
    }
    const nextId = normalizeNewtabWallpaperId(value);
    // An ID this version does not recognize may come from a newer install sharing sync storage.
    // Show the default here, but never write it back, or that install's wallpaper turns off.
    if (!nextId && String(getRawWallpaperId(value) || '').trim()) {
      return {
        id: NEWTAB_WALLPAPER_DEFAULT_ID,
        localMigrationId: '',
        sanitized: false,
        unrecognized: true
      };
    }
    return {
      id: nextId,
      localMigrationId: '',
      sanitized: !hasRaw || Boolean(value && value !== nextId)
    };
  }

  function resolveSyncedWallpaperValue(value: unknown, hasValue: boolean): {
    prefs: WallpaperPrefs;
    sanitizedValue: SyncedWallpaperValue | null;
    localMigrations: LocalWallpaperOverrides;
  } {
    const record = isRecord(value) ? value : null;
    const isObjectValue = Boolean(record);
    const sameForModes = record ? record.sameForModes !== false : true;
    const rawLight = isObjectValue
      ? getWallpaperStorageModeValue(value, NEWTAB_WALLPAPER_MODE_LIGHT, hasValue ? value : NEWTAB_WALLPAPER_DEFAULT_ID)
      : (hasValue ? value : NEWTAB_WALLPAPER_DEFAULT_ID);
    const lightResolution = resolveSyncedWallpaperModeValue(rawLight, hasValue || isObjectValue);
    const rawDark = sameForModes
      ? rawLight
      : getWallpaperStorageModeValue(value, NEWTAB_WALLPAPER_MODE_DARK, rawLight);
    const darkResolution = sameForModes
      ? lightResolution
      : resolveSyncedWallpaperModeValue(rawDark, true);
    const prefs: WallpaperPrefs = {
      version: NEWTAB_WALLPAPER_PREFS_STORAGE_VERSION,
      sameForModes,
      light: lightResolution.id,
      dark: sameForModes ? lightResolution.id : darkResolution.id
    };
    const localMigrations = getDefaultLocalWallpaperOverrides();
    if (lightResolution.localMigrationId) {
      localMigrations.light = lightResolution.localMigrationId;
    }
    if (sameForModes) {
      localMigrations.dark = localMigrations.light;
    } else if (darkResolution.localMigrationId) {
      localMigrations.dark = darkResolution.localMigrationId;
    }
    const sanitizedValue = buildSyncedWallpaperStorageValue(prefs);
    const hasUnrecognizedId = lightResolution.unrecognized || (!sameForModes && darkResolution.unrecognized);
    const shouldSanitize = !hasUnrecognizedId && (!hasValue ||
      lightResolution.sanitized ||
      (!sameForModes && darkResolution.sanitized) ||
      (record && (
        Number(record.version) !== NEWTAB_WALLPAPER_PREFS_STORAGE_VERSION ||
        getComparableSyncedWallpaperStorageValue(value) !== getComparableSyncedWallpaperStorageValue(sanitizedValue)
      )));
    return {
      prefs,
      sanitizedValue: shouldSanitize ? sanitizedValue : null,
      localMigrations
    };
  }

  function resolveLocalWallpaperModeValue(raw: unknown, hasRaw: boolean): { override: string | null; shouldClear: boolean } {
    if (!hasRaw) {
      return { override: null, shouldClear: false };
    }
    const rawId = String(getRawWallpaperId(raw) || '').trim();
    if (!rawId) {
      return { override: null, shouldClear: false };
    }
    if (rawId === NEWTAB_LOCAL_WALLPAPER_DISABLED_VALUE) {
      return { override: NEWTAB_LOCAL_WALLPAPER_DISABLED_VALUE, shouldClear: false };
    }
    const nextId = normalizeNewtabWallpaperId(raw);
    if (nextId && isCustomWallpaperId(nextId)) {
      return { override: nextId, shouldClear: false };
    }
    return { override: null, shouldClear: true };
  }

  function resolveLocalWallpaperOverride(value: unknown, hasValue: boolean): {
    overrides: LocalWallpaperOverrides;
    shouldClear: boolean;
  } {
    const overrides = getDefaultLocalWallpaperOverrides();
    if (!hasValue) {
      return { overrides, shouldClear: false };
    }
    if (!isRecord(value)) {
      const resolution = resolveLocalWallpaperModeValue(value, true);
      overrides.light = resolution.override;
      overrides.dark = resolution.override;
      return {
        overrides,
        shouldClear: resolution.shouldClear
      };
    }
    const lightResolution = resolveLocalWallpaperModeValue(
      getWallpaperStorageModeValue(value, NEWTAB_WALLPAPER_MODE_LIGHT, ''),
      true
    );
    const darkResolution = resolveLocalWallpaperModeValue(
      getWallpaperStorageModeValue(value, NEWTAB_WALLPAPER_MODE_DARK, ''),
      true
    );
    overrides.light = lightResolution.override;
    overrides.dark = darkResolution.override;
    const normalizedValue = buildLocalWallpaperStorageValue(overrides, false);
    return {
      overrides,
      shouldClear: lightResolution.shouldClear ||
      darkResolution.shouldClear ||
        getComparableLocalWallpaperStorageValue(value) !== getComparableLocalWallpaperStorageValue(normalizedValue)
    };
  }

  function getWallpaperLocalOverrideForMode(mode: unknown): string | null {
    const normalizedMode = normalizeWallpaperMode(mode);
    const overrides = choice.state.overrides || getDefaultLocalWallpaperOverrides();
    return overrides[normalizedMode] || null;
  }

  function getSyncedWallpaperIdForMode(mode: unknown): string {
    const normalizedMode = normalizeWallpaperMode(mode);
    const prefs = choice.state.prefs || getDefaultWallpaperPrefs();
    const id = prefs.sameForModes ? prefs.light : prefs[normalizedMode];
    return normalizeNewtabWallpaperId(id) || '';
  }

  function getEffectiveWallpaperIdForMode(mode: unknown): string {
    const override = getWallpaperLocalOverrideForMode(mode);
    if (override === NEWTAB_LOCAL_WALLPAPER_DISABLED_VALUE) {
      return '';
    }
    if (override && isCustomWallpaperId(override)) {
      return normalizeNewtabWallpaperId(override) || '';
    }
    return getSyncedWallpaperIdForMode(mode);
  }

  // Daily mode highlights the photo it currently resolves to.
  function getWallpaperTileSelectionId(id: string): string {
    if (!REMOTE_CONTENT.isDailyWallpaperId(id)) return id;
    const daily = getWallpaperById(id);
    return daily && daily.dailyId || id;
  }

  function getWallpaperSelectionIdForUi(): string {
    return getEffectiveWallpaperIdForMode(choice.getWallpaperEditMode());
  }

  function hasAnyWallpaperEnabled(): boolean {
    return NEWTAB_WALLPAPER_MODES.some((mode) => Boolean(getEffectiveWallpaperIdForMode(mode)));
  }

  function normalizeWallpaperSourceTab(tab: unknown): WallpaperSourceTab {
    return WALLPAPER_SOURCE_TABS.find((sourceTab) => sourceTab === tab) || 'built-in';
  }

  function getWallpaperSourceTabForId(id: unknown): WallpaperSourceTab {
    const provider = REMOTE_CONTENT.getWallpaperProvider(id);
    if (provider) return normalizeWallpaperSourceTab(provider);
    return isCustomWallpaperId(id) || isLinkWallpaperId(id) ? 'local' : 'built-in';
  }

  function getWallpaperModeLabel(mode: unknown): string {
    const normalizedMode = normalizeWallpaperMode(mode);
    return normalizedMode === NEWTAB_WALLPAPER_MODE_DARK
      ? t('settings_theme_dark', 'Dark')
      : t('settings_theme_light', 'Light');
  }

  function getWallpaperModePreferenceOrder(): WallpaperMode[] {
    const modes: WallpaperMode[] = [];
    const addMode = (mode: unknown) => {
      const normalizedMode = normalizeWallpaperMode(mode);
      if (!modes.includes(normalizedMode)) {
        modes.push(normalizedMode);
      }
    };
    addMode(choice.getResolvedWallpaperMode());
    addMode(choice.getWallpaperEditMode());
    NEWTAB_WALLPAPER_MODES.forEach(addMode);
    return modes;
  }

  function getFirstEnabledWallpaperIdForModes(modes: readonly WallpaperMode[]): string {
    for (let i = 0; i < modes.length; i += 1) {
      const id = getEffectiveWallpaperIdForMode(modes[i]);
      if (id) {
        return id;
      }
    }
    return '';
  }

  function getCopyableWallpaperLocalOverrideForId(modes: readonly WallpaperMode[], id: unknown): string | null {
    const normalizedId = normalizeNewtabWallpaperId(id);
    if (!normalizedId || !isCustomWallpaperId(normalizedId)) {
      return null;
    }
    for (let i = 0; i < modes.length; i += 1) {
      const override = getWallpaperLocalOverrideForMode(modes[i]);
      if (override &&
          override !== NEWTAB_LOCAL_WALLPAPER_DISABLED_VALUE &&
          isCustomWallpaperId(override) &&
          normalizeNewtabWallpaperId(override) === normalizedId) {
        return override;
      }
    }
    return null;
  }

  function setWallpaperPrefs(nextPrefs: unknown, nextOverrides: unknown): void {
    const prefs = cloneWallpaperPrefs(nextPrefs);
    choice.setPrefs(prefs, cloneLocalWallpaperOverrides(nextOverrides),
      prefs.sameForModes ? choice.getResolvedWallpaperMode() : normalizeWallpaperMode(choice.state.editMode));
  }

  function getWritableWallpaperPrefs(): WallpaperPrefs {
    return cloneWallpaperPrefs(choice.state.prefs);
  }

  function getWritableLocalWallpaperOverrides(): LocalWallpaperOverrides {
    return cloneLocalWallpaperOverrides(choice.state.overrides);
  }

  function applyLocalWallpaperMigrations(
    overrides: unknown,
    migrations: Partial<LocalWallpaperOverrides> | null | undefined
  ): { overrides: LocalWallpaperOverrides; changed: boolean } {
    const nextOverrides = cloneLocalWallpaperOverrides(overrides);
    let changed = false;
    NEWTAB_WALLPAPER_MODES.forEach((mode) => {
      const migrationId = migrations && migrations[mode] ? migrations[mode] : '';
      if (!migrationId) {
        return;
      }
      nextOverrides[mode] = migrationId;
      changed = true;
    });
    return { overrides: nextOverrides, changed };
  }

  function writeCurrentWallpaperPrefs(options?: { showError?: boolean } | null): void {
    const config = options || {};
    const prefs = choice.state.prefs;
    writeSyncedWallpaperValue(buildSyncedWallpaperStorageValue(prefs), config);
    writeLocalWallpaperValue(
      buildLocalWallpaperStorageValue(choice.state.overrides, prefs ? prefs.sameForModes : true),
      config
    );
  }

  function normalizeCustomWallpaperRecord(record: unknown) {
    return localWallpaperStore.normalizeRecord(record);
  }

  // Adds records to the uploads the page knows, the newest version of each.
  function mergeCustomWallpaperRecords(records: readonly unknown[] | null | undefined): WallpaperRecord[] {
    const recordsById = new Map<string, WallpaperRecord>();
    library.state.uploads.forEach((record) => {
      if (record && record.id) {
        recordsById.set(record.id, record);
      }
    });
    (records || []).forEach((record) => {
      const normalized = normalizeCustomWallpaperRecord(record);
      if (normalized) {
        recordsById.set(normalized.id, normalized);
      }
    });
    library.setUploads(Array.from(recordsById.values()).sort((a, b) => a.updatedAt - b.updatedAt));
    return library.state.uploads;
  }

  function readCustomWallpaperRecords() {
    return localWallpaperStore.readAll();
  }

  function readCustomWallpaperRecordsByIds(ids: unknown) {
    return localWallpaperStore.readByIds(ids);
  }

  function writeCustomWallpaperRecord(record: Parameters<WallpaperLocalStore['write']>[0]) {
    return localWallpaperStore.write(record);
  }

  function deleteCustomWallpaperRecord(record: Parameters<WallpaperLocalStore['remove']>[0]) {
    return localWallpaperStore.remove(record);
  }

  function buildCustomWallpaperRecordFromFile(file: File | null | undefined) {
    return localWallpaperStore.buildRecordFromFile(file);
  }

  return {
    mergeCustomWallpaperRecords,
    readStoredSetting,
    writeSetting,
    isOnlineWallpaperId,
    mergeOnlineWallpaperValue,
    writeSyncedWallpaperValue,
    writeLocalWallpaperValue,
    getWallpaperStorageRawIds,
    getStoredCustomWallpaperIds,
    hasLoadedStoredCustomWallpaper,
    buildLocalWallpaperStorageValue,
    resolveSyncedWallpaperValue,
    resolveLocalWallpaperOverride,
    getWallpaperLocalOverrideForMode,
    getEffectiveWallpaperIdForMode,
    getWallpaperTileSelectionId,
    getWallpaperSelectionIdForUi,
    hasAnyWallpaperEnabled,
    normalizeWallpaperSourceTab,
    getWallpaperSourceTabForId,
    getWallpaperModeLabel,
    getWallpaperModePreferenceOrder,
    getFirstEnabledWallpaperIdForModes,
    getCopyableWallpaperLocalOverrideForId,
    setWallpaperPrefs,
    getWritableWallpaperPrefs,
    getWritableLocalWallpaperOverrides,
    applyLocalWallpaperMigrations,
    writeCurrentWallpaperPrefs,
    normalizeCustomWallpaperRecord,
    readCustomWallpaperRecords,
    readCustomWallpaperRecordsByIds,
    writeCustomWallpaperRecord,
    deleteCustomWallpaperRecord,
    buildCustomWallpaperRecordFromFile
  };
}

type WallpaperStorage = ReturnType<typeof createWallpaperStorage>;

export { createWallpaperStorage };
export type { StoredValue, WallpaperStorage, WallpaperStorageDeps };
