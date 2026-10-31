import { describe, expect, it } from 'vitest';
import { bookmarkTopbarLayout } from '../domain/settings/bookmarks';
import { BROWSER_SYNC_KEYS } from '../domain/settings/registry';
import type { StorageAreaLike } from '../domain/storage-port';
import { migrateLocalSettingsToSync } from './settings-storage';

function area(values: Record<string, unknown>): StorageAreaLike {
  return {
    get(keys, callback) {
      const names = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(values);
      callback?.(Object.fromEntries(names.filter((key) => Object.hasOwn(values, key)).map((key) => [key, values[key]])));
    },
    set(items, callback) { Object.assign(values, items); callback?.(); }
  };
}

describe('bookmark layout browser sync', () => {
  it('copies an existing local layout only if the sync area has none', () => {
    const key = bookmarkTopbarLayout.key;
    expect(BROWSER_SYNC_KEYS).toContain(key);
    const local = { [key]: 'floating' };
    const sync: Record<string, unknown> = {};
    migrateLocalSettingsToSync(area(local), area(sync), [key]);
    expect(sync[key]).toBe('floating');
    sync[key] = 'docked';
    migrateLocalSettingsToSync(area(local), area(sync), [key]);
    expect(sync[key]).toBe('docked');
  });
});
