import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as settings from '../../domain/settings';
import { newtabShortcutsLegacy } from '../../domain/settings/newtab-shortcuts';
import { createShortcutRecord } from '../../domain/shortcuts/normalize';
import { ICONS_KEY, LOCAL_WALLPAPER_KEY, OVERFLOW_KEY } from '../../domain/webdav/state-base';
import { createProviderStorageRuntime } from '../../platform/provider-storage';
import { DAV_CONFIG, STATE_PATH, createDavServer, createDevice, encode, field, storageSet } from '../../../tests/fakes/webdav';
import type { DavServer } from '../../../tests/fakes/webdav';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');
const theme = settings.themeMode.key;
const language = settings.language.key;
const customSearch = settings.siteSearchCustom.key;
const customQuotes = '_x_extension_custom_quotes_2026_unique_';
const quotePick = '_x_extension_custom_quote_pick_2026_unique_';
const engine = (name: string) => [{ name, url: `https://${name}.example/?q=%s` }];
const [topbarMode, topbarLight, topbarDark, topbarLegacy] = settings.BOOKMARK_TOPBAR_SURFACE_KEYS;
const topbarLayout = settings.bookmarkTopbarLayout.key;
const icon = readFileSync(resolve(REPO_ROOT, 'assets/images/lumno.png'));
const wallpaper = readFileSync(resolve(REPO_ROOT, 'assets/wallpapers/lumno-newtab-seurat-coast-white-thumb.webp'));
const webp = `data:image/webp;base64,${wallpaper.toString('base64')}`;

function wallpaperRecord(id: string, name: string, width: number, height: number, updatedAt: number, image = webp) {
  return { id, key: id, name, width, height, updatedAt, imageDataUrl: image, thumbnailDataUrl: webp };
}

// The first device has settings, an overflowing shortcut, an icon, a
// wallpaper in use, the bookmark bar layout and material and custom quotes.
function createFirstDevice(server: DavServer) {
  const firstShortcut = createShortcutRecord({ id: 'first', title: 'First', url: 'https://example.com/' }, { now: 100 });
  const overflowShortcut = createShortcutRecord({ id: 'overflow', title: 'Overflow', url: 'https://other.example/' }, { now: 100 });
  return createDevice(server, {
    sync: { [theme]: 'light', [language]: 'en', [newtabShortcutsLegacy.key]: [firstShortcut], [topbarLayout]: 'floating' },
    local: {
      [OVERFLOW_KEY]: { authoritative: false, items: [overflowShortcut] },
      [ICONS_KEY]: { first: `data:image/png;base64,${icon.toString('base64')}` },
      [LOCAL_WALLPAPER_KEY]: { version: 1, light: 'custom-wallpaper-test', dark: 'custom-wallpaper-test' },
      [topbarMode]: 'custom', [topbarLight]: '#112233', [topbarDark]: '#445566', [topbarLegacy]: '#778899',
      [customQuotes]: { version: 1, filename: 'quotes.md', revision: 100, quotes: [{ text: 'Well begun is half done.', from: 'Aristotle' }] },
      [quotePick]: { day: '2026-10-18', index: 0 }
    }
  }, { wallpapers: [wallpaperRecord('custom-wallpaper-test', 'Test', 480, 270, 100)] });
}

async function joinedPair() {
  const server = createDavServer();
  const first = createFirstDevice(server);
  await first.controller.handle({ operation: 'connect', config: DAV_CONFIG });
  const second = createDevice(server, { sync: { [theme]: 'system' } });
  await second.controller.handle({ operation: 'connect', config: DAV_CONFIG, decision: 'remote' });
  return { server, first, second };
}

