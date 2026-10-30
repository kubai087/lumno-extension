import { describe, expect, it } from 'vitest';
import * as settings from '../../domain/settings';
import { createProviderStorageRuntime } from '../../platform/provider-storage';
import { DAV_CONFIG, LOCK_PATH, createDavServer, createDevice, field, isRecord, storageSet } from '../../../tests/fakes/webdav';

const theme = settings.themeMode.key;
const language = settings.language.key;
const customSearch = settings.siteSearchCustom.key;
const engine = (name: string) => [{ name, url: `https://${name}.example/?q=%s` }];
const ETAG_MODES: ('weak' | 'none' | 'strong')[] = ['weak', 'none', 'strong'];
const sessionConfig = (values: Map<string, unknown>, name: string) => field(values.get('session'), 'config', name);

describe('connecting a server', () => {
  // Small probe files keep a strong ETag while a compressed state.json gets a
  // weak one; the SHA-256 revision and write lock make that irrelevant.
  it('syncs a conditional server that weakens the ETag of a compressed state', async () => {
    const server = createDavServer();
    server.compressAbove = 64;
    const device = createDevice(server, { sync: { [theme]: 'light' } });
    await device.controller.handle({ operation: 'connect', config: DAV_CONFIG });

    expect(sessionConfig(device.privateValues, 'concurrency')).toBe('conditional');
    await storageSet(device.chrome.storage.sync, { [theme]: 'dark' });
    await device.createController().handle({ operation: 'sync' });
    expect(server.state().data[theme]).toBe('dark');
  });

  // Firefox unloads an idle event page even with requests pending, which
  // would strand the write lock.
  it('keeps the background alive while a sync runs, and only then', async () => {
    const server = createDavServer();
    server.afterPut = () => new Promise((done) => setTimeout(done, 25));
    let ticks = 0;
    const device = createDevice(server, { sync: { [theme]: 'light' } }, {
      extra: { keepAliveIntervalMs: 5 },
      configure: (deviceChrome) => {
        deviceChrome.runtime.getPlatformInfo = () => {
          ticks += 1;
          return Promise.resolve({});
        };
      }
    });
    await device.controller.handle({ operation: 'connect', config: DAV_CONFIG });

    expect(ticks).toBeGreaterThan(0);
    const settled = ticks;
    await new Promise((done) => setTimeout(done, 40));
    expect(ticks).toBe(settled);
  });

  it.each(ETAG_MODES)('syncs two devices through the collection lock on a server with %s ETags', async (etagMode) => {
    const server = createDavServer();
    server.ignoreConditions = true;
    server.etagMode = etagMode;
    const a = createDevice(server, { sync: { [theme]: 'light', [language]: 'en' } });
    await a.controller.handle({ operation: 'connect', config: DAV_CONFIG });
    expect(sessionConfig(a.privateValues, 'concurrency')).toBe('collection-lock');
    const b = createDevice(server, { sync: { [theme]: 'system' } });
    await b.controller.handle({ operation: 'connect', config: DAV_CONFIG, decision: 'remote' });
    await storageSet(a.chrome.storage.sync, { [theme]: 'dark' });
    await storageSet(b.chrome.storage.sync, { [language]: 'ja' });
    await a.createController().handle({ operation: 'sync' });
    await b.controller.handle({ operation: 'sync' });
    await a.controller.handle({ operation: 'sync' });

    expect(server.state().data).toEqual({ [theme]: 'dark', [language]: 'ja' });
    expect(server.directories.has(LOCK_PATH)).toBe(false);
    expect(a.chrome.storage.sync.values[theme]).toBe('dark');
    await storageSet(a.chrome.storage.sync, { [customSearch]: engine('a') });
    await storageSet(b.chrome.storage.sync, { [customSearch]: engine('b') });
    await a.controller.handle({ operation: 'sync' });
    expect(await b.controller.handle({ operation: 'sync' })).toMatchObject({ conflict: true });
  });

  it('keeps the verified MKCOL fallback across worker restarts', async () => {
    const server = createDavServer();
    server.moveUnsupported = true;
    server.etagMode = 'none';
    const device = createDevice(server, { sync: { [theme]: 'dark' } });
    await device.controller.handle({ operation: 'connect', config: DAV_CONFIG });

    expect(sessionConfig(device.privateValues, 'lockStrategy')).toBe('collection-create');
    await storageSet(device.chrome.storage.sync, { [theme]: 'light' });
    await device.createController().handle({ operation: 'sync' });
    expect(server.state().data[theme]).toBe('light');
  });
});

