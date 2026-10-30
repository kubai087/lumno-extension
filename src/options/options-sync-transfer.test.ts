import { describe, expect, it } from 'vitest';
import * as Settings from '../domain/settings';
import { createAggregateSearchModel } from './options-aggregate-search';
import { createSyncTransfer, type StoredValues } from './options-sync-transfer';

const transfer = createSyncTransfer({
  deriveLegacyAutoGroupEnabled: createAggregateSearchModel().deriveLegacyAutoGroupEnabled,
  settings: Settings
});
const META = Settings.syncMeta.key;
const [V2_HEAD, V2_CHUNK_2, V2_CHUNK_3] = Settings.NEWTAB_SHORTCUTS_GROUP_KEYS;

function plan(values: StoredValues, now = 1) {
  const built = transfer.buildImportPlan(values, now);
  if (!built) throw new Error('Expected the file to import.');
  return built;
}

describe('Options settings transfer', () => {
  it('exports and syncs now only the settings browser sync carries', () => {
    const stored = {
      [Settings.themeMode.key]: 'dark',
      [Settings.language.key]: undefined,
      [Settings.webdavStatus.key]: { enabled: true },
      unrelated: 1
    };
    expect(transfer.buildExportFile(stored, '2026-01-01T00:00:00.000Z')).toEqual({
      version: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      data: { [Settings.themeMode.key]: 'dark' }
    });
    expect(transfer.buildManualSyncPayload(stored, 42)).toEqual({
      [Settings.themeMode.key]: 'dark',
      [META]: { lastSyncAt: 42, source: 'manual' }
    });
  });

  it('reads the wrapped export format and older bare objects, and nothing else', () => {
    expect(transfer.parseImportFile('{"data":{"a":1}}')).toEqual({ a: 1 });
    expect(transfer.parseImportFile('{"a":1}')).toEqual({ a: 1 });
    expect(transfer.parseImportFile('not json')).toBeNull();
    expect(transfer.parseImportFile('"text"')).toBeNull();
    expect(transfer.parseImportFile('')).toBeNull();
  });

  it('imports the known settings and stamps them as an import', () => {
    expect(transfer.buildImportPlan({ unrelated: 1 }, 1)).toBeNull();
    expect(plan({ [Settings.themeMode.key]: 'light', [Settings.siteSearchCustom.key]: [], unrelated: 1 }, 7)).toEqual({
      keysToClear: [],
      payload: {
        [Settings.themeMode.key]: 'light',
        [Settings.siteSearchCustom.key]: [],
        [META]: { lastSyncAt: 7, source: 'import' }
      }
    });
  });

  it('clears stale shortcut chunks and groups for a file from before them', () => {
    const legacy = plan({ [Settings.newtabShortcutsLegacy.key]: [{ url: 'https://a' }] });
    expect(legacy.payload[Settings.newtabShortcutsLegacyChunk2.key]).toEqual([]);
    expect(legacy.payload[Settings.newtabShortcutsLegacyChunk3.key]).toEqual([]);
    // New Tab then migrates the imported flat list.
    expect(legacy.keysToClear).toEqual([V2_HEAD, V2_CHUNK_2, V2_CHUNK_3]);
  });

  it('imports grouped shortcuts only as a whole save with its head', () => {
    const partial = plan({ [Settings.themeMode.key]: 'dark', [V2_CHUNK_2]: ['orphan'] });
    expect(partial.payload).not.toHaveProperty(V2_CHUNK_2);
    expect(partial.keysToClear).toEqual([]);
    const groups = plan({ [V2_HEAD]: { v: 2 }, [V2_CHUNK_2]: ['b'] });
    expect(groups.payload[V2_HEAD]).toEqual({ v: 2 });
    expect(groups.payload[V2_CHUNK_2]).toEqual(['b']);
    expect(groups.keysToClear).toEqual([]);
  });

  it('derives the aggregate tab-group switch for old exports, and keeps an exported one', () => {
    const aggregates = plan({
      [Settings.aggregateSearches.key]: {
        version: 1,
        items: [{ id: 'x', key: 'x', name: 'X', sourceRefs: ['builtin:a', 'builtin:b'], autoCreateTabGroup: false }]
      }
    });
    expect(aggregates.payload[Settings.aggregateSearchAutoGroupEnabled.key]).toBe(false);
    const explicit = plan({ [Settings.aggregateSearches.key]: [], [Settings.aggregateSearchAutoGroupEnabled.key]: true });
    expect(explicit.payload[Settings.aggregateSearchAutoGroupEnabled.key]).toBe(true);
  });
});
