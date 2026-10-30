// The wallpaper runtime (wallpaper.ts) over an in-memory browser
// (tests/fakes/browser.ts) and the page's real settings store, with the
// panel drawn by the recording view (wallpaper-view-recorder.fixtures.ts),
// which each test file mocks the React view with.
import { afterEach, vi } from 'vitest';
import { createWallpaperRuntime } from '../../../src/newtab/wallpaper/wallpaper';
import type { WallpaperRuntime, WallpaperRuntimeOptions } from '../../../src/newtab/wallpaper/wallpaper';
import { getRecordingPanel } from './view-recorder';
import type { RecordingPanel } from './view-recorder';
import type { OnlineTileState, TileState, WallpaperPanelActions, WallpaperPanelState } from '../../../src/newtab/react/wallpaper-view';
import { ALL_SETTINGS } from '../../../src/domain/settings/registry';
import * as LumnoFeatureHints from '../../../src/shared/ui/feature-hints';
import { createSettingsStore } from '../../../src/platform/settings-store';
import type { SettingsStore } from '../../../src/platform/settings-store';
import { SettingPreview } from '../../../src/newtab/setting-preview';
import { createBrowserFake } from '../browser';
import type { BrowserFake } from '../browser';
import { required } from '../dom';

// The storage keys the runtime keeps its choices under.
const STORAGE_KEYS = Object.freeze({
  wallpaper: '_x_extension_newtab_wallpaper_2026_unique_',
  localWallpaper: '_x_extension_newtab_local_wallpaper_2026_unique_',
  onlineWallpaper: '_x_extension_newtab_online_wallpaper_2026_unique_',
  linkWallpapers: '_x_extension_newtab_link_wallpapers_2026_unique_',
  dailyPicks: '_x_extension_newtab_daily_wallpaper_picks_2026_unique_',
  curatedMixExcluded: '_x_extension_newtab_curated_mix_excluded_2026_unique_',
  overlay: '_x_extension_newtab_wallpaper_overlay_2026_unique_',
  effect: '_x_extension_newtab_wallpaper_effect_2026_unique_',
  favicon: '_x_extension_newtab_favicon_2026_unique_',
  faviconPreload: '_x_extension_newtab_favicon_preload_2026_unique_',
  wallpaperPreload: '_x_extension_newtab_wallpaper_preload_2026_unique_'
});
const WALLPAPER_PRELOAD_STORAGE_VERSION = 4;
const DEFAULT_WALLPAPER_ID = 'monet-coastal-white';
const WALLPAPER_PREFS_STORAGE_VERSION = 2;
const CUSTOM_WALLPAPER_ID_PREFIX = 'custom-wallpaper-';
const LOCAL_WALLPAPER_DISABLED_VALUE = '__lumno_local_wallpaper_disabled__';

// A slider moved by pointer, and a value typed or keyed in.
const NOT_DRAGGING = Object.freeze({ dragging: false, final: false });
const TYPED = Object.freeze({ dragging: false, final: true });

// matchMedia, whose answers a test sets; reduced motion is on, so panel
// motion settles at once.
function installMatchMedia() {
  const matches = new Map<string, boolean>();
  const listeners = new Map<string, Set<(event: { matches: boolean; media: string }) => void>>();
  const listenersOf = (query: string) => {
    let set = listeners.get(query);
    if (!set) {
      set = new Set();
      listeners.set(query, set);
    }
    return set;
  };
  const matchesQuery = (query: string) => matches.get(query) ?? query.includes('prefers-reduced-motion');
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return matchesQuery(query);
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: (event: { matches: boolean; media: string }) => void) => listenersOf(query).add(listener),
    removeEventListener: (_type: string, listener: (event: { matches: boolean; media: string }) => void) => listenersOf(query).delete(listener),
    addListener: (listener: (event: { matches: boolean; media: string }) => void) => listenersOf(query).add(listener),
    removeListener: (listener: (event: { matches: boolean; media: string }) => void) => listenersOf(query).delete(listener),
    dispatchEvent: () => true
  }));
  return {
    // Changes the answer and tells the listeners.
    set(query: string, value: boolean) {
      matches.set(query, value);
      listenersOf(query).forEach((listener) => listener({ matches: value, media: query }));
    },
    // Changes the answer without telling anyone, as before a page loads.
    setSilently(query: string, value: boolean) {
      matches.set(query, value);
    }
  };
}

// BroadcastChannel between the runtimes of one test.
function installBroadcastChannel() {
  const channels = new Map<string, Set<FakeBroadcastChannel>>();
  class FakeBroadcastChannel extends EventTarget {
    readonly name: string;
    onmessage: ((event: MessageEvent) => void) | null = null;

    constructor(name: string) {
      super();
      this.name = String(name);
      const peers = channels.get(this.name) || new Set();
      peers.add(this);
      channels.set(this.name, peers);
    }

    postMessage(data: unknown): void {
      (channels.get(this.name) || new Set()).forEach((peer) => {
        if (peer === this) return;
        const event = new MessageEvent('message', { data });
        if (peer.onmessage) peer.onmessage(event);
        peer.dispatchEvent(event);
      });
    }

    close(): void {
      const peers = channels.get(this.name);
      if (peers) peers.delete(this);
    }
  }
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
}

interface RuntimeHarnessOptions extends Partial<WallpaperRuntimeOptions> {
  sync?: Record<string, unknown>;
  local?: Record<string, unknown>;
  browser?: BrowserFake;
  // Settings shared with another runtime, as two tabs share storage.
  settings?: SettingsStore;
}

interface RuntimeHarness {
  runtime: WallpaperRuntime;
  browser: BrowserFake;
  settings: SettingsStore;
  preview: SettingPreview;
}

