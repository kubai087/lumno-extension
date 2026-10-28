// Search modes: site search, local scopes and open tabs, their input
// prefixes and labels, and the top-site and trigger candidates that suggest
// switching.
import type { ShortcutRule } from '../../domain/messages';
import type { LocalSearchScope, SiteSearchProvider, SuggestionLike } from '../../domain/search/types';
import type { InputModeController } from '../../shared/search/search-input-mode';
import type { ModeTagOptions } from '../../shared/search/input-mode/tag';
import type { InputModeProvider, InputModeTheme } from '../../shared/search/input-mode/types';
import type { Translate } from './types';
import * as SearchNavigationMatching from '../../domain/search/utils/navigation-matching';
import * as SearchSiteSearchMatching from '../../domain/search/utils/site-search-matching';
import * as SearchSiteSearchProviders from '../../domain/search/utils/site-search-providers';
import * as SearchEngineSuggestions from '../../domain/search/utils/engine-suggestions';
import { searchResultSourceTypes } from '../../domain/settings/search';
import type { OverlaySettings } from '../overlay-settings';
import type { SearchQuery } from '../../shared/search-panel/search-query';
import type { SearchAutocomplete } from '../../shared/search-panel/autocomplete';
import type { ActiveLocalScope, SearchMode } from '../../shared/search-panel/search-mode';
import type { SearchResults } from '../../shared/search-panel/search-results';
import type { OverlaySuggestion } from './types';
import { getLocalSearchScopeIconName, getLocalSearchScopeLabel } from '../../shared/search-panel/labels';
import type { SearchLocale } from '../../shared/search-panel/labels';

interface SearchModesState {
  settings: Pick<OverlaySettings, 'get'>;
  inputModeController: Pick<InputModeController,
    'updateLayout' | 'setProviderPrefix' | 'setPrefixText' | 'clearProviderPrefix'> | null;
  searchInput: HTMLInputElement | null;
  defaultTheme: InputModeTheme;
}

interface SearchModesDeps {
  locale: SearchLocale;
  searchResults: SearchResults<OverlaySuggestion>;
  searchMode: SearchMode<InputModeProvider>;
  searchAutocomplete: SearchAutocomplete;
  searchQuery: SearchQuery;
  t: Translate;
  getDirectNavigationUrl(rawQuery: string): unknown;
  getUrlDisplay(url: string | undefined): string;
  cancelPendingOverlaySuggestionRequests(): void;
  clearSearchSuggestions(): void;
  getImmediateThemeForSuggestion(suggestion: { provider: InputModeProvider }): InputModeTheme | null;
  getThemeForProvider(provider: InputModeProvider): Promise<InputModeTheme>;
  renderCachedTabsForOverlay(query: string): void;
  requestTabsAndRender(query?: string): void;
  isSlashCommandInput(input: string): boolean;
  // Called with no rows: the list rebuilds from the typed command.
  updateSearchSuggestions(rows: never[], query: string): void;
  requestOverlaySearchSuggestions(query: string): void;
  overlayState: SearchModesState;
}

interface OpenTabsPrefixOptions {
  animate?: boolean;
  preserveModeMenuDoubleTab?: boolean;
}

