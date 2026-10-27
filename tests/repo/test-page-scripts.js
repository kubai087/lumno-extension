const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { extensionOutputPath } = require('../../scripts/build/extension-output');
const { parseCss } = require('../helpers/css-rules');
const { readPageSource } = require('../helpers/page-source');
const { routeFiles } = require('../helpers/built-scripts');
const { createNewtabPage } = require('../helpers/newtab-page');
const { createOnboardingPage } = require('../helpers/onboarding-page');
const { createOptionsPage } = require('../helpers/options-page');
const { createOverlayPage } = require('../helpers/overlay-runtime-harness');

// How the extension pages load their scripts and what the built scripts
// carry. Run npm run build first.

const repoRoot = path.resolve(__dirname, '..', '..');
const buildDir = extensionOutputPath('build');
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

const pages = [
  { page: 'newtab.html', entry: 'newtab', preloads: ['newtab-preload', 'cjk-font-faces', 'wallpaper-effect-preload'] },
  { page: 'src/options/options.html', entry: 'options', preloads: ['options-preload', 'cjk-font-faces'] },
  { page: 'src/onboarding/onboarding.html', entry: 'onboarding', preloads: ['onboarding-preload', 'cjk-font-faces'] },
  { page: 'src/popup/popup.html', entry: 'popup', preloads: ['cjk-font-faces', 'popup-preload'] }
];

function readRoute(entry) {
  const files = routeFiles(buildDir, [`${entry}.js`]);
  assert(files, `build/${entry}.js and its chunks should be built; run npm run build first`);
  return files.map((file) => fs.readFileSync(path.join(buildDir, file), 'utf8')).join('\n');
}

// Each page loads its classic scripts, then one module entry once its markup
// is parsed; nothing comes from outside the extension.
pages.forEach(({ page, entry, preloads }) => {
  const scripts = Array.from(new JSDOM(readPageSource(page)).window.document.scripts);
  const modules = scripts.filter((script) => script.type === 'module');
  assert.deepStrictEqual(modules.map((script) => script.getAttribute('src')), [`../../build/${entry}.js`],
    `${page} should load its page entry as its only module script`);
  assert.deepStrictEqual(
    scripts.filter((script) => script.type !== 'module').map((script) => script.getAttribute('src')),
    preloads.map((name) => `../../build/${name}.js`),
    `${page} should load only its preloads as classic scripts`
  );
  assert(scripts.every((script) => !/^https?:\/\//i.test(script.getAttribute('src') || '')),
    `${page} should not load scripts from outside the extension`);
});

// Every page shares React's runtime chunk; only the pages that host the tab
// switcher carry its view.
const routes = Object.fromEntries(pages.map(({ entry }) => [entry, readRoute(entry)]));
pages.forEach(({ entry }) => {
  assert(routeFiles(buildDir, [`${entry}.js`]).includes('chunks/react-runtime.js'),
    `${entry} should load React from the shared runtime chunk`);
});
['newtab', 'options'].forEach((entry) => {
  assert(routes[entry].includes('overlay-tab-switcher'), `${entry} should carry the in-page tab switcher view`);
});
assert(!routes.popup.includes('overlay-tab-switcher'), 'the toolbar popup should not carry the tab switcher view');

// The built scripts are production builds and safe under the extension CSP.
function listScripts(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listScripts(file);
    }
    return entry.name.endsWith('.js') ? [file] : [];
  });
}
listScripts(buildDir).forEach((file) => {
  const source = fs.readFileSync(file, 'utf8');
  const name = path.relative(buildDir, file);
  assert(!source.includes('process.env.NODE_ENV'), `${name} should be a production build`);
  assert(!/\beval\(|new Function\b/.test(source), `${name} should not evaluate code from strings`);
});

assert(
  ['account', 'shortcuts', 'blacklist', 'labs'].every((tab) => {
    const host = new JSDOM(readPageSource('src/options/options.html')).window.document.querySelector(`[data-content="${tab}"]`);
    return host && host.children.length === 0;
  }),
  'Options tabs drawn by React should not retain legacy DOM in the markup'
);
assert(
  packageJson.scripts.build === 'npm run build:static && npm run build:entries' &&
    packageJson.scripts['build:entries'] === 'node scripts/build/build.js',
  'npm run build should copy the static files, then build every entry'
);
assert(
  packageJson.scripts.test.includes('test:legacy') && packageJson.scripts.test.includes('test:react') &&
    packageJson.scripts.check.includes('npm run build') && packageJson.scripts.check.includes('check:static') &&
    packageJson.scripts.verify.includes('npm test') && packageJson.scripts.verify.includes('check:static'),
  'the local verification command should run both test suites and the same static checks as npm run check'
);
assert(packageJson.dependencies.react && packageJson.dependencies['react-dom'], 'React runtime dependencies should be explicit');
{
  const overlaySuggestionsCss = fs.readFileSync(path.join(repoRoot, 'src/overlay/suggestions-view.css'), 'utf8');
  const mark = parseCss(overlaySuggestionsCss).entries.find((entry) => entry.selectors.some((selector) => selector.endsWith('.x-ov-suggestion-mark')) &&
    entry.style.getPropertyValue('background'));
  assert.deepStrictEqual(mark && [mark.style.getPropertyValue('background').trim(), mark.style.getPropertyValue('color').trim()],
    ['var(--x-ext-mark-bg, #CFE8FF)', 'var(--x-ext-mark-text, #1E3A8A)'],
    'the Overlay query mark should retain its themed background and text colors');
}

// The running pages render their React views.
async function testPages() {
  const newtab = await createNewtabPage({});
  await newtab.settle(300);
  const islands = new Set(Array.from(newtab.document.querySelectorAll('[data-react-island]')).map((node) => node.getAttribute('data-react-island')));
  ['newtab-feedback-control', 'newtab-bottom-dock', 'newtab-wordmark', 'shared-search-input'].forEach((island) => {
    assert.ok(islands.has(island), `New Tab should render its ${island} view`);
  });
  newtab.close();

  const options = await createOptionsPage({});
  await options.settle(300);
  assert.ok(options.document.querySelectorAll('._x_extension_section_title_2024_unique_').length > 5, 'Options should draw its tabs');
  options.close();

  const onboarding = await createOnboardingPage({});
  await onboarding.settle(200);
  assert.strictEqual(onboarding.document.getElementById('onboarding-root').getAttribute('data-react-island'), 'onboarding-page');
  assert.ok(onboarding.document.getElementById('onboarding-page-strip'), 'Onboarding should draw the page through its view');
  onboarding.close();
}

// The overlay mounts inside the fullscreen element when there is one, enters
// the browser top layer and focuses its input as part of the reveal.
async function testOverlayMount() {
  let fullscreen = null;
  let popovers = 0;
  const page = await createOverlayPage({
    stylesheetsLoad: true,
    setup(window) {
      fullscreen = window.document.createElement('div');
      window.document.body.appendChild(fullscreen);
      Object.defineProperty(window.document, 'fullscreenElement', { configurable: true, get: () => fullscreen });
      window.HTMLElement.prototype.showPopover = function() { popovers += 1; };
    }
  });
  const root = await page.open({});
  await page.settle(200);
  assert.strictEqual(root.host.parentNode, fullscreen, 'the Overlay panel should stay inside the fullscreen subtree');
  assert.strictEqual(popovers, 1, 'and enter the browser top layer');
  assert.strictEqual(root.activeElement && root.activeElement.tagName, 'INPUT', 'and focus its input as part of the reveal');
  page.close();
}

(async () => {
  await testPages();
  await testOverlayMount();
  console.log('page script tests passed');
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
