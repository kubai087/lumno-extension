// The values scripts hand each other on globalThis, and browser APIs the
// TypeScript DOM library does not describe yet. Only three globals carry
// values: the boot handoff (src/platform/boot-handoff.ts), the content
// registry (src/platform/content-registry.ts) and the worker's lazy module
// registry (src/platform/worker-lazy.ts, untyped here: its scripts publish
// unchecked values the worker narrows).
import type { WallpaperEffectPreloadRuntime, WallpaperPreloadState } from '../newtab/wallpaper/wallpaper-preload-types';
import type { HeldViewTransition } from '../newtab/focus-resume';
import type { StorageReadPrefetch } from '../platform/settings-storage';

declare global {
  // The EyeDropper API, which Chromium has and TypeScript's DOM library
  // does not describe yet.
  interface EyeDropperResult {
    sRGBHex: string;
  }
  interface EyeDropperInstance {
    open(options?: { signal?: AbortSignal }): Promise<EyeDropperResult>;
  }
  interface Window {
    EyeDropper?: new () => EyeDropperInstance;
  }
  // Uint8Array.fromBase64, which newer browsers have and TypeScript's
  // library does not describe yet.
  interface Uint8ArrayConstructor {
    fromBase64?(base64: string): Uint8Array<ArrayBuffer>;
  }
  // What a page's preload scripts hand to the page's own scripts; read and
  // written only through src/platform/boot-handoff.ts.
  interface LumnoBootHandoff {
    // The last New Tab's locale messages, fetched by
    // src/newtab/newtab-storage-prefetch.ts before the page's scripts load.
    localePrefetch?: { locale: string; messages: Promise<unknown> };
    // Whether motion effects are on, as first read by src/shared/motion-preload.ts.
    motionPreferenceReady?: Promise<boolean>;
    // Set by src/newtab/wallpaper/wallpaper-preload.ts when it painted a
    // wallpaper, and by wallpaper-effect-preload.ts when it started the effect.
    wallpaperPreload?: WallpaperPreloadState;
    wallpaperEffectPreload?: WallpaperEffectPreloadRuntime;
    // Storage reads a preload started, by the storage area they read
    // (src/platform/settings-storage.ts).
    storageReadPrefetches?: WeakMap<object, StorageReadPrefetch>;
    // The view transition a focus-resume reload holds until the page has
    // rebuilt its search (src/newtab/focus-resume.ts).
    focusResumeTransition?: HeldViewTransition | null;
  }
  var __lumnoBoot: LumnoBootHandoff | undefined;
  // What the extension's scripts in a page's isolated world share; read and
  // written only through src/platform/content-registry.ts, and read by the
  // worker's injected functions.
  interface LumnoContentRegistry {
    // The classic content scripts that already run in this world.
    claimed: Record<string, true>;
    // Whether the search overlay is open; absent until the overlay loads.
    overlayOpen?: boolean;
    // Whether the page clip picker has the page in its PiP window.
    documentPipActive?: boolean;
    // The overlay font faces registered at document start, read as untrusted
    // (src/shared/overlay-font-faces.ts).
    earlyOverlayFontFaces?: unknown;
    // The keys the shortcut observer held while the overlay was opening
    // (src/content/overlay-type-ahead.ts).
    overlayTypeAhead?: { take(): string };
  }
  var __lumnoContent: LumnoContentRegistry | undefined;
}

