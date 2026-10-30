// The wallpaper the preload paints from this device's IndexedDB, and how the
// runtime takes it over.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORAGE_KEYS,
  createRuntime,
  installBroadcastChannel,
  installMatchMedia,
  readPreloadCache,
  shownWallpaperImage
} from '../../../tests/fakes/wallpaper/runtime';
import { readField, resetOnlineMocks, settle, useLocalLibrary } from '../../../tests/fakes/wallpaper/online';
import { cacheWallpaperPreload, lightPreloadCache, runWallpaperPreload } from '../../../tests/fakes/wallpaper/preload';
import { installCanvasFake, installImageFake } from '../../../tests/fakes/canvas';
import { WALLPAPER_DATABASES, installIndexedDb } from '../../../tests/fakes/indexed-db';
import { createBrowserFake } from '../../../tests/fakes/browser';
import { required } from '../../../tests/fakes/dom';
import type { WallpaperRecord } from '../../shared/wallpaper-records';

vi.mock('../react/wallpaper-view', async () => ({
  createWallpaperViewController: (await import('../../../tests/fakes/wallpaper/view-recorder')).createRecordingWallpaperView
}));
vi.mock('../../shared/wallpaper-local-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/wallpaper-local-store')>();
  return { ...actual, createWallpaperLocalStore: vi.fn(actual.createWallpaperLocalStore) };
});

beforeEach(() => {
  resetOnlineMocks();
  installMatchMedia();
  installBroadcastChannel();
  installImageFake();
  installCanvasFake();
  vi.stubGlobal('chrome', createBrowserFake());
});

afterEach(async () => {
  await settle();
});

// The page's blob URLs, as the preload and the runtime make them.
function recordObjectUrls() {
  const created: Blob[] = [];
  const revoked: string[] = [];
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    if (blob instanceof Blob) created.push(blob);
    return `blob:chrome-extension://lumno/wallpaper-${created.length}`;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
    revoked.push(url);
  });
  return { created, revoked };
}

function seedImageCache(records: Array<Record<string, unknown>>) {
  const { name, store, keyPath } = WALLPAPER_DATABASES.images;
  return installIndexedDb({ [name]: { [store]: { keyPath, records } } });
}

function seedLibrary(records: Array<Record<string, unknown>>) {
  const { name, store, keyPath } = WALLPAPER_DATABASES.uploads;
  return installIndexedDb({ [name]: { [store]: { keyPath, records } } });
}

describe('the preload\'s copy of an online photo', () => {
  const photoUrl = 'https://www.bing.com/th?id=OHR.River_ZH-CN123_1920x1080.jpg&pid=hp';
  const dataUrl = 'data:image/webp;base64,cml2ZXI=';
  const entry = { id: 'bing-daily', cachedImage: { id: 'bing-20261002-OHR.River_ZH-CN123', url: photoUrl } };
  const record = { id: entry.cachedImage.id, url: photoUrl, imageDataUrl: dataUrl };

  it('paints while the page is still loading, once IndexedDB has read it', async () => {
    const indexedDb = seedImageCache([record]);
    cacheWallpaperPreload(lightPreloadCache(entry));
    const preload = required(await runWallpaperPreload(), 'the preload state');
    // IndexedDB is asynchronous, so nothing paints before the copy is read.
    expect(shownWallpaperImage()).toBe('');
    expect(await preload.imageReady).toBe(dataUrl);
    expect(shownWallpaperImage()).toContain(dataUrl);
    expect(document.documentElement.getAttribute('data-wallpaper-active')).toBe('true');
    expect(indexedDb.calls.open).toEqual([['lumno-newtab-wallpaper-cache', 1]]);
    // The runtime reuses the copy instead of reading it again.
    expect(preload.cachedImageRecord).toEqual(record);
  });

  it('never paints a copy of another image', async () => {
    seedImageCache([{ ...record, url: 'https://www.bing.com/th?id=OHR.Other' }]);
    cacheWallpaperPreload(lightPreloadCache(entry));
    const preload = required(await runWallpaperPreload(), 'the preload state');
    expect(await preload.imageReady).toBe('');
    expect(shownWallpaperImage()).toBe('');
  });

  it('leaves the runtime\'s choice when the copy is read after the runtime painted', async () => {
    seedImageCache([record]);
    cacheWallpaperPreload(lightPreloadCache(entry));
    const preload = required(await runWallpaperPreload(), 'the preload state');
    preload.runtimeApplied = true;
    expect(await preload.imageReady).toBe('');
    expect(shownWallpaperImage()).toBe('');
  });
});

