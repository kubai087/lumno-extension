const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const { JSDOM } = require('jsdom');
const { parsePageCss } = require('../helpers/css-rules');
const { getBundleFiles, runsBefore } = require('../helpers/runtime-scripts');
const { moduleScript, runModuleInContext } = require('../helpers/module-script');
const { readWallpaperRuntimeSource } = require('../helpers/wallpaper-source');

const sandbox = {
  clearTimeout,
  globalThis: null,
  setTimeout
};
sandbox.globalThis = sandbox;

vm.runInNewContext(moduleScript('src/domain/settings/index.ts', 'LumnoSettings', null, { 'src/newtab/wallpaper/wallpaper-effects.ts': 'LumnoNewtabWallpaperEffects' }), sandbox, {
  filename: 'src/domain/settings/index.ts'
});
vm.runInNewContext(moduleScript('src/newtab/wallpaper/wallpaper-effects.ts', 'LumnoNewtabWallpaperEffects'), sandbox, {
  filename: 'src/newtab/wallpaper/wallpaper-effects.ts'
});

const effects = sandbox.LumnoNewtabWallpaperEffects;
assert.ok(effects, 'wallpaper effects module should initialize');
assert.strictEqual(typeof effects.analyzeImageData, 'function');
assert.strictEqual(typeof effects.getEffectCanvasScale, 'function');
assert.strictEqual(
  effects.getBlurRadius(0),
  2,
  'zero blur strength should retain only a subtle two-pixel glass effect'
);
assert.ok(effects.EFFECT_TYPES.includes('dither'), 'Dither should be a supported wallpaper effect');
assert.ok(effects.EFFECT_TYPES.includes('blur'), 'Glass blur should be a supported wallpaper effect');
assert.ok(effects.EFFECT_TYPES.includes('blocks'), 'Blocks should be a supported wallpaper effect');
assert.ok(effects.EFFECT_TYPES.includes('crt'), 'CRT should be a supported wallpaper effect');
assert.strictEqual(typeof effects.quantizeDitherColor, 'function');
assert.strictEqual(typeof effects.liftSampleColor, 'function');
assert.strictEqual(typeof effects.migratePrefsToLatest, 'function');
assert.strictEqual(typeof effects.normalizeStoragePrefs, 'function');

const warmSample = effects.liftSampleColor(
  { red: 180, green: 90, blue: 30 },
  0.4,
  0.2
);
assert.ok(
  warmSample.red > 180 && warmSample.red > warmSample.green && warmSample.green > warmSample.blue,
  'sampled warm hues should stay warm while becoming brighter'
);
const coolSample = effects.liftSampleColor(
  { red: 40, green: 90, blue: 160 },
  0.4,
  0.2
);
assert.ok(
  coolSample.blue > 160 && coolSample.blue > coolSample.green && coolSample.green > coolSample.red,
  'sampled cool hues should stay cool while becoming brighter'
);
const neutralSample = effects.liftSampleColor(
  { red: 80, green: 80, blue: 80 },
  0.4,
  0.2
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(neutralSample)),
  { red: 150, green: 150, blue: 150 },
  'neutral wallpaper samples should brighten without gaining a color cast'
);

const darkProfile = effects.analyzeImageData([
  10, 20, 30, 255,
  30, 40, 50, 255
]);
assert.ok(darkProfile.averageLuminance < 0.2, 'dark wallpaper samples should remain dark');
assert.ok(darkProfile.lowLuminance <= darkProfile.highLuminance);
assert.strictEqual(
  darkProfile.useDarkInk,
  false,
  'dark wallpapers should use luminous characters over the retained image'
);

const lightProfile = effects.analyzeImageData([
  238, 242, 248, 255,
  250, 246, 240, 255
]);
assert.ok(lightProfile.averageLuminance > 0.9, 'light wallpaper samples should remain light');
assert.ok(lightProfile.lowLuminance > 0.9, 'light wallpaper percentiles should retain their tonal range');
assert.strictEqual(
  lightProfile.useDarkInk,
  true,
  'light wallpapers should use dark characters over the retained image'
);

const transparentProfile = effects.analyzeImageData([
  0, 0, 0, 0
]);
assert.ok(
  transparentProfile.averageLuminance > 0.99,
  'transparent source pixels should be composited against white like the sampler'
);
assert.strictEqual(transparentProfile.useDarkInk, true);

const fallbackProfile = effects.analyzeImageData(null);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(fallbackProfile)),
  {
    averageLuminance: 0.5,
    lowLuminance: 0.1,
    highLuminance: 0.9,
    useDarkInk: false
  }
);

assert.ok(
  effects.getEffectCanvasScale(2, 1920, 1080) > 1.4,
  'common desktop viewports should receive supersampled effect layers'
);
assert.ok(
  effects.getEffectCanvasScale(2, 2560, 1440) > 1,
  'large desktop canvases should stay above CSS-pixel resolution while respecting the target budget'
);
assert.strictEqual(
  effects.getEffectCanvasScale(3, 390, 844),
  1.6,
  'small mobile canvases should use the configured supersampling ceiling'
);
assert.strictEqual(
  effects.getEffectCanvasScale(2, 5120, 2880),
  1,
  'very large viewports should never be upscaled from a sub-CSS-pixel backing buffer'
);

