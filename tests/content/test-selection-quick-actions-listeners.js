// Selection Quick Actions should only listen to the page while the feature is
// enabled: turning it off detaches every page listener and the ownership
// MutationObserver, while the storage listener stays so it can turn back on.
const assert = require('assert');
const { JSDOM } = require('jsdom');
const selectionIntent = require('../../src/shared/selection-intent.js');
const { bundleScript } = require('../helpers/module-script');
const { startSelectorEngine } = require('../helpers/trusted-events');

const ENABLED_KEY = '_x_extension_selection_quick_actions_enabled_2026_unique_';
const LANGUAGE_KEY = '_x_extension_language_2024_unique_';
const HOST_ID = '_x_extension_selection_quick_actions_host_2026_unique_';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function trackListeners(target, label, registry) {
  const add = target.addEventListener.bind(target);
  const remove = target.removeEventListener.bind(target);
  const keyOf = (type, options) => {
    const capture = typeof options === 'boolean' ? options : Boolean(options && options.capture);
    return `${label}:${type}:${capture ? 'capture' : 'bubble'}`;
  };
  target.addEventListener = (type, listener, options) => {
    const key = keyOf(type, options);
    registry.set(key, (registry.get(key) || 0) + 1);
    return add(type, listener, options);
  };
  target.removeEventListener = (type, listener, options) => {
    const key = keyOf(type, options);
    const count = (registry.get(key) || 0) - 1;
    if (count > 0) registry.set(key, count);
    else registry.delete(key);
    return remove(type, listener, options);
  };
}

