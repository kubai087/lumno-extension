import { describe, expect, it, vi } from 'vitest';
import * as settings from '../../domain/settings';
import { STALE_LOCK_MS } from '../webdav-client/errors';
import { ALARM_NAME } from './constants';
import { createConnectionController } from './connection-controller';
import { DAV_CONFIG, LOCK_PATH, createDavServer, createDevice, field, storageSet } from '../../../tests/fakes/webdav';
import type { DavServer } from '../../../tests/fakes/webdav';

const theme = settings.themeMode.key;
const language = settings.language.key;
const customSearch = settings.siteSearchCustom.key;
const quiet = { logger: { warn() {} } };
// Local edits start a round after this debounce.
const AFTER_EDITS_MS = 1700;

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function statusOf(device: { controller: ReturnType<typeof createConnectionController> }) {
  return device.controller.handle({ operation: 'status' });
}

// Waits until the controller's queue is idle and the status leaves 'syncing'.
async function settle(device: { controller: ReturnType<typeof createConnectionController> }) {
  await vi.waitFor(async () => expect(await statusOf(device)).not.toMatchObject({ state: 'syncing' }), { timeout: 2000, interval: 10 });
  return statusOf(device);
}

async function connected(server: DavServer, sync: Record<string, unknown>, extra = {}) {
  const device = createDevice(server, { sync }, { extra: { ...quiet, ...extra } });
  await device.controller.handle({ operation: 'connect', config: DAV_CONFIG });
  return device;
}

describe('another browser holding the write lock', () => {
  it('is retried on a timer, and reported only when it outlasts every retry', async () => {
    const server = createDavServer();
    const device = await connected(server, { [theme]: 'light' }, { contentionDelays: [5, 5] });
    server.directories.add(LOCK_PATH);
    await storageSet(device.chrome.storage.sync, { [theme]: 'dark' });

    expect(await device.controller.handle({ operation: 'sync' })).toEqual({ pending: true });
    server.directories.delete(LOCK_PATH);
    await vi.waitFor(() => expect(server.state().data[theme]).toBe('dark'));
    expect(await statusOf(device)).toMatchObject({ state: 'ready' });

    server.directories.add(LOCK_PATH);
    await storageSet(device.chrome.storage.sync, { [theme]: 'light' });
    await vi.waitFor(async () => expect(await statusOf(device)).toMatchObject({ state: 'error', error: 'remote-locked' }),
      { timeout: 4000, interval: 20 });
    expect(server.state().data[theme]).toBe('dark');
    await device.controller.handle({ operation: 'pause' });
  });

  // Firefox would unload an idle page and drop the queued retry.
  it('keeps the background alive while the retry waits, and stops once it ran', async () => {
    const server = createDavServer();
    let ticks = 0;
    const device = createDevice(server, { sync: { [theme]: 'light' } }, {
      extra: { contentionDelays: [120], keepAliveIntervalMs: 5 },
      configure: (deviceChrome) => {
        deviceChrome.runtime.getPlatformInfo = () => {
          ticks += 1;
          return Promise.resolve({});
        };
      }
    });
    await device.controller.handle({ operation: 'connect', config: DAV_CONFIG });
    await wait(AFTER_EDITS_MS);
    server.directories.add(LOCK_PATH);
    await storageSet(device.chrome.storage.sync, { [theme]: 'dark' });

    expect(await device.controller.handle({ operation: 'sync' })).toEqual({ pending: true });
    const queuedAt = ticks;
    await wait(60);
    expect(ticks).toBeGreaterThan(queuedAt);
    server.directories.delete(LOCK_PATH);
    await vi.waitFor(async () => expect(await statusOf(device)).toMatchObject({ state: 'ready' }), { timeout: 2000, interval: 20 });
    expect(server.state().data[theme]).toBe('dark');
    const doneAt = ticks;
    await wait(60);
    expect(ticks).toBe(doneAt);
    await device.controller.handle({ operation: 'pause' });
  });
});

