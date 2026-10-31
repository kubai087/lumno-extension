// Settings export/import carry browser preferences and the complete shortcut
// state. "Sync now" writes only the Chrome Sync contract.
import type * as Settings from '../domain/settings';
import { createShortcutStoragePlan, readShortcutState } from '../domain/shortcuts/storage-plan';
import { newtabShortcutsLocalOverflow } from '../domain/settings/newtab-shortcuts';

const PORTABLE_SHORTCUTS = 'lumnoShortcutState';

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
  version: 1;
  exportedAt: string;
  data: StoredValues;
}

interface SettingsImportPlan {
  // Keys the import clears after writing.
  keysToClear: string[];
  payload: StoredValues;
  devicePayload?: StoredValues;
  deviceKeysToClear?: string[];
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
  function buildExportFile(storedValues: StoredValues | null | undefined, exportedAt: string): SettingsExportFile {
    const values = storedValues || {};
    const hasShortcuts = [...groupedShortcutKeys, ...legacyShortcutKeys, newtabShortcutsLocalOverflow.key].some((key) => has(values, key));
    const shortcuts = hasShortcuts ? readShortcutState(values, values[newtabShortcutsLocalOverflow.key]) : null;
    if (shortcuts?.torn && shortcuts.source !== 'local') throw new Error('incomplete-shortcuts');
    return {
      version: 1,
      exportedAt,
      data: {
        ...pickSyncValues(values, (entry, key) => typeof entry[key] !== 'undefined'),
        ...(shortcuts ? { [PORTABLE_SHORTCUTS]: { groups: shortcuts.groups, items: shortcuts.items, migratedAt: shortcuts.migratedAt } } : {})
      }
    };
  }

  // What "Sync now" writes back to browser sync to push the values again.
  function buildManualSyncPayload(storedValues: StoredValues | null | undefined, now: number): StoredValues {
    const payload = pickSyncValues(storedValues || {}, (values, key) => typeof values[key] !== 'undefined');
    payload[settings.syncMeta.key] = createSyncMeta('manual', now);
    return payload;
  }

  // The settings object inside an exported file (older files are the bare
  // object), or null when the text is not one.
  function parseImportFile(text: unknown): StoredValues | null {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(String(text || ''));
    } catch (error) {
      return null;
    }
    const data = isStoredValues(parsed) && parsed.data ? parsed.data : parsed;
    return isStoredValues(data) ? data : null;
  }

  // What an import writes, and which keys it clears afterwards; null when
  // the file holds no known setting.
  function buildImportPlan(data: StoredValues, now: number, maxShortcutBytes?: number, localMode = false): SettingsImportPlan | null {
    const payload = pickSyncValues(data, has);
    const devicePayload: StoredValues = {};
    const portable = data[PORTABLE_SHORTCUTS];
    if (has(data, PORTABLE_SHORTCUTS)) {
      if (!isStoredValues(portable) || !Array.isArray(portable.groups) || !Array.isArray(portable.items)) return null;
      const shortcutPlan = createShortcutStoragePlan(portable, localMode
        ? { maxItemBytes: Number.MAX_SAFE_INTEGER, maxTotalBytes: Number.MAX_SAFE_INTEGER }
        : { maxTotalBytes: maxShortcutBytes });
      Object.assign(payload, shortcutPlan.payload);
      if (!localMode) devicePayload[newtabShortcutsLocalOverflow.key] = shortcutPlan.overflowRecord;
    }
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
    const importsGroupedShortcuts = has(data, groupedShortcutKeys[0]) || has(data, PORTABLE_SHORTCUTS);
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
    if (Object.keys(payload).length === 0 && Object.keys(devicePayload).length === 0) {
      return null;
    }
    payload[settings.syncMeta.key] = createSyncMeta('import', now);
    const importsShortcuts = importsGroupedShortcuts || legacyShortcutKeys.some((key) => has(payload, key));
    const deviceKeysToClear = importsShortcuts && (localMode || !has(data, PORTABLE_SHORTCUTS)) ? [newtabShortcutsLocalOverflow.key] : [];
    return { keysToClear, payload, ...(Object.keys(devicePayload).length ? { devicePayload } : {}),
      ...(deviceKeysToClear.length ? { deviceKeysToClear } : {}) };
  }

  return Object.freeze({
    buildExportFile,
    buildImportPlan,
    buildManualSyncPayload,
    parseImportFile
  });
}

export { createSyncTransfer };
export type { SettingsExportFile, SettingsImportPlan, StoredValues, SyncMeta, SyncTransferDeps };
