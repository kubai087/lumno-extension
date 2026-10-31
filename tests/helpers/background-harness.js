'use strict';

// Boots the real background service worker (the background bundle, built from
// background.js and everything it imports) inside a vm context with a recording
// chrome stub, so tests can fire browser events at it and observe the storage
// writes and API calls it makes, instead of asserting on its source text.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { moduleScript, workerScriptSource } = require('./module-script');

const BACKGROUND_EXPORTS = '__lumnoBackgroundExports';
const EXTENSION_ORIGIN = 'chrome-extension://lumno-test';

const repoRoot = path.resolve(__dirname, '..', '..');

function createEvent() {
  const listeners = [];
  return {
    listeners,
    addListener(listener) {
      listeners.push(listener);
    },
    removeListener(listener) {
      const index = listeners.indexOf(listener);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    },
    hasListener(listener) {
      return listeners.includes(listener);
    },
    dispatch(...args) {
      return listeners.map((listener) => listener(...args));
    }
  };
}

function createStorageArea(name, initialData, options) {
  const data = Object.assign({}, initialData || {});
  const config = options || {};
  const writes = [];
  const reads = [];
  const area = {
    data,
    writes,
    reads,
    // While held, get() callbacks queue up as they would while the browser
    // is still reading storage for a freshly woken worker.
    held: config.hold === true,
    pendingGets: [],
    release() {
      area.held = false;
      const pending = area.pendingGets.splice(0);
      pending.forEach((run) => run());
    },
    get(keys, callback) {
      reads.push(keys);
      const run = () => {
        const result = {};
        const keyList = keys === null || keys === undefined
          ? Object.keys(data)
          : (Array.isArray(keys)
            ? keys
            : (typeof keys === 'string' ? [keys] : Object.keys(keys || {})));
        keyList.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(data, key)) {
            result[key] = JSON.parse(JSON.stringify(data[key]));
          } else if (keys && typeof keys === 'object' && !Array.isArray(keys)) {
            result[key] = keys[key];
          }
        });
        if (typeof callback === 'function') {
          setTimeout(() => callback(result), 0);
        }
      };
      if (area.held) {
        area.pendingGets.push(run);
        return undefined;
      }
      run();
      return undefined;
    },
    set(items, callback) {
      const copy = JSON.parse(JSON.stringify(items || {}));
      writes.push(copy);
      Object.assign(data, copy);
      if (typeof callback === 'function') {
        setTimeout(callback, 0);
      }
    },
    remove(keys, callback) {
      (Array.isArray(keys) ? keys : [keys]).forEach((key) => {
        delete data[key];
      });
      if (typeof callback === 'function') {
        setTimeout(callback, 0);
      }
    }
  };
  area.areaName = name;
  return area;
}

function callLater(callback, value) {
  if (typeof callback === 'function') {
    setTimeout(() => callback(value), 0);
  }
}

