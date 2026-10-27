const assert = require('assert');
const { JSDOM } = require('jsdom');
const settings = require('../../src/domain/settings');
const { PageTheme } = require('../../src/options/features/appearance/page-theme');
const { createSettingsStore } = require('../../src/platform/settings-store.ts');

// Lets reads and saves through the settings store finish.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(stored, options) {
  const config = options || {};
  const dom = new JSDOM('<head><meta name="theme-color" content=""></head><body><div id="panel"></div></body>', {
    url: 'https://lumno.test/options.html'
  });
  const window = dom.window;
  const document = window.document;
  const mediaListeners = new Set();
  const media = {
    matches: Boolean(config.systemDark),
    addEventListener: (type, listener) => mediaListeners.add(listener),
    removeEventListener: (type, listener) => mediaListeners.delete(listener)
  };
  window.matchMedia = () => media;
  const values = Object.assign({}, stored);
  const writes = [];
  const changeListeners = new Set();
  const syncArea = {
    get(keys, callback) {
      callback(Object.fromEntries(keys.filter((key) => key in values).map((key) => [key, values[key]])));
    },
    set(payload, callback) {
      writes.push(payload);
      Object.assign(values, payload);
      callback();
    }
  };
  const shown = [];
  const theme = new PageTheme(createSettingsStore({
    chromeApi: {
      runtime: { lastError: null },
      storage: {
        sync: syncArea,
        local: { get: (keys, callback) => callback({}), set: (payload, callback) => callback() },
        onChanged: { addListener: (listener) => changeListeners.add(listener), removeListener: (listener) => changeListeners.delete(listener) }
      }
    },
    settings: []
  }), {
    doc: document,
    win: window,
    // Records each mode the panel is redrawn for.
    animatePanel(mutate) {
      mutate();
      shown.push(theme.store.getSnapshot().mode);
      return false;
    }
  });
  return {
    document,
    media,
    mediaListeners,
    theme,
    shown,
    writes,
    // Another page stores a mode.
    storeElsewhere(mode) {
      values[settings.themeMode.key] = mode;
      changeListeners.forEach((listener) => listener({ [settings.themeMode.key]: { newValue: mode } }, 'sync'));
    },
    systemChanges(dark) {
      media.matches = dark;
      mediaListeners.forEach((listener) => listener());
    },
    cached: () => window.localStorage.getItem(settings.optionsThemePreload.key),
    pageTheme: () => document.body.getAttribute('data-theme')
  };
}

(async () => {
  // Startup shows the stored mode and refreshes the preloader's cache.
  {
    const page = setup({ [settings.themeMode.key]: 'dark' });
    page.theme.start();
    await settle();
    assert.strictEqual(page.pageTheme(), 'dark');
    assert.strictEqual(page.theme.store.getSnapshot().resolved, 'dark', 'the panel draws in the resolved theme');
    assert.strictEqual(page.document.documentElement.style.colorScheme, 'dark');
    assert.strictEqual(page.document.querySelector('meta[name="theme-color"]').getAttribute('content'), '#111111');
    assert.strictEqual(page.document.documentElement.getAttribute('data-theme-ready'), 'true');
    assert.strictEqual(page.document.documentElement.getAttribute('data-options-theme-mode'), 'dark');
    assert.strictEqual(page.cached(), 'dark');
    assert.strictEqual(page.theme.store.getSnapshot().mode, 'dark');
    assert.deepStrictEqual(page.shown, ['dark'], 'the panel redraws for the shown mode');
    page.systemChanges(true);
    assert.strictEqual(page.pageTheme(), 'dark', 'a fixed theme ignores the OS setting');
  }

  // "System" follows the OS, including changes while the page is open.
  {
    const page = setup({}, { systemDark: true });
    page.theme.start();
    await settle();
    assert.strictEqual(page.theme.store.getSnapshot().mode, 'system');
    assert.strictEqual(page.pageTheme(), 'dark');
    page.systemChanges(false);
    assert.strictEqual(page.pageTheme(), 'light');
  }

  // Choosing a theme saves the global theme mode and shows it.
  {
    const page = setup({});
    page.theme.start();
    await settle();
    page.theme.choose('light');
    await settle();
    assert.deepStrictEqual(page.writes, [{ [settings.themeMode.key]: 'light' }]);
    assert.strictEqual(page.cached(), 'light');
    assert.strictEqual(page.pageTheme(), 'light');
  }

  // A choice made on another page is shown here, and "system" follows the OS.
  {
    const page = setup({ [settings.themeMode.key]: 'light' }, { systemDark: true });
    page.theme.start();
    await settle();
    page.storeElsewhere('dark');
    assert.strictEqual(page.pageTheme(), 'dark');
    page.storeElsewhere(undefined);
    assert.strictEqual(page.theme.store.getSnapshot().mode, 'system');
    page.systemChanges(false);
    assert.strictEqual(page.pageTheme(), 'light');
  }

  console.log('Options theme tests passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