(async () => {
  const dom = new JSDOM(`<!doctype html><html lang="en"><body>
    <p id="term">serendipity</p>
  </body></html>`, {
    pretendToBeVisual: true,
    runScripts: 'outside-only',
    url: 'https://example.com/article'
  });
  const { window } = dom;
  const { document } = window;
  window.LumnoSelectionIntent = selectionIntent;
  window.Range.prototype.getBoundingClientRect = function() {
    return { bottom: 44, height: 18, left: 20, right: 110, top: 26, width: 90 };
  };
  window.Range.prototype.getClientRects = function() {
    return [{ bottom: 44, height: 18, left: 20, right: 110, top: 26, width: 90 }];
  };
  window.HTMLElement.prototype.getBoundingClientRect = function() {
    return { bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0 };
  };
  window.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  window.matchMedia = () => ({ matches: false });

  let surfaceShadow = null;
  const attachShadow = window.Element.prototype.attachShadow;
  window.Element.prototype.attachShadow = function(options) {
    const root = attachShadow.call(this, { ...options, mode: 'open' });
    if (this.id === HOST_ID) surfaceShadow = root;
    return root;
  };

  let activeObservers = 0;
  const NativeMutationObserver = window.MutationObserver;
  window.MutationObserver = class extends NativeMutationObserver {
    observe(...args) {
      if (!this.counted) {
        this.counted = true;
        activeObservers += 1;
      }
      return super.observe(...args);
    }
    disconnect() {
      if (this.counted) {
        this.counted = false;
        activeObservers -= 1;
      }
      return super.disconnect();
    }
  };

  const visualViewport = new window.EventTarget();
  Object.assign(visualViewport, { height: 768, offsetLeft: 0, offsetTop: 0, width: 1024 });
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport });

  const storageListeners = [];
  const syncValues = { [ENABLED_KEY]: false };
  window.chrome = {
    i18n: { getMessage() { return ''; }, getUILanguage() { return 'en'; } },
    runtime: {
      id: 'test-extension',
      getURL(path) { return `chrome-extension://lumno/${path}`; },
      lastError: null,
      sendMessage(_message, callback) { if (callback) callback({ ok: true }); }
    },
    storage: {
      local: { get(_keys, callback) { callback({}); } },
      sync: { get(_keys, callback) { callback({ ...syncValues }); } },
      onChanged: { addListener(listener) { storageListeners.push(listener); } }
    }
  };

  // Let jsdom finish loading, then track only what the content script registers.
  if (document.readyState !== 'complete') {
    await new Promise((resolve) => window.addEventListener('load', resolve, { once: true }));
  }
  const pageListeners = new Map();
  startSelectorEngine(window);
  trackListeners(document, 'document', pageListeners);
  trackListeners(window, 'window', pageListeners);
  trackListeners(visualViewport, 'visualViewport', pageListeners);
  window.eval(bundleScript('selection-quick-actions'));
  await wait(10);

  function setEnabled(value) {
    syncValues[ENABLED_KEY] = value;
    storageListeners.forEach((listener) => listener({
      [ENABLED_KEY]: { oldValue: !value, newValue: value }
    }, 'sync'));
  }

  const expectedListeners = [
    'document:pointerup:capture',
    'document:pointerdown:capture',
    'document:pointercancel:capture',
    'document:selectstart:capture',
    'document:selectionchange:capture',
    'document:copy:capture',
    'document:scroll:capture',
    'document:keydown:capture',
    'window:blur:capture',
    'window:resize:capture',
    'window:orientationchange:capture',
    'visualViewport:resize:bubble',
    'visualViewport:scroll:bubble'
  ].sort();
  const activeListenerKeys = () => Array.from(pageListeners.keys()).sort();

  assert.deepStrictEqual(activeListenerKeys(), [],
    'a disabled feature should not listen to the page at all');
  assert.strictEqual(activeObservers, 0, 'a disabled feature should not observe the page DOM');
  assert(storageListeners.length > 0, 'the storage listener should exist so the feature can be enabled');
  setEnabled('true');
  assert.deepStrictEqual(activeListenerKeys(), [], 'only an explicit true should turn the feature on');

  setEnabled(true);
  assert.deepStrictEqual(activeListenerKeys(), expectedListeners,
    'enabling the feature should attach each page listener once');
  assert(Array.from(pageListeners.values()).every((count) => count === 1));
  assert.strictEqual(activeObservers, 1, 'enabling the feature should start ownership monitoring');

  const term = document.getElementById('term');
  const selection = window.getSelection();
  async function selectTerm() {
    selection.removeAllRanges();
    term.dispatchEvent(new window.MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 20, clientY: 30 }));
    const range = document.createRange();
    range.selectNodeContents(term);
    selection.addRange(range);
    term.dispatchEvent(new window.MouseEvent('pointerup', { bubbles: true, button: 0, clientX: 100, clientY: 30 }));
    await wait(460);
    return document.getElementById(HOST_ID);
  }

  let host = await selectTerm();
  assert(host && host.hidden === false, 'an enabled feature should show the entry for a selection');
  document.dispatchEvent(new window.Event('scroll'));
  assert.strictEqual(host.hidden, true, 'scrolling the page should dismiss the entry');

  host = await selectTerm();
  assert.strictEqual(host.hidden, false);
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.strictEqual(host.hidden, true, 'Escape should dismiss the entry');

  host = await selectTerm();
  assert.strictEqual(host.hidden, false);
  const surface = surfaceShadow.querySelector('.lumno-selection-surface');
  visualViewport.width = 300;
  visualViewport.dispatchEvent(new window.Event('resize'));
  await wait(30);
  assert.strictEqual(surface.style.maxWidth, '276px',
    'a visual viewport resize should re-clamp the toolbar to the 12px safe area');

  storageListeners.forEach((listener) => listener({
    [LANGUAGE_KEY]: { oldValue: 'system', newValue: 'en' }
  }, 'sync'));
  await wait(10);
  assert(Array.from(pageListeners.values()).every((count) => count === 1),
    'rehydrating an enabled feature should not attach duplicate listeners');
  assert.strictEqual(activeObservers, 1);

  setEnabled(false);
  assert.deepStrictEqual(activeListenerKeys(), [],
    'disabling the feature should detach every page listener');
  assert.strictEqual(activeObservers, 0, 'disabling the feature should stop ownership monitoring');
  assert.strictEqual(document.getElementById(HOST_ID), null);
  assert.strictEqual(await selectTerm(), null, 'a disabled feature should ignore selections');

  setEnabled(true);
  assert.deepStrictEqual(activeListenerKeys(), expectedListeners,
    'the storage listener should be able to turn the feature back on');
  host = await selectTerm();
  assert(host && host.hidden === false, 'a re-enabled feature should show the entry again');

  dom.window.close();
  console.log('selection quick actions listener lifecycle tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
