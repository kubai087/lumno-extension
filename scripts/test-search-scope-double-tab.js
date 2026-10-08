const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const search = require('../src/shared/search-utils.js');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

function readSource(path) {
  return fs.readFileSync(path, 'utf8');
}

const sharedSource = readSource('src/shared/search-input-mode.js');
const sharedCss = readSource('src/shared/search-input.css');
const newtabSource = readNewtabRuntimeSource();
const overlaySource = readSource('src/overlay/search-panel.js');

assert.match(
  sharedSource,
  /DEFAULT_MODE_MENU_DOUBLE_TAB_DURATION = 700[\s\S]*?function shouldOpenModeMenuOnDoubleTab\(event\)[\s\S]*?event\.defaultPrevented[\s\S]*?event\.repeat/,
  'shared input mode should own the timed, distinct-key double-Tab state'
);
assert.match(
  sharedSource,
  /SEARCH_INPUT_MODE_RUNTIME_VERSION[\s\S]*?root\.LumnoSearchInputMode\.runtimeVersion === SEARCH_INPUT_MODE_RUNTIME_VERSION/,
  'shared input mode should replace stale page-scoped runtimes after an extension update'
);
assert.match(
  sharedSource,
  /function handleModeInput\(event\) \{\s*resetModeMenuDoubleTab\(\);[\s\S]*?function handleModeInputKeydown\(event\)[\s\S]*?event\.key !== 'Tab'[\s\S]*?resetModeMenuDoubleTab\(\);[\s\S]*?input\.addEventListener\('blur', handleModeInputBlur\)/,
  'input, non-Tab keys, and blur should reset the pending double-Tab gesture'
);
assert.match(
  sharedSource,
  /function shouldOpenModeMenuForActiveModeOnTab\(event\)[\s\S]*?hasModeTag[\s\S]*?if \(hasModifier \|\| event\.repeat[\s\S]*?resetModeMenuDoubleTab\(\);[\s\S]*?if \(!hasModeTag\) \{\s*return false;\s*\}[\s\S]*?event\.preventDefault\(\)[\s\S]*?return true;/,
  'an active tag should own plain Tab even when its query is non-empty'
);
assert.match(
  sharedSource,
  /function shouldCompleteModeMenuDoubleTab\(event\)[\s\S]*?!modeMenuDoubleTabPending[\s\S]*?event\.repeat[\s\S]*?resetModeMenuDoubleTab\(\);\s*return true;/,
  'overlay should be able to complete the pending gesture after applying its automatic open-tabs tag'
);
assert.match(
  sharedSource,
  /function setPrefixText\(prefixText, theme, prefixOptions\)[\s\S]*?if \(!nextOptions\.preserveModeMenuDoubleTab\) \{\s*resetModeMenuDoubleTab\(\);/,
  'automatic overlay tag activation should be able to preserve only the pending double-Tab gesture'
);
assert.match(
  sharedSource,
  /function handleModeMenuTabFocusToggle\(event\)[\s\S]*?!modeMenuOpen && !modeMenuPending[\s\S]*?event\.preventDefault\(\)[\s\S]*?focusIsInModeMenu[\s\S]*?focusModeInput\(\)[\s\S]*?focusModeMenuSearch\(\)[\s\S]*?return true;/,
  'an open scope menu should toggle unmodified Tab focus between the panel and input'
);
assert.match(
  sharedSource,
  /data-search-input-mode-menu-content[\s\S]*?data-search-input-mode-menu-footer[\s\S]*?function refreshModeMenuLanguage\(\)[\s\S]*?formatShortcutReference\('Tab Tab'[\s\S]*?search_scope_menu_shortcut_hint/,
  'shared scope menu should mount a localized, platform-aware footer outside its content grid'
);
assert.match(
  sharedCss,
  /\.x-lumno-search-input-mode__menu-footer\s*\{[\s\S]*?padding:\s*8px var\(--x-lumno-search-mode-footer-inline-start, 16px\) 9px !important;[\s\S]*?text-align:\s*left !important;/,
  'the fixed scope-panel shortcut hint should use the same measured inset on both sides'
);
assert.match(
  sharedCss,
  /\.x-lumno-search-input-mode__menu-footer\s*\{[\s\S]*?justify-content:\s*space-between !important;[\s\S]*?font:\s*400 12px\/18px[\s\S]*?\.x-lumno-search-input-mode__menu-footer-actions\s*\{[\s\S]*?margin-inline-start:\s*0 !important;[\s\S]*?\.x-lumno-search-input-mode__menu-footer-key\s*\{[\s\S]*?font:\s*500 11px\/16px[\s\S]*?\.x-lumno-search-input-mode__menu-footer-filter-text\s*\{[\s\S]*?flex:\s*1 1 0 !important;[\s\S]*?text-align:\s*left !important;/,
  'the filter hint should stay left while the grouped keyboard hints align right'
);
assert.match(
  sharedSource,
  /search_scope_menu_navigation_hint[\s\S]*?search_scope_menu_select_hint[\s\S]*?search_scope_menu_focus_toggle_hint[\s\S]*?formatShortcutReference\('Tab Tab'/,
  'the scope footer should describe arrow navigation, Enter selection, Tab focus switching, and the existing open shortcut'
);
assert.match(
  sharedCss,
  /max-width:\s*800px[\s\S]*?menu-footer-hint--shortcut[\s\S]*?display:\s*none !important;/,
  'narrow scope panels should hide the already-used open shortcut before current-action hints'
);
assert.doesNotMatch(
  sharedSource,
  /data-search-input-mode-menu-footer-divider/,
  'the scope footer should not render a divider between its swapped hints'
);
assert.match(
  sharedSource,
  /function updateModeMenuFooterAlignment\(\)[\s\S]*?querySelector\(\s*'\.x-lumno-search-input-mode__menu-icon'[\s\S]*?iconRect\.left - footerRect\.left[\s\S]*?--x-lumno-search-mode-footer-inline-start/,
  'the shared scope menu should align its footer to the first rendered icon'
);

for (const [surface, source] of [
  ['New Tab', newtabSource],
  ['overlay', overlaySource]
]) {
  assert.match(
    source,
    /function handleTabKey|handleTabKey = function/,
    `${surface} should expose its Tab handler`
  );
  assert.match(
    source,
    /handleModeMenuTabFocusToggle\((?:event|e)\)[\s\S]*?return true;/,
    `${surface} should toggle Tab focus within the input and open scope menu`
  );
  assert.match(
    source,
    /if \(!(?:event|e) \|\| (?:event|e)\.defaultPrevented\) \{\s*return false;[\s\S]*?shouldOpenModeMenuOnDoubleTab\((?:event|e)\)[\s\S]*?openSearchModeMenuFromDoubleTab\(\)/,
    `${surface} should ignore a second handler pass for the same event and use the shared gesture`
  );
  assert.match(
    source,
    /shouldOpenModeMenuForActiveModeOnTab\((?:event|e)\)[\s\S]*?inputModeController\.openModeMenu\('none'\);\s*return true;[\s\S]*?if \(siteSearchState \|\| localSearchScopeState/,
    `${surface} should open on one Tab for an existing tag before its active-mode guard`
  );
  assert.match(
    source,
    /function openSearchModeMenuFromDoubleTab\(\)[\s\S]*?activateSiteSearch\(provider(?:, \{ animatePrefix: false \})?\);[\s\S]*?inputModeController\.openModeMenu/,
    `${surface} scope entry should reuse the same provider activation path as keyword plus Tab`
  );
  assert.match(
    source,
    /function activateSiteSearch\(provider, activationOptions\)[\s\S]*?animate: options\.animatePrefix !== false/,
    `${surface} provider tags should share one animated first-entry path`
  );
  assert.ok(
    source.includes('inputModeController.refreshModeMenuLanguage();'),
    `${surface} should refresh the scope-panel hint when its locale changes`
  );
  assert.match(
    source,
    /function getSearchModeMenuResultOffset\(\)[\s\S]*?suggestionsContainer\.offsetHeight[\s\S]*?setModeMenuResultOffset/,
    `${surface} should keep a tagged Tab-opened panel positioned by unscaled result height`
  );
}

const overlayTabHandlerStart = overlaySource.indexOf('function handleTabKey(e) {');
const overlayTabHandlerEnd = overlaySource.indexOf(
  'captureTabHandler = function(e) {',
  overlayTabHandlerStart
);
const overlayTabHandlerSource = overlaySource.slice(
  overlayTabHandlerStart,
  overlayTabHandlerEnd
);
assert.match(
  overlayTabHandlerSource,
  /shouldCompleteModeMenuDoubleTab\(e\)[\s\S]*?openSearchModeMenuFromDoubleTab\(\)[\s\S]*?shouldOpenModeMenuForActiveModeOnTab\(e\)/,
  'overlay should complete a pending double Tab before treating its automatic open-tabs tag as explicit'
);
assert.match(
  overlayTabHandlerSource,
  /shouldOpenModeMenuOnDoubleTab\(e\)[\s\S]*?if \(e\.defaultPrevented\) \{\s*activateOpenTabsSearchMode\(\{[\s\S]*?deferPrefixEntry: true,[\s\S]*?preserveModeMenuDoubleTab: true[\s\S]*?\}\);\s*return true;/,
  'overlay first Tab should defer only its tag entry until the second-press window closes'
);

const overlayDoubleTabOpenStart = overlaySource.indexOf(
  'function openSearchModeMenuFromDoubleTab() {'
);
const overlayDoubleTabOpenEnd = overlaySource.indexOf(
  'function restoreSearchModeQuery',
  overlayDoubleTabOpenStart
);
const overlayDoubleTabOpenSource = overlaySource.slice(
  overlayDoubleTabOpenStart,
  overlayDoubleTabOpenEnd
);
assert.match(
  overlayDoubleTabOpenSource,
  /expectedOpenTabsSearchModeActive = openTabsSearchModeActive[\s\S]*?openTabsSearchModeActive === expectedOpenTabsSearchModeActive/,
  'a delayed provider activation should keep the exact temporary open-tabs state that initiated it'
);
assert.match(
  overlaySource,
  /OVERLAY_OPEN_TABS_PREFIX_FEEDBACK_DELAY_MS = 120[\s\S]*?function scheduleOpenTabsPrefixEntry\(options\)[\s\S]*?setTimeout\([\s\S]*?setOpenTabsSearchPrefix\(defaultTheme, \{[\s\S]*?animate: true[\s\S]*?OVERLAY_OPEN_TABS_PREFIX_FEEDBACK_DELAY_MS/,
  'overlay should give a single Tab prompt feedback without waiting for the full double-Tab window'
);
assert.match(
  overlayDoubleTabOpenSource,
  /cancelPendingOpenTabsPrefixEntry\(\);[\s\S]*?activateSiteSearch\(provider, \{ animatePrefix: false \}\);/,
  'overlay double-Tab should commit the provider without starting an animation that menu-open immediately cancels'
);
assert.match(
  overlayDoubleTabOpenSource,
  /Promise\.all\(\[[\s\S]*?overlaySearchEngineStateReady[\s\S]*?getSiteSearchProviders\(\)[\s\S]*?loadSiteSearchIconCache\(\)[\s\S]*?\]\)/,
  'overlay double-Tab should wait for engine, provider, and icon-cache readiness before committing the tag'
);
assert.match(
  overlaySource,
  /function activateSiteSearch\(provider, activationOptions\)[\s\S]*?const immediateTheme = getImmediateThemeForSuggestion\(\{ provider \}\) \|\| defaultTheme;[\s\S]*?setSiteSearchPrefix\(provider, immediateTheme/,
  'overlay provider activation should paint its cached or brand theme on the first tag commit'
);
const overlayOpenTabsActivationStart = overlaySource.indexOf(
  'function activateOpenTabsSearchMode(options) {'
);
const overlayOpenTabsActivationEnd = overlaySource.indexOf(
  'function clearOpenTabsSearchMode()',
  overlayOpenTabsActivationStart
);
const overlayOpenTabsActivationSource = overlaySource.slice(
  overlayOpenTabsActivationStart,
  overlayOpenTabsActivationEnd
);
assert.doesNotMatch(
  overlayOpenTabsActivationSource,
  /deferPrefixEntry[\s\S]*?clearSiteSearchPrefix\(\)/,
  'deferring the overlay tag must not clear or relayout the entering input'
);
assert.match(
  overlayOpenTabsActivationSource,
  /renderCachedTabsForOverlay\(latestOverlayQuery\)[\s\S]*?requestTabsAndRender\(latestOverlayQuery\)/,
  'overlay first Tab should render the tabs already supplied at launch before refreshing them'
);

for (const [surface, source, visibleAttributes] of [
  ['New Tab', newtabSource, { 'data-visible': 'true' }],
  ['overlay', overlaySource, { 'aria-hidden': 'false', 'data-collapsed': 'false' }]
]) {
  const resultOffsetStart = source.indexOf(
    'function getSearchModeMenuResultOffset() {'
  );
  const resultOffsetEnd = source.indexOf(
    'function syncSearchModeMenuResultOffset() {',
    resultOffsetStart
  );
  const resultOffsetSource = source.slice(resultOffsetStart, resultOffsetEnd);
  const resultOffsetContext = vm.createContext({
    suggestionsContainer: {
      getAttribute: (name) => visibleAttributes[name] || null,
      getBoundingClientRect: () => ({ height: 192 }),
      offsetHeight: 240
    }
  });
  vm.runInContext(
    `${resultOffsetSource}\nthis.getResultOffsetForTest = getSearchModeMenuResultOffset;`,
    resultOffsetContext,
    { filename: `${surface.toLowerCase().replace(/\s+/g, '-')}-result-offset.js` }
  );
  assert.strictEqual(
    resultOffsetContext.getResultOffsetForTest(),
    240,
    `${surface} should use the unscaled layout height instead of a transformed visual height`
  );
}

assert.match(
  newtabSource,
  /function getDefaultSearchModeProvider\(providers\)[\s\S]*?getSearchEngineSiteSearchProvider\(\s*defaultSearchEngineState,\s*providers/,
  'New Tab should derive its initial tag from the current search engine state'
);
assert.match(
  overlaySource,
  /function getCurrentPageSiteSearchModeProvider\(providers\)[\s\S]*?findSiteSearchProviderForPageUrl\(\s*initialContextTabUrl,\s*providers\s*\)/,
  'overlay should use the current-page URL matcher instead of a symmetric host-only match'
);
assert.match(
  overlaySource,
  /const currentPageProvider = getCurrentPageSiteSearchModeProvider\(providers\);[\s\S]*?const provider = currentPageProvider \|\|\s*getOverlayDefaultSearchModeProvider\(providers\);/,
  'overlay should prefer the current-page site search and fall back to the current engine'
);
assert.match(
  overlaySource,
  /inputModeController\.openModeMenu\(\s*currentPageProvider \? 'input' : 'none'\s*\);/,
  'overlay should keep focus in the search input when double Tab selects the current site'
);
assert.match(
  newtabSource,
  /function openSearchModeMenuFromDoubleTab\(\)[\s\S]*?inputModeController\.openModeMenu\(\s*'none'\s*\)/,
  'New Tab should keep its default scope-panel focus behavior'
);
assert.match(
  overlaySource,
  /overlaySearchEngineStateReady = loadOverlaySearchEngineState[\s\S]*?Promise\.all\(\[[\s\S]*?overlaySearchEngineStateReady[\s\S]*?getSiteSearchProviders\(\)/,
  'overlay double-Tab activation should wait for both the stored engine and provider list'
);

const providers = search.getDefaultSiteSearchProviders();
assert.strictEqual(
  search.getSearchEngineSiteSearchProvider({
    id: 'google',
    host: 'www.google.com',
    name: 'Google',
    searchTemplate: 'https://www.google.com/search?q={query}'
  }, providers).key,
  'gg',
  'known current engines should reuse their library provider'
);
const retired360 = search.getSearchEngineSiteSearchProvider({
  id: 'so',
  host: 'www.so.com',
  name: '360搜索',
  searchTemplate: 'https://www.so.com/s?q={query}'
}, providers);
assert.strictEqual(
  search.isRetiredSearchEngineState({ id: 'so', host: 'www.so.com' }),
  true,
  '360 should remain retired even when an older stored engine state is restored'
);
assert.strictEqual(
  retired360.key,
  'gg',
  'the retired 360 engine should fall back to Google instead of reappearing dynamically'
);
const detectedUnlistedEngine = search.getSearchEngineSiteSearchProvider({
  id: 'private-engine',
  host: 'search.example.test',
  name: 'Private Engine',
  searchTemplate: 'https://search.example.test/?q={query}'
}, providers);
assert.strictEqual(
  detectedUnlistedEngine.key,
  'engine-private-engine',
  'an unlisted browser default should still become the active dynamic provider'
);
assert.strictEqual(detectedUnlistedEngine.category, 'searchEngine');
assert.strictEqual(
  search.getSearchEngineSiteSearchProvider({}, providers).key,
  'gg',
  'the pre-storage fallback should remain Google on both surfaces'
);

const expectedShortcutTitles = {
  en: 'Open search scope panel',
  ja: '検索範囲パネルを開く',
  zh_CN: '打开搜索范围面板',
  zh_TW: '開啟搜尋範圍面板'
};
const expectedShortcutHints = {
  en: 'Open panel',
  ja: 'パネルを開く',
  zh_CN: '打开面板',
  zh_TW: '開啟面板'
};
const expectedFocusToggleHints = {
  en: 'Switch focus',
  ja: 'フォーカス切替',
  zh_CN: '切换聚焦',
  zh_TW: '切換聚焦'
};
const expectedSelectHints = {
  en: 'Switch',
  ja: '切替',
  zh_CN: '切换',
  zh_TW: '切換'
};
const expectedFilterHints = {
  en: 'Type to filter',
  ja: 'パネルをクリックし、英字またはピンインで絞り込み',
  zh_CN: '点击面板，输入拼音或英文快速筛选',
  zh_TW: '點按面板，輸入拼音或英文快速篩選'
};
const expectedShortcutDescriptions = {
  en: 'When the input is empty, press Tab twice; with a search scope selected, press Tab once',
  ja: '入力欄が空のときは Tab を2回、検索範囲を選択済みのときは Tab を1回押します',
  zh_CN: '输入框为空时连续按两次 Tab；已选择搜索范围时按一次 Tab',
  zh_TW: '輸入框為空時連按兩次 Tab；已選擇搜尋範圍時按一次 Tab'
};
Object.entries(expectedShortcutTitles).forEach(([locale, expectedTitle]) => {
  const messages = JSON.parse(readSource(`_locales/${locale}/messages.json`));
  assert.strictEqual(
    messages.shortcut_reference_search_open_scope_menu_title &&
      messages.shortcut_reference_search_open_scope_menu_title.message,
    expectedTitle,
    `${locale} should localize the Options double-Tab shortcut title`
  );
  assert.strictEqual(
    messages.shortcut_reference_search_open_scope_menu_desc &&
      messages.shortcut_reference_search_open_scope_menu_desc.message,
    expectedShortcutDescriptions[locale],
    `${locale} should localize the Options double-Tab shortcut description`
  );
  assert.strictEqual(
    messages.search_scope_menu_shortcut_hint &&
      messages.search_scope_menu_shortcut_hint.message,
    expectedShortcutHints[locale],
    `${locale} should localize the fixed scope-panel shortcut hint`
  );
  assert.strictEqual(
    messages.search_scope_menu_focus_toggle_hint &&
      messages.search_scope_menu_focus_toggle_hint.message,
    expectedFocusToggleHints[locale],
    `${locale} should localize the scope-panel focus-toggle hint`
  );
  assert.strictEqual(
    messages.search_scope_menu_select_hint &&
      messages.search_scope_menu_select_hint.message,
    expectedSelectHints[locale],
    `${locale} should localize the scope-panel selection hint`
  );
  assert.strictEqual(
    messages.search_scope_menu_filter_hint &&
      messages.search_scope_menu_filter_hint.message,
    expectedFilterHints[locale],
    `${locale} should localize the scope-panel filter hint`
  );
});

async function runRuntimeStabilityTests() {
  const staleControllerFactory = function staleControllerFactory() {};
  const sharedRuntimeContext = vm.createContext({
    window: {
      LumnoSearchInputMode: Object.freeze({
        createInputModeController: staleControllerFactory,
        runtimeVersion: 'stale-runtime'
      })
    }
  });
  vm.runInContext(sharedSource, sharedRuntimeContext, {
    filename: 'src/shared/search-input-mode.js'
  });
  const upgradedRuntime = sharedRuntimeContext.window.LumnoSearchInputMode;
  assert.notStrictEqual(
    upgradedRuntime.createInputModeController,
    staleControllerFactory,
    'a stale page-scoped input-mode runtime should be replaced on reinjection'
  );
  assert.ok(
    upgradedRuntime.runtimeVersion,
    'the current input-mode runtime should expose a version marker'
  );
  vm.runInContext(sharedSource, sharedRuntimeContext, {
    filename: 'src/shared/search-input-mode.js'
  });
  assert.strictEqual(
    sharedRuntimeContext.window.LumnoSearchInputMode,
    upgradedRuntime,
    'reinjection should keep an already-current input-mode runtime stable'
  );

  let resolveEngineState;
  let engineStateReady = false;
  const engineStateReadyPromise = new Promise((resolve) => {
    resolveEngineState = () => {
      engineStateReady = true;
      resolve();
    };
  });
  let resolveIconCache;
  const iconCacheReadyPromise = new Promise((resolve) => {
    resolveIconCache = resolve;
  });
  const activations = [];
  const activationOptions = [];
  const menuOpens = [];
  const providerItems = [
    { key: 'gg', name: 'Google' },
    { key: 'bi', name: 'Bing' }
  ];
  let overlayRuntimeContext;
  overlayRuntimeContext = vm.createContext({
    Promise,
    cancelPendingOpenTabsPrefixEntry: () => {},
    defaultSiteSearchProviders: providerItems,
    getCurrentPageSiteSearchModeProvider: () => null,
    getOverlayDefaultSearchModeProvider: () => (
      engineStateReady ? providerItems[1] : providerItems[0]
    ),
    getSiteSearchProviders: () => Promise.resolve(providerItems),
    loadSiteSearchIconCache: () => iconCacheReadyPromise,
    siteSearchIconCache: {},
    inputModeController: {
      openModeMenu: (focusTarget) => {
        menuOpens.push(focusTarget);
        return true;
      }
    },
    localSearchScopeState: null,
    openTabsSearchModeActive: true,
    overlaySearchEngineStateReady: engineStateReadyPromise,
    searchInput: { value: '' },
    siteSearchProvidersCache: providerItems,
    siteSearchState: null,
    activateSiteSearch: (provider, options) => {
      activations.push(provider.key);
      activationOptions.push(Boolean(options && options.animatePrefix === false));
      overlayRuntimeContext.openTabsSearchModeActive = false;
      overlayRuntimeContext.siteSearchState = provider;
    }
  });
  vm.runInContext(
    `${overlayDoubleTabOpenSource}\nthis.openSearchModeMenuFromDoubleTabForTest = openSearchModeMenuFromDoubleTab;`,
    overlayRuntimeContext,
    { filename: 'overlay-double-tab-open.js' }
  );
  const pendingActivation = overlayRuntimeContext.openSearchModeMenuFromDoubleTabForTest();
  await Promise.resolve();
  assert.deepStrictEqual(
    activations,
    [],
    'a fast double-Tab must not activate the Google fallback before storage resolves'
  );
  assert.deepStrictEqual(
    menuOpens,
    [],
    'the scope menu should not open with a temporary fallback selection'
  );
  resolveEngineState();
  await Promise.resolve();
  assert.deepStrictEqual(
    activations,
    [],
    'double-Tab should not commit a provider while the first icon-cache read is still pending'
  );
  resolveIconCache();
  assert.strictEqual(
    await pendingActivation,
    true,
    'double-Tab activation should finish after the engine state becomes ready'
  );
  assert.deepStrictEqual(
    activations,
    ['bi'],
    'the resolved default engine should win over the pre-storage Google fallback'
  );
  assert.deepStrictEqual(
    activationOptions,
    [true],
    'double-Tab should atomically commit the provider before opening its scope menu'
  );
  assert.deepStrictEqual(
    menuOpens,
    ['none'],
    'the scope menu should open only after the stable provider is active'
  );

  let resolveStaleEngineState;
  overlayRuntimeContext.siteSearchState = null;
  overlayRuntimeContext.overlaySearchEngineStateReady = new Promise((resolve) => {
    resolveStaleEngineState = resolve;
  });
  overlayRuntimeContext.searchInput.value = '';
  const staleActivation = overlayRuntimeContext.openSearchModeMenuFromDoubleTabForTest();
  overlayRuntimeContext.searchInput.value = 'typed while loading';
  resolveStaleEngineState();
  assert.strictEqual(
    await staleActivation,
    false,
    'a delayed provider resolution should stop after the user changes the input'
  );
  assert.deepStrictEqual(
    activations,
    ['bi'],
    'a stale async completion must not replace the user\'s newer interaction state'
  );
  assert.deepStrictEqual(
    activationOptions,
    [true],
    'a stale async completion must not enqueue another provider animation'
  );
  assert.deepStrictEqual(
    menuOpens,
    ['none'],
    'a stale async completion must not reopen the scope menu'
  );

  overlayRuntimeContext.overlaySearchEngineStateReady = Promise.resolve();
  overlayRuntimeContext.getCurrentPageSiteSearchModeProvider = () => providerItems[0];
  overlayRuntimeContext.siteSearchState = null;
  overlayRuntimeContext.searchInput.value = '';
  assert.strictEqual(
    await overlayRuntimeContext.openSearchModeMenuFromDoubleTabForTest(),
    true,
    'double-Tab activation should select a matching current-page provider'
  );
  assert.deepStrictEqual(
    activations,
    ['bi', 'gg'],
    'the current-page provider should replace the default engine when available'
  );
  assert.deepStrictEqual(
    activationOptions,
    [true, true],
    'current-page activation should use the same atomic provider commit'
  );
  assert.deepStrictEqual(
    menuOpens,
    ['none', 'input'],
    'a current-page provider should open the scope panel with focus in the search input'
  );
}

runRuntimeStabilityTests().then(() => {
  console.log('search scope double-Tab tests passed');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
