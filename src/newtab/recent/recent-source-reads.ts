// The browser's open tabs, top sites and history the recent sites are merged
// from. The first recent-sites pass waits for every layout preference, so
// these reads start as the page opens. Preferences that arrive before it
// start passes of their own, which it then discards, so every pass shares the
// startup reads until the first pass lands or the history changes; later
// passes, or one long after load, read afresh.
import type { StartupRecentSourceReads } from './recent-types';
import { getBrowserInternalScheme } from '../../platform/browser-profile';

// Edge's topSites lists its own promoted sites instead of the user's, so Edge
// ranks most-visited from history visit counts alone.
const TOP_SITES_FOLLOW_HISTORY = getBrowserInternalScheme(navigator.userAgent) !== 'edge://';
const STARTUP_RECENT_SOURCE_MAX_AGE_MS = 3000;

function readRecentOpenTabs(): Promise<chrome.tabs.Tab[]> {
  return new Promise((resolve) => {
    if (!chrome.tabs || !chrome.tabs.query) {
      resolve([]);
      return;
    }
    chrome.tabs.query({}, (tabs) => {
      resolve(chrome.runtime.lastError || !Array.isArray(tabs) ? [] : tabs);
    });
  });
}

function readRecentTopSites(): Promise<chrome.topSites.MostVisitedURL[] | null> {
  return new Promise((resolve) => {
    if (!chrome.topSites || !chrome.topSites.get || !TOP_SITES_FOLLOW_HISTORY) {
      resolve(null);
      return;
    }
    chrome.topSites.get((items) => {
      resolve(chrome.runtime.lastError || !Array.isArray(items) ? null : items);
    });
  });
}

function readRecentHistoryItems(): Promise<chrome.history.HistoryItem[] | null> {
  return new Promise((resolve) => {
    if (!chrome.history || !chrome.history.search) {
      resolve(null);
      return;
    }
    // Most-visited ranks sites by summed visit counts, so it needs more than the latest few URLs.
    chrome.history.search({
      text: '',
      maxResults: 500,
      startTime: Date.now() - 1000 * 60 * 60 * 24 * 90
    }, (items) => {
      resolve(chrome.runtime.lastError || !Array.isArray(items) ? null : items);
    });
  });
}

class RecentSourceReads {
  private readonly startedAt = Date.now();
  private startup: StartupRecentSourceReads | null = {
    historyItems: readRecentHistoryItems(),
    topSites: readRecentTopSites(),
    tabs: readRecentOpenTabs()
  };

  tabs(): Promise<chrome.tabs.Tab[]> {
    return this.take('tabs', readRecentOpenTabs);
  }

  topSites(): Promise<chrome.topSites.MostVisitedURL[] | null> {
    return this.take('topSites', readRecentTopSites);
  }

  historyItems(): Promise<chrome.history.HistoryItem[] | null> {
    return this.take('historyItems', readRecentHistoryItems);
  }

  // The next passes read afresh.
  release(): void {
    this.startup = null;
  }

  private take<K extends keyof StartupRecentSourceReads>(
    name: K,
    read: () => StartupRecentSourceReads[K]
  ): StartupRecentSourceReads[K] {
    const pending = this.startup ? this.startup[name] : null;
    return pending && Date.now() - this.startedAt <= STARTUP_RECENT_SOURCE_MAX_AGE_MS
      ? pending
      : read();
  }
}

export { RecentSourceReads };
