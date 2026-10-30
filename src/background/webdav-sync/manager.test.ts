import { describe, expect, it } from 'vitest';
import * as settings from '../../domain/settings';
import { createController } from './manager';
import { DAV_CONFIG, createDavServer, createDevice, field, routeByHost, storageSet } from '../../../tests/fakes/webdav';

const theme = settings.themeMode.key;
const language = settings.language.key;
const hintKey = settings.webdavConnections.key;
const secondConfig = { ...DAV_CONFIG, endpoint: 'https://second.test/dav/' };

function idOf(reply: unknown): string {
  const id = field(reply, 'id');
  if (typeof id !== 'string') throw new Error('the reply names no connection');
  return id;
}

async function connectionsOf(manager: ReturnType<typeof createController>) {
  const connections = (await manager.status()).connections;
  return connections;
}

// Resolves once called the given number of times, holding every caller.
function barrier(count: number) {
  let arrived = 0;
  let release = () => {};
  const passed = new Promise<void>((done) => {
    release = done;
  });
  return {
    arrived: () => arrived,
    release,
    wait: async () => {
      arrived += 1;
      if (arrived === count) release();
      await passed;
    }
  };
}

function twoServerDevice() {
  const first = createDavServer();
  const second = createDavServer();
  const device = createDevice(routeByHost({ 'second.test': second }, first), { sync: { [theme]: 'light' } }, { create: createController });
  return { first, second, device, manager: device.controller };
}

