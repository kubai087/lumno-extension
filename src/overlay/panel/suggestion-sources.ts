// Building suggestions: keywords, direct navigation, help center
// answers, and the update that merges local, tab and remote results.
import type { ShortcutRule } from '../../domain/messages';
import type { SiteSearchProvider } from '../../domain/search/types';
import { themeMode } from '../../domain/settings/appearance';
import type { ThemeMode } from '../../domain/settings/appearance';
import { readShortcutRules } from '../../domain/shortcut-rules-reader';
import * as BROWSER_PROFILE from '../../platform/browser-profile';
import * as LumnoMessaging from '../../platform/messaging';
import type { SuggestionsViewController } from '../../shared/react/search/suggestion-list/types';
import type { InputModeProvider } from '../../shared/search/input-mode/types';
import { releaseSuggestionsHeight } from '../../shared/search/suggestions-height-layout';
import type { SearchAutocomplete } from '../../shared/search-panel/autocomplete';
import type { RemoteMixState } from './remote-suggestions';
import type { CommandSuggestion, SlashCommand } from './slash-commands';
import type {
  FormatMessage,
  OverlaySuggestion,
  Translate
} from './types';
import { shortcutRulesCache } from '../../shared/search/shortcut-rules-cache';
import * as Search from '../../domain/search/help-center/search';
import * as SearchDirectNavigation from '../../domain/search/utils/direct-navigation';
import * as SearchSiteSearchProviders from '../../domain/search/utils/site-search-providers';
import * as SearchSuggestionSlate from '../../domain/search/utils/suggestion-slate';
import { simpleModeEnabled } from '../../domain/settings/appearance';
import { overlayTabPriority } from '../../domain/settings/overlay-panel';
import { searchResultDisplayLimit, searchResultPriority, tabRankScoreDebug } from '../../domain/settings/search';
import type { OverlaySettings } from '../overlay-settings';
import type { SiteSearchCatalog } from '../../shared/search-panel/site-search/catalog';
import type { DefaultSearchEngine } from '../../shared/search-panel/default-engine';
import type { OverlayFaviconRuntime } from '../favicon-view';
import type { SurfaceLocale } from '../../shared/i18n/surface-locale';
import type { SearchQuery } from '../../shared/search-panel/search-query';
import type { SearchMode } from '../../shared/search-panel/search-mode';
import type { SearchResults } from '../../shared/search-panel/search-results';
import { isAggregateSearchProvider } from '../../domain/search/aggregate-search-store';
import { getLocalSearchScopeTabHintProvider, getSiteSearchActionTitle } from '../../shared/search-panel/labels';
import { getInlineSiteSearchCandidate } from '../../domain/search/utils/site-search-matching';
import { getKeywordSearchSuggestionState } from '../../domain/search/utils/engine-suggestions';
import type { SearchMatching } from '../../shared/search-panel/matching';
import type { SiteSearchRunner } from '../../shared/search-panel/site-search/runner';
import * as SUGGESTION_ACTION_MODEL from '../../domain/search/suggestion-action-model';
import * as COMMUNITY_LINKS from '../../platform/community-links';

interface SuggestionSourcesState {
  settings: Pick<OverlaySettings, 'get' | 'get'>;
  searchInput: HTMLInputElement | null;
  suggestionsContainer: HTMLElement | null;
  lastRenderedQuery: string;
  lastRenderedActionContextKey: string;
  overlayThemeMode: ThemeMode;
  prioritizeCurrentPageMatch: boolean;
  currentOverlayTabId: number | null;
}

