import { describe, expect, it } from 'vitest';
import { LEGACY_SHORTCUTS_CHUNK_KEYS, SHORTCUTS_SYNC_KEYS } from '../domain/shortcuts/constants';
import { readShortcutState } from '../domain/shortcuts/storage-plan';
import { newtabShortcutsLocalOverflow } from '../domain/settings/newtab-shortcuts';
import { loadShortcutState, loadShortcuts, persistShortcutState, saveShortcuts, type ShortcutStorageArea } from './shortcut-storage';

const OVERFLOW_KEY = newtabShortcutsLocalOverflow.key;
const DAY_MS = 24 * 60 * 60 * 1000;

// A storage area that answers at once and keeps copies, as Chrome's do.
function createMemoryStorage(initialData: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = structuredClone(initialData);
  return {
    data,
    get(keys: string[], callback: (items: unknown) => void) {
      callback(Object.fromEntries(keys.filter((key) => Object.hasOwn(data, key)).map((key) => [key, structuredClone(data[key])])));
    },
    set(values: Record<string, unknown>, callback: () => void) {
      Object.assign(data, structuredClone(values));
      callback();
    },
    remove(keys: string[], callback: () => void) {
      keys.forEach((key) => delete data[key]);
      callback();
    }
  } satisfies ShortcutStorageArea & { data: Record<string, unknown> };
}

// One field of a stored shortcut, which links and folders do not share.
function field(item: object, key: string): unknown {
  return new Map<string, unknown>(Object.entries(item)).get(key);
}

function createShortcutInputs(count: number, path = '') {
  return Array.from({ length: count }, (_, index) => ({
    id: `shortcut-${index + 1}`,
    title: `Shortcut ${index + 1}`,
    url: `https://shortcut-${index + 1}.example/${path}`
  }));
}

