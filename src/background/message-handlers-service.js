// Message handlers for the extension's own pages and the overlay: tab actions,
// shortcuts, locale messages and permissions, extension page navigation,
// favicons, and the toolbar popup. background.js combines them with the feature
// handlers into one router.
//
// A module of the service worker; background.js imports it before its own code
// runs. Its functions use background.js bindings (SETTINGS,
// SHORTCUT_KEY_MATCHER, loadShortcutRules, the extension page helpers, ...)
// only when they run, never while this file loads, because background.js has
// not initialized its own top-level bindings yet at that point.

import * as BOOKMARK_TAB_GROUPS from './bookmark-tab-groups.js';
import * as SETTINGS from '../shared/settings.js';
import * as SHORTCUT_KEY_MATCHER from '../shared/shortcut-key-matcher.js';
import {
  SHOW_SEARCH_COMMAND_NAME,
  checkFileSchemeAccess,
  getExtensionDetailsUrl,
  loadShortcutRules,
  logHotkeyDebug,
  openBookmarkManagerPage,
  openExtensionOptionsPage,
  openExtensionShortcutsPage,
  openOnboardingPage,
  openReleasePage,
  openSiteSearchOptionsPage,
  pageShortcutMenuController,
  popupRecentPin,
  progressTracker,
  progressTrackingEnabled,
  swapNewtabForFocus
} from './background.js';
import {
  focusWindowAndActivateTab,
  getTabSwitcherPageHotkeySenderTab,
  getTabSwitcherShiftTabEnabled,
  triggerTabSwitcherForTab,
  handleTabSwitcherShortcutModifierReleased
} from './tab-switcher-service.js';
import {
  fetchFaviconData,
  fetchShortcutFaviconData,
  isBlockedLocalFaviconUrl,
  loadFaviconRequestBlacklistItems,
  logBlockedLocalFavicon,
  resolveFaviconCandidates,
  resolveSiteThemeColor,
  shouldBlockFaviconForHost
} from './favicon-service.js';
import { markPendingSearchTab } from './search-suggestions-service.js';
import {
  createSearchResultTab,
  createTabWithSourceGroup,
  getResolvedTabUrl,
  isBrowserNewtabUrl,
  isLumnoNewtabUrl
} from './browser-urls-service.js';
import {
  createOverlayTabPayload,
  ensureTabSwitchStatsLoaded,
  recordTabSwitchEvent,
  sortTabsForOverlay,
  syncTabSwitchStatsFromTabList
} from './tab-switch-stats-service.js';
import {
  clearOverlayLoadingRecord,
  recoverOverlayAfterTopFrameDocumentStart,
  updateOverlayLoadingSessionFromMessage
} from './overlay-loading-service.js';
import { nextTabOverlayFetchSeq } from './overlay-open-service.js';
import {
  getConfiguredCopyUrlCommandShortcut,
  getConfiguredFallbackShortcut,
  rememberPageHotkeyContext,
  requestFocusVisibleNewtabInput,
  triggerCopyCurrentUrlForTab,
  triggerShowSearchForTab
} from './command-service.js';
import { openDocumentPipPickerOnTab } from './pip-service.js';

// Tabs, overlay lifecycle and tab visibility.
export const TAB_MESSAGE_HANDLERS = Object.freeze({
  swapNewtabForFocus(request, sender, sendResponse) {
    swapNewtabForFocus(sender && sender.tab ? sender.tab : null, sender && sender.url, (result) => {
      sendResponse(result);
    });
    return true;
  },
  switchToTab(request, sender, sendResponse) {
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
  },
  closeTabFromTabSwitcher(request, sender, sendResponse) {
    const tabId = request ? request.tabId : null;
    if (typeof tabId !== 'number') {
      sendResponse({ ok: false, reason: 'invalid-tab' });
      return;
    }
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        sendResponse({ ok: false, reason: 'tab-missing' });
        return;
      }
      // The switcher never lists incognito tabs, so it never closes one.
      if (tab.incognito === true) {
        sendResponse({ ok: false, reason: 'tab-not-allowed' });
        return;
      }
      chrome.tabs.remove(tabId, () => {
        if (chrome.runtime.lastError) {
          sendResponse({ ok: false, reason: chrome.runtime.lastError.message || 'remove-failed' });
          return;
        }
        sendResponse({ ok: true });
      });
    });
    return true;
  },
  notifyOverlayClosed(request, sender, sendResponse) {
    const senderTab = sender && sender.tab ? sender.tab : null;
    if (senderTab && typeof senderTab.id === 'number') {
      clearOverlayLoadingRecord(senderTab.id);
    }
    sendResponse({ ok: true });
    return;
  },
  notifyTopFrameDocumentStarted(request, sender, sendResponse) {
    const accepted = recoverOverlayAfterTopFrameDocumentStart(request, sender);
    sendResponse({ ok: accepted });
    return;
  },
  updateOverlayLoadingSession(request, sender, sendResponse) {
    updateOverlayLoadingSessionFromMessage(request, sender, sendResponse);
    return true;
  },
  getTabsForOverlay(request, sender, sendResponse) {
    ensureTabSwitchStatsLoaded()
      .catch(() => {}) // Settles even when storage fails; list tabs regardless.
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
          const fetchSeq = nextTabOverlayFetchSeq();
          const withSeq = sortedTabs.map((tab) => createOverlayTabPayload(tab, fetchSeq));
          sendResponse({ tabs: withSeq, currentTabId: currentTabId });
        });
      });
    return true;
  },
  trackSearchTab(request, sender, sendResponse) {
    if (typeof request.tabId === 'number') {
      markPendingSearchTab(request.tabId, sender && sender.tab ? sender.tab : null);
      sendResponse({ ok: true });
    } else {
      sendResponse({ ok: false });
    }
    return true;
  },
  closeOtherTabsForOverlay(request, sender, sendResponse) {
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
});

