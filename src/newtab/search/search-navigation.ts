// Keyword and direct-URL suggestions, open-tab matching and quick navigation.
import type { OverlayTab } from '../../domain/messages';
import type { Disposition } from '../../domain/navigation-disposition';
import type { SiteSearchProvider } from '../../domain/search/types';
import * as LumnoMessaging from '../../platform/messaging';
import type { Suggestion, SuggestionElement } from '../../shared/react/search/suggestion-list/types';
import type { ModeCommands } from '../mode-commands';
import type { FormatMessage } from '../newtab-types';
import type { RenderSuggestions, SlashCommand } from './search-types';
import * as SearchNavigationMatching from '../../domain/search/utils/navigation-matching';
import { overlayTabPriority } from '../../domain/settings/overlay-panel';
import type { SettingsStore } from '../../platform/settings-store';
import type { AppearanceModes } from '../appearance-modes';
import { newtabZenMode } from '../../domain/settings/newtab-page';
import type { SearchQuery } from '../../shared/search-panel/search-query';
import type { SearchAutocomplete } from '../../shared/search-panel/autocomplete';
import type { SearchMode } from '../../shared/search-panel/search-mode';
import type { SearchResults } from '../../shared/search-panel/search-results';
import type { SearchModeActions } from '../../shared/search-panel/mode-actions';
import type { SiteSearchRunner } from '../../shared/search-panel/site-search/runner';
import type { ResultActivation } from '../../shared/search-panel/result-activation';
import { QuickNavigation } from '../../shared/search-panel/quick-navigation';
import type { SearchBoxParts } from './search-box-parts';
import type { OpenTabs } from '../../shared/search-panel/open-tabs';
import type { AppliedThemeMode } from '../theme/applied-theme-mode';


// A slash command the typed text names, and the text that completes it.
interface CommandMatch {
  command: SlashCommand;
  completion: string;
}

interface SearchNavigationDeps {
  siteSearchRunner: SiteSearchRunner;
  modeActions: SearchModeActions<SiteSearchProvider>;
  searchResults: SearchResults<Suggestion>;
  searchMode: SearchMode<SiteSearchProvider>;
  searchAutocomplete: SearchAutocomplete;
  searchQuery: SearchQuery;
  settings: Pick<SettingsStore, 'get' | 'set'>;
  formatMessage: FormatMessage;
  getPageFaviconCandidateUrl(pageUrl: string): string;
  resultActivation: ResultActivation;
  suggestionItems: SuggestionElement[];
  getAutoHighlightIndex(): number;
  renderSuggestions: RenderSuggestions;
  isSlashCommandInput(query: string): boolean;
  getCommandMatch(query: string): CommandMatch | null;
  isModeCommand(query: string): boolean;
  isZenCommand(query: string): boolean;
  getNextThemeMode(mode: string): string;
  setVisibleThemeMode: AppearanceModes['setVisibleThemeMode'];
  setWebAppearanceMode: ModeCommands['setWebAppearanceMode'];
  openCommunityQrDialog(url: string | undefined): void;
  // Searches the query with the default engine; `forceSearch` skips the
  // address check.
  navigateToQuery(query: string, forceSearch: boolean, disposition: Disposition): void;
  searchBox: Pick<SearchBoxParts, 'focusInput' | 'inputParts'>;
  openTabs: Pick<OpenTabs, 'currentTabId' | 'received' | 'tabs'>;
  appliedTheme: Pick<AppliedThemeMode, 'mode'>;
}



