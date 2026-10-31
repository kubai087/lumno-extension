import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as settings from '../domain/settings';
import { newtabShortcutsLegacy } from '../domain/settings/newtab-shortcuts';
import { createShortcutRecord } from '../domain/shortcuts/normalize';
import { ICONS_KEY, LOCAL_WALLPAPER_KEY, OVERFLOW_KEY } from '../domain/webdav/state-base';
import { createDeviceChrome } from '../../tests/fakes/webdav';
import { createDeviceSnapshots } from './device-snapshot';
import type { SnapshotWallpaperStore } from './device-snapshot';
import { createProviderStorageRuntime } from './provider-storage';
import { createShortcutListStorage } from './shortcut-list-storage';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const icon = `data:image/png;base64,${readFileSync(resolve(REPO_ROOT, 'assets/images/lumno.png')).toString('base64')}`;
const webp = `data:image/webp;base64,${readFileSync(resolve(REPO_ROOT, 'assets/wallpapers/lumno-newtab-seurat-coast-white-thumb.webp')).toString('base64')}`;
const theme = settings.themeMode.key;
const layout = settings.bookmarkTopbarLayout.key;
const [topbarMode] = settings.BOOKMARK_TOPBAR_SURFACE_KEYS;
const customQuotes = '_x_extension_custom_quotes_2026_unique_';

type WallpaperRecordInput = Parameters<SnapshotWallpaperStore['replaceAll']>[0][number];

function wallpaper(id: string): WallpaperRecordInput {
  return { id, key: id, name: id, width: 0, height: 0, updatedAt: 1, imageDataUrl: webp, thumbnailDataUrl: webp };
}

function device(initial: { sync?: Record<string, unknown>; local?: Record<string, unknown> }, wallpapers: WallpaperRecordInput[] = []) {
  const chromeApi = createDeviceChrome(initial);
  let library = structuredClone(wallpapers);
  const wallpaperStore = {
    readAll: async () => structuredClone(library).map((record) => ({ ...record, key: record.key || record.id, sampleDataUrl: '' })),
    replaceAll: async (next: readonly WallpaperRecordInput[]) => { library = structuredClone([...next]); }
  };
  const provider = createProviderStorageRuntime(chromeApi);
  const snapshots = createDeviceSnapshots({ chromeApi, provider, wallpaperStore, crypto: globalThis.crypto });
  const shortcutIds = async () => (await createShortcutListStorage({ chromeApi, provider }).read()).state.items.map((item) => item.id);
  return { chromeApi, snapshots, shortcutIds, wallpaperIds: () => library.map((record) => record.id) };
}

// A device keeping settings in browser sync, with a shortcut beyond its
// sync budget, an icon, a wallpaper in use and settings only WebDAV carries.
function firstDevice() {
  const first = createShortcutRecord({ id: 'first', title: 'First', url: 'https://example.com/' }, { now: 100 });
  const overflow = createShortcutRecord({ id: 'overflow', title: 'Overflow', url: 'https://other.example/' }, { now: 100 });
  return device({
    sync: { [theme]: 'light', [layout]: 'floating', [newtabShortcutsLegacy.key]: [first] },
    local: {
      [OVERFLOW_KEY]: { authoritative: false, items: [overflow] },
      [ICONS_KEY]: { first: icon },
      [LOCAL_WALLPAPER_KEY]: { version: 1, light: 'custom-wallpaper-a', dark: 'custom-wallpaper-a' },
      [topbarMode]: 'clear',
      [customQuotes]: { version: 1, filename: 'quotes.md', revision: 1, quotes: [{ text: 'Well begun is half done.', from: 'Aristotle' }] }
    }
  }, [wallpaper('custom-wallpaper-a')]);
}

function secondDevice() {
  return device({
    sync: { [theme]: 'dark' },
    local: {
      [ICONS_KEY]: { kept: icon },
      [LOCAL_WALLPAPER_KEY]: { version: 1, light: 'custom-wallpaper-b', dark: 'custom-wallpaper-b' }
    }
  }, [wallpaper('custom-wallpaper-b')]);
}

