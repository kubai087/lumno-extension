const assert = require('assert');
const fs = require('fs');
const path = require('path');

const shortcutRules = require('../src/background/shortcut-rules.js');
const browserProfile = require('../src/shared/browser-profile.js');
const bundledShortcutRules = require('../assets/data/shortcut-rules.json');
const { readPageSource } = require('./helpers/page-source');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

function createResponse(data) {
  return {
    json: () => Promise.resolve(data)
  };
}

async function testLoadShortcutRules() {
  const requestedUrls = [];
  const api = shortcutRules.create({
    chromeApi: {
      runtime: {
        getURL: (path) => `chrome-extension://id/${path}`
      }
    },
    navigatorLike: { userAgent: 'Chrome' },
    fetchImpl: (url) => {
      requestedUrls.push(url);
      return Promise.resolve(createResponse({
        items: [
          { type: 'browserPage', keys: ['ext '], path: 'extensions' }
        ]
      }));
    }
  });

  const first = await api.loadShortcutRules();
  const second = await api.loadShortcutRules();
  assert.deepStrictEqual(first, [{ type: 'browserPage', keys: ['ext '], path: 'extensions' }]);
  assert.strictEqual(second, first);
  assert.deepStrictEqual(requestedUrls, ['chrome-extension://id/assets/data/shortcut-rules.json']);
}

async function testLoadShortcutRulesFallback() {
  const api = shortcutRules.create({
    fetchImpl: () => Promise.resolve(createResponse({ items: 'not-an-array' }))
  });
  assert.deepStrictEqual(await api.loadShortcutRules(), []);
}

function testBrowserScheme() {
  assert.strictEqual(browserProfile.getBrowserInternalScheme('Chrome Edg/123'), 'edge://');
  assert.strictEqual(browserProfile.getBrowserInternalScheme('Chrome Brave'), 'brave://');
  assert.strictEqual(browserProfile.getBrowserInternalScheme('Vivaldi'), 'vivaldi://');
  assert.strictEqual(browserProfile.getBrowserInternalScheme('OPR/99'), 'opera://');
  assert.strictEqual(browserProfile.getBrowserInternalScheme('Chrome'), 'chrome://');
  const firefoxUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:157.0) Gecko/20100101 Firefox/157.0';
  assert.deepStrictEqual(
    browserProfile.getBrowserInternalProfile({ userAgent: firefoxUserAgent }),
    { scheme: 'about:', name: 'Firefox' }
  );
  assert.strictEqual(browserProfile.canOpenBrowserPages('about:'), false,
    'Firefox blocks extensions from opening privileged about: pages');
  assert.strictEqual(browserProfile.canOpenBrowserPages('chrome://'), true);
}

function testBrowserProfileUsesClientHintBrand() {
  assert.deepStrictEqual(
    browserProfile.getBrowserInternalProfile({
      userAgent: 'Mozilla/5.0 Chrome/149 Safari/537.36',
      userAgentData: {
        brands: [
          { brand: 'Not.A/Brand', version: '99' },
          { brand: 'Chromium', version: '149' },
          { brand: 'Dia', version: '1' }
        ]
      }
    }),
    { scheme: 'chrome://', name: 'Dia' }
  );

  assert.deepStrictEqual(
    browserProfile.getBrowserInternalProfile({
      userAgent: 'Mozilla/5.0 Chrome/149 Safari/537.36',
      userAgentData: {
        brands: [
          { brand: 'Comet', version: '1' },
          { brand: 'Chromium', version: '149' }
        ]
      }
    }),
    { scheme: 'chrome://', name: 'Comet' }
  );

  assert.deepStrictEqual(
    browserProfile.getBrowserInternalProfile({
      userAgent: 'Mozilla/5.0 Chrome Edg/149 Safari/537.36'
    }),
    { scheme: 'edge://', name: 'Microsoft Edge' }
  );
}

