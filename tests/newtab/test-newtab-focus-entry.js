const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');
const { parseCss } = require('../helpers/css-rules');
const { getBundleFiles, runsBefore } = require('../helpers/runtime-scripts');
const { moduleScript } = require('../helpers/module-script');

const repoRoot = path.resolve(__dirname, '..', '..');
const newtabDocument = new JSDOM(fs.readFileSync(path.join(repoRoot, 'newtab.html'), 'utf8')).window.document;
const sourcePath = path.join(repoRoot, 'src/newtab/newtab-focus-entry.ts');
const legacyDocument = new JSDOM(fs.readFileSync(path.join(repoRoot, 'src/newtab/newtab.html'), 'utf8')).window.document;
const legacyRedirectSourcePath = path.join(repoRoot, 'src/newtab/newtab-route-redirect.ts');
const storageKey = '_x_extension_newtab_input_auto_focus_enabled_2026_unique_';

assert.strictEqual(newtabDocument.querySelector('base').getAttribute('href'), 'src/newtab/',
  'the short root entry should retain the existing New Tab resource base');

const preload = newtabDocument.querySelector('script[src="../../build/newtab-preload.js"]');
const preloadFiles = getBundleFiles('newtab-preload');
assert.ok(preload && preloadFiles.includes('src/newtab/newtab-focus-entry.ts'),
  'the maintained New Tab page should load the preference-aware focus entry router');
const paintGate = newtabDocument.querySelector('style[data-nt-focus-paint-gate="true"]');
assert.ok(paintGate && (paintGate.compareDocumentPosition(preload) & 4),
  'the New Tab paint gate should be parsed before visual preload scripts can expose the wallpaper');
assert.ok(runsBefore(preloadFiles, 'src/domain/settings/index.ts', 'src/newtab/newtab-focus-entry.ts'),
  'the shared setting contract should load before the focus entry router');
assert.ok(runsBefore(preloadFiles, 'src/newtab/newtab-focus-entry.ts', 'src/newtab/dom/wallpaper-preload.ts'),
  'the focus route should settle before the New Tab starts visual preloading');
const gate = parseCss(paintGate.textContent).rule('html[data-nt-focus-route-pending="true"] body');
assert.ok(gate && gate.get('visibility') === 'hidden' && gate.get('background-image') === 'none' && gate.priority('background-image') === 'important',
  'every New Tab route should hide the body wallpaper until its effect is ready, so both appear together');
assert.ok(parseCss(paintGate.textContent).entries.some((entry) => entry.selectors.includes('body:not([data-nt-wallpaper-ready="1"])') &&
  entry.selectors.includes('html[data-nt-focus-route-pending="true"] body')), 'including before the wallpaper is ready');

const autoFocusCacheKey = '_x_extension_newtab_input_auto_focus_cache_2026_unique_';

function createLocalStorage(initial) {
  const values = new Map(Object.entries(initial || {}));
  return {
    values,
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value))
  };
}

