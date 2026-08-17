const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..');
const preloadPath = path.join(repoRoot, 'src/shared/icon-font-preload.js');
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'manifest.json'), 'utf8'));
const backgroundSource = fs.readFileSync(path.join(repoRoot, 'src/background/background.js'), 'utf8');
const remixCss = fs.readFileSync(
  path.join(repoRoot, 'assets/remixicon/fonts/remixicon.css'),
  'utf8'
);
const optionsHtml = fs.readFileSync(path.join(repoRoot, 'src/options/options.html'), 'utf8');
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
assert(
  remixCss.includes('src: url("remixicon.woff2") format("woff2");'),
  'the Remix stylesheet should request the exact URL that was preloaded'
);

const startupContentScript = manifest.content_scripts.find((entry) => (
  Array.isArray(entry.matches) &&
  entry.matches.includes('<all_urls>') &&
  entry.run_at === 'document_start' &&
  Array.isArray(entry.js) &&
  entry.js.includes('src/content/hotkey-listener.js')
));
assert(startupContentScript, 'the ordinary-page startup content script should remain declared');
const startupScripts = startupContentScript.js;
assert.strictEqual(
  startupScripts.includes('src/shared/icon-font-preload.js'),
  false,
  'ordinary pages should not preload an extension font before Overlay UI is requested'
);

const overlayInjectionStart = backgroundSource.indexOf('const overlayInjectionFiles = [');
const overlayInjectionEnd = backgroundSource.indexOf('];', overlayInjectionStart);
const overlayInjectionBlock = backgroundSource.slice(overlayInjectionStart, overlayInjectionEnd);
assert(
  overlayInjectionBlock.indexOf("'src/shared/icon-font-preload.js'") >= 0 &&
    overlayInjectionBlock.indexOf("'src/shared/icon-font-preload.js'") <
      overlayInjectionBlock.indexOf("'src/react/overlay-islands.js'"),
  'existing tabs should start warming the icon font before Overlay React/runtime injection'
);

const switcherInjectionStart = backgroundSource.indexOf('const runDynamicSwitcherScript = (switcherContext) => {');
const switcherInjectionEnd = backgroundSource.indexOf('runDynamicSwitcherScript(switcherContext);', switcherInjectionStart);
const switcherInjectionBlock = backgroundSource.slice(switcherInjectionStart, switcherInjectionEnd);
assert(
  switcherInjectionBlock.indexOf("'src/shared/icon-font-preload.js'") >= 0 &&
    switcherInjectionBlock.indexOf("'src/shared/icon-font-preload.js'") <
      switcherInjectionBlock.indexOf("'src/react/overlay-islands.js'"),
  'the standalone tab switcher should also warm the icon font before rendering'
);
assert(
  optionsHtml.indexOf('<script src="../shared/icon-font-preload.js"></script>') >= 0 &&
    optionsHtml.indexOf('<script src="../shared/icon-font-preload.js"></script>') <
      optionsHtml.indexOf('<link rel="stylesheet"'),
  'Options should warm the icon font before its stylesheets'
);

console.log('Overlay icon font preload tests passed');
