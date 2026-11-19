// The toolbar popup's actions on the current tab.
import { pageShortcutMenuController, popupRecentPin, readLater } from '../worker-controllers';
import { getResolvedTabUrl, isBrowserNewtabUrl, isLumnoNewtabUrl } from '../browser-urls-service';
import { openDocumentPipPickerOnTab } from '../pip-service';
import type { HandlersFor } from '../message-router';
import { requestFocusVisibleNewtabInput } from '../command-context';
import { triggerShowSearchForTab } from '../command-service';

type PopupAction =
  | 'popupOpenDocumentPipPicker' | 'popupShowSearch' | 'popupShowPageToast' | 'popupAddPageShortcut'
  | 'popupGetRecentPin' | 'popupToggleRecentPin' | 'readLaterAdd';


// The tab a toolbar popup action works on. The popup names the tab it showed;
// a tab that has gone since resolves to null.
function getPopupTargetTab(tabId: unknown, callback: (tab: chrome.tabs.Tab | null) => void): void {
  if (typeof tabId !== 'number' || !chrome.tabs || typeof chrome.tabs.get !== 'function') {
    callback(null);
    return;
  }
  chrome.tabs.get(tabId, (tab) => {
    callback(chrome.runtime.lastError || !tab ? null : tab);
  });
}

function getPopupPage(tab: chrome.tabs.Tab | null): { url: string; title: string } | null {
  return tab ? { url: String(tab.url || tab.pendingUrl || ''), title: String(tab.title || '') } : null;
}

// The toolbar popup's page actions. The popup closes once the clip or the
// search starts, so those answer first and then act on the tab. A finished
// copy or add is announced by Lumno's top toast in the page.
const POPUP_MESSAGE_HANDLERS: HandlersFor<PopupAction> = Object.freeze({
  popupOpenDocumentPipPicker(request, sender, sendResponse) {
    getPopupTargetTab(request.tabId, (tab) => {
      sendResponse({ ok: Boolean(tab) });
      if (tab) {
        void openDocumentPipPickerOnTab(tab, 'popup');
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
    const tabId = request.tabId;
    if (!pageShortcutMenuController || typeof tabId !== 'number') {
      sendResponse({ ok: false });
      return false;
    }
    const message = typeof request.message === 'string' ? request.message.slice(0, 200) : '';
    void pageShortcutMenuController.showToast(tabId, { message }).then((shown) => {
      sendResponse({ ok: shown === true });
    });
    return true;
  },
  popupAddPageShortcut(request, sender, sendResponse) {
    if (!pageShortcutMenuController) {
      sendResponse({ status: 'failed', message: '', error: true });
      return false;
    }
    const menu = pageShortcutMenuController;
    getPopupTargetTab(request.tabId, (tab) => {
      menu.addTabPage(tab).then(sendResponse, () => {
        sendResponse({ status: 'failed', message: '', error: true });
      });
    });
    return true;
  },
  readLaterAdd(request, sender, sendResponse) {
    getPopupTargetTab(request.tabId, (tab) => {
      void readLater.add(getPopupPage(tab) || { url: '', title: '' }).then(sendResponse);
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
      void popupRecentPin.toggle(getPopupPage(tab)).then(sendResponse);
    });
    return true;
  }
});

export {
  POPUP_MESSAGE_HANDLERS,
  getPopupPage,
  getPopupTargetTab
};
export type {
  PopupAction
};
