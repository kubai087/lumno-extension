// The worker runs these modules in this order before its own code: the
// shared and background modules first, then the services split out of this
// file.
import '../domain/blacklist-utils';
import * as LumnoUrlGuards from '../platform/url-guards';
import '../domain/shortcut-key-matcher';
import '../shared/favicon/favicon-theme';
import '../domain/extension-routes';
import './command-target-policy';
import * as LumnoSettings from '../domain/settings';
import * as LumnoSettingsMigration from '../platform/settings-migration';
import * as LumnoBookmarkFolderBindings from '../platform/bookmark-folder-bindings';
import '../domain/site-display-name';
import './page-shortcut-menu';
import '../shared/wallpaper-local-store';
import * as WebDavManager from './webdav-sync/manager';
import * as WebDavRecords from './webdav-sync/records';
import * as UPDATE_NOTICE from '../platform/update-notice';
import { HAN_VARIANT_PAIRS } from '../domain/search/han-variants.generated';
import { installHanVariantPairs } from '../domain/search/han-variants';
import '../domain/search/utils/direct-navigation';
import '../domain/search/utils/text-normalize';
import '../domain/search/utils/text-index';
import '../domain/search/utils/keyboard-layouts';
import '../domain/search/utils/selection-stats';
import '../domain/search/utils/result-dedup';
import '../domain/search/utils/query-intent';
import '../domain/search/utils/relevance-score';
import '../domain/search/utils/brand-suggestions';
import '../domain/search/utils/navigation-matching';
import '../domain/search/utils/site-search-providers';
import '../domain/search/utils/site-search-matching';
import '../domain/selection-intent';
import '../shared/search/site-search-store';
import '../domain/community-links';
import '../domain/search/aggregate-search-store';
import './ai-provider-submit';
import * as BACKGROUND_PAGES from './extension-pages';
import './tab-groups';
import './search-result-tabs';
import './bookmark-tab-groups';
import './selection-target';
import './selection-quick-action-provider';
import * as LumnoSelectionScriptRegistration from './selection-script-registration';
import * as LumnoPipPageBridgeRegistration from './pip-page-bridge-registration';
import * as BACKGROUND_MESSAGE_ROUTER from './message-router';
import './newtab-fallback';
import '../platform/browser-profile';
import './shortcut-rules';
import * as LumnoWebAppearance from './web-appearance';
import './pip-ownership';
import '../shared/pip-main-world';
import '../domain/progress-match';
import '../domain/progress-history';
import './popup-recent-pin';
import { pageShortcutMenuController, startProgressTracking, startReadLater } from './worker-controllers';
import './overlay-loading-lifecycle';
import * as DEV_EXTENSION_STARTUP from './dev-extension-startup';
import { loadFirefoxBrandIcon } from './tab-switcher/appearance';
import { triggerTabSwitcherForTab } from './tab-switcher/open';
import { prepareShortcutKeyObserversInOpenTabs } from './tab-switcher/shortcut-release';
import { ensureTabSwitcherStateLoaded, flushPendingTabSwitcherState } from './tab-switcher/state-store';
import { registerTabSwitcherExtensionPagePortConnection } from './tab-switcher-extension-page';
import {
  flushPendingPinnedTabSnapshot,
  restorePinnedTabsFromSnapshotOnStartup,
  schedulePersistPinnedTabSnapshot
} from './pinned-tab-recovery';
import { refreshDefaultSearchEngineState, updateDefaultSearchEngineFromUrl } from './search/default-engine';
import {
  clearPendingSearch,
  pendingSearchAt,
  pendingSearchGroupContext,
  pendingSearchTabId,
  setPendingSearchTabId
} from './search/pending-search';
import { getSiteSearchProviderEntryUrl, warmSiteSearchProviderIcons } from './search/site-search-providers';
import {
  maybeAutoSelectRestrictedBrowserSetting,
  moveTabToSourceGroupContext,
  rememberBrowserNewtabProviderCandidate
} from './browser-urls-service';
import { ensureTabSwitchStatsLoaded } from './tab-switch-stats-service';
import { PIP_MESSAGE_HANDLERS } from './pip-service';
import type { BackgroundHandler } from './message-router';
import { SELECTION_QUICK_ACTION_MESSAGE_HANDLERS } from './selection-quick-actions-service';
import {
  SEARCH_MESSAGE_HANDLERS,
  SITE_SEARCH_MESSAGE_HANDLERS,
  readSiteSearchProvider
} from './site-search-service';
import { selectionQuickActionsEnabled, siteSearchCustom, siteSearchDisabled } from '../domain/settings';
import {
  PINYIN_DATA_SCRIPT_PATH,
  SHOW_SEARCH_COMMAND_NAME,
  SHOW_SEARCH_PREFILL_COMMAND_NAME,
  SHOW_SEARCH_PREFILL_V_COMMAND_NAME,
  SHOW_TAB_SWITCHER_COMMAND_NAME,
  SHOW_TAB_SWITCHER_REVERSE_COMMAND_NAME,
  getImportScripts,
  isPrimaryStorageAreaName,
  logHotkeyDebug,
  providerStorageRuntime,
  storageArea,
  warnBackgroundFailure,
  workerSettings
} from './worker-context';
import { getRecentPageHotkeyContext } from './command-context';
import { recoverFromPageHotkeyNewtab, triggerCopyCurrentUrlForTab, triggerShowSearchForTab } from './command-service';
import { getBackgroundFaviconCacheRuntime } from './favicon/candidates';
import { SITE_SEARCH_SHORTCUT_ICON_SETTINGS } from './favicon/site-search-icons';
import * as FrameRules from './link-preview/frame-rules';
import * as Service from './link-preview/service';
import './overlay-loading-service';
import './overlay-open-service';
import { registerTabLifecycleEvents } from './tab-lifecycle-events';
import { EXTENSION_PAGE_MESSAGE_HANDLERS } from './message-handlers/extension-page';
import { GRAPHICS_MESSAGE_HANDLERS } from './message-handlers/graphics';
import { refreshGraphicsProbe } from './graphics-probe';
import { FAVICON_MESSAGE_HANDLERS } from './message-handlers/favicon';
import { LOCALE_AND_PERMISSION_MESSAGE_HANDLERS } from './message-handlers/locale';
import { POPUP_MESSAGE_HANDLERS } from './message-handlers/toolbar-popup';
import { SHORTCUT_MESSAGE_HANDLERS } from './message-handlers/shortcut';
import { TAB_MESSAGE_HANDLERS } from './message-handlers/tab';
import * as SettingsStorage from '../platform/settings-storage';

