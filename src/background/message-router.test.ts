import { describe, expect, it, vi } from 'vitest';
import type { BackgroundHandlerMap } from './message-router';
import { createRouter, createSenderPolicy, dispatch } from './message-router';
import { bootWorker, browserTab } from '../../tests/fakes/worker';

describe('the background message router', () => {
  function createTestRouter() {
    const switchToTab = vi.fn<NonNullable<BackgroundHandlerMap['switchToTab']>>((_request, _sender, sendResponse) => {
      sendResponse({ ok: false, reason: 'switch' });
    });
    const getTabsForOverlay = vi.fn<NonNullable<BackgroundHandlerMap['getTabsForOverlay']>>((_request, _sender, sendResponse) => {
      sendResponse({ ok: false, reason: 'tabs' });
      return true;
    });
    const router = createRouter({ switchToTab, getTabsForOverlay }, {
      getSearchSuggestions(_request, _sender, sendResponse) {
        sendResponse({ ok: false, reason: 'search' });
        return true;
      }
    });
    return { router, switchToTab, getTabsForOverlay };
  }

  it('hands a message to the handler of its action and keeps an async answer open', () => {
    const { router, getTabsForOverlay } = createTestRouter();
    const sendResponse = vi.fn();
    const sender = { tab: browserTab({ id: 42 }) };

    expect(dispatch(router, { action: 'getTabsForOverlay' }, sender, sendResponse)).toBe(true);
    expect(sendResponse).toHaveBeenCalledWith({ ok: false, reason: 'tabs' });
    expect(getTabsForOverlay).toHaveBeenCalledTimes(1);
    expect(getTabsForOverlay.mock.calls[0][1]).toBe(sender);
  });

  it('routes the handlers of every map', () => {
    const { router } = createTestRouter();
    const sendResponse = vi.fn();
    dispatch(router, { action: 'getSearchSuggestions' }, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({ ok: false, reason: 'search' });
    expect(router.has('switchToTab')).toBe(true);
    expect(router.actions().sort()).toEqual(['getSearchSuggestions', 'getTabsForOverlay', 'switchToTab']);
  });

  it('answers an unknown action, or a message without one, with a refusal', () => {
    const { router } = createTestRouter();
    const unknown = vi.fn();
    const empty = vi.fn();

    expect(dispatch(router, { action: 'unknownAction' }, {}, unknown)).toBeUndefined();
    expect(unknown).toHaveBeenCalledWith({ ok: false });
    dispatch(router, null, {}, empty);
    expect(empty).toHaveBeenCalledWith({ ok: false });
  });

  it('refuses an action registered twice, or a handler that is not a function', () => {
    const noop = () => {};
    const broken: BackgroundHandlerMap = {};
    Reflect.set(broken, 'switchToTab', 'not a function');

    expect(() => createRouter({ switchToTab: noop }, { switchToTab: noop })).toThrow(/Duplicate background message action: switchToTab/);
    expect(() => createRouter(broken)).toThrow(/not a function: switchToTab/);
  });
});

describe('the sender policy', () => {
  const extensionBaseUrl = 'chrome-extension://lumno/';
  const policy = createSenderPolicy({
    extensionBaseUrl,
    pageActions: ['createTab', 'getTabsForOverlay'],
    pageArgumentGuards: { createTab: (request) => /^https:/.test(String(request.url)) }
  });
  const extensionPage = { url: `${extensionBaseUrl}newtab.html`, tab: browserTab({ id: 1 }) };
  const webPage = { url: 'https://example.com/', tab: browserTab({ id: 2 }) };

  it('tells extension pages from web pages and lookalikes', () => {
    expect(policy.isExtensionPageSender(extensionPage)).toBe(true);
    expect(policy.isExtensionPageSender(webPage)).toBe(false);
    expect(policy.isExtensionPageSender({ url: 'https://chrome-extension.example/lumno/', tab: browserTab({ id: 3 }) })).toBe(false);
    expect(policy.isExtensionPageSender({})).toBe(false);
  });

  it('lets web pages send only the actions their surfaces use, with arguments that pass the guard', () => {
    expect(policy.check('openBookmarkManager', {}, extensionPage)).toEqual({ ok: true });
    expect(policy.check('openBookmarkManager', {}, webPage)).toEqual({ ok: false, reason: 'sender-not-allowed' });
    expect(policy.check('getTabsForOverlay', {}, webPage)).toEqual({ ok: true });
    expect(policy.check('createTab', { url: 'https://example.com/' }, webPage)).toEqual({ ok: true });
    expect(policy.check('createTab', { url: 'data:text/html,x' }, webPage)).toEqual({ ok: false, reason: 'argument-not-allowed' });
    expect(policy.check('createTab', { url: 'data:text/html,x' }, extensionPage)).toEqual({ ok: true });
  });

  it('keeps a refused message from its handler', () => {
    const openBookmarkManager = vi.fn<NonNullable<BackgroundHandlerMap['openBookmarkManager']>>((_request, _sender, sendResponse) => {
      sendResponse({ ok: false, reason: 'handled' });
    });
    const router = createRouter({ openBookmarkManager });
    const refused = vi.fn();
    const accepted = vi.fn();

    dispatch(router, { action: 'openBookmarkManager' }, webPage, refused, policy);
    expect(refused).toHaveBeenCalledWith({ ok: false, reason: 'sender-not-allowed' });
    expect(openBookmarkManager).not.toHaveBeenCalled();
    dispatch(router, { action: 'openBookmarkManager' }, extensionPage, accepted, policy);
    expect(openBookmarkManager).toHaveBeenCalledTimes(1);
  });
});

// Every runtime message the extension's pages and content scripts send must
// keep reaching a background handler.
const EXPECTED_BACKGROUND_ACTIONS = [
  'webdav',
  'switchToTab', 'closeTabFromTabSwitcher', 'notifyTopFrameDocumentStarted', 'notifyOverlayClosed',
  'updateOverlayLoadingSession', 'getTabsForOverlay', 'trackSearchTab', 'closeOtherTabsForOverlay',
  'swapNewtabForFocus',
  'getShowSearchShortcut', 'getCopyCurrentUrlCommandShortcut', 'copyCurrentPageUrl',
  'triggerShowSearchFromPageHotkey', 'notifyTabSwitcherShortcutModifierReleased', 'getShortcutRules',
  'pipRequestOwnership', 'pipReleaseOwnership', 'openDocumentPipPicker', 'siteTryEnterPiPInMainWorld',
  'iqiyiTryEnterPiPInMainWorld', 'iqiyiSetupAutoPiPInMainWorld', 'forceExitPiPInMainWorld',
  'ytForceExitPiPInMainWorld',
  'searchOrNavigate', 'getSearchSuggestions', 'getSearchEngineSuggestions',
  'recordSearchSuggestionSelection', 'deleteHistoryUrl',
  'getSiteSearchProviders', 'getHelpCenterSearchResults', 'runSiteSearchProviderQuery',
  'runAggregateSearchQuery',
  'runSelectionQuickAction',
  'getWebAppearance', 'setWebAppearance',
  'linkPreviewPrepare', 'linkPreviewOpen', 'linkPreviewCancel', 'linkPreviewClose', 'linkPreviewOpenInTab',
  'linkPreviewFrameBind', 'linkPreviewFrameNavigating', 'linkPreviewFrameCommitted', 'linkPreviewFrameRefused',
  'getLocaleMessages', 'getFileSchemeAccessStatus',
  'openOptionsPage', 'openOnboardingPage', 'openExtensionShortcutsPage', 'openSiteSearchOptionsPage',
  'openReleasePage', 'openBookmarkManager', 'openBookmarkFolderInNewTabGroup', 'createTab', 'openNewTab',
  'openExtensionDetailsPage', 'checkGraphicsRendering', 'openGraphicsSettings', 'probeProgressSeries',
  'popupOpenDocumentPipPicker', 'popupShowSearch', 'popupAddPageShortcut', 'popupShowPageToast',
  'popupGetRecentPin', 'popupToggleRecentPin',
  'resolveFaviconCandidates', 'getFaviconData', 'getShortcutFaviconData', 'resolveSiteThemeColor'
];

describe("the worker's message routes", () => {
  const senderTab = browserTab({ id: 5, windowId: 1, url: 'https://example.com/', active: true, title: 'Example' });
  const webPageSender = { tab: senderTab, url: senderTab.url };
  const bootRoutes = () => bootWorker({
    tabs: [{ id: 5, windowId: 1, index: 0, active: true, url: 'https://example.com/', title: 'Example' }],
    commands: [{ name: 'show-search', shortcut: '⌘⇧K' }, { name: 'show-tab-switcher', shortcut: 'Alt+Q' }]
  });

  it('routes exactly the known actions, through their handlers', async () => {
    const fake = await bootRoutes();
    const { backgroundMessageRouter } = await import('./background');

    expect(backgroundMessageRouter.actions().sort()).toEqual(EXPECTED_BACKGROUND_ACTIONS.slice().sort());
    expect(await fake.sendMessage({ action: 'definitelyNotAnAction' })).toEqual({ ok: false });
    expect(await fake.sendMessage({ action: 'getShowSearchShortcut' })).toMatchObject({ shortcut: expect.stringMatching(/.+/) });
    expect(await fake.sendMessage({ action: 'notifyTabSwitcherShortcutModifierReleased', key: 'Alt' }, { tab: senderTab }))
      .toMatchObject({ ok: true, committed: false });
    expect(await fake.sendMessage({ action: 'runSelectionQuickAction' }, { tab: senderTab }))
      .toMatchObject({ ok: false, reason: expect.stringMatching(/.+/) });
  });

  it('copies the current page URL in the sender tab for the slash command', async () => {
    const fake = await bootRoutes();
    const copy = fake.sendMessage({ action: 'copyCurrentPageUrl' }, { tab: senderTab });

    await vi.waitFor(() => expect(fake.chrome.tabs.sendMessage.mock.calls)
      .toContainEqual([5, { action: 'copyCurrentPageUrlFromCommand' }, expect.any(Function)]));
    await copy;
  });

  it("keeps Chromium's website appearance unsupported and takes only Firefox's three values", async () => {
    const fake = await bootRoutes();

    expect(await fake.sendMessage({ action: 'getWebAppearance' }, webPageSender)).toEqual({ supported: false, mode: 'auto', controllable: false });
    expect(await fake.sendMessage({ action: 'setWebAppearance', mode: 'sepia' }, webPageSender))
      .toEqual({ ok: false, reason: 'argument-not-allowed' });
  });

  it.each([
    'webdav', 'openBookmarkManager', 'getShortcutFaviconData', 'resolveFaviconCandidates', 'openExtensionDetailsPage',
    'swapNewtabForFocus', 'trackSearchTab', 'getFileSchemeAccessStatus', 'popupOpenDocumentPipPicker', 'popupShowSearch',
    'popupAddPageShortcut', 'popupShowPageToast', 'popupGetRecentPin', 'popupToggleRecentPin'
  ])('refuses %s from a web page', async (action) => {
    const fake = await bootRoutes();

    expect(await fake.sendMessage({ action, op: 'status' }, webPageSender)).toEqual({ ok: false, reason: 'sender-not-allowed' });
  });

  it('opens typed, bookmarked and browser pages from a web page, but not scripts, documents or other extensions', async () => {
    const fake = await bootRoutes();
    const openedTabs = () => fake.chrome.tabs.create.mock.calls.length + fake.chrome.tabs.update.mock.calls.length;
    const before = openedTabs();
    for (const url of ['data:text/html,<h1>Sign in</h1>', 'javascript:alert(1)',
      'chrome-extension://another-extension-id/page.html', 'view-source:javascript:alert(1)']) {
      expect(await fake.sendMessage({ action: 'createTab', url }, webPageSender)).toEqual({ ok: false, reason: 'argument-not-allowed' });
    }
    expect(openedTabs()).toBe(before);

    ['https://example.com/next', 'file:///Users/someone/report.pdf', 'chrome://settings/'].forEach((url) => {
      void fake.sendMessage({ action: 'createTab', url, disposition: 'backgroundTab' }, webPageSender);
    });
    await vi.waitFor(() => expect(openedTabs() - before).toBe(3));
  });

  it("probes the graphics again and opens the browser's own setting for the overlay's notice", async () => {
    const fake = await bootRoutes();

    expect(await fake.sendMessage({ action: 'checkGraphicsRendering' }, webPageSender)).toEqual({ rendering: 'unknown' });
    expect(await fake.sendMessage({ action: 'openGraphicsSettings' }, webPageSender)).toMatchObject({ ok: true });
    expect(fake.chrome.tabs.create).toHaveBeenCalledWith(expect.objectContaining({ url: 'chrome://settings/system' }), expect.anything());
  });

  it('lets extension pages send every action', async () => {
    const fake = await bootRoutes();

    expect(await fake.sendMessage({ action: 'openBookmarkManager' })).not.toEqual({ ok: false, reason: 'sender-not-allowed' });
  });

  it('does nothing for a popup tab closed since it showed', async () => {
    const fake = await bootRoutes();

    expect(await fake.sendMessage({ action: 'popupShowSearch', tabId: 404 })).toEqual({ ok: false });
    expect(await fake.sendMessage({ action: 'popupShowSearch', tabId: 5 })).toEqual({ ok: true });
    expect(await fake.sendMessage({ action: 'popupOpenDocumentPipPicker', tabId: 404 })).toEqual({ ok: false });
  });
});
