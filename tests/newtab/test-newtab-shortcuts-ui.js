const assert = require('assert');
const { readStylesheet } = require('../helpers/css-tokens');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { getPageScripts, runsBefore } = require('../helpers/runtime-scripts');
const { moduleScript } = require('../helpers/module-script');

const repoRoot = path.resolve(__dirname, '..', '..');

const { parseCss, parsePageCss } = require('../helpers/css-rules');

// The page styles, read through the CSSOM (see css-rules.js).
const newtabHtml = parsePageCss('newtab.html');
const shortcutDialogCss = parseCss(readStylesheet('src/newtab/shortcuts/shortcut-dialog.css'));
const optionsHtml = parsePageCss('src/options/options.html');

const normalize = (value) => String(value || '').replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();

// One rule's declarations, as getCssRuleBlock used to return its text:
// { selector, declarations: Map(property -> { value, priority }) }.
function getCssRuleBlock(css, selector) {
  const wanted = selector.split(/,\s*/).map((part) => normalize(part));
  const declarations = new Map();
  css.entries.filter((entry) => entry.conditions.length === 0 && wanted.every((part) => entry.selectors.includes(part)))
    .forEach((entry) => {
      Array.from(entry.style).forEach((name) => declarations.set(name, {
        value: normalize(entry.style.getPropertyValue(name)),
        priority: entry.style.getPropertyPriority(name)
      }));
    });
  assert.ok(declarations.size > 0, `${selector} rule should exist`);
  return { selector, declarations };
}

// "property: value;" as the stylesheet would write it, or '' when unset.
function getCssDeclaration(rule, property) {
  const declaration = rule.declarations.get(property);
  return declaration ? `${property}: ${declaration.value}${declaration.priority ? ' !important' : ''};` : '';
}

