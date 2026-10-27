const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readPageSource } = require('../helpers/page-source');
const vm = require('vm');
const { getBundleFiles } = require('../helpers/runtime-scripts');
const { moduleScript } = require('../helpers/module-script');

const repoRoot = path.resolve(__dirname, '..', '..');
path.join(repoRoot, 'src/options/options.html');
const preloadPath = path.join(repoRoot, 'src/options/theme-preload.ts');
const lightBackgroundPath = path.join(repoRoot, 'assets/images/settings-bg-light.webp');
const darkBackgroundPath = path.join(repoRoot, 'assets/images/settings-bg-dark.webp');

const html = readPageSource('src/options/options.html');

assert(
  fs.existsSync(preloadPath),
  'Options should have an early theme and background preloader'
);

const firstStylesheetIndex = html.indexOf('<link rel="stylesheet"');
const themePreloadIndex = html.indexOf('<script src="../../build/options-preload.js"></script>');
assert(
  getBundleFiles('options-preload').includes('src/options/theme-preload.ts') &&
    themePreloadIndex >= 0 && themePreloadIndex < firstStylesheetIndex,
  'Options should run its theme preloader before render-blocking stylesheets'
);
assert(
  html.includes('settings-bg-light.webp') &&
    html.includes('settings-bg-dark.webp') &&
    !html.includes('settings-bg-light.png') &&
    !html.includes('settings-bg-dark.png'),
  'Options should render the resized WebP background assets'
);
assert(fs.existsSync(lightBackgroundPath), 'light Options WebP should exist');
assert(fs.existsSync(darkBackgroundPath), 'dark Options WebP should exist');
assert(
  fs.statSync(lightBackgroundPath).size < 1024 * 1024 &&
    fs.statSync(darkBackgroundPath).size < 1024 * 1024,
  'Options backgrounds should stay below 1 MiB each'
);

const elements = new Map();
function createElementRecord(id) {
  const attributes = new Map();
  return {
    id,
    style: {},
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    hasAttribute(name) {
      return attributes.has(name);
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    }
  };
}

const root = createElementRecord('root');
const body = createElementRecord('body');
const panel = createElementRecord('_x_extension_settings_panel_2024_unique_');
const themeColorMeta = createElementRecord('theme-color');
const tabKeys = ['general', 'account', 'appearance', 'shortcuts', 'blacklist', 'labs'];
const tabButtons = tabKeys.map((key) => {
  const element = createElementRecord(`tab-${key}`);
  element.setAttribute('data-tab', key);
  return element;
});
const tabContents = tabKeys.map((key) => {
  const element = createElementRecord(`content-${key}`);
  element.setAttribute('data-content', key);
  return element;
});
elements.set(panel.id, panel);

const headChildren = [];
const documentObject = {
  body,
  documentElement: root,
  head: {
    appendChild(node) {
      if (node.id === '_x_extension_options_background_preload_2026_unique_') {
        assert(node.href, 'the Options image preload should have an href before DOM insertion');
      }
      headChildren.push(node);
      if (node.id) {
        elements.set(node.id, node);
      }
    }
  },
  createElement(tagName) {
    return Object.assign(createElementRecord(''), {
      tagName: String(tagName).toUpperCase(),
      as: '',
      fetchPriority: '',
      href: '',
      rel: ''
    });
  },
  getElementById(id) {
    return elements.get(id) || null;
  },
  querySelector(selector) {
    return selector === 'meta[name="theme-color"]' ? themeColorMeta : null;
  },
  querySelectorAll(selector) {
    if (selector === '._x_extension_settings_tab_button_2024_unique_[data-tab]') {
      return tabButtons;
    }
    if (selector === '._x_extension_settings_content_2024_unique_[data-content]') {
      return tabContents;
    }
    return [];
  }
};

const localStorageValues = new Map();
const sandbox = {
  chrome: {
    runtime: {
      getURL(relativePath) {
        return `chrome-extension://lumno/${relativePath}`;
      }
    },
    storage: {
      sync: {
        get(_keys, callback) {
          callback({ _x_extension_theme_mode_2024_unique_: 'dark' });
        }
      }
    }
  },
  document: documentObject,
  localStorage: {
    getItem(key) {
      return localStorageValues.get(key) || null;
    },
    setItem(key, value) {
      localStorageValues.set(key, String(value));
    }
  },
  location: {
    hash: '#shortcuts:site-search-ai'
  },
  matchMedia() {
    return { matches: false };
  },
  MutationObserver: class {
    observe() {}
    disconnect() {}
  }
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;

vm.createContext(sandbox);
vm.runInContext(moduleScript('src/domain/settings/index.ts', 'LumnoSettings'), sandbox, {
  filename: 'settings.ts'
});
vm.runInContext(moduleScript('src/options/theme-preload.ts'), sandbox, {
  filename: 'theme-preload.ts'
});

(async () => {
  // The provider storage runtime resolves its active area before reading.
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(root.getAttribute('data-theme-ready'), 'true');
  assert.strictEqual(root.getAttribute('data-options-preload-theme'), 'dark');
  assert.strictEqual(root.getAttribute('data-options-theme-mode'), 'dark');
  assert.strictEqual(body.getAttribute('data-theme'), 'dark');
  assert.strictEqual(panel.getAttribute('data-theme'), 'dark');
  assert.strictEqual(root.getAttribute('data-options-initial-tab'), 'shortcuts');
  tabButtons.forEach((button) => {
    assert.strictEqual(
      button.getAttribute('data-active'),
      button.getAttribute('data-tab') === 'shortcuts' ? 'true' : 'false'
    );
  });
  tabContents.forEach((content) => {
    assert.strictEqual(
      content.getAttribute('data-active'),
      content.getAttribute('data-content') === 'shortcuts' ? 'true' : 'false'
    );
  });
  assert.strictEqual(themeColorMeta.getAttribute('content'), '#111111');
  assert.strictEqual(
    localStorageValues.get('_x_extension_options_theme_preload_2026_unique_'),
    'dark',
    'the definitive stored preference should refresh the synchronous cache'
  );
  const imagePreload = headChildren.find((node) => node.id === '_x_extension_options_background_preload_2026_unique_');
  assert(imagePreload, 'Options should preload its resolved background before first paint');
  assert.strictEqual(imagePreload.rel, 'preload');
  assert.strictEqual(imagePreload.as, 'image');
  assert.strictEqual(imagePreload.fetchPriority, 'high');
  assert.strictEqual(
    imagePreload.href,
    'chrome-extension://lumno/assets/images/settings-bg-dark.webp'
  );
  assert(
    html.includes('data-tab="general" data-active="true"') &&
      html.includes('data-content="general" data-active="true"'),
    'Options should statically paint the default General route'
  );

  console.log('Options cold-start asset tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
