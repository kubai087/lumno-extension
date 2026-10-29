const assert = require('assert');

const LumnoOverlayLifecycle = require('../../src/overlay/dom/lifecycle.ts');

const lifecycle = LumnoOverlayLifecycle;

function createHarness() {
  let nextTimerId = 1;
  const timers = new Map();
  const observers = [];
  const warnings = [];

  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.disconnectCount = 0;
      this.observeCount = 0;
      observers.push(this);
    }

    disconnect() {
      this.disconnectCount += 1;
    }

    observe() {
      this.observeCount += 1;
    }
  }

  const win = {
    MutationObserver: FakeMutationObserver,
    Node: {
      ELEMENT_NODE: 1
    },
    console: {
      warn(...args) {
        warnings.push(args);
      }
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    setTimeout(callback, delay) {
      const id = nextTimerId;
      nextTimerId += 1;
      timers.set(id, { callback, delay });
      return id;
    }
  };
  const root = {
    isConnected: true,
    nodeType: 1,
    querySelectorAll() {
      return [];
    }
  };

  function runTimerWithDelay(delay) {
    const entry = Array.from(timers.entries()).find(([, timer]) => timer.delay === delay);
    assert.ok(entry, `expected a pending ${delay}ms timer`);
    timers.delete(entry[0]);
    entry[1].callback();
  }

  return {
    observers,
    root,
    runTimerWithDelay,
    timers,
    warnings,
    win
  };
}

assert.ok(
  lifecycle && typeof lifecycle.createAntiTranslateGuard === 'function',
  'overlay lifecycle should expose the anti-translate guard'
);

{
  const harness = createHarness();
  const guard = lifecycle.createAntiTranslateGuard(harness.win);
  guard.start(harness.root);
  const observer = harness.observers[0];

  assert.strictEqual(observer.observeCount, 1, 'guard should observe the overlay root');
  guard.pauseForMutationBurst();
  const firstTimerId = Array.from(harness.timers.keys())[0];
  assert.strictEqual(
    Array.from(harness.timers.values())[0].delay,
    180,
    'owned mutation bursts should briefly pause observation'
  );

  guard.pauseForMutationBurst();
  assert.ok(
    !harness.timers.has(firstTimerId),
    'a repeated mutation burst should replace the pending resume timer'
  );
  assert.strictEqual(harness.timers.size, 1, 'only the renewed pause timer should remain');

  harness.runTimerWithDelay(180);
  assert.strictEqual(
    observer.observeCount,
    2,
    'guard should resume after the latest mutation burst settles'
  );
}

{
  let deepApplyCount = 0;
  const harness = createHarness();
  const guard = lifecycle.createAntiTranslateGuard(harness.win, {
    applyNoTranslateDeep() {
      deepApplyCount += 1;
    }
  });
  guard.start(harness.root);
  const observer = harness.observers[0];
  const mutation = {
    target: harness.root,
    addedNodes: []
  };

  observer.callback(Array.from({ length: 121 }, () => mutation));
  assert.strictEqual(harness.warnings.length, 1, 'excess external churn should still trigger backoff');
  assert.strictEqual(
    Array.from(harness.timers.values())[0].delay,
    900,
    'backoff should retain its longer recovery window'
  );

  guard.pauseForMutationBurst();
  assert.strictEqual(
    Array.from(harness.timers.values())[0].delay,
    900,
    'a transient pause must not replace an active backoff timer'
  );
  assert.strictEqual(harness.timers.size, 1, 'backoff should remain the only pending recovery');

  harness.runTimerWithDelay(900);
  assert.strictEqual(deepApplyCount, 1, 'backoff recovery should restore translation protection');
  assert.strictEqual(observer.observeCount, 2, 'guard should observe again after backoff recovery');
}

console.log('overlay anti-translate guard tests passed');
