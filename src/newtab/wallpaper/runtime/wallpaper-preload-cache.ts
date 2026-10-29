// The preload cache the next New Tab reads before the runtime starts: per
// mode, where the wallpaper's image is and how bright it is, with the
// overlay and the effects, so the first frame paints the page as it was.
import type { RemoteContentClient } from '../../remote-content';
import * as REMOTE_CONTENT from '../../remote-content';
import type { AdaptiveToneSampler } from '../wallpaper-adaptive-tone';
import * as WALLPAPER_EFFECTS from '../wallpaper-effects';
import type { WallpaperEffectStoragePrefs } from '../wallpaper-effects';
import { NEWTAB_WALLPAPER_MODES, NEWTAB_WALLPAPER_MODE_DARK, NEWTAB_WALLPAPER_MODE_LIGHT, NEWTAB_WALLPAPER_OVERLAY_STOPS } from '../wallpaper-options';
import { PRELOAD_STORAGE_VERSION } from '../wallpaper-preload-types';
import { newtabWallpaperPreload } from '../../../domain/settings/newtab-wallpaper';
import { getNextLocalDayTimestamp, getUpcomingDailyWallpaper } from './online-wallpapers';
import { isLinkWallpaperId } from './wallpaper-library';
import type { WallpaperChoice } from './wallpaper-choice';
import { getWallpaperOverlayStopPercent } from './wallpaper-overlay';
import type { WallpaperOverlay } from './wallpaper-overlay';
import type { WallpaperItem, WallpaperMode } from './wallpaper-runtime-types';
import type { WallpaperSources } from './wallpaper-sources';
import type { WallpaperStorage } from './wallpaper-storage';

// What the preload reads for one mode to paint before the runtime starts.
interface WallpaperPreloadEntry {
  id: string;
  // A bundled file, with the full image's size when known.
  path?: string;
  width?: number;
  height?: number;
  // A network image's copy in the image cache.
  cachedImage?: { id: string; url: string };
  // Tomorrow's copy of a daily slot, for the first tab after midnight.
  next?: { day: string; cachedImage: { id: string; url: string } };
  // An upload in the local wallpaper library.
  customImage?: { id: string; key?: string };
  luminance?: number;
  luminanceKey?: string;
}

