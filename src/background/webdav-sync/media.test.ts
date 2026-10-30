import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as settings from '../../domain/settings';
import { LOCAL_WALLPAPER_KEY } from '../../domain/webdav/state-base';
import { DAV_CONFIG, createDavServer, createDevice, field } from '../../../tests/fakes/webdav';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');
const theme = settings.themeMode.key;
const links = settings.newtabLinkWallpapers.key;

function record(id: string, file: string, updatedAt: number) {
  const image = `data:image/webp;base64,${readFileSync(resolve(REPO_ROOT, 'assets/wallpapers', file)).toString('base64')}`;
  return { id, key: id, name: id, width: 0, height: 0, updatedAt, imageDataUrl: image, thumbnailDataUrl: image };
}

const ids = (items: { id: string }[]) => items.map((item) => item.id).sort();

describe('merging wallpapers on a first join', () => {
  // The server's settings and selection win; uploads from both sides are kept
  // once per image, and links once per address.
  it('keeps each image and each link once, and follows the server for the rest', async () => {
    const shared = 'lumno-newtab-seurat-coast-white-thumb.webp';
    const server = createDavServer();
    const a = createDevice(server, {
      sync: { [theme]: 'light', [links]: [{ id: 'link-aaaa01', url: 'https://a.example/one.jpg', addedAt: 1 }] },
      local: { [LOCAL_WALLPAPER_KEY]: { version: 1, light: 'custom-wallpaper-a', dark: 'custom-wallpaper-a' } }
    }, { wallpapers: [record('custom-wallpaper-a', shared, 10)] });
    await a.controller.handle({ operation: 'connect', config: DAV_CONFIG });
    const b = createDevice(server, {
      sync: { [theme]: 'dark', [links]: [{ id: 'link-bbbb01', url: 'https://b.example/two.jpg', addedAt: 2 },
        { id: 'link-bbbb02', url: 'https://a.example/one.jpg', addedAt: 3 }] },
      local: { [LOCAL_WALLPAPER_KEY]: { version: 1, light: 'custom-wallpaper-b2', dark: 'custom-wallpaper-b2' } }
    }, { wallpapers: [record('custom-wallpaper-b1', shared, 20), record('custom-wallpaper-b2', 'lumno-newtab-monet-coastal-white-thumb.webp', 30)] });

    expect(await b.controller.handle({ operation: 'connect', config: DAV_CONFIG })).toEqual({ needsChoice: true });
    await b.controller.handle({ operation: 'connect', config: DAV_CONFIG, decision: 'merge' });
    expect(server.state().wallpapers.map((item) => item.id)).toEqual(['custom-wallpaper-a', 'custom-wallpaper-b2']);
    expect(server.state().data[links]).toMatchObject([{ url: 'https://a.example/one.jpg' }, { url: 'https://b.example/two.jpg' }]);
    expect(server.state().data[theme]).toBe('light');
    expect(b.chrome.storage.sync.values[theme]).toBe('light');
    expect(ids(await b.wallpaperStore.readAll())).toEqual(['custom-wallpaper-a', 'custom-wallpaper-b2']);
    expect(field(b.chrome.storage.local.values[LOCAL_WALLPAPER_KEY], 'light')).toBe('custom-wallpaper-a');
    expect(b.chrome.storage.sync.values[links]).toHaveLength(2);
    expect(b.privateValues.get('migrationBackup')).toBeTruthy();

    await a.controller.handle({ operation: 'sync' });
    expect(ids(await a.wallpaperStore.readAll())).toEqual(['custom-wallpaper-a', 'custom-wallpaper-b2']);
    expect(a.chrome.storage.sync.values[links]).toHaveLength(2);
    expect(a.chrome.storage.sync.values[theme]).toBe('light');
  });
});
