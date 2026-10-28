// Requesting, rendering and activating search suggestions.
import type { OverlayTab, ShortcutRule } from '../../domain/messages';
import type * as SuggestionActionModel from '../../domain/search/suggestion-action-model';
import type { SiteSearchProvider } from '../../domain/search/types';
import type { ThemeMode } from '../../domain/settings';
import type * as CommunityLinks from '../../platform/community-links';
import * as LumnoMessaging from '../../platform/messaging';
import type { SearchInputParts } from '../../shared/react/search-input';
import type {
  Suggestion,
  SuggestionElement,
  SuggestionProvider,
  SuggestionsViewController
} from '../../shared/react/search/suggestion-list/types';
import type * as SuggestionNavigation from '../../shared/search/suggestion-navigation';
import { holdSuggestionsHeight, releaseSuggestionsHeight } from '../../shared/search/suggestions-height-layout';
import type { AppearanceModes } from '../appearance-modes';
import type { ModeCommands } from '../mode-commands';
import type { FormatMessage, SendRuntimeMessage, Translate } from '../newtab-types';
import type * as DirectNavigationSettle from './direct-navigation-settle';
import type { SearchAutocomplete } from './search-autocomplete';
import type { SearchModeController } from './search-mode-controller';
import type { LocalScopeTrigger, SearchModes, SiteSearchTrigger } from './search-modes';
import type { SearchNavigation, SearchNavigationDeps } from './search-navigation';
import type {
  ActiveLocalScope,
  InlineSearchState,
  RequestSuggestionsOptions,
  SlashCommand
} from './search-types';
import type { SiteSearchProviders } from './site-search-providers';
import { createSuggestionSource } from '../../domain/search/help-center/search';
import * as SearchSiteSearchProviders from '../../domain/search/utils/site-search-providers';
import * as SearchEngineSuggestions from '../../domain/search/utils/engine-suggestions';
import * as SearchSuggestionSlate from '../../domain/search/utils/suggestion-slate';
import type { SiteSearchCatalog } from '../../shared/search-panel/site-search/catalog';
import type { DefaultSearchEngine } from '../../shared/search-panel/default-engine';
import { numberShortcutInstantEnabled, searchResultDisplayLimit, searchResultPriority, tabRankScoreDebug } from '../../domain/settings/search';
import { overlayTabPriority } from '../../domain/settings/overlay-panel';
import { simpleModeEnabled } from '../../domain/settings/appearance';
import type { SettingsStore } from '../../platform/settings-store';

interface SuggestionsControllerState {
  suggestionsView: SuggestionsViewController | null;
  selectedIndex: number;
  latestQuery: string;
  latestRawQuery: string;
  lastSuggestionResponse: Suggestion[];
  // The last answer that had the search engine's suggestions in it.
  lastEngineSuggestionResponse: Suggestion[];
  inputParts: SearchInputParts | null;
  tabs: OverlayTab[];
  inlineSearchState: InlineSearchState | null;
  siteSearchTriggerState: SiteSearchTrigger | null;
  localSearchScopeTriggerState: LocalScopeTrigger | null;
  currentSuggestions: Suggestion[];
  // Hidden from the background; the input's focus shows them again.
  searchSuggestionsDismissed: boolean;
  // Bumped by each request, so an older one's results are dropped.
  suggestionRequestSeq: number;
  remoteSuggestionDebounceTimer: ReturnType<typeof setTimeout> | null;
  suggestionRequestWatchdogTimer: ReturnType<typeof setTimeout> | null;
  localSearchScopeState: ActiveLocalScope | null;
  siteSearchState: SiteSearchProvider | null;
  currentThemeMode: ThemeMode;
  currentNewtabTabId: number | null;
}

