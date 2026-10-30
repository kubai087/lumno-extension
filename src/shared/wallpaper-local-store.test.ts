import { describe, expect, it } from 'vitest';
import { createWallpaperLocalStore } from './wallpaper-local-store';
import { WALLPAPER_DATABASES, installIndexedDb } from '../../tests/fakes/indexed-db';

describe('the local wallpaper store', () => {
  it('reads only the uploads asked for, by key, the legacy one included', async () => {
    const selectedId = 'custom-wallpaper-selected';
    const { name, store, keyPath } = WALLPAPER_DATABASES.uploads;
    const indexedDb = installIndexedDb({
      [name]: {
        [store]: {
          keyPath,
          records: [{
            id: selectedId,
            key: selectedId,
            imageDataUrl: 'data:image/webp;base64,selected',
            thumbnailDataUrl: 'data:image/webp;base64,selected-thumb',
            sampleDataUrl: 'data:image/webp;base64,selected-sample',
            updatedAt: 2
          }, {
            id: 'custom-upload',
            key: 'custom',
            imageDataUrl: 'data:image/webp;base64,legacy',
            thumbnailDataUrl: 'data:image/webp;base64,legacy-thumb',
            updatedAt: 1
          }, {
            id: 'custom-wallpaper-unselected',
            key: 'custom-wallpaper-unselected',
            imageDataUrl: 'data:image/webp;base64,unselected',
            thumbnailDataUrl: 'data:image/webp;base64,unselected-thumb',
            updatedAt: 3
          }]
        }
      }
    });

    const records = await createWallpaperLocalStore().readByIds([selectedId, 'custom-wallpaper-legacy', 'built-in-wallpaper']);

    expect(records.map((record) => record.id)).toEqual(['custom-wallpaper-legacy', selectedId]);
    expect(indexedDb.calls.get).toEqual([selectedId, 'custom-wallpaper-legacy', 'custom']);
    expect(indexedDb.calls.getAll).toBe(0);
    // Records keep their small copy, and older records read without one.
    expect(records.map((record) => record.sampleDataUrl)).toEqual(['', 'data:image/webp;base64,selected-sample']);
  });
});