const normalized = effects.normalizePrefs({
  type: 'ascii',
  inkTone: 'light',
  strength: 140,
  size: -4.5,
  spacing: 160.25,
  texture: -240.75,
  // Legacy stored values may still contain this removed preference.
  hover: false
});
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(normalized)),
  {
    version: 11,
    type: 'ascii',
    inkTone: 'light',
    strength: 100,
    size: 0,
    spacing: 100,
    texture: 0,
    blockSize: 1,
    crtStrength: 20,
    crtBloom: 15,
    crtRgbOffset: 35,
    crtCurvature: 18
  }
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(effects.normalizePrefs({
    size: Infinity,
    spacing: NaN,
    texture: -Infinity
  }))),
  {
    version: 11,
    type: 'none',
    inkTone: 'auto',
    strength: 50,
    size: 50,
    spacing: 50,
    texture: 20,
    blockSize: 1,
    crtStrength: 20,
    crtBloom: 15,
    crtRgbOffset: 35,
    crtCurvature: 18
  },
  'non-finite material controls should fall back to bounded defaults'
);
assert.strictEqual(effects.resolveUseDarkInk('dark', { useDarkInk: false }), true);
assert.strictEqual(effects.resolveUseDarkInk('light', { useDarkInk: true }), false);
assert.strictEqual(
  effects.resolveUseDarkInk('auto', { useDarkInk: true }),
  true,
  'legacy automatic tone should continue following wallpaper luminance'
);
assert.strictEqual(effects.resolveAutoInkTone('auto', 'light'), 'dark');
assert.strictEqual(effects.resolveAutoInkTone('auto', 'dark'), 'light');
assert.strictEqual(effects.resolveAutoInkTone('dark', 'dark'), 'dark');
assert.strictEqual(effects.resolveAutoInkTone('light', 'light'), 'light');
assert.strictEqual(
  effects.resolvePrefsForMode({ type: 'ascii', inkTone: 'auto' }, 'dark').inkTone,
  'light',
  'automatic tone should render the same tone the panel highlights for the active mode'
);
assert.strictEqual(
  effects.normalizePrefs({ inkTone: 'unknown' }).inkTone,
  'auto',
  'unknown stored ink tones should fall back to the legacy automatic behavior'
);
assert.strictEqual(
  effects.normalizePrefs({ type: 'blur', texture: 180.75 }).texture,
  100,
  'standard glass texture should clamp stored values to its supported maximum'
);
assert.strictEqual(
  effects.normalizePrefs({ type: 'blur', texture: -40 }).texture,
  0,
  'standard glass texture should not retain negative values'
);
assert.strictEqual(
  effects.normalizePrefs({ version: 11, type: 'blocks', texture: 180.75 }).texture,
  100,
  'shared texture should remain bounded while Blocks uses a fixed render value'
);
assert.strictEqual(
  effects.normalizePrefs({ version: 11, type: 'blocks', texture: -40 }).texture,
  0,
  'selecting Blocks should not force the shared texture value'
);
assert.strictEqual(
  effects.normalizePrefs({ version: 11, type: 'blocks', strength: 12 }).strength,
  12,
  'selecting Blocks should not force the shared strength value'
);
assert.strictEqual(
  effects.normalizePrefs({ type: 'blocks', size: 80 }).blockSize,
  4,
  'legacy percentage-mapped block size should migrate to the native 0–5 scale'
);
assert.strictEqual(
  effects.normalizePrefs({ version: 10, type: 'blocks', size: 8 }).blockSize,
  5,
  'v10 block size values should clamp instead of being mistaken for percentages'
);
const migratedBlockPrefs = effects.normalizePrefs({ version: 9, type: 'blocks', size: 80 });
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(effects.normalizePrefs(migratedBlockPrefs))),
  JSON.parse(JSON.stringify(migratedBlockPrefs)),
  'normalizing an upgraded effect should be idempotent'
);
const migratedModePrefs = effects.normalizeStoragePrefs({
  version: 9,
  light: { type: 'blocks', size: 80 },
  dark: { type: 'blocks', size: 20 }
});
assert.strictEqual(migratedModePrefs.version, 11);
assert.strictEqual(migratedModePrefs.light.version, 11);
assert.strictEqual(migratedModePrefs.light.blockSize, 4);
assert.strictEqual(migratedModePrefs.dark.blockSize, 1);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(effects.normalizeStoragePrefs(migratedModePrefs))),
  JSON.parse(JSON.stringify(migratedModePrefs)),
  'mode-aware effect storage should migrate directly to one stable latest schema'
);
assert.strictEqual(effects.normalizePrefs({ type: 'blocks' }).blockSize, 1);
assert.strictEqual(effects.normalizePrefs({ type: 'blocks' }).spacing, 50);
assert.strictEqual(effects.normalizePrefs({ version: 11, type: 'blocks', spacing: -10 }).spacing, 0);
assert.strictEqual(
  effects.normalizePrefs({ type: 'blocks' }).type,
  'blocks',
  'stored Blocks preferences should survive normalization'
);

const brightDitherSample = effects.quantizeDitherColor(
  { red: 100, green: 150, blue: 200 },
  0.1,
  4,
  1
);
const darkDitherSample = effects.quantizeDitherColor(
  { red: 100, green: 150, blue: 200 },
  0.9,
  4,
  1
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(brightDitherSample)),
  { red: 170, green: 170, blue: 255 },
  'low Bayer thresholds should promote channels to the next palette level'
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(darkDitherSample)),
  { red: 85, green: 85, blue: 170 },
  'high Bayer thresholds should retain the lower palette level'
);
assert.strictEqual(
  effects.normalizePrefs({ type: 'dither' }).type,
  'dither',
  'stored Dither preferences should survive normalization'
);
assert.strictEqual(
  effects.normalizePrefs({ type: 'crt' }).type,
  'crt',
  'stored CRT preferences should survive normalization'
);
const normalizedCrt = effects.normalizePrefs({
  version: 7,
  type: 'crt',
  spacing: 240,
  strength: 140,
  crtBloom: 140,
  crtRgbOffset: -20,
  crtCurvature: 38.4
});
assert.strictEqual(normalizedCrt.version, 11);
assert.strictEqual(normalizedCrt.spacing, 100);
assert.strictEqual(normalizedCrt.strength, 50);
assert.strictEqual(normalizedCrt.crtStrength, 20);
assert.strictEqual(normalizedCrt.crtBloom, 20);
assert.strictEqual(normalizedCrt.crtRgbOffset, 0);
assert.strictEqual(normalizedCrt.crtCurvature, 35);
assert.strictEqual(
  effects.normalizePrefs({ type: 'grain', spacing: -20 }).spacing,
  0,
  'generic spacing should stay within the shared control range'
);
assert.strictEqual(
  effects.normalizePrefs({ type: 'grain', spacing: 240 }).spacing,
  100,
  'generic spacing should stay within the shared control range'
);
const normalizedFractionalCrt = effects.normalizePrefs({
  type: 'crt',
  strength: 10.5,
  crtBloom: 10.5,
  crtCurvature: 17.5
});
assert.strictEqual(normalizedFractionalCrt.strength, 50);
assert.strictEqual(normalizedFractionalCrt.crtStrength, 10.5);
assert.strictEqual(normalizedFractionalCrt.crtBloom, 10.5);
assert.strictEqual(normalizedFractionalCrt.crtCurvature, 17.5);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(effects.normalizePrefs({ version: 7, type: 'crt' }))),
  {
    version: 11,
    type: 'crt',
    inkTone: 'auto',
    strength: 50,
    size: 50,
    spacing: 50,
    texture: 20,
    blockSize: 1,
    crtStrength: 20,
    crtBloom: 15,
    crtRgbOffset: 35,
    crtCurvature: 18
  },
  'legacy CRT preferences should gain the RGB-only defaults'
);

const independentEffectPrefs = effects.normalizePrefs({
  version: 11,
  type: 'grain',
  strength: 80,
  size: 65,
  spacing: 35,
  texture: 25,
  blockSize: 4,
  crtStrength: 10
});
const switchedToCrt = effects.normalizePrefs(Object.assign({}, independentEffectPrefs, {
  type: 'crt'
}));
const switchedToBlocks = effects.normalizePrefs(Object.assign({}, switchedToCrt, {
  type: 'blocks'
}));
const switchedBackToGrain = effects.normalizePrefs(Object.assign({}, switchedToBlocks, {
  type: 'grain'
}));
assert.strictEqual(switchedToCrt.strength, 80, 'CRT should not overwrite generic strength');
assert.strictEqual(switchedToCrt.crtStrength, 10, 'CRT should retain its dedicated strength');
assert.strictEqual(switchedToBlocks.blockSize, 4, 'Blocks should retain its dedicated size');
assert.strictEqual(switchedBackToGrain.strength, 80, 'generic strength should round-trip across effects');
assert.strictEqual(switchedBackToGrain.size, 65, 'generic size should round-trip across effects');
assert.strictEqual(switchedBackToGrain.spacing, 35, 'generic spacing should round-trip across effects');
assert.strictEqual(switchedBackToGrain.texture, 25, 'generic texture should round-trip across effects');

assert.strictEqual(
  effects.normalizePrefs({ type: 'blur' }).type,
  'blur',
  'stored glass blur preferences should survive normalization'
);
assert.strictEqual(
  effects.normalizePrefs(undefined).type,
  'none',
  'wallpaper filters should remain off by default'
);
const newtabCss = parsePageCss('newtab.html');
const newtabDocument = new JSDOM(fs.readFileSync('newtab.html', 'utf8')).window.document;