describe('the first device to connect', () => {
  it('publishes its settings, every shortcut and its wallpapers, and keeps the password out of sight', async () => {
    const server = createDavServer();
    const first = createFirstDevice(server);
    await first.controller.handle({ operation: 'connect', config: DAV_CONFIG });

    expect(icon.length).toBeLessThanOrEqual(96 * 1024);
    expect(wallpaper.length).toBeLessThanOrEqual(160 * 1024);
    expect(first.chrome.storage.local.values[settings.localPrimary.key]).toBeUndefined();
    expect(field(first.chrome.storage.local.values[OVERFLOW_KEY], 'items')).toEqual([]);
    expect(server.state().shortcuts.map((item) => item.id)).toEqual(['first', 'overflow']);
    expect(server.state().wallpapers).toHaveLength(1);
    expect(Object.values(server.state().assets)).toHaveLength(2);
    const status = await first.controller.status();
    expect(status.config).toMatchObject({ hasPassword: true });
    expect(JSON.stringify(status)).not.toContain('app-password');
    expect(Object.keys(first.chrome.storage.local.values).some((key) => /password|credentials/.test(key))).toBe(false);
  });
});

describe('a device joining a server that already has a state', () => {
  it('asks first, then takes the server copy with its icons, wallpapers and quotes, but keeps its own daily quote', async () => {
    const server = createDavServer();
    const first = createFirstDevice(server);
    await first.controller.handle({ operation: 'connect', config: DAV_CONFIG });
    const second = createDevice(server, { sync: { [theme]: 'system' } });

    expect(await second.controller.handle({ operation: 'connect', config: DAV_CONFIG })).toEqual({ needsChoice: true });
    expect(second.chrome.storage.local.values[settings.localPrimary.key]).toBeUndefined();
    await second.controller.handle({ operation: 'connect', config: DAV_CONFIG, decision: 'remote' });
    expect(second.chrome.storage.sync.values[theme]).toBe('light');
    expect(field(second.chrome.storage.local.values[ICONS_KEY], 'first')).toBe(field(first.chrome.storage.local.values[ICONS_KEY], 'first'));
    expect((await second.wallpaperStore.readAll())[0].imageDataUrl).toBe((await first.wallpaperStore.readAll())[0].imageDataUrl);
    expect(second.chrome.storage.local.values[LOCAL_WALLPAPER_KEY]).toEqual(first.chrome.storage.local.values[LOCAL_WALLPAPER_KEY]);
    expect(second.chrome.storage.local.values[customQuotes]).toEqual(first.chrome.storage.local.values[customQuotes]);
    expect(second.chrome.storage.local.values[quotePick]).toBeUndefined();
    expect([server.state().wallpapers[0].width, server.state().wallpapers[0].height]).toEqual([512, 288]);
  });

  it('joins with wallpapers saved before their size was recorded', async () => {
    const server = createDavServer();
    await createFirstDevice(server).controller.handle({ operation: 'connect', config: DAV_CONFIG });
    const legacy = createDevice(server, { sync: { [theme]: 'system' } }, { wallpapers: [wallpaperRecord('custom-wallpaper-legacy-1', 'Old', 0, 0, 50)] });

    expect(await legacy.controller.handle({ operation: 'connect', config: DAV_CONFIG })).toEqual({ needsChoice: true });
    await legacy.controller.handle({ operation: 'connect', config: DAV_CONFIG, decision: 'remote' });
    expect((await legacy.wallpaperStore.readAll()).map((item) => item.id)).toEqual(['custom-wallpaper-test']);
  });

  it('reports a wallpaper it cannot sync as its own, not as a bad remote copy', async () => {
    const server = createDavServer();
    await createFirstDevice(server).controller.handle({ operation: 'connect', config: DAV_CONFIG });
    const damaged = createDevice(server, { sync: { [theme]: 'system' } }, {
      wallpapers: [wallpaperRecord('custom-wallpaper-damaged', 'Damaged', 10, 10, 50, `data:image/png;base64,${icon.toString('base64')}`)]
    });

    await expect(damaged.controller.handle({ operation: 'connect', config: DAV_CONFIG, decision: 'remote' })).rejects.toThrow(/local-invalid-asset/);
    expect((await damaged.wallpaperStore.readAll()).map((item) => item.id)).toEqual(['custom-wallpaper-damaged']);
  });

  it('carries the bookmark bar layout with the preferences and its material through WebDAV only, merging each value on its own', async () => {
    const { server, first, second } = await joinedPair();

    expect([topbarMode, topbarLight, topbarDark].map((key) => second.chrome.storage.local.values[key])).toEqual(['custom', '#112233', '#445566']);
    expect(second.chrome.storage.sync.values[topbarLayout]).toBe('floating');
    expect(Object.hasOwn(server.state().data, topbarLegacy)).toBe(false);
    [first, second].forEach((device) => settings.BOOKMARK_TOPBAR_SURFACE_KEYS.forEach((key) => {
      expect(Object.hasOwn(device.chrome.storage.sync.values, key)).toBe(false);
    }));
    await storageSet(first.chrome.storage.local, { [topbarMode]: 'clear' });
    await storageSet(second.chrome.storage.local, { [topbarDark]: '#000000' });
    await storageSet(second.chrome.storage.sync, { [topbarLayout]: 'docked' });
    await first.controller.handle({ operation: 'sync' });
    await second.controller.handle({ operation: 'sync' });
    await first.controller.handle({ operation: 'sync' });
    [first, second].forEach((device) => {
      expect([topbarMode, topbarLight, topbarDark].map((key) => device.chrome.storage.local.values[key])).toEqual(['clear', '#112233', '#000000']);
      expect(device.chrome.storage.sync.values[topbarLayout]).toBe('docked');
    });
  });
});

