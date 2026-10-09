const assert = require('assert');
const fs = require('fs');
const path = require('path');
const settings = require('../src/shared/settings.js');

const repoRoot = path.resolve(__dirname, '..');
const optionsSource = fs.readFileSync(path.join(repoRoot, 'src/options/options.js'), 'utf8');

async function run() {
  const values = {
    alpha: 1,
    beta: 2,
    gamma: 3
  };
  const readRequests = [];
  const writes = [];
  const rawArea = {
    get(keys, callback) {
      readRequests.push(keys);
      const selected = {};
      if (keys === null) {
        Object.assign(selected, values);
      } else {
        keys.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(values, key)) {
            selected[key] = values[key];
          }
        });
      }
      Promise.resolve().then(() => callback(selected));
    },
    set(payload, callback) {
      writes.push(payload);
      Object.assign(values, payload);
      if (callback) callback();
    }
  };

  const batch = settings.createStorageReadBatch(rawArea);
  assert(batch, 'a readable storage area should create a startup read batch');

  const callbackResults = [];
  batch.area.get(['alpha'], (result) => callbackResults.push(result.alpha));
  batch.area.get(['beta'], (result) => callbackResults.push(result.beta));
  const selectedPromise = batch.area.get({ gamma: 0, missing: 9 });
  batch.area.set({ delta: 4 });

  const [metrics, selected] = await Promise.all([batch.ready, selectedPromise]);
  assert.deepStrictEqual(callbackResults, [1, 2]);
  assert.deepStrictEqual(selected, { gamma: 3, missing: 9 });
  assert.deepStrictEqual(readRequests, [['alpha', 'beta', 'gamma', 'missing']]);
  assert.deepStrictEqual(writes, [{ delta: 4 }], 'writes should not wait for the read batch');
  assert.deepStrictEqual(metrics, {
    keys: ['alpha', 'beta', 'gamma', 'missing'],
    keyCount: 4,
    requestCount: 3,
    underlyingReadCount: 1
  });

  batch.area.get(['alpha'], () => {});
  assert.strictEqual(
    readRequests.length,
    2,
    'reads after the startup boundary should pass through normally'
  );

  assert(
    optionsSource.includes('SETTINGS.createStorageReadBatch(rawStorageArea)') &&
      optionsSource.includes('startupStorageReadBatch.ready.then(finishOptionsStartupStorageBatch);'),
    'Options should batch same-task startup reads and expose a ready boundary'
  );
  assert(
    optionsSource.includes('(optionsStartupStorageBatchPending || optionsStartupRefreshCoalescing)') &&
      optionsSource.includes("'data-lumno-options-control-refreshes'"),
    'Options should coalesce repeated startup control refreshes'
  );
  assert(
    optionsSource.includes("let currentActiveSettingsTab = 'general';"),
    'Options runtime should agree with the statically active General tab'
  );

  await testStartupReadPrefetch();
  console.log('Options startup performance tests passed');
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
  assert.strictEqual(settings.prefetchStorageRead(covered.area, ['alpha', 'beta'], covered.chromeApi), true);
  const coveredBatch = settings.createStorageReadBatch(covered.area);
  const coveredResult = await coveredBatch.area.get(['alpha']);
  assert.deepStrictEqual(coveredResult, { alpha: 1 });
  assert.deepStrictEqual(covered.reads, [['alpha', 'beta']],
    'a batch covered by the prefetch should take its result instead of reading again');
  assert.strictEqual(covered.listeners.size, 0, 'the prefetch should stop watching once taken');

  const stale = createPrefetchHarness({ alpha: 1 });
  settings.prefetchStorageRead(stale.area, ['alpha'], stale.chromeApi);
  stale.change('alpha', 5);
  const staleResult = await settings.createStorageReadBatch(stale.area).area.get(['alpha']);
  assert.deepStrictEqual(staleResult, { alpha: 5 }, 'a key that changed after the prefetch should be read again');
  assert.strictEqual(stale.reads.length, 2);

  const uncovered = createPrefetchHarness({ alpha: 1, gamma: 3 });
  settings.prefetchStorageRead(uncovered.area, ['alpha'], uncovered.chromeApi);
  const uncoveredResult = await settings.createStorageReadBatch(uncovered.area).area.get(['alpha', 'gamma']);
  assert.deepStrictEqual(uncoveredResult, { alpha: 1, gamma: 3 });
  assert.deepStrictEqual(uncovered.reads, [['alpha'], ['alpha', 'gamma']],
    'a batch asking for keys the prefetch lacks should read them all itself');
  assert.strictEqual(uncovered.listeners.size, 0);

  assert.strictEqual(settings.prefetchStorageRead(covered.area, ['alpha'], {}), false,
    'without change events a prefetch could serve stale values, so it should not start');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
