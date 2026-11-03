// Opening a search result in a split view beside the tab it came from, where
// the browser has split views (Chrome 155 and later). Anywhere else, or when
// the source tab is already in a split view or cannot join one, the result
// opens as a new tab.
import { createSearchResultTab } from './browser-urls-service';
import type { OpenDisposition } from '../domain/messages';
import type { TabPlacement } from './search-result-tabs';
import type { CreatedTabCallback } from './tab-groups';

type SplitSourceTab = chrome.tabs.Tab & { id: number };

function canSplitBeside(sourceTab: chrome.tabs.Tab | null | undefined): sourceTab is SplitSourceTab {
  return Boolean(
    sourceTab &&
    typeof sourceTab.id === 'number' &&
    chrome.tabs &&
    typeof chrome.tabs.createSplit === 'function' &&
    !(typeof sourceTab.splitViewId === 'number' && sourceTab.splitViewId >= 0)
  );
}

// The new tab on the right of the source tab; null when the browser refused.
function createSplitTab(url: string, sourceTab: SplitSourceTab, callback: (tab: chrome.tabs.Tab | null) => void): void {
  try {
    chrome.tabs.create({ url, windowId: sourceTab.windowId, splitWithTabId: sourceTab.id, active: true }, (tab) => {
      const lastError = chrome.runtime && chrome.runtime.lastError;
      callback(lastError || !tab ? null : tab);
    });
  } catch (_error) {
    callback(null);
  }
}

// Opens a result in a new tab where its disposition asks: in a split view,
// in the background, or in front. Callers load the current tab themselves.
function openSearchResultTab(
  url: string,
  disposition: OpenDisposition | undefined,
  sourceTab: chrome.tabs.Tab | null | undefined,
  callback?: CreatedTabCallback | null,
  resolvedPlacement?: TabPlacement | null
): void {
  const openAsNewTab = (): void => {
    createSearchResultTab({ url, active: disposition !== 'backgroundTab' }, sourceTab, callback, resolvedPlacement);
  };
  if (disposition !== 'splitTab' || !canSplitBeside(sourceTab)) {
    openAsNewTab();
    return;
  }
  createSplitTab(url, sourceTab, (tab) => {
    if (!tab) {
      openAsNewTab();
      return;
    }
    if (typeof callback === 'function') {
      callback(tab, { ok: true, reason: '', grouped: false });
    }
  });
}

export { openSearchResultTab };