describe('two devices in step', () => {
  it('does not silently recreate a deleted server copy, and syncs both again once this device chooses', async () => {
    const { server, first, second } = await joinedPair();
    await storageSet(first.chrome.storage.sync, { [theme]: 'dark' });
    await storageSet(second.chrome.storage.sync, { [language]: 'ja' });
    await first.controller.handle({ operation: 'sync' });
    server.files.delete(STATE_PATH);

    await expect(first.controller.handle({ operation: 'sync' })).rejects.toThrow(/remote-missing/);
    expect((await first.controller.status()).state).toBe('choice');
    expect(server.files.has(STATE_PATH)).toBe(false);
    await first.controller.handle({ operation: 'sync', decision: 'local' });
    await second.controller.handle({ operation: 'sync' });
    await first.controller.handle({ operation: 'sync' });
    expect(first.chrome.storage.sync.values[language]).toBe('ja');
    expect(second.chrome.storage.sync.values[theme]).toBe('dark');
    expect(server.state().data[theme]).toBe('dark');
  });

  it('asks about a setting both devices changed apart instead of letting the last one win', async () => {
    const { server, first, second } = await joinedPair();
    await storageSet(first.chrome.storage.sync, { [theme]: 'dark' });
    await storageSet(second.chrome.storage.sync, { [theme]: 'system' });
    await first.controller.handle({ operation: 'sync' });

    expect(await second.controller.handle({ operation: 'sync' })).toEqual({ conflict: true });
    expect(server.state().data[theme]).toBe('dark');
    expect(second.chrome.storage.sync.values[theme]).toBe('system');
    await second.controller.handle({ operation: 'sync', decision: 'local' });
    expect(server.state().data[theme]).toBe('system');
    await first.controller.handle({ operation: 'sync' });
    expect(first.chrome.storage.sync.values[theme]).toBe('system');
  });

  it('lets a paused device that kept its old value take the newer server value when it resumes', async () => {
    const { server, first, second } = await joinedPair();
    const simple = settings.simpleModeEnabled.key;
    await first.controller.handle({ operation: 'pause' });
    await storageSet(second.chrome.storage.sync, { [simple]: true });
    await second.controller.handle({ operation: 'sync' });
    await first.controller.handle({ operation: 'connect', config: { ...DAV_CONFIG, password: '' } });

    expect(first.chrome.storage.sync.values[simple]).toBe(true);
    expect(server.state().data[simple]).toBe(true);
  });

  it('keeps the replaced local copy when a list conflict is resolved for the server', async () => {
    const { server, first, second } = await joinedPair();
    await storageSet(first.chrome.storage.sync, { [customSearch]: engine('first') });
    await storageSet(second.chrome.storage.sync, { [customSearch]: engine('second') });
    await first.controller.handle({ operation: 'sync' });

    expect(await second.controller.handle({ operation: 'sync' })).toEqual({ conflict: true });
    expect(second.chrome.storage.sync.values[customSearch]).toEqual(engine('second'));
    expect(server.state().data[customSearch]).toEqual(engine('first'));
    await second.controller.handle({ operation: 'sync', decision: 'remote' });
    expect(second.chrome.storage.sync.values[customSearch]).toEqual(engine('first'));
    expect(field(second.privateValues.get('replacementBackup'), 'captured', 'state', 'data', customSearch)).toEqual(engine('second'));
  });

  it('leaves Chrome writable and authoritative while the server is offline or paused', async () => {
    const { server, first } = await joinedPair();
    server.offline = true;
    await storageSet(first.chrome.storage.sync, { [customSearch]: [] });

    await expect(first.controller.handle({ operation: 'sync' })).rejects.toThrow(/network-error/);
    await storageSet(first.chrome.storage.sync, { [language]: 'en' });
    expect(first.chrome.storage.sync.values[language]).toBe('en');
    await first.controller.handle({ operation: 'pause' });
    expect(first.chrome.storage.local.values[settings.localPrimary.key]).toBeUndefined();
  });

  it('never truncates or replaces Chrome settings with an oversized server copy', async () => {
    const { server, first } = await joinedPair();
    const valid = server.state();
    server.replaceState({ ...valid.raw, data: { ...valid.data, [customSearch]: 'x'.repeat(120 * 1024) } });
    const before = structuredClone(first.chrome.storage.sync.values);

    await expect(first.controller.handle({ operation: 'sync' })).rejects.toThrow(/chrome-capacity/);
    expect(first.chrome.storage.sync.values).toEqual(before);
  });

  it('keeps an edit made during a network request', async () => {
    const { server, first } = await joinedPair();
    let raced = false;
    server.beforeRequest = async (path, init) => {
      if (!raced && path.endsWith('state.json') && init.method === 'GET') {
        raced = true;
        await storageSet(first.chrome.storage.sync, { [theme]: 'dark' });
      }
    };

    await expect(first.controller.handle({ operation: 'sync' })).rejects.toThrow(/local-changed/);
    expect(first.chrome.storage.sync.values[theme]).toBe('dark');
    server.beforeRequest = null;
    await first.controller.handle({ operation: 'sync' });
    expect(server.state().data[theme]).toBe('dark');
  });

  it('gives each unreadable server copy its own code and leaves local settings alone', async () => {
    const { server, second } = await joinedPair();
    const good = server.state().raw;
    server.replaceState({ bad: true });

    await expect(second.controller.handle({ operation: 'sync' })).rejects.toThrow(/invalid-state/);
    expect(second.chrome.storage.sync.values[theme]).toBe('light');
    server.files.set(STATE_PATH, { bytes: encode('{"version":2,'), etag: '"torn"' });
    await expect(second.controller.handle({ operation: 'sync' })).rejects.toThrow(/remote-corrupt/);
    server.replaceState(good);
    server.stateStatus = 204;
    await expect(second.controller.handle({ operation: 'sync' }))
      .rejects.toMatchObject({ code: 'remote-unreadable', diagnostic: { phase: 'state-read', statuses: [204] } });
    server.stateStatus = 0;
    expect(second.chrome.storage.sync.values[theme]).toBe('light');
  });

  it('hands settings back to the browser alone', async () => {
    const { first } = await joinedPair();
    await storageSet(first.chrome.storage.sync, { [theme]: 'dark' });
    await first.controller.handle({ operation: 'sync' });
    await first.controller.handle({ operation: 'browser' });

    expect(first.chrome.storage.local.values[settings.localPrimary.key]).toBeUndefined();
    expect(first.chrome.storage.sync.values[theme]).toBe('dark');
    expect((await first.controller.status()).enabled).toBe(false);
  });

  it('keeps new pages on browser sync and sends Chrome-delivered changes to WebDAV', async () => {
    const { server, second } = await joinedPair();
    const restarted = createProviderStorageRuntime(second.chrome);
    await restarted.ready;
    const cold = createProviderStorageRuntime({ ...second.chrome });
    await cold.ready;
    expect(cold.getActiveAreaName()).toBe('sync');
    await second.controller.handle({ operation: 'sync' });
    await storageSet(second.chrome.storage.sync, { [language]: 'zh_CN' });

    expect(await restarted.area.get([language])).toMatchObject({ [language]: 'zh_CN' });
    const resumed = second.createController();
    expect(await resumed.handle({ operation: 'status' })).toMatchObject({ localPrimary: false });
    await resumed.handle({ operation: 'sync' });
    expect(server.state().data[language]).toBe('zh_CN');
  });
});

