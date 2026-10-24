const assert = require('assert');
const { createEvent, loadBackground, wait } = require('../helpers/background-harness');

// Boots the real background and presses the tab switcher shortcut
// (chrome.commands "show-tab-switcher"), answering the messages it sends to
// tabs the way the injected switcher, the extension-page bridge and the
// release observer do.

const TAB_SWITCHER_ENABLED_KEY = '_x_extension_tab_switcher_enabled_2026_unique_';
const SITE_THEME_CACHE_KEY = '_x_extension_site_theme_cache_2026_unique_';
const RESTRICTED_ACTION_KEY = '_x_extension_restricted_action_2024_unique_';
const RESTRICTED_ACTION_DONE_KEY = '_x_extension_restricted_action_auto_browser_setting_done_2026_unique_';
const EXTENSION_ORIGIN = 'chrome-extension://lumno-test';
const PORT_NAME = 'lumno-tab-switcher-extension-page';

function webTabs() {
  return [
    { id: 11, windowId: 1, index: 0, active: true, url: 'https://mail.example.com/', title: 'Mail', status: 'complete', favIconUrl: 'https://tracker.example.net/mail.ico' },
    { id: 12, windowId: 1, index: 1, active: false, url: 'https://news.example.com/', title: 'News', status: 'complete' },
    { id: 13, windowId: 1, index: 2, active: false, url: 'chrome://settings/', title: 'Settings', status: 'complete' },
    { id: 14, windowId: 1, index: 3, active: false, url: 'https://private.example.com/', title: 'Private', status: 'complete', incognito: true },
    { id: 15, windowId: 2, index: 0, active: true, url: 'https://other-window.example.com/', title: 'Other window', status: 'complete' }
  ];
}

// respond(message, tabId) answers chrome.tabs.sendMessage; it may return a
// promise to answer later.
function bootSwitcher(options) {
  const config = options || {};
  const tabs = config.tabs || webTabs();
  const responders = { respond: config.respond || defaultResponder() };
  const harness = loadBackground({
    tabs,
    extensionUrls: true,
    sync: Object.assign({ [TAB_SWITCHER_ENABLED_KEY]: true }, config.sync || {}),
    local: config.local,
    commands: [{ name: 'show-tab-switcher', shortcut: config.shortcut || 'Alt+Q' }],
    configureChrome(chromeApi, calls) {
      chromeApi.tabs.sendMessage = (tabId, message, optionsOrCallback, maybeCallback) => {
        const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
        calls.push({ name: 'tabs.sendMessage', args: [tabId, JSON.parse(JSON.stringify(message))] });
        Promise.resolve(responders.respond(message, tabId)).then((response) => {
          setTimeout(() => callback && callback(response), 0);
        });
      };
      chromeApi.tabs.getZoom = (_tabId, callback) => setTimeout(() => callback(config.zoom || 1), 0);
      chromeApi.windows.get = (windowId, callback) => setTimeout(() => callback({ id: windowId, focused: true }), 0);
      if (typeof config.configureChrome === 'function') config.configureChrome(chromeApi, calls);
    }
  });
  const sent = (action) => harness.calls
    .filter((call) => call.name === 'tabs.sendMessage' && call.args[1].action === action)
    .map((call) => ({ tabId: call.args[0], message: call.args[1] }));
  // Copies out of the worker's realm, so they compare as plain objects.
  const scripts = () => harness.calls.filter((call) => call.name === 'scripting.executeScript').map((call) => {
    const { func, ...rest } = call.args[0];
    return Object.assign(JSON.parse(JSON.stringify(rest)), func ? { func } : {});
  });
  const visit = async (tabIds) => {
    for (const tabId of tabIds) {
      tabs.forEach((tab) => {
        if (tab.windowId === 1) tab.active = tab.id === tabId;
      });
      harness.chrome.tabs.onActivated.dispatch({ tabId, windowId: 1 });
      await wait(5);
    }
  };
  const press = () => harness.chrome.commands.onCommand.dispatch('show-tab-switcher');
  return { harness, tabs, responders, sent, scripts, visit, press };
}

