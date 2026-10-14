const assert = require('assert');
const { readStylesheet } = require('./helpers/css-tokens');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { readPageSource } = require('./helpers/page-source');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

const repoRoot = path.resolve(__dirname, '..');
const newtabJs = readNewtabRuntimeSource();
const newtabHtml = readPageSource('newtab.html');
const pageStructureReact = fs.readFileSync(
  path.join(repoRoot, 'react-src/newtab/page-structure.tsx'),
  'utf8'
);
const shortcutsReact = fs.readFileSync(
  path.join(repoRoot, 'react-src/newtab/shortcuts.tsx'),
  'utf8'
);
const shortcutDialogJs = fs.readFileSync(
  path.join(repoRoot, 'react-src/newtab/shortcut-dialog.tsx'),
  'utf8'
);
const shortcutDialogCss = readStylesheet('src/newtab/shortcut-dialog.css');
const wallpaperAdaptiveToneJs = fs.readFileSync(path.join(repoRoot, 'src/newtab/wallpaper-adaptive-tone.js'), 'utf8');
const tooltipJs = fs.readFileSync(path.join(repoRoot, 'src/shared/tooltip.js'), 'utf8');
const optionsHtml = readPageSource('src/options/options.html');
const wallpaperSource = fs.readFileSync(path.join(repoRoot, 'src/newtab/wallpaper.js'), 'utf8');
const wallpaperViewSource = fs.readFileSync(
  path.join(repoRoot, 'react-src/newtab/wallpaper-view.tsx'),
  'utf8'
);
const locales = ['zh_CN', 'zh_TW', 'en', 'ja'].map((locale) => ({
  locale,
  messages: JSON.parse(fs.readFileSync(path.join(repoRoot, `_locales/${locale}/messages.json`), 'utf8'))
}));

function assertContains(source, needle, message) {
  // Multiline source assertions should verify declarations, not CSS indentation.
  const matches = source.includes(needle) || (needle.includes('\n') &&
    source.replace(/\s+/g, ' ').includes(needle.replace(/\s+/g, ' ')));
  assert.ok(matches, message);
}

function assertNotContains(source, needle, message) {
  assert.ok(!source.includes(needle), message);
}

function assertMessage(locale, messages, key) {
  assert.ok(
    messages[key] && typeof messages[key].message === 'string' && messages[key].message.trim(),
    `${locale} should localize ${key}`
  );
}

function getCssRuleBlock(source, selector) {
  const escapedSelector = selector.trim().split(/\s+/)
    .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
  const match = new RegExp(`^\\s*${escapedSelector}\\s*\\{`, 'm').exec(source);
  const selectorIndex = match ? match.index : -1;
  assert.ok(selectorIndex >= 0, `${selector} rule should exist`);
  const blockStart = source.indexOf('{', selectorIndex);
  const blockEnd = source.indexOf('}', blockStart);
  assert.ok(blockStart >= 0 && blockEnd > blockStart, `${selector} rule should be readable`);
  return source.slice(blockStart + 1, blockEnd);
}

function getCssDeclaration(block, property) {
  const match = block.match(new RegExp(`^\\s*${property}: ([^;]+);`, 'm'));
  assert.ok(match, `${property} declaration should exist`);
  return `${property}: ${match[1]};`;
}

function getFunctionSource(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `${name} function should exist`);
  const bodyStart = source.indexOf('{', start);
  assert.ok(bodyStart >= 0, `${name} function body should start`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  assert.fail(`${name} function body should end`);
  return '';
}

function assertBrowserInternalShortcutNavigation() {
  const navigations = [];
  const messages = [];
  const location = { href: 'chrome-extension://lumno/newtab.html' };
  const sandbox = {
    chrome: {
      runtime: {
        lastError: null,
        sendMessage: (message) => messages.push(message)
      },
      tabs: {
        getCurrent: (callback) => callback({ id: 42 }),
        update: (tabId, options) => navigations.push({ tabId, url: options.url })
      }
    },
    window: { location },
    NAVIGATION_DISPOSITION: require('../src/shared/navigation-disposition.js'),
    numberShortcutInstantEnabled: false,
    newtabOpenInNewTab: { search: false, shortcuts: false, bookmarks: false, recentSites: false }
  };
  vm.runInNewContext([
    'navigateToUrl',
    'isMiddleClick',
    'isBackgroundOpenEvent',
    'getSurfaceOpenDisposition',
    'openUrlFromNewtabCard',
    'openShortcutUrl'
  ].map((name) => getFunctionSource(newtabJs, name)).join('\n'), sandbox);

  const shortcut = { url: 'chrome://inspect/#devices' };
  sandbox.openShortcutUrl(shortcut, { button: 0 });
  assert.deepStrictEqual(navigations, [{ tabId: 42, url: shortcut.url }]);
  assert.strictEqual(location.href, 'chrome-extension://lumno/newtab.html');

  [{ ctrlKey: true }, { metaKey: true }, { button: 1 }].forEach((event) => {
    sandbox.openShortcutUrl(shortcut, event);
  });
  assert.strictEqual(messages.length, 3);
  messages.forEach((message) => {
    assert.strictEqual(message.action, 'createTab');
    assert.strictEqual(message.url, shortcut.url);
    assert.strictEqual(message.disposition, 'backgroundTab');
  });
  assert.strictEqual(navigations.length, 1);

  // Shortcuts set to open in a new tab: a plain click opens a foreground tab,
  // a Command/Ctrl click still opens in the background.
  sandbox.newtabOpenInNewTab = { search: false, shortcuts: true, bookmarks: false, recentSites: false };
  messages.length = 0;
  sandbox.openShortcutUrl(shortcut, { button: 0 });
  sandbox.openShortcutUrl(shortcut, { metaKey: true });
  assert.deepStrictEqual(messages.map((message) => message.disposition), ['newTab', 'backgroundTab']);
  assert.strictEqual(navigations.length, 1);
  assert.strictEqual(sandbox.openUrlFromNewtabCard(shortcut.url, { surface: 'bookmarks' }), 'currentTab');
  assert.strictEqual(sandbox.openUrlFromNewtabCard(shortcut.url, { surface: 'shortcuts' }), 'newTab');
  assert.strictEqual(navigations.length, 2);
}

assertBrowserInternalShortcutNavigation();

function createFakeStyle() {
  const values = new Map();
  return {
    setProperty(name, value) {
      values.set(String(name), String(value));
    },
    getPropertyValue(name) {
      return values.get(String(name)) || '';
    },
    removeProperty(name) {
      values.delete(String(name));
    }
  };
}

function createToneElement(rect) {
  const attributes = new Map();
  return {
    style: createFakeStyle(),
    setAttribute(name, value) {
      attributes.set(String(name), String(value));
    },
    getAttribute(name) {
      return attributes.has(String(name)) ? attributes.get(String(name)) : null;
    },
    removeAttribute(name) {
      attributes.delete(String(name));
    },
    getBoundingClientRect() {
      return rect || {
        left: 100,
        top: 100,
        right: 148,
        bottom: 148,
        width: 48,
        height: 48
      };
    }
  };
}

function parseSolidRgb(value) {
  const match = String(value || '').match(/^rgb\((\d+) (\d+) (\d+)\)$/);
  assert.ok(match, `Expected a solid rgb() color, got ${value}`);
  return {
    red: Number(match[1]),
    green: Number(match[2]),
    blue: Number(match[3])
  };
}

function getTestColorLuminance(color) {
  return ((color.red * 0.299) + (color.green * 0.587) + (color.blue * 0.114)) / 255;
}

function getTestRelativeLuminance(color) {
  function linearize(channel) {
    const value = channel / 255;
    return value <= 0.04045
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  }
  return (0.2126 * linearize(color.red)) +
    (0.7152 * linearize(color.green)) +
    (0.0722 * linearize(color.blue));
}

function getTestContrastRatio(firstColor, secondColor) {
  const firstLuminance = getTestRelativeLuminance(firstColor);
  const secondLuminance = getTestRelativeLuminance(secondColor);
  return (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05);
}