describe('a commit by another device during a sync', () => {
  it('waits and merges again instead of failing', async () => {
    const server = createDavServer();
    const device = createDevice(server, { sync: { [theme]: 'light', [language]: 'en' } });
    await device.controller.handle({ operation: 'connect', config: DAV_CONFIG });
    await storageSet(device.chrome.storage.sync, { [theme]: 'dark' });
    let changedRemote = false;
    server.beforeRequest = (path, init) => {
      if (!changedRemote && path.endsWith('state.json') && init.method === 'PUT') {
        changedRemote = true;
        server.replaceState({ version: 1, data: { [theme]: 'light', [language]: 'ja' }, shortcuts: [], icons: {}, wallpapers: [], assets: {} });
      }
    };

    expect(await device.controller.handle({ operation: 'sync' })).toEqual({ pending: true });
    expect(device.chrome.storage.sync.values[theme]).toBe('dark');
    expect(server.state().data[theme]).toBe('light');
    expect(await device.controller.handle({ operation: 'status' })).toMatchObject({ state: 'pending', error: null });
    server.beforeRequest = null;
    await device.controller.handle({ operation: 'sync' });
    expect(device.chrome.storage.sync.values[language]).toBe('ja');
    expect(server.state().data[theme]).toBe('dark');
  });
});