function defaultResponder() {
  return (message) => {
    if (message.action === 'advanceOpenTabSwitcherFromCommand') return { ok: true, open: false, advanced: false, suppressed: false };
    if (message.action === 'openTabSwitcherFromCommand') return { ok: true };
    if (message.action === 'commitOpenTabSwitcherFromShortcutRelease') return { ok: true, committed: true };
    if (message.action === 'getOpenTabSwitcherState') return { ok: true, open: false };
    return { ok: true };
  };
}

async function testCommandOpensTheRecentTabsOnTheActivePage() {
  const session = bootSwitcher({ shortcut: 'Ctrl+Shift+Y', zoom: 1.5 });
  await wait(30);
  await session.visit([12, 13, 11]);
  session.harness.calls.length = 0;
  const before = Date.now();
  session.press();
  await wait(400);

  const scripts = session.scripts();
  assert.deepStrictEqual(scripts[0], { target: { tabId: 11, allFrames: true }, files: ['build/shortcut-key-observer.js'] },
    'the release observer should be installed into every frame before anything else');
  const advance = session.sent('advanceOpenTabSwitcherFromCommand');
  assert.deepStrictEqual(advance.map((entry) => [entry.tabId, entry.message.offset]), [[11, 1]],
    'the command should first try to advance a switcher that is already open');

  const opens = session.sent('openTabSwitcherFromCommand');
  assert.strictEqual(opens.length, 1, 'with no switcher open the command should open one through the page runtime');
  const { tabId, message } = opens[0];
  const context = message.context;
  assert.strictEqual(tabId, 11);
  assert.deepStrictEqual(context.tabs.map((tab) => tab.id), [11, 13, 12],
    'the switcher should list only same-window recent tabs, including browser pages and excluding incognito and other spaces');
  assert.strictEqual(context.selectedIndex, 1, 'the tab before the current one should start selected');
  assert.strictEqual(context.currentTabId, 11);
  assert.strictEqual(context.shortcut, 'Ctrl+Shift+Y', 'the page should hear the shortcut the browser has configured');
  assert.strictEqual(context.advanceOnExisting, true);
  assert.strictEqual(context.suppressInitialShortcutAdvance, true, 'the held summon key should not advance right away');
  assert.strictEqual(context.tabZoomFactor, 1.5, 'the page should learn its zoom to compensate for it');
  assert.notStrictEqual(context.tabs[0].favIconUrl, 'https://tracker.example.net/mail.ico',
    'tab icons should come from the favicon resolver, not the raw tab favicon URL');
  context.tabs.forEach((tab) => {
    assert.ok(['ok', 'pending', 'failed', 'restricted', 'stale', 'missing'].includes(tab.thumbnailStatus), 'each card should carry its thumbnail status');
    assert.ok('thumbnailReason' in tab);
  });

  const arms = session.sent('armTabSwitcherShortcutRelease');
  assert.deepStrictEqual(arms.map((entry) => entry.tabId).sort(), [11, 12, 13, 14],
    'once open, every tab in the window should be armed to relay the release');
  arms.forEach((entry) => {
    assert.deepStrictEqual(entry.message.keys, ['Control'], 'the primary modifier of the shortcut should commit');
    assert.ok(entry.message.commandStartedAt >= before && entry.message.commandStartedAt <= Date.now(),
      'the arm message should carry the time the command arrived, to replay a release that came first');
  });

  const debug = session.harness.context._lumnoTabSwitcherShortcutDebug.snapshot().map((event) => event.stage);
  ['command-received', 'shortcut-configured', 'switcher-opened'].forEach((stage) => {
    assert.ok(debug.includes(stage), `the shortcut trace should record ${stage}`);
  });
}

