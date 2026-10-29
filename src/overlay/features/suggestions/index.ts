// The suggestions: the mode actions, the site search tab hint and results
// layout, the rendering, the slash commands, the sources and remote
// suggestions, the search modes and the mode menu.
import { buildTheme } from '../../../shared/favicon/favicon-theme';
import * as PANEL_REMOTE_SUGGESTIONS from '../../panel/remote-suggestions';
import * as PANEL_RESULTS_LAYOUT from '../../panel/results-layout';
import * as PANEL_SEARCH_MODES from '../../panel/search-modes';
import * as PANEL_SLASH_COMMANDS from '../../panel/slash-commands';
import * as PANEL_SUGGESTION_SOURCES from '../../panel/suggestion-sources';
import * as PANEL_SUGGESTIONS_RENDER from '../../panel/suggestions-render';
import { SearchModeMenu } from '../../../shared/search-panel/mode-menu';
import { SearchModeActions } from '../../../shared/search-panel/mode-actions';
import type { InputModeProvider } from '../../../shared/search/input-mode/types';
import * as SearchSiteSearchMatching from '../../../domain/search/utils/site-search-matching';
import type { OverlayContext } from '../../app/context';
import type { CoreFeature } from '../core';
import type { PanelFeature } from '../panel';

interface SuggestionsFeatureDeps {
  core: CoreFeature;
  panel: PanelFeature;
}