// Nutstore answers 503 once an account sent too many requests, and keeps
// refusing while it is polled.
describe('a server that refuses requests for a while', () => {
  it('is left alone by background rounds until the planned retry, which the card shows', async () => {
    const server = createDavServer();
    let clockNow = Date.now();
    const busy = await connected(server, { [theme]: 'light' }, { throttleDelays: [60000, 120000], now: () => clockNow });
    await wait(AFTER_EDITS_MS);
    server.refuseWith = { status: 503, retryAfter: '600' };
    await storageSet(busy.chrome.storage.sync, { [theme]: 'dark' });
    const refused = await busy.controller.handle({ operation: 'sync' });

    expect(refused).toEqual({ pending: true, retryAt: clockNow + 600000 });
    expect(await statusOf(busy)).toMatchObject({ state: 'pending', error: 'http-503', retryAt: clockNow + 600000 });
    const quietFrom = server.requests.length;
    busy.chrome.alarms.fire(ALARM_NAME);
    await storageSet(busy.chrome.storage.sync, { [language]: 'ja' });
    await wait(AFTER_EDITS_MS);
    await statusOf(busy);
    expect(server.requests).toHaveLength(quietFrom);

    // Without Retry-After the waits grow; a sync the user asks for still reaches the server.
    server.refuseWith = { status: 429 };
    const again = await busy.controller.handle({ operation: 'sync' });
    expect(server.requests.length).toBeGreaterThan(quietFrom);
    const retryAt = Number(field(again, 'retryAt'));
    expect(retryAt).toBeGreaterThanOrEqual(clockNow + 108000);
    expect(retryAt).toBeLessThanOrEqual(clockNow + 132000);
    expect(await statusOf(busy)).toMatchObject({ error: 'http-429' });

    server.refuseWith = null;
    clockNow = retryAt + 1;
    busy.chrome.alarms.fire(ALARM_NAME);
    expect(await statusOf(busy)).toMatchObject({ state: 'ready', retryAt: null });
    expect(server.state().data).toMatchObject({ [theme]: 'dark', [language]: 'ja' });
    expect(await busy.privateStore.get('throttle')).toBeNull();

    server.refuseWith = { status: 503 };
    await storageSet(busy.chrome.storage.sync, { [theme]: 'light' });
    expect(Number(field(await busy.controller.handle({ operation: 'sync' }), 'retryAt'))).toBeLessThanOrEqual(clockNow + 66000);

    // A device clock set back leaves the saved end far ahead; background rounds ignore it.
    server.refuseWith = null;
    clockNow -= 24 * 60 * 60 * 1000;
    const rewoundFrom = server.requests.length;
    busy.chrome.alarms.fire(ALARM_NAME);
    expect(await statusOf(busy)).toMatchObject({ state: 'ready' });
    expect(server.requests.length).toBeGreaterThan(rewoundFrom);
    expect(await busy.privateStore.get('throttle')).toBeNull();

    // A full join the server answers starts the waits over as well.
    server.refuseWith = { status: 429 };
    await storageSet(busy.chrome.storage.sync, { [theme]: 'dark' });
    await busy.controller.handle({ operation: 'sync' });
    await busy.controller.handle({ operation: 'sync' });
    expect(field(await busy.privateStore.get('throttle'), 'attempt')).toBe(1);
    server.refuseWith = null;
    expect(await busy.controller.handle({ operation: 'connect', config: DAV_CONFIG, decision: 'remote' })).toEqual({ ok: true });
    expect(await busy.privateStore.get('throttle')).toBeNull();
    await busy.controller.handle({ operation: 'pause' });
    expect(await busy.privateStore.get('throttle')).toBeNull();
  });
});

describe('the daily sweep', () => {
  it('removes folders of abandoned lock attempts, at most once a day', async () => {
    const server = createDavServer();
    let clockNow = Date.now();
    const sweeper = await connected(server, { [theme]: 'light' }, { now: () => clockNow });
    const leftover = '/dav/lumno/v1/lock-candidate-left-over/';
    server.directories.add(leftover);
    server.directoryTimes.set(leftover, Date.now() - STALE_LOCK_MS - 1000);
    clockNow += 25 * 60 * 60 * 1000;
    await sweeper.controller.handle({ operation: 'sync' });

    expect(server.directories.has(leftover)).toBe(false);
    server.directories.add(leftover);
    const listed = server.requestCount('PROPFIND');
    await sweeper.controller.handle({ operation: 'sync' });
    expect(server.requestCount('PROPFIND')).toBe(listed);
    await sweeper.controller.handle({ operation: 'pause' });
  });
});