// The effects' layers, read through the CSSOM.
{
  const rule = (selector) => {
    const found = newtabCss.rule(selector);
    assert.ok(found, `missing ${selector}`);
    return found;
  };
  const blurLayer = 'body[data-wallpaper-active="true"][data-wallpaper-effect="blur"]::before';
  const blurCopy = newtabCss.entries.find((entry) => entry.selectors.includes(blurLayer) &&
    entry.selectors.includes('.x-nt-wallpaper-transition-layer[data-wallpaper-effect="blur"]'));
  assert.ok(blurCopy, 'glass blur and its transition snapshot should share one filtered layer rule');
  assert.match(blurCopy.style.getPropertyValue('inset'), /^calc\(0px - var\(--x-nt-wallpaper-blur-overscan/, 'over an overscanned copy');
  assert.strictEqual(blurCopy.style.getPropertyValue('filter').replace(/\s+/g, ' ').trim(),
    'blur(var(--x-nt-wallpaper-blur-radius)) saturate(var(--x-nt-wallpaper-blur-saturate)) brightness(var(--x-nt-wallpaper-blur-brightness)) contrast(var(--x-nt-wallpaper-blur-contrast))',
    'glass blur should filter the wallpaper copy');
  assert.match(rule(blurLayer).get('background-image'), /^var\(--x-nt-wallpaper-image,/, 'the copy is the wallpaper itself');
  const blurBody = rule('body[data-wallpaper-active="true"][data-wallpaper-effect="blur"]');
  assert.deepStrictEqual([blurBody.get('--x-nt-wallpaper-overlay'), blurBody.get('background-image')], ['none', 'none'],
    'glass blur should replace the body wallpaper with the filtered copy without painting it twice');
  assert.match(rule('body::before').get('transition'), /opacity 180ms ease/, 'the blurred copy fades in once applied');
  const filterTransition = newtabCss.entries.find((entry) => entry.selectors.some((selector) =>
    selector.includes('.x-nt-wallpaper-transition-layer[data-wallpaper-filter-transition="true"]')) &&
    entry.style.getPropertyValue('transition-duration'));
  assert.strictEqual(filterTransition && filterTransition.style.getPropertyValue('transition-duration'), '180ms',
    'filter snapshots should use the same 180ms duration as the glass background and texture');
  const layered = newtabCss.entries.find((entry) => entry.selectors.includes('body[data-wallpaper-active="true"][data-wallpaper-effect="halftone"]::after') &&
    entry.selectors.includes('body[data-wallpaper-active="true"][data-wallpaper-effect="ascii"]::after'));
  assert.strictEqual(layered && layered.style.getPropertyValue('opacity'), '0', 'halftone and ASCII draw above the wallpaper');
  ['halftone', 'ascii'].forEach((type) => {
    const body = newtabCss.rule(`body[data-wallpaper-active="true"][data-wallpaper-effect="${type}"]`);
    assert.notStrictEqual(body && body.get('--x-nt-wallpaper-image'), 'none', `${type} should keep the CSS wallpaper visible`);
  });
  const resize = newtabCss.entries.find((entry) => entry.selectors.includes('.x-nt-wallpaper-effect-canvas[data-resize-enter="true"]') &&
    entry.selectors.includes('.x-nt-wallpaper-effect-canvas[data-resize-exit="true"]'));
  assert.deepStrictEqual(resize && [resize.style.getPropertyValue('opacity'), resize.style.getPropertyPriority('opacity')], ['0', 'important'],
    'resized effects expose enter and exit states for an opacity crossfade');
  assert.deepStrictEqual([rule('.x-nt-wallpaper-effect-canvas[data-resize-jump="true"]').get('transition'),
    rule('.x-nt-wallpaper-effect-canvas[data-resize-jump="true"]').priority('transition')], ['none', 'important'],
  'the resized destination canvas is hidden without animating before its crossfade');
}

vm.runInNewContext(readWallpaperRuntimeSource(), sandbox, {
  filename: 'src/newtab/wallpaper/wallpaper.ts'
});
const wallpaper = sandbox.LumnoNewtabWallpaper;
assert.ok(wallpaper, 'wallpaper runtime module should initialize');
assert.strictEqual(
  runModuleInContext('src/newtab/wallpaper/wallpaper-options.ts', vm.createContext({})).WALLPAPER_EFFECT_MODE_STORAGE_VERSION,
  11,
  'mode-aware wallpaper effect storage should have an explicit schema version'
);
const legacyEffectPrefs = {
  version: 3,
  type: 'grain',
  strength: 64,
  size: 35,
  spacing: 72
};
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(wallpaper.normalizeWallpaperEffectStoragePrefs(legacyEffectPrefs))),
  {
    version: 11,
    light: { version: 11, type: 'grain', inkTone: 'auto', strength: 64, size: 35, spacing: 72, texture: 20, blockSize: 1, crtStrength: 20, crtBloom: 15, crtRgbOffset: 35, crtCurvature: 18 },
    dark: { version: 11, type: 'grain', inkTone: 'auto', strength: 64, size: 35, spacing: 72, texture: 20, blockSize: 1, crtStrength: 20, crtBloom: 15, crtRgbOffset: 35, crtCurvature: 18 }
  },
  'legacy shared wallpaper effects should migrate to identical light and dark preferences'
);
const fallbackCompatibilityPrefs = wallpaper.normalizeWallpaperEffectStoragePrefs({
  version: 10,
  type: 'grain',
  spacing: 240,
  crtSpacing: 73,
  crtGrain: 9
});
assert.strictEqual(fallbackCompatibilityPrefs.light.spacing, 100);
assert.strictEqual(fallbackCompatibilityPrefs.light.crtSpacing, undefined);
assert.strictEqual(fallbackCompatibilityPrefs.light.crtGrain, undefined);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(wallpaper.normalizeWallpaperEffectStoragePrefs({
    version: 7,
    light: {
      type: 'blur',
      strength: 31,
      size: 42,
      spacing: 53,
      texture: 32,
      glow: 90,
      haze: 80,
      refraction: 70,
      edgeLight: 60
    },
    dark: { type: 'ascii', strength: 82, size: 73, spacing: 64, glow: 40 }
  }))),
  {
    version: 11,
    light: { version: 11, type: 'blur', inkTone: 'auto', strength: 31, size: 42, spacing: 53, texture: 32, blockSize: 1, crtStrength: 20, crtBloom: 15, crtRgbOffset: 35, crtCurvature: 18 },
    dark: { version: 11, type: 'ascii', inkTone: 'auto', strength: 82, size: 73, spacing: 64, texture: 20, blockSize: 1, crtStrength: 20, crtBloom: 15, crtRgbOffset: 35, crtCurvature: 18 }
  },
  'mode-aware wallpaper effects should preserve supported values and discard removed optics'
);
assert.ok(
  runsBefore(getBundleFiles('newtab-preload'), 'src/newtab/wallpaper/wallpaper-crt-webgl.ts', 'src/newtab/wallpaper/wallpaper-effects.ts'),
  'the standalone CRT shader should load before the shared wallpaper effect controller'
);
assert.ok(
  runsBefore(getBundleFiles('newtab-preload'), 'src/newtab/wallpaper/wallpaper-effects.ts', 'src/newtab/wallpaper/wallpaper-preload.ts'),
  'the wallpaper effect renderer should load before the head preload fast path'
);
assert.ok(
  newtabDocument.querySelector('script[src="../../build/wallpaper-effect-preload.js"]').compareDocumentPosition(
    newtabDocument.getElementById('_x_extension_newtab_root_2024_unique_')) & 4,
  'the focused-route wallpaper effect should start before New Tab content bootstraps'
);