// Whether a stylesheet (or one rule) declares `needle`: "property: value;"
// exactly, "property: value-prefix" as a prefix, or otherwise a selector.
function cssDeclares(target, needle) {
  // A rule fragment, "selector, selector { property: value; ...".
  const fragment = String(needle).match(/^([^{]+)\{([\s\S]*)$/);
  if (fragment && !target.declarations) {
    const rule = getCssRuleBlock(target, fragment[1].trim());
    return fragment[2].split(';').map((part) => part.trim()).filter(Boolean)
      .every((declaration) => cssDeclares(rule, `${declaration};`));
  }
  // A declaration has whitespace (or nothing) after its colon; a selector's
  // pseudo-class does not.
  const match = String(needle).match(/^\s*(--?[\w-]+|[a-z-]+):(?:\s+([\s\S]*?)|())\s*(;?)\s*$/);
  const lists = target.declarations
    ? [target.declarations]
    : target.entries.map((entry) => new Map(Array.from(entry.style).map((name) => [name, {
      value: normalize(entry.style.getPropertyValue(name)),
      priority: entry.style.getPropertyPriority(name)
    }])));
  if (match && !/^[.#[:@]/.test(needle)) {
    const [, property, givenValue, , exact] = match;
    const rawValue = givenValue || '';
    const important = /\s*!important$/.test(rawValue);
    const value = normalize(rawValue.replace(/\s*!important$/, ''));
    return lists.some((declarations) => {
      const declaration = declarations.get(property);
      if (!declaration || (important && declaration.priority !== 'important')) return false;
      return exact ? declaration.value === value : declaration.value.startsWith(value);
    });
  }
  if (target.declarations) return false;
  const atRule = String(needle).match(/^@(?:media|supports)\s+([\s\S]+)$/);
  if (atRule) {
    return target.entries.some((entry) => entry.conditions.some((condition) => normalize(condition) === normalize(atRule[1])));
  }
  const selector = normalize(needle);
  return target.selectors().some((item) => item.includes(selector)) ||
    target.entries.some((entry) => entry.conditions.some((condition) => condition.includes(selector)));
}

// Every selector is given continuous corners inside an
// @supports (corner-shape: superellipse(1.25)) block.
function assertContinuousCorners(css, selectors, message) {
  selectors.forEach((selector) => {
    assert.ok(css.entries.some((entry) => entry.conditions.some((condition) => /corner-shape:\s*superellipse\(1\.25\)/.test(condition)) &&
      entry.selectors.includes(selector) && entry.style.getPropertyValue('corner-shape') === 'superellipse(1.25)'), `${message} (${selector})`);
  });
}

function assertContains(target, needle, message) {
  assert.ok(cssDeclares(target, needle), message);
}

function assertNotContains(target, needle, message) {
  assert.ok(!cssDeclares(target, needle), message);
}
const locales = ['zh_CN', 'zh_TW', 'en', 'ja'].map((locale) => ({
  locale,
  messages: JSON.parse(fs.readFileSync(path.join(repoRoot, `_locales/${locale}/messages.json`), 'utf8'))
}));

function assertMessage(locale, messages, key) {
  assert.ok(
    messages[key] && typeof messages[key].message === 'string' && messages[key].message.trim(),
    `${locale} should localize ${key}`
  );
}

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
  vm.runInNewContext(moduleScript('src/newtab/wallpaper/wallpaper-adaptive-tone.ts', 'LumnoNewtabWallpaperAdaptiveTone'), sandbox);
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
  vm.runInNewContext(moduleScript('src/newtab/wallpaper/wallpaper-adaptive-tone.ts', 'LumnoNewtabWallpaperAdaptiveTone'), sandbox);
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

const newtabScripts = getPageScripts('newtab.html');
assert.ok(
  runsBefore(newtabScripts, 'src/domain/shortcuts/normalize.ts', 'src/newtab/app/main.ts'),
  'new tab page should load the shortcuts store before newtab.js'
);

assert.ok(
  runsBefore(newtabScripts, 'src/newtab/shortcuts/shortcut-icon-store.ts', 'src/newtab/app/main.ts'),
  'shortcut icon processing should load before the page entry opens the React dialog'
);

assert.ok(
  newtabScripts.includes('src/domain/favicon/shortcut-favicon/persisted.ts'),
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

assertContinuousCorners(shortcutDialogCss, ['.x-nt-shortcut-dialog', '._x_extension_shortcut_input_2024_unique_'], 'shortcut dialogs and their fields should use continuous superellipse corners when supported');

assertContinuousCorners(newtabHtml, ['.x-nt-wallpaper-panel', '.x-nt-feedback-popover', '.x-nt-bookmark-cascade-level'], 'New Tab floating panels and bookmark menus should use continuous superellipse corners when supported');

assertContinuousCorners(optionsHtml, ['._x_extension_popconfirm_2024_unique_', '._x_extension_confirm_dialog_2024_unique_'], 'Options popups should use continuous superellipse corners when supported');

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

// The appearance panel is a React view driven by the wallpaper runtime; its controls are
// tested by behavior in src/newtab/react/wallpaper-view.test.tsx and
// tests/newtab/test-newtab-wallpaper-panel.js rather than by matching source text here.

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
  '--x-nt-shortcut-dock-follow-duration: 0ms;',
  'shortcut dock icons should follow a moving pointer through the frame loop, not a restarted transition'
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
  '.x-nt-shortcut-tile[data-dock-distance="0"]',
  'shortcut dock should define a hovered icon scale'
);

const shortcutNearHoverRule = getCssRuleBlock(
  newtabHtml,
  '.x-nt-shortcut-tile[data-dock-distance="0"]'
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
  '.x-nt-shortcut-tile[data-dock-side="before"][data-dock-distance="1"]',
  'shortcut dock should move previous neighbors away from the hover target'
);

assertContains(
  newtabHtml,
  '.x-nt-shortcut-tile[data-dock-side="after"][data-dock-distance="1"]',
  'shortcut dock should move next neighbors away from the hover target'
);

const shortcutDockDisabledIconRule = getCssRuleBlock(
  newtabHtml,
  '.x-nt-shortcuts-grid[data-dock-magnification="false"] .x-nt-shortcut-tile'
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
  !newtabHtml.entries.some((entry) => entry.selectors.some((selector) => selector.includes('.x-nt-shortcut-icon--folder')) &&
    entry.selectors.some((selector) => selector.startsWith('.x-nt-shortcut-icon:has('))),
  'folder shortcuts should not follow the wallpaper-sampled fallback surface'
);
assertContains(
  getCssRuleBlock(newtabHtml, '.x-nt-shortcut-icon--folder'),
  '--x-nt-shortcut-icon-bg: var(--x-nt-shortcut-folder-icon-bg);',
  'folder shortcuts should use the neutral site-tile background'
);

assertContains(
  newtabHtml,
  '.x-nt-shortcut-tile[data-shortcut-draggable="true"]',
  'shortcut draggable tiles should expose a drag affordance'
);

assertContains(
  newtabHtml,
  `.x-nt-shortcuts-grid[data-shortcut-dragging="true"],
      .x-nt-shortcuts-grid[data-shortcut-dragging="true"] .x-nt-shortcut-tile {
        cursor: grabbing;`,
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
  const match = getCssDeclaration(shortcutContextMenuPortalRule, token).match(/: (\d+)px;$/);
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

assertContinuousCorners(newtabHtml, ['.x-nt-shortcut-context-menu-portal', '.x-nt-shortcut-context-menu-portal ._x_extension_select_option_2024_unique_'], 'New Tab context menu shells and options should use continuous superellipse corners when supported');

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


// On New Tab itself.
const settings = require('../../src/domain/settings/index.ts');
const { createNewtabPage } = require('../helpers/newtab-page');

const SITES = [
  { url: 'chrome://inspect/#devices', title: 'Inspect' },
  { url: 'https://one.example/', title: 'One' },
  { url: 'https://two.example/', title: 'Two' }
];

async function openShortcuts(options) {
  const page = await createNewtabPage(Object.assign({ layout: true, shortcuts: SITES }, options || {}));
  await page.settle(300);
  const doc = page.document;
  const grid = doc.querySelector('.x-nt-shortcuts-grid');
  if (grid) {
    page.layout.place(grid, { left: 300, top: 400, width: 400, height: 80 });
    page.layout.flow(grid, '.x-nt-shortcut-tile', { left: 300, top: 400, width: 64, height: 64, gap: 8 });
  }
  return {
    page,
    doc,
    grid,
    tile: (title) => doc.querySelector(`.x-nt-shortcut-tile[aria-label="Open ${title}"]`),
    tiles: () => Array.from(doc.querySelectorAll('.x-nt-shortcut-tile:not(.x-nt-shortcut-tile--add)')),
    click(element, init) {
      element.dispatchEvent(new page.window.MouseEvent('click', Object.assign({ bubbles: true, cancelable: true, button: 0 }, init || {})));
    }
  };
}

// Browser pages (chrome://…) open in this tab from a plain click, and in the
// background from Ctrl/⌘ or a middle click; with shortcuts set to open in a
// new tab, a plain click opens a foreground one instead.
async function testOpeningShortcuts() {
  const shortcuts = await openShortcuts();
  const { page } = shortcuts;
  const created = () => page.messages.filter((message) => message.action === 'createTab');
  shortcuts.click(shortcuts.tile('Inspect'));
  await page.settle(60);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(page.updated)), [{ id: 42, properties: { url: 'chrome://inspect/#devices' } }],
    'a browser page shortcut should open in this tab');
  shortcuts.click(shortcuts.tile('Inspect'), { metaKey: true });
  shortcuts.click(shortcuts.tile('Inspect'), { ctrlKey: true });
  shortcuts.tile('Inspect').dispatchEvent(new page.window.MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }));
  await page.settle(60);
  assert.deepStrictEqual(created().map((message) => [message.url, message.disposition]),
    Array(3).fill(['chrome://inspect/#devices', 'backgroundTab']), 'modified and middle clicks open it in the background');
  assert.strictEqual(page.updated.length, 1);
  page.close();

  const newTab = await openShortcuts({ sync: { [settings.newtabOpenInNewTab.key]: { shortcuts: true } } });
  newTab.click(newTab.tile('One'));
  newTab.click(newTab.tile('One'), { metaKey: true });
  await newTab.page.settle(60);
  assert.deepStrictEqual(newTab.page.messages.filter((message) => message.action === 'createTab').map((message) => message.disposition),
    ['newTab', 'backgroundTab'], 'with "open in a new tab", a plain click opens a foreground tab');
  assert.strictEqual(newTab.page.updated.length, 0);
  newTab.page.close();
}

