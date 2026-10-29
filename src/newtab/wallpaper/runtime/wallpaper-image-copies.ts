// This device's copies of network wallpaper images: links, curated photos
// and prints, and tomorrow's daily photo, downscaled once and kept in the
// image cache so new tabs skip the network. Tells whoever shows them when a
// copy has been cached.
import type { WallpaperRecordInput } from '../../../shared/wallpaper-records';
import type { WallpaperImageCache } from '../../../shared/wallpaper-caches';
import { createEventBus } from '../../../shared/state/events';
import { readBootValue } from '../../../platform/boot-handoff';
import * as REMOTE_CONTENT from '../../remote-content';
import type { RemoteWallpaper } from '../../remote-content-types';
import { NEWTAB_WALLPAPER_MODES } from '../wallpaper-options';
import { waitForDocumentLoad } from './motion';
import { getUpcomingDailyWallpaper } from './online-wallpapers';
import type { WallpaperChoice } from './wallpaper-choice';
import { getWallpaperUrlName, isLinkWallpaperId } from './wallpaper-library';
import type { WallpaperLibrary } from './wallpaper-library';
import type { WallpaperPreloadCache } from './wallpaper-preload-cache';
import type { CachedWallpaperImage, WallpaperMode } from './wallpaper-runtime-types';
import type { WallpaperSources } from './wallpaper-sources';
import type { WallpaperStorage } from './wallpaper-storage';

// The image parts of a built record or a cached copy.
type WallpaperImageRecord = Pick<WallpaperRecordInput, 'imageDataUrl' | 'thumbnailDataUrl' | 'sampleDataUrl' | 'width' | 'height'>;

type FetchRemoteContent = (url: string, init: RequestInit) => Promise<Response>;

interface WallpaperImageCopyEvents {
  // A copy was cached; `shown` when a mode shows that photo.
  cached: { photoId: string; shown: boolean };
}

interface WallpaperImageCopiesDeps extends
  Pick<WallpaperPreloadCache, 'writeWallpaperPreloadCache'>,
  Pick<WallpaperStorage, 'buildCustomWallpaperRecordFromFile' | 'mergeCustomWallpaperRecords' | 'getEffectiveWallpaperIdForMode'>,
  Pick<WallpaperSources, 'getCachedWallpaperImage' | 'getWallpaperById' | 'getShownWallpaperCopy'> {
  fetchRemoteContent?: FetchRemoteContent;
  windowObj: Window & typeof globalThis;
  window: Window & typeof globalThis;
  document: Document;
  cachedWallpaperImages: Map<string, CachedWallpaperImage>;
  dailyWallpaperStandIns: Map<string, CachedWallpaperImage>;
  wallpaperImageCache: WallpaperImageCache | null;
  warnWallpaperStoreFailure(message: string): (error: unknown) => void;
  library: Pick<WallpaperLibrary, 'state' | 'getLink'>;
  choice: Pick<WallpaperChoice, 'state'>;
}

// The global timers with the DOM's numeric ids.
const globalTimers: Pick<Window, 'setTimeout' | 'clearTimeout'> = globalThis;

// Some hosts label images as generic binaries; these extensions then name the type.
const IMAGE_EXTENSION_TYPES: Readonly<Record<string, string>> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

// A copy read from the image cache or handed over by the preload, read as
// untrusted; null when it holds no image.
function readCachedWallpaperImage(value: unknown): CachedWallpaperImage | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id ||
      typeof value.imageDataUrl !== 'string' || !value.imageDataUrl) {
    return null;
  }
  return {
    id: value.id,
    url: typeof value.url === 'string' ? value.url : '',
    imageDataUrl: value.imageDataUrl,
    thumbnailDataUrl: typeof value.thumbnailDataUrl === 'string' ? value.thumbnailDataUrl : '',
    sampleDataUrl: typeof value.sampleDataUrl === 'string' ? value.sampleDataUrl : '',
    width: Number(value.width) || 0,
    height: Number(value.height) || 0,
    cachedAt: Number(value.cachedAt) || 0
  };
}

