import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as REMOTE_CONTENT from '../remote-content';
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
  readPreloadCache,
  shownWallpaperImage
} from '../../../tests/fakes/wallpaper/runtime';
import type { WallpaperRuntime } from './wallpaper';
import {
  LINK_IMAGE_DATA_URL,
  copyDataUrl,
  createNetwork,
  readField,
  readPickedWallpaper,
  resetOnlineMocks,
  settle,
  useImageCache,
  useLocalLibrary,
  useThumbnailCache
} from '../../../tests/fakes/wallpaper/online';
import { installCanvasFake, installImageFake } from '../../../tests/fakes/canvas';
import { createBrowserFake } from '../../../tests/fakes/browser';
import type { BrowserFake } from '../../../tests/fakes/browser';
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
  REMOTE_CONTENT.setRandomMixExcluded([]);
});

const curatedTileIds = (runtime: WallpaperRuntime) => panelState(runtime).wallpaper.curated.tiles.map((tile) => tile.id);
const writesTo = (browser: BrowserFake) => vi.spyOn(browser.storage.sync, 'set');

async function openCurated(sync: Record<string, unknown>, options: Parameters<typeof createRuntime>[0] = {}) {
  const harness = await createRuntime({ sync, ...options });
  await harness.runtime.bootstrapInitialWallpaper();
  harness.runtime.createControls();
  openPanel(harness.runtime);
  panelActions(harness.runtime).selectSourceTab('curated');
  await settle();
  return harness;
}

describe('the curated random mix', () => {
  const categories = REMOTE_CONTENT.CURATED_CATEGORIES.filter((value) => value !== 'random');

  it('mixes every category until some are left out, and syncs the ones left out', async () => {
    const { runtime, browser } = await openCurated({ [STORAGE_KEYS.wallpaper]: DEFAULT_WALLPAPER_ID });
    const mix = () => required(panelState(runtime).wallpaper.curated.mix, 'the mix menu');
    expect(mix().visible).toBe(true);
    expect(mix().label).toBe('All categories');
    expect(mix().options.map((option) => [option.value, option.checked])).toEqual(categories.map((value) => [value, true]));

    panelActions(runtime).setCuratedDaily(true);
    await settle();
    expect(readPickedWallpaper(browser)).toBe('curated-daily-random');
    const keep = ['city', 'water'];
    const excluded = categories.filter((value) => !keep.includes(value));
    excluded.forEach((value) => panelActions(runtime).setCuratedMixCategory(value, false));
    await settle();
    expect(clonePlain(browser.storage.sync.values[STORAGE_KEYS.curatedMixExcluded])).toEqual(excluded);
    expect(mix().label).toBe('Water, City');
    // The page shares the remote module, so it already lists the narrowed mix.
    expect(curatedTileIds(runtime).every((id) => keep.includes(String(REMOTE_CONTENT.wallpaperFromId(id)?.category)))).toBe(true);
    const today = required(REMOTE_CONTENT.getCuratedDailyWallpaper('random', Date.now()), 'today\'s photo');
    expect(keep).toContain(today.category);
    expect(shownWallpaperImage()).toContain(today.thumbnailUrl);
    expect(findTile(runtime, today.id)?.selected).toBe(true);

    panelActions(runtime).setCuratedMixCategory('city', false);
    await settle();
    expect(mix().options.find((option) => option.value === 'water')?.disabled).toBe(true);
    const writes = writesTo(browser);
    panelActions(runtime).setCuratedMixCategory('water', false);
    expect(writes).not.toHaveBeenCalled();

    categories.forEach((value) => panelActions(runtime).setCuratedMixCategory(value, true));
    await settle();
    expect(browser.storage.sync.values[STORAGE_KEYS.curatedMixExcluded]).toBe('');
    expect(mix().label).toBe('All categories');

    panelActions(runtime).selectCuratedCategory('nature');
    await settle();
    expect(mix().visible).toBe(false);
  });

  it('applies the categories another device left out', async () => {
    const { runtime } = await openCurated({
      [STORAGE_KEYS.wallpaper]: DEFAULT_WALLPAPER_ID,
      [STORAGE_KEYS.curatedMixExcluded]: ['art']
    });
    const art = required(panelState(runtime).wallpaper.curated.mix, 'the mix menu').options.find((option) => option.value === 'art');
    expect(art?.checked).toBe(false);
  });

  it('reopens a random daily choice on the random mix, at today\'s photo', async () => {
    const { runtime, browser } = await openCurated({ [STORAGE_KEYS.wallpaper]: DEFAULT_WALLPAPER_ID });
    panelActions(runtime).setCuratedDaily(true);
    await settle();
    expect(readPickedWallpaper(browser)).toBe('curated-daily-random');
    const today = required(REMOTE_CONTENT.getCuratedDailyWallpaper('random', Date.now()), 'today\'s photo');

    const other = await createRuntime({ browser: createBrowserFake({ sync: { ...browser.storage.sync.values } }) });
    await other.runtime.bootstrapInitialWallpaper();
    other.runtime.createControls();
    openPanel(other.runtime);
    await settle();
    expect(panelState(other.runtime).wallpaper.curated.category.tabs.active).toBe('random');
    expect(findTile(other.runtime, today.id)?.selected).toBe(true);
  });
});

