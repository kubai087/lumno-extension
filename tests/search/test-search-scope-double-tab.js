const assert = require('assert');
const fs = require('fs');
const search = require('../helpers/search-utils.ts');
const { SURFACES, openSearchSurface } = require('../helpers/search-surfaces');

// Two quick Tabs in an empty search input open the scope panel on the
// default scope; with a scope already active, one Tab does. The gesture's
// timing rules are covered by src/shared/react/search-input-mode.test.ts.

const ENGINE_KEY = '_x_extension_default_search_engine_2024_unique_';
const LANGUAGE_KEY = '_x_extension_language_2024_unique_';
const BING = { id: 'bing', host: 'www.bing.com', name: 'Bing', searchTemplate: 'https://www.bing.com/search?q={query}' };

function stored(name, values) {
  return name === 'overlay' ? { settings: values } : { sync: values, local: values };
}

function footerHints(surface) {
  return Array.from(surface.root.querySelectorAll('.x-lumno-search-input-mode__menu-footer-hint')).map((hint) => hint.textContent);
}

async function doubleTab(surface) {
  surface.press('Tab');
  await surface.settle(10);
  surface.press('Tab');
  await surface.settle(150);
}

async function testDoubleTabOpensTheDefaultEngine(name) {
  const surface = await openSearchSurface(name, stored(name, { [ENGINE_KEY]: BING }));
  await surface.settle(100);
  await doubleTab(surface);
  assert.strictEqual(surface.scopeLabel(), 'Bing', `${name}: double Tab should start from the browser's search engine`);
  assert.ok(surface.scopeMenuOpen(), `${name}: double Tab should open the scope panel`);
  assert.deepStrictEqual(footerHints(surface).slice(0, 3), ['←↑↓→Move', 'EnterSwitch', 'TabSwitch focus'],
    `${name}: the panel should explain its keys`);
  surface.close();
}

// (In the overlay a single Tab already activates the open-tabs scope, so a
// later Tab opens the panel for it.)
async function testSlowTabsDoNotCountOnNewTab() {
  const name = 'newtab';
  const surface = await openSearchSurface(name);
  surface.press('Tab');
  await surface.settle(900);
  surface.press('Tab');
  await surface.settle(100);
  assert.strictEqual(surface.scopeMenuOpen(), false, `${name}: two Tabs far apart are not a double Tab`);
  surface.close();
}

async function testOneTabOpensThePanelForAnActiveScope(name) {
  const surface = await openSearchSurface(name);
  await surface.type('history');
  surface.press('Tab');
  await surface.settle(80);
  await surface.type('cats');
  surface.press('Tab');
  await surface.settle(80);
  assert.deepStrictEqual([surface.scopeLabel(), surface.scopeMenuOpen(), surface.input().value], ['History', true, 'cats'],
    `${name}: with a scope active, one Tab should open the panel and keep the query`);
  surface.close();
}

async function testPanelHintFollowsTheLanguage(name) {
  const surface = await openSearchSurface(name);
  if (name === 'overlay') {
    surface.page.changeSetting(LANGUAGE_KEY, 'ja');
  } else {
    surface.page.changeStorage('sync', LANGUAGE_KEY, 'ja');
  }
  await surface.settle(200);
  const hints = footerHints(surface);
  assert.ok(hints[hints.length - 1].endsWith('パネルを開く'), `${name}: the panel hint should follow a language change`);
  surface.close();
}

async function testShortcutNamesThePlatformKey() {
  const mac = await openSearchSurface('newtab', { platform: 'MacIntel' });
  assert.strictEqual(footerHints(mac).pop(), '⇥ ⇥Open panel', 'macOS should show the Tab key symbol');
  mac.close();
  const windows = await openSearchSurface('newtab', { platform: 'Win32' });
  assert.strictEqual(footerHints(windows).pop(), 'Tab TabOpen panel', 'other platforms should spell the key out');
  windows.close();
}

// The overlay reads its settings, the stored engine among them, before its
// input takes focus, so the fastest double Tab commits the stored engine and
// never flashes the Google fallback.
async function testOverlayWaitsForTheStoredEngine() {
  const surface = await openSearchSurface('overlay', { settings: { [ENGINE_KEY]: BING } });
  await doubleTab(surface);
  await surface.settle(150);
  assert.deepStrictEqual([surface.scopeLabel(), surface.scopeMenuOpen()], ['Bing', true],
    'the stored engine, not the fallback, should be committed');
  surface.close();
}

async function testOverlayPrefersTheCurrentSite() {
  const url = 'https://www.youtube.com/watch?v=1';
  const surface = await openSearchSurface('overlay', { url, openContext: { currentTabUrl: url } });
  await doubleTab(surface);
  assert.strictEqual(surface.scopeLabel(), 'YouTube', 'on a site with a site search, double Tab should pick that site');
  assert.strictEqual(surface.root.activeElement, surface.input(), 'and leave focus in the input to type the query');
  surface.close();
}