// Folds traditional characters to simplified ones for local search matching.
installHanVariantPairs(HAN_VARIANT_PAIRS);

// See PINYIN_DATA_SCRIPT_PATH: the worker imports pinyin-pro while installing
// so that it may import it again on first use.
const importScriptsForInstall = getImportScripts();
if (importScriptsForInstall && typeof globalThis.addEventListener === 'function') {
  globalThis.addEventListener('install', () => {
    importScriptsForInstall(chrome.runtime.getURL(PINYIN_DATA_SCRIPT_PATH));
  });
}
const openOnboardingPage = BACKGROUND_PAGES.openOnboardingPage;
const shouldOpenOnboardingForUpdate = BACKGROUND_PAGES.shouldOpenOnboardingForUpdate;

startProgressTracking();
function migrateStorageIfNeeded(keys: string[]): void {
  if (isPrimaryStorageAreaName('local')) {
    return;
  }
  SettingsStorage.migrateLocalSettingsToSync(chrome.storage.local, storageArea, keys);
}

loadFirefoxBrandIcon();

function publishExtensionUpdateNotice(details: chrome.runtime.InstalledDetails): void {
  const version = UPDATE_NOTICE.getCurrentVersionTag(chrome);
  UPDATE_NOTICE.publishUpdateNotice({
    chromeApi: chrome,
    settingsStore: workerSettings,
    fetchImpl: typeof fetch === 'function' ? fetch : null,
    version,
    previousVersion: details.previousVersion || '',
    reason: 'update'
  }).catch(warnBackgroundFailure('Failed to publish the extension update notice.'));
}

