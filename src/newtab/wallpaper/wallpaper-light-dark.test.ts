import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CUSTOM_WALLPAPER_ID_PREFIX,
  DEFAULT_WALLPAPER_ID,
  LOCAL_WALLPAPER_DISABLED_VALUE,
  STORAGE_KEYS,
  WALLPAPER_PREFS_STORAGE_VERSION,
  WALLPAPER_PRELOAD_STORAGE_VERSION,
  clickTile,
  createRuntime,
  findTile,
  installBroadcastChannel,
  installMatchMedia,
  openPanel,
  panelActions,
  panelState,
  readPreloadCache,
  shownWallpaperImage
} from '../../../tests/fakes/wallpaper/runtime';
import { installUploads, settleTasks, upload } from '../../../tests/fakes/wallpaper/uploads';
import { createWallpaperAdaptiveTone } from './wallpaper-adaptive-tone';
import type { WallpaperRuntime } from './wallpaper';
import { createBrowserFake } from '../../../tests/fakes/browser';
import { installCanvasFake, installImageFake } from '../../../tests/fakes/canvas';
import { required } from '../../../tests/fakes/dom';

vi.mock('../react/wallpaper-view', async () => ({
  createWallpaperViewController: (await import('../../../tests/fakes/wallpaper/view-recorder')).createRecordingWallpaperView
}));

// The tones never hand the runtime a sampler of their own: a test hands it
// the one it means, and a runtime left from an earlier test caches nothing.
vi.mock('./wallpaper-adaptive-tone', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./wallpaper-adaptive-tone')>();
  return {
    ...actual,
    createWallpaperAdaptiveTone: vi.fn((options: Parameters<typeof actual.createWallpaperAdaptiveTone>[0]) =>
      actual.createWallpaperAdaptiveTone({ ...options, onSamplerReady: undefined }))
  };
});

