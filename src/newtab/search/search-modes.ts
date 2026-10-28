// Search mode menu and site-search / local-scope activation for the input.
import type { ShortcutRule } from '../../domain/messages';
import type { SuggestionInputPreview } from '../../domain/search/suggestion-input-preview';
import type { LocalSearchScope, SiteSearchProvider } from '../../domain/search/types';
import type { SearchInputParts } from '../../shared/react/search-input';
import type { Suggestion } from '../../shared/react/search/suggestion-list/types';
import type { InputModeController } from '../../shared/search/search-input-mode';
import { shortcutRulesCache } from '../../shared/search/shortcut-rules-cache';
import * as SearchSiteSearchProviders from '../../domain/search/utils/site-search-providers';
import type { SiteSearchCatalog } from '../../shared/search-panel/site-search/catalog';
import type { DefaultSearchEngine } from '../../shared/search-panel/default-engine';
import type { SearchQuery } from '../../shared/search-panel/search-query';
import type { SearchAutocomplete } from '../../shared/search-panel/autocomplete';
import type { SearchMode } from '../../shared/search-panel/search-mode';
import type { SearchResults } from '../../shared/search-panel/search-results';
import type { SearchMatching } from '../../shared/search-panel/matching';
import type { SearchModeActions } from '../../shared/search-panel/mode-actions';

// A site search the typed text turns into on Tab.
interface SiteSearchTrigger {
  rawInput: string;
  provider: SiteSearchProvider | null;
}

// A local scope the typed text turns into on Tab.
interface LocalScopeTrigger {
  rawInput: string;
  scope: LocalSearchScope | null;
}

interface SearchModesState {
  inputParts: SearchInputParts | null;
  inputModeController: InputModeController | null;
  suggestionInputPreview: Pick<SuggestionInputPreview, 'commit' | 'editAddress'>;
}

interface SearchModesDeps {
  modeActions: SearchModeActions<SiteSearchProvider>;
  searchMatching: SearchMatching;
  searchResults: SearchResults<Suggestion>;
  searchMode: SearchMode<SiteSearchProvider>;
  searchAutocomplete: SearchAutocomplete;
  searchQuery: SearchQuery;
  siteSearchCatalog: SiteSearchCatalog;
  searchEngine: DefaultSearchEngine;
  getShortcutRules(): Promise<ShortcutRule[]>;
  pageState: SearchModesState;
}


