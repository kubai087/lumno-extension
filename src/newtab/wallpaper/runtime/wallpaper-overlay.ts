// The darkening overlay over the wallpaper: its opacity per mode, the
// slider snapping, the gradient stops, and saving and restoring it. Views
// that show the opacity, and the tones that depend on it, follow its store.
import type { WallpaperMode } from './wallpaper-runtime-types';
import { newtabWallpaperOverlay } from '../../../domain/settings/newtab-wallpaper';
import type { SettingsStore } from '../../../platform/settings-store';
import { createStore } from '../../../shared/state/store';
import type { Store } from '../../../shared/state/store';
import { clampNumber } from '../wallpaper-effect-pixels';
import { NEWTAB_WALLPAPER_OVERLAY_DEFAULTS, NEWTAB_WALLPAPER_OVERLAY_STOPS } from '../wallpaper-options';
import { createDebouncedSaver } from './debounced-saver';

// The saved overlay: a slider value (0-100) per mode.
interface WallpaperOverlayPrefs {
  version: number;
  light: number;
  dark: number;
}

interface WallpaperOverlayState {
  opacity: Record<WallpaperMode, number>;
}

const OVERLAY_MODES: readonly WallpaperMode[] = ['light', 'dark'];
const OVERLAY_STORAGE_VERSION = 2;
const OVERLAY_SNAP_POINTS = [0, 50, 100];
const OVERLAY_SNAP_THRESHOLD = 4;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

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
  const target = OVERLAY_SNAP_POINTS.find((point) => {
    const threshold = point === 100 ? 0 : OVERLAY_SNAP_THRESHOLD;
    return Math.abs(normalized - point) <= threshold;
  });
  return typeof target === 'number' ? target : normalized;
}

function legacyOpacityToSliderValue(value: unknown, fallback: number): number {
  return normalizeWallpaperOverlayOpacity(
    Math.round(normalizeWallpaperOverlayOpacity(value, 100) / 2),
    fallback
  );
}

function normalizeOverlayPrefs(value: unknown): WallpaperOverlayPrefs {
  if (isRecord(value)) {
    if (value.version !== OVERLAY_STORAGE_VERSION) {
      return {
        version: OVERLAY_STORAGE_VERSION,
        light: legacyOpacityToSliderValue(value.light, NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.light),
        dark: legacyOpacityToSliderValue(value.dark, NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.dark)
      };
    }
    return {
      version: OVERLAY_STORAGE_VERSION,
      light: normalizeWallpaperOverlayOpacity(value.light, NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.light),
      dark: normalizeWallpaperOverlayOpacity(value.dark, NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.dark)
    };
  }
  const shared = typeof value === 'undefined' || value === null
    ? NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.light
    : legacyOpacityToSliderValue(value, NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.light);
  return {
    version: OVERLAY_STORAGE_VERSION,
    light: shared,
    dark: shared
  };
}

// How dark a gradient stop (a base percent) is at a slider value: the base
// at 50, clear at 0 and opaque at 100.
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

class WallpaperOverlay {
  readonly store: Store<WallpaperOverlayState> = createStore<WallpaperOverlayState>({
    opacity: { light: NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.light, dark: NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.dark }
  });
  private readonly document: Document;
  private readonly settings: Pick<SettingsStore, 'getStored' | 'include' | 'set'>;
  private readonly saveStyleSetting: ReturnType<typeof createDebouncedSaver>;
  private initialReady: Promise<void> | null = null;

  constructor(document: Document, windowObj: Window, settings: Pick<SettingsStore, 'getStored' | 'include' | 'set'>) {
    this.document = document;
    this.settings = settings;
    this.saveStyleSetting = createDebouncedSaver(windowObj, 120);
  }

  get opacity(): Record<WallpaperMode, number> {
    return this.store.getSnapshot().opacity;
  }

  // The overlay follows the page's color mode.
  readonly getResolvedMode = (): WallpaperMode => {
    const body = this.document.body;
    return body && body.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  };

  readonly getOpacityForCurrentMode = (): number => {
    const mode = this.getResolvedMode();
    return normalizeWallpaperOverlayOpacity(this.opacity[mode], NEWTAB_WALLPAPER_OVERLAY_DEFAULTS[mode]);
  };

  readonly apply = (value: unknown): void => {
    const prefs = normalizeOverlayPrefs(value);
    const target = this.document.documentElement;
    if (target) {
      OVERLAY_MODES.forEach((mode) => {
        const stops = NEWTAB_WALLPAPER_OVERLAY_STOPS[mode];
        const opacity = prefs[mode];
        target.style.setProperty(`--x-nt-wallpaper-overlay-${mode}-top`, formatOverlayCssPercent(stops.top, opacity));
        target.style.setProperty(`--x-nt-wallpaper-overlay-${mode}-mid`, formatOverlayCssPercent(stops.mid, opacity));
        target.style.setProperty(`--x-nt-wallpaper-overlay-${mode}-bottom`, formatOverlayCssPercent(stops.bottom, opacity));
      });
    }
    this.store.setState({ opacity: { light: prefs.light, dark: prefs.dark } });
  };

  readonly persist = (mode: unknown, value: unknown): void => {
    const nextMode: WallpaperMode = mode === 'dark' ? 'dark' : 'light';
    const nextPrefs: WallpaperOverlayPrefs = {
      version: OVERLAY_STORAGE_VERSION,
      light: this.opacity.light,
      dark: this.opacity.dark,
      [nextMode]: normalizeWallpaperOverlayOpacity(value, this.opacity[nextMode])
    };
    this.apply(nextPrefs);
    this.saveStyleSetting('overlay', () => {
      void this.settings.set(newtabWallpaperOverlay, nextPrefs);
    });
  };

  // An invalid stored value is written back normalized.
  readonly bootstrap = (): Promise<void> => {
    if (!this.initialReady) {
      this.initialReady = this.settings.include(newtabWallpaperOverlay).then(() => {
        const raw = this.settings.getStored(newtabWallpaperOverlay);
        const prefs = normalizeOverlayPrefs(raw);
        this.apply(prefs);
        if (raw && JSON.stringify(raw) !== JSON.stringify(prefs)) {
          void this.settings.set(newtabWallpaperOverlay, prefs);
        }
      });
    }
    return this.initialReady;
  };
}

export {
  WallpaperOverlay,
  getWallpaperOverlayStopPercent,
  normalizeWallpaperOverlayOpacity,
  snapWallpaperOverlaySliderValue
};
export type { WallpaperOverlayState };