describe('saving and enabling a connection', () => {
  it('saves locally while offline and enables later, after a restart, from the saved credentials', async () => {
    const server = createDavServer();
    server.offline = true;
    const saved = createDevice(server, { sync: { [theme]: 'dark' } });

    await expect(saved.controller.handle({ operation: 'enable' })).rejects.toThrow(/missing-credentials/);
    const before = structuredClone(saved.chrome.storage.sync.values);
    await saved.controller.handle({ operation: 'save', config: DAV_CONFIG });
    expect(server.requests).toHaveLength(0);
    expect(saved.chrome.storage.sync.values).toEqual(before);
    expect(await saved.controller.status()).toMatchObject({ enabled: false, syncRevision: 'dav-multi-1' });
    expect(sessionConfig(saved.privateValues, 'password')).toBe(DAV_CONFIG.password);
    expect(JSON.stringify(await saved.controller.status())).not.toContain(DAV_CONFIG.password);

    const restarted = saved.createController();
    await restarted.handle({ operation: 'save', config: { ...DAV_CONFIG, password: '' } });
    server.offline = false;
    server.unsafeCollections = true;
    server.moveConflictStatus = 409;
    server.etagMode = 'weak';
    await restarted.handle({ operation: 'enable' });
    expect((await restarted.status()).enabled).toBe(true);
    expect(createProviderStorageRuntime(saved.chrome).getActiveAreaName()).toBe('sync');
  });

  it('reuses the saved capability check across toggles and restarts, and probes again when it is outdated or asked for', async () => {
    const server = createDavServer();
    server.unsafeCollections = true;
    server.moveConflictStatus = 409;
    server.etagMode = 'weak';
    const saved = createDevice(server, { sync: { [theme]: 'dark' } });
    const restarted = saved.createController();
    await restarted.handle({ operation: 'save', config: DAV_CONFIG });
    await restarted.handle({ operation: 'enable' });
    const probes = () => server.requestCount(undefined, (path) => path.includes('/probe-'));
    const initial = probes();

    expect(initial).toBeGreaterThan(0);
    for (let index = 0; index < 8; index += 1) {
      await restarted.handle({ operation: 'pause' });
      await storageSet(saved.chrome.storage.sync, { [theme]: index % 2 ? 'dark' : 'light' });
      await saved.createController().handle({ operation: 'enable' });
      expect(server.state().data[theme]).toBe(index % 2 ? 'dark' : 'light');
      expect((await restarted.status()).enabled).toBe(true);
    }
    expect(probes()).toBe(initial);
    expect(sessionConfig(saved.privateValues, 'lockStrategy')).toBe('collection-move');

    const session = saved.privateValues.get('session');
    const config = field(session, 'config');
    if (!isRecord(session) || !isRecord(config)) throw new Error('no saved session');
    saved.privateValues.set('session', { ...session, config: { ...config, clientRevision: 'dav-lock-4', lockStrategy: 'collection-create' } });
    await saved.createController().handle({ operation: 'sync' });
    expect(probes()).toBeGreaterThan(initial);
    expect(sessionConfig(saved.privateValues, 'clientRevision')).toBe('dav-lock-5');
    expect(sessionConfig(saved.privateValues, 'lockStrategy')).toBe('collection-move');
    const updated = probes();
    await restarted.handle({ operation: 'test', config: { ...DAV_CONFIG, password: '' } });
    expect(probes()).toBeGreaterThan(updated);
  });

  it('pauses, forgets the baseline and checks again when the saved server changes', async () => {
    const server = createDavServer();
    const saved = createDevice(server, { sync: { [theme]: 'dark' } });
    await saved.controller.handle({ operation: 'save', config: DAV_CONFIG });
    await saved.controller.handle({ operation: 'enable' });
    const probes = () => server.requestCount(undefined, (path) => path.includes('/probe-'));
    const before = structuredClone(saved.chrome.storage.sync.values);
    await saved.controller.handle({ operation: 'save', config: { ...DAV_CONFIG, directory: 'other-directory', password: '' } });

    expect((await saved.controller.status()).enabled).toBe(false);
    expect(field(saved.privateValues.get('session'), 'base')).toBeNull();
    expect((await saved.controller.status()).lastSyncAt).toBeNull();
    expect(saved.chrome.storage.sync.values).toEqual(before);
    expect(sessionConfig(saved.privateValues, 'clientRevision')).toBeUndefined();
    const beforeNewDirectory = probes();
    await saved.controller.handle({ operation: 'enable' });
    expect(probes()).toBeGreaterThan(beforeNewDirectory);
  });
});

