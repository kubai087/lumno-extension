// Paints the cached wallpaper and the New Tab favicon before the page's own
// scripts run, from what an earlier page saved on this device.
import { getPageFaviconLink } from './page-favicon-link';
import * as LumnoNewtabWallpaperEffects from './wallpaper-effects';
import type { WallpaperEffectPrefs, WallpaperSample } from './wallpaper-effects';
import type {
  PreloadDecodedImage,
  PreloadImageRecord,
  PreloadObjectUrl,
  WallpaperMode,
  WallpaperPreloadState
} from '../wallpaper/wallpaper-preload-types';
import { PRELOAD_STORAGE_VERSION } from '../wallpaper/wallpaper-preload-types';
import { publishBootValue } from '../../platform/boot-handoff';
import { newtabFavicon, newtabFaviconPreload, newtabWallpaperEffect, newtabWallpaperPreload } from '../../domain/settings/newtab-wallpaper';
import * as ProviderStorage from '../../platform/provider-storage';

type OverlayPosition = 'top' | 'mid' | 'bottom';
type OverlayStops = Record<WallpaperMode, Record<OverlayPosition, number>>;
type FaviconId = 'default' | 'alternate';

// A copy of an online photo in the image cache, under the URL it copies.
interface CachedImageRef {
  id: string;
  url: string;
}

// An upload in the local wallpaper library, under its store key.
interface CustomImageRef {
  id: string;
  key: string;
}

