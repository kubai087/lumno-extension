(function(root, factory) {
  const api = factory(root);
  root.LumnoWebDavSync = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
  'use strict';
  const DB_NAME = 'lumno-webdav-private';
  const ALARM_NAME = 'lumno-webdav-sync';
  const SYNC_REVISION = 'dav-multi-1';
  const PROBE_CACHE_MS = 10 * 60 * 1000;
  // Below the 30 s idle limit of Firefox event pages and Chrome service workers.
  const KEEP_ALIVE_INTERVAL_MS = 20 * 1000;
  const CHROME_SYNC_META_KEY = '_x_extension_sync_meta_2024_unique_';
  // Synced connection hints stay far below chrome.storage.sync's 8 KB item quota.
  const MAX_HINTS = 10;
  const MAX_HINT_BYTES = 600;
  // Contract failures in this device's own data; capture reports them as
  // local-<code> so the settings card never blames the remote copy.
  const LOCAL_DATA_CODES = ['invalid-state', 'state-too-large', 'invalid-shortcuts', 'invalid-icon', 'invalid-wallpaper',
    'invalid-asset', 'asset-too-large'];
  function isTrustedSender(chromeApi, sender) {
    const page = String(sender && sender.url || '').split(/[?#]/)[0];
    return Boolean(sender && sender.id === chromeApi.runtime.id && page === chromeApi.runtime.getURL('src/options/options.html'));
  }
  function createPrivateStore(indexedDB) {
    async function open() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore('entries');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error('private-storage-unavailable'));
      });
    }
    async function operation(method, key, value) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('entries', method === 'get' ? 'readonly' : 'readwrite');
        const store = tx.objectStore('entries');
        const request = method === 'get' ? store.get(key) : method === 'delete' ? store.delete(key) : store.put(value, key);
        let result;
        request.onsuccess = () => { result = request.result; };
        tx.oncomplete = () => { db.close(); resolve(result); };
        tx.onerror = tx.onabort = () => { db.close(); reject(new Error('private-storage-unavailable')); };
      });
    }
    return { get: (key) => operation('get', key), put: (key, value) => operation('put', key, value),
      delete: (key) => operation('delete', key) };
  }
  // Capabilities from an explicit test are reused briefly by the following
  // enable, so testing and then saving does not repeat the destructive probe.
  function createProbeCache(now) {
    const entries = new Map();
    const clock = now || Date.now;
    const keyOf = (revision, config) => [revision, config.endpoint, config.directory, config.username, config.password].join('\n');
    return {
      get(revision, config) {
        const entry = entries.get(keyOf(revision, config));
        if (!entry || clock() - entry.at > PROBE_CACHE_MS) return null;
        return entry.capabilities;
      },
      set(revision, config, capabilities) {
        entries.set(keyOf(revision, config), { at: clock(), capabilities });
      }
    };
  }
  function createConnectionController(options) {
    const opts = options || {};
    const chromeApi = opts.chrome || root.chrome;
    const settings = opts.settings || root.LumnoSettings;
    const contract = opts.contract || root.LumnoWebDavContract;
    const shortcuts = opts.shortcuts || root.LumnoNewtabShortcutsStore;
    const clientApi = opts.client || root.LumnoWebDavClient;
    const cryptoApi = opts.crypto || root.crypto;
    const privateStore = opts.privateStore || createPrivateStore(root.indexedDB);
    const wallpaperStore = opts.wallpaperStore || root.LumnoNewtabWallpaperLocalStore.createWallpaperLocalStore({
      windowObj: root, onChange() {}
    });
    const localPrefsArea = chromeApi.storage.local;
    const chromeFallbackArea = chromeApi.storage.sync;
    const runtime = settings.createProviderStorageRuntime(chromeApi);
    const statusKey = opts.statusKey || settings.WEBDAV_STATUS_STORAGE_KEY;
    const alarmName = opts.alarmName || ALARM_NAME;
    const withLocalWrite = opts.withLocalWrite || ((fn) => fn());
    const probeCache = opts.probeCache || createProbeCache();
    const keepAliveIntervalMs = opts.keepAliveIntervalMs || KEEP_ALIVE_INTERVAL_MS;
    let chain = Promise.resolve();
    let activeJobs = 0;
    let keepAliveTimer = null;
    let generation = 0;
    let timer = null;
    let started = false;
    let stopped = false;
    // Two browsers on one account, even on the same computer, routinely meet
    // at the write lock or commit between each other's read and write. Merge
    // again after a short, jittered wait before calling it a failure. A lock
    // that outlasts every retry is reported: an uncertain write may own it.
    const CONTENTION_CODES = ['remote-locked', 'remote-changed'];
    const contentionDelays = opts.contentionDelays || [3000, 10000, 30000];
    let contention = 0;
    const fail = (code) => { throw clientApi.error(code); };
    const watchedKeys = [...settings.CHROME_SYNC_STORAGE_KEYS, contract.ICONS_KEY, ...contract.LOCAL_PREFERENCE_KEYS,
      contract.OVERFLOW_KEY, settings.ASSET_REVISION_STORAGE_KEY];
    function storage(area, method, value) {
      return new Promise((resolve, reject) => {
        if (!area) { resolve(method === 'get' ? {} : undefined); return; }
        let finished = false;
        const done = (result) => {
          if (finished) return;
          finished = true;
          const lastError = chromeApi.runtime && chromeApi.runtime.lastError;
          if (lastError) reject(new Error('local-storage-failed')); else resolve(result);
        };
        try {
          const pending = area[method](value, done);
          if (pending && typeof pending.then === 'function') pending.then(done).catch(reject);
        } catch (error) { reject(error); }
      });
    }
    async function setStatus(update) {
      const old = await storage(localPrefsArea, 'get', [statusKey]);
      const status = { ...(old[statusKey] || {}), ...update };
      await storage(localPrefsArea, 'set', { [statusKey]: status });
      return status;
    }
    // Firefox unloads an idle event page even while its requests are pending
    // (verified: a 60 s fetch never resolves), which strands the shared write
    // lock mid-sync until someone deletes it by hand. An extension API call
    // resets the idle timer in Firefox and Chrome, so tick one while jobs run.
    function holdKeepAlive() {
      activeJobs += 1;
      if (keepAliveTimer || !chromeApi.runtime || typeof chromeApi.runtime.getPlatformInfo !== 'function') return;
      keepAliveTimer = setInterval(() => {
        try {
          const pending = chromeApi.runtime.getPlatformInfo();
          if (pending && typeof pending.catch === 'function') pending.catch(() => {});
        } catch (_cause) {
          // A failed tick only loses this keep-alive beat.
        }
      }, keepAliveIntervalMs);
    }
    function releaseKeepAlive() {
      activeJobs = Math.max(0, activeJobs - 1);
      if (!activeJobs && keepAliveTimer) {
        clearInterval(keepAliveTimer);
        keepAliveTimer = null;
      }
    }
    function exclusive(fn) {
      holdKeepAlive();
      const job = chain.then(fn);
      chain = job.catch(() => {});
      job.then(releaseKeepAlive, releaseKeepAlive);
      return job;
    }
    async function session() { return await privateStore.get('session') || { config: null, base: null }; }
    async function saveConfig(config) { await privateStore.put('session', { ...await session(), config }); }
    async function hash(bytes) {
      const digest = await cryptoApi.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    }
    function decodeImage(dataUrl, mime, maximum) {
      if (!String(dataUrl).startsWith(`data:${mime};base64,`)) fail('invalid-asset');
      let bytes;
      try { bytes = Uint8Array.from(root.atob(dataUrl.slice(dataUrl.indexOf(',') + 1)), (character) => character.charCodeAt(0)); }
      catch (_error) { fail('invalid-asset'); }
      if (!bytes.byteLength || bytes.byteLength > maximum) fail('asset-too-large');
      return { bytes, ...checkImage(bytes, mime) };
    }
    function checkImage(bytes, mime) {
      const header = Array.from(bytes.slice(0, 12));
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      let width = 0;
      let height = 0;
      if (mime === 'image/png') {
        if (![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => header[index] === byte)) fail('invalid-asset');
        if (bytes.length < 33 || view.getUint32(8) !== 13 || String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR') fail('invalid-asset');
        width = view.getUint32(16);
        height = view.getUint32(20);
      } else {
        if (String.fromCharCode(...header.slice(0, 4)) !== 'RIFF' || String.fromCharCode(...header.slice(8, 12)) !== 'WEBP' ||
            bytes.length < 30 || view.getUint32(4, true) + 8 !== bytes.length) fail('invalid-asset');
        const format = String.fromCharCode(...bytes.slice(12, 16));
        if (format === 'VP8X') {
          width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
          height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
          if (bytes[20] & 2) fail('invalid-asset'); // Uploaded wallpapers are still images.
        } else if (format === 'VP8L' && bytes[20] === 47) {
          const dimensions = view.getUint32(21, true);
          width = 1 + (dimensions & 16383);
          height = 1 + ((dimensions >>> 14) & 16383);
        } else if (format === 'VP8 ' && bytes[23] === 157 && bytes[24] === 1 && bytes[25] === 42) {
          width = view.getUint16(26, true) & 16383;
          height = view.getUint16(28, true) & 16383;
        } else fail('invalid-asset');
      }
      if (!width || !height || width > 8192 || height > 8192 || width * height > 40000000) fail('invalid-asset');
      return { width, height };
    }
    function toDataUrl(bytes, mime) {
      const chunks = [];
      for (let offset = 0; offset < bytes.length; offset += 8192) chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
      return `data:${mime};base64,${root.btoa(chunks.join(''))}`;
    }
    function pickLocalPreferences(values) {
      return Object.fromEntries(contract.LOCAL_PREFERENCE_KEYS
        .filter((key) => Object.prototype.hasOwnProperty.call(values, key)).map((key) => [key, values[key]]));
    }
    function assetPath(hashValue, mime) { return `assets/${hashValue}.${mime === 'image/png' ? 'png' : 'webp'}`; }
    function capture(recovering = false) {
      return withLocalWrite(async () => {
        if (!recovering && opts.hasPendingApply && await opts.hasPendingApply()) fail('interrupted-apply');
        return captureInternal();
      });
    }
    async function captureInternal() {
      await runtime.ready;
      const capturedGeneration = generation;
      const local = await storage(localPrefsArea, 'get', watchedKeys);
      const values = runtime.isActiveAreaName('local') ? local : await storage(chromeFallbackArea, 'get', settings.CHROME_SYNC_STORAGE_KEYS);
      const list = contract.readShortcuts(values, runtime.isActiveAreaName('sync') ? local[contract.OVERFLOW_KEY] : null);
      const regular = list.filter((item) => item.type !== 'folder' || item.folderRef);
      const ids = new Set(regular.map((item) => item.id));
      const state = { version: regular.some((item) => item.type === 'folder') || (await session()).base?.version === 2 ? 2 : 1,
        data: contract.selectPreferences({ ...values, ...pickLocalPreferences(local) }),
        shortcuts: regular, icons: {}, wallpapers: [], assets: {} };
      // This device's own data failing the contract must not read as a bad
      // remote copy, so its codes carry a local- prefix.
      try {
        const { validated, records } = await collectMedia(state, local, ids);
        if (capturedGeneration !== generation) fail('local-changed');
        return { state: validated, values, local, records, folders: list.filter((item) => item.type === 'folder' && !item.folderRef),
          shortcutOrder: list.map((item) => item.id), generation: capturedGeneration };
      } catch (cause) {
        if (LOCAL_DATA_CODES.includes(cause.code)) fail(`local-${cause.code}`);
        throw cause;
      }
    }
    async function collectMedia(state, local, ids) {
      async function addAsset(dataUrl, mime, maximum) {
        const { bytes, width, height } = decodeImage(dataUrl, mime, maximum);
        const digest = await hash(bytes);
        state.assets[digest] = { mime, size: bytes.byteLength };
        // Binary cache and credentials live in extension-origin IndexedDB,
        // never in content-script-accessible chrome.storage.local.
        if (!await privateStore.get(`asset:${digest}`)) await privateStore.put(`asset:${digest}`, bytes);
        return { digest, width, height };
      }
      for (const [id, dataUrl] of Object.entries(local[contract.ICONS_KEY] || {})) {
        if (ids.has(id)) state.icons[id] = (await addAsset(dataUrl, 'image/png', 96 * 1024)).digest;
      }
      const records = await wallpaperStore.readAll();
      for (const record of records) {
        // Wallpapers saved before dimensions were recorded read back as 0x0,
        // so the size comes from the image itself.
        const image = await addAsset(record.imageDataUrl, 'image/webp', contract.MAX_ASSET_BYTES);
        const thumbnail = await addAsset(record.thumbnailDataUrl, 'image/webp', 160 * 1024);
        state.wallpapers.push({ id: record.id, name: record.name, width: image.width, height: image.height,
          updatedAt: record.updatedAt, image: image.digest, thumbnail: thumbnail.digest });
      }
      return { validated: contract.validateState(state), records };
    }
    async function getAsset(digest, asset, client) {
      let bytes = await privateStore.get(`asset:${digest}`);
      if (!bytes) {
        if (!client) fail('asset-missing');
        const response = await client.request(assetPath(digest, asset.mime), 'GET', undefined, {}, asset.size);
        if (response.status !== 200) fail('asset-missing');
        bytes = response.bytes;
      }
      if (bytes.byteLength !== asset.size || await hash(bytes) !== digest) fail('asset-integrity');
      checkImage(bytes, asset.mime);
      await privateStore.put(`asset:${digest}`, bytes);
      return bytes;
    }
    async function uploadAssets(state, client, knownAssets) {
      for (const [digest, asset] of Object.entries(state.assets)) {
        if (knownAssets && contract.equal(knownAssets[digest], asset)) continue;
        const bytes = await getAsset(digest, asset, client);
        const existing = await client.request(assetPath(digest, asset.mime), 'HEAD', undefined, {}, 65536);
        if (existing.status === 200) {
          const downloaded = await client.request(assetPath(digest, asset.mime), 'GET', undefined, {}, asset.size);
          if (downloaded.status !== 200 || downloaded.bytes.byteLength !== asset.size || await hash(downloaded.bytes) !== digest) fail('asset-integrity');
          continue;
        }
        if (existing.status !== 404) fail('asset-missing');
        const written = await client.request(assetPath(digest, asset.mime), 'PUT', bytes,
          { 'If-None-Match': '*', 'Content-Type': asset.mime }, 65536);
        if (![200, 201, 204, 412].includes(written.status)) fail('write-failed');
        if (written.status === 412) {
          const raced = await client.request(assetPath(digest, asset.mime), 'GET', undefined, {}, asset.size);
          if (raced.status !== 200 || raced.bytes.byteLength !== asset.size || await hash(raced.bytes) !== digest) fail('asset-integrity');
        }
      }
    }
    function preferencePayload(state, captured) {
      const list = [...state.shortcuts];
      for (const folder of captured.folders) {
        const index = (captured.shortcutOrder || []).indexOf(folder.id);
        list.splice(index < 0 ? list.length : Math.min(index, list.length), 0, folder);
      }
      if (list.length > 60) fail('shortcut-capacity');
      if (new Set(list.map((item) => item.id)).size !== list.length) fail('shortcut-id-conflict');
      const plan = shortcuts.createShortcutStoragePlan(list);
      return { ...state.data, ...plan.payload, [contract.OVERFLOW_KEY]: { authoritative: false, items: plan.overflowItems } };
    }
    async function prepareChrome(state, captured) {
      const payload = preferencePayload(state, captured);
      const existing = await storage(chromeFallbackArea || localPrefsArea, 'get', null);
      const synced = Object.fromEntries(settings.CHROME_SYNC_STORAGE_KEYS.filter((key) =>
        Object.prototype.hasOwnProperty.call(payload, key)).map((key) => [key, payload[key]]));
      const remove = settings.CHROME_SYNC_STORAGE_KEYS.filter((key) =>
        Object.prototype.hasOwnProperty.call(existing, key) && !Object.prototype.hasOwnProperty.call(synced, key));
      const projected = { ...existing, ...synced };
      remove.forEach((key) => delete projected[key]);
      const entries = Object.entries(projected);
      const size = (key, value) => contract.byteLength(key) + contract.byteLength(JSON.stringify(value));
      if (chromeFallbackArea && (entries.length > (chromeFallbackArea.MAX_ITEMS || 512) ||
          entries.some(([key, value]) => size(key, value) > (chromeFallbackArea.QUOTA_BYTES_PER_ITEM || 8192)) ||
          entries.reduce((sum, [key, value]) => sum + size(key, value), 0) > (chromeFallbackArea.QUOTA_BYTES || 102400))) fail('chrome-capacity');
      return { payload, synced, remove };
    }
    async function apply(state, captured, client, activate, nextSession) {
      const { payload, synced, remove } = await prepareChrome(state, captured);
      const icons = {};
      const folderIds = new Set(captured.folders.map((item) => item.id));
      Object.entries(captured.local[contract.ICONS_KEY] || {}).forEach(([id, data]) => { if (folderIds.has(id)) icons[id] = data; });
      for (const [id, digest] of Object.entries(state.icons)) icons[id] = toDataUrl(await getAsset(digest, state.assets[digest], client), 'image/png');
      const wallpapers = [];
      for (const wallpaper of state.wallpapers) {
        const image = await getAsset(wallpaper.image, state.assets[wallpaper.image], client);
        const thumbnail = await getAsset(wallpaper.thumbnail, state.assets[wallpaper.thumbnail], client);
        wallpapers.push({ id: wallpaper.id, key: wallpaper.id, name: wallpaper.name, width: wallpaper.width,
          height: wallpaper.height, updatedAt: wallpaper.updatedAt, imageDataUrl: toDataUrl(image, 'image/webp'),
          thumbnailDataUrl: toDataUrl(thumbnail, 'image/webp') });
      }
      return withLocalWrite(async () => {
        if (captured.generation !== generation) fail('local-changed');
        const removed = contract.LOCAL_PREFERENCE_KEYS.filter((key) =>
          Object.prototype.hasOwnProperty.call(captured.local, key) && !Object.prototype.hasOwnProperty.call(state.data, key));
        // Stage the complete operation before changing either local store. Chrome
        // may terminate the worker between the media transaction and preferences.
        await privateStore.put('pendingApply', { state, captured, activate, nextSession });
        await wallpaperStore.replaceAll(wallpapers);
        if (captured.generation !== generation) fail('local-changed');
        if (remove.length) await storage(chromeFallbackArea || localPrefsArea, 'remove', remove);
        await storage(chromeFallbackArea || localPrefsArea, 'set', synced);
        if (removed.length) await storage(localPrefsArea, 'remove', removed);
        await storage(localPrefsArea, 'set', {
          ...pickLocalPreferences(payload),
          [contract.OVERFLOW_KEY]: payload[contract.OVERFLOW_KEY], [contract.ICONS_KEY]: icons,
          [settings.ASSET_REVISION_STORAGE_KEY]: cryptoApi.randomUUID(),
          ...(runtime.isActiveAreaName('local') && chromeFallbackArea ? { [settings.LOCAL_PRIMARY_STORAGE_KEY]: false } : {}) });
        // Credentials and the merge baseline belong to the same server and must
        // commit atomically; separate records could pair a new server with an old base.
        await privateStore.put('session', nextSession);
        await privateStore.put('pendingApply', null);
        await privateStore.put('recoveryBlocked', false);
      });
    }
    async function recoverPendingApply() {
      const pending = await privateStore.get('pendingApply');
      if (!pending) return;
      const captured = await capture(true);
      if (contract.equal(captured.state, pending.state) && (!chromeFallbackArea || runtime.isActiveAreaName('sync'))) {
        await privateStore.put('session', pending.nextSession);
        await privateStore.put('recoveryBlocked', false);
        await setStatus({ state: pending.nextSession.config && pending.nextSession.config.enabled ? 'ready' : 'paused', error: null });
      } else {
        // Preserve edits made after the interruption. A partial application is
        // never uploaded automatically; its complete previous copy is recoverable.
        await privateStore.put('replacementBackup', { captured: pending.captured, savedAt: Date.now() });
        await privateStore.put('replacementBackupMeta', { savedAt: Date.now() });
        await privateStore.put('session', { config: pending.nextSession.config ? { ...pending.nextSession.config, enabled: false } : null, base: null });
        await privateStore.put('recoveryBlocked', true);
        await setStatus({ state: 'error', enabled: false, error: 'interrupted-apply' });
      }
      await privateStore.put('pendingApply', null);
    }
    function mirrorChrome() { return withLocalWrite(mirrorChromeInternal); }
    async function mirrorChromeInternal() {
      if (!chromeFallbackArea || !runtime.isActiveAreaName('local')) return { complete: false, skipped: [] };
      const values = await storage(localPrefsArea, 'get', settings.CHROME_SYNC_STORAGE_KEYS);
      const existing = await storage(chromeFallbackArea, 'get', null);
      const plan = contract.planChromeBackup(values, existing, { quota: chromeFallbackArea.QUOTA_BYTES,
        itemQuota: chromeFallbackArea.QUOTA_BYTES_PER_ITEM, maxItems: chromeFallbackArea.MAX_ITEMS });
      // Only migrate an older local-primary installation when its full
      // preferences fit. Never replace Chrome with a partial WebDAV backup.
      if (!plan.complete) fail('chrome-capacity');
      try {
        if (plan.remove.length) await storage(chromeFallbackArea, 'remove', plan.remove);
        if (Object.keys(plan.payload).length) await storage(chromeFallbackArea, 'set', plan.payload);
        await storage(localPrefsArea, 'set', { [settings.LOCAL_PRIMARY_STORAGE_KEY]: false });
        await setStatus({ chromeBackup: 'complete', chromeSkipped: 0 });
      } catch (_error) {
        await setStatus({ chromeBackup: 'failed' });
        throw clientApi.error('chrome-capacity');
      }
      return plan;
    }
    async function readRemote(client) {
      const remote = await client.readState();
      return remote && { state: contract.validateState(remote.state), etag: remote.etag };
    }
    async function publish(state, remote, client, capturedGeneration) {
      if (capturedGeneration !== generation) fail('local-changed');
      await uploadAssets(state, client, remote && remote.state.assets);
      if (remote) {
        const archived = await client.request(`snapshots/${cryptoApi.randomUUID()}.json`, 'PUT', JSON.stringify(remote.state),
          { 'If-None-Match': '*', 'Content-Type': 'application/json' });
        if (![200, 201, 204].includes(archived.status)) fail('write-failed');
      }
      if (capturedGeneration !== generation) fail('local-changed');
      await client.writeState(state, remote && remote.etag);
      const verified = await readRemote(client);
      if (!verified || !contract.equal(state, verified.state)) fail('remote-changed');
      return verified;
    }
    // Answers to the first-join choice: keep one side, or merge wallpapers onto the server's copy.
    const INITIAL_DECISIONS = ['local', 'remote', 'merge'];
    async function syncInternal(decision) {
      const { config, base } = await session();
      if (!config || !config.enabled) return { paused: true };
      await setStatus({ state: 'syncing', error: null });
      const client = await verifiedClient(config);
      await saveConfig(config);
      const captured = await capture(INITIAL_DECISIONS.includes(decision));
      const remote = await readRemote(client);
      if (INITIAL_DECISIONS.includes(decision)) {
        await privateStore.put('replacementBackup', { captured, savedAt: Date.now() });
        await privateStore.put('replacementBackupMeta', { savedAt: Date.now() });
      }
      let target;
      if (decision === 'merge') {
        if (!remote) fail('remote-missing');
        target = contract.mergeInitialWallpapers(captured.state, remote.state);
      } else if (base && remote && ['local', 'remote'].includes(decision)) target = contract.mergeStates(base, captured.state, remote.state, decision).state;
      else if (decision === 'local') target = captured.state;
      else if (decision === 'remote') {
        if (!remote) fail('remote-missing');
        target = remote.state;
      } else if (!remote) {
        if (base) fail('remote-missing');
        target = captured.state;
      } else if (!base) {
        await setStatus({ state: 'choice', conflicts: [], error: null });
        return { needsChoice: true };
      } else {
        const merged = contract.mergeStates(base, captured.state, remote.state);
        if (merged.conflicts.length) {
          await privateStore.put('conflict', { local: captured.state, remote: remote.state, keys: merged.conflicts });
          await setStatus({ state: 'conflict', conflicts: merged.conflicts, error: null });
          return { conflict: true };
        }
        target = merged.state;
      }
      await prepareChrome(target, captured);
      if (!remote || !contract.equal(target, remote.state)) await publish(target, remote, client, captured.generation);
      if (!contract.equal(target, captured.state)) await apply(target, captured, client, false, { config, base: target });
      else if (captured.generation !== generation) fail('local-changed');
      else await privateStore.put('session', { config, base: target });
      if (decision) await privateStore.put('recoveryBlocked', false);
      await privateStore.put('conflict', null);
      await setStatus({ state: 'ready', error: null, diagnostic: null, conflicts: [], lastSyncAt: Date.now() });
      await mirrorChrome();
      return { ok: true };
    }
    async function guardedSync(decision) {
      try {
        await recoverPendingApply();
        const result = await syncInternal(decision);
        contention = 0;
        return result;
      } catch (cause) {
        // A first-join choice is retried by the user, who is still on the page.
        if (!decision && CONTENTION_CODES.includes(cause.code) && contention < contentionDelays.length && !stopped) {
          const delay = contentionDelays[contention] * (0.75 + Math.random() * 0.5);
          contention += 1;
          await setStatus({ state: 'pending', error: null, diagnostic: null });
          queueSync(delay, { keepAlive: true });
          return { pending: true };
        }
        contention = 0;
        const diagnostic = clientApi.diagnostic(cause.diagnostic);
        await setStatus({ state: cause.code === 'local-changed' ? 'pending' : cause.code === 'remote-missing' ? 'choice' : 'error',
          error: cause.code || 'sync-failed', diagnostic });
        throw Object.assign(clientApi.error(cause.code || 'sync-failed'), { diagnostic });
      }
    }
    async function connection(input) {
      const { config: previous } = await session();
      const candidate = clientApi.normalizeConfig({ ...input, password: input.password || (previous && previous.password) || 'placeholder' });
      if (!input.password && (!previous || candidate.endpoint !== previous.endpoint || candidate.username !== previous.username)) fail('missing-credentials');
      if (previous && previous.clientRevision === clientApi.REVISION &&
          ['endpoint', 'directory', 'username', 'password'].every((key) => candidate[key] === previous[key])) {
        candidate.concurrency = previous.concurrency;
        candidate.lockStrategy = previous.lockStrategy;
        candidate.clientRevision = previous.clientRevision;
      }
      return candidate;
    }
    async function verifiedClient(config) {
      const client = clientApi.createClient(config, opts.clientOptions);
      if (config.clientRevision !== clientApi.REVISION) {
        const capabilities = probeCache.get(clientApi.REVISION, config) || await client.testConnection();
        config.concurrency = capabilities.concurrency;
        config.lockStrategy = capabilities.lockStrategy;
        config.clientRevision = clientApi.REVISION;
      }
      return client;
    }
    async function connect(input, decision) {
      const config = await connection(input);
      const client = await verifiedClient(config);
      const { config: previous, base } = await session();
      if (previous && ['endpoint', 'directory', 'username', 'password'].every((key) => config[key] === previous[key])) {
        // Persist only capabilities belonging to this exact saved connection.
        // Repeated toggles and worker restarts don't rerun destructive probes.
        await saveConfig({ ...config, enabled: previous.enabled });
      }
      const remote = await readRemote(client);
      if (!decision && previous && config.endpoint === previous.endpoint && config.directory === previous.directory &&
          config.username === previous.username && base) {
        await saveConfig({ ...config, enabled: true });
        await setStatus({ enabled: true });
        schedule();
        return guardedSync();
      }
      if (remote && !INITIAL_DECISIONS.includes(decision)) {
        await setStatus({ state: 'choice', conflicts: [], error: null });
        return { needsChoice: true };
      }
      const captured = await capture(INITIAL_DECISIONS.includes(decision));
      await privateStore.put('migrationBackup', { captured, savedAt: Date.now() });
      await privateStore.put('migrationBackupMeta', { savedAt: Date.now() });
      const target = remote && decision === 'remote' ? remote.state
        : remote && decision === 'merge' ? contract.mergeInitialWallpapers(captured.state, remote.state)
          : captured.state;
      await prepareChrome(target, captured);
      if (!remote || decision === 'local' || !contract.equal(target, remote.state)) {
        await publish(target, remote, client, captured.generation);
      }
      if (opts.managed && contract.equal(target, captured.state) && runtime.isActiveAreaName('sync')) {
        if (captured.generation !== generation) fail('local-changed');
        await privateStore.put('session', { config: { ...config, enabled: true }, base: target });
        await privateStore.put('recoveryBlocked', false);
      } else await apply(target, captured, client, true, { config: { ...config, enabled: true }, base: target });
      await privateStore.put('conflict', null);
      await setStatus({ state: 'ready', enabled: true, error: null, diagnostic: null, conflicts: [], lastSyncAt: Date.now() });
      await mirrorChrome();
      schedule();
      return { ok: true };
    }
    // A failed enable keeps the connection paused but leaves its reason on the
    // card, instead of a transient message that disappears on refresh.
    async function connectReporting(input, decision) {
      try { return await connect(input, decision); }
      catch (cause) {
        const diagnostic = clientApi.diagnostic(cause.diagnostic);
        if (cause.code !== 'local-changed') await setStatus({ error: cause.code || 'sync-failed', diagnostic }).catch(() => {});
        throw cause.code ? Object.assign(clientApi.error(cause.code), { diagnostic }) : cause;
      }
    }
    async function pause() {
      const { config } = await session();
      if (config) await saveConfig({ ...config, enabled: false });
      await setStatus({ state: 'paused', enabled: false, error: null, diagnostic: null });
      if (timer) { clearTimeout(timer); timer = null; }
      if (chromeApi.alarms && typeof chromeApi.alarms.clear === 'function') await chromeApi.alarms.clear(alarmName);
      return { ok: true };
    }
    async function useBrowserSync() {
      await runtime.ready;
      if (!runtime.isActiveAreaName('local')) return pause();
      const capturedGeneration = generation;
      const plan = await mirrorChrome();
      if (!plan.complete) fail('chrome-capacity');
      await pause();
      if (capturedGeneration !== generation) fail('local-changed');
      await storage(localPrefsArea, 'set', { [settings.LOCAL_PRIMARY_STORAGE_KEY]: false });
      await setStatus({ state: 'browser', chromeBackup: 'complete' });
      return { ok: true };
    }
    async function status() {
      await runtime.ready;
      const { config } = await session();
      const values = await storage(localPrefsArea, 'get', [statusKey]);
      return { ...(values[statusKey] || { state: 'browser' }),
        clientRevision: clientApi.REVISION,
        syncRevision: SYNC_REVISION,
        localPrimary: runtime.isActiveAreaName('local'), enabled: Boolean(config && config.enabled),
        config: config ? { endpoint: config.endpoint, directory: config.directory, username: config.username,
          concurrency: config.concurrency || 'conditional', hasPassword: true } : null,
        hasMigrationBackup: Boolean(await privateStore.get('replacementBackupMeta') || await privateStore.get('migrationBackupMeta')),
        needsRecovery: Boolean(await privateStore.get('recoveryBlocked')) };
    }
    function schedule() {
      if (!chromeApi.alarms || typeof chromeApi.alarms.create !== 'function') return;
      // Persistent recurring checks also recover an interrupted task even if
      // its last onChanged event never reached the short debounce timer.
      if (stopped) return;
      const pending = chromeApi.alarms.create(alarmName, { delayInMinutes: 1, periodInMinutes: 5 });
      if (pending && pending.catch) pending.catch(() => {});
    }
    function onStorageChanged(changes, areaName) {
        if (stopped) return;
        if ((areaName === 'local' || (areaName === 'sync' && !runtime.isActiveAreaName('local'))) &&
            watchedKeys.some((key) => changes[key])) generation += 1;
        if (!((areaName === 'sync' && !runtime.isActiveAreaName('local')) || areaName === 'local') ||
            !(watchedKeys.some((key) => changes[key]) || (areaName === 'sync' && changes[CHROME_SYNC_META_KEY]))) return;
        queueSync(1500);
    }
    let timerKeepsAlive = false;
    function queueSync(delay, queueOptions) {
      if (timer) {
        clearTimeout(timer);
        if (timerKeepsAlive) releaseKeepAlive();
      }
      // A contention retry waits up to ~30 s, longer than Firefox keeps an
      // idle event page; without this the retry would be lost until the alarm.
      timerKeepsAlive = Boolean(queueOptions && queueOptions.keepAlive);
      if (timerKeepsAlive) holdKeepAlive();
      timer = setTimeout(() => {
        timer = null;
        exclusive(async () => { if (!stopped) { await mirrorChrome(); await guardedSync(); } }).catch(() => {});
        // exclusive() took its own hold above, so the page stays alive throughout.
        if (timerKeepsAlive) {
          timerKeepsAlive = false;
          releaseKeepAlive();
        }
      }, delay);
      if (timer && typeof timer.unref === 'function') timer.unref();
    }
    function onAlarm(alarm) {
      if (!stopped && alarm.name === alarmName) exclusive(async () => { if (!stopped) { await mirrorChrome(); await guardedSync(); } }).catch(() => {});
    }
    function start() {
      if (started || stopped) return;
      started = true;
      chromeApi.storage.onChanged.addListener(onStorageChanged);
      if (chromeApi.alarms && chromeApi.alarms.onAlarm) chromeApi.alarms.onAlarm.addListener(onAlarm);
      if (opts.managed) return;
      runtime.ready.then(async () => {
        const { config } = await session();
        if ((config && config.enabled) || runtime.isActiveAreaName('local') || await privateStore.get('pendingApply')) {
          if (config && config.enabled) schedule();
          await exclusive(async () => { await recoverPendingApply(); await mirrorChrome(); await guardedSync(); });
        }
      }).catch(() => {});
    }
    function stop() {
      return exclusive(async () => {
        await pause();
        stopped = true;
        if (chromeApi.storage.onChanged.removeListener) chromeApi.storage.onChanged.removeListener(onStorageChanged);
        if (chromeApi.alarms && chromeApi.alarms.onAlarm.removeListener) chromeApi.alarms.onAlarm.removeListener(onAlarm);
      });
    }
    async function handle(request) {
      await runtime.ready;
      await recoverPendingApply();
      switch (request.operation) {
        case 'recover': return { ok: true };
        case 'schedule': schedule(); return { ok: true };
        case 'status': return status();
        case 'save': {
          const config = await connection(request.config);
          const previous = await session();
          // Saving an unchanged form must not interrupt a running connection.
          if (previous.config && ['endpoint', 'directory', 'username', 'password'].every((key) => previous.config[key] === config[key])) {
            return { ok: true, unchanged: true };
          }
          const wasEnabled = Boolean(previous.config && previous.config.enabled);
          const sameServer = previous.config && ['endpoint', 'directory', 'username'].every((key) => previous.config[key] === config[key]);
          await privateStore.put('session', { config: { ...config, enabled: false }, base: sameServer ? previous.base : null });
          await pause();
          await setStatus({ conflicts: [], ...(!sameServer ? { lastSyncAt: null } : {}) });
          if (wasEnabled && request.resume === true) return { ...await connectReporting((await session()).config), resumed: true };
          return { ok: true };
        }
        case 'test': {
          const config = await connection(request.config);
          const capabilities = await clientApi.createClient(config, opts.clientOptions).testConnection();
          probeCache.set(clientApi.REVISION, config, { concurrency: capabilities.concurrency, lockStrategy: capabilities.lockStrategy });
          return capabilities;
        }
        case 'enable': {
          const { config } = await session();
          if (!config) fail('missing-credentials');
          return connectReporting(config, request.decision);
        }
        case 'connect': return connectReporting(request.config, request.decision);
        case 'conflictDetails': {
          const conflict = await privateStore.get('conflict');
          const { base } = await session();
          if (!conflict || !base) return { items: [] };
          return { items: contract.describeConflict(base, conflict.local, conflict.remote, conflict.keys) };
        }
        case 'sync': return guardedSync(request.decision);
        case 'pause': return pause();
        case 'browser': return useBrowserSync();
        case 'restoreBackup': {
          const backup = await privateStore.get('replacementBackup') || await privateStore.get('migrationBackup');
          if (!backup) fail('backup-missing');
          const captured = await capture(true);
          const { config, base } = await session();
          await apply(backup.captured.state, captured, config ? clientApi.createClient(config, opts.clientOptions) : null, true,
            { config: config ? { ...config, enabled: false } : null, base });
          await setStatus({ state: 'paused', enabled: false, error: null });
          await mirrorChrome();
          return { ok: true };
        }
        default: fail('unknown-operation');
      }
    }
    return Object.freeze({ start, stop, status, capture, mirrorChrome,
      handle: (request) => exclusive(() => { if (stopped) fail('connection-missing'); return handle(request); }) });
  }
  function createController(options) {
    const opts = options || {};
    const chromeApi = opts.chrome || root.chrome;
    const settings = opts.settings || root.LumnoSettings;
    const cryptoApi = opts.crypto || root.crypto;
    const store = opts.privateStore || createPrivateStore(root.indexedDB);
    const wallpaperStore = opts.wallpaperStore || root.LumnoNewtabWallpaperLocalStore.createWallpaperLocalStore({ windowObj: root, onChange() {} });
    const workers = new Map();
    const probeCache = opts.probeCache || createProbeCache();
    const recordKeys = ['session', 'pendingApply', 'recoveryBlocked', 'conflict', 'replacementBackup', 'replacementBackupMeta', 'migrationBackup', 'migrationBackupMeta'];
    let ids = [];
    let registryChain = Promise.resolve();
    let hintChain = Promise.resolve();
    let localChain = Promise.resolve();
    let started = false;
    const clientApi = opts.client || root.LumnoWebDavClient;
    const fail = (code) => { throw clientApi.error(code); };
    const keyFor = (id, key) => id === 'default' || key.startsWith('asset:') ? key : `connection:${id}:${key}`;
    const statusKeyFor = (id) => id === 'default' ? settings.WEBDAV_STATUS_STORAGE_KEY : `${settings.WEBDAV_STATUS_STORAGE_KEY}:${id}`;
    function serialRegistry(fn) {
      const job = registryChain.then(fn);
      registryChain = job.catch(() => {});
      return job;
    }
    function serialHints(fn) {
      const job = hintChain.then(fn);
      hintChain = job.catch(() => {});
      return job;
    }
    function withLocalWrite(fn) {
      const job = localChain.then(fn);
      localChain = job.catch(() => {});
      return job;
    }
    function localStorage(method, value) {
      return new Promise((resolve, reject) => chromeApi.storage.local[method](value, (result) => {
        if (chromeApi.runtime.lastError) reject(new Error('local-storage-failed')); else resolve(result);
      }));
    }
    async function notifyRegistry() {
      await localStorage('set', { [`${settings.WEBDAV_STATUS_STORAGE_KEY}:connections`]: cryptoApi.randomUUID() });
    }
    // Every device publishes the address, directory and username of its
    // connections through browser sync, so a new device only asks for the app
    // password. The password itself never leaves the device that holds it.
    const sameConnection = (left, right) => ['endpoint', 'directory', 'username'].every((key) => left[key] === right[key]);
    function connectionHints(value) {
      const hints = [];
      for (const item of value && value.version === 1 && Array.isArray(value.items) ? value.items : []) {
        let config;
        try { config = clientApi.normalizeConfig({ ...item, password: 'placeholder' }); } catch (_error) { continue; }
        const hint = { endpoint: config.endpoint, directory: config.directory, username: config.username };
        if (JSON.stringify(hint).length <= MAX_HINT_BYTES && !hints.some((existing) => sameConnection(existing, hint))) hints.push(hint);
      }
      return hints.slice(-MAX_HINTS);
    }
    function syncStorage(method, value) {
      return new Promise((resolve, reject) => {
        if (!chromeApi.storage.sync) { resolve({}); return; }
        chromeApi.storage.sync[method](value, (result) => {
          if (chromeApi.runtime.lastError) reject(new Error('sync-storage-failed')); else resolve(result || {});
        });
      });
    }
    // Hints are a convenience: failing to publish one never fails the
    // connection change that triggered it.
    function publishHints(removed, added) {
      return serialHints(async () => {
        const key = settings.WEBDAV_CONNECTIONS_SYNC_STORAGE_KEY;
        const current = connectionHints((await syncStorage('get', [key]))[key]);
        const next = connectionHints({ version: 1, items: [
          ...current.filter((item) => !removed.some((config) => config && sameConnection(config, item))),
          ...added.filter(Boolean)] });
        if (JSON.stringify(next) !== JSON.stringify(current)) await syncStorage('set', { [key]: { version: 1, items: next } });
      }).catch(() => {});
    }
    async function configOf(id) {
      const { config } = await worker(id).status();
      return config ? { endpoint: config.endpoint, directory: config.directory, username: config.username } : null;
    }
    function worker(id) {
      if (!workers.has(id)) {
        const scopedStore = { get: (key) => store.get(keyFor(id, key)), put: (key, value) => store.put(keyFor(id, key), value) };
        const controller = createConnectionController({ ...opts, chrome: chromeApi, settings, privateStore: scopedStore,
          wallpaperStore, probeCache, statusKey: statusKeyFor(id), alarmName: id === 'default' ? ALARM_NAME : `${ALARM_NAME}:${id}`,
          managed: true, withLocalWrite,
          hasPendingApply: async () => {
            for (const connectionId of workers.keys()) if (await store.get(keyFor(connectionId, 'pendingApply')) ||
              await store.get(keyFor(connectionId, 'recoveryBlocked'))) return true;
            return false;
          } });
        workers.set(id, controller);
        controller.start();
      }
      return workers.get(id);
    }
    const ready = (async () => {
      const saved = await store.get('connections');
      if (Array.isArray(saved)) ids = [...new Set(saved.filter((id) => typeof id === 'string' && /^(default|[\w-]{1,80})$/.test(id)))];
      else {
        // Keep the existing credential, baseline and backups together in place.
        if ((await store.get('session'))?.config) ids = ['default'];
        await store.put('connections', ids);
      }
      ids.forEach(worker);
      // Recover every interrupted local application before any server can upload.
      for (const id of ids) {
        await worker(id).handle({ operation: 'recover' });
        const current = await worker(id).status();
        if (!current.enabled && current.error === 'interrupted-apply' && current.hasMigrationBackup) await store.put(keyFor(id, 'recoveryBlocked'), true);
      }
      // Connections added before hints existed reach other devices too.
      await publishHints([], await Promise.all(ids.map(configOf)));
    })();
    // Two connections to the same account and directory would sync one remote
    // with two independent baselines and treat each other's writes as changes.
    async function assertUnique(input, exceptId) {
      let candidate;
      try { candidate = clientApi.normalizeConfig({ ...input, password: input && input.password || 'placeholder' }); }
      catch (_error) { return; }
      for (const id of ids) {
        if (id === exceptId) continue;
        const { config } = await worker(id).status();
        if (config && ['endpoint', 'directory', 'username'].every((key) => config[key] === candidate[key])) fail('duplicate-connection');
      }
    }
    async function discard(id) {
      await worker(id).stop();
      workers.delete(id);
      for (const key of recordKeys) {
        if (store.delete) await store.delete(keyFor(id, key)); else await store.put(keyFor(id, key), null);
      }
      await localStorage('remove', [statusKeyFor(id)]);
    }
    async function hasLocalHistory(id) {
      for (const key of ['migrationBackup', 'pendingApply', 'recoveryBlocked']) if (await store.get(keyFor(id, key))) return true;
      return false;
    }
    async function status() {
      await ready;
      const connections = (await Promise.all(ids.map(async (id) => ({ id, ...await worker(id).status() })))).filter((item) => item.config);
      return { ...(connections[0] || { state: 'browser', enabled: false, config: null }),
        clientRevision: clientApi.REVISION, syncRevision: SYNC_REVISION, connections, suggestions: await suggestions(connections) };
    }
    // Synced connections this device has neither added nor dismissed.
    async function suggestions(connections) {
      const syncKey = settings.WEBDAV_CONNECTIONS_SYNC_STORAGE_KEY;
      const dismissedKey = settings.WEBDAV_DISMISSED_CONNECTIONS_STORAGE_KEY;
      let hints = [];
      let dismissed = [];
      try {
        hints = connectionHints((await syncStorage('get', [syncKey]))[syncKey]);
        dismissed = connectionHints((await localStorage('get', [dismissedKey]))[dismissedKey]);
      } catch (_error) { return []; }
      return hints.filter((hint) => ![...connections.map((item) => item.config), ...dismissed].some((config) => sameConnection(config, hint)));
    }
    async function dismissSuggestion(input) {
      const key = settings.WEBDAV_DISMISSED_CONNECTIONS_STORAGE_KEY;
      const [hint] = connectionHints({ version: 1, items: [input] });
      if (!hint) fail('connection-missing');
      const current = connectionHints((await localStorage('get', [key]))[key]);
      await localStorage('set', { [key]: { version: 1, items: connectionHints({ version: 1, items: [...current, hint] }) } });
      return { ok: true };
    }
    function start() {
      if (started) return;
      started = true;
      // Another device withdrawing a connection this one still uses puts it
      // back at once, so a new device never misses it in the meantime.
      chromeApi.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'sync' || !changes[settings.WEBDAV_CONNECTIONS_SYNC_STORAGE_KEY]) return;
        ready.then(async () => publishHints([], await Promise.all(ids.map(configOf)))).catch(() => {});
      });
      ready.then(() => Promise.all(ids.map(async (id) => {
        const current = await worker(id).status();
        if (current.enabled) {
          await worker(id).handle({ operation: 'schedule' });
          await worker(id).handle({ operation: 'sync' });
        }
      }))).catch(() => {});
    }
    async function handle(request) {
      await ready;
      if (request.operation === 'status') return status();
      if (request.operation === 'dismissSuggestion') return dismissSuggestion(request.config);
      if (request.operation === 'add' || (request.operation === 'test' && !request.id)) {
        return serialRegistry(async () => {
          if (request.operation === 'add') await assertUnique(request.config);
          const id = cryptoApi.randomUUID();
          const controller = worker(id);
          let retained = false;
          const retain = async () => {
            const nextIds = [...ids, id];
            await store.put('connections', nextIds);
            ids = nextIds;
            retained = true;
            await notifyRegistry();
          };
          try {
            let result = await controller.handle({ ...request, operation: request.operation === 'add' ? 'save' : 'test' });
            if (request.operation === 'add' && request.enable === true) {
              // The card appears only once the server is verified, so a typo
              // stays in the form instead of becoming a broken connection.
              try { result = await controller.handle({ operation: 'enable' }); }
              catch (cause) {
                if (await hasLocalHistory(id)) await retain();
                throw cause;
              }
            }
            if (request.operation === 'add') {
              await retain();
              await publishHints([], [await configOf(id)]);
            }
            return { ...result, id };
          } finally {
            if (!retained) await discard(id);
          }
        });
      }
      const id = request.id || (ids.length === 1 ? ids[0] : null);
      if (!id || !ids.includes(id)) fail('connection-missing');
      if (request.operation === 'save') {
        await assertUnique(request.config, id);
        const before = await configOf(id);
        const result = await worker(id).handle(request);
        await publishHints([before], [await configOf(id)]);
        return result;
      }
      if (request.operation === 'remove') {
        return serialRegistry(async () => {
          if (!ids.includes(id)) fail('connection-missing');
          await worker(id).handle({ operation: 'recover' });
          if (await store.get(keyFor(id, 'recoveryBlocked'))) fail('interrupted-apply');
          const removed = await configOf(id);
          await worker(id).stop();
          const nextIds = ids.filter((value) => value !== id);
          // Remove the index first: a restart cannot revive this connection.
          await store.put('connections', nextIds);
          ids = nextIds;
          await discard(id);
          await notifyRegistry();
          await publishHints([removed], []);
          return { ok: true };
        });
      }
      return worker(id).handle(request);
    }
    return Object.freeze({ start, status, handle });
  }
  return Object.freeze({ createController, createConnectionController, createPrivateStore, createProbeCache, isTrustedSender, ALARM_NAME, SYNC_REVISION });
});