async function testOtherSpaceCannotFillCandidatesOrUseRecentHistory() {
  const tabs = webTabs();
  const session = bootSwitcher({ tabs });
  await wait(30);
  // Record the other window as most recently visited, then invoke in window 1.
  session.harness.chrome.tabs.onActivated.dispatch({ tabId: 15, windowId: 2 });
  await wait(10);
  await session.visit([11]);
  // Also exercise the candidate boundary when a browser returns an overbroad list.
  const query = session.harness.chrome.tabs.query;
  session.harness.chrome.tabs.query = (options, callback) => {
    if (options.windowId === 1 && !options.active) {
      callback(tabs);
      return;
    }
    query(options, callback);
  };
  session.press();
  await wait(400);
  const candidates = session.sent('openTabSwitcherFromCommand')[0].message.context.tabs;
  assert.ok(candidates.length < 5, 'do not fill empty slots with another space');
  assert.ok(candidates.every((tab) => tab.windowId === 1),
    'even the most recently visited tab must be excluded when it belongs to another space');
}

async function testRepeatedCommandAdvancesTheOpenSwitcher() {
  const session = bootSwitcher({
    respond(message) {
      if (message.action === 'advanceOpenTabSwitcherFromCommand') return { ok: true, open: true, advanced: true };
      return defaultResponder()(message);
    }
  });
  await wait(30);
  await session.visit([12, 11]);
  session.harness.calls.length = 0;
  session.press();
  await wait(300);
  assert.strictEqual(session.sent('advanceOpenTabSwitcherFromCommand').length, 1);
  assert.strictEqual(session.sent('openTabSwitcherFromCommand').length, 0, 'an open switcher should advance, not reopen');
  assert.ok(!session.harness.calls.some((call) => call.name === 'tabs.query' && Object.keys(call.args[0] || {}).length === 0),
    'advancing should not rebuild the tab list');
  assert.strictEqual(session.scripts().filter((script) => script.func).length, 0, 'advancing should not run page scripts');

  session.harness.calls.length = 0;
  const responses = [];
  session.harness.chrome.runtime.onMessage.dispatch(
    { action: 'notifyTabSwitcherShortcutModifierReleased', key: 'Alt' },
    { tab: session.tabs.find((tab) => tab.id === 12), url: 'https://news.example.com/' },
    (response) => responses.push(response)
  );
  await wait(100);
  assert.deepStrictEqual(session.sent('commitOpenTabSwitcherFromShortcutRelease').map((entry) => entry.tabId), [11],
    'a release relayed from any tab should commit the switcher where the command advanced it');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(responses)), [{ ok: true, committed: true }]);
}

async function testSuppressedAdvanceStillOpens() {
  const session = bootSwitcher({
    respond(message) {
      if (message.action === 'advanceOpenTabSwitcherFromCommand') return { ok: true, open: true, advanced: false, suppressed: true };
      return defaultResponder()(message);
    }
  });
  await wait(30);
  await session.visit([12, 11]);
  session.press();
  await wait(300);
  assert.strictEqual(session.sent('openTabSwitcherFromCommand').length, 1,
    'a suppressed advance is not an advance; the switcher should open');
}

async function testFallsBackToInjectingTheSwitcher() {
  const session = bootSwitcher({
    respond(message) {
      if (message.action === 'openTabSwitcherFromCommand') return undefined;
      return defaultResponder()(message);
    }
  });
  await wait(30);
  await session.visit([12, 11]);
  session.harness.calls.length = 0;
  session.press();
  await wait(400);
  const scripts = session.scripts().filter((script) => script.target.tabId === 11 && !script.target.allFrames);
  const files = scripts.find((script) => script.files && script.files.includes('build/tab-switcher.js'));
  assert.deepStrictEqual(files && files.files,
    ['build/icon-font-preload.js', 'src/react/overlay-islands.js', 'build/tab-switcher.js'],
    'a page without the runtime should get the React islands before the switcher');
  const run = scripts.find((script) => typeof script.func === 'function' && script.args && script.args[0] && Array.isArray(script.args[0].tabs));
  assert.ok(run, 'the injected switcher should then be opened with the same context');
  assert.ok(scripts.indexOf(files) < scripts.indexOf(run));
}

