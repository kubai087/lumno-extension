// Keyword and direct-URL suggestions, open-tab matching and quick navigation.
import type { OverlayTab } from '../../domain/messages';
import * as LumnoMessaging from '../../platform/messaging';
import type { Suggestion } from '../../shared/react/search/suggestion-list/types';
import type { FormatMessage } from '../newtab-types';
import type { SlashCommand } from './search-types';
import * as SearchNavigationMatching from '../../domain/search/utils/navigation-matching';
import { overlayTabPriority } from '../../domain/settings/overlay-panel';
import type { SettingsStore } from '../../platform/settings-store';
import { QuickNavigation } from '../../shared/search-panel/quick-navigation';
import type { SearchBoxParts } from './search-box-parts';
import type { OpenTabs } from '../../shared/search-panel/open-tabs';


// A slash command the typed text names, and the text that completes it.
interface CommandMatch {
  command: SlashCommand;
  completion: string;
}

interface SearchNavigationDeps {
  settings: Pick<SettingsStore, 'get' | 'set'>;
  formatMessage: FormatMessage;
  getPageFaviconCandidateUrl(pageUrl: string): string;
  searchBox: Pick<SearchBoxParts, 'focusInput' | 'inputParts'>;
  openTabs: Pick<OpenTabs, 'currentTabId' | 'received' | 'tabs'>;
}



function createSearchNavigation(deps: SearchNavigationDeps) {
  const {
    openTabs,
    settings,
    formatMessage,
    getPageFaviconCandidateUrl
  } = deps;


  const quickNavigation = new QuickNavigation({ locale: { formatMessage }, getFaviconUrl: getPageFaviconCandidateUrl });




  function getDirectUrlSuggestion(input: string): Suggestion | null {
    const suggestion: Suggestion | null = quickNavigation.directUrlRow(input);
    if (!suggestion) {
      return null;
    }
    const matchedTab = getMatchedOpenTabForSuggestion(suggestion);
    if (!matchedTab) {
      return suggestion;
    }
    return {
      ...suggestion,
      title: String(matchedTab.title || '').trim() || suggestion.title,
      favicon: String(matchedTab.favIconUrl || '').trim() || suggestion.favicon,
      _xMatchedTabId: matchedTab.id
    };
  }


  function normalizeTabMatchUrl(url: unknown): string {
    return SearchNavigationMatching.buildTabMatchUrl(url);
  }

  function getMatchedOpenTabForSuggestion(suggestion: Suggestion | null | undefined): OverlayTab | null {
    if (!suggestion || !suggestion.url || openTabs.tabs.length === 0) {
      return null;
    }
    const target = normalizeTabMatchUrl(suggestion.url);
    if (!target) {
      return null;
    }
    for (let i = 0; i < openTabs.tabs.length; i += 1) {
      const tab = openTabs.tabs[i];
      if (typeof tab.id !== 'number' || !tab.url) {
        continue;
      }
      const current = normalizeTabMatchUrl(tab.url);
      if (current && current === target) {
        return tab;
      }
    }
    return null;
  }

  function getMatchedOpenTabIdForSuggestion(suggestion: Suggestion | null | undefined): number | null {
    const matchedTab = getMatchedOpenTabForSuggestion(suggestion);
    return matchedTab ? matchedTab.id : null;
  }

  // Whether Enter on the row switches to the open tab it matched.
  function shouldSwitchMatchedTabSuggestion(suggestion: Suggestion | null | undefined): boolean {
    if (!suggestion || typeof suggestion._xMatchedTabId !== 'number') {
      return false;
    }
    if (!settings.get(overlayTabPriority)) {
      return false;
    }
    return true;
  }

  // Reads the open tabs again; `callback` learns whether it could.
  function refreshTabsForSearchContext(callback?: (ok: boolean) => void): void {
    if (!chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
      if (callback) {
        callback(false);
      }
      return;
    }
    const request: { action: 'getTabsForOverlay'; currentTabId?: number } = { action: 'getTabsForOverlay' };
    if (typeof openTabs.currentTabId === 'number') {
      request.currentTabId = openTabs.currentTabId;
    }
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const finish = (ok: boolean): void => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      if (callback) {
        callback(ok);
      }
    };
    timeout = setTimeout(() => finish(false), 240);
    LumnoMessaging.sendBackgroundMessage(chrome.runtime, request, (response) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        finish(false);
        return;
      }
      openTabs.received(
        response && Array.isArray(response.tabs) ? response.tabs : [],
        response && typeof response.currentTabId === 'number' ? response.currentTabId : null
      );
      finish(true);
    });
  }

  // Warm the tab snapshot before the first URL input so a matched page can render
  // with its final title and switch action on the first visible frame.
  refreshTabsForSearchContext(() => {});


  return {
    quickNavigation,
    getDirectUrlSuggestion,
    getMatchedOpenTabIdForSuggestion,
    shouldSwitchMatchedTabSuggestion,
    refreshTabsForSearchContext
  };
}


// Arrow keys move the highlighted suggestion one step (`direction` 1 or
// -1) and wrap around the list. With nothing selected yet, the step starts
// from the automatically highlighted suggestion (`autoIndex`, -1 if none).
function getNextSuggestionIndex(
  direction: number,
  selectedIndex: number,
  itemCount: number,
  autoIndex: number
): { index: number; didWrap: boolean } {
  const count = Math.max(0, Math.floor(Number(itemCount) || 0));
  if (!count) {
    return { index: -1, didWrap: false };
  }
  const last = count - 1;
  const auto = Number.isInteger(autoIndex) ? autoIndex : -1;
  if (direction > 0) {
    if (selectedIndex === -1) {
      const index = auto >= 0 ? (auto + 1) % count : 0;
      return { index, didWrap: auto >= 0 && index === 0 };
    }
    const index = (selectedIndex + 1) % count;
    return { index, didWrap: selectedIndex === last && index === 0 };
  }
  if (selectedIndex === 0) {
    return { index: last, didWrap: true };
  }
  if (selectedIndex === -1) {
    return auto > 0 ? { index: auto - 1, didWrap: false } : { index: last, didWrap: true };
  }
  return { index: selectedIndex - 1, didWrap: false };
}

type SearchNavigation = ReturnType<typeof createSearchNavigation>;

export { createSearchNavigation, getNextSuggestionIndex };
export type { CommandMatch, SearchNavigation, SearchNavigationDeps };