async function testVisibilitySettings() {
  const hidden = await openShortcuts({ sync: { [settings.newtabShortcutsVisible.key]: false } });
  const section = () => hidden.doc.getElementById('_x_extension_newtab_shortcuts_2026_unique_');
  assert.notStrictEqual(section().getAttribute('data-visible'), 'true', 'turning shortcuts off should hide the rail');
  hidden.page.changeStorage('sync', settings.newtabShortcutsVisible.key, true);
  await hidden.page.settle(100);
  assert.strictEqual(section().getAttribute('data-visible'), 'true', 'and turning them on should bring it back at once');
  hidden.page.close();

  const empty = await openShortcuts({ shortcuts: [], sync: { [settings.newtabShortcutAddVisible.key]: false } });
  assert.notStrictEqual(empty.doc.getElementById('_x_extension_newtab_shortcuts_2026_unique_').getAttribute('data-visible'), 'true',
    'a rail with nothing to show stays hidden');
  assert.strictEqual(empty.doc.querySelector('.x-nt-shortcut-tile--add').hidden, true, 'and the add tile hidden');
  empty.page.close();
}

async function testDockMagnification() {
  for (const enabled of [true, false]) {
    const shortcuts = await openShortcuts({ sync: { [settings.newtabShortcutDockMagnificationEnabled.key]: enabled } });
    const { page, grid } = shortcuts;
    const box = shortcuts.tile('One').getBoundingClientRect();
    page.pointer('pointerover', box.left + 30, box.top + 30);
    page.pointer('pointermove', box.left + 30, box.top + 30);
    await page.settle(60);
    const distances = () => shortcuts.tiles().concat(page.document.querySelector('.x-nt-shortcut-tile--add')).map((tile) => tile.getAttribute('data-dock-distance'));
    if (enabled) {
      assert.deepStrictEqual(distances(), ['1', '0', '1', '2'], 'hovering a tile should mark each neighbour by its distance');
      assert.ok(Number.parseFloat(shortcuts.tile('One').style.getPropertyValue('--x-nt-shortcut-dock-scale')) > 1, 'and magnify the hovered icon');
      grid.dispatchEvent(new page.window.MouseEvent('pointerleave', { clientX: 10, clientY: 10 }));
      await page.settle(60);
      assert.deepStrictEqual(distances(), [null, null, null, null], 'leaving the rail should let the icons settle back');
    } else {
      assert.strictEqual(grid.getAttribute('data-dock-magnification'), 'false');
      assert.deepStrictEqual(distances(), [null, null, null, null], 'with magnification off, hovering changes nothing');
    }
    page.close();
  }
}