function createChromeStub(config) {
  const calls = [];
  const record = (name, args) => {
    calls.push({ name, args });
  };
  const tabs = Array.isArray(config.tabs) ? config.tabs : [];
  const storageOptions = config.storageOptions || {};
  const storage = {
    sync: createStorageArea('sync', config.sync, storageOptions.sync),
    local: createStorageArea('local', config.local, storageOptions.local),
    session: createStorageArea('session', config.session, storageOptions.session),
    onChanged: createEvent()
  };
  const chromeApi = {
    runtime: {
      id: 'lumno-test',
      lastError: null,
      // File paths by default; with extensionUrls, the chrome-extension://
      // URLs a browser gives, which the worker compares tab URLs against.
      getURL(relativePath) {
        return config.extensionUrls === true
          ? `${EXTENSION_ORIGIN}/${String(relativePath || '').replace(/^\//, '')}`
          : path.join(repoRoot, relativePath).split(path.sep).join('/');
      },
      getManifest() {
        return { version: config.version || '1.0.0' };
      },
      getPlatformInfo(callback) {
        callLater(callback, { os: config.os || 'mac' });
      },
      sendMessage(message, callback) {
        record('runtime.sendMessage', [message]);
        callLater(callback, undefined);
      },
      onMessage: createEvent(),
      onInstalled: createEvent(),
      onStartup: createEvent(),
      onSuspend: createEvent(),
      onConnect: createEvent(),
      setUninstallURL(_url, callback) {
        callLater(callback);
      },
      openOptionsPage(callback) {
        callLater(callback);
      }
    },
    storage,
    history: {
      search(_options, callback) {
        callLater(callback, []);
      },
      deleteUrl(_options, callback) {
        callLater(callback);
      },
      onVisited: createEvent(),
      onVisitRemoved: createEvent()
    },
    topSites: {
      get(callback) {
        callLater(callback, []);
      }
    },
    bookmarks: {
      search(_options, callback) {
        callLater(callback, []);
      },
      getTree(callback) {
        callLater(callback, [{ id: '0', title: '', children: [] }]);
      },
      onCreated: createEvent(),
      onRemoved: createEvent(),
      onChanged: createEvent(),
      onMoved: createEvent(),
      onChildrenReordered: createEvent(),
      onImportEnded: createEvent()
    },
    tabs: {
      query(queryInfo, callback) {
        record('tabs.query', [queryInfo]);
        const info = queryInfo || {};
        const result = tabs.filter((tab) => Object.keys(info).every((key) => {
          if (key === 'currentWindow' || key === 'lastFocusedWindow') {
            return true;
          }
          return tab[key] === info[key];
        }));
        callLater(callback, result);
      },
      get(tabId, callback) {
        const tab = tabs.find((item) => item.id === tabId);
        if (!tab) {
          chromeApi.runtime.lastError = { message: `No tab with id: ${tabId}.` };
          callback(undefined);
          chromeApi.runtime.lastError = null;
          return;
        }
        callLater(callback, tab);
      },
      create(options, callback) {
        record('tabs.create', [options]);
        callLater(callback, Object.assign({ id: 9000 + calls.length, windowId: 1 }, options));
      },
      update(tabId, options, callback) {
        record('tabs.update', [tabId, options]);
        callLater(callback, Object.assign({ id: tabId, windowId: 1 }, options));
      },
      sendMessage(tabId, message, optionsOrCallback, maybeCallback) {
        record('tabs.sendMessage', [tabId, message]);
        const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
        callLater(callback, undefined);
      },
      remove(tabIds, callback) {
        record('tabs.remove', [tabIds]);
        callLater(callback);
      },
      getZoom(_tabId, callback) {
        callLater(callback, 1);
      },
      captureVisibleTab(_windowId, _options, callback) {
        callLater(callback, '');
      },
      group(_options, callback) {
        callLater(callback, 1);
      },
      onCreated: createEvent(),
      onUpdated: createEvent(),
      onRemoved: createEvent(),
      onActivated: createEvent(),
      onReplaced: createEvent(),
      onMoved: createEvent(),
      onAttached: createEvent(),
      onDetached: createEvent()
    },
    windows: {
      update(windowId, _options, callback) {
        callLater(callback, { id: windowId });
      },
      getCurrent(callback) {
        callLater(callback, { id: 1 });
      },
      getLastFocused(_options, callback) {
        const done = typeof _options === 'function' ? _options : callback;
        callLater(done, { id: 1, type: 'normal' });
      },
      getAll(_options, callback) {
        const done = typeof _options === 'function' ? _options : callback;
        callLater(done, [{ id: 1, type: 'normal', incognito: false }]);
      },
      onFocusChanged: createEvent(),
      onCreated: createEvent(),
      onRemoved: createEvent(),
      WINDOW_ID_NONE: -1
    },
    commands: {
      getAll(callback) {
        callLater(callback, Array.isArray(config.commands) ? config.commands : []);
      },
      onCommand: createEvent()
    },
    action: {
      onClicked: createEvent(),
      setIcon(_options, callback) {
        callLater(callback);
      },
      setTitle(_options, callback) {
        callLater(callback);
      }
    },
    contextMenus: (() => {
      const items = new Map();
      return {
        items,
        create(properties, callback) {
          record('contextMenus.create', [properties]);
          items.set(properties.id, Object.assign({}, properties));
          callLater(callback);
        },
        update(id, properties, callback) {
          if (!items.has(id)) {
            chromeApi.runtime.lastError = { message: `Cannot find menu item with id ${id}` };
            if (typeof callback === 'function') callback();
            chromeApi.runtime.lastError = null;
            return;
          }
          Object.assign(items.get(id), properties);
          callLater(callback);
        },
        remove(id, callback) {
          items.delete(id);
          callLater(callback);
        },
        removeAll(callback) {
          items.clear();
          callLater(callback);
        },
        onClicked: createEvent()
      };
    })(),
    alarms: {
      create() {},
      clear(_name, callback) {
        callLater(callback, true);
      },
      onAlarm: createEvent()
    },
    scripting: {
      executeScript(options, callback) {
        record('scripting.executeScript', [options]);
        if (typeof callback === 'function') {
          callLater(callback, []);
          return undefined;
        }
        return Promise.resolve([]);
      },
      insertCSS(_options, callback) {
        callLater(callback);
      },
      registerContentScripts(_scripts, callback) {
        callLater(callback);
      },
      unregisterContentScripts(_filter, callback) {
        callLater(callback);
      },
      getRegisteredContentScripts(_filter, callback) {
        const done = typeof _filter === 'function' ? _filter : callback;
        callLater(done, []);
      }
    },
    search: {
      query(_options, callback) {
        callLater(callback);
      }
    },
    permissions: {
      contains(_options, callback) {
        callLater(callback, true);
      }
    },
    i18n: {
      getUILanguage() {
        return 'en';
      },
      getMessage() {
        return '';
      }
    },
    tabGroups: {
      TAB_GROUP_ID_NONE: -1,
      get(_groupId, callback) {
        callLater(callback, null);
      },
      update(_groupId, _options, callback) {
        callLater(callback, null);
      }
    }
  };
  return { chromeApi, calls, tabs };
}

