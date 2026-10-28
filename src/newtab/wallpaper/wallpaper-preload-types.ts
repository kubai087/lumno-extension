// What the wallpaper preload scripts hand the New Tab page: the wallpaper
// painted before the page's own scripts run, and the effect layer already
// drawing over it.
import type { WallpaperEffectPrefs, WallpaperEffects, WallpaperSample } from './wallpaper-effects';

// The shape of the stored preload record; a record of another version is ignored.
const PRELOAD_STORAGE_VERSION = 4;

type WallpaperMode = 'light' | 'dark';

// An image record read from one of the page's IndexedDB stores, holding the
// image as a data URL; its other fields are left for the page to read.
type PreloadImageRecord = Record<string, unknown> & { imageDataUrl: string };

// The wallpaper the preload painted, as far as it knows it.
interface PreloadWallpaper {
  id: string;
  // A bundled wallpaper's file.
  path?: string;
}

// The wallpaper's small copy being decoded for tone sampling; url is the
// full image it stands for.
interface PreloadDecodedImage {
  url: string;
  ready: Promise<HTMLImageElement | null>;
}

// A blob URL made for a large data URL, which the page adopts instead of
// making its own.
interface PreloadObjectUrl {
  source: string;
  url: string;
}

interface WallpaperPreloadState {
  effectPrefsReady: Promise<WallpaperEffectPrefs>;
  // The URL of the image this page preloaded, once known; the luminance
  // belongs to it. Unlike imageUrl, the page never changes it.
  initialImageUrl: string;
  // The wallpaper's average luminance (0-1) measured on an earlier page.
  luminance: number | null;
  mode: WallpaperMode;
  imageUrl: string;
  sample: WallpaperSample | null;
  decodedImage: PreloadDecodedImage | null;
  wallpaper: PreloadWallpaper | null;
  // A wallpaper read from this device's IndexedDB: the URL it paints with
  // once read, the record itself, and the upload's ID when it is one.
  imageReady?: Promise<string> | null;
  cachedImageRecord?: PreloadImageRecord | null;
  customImageId?: string;
  cssObjectUrl?: PreloadObjectUrl | null;
  // Set by the page once it paints the wallpaper itself.
  runtimeApplied?: boolean;
}

// The effect layer the effect preload started, for the page to adopt.
interface WallpaperEffectPreloadRuntime {
  // Set by the page when it starts its own effect layer instead.
  claimed: boolean;
  controller: WallpaperEffects | null;
  // When the preload revealed the wallpaper (performance.now()).
  wallpaperShownAt: number;
  attach(options?: { onRender?: () => void; shouldAnimateTransition?: () => boolean } | null): void;
  updateSource(wallpaper: PreloadWallpaper | null | undefined, imageUrl: unknown, sample: WallpaperSample | null | undefined): void;
}

export type {
  PreloadDecodedImage,
  PreloadImageRecord,
  PreloadObjectUrl,
  PreloadWallpaper,
  WallpaperEffectPreloadRuntime,
  WallpaperMode,
  WallpaperPreloadState
};

export { PRELOAD_STORAGE_VERSION };
