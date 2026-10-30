import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as settings from '../../domain/settings';
import { DAV_CONFIG, LOCK_PATH, createDavServer, createDevice, decode, field, storageSet } from '../../../tests/fakes/webdav';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');
const theme = settings.themeMode.key;
const quiet = { logger: { warn() {} } };

describe("publishing to the server's state", () => {
  // Otherwise other devices would stay at remote-locked.
  it('remembers a lock it could not release and releases it first on the next round', async () => {
    const server = createDavServer();
    const holder = createDevice(server, { sync: { [theme]: 'light' } }, { extra: quiet });
    await holder.controller.handle({ operation: 'connect', config: DAV_CONFIG });
    let lostReleases = 2;
    server.beforeRequest = (path, init) => {
      if (path === LOCK_PATH && init.method === 'DELETE' && lostReleases > 0) {
        lostReleases -= 1;
        throw new Error('release response lost');
      }
    };
    await storageSet(holder.chrome.storage.sync, { [theme]: 'dark' });

    expect(await holder.controller.handle({ operation: 'sync' })).toEqual({ ok: true });
    expect(server.state().data[theme]).toBe('dark');
    expect(server.directories.has(LOCK_PATH)).toBe(true);
    expect(field(holder.privateValues.get('staleLock'), 'owner')).toEqual(expect.any(String));
    server.beforeRequest = null;
    await holder.controller.handle({ operation: 'sync' });
    expect(server.directories.has(LOCK_PATH)).toBe(false);
    expect(holder.privateValues.get('staleLock')).toBeNull();
  });

  it('reads the state once under the lock, keeps ten snapshots per device and never moves media the server has', async () => {
    const server = createDavServer();
    const wallpaper = readFileSync(resolve(REPO_ROOT, 'assets/wallpapers/lumno-newtab-seurat-coast-white-thumb.webp'));
    const wallpaperPath = `/dav/lumno/v1/assets/${createHash('sha256').update(wallpaper).digest('hex')}.webp`;
    server.files.set(wallpaperPath, { bytes: new Uint8Array(wallpaper), etag: '"asset"' });
    const webp = `data:image/webp;base64,${wallpaper.toString('base64')}`;
    const lean = createDevice(server, { sync: { [theme]: 'light' } }, { extra: quiet, wallpapers: [{ id: 'custom-wallpaper-lean',
      key: 'custom-wallpaper-lean', name: 'Lean', width: 0, height: 0, updatedAt: 1, imageDataUrl: webp, thumbnailDataUrl: webp }] });
    await lean.controller.handle({ operation: 'connect', config: DAV_CONFIG });

    expect(server.requestCount('HEAD', (path) => path === wallpaperPath)).toBeGreaterThan(0);
    expect(server.requestCount('GET', (path) => path === wallpaperPath) + server.requestCount('PUT', (path) => path === wallpaperPath)).toBe(0);
    for (let index = 0; index < 13; index += 1) {
      await storageSet(lean.chrome.storage.sync, { [theme]: `theme-${index}` });
      const before = server.requests.length;
      await lean.controller.handle({ operation: 'sync' });
      expect(server.requests.slice(before).filter((request) => request.path.endsWith('/state.json') && request.method === 'GET')).toHaveLength(3);
    }
    const snapshots = [...server.files.keys()].filter((path) => path.includes('/snapshots/'));
    expect(snapshots).toHaveLength(10);
    const newest = snapshots.find((path) => path.endsWith(`-${(13 - 1) % 10}.json`));
    const file = newest ? server.files.get(newest) : undefined;
    expect(file && field(JSON.parse(decode(file.bytes)), 'data', theme)).toBe('theme-11');
    await lean.controller.handle({ operation: 'pause' });
  });
});
