// Search modes: site search, local scopes and open tabs, their input
// prefixes and labels, and the top-site and trigger candidates that suggest
// switching.
import type { ShortcutRule } from '../../domain/messages';
import type { LocalSearchScope, SiteSearchProvider, SuggestionLike } from '../../domain/search/types';
import type { InputModeController } from '../../shared/search/search-input-mode';
import type { ModeTagOptions } from '../../shared/search/input-mode/tag';
import type { InputModeProvider, InputModeTheme } from '../../shared/search/input-mode/types';
import type { FormatMessage, LocalSearchScopeTrigger, SiteSearchTrigger, Translate } from './types';
import type { RemixIconName } from '../../shared/ui/remix-icon';
import * as SearchNavigationMatching from '../../domain/search/utils/navigation-matching';
import * as SearchSiteSearchMatching from '../../domain/search/utils/site-search-matching';
import * as SearchSiteSearchProviders from '../../domain/search/utils/site-search-providers';
import * as SearchEngineSuggestions from '../../domain/search/utils/engine-suggestions';
import { searchResultSourceTypes } from '../../domain/settings/search';
import type { OverlaySettings } from '../overlay-settings';
import type { SearchQuery } from '../../shared/search-panel/search-query';

interface SearchModesState {
  settings: Pick<OverlaySettings, 'get'>;
  inputModeController: Pick<InputModeController,
    'updateLayout' | 'setProviderPrefix' | 'setPrefixText' | 'clearProviderPrefix'> | null;
  searchInput: HTMLInputElement | null;
  defaultTheme: InputModeTheme;
  openTabsSearchModeActive: boolean;
  siteSearchState: InputModeProvider | null;
  siteSearchTriggerState: SiteSearchTrigger<InputModeProvider> | null;
  localSearchScopeState: LocalSearchScope | null;
  localSearchScopeTriggerState: LocalSearchScopeTrigger | null;
  // Cleared whenever the mode changes.
  inlineSearchState: unknown;
  overlaySuggestionRequestSeq: number;
}

