// What Enter in the search box does: runs the selected or highlighted row,
// a slash command, a site search, a keyword or an address, or searches.
import type { Disposition } from '../../domain/navigation-disposition';
import type { SiteSearchProvider } from '../../domain/search/types';
import * as LumnoMessaging from '../../platform/messaging';
import type { Suggestion, SuggestionElement } from '../../shared/react/search/suggestion-list/types';
import type { RenderSuggestions } from './search-types';
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
import type { SearchBoxParts } from './search-box-parts';
import type { AppliedThemeMode } from '../theme/applied-theme-mode';
import type { WebAppearance } from './web-appearance';

import type { CommandMatch, SearchNavigation } from './search-navigation';

interface SearchSubmitDeps extends Pick<SearchNavigation, 'quickNavigation' | 'shouldSwitchMatchedTabSuggestion'> {
  siteSearchRunner: SiteSearchRunner;
  modeActions: SearchModeActions<SiteSearchProvider>;
  searchResults: SearchResults<Suggestion>;
  searchMode: SearchMode<SiteSearchProvider>;
  searchAutocomplete: SearchAutocomplete;
  searchQuery: SearchQuery;
  settings: Pick<SettingsStore, 'get' | 'set'>;
  resultActivation: ResultActivation;
  suggestionItems: SuggestionElement[];
  renderSuggestions: RenderSuggestions;
  isSlashCommandInput(query: string): boolean;
  getCommandMatch(query: string): CommandMatch | null;
  isModeCommand(query: string): boolean;
  isZenCommand(query: string): boolean;
  getNextThemeMode(mode: string): string;
  setVisibleThemeMode: AppearanceModes['setVisibleThemeMode'];
  webAppearance: Pick<WebAppearance, 'set'>;
  openCommunityQrDialog(url: string | undefined): void;
  // Searches the query with the default engine; `forceSearch` skips the
  // address check.
  navigateToQuery(query: string, forceSearch: boolean, disposition: Disposition): void;
  searchBox: Pick<SearchBoxParts, 'focusInput' | 'inputParts' | 'suggestionsView'>;
  appliedTheme: Pick<AppliedThemeMode, 'mode'>;
}

function createSearchSubmit(deps: SearchSubmitDeps) {
  const {
    quickNavigation,
    shouldSwitchMatchedTabSuggestion,
    siteSearchRunner,
    modeActions,
    searchResults,
    searchMode,
    searchAutocomplete,
    searchQuery,
    settings,
    resultActivation,
    suggestionItems,
    renderSuggestions,
    isSlashCommandInput,
    getCommandMatch,
    isModeCommand,
    isZenCommand,
    getNextThemeMode,
    setVisibleThemeMode,
    webAppearance,
    openCommunityQrDialog,
    navigateToQuery,
    searchBox,
    appliedTheme
  } = deps;

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
        webAppearance.set(selectedSuggestion.nextMode);
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
      const autoIndex = searchBox.suggestionsView ? searchBox.suggestionsView.getAutoHighlightIndex() : -1;
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

  return { submitSearchQuery };
}

// Whether a row's provider names a site search; rows may leave out its key.
function isSiteSearchProvider(provider: Partial<SiteSearchProvider> | null | undefined): provider is SiteSearchProvider {
  return Boolean(provider) && typeof provider?.key === 'string';
}

export { createSearchSubmit };
export type { SearchSubmitDeps };
