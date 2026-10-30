import { describe, expect, it } from 'vitest';
import { createWallpaperSources } from './wallpaper-sources';
import { WallpaperLibrary } from './wallpaper-library';
import type { CachedWallpaperImage } from './wallpaper-runtime-types';
import type { RemoteWallpaper } from '../../remote-content-types';
import type { WallpaperRecord } from '../../../shared/wallpaper-records';

function upload(id: string, fields: Partial<WallpaperRecord>): WallpaperRecord {
  return { id, key: id, name: '', imageDataUrl: '', thumbnailDataUrl: '', sampleDataUrl: '', width: 0, height: 0, updatedAt: 1, ...fields };
}

function remotePhoto(id: string, fields: Partial<RemoteWallpaper>): RemoteWallpaper {
  return { id, provider: 'curated', name: '', sourceUrl: '', ...fields };
}

function cachedCopy(id: string, fields: Partial<CachedWallpaperImage>): CachedWallpaperImage {
  return { id, url: '', imageDataUrl: '', thumbnailDataUrl: '', sampleDataUrl: '', width: 0, height: 0, ...fields };
}

function setup() {
  const cachedWallpaperImages = new Map<string, CachedWallpaperImage>();
  const wallpaperNetworkImageStates = new Map<string, 'loaded' | 'failed'>();
  const remoteWallpapers = new Map<string, RemoteWallpaper>();
  const library = new WallpaperLibrary();
  library.setUploads([
    upload('custom-wallpaper-a', {
      imageDataUrl: 'data:image/webp;base64,ZnVsbA==', thumbnailDataUrl: 'data:image/webp;base64,c21hbGw=', width: 2560, height: 1440
    }),
    upload('custom-wallpaper-b', {
      imageDataUrl: 'data:image/webp;base64,ZnVsbC1i',
      thumbnailDataUrl: 'data:image/webp;base64,dGh1bWItYg==',
      sampleDataUrl: 'data:image/webp;base64,c2FtcGxlLWI=',
      width: 2560,
      height: 1440
    }),
    // Records saved before thumbnails existed carry the full image as their thumbnail.
    upload('custom-wallpaper-old', { imageDataUrl: 'data:image/webp;base64,b2xk', thumbnailDataUrl: 'data:image/webp;base64,b2xk' })
  ]);
  const sources = createWallpaperSources({
    localWallpaperStore: { isCustomWallpaperId: (id) => /^custom-wallpaper-/.test(String(id)) },
    online: { getDailyPick: () => '' },
    remoteClient: { getWallpaper: (id) => remoteWallpapers.get(id) || null },
    cachedWallpaperImages,
    dailyWallpaperStandIns: new Map(),
    chrome: { runtime: { getURL: (path) => `chrome-extension://abc/${path}` } },
    wallpaperNetworkImageStates,
    t: (_key, fallback) => fallback || '',
    library
  });
  const sample = (id: string) => {
    const value = sources.getWallpaperSample(sources.getWallpaperById(id));
    return value && { ...value };
  };
  return { cachedWallpaperImages, library, remoteWallpapers, sample, sources, wallpaperNetworkImageStates };
}

const bundledSample = {
  url: 'chrome-extension://abc/assets/wallpapers/lumno-newtab-monet-coastal-white-sample.avif',
  width: 2048,
  height: 1152
};

describe('the image a wallpaper is sampled from', () => {
  it('is a bundled wallpaper\'s small copy, placed by the built-in size', () => {
    expect(setup().sample('monet-coastal-white')).toEqual(bundledSample);
  });

  it('is an upload\'s sampling copy, or its thumbnail for one saved before those, placed by the upload size', () => {
    const { sample } = setup();
    expect(sample('custom-wallpaper-b')).toEqual({ url: 'data:image/webp;base64,c2FtcGxlLWI=', width: 2560, height: 1440 });
    expect(sample('custom-wallpaper-a')).toEqual({ url: 'data:image/webp;base64,c21hbGw=', width: 2560, height: 1440 });
  });

  it('is nothing for an upload whose thumbnail is the full image', () => {
    expect(setup().sample('custom-wallpaper-old')).toBeNull();
  });

  it('is a photo\'s cached sampling copy, or the cached thumbnail of an older copy', () => {
    const { cachedWallpaperImages, remoteWallpapers, sample } = setup();
    const id = 'bing-20260101-OHR.Test_1';
    remoteWallpapers.set(id, remotePhoto(id, {
      provider: 'bing', cacheImage: true, imageUrl: 'https://example.test/bing.jpg', thumbnailUrl: 'https://example.test/bing-tile.jpg'
    }));
    expect(sample(id)).toBeNull();

    cachedWallpaperImages.set(id, cachedCopy(id, {
      url: 'https://example.test/bing.jpg',
      imageDataUrl: 'data:image/webp;base64,YmluZw==',
      thumbnailDataUrl: 'data:image/webp;base64,YmluZy1zbWFsbA==',
      sampleDataUrl: 'data:image/webp;base64,YmluZy1zYW1wbGU=',
      width: 1920,
      height: 1080
    }));
    expect(sample(id)).toEqual({ url: 'data:image/webp;base64,YmluZy1zYW1wbGU=', width: 1920, height: 1080 });

    cachedWallpaperImages.set(id, cachedCopy(id, {
      url: 'https://example.test/bing.jpg',
      imageDataUrl: 'data:image/webp;base64,YmluZw==',
      thumbnailDataUrl: 'data:image/webp;base64,YmluZy1zbWFsbA=='
    }));
    expect(sample(id)).toEqual({ url: 'data:image/webp;base64,YmluZy1zbWFsbA==', width: 0, height: 0 });
  });

  it('is nothing for a network photo still loading, and the default it shows once it failed', () => {
    const { remoteWallpapers, sample, wallpaperNetworkImageStates } = setup();
    remoteWallpapers.set('picsum-2', remotePhoto('picsum-2', { imageUrl: 'https://example.test/curated.jpg' }));
    expect(sample('picsum-2')).toBeNull();
    wallpaperNetworkImageStates.set('https://example.test/curated.jpg', 'failed');
    expect(sample('picsum-2')).toEqual(bundledSample);
  });

  it('is a link\'s cached thumbnail once it is cached', () => {
    const { cachedWallpaperImages, library, sample } = setup();
    library.setLinks([{ id: 'link-abcd', url: 'https://example.test/link.jpg', addedAt: 1 }]);
    expect(sample('link-abcd')).toBeNull();
    cachedWallpaperImages.set('link-abcd', cachedCopy('link-abcd', {
      url: 'https://example.test/link.jpg',
      imageDataUrl: 'data:image/webp;base64,bGluaw==',
      thumbnailDataUrl: 'data:image/webp;base64,bGluay1zbWFsbA==',
      width: 1600,
      height: 900
    }));
    expect(sample('link-abcd')).toEqual({ url: 'data:image/webp;base64,bGluay1zbWFsbA==', width: 1600, height: 900 });
  });

  it('is nothing without a wallpaper', () => {
    expect(setup().sources.getWallpaperSample(null)).toBeNull();
  });
});
