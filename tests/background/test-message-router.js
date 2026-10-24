const assert = require('assert');

const routerApi = require('../../src/background/message-router.js');
const { loadBackground, wait } = require('../helpers/background-harness');

function testRouterModule() {
  const calls = [];
  const router = routerApi.createRouter(
    {
      switchToTab(request, sender, sendResponse) {
        calls.push({ action: 'switchToTab', request, sender });
        sendResponse({ ok: true });
        return undefined;
      },
      getTabsForOverlay(request, sender, sendResponse) {
        calls.push({ action: 'getTabsForOverlay', request, sender });
        sendResponse({ ok: true, area: 'tabs' });
        return true;
      }
    },
    {
      getSearchSuggestions(_request, _sender, sendResponse) {
        sendResponse({ ok: true, area: 'search' });
        return true;
      }
    }
  );

  let response = null;
  const asyncResult = routerApi.dispatch(
    router,
    { action: 'getTabsForOverlay' },
    { tab: { id: 42 } },
    (value) => {
      response = value;
    }
  );
  assert.strictEqual(asyncResult, true, 'an async handler result should reach the runtime listener');
  assert.deepStrictEqual(response, { ok: true, area: 'tabs' });
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].sender.tab.id, 42);

  routerApi.dispatch(router, { action: 'getSearchSuggestions' }, {}, (value) => {
    response = value;
  });
  assert.deepStrictEqual(response, { ok: true, area: 'search' }, 'handlers from every map should be routed');

  response = null;
  const unknownResult = routerApi.dispatch(router, { action: 'unknownAction' }, {}, (value) => {
    response = value;
  });
  assert.strictEqual(unknownResult, undefined);
  assert.deepStrictEqual(response, { ok: false });

  response = null;
  routerApi.dispatch(router, null, {}, (value) => {
    response = value;
  });
  assert.deepStrictEqual(response, { ok: false }, 'a message without an action is unknown');

  assert.strictEqual(router.has('switchToTab'), true);
  assert.deepStrictEqual(router.actions().sort(), ['getSearchSuggestions', 'getTabsForOverlay', 'switchToTab']);

  assert.throws(() => {
    routerApi.createRouter({ duplicate() {} }, { duplicate() {} });
  }, /Duplicate background message action: duplicate/);
  assert.throws(() => {
    routerApi.createRouter({ broken: 'not a function' });
  }, /not a function: broken/);
}

function testSenderPolicyModule() {
  const extensionBaseUrl = 'chrome-extension://lumno/';
  const policy = routerApi.createSenderPolicy({
    extensionBaseUrl,
    pageActions: ['createTab', 'getTabsForOverlay'],
    pageArgumentGuards: {
      createTab: (request) => /^https:/.test(request.url)
    }
  });
  const extensionPage = { url: `${extensionBaseUrl}newtab.html`, tab: { id: 1 } };
  const webPage = { url: 'https://example.com/', tab: { id: 2 } };
  const lookalike = { url: 'https://chrome-extension.example/lumno/', tab: { id: 3 } };
  assert.strictEqual(policy.isExtensionPageSender(extensionPage), true);
  assert.strictEqual(policy.isExtensionPageSender(webPage), false);
  assert.strictEqual(policy.isExtensionPageSender(lookalike), false);
  assert.strictEqual(policy.isExtensionPageSender({}), false, 'a sender without a URL is not an extension page');

  assert.deepStrictEqual(policy.check('openBookmarkManager', {}, extensionPage), { ok: true });
  assert.deepStrictEqual(policy.check('openBookmarkManager', {}, webPage),
    { ok: false, reason: 'sender-not-allowed' }, 'web pages reach only the actions their surfaces use');
  assert.deepStrictEqual(policy.check('getTabsForOverlay', {}, webPage), { ok: true });
  assert.deepStrictEqual(policy.check('createTab', { url: 'https://example.com/' }, webPage), { ok: true });
  assert.deepStrictEqual(policy.check('createTab', { url: 'data:text/html,x' }, webPage),
    { ok: false, reason: 'argument-not-allowed' }, 'web-page arguments must pass the action guard');
  assert.deepStrictEqual(policy.check('createTab', { url: 'data:text/html,x' }, extensionPage), { ok: true },
    'extension pages are not limited by web-page guards');

  const handled = [];
  const router = routerApi.createRouter({
    openBookmarkManager(request, sender, sendResponse) {
      handled.push('openBookmarkManager');
      sendResponse({ ok: true });
    }
  });
  let response = null;
  routerApi.dispatch(router, { action: 'openBookmarkManager' }, webPage, (value) => {
    response = value;
  }, policy);
  assert.deepStrictEqual(response, { ok: false, reason: 'sender-not-allowed' });
  assert.deepStrictEqual(handled, [], 'a rejected message must not reach its handler');
  routerApi.dispatch(router, { action: 'openBookmarkManager' }, extensionPage, (value) => {
    response = value;
  }, policy);
  assert.deepStrictEqual(response, { ok: true });
  assert.deepStrictEqual(handled, ['openBookmarkManager']);
}