async function testOverlayFirstTabSearchesOpenTabs() {
  const surface = await openSearchSurface('overlay');
  surface.press('Tab');
  await surface.settle(900);
  assert.deepStrictEqual([surface.scopeLabel(), surface.scopeMenuOpen()], ['Search open tabs', false],
    'a single Tab in the overlay should still search open tabs');
  surface.close();
}

function testEngineProviders() {
  const providers = search.getDefaultSiteSearchProviders();
  assert.strictEqual(search.getSearchEngineSiteSearchProvider({
    id: 'google', host: 'www.google.com', name: 'Google', searchTemplate: 'https://www.google.com/search?q={query}'
  }, providers).key, 'gg', 'known current engines should reuse their library provider');
  const regionalYandex = search.getSearchEngineSiteSearchProvider({
    id: 'yandex', host: 'yandex.tm', name: 'Yandex', searchTemplate: 'https://yandex.tm/search/?text={query}'
  }, providers);
  assert.strictEqual(regionalYandex.key, 'yx', 'a regional Yandex site should still be the listed Yandex provider');
  assert.strictEqual(regionalYandex.template, 'https://yandex.tm/search/?text={query}',
    'a regional Yandex site should keep its own search address');
  assert.strictEqual(search.getSearchEngineSiteSearchProvider({
    id: 'google', host: 'google.co.jp', name: 'Google', searchTemplate: 'https://www.google.com/search?q={query}'
  }, providers).template, 'https://www.google.com/search?q={query}',
    'regional Google pages should keep the listed Google address');
  assert.strictEqual(search.isRetiredSearchEngineState({ id: 'so', host: 'www.so.com' }), true,
    '360 should remain retired even when an older stored engine state is restored');
  assert.strictEqual(search.getSearchEngineSiteSearchProvider({
    id: 'so', host: 'www.so.com', name: '360搜索', searchTemplate: 'https://www.so.com/s?q={query}'
  }, providers).key, 'gg', 'the retired 360 engine should fall back to Google instead of reappearing dynamically');
  const unlisted = search.getSearchEngineSiteSearchProvider({
    id: 'private-engine', host: 'search.example.test', name: 'Private Engine', searchTemplate: 'https://search.example.test/?q={query}'
  }, providers);
  assert.strictEqual(unlisted.key, 'engine-private-engine', 'an unlisted browser default should still become the active dynamic provider');
  assert.strictEqual(unlisted.category, 'searchEngine');
  assert.strictEqual(search.getSearchEngineSiteSearchProvider({}, providers).key, 'gg',
    'the pre-storage fallback should remain Google on both surfaces');
}

function testCopy() {
  const expected = {
    shortcut_reference_search_open_scope_menu_title: {
      en: 'Open search scope panel', ja: '検索範囲パネルを開く', zh_CN: '打开搜索范围面板', zh_TW: '開啟搜尋範圍面板'
    },
    shortcut_reference_search_open_scope_menu_desc: {
      en: 'When the input is empty, press Tab twice; with a search scope selected, press Tab once',
      ja: '入力欄が空のときは Tab を2回、検索範囲を選択済みのときは Tab を1回押します',
      zh_CN: '输入框为空时连续按两次 Tab；已选择搜索范围时按一次 Tab',
      zh_TW: '輸入框為空時連按兩次 Tab；已選擇搜尋範圍時按一次 Tab'
    },
    search_scope_menu_shortcut_hint: { en: 'Open panel', ja: 'パネルを開く', zh_CN: '打开面板', zh_TW: '開啟面板' },
    search_scope_menu_focus_toggle_hint: { en: 'Switch focus', ja: 'フォーカス切替', zh_CN: '切换聚焦', zh_TW: '切換聚焦' },
    search_scope_menu_select_hint: { en: 'Switch', ja: '切替', zh_CN: '切换', zh_TW: '切換' },
    search_scope_menu_filter_hint: {
      en: 'Type to filter',
      ja: 'パネルをクリックし、英字またはピンインで絞り込み',
      zh_CN: '点击面板，输入拼音或英文快速筛选',
      zh_TW: '點按面板，輸入拼音或英文快速篩選'
    }
  };
  ['en', 'ja', 'zh_CN', 'zh_TW'].forEach((locale) => {
    const messages = JSON.parse(fs.readFileSync(`_locales/${locale}/messages.json`, 'utf8'));
    Object.entries(expected).forEach(([key, byLocale]) => {
      assert.strictEqual(messages[key] && messages[key].message, byLocale[locale], `${locale} should localize ${key}`);
    });
  });
}

(async () => {
  for (const name of SURFACES) {
    await testDoubleTabOpensTheDefaultEngine(name);
    await testOneTabOpensThePanelForAnActiveScope(name);
    await testPanelHintFollowsTheLanguage(name);
  }
  await testSlowTabsDoNotCountOnNewTab();
  await testShortcutNamesThePlatformKey();
  await testOverlayWaitsForTheStoredEngine();
  await testOverlayPrefersTheCurrentSite();
  await testOverlayFirstTabSearchesOpenTabs();
  testEngineProviders();
  testCopy();
  console.log('search scope double-Tab tests passed');
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
