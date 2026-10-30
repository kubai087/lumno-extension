import { describe, expect, it } from 'vitest';
import { getCachedIconDataUrl, setCachedIcon, SITE_SEARCH_CACHE_OPTIONS } from '../domain/favicon/shortcut-favicon/persisted';
import type { CachedIconMap } from '../domain/favicon/shortcut-favicon/types';
import { newtabShortcutFaviconCache } from '../domain/settings/newtab-shortcuts';
import { siteSearchIconCache } from '../domain/settings/search';
import type { StorageItems, StorageKeys } from '../domain/storage-port';
import { createShortcutFaviconStore, createSiteSearchIconStore } from './shortcut-favicon-store';

const NOW = 1_800_000_000_000;

function createArea(initial: StorageItems = {}) {
  const data: StorageItems = { ...initial };
  return {
    data,
    get(keys: StorageKeys, callback?: (items: StorageItems | undefined) => void) {
      const list = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(data);
      const result: StorageItems = {};
      list.forEach((key) => { result[key] = data[key]; });
      if (callback) callback(result);
    },
    set(values: StorageItems, callback?: () => void) {
      Object.assign(data, values);
      if (callback) callback();
    }
  };
}

// navigator.locks: tasks under one name run one after another.
function createLockManager() {
  const queues = new Map<string, Promise<unknown>>();
  return {
    request(name: string, task: () => Promise<CachedIconMap>): Promise<CachedIconMap> {
      const next = (queues.get(name) || Promise.resolve()).then(task);
      queues.set(name, next.catch(() => {}));
      return next;
    }
  };
}

describe('shortcut favicon store', () => {
  it('reads and writes the saved icons under the shortcut icon key', async () => {
    const cache = setCachedIcon({}, 'https://example.com/docs#section', 'data:image/png;base64,aGlnaC1yZXM=',
      'https://example.com/icon-192.png', NOW);
    const area = createArea({ [newtabShortcutFaviconCache.key]: cache });
    const store = createShortcutFaviconStore({ storageArea: area, chromeApi: { runtime: {} } });
    const loaded = await store.readAll();
    expect(getCachedIconDataUrl(loaded, 'https://example.com/docs', NOW)).toBe('data:image/png;base64,aGlnaC1yZXM=');
    await store.writeAll(loaded);
    expect(area.data[newtabShortcutFaviconCache.key]).toEqual(loaded);
  });

  it('merges concurrent updates from two pages and prunes under the same lock', async () => {
    const area = createArea();
    const lockManager = createLockManager();
    const first = createShortcutFaviconStore({ storageArea: area, chromeApi: { runtime: {} }, lockManager });
    const second = createShortcutFaviconStore({ storageArea: area, chromeApi: { runtime: {} }, lockManager });
    await Promise.all([
      first.mergeAll(setCachedIcon({}, 'https://first.example/', 'data:image/png;base64,Zmlyc3Q=', 'https://first.example/icon.png')),
      second.mergeAll(setCachedIcon({}, 'https://second.example/', 'data:image/png;base64,c2Vjb25k', 'https://second.example/icon.png'))
    ]);
    const merged = await first.readAll();
    expect(getCachedIconDataUrl(merged, 'https://first.example/')).toBe('data:image/png;base64,Zmlyc3Q=');
    expect(getCachedIconDataUrl(merged, 'https://second.example/')).toBe('data:image/png;base64,c2Vjb25k');

    await first.retainAll(['https://second.example/']);
    const retained = await second.readAll();
    expect(Object.keys(retained)).toHaveLength(1);
    expect(getCachedIconDataUrl(retained, 'https://second.example/')).toBe('data:image/png;base64,c2Vjb25k');
  });

  it('reads the site search provider icons with their own cache policy', async () => {
    let cache: CachedIconMap = {};
    for (let index = 0; index < 30; index += 1) {
      cache = setCachedIcon(cache, `https://provider-${index}.example/`, 'data:image/png;base64,aGlnaC1yZXM=',
        `https://provider-${index}.example/icon-192.png`, NOW - index, SITE_SEARCH_CACHE_OPTIONS);
    }
    const store = createSiteSearchIconStore({ storageArea: createArea({ [siteSearchIconCache.key]: cache }), chromeApi: { runtime: {} } });
    expect(Object.keys(await store.readAll())).toHaveLength(30);
  });
});
