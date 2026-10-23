const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { bundleScript } = require('./module-script');
const { getInjectedFiles } = require('./runtime-scripts');
const { recordAllListeners, startSelectorEngine, trackListeners } = require('./trusted-events');
const { trackPageTimers } = require('./page-timers');

// Loads the unmodified production overlay injection bundle (the same file
// list background.js injects) into a JSDOM page with a fake chrome API, so
// tests can drive the real toggle helper end to end.

const repoRoot = path.resolve(__dirname, '../..');
const injectionFiles = getInjectedFiles('overlay');
const HOST_ID = '_x_extension_overlay_host_2026_unique_';
const CONTEXT_TOKEN_KEY = '__lumnoOverlayContextToken2026';

async function waitFor(condition, message, errors) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    assert.deepStrictEqual(errors, [], 'the full overlay runtime must not throw');
    if (condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(message);
}

// The page created last; the exported settle() waits on its timers.
let activeTimers = null;

function settle(ms) {
  return activeTimers
    ? activeTimers.settle(ms || 30)
    : new Promise((resolve) => setTimeout(resolve, ms || 30));
}

function createListenerLedger(window) {
  const active = new Map();
  function keyFor(label, type, listener, options) {
    const capture = typeof options === 'boolean'
      ? options
      : Boolean(options && options.capture);
    return { label, type, listener, capture };
  }
  function find(entry) {
    for (const [id, existing] of active) {
      if (existing.label === entry.label && existing.type === entry.type &&
          existing.listener === entry.listener && existing.capture === entry.capture) {
        return id;
      }
    }
    return null;
  }
  let nextId = 1;
  startSelectorEngine(window);
  function track(target, label) {
    const originalAdd = target.addEventListener;
    const originalRemove = target.removeEventListener;
    target.addEventListener = function(type, listener, options) {
      const entry = keyFor(label, type, listener, options);
      if (listener && find(entry) === null) {
        active.set(nextId++, entry);
      }
      return originalAdd.call(this, type, listener, options);
    };
    target.removeEventListener = function(type, listener, options) {
      const id = find(keyFor(label, type, listener, options));
      if (id !== null) {
        active.delete(id);
      }
      return originalRemove.call(this, type, listener, options);
    };
  }
  track(window, 'window');
  track(window.document, 'document');
  // React attaches one selectionchange listener per document the first time
  // a root mounts and keeps it for the document's lifetime; it is not owned by
  // an overlay session.
  const isDocumentLifetimeListener = (entry) =>
    entry.label === 'document' && entry.type === 'selectionchange';
  return {
    snapshot() {
      return Array.from(active.values()).filter((entry) => !isDocumentLifetimeListener(entry)).map((entry) => `${entry.label}:${entry.type}${entry.capture ? ':capture' : ''}`).sort();
    },
    size() {
      return this.snapshot().length;
    }
  };
}

function createChromeEvent() {
  const listeners = new Set();
  return {
    listeners,
    addListener(listener) { listeners.add(listener); },
    removeListener(listener) { listeners.delete(listener); },
    hasListener(listener) { return listeners.has(listener); }
  };
}