describe('shortcut storage', () => {
  it('keeps browser pages and every other scheme through saving, loading and editing', async () => {
    const storage = createMemoryStorage();
    const saved = await saveShortcuts(storage, [
      { id: 'inspect', title: 'Inspect', url: 'chrome://inspect/#devices' },
      { id: 'settings', title: 'Settings', url: 'chrome://settings' },
      { id: 'duplicate', title: 'Duplicate', url: 'CHROME://SETTINGS/' },
      { id: 'example', title: 'Example', url: 'https://example.com/' },
      { id: 'plain', title: 'Plain', url: 'http://plain.example/' },
      { id: 'local', title: 'Local', url: 'https://localhost:3000/app' }
    ]);
    const loaded = await loadShortcuts(storage);

    expect(loaded).toEqual(saved);
    expect(loaded.map((item) => item.id)).toEqual(['inspect', 'settings', 'example', 'plain', 'local']);
    // Including a host that looks like a scheme.
    expect(loaded.map((item) => field(item, 'url'))).toEqual([
      'chrome://inspect/#devices',
      'chrome://settings/',
      'https://example.com/',
      'http://plain.example/',
      'https://localhost:3000/app'
    ]);

    await saveShortcuts(storage, loaded.map((item) => (item.id === 'inspect'
      ? { ...item, title: 'Network', url: 'chrome://net-export/' }
      : item)));
    expect((await loadShortcuts(storage))[0]).toMatchObject({ id: 'inspect', title: 'Network', url: 'chrome://net-export/' });
  });

  it('starts with the Lumno shortcut only when nothing was ever saved', async () => {
    const storage = createMemoryStorage();
    expect((await loadShortcuts(storage)).map((shortcut) => shortcut.title)).toEqual(['Lumno']);

    storage.data[LEGACY_SHORTCUTS_CHUNK_KEYS[0]] = [];
    expect(await loadShortcuts(storage)).toEqual([]);

    await saveShortcuts(storage, []);
    delete storage.data[LEGACY_SHORTCUTS_CHUNK_KEYS[0]];
    expect(await loadShortcuts(storage)).toEqual([]);
  });

  it('keeps the order shortcuts are saved in', async () => {
    const storage = createMemoryStorage();
    const saved = await saveShortcuts(storage, [
      { id: 'three', title: 'Three', url: 'https://three.example/' },
      { id: 'one', title: 'One', url: 'https://one.example/' },
      { id: 'two', title: 'Two', url: 'https://two.example/' }
    ], { maxShortcuts: 8 });

    expect(saved.map((shortcut) => shortcut.id)).toEqual(['three', 'one', 'two']);
    expect((await loadShortcuts(storage)).map((shortcut) => shortcut.id)).toEqual(['three', 'one', 'two']);
  });

  it('migrates the legacy list without touching it, then ignores later edits to it', async () => {
    const legacyItems = createShortcutInputs(3).map((item) => ({ ...item, createdAt: 5, updatedAt: 6 }));
    const storage = createMemoryStorage({
      [LEGACY_SHORTCUTS_CHUNK_KEYS[0]]: legacyItems,
      [LEGACY_SHORTCUTS_CHUNK_KEYS[1]]: [],
      [LEGACY_SHORTCUTS_CHUNK_KEYS[2]]: []
    });
    const legacyCopy = structuredClone(storage.data);

    const before = await loadShortcutState(storage);
    expect(before.source).toBe('legacy');
    expect(before.groups).toEqual([{ id: 'g0', title: '' }]);
    // Timestamps from the legacy list are not carried into the grouped state.
    expect(before.items.map((item) => Object.keys(item))).toEqual(before.items.map(() => ['id', 'groupId', 'title', 'url', 'host']));

    await saveShortcuts(storage, before.items.slice(0, 2), { now: 50 });
    // Older devices keep reading the legacy list.
    LEGACY_SHORTCUTS_CHUNK_KEYS.forEach((key) => expect(storage.data[key]).toEqual(legacyCopy[key]));

    storage.data[LEGACY_SHORTCUTS_CHUNK_KEYS[0]] = createShortcutInputs(9);
    const after = await loadShortcutState(storage);
    expect(after.source).toBe('v2');
    expect(after.migratedAt).toBe(50);
    expect(after.items.map((item) => item.id)).toEqual(['shortcut-1', 'shortcut-2']);
  });

  it('keeps bookmark folders by id and by portable reference, deduplicated apart from URLs', async () => {
    const portable = {
      id: 'shortcut-folder-entry',
      type: 'folder',
      title: '灵感',
      folderRef: { version: 1, root: 'bookmarks-bar', scope: 'account', path: ['设计', '灵感'], fingerprint: '0123456789abcdef' }
    };
    const storage = createMemoryStorage();
    await saveShortcuts(storage, [
      { type: 'folder', folderId: '42', title: 'Design' },
      { type: 'folder', folderId: '42', title: 'Duplicate' },
      { type: 'folder', folderId: '43', title: 'Other folder' },
      portable,
      { url: 'https://example.com/', title: 'Site' }
    ]);
    const loaded = await loadShortcuts(storage);

    expect(loaded).toHaveLength(4);
    expect(field(loaded[0], 'folderId')).toBe('42');
    expect(field(loaded[1], 'folderId')).toBe('43');
    expect(loaded[2]).toEqual({ ...portable, groupId: 'g0' });
    expect(field(loaded[3], 'url')).toBe('https://example.com/');
  });

  it('keeps valid icon sources and drops invalid ones', async () => {
    const storage = createMemoryStorage();
    await saveShortcuts(storage, [
      { url: 'https://service.example/', iconSource: 'service' },
      { url: 'https://favicon-is.example/', iconSource: 'favicon-is' },
      { url: 'https://cache.example/', iconSource: 'cache' },
      { url: 'https://custom.example/', iconSource: 'custom' },
      { url: 'https://github.com/', iconSource: 'builtin' },
      { url: 'https://legacy.example/' },
      { url: 'https://invalid.example/', iconSource: 'unapproved' }
    ]);

    expect((await loadShortcuts(storage)).map((item) => field(item, 'iconSource')))
      .toEqual(['service', 'favicon-is', 'cache', 'custom', 'builtin', undefined, undefined]);
  });

  it('keeps icon plate choices; "off" drops its color and invalid values are ignored', async () => {
    const storage = createMemoryStorage();
    await saveShortcuts(storage, [
      { url: 'https://auto.example/' },
      { url: 'https://off.example/', iconPlate: 'off', iconPlateColor: '#ff0000' },
      { url: 'https://on.example/', iconPlate: 'on' },
      { url: 'https://tint.example/', iconSource: 'cache', iconPlate: 'on', iconPlateColor: '#fdeee4' },
      { url: 'https://color-only.example/', iconPlateColor: '#123ABC' },
      { url: 'https://invalid.example/', iconPlate: 'sometimes', iconPlateColor: 'red' }
    ]);

    expect((await loadShortcuts(storage)).map((item) => ['iconPlate', 'iconPlateColor', 'iconSource'].map((key) => field(item, key)))).toEqual([
      [undefined, undefined, undefined],
      ['off', undefined, undefined],
      ['on', undefined, undefined],
      ['on', '#FDEEE4', 'cache'],
      [undefined, '#123ABC', undefined],
      [undefined, undefined, undefined]
    ]);
  });

  it('marks only website shortcuts copied from a bookmark', async () => {
    const storage = createMemoryStorage();
    await saveShortcuts(storage, [
      { url: 'https://copied.example/', fromBookmark: true },
      { url: 'https://plain.example/', fromBookmark: 'yes' },
      { type: 'folder', folderId: '42', title: 'Folder', fromBookmark: true }
    ]);

    expect((await loadShortcuts(storage)).map((item) => field(item, 'fromBookmark'))).toEqual([true, undefined, undefined]);
  });

  it('rejects a set that does not fit browser sync when there is no overflow area', async () => {
    const oversized = [{ id: 'oversized', title: 'Oversized', url: `https://oversized.example/path?query=${'x'.repeat(9000)}` }];

    await expect(saveShortcuts(createMemoryStorage(), oversized)).rejects.toMatchObject({ code: 'SHORTCUT_SYNC_QUOTA_EXCEEDED' });
  });

  it('rejects a write the browser reports as failed instead of reporting it saved', async () => {
    const writeError = { message: 'QUOTA_BYTES quota exceeded' };
    const area: ShortcutStorageArea = {
      get: (_keys, callback) => callback({}),
      set: (_values, callback) => callback()
    };

    await expect(saveShortcuts(area, createShortcutInputs(1), { getLastError: () => writeError }))
      .rejects.toMatchObject({ code: 'SHORTCUT_STORAGE_WRITE_FAILED', message: writeError.message });
  });
});