interface SuggestionSourcesDeps {
  siteSearchRunner: SiteSearchRunner;
  searchMatching: SearchMatching;
  searchResults: SearchResults<OverlaySuggestion>;
  searchMode: SearchMode<InputModeProvider>;
  searchAutocomplete: SearchAutocomplete;
  searchQuery: SearchQuery;
  favicons: Pick<OverlayFaviconRuntime, 'warmIconCache'>;
  siteSearchCatalog: SiteSearchCatalog;
  formatMessage: FormatMessage;
  t: Translate;
  getPageFaviconCandidateUrl(url: string): string;
  isLocalNetworkInput(input: string): boolean;
  getHostFromUrl(url: string): string;
  isLocalNetworkHost(host: string): boolean;
  locale: Pick<SurfaceLocale, 'store' | 't' | 'formatMessage'>;
  getProviderIcon(provider: SiteSearchProvider): string;
  isSlashCommandInput(input: string): boolean;
  isModeCommand(input: string): boolean;
  applyOverlayTheme(mode: ThemeMode): void;
  searchEngine: DefaultSearchEngine;
  getCommandMatches(rawInput: string): SlashCommand[];
  buildModeSuggestion(): CommandSuggestion;
  buildCommandSuggestion(command: SlashCommand): CommandSuggestion;
  isCurrentOverlayTabUrl(url: string): boolean;
  getMatchedOpenTabIdForSuggestion(suggestion: { url?: string } | null): number | null;
  filterOverlayBlacklistedSuggestions(list: OverlaySuggestion[] | null): OverlaySuggestion[];
  getUrlDisplay(url: string | undefined): string;
  setSiteSearchTabHint(provider: InputModeProvider): void;
  clearSiteSearchTabHint(): void;
  limitOverlaySuggestionsForDisplay(list: OverlaySuggestion[], options?: { uncapped?: boolean } | null): OverlaySuggestion[];
  // Whether the mode menu is moving the panels, which the results join.
  getSearchPanelsLayoutTransitionMenu(): unknown;
  pauseOverlayAntiTranslateObserverForMutationBurst(): void;
  setOpenTabsResultsViewport(active: boolean, itemCount?: number): void;
  ensureOverlaySuggestionsView(): Pick<SuggestionsViewController, 'render'>;
  setOverlayResultsCollapsed(collapsed: boolean, options?: { deferLayoutSync?: boolean } | null): void;
  syncSuggestionLastState(): void;
  updateSelection(): void;
  commitSuggestionsNaturalHeightAfterRender(): void;
  cancelPendingOverlaySuggestionRequests(): void;
  shouldShowOpenTabsForEmptyQuery(): boolean;
  requestTabsAndRender(query?: string): void;
  clearDefaultOpenTabsSuggestions(): void;
  overlayState: SuggestionSourcesState;
}

interface SuggestionUpdateOptions {
  forceFullRerender?: boolean;
  remoteMixState?: RemoteMixState;
  finalRemoteMix?: boolean;
}

