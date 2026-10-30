import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WALLPAPER_PRELOAD_STORAGE_VERSION,
  cacheWallpaperPreload,
  lightPreloadCache,
  runWallpaperPreload
} from '../../../tests/fakes/wallpaper/preload';
import { createBrowserFake } from '../../../tests/fakes/browser';
import { required } from '../../../tests/fakes/dom';
import { installImageFake } from '../../../tests/fakes/canvas';
import { WALLPAPER_DATABASES, installIndexedDb } from '../../../tests/fakes/indexed-db';

const root = document.documentElement;

function stubSystemScheme(prefersDark: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
    media: query,
    addEventListener() {},
    removeEventListener() {}
  }));
}

beforeEach(() => {
  vi.stubGlobal('chrome', createBrowserFake());
  stubSystemScheme(false);
});

afterEach(() => {
  Array.from(root.attributes).forEach((attribute) => root.removeAttribute(attribute.name));
  localStorage.clear();
  Reflect.deleteProperty(globalThis, '__lumnoBoot');
  vi.unstubAllGlobals();
});

const shownImage = () => root.style.getPropertyValue('--x-nt-wallpaper-image');

describe('the wallpaper preload', () => {
  // Nothing is cached before a profile's first New Tab: the theme then follows
  // the system, and the first frame paints a dark system's base, not white.
  it('paints the system scheme\'s base with nothing cached', async () => {
    stubSystemScheme(true);
    await runWallpaperPreload();
    expect(root.getAttribute('data-wallpaper-preload-theme')).toBe('dark');

    stubSystemScheme(false);
    await runWallpaperPreload();
    expect(root.getAttribute('data-wallpaper-preload-theme')).toBe('light');
  });

  it('paints the cached wallpaper and mask of the cached mode', async () => {
    cacheWallpaperPreload({
      version: WALLPAPER_PRELOAD_STORAGE_VERSION,
      mode: 'dark',
      themeMode: 'dark',
      overlayStops: { light: { top: 0, mid: 0, bottom: 0 }, dark: { top: 4.4, mid: 2, bottom: 5 } },
      wallpapers: {
        light: { id: 'monet-coastal-white', path: 'assets/wallpapers/lumno-newtab-monet-coastal-white.webp' },
        dark: { id: 'dark-shanshui-moonlit', path: 'assets/wallpapers/lumno-newtab-dark-shanshui-moonlit.webp' }
      },
      wallpaperEffects: {
        light: { type: 'grain', spacing: -20, crtSpacing: 73, crtGrain: 9 },
        dark: { type: 'grain', spacing: 240, crtSpacing: 73, crtGrain: 9 }
      }
    });
    const preload = required(await runWallpaperPreload(), 'the preload state');
    const effectPrefs = await preload.effectPrefsReady;
    expect(effectPrefs.spacing).toBe(100);
    expect(effectPrefs).not.toHaveProperty('crtSpacing');
    expect(effectPrefs).not.toHaveProperty('crtGrain');
    expect(shownImage()).toContain('lumno-newtab-dark-shanshui-moonlit.webp');
    expect(shownImage()).not.toContain('monet-coastal-white');
    expect(root.getAttribute('data-wallpaper-preload-theme')).toBe('dark');
    expect(root.style.getPropertyValue('--x-nt-wallpaper-overlay-dark-top')).toBe('4.4%');
  });

  it('keeps a dark base and paints nothing for a dark wallpaper kept only on this device', async () => {
    cacheWallpaperPreload({
      version: WALLPAPER_PRELOAD_STORAGE_VERSION,
      mode: 'dark',
      themeMode: 'dark',
      overlayStops: { light: { top: 0, mid: 0, bottom: 0 }, dark: { top: 4.4, mid: 2, bottom: 5 } },
      wallpapers: {
        light: { id: 'monet-coastal-white', path: 'assets/wallpapers/lumno-newtab-monet-coastal-white.webp' },
        dark: null
      }
    });
    await runWallpaperPreload();
    expect(root.getAttribute('data-wallpaper-preload-theme')).toBe('dark');
    expect(shownImage()).toBe('');
  });

  it('never paints a blurred copy an older version cached', async () => {
    cacheWallpaperPreload({
      version: WALLPAPER_PRELOAD_STORAGE_VERSION,
      mode: 'light',
      themeMode: 'light',
      overlayStops: { light: { top: 54, mid: 20, bottom: 38 }, dark: { top: 44, mid: 20, bottom: 50 } },
      wallpapers: {
        light: {
          id: 'custom-wallpaper-1',
          placeholder: 'data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvQWxvAGs=',
          placeholderKey: 'custom-wallpaper-1'
        },
        dark: null
      }
    });
    await runWallpaperPreload();
    expect(root.style.getPropertyValue('--x-nt-wallpaper-placeholder')).toBe('');
    expect(root.getAttribute('data-wallpaper-placeholder')).toBeNull();
  });

  it.each([
    'https://picsum.photos/id/28/2560/1440',
    'https://www.bing.com/th?id=OHR.Example_1920x1080.jpg&pid=hp',
    'https://evil.example/id/28/2560/1440'
  ])('never waits on the network for an online photo an older version cached (%s)', async (url) => {
    cacheWallpaperPreload(lightPreloadCache({ id: 'picsum-28', url }));
    await runWallpaperPreload();
    expect(shownImage()).toBe('');
  });

  it('ignores a cache from before the mode-aware format', async () => {
    cacheWallpaperPreload({
      version: 2,
      mode: 'dark',
      themeMode: 'dark',
      wallpapers: {
        light: null,
        dark: { id: 'monet-coastal-white', path: 'assets/wallpapers/lumno-newtab-monet-coastal-white.webp' }
      }
    });
    await runWallpaperPreload();
    expect(shownImage()).toBe('');
  });
});