function createFakeCanvas(options) {
  const config = options || {};
  const attributes = new Map();
  const operations = [];
  const stateStack = [];
  let currentPath = [];
  const context = {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '',
    filter: 'none',
    shadowBlur: 0,
    shadowColor: 'transparent',
    setTransform() {},
    save() {
      stateStack.push({
        globalAlpha: this.globalAlpha,
        globalCompositeOperation: this.globalCompositeOperation,
        fillStyle: this.fillStyle,
        filter: this.filter,
        shadowBlur: this.shadowBlur,
        shadowColor: this.shadowColor
      });
    },
    restore() {
      Object.assign(this, stateStack.pop() || {});
    },
    clearRect() {},
    beginPath() {
      currentPath = [];
    },
    moveTo(x, y) {
      currentPath.push({ x, y });
    },
    lineTo(x, y) {
      currentPath.push({ x, y });
    },
    arc(x, y, radius, startAngle, endAngle) {
      currentPath.push({ x, y, radius, startAngle, endAngle });
    },
    closePath() {},
    fill() {
      operations.push({
        op: 'fill',
        points: currentPath.slice(),
        fillStyle: this.fillStyle
      });
    },
    createImageData(width, height) {
      return { data: new Uint8ClampedArray(width * height * 4) };
    },
    getImageData(_x, _y, width, height) {
      if (typeof config.getSampleData === 'function') {
        return { data: config.getSampleData(width, height) };
      }
      const data = new Uint8ClampedArray(width * height * 4);
      const rgba = typeof config.getSampleRgba === 'function'
        ? config.getSampleRgba()
        : null;
      if (rgba) {
        for (let index = 0; index < data.length; index += 4) {
          data[index] = rgba[0];
          data[index + 1] = rgba[1];
          data[index + 2] = rgba[2];
          data[index + 3] = rgba[3];
        }
      }
      return { data };
    },
    putImageData(imageData) {
      operations.push({ op: 'putImageData', data: Array.from(imageData.data) });
    },
    createPattern(source) {
      return { source };
    },
    createRadialGradient() {
      return {
        colorStops: [],
        addColorStop(offset, color) {
          this.colorStops.push([offset, color]);
        }
      };
    },
    drawImage(source, ...args) {
      operations.push({
        op: 'drawImage',
        source,
        args,
        alpha: this.globalAlpha,
        composite: this.globalCompositeOperation,
        filter: this.filter
      });
    },
    fillRect(x, y, width, height) {
      operations.push({
        op: 'fillRect',
        x,
        y,
        width,
        height,
        alpha: this.globalAlpha,
        composite: this.globalCompositeOperation,
        fillStyle: this.fillStyle,
        shadowBlur: this.shadowBlur,
        shadowColor: this.shadowColor
      });
    }
  };
  return {
    _operations: operations,
    _toDataUrlCalls: 0,
    className: '',
    height: 0,
    parentNode: null,
    style: {},
    width: 0,
    toDataURL() {
      this._toDataUrlCalls += 1;
      return 'data:image/png;base64,material-tile';
    },
    getAttribute(name) {
      return attributes.get(name) || null;
    },
    getContext() {
      return context;
    },
    removeAttribute(name) {
      attributes.delete(name);
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    }
  };
}



async function testEffectRefreshWaitsForPaint() {
  const bodyAttributes = new Map([['data-wallpaper-active', 'true']]);
  const createdCanvases = [];
  const body = {
    firstChild: null,
    getAttribute(name) {
      return bodyAttributes.get(name) || null;
    },
    insertBefore(element) {
      element.parentNode = this;
      this.firstChild = element;
    },
    removeChild(element) {
      if (this.firstChild === element) {
        this.firstChild = null;
      }
      element.parentNode = null;
    }
  };
  const listeners = new Map();
  const documentObj = {
    body,
    documentElement: { clientHeight: 800, clientWidth: 1200 },
    createElement() {
      const canvas = createFakeCanvas();
      createdCanvases.push(canvas);
      return canvas;
    }
  };
  const windowObj = {
    devicePixelRatio: 1,
    innerHeight: 800,
    innerWidth: 1200,
    addEventListener(name, listener) {
      listeners.set(name, listener);
    },
    removeEventListener(name, listener) {
      if (listeners.get(name) === listener) {
        listeners.delete(name);
      }
    },
    cancelAnimationFrame: clearTimeout,
    requestAnimationFrame(callback) {
      return setTimeout(callback, 0);
    }
  };
  const controller = effects.createWallpaperEffects({
    documentObj,
    windowObj,
    getCurrentWallpaper: () => ({ id: 'test-wallpaper' }),
    getWallpaperImageUrl: () => '',
    shouldAnimateTransition: () => false
  });
  controller.apply({ type: 'grain', strength: 50, size: 50, spacing: 50 });
  await controller.refresh({ immediate: true });
  assert.strictEqual(createdCanvases[0].getAttribute('data-effect'), 'grain');
  assert.notStrictEqual(createdCanvases[0].style.opacity, '0');
  assert.strictEqual(typeof controller.destroy, 'function');
  assert.ok(listeners.has('resize'));
  assert.strictEqual(
    listeners.has('beforeunload'),
    false,
    'same-tab navigation should leave the effect canvas painted until the page is replaced'
  );
  controller.destroy();
  assert.strictEqual(createdCanvases[0].parentNode, null, 'destroy should remove the effect canvas');
  assert.strictEqual(listeners.has('resize'), false, 'destroy should remove the resize listener');
}