function loadBackground(options) {
  const config = options || {};
  const { chromeApi, calls, tabs } = createChromeStub(config);
  if (typeof config.configureChrome === 'function') {
    config.configureChrome(chromeApi, calls);
  }
  const context = vm.createContext({
    console: config.console || {
      log() {},
      info() {},
      debug() {},
      warn: (...args) => calls.push({ name: 'console.warn', args }),
      error: (...args) => calls.push({ name: 'console.error', args })
    },
    chrome: chromeApi,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    btoa,
    atob,
    Blob,
    AbortController,
    navigator: { userAgent: 'Fake Chrome', platform: 'MacIntel' },
    // With packagedFetch (and extensionUrls), the worker can read its own
    // packaged files (site-search.json, locale messages); everything else
    // is offline.
    fetch: config.fetch || (async (url) => {
      const resource = String(url);
      if (config.packagedFetch === true && resource.startsWith(`${EXTENSION_ORIGIN}/`)) {
        const text = fs.readFileSync(path.join(repoRoot, new URL(resource).pathname), 'utf8');
        return { ok: true, status: 200, json: async () => JSON.parse(text), text: async () => text };
      }
      throw new Error('network disabled in background harness');
    })
  });
  context.globalThis = context;
  context.self = context;
  const runFile = (file) => {
    vm.runInContext(workerScriptSource(file), context, {
      filename: String(file)
    });
  };
  const workerContextSource = fs.readFileSync(path.join(repoRoot, 'src/background/worker-context.ts'), 'utf8');
  if (config.firefoxOrder === true) {
    // Mirrors scripts/build/build-firefox.js: Firefox event pages have no
    // importScripts, so the scripts the worker imports on first use load as
    // background scripts before the bundle, which runs with a no-op
    // importScripts.
    [...workerContextSource.matchAll(/^(?:export )?const \w+_SCRIPT_PATH = '([^']+)';$/gm)]
      .forEach((match) => runFile(path.join(repoRoot, match[1])));
    context.importScripts = () => {};
  } else {
    context.importScripts = (...urls) => {
      urls.forEach(runFile);
    };
  }
  // `exposeModules` adds exports of the worker's own modules to exposed(), by file:
  // { 'src/background/x.ts': ['name'] }. They are the instances the worker
  // runs, not copies.
  vm.runInContext(
    moduleScript('src/background/background.ts', BACKGROUND_EXPORTS, config.exposeModules),
    context,
    { filename: 'build/background.js' }
  );

  // Without an explicit sender a message comes from an extension page, which
  // may send every action; pass a { tab, url } sender to act as a web page.
  const extensionPageSender = { url: chromeApi.runtime.getURL('newtab.html') };

  function sendMessage(request, sender, timeoutMs) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (response) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(response);
      };
      const results = chromeApi.runtime.onMessage.dispatch(request, sender || extensionPageSender, finish);
      if (!results.some((result) => result === true)) {
        setTimeout(() => finish(undefined), 0);
      }
      setTimeout(() => finish(undefined), Number(timeoutMs) > 0 ? Number(timeoutMs) : 500);
    });
  }

  return {
    context,
    chrome: chromeApi,
    calls,
    // The tab objects tabs.query and tabs.get answer from.
    tabs,
    storage: chromeApi.storage,
    sendMessage,
    // A binding background.js exports, or one named in `exposeModules`.
    exposed(name) {
      return context[BACKGROUND_EXPORTS][name];
    }
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  loadBackground,
  createEvent,
  createStorageArea,
  wait
};