// A snapshot as it comes back out of a file.
function throughFile(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

describe('device snapshots in settings files', () => {
  it('carry the whole shortcut list, the settings WebDAV carries and the chosen images to another device', async () => {
    const snapshot = await firstDevice().snapshots.capture({ wallpapers: true, icons: true });
    expect(Object.keys(snapshot.files)).toHaveLength(Object.keys(snapshot.state.assets).length);

    const second = secondDevice();
    const parsed = await second.snapshots.parse(throughFile(snapshot));
    await second.snapshots.apply(parsed, { payload: second.snapshots.preferences(parsed), keysToClear: [] });

    expect(await second.shortcutIds()).toEqual(['first', 'overflow']);
    expect(second.chromeApi.storage.sync.values[theme]).toBe('light');
    expect(second.chromeApi.storage.sync.values[layout]).toBe('floating');
    const local = second.chromeApi.storage.local.values;
    expect(local[topbarMode]).toBe('clear');
    expect(local[customQuotes]).toMatchObject({ filename: 'quotes.md' });
    expect(local[LOCAL_WALLPAPER_KEY]).toEqual({ version: 1, light: 'custom-wallpaper-a', dark: 'custom-wallpaper-a' });
    expect(local[ICONS_KEY]).toEqual({ first: icon });
    expect(local[settings.assetRevision.key]).toEqual(expect.any(String));
    // Wallpapers this device had stay beside the imported ones.
    expect(second.wallpaperIds().sort()).toEqual(['custom-wallpaper-a', 'custom-wallpaper-b']);
  });

  it('leave this device\'s wallpapers, their selection and its icons alone when the file does not carry them', async () => {
    const snapshot = await firstDevice().snapshots.capture({ wallpapers: false, icons: false });
    expect(snapshot.files).toEqual({});
    expect(snapshot.state.data).not.toHaveProperty(LOCAL_WALLPAPER_KEY);

    const second = secondDevice();
    const parsed = await second.snapshots.parse(throughFile(snapshot));
    await second.snapshots.apply(parsed, { payload: second.snapshots.preferences(parsed), keysToClear: [] });

    expect(await second.shortcutIds()).toEqual(['first', 'overflow']);
    const local = second.chromeApi.storage.local.values;
    expect(local[LOCAL_WALLPAPER_KEY]).toEqual({ version: 1, light: 'custom-wallpaper-b', dark: 'custom-wallpaper-b' });
    expect(local[ICONS_KEY]).toEqual({ kept: icon });
    expect(local[settings.assetRevision.key]).toBeUndefined();
    expect(second.wallpaperIds()).toEqual(['custom-wallpaper-b']);
  });

  it('refuse a file whose image does not match its hash, and change nothing', async () => {
    const snapshot = throughFile(await firstDevice().snapshots.capture({ wallpapers: true, icons: true }));
    if (!snapshot || typeof snapshot !== 'object' || !('files' in snapshot) || !snapshot.files || typeof snapshot.files !== 'object') {
      throw new Error('Expected the snapshot to carry files.');
    }
    const files: Record<string, unknown> = { ...snapshot.files };
    const [hash] = Object.keys(files);
    files[hash] = btoa('not this image');
    const second = secondDevice();
    await expect(second.snapshots.parse({ ...snapshot, files })).rejects.toMatchObject({ code: 'invalid-asset' });
    expect(second.wallpaperIds()).toEqual(['custom-wallpaper-b']);
  });

  it('refuse a device whose shortcuts have only partly arrived from browser sync', async () => {
    const torn = device({ sync: { [settings.NEWTAB_SHORTCUTS_GROUP_KEYS[0]]: { v: 2, r: 'a', n: 2, m: 1, g: [['default', '']], s: [] } } });
    await expect(torn.snapshots.capture({ wallpapers: false, icons: false })).rejects.toThrow('incomplete-shortcuts');
  });
});