// options:
//   url, html       the host page
//   userAgent       navigator.userAgent of the page
//   settings        stored settings, merged over the harness defaults
//   respond         (message) => response for chrome.runtime.sendMessage;
//                   return undefined to fall back to the default answers
//   darkSystem      whether prefers-color-scheme: dark matches
//   setup           (window) => void, run before the overlay is injected
//   storageDelayMs  how long chrome.storage reads take to answer
//   storageGate     (keys) => promise or null; a read waits for the promise
//   recordAnimations  provide and record element.animate()
//   stylesheetsLoad whether the overlay's stylesheets fire load (JSDOM never
//                   fetches them, so by default they stay pending)
async function createOverlayPage(options) {
  const config = options || {};
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => errors.push(error.message));
  // LUMNO_TEST_CONSOLE=1 shows the page's console while debugging a test.
  if (process.env.LUMNO_TEST_CONSOLE) {
    virtualConsole.forwardTo(console, { jsdomErrors: 'none' });
  }
  const dom = new JSDOM(config.html || '<!doctype html><html><head></head><body><p>Host page</p></body></html>', {
    url: config.url || 'https://page.example.test/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole
  });
  const { window } = dom;
  const timers = trackPageTimers(window);
  activeTimers = timers;
  if (config.userAgent) {
    Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: config.userAgent });
  }
  const settings = Object.assign({
    _x_extension_language_2024_unique_: 'en',
    _x_extension_motion_effects_enabled_2026_unique_: false,
    _x_extension_overlay_open_tabs_default_visible_2026_unique_: false
  }, config.settings || {});
  const messages = [];
  const storageReads = [];
  const storageWrites = [];
  const createStorageArea = (name, values) => ({
    get(keys, callback) {
      const read = typeof keys === 'string' ? [keys] : (Array.isArray(keys) ? keys.slice() : Object.keys(keys || {}));
      read.area = name;
      storageReads.push(read);
      const requestedKeys = typeof keys === 'string'
        ? [keys]
        : (Array.isArray(keys) ? keys : Object.keys(keys || values));
      const result = {};
      requestedKeys.forEach((key) => {
        if (Object.hasOwn(values, key)) {
          result[key] = values[key];
        } else if (keys && !Array.isArray(keys) && typeof keys === 'object') {
          result[key] = keys[key];
        }
      });
      const delay = Number(config.storageDelayMs) || 0;
      const gate = typeof config.storageGate === 'function' ? config.storageGate(read) : null;
      return Promise.resolve(gate).then(() => new Promise((resolve) => window.setTimeout(() => {
        callback?.(result);
        resolve(result);
      }, delay)));
    },
    set(items, callback) {
      storageWrites.push(Object.assign(JSON.parse(JSON.stringify(items)), {}));
      Object.assign(values, items);
      callback?.();
      return Promise.resolve();
    }
  });
  const storageArea = createStorageArea('sync', settings);
  // Without localSettings both areas hold the same values.
  const localSettings = config.localSettings ? Object.assign({}, config.localSettings) : settings;
  const localStorageArea = config.localSettings ? createStorageArea('local', localSettings) : storageArea;
  const storageChanged = createChromeEvent();
  const mediaListeners = new Set();
  window.chrome = {
    runtime: {
      id: 'kkcjcneagmlhpeaafngjdlpcfjakejgb',
      getURL: (resource) => `chrome-extension://kkcjcneagmlhpeaafngjdlpcfjakejgb/${resource}`,
      getManifest: () => ({ version: '0.9.56' }),
      sendMessage(message, callback) {
        messages.push(message);
        let response = typeof config.respond === 'function' ? config.respond(message) : undefined;
        if (response !== undefined) {
          Promise.resolve(response).then((value) => window.setTimeout(() => callback?.(value), 0));
          return Promise.resolve(response);
        }
        response = {};
        if (message.action === 'getSearchSuggestions') {
          response = { suggestions: [] };
        } else if (message.action === 'getSearchEngineSuggestions') {
          response = { suggestions: message.localSuggestions || [], hasRemoteSuggestions: false };
        } else if (message.action === 'getTabs') {
          response = { tabs: [] };
        }
        window.setTimeout(() => callback?.(response), 0);
        return Promise.resolve(response);
      }
    },
    i18n: { getUILanguage: () => 'en', getMessage: () => '' },
    storage: {
      sync: storageArea,
      local: localStorageArea,
      onChanged: storageChanged
    }
  };
  window.matchMedia = (media) => ({
    matches: Boolean(config.darkSystem) && /prefers-color-scheme:\s*dark/.test(media),
    media,
    addEventListener(type, listener) { mediaListeners.add(listener); },
    removeEventListener(type, listener) { mediaListeners.delete(listener); }
  });
  window.fetch = async (url) => {
    const parsed = new URL(url);
    assert.strictEqual(parsed.protocol, 'chrome-extension:', 'the overlay test must only read packaged resources');
    const resource = fs.readFileSync(path.join(repoRoot, parsed.pathname), 'utf8');
    return { ok: true, json: async () => JSON.parse(resource), text: async () => resource };
  };

  const evalFile = (file) => {
    const bundle = file.match(/^build\/([\w-]+)\.js$/);
    const source = bundle
      ? bundleScript(bundle[1], bundle[1] === 'overlay' ? { 'src/overlay/runtime.js': 'LumnoOverlayRuntime' } : null)
      : fs.readFileSync(path.join(repoRoot, file), 'utf8');
    window.eval(`${source}\n//# sourceURL=${file}`);
  };
  if (config.stylesheetsLoad) {
    const addLinkListener = window.HTMLLinkElement.prototype.addEventListener;
    window.HTMLLinkElement.prototype.addEventListener = function(type, listener, options) {
      addLinkListener.call(this, type, listener, options);
      if (type === 'load' && this.rel === 'stylesheet' && !this.__lumnoLoadScheduled) {
        this.__lumnoLoadScheduled = true;
        window.setTimeout(() => this.dispatchEvent(new window.Event('load')), 5);
      }
    };
  }
  // With recordAnimations, Web Animations (which JSDOM lacks) are available
  // and recorded: { target, keyframes, options, cancelled, finish() }.
  const animations = [];
  if (config.recordAnimations) {
    window.Element.prototype.animate = function(keyframes, options) {
      const animation = {
        target: this,
        keyframes: JSON.parse(JSON.stringify(keyframes)),
        options: JSON.parse(JSON.stringify(options || {})),
        cancelled: false,
        onfinish: null,
        oncancel: null,
        finished: Promise.resolve(),
        cancel() {
          animation.cancelled = true;
        },
        finish() {
          if (typeof animation.onfinish === 'function') animation.onfinish();
        },
        addEventListener(type, listener) {
          if (type === 'finish') animation.onfinish = listener;
        }
      };
      animations.push(animation);
      return animation;
    };
  }
  if (typeof config.setup === 'function') {
    config.setup(window);
  }
  const dispatchTrusted = recordAllListeners(window);
  const keys = trackListeners(window);
  const documentKeys = trackListeners(window.document);
  injectionFiles.forEach(evalFile);
  // The settings storage runtime is memoized per chrome API object and keeps
  // one storage-mode listener for the page's lifetime; create it up front so
  // it counts as part of the page baseline rather than the overlay session.
  window.LumnoOverlayRuntime.getStorageArea(window.chrome);
  await settle();
  const ledger = createListenerLedger(window);
  const baselineStorageListeners = new Set(storageChanged.listeners);
  const page = {
    window,
    document: window.document,
    errors,
    ledger,
    messages,
    settings,
    // The keys of each chrome.storage get the page made, in order; each
    // list's `area` names the storage area.
    storageReads,
    // The values each chrome.storage set wrote, in order.
    storageWrites,
    animations,
    keys,
    documentKeys,
    storageChanged,
    // Changes a stored setting the way another page or Settings would.
    changeSetting(key, newValue, areaName) {
      const values = areaName === 'local' ? localSettings : settings;
      const oldValue = values[key];
      values[key] = newValue;
      Array.from(storageChanged.listeners).forEach((listener) => listener({ [key]: { oldValue, newValue } }, areaName || 'sync'));
    },
    sessionStorageListenerCount() {
      return Array.from(storageChanged.listeners)
        .filter((listener) => !baselineStorageListeners.has(listener)).length;
    },
    mediaListeners,
    reinjectSearchPanel() {
      // Background re-runs the injection list when it cannot reuse the
      // runtime, which replaces the toggle helper while an overlay is open.
      evalFile('build/overlay.js');
    },
    // context.tabs is the open-tab list the background passes along.
    toggle(context) {
      const { tabs, ...rest } = context || {};
      window._x_extension_toggleSearchOverlay_2026_unique_(tabs || [], Object.assign({
        currentTabId: 1,
        currentTabUrl: window.location.href
      }, rest));
    },
    host() {
      return window.document.getElementById(HOST_ID);
    },
    hostCount() {
      return window.document.querySelectorAll(`#${HOST_ID}`).length;
    },
    // The overlay's shadow root (null while closed).
    root() {
      const panel = window.LumnoOverlayShell.findOverlayPanel(window.document);
      return panel ? panel._lumnoOverlayRoot : null;
    },
    input() {
      const root = page.root();
      return root ? root.querySelector('#_x_extension_search_input_2024_unique_') : null;
    },
    // Opens the overlay and waits until its input has focus.
    async open(context) {
      page.toggle(context);
      await waitFor(() => page.root() && page.root().activeElement === page.input(), 'the overlay should finish initialization', errors);
      await settle();
      return page.root();
    },
    async type(query) {
      const input = page.input();
      input.value = query;
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
      await settle(60);
    },
    suggestions() {
      const root = page.root();
      return root ? Array.from(root.querySelectorAll('.x-ov-suggestion-item')) : [];
    },
    // A trusted key press, delivered to the page's window and document
    // listeners (the overlay listens on both).
    press(key, init) {
      const event = keys.dispatch('keydown', Object.assign({ key, target: page.input() }, init || {}));
      if (!event.immediatePropagationStopped) {
        documentKeys.dispatch('keydown', Object.assign({ key, target: page.input() }, init || {}));
      }
      return event;
    },
    waitFor(condition, message) {
      return waitFor(condition, message, errors);
    },
    // A trusted event on any element, delivered along its composed path.
    trusted(target, type, init) {
      return dispatchTrusted(target, type, init);
    },
    settle: (ms) => timers.settle(ms || 30),
    close() {
      window.close();
    }
  };
  return page;
}

// The provider list the background passes the overlay on open
// (assets/data/site-search.json).
function bundledSiteSearchProviders() {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, 'assets/data/site-search.json'), 'utf8')).items;
}

async function openAndSettle(page) {
  page.toggle();
  const host = page.host();
  assert.ok(host, 'the overlay host should mount');
  const panel = page.window.LumnoOverlayShell.findOverlayPanel(page.window.document);
  const root = panel._lumnoOverlayRoot;
  const input = root.querySelector('#_x_extension_search_input_2024_unique_');
  await waitFor(() => root.activeElement === input, 'the overlay should finish initialization', page.errors);
  await settle();
  assert.ok(page.ledger.size() > 0, 'an open overlay should listen for page keys');
  assert.ok(page.sessionStorageListenerCount() > 0, 'an open overlay should follow settings changes');
  return host;
}

module.exports = {
  CONTEXT_TOKEN_KEY,
  bundledSiteSearchProviders,
  HOST_ID,
  createOverlayPage,
  openAndSettle,
  settle,
  waitFor
};
