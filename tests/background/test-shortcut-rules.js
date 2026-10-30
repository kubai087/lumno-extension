const assert = require('assert');

const shortcutRules = require('../../src/background/shortcut-rules.ts');
const browserProfile = require('../../src/platform/browser-profile.ts');
const bundledShortcutRules = require('../../assets/data/shortcut-rules.json');
const vm = require('vm');
const { runModuleInContext } = require('../helpers/module-script');
const { getInjectedScripts, getPageScripts, runsBefore } = require('../helpers/runtime-scripts');

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
  assert(
    runsBefore(getInjectedScripts('overlay'), 'src/platform/browser-profile.ts', 'src/overlay/app/main.ts'),
    'overlay injection should load browser-profile before the overlay entry'
  );
  assert(
    runsBefore(getPageScripts('newtab.html'), 'src/platform/browser-profile.ts', 'src/newtab/app/main.ts'),
    'newtab should load browser-profile before its page entry'
  );
}

// The search panels' keyword rows ("ext" opens the extensions page) should
// point at the browser the page runs in, and only for the word on its own.
function testKeywordRowsFollowTheBrowser() {
  const rules = [{ type: 'browserPage', keys: ['ext '], path: 'extensions' }];
  const suggestionsFor = (userAgent, input = 'ext') => {
    const context = vm.createContext({ navigator: { userAgent }, URL, chrome: null });
    context.window = context;
    context.globalThis = context;
    const { QuickNavigation } = runModuleInContext('src/shared/search-panel/quick-navigation.ts', context, '__navigation');
    const navigation = new QuickNavigation({
      locale: { formatMessage: (_key, fallback, values) => fallback.replace(/\{(\w+)\}/g, (_match, name) => values[name]) },
      getFaviconUrl: () => ''
    });
    return Array.from(navigation.keywordRows(input, rules), (item) => ({ url: item.url, title: item.title }));
  };
  assert.deepStrictEqual(
    suggestionsFor('Mozilla/5.0 Chrome/149 Safari/537.36 Edg/149'),
    [{ url: 'edge://extensions', title: '打开 Microsoft Edge：edge://extensions' }]
  );
  assert.deepStrictEqual(suggestionsFor('Mozilla/5.0 Chrome/149 Safari/537.36').map((item) => item.url), ['chrome://extensions']);
  assert.deepStrictEqual(suggestionsFor('Mozilla/5.0 Chrome/149 Safari/537.36', 'ext lumno'), [],
    'a query that only starts with a rule word should not offer the page');
}

function testShortcutUrlMatching() {
  const rules = [
    { type: 'browserPage', keys: ['ext ', 'extensions '], path: 'extensions' },
    { type: 'url', keys: ['lumno '], url: 'https://lumno.app' },
    { type: 'url', keys: ['bad '] }
  ];

  assert.strictEqual(
    shortcutRules.getShortcutUrlForScheme(' ext ', rules, 'edge://'),
    'edge://extensions'
  );
  assert.strictEqual(
    shortcutRules.getShortcutUrlForScheme('LUMNO', rules, 'chrome://'),
    'https://lumno.app'
  );
  assert.strictEqual(shortcutRules.getShortcutUrlForScheme('ext test', rules, 'edge://'), null,
    'words after a rule word should search instead');
  assert.strictEqual(shortcutRules.getShortcutUrlForScheme('extra', rules, 'edge://'), null);
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
  assert.strictEqual(api.getShortcutUrl('history', rules), 'edge://history');
  assert.strictEqual(api.getShortcutUrl('history of rome', rules), null);
}

function testBundledChromePageRules() {
  const rules = bundledShortcutRules.items;
  const cases = [
    ['扩展程序', 'chrome://extensions/'],
    ['フラグ', 'chrome://flags/'],
    ['设置', 'chrome://settings/'],
    ['ショートカット', 'chrome://extensions/shortcuts'],
    ['web store', 'https://chromewebstore.google.com/'],
    ['history', 'chrome://history'],
    ['browser  history', 'chrome://history'],
    ['下载记录', 'chrome://downloads'],
    ['書籤', 'chrome://bookmarks'],
    ['密码', 'chrome://password-manager/passwords'],
    ['新規タブ', 'chrome://newtab'],
    ['版本', 'chrome://version'],
    ['内部页面', 'chrome://about'],
    ['chrome urls', 'chrome://chrome-urls'],
    ['gpu status', 'chrome://gpu'],
    ['GPU', 'chrome://gpu'],
    ['network log', 'chrome://net-export'],
    ['dns cache', 'chrome://dns'],
    ['クラッシュ', 'chrome://crashes'],
    ['inspect devices', 'chrome://inspect'],
    ['service worker', 'chrome://serviceworker-internals'],
    ['存储配额', 'chrome://quota-internals'],
    ['站点参与度', 'chrome://site-engagement'],
    ['タブ破棄', 'chrome://discards'],
    ['webrtc debug', 'chrome://webrtc-internals'],
    ['trace', 'chrome://tracing'],
    ['policies', 'chrome://policy'],
    ['管理ページ', 'chrome://management']
  ];

  cases.forEach(([query, expectedUrl]) => {
    assert.strictEqual(
      shortcutRules.getShortcutUrlForScheme(query, rules, 'chrome://'),
      expectedUrl,
      `expected "${query}" to open ${expectedUrl}`
    );
  });
  ['history of rome', 'histogram', 'passport', 'setup guide', 'extra', 'scala'].forEach((query) => {
    assert.strictEqual(shortcutRules.getShortcutUrlForScheme(query, rules, 'chrome://'), null,
      `expected "${query}" to be searched`);
  });
}

(async () => {
  await testLoadShortcutRules();
  await testLoadShortcutRulesFallback();
  testBrowserScheme();
  testBrowserProfileUsesClientHintBrand();
  testBrowserProfileRuntimeWiring();
  testKeywordRowsFollowTheBrowser();
  testShortcutUrlMatching();
  await testInstanceShortcutUrl();
  testBundledChromePageRules();
  console.log('shortcut rules tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