beforeEach(() => {
  installMatchMedia();
  installBroadcastChannel();
  installImageFake();
  installCanvasFake();
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// The preload cache's entry for one mode.
function preloadEntry(mode: string): Record<string, unknown> {
  const cache = readPreloadCache();
  const wallpapers = isRecord(cache) ? cache.wallpapers : null;
  const entry = isRecord(wallpapers) ? wallpapers[mode] : null;
  return isRecord(entry) ? entry : {};
}

function splitPrefs(light: string, dark: string) {
  return { version: WALLPAPER_PREFS_STORAGE_VERSION, sameForModes: false, light, dark };
}

async function openedRuntime(runtime: WallpaperRuntime): Promise<WallpaperRuntime> {
  await runtime.bootstrapInitialWallpaper();
  runtime.createControls();
  openPanel(runtime);
  return runtime;
}

describe('matching light and dark mode', () => {
  it('is on for a legacy wallpaper, and turning it off copies the choice to both modes', async () => {
    const { runtime, browser } = await createRuntime({ sync: { [STORAGE_KEYS.wallpaper]: 'white-shanshui' } });
    await openedRuntime(runtime);
    const wallpaper = () => panelState(runtime).wallpaper;
    expect(wallpaper().modeSync.title).toBe('Match light and dark mode');
    expect(wallpaper().modeSync.toggle.checked).toBe(true);
    expect(wallpaper().mode.visible).toBe(false);

    panelActions(runtime).setModeSync(false);

    await vi.waitFor(() => expect(browser.storage.sync.values[STORAGE_KEYS.wallpaper])
      .toEqual(splitPrefs('white-shanshui', 'white-shanshui')));
    expect(document.body.getAttribute('data-wallpaper-active')).toBe('true');
    expect(shownWallpaperImage()).toContain('lumno-newtab-white-shanshui.webp');
    expect(wallpaper().modeSync.toggle.checked).toBe(false);
    expect(wallpaper().mode.visible).toBe(true);
    expect(wallpaper().mode.label).toBe('Mode');
    expect(wallpaper().mode.tabs.options.map((option) => [option.value, option.label, option.ariaLabel]))
      .toEqual([['light', 'Light', 'Edit Light wallpaper'], ['dark', 'Dark', 'Edit Dark wallpaper']]);
  });

  it('turned off, ignores and clears a stale local "disabled" marker', async () => {
    document.body.setAttribute('data-theme', 'dark');
    const { runtime, browser } = await createRuntime({
      sync: { [STORAGE_KEYS.wallpaper]: 'white-shanshui' },
      local: {
        [STORAGE_KEYS.localWallpaper]: { version: WALLPAPER_PREFS_STORAGE_VERSION, light: '', dark: LOCAL_WALLPAPER_DISABLED_VALUE }
      }
    });
    await openedRuntime(runtime);

    panelActions(runtime).setModeSync(false);

    await vi.waitFor(() => expect(browser.storage.sync.values[STORAGE_KEYS.wallpaper])
      .toEqual(splitPrefs('white-shanshui', 'white-shanshui')));
    await vi.waitFor(() => expect(browser.storage.local.values[STORAGE_KEYS.localWallpaper]).toBe(''));
    await settleTasks();
    expect(document.body.getAttribute('data-wallpaper-active')).toBe('true');
  });
});

describe('separate light and dark wallpapers', () => {
  // A dark page that opened the panel on Light took every filter change to
  // the light wallpaper, and the one on screen never changed.
  it('open the panel on the mode the page shows', async () => {
    document.body.setAttribute('data-theme', 'dark');
    const { runtime, browser } = await createRuntime({
      sync: { [STORAGE_KEYS.wallpaper]: splitPrefs('white-shanshui', 'dark-shanshui-moonlit') }
    });
    await openedRuntime(runtime);
    const wallpaper = () => panelState(runtime).wallpaper;
    expect(wallpaper().mode.visible).toBe(true);
    expect(wallpaper().mode.tabs.active).toBe('dark');

    panelActions(runtime).selectEffect('halftone');
    expect(document.body.getAttribute('data-wallpaper-effect')).toBe('halftone');
    await vi.waitFor(() => expect(browser.storage.sync.values[STORAGE_KEYS.effect])
      .toMatchObject({ dark: { type: 'halftone' } }));
    expect(browser.storage.sync.values[STORAGE_KEYS.effect]).not.toMatchObject({ light: { type: 'halftone' } });

    panelActions(runtime).selectWallpaperMode('light');
    expect(wallpaper().mode.tabs.active).toBe('light');
    runtime.closePanel();
    openPanel(runtime);
    expect(wallpaper().mode.tabs.active).toBe('dark');
  });

  it('show the light one in light mode, edit the dark one apart, and switch with the theme', async () => {
    document.body.setAttribute('data-theme', 'light');
    const { runtime, browser } = await createRuntime({
      sync: { [STORAGE_KEYS.wallpaper]: splitPrefs('monet-coastal-white', 'dark-shanshui-moonlit') }
    });
    await runtime.bootstrapInitialWallpaper();
    expect(readPreloadCache()).toMatchObject({ version: WALLPAPER_PRELOAD_STORAGE_VERSION });
    expect(String(preloadEntry('light').path)).toContain('lumno-newtab-monet-coastal-white.webp');
    // The preload places samples from a built-in small copy by the full wallpaper size.
    expect([preloadEntry('light').width, preloadEntry('light').height]).toEqual([2048, 1152]);
    expect(String(preloadEntry('dark').path)).toContain('lumno-newtab-dark-shanshui-moonlit.webp');
    expect(shownWallpaperImage()).toContain('lumno-newtab-monet-coastal-white.webp');

    runtime.createControls();
    openPanel(runtime);
    expect(panelState(runtime).wallpaper.mode.visible).toBe(true);
    expect(panelState(runtime).wallpaper.mode.tabs.active).toBe('light');
    expect(required(findTile(runtime, 'monet-coastal-white')).selected).toBe(true);
    panelActions(runtime).selectWallpaperMode('dark');
    expect(panelState(runtime).wallpaper.mode.tabs.active).toBe('dark');
    expect(required(findTile(runtime, 'dark-shanshui-moonlit')).selected).toBe(true);
    clickTile(runtime, 'dark-monet-lily-nocturne');

    await vi.waitFor(() => expect(browser.storage.sync.values[STORAGE_KEYS.wallpaper])
      .toEqual(splitPrefs('monet-coastal-white', 'dark-monet-lily-nocturne')));
    expect(shownWallpaperImage()).toContain('lumno-newtab-monet-coastal-white.webp');

    document.body.setAttribute('data-theme', 'dark');
    runtime.handleThemeModeChange();
    await vi.waitFor(() => expect(shownWallpaperImage()).toContain('lumno-newtab-dark-monet-lily-nocturne.webp'));
  });

  it('keep an upload chosen for dark mode on this device only', async () => {
    const id = `${CUSTOM_WALLPAPER_ID_PREFIX}dark-local`;
    const browser = createBrowserFake({
      sync: { [STORAGE_KEYS.wallpaper]: splitPrefs('monet-coastal-white', DEFAULT_WALLPAPER_ID) }
    });
    installUploads([upload(id, 'data:image/webp;base64,dark-wallpaper', 'data:image/webp;base64,dark-thumb')], browser);
    document.body.setAttribute('data-theme', 'light');
    const { runtime } = await createRuntime({ browser });
    await openedRuntime(runtime);
    panelActions(runtime).selectWallpaperMode('dark');
    panelActions(runtime).selectSourceTab('local');
    await vi.waitFor(() => expect(findTile(runtime, id)).not.toBeNull());
    expect(required(findTile(runtime, id)).thumbnailUrl).toBe('data:image/webp;base64,dark-thumb');

    clickTile(runtime, id);

    await vi.waitFor(() => expect(browser.storage.local.values[STORAGE_KEYS.localWallpaper])
      .toEqual({ version: WALLPAPER_PREFS_STORAGE_VERSION, light: '', dark: id }));
    expect(browser.storage.sync.values[STORAGE_KEYS.wallpaper]).toEqual(splitPrefs('monet-coastal-white', DEFAULT_WALLPAPER_ID));
    expect(shownWallpaperImage()).toContain('lumno-newtab-monet-coastal-white.webp');

    document.body.setAttribute('data-theme', 'dark');
    runtime.handleThemeModeChange();
    await vi.waitFor(() => expect(shownWallpaperImage()).toContain('data:image/webp;base64,dark-wallpaper'));
    // The next page preloads the upload, not the synced white fallback.
    expect(preloadEntry('dark')).toEqual({ id, customImage: { id } });
  });
});

describe('the preload cache', () => {
  it('keeps a light mask turned all the way down at zero for the next first frame', async () => {
    document.body.setAttribute('data-theme', 'light');
    const { runtime } = await createRuntime({
      sync: {
        [STORAGE_KEYS.wallpaper]: {
          version: WALLPAPER_PREFS_STORAGE_VERSION, sameForModes: true, light: 'dark-shanshui-moonlit', dark: 'dark-shanshui-moonlit'
        },
        [STORAGE_KEYS.overlay]: { version: 2, light: 0, dark: 50 }
      }
    });

    await runtime.bootstrapInitialWallpaperOverlay();
    await runtime.bootstrapInitialWallpaper();

    expect(readPreloadCache()).toMatchObject({ overlayStops: { light: { top: 0, mid: 0, bottom: 0 } } });
  });

  it('remembers how bright the shown wallpaper is, for the next page\'s blur frost', async () => {
    document.body.setAttribute('data-theme', 'light');
    const { runtime } = await createRuntime({ sync: { [STORAGE_KEYS.wallpaper]: 'dark-shanshui-moonlit' } });
    await runtime.bootstrapInitialWallpaper();
    await vi.waitFor(() => expect(shownWallpaperImage()).toContain('lumno-newtab-dark-shanshui-moonlit.webp'));
    const shownUrl = shownWallpaperImage().replace(/^url\("|"\)$/g, '');
    const toneOptions = vi.mocked(createWallpaperAdaptiveTone).mock.calls[0][0];
    const onSamplerReady = required(required(toneOptions, 'the tone options').onSamplerReady, 'onSamplerReady');
    const canvas = document.createElement('canvas');
    // A mid-gray sample: luminance 0.5.
    const sampler = {
      url: shownUrl,
      canvas,
      context: required(canvas.getContext('2d'), 'a 2D context'),
      imageData: new Uint8ClampedArray([128, 128, 128, 255, 127, 127, 127, 255]),
      naturalWidth: 2,
      naturalHeight: 1,
      sampleScaleX: 1,
      sampleScaleY: 1
    };

    onSamplerReady({ ...sampler, url: 'chrome-extension://lumno/stale.webp' });
    expect(preloadEntry('light').luminance).toBeUndefined();

    onSamplerReady(sampler);
    ['light', 'dark'].forEach((mode) => {
      const entry = preloadEntry(mode);
      expect(entry.luminance).toBeCloseTo(0.5, 2);
      expect(entry.luminanceKey).toBe('dark-shanshui-moonlit');
      expect(String(entry.path)).toContain('lumno-newtab-dark-shanshui-moonlit.webp');
      // No blurred copy is kept.
      expect(entry).not.toHaveProperty('placeholder');
      expect(entry).not.toHaveProperty('backdrop');
    });
    const remembered = preloadEntry('light').luminance;

    // The next New Tab keeps the luminance it opened with until its own sample.
    const next = await createRuntime({ sync: { [STORAGE_KEYS.wallpaper]: 'dark-shanshui-moonlit' } });
    await next.runtime.bootstrapInitialWallpaper();
    await settleTasks();
    expect(preloadEntry('light').luminance).toBe(remembered);
  });
});