async function testRepeatsWhileOpeningAreIgnored() {
  let releaseOpen;
  const opened = new Promise((resolve) => {
    releaseOpen = resolve;
  });
  const session = bootSwitcher({
    respond(message) {
      if (message.action === 'openTabSwitcherFromCommand') return opened.then(() => ({ ok: true }));
      return defaultResponder()(message);
    }
  });
  await wait(30);
  await session.visit([12, 11]);
  session.press();
  await wait(150);
  session.press();
  session.press();
  await wait(150);
  releaseOpen();
  await wait(100);
  assert.strictEqual(session.sent('openTabSwitcherFromCommand').length, 1,
    'commands that arrive while the switcher is still opening should not open it again');
}

async function testDisabledSwitcherDoesNothing() {
  const session = bootSwitcher({ sync: { [TAB_SWITCHER_ENABLED_KEY]: false } });
  await wait(30);
  session.harness.calls.length = 0;
  session.press();
  await wait(200);
  assert.deepStrictEqual(session.sent('openTabSwitcherFromCommand'), []);
  assert.deepStrictEqual(session.sent('advanceOpenTabSwitcherFromCommand'), []);
  assert.deepStrictEqual(session.scripts(), [], 'a disabled switcher should not touch the page');
}

async function testRestrictedPageHostsTheSwitcherOnAnotherTab() {
  const tabs = webTabs();
  tabs.forEach((tab) => {
    tab.active = tab.id === 13 || tab.windowId === 2;
  });
  const session = bootSwitcher({ tabs });
  await wait(30);
  await session.visit([12, 11, 13]);
  session.harness.calls.length = 0;
  session.press();
  await wait(400);
  const opens = session.sent('openTabSwitcherFromCommand');
  assert.strictEqual(opens.length, 1);
  assert.strictEqual(opens[0].tabId, 11, 'a browser page cannot show the switcher, so a recent web tab should');
  assert.strictEqual(opens[0].message.context.currentTabId, 13);
  assert.ok(session.harness.calls.some((call) => call.name === 'tabs.update' && call.args[0] === 11 && call.args[1].active === true),
    'the hosting tab should be brought to the front first');
}

async function testReleaseCommitsOnlyForTheConfiguredModifier() {
  const session = bootSwitcher({ shortcut: 'Command+Shift+J' });
  await wait(30);
  await session.visit([12, 11]);
  session.press();
  await wait(400);
  session.harness.calls.length = 0;
  const sender = { tab: session.tabs.find((tab) => tab.id === 12), url: 'https://news.example.com/' };
  const notify = (key) => new Promise((resolve) => {
    session.harness.chrome.runtime.onMessage.dispatch({ action: 'notifyTabSwitcherShortcutModifierReleased', key }, sender, resolve);
  });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(await notify('Shift'))), { ok: true, committed: false },
    'releasing Shift should not commit a Command shortcut');
  assert.deepStrictEqual(session.sent('commitOpenTabSwitcherFromShortcutRelease'), []);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(await notify('Meta'))), { ok: true, committed: true });
  assert.deepStrictEqual(session.sent('commitOpenTabSwitcherFromShortcutRelease').map((entry) => entry.tabId), [11],
    'the commit should go straight to the tab the switcher opened on');
  const debug = session.harness.context._lumnoTabSwitcherShortcutDebug.snapshot().map((event) => event.stage);
  assert.ok(debug.includes('commit-host-resolved') && debug.includes('commit-finished'));
}

