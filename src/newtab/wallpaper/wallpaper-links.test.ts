import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_WALLPAPER_ID,
  STORAGE_KEYS,
  clonePlain,
  createRuntime,
  findTile,
  installBroadcastChannel,
  installMatchMedia,
  openPanel,
  panelActions,
  panelOf,
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

describe('a linked wallpaper', () => {
  async function setup() {
    const images = useImageCache();
    const built: Array<{ name: string; type: string }> = [];
    useLocalLibrary({ built });
    const network = createNetwork(() => 'image', 'application/octet-stream');
    const toasts: Array<{ message: string; isError: boolean | undefined }> = [];
    const harness = await createRuntime({
      sync: { [STORAGE_KEYS.wallpaper]: DEFAULT_WALLPAPER_ID },
      showToast: (message, isError) => toasts.push({ message, isError }),
      fetchRemoteContent: network.fetchRemoteContent
    });
    const { runtime } = harness;
    await runtime.bootstrapInitialWallpaper();
    runtime.createControls();
    openPanel(runtime);
    panelActions(runtime).selectSourceTab('local');
    panelActions(runtime).toggleUrlForm();
    await settle();
    return { ...harness, built, images, network, toasts };
  }

  const url = 'https://images.example/photos/Lake%20View.JPG';

  it('opens its form focused, and fetches only web links', async () => {
    const { runtime, network, toasts } = await setup();
    const urlForm = () => panelState(runtime).wallpaper.local.url;
    expect(urlForm().open).toBe(true);
    expect(panelOf(runtime).focused.at(-1)).toBe('urlInput');

    panelActions(runtime).submitWallpaperUrl('javascript:alert(1)');
    expect(network.requests).toHaveLength(0);
    expect(urlForm().invalid).toBe(true);
    expect(toasts.some((toast) => toast.isError)).toBe(true);
    panelActions(runtime).clearUrlInvalid();
    expect(urlForm().invalid).toBe(false);
  });

  it('syncs its URL and selection, caches the image on this device and closes the form', async () => {
    const { runtime, browser, built, images, network } = await setup();
    const urlForm = () => panelState(runtime).wallpaper.local.url;
    panelActions(runtime).submitWallpaperUrl(` ${url} `);
    expect(urlForm().disabled).toBe(true);
    await vi.waitFor(() => expect(images.size).toBe(1));
    await settle();
    expect(network.requests[0].url).toBe(url);
    expect(network.requests[0].init.credentials).toBe('omit');
    // A generic binary type falls back to the file extension.
    expect(built).toEqual([{ name: 'Lake View', type: 'image/jpeg' }]);
    const links = clonePlain(browser.storage.sync.values[STORAGE_KEYS.linkWallpapers]);
    expect(Array.isArray(links) && links.length).toBe(1);
    expect(readField(links, '0', 'url')).toBe(url);
    const linkId = String(readField(links, '0', 'id'));
    expect(readPickedWallpaper(browser)).toBe(linkId);
    // Older versions see a built-in stand-in instead of an id they would clear.
    expect(browser.storage.sync.values[STORAGE_KEYS.wallpaper]).toBe(DEFAULT_WALLPAPER_ID);
    expect(browser.storage.local.values[STORAGE_KEYS.localWallpaper]).toBeFalsy();
    expect(readField(images.get(linkId), 'url')).toBe(url);
    expect(shownWallpaperImage()).toContain(LINK_IMAGE_DATA_URL);
    expect(urlForm().open).toBe(false);
    expect(urlForm().clearToken).toBe(1);
    expect(urlForm().disabled).toBe(false);
    expect(findTile(runtime, linkId)?.source).toBe('local');

    panelActions(runtime).toggleUrlForm();
    await settle();
    // Escape closes the link form before the panel.
    expect(runtime.closeOpenMenu()).toBe(true);
    expect(urlForm().open).toBe(false);
    expect(runtime.closeOpenMenu()).toBe(false);
  });

  it('is cached by each synced device on its own, and deleting it removes it everywhere', async () => {
    const { runtime, browser, images, network } = await setup();
    panelActions(runtime).submitWallpaperUrl(url);
    await vi.waitFor(() => expect(images.size).toBe(1));
    await settle();
    const linkId = String(readField(browser.storage.sync.values[STORAGE_KEYS.linkWallpapers], '0', 'id'));

    const otherImages = useImageCache();
    useLocalLibrary();
    const otherNetwork = createNetwork(() => 'image', 'application/octet-stream');
    document.documentElement.removeAttribute('style');
    const other = await createRuntime({
      browser: createBrowserFake({ sync: { ...browser.storage.sync.values } }),
      fetchRemoteContent: otherNetwork.fetchRemoteContent
    });
    await other.runtime.bootstrapInitialWallpaper();
    await vi.waitFor(() => expect(otherImages.has(linkId)).toBe(true));
    expect(otherNetwork.urls()).toEqual([url]);
    expect(readField(otherImages.get(linkId), 'url')).toBe(url);
    expect(shownWallpaperImage()).toContain(LINK_IMAGE_DATA_URL);
    expect(network.urls()).toEqual([url]);

    panelActions(runtime).deleteWallpaper(linkId);
    await vi.waitFor(() => expect(clonePlain(browser.storage.sync.values[STORAGE_KEYS.linkWallpapers])).toEqual([]));
    expect(images.has(linkId)).toBe(false);
    expect(readPickedWallpaper(browser)).toBe(DEFAULT_WALLPAPER_ID);
    expect(findTile(runtime, linkId)).toBeNull();
  });
});