chrome.commands.onCommand.addListener(function(command) {
  if (
    command !== SHOW_SEARCH_COMMAND_NAME &&
    command !== SHOW_SEARCH_PREFILL_COMMAND_NAME &&
    command !== SHOW_SEARCH_PREFILL_V_COMMAND_NAME &&
    command !== SHOW_TAB_SWITCHER_COMMAND_NAME &&
    command !== SHOW_TAB_SWITCHER_REVERSE_COMMAND_NAME
  ) {
    return;
  }
  const isTabSwitcherCommand = command === SHOW_TAB_SWITCHER_COMMAND_NAME ||
    command === SHOW_TAB_SWITCHER_REVERSE_COMMAND_NAME;
  const commandObservedAt = Date.now();
  const source = command === SHOW_SEARCH_COMMAND_NAME
    ? 'commands'
    : (command === SHOW_SEARCH_PREFILL_COMMAND_NAME
      ? 'commands-prefill'
      : (command === SHOW_SEARCH_PREFILL_V_COMMAND_NAME ? 'commands-copy-url' : 'commands-tab-switcher'));
  logHotkeyDebug('received', { command: command, source: source });
  chrome.tabs.query({active: true, currentWindow: true}, function(activeTabs) {
    if (command === SHOW_SEARCH_PREFILL_V_COMMAND_NAME) {
      triggerCopyCurrentUrlForTab(activeTabs[0], source);
      return;
    }
    if (isTabSwitcherCommand) {
      triggerTabSwitcherForTab(activeTabs[0], source, commandObservedAt,
        command === SHOW_TAB_SWITCHER_REVERSE_COMMAND_NAME ? -1 : 1);
      return;
    }
    triggerShowSearchForTab(activeTabs[0], source);
  });
});

if (chrome && chrome.runtime && chrome.runtime.onConnect) {
  chrome.runtime.onConnect.addListener(registerTabSwitcherExtensionPagePortConnection);
}

chrome.tabs.onCreated.addListener((tab) => {
  rememberBrowserNewtabProviderCandidate(tab);
  maybeAutoSelectRestrictedBrowserSetting(tab, 'created');
  const recentContext = getRecentPageHotkeyContext(tab && typeof tab.windowId === 'number' ? tab.windowId : null);
  if (!recentContext || !tab || typeof tab.id !== 'number') {
    schedulePersistPinnedTabSnapshot();
    return;
  }
  setTimeout(() => {
    recoverFromPageHotkeyNewtab(tab.id, recentContext.windowId);
  }, 120);
  schedulePersistPinnedTabSnapshot();
});

// A development build in August 2026 restricted chrome.storage.local to
// trusted contexts. Chrome keeps an area's access level after the code that
// set it is gone, so content scripts in those profiles still cannot read local
// storage, and the overlay waited out every settings-mode retry (about two
// seconds) before it showed; a second shortcut press closed it unseen. Put
// the default back whenever the extension is installed or updated.
function restoreLocalStorageContentScriptAccess(): void {
  const localArea = chrome && chrome.storage ? chrome.storage.local : null;
  if (!localArea || typeof localArea.setAccessLevel !== 'function') {
    return;
  }
  try {
    const pending = localArea.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
    if (pending && typeof pending.catch === 'function') {
      pending.catch(warnBackgroundFailure('Failed to restore content script access to local storage.'));
    }
  } catch (error) {
    warnBackgroundFailure('Failed to restore content script access to local storage.')(error);
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  restoreLocalStorageContentScriptAccess();
  void refreshGraphicsProbe();
  // Static manifest content scripts only apply to future document loads. A
  // development-extension reload keeps existing tabs alive, so install the
  // shortcut observer there now instead of waiting for the next shortcut.
  prepareShortcutKeyObserversInOpenTabs();
  if (!details) {
    schedulePersistPinnedTabSnapshot();
    return;
  }
  const reason = String(details.reason || '');
  if (reason === 'install') {
    openOnboardingPage({ reason: 'install' });
    schedulePersistPinnedTabSnapshot();
    return;
  }
  if (reason === 'update') {
    const isSameVersionReload = DEV_EXTENSION_STARTUP.isSameVersionReload(details, chrome.runtime.getManifest().version);
    if (!isSameVersionReload) {
      if (shouldOpenOnboardingForUpdate(details)) {
        openOnboardingPage({ reason: 'update' });
      }
      publishExtensionUpdateNotice(details);
    }
  }
  if (reason === 'update' || reason === 'chrome_update') {
    restorePinnedTabsFromSnapshotOnStartup().catch(warnBackgroundFailure('Failed to restore pinned tabs.')).finally(() => {
      schedulePersistPinnedTabSnapshot({ skipEmptyWhenNoNormalWindows: true });
    });
    return;
  }
  schedulePersistPinnedTabSnapshot({ skipEmptyWhenNoNormalWindows: true });
});

