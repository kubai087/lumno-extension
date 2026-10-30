// Daily wallpapers over days: an open tab rolling over, tomorrow's photo
// cached ahead, a stand-in kept until the new copy is cached, and network
// photos that wait for the page.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as REMOTE_CONTENT from '../remote-content';
import type { RemoteWallpaper } from '../remote-content-types';
import {
  DEFAULT_WALLPAPER_ID,
  STORAGE_KEYS,
  WALLPAPER_PRELOAD_STORAGE_VERSION,
  createRuntime,
  installBroadcastChannel,
  installMatchMedia,
  openPanel,
  panelActions,
  panelState,
  readPreloadCache,
  shownWallpaperImage
} from '../../../tests/fakes/wallpaper/runtime';
import {
  buildCopyFromFile,
  copyDataUrl,
  copyRecord,
  createNetwork,
  readField,
  resetOnlineMocks,
  settle,
  useImageCache,
  useLocalLibrary
} from '../../../tests/fakes/wallpaper/online';
import { WALLPAPER_PRELOAD_STORAGE_KEY, runWallpaperPreload } from '../../../tests/fakes/wallpaper/preload';
import { installCanvasFake, installImageFake } from '../../../tests/fakes/canvas';
import { WALLPAPER_DATABASES, installIndexedDb } from '../../../tests/fakes/indexed-db';
import { createBrowserFake } from '../../../tests/fakes/browser';
import { required } from '../../../tests/fakes/dom';

vi.mock('../react/wallpaper-view', async () => ({
  createWallpaperViewController: (await import('../../../tests/fakes/wallpaper/view-recorder')).createRecordingWallpaperView
}));
vi.mock('../remote-content', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../remote-content')>();
  return { ...actual, createClient: vi.fn(actual.createClient) };
});
vi.mock('../../shared/wallpaper-caches', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/wallpaper-caches')>();
  return {
    ...actual,
    createWallpaperImageCache: vi.fn(actual.createWallpaperImageCache),
    createWallpaperThumbnailCache: vi.fn(actual.createWallpaperThumbnailCache)
  };
});
vi.mock('../../shared/wallpaper-local-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/wallpaper-local-store')>();
  return { ...actual, createWallpaperLocalStore: vi.fn(actual.createWallpaperLocalStore) };
});

const DAY = 24 * 60 * 60 * 1000;
const start = new Date();
const todayAt = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 15).getTime();
const at = (days: number) => todayAt + days * DAY;

beforeEach(() => {
  resetOnlineMocks();
  installMatchMedia();
  installBroadcastChannel();
  installCanvasFake();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(at(0));
  vi.stubGlobal('fetch', vi.fn(async () => {
    throw new Error('offline');
  }));
  // The page caches tomorrow's photo once it idles.
  vi.stubGlobal('requestIdleCallback', (callback: () => void) => setTimeout(callback, 0));
});

afterEach(async () => {
  await settle();
  vi.useRealTimers();
});

function dailyPhoto(category: string, time: number): RemoteWallpaper {
  return required(REMOTE_CONTENT.getCuratedDailyWallpaper(category, time), `the ${category} photo`);
}

function dailySync(dailyId: string): Record<string, unknown> {
  return {
    [STORAGE_KEYS.wallpaper]: DEFAULT_WALLPAPER_ID,
    [STORAGE_KEYS.onlineWallpaper]: { value: dailyId, shared: DEFAULT_WALLPAPER_ID }
  };
}

describe('a network photo without a cached copy', () => {
  // First in the file: it tells the page it has loaded, and every runtime of
  // an earlier test waiting for that would hear it too.
  it('waits for the page to load, and falls back to the bundled default offline', async () => {
    const photo = REMOTE_CONTENT.getCuratedWallpapers('nature')[0];
    const images = installImageFake({ outcome: (src) => (/^https?:/i.test(src) ? 'error' : 'load') });
    const readyState = vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    const { runtime } = await createRuntime({
      sync: { [STORAGE_KEYS.wallpaper]: DEFAULT_WALLPAPER_ID, [STORAGE_KEYS.onlineWallpaper]: { value: photo.id, shared: DEFAULT_WALLPAPER_ID } },
      fetchRemoteContent: async () => {
        throw new Error('offline');
      }
    });
    await runtime.bootstrapInitialWallpaper();
    await settle();
    expect(shownWallpaperImage()).toBe('none');
    // Network images wait for the page, so the tab stops loading.
    expect(images.sources().some((url) => /^https?:/.test(url))).toBe(false);

    readyState.mockReturnValue('complete');
    window.dispatchEvent(new Event('load'));
    await vi.waitFor(() => expect(shownWallpaperImage()).toContain('lumno-newtab-monet-coastal-white.webp'));
    expect(images.sources()).toContain(photo.thumbnailUrl);
    // The next tab does not start on a network image either.
    expect(readField(readPreloadCache(), 'wallpapers', 'light')).toBeNull();
  });
});

describe('an open tab', () => {
  // Before the copies below: it tells the page it is shown again, and every
  // runtime of an earlier test would hear that too.
  it('rolls over to the new daily photo past midnight without opening the panel', async () => {
    installImageFake();
    const { runtime } = await createRuntime({ sync: dailySync('curated-daily-nature') });
    runtime.createControls();
    await runtime.bootstrapInitialWallpaper();
    await settle();
    const today = dailyPhoto('nature', Date.now());
    expect(shownWallpaperImage()).toContain(today.thumbnailUrl);

    vi.setSystemTime(at(1));
    const tomorrow = dailyPhoto('nature', Date.now());
    expect(tomorrow.id).not.toBe(today.id);
    window.dispatchEvent(new Event('focus'));
    await settle();
    expect(shownWallpaperImage()).toContain(tomorrow.thumbnailUrl);
  });
});