describe('the preload\'s upload from the local library', () => {
  const id = 'custom-wallpaper-1760000000000';
  const dataUrl = 'data:image/webp;base64,dXBsb2Fk';
  const record = { key: id, id, imageDataUrl: dataUrl, thumbnailDataUrl: dataUrl, updatedAt: 1 };
  const entry = { id, customImage: { id } };

  it('paints at full resolution once read, and decodes it for the first tone sample', async () => {
    const indexedDb = seedLibrary([record]);
    cacheWallpaperPreload(lightPreloadCache(entry));
    const preload = required(await runWallpaperPreload(), 'the preload state');
    expect(preload.customImageId).toBe(id);
    // The effects render the upload the preload paints.
    expect(preload.wallpaper?.id).toBe(id);
    expect(shownWallpaperImage()).toBe('');
    expect(await preload.imageReady).toBe(dataUrl);
    expect(indexedDb.calls.open).toEqual([['lumno-newtab-wallpaper', 1]]);
    expect(shownWallpaperImage()).toBe(`url("${dataUrl}")`);
    expect(document.documentElement.getAttribute('data-wallpaper-active')).toBe('true');
    expect(preload.cachedImageRecord).toEqual(record);
    expect(preload.imageUrl).toBe(dataUrl);
    const decoded = required(preload.decodedImage, 'the decoded image');
    expect(decoded.url).toBe(dataUrl);
    expect((await decoded.ready)?.src).toBe(dataUrl);
  });

  it('reads an upload stored under the legacy key by that key', async () => {
    seedLibrary([{ key: 'custom', imageDataUrl: dataUrl, thumbnailDataUrl: dataUrl }]);
    cacheWallpaperPreload(lightPreloadCache({
      id: 'custom-wallpaper-legacy',
      customImage: { id: 'custom-wallpaper-legacy', key: 'custom' }
    }));
    const preload = required(await runWallpaperPreload(), 'the preload state');
    expect(await preload.imageReady).toBe(dataUrl);
  });

  it('paints nothing for a removed upload, or once the runtime painted', async () => {
    seedLibrary([]);
    cacheWallpaperPreload(lightPreloadCache(entry));
    const removed = required(await runWallpaperPreload(), 'the preload state');
    expect(await removed.imageReady).toBe('');
    expect(shownWallpaperImage()).toBe('');

    seedLibrary([record]);
    const late = required(await runWallpaperPreload(), 'the preload state');
    late.runtimeApplied = true;
    expect(await late.imageReady).toBe('');
    expect(shownWallpaperImage()).toBe('');
  });

  it('reads only upload ids from the library', async () => {
    seedLibrary([record]);
    cacheWallpaperPreload(lightPreloadCache({ id: 'dark-shanshui-moonlit', customImage: { id: 'dark-shanshui-moonlit' } }));
    expect(await runWallpaperPreload()).toBeUndefined();
  });

  it('keeps a short data URL inline for CSS', async () => {
    const objectUrls = recordObjectUrls();
    const shortId = 'custom-wallpaper-short';
    const shortUrl = 'data:image/webp;base64,c2hvcnQ=';
    seedLibrary([{ key: shortId, id: shortId, imageDataUrl: shortUrl }]);
    cacheWallpaperPreload(lightPreloadCache({ id: shortId, customImage: { id: shortId } }));
    const preload = required(await runWallpaperPreload(), 'the preload state');
    expect(await preload.imageReady).toBe(shortUrl);
    expect(shownWallpaperImage()).toBe(`url("${shortUrl}")`);
    expect(preload.cssObjectUrl).toBeNull();
    expect(objectUrls.created).toHaveLength(0);
  });
});

describe('the runtime after the preload painted an upload', () => {
  it('adopts the preloaded record and its blob URL', async () => {
    const id = 'custom-wallpaper-1760000000001';
    // Past the inline limit: every style recalculation re-reads
    // --x-nt-wallpaper-image, so long data URLs reach CSS as blob URLs.
    const dataUrl = `data:image/webp;base64,${'A'.repeat(40 * 1024)}`;
    const thumbnailDataUrl = 'data:image/webp;base64,dGh1bWI=';
    const objectUrls = recordObjectUrls();
    seedLibrary([{ key: id, id, imageDataUrl: dataUrl, thumbnailDataUrl, updatedAt: 1 }]);
    cacheWallpaperPreload(lightPreloadCache({ id, customImage: { id } }));
    const preload = required(await runWallpaperPreload(), 'the preload state');
    expect(await preload.imageReady).toBe(dataUrl);
    expect(shownWallpaperImage()).toBe('url("blob:chrome-extension://lumno/wallpaper-1")');
    expect(preload.cssObjectUrl).toEqual({ source: dataUrl, url: 'blob:chrome-extension://lumno/wallpaper-1' });
    expect(objectUrls.created[0].size).toBe(30 * 1024);
    // Effects and samples keep the data URL the runtime uses.
    expect(preload.imageUrl).toBe(dataUrl);

    const reads: unknown[][] = [];
    const library: WallpaperRecord = {
      id, key: id, name: '', imageDataUrl: dataUrl, thumbnailDataUrl, sampleDataUrl: '', width: 0, height: 0, updatedAt: 1
    };
    useLocalLibrary({ records: [library], reads });
    const { runtime } = await createRuntime({
      sync: { [STORAGE_KEYS.wallpaper]: 'custom-upload' },
      local: { [STORAGE_KEYS.localWallpaper]: id }
    });
    await runtime.bootstrapInitialWallpaper();
    expect(reads).toEqual([]);
    // The background never swaps to an undecoded copy.
    expect(shownWallpaperImage()).toBe('url("blob:chrome-extension://lumno/wallpaper-1")');
    expect(objectUrls.created).toHaveLength(1);
    expect(objectUrls.revoked).toEqual([]);
    // The handed-over URL is the runtime's to release now.
    expect(preload.cssObjectUrl).toBeNull();
    expect(readField(readPreloadCache(), 'wallpapers', 'light', 'customImage')).toEqual({ id });
    await runtime.waitForInitialWallpaperTone();
  });
});