const noFeatureHints: typeof LumnoFeatureHints = { ...LumnoFeatureHints, createFeatureHint: () => null };

// Calls the setter, then tells the preview's subscribers.
function notifying<A extends unknown[]>(setter: ((...args: A) => void) | undefined, notify: () => void) {
  return setter ? (...args: A) => {
    setter(...args);
    notify();
  } : undefined;
}

async function createRuntime(options: RuntimeHarnessOptions = {}): Promise<RuntimeHarness> {
  const { sync, local, browser: givenBrowser, settings: givenSettings, ...runtimeOptions } = options;
  const browser = givenBrowser || createBrowserFake({ sync, local });
  const settings = givenSettings || createSettingsStore({ chromeApi: browser, settings: ALL_SETTINGS, windowObj: window });
  await settings.ready;
  const preview = new SettingPreview(settings);
  const touchPreview = () => preview.store.setState({ values: new Map(preview.store.getSnapshot().values) });
  // The page's layout setters write through its preview, which tells its subscribers.
  const layoutSetters: Partial<WallpaperRuntimeOptions> = {
    setSearchWidth: notifying(runtimeOptions.setSearchWidth, touchPreview),
    setShortcutColumns: notifying(runtimeOptions.setShortcutColumns, touchPreview),
    setShortcutSize: notifying(runtimeOptions.setShortcutSize, touchPreview),
    setShortcutGap: notifying(runtimeOptions.setShortcutGap, touchPreview),
    setShortcutsVisible: notifying(runtimeOptions.setShortcutsVisible, touchPreview),
    setShortcutAddVisible: notifying(runtimeOptions.setShortcutAddVisible, touchPreview),
    setShortcutDockMagnificationEnabled: notifying(runtimeOptions.setShortcutDockMagnificationEnabled, touchPreview)
  };
  const runtime = createWallpaperRuntime({
    chromeObj: browser,
    localWallpaperStorageArea: browser.storage.local,
    featureHints: noFeatureHints,
    t: (_key, fallback) => fallback || '',
    ...runtimeOptions,
    ...layoutSetters,
    settings,
    preview
  });
  return { runtime, browser, settings, preview };
}

function panelOf(runtime: WallpaperRuntime): RecordingPanel {
  return getRecordingPanel(runtime.getControlElement());
}

function panelState(runtime: WallpaperRuntime): WallpaperPanelState {
  return panelOf(runtime).state;
}

function panelActions(runtime: WallpaperRuntime): WallpaperPanelActions {
  return panelState(runtime).actions;
}

function openPanel(runtime: WallpaperRuntime): void {
  if (!runtime.isPanelOpen()) panelActions(runtime).togglePanel();
}

type SourcedTile = (TileState | OnlineTileState) & { source: 'built-in' | 'local' | 'bing' | 'curated' };

function findTile(runtime: WallpaperRuntime, id: string): SourcedTile | null {
  const { wallpaper } = panelState(runtime);
  const sources: Array<[SourcedTile['source'], ReadonlyArray<TileState | OnlineTileState>]> = [
    ['built-in', wallpaper.builtIn.tiles],
    ['local', wallpaper.local.tiles],
    ['bing', wallpaper.bing.tiles],
    ['curated', wallpaper.curated.tiles]
  ];
  for (const [source, tiles] of sources) {
    const tile = tiles.find((item) => item.id === id);
    if (tile) return { ...tile, source };
  }
  return null;
}

function clickTile(runtime: WallpaperRuntime, id: string): void {
  const tile = required(findTile(runtime, id), `the ${id} tile`);
  const actions = panelActions(runtime);
  if (tile.source === 'bing') actions.selectBingWallpaper(id);
  else if (tile.source === 'curated') actions.selectCuratedWallpaper(id);
  else actions.selectWallpaper(id);
}

// The wallpaper the page shows, as --x-nt-wallpaper-image holds it.
function shownWallpaperImage(): string {
  return document.documentElement.style.getPropertyValue('--x-nt-wallpaper-image');
}

// What the runtime cached for the next page's preload.
function readPreloadCache(): unknown {
  const raw = localStorage.getItem(STORAGE_KEYS.wallpaperPreload);
  return raw ? JSON.parse(raw) : null;
}

// Plain data, for comparing values the runtime built from storage.
function clonePlain(value: unknown): unknown {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

afterEach(() => {
  Array.from(document.documentElement.attributes)
    .filter((attribute) => attribute.name !== 'lang')
    .forEach((attribute) => document.documentElement.removeAttribute(attribute.name));
  Array.from(document.body.attributes).forEach((attribute) => document.body.removeAttribute(attribute.name));
  document.head.replaceChildren();
  localStorage.clear();
  sessionStorage.clear();
  Reflect.deleteProperty(globalThis, '__lumnoBoot');
  vi.unstubAllGlobals();
});

export {
  CUSTOM_WALLPAPER_ID_PREFIX,
  DEFAULT_WALLPAPER_ID,
  LOCAL_WALLPAPER_DISABLED_VALUE,
  NOT_DRAGGING,
  STORAGE_KEYS,
  TYPED,
  WALLPAPER_PREFS_STORAGE_VERSION,
  WALLPAPER_PRELOAD_STORAGE_VERSION,
  clickTile,
  clonePlain,
  createRuntime,
  findTile,
  installBroadcastChannel,
  installMatchMedia,
  openPanel,
  panelActions,
  panelOf,
  panelState,
  readPreloadCache,
  shownWallpaperImage
};
export type { RuntimeHarness, RuntimeHarnessOptions, SourcedTile };