function createWallpaperImageCopies(deps: WallpaperImageCopiesDeps) {
  const {
    writeWallpaperPreloadCache,
    buildCustomWallpaperRecordFromFile,
    mergeCustomWallpaperRecords,
    getEffectiveWallpaperIdForMode,
    getCachedWallpaperImage,
    getWallpaperById,
    getShownWallpaperCopy,
    fetchRemoteContent,
    windowObj,
    window,
    document,
    cachedWallpaperImages,
    dailyWallpaperStandIns,
    wallpaperImageCache,
    warnWallpaperStoreFailure,
    library,
    choice
  } = deps;

  const events = createEventBus<WallpaperImageCopyEvents>();
  // Tomorrow's curated photo downloads once the page idles, or after this long at the latest.
  const UPCOMING_WALLPAPER_IDLE_TIMEOUT_MS = 30000;
  const wallpaperImageCaching = new Map<string, Promise<boolean>>();
  // The upcoming photos the page has scheduled to cache, so repeated applies do not queue them again.
  let upcomingWallpaperCacheKey = '';

  // Some hosts label images as generic binaries; the file extension then names the type.
  function getCustomWallpaperUrlMimeType(url: string, type: string): string {
    const mime = String(type || '').split(';')[0].trim().toLowerCase();
    if (mime.startsWith('image/')) return mime === 'image/jpg' ? 'image/jpeg' : mime;
    const extension = (/\.([a-z0-9]{3,4})$/i.exec(new URL(url).pathname) || [])[1] || '';
    return IMAGE_EXTENSION_TYPES[extension.toLowerCase()] || mime;
  }

  async function fetchWallpaperFile(url: string): Promise<File> {
    const fetcher: FetchRemoteContent = typeof fetchRemoteContent === 'function'
      ? fetchRemoteContent
      : windowObj.fetch.bind(windowObj);
    const controller = new AbortController();
    const timer = globalTimers.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetcher(url, {
        signal: controller.signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer'
      });
      if (!response.ok) {
        throw new Error(`Request failed (${response.status}).`);
      }
      const blob = await response.blob();
      return new File([blob], getWallpaperUrlName(response.url || url), {
        type: getCustomWallpaperUrlMimeType(response.url || url, blob.type)
      });
    } finally {
      globalTimers.clearTimeout(timer);
    }
  }

  // The preload already reads the shown photo's copy; take it instead of opening the cache again.
  function takePreloadedWallpaperImage(): Promise<void> {
    const wallpaperPreload = readBootValue('wallpaperPreload');
    const ready = wallpaperPreload && !wallpaperPreload.customImageId && wallpaperPreload.imageReady;
    if (!wallpaperPreload || !ready || typeof ready.then !== 'function') return Promise.resolve();
    wallpaperPreload.imageReady = null;
    return ready.then(() => {
      const record = readCachedWallpaperImage(wallpaperPreload.cachedImageRecord);
      if (record && !cachedWallpaperImages.has(record.id)) {
        cachedWallpaperImages.set(record.id, record);
      }
    }, () => {
      // The preload found no copy; the runtime reads the cache itself next.
    });
  }

  // Likewise for an upload: the preload read its record from the local wallpaper library.
  function takePreloadedCustomWallpaper(): Promise<void> {
    const wallpaperPreload = readBootValue('wallpaperPreload');
    const ready = wallpaperPreload && wallpaperPreload.customImageId && wallpaperPreload.imageReady;
    if (!wallpaperPreload || !ready || typeof ready.then !== 'function') return Promise.resolve();
    wallpaperPreload.imageReady = null;
    return ready.then(() => {
      const record = wallpaperPreload.cachedImageRecord;
      if (record) {
        mergeCustomWallpaperRecords([record]);
      }
    }, () => {
      // The preload found no record; the runtime reads the library itself next.
    });
  }

  function readCachedWallpaperImages(ids: string[]): Promise<void> {
    return takePreloadedWallpaperImage().then(() => readStoredCachedWallpaperImages(ids));
  }

  function readStoredCachedWallpaperImages(ids: string[]): Promise<void> {
    const missing = ids.filter((id) => !cachedWallpaperImages.has(id));
    if (!wallpaperImageCache || !missing.length) return Promise.resolve();
    return wallpaperImageCache.readByIds(missing).then((records) => {
      records.forEach((stored) => {
        const record = readCachedWallpaperImage(stored);
        if (record) cachedWallpaperImages.set(record.id, record);
      });
    }).catch(warnWallpaperStoreFailure('Could not read cached wallpaper images.'));
  }

  function rememberCachedWallpaperImage(id: string, url: string, record: WallpaperImageRecord): void {
    // The effects sample sampleDataUrl (or, for copies cached before it existed, the thumbnail), placed
    // by the copy's width and height.
    const image: CachedWallpaperImage = { id, url, imageDataUrl: record.imageDataUrl, thumbnailDataUrl: record.thumbnailDataUrl,
      sampleDataUrl: record.sampleDataUrl || '', width: record.width, height: record.height, cachedAt: Date.now() };
    cachedWallpaperImages.set(id, image);
    if (wallpaperImageCache) {
      wallpaperImageCache.write(image).catch(warnWallpaperStoreFailure('Could not cache a wallpaper image.'));
    }
  }

  // A link names a single image. Each device downloads it, or a curated photo or print, once and
  // keeps a downscaled copy, so new tabs skip the network and the wallpaper keeps showing if the
  // link later breaks.
  function cacheWallpaperImage(photoId: string, url: string | undefined): Promise<boolean> {
    if (getCachedWallpaperImage(photoId, url)) return Promise.resolve(true);
    const pending = wallpaperImageCaching.get(photoId);
    if (pending) return pending;
    if (!url) return Promise.resolve(false);
    const task = readCachedWallpaperImages([photoId]).then<CachedWallpaperImage | void>(() => getCachedWallpaperImage(photoId, url) ||
      fetchWallpaperFile(url).then(buildCustomWallpaperRecordFromFile).then((record) => {
        rememberCachedWallpaperImage(photoId, url, record);
        pruneCachedWallpaperImages();
      }))
      .then(() => {
        events.emit('cached', {
          photoId,
          shown: NEWTAB_WALLPAPER_MODES.some((mode) => getEffectiveWallpaperPhotoId(mode) === photoId)
        });
        return true;
      })
      .catch(() => false)
      .finally(() => wallpaperImageCaching.delete(photoId));
    wallpaperImageCaching.set(photoId, task);
    return task;
  }

  function cacheLinkWallpaper(id: string): Promise<boolean> {
    const entry = library.getLink(id);
    return entry ? cacheWallpaperImage(id, entry.url) : Promise.resolve(false);
  }

  // The photo a mode shows: the link itself, or the photo or print a curated or daily pick resolves to.
  function getEffectiveWallpaperPhotoId(mode: WallpaperMode): string {
    const id = getEffectiveWallpaperIdForMode(mode);
    if (isLinkWallpaperId(id)) return id;
    const item = id && REMOTE_CONTENT.wallpaperFromId(id) ? getWallpaperById(id) : null;
    return item && item.cacheImage ? item.dailyId || item.id : '';
  }

  function cacheShownWallpaperImages(): void {
    NEWTAB_WALLPAPER_MODES.forEach((mode) => {
      const id = getEffectiveWallpaperIdForMode(mode);
      if (isLinkWallpaperId(id)) {
        void cacheLinkWallpaper(id);
        return;
      }
      const item = id && REMOTE_CONTENT.wallpaperFromId(id) ? getWallpaperById(id) : null;
      if (item && item.cacheImage) void cacheWallpaperImage(item.dailyId || item.id, item.imageUrl);
    });
    scheduleUpcomingDailyWallpaperCache();
  }

  function getUpcomingDailyWallpapers(): RemoteWallpaper[] {
    const items: RemoteWallpaper[] = [];
    NEWTAB_WALLPAPER_MODES.forEach((mode) => {
      const item = getUpcomingDailyWallpaper(getEffectiveWallpaperIdForMode(mode));
      if (item && !items.some((existing) => existing.id === item.id)) items.push(item);
    });
    return items;
  }

  // Caches tomorrow's curated photo once the page is idle, so the first tab after midnight opens
  // on the new photo from this device's copy instead of waiting on Picsum. The copy is one more
  // download a day and, like every cached photo, stays on this device: sync and WebDAV never see it.
  function scheduleUpcomingDailyWallpaperCache(): void {
    const upcoming = getUpcomingDailyWallpapers()
      .filter((item) => !getCachedWallpaperImage(item.id, item.imageUrl));
    const key = upcoming.map((item) => item.id).join(' ');
    // Without idle callbacks the download could compete with the page, so it waits for the next tab.
    if (!key || key === upcomingWallpaperCacheKey || !wallpaperImageCache ||
        typeof window.requestIdleCallback !== 'function') {
      return;
    }
    upcomingWallpaperCacheKey = key;
    const cacheUpcoming = () => {
      // Today's copies go first, and open tabs take turns, so one tab downloads and the others
      // find its copy in IndexedDB.
      const task = () => Promise.all(upcoming.map((item) => cacheWallpaperImage(item.id, item.imageUrl)));
      const locks = window.navigator && window.navigator.locks;
      return Promise.all(Array.from(wallpaperImageCaching.values()))
        .then(async () => (locks && typeof locks.request === 'function'
          ? await locks.request('lumno-newtab-upcoming-wallpaper', task)
          : await task()))
        .then((results) => {
          if (results.every(Boolean)) {
            writeWallpaperPreloadCache();
          } else if (upcomingWallpaperCacheKey === key) {
            // Offline or the photo failed: the next apply or tab tries again.
            upcomingWallpaperCacheKey = '';
          }
        });
    };
    void waitForDocumentLoad(document, window).then(() => {
      window.requestIdleCallback(() => {
        cacheUpcoming().catch(() => {
          if (upcomingWallpaperCacheKey === key) upcomingWallpaperCacheKey = '';
        });
      }, { timeout: UPCOMING_WALLPAPER_IDLE_TIMEOUT_MS });
    });
  }

  // Saved links keep their copies; a curated photo or print stays only while a mode shows it, or
  // stands in for it, or is tomorrow's, so daily picks do not pile up one image per day.
  function pruneCachedWallpaperImages(): void {
    if (!wallpaperImageCache || !choice.state.loaded) return;
    const shownCopyIds = NEWTAB_WALLPAPER_MODES.map((mode) => {
      const id = getEffectiveWallpaperIdForMode(mode);
      const copy = id && REMOTE_CONTENT.wallpaperFromId(id) ? getShownWallpaperCopy(getWallpaperById(id)) : null;
      return copy ? copy.id : '';
    });
    const keep = new Set(library.state.links.map((item) => item.id)
      .concat(NEWTAB_WALLPAPER_MODES.map((mode) => getEffectiveWallpaperPhotoId(mode)), shownCopyIds,
        getUpcomingDailyWallpapers().map((item) => item.id)));
    // Narrowed here, for the callbacks below.
    const imageCache = wallpaperImageCache;
    imageCache.keys().then((keys) => keys.filter((key) => typeof key !== 'string' || !keep.has(key)).forEach((key) => {
      if (typeof key === 'string') {
        cachedWallpaperImages.delete(key);
        dailyWallpaperStandIns.forEach((copy, slotId) => {
          if (copy.id === key) dailyWallpaperStandIns.delete(slotId);
        });
      }
      imageCache.remove(key).catch(warnWallpaperStoreFailure('Could not prune a cached wallpaper image.'));
    })).catch(warnWallpaperStoreFailure('Could not list cached wallpaper images.'));
  }

  function cacheListedLinkWallpapers(): void {
    library.state.links.forEach((item) => { void cacheLinkWallpaper(item.id); });
  }

  return {
    events,
    fetchWallpaperFile,
    takePreloadedCustomWallpaper,
    readCachedWallpaperImages,
    rememberCachedWallpaperImage,
    cacheShownWallpaperImages,
    cacheListedLinkWallpapers
  };
}

type WallpaperImageCopies = ReturnType<typeof createWallpaperImageCopies>;

export { createWallpaperImageCopies };
export type { WallpaperImageCopies, WallpaperImageRecord };
