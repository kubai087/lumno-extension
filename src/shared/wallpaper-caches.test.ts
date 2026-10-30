import { describe, expect, it } from 'vitest';
import { createWallpaperThumbnailCache } from './wallpaper-caches';
import { WALLPAPER_DATABASES, installIndexedDb } from '../../tests/fakes/indexed-db';

const tile = (id: string) => ({ id, url: `https://picsum.photos/id/${id}/320/180`, dataUrl: `data:image/webp;base64,${id}` });

describe('the thumbnail cache', () => {
  it('keeps the tiles seen most recently, up to its limit', async () => {
    const indexedDb = installIndexedDb();
    const records = () => indexedDb.records(WALLPAPER_DATABASES.thumbnails.name, WALLPAPER_DATABASES.thumbnails.store);
    let time = 1000;
    const cache = createWallpaperThumbnailCache({ limit: 2, now: () => time });
    await cache.write(tile('a'));
    time += 1;
    await cache.write(tile('b'));

    const read = await cache.readByIds(['a', 'missing']);
    expect(read.map((record) => (typeof record === 'object' && record !== null && 'dataUrl' in record ? record.dataUrl : null)))
      .toEqual(['data:image/webp;base64,a']);
    // A tile read again within the hour is not rewritten.
    expect(records().get('a')?.usedAt).toBe(1000);

    time += 2 * 60 * 60 * 1000;
    await cache.readByIds(['a']);
    expect(records().get('a')?.usedAt).toBe(time);
    time += 1;
    await cache.write(tile('c'));
    expect(Array.from(records().keys()).sort()).toEqual(['a', 'c']);
  });

  it('refuses to read without IndexedDB', async () => {
    await expect(createWallpaperThumbnailCache({ windowObj: {} }).readByIds(['a'])).rejects.toThrow(/IndexedDB is not available/);
  });
});