function createSuggestionsFeature(ctx: OverlayContext, deps: SuggestionsFeatureDeps) {
  const { elements, formatMessage, locale, openOptions, overlaySessionCleanups, overlayTabs, settings, t } = ctx;
  const {
    defaultTheme,
    filterTabsForOverlay,
    getMatchedOpenTabIdForSuggestion,
    getUrlDisplay,
    isCurrentOverlayTabUrl,
    lastRender,
    overlayMediaQuery,
    overlayThemeChoice,
    pauseOverlayAntiTranslateObserverForMutationBurst,
    shouldSwitchMatchedTabSuggestion,
    suggestionInputPreview,
    urlHighlightTheme
  } = deps.core;
  const {
    colorScheme,
    menuOrder,
    searchAutocomplete,
    searchEngine,
    searchMatching,
    searchMode,
    searchQuery,
    searchResults,
    siteSearchCatalog,
    siteSearchIconCache,
    siteSearchRunner,
    suggestionItems,
    suggestionModifiers,
    suggestionSource
  } = deps.core;
  const {
    applyMarkVariables,
    applyThemeVariables,
    detectPageTheme,
    faviconRuntime,
    filterOverlayBlacklistedSuggestions,
    getBrandAccentForUrl,
    getChromeFaviconUrl,
    getHighlightColors,
    getHostFromUrl,
    getHoverColors,
    getImmediateThemeForSuggestion,
    getNeutralHoverActionColors,
    getOverlayFaviconUrlResolver,
    getPageFaviconCandidateUrl,
    getPageRenderableProviderIcon,
    getProviderIcon,
    getThemeForMode,
    getThemeForProvider,
    getThemeForSuggestion,
    isLoadingSessionTracked,
    isLocalNetworkHost,
    isLocalNetworkInput,
    limitOverlaySuggestionsForDisplay,
    normalizeSearchResultDisplayLimit,
    resultActivation,
    shouldBlockOverlayFaviconForHost
  } = deps.panel;

  // Web clip needs Document Picture-in-Picture, which Firefox does not ship.
  const documentPipSupported = 'documentPictureInPicture' in window;
  const setInputScopedStyle = (element: HTMLElement | null, property: string, value: string): void => {
    if (!element) {
      return;
    }
    element.style.setProperty(property, value);
  };

  const modeActions = new SearchModeActions<InputModeProvider>({
    settings: settings.store,
    locale,
    mode: searchMode,
    query: searchQuery,
    autocomplete: searchAutocomplete,
    source: suggestionSource,
    surface: {
      getInput: () => elements.searchInput,
      getModeController: () => elements.inputModeController,
      defaultTheme: defaultTheme,
      getImmediateTheme: (provider) => getImmediateThemeForSuggestion({ provider }) || defaultTheme,
      getThemeForProvider
    }
  });
  const {
    syncOpenTabsScrollbarGutter,
    setOpenTabsResultsViewport,
    syncSearchModeMenuResultOffset,
    setOverlayResultsCollapsed,
    shouldShowOpenTabsForEmptyQuery,
    updateInputRightPadding,
    setSiteSearchTabHint,
    clearSiteSearchTabHint
  } = PANEL_RESULTS_LAYOUT.createResultsLayout({
    elements,
    settings,
    searchMode,
    normalizeSearchResultDisplayLimit,
    setInputScopedStyle
  });

  const {
    rowEvents,
    clearDefaultOpenTabsSuggestions,
    syncSuggestionLastState,
    scrollSelectedSuggestionIntoView,
    getSearchPanelsLayoutTransitionMenu,
    commitSuggestionsNaturalHeightAfterRender,
    ensureOverlaySuggestionsView,
    renderTabSuggestions,
    renderCachedTabsForOverlay,
    renderCachedTabsOrRequest,
    requestTabsAndRender
  } = PANEL_SUGGESTIONS_RENDER.createSuggestionsRender({
    lastRender,
    isLoadingSessionTracked,
    overlaySessionCleanups,
    overlayTabs,
    elements,
    urlHighlightTheme,
    defaultTheme,
    suggestionInputPreview,
    settings,
    suggestionModifiers,
    colorScheme,
    locale,
    searchResults,
    searchMode,
    searchQuery,
    favicons: faviconRuntime,
    suggestionItems,
    syncSearchModeMenuResultOffset,
    shouldSwitchMatchedTabSuggestion,
    resultActivation,
    getOverlayFaviconUrlResolver,
    t,
    formatMessage,
    shouldBlockOverlayFaviconForHost,
    isLocalNetworkHost,
    getChromeFaviconUrl,
    getPageFaviconCandidateUrl,
    getHostFromUrl,
    getUrlDisplay,
    getImmediateThemeForSuggestion,
    getThemeForSuggestion,
    getThemeForMode,
    getHoverColors,
    getHighlightColors,
    getNeutralHoverActionColors,
    applyThemeVariables,
    applyMarkVariables,
    searchEngine,
    getBrandAccentForUrl,
    buildTheme,
    normalizeSearchResultDisplayLimit,
    pauseOverlayAntiTranslateObserverForMutationBurst,
    setOpenTabsResultsViewport,
    setOverlayResultsCollapsed,
    filterTabsForOverlay,
    shouldShowOpenTabsForEmptyQuery
  });

  const {
    getWebAppearanceMode,
    setWebAppearanceState,
    getNextWebAppearanceMode,
    setDocumentPipEnabled,
    getCommandMatches,
    isSlashCommandInput,
    getCommandMatch,
    buildCommandSuggestion,
    updateModeBadge,
    getNextThemeMode,
    isModeCommand,
    buildModeSuggestion
  } = PANEL_SLASH_COMMANDS.createSlashCommands({
    overlayThemeChoice,
    documentPipEnabledAtOpen: documentPipSupported && openOptions.documentPipEnabled,
    elements,
    overlayMediaQuery,
    t,
    formatMessage,
    updateInputRightPadding,
    detectPageTheme
  });

  const {
    quickNavigation,
    getDirectUrlSuggestion,
    updateSearchSuggestions,
    clearSearchSuggestions
  } = PANEL_SUGGESTION_SOURCES.createSuggestionSources({
    modeActions,
    overlayThemeChoice,
    lastRender,
    overlayTabs,
    elements,
    prioritizeCurrentPageMatch: openOptions.prioritizeCurrentPageMatch,
    settings,
    siteSearchRunner,
    searchMatching,
    searchResults,
    searchMode,
    searchAutocomplete,
    searchQuery,
    favicons: faviconRuntime,
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
    searchEngine,
    getCommandMatches,
    buildModeSuggestion,
    buildCommandSuggestion,
    isCurrentOverlayTabUrl,
    siteSearchCatalog,
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
    commitSuggestionsNaturalHeightAfterRender,
    suggestionSource,
    shouldShowOpenTabsForEmptyQuery,
    requestTabsAndRender,
    clearDefaultOpenTabsSuggestions
  });

  const {
    updatePendingSearchSuggestions,
    requestOverlaySearchSuggestions
  } = PANEL_REMOTE_SUGGESTIONS.createRemoteSuggestions({
    lastRender,
    elements,
    settings,
    suggestionSource,
    searchResults,
    searchMode,
    searchQuery,
    updateSearchSuggestions,
    isSlashCommandInput,
    getDirectUrlSuggestion
  });

  const {
    cancelPendingOpenTabsPrefixEntry,
    activateOpenTabsSearchMode,
    clearOpenTabsSearchMode
  } = PANEL_SEARCH_MODES.createSearchModes({
    elements,
    defaultTheme,
    modeActions,
    searchMode,
    searchAutocomplete,
    searchQuery,
    t,
    suggestionSource,
    clearSearchSuggestions,
    renderCachedTabsForOverlay,
    requestTabsAndRender,
    isSlashCommandInput,
    updateSearchSuggestions,
    requestOverlaySearchSuggestions
  });

  const modeMenu = new SearchModeMenu({
    settings: settings.store,
    locale,
    catalog: siteSearchCatalog,
    engine: searchEngine,
    iconCache: siteSearchIconCache,
    order: menuOrder,
    mode: searchMode,
    actions: modeActions,
    surface: {
      getInput: () => elements.searchInput,
      getModeController: () => elements.inputModeController,
      getPageProvider: (providers) => SearchSiteSearchMatching.findSiteSearchProviderForPageUrl(
        openOptions.currentTabUrl,
        providers
      ),
      beforeDoubleTab: () => {
        cancelPendingOpenTabsPrefixEntry();
      },
      getProviderIcon: getPageRenderableProviderIcon,
      // The open tabs lead the browser content and do not move.
      getOwnItem: (localGroup) => ({
        id: 'openTabs',
        kind: 'openTabs',
        label: t('search_open_tabs_only_entry', '搜索已打开标签页'),
        searchTerms: ['open tabs', 'tabs', 'browser'],
        group: localGroup,
        groupKey: 'local',
        orderList: 'pinned',
        iconName: 'ri-window-line',
        menuIconName: 'browser',
        active: searchMode.openTabs
      }),
      selectOwnItem: (item, rawQuery) => {
        if (item.kind !== 'openTabs') {
          return false;
        }
        activateOpenTabsSearchMode({ deferResults: true });
        modeActions.restoreSearchModeQuery(rawQuery);
        return true;
      }
    }
  });

  return {
    activateOpenTabsSearchMode,
    clearDefaultOpenTabsSuggestions,
    clearOpenTabsSearchMode,
    clearSearchSuggestions,
    clearSiteSearchTabHint,
    documentPipSupported,
    getCommandMatch,
    getDirectUrlSuggestion,
    getNextThemeMode,
    getNextWebAppearanceMode,
    getWebAppearanceMode,
    isModeCommand,
    isSlashCommandInput,
    modeActions,
    modeMenu,
    quickNavigation,
    renderCachedTabsOrRequest,
    renderTabSuggestions,
    requestOverlaySearchSuggestions,
    requestTabsAndRender,
    rowEvents,
    scrollSelectedSuggestionIntoView,
    setDocumentPipEnabled,
    setInputScopedStyle,
    setSiteSearchTabHint,
    setWebAppearanceState,
    shouldShowOpenTabsForEmptyQuery,
    syncOpenTabsScrollbarGutter,
    syncSearchModeMenuResultOffset,
    updateModeBadge,
    updatePendingSearchSuggestions,
    updateSearchSuggestions
  };
}

type SuggestionsFeature = ReturnType<typeof createSuggestionsFeature>;

export { createSuggestionsFeature };
export type { SuggestionsFeature };
