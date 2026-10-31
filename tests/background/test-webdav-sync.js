const assert = require('assert');
const fs = require('fs');
const { webcrypto, randomUUID } = require('crypto');
const settings = require('../../src/domain/settings/index.ts');
const settingsStorage = require('../helpers/settings-storage.ts');
const shortcuts = require('../helpers/shortcuts-store.ts');
const contract = require('../helpers/webdav-contract.ts');
const client = {
  ...require('../helpers/webdav-client.ts'),
  ...require('../../src/background/webdav-client/errors.ts')
};
const syncApi = {
  ...require('../../src/background/webdav-sync/connection-controller.ts'),
  ...require('../../src/background/webdav-sync/records.ts'),
  ...require('../../src/background/webdav-sync/constants.ts')
};
const { probeProvider } = require('../../scripts/dev/probe-webdav.js');
const { newtabShortcutsLegacy, shortcutFolderBindings } = require('../../src/domain/settings/newtab-shortcuts.ts');
const cryptoApi = { subtle: webcrypto.subtle, randomUUID };
const config = { endpoint: 'https://dav.example.test/dav/', directory: 'lumno', username: 'user', password: 'app-password' };
const theme = settings.themeMode.key;
const language = '_x_extension_language_2024_unique_';
const customSearch = '_x_extension_site_search_custom_2024_unique_';
const engine = (name) => [{ name, url: `https://${name}.example/?q=%s` }];

function createServer() {
  const files = new Map();
  const directories = new Set();
  let revision = 0;
  const server = { files, directories, requests: [], offline: false, ignoreConditions: false,
    unsafeCollections: false, brokenDelete: false, etagMode: 'strong', beforeRequest: null, afterPut: null,
    rejectStatePut: 0, ignoreMoveOverwrite: false, moveConflictStatus: 412, moveUnsupported: false,
    loseMoveSource: false, refuseMoves: 0, refusalStillMoves: false, refuseCollections: false, compressAbove: 0,
    // { status, retryAfter?, when?(path, method) }: a rate limit such as Nutstore's 503 BlockedTemporarily.
    refuseWith: null,
    // Nutstore answers GET without Last-Modified; PROPFIND still reports it.
    omitLastModified: false, directoryTimes: new Map(),
    // The server clock behind Date and Last-Modified.
    now: () => Date.now() };
  server.fetch = async (url, options) => {
    if (server.offline) throw new Error('network is offline');
    const path = new URL(url).pathname;
    const headers = new Headers(options.headers);
    assert.strictEqual(headers.get('Authorization'), `Basic ${Buffer.from('user:app-password').toString('base64')}`);
    assert.strictEqual(options.redirect, 'error');
    assert.strictEqual(options.credentials, 'omit');
    server.requests.push({ path, method: options.method });
    if (server.beforeRequest) await server.beforeRequest(path, options);
    if (server.refuseWith && (!server.refuseWith.when || server.refuseWith.when(path, options.method))) {
      return new Response('BlockedTemporarily', { status: server.refuseWith.status,
        headers: server.refuseWith.retryAfter ? { 'Retry-After': server.refuseWith.retryAfter } : {} });
    }
    const entry = files.get(path);
    const response = (status, bytes, etag, modified) => new Response([204, 304].includes(status) || options.method === 'HEAD' ? null : bytes || '', {
      // compressAbove mimics Cloudflare weakening strong ETags on bodies it compresses.
      status, headers: { ...(etag && server.etagMode !== 'none' ? { ETag: server.etagMode === 'weak' ||
        (server.compressAbove && bytes && bytes.byteLength > server.compressAbove) ? `W/${etag}` : etag } : {}), 'Content-Length': String(bytes && bytes.byteLength || 0),
      Date: new Date(server.now()).toUTCString(), ...(modified && !server.omitLastModified ? { 'Last-Modified': new Date(modified).toUTCString() } : {}) }
    });
    if (options.method === 'MKCOL') {
      if (server.refuseCollections) return response(405);
      if (directories.has(path) && !server.unsafeCollections) return response(405);
      directories.add(path);
      server.directoryTimes.set(path, server.now());
      return response(201);
    }
    if (options.method === 'PROPFIND') {
      const depth = headers.get('Depth');
      const entries = [];
      if (files.has(path)) entries.push([path, files.get(path).modified]);
      else if (directories.has(path)) {
        entries.push([path, server.directoryTimes.get(path)]);
        if (depth === '1') {
          const children = new Set([...directories, ...files.keys()].filter((name) => name !== path && name.startsWith(path) &&
            !name.slice(path.length).replace(/\/$/, '').includes('/')));
          // Nutstore lists child folders without their trailing slash.
          for (const name of children) entries.push([directories.has(name) ? name.replace(/\/$/, '') : name,
            directories.has(name) ? server.directoryTimes.get(name) : files.get(name).modified]);
        }
      } else return response(404);
      const xml = '<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">' + entries.map(([name, time]) =>
        `<d:response><d:href>${name}</d:href><d:propstat><d:prop>${time ? `<d:getlastmodified>${new Date(time).toUTCString()}</d:getlastmodified>` : ''}</d:prop></d:propstat></d:response>`).join('') + '</d:multistatus>';
      return response(207, new TextEncoder().encode(xml));
    }
    if (options.method === 'GET' || options.method === 'HEAD') {
      if (server.stateStatus && path.endsWith('/state.json')) return response(server.stateStatus);
      if (!entry) return response(404);
      if (headers.get('If-None-Match') === entry.etag) return response(304, null, entry.etag);
      return response(200, entry.bytes, entry.etag, entry.modified);
    }
    if (options.method === 'DELETE') {
      if (!server.brokenDelete) {
        for (const name of [...files.keys()]) if (name === path || (path.endsWith('/') && name.startsWith(path))) files.delete(name);
        directories.delete(path);
      }
      return response(204);
    }
    if (options.method === 'MOVE') {
      if (server.moveUnsupported) return response(405);
      const destination = new URL(headers.get('Destination')).pathname;
      assert.strictEqual(headers.get('Overwrite'), 'F');
      if (!directories.has(path)) return response(404);
      const exists = directories.has(destination);
      const refused = server.refuseMoves > 0;
      if (refused) server.refuseMoves -= 1;
      if (refused || (exists && !server.ignoreMoveOverwrite)) {
        if (server.loseMoveSource) {
          for (const name of [...files.keys()]) if (name.startsWith(path)) files.delete(name);
          directories.delete(path);
        }
        return response(refused ? 500 : server.moveConflictStatus);
      }
      for (const [name] of files) if (name.startsWith(destination)) files.delete(name);
      for (const [name, value] of [...files]) {
        if (name.startsWith(path)) { files.set(destination + name.slice(path.length), value); files.delete(name); }
      }
      directories.delete(path);
      directories.add(destination);
      return response(server.refusalStillMoves ? 500 : exists ? 204 : 201);
    }
    assert.strictEqual(options.method, 'PUT');
    if (server.rejectStatePut && path.endsWith('/state.json')) return response(server.rejectStatePut);
    if (!server.ignoreConditions && ((headers.has('If-Match') && (!entry || entry.etag !== headers.get('If-Match'))) ||
        (headers.get('If-None-Match') === '*' && entry))) return response(412);
    const bytes = typeof options.body === 'string' ? new TextEncoder().encode(options.body) : new Uint8Array(options.body);
    // 'size' mimics ETags built from size and a one-second mtime (sabre/dav FSExt).
    const next = { bytes, etag: server.etagMode === 'size' ? `"size-${bytes.byteLength}"` : `"revision-${++revision}"`, modified: server.now() };
    files.set(path, next);
    if (server.afterPut) await server.afterPut(path, options);
    return response(entry ? 204 : 201, null, next.etag);
  };
  server.state = () => JSON.parse(new TextDecoder().decode(files.get('/dav/lumno/v1/state.json').bytes));
  server.replaceState = (value) => files.set('/dav/lumno/v1/state.json', {
    bytes: new TextEncoder().encode(JSON.stringify(value)), etag: `"revision-${++revision}"`
  });
  return server;
}

function createDevice(server, initial, wallpapers = [], controllerFactory = syncApi.createConnectionController) {
  const listeners = [];
  const alarmListeners = new Set();
  const alarms = new Set();
  const chromeApi = { runtime: { lastError: null }, storage: { onChanged: { addListener(fn) { listeners.push(fn); },
    removeListener(fn) { const index = listeners.indexOf(fn); if (index >= 0) listeners.splice(index, 1); } } },
    alarms: { names: alarms, create(name) { alarms.add(name); }, clear(name) { alarms.delete(name); },
      onAlarm: { addListener(fn) { alarmListeners.add(fn); }, removeListener(fn) { alarmListeners.delete(fn); } },
      fire(name) { alarmListeners.forEach((fn) => fn({ name })); } } };
  function area(name, values) {
    const store = { ...values };
    return { values: store, QUOTA_BYTES: 102400, QUOTA_BYTES_PER_ITEM: 8192, MAX_ITEMS: 512,
      get(keys, callback) {
        const names = keys === null ? Object.keys(store) : (Array.isArray(keys) ? keys : [keys]);
        callback(Object.fromEntries(names.filter((key) => Object.hasOwn(store, key)).map((key) => [key, structuredClone(store[key])])));
      },
      set(payload, callback) {
        const projected = { ...store, ...payload };
        if (name === 'sync' && (Object.entries(projected).some(([key, value]) => contract.byteLength(key) + contract.byteLength(JSON.stringify(value)) > 8192) ||
            Object.entries(projected).reduce((sum, [key, value]) => sum + contract.byteLength(key) + contract.byteLength(JSON.stringify(value)), 0) > 102400)) {
          chromeApi.runtime.lastError = { message: 'QUOTA_BYTES exceeded' };
          callback && callback();
          chromeApi.runtime.lastError = null;
          return;
        }
        const changes = {};
        Object.entries(payload).forEach(([key, value]) => {
          if (!contract.equal(store[key], value)) changes[key] = { oldValue: store[key], newValue: structuredClone(value) };
          store[key] = structuredClone(value);
        });
        if (Object.keys(changes).length) listeners.forEach((fn) => fn(changes, name));
        callback && callback();
      },
      remove(keys, callback) {
        const changes = {};
        for (const key of keys) { if (Object.hasOwn(store, key)) { changes[key] = { oldValue: store[key] }; delete store[key]; } }
        if (Object.keys(changes).length) listeners.forEach((fn) => fn(changes, name));
        callback && callback();
      }
    };
  }
  chromeApi.storage.local = area('local', initial.local || {});
  chromeApi.storage.sync = area('sync', initial.sync || {});
  const privateValues = new Map();
  const privateStore = { async get(key) { return structuredClone(privateValues.get(key)); },
    async put(key, value) { privateValues.set(key, structuredClone(value)); }, async delete(key) { privateValues.delete(key); } };
  let library = structuredClone(wallpapers);
  const wallpaperStore = { async readAll() { return structuredClone(library); }, async replaceAll(records) { library = structuredClone(records); } };
  const createController = () => controllerFactory({ chrome: chromeApi, settings, contract, shortcuts, client, crypto: cryptoApi,
    privateStore, wallpaperStore, clientOptions: { fetch: server.fetch } });
  const controller = createController();
  controller.start();
  return { controller, createController, chrome: chromeApi, privateValues, privateStore, wallpaperStore };
}
const set = (area, payload) => new Promise((resolve) => area.set(payload, resolve));
function empty(data = {}) { return { version: 1, data, shortcuts: [], icons: {}, wallpapers: [], assets: {} }; }

