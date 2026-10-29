const assert = require('assert');
const { JSDOM } = require('jsdom');

// The New Tab's settings area: which storage changes are its own, and
// moving preferences an older version kept locally into browser sync.

const SYNCED_KEY = '_x_extension_theme_mode_2024_unique_';
const OTHER_KEY = '_x_extension_language_2024_unique_';

function createArea(initial) {
  const data = { ...initial };
  return {
    data,
    get(keys, callback) {
      const list = keys === null ? Object.keys(data) : (Array.isArray(keys) ? keys : [keys]);
      const result = {};
      list.forEach((key) => {
        if (key in data) result[key] = data[key];
      });
      callback(result);
    },
    set(items, callback) {
      Object.assign(data, items);
      if (callback) callback();
    },
    remove(keys, callback) {
      (Array.isArray(keys) ? keys : [keys]).forEach((key) => delete data[key]);
      if (callback) callback();
    }
  };
}

async function loadStartupStorage(localData, syncData) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'chrome-extension://lumno/newtab.html' });
  const local = createArea(localData);
  const sync = createArea(syncData);
  global.window = dom.window;
  global.document = dom.window.document;
  global.chrome = {
    runtime: { lastError: null },
    storage: { local, sync, onChanged: { addListener() {} } }
  };
  // Each case gets fresh module state (the provider runtime is cached per chrome object).
  Object.keys(require.cache).forEach((key) => {
    if (key.includes('/src/')) delete require.cache[key];
  });
  const startupStorage = require('../../src/newtab/app/startup-storage.ts');
  const storage = startupStorage.createStartupStorage();
  await storage.providerStorageRuntime.ready;
  return { storage, local, sync };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

(async () => {
  const settings = require('../../src/domain/settings/index.ts');
  {
    const { storage, sync } = await loadStartupStorage(
      { [SYNCED_KEY]: 'dark', [OTHER_KEY]: 'ja' },
      { [OTHER_KEY]: 'en' }
    );
    assert.strictEqual(storage.isPrimaryStorageAreaName('sync'), true);
    assert.strictEqual(storage.isPrimaryStorageAreaName('local'), false);
    storage.migrateLocalSettingsIfNeeded([SYNCED_KEY, OTHER_KEY]);
    await flush();
    await flush();
    assert.strictEqual(sync.data[SYNCED_KEY], 'dark', 'a preference missing from sync moves there');
    assert.strictEqual(sync.data[OTHER_KEY], 'en', 'one sync already holds keeps its synced value');
  }
  {
    const { storage, sync } = await loadStartupStorage(
      { [settings.localPrimary.key]: true, [SYNCED_KEY]: 'dark' },
      {}
    );
    assert.strictEqual(storage.isPrimaryStorageAreaName('local'), true, 'settings kept on this device live locally');
    storage.migrateLocalSettingsIfNeeded([SYNCED_KEY]);
    await flush();
    await flush();
    assert.ok(!(SYNCED_KEY in sync.data), 'nothing moves to sync when settings stay on this device');
  }
  console.log('newtab startup storage tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