function createSuggestionSources(deps: SuggestionSourcesDeps) {
  const {
    siteSearchRunner,
    searchMatching,
    searchResults,
    searchMode,
    searchAutocomplete,
    searchQuery,
    favicons,
    siteSearchCatalog,
    formatMessage,
    getPageFaviconCandidateUrl,
    isLocalNetworkInput,
    getHostFromUrl,
    isLocalNetworkHost,
    locale,
    getProviderIcon,
    t,
    isSlashCommandInput,
    isModeCommand,
    applyOverlayTheme,
    searchEngine,
    getCommandMatches,
    buildModeSuggestion,
    buildCommandSuggestion,
    isCurrentOverlayTabUrl,
    getMatchedOpenTabIdForSuggestion,
    filterOverlayBlacklistedSuggestions,
    getUrlDisplay,
    setSiteSearchTabHint,
    clearSiteSearchTabHint,
    limitOverlaySuggestionsForDisplay,
    getSearchPanelsLayoutTransitionMenu,
    pauseOverlayAntiTranslateObserverForMutationBurst,
    setOpenTabsResultsViewport,
    ensureOverlaySuggestionsView,
    setOverlayResultsCollapsed,
    syncSuggestionLastState,
    updateSelection,
    commitSuggestionsNaturalHeightAfterRender,
    cancelPendingOverlaySuggestionRequests,
    shouldShowOpenTabsForEmptyQuery,
    requestTabsAndRender,
    clearDefaultOpenTabsSuggestions
  } = deps;

  // The panel state object shared with search-panel.ts and the other modules.
  const overlayState = deps.overlayState;

  // Lumno Help Center search lists the matching help pages under its search row.
  let helpCenterSuggestionSource: ReturnType<typeof Search.createSuggestionSource> | null = null;
  let helpCenterFeedbackLinksRequested = false;
  let pendingProviderReload = false;

  function getBrowserPageSuggestionTitle(browserProfile: { name: string } | null, targetUrl: string): string {
    const browserName = browserProfile && browserProfile.name ? browserProfile.name : '';
    if (browserName) {
      return formatMessage('open_browser_url', '打开 {browser}：{url}', {
        browser: browserName,
        url: targetUrl
      });
    }
    return formatMessage('open_url', '打开 {url}', { url: targetUrl });
  }

  // The shortcut rules, read once per page; through the worker when this
  // page's copy of the extension cannot fetch its own files.
  function getShortcutRules(): Promise<ShortcutRule[]> {
    const cachedRules = shortcutRulesCache.rules;
    if (cachedRules) {
      return Promise.resolve(cachedRules);
    }
    const pendingRules = shortcutRulesCache.pending;
    if (pendingRules) {
      return pendingRules;
    }
    const rulesUrl = chrome.runtime.getURL('assets/data/shortcut-rules.json');
    const rulesPromise = fetch(rulesUrl)
      .then((response) => response.json())
      .then((data: unknown) => {
        const items = readShortcutRules(data);
        shortcutRulesCache.rules = items;
        return items;
      })
      .catch(() => new Promise<ShortcutRule[]>((resolve) => {
        LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'getShortcutRules' }, (response) => {
          const items = response && Array.isArray(response.items) ? response.items : [];
          shortcutRulesCache.rules = items;
          resolve(items);
        });
      }));
    shortcutRulesCache.pending = rulesPromise;
    return rulesPromise;
  }

  function buildKeywordSuggestions(input: string, rules: ShortcutRule[]): OverlaySuggestion[] {
    const queryLower = input.toLowerCase();
    const browserProfile = BROWSER_PROFILE.getBrowserInternalProfile(navigator);
    const scheme = browserProfile.scheme;
    const matches: OverlaySuggestion[] = [];
    rules.forEach((rule) => {
      if (!rule || !Array.isArray(rule.keys)) {
        return;
      }
      const isMatch = rule.keys.some((key: string) => queryLower.startsWith(key));
      if (!isMatch) {
        return;
      }
      if (rule.type === 'browserPage' && rule.path) {
        if (!BROWSER_PROFILE.canOpenBrowserPages(scheme)) {
          return;
        }
        const targetUrl = `${scheme}${rule.path}`;
        matches.push({
          type: 'browserPage',
          title: getBrowserPageSuggestionTitle(browserProfile, targetUrl),
          url: targetUrl,
          favicon: getPageFaviconCandidateUrl(targetUrl)
        });
      } else if (rule.type === 'url' && rule.url) {
        matches.push({
          type: 'browserPage',
          title: formatMessage('open_url', '打开 {url}', { url: rule.url }),
          url: rule.url,
          favicon: getPageFaviconCandidateUrl(rule.url)
        });
      }
    });
    return matches;
  }

  function getDirectNavigationUrl(input: string): string {
    return SearchDirectNavigation.getDirectNavigationUrl(input);
  }

  // The row that opens a typed address, or null when it is no address.
  function getDirectUrlSuggestion(input: string): OverlaySuggestion | null {
    const targetUrl = getDirectNavigationUrl(input);
    if (!targetUrl) {
      return null;
    }
    let isLocalNetwork = isLocalNetworkInput(input);
    if (!isLocalNetwork) {
      const host = getHostFromUrl(targetUrl);
      isLocalNetwork = isLocalNetworkHost(host);
    }
    return {
      type: 'directUrl',
      title: formatMessage('open_url', '打开 {url}', { url: targetUrl }),
      url: targetUrl,
      favicon: getPageFaviconCandidateUrl(targetUrl),
      isLocalNetwork: isLocalNetwork
    };
  }

  // The address a query opens without searching: a typed address or a
  // shortcut rule's page; '' when there is none.
  function resolveQuickNavigation(query: string): Promise<string> {
    const directUrlSuggestion = getDirectUrlSuggestion(query);
    if (directUrlSuggestion) {
      return Promise.resolve(directUrlSuggestion.url || '');
    }
    return getShortcutRules().then((rules) => {
      const keywordSuggestions = buildKeywordSuggestions(query, rules);
      if (keywordSuggestions.length > 0) {
        return keywordSuggestions[0].url || '';
      }
      return '';
    });
  }

  function getSuggestionUpdateKind(
    options: Parameters<typeof SUGGESTION_ACTION_MODEL.getSuggestionUpdateKind>[0]
  ): ReturnType<typeof SUGGESTION_ACTION_MODEL.getSuggestionUpdateKind> {
    return SUGGESTION_ACTION_MODEL.getSuggestionUpdateKind({
      ...(options || {}),
      includeDebugReasons: Boolean(overlayState.settings.get(tabRankScoreDebug))
    });
  }

  function getSuggestionActionContextKey(options: Parameters<typeof SUGGESTION_ACTION_MODEL.getActionContextKey>[0]): string {
    return SUGGESTION_ACTION_MODEL.getActionContextKey(options);
  }

  function getHelpCenterLocale(): string {
    return locale.store.getSnapshot().locale;
  }

  // The help pages matching the query while the help center site search is on.
  function getHelpCenterSuggestions(query: string): OverlaySuggestion[] {
    const provider = searchMode.site;
    if (!provider || !SearchSiteSearchProviders.isHelpCenterSiteSearchProvider(provider)) {
      return [];
    }
    if (!helpCenterSuggestionSource) {
      helpCenterSuggestionSource = Search.createSuggestionSource({
        sendMessage: (message, callback) => {
          try {
            LumnoMessaging.sendBackgroundMessage(chrome.runtime, message, (response) => {
              callback(chrome.runtime.lastError ? undefined : response);
            });
            return true;
          } catch (_error) {
            return false;
          }
        },
        onUpdate: (updatedQuery) => {
          if (updatedQuery === searchQuery.text) {
            updateSearchSuggestions(searchResults.lastResponse, searchQuery.text);
          }
        }
      });
    }
    const locale = getHelpCenterLocale();
    return helpCenterSuggestionSource.getSuggestions(
      query,
      locale,
      getProviderIcon(provider),
      getHelpCenterFeedback(query, locale)
    );
  }

  // Where to ask when the help center has nothing; community links are fetched fresh once.
  function getHelpCenterFeedback(query: string, locale: string) {
    if (!helpCenterFeedbackLinksRequested) {
      helpCenterFeedbackLinksRequested = true;
      void COMMUNITY_LINKS.load().then(() => {
        if (query === searchQuery.text) {
          updateSearchSuggestions(searchResults.lastResponse, query);
        }
      });
    }
    const links = COMMUNITY_LINKS.getLinks();
    return {
      links,
      channel: COMMUNITY_LINKS.getCommunityChannel(links, locale),
      t
    };
  }

  // Renders the list for the query from the local rows given, adding the
  // search action, commands, direct addresses and site search rows, and
  // ranking them; answers for an older query are dropped.
  function updateSearchSuggestions(suggestions: OverlaySuggestion[], query: string, options?: SuggestionUpdateOptions | null): void {
    if (query !== searchQuery.text) {
      return;
    }
    const renderOptions: SuggestionUpdateOptions = options && typeof options === 'object' ? options : {};
    const forceFullRerender = renderOptions.forceFullRerender === true;
    const finalRemoteMix = renderOptions.finalRemoteMix === true;
    const remoteMixState = renderOptions.remoteMixState && typeof renderOptions.remoteMixState === 'object'
      ? renderOptions.remoteMixState
      : null;
    searchResults.setLastResponse(Array.isArray(suggestions) ? suggestions : []);
    const rawTagInput = (searchQuery.raw || query || '').trim();
    const localSearchQueryModeActive = Boolean(searchMode.local && String(query || '').trim());
    const slashCommandModeActive = !localSearchQueryModeActive && isSlashCommandInput(rawTagInput);
    const siteSearchQueryModeActive = !localSearchQueryModeActive &&
      !slashCommandModeActive &&
      Boolean(searchMode.site && String(query || '').trim());
    const modeCommandActive = slashCommandModeActive && !siteSearchQueryModeActive && isModeCommand(rawTagInput);
    if (modeCommandActive) {
      const storedMode = overlayState.settings.get(themeMode);
      if (storedMode !== overlayState.overlayThemeMode) {
        applyOverlayTheme(storedMode);
      }
    }

    // Add New Tab suggestion as first item
    const newTabSuggestion: OverlaySuggestion | null = (localSearchQueryModeActive || slashCommandModeActive ||
        modeCommandActive || siteSearchQueryModeActive)
      ? null
      : {
        type: 'newtab',
        title: overlayState.settings.get(simpleModeEnabled)
          ? query
          : formatMessage('search_query', '搜索 "{query}"', {
              query: query
            }),
        url: searchEngine.searchUrl(query),
        favicon: getPageFaviconCandidateUrl(searchEngine.themeUrl()),
        searchQuery: query,
        forceSearch: true
      };

    void getShortcutRules().then((rules) => {
      if (query !== searchQuery.text) {
        return;
      }
      if (!finalRemoteMix && remoteMixState && remoteMixState.settled) {
        return;
      }
      const commandMatches = (slashCommandModeActive && !modeCommandActive && !siteSearchQueryModeActive)
        ? getCommandMatches(rawTagInput)
        : [];
      const hasCommand = commandMatches.length > 0;
      const preSuggestions: OverlaySuggestion[] = [];
      if (modeCommandActive) {
        preSuggestions.push(buildModeSuggestion());
      } else if (slashCommandModeActive && !siteSearchQueryModeActive) {
        commandMatches.forEach((command) => {
          preSuggestions.push(buildCommandSuggestion(command));
        });
      } else if (!siteSearchQueryModeActive && !localSearchQueryModeActive) {
        const directUrlSuggestion = getDirectUrlSuggestion(query);
        if (directUrlSuggestion && !isCurrentOverlayTabUrl(directUrlSuggestion.url || '')) {
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
          if (query !== searchQuery.text) {
            return;
          }
          updateSearchSuggestions(searchResults.lastResponse, query);
        });
      }
      const inputValue = overlayState.searchInput ? overlayState.searchInput.value : '';
      const rawTagInputForInline = (searchQuery.raw || inputValue || '').trim();
      const inlineCandidate = (!localSearchQueryModeActive && !slashCommandModeActive &&
          !siteSearchQueryModeActive && !modeCommandActive && !hasCommand)
        ? getInlineSiteSearchCandidate(rawTagInputForInline, providersForTags)
        : null;
      let inlineSuggestion: OverlaySuggestion | null = null;
      if (inlineCandidate) {
        const inlineUrl = siteSearchRunner.buildSearchUrl(
          inlineCandidate.provider.template || '',
          inlineCandidate.query,
          inlineCandidate.provider
        );
        if (inlineUrl) {
          inlineSuggestion = {
            type: 'inlineSiteSearch',
            title: getSiteSearchActionTitle(locale, inlineCandidate.provider, ''),
            url: inlineUrl,
            favicon: getProviderIcon(inlineCandidate.provider),
            provider: inlineCandidate.provider,
            searchQuery: inlineCandidate.query
          };
        }
      }

      const activeProvider = searchMode.site;
      const siteSearchSuggestion: OverlaySuggestion | null = siteSearchQueryModeActive && activeProvider
        ? (() => {
            const aggregateSearch = isAggregateSearchProvider(activeProvider);
            const siteUrl = aggregateSearch
              ? ''
              : siteSearchRunner.buildSearchUrl(activeProvider.template || '', query, activeProvider);
            if (!aggregateSearch && !siteUrl) {
              return null;
            }
            return {
              type: 'siteSearch',
              title: getSiteSearchActionTitle(locale, activeProvider, query),
              url: siteUrl,
              favicon: aggregateSearch ? '' : getProviderIcon(activeProvider),
              provider: activeProvider,
              searchQuery: query
            };
          })()
        : null;

      // Add New Tab, ChatGPT and Perplexity suggestions to the beginning
      const newTabRows: OverlaySuggestion[] = newTabSuggestion ? [newTabSuggestion] : [];
      const scope = searchMode.local;
      let allSuggestions: OverlaySuggestion[] = localSearchQueryModeActive
        ? suggestions.filter((item) => Boolean(item && scope && item.type === scope.sourceType))
        : (slashCommandModeActive ? [...preSuggestions] : (siteSearchQueryModeActive
          ? (siteSearchSuggestion ? [siteSearchSuggestion, ...getHelpCenterSuggestions(query)] : [])
          : (modeCommandActive ? [...preSuggestions] : [...preSuggestions, ...newTabRows, ...suggestions])));
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
      allSuggestions = filterOverlayBlacklistedSuggestions(allSuggestions);
      const hasDirectUrlSuggestion = preSuggestions.some((suggestion) => (
        suggestion && suggestion.type === 'directUrl'
      ));
      if (overlayState.settings.get(searchResultPriority) === 'search' &&
          !localSearchQueryModeActive &&
          !slashCommandModeActive &&
          !modeCommandActive &&
          !siteSearchQueryModeActive &&
          !hasDirectUrlSuggestion) {
        allSuggestions = SearchSuggestionSlate.composeSearchFirstSuggestionSlate(allSuggestions, {
          limit: overlayState.settings.get(searchResultDisplayLimit),
          query
        });
      }
      const keywordSuggestionState = getKeywordSearchSuggestionState(allSuggestions);
      const onlyKeywordSuggestions = keywordSuggestionState.onlyKeywordSuggestions;

      let primaryHighlightIndex = -1;
      let primaryHighlightReason = 'none';
      let mergedProvider: SiteSearchProvider | null = null;
      let primarySuggestion: OverlaySuggestion | null = null;
      if (!localSearchQueryModeActive && !slashCommandModeActive && !modeCommandActive && !hasCommand) {
        const rankedSlate = SearchSuggestionSlate.rankSearchSuggestionSlate(allSuggestions, {
          query,
          rawQuery: searchQuery.raw,
          triggerInput: rawTagInput,
          providers: providersForTags,
          inlineSuggestion,
          siteSearchActive: Boolean(searchMode.site),
          preferAutocompleteFirst: overlayState.settings.get(searchResultPriority) !== 'search',
          onlyKeywordSuggestions,
          autocompleteSuggestions: keywordSuggestionState.autocompleteSuggestions,
          openTabMatch: overlayState.settings.get(overlayTabPriority) || overlayState.prioritizeCurrentPageMatch
            ? {
                prioritizeCurrentPageMatch: overlayState.prioritizeCurrentPageMatch,
                currentTabId: overlayState.currentOverlayTabId === null ? undefined : overlayState.currentOverlayTabId,
                openTabQuickSwitchEnabled: overlayState.settings.get(overlayTabPriority),
                getDirectNavigationUrl
              }
            : null,
          matchers: {
            promoteStrongNavigationMatch: searchMatching.promoteStrongNavigationMatch,
            promoteTopSiteMatch: searchMatching.promoteTopSiteMatch,
            getSiteSearchTriggerCandidate: (input, providers, topSiteMatch) => (
              searchMatching.getSiteSearchTriggerCandidate(String(input || ''), providers || null, topSiteMatch)
            ),
            getAutocompleteCandidate: (rows, rawQuery) => searchAutocomplete.getCandidate(rows || null, rawQuery),
            getUrlDisplay,
            filterSuggestions: (list) => filterOverlayBlacklistedSuggestions(list)
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
          ? searchMatching.getLocalSearchScopeCandidate(rawTagInputForInline, rules)
          : null;
        searchMode.setHints(
          inlineSuggestion
            ? {
                url: inlineSuggestion.url,
                provider: inlineSuggestion.provider,
                query: inlineSuggestion.searchQuery || '',
                rawInput: rawTagInputForInline,
                isAuto: inlineAutoHighlight
              }
            : null,
          resolvedProvider ? { provider: resolvedProvider, rawInput: rawTagInputForInline } : null,
          resolvedLocalScope ? { scope: resolvedLocalScope, rawInput: rawTagInputForInline } : null
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
      allSuggestions = limitOverlaySuggestionsForDisplay(allSuggestions, {
        uncapped: slashCommandModeActive
      });
      const actionContextKey = getSuggestionActionContextKey({
        primaryHighlightIndex,
        primaryHighlightReason,
        onlyKeywordSuggestions,
        primarySuggestion,
        mergedProvider
      });
      const updateKind = getSuggestionUpdateKind({
        forceFullRerender,
        actionContextKey,
        lastRenderedActionContextKey: overlayState.lastRenderedActionContextKey,
        currentSuggestions: searchResults.rows,
        allSuggestions
      });
      const shouldAnimateScopeResultEnter = Boolean(
        getSearchPanelsLayoutTransitionMenu() &&
        siteSearchQueryModeActive &&
        updateKind === 'structure' &&
        searchResults.rows.length === 0 &&
        allSuggestions.some((suggestion) => suggestion && suggestion.type === 'siteSearch')
      );
      const canAppend = updateKind === 'append';
      const shouldPreserveVisualState =
        updateKind === 'content' || updateKind === 'append';
      const container = overlayState.suggestionsContainer;
      const previousScrollTop = shouldPreserveVisualState && container
        ? Math.max(0, Number(container.scrollTop) || 0)
        : 0;
      const startIndex = canAppend ? searchResults.rows.length : 0;
      pauseOverlayAntiTranslateObserverForMutationBurst();
      setOpenTabsResultsViewport(false);
      const reactView = ensureOverlaySuggestionsView();
      searchResults.show(allSuggestions);
      overlayState.lastRenderedQuery = query;
      overlayState.lastRenderedActionContextKey = actionContextKey;
      if (updateKind !== 'highlight') {
        favicons.warmIconCache(allSuggestions.filter((item) => (
          item && item.type !== 'directUrl'
        )));
      }
      const emptyMessage = slashCommandModeActive && allSuggestions.length === 0
        ? t('slash_command_empty', '无匹配命令')
        : (localSearchQueryModeActive && allSuggestions.length === 0
          ? t('overlay_empty_result', '无匹配结果')
          : '');
      reactView.render({
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
      // Reveal only after the target rows render, then adopt their natural
      // height directly in the same commit.
      setOverlayResultsCollapsed(false, {
        deferLayoutSync: true
      });
      if (container) {
        if (shouldAnimateScopeResultEnter) {
          container.setAttribute('data-scope-result-enter', 'run');
        } else {
          container.removeAttribute('data-scope-result-enter');
        }
      }
      if (updateKind !== 'highlight') {
        if (shouldPreserveVisualState && container) {
          container.scrollTop = previousScrollTop;
        }
        syncSuggestionLastState();
        updateSelection();
      }
      // Rows shown while the search engine's suggestions are pending keep
      // the list's height; any other answer lets the list take its own.
      if (!remoteMixState || finalRemoteMix) {
        releaseSuggestionsHeight(container, window);
      }
      commitSuggestionsNaturalHeightAfterRender();
      if (updateKind === 'structure') {
        searchResults.select(-1);
      }
    });
  }
  function clearSearchSuggestions(): void {
    cancelPendingOverlaySuggestionRequests();
    releaseSuggestionsHeight(overlayState.suggestionsContainer, window);
    searchMode.clearHints();
    clearSiteSearchTabHint();
    searchResults.setLastResponse([]);
    if (shouldShowOpenTabsForEmptyQuery()) {
      requestTabsAndRender();
      return;
    }
    clearDefaultOpenTabsSuggestions();
  }

  return {
    getShortcutRules,
    getDirectNavigationUrl,
    getDirectUrlSuggestion,
    resolveQuickNavigation,
    getHelpCenterLocale,
    updateSearchSuggestions,
    clearSearchSuggestions
  };
}

export { createSuggestionSources };
export type { SuggestionSourcesDeps, SuggestionSourcesState, SuggestionUpdateOptions };