async function testTilesAndTooltips() {
  const shortcuts = await openShortcuts();
  const { page, doc } = shortcuts;
  assert.strictEqual(doc.querySelectorAll('.x-nt-shortcut-title, .x-nt-shortcut-label').length, 0, 'tiles show no visible labels');
  const two = shortcuts.tile('Two');
  assert.deepStrictEqual([two.getAttribute('data-tooltip'), two.getAttribute('title')], ['Two', null],
    'their full title is in an anchored tooltip, not a native title');
  const box = two.getBoundingClientRect();
  await page.hover(two, { clientX: box.left + 30, clientY: box.top + 30 });
  await page.settle(300);
  const tooltip = doc.getElementById('_x_extension_newtab_shortcut_tooltip_2026_unique_');
  assert.deepStrictEqual([tooltip.getAttribute('data-visible'), tooltip.textContent], ['true', 'Two'], 'hovering a tile shows its title');
  // The 48px icon sits at the top of its tile.
  assert.ok(Number.parseFloat(tooltip.style.top) >= box.top + 48, 'below the icon');
  assert.strictEqual(doc.querySelector('.x-nt-shortcut-tile--add').getAttribute('data-tooltip'), 'Add shortcut', 'the add tile is labelled the same way');
  assert.ok(shortcuts.tiles().every((tile) => Array.from(tile.querySelectorAll('img')).every((image) => image.getAttribute('draggable') !== 'true')),
    'favicon images are not dragged on their own');

  const add = doc.querySelector('.x-nt-shortcut-tile--add');
  add.dispatchEvent(new page.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: 600, clientY: 430 }));
  await page.settle(100);
  assert.strictEqual(doc.querySelectorAll('[role="menu"][data-open="true"]').length, 0, 'the add tile has no right-click menu');
  shortcuts.click(add);
  await page.settle(150);
  const menu = doc.querySelector('#_x_extension_newtab_shortcut_context_menu_2026_unique__menu');
  assert.deepStrictEqual(Array.from(menu.querySelectorAll('[role="menuitem"]')).map((option) => option.getAttribute('data-value')),
    ['shortcut-add', 'group-create'], 'clicking it asks whether to add a site or a group');
  assert.ok(menu.classList.contains('_x_extension_select_menu_2024_unique_'), 'in the shared menu component');
  page.close();
}