async function testUncommittedHostIsNotReportedAsCommitted() {
  const session = bootSwitcher({
    respond(message) {
      if (message.action === 'commitOpenTabSwitcherFromShortcutRelease') return { ok: true, committed: false };
      if (message.action === 'getOpenTabSwitcherState') return { ok: true, open: false };
      return defaultResponder()(message);
    }
  });
  await wait(30);
  await session.visit([12, 11]);
  session.press();
  await wait(400);
  const response = await new Promise((resolve) => {
    session.harness.chrome.runtime.onMessage.dispatch(
      { action: 'notifyTabSwitcherShortcutModifierReleased', key: 'Alt' },
      { tab: session.tabs.find((tab) => tab.id === 11), url: 'https://mail.example.com/' },
      resolve
    );
  });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(response)), { ok: true, committed: false },
    'a host that did not switch should not be reported as a successful switch');
}

function connectExtensionPage(session, tabId, answer) {
  const port = {
    name: PORT_NAME,
    sender: { tab: { id: tabId, windowId: 1 }, url: `${EXTENSION_ORIGIN}/newtab.html` },
    received: [],
    onMessage: createEvent(),
    onDisconnect: createEvent(),
    postMessage(message) {
      const copy = JSON.parse(JSON.stringify(message));
      port.received.push(copy);
      const response = answer(copy);
      if (response) {
        setTimeout(() => port.onMessage.dispatch(Object.assign({
          action: 'tabSwitcherExtensionPageResponse',
          requestId: copy.requestId,
          tabId
        }, response)), 0);
      }
    }
  };
  session.harness.chrome.runtime.onConnect.dispatch(port);
  return port;
}

function extensionPageAnswer(message) {
  if (message.action === 'advanceOpenTabSwitcherFromCommand') return { ok: true, advanced: false };
  if (message.action === 'openTabSwitcherFromCommand') return { ok: true };
  if (message.action === 'armTabSwitcherShortcutRelease') return { ok: true };
  return { ok: true };
}

async function testExtensionPagesAreReachedThroughTheirPort() {
  const tabs = webTabs().filter((tab) => tab.windowId === 1 && tab.id !== 14);
  tabs.push({ id: 21, windowId: 1, index: 4, active: false, url: `${EXTENSION_ORIGIN}/newtab.html`, title: 'New Tab', status: 'complete' });
  const session = bootSwitcher({ tabs });
  await wait(30);
  const port = connectExtensionPage(session, 21, extensionPageAnswer);
  await session.visit([12, 11, 21]);
  session.harness.calls.length = 0;
  session.press();
  await wait(400);
  const actions = port.received.map((message) => message.action)
    .filter((action) => action !== 'setTabSwitcherCaptureVisibility');
  assert.deepStrictEqual(actions.slice(0, 2),['advanceOpenTabSwitcherFromCommand', 'openTabSwitcherFromCommand'],
    'an extension page should be asked over its port, first to advance, then to open');
  assert.ok(actions.includes('armTabSwitcherShortcutRelease'), 'the extension page should be armed over its port too');
  const open = port.received.find((message) => message.action === 'openTabSwitcherFromCommand');
  assert.strictEqual(typeof open.requestId, 'number', 'port requests should carry an id for their answer');
  assert.deepStrictEqual(open.context.tabs.map((tab) => tab.id), [21, 11, 12, 13]);
  assert.deepStrictEqual(session.sent('openTabSwitcherFromCommand'), [], 'extension pages are not messaged as web pages');
  assert.ok(!session.scripts().some((script) => script.target.tabId === 21),
    'no script should be injected into an extension page');
}

