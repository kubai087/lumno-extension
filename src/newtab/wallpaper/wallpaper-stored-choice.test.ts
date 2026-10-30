import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CUSTOM_WALLPAPER_ID_PREFIX,
  DEFAULT_WALLPAPER_ID,
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
import { createBrowserFake } from '../../../tests/fakes/browser';
import { installCanvasFake, installImageFake } from '../../../tests/fakes/canvas';

vi.mock('../react/wallpaper-view', async () => ({
  createWallpaperViewController: (await import('../../../tests/fakes/wallpaper/view-recorder')).createRecordingWallpaperView
}));

beforeEach(() => {
  installMatchMedia();
  installBroadcastChannel();
  installImageFake();
  installCanvasFake();
});

const ASSET_REVISION_STORAGE_KEY = '_x_extension_asset_revision_2026_unique_';

describe('the stored wallpaper at start-up', () => {
  it('reads no upload for a built-in wallpaper until the Local tab opens, and then the catalog once', async () => {
    const browser = createBrowserFake({ sync: { [STORAGE_KEYS.wallpaper]: DEFAULT_WALLPAPER_ID } });
    const library = installUploads([
      upload(`${CUSTOM_WALLPAPER_ID_PREFIX}unused`, 'data:image/webp;base64,unused', 'data:image/webp;base64,unused-thumb')
    ], browser);
    const { runtime } = await createRuntime({ browser });

    await runtime.bootstrapInitialWallpaper();
    expect(library.calls.getAll).toBe(0);
    expect(library.calls.get).toEqual([]);

    runtime.createControls();
    openPanel(runtime);
    expect(panelState(runtime).wallpaper.activeTab).toBe('built-in');
    await settleTasks();
    expect(library.calls.getAll).toBe(0);

    panelActions(runtime).selectSourceTab('local');
    expect(panelState(runtime).wallpaper.activeTab).toBe('local');
    await vi.waitFor(() => expect(findTile(runtime, `${CUSTOM_WALLPAPER_ID_PREFIX}unused`)).not.toBeNull());
    expect(library.calls.getAll).toBe(1);

    panelActions(runtime).selectSourceTab('built-in');
    panelActions(runtime).selectSourceTab('local');
    await settleTasks();
    expect(library.calls.getAll).toBe(1);
  });

  it('falls back to the default and fixes sync when a synced upload is not on this device', async () => {
    const { runtime, browser } = await createRuntime({
      sync: { [STORAGE_KEYS.wallpaper]: `${CUSTOM_WALLPAPER_ID_PREFIX}remote-only` }
    });

    await runtime.bootstrapInitialWallpaper();

    expect(document.body.getAttribute('data-wallpaper-active')).toBe('true');
    expect(shownWallpaperImage()).toContain('lumno-newtab-monet-coastal-white.webp');
    await vi.waitFor(() => expect(browser.storage.sync.values[STORAGE_KEYS.wallpaper]).toBe(DEFAULT_WALLPAPER_ID));
  });

  it('shows the default for a wallpaper id from a newer install without overwriting it', async () => {
    const { runtime, browser } = await createRuntime({ sync: { [STORAGE_KEYS.wallpaper]: 'future-source-photo' } });

    await runtime.bootstrapInitialWallpaper();
    await settleTasks();

    expect(shownWallpaperImage()).toContain('lumno-newtab-monet-coastal-white.webp');
    expect(browser.storage.sync.values[STORAGE_KEYS.wallpaper]).toBe('future-source-photo');
  });

  it('moves a synced upload that is on this device into local storage, reading only that upload', async () => {
    const id = `${CUSTOM_WALLPAPER_ID_PREFIX}local-record`;
    const browser = createBrowserFake({ sync: { [STORAGE_KEYS.wallpaper]: id } });
    const library = installUploads([upload(id, 'data:image/webp;base64,wallpaper', 'data:image/webp;base64,thumb')], browser);
    const { runtime } = await createRuntime({ browser });

    await runtime.bootstrapInitialWallpaper();

    expect(shownWallpaperImage()).toContain('data:image/webp;base64,wallpaper');
    await vi.waitFor(() => expect(browser.storage.sync.values[STORAGE_KEYS.wallpaper]).toBe(DEFAULT_WALLPAPER_ID));
    expect(browser.storage.local.values[STORAGE_KEYS.localWallpaper]).toBe(id);
    expect(library.calls.get).toEqual([id]);
    expect(library.calls.getAll).toBe(0);
  });

  // Chrome drops a CSS custom property over 2 MB, so a stored wallpaper whose data URL is longer
  // would leave the page blank; it has to reach --x-nt-wallpaper-image as a blob URL.
  it('shows an upload whose data URL is too long for CSS through a blob URL', async () => {
    const id = `${CUSTOM_WALLPAPER_ID_PREFIX}oversized`;
    const payload = 'A'.repeat(2 * 1024 * 1024 + 400);
    const browser = createBrowserFake({ local: { [STORAGE_KEYS.localWallpaper]: id } });
    installUploads([upload(id, `data:image/webp;base64,${payload}`, 'data:image/webp;base64,thumb')], browser);
    const created: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      if (blob instanceof Blob) created.push(blob);
      return `blob:chrome-extension://lumno/wallpaper-${created.length}`;
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const { runtime } = await createRuntime({ browser });

    await runtime.bootstrapInitialWallpaper();

    expect(shownWallpaperImage()).toBe('url("blob:chrome-extension://lumno/wallpaper-1")');
    expect(created).toHaveLength(1);
    expect(created[0].type).toBe('image/webp');
    expect(created[0].size).toBe((payload.length / 4) * 3);
  });

  it.each(['light', 'dark'])('paints nothing in %s mode before the local upload it uses has loaded', async (mode) => {
    const id = `${CUSTOM_WALLPAPER_ID_PREFIX}initial-${mode}`;
    const browser = createBrowserFake({
      sync: {
        [STORAGE_KEYS.wallpaper]: {
          version: WALLPAPER_PREFS_STORAGE_VERSION, sameForModes: false, light: DEFAULT_WALLPAPER_ID, dark: DEFAULT_WALLPAPER_ID
        }
      },
      local: { [STORAGE_KEYS.localWallpaper]: { version: WALLPAPER_PREFS_STORAGE_VERSION, light: id, dark: id } }
    });
    installUploads([upload(id, `data:image/webp;base64,initial-${mode}`, `data:image/webp;base64,thumb-${mode}`)], browser);
    document.body.setAttribute('data-theme', mode);
    const { runtime } = await createRuntime({ browser });

    runtime.handleThemeModeChange();

    expect(shownWallpaperImage()).toBe('');
    expect(document.body.getAttribute('data-wallpaper-active')).toBeNull();

    await runtime.bootstrapInitialWallpaper();

    // The preload reads the upload from IndexedDB, never a bundled file.
    expect(readPreloadCache()).toEqual(expect.objectContaining({
      version: WALLPAPER_PRELOAD_STORAGE_VERSION,
      wallpapers: expect.objectContaining({ [mode]: { id, customImage: { id } } })
    }));
    expect(shownWallpaperImage()).toContain(`data:image/webp;base64,initial-${mode}`);
  });
});