describe('recovering an interrupted apply', () => {
  it('commits a complete migration whose last step was interrupted on restart', async () => {
    const server = createDavServer();
    const device = createDevice(server, { sync: { [theme]: 'light' } });
    const put = device.privateStore.put;
    let interrupt = true;
    device.privateStore.put = async (key, value) => {
      if (interrupt && key === 'session') {
        interrupt = false;
        throw new Error('worker terminated');
      }
      return put(key, value);
    };

    await expect(device.controller.handle({ operation: 'connect', config: DAV_CONFIG })).rejects.toThrow(/worker terminated/);
    expect(device.privateValues.get('pendingApply')).toBeTruthy();
    expect(await device.createController().handle({ operation: 'status' })).toMatchObject({ enabled: true });
    expect(device.privateValues.get('pendingApply')).toBeNull();
    expect(field(device.privateValues.get('session'), 'base', 'data', theme)).toBe('light');
  });
});

describe('a conflict', () => {
  it('names only what both sides changed apart, survives automatic retries and resolves keeping unrelated edits', async () => {
    const base = { [theme]: 'light', [language]: 'en', [customSearch]: engine('base') };
    const server = createDavServer();
    const device = createDevice(server, { sync: base });
    await device.controller.handle({ operation: 'connect', config: DAV_CONFIG });
    await storageSet(device.chrome.storage.sync, { [theme]: 'dark', [language]: 'ja', [customSearch]: engine('local') });
    server.replaceState({ version: 1, data: { [theme]: 'system', [language]: 'en', [customSearch]: engine('remote'), [settings.simpleModeEnabled.key]: true },
      shortcuts: [], icons: {}, wallpapers: [], assets: {} });

    expect(await device.controller.handle({ operation: 'sync' })).toMatchObject({ conflict: true });
    expect(await device.controller.handle({ operation: 'conflictDetails' })).toMatchObject({ items: [
      { key: theme, domain: 'preference', local: { kind: 'text', value: 'dark' }, remote: { kind: 'text', value: 'system' } },
      { key: customSearch, domain: 'preference', local: { kind: 'list', count: 1 }, remote: { kind: 'list', count: 1 } }
    ] });
    const remoteBefore = server.state();
    await device.controller.handle({ operation: 'sync' });
    expect(server.state()).toEqual(remoteBefore);
    await device.controller.handle({ operation: 'sync', decision: 'remote' });
    expect(device.chrome.storage.sync.values[theme]).toBe('system');
    expect(device.chrome.storage.sync.values[language]).toBe('ja');
    expect(server.state().data[settings.simpleModeEnabled.key]).toBe(true);
  });
});

describe('an older installation that kept settings on this device', () => {
  it('moves them into browser sync without losing edits', async () => {
    const migrated = createDevice(createDavServer(), { sync: { [theme]: 'light' }, local: { [settings.localPrimary.key]: true, [theme]: 'dark' } });
    await migrated.controller.mirrorChrome();

    expect(createProviderStorageRuntime(migrated.chrome).getActiveAreaName()).toBe('sync');
    expect(migrated.chrome.storage.sync.values[theme]).toBe('dark');
  });

  it('does not partly overwrite browser sync with settings that do not fit it', async () => {
    const tooLarge = createDevice(createDavServer(), { sync: { [theme]: 'light' },
      local: { [settings.localPrimary.key]: true, [theme]: 'dark', [customSearch]: 'x'.repeat(120 * 1024) } });

    await expect(tooLarge.controller.mirrorChrome()).rejects.toThrow(/chrome-capacity/);
    expect(tooLarge.chrome.storage.sync.values[theme]).toBe('light');
    expect(String(tooLarge.chrome.storage.local.values[customSearch])).toHaveLength(120 * 1024);
  });
});