function restoreBackgroundStateOnStartup(): Promise<void> {
  return restorePinnedTabsFromSnapshotOnStartup().catch(warnBackgroundFailure('Failed to restore pinned tabs.')).finally(() => {
    schedulePersistPinnedTabSnapshot({ skipEmptyWhenNoNormalWindows: true });
  });
}

if (chrome && chrome.runtime && chrome.runtime.onStartup) {
  // Tabs restored at browser startup load with the manifest content scripts,
  // and each tab switcher command prepares its own tab, so startup does not
  // sweep the open tabs.
  chrome.runtime.onStartup.addListener(() => {
    restoreBackgroundStateOnStartup();
    void refreshGraphicsProbe();
  });
}
// Both loaders settle even when storage is unreadable; the catch only keeps
// an unforeseen rejection from surfacing as unhandled during startup.
ensureTabSwitchStatsLoaded().catch(() => {});
ensureTabSwitcherStateLoaded().catch(() => {});
// Chrome keeps a worker alive for its short debounce timers, but Firefox's
// event page can be unloaded with one pending; write it out first.
if (chrome && chrome.runtime && chrome.runtime.onSuspend) {
  chrome.runtime.onSuspend.addListener(() => {
    flushPendingPinnedTabSnapshot();
    flushPendingTabSwitcherState();
  });
}
LumnoSettingsMigration.runSettingsMigrations(chrome)
  .catch(warnBackgroundFailure('Failed to migrate this device\'s stored settings.'));

registerTabLifecycleEvents();

const selectionScriptRegistration = LumnoSelectionScriptRegistration
  .createSelectionScriptRegistration({ chromeApi: chrome });
// The page bridge is in every page the automatic picture-in-picture scripts
// run in, as it was when they injected it themselves.
LumnoPipPageBridgeRegistration
  .createPipPageBridgeRegistration({ chromeApi: chrome, manifest: chrome.runtime.getManifest() })
  .sync(true);
void workerSettings.ready.then(() => selectionScriptRegistration.sync(workerSettings.get(selectionQuickActionsEnabled)));
workerSettings.subscribe(selectionQuickActionsEnabled, () => {
  const enabled = workerSettings.get(selectionQuickActionsEnabled);
  selectionScriptRegistration.sync(enabled, { injectOpenTabs: enabled });
});

const shortcutFolderSyncController = chrome.bookmarks && typeof chrome.bookmarks.getTree === 'function'
  ? LumnoBookmarkFolderBindings.createSyncController({ chrome, provider: providerStorageRuntime, settingsStore: workerSettings,
    onError: (error) => console.warn('[Lumno] Could not refresh folder shortcuts.', error) }) : null;
if (shortcutFolderSyncController) shortcutFolderSyncController.start();
const webDavSyncController = typeof indexedDB !== 'undefined'
  ? WebDavManager.createController({ chrome }) : null;
if (webDavSyncController) webDavSyncController.start();