describe('deleting uploads', () => {
  it('keeps the Local tab open, and a theme change that keeps the choice keeps the tab', async () => {
    const firstId = `${CUSTOM_WALLPAPER_ID_PREFIX}first`;
    const secondId = `${CUSTOM_WALLPAPER_ID_PREFIX}second`;
    const browser = createBrowserFake({ sync: { [STORAGE_KEYS.wallpaper]: DEFAULT_WALLPAPER_ID } });
    installUploads([firstId, secondId].map((id, index) =>
      upload(id, `data:image/webp;base64,${id}`, `data:image/webp;base64,${id}-thumb`, index + 1)), browser);
    document.body.setAttribute('data-theme', 'light');
    const { runtime } = await createRuntime({ browser });
    await runtime.bootstrapInitialWallpaper();
    runtime.createControls();
    openPanel(runtime);
    panelActions(runtime).selectSourceTab('local');
    const activeTab = () => panelState(runtime).wallpaper.activeTab;
    const localIds = () => panelState(runtime).wallpaper.local.tiles.map((tile) => tile.id);
    await vi.waitFor(() => expect(localIds()).toEqual([firstId, secondId]));
    expect(activeTab()).toBe('local');

    // Each delete writes an asset revision, which reloads the stored state.
    panelActions(runtime).deleteWallpaper(firstId);
    await vi.waitFor(() => expect(browser.storage.local.values[ASSET_REVISION_STORAGE_KEY]).toBeDefined());
    await vi.waitFor(() => expect(findTile(runtime, firstId)).toBeNull());
    await settleTasks();
    expect(activeTab()).toBe('local');

    clickTile(runtime, secondId);
    await vi.waitFor(() => expect(browser.storage.local.values[STORAGE_KEYS.localWallpaper]).toBe(secondId));
    panelActions(runtime).deleteWallpaper(secondId);
    await vi.waitFor(() => expect(findTile(runtime, secondId)).toBeNull());
    await settleTasks();
    expect(activeTab()).toBe('local');

    panelActions(runtime).selectSourceTab('bing');
    document.body.setAttribute('data-theme', 'dark');
    runtime.handleThemeModeChange();
    await settleTasks();
    expect(activeTab()).toBe('bing');
  });
});
