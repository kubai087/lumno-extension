const assert = require('assert');
const fs = require('fs');

delete globalThis.LumnoOverlayLifecycle;
require('../src/overlay/lifecycle.js');

const lifecycle = globalThis.LumnoOverlayLifecycle;
const searchPanelSource = fs.readFileSync('src/overlay/search-panel.js', 'utf8');

function createHarness() {
  let nextTimerId = 1;
  const timers = new Map();
  const observers = [];
  const listeners = new Map();

  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.disconnected = false;
      this.observed = [];
      observers.push(this);
    }

    disconnect() {
      this.disconnected = true;
    }

    observe(target, options) {
      this.disconnected = false;
      this.observed.push({ target, options });
    }
  }

  function createNode(name) {
    return {
      name,
      isConnected: true,
      parentNode: null,
      children: [],
      appendChild(child) {
        if (child.parentNode && Array.isArray(child.parentNode.children)) {
          child.parentNode.children = child.parentNode.children.filter((item) => item !== child);
        }
        this.children.push(child);
        child.parentNode = this;
        child.isConnected = this.isConnected;
        return child;
      }
    };
  }

  const documentElement = createNode('html-initial');
  const doc = {
    body: null,
    documentElement,
    fullscreenElement: null
  };
  const win = {
    MutationObserver: FakeMutationObserver,
    document: doc,
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    removeEventListener(type, handler) {
      if (listeners.get(type) === handler) {
        listeners.delete(type);
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

  function detach(node) {
    if (node.parentNode && Array.isArray(node.parentNode.children)) {
      node.parentNode.children = node.parentNode.children.filter((item) => item !== node);
    }
    node.parentNode = null;
    node.isConnected = false;
  }

  function runTimer(delay) {
    const entry = Array.from(timers.entries()).find(([, timer]) => timer.delay === delay);
    assert.ok(entry, `expected a pending ${delay}ms timer`);
    timers.delete(entry[0]);
    entry[1].callback();
  }

  return {
    createNode,
    detach,
    doc,
    documentElement,
    listeners,
    observers,
    runTimer,
    timers,
    win
  };
}

assert.ok(
  lifecycle && typeof lifecycle.createMountConnectionGuard === 'function',
  'overlay lifecycle should expose a mount connection guard'
);

{
  const harness = createHarness();
  const host = harness.createNode('overlay-host');
  harness.documentElement.appendChild(host);
  let restoreCount = 0;
  const guard = lifecycle.createMountConnectionGuard(harness.win, {
    onRestore(restoredHost, parent) {
      restoreCount += 1;
      assert.strictEqual(restoredHost, host);
      assert.strictEqual(restoredHost.parentNode, parent);
    }
  });

  guard.start(host);
  assert.strictEqual(harness.observers.length, 2, 'guard should observe the Document and mount parent');
  const documentObserver = harness.observers[0];
  const parentObserver = harness.observers[1];
  assert.strictEqual(documentObserver.observed[0].target, harness.doc);
  assert.deepStrictEqual(documentObserver.observed[0].options, { childList: true });
  assert.strictEqual(parentObserver.observed[0].target, harness.documentElement);
  assert.deepStrictEqual(parentObserver.observed[0].options, { childList: true });

  harness.detach(host);
  parentObserver.callback([]);
  harness.runTimer(0);
  assert.strictEqual(host.parentNode, harness.documentElement, 'direct host removal should be repaired');
  assert.strictEqual(host.isConnected, true);
  assert.strictEqual(restoreCount, 1);

  const replacementRoot = harness.createNode('html-replacement');
  harness.documentElement.isConnected = false;
  harness.detach(host);
  harness.doc.documentElement = replacementRoot;
  documentObserver.callback([]);
  harness.runTimer(0);
  assert.strictEqual(host.parentNode, replacementRoot, 'Document root replacement should reuse the same host');
  assert.strictEqual(host.isConnected, true);
  assert.strictEqual(restoreCount, 2);

  guard.stop();
  harness.detach(host);
  parentObserver.callback([]);
  documentObserver.callback([]);
  assert.strictEqual(harness.timers.size, 0, 'intentional teardown must not reattach the host');
  assert.strictEqual(harness.listeners.has('fullscreenchange'), false);
}

assert.match(
  searchPanelSource,
  /createMountConnectionGuard\(window,[\s\S]*?_lumnoMountConnectionGuard = mountConnectionGuard;[\s\S]*?mountConnectionGuard\.start\(overlayHost\)/,
  'the Overlay should guard its real closed-shadow mount host'
);
assert.match(
  searchPanelSource,
  /const mountConnectionGuard = mountHost && mountHost\._lumnoMountConnectionGuard;[\s\S]*?mountConnectionGuard\.stop\(\);[\s\S]*?mountHost\.remove\(\);/,
  'intentional close should stop reconnection before removing the mount host'
);

console.log('overlay mount connection guard tests passed');