const handleWebDavMessage: BackgroundHandler<'webdav'> = (message, sender, sendResponse) => {
  // Content scripts and externally connected extensions cannot use stored
  // credentials, configure endpoints, or request arbitrary remote resources.
  if (!WebDavRecords.isTrustedSender(chrome, sender)) {
    sendResponse({ ok: false, error: 'forbidden' });
    return;
  }
  if (!webDavSyncController) {
    sendResponse({ ok: false, error: 'private-storage-unavailable' });
    return;
  }
  const request = WebDavRecords.readWebDavRequest(message);
  if (!request) {
    sendResponse({ ok: false, error: 'invalid-request' });
    return;
  }
  webDavSyncController.handle(request).then((result) => sendResponse({ ok: true, ...result }))
    .catch((error: unknown) => sendResponse(WebDavRecords.failureReply(error)));
  return true;
};

// The page context menu item that adds the page to the New Tab shortcuts.
if (pageShortcutMenuController) pageShortcutMenuController.start();
startReadLater();

// Link preview: Shift+click opens a link in a small window over the page.
const linkPreviewService = Service.createLinkPreviewService({ chromeApi: chrome, settingsStore: workerSettings });
linkPreviewService.attach();

// Firefox's website appearance setting, behind the /appearance command.
const webAppearance = LumnoWebAppearance.create();

// One action -> handler registry for runtime messages. Each feature area
// above owns its handlers; adding an action is one entry in its area's map,
// and the router rejects an action registered twice. Exported for the
// background tests that check which actions it accepts.
export const backgroundMessageRouter = BACKGROUND_MESSAGE_ROUTER.createRouter(
  { webdav: handleWebDavMessage },
  TAB_MESSAGE_HANDLERS,
  SHORTCUT_MESSAGE_HANDLERS,
  PIP_MESSAGE_HANDLERS,
  SEARCH_MESSAGE_HANDLERS,
  SITE_SEARCH_MESSAGE_HANDLERS,
  SELECTION_QUICK_ACTION_MESSAGE_HANDLERS,
  linkPreviewService.messageHandlers,
  webAppearance.messageHandlers,
  LOCALE_AND_PERMISSION_MESSAGE_HANDLERS,
  EXTENSION_PAGE_MESSAGE_HANDLERS,
  GRAPHICS_MESSAGE_HANDLERS,
  POPUP_MESSAGE_HANDLERS,
  FAVICON_MESSAGE_HANDLERS
);

// Actions the in-page surfaces (content scripts, the injected overlay, tab
// switcher, selection toolbar and picture-in-picture helpers) send. Those run
// inside web pages; every other action is accepted from extension pages only.
const WEB_PAGE_MESSAGE_ACTIONS = Object.freeze([
  'switchToTab', 'closeTabFromTabSwitcher', 'notifyOverlayClosed', 'notifyTopFrameDocumentStarted',
  'updateOverlayLoadingSession', 'getTabsForOverlay', 'closeOtherTabsForOverlay',
  'getShowSearchShortcut', 'copyCurrentPageUrl', 'triggerShowSearchFromPageHotkey',
  'getWebAppearance', 'setWebAppearance',
  'notifyTabSwitcherShortcutModifierReleased', 'getShortcutRules',
  'pipRequestOwnership', 'pipReleaseOwnership', 'openDocumentPipPicker', 'siteTryEnterPiPInMainWorld',
  'iqiyiTryEnterPiPInMainWorld', 'iqiyiSetupAutoPiPInMainWorld', 'forceExitPiPInMainWorld',
  'ytForceExitPiPInMainWorld',
  'searchOrNavigate', 'getSearchSuggestions', 'getSearchEngineSuggestions',
  'recordSearchSuggestionSelection', 'deleteHistoryUrl',
  'getSiteSearchProviders', 'getHelpCenterSearchResults', 'runSiteSearchProviderQuery',
  'runAggregateSearchQuery', 'runSelectionQuickAction',
  'linkPreviewPrepare', 'linkPreviewOpen', 'linkPreviewCancel', 'linkPreviewClose', 'linkPreviewOpenInTab',
  'linkPreviewFrameBind', 'linkPreviewFrameNavigating', 'linkPreviewFrameCommitted', 'linkPreviewFrameRefused',
  'getLocaleMessages', 'openOptionsPage', 'openReleasePage', 'createTab', 'openNewTab',
  'checkGraphicsRendering', 'openGraphicsSettings', 'getFaviconData'
]);

