import { describe, expect, it } from 'vitest';
import { SETTINGS_SCHEMA_VERSION } from '../domain/settings/migrations';
import { overlayFontFamily } from '../domain/settings/overlay-panel';
import { LANGUAGE_MESSAGES_KEY } from '../domain/settings/removed';
import { settingsSchemaVersion } from '../domain/settings/sync-state';
import type { StorageItems, StorageKeys } from '../domain/storage-port';
import { runSettingsMigrations } from './settings-migration';
import {
  AI_SEARCH_LOCAL,
  AI_SEARCH_SYNC,
  BOOKMARK_TOPBAR_SYNC,
  LANGUAGE_MESSAGES_CACHE,
  LEGACY_ICON_CACHES,
  OVERLAY_FONT_SYNC,
  SHARED_SYNC_PREFERENCES
} from '../../tests/fakes/older-device-settings';

const VERSION_KEY = settingsSchemaVersion.key;

interface Runtime {
  lastError: { message: string } | null;
}

// A storage area that answers after the current task; a failing write leaves
// its message in runtime.lastError while its callback runs, as Chrome does.
function createArea(initial: StorageItems, runtime: Runtime, failRemove?: string) {
  const values: StorageItems = { ...initial };
  const writes: Array<[string, string[]]> = [];
  const later = (work: () => void) => setTimeout(work, 0);
  return {
    values,
    writes,
    get(keys: StorageKeys, callback?: (items: StorageItems | undefined) => void) {
      const list = keys === null ? Object.keys(values) : (Array.isArray(keys) ? keys : (typeof keys === 'string' ? [keys] : Object.keys(keys)));
      later(() => callback?.(Object.fromEntries(list.filter((key) => Object.hasOwn(values, key)).map((key) => [key, values[key]]))));
    },
    set(items: StorageItems, callback?: () => void) {
      writes.push(['set', Object.keys(items)]);
      later(() => {
        Object.assign(values, items);
        callback?.();
      });
    },
    remove(keys: string | string[], callback?: () => void) {
      const list = Array.isArray(keys) ? keys : [keys];
      writes.push(['remove', list]);
      later(() => {
        if (failRemove) {
          runtime.lastError = { message: failRemove };
        } else {
          list.forEach((key) => { delete values[key]; });
        }
        callback?.();
        runtime.lastError = null;
      });
    }
  };
}

function createChrome(options: { sync?: StorageItems; local?: StorageItems; failSyncRemove?: string } = {}) {
  const runtime: Runtime = { lastError: null };
  const sync = createArea(options.sync || {}, runtime, options.failSyncRemove);
  const local = createArea(options.local || {}, runtime);
  return { sync, local, chrome: { runtime, storage: { sync, local } } };
}

describe('running the settings migrations', () => {
  it('cleans an old device, keeps its own font choice, and writes nothing on the next start', async () => {
    const { chrome, sync, local } = createChrome({
      sync: { ...SHARED_SYNC_PREFERENCES, ...AI_SEARCH_SYNC, ...BOOKMARK_TOPBAR_SYNC, ...OVERLAY_FONT_SYNC },
      local: { [LANGUAGE_MESSAGES_KEY]: LANGUAGE_MESSAGES_CACHE, ...AI_SEARCH_LOCAL, ...LEGACY_ICON_CACHES, [overlayFontFamily.key]: 'PingFang SC' }
    });

    expect(await runSettingsMigrations(chrome)).toBe(SETTINGS_SCHEMA_VERSION);
    expect(sync.values).toEqual(SHARED_SYNC_PREFERENCES);
    expect(local.values).toEqual({ [overlayFontFamily.key]: 'PingFang SC', [VERSION_KEY]: SETTINGS_SCHEMA_VERSION });

    sync.writes.length = 0;
    local.writes.length = 0;
    expect(await runSettingsMigrations(chrome)).toBe(SETTINGS_SCHEMA_VERSION);
    expect([sync.writes, local.writes]).toEqual([[], []]);
  });

  it('does not repeat the migrations a device already ran', async () => {
    const { chrome, sync, local } = createChrome({
      sync: { ...AI_SEARCH_SYNC, ...BOOKMARK_TOPBAR_SYNC },
      local: { ...AI_SEARCH_LOCAL, [VERSION_KEY]: 3 }
    });

    await runSettingsMigrations(chrome);

    expect(Object.keys(sync.values).sort()).toEqual(Object.keys(AI_SEARCH_SYNC).sort());
    expect(local.values[VERSION_KEY]).toBe(SETTINGS_SCHEMA_VERSION);
  });

  it('records the version only after every change is written, so the next start retries', async () => {
    const { chrome, local } = createChrome({ sync: { ...AI_SEARCH_SYNC }, failSyncRemove: 'QUOTA_BYTES_PER_HOUR quota exceeded' });

    await expect(runSettingsMigrations(chrome)).rejects.toThrow(/QUOTA_BYTES_PER_HOUR/);
    expect(Object.hasOwn(local.values, VERSION_KEY)).toBe(false);
  });

  it('migrates the device storage without browser sync, and does nothing without storage', async () => {
    const runtime: Runtime = { lastError: null };
    const local = createArea({ ...AI_SEARCH_LOCAL }, runtime);

    expect(await runSettingsMigrations({ runtime, storage: { local } })).toBe(SETTINGS_SCHEMA_VERSION);
    expect(local.values).toEqual({ [VERSION_KEY]: SETTINGS_SCHEMA_VERSION });
    expect(await runSettingsMigrations({ runtime: {} })).toBe(0);
  });
});
