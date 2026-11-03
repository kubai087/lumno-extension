// Opening the extension's own pages, bookmark folders and new tabs.
import * as BOOKMARK_TAB_GROUPS from '../bookmark-tab-groups';
import { getExtensionDetailsUrl, openBookmarkManagerPage, openExtensionOptionsPage, openExtensionShortcutsPage, openOnboardingPage, openReleasePage, openSiteSearchOptionsPage } from '../extension-pages';
import { isProgressTrackingEnabled, progressTracker } from '../worker-controllers';
import { createTabWithSourceGroup } from '../browser-urls-service';
import { openSearchResultTab } from '../split-view-tabs';
import type { HandlersFor } from '../message-router';
import { getErrorMessage, readDisposition, readString } from './readers';

type ExtensionPageAction =
  | 'probeProgressSeries' | 'openOptionsPage' | 'openOnboardingPage' | 'openReleasePage'
  | 'openExtensionShortcutsPage' | 'openSiteSearchOptionsPage' | 'openBookmarkManager'
  | 'openBookmarkFolderInNewTabGroup' | 'createTab' | 'openNewTab' | 'openExtensionDetailsPage';

// Extension pages, tab creation and progress probes.
const EXTENSION_PAGE_MESSAGE_HANDLERS: HandlersFor<ExtensionPageAction> = Object.freeze({
  probeProgressSeries(request, sender, sendResponse) {
    // Pinning from New Tab: does the open page read as an episode or chapter?
    if (!isProgressTrackingEnabled()) {
      sendResponse({ ok: true, series: false });
      return false;
    }
    progressTracker.probeSeries(String(request.url || '')).then((series) => {
      sendResponse({ ok: true, series: series === true });
    }, () => sendResponse({ ok: false, series: false }));
    return true;
  },
  openOptionsPage(request, sender, sendResponse) {
    openExtensionOptionsPage({ disposition: readDisposition(request.disposition), hash: readString(request.hash) }, (ok) => {
      sendResponse({ ok: ok !== false });
    });
    return true;
  },
  openOnboardingPage(request, sender, sendResponse) {
    openOnboardingPage({ reason: 'manual', disposition: readDisposition(request.disposition) }, (ok) => {
      sendResponse({ ok: ok !== false });
    });
    return true;
  },
  openReleasePage(request, sender, sendResponse) {
    const reason = typeof request.reason === 'string' ? request.reason : 'manual';
    openReleasePage({ reason, disposition: readDisposition(request.disposition) }, (ok) => {
      sendResponse({ ok: ok !== false });
    });
    return true;
  },
  openExtensionShortcutsPage(request, sender, sendResponse) {
    openExtensionShortcutsPage({ disposition: readDisposition(request.disposition) }, (ok) => {
      sendResponse({ ok: ok !== false });
    });
    return true;
  },
  openSiteSearchOptionsPage(request, sender, sendResponse) {
    openSiteSearchOptionsPage({ disposition: readDisposition(request.disposition) }, (ok) => {
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
    }).then(sendResponse).catch((error: unknown) => {
      sendResponse({
        ok: false,
        reason: getErrorMessage(error, 'bookmark-tab-group-failed')
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
      const updateTab = (tabId: number): void => {
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
    openSearchResultTab(targetUrl, readDisposition(request.disposition), sourceTab, (_tab, info) => {
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

export {
  EXTENSION_PAGE_MESSAGE_HANDLERS
};
export type {
  ExtensionPageAction
};