interface WallpaperPreloadCacheDeps extends Pick<WallpaperSources,
  'isCustomWallpaperId' | 'getWallpaperById' | 'getCachedWallpaperImage' | 'getShownWallpaperCopy' |
  'getWallpaperRuntimePath' | 'getDisplayedWallpaperImageUrl' | 'getWallpaperImageUrl' | 'getWallpaperSample'>,
  Pick<WallpaperStorage, 'getEffectiveWallpaperIdForMode'> {
  remoteClient: RemoteContentClient | null;
  window: Window;
  getEffectiveThemeMode(): string;
  getWallpaperEffectStorageValue(): WallpaperEffectStoragePrefs;
  choice: Pick<WallpaperChoice, 'state' | 'getResolvedWallpaperMode'>;
  overlay: Pick<WallpaperOverlay, 'opacity'>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function createWallpaperPreloadCache(deps: WallpaperPreloadCacheDeps) {
  const {
    isCustomWallpaperId,
    getWallpaperById,
    getCachedWallpaperImage,
    getShownWallpaperCopy,
    getWallpaperRuntimePath,
    getDisplayedWallpaperImageUrl,
    getWallpaperImageUrl,
    getWallpaperSample,
    getEffectiveWallpaperIdForMode,
    remoteClient,
    window,
    getEffectiveThemeMode,
    getWallpaperEffectStorageValue,
    choice,
    overlay
  } = deps;

  function getWallpaperPreloadEntryForMode(mode: WallpaperMode): WallpaperPreloadEntry | null {
    const wallpaper = getWallpaperById(getEffectiveWallpaperIdForMode(mode));
    const entry = getWallpaperPreloadImageEntry(wallpaper);
    const luminanceKey = getWallpaperLuminanceKey(wallpaper);
    const luminance = wallpaperLuminances.get(luminanceKey);
    if (!entry || !isWallpaperLuminance(luminance)) {
      return entry;
    }
    entry.luminance = luminance;
    entry.luminanceKey = luminanceKey;
    return entry;
  }

  function getWallpaperPreloadImageEntry(wallpaper: WallpaperItem | null): WallpaperPreloadEntry | null {
    // Online photos and links cannot paint on the first frame, but the preload reads this device's
    // IndexedDB copy while the page is still parsing.
    if (wallpaper && isLinkWallpaperId(wallpaper.id)) {
      const url = wallpaper.url || '';
      return getCachedWallpaperImage(wallpaper.id, url)
        ? { id: wallpaper.id, cachedImage: { id: wallpaper.id, url } }
        : null;
    }
    if (wallpaper && REMOTE_CONTENT.wallpaperFromId(wallpaper.id)) {
      const copy = getShownWallpaperCopy(wallpaper);
      // Tomorrow's copy, once cached, lets the first tab after midnight open on the new photo.
      const upcoming = getUpcomingDailyWallpaper(wallpaper.id);
      const next = upcoming && getCachedWallpaperImage(upcoming.id, upcoming.imageUrl);
      if (!copy && !next) return null;
      const entry: WallpaperPreloadEntry = { id: wallpaper.id };
      if (copy) entry.cachedImage = { id: copy.id, url: copy.url };
      if (next) {
        entry.next = { day: REMOTE_CONTENT.localDay(getNextLocalDayTimestamp(Date.now())),
          cachedImage: { id: next.id, url: next.url } };
      }
      return entry;
    }
    // An upload lives only in this device's IndexedDB; the preload reads it there by its record key.
    if (wallpaper && isCustomWallpaperId(wallpaper.id)) {
      const key = String(wallpaper.key || wallpaper.id);
      return { id: wallpaper.id, customImage: key === wallpaper.id ? { id: wallpaper.id } : { id: wallpaper.id, key } };
    }
    const path = wallpaper ? getWallpaperRuntimePath(wallpaper) : '';
    if (!wallpaper || !path) {
      return null;
    }
    // The full image's size, by which the preload places samples taken from its small copy.
    const sample = getWallpaperSample(wallpaper);
    return sample && sample.width
      ? { id: wallpaper.id, path, width: sample.width, height: sample.height }
      : { id: wallpaper.id, path };
  }

  // A daily photo keeps its catalog id while the image changes, so its luminance follows the photo
  // on screen, which is the previous copy until the new photo's is cached.
  function getWallpaperLuminanceKey(wallpaper: WallpaperItem | null): string {
    if (!wallpaper) {
      return '';
    }
    if (!REMOTE_CONTENT.wallpaperFromId(wallpaper.id)) {
      return wallpaper.id;
    }
    const copy = remoteClient ? getShownWallpaperCopy(wallpaper) : null;
    return copy ? copy.id : wallpaper.dailyId || wallpaper.id;
  }

  function readWallpaperPreloadLuminances(): Map<string, number> {
    const luminances = new Map<string, number>();
    try {
      const data: unknown = JSON.parse(window.localStorage.getItem(newtabWallpaperPreload.key) || 'null');
      const wallpapers = isRecord(data) && isRecord(data.wallpapers) ? data.wallpapers : {};
      NEWTAB_WALLPAPER_MODES.forEach((mode) => {
        const entry = wallpapers[mode];
        if (isRecord(entry) && typeof entry.luminanceKey === 'string' && entry.luminanceKey &&
            isWallpaperLuminance(entry.luminance)) {
          luminances.set(entry.luminanceKey, entry.luminance);
        }
      });
    } catch {
      // Only a head start; the next sample measures it again.
    }
    return luminances;
  }

  function isWallpaperLuminance(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
  }

  // Measured from the adaptive-tone sample, which already holds the shown image at a few hundred pixels.
  function rememberWallpaperLuminance(sampler: AdaptiveToneSampler | null | undefined): void {
    const wallpaper = getWallpaperById(choice.state.shownId);
    const key = getWallpaperLuminanceKey(wallpaper);
    const displayedUrl = getDisplayedWallpaperImageUrl(wallpaper);
    // A failed network photo shows the bundled default instead, whose luminance is not the photo's.
    if (!key || !sampler || !sampler.imageData || sampler.url !== displayedUrl ||
        displayedUrl !== getWallpaperImageUrl(wallpaper) ||
        wallpaperLuminances.has(key) || typeof WALLPAPER_EFFECTS.analyzeImageData !== 'function') {
      return;
    }
    const luminance = WALLPAPER_EFFECTS.analyzeImageData(sampler.imageData).averageLuminance;
    if (!isWallpaperLuminance(luminance)) {
      return;
    }
    wallpaperLuminances.set(key, Math.round(luminance * 1000) / 1000);
    // Previews in the wallpaper panel sample too; keep only the wallpapers a New Tab can open with.
    const shownKeys = NEWTAB_WALLPAPER_MODES.map((mode) => {
      return getWallpaperLuminanceKey(getWallpaperById(getEffectiveWallpaperIdForMode(mode)));
    });
    Array.from(wallpaperLuminances.keys()).forEach((cachedKey) => {
      if (!shownKeys.includes(cachedKey)) {
        wallpaperLuminances.delete(cachedKey);
      }
    });
    if (shownKeys.includes(key)) {
      writeWallpaperPreloadCache();
    }
  }

  function getWallpaperPreloadOverlayStops(): Record<WallpaperMode, { top: number; mid: number; bottom: number }> {
    const stopsFor = (mode: WallpaperMode) => {
      const stops = NEWTAB_WALLPAPER_OVERLAY_STOPS[mode];
      const opacity = overlay.opacity[mode];
      return {
        top: Number(getWallpaperOverlayStopPercent(stops.top, opacity).toFixed(1)),
        mid: Number(getWallpaperOverlayStopPercent(stops.mid, opacity).toFixed(1)),
        bottom: Number(getWallpaperOverlayStopPercent(stops.bottom, opacity).toFixed(1))
      };
    };
    return { light: stopsFor('light'), dark: stopsFor('dark') };
  }

  function writeWallpaperPreloadCache(): void {
    try {
      if (!window.localStorage) {
        return;
      }
      const wallpapers = {
        light: getWallpaperPreloadEntryForMode(NEWTAB_WALLPAPER_MODE_LIGHT),
        dark: getWallpaperPreloadEntryForMode(NEWTAB_WALLPAPER_MODE_DARK)
      };
      window.localStorage.setItem(newtabWallpaperPreload.key, JSON.stringify({
        version: PRELOAD_STORAGE_VERSION,
        mode: choice.getResolvedWallpaperMode(),
        themeMode: getEffectiveThemeMode(),
        wallpapers,
        overlayStops: getWallpaperPreloadOverlayStops(),
        wallpaperEffects: getWallpaperEffectStorageValue(),
        updatedAt: Date.now()
      }));
    } catch {
      // localStorage may be unavailable in constrained contexts; storage is only a fast-path cache.
    }
  }

  // Per wallpaper (getWallpaperLuminanceKey): its average luminance (0–1), kept in the preload cache
  // so the next page's blur frost blends by it without decoding the full image first.
  const wallpaperLuminances = readWallpaperPreloadLuminances();

  return {
    rememberWallpaperLuminance,
    writeWallpaperPreloadCache
  };
}

type WallpaperPreloadCache = ReturnType<typeof createWallpaperPreloadCache>;

export { createWallpaperPreloadCache };
export type { WallpaperPreloadCache };