async function run() {
  const caller = { runtime: { id: 'our-extension', getURL: (path) => `chrome-extension://our-extension/${path}` } };
  assert(syncApi.isTrustedSender(caller, { id: 'our-extension', url: caller.runtime.getURL('src/options/options.html') + '#account' }));
  assert(!syncApi.isTrustedSender(caller, { id: 'other-extension', url: caller.runtime.getURL('src/options/options.html') }));
  assert(!syncApi.isTrustedSender(caller, { id: 'our-extension', url: 'https://webpage.test/' }));
  assert(!syncApi.isTrustedSender(caller, { id: 'our-extension', url: caller.runtime.getURL('newtab.html') }));
  // A runtime message becomes a request only with a known operation and well-typed fields.
  assert.deepStrictEqual(syncApi.readWebDavRequest({ action: 'webdav', operation: 'save', id: 'a', config, resume: true }),
    { operation: 'save', id: 'a', config, resume: true });
  assert.deepStrictEqual(syncApi.readWebDavRequest({ action: 'webdav', operation: 'status' }), { operation: 'status' });
  assert.strictEqual(syncApi.readWebDavRequest({ action: 'webdav', operation: 'toString' }), null);
  assert.strictEqual(syncApi.readWebDavRequest({ action: 'webdav', operation: 'save', id: 7 }), null);
  assert.strictEqual(syncApi.readWebDavRequest({ action: 'webdav', operation: 'save', config: 'endpoint' }), null);
  assert.strictEqual(syncApi.readWebDavRequest({ action: 'webdav', operation: 'add', enable: 'yes' }), null);
  // A failure replies with its code and redacted diagnostic; one without a code is a failed sync.
  const unsupportedFailure = Object.assign(client.error('conditional-write-unsupported'),
    { diagnostic: { revision: client.REVISION, phase: 'state-etag', statuses: [412, 'x'], password: 'secret' } });
  assert.deepStrictEqual(syncApi.failureReply(unsupportedFailure), { ok: false, error: 'conditional-write-unsupported',
    diagnostic: { revision: client.REVISION, phase: 'state-etag', statuses: [412] } });
  assert.deepStrictEqual(syncApi.failureReply(new DOMException('The operation timed out.', 'TimeoutError')),
    { ok: false, error: 'sync-failed', diagnostic: null });
  assert.throws(() => client.normalizeConfig({ ...config, endpoint: 'http://dav.test/' }), /invalid-endpoint/);
  assert.throws(() => client.normalizeConfig({ ...config, endpoint: 'https://user:password@dav.test/' }), /invalid-endpoint/);
  assert.throws(() => client.normalizeConfig({ ...config, directory: '../outside' }), /invalid-directory/);
  // fetch rejects an aborted request with a DOMException, whose numeric code
  // must not pass for one of the client's own failure codes.
  const hanging = client.createClient(config, {
    timeoutMs: 5,
    fetch: (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
    })
  });
  await assert.rejects(hanging.readState(), (cause) => cause.code === 'timeout');
  const unreachable = client.createClient(config, { fetch: () => Promise.reject(new TypeError('Failed to fetch')) });
  await assert.rejects(unreachable.readState(), (cause) => cause.code === 'network-error');
  const server = createServer();
  assert.deepStrictEqual(await client.createClient(config, { fetch: server.fetch }).testConnection(),
    { ok: true, concurrency: 'conditional', lockStrategy: 'collection-move' });
  assert.strictEqual([...server.files.keys()].some((path) => path.includes('probe-')), false);
  const unsafe = createServer();
  unsafe.ignoreConditions = true;
  assert.strictEqual((await client.createClient(config, { fetch: unsafe.fetch }).testConnection()).concurrency, 'collection-lock');
  unsafe.unsafeCollections = true;
  unsafe.moveConflictStatus = 409;
  assert.deepStrictEqual(await client.createClient(config, { fetch: unsafe.fetch }).testConnection(),
    { ok: true, concurrency: 'collection-lock', lockStrategy: 'collection-move' },
    'non-overwriting MOVE handles racy MKCOL and provider-specific 409 without losing either owner');
  const report = await probeProvider(config, { fetch: unsafe.fetch });
  assert.strictEqual(report.connection.ok, true);
  assert.strictEqual(report.directoryMove.exclusive, true);
  unsafe.ignoreMoveOverwrite = true;
  await assert.rejects(client.createClient(config, { fetch: unsafe.fetch }).testConnection(), (cause) => {
    assert.strictEqual(cause.diagnostic.phase, 'move-race');
    return cause.code === 'conditional-write-unsupported';
  });
  assert(!JSON.stringify(report).includes('app-password'));
  assert(!JSON.stringify(report).includes(Buffer.from('user:app-password').toString('base64')));
  assert(!JSON.stringify(report).includes('lumno-probe-owner'), 'server bodies are not part of diagnostics');
  const reflected = await probeProvider(config, { fetch: async () => new Response('user:app-password', {
    status: 401, headers: { ETag: '"app-password"' }
  }) });
  assert.strictEqual(reflected.connection.error, 'http-401');
  assert(!JSON.stringify(reflected).includes('app-password'), 'even reflected credentials in server headers or bodies never appear in reports');
  unsafe.ignoreMoveOverwrite = true;
  const overwriting = await probeProvider(config, { fetch: unsafe.fetch });
  assert.strictEqual(overwriting.directoryMove.exclusive, false, 'MOVE diagnostics also reject overwriting servers');
  unsafe.ignoreMoveOverwrite = false;
  unsafe.loseMoveSource = true;
  await assert.rejects(client.createClient(config, { fetch: unsafe.fetch }).testConnection(), (cause) => cause.diagnostic.phase === 'move-owner',
    'a 409 alone is insufficient if the server loses a contender');
  unsafe.loseMoveSource = false;
  unsafe.moveUnsupported = true;
  await assert.rejects(client.createClient(config, { fetch: unsafe.fetch }).testConnection(), (cause) => {
    assert.deepStrictEqual(cause.diagnostic, { revision: 'dav-lock-5', phase: 'directory-race', statuses: [201, 201] });
    return cause.code === 'conditional-write-unsupported';
  });
  unsafe.unsafeCollections = false;
  assert.strictEqual((await client.createClient(config, { fetch: unsafe.fetch }).testConnection()).lockStrategy, 'collection-create',
    'a server without MOVE must pass the independent MKCOL race test');
  unsafe.brokenDelete = true;
  await assert.rejects(client.createClient(config, { fetch: unsafe.fetch }).testConnection(), /conditional-write-unsupported/);
  unsafe.brokenDelete = false;
  // Existing sync folders also answer 405, so only a fresh path proves the
  // server refuses folder creation; that is reported apart from concurrency.
  unsafe.refuseCollections = true;
  for (const attempt of [() => client.createClient(config, { fetch: unsafe.fetch }).testConnection(),
    () => client.createClient({ ...config, concurrency: 'collection-lock' }, { fetch: unsafe.fetch }).writeState(empty(), null)]) {
    await assert.rejects(attempt(), (cause) => {
      assert.deepStrictEqual(cause.diagnostic, { revision: 'dav-lock-5', phase: 'state-lock-create', statuses: [405] });
      return cause.code === 'folder-create-refused';
    }, 'a refused MKCOL on a fresh path is not a concurrency failure');
  }
  unsafe.refuseCollections = false;
  assert.deepStrictEqual(client.diagnostic({ revision: 'dav-lock-5', phase: 'directory-race', statuses: [201, 'app-password', 405], password: 'app-password' }),
    { revision: 'dav-lock-5', phase: 'directory-race', statuses: [201, 405] });
  assert.strictEqual(client.diagnostic({ revision: 'dav-lock-5', phase: 'https://private-user:password@host/' }), null);

  // Small probe files keep a strong ETag while a compressed state.json gets a
  // weak one. The SHA-256 revision and write lock make that irrelevant.
  const compressing = createServer();
  compressing.compressAbove = 64;
  const compressed = createDevice(compressing, { sync: { [theme]: 'light' } });
  await compressed.controller.handle({ operation: 'connect', config });
  assert.strictEqual(compressed.privateValues.get('session').config.concurrency, 'conditional');
  await set(compressed.chrome.storage.sync, { [theme]: 'dark' });
  await compressed.createController().handle({ operation: 'sync' });
  assert.strictEqual(compressing.state().data[theme], 'dark', 'a weakened state.json ETag never blocks conditional servers');
  {
    // Firefox unloads an idle event page even with requests pending, which
    // would strand the write lock; a running job ticks an extension API.
    const slow = createServer();
    slow.afterPut = () => new Promise((resolve) => setTimeout(resolve, 25));
    let ticks = 0;
    const kept = createDevice(slow, { sync: { [theme]: 'light' } }, [], (options) => {
      options.chrome.runtime.getPlatformInfo = () => { ticks += 1; return Promise.resolve({}); };
      return syncApi.createConnectionController({ ...options, keepAliveIntervalMs: 5 });
    });
    await kept.controller.handle({ operation: 'connect', config });
    assert(ticks > 0, 'a running sync keeps the background alive');
    const settled = ticks;
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.strictEqual(ticks, settled, 'the keep-alive stops once no job is running');
  }
  const lockConfig = { ...config, concurrency: 'collection-lock' };
  const lockPath = '/dav/lumno/v1/write-lock/';
  for (const etagMode of ['weak', 'none', 'strong']) {
    const compatible = createServer();
    compatible.ignoreConditions = true;
    compatible.etagMode = etagMode;
    const a = createDevice(compatible, { sync: { [theme]: 'light', [language]: 'en' } });
    await a.controller.handle({ operation: 'connect', config });
    assert.strictEqual(a.privateValues.get('session').config.concurrency, 'collection-lock', 'detected concurrency survives a new worker');
    const b = createDevice(compatible, { sync: { [theme]: 'system' } });
    await b.controller.handle({ operation: 'connect', config, decision: 'remote' });
    await set(a.chrome.storage.sync, { [theme]: 'dark' });
    await set(b.chrome.storage.sync, { [language]: 'ja' });
    await a.createController().handle({ operation: 'sync' });
    await b.controller.handle({ operation: 'sync' });
    await a.controller.handle({ operation: 'sync' });
    assert.deepStrictEqual(compatible.state().data, { [theme]: 'dark', [language]: 'ja' });
    assert.strictEqual(compatible.directories.has(lockPath), false);
    assert.strictEqual(a.chrome.storage.sync.values[theme], 'dark', 'Chrome backup remains active in compatibility mode');
    await set(a.chrome.storage.sync, { [customSearch]: engine('a') });
    await set(b.chrome.storage.sync, { [customSearch]: engine('b') });
    await a.controller.handle({ operation: 'sync' });
    assert.strictEqual((await b.controller.handle({ operation: 'sync' })).conflict, true, 'directory locks do not bypass three-way conflict detection');
  }

  const fallback = createServer();
  fallback.moveUnsupported = true;
  fallback.etagMode = 'none';
  const fallbackDevice = createDevice(fallback, { sync: { [theme]: 'dark' } });
  await fallbackDevice.controller.handle({ operation: 'connect', config });
  assert.strictEqual(fallbackDevice.privateValues.get('session').config.lockStrategy, 'collection-create');
  await set(fallbackDevice.chrome.storage.sync, { [theme]: 'light' });
  await fallbackDevice.createController().handle({ operation: 'sync' });
  assert.strictEqual(fallback.state().data[theme], 'light', 'the verified MKCOL fallback persists across worker restarts');

  const competing = createServer();
  competing.ignoreConditions = true;
  competing.etagMode = 'none';
  competing.unsafeCollections = true;
  competing.moveConflictStatus = 409;
  const writerA = client.createClient(lockConfig, { fetch: competing.fetch });
  const writerB = client.createClient(lockConfig, { fetch: competing.fetch });
  await writerA.ensureDirectories();
  await writerA.writeState(empty({ [theme]: 'light' }), null);
  const revision = (await writerA.readState()).etag;
  const writes = await Promise.allSettled([
    writerA.writeState(empty({ [theme]: 'dark' }), revision), writerB.writeState(empty({ [theme]: 'system' }), revision)
  ]);
  assert.strictEqual(writes.filter((result) => result.status === 'fulfilled').length, 1, 'only one concurrent writer commits');
  assert(writes.filter((result) => result.status === 'rejected').every((result) => ['remote-locked', 'remote-changed'].includes(result.reason.code)));
  assert.strictEqual(competing.directories.has(lockPath), false);
  await assert.rejects(writerB.writeState(empty({ [theme]: 'light' }), revision), /remote-changed/, 'stale content hashes cannot overwrite remote edits');
  const savedState = competing.state();
  competing.directories.add(lockPath);
  const priorDeletes = competing.requests.filter((request) => request.path === lockPath && request.method === 'DELETE').length;
  await assert.rejects(writerB.writeState(empty(), (await writerB.readState()).etag), /remote-locked/);
  assert.strictEqual(competing.requests.filter((request) => request.path === lockPath && request.method === 'DELETE').length, priorDeletes, 'a losing contender never removes another writer lock');
  assert.deepStrictEqual(competing.state(), savedState);
  assert(!competing.requests.some((request) => request.path === lockPath && request.method === 'MKCOL'),
    'racy shared-directory creation is never used to claim a MOVE lock');
  competing.directories.delete(lockPath);

  // Real servers refuse the losing MOVE with 405 (nginx), 423 (Go x/net/webdav)
  // or 500 (Apache, WsgiDAV, Nextcloud). Ownership checks decide, not the code.
  for (const status of [405, 423, 500]) {
    const refusing = createServer();
    refusing.moveConflictStatus = status;
    assert.deepStrictEqual(await client.createClient(config, { fetch: refusing.fetch }).testConnection(),
      { ok: true, concurrency: 'conditional', lockStrategy: 'collection-move' }, `a verified ${status} refusal passes the race test`);
    assert.strictEqual((await probeProvider(config, { fetch: refusing.fetch })).directoryMove.exclusive, true);
    const first = client.createClient(lockConfig, { fetch: refusing.fetch });
    const second = client.createClient(lockConfig, { fetch: refusing.fetch });
    await first.ensureDirectories();
    await first.writeState(empty({ [theme]: 'light' }), null);
    const shared = (await first.readState()).etag;
    const results = await Promise.allSettled([
      first.writeState(empty({ [theme]: 'dark' }), shared), second.writeState(empty({ [theme]: 'system' }), shared)
    ]);
    assert.strictEqual(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert(results.filter((result) => result.status === 'rejected').every((result) => ['remote-locked', 'remote-changed'].includes(result.reason.code)),
      `a ${status} refusal is an ordinary lost race, not an uncertain write`);
    assert.strictEqual(refusing.directories.has(lockPath), false);
    assert(![...refusing.directories].some((path) => path.includes('lock-candidate-')), 'the losing candidate is cleaned up');
  }
  const bothRefused = createServer();
  bothRefused.refuseMoves = 2;
  assert.strictEqual((await client.createClient(config, { fetch: bothRefused.fetch }).testConnection()).lockStrategy, 'collection-move',
    'Nextcloud-style locking may refuse both overlapping MOVEs; neither moved, so the target is claimed sequentially');
  // Arm the refusal for the standalone race that runs after the connection test.
  const afterConnectionTest = (server, setup) => {
    server.beforeRequest = (path, options) => {
      if (options.method === 'DELETE' && /\/probe-[-\w]+\.txt$/.test(path)) { server.beforeRequest = null; setup(); }
    };
  };
  afterConnectionTest(bothRefused, () => { bothRefused.refuseMoves = 2; });
  const doubleRefusal = (await probeProvider(config, { fetch: bothRefused.fetch })).directoryMove;
  assert.deepStrictEqual([doubleRefusal.statuses, doubleRefusal.untouched, doubleRefusal.exclusive], [[500, 500], true, true],
    'the standalone probe also accepts a double refusal that moved nothing');
  afterConnectionTest(bothRefused, () => { bothRefused.refuseMoves = 2; bothRefused.loseMoveSource = true; });
  assert.strictEqual((await probeProvider(config, { fetch: bothRefused.fetch })).directoryMove.exclusive, false);
  bothRefused.refuseMoves = 2;
  await assert.rejects(client.createClient(config, { fetch: bothRefused.fetch }).testConnection(), (cause) => cause.diagnostic.phase === 'move-race',
    'a double refusal is accepted only while both contenders keep their content');
  const lyingRefusal = createServer();
  lyingRefusal.etagMode = 'none';
  const lyingClient = client.createClient(lockConfig, { fetch: lyingRefusal.fetch });
  await lyingClient.ensureDirectories();
  lyingRefusal.refusalStillMoves = true;
  await assert.rejects(lyingClient.writeState(empty(), null), /conditional-write-unsupported/, 'a refusal that still moved the candidate is never a lost race');
  assert(lyingRefusal.directories.has(lockPath), 'the unexpectedly claimed lock is left for explicit recovery');
  assert.strictEqual(lyingRefusal.files.has('/dav/lumno/v1/state.json'), false);

  // Same-size rewrites within one second share a size/mtime ETag. The content
  // digest still exposes the change, so a stale writer cannot overwrite it.
  const colliding = createServer();
  colliding.etagMode = 'size';
  const staleWriter = client.createClient(config, { fetch: colliding.fetch });
  const freshWriter = client.createClient(config, { fetch: colliding.fetch });
  await staleWriter.ensureDirectories();
  await staleWriter.writeState(empty({ [theme]: 'light' }), null);
  const staleBase = (await staleWriter.readState()).etag;
  await freshWriter.writeState(empty({ [theme]: 'dark1' }), (await freshWriter.readState()).etag);
  assert.strictEqual(colliding.files.get('/dav/lumno/v1/state.json').etag,
    `"size-${Buffer.byteLength(JSON.stringify(empty({ [theme]: 'light' })))}"`, 'the server ETag really collides');
  await assert.rejects(staleWriter.writeState(empty({ [theme]: 'system' }), staleBase), /remote-changed/);
  assert.strictEqual(colliding.state().data[theme], 'dark1');

  const lostClaim = createServer();
  lostClaim.etagMode = 'none';
  const lostClaimClient = client.createClient(lockConfig, { fetch: lostClaim.fetch });
  lostClaim.beforeRequest = (path, options) => {
    if (path.endsWith('/owner.txt') && options.method === 'GET' && path.startsWith(lockPath)) throw new Error('claim confirmation lost');
  };
  await assert.rejects(lostClaimClient.writeState(empty(), null), /network-error/);
  assert(lostClaim.directories.has(lockPath), 'unconfirmed ownership never removes the shared lock');
  assert.strictEqual(lostClaim.files.has('/dav/lumno/v1/state.json'), false, 'ownership must be verified before writing');

  const uncertainMove = createServer();
  uncertainMove.beforeRequest = (_path, options) => { if (options.method === 'MOVE') throw new Error('claim may still finish later'); };
  await assert.rejects(client.createClient(lockConfig, { fetch: uncertainMove.fetch }).writeState(empty(), null), (cause) =>
    cause.code === 'lock-write-uncertain' && cause.staleLock.uncertain === true, 'an uncertain claim is remembered for later release');
  assert(uncertainMove.directories.size > 0, 'a timed-out MOVE preserves its candidate for explicit recovery');
  assert.strictEqual(uncertainMove.files.has('/dav/lumno/v1/state.json'), false);

  const replacedOwner = createServer();
  replacedOwner.etagMode = 'none';
  replacedOwner.afterPut = (path) => {
    if (path.endsWith('/state.json')) replacedOwner.files.set(lockPath + 'owner.txt', { bytes: new TextEncoder().encode('other-owner') });
  };
  const replacedClient = client.createClient(lockConfig, { fetch: replacedOwner.fetch });
  const replacedWrite = await replacedClient.writeState(empty(), null);
  assert.deepStrictEqual(replacedWrite.state, empty(), 'a committed write is not reported as failed because its release failed');
  assert.strictEqual(replacedWrite.staleLock.uncertain, false);
  assert(replacedOwner.directories.has(lockPath), 'a changed owner is never deleted on release');
  assert.strictEqual(await replacedClient.releaseStaleLock(replacedWrite.staleLock), true, 'a lock now named for someone else is not this client\'s to release');
  assert(replacedOwner.directories.has(lockPath));

  const uncertain = createServer();
  uncertain.ignoreConditions = true;
  uncertain.etagMode = 'none';
  const uncertainClient = client.createClient(lockConfig, { fetch: uncertain.fetch });
  await uncertainClient.ensureDirectories();
  uncertain.afterPut = (path) => { if (path.endsWith('/state.json')) throw new Error('response lost after server commit'); };
  await assert.rejects(uncertainClient.writeState(empty({ [theme]: 'dark' }), null), /lock-write-uncertain/);
  assert(uncertain.directories.has(lockPath), 'an unknown write result leaves the lock intact');
  uncertain.afterPut = null;
  const restartWriter = client.createClient(lockConfig, { fetch: uncertain.fetch });
  await assert.rejects(restartWriter.writeState(empty(), (await restartWriter.readState()).etag), /remote-locked/, 'a restarted worker never steals or expires an uncertain lock');
  assert.strictEqual(uncertain.state().data[theme], 'dark');
  uncertain.etagMode = 'strong';
  uncertain.ignoreConditions = false;
  const upgradedWriter = client.createClient(config, { fetch: uncertain.fetch });
  await assert.rejects(upgradedWriter.writeState(empty(), (await upgradedWriter.readState()).etag), /remote-locked/, 'a client detecting restored conditional support still honors an uncertain compatibility lock');
  uncertain.directories.delete(lockPath); // Explicit recovery after all server operations have completed.
  uncertain.beforeRequest = (path, options) => { if (path === lockPath && options.method === 'DELETE') throw new Error('release response lost'); };
  const unreleased = await restartWriter.writeState(empty({ [theme]: 'light' }), (await restartWriter.readState()).etag);
  assert.strictEqual(uncertain.state().data[theme], 'light');
  assert(uncertain.directories.has(lockPath));
  uncertain.beforeRequest = null;
  assert.strictEqual(await restartWriter.releaseStaleLock(unreleased.staleLock), true);
  assert.strictEqual(uncertain.directories.has(lockPath), false, 'the remembered lock is released on the next attempt');

  // A failed release never replaces the reason the write itself failed.
  const masked = createServer();
  masked.etagMode = 'none';
  const maskedClient = client.createClient(lockConfig, { fetch: masked.fetch });
  await maskedClient.ensureDirectories();
  masked.beforeRequest = (path, options) => {
    if (options.method === 'MOVE' && new URL(new Headers(options.headers).get('Destination')).pathname === lockPath) masked.replaceState(empty({ [language]: 'ja' }));
    if (path === lockPath && options.method === 'DELETE') throw new Error('release response lost');
  };
  await assert.rejects(maskedClient.writeState(empty({ [theme]: 'dark' }), null), (cause) => cause.code === 'remote-changed' && cause.staleLock.uncertain === false);
  masked.beforeRequest = null;

  // A MOVE that reported success without moving the candidate cannot prove
  // exclusive ownership; the lock it created is released, not left behind.
  const copied = createServer();
  copied.etagMode = 'none';
  const copiedClient = client.createClient(lockConfig, { fetch: copied.fetch });
  await copiedClient.ensureDirectories();
  copied.beforeRequest = (path, options) => {
    if (options.method === 'GET' && /\/lock-candidate-[-\w]+\/owner\.txt$/.test(path) && copied.files.has(lockPath + 'owner.txt')) {
      copied.files.set(path, copied.files.get(lockPath + 'owner.txt'));
    }
  };
  await assert.rejects(copiedClient.writeState(empty(), null), (cause) => cause.diagnostic.phase === 'move-owner');
  copied.beforeRequest = null;
  assert.strictEqual(copied.files.has(lockPath + 'owner.txt'), false, 'the unverifiable lock is released');
  assert(![...copied.files.keys()].some((path) => path.includes('lock-candidate-')), 'and its candidate is cleaned up');
  assert.strictEqual(copied.files.has('/dav/lumno/v1/state.json'), false);

  // Locks from terminated clients are broken once the server says their owner
  // file is older than the stale-lock limit; younger ones are honored.
  const stale = createServer();
  stale.etagMode = 'none';
  const staleClient = client.createClient(lockConfig, { fetch: stale.fetch });
  await staleClient.ensureDirectories();
  const plantLock = (owner, age) => {
    stale.directories.add(lockPath);
    stale.files.set(lockPath + 'owner.txt', { bytes: new TextEncoder().encode(owner), modified: Date.now() - age });
  };
  plantLock('young-owner', client.STALE_LOCK_MS - 60 * 1000);
  await assert.rejects(staleClient.writeState(empty({ [theme]: 'dark' }), null), /remote-locked/, 'a recent lock is never broken');
  assert.strictEqual(new TextDecoder().decode(stale.files.get(lockPath + 'owner.txt').bytes), 'young-owner');
  plantLock('old-owner', client.STALE_LOCK_MS + 60 * 1000);
  await staleClient.writeState(empty({ [theme]: 'dark' }), null);
  assert.strictEqual(stale.state().data[theme], 'dark', 'a stale lock is taken over');
  assert.strictEqual(stale.directories.has(lockPath), false);
  assert(![...stale.files.keys()].some((path) => path.includes('lock-stale-')), 'the broken lock is removed');
  stale.directories.add(lockPath);
  stale.files.delete(lockPath + 'owner.txt');
  await assert.rejects(staleClient.writeState(empty(), (await staleClient.readState()).etag), /remote-locked/,
    'a lock without an owner file has no age and is never broken');
  stale.directories.delete(lockPath);
  // Another device took the lock between the age check and the move: it goes back.
  plantLock('old-owner', client.STALE_LOCK_MS + 60 * 1000);
  stale.beforeRequest = (path, options) => {
    if (options.method === 'MOVE' && path === lockPath) stale.files.set(lockPath + 'owner.txt', { bytes: new TextEncoder().encode('fresh-owner'), modified: Date.now() });
  };
  await assert.rejects(staleClient.writeState(empty(), (await staleClient.readState()).etag), /remote-locked/);
  stale.beforeRequest = null;
  assert.strictEqual(new TextDecoder().decode(stale.files.get(lockPath + 'owner.txt').bytes), 'fresh-owner', 'a fresh lock moved aside by mistake is put back');
  stale.directories.delete(lockPath);
  // Nutstore sends no Last-Modified with GET, which once left a stale lock in
  // place forever. The age comes from PROPFIND instead, and the folders
  // abandoned candidates left behind go with the broken lock.
  stale.omitLastModified = true;
  plantLock('young-owner', client.STALE_LOCK_MS - 60 * 1000);
  await assert.rejects(staleClient.writeState(empty(), (await staleClient.readState()).etag), /remote-locked/, 'a recent lock is still honored');
  const abandoned = '/dav/lumno/v1/lock-candidate-abandoned/';
  const inFlight = '/dav/lumno/v1/lock-candidate-in-flight/';
  stale.directories.add(abandoned);
  stale.directoryTimes.set(abandoned, Date.now() - client.STALE_LOCK_MS - 1000);
  stale.files.set(abandoned + 'owner.txt', { bytes: new TextEncoder().encode('abandoned'), modified: Date.now() - client.STALE_LOCK_MS - 1000 });
  stale.directories.add(inFlight);
  stale.directoryTimes.set(inFlight, Date.now());
  plantLock('old-owner', client.STALE_LOCK_MS + 60 * 1000);
  await staleClient.writeState(empty({ [theme]: 'light' }), (await staleClient.readState()).etag);
  assert.strictEqual(stale.state().data[theme], 'light', 'a stale lock without Last-Modified is taken over');
  assert.strictEqual(stale.directories.has(abandoned), false, 'abandoned candidates are removed');
  assert.strictEqual(stale.files.has(abandoned + 'owner.txt'), false);
  assert.strictEqual(stale.directories.has(inFlight), true, 'a candidate another device may still be using stays');
  stale.directories.delete(inFlight);
  stale.omitLastModified = false;
  // An uncertain write keeps its own lock until it must have settled.
  const uncertainMarker = { owner: 'aaaa-bbbb', at: Date.now(), uncertain: true };
  plantLock(uncertainMarker.owner, 0);
  assert.strictEqual(await staleClient.releaseStaleLock(uncertainMarker), false);
  assert(stale.directories.has(lockPath));
  assert.strictEqual(await staleClient.releaseStaleLock(uncertainMarker, Date.now() + client.STALE_LOCK_MS), true);
  assert.strictEqual(stale.files.has(lockPath + 'owner.txt'), false);

  const changedDuringClaim = createServer();
  changedDuringClaim.ignoreConditions = true;
  changedDuringClaim.etagMode = 'none';
  const claimWriter = client.createClient(lockConfig, { fetch: changedDuringClaim.fetch });
  await claimWriter.ensureDirectories();
  changedDuringClaim.beforeRequest = (path, options) => {
    if (options.method === 'MOVE' && new URL(new Headers(options.headers).get('Destination')).pathname === lockPath) changedDuringClaim.replaceState(empty({ [language]: 'ja' }));
  };
  await assert.rejects(claimWriter.writeState(empty({ [theme]: 'dark' }), null), /remote-changed/, 'creating the first state rechecks absence after acquiring the lock');
  assert.deepStrictEqual(changedDuringClaim.state().data, { [language]: 'ja' });
  assert.strictEqual(changedDuringClaim.requests.filter((request) => request.path.endsWith('/state.json') && request.method === 'PUT').length, 0);

  const rejectedWrite = createServer();
  rejectedWrite.etagMode = 'none';
  const rejectedClient = client.createClient(lockConfig, { fetch: rejectedWrite.fetch });
  await rejectedClient.ensureDirectories();
  for (const status of [401, 403, 429, 507]) {
    rejectedWrite.rejectStatePut = status;
    await assert.rejects(rejectedClient.writeState(empty(), null), new RegExp(`http-${status}`));
    assert.strictEqual(rejectedWrite.directories.has(lockPath), false, 'a definite rejection releases the owned lock when release is available');
    assert.strictEqual(rejectedWrite.files.has('/dav/lumno/v1/state.json'), false);
  }
  rejectedWrite.rejectStatePut = 0;
  await rejectedClient.writeState(empty(), null);

  const base = empty({ [theme]: 'light', [language]: 'en' });
  const merged = contract.mergeStates(base, empty({ ...base.data, [theme]: 'dark' }), empty({ ...base.data, [language]: 'ja' }));
  assert.deepStrictEqual(merged.conflicts, []);
  assert.deepStrictEqual(merged.state.data, { [theme]: 'dark', [language]: 'ja' });
  // A device that was offline or paused holds a stale value. Merging against
  // the last agreed state decides which side actually changed a setting.
  const offline = contract.mergeStates(base, base, empty({ ...base.data, [theme]: 'dark' }));
  assert.deepStrictEqual([offline.conflicts, offline.state.data[theme]], [[], 'dark'],
    'a device that did not touch a setting never overwrites the newer server value');
  const localOnly = contract.mergeStates(base, empty({ ...base.data, [theme]: 'dark' }), base);
  assert.deepStrictEqual([localOnly.conflicts, localOnly.state.data[theme]], [[], 'dark'], 'a change made only on this device wins');
  const settingBoth = contract.mergeStates(base, empty({ ...base.data, [theme]: 'dark' }), empty({ ...base.data, [theme]: 'system' }));
  assert.deepStrictEqual(settingBoth.conflicts, [theme], 'a single setting both sides changed apart is a conflict, not a silent pick');
  assert.strictEqual(contract.mergeStates(base, empty({ ...base.data, [theme]: 'dark' }), empty({ ...base.data, [theme]: 'system' }), 'remote')
    .state.data[theme], 'system', 'choosing the server version resolves a single setting');
  assert.deepStrictEqual(contract.mergeStates(base, empty({ ...base.data, [theme]: 'dark' }), empty({ ...base.data, [theme]: 'dark' })).conflicts, [],
    'the same change on both sides agrees');
  assert.deepStrictEqual(contract.describeConflict(base, empty({ ...base.data, [theme]: 'dark' }), empty({ ...base.data, [theme]: 'system' }), [theme]),
    [{ key: theme, domain: 'preference', local: { kind: 'text', value: 'dark' }, remote: { kind: 'text', value: 'system' } }]);
  assert.deepStrictEqual(contract.mergeStates(empty({ [customSearch]: engine('base') }), empty({ [customSearch]: engine('a') }),
    empty({ [customSearch]: engine('b') })).conflicts, [customSearch], 'a list both sides changed apart is a conflict');
  const deletion = contract.mergeStates(base, empty({ [language]: 'en' }), base);
  assert.strictEqual(Object.hasOwn(deletion.state.data, theme), false);
  assert.throws(() => contract.validateState({ ...empty(), version: 100 }), /invalid-state/);
  const quote = settings.newtabQuotePrefs.key;
  const quoteBase = empty({ [quote]: { enabled: true, position: 'search', category: 'literature', fontSize: 16 } });
  const quoteLocal = empty({ [quote]: { ...quoteBase.data[quote], fontSize: 20 } });
  const quoteRemote = empty({ [quote]: { ...quoteBase.data[quote], position: 'bottom' } });
  const quoteMerged = contract.mergeStates(quoteBase, quoteLocal, quoteRemote);
  assert.deepStrictEqual(quoteMerged.conflicts, [], 'different fields of a field-merged record do not conflict');
  assert.deepStrictEqual(quoteMerged.state.data[quote], { enabled: true, position: 'bottom', category: 'literature', fontSize: 20 });
  const quoteBoth = empty({ [quote]: { ...quoteRemote.data[quote], fontSize: 18, category: 'poetry' } });
  const quoteBothMerged = contract.mergeStates(quoteBase, quoteLocal, quoteBoth);
  assert.deepStrictEqual(quoteBothMerged.conflicts, [quote], 'a field both sides changed apart is a conflict');
  assert.deepStrictEqual(contract.mergeStates(quoteBase, quoteLocal, quoteBoth, 'local').state.data[quote],
    { enabled: true, position: 'bottom', category: 'poetry', fontSize: 20 }, 'choosing this device decides only the fields both sides changed');
  assert.deepStrictEqual(contract.mergeStates(quoteBase, quoteLocal, quoteBoth, 'remote').state.data[quote],
    { enabled: true, position: 'bottom', category: 'poetry', fontSize: 18 }, 'choosing the server version applies to settings too');
  assert.deepStrictEqual(contract.describeConflict(quoteBase, quoteLocal, quoteBoth, [quote]), [
    { key: quote, field: 'fontSize', domain: 'preference', local: { kind: 'number', value: 20 }, remote: { kind: 'number', value: 18 } }
  ], 'field conflicts list only the fields both sides changed apart');
  const quoteDeleted = contract.mergeStates(quoteBase, empty(), quoteRemote);
  assert.strictEqual(Object.hasOwn(quoteDeleted.state.data, quote), false, 'deleting a record is a whole-value change');
  assert.deepStrictEqual(contract.mergeStates(empty(), quoteLocal, quoteBoth).conflicts, [quote],
    'a missing base record counts as empty, so every field the sides set differently conflicts');
  assert.deepStrictEqual(contract.mergeStates(empty(), quoteLocal, quoteBoth, 'local').state.data[quote], quoteLocal.data[quote]);
  const folderColors = settings.bookmarkFolderColorRefs.key;
  const workRef = 'a'.repeat(16);
  const homeRef = 'b'.repeat(16);
  const colorBase = empty({ [folderColors]: { [workRef]: { color: '#5393FF', dateAdded: 1 } } });
  const colorLocal = empty({ [folderColors]: { [workRef]: { color: '#22C55E', dateAdded: 1 } } });
  const colorRemote = empty({ [folderColors]: { ...colorBase.data[folderColors], [homeRef]: { color: '#EF4444', dateAdded: 2 } } });
  const colorMerged = contract.mergeStates(colorBase, colorLocal, colorRemote);
  assert.deepStrictEqual(colorMerged.conflicts, [], 'devices coloring different folders do not conflict');
  assert.deepStrictEqual(colorMerged.state.data[folderColors], {
    [homeRef]: { color: '#EF4444', dateAdded: 2 }, [workRef]: { color: '#22C55E', dateAdded: 1 }
  });
  const colorBoth = empty({ [folderColors]: { [workRef]: { color: '#F59E0B', dateAdded: 1 } } });
  assert.deepStrictEqual(contract.describeConflict(colorBase, colorLocal, colorBoth, [folderColors]), [
    { key: folderColors, field: workRef, domain: 'preference', local: { kind: 'text', value: '#22C55E' }, remote: { kind: 'text', value: '#F59E0B' } }
  ], 'a folder color conflict shows the colors, not the stored entry');
  // Chrome sync delivers the shared wallpaper key before WebDAV delivers the
  // local-only selection. That half-arrived edit is not a second device's change.
  const shared = contract.WALLPAPER_KEY;
  const selection = contract.LOCAL_WALLPAPER_KEY;
  const halfWallpaper = contract.mergeStates(empty({ [shared]: { light: 'default' }, [selection]: { light: 'custom-wallpaper-1' } }),
    empty({ [shared]: { light: 'aurora' }, [selection]: { light: 'custom-wallpaper-1' } }),
    empty({ [shared]: { light: 'aurora' }, [selection]: { light: null } }));
  assert.deepStrictEqual(halfWallpaper.conflicts, [], 'a wallpaper edit that arrived in halves does not conflict');
  assert.deepStrictEqual(halfWallpaper.state.data[selection], { light: null }, 'the missing half comes from WebDAV');
  const hashOf = (character) => character.repeat(64);
  const libraryItem = (id, name) => ({ id, name, width: 10, height: 10, updatedAt: 1, image: hashOf('a'), thumbnail: hashOf('a') });
  const media = { [hashOf('a')]: { mime: 'image/webp', size: 10 }, [hashOf('b')]: { mime: 'image/png', size: 10 } };
  const shortcutA = { id: 'a', type: 'link', title: 'A', url: 'https://a.example/' };
  const shortcutB = { id: 'b', type: 'link', title: 'B', url: 'https://b.example/' };
  const halfIcon = contract.mergeStates({ ...empty(), shortcuts: [shortcutA] }, { ...empty(), shortcuts: [shortcutA, shortcutB] },
    { ...empty(), shortcuts: [shortcutA, shortcutB], icons: { b: hashOf('b') }, assets: media });
  assert.deepStrictEqual(halfIcon.conflicts, [], 'a shortcut that arrived before its icon does not conflict');
  assert.deepStrictEqual(halfIcon.state.icons, { b: hashOf('b') });
  // Icons merge per shortcut inside the shortcut domain.
  const iconMedia = { ...media, [hashOf('c')]: { mime: 'image/png', size: 10 }, [hashOf('d')]: { mime: 'image/png', size: 10 } };
  const withIcon = (icons, list = [shortcutA, shortcutB]) => contract.validateState({ ...empty(), shortcuts: list, icons, assets: iconMedia });
  const iconBase = withIcon({ a: hashOf('b') });
  assert.deepStrictEqual(contract.mergeStates(iconBase, iconBase, withIcon({ a: hashOf('c') })).state.icons, { a: hashOf('c') },
    'an icon changed only on the server reaches a device that did not touch it');
  const iconBoth = contract.mergeStates(iconBase, withIcon({ a: hashOf('c') }), withIcon({ a: hashOf('d') }));
  assert.deepStrictEqual(iconBoth.conflicts, ['shortcuts'], 'two different new icons for one shortcut conflict');
  assert.deepStrictEqual(contract.mergeStates(iconBase, withIcon({ a: hashOf('c') }), withIcon({ a: hashOf('d') }), 'remote').state.icons,
    { a: hashOf('d') });
  const removedIcon = contract.mergeStates(iconBase, withIcon({}, [shortcutB]), withIcon({ a: hashOf('d') }));
  assert.deepStrictEqual([removedIcon.conflicts, removedIcon.state.icons], [[], {}],
    'the icon of a shortcut this device removed goes with it instead of conflicting');
  const library = (...items) => ({ ...empty(), wallpapers: items, assets: media });
  assert.deepStrictEqual(contract.mergeStates(library(libraryItem('custom-wallpaper-1', 'One')),
    library(libraryItem('custom-wallpaper-1', 'One'), libraryItem('custom-wallpaper-2', 'Two')), library()).conflicts, ['wallpapers'],
  'a wallpaper library both sides changed apart is still a conflict');
  const malicious = JSON.parse(JSON.stringify({ ...empty(), data: { password: 'never-import-this', [theme]: 'dark' } }));
  assert.deepStrictEqual(contract.validateState(malicious).data, { [theme]: 'dark' });

  const icon = fs.readFileSync('assets/images/lumno.png');
  assert(icon.length <= 96 * 1024);
  const wallpaper = fs.readFileSync('assets/wallpapers/lumno-newtab-seurat-coast-white-thumb.webp');
  assert(wallpaper.length <= 160 * 1024);
  const firstShortcut = shortcuts.createShortcutRecord({ id: 'first', title: 'First', url: 'https://example.com/' }, { now: 100 });
  const overflowShortcut = shortcuts.createShortcutRecord({ id: 'overflow', title: 'Overflow', url: 'https://other.example/' }, { now: 100 });
  const [topbarMode, topbarLight, topbarDark, topbarLegacy] = settings.BOOKMARK_TOPBAR_SURFACE_KEYS;
  const topbarLayout = settings.bookmarkTopbarLayout.key;
  const customQuotes = '_x_extension_custom_quotes_2026_unique_';
  const quotePick = '_x_extension_custom_quote_pick_2026_unique_';
  assert(contract.LOCAL_PREFERENCE_KEYS.includes(customQuotes), 'the custom quote collection travels with WebDAV');
  assert(!settings.BROWSER_SYNC_KEYS.includes(customQuotes), 'the custom quote collection stays out of browser sync');
  const first = createDevice(server, {
    sync: { [theme]: 'light', [language]: 'en', [newtabShortcutsLegacy.key]: [firstShortcut], [topbarLayout]: 'floating' },
    local: { [contract.OVERFLOW_KEY]: { authoritative: false, items: [overflowShortcut] },
      [contract.ICONS_KEY]: { first: `data:image/png;base64,${icon.toString('base64')}` },
      [contract.LOCAL_WALLPAPER_KEY]: { version: 1, light: 'custom-wallpaper-test', dark: 'custom-wallpaper-test' },
      [topbarMode]: 'custom', [topbarLight]: '#112233', [topbarDark]: '#445566', [topbarLegacy]: '#778899',
      [customQuotes]: { version: 1, filename: 'quotes.md', revision: 100, quotes: [{ text: 'Well begun is half done.', from: 'Aristotle' }] },
      [quotePick]: { day: '2026-10-18', index: 0 } }
  }, [{ id: 'custom-wallpaper-test', key: 'custom-wallpaper-test', name: 'Test', width: 480, height: 270, updatedAt: 100,
    imageDataUrl: `data:image/webp;base64,${wallpaper.toString('base64')}`, thumbnailDataUrl: `data:image/webp;base64,${wallpaper.toString('base64')}` }]);
  await first.controller.handle({ operation: 'connect', config });
  assert.strictEqual(first.chrome.storage.local.values[settings.localPrimary.key], undefined);
  assert.strictEqual(first.chrome.storage.local.values[contract.OVERFLOW_KEY].items.length, 0);
  assert.deepStrictEqual(server.state().shortcuts.map((item) => item.id), ['first', 'overflow']);
  assert.strictEqual(server.state().wallpapers.length, 1);
  assert.strictEqual(Object.values(server.state().assets).length, 2, 'identical wallpaper and thumbnail deduplicate');
  const status = await first.controller.status();
  assert.strictEqual(status.config.hasPassword, true);
  assert(!JSON.stringify(status).includes('app-password'), 'UI status cannot expose stored credentials');
  assert(!Object.keys(first.chrome.storage.local.values).some((key) => /password|credentials/.test(key)));

  const second = createDevice(server, { sync: { [theme]: 'system' } });
  assert.deepStrictEqual(await second.controller.handle({ operation: 'connect', config }), { needsChoice: true });
  assert.strictEqual(second.chrome.storage.local.values[settings.localPrimary.key], undefined, 'first-use choice cannot silently migrate');
  await second.controller.handle({ operation: 'connect', config, decision: 'remote' });
  assert.strictEqual(second.chrome.storage.sync.values[theme], 'light');
  assert.strictEqual(second.chrome.storage.local.values[contract.ICONS_KEY].first, first.chrome.storage.local.values[contract.ICONS_KEY].first);
  assert.strictEqual((await second.wallpaperStore.readAll())[0].imageDataUrl, (await first.wallpaperStore.readAll())[0].imageDataUrl);
  assert.deepStrictEqual(second.chrome.storage.local.values[contract.LOCAL_WALLPAPER_KEY], first.chrome.storage.local.values[contract.LOCAL_WALLPAPER_KEY]);
  assert.deepStrictEqual(second.chrome.storage.local.values[customQuotes], first.chrome.storage.local.values[customQuotes]);
  assert.strictEqual(second.chrome.storage.local.values[quotePick], undefined, 'each device keeps its own daily quote');
  assert.deepStrictEqual([server.state().wallpapers[0].width, server.state().wallpapers[0].height], [512, 288],
    'wallpaper dimensions come from the image, not the stored record');
  // Wallpapers saved before dimensions were recorded read back as 0x0 and
  // must not block a new device from joining.
  const legacy = createDevice(server, { sync: { [theme]: 'system' } }, [{ id: 'custom-wallpaper-legacy-1', key: 'custom-wallpaper-legacy-1',
    name: 'Old', width: 0, height: 0, updatedAt: 50, imageDataUrl: `data:image/webp;base64,${wallpaper.toString('base64')}`,
    thumbnailDataUrl: `data:image/webp;base64,${wallpaper.toString('base64')}` }]);
  assert.deepStrictEqual(await legacy.controller.handle({ operation: 'connect', config }), { needsChoice: true });
  await legacy.controller.handle({ operation: 'connect', config, decision: 'remote' });
  assert.deepStrictEqual((await legacy.wallpaperStore.readAll()).map((item) => item.id), ['custom-wallpaper-test']);
  // A record this device cannot sync is reported as local, never as a bad remote copy.
  const damaged = createDevice(server, { sync: { [theme]: 'system' } }, [{ id: 'custom-wallpaper-damaged', key: 'custom-wallpaper-damaged',
    name: 'Damaged', width: 10, height: 10, updatedAt: 50, imageDataUrl: `data:image/png;base64,${icon.toString('base64')}`,
    thumbnailDataUrl: `data:image/webp;base64,${wallpaper.toString('base64')}` }]);
  await assert.rejects(damaged.controller.handle({ operation: 'connect', config, decision: 'remote' }), /local-invalid-asset/);
  assert.deepStrictEqual((await damaged.wallpaperStore.readAll()).map((item) => item.id), ['custom-wallpaper-damaged']);
  // The bookmark bar material travels with the wallpapers through WebDAV only.
  assert.deepStrictEqual([topbarMode, topbarLight, topbarDark].map((key) => second.chrome.storage.local.values[key]),
    ['custom', '#112233', '#445566'], 'WebDAV carries the bookmark bar material into local storage');
  assert.strictEqual(second.chrome.storage.sync.values[topbarLayout], 'floating', 'WebDAV carries bookmark bar layout to another device');
  assert.strictEqual(Object.hasOwn(server.state().data, topbarLegacy), false, 'the legacy single color migrates locally and never syncs');
  [first, second].forEach((device) => settings.BOOKMARK_TOPBAR_SURFACE_KEYS.forEach((key) => {
    assert.strictEqual(Object.hasOwn(device.chrome.storage.sync.values, key), false, 'bookmark bar material never enters browser sync');
  }));
  await set(first.chrome.storage.local, { [topbarMode]: 'clear' });
  await set(second.chrome.storage.local, { [topbarDark]: '#000000' });
  await set(second.chrome.storage.sync, { [topbarLayout]: 'docked' });
  await first.controller.handle({ operation: 'sync' });
  await second.controller.handle({ operation: 'sync' });
  await first.controller.handle({ operation: 'sync' });
  [first, second].forEach((device) => assert.deepStrictEqual([topbarMode, topbarLight, topbarDark].map((key) =>
    device.chrome.storage.local.values[key]), ['clear', '#112233', '#000000'], 'each bookmark bar value merges on its own'));
  [first, second].forEach((device) => assert.strictEqual(device.chrome.storage.sync.values[topbarLayout], 'docked'));

  await set(first.chrome.storage.sync, { [theme]: 'dark' });
  await set(second.chrome.storage.sync, { [language]: 'ja' });
  await first.controller.handle({ operation: 'sync' });

  server.files.delete('/dav/lumno/v1/state.json');
  await assert.rejects(first.controller.handle({ operation: 'sync' }), /remote-missing/);
  assert.strictEqual((await first.controller.status()).state, 'choice');
  assert.strictEqual(server.files.has('/dav/lumno/v1/state.json'), false, 'a deleted remote is not silently recreated');
  await first.controller.handle({ operation: 'sync', decision: 'local' });
  await second.controller.handle({ operation: 'sync' });
  await first.controller.handle({ operation: 'sync' });
  assert.strictEqual(first.chrome.storage.sync.values[language], 'ja');
  assert.strictEqual(second.chrome.storage.sync.values[theme], 'dark');
  assert.strictEqual(server.state().data[theme], 'dark');

  await set(first.chrome.storage.sync, { [theme]: 'light' });
  await set(second.chrome.storage.sync, { [theme]: 'system' });
  await first.controller.handle({ operation: 'sync' });
  assert.deepStrictEqual(await second.controller.handle({ operation: 'sync' }), { conflict: true },
    'a setting both devices changed apart asks instead of letting the last device to sync win');
  assert.strictEqual(server.state().data[theme], 'light', 'the server keeps the first device\'s value until the choice');
  assert.strictEqual(second.chrome.storage.sync.values[theme], 'system');
  await second.controller.handle({ operation: 'sync', decision: 'local' });
  assert.strictEqual(server.state().data[theme], 'system');
  await first.controller.handle({ operation: 'sync' });
  assert.strictEqual(first.chrome.storage.sync.values[theme], 'system');
  // A paused device that kept its old value takes the newer server value.
  await first.controller.handle({ operation: 'pause' });
  const simple = settings.simpleModeEnabled.key;
  await set(second.chrome.storage.sync, { [simple]: true });
  await second.controller.handle({ operation: 'sync' });
  await first.controller.handle({ operation: 'connect', config: { ...config, password: '' } });
  assert.strictEqual(first.chrome.storage.sync.values[simple], true, 'a resumed device does not clobber the newer server value');
  assert.strictEqual(server.state().data[simple], true);

  await set(first.chrome.storage.sync, { [customSearch]: engine('first') });
  await set(second.chrome.storage.sync, { [customSearch]: engine('second') });
  await first.controller.handle({ operation: 'sync' });
  assert.deepStrictEqual(await second.controller.handle({ operation: 'sync' }), { conflict: true });
  assert.deepStrictEqual(second.chrome.storage.sync.values[customSearch], engine('second'));
  assert.deepStrictEqual(server.state().data[customSearch], engine('first'));
  await second.controller.handle({ operation: 'sync', decision: 'remote' });
  assert.deepStrictEqual(second.chrome.storage.sync.values[customSearch], engine('first'));
  assert.deepStrictEqual(second.privateValues.get('replacementBackup').captured.state.data[customSearch], engine('second'),
    'conflict resolution retains the replaced local copy');

  server.offline = true;
  await set(first.chrome.storage.sync, { [customSearch]: [] });
  await assert.rejects(first.controller.handle({ operation: 'sync' }), /network-error/);
  await set(first.chrome.storage.sync, { [language]: 'en' });
  assert.strictEqual(first.chrome.storage.sync.values[language], 'en', 'Chrome settings remain writable while WebDAV is offline');
  await first.controller.handle({ operation: 'pause' });
  assert.strictEqual(first.chrome.storage.local.values[settings.localPrimary.key], undefined, 'pausing WebDAV leaves Chrome authoritative');
  server.offline = false;
  await first.controller.handle({ operation: 'connect', config: { ...config, password: '' } });
  const validRemote = server.state();
  server.replaceState({ ...validRemote, data: { ...validRemote.data, [customSearch]: 'x'.repeat(120 * 1024) } });
  const beforeCapacity = structuredClone(first.chrome.storage.sync.values);
  await assert.rejects(first.controller.handle({ operation: 'sync' }), /chrome-capacity/);
  assert.deepStrictEqual(first.chrome.storage.sync.values, beforeCapacity, 'oversized remote settings cannot truncate or replace Chrome settings');
  server.replaceState(validRemote);

  const beforeRace = first.chrome.storage.sync.values[theme];
  let raced = false;
  server.beforeRequest = async (path, options) => {
    if (!raced && path.endsWith('state.json') && options.method === 'GET') {
      raced = true;
      await set(first.chrome.storage.sync, { [theme]: 'dark' });
    }
  };
  await assert.rejects(first.controller.handle({ operation: 'sync' }), /local-changed/);
  assert.strictEqual(first.chrome.storage.sync.values[theme], 'dark', 'edits during a network request survive');
  server.beforeRequest = null;
  assert.notStrictEqual(beforeRace, 'dark');
  await first.controller.handle({ operation: 'sync' });

  const goodState = server.state();
  server.replaceState({ bad: true });
  await assert.rejects(second.controller.handle({ operation: 'sync' }), /invalid-state/);
  assert.strictEqual(second.chrome.storage.sync.values[theme], 'system');
  // Each way a remote copy can be unreadable keeps its own code.
  server.files.set('/dav/lumno/v1/state.json', { bytes: new TextEncoder().encode('{"version":2,'), etag: '"torn"' });
  await assert.rejects(second.controller.handle({ operation: 'sync' }), /remote-corrupt/);
  server.replaceState(goodState);
  server.stateStatus = 204;
  await assert.rejects(second.controller.handle({ operation: 'sync' }), (error) => error.code === 'remote-unreadable' &&
    error.diagnostic.phase === 'state-read' && error.diagnostic.statuses[0] === 204);
  server.stateStatus = 0;
  assert.strictEqual(second.chrome.storage.sync.values[theme], 'system');
  server.replaceState(goodState);
  await set(first.chrome.storage.sync, { [customSearch]: [] });
  await first.controller.handle({ operation: 'sync' });
  await first.controller.handle({ operation: 'browser' });
  assert.strictEqual(first.chrome.storage.local.values[settings.localPrimary.key], undefined);
  assert.strictEqual(first.chrome.storage.sync.values[theme], 'dark');
  assert.strictEqual((await first.controller.status()).enabled, false);

  // New pages and Chrome-delivered changes keep the existing sync path.
  const restartedSettings = settingsStorage.createProviderStorageRuntime(second.chrome);
  await restartedSettings.ready;
  const coldSettings = settingsStorage.createProviderStorageRuntime({ ...second.chrome });
  await coldSettings.ready;
  assert.strictEqual(coldSettings.getActiveAreaName(), 'sync');
  await second.controller.handle({ operation: 'sync' });
  await set(second.chrome.storage.sync, { [language]: 'zh_CN' });
  assert.strictEqual((await restartedSettings.area.get([language]))[language], 'zh_CN');
  const resumedController = second.createController();
  assert.strictEqual((await resumedController.handle({ operation: 'status' })).localPrimary, false);
  await resumedController.handle({ operation: 'sync' });
  assert.strictEqual(server.state().data[language], 'zh_CN', 'Chrome-delivered changes also reach WebDAV');

  const raceServer = createServer();
  const raceDevice = createDevice(raceServer, { sync: { [theme]: 'light', [language]: 'en' } });
  await raceDevice.controller.handle({ operation: 'connect', config });
  await set(raceDevice.chrome.storage.sync, { [theme]: 'dark' });
  let changedRemote = false;
  raceServer.beforeRequest = async (path, options) => {
    if (!changedRemote && path.endsWith('state.json') && options.method === 'PUT') {
      changedRemote = true;
      raceServer.replaceState(empty({ [theme]: 'light', [language]: 'ja' }));
    }
  };
  assert.deepStrictEqual(await raceDevice.controller.handle({ operation: 'sync' }), { pending: true },
    'a concurrent commit waits and merges again instead of failing');
  assert.strictEqual(raceDevice.chrome.storage.sync.values[theme], 'dark');
  assert.strictEqual(raceServer.state().data[theme], 'light', 'conditional writes cannot clobber a concurrent device');
  const raceStatus = await raceDevice.controller.handle({ operation: 'status' });
  assert.strictEqual(raceStatus.state, 'pending');
  assert.strictEqual(raceStatus.error, null, 'contention is not shown as a failure');
  raceServer.beforeRequest = null;
  await raceDevice.controller.handle({ operation: 'sync' });
  assert.strictEqual(raceDevice.chrome.storage.sync.values[language], 'ja');
  assert.strictEqual(raceServer.state().data[theme], 'dark', 'the retried sync merges both devices');

  // Another browser holding the write lock is retried on a timer; only a lock
  // that outlasts every retry reaches the card as a failure.
  const lockedServer = createServer();
  const quickRetry = (input) => syncApi.createConnectionController({ ...input, contentionDelays: [5, 5] });
  const lockedDevice = createDevice(lockedServer, { sync: { [theme]: 'light' } }, [], quickRetry);
  await lockedDevice.controller.handle({ operation: 'connect', config });
  const sharedLock = '/dav/lumno/v1/write-lock/';
  lockedServer.directories.add(sharedLock);
  await set(lockedDevice.chrome.storage.sync, { [theme]: 'dark' });
  assert.deepStrictEqual(await lockedDevice.controller.handle({ operation: 'sync' }), { pending: true });
  lockedServer.directories.delete(sharedLock);
  await new Promise((resolve) => setTimeout(resolve, 60));
  await lockedDevice.controller.handle({ operation: 'status' });
  assert.strictEqual(lockedServer.state().data[theme], 'dark', 'the queued retry writes once the other browser releases the lock');
  assert.strictEqual((await lockedDevice.controller.handle({ operation: 'status' })).state, 'ready');
  lockedServer.directories.add(sharedLock);
  await set(lockedDevice.chrome.storage.sync, { [theme]: 'light' });
  await new Promise((resolve) => setTimeout(resolve, 1600));
  for (let wait = 0; wait < 50 && (await lockedDevice.controller.handle({ operation: 'status' })).state === 'pending'; wait += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  const stuck = await lockedDevice.controller.handle({ operation: 'status' });
  assert.strictEqual(stuck.state, 'error');
  assert.strictEqual(stuck.error, 'remote-locked', 'a lock that never clears is still reported');
  assert.strictEqual(lockedServer.state().data[theme], 'dark');
  await lockedDevice.controller.handle({ operation: 'pause' });
  {
    // The wait before a contention retry also keeps the background alive, or
    // Firefox would unload the page and drop the queued retry.
    const waitServer = createServer();
    let waitTicks = 0;
    const waiting = createDevice(waitServer, { sync: { [theme]: 'light' } }, [], (input) => {
      input.chrome.runtime.getPlatformInfo = () => { waitTicks += 1; return Promise.resolve({}); };
      return syncApi.createConnectionController({ ...input, contentionDelays: [120], keepAliveIntervalMs: 5 });
    });
    await waiting.controller.handle({ operation: 'connect', config });
    await new Promise((resolve) => setTimeout(resolve, 1600));
    waitServer.directories.add(sharedLock);
    await set(waiting.chrome.storage.sync, { [theme]: 'dark' });
    assert.deepStrictEqual(await waiting.controller.handle({ operation: 'sync' }), { pending: true });
    const queuedAt = waitTicks;
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert(waitTicks > queuedAt, 'a queued contention retry keeps the background alive while it waits');
    waitServer.directories.delete(sharedLock);
    for (let wait = 0; wait < 50 && (await waiting.controller.handle({ operation: 'status' })).state !== 'ready'; wait += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.strictEqual(waitServer.state().data[theme], 'dark');
    const doneAt = waitTicks;
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.strictEqual(waitTicks, doneAt, 'the keep-alive stops once the retry has run');
    await waiting.controller.handle({ operation: 'pause' });
  }

  {
    // Nutstore answers 503 once an account sent too many requests, and keeps
    // refusing while it is polled. Background rounds leave the server alone
    // until the planned retry; the card says when that is.
    const busyServer = createServer();
    let clockNow = Date.now();
    const busy = createDevice(busyServer, { sync: { [theme]: 'light' } }, [], (input) =>
      syncApi.createConnectionController({ ...input, throttleDelays: [60000, 120000], now: () => clockNow }));
    await busy.controller.handle({ operation: 'connect', config });
    await new Promise((resolve) => setTimeout(resolve, 1600));
    busyServer.refuseWith = { status: 503, retryAfter: '600' };
    await set(busy.chrome.storage.sync, { [theme]: 'dark' });
    const refused = await busy.controller.handle({ operation: 'sync' });
    assert.deepStrictEqual(refused, { pending: true, retryAt: clockNow + 600000 }, 'a longer Retry-After wins over the first wait');
    let busyStatus = await busy.controller.handle({ operation: 'status' });
    assert.strictEqual(busyStatus.state, 'pending');
    assert.strictEqual(busyStatus.error, 'http-503');
    assert.strictEqual(busyStatus.retryAt, refused.retryAt);
    const quietFrom = busyServer.requests.length;
    busy.chrome.alarms.fire(syncApi.ALARM_NAME);
    await set(busy.chrome.storage.sync, { [language]: 'ja' });
    await new Promise((resolve) => setTimeout(resolve, 1600));
    await busy.controller.handle({ operation: 'status' });
    assert.strictEqual(busyServer.requests.length, quietFrom, 'alarm and change rounds skip a server that is refusing requests');
    // Without Retry-After the waits grow while the refusals continue; a sync
    // the user asks for still reaches the server.
    busyServer.refuseWith = { status: 429 };
    const again = await busy.controller.handle({ operation: 'sync' });
    assert(busyServer.requests.length > quietFrom);
    assert(again.retryAt >= clockNow + 108000 && again.retryAt <= clockNow + 132000, 'the second refusal waits longer');
    assert.strictEqual((await busy.controller.handle({ operation: 'status' })).error, 'http-429');
    busyServer.refuseWith = null;
    clockNow = again.retryAt + 1;
    busy.chrome.alarms.fire(syncApi.ALARM_NAME);
    busyStatus = await busy.controller.handle({ operation: 'status' });
    assert.strictEqual(busyStatus.state, 'ready');
    assert.strictEqual(busyStatus.retryAt, null);
    assert.strictEqual(busyServer.state().data[theme], 'dark');
    assert.strictEqual(busyServer.state().data[language], 'ja', 'changes made during the wait are synced afterwards');
    assert.strictEqual(await busy.privateStore.get('throttle'), null);
    busyServer.refuseWith = { status: 503 };
    await set(busy.chrome.storage.sync, { [theme]: 'light' });
    const fresh = await busy.controller.handle({ operation: 'sync' });
    assert(fresh.retryAt <= clockNow + 66000, 'a success resets the waits');
    // A device clock set back leaves the saved end far ahead, longer than any
    // wait; background rounds ignore it instead of staying quiet that long.
    busyServer.refuseWith = null;
    clockNow -= 24 * 60 * 60 * 1000;
    const rewoundFrom = busyServer.requests.length;
    busy.chrome.alarms.fire(syncApi.ALARM_NAME);
    assert.strictEqual((await busy.controller.handle({ operation: 'status' })).state, 'ready');
    assert(busyServer.requests.length > rewoundFrom, 'a wait that ends past the longest delay does not hold back sync');
    assert.strictEqual(await busy.privateStore.get('throttle'), null);
    // A full join the server answers starts the waits over as well.
    busyServer.refuseWith = { status: 429 };
    await set(busy.chrome.storage.sync, { [theme]: 'dark' });
    await busy.controller.handle({ operation: 'sync' });
    await busy.controller.handle({ operation: 'sync' });
    assert.strictEqual((await busy.privateStore.get('throttle')).attempt, 1);
    busyServer.refuseWith = null;
    assert.deepStrictEqual(await busy.controller.handle({ operation: 'connect', config, decision: 'remote' }), { ok: true });
    assert.strictEqual(await busy.privateStore.get('throttle'), null, 'connecting clears the throttle record');
    await busy.controller.handle({ operation: 'pause' });
    assert.strictEqual(await busy.privateStore.get('throttle'), null);

    // A refused state write never committed, so it releases the lock instead
    // of holding every device at remote-locked as an uncertain write.
    const refusingServer = createServer();
    const refusedWriter = client.createClient(config, { fetch: refusingServer.fetch });
    await refusedWriter.ensureDirectories();
    refusingServer.refuseWith = { status: 503, when: (path, method) => method === 'PUT' && path.endsWith('/state.json') };
    await assert.rejects(refusedWriter.writeState(empty(), null), (error) => error.code === 'http-503' && !error.staleLock);
    assert(!refusingServer.directories.has('/dav/lumno/v1/write-lock/'), 'the lock is released after a refused write');
    refusingServer.refuseWith = null;
    await refusedWriter.writeState(empty(), null);
  }

  {
    // Folders of abandoned lock attempts are swept once a day by the first
    // sync, so servers that already collected them are cleaned up too.
    const sweepServer = createServer();
    let clockNow = Date.now();
    const sweeper = createDevice(sweepServer, { sync: { [theme]: 'light' } }, [], (input) =>
      syncApi.createConnectionController({ ...input, now: () => clockNow }));
    await sweeper.controller.handle({ operation: 'connect', config });
    const leftover = '/dav/lumno/v1/lock-candidate-left-over/';
    sweepServer.directories.add(leftover);
    sweepServer.directoryTimes.set(leftover, Date.now() - client.STALE_LOCK_MS - 1000);
    clockNow += 25 * 60 * 60 * 1000;
    await sweeper.controller.handle({ operation: 'sync' });
    assert.strictEqual(sweepServer.directories.has(leftover), false, 'the daily sweep removes abandoned lock folders');
    sweepServer.directories.add(leftover);
    const listedBefore = sweepServer.requests.filter((request) => request.method === 'PROPFIND').length;
    await sweeper.controller.handle({ operation: 'sync' });
    assert.strictEqual(sweepServer.requests.filter((request) => request.method === 'PROPFIND').length, listedBefore, 'at most once a day');
    await sweeper.controller.handle({ operation: 'pause' });
  }

  const interruptedServer = createServer();
  const interrupted = createDevice(interruptedServer, { sync: { [theme]: 'light' } });
  const originalPut = interrupted.privateStore.put;
  let interruptCommit = true;
  interrupted.privateStore.put = async (key, value) => {
    if (interruptCommit && key === 'session') { interruptCommit = false; throw new Error('worker terminated'); }
    return originalPut(key, value);
  };
  await assert.rejects(interrupted.controller.handle({ operation: 'connect', config }), /worker terminated/);
  assert(interrupted.privateValues.get('pendingApply'));
  const completed = await interrupted.createController().handle({ operation: 'status' });
  assert.strictEqual(completed.enabled, true, 'a complete interrupted migration commits matching credentials and baseline on restart');
  assert.strictEqual(interrupted.privateValues.get('pendingApply'), null);
  assert.strictEqual(interrupted.privateValues.get('session').base.data[theme], 'light');

  const partial = createDevice(server, { sync: { [theme]: 'system' } });
  const originalReplace = partial.wallpaperStore.replaceAll;
  let interruptMedia = true;
  partial.wallpaperStore.replaceAll = async (records) => {
    await originalReplace(records);
    if (interruptMedia) { interruptMedia = false; throw new Error('worker terminated'); }
  };
  await assert.rejects(partial.controller.handle({ operation: 'connect', config, decision: 'remote' }), /worker terminated/);
  const partialRestart = partial.createController();
  const partialStatus = await partialRestart.handle({ operation: 'status' });
  assert.strictEqual(partialStatus.enabled, false, 'partial applications pause before anything can be uploaded');
  assert.strictEqual(partialStatus.error, 'interrupted-apply');
  assert.strictEqual(partialStatus.hasMigrationBackup, true);
  await partialRestart.handle({ operation: 'restoreBackup' });
  assert.strictEqual(partial.chrome.storage.sync.values[theme], 'system');
  assert.deepStrictEqual(await partial.wallpaperStore.readAll(), []);
  assert.strictEqual((await partialRestart.handle({ operation: 'status' })).enabled, false);

  const corrupt = createDevice(server, { sync: { [theme]: 'system' } });
  const assetFile = [...server.files.entries()].find(([path]) => path.endsWith('.png'));
  const originalBytes = assetFile[1].bytes;
  assetFile[1].bytes = originalBytes.slice();
  assetFile[1].bytes[20] ^= 1;
  await assert.rejects(corrupt.controller.handle({ operation: 'connect', config, decision: 'remote' }), /asset-integrity/);
  assert.strictEqual(corrupt.chrome.storage.sync.values[theme], 'system', 'damaged remote media cannot replace local preferences');
  assert.strictEqual(corrupt.chrome.storage.local.values[settings.localPrimary.key], undefined);
  assetFile[1].bytes = originalBytes;

  const longList = Array.from({ length: 60 }, (_, index) => shortcuts.createShortcutRecord({
    id: `long-${index}`, title: 'Long shortcut', url: `https://example.com/${'x'.repeat(1000)}?id=${index}`
  }, { now: 100 }));
  const localPlan = shortcuts.createShortcutStoragePlan({ items: longList }, { maxItemBytes: Number.MAX_SAFE_INTEGER, maxTotalBytes: Number.MAX_SAFE_INTEGER });
  const staleTail = { [contract.SHORTCUT_SYNC_KEYS[2]]: { r: 'stale', s: [['first', 0, 'First', 'example.com/']] } };
  const chromePlan = contract.planChromeBackup(localPlan.payload, staleTail);
  assert.strictEqual(chromePlan.complete, false);
  assert.strictEqual(Object.keys(chromePlan.payload).length, 3, 'bounded backup updates every shortcut chunk together');
  assert(contract.byteLength(JSON.stringify(chromePlan.payload[contract.SHORTCUT_SYNC_KEYS[0]])) < 8192);
  assert(!JSON.stringify(chromePlan.payload).includes('"first"'), 'backup clears stale tails');
  const legacyChrome = { [newtabShortcutsLegacy.key]: [firstShortcut] };
  const legacyBackup = contract.planChromeBackup(shortcuts.createShortcutStoragePlan({ items: [firstShortcut] }).payload, legacyChrome);
  assert(!legacyBackup.remove.includes(newtabShortcutsLegacy.key) &&
    !Object.hasOwn(legacyBackup.payload, newtabShortcutsLegacy.key), 'backup leaves the legacy list for older devices');
  const smallPayload = shortcuts.createShortcutStoragePlan({ items: [firstShortcut] }).payload;
  const unchangedBackup = contract.planChromeBackup(smallPayload, smallPayload);
  assert(unchangedBackup.complete);
  assert(!contract.SHORTCUT_SYNC_KEYS.some((key) => Object.hasOwn(unchangedBackup.payload, key)),
    'an unchanged grouped copy is not rewritten for a new revision alone');
  const folderServer = createServer();
  const portableFolder = shortcuts.createShortcutRecord({ id: 'folder-sync-entry', type: 'folder', title: 'Design',
    folderRef: { version: 1, root: 'bookmarks-bar', scope: 'account', path: ['Design'], fingerprint: '0123456789abcdef' }
  }, { now: 100 });
  const folderA = createDevice(folderServer, { sync: shortcuts.createShortcutStoragePlan({ items: [firstShortcut, portableFolder] }).payload,
    local: { [shortcutFolderBindings.key]: { [portableFolder.id]: { folderId: '42' } } } });
  await folderA.controller.handle({ operation: 'connect', config });
  assert.strictEqual(folderServer.state().version, 2, 'portable folders opt into the new protocol');
  assert.deepStrictEqual(folderServer.state().shortcuts.map((item) => item.id), [firstShortcut.id, portableFolder.id]);
  assert(!JSON.stringify(folderServer.state()).includes('folderId'), 'no local bookmark IDs reach WebDAV');
  assert(!JSON.stringify(folderServer.state()).includes(shortcutFolderBindings.key));
  const folderB = createDevice(folderServer, { local: { [shortcutFolderBindings.key]: { [portableFolder.id]: { folderId: '117' } } } });
  await folderB.controller.handle({ operation: 'connect', config, decision: 'remote' });
  const bFolders = contract.readShortcutState(folderB.chrome.storage.sync.values, folderB.chrome.storage.local.values[contract.OVERFLOW_KEY]).items;
  assert.deepStrictEqual(bFolders.map((item) => item.id), [firstShortcut.id, portableFolder.id]);
  assert.strictEqual(folderB.chrome.storage.local.values[shortcutFolderBindings.key][portableFolder.id].folderId, '117');
  assert.deepStrictEqual(contract.readShortcutState(folderB.chrome.storage.sync.values, null).items[1].folderRef, portableFolder.folderRef,
    'bounded Chrome backup carries the portable locator');
  await folderB.controller.handle({ operation: 'sync' });
  assert.strictEqual(folderServer.state().version, 2, 'protocol version remains stable after round-trip');
  await set(folderB.chrome.storage.sync, shortcuts.createShortcutStoragePlan({ items: [firstShortcut] }).payload);
  await folderB.controller.handle({ operation: 'sync' });
  await folderA.controller.handle({ operation: 'sync' });
  assert.deepStrictEqual(contract.readShortcutState(folderA.chrome.storage.sync.values, folderA.chrome.storage.local.values[contract.OVERFLOW_KEY]).items.map((item) => item.id), [firstShortcut.id],
    'a removed portable folder is not resurrected by local-folder retention');
  assert.strictEqual(folderServer.state().version, 2, 'deletion does not downgrade the protocol for older clients');
  assert.throws(() => contract.validateState({ ...empty(), shortcuts: [portableFolder] }), /invalid-shortcuts/);
  assert.throws(() => contract.validateState({ ...empty(), version: 2, shortcuts: [{ ...portableFolder, folderId: '42' }] }), /invalid-shortcuts/);
  assert.throws(() => contract.validateState({ ...empty(), version: 4 }), /invalid-state/);
  assert.throws(() => contract.validateState({ ...empty(), version: 3 }), /invalid-shortcuts/,
    'a grouped state must name its groups');
  assert.throws(() => contract.validateState({ ...empty(), version: 3, groups: [{ id: 'g0', title: '' }],
    shortcuts: [{ ...firstShortcut, groupId: 'missing' }] }), /invalid-shortcuts/, 'every shortcut in a grouped state names a known group');
  assert.throws(() => contract.validateState({ ...empty(), version: 3, groups: [{ id: 'g0', title: '' }, { id: 'g0', title: 'Twice' }] }),
    /invalid-shortcuts/);
  assert.throws(() => contract.validateState({ ...empty(), shortcuts: longList.concat(firstShortcut) }), /state-too-large/,
    'an ungrouped state keeps the limit older versions accept');
  const overflowServer = createServer();
  overflowServer.replaceState({ ...empty({ [theme]: 'dark' }), shortcuts: longList });
  const overflowDevice = createDevice(overflowServer, { sync: { [theme]: 'light' } });
  await overflowDevice.controller.handle({ operation: 'save', config });
  await overflowDevice.controller.handle({ operation: 'enable', decision: 'remote' });
  assert(overflowDevice.chrome.storage.local.values[contract.OVERFLOW_KEY].items.length > 0);
  assert.strictEqual(contract.readShortcutState(overflowDevice.chrome.storage.sync.values,
    overflowDevice.chrome.storage.local.values[contract.OVERFLOW_KEY]).items.length, 60,
    'large shortcut lists keep every item through the existing Chrome chunk and local overflow stores');
  assert.strictEqual((await overflowDevice.controller.status()).localPrimary, false);
  await overflowDevice.controller.handle({ operation: 'pause' });

  const saveServer = createServer();
  saveServer.offline = true;
  const saved = createDevice(saveServer, { sync: { [theme]: 'dark' } });
  await assert.rejects(saved.controller.handle({ operation: 'enable' }), /missing-credentials/);
  const chromeBeforeSave = structuredClone(saved.chrome.storage.sync.values);
  await saved.controller.handle({ operation: 'save', config });
  assert.strictEqual(saveServer.requests.length, 0, 'saving is local and works while offline');
  assert.deepStrictEqual(saved.chrome.storage.sync.values, chromeBeforeSave);
  assert.strictEqual((await saved.controller.status()).enabled, false);
  assert.strictEqual((await saved.controller.status()).syncRevision, 'dav-multi-1');
  assert.strictEqual(saved.privateValues.get('session').config.password, config.password);
  assert(!JSON.stringify(await saved.controller.status()).includes(config.password));
  const savedRestart = saved.createController();
  await savedRestart.handle({ operation: 'save', config: { ...config, password: '' } });
  saveServer.offline = false;
  saveServer.unsafeCollections = true;
  saveServer.moveConflictStatus = 409;
  saveServer.etagMode = 'weak';
  await savedRestart.handle({ operation: 'enable' });
  assert.strictEqual((await savedRestart.status()).enabled, true, 'saved credentials enable after a worker restart');
  assert.strictEqual(settingsStorage.createProviderStorageRuntime(saved.chrome).getActiveAreaName(), 'sync');
  const probeCount = () => saveServer.requests.filter((request) => request.path.includes('/probe-')).length;
  const initialProbeCount = probeCount();
  assert(initialProbeCount > 0);
  for (let index = 0; index < 8; index += 1) {
    await savedRestart.handle({ operation: 'pause' });
    await set(saved.chrome.storage.sync, { [theme]: index % 2 ? 'dark' : 'light' });
    await saved.createController().handle({ operation: 'enable' });
    assert.strictEqual(saveServer.state().data[theme], index % 2 ? 'dark' : 'light');
    assert.strictEqual((await savedRestart.status()).enabled, true);
  }
  assert.strictEqual(probeCount(), initialProbeCount, 'repeated toggles and restarts reuse the exact saved capability check');
  assert.strictEqual(saved.privateValues.get('session').config.lockStrategy, 'collection-move');
  const legacySession = saved.privateValues.get('session');
  legacySession.config.clientRevision = 'dav-lock-4';
  legacySession.config.lockStrategy = 'collection-create';
  saved.privateValues.set('session', legacySession);
  await saved.createController().handle({ operation: 'sync' });
  assert(probeCount() > initialProbeCount, 'an older client capability check is upgraded before automatic sync');
  assert.strictEqual(saved.privateValues.get('session').config.clientRevision, 'dav-lock-5');
  assert.strictEqual(saved.privateValues.get('session').config.lockStrategy, 'collection-move');
  const updatedProbeCount = probeCount();
  await savedRestart.handle({ operation: 'test', config: { ...config, password: '' } });
  assert(probeCount() > updatedProbeCount, 'the explicit test action still performs a fresh server test');
  const beforeSettingsEdit = structuredClone(saved.chrome.storage.sync.values);
  await savedRestart.handle({ operation: 'save', config: { ...config, directory: 'other-directory', password: '' } });
  assert.strictEqual((await savedRestart.status()).enabled, false, 'editing the saved server pauses WebDAV');
  assert.strictEqual(saved.privateValues.get('session').base, null, 'a different server cannot inherit the old merge baseline');
  assert.strictEqual((await savedRestart.status()).lastSyncAt, null, 'a different server has its own sync time');
  assert.deepStrictEqual(saved.chrome.storage.sync.values, beforeSettingsEdit);
  assert.strictEqual(saved.privateValues.get('session').config.clientRevision, undefined, 'editing the connection invalidates its capability check');
  const beforeNewDirectory = probeCount();
  await savedRestart.handle({ operation: 'enable' });
  assert(probeCount() > beforeNewDirectory, 'a new sync directory is independently verified');

  const conflictBase = empty({ [theme]: 'light', [language]: 'en', [customSearch]: engine('base') });
  const conflictLocal = empty({ [theme]: 'dark', [language]: 'ja', [customSearch]: engine('local') });
  const conflictRemote = empty({ [theme]: 'system', [language]: 'en', [customSearch]: engine('remote'),
    [settings.simpleModeEnabled.key]: true });
  assert.deepStrictEqual(contract.mergeStates(conflictBase, conflictLocal, conflictRemote, 'remote').state.data,
    { [theme]: 'system', [language]: 'ja', [customSearch]: engine('remote'), [settings.simpleModeEnabled.key]: true },
    'choosing a conflict version preserves unrelated edits from both sides');
  const conflictServer = createServer();
  const conflictDevice = createDevice(conflictServer, { sync: conflictBase.data });
  await conflictDevice.controller.handle({ operation: 'connect', config });
  await set(conflictDevice.chrome.storage.sync, conflictLocal.data);
  conflictServer.replaceState(conflictRemote);
  assert.strictEqual((await conflictDevice.controller.handle({ operation: 'sync' })).conflict, true);
  assert.deepStrictEqual((await conflictDevice.controller.handle({ operation: 'conflictDetails' })).items, [
    { key: theme, domain: 'preference', local: { kind: 'text', value: 'dark' }, remote: { kind: 'text', value: 'system' } },
    { key: customSearch, domain: 'preference', local: { kind: 'list', count: 1 }, remote: { kind: 'list', count: 1 } }
  ], 'conflict details name what both sides changed apart, not settings that resolved on their own');
  const link = (id, title) => ({ id, type: 'link', title, url: `https://${id}.example/` });
  const summaryBase = { ...empty(), shortcuts: [link('a', 'A'), link('b', 'B'), link('c', 'C')] };
  const summaryLocal = { ...empty(), shortcuts: [link('b', 'B'), link('a', 'A'), link('c', 'C2'), link('d', 'D')] };
  const summaryRemote = { ...empty(), shortcuts: [link('a', 'A'), link('c', 'C')] };
  const [shortcutSummary] = contract.describeConflict(summaryBase, summaryLocal, summaryRemote, ['shortcuts']);
  assert.deepStrictEqual(shortcutSummary.local, { total: 4, added: { names: ['D'], count: 1 }, removed: { names: [], count: 0 },
    changed: { names: ['C2'], count: 1 }, reordered: true });
  assert.deepStrictEqual(shortcutSummary.remote, { total: 2, added: { names: [], count: 0 }, removed: { names: ['B'], count: 1 },
    changed: { names: [], count: 0 }, reordered: false });
  const many = Array.from({ length: 9 }, (_, index) => link(`n${index}`, `N${index}`));
  const [capped] = contract.describeConflict(empty(), { ...empty(), shortcuts: many }, empty(), ['shortcuts']);
  assert.strictEqual(capped.local.added.names.length, 6, 'summaries cap the names they carry');
  assert.strictEqual(capped.local.added.count, 9);
  const conflictRemoteBefore = conflictServer.state();
  await conflictDevice.controller.handle({ operation: 'sync' });
  assert.deepStrictEqual(conflictServer.state(), conflictRemoteBefore, 'automatic retries cannot overwrite an unresolved conflict');
  await conflictDevice.controller.handle({ operation: 'sync', decision: 'remote' });
  assert.strictEqual(conflictDevice.chrome.storage.sync.values[theme], 'system');
  assert.strictEqual(conflictDevice.chrome.storage.sync.values[language], 'ja');
  assert.strictEqual(conflictServer.state().data[settings.simpleModeEnabled.key], true);

  const migrated = createDevice(createServer(), { sync: { [theme]: 'light' }, local: {
    [settings.localPrimary.key]: true, [theme]: 'dark' } });
  await migrated.controller.mirrorChrome();
  assert.strictEqual(settingsStorage.createProviderStorageRuntime(migrated.chrome).getActiveAreaName(), 'sync');
  assert.strictEqual(migrated.chrome.storage.sync.values[theme], 'dark', 'an older local installation migrates without losing edits');
  const tooLarge = createDevice(createServer(), { sync: { [theme]: 'light' }, local: {
    [settings.localPrimary.key]: true, [theme]: 'dark', [customSearch]: 'x'.repeat(120 * 1024) } });
  await assert.rejects(tooLarge.controller.mirrorChrome(), /chrome-capacity/);
  assert.strictEqual(tooLarge.chrome.storage.sync.values[theme], 'light', 'an oversized legacy migration cannot partially overwrite Chrome');
  assert.strictEqual(tooLarge.chrome.storage.local.values[customSearch].length, 120 * 1024);

  const autoServer = createServer();
  const auto = createDevice(autoServer, { sync: { [theme]: 'light' } });
  await auto.controller.handle({ operation: 'save', config });
  await auto.controller.handle({ operation: 'enable' });
  await set(auto.chrome.storage.sync, {
    [theme]: 'dark', [settings.simpleModeEnabled.key]: true,
    [settings.aggregateSearches.key]: [{ id: 'research', name: 'Research', providers: ['gg', 'bd'] }],
    ['_x_extension_site_search_custom_2024_unique_']: [{ key: 'docs', name: 'Docs', template: 'https://example.com/?q={query}' }],
    ['_x_extension_search_blacklist_2026_unique_']: ['https://hidden.example/']
  });
  await new Promise((resolve) => setTimeout(resolve, 1750));
  assert.strictEqual(autoServer.state().data[theme], 'dark', 'Chrome changes trigger WebDAV without a manual sync');
  assert.strictEqual(autoServer.state().data[settings.simpleModeEnabled.key], true);
  assert.strictEqual(autoServer.state().data[settings.aggregateSearches.key][0].id, 'research');
  assert.strictEqual(autoServer.state().data['_x_extension_site_search_custom_2024_unique_'][0].key, 'docs');
  assert.deepStrictEqual(autoServer.state().data['_x_extension_search_blacklist_2026_unique_'], ['https://hidden.example/']);
  const beforeManualSync = autoServer.requests.length;
  await set(auto.chrome.storage.sync, { ['_x_extension_sync_meta_2024_unique_']: { lastSyncAt: Date.now(), source: 'manual' } });
  await new Promise((resolve) => setTimeout(resolve, 1750));
  assert(autoServer.requests.length > beforeManualSync, 'manual Chrome sync also triggers a WebDAV check');
  await auto.controller.handle({ operation: 'pause' });
  const beforePausedEdits = autoServer.requests.length;
  await set(auto.chrome.storage.sync, { [theme]: 'light' });
  await new Promise((resolve) => setTimeout(resolve, 1750));
  assert.strictEqual(autoServer.requests.length, beforePausedEdits, 'turning off WebDAV stops remote requests while Chrome still accepts edits');
  assert.strictEqual(auto.chrome.storage.sync.values[theme], 'light');

  // A first join can merge wallpapers: the server's settings and selection win, uploads
  // from both sides are kept once per image, and links are kept once per address.
  const mergeServer = createServer();
  const links = settings.newtabLinkWallpapers.key;
  const sharedImage = fs.readFileSync('assets/wallpapers/lumno-newtab-seurat-coast-white-thumb.webp');
  const onlyB = fs.readFileSync('assets/wallpapers/lumno-newtab-monet-coastal-white-thumb.webp');
  const record = (id, bytes, updatedAt) => ({ id, key: id, name: id, width: 0, height: 0, updatedAt,
    imageDataUrl: `data:image/webp;base64,${bytes.toString('base64')}`, thumbnailDataUrl: `data:image/webp;base64,${bytes.toString('base64')}` });
  const deviceA = createDevice(mergeServer, {
    sync: { [theme]: 'light', [links]: [{ id: 'link-aaaa01', url: 'https://a.example/one.jpg', addedAt: 1 }] },
    local: { [contract.LOCAL_WALLPAPER_KEY]: { version: 1, light: 'custom-wallpaper-a', dark: 'custom-wallpaper-a' } }
  }, [record('custom-wallpaper-a', sharedImage, 10)]);
  await deviceA.controller.handle({ operation: 'connect', config });
  const deviceB = createDevice(mergeServer, {
    sync: { [theme]: 'dark', [links]: [{ id: 'link-bbbb01', url: 'https://b.example/two.jpg', addedAt: 2 },
      { id: 'link-bbbb02', url: 'https://a.example/one.jpg', addedAt: 3 }] },
    local: { [contract.LOCAL_WALLPAPER_KEY]: { version: 1, light: 'custom-wallpaper-b2', dark: 'custom-wallpaper-b2' } }
  }, [record('custom-wallpaper-b1', sharedImage, 20), record('custom-wallpaper-b2', onlyB, 30)]);
  assert.deepStrictEqual(await deviceB.controller.handle({ operation: 'connect', config }), { needsChoice: true });
  await deviceB.controller.handle({ operation: 'connect', config, decision: 'merge' });
  assert.deepStrictEqual(mergeServer.state().wallpapers.map((item) => item.id), ['custom-wallpaper-a', 'custom-wallpaper-b2'],
    'the same image from both devices is kept once');
  assert.deepStrictEqual(mergeServer.state().data[links].map((item) => item.url), ['https://a.example/one.jpg', 'https://b.example/two.jpg'],
    'links are kept once per address');
  assert.strictEqual(mergeServer.state().data[theme], 'light', 'settings follow the server');
  assert.strictEqual(deviceB.chrome.storage.sync.values[theme], 'light');
  assert.deepStrictEqual((await deviceB.wallpaperStore.readAll()).map((item) => item.id).sort(), ['custom-wallpaper-a', 'custom-wallpaper-b2']);
  assert.deepStrictEqual(deviceB.chrome.storage.local.values[contract.LOCAL_WALLPAPER_KEY].light, 'custom-wallpaper-a',
    'the wallpaper in use follows the server too');
  assert.strictEqual(deviceB.chrome.storage.sync.values[links].length, 2);
  assert(deviceB.privateValues.get('migrationBackup'), 'the joining device is backed up before the merge');
  await deviceA.controller.handle({ operation: 'sync' });
  assert.deepStrictEqual((await deviceA.wallpaperStore.readAll()).map((item) => item.id).sort(), ['custom-wallpaper-a', 'custom-wallpaper-b2'],
    'the first device receives the merged wallpapers on its next sync');
  assert.strictEqual(deviceA.chrome.storage.sync.values[links].length, 2);
  assert.strictEqual(deviceA.chrome.storage.sync.values[theme], 'light');

  await testShortcutGroups();
  testOlderWriters();
  await testBackgroundRounds();

  const bigLinks = Array.from({ length: 40 }, (_, index) => ({ id: `link-big${index}xx`, url: `https://big.example/${'x'.repeat(200)}/${index}.jpg`, addedAt: index }));
  assert.throws(() => contract.mergeInitialWallpapers(empty({ [links]: bigLinks.slice(20) }), empty({ [links]: bigLinks.slice(0, 20) })),
    /merge-too-large/, 'a merge past the browser sync item limit fails instead of dropping links');

  console.log('WebDAV sync tests passed: parallel Chrome sync, media, merge, conflict, offline, quota, concurrent edits, restart recovery and integrity');
}
async function testShortcutGroups() {
  const groups = [{ id: 'g0', title: '' }, { id: 'work', title: '工作' }];
  const link = (id, groupId) => shortcuts.createShortcutRecord({ id, title: id, url: `https://${id}.example/`, groupId });
  const groupedPlan = shortcuts.createShortcutStoragePlan({ groups, items: [link('home', 'g0'), link('docs', 'work')] });
  const legacyList = [link('stale', 'g0')];
  const groupServer = createServer();
  const a = createDevice(groupServer, { sync: { ...groupedPlan.payload, [newtabShortcutsLegacy.key]: legacyList } });
  await a.controller.handle({ operation: 'connect', config });
  const published = groupServer.state();
  assert.strictEqual(published.version, contract.GROUPED_STATE_VERSION, 'real groups need the grouped protocol');
  assert.deepStrictEqual(published.groups, groups);
  assert.deepStrictEqual(published.shortcuts.map((item) => [item.id, item.groupId]), [['home', 'g0'], ['docs', 'work']]);
  assert(!JSON.stringify(published).includes('stale'), 'the legacy list is not mistaken for current shortcuts');

  const b = createDevice(groupServer, { sync: { [newtabShortcutsLegacy.key]: legacyList } });
  await b.controller.handle({ operation: 'connect', config, decision: 'remote' });
  const received = contract.readShortcutState(b.chrome.storage.sync.values, b.chrome.storage.local.values[contract.OVERFLOW_KEY]);
  assert.deepStrictEqual(received.groups, groups, 'a joining device receives the groups');
  assert.deepStrictEqual(received.items.map((item) => item.id), ['home', 'docs']);
  assert.deepStrictEqual(b.chrome.storage.sync.values[newtabShortcutsLegacy.key], legacyList,
    'applying a remote state keeps the legacy list an older device still reads');

  const renamed = shortcuts.createShortcutStoragePlan({ groups: [groups[0], { id: 'work', title: '工作台' }],
    items: received.items });
  await set(b.chrome.storage.sync, renamed.payload);
  await b.controller.handle({ operation: 'sync' });
  await a.controller.handle({ operation: 'sync' });
  assert.deepStrictEqual(contract.readShortcutState(a.chrome.storage.sync.values, null).groups[1].title, '工作台',
    'a renamed group reaches the other device');

  const flat = createServer();
  const plain = createDevice(flat, { sync: shortcuts.createShortcutStoragePlan({ items: [link('one')] }).payload });
  await plain.controller.handle({ operation: 'connect', config });
  assert.strictEqual(flat.state().version, 1, 'a state without real groups stays readable by older versions');

  const many = Array.from({ length: 120 }, (_, index) => link(`site${index}`));
  const largeServer = createServer();
  const large = createDevice(largeServer, { sync: shortcuts.createShortcutStoragePlan({ items: many }).payload });
  await large.controller.handle({ operation: 'connect', config });
  assert.strictEqual(largeServer.state().version, contract.GROUPED_STATE_VERSION,
    'more shortcuts than older versions accept need the grouped protocol');
  assert.strictEqual(largeServer.state().shortcuts.length, 120);

  // A baseline from before groups still has timestamps on every shortcut.
  const oldBase = { ...empty(), shortcuts: [{ ...link('home'), createdAt: 1, updatedAt: 2 }] };
  const sameAsBase = { ...empty(), shortcuts: [link('home')] };
  const remoteEdit = { ...empty(), shortcuts: [link('home'), link('new')] };
  const merged = contract.mergeStates(oldBase, contract.validateState(sameAsBase), contract.validateState(remoteEdit));
  assert.deepStrictEqual(merged.conflicts, [], 'dropped timestamps do not read as a local edit');
  assert.deepStrictEqual(merged.state.shortcuts.map((item) => item.id), ['home', 'new']);

  const base = contract.validateState({ ...empty(), version: 3, groups, shortcuts: [link('home', 'g0')] });
  const localGroups = contract.validateState({ ...base, groups: [groups[0], { id: 'work', title: 'Local' }] });
  const remoteGroups = contract.validateState({ ...base, groups: [groups[0], { id: 'work', title: 'Remote' }] });
  assert.deepStrictEqual(contract.mergeStates(base, localGroups, remoteGroups).conflicts, ['shortcuts'],
    'groups changed on both devices are a shortcut conflict, not a silent pick');
  assert.strictEqual(contract.mergeStates(base, localGroups, remoteGroups, 'remote').state.groups[1].title, 'Remote');
  const remoteItems = contract.validateState({ ...base, shortcuts: [link('home', 'g0'), link('docs', 'work')] });
  const mergedItems = contract.mergeStates(base, base, remoteItems);
  assert.deepStrictEqual(mergedItems.conflicts, []);
  assert.deepStrictEqual(mergedItems.state.shortcuts.map((item) => item.groupId), ['g0', 'work']);
}
// Waits until the controller's queue is idle and the status leaves 'syncing'.
// An older version drops the settings it does not know whenever it saves; that
// must not read as removing them.
function testOlderWriters() {
  const glass = settings.newtabGlassStyle.key;
  const size = settings.newtabTimeFontSize.key;
  const ink = settings.newtabTimeInk.key;
  const twelveHour = settings.newtabTime12Hour.key;
  const quotes = '_x_extension_custom_quotes_2026_unique_';
  const shared = '_x_extension_recent_count_2024_unique_';
  const own = (data) => contract.validateState({ ...empty(data), keys: contract.KNOWN_KEYS });
  const mine = own({ [shared]: 1, [glass]: 'liquid', [size]: 72, [ink]: 'light', [twelveHour]: true,
    [quotes]: { v: 1, items: ['a'] } });
  assert.strictEqual(contract.validateState(mine).keys.length, contract.KNOWN_KEYS.length, 'a state keeps its writer list');

  // 1.0.0 saved a change of its own and dropped the keys it never knew.
  const legacy = contract.validateState(empty({ [shared]: 2 }));
  const merged = contract.mergeStates(mine, mine, legacy);
  assert.deepStrictEqual(merged.conflicts, []);
  assert.strictEqual(merged.state.data[shared], 2, 'the older device\'s own change arrives');
  assert.strictEqual(merged.state.data[glass], 'liquid', 'a setting the older device never knew stays');
  assert.strictEqual(merged.state.data[size], 72);
  assert.strictEqual(merged.state.data[ink], 'light');
  assert.strictEqual(merged.state.data[twelveHour], true);
  assert.deepStrictEqual(merged.state.data[quotes], { v: 1, items: ['a'] });
  assert.ok(!contract.sameContent(merged.state, legacy), 'the restored settings go back to the server');
  assert.deepStrictEqual(contract.adoptRemote(mine, legacy).data,
    { [shared]: 2, [glass]: 'liquid', [size]: 72, [ink]: 'light', [twelveHour]: true, [quotes]: { v: 1, items: ['a'] } },
    'choosing the server copy keeps what its writer never knew');

  // A writer that knows a key and leaves it out removed it.
  const removed = own({ [shared]: 1, [size]: 72, [ink]: 'light', [twelveHour]: true, [quotes]: { v: 1, items: ['a'] } });
  assert.ok(!Object.prototype.hasOwnProperty.call(contract.mergeStates(mine, mine, removed).state.data, glass));

  // Two versions with different lists do not rewrite the server after each other.
  const newer = contract.validateState({ ...mine, keys: [...contract.KNOWN_KEYS, '_x_extension_future_2030_unique_'] });
  assert.ok(contract.sameContent(contract.mergeStates(mine, mine, newer).state, newer));
  assert.throws(() => contract.validateState({ ...empty(), keys: [1] }), /invalid-state/);
}

async function settle(device) {
  for (let wait = 0; wait < 100; wait += 1) {
    const current = await device.controller.handle({ operation: 'status' });
    if (current.state !== 'syncing') return current;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('sync did not settle');
}
async function testBackgroundRounds() {
  const quiet = (options) => syncApi.createConnectionController({ ...options, logger: { warn() {} } });
  // An older local-only installation whose settings no longer fit browser sync.
  const oversized = createServer();
  const stalled = createDevice(oversized, { sync: { [theme]: 'light' } }, [], quiet);
  await stalled.controller.handle({ operation: 'connect', config });
  await set(stalled.chrome.storage.local, { [settings.localPrimary.key]: true, [theme]: 'dark',
    [customSearch]: 'x'.repeat(120 * 1024) });
  const before = oversized.requests.length;
  stalled.chrome.alarms.fire(syncApi.ALARM_NAME);
  const stalledStatus = await settle(stalled);
  assert(oversized.requests.length > before, 'a failed browser-sync backup does not stop the WebDAV round');
  assert.strictEqual(stalledStatus.chromeBackup, 'incomplete', 'the card learns that the backup is incomplete');
  assert.deepStrictEqual([stalledStatus.state, stalledStatus.error], ['error', 'chrome-capacity'],
    'the round that could not apply the settings reports it instead of leaving a stale synced status');
  assert.strictEqual(stalled.chrome.storage.sync.values[theme], 'light', 'browser sync is still never partially replaced');

  // Shortcuts beyond the browser sync budget: WebDAV syncs them through the
  // overflow record, but the old full-copy backup cannot hold them.
  const longList = Array.from({ length: 60 }, (_, index) => shortcuts.createShortcutRecord({
    id: `long-${index}`, title: 'Long shortcut', url: `https://example.com/${'x'.repeat(1000)}?id=${index}`
  }, { now: 100 }));
  const overflowServer = createServer();
  const partial = createDevice(overflowServer, { sync: { [theme]: 'light' } }, [], quiet);
  await partial.controller.handle({ operation: 'connect', config });
  await set(partial.chrome.storage.local, { [settings.localPrimary.key]: true,
    ...shortcuts.createShortcutStoragePlan({ items: longList }, { maxItemBytes: Number.MAX_SAFE_INTEGER, maxTotalBytes: Number.MAX_SAFE_INTEGER }).payload });
  assert.deepStrictEqual(await partial.controller.handle({ operation: 'sync' }), { ok: true },
    'a sync whose backup is incomplete still succeeds');
  const partialStatus = await partial.controller.handle({ operation: 'status' });
  assert.deepStrictEqual([partialStatus.state, partialStatus.chromeBackup, partialStatus.localPrimary], ['ready', 'incomplete', true]);
  assert.strictEqual(overflowServer.state().shortcuts.length, 60);

  // A background round that fails without recording a status is logged, not swallowed.
  const logged = [];
  const brokenServer = createServer();
  const broken = createDevice(brokenServer, { sync: { [theme]: 'light' } }, [], (options) =>
    syncApi.createConnectionController({ ...options, logger: { warn: (...args) => logged.push(args) } }));
  await broken.controller.handle({ operation: 'connect', config });
  const originalSet = broken.chrome.storage.local.set;
  broken.chrome.storage.local.set = (payload, callback) => {
    if (Object.keys(payload).some((key) => key.startsWith(settings.webdavStatus.key))) {
      broken.chrome.runtime.lastError = { message: 'QUOTA_BYTES quota exceeded' };
      callback();
      broken.chrome.runtime.lastError = null;
      return;
    }
    originalSet.call(broken.chrome.storage.local, payload, callback);
  };
  broken.chrome.alarms.fire(syncApi.ALARM_NAME);
  for (let wait = 0; wait < 50 && !logged.length; wait += 1) await new Promise((resolve) => setTimeout(resolve, 10));
  assert(logged.some(([message]) => /WebDAV sync failed/.test(message)), 'an unrecorded background failure reaches the log');
  broken.chrome.storage.local.set = originalSet;

  // A lock this device could not release is remembered and released first on
  // the next round, so other devices are not left at remote-locked.
  const lockServer = createServer();
  const lockPath = '/dav/lumno/v1/write-lock/';
  const holder = createDevice(lockServer, { sync: { [theme]: 'light' } }, [], quiet);
  await holder.controller.handle({ operation: 'connect', config });
  let lostReleases = 2;
  lockServer.beforeRequest = (path, options) => {
    if (path === lockPath && options.method === 'DELETE' && lostReleases > 0) { lostReleases -= 1; throw new Error('release response lost'); }
  };
  await set(holder.chrome.storage.sync, { [theme]: 'dark' });
  assert.deepStrictEqual(await holder.controller.handle({ operation: 'sync' }), { ok: true }, 'the committed write still counts as synced');
  assert.strictEqual(lockServer.state().data[theme], 'dark');
  assert(lockServer.directories.has(lockPath));
  assert.strictEqual(typeof holder.privateValues.get('staleLock').owner, 'string', 'the unreleased lock is remembered');
  lockServer.beforeRequest = null;
  await holder.controller.handle({ operation: 'sync' });
  assert.strictEqual(lockServer.directories.has(lockPath), false, 'the next round releases it first');
  assert.strictEqual(holder.privateValues.get('staleLock'), null);

  // An edit that lands between publishing and applying a merge: the next round
  // merges from what both sides then share, instead of reporting this device's
  // already-published list edit as a conflict.
  const windowServer = createServer();
  const windowed = createDevice(windowServer, { sync: { [theme]: 'light', [language]: 'en', [customSearch]: engine('base') } }, [], quiet);
  await windowed.controller.handle({ operation: 'connect', config });
  await set(windowed.chrome.storage.sync, { [customSearch]: engine('local') });
  windowServer.replaceState({ ...windowServer.state(), data: { ...windowServer.state().data, [language]: 'ja' } });
  let edited = false;
  windowServer.afterPut = async (path) => {
    if (!edited && path.endsWith('/state.json')) { edited = true; await set(windowed.chrome.storage.sync, { [customSearch]: engine('later') }); }
  };
  await assert.rejects(windowed.controller.handle({ operation: 'sync' }), /local-changed/);
  windowServer.afterPut = null;
  assert.deepStrictEqual(windowServer.state().data[customSearch], engine('local'), 'the merge was published before the apply failed');
  assert.deepStrictEqual(await windowed.controller.handle({ operation: 'sync' }), { ok: true }, 'no false conflict after the failed apply');
  assert.deepStrictEqual(windowServer.state().data[customSearch], engine('later'));
  assert.strictEqual(windowed.chrome.storage.sync.values[language], 'ja', 'the server change still arrives');

  // Applying a server change does not make this connection start another round.
  const selfServer = createServer();
  const applying = createDevice(selfServer, { sync: { [theme]: 'light' } }, [], quiet);
  await applying.controller.handle({ operation: 'connect', config });
  await new Promise((resolve) => setTimeout(resolve, 1600));
  selfServer.replaceState({ ...selfServer.state(), data: { ...selfServer.state().data, [theme]: 'dark' } });
  await applying.controller.handle({ operation: 'sync' });
  assert.strictEqual(applying.chrome.storage.sync.values[theme], 'dark');
  const afterApply = selfServer.requests.length;
  await new Promise((resolve) => setTimeout(resolve, 1700));
  assert.strictEqual(selfServer.requests.length, afterApply, 'its own writes are not taken for new local edits');
  await set(applying.chrome.storage.sync, { [theme]: 'light' });
  await new Promise((resolve) => setTimeout(resolve, 1700));
  await settle(applying);
  assert.strictEqual(selfServer.state().data[theme], 'light', 'a later edit back to the earlier value still syncs');
  await applying.controller.handle({ operation: 'pause' });

  // Publishing reads the state once under the lock, keeps a bounded number of
  // snapshots per device and does not download media the server already has.
  const leanServer = createServer();
  const wallpaperBytes = fs.readFileSync('assets/wallpapers/lumno-newtab-seurat-coast-white-thumb.webp');
  const wallpaperDigest = require('crypto').createHash('sha256').update(wallpaperBytes).digest('hex');
  const wallpaperPath = `/dav/lumno/v1/assets/${wallpaperDigest}.webp`;
  leanServer.files.set(wallpaperPath, { bytes: new Uint8Array(wallpaperBytes), etag: '"asset"' });
  const lean = createDevice(leanServer, { sync: { [theme]: 'light' } }, [{ id: 'custom-wallpaper-lean', key: 'custom-wallpaper-lean',
    name: 'Lean', width: 0, height: 0, updatedAt: 1, imageDataUrl: `data:image/webp;base64,${wallpaperBytes.toString('base64')}`,
    thumbnailDataUrl: `data:image/webp;base64,${wallpaperBytes.toString('base64')}` }], quiet);
  await lean.controller.handle({ operation: 'connect', config });
  assert(leanServer.requests.some((request) => request.path === wallpaperPath && request.method === 'HEAD'));
  assert(!leanServer.requests.some((request) => request.path === wallpaperPath && ['GET', 'PUT'].includes(request.method)),
    'a content-addressed asset of the right size is neither downloaded nor uploaded again');
  const snapshotPaths = () => [...leanServer.files.keys()].filter((path) => path.includes('/snapshots/'));
  for (let index = 0; index < 13; index += 1) {
    await set(lean.chrome.storage.sync, { [theme]: `theme-${index}` });
    const before = leanServer.requests.length;
    await lean.controller.handle({ operation: 'sync' });
    const stateReads = leanServer.requests.slice(before).filter((request) => request.path.endsWith('/state.json') && request.method === 'GET');
    assert.strictEqual(stateReads.length, 3, 'one read to merge, one under the lock and one to verify the write');
  }
  assert.strictEqual(snapshotPaths().length, 10, 'only the latest ten snapshots of this device are kept');
  assert.strictEqual(JSON.parse(new TextDecoder().decode(leanServer.files.get(snapshotPaths().find((path) =>
    path.endsWith(`-${(13 - 1) % 10}.json`))).bytes)).data[theme], 'theme-11', 'the newest snapshot holds the state it replaced');
  await lean.controller.handle({ operation: 'pause' });

  // When the storage mode cannot be read, the settings might come from the
  // wrong area; they are never uploaded as this device's copy.
  const unreadableServer = createServer();
  const unreadable = createDevice(unreadableServer, { sync: { [theme]: 'light' } }, [], (options) => {
    const originalGet = options.chrome.storage.local.get;
    options.chrome.storage.local.get = (keys, callback) => {
      if (Array.isArray(keys) && keys.length === 1 && keys[0] === settings.localPrimary.key) {
        options.chrome.runtime.lastError = { message: 'IO error' };
        callback(undefined);
        options.chrome.runtime.lastError = null;
        return;
      }
      originalGet(keys, callback);
    };
    const warn = console.warn;
    console.warn = () => {};
    const runtime = settingsStorage.createProviderStorageRuntime(options.chrome, { modeRetryDelaysMs: [] });
    runtime.ready.finally(() => { console.warn = warn; });
    return quiet(options);
  });
  await assert.rejects(unreadable.controller.handle({ operation: 'connect', config }), /local-storage-failed/);
  assert.strictEqual(unreadableServer.files.has('/dav/lumno/v1/state.json'), false, 'nothing is published from an unknown storage mode');

  // Applying a remote copy rides out a burst that exhausted the sync write quota.
  const burstServer = createServer();
  burstServer.replaceState(empty({ [theme]: 'dark' }));
  const burst = createDevice(burstServer, { sync: { [theme]: 'light' } }, [], (options) =>
    quiet({ ...options, storageRetryDelayMs: 0 }));
  const syncSet = burst.chrome.storage.sync.set;
  let refusals = 1;
  burst.chrome.storage.sync.set = (payload, callback) => {
    if (refusals > 0) {
      refusals -= 1;
      burst.chrome.runtime.lastError = { message: 'This request exceeds the MAX_WRITE_OPERATIONS_PER_MINUTE quota.' };
      callback();
      burst.chrome.runtime.lastError = null;
      return;
    }
    syncSet(payload, callback);
  };
  await burst.controller.handle({ operation: 'connect', config, decision: 'remote' });
  assert.strictEqual(refusals, 0);
  assert.strictEqual(burst.chrome.storage.sync.values[theme], 'dark', 'a write refused by the quota is retried once');
}
if (require.main === module) run().catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { createServer, createDevice, config, empty, set };
