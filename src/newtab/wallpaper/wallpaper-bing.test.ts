import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as REMOTE_CONTENT from '../remote-content';
import type { RemoteContentClient } from '../remote-content';
import type { RemoteWallpaper } from '../remote-content-types';
import {
  DEFAULT_WALLPAPER_ID,
  STORAGE_KEYS,
  clickTile,
  clonePlain,
  createRuntime,
  findTile,
  installBroadcastChannel,
  installMatchMedia,
  openPanel,
  panelActions,
  panelState,
  shownWallpaperImage
} from '../../../tests/fakes/wallpaper/runtime';
import {
  LINK_IMAGE_DATA_URL,
  createNetwork,
  readField,
  readPickedWallpaper,
  resetOnlineMocks,
  settle,
  useImageCache,
  useLocalLibrary
} from '../../../tests/fakes/wallpaper/online';
import { installCanvasFake, installImageFake } from '../../../tests/fakes/canvas';
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

const actualRemote = await vi.importActual<typeof import('../remote-content')>('../remote-content');

const BING_ID = 'bing-20261002-OHR.River_ZH-CN123';

beforeEach(() => {
  resetOnlineMocks();
  installMatchMedia();
  installBroadcastChannel();
  installImageFake();
  installCanvasFake();
  vi.stubGlobal('fetch', vi.fn(async () => {
    throw new Error('offline');
  }));
});

afterEach(async () => {
  await settle();
});

// The remote client, with `overrides` in place of its network-bound parts.
function useRemoteClient(overrides: Partial<RemoteContentClient>): void {
  vi.mocked(REMOTE_CONTENT.createClient).mockImplementation((options) => ({
    ...actualRemote.createClient(options),
    ...overrides
  }));
}

function bingPhoto(): RemoteWallpaper {
  return required(REMOTE_CONTENT.wallpaperFromId(BING_ID), 'the Bing photo');
}

describe('Bing photos', () => {
  it('list by place and date, follow the daily photo, and fix it when daily is off', async () => {
    const photo = {
      ...bingPhoto(),
      name: 'River',
      copyright: 'River bank (© Photographer)',
      imageDataUrl: 'data:image/webp;base64,aGVsbG8=',
      thumbnailDataUrl: 'data:image/webp;base64,dGh1bWI='
    };
    const getWallpaper = (selected: string): RemoteWallpaper =>
      (selected === REMOTE_CONTENT.BING_DAILY_ID ? { ...photo, id: selected, dailyId: BING_ID } : photo);
    useRemoteClient({
      getCatalog: async () => [photo],
      setPinnedIds() {},
      getWallpaper,
      restoreWallpaper: async () => photo,
      ensureWallpaper: async (selected) => getWallpaper(selected)
    });
    const { runtime, browser } = await createRuntime({
      sync: { [STORAGE_KEYS.wallpaper]: { version: 2, sameForModes: false, light: DEFAULT_WALLPAPER_ID, dark: 'dark-linocut-topographic' } }
    });
    await runtime.bootstrapInitialWallpaper();
    runtime.createControls();
    openPanel(runtime);
    panelActions(runtime).selectSourceTab('bing');
    await settle();
    const bing = () => panelState(runtime).wallpaper.bing;
    const picked = () => readPickedWallpaper(browser);
    expect(bing().tiles.map((tile) => tile.id)).toEqual([BING_ID]);
    expect(bing().tiles[0].tooltip).toBe('River · 2026-10-02');

    panelActions(runtime).setBingDaily(true);
    await settle();
    // The daily intent is saved, not a fixed photo; the shared key keeps a
    // built-in stand-in older versions accept, and the dark mode keeps its own.
    expect(readField(picked(), 'light')).toBe('bing-daily');
    expect(readField(browser.storage.sync.values[STORAGE_KEYS.wallpaper], 'light')).toBe(DEFAULT_WALLPAPER_ID);
    expect(readField(picked(), 'dark')).toBe('dark-linocut-topographic');
    expect(bing().daily.toggle.checked).toBe(true);
    expect(bing().selected.meta).toBe('River bank · © Photographer');
    expect(bing().selected.title).toBe('River');
    expect(bing().selected.visible).toBe(true);
    expect(findTile(runtime, BING_ID)?.selected).toBe(true);

    panelActions(runtime).setBingDaily(false);
    await settle();
    expect(readField(picked(), 'light')).toBe(BING_ID);
    expect(bing().daily.toggle.checked).toBe(false);
    clickTile(runtime, BING_ID);
    await settle();
    expect(readField(picked(), 'light')).toBe(BING_ID);
  });

  it('never let a finished download override a newer manual choice', async () => {
    const photo = { ...bingPhoto(), name: 'River', copyright: 'River bank (© Photographer)' };
    let completeDownload = () => {};
    let waitForDownload: Promise<void> | null = null;
    const getWallpaper = (selected: string): RemoteWallpaper =>
      (selected === REMOTE_CONTENT.BING_DAILY_ID ? { ...photo, id: selected, dailyId: BING_ID } : photo);
    useRemoteClient({
      getCatalog: async () => [photo],
      setPinnedIds() {},
      getWallpaper,
      restoreWallpaper: async () => photo,
      ensureWallpaper: async (selected) => {
        if (waitForDownload) await waitForDownload;
        return getWallpaper(selected);
      }
    });
    const { runtime, browser } = await createRuntime({
      sync: { [STORAGE_KEYS.wallpaper]: { version: 2, sameForModes: false, light: DEFAULT_WALLPAPER_ID, dark: 'dark-linocut-topographic' } }
    });
    await runtime.bootstrapInitialWallpaper();
    runtime.createControls();
    openPanel(runtime);
    panelActions(runtime).selectSourceTab('bing');
    await settle();
    clickTile(runtime, BING_ID);
    await settle();
    const bing = () => panelState(runtime).wallpaper.bing;

    waitForDownload = new Promise((resolve) => {
      completeDownload = resolve;
    });
    panelActions(runtime).setBingDaily(true);
    expect(bing().daily.busy).toBe(true);
    expect(bing().refresh.disabled).toBe(true);
    clickTile(runtime, 'dark-monet-lily-nocturne');
    completeDownload();
    await settle();
    expect(readField(readPickedWallpaper(browser), 'light')).toBe('dark-monet-lily-nocturne');
    expect(bing().daily.toggle.checked).toBe(false);
    expect(bing().daily.busy).toBe(false);
  });

  it('take over a pick of the removed online provider and keep it updating daily', async () => {
    const photo = { ...bingPhoto(), id: REMOTE_CONTENT.BING_DAILY_ID };
    const ensured: string[] = [];
    useRemoteClient({
      getWallpaper: () => photo,
      restoreWallpaper: async () => photo,
      ensureWallpaper: async (id) => {
        ensured.push(id);
        return photo;
      },
      setPinnedIds() {}
    });
    const { runtime, browser } = await createRuntime({ sync: { [STORAGE_KEYS.wallpaper]: 'wallhaven-abc123' } });
    await runtime.bootstrapInitialWallpaper();
    await settle();
    expect(readPickedWallpaper(browser)).toBe('bing-daily');
    expect(browser.storage.sync.values[STORAGE_KEYS.wallpaper]).toBe(DEFAULT_WALLPAPER_ID);
    expect(ensured).toContain('bing-daily');
  });
});