const backgroundMessageSenderPolicy = BACKGROUND_MESSAGE_ROUTER.createSenderPolicy({
  extensionBaseUrl: chrome.runtime.getURL(''),
  pageActions: WEB_PAGE_MESSAGE_ACTIONS,
  pageArgumentGuards: {
    // Typed, bookmarked and history targets stay openable; script, inline data
    // documents and other extensions' pages do not.
    createTab: (request) => LumnoUrlGuards.canOpenUrlFromWebPageContext(
      request.url,
      chrome.runtime.getURL('')
    ),
    linkPreviewPrepare: (request) => FrameRules.isPreviewableUrl(request.url),
    linkPreviewOpen: (request) => FrameRules.isPreviewableUrl(request.url),
    linkPreviewOpenInTab: (request) => FrameRules.isPreviewableUrl(request.url),
    linkPreviewFrameNavigating: (request) => FrameRules.isPreviewableUrl(request.url),
    setWebAppearance: (request) => Boolean(LumnoWebAppearance.normalizeMode(request.mode)),
    runSiteSearchProviderQuery: (request) => {
      const entryUrl = getSiteSearchProviderEntryUrl(readSiteSearchProvider(request.provider), request.query);
      return /^https?:\/\//i.test(entryUrl);
    }
  }
});

function dispatchBackgroundMessage(
  request: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (reply: unknown) => void
): boolean | void {
  return BACKGROUND_MESSAGE_ROUTER.dispatch(
    backgroundMessageRouter,
    request,
    sender,
    sendResponse,
    backgroundMessageSenderPolicy
  );
}

// Listen for extension runtime messages.
chrome.runtime.onMessage.addListener(dispatchBackgroundMessage);

providerStorageRuntime.ready.then(() => {
  migrateStorageIfNeeded([...LumnoSettings.BROWSER_SYNC_KEYS]);
});

getBackgroundFaviconCacheRuntime();

refreshDefaultSearchEngineState();

if (chrome && chrome.tabs) {
  chrome.tabs.onCreated.addListener((tab) => {
    if (!pendingSearchAt || !tab || typeof tab.id !== 'number') {
      return;
    }
    if (pendingSearchTabId !== null && tab.id !== pendingSearchTabId) {
      return;
    }
    if (Date.now() - pendingSearchAt > 5000) {
      clearPendingSearch();
      return;
    }
    setPendingSearchTabId(tab.id);
    moveTabToSourceGroupContext(tab, pendingSearchGroupContext, () => {});
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (!changeInfo || !changeInfo.url) {
      return;
    }
    if (!pendingSearchAt || (Date.now() - pendingSearchAt > 10000)) {
      clearPendingSearch();
      return;
    }
    if (pendingSearchTabId !== null && tabId !== pendingSearchTabId) {
      return;
    }
    const updated = updateDefaultSearchEngineFromUrl(changeInfo.url);
    if (updated) {
      clearPendingSearch();
    }
  });
}

warmSiteSearchProviderIcons();

// Site-search icons follow the icon chosen for a home-page shortcut. One
// shortcut save touches several keys, so they settle before the rewarm.
let siteSearchShortcutIconRewarmTimer: ReturnType<typeof setTimeout> | undefined;
workerSettings.subscribe(SITE_SEARCH_SHORTCUT_ICON_SETTINGS, () => {
  clearTimeout(siteSearchShortcutIconRewarmTimer);
  siteSearchShortcutIconRewarmTimer = setTimeout(() => {
    siteSearchShortcutIconRewarmTimer = undefined;
    warmSiteSearchProviderIcons();
  }, 300);
});

// Changed site searches get their icons.
workerSettings.subscribe([siteSearchCustom, siteSearchDisabled], () => warmSiteSearchProviderIcons());