async function testBrowserNewtabWithABridgeHostsTheSwitcher() {
  const tabs = webTabs().filter((tab) => tab.windowId === 1 && tab.id !== 14);
  tabs.forEach((tab) => {
    tab.active = false;
  });
  tabs.push({ id: 22, windowId: 1, index: 4, active: true, url: 'chrome://newtab/', title: 'New Tab', status: 'complete' });
  const session = bootSwitcher({ tabs });
  await wait(30);
  const port = connectExtensionPage(session, 22, extensionPageAnswer);
  await session.visit([12, 11, 22]);
  session.press();
  await wait(400);
  assert.ok(port.received.some((message) => message.action === 'openTabSwitcherFromCommand'),
    'chrome://newtab showing Lumno should host the switcher through its bridge');
  assert.ok(!session.harness.calls.some((call) => call.name === 'tabs.update' && call.args[1].active === true),
    'the switcher should not jump to another tab');

  port.onDisconnect.dispatch();
  session.harness.calls.length = 0;
  port.received.length = 0;
  await wait(2100);
  session.press();
  await wait(1200);
  const opens = session.sent('openTabSwitcherFromCommand');
  assert.ok(opens.length === 1 && opens[0].tabId !== 22,
    'without its bridge the browser New Tab cannot host the switcher, so another tab should');
}

async function testAccentsFollowTheNewtabTheme() {
  const now = Date.now();
  const tabs = [
    { id: 31, windowId: 1, index: 0, active: true, url: 'https://www.youtube.com/watch?v=1', title: 'Video', status: 'complete' },
    { id: 32, windowId: 1, index: 1, active: false, url: 'https://checkout.shop-example.com/pay', title: 'Checkout', status: 'complete' },
    { id: 33, windowId: 1, index: 2, active: false, url: 'https://white.example.org/', title: 'White', status: 'complete' }
  ];
  const session = bootSwitcher({
    tabs,
    local: {
      [SITE_THEME_CACHE_KEY]: {
        version: 1,
        updatedAt: now,
        entries: {
          'youtube.com': { accentRgb: [1, 2, 3], source: 'meta', updatedAt: now },
          'shop-example.com': { accentRgb: [10, 120, 60], source: 'meta', updatedAt: now },
          'white.example.org': { accentRgb: [255, 255, 255], source: 'meta', updatedAt: now }
        }
      }
    }
  });
  await wait(60);
  await session.visit([33, 32, 31]);
  session.press();
  await wait(400);
  const accents = Object.fromEntries(session.sent('openTabSwitcherFromCommand')[0].message.context.tabs.map((tab) => [tab.id, tab.accentRgb]));
  assert.deepStrictEqual(accents[31], [255, 0, 0], 'a site with a brand color should use the same color as New Tab');
  assert.deepStrictEqual(accents[32], [10, 120, 60], 'subdomains should share their site\'s saved theme color');
  assert.deepStrictEqual(accents[33], [59, 130, 246], 'a neutral saved color such as white should fall back to the shared blue');
}

async function testInstallPreparesTheObserverInOpenTabs() {
  const tabs = [
    { id: 41, windowId: 1, active: false, url: 'https://a.example.com/', status: 'complete' },
    { id: 42, windowId: 1, active: true, url: 'https://b.example.com/', status: 'complete' },
    { id: 43, windowId: 1, active: false, url: 'chrome://extensions/', status: 'complete' },
    { id: 44, windowId: 1, active: false, url: 'https://c.example.com/', status: 'unloaded' },
    { id: 45, windowId: 1, active: false, url: 'https://d.example.com/', status: 'complete', discarded: true }
  ];
  const session = bootSwitcher({ tabs });
  await wait(30);
  session.harness.calls.length = 0;
  session.harness.chrome.runtime.onInstalled.dispatch({ reason: 'update', previousVersion: '1.0.0' });
  await wait(100);
  const observerTabs = session.scripts()
    .filter((script) => script.files && script.files[0] === 'build/shortcut-key-observer.js')
    .map((script) => script.target);
  assert.deepStrictEqual(observerTabs, [{ tabId: 42, allFrames: true }, { tabId: 41, allFrames: true }],
    'an update should install the observer into loaded web tabs, the active tab first');
}