describe('an online pick next to older versions', () => {
  it('moves out of the shared key, and yields to what an older version saves there', async () => {
    const photo = { ...bingPhoto(), id: REMOTE_CONTENT.BING_DAILY_ID };
    useRemoteClient({
      getWallpaper: () => photo,
      restoreWallpaper: async () => photo,
      ensureWallpaper: async () => photo,
      setPinnedIds() {}
    });
    let sync: Record<string, unknown> = { [STORAGE_KEYS.wallpaper]: 'bing-daily' };
    // Each boot is another tab over the same synced values.
    const boot = async () => {
      document.documentElement.removeAttribute('style');
      const { runtime, browser } = await createRuntime({ sync });
      await runtime.bootstrapInitialWallpaper();
      await settle();
      sync = { ...browser.storage.sync.values };
      return browser;
    };
    await boot();
    expect(sync[STORAGE_KEYS.wallpaper]).toBe(DEFAULT_WALLPAPER_ID);
    expect(clonePlain(sync[STORAGE_KEYS.onlineWallpaper])).toEqual({ value: 'bing-daily', shared: DEFAULT_WALLPAPER_ID });
    const again = await boot();
    expect(readPickedWallpaper(again)).toBe('bing-daily');

    sync[STORAGE_KEYS.wallpaper] = '';
    await boot();
    expect(document.body.getAttribute('data-wallpaper-active')).toBe('false');

    sync[STORAGE_KEYS.wallpaper] = 'dark-linocut-topographic';
    await boot();
    expect(shownWallpaperImage()).toContain('linocut-topographic');
    expect(sync[STORAGE_KEYS.wallpaper]).toBe('dark-linocut-topographic');
  });
});

describe('a Bing photo on this device', () => {
  it('downloads once and opens new tabs from the cached copy', async () => {
    const photo = bingPhoto();
    expect(photo.cacheImage).toBe(true);
    const images = useImageCache();
    useLocalLibrary();
    const network = createNetwork();
    const sync = {
      [STORAGE_KEYS.wallpaper]: DEFAULT_WALLPAPER_ID,
      [STORAGE_KEYS.onlineWallpaper]: { value: BING_ID, shared: DEFAULT_WALLPAPER_ID }
    };
    const first = await createRuntime({ sync, fetchRemoteContent: network.fetchRemoteContent });
    await first.runtime.bootstrapInitialWallpaper();
    await vi.waitFor(() => expect(images.has(BING_ID)).toBe(true));
    expect(network.urls()).toEqual([photo.imageUrl]);

    document.documentElement.removeAttribute('style');
    const nextTab = await createRuntime({ browser: createBrowserFake({ sync }), fetchRemoteContent: network.fetchRemoteContent });
    await nextTab.runtime.bootstrapInitialWallpaper();
    expect(shownWallpaperImage()).toContain(LINK_IMAGE_DATA_URL);
    await settle();
    expect(network.urls()).toEqual([photo.imageUrl]);
  });
});