async function assertDarkWallpaperKeepsShortcutThemeBackground() {
  const wordmark = createToneElement({
    left: 390,
    top: 54,
    right: 610,
    bottom: 126,
    width: 220,
    height: 72
  });
  const shortcutTile = createToneElement();
  const addTile = createToneElement();
  const disabledTarget = createToneElement();
  shortcutTile.setAttribute('data-shortcut-theme-default', 'true');
  shortcutTile.style.setProperty('--x-nt-shortcut-icon-bg', 'rgb(220 233 253)');
  disabledTarget.setAttribute('data-wallpaper-ink', 'light');
  disabledTarget.setAttribute('data-wallpaper-icon-bg', 'true');
  disabledTarget.style.setProperty('--x-nt-wallpaper-icon-solid-bg', 'rgb(20 28 45)');
  const pixel = { red: 17, green: 85, blue: 101 };
  const canvas = {
    width: 0,
    height: 0,
    getContext() {
      return {
        drawImage() {},
        getImageData() {
          const length = Math.max(1, canvas.width * canvas.height) * 4;
          const data = new Uint8ClampedArray(length);
          for (let index = 0; index < length; index += 4) {
            data[index] = pixel.red;
            data[index + 1] = pixel.green;
            data[index + 2] = pixel.blue;
            data[index + 3] = 255;
          }
          return { data };
        }
      };
    }
  };
  const body = createToneElement();
  body.setAttribute('data-wallpaper-active', 'true');
  const documentObj = {
    body,
    documentElement: {
      clientWidth: 1000,
      clientHeight: 600
    },
    createElement(tagName) {
      return String(tagName).toLowerCase() === 'canvas'
        ? canvas
        : createToneElement();
    }
  };
  const windowObj = {
    innerWidth: 1000,
    innerHeight: 600,
    requestAnimationFrame(callback) {
      callback();
      return 1;
    },
    cancelAnimationFrame() {}
  };
  class FakeImage {
    constructor() {
      this.width = 10;
      this.height = 10;
      this.naturalWidth = 10;
      this.naturalHeight = 10;
      this.onload = null;
      this.onerror = null;
    }
    set src(value) {
      this._src = value;
      if (typeof this.onload === 'function') {
        this.onload();
      }
    }
    get src() {
      return this._src;
    }
    decode() {
      return Promise.resolve();
    }
  }
  const sandbox = {
    console,
    Image: FakeImage,
    Uint8ClampedArray,
    setTimeout,
    clearTimeout
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(wallpaperAdaptiveToneJs, sandbox);
  const runtime = sandbox.LumnoNewtabWallpaperAdaptiveTone.createWallpaperAdaptiveTone({
    documentObj,
    windowObj,
    getTargets() {
      return [
        {
          element: wordmark,
          sampleElement: wordmark,
          minWidth: 220,
          minHeight: 72
        },
        {
          element: shortcutTile,
          sampleElement: shortcutTile,
          minWidth: 42,
          minHeight: 42,
          iconButton: true,
          forcedIconBackground: 'shortcut-fallback'
        },
        {
          element: addTile,
          sampleElement: addTile,
          minWidth: 42,
          minHeight: 42,
          iconButton: true,
          forcedIconBackground: 'shortcut-add'
        },
        {
          element: disabledTarget,
          sampleElement: disabledTarget,
          minWidth: 42,
          minHeight: 42,
          iconButton: true,
          disabled: true
        }
      ];
    },
    getCurrentWallpaper() {
      return { id: 'dark-test-wallpaper' };
    },
    getWallpaperImageUrl() {
      return 'test://dark-wallpaper';
    },
    getOverlayAlphaAtViewportY() {
      return 0;
    },
    getOverlayLuminance() {
      return 0;
    },
    getEffectLuminanceAtViewport() {
      return null;
    },
    applyWordmarkThemeAppearance() {}
  });

  runtime.refresh();
  await new Promise((resolve) => setTimeout(resolve, 5));

  const wordmarkColor = parseSolidRgb(
    wordmark.style.getPropertyValue('--x-nt-wallpaper-wordmark-ink')
  );
  const addBackground = parseSolidRgb(addTile.style.getPropertyValue('--x-nt-shortcut-add-bg'));
  const addForeground = parseSolidRgb(addTile.style.getPropertyValue('--x-nt-shortcut-add-color'));
  assert.strictEqual(disabledTarget.getAttribute('data-wallpaper-ink'), null);
  assert.strictEqual(disabledTarget.getAttribute('data-wallpaper-icon-bg'), null);
  assert.strictEqual(
    disabledTarget.style.getPropertyValue('--x-nt-wallpaper-icon-solid-bg'),
    ''
  );

  assert.ok(
    getTestContrastRatio(wordmarkColor, pixel) >= 3.25,
    'wallpaper wordmark should keep accessible contrast on a similarly colored dark background'
  );
  assert.strictEqual(
    shortcutTile.style.getPropertyValue('--x-nt-shortcut-wallpaper-icon-bg'),
    '',
    'dark wallpapers should not override a favicon theme background'
  );
  assert.ok(
    getTestColorLuminance(addBackground) < 0.42,
    'dark wallpaper add shortcut background should stay dark instead of becoming white'
  );
  assert.strictEqual(
    shortcutTile.style.getPropertyValue('--x-nt-shortcut-icon-bg'),
    'rgb(220 233 253)',
    'dark wallpapers should preserve the favicon light-theme background'
  );
  assert.ok(
    getTestColorLuminance(addForeground) > 0.72,
    'dark wallpaper add shortcut icon should remain light on the dark surface'
  );
  const fallbackBackground = parseSolidRgb(shortcutTile.style.getPropertyValue('--x-nt-shortcut-fallback-icon-bg'));
  const fallbackForeground = parseSolidRgb(shortcutTile.style.getPropertyValue('--x-nt-shortcut-fallback-icon-color'));
  assert.ok(getTestColorLuminance(fallbackBackground) < 0.42, 'unavailable icons and folders should retain a visible dark-wallpaper surface');
  assert.ok(getTestContrastRatio(fallbackBackground, fallbackForeground) >= 4.5, 'fallback icons should remain readable on that surface');
  runtime.clear();
  assert.strictEqual(shortcutTile.style.getPropertyValue('--x-nt-shortcut-fallback-icon-bg'), '', 'removing wallpaper should restore the static fallback surface');
}

async function assertDarkThemeKeepsShortcutThemeBackground() {
  const wordmark = createToneElement({
    left: 390,
    top: 54,
    right: 610,
    bottom: 126,
    width: 220,
    height: 72
  });
  const shortcutTile = createToneElement();
  const addTile = createToneElement();
  shortcutTile.setAttribute('data-shortcut-theme-default', 'true');
  shortcutTile.style.setProperty('--x-nt-shortcut-icon-bg', 'rgb(33 52 85)');
  const pixel = { red: 238, green: 242, blue: 247 };
  const canvas = {
    width: 0,
    height: 0,
    getContext() {
      return {
        drawImage() {},
        getImageData() {
          const length = Math.max(1, canvas.width * canvas.height) * 4;
          const data = new Uint8ClampedArray(length);
          for (let index = 0; index < length; index += 4) {
            data[index] = pixel.red;
            data[index + 1] = pixel.green;
            data[index + 2] = pixel.blue;
            data[index + 3] = 255;
          }
          return { data };
        }
      };
    }
  };
  const body = createToneElement();
  body.setAttribute('data-wallpaper-active', 'true');
  body.setAttribute('data-theme', 'dark');
  const documentObj = {
    body,
    documentElement: {
      clientWidth: 1000,
      clientHeight: 600
    },
    createElement(tagName) {
      return String(tagName).toLowerCase() === 'canvas'
        ? canvas
        : createToneElement();
    }
  };
  const windowObj = {
    innerWidth: 1000,
    innerHeight: 600,
    requestAnimationFrame(callback) {
      callback();
      return 1;
    },
    cancelAnimationFrame() {}
  };
  class FakeImage {
    constructor() {
      this.width = 10;
      this.height = 10;
      this.naturalWidth = 10;
      this.naturalHeight = 10;
      this.onload = null;
      this.onerror = null;
    }
    set src(value) {
      this._src = value;
      if (typeof this.onload === 'function') {
        this.onload();
      }
    }
    get src() {
      return this._src;
    }
    decode() {
      return Promise.resolve();
    }
  }
  const sandbox = {
    console,
    Image: FakeImage,
    Uint8ClampedArray,
    setTimeout,
    clearTimeout
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(wallpaperAdaptiveToneJs, sandbox);
  const runtime = sandbox.LumnoNewtabWallpaperAdaptiveTone.createWallpaperAdaptiveTone({
    documentObj,
    windowObj,
    getTargets() {
      return [
        {
          element: wordmark,
          sampleElement: wordmark,
          minWidth: 220,
          minHeight: 72
        },
        {
          element: shortcutTile,
          sampleElement: shortcutTile,
          minWidth: 42,
          minHeight: 42,
          iconButton: true,
          forcedIconBackground: 'shortcut-fallback'
        },
        {
          element: addTile,
          sampleElement: addTile,
          minWidth: 42,
          minHeight: 42,
          iconButton: true,
          forcedIconBackground: 'shortcut-add'
        }
      ];
    },
    getCurrentWallpaper() {
      return { id: 'light-wallpaper-dark-theme' };
    },
    getWallpaperImageUrl() {
      return 'test://light-wallpaper-dark-theme';
    },
    getOverlayAlphaAtViewportY() {
      return 0;
    },
    getOverlayLuminance() {
      return 1;
    },
    getEffectLuminanceAtViewport() {
      return null;
    },
    applyWordmarkThemeAppearance() {}
  });

  runtime.refresh();
  await new Promise((resolve) => setTimeout(resolve, 5));

  const wordmarkColor = parseSolidRgb(
    wordmark.style.getPropertyValue('--x-nt-wallpaper-wordmark-ink')
  );
  const addBackground = parseSolidRgb(addTile.style.getPropertyValue('--x-nt-shortcut-add-bg'));
  const addForeground = parseSolidRgb(addTile.style.getPropertyValue('--x-nt-shortcut-add-color'));

  assert.ok(
    getTestContrastRatio(wordmarkColor, pixel) >= 3.25,
    'wallpaper wordmark should keep accessible contrast on a similarly colored light background'
  );
  assert.strictEqual(
    shortcutTile.style.getPropertyValue('--x-nt-shortcut-wallpaper-icon-bg'),
    '',
    'light wallpapers should not override a favicon dark-theme background'
  );
  assert.ok(
    getTestColorLuminance(addBackground) < 0.42,
    'dark theme add shortcut background should stay dark even on a light wallpaper'
  );
  assert.strictEqual(
    shortcutTile.style.getPropertyValue('--x-nt-shortcut-icon-bg'),
    'rgb(33 52 85)',
    'light wallpapers should preserve the favicon dark-theme background'
  );
  assert.ok(
    getTestColorLuminance(addForeground) > 0.72,
    'dark theme add shortcut icon should remain light on the dark surface'
  );
  const fallbackBackground = parseSolidRgb(shortcutTile.style.getPropertyValue('--x-nt-shortcut-fallback-icon-bg'));
  const fallbackForeground = parseSolidRgb(shortcutTile.style.getPropertyValue('--x-nt-shortcut-fallback-icon-color'));
  assert.ok(getTestColorLuminance(fallbackBackground) < 0.42, 'dark-theme fallback surfaces should stay dark on a light wallpaper');
  assert.ok(getTestContrastRatio(fallbackBackground, fallbackForeground) >= 4.5, 'dark-theme fallback icons should remain readable');
  runtime.clear();
  assert.strictEqual(shortcutTile.style.getPropertyValue('--x-nt-shortcut-fallback-icon-color'), '', 'clearing wallpaper should restore theme-aware fallback foregrounds');
}

assertContains(
  newtabHtml,
  '<script src="shortcuts-store.js"></script>',
  'new tab page should load the shortcuts store before newtab.js'
);

assert.ok(
  newtabHtml.indexOf('<script src="shortcuts-store.js"></script>') <
    newtabHtml.indexOf('src="../shared/react-page-bootstrap.js"'),
  'shortcuts store should load before the page bootstrap'
);

assertContains(
  newtabHtml,
  '<script src="shortcut-icon-store.js"></script>',
  'new tab page should load the local shortcut icon store'
);

assert.ok(
  newtabHtml.indexOf('<script src="shortcut-icon-store.js"></script>') <
    newtabHtml.indexOf('src="../shared/react-page-bootstrap.js"'),
  'shortcut icon processing should load before the bootstrap starts the React dialog'
);

assertContains(
  newtabHtml,
  '<script src="../shared/shortcut-favicon.js"></script>',
  'new tab page should load the dedicated high-resolution shortcut favicon cache'
);

[
  '.x-nt-shortcuts-section',
  '.x-nt-shortcut-tile',
  '.x-nt-shortcut-tile--add',
  '.x-nt-shortcut-favicon-mask',
  '.x-nt-shortcut-context-menu'
].forEach((selector) => {
  assertContains(newtabHtml, selector, `${selector} should be styled`);
});

[
  '.x-nt-shortcut-dialog',
  '.x-nt-shortcut-dialog-backdrop',
  '.x-lumno-action-button',
  '.x-lumno-action-button--primary',
  '.x-lumno-action-button--secondary'
].forEach((selector) => {
  assertContains(shortcutDialogCss, selector, `${selector} should be owned by the dialog component stylesheet`);
});

assertContains(
  shortcutDialogCss,
  'background: var(--x-nt-shortcut-dialog-bg, rgb(255 255 255 / 0.98));',
  'shortcut dialog should use a more solid floating panel surface color'
);

assert.match(
  shortcutDialogCss,
  /@supports \(corner-shape: superellipse\(1\.25\)\)\s*\{\s*\.x-nt-shortcut-dialog,[\s\S]*?\._x_extension_shortcut_input_2024_unique_\s*\{\s*corner-shape:\s*superellipse\(1\.25\);/,
  'shortcut dialogs and their fields should use continuous superellipse corners when supported'
);

assert.match(
  newtabHtml,
  /@supports \(corner-shape: superellipse\(1\.25\)\)[\s\S]*?\.x-nt-wallpaper-panel,[\s\S]*?\.x-nt-feedback-popover,[\s\S]*?\.x-nt-bookmark-cascade-level,[\s\S]*?corner-shape:\s*superellipse\(1\.25\);/,
  'New Tab floating panels and bookmark menus should use continuous superellipse corners when supported'
);

assert.match(
  optionsHtml,
  /@supports \(corner-shape: superellipse\(1\.25\)\)[\s\S]*?\._x_extension_popconfirm_2024_unique_,[\s\S]*?\._x_extension_confirm_dialog_2024_unique_[\s\S]*?corner-shape:\s*superellipse\(1\.25\);/,
  'Options popups should use continuous superellipse corners when supported'
);

const wallpaperPanelRule = getCssRuleBlock(newtabHtml, '.x-nt-wallpaper-panel');
const newtabRootRule = getCssRuleBlock(newtabHtml, ':root');
const shortcutDialogRule = getCssRuleBlock(shortcutDialogCss, '.x-nt-shortcut-dialog');
const settingsPanelRule = getCssRuleBlock(optionsHtml, '#_x_extension_settings_panel_2024_unique_');
[
  'border-radius',
  'box-shadow'
].forEach((property) => {
  assert.strictEqual(
    getCssDeclaration(shortcutDialogRule, property),
    getCssDeclaration(wallpaperPanelRule, property),
    `shortcut dialog ${property} should match the bottom-right floating panel`
  );
});

[
  '--input-focus-color',
  '--input-focus-shadow',
  '--input-placeholder',
  '--input-focus-bg'
].forEach((property) => {
  assert.strictEqual(
    getCssDeclaration(newtabRootRule, property),
    getCssDeclaration(settingsPanelRule, property),
    `New Tab ${property} should keep shared inputs aligned with Options`
  );
});

assert.strictEqual(
  getCssDeclaration(shortcutDialogRule, 'border'),
  'border: 0;',
  'shortcut dialog should preserve the current borderless floating surface'
);

[
  '--input-focus-color',
  '--input-focus-shadow',
  '--input-placeholder',
  '--input-focus-bg',
  '--control-bg',
  '--tab-border'
].forEach((property) => {
  assert.strictEqual(
    getCssDeclaration(shortcutDialogRule, property),
    getCssDeclaration(settingsPanelRule, property),
    `shortcut dialog ${property} should match options input tokens`
  );
});

assertContains(
  shortcutDialogCss,
  'transform: translateX(var(--x-nt-shortcut-dialog-enter-x, 0px)) scale(0.98);',
  'shortcut dialog should keep its trigger-aware horizontal entry direction'
);

assertContains(
  shortcutDialogCss,
  '._x_extension_shortcut_input_2024_unique_',
  'shortcut dialog inputs should reuse the settings text input component class'
);

const optionsAffixRule = getCssRuleBlock(optionsHtml, '._x_extension_shortcut_input_affix_2026_unique_');
const newtabAffixRule = getCssRuleBlock(shortcutDialogCss, '.x-nt-shortcut-dialog ._x_extension_shortcut_input_affix_2026_unique_');
[
  'display',
  'align-items',
  'gap',
  'border-radius',
  'border',
  'background',
  'transition',
  'overflow'
].forEach((property) => {
  assert.strictEqual(
    getCssDeclaration(newtabAffixRule, property),
    getCssDeclaration(optionsAffixRule, property),
    `shortcut dialog input affix ${property} should match options`
  );
});

const optionsAffixInputRule = getCssRuleBlock(
  optionsHtml,
  '._x_extension_shortcut_input_affix_2026_unique_ ._x_extension_shortcut_input_2024_unique_'
);
const newtabAffixInputRule = getCssRuleBlock(
  shortcutDialogCss,
  '.x-nt-shortcut-dialog ._x_extension_shortcut_input_affix_2026_unique_ ._x_extension_shortcut_input_2024_unique_'
);
[
  'border',
  'background',
  'border-radius',
  'padding-left',
  'flex',
  'min-width'
].forEach((property) => {
  assert.strictEqual(
    getCssDeclaration(newtabAffixInputRule, property),
    getCssDeclaration(optionsAffixInputRule, property),
    `shortcut dialog nested input ${property} should match options`
  );
});

assertContains(
  shortcutDialogCss,
  '.x-nt-shortcut-dialog-backdrop[data-open="true"] .x-nt-shortcut-dialog',
  'shortcut dialog should animate into its open state'
);

assert.strictEqual(
  getCssDeclaration(
    getCssRuleBlock(shortcutDialogCss, '.x-nt-shortcut-dialog-backdrop'),
    'pointer-events'
  ),
  'pointer-events: auto;',
  'shortcut dialog backdrop should block the page throughout its opening and closing lifecycle'
);

assertContains(
  shortcutDialogCss,
  '.x-nt-shortcut-dialog-backdrop[data-preparing="true"] .x-nt-shortcut-dialog',
  'shortcut dialog should disable transitions while its trigger-aware start position is prepared'
);

assertContains(
  shortcutDialogCss,
  '@media (prefers-reduced-motion: reduce)',
  'shortcut dialog motion should respect reduced-motion preferences'
);

assertContains(
  newtabHtml,
  '--x-nt-shortcuts-reserved-height: 82px;',
  'shortcut rail should define a compact stable reserved height before stored shortcuts load'
);

assertContains(
  newtabHtml,
  'min-height: var(--x-nt-shortcuts-reserved-height, 82px);',
  'shortcut rail should reserve its final row height to avoid moving the search box'
);

assertContains(
  newtabHtml,
  'body:not([data-nt-ready="1"]) .x-nt-shortcuts-section',
  'shortcut rail should stay hidden until stored shortcuts are rendered'
);

assertContains(
  wallpaperViewSource,
  'name="shortcutsToggle"',
  'New Tab appearance should include a shortcuts visibility toggle'
);

assertContains(
  wallpaperViewSource,
  'triggerRef="shortcutsAccordionTrigger"',
  'New Tab shortcuts should expose an accordion trigger'
);

assertContains(
  wallpaperViewSource,
  'aria-expanded="false"',
  'New Tab shortcuts accordion should start collapsed'
);

assertContains(
  wallpaperViewSource,
  "ref('shortcutsDetails')",
  'New Tab shortcuts should expose an accordion details region'
);

assertContains(
  wallpaperViewSource,
  'role="region"',
  'New Tab shortcuts accordion details should be announced as a region'
);

assertContains(
  wallpaperViewSource,
  'name="shortcutAddToggle"',
  'New Tab shortcuts should include the nested add shortcut visibility toggle'
);

assertContains(
  wallpaperViewSource,
  'name="shortcutDockMagnificationToggle"',
  'New Tab shortcuts should include the nested Dock magnification toggle'
);

assertContains(
  wallpaperViewSource,
  "ref('shortcutColumnsSlider')",
  'New Tab shortcuts should expose a per-row shortcut slider'
);

assertContains(
  wallpaperViewSource,
  "ref('shortcutColumnsSliderValueInput')",
  'New Tab shortcuts should expose an editable numeric slider value'
);

assertContains(
  wallpaperViewSource,
  "label: '8', percent: 100 / 3",
  'New Tab shortcuts should render the 4-step slider ticks'
);

assertContains(
  wallpaperSource,
  'function updateWallpaperShortcutsUi()',
  'wallpaper runtime should centralize shortcut appearance control updates'
);

assertContains(
  wallpaperSource,
  'function setWallpaperShortcutsAccordionExpanded',
  'wallpaper runtime should own shortcut accordion expansion state'
);

assertContains(
  wallpaperSource,
  'wallpaperShortcutsAccordionTrigger.disabled = !enabled',
  'shortcut accordion should be disabled when shortcuts are turned off'
);

assertContains(
  optionsHtml,
  '_x_extension_newtab_shortcuts_toggle_2026_unique_',
  'Options should keep the New Tab shortcuts visibility control'
);

assertContains(
  optionsHtml,
  '_x_extension_newtab_shortcut_add_toggle_2026_unique_',
  'Options should keep the add shortcut visibility control'
);

assertContains(
  optionsHtml,
  '_x_extension_newtab_shortcut_dock_magnification_toggle_2026_unique_',
  'Options should keep the shortcut Dock magnification control'
);

assertContains(
  newtabHtml,
  '.x-nt-shortcuts-accordion-details[hidden]',
  'collapsed shortcut details should override the authored display declaration'
);

assertContains(
  newtabHtml,
  'gap: var(--x-nt-panel-item-gap);',
  'shortcut details should inherit the appearance panel global item gap'
);

assertContains(
  newtabJs,
  "const NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY = '_x_extension_newtab_shortcuts_visible_2026_unique_';",
  'newtab runtime should read a dedicated shortcuts visibility setting'
);

assertContains(
  newtabJs,
  "const NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY = '_x_extension_newtab_shortcut_add_visible_2026_unique_';",
  'newtab runtime should read a dedicated add shortcut visibility setting'
);

assertContains(
  newtabJs,
  "const NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY = '_x_extension_newtab_shortcut_dock_magnification_enabled_2026_unique_';",
  'newtab runtime should read a dedicated shortcut Dock magnification setting'
);

assertContains(
  newtabJs,
  'function applyNewtabShortcutsVisibility()',
  'newtab runtime should centralize shortcut section visibility updates'
);

assertContains(
  newtabJs,
  'Boolean(newtabShortcutsVisible && hasVisibleContent)',
  'newtab runtime should hide the shortcut rail when its setting is off or it has no visible content'
);

assertContains(
  newtabHtml,
  '--x-nt-shortcut-user-tile-size: 64px;',
  'shortcut tiles should define a compact dock-sized hit target'
);

assertContains(
  newtabHtml,
  '--x-nt-shortcut-user-icon-size: 48px;',
  'shortcut icons should start smaller before dock magnification'
);

assertContains(
  newtabHtml,
  '--x-nt-shortcut-user-favicon-size: 28px;',
  'shortcut favicons should scale down with the compact icon size'
);

assertContains(
  newtabHtml,
  '--x-nt-shortcut-dock-duration: 300ms;',
  'shortcut dock hover should use a slower follow-through duration'
);

assertContains(
  newtabHtml,
  '--x-nt-shortcut-dock-ease: cubic-bezier(0.22, 1, 0.36, 1);',
  'shortcut dock hover should use a smooth ease-out curve'
);

assertContains(
  newtabHtml,
  '--x-nt-shortcut-user-icon-radius: 16px;',
  'shortcut icons should define a smooth rounded-rectangle radius'
);

assertContains(
  newtabHtml,
  '--x-nt-shortcut-favicon-radius: max(',
  'shortcut favicon mask radius should be derived from the outer icon inset'
);

assertContains(
  newtabHtml,
  '--x-nt-shortcut-smooth-mask-outer: url("data:image/svg+xml,',
  'shortcut icons should define an SVG smooth-corner mask'
);

assertContains(
  newtabHtml,
  '--x-nt-shortcut-smooth-mask-inner: url("data:image/svg+xml,',
  'shortcut favicon masks should define their own nested smooth-corner mask'
);

const shortcutIconRule = getCssRuleBlock(newtabHtml, '.x-nt-shortcut-icon');
assertContains(
  shortcutIconRule,
  'border-radius: var(--x-nt-shortcut-icon-radius, 16px);',
  'shortcut icons should use the smooth rounded-rectangle radius'
);

assertContains(
  shortcutIconRule,
  'width: var(--x-nt-shortcut-icon-size, 48px);',
  'shortcut icons should use the compact dock base size'
);

assertContains(
  shortcutIconRule,
  'transform: translate3d(',
  'shortcut icons should animate through transform for dock magnification'
);

assertContains(
  shortcutIconRule,
  'transition:',
  'shortcut icons should transition dock magnification'
);

assertContains(
  shortcutIconRule,
  'will-change: auto;',
  'shortcut icons should avoid permanent compositor promotion while idle'
);

assertContains(
  newtabHtml,
  '.x-nt-shortcut-tile[data-dock-distance] .x-nt-shortcut-icon',
  'shortcut icons should enable transform pre-promotion only while dock hover is active'
);

assertContains(
  shortcutIconRule,
  'background: var(--x-nt-shortcut-wallpaper-icon-bg, var(--x-nt-shortcut-icon-bg, rgba(241, 245, 249, 0.9)));',
  'shortcut icons should prefer a wallpaper-adaptive background before falling back to the per-site theme background'
);

assertContains(
  shortcutIconRule,
  'border: 0;',
  'shortcut icons should not render a border stroke'
);

assertContains(
  shortcutIconRule,
  'box-shadow: none;',
  'shortcut icons should not render a drop shadow'
);

assertContains(
  shortcutIconRule,
  '-webkit-mask-image: var(--x-nt-shortcut-smooth-mask-outer);',
  'shortcut icons should use the continuous-corner mask in Chromium'
);

assertContains(
  shortcutIconRule,
  'mask-image: var(--x-nt-shortcut-smooth-mask-outer);',
  'shortcut icons should use the continuous-corner mask as the standard path'
);

assertNotContains(
  shortcutIconRule,
  'border-radius: 50%;',
  'shortcut icons should no longer render as circles'
);

const shortcutAddIconRule = getCssRuleBlock(newtabHtml, '.x-nt-shortcut-icon--add');
assertContains(
  shortcutAddIconRule,
  'background: var(--x-nt-shortcut-add-bg, rgba(248, 250, 252, 0.92));',
  'add shortcut icon should use a softer version of the URL fallback background'
);

const darkShortcutAddIconRule = getCssRuleBlock(newtabHtml, 'body[data-theme="dark"] .x-nt-shortcut-icon--add');
assertContains(
  darkShortcutAddIconRule,
  'background: var(--x-nt-shortcut-add-bg, rgba(255, 255, 255, 0.13));',
  'dark add shortcut icon should stay slightly lighter than the URL fallback background'
);

const shortcutGridRule = getCssRuleBlock(newtabHtml, '.x-nt-shortcuts-grid');
assertContains(
  shortcutGridRule,
  'display: flex;',
  'shortcut rail should use a wrapping row constrained by the selected count'
);

assertContains(
  shortcutGridRule,
  'flex-wrap: wrap;',
  'shortcut rail should wrap by the selected per-row count while adapting on narrow screens'
);

assertContains(
  shortcutGridRule,
  'justify-content: center;',
  'shortcut rail should center incomplete rows'
);

assertContains(
  shortcutGridRule,
  'align-items: flex-end;',
  'shortcut rail should align magnified icons from the bottom like a dock'
);

assertContains(
  shortcutGridRule,
  'gap: var(--x-nt-shortcuts-grid-row-gap, 10px) var(--x-nt-shortcuts-grid-column-gap, 4px);',
  'shortcut rail should keep icons slightly closer together through adaptive tokens'
);

assertContains(
  newtabHtml,
  '--x-nt-shortcut-user-row-gap: 10px;',
  'shortcut rail should define its default row gap token'
);

assertContains(
  newtabHtml,
  '--x-nt-shortcut-user-column-gap: 4px;',
  'shortcut rail should define its default column gap token'
);

assertContains(
  newtabHtml,
  '.x-nt-shortcut-tile[data-dock-distance="0"] .x-nt-shortcut-icon',
  'shortcut dock should define a hovered icon scale'
);

const shortcutNearHoverRule = getCssRuleBlock(
  newtabHtml,
  '.x-nt-shortcut-tile[data-dock-distance="0"] .x-nt-shortcut-icon'
);
assertContains(
  shortcutNearHoverRule,
  '--x-nt-shortcut-dock-scale: var(--x-nt-shortcut-hover-scale-near, 1.28);',
  'shortcut dock should magnify the hovered icon without overshooting'
);

assertContains(
  shortcutNearHoverRule,
  '--x-nt-shortcut-dock-rise: var(--x-nt-shortcut-hover-rise-near, -6px);',
  'shortcut dock should keep vertical lift restrained'
);

assertContains(
  newtabHtml,
  '--x-nt-shortcut-hover-scale-near: 1.28;',
  'shortcut dock should define the default hovered icon scale token'
);

assertContains(
  newtabHtml,
  '--x-nt-shortcut-hover-rise-near: -6px;',
  'shortcut dock should define the default hovered icon lift token'
);

assertContains(
  newtabHtml,
  '.x-nt-shortcut-tile[data-dock-side="before"][data-dock-distance="1"] .x-nt-shortcut-icon',
  'shortcut dock should move previous neighbors away from the hover target'
);

assertContains(
  newtabHtml,
  '.x-nt-shortcut-tile[data-dock-side="after"][data-dock-distance="1"] .x-nt-shortcut-icon',
  'shortcut dock should move next neighbors away from the hover target'
);

const shortcutDockDisabledIconRule = getCssRuleBlock(
  newtabHtml,
  '.x-nt-shortcuts-grid[data-dock-magnification="false"] .x-nt-shortcut-tile .x-nt-shortcut-icon'
);
assertContains(
  shortcutDockDisabledIconRule,
  '--x-nt-shortcut-dock-scale: 1;',
  'disabled shortcut Dock magnification should keep icon scale at its base size'
);
assertContains(
  shortcutDockDisabledIconRule,
  '--x-nt-shortcut-dock-shift-x: 0px;',
  'disabled shortcut Dock magnification should remove horizontal neighbor movement'
);
assertContains(
  shortcutDockDisabledIconRule,
  '--x-nt-shortcut-dock-rise: 0px;',
  'disabled shortcut Dock magnification should remove vertical icon lift'
);
assertContains(
  newtabHtml,
  '.x-nt-shortcuts-grid[data-dock-magnification="false"] .x-nt-shortcut-tile:not([data-shortcut-dragging="true"]):not([data-shortcut-dropping="true"]):not([data-shortcut-context-menu-open="true"]):hover .x-nt-shortcut-icon',
  'disabled shortcut Dock magnification should limit hover feedback to the hovered icon'
);
assertContains(
  newtabHtml,
  'filter: brightness(0.96);',
  'disabled shortcut Dock magnification should gently darken the hovered icon in the light theme'
);
assertContains(
  newtabHtml,
  'filter: brightness(1.06);',
  'disabled shortcut Dock magnification should gently lighten the hovered icon in the dark theme'
);

assertContains(
  newtabHtml,
  '@media (prefers-reduced-motion: reduce)',
  'shortcut dock motion should respect reduced-motion preferences'
);

const shortcutFaviconMaskRule = getCssRuleBlock(newtabHtml, '.x-nt-shortcut-favicon-mask');
assertContains(
  shortcutFaviconMaskRule,
  'width: var(--x-nt-shortcut-favicon-size, 28px);',
  'shortcut favicon mask should use the compact dock favicon size'
);

assertContains(
  shortcutFaviconMaskRule,
  'border-radius: var(--x-nt-shortcut-favicon-radius, 8px);',
  'shortcut favicon mask should use the nested rounded-rectangle radius'
);

assertContains(
  shortcutFaviconMaskRule,
  'overflow: hidden;',
  'shortcut favicon mask should clip favicon corners'
);

assertNotContains(
  shortcutFaviconMaskRule,
  'background:',
  'shortcut favicon mask should only clip the favicon and not add a background surface'
);

assertContains(
  shortcutFaviconMaskRule,
  '-webkit-mask-image: var(--x-nt-shortcut-smooth-mask-inner);',
  'shortcut favicon mask should use the nested continuous-corner mask in Chromium'
);

assertContains(
  shortcutFaviconMaskRule,
  'mask-image: var(--x-nt-shortcut-smooth-mask-inner);',
  'shortcut favicon mask should use the nested continuous-corner mask as the standard path'
);

const shortcutFaviconRule = getCssRuleBlock(newtabHtml, '.x-nt-shortcut-favicon');
assertContains(
  shortcutFaviconRule,
  'border-radius: inherit;',
  'shortcut favicon image should inherit the inner mask corner radius'
);

assertContains(
  shortcutFaviconRule,
  '-webkit-user-drag: none;',
  'shortcut favicon images should not start a native image drag'
);

assertContains(
  newtabHtml,
  '.x-nt-shortcut-icon:has(.x-nt-shortcut-favicon[data-fallback-icon="true"])',
  'shortcut fallback icons should explicitly control the outer icon surface'
);

assertContains(
  newtabHtml,
  '.x-nt-shortcut-icon:has(.x-nt-favicon-fallback[data-visible="true"])',
  'visible shortcut fallback nodes should select the shared fallback surface'
);

const shortcutFallbackSurfaceRule = getCssRuleBlock(
  newtabHtml,
  '.x-nt-shortcut-icon:has(.x-nt-shortcut-favicon[data-fallback-icon="true"]),\n      .x-nt-shortcut-icon:has(.x-nt-shortcut-favicon[data-favicon-placeholder="true"]),\n      .x-nt-shortcut-icon:has(.x-nt-favicon-fallback[data-visible="true"])'
);
assertContains(
  shortcutFallbackSurfaceRule,
  '--x-nt-shortcut-icon-bg: var(--x-nt-shortcut-fallback-icon-bg);',
  'unavailable shortcut artwork should keep the shared fallback background'
);
assert.ok(
  !shortcutFallbackSurfaceRule.includes('.x-nt-shortcut-icon--folder') &&
    !newtabHtml.includes('.x-nt-shortcut-icon--folder,\n      .x-nt-shortcut-icon:has('),
  'folder shortcuts should not follow the wallpaper-sampled fallback surface'
);
assertContains(
  getCssRuleBlock(newtabHtml, '.x-nt-shortcut-icon--folder'),
  '--x-nt-shortcut-icon-bg: var(--x-nt-shortcut-folder-icon-bg);',
  'folder shortcuts should use the neutral site-tile background'
);

assertContains(
  newtabJs,
  'const NEWTAB_SHORTCUTS_STORE = globalThis.LumnoNewtabShortcutsStore;',
  'newtab runtime should read the shortcuts store'
);

assertContains(
  newtabJs,
  'onUnavailable: context && context.onIconUnavailable',
  'search-scope provider favicons should hand terminal failures back to the menu glyph'
);

assertContains(
  newtabJs,
  'const primaryUrl = isFaviconProxyUrl(iconUrl)',
  'explicit provider favicons should be tried before generic browser proxy placeholders'
);

assertContains(
  newtabJs,
  'const NEWTAB_SHORTCUTS_STORAGE_KEYS = NEWTAB_SHORTCUTS_STORE.SHORTCUT_STORAGE_KEYS;',
  'newtab runtime should watch the grouped and legacy shortcut storage keys'
);

assertContains(
  newtabJs,
  'const NEWTAB_SHORTCUTS_LOCAL_OVERFLOW_STORAGE_KEY = NEWTAB_SHORTCUTS_STORE.SHORTCUTS_LOCAL_OVERFLOW_KEY;',
  'shortcut items outside the protected sync budget should have a device-local overflow store'
);

assert.match(
  getFunctionSource(newtabJs, 'getShortcutSyncBudget'),
  /getStorageBytesInUse\(syncArea, null\)[\s\S]*?getStorageBytesInUse\(syncArea, NEWTAB_SHORTCUTS_STORE\.SHORTCUTS_SYNC_KEYS\)[\s\S]*?getStorageBytesInUse\(syncArea, NEWTAB_SHORTCUTS_STORE\.LEGACY_SHORTCUTS_CHUNK_KEYS\)[\s\S]*?NEWTAB_SHORTCUTS_CRITICAL_SYNC_RESERVE_BYTES/,
  'shortcut sync planning should reserve total quota for critical settings'
);

assertContains(
  newtabJs,
  'NEWTAB_SHORTCUTS_STORAGE_KEYS',
  'newtab runtime should include shortcuts in storage handling'
);

assert.strictEqual(
  (newtabJs.match(/changes\[NEWTAB_SHORTCUT_ICONS_STORAGE_KEY\]\.newValue/g) || []).length,
  1,
  'one shortcut icon storage change should trigger exactly one normalization and render path'
);

assertContains(
  pageStructureReact,
  "_x_extension_newtab_shortcuts_2026_unique_",
  'React should create a shortcuts section under the search box'
);

assertContains(
  newtabJs,
  'shortcutSection = pageStructureRuntime.shortcut.section;',
  'newtab adapter should use the React-owned shortcuts section'
);

assertContains(
  shortcutsReact,
  'className="x-nt-shortcut-tile x-nt-shortcut-tile--add"',
  'the React shortcuts view should render a Chrome-like add shortcut tile'
);

assertContains(
  newtabJs,
  'const MAX_NEWTAB_SHORTCUTS = NEWTAB_SHORTCUTS_STORE.DEFAULT_MAX_SHORTCUTS;',
  'newtab should allow as many shortcuts as the shortcut store keeps'
);

assertContains(
  newtabJs,
  'maxShortcuts: MAX_NEWTAB_SHORTCUTS,',
  'the React shortcuts view should receive the same capacity as shortcut persistence'
);

assertContains(
  shortcutsReact,
  'hidden={!options.getAddVisible() || items.length >= options.maxShortcuts || lastGroupEmpty}',
  'the add tile should respect the preference and shortcut capacity, and give way to an empty last group'
);

assertContains(
  shortcutsReact,
  'onContextMenu={(event) => {',
  'the add tile should keep the browser menu away from its right click'
);

assertContains(
  newtabJs,
  'onAdd: openShortcutAddContextMenu,',
  'a click on the add tile should ask whether to add a site or a group, or to hide the tile'
);

assertContains(
  newtabJs,
  'onAddContextMenu: () => {},',
  'the add tile should have no right-click menu'
);

assertContains(
  getFunctionSource(newtabJs, 'openShortcutAddContextMenu'),
  "kind: 'add'",
  'the add tile should be represented as an add-menu target instead of hiding immediately'
);

assertContains(
  getFunctionSource(newtabJs, 'handleShortcutContextMenuAction'),
  'hideShortcutAddFromContextMenu(sourceElement);',
  'the add tile should hide only after the menu action is selected'
);

assertContains(
  newtabJs,
  "'newtab_shortcuts_add_hidden'",
  'right-click hiding the add tile should explain where it can be restored'
);

assert.match(
  getFunctionSource(newtabJs, 'renderShortcuts'),
  /shortcutsView\.render\(items, \{[\s\S]*?\}\);[\s\S]*?updateBookmarkSectionPosition\(\{[\s\S]*?preserveSearchEntryLayout:\s*Boolean\([\s\S]*?data-nt-ready/,
  'settled shortcut rendering should refresh the dock without moving the logo/search entry'
);

assert.match(
  getFunctionSource(newtabJs, 'hideShortcutAddFromContextMenu'),
  /updateBookmarkSectionPosition\(\{\s*preserveSearchEntryLayout:\s*true\s*\}\);[\s\S]*?showToast\(/,
  'hiding the add tile should preserve the logo/search position while its toast appears'
);

assert.match(
  getFunctionSource(newtabJs, 'updateBookmarkSectionPosition'),
  /preserveSearchEntryLayout:\s*Boolean\(layoutOptions\.preserveSearchEntryLayout\)\s*\|\|[\s\S]*?shouldPreserveSearchEntryLayout\(\)/,
  'callers should be able to preserve the settled search entry during a dock refresh'
);

assertNotContains(
  getFunctionSource(newtabJs, 'saveNewShortcutFromDialog'),
  '.slice(-MAX_NEWTAB_SHORTCUTS)',
  'adding a shortcut must not silently evict the leftmost shortcut'
);

assertContains(
  newtabJs,
  'function setShortcutDockHover(activeTile, pointerX) {',
  'newtab runtime should calculate shortcut dock hover states'
);

const setShortcutDockHoverSource = getFunctionSource(newtabJs, 'setShortcutDockHover');
assertContains(
  setShortcutDockHoverSource,
  'if (!newtabShortcutDockMagnificationEnabled)',
  'shortcut hover should skip Dock magnification when the preference is disabled'
);
assertContains(
  setShortcutDockHoverSource,
  'clearShortcutDockMagnificationState();',
  'disabled shortcut hover should clear stale Dock attributes and inline transforms directly'
);

const applyShortcutDockMagnificationSource = getFunctionSource(
  newtabJs,
  'applyNewtabShortcutDockMagnification'
);
assertContains(
  applyShortcutDockMagnificationSource,
  "'data-dock-magnification'",
  'shortcut Dock preference should be reflected as a grid state attribute'
);

assertContains(
  shortcutsReact,
  'data-tooltip={title}',
  'React shortcut tiles should expose full titles through the anchored tooltip attribute'
);

assertContains(
  shortcutsReact,
  'data-shortcut-id={shortcutId}',
  'React shortcut tiles should expose stable ids for drag reordering'
);

assertContains(
  shortcutsReact,
  'data-shortcut-draggable="true"',
  'React shortcut tiles should opt into pointer drag reordering'
);

assertContains(
  shortcutsReact,
  'onDragStart={options.onNativeDragStart}',
  'React shortcut tiles should delegate native drag suppression to the behavior adapter'
);

assertContains(
  newtabJs,
  'function handleShortcutNativeDragStart(event) {',
  'shortcut drag reordering should prevent browser-native drag previews'
);

assertContains(
  shortcutsReact,
  'draggable={false}',
  'React shortcut favicon images should not be individually draggable'
);

assertContains(
  shortcutsReact,
  "data-shortcut-custom-icon={localIconDataUrl ? 'true' : undefined}",
  'React shortcut tiles should mark a locally uploaded icon before favicon fallbacks'
);

assertContains(
  shortcutsReact,
  'customIconDataUrl: localIconDataUrl',
  'React shortcut tiles should pass uploaded image data into their theme suggestion'
);

assertContains(
  getFunctionSource(newtabJs, 'getThemeForSuggestion'),
  'loadThemeFromImageSource(',
  'custom shortcut images should resolve a theme directly from their image data'
);

assertContains(
  getFunctionSource(newtabJs, 'getThemeForSuggestion'),
  "customShortcutIcon,\n        '',\n        false",
  'custom shortcut image themes should not overwrite the website host theme cache'
);

assertContains(
  getFunctionSource(newtabJs, 'isShortcutThemeDefaultForWallpaper'),
  'theme._xIsCustomShortcutIcon',
  'neutral custom-image themes should remain authoritative over wallpaper adaptive colors'
);

assertContains(
  newtabJs,
  "tile.setAttribute('data-dock-distance', String(distance));",
  'shortcut dock should mark each visible neighbor by distance from the hovered tile'
);

assertContains(
  newtabJs,
  "tile.setAttribute('data-dock-side', offset < 0 ? 'before' : offset > 0 ? 'after' : 'active');",
  'shortcut dock should mark which side of the hovered tile each neighbor occupies'
);

assertContains(
  newtabJs,
  'function applyShortcutDockPointerStyles(tile, pointerX, offset, measurement) {',
  'shortcut dock should continuously update icon transforms from the pointer position'
);

assertContains(
  newtabJs,
  'const sideMultiplier = numericOffset < 0 ? -1 : numericOffset > 0 ? 1 : 0;',
  'shortcut dock should keep the active icon horizontally anchored while neighbors move aside'
);

assertContains(
  newtabJs,
  'const landingTaper = Math.max(0, 1 - eased);',
  'shortcut dock neighbor shift should taper out as the pointer lands on that icon'
);

assertContains(
  newtabJs,
  'const shiftPx = sideMultiplier * 16 * eased * landingTaper * distanceFalloff;',
  'shortcut dock horizontal movement should stay continuous when switching active icons'
);

assertContains(
  newtabJs,
  "icon.style.setProperty('--x-nt-shortcut-dock-scale', (1 + (0.28 * eased)).toFixed(3));",
  'shortcut dock pointer tracking should write a continuous scale value'
);

assertContains(
  newtabJs,
  "icon.style.setProperty('--x-nt-shortcut-dock-rise', `${Math.round(-6 * eased)}px`);",
  'shortcut dock pointer tracking should keep vertical lift restrained'
);

assertContains(
  newtabJs,
  'function handleShortcutDragPointerDown(event) {',
  'shortcut grid should track pointer drag gestures for reordering'
);

assertContains(
  newtabJs,
  'Math.hypot(dx, dy) < SHORTCUT_DRAG_START_THRESHOLD_PX',
  'shortcut drag reordering should wait for a movement threshold so clicks still open shortcuts'
);

assertContains(
  newtabJs,
  'function getShortcutDragInsertionSlot(pointerX, pointerY) {',
  'shortcut drag reordering should use a logical insertion slot instead of animated hit areas'
);

assertContains(
  newtabJs,
  'getShortcutTileLayoutRect(tile)',
  'shortcut drag reordering should measure untransformed tile slots while neighbors animate'
);

assertContains(
  newtabJs,
  'function moveShortcutItem(shortcutId, targetIndex, targetGroupId) {',
  'shortcut drag reordering should move the in-memory shortcut into the insertion slot'
);

assertContains(
  newtabJs,
  'function moveShortcutTileElement(tile, targetIndex, slot) {',
  'shortcut drag reordering should move DOM tiles without rerendering mid-gesture'
);

assertContains(
  getFunctionSource(newtabJs, 'moveShortcutTileElement'),
  'remainingTiles[boundedIndex] || addShortcutButton || null',
  'shortcut drag reordering should keep the add tile after every URL when moving to the final slot'
);

assertContains(
  newtabJs,
  'function setShortcutDragTileTransform(state, pointerX, pointerY) {',
  'dragged shortcut tiles should follow the pointer while reordering'
);

assertContains(
  getFunctionSource(newtabJs, 'handleShortcutDragPointerMove'),
  'scheduleShortcutDragMove(shortcutDragState, pointerX, pointerY);',
  'shortcut drag pointer work should be coalesced to one layout update per frame'
);

assertContains(
  getFunctionSource(newtabJs, 'finishShortcutDrag'),
  'flushShortcutDragMove(state);',
  'shortcut drag release should apply the latest queued pointer position before persistence'
);

{
  const queuedFrames = new Map();
  let nextFrameId = 1;
  const transformCalls = [];
  const schedulerFactory = new Function(
    'window',
    'setShortcutDragTileTransform',
    'updateShortcutDragBookmarkTarget',
    'isPointOverShortcutDropSurface',
    'getShortcutDragInsertionSlot',
    'getShortcutTileInsertionIndex',
    'getShortcutTileRectMap',
    'moveShortcutItem',
    'moveShortcutTileElement',
    'animateShortcutLayoutShift',
    'getShortcutTileGroupId',
    'getShortcutById',
    'autoScrollShortcutArea',
    `let shortcutDragState = null;
    const document = { body: { removeAttribute() {} } };
    const isBookmarkTopbarMode = () => false;
    ${getFunctionSource(newtabJs, 'cancelShortcutDragMoveFrame')}
    ${getFunctionSource(newtabJs, 'applyShortcutDragMove')}
    ${getFunctionSource(newtabJs, 'flushShortcutDragMove')}
    ${getFunctionSource(newtabJs, 'scheduleShortcutDragMove')}
    return {
      flushShortcutDragMove,
      scheduleShortcutDragMove,
      setState(state) { shortcutDragState = state; }
    };`
  );
  const scheduler = schedulerFactory(
    {
      requestAnimationFrame(callback) {
        const frameId = nextFrameId++;
        queuedFrames.set(frameId, callback);
        return frameId;
      },
      cancelAnimationFrame(frameId) {
        queuedFrames.delete(frameId);
      }
    },
    (_state, pointerX, pointerY) => transformCalls.push([pointerX, pointerY]),
    () => false,
    () => true,
    () => ({ index: 0, anchorTile: null, markerPosition: 'before' }),
    () => 0,
    () => new Map(),
    () => false,
    () => false,
    () => {},
    () => '',
    () => null,
    () => false
  );
  const state = {
    hasReordered: false,
    isDragging: true,
    moveFrameId: 0,
    pendingPointerX: 0,
    pendingPointerY: 0,
    shortcutId: 'shortcut-1',
    tile: {}
  };
  scheduler.setState(state);
  for (let index = 0; index < 240; index += 1) {
    scheduler.scheduleShortcutDragMove(state, index, index + 1000);
  }
  assert.strictEqual(queuedFrames.size, 1, 'rapid shortcut pointer moves should share one frame');
  assert.deepStrictEqual(transformCalls, [], 'layout work should wait for the scheduled frame');
  const frameCallback = Array.from(queuedFrames.values())[0];
  queuedFrames.clear();
  frameCallback();
  assert.deepStrictEqual(
    transformCalls,
    [[239, 1239]],
    'the frame should apply only the latest shortcut pointer coordinates'
  );
  scheduler.scheduleShortcutDragMove(state, 70, 80);
  scheduler.scheduleShortcutDragMove(state, 90, 100);
  scheduler.flushShortcutDragMove(state);
  assert.strictEqual(queuedFrames.size, 0, 'release should cancel the queued shortcut frame');
  assert.deepStrictEqual(
    transformCalls[transformCalls.length - 1],
    [90, 100],
    'release should synchronously apply the latest queued shortcut position'
  );
}

assertContains(
  newtabJs,
  "state.tile.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`;",
  'dragged shortcut tiles should use direct transform updates for cursor tracking'
);

assertContains(
  newtabJs,
  'function animateShortcutLayoutShift(beforeRects, draggedTile) {',
  'shortcut drag reordering should animate neighboring tiles into their new slots'
);

assertContains(
  newtabJs,
  'const beforeRects = getShortcutTileRectMap();',
  'shortcut drag reordering should measure old tile positions before moving'
);

assertContains(
  newtabJs,
  'animateShortcutLayoutShift(beforeRects, state.tile);',
  'shortcut drag reordering should use FLIP animation after each insertion move'
);

assertContains(
  newtabJs,
  'function settleShortcutDragTile(tile) {',
  'dragged shortcut tiles should smoothly settle into their final slot on release'
);

assertContains(
  newtabJs,
  "tile.style.pointerEvents = 'none';",
  'dragged shortcut tiles should not block hit testing for the destination slot'
);

assertContains(
  newtabJs,
  "persistShortcuts(newtabShortcuts, '', undefined, { render: false })",
  'shortcut drag reordering should use the shared quota and local overflow persistence'
);

assertContains(
  newtabJs,
  'tile._xShortcutSuppressClick = true;',
  'shortcut drag reordering should prevent the release click from opening the dragged shortcut'
);

assertContains(
  newtabJs,
  'applyShortcutDockPointerStyles(tile, pointerX, offset, pointerMeasurements[index]);',
  'shortcut dock pointer tracking should pass each tile position so the active icon does not jump sideways'
);

const shortcutDockReadIndex = setShortcutDockHoverSource.indexOf(
  'getShortcutDockInfluence(pointerX, icon)'
);
const shortcutDockWriteIndex = setShortcutDockHoverSource.indexOf(
  "shortcutGrid.setAttribute('data-dock-active', 'true')"
);
assert.ok(
  shortcutDockReadIndex >= 0 && shortcutDockWriteIndex > shortcutDockReadIndex,
  'shortcut dock pointer tracking should batch geometry reads before DOM and style writes'
);

assert.match(
  newtabJs,
  /function handleShortcutDockPointerOver\(event\) \{[\s\S]*?scheduleShortcutDockPointerStyles\(tile, getShortcutDockPointerX\(event\)\)/,
  'shortcut dock pointer-over work should share the frame-coalesced update path'
);

assertContains(
  newtabJs,
  'function applyShortcutTileTheme(tile, theme, host) {',
  'shortcut tiles should apply favicon theme colors to the icon surface'
);

assertContains(
  newtabJs,
  "tile.style.setProperty('--x-nt-shortcut-icon-bg', colors.iconBg);",
  'shortcut tile theme should set the outer icon background color'
);

assertContains(
  newtabJs,
  "tile.setAttribute('data-shortcut-theme-default', isDefaultTheme ? 'true' : 'false');",
  'shortcut tiles should retain default-theme classification for diagnostics'
);

const applyThemeModeSource = getFunctionSource(newtabJs, 'applyThemeMode');
assertContains(
  newtabJs,
  'function refreshShortcutTileThemes() {',
  'shortcut theme refresh should live in a named helper instead of patching applyThemeMode inline'
);

assertContains(
  getFunctionSource(newtabJs, 'refreshShortcutTileThemes'),
  'shortcutTiles.forEach((tile) => {',
  'shortcut theme refresh helper should revisit existing shortcut tiles'
);

assertContains(
  getFunctionSource(newtabJs, 'refreshShortcutTileThemes'),
  "applyShortcutTileTheme(tile, tile._xTheme, tile._xHost || '');",
  'shortcut theme refresh helper should recompute icon colors from cached theme and host'
);

assertContains(
  applyThemeModeSource,
  'refreshShortcutTileThemes();',
  'theme changes should refresh shortcut colors through the named helper'
);

assertContains(
  newtabJs,
  "if (source === 'favicon') {",
  'shortcut fallback detection should handle async favicon themes separately'
);

assertContains(
  newtabJs,
  "return theme._xThemeNeutral === true ||",
  'neutral favicon themes should remain identifiable without changing their stable theme background'
);

assertNotContains(
  newtabJs,
  "forcedIconBackground: 'default-theme'",
  'favicon tiles should not receive wallpaper-forced backgrounds'
);

assertContains(
  getFunctionSource(newtabJs, 'applyShortcutTileTheme'),
  "tile.style.removeProperty('--x-nt-shortcut-wallpaper-icon-bg');",
  'favicon theme application should clear stale wallpaper background overrides'
);

assertContains(
  newtabJs,
  "forcedIconBackground: 'shortcut-add'",
  'add shortcut tile should receive a softer wallpaper-adaptive background'
);

assertContains(
  wallpaperAdaptiveToneJs,
  "setStyleProperty(element, '--x-nt-shortcut-add-bg'",
  'wallpaper adaptive tone should write the add shortcut background variable'
);

assertContains(
  wallpaperAdaptiveToneJs,
  'function getForcedShortcutSurfaceInk(ink, themeMode) {',
  'forced shortcut backgrounds should resolve theme-aware surface ink through a named helper'
);

assertContains(
  wallpaperAdaptiveToneJs,
  "return themeMode === 'dark' ? 'light' : ink;",
  'dark theme shortcut backgrounds should stay in the dark surface branch even on light wallpapers'
);

assertContains(
  wallpaperAdaptiveToneJs,
  'const urlSurfaceColor = getShortcutUrlSurfaceColor(color, luminance, forcedSurfaceInk);',
  'forced shortcut backgrounds should resolve URL fallback surface through the theme-aware ink'
);

assertContains(
  wallpaperAdaptiveToneJs,
  "documentObj.body.getAttribute('data-theme') === 'dark'",
  'wallpaper adaptive shortcut backgrounds should read the current resolved theme'
);

assertContains(
  wallpaperAdaptiveToneJs,
  'function getShortcutAddSurfaceColor(urlSurfaceColor, ink) {',
  'add shortcut backgrounds should be named as a surface derived from the URL fallback'
);

assertContains(
  wallpaperAdaptiveToneJs,
  'function getShortcutUrlBaseSurfaceColor(color, localLuminance, ink) {',
  'wallpaper adaptive tone should isolate the URL-specific ink-aware base surface algorithm'
);

assertContains(
  wallpaperAdaptiveToneJs,
  'function getShortcutUrlSurfaceColor(color, localLuminance, ink) {',
  'URL fallback backgrounds should expose a final surface helper instead of add-button wording'
);

assertContains(
  wallpaperAdaptiveToneJs,
  "if (ink === 'light') {",
  'wallpaper adaptive shortcut backgrounds should switch to dark-mode surfaces when light icon ink is required'
);

assertContains(
  wallpaperAdaptiveToneJs,
  'const paleBase = surfaceLuminance >= 0.58',
  'URL fallback backgrounds should start from a pale white-gray base'
);

assertContains(
  wallpaperAdaptiveToneJs,
  'const tintAmount = mixNumber(0.055, 0.2, hueStrength);',
  'URL fallback backgrounds should only carry a restrained amount of local hue'
);

assertContains(
  newtabJs,
  'const baseTarget = isDark ? [22, 22, 22] : [255, 255, 255];',
  'shortcut icon backgrounds should tint toward the same base target as recent cards'
);

assertContains(
  newtabJs,
  'const iconBgRgb = mixColor(accentRgb, baseTarget, isDark ? 0.72 : 0.82);',
  'shortcut icon backgrounds should use the recent-card tint ratio instead of raw accent color'
);

assertContains(
  newtabJs,
  'iconBg: rgbToCss(iconBgRgb),',
  'shortcut icon theme should expose the softened tint as the outer background'
);

assertNotContains(
  newtabJs,
  "--x-nt-shortcut-favicon-mask-bg",
  'shortcut tile theme should not set an inner favicon mask background'
);

assertContains(
  shortcutsReact,
  'url,\n    title,\n    customIconDataUrl: localIconDataUrl',
  'React shortcut tiles should resolve themes from their destination URL or uploaded icon'
);

assertContains(
  shortcutsReact,
  'options.queueThemeForTarget(',
  'React shortcut tiles should refresh when async favicon or meta theme resolution completes'
);

assertContains(
  shortcutsReact,
  'className="x-nt-shortcut-favicon-mask"',
  'React shortcut favicons should be wrapped in the rounded-rectangle mask'
);

assertContains(
  shortcutsReact,
  "() => tile.getAttribute('data-shortcut-title') || title",
  'React shortcut title tooltips should be bound even without visible labels'
);

assertContains(
  newtabJs,
  "id: '_x_extension_newtab_shortcut_tooltip_2026_unique_',",
  'shortcut title tooltips should use a dedicated anchored tooltip controller'
);

assertContains(
  newtabJs,
  "className: 'x-nt-shortcut-tooltip',",
  'shortcut title tooltips should be styleable independently from other tooltips'
);

assertContains(
  newtabJs,
  "placement: 'bottom',",
  'shortcut title tooltips should open below the icon'
);

assertContains(
  newtabJs,
  'spacing: () => (newtabShortcutDockMagnificationEnabled ? -6 : -2)',
  'shortcut title tooltips should move slightly farther from the icon when Dock magnification is disabled'
);

assertContains(
  newtabJs,
  'showOnFocus: false',
  'shortcut title tooltips should not remain visible after the pointer leaves a focused shortcut'
);

assertContains(
  newtabJs,
  'function isShortcutTooltipSuppressed() {',
  'shortcut title tooltips should expose a suppression guard for drag gestures'
);

assertContains(
  newtabJs,
  'if (isShortcutTooltipSuppressed()) {\n        return \'\';\n      }',
  'shortcut title tooltips should not open while a shortcut is being dragged'
);

assertNotContains(
  newtabJs,
  "shortcutGrid.addEventListener('focusin', handleShortcutDockFocusIn);",
  'shortcut dock magnification should not stick from keyboard or restored focus'
);

assertNotContains(
  newtabJs,
  "shortcutGrid.addEventListener('focusout', handleShortcutDockFocusOut);",
  'shortcut dock hover reset should be driven by pointer leave rather than focus retention'
);

assertNotContains(
  newtabJs,
  "bindCursorTooltip(tile, () => tile.getAttribute('data-shortcut-title') || title,",
  'shortcut tiles should no longer use cursor-following title tooltips'
);

assertNotContains(
  newtabJs,
  'label.title = title;',
  'shortcut labels should avoid native title bubbles when cursor tooltips are bound'
);

assertNotContains(
  newtabJs,
  "label.className = 'x-nt-shortcut-label';",
  'shortcut tiles should no longer render visible title labels'
);

assertNotContains(
  newtabJs,
  'function isShortcutTitleTruncated',
  'shortcut tooltip visibility should not depend on a removed visible label'
);

assertContains(
  newtabJs,
  "addShortcutButton.setAttribute('data-tooltip', addLabel);",
  'add shortcut tile should expose its label through the anchored tooltip'
);

assertContains(
  shortcutsReact,
  'options.bindTooltip(\n        addButton,',
  'the React add shortcut tile should bind the anchored shortcut tooltip'
);

assertContains(
  tooltipJs,
  "config.placement === 'bottom'",
  'shared tooltip positioning should accept bottom placement'
);

assertContains(
  tooltipJs,
  "placement === 'bottom'",
  'shared tooltip positioning should branch for bottom placement'
);

assertContains(
  tooltipJs,
  'top = targetBottom + spacing;',
  'bottom tooltip placement should start below the target'
);

assertContains(
  newtabJs,
  "shortcutGrid.addEventListener('pointerover', handleShortcutDockPointerOver);",
  'shortcut grid should update dock state on pointer hover'
);

assertContains(
  newtabJs,
  "shortcutGrid.addEventListener('pointermove', handleShortcutDockPointerMove);",
  'shortcut grid should keep dock magnification following the pointer'
);

assertContains(
  newtabJs,
  "shortcutGrid.addEventListener('pointerleave', resetShortcutDockHover);",
  'shortcut grid should reset dock state when the pointer leaves'
);

assertContains(
  newtabJs,
  "shortcutGrid.addEventListener('pointerdown', handleShortcutDragPointerDown);",
  'shortcut grid should start drag tracking from pointer down'
);

assertContains(
  getFunctionSource(newtabJs, 'handleShortcutDragPointerDown'),
  'attachShortcutDragDocumentListeners();',
  'shortcut drags should track the pointer on the document, since reordering drops pointer capture'
);

assertContains(
  getFunctionSource(newtabJs, 'attachShortcutDragDocumentListeners'),
  "document.addEventListener('pointerup', handleShortcutDragPointerUp, true);",
  'shortcut drags should finish on a document-level pointer up'
);

assertContains(
  getFunctionSource(newtabJs, 'finishShortcutDrag'),
  'detachShortcutDragDocumentListeners();',
  'shortcut drags should release their document listeners when they finish'
);

assert.ok(
  !newtabJs.includes("shortcutGrid.addEventListener('pointerup', handleShortcutDragPointerUp);"),
  'shortcut drag release must not depend on events bubbling to the grid'
);

assertContains(
  newtabHtml,
  '.x-nt-shortcut-tile[data-shortcut-draggable="true"]',
  'shortcut draggable tiles should expose a drag affordance'
);

assertContains(
  getCssRuleBlock(newtabHtml, '.x-nt-shortcuts-grid[data-shortcut-dragging="true"], .x-nt-shortcuts-grid[data-shortcut-dragging="true"] .x-nt-shortcut-tile'),
  'cursor: grabbing;',
  'shortcut drag cursor should remain grabbing over grid gaps exposed by reordering'
);

const shortcutContextMenuRule = getCssRuleBlock(newtabHtml, '.x-nt-shortcut-context-menu');
assertContains(
  shortcutContextMenuRule,
  'position: fixed;',
  'shortcut context menu anchor should use a fixed point near the right-click location'
);

assertContains(
  shortcutContextMenuRule,
  'width: 1px;',
  'shortcut context menu anchor should not add visible layout around shortcuts'
);

assertContains(
  newtabHtml,
  '.x-nt-shortcut-context-menu ._x_extension_select_trigger_2024_unique_',
  'shortcut context menu should reuse the shared custom select trigger element'
);

assertContains(
  newtabHtml,
  '.x-nt-shortcut-context-menu-portal',
  'shortcut context menu should style the shared custom select portal menu'
);

const shortcutContextMenuPortalRule = getCssRuleBlock(newtabHtml, '.x-nt-shortcut-context-menu-portal');
const readContextMenuPxToken = (token) => {
  const match = shortcutContextMenuPortalRule.match(new RegExp(`${token}: (\\d+)px;`));
  assert.ok(match, `shortcut context menu should define ${token}`);
  return Number(match[1]);
};
const contextMenuRadius = readContextMenuPxToken('--x-nt-context-menu-radius');
const contextMenuBorderWidth = readContextMenuPxToken('--x-nt-context-menu-border-width');
const contextMenuPadding = readContextMenuPxToken('--x-nt-context-menu-padding');

assert.equal(
  contextMenuRadius - contextMenuBorderWidth - contextMenuPadding,
  10,
  'context menu outer radius minus its full inset should equal the 10px option radius'
);

assertContains(
  shortcutContextMenuPortalRule,
  '--x-nt-context-menu-radius: 16px;',
  'shortcut context menu should name its outer corner radius'
);

assertContains(
  shortcutContextMenuPortalRule,
  '--x-nt-context-menu-border-width: 1px;',
  'shortcut context menu should include its border in the nested corner inset'
);

assertContains(
  shortcutContextMenuPortalRule,
  '--x-nt-context-menu-padding: 5px;',
  'shortcut context menu should name its inner padding'
);

assertContains(
  shortcutContextMenuPortalRule,
  `--x-nt-context-menu-option-radius: calc(
          var(--x-nt-context-menu-radius) -
          var(--x-nt-context-menu-border-width) -
          var(--x-nt-context-menu-padding)
        );`,
  'shortcut context menu inner radius should be derived from its outer radius and full inset'
);

assertContains(
  shortcutContextMenuPortalRule,
  'border-radius: var(--x-nt-context-menu-radius, 16px);',
  'shortcut context menu outer radius should be driven by the named radius token'
);

assertContains(
  shortcutContextMenuPortalRule,
  'padding: var(--x-nt-context-menu-padding, 5px);',
  'shortcut context menu padding should be driven by the named padding token'
);

assertContains(
  shortcutContextMenuPortalRule,
  'background: rgb(255 255 255);',
  'shortcut context menu should use a solid light background'
);

assertNotContains(
  shortcutContextMenuPortalRule,
  'backdrop-filter:',
  'shortcut context menu should not delay its first opening animation with backdrop blur'
);

assertContains(
  newtabHtml,
  'body[data-theme="dark"] .x-nt-shortcut-context-menu-portal',
  'shortcut context menu should define a dark theme background instead of inheriting the light surface'
);

const shortcutContextMenuDarkPortalRule = getCssRuleBlock(
  newtabHtml,
  'body[data-theme="dark"] .x-nt-shortcut-context-menu-portal'
);
assertContains(
  shortcutContextMenuDarkPortalRule,
  'background: rgb(31 31 31);',
  'shortcut context menu should use a solid dark background'
);

assertContains(
  newtabHtml,
  '.x-nt-shortcut-context-menu-portal ._x_extension_select_option_2024_unique_',
  'all New Tab context menu options should share a context-specific inner radius'
);

const shortcutContextMenuOptionRule = getCssRuleBlock(
  newtabHtml,
  '.x-nt-shortcut-context-menu-portal ._x_extension_select_option_2024_unique_'
);
assertContains(
  shortcutContextMenuOptionRule,
  'border-radius: var(--x-nt-context-menu-option-radius, 10px);',
  'context menu option radius should use the concentric inner radius token'
);

assert.match(
  newtabHtml,
  /@supports \(corner-shape: superellipse\(1\.25\)\)[\s\S]*?\.x-nt-shortcut-context-menu-portal,[\s\S]*?\.x-nt-shortcut-context-menu-portal \._x_extension_select_option_2024_unique_[\s\S]*?corner-shape:\s*superellipse\(1\.25\);/,
  'New Tab context menu shells and options should use continuous superellipse corners when supported'
);

[
  "menuClassName: 'x-nt-shortcut-context-menu-portal',",
  "menuClassName: 'x-nt-shortcut-context-menu-portal x-nt-bookmark-context-menu-portal',",
  "menuClassName: 'x-nt-shortcut-context-menu-portal x-nt-recent-context-menu-portal',"
].forEach((menuClassName) => {
  assertContains(
    newtabJs,
    menuClassName,
    'every New Tab context menu should inherit the shared concentric corner surface'
  );
});

assertContains(
  newtabHtml,
  '.x-nt-shortcut-tile[data-shortcut-context-menu-open="true"] .x-nt-shortcut-icon',
  'shortcut context menu should keep the selected shortcut in a persistent hover state'
);

const shortcutContextMenuOpenIconRule = getCssRuleBlock(
  newtabHtml,
  '.x-nt-shortcut-tile[data-shortcut-context-menu-open="true"] .x-nt-shortcut-icon'
);
assertContains(
  shortcutContextMenuOpenIconRule,
  'filter: brightness(',
  'shortcut context menu selected shortcut should darken slightly while the menu is open'
);

assertContains(
  newtabHtml,
  '.x-nt-shortcut-tile[data-shortcut-dragging="true"] .x-nt-shortcut-icon',
  'shortcut dragging should provide immediate visual feedback'
);

assertContains(
  newtabHtml,
  '.x-nt-shortcut-tile[data-shortcut-dropping="true"] .x-nt-shortcut-icon',
  'shortcut drop settling should keep the dragged tile visually above the row'
);

assertContains(
  newtabJs,
  'const shortcutContextMenuSelectController =',
  'shortcut context menu should resolve a reusable select-menu controller'
);

assertContains(
  newtabJs,
  'const NEWTAB_SELECT_MENU = globalThis.LumnoNewtabSelectMenu;',
  'shortcut context menu should prefer the React select-menu controller'
);

assertContains(
  newtabJs,
  'function createShortcutContextMenu() {',
  'shortcut runtime should create a shared context menu instead of per-tile menu DOM'
);

assertContains(
  newtabJs,
  'shortcutContextMenuSelectController.createSelect({',
  'shortcut context menu should be built with the shared custom select component'
);

assertContains(
  newtabJs,
  "menuClassName: 'x-nt-shortcut-context-menu-portal',",
  'shortcut context menu should render through a styleable custom select portal'
);

assertContains(
  newtabJs,
  "menuAlign: 'middle',",
  'shortcut context menu should center align like the shortcut tooltip instead of left-aligning at the pointer'
);

assertContains(
  newtabJs,
  'const SHORTCUT_CONTEXT_MENU_PORTAL_OFFSET_PX = -6;',
  'shortcut context menu should use the same vertical spacing as the shortcut tooltip'
);

assertContains(
  newtabJs,
  'trigger.tabIndex = -1;',
  'shortcut context menu hidden trigger should not add an invisible tab stop'
);

assertContains(
  newtabJs,
  "label: t('shortcuts_edit', 'Edit')",
  'shortcut context menu should include an Edit action'
);

assertContains(
  getFunctionSource(newtabJs, 'getShortcutContextMenuOptions'),
  "label: t('newtab_open_in_new_tab', 'Open in new tab')",
  'shortcut context menu should put Open in new tab first'
);

assertContains(
  getFunctionSource(newtabJs, 'getShortcutContextMenuOptions'),
  'dividerBefore: true',
  'shortcut context menu should separate opening from Edit and Remove'
);

assertContains(
  getFunctionSource(newtabJs, 'getShortcutContextMenuOptions'),
  "label: t('bookmarks_open_in_new_tab_group', 'Open in new tab group')",
  'shortcut folder context menu should offer opening the folder in a new tab group'
);

assertContains(
  getFunctionSource(newtabJs, 'handleShortcutContextMenuAction'),
  'openBookmarkFolderTabGroupConfirmation({',
  'shortcut folder tab group action should reuse the bookmark folder confirmation'
);

assertContains(
  newtabJs,
  "label: t('shortcuts_remove', 'Remove')",
  'shortcut context menu should include a Remove action'
);

assertContains(
  newtabJs,
  "label: t('newtab_shortcuts_hide_add', 'Hide')",
  'the add tile context menu should include a localized Hide action'
);

assertContains(
  newtabJs,
  'function openShortcutContextMenu(target) {',
  'shortcut runtime should open the shared context menu for its current target'
);

assertContains(
  newtabJs,
  'function getShortcutContextMenuAnchorElement(tile) {',
  'shortcut context menu should position from the shortcut icon anchor'
);

assertContains(
  newtabJs,
  'const anchor = getShortcutContextMenuAnchorElement(tile);',
  'shortcut context menu should calculate its anchor from the icon instead of the pointer'
);

assertContains(
  newtabJs,
  'shortcutContextMenu.select.value = defaultValue;',
  'shortcut context menu should select the default action for the current target'
);

assertContains(
  newtabJs,
  'function handleShortcutContextMenuActionClick(event) {',
  'shortcut context menu should handle option clicks directly so re-clicking selected Edit still works'
);

assertContains(
  newtabJs,
  'shortcutContextMenuSelectController.setOpen(shortcutContextMenu.control, true);',
  'shortcut context menu should open through the custom select controller API'
);

assertContains(
  newtabJs,
  'function handleShortcutContextMenu(event) {',
  'shortcut tiles should handle native contextmenu events'
);

assertContains(
  getFunctionSource(newtabJs, 'handleShortcutContextMenu'),
  'event.preventDefault();\n    event.stopPropagation();',
  'shortcut context menu should suppress the browser menu and keep the event away from drag handling'
);

assertContains(
  getFunctionSource(newtabJs, 'handleShortcutContextMenu'),
  'openShortcutContextMenu({',
  'shortcut context menu should open from the shortcut icon anchor instead of the right-click pointer coordinates'
);

assertNotContains(
  getFunctionSource(newtabJs, 'handleShortcutContextMenu'),
  'event.clientX, event.clientY',
  'shortcut context menu should not follow the right-click pointer coordinates'
);

assertContains(
  shortcutsReact,
  'onContextMenu={options.onContextMenu}',
  'each React shortcut tile should bind the adapter-owned right-click context menu'
);

assertContains(
  newtabJs,
  'function isShortcutContextMenuNode(node) {',
  'shortcut runtime should recognize custom select menu nodes before drag handling'
);

assertContains(
  getFunctionSource(newtabJs, 'handleShortcutDragPointerDown'),
  'isShortcutContextMenuNode(event.target)',
  'shortcut drag pointerdown should ignore the context menu control and portal'
);

assertContains(
  getFunctionSource(newtabJs, 'handleShortcutDragPointerDown'),
  'closeShortcutContextMenu();',
  'shortcut drag pointerdown should close any open context menu before starting a drag gesture'
);

assertContains(
  newtabJs,
  'function setShortcutContextMenuTileActive(target) {',
  'shortcut context menu should mark its target tile while the menu is open'
);

assertContains(
  newtabJs,
  'function clearShortcutContextMenuTileActive() {',
  'shortcut context menu should clear the persistent hover marker when it closes'
);

assertContains(
  newtabJs,
  'function syncShortcutDockHoverFromPoint(clientX, clientY) {',
  'shortcut context menu close should restore normal dock hover behavior from the pointer location'
);

assertContains(
  newtabJs,
  "document.addEventListener('pointerdown', handleShortcutContextMenuDocumentPointerDown, true);",
  'blank clicks should close the shortcut context menu through the same cleanup path'
);

assertContains(
  newtabJs,
  'function openShortcutEditor(shortcut, sourceElement) {',
  'shortcut context menu edit action should open the existing shortcut dialog in edit mode'
);

assertContains(
  newtabJs,
  'function saveEditedShortcutFromDialog(title, url, shortcutId, iconState) {',
  'shortcut dialog should have a dedicated edit save path'
);

assertContains(
  getFunctionSource(newtabJs, 'saveShortcutFromDialog'),
  'return saveEditedShortcutFromDialog(title, url, dialogState.shortcutId, iconState);',
  'shortcut dialog submit should branch cleanly between add and edit modes'
);

assertContains(
  newtabJs,
  'function removeShortcutById(shortcutId) {',
  'shortcut context menu remove action should persistently remove the target shortcut'
);

assertContains(
  newtabJs,
  'function persistShortcuts(nextShortcuts, toastMessage, iconChange, persistOptions) {',
  'shortcut edit/remove should share one normalized persistence helper'
);

assert.match(
  getFunctionSource(newtabJs, 'persistShortcuts'),
  /normalizeShortcutState\(\{[\s\S]*?groups: settings\.groups \|\| shortcutGroups[\s\S]*?persistShortcutState\(storageArea, nextState, \{[\s\S]*?overflowArea: getShortcutOverflowStorageArea\(\)[\s\S]*?maxTotalBytes: budget\.maxTotalBytes[\s\S]*?newtab_shortcuts_sync_limit_reached/,
  'shortcut persistence should keep overflow local, surface sync failures, and show the approved warning'
);

assertContains(
  newtabJs,
  'NEWTAB_SHORTCUT_DIALOG.createShortcutDialog({',
  'newtab runtime should instantiate the shortcut dialog component'
);

assertContains(
  shortcutDialogJs,
  'function setEnterDirection(',
  'shortcut dialog component should calculate its enter direction from the trigger position'
);

assertContains(
  shortcutDialogJs,
  "'--x-nt-shortcut-dialog-enter-x'",
  'shortcut dialog should write a trigger-aware x enter offset'
);

assert.ok(
  !shortcutDialogCss.includes('--x-nt-shortcut-dialog-enter-y') &&
    !shortcutDialogJs.includes("'--x-nt-shortcut-dialog-enter-y'"),
  'shortcut dialog should not derive or apply a vertical enter offset'
);

assertContains(
  shortcutDialogJs,
  "host.setAttribute('data-open', 'false');\n    host.hidden = false;",
  'shortcut dialog should start closed before animating open'
);

assertContains(
  shortcutDialogJs,
  "host.setAttribute('data-preparing', 'true');",
  'shortcut dialog should prepare its start position before transitions are enabled'
);

assertContains(
  shortcutDialogJs,
  'setEnterDirection(openOptions.sourceElement, dialog, options);',
  'shortcut dialog should set its enter direction before animating open'
);

assertContains(
  shortcutDialogJs,
  "host.removeAttribute('data-preparing');",
  'shortcut dialog should re-enable transitions before opening'
);

assertContains(
  shortcutDialogJs,
  "host.setAttribute('data-open', 'true');",
  'shortcut dialog should move into its animated open state'
);

assertContains(
  shortcutDialogJs,
  'onSubmit={handleSubmit}',
  'the React shortcut dialog should own form submission behavior'
);

assertContains(
  newtabJs,
  'shortcutIconStore.writeAll(nextIcons)',
  'newtab runtime should persist custom icons in the local-only icon store'
);

assertContains(
  newtabJs,
  'return Promise.all([loadShortcuts(), loadShortcutIcons(), loadShortcutFavicons(), loadFolderColors()]).then(() => {',
  'newtab runtime should load shortcut metadata, local icons, and cached high-resolution favicons together'
);

assertContains(
  newtabJs,
  "action: 'getShortcutFaviconData'",
  'shortcut tiles should request their dedicated high-resolution favicon upgrade'
);

assertContains(
  newtabJs,
  'SHORTCUT_FAVICON.setCachedIcon(',
  'resolved high-resolution shortcut favicons should be cached locally'
);

assert.match(
  newtabJs,
  /function loadNewtabShortcutPreferences\(\)\s*\{[\s\S]*?storageArea\.get\(\[[\s\S]*?NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY,[\s\S]*?NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY,[\s\S]*?NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY[\s\S]*?\],/,
  'newtab runtime should batch shortcut preference reads into one storage request'
);

assert.match(
  newtabJs,
  /const shortcutsReadyPromise = shortcutPreferencesReadyPromise\.then\(loadVisibleShortcuts\);/,
  'newtab runtime should start shortcut payload loading after its display preferences resolve'
);

assert.match(
  newtabJs,
  /const initialVisualReadyPromise = Promise\.all\(\[[\s\S]*?initialShortcutsReadyTask[\s\S]*?\]\)\.catch[\s\S]*?loadRecentSites\(\{[\s\S]*?force: true[\s\S]*?loadBookmarks\(\{[\s\S]*?force: true[\s\S]*?markNewtabReady\(\);/,
  'newtab ready transition should wait for shortcut and authoritative section geometry'
);

const initialVisualDependencyBlock = newtabJs.slice(
  newtabJs.indexOf('const initialVisualReadyPromise = Promise.all(['),
  newtabJs.indexOf(']).catch((error) => {',
    newtabJs.indexOf('const initialVisualReadyPromise = Promise.all(['))
);
assert.match(
  initialVisualDependencyBlock,
  /initialShortcutsReadyTask/,
  'newtab ready transition should reserve final shortcut geometry before first paint'
);

assert.doesNotMatch(
  newtabJs,
  /initialNewtabSkipsEntryMotion|hydrateSectionsFromCache/,
  'animated and motion-free new tabs should share the same stable first-paint geometry'
);

assertContains(
  shortcutDialogJs,
  'className="x-lumno-action-button x-lumno-action-button--secondary x-nt-shortcut-dialog-button x-nt-shortcut-dialog-button--secondary"',
  'the React shortcut cancel button should use the Lumno secondary button component'
);

assertContains(
  shortcutDialogJs,
  'className="x-lumno-action-button x-lumno-action-button--primary x-nt-shortcut-dialog-button x-nt-shortcut-dialog-button--primary"',
  'the React shortcut done button should use the Lumno primary button component'
);

assertContains(
  shortcutDialogJs,
  'className="_x_extension_shortcut_input_2024_unique_"',
  'React shortcut inputs should reuse the settings text input component'
);

assertContains(
  shortcutDialogJs,
  'className="_x_extension_shortcut_input_affix_2026_unique_"',
  'React shortcut inputs should use the options input affix wrapper'
);

assertContains(
  shortcutDialogJs,
  'data-has-prefix="false"',
  'React shortcut input affixes should use the no-prefix options mode'
);

const themeBootstrapIndex = newtabJs.indexOf('const initialWallpaperVisualReadyTask = Promise.all([');
assert.ok(themeBootstrapIndex > -1, 'newtab runtime should bootstrap the initial appearance');
assert.ok(
  newtabJs.indexOf('bootstrapInitialThemeMode(),', themeBootstrapIndex) > themeBootstrapIndex,
  'the initial wallpaper visual task should resolve the theme before first paint'
);
[
  'const suggestionItems = [];',
  'let selectedIndex = -1;',
  'let suggestionsView = null;',
  'let inputParts = null;'
].forEach((marker) => {
  const markerIndex = newtabJs.indexOf(marker);
  assert.ok(
    markerIndex > -1 && markerIndex < themeBootstrapIndex,
    `${marker} should be initialized before theme bootstrap reads suggestion state`
  );
});

assertContains(
  newtabJs,
  'if (!suggestionsView) {\n      return;\n    }\n    suggestionsView.updateSelection(selectedIndex);',
  'theme bootstrap should not call the suggestions view before it exists'
);

[
  'newtab_shortcuts_add',
  'newtab_shortcuts_hide_add',
  'newtab_shortcuts_add_hidden',
  'newtab_shortcuts_dialog_title',
  'newtab_shortcuts_name_label',
  'newtab_shortcuts_url_label',
  'newtab_shortcuts_icon_label',
  'newtab_shortcuts_icon_info_label',
  'newtab_shortcuts_icon_info',
  'newtab_shortcuts_icon_choose',
  'newtab_shortcuts_icon_replace',
  'newtab_shortcuts_icon_remove',
  'newtab_shortcuts_icon_unsupported',
  'newtab_shortcuts_icon_dimensions_too_large',
  'newtab_shortcuts_icon_invalid',
  'newtab_shortcuts_icon_storage_error',
  'newtab_shortcuts_cancel',
  'newtab_shortcuts_done',
  'newtab_shortcuts_save',
  'newtab_shortcuts_invalid_url',
  'newtab_shortcuts_added',
  'newtab_shortcuts_sync_limit_reached',
  'newtab_shortcuts_edited',
  'newtab_shortcuts_removed',
  'newtab_shortcuts_edit_dialog_title',
  'newtab_shortcuts_context_menu_label',
  'newtab_open_in_new_tab',
  'settings_newtab_shortcuts_title',
  'settings_newtab_shortcut_add_title',
  'settings_newtab_shortcut_dock_magnification_title',
  'shortcuts_edit',
  'shortcuts_remove'
].forEach((key) => {
  locales.forEach(({ locale, messages }) => assertMessage(locale, messages, key));
});
assert.strictEqual(
  locales.find(({ locale }) => locale === 'zh_CN')
    .messages.newtab_shortcuts_sync_limit_reached.message,
  '快捷方式超出了浏览器同步空间，新加的只保存在本机。在设置中开启 WebDAV 后可以同步到其他设备。',
  'the sync-limit toast should say where new shortcuts stay and how WebDAV syncs them'
);

Promise.all([
  assertDarkWallpaperKeepsShortcutThemeBackground(),
  assertDarkThemeKeepsShortcutThemeBackground()
]).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
