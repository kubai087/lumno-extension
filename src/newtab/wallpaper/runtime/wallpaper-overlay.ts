// The darkening overlay over the wallpaper: its opacity per mode, the
// slider snapping, the gradient stops, and saving and restoring it.
import type { WallpaperMode, WallpaperState } from './wallpaper-runtime-types';
import { newtabWallpaperOverlay } from '../../../domain/settings/newtab-wallpaper';
import type { SettingsStore } from '../../../platform/settings-store';
import { NEWTAB_WALLPAPER_OVERLAY_DEFAULTS, NEWTAB_WALLPAPER_OVERLAY_STOPS } from '../wallpaper-options';

// The saved overlay: a slider value (0-100) per mode.
interface WallpaperOverlayPrefs {
  version: number;
  light: number;
  dark: number;
}

interface WallpaperOverlayDeps {
  document: Document;
  clampNumber(value: unknown, min: number, max: number): number;
  renderWallpaperPanelState(): void;
  scheduleWallpaperAdaptiveToneUpdate(): void;
  writeWallpaperPreloadCache(): void;
  settings: Pick<SettingsStore, 'getStored' | 'include' | 'set'>;
  wallpaperState: Pick<WallpaperState,
    'currentWallpaperOverlayOpacity' | 'hasStoredWallpaperStateLoaded' | 'saveWallpaperStyleSetting'>;
}