describe('several WebDAV connections', () => {
  it('are added locally, enabled each with its own alarm, and sync their servers in parallel', async () => {
    const { first, second, device, manager } = twoServerDevice();

    expect(await connectionsOf(manager)).toEqual([]);
    const a = idOf(await manager.handle({ operation: 'add', config: DAV_CONFIG }));
    const b = idOf(await manager.handle({ operation: 'add', config: secondConfig }));
    expect(a).not.toBe(b);
    expect(first.requests.length + second.requests.length).toBe(0);
    expect(await connectionsOf(manager)).toHaveLength(2);
    expect(JSON.stringify(await manager.status())).not.toContain(DAV_CONFIG.password);
    await Promise.all([a, b].map((id) => manager.handle({ operation: 'enable', id })));
    expect((await connectionsOf(manager)).every((connection) => connection.enabled)).toBe(true);
    expect(device.chrome.alarms.names.size).toBe(2);

    await storageSet(device.chrome.storage.sync, { [theme]: 'dark' });
    // Both servers must reach this point; a global sync queue would deadlock.
    const both = barrier(2);
    const timer = setTimeout(both.release, 1000);
    first.beforeRequest = second.beforeRequest = (path, init) => (path.endsWith('/state.json') && init.method === 'GET' ? both.wait() : undefined);
    await Promise.all([a, b].map((id) => manager.handle({ operation: 'sync', id })));
    clearTimeout(timer);
    expect(both.arrived()).toBeGreaterThanOrEqual(2);
    expect(first.state().data[theme]).toBe('dark');
    expect(second.state().data[theme]).toBe('dark');

    // Two incoming versions may download in parallel, but cannot interleave local commits.
    first.replaceState({ ...first.state().raw, data: { ...first.state().data, [language]: 'ja' } });
    second.replaceState({ ...second.state().raw, data: { ...second.state().data, [theme]: 'system' } });
    const incoming = barrier(2);
    first.beforeRequest = second.beforeRequest = (path, init) => (path.endsWith('/state.json') && init.method === 'GET' ? incoming.wait() : undefined);
    const results = await Promise.allSettled([a, b].map((id) => manager.handle({ operation: 'sync', id })));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected && rejected.status === 'rejected' ? field(rejected.reason, 'code') : undefined).toBe('local-changed');
    first.beforeRequest = second.beforeRequest = null;
    const pending = (await connectionsOf(manager)).find((connection) => connection.state === 'pending');
    expect(pending).toBeDefined();
    const pendingId = pending ? pending.id : a;
    await manager.handle({ operation: 'sync', id: pendingId });
    await manager.handle({ operation: 'sync', id: pendingId === a ? b : a });
    expect(first.state().data[theme]).toBe('system');
    expect(second.state().data[language]).toBe('ja');
  });

  it('pause and fail apart, and are removed with their credentials but without touching servers or Chrome', async () => {
    const { first, second, device, manager } = twoServerDevice();
    const a = idOf(await manager.handle({ operation: 'add', config: DAV_CONFIG }));
    const b = idOf(await manager.handle({ operation: 'add', config: secondConfig }));
    await Promise.all([a, b].map((id) => manager.handle({ operation: 'enable', id })));
    await manager.handle({ operation: 'pause', id: a });

    expect((await connectionsOf(manager)).find((connection) => connection.id === b)?.enabled).toBe(true);
    expect(device.chrome.alarms.names.size).toBe(1);
    first.offline = true;
    await manager.handle({ operation: 'enable', id: b });
    await expect(manager.handle({ operation: 'enable', id: a })).rejects.toThrow();
    expect((await connectionsOf(manager)).find((connection) => connection.id === b)?.state).toBe('ready');

    const firstFiles = structuredClone([...first.files]);
    const secondFiles = structuredClone([...second.files]);
    const chromeBefore = structuredClone(device.chrome.storage.sync.values);
    await manager.handle({ operation: 'remove', id: a });
    const withoutHints = (values: Record<string, unknown>) => Object.fromEntries(Object.entries(values).filter(([key]) => key !== hintKey));
    expect(withoutHints(device.chrome.storage.sync.values)).toEqual(withoutHints(chromeBefore));
    expect(device.chrome.storage.sync.values[hintKey]).toMatchObject({ items: [{ endpoint: 'https://second.test/dav/' }] });
    expect(field(device.chrome.storage.sync.values[hintKey], 'items')).toHaveLength(1);
    expect([...first.files]).toEqual(firstFiles);
    expect([...second.files]).toEqual(secondFiles);
    expect([...device.privateValues.keys()].some((key) => key.startsWith(`connection:${a}:`))).toBe(false);
    expect(await connectionsOf(manager)).toHaveLength(1);
    await expect(manager.handle({ operation: 'sync', id: a })).rejects.toThrow(/connection-missing/);
    await manager.handle({ operation: 'remove', id: b });
    expect(await connectionsOf(manager)).toEqual([]);
    expect(device.chrome.alarms.names.size).toBe(0);
    expect((await device.createController().status()).connections).toEqual([]);
  });

  it('migrate the single connection of an older version in place, and never reimport it once deleted', async () => {
    const legacy = createDevice(createDavServer(), { sync: { [theme]: 'light' } });
    await legacy.controller.handle({ operation: 'save', config: DAV_CONFIG });
    await legacy.controller.stop();
    const migrated = legacy.createWith(createController);

    expect((await connectionsOf(migrated))[0].id).toBe('default');
    expect(field(legacy.privateValues.get('session'), 'config', 'password')).toBe(DAV_CONFIG.password);
    await migrated.handle({ operation: 'remove', id: 'default' });
    expect(legacy.privateValues.has('session')).toBe(false);
    expect(await connectionsOf(legacy.createWith(createController))).toEqual([]);
    await expect(migrated.handle({ operation: 'add', config: { ...DAV_CONFIG, password: '' } })).rejects.toThrow(/missing-credentials/);
    expect(await connectionsOf(migrated)).toEqual([]);
  });

  it('do not upload while an interrupted local write of another connection is unrecovered', async () => {
    const partialA = createDavServer();
    const partialB = createDavServer();
    const device = createDevice(routeByHost({ 'second.test': partialB }, partialA), { sync: { [theme]: 'light' } }, { create: createController });
    const manager = device.controller;
    const a = idOf(await manager.handle({ operation: 'add', config: DAV_CONFIG }));
    const b = idOf(await manager.handle({ operation: 'add', config: secondConfig }));
    await Promise.all([a, b].map((id) => manager.handle({ operation: 'enable', id })));
    partialA.replaceState({ ...partialA.state().raw, data: { [theme]: 'dark' } });
    const replaceAll = device.wallpaperStore.replaceAll;
    let interrupted = false;
    device.wallpaperStore.replaceAll = async (records) => {
      await replaceAll(records);
      if (!interrupted) {
        interrupted = true;
        throw new Error('interrupted media commit');
      }
    };
    const statusOf = async (id: string) => (await connectionsOf(manager)).find((connection) => connection.id === id);

    await expect(manager.handle({ operation: 'sync', id: a })).rejects.toThrow();
    const puts = partialB.requestCount('PUT');
    await expect(manager.handle({ operation: 'sync', id: b })).rejects.toThrow(/interrupted-apply/);
    expect(partialB.requestCount('PUT')).toBe(puts);
    await expect(manager.handle({ operation: 'remove', id: a })).rejects.toThrow(/interrupted-apply/);
    expect(await statusOf(a)).toMatchObject({ needsRecovery: true });
    await manager.handle({ operation: 'sync', id: b });
    expect(await statusOf(b)).toMatchObject({ state: 'ready' });
    await manager.handle({ operation: 'restoreBackup', id: a });
    await manager.handle({ operation: 'sync', id: b });
    expect(await statusOf(b)).toMatchObject({ state: 'ready' });
    await manager.handle({ operation: 'remove', id: a });
    await manager.handle({ operation: 'remove', id: b });
  });
});

