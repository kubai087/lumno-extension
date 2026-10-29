// Requesting, rendering and activating search suggestions.
import type * as SuggestionActionModel from '../../domain/search/suggestion-action-model';
import type { SiteSearchProvider } from '../../domain/search/types';
import * as LumnoMessaging from '../../platform/messaging';
import type {
  Suggestion,
  SuggestionElement,
  SuggestionProvider
} from '../../shared/react/search/suggestion-list/types';
import { holdSuggestionsHeight, releaseSuggestionsHeight } from '../../shared/search/suggestions-height-layout';
import type { AppearanceModes } from '../appearance-modes';
import type { FormatMessage, Translate } from '../newtab-types';
import type { SearchNavigation } from './search-navigation';
import type {
  RequestSuggestionsOptions,
  SlashCommand
} from './search-types';
import type { SiteSearchProviders } from './site-search-providers';
import * as SearchEngineSuggestions from '../../domain/search/utils/engine-suggestions';
import * as SearchSuggestionSlate from '../../domain/search/utils/suggestion-slate';
import type { SiteSearchCatalog } from '../../shared/search-panel/site-search/catalog';
import type { DefaultSearchEngine } from '../../shared/search-panel/default-engine';
import { searchResultDisplayLimit, searchResultPriority, tabRankScoreDebug } from '../../domain/settings/search';
import { overlayTabPriority } from '../../domain/settings/overlay-panel';
import { simpleModeEnabled } from '../../domain/settings/appearance';
import type { SettingsStore } from '../../platform/settings-store';
import { newtabZenMode } from '../../domain/settings/newtab-page';
import type { SearchQuery } from '../../shared/search-panel/search-query';
import type { SearchAutocomplete } from '../../shared/search-panel/autocomplete';
import type { SearchMode } from '../../shared/search-panel/search-mode';
import type { SearchResults } from '../../shared/search-panel/search-results';
import { isAggregateSearchProvider } from '../../domain/search/aggregate-search-store';
import { getLocalSearchScopeTabHintProvider, getSiteSearchActionTitle } from '../../shared/search-panel/labels';
import type { SearchLocale } from '../../shared/search-panel/labels';
import { getInlineSiteSearchCandidate } from '../../domain/search/utils/site-search-matching';
import { getKeywordSearchSuggestionState } from '../../domain/search/utils/engine-suggestions';
import type { SearchMatching } from '../../shared/search-panel/matching';
import type { SearchModeActions } from '../../shared/search-panel/mode-actions';
import type { SiteSearchRunner } from '../../shared/search-panel/site-search/runner';
import type { SuggestionSource } from '../../shared/search-panel/suggestion-source';
import * as SUGGESTION_ACTION_MODEL from '../../domain/search/suggestion-action-model';
import * as SUGGESTION_NAVIGATION from '../../shared/search/suggestion-navigation';
import * as NEWTAB_DIRECT_NAVIGATION_SETTLE from './direct-navigation-settle';
import type { ResultActivation } from '../../shared/search-panel/result-activation';
import { HelpCenterRows } from '../../shared/search-panel/help-center-rows';
import type { SurfaceLocale } from '../../shared/i18n/surface-locale';
import type { QuickNavigation } from '../../shared/search-panel/quick-navigation';
import { loadShortcutRules } from '../../shared/search-panel/shortcut-rules';
import * as SearchDirectNavigation from '../../domain/search/utils/direct-navigation';
import type { SearchBoxParts } from './search-box-parts';
import type { OpenTabs } from '../../shared/search-panel/open-tabs';
import type { AppliedThemeMode } from '../theme/applied-theme-mode';
import type { WebAppearance } from './web-appearance';
import type { InputModeProvider } from '../../shared/search/input-mode/types';
import type { PageNavigation } from '../page-navigation';