async function runEntry({
  storedValue,
  search = '',
  storageAvailable = true,
  cachedEnabled,
  scheme = 'chrome-extension',
  visibilityState = 'visible',
  swapResponse = { ok: true, removed: true }
}) {
  const localStorage = createLocalStorage(
    typeof cachedEnabled === 'string' ? { [autoFocusCacheKey]: cachedEnabled } : {}
  );
  const replacedUrls = [];
  const attributes = new Set();
  const sentMessages = [];
  const visibilityListeners = [];
  let storageReads = 0;
  const href = `${scheme}://abc/newtab.html${search}`;
  const location = {
    href,
    search,
    replace(url) {
      replacedUrls.push(url);
    }
  };
  const runtime = {
    lastError: null,
    sendMessage(message, callback) {
      sentMessages.push(message);
      callback(swapResponse);
    }
  };
  const chromeApi = storageAvailable
    ? {
        runtime,
        storage: {
          local: {
            get(_keys, callback) {
              callback({});
            }
          },
          sync: {
            get(keys, callback) {
              storageReads += 1;
              assert.deepStrictEqual(Array.from(keys), [storageKey]);
              callback({ [storageKey]: storedValue });
            }
          }
        }
      }
    : {};
  const sandbox = {
    URL,
    localStorage,
    chrome: chromeApi,
    document: {
      visibilityState,
      addEventListener(type, listener) {
        if (type === 'visibilitychange') {
          visibilityListeners.push(listener);
        }
      },
      removeEventListener(type, listener) {
        const index = visibilityListeners.indexOf(listener);
        if (type === 'visibilitychange' && index >= 0) {
          visibilityListeners.splice(index, 1);
        }
      },
      documentElement: {
        setAttribute(name) {
          attributes.add(name);
        },
        removeAttribute(name) {
          attributes.delete(name);
        }
      }
    },
    window: {
      chrome: chromeApi,
      localStorage,
      location
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(moduleScript('src/newtab/newtab-focus-entry.ts'), sandbox, { filename: sourcePath });
  // Provider storage reads settle after the active storage area resolves.
  await new Promise((resolve) => setImmediate(resolve));
  const show = () => {
    sandbox.document.visibilityState = 'visible';
    visibilityListeners.slice().forEach((listener) => listener());
  };
  return {
    attributes,
    replacedUrls,
    sentMessages,
    show,
    storageReads,
    cachedEnabled: localStorage.getItem(autoFocusCacheKey)
  };
}

(async () => {
  {
    const result = await runEntry({ storedValue: false });
    assert.deepStrictEqual(result.replacedUrls, []);
    assert.strictEqual(result.storageReads, 1);
    assert.strictEqual(result.attributes.has('data-nt-focus-route-pending'), false);
  }

  {
    const result = await runEntry({ storedValue: undefined });
    assert.deepStrictEqual(result.replacedUrls, [], 'the missing preference should default to disabled');
    assert.strictEqual(result.storageReads, 1);
    assert.strictEqual(result.attributes.has('data-nt-focus-route-pending'), false);
  }

  {
    const result = await runEntry({ storedValue: true });
    assert.deepStrictEqual(
      result.replacedUrls,
      ['chrome-extension://abc/newtab.html?focus=1'],
      'an existing enabled preference should retain the renderer-navigation focus handoff'
    );
    assert.strictEqual(result.storageReads, 1);
  }

  {
    const result = await runEntry({ search: '?focus=1', storedValue: true });
    assert.deepStrictEqual(result.replacedUrls, []);
    assert.strictEqual(result.storageReads, 0, 'the focused destination must not redirect again');
    assert.strictEqual(
      result.attributes.has('data-nt-focus-route'),
      true,
      'the focused destination should retain a first-paint readiness gate'
    );
  }

  {
    const result = await runEntry({ storedValue: true, cachedEnabled: 'true' });
    assert.deepStrictEqual(result.replacedUrls, ['chrome-extension://abc/newtab.html?focus=1']);
    assert.strictEqual(result.storageReads, 0,
      'a remembered enabled choice should route before storage answers');
  }

  {
    const result = await runEntry({ storedValue: true, cachedEnabled: 'false' });
    assert.deepStrictEqual(result.replacedUrls, ['chrome-extension://abc/newtab.html?focus=1'],
      'a remembered disabled choice should still defer to storage, which another device may have changed');
    assert.strictEqual(result.storageReads, 1);
    assert.strictEqual(result.cachedEnabled, 'true', 'the storage answer should refresh the remembered choice');
  }

  {
    const result = await runEntry({ storedValue: false });
    assert.strictEqual(result.cachedEnabled, 'false');
  }

  {
    const result = await runEntry({ scheme: 'moz-extension', storedValue: true });
    assert.deepStrictEqual(result.replacedUrls, [], 'Firefox must not rely on same-tab focus navigation');
    assert.strictEqual(JSON.stringify(result.sentMessages), '[{"action":"swapNewtabForFocus"}]');
    assert.strictEqual(
      result.attributes.has('data-nt-focus-route-pending'),
      true,
      'the replaced Firefox tab should stay hidden while the focused tab takes over'
    );
  }

  {
    const result = await runEntry({ scheme: 'moz-extension', storedValue: true, cachedEnabled: 'true' });
    assert.deepStrictEqual(result.replacedUrls, [], 'the remembered choice should also swap tabs in Firefox');
    assert.strictEqual(result.storageReads, 0);
    assert.strictEqual(JSON.stringify(result.sentMessages), '[{"action":"swapNewtabForFocus"}]');
  }

  {
    const result = await runEntry({ scheme: 'moz-extension', storedValue: true, visibilityState: 'hidden' });
    assert.deepStrictEqual(result.sentMessages, [], 'a preloaded hidden Firefox page should wait before swapping');
    result.show();
    assert.strictEqual(JSON.stringify(result.sentMessages), '[{"action":"swapNewtabForFocus"}]');
  }

  {
    const result = await runEntry({
      scheme: 'moz-extension',
      storedValue: true,
      swapResponse: { ok: false, reason: 'invalid-sender' }
    });
    assert.strictEqual(
      result.attributes.has('data-nt-focus-route-pending'),
      false,
      'a failed Firefox swap should reveal the current page'
    );
  }

  {
    const result = await runEntry({ scheme: 'moz-extension', search: '#focus', storedValue: true });
    assert.deepStrictEqual(result.sentMessages, [], 'the swapped-in Firefox tab must not swap again');
    assert.strictEqual(result.storageReads, 0);
    assert.strictEqual(result.attributes.has('data-nt-focus-route'), true);
  }

  {
    const result = await runEntry({ scheme: 'moz-extension', storedValue: false });
    assert.deepStrictEqual(result.sentMessages, [], 'Firefox should not swap tabs when auto-focus is disabled');
  }

  {
    const result = await runEntry({ storageAvailable: false });
    assert.deepStrictEqual(result.replacedUrls, [], 'storage failures should preserve the disabled default');
    assert.strictEqual(result.attributes.has('data-nt-focus-route-pending'), false);
  }
})().then(() => {
  assert.ok(legacyDocument.querySelector('script[src="../../build/newtab-route-redirect.js"]'),
    'the previous New Tab path should remain as a compatibility redirect');
  {
    const replacedUrls = [];
    vm.runInNewContext(moduleScript('src/newtab/newtab-route-redirect.ts'), {
      URL,
      window: {
        location: {
          href: 'chrome-extension://abc/src/newtab/newtab.html?focus=1&notice=file-access#search',
          search: '?focus=1&notice=file-access',
          hash: '#search',
          replace(url) {
            replacedUrls.push(url);
          }
        }
      }
    }, { filename: legacyRedirectSourcePath });
    assert.deepStrictEqual(
      replacedUrls,
      ['chrome-extension://abc/newtab.html?focus=1&notice=file-access#search'],
      'the compatibility redirect should preserve query and hash on the short route'
    );
  }

  // The background openNewTab handler is covered by
  // tests/background/test-background-message-handlers.js.

  console.log('newtab focus entry tests passed');
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