function testBrowserProfileRuntimeWiring() {
  const repoRoot = path.join(__dirname, '..');
  const backgroundSource = fs.readFileSync(path.join(repoRoot, 'src/background/background.js'), 'utf8');
  const newtabHtml = readPageSource('newtab.html');
  const newtabSource = readNewtabRuntimeSource();
  const onboardingHtml = readPageSource('src/onboarding/onboarding.html');
  const overlaySource = fs.readFileSync(path.join(repoRoot, 'src/overlay/search-panel.js'), 'utf8');

  assert(
    backgroundSource.indexOf("chrome.runtime.getURL('src/shared/browser-profile.js')") <
      backgroundSource.indexOf("chrome.runtime.getURL('src/background/shortcut-rules.js')"),
    'background should load browser-profile before shortcut-rules'
  );
  assert(
    backgroundSource.indexOf("'src/shared/browser-profile.js'") <
      backgroundSource.indexOf("'src/overlay/search-panel.js'"),
    'overlay injection should load browser-profile before search-panel'
  );
  assert(
    newtabHtml.indexOf('../shared/browser-profile.js') < newtabHtml.indexOf('../newtab/newtab.js'),
    'newtab should load browser-profile before its page entry'
  );
  assert(
    onboardingHtml.indexOf('../shared/browser-profile.js') < onboardingHtml.indexOf('../overlay/search-panel.js'),
    'onboarding preview should load browser-profile before overlay search'
  );
  assert.match(newtabSource, /BROWSER_PROFILE\.getBrowserInternalProfile\(navigator\)/);
  assert.match(overlaySource, /BROWSER_PROFILE\.getBrowserInternalProfile\(navigator\)/);
  [newtabSource, overlaySource].forEach((source) => {
    assert.doesNotMatch(source, /function getBrowserInternalScheme\(/);
    assert.doesNotMatch(source, /function getClientHintBrowserName\(/);
  });
}

function testShortcutUrlMatching() {
  const rules = [
    { type: 'browserPage', keys: ['ext ', 'extensions '], path: 'extensions' },
    { type: 'url', keys: ['lumno '], url: 'https://lumno.app' },
    { type: 'url', keys: ['bad '] }
  ];

  assert.strictEqual(
    shortcutRules.getShortcutUrlForScheme('ext test', rules, 'edge://'),
    'edge://extensions'
  );
  assert.strictEqual(
    shortcutRules.getShortcutUrlForScheme('LUMNO app', rules, 'chrome://'),
    'https://lumno.app'
  );
  assert.strictEqual(shortcutRules.getShortcutUrlForScheme('missing', rules, 'chrome://'), null);
  assert.strictEqual(shortcutRules.getShortcutUrlForScheme('', rules, 'chrome://'), null);
  assert.strictEqual(shortcutRules.getShortcutUrlForScheme('ext test', null, 'chrome://'), null);
}

async function testInstanceShortcutUrl() {
  const api = shortcutRules.create({
    navigatorLike: { userAgent: 'Chrome Edg/123' }
  });
  const rules = [
    { type: 'browserPage', keys: ['history '], path: 'history' }
  ];
  assert.strictEqual(api.getShortcutUrl('history today', rules), 'edge://history');
}

function testBundledChromePageRules() {
  const rules = bundledShortcutRules.items;
  const cases = [
    ['扩展程序', 'chrome://extensions/'],
    ['フラグ', 'chrome://flags/'],
    ['设置', 'chrome://settings/'],
    ['ショートカット', 'chrome://extensions/shortcuts'],
    ['web store', 'https://chromewebstore.google.com/'],
    ['history today', 'chrome://history'],
    ['下载记录', 'chrome://downloads'],
    ['書籤', 'chrome://bookmarks'],
    ['密码', 'chrome://password-manager/passwords'],
    ['新規タブ', 'chrome://newtab'],
    ['版本', 'chrome://version'],
    ['内部页面', 'chrome://about'],
    ['chrome urls', 'chrome://chrome-urls'],
    ['gpu status', 'chrome://gpu'],
    ['network log', 'chrome://net-export'],
    ['dns cache', 'chrome://dns'],
    ['クラッシュ', 'chrome://crashes'],
    ['inspect devices', 'chrome://inspect'],
    ['service worker', 'chrome://serviceworker-internals'],
    ['存储配额', 'chrome://quota-internals'],
    ['站点参与度', 'chrome://site-engagement'],
    ['タブ破棄', 'chrome://discards'],
    ['webrtc debug', 'chrome://webrtc-internals'],
    ['tracing trace', 'chrome://tracing'],
    ['policy list', 'chrome://policy'],
    ['管理ページ', 'chrome://management']
  ];

  cases.forEach(([query, expectedUrl]) => {
    assert.strictEqual(
      shortcutRules.getShortcutUrlForScheme(query, rules, 'chrome://'),
      expectedUrl,
      `expected "${query}" to open ${expectedUrl}`
    );
  });
}

(async () => {
  await testLoadShortcutRules();
  await testLoadShortcutRulesFallback();
  testBrowserScheme();
  testBrowserProfileUsesClientHintBrand();
  testBrowserProfileRuntimeWiring();
  testShortcutUrlMatching();
  await testInstanceShortcutUrl();
  testBundledChromePageRules();
  console.log('shortcut rules tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