interface SearchModesDeps {
  searchQuery: SearchQuery;
  t: Translate;
  formatMessage: FormatMessage;
  isAggregateSearchProvider(provider: Partial<SiteSearchProvider> | null): boolean;
  isAiSiteSearchProvider(provider: Partial<SiteSearchProvider> | null | undefined): boolean;
  getDirectNavigationUrl(rawQuery: string): unknown;
  getUrlDisplay(url: string | undefined): string;
  cancelPendingOverlaySuggestionRequests(): void;
  clearAutocomplete(): void;
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
    searchQuery,
    t,
    isAggregateSearchProvider,
    formatMessage,
    isAiSiteSearchProvider,
    getDirectNavigationUrl,
    getUrlDisplay,
    cancelPendingOverlaySuggestionRequests,
    clearAutocomplete,
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
      if (!overlayState.openTabsSearchModeActive || overlayState.siteSearchState || overlayState.localSearchScopeState) {
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

  function getSiteSearchDisplayName(provider: Partial<SiteSearchProvider> | null | undefined): string {
    if (!provider) {
      return t('site_search_default', '站内');
    }
    const mapping = SearchSiteSearchProviders.getSiteSearchProviderDisplayNameMessage(provider);
    if (mapping) {
      return t(mapping.messageKey, mapping.fallback);
    }
    return provider.name || provider.key || t('site_search_default', '站内');
  }

  function getSiteSearchActionTitle(provider: SiteSearchProvider | null, query: string): string {
    const site = getSiteSearchDisplayName(provider);
    const queryText = String(query || '').trim();
    if (isAggregateSearchProvider(provider)) {
      return queryText
        ? formatMessage('aggregate_search_action_query', '使用{name}搜索“{query}”', {
            name: site,
            query: queryText
          })
        : formatMessage('aggregate_search_action', '使用{name}搜索', { name: site });
    }
    if (isAiSiteSearchProvider(provider)) {
      return queryText
        ? formatMessage('ask_ai_provider_query', '向 {site} 提问 "{query}"', { site, query: queryText })
        : formatMessage('ask_ai_provider', '向 {site} 提问', { site });
    }
    return queryText
      ? formatMessage('search_in_site_query', '在 {site} 中搜索 "{query}"', { site, query: queryText })
      : formatMessage('search_in_site', '在 {site} 中搜索', { site });
  }

  function getSiteSearchPrefixText(provider: Partial<SiteSearchProvider> | null | undefined): string {
    if (isAiSiteSearchProvider(provider)) {
      return getSiteSearchDisplayName(provider);
    }
    return getSiteSearchDisplayName(provider) || formatMessage('search_in_site', '在 {site} 中搜索', {
      site: provider && provider.name ? provider.name : ''
    });
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

  function getLocalSearchScopeLabel(scope: Pick<LocalSearchScope, 'sourceType'> | null): string {
    const sourceType = scope && scope.sourceType ? scope.sourceType : '';
    if (sourceType === 'bookmark') {
      return t('search_tag_bookmark', '书签');
    }
    if (sourceType === 'history') {
      return t('search_tag_history', '历史');
    }
    if (sourceType === 'topSite') {
      return t('search_tag_top_site', '常用');
    }
    return '';
  }

  function getLocalSearchScopeIconName(sourceType: string): RemixIconName {
    if (sourceType === 'bookmark') {
      return 'ri-bookmark-3-line';
    }
    if (sourceType === 'history') {
      return 'ri-history-line';
    }
    return 'ri-star-line';
  }

  // A stand-in provider whose Tab hint names the local source.
  function getLocalSearchScopeTabHintProvider(scope: LocalSearchScope): InputModeProvider {
    const source = getLocalSearchScopeLabel(scope);
    return {
      key: `local:${scope.sourceType}`,
      name: source,
      tabHintLabel: formatMessage(
        'local_search_tab_hint',
        '仅搜索{source}',
        { source }
      )
    };
  }

  function setLocalSearchScopePrefix(scope: LocalSearchScope | null): void {
    if (!overlayState.inputModeController || !scope) {
      return;
    }
    overlayState.inputModeController.setPrefixText(
      getLocalSearchScopeLabel(scope),
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
    overlayState.openTabsSearchModeActive = false;
    overlayState.localSearchScopeState = scope;
    overlayState.localSearchScopeTriggerState = null;
    overlayState.siteSearchState = null;
    overlayState.siteSearchTriggerState = null;
    overlayState.inlineSearchState = null;
    if (overlayState.searchInput) {
      overlayState.searchInput.value = '';
    }
    searchQuery.clear();
    clearAutocomplete();
    setLocalSearchScopePrefix(scope);
    if (options.preserveResults !== true) {
      clearSearchSuggestions();
    }
    return true;
  }

  function clearLocalSearchScope(): boolean {
    if (!overlayState.localSearchScopeState) {
      return false;
    }
    overlayState.overlaySuggestionRequestSeq += 1;
    overlayState.localSearchScopeState = null;
    overlayState.localSearchScopeTriggerState = null;
    overlayState.inlineSearchState = null;
    clearSiteSearchPrefix();
    clearAutocomplete();
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
    overlayState.openTabsSearchModeActive = false;
    overlayState.localSearchScopeState = null;
    overlayState.localSearchScopeTriggerState = null;
    overlayState.siteSearchState = provider;
    overlayState.inlineSearchState = null;
    if (overlayState.searchInput) {
      overlayState.searchInput.value = '';
    }
    searchQuery.clear();
    clearAutocomplete();
    const immediateTheme = getImmediateThemeForSuggestion({ provider }) || overlayState.defaultTheme;
    setSiteSearchPrefix(provider, immediateTheme, {
      animate: options.animatePrefix !== false
    });
    void getThemeForProvider(provider).then((theme) => {
      if (overlayState.siteSearchState === provider) {
        setSiteSearchPrefix(provider, theme);
      }
    });
    if (options.preserveResults !== true) {
      clearSearchSuggestions();
    }
  }

  function clearSiteSearch(): void {
    if (!overlayState.siteSearchState) {
      return;
    }
    overlayState.siteSearchState = null;
    overlayState.inlineSearchState = null;
    clearSiteSearchPrefix();
    clearAutocomplete();
  }

  function activateOpenTabsSearchMode(
    options?: OpenTabsPrefixOptions & { deferPrefixEntry?: boolean; deferResults?: boolean }
  ): void {
    const prefixOptions = options || {};
    cancelPendingOpenTabsPrefixEntry();
    cancelPendingOverlaySuggestionRequests();
    overlayState.openTabsSearchModeActive = true;
    overlayState.siteSearchState = null;
    overlayState.localSearchScopeState = null;
    overlayState.localSearchScopeTriggerState = null;
    overlayState.inlineSearchState = null;
    overlayState.siteSearchTriggerState = null;
    clearAutocomplete();
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
    if (!overlayState.openTabsSearchModeActive) {
      return;
    }
    cancelPendingOpenTabsPrefixEntry();
    overlayState.openTabsSearchModeActive = false;
    clearSiteSearchPrefix();
    clearAutocomplete();
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
    getSiteSearchDisplayName,
    getSiteSearchActionTitle,
    getSiteSearchPrefixText,
    getInlineSiteSearchCandidate,
    promoteStrongNavigationMatch,
    getKeywordSearchSuggestionState,
    getTopSiteMatchCandidate,
    promoteTopSiteMatch,
    getSiteSearchTriggerCandidate,
    getLocalSearchScopeCandidate,
    getLocalSearchScopeLabel,
    getLocalSearchScopeIconName,
    getLocalSearchScopeTabHintProvider,
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