interface SuggestionsControllerDeps {
  suggestionSource: SuggestionSource;
  siteSearchRunner: SiteSearchRunner;
  modeActions: SearchModeActions<SiteSearchProvider>;
  searchMatching: SearchMatching;
  locale: SearchLocale & Pick<SurfaceLocale, 'store'>;
  searchResults: SearchResults<Suggestion>;
  searchMode: SearchMode<SiteSearchProvider>;
  searchAutocomplete: SearchAutocomplete;
  searchQuery: SearchQuery;
  settings: Pick<SettingsStore, 'get' | 'set' | 'subscribe'>;
  siteSearchCatalog: SiteSearchCatalog;
  searchEngine: DefaultSearchEngine;
  getPageFaviconCandidateUrl(pageUrl: string): string;
  setVisibleThemeMode: AppearanceModes['setVisibleThemeMode'];
  webAppearance: Pick<WebAppearance, 'set'>;
  shouldSwitchMatchedTabSuggestion: SearchNavigation['shouldSwitchMatchedTabSuggestion'];
  resultActivation: ResultActivation;
  navigateToQuery: PageNavigation['navigateToQuery'];
  suggestionsContainer: HTMLElement;
  suggestionItems: SuggestionElement[];
  refreshTabsForSearchContext: SearchNavigation['refreshTabsForSearchContext'];
  isSlashCommandInput(query: string): boolean;
  isModeCommand(query: string): boolean;
  isZenCommand(query: string): boolean;
  // The theme mode the page follows: its own, or the global one.
  getScopedThemeMode: AppearanceModes['getScopedThemeMode'];
  applyThemeMode: AppearanceModes['applyThemeMode'];
  getCommandMatches(rawInput: string): SlashCommand[];
  buildModeSuggestion(): Suggestion;
  buildZenSuggestion(): Suggestion;
  buildCommandSuggestion(command: SlashCommand): Suggestion;
  getDirectUrlSuggestion: SearchNavigation['getDirectUrlSuggestion'];
  quickNavigation: Pick<QuickNavigation, 'keywordRows'>;
  getProviderIcon: SiteSearchProviders['getProviderIcon'];
  formatMessage: FormatMessage;
  getMatchedOpenTabIdForSuggestion: SearchNavigation['getMatchedOpenTabIdForSuggestion'];
  // The suggestions the search blacklist does not leave out.
  filterBlacklistedSuggestions(list: Suggestion[], query: string): Suggestion[];
  getUrlDisplay(url: string | undefined): string;
  // The rows the list shows; `uncapped` keeps every command.
  limitSuggestionsForDisplay(list: Suggestion[], options: { uncapped: boolean }): Suggestion[];
  t: Translate;
  warmIconCache(list: Suggestion[]): void;
  setSuggestionsVisible(visible: boolean): void;
  openCommunityQrDialog?(url: string | undefined): void;
  searchBox: Pick<SearchBoxParts, 'focusInput' | 'inputParts' | 'modeController' | 'suggestionsView'>;
  openTabs: Pick<OpenTabs, 'clear' | 'currentTabId' | 'tabs'>;
  appliedTheme: Pick<AppliedThemeMode, 'mode'>;
}

// A request that retries once when nothing answers in time.
interface SuggestionRequestOptions extends RequestSuggestionsOptions {
  retryCount?: number;
}

// The request a settle wait was started for.
interface SettleContext {
  query: string;
  requestSeq: number;
}

function isSiteSearchProvider(provider: SuggestionProvider | null | undefined): provider is SiteSearchProvider {
  return Boolean(provider) && typeof provider?.key === 'string';
}