function createSearchNavigation(deps: SearchNavigationDeps) {
  const {
    appliedTheme,
    openTabs,
    searchBox,
    siteSearchRunner,
    modeActions,
    searchResults,
    searchMode,
    searchAutocomplete,
    searchQuery,
    settings,
    formatMessage,
    getPageFaviconCandidateUrl,
    resultActivation,
    suggestionItems,
    getAutoHighlightIndex,
    renderSuggestions,
    isSlashCommandInput,
    getCommandMatch,
    isModeCommand,
    isZenCommand,
    getNextThemeMode,
    setVisibleThemeMode,
    setWebAppearanceMode,
    openCommunityQrDialog,
    navigateToQuery
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


  // Enter in the search box: a typed command, the highlighted (or
  // automatically highlighted) suggestion, the active search scope, an
  // inline or autocompleted site, a quick-navigation target, and last a
  // web search.
  function submitSearchQuery(query: string, event: KeyboardEvent): void {
    const commandMatch = searchMode.local ? null : getCommandMatch(query);
    if (commandMatch && searchResults.selectedIndex === -1) {
      if (commandMatch.command.type === 'commandNewTab') {
        LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'openNewTab' });
        return;
      }
      if (commandMatch.command.type === 'commandSettings') {
        LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'openOptionsPage' });
        return;
      }
    }
    if (!searchMode.local && isModeCommand(query)) {
      setVisibleThemeMode(getNextThemeMode(appliedTheme.mode));
      return;
    }
    if (!searchMode.local && isZenCommand(query)) {
      void settings.set(newtabZenMode, !settings.get(newtabZenMode));
      return;
    }
    const executeSuggestion = (
      selectedSuggestion: Suggestion | undefined,
      event: KeyboardEvent,
      activeSuggestionIndex: number
    ): boolean => {
      if (!selectedSuggestion) {
        return false;
      }
      const activeItem = Number.isInteger(activeSuggestionIndex)
        ? suggestionItems[activeSuggestionIndex]
        : null;
      if (selectedSuggestion.type === 'modeSwitch') {
        setVisibleThemeMode(selectedSuggestion.nextMode);
        return true;
      }
      if (selectedSuggestion.type === 'zenSwitch') {
        void settings.set(newtabZenMode, newtabZenMode.parse(selectedSuggestion.nextEnabled));
        return true;
      }
      if (selectedSuggestion.type === 'webAppearanceSwitch') {
        setWebAppearanceMode(selectedSuggestion.nextMode);
        return true;
      }
      if (selectedSuggestion.type === 'commandNewTab') {
        LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'openNewTab' });
        return true;
      }
      if (selectedSuggestion.type === 'commandSettings') {
        LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'openOptionsPage' });
        return true;
      }
      if (selectedSuggestion.type === 'siteSearchPrompt' && isSiteSearchProvider(selectedSuggestion.provider)) {
        modeActions.activateSiteSearch(selectedSuggestion.provider);
        searchBox.focusInput();
        return true;
      }
      if (selectedSuggestion.type === 'helpFeedback' && selectedSuggestion.feedbackKey === 'community') {
        openCommunityQrDialog(selectedSuggestion.url);
        return true;
      }
      if (isSiteSearchProvider(selectedSuggestion.provider) && selectedSuggestion.searchQuery) {
        return siteSearchRunner.run(
          selectedSuggestion.provider,
          selectedSuggestion.searchQuery,
          resultActivation.getDisposition(event)
        );
      }
      if (shouldSwitchMatchedTabSuggestion(selectedSuggestion)) {
        resultActivation.openMatchedTab(selectedSuggestion, event, activeItem, query);
        return true;
      }
      if (resultActivation.opensInBackground(event) && selectedSuggestion.url) {
        return resultActivation.openUrl(selectedSuggestion, query, event);
      }
      if (selectedSuggestion.forceSearch && selectedSuggestion.searchQuery) {
        navigateToQuery(selectedSuggestion.searchQuery, true, resultActivation.getDisposition(event));
        return true;
      }
      if (selectedSuggestion.url) {
        return resultActivation.openUrl(selectedSuggestion, query, event);
      }
      return false;
    };
    if (searchResults.selectedIndex >= 0 && searchResults.rows[searchResults.selectedIndex]) {
      if (executeSuggestion(searchResults.rows[searchResults.selectedIndex], event, searchResults.selectedIndex)) {
        return;
      }
    } else {
      const autoIndex = getAutoHighlightIndex();
      if (autoIndex >= 0 && searchResults.rows[autoIndex]) {
        if (executeSuggestion(searchResults.rows[autoIndex], event, autoIndex)) {
          return;
        }
      }
    }
    if (!searchMode.local && isSlashCommandInput(query)) {
      renderSuggestions([], query);
      return;
    }
    if (searchMode.local) {
      return;
    }
    if (searchMode.site) {
      if (siteSearchRunner.run(
        searchMode.site,
        query,
        resultActivation.getDisposition(event)
      )) {
        return;
      }
    }
    const inputValue = searchBox.inputParts ? searchBox.inputParts.input.value : '';
    const currentRawInput = (searchQuery.raw || inputValue || '').trim();
    const inline = searchMode.inline;
    if (inline && inline.isAuto && inline.rawInput === currentRawInput) {
      if (inline.provider && inline.query) {
        if (siteSearchRunner.run(
          inline.provider,
          inline.query,
          resultActivation.getDisposition(event)
        )) {
          return;
        }
      } else if (inline.url) {
        resultActivation.openUrl({
          url: inline.url,
          title: inline.url,
          type: 'inlineSiteSearch'
        }, query, event);
        return;
      }
    }
    if (searchAutocomplete.state && searchAutocomplete.state.url) {
      resultActivation.openUrl({
        url: searchAutocomplete.state.url,
        title: searchAutocomplete.state.title || '',
        type: 'autocomplete'
      }, query, event);
      return;
    }
    void quickNavigation.resolve(query).then((targetUrl) => {
      if (targetUrl) {
        resultActivation.openUrl({
          url: targetUrl,
          title: query,
          type: 'quickNavigation'
        }, query, event);
        return;
      }
      navigateToQuery(query, false, resultActivation.getDisposition(event));
    });
  }

  return {
    submitSearchQuery,
    quickNavigation,
    getDirectUrlSuggestion,
    getMatchedOpenTabIdForSuggestion,
    shouldSwitchMatchedTabSuggestion,
    refreshTabsForSearchContext
  };
}

// The shortcut rules in a list read from the bundled file or the
// background; entries that are not rules are left out.
// Whether a row's provider names a site search; rows may leave out its key.
function isSiteSearchProvider(provider: Partial<SiteSearchProvider> | null | undefined): provider is SiteSearchProvider {
  return Boolean(provider) && typeof provider?.key === 'string';
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