describe('a daily curated photo on this device', () => {
  it('caches tomorrow\'s photo ahead, which the first tab after midnight paints from', async () => {
    installImageFake();
    const [today, tomorrow, dayAfter] = [0, 1, 2].map((days) => dailyPhoto('nature', at(days)));
    const images = useImageCache();
    useLocalLibrary({ buildRecord: buildCopyFromFile });
    const network = createNetwork((url) => url);
    const first = await createRuntime({ sync: dailySync('curated-daily-nature'), fetchRemoteContent: network.fetchRemoteContent });
    await first.runtime.bootstrapInitialWallpaper();
    // Once today's photo is cached, the idle page downloads tomorrow's.
    await vi.waitFor(() => expect(network.urls()).toEqual([today.imageUrl, tomorrow.imageUrl]));
    await vi.waitFor(() => expect(Array.from(images.keys()).sort()).toEqual([today.id, tomorrow.id].sort()));
    await settle();
    const stored = required(localStorage.getItem(WALLPAPER_PRELOAD_STORAGE_KEY), 'the preload cache');
    const entry = readField(readPreloadCache(), 'wallpapers', 'light');
    expect(readField(entry, 'cachedImage')).toEqual({ id: today.id, url: today.imageUrl });
    expect(readField(entry, 'next')).toEqual({
      day: REMOTE_CONTENT.localDay(at(1)),
      cachedImage: { id: tomorrow.id, url: tomorrow.imageUrl }
    });

    first.runtime.createControls();
    openPanel(first.runtime);
    panelActions(first.runtime).selectSourceTab('curated');
    panelActions(first.runtime).selectCuratedCategory('nature');
    const todayTile = panelState(first.runtime).wallpaper.curated.tiles.find((tile) => tile.id === today.id);
    // The panel shows a cached photo from its local thumbnail, not the network.
    expect(todayTile?.thumbnailUrl).toBe(`${copyDataUrl(String(today.imageUrl))}#thumb`);

    // After midnight the first frame paints tomorrow's copy.
    vi.setSystemTime(at(1));
    const { name, store, keyPath } = WALLPAPER_DATABASES.images;
    installIndexedDb({ [name]: { [store]: { keyPath, records: Array.from(images.values()) } } });
    const preload = required(await runWallpaperPreload(), 'the preload state');
    expect(await preload.imageReady).toBe(copyDataUrl(String(tomorrow.imageUrl)));
    // Today's luminance does not carry over to tomorrow's photo.
    expect(preload.luminance).toBeNull();

    vi.stubGlobal('indexedDB', undefined);
    Reflect.deleteProperty(globalThis, '__lumnoBoot');
    localStorage.setItem(WALLPAPER_PRELOAD_STORAGE_KEY, stored);
    document.documentElement.removeAttribute('style');
    const next = await createRuntime({
      browser: createBrowserFake({ sync: dailySync('curated-daily-nature') }),
      fetchRemoteContent: network.fetchRemoteContent
    });
    await next.runtime.bootstrapInitialWallpaper();
    expect(shownWallpaperImage()).toContain(copyDataUrl(String(tomorrow.imageUrl)));
    // Tomorrow's photo never downloads again; the day after's is fetched ahead.
    await vi.waitFor(() => expect(network.urls().slice(2)).toEqual([dayAfter.imageUrl]));
    // Yesterday's copy is dropped, so copies do not pile up.
    await vi.waitFor(() => expect(Array.from(images.keys()).sort()).toEqual([tomorrow.id, dayAfter.id].sort()));
  });

  it('keeps the copy the first frame painted until the new day\'s copy is cached', async () => {
    installImageFake();
    vi.setSystemTime(at(3));
    const friday = dailyPhoto('city', at(0));
    const saturday = dailyPhoto('city', at(1));
    const monday = dailyPhoto('city', at(3));
    // Away since Friday: the page remembers Friday's copy, and the copy fetched ahead was for Saturday.
    const images = useImageCache([copyRecord(friday), copyRecord(saturday)]);
    useLocalLibrary({ buildRecord: buildCopyFromFile });
    const network = createNetwork((url) => url);
    network.hold(String(monday.imageUrl));
    localStorage.setItem(WALLPAPER_PRELOAD_STORAGE_KEY, JSON.stringify({
      version: WALLPAPER_PRELOAD_STORAGE_VERSION,
      mode: 'light',
      themeMode: 'light',
      overlayStops: { light: { top: 0, mid: 0, bottom: 0 }, dark: { top: 0, mid: 0, bottom: 0 } },
      wallpapers: {
        light: {
          id: 'curated-daily-city',
          cachedImage: { id: friday.id, url: friday.imageUrl },
          next: { day: REMOTE_CONTENT.localDay(at(1)), cachedImage: { id: saturday.id, url: saturday.imageUrl } }
        },
        dark: null
      }
    }));
    const { runtime } = await createRuntime({ sync: dailySync('curated-daily-city'), fetchRemoteContent: network.fetchRemoteContent });
    await runtime.bootstrapInitialWallpaper();
    await vi.waitFor(() => expect(network.urls()).toEqual([monday.imageUrl]));
    await settle();
    expect(shownWallpaperImage()).toContain(copyDataUrl(String(friday.imageUrl)));
    // The page never waits on a network thumbnail.
    expect(shownWallpaperImage()).not.toContain(monday.thumbnailUrl);
    // The copy on screen is not pruned while it stands in.
    expect(images.has(friday.id)).toBe(true);

    network.release(String(monday.imageUrl));
    await vi.waitFor(() => expect(shownWallpaperImage()).toContain(copyDataUrl(String(monday.imageUrl))));
    await vi.waitFor(() => expect(images.has(friday.id)).toBe(false));
  });
});
