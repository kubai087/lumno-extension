const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');
const { parseCss } = require('../helpers/css-rules');
const { getBundleFiles, getInjectedScripts, getManifestContentScripts, runsBefore } = require('../helpers/runtime-scripts');

const repoRoot = path.resolve(__dirname, '..', '..');
const preloadPath = path.join(repoRoot, 'src/shared/icon-font-preload.ts');
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'manifest.json'), 'utf8'));
const remixCss = fs.readFileSync(
  path.join(repoRoot, 'assets/remixicon/fonts/remixicon.css'),
  'utf8'
);
const optionsDocument = new JSDOM(
  fs.readFileSync(path.join(repoRoot, 'src/options/options.html'), 'utf8')
).window.document;
const fallbackSvgAssets = [
  'assets/remixicon/icons/search-line.svg',
  'assets/remixicon/icons/settings-line.svg',
  'assets/remixicon/icons/brush-2-line.svg'
];

assert(
  fs.existsSync(preloadPath),
  'shared icon font preloader should exist'
);

const appended = [];
const elements = new Map();
const documentObject = {
  head: {
    appendChild(node) {
      appended.push(node);
      if (node.id) {
        elements.set(node.id, node);
      }
    }
  },
  documentElement: {},
  createElement(tagName) {
    return {
      as: '',
      crossOrigin: '',
      fetchPriority: '',
      href: '',
      id: '',
      rel: '',
      tagName: String(tagName).toUpperCase(),
      type: ''
    };
  },
  getElementById(id) {
    return elements.get(id) || null;
  }
};
const sandbox = {
  chrome: {
    runtime: {
      getURL(relativePath) {
        return `chrome-extension://lumno/${relativePath}`;
      }
    }
  },
  document: documentObject
};
sandbox.globalThis = sandbox;

const preloadSource = fs.readFileSync(preloadPath, 'utf8');
vm.runInNewContext(preloadSource, sandbox, { filename: 'icon-font-preload.js' });
vm.runInNewContext(preloadSource, sandbox, { filename: 'icon-font-preload.js' });

assert.strictEqual(appended.length, 4, 'Remix asset preloads should be idempotent');
const fontPreload = appended.find((node) => (
  node.id === '_x_extension_remixicon_font_preload_2026_unique_'
));
assert(fontPreload, 'the existing Remix font should still be warmed');
assert.strictEqual(fontPreload.rel, 'preload');
assert.strictEqual(fontPreload.as, 'font');
assert.strictEqual(fontPreload.type, 'font/woff2');
assert.strictEqual(fontPreload.crossOrigin, 'anonymous');
assert.strictEqual(fontPreload.fetchPriority, 'high');
assert.strictEqual(
  fontPreload.href,
  'chrome-extension://lumno/assets/remixicon/fonts/remixicon.woff2'
);
const svgPreloads = appended.filter((node) => node.as === 'image');
assert.deepStrictEqual(
  svgPreloads.map((node) => node.href),
  fallbackSvgAssets.map((assetPath) => `chrome-extension://lumno/${assetPath}`),
  'the first-frame Remix SVG masks should be warmed before Overlay React mounts'
);
svgPreloads.forEach((node) => {
  assert.strictEqual(node.rel, 'preload');
  assert.strictEqual(node.type, 'image/svg+xml');
  assert.strictEqual(node.fetchPriority, 'high');
});
fallbackSvgAssets.forEach((assetPath) => {
  const svg = fs.readFileSync(path.join(repoRoot, assetPath), 'utf8');
  assert.match(
    svg,
    /^<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http:\/\/www\.w3\.org\/2000\/svg">/,
    `${assetPath} should remain the cached, theme-tintable official Remix SVG`
  );
});
assert(
  manifest.web_accessible_resources.some((entry) => (
    Array.isArray(entry.resources) &&
    entry.resources.includes('assets/remixicon/icons/*.svg')
  )),
  'the cached Remix SVGs must be available to the isolated Overlay Shadow DOM'
);
const remixFontFace = parseCss(remixCss).entries.find((entry) => (
  entry.selectors.length === 0 && /remixicon/.test(entry.style.getPropertyValue('font-family'))
));
assert(
  remixFontFace && /url\("?remixicon\.woff2"?\) format\("woff2"\)/.test(remixFontFace.style.getPropertyValue('src')),
  'the Remix stylesheet should request the exact URL that was preloaded'
);

const startupContentScriptIndex = manifest.content_scripts.findIndex((entry) => (
  Array.isArray(entry.matches) &&
  entry.matches.includes('<all_urls>') &&
  entry.run_at === 'document_start'
));
const startupScripts = startupContentScriptIndex >= 0
  ? getManifestContentScripts()[startupContentScriptIndex]
  : [];
assert(startupScripts.includes('src/content/shortcut-key-observer.ts'),
  'the ordinary-page startup content script should remain declared');
assert.strictEqual(
  startupScripts.includes('src/shared/icon-font-preload.ts'),
  false,
  'ordinary pages should not preload an extension font before Overlay UI is requested'
);

assert(
  runsBefore(getInjectedScripts('overlay'), 'src/shared/icon-font-preload.ts', 'src/overlay/app/main.ts'),
  'existing tabs should start warming the icon font before Overlay React/runtime injection'
);
assert(
  runsBefore(getInjectedScripts('tabSwitcher'), 'src/shared/icon-font-preload.ts', 'src/shared/tab-switcher/tab-switcher.ts'),
  'the standalone tab switcher should also warm the icon font before rendering'
);
const optionsPreload = optionsDocument.querySelector('script[src="../../build/options-preload.js"]');
const firstStylesheet = optionsDocument.querySelector('link[rel="stylesheet"]');
assert(
  getBundleFiles('options-preload')[0] === 'src/shared/icon-font-preload.ts' &&
    optionsPreload && firstStylesheet &&
    (optionsPreload.compareDocumentPosition(firstStylesheet) & 4),
  'Options should warm the icon font before its stylesheets'
);

console.log('Overlay icon font preload tests passed');