function createSuggestionsController(deps: SuggestionsControllerDeps) {
  const {
    appliedTheme,
    searchBox,
    suggestionSource,
    siteSearchRunner,
    modeActions,
    searchMatching,
    locale,
    searchResults,
    searchMode,
    searchAutocomplete,
    searchQuery,
    settings,
    siteSearchCatalog,
    searchEngine,
    getPageFaviconCandidateUrl,
    setVisibleThemeMode,
    webAppearance,
    shouldSwitchMatchedTabSuggestion,
    resultActivation,
    navigateToQuery,
    suggestionsContainer,
    suggestionItems,
    refreshTabsForSearchContext,
    isSlashCommandInput,
    isModeCommand,
    isZenCommand,
    getScopedThemeMode,
    applyThemeMode,
    getCommandMatches,
    buildModeSuggestion,
    buildZenSuggestion,
    buildCommandSuggestion,
    getDirectUrlSuggestion,
    quickNavigation,
    getProviderIcon,
    formatMessage,
    getMatchedOpenTabIdForSuggestion,
    filterBlacklistedSuggestions,
    getUrlDisplay,
    limitSuggestionsForDisplay,
    t,
    warmIconCache,
    setSuggestionsVisible,
    openCommunityQrDialog,
    openTabs
  } = deps;


  let lastRenderedActionContextKey = '';
  // Hidden from the background; the input's focus or typing shows them again.
  let searchSuggestionsDismissed = false;

  // Lumno Help Center search lists the matching help pages under its search row.
  const helpCenterRows = new HelpCenterRows(locale, searchQuery, (query) => {
    renderSuggestions(searchResults.lastResponse, query);
  });
  let pendingProviderReload = false;



  function setSiteSearchTabHint(provider: InputModeProvider | null): void {
    if (searchBox.modeController) {
      searchBox.modeController.setTabHintVisible(true, provider);
    }
  }

  function clearSiteSearchTabHint(): void {
    if (searchBox.modeController) {
      searchBox.modeController.setTabHintVisible(false);
    }
  }

  function getAutoHighlightIndex(): number {
    return searchBox.suggestionsView ? searchBox.suggestionsView.getAutoHighlightIndex() : -1;
  }

  function getSuggestionUpdateKind(options: Parameters<typeof SuggestionActionModel.getSuggestionUpdateKind>[0]) {
    return SUGGESTION_ACTION_MODEL.getSuggestionUpdateKind({
      ...(options || {}),
      includeDebugReasons: Boolean(settings.get(tabRankScoreDebug))
    });
  }

  function getSuggestionActionContextKey(options: Parameters<typeof SuggestionActionModel.getActionContextKey>[0]): string {
    return SUGGESTION_ACTION_MODEL.getActionContextKey(options);
  }

  function activateRenderedSuggestion(
    suggestion: Suggestion,
    query: string,
    event: MouseEvent,
    index: number,
    item: SuggestionElement
  ): void {
    if (suggestion.type === 'commandNewTab') {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'openNewTab' });
      return;
    }
    if (suggestion.type === 'commandSettings') {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'openOptionsPage' });
      return;
    }
    if (suggestion.type === 'siteSearchPrompt' && isSiteSearchProvider(suggestion.provider)) {
      modeActions.activateSiteSearch(suggestion.provider);
      searchBox.focusInput();
      return;
    }
    if (suggestion.type === 'helpFeedback' && suggestion.feedbackKey === 'community' &&
        openCommunityQrDialog) {
      openCommunityQrDialog(suggestion.url);
      return;
    }
    if (suggestion.type === 'modeSwitch') {
      setVisibleThemeMode(suggestion.nextMode);
      searchBox.focusInput();
      return;
    }
    if (suggestion.type === 'zenSwitch') {
      void settings.set(newtabZenMode, newtabZenMode.parse(suggestion.nextEnabled));
      searchBox.focusInput();
      return;
    }
    if (suggestion.type === 'webAppearanceSwitch') {
      webAppearance.set(suggestion.nextMode);
      searchBox.focusInput();
      return;
    }
    if (Number.isInteger(index) && shouldSwitchMatchedTabSuggestion(suggestion)) {
      resultActivation.openMatchedTab(suggestion, event, item, query);
      return;
    }
    if (isSiteSearchProvider(suggestion.provider) && suggestion.searchQuery) {
      siteSearchRunner.run(
        suggestion.provider,
        suggestion.searchQuery,
        resultActivation.getDisposition(event)
      );
      return;
    }
    if (resultActivation.opensInBackground(event) && suggestion.url) {
      resultActivation.openUrl(suggestion, query, event);
      return;
    }
    if (suggestion.forceSearch && suggestion.searchQuery) {
      navigateToQuery(suggestion.searchQuery, true, resultActivation.getDisposition(event));
      return;
    }
    resultActivation.openUrl(suggestion, query, event);
  }

  function deleteRenderedHistorySuggestion(suggestion: Suggestion): void {
    if (!suggestion.url) {
      return;
    }
    LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
      action: 'deleteHistoryUrl',
      url: suggestion.url
    }, function(response) {
      if (chrome.runtime && chrome.runtime.lastError) {
        return;
      }
      if (!response || response.ok !== true) {
        return;
      }
      const refreshQuery = searchQuery.text || (searchBox.inputParts ? String(searchBox.inputParts.input.value || '').trim() : '');
      if (!refreshQuery) {
        clearSearchSuggestions();
        return;
      }
      requestSuggestions(refreshQuery, { immediate: true });
    });
  }

  function scrollSelectedSuggestionIntoView(direction: 'up' | 'down', didWrap: boolean): void {
    if (!suggestionsContainer || searchResults.selectedIndex < 0) {
      return;
    }
    const item = suggestionItems[searchResults.selectedIndex];
    SUGGESTION_NAVIGATION.scrollItemIntoView(suggestionsContainer, item, {
      direction,
      didWrap,
      inset: 8
    });
  }

  function requestTabsAndRender(): void {
    openTabs.clear();
    clearSearchSuggestions();
  }

  // The open tabs list shows its ranking reasons while the debug flag is on.
  settings.subscribe(tabRankScoreDebug, () => {
    if (!searchQuery.text || !searchQuery.text.trim()) {
      requestTabsAndRender();
    }
  });

  function refreshTabsIfIdle(): void {
    if (!searchQuery.text || !searchQuery.text.trim()) {
      refreshTabsForSearchContext(() => {});
      clearSearchSuggestions();
    }
  }

  function clearSearchSuggestions(): void {
    directNavigationSettleController.cancel();
    releaseSuggestionsHeight(suggestionsContainer, window);
    searchMode.clearHints();
    clearSiteSearchTabHint();
    if (searchBox.suggestionsView) {
      searchBox.suggestionsView.clear();
    }
    searchResults.show([]);
    searchResults.setLastResponse([]);
    searchResults.select(-1);
    lastRenderedActionContextKey = '';
  }

  function dismissSearchSuggestionsFromBackground(): void {
    searchAutocomplete.restoreTyped();
    searchSuggestionsDismissed = true;
    suggestionSource.cancel();
    clearSearchSuggestions();
  }

  function forgetSuggestionsDismissal(): void {
    searchSuggestionsDismissed = false;
  }

  function restoreDismissedSearchSuggestions(): boolean {
    if (!searchSuggestionsDismissed || !searchBox.inputParts) {
      return false;
    }
    const rawValue = String(searchBox.inputParts.input.value || '');
    const query = rawValue.trim();
    searchSuggestionsDismissed = false;
    if (!query) {
      return false;
    }
    searchQuery.set(rawValue, query);
    if (!searchMode.local && isSlashCommandInput(query)) {
      renderSuggestions([], query);
      return true;
    }
    requestSuggestions(query, { immediate: true });
    return true;
  }

  function renderSuggestions(
    suggestions: Suggestion[],
    query: string,
    options?: { pendingRemote?: boolean }
  ): Promise<void> | undefined {
    if (searchSuggestionsDismissed) {
      return undefined;
    }
    if (!query) {
      clearSearchSuggestions();
      return undefined;
    }
    searchResults.setLastResponse(suggestions);

    return loadShortcutRules().then((rules) => {
      const view = searchBox.suggestionsView;
      if (searchSuggestionsDismissed || query !== searchQuery.text || !view) {
        return;
      }
      const inputValue = searchBox.inputParts ? searchBox.inputParts.input.value : '';
      const rawTagInput = (searchQuery.raw || inputValue || '').trim();
      const localSearchQueryModeActive = Boolean(searchMode.local && String(query || '').trim());
      const slashCommandModeActive = !localSearchQueryModeActive && isSlashCommandInput(rawTagInput);
      const siteSearchQueryModeActive = !localSearchQueryModeActive &&
        !slashCommandModeActive &&
        Boolean(searchMode.site && String(query || '').trim());
      const modeCommandActive = slashCommandModeActive && !siteSearchQueryModeActive && isModeCommand(rawTagInput);
      const zenCommandActive = slashCommandModeActive && !siteSearchQueryModeActive && isZenCommand(rawTagInput);
      const toggleCommandActive = modeCommandActive || zenCommandActive;
      if (modeCommandActive) {
        // The command shows the stored theme, which another page may have changed.
        const storedMode = getScopedThemeMode();
        if (storedMode !== appliedTheme.mode) {
          applyThemeMode(storedMode);
        }
      }
      const commandMatches = (slashCommandModeActive && !toggleCommandActive && !siteSearchQueryModeActive)
        ? getCommandMatches(rawTagInput)
        : [];
      const hasCommand = commandMatches.length > 0;
      const preSuggestions: Suggestion[] = [];
      if (modeCommandActive) {
        preSuggestions.push(buildModeSuggestion());
      } else if (zenCommandActive) {
        preSuggestions.push(buildZenSuggestion());
      } else if (slashCommandModeActive && !siteSearchQueryModeActive) {
        commandMatches.forEach((command) => {
          preSuggestions.push(buildCommandSuggestion(command));
        });
      } else if (!siteSearchQueryModeActive && !localSearchQueryModeActive) {
        const directUrlSuggestion = getDirectUrlSuggestion(query);
        if (directUrlSuggestion) {
          preSuggestions.push(directUrlSuggestion);
        }
        const keywordSuggestions = quickNavigation.keywordRows(query, rules);
        preSuggestions.push(...keywordSuggestions);
      }

      const providersForTags = siteSearchCatalog.triggerProviders;
      if (!siteSearchCatalog.loadedProviders && !pendingProviderReload) {
        pendingProviderReload = true;
        void siteSearchCatalog.loadProviders().then(() => {
          pendingProviderReload = false;
          if (query !== searchQuery.text) {
            return;
          }
          renderSuggestions(searchResults.lastResponse, query);
        });
      }
      const inlineCandidate = (!localSearchQueryModeActive && !slashCommandModeActive &&
          !siteSearchQueryModeActive && !toggleCommandActive && !hasCommand)
        ? getInlineSiteSearchCandidate(rawTagInput, providersForTags)
        : null;
      let inlineSuggestion: Suggestion | null = null;
      if (inlineCandidate) {
        const inlineUrl = siteSearchRunner.buildSearchUrl(
          inlineCandidate.provider.template,
          inlineCandidate.query,
          inlineCandidate.provider
        );
        if (inlineUrl) {
          inlineSuggestion = {
            type: 'inlineSiteSearch',
            title: getSiteSearchActionTitle(locale, inlineCandidate.provider),
            url: inlineUrl,
            favicon: getProviderIcon(inlineCandidate.provider),
            provider: inlineCandidate.provider,
            searchQuery: inlineCandidate.query
          };
        }
      }

      const newTabSuggestion: Suggestion | null = (localSearchQueryModeActive || slashCommandModeActive ||
          toggleCommandActive || siteSearchQueryModeActive)
        ? null
        : {
          type: 'newtab',
          title: settings.get(simpleModeEnabled)
            ? query
            : formatMessage('search_query', '搜索 "{query}"', {
                query: query
              }),
          url: searchEngine.searchUrl(query),
          favicon: getPageFaviconCandidateUrl(searchEngine.themeUrl()),
          searchQuery: query,
          forceSearch: true
        };
      // Narrowed here, for the site search rows below.
      const siteSearchProvider = searchMode.site;
      const siteSearchSuggestion: Suggestion | null = siteSearchQueryModeActive && siteSearchProvider
        ? (() => {
            const aggregateSearch = isAggregateSearchProvider(siteSearchProvider);
            const siteUrl = aggregateSearch
              ? ''
              : siteSearchRunner.buildSearchUrl(siteSearchProvider.template, query, siteSearchProvider);
            if (!aggregateSearch && !siteUrl) {
              return null;
            }
            return {
              type: 'siteSearch',
              title: getSiteSearchActionTitle(locale, siteSearchProvider, query),
              url: siteUrl,
              favicon: aggregateSearch ? '' : getProviderIcon(siteSearchProvider),
              provider: siteSearchProvider,
              searchQuery: query
            };
          })()
        : null;

      const helpCenterSuggestions: Suggestion[] = siteSearchQueryModeActive && siteSearchProvider
        ? helpCenterRows.getRows(query, siteSearchProvider, getProviderIcon(siteSearchProvider))
        : [];

      const defaultSuggestions = [
        ...preSuggestions,
        newTabSuggestion,
        ...suggestions
      ].filter((item): item is Suggestion => Boolean(item));
      let groupedDefaultSuggestions = defaultSuggestions;
      if (settings.get(searchResultPriority) !== 'search') {
        groupedDefaultSuggestions = SearchEngineSuggestions.groupSearchSuggestionsByKind(defaultSuggestions, {
          searchFirst: false
        });
      }

      let allSuggestions = localSearchQueryModeActive
        ? suggestions.filter((item) => (
          item &&
          searchMode.local &&
          item.type === searchMode.local.sourceType
        ))
        : (slashCommandModeActive ? [...preSuggestions] : (siteSearchQueryModeActive
          ? (siteSearchSuggestion ? [siteSearchSuggestion, ...helpCenterSuggestions] : [])
          : (toggleCommandActive ? [...preSuggestions] : groupedDefaultSuggestions)));
      allSuggestions.forEach((item) => {
        if (!item || !item.url) {
          return;
        }
        const matchedTabId = getMatchedOpenTabIdForSuggestion(item);
        if (typeof matchedTabId === 'number') {
          item._xMatchedTabId = matchedTabId;
          return;
        }
        if (Object.prototype.hasOwnProperty.call(item, '_xMatchedTabId')) {
          delete item._xMatchedTabId;
        }
      });
      allSuggestions = filterBlacklistedSuggestions(allSuggestions, query);
      const hasDirectUrlSuggestion = preSuggestions.some((suggestion) => (
        suggestion && suggestion.type === 'directUrl'
      ));
      if (settings.get(searchResultPriority) === 'search' &&
          !localSearchQueryModeActive &&
          !slashCommandModeActive &&
          !toggleCommandActive &&
          !siteSearchQueryModeActive &&
          !hasDirectUrlSuggestion) {
        allSuggestions = SearchSuggestionSlate.composeSearchFirstSuggestionSlate(allSuggestions, {
          limit: settings.get(searchResultDisplayLimit),
          query
        });
      }

      const keywordSuggestionState = getKeywordSearchSuggestionState(allSuggestions);
      const onlyKeywordSuggestions = keywordSuggestionState.onlyKeywordSuggestions;

      let primaryHighlightIndex = -1;
      let primaryHighlightReason = 'none';
      let mergedProvider: SuggestionProvider | null = null;
      let primarySuggestion: Suggestion | null = null;
      if (!localSearchQueryModeActive && !slashCommandModeActive && !toggleCommandActive && !hasCommand) {
        const rankedSlate = SearchSuggestionSlate.rankSearchSuggestionSlate(allSuggestions, {
          query,
          rawQuery: searchQuery.raw,
          triggerInput: rawTagInput,
          providers: providersForTags,
          inlineSuggestion,
          siteSearchActive: Boolean(searchMode.site),
          preferAutocompleteFirst: settings.get(searchResultPriority) !== 'search',
          onlyKeywordSuggestions,
          autocompleteSuggestions: keywordSuggestionState.autocompleteSuggestions,
          openTabMatch: settings.get(overlayTabPriority)
            ? {
                ...(openTabs.currentTabId === null ? {} : { currentTabId: openTabs.currentTabId }),
                openTabQuickSwitchEnabled: settings.get(overlayTabPriority),
                getDirectNavigationUrl: SearchDirectNavigation.getDirectNavigationUrl
              }
            : null,
          matchers: {
            promoteStrongNavigationMatch: searchMatching.promoteStrongNavigationMatch,
            promoteTopSiteMatch: searchMatching.promoteTopSiteMatch,
            getSiteSearchTriggerCandidate: searchMatching.getSiteSearchTriggerCandidate,
            getAutocompleteCandidate: (list, rawQuery) => searchAutocomplete.getCandidate(list, rawQuery),
            getUrlDisplay,
            filterSuggestions: (list) => filterBlacklistedSuggestions(list, query)
          }
        });
        allSuggestions = rankedSlate.suggestions;
        primaryHighlightIndex = rankedSlate.primaryHighlightIndex;
        primaryHighlightReason = rankedSlate.primaryHighlightReason;
        primarySuggestion = rankedSlate.primarySuggestion;
        mergedProvider = rankedSlate.mergedProvider;
        const siteSearchTrigger = rankedSlate.siteSearchTrigger;
        if (onlyKeywordSuggestions) {
          searchAutocomplete.clear();
        } else {
          searchAutocomplete.apply(allSuggestions, primarySuggestion, primaryHighlightReason);
        }
        const inlineAutoHighlight = Boolean(inlineSuggestion && primaryHighlightIndex === 0);
        const resolvedProvider = siteSearchTrigger;
        const resolvedLocalScope = !resolvedProvider
          ? searchMatching.getLocalSearchScopeCandidate(rawTagInput, rules)
          : null;
        searchMode.setHints(
          inlineSuggestion
            ? {
                url: inlineSuggestion.url,
                provider: isSiteSearchProvider(inlineSuggestion.provider) ? inlineSuggestion.provider : null,
                query: inlineSuggestion.searchQuery || '',
                rawInput: rawTagInput,
                isAuto: inlineAutoHighlight
              }
            : null,
          resolvedProvider ? { provider: resolvedProvider, rawInput: rawTagInput } : null,
          resolvedLocalScope ? { scope: resolvedLocalScope, rawInput: rawTagInput } : null
        );
        if (resolvedProvider) {
          setSiteSearchTabHint(resolvedProvider);
        } else if (resolvedLocalScope) {
          setSiteSearchTabHint(getLocalSearchScopeTabHintProvider(locale, resolvedLocalScope));
        } else {
          clearSiteSearchTabHint();
        }
      } else if (localSearchQueryModeActive) {
        searchAutocomplete.clear();
        searchMode.clearHints();
        clearSiteSearchTabHint();
        if (allSuggestions.length > 0) {
          primaryHighlightIndex = 0;
          primaryHighlightReason = 'localScope';
          primarySuggestion = allSuggestions[0];
        }
      } else if (modeCommandActive) {
        searchAutocomplete.clear();
        searchMode.clearHints();
        clearSiteSearchTabHint();
        primaryHighlightIndex = 0;
        primaryHighlightReason = 'modeSwitch';
      } else if (zenCommandActive) {
        searchAutocomplete.clear();
        searchMode.clearHints();
        clearSiteSearchTabHint();
        primaryHighlightIndex = 0;
        primaryHighlightReason = 'zenSwitch';
      } else if (slashCommandModeActive) {
        searchAutocomplete.clear();
        searchMode.clearHints();
        clearSiteSearchTabHint();
        primaryHighlightIndex = 0;
        primaryHighlightReason = 'command';
      }
      if (hasCommand) {
        searchAutocomplete.apply(allSuggestions, primarySuggestion, primaryHighlightReason);
      }
      allSuggestions = limitSuggestionsForDisplay(allSuggestions, {
        uncapped: slashCommandModeActive
      });
      const emptyMessage = slashCommandModeActive && allSuggestions.length === 0
        ? t('slash_command_empty', '无匹配命令')
        : (localSearchQueryModeActive && allSuggestions.length === 0
          ? t('overlay_empty_result', '无匹配结果')
          : '');

      const actionContextKey = getSuggestionActionContextKey({
        primaryHighlightIndex,
        primaryHighlightReason,
        onlyKeywordSuggestions,
        primarySuggestion,
        mergedProvider
      });
      const updateKind = getSuggestionUpdateKind({
        actionContextKey,
        lastRenderedActionContextKey,
        currentSuggestions: searchResults.rows,
        allSuggestions
      });
      const canAppend = updateKind === 'append';
      const startIndex = canAppend ? searchResults.rows.length : 0;

      searchResults.show(allSuggestions);
      lastRenderedActionContextKey = actionContextKey;
      if (updateKind !== 'highlight') {
        warmIconCache(allSuggestions.filter((item) => (
          item && item.type !== 'directUrl'
        )));
      }
      view.render({
        suggestions: allSuggestions,
        query,
        updateKind,
        canAppend,
        startIndex,
        primaryHighlightIndex,
        primarySuggestion,
        primaryHighlightReason,
        onlyKeywordSuggestions,
        mergedProvider,
        emptyMessage,
        emptyArt: slashCommandModeActive ? 'noCommands' : 'noResults'
      });
      // Any answer but rows shown while suggestions are pending lets the
      // list take its own height, and the frame follows it.
      const heightReleased = !(options && options.pendingRemote) &&
        releaseSuggestionsHeight(suggestionsContainer, window);
      if (updateKind !== 'highlight' || heightReleased) {
        setSuggestionsVisible(true);
      }
    });
  }

  function renderPendingSuggestions(query: string): void {
    void renderSuggestions(searchResults.lastResponse, query);
  }

  // Shows results saved before a reload exactly as they were. Replies to
  // requests made before this are dropped, so they cannot replace them.
  // Resolves once the results are rendered.
  function showSuggestionSnapshot(suggestions: Suggestion[], query: string, selectedIndex: number): Promise<void> {
    suggestionSource.cancel();
    directNavigationSettleController.cancel();
    searchQuery.setText(query);
    searchResults.select(selectedIndex);
    return Promise.resolve(renderSuggestions(suggestions, query));
  }

  const DIRECT_NAVIGATION_SETTLE_DELAY_MS = 120;
  const directNavigationSettleController =
    NEWTAB_DIRECT_NAVIGATION_SETTLE.createDirectNavigationSettleController<SettleContext>({
      delayMs: DIRECT_NAVIGATION_SETTLE_DELAY_MS,
      onSettle: ({ query, requestSeq }) => {
        if (!searchResults.isCurrentRequest(requestSeq) || query !== searchQuery.text) {
          return;
        }
        renderPendingSuggestions(query);
      }
    });

  function requestSuggestions(query: string, options?: SuggestionRequestOptions): void {
    searchQuery.setText(query);
    const requestLocalSearchScope = searchMode.local;
    if (!requestLocalSearchScope && isSlashCommandInput(query)) {
      void renderSuggestions([], query);
      return;
    }
    const immediate = options && options.immediate;
    const deferInitialDirectNavigationRender = Boolean(
      options && options.deferInitialDirectNavigationRender
    );
    const retryCount = options && Number(options.retryCount) > 0 ? Number(options.retryCount) : 0;
    const requestStartedAt = Date.now();
    const requestQuery = searchQuery.text;
    const requestSearchFirst = settings.get(searchResultPriority) === 'search';
    const showExactSearchPendingState = requestSearchFirst &&
      !requestLocalSearchScope &&
      !searchMode.site &&
      !getDirectUrlSuggestion(requestQuery);
    directNavigationSettleController.cancel();
    // A list of another query's results keeps its height until this
    // query's full answer.
    if (!requestLocalSearchScope && searchResults.rows.length > 0 && suggestionsContainer &&
        suggestionsContainer.getAttribute('data-visible') === 'true') {
      holdSuggestionsHeight(suggestionsContainer, window);
    }
    // Shown with the local results until this query's suggestions arrive.
    const carriedEngineSuggestions = SearchEngineSuggestions.carryOverEngineSuggestions(
      searchResults.lastEngineResponse,
      requestQuery
    );
    if (showExactSearchPendingState) {
      void renderSuggestions(carriedEngineSuggestions, requestQuery, { pendingRemote: true });
    }
    let localFailed = false;
    const requestSeq = suggestionSource.request({
      query: requestQuery,
      context: 'newtab',
      sourceTypes: requestLocalSearchScope ? [requestLocalSearchScope.sourceType] : undefined,
      searchFirst: requestSearchFirst,
      lateAfterMs: immediate ? 1200 : 1300
    }, {
      onLocal(rows) {
        directNavigationSettleController.cancel();
        const localSuggestions: Suggestion[] = rows;
        if (requestLocalSearchScope) {
          void renderSuggestions(localSuggestions, requestQuery);
          return null;
        }
        if (!showExactSearchPendingState) {
          void renderSuggestions([...localSuggestions, ...carriedEngineSuggestions], requestQuery, { pendingRemote: true });
        }
        refreshTabsForSearchContext(() => {});
        return (requestSearchFirst || immediate) ? 0 : Math.max(0, 120 - (Date.now() - requestStartedAt));
      },
      onLocalFailed() {
        localFailed = true;
        directNavigationSettleController.cancel();
        renderPendingSuggestions(requestQuery);
      },
      // A worker that has just woken may miss the first request.
      onLocalLate() {
        if (retryCount < 1) {
          requestSuggestions(requestQuery, { immediate: true, retryCount: retryCount + 1 });
          return;
        }
        renderPendingSuggestions(requestQuery);
      },
      onRemote(rows, localRows) {
        const answer: Suggestion[] = rows || localRows;
        void renderSuggestions(answer, requestQuery);
      }
    });
    if (deferInitialDirectNavigationRender && !localFailed) {
      directNavigationSettleController.schedule({
        query: requestQuery,
        requestSeq
      });
    }
  }


  // The rows read their labels in the page's language.
  locale.store.subscribe(() => {
    if (searchQuery.text && searchQuery.text.trim()) {
      void renderSuggestions(searchResults.lastResponse, searchQuery.text);
    }
  });
  return {
    getAutoHighlightIndex,
    activateRenderedSuggestion,
    deleteRenderedHistorySuggestion,
    scrollSelectedSuggestionIntoView,
    requestTabsAndRender,
    refreshTabsIfIdle,
    clearSearchSuggestions,
    dismissSearchSuggestionsFromBackground,
    restoreDismissedSearchSuggestions,
    forgetSuggestionsDismissal,
    renderSuggestions,
    renderPendingSuggestions,
    showSuggestionSnapshot,
    directNavigationSettleController,
    requestSuggestions
  };
}

type SuggestionsController = ReturnType<typeof createSuggestionsController>;

export { createSuggestionsController };
export type { SuggestionsController, SuggestionsControllerDeps };
