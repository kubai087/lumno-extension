import * as SearchNavigationMatching from '../../domain/search/utils/navigation-matching';
import type { OverlayTabs } from './overlay-tabs';

interface TabMatchingDeps {
  // A result for the page already open counts as that open tab.
  prioritizeCurrentPageMatch: boolean;
  // That tab's address, for before its entry is in tabs.
  initialContextTabUrl: string;
  overlayTabs: Pick<OverlayTabs, 'currentTabId' | 'tabs'>;
}

// What a tab is matched by.
interface TabTextSource {
  title?: string;
  url?: string;
}

// Matching open tabs: the text a tab is searched by, filtering them for
// the query, and finding the tab a suggestion already has open.
function createTabMatching(deps: TabMatchingDeps) {
  const { prioritizeCurrentPageMatch, initialContextTabUrl, overlayTabs } = deps;

  function isEnglishQuery(query: string): boolean {
    if (!query) {
      return false;
    }
    return /^[A-Za-z0-9\s._/-]+$/.test(query);
  }

  // An address as the panel shows it: no scheme, no "www.", no lone "/".
  function getUrlDisplay(url: string | undefined): string {
    if (!url) {
      return '';
    }
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./i, '');
      const path = parsed.pathname === '/' ? '' : parsed.pathname;
      return `${host}${path}${parsed.search || ''}${parsed.hash || ''}`;
    } catch (_error) {
      return url;
    }
  }

  function normalizeTabSearchToken(value: string): string {
    return String(value || '').trim().toLowerCase();
  }

  function buildTabSearchText(tab: TabTextSource | null): string {
    if (!tab) {
      return '';
    }
    const parts: string[] = [];
    if (tab.title) {
      parts.push(String(tab.title));
    }
    if (tab.url) {
      parts.push(String(tab.url));
    }
    try {
      const parsed = new URL(tab.url || '');
      if (parsed.hostname) {
        parts.push(parsed.hostname);
      }
      if (parsed.pathname) {
        parts.push(parsed.pathname);
      }
    } catch (_error) {
      // Ignore malformed URLs.
    }
    return parts.join(' ').toLowerCase();
  }

  // The tabs matching every word of the query; with no query, all of them,
  // the current tab moved to second place so another tab comes first.
  function filterTabsForOverlay<T extends TabTextSource & { id?: number }>(tabList: T[], queryText: string): T[] {
    const list = Array.isArray(tabList) ? tabList : [];
    const normalized = normalizeTabSearchToken(queryText);
    if (!normalized) {
      if (list.length < 2 || typeof overlayTabs.currentTabId !== 'number') {
        return list.slice();
      }
      if (!list[0] || list[0].id !== overlayTabs.currentTabId) {
        return list.slice();
      }
      const reordered = list.slice();
      const currentTab = reordered.shift();
      if (currentTab) {
        reordered.splice(1, 0, currentTab);
      }
      return reordered;
    }
    const tokens = normalized.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      return list.slice();
    }
    return list.filter((tab) => {
      const haystack = buildTabSearchText(tab);
      if (!haystack) {
        return false;
      }
      return tokens.every((token) => haystack.includes(token));
    });
  }

  function normalizeTabMatchUrl(url: string): string {
    return SearchNavigationMatching.buildTabMatchUrl(url);
  }

  function normalizeTabMatchUrlWithoutSearch(url: string): string {
    return SearchNavigationMatching.buildTabMatchUrl(url, { includeSearch: false });
  }

  // The open tab that already shows a suggestion's page, if any.
  function getMatchedOpenTabIdForSuggestion(suggestion: { url?: string } | null): number | null {
    if (!suggestion || !suggestion.url || !Array.isArray(overlayTabs.tabs) || overlayTabs.tabs.length === 0) {
      return null;
    }
    const target = normalizeTabMatchUrl(suggestion.url);
    if (!target) {
      return null;
    }
    for (let i = 0; i < overlayTabs.tabs.length; i += 1) {
      const tab = overlayTabs.tabs[i];
      if (!tab || typeof tab.id !== 'number' || !tab.url) {
        continue;
      }
      const current = normalizeTabMatchUrl(tab.url);
      if (current && current === target) {
        return tab.id;
      }
    }
    if (prioritizeCurrentPageMatch && typeof overlayTabs.currentTabId === 'number') {
      const currentTab = overlayTabs.tabs.find((tab) => tab && tab.id === overlayTabs.currentTabId) || null;
      const targetNoSearch = normalizeTabMatchUrlWithoutSearch(suggestion.url);
      const currentNoSearch = currentTab ? normalizeTabMatchUrlWithoutSearch(currentTab.url) : '';
      if (targetNoSearch && currentNoSearch && targetNoSearch === currentNoSearch) {
        return overlayTabs.currentTabId;
      }
    }
    return null;
  }

  function isCurrentOverlayTabUrl(url: string): boolean {
    if (!prioritizeCurrentPageMatch || !url) {
      return false;
    }
    const currentTab = typeof overlayTabs.currentTabId === 'number'
      ? (overlayTabs.tabs.find((tab) => tab && tab.id === overlayTabs.currentTabId) || null)
      : null;
    const currentUrl = currentTab && currentTab.url
      ? currentTab.url
      : initialContextTabUrl;
    if (!currentUrl) {
      return false;
    }
    const targetFull = normalizeTabMatchUrl(url);
    const currentFull = normalizeTabMatchUrl(currentUrl);
    if (targetFull && currentFull && targetFull === currentFull) {
      return true;
    }
    const targetNoSearch = normalizeTabMatchUrlWithoutSearch(url);
    const currentNoSearch = normalizeTabMatchUrlWithoutSearch(currentUrl);
    return Boolean(targetNoSearch && currentNoSearch && targetNoSearch === currentNoSearch);
  }

  return {
    isEnglishQuery,
    getUrlDisplay,
    filterTabsForOverlay,
    getMatchedOpenTabIdForSuggestion,
    isCurrentOverlayTabUrl
  };
}

export { createTabMatching };
export type { TabMatchingDeps };