interface SuggestionsControllerDeps {
  settings: Pick<SettingsStore, 'get'>;
  siteSearchCatalog: SiteSearchCatalog;
  searchEngine: DefaultSearchEngine;
  getPageFaviconCandidateUrl(pageUrl: string): string;
  SUGGESTION_ACTION_MODEL: Pick<typeof SuggestionActionModel, 'getSuggestionUpdateKind' | 'getActionContextKey'>;
  activateSiteSearch: SearchModes['activateSiteSearch'];
  focusSearchInputPreservingScroll(): boolean;
  setVisibleThemeMode: AppearanceModes['setVisibleThemeMode'];
  setZenModeEnabled: ModeCommands['setZenModeEnabled'];
  setWebAppearanceMode: ModeCommands['setWebAppearanceMode'];
  shouldSwitchMatchedTabSuggestion: SearchNavigation['shouldSwitchMatchedTabSuggestion'];
  openMatchedTabSuggestion: SearchNavigation['openMatchedTabSuggestion'];
  runSiteSearchProviderQuery: SiteSearchProviders['runSiteSearchProviderQuery'];
  shouldOpenSearchResultInBackgroundTab: SearchNavigation['shouldOpenSearchResultInBackgroundTab'];
  getSearchResultDisposition: SearchNavigation['getSearchResultDisposition'];
  openSearchResultUrl: SearchNavigation['openSearchResultUrl'];
  navigateToQuery: SearchNavigationDeps['navigateToQuery'];
  suggestionsContainer: HTMLElement | null;
  suggestionItems: SuggestionElement[];
  SUGGESTION_NAVIGATION: Pick<typeof SuggestionNavigation, 'scrollItemIntoView'>;
  refreshTabsForSearchContext: SearchNavigation['refreshTabsForSearchContext'];
  clearSiteSearchTabHint: SearchModeController['clearSiteSearchTabHint'];
  restoreUserAuthoredSearchInput: SearchAutocomplete['restoreUserAuthoredSearchInput'];
  isSlashCommandInput(query: string): boolean;
  getShortcutRules(): Promise<ShortcutRule[]>;
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
  buildKeywordSuggestions: SearchNavigation['buildKeywordSuggestions'];
  getInlineSiteSearchCandidate: SiteSearchProviders['getInlineSiteSearchCandidate'];
  buildSearchUrl: SiteSearchProviders['buildSearchUrl'];
  getSiteSearchActionTitle: SiteSearchProviders['getSiteSearchActionTitle'];
  getProviderIcon: SiteSearchProviders['getProviderIcon'];
  formatMessage: FormatMessage;
  isAggregateSearchProvider: SiteSearchProviders['isAggregateSearchProvider'];
  getMatchedOpenTabIdForSuggestion: SearchNavigation['getMatchedOpenTabIdForSuggestion'];
  // The suggestions the search blacklist does not leave out.
  filterBlacklistedSuggestions(list: Suggestion[], query: string): Suggestion[];
  getKeywordSearchSuggestionState: SiteSearchProviders['getKeywordSearchSuggestionState'];
  promoteStrongNavigationMatch: SiteSearchProviders['promoteStrongNavigationMatch'];
  promoteTopSiteMatch: SiteSearchProviders['promoteTopSiteMatch'];
  getSiteSearchTriggerCandidate: SiteSearchProviders['getSiteSearchTriggerCandidate'];
  getAutocompleteCandidate: SearchAutocomplete['getAutocompleteCandidate'];
  getUrlDisplay(url: string | undefined): string;
  getDirectNavigationUrl: SearchNavigation['getDirectNavigationUrl'];
  clearAutocomplete: SearchAutocomplete['clearAutocomplete'];
  applyAutocomplete: SearchAutocomplete['applyAutocomplete'];
  getLocalSearchScopeCandidate: SiteSearchProviders['getLocalSearchScopeCandidate'];
  setSiteSearchTabHint: SearchModeController['setSiteSearchTabHint'];
  getLocalSearchScopeTabHintProvider: SearchModes['getLocalSearchScopeTabHintProvider'];
  // The rows the list shows; `uncapped` keeps every command.
  limitSuggestionsForDisplay(list: Suggestion[], options: { uncapped: boolean }): Suggestion[];
  t: Translate;
  warmIconCache(list: Suggestion[]): void;
  setSuggestionsVisible(visible: boolean): void;
  NEWTAB_DIRECT_NAVIGATION_SETTLE: Pick<typeof DirectNavigationSettle, 'createDirectNavigationSettleController'>;
  sendRuntimeMessage: SendRuntimeMessage;
  COMMUNITY_LINKS: Pick<typeof CommunityLinks, 'load' | 'getLinks' | 'getCommunityChannel'> | null;
  openCommunityQrDialog?(url: string | undefined): void;
  getHelpCenterLocale(): string;
  pageState: SuggestionsControllerState;
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
    settings,
    siteSearchCatalog,
    searchEngine,
    getPageFaviconCandidateUrl,
    SUGGESTION_ACTION_MODEL,
    activateSiteSearch,
    focusSearchInputPreservingScroll,
    setVisibleThemeMode,
    setZenModeEnabled,
    setWebAppearanceMode,
    shouldSwitchMatchedTabSuggestion,
    openMatchedTabSuggestion,
    runSiteSearchProviderQuery,
    shouldOpenSearchResultInBackgroundTab,
    getSearchResultDisposition,
    openSearchResultUrl,
    navigateToQuery,
    suggestionsContainer,
    suggestionItems,
    SUGGESTION_NAVIGATION,
    refreshTabsForSearchContext,
    clearSiteSearchTabHint,
    restoreUserAuthoredSearchInput,
    isSlashCommandInput,
    getShortcutRules,
    isModeCommand,
    isZenCommand,
    getScopedThemeMode,
    applyThemeMode,
    getCommandMatches,
    buildModeSuggestion,
    buildZenSuggestion,
    buildCommandSuggestion,
    getDirectUrlSuggestion,
    buildKeywordSuggestions,
    getInlineSiteSearchCandidate,
    buildSearchUrl,
    getSiteSearchActionTitle,
    getProviderIcon,
    formatMessage,
    isAggregateSearchProvider,
    getMatchedOpenTabIdForSuggestion,
    filterBlacklistedSuggestions,
    getKeywordSearchSuggestionState,
    promoteStrongNavigationMatch,
    promoteTopSiteMatch,
    getSiteSearchTriggerCandidate,
    getAutocompleteCandidate,
    getUrlDisplay,
    getDirectNavigationUrl,
    clearAutocomplete,
    applyAutocomplete,
    getLocalSearchScopeCandidate,
    setSiteSearchTabHint,
    getLocalSearchScopeTabHintProvider,
    limitSuggestionsForDisplay,
    t,
    warmIconCache,
    setSuggestionsVisible,
    NEWTAB_DIRECT_NAVIGATION_SETTLE,
    sendRuntimeMessage,
    COMMUNITY_LINKS,
    openCommunityQrDialog,
    getHelpCenterLocale
  } = deps;

  // Page state still owned by newtab.js; read and written through accessors.
  const pageState = deps.pageState;

  let lastRenderedActionContextKey = '';
  let helpCenterFeedbackLinksRequested = false;

  // Where to ask when the help center has nothing; community links are fetched fresh once.
  function getHelpCenterFeedback(query: string) {
    if (!COMMUNITY_LINKS) {
      return null;
    }
    if (!helpCenterFeedbackLinksRequested) {
      helpCenterFeedbackLinksRequested = true;
      void COMMUNITY_LINKS.load().then(() => {
        if (query === pageState.latestQuery) {
          renderSuggestions(pageState.lastSuggestionResponse, query);
        }
      });
    }
    const links = COMMUNITY_LINKS.getLinks();
    return {
      links,
      channel: COMMUNITY_LINKS.getCommunityChannel(links, getHelpCenterLocale()),
      t
    };
  }

  // Lumno Help Center search lists the matching help pages under its search row.
  const helpCenterSuggestionSource = createSuggestionSource({
    sendMessage: (message, callback) => sendRuntimeMessage<'getHelpCenterSearchResults'>(message, (response) => {
      callback(chrome.runtime && chrome.runtime.lastError ? undefined : response);
    }),
    onUpdate: (query) => {
      if (query === pageState.latestQuery) {
        renderSuggestions(pageState.lastSuggestionResponse, query);
      }
    }
  });
  let pendingProviderReload = false;
  let openInCurrentTabModifierActive = false;
  let openSwitchInNewTabModifierActive = false;
  let openInBackgroundTabModifierActive = false;

  function setSuggestionActionModifiersActive(
    openInCurrentTabActive: boolean,
    openSwitchInNewTabActive: boolean,
    openInBackgroundTabActive: boolean
  ): void {
    const nextOpenInCurrentTabActive = Boolean(openInCurrentTabActive);
    const nextOpenSwitchInNewTabActive = Boolean(openSwitchInNewTabActive);
    const nextOpenInBackgroundTabActive = Boolean(openInBackgroundTabActive);
    if (openInCurrentTabModifierActive === nextOpenInCurrentTabActive &&
        openSwitchInNewTabModifierActive === nextOpenSwitchInNewTabActive &&
        openInBackgroundTabModifierActive === nextOpenInBackgroundTabActive) {
      return;
    }
    openInCurrentTabModifierActive = nextOpenInCurrentTabActive;
    openSwitchInNewTabModifierActive = nextOpenSwitchInNewTabActive;
    openInBackgroundTabModifierActive = nextOpenInBackgroundTabActive;
    const view = pageState.suggestionsView;
    if (view) {
      view.setOpenInCurrentTabModifierActive(nextOpenInCurrentTabActive);
      view.setOpenSwitchInNewTabModifierActive(nextOpenSwitchInNewTabActive);
      view.setOpenInBackgroundTabModifierActive(nextOpenInBackgroundTabActive);
    }
  }

  function syncSuggestionActionModifiersFromEvent(event: Pick<KeyboardEvent, 'altKey' | 'shiftKey' | 'metaKey' | 'ctrlKey'> | null): void {
    setSuggestionActionModifiersActive(
      Boolean(event && event.altKey),
      Boolean(event && event.shiftKey),
      Boolean(event && (event.metaKey || event.ctrlKey) && !settings.get(numberShortcutInstantEnabled))
    );
  }

  function getAutoHighlightIndex(): number {
    return pageState.suggestionsView ? pageState.suggestionsView.getAutoHighlightIndex() : -1;
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

  function updateSelection(): void {
    if (!pageState.suggestionsView) {
      return;
    }
    pageState.suggestionsView.updateSelection(pageState.selectedIndex);
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
      activateSiteSearch(suggestion.provider);
      focusSearchInputPreservingScroll();
      return;
    }
    if (suggestion.type === 'helpFeedback' && suggestion.feedbackKey === 'community' &&
        openCommunityQrDialog) {
      openCommunityQrDialog(suggestion.url);
      return;
    }
    if (suggestion.type === 'modeSwitch') {
      setVisibleThemeMode(suggestion.nextMode);
      focusSearchInputPreservingScroll();
      return;
    }
    if (suggestion.type === 'zenSwitch') {
      setZenModeEnabled(suggestion.nextEnabled);
      focusSearchInputPreservingScroll();
      return;
    }
    if (suggestion.type === 'webAppearanceSwitch') {
      setWebAppearanceMode(suggestion.nextMode);
      focusSearchInputPreservingScroll();
      return;
    }
    if (Number.isInteger(index) && shouldSwitchMatchedTabSuggestion(suggestion)) {
      openMatchedTabSuggestion(suggestion, event, item, query);
      return;
    }
    if (isSiteSearchProvider(suggestion.provider) && suggestion.searchQuery) {
      runSiteSearchProviderQuery(
        suggestion.provider,
        suggestion.searchQuery,
        getSearchResultDisposition(event)
      );
      return;
    }
    if (shouldOpenSearchResultInBackgroundTab(event) && suggestion.url) {
      openSearchResultUrl(suggestion, query, event);
      return;
    }
    if (suggestion.forceSearch && suggestion.searchQuery) {
      navigateToQuery(suggestion.searchQuery, true, getSearchResultDisposition(event));
      return;
    }
    openSearchResultUrl(suggestion, query, event);
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
      const refreshQuery = pageState.latestQuery || (pageState.inputParts ? String(pageState.inputParts.input.value || '').trim() : '');
      if (!refreshQuery) {
        clearSearchSuggestions();
        return;
      }
      requestSuggestions(refreshQuery, { immediate: true });
    });
  }

  function scrollSelectedSuggestionIntoView(direction: 'up' | 'down', didWrap: boolean): void {
    if (!suggestionsContainer || pageState.selectedIndex < 0) {
      return;
    }
    const item = suggestionItems[pageState.selectedIndex];
    SUGGESTION_NAVIGATION.scrollItemIntoView(suggestionsContainer, item, {
      direction,
      didWrap,
      inset: 8
    });
  }

  function requestTabsAndRender(): void {
    pageState.tabs = [];
    clearSearchSuggestions();
  }

  function refreshTabsIfIdle(): void {
    if (!pageState.latestQuery || !pageState.latestQuery.trim()) {
      refreshTabsForSearchContext(() => {});
      clearSearchSuggestions();
    }
  }

  function clearSearchSuggestions(): void {
    directNavigationSettleController.cancel();
    releaseSuggestionsHeight(suggestionsContainer, window);
    pageState.inlineSearchState = null;
    pageState.siteSearchTriggerState = null;
    pageState.localSearchScopeTriggerState = null;
    clearSiteSearchTabHint();
    if (pageState.suggestionsView) {
      pageState.suggestionsView.clear();
    }
    pageState.currentSuggestions = [];
    pageState.lastSuggestionResponse = [];
    pageState.selectedIndex = -1;
    lastRenderedActionContextKey = '';
  }

  function dismissSearchSuggestionsFromBackground(): void {
    restoreUserAuthoredSearchInput();
    pageState.searchSuggestionsDismissed = true;
    pageState.suggestionRequestSeq += 1;
    if (pageState.remoteSuggestionDebounceTimer) {
      clearTimeout(pageState.remoteSuggestionDebounceTimer);
      pageState.remoteSuggestionDebounceTimer = null;
    }
    if (pageState.suggestionRequestWatchdogTimer) {
      clearTimeout(pageState.suggestionRequestWatchdogTimer);
      pageState.suggestionRequestWatchdogTimer = null;
    }
    clearSearchSuggestions();
  }

  function restoreDismissedSearchSuggestions(): boolean {
    if (!pageState.searchSuggestionsDismissed || !pageState.inputParts) {
      return false;
    }
    const rawValue = String(pageState.inputParts.input.value || '');
    const query = rawValue.trim();
    pageState.searchSuggestionsDismissed = false;
    if (!query) {
      return false;
    }
    pageState.latestRawQuery = rawValue;
    pageState.latestQuery = query;
    if (!pageState.localSearchScopeState && isSlashCommandInput(query)) {
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
    if (pageState.searchSuggestionsDismissed) {
      return undefined;
    }
    if (!query) {
      clearSearchSuggestions();
      return undefined;
    }
    pageState.lastSuggestionResponse = suggestions;

    return getShortcutRules().then((rules) => {
      const view = pageState.suggestionsView;
      if (pageState.searchSuggestionsDismissed || query !== pageState.latestQuery || !view) {
        return;
      }
      const inputValue = pageState.inputParts ? pageState.inputParts.input.value : '';
      const rawTagInput = (pageState.latestRawQuery || inputValue || '').trim();
      const localSearchQueryModeActive = Boolean(pageState.localSearchScopeState && String(query || '').trim());
      const slashCommandModeActive = !localSearchQueryModeActive && isSlashCommandInput(rawTagInput);
      const siteSearchQueryModeActive = !localSearchQueryModeActive &&
        !slashCommandModeActive &&
        Boolean(pageState.siteSearchState && String(query || '').trim());
      const modeCommandActive = slashCommandModeActive && !siteSearchQueryModeActive && isModeCommand(rawTagInput);
      const zenCommandActive = slashCommandModeActive && !siteSearchQueryModeActive && isZenCommand(rawTagInput);
      const toggleCommandActive = modeCommandActive || zenCommandActive;
      if (modeCommandActive) {
        // The command shows the stored theme, which another page may have changed.
        const storedMode = getScopedThemeMode();
        if (storedMode !== pageState.currentThemeMode) {
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
        const keywordSuggestions = buildKeywordSuggestions(query, rules);
        preSuggestions.push(...keywordSuggestions);
      }

      const providersForTags = siteSearchCatalog.triggerProviders;
      if (!siteSearchCatalog.loadedProviders && !pendingProviderReload) {
        pendingProviderReload = true;
        void siteSearchCatalog.loadProviders().then(() => {
          pendingProviderReload = false;
          if (query !== pageState.latestQuery) {
            return;
          }
          renderSuggestions(pageState.lastSuggestionResponse, query);
        });
      }
      const inlineCandidate = (!localSearchQueryModeActive && !slashCommandModeActive &&
          !siteSearchQueryModeActive && !toggleCommandActive && !hasCommand)
        ? getInlineSiteSearchCandidate(rawTagInput, providersForTags)
        : null;
      let inlineSuggestion: Suggestion | null = null;
      if (inlineCandidate) {
        const inlineUrl = buildSearchUrl(
          inlineCandidate.provider.template,
          inlineCandidate.query,
          inlineCandidate.provider
        );
        if (inlineUrl) {
          inlineSuggestion = {
            type: 'inlineSiteSearch',
            title: getSiteSearchActionTitle(inlineCandidate.provider),
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
      const siteSearchProvider = pageState.siteSearchState;
      const siteSearchSuggestion: Suggestion | null = siteSearchQueryModeActive && siteSearchProvider
        ? (() => {
            const aggregateSearch = isAggregateSearchProvider(siteSearchProvider);
            const siteUrl = aggregateSearch
              ? ''
              : buildSearchUrl(siteSearchProvider.template, query, siteSearchProvider);
            if (!aggregateSearch && !siteUrl) {
              return null;
            }
            return {
              type: 'siteSearch',
              title: getSiteSearchActionTitle(siteSearchProvider, query),
              url: siteUrl,
              favicon: aggregateSearch ? '' : getProviderIcon(siteSearchProvider),
              provider: siteSearchProvider,
              searchQuery: query
            };
          })()
        : null;

      const helpCenterSuggestions: Suggestion[] = siteSearchQueryModeActive && siteSearchProvider &&
          helpCenterSuggestionSource && SearchSiteSearchProviders.isHelpCenterSiteSearchProvider(siteSearchProvider)
        ? helpCenterSuggestionSource.getSuggestions(
          query,
          getHelpCenterLocale(),
          getProviderIcon(siteSearchProvider),
          getHelpCenterFeedback(query)
        )
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
          pageState.localSearchScopeState &&
          item.type === pageState.localSearchScopeState.sourceType
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
          rawQuery: pageState.latestRawQuery,
          triggerInput: rawTagInput,
          providers: providersForTags,
          inlineSuggestion,
          siteSearchActive: Boolean(pageState.siteSearchState),
          preferAutocompleteFirst: settings.get(searchResultPriority) !== 'search',
          onlyKeywordSuggestions,
          autocompleteSuggestions: keywordSuggestionState.autocompleteSuggestions,
          openTabMatch: settings.get(overlayTabPriority)
            ? {
                ...(pageState.currentNewtabTabId === null ? {} : { currentTabId: pageState.currentNewtabTabId }),
                openTabQuickSwitchEnabled: settings.get(overlayTabPriority),
                getDirectNavigationUrl
              }
            : null,
          matchers: {
            promoteStrongNavigationMatch,
            promoteTopSiteMatch,
            getSiteSearchTriggerCandidate,
            getAutocompleteCandidate,
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
          clearAutocomplete();
        } else {
          applyAutocomplete(allSuggestions, primarySuggestion, primaryHighlightReason);
        }
        const inlineAutoHighlight = Boolean(inlineSuggestion && primaryHighlightIndex === 0);
        pageState.inlineSearchState = inlineSuggestion
          ? {
              url: inlineSuggestion.url,
              provider: isSiteSearchProvider(inlineSuggestion.provider) ? inlineSuggestion.provider : null,
              query: inlineSuggestion.searchQuery || '',
              rawInput: rawTagInput,
              isAuto: inlineAutoHighlight
            }
          : null;
        const resolvedProvider = siteSearchTrigger;
        const resolvedLocalScope = !resolvedProvider
          ? getLocalSearchScopeCandidate(rawTagInput, rules)
          : null;
        pageState.siteSearchTriggerState = resolvedProvider
          ? { provider: resolvedProvider, rawInput: rawTagInput }
          : null;
        pageState.localSearchScopeTriggerState = resolvedLocalScope
          ? { scope: resolvedLocalScope, rawInput: rawTagInput }
          : null;
        if (resolvedProvider) {
          setSiteSearchTabHint(resolvedProvider);
        } else if (resolvedLocalScope) {
          setSiteSearchTabHint(getLocalSearchScopeTabHintProvider(resolvedLocalScope));
        } else {
          clearSiteSearchTabHint();
        }
      } else if (localSearchQueryModeActive) {
        clearAutocomplete();
        pageState.inlineSearchState = null;
        pageState.siteSearchTriggerState = null;
        pageState.localSearchScopeTriggerState = null;
        clearSiteSearchTabHint();
        if (allSuggestions.length > 0) {
          primaryHighlightIndex = 0;
          primaryHighlightReason = 'localScope';
          primarySuggestion = allSuggestions[0];
        }
      } else if (modeCommandActive) {
        clearAutocomplete();
        pageState.inlineSearchState = null;
        pageState.siteSearchTriggerState = null;
        pageState.localSearchScopeTriggerState = null;
        clearSiteSearchTabHint();
        primaryHighlightIndex = 0;
        primaryHighlightReason = 'modeSwitch';
      } else if (zenCommandActive) {
        clearAutocomplete();
        pageState.inlineSearchState = null;
        pageState.siteSearchTriggerState = null;
        pageState.localSearchScopeTriggerState = null;
        clearSiteSearchTabHint();
        primaryHighlightIndex = 0;
        primaryHighlightReason = 'zenSwitch';
      } else if (slashCommandModeActive) {
        clearAutocomplete();
        pageState.inlineSearchState = null;
        pageState.siteSearchTriggerState = null;
        pageState.localSearchScopeTriggerState = null;
        clearSiteSearchTabHint();
        primaryHighlightIndex = 0;
        primaryHighlightReason = 'command';
      }
      if (hasCommand) {
        applyAutocomplete(allSuggestions, primarySuggestion, primaryHighlightReason);
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
        currentSuggestions: pageState.currentSuggestions,
        allSuggestions
      });
      const canAppend = updateKind === 'append';
      const startIndex = canAppend ? pageState.currentSuggestions.length : 0;

      pageState.currentSuggestions = allSuggestions;
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
      if (updateKind !== 'highlight') {
        updateSelection();
      }
      if (updateKind !== 'highlight' || heightReleased) {
        setSuggestionsVisible(true);
      }
    });
  }

  function renderPendingSuggestions(query: string): void {
    void renderSuggestions(pageState.lastSuggestionResponse, query);
  }

  // Shows results saved before a reload exactly as they were. Replies to
  // requests made before this are dropped, so they cannot replace them.
  // Resolves once the results are rendered.
  function showSuggestionSnapshot(suggestions: Suggestion[], query: string, selectedIndex: number): Promise<void> {
    pageState.suggestionRequestSeq += 1;
    if (pageState.remoteSuggestionDebounceTimer) {
      clearTimeout(pageState.remoteSuggestionDebounceTimer);
      pageState.remoteSuggestionDebounceTimer = null;
    }
    if (pageState.suggestionRequestWatchdogTimer) {
      clearTimeout(pageState.suggestionRequestWatchdogTimer);
      pageState.suggestionRequestWatchdogTimer = null;
    }
    directNavigationSettleController.cancel();
    pageState.latestQuery = query;
    pageState.selectedIndex = selectedIndex;
    return Promise.resolve(renderSuggestions(suggestions, query));
  }

  const DIRECT_NAVIGATION_SETTLE_DELAY_MS = 120;
  const directNavigationSettleController =
    NEWTAB_DIRECT_NAVIGATION_SETTLE.createDirectNavigationSettleController<SettleContext>({
      delayMs: DIRECT_NAVIGATION_SETTLE_DELAY_MS,
      onSettle: ({ query, requestSeq }) => {
        if (requestSeq !== pageState.suggestionRequestSeq || query !== pageState.latestQuery) {
          return;
        }
        renderPendingSuggestions(query);
      }
    });

  function requestSuggestions(query: string, options?: SuggestionRequestOptions): void {
    pageState.latestQuery = query;
    const requestLocalSearchScope = pageState.localSearchScopeState;
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
    const requestQuery = pageState.latestQuery;
    const requestSeq = ++pageState.suggestionRequestSeq;
    const requestSearchFirst = settings.get(searchResultPriority) === 'search';
    const showExactSearchPendingState = requestSearchFirst &&
      !requestLocalSearchScope &&
      !pageState.siteSearchState &&
      !getDirectUrlSuggestion(requestQuery);
    directNavigationSettleController.cancel();
    if (deferInitialDirectNavigationRender) {
      directNavigationSettleController.schedule({
        query: requestQuery,
        requestSeq
      });
    }
    if (pageState.remoteSuggestionDebounceTimer) {
      clearTimeout(pageState.remoteSuggestionDebounceTimer);
      pageState.remoteSuggestionDebounceTimer = null;
    }
    if (pageState.suggestionRequestWatchdogTimer) {
      clearTimeout(pageState.suggestionRequestWatchdogTimer);
      pageState.suggestionRequestWatchdogTimer = null;
    }
    // A list of another query's results keeps its height until this
    // query's full answer.
    if (!requestLocalSearchScope && pageState.currentSuggestions.length > 0 && suggestionsContainer &&
        suggestionsContainer.getAttribute('data-visible') === 'true') {
      holdSuggestionsHeight(suggestionsContainer, window);
    }
    // Shown with the local results until this query's suggestions arrive.
    const carriedEngineSuggestions = SearchEngineSuggestions.carryOverEngineSuggestions(
      pageState.lastEngineSuggestionResponse,
      requestQuery
    );
    if (showExactSearchPendingState) {
      void renderSuggestions(carriedEngineSuggestions, requestQuery, { pendingRemote: true });
    }
    pageState.suggestionRequestWatchdogTimer = setTimeout(function() {
      if (requestSeq !== pageState.suggestionRequestSeq || requestQuery !== pageState.latestQuery) {
        return;
      }
      if (retryCount < 1) {
        requestSuggestions(requestQuery, { immediate: true, retryCount: retryCount + 1 });
        return;
      }
      renderPendingSuggestions(requestQuery);
    }, immediate ? 1200 : 1300);
    const localRequestSent = sendRuntimeMessage<'getSearchSuggestions'>({
      action: 'getSearchSuggestions',
      query: requestQuery,
      context: 'newtab',
      sourceTypes: requestLocalSearchScope ? [requestLocalSearchScope.sourceType] : undefined,
      includeOpenTabs: requestLocalSearchScope ? false : undefined
    }, function(response) {
      if (pageState.suggestionRequestWatchdogTimer) {
        clearTimeout(pageState.suggestionRequestWatchdogTimer);
        pageState.suggestionRequestWatchdogTimer = null;
      }
      if (requestSeq !== pageState.suggestionRequestSeq || requestQuery !== pageState.latestQuery) {
        return;
      }
      directNavigationSettleController.cancel();
      if (chrome.runtime && chrome.runtime.lastError) {
        renderPendingSuggestions(requestQuery);
        return;
      }
      const localSuggestions: Suggestion[] = response ? response.suggestions : [];
      if (requestLocalSearchScope) {
        void renderSuggestions(localSuggestions, requestQuery);
        return;
      }
      if (!showExactSearchPendingState) {
        void renderSuggestions([...localSuggestions, ...carriedEngineSuggestions], requestQuery, { pendingRemote: true });
      }
      refreshTabsForSearchContext(() => {});
      const remoteDelay = (requestSearchFirst || immediate)
        ? 0
        : Math.max(0, 120 - (Date.now() - requestStartedAt));
      pageState.remoteSuggestionDebounceTimer = setTimeout(function() {
        pageState.remoteSuggestionDebounceTimer = null;
        if (requestSeq !== pageState.suggestionRequestSeq || requestQuery !== pageState.latestQuery) {
          return;
        }
        const remoteRequestSent = sendRuntimeMessage<'getSearchEngineSuggestions'>({
          action: 'getSearchEngineSuggestions',
          query: requestQuery,
          context: 'newtab',
          localSuggestions: localSuggestions,
          searchFirst: requestSearchFirst
        }, function(remoteResponse) {
          if (requestSeq !== pageState.suggestionRequestSeq || requestQuery !== pageState.latestQuery) {
            return;
          }
          if (chrome.runtime && chrome.runtime.lastError) {
            void renderSuggestions(localSuggestions, requestQuery);
            return;
          }
          if (!remoteResponse ||
              remoteResponse.aborted === true ||
              remoteResponse.hasRemoteSuggestions !== true) {
            void renderSuggestions(localSuggestions, requestQuery);
            return;
          }
          pageState.lastEngineSuggestionResponse = remoteResponse.suggestions;
          void renderSuggestions(remoteResponse.suggestions, requestQuery);
        });
        if (!remoteRequestSent) {
          void renderSuggestions(localSuggestions, requestQuery);
        }
      }, remoteDelay);
    });
    if (!localRequestSent) {
      if (pageState.suggestionRequestWatchdogTimer) {
        clearTimeout(pageState.suggestionRequestWatchdogTimer);
        pageState.suggestionRequestWatchdogTimer = null;
      }
      if (requestSeq === pageState.suggestionRequestSeq && requestQuery === pageState.latestQuery) {
        directNavigationSettleController.cancel();
        renderPendingSuggestions(requestQuery);
      }
    }
  }

  return {
    setSuggestionActionModifiersActive,
    syncSuggestionActionModifiersFromEvent,
    getAutoHighlightIndex,
    updateSelection,
    activateRenderedSuggestion,
    deleteRenderedHistorySuggestion,
    scrollSelectedSuggestionIntoView,
    requestTabsAndRender,
    refreshTabsIfIdle,
    clearSearchSuggestions,
    dismissSearchSuggestionsFromBackground,
    restoreDismissedSearchSuggestions,
    renderSuggestions,
    renderPendingSuggestions,
    showSuggestionSnapshot,
    directNavigationSettleController,
    requestSuggestions
  };
}

type SuggestionsController = ReturnType<typeof createSuggestionsController>;

export { createSuggestionsController };
export type { SuggestionsController, SuggestionsControllerDeps, SuggestionsControllerState };
