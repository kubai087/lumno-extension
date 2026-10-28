const assert = require('assert');
const settingsStorage = require('../helpers/settings-storage.ts');
const { createOptionsPage } = require('../helpers/options-page');

async function run() {
  await testOptionsPageStartup();
  await testStartupReadPrefetch();
  console.log('Options startup performance tests passed');
}

// On the page: the startup reads go out together, the page marks itself
// ready once they are in, and the General tab is active.
async function testOptionsPageStartup() {
  const page = await createOptionsPage({});
  await page.waitFor(
    () => page.document.documentElement.getAttribute('data-lumno-options-ready') === 'true',
    'Options should mark itself ready'
  );
  const largestRead = Math.max(...page.storage.sync.reads.map((keys) => (Array.isArray(keys) ? keys.length : 1)));
  assert.ok(largestRead >= 30, `Options should batch same-task startup reads (largest read: ${largestRead} keys)`);
  const activeTab = page.document.querySelector('._x_extension_settings_tab_button_2024_unique_[data-active="true"]');
  assert.strictEqual(activeTab && activeTab.getAttribute('data-tab'), 'general', 'the General tab should be active after startup');
  page.close();
}

function createPrefetchHarness(values) {
  const reads = [];
  const listeners = new Set();
  const area = {
    get(keys, callback) {
      reads.push(keys);
      const selected = {};
      keys.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(values, key)) selected[key] = values[key];
      });
      Promise.resolve().then(() => callback(selected));
    }
  };
  const chromeApi = {
    storage: {
      onChanged: {
        addListener: (listener) => listeners.add(listener),
        removeListener: (listener) => listeners.delete(listener)
      }
    }
  };
  const change = (key, newValue) => {
    values[key] = newValue;
    listeners.forEach((listener) => listener({ [key]: { newValue } }, 'sync'));
  };
  return { area, chromeApi, reads, listeners, change };
}

async function testStartupReadPrefetch() {
  const covered = createPrefetchHarness({ alpha: 1, beta: 2 });
  assert.strictEqual(settingsStorage.prefetchStorageRead(covered.area, ['alpha', 'beta'], covered.chromeApi), true);
  const coveredResult = await settingsStorage.takePrefetchedRead(covered.area, ['alpha']);
  assert.deepStrictEqual(coveredResult, { alpha: 1, beta: 2 });
  assert.deepStrictEqual(covered.reads, [['alpha', 'beta']],
    'a read covered by the prefetch should take its result instead of reading again');
  assert.strictEqual(covered.listeners.size, 0, 'the prefetch should stop watching once taken');

  const stale = createPrefetchHarness({ alpha: 1 });
  settingsStorage.prefetchStorageRead(stale.area, ['alpha'], stale.chromeApi);
  stale.change('alpha', 5);
  const staleResult = await settingsStorage.takePrefetchedRead(stale.area, ['alpha']);
  assert.strictEqual(staleResult, null, 'a key that changed after the prefetch should be read again');

  const uncovered = createPrefetchHarness({ alpha: 1, gamma: 3 });
  settingsStorage.prefetchStorageRead(uncovered.area, ['alpha'], uncovered.chromeApi);
  const uncoveredResult = await settingsStorage.takePrefetchedRead(uncovered.area, ['alpha', 'gamma']);
  assert.strictEqual(uncoveredResult, null, 'a read asking for keys the prefetch lacks should read them all itself');
  assert.strictEqual(uncovered.listeners.size, 0);

  assert.strictEqual(settingsStorage.prefetchStorageRead(covered.area, ['alpha'], {}), false,
    'without change events a prefetch could serve stale values, so it should not start');
}

run().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