async function testOtherExtensionNewtabSelectsTheBrowserSetting() {
  const session = bootSwitcher();
  await wait(30);
  const created = { id: 51, windowId: 1, url: '', status: 'loading' };
  session.harness.chrome.tabs.onCreated.dispatch(created);
  const updated = Object.assign({}, created, { url: 'chrome-extension://another-extension-id/newtab.html', status: 'complete' });
  session.harness.chrome.tabs.onUpdated.dispatch(51, { url: updated.url }, updated);
  await wait(50);
  const writes = session.harness.storage.sync.writes.filter((write) => RESTRICTED_ACTION_DONE_KEY in write);
  assert.deepStrictEqual(writes, [{ [RESTRICTED_ACTION_KEY]: 'none', [RESTRICTED_ACTION_DONE_KEY]: true }],
    'a New Tab owned by another extension should pick the browser setting once');
  const second = { id: 52, windowId: 1, url: '', status: 'loading' };
  session.harness.chrome.tabs.onCreated.dispatch(second);
  session.harness.chrome.tabs.onUpdated.dispatch(52, { url: updated.url }, Object.assign({}, second, { url: updated.url, status: 'complete' }));
  await wait(50);
  assert.strictEqual(session.harness.storage.sync.writes.filter((write) => RESTRICTED_ACTION_DONE_KEY in write).length, 1,
    'the automatic choice should only happen once');

  const chosen = bootSwitcher({ sync: { [RESTRICTED_ACTION_DONE_KEY]: true } });
  await wait(30);
  chosen.harness.chrome.tabs.onCreated.dispatch(created);
  chosen.harness.chrome.tabs.onUpdated.dispatch(51, { url: updated.url }, updated);
  await wait(50);
  assert.strictEqual(chosen.harness.storage.sync.writes.filter((write) => RESTRICTED_ACTION_DONE_KEY in write).length, 0,
    'a choice made before should not be overwritten');
}

async function testShowSearchOnTheNewtabFocusesItsInput() {
  const tabs = [{ id: 61, windowId: 1, active: true, url: 'chrome://newtab/', status: 'complete' }];
  const session = bootSwitcher({ tabs });
  await wait(30);
  session.harness.calls.length = 0;
  session.harness.chrome.commands.onCommand.dispatch('show-search');
  await wait(100);
  const focus = session.harness.calls.filter((call) => call.name === 'runtime.sendMessage' && call.args[0].action === 'lumno:newtab-focus-input');
  assert.deepStrictEqual(focus.map((call) => call.args[0].tabId), [61],
    'the search shortcut on a New Tab should focus its own search box');
  assert.ok(!session.scripts().some((script) => script.target && script.target.tabId === 61 && script.files && script.files.includes('build/overlay.js')),
    'the overlay should not be injected into the New Tab');
}

(async () => {
  await testCommandOpensTheRecentTabsOnTheActivePage();
  await testOtherSpaceCannotFillCandidatesOrUseRecentHistory();
  await testRepeatedCommandAdvancesTheOpenSwitcher();
  await testSuppressedAdvanceStillOpens();
  await testFallsBackToInjectingTheSwitcher();
  await testRepeatsWhileOpeningAreIgnored();
  await testDisabledSwitcherDoesNothing();
  await testRestrictedPageHostsTheSwitcherOnAnotherTab();
  await testReleaseCommitsOnlyForTheConfiguredModifier();
  await testUncommittedHostIsNotReportedAsCommitted();
  await testExtensionPagesAreReachedThroughTheirPort();
  await testBrowserNewtabWithABridgeHostsTheSwitcher();
  await testAccentsFollowTheNewtabTheme();
  await testInstallPreparesTheObserverInOpenTabs();
  await testOtherExtensionNewtabSelectsTheBrowserSetting();
  await testShowSearchOnTheNewtabFocusesItsInput();
  console.log('background tab switcher command tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