describe('adding and editing a connection', () => {
  it('keeps a connection that never reached the server in the form, and enables in one step after a test', async () => {
    const server = createDavServer();
    const manager = createDevice(server, { sync: { [theme]: 'light' } }, { create: createController }).controller;
    const probes = () => server.requestCount(undefined, (path) => path.includes('/probe-'));
    server.offline = true;

    await expect(manager.handle({ operation: 'add', config: DAV_CONFIG, enable: true })).rejects.toThrow(/network-error/);
    expect(await connectionsOf(manager)).toEqual([]);
    server.offline = false;
    await manager.handle({ operation: 'test', config: DAV_CONFIG });
    const tested = probes();
    expect(tested).toBeGreaterThan(0);
    const added = idOf(await manager.handle({ operation: 'add', config: DAV_CONFIG, enable: true }));
    expect(probes()).toBe(tested);
    expect((await connectionsOf(manager))[0]).toMatchObject({ id: added, enabled: true });
    expect(server.state().data[theme]).toBe('light');
  });

  it('refuses a duplicate, keeps an unchanged one running, and resumes an edited running one', async () => {
    const server = createDavServer();
    const manager = createDevice(server, { sync: { [theme]: 'light' } }, { create: createController }).controller;
    const added = idOf(await manager.handle({ operation: 'add', config: DAV_CONFIG, enable: true }));

    await expect(manager.handle({ operation: 'add', config: { ...DAV_CONFIG, endpoint: `${DAV_CONFIG.endpoint}/`, directory: '/lumno/' } }))
      .rejects.toThrow(/duplicate-connection/);
    const other = idOf(await manager.handle({ operation: 'add', config: { ...DAV_CONFIG, directory: 'second' } }));
    await expect(manager.handle({ operation: 'save', id: other, config: { ...DAV_CONFIG, password: '' } })).rejects.toThrow(/duplicate-connection/);
    expect(await connectionsOf(manager)).toHaveLength(2);
    await manager.handle({ operation: 'remove', id: other });
    expect(await manager.handle({ operation: 'save', id: added, config: { ...DAV_CONFIG, password: '' } })).toMatchObject({ unchanged: true });
    expect((await connectionsOf(manager))[0].enabled).toBe(true);
    expect(await manager.handle({ operation: 'save', id: added, resume: true, config: { ...DAV_CONFIG, directory: 'renamed', password: '' } }))
      .toMatchObject({ resumed: true });
    expect((await connectionsOf(manager))[0].enabled).toBe(true);

    await manager.handle({ operation: 'pause', id: added });
    server.offline = true;
    await expect(manager.handle({ operation: 'enable', id: added })).rejects.toThrow();
    expect((await connectionsOf(manager))[0]).toMatchObject({ enabled: false, error: 'network-error' });
    server.offline = false;
    await manager.handle({ operation: 'pause', id: added });
    expect((await connectionsOf(manager))[0].error).toBeNull();
  });
});