// Every runtime message the extension's pages and content scripts send must
// keep reaching a background handler.
const EXPECTED_BACKGROUND_ACTIONS = [
  'webdav',
  'switchToTab', 'closeTabFromTabSwitcher', 'notifyTopFrameDocumentStarted', 'notifyOverlayClosed',
  'updateOverlayLoadingSession', 'getTabsForOverlay', 'trackSearchTab', 'closeOtherTabsForOverlay',
  'swapNewtabForFocus',
  'getShowSearchShortcut', 'getCopyCurrentUrlCommandShortcut', 'copyCurrentPageUrl',
  'triggerShowSearchFromPageHotkey', 'triggerTabSwitcherFromCtrlTab', 'notifyTabSwitcherShortcutModifierReleased', 'getShortcutRules',
  'pipRequestOwnership', 'pipReleaseOwnership', 'openDocumentPipPicker', 'siteTryEnterPiPInMainWorld',
  'iqiyiTryEnterPiPInMainWorld', 'iqiyiSetupAutoPiPInMainWorld', 'forceExitPiPInMainWorld',
  'ytForceExitPiPInMainWorld',
  'searchOrNavigate', 'getSearchSuggestions', 'getSearchEngineSuggestions',
  'recordSearchSuggestionSelection', 'deleteHistoryUrl',
  'getSiteSearchProviders', 'getHelpCenterSearchResults', 'runSiteSearchProviderQuery',
  'runAggregateSearchQuery',
  'runSelectionQuickAction',
  'getWebAppearance', 'setWebAppearance',
  'linkPreviewPrepare', 'linkPreviewOpen', 'linkPreviewClose', 'linkPreviewOpenInTab',
  'getLocaleMessages', 'getFileSchemeAccessStatus',
  'openOptionsPage', 'openOnboardingPage', 'openExtensionShortcutsPage', 'openSiteSearchOptionsPage',
  'openReleasePage', 'openBookmarkManager', 'openBookmarkFolderInNewTabGroup', 'createTab', 'openNewTab',
  'openExtensionDetailsPage', 'probeProgressSeries',
  'popupOpenDocumentPipPicker', 'popupShowSearch', 'popupAddPageShortcut', 'popupShowPageToast',
  'popupGetRecentPin', 'popupToggleRecentPin',
  'resolveFaviconCandidates', 'getFaviconData', 'getShortcutFaviconData', 'resolveSiteThemeColor'
];

