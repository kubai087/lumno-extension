// Settings export, import and "sync now" payloads. "Sync now" and a file's
// `data` hold only keys in the shared Chrome Sync contract
// (LumnoSettings.BROWSER_SYNC_KEYS). A version 2 file adds this device's
// snapshot beside `data`, which older versions ignore and still import.
import type * as Settings from '../domain/settings';

type StoredValues = Record<string, unknown>;

interface SyncTransferDeps {
  settings: Pick<typeof Settings, 'BROWSER_SYNC_KEYS' | 'NEWTAB_SHORTCUTS_GROUP_KEYS' |
    'newtabShortcutsLegacy' | 'newtabShortcutsLegacyChunk2' | 'newtabShortcutsLegacyChunk3' |
    'syncMeta' | 'aggregateSearchAutoGroupEnabled' | 'aggregateSearches'>;
  deriveLegacyAutoGroupEnabled(value: unknown): boolean;
}

interface SyncMeta {
  lastSyncAt: number;
  source: 'manual' | 'import';
}

interface SettingsExportFile {
  version: 1 | 2;
  exportedAt: string;
  data: StoredValues;
  snapshot?: unknown;
}

// What a settings file holds: its browser sync settings, and the snapshot
// a version 2 file adds.
interface SettingsFileContents {
  data: StoredValues;
  snapshot: unknown;
}

interface SettingsImportPlan {
  // Keys the import clears after writing.
  keysToClear: string[];
  payload: StoredValues;
}

function isStoredValues(value: unknown): value is StoredValues {
  return Boolean(value) && typeof value === 'object';
}

function createSyncTransfer(deps: SyncTransferDeps) {
  const settings = deps.settings;
  const deriveLegacyAutoGroupEnabled = deps.deriveLegacyAutoGroupEnabled;
  const syncKeys = settings.BROWSER_SYNC_KEYS;
  const groupedShortcutKeys = settings.NEWTAB_SHORTCUTS_GROUP_KEYS;
  const legacyShortcutKeys = [
    settings.newtabShortcutsLegacy.key,
    settings.newtabShortcutsLegacyChunk2.key,
    settings.newtabShortcutsLegacyChunk3.key
  ];
  const has = (object: StoredValues, key: string): boolean => Object.prototype.hasOwnProperty.call(object, key);

  function pickSyncValues(values: StoredValues, isPresent: (values: StoredValues, key: string) => boolean): StoredValues {
    const picked: StoredValues = {};
    syncKeys.forEach((key) => {
      if (isPresent(values, key)) {
        picked[key] = values[key];
      }
    });
    return picked;
  }

  function createSyncMeta(source: SyncMeta['source'], now: number): SyncMeta {
    return { lastSyncAt: now, source };
  }

  // The file written by "Export".
  function buildExportFile(storedValues: StoredValues | null | undefined, exportedAt: string, snapshot?: unknown): SettingsExportFile {
    return {
      version: snapshot ? 2 : 1,
      exportedAt,
      data: pickSyncValues(storedValues || {}, (values, key) => typeof values[key] !== 'undefined'),
      ...(snapshot ? { snapshot } : {})
    };
  }

  // What "Sync now" writes back to browser sync to push the values again.
  function buildManualSyncPayload(storedValues: StoredValues | null | undefined, now: number): StoredValues {
    const payload = pickSyncValues(storedValues || {}, (values, key) => typeof values[key] !== 'undefined');
    payload[settings.syncMeta.key] = createSyncMeta('manual', now);
    return payload;
  }

  // The settings object inside an exported file (older files are the bare
  // object) and its snapshot, or null when the text is not one.
  function parseImportFile(text: unknown): SettingsFileContents | null {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(String(text || ''));
    } catch (error) {
      return null;
    }
    const file = isStoredValues(parsed) && parsed.data ? parsed : null;
    const data = file ? file.data : parsed;
    if (!isStoredValues(data)) return null;
    return { data, snapshot: file && file.version === 2 && file.snapshot ? file.snapshot : null };
  }

  // What an import writes, and which keys it clears afterwards; null when
  // the file holds no known setting, unless a snapshot comes with it.
  function buildImportPlan(data: StoredValues, now: number, withSnapshot = false): SettingsImportPlan | null {
    const payload = pickSyncValues(data, has);
    // A single-key shortcut list from an old file must not be joined with
    // chunks of a newer list already in storage.
    if (has(data, settings.newtabShortcutsLegacy.key)) {
      [settings.newtabShortcutsLegacyChunk2.key, settings.newtabShortcutsLegacyChunk3.key]
        .forEach((key) => {
          if (!has(data, key)) {
            payload[key] = [];
          }
        });
    }
    // A file from before shortcut groups holds only the flat list. Clearing
    // the grouped copy makes New Tab read and migrate the imported list.
    const importsGroupedShortcuts = has(data, groupedShortcutKeys[0]);
    const keysToClear = !importsGroupedShortcuts &&
      legacyShortcutKeys.some((key) => has(payload, key))
      ? groupedShortcutKeys.slice()
      : [];
    if (!importsGroupedShortcuts) {
      groupedShortcutKeys.forEach((key) => { delete payload[key]; });
    }
    const autoGroupKey = settings.aggregateSearchAutoGroupEnabled.key;
    if (!has(data, autoGroupKey) && has(data, settings.aggregateSearches.key)) {
      payload[autoGroupKey] = deriveLegacyAutoGroupEnabled(data[settings.aggregateSearches.key]);
    }
    if (Object.keys(payload).length === 0 && !withSnapshot) {
      return null;
    }
    payload[settings.syncMeta.key] = createSyncMeta('import', now);
    return { keysToClear, payload };
  }

  return Object.freeze({
    buildExportFile,
    buildImportPlan,
    buildManualSyncPayload,
    parseImportFile
  });
}

export { createSyncTransfer };
export type { SettingsExportFile, SettingsFileContents, SettingsImportPlan, StoredValues, SyncMeta, SyncTransferDeps };
