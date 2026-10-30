// Runs the New Tab's wallpaper preload (wallpaper-preload.ts) fresh, as the
// page's <head> runs it, against what an earlier page cached on this device,
// and reads what it handed to the page's own scripts.
import { vi } from 'vitest';
import { readBootValue } from '../../../src/platform/boot-handoff';
import type { WallpaperPreloadState } from '../../../src/newtab/wallpaper/wallpaper-preload-types';

const WALLPAPER_PRELOAD_STORAGE_KEY = '_x_extension_newtab_wallpaper_preload_2026_unique_';
const WALLPAPER_PRELOAD_STORAGE_VERSION = 4;

// Stores what an earlier page cached for the preload.
function cacheWallpaperPreload(value: unknown): void {
  localStorage.setItem(WALLPAPER_PRELOAD_STORAGE_KEY, JSON.stringify(value));
}

// A cache entry for one shown wallpaper in light mode, with no mask.
function lightPreloadCache(light: unknown, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: WALLPAPER_PRELOAD_STORAGE_VERSION,
    mode: 'light',
    themeMode: 'light',
    overlayStops: { light: { top: 0, mid: 0, bottom: 0 }, dark: { top: 0, mid: 0, bottom: 0 } },
    wallpapers: { light, dark: null },
    ...extra
  };
}

async function runWallpaperPreload(): Promise<WallpaperPreloadState | undefined> {
  Reflect.deleteProperty(globalThis, '__lumnoBoot');
  vi.resetModules();
  await import('../../../src/newtab/dom/wallpaper-preload');
  return readBootValue('wallpaperPreload');
}

export {
  WALLPAPER_PRELOAD_STORAGE_KEY,
  WALLPAPER_PRELOAD_STORAGE_VERSION,
  cacheWallpaperPreload,
  lightPreloadCache,
  runWallpaperPreload
};