describe('background rounds', () => {
  it('start on Chrome changes and manual Chrome syncs, and stop when WebDAV is off', async () => {
    const server = createDavServer();
    const auto = createDevice(server, { sync: { [theme]: 'light' } });
    await auto.controller.handle({ operation: 'save', config: DAV_CONFIG });
    await auto.controller.handle({ operation: 'enable' });
    await storageSet(auto.chrome.storage.sync, {
      [theme]: 'dark', [settings.simpleModeEnabled.key]: true,
      [settings.aggregateSearches.key]: [{ id: 'research', name: 'Research', providers: ['gg', 'bd'] }],
      [customSearch]: [{ key: 'docs', name: 'Docs', template: 'https://example.com/?q={query}' }],
      _x_extension_search_blacklist_2026_unique_: ['https://hidden.example/']
    });

    await vi.waitFor(() => expect(server.state().data[theme]).toBe('dark'), { timeout: 3000, interval: 50 });
    const data = server.state().data;
    expect(data[settings.simpleModeEnabled.key]).toBe(true);
    expect(data[settings.aggregateSearches.key]).toMatchObject([{ id: 'research' }]);
    expect(data[customSearch]).toMatchObject([{ key: 'docs' }]);
    expect(data._x_extension_search_blacklist_2026_unique_).toEqual(['https://hidden.example/']);
    const beforeManual = server.requests.length;
    await storageSet(auto.chrome.storage.sync, { _x_extension_sync_meta_2024_unique_: { lastSyncAt: Date.now(), source: 'manual' } });
    await vi.waitFor(() => expect(server.requests.length).toBeGreaterThan(beforeManual), { timeout: 3000, interval: 50 });
    await settle(auto);
    await auto.controller.handle({ operation: 'pause' });
    const beforePaused = server.requests.length;
    await storageSet(auto.chrome.storage.sync, { [theme]: 'light' });
    await wait(AFTER_EDITS_MS);
    expect(server.requests).toHaveLength(beforePaused);
    expect(auto.chrome.storage.sync.values[theme]).toBe('light');
  });

  it('do not take the writes of an applied server change for local edits', async () => {
    const server = createDavServer();
    const applying = await connected(server, { [theme]: 'light' });
    await wait(AFTER_EDITS_MS);
    server.replaceState({ ...server.state().raw, data: { ...server.state().data, [theme]: 'dark' } });
    await applying.controller.handle({ operation: 'sync' });

    expect(applying.chrome.storage.sync.values[theme]).toBe('dark');
    const afterApply = server.requests.length;
    await wait(AFTER_EDITS_MS);
    expect(server.requests).toHaveLength(afterApply);
    await storageSet(applying.chrome.storage.sync, { [theme]: 'light' });
    await vi.waitFor(() => expect(server.state().data[theme]).toBe('light'), { timeout: 3000, interval: 50 });
    await settle(applying);
    await applying.controller.handle({ operation: 'pause' });
  });

  it('report a browser sync backup that does not fit, without stopping the WebDAV round', async () => {
    const server = createDavServer();
    const stalled = await connected(server, { [theme]: 'light' });
    await storageSet(stalled.chrome.storage.local, { [settings.localPrimary.key]: true, [theme]: 'dark', [customSearch]: 'x'.repeat(120 * 1024) });
    const before = server.requests.length;
    stalled.chrome.alarms.fire(ALARM_NAME);
    const status = await settle(stalled);

    expect(server.requests.length).toBeGreaterThan(before);
    expect(status).toMatchObject({ chromeBackup: 'incomplete', state: 'error', error: 'chrome-capacity' });
    expect(stalled.chrome.storage.sync.values[theme]).toBe('light');
  });

  it('log a failure they could not record as a status', async () => {
    const server = createDavServer();
    const logged: string[] = [];
    const broken = createDevice(server, { sync: { [theme]: 'light' } }, { extra: { logger: { warn: (message) => logged.push(message) } } });
    await broken.controller.handle({ operation: 'connect', config: DAV_CONFIG });
    const set = broken.chrome.storage.local.set;
    broken.chrome.storage.local.set = (payload, callback) => {
      if (Object.keys(payload).some((key) => key.startsWith(settings.webdavStatus.key))) {
        broken.chrome.runtime.lastError = { message: 'QUOTA_BYTES quota exceeded' };
        if (callback) callback();
        broken.chrome.runtime.lastError = null;
        return;
      }
      set(payload, callback);
    };
    broken.chrome.alarms.fire(ALARM_NAME);

    await vi.waitFor(() => expect(logged.some((message) => /WebDAV sync failed/.test(message))).toBe(true), { timeout: 1000, interval: 10 });
    broken.chrome.storage.local.set = set;
  });
});
