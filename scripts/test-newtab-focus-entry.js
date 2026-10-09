const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { readPageSource } = require('./helpers/page-source');

const repoRoot = path.resolve(__dirname, '..');
const html = readPageSource('newtab.html');
const sourcePath = path.join(repoRoot, 'src/newtab/newtab-focus-entry.js');
const source = fs.existsSync(sourcePath) ? fs.readFileSync(sourcePath, 'utf8') : '';
const backgroundSource = fs.readFileSync(
  path.join(repoRoot, 'src/background/background.js'),
  'utf8'
);
const legacyHtml = fs.readFileSync(path.join(repoRoot, 'src/newtab/newtab.html'), 'utf8');
const legacyRedirectSourcePath = path.join(repoRoot, 'src/newtab/newtab-route-redirect.js');
const legacyRedirectSource = fs.readFileSync(legacyRedirectSourcePath, 'utf8');
const storageKey = '_x_extension_newtab_input_auto_focus_enabled_2026_unique_';
const settingsSource = fs.readFileSync(path.join(__dirname, '../src/shared/settings.js'), 'utf8');

assert.match(
  html,
  /<base href="src\/newtab\/" \/>/,
  'the short root entry should retain the existing New Tab resource base'
);

assert.match(
  html,
  /<script src="newtab-focus-entry\.js"><\/script>/,
  'the maintained New Tab page should load the preference-aware focus entry router'
);
assert.ok(
  html.indexOf('<style data-nt-focus-paint-gate="true">') <
    html.indexOf('<script src="../shared/settings.js"></script>'),
  'the New Tab paint gate should be parsed before visual preload scripts can expose the wallpaper'
);
assert.ok(
  html.indexOf('<script src="../shared/settings.js"></script>') <
    html.indexOf('<script src="newtab-focus-entry.js"></script>'),
  'the shared setting contract should load before the focus entry router'
);
assert.ok(
  html.indexOf('<script src="newtab-focus-entry.js"></script>') <
    html.indexOf('<script src="wallpaper-preload.js"></script>'),
  'the focus route should settle before the New Tab starts visual preloading'
);
assert.match(
  html,
  /html\[data-nt-focus-route-pending="true"\] body,\s*body:not\(\[data-nt-wallpaper-ready="1"\]\)\s*\{\s*visibility:\s*hidden;\s*background-image:\s*none !important;/,
  'every New Tab route should suppress the propagated body wallpaper until its effect is ready, so both appear together'
);
assert.match(
  html,
  /<style data-nt-focus-paint-gate="true">[\s\S]*?<\/style>\s*<script src="\.\.\/shared\/settings\.js"><\/script>/,
  'the focused destination paint gate should be available before focus routing starts'
);

const autoFocusCacheKey = '_x_extension_newtab_input_auto_focus_cache_2026_unique_';

function createLocalStorage(initial) {
  const values = new Map(Object.entries(initial || {}));
  return {
    values,
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value))
  };
}

async function runEntry({ storedValue, search = '', storageAvailable = true, cachedEnabled }) {
  const localStorage = createLocalStorage(
    typeof cachedEnabled === 'string' ? { [autoFocusCacheKey]: cachedEnabled } : {}
  );
  const replacedUrls = [];
  const attributes = new Set();
  let storageReads = 0;
  const href = `chrome-extension://abc/newtab.html${search}`;
  const location = {
    href,
    search,
    replace(url) {
      replacedUrls.push(url);
    }
  };
  const chromeApi = storageAvailable
    ? {
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
  vm.runInContext(settingsSource, sandbox, { filename: 'settings.js' });
  vm.runInContext(source, sandbox, { filename: sourcePath });
  // Provider storage reads settle after the active storage area resolves.
  await new Promise((resolve) => setImmediate(resolve));
  return { attributes, replacedUrls, storageReads, cachedEnabled: localStorage.getItem(autoFocusCacheKey) };
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
    const result = await runEntry({ storageAvailable: false });
    assert.deepStrictEqual(result.replacedUrls, [], 'storage failures should preserve the disabled default');
    assert.strictEqual(result.attributes.has('data-nt-focus-route-pending'), false);
  }
})().then(() => {
  assert.match(
    legacyHtml,
    /<script src="newtab-route-redirect\.js"><\/script>/,
    'the previous New Tab path should remain as a compatibility redirect'
  );
  {
    const replacedUrls = [];
    vm.runInNewContext(legacyRedirectSource, {
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

  const openNewTabBlock = backgroundSource.match(/case 'openNewTab': \{([\s\S]*?)\n    \}/);
  assert(openNewTabBlock, 'background should expose the openNewTab action');
  assert.doesNotMatch(
    openNewTabBlock[1],
    /\burl\s*:/,
    'openNewTab should omit an extension URL so Chromium opens chrome://newtab'
  );
  assert.match(
    openNewTabBlock[1],
    /createTabWithSourceGroup\(\{[\s\S]*active:/,
    'openNewTab should retain foreground/background disposition while using the browser New Tab route'
  );

  console.log('newtab focus entry tests passed');
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