describe('persisting shortcuts', () => {
  it('splits the state between browser sync and the local overflow record', async () => {
    const sync = createMemoryStorage({ [LEGACY_SHORTCUTS_CHUNK_KEYS[0]]: [] });
    const local = createMemoryStorage();
    const items = createShortcutInputs(40, `?q=${'y'.repeat(200)}`);
    const result = await persistShortcutState(sync, { items }, {
      overflowArea: local, maxTotalBytes: 4000, legacyKeysPresent: true, now: 10 * DAY_MS
    });

    expect(result.syncLimited).toBe(true);
    expect(result.localOnlyIds.length + result.plan.syncedItems.length).toBe(40);
    // The overflow record names the save it belongs to.
    expect(local.data[OVERFLOW_KEY]).toMatchObject({ rev: result.plan.rev });
    expect(sync.data[SHORTCUTS_SYNC_KEYS[0]]).toMatchObject({ r: result.plan.rev });
    expect(readShortcutState(sync.data, local.data[OVERFLOW_KEY]).items.map((item) => item.id)).toEqual(items.map((item) => item.id));
    // A fresh migration keeps the legacy list.
    expect(Object.hasOwn(sync.data, LEGACY_SHORTCUTS_CHUNK_KEYS[0])).toBe(true);
  });

  it('gives the legacy list\'s sync bytes back thirty days after migration', async () => {
    const sync = createMemoryStorage({ [LEGACY_SHORTCUTS_CHUNK_KEYS[0]]: [] });
    const local = createMemoryStorage();
    const options = { overflowArea: local, maxTotalBytes: 4000, legacyKeysPresent: true };
    const first = await persistShortcutState(sync, { items: createShortcutInputs(3) }, { ...options, now: 10 * DAY_MS });

    const later = await persistShortcutState(sync, first.state, { ...options, now: 10 * DAY_MS + 29 * DAY_MS });
    expect(later.plan.removeKeys).toEqual([]);
    await persistShortcutState(sync, first.state, { ...options, now: 10 * DAY_MS + 30 * DAY_MS });
    expect(Object.hasOwn(sync.data, LEGACY_SHORTCUTS_CHUNK_KEYS[0])).toBe(false);
  });

  it('makes the local record the whole state when the sync write fails', async () => {
    const failing: ShortcutStorageArea = {
      set() {
        throw new Error('QUOTA_BYTES quota exceeded');
      }
    };
    const local = createMemoryStorage();
    const failed = await persistShortcutState(failing, { items: createShortcutInputs(3) }, { overflowArea: local });

    expect(failed.syncError).toBeTruthy();
    expect(local.data[OVERFLOW_KEY]).toMatchObject({ authoritative: true });
    expect(failed.localOnlyIds).toEqual(['shortcut-1', 'shortcut-2', 'shortcut-3']);
  });

  it('writes every item to the given area when there is no overflow area', async () => {
    const unlimited = createMemoryStorage();
    const items = createShortcutInputs(40, `?q=${'y'.repeat(200)}`);
    const result = await persistShortcutState(unlimited, { items }, {});

    expect(result.syncLimited).toBe(false);
    expect(unlimited.data[SHORTCUTS_SYNC_KEYS[0]]).toHaveProperty('s.length', 40);
  });
});