async function testCapacityAndSync() {
  const many = Array.from({ length: 60 }, (_, index) => ({ url: `https://site${index}.example/`, title: `Site ${index}` }));
  const shortcuts = await openShortcuts({ shortcuts: many });
  assert.strictEqual(shortcuts.tiles().length, 60, 'New Tab shows as many shortcuts as the store keeps');
  shortcuts.page.close();

  const synced = await openShortcuts();
  const { shortcutsStorage } = require('../helpers/newtab-fixtures');
  const values = await shortcutsStorage([{ url: 'https://elsewhere.example/', title: 'Elsewhere' }]);
  Object.entries(values).forEach(([key, value]) => synced.page.changeStorage('sync', key, value));
  await synced.page.settle(200);
  assert.deepStrictEqual(synced.tiles().map((tile) => tile.getAttribute('aria-label')), ['Open Elsewhere'],
    'shortcuts changed on another device should show here');
  synced.page.close();
}

async function testAddingAShortcut() {
  const shortcuts = await openShortcuts();
  const { page, doc } = shortcuts;
  const add = doc.querySelector('.x-nt-shortcut-tile--add');
  shortcuts.click(add);
  await page.settle(150);
  const option = doc.querySelector('#_x_extension_newtab_shortcut_context_menu_2026_unique__menu [data-value="shortcut-add"]');
  option.dispatchEvent(new page.window.MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
  shortcuts.click(option);
  await page.settle(400);
  const backdrop = doc.querySelector('.x-nt-shortcut-dialog-backdrop');
  const dialog = backdrop.querySelector('.x-nt-shortcut-dialog');
  assert.strictEqual(backdrop.getAttribute('data-open'), 'true', 'the add dialog should open');
  assert.ok(dialog.style.getPropertyValue('--x-nt-shortcut-dialog-enter-x'), 'from the side of the tile that opened it');
  const [name, url] = Array.from(dialog.querySelectorAll('input._x_extension_shortcut_input_2024_unique_'));
  assert.ok(url.closest('._x_extension_shortcut_input_affix_2026_unique_[data-has-prefix="false"]'), 'fields use the Settings input with no prefix');
  const buttons = Array.from(dialog.querySelectorAll('button.x-lumno-action-button'));
  assert.ok(buttons.some((button) => button.classList.contains('x-lumno-action-button--primary')) &&
    buttons.some((button) => button.classList.contains('x-lumno-action-button--secondary')), 'with the Lumno primary and secondary buttons');
  const type = (input, value) => {
    Object.getOwnPropertyDescriptor(page.window.HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new page.window.Event('input', { bubbles: true }));
  };
  type(name, 'Docs');
  type(url, 'docs.example');
  dialog.querySelector('form').dispatchEvent(new page.window.Event('submit', { bubbles: true, cancelable: true }));
  await page.settle(400);
  assert.ok(shortcuts.tile('Docs'), 'submitting should add the shortcut');
  assert.match(doc.getElementById('_x_extension_toast_2024_unique_').textContent, /Shortcut added/);
  page.close();
}

async function testPageStarts() {
  const shortcuts = await openShortcuts({ darkSystem: true });
  assert.deepStrictEqual(shortcuts.page.errors, [], 'New Tab should start without errors');
  assert.ok(shortcuts.tiles().every((tile) => tile.querySelector('.x-nt-shortcut-icon')), 'each shortcut has its icon');
  shortcuts.page.close();
}

async function runPageTests() {
  await testOpeningShortcuts();
  await testVisibilitySettings();
  await testDockMagnification();
  await testTilesAndTooltips();
  await testCapacityAndSync();
  await testAddingAShortcut();
  await testPageStarts();
}

Promise.all([
  assertDarkWallpaperKeepsShortcutThemeBackground(),
  assertDarkThemeKeepsShortcutThemeBackground()
]).then(runPageTests).then(() => {
  console.log('newtab shortcuts UI tests passed');
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
