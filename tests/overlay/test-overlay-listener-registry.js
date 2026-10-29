const assert = require('assert');

const LumnoOverlayLifecycle = require('../../src/overlay/dom/lifecycle.ts');

const lifecycle = LumnoOverlayLifecycle;
const activeListeners = new Set();
const eventTarget = {
  addListener(listener) {
    activeListeners.add(listener);
  },
  removeListener(listener) {
    activeListeners.delete(listener);
  }
};
const registry = lifecycle.createChromeEventListenerRegistry(eventTarget);
const first = () => {};
const second = () => {};

assert.strictEqual(registry.add(first), first);
assert.strictEqual(registry.add(first), first);
assert.strictEqual(registry.add(second), second);
assert.strictEqual(registry.add(null), null);
assert.strictEqual(registry.size, 2);
assert.strictEqual(activeListeners.size, 2);
assert.strictEqual(registry.remove(first), true);
assert.strictEqual(registry.remove(first), false);
assert.strictEqual(registry.size, 1);
assert.strictEqual(activeListeners.has(first), false);
registry.clear();
assert.strictEqual(registry.size, 0);
assert.strictEqual(activeListeners.size, 0);

const unavailableRegistry = lifecycle.createChromeEventListenerRegistry(null);
assert.strictEqual(unavailableRegistry.add(first), null);
assert.strictEqual(unavailableRegistry.size, 0);

// That an overlay session's storage listeners all go away when it closes is
// covered against the real overlay by test-overlay-session-teardown.js.

console.log('overlay listener registry tests passed');