describe('curated photos', () => {
  it('sync as their id, page through their category and keep the wallpaper while browsing', async () => {
    const { runtime, browser } = await openCurated({ [STORAGE_KEYS.wallpaper]: DEFAULT_WALLPAPER_ID });
    const curated = () => panelState(runtime).wallpaper.curated;
    // The curated source opens on the random mix with three full rows.
    expect(curatedTileIds(runtime)).toEqual(REMOTE_CONTENT.getCuratedWallpapers('random').slice(0, 9).map((item) => item.id));
    panelActions(runtime).selectCuratedCategory('nature');
    await settle();
    const nature = REMOTE_CONTENT.getCuratedWallpapers('nature');
    expect(curatedTileIds(runtime)).toEqual(nature.slice(0, 9).map((item) => item.id));
    expect(curated().category.tabs.active).toBe('nature');

    const picked = nature[1];
    clickTile(runtime, picked.id);
    await settle();
    expect(readPickedWallpaper(browser)).toBe(picked.id);
    expect(browser.storage.sync.values[STORAGE_KEYS.wallpaper]).toBe(DEFAULT_WALLPAPER_ID);
    // Until this device caches a copy, the photo shows its Picsum thumbnail.
    expect(shownWallpaperImage()).toContain(picked.thumbnailUrl);
    expect(curated().selected.title).toBe(`Photo by ${picked.name}`);
    expect(curated().selected.url).toBe(picked.sourceUrl);

    panelActions(runtime).showMoreCurated();
    expect(curatedTileIds(runtime)).toEqual(nature.slice(9, 18).map((item) => item.id));
    panelActions(runtime).selectCuratedCategory('city');
    await settle();
    expect(readPickedWallpaper(browser)).toBe(picked.id);
    expect(curatedTileIds(runtime)).toEqual(REMOTE_CONTENT.getCuratedWallpapers('city').slice(0, 9).map((item) => item.id));
  });

  it('rotate daily by category, take today\'s pick and restore the scheduled photo', async () => {
    const { runtime, browser } = await openCurated({ [STORAGE_KEYS.wallpaper]: DEFAULT_WALLPAPER_ID });
    const curated = () => panelState(runtime).wallpaper.curated;
    panelActions(runtime).selectCuratedCategory('city');
    await settle();
    panelActions(runtime).setCuratedDaily(true);
    await settle();
    const todayCity = required(REMOTE_CONTENT.getCuratedDailyWallpaper('city', Date.now()), 'today\'s city photo');
    // Daily mode syncs the category, so each device resolves the same photo for the date.
    expect(readPickedWallpaper(browser)).toBe('curated-daily-city');
    expect(curated().daily.toggle.checked).toBe(true);
    expect(findTile(runtime, todayCity.id)?.selected).toBe(true);

    const shownBefore = shownWallpaperImage();
    panelActions(runtime).selectCuratedCategory('water');
    await settle();
    expect(readPickedWallpaper(browser)).toBe('curated-daily-city');
    expect(shownWallpaperImage()).toBe(shownBefore);
    panelActions(runtime).setCuratedDaily(false);
    await settle();
    panelActions(runtime).setCuratedDaily(true);
    await settle();
    expect(readPickedWallpaper(browser)).toBe('curated-daily-water');

    const todayWater = required(REMOTE_CONTENT.getCuratedDailyWallpaper('water', Date.now()), 'today\'s water photo');
    const otherWater = required(curatedTileIds(runtime).find((tileId) => tileId !== todayWater.id), 'another water photo');
    clickTile(runtime, otherWater);
    await settle();
    expect(readPickedWallpaper(browser)).toBe('curated-daily-water');
    expect(curated().daily.toggle.checked).toBe(true);
    expect(clonePlain(readField(browser.storage.sync.values[STORAGE_KEYS.dailyPicks], 'picks')))
      .toEqual({ 'curated-daily-water': otherWater });
    expect(shownWallpaperImage()).toContain(REMOTE_CONTENT.wallpaperFromId(otherWater)?.thumbnailUrl);
    expect(findTile(runtime, otherWater)?.selected).toBe(true);
    expect(curated().daily.restoreVisible).toBe(true);
    const writes = writesTo(browser);
    clickTile(runtime, otherWater);
    expect(writes).not.toHaveBeenCalled();
    writes.mockRestore();

    panelActions(runtime).restoreDailyWallpaper();
    await settle();
    expect(browser.storage.sync.values[STORAGE_KEYS.dailyPicks]).toBe('');
    expect(curated().daily.restoreVisible).toBe(false);
    expect(findTile(runtime, todayWater.id)?.selected).toBe(true);

    clickTile(runtime, otherWater);
    await settle();
    // A pick from another day no longer counts.
    const nextDay = await createRuntime({
      browser: createBrowserFake({ sync: {
        ...browser.storage.sync.values,
        [STORAGE_KEYS.dailyPicks]: { day: '2000-1-1', picks: { 'curated-daily-water': otherWater } }
      } })
    });
    await nextDay.runtime.bootstrapInitialWallpaper();
    await settle();
    expect(shownWallpaperImage()).toContain(todayWater.thumbnailUrl);

    panelActions(runtime).setCuratedDaily(false);
    await settle();
    // Turning daily off keeps the photo on screen, including today's pick.
    expect(readPickedWallpaper(browser)).toBe(otherWater);

    const second = await createRuntime({ browser: createBrowserFake({ sync: { ...browser.storage.sync.values } }) });
    await second.runtime.bootstrapInitialWallpaper();
    second.runtime.createControls();
    await settle();
    openPanel(second.runtime);
    await settle();
    // Another device opens the curated source on the synced photo's category.
    expect(panelState(second.runtime).wallpaper.activeTab).toBe('curated');
    expect(panelState(second.runtime).wallpaper.curated.category.tabs.active).toBe('water');
  });
});

