// Tab actions from the overlay and the tab switcher.
import { swapNewtabForFocus } from '../newtab-fallback';
import { focusWindowAndActivateTab } from '../tab-switcher/open';
import { markPendingSearchTab } from '../search/pending-search';
import { getResolvedTabUrl } from '../browser-urls-service';
import {
  createOverlayTabPayload,
  ensureTabSwitchStatsLoaded,
  recordTabSwitchEvent,
  sortTabsForOverlay,
  syncTabSwitchStatsFromTabList
} from '../tab-switch-stats-service';
import { nextTabOverlayFetchSeq } from '../overlay-open-service';
import type { HandlersFor } from '../message-router';
import { clearOverlayLoadingRecord } from '../overlay-loading-records';
import { recoverOverlayAfterTopFrameDocumentStart, updateOverlayLoadingSessionFromMessage } from '../overlay-loading-service';

type TabAction =
  | 'swapNewtabForFocus' | 'switchToTab' | 'closeTabFromTabSwitcher' | 'notifyOverlayClosed'
  | 'notifyTopFrameDocumentStarted' | 'updateOverlayLoadingSession' | 'getTabsForOverlay' | 'trackSearchTab'
  | 'closeOtherTabsForOverlay';

// Tabs, overlay lifecycle and tab visibility.
const TAB_MESSAGE_HANDLERS: HandlersFor<TabAction> = Object.freeze({
  swapNewtabForFocus(request, sender, sendResponse) {
    swapNewtabForFocus(sender && sender.tab ? sender.tab : null, sender && sender.url, (result) => {
      sendResponse(result);
    });
    return true;
  },
  switchToTab(request, sender, sendResponse) {
    const tabId = request.tabId;
    if (typeof tabId !== 'number') {
      sendResponse({ ok: false, reason: 'invalid-tab' });
      return;
    }
    recordTabSwitchEvent(tabId);
    focusWindowAndActivateTab(
      tabId,
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
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          sendResponse({ ok: false, reason: lastError.message || 'remove-failed' });
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
            .filter((tab): tab is chrome.tabs.Tab & { id: number } => Boolean(tab) && tab.incognito !== true && typeof tab.id === 'number')
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
          const sortedTabs = sortTabsForOverlay(normalizedTabs, request.sortByRecency === true);
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
    const senderTabId = senderTab.id;
    chrome.tabs.query({ windowId: senderTab.windowId }, (tabs) => {
      const queryError = chrome.runtime && chrome.runtime.lastError;
      if (queryError) {
        sendResponse({ ok: false, reason: queryError.message || 'query-failed' });
        return;
      }
      const ungroupedId = chrome && chrome.tabGroups && typeof chrome.tabGroups.TAB_GROUP_ID_NONE === 'number'
        ? chrome.tabGroups.TAB_GROUP_ID_NONE
        : -1;
      const toCloseIds = (Array.isArray(tabs) ? tabs : [])
        .filter((tab): tab is chrome.tabs.Tab & { id: number } => {
          if (!tab || typeof tab.id !== 'number') {
            return false;
          }
          if (tab.id === senderTabId) {
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
        const removeError = chrome.runtime && chrome.runtime.lastError;
        if (removeError) {
          sendResponse({ ok: false, reason: removeError.message || 'remove-failed' });
          return;
        }
        sendResponse({ ok: true, closedCount: toCloseIds.length });
      });
    });
    return true;
  }
});

export {
  TAB_MESSAGE_HANDLERS
};
export type {
  TabAction
};