async function testBackgroundRegistry() {
  const harness = loadBackground({
    tabs: [{ id: 5, windowId: 1, index: 0, active: true, url: 'https://example.com/', title: 'Example' }],
    commands: [{ name: 'show-search', shortcut: '⌘⇧K' }, { name: 'show-tab-switcher', shortcut: 'Alt+Q' }],
    expose: ['backgroundMessageRouter']
  });
  const router = harness.exposed('backgroundMessageRouter');
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(router.actions())).sort(),
    EXPECTED_BACKGROUND_ACTIONS.slice().sort(),
    'the background should route exactly the known runtime message actions'
  );

  const unknown = await harness.sendMessage({ action: 'definitelyNotAnAction' });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(unknown)), { ok: false });

  const shortcut = await harness.sendMessage({ action: 'getShowSearchShortcut' });
  assert.ok(shortcut && typeof shortcut.shortcut === 'string' && shortcut.shortcut.length > 0,
    'a routed handler should answer through sendResponse');

  const senderTab = { id: 5, windowId: 1, url: 'https://example.com/' };
  const release = await harness.sendMessage(
    { action: 'notifyTabSwitcherShortcutModifierReleased', key: 'Alt' },
    { tab: senderTab }
  );
  assert.strictEqual(release && release.ok, true,
    'a trusted frame release should be routed into the tab switcher commit path');
  assert.strictEqual(release.committed, false, 'no switcher is open, so nothing is committed');

  const copy = harness.sendMessage({ action: 'copyCurrentPageUrl' }, { tab: senderTab });
  await wait(30);
  assert.ok(
    harness.calls.some((call) => call.name === 'tabs.sendMessage' && call.args[0] === 5 &&
      call.args[1] && call.args[1].action === 'copyCurrentPageUrlFromCommand'),
    'the slash command should reuse the current-page copy behavior in the sender tab'
  );
  await copy;

  const selection = await harness.sendMessage({ action: 'runSelectionQuickAction' }, { tab: senderTab });
  assert.strictEqual(selection && selection.ok, false);
  assert.ok(selection.reason, 'the selection quick action handler, not the unknown-action reply, should answer');

  // Chromium has no website appearance setting, so /appearance stays hidden;
  // the overlay may only ask for one of Firefox's three values.
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(await harness.sendMessage({ action: 'getWebAppearance' }, { tab: senderTab, url: senderTab.url }))),
    { supported: false, mode: 'auto', controllable: false });
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(await harness.sendMessage({ action: 'setWebAppearance', mode: 'sepia' }, { tab: senderTab, url: senderTab.url }))),
    { ok: false, reason: 'argument-not-allowed' });

  // Content scripts and the in-page overlay run inside web pages.
  const webPageSender = { tab: senderTab, url: senderTab.url };
  for (const action of ['webdav', 'openBookmarkManager', 'getShortcutFaviconData', 'resolveFaviconCandidates',
    'openExtensionDetailsPage', 'swapNewtabForFocus', 'trackSearchTab', 'getFileSchemeAccessStatus',
    'popupOpenDocumentPipPicker', 'popupShowSearch', 'popupAddPageShortcut', 'popupShowPageToast',
    'popupGetRecentPin', 'popupToggleRecentPin']) {
    const rejected = await harness.sendMessage({ action, op: 'status' }, webPageSender);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(rejected)), { ok: false, reason: 'sender-not-allowed' },
      `${action} should be refused when a web page context sends it`);
  }
  const callCount = () => harness.calls.filter((call) => call.name === 'tabs.create' || call.name === 'tabs.update').length;
  const beforeBlockedTabs = callCount();
  for (const url of [
    'data:text/html,<h1>Sign in</h1>',
    'javascript:alert(1)',
    'chrome-extension://another-extension-id/page.html',
    'view-source:javascript:alert(1)'
  ]) {
    const blocked = await harness.sendMessage({ action: 'createTab', url }, webPageSender);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(blocked)), { ok: false, reason: 'argument-not-allowed' },
      `a web page context must not open ${url}`);
  }
  assert.strictEqual(callCount(), beforeBlockedTabs, 'refused createTab requests must not open or navigate a tab');
  for (const url of ['https://example.com/next', 'file:///Users/someone/report.pdf', 'chrome://settings/']) {
    harness.sendMessage({ action: 'createTab', url, disposition: 'backgroundTab' }, webPageSender);
  }
  await wait(30);
  assert.strictEqual(callCount() - beforeBlockedTabs, 3,
    'typed, bookmarked and browser-page targets opened from the overlay keep working');
  const fromExtensionPage = harness.sendMessage({ action: 'openBookmarkManager' });
  await wait(30);
  assert.notDeepStrictEqual(JSON.parse(JSON.stringify((await fromExtensionPage) || {})),
    { ok: false, reason: 'sender-not-allowed' }, 'extension pages may send every action');

  // The toolbar popup names the tab it showed; a tab closed since then is a no-op.
  assert.deepStrictEqual(JSON.parse(JSON.stringify(await harness.sendMessage({ action: 'popupShowSearch', tabId: 404 }))),
    { ok: false });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(await harness.sendMessage({ action: 'popupShowSearch', tabId: 5 }))),
    { ok: true });
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(await harness.sendMessage({ action: 'popupOpenDocumentPipPicker', tabId: 404 }))),
    { ok: false });
}

(async () => {
  testRouterModule();
  testSenderPolicyModule();
  await testBackgroundRegistry();
  console.log('message router tests passed');
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