// Configured shortcuts and page hotkeys.
export const SHORTCUT_MESSAGE_HANDLERS = Object.freeze({
  getShowSearchShortcut(request, sender, sendResponse) {
    getConfiguredFallbackShortcut((shortcut) => {
      getTabSwitcherShiftTabEnabled((tabSwitcherShiftTabEnabled) => {
        sendResponse({ shortcut: shortcut || '', tabSwitcherShiftTabEnabled });
      });
    });
    return true;
  },
  triggerTabSwitcherFromCtrlTab(request, sender, sendResponse) {
    getTabSwitcherShiftTabEnabled((enabled) => {
      if (!enabled) {
        sendResponse({ ok: false, reason: 'page-tab-switcher-disabled' });
        return;
      }
      const trigger = (tab) => {
        if (!tab || typeof tab.id !== 'number') {
          sendResponse({ ok: false, reason: 'no-sender-tab' });
          return;
        }
        triggerTabSwitcherForTab(tab, 'page-tab-switcher', request.observedAt, request.reverse === true ? 'Ctrl+Shift+Tab' : 'Ctrl+Tab');
        sendResponse({ ok: true });
      };
      getTabSwitcherPageHotkeySenderTab(request, sender, trigger);
    });
    return true;
  },
  getCopyCurrentUrlCommandShortcut(request, sender, sendResponse) {
    getConfiguredCopyUrlCommandShortcut((shortcut) => {
      sendResponse({ shortcut: shortcut || '' });
    });
    return true;
  },
  copyCurrentPageUrl(request, sender, sendResponse) {
    const senderTab = sender && sender.tab ? sender.tab : null;
    triggerCopyCurrentUrlForTab(senderTab, 'slash-command', (ok) => {
      sendResponse({ ok: Boolean(ok) });
    });
    return true;
  },
  // Zen's empty state is a hidden about:blank tab that extensions cannot see, so
  // its messages arrive without sender.tab. The page has already taken the key
  // from the browser command, so it gets the command's no-tab fallback here.
  triggerShowSearchFromPageHotkey(request, sender, sendResponse) {
    const senderTab = sender && sender.tab && typeof sender.tab.id === 'number' ? sender.tab : null;
    const triggerVerifiedPageHotkey = (shortcut) => {
      const shouldPrefillCurrentUrl = Boolean(request && request.prefillCurrentUrl);
      const triggerSource = shouldPrefillCurrentUrl ? 'page-hotkey-prefill' : 'page-hotkey';
      logHotkeyDebug('received', {
        command: SHOW_SEARCH_COMMAND_NAME,
        source: triggerSource,
        tabId: senderTab ? senderTab.id : null,
        url: senderTab ? senderTab.url || '' : '',
        pendingUrl: senderTab ? senderTab.pendingUrl || '' : '',
        prefillCurrentUrl: shouldPrefillCurrentUrl,
        verifiedAfterColdStart: Boolean(request && request.requiresShortcutVerification)
      });
      if (senderTab) {
        rememberPageHotkeyContext(senderTab);
      }
      triggerShowSearchForTab(senderTab, triggerSource);
      sendResponse({ ok: true, shortcut: shortcut || '' });
    };
    if (request && request.requiresShortcutVerification === true) {
      getConfiguredFallbackShortcut((shortcut) => {
        const spec = SHORTCUT_KEY_MATCHER.parseShortcut(shortcut);
        const matched = SHORTCUT_KEY_MATCHER.descriptorMatchesShortcut(request.observedShortcut, spec);
        if (!matched) {
          sendResponse({ ok: false, reason: 'shortcut-mismatch', shortcut: shortcut || '' });
          return;
        }
        triggerVerifiedPageHotkey(shortcut);
      });
      return true;
    }
    triggerVerifiedPageHotkey('');
    return;
  },
  notifyTabSwitcherShortcutModifierReleased(request, sender, sendResponse) {
    getTabSwitcherPageHotkeySenderTab(request, sender, (senderTab) => {
      handleTabSwitcherShortcutModifierReleased(senderTab, request && request.key, (didCommit) => {
        sendResponse({ ok: true, committed: didCommit === true });
      }, request && request.shortcut);
    });
    return true;
  },
  getShortcutRules(request, sender, sendResponse) {
    loadShortcutRules().then((items) => {
      sendResponse({ items: items });
    });
    return true;
  }
});

