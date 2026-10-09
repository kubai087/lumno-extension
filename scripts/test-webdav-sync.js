const assert = require('assert');
const fs = require('fs');
const { webcrypto, randomUUID } = require('crypto');
const settings = require('../src/shared/settings.js');
const shortcuts = require('../src/newtab/shortcuts-store.js');
const contract = require('../src/shared/webdav-contract.js');
const client = require('../src/background/webdav-client.js');
const syncApi = require('../src/background/webdav-sync.js');
const { probeProvider } = require('./probe-webdav.js');
const cryptoApi = { subtle: webcrypto.subtle, randomUUID };
const config = { endpoint: 'https://dav.example.test/dav/', directory: 'lumno', username: 'user', password: 'app-password' };
const theme = settings.THEME_STORAGE_KEY;
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
    loseMoveSource: false, refuseMoves: 0, refusalStillMoves: false, refuseCollections: false, compressAbove: 0 };
  server.fetch = async (url, options) => {
    if (server.offline) throw new Error('network is offline');
    const path = new URL(url).pathname;
    const headers = new Headers(options.headers);
    assert.strictEqual(headers.get('Authorization'), `Basic ${Buffer.from('user:app-password').toString('base64')}`);
    assert.strictEqual(options.redirect, 'error');
    assert.strictEqual(options.credentials, 'omit');
    server.requests.push({ path, method: options.method });
    if (server.beforeRequest) await server.beforeRequest(path, options);
    const entry = files.get(path);
    const response = (status, bytes, etag) => new Response([204, 304].includes(status) || options.method === 'HEAD' ? null : bytes || '', {
      // compressAbove mimics Cloudflare weakening strong ETags on bodies it compresses.
      status, headers: { ...(etag && server.etagMode !== 'none' ? { ETag: server.etagMode === 'weak' ||
        (server.compressAbove && bytes && bytes.byteLength > server.compressAbove) ? `W/${etag}` : etag } : {}), 'Content-Length': String(bytes && bytes.byteLength || 0) }
    });
    if (options.method === 'MKCOL') {
      if (server.refuseCollections) return response(405);
      if (directories.has(path) && !server.unsafeCollections) return response(405);
      directories.add(path);
      return response(201);
    }
    if (options.method === 'GET' || options.method === 'HEAD') {
      if (server.stateStatus && path.endsWith('/state.json')) return response(server.stateStatus);
      if (!entry) return response(404);
      if (headers.get('If-None-Match') === entry.etag) return response(304, null, entry.etag);
      return response(200, entry.bytes, entry.etag);
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
    const next = { bytes, etag: server.etagMode === 'size' ? `"size-${bytes.byteLength}"` : `"revision-${++revision}"` };
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
  assert.throws(() => client.normalizeConfig({ ...config, endpoint: 'http://dav.test/' }), /invalid-endpoint/);
  assert.throws(() => client.normalizeConfig({ ...config, endpoint: 'https://user:password@dav.test/' }), /invalid-endpoint/);
  assert.throws(() => client.normalizeConfig({ ...config, directory: '../outside' }), /invalid-directory/);
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
  await assert.rejects(client.createClient(lockConfig, { fetch: uncertainMove.fetch }).writeState(empty(), null), /lock-write-uncertain/);
  assert(uncertainMove.directories.size > 0, 'a timed-out MOVE preserves its candidate for explicit recovery');
  assert.strictEqual(uncertainMove.files.has('/dav/lumno/v1/state.json'), false);

  const replacedOwner = createServer();
  replacedOwner.etagMode = 'none';
  replacedOwner.afterPut = (path) => {
    if (path.endsWith('/state.json')) replacedOwner.files.set(lockPath + 'owner.txt', { bytes: new TextEncoder().encode('other-owner') });
  };
  await assert.rejects(client.createClient(lockConfig, { fetch: replacedOwner.fetch }).writeState(empty(), null), /lock-release-failed/);
  assert(replacedOwner.directories.has(lockPath), 'a changed owner is never deleted on release');

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
  await assert.rejects(restartWriter.writeState(empty({ [theme]: 'light' }), (await restartWriter.readState()).etag), /lock-release-failed/);
  assert(uncertain.directories.has(lockPath));

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
  const settingBoth = contract.mergeStates(base, empty({ [theme]: 'dark' }), empty({ [theme]: 'system' }));
  assert.deepStrictEqual(settingBoth.conflicts, [], 'a single setting both sides changed is not a conflict');
  assert.strictEqual(settingBoth.state.data[theme], 'dark', 'this device holds the latest edit of a single setting');
  assert.deepStrictEqual(contract.mergeStates(empty({ [customSearch]: engine('base') }), empty({ [customSearch]: engine('a') }),
    empty({ [customSearch]: engine('b') })).conflicts, [customSearch], 'a list both sides changed apart is a conflict');
  const deletion = contract.mergeStates(base, empty({ [language]: 'en' }), base);
  assert.strictEqual(Object.hasOwn(deletion.state.data, theme), false);
  assert.throws(() => contract.validateState({ ...empty(), version: 100 }), /invalid-state/);
  const quote = settings.NEWTAB_QUOTE_PREFS_STORAGE_KEY;
  const quoteBase = empty({ [quote]: { enabled: true, position: 'search', category: 'literature', fontSize: 16 } });
  const quoteLocal = empty({ [quote]: { ...quoteBase.data[quote], fontSize: 20 } });
  const quoteRemote = empty({ [quote]: { ...quoteBase.data[quote], position: 'bottom' } });
  const quoteMerged = contract.mergeStates(quoteBase, quoteLocal, quoteRemote);
  assert.deepStrictEqual(quoteMerged.conflicts, [], 'different fields of a field-merged record do not conflict');
  assert.deepStrictEqual(quoteMerged.state.data[quote], { enabled: true, position: 'bottom', category: 'literature', fontSize: 20 });
  const quoteBoth = empty({ [quote]: { ...quoteRemote.data[quote], fontSize: 18, category: 'poetry' } });
  const quoteBothMerged = contract.mergeStates(quoteBase, quoteLocal, quoteBoth);
  assert.deepStrictEqual(quoteBothMerged.conflicts, [], 'a field both sides changed is a single setting');
  assert.deepStrictEqual(quoteBothMerged.state.data[quote],
    { enabled: true, position: 'bottom', category: 'poetry', fontSize: 20 }, 'this device wins only the fields both sides changed');
  assert.deepStrictEqual(contract.mergeStates(quoteBase, quoteLocal, quoteBoth, 'remote').state.data[quote],
    { enabled: true, position: 'bottom', category: 'poetry', fontSize: 18 }, 'choosing the server version applies to settings too');
  assert.deepStrictEqual(contract.describeConflict(quoteBase, quoteLocal, quoteBoth, [quote]), [
    { key: quote, field: 'fontSize', domain: 'preference', local: { kind: 'number', value: 20 }, remote: { kind: 'number', value: 18 } }
  ], 'field conflicts list only the fields both sides changed apart');
  const quoteDeleted = contract.mergeStates(quoteBase, empty(), quoteRemote);
  assert.strictEqual(Object.hasOwn(quoteDeleted.state.data, quote), false, 'deleting a record is a whole-value change');
  assert.deepStrictEqual(contract.mergeStates(empty(), quoteLocal, quoteBoth).state.data[quote],
    quoteLocal.data[quote], 'a missing base record counts as empty, so every differing field is this device\'s');
  const folderColors = settings.BOOKMARK_FOLDER_COLOR_REFS_STORAGE_KEY;
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
  const [topbarMode, topbarLight, topbarDark, topbarLegacy] = settings.BOOKMARK_TOPBAR_LOCAL_STORAGE_KEYS;
  const first = createDevice(server, {
    sync: { [theme]: 'light', [language]: 'en', [contract.SHORTCUT_KEYS[0]]: [firstShortcut] },
    local: { [contract.OVERFLOW_KEY]: { authoritative: false, items: [overflowShortcut] },
      [contract.ICONS_KEY]: { first: `data:image/png;base64,${icon.toString('base64')}` },
      [contract.LOCAL_WALLPAPER_KEY]: { version: 1, light: 'custom-wallpaper-test', dark: 'custom-wallpaper-test' },
      [topbarMode]: 'custom', [topbarLight]: '#112233', [topbarDark]: '#445566', [topbarLegacy]: '#778899' }
  }, [{ id: 'custom-wallpaper-test', key: 'custom-wallpaper-test', name: 'Test', width: 480, height: 270, updatedAt: 100,
    imageDataUrl: `data:image/webp;base64,${wallpaper.toString('base64')}`, thumbnailDataUrl: `data:image/webp;base64,${wallpaper.toString('base64')}` }]);
  await first.controller.handle({ operation: 'connect', config });
  assert.strictEqual(first.chrome.storage.local.values[settings.LOCAL_PRIMARY_STORAGE_KEY], undefined);
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
  assert.strictEqual(second.chrome.storage.local.values[settings.LOCAL_PRIMARY_STORAGE_KEY], undefined, 'first-use choice cannot silently migrate');
  await second.controller.handle({ operation: 'connect', config, decision: 'remote' });
  assert.strictEqual(second.chrome.storage.sync.values[theme], 'light');
  assert.strictEqual(second.chrome.storage.local.values[contract.ICONS_KEY].first, first.chrome.storage.local.values[contract.ICONS_KEY].first);
  assert.strictEqual((await second.wallpaperStore.readAll())[0].imageDataUrl, (await first.wallpaperStore.readAll())[0].imageDataUrl);
  assert.deepStrictEqual(second.chrome.storage.local.values[contract.LOCAL_WALLPAPER_KEY], first.chrome.storage.local.values[contract.LOCAL_WALLPAPER_KEY]);
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
  assert.strictEqual(Object.hasOwn(server.state().data, topbarLegacy), false, 'the legacy single color migrates locally and never syncs');
  [first, second].forEach((device) => settings.BOOKMARK_TOPBAR_LOCAL_STORAGE_KEYS.forEach((key) => {
    assert.strictEqual(Object.hasOwn(device.chrome.storage.sync.values, key), false, 'bookmark bar material never enters browser sync');
  }));
  await set(first.chrome.storage.local, { [topbarMode]: 'clear' });
  await set(second.chrome.storage.local, { [topbarDark]: '#000000' });
  await first.controller.handle({ operation: 'sync' });
  await second.controller.handle({ operation: 'sync' });
  await first.controller.handle({ operation: 'sync' });
  [first, second].forEach((device) => assert.deepStrictEqual([topbarMode, topbarLight, topbarDark].map((key) =>
    device.chrome.storage.local.values[key]), ['clear', '#112233', '#000000'], 'each bookmark bar value merges on its own'));

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
  assert.deepStrictEqual(await second.controller.handle({ operation: 'sync' }), { ok: true }, 'a setting both devices changed does not ask');
  assert.strictEqual(server.state().data[theme], 'system', 'the device that synced last publishes its setting');
  await first.controller.handle({ operation: 'sync' });
  assert.strictEqual(first.chrome.storage.sync.values[theme], 'system');

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
  assert.strictEqual(first.chrome.storage.local.values[settings.LOCAL_PRIMARY_STORAGE_KEY], undefined, 'pausing WebDAV leaves Chrome authoritative');
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
  assert.strictEqual(first.chrome.storage.local.values[settings.LOCAL_PRIMARY_STORAGE_KEY], undefined);
  assert.strictEqual(first.chrome.storage.sync.values[theme], 'dark');
  assert.strictEqual((await first.controller.status()).enabled, false);

  // New pages and Chrome-delivered changes keep the existing sync path.
  const restartedSettings = settings.createProviderStorageRuntime(second.chrome);
  await restartedSettings.ready;
  const coldSettings = settings.createProviderStorageRuntime({ ...second.chrome });
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
  assert.strictEqual(corrupt.chrome.storage.local.values[settings.LOCAL_PRIMARY_STORAGE_KEY], undefined);
  assetFile[1].bytes = originalBytes;

  const longList = Array.from({ length: 60 }, (_, index) => shortcuts.createShortcutRecord({
    id: `long-${index}`, title: 'Long shortcut', url: `https://example.com/${'x'.repeat(1000)}?id=${index}`
  }, { now: 100 }));
  const localPlan = shortcuts.createShortcutStoragePlan(longList, { maxItemBytes: Number.MAX_SAFE_INTEGER, maxTotalBytes: Number.MAX_SAFE_INTEGER });
  const chromePlan = contract.planChromeBackup(localPlan.payload, { [contract.SHORTCUT_KEYS[2]]: [firstShortcut] });
  assert.strictEqual(chromePlan.complete, false);
  assert.strictEqual(Object.keys(chromePlan.payload).length, 3, 'bounded backup updates every shortcut chunk together');
  assert(contract.byteLength(JSON.stringify(chromePlan.payload[contract.SHORTCUT_KEYS[0]])) < 8192);
  assert(!JSON.stringify(chromePlan.payload).includes('"first"'), 'backup clears stale tails');
  const folderServer = createServer();
  const folderRefs = require('../src/shared/bookmark-folder-reference.js');
  const portableFolder = shortcuts.createShortcutRecord({ id: 'folder-sync-entry', type: 'folder', title: 'Design',
    folderRef: { version: 1, root: 'bookmarks-bar', scope: 'account', path: ['Design'], fingerprint: '0123456789abcdef' }
  }, { now: 100 });
  const folderA = createDevice(folderServer, { sync: shortcuts.createShortcutStoragePayload([firstShortcut, portableFolder]),
    local: { [folderRefs.BINDINGS_KEY]: { [portableFolder.id]: { folderId: '42' } } } });
  await folderA.controller.handle({ operation: 'connect', config });
  assert.strictEqual(folderServer.state().version, 2, 'portable folders opt into the new protocol');
  assert.deepStrictEqual(folderServer.state().shortcuts.map((item) => item.id), [firstShortcut.id, portableFolder.id]);
  assert(!JSON.stringify(folderServer.state()).includes('folderId'), 'no local bookmark IDs reach WebDAV');
  assert(!JSON.stringify(folderServer.state()).includes(folderRefs.BINDINGS_KEY));
  const folderB = createDevice(folderServer, { local: { [folderRefs.BINDINGS_KEY]: { [portableFolder.id]: { folderId: '117' } } } });
  await folderB.controller.handle({ operation: 'connect', config, decision: 'remote' });
  const bFolders = contract.readShortcuts(folderB.chrome.storage.sync.values, folderB.chrome.storage.local.values[contract.OVERFLOW_KEY]);
  assert.deepStrictEqual(bFolders.map((item) => item.id), [firstShortcut.id, portableFolder.id]);
  assert.strictEqual(folderB.chrome.storage.local.values[folderRefs.BINDINGS_KEY][portableFolder.id].folderId, '117');
  assert.deepStrictEqual(folderB.chrome.storage.sync.values[contract.SHORTCUT_KEYS[0]][1].folderRef, portableFolder.folderRef,
    'bounded Chrome backup carries the portable locator');
  await folderB.controller.handle({ operation: 'sync' });
  assert.strictEqual(folderServer.state().version, 2, 'protocol version remains stable after round-trip');
  await set(folderB.chrome.storage.sync, shortcuts.createShortcutStoragePayload([firstShortcut]));
  await folderB.controller.handle({ operation: 'sync' });
  await folderA.controller.handle({ operation: 'sync' });
  assert.deepStrictEqual(contract.readShortcuts(folderA.chrome.storage.sync.values, folderA.chrome.storage.local.values[contract.OVERFLOW_KEY]).map((item) => item.id), [firstShortcut.id],
    'a removed portable folder is not resurrected by local-folder retention');
  assert.strictEqual(folderServer.state().version, 2, 'deletion does not downgrade the protocol for older clients');
  assert.throws(() => contract.validateState({ ...empty(), shortcuts: [portableFolder] }), /invalid-shortcuts/);
  assert.throws(() => contract.validateState({ ...empty(), version: 2, shortcuts: [{ ...portableFolder, folderId: '42' }] }), /invalid-shortcuts/);
  assert.throws(() => contract.validateState({ ...empty(), version: 3 }), /invalid-state/);
  const overflowServer = createServer();
  overflowServer.replaceState({ ...empty({ [theme]: 'dark' }), shortcuts: longList });
  const overflowDevice = createDevice(overflowServer, { sync: { [theme]: 'light' } });
  await overflowDevice.controller.handle({ operation: 'save', config });
  await overflowDevice.controller.handle({ operation: 'enable', decision: 'remote' });
  assert(overflowDevice.chrome.storage.local.values[contract.OVERFLOW_KEY].items.length > 0);
  assert.strictEqual(contract.readShortcuts(overflowDevice.chrome.storage.sync.values,
    overflowDevice.chrome.storage.local.values[contract.OVERFLOW_KEY]).length, 60,
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
  assert.strictEqual(settings.createProviderStorageRuntime(saved.chrome).getActiveAreaName(), 'sync');
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
    [settings.SIMPLE_MODE_ENABLED_STORAGE_KEY]: true });
  assert.deepStrictEqual(contract.mergeStates(conflictBase, conflictLocal, conflictRemote, 'remote').state.data,
    { [theme]: 'system', [language]: 'ja', [customSearch]: engine('remote'), [settings.SIMPLE_MODE_ENABLED_STORAGE_KEY]: true },
    'choosing a conflict version preserves unrelated edits from both sides');
  const conflictServer = createServer();
  const conflictDevice = createDevice(conflictServer, { sync: conflictBase.data });
  await conflictDevice.controller.handle({ operation: 'connect', config });
  await set(conflictDevice.chrome.storage.sync, conflictLocal.data);
  conflictServer.replaceState(conflictRemote);
  assert.strictEqual((await conflictDevice.controller.handle({ operation: 'sync' })).conflict, true);
  assert.deepStrictEqual((await conflictDevice.controller.handle({ operation: 'conflictDetails' })).items, [
    { key: customSearch, domain: 'preference', local: { kind: 'list', count: 1 }, remote: { kind: 'list', count: 1 } }
  ], 'conflict details name only the conflicting list, not settings that resolved on their own');
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
  assert.strictEqual(conflictServer.state().data[settings.SIMPLE_MODE_ENABLED_STORAGE_KEY], true);

  const migrated = createDevice(createServer(), { sync: { [theme]: 'light' }, local: {
    [settings.LOCAL_PRIMARY_STORAGE_KEY]: true, [theme]: 'dark' } });
  await migrated.controller.mirrorChrome();
  assert.strictEqual(settings.createProviderStorageRuntime(migrated.chrome).getActiveAreaName(), 'sync');
  assert.strictEqual(migrated.chrome.storage.sync.values[theme], 'dark', 'an older local installation migrates without losing edits');
  const tooLarge = createDevice(createServer(), { sync: { [theme]: 'light' }, local: {
    [settings.LOCAL_PRIMARY_STORAGE_KEY]: true, [theme]: 'dark', [customSearch]: 'x'.repeat(120 * 1024) } });
  await assert.rejects(tooLarge.controller.mirrorChrome(), /chrome-capacity/);
  assert.strictEqual(tooLarge.chrome.storage.sync.values[theme], 'light', 'an oversized legacy migration cannot partially overwrite Chrome');
  assert.strictEqual(tooLarge.chrome.storage.local.values[customSearch].length, 120 * 1024);

  const autoServer = createServer();
  const auto = createDevice(autoServer, { sync: { [theme]: 'light' } });
  await auto.controller.handle({ operation: 'save', config });
  await auto.controller.handle({ operation: 'enable' });
  await set(auto.chrome.storage.sync, {
    [theme]: 'dark', [settings.SIMPLE_MODE_ENABLED_STORAGE_KEY]: true,
    [settings.AGGREGATE_SEARCH_STORAGE_KEY]: [{ id: 'research', name: 'Research', providers: ['gg', 'bd'] }],
    ['_x_extension_site_search_custom_2024_unique_']: [{ key: 'docs', name: 'Docs', template: 'https://example.com/?q={query}' }],
    ['_x_extension_search_blacklist_2026_unique_']: ['https://hidden.example/']
  });
  await new Promise((resolve) => setTimeout(resolve, 1750));
  assert.strictEqual(autoServer.state().data[theme], 'dark', 'Chrome changes trigger WebDAV without a manual sync');
  assert.strictEqual(autoServer.state().data[settings.SIMPLE_MODE_ENABLED_STORAGE_KEY], true);
  assert.strictEqual(autoServer.state().data[settings.AGGREGATE_SEARCH_STORAGE_KEY][0].id, 'research');
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
  const links = settings.NEWTAB_LINK_WALLPAPERS_STORAGE_KEY;
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

  const bigLinks = Array.from({ length: 40 }, (_, index) => ({ id: `link-big${index}xx`, url: `https://big.example/${'x'.repeat(200)}/${index}.jpg`, addedAt: index }));
  assert.throws(() => contract.mergeInitialWallpapers(empty({ [links]: bigLinks.slice(20) }), empty({ [links]: bigLinks.slice(0, 20) })),
    /merge-too-large/, 'a merge past the browser sync item limit fails instead of dropping links');

  console.log('WebDAV sync tests passed: parallel Chrome sync, media, merge, conflict, offline, quota, concurrent edits, restart recovery and integrity');
}
if (require.main === module) run().catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { createServer, createDevice, config, empty, set };