async function testStandardGlassRendersCachedMaterialTexture() {
  const bodyAttributes = new Map([['data-wallpaper-active', 'true']]);
  const bodyStyles = new Map();
  const createdCanvases = [];
  const body = {
    firstChild: null,
    style: {
      setProperty(name, value) {
        bodyStyles.set(name, String(value));
      }
    },
    getAttribute(name) {
      return bodyAttributes.get(name) || null;
    },
    setAttribute(name, value) {
      bodyAttributes.set(name, String(value));
    },
    insertBefore(element) {
      element.parentNode = this;
      this.firstChild = element;
    }
  };
  const documentObj = {
    body,
    documentElement: { clientHeight: 800, clientWidth: 1200 },
    createElement() {
      const canvas = createFakeCanvas();
      createdCanvases.push(canvas);
      return canvas;
    }
  };
  const windowObj = {
    devicePixelRatio: 1,
    innerHeight: 800,
    innerWidth: 1200,
    addEventListener() {},
    cancelAnimationFrame: clearTimeout,
    requestAnimationFrame(callback) {
      return setTimeout(callback, 0);
    }
  };
  const controller = effects.createWallpaperEffects({
    documentObj,
    windowObj,
    getCurrentWallpaper: () => ({ id: 'test-wallpaper' }),
    getWallpaperImageUrl: () => '',
    shouldAnimateTransition: () => false
  });
  controller.apply({ type: 'blur', texture: 100 });
  await controller.refresh({ immediate: true });
  assert.strictEqual(createdCanvases[0].getAttribute('data-effect'), 'blur-standard');
  assert.ok(createdCanvases.length >= 3, 'standard glass should cache fine and coarse noise tiles');
  assert.strictEqual(createdCanvases[0].width, 1, 'standard glass should not retain a viewport-sized canvas buffer');
  assert.strictEqual(createdCanvases[0].height, 1, 'standard glass should not retain a viewport-sized canvas buffer');
  assert.match(
    createdCanvases[0].style.backgroundImage || '',
    /linear-gradient\(rgba\(248, 250, 252, 0\.55\)[\s\S]*linear-gradient\([\s\S]*radial-gradient\([\s\S]*radial-gradient\([\s\S]*url\("data:image\/png;base64,material-tile"\)[\s\S]*url\("data:image\/png;base64,material-tile"\)/,
    'standard glass should layer a scattering veil and environment reflections above two cached material textures'
  );
  assert.strictEqual(createdCanvases[0].style.opacity, '0.18');
  assert.strictEqual(
    createdCanvases[0].style.backgroundRepeat,
    'no-repeat, no-repeat, no-repeat, no-repeat, repeat, repeat'
  );
  assert.strictEqual(
    createdCanvases[0].style.backgroundSize,
    '100% 100%, 100% 100%, 100% 100%, 100% 100%, 64px 64px, 320px 320px'
  );
  assert.strictEqual(bodyStyles.get('--x-nt-wallpaper-blur-saturate'), '110%');
  assert.strictEqual(bodyStyles.get('--x-nt-wallpaper-blur-brightness'), '106%');
  assert.strictEqual(bodyStyles.get('--x-nt-wallpaper-blur-contrast'), '84%');
  assert.strictEqual(createdCanvases[0].style.mixBlendMode, 'soft-light');

  controller.apply({ type: 'blur', texture: 25 });
  await controller.refresh({ immediate: true });
  assert.ok(
    Number(createdCanvases[0].style.opacity) > 0.07,
    'low texture values should remain visibly responsive through a perceptual response curve'
  );

  controller.apply({ type: 'blur', texture: 50 });
  await controller.refresh({ immediate: true });
  assert.strictEqual(
    createdCanvases.reduce((total, candidate) => total + candidate._toDataUrlCalls, 0),
    2,
    'standard texture adjustments should reuse both cached noise data URLs'
  );

  controller.apply({ type: 'blur', texture: -200 });
  await controller.refresh({ immediate: true });
  assert.strictEqual(createdCanvases[0].style.opacity, '0');
  assert.strictEqual(createdCanvases[0].style.backgroundImage, 'none');
  assert.strictEqual(createdCanvases[0].style.backgroundRepeat, 'no-repeat');
  assert.strictEqual(bodyStyles.get('--x-nt-wallpaper-blur-saturate'), '100%');
  assert.strictEqual(bodyStyles.get('--x-nt-wallpaper-blur-brightness'), '100%');
  assert.strictEqual(bodyStyles.get('--x-nt-wallpaper-blur-contrast'), '100%');
}

async function testGlassBackgroundAndTextureEnterTogether() {
  const bodyAttributes = new Map([['data-wallpaper-active', 'true']]);
  const children = [];
  const createdCanvases = [];
  const body = {
    firstChild: null,
    style: { setProperty() {} },
    getAttribute(name) {
      return bodyAttributes.get(name) || null;
    },
    insertBefore(element, reference) {
      const index = children.indexOf(reference);
      if (index === -1) {
        children.push(element);
      } else {
        children.splice(index, 0, element);
      }
      element.parentNode = this;
      this.firstChild = children[0] || null;
    },
    removeChild(element) {
      const index = children.indexOf(element);
      if (index !== -1) {
        children.splice(index, 1);
      }
      element.parentNode = null;
      this.firstChild = children[0] || null;
    }
  };
  const documentObj = {
    body,
    documentElement: { clientHeight: 800, clientWidth: 1200 },
    createElement() {
      const canvas = createFakeCanvas();
      createdCanvases.push(canvas);
      return canvas;
    }
  };
  const windowObj = {
    devicePixelRatio: 1,
    innerHeight: 800,
    innerWidth: 1200,
    addEventListener() {},
    cancelAnimationFrame: clearTimeout,
    requestAnimationFrame(callback) {
      return setTimeout(callback, 0);
    }
  };
  const controller = effects.createWallpaperEffects({
    documentObj,
    windowObj,
    getCurrentWallpaper: () => ({ id: 'test-wallpaper' }),
    getWallpaperImageUrl: () => '',
    shouldAnimateTransition: () => true
  });

  controller.apply({ type: 'grain', strength: 50, size: 50, spacing: 50 });
  await controller.refresh({ immediate: true });
  const effectCanvas = createdCanvases[0];
  const blurRender = controller.apply({ type: 'blur', strength: 50, texture: 50 });

  assert.strictEqual(
    effectCanvas.getAttribute('data-resize-enter'),
    'true',
    'the incoming glass texture should start hidden while the outgoing texture snapshot is retained'
  );
  assert.ok(
    children.some((canvas) => canvas !== effectCanvas &&
      String(canvas.className).includes('x-nt-wallpaper-effect-resize-snapshot')),
    'effect switching should snapshot the outgoing canvas instead of delaying the glass texture'
  );
  // Wait for the render itself, then one frame for the crossfade it queued,
  // instead of a fixed delay that a loaded CI runner can outlast.
  await blurRender;
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.strictEqual(effectCanvas.getAttribute('data-effect'), 'blur-standard');
  assert.strictEqual(
    effectCanvas.getAttribute('data-resize-enter'),
    null,
    'the glass texture should begin fading in on the next frame with the blurred background'
  );
  const glassTexture = effectCanvas.style.backgroundImage;
  controller.apply({ type: 'grain', strength: 50, size: 50, spacing: 50 });
  const leavingGlassSnapshot = children.find((candidate) =>
    candidate !== effectCanvas &&
    String(candidate.className).includes('x-nt-wallpaper-effect-resize-snapshot'));
  assert.ok(leavingGlassSnapshot, 'leaving glass should retain a texture snapshot');
  assert.strictEqual(
    leavingGlassSnapshot.style.backgroundImage,
    glassTexture,
    'the outgoing material texture should fade with the blurred wallpaper instead of disappearing immediately'
  );
}

async function testStandardGlassAdaptsToWallpaperLuminance() {
  const previousImage = sandbox.Image;
  sandbox.Image = class FakeImage {
    constructor() {
      this.naturalHeight = 800;
      this.naturalWidth = 1200;
    }

    decode() {
      return Promise.resolve();
    }

    set src(value) {
      this.currentSrc = value;
      setTimeout(() => this.onload(), 0);
    }
  };
  let imageUrl = 'test://dark-wallpaper';
  let sampleRgba = [24, 28, 36, 255];
  const bodyAttributes = new Map([['data-wallpaper-active', 'true']]);
  const createdCanvases = [];
  const body = {
    firstChild: null,
    style: { setProperty() {} },
    getAttribute(name) {
      return bodyAttributes.get(name) || null;
    },
    insertBefore(element) {
      element.parentNode = this;
      this.firstChild = element;
    }
  };
  const documentObj = {
    body,
    documentElement: { clientHeight: 800, clientWidth: 1200 },
    createElement() {
      const canvas = createFakeCanvas({ getSampleRgba: () => sampleRgba });
      createdCanvases.push(canvas);
      return canvas;
    }
  };
  const controller = effects.createWallpaperEffects({
    documentObj,
    windowObj: {
      devicePixelRatio: 1,
      innerHeight: 800,
      innerWidth: 1200,
      addEventListener() {},
      cancelAnimationFrame: clearTimeout,
      requestAnimationFrame(callback) {
        return setTimeout(callback, 0);
      }
    },
    getCurrentWallpaper: () => ({ id: imageUrl }),
    getWallpaperImageUrl: () => imageUrl,
    shouldAnimateTransition: () => false
  });
  try {
    controller.apply({ type: 'blur', texture: 100 });
    await controller.refresh({ immediate: true });
    assert.strictEqual(
      createdCanvases[0].style.mixBlendMode,
      'screen',
      'dark wallpaper averages should favor light-facing etched highlights'
    );

    imageUrl = 'test://light-wallpaper';
    sampleRgba = [232, 238, 244, 255];
    await controller.refresh({ immediate: true });
    assert.strictEqual(
      createdCanvases[0].style.mixBlendMode,
      'multiply',
      'light wallpaper averages should favor the etched shadow structure'
    );
  } finally {
    sandbox.Image = previousImage;
  }
}

async function testBlocksRenderDeterministicReliefFaces() {
  const previousImage = sandbox.Image;
  sandbox.Image = class FakeImage {
    constructor() {
      this.naturalHeight = 80;
      this.naturalWidth = 120;
    }

    decode() {
      return Promise.resolve();
    }

    set src(value) {
      this.currentSrc = value;
      setTimeout(() => this.onload(), 0);
    }
  };
  const bodyAttributes = new Map([['data-wallpaper-active', 'true']]);
  const createdCanvases = [];
  const body = {
    firstChild: null,
    style: { setProperty() {} },
    getAttribute(name) {
      return bodyAttributes.get(name) || null;
    },
    insertBefore(element) {
      element.parentNode = this;
      this.firstChild = element;
    }
  };
  const documentObj = {
    body,
    documentElement: { clientHeight: 80, clientWidth: 120 },
    createElement() {
      const canvas = createFakeCanvas({ getSampleRgba: () => [112, 156, 208, 255] });
      createdCanvases.push(canvas);
      return canvas;
    }
  };
  const controller = effects.createWallpaperEffects({
    documentObj,
    windowObj: {
      devicePixelRatio: 1,
      innerHeight: 80,
      innerWidth: 120,
      addEventListener() {},
      cancelAnimationFrame: clearTimeout,
      requestAnimationFrame(callback) {
        return setTimeout(callback, 0);
      }
    },
    getCurrentWallpaper: () => ({ id: 'blocks-wallpaper' }),
    getWallpaperImageUrl: () => 'test://blocks-wallpaper',
    shouldAnimateTransition: () => false
  });
  try {
    controller.apply({
      version: 11,
      type: 'blocks',
      strength: 70,
      size: 45,
      spacing: 25,
      texture: 40,
      blockSize: 3
    });
    await controller.refresh({ immediate: true });
    const effectCanvas = createdCanvases[0];
    assert.strictEqual(effectCanvas.getAttribute('data-effect'), 'blocks');
    assert.ok(
      effectCanvas._operations.some((operation) => operation.op === 'fill' && operation.points.length === 4),
      'Blocks should draw four-point side faces for visible extrusion'
    );
    assert.ok(
      effectCanvas._operations.some((operation) => operation.op === 'fill' &&
        operation.points.some((point) => Number.isFinite(point.radius))),
      'Blocks should add raised studs to sufficiently large top faces'
    );
    assert.ok(
      effectCanvas._operations.some((operation) => operation.op === 'fillRect' &&
        /rgb\(\d+ \d+ \d+\)/.test(String(operation.fillStyle))),
      'Blocks should preserve sampled wallpaper colors on their top faces'
    );
  } finally {
    sandbox.Image = previousImage;
  }
}

async function testCrtRendersPhosphorScanlinesAndColorFringe() {
  const previousImage = sandbox.Image;
  sandbox.Image = class FakeImage {
    constructor() {
      this.naturalHeight = 800;
      this.naturalWidth = 1200;
    }

    decode() {
      return Promise.resolve();
    }

    set src(value) {
      this.currentSrc = value;
      setTimeout(() => this.onload(), 0);
    }
  };
  const imageUrl = 'test://crt-wallpaper';
  const bodyAttributes = new Map([['data-wallpaper-active', 'true']]);
  const createdCanvases = [];
  const body = {
    firstChild: null,
    style: { setProperty() {} },
    getAttribute(name) {
      return bodyAttributes.get(name) || null;
    },
    insertBefore(element) {
      element.parentNode = this;
      this.firstChild = element;
    }
  };
  const documentObj = {
    body,
    documentElement: { clientHeight: 800, clientWidth: 1200 },
    createElement() {
      const canvas = createFakeCanvas({ getSampleRgba: () => [82, 116, 148, 255] });
      createdCanvases.push(canvas);
      return canvas;
    }
  };
  const controller = effects.createWallpaperEffects({
    documentObj,
    windowObj: {
      devicePixelRatio: 1,
      innerHeight: 800,
      innerWidth: 1200,
      addEventListener() {},
      cancelAnimationFrame: clearTimeout,
      requestAnimationFrame(callback) {
        return setTimeout(callback, 0);
      }
    },
    getCurrentWallpaper: () => ({ id: imageUrl }),
    getWallpaperImageUrl: () => imageUrl,
    shouldAnimateTransition: () => false
  });

  try {
    controller.apply({
      version: 11,
      type: 'crt',
      strength: 70,
      crtStrength: 14,
      size: 45,
      spacing: 60
    });
    await controller.refresh({ immediate: true });
    const effectCanvas = createdCanvases[0];
    assert.strictEqual(effectCanvas.getAttribute('data-effect'), 'crt');
    assert.ok(
      effectCanvas._operations.filter((operation) => operation.op === 'drawImage').length >= 3,
      'CRT should retain the wallpaper and add two subtle chromatic fringe passes'
    );
    assert.ok(
      createdCanvases.slice(1).some((candidate) => candidate._operations.some((operation) =>
        operation.op === 'fillRect' && /rgb\((?:255 38 48|38 255 132|38 94 255)/.test(String(operation.fillStyle)))),
      'CRT should build a repeating RGB phosphor-mask tile'
    );
    assert.ok(
      effectCanvas._operations.some((operation) => operation.op === 'fillRect' &&
        operation.fillStyle && Array.isArray(operation.fillStyle.colorStops)),
      'CRT should finish with a curved-screen vignette instead of a flat scanline overlay'
    );
  } finally {
    sandbox.Image = previousImage;
  }
}

function runEffectPreload({ focusRoute, imageReady, imageUrl = '' }) {
  const attributes = new Map();
  const body = {
    setAttribute(name, value) {
      attributes.set(name, String(value));
    }
  };
  const appliedPrefs = [];
  let refreshes = 0;
  const controller = {
    apply(prefs) {
      appliedPrefs.push(prefs);
    },
    refresh() {
      refreshes += 1;
      return Promise.resolve();
    }
  };
  const preloadSandbox = {
    console,
    document: {
      body,
      documentElement: {
        getAttribute(name) {
          return name === 'data-nt-focus-route' && focusRoute ? 'true' : null;
        }
      }
    },
    LumnoNewtabWallpaperEffects: {
      createWallpaperEffects() {
        return controller;
      },
      normalizePrefs(value) {
        return value;
      },
      resolvePrefsForMode(value) {
        return value;
      }
    },
    __lumnoBoot: { wallpaperPreload: {
      effectPrefsReady: Promise.resolve({ type: 'grain', strength: 50, size: 50, spacing: 50 }),
      imageUrl,
      imageReady,
      wallpaper: { id: 'test-wallpaper' }
    } },
    window: {}
  };
  preloadSandbox.globalThis = preloadSandbox;
  vm.runInNewContext(moduleScript('src/newtab/wallpaper/wallpaper-effect-preload.ts', undefined, null, { 'src/newtab/wallpaper/wallpaper-effects.ts': 'LumnoNewtabWallpaperEffects' }), preloadSandbox, {
    filename: 'src/newtab/wallpaper/wallpaper-effect-preload.ts'
  });
  return {
    attributes,
    appliedPrefs,
    getRefreshes: () => refreshes,
    runtime: preloadSandbox.__lumnoBoot?.wallpaperEffectPreload
  };
}

async function testFocusedRoutePreloadsEffectBeforeContent() {
  for (const focusRoute of [true, false]) {
    const preload = runEffectPreload({ focusRoute, imageUrl: 'chrome-extension://abc/assets/wallpapers/test.webp' });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    assert.strictEqual(preload.appliedPrefs.length, 1, 'both New Tab routes render the effect before the runtime');
    assert.strictEqual(preload.attributes.get('data-wallpaper-effect'), 'grain');
    assert.strictEqual(preload.attributes.get('data-nt-wallpaper-ready'), '1');
    assert.strictEqual(typeof preload.runtime.controller.refresh, 'function',
      'wallpaper.ts adopts the preload controller');
  }

  let resolveImage;
  const late = runEffectPreload({ focusRoute: false, imageReady: new Promise((resolve) => { resolveImage = resolve; }) });
  assert.ok(late.runtime.controller, 'the controller exists before the image does, so wallpaper.ts never starts its own');
  late.runtime.controller.apply({ type: 'dither' });
  resolveImage('data:image/webp;base64,AAAA');
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepStrictEqual(late.appliedPrefs, [{ type: 'dither' }],
    'cached preferences never replace ones wallpaper.ts already applied');
  assert.strictEqual(late.getRefreshes(), 0);
  assert.strictEqual(late.attributes.get('data-nt-wallpaper-ready'), undefined,
    'once wallpaper.ts owns the effect it also decides when the wallpaper is ready');
}

async function testBlurFrostUsesTheRememberedLuminance() {
  const previousImage = sandbox.Image;
  const pendingLoads = [];
  sandbox.Image = class DeferredImage {
    constructor() {
      this.naturalHeight = 800;
      this.naturalWidth = 1200;
    }

    decode() {
      return Promise.resolve();
    }

    set src(value) {
      this.currentSrc = value;
      pendingLoads.push(this);
    }
  };
  let sampleRgba = [232, 238, 244, 255];
  const createdCanvases = [];
  const hintRequests = [];
  const body = {
    firstChild: null,
    style: { setProperty() {} },
    getAttribute: (name) => (name === 'data-wallpaper-active' ? 'true' : null),
    insertBefore(element) {
      element.parentNode = this;
      this.firstChild = element;
    }
  };
  const controller = effects.createWallpaperEffects({
    documentObj: {
      body,
      documentElement: { clientHeight: 800, clientWidth: 1200 },
      createElement() {
        const canvas = createFakeCanvas({ getSampleRgba: () => sampleRgba });
        createdCanvases.push(canvas);
        return canvas;
      }
    },
    windowObj: {
      devicePixelRatio: 1,
      innerHeight: 800,
      innerWidth: 1200,
      addEventListener() {},
      cancelAnimationFrame: clearTimeout,
      requestAnimationFrame: (callback) => setTimeout(callback, 0)
    },
    getCurrentWallpaper: () => ({ id: 'remembered' }),
    getWallpaperImageUrl: () => 'test://remembered',
    shouldAnimateTransition: () => false,
    getLuminanceHint(imageUrl) {
      hintRequests.push(imageUrl);
      return 0.2;
    }
  });
  try {
    controller.apply({ type: 'blur', texture: 100 });
    await controller.refresh({ immediate: true });
    assert.deepStrictEqual(hintRequests.slice(-1), ['test://remembered']);
    assert.strictEqual(createdCanvases[0].style.mixBlendMode, 'screen',
      'the frost blends by the remembered luminance before the full image has decoded');
    assert.strictEqual(pendingLoads.length, 1, 'the image still loads, to confirm the remembered luminance');
    pendingLoads[0].onload();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(createdCanvases[0].style.mixBlendMode, 'multiply',
      'a wallpaper that measures differently than remembered redraws its frost');
  } finally {
    sandbox.Image = previousImage;
  }
}

async function testEffectReportsAStaleSourceUntilRedrawn() {
  const previousImage = sandbox.Image;
  sandbox.Image = class FakeImage {
    constructor() {
      this.naturalHeight = 800;
      this.naturalWidth = 1200;
    }

    decode() {
      return Promise.resolve();
    }

    set src(value) {
      this.currentSrc = value;
      setTimeout(() => this.onload(), 0);
    }
  };
  let imageUrl = 'test://yesterday';
  const body = {
    firstChild: null,
    style: { setProperty() {} },
    getAttribute: (name) => (name === 'data-wallpaper-active' ? 'true' : null),
    insertBefore(element) {
      element.parentNode = this;
      this.firstChild = element;
    }
  };
  const controller = effects.createWallpaperEffects({
    documentObj: {
      body,
      documentElement: { clientHeight: 800, clientWidth: 1200 },
      createElement: () => createFakeCanvas({ getSampleRgba: () => [120, 120, 120, 255] })
    },
    windowObj: {
      devicePixelRatio: 1,
      innerHeight: 800,
      innerWidth: 1200,
      addEventListener() {},
      cancelAnimationFrame: clearTimeout,
      requestAnimationFrame: (callback) => setTimeout(callback, 0)
    },
    getCurrentWallpaper: () => ({ id: 'bing-daily' }),
    getWallpaperImageUrl: () => imageUrl,
    shouldAnimateTransition: () => false
  });
  try {
    controller.apply({ type: 'dither', strength: 50, size: 50, spacing: 50 });
    await controller.refresh({ immediate: true });
    assert.strictEqual(controller.isSourceStale(), false, 'a freshly drawn effect matches its wallpaper');

    imageUrl = 'test://today';
    assert.strictEqual(controller.isSourceStale(), true,
      'a photo that changed without a redraw leaves the effect showing the old one');
    const redraw = controller.refresh({ immediate: true });
    assert.strictEqual(controller.isSourceStale(), false, 'a redraw on its way is not stale');
    await redraw;
    assert.strictEqual(controller.isSourceStale(), false);

    await controller.apply({ type: 'grain', strength: 50, size: 50, spacing: 50 });
    imageUrl = 'test://tomorrow';
    assert.strictEqual(controller.isSourceStale(), false, 'grain does not draw from the photo');
  } finally {
    sandbox.Image = previousImage;
  }
}

async function testEffectsSampleTheSmallCopyAndCrtTheFullImage() {
  const previousImage = sandbox.Image;
  const loads = [];
  sandbox.Image = class FakeImage {
    constructor() {
      this.naturalHeight = 288;
      this.naturalWidth = 512;
    }

    decode() {
      return Promise.resolve();
    }

    set src(value) {
      this.currentSrc = value;
      loads.push(value);
      setTimeout(() => (value === 'test://broken' ? this.onerror() : this.onload()), 0);
    }
  };
  const imageUrl = 'test://full';
  let sampleUrl = 'test://small';
  const getSample = () => ({ url: sampleUrl, width: 2048, height: 1152 });
  const createdCanvases = [];
  const body = {
    firstChild: null,
    style: { setProperty() {} },
    getAttribute: (name) => (name === 'data-wallpaper-active' ? 'true' : null),
    insertBefore(element) {
      element.parentNode = this;
      this.firstChild = element;
    }
  };
  const controller = effects.createWallpaperEffects({
    documentObj: {
      body,
      documentElement: { clientHeight: 800, clientWidth: 1200 },
      createElement() {
        const canvas = createFakeCanvas({ getSampleRgba: () => [120, 120, 120, 255] });
        createdCanvases.push(canvas);
        return canvas;
      }
    },
    windowObj: {
      devicePixelRatio: 1,
      innerHeight: 800,
      innerWidth: 1200,
      addEventListener() {},
      cancelAnimationFrame: clearTimeout,
      requestAnimationFrame: (callback) => setTimeout(callback, 0)
    },
    getCurrentWallpaper: () => ({ id: 'monet-coastal-white' }),
    getWallpaperImageUrl: () => imageUrl,
    getWallpaperSample: getSample,
    shouldAnimateTransition: () => false
  });
  try {
    for (const type of ['dither', 'halftone', 'ascii', 'blocks']) {
      await controller.apply({ type, strength: 50, size: 50, spacing: 50 });
      // The fake canvas cannot measure glyphs, so ASCII stops before it draws.
      if (type !== 'ascii') {
        assert.strictEqual(createdCanvases[0].getAttribute('data-effect'), type);
      }
    }
    assert.deepStrictEqual(loads, ['test://small'],
      'dither, halftone, ASCII and blocks sample the small copy, loaded once');
    assert.strictEqual(controller.isSourceStale(), false,
      'an effect drawn from the small copy shows the full image it stands for');

    await controller.apply({ type: 'crt', strength: 50, crtStrength: 14 });
    assert.deepStrictEqual(loads.slice(1), ['test://full'], 'CRT draws the full image');
    assert.strictEqual(createdCanvases[0].getAttribute('data-effect'), 'crt');

    loads.length = 0;
    await controller.apply({ type: 'dither', strength: 50, size: 50, spacing: 50 });
    assert.deepStrictEqual(loads, ['test://small'], 'leaving CRT samples the small copy again');

    loads.length = 0;
    sampleUrl = 'test://broken';
    await controller.apply({ type: 'halftone', strength: 50, size: 50, spacing: 50 });
    assert.deepStrictEqual(loads, ['test://broken', 'test://full'],
      'a small copy that fails to load falls back to the full image');
    assert.strictEqual(createdCanvases[0].getAttribute('data-effect'), 'halftone');
    assert.strictEqual(controller.isSourceStale(), false);
  } finally {
    sandbox.Image = previousImage;
  }
}

// The bundled small copy is the sampler's own image (520x293 for a 2048x1152 wallpaper), so read
// with the full image's size it must draw exactly what the full image draws.
async function testSmallCopyDrawsWhatTheFullImageDraws() {
  const previousImage = sandbox.Image;
  const sizes = { 'test://full': [2048, 1152], 'test://small': [520, 293] };
  sandbox.Image = class FakeImage {
    decode() {
      return Promise.resolve();
    }

    set src(value) {
      this.currentSrc = value;
      [this.naturalWidth, this.naturalHeight] = sizes[value];
      setTimeout(() => this.onload(), 0);
    }
  };
  // Every sampler pixel has its own color, so a sample taken one pixel off draws differently.
  const getSampleData = (width, height) => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let index = 0; index < width * height; index += 1) {
      data[index * 4] = (index * 37) % 256;
      data[(index * 4) + 1] = (index * 101) % 256;
      data[(index * 4) + 2] = (index * 13) % 256;
      data[(index * 4) + 3] = 255;
    }
    return data;
  };
  async function drawDither(sample) {
    const canvases = [];
    const controller = effects.createWallpaperEffects({
      documentObj: {
        body: {
          firstChild: null,
          style: { setProperty() {} },
          getAttribute: (name) => (name === 'data-wallpaper-active' ? 'true' : null),
          insertBefore(element) {
            element.parentNode = this;
            this.firstChild = element;
          }
        },
        documentElement: { clientHeight: 900, clientWidth: 1440 },
        createElement() {
          const canvas = createFakeCanvas({ getSampleData });
          canvases.push(canvas);
          return canvas;
        }
      },
      windowObj: {
        devicePixelRatio: 1,
        innerHeight: 900,
        innerWidth: 1440,
        addEventListener() {},
        cancelAnimationFrame: clearTimeout,
        requestAnimationFrame: (callback) => setTimeout(callback, 0)
      },
      getCurrentWallpaper: () => ({ id: 'monet-coastal-white' }),
      getWallpaperImageUrl: () => 'test://full',
      getWallpaperSample: () => sample,
      shouldAnimateTransition: () => false
    });
    await controller.apply({ type: 'dither', strength: 50, size: 0, spacing: 50 });
    const drawn = canvases.flatMap((canvas) => canvas._operations.filter((operation) => operation.op === 'putImageData'));
    assert.strictEqual(drawn.length, 1, 'dither draws one image');
    return drawn[0].data;
  }
  try {
    const fromFull = await drawDither(null);
    const fromCopy = await drawDither({ url: 'test://small', width: 2048, height: 1152 });
    assert.ok(fromFull.length > 0);
    assert.ok(fromFull.every((value, index) => value === fromCopy[index]),
      'the small copy, placed by the full image size, draws the same dither');
    const fromUnsizedCopy = await drawDither({ url: 'test://small', width: 0, height: 0 });
    assert.ok(fromFull.some((value, index) => value !== fromUnsizedCopy[index]),
      'without the full image size the samples shift (the check above can fail)');
  } finally {
    sandbox.Image = previousImage;
  }
}

Promise.resolve()
  .then(testEffectRefreshWaitsForPaint)
  .then(testEffectReportsAStaleSourceUntilRedrawn)
  .then(testEffectsSampleTheSmallCopyAndCrtTheFullImage)
  .then(testSmallCopyDrawsWhatTheFullImageDraws)
  .then(testStandardGlassRendersCachedMaterialTexture)
  .then(testGlassBackgroundAndTextureEnterTogether)
  .then(testStandardGlassAdaptsToWallpaperLuminance)
  .then(testBlocksRenderDeterministicReliefFaces)
  .then(testCrtRendersPhosphorScanlinesAndColorFringe)
  .then(testFocusedRoutePreloadsEffectBeforeContent)
  .then(testBlurFrostUsesTheRememberedLuminance)
  .then(() => {
  process.stdout.write('new tab wallpaper effects tests passed\n');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
