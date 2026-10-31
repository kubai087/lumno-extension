import { describe, expect, it } from 'vitest';
import * as Settings from '../domain/settings';
import type { StorageAreaLike, StorageItems, StorageKeys } from '../domain/storage-port';
import { formatTemplate } from './format-template';
import { createSyncSection } from './options-sync-section';
import type { BrowserSyncCardModel } from './react/account-tab';

const KEY = Settings.bookmarkViewMode.key;
const [V2_HEAD, V2_CHUNK_2] = Settings.NEWTAB_SHORTCUTS_GROUP_KEYS;

function pick(values: StorageItems, keys: StorageKeys): StorageItems {
  const list = Array.isArray(keys) ? keys : (typeof keys === 'string' ? [keys] : []);
  return Object.fromEntries(list.filter((key) => key in values).map((key) => [key, values[key]]));
}

interface SectionOptions {
  primary?: string;
  // What browser sync holds from its second read on, as if another device saved meanwhile.
  syncAfterFirstRead?: StorageItems;
  withoutStorage?: boolean;
  browserName?: string;
}

function setUp(sync: StorageItems, local: StorageItems, options: SectionOptions = {}) {
  const writes: StorageItems[] = [];
  const rendered: BrowserSyncCardModel[] = [];
  let syncReads = 0;
  // No remove() or clear(): moving settings never deletes anything.
  const storageArea: StorageAreaLike = {
    get(keys, callback) {
      syncReads += 1;
      const values = options.syncAfterFirstRead && syncReads > 1 ? { ...sync, ...options.syncAfterFirstRead } : sync;
      callback?.(pick(values, keys));
    },
    set(payload) {
      writes.push(payload);
    }
  };
  const localStorageArea: StorageAreaLike = {
    get(keys, callback) {
      callback?.(pick(local, keys));
    },
    set() {}
  };
  const section = createSyncSection({
    beginToast: () => ({ cancel() {}, done() {}, fail() {} }),
    browserName: options.browserName || 'Edge',
    chromeApi: { runtime: { lastError: null }, storage: {} },
    documentObj: document,
    onRender: (model) => rendered.push(model),
    refreshSyncNowTooltip() {},
    formatTemplate,
    getActivePrimaryAreaName: () => options.primary || 'sync',
    getMessage: (_key, fallback) => fallback,
    loadDeviceSnapshots: () => Promise.reject(new Error('not used')),
    localStorageArea: options.withoutStorage ? null : localStorageArea,
    settings: Settings,
    showToast() {},
    storageArea: options.withoutStorage ? null : storageArea,
    syncTransfer: null
  });
  const model = () => {
    const last = rendered.at(-1);
    if (!last) throw new Error('The sync card was never drawn.');
    return last;
  };
  return { section, writes, model };
}

describe('Options browser sync card', () => {
  it('moves settings older versions kept only on this device into browser sync', () => {
    const page = setUp({}, { [KEY]: 'folder' });
    page.section.migrateStorageIfNeeded([KEY]);
    expect(page.writes).toEqual([{ [KEY]: 'folder' }]);
  });

  it('leaves a value synced in the meantime or already in sync alone', () => {
    const raced = setUp({}, { [KEY]: 'folder' }, { syncAfterFirstRead: { [KEY]: 'top' } });
    raced.section.migrateStorageIfNeeded([KEY]);
    expect(raced.writes).toEqual([]);
    const present = setUp({ [KEY]: 'top' }, { [KEY]: 'folder' });
    present.section.migrateStorageIfNeeded([KEY]);
    expect(present.writes).toEqual([]);
  });

  it('moves nothing while this device\'s storage is primary', () => {
    const page = setUp({}, { [KEY]: 'folder' }, { primary: 'local' });
    page.section.migrateStorageIfNeeded([KEY]);
    expect(page.writes).toEqual([]);
  });

  it('moves grouped shortcuts only as a whole save with its head', () => {
    const partial = setUp({}, { [V2_CHUNK_2]: ['b'] });
    partial.section.migrateStorageIfNeeded([...Settings.NEWTAB_SHORTCUTS_GROUP_KEYS]);
    expect(partial.writes).toEqual([]);
    // The whole save replaces a stray chunk in sync.
    const whole = setUp({ [V2_CHUNK_2]: ['stray'] }, { [V2_HEAD]: { v: 2 }, [V2_CHUNK_2]: ['b'] });
    whole.section.migrateStorageIfNeeded([...Settings.NEWTAB_SHORTCUTS_GROUP_KEYS]);
    expect(whole.writes).toEqual([{ [V2_HEAD]: { v: 2 }, [V2_CHUNK_2]: ['b'] }]);
    const headed = setUp({}, { [V2_HEAD]: { v: 2 }, [V2_CHUNK_2]: ['b'] }, { syncAfterFirstRead: { [V2_HEAD]: { v: 3 } } });
    headed.section.migrateStorageIfNeeded([...Settings.NEWTAB_SHORTCUTS_GROUP_KEYS]);
    expect(headed.writes).toEqual([]);
  });

  it('names the browser and shows whether settings sync and why they fail', () => {
    const page = setUp({}, {});
    expect(page.model().title).toBe('Edge 内置同步');
    page.section.refreshSyncStatus();
    expect(page.model().status).toMatchObject({ tone: 'success', text: '同步已开启' });
    expect(page.model().available).toBe(true);
    page.section.updateSyncStatusText('sync_status_failed_reason', '同步失败：{reason}', { reason: 'quota' });
    expect(page.model().status.tone).toBe('danger');
    expect(page.model().status.tooltip).toMatch(/同步不可用/);
    expect(page.model().status.text).toBe('同步失败：quota');
  });

  it('turns the buttons off without a storage area to sync through', () => {
    const page = setUp({}, {}, { withoutStorage: true, browserName: 'Chrome' });
    page.section.refreshSyncStatus();
    expect(page.model().available).toBe(false);
    expect(page.model().status.text).toBe('同步不可用');
    expect(page.model().summary).toBe('');
  });

  it('says how many shortcuts browser sync carries', () => {
    const page = setUp({}, {});
    page.section.refreshShortcutSyncSummary();
    expect(page.model().summary).toMatch(/^Shortcuts: all \d+ sync with the browser\.$/);
  });
});
