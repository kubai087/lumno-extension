// Starts the wallpaper effect over the preloaded wallpaper before the page's
// own scripts run, for wallpaper.ts to adopt.
import * as LumnoNewtabWallpaperEffects from '../dom/wallpaper-effects';
import type { WallpaperEffectPrefs } from '../dom/wallpaper-effects';
import type { WallpaperEffectPreloadRuntime } from './wallpaper-preload-types';
import { publishBootValue, readBootValue } from '../../platform/boot-handoff';

(function() {
  const root = document.documentElement;
  const body = document.body;
  const preloadState = readBootValue('wallpaperPreload');
  const effects = LumnoNewtabWallpaperEffects;
  if (!root ||
      !body ||
      !preloadState ||
      !preloadState.wallpaper ||
      !(preloadState.imageUrl || preloadState.imageReady) ||
      !preloadState.effectPrefsReady) {
    return;
  }
  // Narrowed here, for the callbacks below.
  const state = preloadState;

  const liveState = {
    onRender() {},
    shouldAnimateTransition: () => false
  };
  const preloadRuntime: WallpaperEffectPreloadRuntime = {
    claimed: false,
    controller: null,
    // When this script revealed the wallpaper (performance.now()); the entry starts a beat later.
    wallpaperShownAt: 0,
    attach(options) {
      const config = options || {};
      if (typeof config.onRender === 'function') {
        liveState.onRender = config.onRender;
      }
      if (typeof config.shouldAnimateTransition === 'function') {
        liveState.shouldAnimateTransition = config.shouldAnimateTransition;
      }
    },
    updateSource(wallpaper, imageUrl, sample) {
      state.wallpaper = wallpaper || null;
      state.imageUrl = String(imageUrl || '');
      state.sample = sample || null;
    }
  };
  publishBootValue('wallpaperEffectPreload', preloadRuntime);

  // Created up front so wallpaper.ts always adopts this controller instead of starting its own, slower
  // render; it renders nothing until the preferences and the image are known.
  const controller = effects.createWallpaperEffects({
    documentObj: document,
    windowObj: window,
    getCurrentWallpaper: () => state.wallpaper,
    getWallpaperImageUrl: () => state.imageUrl,
    getWallpaperSample: () => state.sample || null,
    shouldAnimateTransition: () => liveState.shouldAnimateTransition(),
    onRender: () => liveState.onRender(),
    // The luminance an earlier page measured belongs to the image this page preloaded.
    getLuminanceHint: (imageUrl) => {
      const luminance = state.luminance;
      if (typeof luminance !== 'number') {
        return null;
      }
      if (state.initialImageUrl) {
        return imageUrl === state.initialImageUrl ? luminance : null;
      }
      return state.runtimeApplied ? null : luminance;
    }
  });
  let runtimeAppliedPrefs = false;
  preloadRuntime.controller = {
    ...controller,
    apply(prefs: unknown) {
      runtimeAppliedPrefs = true;
      return controller.apply(prefs);
    }
  };

  let wallpaperMarkedReady = false;
  function markWallpaperReady(): void {
    if (!document.body || wallpaperMarkedReady) {
      return;
    }
    wallpaperMarkedReady = true;
    document.body.setAttribute('data-nt-wallpaper-ready', '1');
    preloadRuntime.wallpaperShownAt = globalThis.performance ? globalThis.performance.now() : 0;
  }

  // The page stays unpainted until this resolves, so the wallpaper and its effect appear together.
  function startEffects(prefs: WallpaperEffectPrefs, imageUrl: string): void {
    // Once wallpaper.ts applies its own preferences it also decides when the wallpaper is ready.
    if (preloadRuntime.claimed || runtimeAppliedPrefs || !imageUrl) {
      return;
    }
    const normalized = effects.resolvePrefsForMode(prefs, state.mode);
    if (normalized.type === 'none') {
      body.setAttribute('data-wallpaper-effect', 'none');
      markWallpaperReady();
      return;
    }

    body.setAttribute('data-wallpaper-active', 'true');
    body.setAttribute('data-wallpaper-effect', normalized.type);
    void controller.apply(normalized);
    void controller.refresh({ immediate: true }).then(markWallpaperReady);
  }

  // An online photo's IndexedDB copy may still be loading; without one, wallpaper.ts takes over.
  const imageReady = state.imageUrl ? null : state.imageReady;
  state.effectPrefsReady.then((prefs) => {
    if (!imageReady) {
      return startEffects(prefs, state.imageUrl);
    }
    return imageReady.then((imageUrl) => startEffects(prefs, imageUrl));
  }).catch(markWallpaperReady);
})();