// Parsed _locales files by locale. They only change with the extension, which
// restarts this worker, so each is read once per worker lifetime.
const localeMessagesByLocale = new Map();

export function loadLocaleMessages(rawLocale) {
  const locale = SETTINGS.normalizeLocale(rawLocale);
  if (localeMessagesByLocale.has(locale)) {
    return localeMessagesByLocale.get(locale);
  }
  const loading = fetch(chrome.runtime.getURL(`_locales/${locale}/messages.json`))
    .then((response) => response.json())
    .then((messages) => (messages && typeof messages === 'object' ? messages : {}))
    .catch(() => {
      localeMessagesByLocale.delete(locale);
      return {};
    });
  localeMessagesByLocale.set(locale, loading);
  return loading;
}

// A page script that names the few strings it shows gets only those.
function pickLocaleMessages(messages, keys) {
  if (!Array.isArray(keys)) {
    return messages;
  }
  const picked = {};
  keys.forEach((key) => {
    if (typeof key === 'string' && Object.prototype.hasOwnProperty.call(messages, key)) {
      picked[key] = messages[key];
    }
  });
  return picked;
}

// Locale messages and permission probes.
export const LOCALE_AND_PERMISSION_MESSAGE_HANDLERS = Object.freeze({
  getLocaleMessages(request, sender, sendResponse) {
    loadLocaleMessages(request && request.locale).then((messages) => {
      sendResponse({ messages: pickLocaleMessages(messages, request && request.keys) });
    });
    return true;
  },
  getFileSchemeAccessStatus(request, sender, sendResponse) {
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
});

// Extension pages, tab creation and progress probes.
export const EXTENSION_PAGE_MESSAGE_HANDLERS = Object.freeze({
  probeProgressSeries(request, sender, sendResponse) {
    // Pinning from New Tab: does the open page read as an episode or chapter?
    if (!progressTrackingEnabled) {
      sendResponse({ ok: true, series: false });
      return false;
    }
    progressTracker.probeSeries(String(request.url || '')).then((series) => {
      sendResponse({ ok: true, series: series === true });
    }, () => sendResponse({ ok: false, series: false }));
    return true;
  },
  openOptionsPage(request, sender, sendResponse) {
    openExtensionOptionsPage({ disposition: request.disposition, hash: request.hash }, (ok) => {
      sendResponse({ ok: ok !== false });
    });
    return true;
  },
  openOnboardingPage(request, sender, sendResponse) {
    openOnboardingPage({ reason: 'manual', disposition: request.disposition }, (ok) => {
      sendResponse({ ok: ok !== false });
    });
    return true;
  },
  openReleasePage(request, sender, sendResponse) {
    const reason = typeof request.reason === 'string' ? request.reason : 'manual';
    openReleasePage({ reason, disposition: request.disposition }, (ok) => {
      sendResponse({ ok: ok !== false });
    });
    return true;
  },
  openExtensionShortcutsPage(request, sender, sendResponse) {
    openExtensionShortcutsPage({ disposition: request.disposition }, (ok) => {
      sendResponse({ ok: ok !== false });
    });
    return true;
  },
  openSiteSearchOptionsPage(request, sender, sendResponse) {
    openSiteSearchOptionsPage({ disposition: request.disposition }, (ok) => {
      sendResponse({ ok: ok !== false });
    });
    return true;
  },
  openBookmarkManager(request, sender, sendResponse) {
    openBookmarkManagerPage().then((url) => {
      sendResponse({ ok: true, url: url });
    }).catch(() => {
      sendResponse({ ok: false });
    });
    return true;
  },
  openBookmarkFolderInNewTabGroup(request, sender, sendResponse) {
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
  },
  createTab(request, sender, sendResponse) {
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
    createSearchResultTab({ url: targetUrl, active: request.disposition !== 'backgroundTab' }, sourceTab, (_tab, info) => {
      sendResponse({ ok: Boolean(info && info.ok) });
    });
    return true;
  },
  openNewTab(request, sender, sendResponse) {
    createTabWithSourceGroup({
      active: request.disposition !== 'backgroundTab'
    }, sender && sender.tab ? sender.tab : null, (_tab, info) => {
      sendResponse({ ok: Boolean(info && info.ok) });
    });
    return true;
  },
  openExtensionDetailsPage(request, sender, sendResponse) {
    const detailsUrl = getExtensionDetailsUrl();
    createTabWithSourceGroup({
      url: detailsUrl,
      active: request.disposition !== 'backgroundTab'
    }, sender && sender.tab ? sender.tab : null, (_tab, info) => {
      sendResponse({ ok: Boolean(info && info.ok), url: detailsUrl });
    });
    return true;
  }
});

// Favicons and site theme colors.
export const FAVICON_MESSAGE_HANDLERS = Object.freeze({
  resolveFaviconCandidates(request, sender, sendResponse) {
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
  },
  getFaviconData(request, sender, sendResponse) {
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
  },
  getShortcutFaviconData(request, sender, sendResponse) {
    const pageUrl = request.pageUrl || '';
    const preferredTheme = request.preferredTheme || '';
    fetchShortcutFaviconData(pageUrl, preferredTheme, '', request.refresh === true, request.iconSource).then((result) => {
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
  },
  resolveSiteThemeColor(request, sender, sendResponse) {
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
});

// The tab a toolbar popup action works on. The popup names the tab it showed;
// a tab that has gone since resolves to null.
function getPopupTargetTab(tabId, callback) {
  if (typeof tabId !== 'number' || !chrome.tabs || typeof chrome.tabs.get !== 'function') {
    callback(null);
    return;
  }
  chrome.tabs.get(tabId, (tab) => {
    callback(chrome.runtime.lastError || !tab ? null : tab);
  });
}

function getPopupPage(tab) {
  return tab ? { url: String(tab.url || tab.pendingUrl || ''), title: String(tab.title || '') } : null;
}

// The toolbar popup's page actions. The popup closes once the clip or the
// search starts, so those answer first and then act on the tab. A finished
// copy or add is announced by Lumno's top toast in the page.
export const POPUP_MESSAGE_HANDLERS = Object.freeze({
  popupOpenDocumentPipPicker(request, sender, sendResponse) {
    getPopupTargetTab(request.tabId, (tab) => {
      sendResponse({ ok: Boolean(tab) });
      if (tab) {
        openDocumentPipPickerOnTab(tab, 'popup');
      }
    });
    return true;
  },
  popupShowSearch(request, sender, sendResponse) {
    getPopupTargetTab(request.tabId, (tab) => {
      sendResponse({ ok: Boolean(tab) });
      if (!tab) {
        return;
      }
      // A New Tab already has a search box; the shortcut focuses it as well.
      const tabUrl = getResolvedTabUrl(tab);
      if (isLumnoNewtabUrl(tabUrl) || isBrowserNewtabUrl(tabUrl)) {
        requestFocusVisibleNewtabInput('popup', tab.id);
        return;
      }
      triggerShowSearchForTab(tab, 'popup');
    });
    return true;
  },
  popupShowPageToast(request, sender, sendResponse) {
    if (!pageShortcutMenuController) {
      sendResponse({ ok: false });
      return false;
    }
    const message = typeof request.message === 'string' ? request.message.slice(0, 200) : '';
    pageShortcutMenuController.showToast(request.tabId, { message }).then((shown) => {
      sendResponse({ ok: shown === true });
    });
    return true;
  },
  popupAddPageShortcut(request, sender, sendResponse) {
    if (!pageShortcutMenuController) {
      sendResponse({ status: 'failed', message: '', error: true });
      return false;
    }
    getPopupTargetTab(request.tabId, (tab) => {
      pageShortcutMenuController.addTabPage(tab).then(sendResponse, () => {
        sendResponse({ status: 'failed', message: '', error: true });
      });
    });
    return true;
  },
  popupGetRecentPin(request, sender, sendResponse) {
    getPopupTargetTab(request.tabId, (tab) => {
      popupRecentPin.getStatus(getPopupPage(tab)).then(sendResponse, () => {
        sendResponse({ available: false, pinned: false, full: false });
      });
    });
    return true;
  },
  popupToggleRecentPin(request, sender, sendResponse) {
    getPopupTargetTab(request.tabId, (tab) => {
      popupRecentPin.toggle(getPopupPage(tab)).then(sendResponse);
    });
    return true;
  }
});