describe('curated photos and prints on this device', () => {
  it('cache one downscaled print, credit it, and keep only the prints a mode shows', async () => {
    const images = useImageCache();
    useLocalLibrary();
    const network = createNetwork(() => 'print');
    const { runtime, browser } = await openCurated({ [STORAGE_KEYS.wallpaper]: DEFAULT_WALLPAPER_ID },
      { fetchRemoteContent: network.fetchRemoteContent });
    panelActions(runtime).selectCuratedCategory('art');
    await settle();
    const [first, second] = REMOTE_CONTENT.getCuratedWallpapers('art');
    expect(curatedTileIds(runtime)[0]).toBe(first.id);
    expect(findTile(runtime, first.id)?.thumbnailUrl.endsWith('_web.jpg')).toBe(true);

    clickTile(runtime, first.id);
    await vi.waitFor(() => expect(images.has(first.id)).toBe(true));
    await settle();
    expect(readPickedWallpaper(browser)).toBe(first.id);
    expect(network.urls()).toEqual([first.imageUrl]);
    expect(shownWallpaperImage()).toContain(LINK_IMAGE_DATA_URL);
    const source = panelState(runtime).wallpaper.curated.selected;
    expect(source.title).toBe(first.title);
    expect(source.meta).toContain('The Cleveland Museum of Art');
    expect(source.url).toBe(first.sourceUrl);

    clickTile(runtime, second.id);
    await vi.waitFor(() => expect(Array.from(images.keys())).toEqual([second.id]));

    // The first frame paints the downscaled copy, never the multi-megabyte print.
    const light = readField(readPreloadCache(), 'wallpapers', 'light');
    expect(light).toEqual({ id: second.id, cachedImage: { id: second.id, url: second.imageUrl } });
    expect(readField(light, 'path')).toBeUndefined();
  });

  it('open new tabs from the cached copy of a photo without asking Picsum again', async () => {
    const images = useImageCache();
    useLocalLibrary();
    const network = createNetwork();
    const { runtime, browser } = await openCurated({ [STORAGE_KEYS.wallpaper]: DEFAULT_WALLPAPER_ID },
      { fetchRemoteContent: network.fetchRemoteContent });
    panelActions(runtime).selectCuratedCategory('nature');
    await settle();
    const photo = REMOTE_CONTENT.getCuratedWallpapers('nature')[0];
    clickTile(runtime, photo.id);
    await vi.waitFor(() => expect(images.has(photo.id)).toBe(true));
    await settle();
    expect(network.urls()).toEqual([photo.imageUrl]);
    expect(shownWallpaperImage()).toContain(LINK_IMAGE_DATA_URL);

    document.documentElement.removeAttribute('style');
    const nextTab = await createRuntime({
      browser: createBrowserFake({ sync: { ...browser.storage.sync.values } }),
      fetchRemoteContent: network.fetchRemoteContent
    });
    await nextTab.runtime.bootstrapInitialWallpaper();
    await settle();
    expect(network.urls()).toEqual([photo.imageUrl]);
    expect(shownWallpaperImage()).toContain(LINK_IMAGE_DATA_URL);
  });

  it('show tiles from the thumbnail cache, downloading each once', async () => {
    const thumbs = useThumbnailCache();
    useImageCache();
    useLocalLibrary({ buildTileThumbnail: async (blob) => copyDataUrl(await blob.text()) });
    // The thumbnail cache needs IndexedDB on the page.
    vi.stubGlobal('indexedDB', {});
    const tiles = (runtime: WallpaperRuntime) => panelState(runtime).wallpaper.curated.tiles;
    const openCuratedTab = async (fetchRemoteContent: (url: string, init: RequestInit) => Promise<Response>) => {
      const { runtime } = await createRuntime({ sync: { [STORAGE_KEYS.wallpaper]: DEFAULT_WALLPAPER_ID }, fetchRemoteContent });
      await runtime.bootstrapInitialWallpaper();
      runtime.createControls();
      // The closed panel loads no curated tiles, so a new tab asks Picsum for nothing.
      expect(tiles(runtime).every((tile) => tile.thumbnailUrl.startsWith('data:image/gif'))).toBe(true);
      openPanel(runtime);
      panelActions(runtime).selectSourceTab('curated');
      return runtime;
    };
    const network = createNetwork((url) => url);

    const first = await openCuratedTab(network.fetchRemoteContent);
    const shown = tiles(first).map((tile) => required(REMOTE_CONTENT.wallpaperFromId(tile.id), tile.id));
    // The random mix draws museum prints on some days too, so each source has its own small size.
    expect(shown.every((photo) => (photo.id.startsWith('picsum-')
      ? String(photo.thumbnailUrl).endsWith('/320/180')
      : String(photo.thumbnailUrl).endsWith('_web.jpg')))).toBe(true);
    // While the cache is read, tiles start no Picsum request of their own.
    expect(tiles(first).every((tile) => tile.thumbnailUrl.startsWith('data:image/gif'))).toBe(true);
    await vi.waitFor(() => expect(network.urls()).toHaveLength(shown.length));
    await settle();
    expect(network.urls()).toEqual(shown.map((photo) => photo.thumbnailUrl));
    expect(tiles(first).map((tile) => tile.thumbnailUrl)).toEqual(shown.map((photo) => copyDataUrl(String(photo.thumbnailUrl))));
    expect(Array.from(thumbs.keys())).toEqual(shown.map((photo) => photo.id));

    const reopened = await openCuratedTab(network.fetchRemoteContent);
    await settle();
    expect(network.urls()).toHaveLength(shown.length);
    expect(tiles(reopened).map((tile) => tile.thumbnailUrl)).toEqual(shown.map((photo) => copyDataUrl(String(photo.thumbnailUrl))));

    thumbs.clear();
    const offline = await openCuratedTab(async () => {
      throw new Error('offline');
    });
    await settle();
    // A tile that cannot be cached loads from Picsum as before.
    expect(tiles(offline).map((tile) => tile.thumbnailUrl)).toEqual(shown.map((photo) => photo.thumbnailUrl));
  });
});