const WALLPAPER_MODES: readonly WallpaperMode[] = ['light', 'dark'];
const OVERLAY_POSITIONS: readonly OverlayPosition[] = ['top', 'mid', 'bottom'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

(function() {
  const providerStorageRuntime = ProviderStorage.createProviderStorageRuntime(window.chrome);
  // Only bundled files paint on the first frame. Online photos and links paint from this device's
  // IndexedDB copy as soon as it is read, so a slow or failing network never holds the tab's spinner
  // or blanks the page; uploads paint from the local wallpaper library the same way.
  const WALLPAPER_PATH_PATTERN = /^(?:assets\/wallpapers|output\/imagegen)\/[-.\w]+\.webp$/;
  // Shared with createWallpaperImageCache in wallpaper-caches.ts.
  const IMAGE_CACHE_DB_NAME = 'lumno-newtab-wallpaper-cache';
  const IMAGE_CACHE_STORE_NAME = 'images';
  // Shared with createWallpaperLocalStore in wallpaper-local-store.ts.
  const CUSTOM_WALLPAPER_DB_NAME = 'lumno-newtab-wallpaper';
  const CUSTOM_WALLPAPER_STORE_NAME = 'wallpapers';
  const CUSTOM_WALLPAPER_ID_PATTERN = /^custom-wallpaper-[-\w]+$/;
  // Longer data URLs reach CSS as blob URLs, as in wallpaper.ts (WALLPAPER_CSS_INLINE_URL_MAX_LENGTH):
  // every style recalculation re-reads the whole custom property, which a megabyte makes slow.
  const CSS_INLINE_URL_MAX_LENGTH = 32 * 1024;
  // Chrome drops a CSS custom property longer than this (MAX_CSS_URL_LENGTH in wallpaper-local-store.ts).
  const CSS_CUSTOM_PROPERTY_MAX_LENGTH = 2 * 1024 * 1024;
  const FAVICON_OPTIONS: Record<FaviconId, { file: string; type: string; sizes: string }> = {
    default: {
      file: 'assets/images/lumno.png',
      type: 'image/png',
      sizes: ''
    },
    alternate: {
      file: 'assets/images/lumno-newtab-favicon.svg',
      type: 'image/svg+xml',
      sizes: 'any'
    }
  };

  function normalizeWallpaperMode(value: unknown): WallpaperMode {
    return value === 'dark' ? 'dark' : 'light';
  }

  function resolveCachedWallpaperMode(data: Record<string, unknown>): WallpaperMode {
    const themeMode = typeof data.themeMode === 'string' ? data.themeMode : '';
    if (themeMode === 'dark' || themeMode === 'light') {
      return themeMode;
    }
    if (themeMode === 'system') {
      return getSystemWallpaperMode() || normalizeWallpaperMode(data.mode);
    }
    return normalizeWallpaperMode(data.mode);
  }

  // The system's scheme; null where the page cannot read it.
  function getSystemWallpaperMode(): WallpaperMode | null {
    try {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return null;
    }
  }

  function normalizeEffectPrefs(value: unknown, inheritedVersion?: unknown): WallpaperEffectPrefs {
    const effects = LumnoNewtabWallpaperEffects;
    return effects.normalizePrefs(value, inheritedVersion);
  }

  function getEffectPrefsForMode(value: unknown, mode: WallpaperMode): WallpaperEffectPrefs {
    const effects = LumnoNewtabWallpaperEffects;
    return effects.normalizeStoragePrefs(value)[mode];
  }

  function readStoredEffectPrefs(mode: WallpaperMode, cachedPrefs: WallpaperEffectPrefs | null): Promise<WallpaperEffectPrefs> {
    if (cachedPrefs) {
      return Promise.resolve(cachedPrefs);
    }
    const storage = providerStorageRuntime.area;
    if (!storage || typeof storage.get !== 'function') {
      return Promise.resolve(normalizeEffectPrefs(null));
    }
    return new Promise((resolve) => {
      try {
        void storage.get([newtabWallpaperEffect.key], (result) => {
          resolve(getEffectPrefsForMode(
            result && result[newtabWallpaperEffect.key],
            mode
          ));
        });
      } catch {
        resolve(normalizeEffectPrefs(null));
      }
    });
  }

  function readCachedWallpaper() {
    try {
      const raw = window.localStorage ? window.localStorage.getItem(newtabWallpaperPreload.key) : '';
      if (!raw) {
        return null;
      }
      const data: unknown = JSON.parse(raw);
      if (!isRecord(data) ||
          Number(data.version) !== PRELOAD_STORAGE_VERSION ||
          !isRecord(data.wallpapers) ||
          !data.overlayStops) {
        return null;
      }
      const mode = resolveCachedWallpaperMode(data);
      const storedEntry = data.wallpapers[mode];
      const entry = isRecord(storedEntry) ? storedEntry : null;
      const path = entry && typeof entry.path === 'string' ? entry.path.trim() : '';
      const overlayStops = normalizeCachedOverlayStops(data.overlayStops);
      if (!overlayStops) {
        return null;
      }
      // A daily photo's slot also names tomorrow's photo once its copy is cached, so the first tab
      // after midnight paints the new photo. Its luminance is not measured yet.
      const next = entry && isRecord(entry.next) ? entry.next : null;
      const nextImage = next && next.day === getLocalDay(Date.now()) ? normalizeCachedImage(next.cachedImage) : null;
      return {
        mode,
        id: entry && typeof entry.id === 'string' ? entry.id : '',
        path: WALLPAPER_PATH_PATTERN.test(path) ? path : '',
        sourceSize: normalizeSourceSize(entry),
        cachedImage: nextImage || normalizeCachedImage(entry && entry.cachedImage),
        customImage: normalizeCustomImage(entry && entry.customImage),
        luminance: nextImage ? null : normalizeLuminance(entry && entry.luminance),
        overlayStops,
        effectPrefs: getEffectPrefsForMode(data.wallpaperEffects, mode)
      };
    } catch {
      return null;
    }
  }

  // A full image's size as an entry or record names it, or 0 by 0 when it does not.
  function normalizeSourceSize(value: unknown): { width: number; height: number } {
    const source = isRecord(value) ? value : {};
    const width = Math.round(Number(source.width));
    const height = Math.round(Number(source.height));
    return width > 0 && height > 0 ? { width, height } : { width: 0, height: 0 };
  }

  // Matches localDay in remote-content.ts, which loads after this script.
  function getLocalDay(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  }

  function normalizeCachedImage(value: unknown): CachedImageRef | null {
    const source = isRecord(value) ? value : {};
    const id = typeof source.id === 'string' ? source.id : '';
    const url = typeof source.url === 'string' ? source.url : '';
    return id && url ? { id, url } : null;
  }

  function normalizeCustomImage(value: unknown): CustomImageRef | null {
    const source = isRecord(value) ? value : {};
    const id = typeof source.id === 'string' ? source.id : '';
    const key = typeof source.key === 'string' && source.key ? source.key : id;
    return CUSTOM_WALLPAPER_ID_PATTERN.test(id) && key ? { id, key } : null;
  }

  // The wallpaper's average luminance (0–1), which the blur effect's frost blends by.
  function normalizeLuminance(value: unknown): number | null {
    const luminance = typeof value === 'number' ? value : NaN;
    return Number.isFinite(luminance) && luminance >= 0 && luminance <= 1 ? luminance : null;
  }

  // Reads one record from an IndexedDB store wallpaper.ts keeps, and only one holding an image.
  function readStoredImageRecord(
    dbName: string,
    storeName: string,
    key: string,
    isExpectedRecord: (record: Record<string, unknown>) => boolean
  ): Promise<PreloadImageRecord | null> {
    return new Promise((resolve) => {
      let request: IDBOpenDBRequest | null = null;
      try {
        request = window.indexedDB ? window.indexedDB.open(dbName, 1) : null;
      } catch {
        request = null;
      }
      if (!request) {
        resolve(null);
        return;
      }
      // Narrowed here, for the callbacks below.
      const openRequest = request;
      // wallpaper.ts creates the database; an empty one has nothing to paint.
      openRequest.onupgradeneeded = () => openRequest.transaction?.abort();
      openRequest.onerror = () => resolve(null);
      openRequest.onsuccess = () => {
        const db = openRequest.result;
        const finish = (record: unknown) => {
          db.close();
          resolve(isRecord(record) &&
            isExpectedRecord(record) &&
            isImageRecord(record) ? record : null);
        };
        try {
          const read = db.transaction(storeName, 'readonly')
            .objectStore(storeName)
            .get(key);
          read.onsuccess = () => finish(read.result);
          read.onerror = () => finish(null);
        } catch {
          finish(null);
        }
      };
    });
  }

  function isImageRecord(record: Record<string, unknown>): record is PreloadImageRecord {
    return typeof record.imageDataUrl === 'string' && record.imageDataUrl.startsWith('data:image/');
  }

  // The copy wallpaper.ts saved, and only when it is still the copy of the same image.
  function readCachedImage(cachedImage: CachedImageRef): Promise<PreloadImageRecord | null> {
    return readStoredImageRecord(IMAGE_CACHE_DB_NAME, IMAGE_CACHE_STORE_NAME, cachedImage.id,
      (record) => record.url === cachedImage.url);
  }

  // The upload itself, from the local wallpaper library. Uploads never reuse an ID, so the record
  // under that key is always the image the entry named.
  function readCustomImage(customImage: CustomImageRef): Promise<PreloadImageRecord | null> {
    return readStoredImageRecord(CUSTOM_WALLPAPER_DB_NAME, CUSTOM_WALLPAPER_STORE_NAME, customImage.key,
      () => true);
  }

  // wallpaper.ts adopts the blob URL (cssObjectUrl) instead of making its own, so the background
  // never swaps to a second, still undecoded copy of the same image.
  function getCssSafeImageUrl(dataUrl: string): { url: string; objectUrl: PreloadObjectUrl | null } {
    if (dataUrl.length <= CSS_INLINE_URL_MAX_LENGTH ||
        !window.URL || typeof window.URL.createObjectURL !== 'function') {
      return { url: dataUrl, objectUrl: null };
    }
    try {
      const comma = dataUrl.indexOf(',');
      const meta = dataUrl.slice(5, comma);
      if (!/;base64$/i.test(meta)) {
        return { url: dataUrl, objectUrl: null };
      }
      const payload = dataUrl.slice(comma + 1);
      let bytes: Uint8Array<ArrayBuffer>;
      if (typeof Uint8Array.fromBase64 === 'function') {
        bytes = Uint8Array.fromBase64(payload);
      } else {
        const binary = window.atob(payload);
        bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
          bytes[index] = binary.charCodeAt(index);
        }
      }
      const url = window.URL.createObjectURL(new window.Blob([bytes], { type: meta.replace(/;base64$/i, '') }));
      return { url, objectUrl: { source: dataUrl, url } };
    } catch {
      // Past Chrome's custom-property limit the data URL would not paint at all; wallpaper.ts tries again.
      return {
        url: getCssUrlValue(dataUrl).length <= CSS_CUSTOM_PROPERTY_MAX_LENGTH ? dataUrl : '',
        objectUrl: null
      };
    }
  }

  function normalizeCachedOverlayStops(value: unknown): OverlayStops | null {
    const source = isRecord(value) ? value : {};
    const light = normalizeModeOverlayStops(source.light);
    const dark = light ? normalizeModeOverlayStops(source.dark) : null;
    return light && dark ? { light, dark } : null;
  }

  // One color mode's overlay stops, each a percentage.
  function normalizeModeOverlayStops(entry: unknown): Record<OverlayPosition, number> | null {
    if (!isRecord(entry)) {
      return null;
    }
    const top = Number(entry.top);
    const mid = Number(entry.mid);
    const bottom = Number(entry.bottom);
    const isStop = (stop: number) => Number.isFinite(stop) && stop >= 0 && stop <= 100;
    return isStop(top) && isStop(mid) && isStop(bottom) ? { top, mid, bottom } : null;
  }

  function getRuntimeUrl(path: string): string {
    if (window.chrome && window.chrome.runtime && typeof window.chrome.runtime.getURL === 'function') {
      return window.chrome.runtime.getURL(path);
    }
    return `../../${path}`;
  }

  function normalizeFaviconId(value: unknown): FaviconId | '' {
    const id = String(value || '').trim();
    return id === 'default' || id === 'alternate' ? id : '';
  }

  function readCachedFaviconId(): FaviconId | '' {
    try {
      return normalizeFaviconId(window.localStorage ?
        window.localStorage.getItem(newtabFaviconPreload.key) :
        '');
    } catch {
      return '';
    }
  }

  function cacheFaviconId(id: unknown): void {
    const normalized = normalizeFaviconId(id);
    if (!normalized) {
      return;
    }
    try {
      if (window.localStorage) {
        window.localStorage.setItem(newtabFaviconPreload.key, normalized);
      }
    } catch {
      // Ignore private-mode or quota failures; the runtime still applies the favicon later.
    }
  }


  function applyFaviconId(id: unknown): boolean {
    const normalized = normalizeFaviconId(id);
    if (!normalized) {
      return false;
    }
    const item = FAVICON_OPTIONS[normalized];
    const link = getPageFaviconLink(document);
    if (!link) {
      return false;
    }
    link.setAttribute('rel', 'icon');
    link.setAttribute('type', item.type);
    link.setAttribute('href', getRuntimeUrl(item.file));
    link.setAttribute('data-newtab-favicon-id', normalized);
    if (item.sizes) {
      link.setAttribute('sizes', item.sizes);
    } else {
      link.removeAttribute('sizes');
    }
    return true;
  }

  function applyStoredFaviconWhenAvailable(): void {
    const cachedId = readCachedFaviconId();
    if (cachedId) {
      applyFaviconId(cachedId);
    }
    try {
      const storage = providerStorageRuntime.area;
      if (!storage || typeof storage.get !== 'function') {
        return;
      }
      void storage.get([newtabFavicon.key], (result) => {
        const nextId = normalizeFaviconId(result && result[newtabFavicon.key]);
        if (!nextId) {
          return;
        }
        cacheFaviconId(nextId);
        applyFaviconId(nextId);
      });
    } catch {
      // Best-effort only; wallpaper.ts applies the definitive favicon after boot.
    }
  }

  function getCssUrlValue(url: unknown): string {
    const safe = String(url || '')
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '')
      .replace(/\r/g, '');
    return safe ? `url("${safe}")` : 'none';
  }

  function markBodyActive(): void {
    const shouldMarkActive = () => {
      return document.documentElement &&
        document.documentElement.getAttribute('data-wallpaper-active') === 'true';
    };
    if (document.body) {
      if (shouldMarkActive()) {
        document.body.setAttribute('data-wallpaper-active', 'true');
      }
      return;
    }
    document.addEventListener('DOMContentLoaded', () => {
      if (document.body && shouldMarkActive()) {
        document.body.setAttribute('data-wallpaper-active', 'true');
      }
    }, { once: true });
  }

  applyStoredFaviconWhenAvailable();

  const cachedWallpaper = readCachedWallpaper();
  if (!cachedWallpaper) {
    // Nothing is cached before a profile's first New Tab. Its theme then
    // follows the system, so the first frame paints that scheme's base
    // instead of a white page.
    const systemMode = getSystemWallpaperMode();
    if (systemMode && document.documentElement) {
      document.documentElement.setAttribute('data-wallpaper-preload-theme', systemMode);
    }
    return;
  }
  const root = document.documentElement;
  if (root) {
    root.setAttribute('data-wallpaper-preload-theme', cachedWallpaper.mode);
    WALLPAPER_MODES.forEach((mode) => {
      OVERLAY_POSITIONS.forEach((position) => {
        root.style.setProperty(
          `--x-nt-wallpaper-overlay-${mode}-${position}`,
          `${cachedWallpaper.overlayStops[mode][position]}%`
        );
      });
    });
  }

  // Narrowed here, for the functions below.
  const cached = cachedWallpaper;
  function createPreloadState(
    fields: Omit<WallpaperPreloadState, 'effectPrefsReady' | 'initialImageUrl' | 'luminance' | 'mode'> &
      Partial<Pick<WallpaperPreloadState, 'initialImageUrl'>>
  ): WallpaperPreloadState {
    return {
      effectPrefsReady: readStoredEffectPrefs(cached.mode, cached.effectPrefs),
      // The URL of the image this page preloaded, once known; the luminance belongs to it. Unlike
      // imageUrl, wallpaper.ts never changes it.
      initialImageUrl: '',
      luminance: cached.luminance,
      mode: cached.mode,
      ...fields
    };
  }
  // A bundled wallpaper's small copy, which wallpaper.ts and the effects sample instead of the full
  // file (getWallpaperSample in wallpaper-sources.ts).
  function getBundledSamplePath(path: string): string {
    return /^assets\/wallpapers\/[-.\w]+\.webp$/.test(path) && !/-thumb\.webp$/.test(path)
      ? path.replace(/\.webp$/, '-sample.avif')
      : '';
  }

  // The small copy saved with an upload or a cached photo for sampling (an older one's thumbnail),
  // when it differs from the full image, as getWallpaperSample in wallpaper-sources.ts names it.
  function getRecordSample(record: PreloadImageRecord): WallpaperSample | null {
    const url = [record.sampleDataUrl, record.thumbnailDataUrl]
      .find((value): value is string => typeof value === 'string' && value.startsWith('data:image/')) || '';
    return url && url !== record.imageDataUrl
      ? { url, ...normalizeSourceSize(record) }
      : null;
  }

  // Decodes the wallpaper's small copy while the page loads; wallpaper.ts samples its tones from
  // this image (decodedImage) instead of loading and decoding it again. sourceUrl is the full image
  // it stands for.
  function decodeWallpaperImage(url: string, sourceUrl: string): PreloadDecodedImage | null {
    if (typeof window.Image !== 'function') {
      return null;
    }
    const ready = new Promise<HTMLImageElement | null>((resolve) => {
      const image = new window.Image();
      image.decoding = 'async';
      image.onload = () => {
        const decoded = typeof image.decode === 'function' ? image.decode() : Promise.resolve();
        decoded.then(() => resolve(image), () => resolve(image));
      };
      image.onerror = () => resolve(null);
      image.src = url;
    });
    return { url: sourceUrl || url, ready };
  }

  function applyWallpaperImage(url: string): void {
    if (root) {
      root.style.setProperty('--x-nt-wallpaper-image', getCssUrlValue(url));
      root.style.setProperty('--x-nt-wallpaper-size', 'cover');
      root.style.setProperty('--x-nt-wallpaper-position', 'center center');
      root.setAttribute('data-wallpaper-active', 'true');
    }
    markBodyActive();
  }

  if (cachedWallpaper.path) {
    const url = getRuntimeUrl(cachedWallpaper.path);
    const samplePath = getBundledSamplePath(cachedWallpaper.path);
    const sample = samplePath
      ? { url: getRuntimeUrl(samplePath), ...cachedWallpaper.sourceSize }
      : null;
    publishBootValue('wallpaperPreload', createPreloadState({
      imageUrl: url,
      initialImageUrl: url,
      sample,
      decodedImage: decodeWallpaperImage(sample ? sample.url : url, url),
      wallpaper: {
        id: cachedWallpaper.path,
        path: cachedWallpaper.path
      }
    }));
    applyWallpaperImage(url);
    if (document.head) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      link.fetchPriority = 'high';
      document.head.appendChild(link);
    }
    return;
  }
  const customImage = cachedWallpaper.customImage;
  const cachedImage = cachedWallpaper.cachedImage;
  // The stored image this page paints from: an upload, else an online photo's copy.
  const storedImage = customImage
    ? { id: customImage.id, read: () => readCustomImage(customImage) }
    : (cachedImage ? { id: cachedImage.id, read: () => readCachedImage(cachedImage) } : null);
  if (!storedImage) {
    return;
  }
  // wallpaper.ts sets runtimeApplied once it paints, and reuses cachedImageRecord instead of reading
  // the same copy or upload again.
  const preloadState = createPreloadState({
    imageUrl: '',
    sample: null,
    imageReady: null,
    cachedImageRecord: null,
    customImageId: customImage ? customImage.id : '',
    cssObjectUrl: null,
    decodedImage: null,
    runtimeApplied: false,
    wallpaper: {
      id: customImage ? customImage.id : cachedWallpaper.id || storedImage.id
    }
  });
  const recordRead = storedImage.read();
  preloadState.imageReady = recordRead.then((record) => {
    preloadState.cachedImageRecord = record;
    if (!record || preloadState.runtimeApplied) {
      return '';
    }
    const cssImage = getCssSafeImageUrl(record.imageDataUrl);
    if (!cssImage.url) {
      return '';
    }
    preloadState.imageUrl = record.imageDataUrl;
    preloadState.initialImageUrl = record.imageDataUrl;
    preloadState.sample = getRecordSample(record);
    preloadState.cssObjectUrl = cssImage.objectUrl;
    preloadState.decodedImage = decodeWallpaperImage(
      preloadState.sample ? preloadState.sample.url : cssImage.url,
      record.imageDataUrl
    );
    applyWallpaperImage(cssImage.url);
    return record.imageDataUrl;
  });
  publishBootValue('wallpaperPreload', preloadState);
})();