// Connection details follow the user to other devices through browser sync;
// the app password never does.
describe('synced connection hints', () => {
  it('are published once without the password and offered on other devices until added or dismissed', async () => {
    const server = createDavServer();
    const laptop = createDevice(server, {}, { create: createController });
    const added = idOf(await laptop.controller.handle({ operation: 'add', config: DAV_CONFIG }));
    const published = structuredClone(laptop.chrome.storage.sync.values[hintKey]);

    expect(published).toEqual({ version: 1, items: [{ endpoint: DAV_CONFIG.endpoint, directory: 'lumno', username: 'user' }] });
    expect(JSON.stringify(laptop.chrome.storage.sync.values)).not.toContain(DAV_CONFIG.password);
    expect((await laptop.controller.status()).suggestions).toEqual([]);
    const desktop = createDevice(server, { sync: { [hintKey]: published } }, { create: createController });
    expect((await desktop.controller.status()).suggestions).toEqual(field(published, 'items'));
    await desktop.controller.handle({ operation: 'dismissSuggestion', config: { endpoint: DAV_CONFIG.endpoint, directory: 'lumno', username: 'user' } });
    expect((await desktop.controller.status()).suggestions).toEqual([]);
    expect(desktop.chrome.storage.sync.values[hintKey]).toEqual(published);
    const phone = createDevice(server, { sync: { [hintKey]: published } }, { create: createController });
    await phone.controller.handle({ operation: 'add', config: DAV_CONFIG });
    expect((await phone.controller.status()).suggestions).toEqual([]);
    expect(phone.chrome.storage.sync.values[hintKey]).toEqual(published);

    await laptop.controller.handle({ operation: 'save', id: added, config: { ...DAV_CONFIG, directory: 'moved' } });
    expect(laptop.chrome.storage.sync.values[hintKey]).toMatchObject({ items: [{ directory: 'moved' }] });
    // A device that still uses a connection restores it right after another device withdraws it.
    await storageSet(laptop.chrome.storage.sync, { [hintKey]: { version: 1, items: [] } });
    await new Promise((done) => setTimeout(done, 0));
    await laptop.controller.status();
    expect(laptop.chrome.storage.sync.values[hintKey]).toMatchObject({ items: [{ directory: 'moved' }] });
    // Connections added before hints existed are published on the next start.
    await new Promise<void>((done) => laptop.chrome.storage.sync.remove([hintKey], done));
    await laptop.createController().status();
    expect(laptop.chrome.storage.sync.values[hintKey]).toMatchObject({ items: [{ directory: 'moved' }] });
  });

  it('ignore malformed or oversized entries from another version', async () => {
    const noisy = createDevice(createDavServer(), { sync: { [hintKey]: { version: 1, items: [
      { endpoint: 'http://plain.test/', directory: 'lumno', username: 'user' },
      { endpoint: 'https://long.test/', directory: 'lumno', username: 'x'.repeat(250), password: 'leak' },
      { endpoint: `https://${'a'.repeat(600)}.test/`, directory: 'lumno', username: 'user' }] } } }, { create: createController });
    const offered = (await noisy.controller.status()).suggestions;

    expect(offered.map((item) => item.endpoint)).toEqual(['https://long.test/']);
    expect(Object.hasOwn(offered[0], 'password')).toBe(false);
  });
});
