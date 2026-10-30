import { describe, expect, it } from 'vitest';
import { NEWTAB_SHORTCUTS_GROUP_KEYS, themeMode } from '../domain/settings';
import type { StorageAreaLike, StorageItems, StorageKeys } from '../domain/storage-port';
import { migrateLocalSettingsToSync, shouldSkipEntryMotion, writeSettingRepairs, writeStorageValues } from './settings-storage';

function pick(values: StorageItems, keys: StorageKeys): StorageItems {
  const list = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys || values);
  return Object.fromEntries(list.filter((key) => key in values).map((key) => [key, values[key]]));
}

// An area that answers at once and refuses to remove or clear anything.
function createArea(values: StorageItems, read: (count: number) => StorageItems = () => values) {
  const writes: StorageItems[] = [];
  let reads = 0;
  const forbidden = () => {
    throw new Error('a migration must not remove or clear data');
  };
  const area: StorageAreaLike = {
    get(keys, callback) {
      reads += 1;
      if (callback) callback(pick(read(reads), keys));
    },
    set(items) {
      writes.push(items);
    },
    remove: forbidden,
    clear: forbidden
  };
  return { area, writes };
}

// Background and New Tab move local settings into sync through this one
// helper. It never removes anything and treats grouped shortcuts as one save.
describe('moving local settings into sync', () => {
  const [V2_HEAD, V2_CHUNK_2] = NEWTAB_SHORTCUTS_GROUP_KEYS;
  const PLAIN_KEY = themeMode.key;
  const ALL_KEYS = [PLAIN_KEY, ...NEWTAB_SHORTCUTS_GROUP_KEYS];

  function migrate(sync: StorageItems, local: StorageItems, syncAfterFirstRead?: StorageItems): StorageItems[] {
    const syncArea = createArea(sync, (count) => (count > 1 && syncAfterFirstRead ? { ...sync, ...syncAfterFirstRead } : sync));
    migrateLocalSettingsToSync(createArea(local).area, syncArea.area, ALL_KEYS);
    return syncArea.writes;
  }

  it('copies a value sync lacks', () => {
    expect(migrate({}, { [PLAIN_KEY]: 'dark' })).toEqual([{ [PLAIN_KEY]: 'dark' }]);
  });

  it('keeps a value already in sync', () => {
    expect(migrate({ [PLAIN_KEY]: 'light' }, { [PLAIN_KEY]: 'dark' })).toEqual([]);
  });

  it('does not overwrite a value synced after the first read', () => {
    expect(migrate({}, { [PLAIN_KEY]: 'dark' }, { [PLAIN_KEY]: 'light' })).toEqual([]);
  });

  it('never moves a local shortcut chunk without its head', () => {
    expect(migrate({}, { [V2_CHUNK_2]: ['b'] })).toEqual([]);
  });

  it('moves the whole local grouped save with its head, replacing a stray chunk in sync', () => {
    expect(migrate({ [V2_CHUNK_2]: ['stray'] }, { [V2_HEAD]: { v: 2 }, [V2_CHUNK_2]: ['b'] }))
      .toEqual([{ [V2_HEAD]: { v: 2 }, [V2_CHUNK_2]: ['b'] }]);
  });

  it('moves no local chunk next to a head sync already has', () => {
    expect(migrate({ [V2_HEAD]: { v: 3 } }, { [V2_HEAD]: { v: 2 }, [V2_CHUNK_2]: ['b'] })).toEqual([]);
  });

  it('moves none of the local grouped save once another device synced one', () => {
    expect(migrate({}, { [V2_HEAD]: { v: 2 }, [V2_CHUNK_2]: ['b'], [PLAIN_KEY]: 'dark' }, { [V2_HEAD]: { v: 3 } }))
      .toEqual([{ [PLAIN_KEY]: 'dark' }]);
  });
});

// A page that finds a setting missing writes its default only when this
// device has no local copy left to migrate; otherwise the default would win
// over the user's old choice.
describe('setting repairs', () => {
  it('repairs invalid values at once and fills missing ones only without a local copy', () => {
    const local = createArea({ a: 'old' });
    const target = createArea({});

    writeSettingRepairs({ storage: { local: local.area } }, target.area, { a: 'default', b: 'default', c: 'fixed' }, { c: 'broken' });

    expect(target.writes).toEqual([{ c: 'fixed' }, { b: 'default' }]);
  });
});

describe('entry motion', () => {
  it('skips the entry motion with motion effects off or when the system asks for reduced motion', () => {
    expect(shouldSkipEntryMotion({ matchMedia: () => ({ matches: false }) }, false)).toBe(true);
    expect(shouldSkipEntryMotion({ matchMedia: () => ({ matches: true }) }, true)).toBe(true);
    expect(shouldSkipEntryMotion({ matchMedia: () => ({ matches: false }) }, true)).toBe(false);
  });
});

describe('writing storage values', () => {
  it('writes related keys in one operation', async () => {
    const payloads: StorageItems[] = [];
    const area: StorageAreaLike = {
      get() {},
      set(items, callback) {
        payloads.push(items);
        callback?.();
      }
    };
    const values = { customProviders: [{ id: 'source-1' }], disabledProviders: ['builtin-1'] };

    const written = await writeStorageValues(area, { runtime: { lastError: null } }, values);

    expect(payloads).toEqual([values]);
    expect(written).toEqual(values);
  });

  it('rejects with the error the browser reports', async () => {
    const chromeApi: { runtime: { lastError: { message: string } | null } } = { runtime: { lastError: null } };
    const area: StorageAreaLike = {
      get() {},
      set(_items, callback) {
        chromeApi.runtime.lastError = { message: 'multi write failed' };
        callback?.();
      }
    };

    await expect(writeStorageValues(area, chromeApi, { customProviders: [] })).rejects.toThrow(/multi write failed/);
  });

  it('retries a write the write quota refused once', async () => {
    const chromeApi: { runtime: { lastError: { message: string } | null } } = { runtime: { lastError: null } };
    const values: StorageItems = {};
    let calls = 0;
    const area: StorageAreaLike = {
      get() {},
      set(items, callback) {
        calls += 1;
        if (calls === 1) {
          chromeApi.runtime.lastError = { message: 'This request exceeds the MAX_WRITE_OPERATIONS_PER_MINUTE quota.' };
          callback?.();
          chromeApi.runtime.lastError = null;
          return;
        }
        Object.assign(values, items);
        callback?.();
      }
    };

    await writeStorageValues(area, chromeApi, { e: 1 }, { retryDelayMs: 0 });

    expect([values.e, calls]).toEqual([1, 2]);
  });
});