function createSearchModes(deps: SearchModesDeps) {
  const {
    locale,
    searchResults,
    searchMode,
    searchAutocomplete,
    searchQuery,
    t,
    getDirectNavigationUrl,
    getUrlDisplay,
    cancelPendingOverlaySuggestionRequests,
    clearSearchSuggestions,
    getImmediateThemeForSuggestion,
    getThemeForProvider,
    renderCachedTabsForOverlay,
    requestTabsAndRender,
    isSlashCommandInput,
    updateSearchSuggestions,
    requestOverlaySearchSuggestions
  } = deps;

  // The panel state object shared with search-panel.ts and the other modules.
  const overlayState = deps.overlayState;

  const OVERLAY_OPEN_TABS_PREFIX_FEEDBACK_DELAY_MS = 120;
  let pendingOpenTabsPrefixEntryTimer = 0;

  function updateSiteSearchPrefixLayout(): void {
    if (overlayState.inputModeController) {
      overlayState.inputModeController.updateLayout();
    }
  }

  function setSiteSearchPrefix(
    provider: InputModeProvider | null,
    theme: InputModeTheme | null,
    options?: ModeTagOptions | null
  ): void {
    if (overlayState.inputModeController) {
      overlayState.inputModeController.setProviderPrefix(provider, theme, options);
    }
  }

  function setOpenTabsSearchPrefix(theme: InputModeTheme, options?: OpenTabsPrefixOptions): void {
    if (overlayState.inputModeController) {
      const prefixOptions = options || {};
      overlayState.inputModeController.setPrefixText(
        t('search_open_tabs_only_entry', '搜索已打开标签页'),
        theme,
        {
          animate: prefixOptions.animate !== false,
          iconName: 'ri-window-line',
          menuIconName: 'browser',
          modeId: 'openTabs',
          preserveModeMenuDoubleTab: Boolean(
            prefixOptions.preserveModeMenuDoubleTab
          )
        }
      );
    }
  }

  function cancelPendingOpenTabsPrefixEntry(): boolean {
    if (!pendingOpenTabsPrefixEntryTimer) {
      return false;
    }
    window.clearTimeout(pendingOpenTabsPrefixEntryTimer);
    pendingOpenTabsPrefixEntryTimer = 0;
    return true;
  }

  // Shows the open tabs prefix a moment later, so a quick second key can
  // still change the mode first.
  function scheduleOpenTabsPrefixEntry(options?: OpenTabsPrefixOptions): void {
    cancelPendingOpenTabsPrefixEntry();
    const prefixOptions = options || {};
    pendingOpenTabsPrefixEntryTimer = window.setTimeout(() => {
      pendingOpenTabsPrefixEntryTimer = 0;
      if (!searchMode.openTabs || searchMode.site || searchMode.local) {
        return;
      }
      setOpenTabsSearchPrefix(overlayState.defaultTheme, {
        animate: true,
        preserveModeMenuDoubleTab: Boolean(
          prefixOptions.preserveModeMenuDoubleTab
        )
      });
    }, OVERLAY_OPEN_TABS_PREFIX_FEEDBACK_DELAY_MS);
  }

  function clearSiteSearchPrefix(): void {
    if (overlayState.inputModeController) {
      overlayState.inputModeController.clearProviderPrefix();
    }
  }




  function getInlineSiteSearchCandidate(input: string, providers: SiteSearchProvider[] | null) {
    return SearchSiteSearchMatching.getInlineSiteSearchCandidate(input, providers);
  }

  function promoteStrongNavigationMatch<T extends SuggestionLike>(list: T[], rawQuery: string): T | null {
    return SearchNavigationMatching.promoteStrongNavigationMatch(list, rawQuery, {
      getDirectNavigationUrl,
      getUrlDisplay
    });
  }

  function getKeywordSearchSuggestionState<T extends SuggestionLike>(list: T[]) {
    return SearchEngineSuggestions.getKeywordSearchSuggestionState(list);
  }

  function matchesTopSitePrefix(suggestion: SuggestionLike | null, input: string): boolean {
    if (!suggestion || !(suggestion.type === 'topSite' || suggestion.isTopSite)) {
      return false;
    }
    const query = String(input || '').trim().toLowerCase();
    if (!query) {
      return false;
    }
    const titleText = String(suggestion.title || '').toLowerCase();
    if (titleText.startsWith(query)) {
      return true;
    }
    const urlText = getUrlDisplay(suggestion.url || '');
    if (!urlText) {
      return false;
    }
    const host = urlText.split('/')[0] || '';
    return host.toLowerCase().startsWith(query);
  }

  // The top site the query starts, by host first and then by title.
  function getTopSiteMatchCandidate<T extends SuggestionLike>(list: T[] | null, input: string): T | null {
    if (!Array.isArray(list)) {
      return null;
    }
    const query = String(input || '').trim();
    if (!query || /\s/.test(query)) {
      return null;
    }
    let fallback: T | null = null;
    for (let i = 0; i < list.length; i += 1) {
      const suggestion = list[i];
      if (!suggestion || !(suggestion.type === 'topSite' || suggestion.isTopSite)) {
        continue;
      }
      const urlText = getUrlDisplay(suggestion.url || '');
      const host = urlText ? (urlText.split('/')[0] || '') : '';
      if (host && host.toLowerCase().startsWith(query.toLowerCase())) {
        return suggestion;
      }
      if (!fallback && matchesTopSitePrefix(suggestion, query)) {
        fallback = suggestion;
      }
    }
    return fallback;
  }

  // Moves the matching top site to the top when it is already the first
  // result besides the search action.
  function promoteTopSiteMatch<T extends SuggestionLike>(list: T[], queryText: string): T | null {
    const match = getTopSiteMatchCandidate(list, queryText);
    if (!match) {
      return null;
    }
    const matchIndex = list.indexOf(match);
    const firstResultIndex = Array.isArray(list)
      ? list.findIndex((item) => item && item.type !== 'newtab')
      : -1;
    if (matchIndex !== firstResultIndex) {
      return null;
    }
    if (matchIndex > 0) {
      const [picked] = list.splice(matchIndex, 1);
      list.unshift(picked);
      return picked;
    }
    if (matchIndex === 0) {
      return list[0];
    }
    return null;
  }

  function getSiteSearchTriggerCandidate(
    input: string,
    providers: SiteSearchProvider[] | null,
    topSiteMatch: SuggestionLike | null
  ): SiteSearchProvider | null {
    return SearchSiteSearchMatching.getSiteSearchTriggerCandidate(input, providers, topSiteMatch, {
      matchesTopSitePrefix
    });
  }

  function getLocalSearchScopeCandidate(input: string, rules: ShortcutRule[] | undefined): LocalSearchScope | null {
    const scope = SearchSiteSearchProviders.findLocalSearchScope(input, rules);
    if (!scope || !overlayState.settings.get(searchResultSourceTypes).includes(scope.sourceType)) {
      return null;
    }
    return scope;
  }




  function setLocalSearchScopePrefix(scope: ActiveLocalScope | null): void {
    if (!overlayState.inputModeController || !scope) {
      return;
    }
    overlayState.inputModeController.setPrefixText(
      getLocalSearchScopeLabel(locale, scope),
      overlayState.defaultTheme,
      {
        animate: true,
        iconName: getLocalSearchScopeIconName(scope.sourceType),
        menuIconName: scope.sourceType === 'topSite' ? 'star' : scope.sourceType,
        modeId: `local:${scope.sourceType}`
      }
    );
  }

  // Narrows search to one local source; false when that source is off.
  function activateLocalSearchScope(scope: LocalSearchScope | null, activationOptions?: { preserveResults?: boolean } | null): boolean {
    if (!scope || !overlayState.settings.get(searchResultSourceTypes).includes(scope.sourceType)) {
      return false;
    }
    const options: { preserveResults?: boolean } = activationOptions && typeof activationOptions === 'object'
      ? activationOptions
      : {};
    cancelPendingOverlaySuggestionRequests();
    searchMode.enterLocal(scope);
    if (overlayState.searchInput) {
      overlayState.searchInput.value = '';
    }
    searchQuery.clear();
    searchAutocomplete.clear();
    setLocalSearchScopePrefix(scope);
    if (options.preserveResults !== true) {
      clearSearchSuggestions();
    }
    return true;
  }

  function clearLocalSearchScope(): boolean {
    if (!searchMode.local) {
      return false;
    }
    searchResults.cancelRequests();
    searchMode.leaveLocal();
    clearSiteSearchPrefix();
    searchAutocomplete.clear();
    return true;
  }

  function activateSiteSearch(
    provider: InputModeProvider | null,
    activationOptions?: { preserveResults?: boolean; animatePrefix?: boolean } | null
  ): void {
    if (!provider) {
      return;
    }
    const options: { preserveResults?: boolean; animatePrefix?: boolean } = activationOptions && typeof activationOptions === 'object'
      ? activationOptions
      : {};
    cancelPendingOpenTabsPrefixEntry();
    if (options.preserveResults === true) {
      cancelPendingOverlaySuggestionRequests();
    }
    searchMode.enterSite(provider);
    if (overlayState.searchInput) {
      overlayState.searchInput.value = '';
    }
    searchQuery.clear();
    searchAutocomplete.clear();
    const immediateTheme = getImmediateThemeForSuggestion({ provider }) || overlayState.defaultTheme;
    setSiteSearchPrefix(provider, immediateTheme, {
      animate: options.animatePrefix !== false
    });
    void getThemeForProvider(provider).then((theme) => {
      if (searchMode.site === provider) {
        setSiteSearchPrefix(provider, theme);
      }
    });
    if (options.preserveResults !== true) {
      clearSearchSuggestions();
    }
  }

  function clearSiteSearch(): void {
    if (!searchMode.site) {
      return;
    }
    searchMode.leaveSite();
    clearSiteSearchPrefix();
    searchAutocomplete.clear();
  }

  function activateOpenTabsSearchMode(
    options?: OpenTabsPrefixOptions & { deferPrefixEntry?: boolean; deferResults?: boolean }
  ): void {
    const prefixOptions = options || {};
    cancelPendingOpenTabsPrefixEntry();
    cancelPendingOverlaySuggestionRequests();
    searchMode.enterOpenTabs();
    searchAutocomplete.clear();
    if (prefixOptions.deferPrefixEntry === true) {
      scheduleOpenTabsPrefixEntry(prefixOptions);
    } else {
      setOpenTabsSearchPrefix(overlayState.defaultTheme, prefixOptions);
    }
    searchQuery.set(overlayState.searchInput ? overlayState.searchInput.value || '' : '');
    if (prefixOptions.deferResults !== true) {
      renderCachedTabsForOverlay(searchQuery.text);
      requestTabsAndRender(searchQuery.text);
    }
  }

  function clearOpenTabsSearchMode(): void {
    if (!searchMode.openTabs) {
      return;
    }
    cancelPendingOpenTabsPrefixEntry();
    searchMode.leaveOpenTabs();
    clearSiteSearchPrefix();
    searchAutocomplete.clear();
    const rawValue = overlayState.searchInput ? overlayState.searchInput.value || '' : '';
    const query = rawValue.trim();
    searchQuery.set(rawValue, query);
    if (!query) {
      clearSearchSuggestions();
      return;
    }
    if (isSlashCommandInput(query)) {
      updateSearchSuggestions([], query);
      return;
    }
    requestOverlaySearchSuggestions(query);
  }

  return {
    updateSiteSearchPrefixLayout,
    setSiteSearchPrefix,
    cancelPendingOpenTabsPrefixEntry,
    getInlineSiteSearchCandidate,
    promoteStrongNavigationMatch,
    getKeywordSearchSuggestionState,
    getTopSiteMatchCandidate,
    promoteTopSiteMatch,
    getSiteSearchTriggerCandidate,
    getLocalSearchScopeCandidate,
    setLocalSearchScopePrefix,
    activateLocalSearchScope,
    clearLocalSearchScope,
    activateSiteSearch,
    clearSiteSearch,
    activateOpenTabsSearchMode,
    clearOpenTabsSearchMode
  };
}

export { createSearchModes };
export type { SearchModesDeps, SearchModesState };