describe('what the wallpaper preload hands the page', () => {
  const bundled = {
    id: 'dark-shanshui-moonlit',
    path: 'assets/wallpapers/lumno-newtab-dark-shanshui-moonlit.webp',
    width: 2048,
    height: 1152,
    luminance: 0.31,
    luminanceKey: 'dark-shanshui-moonlit',
    placeholder: 'data:image/webp;base64,cGxhY2Vob2xkZXI=',
    backdrop: 'data:image/webp;base64,YmFja2Ryb3A='
  };
  const blurEffects = { wallpaperEffects: { light: { type: 'blur' }, dark: { type: 'blur' } } };
  const uploadId = 'custom-wallpaper-decoded';
  const dataUrl = 'data:image/webp;base64,dXBsb2Fk';
  const thumbnailDataUrl = 'data:image/webp;base64,dGh1bWI=';

  function seedUpload(record: Record<string, unknown>): void {
    const { name, store, keyPath } = WALLPAPER_DATABASES.uploads;
    installIndexedDb({ [name]: { [store]: { keyPath, records: [{ key: uploadId, id: uploadId, imageDataUrl: dataUrl, ...record }] } } });
  }

  async function runForUpload(record: Record<string, unknown>) {
    seedUpload(record);
    cacheWallpaperPreload(lightPreloadCache({ id: uploadId, customImage: { id: uploadId } }, blurEffects));
    return required(await runWallpaperPreload(), 'the preload state');
  }

  it('hands over the remembered luminance and the decoded small copy of a bundled wallpaper', async () => {
    installImageFake();
    cacheWallpaperPreload(lightPreloadCache(bundled, blurEffects));
    const preload = required(await runWallpaperPreload(), 'the preload state');
    expect(preload.luminance).toBe(0.31);
    expect(preload.initialImageUrl).toBe('chrome-extension://lumno/assets/wallpapers/lumno-newtab-dark-shanshui-moonlit.webp');
    expect(preload.sample).toEqual({
      url: 'chrome-extension://lumno/assets/wallpapers/lumno-newtab-dark-shanshui-moonlit-sample.avif',
      width: 2048,
      height: 1152
    });
    const decoded = required(preload.decodedImage, 'the decoded image');
    expect(decoded.url).toBe(preload.initialImageUrl);
    expect(required(await decoded.ready).src).toBe(required(preload.sample).url);
    expect(root.style.getPropertyValue('--x-nt-wallpaper-backdrop')).toBe('');
    expect(root.style.getPropertyValue('--x-nt-wallpaper-placeholder')).toBe('');
  });

  it('drops a remembered luminance outside 0-1', async () => {
    cacheWallpaperPreload(lightPreloadCache({ ...bundled, luminance: 4 }, blurEffects));
    const preload = required(await runWallpaperPreload(), 'the preload state');
    expect(preload.luminance).toBeNull();
  });

  it('decodes an upload once it is read, sampling the upload itself without a small copy', async () => {
    installImageFake();
    const preload = await runForUpload({});
    expect(preload.decodedImage).toBeNull();
    expect(await preload.imageReady).toBe(dataUrl);
    expect(preload.initialImageUrl).toBe(dataUrl);
    expect(preload.sample).toBeNull();
    expect(required(await required(preload.decodedImage).ready).src).toBe(dataUrl);
  });

  it('samples the thumbnail of an upload saved before sampling copies existed', async () => {
    installImageFake();
    const preload = await runForUpload({ thumbnailDataUrl, width: 2560, height: 1440 });
    expect(await preload.imageReady).toBe(dataUrl);
    expect(preload.sample).toEqual({ url: thumbnailDataUrl, width: 2560, height: 1440 });
    const decoded = required(preload.decodedImage);
    expect(decoded.url).toBe(dataUrl);
    expect(required(await decoded.ready).src).toBe(thumbnailDataUrl);
  });

  it('samples the small copy an upload saved for sampling', async () => {
    installImageFake();
    const sampleDataUrl = 'data:image/webp;base64,c2FtcGxl';
    const preload = await runForUpload({ thumbnailDataUrl, sampleDataUrl, width: 2560, height: 1440 });
    expect(await preload.imageReady).toBe(dataUrl);
    expect(preload.sample).toEqual({ url: sampleDataUrl, width: 2560, height: 1440 });
    expect(required(await required(preload.decodedImage).ready).src).toBe(sampleDataUrl);
  });
});