const OVERLAY_MODES: readonly WallpaperMode[] = ['light', 'dark'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function createWallpaperOverlay(deps: WallpaperOverlayDeps) {
  const {
    settings,
    document,
    clampNumber,
    renderWallpaperPanelState,
    scheduleWallpaperAdaptiveToneUpdate,
    writeWallpaperPreloadCache
  } = deps;

  // The runtime state object shared with wallpaper.ts and the other modules.
  const wallpaperState = deps.wallpaperState;

  const NEWTAB_WALLPAPER_OVERLAY_STORAGE_VERSION = 2;
  const NEWTAB_WALLPAPER_OVERLAY_SNAP_POINTS = [0, 50, 100];
  const NEWTAB_WALLPAPER_OVERLAY_SNAP_THRESHOLD = 4;
  let initialWallpaperOverlayReadyPromise: Promise<void> | null = null;

  function normalizeWallpaperOverlayOpacity(value: unknown, fallback: unknown): number {
    const fallbackValue = Number.isFinite(Number(fallback)) ? Number(fallback) : 50;
    const parsed = Number.parseInt(String(value), 10);
    if (!Number.isFinite(parsed)) {
      return Math.max(0, Math.min(100, Math.round(fallbackValue)));
    }
    return Math.max(0, Math.min(100, parsed));
  }

  function snapWallpaperOverlaySliderValue(value: unknown): number {
    const normalized = normalizeWallpaperOverlayOpacity(value, 50);
    const target = NEWTAB_WALLPAPER_OVERLAY_SNAP_POINTS.find((point) => {
      const threshold = point === 100 ? 0 : NEWTAB_WALLPAPER_OVERLAY_SNAP_THRESHOLD;
      return Math.abs(normalized - point) <= threshold;
    });
    return typeof target === 'number' ? target : normalized;
  }

  function legacyWallpaperOverlayOpacityToSliderValue(value: unknown, fallback: number): number {
    return normalizeWallpaperOverlayOpacity(
      Math.round(normalizeWallpaperOverlayOpacity(value, 100) / 2),
      fallback
    );
  }

  function normalizeWallpaperOverlayPrefs(value: unknown): WallpaperOverlayPrefs {
    if (isRecord(value)) {
      if (value.version !== NEWTAB_WALLPAPER_OVERLAY_STORAGE_VERSION) {
        return {
          version: NEWTAB_WALLPAPER_OVERLAY_STORAGE_VERSION,
          light: legacyWallpaperOverlayOpacityToSliderValue(value.light, NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.light),
          dark: legacyWallpaperOverlayOpacityToSliderValue(value.dark, NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.dark)
        };
      }
      return {
        version: NEWTAB_WALLPAPER_OVERLAY_STORAGE_VERSION,
        light: normalizeWallpaperOverlayOpacity(value.light, NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.light),
        dark: normalizeWallpaperOverlayOpacity(value.dark, NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.dark)
      };
    }
    const shared = typeof value === 'undefined' || value === null
      ? NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.light
      : legacyWallpaperOverlayOpacityToSliderValue(value, NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.light);
    return {
      version: NEWTAB_WALLPAPER_OVERLAY_STORAGE_VERSION,
      light: shared,
      dark: shared
    };
  }

  function getResolvedWallpaperOverlayMode(): WallpaperMode {
    return document.body && document.body.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function getWallpaperOverlayOpacityForCurrentMode(): number {
    const mode = getResolvedWallpaperOverlayMode();
    return normalizeWallpaperOverlayOpacity(
      wallpaperState.currentWallpaperOverlayOpacity[mode],
      NEWTAB_WALLPAPER_OVERLAY_DEFAULTS[mode]
    );
  }

  function getWallpaperOverlayStopPercent(base: number, value: unknown): number {
    const basePercent = clampNumber(Number(base) || 0, 0, 100);
    const sliderValue = normalizeWallpaperOverlayOpacity(value, 50);
    if (sliderValue <= 50) {
      return basePercent * Math.pow(sliderValue / 50, 1.08);
    }
    const progress = (sliderValue - 50) / 50;
    return basePercent + ((100 - basePercent) * Math.pow(progress, 1.08));
  }

  function formatOverlayCssPercent(base: number, opacity: number): string {
    const value = getWallpaperOverlayStopPercent(base, opacity);
    return `${Number(value.toFixed(1))}%`;
  }

  function applyWallpaperOverlayOpacity(value: unknown): void {
    wallpaperState.currentWallpaperOverlayOpacity = normalizeWallpaperOverlayPrefs(value);
    const target = document.documentElement;
    if (target) {
      OVERLAY_MODES.forEach((mode) => {
        const stops = NEWTAB_WALLPAPER_OVERLAY_STOPS[mode];
        const opacity = wallpaperState.currentWallpaperOverlayOpacity[mode];
        target.style.setProperty(`--x-nt-wallpaper-overlay-${mode}-top`, formatOverlayCssPercent(stops.top, opacity));
        target.style.setProperty(`--x-nt-wallpaper-overlay-${mode}-mid`, formatOverlayCssPercent(stops.mid, opacity));
        target.style.setProperty(`--x-nt-wallpaper-overlay-${mode}-bottom`, formatOverlayCssPercent(stops.bottom, opacity));
      });
    }
    renderWallpaperPanelState();
    scheduleWallpaperAdaptiveToneUpdate();
    if (wallpaperState.hasStoredWallpaperStateLoaded) {
      writeWallpaperPreloadCache();
    }
  }

  function persistWallpaperOverlayOpacity(mode: unknown, value: unknown): void {
    const nextMode: WallpaperMode = mode === 'dark' ? 'dark' : 'light';
    const nextValue = normalizeWallpaperOverlayOpacity(value, wallpaperState.currentWallpaperOverlayOpacity[nextMode]);
    const nextPrefs: WallpaperOverlayPrefs = {
      version: NEWTAB_WALLPAPER_OVERLAY_STORAGE_VERSION,
      light: wallpaperState.currentWallpaperOverlayOpacity.light,
      dark: wallpaperState.currentWallpaperOverlayOpacity.dark,
      [nextMode]: nextValue
    };
    applyWallpaperOverlayOpacity(nextPrefs);
    wallpaperState.saveWallpaperStyleSetting('overlay', () => {
      void settings.set(newtabWallpaperOverlay, nextPrefs);
    });
  }
  function bootstrapInitialWallpaperOverlay(): Promise<void> {
    if (initialWallpaperOverlayReadyPromise) {
      return initialWallpaperOverlayReadyPromise;
    }
    // An invalid stored value is written back normalized.
    initialWallpaperOverlayReadyPromise = settings.include(newtabWallpaperOverlay).then(() => {
      const raw = settings.getStored(newtabWallpaperOverlay);
      const prefs = normalizeWallpaperOverlayPrefs(raw);
      applyWallpaperOverlayOpacity(prefs);
      if (raw && JSON.stringify(raw) !== JSON.stringify(prefs)) {
        void settings.set(newtabWallpaperOverlay, prefs);
      }
    });
    return initialWallpaperOverlayReadyPromise;
  }

  return {
    normalizeWallpaperOverlayOpacity,
    snapWallpaperOverlaySliderValue,
    getResolvedWallpaperOverlayMode,
    getWallpaperOverlayOpacityForCurrentMode,
    getWallpaperOverlayStopPercent,
    applyWallpaperOverlayOpacity,
    persistWallpaperOverlayOpacity,
    bootstrapInitialWallpaperOverlay
  };
}

type WallpaperOverlay = ReturnType<typeof createWallpaperOverlay>;

export { createWallpaperOverlay };
export type { WallpaperOverlay, WallpaperOverlayDeps, WallpaperOverlayPrefs };
