import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../domain/favicon/favicon-cache';
import { getFaviconPersistCacheKey } from '../domain/favicon/canonical';
import { normalizeFaviconHost } from '../domain/favicon/url-kinds';
import type { StorageItems, StorageKeys } from '../domain/storage-port';
import { createFaviconCache } from './favicon-cache';

// A storage area over `values` that answers at once.
function createArea(values: StorageItems) {
  return {
    get(keys: StorageKeys, callback?: (items: StorageItems | undefined) => void) {
      const list = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(values);
      const result: StorageItems = {};
      list.forEach((key) => { result[key] = values[key]; });
      if (callback) callback(result);
    },
    set(payload: StorageItems, callback?: () => void) {
      Object.assign(values, payload);
      if (callback) callback();
    }
  };
}

describe('favicon cache', () => {
  it('reads an old theme entry as neutral and stores a brand color over it', async () => {
    const now = Date.now();
    const values: StorageItems = {
      [DEFAULTS.siteThemePersistStorageKey]: {
        version: 1,
        entries: { 'dribbble.com': { accentRgb: [255, 255, 255], source: 'meta', updatedAt: now } },
        updatedAt: now
      }
    };
    const cache = createFaviconCache({
      storageArea: createArea(values),
      windowObj: { setTimeout(callback: () => void) { callback(); return 0; } },
      normalizeFaviconHost
    });

    await cache.ensureCachesReady();
    expect(cache.getPersistedThemeEntry('www.dribbble.com')).toMatchObject({ source: 'meta', confidence: 'neutral', neutral: true });
    expect(cache.setPersistedThemeEntry('dribbble.com', { accentRgb: [234, 100, 217], source: 'mask-icon', confidence: 'color', neutral: false }))
      .toBe(true);
    expect(cache.getPersistedThemeEntry('dribbble.com')).toMatchObject({ source: 'mask-icon', confidence: 'color', neutral: false });
  });

  // Page icons cached under the old host-fallback policy (versions 1 and 2)
  // could belong to another page on the host, so they are acquired again.
  it.each([1, 2, 3])('keeps page icons from version %i only when that version matched exact pages', async (version) => {
    const pageKey = getFaviconPersistCacheKey('https://developer.chrome.com/docs/extensions/?view=read#intro');
    const urlKey = DEFAULTS.faviconPersistStorageKey;
    const dataKey = DEFAULTS.faviconDataPersistStorageKey;
    const sharedBytes = 'data:image/png;base64,c2hhcmVk';
    const values: StorageItems = {
      [urlKey]: { version, entries: { [pageKey]: { url: 'https://t2.gstatic.cn/faviconV2', updatedAt: Date.now() } } },
      [dataKey]: { version, entries: {
        [pageKey]: { dataUrl: sharedBytes, updatedAt: Date.now() },
        settings: { dataUrl: sharedBytes, updatedAt: Date.now() }
      } }
    };
    const writes: Array<() => void> = [];
    const cache = createFaviconCache({
      storageArea: createArea(values),
      windowObj: { setTimeout(callback: () => void) { writes.push(callback); return writes.length; } }
    });

    await cache.ensureCachesReady();
    expect(Boolean(cache.getPersistedDataEntry(pageKey))).toBe(version === 3);
    expect(Boolean(cache.getPersistedEntry(pageKey))).toBe(version === 3);
    expect(cache.getPersistedDataEntry('settings')).toMatchObject({ dataUrl: sharedBytes });

    cache.setPersistedData(pageKey, sharedBytes);
    cache.setPersistedUrl(pageKey, 'https://t2.gstatic.cn/faviconV2');
    writes.forEach((write) => write());
    expect(values[dataKey]).toMatchObject({ version: 3 });
    expect(values[urlKey]).toMatchObject({ version: 3 });
  });
});