function createSearchModes(deps: SearchModesDeps) {
  const {
    modeActions,
    searchMatching,
    searchResults,
    searchMode,
    searchAutocomplete,
    searchQuery,
    siteSearchCatalog,
    searchEngine,
    getShortcutRules,
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  // The search box's input; the page creates it before any mode is used.
  function getSearchInput(): HTMLInputElement {
    const inputParts = pageState.inputParts;
    if (!inputParts) {
      throw new Error('Search input unavailable');
    }
    return inputParts.input;
  }









  // With an empty or typed input, a double Tab starts the default engine's
  // mode and opens the menu; false when it did not.
  function openSearchModeMenuFromDoubleTab(): boolean | Promise<boolean> {
    const expectedInputValue = String(getSearchInput().value || '');
    const activateDefaultProvider = (providers: readonly SiteSearchProvider[]): boolean => {
      const controller = pageState.inputModeController;
      if (!controller || searchMode.site || searchMode.local ||
          String(getSearchInput().value || '') !== expectedInputValue) {
        return false;
      }
      const provider = SearchSiteSearchProviders.getSearchEngineSiteSearchProvider(searchEngine.engine, providers);
      if (!provider) {
        return false;
      }
      if (expectedInputValue.trim()) {
        modeActions.activateSiteSearch(provider, {
          preserveResults: Boolean(String(expectedInputValue || '').trim())
        });
        modeActions.restoreSearchModeQuery(expectedInputValue);
      } else {
        modeActions.activateSiteSearch(provider);
      }
      controller.openModeMenu('none');
      return true;
    };
    const loaded = siteSearchCatalog.loadedProviders;
    return loaded ? activateDefaultProvider(loaded) : siteSearchCatalog.loadProviders().then(activateDefaultProvider);
  }










  // Tab in the search box: toggles or opens the mode menu, turns a typed
  // trigger into a site search or local scope, or takes the inline
  // completion. True when it handled the key.
  function handleSearchTabKey(event: KeyboardEvent): boolean {
    if (event.defaultPrevented) {
      return false;
    }
    const controller = pageState.inputModeController;
    if (controller && controller.handleModeMenuTabFocusToggle(event)) {
      return true;
    }
    // Tab takes the suggestion the arrows show as typed text.
    if (!event.shiftKey && pageState.suggestionInputPreview.commit()) {
      event.preventDefault();
      getSearchInput().dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    if (controller && controller.shouldOpenModeMenuForActiveModeOnTab(event)) {
      controller.openModeMenu('none');
      return true;
    }
    if (searchMode.site || searchMode.local) {
      return false;
    }
    // On a page the arrows selected, Tab puts its address in the input to edit.
    const selectedSuggestion = searchResults.selectedIndex >= 0 ? searchResults.rows[searchResults.selectedIndex] : null;
    if (!event.shiftKey && pageState.suggestionInputPreview.editAddress(getSearchInput(), selectedSuggestion)) {
      event.preventDefault();
      getSearchInput().dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    const rawValue = getSearchInput().value;
    const rawTrigger = searchQuery.raw || rawValue;
    const triggerInput = (rawTrigger || rawValue).trim();
    if (!triggerInput && controller) {
      const shouldOpenModeMenu = controller.shouldOpenModeMenuOnDoubleTab(event);
      if (shouldOpenModeMenu) {
        void openSearchModeMenuFromDoubleTab();
      }
      return Boolean(event.defaultPrevented);
    }
    if (searchMode.siteTrigger &&
        searchMode.siteTrigger.rawInput === triggerInput &&
        searchMode.siteTrigger.provider) {
      event.preventDefault();
      modeActions.activateSiteSearch(searchMode.siteTrigger.provider);
      return true;
    }
    if (searchMode.localTrigger &&
        searchMode.localTrigger.rawInput === triggerInput &&
        searchMode.localTrigger.scope) {
      event.preventDefault();
      return modeActions.activateLocalSearchScope(searchMode.localTrigger.scope);
    }
    if (triggerInput) {
      event.preventDefault();
      const providers = siteSearchCatalog.triggerProviders;
      const topSiteMatch = searchMatching.getTopSiteMatchCandidate(searchResults.rows, triggerInput);
      const directProvider = searchMatching.getSiteSearchTriggerCandidate(triggerInput, providers, topSiteMatch);
      if (directProvider) {
        modeActions.activateSiteSearch(directProvider);
        return true;
      }
      const cachedRules = shortcutRulesCache.rules;
      const directLocalScope = searchMatching.getLocalSearchScopeCandidate(triggerInput, cachedRules);
      if (siteSearchCatalog.loadedProviders && directLocalScope) {
        modeActions.activateLocalSearchScope(directLocalScope);
        return true;
      }
      void Promise.all([
        siteSearchCatalog.loadProviders(),
        siteSearchCatalog.loadAggregates(),
        getShortcutRules()
      ]).then(([, , rules]) => {
        if (searchMode.site || searchMode.local ||
            String(getSearchInput().value || '').trim() !== triggerInput) {
          return;
        }
        const asyncTopSiteMatch = searchMatching.getTopSiteMatchCandidate(searchResults.rows, triggerInput);
        const asyncProvider = searchMatching.getSiteSearchTriggerCandidate(
          triggerInput,
          siteSearchCatalog.triggerProviders,
          asyncTopSiteMatch
        );
        if (asyncProvider) {
          modeActions.activateSiteSearch(asyncProvider);
          return;
        }
        const asyncLocalScope = searchMatching.getLocalSearchScopeCandidate(triggerInput, rules);
        if (asyncLocalScope) {
          modeActions.activateLocalSearchScope(asyncLocalScope);
          return;
        }
        if (searchAutocomplete.state && searchAutocomplete.state.completion) {
          searchAutocomplete.accept();
        }
      });
      return true;
    }
    if (searchAutocomplete.state && searchAutocomplete.state.completion) {
      event.preventDefault();
      searchAutocomplete.accept();
      return true;
    }
    return false;
  }

  return {
    handleSearchTabKey,
    openSearchModeMenuFromDoubleTab,
  };
}

type SearchModes = ReturnType<typeof createSearchModes>;

export { createSearchModes };
export type { LocalScopeTrigger, SearchModes, SearchModesDeps, SearchModesState, SiteSearchTrigger };
