
try {
  importScripts(chrome.runtime.getURL('src/shared/blacklist-utils.js'));
} catch (error) {
  console.warn('Lumno: failed to load blacklist utils.', error);
}

try {
  importScripts(chrome.runtime.getURL('src/shared/url-guards.js'));
} catch (error) {
  console.warn('Lumno: failed to load URL guards.', error);
}

try {
  importScripts(chrome.runtime.getURL('src/shared/favicon-utils.js'));
} catch (error) {
  console.warn('Lumno: failed to load favicon utils.', error);
}

try {
  importScripts(chrome.runtime.getURL('src/shared/shortcut-favicon.js'));
} catch (error) {
  console.warn('Lumno: failed to load shortcut favicon helpers.', error);
}

try {
  importScripts(chrome.runtime.getURL('src/shared/favicon-cache.js'));
} catch (error) {
  console.warn('Lumno: failed to load favicon cache runtime.', error);
}

try {
  importScripts(chrome.runtime.getURL('src/newtab/favicon-theme.js'));
} catch (error) {
  console.warn('Lumno: failed to load newtab favicon theme helpers.', error);
}

try {
  importScripts(chrome.runtime.getURL('src/shared/extension-routes.js'));
} catch (error) {
  console.warn('Lumno: failed to load extension routes.', error);
}

try {
  importScripts(chrome.runtime.getURL('src/background/command-target-policy.js'));
} catch (error) {
  console.warn('Lumno: failed to load command target policy.', error);
}

try {
  importScripts(chrome.runtime.getURL('src/shared/settings.js'));
} catch (error) {
  console.warn('Lumno: failed to load settings utils.', error);
}

try {
  importScripts(chrome.runtime.getURL('src/shared/update-notice.js'));
} catch (error) {
  console.warn('Lumno: failed to load update notice utils.', error);
}

try {
  importScripts(chrome.runtime.getURL('src/shared/search-utils.js'));
} catch (error) {
  console.warn('Lumno: failed to load search utils.', error);
}

try {
  importScripts(chrome.runtime.getURL('src/shared/selection-intent.js'));
} catch (error) {
  console.warn('Lumno: failed to load selection intent helpers.', error);
}

try {
  importScripts(chrome.runtime.getURL('src/shared/site-search-store.js'));
} catch (error) {
  console.warn('Lumno: failed to load site search store.', error);
}

try {
  importScripts(chrome.runtime.getURL('src/background/ai-provider-submit.js'));
} catch (error) {
  console.warn('Lumno: failed to load AI provider submit runtime.', error);
}

try {
  importScripts(chrome.runtime.getURL('src/background/extension-pages.js'));
} catch (error) {
  console.warn('Lumno: failed to load extension page helpers.', error);
}

try {
  importScripts(chrome.runtime.getURL('src/background/tab-groups.js'));
} catch (error) {
  console.warn('Lumno: failed to load tab group helpers.', error);
}

try {
  importScripts(chrome.runtime.getURL('src/background/bookmark-tab-groups.js'));
} catch (error) {
  console.warn('Lumno: failed to load bookmark tab group helpers.', error);
}

try {
  importScripts(chrome.runtime.getURL('src/background/selection-target.js'));
} catch (error) {
  console.warn('Lumno: failed to load selection target helpers.', error);
}

try {
  importScripts(chrome.runtime.getURL('src/background/selection-quick-action-provider.js'));
} catch (error) {
  console.warn('Lumno: failed to load selection quick action provider helpers.', error);
}

try {
  importScripts(chrome.runtime.getURL('src/background/message-router.js'));
} catch (error) {
  console.warn('Lumno: failed to load background message router.', error);
}

try {
  importScripts(chrome.runtime.getURL('src/background/newtab-fallback.js'));
} catch (error) {
  console.warn('Lumno: failed to load newtab fallback helpers.', error);
}

try {
  importScripts(chrome.runtime.getURL('src/background/shortcut-rules.js'));
} catch (error) {
  console.warn('Lumno: failed to load shortcut rules helpers.', error);
}

try {
  importScripts(chrome.runtime.getURL('src/background/pip-ownership.js'));
} catch (error) {
  console.warn('Lumno: failed to load PiP ownership utils.', error);
}

try {
  importScripts(chrome.runtime.getURL('src/background/pip-main-world.js'));
} catch (error) {
  console.warn('Lumno: failed to load PiP main-world utils.', error);
}

try {
  importScripts(chrome.runtime.getURL('src/background/recent-tab-switcher.js'));
} catch (error) {
  console.warn('Lumno: failed to load recent tab switcher helpers.', error);
}

try {
  importScripts(chrome.runtime.getURL('src/background/overlay-loading-lifecycle.js'));
} catch (error) {
  console.warn('Lumno: failed to load Overlay loading lifecycle helpers.', error);
}

try {
  importScripts(chrome.runtime.getURL('src/background/dev-extension-startup.js'));
} catch (error) {
  console.warn('Lumno: failed to load development startup helpers.', error);
}

try {
  importScripts(chrome.runtime.getURL('src/background/codex-debug-bridge.js'));
} catch (error) {
  console.warn('Lumno: failed to load Codex debug bridge helpers.', error);
}

try {
  importScripts(chrome.runtime.getURL('assets/vendor/pinyin-pro.js'));
} catch (error) {
  console.warn('Lumno: failed to load pinyin support.', error);
}

const BACKGROUND_PAGES = globalThis.LumnoBackgroundPages || {};
const getExtensionDetailsUrl = BACKGROUND_PAGES.getExtensionDetailsUrl;
const openExtensionOptionsPage = BACKGROUND_PAGES.openExtensionOptionsPage;
const openOnboardingPage = BACKGROUND_PAGES.openOnboardingPage;
const shouldOpenOnboardingForUpdate = BACKGROUND_PAGES.shouldOpenOnboardingForUpdate;
const openReleasePage = BACKGROUND_PAGES.openReleasePage;
const openBookmarkManagerPage = BACKGROUND_PAGES.openBookmarkManagerPage;
const openExtensionShortcutsPage = BACKGROUND_PAGES.openExtensionShortcutsPage;
const openSiteSearchOptionsPage = BACKGROUND_PAGES.openSiteSearchOptionsPage;
const BACKGROUND_MESSAGE_ROUTER = globalThis.LumnoBackgroundMessageRouter || {};
const BOOKMARK_TAB_GROUPS = globalThis.LumnoBookmarkTabGroups || {};
const EXTENSION_ROUTES = globalThis.LumnoExtensionRoutes || {};
const UPDATE_NOTICE = globalThis.LumnoUpdateNotice || {};
const COMMAND_TARGET_POLICY = globalThis.LumnoCommandTargetPolicy || {};
const FAVICON_UTILS = globalThis.LumnoFaviconUtils || {};
const FAVICON_CACHE = globalThis.LumnoFaviconCache || {};
const SHORTCUT_FAVICON = globalThis.LumnoShortcutFavicon || {};
const NEWTAB_FAVICON_THEME = globalThis.LumnoNewtabFaviconTheme || {};
const BACKGROUND_NEWTAB_FALLBACK = globalThis.LumnoBackgroundNewtabFallback || {};
const BACKGROUND_TAB_GROUPS = globalThis.LumnoBackgroundTabGroups || {};
const isLocalFileLikeTargetUrl = BACKGROUND_NEWTAB_FALLBACK.isLocalFileLikeTargetUrl;
const checkFileSchemeAccess = BACKGROUND_NEWTAB_FALLBACK.checkFileSchemeAccess;
const openBrowserNewtabFallback = BACKGROUND_NEWTAB_FALLBACK.openBrowserNewtabFallback;
const openNewtabFallback = BACKGROUND_NEWTAB_FALLBACK.openNewtabFallback;
const openNewtabFallbackForUrl = BACKGROUND_NEWTAB_FALLBACK.openNewtabFallbackForUrl;
const BACKGROUND_SHORTCUT_RULES = globalThis.LumnoShortcutRules || {};
const RECENT_TAB_SWITCHER = globalThis.LumnoRecentTabSwitcher || {};
const OVERLAY_LOADING_LIFECYCLE = globalThis.LumnoOverlayLoadingLifecycle || {};
const DEV_EXTENSION_STARTUP = globalThis.LumnoDevExtensionStartup || {};
const CODEX_DEBUG_BRIDGE = globalThis.LumnoCodexDebugBackground || {};
const codexDebugBridge = CODEX_DEBUG_BRIDGE && typeof CODEX_DEBUG_BRIDGE.create === 'function'
  ? CODEX_DEBUG_BRIDGE.create({ chromeApi: chrome })
  : null;
const shortcutRules = BACKGROUND_SHORTCUT_RULES && typeof BACKGROUND_SHORTCUT_RULES.create === 'function'
  ? BACKGROUND_SHORTCUT_RULES.create({
    chromeApi: chrome,
    fetchImpl: fetch,
    navigatorLike: navigator
  })
  : null;
const loadShortcutRules = shortcutRules && typeof shortcutRules.loadShortcutRules === 'function'
  ? shortcutRules.loadShortcutRules
  : () => Promise.resolve([]);
const getShortcutUrl = shortcutRules && typeof shortcutRules.getShortcutUrl === 'function'
  ? shortcutRules.getShortcutUrl
  : () => null;

function isBrowserExtensionProtocol(protocol) {
  const guards = globalThis.LumnoUrlGuards || {};
  if (typeof guards.isBrowserExtensionProtocol === 'function') {
    return guards.isBrowserExtensionProtocol(protocol);
  }
  const normalized = String(protocol || '').toLowerCase();
  return normalized === 'chrome-extension:' ||
    normalized === 'moz-extension:' ||
    normalized === 'ms-browser-extension:';
}

function isBrowserInternalUrl(url) {
  const guards = globalThis.LumnoUrlGuards || {};
  if (typeof guards.isBrowserInternalUrl === 'function') {
    return guards.isBrowserInternalUrl(url);
  }
  const lower = String(url || '').toLowerCase();
  return lower.startsWith('chrome://') ||
    lower.startsWith('edge://') ||
    lower.startsWith('brave://') ||
    lower.startsWith('vivaldi://') ||
    lower.startsWith('opera://') ||
    lower.startsWith('about:');
}

function isRestrictedUrl(url) {
  const guards = globalThis.LumnoUrlGuards || {};
  if (typeof guards.isRestrictedUrl === 'function') {
    return guards.isRestrictedUrl(url);
  }
  if (!url) {
    return true;
  }
  const lower = String(url).toLowerCase();
  if (lower.startsWith('chrome://') ||
    lower.startsWith('edge://') ||
    lower.startsWith('brave://') ||
    lower.startsWith('vivaldi://') ||
    lower.startsWith('opera://') ||
    lower.startsWith('about:')) {
    return true;
  }
  try {
    const parsed = new URL(url);
    const protocol = String(parsed.protocol || '').toLowerCase();
    if (isBrowserExtensionProtocol(protocol)) {
      return true;
    }
    if (protocol !== 'http:' && protocol !== 'https:') {
      return true;
    }
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    if ((host === 'chrome.google.com' && path.startsWith('/webstore')) ||
        host === 'chromewebstore.google.com' ||
        (host === 'microsoftedge.microsoft.com' && path.startsWith('/addons')) ||
        host === 'addons.opera.com') {
      return true;
    }
  } catch (e) {
    return true;
  }
  return false;
}

function canOpenOverlayOnUrl(url) {
  const guards = globalThis.LumnoUrlGuards || {};
  if (typeof guards.canOpenOverlayOnUrl === 'function') {
    return guards.canOpenOverlayOnUrl(url);
  }
  if (!url) {
    return false;
  }
  const lower = String(url).toLowerCase();
  if (lower.startsWith('chrome://') ||
    lower.startsWith('edge://') ||
    lower.startsWith('brave://') ||
    lower.startsWith('vivaldi://') ||
    lower.startsWith('opera://') ||
    lower.startsWith('about:')) {
    return false;
  }
  try {
    const parsed = new URL(url);
    const protocol = String(parsed.protocol || '').toLowerCase();
    if (isBrowserExtensionProtocol(protocol)) {
      return false;
    }
    if (protocol === 'file:') {
      return true;
    }
    if (protocol !== 'http:' && protocol !== 'https:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    if ((host === 'chrome.google.com' && path.startsWith('/webstore')) ||
        host === 'chromewebstore.google.com' ||
        (host === 'microsoftedge.microsoft.com' && path.startsWith('/addons')) ||
        host === 'addons.opera.com') {
      return false;
    }
  } catch (e) {
    return false;
  }
  return true;
}

function canFetchPageForFavicon(url) {
  const guards = globalThis.LumnoUrlGuards || {};
  if (typeof guards.canFetchPageForFavicon === 'function') {
    return guards.canFetchPageForFavicon(url);
  }
  return !isRestrictedUrl(url);
}

function isOwnExtensionPageUrl(url) {
  if (!url || !chrome || !chrome.runtime || !chrome.runtime.id) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'chrome-extension:' && parsed.hostname === chrome.runtime.id;
  } catch (error) {
    return false;
  }
}

function getResolvedTabUrl(tab) {
  if (!tab || typeof tab !== 'object') {
    return '';
  }
  const directUrl = typeof tab.url === 'string' ? String(tab.url).trim() : '';
  if (directUrl) {
    return directUrl;
  }
  const pendingUrl = typeof tab.pendingUrl === 'string' ? String(tab.pendingUrl).trim() : '';
  return pendingUrl;
}

function getSourceTabGroupContext(tab) {
  if (BACKGROUND_TAB_GROUPS && typeof BACKGROUND_TAB_GROUPS.getSourceTabGroupContext === 'function') {
    return BACKGROUND_TAB_GROUPS.getSourceTabGroupContext(tab, chrome);
  }
  return null;
}

function createTabWithSourceGroup(createProperties, sourceTab, callback) {
  const done = typeof callback === 'function' ? callback : () => {};
  if (BACKGROUND_TAB_GROUPS && typeof BACKGROUND_TAB_GROUPS.createTabInSourceGroup === 'function') {
    BACKGROUND_TAB_GROUPS.createTabInSourceGroup(chrome, createProperties, sourceTab, done);
    return;
  }
  if (!chrome || !chrome.tabs || typeof chrome.tabs.create !== 'function') {
    done(null, { ok: false, reason: 'tabs-api-unavailable', grouped: false });
    return;
  }
  chrome.tabs.create(createProperties || {}, (tab) => {
    const error = chrome.runtime && chrome.runtime.lastError
      ? chrome.runtime.lastError.message || 'tab-create-failed'
      : '';
    done(tab || null, {
      ok: !error,
      reason: error,
      grouped: false
    });
  });
}

function moveTabToSourceGroupContext(tab, sourceContext, callback, createProperties) {
  if (BACKGROUND_TAB_GROUPS && typeof BACKGROUND_TAB_GROUPS.moveTabToSourceGroupContext === 'function') {
    BACKGROUND_TAB_GROUPS.moveTabToSourceGroupContext(chrome, tab, sourceContext, callback, createProperties);
    return;
  }
  if (typeof callback === 'function') {
    callback(false, '');
  }
}

function hasTabSwitcherExtensionPagePort(tab) {
  if (!tab || typeof tab.id !== 'number') {
    return false;
  }
  const record = tabSwitcherExtensionPagePortsByTabId.get(tab.id);
  return Boolean(record && record.port && typeof record.port.postMessage === 'function');
}

function isTabSwitcherExtensionPageMessageTarget(tab) {
  if (!tab || typeof tab.id !== 'number') {
    return false;
  }
  const url = getResolvedTabUrl(tab);
  if (isOwnExtensionPageUrl(url)) {
    return true;
  }
  return isBrowserNewtabUrl(url) && hasTabSwitcherExtensionPagePort(tab);
}

function shouldTrackSwitcherTab(tab) {
  if (!tab || typeof tab.id !== 'number' || typeof tab.windowId !== 'number' || tab.incognito === true) {
    return false;
  }
  const url = getResolvedTabUrl(tab);
  if (!url) {
    return false;
  }
  if (isBrowserInternalUrl(url)) {
    return true;
  }
  try {
    const parsed = new URL(url);
    const protocol = String(parsed.protocol || '').toLowerCase();
    return Boolean(protocol) && protocol !== 'javascript:';
  } catch (error) {
    return false;
  }
}

function canHostSwitcherSurface(tab) {
  if (!tab || typeof tab.id !== 'number' || typeof tab.windowId !== 'number') {
    return false;
  }
  const url = getResolvedTabUrl(tab);
  return isOwnExtensionPageUrl(url) ||
    (isBrowserNewtabUrl(url) && hasTabSwitcherExtensionPagePort(tab)) ||
    canOpenOverlayOnUrl(url);
}

function isTabSwitcherEligibleTab(tab) {
  return canHostSwitcherSurface(tab);
}

function getPortSenderTabId(port) {
  const senderTab = port && port.sender && port.sender.tab ? port.sender.tab : null;
  return senderTab && typeof senderTab.id === 'number' ? senderTab.id : null;
}

function getPortMessageTabId(port, message) {
  if (message && typeof message.tabId === 'number') {
    return message.tabId;
  }
  return getPortSenderTabId(port);
}

function clearTabSwitcherExtensionPagePending(record, ok, reason) {
  if (!record || !record.pending || typeof record.pending.forEach !== 'function') {
    return;
  }
  record.pending.forEach((pending) => {
    if (!pending) {
      return;
    }
    if (pending.timer) {
      clearTimeout(pending.timer);
    }
    if (typeof pending.callback === 'function') {
      pending.callback(Boolean(ok), reason || '');
    }
  });
  record.pending.clear();
}

function deleteTabSwitcherExtensionPagePort(tabId, port) {
  if (typeof tabId !== 'number') {
    return;
  }
  const record = tabSwitcherExtensionPagePortsByTabId.get(tabId);
  if (!record || (port && record.port !== port)) {
    return;
  }
  clearTabSwitcherExtensionPagePending(record, false, 'disconnected');
  tabSwitcherExtensionPagePortsByTabId.delete(tabId);
}

function registerTabSwitcherExtensionPagePort(port, message) {
  const tabId = getPortMessageTabId(port, message);
  if (typeof tabId !== 'number') {
    return null;
  }
  const previous = tabSwitcherExtensionPagePortsByTabId.get(tabId);
  if (previous && previous.port !== port) {
    clearTabSwitcherExtensionPagePending(previous, false, 'replaced');
  }
  const record = previous && previous.port === port
    ? previous
    : {
      port,
      tabId,
      pending: new Map()
    };
  record.url = message && typeof message.url === 'string' ? message.url : (record.url || '');
  record.title = message && typeof message.title === 'string' ? message.title : (record.title || '');
  tabSwitcherExtensionPagePortsByTabId.set(tabId, record);
  return record;
}

function handleTabSwitcherExtensionPagePortMessage(port, message) {
  if (!message || typeof message !== 'object') {
    return;
  }
  if (message.action === 'registerTabSwitcherExtensionPage') {
    registerTabSwitcherExtensionPagePort(port, message);
    return;
  }
  if (message.action !== 'tabSwitcherExtensionPageResponse') {
    return;
  }
  const tabId = getPortMessageTabId(port, message);
  if (typeof tabId !== 'number' || typeof message.requestId !== 'number') {
    return;
  }
  const record = tabSwitcherExtensionPagePortsByTabId.get(tabId);
  if (!record || record.port !== port || !record.pending) {
    return;
  }
  const pending = record.pending.get(message.requestId);
  if (!pending) {
    return;
  }
  record.pending.delete(message.requestId);
  if (pending.timer) {
    clearTimeout(pending.timer);
  }
  if (typeof pending.callback === 'function') {
    pending.callback(Boolean(message.ok), message.reason || '', message);
  }
}

function registerTabSwitcherExtensionPagePortConnection(port) {
  if (!port || port.name !== TAB_SWITCHER_EXTENSION_PAGE_PORT_NAME) {
    return;
  }
  registerTabSwitcherExtensionPagePort(port, {
    action: 'registerTabSwitcherExtensionPage',
    tabId: getPortSenderTabId(port),
    url: port.sender && typeof port.sender.url === 'string' ? port.sender.url : '',
    title: ''
  });
  port.onMessage.addListener((message) => {
    handleTabSwitcherExtensionPagePortMessage(port, message);
  });
  port.onDisconnect.addListener(() => {
    deleteTabSwitcherExtensionPagePort(getPortSenderTabId(port), port);
    Array.from(tabSwitcherExtensionPagePortsByTabId.entries()).forEach(([tabId, record]) => {
      if (record && record.port === port) {
        deleteTabSwitcherExtensionPagePort(tabId, port);
      }
    });
  });
}

function postTabSwitcherMessageToExtensionPage(tab, message, callback) {
  if (!tab || typeof tab.id !== 'number' || !isTabSwitcherExtensionPageMessageTarget(tab)) {
    if (typeof callback === 'function') {
      callback(false, 'not-extension-page');
    }
    return false;
  }
  const startedAt = Date.now();
  const attemptPost = () => {
    const record = tabSwitcherExtensionPagePortsByTabId.get(tab.id);
    if (!record || !record.port || typeof record.port.postMessage !== 'function') {
      if (Date.now() - startedAt < TAB_SWITCHER_EXTENSION_PAGE_PORT_WAIT_MS) {
        setTimeout(attemptPost, TAB_SWITCHER_EXTENSION_PAGE_PORT_RETRY_MS);
        return true;
      }
      if (typeof callback === 'function') {
        callback(false, 'extension-page-port-missing');
      }
      return false;
    }
    const requestId = ++tabSwitcherExtensionPageRequestSeq;
    const payload = {
      ...(message && typeof message === 'object' ? message : {}),
      requestId
    };
    const timer = setTimeout(() => {
      if (!record.pending || !record.pending.has(requestId)) {
        return;
      }
      record.pending.delete(requestId);
      if (typeof callback === 'function') {
        callback(false, 'extension-page-timeout');
      }
    }, 1000);
    record.pending.set(requestId, {
      callback,
      timer
    });
    try {
      record.port.postMessage(payload);
      return true;
    } catch (error) {
      clearTimeout(timer);
      record.pending.delete(requestId);
      if (typeof callback === 'function') {
        callback(false, error && error.message ? error.message : 'extension-page-post-failed');
      }
      return false;
    }
  };
  return attemptPost();
}

function setTabSwitcherCaptureVisibilityInPage(hidden, hostId) {
  const host = document.getElementById(hostId);
  if (!host) {
    return { ok: true, reason: 'tab_switcher_host_missing' };
  }
  const markerKey = 'lumnoCaptureVisibilityHidden';
  const valueKey = 'lumnoCapturePreviousVisibility';
  const priorityKey = 'lumnoCapturePreviousVisibilityPriority';
  const hadValueKey = 'lumnoCaptureHadVisibility';
  if (hidden) {
    if (host.dataset[markerKey] !== 'true') {
      const previousValue = host.style.getPropertyValue('visibility');
      host.dataset[markerKey] = 'true';
      host.dataset[valueKey] = previousValue || '';
      host.dataset[priorityKey] = host.style.getPropertyPriority('visibility') || '';
      host.dataset[hadValueKey] = previousValue ? 'true' : 'false';
    }
    host.style.setProperty('visibility', 'hidden', 'important');
    return { ok: true };
  }
  if (host.dataset[markerKey] === 'true') {
    if (host.dataset[hadValueKey] === 'true') {
      host.style.setProperty(
        'visibility',
        host.dataset[valueKey] || '',
        host.dataset[priorityKey] || ''
      );
    } else {
      host.style.removeProperty('visibility');
    }
    delete host.dataset[markerKey];
    delete host.dataset[valueKey];
    delete host.dataset[priorityKey];
    delete host.dataset[hadValueKey];
  }
  return { ok: true };
}

function getOpenTabSwitcherStateInPage(hostId) {
  const host = document.getElementById(hostId);
  return {
    ok: true,
    open: Boolean(host)
  };
}

function updateTabSwitcherThumbnailInPage(update, hostId) {
  const host = document.getElementById(hostId);
  if (!host || typeof host._lumnoTabSwitcherUpdateThumbnail !== 'function') {
    return { ok: false, reason: 'tab_switcher_host_missing' };
  }
  return host._lumnoTabSwitcherUpdateThumbnail(update) || { ok: true };
}

function commitOpenTabSwitcherFromShortcutReleaseInPage(hostId) {
  const host = document.getElementById(hostId);
  if (!host || typeof host._lumnoTabSwitcherCommitFromShortcutRelease !== 'function') {
    return { ok: false, committed: false };
  }
  return {
    ok: true,
    committed: host._lumnoTabSwitcherCommitFromShortcutRelease() === true
  };
}

function getFailedOpenTabSwitcherState() {
  return { ok: false, open: false };
}

function normalizeTabSwitcherHostOkResponse(response) {
  return response && response.ok === true ? true : null;
}

function normalizeTabSwitcherCommitResponse(response) {
  if (!response || response.ok !== true || typeof response.committed !== 'boolean') {
    return null;
  }
  return response.committed === true;
}

function normalizeOpenTabSwitcherStateResponse(response) {
  if (!response || response.ok !== true || typeof response.open !== 'boolean') {
    return null;
  }
  return {
    ok: true,
    open: response.open === true
  };
}

function normalizeTabSwitcherHostOkScriptResults(results) {
  return Array.isArray(results) &&
    results.some((item) => item && item.result && item.result.ok === true)
    ? true
    : null;
}

function normalizeTabSwitcherCommitScriptResults(results) {
  const result = Array.isArray(results)
    ? results.find((item) => (
      item &&
      item.result &&
      item.result.ok === true &&
      typeof item.result.committed === 'boolean'
    ))
    : null;
  return result && result.result ? result.result.committed === true : null;
}

function normalizeOpenTabSwitcherStateScriptResults(results) {
  const result = Array.isArray(results)
    ? results.find((item) => (
      item &&
      item.result &&
      item.result.ok === true &&
      typeof item.result.open === 'boolean'
    ))
    : null;
  return result && result.result
    ? {
      ok: true,
      open: result.result.open === true
    }
    : null;
}

function runTabSwitcherHostScript(tabId, scriptFunc, scriptArgs, normalizeResults, fallbackValue) {
  if (typeof tabId !== 'number' ||
      !chrome ||
      !chrome.scripting ||
      typeof chrome.scripting.executeScript !== 'function' ||
      typeof scriptFunc !== 'function') {
    return Promise.resolve(fallbackValue);
  }
  const normalize = typeof normalizeResults === 'function'
    ? normalizeResults
    : normalizeTabSwitcherHostOkScriptResults;
  return new Promise((resolve) => {
    try {
      chrome.scripting.executeScript({
        target: { tabId },
        func: scriptFunc,
        args: Array.isArray(scriptArgs) ? scriptArgs : []
      }, (results) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          resolve(fallbackValue);
          return;
        }
        const normalized = normalize(results);
        resolve(normalized === null ? fallbackValue : normalized);
      });
    } catch (error) {
      resolve(fallbackValue);
    }
  });
}

function sendTabSwitcherHostMessage(tab, payload, optionsArg) {
  const tabId = tab && typeof tab.id === 'number' ? tab.id : null;
  const options = optionsArg && typeof optionsArg === 'object' ? optionsArg : {};
  const fallbackValue = Object.prototype.hasOwnProperty.call(options, 'fallbackValue')
    ? options.fallbackValue
    : false;
  if (typeof tabId !== 'number' || !payload || typeof payload !== 'object') {
    return Promise.resolve(fallbackValue);
  }
  const normalizeResponse = typeof options.normalizeResponse === 'function'
    ? options.normalizeResponse
    : normalizeTabSwitcherHostOkResponse;
  const runScriptFallback = () => runTabSwitcherHostScript(
    tabId,
    options.scriptFunc,
    options.scriptArgs,
    options.normalizeScriptResults,
    fallbackValue
  );
  if (isTabSwitcherExtensionPageMessageTarget(tab)) {
    return new Promise((resolve) => {
      postTabSwitcherMessageToExtensionPage(tab, payload, (ok, _reason, response) => {
        if (ok) {
          const normalized = normalizeResponse(response || { ok: true });
          if (normalized !== null) {
            resolve(normalized);
            return;
          }
        }
        runScriptFallback().then(resolve).catch(() => resolve(fallbackValue));
      });
    });
  }
  if (!chrome || !chrome.tabs || typeof chrome.tabs.sendMessage !== 'function') {
    return runScriptFallback();
  }
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, payload, (response) => {
        if (!(chrome.runtime && chrome.runtime.lastError)) {
          const normalized = normalizeResponse(response);
          if (normalized !== null) {
            resolve(normalized);
            return;
          }
        }
        runScriptFallback().then(resolve).catch(() => resolve(fallbackValue));
      });
    } catch (error) {
      runScriptFallback().then(resolve).catch(() => resolve(fallbackValue));
    }
  });
}

function setTabSwitcherCaptureVisibility(tab, hidden) {
  const payload = {
    action: 'setTabSwitcherCaptureVisibility',
    hidden: Boolean(hidden)
  };
  return sendTabSwitcherHostMessage(tab, payload, {
    scriptFunc: setTabSwitcherCaptureVisibilityInPage,
    scriptArgs: [Boolean(hidden), TAB_SWITCHER_HOST_ID],
    fallbackValue: false
  });
}

function getOpenTabSwitcherState(tab) {
  const payload = {
    action: 'getOpenTabSwitcherState'
  };
  return sendTabSwitcherHostMessage(tab, payload, {
    scriptFunc: getOpenTabSwitcherStateInPage,
    scriptArgs: [TAB_SWITCHER_HOST_ID],
    normalizeResponse: normalizeOpenTabSwitcherStateResponse,
    normalizeScriptResults: normalizeOpenTabSwitcherStateScriptResults,
    fallbackValue: getFailedOpenTabSwitcherState()
  });
}

function postTabSwitcherThumbnailUpdate(tab, update) {
  if (!update || typeof update !== 'object') {
    return Promise.resolve(false);
  }
  const payload = {
    action: 'updateTabSwitcherThumbnail',
    ...update
  };
  return sendTabSwitcherHostMessage(tab, payload, {
    scriptFunc: updateTabSwitcherThumbnailInPage,
    scriptArgs: [payload, TAB_SWITCHER_HOST_ID],
    fallbackValue: false
  });
}

function commitOpenTabSwitcherFromShortcutReleaseOnTab(tab) {
  return sendTabSwitcherHostMessage(tab, {
    action: 'commitOpenTabSwitcherFromShortcutRelease'
  }, {
    scriptFunc: commitOpenTabSwitcherFromShortcutReleaseInPage,
    scriptArgs: [TAB_SWITCHER_HOST_ID],
    normalizeResponse: normalizeTabSwitcherCommitResponse,
    normalizeScriptResults: normalizeTabSwitcherCommitScriptResults,
    fallbackValue: false
  });
}

function prepareTabSwitcherShortcutReleaseObserver(tab) {
  if (!tab || typeof tab.id !== 'number') {
    return Promise.resolve(false);
  }
  if (isTabSwitcherExtensionPageMessageTarget(tab)) {
    return Promise.resolve(true);
  }
  if (!chrome || !chrome.scripting || typeof chrome.scripting.executeScript !== 'function') {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    try {
      chrome.scripting.executeScript({
        target: {
          tabId: tab.id,
          allFrames: true
        },
        files: ['src/content/tab-switcher-shortcut-release.js']
      }, () => {
        const error = chrome.runtime && chrome.runtime.lastError
          ? chrome.runtime.lastError.message || 'unknown'
          : '';
        recordTabSwitcherShortcutDebug(
          error ? 'release-observer-injection-failed' : 'release-observer-ready',
          {
            tabId: tab.id,
            windowId: typeof tab.windowId === 'number' ? tab.windowId : null,
            error
          }
        );
        resolve(!error);
      });
    } catch (error) {
      recordTabSwitcherShortcutDebug('release-observer-injection-failed', {
        tabId: tab.id,
        windowId: typeof tab.windowId === 'number' ? tab.windowId : null,
        error: error && error.message ? error.message : String(error || 'unknown')
      });
      resolve(false);
    }
  });
}

function prepareTabSwitcherShortcutReleaseObserversInOpenTabs() {
  if (!chrome || !chrome.tabs || typeof chrome.tabs.query !== 'function') {
    return;
  }
  chrome.tabs.query({}, (tabs) => {
    if (chrome.runtime && chrome.runtime.lastError) {
      return;
    }
    (Array.isArray(tabs) ? tabs : []).forEach((tab) => {
      prepareTabSwitcherShortcutReleaseObserver(tab);
    });
  });
}

function findOpenTabSwitcherHostInWindow(windowId) {
  if (typeof windowId !== 'number' || !chrome || !chrome.tabs || typeof chrome.tabs.query !== 'function') {
    return Promise.resolve(null);
  }
  const readStateWithTimeout = (tab) => new Promise((resolve) => {
    let settled = false;
    const finish = (open) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve({ tab, open: open === true });
    };
    const timer = setTimeout(() => finish(false), TAB_SWITCHER_HOST_STATE_TIMEOUT_MS);
    getOpenTabSwitcherState(tab)
      .then((state) => finish(Boolean(state && state.open === true)))
      .catch(() => finish(false));
  });
  return new Promise((resolve) => {
    chrome.tabs.query({ windowId }, (tabs) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      const knownHostTabId = tabSwitcherHostTabIdByWindowId.get(windowId);
      const candidates = (Array.isArray(tabs) ? tabs : [])
        .filter((tab) => tab && typeof tab.id === 'number' && canHostSwitcherSurface(tab))
        .sort((left, right) => {
          const leftPriority = left.id === knownHostTabId ? 2 : Number(left.active === true);
          const rightPriority = right.id === knownHostTabId ? 2 : Number(right.active === true);
          return rightPriority - leftPriority;
        });
      Promise.all(candidates.map(readStateWithTimeout)).then((states) => {
        const openHost = states.find((state) => state.open === true);
        resolve(openHost ? openHost.tab : null);
      }).catch(() => resolve(null));
    });
  });
}

function getTabForTabSwitcherCommit(tabId) {
  if (typeof tabId !== 'number' || !chrome || !chrome.tabs || typeof chrome.tabs.get !== 'function') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(tab && typeof tab.id === 'number' ? tab : null);
    });
  });
}

function commitOpenTabSwitcherInWindow(windowId, source) {
  recordTabSwitcherShortcutDebug('commit-search-start', {
    windowId,
    source: String(source || '')
  });
  const finishCommit = (hostTab, path) => {
    recordTabSwitcherShortcutDebug('commit-host-resolved', {
      windowId,
      source: String(source || ''),
      hostTabId: hostTab && typeof hostTab.id === 'number' ? hostTab.id : null,
      path
    });
    if (!hostTab) {
      return false;
    }
    return commitOpenTabSwitcherFromShortcutReleaseOnTab(hostTab).then((didCommit) => {
      recordTabSwitcherShortcutDebug('commit-finished', {
        windowId,
        source: String(source || ''),
        hostTabId: hostTab.id,
        committed: didCommit === true
      });
      if (didCommit === true && tabSwitcherHostTabIdByWindowId.get(windowId) === hostTab.id) {
        tabSwitcherHostTabIdByWindowId.delete(windowId);
      }
      return didCommit === true;
    });
  };
  const findAndCommit = () => findOpenTabSwitcherHostInWindow(windowId)
    .then((hostTab) => finishCommit(hostTab, 'window-scan'));
  const knownHostTabId = tabSwitcherHostTabIdByWindowId.get(windowId);
  if (typeof knownHostTabId !== 'number') {
    return findAndCommit().catch(() => false);
  }
  return getTabForTabSwitcherCommit(knownHostTabId)
    .then((hostTab) => finishCommit(hostTab, 'known-host'))
    .then((didCommit) => {
      if (didCommit === true) {
        return true;
      }
      if (tabSwitcherHostTabIdByWindowId.get(windowId) === knownHostTabId) {
        tabSwitcherHostTabIdByWindowId.delete(windowId);
      }
      return findAndCommit();
    })
    .catch(() => findAndCommit().catch(() => false));
}

function handleTabSwitcherShortcutModifierReleased(senderTab, releasedKey, callback) {
  const finish = typeof callback === 'function' ? callback : () => {};
  if (!senderTab || typeof senderTab.windowId !== 'number') {
    finish(false);
    return;
  }
  const key = String(releasedKey || '');
  getConfiguredTabSwitcherShortcut((shortcut) => {
    const expectedKeys = typeof RECENT_TAB_SWITCHER.getShortcutReleaseEventKeys === 'function'
      ? RECENT_TAB_SWITCHER.getShortcutReleaseEventKeys(shortcut)
      : [];
    if (!expectedKeys.includes(key)) {
      recordTabSwitcherShortcutDebug('release-rejected', {
        windowId: senderTab.windowId,
        key,
        shortcut,
        expectedKeys
      });
      finish(false);
      return;
    }
    recordTabSwitcherShortcutDebug('release-accepted', {
      windowId: senderTab.windowId,
      key,
      shortcut,
      expectedKeys
    });
    commitOpenTabSwitcherInWindow(senderTab.windowId, 'keyup')
      .then((didCommit) => finish(didCommit === true))
      .catch(() => finish(false));
  });
}

function armTabSwitcherShortcutReleaseObservers(tabs, windowId, shortcut, commandStartedAt) {
  if (typeof windowId !== 'number') {
    return;
  }
  const keys = typeof RECENT_TAB_SWITCHER.getShortcutReleaseEventKeys === 'function'
    ? RECENT_TAB_SWITCHER.getShortcutReleaseEventKeys(shortcut)
    : [];
  if (!keys.length) {
    return;
  }
  const message = {
    action: 'armTabSwitcherShortcutRelease',
    keys,
    commandStartedAt: Number(commandStartedAt) || 0
  };
  (Array.isArray(tabs) ? tabs : []).forEach((item) => {
    if (!item || typeof item.id !== 'number' || item.windowId !== windowId) {
      return;
    }
    if (isTabSwitcherExtensionPageMessageTarget(item)) {
      postTabSwitcherMessageToExtensionPage(item, message, () => {});
      return;
    }
    if (!chrome || !chrome.tabs || typeof chrome.tabs.sendMessage !== 'function') {
      return;
    }
    try {
      chrome.tabs.sendMessage(item.id, message, () => {
        void (chrome.runtime && chrome.runtime.lastError);
      });
    } catch (error) {
      // Restricted tabs simply cannot participate in the release relay.
    }
  });
}

function waitForTabSwitcherCapturePaint() {
  return new Promise((resolve) => {
    setTimeout(resolve, TAB_SWITCHER_CAPTURE_HIDE_PAINT_WAIT_MS);
  });
}

function withTabSwitcherHiddenForCapture(tab, capture) {
  const runCapture = typeof capture === 'function' ? capture : () => Promise.resolve(false);
  return setTabSwitcherCaptureVisibility(tab, true)
    .catch(() => false)
    .then(() => waitForTabSwitcherCapturePaint())
    .then(() => runCapture())
    .finally(() => setTabSwitcherCaptureVisibility(tab, false));
}

const pipOwnership = globalThis.LumnoPipOwnership && typeof globalThis.LumnoPipOwnership.create === 'function'
  ? globalThis.LumnoPipOwnership.create({
    chromeApi: chrome,
    getResolvedTabUrl: getResolvedTabUrl
  })
  : null;

const pipMainWorld = globalThis.LumnoPipMainWorld && typeof globalThis.LumnoPipMainWorld.create === 'function'
  ? globalThis.LumnoPipMainWorld.create({
    chromeApi: chrome
  })
  : null;

async function requestGlobalPipOwnership(sender, kind) {
  if (!pipOwnership || typeof pipOwnership.requestGlobalPipOwnership !== 'function') {
    return { ok: false, granted: false, reason: 'pip-ownership-unavailable' };
  }
  return pipOwnership.requestGlobalPipOwnership(sender, kind);
}

async function releaseGlobalPipOwnership(sender, token) {
  if (!pipOwnership || typeof pipOwnership.releaseGlobalPipOwnership !== 'function') {
    return { ok: false, released: false, reason: 'pip-ownership-unavailable' };
  }
  return pipOwnership.releaseGlobalPipOwnership(sender, token);
}

function clearGlobalPipOwnerForTabId(tabId) {
  if (!pipOwnership || typeof pipOwnership.clearGlobalPipOwnerForTabId !== 'function') {
    return;
  }
  pipOwnership.clearGlobalPipOwnerForTabId(tabId);
}

function isLumnoNewtabUrl(url) {
  const value = String(url || '');
  if (!value || !chrome || !chrome.runtime || typeof chrome.runtime.getURL !== 'function') {
    return false;
  }
  const routeType = typeof EXTENSION_ROUTES.classifyExtensionUrl === 'function'
    ? EXTENSION_ROUTES.classifyExtensionUrl(value)
    : '';
  if (routeType === 'newtab' && isOwnExtensionUrl(value)) {
    return true;
  }
  const routeBuilders = [
    EXTENSION_ROUTES.buildNewtabUrl,
    EXTENSION_ROUTES.buildLumnoNewtabUrl
  ].filter((builder) => typeof builder === 'function');
  const prefixes = routeBuilders.length > 0
    ? routeBuilders.map((builder) => builder(chrome))
    : [
        chrome.runtime.getURL('src/newtab/newtab.html'),
        chrome.runtime.getURL('src/newtab/lumno-newtab.html')
      ];
  return prefixes.some((prefix) => value === prefix || value.startsWith(`${prefix}?`));
}

function isBrowserNewtabUrl(url) {
  const lower = String(url || '').toLowerCase();
  return lower === 'chrome://newtab/' ||
    lower === 'chrome://new-tab-page/' ||
    lower === 'edge://newtab/' ||
    lower === 'brave://newtab/' ||
    lower === 'opera://startpage/';
}

function isOwnExtensionUrl(url) {
  if (!url || !chrome || !chrome.runtime || !chrome.runtime.id) {
    return false;
  }
  try {
    const parsed = new URL(url);
    const protocol = String(parsed.protocol || '').toLowerCase();
    return isBrowserExtensionProtocol(protocol) &&
      String(parsed.hostname || '') === String(chrome.runtime.id);
  } catch (e) {
    return false;
  }
}

function isLumnoBrowserOverrideNewtabUrl(url) {
  const value = String(url || '');
  if (!value || !isOwnExtensionUrl(value) || !chrome || !chrome.runtime || typeof chrome.runtime.getURL !== 'function') {
    return false;
  }
  const newtabPrefix = typeof EXTENSION_ROUTES.buildNewtabUrl === 'function'
    ? EXTENSION_ROUTES.buildNewtabUrl(chrome)
    : chrome.runtime.getURL('src/newtab/newtab.html');
  return value === newtabPrefix || value.startsWith(`${newtabPrefix}?`);
}

function isOtherExtensionUrl(url) {
  if (!url || !chrome || !chrome.runtime || !chrome.runtime.id) {
    return false;
  }
  try {
    const parsed = new URL(String(url));
    return isBrowserExtensionProtocol(parsed.protocol) &&
      String(parsed.hostname || '') !== String(chrome.runtime.id);
  } catch (e) {
    return false;
  }
}

function pruneBrowserNewtabProviderCandidates(now) {
  const currentTime = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  browserNewtabProviderCandidateTabIds.forEach((createdAt, tabId) => {
    if (currentTime - Number(createdAt || 0) > BROWSER_NEWTAB_PROVIDER_DETECTION_MS) {
      browserNewtabProviderCandidateTabIds.delete(tabId);
    }
  });
}

function isPotentialBrowserNewtabProviderCandidate(tab) {
  if (!tab || typeof tab.id !== 'number') {
    return false;
  }
  const directUrl = typeof tab.url === 'string' ? tab.url : '';
  const pendingUrl = typeof tab.pendingUrl === 'string' ? tab.pendingUrl : '';
  const resolvedUrl = getResolvedTabUrl(tab);
  return isBrowserNewtabUrl(directUrl) ||
    isBrowserNewtabUrl(pendingUrl) ||
    isBrowserNewtabUrl(resolvedUrl) ||
    (!directUrl && !pendingUrl && tab.status === 'loading');
}

function rememberBrowserNewtabProviderCandidate(tab) {
  pruneBrowserNewtabProviderCandidates();
  if (!isPotentialBrowserNewtabProviderCandidate(tab)) {
    return;
  }
  browserNewtabProviderCandidateTabIds.set(tab.id, Date.now());
}

function isRecentBrowserNewtabProviderCandidate(tab) {
  if (!tab || typeof tab.id !== 'number') {
    return false;
  }
  pruneBrowserNewtabProviderCandidates();
  return browserNewtabProviderCandidateTabIds.has(tab.id);
}

function getBrowserNewtabProviderType(tab) {
  const url = getResolvedTabUrl(tab);
  if (!url) {
    return '';
  }
  if (isLumnoBrowserOverrideNewtabUrl(url)) {
    return 'lumno';
  }
  if (isOtherExtensionUrl(url)) {
    return 'other-extension';
  }
  if (isBrowserNewtabUrl(url) && tab && tab.status === 'complete') {
    return 'browser';
  }
  return '';
}

function setRestrictedActionFromBrowserNewtabProvider(providerType, tab, stage) {
  if (providerType !== 'other-extension') {
    return;
  }
  if (restrictedActionAutoBrowserSettingDoneCache) {
    return;
  }
  const url = getResolvedTabUrl(tab);
  restrictedActionAutoBrowserSettingDoneCache = true;
  restrictedActionCache = 'none';
  const payload = {
    [RESTRICTED_ACTION_STORAGE_KEY]: 'none',
    [RESTRICTED_ACTION_AUTO_BROWSER_SETTING_DONE_STORAGE_KEY]: true
  };
  if (storageArea && typeof storageArea.set === 'function') {
    storageArea.set(payload);
  }
  logHotkeyDebug('restricted-action-auto-browser-setting', {
    providerType,
    stage: stage || '',
    url: String(url || '')
  });
}

function maybeAutoSelectRestrictedBrowserSetting(tab, stage) {
  if (!tab || typeof tab.id !== 'number') {
    return;
  }
  if (restrictedActionAutoBrowserSettingDoneCache) {
    return;
  }
  const isCandidate = isRecentBrowserNewtabProviderCandidate(tab) ||
    isPotentialBrowserNewtabProviderCandidate(tab);
  if (!isCandidate) {
    return;
  }
  const providerType = getBrowserNewtabProviderType(tab);
  if (!providerType) {
    return;
  }
  if (providerType === 'lumno') {
    browserNewtabProviderCandidateTabIds.delete(tab.id);
    return;
  }
  if (providerType === 'other-extension') {
    setRestrictedActionFromBrowserNewtabProvider(providerType, tab, stage);
    browserNewtabProviderCandidateTabIds.delete(tab.id);
    return;
  }
}

function isLumnoOnboardingUrl(url) {
  return typeof EXTENSION_ROUTES.isOnboardingUrl === 'function' &&
    EXTENSION_ROUTES.isOnboardingUrl(url) &&
    isOwnExtensionUrl(url);
}

function shouldSuppressRestrictedCommandFallback(source, url) {
  if (COMMAND_TARGET_POLICY && typeof COMMAND_TARGET_POLICY.shouldSuppressRestrictedCommandFallback === 'function') {
    return COMMAND_TARGET_POLICY.shouldSuppressRestrictedCommandFallback(source, url, {
      isOwnExtensionUrl,
      isOnboardingUrl: isLumnoOnboardingUrl
    });
  }
  return false;
}

function shouldTriggerOnboardingOverlayFromCommand(source, url) {
  if (COMMAND_TARGET_POLICY && typeof COMMAND_TARGET_POLICY.shouldTriggerOnboardingOverlayFromCommand === 'function') {
    return COMMAND_TARGET_POLICY.shouldTriggerOnboardingOverlayFromCommand(source, url, {
      isOwnExtensionUrl,
      isOnboardingUrl: isLumnoOnboardingUrl
    });
  }
  return shouldSuppressRestrictedCommandFallback(source, url);
}

function triggerOnboardingOverlayFromCommand(activeTab, source) {
  if (!activeTab || typeof activeTab.id !== 'number') {
    return;
  }
  const action = COMMAND_TARGET_POLICY.ONBOARDING_SEARCH_OVERLAY_COMMAND_ACTION ||
    'triggerOnboardingSearchOverlayFromCommand';
  if (!chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
    logHotkeyDebug('onboarding-command-forward-missed', {
      tabId: activeTab.id,
      source: source || '',
      reason: 'runtime-send-message-unavailable'
    });
    return;
  }
  chrome.runtime.sendMessage({
    action,
    tabId: activeTab.id,
    source: source || ''
  }, (response) => {
    if (chrome.runtime && chrome.runtime.lastError) {
      logHotkeyDebug('onboarding-command-forward-failed', {
        tabId: activeTab.id,
        source: source || '',
        error: chrome.runtime.lastError.message || 'unknown'
      });
      return;
    }
    logHotkeyDebug('onboarding-command-forwarded', {
      tabId: activeTab.id,
      source: source || '',
      handled: Boolean(response && response.ok)
    });
  });
}

function getOwnExtensionFaviconUrl() {
  if (!chrome || !chrome.runtime || typeof chrome.runtime.getURL !== 'function') {
    return '';
  }
  return chrome.runtime.getURL('assets/images/lumno.png');
}

function shouldRecoverFromCommandNewtab(activeTab, source) {
  if (source !== 'commands' || !activeTab) {
    return false;
  }
  const activeUrl = getResolvedTabUrl(activeTab);
  return isLumnoNewtabUrl(activeUrl) || isBrowserNewtabUrl(activeUrl);
}

function pickRecoveryTargetTab(activeTab, tabs) {
  const tabList = Array.isArray(tabs) ? tabs : [];
  if (!activeTab || typeof activeTab.id !== 'number') {
    return null;
  }
  const openerTabId = typeof activeTab.openerTabId === 'number' ? activeTab.openerTabId : null;
  if (typeof openerTabId === 'number') {
    const openerTab = tabList.find((item) =>
      item &&
      item.id === openerTabId &&
      canOpenOverlayOnUrl(item.url || '')
    );
    if (openerTab) {
      return openerTab;
    }
  }
  const candidates = tabList
    .filter((item) =>
      item &&
      typeof item.id === 'number' &&
      item.id !== activeTab.id &&
      canOpenOverlayOnUrl(item.url || '')
    )
    .sort((a, b) => Number(b.lastAccessed || 0) - Number(a.lastAccessed || 0));
  return candidates[0] || null;
}

function recoverOverlayTargetFromCommandNewtab(activeTab, tabs, source) {
  if (!shouldRecoverFromCommandNewtab(activeTab, source)) {
    return false;
  }
  const targetTab = pickRecoveryTargetTab(activeTab, tabs);
  if (!targetTab || typeof targetTab.id !== 'number') {
    logHotkeyDebug('command-newtab-recover-missed', {
      reason: 'no-target',
      tabId: activeTab && typeof activeTab.id === 'number' ? activeTab.id : null,
      source: source || ''
    });
    return false;
  }
  logHotkeyDebug('command-newtab-recover-start', {
    source: source || '',
    fromTabId: activeTab.id,
    toTabId: targetTab.id,
    fromUrl: activeTab.url || '',
    toUrl: targetTab.url || ''
  });
  chrome.tabs.update(targetTab.id, { active: true }, () => {
    if (chrome.runtime && chrome.runtime.lastError) {
      logHotkeyDebug('command-newtab-recover-failed', {
        source: source || '',
        targetTabId: targetTab.id,
        error: chrome.runtime.lastError.message || 'unknown'
      });
      return;
    }
    if (typeof activeTab.id === 'number') {
      chrome.tabs.remove(activeTab.id, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          logHotkeyDebug('command-newtab-close-failed', {
            source: source || '',
            tabId: activeTab.id,
            error: chrome.runtime.lastError.message || 'unknown'
          });
        }
      });
    }
    openOverlayOnTab(targetTab, tabs, 'commands-recover');
  });
  return true;
}

function isSearchCommandSource(source) {
  return source === 'commands' || source === 'commands-prefill';
}

function requestFocusVisibleNewtabInput(source, tabId) {
  const payload = {
    action: 'lumno:newtab-focus-input',
    source: source || '',
    tabId: typeof tabId === 'number' ? tabId : null
  };
  try {
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        logHotkeyDebug('command-newtab-focus-send-failed', {
          source: source || '',
          tabId: typeof tabId === 'number' ? tabId : null,
          error: chrome.runtime.lastError.message || 'unknown'
        });
        return;
      }
      logHotkeyDebug('command-newtab-focus-send-done', {
        source: source || '',
        tabId: typeof tabId === 'number' ? tabId : null,
        ok: Boolean(response && response.ok)
      });
    });
  } catch (e) {
    logHotkeyDebug('command-newtab-focus-send-error', {
      source: source || '',
      tabId: typeof tabId === 'number' ? tabId : null,
      error: e && e.message ? e.message : String(e || '')
    });
  }
}

const HOTKEY_DEBUG_ENABLED = false;
const TAB_SWITCHER_SHORTCUT_DEBUG_LIMIT = 50;
const tabSwitcherShortcutDebugEvents = [];

function recordTabSwitcherShortcutDebug(stage, payload) {
  tabSwitcherShortcutDebugEvents.push({
    at: new Date().toISOString(),
    stage: String(stage || ''),
    ...(payload && typeof payload === 'object' ? payload : {})
  });
  if (tabSwitcherShortcutDebugEvents.length > TAB_SWITCHER_SHORTCUT_DEBUG_LIMIT) {
    tabSwitcherShortcutDebugEvents.splice(
      0,
      tabSwitcherShortcutDebugEvents.length - TAB_SWITCHER_SHORTCUT_DEBUG_LIMIT
    );
  }
}

globalThis._lumnoTabSwitcherShortcutDebug = Object.freeze({
  snapshot() {
    return tabSwitcherShortcutDebugEvents.map((event) => ({ ...event }));
  },
  clear() {
    tabSwitcherShortcutDebugEvents.length = 0;
  }
});

function logHotkeyDebug(stage, payload) {
  if (!HOTKEY_DEBUG_ENABLED) {
    return;
  }
  try {
    const detail = payload && typeof payload === 'object' ? payload : {};
    console.log(`[Lumno][hotkey] ${stage}`, detail);
  } catch (e) {
    // Ignore logging errors.
  }
}

const providerStorageRuntime = globalThis.LumnoSettings &&
  typeof globalThis.LumnoSettings.createProviderStorageRuntime === 'function'
  ? globalThis.LumnoSettings.createProviderStorageRuntime(chrome)
  : null;
const storageArea = providerStorageRuntime
  ? providerStorageRuntime.area
  : ((chrome && chrome.storage && chrome.storage.sync)
      ? chrome.storage.sync
      : (chrome && chrome.storage ? chrome.storage.local : null));
const localStorageArea = (chrome && chrome.storage && chrome.storage.local)
  ? chrome.storage.local
  : storageArea;
const storageAreaName = providerStorageRuntime ? providerStorageRuntime.name : (storageArea
  ? (storageArea === (chrome && chrome.storage ? chrome.storage.sync : null) ? 'sync' : 'local')
  : null);
function isPrimaryStorageAreaName(areaName) {
  return providerStorageRuntime
    ? providerStorageRuntime.isActiveAreaName(areaName)
    : Boolean(storageAreaName) && areaName === storageAreaName;
}
const THEME_STORAGE_KEY = '_x_extension_theme_mode_2024_unique_';
const LANGUAGE_STORAGE_KEY = '_x_extension_language_2024_unique_';
const LANGUAGE_MESSAGES_STORAGE_KEY = '_x_extension_language_messages_2024_unique_';
const RECENT_MODE_STORAGE_KEY = '_x_extension_recent_mode_2024_unique_';
const RECENT_COUNT_STORAGE_KEY = '_x_extension_recent_count_2024_unique_';
const NEWTAB_WIDTH_MODE_STORAGE_KEY = '_x_extension_newtab_width_mode_2026_unique_';
const NEWTAB_SEARCH_WIDTH_STORAGE_KEY = '_x_extension_newtab_search_width_2026_unique_';
const NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY = (
  globalThis.LumnoSettings && globalThis.LumnoSettings.NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY
) || '_x_extension_newtab_wordmark_visible_2026_unique_';
const NEWTAB_THEME_MODE_STORAGE_KEY = '_x_extension_newtab_theme_mode_2026_unique_';
const NEWTAB_THEME_SCOPE_STORAGE_KEY = '_x_extension_newtab_theme_scope_2026_unique_';
const NEWTAB_ZEN_MODE_STORAGE_KEY = '_x_extension_newtab_zen_mode_2026_unique_';
const NEWTAB_WALLPAPER_STORAGE_KEY = '_x_extension_newtab_wallpaper_2026_unique_';
const NEWTAB_WALLPAPER_OVERLAY_STORAGE_KEY = '_x_extension_newtab_wallpaper_overlay_2026_unique_';
const NEWTAB_WALLPAPER_EFFECT_STORAGE_KEY = '_x_extension_newtab_wallpaper_effect_2026_unique_';
const NEWTAB_FAVICON_STORAGE_KEY = '_x_extension_newtab_favicon_2026_unique_';
const OVERLAY_SIZE_MODE_STORAGE_KEY = '_x_extension_overlay_size_mode_2026_unique_';
const OVERLAY_ENTER_ANIMATION_STORAGE_KEY = '_x_extension_overlay_enter_animation_2026_unique_';
const BOOKMARK_COUNT_STORAGE_KEY = '_x_extension_bookmark_count_2024_unique_';
const BOOKMARK_COLUMNS_STORAGE_KEY = '_x_extension_bookmark_columns_2024_unique_';
const BOOKMARK_VIEW_MODE_STORAGE_KEY = '_x_extension_bookmark_view_mode_2026_unique_';
const BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY = '_x_extension_bookmark_folder_icons_visible_2026_unique_';
const BOOKMARK_TOPBAR_LOCAL_STORAGE_KEYS = globalThis.LumnoSettings &&
  Array.isArray(globalThis.LumnoSettings.BOOKMARK_TOPBAR_LOCAL_STORAGE_KEYS)
  ? globalThis.LumnoSettings.BOOKMARK_TOPBAR_LOCAL_STORAGE_KEYS
  : [];
const PINNED_RECENT_SITES_STORAGE_KEY = '_x_extension_newtab_pinned_recent_sites_2026_unique_';
const HIDDEN_RECENT_SITES_STORAGE_KEY = '_x_extension_newtab_hidden_recent_sites_2026_unique_';
const NEWTAB_SHORTCUTS_STORAGE_KEY = '_x_extension_newtab_shortcuts_2026_unique_';
const RESTRICTED_ACTION_STORAGE_KEY = '_x_extension_restricted_action_2024_unique_';
const RESTRICTED_ACTION_AUTO_BROWSER_SETTING_DONE_STORAGE_KEY = '_x_extension_restricted_action_auto_browser_setting_done_2026_unique_';
const OVERLAY_TAB_PRIORITY_STORAGE_KEY = '_x_extension_overlay_tab_priority_2024_unique_';
const TAB_RANK_SCORE_DEBUG_STORAGE_KEY = '_x_extension_tab_rank_score_debug_2026_unique_';
const AUTO_PIP_ENABLED_STORAGE_KEY = '_x_extension_auto_pip_enabled_2026_unique_';
const TAB_SWITCHER_ENABLED_STORAGE_KEY = '_x_extension_tab_switcher_enabled_2026_unique_';
const DOCUMENT_PIP_ENABLED_STORAGE_KEY = '_x_extension_document_pip_enabled_2026_unique_';
const PINNED_TAB_RECOVERY_ENABLED_STORAGE_KEY = '_x_extension_pinned_tab_recovery_enabled_2026_unique_';
const SELECTION_QUICK_ACTIONS_ENABLED_STORAGE_KEY = '_x_extension_selection_quick_actions_enabled_2026_unique_';
const SELECTION_QUICK_ACTIONS_PROVIDER_STORAGE_KEY = '_x_extension_selection_quick_actions_provider_2026_unique_';
const SELECTION_QUICK_ACTIONS_GROUP_ENABLED_STORAGE_KEY = '_x_extension_selection_quick_actions_group_enabled_2026_unique_';
const FALLBACK_SHORTCUT_STORAGE_KEY = '_x_extension_fallback_hotkey_2024_unique_';
const SEARCH_RESULT_PRIORITY_STORAGE_KEY = '_x_extension_search_result_priority_2026_unique_';
const SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY = '_x_extension_search_result_source_types_2026_unique_';
const SEARCH_SELECTION_STATS_STORAGE_KEY = '_x_extension_search_selection_stats_2026_unique_';
const FAVICON_VISIT_DIRTY_STORAGE_KEY = '_x_extension_favicon_visit_dirty_2026_unique_';
const FAVICON_VISIT_DIRTY_TTL_MS = 1000 * 60 * 60 * 24;
const FAVICON_VISIT_DIRTY_MAX_ENTRIES = 600;
const PINNED_TAB_SNAPSHOT_STORAGE_KEY = '_x_extension_pinned_tab_snapshot_2026_unique_';
const REMOVED_AI_SYNC_STORAGE_KEYS = [
  '_x_extension_ai_search_mode_2026_unique_',
  '_x_extension_ai_provider_2026_unique_',
  '_x_extension_ai_entitlement_cache_2026_unique_'
];
const REMOVED_AI_LOCAL_STORAGE_KEYS = [
  '_x_extension_ai_api_key_2026_unique_'
];
const SHOW_SEARCH_COMMAND_NAME = 'show-search';
const SHOW_SEARCH_PREFILL_COMMAND_NAME = 'show-search-prefill';
const SHOW_SEARCH_PREFILL_V_COMMAND_NAME = 'show-search-prefill-v';
const SHOW_TAB_SWITCHER_COMMAND_NAME = 'show-tab-switcher';
const TAB_SWITCHER_EXTENSION_PAGE_PORT_NAME = 'lumno-tab-switcher-extension-page';
const TAB_SWITCHER_EXTENSION_PAGE_PORT_WAIT_MS = 650;
const TAB_SWITCHER_EXTENSION_PAGE_PORT_RETRY_MS = 50;
const TAB_SWITCHER_HOST_ID = '_x_extension_tab_switcher_host_2026_unique_';
const tabSwitcherExtensionPagePortsByTabId = new Map();
const TAB_SWITCHER_OPENING_GUARD_MS = 2000;
const tabSwitcherOpeningByWindowKey = new Map();
const TAB_SWITCHER_HOST_STATE_TIMEOUT_MS = 400;
const tabSwitcherHostTabIdByWindowId = new Map();
const HOTKEY_DUP_GUARD_MS = 180;
const OVERLAY_OPENING_GUARD_MS = 5000;
const OVERLAY_RUNTIME_VERSION = '2026-08-17-loading-session-v6';
const OVERLAY_HOST_ID = '_x_extension_overlay_host_2026_unique_';
const OVERLAY_LOADING_RECORD_STORAGE_PREFIX =
  '_x_extension_overlay_loading_record_2026_unique_:';
const OVERLAY_LOADING_RECORD_TTL_MS = Number(
  OVERLAY_LOADING_LIFECYCLE.DEFAULT_RECORD_TTL_MS
) || (5 * 60 * 1000);
const OVERLAY_LOADING_RECOVERY_MAX_ATTEMPTS = 3;
const OVERLAY_LOADING_RECOVERY_RETRY_MS = 120;
const OVERLAY_LOADING_PRE_COMPLETE_RETRY_MAX_ATTEMPTS = 3;
const OVERLAY_LOADING_PRE_COMPLETE_RETRY_MS = 120;
const PAGE_HOTKEY_NEWTAB_RECOVER_MS = 1200;
const BROWSER_NEWTAB_PROVIDER_DETECTION_MS = 6000;
const TAB_SWITCHER_LIMIT = 5;
const TAB_SWITCHER_CAPTURE_DELAY_MS = 220;
const TAB_SWITCHER_PRIORITY_CAPTURE_DELAY_MS = 90;
const TAB_SWITCHER_CAPTURE_HIDE_PAINT_WAIT_MS = 48;
const TAB_SWITCHER_CAPTURE_MIN_INTERVAL_MS = 650;
const TAB_SWITCHER_CAPTURE_JPEG_QUALITY = 42;
const TAB_SWITCHER_CAPTURE_REASON_COMMAND_IMMEDIATE = 'command-immediate';
const TAB_SWITCHER_THUMBNAIL_STORAGE_KEY = '_x_extension_tab_switcher_state_2026_unique_';
const TAB_SWITCHER_THUMBNAIL_LIMIT = 12;
const TAB_SWITCHER_THUMBNAIL_TTL_MS = 1000 * 60 * 60 * 2;
const TAB_SWITCHER_THUMBNAIL_PERSIST_DEBOUNCE_MS = 350;
const TAB_SWITCHER_THUMBNAIL_TARGET_WIDTH = 320;
const TAB_SWITCHER_THUMBNAIL_TARGET_HEIGHT = 200;
const TAB_SWITCH_WINDOW_SHORT_MS = 30 * 60 * 1000;
const TAB_SWITCH_WINDOW_DAY_MS = 24 * 60 * 60 * 1000;
const TAB_SWITCH_HIGH_FREQ_SHORT_THRESHOLD = 2;
const TAB_SWITCH_HIGH_FREQ_DAY_THRESHOLD = 5;
const TAB_SWITCH_EVENT_HISTORY_LIMIT = 60;
const TAB_SWITCH_STATS_STORAGE_KEY = '_x_extension_tab_switch_stats_2026_unique_';
const PINNED_TAB_SNAPSHOT_DEBOUNCE_MS = 600;
const PINNED_TAB_RESTORE_MAX_TABS = 24;
let restrictedActionCache = 'default';
let restrictedActionAutoBrowserSettingDoneCache = false;
let documentPipEnabledCache = false;
let tabSwitcherEnabledCache = true;
let pinnedTabRecoveryEnabledCache = false;
const hotkeyInvokeAtByTabId = new Map();
const overlayOpeningByTabId = new Map();
const overlayLoadingRecordsByTabId = new Map();
const overlayLoadingRecoveryInFlightByTabId = new Set();
const overlayLoadingPendingUpdateByTabId = new Map();
const browserNewtabProviderCandidateTabIds = new Map();
let lastPageHotkeyContext = null;
const tabSwitchEventsByTabId = new Map();
const tabLastAccessedByTabId = new Map();
let tabSwitchEventDebugTotal = 0;
let tabOverlayFetchSeq = 0;
let tabSwitchStatsLoaded = false;
let tabSwitchStatsLoadPromise = null;
let pinnedTabSnapshotTimer = null;
let pinnedTabSnapshotPersistOptions = null;
let pinnedTabRecoverySettingLoaded = false;
let pinnedTabRecoverySettingLoadPromise = null;
let pinnedTabRestorePromise = null;
const tabSwitcherThumbnailTimersByTabId = new Map();
const tabSwitcherThumbnailPriorityByTabId = new Map();
let tabSwitcherThumbnailCaptureChain = Promise.resolve(false);
let tabSwitcherLastCaptureAt = 0;
let tabSwitcherStateLoaded = false;
let tabSwitcherStateLoadPromise = null;
let tabSwitcherStatePersistTimer = null;
let tabSwitcherStateDirtyBeforeLoad = false;
let tabSwitcherExtensionPageRequestSeq = 0;
const recentTabTracker = RECENT_TAB_SWITCHER && typeof RECENT_TAB_SWITCHER.createRecentTabTracker === 'function'
  ? RECENT_TAB_SWITCHER.createRecentTabTracker({
    limit: TAB_SWITCHER_LIMIT,
    thumbnailLimit: TAB_SWITCHER_THUMBNAIL_LIMIT,
    thumbnailTtlMs: TAB_SWITCHER_THUMBNAIL_TTL_MS,
    shouldIncludeTab: shouldTrackSwitcherTab
  })
  : null;
const faviconVisitDirtyWriteDebounceMs = 400;
const faviconVisitDirtyMarkThrottleMs = 2 * 60 * 1000;
const faviconVisitDirtyMarkCache = new Map();
let faviconVisitDirtyPersistTimer = null;

function normalizeFaviconVisitDirtyHost(hostname) {
  if (!hostname) {
    return '';
  }
  return normalizeHost(String(hostname).trim());
}

function getFaviconVisitDirtyStorageArea() {
  if (!chrome || !chrome.storage || !chrome.storage.local) {
    return null;
  }
  return chrome.storage.local;
}

function getValidFaviconVisitDirtyEntries(rawEntries) {
  const now = Date.now();
  const input = rawEntries && typeof rawEntries === 'object' ? rawEntries : {};
  const valid = [];
  Object.keys(input).forEach((key) => {
    const updatedAt = Number(input[key] || 0);
    if (!key || !Number.isFinite(updatedAt)) {
      return;
    }
    if (now - updatedAt > FAVICON_VISIT_DIRTY_TTL_MS) {
      return;
    }
    valid.push({ key, updatedAt });
  });
  valid.sort((a, b) => b.updatedAt - a.updatedAt);
  return valid.slice(0, FAVICON_VISIT_DIRTY_MAX_ENTRIES);
}

function schedulePersistFaviconVisitDirtyHost(hostname) {
  const host = normalizeFaviconVisitDirtyHost(hostname);
  const storageArea = getFaviconVisitDirtyStorageArea();
  if (!host || !storageArea) {
    return;
  }
  const now = Date.now();
  const lastMarkedAt = Number(faviconVisitDirtyMarkCache.get(host) || 0);
  if (lastMarkedAt && (now - lastMarkedAt) < faviconVisitDirtyMarkThrottleMs) {
    return;
  }
  faviconVisitDirtyMarkCache.set(host, now);
  if (faviconVisitDirtyPersistTimer !== null) {
    clearTimeout(faviconVisitDirtyPersistTimer);
  }
  faviconVisitDirtyPersistTimer = setTimeout(() => {
    faviconVisitDirtyPersistTimer = null;
    storageArea.get([FAVICON_VISIT_DIRTY_STORAGE_KEY], (result) => {
      const payload = result && result[FAVICON_VISIT_DIRTY_STORAGE_KEY];
      const existing = getValidFaviconVisitDirtyEntries(payload && payload.entries ? payload.entries : null);
      const merged = new Map(existing.map((item) => [item.key, item.updatedAt]));
      faviconVisitDirtyMarkCache.forEach((updatedAt, key) => {
        merged.set(key, updatedAt);
      });
      const serializedEntries = Array.from(merged.entries())
        .map(([key, updatedAt]) => ({
          key: String(key || ''),
          updatedAt: Number(updatedAt || 0)
        }))
        .filter((item) => item.key && Number.isFinite(item.updatedAt))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, FAVICON_VISIT_DIRTY_MAX_ENTRIES);
      const serialized = {};
      serializedEntries.forEach((item) => {
        serialized[item.key] = item.updatedAt;
      });
      storageArea.set({
        [FAVICON_VISIT_DIRTY_STORAGE_KEY]: {
          version: 1,
          entries: serialized,
          updatedAt: Date.now()
        }
      }, () => {
        faviconVisitDirtyMarkCache.clear();
      });
    });
  }, faviconVisitDirtyWriteDebounceMs);
}

function markFaviconDirtyForUrl(url) {
  if (!url) {
    return;
  }
  let parsed = null;
  try {
    parsed = new URL(url);
  } catch (e) {
    return;
  }
  if (!/^https?:$/i.test(parsed.protocol)) {
    return;
  }
  const host = normalizeFaviconVisitDirtyHost(parsed.hostname);
  if (!host || shouldBlockFaviconForHost(host)) {
    return;
  }
  schedulePersistFaviconVisitDirtyHost(host);
}

function cleanupRemovedAiStorageKeys() {
  if (!chrome || !chrome.storage) {
    return;
  }
  const syncArea = chrome.storage.sync;
  const localArea = chrome.storage.local;
  if (syncArea && typeof syncArea.remove === 'function') {
    syncArea.remove(REMOVED_AI_SYNC_STORAGE_KEYS, () => {});
  }
  if (localArea && typeof localArea.remove === 'function') {
    localArea.remove(REMOVED_AI_LOCAL_STORAGE_KEYS, () => {});
  }
}

function cleanupLocalOnlyBookmarkTopbarSyncStorage() {
  if (!chrome || !chrome.storage || !chrome.storage.sync ||
      typeof chrome.storage.sync.remove !== 'function' ||
      BOOKMARK_TOPBAR_LOCAL_STORAGE_KEYS.length === 0) {
    return;
  }
  chrome.storage.sync.remove(BOOKMARK_TOPBAR_LOCAL_STORAGE_KEYS, () => {
    void (chrome.runtime && chrome.runtime.lastError);
  });
}

function getTabSwitchStorageArea() {
  if (!chrome || !chrome.storage) {
    return null;
  }
  if (chrome.storage.session) {
    return chrome.storage.session;
  }
  if (chrome.storage.local) {
    return chrome.storage.local;
  }
  return null;
}

function getTabSwitcherStateStorageArea() {
  if (!chrome || !chrome.storage) {
    return null;
  }
  return chrome.storage.session || chrome.storage.local || null;
}

function getTabSwitcherStateFromStorage() {
  const storageArea = getTabSwitcherStateStorageArea();
  if (!storageArea || typeof storageArea.get !== 'function') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    storageArea.get([TAB_SWITCHER_THUMBNAIL_STORAGE_KEY], (result) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(result ? result[TAB_SWITCHER_THUMBNAIL_STORAGE_KEY] : null);
    });
  });
}

function setTabSwitcherStateToStorage(state) {
  const storageArea = getTabSwitcherStateStorageArea();
  if (!storageArea || typeof storageArea.set !== 'function') {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    storageArea.set({ [TAB_SWITCHER_THUMBNAIL_STORAGE_KEY]: state }, () => {
      resolve(!(chrome.runtime && chrome.runtime.lastError));
    });
  });
}

function ensureTabSwitcherStateLoaded() {
  if (!recentTabTracker || typeof recentTabTracker.hydrateState !== 'function') {
    tabSwitcherStateLoaded = true;
    return Promise.resolve(false);
  }
  if (tabSwitcherStateLoaded) {
    return Promise.resolve(true);
  }
  if (tabSwitcherStateLoadPromise) {
    return tabSwitcherStateLoadPromise;
  }
  tabSwitcherStateLoadPromise = getTabSwitcherStateFromStorage()
    .then((state) => {
      if (state) {
        recentTabTracker.hydrateState(state, {
          merge: tabSwitcherStateDirtyBeforeLoad === true
        });
      }
      tabSwitcherStateLoaded = true;
      if (tabSwitcherStateDirtyBeforeLoad) {
        schedulePersistTabSwitcherState();
      }
      return true;
    })
    .catch(() => {
      tabSwitcherStateLoaded = true;
      return false;
    })
    .finally(() => {
      tabSwitcherStateLoadPromise = null;
      tabSwitcherStateDirtyBeforeLoad = false;
    });
  return tabSwitcherStateLoadPromise;
}

function persistTabSwitcherState() {
  tabSwitcherStatePersistTimer = null;
  if (!recentTabTracker || typeof recentTabTracker.exportState !== 'function') {
    return Promise.resolve(false);
  }
  return setTabSwitcherStateToStorage(recentTabTracker.exportState());
}

function schedulePersistTabSwitcherState() {
  if (!recentTabTracker || typeof recentTabTracker.exportState !== 'function') {
    return;
  }
  if (!tabSwitcherStateLoaded) {
    tabSwitcherStateDirtyBeforeLoad = true;
  }
  if (tabSwitcherStatePersistTimer !== null) {
    clearTimeout(tabSwitcherStatePersistTimer);
  }
  tabSwitcherStatePersistTimer = setTimeout(() => {
    persistTabSwitcherState().catch(() => {});
  }, TAB_SWITCHER_THUMBNAIL_PERSIST_DEBOUNCE_MS);
}

function normalizeTabSwitchStatEntry(raw, now) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const minTs = now - TAB_SWITCH_WINDOW_DAY_MS;
  const rawEvents = Array.isArray(raw.events) ? raw.events : [];
  const events = rawEvents
    .map((item) => Number(item) || 0)
    .filter((item) => item >= minTs)
    .sort((a, b) => a - b)
    .slice(-TAB_SWITCH_EVENT_HISTORY_LIMIT);
  const lastSwitchAtRaw = Number(raw.lastSwitchAt) || 0;
  const lastSwitchAt = Math.max(lastSwitchAtRaw, events.length > 0 ? events[events.length - 1] : 0);
  if (events.length <= 0 && lastSwitchAt <= 0) {
    return null;
  }
  return {
    events: events,
    lastSwitchAt: lastSwitchAt
  };
}

function mergeTabSwitchStat(target, incoming, now) {
  const left = normalizeTabSwitchStatEntry(target, now) || { events: [], lastSwitchAt: 0 };
  const right = normalizeTabSwitchStatEntry(incoming, now) || { events: [], lastSwitchAt: 0 };
  const mergedEvents = left.events.concat(right.events)
    .filter((item) => typeof item === 'number' && item > 0)
    .sort((a, b) => a - b)
    .slice(-TAB_SWITCH_EVENT_HISTORY_LIMIT);
  const lastSwitchAt = Math.max(left.lastSwitchAt || 0, right.lastSwitchAt || 0, mergedEvents.length > 0 ? mergedEvents[mergedEvents.length - 1] : 0);
  if (mergedEvents.length <= 0 && lastSwitchAt <= 0) {
    return null;
  }
  return {
    events: mergedEvents,
    lastSwitchAt: lastSwitchAt
  };
}

function applyPersistedTabSwitchStats(payload) {
  const now = Date.now();
  if (!payload || typeof payload !== 'object') {
    return;
  }
  Object.keys(payload).forEach((tabIdKey) => {
    const tabId = Number.parseInt(tabIdKey, 10);
    if (!Number.isFinite(tabId)) {
      return;
    }
    const incoming = normalizeTabSwitchStatEntry(payload[tabIdKey], now);
    if (!incoming) {
      return;
    }
    const existing = tabSwitchEventsByTabId.get(tabId) || null;
    const merged = mergeTabSwitchStat(existing, incoming, now);
    if (merged) {
      tabSwitchEventsByTabId.set(tabId, merged);
    }
  });
}

function exportTabSwitchStatsSnapshot() {
  const now = Date.now();
  const out = {};
  tabSwitchEventsByTabId.forEach((stat, tabId) => {
    if (typeof tabId !== 'number') {
      return;
    }
    const normalized = normalizeTabSwitchStatEntry(stat, now);
    if (!normalized) {
      return;
    }
    out[String(tabId)] = normalized;
  });
  return out;
}

function persistTabSwitchStatsNow() {
  const area = getTabSwitchStorageArea();
  if (!area) {
    return Promise.resolve(false);
  }
  const snapshot = exportTabSwitchStatsSnapshot();
  return new Promise((resolve) => {
    area.set({ [TAB_SWITCH_STATS_STORAGE_KEY]: snapshot }, () => {
      resolve(!(chrome.runtime && chrome.runtime.lastError));
    });
  });
}

function ensureTabSwitchStatsLoaded() {
  if (tabSwitchStatsLoaded) {
    return Promise.resolve();
  }
  if (tabSwitchStatsLoadPromise) {
    return tabSwitchStatsLoadPromise;
  }
  const area = getTabSwitchStorageArea();
  if (!area) {
    tabSwitchStatsLoaded = true;
    return Promise.resolve();
  }
  tabSwitchStatsLoadPromise = new Promise((resolve) => {
    area.get([TAB_SWITCH_STATS_STORAGE_KEY], (result) => {
      const payload = result ? result[TAB_SWITCH_STATS_STORAGE_KEY] : null;
      applyPersistedTabSwitchStats(payload);
      tabSwitchStatsLoaded = true;
      tabSwitchStatsLoadPromise = null;
      resolve();
    });
  });
  return tabSwitchStatsLoadPromise;
}

function normalizePinnedTabRecoveryEnabled(value) {
  return value === true;
}

function normalizeTabSwitcherEnabled(value) {
  const settings = globalThis.LumnoSettings || {};
  return typeof settings.normalizeTabSwitcherEnabled === 'function'
    ? settings.normalizeTabSwitcherEnabled(value)
    : value !== false;
}

function applyPinnedTabRecoverySetting(rawValue) {
  const normalized = normalizePinnedTabRecoveryEnabled(rawValue);
  pinnedTabRecoveryEnabledCache = normalized;
  pinnedTabRecoverySettingLoaded = true;
  if (rawValue !== normalized && storageArea && typeof storageArea.set === 'function') {
    storageArea.set({ [PINNED_TAB_RECOVERY_ENABLED_STORAGE_KEY]: normalized });
  }
  return normalized;
}

function ensurePinnedTabRecoverySettingLoaded() {
  if (pinnedTabRecoverySettingLoaded) {
    return Promise.resolve(pinnedTabRecoveryEnabledCache);
  }
  if (pinnedTabRecoverySettingLoadPromise) {
    return pinnedTabRecoverySettingLoadPromise;
  }
  if (!storageArea || typeof storageArea.get !== 'function') {
    pinnedTabRecoverySettingLoaded = true;
    pinnedTabRecoveryEnabledCache = false;
    return Promise.resolve(false);
  }
  pinnedTabRecoverySettingLoadPromise = new Promise((resolve) => {
    storageArea.get([PINNED_TAB_RECOVERY_ENABLED_STORAGE_KEY], (result) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        pinnedTabRecoverySettingLoaded = true;
        pinnedTabRecoveryEnabledCache = false;
        resolve(false);
        return;
      }
      const rawValue = result ? result[PINNED_TAB_RECOVERY_ENABLED_STORAGE_KEY] : undefined;
      resolve(applyPinnedTabRecoverySetting(rawValue));
    });
  }).finally(() => {
    pinnedTabRecoverySettingLoadPromise = null;
  });
  return pinnedTabRecoverySettingLoadPromise;
}

function queryTabsForPinnedSnapshot(queryInfo) {
  return new Promise((resolve) => {
    if (!chrome || !chrome.tabs || typeof chrome.tabs.query !== 'function') {
      resolve([]);
      return;
    }
    chrome.tabs.query(queryInfo || {}, (tabs) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        resolve([]);
        return;
      }
      resolve(Array.isArray(tabs) ? tabs : []);
    });
  });
}

function getPinnedSnapshotFromStorage() {
  return new Promise((resolve) => {
    if (!chrome || !chrome.storage || !chrome.storage.local) {
      resolve(null);
      return;
    }
    chrome.storage.local.get([PINNED_TAB_SNAPSHOT_STORAGE_KEY], (result) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(result ? result[PINNED_TAB_SNAPSHOT_STORAGE_KEY] : null);
    });
  });
}

function setPinnedSnapshotToStorage(snapshot) {
  return new Promise((resolve) => {
    if (!chrome || !chrome.storage || !chrome.storage.local) {
      resolve(false);
      return;
    }
    chrome.storage.local.set({ [PINNED_TAB_SNAPSHOT_STORAGE_KEY]: snapshot }, () => {
      if (chrome.runtime && chrome.runtime.lastError) {
        resolve(false);
        return;
      }
      resolve(true);
    });
  });
}

function createPinnedTabForRestore(url, windowId) {
  return new Promise((resolve) => {
    if (!chrome || !chrome.tabs || typeof chrome.tabs.create !== 'function') {
      resolve({ ok: false, tab: null });
      return;
    }
    const createWithWindow = (typeof windowId === 'number')
      ? { windowId, url, pinned: true, active: false }
      : { url, pinned: true, active: false };
    chrome.tabs.create(createWithWindow, (tab) => {
      if (!(chrome.runtime && chrome.runtime.lastError)) {
        resolve({ ok: true, tab: tab || null });
        return;
      }
      if (typeof windowId !== 'number') {
        resolve({ ok: false, tab: null });
        return;
      }
      chrome.tabs.create({ url, pinned: true, active: false }, (fallbackTab) => {
        resolve({
          ok: !(chrome.runtime && chrome.runtime.lastError),
          tab: fallbackTab || null
        });
      });
    });
  });
}

function getLastFocusedWindowIdForRestore() {
  return new Promise((resolve) => {
    if (!chrome || !chrome.windows || typeof chrome.windows.getLastFocused !== 'function') {
      resolve(null);
      return;
    }
    chrome.windows.getLastFocused({}, (windowInfo) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      const canUse = windowInfo &&
        typeof windowInfo.id === 'number' &&
        windowInfo.incognito !== true &&
        (!windowInfo.type || windowInfo.type === 'normal');
      resolve(canUse ? windowInfo.id : null);
    });
  });
}

function getNormalWindowCountForPinnedSnapshot() {
  return new Promise((resolve) => {
    if (!chrome || !chrome.windows || typeof chrome.windows.getAll !== 'function') {
      resolve(0);
      return;
    }
    chrome.windows.getAll({ windowTypes: ['normal'] }, (windows) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        resolve(0);
        return;
      }
      const count = Array.isArray(windows)
        ? windows.filter((windowInfo) =>
          windowInfo &&
          windowInfo.incognito !== true &&
          (!windowInfo.type || windowInfo.type === 'normal')
        ).length
        : 0;
      resolve(count);
    });
  });
}

function getPinnedTabUngroupedId() {
  return chrome &&
    chrome.tabGroups &&
    typeof chrome.tabGroups.TAB_GROUP_ID_NONE === 'number'
    ? chrome.tabGroups.TAB_GROUP_ID_NONE
    : -1;
}

function isTabInGroup(tab) {
  return Boolean(
    tab &&
    typeof tab.groupId === 'number' &&
    tab.groupId !== getPinnedTabUngroupedId()
  );
}

function normalizePinnedTabGroupSnapshot(rawValue) {
  if (!rawValue || typeof rawValue !== 'object') {
    return null;
  }
  const key = String(rawValue.key || '').trim();
  const title = String(rawValue.title || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const color = String(rawValue.color || '').trim();
  if (!key && !title && !color) {
    return null;
  }
  const snapshot = {};
  if (key) {
    snapshot.key = key;
  }
  if (title) {
    snapshot.title = title;
  }
  if (color) {
    snapshot.color = color;
  }
  return snapshot;
}

function normalizePinnedTabSnapshotEntry(rawValue) {
  const raw = typeof rawValue === 'string'
    ? { url: rawValue }
    : (rawValue && typeof rawValue === 'object' ? rawValue : null);
  if (!raw) {
    return null;
  }
  const url = String(raw.url || '').trim();
  if (!url || isRestrictedUrl(url)) {
    return null;
  }
  const entry = { url };
  const group = normalizePinnedTabGroupSnapshot(raw.group);
  if (group) {
    entry.group = group;
  }
  return entry;
}

function normalizePinnedTabSnapshot(rawValue) {
  const entries = [];
  const appendEntry = (item) => {
    const entry = normalizePinnedTabSnapshotEntry(item);
    if (entry) {
      entries.push(entry);
    }
  };
  if (Array.isArray(rawValue)) {
    rawValue.forEach(appendEntry);
    return entries.slice(0, PINNED_TAB_RESTORE_MAX_TABS);
  }
  if (!rawValue || typeof rawValue !== 'object') {
    return [];
  }
  if (Array.isArray(rawValue.entries)) {
    rawValue.entries.forEach(appendEntry);
    return entries.slice(0, PINNED_TAB_RESTORE_MAX_TABS);
  }
  if (Array.isArray(rawValue.urls)) {
    rawValue.urls.forEach(appendEntry);
  }
  return entries.slice(0, PINNED_TAB_RESTORE_MAX_TABS);
}

function countUrls(urls) {
  const map = new Map();
  urls.forEach((url) => {
    const current = map.get(url) || 0;
    map.set(url, current + 1);
  });
  return map;
}

function getMissingPinnedTabEntries(savedEntries, existingPinnedUrls) {
  const existing = countUrls(existingPinnedUrls);
  const missingEntries = [];
  (Array.isArray(savedEntries) ? savedEntries : []).forEach((entry) => {
    const url = entry && entry.url ? String(entry.url) : '';
    if (!url) {
      return;
    }
    const remaining = existing.get(url) || 0;
    if (remaining > 0) {
      existing.set(url, remaining - 1);
      return;
    }
    missingEntries.push(entry);
  });
  return missingEntries;
}

function getTabGroupById(groupId) {
  return new Promise((resolve) => {
    if (!chrome ||
        !chrome.tabGroups ||
        typeof chrome.tabGroups.get !== 'function' ||
        typeof groupId !== 'number') {
      resolve(null);
      return;
    }
    try {
      chrome.tabGroups.get(groupId, (group) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(group || null);
      });
    } catch (error) {
      resolve(null);
    }
  });
}

async function getPinnedTabGroupSnapshot(tab) {
  if (!isTabInGroup(tab)) {
    return null;
  }
  const group = await getTabGroupById(tab.groupId);
  const snapshot = normalizePinnedTabGroupSnapshot({
    key: `${typeof tab.windowId === 'number' ? tab.windowId : 'window'}:${tab.groupId}`,
    title: group && typeof group.title === 'string' ? group.title : '',
    color: group && typeof group.color === 'string' ? group.color : ''
  });
  return snapshot;
}

function getPinnedRestoreGroupKey(group) {
  const snapshot = normalizePinnedTabGroupSnapshot(group);
  if (!snapshot) {
    return '';
  }
  return snapshot.key || `${snapshot.title || ''}::${snapshot.color || ''}`;
}

function updateRestoredTabGroup(groupId, group) {
  return new Promise((resolve) => {
    const snapshot = normalizePinnedTabGroupSnapshot(group);
    if (!snapshot ||
        typeof groupId !== 'number' ||
        !chrome ||
        !chrome.tabGroups ||
        typeof chrome.tabGroups.update !== 'function') {
      resolve(false);
      return;
    }
    const updates = {};
    if (snapshot.title) {
      updates.title = snapshot.title;
    }
    if (snapshot.color) {
      updates.color = snapshot.color;
    }
    if (Object.keys(updates).length === 0) {
      resolve(false);
      return;
    }
    try {
      chrome.tabGroups.update(groupId, updates, () => {
        resolve(!(chrome.runtime && chrome.runtime.lastError));
      });
    } catch (error) {
      resolve(false);
    }
  });
}

function groupRestoredPinnedTab(tab, group, existingGroupId) {
  return new Promise((resolve) => {
    const snapshot = normalizePinnedTabGroupSnapshot(group);
    if (!snapshot ||
        !tab ||
        typeof tab.id !== 'number' ||
        !chrome ||
        !chrome.tabs ||
        typeof chrome.tabs.group !== 'function') {
      resolve(null);
      return;
    }
    const groupOptions = { tabIds: tab.id };
    if (typeof existingGroupId === 'number') {
      groupOptions.groupId = existingGroupId;
    }
    try {
      chrome.tabs.group(groupOptions, (groupId) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        const resolvedGroupId = typeof groupId === 'number' ? groupId : existingGroupId;
        if (typeof resolvedGroupId !== 'number') {
          resolve(null);
          return;
        }
        updateRestoredTabGroup(resolvedGroupId, snapshot)
          .catch(() => false)
          .finally(() => resolve(resolvedGroupId));
      });
    } catch (error) {
      resolve(null);
    }
  });
}

async function persistPinnedTabSnapshotNow(options) {
  if (!pinnedTabRecoveryEnabledCache) {
    return;
  }
  const opts = options && typeof options === 'object' ? options : {};
  const tabs = await queryTabsForPinnedSnapshot({ pinned: true });
  const snapshotTabs = tabs
    .filter((tab) => tab && tab.incognito !== true)
    .sort((a, b) => {
      const winA = typeof a.windowId === 'number' ? a.windowId : 0;
      const winB = typeof b.windowId === 'number' ? b.windowId : 0;
      if (winA !== winB) {
        return winA - winB;
      }
      const indexA = typeof a.index === 'number' ? a.index : 0;
      const indexB = typeof b.index === 'number' ? b.index : 0;
      return indexA - indexB;
    });
  const entries = [];
  for (let i = 0; i < snapshotTabs.length; i += 1) {
    if (entries.length >= PINNED_TAB_RESTORE_MAX_TABS) {
      break;
    }
    const tab = snapshotTabs[i];
    const url = getResolvedTabUrl(tab);
    if (!url || isRestrictedUrl(url)) {
      continue;
    }
    const entry = { url };
    const group = await getPinnedTabGroupSnapshot(tab);
    if (group) {
      entry.group = group;
    }
    entries.push(entry);
  }
  if (!entries.length && opts.skipEmptyWhenNoNormalWindows === true) {
    const normalWindowCount = await getNormalWindowCountForPinnedSnapshot();
    if (normalWindowCount <= 0) {
      return;
    }
  }
  await setPinnedSnapshotToStorage({
    version: 2,
    urls: entries.map((entry) => entry.url),
    entries,
    capturedAt: Date.now()
  });
}

function mergePinnedTabSnapshotPersistOptions(options) {
  if (!options || typeof options !== 'object') {
    return;
  }
  pinnedTabSnapshotPersistOptions = {
    skipEmptyWhenNoNormalWindows: Boolean(
      (pinnedTabSnapshotPersistOptions && pinnedTabSnapshotPersistOptions.skipEmptyWhenNoNormalWindows) ||
      options.skipEmptyWhenNoNormalWindows
    )
  };
}

function schedulePersistPinnedTabSnapshot(options) {
  if (!pinnedTabRecoveryEnabledCache) {
    if (pinnedTabSnapshotTimer !== null) {
      clearTimeout(pinnedTabSnapshotTimer);
      pinnedTabSnapshotTimer = null;
    }
    pinnedTabSnapshotPersistOptions = null;
    return;
  }
  mergePinnedTabSnapshotPersistOptions(options);
  if (pinnedTabSnapshotTimer !== null) {
    clearTimeout(pinnedTabSnapshotTimer);
  }
  pinnedTabSnapshotTimer = setTimeout(() => {
    const persistOptions = pinnedTabSnapshotPersistOptions;
    pinnedTabSnapshotPersistOptions = null;
    pinnedTabSnapshotTimer = null;
    persistPinnedTabSnapshotNow(persistOptions).catch(() => {});
  }, PINNED_TAB_SNAPSHOT_DEBOUNCE_MS);
}

async function restorePinnedTabsFromSnapshotNow() {
  const enabled = await ensurePinnedTabRecoverySettingLoaded();
  if (!enabled) {
    return;
  }
  const savedRaw = await getPinnedSnapshotFromStorage();
  const savedEntries = normalizePinnedTabSnapshot(savedRaw);
  if (!savedEntries.length) {
    return;
  }
  const currentTabs = await queryTabsForPinnedSnapshot({});
  const existingPinnedUrls = currentTabs
    .filter((tab) => tab && tab.pinned && tab.incognito !== true)
    .map((tab) => getResolvedTabUrl(tab))
    .filter((url) => Boolean(url) && !isRestrictedUrl(url));
  const missingEntries = getMissingPinnedTabEntries(savedEntries, existingPinnedUrls);
  if (!missingEntries.length) {
    return;
  }
  const targetWindowId = await getLastFocusedWindowIdForRestore();
  const restoredGroupIds = new Map();
  for (let i = 0; i < missingEntries.length && i < PINNED_TAB_RESTORE_MAX_TABS; i += 1) {
    const entry = missingEntries[i];
    const result = await createPinnedTabForRestore(entry.url, targetWindowId);
    if (!result || !result.ok || !entry.group) {
      continue;
    }
    const groupKey = getPinnedRestoreGroupKey(entry.group);
    const existingGroupId = groupKey ? restoredGroupIds.get(groupKey) : null;
    const groupId = await groupRestoredPinnedTab(result.tab, entry.group, existingGroupId);
    if (groupKey && typeof groupId === 'number') {
      restoredGroupIds.set(groupKey, groupId);
    }
  }
  setTimeout(() => {
    schedulePersistPinnedTabSnapshot();
  }, 800);
}

function restorePinnedTabsFromSnapshotOnStartup() {
  if (pinnedTabRestorePromise) {
    return pinnedTabRestorePromise;
  }
  pinnedTabRestorePromise = restorePinnedTabsFromSnapshotNow().finally(() => {
    pinnedTabRestorePromise = null;
  });
  return pinnedTabRestorePromise;
}

function getTabSwitchStat(tabId, createIfMissing) {
  if (typeof tabId !== 'number') {
    return null;
  }
  const existing = tabSwitchEventsByTabId.get(tabId);
  if (existing || !createIfMissing) {
    return existing || null;
  }
  const created = {
    events: [],
    lastSwitchAt: 0
  };
  tabSwitchEventsByTabId.set(tabId, created);
  return created;
}

function pruneTabSwitchStat(stat, now) {
  if (!stat || !Array.isArray(stat.events)) {
    return;
  }
  const minTs = now - TAB_SWITCH_WINDOW_DAY_MS;
  stat.events = stat.events.filter((ts) => typeof ts === 'number' && ts >= minTs);
  if (stat.events.length > TAB_SWITCH_EVENT_HISTORY_LIMIT) {
    stat.events = stat.events.slice(-TAB_SWITCH_EVENT_HISTORY_LIMIT);
  }
}

function recordTabSwitchEvent(tabId, at) {
  const stat = getTabSwitchStat(tabId, true);
  if (!stat) {
    return;
  }
  const now = typeof at === 'number' ? at : Date.now();
  const lastRecordedAt = Number(stat.lastSwitchAt) || 0;
  if (lastRecordedAt > 0 && Math.abs(now - lastRecordedAt) < 450) {
    return;
  }
  stat.events.push(now);
  stat.lastSwitchAt = now;
  tabSwitchEventDebugTotal += 1;
  pruneTabSwitchStat(stat, now);
  persistTabSwitchStatsNow().catch(() => {});
}

function clearTabSwitchStat(tabId) {
  if (typeof tabId !== 'number') {
    return;
  }
  tabLastAccessedByTabId.delete(tabId);
  if (tabSwitchEventsByTabId.delete(tabId)) {
    persistTabSwitchStatsNow().catch(() => {});
  }
}

function syncTabSwitchStatsFromTabList(tabs) {
  const list = Array.isArray(tabs) ? tabs : [];
  const aliveIds = new Set();
  let mostRecentTabId = null;
  let mostRecentLastAccessed = 0;
  for (let i = 0; i < list.length; i += 1) {
    const tab = list[i];
    if (!tab || typeof tab.id !== 'number') {
      continue;
    }
    const tabId = tab.id;
    aliveIds.add(tabId);
    const lastAccessed = Number(tab.lastAccessed) || 0;
    if (lastAccessed <= 0) {
      continue;
    }
    if (lastAccessed > mostRecentLastAccessed) {
      mostRecentLastAccessed = lastAccessed;
      mostRecentTabId = tabId;
    }
    const previous = Number(tabLastAccessedByTabId.get(tabId)) || 0;
    tabLastAccessedByTabId.set(tabId, lastAccessed);
    if (previous > 0 && lastAccessed > previous + 250) {
      recordTabSwitchEvent(tabId, lastAccessed);
    }
  }
  const staleIds = [];
  tabLastAccessedByTabId.forEach((_, tabId) => {
    if (!aliveIds.has(tabId)) {
      staleIds.push(tabId);
    }
  });
  staleIds.forEach((tabId) => {
    tabLastAccessedByTabId.delete(tabId);
  });
  if (typeof mostRecentTabId === 'number' && mostRecentLastAccessed > 0) {
    const existing = getTabSwitchStat(mostRecentTabId, false);
    const lastRecordedAt = Number(existing && existing.lastSwitchAt) || 0;
    if (mostRecentLastAccessed > (lastRecordedAt + 250)) {
      recordTabSwitchEvent(mostRecentTabId, mostRecentLastAccessed);
    }
  }
}

function getTabSwitchRank(tab, now) {
  const safeNow = typeof now === 'number' ? now : Date.now();
  const stat = getTabSwitchStat(tab && typeof tab.id === 'number' ? tab.id : null, false);
  if (!stat) {
    return {
      score: 0,
      shortCount: 0,
      dayCount: 0,
      highFreq: false,
      hint: '',
      lastSwitchAt: 0
    };
  }
  pruneTabSwitchStat(stat, safeNow);
  const shortBoundary = safeNow - TAB_SWITCH_WINDOW_SHORT_MS;
  const dayBoundary = safeNow - TAB_SWITCH_WINDOW_DAY_MS;
  let shortCount = 0;
  let dayCount = 0;
  for (let i = 0; i < stat.events.length; i += 1) {
    const ts = Number(stat.events[i]) || 0;
    if (ts >= dayBoundary) {
      dayCount += 1;
    }
    if (ts >= shortBoundary) {
      shortCount += 1;
    }
  }
  const lastSwitchAt = Number(stat.lastSwitchAt) || 0;
  const minutesSinceSwitch = lastSwitchAt > 0 ? (safeNow - lastSwitchAt) / 60000 : 999999;
  const recencyBoost = Math.exp(-Math.max(0, minutesSinceSwitch) / 16);
  const score = (shortCount * 8) + (dayCount * 2.6) + (recencyBoost * 3.2);
  const highFreq = shortCount >= TAB_SWITCH_HIGH_FREQ_SHORT_THRESHOLD || dayCount >= TAB_SWITCH_HIGH_FREQ_DAY_THRESHOLD;
  const hint = highFreq
    ? (shortCount >= TAB_SWITCH_HIGH_FREQ_SHORT_THRESHOLD
      ? `近30分钟切换${shortCount}次`
      : `近24小时切换${dayCount}次`)
    : '';
  return {
    score: score,
    shortCount: shortCount,
    dayCount: dayCount,
    highFreq: highFreq,
    hint: hint,
    lastSwitchAt: lastSwitchAt
  };
}

function sortTabsForOverlay(tabs) {
  const list = Array.isArray(tabs) ? tabs.slice() : [];
  const now = Date.now();
  const sortAt = now;
  return list
    .map((tab, index) => {
      const rank = getTabSwitchRank(tab, now);
      const lastAccessed = Number(tab && tab.lastAccessed) || 0;
      const idleMinutes = lastAccessed > 0 ? (now - lastAccessed) / 60000 : 999999;
      const accessBoost = Math.exp(-Math.max(0, idleMinutes) / 30);
      return {
        tab: {
          ...tab,
          _xTabRankScore: rank.score,
          _xTabSwitchCount30m: rank.shortCount,
          _xTabSwitchCount24h: rank.dayCount,
          _xTabDebugEventTotal: tabSwitchEventDebugTotal,
          _xTabLastAccessedRaw: lastAccessed,
          _xTabSortAt: sortAt,
          _xTabRankHighFreq: rank.highFreq,
          _xTabRankHint: rank.hint
        },
        score: rank.score + accessBoost,
        lastAccessed: lastAccessed,
        index: index
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (b.lastAccessed !== a.lastAccessed) {
        return b.lastAccessed - a.lastAccessed;
      }
      return a.index - b.index;
    })
    .map((item) => item.tab);
}

function createOverlayTabPayload(tab, fetchSeq) {
  return {
    id: tab.id,
    title: typeof tab.title === 'string' ? tab.title : '',
    url: typeof tab.url === 'string' ? tab.url : '',
    favIconUrl: typeof tab.favIconUrl === 'string' ? tab.favIconUrl : '',
    _xTabRankScore: tab._xTabRankScore,
    _xTabSwitchCount30m: tab._xTabSwitchCount30m,
    _xTabSwitchCount24h: tab._xTabSwitchCount24h,
    _xTabDebugEventTotal: tab._xTabDebugEventTotal,
    _xTabLastAccessedRaw: tab._xTabLastAccessedRaw,
    _xTabSortAt: tab._xTabSortAt,
    _xTabRankHighFreq: tab._xTabRankHighFreq,
    _xTabRankHint: tab._xTabRankHint,
    _xTabFetchSeq: fetchSeq
  };
}

if (storageArea) {
  storageArea.get([
    RESTRICTED_ACTION_STORAGE_KEY,
    RESTRICTED_ACTION_AUTO_BROWSER_SETTING_DONE_STORAGE_KEY,
    DOCUMENT_PIP_ENABLED_STORAGE_KEY,
    TAB_SWITCHER_ENABLED_STORAGE_KEY,
    PINNED_TAB_RECOVERY_ENABLED_STORAGE_KEY
  ], (result) => {
    const stored = result[RESTRICTED_ACTION_STORAGE_KEY];
    const normalized = stored === 'none' ? 'none' : 'default';
    if (normalized !== stored) {
      storageArea.set({ [RESTRICTED_ACTION_STORAGE_KEY]: normalized });
    }
    restrictedActionCache = normalized;
    restrictedActionAutoBrowserSettingDoneCache = result[RESTRICTED_ACTION_AUTO_BROWSER_SETTING_DONE_STORAGE_KEY] === true;
    const documentPipStored = result[DOCUMENT_PIP_ENABLED_STORAGE_KEY];
    const normalizedDocumentPip = documentPipStored === true;
    if (documentPipStored !== normalizedDocumentPip) {
      storageArea.set({ [DOCUMENT_PIP_ENABLED_STORAGE_KEY]: normalizedDocumentPip });
    }
    documentPipEnabledCache = normalizedDocumentPip;
    const tabSwitcherStored = result[TAB_SWITCHER_ENABLED_STORAGE_KEY];
    const normalizedTabSwitcher = normalizeTabSwitcherEnabled(tabSwitcherStored);
    if (tabSwitcherStored !== normalizedTabSwitcher) {
      storageArea.set({ [TAB_SWITCHER_ENABLED_STORAGE_KEY]: normalizedTabSwitcher });
    }
    tabSwitcherEnabledCache = normalizedTabSwitcher;
    const pinnedTabRecoveryStored = result[PINNED_TAB_RECOVERY_ENABLED_STORAGE_KEY];
    applyPinnedTabRecoverySetting(pinnedTabRecoveryStored);
  });
}

function migrateStorageIfNeeded(keys) {
  if (!storageArea || !chrome || !chrome.storage || !chrome.storage.local) {
    return;
  }
  if (storageArea === chrome.storage.local) {
    return;
  }
  chrome.storage.local.get(keys, (localResult) => {
    const hasLocal = keys.some((key) => typeof localResult[key] !== 'undefined');
    if (!hasLocal) {
      return;
    }
    storageArea.get(keys, (syncResult) => {
      const missingSyncValues = {};
      keys.forEach((key) => {
        if (typeof localResult[key] !== 'undefined' && typeof syncResult[key] === 'undefined') {
          missingSyncValues[key] = localResult[key];
        }
      });
      const missingKeys = Object.keys(missingSyncValues);
      if (missingKeys.length === 0) {
        return;
      }
      storageArea.get(missingKeys, (latestSyncResult) => {
        const stillMissingSyncValues = {};
        missingKeys.forEach((key) => {
          if (typeof latestSyncResult[key] === 'undefined') {
            stillMissingSyncValues[key] = missingSyncValues[key];
          }
        });
        if (Object.keys(stillMissingSyncValues).length > 0) {
          storageArea.set(stillMissingSyncValues);
        }
      });
    });
  });
}

function shouldIgnoreDuplicateHotkey(tabId) {
  if (typeof tabId !== 'number') {
    return false;
  }
  const now = Date.now();
  const lastAt = hotkeyInvokeAtByTabId.get(tabId) || 0;
  hotkeyInvokeAtByTabId.set(tabId, now);
  return (now - lastAt) <= HOTKEY_DUP_GUARD_MS;
}

function finishOverlayOpening(opening) {
  if (!opening || typeof opening.tabId !== 'number') {
    return;
  }
  if (opening.timer) {
    clearTimeout(opening.timer);
    opening.timer = null;
  }
  if (overlayOpeningByTabId.get(opening.tabId) === opening) {
    overlayOpeningByTabId.delete(opening.tabId);
  }
}

function beginOverlayOpening(tab, source) {
  if (!tab || typeof tab.id !== 'number') {
    return null;
  }
  const existing = overlayOpeningByTabId.get(tab.id);
  if (existing) {
    logHotkeyDebug('overlay-opening-guarded', {
      tabId: tab.id,
      source: source || '',
      age: Date.now() - existing.startedAt
    });
    return null;
  }
  const opening = {
    tabId: tab.id,
    source: source || '',
    startedAt: Date.now(),
    timer: null
  };
  opening.timer = setTimeout(() => {
    finishOverlayOpening(opening);
  }, OVERLAY_OPENING_GUARD_MS);
  overlayOpeningByTabId.set(tab.id, opening);
  return opening;
}

function rememberPageHotkeyContext(tab) {
  if (!tab || typeof tab.id !== 'number' || typeof tab.windowId !== 'number') {
    lastPageHotkeyContext = null;
    return;
  }
  lastPageHotkeyContext = {
    at: Date.now(),
    tabId: tab.id,
    windowId: tab.windowId
  };
}

function getRecentPageHotkeyContext(windowId) {
  if (!lastPageHotkeyContext) {
    return null;
  }
  const age = Date.now() - Number(lastPageHotkeyContext.at || 0);
  if (age > PAGE_HOTKEY_NEWTAB_RECOVER_MS) {
    lastPageHotkeyContext = null;
    return null;
  }
  if (typeof windowId === 'number' && lastPageHotkeyContext.windowId !== windowId) {
    return null;
  }
  return lastPageHotkeyContext;
}

function clearRecentPageHotkeyContext() {
  lastPageHotkeyContext = null;
}

function buildPrefillQueryForCurrentPage(tab) {
  return getResolvedTabUrl(tab);
}

function getOverlayPrefillQueryForSource(tab, source) {
  if (source !== 'page-hotkey-prefill' && source !== 'commands-prefill') {
    return '';
  }
  return buildPrefillQueryForCurrentPage(tab);
}

function recoverFromPageHotkeyNewtab(newTabId, windowId) {
  const recentContext = getRecentPageHotkeyContext(windowId);
  if (!recentContext || typeof newTabId !== 'number') {
    return;
  }
  chrome.tabs.query({ windowId: recentContext.windowId }, (tabs) => {
    const tabList = Array.isArray(tabs) ? tabs : [];
    const newTab = tabList.find((item) => item && item.id === newTabId) || null;
    const sourceTab = tabList.find((item) => item && item.id === recentContext.tabId) || null;
    const newTabUrl = getResolvedTabUrl(newTab);
    if (!newTab || (!isLumnoNewtabUrl(newTabUrl) && !isBrowserNewtabUrl(newTabUrl))) {
      return;
    }
    if (!sourceTab || !canOpenOverlayOnUrl(getResolvedTabUrl(sourceTab))) {
      clearRecentPageHotkeyContext();
      return;
    }
    clearRecentPageHotkeyContext();
    logHotkeyDebug('page-hotkey-newtab-recover-start', {
      windowId: recentContext.windowId,
      sourceTabId: sourceTab.id,
      newTabId: newTab.id,
      sourceUrl: getResolvedTabUrl(sourceTab),
      newTabUrl: newTabUrl
    });
    chrome.tabs.update(sourceTab.id, { active: true }, () => {
      if (chrome.runtime && chrome.runtime.lastError) {
        logHotkeyDebug('page-hotkey-newtab-recover-failed', {
          step: 'activate-source',
          sourceTabId: sourceTab.id,
          error: chrome.runtime.lastError.message || 'unknown'
        });
        return;
      }
      chrome.tabs.remove(newTab.id, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          logHotkeyDebug('page-hotkey-newtab-close-failed', {
            newTabId: newTab.id,
            error: chrome.runtime.lastError.message || 'unknown'
          });
        }
      });
    });
  });
}

function recordRecentSwitcherTab(tab, at) {
  if (!recentTabTracker || typeof recentTabTracker.recordTab !== 'function') {
    return null;
  }
  const snapshot = recentTabTracker.recordTab(tab, at);
  if (snapshot) {
    schedulePersistTabSwitcherState();
  }
  return snapshot;
}

function updateRecentSwitcherTab(tab, at) {
  if (!recentTabTracker || typeof recentTabTracker.updateTab !== 'function') {
    return null;
  }
  const snapshot = recentTabTracker.updateTab(tab, at);
  if (snapshot) {
    schedulePersistTabSwitcherState();
  }
  return snapshot;
}

function removeRecentSwitcherTab(tabId) {
  if (!recentTabTracker || typeof recentTabTracker.removeTab !== 'function') {
    clearSwitcherThumbnailPriority(tabId);
    return;
  }
  clearSwitcherThumbnailPriority(tabId);
  if (recentTabTracker.removeTab(tabId)) {
    schedulePersistTabSwitcherState();
  }
}

function getSwitcherThumbnailForTab(tabId, url) {
  if (!recentTabTracker || typeof recentTabTracker.getThumbnail !== 'function') {
    return '';
  }
  return recentTabTracker.getThumbnail(tabId, url);
}

function getSwitcherThumbnailStateForTab(tabId, url) {
  if (recentTabTracker && typeof recentTabTracker.getThumbnailState === 'function') {
    return recentTabTracker.getThumbnailState(tabId, url);
  }
  const dataUrl = getSwitcherThumbnailForTab(tabId, url);
  return {
    status: dataUrl ? 'ok' : 'missing',
    reason: '',
    dataUrl,
    capturedAt: 0,
    updatedAt: 0
  };
}

function getSwitcherThumbnailStateForPayload(tab, url) {
  const status = typeof tab._xSwitcherThumbnailStatus === 'string' ? tab._xSwitcherThumbnailStatus : '';
  if (status) {
    return {
      status,
      reason: typeof tab._xSwitcherThumbnailReason === 'string' ? tab._xSwitcherThumbnailReason : '',
      dataUrl: typeof tab._xSwitcherThumbnail === 'string' ? tab._xSwitcherThumbnail : '',
      capturedAt: 0,
      updatedAt: 0
    };
  }
  return getSwitcherThumbnailStateForTab(tab.id, url);
}

function isSwitcherThumbnailRefreshNeeded(state) {
  const status = String(state && state.status ? state.status : '').trim().toLowerCase();
  if (status === 'restricted' || status === 'pending') {
    return false;
  }
  if (status === 'missing' || status === 'stale' || status === 'failed') {
    return true;
  }
  if (status === 'ok') {
    return !(state && typeof state.dataUrl === 'string' && state.dataUrl.startsWith('data:image/'));
  }
  return !status;
}

function shouldPreCaptureActiveSwitcherThumbnailBeforePayload(tab) {
  const isActive = tab && tab.active === true;
  if (!isActive || tab.status === 'loading' || !canCaptureSwitcherThumbnail(tab)) {
    return false;
  }
  const state = getSwitcherThumbnailStateForPayload(tab, getResolvedTabUrl(tab));
  return isSwitcherThumbnailRefreshNeeded(state);
}

function findSwitcherTabById(tabList, tabId) {
  if (typeof tabId !== 'number') {
    return null;
  }
  return (Array.isArray(tabList) ? tabList : []).find((tab) =>
    tab && typeof tab.id === 'number' && tab.id === tabId
  ) || null;
}

function markSwitcherThumbnailPriorityForItems(items, tabList, reason) {
  if (!Array.isArray(items) || !items.length) {
    return;
  }
  items.forEach((item) => {
    if (!item || typeof item.id !== 'number') {
      return;
    }
    if (!isSwitcherThumbnailRefreshNeeded({
      status: item.thumbnailStatus,
      dataUrl: item.thumbnail
    })) {
      return;
    }
    const tab = findSwitcherTabById(tabList, item.id) || item;
    if (!canCaptureSwitcherThumbnail(tab)) {
      return;
    }
    tabSwitcherThumbnailPriorityByTabId.set(item.id, {
      url: getResolvedTabUrl(tab) || item.url || '',
      status: item.thumbnailStatus || 'missing',
      reason: reason || '',
      markedAt: Date.now()
    });
  });
}

function clearSwitcherThumbnailPriority(tabId) {
  if (typeof tabId !== 'number') {
    return;
  }
  tabSwitcherThumbnailPriorityByTabId.delete(tabId);
}

function consumeSwitcherThumbnailPriority(tab, reason) {
  const tabId = tab && typeof tab.id === 'number' ? tab.id : null;
  if (typeof tabId !== 'number') {
    return false;
  }
  const entry = tabSwitcherThumbnailPriorityByTabId.get(tabId);
  if (!entry) {
    return false;
  }
  const url = getResolvedTabUrl(tab);
  if (entry.url && url && entry.url !== url) {
    clearSwitcherThumbnailPriority(tabId);
    return false;
  }
  const state = getSwitcherThumbnailStateForTab(tabId, url);
  if (!isSwitcherThumbnailRefreshNeeded(state)) {
    clearSwitcherThumbnailPriority(tabId);
    return false;
  }
  clearSwitcherThumbnailPriority(tabId);
  logHotkeyDebug('tab-switcher-thumbnail-priority-consumed', {
    tabId,
    url,
    reason: reason || '',
    markedReason: entry.reason || '',
    status: entry.status || ''
  });
  return true;
}

function markSwitcherThumbnailStatus(tab, status, requestReason, failureReason) {
  if (!recentTabTracker || typeof recentTabTracker.setThumbnailStatus !== 'function') {
    return false;
  }
  if (!tab || typeof tab.id !== 'number') {
    return false;
  }
  const didSet = recentTabTracker.setThumbnailStatus(tab.id, status, Date.now(), {
    url: getResolvedTabUrl(tab),
    reason: failureReason || requestReason || ''
  });
  if (didSet) {
    schedulePersistTabSwitcherState();
  }
  return didSet;
}

function isPageVisibleSafeFaviconUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) {
    return false;
  }
  if (raw.startsWith('data:image/')) {
    return true;
  }
  try {
    const parsed = new URL(raw);
    const protocol = String(parsed.protocol || '').toLowerCase();
    if (protocol === 'http:' || protocol === 'https:') {
      return true;
    }
    return protocol === 'chrome-extension:' &&
      chrome &&
      chrome.runtime &&
      String(parsed.hostname || '') === String(chrome.runtime.id || '');
  } catch (error) {
    return false;
  }
}

function buildSwitcherTabFavicon(tab, url) {
  const resolved = String(url || getResolvedTabUrl(tab) || '').trim();
  const candidate = getPageFaviconCandidateUrl(resolved);
  if (candidate) {
    return candidate;
  }
  const fallback = typeof tab.favIconUrl === 'string' ? tab.favIconUrl.trim() : '';
  return isPageVisibleSafeFaviconUrl(fallback) ? fallback : '';
}

function getSwitcherRegistrableThemeHost(host) {
  const normalizedHost = normalizeFaviconHost(host);
  if (!normalizedHost ||
      normalizedHost === 'localhost' ||
      normalizedHost.endsWith('.localhost') ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(normalizedHost) ||
      normalizedHost.includes(':')) {
    return normalizedHost;
  }
  const labels = normalizedHost.split('.').filter(Boolean);
  if (labels.length <= 2) {
    return normalizedHost;
  }
  const suffix = labels.slice(-2).join('.');
  const multipartSuffixes = new Set([
    'co.uk',
    'com.au',
    'com.br',
    'com.cn',
    'com.hk',
    'com.sg',
    'co.jp',
    'co.kr',
    'co.nz',
    'com.tw',
    'org.uk',
    'net.au'
  ]);
  const tailLength = multipartSuffixes.has(suffix) && labels.length >= 3 ? 3 : 2;
  return labels.slice(-tailLength).join('.');
}

function getSwitcherThemeHostCandidates(host) {
  const normalizedHost = normalizeFaviconHost(host);
  const candidates = [];
  const addCandidate = (candidate) => {
    const normalized = normalizeFaviconHost(candidate);
    if (normalized && !candidates.includes(normalized)) {
      candidates.push(normalized);
    }
  };
  const sharedHost = getSwitcherRegistrableThemeHost(normalizedHost);
  addCandidate(sharedHost);
  if (normalizedHost === 'app.dodopayments.com' ||
      normalizedHost === 'customer.dodopayments.com' ||
      normalizedHost === 'checkout.dodopayments.com') {
    addCandidate('dodopayments.com');
  }
  addCandidate(normalizedHost);
  return candidates;
}

function getCachedSiteThemeColorForSwitcher(host, origin) {
  const normalizedHost = normalizeFaviconHost(host);
  const normalizedOrigin = String(origin || '').trim();
  if (!normalizedHost) {
    return null;
  }
  const candidateHosts = getSwitcherThemeHostCandidates(normalizedHost);
  for (const candidateHost of candidateHosts) {
    const exactKey = `${candidateHost}::${normalizedOrigin}::auto`;
    const exact = normalizedOrigin ? siteThemeColorCache.get(exactKey) : null;
    if (exact && normalizeThemeAccentRgb(exact.accentRgb)) {
      return exact;
    }
  }
  for (const [key, value] of siteThemeColorCache.entries()) {
    if (!value || !normalizeThemeAccentRgb(value.accentRgb)) {
      continue;
    }
    const cachedHost = normalizeFaviconHost(String(key || '').split('::')[0]);
    if (!cachedHost) {
      continue;
    }
    if (candidateHosts.some((candidateHost) =>
      cachedHost === candidateHost ||
        cachedHost.endsWith(`.${candidateHost}`)
    )) {
      return value;
    }
  }
  return null;
}

function getPersistedSiteThemeColorForSwitcher(host) {
  const runtime = getBackgroundFaviconCacheRuntime();
  if (!runtime || typeof runtime.getPersistedThemeEntry !== 'function') {
    return null;
  }
  const candidateHosts = getSwitcherThemeHostCandidates(host);
  for (const candidateHost of candidateHosts) {
    const entry = runtime.getPersistedThemeEntry(candidateHost);
    const accentRgb = normalizeThemeAccentRgb(entry && entry.accentRgb);
    if (accentRgb) {
      return {
        accentRgb,
        source: entry.source || 'cache',
        neutral: entry.neutral === true,
        confidence: entry.confidence || getThemeColorConfidence(accentRgb)
      };
    }
  }
  return null;
}

function persistSiteThemeColorForSwitcher(host, result) {
  const runtime = getBackgroundFaviconCacheRuntime();
  const accentRgb = normalizeThemeAccentRgb(result && result.accentRgb);
  if (!runtime ||
      typeof runtime.setPersistedThemeEntry !== 'function' ||
      !host ||
      !accentRgb) {
    return false;
  }
  return runtime.setPersistedThemeEntry(host, {
    accentRgb,
    source: result.source || 'meta',
    neutral: result.neutral === true,
    confidence: result.confidence || getThemeColorConfidence(accentRgb)
  });
}

function getNewtabBrandAccentForSwitcher(host, url) {
  const normalizedHost = normalizeFaviconHost(host);
  let accentRgb = null;
  if (normalizedHost && typeof NEWTAB_FAVICON_THEME.getBrandAccentForHost === 'function') {
    accentRgb = NEWTAB_FAVICON_THEME.getBrandAccentForHost(normalizedHost);
  }
  if (!accentRgb && typeof NEWTAB_FAVICON_THEME.getBrandAccentForUrl === 'function') {
    accentRgb = NEWTAB_FAVICON_THEME.getBrandAccentForUrl(url);
  }
  return normalizeThemeAccentRgb(accentRgb);
}

function normalizeSwitcherAccentRgbForPayload(accentRgb) {
  const rgb = normalizeThemeAccentRgb(accentRgb);
  if (!rgb) {
    return null;
  }
  if (getThemeColorConfidence(rgb) === 'neutral') {
    return normalizeThemeAccentRgb(NEWTAB_FAVICON_THEME.defaultAccentColor) || [59, 130, 246];
  }
  return rgb;
}

function warmSwitcherTabThemeColor(host, url) {
  const normalizedHost = normalizeFaviconHost(host);
  const resolved = String(url || '').trim();
  if (!normalizedHost || !resolved) {
    return;
  }
  let parsed = null;
  try {
    parsed = new URL(resolved);
  } catch (error) {
    return;
  }
  if (!/^https?:$/i.test(parsed.protocol) ||
      shouldBlockFaviconForHost(parsed.hostname) ||
      shouldBlockFaviconForHost(normalizedHost)) {
    return;
  }
  const cacheKey = `${normalizedHost}::${parsed.origin}::auto`;
  if (siteThemeColorCache.has(cacheKey) || siteThemeColorPending.has(cacheKey)) {
    return;
  }
  if (switcherThemeColorWarmups.has(cacheKey)) {
    return;
  }
  switcherThemeColorWarmups.add(cacheKey);
  resolveSiteThemeColor(resolved, normalizedHost, '')
    .then((result) => {
      const accentRgb = normalizeThemeAccentRgb(result && result.accentRgb);
      const sharedHost = getSwitcherRegistrableThemeHost(normalizedHost);
      if (accentRgb && sharedHost && sharedHost !== normalizedHost) {
        const sharedKey = `${sharedHost}::${parsed.origin}::auto`;
        setBoundedBackgroundCacheEntry(
          siteThemeColorCache,
          sharedKey,
          result,
          BACKGROUND_SITE_THEME_CACHE_MAX_ENTRIES
        );
        persistSiteThemeColorForSwitcher(sharedHost, result);
      }
    })
    .catch(() => null)
    .finally(() => {
      switcherThemeColorWarmups.delete(cacheKey);
    });
}

function getSwitcherTabAccentRgb(tab, url) {
  const resolved = String(url || getResolvedTabUrl(tab) || '').trim();
  if (!resolved) {
    return null;
  }
  let parsed = null;
  try {
    parsed = new URL(resolved);
  } catch (error) {
    return null;
  }
  if (!/^https?:$/i.test(parsed.protocol) || shouldBlockFaviconForHost(parsed.hostname)) {
    return null;
  }
  const host = normalizeFaviconHost(parsed.hostname);
  const brandAccent = getNewtabBrandAccentForSwitcher(host, resolved);
  warmSwitcherTabThemeColor(host, resolved);
  if (brandAccent) {
    return brandAccent;
  }
  const cached = getCachedSiteThemeColorForSwitcher(host, parsed.origin) ||
    getPersistedSiteThemeColorForSwitcher(host);
  return normalizeSwitcherAccentRgbForPayload(cached && cached.accentRgb);
}

async function prepareSwitcherThumbnailDataUrl(dataUrl) {
  const source = typeof dataUrl === 'string' ? dataUrl : '';
  if (!source.startsWith('data:image/')) {
    return '';
  }
  if (typeof OffscreenCanvas !== 'function' ||
      typeof createImageBitmap !== 'function' ||
      typeof fetch !== 'function') {
    return source;
  }
  try {
    const response = await fetch(source);
    const blob = response && typeof response.blob === 'function' ? await response.blob() : null;
    if (!blob) {
      return source;
    }
    const bitmap = await createImageBitmap(blob);
    const sourceWidth = Math.max(1, bitmap.width || 1);
    const sourceHeight = Math.max(1, bitmap.height || 1);
    const targetRatio = TAB_SWITCHER_THUMBNAIL_TARGET_WIDTH / TAB_SWITCHER_THUMBNAIL_TARGET_HEIGHT;
    const sourceRatio = sourceWidth / sourceHeight;
    let cropX = 0;
    let cropY = 0;
    let cropWidth = sourceWidth;
    let cropHeight = sourceHeight;
    if (sourceRatio > targetRatio) {
      cropWidth = Math.max(1, Math.round(sourceHeight * targetRatio));
      cropX = Math.max(0, Math.round((sourceWidth - cropWidth) / 2));
    } else if (sourceRatio < targetRatio) {
      cropHeight = Math.max(1, Math.round(sourceWidth / targetRatio));
    }
    const canvas = new OffscreenCanvas(TAB_SWITCHER_THUMBNAIL_TARGET_WIDTH, TAB_SWITCHER_THUMBNAIL_TARGET_HEIGHT);
    const context = canvas.getContext('2d');
    if (!context) {
      if (typeof bitmap.close === 'function') {
        bitmap.close();
      }
      return source;
    }
    context.drawImage(
      bitmap,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      TAB_SWITCHER_THUMBNAIL_TARGET_WIDTH,
      TAB_SWITCHER_THUMBNAIL_TARGET_HEIGHT
    );
    if (typeof bitmap.close === 'function') {
      bitmap.close();
    }
    const outputBlob = await canvas.convertToBlob({
      type: 'image/webp',
      quality: 0.68
    });
    const buffer = await outputBlob.arrayBuffer();
    return `data:${outputBlob.type || 'image/webp'};base64,${arrayBufferToBase64(buffer)}`;
  } catch (error) {
    return source;
  }
}

function canCaptureSwitcherThumbnail(tab) {
  return getSwitcherThumbnailCaptureFailureReason(tab) === '';
}

function getSwitcherThumbnailCaptureFailureReason(tab) {
  if (!tab || typeof tab.id !== 'number' || typeof tab.windowId !== 'number') {
    return 'invalid-tab';
  }
  if (!shouldTrackSwitcherTab(tab)) {
    return 'untracked-tab';
  }
  const url = getResolvedTabUrl(tab);
  try {
    const parsed = new URL(url);
    const protocol = String(parsed.protocol || '').toLowerCase();
    if (!protocol || protocol === 'javascript:') {
      return 'unsupported-protocol';
    }
    return '';
  } catch (error) {
    return 'invalid-url';
  }
}

function logSwitcherThumbnailCaptureFailure(tab, failureReason, requestReason) {
  markSwitcherThumbnailStatus(tab, getSwitcherThumbnailStatusForFailureReason(failureReason), requestReason, failureReason);
  logHotkeyDebug('tab-switcher-thumbnail-failed', {
    tabId: tab && typeof tab.id === 'number' ? tab.id : null,
    windowId: tab && typeof tab.windowId === 'number' ? tab.windowId : null,
    url: getResolvedTabUrl(tab),
    reason: failureReason || 'unknown',
    requestReason: requestReason || ''
  });
}

function getSwitcherThumbnailStatusForFailureReason(reason) {
  const text = String(reason || '').toLowerCase();
  if (text.includes('restricted') ||
      text.includes('permission') ||
      text.includes('not allowed') ||
      text.includes('not permitted') ||
      text.includes('cannot access') ||
      text.includes('chrome://') ||
      text.includes('web store') ||
      text.includes('unsupported-protocol') ||
      text.includes('untracked-tab')) {
    return 'restricted';
  }
  return 'failed';
}

function logSwitcherThumbnailCaptureSuccess(tab, requestReason) {
  logHotkeyDebug('tab-switcher-thumbnail-captured', {
    tabId: tab && typeof tab.id === 'number' ? tab.id : null,
    windowId: tab && typeof tab.windowId === 'number' ? tab.windowId : null,
    url: getResolvedTabUrl(tab),
    requestReason: requestReason || ''
  });
}

function waitForSwitcherThumbnailCaptureSlot() {
  const sinceLast = Date.now() - tabSwitcherLastCaptureAt;
  const waitMs = Math.max(0, TAB_SWITCHER_CAPTURE_MIN_INTERVAL_MS - sinceLast);
  if (waitMs <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    setTimeout(resolve, waitMs);
  });
}

function clearScheduledSwitcherThumbnailCapture(tabId) {
  if (typeof tabId !== 'number') {
    return;
  }
  const timer = tabSwitcherThumbnailTimersByTabId.get(tabId);
  if (timer !== undefined) {
    clearTimeout(timer);
    tabSwitcherThumbnailTimersByTabId.delete(tabId);
  }
}

function enqueueSwitcherThumbnailCapture(tab, reason) {
  markSwitcherThumbnailStatus(tab, 'pending', reason, '');
  const runCapture = () => waitForSwitcherThumbnailCaptureSlot()
    .then(() => captureSwitcherThumbnailForTab(tab, reason));
  const queued = tabSwitcherThumbnailCaptureChain
    .catch(() => false)
    .then(runCapture);
  tabSwitcherThumbnailCaptureChain = queued.catch(() => false);
  return queued;
}

function isTabSwitcherOpeningForCapture(tab) {
  const key = getTabSwitcherOpeningWindowKey(tab);
  if (!key) {
    return false;
  }
  const opening = tabSwitcherOpeningByWindowKey.get(key);
  return Boolean(opening && opening.expiresAt > Date.now());
}

function isSwitcherCommandCaptureReason(reason) {
  const requestReason = String(reason || '');
  return requestReason === TAB_SWITCHER_CAPTURE_REASON_COMMAND_IMMEDIATE;
}

function shouldSkipSwitcherThumbnailCaptureForOpenSwitcher(tab, reason) {
  if (isSwitcherCommandCaptureReason(reason)) {
    return Promise.resolve(false);
  }
  if (isTabSwitcherOpeningForCapture(tab)) {
    return Promise.resolve(true);
  }
  return getOpenTabSwitcherState(tab)
    .then((state) => Boolean(state && state.open === true))
    .catch(() => false);
}

function captureSwitcherThumbnailForTab(tab, reason) {
  const tabId = tab && typeof tab.id === 'number' ? tab.id : null;
  const windowId = tab && typeof tab.windowId === 'number' ? tab.windowId : null;
  clearScheduledSwitcherThumbnailCapture(tabId);
  if (typeof tabId !== 'number' || typeof windowId !== 'number') {
    logSwitcherThumbnailCaptureFailure(tab, 'invalid-tab', reason);
    return Promise.resolve(false);
  }
  if (!chrome || !chrome.tabs || typeof chrome.tabs.captureVisibleTab !== 'function') {
    logSwitcherThumbnailCaptureFailure(tab, 'capture-api-unavailable', reason);
    return Promise.resolve(false);
  }
  const captureResolvedTab = (resolvedTab) => new Promise((resolve) => {
    const failureReason = getSwitcherThumbnailCaptureFailureReason(resolvedTab);
    if (failureReason) {
      logSwitcherThumbnailCaptureFailure(resolvedTab || tab, failureReason, reason);
      resolve(false);
      return;
    }
    if (!resolvedTab || resolvedTab.active !== true) {
      logSwitcherThumbnailCaptureFailure(resolvedTab || tab, 'inactive-tab', reason);
      resolve(false);
      return;
    }
    shouldSkipSwitcherThumbnailCaptureForOpenSwitcher(resolvedTab, reason).then((shouldSkip) => {
      if (shouldSkip) {
        logSwitcherThumbnailCaptureFailure(resolvedTab, 'tab-switcher-open', reason);
        resolve(false);
        return;
      }
      tabSwitcherLastCaptureAt = Date.now();
      withTabSwitcherHiddenForCapture(resolvedTab, () => new Promise((captureResolve) => {
        try {
          chrome.tabs.captureVisibleTab(windowId, {
            format: 'jpeg',
            quality: TAB_SWITCHER_CAPTURE_JPEG_QUALITY
          }, (dataUrl) => {
            if (chrome.runtime && chrome.runtime.lastError) {
              captureResolve({
                ok: false,
                reason: chrome.runtime.lastError.message || 'capture-visible-tab-failed'
              });
              return;
            }
            captureResolve({
              ok: true,
              dataUrl
            });
          });
        } catch (error) {
          captureResolve({
            ok: false,
            reason: error && error.message ? error.message : 'capture-visible-tab-threw'
          });
        }
      })).then((captureResult) => {
        if (!captureResult || captureResult.ok !== true) {
          logSwitcherThumbnailCaptureFailure(
            resolvedTab,
            captureResult && captureResult.reason ? captureResult.reason : 'capture-visible-tab-failed',
            reason
          );
          resolve(false);
          return;
        }
        prepareSwitcherThumbnailDataUrl(captureResult.dataUrl).then((thumbnailDataUrl) => {
          if (!thumbnailDataUrl || !recentTabTracker || typeof recentTabTracker.setThumbnail !== 'function') {
            logSwitcherThumbnailCaptureFailure(resolvedTab, 'empty-thumbnail-data', reason);
            resolve(false);
            return;
          }
          const didSet = recentTabTracker.setThumbnail(resolvedTab.id, thumbnailDataUrl, Date.now(), {
            url: getResolvedTabUrl(resolvedTab)
          });
          if (didSet) {
            schedulePersistTabSwitcherState();
            if (isSwitcherCommandCaptureReason(reason)) {
              postTabSwitcherThumbnailUpdate(resolvedTab, {
                tabId: resolvedTab.id,
                url: getResolvedTabUrl(resolvedTab),
                thumbnail: thumbnailDataUrl,
                thumbnailStatus: 'ok',
                thumbnailReason: ''
              }).catch(() => {});
            }
            logSwitcherThumbnailCaptureSuccess(resolvedTab, reason);
          } else {
            logSwitcherThumbnailCaptureFailure(resolvedTab, 'thumbnail-cache-rejected', reason);
          }
          resolve(Boolean(didSet));
        }).catch(() => {
          logSwitcherThumbnailCaptureFailure(resolvedTab, 'prepare-thumbnail-failed', reason);
          resolve(false);
        });
      }).catch(() => {
        logSwitcherThumbnailCaptureFailure(resolvedTab, 'capture-visible-tab-failed', reason);
        resolve(false);
      });
    }).catch(() => {
      logSwitcherThumbnailCaptureFailure(resolvedTab, 'tab-switcher-open-state-failed', reason);
      resolve(false);
    });
  });
  if (typeof chrome.tabs.get !== 'function') {
    return captureResolvedTab(tab);
  }
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (freshTab) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        logSwitcherThumbnailCaptureFailure(tab, chrome.runtime.lastError.message || 'tabs-get-failed', reason);
        resolve(false);
        return;
      }
      captureResolvedTab(freshTab || tab).then(resolve).catch(() => {
        resolve(false);
      });
    });
  });
}

function captureSwitcherThumbnailNow(request) {
  const tabId = request && typeof request.tabId === 'number' ? request.tabId : null;
  const windowId = request && typeof request.windowId === 'number' ? request.windowId : null;
  if (typeof tabId !== 'number' || typeof windowId !== 'number') {
    return;
  }
  captureSwitcherThumbnailForTab({
    id: tabId,
    windowId
  }, request && request.reason).catch(() => {});
}

function scheduleSwitcherThumbnailCapture(tab, reason) {
  if (!canCaptureSwitcherThumbnail(tab)) {
    logSwitcherThumbnailCaptureFailure(tab, getSwitcherThumbnailCaptureFailureReason(tab), reason);
    return;
  }
  if (!chrome || !chrome.tabs || typeof chrome.tabs.captureVisibleTab !== 'function') {
    logSwitcherThumbnailCaptureFailure(tab, 'capture-api-unavailable', reason);
    return;
  }
  const hasPriority = consumeSwitcherThumbnailPriority(tab, reason);
  reason = hasPriority ? `priority-${reason || 'visible'}` : reason;
  clearScheduledSwitcherThumbnailCapture(tab.id);
  markSwitcherThumbnailStatus(tab, 'pending', reason, '');
  const now = Date.now();
  const delay = hasPriority ? TAB_SWITCHER_PRIORITY_CAPTURE_DELAY_MS : TAB_SWITCHER_CAPTURE_DELAY_MS;
  const request = {
    tabId: tab.id,
    windowId: tab.windowId,
    reason: reason || '',
    requestedAt: now
  };
  const timer = setTimeout(() => {
    tabSwitcherThumbnailTimersByTabId.delete(tab.id);
    enqueueSwitcherThumbnailCapture({
      id: request.tabId,
      windowId: request.windowId
    }, request.reason).catch(() => {});
  }, delay);
  tabSwitcherThumbnailTimersByTabId.set(tab.id, timer);
}

function normalizeSwitcherTabForPayload(tab, currentTabId) {
  if (!tab || typeof tab.id !== 'number') {
    return null;
  }
  const url = getResolvedTabUrl(tab);
  if (!url) {
    return null;
  }
  const thumbnailState = getSwitcherThumbnailStateForPayload(tab, url);
  return {
    id: tab.id,
    windowId: typeof tab.windowId === 'number' ? tab.windowId : null,
    url,
    title: String(tab.title || '').replace(/\s+/g, ' ').trim() || url,
    favIconUrl: buildSwitcherTabFavicon(tab, url),
    accentRgb: getSwitcherTabAccentRgb(tab, url),
    active: Boolean(tab.active),
    pinned: Boolean(tab.pinned),
    current: typeof currentTabId === 'number' && tab.id === currentTabId,
    thumbnail: thumbnailState.dataUrl,
    thumbnailStatus: thumbnailState.status,
    thumbnailReason: thumbnailState.reason
  };
}

function getRecentTabsForSwitcher(tabList, currentTabId) {
  const normalizedTabs = (Array.isArray(tabList) ? tabList : [])
    .map((tab) => ({
      ...tab,
      url: getResolvedTabUrl(tab)
    }))
    .filter(shouldTrackSwitcherTab);
  if (recentTabTracker && typeof recentTabTracker.getRecentTabs === 'function') {
    return recentTabTracker
      .getRecentTabs(normalizedTabs, { limit: TAB_SWITCHER_LIMIT })
      .map((tab) => normalizeSwitcherTabForPayload(tab, currentTabId))
      .filter(Boolean);
  }
  return normalizedTabs
    .slice()
    .sort((a, b) => (Number(b.lastAccessed) || 0) - (Number(a.lastAccessed) || 0))
    .slice(0, TAB_SWITCHER_LIMIT)
    .map((tab) => normalizeSwitcherTabForPayload(tab, currentTabId))
    .filter(Boolean);
}

function getDefaultSwitcherSelectedIndex(items, currentTabId) {
  const list = Array.isArray(items) ? items : [];
  if (list.length <= 0) {
    return 0;
  }
  if (list.length === 1) {
    return 0;
  }
  if (typeof currentTabId !== 'number') {
    return 0;
  }
  const currentIndex = list.findIndex((item) => item && item.id === currentTabId);
  if (currentIndex === 0) {
    return 1;
  }
  if (currentIndex > 0) {
    return currentIndex;
  }
  return 0;
}

function focusWindowAndActivateTab(tabId, windowId, callback) {
  const run = (resolvedWindowId) => {
    if (RECENT_TAB_SWITCHER && typeof RECENT_TAB_SWITCHER.focusWindowAndActivateTab === 'function') {
      RECENT_TAB_SWITCHER.focusWindowAndActivateTab(chrome, {
        tabId,
        windowId: typeof resolvedWindowId === 'number' ? resolvedWindowId : null
      })
        .then((result) => {
          if (result && result.ok && typeof tabId === 'number') {
            recordTabSwitchEvent(tabId);
          }
          if (typeof callback === 'function') {
            callback(result || { ok: false });
          }
        })
        .catch((error) => {
          if (typeof callback === 'function') {
            callback({
              ok: false,
              tabId,
              windowId: typeof resolvedWindowId === 'number' ? resolvedWindowId : null,
              reason: error && error.message ? error.message : 'switch-failed'
            });
          }
        });
      return;
    }
    chrome.tabs.update(tabId, { active: true }, (tab) => {
      const ok = !(chrome.runtime && chrome.runtime.lastError);
      if (ok) {
        recordTabSwitchEvent(tabId);
      }
      if (typeof callback === 'function') {
        callback({
          ok,
          tabId,
          windowId: typeof resolvedWindowId === 'number'
            ? resolvedWindowId
            : (tab && typeof tab.windowId === 'number' ? tab.windowId : null),
          reason: ok ? '' : (chrome.runtime.lastError.message || 'tab-update-failed')
        });
      }
    });
  };
  if (typeof windowId === 'number' ||
      !chrome ||
      !chrome.tabs ||
      typeof chrome.tabs.get !== 'function') {
    run(windowId);
    return;
  }
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime && chrome.runtime.lastError) {
      run(null);
      return;
    }
    run(tab && typeof tab.windowId === 'number' ? tab.windowId : null);
  });
}

function getTabSwitcherOpeningWindowKey(tab) {
  if (tab && typeof tab.windowId === 'number') {
    return `window:${tab.windowId}`;
  }
  if (tab && typeof tab.id === 'number') {
    return `tab:${tab.id}`;
  }
  return '';
}

function finishTabSwitcherOpening(opening) {
  if (!opening || !opening.key) {
    return;
  }
  const current = tabSwitcherOpeningByWindowKey.get(opening.key);
  if (current !== opening) {
    return;
  }
  if (opening.timer) {
    clearTimeout(opening.timer);
    opening.timer = null;
  }
  tabSwitcherOpeningByWindowKey.delete(opening.key);
}

function beginTabSwitcherOpening(tab, source) {
  const key = getTabSwitcherOpeningWindowKey(tab);
  if (!key) {
    return null;
  }
  const now = Date.now();
  const existing = tabSwitcherOpeningByWindowKey.get(key);
  if (existing && existing.expiresAt > now) {
    logHotkeyDebug('tab-switcher-opening-guarded', {
      tabId: tab && typeof tab.id === 'number' ? tab.id : null,
      windowId: tab && typeof tab.windowId === 'number' ? tab.windowId : null,
      source: source || '',
      age: now - existing.startedAt
    });
    return null;
  }
  if (existing) {
    finishTabSwitcherOpening(existing);
  }
  const opening = {
    key,
    tabId: tab && typeof tab.id === 'number' ? tab.id : null,
    windowId: tab && typeof tab.windowId === 'number' ? tab.windowId : null,
    source: source || '',
    startedAt: now,
    expiresAt: now + TAB_SWITCHER_OPENING_GUARD_MS,
    timer: null
  };
  opening.timer = setTimeout(() => {
    finishTabSwitcherOpening(opening);
  }, TAB_SWITCHER_OPENING_GUARD_MS);
  tabSwitcherOpeningByWindowKey.set(key, opening);
  return opening;
}

function createTabSwitcherOpeningFinisher(opening) {
  let didFinish = false;
  return function finishOpeningOnce() {
    if (didFinish) {
      return;
    }
    didFinish = true;
    finishTabSwitcherOpening(opening);
  };
}

function getOverlayLoadingRecordStorageArea() {
  return chrome && chrome.storage && chrome.storage.session &&
    typeof chrome.storage.session.get === 'function'
    ? chrome.storage.session
    : null;
}

function getOverlayLoadingRecordStorageKey(tabId) {
  return `${OVERLAY_LOADING_RECORD_STORAGE_PREFIX}${tabId}`;
}

function setOverlayLoadingRecord(record) {
  if (!record || typeof record.tabId !== 'number') {
    return;
  }
  const currentRecord = overlayLoadingRecordsByTabId.get(record.tabId) || null;
  const currentSession = currentRecord && currentRecord.session &&
    typeof currentRecord.session === 'object'
    ? currentRecord.session
    : null;
  const incomingSession = record.session && typeof record.session === 'object'
    ? record.session
    : null;
  const shouldPreserveCurrentSession = Boolean(
    currentSession &&
    (!incomingSession ||
      Number(currentSession.revision || 0) > Number(incomingSession.revision || 0) ||
      (Number(currentSession.revision || 0) === Number(incomingSession.revision || 0) &&
        Number(currentSession.updatedAt || 0) > Number(incomingSession.updatedAt || 0)))
  );
  const nextRecord = {
    ...record,
    session: shouldPreserveCurrentSession ? currentSession : incomingSession
  };
  overlayLoadingRecordsByTabId.set(record.tabId, nextRecord);
  const sessionArea = getOverlayLoadingRecordStorageArea();
  if (!sessionArea || typeof sessionArea.set !== 'function') {
    return;
  }
  try {
    sessionArea.set({
      [getOverlayLoadingRecordStorageKey(record.tabId)]: nextRecord
    }, () => {
      void chrome.runtime.lastError;
    });
  } catch (error) {
    // The in-memory record still covers ordinary loading lifetimes.
  }
}

function clearOverlayLoadingRecord(tabId) {
  if (typeof tabId !== 'number') {
    return;
  }
  overlayLoadingRecordsByTabId.delete(tabId);
  overlayLoadingRecoveryInFlightByTabId.delete(tabId);
  overlayLoadingPendingUpdateByTabId.delete(tabId);
  const sessionArea = getOverlayLoadingRecordStorageArea();
  if (!sessionArea || typeof sessionArea.remove !== 'function') {
    return;
  }
  try {
    sessionArea.remove(getOverlayLoadingRecordStorageKey(tabId), () => {
      void chrome.runtime.lastError;
    });
  } catch (error) {
    // Ignore session-storage cleanup failures.
  }
}

function getOverlayLoadingRecord(tabId, callback) {
  const done = typeof callback === 'function' ? callback : () => {};
  if (typeof tabId !== 'number') {
    done(null);
    return;
  }
  const cached = overlayLoadingRecordsByTabId.get(tabId) || null;
  if (cached) {
    if (typeof OVERLAY_LOADING_LIFECYCLE.isExpired === 'function' &&
        OVERLAY_LOADING_LIFECYCLE.isExpired(
          cached,
          Date.now(),
          OVERLAY_LOADING_RECORD_TTL_MS
        )) {
      clearOverlayLoadingRecord(tabId);
      done(null);
      return;
    }
    done(cached);
    return;
  }
  const sessionArea = getOverlayLoadingRecordStorageArea();
  if (!sessionArea) {
    done(null);
    return;
  }
  const storageKey = getOverlayLoadingRecordStorageKey(tabId);
  try {
    sessionArea.get(storageKey, (result) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        done(null);
        return;
      }
      const stored = result && result[storageKey] && typeof result[storageKey] === 'object'
        ? result[storageKey]
        : null;
      if (!stored || stored.tabId !== tabId ||
          (typeof OVERLAY_LOADING_LIFECYCLE.isExpired === 'function' &&
            OVERLAY_LOADING_LIFECYCLE.isExpired(
              stored,
              Date.now(),
              OVERLAY_LOADING_RECORD_TTL_MS
            ))) {
        if (stored) {
          clearOverlayLoadingRecord(tabId);
        }
        done(null);
        return;
      }
      overlayLoadingRecordsByTabId.set(tabId, stored);
      done(stored);
    });
  } catch (error) {
    done(null);
  }
}

function rememberOverlayLoadingRecord(activeTab, source, options) {
  const settings = options && typeof options === 'object' ? options : {};
  if (settings.loadingRecovery === true) {
    return settings.loadingRecord || overlayLoadingRecordsByTabId.get(activeTab.id) || null;
  }
  const record = typeof OVERLAY_LOADING_LIFECYCLE.createRecord === 'function'
    ? OVERLAY_LOADING_LIFECYCLE.createRecord(activeTab, source, Date.now())
    : null;
  if (!record) {
    clearOverlayLoadingRecord(activeTab.id);
    return null;
  }
  setOverlayLoadingRecord(record);
  overlayLoadingRecoveryInFlightByTabId.add(activeTab.id);
  return record;
}

function getPendingOverlayNavigationUrl(tab) {
  if (typeof OVERLAY_LOADING_LIFECYCLE.getPendingInjectableUrl === 'function') {
    return OVERLAY_LOADING_LIFECYCLE.getPendingInjectableUrl(
      tab,
      canOpenOverlayOnUrl
    );
  }
  if (!tab || typeof tab.id !== 'number') {
    return '';
  }
  const currentUrl = typeof tab.url === 'string' ? tab.url.trim() : '';
  const pendingUrl = typeof tab.pendingUrl === 'string' ? tab.pendingUrl.trim() : '';
  const isLoading = tab.status === 'loading' || Boolean(pendingUrl);
  if (!isLoading || !pendingUrl || canOpenOverlayOnUrl(currentUrl) ||
      !canOpenOverlayOnUrl(pendingUrl)) {
    return '';
  }
  return pendingUrl;
}

function rememberOverlayPendingNavigationIntent(activeTab, source, pendingUrl) {
  if (!activeTab || typeof activeTab.id !== 'number' || !pendingUrl) {
    return null;
  }
  const record = typeof OVERLAY_LOADING_LIFECYCLE.createRecord === 'function'
    ? OVERLAY_LOADING_LIFECYCLE.createRecord(activeTab, source, Date.now())
    : null;
  if (!record) {
    return null;
  }
  const currentRecord = overlayLoadingRecordsByTabId.get(activeTab.id) || null;
  const nextRecord = {
    ...record,
    documentId: currentRecord && currentRecord.documentId
      ? currentRecord.documentId
      : record.documentId,
    session: currentRecord && currentRecord.session
      ? currentRecord.session
      : record.session,
    pendingNavigationUrl: pendingUrl
  };
  setOverlayLoadingRecord(nextRecord);
  logHotkeyDebug('overlay-deferred-for-pending-navigation', {
    tabId: activeTab.id,
    currentUrl: typeof activeTab.url === 'string' ? activeTab.url : '',
    pendingUrl,
    source: source || ''
  });
  return nextRecord;
}

function queueOverlayLoadingUpdate(tabId, changeInfo, tab) {
  const current = overlayLoadingPendingUpdateByTabId.get(tabId) || null;
  const incomingComplete = Boolean(changeInfo && changeInfo.status === 'complete');
  const currentComplete = Boolean(current && current.changeInfo &&
    current.changeInfo.status === 'complete');
  if (currentComplete && !incomingComplete) {
    return;
  }
  overlayLoadingPendingUpdateByTabId.set(tabId, {
    changeInfo: { ...(changeInfo || {}) },
    tab: tab ? { ...tab } : null
  });
}

function finishOverlayLoadingOpenAttempt(tabId) {
  if (typeof tabId !== 'number' ||
      !overlayLoadingRecoveryInFlightByTabId.has(tabId)) {
    return;
  }
  overlayLoadingRecoveryInFlightByTabId.delete(tabId);
  const pendingUpdate = overlayLoadingPendingUpdateByTabId.get(tabId) || null;
  overlayLoadingPendingUpdateByTabId.delete(tabId);
  if (!pendingUpdate) {
    return;
  }
  setTimeout(() => {
    recoverOverlayAfterLoadingUpdate(
      tabId,
      pendingUpdate.changeInfo,
      pendingUpdate.tab
    );
  }, 0);
}

function updateOverlayLoadingRecordFromInvocation(activeTab, results) {
  if (!activeTab || typeof activeTab.id !== 'number') {
    return;
  }
  const record = overlayLoadingRecordsByTabId.get(activeTab.id) || null;
  if (!record || typeof OVERLAY_LOADING_LIFECYCLE.applyInvocationResult !== 'function') {
    return;
  }
  const outcome = OVERLAY_LOADING_LIFECYCLE.applyInvocationResult(
    record,
    results,
    Date.now()
  );
  if (!outcome || outcome.action === 'clear') {
    clearOverlayLoadingRecord(activeTab.id);
    return;
  }
  if (outcome.record) {
    setOverlayLoadingRecord(outcome.record);
  }
}

function updateOverlayLoadingSessionFromMessage(request, sender, sendResponse) {
  const senderTab = sender && sender.tab ? sender.tab : null;
  if (!senderTab || typeof senderTab.id !== 'number' ||
      (typeof sender.frameId === 'number' && sender.frameId !== 0)) {
    sendResponse({ ok: false, tracked: false });
    return;
  }
  getOverlayLoadingRecord(senderTab.id, (record) => {
    if (!record || typeof OVERLAY_LOADING_LIFECYCLE.applySessionUpdate !== 'function') {
      sendResponse({ ok: true, tracked: false });
      return;
    }
    const outcome = OVERLAY_LOADING_LIFECYCLE.applySessionUpdate(
      record,
      request && request.session,
      {
        documentId: sender && typeof sender.documentId === 'string'
          ? sender.documentId
          : '',
        now: Date.now()
      }
    );
    if (!outcome || !outcome.record) {
      sendResponse({ ok: true, tracked: false });
      return;
    }
    setOverlayLoadingRecord(outcome.record);
    sendResponse({
      ok: true,
      tracked: outcome.reason !== 'stale-document'
    });
  });
}

function probeOverlayLoadingState(tabId, callback) {
  chrome.scripting.executeScript({
    target: { tabId },
    injectImmediately: true,
    func: (runtimeVersion, hostId) => {
      const rawOpenState = window._x_extension_search_overlay_open_2026_unique_;
      const host = document.getElementById(hostId);
      return {
        runtimeReady:
          window._x_extension_search_overlay_runtime_version_2026_unique_ === runtimeVersion &&
          typeof window._x_extension_toggleSearchOverlay_2026_unique_ === 'function',
        overlayOpenState: rawOpenState === true
          ? 'open'
          : (rawOpenState === false ? 'closed' : 'unknown'),
        overlayConnected: Boolean(host && host.isConnected)
      };
    },
    args: [OVERLAY_RUNTIME_VERSION, OVERLAY_HOST_ID]
  }, callback);
}

function scheduleOverlayLoadingRecoveryRetry(tab, record) {
  if (!tab || typeof tab.id !== 'number' || !record) {
    return;
  }
  const recoveryAttempts = Math.max(0, Number(record.recoveryAttempts) || 0) + 1;
  if (recoveryAttempts > OVERLAY_LOADING_RECOVERY_MAX_ATTEMPTS) {
    clearOverlayLoadingRecord(tab.id);
    return;
  }
  const nextRecord = {
    ...record,
    recoveryAttempts,
    updatedAt: Date.now()
  };
  setOverlayLoadingRecord(nextRecord);
  setTimeout(() => {
    recoverOverlayAfterLoadingUpdate(tab.id, { status: 'complete' }, tab);
  }, OVERLAY_LOADING_RECOVERY_RETRY_MS * recoveryAttempts);
}

function scheduleOverlayLoadingPreCompleteRetry(tab, record) {
  if (!tab || typeof tab.id !== 'number' || !record) {
    return;
  }
  const committedUrl = getResolvedTabUrl(tab);
  if (!canOpenOverlayOnUrl(committedUrl)) {
    return;
  }
  const currentRecord = overlayLoadingRecordsByTabId.get(tab.id) || record;
  const previousAttempts = currentRecord.preCompleteRetryUrl === committedUrl
    ? Math.max(0, Number(currentRecord.preCompleteRecoveryAttempts) || 0)
    : 0;
  const preCompleteRecoveryAttempts = previousAttempts + 1;
  if (preCompleteRecoveryAttempts > OVERLAY_LOADING_PRE_COMPLETE_RETRY_MAX_ATTEMPTS) {
    logHotkeyDebug('loading-pre-complete-retry-paused', {
      tabId: tab.id,
      url: committedUrl,
      source: currentRecord.source || ''
    });
    return;
  }
  const nextRecord = {
    ...currentRecord,
    preCompleteRetryUrl: committedUrl,
    preCompleteRecoveryAttempts,
    updatedAt: Date.now()
  };
  setOverlayLoadingRecord(nextRecord);
  setTimeout(() => {
    getOverlayLoadingRecord(tab.id, (latestRecord) => {
      if (!latestRecord || latestRecord.preCompleteRetryUrl !== committedUrl ||
          Number(latestRecord.preCompleteRecoveryAttempts) !== preCompleteRecoveryAttempts) {
        return;
      }
      const retryWithCurrentTab = (currentTab) => {
        const stillTracked = overlayLoadingRecordsByTabId.get(tab.id) || null;
        if (!stillTracked || stillTracked.preCompleteRetryUrl !== committedUrl ||
            Number(stillTracked.preCompleteRecoveryAttempts) !== preCompleteRecoveryAttempts) {
          return;
        }
        const retryTab = currentTab && typeof currentTab === 'object'
          ? currentTab
          : tab;
        const retryUrl = getResolvedTabUrl(retryTab);
        if (!canOpenOverlayOnUrl(retryUrl)) {
          return;
        }
        const retryChangeInfo = retryTab.status === 'complete'
          ? { status: retryTab.status }
          : { url: retryUrl };
        recoverOverlayAfterLoadingUpdate(tab.id, retryChangeInfo, retryTab);
      };
      if (chrome.tabs && typeof chrome.tabs.get === 'function') {
        chrome.tabs.get(tab.id, (currentTab) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            return;
          }
          retryWithCurrentTab(currentTab);
        });
        return;
      }
      retryWithCurrentTab(tab);
    });
  }, OVERLAY_LOADING_PRE_COMPLETE_RETRY_MS * preCompleteRecoveryAttempts);
}

function restoreOverlayAfterLoadingDocumentChange(tab, record, complete) {
  if (!tab || typeof tab.id !== 'number' || !record) {
    return;
  }
  openOverlayOnTab(tab, [], record.source, {
    loadingRecovery: true,
    loadingRecord: record,
    ensureOpen: true,
    skipDuplicateGuard: true,
    onComplete: (ok) => {
      if (complete === true) {
        if (ok) {
          clearOverlayLoadingRecord(tab.id);
        } else {
          scheduleOverlayLoadingRecoveryRetry(tab, record);
        }
        return;
      }
      if (!ok) {
        logHotkeyDebug('loading-recovery-failed', {
          tabId: tab.id,
          source: record.source || ''
        });
        scheduleOverlayLoadingPreCompleteRetry(tab, record);
      }
    }
  });
}

function recoverOverlayAfterLoadingUpdate(tabId, changeInfo, tab) {
  const isComplete = Boolean(changeInfo && changeInfo.status === 'complete');
  const isCommittedUrl = Boolean(changeInfo && typeof changeInfo.url === 'string');
  if (!isComplete && !isCommittedUrl) {
    return;
  }
  if (overlayLoadingRecoveryInFlightByTabId.has(tabId)) {
    queueOverlayLoadingUpdate(tabId, changeInfo, tab);
    return;
  }
  getOverlayLoadingRecord(tabId, (record) => {
    if (!record) {
      return;
    }
    if (overlayLoadingRecoveryInFlightByTabId.has(tabId)) {
      queueOverlayLoadingUpdate(tabId, changeInfo, tab);
      return;
    }
    const resolvedTab = Object.assign({}, tab || {}, { id: tabId });
    if (isCommittedUrl) {
      resolvedTab.url = changeInfo.url;
    }
    const resolvedUrl = getResolvedTabUrl(resolvedTab);
    if (!canOpenOverlayOnUrl(resolvedUrl)) {
      const trackedPendingUrl = typeof record.pendingNavigationUrl === 'string'
        ? record.pendingNavigationUrl
        : '';
      if (!isComplete && canOpenOverlayOnUrl(trackedPendingUrl)) {
        return;
      }
      clearOverlayLoadingRecord(tabId);
      return;
    }
    overlayLoadingRecoveryInFlightByTabId.add(tabId);
    probeOverlayLoadingState(tabId, (results) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        if (isComplete) {
          restoreOverlayAfterLoadingDocumentChange(resolvedTab, record, true);
        } else {
          finishOverlayLoadingOpenAttempt(tabId);
          scheduleOverlayLoadingPreCompleteRetry(resolvedTab, record);
        }
        return;
      }
      const outcome = typeof OVERLAY_LOADING_LIFECYCLE.decideRecovery === 'function'
        ? OVERLAY_LOADING_LIFECYCLE.decideRecovery(record, results, {
          complete: isComplete,
          now: Date.now(),
          ttlMs: OVERLAY_LOADING_RECORD_TTL_MS
        })
        : { action: 'clear', record: null };
      if (!outcome || outcome.action === 'clear' || outcome.action === 'none') {
        clearOverlayLoadingRecord(tabId);
        return;
      }
      if (outcome.record) {
        setOverlayLoadingRecord(outcome.record);
      }
      if (outcome.action === 'keep') {
        finishOverlayLoadingOpenAttempt(tabId);
        return;
      }
      restoreOverlayAfterLoadingDocumentChange(
        resolvedTab,
        outcome.record || record,
        isComplete
      );
    });
  });
}

function openOverlayOnTab(activeTab, tabs, source, options) {
  const openOptions = options && typeof options === 'object' ? options : {};
  let overlayOpening = null;
  let didFinishOpenAttempt = false;
  let shouldRetryPreCompleteFailure = false;
  const finishOpenAttempt = (ok) => {
    if (didFinishOpenAttempt) {
      return;
    }
    didFinishOpenAttempt = true;
    if (typeof openOptions.onComplete === 'function') {
      openOptions.onComplete(ok === true);
    }
    if (overlayOpening) {
      finishOverlayOpening(overlayOpening);
      overlayOpening = null;
    }
    if (ok !== true && openOptions.loadingRecovery !== true &&
        shouldRetryPreCompleteFailure && activeTab &&
        typeof activeTab.id === 'number') {
      const trackedRecord = overlayLoadingRecordsByTabId.get(activeTab.id) || null;
      if (trackedRecord) {
        scheduleOverlayLoadingPreCompleteRetry(activeTab, trackedRecord);
      }
    }
    if ((openOptions.loadingRecovery === true || shouldRetryPreCompleteFailure) &&
        activeTab && typeof activeTab.id === 'number') {
      finishOverlayLoadingOpenAttempt(activeTab.id);
    }
  };
  if (!activeTab || typeof activeTab.id !== 'number') {
    logHotkeyDebug('no-active-tab', { source: source || '' });
    openNewtabFallback();
    finishOpenAttempt(false);
    return;
  }
  if (openOptions.skipDuplicateGuard !== true && shouldIgnoreDuplicateHotkey(activeTab.id)) {
    logHotkeyDebug('duplicate-ignored', { tabId: activeTab.id, source: source || '' });
    finishOpenAttempt(false);
    return;
  }
  const pendingNavigationUrl = getPendingOverlayNavigationUrl(activeTab);
  if (openOptions.loadingRecovery !== true && pendingNavigationUrl &&
      rememberOverlayPendingNavigationIntent(activeTab, source, pendingNavigationUrl)) {
    finishOpenAttempt(false);
    return;
  }
  const activeUrl = getResolvedTabUrl(activeTab);
  const rawUrl = typeof activeTab.url === 'string' ? activeTab.url : '';
  const rawPendingUrl = typeof activeTab.pendingUrl === 'string' ? activeTab.pendingUrl : '';
  const restricted = !canOpenOverlayOnUrl(activeUrl);
  logHotkeyDebug('active-tab', {
    tabId: activeTab.id,
    resolvedUrl: activeUrl,
    tabUrl: rawUrl,
    pendingUrl: rawPendingUrl,
    url: activeUrl,
    restricted: restricted,
    source: source || ''
  });
  if (restricted) {
    finishOpenAttempt(false);
    if (isSearchCommandSource(source) && (isLumnoNewtabUrl(activeUrl) || isBrowserNewtabUrl(activeUrl))) {
      requestFocusVisibleNewtabInput(source, activeTab.id);
      return;
    }
    if (shouldTriggerOnboardingOverlayFromCommand(source, activeUrl)) {
      triggerOnboardingOverlayFromCommand(activeTab, source);
      logHotkeyDebug('suppressed', { reason: 'restricted_onboarding_command', source: source || '' });
      return;
    }
    if (recoverOverlayTargetFromCommandNewtab(activeTab, tabs, source)) {
      return;
    }
    const action = restrictedActionCache || 'default';
    logHotkeyDebug('restricted-url', {
      action: action,
      url: activeUrl,
      source: source || ''
    });
    if (action === 'none') {
      logHotkeyDebug('fallback-open-browser-newtab', { reason: 'restricted_url', source: source || '' });
      openBrowserNewtabFallback({ sourceTab: activeTab });
      return;
    }
    if (action === 'default') {
      logHotkeyDebug('fallback-open-create-newtab', { reason: 'restricted_url', source: source || '' });
      openNewtabFallbackForUrl(activeUrl, { sourceTab: activeTab });
      return;
    }
    logHotkeyDebug('fallback-open-lumno-newtab', { reason: 'restricted_url', source: source || '' });
    openNewtabFallbackForUrl(activeUrl, { sourceTab: activeTab });
    return;
  }
  overlayOpening = beginOverlayOpening(activeTab, source);
  if (!overlayOpening) {
    finishOpenAttempt(false);
    return;
  }
  const overlayLoadingRecord = rememberOverlayLoadingRecord(activeTab, source, openOptions);
  shouldRetryPreCompleteFailure = Boolean(overlayLoadingRecord);
  const overlayInjectionFiles = [
    'src/shared/icon-font-preload.js',
    'src/shared/codex-debug-surface.js',
    'src/shared/settings.js',
    'src/shared/navigation-disposition.js',
    'src/shared/search-utils.js',
    'src/shared/site-search-store.js',
    'src/shared/suggestion-action-model.js',
    'src/shared/suggestion-navigation.js',
    'src/shared/ime-key-guard.js',
    'src/shared/search-input-history.js',
    'src/shared/toast.js',
    'src/shared/menu-surface.js',
    'src/shared/search-input-mode.js',
    'src/shared/shortcut-display.js',
    'src/shared/shortcut-favicon.js',
    'src/shared/community-links.js',
    'src/shared/feature-hints.js',
    'src/shared/update-notice.js',
    'src/shared/engagement-notice.js',
    'src/shared/tooltip.js',
    'src/shared/cursor-tooltip.js',
    'src/overlay/runtime.js',
    'src/shared/favicon-utils.js',
    'src/newtab/favicon-theme.js',
    'src/shared/favicon-cache.js',
    'src/shared/favicon-view-core.js',
    'src/overlay/favicon-view.js',
    'src/overlay/lifecycle.js',
    'src/overlay/site-fixes.js',
    'src/overlay/page-theme.js',
    'src/react/overlay-islands.js',
    'src/overlay/search-panel.js'
  ];
  const runOverlayScript = (tabZoomFactor) => {
      const prefillQuery = getOverlayPrefillQueryForSource(activeTab, source);
      const prioritizeCurrentPageMatch = source === 'page-hotkey-prefill';
      const siteSearchProviders = Array.isArray(siteSearchCache) ? siteSearchCache : [];
      loadSiteSearchProviders()
        .then((providers) => {
          scheduleSiteSearchProviderIconWarmup(providers, '');
        })
        .catch(() => {});
      chrome.scripting.executeScript({
            target: {tabId: activeTab.id},
            injectImmediately: true,
            func: (overlayTabs, overlayPanelContext, overlayHostId) => {
              const toggleOverlay = window._x_extension_toggleSearchOverlay_2026_unique_;
              if (typeof toggleOverlay !== 'function') {
                console.warn('Lumno: overlay search panel helper not available.');
                return { ok: false, reason: 'search_panel_missing' };
              }
              toggleOverlay(overlayTabs, overlayPanelContext);
              const overlayHost = document.getElementById(overlayHostId);
              return {
                ok: true,
                overlayOpen:
                  window._x_extension_search_overlay_open_2026_unique_ === true &&
                  Boolean(overlayHost && overlayHost.isConnected)
              };
            },
            args: [tabs, {
              tabZoomFactor: tabZoomFactor,
              prefillQuery: prefillQuery,
              prioritizeCurrentPageMatch: prioritizeCurrentPageMatch,
              currentTabId: typeof activeTab.id === 'number' ? activeTab.id : null,
              currentTabUrl: getResolvedTabUrl(activeTab),
              documentPipEnabled: documentPipEnabledCache,
              siteSearchProviders: Array.isArray(siteSearchProviders) ? siteSearchProviders : [],
              ensureOpen: openOptions.ensureOpen === true,
              loadingSessionTracked: Boolean(overlayLoadingRecord),
              loadingSession: overlayLoadingRecord && overlayLoadingRecord.session
                ? overlayLoadingRecord.session
                : null
            }, OVERLAY_HOST_ID]
          }, function(results) {
            if (chrome.runtime.lastError) {
              logHotkeyDebug('inject-failed', {
                step: 'src/overlay/search-panel.js',
                tabId: activeTab.id,
                error: chrome.runtime.lastError.message || 'unknown',
                source: source || ''
              });
              if (openOptions.loadingRecovery !== true &&
                  !overlayLoadingRecordsByTabId.has(activeTab.id)) {
                openNewtabFallback({ sourceTab: activeTab });
              }
              finishOpenAttempt(false);
              return;
            }
            const mainResult = typeof OVERLAY_LOADING_LIFECYCLE.getMainFrameResult === 'function'
              ? OVERLAY_LOADING_LIFECYCLE.getMainFrameResult(results)
              : (Array.isArray(results) && results[0] ? results[0] : null);
            const result = mainResult ? mainResult.result : null;
            if (result && result.ok === false) {
              logHotkeyDebug('inject-failed', {
                step: 'src/overlay/search-panel.js',
                tabId: activeTab.id,
                error: result.reason || 'unknown',
                source: source || ''
              });
              if (openOptions.loadingRecovery !== true &&
                  !overlayLoadingRecordsByTabId.has(activeTab.id)) {
                openNewtabFallback({ sourceTab: activeTab });
              }
              finishOpenAttempt(false);
              return;
            }
            updateOverlayLoadingRecordFromInvocation(activeTab, results);
            logHotkeyDebug('overlay-opened', {
              tabId: activeTab.id,
              tabCount: Array.isArray(tabs) ? tabs.length : 0,
              source: source || '',
              tabZoomFactor: tabZoomFactor,
              siteSearchProviderCount: Array.isArray(siteSearchProviders) ? siteSearchProviders.length : 0
            });
            finishOpenAttempt(Boolean(result && result.overlayOpen === true));
          });
  };
  const runOverlayWithResolvedZoom = () => {
    if (chrome.tabs && typeof chrome.tabs.getZoom === 'function') {
      chrome.tabs.getZoom(activeTab.id, (zoomFactor) => {
        const zoom = Number.isFinite(Number(zoomFactor)) && Number(zoomFactor) > 0
          ? Number(zoomFactor)
          : 1;
        runOverlayScript(zoom);
      });
      return;
    }
    runOverlayScript(1);
  };
  const injectOverlayRuntime = () => {
    logHotkeyDebug('inject-start', { tabId: activeTab.id, file: overlayInjectionFiles.join(','), source: source || '' });
    chrome.scripting.executeScript({
      target: {tabId: activeTab.id},
      injectImmediately: true,
      files: overlayInjectionFiles
    }, function() {
      if (chrome.runtime.lastError) {
        logHotkeyDebug('inject-failed', {
          step: overlayInjectionFiles.join(','),
          tabId: activeTab.id,
          error: chrome.runtime.lastError.message || 'unknown',
          source: source || ''
        });
        if (openOptions.loadingRecovery !== true &&
            !overlayLoadingRecordsByTabId.has(activeTab.id)) {
          openNewtabFallbackForUrl(activeUrl, { sourceTab: activeTab });
        }
        finishOpenAttempt(false);
        return;
      }
      runOverlayWithResolvedZoom();
    });
  };
  chrome.scripting.executeScript({
    target: {tabId: activeTab.id},
    injectImmediately: true,
    func: (runtimeVersion) => {
      return window._x_extension_search_overlay_runtime_version_2026_unique_ === runtimeVersion &&
        typeof window._x_extension_toggleSearchOverlay_2026_unique_ === 'function';
    },
    args: [OVERLAY_RUNTIME_VERSION]
  }, (results) => {
    const probeError = chrome.runtime.lastError;
    const runtimeReady = !probeError &&
      Array.isArray(results) &&
      results[0] &&
      results[0].result === true;
    if (runtimeReady) {
      logHotkeyDebug('runtime-reused', {
        tabId: activeTab.id,
        source: source || '',
        version: OVERLAY_RUNTIME_VERSION
      });
      runOverlayWithResolvedZoom();
      return;
    }
    injectOverlayRuntime();
  });
}

function triggerShowSearchForTab(tab, source) {
  if (!tab || typeof tab.id !== 'number') {
    logHotkeyDebug('no-active-tab', { source: source || '' });
    openNewtabFallback();
    return;
  }
  if (getPendingOverlayNavigationUrl(tab)) {
    openOverlayOnTab(tab, [], source);
    return;
  }
  const activeUrl = getResolvedTabUrl(tab);
  if (canOpenOverlayOnUrl(activeUrl)) {
    openOverlayOnTab(tab, [], source);
    return;
  }
  const windowQuery = (typeof tab.windowId === 'number')
    ? { windowId: tab.windowId }
    : { currentWindow: true };
  chrome.tabs.query(windowQuery, (tabs) => {
    const tabList = Array.isArray(tabs) ? tabs : [];
    const resolvedTab = tabList.find((item) => item && item.id === tab.id) || tab;
    openOverlayOnTab(resolvedTab, tabList, source);
  });
}

function injectTabSwitcherOnTab(hostTab, items, context) {
  const finishOpen = (ok, reason) => {
    if (context && typeof context.onOpenComplete === 'function') {
      context.onOpenComplete(Boolean(ok), reason || '');
    }
  };
  if (!hostTab || typeof hostTab.id !== 'number') {
    openNewtabFallback();
    finishOpen(false, 'invalid-host-tab');
    return;
  }
  const tabItems = Array.isArray(items) ? items : [];
  if (!tabItems.length) {
    logHotkeyDebug('tab-switcher-empty', {
      hostTabId: hostTab.id,
      source: context && context.source ? context.source : ''
    });
    finishOpen(false, 'empty');
    return;
  }
  const buildSwitcherContext = (tabZoomFactor) => ({
    tabs: tabItems,
    currentTabId: context && typeof context.currentTabId === 'number' ? context.currentTabId : hostTab.id,
    selectedIndex: context && typeof context.selectedIndex === 'number' ? context.selectedIndex : 0,
    tabZoomFactor: tabZoomFactor,
    advanceOnExisting: true,
    suppressInitialShortcutAdvance: context && context.source === 'commands-tab-switcher',
    shortcut: context && typeof context.shortcut === 'string' ? context.shortcut : 'Alt+Q',
    source: context && context.source ? context.source : ''
  });
  if (isTabSwitcherExtensionPageMessageTarget(hostTab)) {
    postTabSwitcherMessageToExtensionPage(hostTab, {
      action: 'openTabSwitcherFromCommand',
      context: buildSwitcherContext(1)
    }, (ok, reason) => {
      if (!ok) {
        logHotkeyDebug('tab-switcher-extension-page-open-failed', {
          tabId: hostTab.id,
          reason: reason || '',
          source: context && context.source ? context.source : ''
        });
        openNewtabFallbackForUrl(getResolvedTabUrl(hostTab), { sourceTab: hostTab });
        finishOpen(false, reason || 'extension-page-open-failed');
        return;
      }
      logHotkeyDebug('tab-switcher-opened', {
        tabId: hostTab.id,
        itemCount: tabItems.length,
        source: context && context.source ? context.source : '',
        path: 'extension-page-port'
      });
      finishOpen(true, 'extension-page-port');
    });
    return;
  }
  const runDynamicSwitcherScript = (switcherContext) => {
    chrome.scripting.executeScript({
      target: { tabId: hostTab.id },
      files: [
        'src/shared/icon-font-preload.js',
        'src/shared/codex-debug-surface.js',
        'src/react/overlay-islands.js',
        'src/overlay/tab-switcher.js'
      ]
    }, () => {
      if (chrome.runtime && chrome.runtime.lastError) {
        const errorMessage = chrome.runtime.lastError.message || 'unknown';
        logHotkeyDebug('tab-switcher-inject-failed', {
          tabId: hostTab.id,
          error: errorMessage,
          source: context && context.source ? context.source : ''
        });
        openNewtabFallbackForUrl(getResolvedTabUrl(hostTab), { sourceTab: hostTab });
        finishOpen(false, errorMessage);
        return;
      }
      chrome.scripting.executeScript({
        target: { tabId: hostTab.id },
        func: (switcherContext) => {
          const toggle = window._x_extension_toggleTabSwitcher_2026_unique_;
          if (typeof toggle !== 'function') {
            console.warn('Lumno: tab switcher helper not available.');
            return { ok: false, reason: 'tab_switcher_missing' };
          }
          const result = toggle(switcherContext);
          return result && typeof result === 'object'
            ? result
            : { ok: true };
        },
        args: [switcherContext]
      }, (results) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          const errorMessage = chrome.runtime.lastError.message || 'unknown';
          logHotkeyDebug('tab-switcher-run-failed', {
            tabId: hostTab.id,
            error: errorMessage,
            source: context && context.source ? context.source : ''
          });
          finishOpen(false, errorMessage);
          return;
        }
        const result = Array.isArray(results) && results[0] ? results[0].result : null;
        if (result && result.ok === false) {
          logHotkeyDebug('tab-switcher-run-failed', {
            tabId: hostTab.id,
            error: result.reason || 'unknown',
            source: context && context.source ? context.source : ''
          });
          finishOpen(false, result.reason || 'run-failed');
          return;
        }
        logHotkeyDebug('tab-switcher-opened', {
          tabId: hostTab.id,
          itemCount: tabItems.length,
          source: context && context.source ? context.source : '',
          path: 'executeScript'
        });
        finishOpen(true, 'executeScript');
      });
    });
  };
  const runSwitcherScript = (tabZoomFactor) => {
    const switcherContext = buildSwitcherContext(tabZoomFactor);
    if (!chrome || !chrome.tabs || typeof chrome.tabs.sendMessage !== 'function') {
      runDynamicSwitcherScript(switcherContext);
      return;
    }
    try {
      chrome.tabs.sendMessage(hostTab.id, {
        action: 'openTabSwitcherFromCommand',
        context: switcherContext
      }, (response) => {
        const didOpen = !(chrome.runtime && chrome.runtime.lastError) &&
          response &&
          response.ok === true;
        if (!didOpen) {
          runDynamicSwitcherScript(switcherContext);
          return;
        }
        logHotkeyDebug('tab-switcher-opened', {
          tabId: hostTab.id,
          itemCount: tabItems.length,
          source: context && context.source ? context.source : '',
          path: 'runtime-message'
        });
        finishOpen(true, 'runtime-message');
      });
    } catch (error) {
      runDynamicSwitcherScript(switcherContext);
    }
  };
  if (chrome.tabs && typeof chrome.tabs.getZoom === 'function') {
    chrome.tabs.getZoom(hostTab.id, (zoomFactor) => {
      const zoom = Number.isFinite(Number(zoomFactor)) && Number(zoomFactor) > 0
        ? Number(zoomFactor)
        : 1;
      runSwitcherScript(zoom);
    });
    return;
  }
  runSwitcherScript(1);
}

function advanceExistingTabSwitcherOnTab(tab, source, callback) {
  if (!tab || typeof tab.id !== 'number' || !canHostSwitcherSurface(tab)) {
    if (typeof callback === 'function') {
      callback(false);
    }
    return;
  }

  const finish = (didAdvance) => {
    if (typeof callback === 'function') {
      callback(Boolean(didAdvance));
    }
  };

  if (isTabSwitcherExtensionPageMessageTarget(tab)) {
    postTabSwitcherMessageToExtensionPage(tab, {
      action: 'advanceOpenTabSwitcherFromCommand',
      offset: 1
    }, (ok, _reason, response) => {
      const didAdvance = Boolean(ok && response && response.advanced === true);
      if (didAdvance) {
        logHotkeyDebug('tab-switcher-advanced-fast', {
          tabId: tab.id,
          source: source || '',
          path: 'extension-page-port'
        });
      }
      finish(didAdvance);
    });
    return;
  }

  const runRuntimeMessageFastPath = () => {
    if (!chrome || !chrome.tabs || typeof chrome.tabs.sendMessage !== 'function') {
      finish(false);
      return;
    }
    try {
      chrome.tabs.sendMessage(tab.id, {
        action: 'advanceOpenTabSwitcherFromCommand',
        offset: 1
      }, (response) => {
        const didAdvance = !(chrome.runtime && chrome.runtime.lastError) &&
          response &&
          response.ok === true &&
          response.advanced === true;
        if (didAdvance) {
          logHotkeyDebug('tab-switcher-advanced-fast', {
            tabId: tab.id,
            source: source || '',
            path: 'runtime-message'
          });
        }
        finish(didAdvance);
      });
    } catch (error) {
      finish(false);
    }
  };

  runRuntimeMessageFastPath();
}

function triggerTabSwitcherForTab(tab, source) {
  const commandStartedAt = Date.now();
  if (!tabSwitcherEnabledCache) {
    if (tab && typeof tab.windowId === 'number') {
      tabSwitcherHostTabIdByWindowId.delete(tab.windowId);
    }
    logHotkeyDebug('tab-switcher-disabled', { source: source || '' });
    return;
  }
  if (!tab || typeof tab.id !== 'number') {
    logHotkeyDebug('tab-switcher-no-active-tab', { source: source || '' });
    openNewtabFallback();
    return;
  }
  const windowId = typeof tab.windowId === 'number' ? tab.windowId : null;
  recordTabSwitcherShortcutDebug('command-received', {
    source: String(source || ''),
    tabId: tab.id,
    windowId
  });
  // A manifest content script is not retroactively installed into tabs that
  // were already open when a development extension was reloaded. Start the
  // trusted keyup observer before any async switcher work so a quick physical
  // modifier release can be buffered and replayed after the panel opens.
  const releaseObserverReady = prepareTabSwitcherShortcutReleaseObserver(tab);
  clearScheduledSwitcherThumbnailCapture(tab.id);
  advanceExistingTabSwitcherOnTab(tab, source, (didAdvance) => {
    if (didAdvance) {
      if (typeof tab.windowId === 'number') {
        tabSwitcherHostTabIdByWindowId.set(tab.windowId, tab.id);
      }
      recordTabSwitcherShortcutDebug('command-advanced', {
        tabId: tab.id,
        windowId
      });
      return;
    }
    const opening = beginTabSwitcherOpening(tab, source);
    if (!opening) {
      return;
    }
    let openingHostTabId = tab.id;
    const finishOpeningGuard = createTabSwitcherOpeningFinisher(opening);
    const finishOpening = (ok) => {
      finishOpeningGuard();
      if (ok === true) {
        if (typeof windowId === 'number' && typeof openingHostTabId === 'number') {
          tabSwitcherHostTabIdByWindowId.set(windowId, openingHostTabId);
        }
        recordTabSwitcherShortcutDebug('switcher-opened', {
          windowId,
          hostTabId: openingHostTabId
        });
        return;
      }
      if (tabSwitcherHostTabIdByWindowId.get(windowId) === openingHostTabId) {
        tabSwitcherHostTabIdByWindowId.delete(windowId);
      }
      recordTabSwitcherShortcutDebug('switcher-open-failed', {
        windowId
      });
    };
    const startupStateReady = Promise.all([
      ensureTabSwitcherStateLoaded(),
      loadFaviconRequestBlacklistItems(),
      loadFaviconEnhancedFetchEnabled()
    ]).catch(() => {});
    const shortcutReady = new Promise((resolve) => {
      getConfiguredTabSwitcherShortcut(resolve);
    });
    const tabQueryReady = new Promise((resolve) => {
      chrome.tabs.query({}, (tabs) => {
        const error = chrome.runtime && chrome.runtime.lastError
          ? chrome.runtime.lastError.message || 'unknown'
          : '';
        resolve({
          error,
          tabs: Array.isArray(tabs) ? tabs : []
        });
      });
    });
    Promise.all([startupStateReady, tabQueryReady, shortcutReady, releaseObserverReady]).then((results) => {
      const tabQuery = results[1] || { error: 'unknown', tabs: [] };
      const shortcut = typeof results[2] === 'string' && results[2]
        ? results[2]
        : 'Alt+Q';
      const releaseKeys = typeof RECENT_TAB_SWITCHER.getShortcutReleaseEventKeys === 'function'
        ? RECENT_TAB_SWITCHER.getShortcutReleaseEventKeys(shortcut)
        : [];
      recordTabSwitcherShortcutDebug('shortcut-configured', {
        windowId,
        shortcut,
        releaseKeys
      });
      if (tabQuery.error) {
        logHotkeyDebug('tab-switcher-query-failed', {
          source: source || '',
          error: tabQuery.error
        });
        finishOpening();
        return;
      }
      const tabList = tabQuery.tabs;
      const activeTab = tabList.find((item) => item && item.id === tab.id) || tab;
      const finishOpeningAndArmShortcutRelease = (ok) => {
        finishOpening(ok);
        if (ok === true) {
          armTabSwitcherShortcutReleaseObservers(
            tabList,
            activeTab.windowId,
            shortcut,
            commandStartedAt
          );
        }
      };
      clearScheduledSwitcherThumbnailCapture(activeTab.id);
      if (shouldTrackSwitcherTab(activeTab)) {
        recordRecentSwitcherTab(activeTab);
        if (shouldPreCaptureActiveSwitcherThumbnailBeforePayload(activeTab)) {
          captureSwitcherThumbnailForTab(
            activeTab,
            TAB_SWITCHER_CAPTURE_REASON_COMMAND_IMMEDIATE
          ).catch(() => false);
        }
      }
      const items = getRecentTabsForSwitcher(tabList, activeTab.id);
      markSwitcherThumbnailPriorityForItems(items, tabList, 'command-payload');
      if (!items.length) {
        finishOpening();
        return;
      }
      const activeUrl = getResolvedTabUrl(activeTab);
      const canHostOnActiveTab = canHostSwitcherSurface(activeTab);
      const hostItem = canHostOnActiveTab
        ? items.find((item) => item && item.id === activeTab.id)
        : items.find((item) => {
          const candidate = tabList.find((tabItem) => tabItem && tabItem.id === item.id) || item;
          return item && item.id !== activeTab.id && canHostSwitcherSurface(candidate);
        });
      const hostTab = canHostOnActiveTab
        ? activeTab
        : (hostItem ? tabList.find((item) => item && item.id === hostItem.id) : null);
      const selectedIndex = getDefaultSwitcherSelectedIndex(items, activeTab.id);
      if (!hostTab || typeof hostTab.id !== 'number') {
        openNewtabFallbackForUrl(activeUrl, { sourceTab: activeTab });
        finishOpening();
        return;
      }
      openingHostTabId = hostTab.id;
      if (hostTab.id !== activeTab.id) {
        focusWindowAndActivateTab(hostTab.id, hostTab.windowId, (result) => {
          if (!result || result.ok === false) {
            finishOpening();
            return;
          }
          injectTabSwitcherOnTab(hostTab, items, {
            currentTabId: activeTab.id,
            selectedIndex,
            shortcut,
            source,
            onOpenComplete: finishOpeningAndArmShortcutRelease
          });
        });
        return;
      }
      injectTabSwitcherOnTab(hostTab, items, {
        currentTabId: activeTab.id,
        selectedIndex,
        shortcut,
        source,
        onOpenComplete: finishOpeningAndArmShortcutRelease
      });
    }).catch(() => {
      finishOpening();
    });
  });
}

function detectAnyActiveVideoPiP(callback) {
  chrome.tabs.query({}, (tabs) => {
    const tabList = Array.isArray(tabs) ? tabs : [];
    const candidates = tabList.filter((tab) => {
      if (!tab || typeof tab.id !== 'number') {
        return false;
      }
      const tabUrl = getResolvedTabUrl(tab);
      if (isRestrictedUrl(tabUrl)) {
        return false;
      }
      return true;
    });
    if (!candidates.length) {
      callback(false, { checked: 0, foundTabId: null });
      return;
    }
    let pending = candidates.length;
    let finished = false;
    let checked = 0;
    const done = (active, tabId) => {
      if (finished) {
        return;
      }
      finished = true;
      callback(Boolean(active), {
        checked: checked,
        foundTabId: typeof tabId === 'number' ? tabId : null
      });
    };
    candidates.forEach((tab) => {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: () => {
          const pipElement = document.pictureInPictureElement;
          return {
            hasPiP: Boolean(pipElement),
            isVideoPiP: Boolean(pipElement && pipElement.tagName === 'VIDEO')
          };
        }
      }, (results) => {
        checked += 1;
        pending -= 1;
        if (finished) {
          return;
        }
        if (!chrome.runtime.lastError) {
          const payload = Array.isArray(results) && results[0] ? results[0].result : null;
          if (payload && payload.hasPiP && payload.isVideoPiP) {
            done(true, tab.id);
            return;
          }
        }
        if (pending <= 0) {
          done(false, null);
        }
      });
    });
  });
}

function openDocumentPipPickerOnTab(activeTab, source) {
  if (!documentPipEnabledCache) {
    logHotkeyDebug('document-pip-disabled', { source: source || '' });
    openExtensionOptionsPage();
    return;
  }
  if (!activeTab || typeof activeTab.id !== 'number') {
    logHotkeyDebug('document-pip-no-active-tab', { source: source || '' });
    openExtensionOptionsPage();
    return;
  }
  const activeUrl = getResolvedTabUrl(activeTab);
  const restricted = isRestrictedUrl(activeUrl);
  logHotkeyDebug('document-pip-active-tab', {
    tabId: activeTab.id,
    url: activeUrl,
    restricted: restricted,
    source: source || ''
  });
  if (restricted) {
    logHotkeyDebug('document-pip-restricted-url', {
      tabId: activeTab.id,
      url: activeUrl,
      source: source || ''
    });
    openExtensionOptionsPage();
    return;
  }
  const injectAndInvoke = (invokeMode) => {
    chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      files: [
        'src/shared/codex-debug-surface.js',
        'src/content/document-pip-picker.js'
      ]
    }, () => {
      if (chrome.runtime.lastError) {
        logHotkeyDebug('document-pip-inject-failed', {
          step: 'src/content/document-pip-picker.js',
          tabId: activeTab.id,
          error: chrome.runtime.lastError.message || 'unknown',
          source: source || ''
        });
        openExtensionOptionsPage();
        return;
      }
      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: (mode) => {
          const controller = window.__lumnoDocumentPiPPicker2026;
          if (!controller || typeof controller.toggle !== 'function') {
            return { ok: false, reason: 'picker-missing' };
          }
          if (mode === 'conflict-toast') {
            if (typeof controller.notifyVideoPiPConflict === 'function') {
              return controller.notifyVideoPiPConflict();
            }
            return { ok: false, reason: 'picker-conflict-handler-missing' };
          }
          return controller.toggle();
        },
        args: [invokeMode]
      }, (results) => {
        if (chrome.runtime.lastError) {
          logHotkeyDebug('document-pip-toggle-failed', {
            step: 'toggle',
            tabId: activeTab.id,
            error: chrome.runtime.lastError.message || 'unknown',
            source: source || '',
            mode: invokeMode || 'toggle'
          });
          return;
        }
        const result = Array.isArray(results) && results[0] ? results[0].result : null;
        logHotkeyDebug('document-pip-toggle', {
          tabId: activeTab.id,
          source: source || '',
          mode: invokeMode || 'toggle',
          result: result && typeof result === 'object' ? result : {}
        });
      });
    });
  };

  detectAnyActiveVideoPiP((hasActiveVideoPiP, detail) => {
    if (hasActiveVideoPiP) {
      logHotkeyDebug('document-pip-blocked-by-active-video-pip', {
        tabId: activeTab.id,
        source: source || '',
        checkedTabs: detail && typeof detail.checked === 'number' ? detail.checked : 0,
        pipTabId: detail && typeof detail.foundTabId === 'number' ? detail.foundTabId : null
      });
      injectAndInvoke('conflict-toast');
      return;
    }
    injectAndInvoke('toggle');
  });
}

function getDefaultFallbackShortcutByPlatform(platformOs) {
  return platformOs === 'mac' ? 'Command+Shift+K' : 'Ctrl+Shift+K';
}

function getDefaultFallbackShortcut(callback) {
  if (!chrome || !chrome.runtime || typeof chrome.runtime.getPlatformInfo !== 'function') {
    callback('Ctrl+Shift+K');
    return;
  }
  chrome.runtime.getPlatformInfo((info) => {
    const os = info && typeof info.os === 'string' ? info.os : '';
    callback(getDefaultFallbackShortcutByPlatform(os));
  });
}

function getConfiguredFallbackShortcut(callback) {
  getDefaultFallbackShortcut((defaultShortcut) => {
    if (!chrome || !chrome.commands || typeof chrome.commands.getAll !== 'function') {
      callback(defaultShortcut);
      return;
    }
    chrome.commands.getAll((commands) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        callback(defaultShortcut);
        return;
      }
      const items = Array.isArray(commands) ? commands : [];
      const command = items.find((item) => item && item.name === SHOW_SEARCH_COMMAND_NAME);
      const shortcut = command && typeof command.shortcut === 'string'
        ? normalizeShortcutFromCommandsValue(command.shortcut)
        : '';
      callback(shortcut || defaultShortcut);
    });
  });
}

function getConfiguredTabSwitcherShortcut(callback) {
  const fallbackShortcut = 'Alt+Q';
  if (!chrome || !chrome.commands || typeof chrome.commands.getAll !== 'function') {
    callback(fallbackShortcut);
    return;
  }
  chrome.commands.getAll((commands) => {
    if (chrome.runtime && chrome.runtime.lastError) {
      callback(fallbackShortcut);
      return;
    }
    const items = Array.isArray(commands) ? commands : [];
    const command = items.find((item) => item && item.name === SHOW_TAB_SWITCHER_COMMAND_NAME);
    const shortcut = command && typeof command.shortcut === 'string'
      ? String(command.shortcut).trim()
      : '';
    callback(shortcut || fallbackShortcut);
  });
}

function normalizeShortcutFromCommandsValue(value) {
  const text = String(value || '').trim();
  if (!text || text.includes('%')) {
    return '';
  }
  const parts = text.split('+').map((item) => String(item || '').trim()).filter(Boolean);
  if (parts.length < 2) {
    return '';
  }
  const keyToken = parts[parts.length - 1];
  if (!/^[A-Za-z0-9]$/.test(keyToken) && !/^F\d{1,2}$/i.test(keyToken)) {
    const specialKeys = new Set([
      'Tab', 'Enter', 'Return', 'Escape', 'Esc', 'Space', 'Spacebar',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      ',', '.', '/', ';', '\'', '-', '+', '\\', '`', '[', ']'
    ]);
    if (!specialKeys.has(keyToken)) {
      return '';
    }
  }
  let hasModifier = false;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const token = parts[i].toLowerCase();
    const isModifier =
      token === 'ctrl' ||
      token === 'control' ||
      token === 'macctrl' ||
      token === 'alt' ||
      token === 'option' ||
      token === 'shift' ||
      token === 'command' ||
      token === 'cmd' ||
      token === 'meta' ||
      token === 'super';
    if (!isModifier) {
      return '';
    }
    hasModifier = true;
  }
  return hasModifier ? text : '';
}

function getConfiguredCopyUrlCommandShortcut(callback) {
  if (!chrome || !chrome.commands || typeof chrome.commands.getAll !== 'function') {
    callback('');
    return;
  }
  chrome.commands.getAll((commands) => {
    if (chrome.runtime && chrome.runtime.lastError) {
      callback('');
      return;
    }
    const items = Array.isArray(commands) ? commands : [];
    const command = items.find((item) => item && item.name === SHOW_SEARCH_PREFILL_V_COMMAND_NAME);
    const shortcut = command && typeof command.shortcut === 'string'
      ? normalizeShortcutFromCommandsValue(command.shortcut)
      : '';
    callback(shortcut || '');
  });
}

function triggerCopyCurrentUrlForTab(activeTab, source, callback) {
  const finish = typeof callback === 'function' ? callback : function() {};
  if (!activeTab || typeof activeTab.id !== 'number') {
    logHotkeyDebug('copy-url-no-active-tab', { source: source || '' });
    finish(false);
    return;
  }
  chrome.tabs.sendMessage(activeTab.id, { action: 'copyCurrentPageUrlFromCommand' }, (response) => {
    if (chrome.runtime && chrome.runtime.lastError) {
      logHotkeyDebug('copy-url-send-message-failed', {
        tabId: activeTab.id,
        source: source || '',
        error: chrome.runtime.lastError.message || 'unknown'
      });
      finish(false);
      return;
    }
    logHotkeyDebug('copy-url-triggered', {
      tabId: activeTab.id,
      source: source || '',
      ok: Boolean(response && response.ok)
    });
    finish(Boolean(response && response.ok));
  });
}

function publishExtensionUpdateNotice(details) {
  if (!UPDATE_NOTICE || typeof UPDATE_NOTICE.publishUpdateNotice !== 'function') {
    return;
  }
  const version = typeof UPDATE_NOTICE.getCurrentVersionTag === 'function'
    ? UPDATE_NOTICE.getCurrentVersionTag(chrome)
    : '';
  UPDATE_NOTICE.publishUpdateNotice({
    chromeApi: chrome,
    fetchImpl: typeof fetch === 'function' ? fetch : null,
    version,
    previousVersion: details && details.previousVersion ? details.previousVersion : '',
    reason: 'update'
  }).catch(() => {});
}

chrome.commands.onCommand.addListener(function(command) {
  if (
    command !== SHOW_SEARCH_COMMAND_NAME &&
    command !== SHOW_SEARCH_PREFILL_COMMAND_NAME &&
    command !== SHOW_SEARCH_PREFILL_V_COMMAND_NAME &&
    command !== SHOW_TAB_SWITCHER_COMMAND_NAME
  ) {
    return;
  }
  if (command !== SHOW_TAB_SWITCHER_COMMAND_NAME) {
  }
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
    if (command === SHOW_TAB_SWITCHER_COMMAND_NAME) {
      triggerTabSwitcherForTab(activeTabs[0], source);
      return;
    }
    triggerShowSearchForTab(activeTabs[0], source);
  });
});

if (chrome && chrome.runtime && chrome.runtime.onConnect) {
  chrome.runtime.onConnect.addListener(registerTabSwitcherExtensionPagePortConnection);
}

if (codexDebugBridge && typeof codexDebugBridge.attach === 'function') {
  codexDebugBridge.attach();
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

chrome.runtime.onInstalled.addListener((details) => {
  // Static manifest content scripts only apply to future document loads. A
  // development-extension reload keeps existing tabs alive, so install the
  // release observer there now instead of waiting for the next shortcut.
  prepareTabSwitcherShortcutReleaseObserversInOpenTabs();
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
    const isSameVersionReload = DEV_EXTENSION_STARTUP &&
      typeof DEV_EXTENSION_STARTUP.isSameVersionReload === 'function' &&
      DEV_EXTENSION_STARTUP.isSameVersionReload(details, chrome.runtime.getManifest().version);
    if (!isSameVersionReload) {
      if (typeof shouldOpenOnboardingForUpdate === 'function' && shouldOpenOnboardingForUpdate(details)) {
        openOnboardingPage({ reason: 'update' });
      }
      publishExtensionUpdateNotice(details);
    }
  }
  if (reason === 'update' || reason === 'chrome_update') {
    restorePinnedTabsFromSnapshotOnStartup().catch(() => {}).finally(() => {
      schedulePersistPinnedTabSnapshot({ skipEmptyWhenNoNormalWindows: true });
    });
    return;
  }
  schedulePersistPinnedTabSnapshot({ skipEmptyWhenNoNormalWindows: true });
});

function restoreBackgroundStateOnStartup() {
  return restorePinnedTabsFromSnapshotOnStartup().catch(() => {}).finally(() => {
    schedulePersistPinnedTabSnapshot({ skipEmptyWhenNoNormalWindows: true });
  });
}

if (chrome && chrome.runtime && chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(() => {
    prepareTabSwitcherShortcutReleaseObserversInOpenTabs();
    restoreBackgroundStateOnStartup();
  });
}
ensureTabSwitchStatsLoaded().catch(() => {});
ensureTabSwitcherStateLoaded().catch(() => {});
cleanupRemovedAiStorageKeys();
cleanupLocalOnlyBookmarkTopbarSyncStorage();

if (chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener((tab) => {
    openDocumentPipPickerOnTab(tab, 'action');
  });
}

if (chrome && chrome.tabs && chrome.tabs.onActivated) {
  chrome.tabs.onActivated.addListener((activeInfo) => {
    if (!activeInfo || typeof activeInfo.tabId !== 'number') {
      return;
    }
    recordTabSwitchEvent(activeInfo.tabId);
    if (chrome.tabs && typeof chrome.tabs.get === 'function') {
      chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          return;
        }
        ensureTabSwitcherStateLoaded().catch(() => {}).finally(() => {
          recordRecentSwitcherTab(tab);
          scheduleSwitcherThumbnailCapture(tab, 'activated');
        });
      });
    }
  });
}

if (chrome && chrome.windows && chrome.windows.onFocusChanged) {
  chrome.windows.onFocusChanged.addListener((windowId) => {
    if (typeof windowId !== 'number' ||
        windowId === chrome.windows.WINDOW_ID_NONE ||
        !chrome.tabs ||
        typeof chrome.tabs.query !== 'function') {
      return;
    }
    chrome.tabs.query({ active: true, windowId }, (tabs) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        return;
      }
      const tab = Array.isArray(tabs) && tabs.length > 0 ? tabs[0] : null;
      if (!tab || typeof tab.id !== 'number') {
        return;
      }
      ensureTabSwitcherStateLoaded().catch(() => {}).finally(() => {
        recordRecentSwitcherTab(tab);
        scheduleSwitcherThumbnailCapture(tab, 'window-focus');
      });
    });
  });
}

if (chrome && chrome.tabs && chrome.tabs.onRemoved) {
  chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    const overlayOpening = overlayOpeningByTabId.get(tabId);
    if (overlayOpening) {
      finishOverlayOpening(overlayOpening);
    }
    clearOverlayLoadingRecord(tabId);
    clearTabSwitchStat(tabId);
    removeRecentSwitcherTab(tabId);
    clearGlobalPipOwnerForTabId(tabId);
    Array.from(tabSwitcherHostTabIdByWindowId.entries()).forEach(([windowId, hostTabId]) => {
      if (hostTabId === tabId) {
        tabSwitcherHostTabIdByWindowId.delete(windowId);
      }
    });
    if (removeInfo && removeInfo.isWindowClosing) {
      return;
    }
    schedulePersistPinnedTabSnapshot();
  });
}

if (chrome && chrome.tabs && chrome.tabs.onUpdated) {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!changeInfo) {
      return;
    }
    recoverOverlayAfterLoadingUpdate(tabId, changeInfo, tab);
    if (typeof changeInfo.url === 'string' || changeInfo.status === 'complete') {
      const providerTab = Object.assign({}, tab || {}, {
        id: typeof tabId === 'number' ? tabId : (tab && tab.id),
        status: changeInfo.status || (tab && tab.status)
      });
      if (typeof changeInfo.url === 'string') {
        providerTab.url = changeInfo.url;
      }
      maybeAutoSelectRestrictedBrowserSetting(
        providerTab,
        changeInfo.status === 'complete' ? 'updated-complete' : 'updated'
      );
    }
    if (typeof changeInfo.url === 'string') {
      // URL changed means the tab semantic target changed; reset historical switch stats.
      clearTabSwitchStat(tabId);
      clearGlobalPipOwnerForTabId(tabId);
      clearSwitcherThumbnailPriority(tabId);
      updateRecentSwitcherTab(tab);
    }
    if (tab && tab.active === true && (typeof changeInfo.title === 'string' || typeof changeInfo.favIconUrl === 'string')) {
      updateRecentSwitcherTab(tab);
    }
    if (tab && tab.active === true && changeInfo.status === 'complete') {
      recordRecentSwitcherTab(tab);
      scheduleSwitcherThumbnailCapture(tab, 'updated-complete');
    }
    if (changeInfo.pinned !== undefined || typeof changeInfo.url === 'string' || changeInfo.status === 'complete') {
      schedulePersistPinnedTabSnapshot();
    }
    if (typeof changeInfo.favIconUrl === 'string' && changeInfo.favIconUrl) {
      const completedUrl = typeof changeInfo.url === 'string'
        ? changeInfo.url
        : (tab && typeof tab.url === 'string' ? tab.url : '');
      markFaviconDirtyForUrl(completedUrl);
    } else if (changeInfo.status === 'complete' && !(tab && tab.favIconUrl)) {
      const completedUrl = typeof changeInfo.url === 'string'
        ? changeInfo.url
        : (tab && typeof tab.url === 'string' ? tab.url : '');
      markFaviconDirtyForUrl(completedUrl);
    }
  });
}

if (chrome && chrome.tabs && chrome.tabs.onMoved) {
  chrome.tabs.onMoved.addListener(() => {
    schedulePersistPinnedTabSnapshot();
  });
}

if (chrome && chrome.windows && chrome.windows.onCreated) {
  chrome.windows.onCreated.addListener((windowInfo) => {
    if (windowInfo && windowInfo.incognito === true) {
      return;
    }
    if (windowInfo && windowInfo.type && windowInfo.type !== 'normal') {
      return;
    }
    restorePinnedTabsFromSnapshotOnStartup().catch(() => {}).finally(() => {
      schedulePersistPinnedTabSnapshot({ skipEmptyWhenNoNormalWindows: true });
    });
  });
}

if (chrome && chrome.windows && chrome.windows.onRemoved) {
  chrome.windows.onRemoved.addListener((windowId) => {
    tabSwitcherHostTabIdByWindowId.delete(windowId);
    schedulePersistPinnedTabSnapshot({ skipEmptyWhenNoNormalWindows: true });
  });
}

function waitForTabComplete(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId = null;
    const finish = (tab, error) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      chrome.tabs.onUpdated.removeListener(handleUpdated);
      if (error) {
        reject(error);
        return;
      }
      resolve(tab || null);
    };
    const handleUpdated = (updatedTabId, changeInfo, tab) => {
      if (updatedTabId !== tabId) {
        return;
      }
      if (changeInfo && changeInfo.status === 'complete') {
        finish(tab || null);
      }
    };
    chrome.tabs.onUpdated.addListener(handleUpdated);
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        finish(null, new Error(chrome.runtime.lastError.message || 'tab-unavailable'));
        return;
      }
      if (tab && tab.status === 'complete') {
        finish(tab);
      }
    });
    timeoutId = setTimeout(() => {
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          finish(null, new Error(chrome.runtime.lastError.message || 'tab-unavailable'));
          return;
        }
        finish(tab || null);
      });
    }, Math.max(1000, Number(timeoutMs) || 15000));
  });
}

function loadSelectionQuickActionsEnabled() {
  return new Promise((resolve) => {
    if (!storageArea || typeof storageArea.get !== 'function') {
      resolve(false);
      return;
    }
    storageArea.get([SELECTION_QUICK_ACTIONS_ENABLED_STORAGE_KEY], (result) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        resolve(false);
        return;
      }
      resolve(Boolean(result && result[SELECTION_QUICK_ACTIONS_ENABLED_STORAGE_KEY] === true));
    });
  });
}

function loadSelectionQuickActionsProvider() {
  return new Promise((resolve) => {
    if (!storageArea || typeof storageArea.get !== 'function') {
      resolve('gpt');
      return;
    }
    storageArea.get([SELECTION_QUICK_ACTIONS_PROVIDER_STORAGE_KEY], (result) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        resolve('gpt');
        return;
      }
      const rawValue = result && result[SELECTION_QUICK_ACTIONS_PROVIDER_STORAGE_KEY];
      const settings = globalThis.LumnoSettings || {};
      const providerKey = typeof settings.normalizeSelectionQuickActionsProvider === 'function'
        ? settings.normalizeSelectionQuickActionsProvider(rawValue)
        : String(rawValue || '').trim().toLowerCase();
      resolve(providerKey || 'gpt');
    });
  });
}

function loadSelectionQuickActionsGroupEnabled() {
  return new Promise((resolve) => {
    if (!storageArea || typeof storageArea.get !== 'function') {
      resolve(false);
      return;
    }
    storageArea.get([SELECTION_QUICK_ACTIONS_GROUP_ENABLED_STORAGE_KEY], (result) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        resolve(false);
        return;
      }
      resolve(Boolean(result && result[SELECTION_QUICK_ACTIONS_GROUP_ENABLED_STORAGE_KEY] === true));
    });
  });
}

let selectionTargetOpenQueue = Promise.resolve();
let selectionQuickActionFallbackProvidersPromise = null;
const selectionQuickActionGroupTitlePromises = new Map();

function loadSelectionQuickActionGroupTitle(locale) {
  const normalizedLocale = normalizeLocaleForMessages(locale);
  if (selectionQuickActionGroupTitlePromises.has(normalizedLocale)) {
    return selectionQuickActionGroupTitlePromises.get(normalizedLocale);
  }
  const fallbackTitle = String(SELECTION_TARGET.DEFAULT_GROUP_TITLE || 'AI Search');
  const localePath = chrome.runtime.getURL(`_locales/${normalizedLocale}/messages.json`);
  const titlePromise = fetch(localePath, { cache: 'no-store' })
    .then((response) => response.json())
    .then((messages) => {
      const title = messages && messages.selection_quick_actions_group_name
        ? String(messages.selection_quick_actions_group_name.message || '').trim()
        : '';
      return title || fallbackTitle;
    })
    .catch(() => fallbackTitle);
  selectionQuickActionGroupTitlePromises.set(normalizedLocale, titlePromise);
  return titlePromise;
}

function queueSelectionTargetOpen(options) {
  const task = selectionTargetOpenQueue
    .catch(() => {})
    .then(() => new Promise((resolve) => {
      SELECTION_TARGET.openSelectionTarget(chrome, options, resolve);
    }));
  selectionTargetOpenQueue = task.then(() => undefined, () => undefined);
  return task;
}

function selectSelectionQuickActionProvider(providers, requestedKey) {
  const interactive = (Array.isArray(providers) ? providers : [])
    .filter((provider) => isInteractiveSiteSearchProvider(provider));
  const normalizedKey = String(requestedKey || '').trim().toLowerCase();
  if (normalizedKey) {
    const requested = interactive.find((provider) => (
      String(provider && provider.key || '').trim().toLowerCase() === normalizedKey
    ));
    if (requested) {
      return requested;
    }
  }
  return interactive.find((provider) => String(provider && provider.key || '').toLowerCase() === 'gpt') ||
    interactive[0] ||
    null;
}

function loadSelectionQuickActionFallbackProviders() {
  if (selectionQuickActionFallbackProvidersPromise) {
    return selectionQuickActionFallbackProvidersPromise;
  }
  const localUrl = chrome.runtime.getURL('assets/data/site-search.json');
  const fallbackDefaults = typeof SEARCH_UTILS.getDefaultSiteSearchProviders === 'function'
    ? SEARCH_UTILS.getDefaultSiteSearchProviders()
    : [];
  selectionQuickActionFallbackProvidersPromise = fetch(localUrl)
    .then((response) => response.json())
    .then((data) => {
      const items = data && Array.isArray(data.items) ? data.items : [];
      return sanitizeSiteSearchProviders(items.length > 0 ? items : fallbackDefaults);
    })
    .catch(() => sanitizeSiteSearchProviders(fallbackDefaults));
  return selectionQuickActionFallbackProvidersPromise;
}

function submitSelectionPromptInTab(provider, prompt, entryUrl, tab, targetInfo) {
  const submitStrategy = String(provider && provider.submitStrategy || '').trim();
  if (!tab || typeof tab.id !== 'number') {
    return Promise.resolve({ ok: false, reason: 'tab-unavailable' });
  }
  return waitForTabComplete(tab.id, 15000)
    .catch(() => tab)
    .then(() => AI_PROVIDER_SUBMIT.submitPromptInTab(
      chrome,
      tab.id,
      prompt,
      submitStrategy,
      entryUrl
    ))
    .then((result) => ({
      ok: Boolean(result && result.ok),
      tabId: tab.id,
      url: entryUrl,
      strategy: submitStrategy,
      method: result && result.method ? result.method : '',
      reason: result && result.reason ? result.reason : '',
      openMode: targetInfo && targetInfo.mode ? targetInfo.mode : 'tab',
      groupId: targetInfo && typeof targetInfo.groupId === 'number' ? targetInfo.groupId : null,
      providerKey: String(provider && provider.key || '')
    }));
}

async function openAndSubmitSelectionPrompt(
  provider,
  prompt,
  entryUrl,
  sourceTab,
  groupEnabled,
  groupTitle
) {
  const targetOptions = {
    url: entryUrl,
    sourceTab,
    groupEnabled,
    groupTitle: groupTitle || SELECTION_TARGET.DEFAULT_GROUP_TITLE,
    groupColor: 'blue',
    splitViewAdapter: globalThis.LumnoChromeSplitViewAdapter || null
  };
  let targetInfo = await queueSelectionTargetOpen(targetOptions);
  if (!targetInfo || targetInfo.ok === false || !targetInfo.tab) {
    return {
      ok: false,
      reason: targetInfo && targetInfo.reason ? targetInfo.reason : 'selection-target-open-failed'
    };
  }
  const firstResult = await submitSelectionPromptInTab(provider, prompt, entryUrl, targetInfo.tab, targetInfo);
  if (targetInfo.mode === 'reused' && !firstResult.ok) {
    targetInfo = await queueSelectionTargetOpen({
      ...targetOptions,
      reuseExisting: false
    });
    if (!targetInfo || targetInfo.ok === false || !targetInfo.tab) {
      return {
        ok: false,
        reason: targetInfo && targetInfo.reason
          ? targetInfo.reason
          : (firstResult.reason || 'selection-target-open-failed')
      };
    }
    return submitSelectionPromptInTab(provider, prompt, entryUrl, targetInfo.tab, targetInfo);
  }
  return firstResult;
}

async function runSelectionQuickAction(request, sender) {
  const [enabled, preferredProviderKey, groupEnabled, bundledProviders, groupTitle] = await Promise.all([
    loadSelectionQuickActionsEnabled(),
    loadSelectionQuickActionsProvider(),
    loadSelectionQuickActionsGroupEnabled(),
    loadSelectionQuickActionFallbackProviders(),
    loadSelectionQuickActionGroupTitle(request.locale)
  ]);
  if (!enabled) {
    return { ok: false, reason: 'selection-quick-actions-disabled' };
  }
  if (typeof SELECTION_INTENT.buildPrompt !== 'function' ||
      typeof SELECTION_TARGET.openSelectionTarget !== 'function' ||
      typeof AI_PROVIDER_SUBMIT.submitPromptInTab !== 'function') {
    return { ok: false, reason: 'selection-runtime-unavailable' };
  }
  const rawText = typeof request.text === 'string' ? request.text : '';
  const normalizedText = typeof SELECTION_INTENT.normalizeText === 'function'
    ? SELECTION_INTENT.normalizeText(rawText)
    : rawText.trim();
  const maxLength = Number(SELECTION_INTENT.MAX_SELECTION_LENGTH) || 2400;
  const actions = Array.isArray(SELECTION_INTENT.ACTIONS) ? SELECTION_INTENT.ACTIONS : [];
  const intent = actions.includes(request.intent) ? request.intent : 'ask';
  if (!normalizedText || normalizedText.length > maxLength) {
    return { ok: false, reason: 'invalid-selection-text' };
  }
  const providers = await loadSiteSearchProviders();
  const provider = SELECTION_QUICK_ACTION_PROVIDER &&
    typeof SELECTION_QUICK_ACTION_PROVIDER.resolveSelectionQuickActionProvider === 'function'
    ? SELECTION_QUICK_ACTION_PROVIDER.resolveSelectionQuickActionProvider(
        providers,
        bundledProviders,
        preferredProviderKey,
        isInteractiveSiteSearchProvider
      )
    : selectSelectionQuickActionProvider(providers, preferredProviderKey) ||
      selectSelectionQuickActionProvider(bundledProviders, preferredProviderKey);
  if (!provider) {
    return { ok: false, reason: 'selection-provider-unavailable' };
  }
  const prompt = SELECTION_INTENT.buildPrompt(intent, normalizedText, request.locale);
  const entryUrl = getSiteSearchProviderEntryUrl(provider, prompt);
  if (!entryUrl) {
    return { ok: false, reason: 'selection-provider-url-unavailable' };
  }
  const sourceTab = sender && sender.tab ? sender.tab : null;
  return openAndSubmitSelectionPrompt(
    provider,
    prompt,
    entryUrl,
    sourceTab,
    groupEnabled,
    groupTitle
  );
}

function runInteractiveSiteSearchProvider(provider, query, sender, disposition) {
  const prompt = String(query || '').trim();
  const entryUrl = getSiteSearchProviderEntryUrl(provider, prompt);
  const submitStrategy = String((provider && provider.submitStrategy) || '').trim();
  const targetDisposition = disposition === 'currentTab'
    ? 'currentTab'
    : (disposition === 'backgroundTab' ? 'backgroundTab' : 'newTab');
  return new Promise((resolve) => {
    if (!entryUrl || !prompt || !isInteractiveSiteSearchProvider(provider)) {
      resolve({ ok: false, reason: 'invalid-provider-request' });
      return;
    }
    if (typeof AI_PROVIDER_SUBMIT.submitPromptInTab !== 'function') {
      resolve({ ok: false, reason: 'submit-runtime-unavailable' });
      return;
    }
    const finish = (result) => {
      resolve(result && typeof result === 'object' ? result : { ok: false, reason: 'unknown' });
    };
    const handleReadyTab = (tab) => {
      if (!tab || typeof tab.id !== 'number') {
        finish({ ok: false, reason: 'tab-unavailable' });
        return;
      }
      waitForTabComplete(tab.id, 15000)
        .catch(() => tab)
        .then(() => AI_PROVIDER_SUBMIT.submitPromptInTab(
          chrome,
          tab.id,
          prompt,
          submitStrategy,
          entryUrl
        ))
        .then((result) => {
          finish({
            ok: Boolean(result && result.ok),
            tabId: tab.id,
            url: entryUrl,
            strategy: submitStrategy,
            method: result && result.method ? result.method : '',
            reason: result && result.reason ? result.reason : ''
          });
        })
        .catch((error) => {
          finish({
            ok: false,
            tabId: tab.id,
            url: entryUrl,
            reason: error && error.message ? error.message : 'interactive-site-search-failed'
          });
        });
    };
    const updateTab = (tabId) => {
      chrome.tabs.update(tabId, { url: entryUrl, active: true }, (tab) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          finish({ ok: false, reason: chrome.runtime.lastError.message || 'tab-update-failed' });
          return;
        }
        handleReadyTab(tab);
      });
    };
    if (targetDisposition === 'currentTab') {
      if (sender && sender.tab && typeof sender.tab.id === 'number') {
        updateTab(sender.tab.id);
        return;
      }
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          finish({ ok: false, reason: chrome.runtime.lastError.message || 'active-tab-unavailable' });
          return;
        }
        const activeTab = Array.isArray(tabs) && tabs.length > 0 ? tabs[0] : null;
        if (activeTab && typeof activeTab.id === 'number') {
          updateTab(activeTab.id);
          return;
        }
        finish({ ok: false, reason: 'active-tab-unavailable' });
      });
      return;
    }
    const sourceTab = sender && sender.tab ? sender.tab : null;
    createTabWithSourceGroup({ url: entryUrl, active: targetDisposition !== 'backgroundTab' }, sourceTab, (tab, info) => {
      if (!info || info.ok === false) {
        finish({ ok: false, reason: (info && info.reason) || 'tab-create-failed' });
        return;
      }
      handleReadyTab(tab);
    });
  });
}

// Route message actions by feature area before invoking the original handlers.
const BACKGROUND_MESSAGE_ROUTE_GROUPS = Object.freeze({
  tabs: {
    actions: [
      'switchToTab',
      'reportTabVisible',
      'notifyOverlayClosed',
      'updateOverlayLoadingSession',
      'getTabsForOverlay',
      'trackSearchTab',
      'closeOtherTabsForOverlay'
    ],
    handler: handleTabMessage
  },
  shortcuts: {
    actions: [
      'getShowSearchShortcut',
      'getCopyCurrentUrlCommandShortcut',
      'copyCurrentPageUrl',
      'triggerShowSearchFromPageHotkey',
      'notifyTabSwitcherShortcutModifierReleased',
      'getShortcutRules'
    ],
    handler: handleShortcutMessage
  },
  pip: {
    actions: [
      'pipRequestOwnership',
      'pipReleaseOwnership',
      'openDocumentPipPicker',
      'siteTryEnterPiPInMainWorld',
      'iqiyiTryEnterPiPInMainWorld',
      'iqiyiSetupAutoPiPInMainWorld',
      'forceExitPiPInMainWorld',
      'ytForceExitPiPInMainWorld'
    ],
    handler: handlePipMessage
  },
  search: {
    actions: [
      'searchOrNavigate',
      'getSearchSuggestions',
      'getSearchEngineSuggestions',
      'recordSearchSuggestionSelection',
      'deleteHistoryUrl'
    ],
    handler: handleSearchMessage
  },
  siteSearch: {
    actions: [
      'getSiteSearchProviders',
      'runSiteSearchProviderQuery'
    ],
    handler: handleSiteSearchMessage
  },
  selectionQuickActions: {
    actions: [
      'runSelectionQuickAction'
    ],
    handler: handleSelectionQuickActionMessage
  },
  localeAndPermissions: {
    actions: [
      'getLocaleMessages',
      'getFileSchemeAccessStatus'
    ],
    handler: handleLocaleAndPermissionMessage
  },
  extensionPages: {
    actions: [
      'openOptionsPage',
      'openOnboardingPage',
      'openExtensionShortcutsPage',
      'openSiteSearchOptionsPage',
      'openReleasePage',
      'openBookmarkManager',
      'openBookmarkFolderInNewTabGroup',
      'createTab',
      'openNewTab',
      'openExtensionDetailsPage'
    ],
    handler: handleExtensionPageMessage
  },
  favicon: {
    actions: [
      'resolveFaviconCandidates',
      'getFaviconData',
      'getShortcutFaviconData',
      'resolveSiteThemeColor'
    ],
    handler: handleFaviconMessage
  }
});

const backgroundMessageRouter = typeof BACKGROUND_MESSAGE_ROUTER.createRouter === 'function'
  ? BACKGROUND_MESSAGE_ROUTER.createRouter(BACKGROUND_MESSAGE_ROUTE_GROUPS)
  : null;

function sendUnknownBackgroundMessageResponse(sendResponse) {
  sendResponse({ ok: false });
  return;
}

function dispatchBackgroundMessage(request, sender, sendResponse) {
  if (backgroundMessageRouter && typeof BACKGROUND_MESSAGE_ROUTER.dispatch === 'function') {
    return BACKGROUND_MESSAGE_ROUTER.dispatch(backgroundMessageRouter, request, sender, sendResponse);
  }
  return sendUnknownBackgroundMessageResponse(sendResponse);
}

// Listen for extension runtime messages.
chrome.runtime.onMessage.addListener(dispatchBackgroundMessage);

function handleTabMessage(request, sender, sendResponse) {
  switch (request.action) {
    case 'switchToTab': {
      if (typeof request.tabId === 'number') {
        recordTabSwitchEvent(request.tabId);
      }
      focusWindowAndActivateTab(
        request.tabId,
        typeof request.windowId === 'number' ? request.windowId : null,
        (result) => {
          sendResponse(result || { ok: false });
        }
      );
      return true;
    }
    case 'reportTabVisible': {
      const senderTab = sender && sender.tab ? sender.tab : null;
      if (senderTab && typeof senderTab.id === 'number') {
        const at = Number(request && request.at);
        const reportedAt = Number.isFinite(at) ? at : Date.now();
        recordTabSwitchEvent(senderTab.id, reportedAt);
        recordRecentSwitcherTab(senderTab, reportedAt);
        scheduleSwitcherThumbnailCapture(senderTab, 'visible');
      }
      sendResponse({ ok: true });
      return;
    }
    case 'notifyOverlayClosed': {
      const senderTab = sender && sender.tab ? sender.tab : null;
      if (senderTab && typeof senderTab.id === 'number') {
        clearOverlayLoadingRecord(senderTab.id);
      }
      sendResponse({ ok: true });
      return;
    }
    case 'updateOverlayLoadingSession': {
      updateOverlayLoadingSessionFromMessage(request, sender, sendResponse);
      return true;
    }
    case 'getTabsForOverlay': {
      ensureTabSwitchStatsLoaded()
        .catch(() => {})
        .finally(() => {
          const requestedCurrentTabId = Number.isFinite(Number(request && request.currentTabId))
            ? Number(request.currentTabId)
            : null;
          const currentTabId = sender && sender.tab && typeof sender.tab.id === 'number'
            ? sender.tab.id
            : requestedCurrentTabId;
          chrome.tabs.query({}, (tabs) => {
            const normalizedTabs = (Array.isArray(tabs) ? tabs : [])
              .filter((tab) => tab && tab.incognito !== true)
              .map((tab) => {
                const resolvedUrl = getResolvedTabUrl(tab);
                return {
                  id: tab.id,
                  title: typeof tab.title === 'string' ? tab.title : '',
                  url: resolvedUrl || '',
                  favIconUrl: typeof tab.favIconUrl === 'string' ? tab.favIconUrl : '',
                  lastAccessed: Number(tab.lastAccessed) || 0
                };
              });
            syncTabSwitchStatsFromTabList(normalizedTabs);
            const sortedTabs = sortTabsForOverlay(normalizedTabs);
            tabOverlayFetchSeq += 1;
            const withSeq = sortedTabs.map((tab) => createOverlayTabPayload(tab, tabOverlayFetchSeq));
            sendResponse({ tabs: withSeq, currentTabId: currentTabId });
          });
        });
      return true;
    }
    case 'trackSearchTab': {
      if (typeof request.tabId === 'number') {
        markPendingSearchTab(request.tabId, sender && sender.tab ? sender.tab : null);
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false });
      }
      return true;
    }
    case 'closeOtherTabsForOverlay': {
      const senderTab = sender && sender.tab ? sender.tab : null;
      if (!senderTab || typeof senderTab.id !== 'number' || typeof senderTab.windowId !== 'number') {
        sendResponse({ ok: false, reason: 'invalid-sender' });
        return;
      }
      chrome.tabs.query({ windowId: senderTab.windowId }, (tabs) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          sendResponse({ ok: false, reason: chrome.runtime.lastError.message || 'query-failed' });
          return;
        }
        const ungroupedId = chrome && chrome.tabGroups && typeof chrome.tabGroups.TAB_GROUP_ID_NONE === 'number'
          ? chrome.tabGroups.TAB_GROUP_ID_NONE
          : -1;
        const toCloseIds = (Array.isArray(tabs) ? tabs : [])
          .filter((tab) => {
            if (!tab || typeof tab.id !== 'number') {
              return false;
            }
            if (tab.id === senderTab.id) {
              return false;
            }
            if (tab.pinned) {
              return false;
            }
            if (typeof tab.groupId === 'number' && tab.groupId !== ungroupedId) {
              return false;
            }
            return true;
          })
          .map((tab) => tab.id);
        if (toCloseIds.length <= 0) {
          sendResponse({ ok: true, closedCount: 0 });
          return;
        }
        chrome.tabs.remove(toCloseIds, () => {
          if (chrome.runtime && chrome.runtime.lastError) {
            sendResponse({ ok: false, reason: chrome.runtime.lastError.message || 'remove-failed' });
            return;
          }
          sendResponse({ ok: true, closedCount: toCloseIds.length });
        });
      });
      return true;
    }
    default:
      return sendUnknownBackgroundMessageResponse(sendResponse);
  }
}

function handleShortcutMessage(request, sender, sendResponse) {
  switch (request.action) {
    case 'getShowSearchShortcut': {
      getConfiguredFallbackShortcut((shortcut) => {
        sendResponse({ shortcut: shortcut || '' });
      });
      return true;
    }
    case 'getCopyCurrentUrlCommandShortcut': {
      getConfiguredCopyUrlCommandShortcut((shortcut) => {
        sendResponse({ shortcut: shortcut || '' });
      });
      return true;
    }
    case 'copyCurrentPageUrl': {
      const senderTab = sender && sender.tab ? sender.tab : null;
      triggerCopyCurrentUrlForTab(senderTab, 'slash-command', (ok) => {
        sendResponse({ ok: Boolean(ok) });
      });
      return true;
    }
    case 'triggerShowSearchFromPageHotkey': {
      const senderTab = sender && sender.tab ? sender.tab : null;
      if (!senderTab || typeof senderTab.id !== 'number') {
        logHotkeyDebug('page-hotkey-invalid-sender', {
          hasSender: Boolean(sender),
          hasTab: Boolean(sender && sender.tab)
        });
        sendResponse({ ok: false });
        return;
      }
      const shouldPrefillCurrentUrl = Boolean(request && request.prefillCurrentUrl);
      const triggerSource = shouldPrefillCurrentUrl ? 'page-hotkey-prefill' : 'page-hotkey';
      logHotkeyDebug('received', {
        command: SHOW_SEARCH_COMMAND_NAME,
        source: triggerSource,
        tabId: senderTab.id,
        url: senderTab.url || '',
        pendingUrl: senderTab.pendingUrl || '',
        prefillCurrentUrl: shouldPrefillCurrentUrl
      });
      rememberPageHotkeyContext(senderTab);
      triggerShowSearchForTab(senderTab, triggerSource);
      sendResponse({ ok: true });
      return;
    }
    case 'notifyTabSwitcherShortcutModifierReleased': {
      const senderTab = sender && sender.tab ? sender.tab : null;
      handleTabSwitcherShortcutModifierReleased(senderTab, request && request.key, (didCommit) => {
        sendResponse({ ok: true, committed: didCommit === true });
      });
      return true;
    }
    case 'getShortcutRules': {
      loadShortcutRules().then((items) => {
        sendResponse({ items: items });
      });
      return true;
    }
    default:
      return sendUnknownBackgroundMessageResponse(sendResponse);
  }
}

function sendPipMainWorldResponse(methodName, sender, sendResponse) {
  if (!pipMainWorld || typeof pipMainWorld[methodName] !== 'function') {
    sendResponse({ ok: false, reason: 'pip-main-world-unavailable' });
    return;
  }
  pipMainWorld[methodName](sender)
    .then((result) => {
      sendResponse(result);
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        reason: error && error.message ? error.message : String(error || 'pip-main-world-failed')
      });
    });
}

function getSearchEngineSuggestionRequestKey(request, sender) {
  const senderTabId = sender && sender.tab && typeof sender.tab.id === 'number'
    ? sender.tab.id
    : 'extension';
  const senderFrameId = sender && typeof sender.frameId === 'number' ? sender.frameId : 0;
  const context = request && request.context ? String(request.context) : 'unknown';
  return `${senderTabId}:${senderFrameId}:${context}`;
}

function handlePipMessage(request, sender, sendResponse) {
  switch (request.action) {
    case 'pipRequestOwnership': {
      requestGlobalPipOwnership(sender, request && request.kind ? String(request.kind) : '')
        .then((result) => {
          sendResponse(result);
        })
        .catch((error) => {
          sendResponse({
            ok: false,
            granted: false,
            reason: error && error.message ? error.message : String(error || 'ownership-request-failed')
          });
        });
      return true;
    }
    case 'pipReleaseOwnership': {
      releaseGlobalPipOwnership(sender, request && request.token ? String(request.token) : '')
        .then((result) => {
          sendResponse(result);
        })
        .catch((error) => {
          sendResponse({
            ok: false,
            released: false,
            reason: error && error.message ? error.message : String(error || 'ownership-release-failed')
          });
        });
      return true;
    }
    case 'openDocumentPipPicker': {
      const senderTab = sender && sender.tab ? sender.tab : null;
      if (!senderTab || typeof senderTab.id !== 'number') {
        sendResponse({ ok: false, reason: 'no-sender-tab' });
        return;
      }
      openDocumentPipPickerOnTab(senderTab, 'search-command');
      sendResponse({
        ok: documentPipEnabledCache === true,
        enabled: documentPipEnabledCache === true
      });
      return;
    }
    case 'siteTryEnterPiPInMainWorld': {
      sendPipMainWorldResponse('siteTryEnterPiPInMainWorld', sender, sendResponse);
      return true;
    }
    case 'iqiyiTryEnterPiPInMainWorld': {
      sendPipMainWorldResponse('iqiyiTryEnterPiPInMainWorld', sender, sendResponse);
      return true;
    }
    case 'iqiyiSetupAutoPiPInMainWorld': {
      sendPipMainWorldResponse('iqiyiSetupAutoPiPInMainWorld', sender, sendResponse);
      return true;
    }
    case 'forceExitPiPInMainWorld': {
      sendPipMainWorldResponse('forceExitPiPInMainWorld', sender, sendResponse);
      return true;
    }
    case 'ytForceExitPiPInMainWorld': {
      sendPipMainWorldResponse('youtubeForceExitPiPInMainWorld', sender, sendResponse);
      return true;
    }
    default:
      return sendUnknownBackgroundMessageResponse(sendResponse);
  }
}

function handleSearchMessage(request, sender, sendResponse) {
  switch (request.action) {
    case 'searchOrNavigate': {
      const query = request.query ? String(request.query) : '';
      const forceSearch = Boolean(request.forceSearch);
      const openInBackgroundTab = request.disposition === 'backgroundTab';
      const sourceTab = sender && sender.tab ? sender.tab : null;
      const createResolvedTab = (url, callback) => {
        createTabWithSourceGroup({
          url: url,
          active: !openInBackgroundTab
        }, sourceTab, callback);
      };
      loadShortcutRules().then((rules) => {
        const shortcutUrl = getShortcutUrl(query, rules);
        if (shortcutUrl) {
          createResolvedTab(shortcutUrl, () => {
            sendResponse({ ok: true, url: shortcutUrl });
          });
          return;
        }
        const directUrl = !forceSearch ? getDirectNavigationUrl(query) : '';
        if (directUrl) {
          createResolvedTab(directUrl, () => {
            sendResponse({ ok: true, url: directUrl });
          });
        } else {
          // It's a search query - use browser default search engine
          const fallbackUrl = buildDefaultSearchUrl(query);
          if (openInBackgroundTab) {
            createResolvedTab(fallbackUrl, () => {
              sendResponse({ ok: true, url: fallbackUrl });
            });
            return;
          }
          if (chrome && chrome.search && typeof chrome.search.query === 'function') {
            markPendingSearchTab(null, sourceTab);
            try {
              chrome.search.query({ text: query, disposition: 'NEW_TAB' }, () => {
                if (chrome.runtime && chrome.runtime.lastError) {
                  pendingSearchAt = 0;
                  pendingSearchTabId = null;
                  pendingSearchGroupContext = null;
                  createResolvedTab(fallbackUrl, () => {
                    sendResponse({ ok: true, url: fallbackUrl });
                  });
                  return;
                }
                sendResponse({ ok: true, url: fallbackUrl });
              });
              return;
            } catch (e) {
              pendingSearchAt = 0;
              pendingSearchTabId = null;
              pendingSearchGroupContext = null;
            }
          }
          createResolvedTab(fallbackUrl, () => {
            sendResponse({ ok: true, url: fallbackUrl });
          });
        }
      });
      return true;
    }
    case 'getSearchSuggestions': {
      const query = request.query;
      getSearchSuggestions(query, {
        sourceTypes: request.sourceTypes,
        includeOpenTabs: request.includeOpenTabs
      }).then(suggestions => {
        sendResponse({ suggestions: suggestions });
      }).catch(() => {
        sendResponse({ suggestions: [] });
      });
      return true; // Keep the message channel open for async response
    }
    case 'getSearchEngineSuggestions': {
      const query = request.query;
      const requestKey = getSearchEngineSuggestionRequestKey(request, sender);
      const previousController = searchEngineSuggestionAbortControllers.get(requestKey);
      if (previousController) {
        previousController.abort();
      }
      const controller = new AbortController();
      searchEngineSuggestionAbortControllers.set(requestKey, controller);
      getSearchEngineSuggestions(query, request.localSuggestions, {
        signal: controller.signal
      }).then((suggestions) => {
        const isCurrent = searchEngineSuggestionAbortControllers.get(requestKey) === controller;
        const hasRemoteSuggestions = isCurrent && !controller.signal.aborted && suggestions.some((suggestion) => (
          suggestion && suggestion.type === 'googleSuggest'
        ));
        sendResponse({
          suggestions: isCurrent && !controller.signal.aborted ? suggestions : [],
          aborted: !isCurrent || controller.signal.aborted,
          hasRemoteSuggestions
        });
      }).catch(() => {
        sendResponse({ suggestions: [], aborted: controller.signal.aborted, hasRemoteSuggestions: false });
      }).finally(() => {
        if (searchEngineSuggestionAbortControllers.get(requestKey) === controller) {
          searchEngineSuggestionAbortControllers.delete(requestKey);
        }
      });
      return true;
    }
    case 'recordSearchSuggestionSelection': {
      recordSearchSuggestionSelection(request)
        .then((result) => {
          sendResponse(result);
        })
        .catch((error) => {
          sendResponse({
            ok: false,
            reason: error && error.message ? error.message : 'record-selection-failed'
          });
        });
      return true;
    }
    case 'deleteHistoryUrl': {
      const targetUrl = typeof request.url === 'string' ? request.url : '';
      return deleteHistoryUrlFromSearch(targetUrl, sendResponse);
    }
    default:
      return sendUnknownBackgroundMessageResponse(sendResponse);
  }
}

function deleteHistoryUrlFromSearch(targetUrl, sendResponse) {
  if (!targetUrl) {
    sendResponse({ ok: false, reason: 'invalid-url' });
    return;
  }
  if (!chrome.history || typeof chrome.history.deleteUrl !== 'function') {
    sendResponse({ ok: false, reason: 'history-api-unavailable' });
    return;
  }
  chrome.history.deleteUrl({ url: targetUrl }, () => {
    if (chrome.runtime && chrome.runtime.lastError) {
      sendResponse({ ok: false, reason: chrome.runtime.lastError.message || 'delete-history-failed' });
      return;
    }
    invalidateLocalSearchSourceCaches();
    sendResponse({ ok: true, url: targetUrl });
  });
  return true;
}

function handleSiteSearchMessage(request, sender, sendResponse) {
  switch (request.action) {
    case 'getSiteSearchProviders': {
      loadSiteSearchProviders().then((items) => {
        sendResponse({ items: items });
      });
      return true;
    }
    case 'runSiteSearchProviderQuery': {
      runInteractiveSiteSearchProvider(
        request.provider,
        request.query,
        sender,
        request.disposition
      ).then((result) => {
        if (result && result.ok) {
          if (request.provider && request.provider.category === 'aiSearch') {
          }
        }
        sendResponse(result);
      }).catch((error) => {
        sendResponse({
          ok: false,
          reason: error && error.message ? error.message : 'interactive-site-search-failed'
        });
      });
      return true;
    }
    default:
      return sendUnknownBackgroundMessageResponse(sendResponse);
  }
}

function handleSelectionQuickActionMessage(request, sender, sendResponse) {
  if (request.action !== 'runSelectionQuickAction') {
    return sendUnknownBackgroundMessageResponse(sendResponse);
  }
  runSelectionQuickAction(request, sender)
    .then((result) => {
      if (result && result.ok) {
      }
      sendResponse(result);
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        reason: error && error.message ? error.message : 'selection-quick-action-failed'
      });
    });
  return true;
}

function handleLocaleAndPermissionMessage(request, sender, sendResponse) {
  switch (request.action) {
    case 'getLocaleMessages': {
      const locale = normalizeLocaleForMessages(request.locale);
      const localePath = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
      fetch(localePath, { cache: 'no-store' })
        .then((response) => response.json())
        .then((messages) => {
          sendResponse({ messages: messages || {} });
        })
        .catch(() => {
          sendResponse({ messages: {} });
        });
      return true;
    }
    case 'getFileSchemeAccessStatus': {
      checkFileSchemeAccess((isAllowed) => {
        sendResponse({
          ok: true,
          allowed: isAllowed === true,
          supported: isAllowed !== null,
          detailsUrl: getExtensionDetailsUrl()
        });
      });
      return true;
    }
    default:
      return sendUnknownBackgroundMessageResponse(sendResponse);
  }
}

function handleExtensionPageMessage(request, sender, sendResponse) {
  switch (request.action) {
    case 'openOptionsPage': {
      openExtensionOptionsPage({ disposition: request.disposition, hash: request.hash }, (ok) => {
        sendResponse({ ok: ok !== false });
      });
      return true;
    }
    case 'openOnboardingPage': {
      openOnboardingPage({ reason: 'manual', disposition: request.disposition }, (ok) => {
        sendResponse({ ok: ok !== false });
      });
      return true;
    }
    case 'openReleasePage': {
      const reason = typeof request.reason === 'string' ? request.reason : 'manual';
      openReleasePage({ reason, disposition: request.disposition }, (ok) => {
        sendResponse({ ok: ok !== false });
      });
      return true;
    }
    case 'openExtensionShortcutsPage': {
      openExtensionShortcutsPage({ disposition: request.disposition }, (ok) => {
        sendResponse({ ok: ok !== false });
      });
      return true;
    }
    case 'openSiteSearchOptionsPage': {
      openSiteSearchOptionsPage({ disposition: request.disposition }, (ok) => {
        sendResponse({ ok: ok !== false });
      });
      return true;
    }
    case 'openBookmarkManager': {
      openBookmarkManagerPage().then((url) => {
        sendResponse({ ok: true, url: url });
      }).catch(() => {
        sendResponse({ ok: false });
      });
      return true;
    }
    case 'openBookmarkFolderInNewTabGroup': {
      if (typeof BOOKMARK_TAB_GROUPS.openBookmarkFolderInNewTabGroup !== 'function') {
        sendResponse({ ok: false, reason: 'tab-group-api-unavailable' });
        return;
      }
      const sourceTab = sender && sender.tab ? sender.tab : null;
      BOOKMARK_TAB_GROUPS.openBookmarkFolderInNewTabGroup(chrome, {
        folderId: request.folderId,
        title: request.title,
        windowId: sourceTab && typeof sourceTab.windowId === 'number'
          ? sourceTab.windowId
          : undefined,
        insertIndex: sourceTab && typeof sourceTab.index === 'number'
          ? sourceTab.index + 1
          : undefined
      }).then(sendResponse).catch((error) => {
        sendResponse({
          ok: false,
          reason: error && error.message
            ? error.message
            : 'bookmark-tab-group-failed'
        });
      });
      return true;
    }
    case 'createTab': {
      const targetUrl = typeof request.url === 'string' ? request.url : '';
      const sourceTab = sender && sender.tab ? sender.tab : null;
      if (!targetUrl) {
        sendResponse({ ok: false });
        return;
      }
      if (request.disposition === 'currentTab') {
        const senderTabId = sender && sender.tab && typeof sender.tab.id === 'number'
          ? sender.tab.id
          : null;
        const updateTab = (tabId) => {
          chrome.tabs.update(tabId, { url: targetUrl, active: true }, () => {
            sendResponse({ ok: !(chrome.runtime && chrome.runtime.lastError) });
          });
        };
        if (typeof senderTabId === 'number') {
          updateTab(senderTabId);
          return true;
        }
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const activeTab = Array.isArray(tabs) && tabs.length > 0 ? tabs[0] : null;
          if (activeTab && typeof activeTab.id === 'number') {
            updateTab(activeTab.id);
            return;
          }
          sendResponse({ ok: false });
        });
        return true;
      }
      createTabWithSourceGroup({ url: targetUrl, active: request.disposition !== 'backgroundTab' }, sourceTab, (_tab, info) => {
        sendResponse({ ok: Boolean(info && info.ok) });
      });
      return true;
    }
    case 'openNewTab': {
      createTabWithSourceGroup({
        active: request.disposition !== 'backgroundTab'
      }, sender && sender.tab ? sender.tab : null, (_tab, info) => {
        sendResponse({ ok: Boolean(info && info.ok) });
      });
      return true;
    }
    case 'openExtensionDetailsPage': {
      const detailsUrl = getExtensionDetailsUrl();
      createTabWithSourceGroup({
        url: detailsUrl,
        active: request.disposition !== 'backgroundTab'
      }, sender && sender.tab ? sender.tab : null, (_tab, info) => {
        sendResponse({ ok: Boolean(info && info.ok), url: detailsUrl });
      });
      return true;
    }
    default:
      return sendUnknownBackgroundMessageResponse(sendResponse);
  }
}

function handleFaviconMessage(request, sender, sendResponse) {
  switch (request.action) {
    case 'resolveFaviconCandidates': {
      const targetUrl = request.url || '';
      const hostOverride = request.host || '';
      const fallbackUrl = request.fallbackUrl || '';
      const preferredTheme = request.preferredTheme || '';
      const options = {
        includeChromeFallback: request.excludeChromeFallback ? false : true,
        forceFresh: request.forceFresh === true
      };
      resolveFaviconCandidates(targetUrl, hostOverride, fallbackUrl, preferredTheme, options).then((urls) => {
        sendResponse({ urls: Array.isArray(urls) ? urls : [] });
      }).catch(() => {
        sendResponse({ urls: [] });
      });
      return true;
    }
    case 'getFaviconData': {
      const targetUrl = request.url || '';
      const pageUrl = request.pageUrl || '';
      if (!targetUrl || typeof targetUrl !== 'string' || targetUrl.startsWith('data:')) {
        sendResponse({ data: '' });
        return;
      }
      loadFaviconRequestBlacklistItems().then(() => {
        if (isBlockedLocalFaviconUrl(targetUrl)) {
          logBlockedLocalFavicon(targetUrl, 'message:getFaviconData');
          sendResponse({ data: '' });
          return;
        }
        try {
          const targetHost = new URL(targetUrl).hostname;
          if (shouldBlockFaviconForHost(targetHost)) {
            sendResponse({ data: '' });
            return;
          }
        } catch (e) {
          // Ignore parse failures and continue with non-local handling.
        }
        fetchFaviconData(targetUrl, pageUrl).then((dataUrl) => {
          sendResponse({ data: dataUrl || '' });
        }).catch(() => {
          sendResponse({ data: '' });
        });
      }).catch(() => {
        sendResponse({ data: '' });
      });
      return true;
    }
    case 'getShortcutFaviconData': {
      const pageUrl = request.pageUrl || '';
      const preferredTheme = request.preferredTheme || '';
      fetchShortcutFaviconData(pageUrl, preferredTheme).then((result) => {
        sendResponse(result || {
          data: '',
          sourceUrl: '',
          width: 0,
          height: 0,
          vector: false
        });
      }).catch(() => {
        sendResponse({
          data: '',
          sourceUrl: '',
          width: 0,
          height: 0,
          vector: false
        });
      });
      return true;
    }
    case 'resolveSiteThemeColor': {
      const targetUrl = request.url || '';
      const hostOverride = request.host || '';
      const preferredTheme = request.preferredTheme || '';
      resolveSiteThemeColor(targetUrl, hostOverride, preferredTheme).then((result) => {
        sendResponse(result || { accentRgb: null, source: '' });
      }).catch(() => {
        sendResponse({ accentRgb: null, source: '' });
      });
      return true;
    }
    default:
      return sendUnknownBackgroundMessageResponse(sendResponse);
  }
}

let siteSearchCache = null;
let siteSearchPromise = null;
let searchBlacklistCache = null;
let searchBlacklistPromise = null;
let faviconRequestBlacklistCache = null;
let faviconRequestBlacklistPromise = null;
let faviconEnhancedFetchEnabledCache = null;
let faviconEnhancedFetchEnabledPromise = null;
let searchResultSourceTypesCache = null;
let searchResultSourceTypesPromise = null;
let searchSelectionStatsCache = null;
let searchSelectionStatsPromise = null;
const SEARCH_ENGINE_SUGGEST_TIMEOUT_MS = 900;
const LOCAL_SUGGEST_SOURCE_TIMEOUT_MS = 800;
const LOCAL_SEARCH_INDEX_WARMUP_TIMEOUT_MS = 80;
const HISTORY_FALLBACK_CACHE_TTL_MS = 45 * 1000;
const TOP_SITES_CACHE_TTL_MS = 30 * 1000;
const BOOKMARK_TREE_CACHE_TTL_MS = 2 * 60 * 1000;
let historyFallbackCache = {
  expiresAt: 0,
  items: []
};
let topSitesCache = {
  expiresAt: 0,
  items: []
};
let localSearchSourceCacheListenersBound = false;
let bookmarkTreeIndexCache = {
  expiresAt: 0,
  map: null
};
let bookmarkItemsCache = {
  expiresAt: 0,
  items: []
};
let bookmarkTreeIndexPromise = null;
let bookmarkItemsPromise = null;
let bookmarkTreeCacheListenersBound = false;
const searchEngineSuggestionAbortControllers = new Map();
const SITE_SEARCH_STORAGE_KEY = '_x_extension_site_search_custom_2024_unique_';
const SITE_SEARCH_DISABLED_STORAGE_KEY = '_x_extension_site_search_disabled_2024_unique_';
const SEARCH_BLACKLIST_STORAGE_KEY = '_x_extension_search_blacklist_2026_unique_';
const FAVICON_REQUEST_BLACKLIST_STORAGE_KEY = '_x_extension_favicon_request_blacklist_2026_unique_';
const FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY = '_x_extension_favicon_enhanced_fetch_enabled_2026_unique_';
const OVERLAY_OPEN_TABS_DEFAULT_VISIBLE_STORAGE_KEY = '_x_extension_overlay_open_tabs_default_visible_2026_unique_';
const BLACKLIST_UTILS = globalThis.LumnoBlacklistUtils || {};
const SEARCH_UTILS = globalThis.LumnoSearchUtils || {};
const AI_PROVIDER_SUBMIT = globalThis.LumnoAiProviderSubmit || {};
const SELECTION_INTENT = globalThis.LumnoSelectionIntent || {};
const SELECTION_TARGET = globalThis.LumnoSelectionTarget || {};
const SELECTION_QUICK_ACTION_PROVIDER = globalThis.LumnoSelectionQuickActionProvider || {};
const DEFAULT_SEARCH_ENGINE_STORAGE_KEY = '_x_extension_default_search_engine_2024_unique_';
const CHROME_SYNC_STORAGE_KEYS = globalThis.LumnoSettings &&
  Array.isArray(globalThis.LumnoSettings.CHROME_SYNC_STORAGE_KEYS)
  ? globalThis.LumnoSettings.CHROME_SYNC_STORAGE_KEYS
  : [];
migrateStorageIfNeeded(CHROME_SYNC_STORAGE_KEYS);
if (chrome && chrome.storage && chrome.storage.sync &&
    typeof chrome.storage.sync.remove === 'function') {
  chrome.storage.sync.remove(LANGUAGE_MESSAGES_STORAGE_KEY, () => {
    void (chrome.runtime && chrome.runtime.lastError);
  });
}
const FAVICON_PROXY_SIZE = 128;
let backgroundFaviconUrlResolver = null;
const faviconDataCache = new Map();
const faviconPending = new Map();
const shortcutFaviconDataCache = new Map();
const shortcutFaviconPending = new Map();
let shortcutFaviconPolicyRevision = 0;
const titlePinyinCache = new Map();
const siteThemeColorCache = new Map();
const siteThemeColorPending = new Map();
const switcherThemeColorWarmups = new Set();
const BACKGROUND_FAVICON_DATA_CACHE_MAX_ENTRIES = 256;
const BACKGROUND_SHORTCUT_FAVICON_CACHE_MAX_ENTRIES = 64;
const SHORTCUT_FAVICON_FETCH_TIMEOUT_MS = 6500;
const SHORTCUT_FAVICON_PAGE_MAX_LENGTH = 768 * 1024;
const SHORTCUT_FAVICON_MANIFEST_MAX_BYTES = 512 * 1024;
const SHORTCUT_FAVICON_RESOURCE_MAX_BYTES = 256 * 1024;
const SITE_SEARCH_ICON_STORAGE_KEY = SHORTCUT_FAVICON.SITE_SEARCH_STORAGE_KEY ||
  '_x_extension_site_search_icon_cache_canonical_2026_unique_';

function invalidateShortcutFaviconPolicyCache() {
  shortcutFaviconPolicyRevision += 1;
  shortcutFaviconDataCache.clear();
  shortcutFaviconPending.clear();
}
const SITE_SEARCH_ICON_CACHE_OPTIONS = SHORTCUT_FAVICON.SITE_SEARCH_CACHE_OPTIONS || Object.freeze({
  cacheTtlMs: 1000 * 60 * 60 * 24 * 180,
  cacheMaxEntries: 40,
  maxDataUrlLength: 192 * 1024
});
const SITE_SEARCH_ICON_WARM_CONCURRENCY = 2;
const SITE_SEARCH_PINNED_ICON_KEYS = new Set(Object.keys(
  SHORTCUT_FAVICON.SITE_SEARCH_PINNED_ICON_ASSETS || {}
));
const BACKGROUND_SITE_THEME_CACHE_MAX_ENTRIES = 512;
const BACKGROUND_TITLE_PINYIN_CACHE_MAX_ENTRIES = 2048;
let backgroundFaviconCacheRuntime = null;
let siteSearchIconStore = null;
let siteSearchIconCache = null;
let siteSearchIconCacheLoadPromise = null;
let siteSearchIconCacheWriteTimer = null;
let siteSearchIconCacheRevision = 0;
let siteSearchIconWarmActiveCount = 0;
const siteSearchIconWarmQueue = [];
const siteSearchIconWarmPending = new Set();
const logBackgroundFaviconDecision = typeof FAVICON_UTILS.createFaviconDecisionLogger === 'function'
  ? FAVICON_UTILS.createFaviconDecisionLogger({ surface: 'background' })
  : (() => false);

function setBoundedBackgroundCacheEntry(cache, key, value, maxEntries) {
  if (typeof FAVICON_UTILS.setBoundedCacheEntry === 'function') {
    return FAVICON_UTILS.setBoundedCacheEntry(cache, key, value, maxEntries);
  }
  if (!cache || typeof cache.set !== 'function') {
    return value;
  }
  if (typeof cache.delete === 'function' && typeof cache.has === 'function' && cache.has(key)) {
    cache.delete(key);
  }
  cache.set(key, value);
  while (cache.size > maxEntries && typeof cache.keys === 'function' &&
      typeof cache.delete === 'function') {
    const oldest = cache.keys().next();
    if (!oldest || oldest.done) {
      break;
    }
    cache.delete(oldest.value);
  }
  return value;
}

function logBlockedLocalFavicon(url, candidateKind, reason, pageUrl) {
  return logBackgroundFaviconDecision(url, reason || 'local-rule', {
    pageUrl: pageUrl || url,
    candidateKind: candidateKind || 'unknown'
  });
}

function getBackgroundFaviconCacheRuntime() {
  if (!backgroundFaviconCacheRuntime && typeof FAVICON_CACHE.createFaviconCache === 'function') {
    backgroundFaviconCacheRuntime = FAVICON_CACHE.createFaviconCache({
      storageArea: (chrome && chrome.storage && chrome.storage.local) ? chrome.storage.local : null,
      windowObj: globalThis,
      normalizeFaviconHost,
      isBlockedLocalFaviconUrl,
      isChromeMonogramFaviconUrl
    });
    if (backgroundFaviconCacheRuntime &&
        typeof backgroundFaviconCacheRuntime.ensureCachesReady === 'function') {
      backgroundFaviconCacheRuntime.ensureCachesReady().catch(() => {});
    }
  }
  return backgroundFaviconCacheRuntime;
}

getBackgroundFaviconCacheRuntime();

function getBackgroundFaviconUrlResolver() {
  if (!backgroundFaviconUrlResolver && typeof FAVICON_UTILS.createFaviconUrlResolver === 'function') {
    backgroundFaviconUrlResolver = FAVICON_UTILS.createFaviconUrlResolver({
      chromeApi: chrome,
      size: FAVICON_PROXY_SIZE,
      shouldBlockFaviconForHost,
      shouldAvoidDirectFaviconForHost,
      isEnhancedFaviconFetchEnabled: (pageUrl) => (
        faviconEnhancedFetchEnabledCache === true &&
        !isUrlBlockedByFaviconRequestBlacklist(pageUrl)
      ),
      getStrictFaviconReason: (pageUrl) => {
        if (faviconEnhancedFetchEnabledCache !== true) {
          return 'global-off';
        }
        return isUrlBlockedByFaviconRequestBlacklist(pageUrl) ? 'exclusion' : '';
      },
      logFaviconDecision: logBackgroundFaviconDecision
    });
  }
  return backgroundFaviconUrlResolver;
}

const SEARCH_ENGINE_DEFS = [
  {
    id: 'google',
    name: 'Google',
    hostMatches: ['google.'],
    searchTemplate: 'https://www.google.com/search?q={query}',
    searchUrl: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`
  },
  {
    id: 'bing',
    name: 'Bing',
    hostMatches: ['bing.com'],
    searchTemplate: 'https://www.bing.com/search?q={query}',
    searchUrl: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`
  },
  {
    id: 'baidu',
    name: 'Baidu',
    hostMatches: ['baidu.com'],
    searchTemplate: 'https://www.baidu.com/s?wd={query}',
    searchUrl: (query) => `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    hostMatches: ['duckduckgo.com'],
    searchTemplate: 'https://duckduckgo.com/?q={query}',
    searchUrl: (query) => `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
  },
  {
    id: 'yahoo',
    name: 'Yahoo',
    hostMatches: ['search.yahoo.com'],
    searchTemplate: 'https://search.yahoo.com/search?p={query}',
    searchUrl: (query) => `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`
  },
  {
    id: 'yandex',
    name: 'Yandex',
    hostMatches: ['yandex.com'],
    searchTemplate: 'https://yandex.com/search/?text={query}',
    searchUrl: (query) => `https://yandex.com/search/?text=${encodeURIComponent(query)}`
  },
  {
    id: 'sogou',
    name: '搜狗',
    hostMatches: ['sogou.com'],
    searchTemplate: 'https://www.sogou.com/web?query={query}',
    searchUrl: (query) => `https://www.sogou.com/web?query=${encodeURIComponent(query)}`
  },
  {
    id: 'shenma',
    name: '神马',
    hostMatches: ['sm.cn'],
    searchTemplate: 'https://m.sm.cn/s?q={query}',
    searchUrl: (query) => `https://m.sm.cn/s?q=${encodeURIComponent(query)}`
  }
];

let defaultSearchEngineState = {
  id: 'google',
  name: 'Google',
  host: 'www.google.com',
  searchTemplate: 'https://www.google.com/search?q={query}',
  updatedAt: 0
};
let defaultSearchEngineStateReady = Promise.resolve(defaultSearchEngineState);

let pendingSearchAt = 0;
let pendingSearchTabId = null;
let pendingSearchGroupContext = null;

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function getExtensionFaviconUrl(pageUrl) {
  const resolver = getBackgroundFaviconUrlResolver();
  return resolver ? resolver.getExtensionFaviconUrl(pageUrl) : '';
}

function isBrowserInternalPageUrl(url) {
  const resolver = getBackgroundFaviconUrlResolver();
  return resolver ? resolver.isBrowserInternalPageUrl(url) : false;
}

function getGstaticFaviconUrl(pageUrl) {
  const resolver = getBackgroundFaviconUrlResolver();
  return resolver ? resolver.getGstaticFaviconUrl(pageUrl) : '';
}

function getPageFaviconCandidateUrl(pageUrl) {
  const resolver = getBackgroundFaviconUrlResolver();
  return resolver ? resolver.getPageFaviconCandidateUrl(pageUrl) : '';
}

function getHostFaviconUrl(hostname) {
  const normalized = normalizeFaviconHost(hostname);
  if (!normalized) {
    return '';
  }
  if (normalized === 'lumno.kubai.design') {
    return (chrome && chrome.runtime && typeof chrome.runtime.getURL === 'function')
      ? chrome.runtime.getURL('assets/images/lumno.png')
      : 'https://lumno.kubai.design/favicon.png';
  }
  return getGstaticFaviconUrl(`https://${normalized}/`);
}

function isFaviconProxyUrl(url) {
  return typeof FAVICON_UTILS.isFaviconProxyUrl === 'function'
    ? FAVICON_UTILS.isFaviconProxyUrl(url)
    : false;
}

function isChromeMonogramFaviconUrl(url) {
  return typeof FAVICON_UTILS.isChromeMonogramFaviconUrl === 'function'
    ? FAVICON_UTILS.isChromeMonogramFaviconUrl(url)
    : /^chrome:\/\/favicon2\//i.test(String(url || '').trim());
}

function normalizeHost(hostname) {
  if (!hostname) {
    return '';
  }
  const lower = String(hostname).toLowerCase();
  const stripped = lower.replace(/^www\./i, '');
  if (stripped === 'my.feishu.cn') {
    return 'feishu.cn';
  }
  return stripped;
}

function isLocalNetworkHost(hostname) {
  return typeof FAVICON_UTILS.isLocalNetworkHost === 'function'
    ? FAVICON_UTILS.isLocalNetworkHost(hostname)
    : false;
}

function getSearchEngineByHostname(hostname) {
  const normalized = normalizeHost(hostname);
  if (!normalized) {
    return null;
  }
  return SEARCH_ENGINE_DEFS.find((engine) =>
    engine.hostMatches.some((match) => normalized.includes(match))
  ) || null;
}

function getSearchEngineById(id) {
  if (!id) {
    return null;
  }
  return SEARCH_ENGINE_DEFS.find((engine) => engine.id === id) || null;
}

function setDefaultSearchEngineState(nextState, shouldPersist) {
  if (!nextState || !nextState.id) {
    return;
  }
  const engine = getSearchEngineById(nextState.id);
  const updated = {
    id: nextState.id,
    name: nextState.name || '',
    host: nextState.host || '',
    searchTemplate: nextState.searchTemplate || (engine ? engine.searchTemplate : ''),
    updatedAt: nextState.updatedAt || Date.now()
  };
  defaultSearchEngineState = updated;
  if (shouldPersist && storageArea) {
    storageArea.set({ [DEFAULT_SEARCH_ENGINE_STORAGE_KEY]: updated });
  }
}

function loadDefaultSearchEngineState() {
  if (!storageArea) {
    return Promise.resolve(defaultSearchEngineState);
  }
  return new Promise((resolve) => {
    storageArea.get([DEFAULT_SEARCH_ENGINE_STORAGE_KEY], (result) => {
      const stored = result ? result[DEFAULT_SEARCH_ENGINE_STORAGE_KEY] : null;
      if (stored && stored.id) {
        if (typeof SEARCH_UTILS.isRetiredSearchEngineState === 'function' &&
            SEARCH_UTILS.isRetiredSearchEngineState(stored)) {
          setDefaultSearchEngineState({
            id: 'google',
            name: 'Google',
            host: 'www.google.com',
            searchTemplate: 'https://www.google.com/search?q={query}',
            updatedAt: Date.now()
          }, true);
        } else {
          setDefaultSearchEngineState(stored, false);
        }
      }
      resolve(defaultSearchEngineState);
    });
  });
}

function isSearchEngineResultUrl(url) {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    const path = parsedUrl.pathname.toLowerCase();
    const isKnownHost = SEARCH_ENGINE_DEFS.some((engine) =>
      engine.hostMatches.some((match) => hostname.includes(match))
    );
    if (!isKnownHost) {
      return false;
    }
    const searchPaths = [
      '/search',
      '/s',
      '/s/2',
      '/web',
      '/?'
    ];
    if (path === '/' && parsedUrl.searchParams.has('q')) {
      return true;
    }
    if (path === '/' && parsedUrl.searchParams.has('wd')) {
      return true;
    }
    if (path === '/' && parsedUrl.searchParams.has('query')) {
      return true;
    }
    if (searchPaths.some((prefix) => path.startsWith(prefix))) {
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

function updateDefaultSearchEngineFromUrl(url) {
  if (!url || !isSearchEngineResultUrl(url)) {
    return false;
  }
  try {
    const parsedUrl = new URL(url);
    const engine = getSearchEngineByHostname(parsedUrl.hostname);
    if (!engine) {
      return false;
    }
    setDefaultSearchEngineState({
      id: engine.id,
      name: engine.name,
      host: normalizeHost(parsedUrl.hostname),
      searchTemplate: engine.searchTemplate,
      updatedAt: Date.now()
    }, true);
    return true;
  } catch (e) {
    return false;
  }
}

function buildDefaultSearchUrl(query) {
  const engine = getSearchEngineById(defaultSearchEngineState.id);
  if (engine && typeof engine.searchUrl === 'function') {
    return engine.searchUrl(query);
  }
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function getFaviconFallbackHost(rawInput) {
  const withoutScheme = String(rawInput || '').replace(/^https?:\/\//i, '');
  const authority = withoutScheme.split(/[/?#]/)[0] || '';
  if (!authority) {
    return '';
  }
  if (authority.startsWith('[')) {
    const endBracket = authority.indexOf(']');
    if (endBracket > 1) {
      return authority.slice(1, endBracket).toLowerCase();
    }
    return '';
  }
  if (authority.includes('::') && !authority.includes('.')) {
    return authority.toLowerCase();
  }
  return (authority.split(':')[0] || '').toLowerCase();
}

function getDirectNavigationUrl(input) {
  if (SEARCH_UTILS && typeof SEARCH_UTILS.getDirectNavigationUrl === 'function') {
    return SEARCH_UTILS.getDirectNavigationUrl(input);
  }
  return '';
}

function getDefaultSearchEngineThemeUrl() {
  const engine = getSearchEngineById(defaultSearchEngineState.id);
  if (engine && typeof engine.searchUrl === 'function') {
    return engine.searchUrl('test');
  }
  return 'https://www.google.com';
}

function getDefaultSearchEngineFaviconUrl() {
  if (defaultSearchEngineState.id === 'google') {
    return 'https://www.gstatic.com/images/branding/googleg/1x/googleg_standard_color_128dp.png';
  }
  if (defaultSearchEngineState.host) {
    return `https://${defaultSearchEngineState.host}/favicon.ico`;
  }
  const engine = getSearchEngineById(defaultSearchEngineState.id);
  if (engine) {
    try {
      const host = new URL(engine.searchUrl('test')).hostname;
      return `https://${host}/favicon.ico`;
    } catch (e) {
      return '';
    }
  }
  return 'https://www.gstatic.com/images/branding/googleg/1x/googleg_standard_color_128dp.png';
}

function parseJsonpPayload(text) {
  if (!text) {
    return null;
  }
  const start = text.indexOf('(');
  const end = text.lastIndexOf(')');
  if (start < 0 || end <= start) {
    return null;
  }
  const payload = text.slice(start + 1, end);
  try {
    return JSON.parse(payload);
  } catch (e) {
    return null;
  }
}

function extractJsonArray(text) {
  if (!text) {
    return null;
  }
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end <= start) {
    return null;
  }
  const payload = text.slice(start, end + 1);
  try {
    return JSON.parse(payload);
  } catch (e) {
    return null;
  }
}

async function fetchJson(url, options) {
  if (!url) {
    return null;
  }
  const settings = options && typeof options === 'object' ? options : {};
  const response = await fetch(url, settings.signal ? { signal: settings.signal } : undefined);
  if (!response || !response.ok) {
    return null;
  }
  return response.json();
}

async function fetchText(url, options) {
  if (!url) {
    return '';
  }
  const settings = options && typeof options === 'object' ? options : {};
  const response = await fetch(url, settings.signal ? { signal: settings.signal } : undefined);
  if (!response || !response.ok) {
    return '';
  }
  return response.text();
}

async function fetchSearchSuggestionsForEngine(query, options) {
  const engineId = defaultSearchEngineState.id;
  const settings = options && typeof options === 'object' ? options : {};
  if (!query || !engineId) {
    return [];
  }
  try {
    if (engineId === 'google') {
      const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`;
      const data = await fetchJson(url, settings);
      if (Array.isArray(data) && Array.isArray(data[1])) {
        return data[1];
      }
      return [];
    }
    if (engineId === 'bing') {
      const url = `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(query)}`;
      const data = await fetchJson(url, settings);
      if (Array.isArray(data) && Array.isArray(data[1])) {
        return data[1];
      }
      return [];
    }
    if (engineId === 'baidu') {
      const url = `https://www.baidu.com/sugrec?ie=utf-8&json=1&prod=pc&wd=${encodeURIComponent(query)}`;
      const data = await fetchJson(url, settings);
      if (data && Array.isArray(data.g)) {
        return data.g.map((item) => item && item.q).filter(Boolean);
      }
      return [];
    }
    if (engineId === 'sogou') {
      const url = `https://sor.html5.qq.com/api/getsug?m=searxng&key=${encodeURIComponent(query)}`;
      const text = await fetchText(url, settings);
      const data = extractJsonArray(text);
      if (Array.isArray(data) && Array.isArray(data[1])) {
        return data[1];
      }
      return [];
    }
    if (engineId === 'duckduckgo') {
      const url = `https://duckduckgo.com/ac/?type=list&q=${encodeURIComponent(query)}`;
      const data = await fetchJson(url, settings);
      if (Array.isArray(data)) {
        if (Array.isArray(data[1])) {
          return data[1];
        }
        return data.map((item) => item && item.phrase).filter(Boolean);
      }
      return [];
    }
    if (engineId === 'yandex') {
      const url = `https://suggest.yandex.com/suggest-ff.cgi?part=${encodeURIComponent(query)}`;
      const data = await fetchJson(url, settings);
      if (Array.isArray(data) && Array.isArray(data[1])) {
        return data[1];
      }
      return [];
    }
    if (engineId === 'quark') {
      const url = `https://sugs.m.sm.cn/web?q=${encodeURIComponent(query)}`;
      const data = await fetchJson(url, settings);
      if (data && Array.isArray(data.r)) {
        return data.r.map((item) => item && item.w).filter(Boolean);
      }
      return [];
    }
    if (engineId === 'shenma') {
      const url = `https://sugs.m.sm.cn/web?q=${encodeURIComponent(query)}`;
      const data = await fetchJson(url, settings);
      if (data && Array.isArray(data.r)) {
        return data.r.map((item) => item && item.w).filter(Boolean);
      }
      return [];
    }
    if (engineId === 'yahoo') {
      const url = `https://search.yahoo.com/sugg/gossip/gossip-us-ura/?output=sd1&command=${encodeURIComponent(query)}`;
      const text = await fetchText(url, settings);
      const data = parseJsonpPayload(text) || extractJsonArray(text);
      if (Array.isArray(data)) {
        if (Array.isArray(data[1])) {
          return data[1];
        }
        if (data[0] && Array.isArray(data[0])) {
          return data[0];
        }
      }
      if (data && Array.isArray(data.gossip && data.gossip.results)) {
        return data.gossip.results.map((item) => item && item.key).filter(Boolean);
      }
      return [];
    }
    return [];
  } catch (e) {
    return [];
  }
}

function markPendingSearchTab(tabId, sourceTab) {
  pendingSearchAt = Date.now();
  pendingSearchTabId = typeof tabId === 'number' ? tabId : null;
  pendingSearchGroupContext = getSourceTabGroupContext(sourceTab);
}

defaultSearchEngineStateReady = loadDefaultSearchEngineState();

if (chrome && chrome.tabs) {
  chrome.tabs.onCreated.addListener((tab) => {
    if (!pendingSearchAt || !tab || typeof tab.id !== 'number') {
      return;
    }
    if (Date.now() - pendingSearchAt > 5000) {
      pendingSearchAt = 0;
      pendingSearchTabId = null;
      pendingSearchGroupContext = null;
      return;
    }
    pendingSearchTabId = tab.id;
    moveTabToSourceGroupContext(tab, pendingSearchGroupContext, () => {});
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (!changeInfo || !changeInfo.url) {
      return;
    }
    if (!pendingSearchAt || (Date.now() - pendingSearchAt > 10000)) {
      pendingSearchAt = 0;
      pendingSearchTabId = null;
      pendingSearchGroupContext = null;
      return;
    }
    if (pendingSearchTabId !== null && tabId !== pendingSearchTabId) {
      return;
    }
    const updated = updateDefaultSearchEngineFromUrl(changeInfo.url);
    if (updated) {
      pendingSearchTabId = null;
      pendingSearchAt = 0;
      pendingSearchGroupContext = null;
    }
  });
}

function normalizeLocaleForMessages(locale) {
  const settings = globalThis.LumnoSettings || {};
  return typeof settings.normalizeLocale === 'function'
    ? settings.normalizeLocale(locale)
    : 'en';
}

function shouldBlockFaviconForHost(hostname) {
  return typeof FAVICON_UTILS.shouldBlockFaviconForHost === 'function'
    ? FAVICON_UTILS.shouldBlockFaviconForHost(hostname)
    : false;
}

function shouldAvoidDirectFaviconForHost(hostname) {
  return typeof FAVICON_UTILS.shouldAvoidDirectFaviconForHost === 'function'
    ? FAVICON_UTILS.shouldAvoidDirectFaviconForHost(hostname)
    : false;
}

function isAllowedFaviconProxyRequestUrl(url) {
  return typeof FAVICON_UTILS.isAllowedFaviconProxyRequestUrl === 'function'
    ? FAVICON_UTILS.isAllowedFaviconProxyRequestUrl(url)
    : /^chrome-extension:\/\/[^/]+\/_favicon\//i.test(String(url || '').trim()) ||
      /^chrome:\/\/favicon2\//i.test(String(url || '').trim());
}

function isFaviconRequestBlockedByBlacklist(url) {
  return !isAllowedFaviconProxyRequestUrl(url) && isUrlBlockedByFaviconRequestBlacklist(url);
}

function isBlockedLocalFaviconUrl(url) {
  const blockedByLocalRules = typeof FAVICON_UTILS.isBlockedLocalFaviconUrl === 'function'
    ? FAVICON_UTILS.isBlockedLocalFaviconUrl(url)
    : false;
  return blockedByLocalRules || isFaviconRequestBlockedByBlacklist(url);
}

function getFaviconHostPolicy(hostname) {
  if (typeof FAVICON_UTILS.getFaviconHostPolicy === 'function') {
    return FAVICON_UTILS.getFaviconHostPolicy(hostname, {
      shouldBlockFaviconForHost,
      shouldAvoidDirectFaviconForHost
    });
  }
  return {
    hardBlocked: Boolean(shouldBlockFaviconForHost(hostname)),
    avoidDirect: Boolean(shouldAvoidDirectFaviconForHost(hostname))
  };
}

function getFaviconTargetPolicy(targetUrl, hostOverride) {
  const inputUrl = String(targetUrl || '').trim();
  if (!inputUrl) {
    return { ok: false, inputUrl: '', parsed: null };
  }
  let parsed = null;
  try {
    parsed = new URL(inputUrl);
  } catch (e) {
    return { ok: false, inputUrl, parsed: null };
  }
  if (!/^https?:$/i.test(parsed.protocol)) {
    return { ok: false, inputUrl, parsed };
  }
  const hosts = [parsed.hostname, hostOverride].filter(Boolean);
  const policies = hosts.map((host) => getFaviconHostPolicy(host));
  const hardBlocked = policies.some((policy) => policy.hardBlocked);
  const avoidDirect = policies.some((policy) => policy.avoidDirect);
  const requestBlacklisted = isUrlBlockedByFaviconRequestBlacklist(inputUrl);
  return {
    ok: true,
    inputUrl,
    parsed,
    normalizedHost: normalizeFaviconHost(hostOverride || parsed.hostname),
    hardBlocked,
    avoidDirect,
    requestBlacklisted,
    directFetchBlocked: requestBlacklisted || hardBlocked || avoidDirect
  };
}

function normalizeFaviconHost(hostname) {
  return typeof FAVICON_UTILS.normalizeFaviconHost === 'function'
    ? FAVICON_UTILS.normalizeFaviconHost(hostname)
    : String(hostname || '').toLowerCase().replace(/^www\./i, '');
}

function normalizeThemePreference(theme) {
  const settings = globalThis.LumnoSettings || {};
  return typeof settings.normalizeThemePreference === 'function'
    ? settings.normalizeThemePreference(theme)
    : '';
}

function parseCssThemeColor(color) {
  return typeof FAVICON_UTILS.parseCssThemeColor === 'function'
    ? FAVICON_UTILS.parseCssThemeColor(color)
    : null;
}

function parseHtmlThemeColorCandidates(html, pageUrl, preferredTheme) {
  return typeof FAVICON_UTILS.parseHtmlThemeColorCandidates === 'function'
    ? FAVICON_UTILS.parseHtmlThemeColorCandidates(html, pageUrl, normalizeThemePreference(preferredTheme))
    : [];
}

function pickBestThemeColorCandidate(candidates) {
  return typeof FAVICON_UTILS.pickBestThemeColorCandidate === 'function'
    ? FAVICON_UTILS.pickBestThemeColorCandidate(candidates)
    : null;
}

function normalizeThemeAccentRgb(value) {
  if (!Array.isArray(value) || value.length !== 3) {
    return null;
  }
  const rgb = value.map((channel) => Math.round(Number(channel)));
  return rgb.every((channel) => Number.isFinite(channel) && channel >= 0 && channel <= 255)
    ? rgb
    : null;
}

function getThemeColorConfidence(accentRgb) {
  return typeof FAVICON_UTILS.getThemeColorConfidence === 'function'
    ? FAVICON_UTILS.getThemeColorConfidence(accentRgb)
    : 'color';
}

function buildSiteThemeColorResult(accentRgb, source, options) {
  const rgb = normalizeThemeAccentRgb(accentRgb);
  if (!rgb) {
    return null;
  }
  const confidence = options && options.confidence
    ? String(options.confidence)
    : getThemeColorConfidence(rgb);
  const neutral = options && typeof options.neutral === 'boolean'
    ? options.neutral
    : confidence === 'neutral';
  return {
    accentRgb: rgb,
    source: source || 'meta',
    neutral,
    confidence
  };
}

function fetchManifestThemeColor(manifestUrl) {
  // Arbitrary manifest URLs are untrusted network targets. Theme extraction
  // intentionally stays browser-cache-only instead of making a privileged GET.
  return Promise.resolve(null);
}

function resolveThemeColorCandidates(candidates) {
  const sorted = (Array.isArray(candidates) ? candidates : [])
    .filter((item) => item && (item.accentRgb || item.manifestUrl))
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  let index = 0;
  const next = () => {
    const candidate = sorted[index];
    index += 1;
    if (!candidate) {
      return Promise.resolve(null);
    }
    if (candidate.accentRgb) {
      return Promise.resolve(buildSiteThemeColorResult(candidate.accentRgb, candidate.source || 'meta', {
        neutral: candidate.neutral,
        confidence: candidate.confidence
      }));
    }
    if (candidate.manifestUrl) {
      return fetchManifestThemeColor(candidate.manifestUrl).then((result) => result || next());
    }
    return next();
  };
  return next();
}

function resolveSiteThemeColor(targetUrl, hostOverride, preferredTheme) {
  const inputUrl = String(targetUrl || '').trim();
  if (!inputUrl) {
    return Promise.resolve(null);
  }
  return Promise.all([
    loadFaviconRequestBlacklistItems(),
    loadFaviconEnhancedFetchEnabled()
  ]).then(([, enhancedFetchEnabled]) => {
    const targetPolicy = getFaviconTargetPolicy(inputUrl, hostOverride);
    if (!targetPolicy.ok) {
      return null;
    }
    logBlockedLocalFavicon(
      inputUrl,
      'theme-page',
      !enhancedFetchEnabled
        ? 'global-off'
        : (targetPolicy.requestBlacklisted ? 'exclusion' : 'direct-network-disabled'),
      inputUrl
    );
    return null;
  });
}

function buildFaviconFallbackCandidates(pageUrl, hostOverride, fallbackUrl, options) {
  const candidates = [];
  const inputUrl = String(pageUrl || '').trim();
  const fallback = String(fallbackUrl || '').trim();
  const settings = options && typeof options === 'object' ? options : {};
  const targetPolicy = settings.targetPolicy || getFaviconTargetPolicy(inputUrl, hostOverride);
  if (targetPolicy.hardBlocked) {
    return [];
  }
  if (inputUrl) {
    candidates.push({ url: getExtensionFaviconUrl(inputUrl), score: 30 });
    if (settings.enhancedFetchEnabled === true) {
      candidates.push({ url: getGstaticFaviconUrl(inputUrl), score: 20 });
    }
  }
  return candidates.filter((item) => item && item.url);
}

function dedupeAndSortFaviconCandidates(candidates) {
  const byUrl = new Map();
  (candidates || []).forEach((item) => {
    if (!item || !item.url) {
      return;
    }
    const key = String(item.url);
    const current = byUrl.get(key);
    if (!current || Number(item.score || 0) > Number(current.score || 0)) {
      byUrl.set(key, { url: key, score: Number(item.score || 0) });
    }
  });
  return Array.from(byUrl.values())
    .sort((a, b) => b.score - a.score)
    .map((item) => item.url);
}

function resolveFaviconCandidates(targetUrl, hostOverride, fallbackUrl) {
  const inputUrl = String(targetUrl || '').trim();
  if (!inputUrl) {
    return Promise.resolve([]);
  }
  return Promise.all([
    loadFaviconRequestBlacklistItems(),
    loadFaviconEnhancedFetchEnabled()
  ]).then(([, enhancedFetchEnabled]) => {
    const targetPolicy = getFaviconTargetPolicy(inputUrl, hostOverride);
    if (!targetPolicy.ok) {
      return [];
    }
    if (targetPolicy.hardBlocked) {
      logBlockedLocalFavicon(targetUrl || hostOverride || '', 'resolveFaviconCandidates');
      return [];
    }
    const strictReason = !enhancedFetchEnabled
      ? 'global-off'
      : (targetPolicy.requestBlacklisted ? 'exclusion' : '');
    const effectiveEnhancedFetchEnabled = enhancedFetchEnabled && !targetPolicy.requestBlacklisted;
    if (strictReason) {
      if (fallbackUrl) {
        logBlockedLocalFavicon(fallbackUrl, 'direct', strictReason, inputUrl);
      }
      logBlockedLocalFavicon(getGstaticFaviconUrl(inputUrl), 'third-party-proxy', strictReason, inputUrl);
    }
    return dedupeAndSortFaviconCandidates(buildFaviconFallbackCandidates(inputUrl, hostOverride, fallbackUrl, {
      enhancedFetchEnabled: effectiveEnhancedFetchEnabled,
      skipDirectFallback: !enhancedFetchEnabled || targetPolicy.requestBlacklisted || targetPolicy.avoidDirect,
      targetPolicy
    }));
  });
}

function getShortcutFaviconPreferredTheme(value) {
  const theme = String(value || '').trim().toLowerCase();
  return theme === 'dark' || theme === 'light' ? theme : '';
}

function readShortcutFaviconResponsePrefix(response, maxLength) {
  const limit = Math.max(1, Number(maxLength) || SHORTCUT_FAVICON_PAGE_MAX_LENGTH);
  if (!response || !response.body || typeof response.body.getReader !== 'function' ||
      typeof TextDecoder !== 'function') {
    return response.text().then((text) => String(text || '').slice(0, limit));
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  const readNext = () => reader.read().then((result) => {
    if (!result || result.done) {
      text += decoder.decode();
      return text.slice(0, limit);
    }
    text += decoder.decode(result.value, { stream: true });
    if (text.length >= limit) {
      return Promise.resolve(reader.cancel()).catch(() => {}).then(() => text.slice(0, limit));
    }
    return readNext();
  });
  return readNext().catch(() => text.slice(0, limit));
}

function canFetchShortcutFaviconUrl(url) {
  const policy = getFaviconTargetPolicy(url, '');
  return Boolean(
    policy.ok &&
    !policy.directFetchBlocked &&
    canFetchPageForFavicon(url)
  );
}

function fetchShortcutFaviconDocument(pageUrl, signal) {
  return Promise.resolve(null);
}

function fetchShortcutFaviconManifest(manifestUrl, signal) {
  return Promise.resolve([]);
}

function fetchShortcutFaviconResource(candidate, pageUrl, signal) {
  const sourceUrl = candidate && candidate.url ? String(candidate.url) : '';
  if (!sourceUrl || !isAllowedFaviconProxyRequestUrl(sourceUrl)) {
    return Promise.resolve(null);
  }
  return fetch(sourceUrl, {
    cache: 'force-cache',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    redirect: 'error',
    signal
  }).then((response) => {
    if (!response || !response.ok) {
      return null;
    }
    const resolvedSourceUrl = typeof response.url === 'string' && response.url
      ? response.url
      : sourceUrl;
    if (!isAllowedFaviconProxyRequestUrl(resolvedSourceUrl)) {
      return null;
    }
    const contentLength = Number(response.headers && response.headers.get
      ? response.headers.get('content-length') || 0
      : 0);
    if (Number.isFinite(contentLength) && contentLength > SHORTCUT_FAVICON_RESOURCE_MAX_BYTES) {
      return null;
    }
    return response.blob().then((blob) => ({
      blob,
      sourceUrl: resolvedSourceUrl
    }));
  }).then((result) => {
    const blob = result && result.blob;
    if (!blob || blob.size <= 0 || blob.size > SHORTCUT_FAVICON_RESOURCE_MAX_BYTES) {
      return null;
    }
    return blob.arrayBuffer().then((buffer) => {
      const inspection = typeof SHORTCUT_FAVICON.inspectIconResource === 'function'
        ? SHORTCUT_FAVICON.inspectIconResource(buffer, blob.type, result.sourceUrl, candidate)
        : null;
      if (!inspection || inspection.usable !== true) {
        return null;
      }
      return {
        data: `data:${inspection.mimeType || blob.type || 'image/png'};base64,${arrayBufferToBase64(buffer)}`,
        sourceUrl: result.sourceUrl,
        width: Number(inspection.width || 0),
        height: Number(inspection.height || 0),
        vector: inspection.vector === true,
        pageUrl
      };
    });
  }).catch(() => null);
}

function resolveShortcutFaviconData(pageUrl, preferredTheme, signal, explicitIconUrl) {
  const proxyUrl = getGstaticFaviconUrl(pageUrl);
  if (!proxyUrl) return Promise.resolve(null);
  return fetchShortcutFaviconResource({
    url: proxyUrl,
    source: 'proxy',
    declaredSize: 128,
    vector: false
  }, pageUrl, signal);
}

function fetchShortcutFaviconData(pageUrl, preferredTheme, explicitIconUrl) {
  const normalizedPageUrl = typeof SHORTCUT_FAVICON.normalizePageUrl === 'function'
    ? SHORTCUT_FAVICON.normalizePageUrl(pageUrl)
    : String(pageUrl || '').trim();
  const theme = getShortcutFaviconPreferredTheme(preferredTheme);
  if (!normalizedPageUrl) {
    return Promise.resolve(null);
  }
  const explicitIcon = String(explicitIconUrl || '').trim();
  const cacheKey = `${normalizedPageUrl}::${theme || 'auto'}::${explicitIcon}`;
  if (shortcutFaviconDataCache.has(cacheKey)) {
    return Promise.resolve(shortcutFaviconDataCache.get(cacheKey));
  }
  if (shortcutFaviconPending.has(cacheKey)) {
    return shortcutFaviconPending.get(cacheKey);
  }
  const policyRevision = shortcutFaviconPolicyRevision;
  let promise = null;
  promise = Promise.all([
    loadFaviconRequestBlacklistItems(),
    loadFaviconEnhancedFetchEnabled()
  ]).then(([, enhancedFetchEnabled]) => {
    const targetPolicy = getFaviconTargetPolicy(normalizedPageUrl, '');
    if (!enhancedFetchEnabled || !targetPolicy.ok || targetPolicy.directFetchBlocked ||
        !canFetchPageForFavicon(normalizedPageUrl)) {
      return null;
    }
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutId = setTimeout(() => {
      if (controller) {
        controller.abort();
      }
    }, SHORTCUT_FAVICON_FETCH_TIMEOUT_MS);
    return resolveShortcutFaviconData(
      normalizedPageUrl,
      theme,
      controller ? controller.signal : undefined,
      explicitIcon
    ).finally(() => clearTimeout(timeoutId));
  }).then((result) => {
    if (policyRevision === shortcutFaviconPolicyRevision) {
      setBoundedBackgroundCacheEntry(
        shortcutFaviconDataCache,
        cacheKey,
        result || null,
        BACKGROUND_SHORTCUT_FAVICON_CACHE_MAX_ENTRIES
      );
    }
    if (shortcutFaviconPending.get(cacheKey) === promise) {
      shortcutFaviconPending.delete(cacheKey);
    }
    return result || null;
  }).catch(() => {
    if (shortcutFaviconPending.get(cacheKey) === promise) {
      shortcutFaviconPending.delete(cacheKey);
    }
    return null;
  });
  shortcutFaviconPending.set(cacheKey, promise);
  return promise;
}

function getSiteSearchIconStore() {
  if (siteSearchIconStore || typeof SHORTCUT_FAVICON.createShortcutFaviconStore !== 'function') {
    return siteSearchIconStore;
  }
  siteSearchIconStore = SHORTCUT_FAVICON.createShortcutFaviconStore({
    chromeApi: chrome,
    storageArea: (chrome && chrome.storage && chrome.storage.local) ? chrome.storage.local : null,
    storageKey: SITE_SEARCH_ICON_STORAGE_KEY,
    ...SITE_SEARCH_ICON_CACHE_OPTIONS
  });
  return siteSearchIconStore;
}

function removeLegacySiteSearchIconCaches() {
  const legacyKeys = Array.isArray(SHORTCUT_FAVICON.SITE_SEARCH_LEGACY_STORAGE_KEYS)
    ? SHORTCUT_FAVICON.SITE_SEARCH_LEGACY_STORAGE_KEYS
    : [];
  const localArea = chrome && chrome.storage ? chrome.storage.local : null;
  if (legacyKeys.length === 0 || !localArea || typeof localArea.remove !== 'function') {
    return;
  }
  localArea.remove(legacyKeys, () => {
    void (chrome.runtime && chrome.runtime.lastError);
  });
}

function loadSiteSearchIconCache() {
  if (siteSearchIconCache) {
    return Promise.resolve(siteSearchIconCache);
  }
  if (siteSearchIconCacheLoadPromise) {
    return siteSearchIconCacheLoadPromise;
  }
  const store = getSiteSearchIconStore();
  if (!store || typeof store.readAll !== 'function') {
    siteSearchIconCache = {};
    return Promise.resolve(siteSearchIconCache);
  }
  siteSearchIconCacheLoadPromise = store.readAll()
    .then((cache) => {
      siteSearchIconCache = cache && typeof cache === 'object' ? cache : {};
      return siteSearchIconCache;
    })
    .catch(() => {
      siteSearchIconCache = {};
      return siteSearchIconCache;
    });
  return siteSearchIconCacheLoadPromise;
}

function getSiteSearchProviderIconPageUrl(provider) {
  if (typeof SHORTCUT_FAVICON.getSiteSearchProviderPageUrl === 'function') {
    return SHORTCUT_FAVICON.getSiteSearchProviderPageUrl(provider);
  }
  const template = provider && provider.template ? String(provider.template).trim() : '';
  if (!template) {
    return '';
  }
  try {
    const parsed = new URL(template.replace(/\{query\}/g, 'test'));
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return `${parsed.origin}/`;
  } catch (error) {
    return '';
  }
}

function getCachedSiteSearchIconDataUrl(pageUrl) {
  if (!siteSearchIconCache || typeof SHORTCUT_FAVICON.getCacheKey !== 'function') {
    return '';
  }
  const key = SHORTCUT_FAVICON.getCacheKey(pageUrl);
  const entry = key ? siteSearchIconCache[key] : null;
  return entry && entry.dataUrl ? String(entry.dataUrl) : '';
}

function hasUsableCachedSiteSearchProviderIcon(provider) {
  if (typeof SHORTCUT_FAVICON.getSiteSearchProviderIcon !== 'function') {
    return Boolean(getCachedSiteSearchIconDataUrl(getSiteSearchProviderIconPageUrl(provider)));
  }
  const icon = SHORTCUT_FAVICON.getSiteSearchProviderIcon(
    siteSearchIconCache || {},
    provider,
    Date.now(),
    SITE_SEARCH_ICON_CACHE_OPTIONS
  );
  return String(icon || '').startsWith('data:');
}

function scheduleSiteSearchIconCacheWrite() {
  if (siteSearchIconCacheWriteTimer !== null) {
    return;
  }
  siteSearchIconCacheWriteTimer = setTimeout(() => {
    siteSearchIconCacheWriteTimer = null;
    const store = getSiteSearchIconStore();
    if (!store || typeof store.writeAll !== 'function' || !siteSearchIconCache) {
      return;
    }
    const writeRevision = siteSearchIconCacheRevision;
    const writeSnapshot = siteSearchIconCache;
    store.writeAll(writeSnapshot).then((savedCache) => {
      if (siteSearchIconCacheRevision === writeRevision) {
        siteSearchIconCache = savedCache;
        return;
      }
      scheduleSiteSearchIconCacheWrite();
    }).catch(() => {});
  }, 700);
}

function pruneSiteSearchProviderIconCache(providers) {
  if (!siteSearchIconCache || typeof SHORTCUT_FAVICON.retainCachedIcons !== 'function') {
    return false;
  }
  const pageUrls = (Array.isArray(providers) ? providers : []).flatMap((provider) => {
    const providerKey = String(provider && provider.key || '').trim().toLowerCase();
    if (SITE_SEARCH_PINNED_ICON_KEYS.has(providerKey)) {
      return [];
    }
    const pageUrl = getSiteSearchProviderIconPageUrl(provider);
    return pageUrl ? [pageUrl] : [];
  });
  const nextCache = SHORTCUT_FAVICON.retainCachedIcons(
    siteSearchIconCache,
    pageUrls,
    Date.now(),
    SITE_SEARCH_ICON_CACHE_OPTIONS
  );
  if (JSON.stringify(nextCache) === JSON.stringify(siteSearchIconCache)) {
    return false;
  }
  siteSearchIconCache = nextCache;
  siteSearchIconCacheRevision += 1;
  scheduleSiteSearchIconCacheWrite();
  return true;
}

function cacheSiteSearchProviderIcon(pageUrl, result) {
  if (!result || !result.data || typeof SHORTCUT_FAVICON.setCachedIcon !== 'function') {
    return false;
  }
  const nextCache = SHORTCUT_FAVICON.setCachedIcon(
    siteSearchIconCache || {},
    pageUrl,
    result.data,
    result.sourceUrl,
    Date.now(),
    SITE_SEARCH_ICON_CACHE_OPTIONS
  );
  const cacheKey = typeof SHORTCUT_FAVICON.getCacheKey === 'function'
    ? SHORTCUT_FAVICON.getCacheKey(pageUrl)
    : pageUrl;
  const nextEntry = cacheKey && nextCache ? nextCache[cacheKey] : null;
  if (!nextEntry || nextEntry.dataUrl !== result.data) {
    return false;
  }
  siteSearchIconCache = nextCache;
  siteSearchIconCacheRevision += 1;
  scheduleSiteSearchIconCacheWrite();
  return true;
}

function drainSiteSearchIconWarmQueue() {
  while (siteSearchIconWarmActiveCount < SITE_SEARCH_ICON_WARM_CONCURRENCY &&
      siteSearchIconWarmQueue.length > 0) {
    const item = siteSearchIconWarmQueue.shift();
    if (!item || !item.pageUrl) {
      continue;
    }
    if (hasUsableCachedSiteSearchProviderIcon(item.provider)) {
      siteSearchIconWarmPending.delete(item.pageUrl);
      continue;
    }
    siteSearchIconWarmActiveCount += 1;
    fetchShortcutFaviconData(item.pageUrl, item.preferredTheme, item.explicitIcon)
      .then((result) => {
        cacheSiteSearchProviderIcon(item.pageUrl, result);
      })
      .catch(() => {})
      .finally(() => {
        siteSearchIconWarmActiveCount = Math.max(0, siteSearchIconWarmActiveCount - 1);
        siteSearchIconWarmPending.delete(item.pageUrl);
        drainSiteSearchIconWarmQueue();
      });
  }
}

function scheduleSiteSearchProviderIconWarmup(providers, preferredTheme) {
  const items = Array.isArray(providers) ? providers : [];
  if (items.length === 0) {
    return;
  }
  loadSiteSearchIconCache().then(() => {
    pruneSiteSearchProviderIconCache(items);
    items.forEach((provider) => {
      const explicitIcon = typeof SHORTCUT_FAVICON.getSiteSearchProviderExplicitIcon === 'function'
        ? SHORTCUT_FAVICON.getSiteSearchProviderExplicitIcon(provider)
        : String(provider && (provider.icon || provider.iconUrl) || '').trim();
      const pageUrl = getSiteSearchProviderIconPageUrl(provider);
      const providerKey = String(provider && provider.key || '').trim().toLowerCase();
      if (SITE_SEARCH_PINNED_ICON_KEYS.has(providerKey)) {
        return;
      }
      if (!pageUrl || hasUsableCachedSiteSearchProviderIcon(provider) || siteSearchIconWarmPending.has(pageUrl)) {
        return;
      }
      siteSearchIconWarmPending.add(pageUrl);
      siteSearchIconWarmQueue.push({
        provider,
        pageUrl,
        explicitIcon,
        preferredTheme: String(preferredTheme || '')
      });
    });
    drainSiteSearchIconWarmQueue();
  }).catch(() => {});
}

function escapeRegExp(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeDisplayText(text) {
  const raw = String(text || '');
  const withoutSpecial = raw.replace(/[\u0000-\u001F\u007F-\u009F\uFEFF\uFFF9-\uFFFD]|\p{Co}/gu, '');
  return withoutSpecial.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
}

function renderHighlightedText(target, text, query, styles) {
  const safeText = sanitizeDisplayText(text);
  const needle = String(query || '').trim();
  if (!needle) {
    target.textContent = safeText;
    return;
  }
  const parts = safeText.split(new RegExp(`(${escapeRegExp(needle)})`, 'gi'));
  if (parts.length === 1) {
    target.textContent = safeText;
    return;
  }
  parts.forEach((part) => {
    if (!part) {
      return;
    }
    if (part.toLowerCase() === needle.toLowerCase()) {
      const mark = document.createElement('mark');
      mark.style.background = styles && styles.background
        ? styles.background
        : 'var(--x-ext-mark-bg, #CFE8FF)';
      mark.style.color = styles && styles.color
        ? styles.color
        : 'var(--x-ext-mark-text, #1E3A8A)';
      mark.style.padding = '0 1px';
      mark.style.borderRadius = '2px';
      mark.style.lineHeight = 'inherit';
      mark.style.fontFamily = "'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
      mark.textContent = part;
      target.appendChild(mark);
    } else {
      target.appendChild(document.createTextNode(part));
    }
  });
}

function fetchFaviconData(url, pageUrl) {
  if (!url) {
    return Promise.resolve(null);
  }
  return Promise.all([
    loadFaviconRequestBlacklistItems(),
    loadFaviconEnhancedFetchEnabled()
  ]).then(([, enhancedFetchEnabled]) => {
    const canonicalPageUrl = getFaviconRequestMatchUrl(pageUrl || url);
    const requestExcluded = isUrlBlockedByFaviconRequestBlacklist(canonicalPageUrl);
    const effectiveEnhancedFetchEnabled = enhancedFetchEnabled && !requestExcluded;
    const sourceAllowedByMode = typeof FAVICON_UTILS.isFaviconSourceAllowedByEnhancedFetchPolicy === 'function'
      ? FAVICON_UTILS.isFaviconSourceAllowedByEnhancedFetchPolicy(url, effectiveEnhancedFetchEnabled, { chromeApi: chrome })
      : effectiveEnhancedFetchEnabled === true || (
        typeof FAVICON_UTILS.isSafeVirtualFaviconRequestUrl === 'function' &&
        FAVICON_UTILS.isSafeVirtualFaviconRequestUrl(url)
      );
    const sourceAllowed = sourceAllowedByMode && isAllowedFaviconProxyRequestUrl(url);
    if (!sourceAllowed) {
      logBlockedLocalFavicon(
        url,
        isFaviconProxyUrl(url) ? 'third-party-proxy' : 'direct',
        requestExcluded ? 'exclusion' : 'global-off',
        canonicalPageUrl
      );
      return null;
    }
    if (isBlockedLocalFaviconUrl(url) || isFaviconRequestBlockedByBlacklist(url)) {
      logBlockedLocalFavicon(url, 'fetchFaviconData');
      return null;
    }
    try {
      const parsed = new URL(url);
      if (getFaviconHostPolicy(parsed.hostname).hardBlocked) {
        return null;
      }
    } catch (e) {
      // Keep existing behavior for non-standard URL formats.
    }
    if (faviconDataCache.has(url)) {
      return faviconDataCache.get(url);
    }
    if (faviconPending.has(url)) {
      return faviconPending.get(url);
    }
    const promise = fetch(url, {
      cache: 'force-cache',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'error'
    })
      .then((response) => {
        if (!response || !response.ok) {
          return null;
        }
        const responseUrl = String(response.url || url);
        if (!isAllowedFaviconProxyRequestUrl(responseUrl)) {
          return null;
        }
        return response.blob();
      })
      .then((blob) => {
        if (!blob || blob.size > 256 * 1024) {
          return null;
        }
        return blob.arrayBuffer().then((buffer) => {
          const base64 = arrayBufferToBase64(buffer);
          return `data:${blob.type || 'image/png'};base64,${base64}`;
        });
      })
      .then((dataUrl) => {
        if (dataUrl) {
          setBoundedBackgroundCacheEntry(
            faviconDataCache,
            url,
            dataUrl,
            BACKGROUND_FAVICON_DATA_CACHE_MAX_ENTRIES
          );
        }
        faviconPending.delete(url);
        return dataUrl;
      })
      .catch(() => {
        faviconPending.delete(url);
        return null;
      });
    faviconPending.set(url, promise);
    return promise;
  });
}

function normalizeSiteSearchTemplate(template) {
  if (typeof SEARCH_UTILS.normalizeSiteSearchTemplate === 'function') {
    return SEARCH_UTILS.normalizeSiteSearchTemplate(template);
  }
  return String(template || '')
    .trim()
    .replace(/\{\{\{s\}\}\}/g, '{query}')
    .replace(/\{s\}/g, '{query}')
    .replace(/\{searchTerms\}/g, '{query}');
}

function isAiSiteSearchProvider(provider) {
  if (typeof SEARCH_UTILS.isAiSiteSearchProvider === 'function') {
    return SEARCH_UTILS.isAiSiteSearchProvider(provider);
  }
  const template = normalizeSiteSearchTemplate(provider && provider.template);
  return Boolean(provider && (
    String(provider.category || '').trim() === 'aiSearch' ||
    String(provider.action || '').trim() === 'openAndSubmit' ||
    (template && !template.includes('{query}'))
  ));
}

function isInteractiveSiteSearchProvider(provider) {
  if (typeof SEARCH_UTILS.isInteractiveSiteSearchProvider === 'function') {
    return SEARCH_UTILS.isInteractiveSiteSearchProvider(provider);
  }
  return Boolean(
    isAiSiteSearchProvider(provider) &&
    String((provider && provider.action) || '').trim() === 'openAndSubmit' &&
    (
      typeof SEARCH_UTILS.isInteractiveSiteSearchSubmitStrategy === 'function'
        ? SEARCH_UTILS.isInteractiveSiteSearchSubmitStrategy(provider && provider.submitStrategy)
        : ['geminiPrompt', 'chatgptPrompt', 'doubaoPrompt', 'qianwenQuery', 'yuanbaoPrompt', 'minimaxPrompt', 'deepseekPrompt', 'kimiPrompt'].includes(String((provider && provider.submitStrategy) || '').trim())
    )
  );
}

function sanitizeSiteSearchProviders(items) {
  if (typeof SEARCH_UTILS.sanitizeSiteSearchProviders === 'function') {
    return SEARCH_UTILS.sanitizeSiteSearchProviders(items);
  }
  return (Array.isArray(items) ? items : [])
    .filter((item) => item && item.key && item.template)
    .map((item) => {
      const template = normalizeSiteSearchTemplate(item.template);
      return {
        key: String(item.key).trim(),
        aliases: Array.isArray(item.aliases) ? item.aliases.filter(Boolean) : [],
        name: item.name || item.key,
        template,
        action: String(item.action || '').trim(),
        submitStrategy: String(item.submitStrategy || '').trim(),
        category: String(item.category || '').trim()
      };
    })
    .filter((item) => item.key && item.template && (item.template.includes('{query}') || isAiSiteSearchProvider(item)));
}

function loadCustomSiteSearchProviders() {
  return new Promise((resolve) => {
    if (!storageArea) {
      resolve([]);
      return;
    }
    storageArea.get([SITE_SEARCH_STORAGE_KEY], (result) => {
      const items = sanitizeSiteSearchProviders(result[SITE_SEARCH_STORAGE_KEY]);
      resolve(items);
    });
  });
}

function loadDisabledSiteSearchKeys() {
  return new Promise((resolve) => {
    if (!storageArea) {
      resolve([]);
      return;
    }
    storageArea.get([SITE_SEARCH_DISABLED_STORAGE_KEY], (result) => {
      const items = Array.isArray(result[SITE_SEARCH_DISABLED_STORAGE_KEY])
        ? result[SITE_SEARCH_DISABLED_STORAGE_KEY]
        : [];
      resolve(items.map((item) => String(item).toLowerCase()).filter(Boolean));
    });
  });
}

function normalizeSearchBlacklistMatchModes(value) {
  if (BLACKLIST_UTILS.normalizeMatchModes) {
    return BLACKLIST_UTILS.normalizeMatchModes(value, 'prefix');
  }
  return ['prefix'];
}

function normalizeSearchBlacklistItems(items) {
  if (BLACKLIST_UTILS.normalizeItems) {
    return BLACKLIST_UTILS.normalizeItems(items, 'prefix');
  }
  return [];
}

function normalizeFaviconRequestBlacklistItems(items) {
  if (BLACKLIST_UTILS.normalizeItems) {
    return BLACKLIST_UTILS.normalizeItems(items, 'prefix');
  }
  return [];
}

function normalizeFaviconEnhancedFetchEnabled(value) {
  const settings = globalThis.LumnoSettings || {};
  if (typeof settings.normalizeFaviconEnhancedFetchEnabled === 'function') {
    return settings.normalizeFaviconEnhancedFetchEnabled(value);
  }
  return value !== false;
}

function normalizeSearchResultSourceTypes(value) {
  const settings = globalThis.LumnoSettings || {};
  if (typeof settings.normalizeSearchResultSourceTypes === 'function') {
    return settings.normalizeSearchResultSourceTypes(value);
  }
  const rawItems = Array.isArray(value) ? value : [];
  const selected = [];
  rawItems.forEach((item) => {
    const raw = String(item || '').trim();
    const type = raw === 'topSite' || raw === 'bookmark' || raw === 'history' ? raw : '';
    if (type && !selected.includes(type)) {
      selected.push(type);
    }
  });
  return selected.length > 0 ? selected : ['topSite', 'bookmark', 'history'];
}

function areStringArraysEqual(a, b) {
  const left = Array.isArray(a) ? a : [];
  const right = Array.isArray(b) ? b : [];
  if (left.length !== right.length) {
    return false;
  }
  for (let i = 0; i < left.length; i += 1) {
    if (String(left[i]) !== String(right[i])) {
      return false;
    }
  }
  return true;
}

function loadSearchResultSourceTypes() {
  if (searchResultSourceTypesCache) {
    return Promise.resolve(searchResultSourceTypesCache);
  }
  if (searchResultSourceTypesPromise) {
    return searchResultSourceTypesPromise;
  }
  searchResultSourceTypesPromise = new Promise((resolve) => {
    if (!storageArea) {
      const defaults = normalizeSearchResultSourceTypes(null);
      searchResultSourceTypesCache = defaults;
      resolve(defaults);
      return;
    }
    storageArea.get([SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY], (result) => {
      const raw = result && result[SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY];
      const normalized = normalizeSearchResultSourceTypes(raw);
      searchResultSourceTypesCache = normalized;
      if (!areStringArraysEqual(raw, normalized)) {
        storageArea.set({ [SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY]: normalized });
      }
      resolve(normalized);
    });
  }).finally(() => {
    searchResultSourceTypesPromise = null;
  });
  return searchResultSourceTypesPromise;
}

function loadSearchBlacklistItems() {
  if (searchBlacklistCache) {
    return Promise.resolve(searchBlacklistCache);
  }
  if (searchBlacklistPromise) {
    return searchBlacklistPromise;
  }
  searchBlacklistPromise = new Promise((resolve) => {
    if (!storageArea) {
      resolve([]);
      return;
    }
    storageArea.get([SEARCH_BLACKLIST_STORAGE_KEY], (result) => {
      const items = normalizeSearchBlacklistItems(result && result[SEARCH_BLACKLIST_STORAGE_KEY]);
      searchBlacklistCache = items;
      resolve(items);
    });
  }).finally(() => {
    searchBlacklistPromise = null;
  });
  return searchBlacklistPromise;
}

function loadFaviconRequestBlacklistItems() {
  if (faviconRequestBlacklistCache) {
    return Promise.resolve(faviconRequestBlacklistCache);
  }
  if (faviconRequestBlacklistPromise) {
    return faviconRequestBlacklistPromise;
  }
  faviconRequestBlacklistPromise = new Promise((resolve) => {
    if (!storageArea) {
      resolve([]);
      return;
    }
    storageArea.get([FAVICON_REQUEST_BLACKLIST_STORAGE_KEY], (result) => {
      const items = normalizeFaviconRequestBlacklistItems(result && result[FAVICON_REQUEST_BLACKLIST_STORAGE_KEY]);
      faviconRequestBlacklistCache = items;
      resolve(items);
    });
  }).finally(() => {
    faviconRequestBlacklistPromise = null;
  });
  return faviconRequestBlacklistPromise;
}

function loadFaviconEnhancedFetchEnabled() {
  if (typeof faviconEnhancedFetchEnabledCache === 'boolean') {
    return Promise.resolve(faviconEnhancedFetchEnabledCache);
  }
  if (faviconEnhancedFetchEnabledPromise) {
    return faviconEnhancedFetchEnabledPromise;
  }
  faviconEnhancedFetchEnabledPromise = new Promise((resolve) => {
    if (!storageArea) {
      faviconEnhancedFetchEnabledCache = true;
      resolve(true);
      return;
    }
    storageArea.get([FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY], (result) => {
      const rawValue = result && result[FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY];
      const enabled = normalizeFaviconEnhancedFetchEnabled(rawValue);
      faviconEnhancedFetchEnabledCache = enabled;
      if (rawValue !== enabled) {
        storageArea.set({ [FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY]: enabled });
      }
      resolve(enabled);
    });
  }).finally(() => {
    faviconEnhancedFetchEnabledPromise = null;
  });
  return faviconEnhancedFetchEnabledPromise;
}

function getFaviconRequestMatchUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) {
    return '';
  }
  return typeof FAVICON_UTILS.getCanonicalPageUrlForFavicon === 'function'
    ? String(FAVICON_UTILS.getCanonicalPageUrlForFavicon(raw) || raw).trim()
    : raw;
}

function isUrlBlockedByFaviconRequestBlacklist(url) {
  const target = getFaviconRequestMatchUrl(url);
  return Boolean(
    target &&
    faviconRequestBlacklistCache &&
    BLACKLIST_UTILS.isUrlBlocked &&
    BLACKLIST_UTILS.isUrlBlocked(target, faviconRequestBlacklistCache)
  );
}

function normalizeSearchSelectionStats(rawStats) {
  if (typeof SEARCH_UTILS.normalizeSearchSelectionStats === 'function') {
    return SEARCH_UTILS.normalizeSearchSelectionStats(rawStats);
  }
  return { version: 1, updatedAt: 0, queries: {} };
}

function loadSearchSelectionStats() {
  if (searchSelectionStatsCache) {
    return Promise.resolve(searchSelectionStatsCache);
  }
  if (searchSelectionStatsPromise) {
    return searchSelectionStatsPromise;
  }
  searchSelectionStatsPromise = new Promise((resolve) => {
    if (!localStorageArea) {
      const emptyStats = normalizeSearchSelectionStats(null);
      searchSelectionStatsCache = emptyStats;
      resolve(emptyStats);
      return;
    }
    localStorageArea.get([SEARCH_SELECTION_STATS_STORAGE_KEY], (result) => {
      const stats = normalizeSearchSelectionStats(result && result[SEARCH_SELECTION_STATS_STORAGE_KEY]);
      searchSelectionStatsCache = stats;
      resolve(stats);
    });
  }).finally(() => {
    searchSelectionStatsPromise = null;
  });
  return searchSelectionStatsPromise;
}

function saveSearchSelectionStats(stats) {
  const normalizedStats = normalizeSearchSelectionStats(stats);
  searchSelectionStatsCache = normalizedStats;
  return new Promise((resolve) => {
    if (!localStorageArea) {
      resolve(false);
      return;
    }
    localStorageArea.set({ [SEARCH_SELECTION_STATS_STORAGE_KEY]: normalizedStats }, () => {
      resolve(!(chrome.runtime && chrome.runtime.lastError));
    });
  });
}

function shouldRecordSearchSuggestionSelectionPayload(selection) {
  if (!selection || typeof selection !== 'object') {
    return false;
  }
  const query = String(selection.query || '').trim();
  const url = String(selection.url || '').trim();
  if (!query || !url) {
    return false;
  }
  const type = String(selection.type || '').trim();
  if (type === 'newtab' ||
      type === 'googleSuggest' ||
      type === 'siteSearch' ||
      type === 'inlineSiteSearch' ||
      type === 'siteSearchPrompt' ||
      type === 'modeSwitch' ||
      type === 'commandNewTab' ||
      type === 'commandSettings') {
    return false;
  }
  return true;
}

function recordSearchSuggestionSelection(selection) {
  if (!shouldRecordSearchSuggestionSelectionPayload(selection) ||
      typeof SEARCH_UTILS.recordSearchSelectionInStats !== 'function') {
    return Promise.resolve({ ok: false, reason: 'invalid-selection' });
  }
  return loadSearchSelectionStats()
    .then((stats) => {
      const updatedStats = SEARCH_UTILS.recordSearchSelectionInStats(stats, selection);
      return saveSearchSelectionStats(updatedStats);
    })
    .then((ok) => ({ ok: ok === true }));
}

function recordSearchSuggestionSelectionFromSuggestion(suggestion, query, source) {
  if (!suggestion || suggestion.forceSearch || suggestion.provider || !suggestion.url) {
    return;
  }
  recordSearchSuggestionSelection({
    query,
    url: suggestion.url,
    title: suggestion.title || '',
    type: suggestion.type || 'history',
    source: source || 'overlay'
  }).catch(() => {});
}

function getSearchSelectionBoost(item, context, stats, options) {
  if (typeof SEARCH_UTILS.getSearchSelectionBoost !== 'function') {
    return 0;
  }
  return SEARCH_UTILS.getSearchSelectionBoost(item, context, stats, options);
}

function isUrlBlockedBySearchBlacklist(url, items) {
  if (BLACKLIST_UTILS.isUrlBlocked) {
    return BLACKLIST_UTILS.isUrlBlocked(url, items);
  }
  return false;
}

function isSuggestionBlockedBySearchBlacklist(suggestion, items, queryForProvider) {
  if (!suggestion) {
    return false;
  }
  if (
    suggestion.type === 'newtab' ||
    suggestion.type === 'siteSearch' ||
    suggestion.type === 'inlineSiteSearch' ||
    suggestion.type === 'siteSearchPrompt'
  ) {
    return false;
  }
  if (suggestion.url && isUrlBlockedBySearchBlacklist(suggestion.url, items)) {
    return true;
  }
  return false;
}

function filterBlacklistedSuggestions(list, items, queryForProvider) {
  if (!Array.isArray(list) || list.length === 0) {
    return [];
  }
  return list.filter((suggestion) => !isSuggestionBlockedBySearchBlacklist(suggestion, items, queryForProvider));
}

function mergeCustomProviders(baseItems, customItems) {
  if (typeof SEARCH_UTILS.mergeCustomProviders === 'function') {
    return SEARCH_UTILS.mergeCustomProviders(baseItems, customItems);
  }
  const merged = [];
  const seen = new Set();
  const baseMap = new Map((baseItems || []).map((item) => [String(item && item.key ? item.key : '').toLowerCase(), item]));
  customItems.forEach((item) => {
    if (item && item.disabled) {
      return;
    }
    const key = String(item.key || '').toLowerCase();
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    merged.push({
      ...item,
      action: String(item.action || (baseMap.get(key) && baseMap.get(key).action) || '').trim(),
      submitStrategy: String(item.submitStrategy || (baseMap.get(key) && baseMap.get(key).submitStrategy) || '').trim(),
      _xIsCustom: true
    });
  });
  baseItems.forEach((item) => {
    const key = String(item.key || '').toLowerCase();
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    merged.push(item);
  });
  return merged;
}

function getSiteSearchProviderEntryUrl(provider, query) {
  if (!provider || !provider.template) {
    return '';
  }
  if (typeof SEARCH_UTILS.buildSearchUrlFromTemplate === 'function') {
    return SEARCH_UTILS.buildSearchUrlFromTemplate(provider.template, query || '');
  }
  return normalizeSiteSearchTemplate(provider.template).replace(/\{query\}/g, encodeURIComponent(String(query || '')));
}

function getTemplateDomain(template) {
  if (!template) {
    return '';
  }
  try {
    const url = template.replace(/\{query\}/g, 'test');
    return normalizeHost(new URL(url).hostname);
  } catch (e) {
    return '';
  }
}

function mergeSiteSearchProviders(localItems, bangList) {
  if (!Array.isArray(localItems) || localItems.length === 0) {
    return [];
  }
  if (!Array.isArray(bangList) || bangList.length === 0) {
    return localItems;
  }
  return localItems.map((item) => {
    const aliases = Array.isArray(item.aliases) ? item.aliases : [];
    const keys = [item.key, ...aliases].filter(Boolean).map((key) => String(key).toLowerCase());
    const domain = getTemplateDomain(item.template);
    let match = bangList.find((bang) => bang && keys.includes(String(bang.t || '').toLowerCase()));
    if (!match && domain) {
      match = bangList.find((bang) => bang && String(bang.d || '').toLowerCase().includes(domain));
    }
    if (!match || !match.u) {
      return item;
    }
    return {
      key: item.key,
      aliases: item.aliases || [],
      name: item.name || match.s || item.key,
      template: normalizeSiteSearchTemplate(match.u)
    };
  });
}

function parseBangList(text) {
  if (!text) {
    return [];
  }
  let jsonText = text.trim();
  if (jsonText.startsWith('/*')) {
    jsonText = jsonText.replace(/^\/\*.*?\*\/\s*/s, '');
  }
  if (!jsonText.startsWith('[')) {
    return [];
  }
  try {
    const parsed = JSON.parse(jsonText);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function loadSiteSearchProviders() {
  if (siteSearchCache) {
    return Promise.resolve(siteSearchCache);
  }
  if (siteSearchPromise) {
    return siteSearchPromise;
  }
  const localUrl = chrome.runtime.getURL('assets/data/site-search.json');
  const fallbackDefaults = typeof SEARCH_UTILS.getDefaultSiteSearchProviders === 'function'
    ? SEARCH_UTILS.getDefaultSiteSearchProviders()
    : [];
  siteSearchPromise = fetch(localUrl)
    .then((response) => response.json())
    .then((data) => {
      const items = data && Array.isArray(data.items) ? data.items : [];
      const source = items.length > 0 ? items : fallbackDefaults;
      return sanitizeSiteSearchProviders(source);
    })
    .catch(() => sanitizeSiteSearchProviders(fallbackDefaults));
  siteSearchPromise = siteSearchPromise.then((localItems) => {
    return localItems;
  }).then((items) => Promise.all([loadCustomSiteSearchProviders(), loadDisabledSiteSearchKeys()])
    .then(([customItems, disabledKeys]) => {
      const filteredBase = items.filter((item) => {
        const key = String(item && item.key ? item.key : '').toLowerCase();
        return key && !disabledKeys.includes(key);
      });
      const merged = mergeCustomProviders(filteredBase, customItems);
      siteSearchCache = merged;
      return merged;
    })).catch(() => {
    return loadCustomSiteSearchProviders().then((customItems) => {
      siteSearchCache = customItems;
      return customItems;
    });
  });
  return siteSearchPromise;
}

function warmSiteSearchProviderIcons() {
  return loadSiteSearchProviders().then((providers) => {
    scheduleSiteSearchProviderIconWarmup(providers, '');
    return providers;
  }).catch(() => []);
}

removeLegacySiteSearchIconCaches();
warmSiteSearchProviderIcons();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (!isPrimaryStorageAreaName(areaName)) {
    return;
  }
  if (changes[RESTRICTED_ACTION_STORAGE_KEY]) {
    const next = changes[RESTRICTED_ACTION_STORAGE_KEY].newValue;
    restrictedActionCache = next === 'none' ? 'none' : 'default';
    if (typeof next !== 'undefined' && next !== restrictedActionCache && storageArea) {
      storageArea.set({ [RESTRICTED_ACTION_STORAGE_KEY]: restrictedActionCache });
    }
  }
  if (changes[RESTRICTED_ACTION_AUTO_BROWSER_SETTING_DONE_STORAGE_KEY]) {
    const next = changes[RESTRICTED_ACTION_AUTO_BROWSER_SETTING_DONE_STORAGE_KEY].newValue;
    restrictedActionAutoBrowserSettingDoneCache = next === true;
  }
  if (changes[DOCUMENT_PIP_ENABLED_STORAGE_KEY]) {
    const next = changes[DOCUMENT_PIP_ENABLED_STORAGE_KEY].newValue;
    const normalized = next === true;
    documentPipEnabledCache = normalized;
    if (typeof next !== 'undefined' && next !== normalized && storageArea) {
      storageArea.set({ [DOCUMENT_PIP_ENABLED_STORAGE_KEY]: normalized });
    }
  }
  if (changes[TAB_SWITCHER_ENABLED_STORAGE_KEY]) {
    const next = changes[TAB_SWITCHER_ENABLED_STORAGE_KEY].newValue;
    const normalized = normalizeTabSwitcherEnabled(next);
    tabSwitcherEnabledCache = normalized;
    if (typeof next !== 'undefined' && next !== normalized && storageArea) {
      storageArea.set({ [TAB_SWITCHER_ENABLED_STORAGE_KEY]: normalized });
    }
  }
  if (changes[PINNED_TAB_RECOVERY_ENABLED_STORAGE_KEY]) {
    const next = changes[PINNED_TAB_RECOVERY_ENABLED_STORAGE_KEY].newValue;
    const normalized = applyPinnedTabRecoverySetting(next);
    if (normalized) {
      schedulePersistPinnedTabSnapshot();
    }
  }
  if (changes[SITE_SEARCH_STORAGE_KEY] || changes[SITE_SEARCH_DISABLED_STORAGE_KEY]) {
    siteSearchCache = null;
    siteSearchPromise = null;
    warmSiteSearchProviderIcons();
  }
  if (changes[SEARCH_BLACKLIST_STORAGE_KEY]) {
    searchBlacklistCache = null;
    searchBlacklistPromise = null;
  }
  if (changes[FAVICON_REQUEST_BLACKLIST_STORAGE_KEY]) {
    faviconRequestBlacklistCache = null;
    faviconRequestBlacklistPromise = null;
    invalidateShortcutFaviconPolicyCache();
  }
  if (changes[FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY]) {
    faviconEnhancedFetchEnabledCache = null;
    faviconEnhancedFetchEnabledPromise = null;
    invalidateShortcutFaviconPolicyCache();
  }
  if (changes[SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY]) {
    searchResultSourceTypesCache = null;
    searchResultSourceTypesPromise = null;
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes[SEARCH_SELECTION_STATS_STORAGE_KEY]) {
    return;
  }
  searchSelectionStatsCache = normalizeSearchSelectionStats(
    changes[SEARCH_SELECTION_STATS_STORAGE_KEY].newValue
  );
  searchSelectionStatsPromise = null;
});

function withTimeout(promise, timeoutMs, fallbackValue) {
  const safePromise = promise
    .then((value) => value)
    .catch(() => fallbackValue);
  if (!timeoutMs || timeoutMs <= 0) {
    return safePromise;
  }
  return Promise.race([
    safePromise,
    new Promise((resolve) => {
      setTimeout(() => resolve(fallbackValue), timeoutMs);
    })
  ]);
}

async function fetchSearchEngineSuggestionsWithTimeout(query, externalSignal) {
  if (externalSignal && externalSignal.aborted) {
    return [];
  }
  const requestController = new AbortController();
  const forwardExternalAbort = () => requestController.abort();
  if (externalSignal) {
    externalSignal.addEventListener('abort', forwardExternalAbort, { once: true });
  }
  let timeoutId = null;
  try {
    const timeoutPromise = new Promise((resolve) => {
      timeoutId = setTimeout(() => {
        requestController.abort();
        resolve([]);
      }, SEARCH_ENGINE_SUGGEST_TIMEOUT_MS);
    });
    return await Promise.race([
      fetchSearchSuggestionsForEngine(query, { signal: requestController.signal }).catch(() => []),
      timeoutPromise
    ]);
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    if (externalSignal) {
      externalSignal.removeEventListener('abort', forwardExternalAbort);
    }
  }
}

function callChromeApiWithTimeout(invoke, fallbackValue, timeoutMs) {
  return withTimeout(new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
    };
    try {
      invoke(finish);
    } catch (e) {
      finish(fallbackValue);
    }
  }), timeoutMs, fallbackValue);
}

function invalidateBookmarkTreeCache() {
  bookmarkTreeIndexCache = {
    expiresAt: 0,
    map: null
  };
  bookmarkItemsCache = {
    expiresAt: 0,
    items: []
  };
  bookmarkTreeIndexPromise = null;
  bookmarkItemsPromise = null;
}

function invalidateLocalSearchSourceCaches() {
  historyFallbackCache = {
    expiresAt: 0,
    items: []
  };
  topSitesCache = {
    expiresAt: 0,
    items: []
  };
}

function ensureLocalSearchSourceCacheListeners() {
  if (localSearchSourceCacheListenersBound || !chrome || !chrome.history) {
    return;
  }
  [
    chrome.history.onVisited,
    chrome.history.onVisitRemoved
  ].forEach((eventTarget) => {
    if (eventTarget && typeof eventTarget.addListener === 'function') {
      eventTarget.addListener(invalidateLocalSearchSourceCaches);
    }
  });
  localSearchSourceCacheListenersBound = true;
}

function ensureBookmarkTreeCacheListeners() {
  if (bookmarkTreeCacheListenersBound || !chrome || !chrome.bookmarks) {
    return;
  }
  const events = [
    chrome.bookmarks.onCreated,
    chrome.bookmarks.onRemoved,
    chrome.bookmarks.onChanged,
    chrome.bookmarks.onMoved,
    chrome.bookmarks.onChildrenReordered,
    chrome.bookmarks.onImportEnded
  ];
  events.forEach((eventTarget) => {
    if (eventTarget && typeof eventTarget.addListener === 'function') {
      eventTarget.addListener(invalidateBookmarkTreeCache);
    }
  });
  bookmarkTreeCacheListenersBound = true;
}

function buildBookmarkNodeMap(tree) {
  const bookmarkNodeMap = new Map();
  function indexBookmarkNodes(node, parentId) {
    if (!node || !node.id) {
      return;
    }
    bookmarkNodeMap.set(node.id, {
      title: node.title || '',
      parentId: parentId || null,
      hasUrl: Boolean(node.url)
    });
    if (Array.isArray(node.children)) {
      node.children.forEach((child) => indexBookmarkNodes(child, node.id));
    }
  }
  if (Array.isArray(tree)) {
    tree.forEach((node) => indexBookmarkNodes(node, null));
  }
  return bookmarkNodeMap;
}

function buildBookmarkItems(tree) {
  const items = [];
  function collectBookmarkNodes(node) {
    if (!node || !node.id) {
      return;
    }
    if (node.url) {
      items.push({
        id: node.id,
        parentId: node.parentId || null,
        title: node.title || '',
        url: node.url
      });
    }
    if (Array.isArray(node.children)) {
      node.children.forEach((child) => collectBookmarkNodes(child));
    }
  }
  if (Array.isArray(tree)) {
    tree.forEach((node) => collectBookmarkNodes(node));
  }
  return items;
}

function getBookmarkNodeMapCached() {
  const now = Date.now();
  if (bookmarkTreeIndexCache.map && bookmarkTreeIndexCache.expiresAt > now) {
    return Promise.resolve(bookmarkTreeIndexCache.map);
  }
  if (bookmarkItemsPromise) {
    return bookmarkItemsPromise.then(() => bookmarkTreeIndexCache.map || new Map());
  }
  if (bookmarkTreeIndexPromise) {
    return bookmarkTreeIndexPromise;
  }
  if (!chrome || !chrome.bookmarks || typeof chrome.bookmarks.getTree !== 'function') {
    return Promise.resolve(new Map());
  }
  ensureBookmarkTreeCacheListeners();
  bookmarkTreeIndexPromise = callChromeApiWithTimeout((done) => {
    chrome.bookmarks.getTree((tree) => {
      const map = buildBookmarkNodeMap(tree);
      bookmarkTreeIndexCache = {
        map: map,
        expiresAt: Date.now() + BOOKMARK_TREE_CACHE_TTL_MS
      };
      bookmarkTreeIndexPromise = null;
      done(map);
    });
  }, new Map(), LOCAL_SUGGEST_SOURCE_TIMEOUT_MS).catch(() => {
    bookmarkTreeIndexPromise = null;
    return new Map();
  });
  return bookmarkTreeIndexPromise;
}

function getAllBookmarksCached() {
  const now = Date.now();
  if (Array.isArray(bookmarkItemsCache.items) && bookmarkItemsCache.expiresAt > now) {
    return Promise.resolve(bookmarkItemsCache.items);
  }
  if (bookmarkItemsPromise) {
    return bookmarkItemsPromise;
  }
  if (!chrome || !chrome.bookmarks || typeof chrome.bookmarks.getTree !== 'function') {
    return Promise.resolve([]);
  }
  ensureBookmarkTreeCacheListeners();
  bookmarkItemsPromise = callChromeApiWithTimeout((done) => {
    chrome.bookmarks.getTree((tree) => {
      const items = buildBookmarkItems(tree);
      const nodeMap = buildBookmarkNodeMap(tree);
      const expiresAt = Date.now() + BOOKMARK_TREE_CACHE_TTL_MS;
      bookmarkItemsCache = {
        items: items,
        expiresAt
      };
      bookmarkTreeIndexCache = {
        map: nodeMap,
        expiresAt
      };
      bookmarkItemsPromise = null;
      done(items);
    });
  }, [], LOCAL_SUGGEST_SOURCE_TIMEOUT_MS).catch(() => {
    bookmarkItemsPromise = null;
    return [];
  });
  return bookmarkItemsPromise;
}

function getTopSitesCached() {
  const now = Date.now();
  if (topSitesCache.expiresAt > now && Array.isArray(topSitesCache.items)) {
    return Promise.resolve(topSitesCache.items);
  }
  if (!chrome || !chrome.topSites || typeof chrome.topSites.get !== 'function') {
    return Promise.resolve([]);
  }
  return callChromeApiWithTimeout((done) => {
    chrome.topSites.get((items) => {
      const list = Array.isArray(items) ? items : [];
      topSitesCache = {
        items: list,
        expiresAt: Date.now() + TOP_SITES_CACHE_TTL_MS
      };
      done(list);
    });
  }, [], LOCAL_SUGGEST_SOURCE_TIMEOUT_MS).catch(() => []);
}

function getFallbackHistoryItemsCached(policy) {
  const now = Date.now();
  if (historyFallbackCache.expiresAt > now && Array.isArray(historyFallbackCache.items)) {
    return Promise.resolve(historyFallbackCache.items);
  }
  if (!chrome || !chrome.history || typeof chrome.history.search !== 'function') {
    return Promise.resolve([]);
  }
  const settings = policy && typeof policy === 'object' ? policy : {};
  const fallbackMaxResults = Number(settings.fallbackHistoryMaxResults) > 0
    ? Math.floor(Number(settings.fallbackHistoryMaxResults))
    : 600;
  const fallbackWindowDays = Number(settings.fallbackHistoryWindowDays) > 0
    ? Number(settings.fallbackHistoryWindowDays)
    : 365;
  return callChromeApiWithTimeout((done) => {
    chrome.history.search({
      text: '',
      maxResults: fallbackMaxResults,
      startTime: Date.now() - (fallbackWindowDays * 24 * 60 * 60 * 1000)
    }, (items) => {
      const list = Array.isArray(items) ? items : [];
      historyFallbackCache = {
        items: list,
        expiresAt: Date.now() + HISTORY_FALLBACK_CACHE_TTL_MS
      };
      done(list);
    });
  }, [], LOCAL_SUGGEST_SOURCE_TIMEOUT_MS).catch(() => []);
}

function getCachedFallbackHistoryItemsOrWarm(policy) {
  const now = Date.now();
  if (historyFallbackCache.expiresAt > now && Array.isArray(historyFallbackCache.items)) {
    return Promise.resolve(historyFallbackCache.items);
  }
  return withTimeout(
    getFallbackHistoryItemsCached(policy),
    LOCAL_SEARCH_INDEX_WARMUP_TIMEOUT_MS,
    []
  );
}

function getCachedBookmarkItemsOrWarm() {
  const now = Date.now();
  if (Array.isArray(bookmarkItemsCache.items) && bookmarkItemsCache.expiresAt > now) {
    return Promise.resolve(bookmarkItemsCache.items);
  }
  return withTimeout(
    getAllBookmarksCached(),
    LOCAL_SEARCH_INDEX_WARMUP_TIMEOUT_MS,
    []
  );
}

function getCachedBookmarkNodeMap() {
  const now = Date.now();
  if (bookmarkTreeIndexCache.map && bookmarkTreeIndexCache.expiresAt > now) {
    return bookmarkTreeIndexCache.map;
  }
  return new Map();
}

function getOpenTabSearchItems() {
  if (!chrome || !chrome.tabs || typeof chrome.tabs.query !== 'function') {
    return Promise.resolve([]);
  }
  return callChromeApiWithTimeout((done) => {
    chrome.tabs.query({}, (tabs) => {
      const items = (Array.isArray(tabs) ? tabs : [])
        .map((tab) => {
          const url = getResolvedTabUrl(tab);
          if (!url || typeof tab.id !== 'number') {
            return null;
          }
          return {
            title: String(tab.title || '').replace(/\s+/g, ' ').trim() || url,
            url,
            _xMatchedTabId: tab.id
          };
        })
        .filter(Boolean);
      done(items);
    });
  }, [], LOCAL_SUGGEST_SOURCE_TIMEOUT_MS).catch(() => []);
}

function normalizeAsciiQueryForPinyin(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .trim();
}

function shouldUseTitlePinyinMatch(value) {
  const normalized = normalizeAsciiQueryForPinyin(value);
  return Boolean(normalized) && /^[a-z]+$/.test(normalized);
}

function getChineseCharacters(text) {
  const matches = String(text || '').match(/[\u4e00-\u9fff]/g);
  return Array.isArray(matches) ? matches : [];
}

function buildTitlePinyinIndex(title) {
  const rawTitle = String(title || '').trim();
  if (!rawTitle) {
    return {
      full: '',
      initials: '',
      chineseLength: 0
    };
  }
  if (titlePinyinCache.has(rawTitle)) {
    return titlePinyinCache.get(rawTitle);
  }
  let full = '';
  let initials = '';
  const chineseChars = getChineseCharacters(rawTitle);
  try {
    if (globalThis.pinyinPro && typeof globalThis.pinyinPro.pinyin === 'function') {
      const converted = globalThis.pinyinPro.pinyin(rawTitle, {
        toneType: 'none',
        type: 'array',
        nonZh: 'removed',
        v: false
      });
      const syllables = (Array.isArray(converted) ? converted : [])
        .map((item) => String(item || '').toLowerCase().replace(/[^a-z]+/g, ''))
        .filter(Boolean);
      full = syllables.join('');
      initials = syllables.map((item) => item.charAt(0)).join('');
    }
  } catch (error) {
    full = '';
    initials = '';
  }
  const result = {
    full: full,
    initials: initials,
    chineseLength: chineseChars.length
  };
  setBoundedBackgroundCacheEntry(
    titlePinyinCache,
    rawTitle,
    result,
    BACKGROUND_TITLE_PINYIN_CACHE_MAX_ENTRIES
  );
  return result;
}

function getTitlePinyinMatchScore(title, normalizedQuery) {
  if (!normalizedQuery || normalizedQuery.length < 2) {
    return {
      score: 0,
      reason: ''
    };
  }
  const index = buildTitlePinyinIndex(title);
  if (!index || (!index.full && !index.initials)) {
    return {
      score: 0,
      reason: ''
    };
  }
  if (index.full === normalizedQuery) {
    return {
      score: 42,
      reason: 'full-exact'
    };
  }
  if (index.full.startsWith(normalizedQuery)) {
    return {
      score: 28,
      reason: 'full-prefix'
    };
  }
  if (index.full.includes(normalizedQuery)) {
    return {
      score: 14,
      reason: 'full-contains'
    };
  }
  const canUseInitials = index.chineseLength >= 2 && normalizedQuery.length >= 2;
  if (canUseInitials && index.initials === normalizedQuery) {
    return {
      score: 18,
      reason: 'initials-exact'
    };
  }
  if (canUseInitials && index.initials.startsWith(normalizedQuery)) {
    return {
      score: 12,
      reason: 'initials-prefix'
    };
  }
  return {
    score: 0,
    reason: ''
  };
}

function mergeItemsByUrl(itemGroups) {
  const merged = [];
  const seenKeys = new Set();
  (Array.isArray(itemGroups) ? itemGroups : []).forEach((items) => {
    (Array.isArray(items) ? items : []).forEach((item) => {
      if (!item) {
        return;
      }
      const urlKey = typeof item.url === 'string' && item.url
        ? `url:${item.url}`
        : `id:${item.id || ''}:${item.title || ''}`;
      if (seenKeys.has(urlKey)) {
        return;
      }
      seenKeys.add(urlKey);
      merged.push(item);
    });
  });
  return merged;
}

function getBackgroundSearchPolicy(searchUtils) {
  return (searchUtils && searchUtils.SEARCH_POLICY) || {
    lookupWindowDays: 180,
    lookupMaxResults: 120,
    maxEngineSuggestions: 5,
    maxEngineSuggestionsWithLocalResults: 3,
    candidatePoolLimit: 20,
    finalSuggestionLimit: 12,
    fallbackTopSiteLimit: 5
  };
}

function buildBackgroundSearchQueryContext(query, searchUtils) {
  const normalizedPinyinQuery = shouldUseTitlePinyinMatch(query)
    ? normalizeAsciiQueryForPinyin(query)
    : '';
  if (searchUtils && typeof searchUtils.buildSearchQueryContext === 'function') {
    return searchUtils.buildSearchQueryContext(query, { normalizedPinyinQuery });
  }
  const queryLower = String(query || '').trim().toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(Boolean);
  return {
    lookupQuery: String(query || ''),
    queryLower,
    normalizedPinyinQuery,
    useTitlePinyinMatch: Boolean(normalizedPinyinQuery),
    queryTerms,
    coreQueryTerms: queryTerms.slice(),
    intentType: 'object',
    hasSettingsIntent: false,
    hasInformationalIntent: false
  };
}

// Function to get search suggestions from history and top sites
async function getSearchSuggestions(query, options) {
  const suggestions = [];
  const requestOptions = options && typeof options === 'object' ? options : {};
  ensureLocalSearchSourceCacheListeners();
  const searchUtils = SEARCH_UTILS;
  const searchPolicy = getBackgroundSearchPolicy(searchUtils);
  const context = buildBackgroundSearchQueryContext(query, searchUtils);
  if (!context.queryLower) {
    return [];
  }
  const lookupStartTime = Date.now() - (searchPolicy.lookupWindowDays * 24 * 60 * 60 * 1000);
  const lookupEndTime = Date.now();
  const lookupMaxResults = searchPolicy.lookupMaxResults || 120;
  const searchScoreOptions = {
    getTitlePinyinMatchScore,
    isLocalNetworkHost,
    isOwnExtensionUrl
  };
  const configuredSourceTypes = await loadSearchResultSourceTypes();
  const requestedSourceTypes = Array.isArray(requestOptions.sourceTypes)
    ? requestOptions.sourceTypes
      .map((item) => String(item || '').trim())
      .filter((item, index, items) => (
        (item === 'topSite' || item === 'bookmark' || item === 'history') &&
        items.indexOf(item) === index
      ))
    : [];
  const sourceTypes = requestedSourceTypes.length > 0
    ? configuredSourceTypes.filter((sourceType) => requestedSourceTypes.includes(sourceType))
    : configuredSourceTypes;
  const sourceTypeSet = new Set(sourceTypes);
  const allowTopSites = sourceTypeSet.has('topSite');
  const allowBookmarks = sourceTypeSet.has('bookmark');
  const allowHistory = sourceTypeSet.has('history');
  const allowOpenTabs = requestOptions.includeOpenTabs !== false;

  try {
    const openTabsPromise = allowOpenTabs ? getOpenTabSearchItems() : Promise.resolve([]);
    const [
      historyItemsRaw,
      topSites,
      bookmarksRaw,
      fallbackHistoryItems,
      allBookmarks,
      searchBlacklistItems,
      faviconRequestBlacklistItems,
      _faviconEnhancedFetchEnabled,
      searchSelectionStats
    ] = await Promise.all([
      allowHistory
        ? callChromeApiWithTimeout((done) => {
          chrome.history.search({
            text: context.lookupQuery,
            maxResults: lookupMaxResults,
            startTime: lookupStartTime,
            endTime: lookupEndTime
          }, done);
        }, [], LOCAL_SUGGEST_SOURCE_TIMEOUT_MS)
        : Promise.resolve([]),
      allowTopSites ? getTopSitesCached() : Promise.resolve([]),
      allowBookmarks
        ? callChromeApiWithTimeout((done) => {
          chrome.bookmarks.search({ query: context.lookupQuery }, done);
        }, [], LOCAL_SUGGEST_SOURCE_TIMEOUT_MS)
        : Promise.resolve([]),
      allowHistory ? getCachedFallbackHistoryItemsOrWarm(searchPolicy) : Promise.resolve([]),
      allowBookmarks ? getCachedBookmarkItemsOrWarm() : Promise.resolve([]),
      loadSearchBlacklistItems(),
      loadFaviconRequestBlacklistItems(),
      loadFaviconEnhancedFetchEnabled(),
      loadSearchSelectionStats()
    ]);
    const collectSearchMatches = (items) => {
      if (typeof searchUtils.collectSearchMatches === 'function') {
        return searchUtils.collectSearchMatches(items, context, searchBlacklistItems, {
          getTitlePinyinMatchScore,
          isUrlBlockedBySearchBlacklist
        });
      }
      return (Array.isArray(items) ? items : []).filter((item) => {
        if (!item || !item.url || isUrlBlockedBySearchBlacklist(item.url, searchBlacklistItems)) {
          return false;
        }
        const titleLower = item.title ? item.title.toLowerCase() : '';
        const urlLower = item.url.toLowerCase();
        const pinyinMatch = context.useTitlePinyinMatch && item.title
          ? getTitlePinyinMatchScore(item.title, context.normalizedPinyinQuery).score > 0
          : false;
        return pinyinMatch || titleLower.includes(context.queryLower) || urlLower.includes(context.queryLower);
      });
    };
    const mergeSearchItems = typeof searchUtils.mergeItemsByUrl === 'function'
      ? searchUtils.mergeItemsByUrl
      : mergeItemsByUrl;
    const fallbackHistoryMatches = collectSearchMatches(fallbackHistoryItems);
    const historyItems = collectSearchMatches(mergeSearchItems([
      Array.isArray(historyItemsRaw) ? historyItemsRaw : [],
      fallbackHistoryMatches
    ]));
    const bookmarkTextMatches = collectSearchMatches(allBookmarks);
    const bookmarks = collectSearchMatches(mergeSearchItems([
      Array.isArray(bookmarksRaw) ? bookmarksRaw : [],
      bookmarkTextMatches
    ]));

    const bookmarkNodeMap = (Array.isArray(bookmarks) && bookmarks.length > 0)
      ? getCachedBookmarkNodeMap()
      : new Map();

    const rootFolderTitles = new Set([
      'Bookmarks bar',
      'Other bookmarks',
      'Mobile bookmarks',
      '书签栏',
      '其他书签',
      '移动设备书签'
    ]);

    function buildSuggestionReasons(item, sourceType) {
      const reasons = [];
      if (sourceType === 'bookmark') {
        reasons.push('来源：书签');
      } else if (sourceType === 'topSite') {
        reasons.push('来源：常用站点');
      } else if (sourceType === 'openTab') {
        reasons.push('来源：打开的标签页');
      } else if (sourceType === 'history') {
        reasons.push('来源：浏览历史');
      }
      const pinyinMatch = getTitlePinyinMatchScore(item && item.title, context.normalizedPinyinQuery);
      if (pinyinMatch.reason === 'initials-exact' || pinyinMatch.reason === 'initials-prefix') {
        reasons.push('标题首字母匹配');
      } else if (pinyinMatch.score > 0) {
        reasons.push('标题拼音匹配');
      }
      if (item && item.lastVisitTime) {
        const hoursSinceVisit = (Date.now() - item.lastVisitTime) / (1000 * 60 * 60);
        if (hoursSinceVisit < 24) {
          reasons.push('最近 24 小时访问');
        } else if (hoursSinceVisit < 72) {
          reasons.push('最近 3 天访问');
        }
      }
      const visitCount = Number(item && item.visitCount) || 0;
      if (visitCount > 1) {
        reasons.push(`访问 ${visitCount} 次`);
      }
      return reasons.slice(0, 3);
    }

    function buildSearchSuggestionFavicon(url) {
      if (isOwnExtensionUrl(url)) {
        return getOwnExtensionFaviconUrl();
      }
      if (isBrowserInternalPageUrl(url)) {
        return getPageFaviconCandidateUrl(url);
      }
      try {
        const urlObj = new URL(url);
        const host = normalizeHost(urlObj.hostname);
        return shouldBlockFaviconForHost(host)
          ? ''
          : getPageFaviconCandidateUrl(urlObj.href);
      } catch (e) {
        const fallbackHost = getFaviconFallbackHost(url);
        return shouldBlockFaviconForHost(fallbackHost) ? '' : getHostFaviconUrl(fallbackHost);
      }
    }

    function createSearchSuggestion(item, sourceType, score, extras) {
      if (typeof searchUtils.createSearchSuggestion === 'function') {
        return searchUtils.createSearchSuggestion(item, sourceType, score, extras);
      }
      return {
        type: sourceType,
        title: item.title || item.url,
        url: item.url,
        favicon: extras && extras.favicon ? extras.favicon : '',
        score,
        lastVisitTime: Number(item.lastVisitTime) || 0,
        visitCount: Number(item.visitCount) || 0,
        typedCount: Number(item.typedCount) || 0,
        reasons: extras && Array.isArray(extras.reasons) ? extras.reasons : [],
        ...(extras || {})
      };
    }

    function calculateSearchRelevanceScore(item, sourceType) {
      if (typeof searchUtils.calculateSearchRelevanceScore === 'function') {
        return searchUtils.calculateSearchRelevanceScore(item, sourceType, context, searchScoreOptions);
      }
      return 0;
    }

    function buildBookmarkPath(bookmark) {
      const pathParts = [];
      let parentId = bookmark && bookmark.parentId ? bookmark.parentId : bookmark && bookmark.id;
      while (parentId) {
        const node = bookmarkNodeMap.get(parentId);
        if (!node) {
          break;
        }
        const isRootFolder = !node.parentId && rootFolderTitles.has(node.title);
        if (!node.hasUrl && node.title && !isRootFolder) {
          pathParts.unshift(node.title);
        }
        parentId = node.parentId;
      }
      return pathParts.join('/');
    }

    const suggestionIndexByKey = new Map();

    function getSuggestionKey(item) {
      return typeof searchUtils.buildSearchDedupEntryKey === 'function'
        ? searchUtils.buildSearchDedupEntryKey(item)
        : (item && item.url ? item.url : '');
    }

    function upsertSuggestion(item, sourceType, extras) {
      if (!item || !item.url) {
        return null;
      }
      const itemKey = getSuggestionKey(item);
      const baseScore = calculateSearchRelevanceScore(item, sourceType);
      if (baseScore <= 0) {
        return null;
      }
      const normalizedExtras = extras && typeof extras === 'object' ? { ...extras } : {};
      const scoreAdjustment = Number(normalizedExtras.scoreAdjustment) || 0;
      delete normalizedExtras.scoreAdjustment;
      const selectionBoost = getSearchSelectionBoost(item, context, searchSelectionStats, searchScoreOptions);
      if (selectionBoost > 0) {
        normalizedExtras.selectionBoost = selectionBoost;
      }
      const suggestion = createSearchSuggestion(item, sourceType, baseScore + scoreAdjustment + selectionBoost, {
        favicon: buildSearchSuggestionFavicon(item.url),
        reasons: buildSuggestionReasons(item, sourceType),
        ...normalizedExtras
      });
      const existingIndex = suggestionIndexByKey.get(itemKey);
      if (typeof existingIndex === 'number') {
        suggestions[existingIndex] = suggestion;
      } else {
        suggestionIndexByKey.set(itemKey, suggestions.length);
        suggestions.push(suggestion);
      }
      return suggestion;
    }

    function upsertOpenTabSuggestion(item) {
      if (!item || !item.url || typeof item._xMatchedTabId !== 'number') {
        return null;
      }
      const itemKey = getSuggestionKey(item);
      const existingIndex = suggestionIndexByKey.get(itemKey);
      if (typeof existingIndex === 'number') {
        suggestions[existingIndex] = {
          ...suggestions[existingIndex],
          _xMatchedTabId: item._xMatchedTabId
        };
        return suggestions[existingIndex];
      }
      return upsertSuggestion(item, 'openTab', {
        _xMatchedTabId: item._xMatchedTabId,
        scoreAdjustment: 12
      });
    }

    historyItems.forEach((item) => {
      if (!item || !item.title || isSearchEngineResultUrl(item.url)) {
        return;
      }
      upsertSuggestion(item, 'history');
    });

    const topSiteMatches = collectSearchMatches(topSites);
    topSiteMatches.forEach((site) => {
      if (!site || !site.url || isUrlBlockedBySearchBlacklist(site.url, searchBlacklistItems)) {
        return;
      }
      const itemKey = getSuggestionKey(site);
      const existingIndex = suggestionIndexByKey.get(itemKey);
      if (typeof existingIndex === 'number') {
        const existing = suggestions[existingIndex];
        suggestions[existingIndex] = {
          ...existing,
          isTopSite: true,
          score: (existing.score || 0) + 6
        };
        return;
      }

      const titleLower = site.title ? site.title.toLowerCase() : '';
      let scoreAdjustment = 4;
      try {
        const hostname = normalizeHost(new URL(site.url).hostname);
        if (hostname.startsWith(context.queryLower)) {
          scoreAdjustment += 8;
        }
      } catch (e) {
        // Ignore invalid URLs.
      }
      if (titleLower.startsWith(context.queryLower)) {
        scoreAdjustment += 6;
      }
      upsertSuggestion(site, 'topSite', { isTopSite: true, scoreAdjustment });
    });

    bookmarks.forEach((bookmark) => {
      if (!bookmark || !bookmark.url) {
        return;
      }
      upsertSuggestion(bookmark, 'bookmark', {
        path: buildBookmarkPath(bookmark),
        scoreAdjustment: 4
      });
    });

    const openTabMatches = collectSearchMatches(await openTabsPromise);
    openTabMatches.forEach((item) => {
      upsertOpenTabSuggestion(item);
    });

    if (typeof searchUtils.buildSearchBrandDirectSuggestion === 'function') {
      const brandDirectSuggestion = searchUtils.buildSearchBrandDirectSuggestion(suggestions, context, {
        ...searchScoreOptions,
        buildFavicon: buildSearchSuggestionFavicon,
        buildReasons: buildSuggestionReasons
      });
      if (brandDirectSuggestion) {
        const directKey = getSuggestionKey(brandDirectSuggestion);
        const existingIndex = suggestionIndexByKey.get(directKey);
        if (typeof existingIndex === 'number') {
          suggestions[existingIndex] = brandDirectSuggestion;
        } else {
          suggestionIndexByKey.set(directKey, suggestions.length);
          suggestions.push(brandDirectSuggestion);
        }
      }
    }

    suggestions.sort((a, b) => {
      if (typeof searchUtils.compareSearchSuggestions === 'function') {
        return searchUtils.compareSearchSuggestions(a, b);
      }
      return (b.score || 0) - (a.score || 0);
    });

    const uniqueSuggestions = [];
    const seenSuggestionKeys = new Set();
    for (let i = 0; i < suggestions.length && uniqueSuggestions.length < (searchPolicy.candidatePoolLimit || 20); i += 1) {
      const suggestion = suggestions[i];
      const suggestionKey = getSuggestionKey(suggestion);
      if (!suggestionKey || seenSuggestionKeys.has(suggestionKey)) {
        continue;
      }
      seenSuggestionKeys.add(suggestionKey);
      uniqueSuggestions.push(suggestion);
    }

    let finalSuggestions = filterBlacklistedSuggestions(uniqueSuggestions, searchBlacklistItems, context.lookupQuery);
    if (typeof searchUtils.filterSearchSuggestionsBySourceTypes === 'function') {
      finalSuggestions = searchUtils.filterSearchSuggestionsBySourceTypes(finalSuggestions, sourceTypes);
    }
    if (typeof searchUtils.applySearchSuggestionHostDiversity === 'function') {
      finalSuggestions = searchUtils.applySearchSuggestionHostDiversity(finalSuggestions, { context });
    } else {
      finalSuggestions = finalSuggestions.slice(0, searchPolicy.finalSuggestionLimit || 12);
    }

    return finalSuggestions;

  } catch (error) {
    console.error('Error getting search suggestions:', error);
    return [];
  }
}

async function getSearchEngineSuggestions(query, localSuggestions, options) {
  await defaultSearchEngineStateReady;
  const searchUtils = SEARCH_UTILS;
  const searchPolicy = getBackgroundSearchPolicy(searchUtils);
  const context = buildBackgroundSearchQueryContext(query, searchUtils);
  const settings = options && typeof options === 'object' ? options : {};
  const signal = settings.signal || null;
  const normalizedLocalSuggestions = (Array.isArray(localSuggestions) ? localSuggestions : [])
    .filter((suggestion) => suggestion && typeof suggestion === 'object')
    .slice(0, searchPolicy.candidatePoolLimit || 20);
  if (!context.queryLower || (signal && signal.aborted)) {
    return normalizedLocalSuggestions;
  }

  const [rawEngineSuggestions, searchBlacklistItems, sourceTypes] = await Promise.all([
    fetchSearchEngineSuggestionsWithTimeout(query, signal),
    loadSearchBlacklistItems(),
    loadSearchResultSourceTypes()
  ]);
  if (signal && signal.aborted) {
    return normalizedLocalSuggestions;
  }

  const engineSuggestions = typeof searchUtils.normalizeSearchEngineSuggestions === 'function'
    ? searchUtils.normalizeSearchEngineSuggestions(
      rawEngineSuggestions,
      context.lookupQuery,
      { limit: searchPolicy.maxEngineSuggestions }
    )
    : (Array.isArray(rawEngineSuggestions) ? rawEngineSuggestions : [])
      .map((item) => String(item || '').trim())
      .filter((item) => item && item.toLowerCase() !== context.queryLower)
      .slice(0, searchPolicy.maxEngineSuggestions || 5);
  const engineSuggestionPolicy = typeof searchUtils.getSearchEngineSuggestionPolicy === 'function'
    ? searchUtils.getSearchEngineSuggestionPolicy(context, normalizedLocalSuggestions, searchPolicy)
    : {
      limit: normalizedLocalSuggestions.length > 0
        ? Math.min(
          searchPolicy.maxEngineSuggestionsWithLocalResults || 3,
          searchPolicy.maxEngineSuggestions || 5
        )
        : (searchPolicy.maxEngineSuggestions || 5),
      score: normalizedLocalSuggestions.length > 0 ? 1 : 160
    };
  const mergedSuggestions = normalizedLocalSuggestions.slice();
  engineSuggestions.slice(0, engineSuggestionPolicy.limit).forEach((suggestion) => {
    const suggestionItem = {
      type: 'googleSuggest',
      title: suggestion,
      url: buildDefaultSearchUrl(suggestion),
      favicon: getDefaultSearchEngineFaviconUrl(),
      score: engineSuggestionPolicy.score,
      searchQuery: suggestion,
      forceSearch: true,
      reasons: ['来源：搜索建议']
    };
    if (!isSuggestionBlockedBySearchBlacklist(suggestionItem, searchBlacklistItems, suggestion)) {
      mergedSuggestions.push(suggestionItem);
    }
  });

  mergedSuggestions.sort((a, b) => {
    if (typeof searchUtils.compareSearchSuggestions === 'function') {
      return searchUtils.compareSearchSuggestions(a, b);
    }
    return (b.score || 0) - (a.score || 0);
  });
  const uniqueSuggestions = [];
  const seenSuggestionKeys = new Set();
  for (let i = 0; i < mergedSuggestions.length && uniqueSuggestions.length < (searchPolicy.candidatePoolLimit || 20); i += 1) {
    const suggestion = mergedSuggestions[i];
    const suggestionKey = typeof searchUtils.buildSearchDedupEntryKey === 'function'
      ? searchUtils.buildSearchDedupEntryKey(suggestion)
      : String((suggestion && (suggestion.url || suggestion.title)) || '').trim().toLowerCase();
    if (!suggestionKey || seenSuggestionKeys.has(suggestionKey)) {
      continue;
    }
    seenSuggestionKeys.add(suggestionKey);
    uniqueSuggestions.push(suggestion);
  }

  let finalSuggestions = filterBlacklistedSuggestions(uniqueSuggestions, searchBlacklistItems, context.lookupQuery);
  if (typeof searchUtils.filterSearchSuggestionsBySourceTypes === 'function') {
    finalSuggestions = searchUtils.filterSearchSuggestionsBySourceTypes(finalSuggestions, sourceTypes);
  }
  if (typeof searchUtils.applySearchSuggestionHostDiversity === 'function') {
    finalSuggestions = searchUtils.applySearchSuggestionHostDiversity(finalSuggestions, { context });
  } else {
    finalSuggestions = finalSuggestions.slice(0, searchPolicy.finalSuggestionLimit || 12);
  }
  if (typeof searchUtils.composeSearchSuggestionSlate === 'function') {
    finalSuggestions = searchUtils.composeSearchSuggestionSlate(finalSuggestions, context);
  }
  return finalSuggestions;
}