describe('an apply interrupted on a joining device', () => {
  it('pauses before anything is uploaded, and restores the backup on request', async () => {
    const server = createDavServer();
    await createFirstDevice(server).controller.handle({ operation: 'connect', config: DAV_CONFIG });
    const partial = createDevice(server, { sync: { [theme]: 'system' } });
    const replaceAll = partial.wallpaperStore.replaceAll;
    let interrupt = true;
    partial.wallpaperStore.replaceAll = async (records) => {
      await replaceAll(records);
      if (interrupt) {
        interrupt = false;
        throw new Error('worker terminated');
      }
    };

    await expect(partial.controller.handle({ operation: 'connect', config: DAV_CONFIG, decision: 'remote' })).rejects.toThrow(/worker terminated/);
    const restarted = partial.createController();
    expect(await restarted.handle({ operation: 'status' })).toMatchObject({ enabled: false, error: 'interrupted-apply', hasMigrationBackup: true });
    await restarted.handle({ operation: 'restoreBackup' });
    expect(partial.chrome.storage.sync.values[theme]).toBe('system');
    expect(await partial.wallpaperStore.readAll()).toEqual([]);
    expect(await restarted.handle({ operation: 'status' })).toMatchObject({ enabled: false });
  });

  it('refuses damaged server media before it replaces local preferences', async () => {
    const server = createDavServer();
    await createFirstDevice(server).controller.handle({ operation: 'connect', config: DAV_CONFIG });
    const asset = [...server.files.entries()].find(([path]) => path.endsWith('.png'));
    expect(asset).toBeDefined();
    if (asset) {
      const damaged = asset[1].bytes.slice();
      damaged[20] ^= 1;
      asset[1].bytes = damaged;
    }
    const corrupt = createDevice(server, { sync: { [theme]: 'system' } });

    await expect(corrupt.controller.handle({ operation: 'connect', config: DAV_CONFIG, decision: 'remote' })).rejects.toThrow(/asset-integrity/);
    expect(corrupt.chrome.storage.sync.values[theme]).toBe('system');
    expect(corrupt.chrome.storage.local.values[settings.localPrimary.key]).toBeUndefined();
  });
});
