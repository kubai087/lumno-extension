import { buildTheme, createDefaultTheme, createUrlHighlightTheme, defaultAccentColor } from '../shared/favicon/favicon-theme';
import { parseCssColor, rgbToCss } from '../domain/color';
import * as OVERLAY_FONT_FACES from '../shared/overlay-font-faces';
import * as LumnoShortcutFaviconStore from '../platform/shortcut-favicon-store';
import * as AGGREGATE_SEARCH_STORE from '../domain/search/aggregate-search-store';
import * as LumnoImeKeyGuard from '../domain/search/ime-key-guard';
import * as SEARCH_INPUT_HISTORY from '../domain/search/search-input-history';
import * as SEARCH_INPUT_MODE from '../shared/search/search-input-mode';
import * as SUGGESTION_INPUT_PREVIEW from '../domain/search/suggestion-input-preview';
import * as SUGGESTION_NAVIGATION from '../shared/search/suggestion-navigation';
import * as SETTINGS from '../domain/settings';
import * as LumnoCursorTooltip from '../shared/ui/cursor-tooltip';
import { SiteSearchIconCache } from '../shared/search/site-search-icon-cache';
import * as OVERLAY_TOAST from '../shared/ui/toast';
import { createToastStyleGate } from '../shared/ui/toast-style-gate';
import * as LumnoTooltip from '../shared/ui/tooltip';
import * as LumnoOverlayFaviconView from './favicon-view';
import * as OVERLAY_KEYBOARD from './keyboard';
import { createFullscreenEscapeLock } from '../shared/ui/fullscreen-escape-lock';
import * as LumnoOverlayLifecycle from './lifecycle';
import * as OVERLAY_NOTICES from './notices';
import * as PANEL_COPY_ACTIONS from './panel/copy-actions';
import * as PANEL_ENTRY_MOTION from './panel/entry-motion';
import * as PANEL_FAVICON_POLICY from './panel/favicon-policy';
import * as PANEL_PAGE_GUARDS from './panel/page-guards';
import * as PANEL_PANEL_KEYS from './panel/panel-keys';
import * as PANEL_PANEL_LANGUAGE from './panel/panel-language';
import * as PANEL_PANEL_NOTICES from './panel/panel-notices';
import * as PANEL_PANEL_SESSION from './panel/panel-session';
import * as PANEL_PANEL_THEME from './panel/panel-theme';
import * as PANEL_REMOTE_SUGGESTIONS from './panel/remote-suggestions';
import * as PANEL_RESULT_ACTIVATION from './panel/result-activation';
import * as PANEL_RESULTS_LAYOUT from './panel/results-layout';
import * as PANEL_SEARCH_INPUT_EVENTS from './panel/search-input-events';
import * as PANEL_SEARCH_MODES from './panel/search-modes';
import * as PANEL_SETTINGS_SYNC from './panel/settings-sync';
import { OverlayPanelElements } from './panel/panel-elements';
import { OpenTabs } from '../shared/search-panel/open-tabs';
import { OverlayNotices } from './panel/overlay-notices';
import { LastRender } from './panel/last-render';
import { OverlayThemeMode } from './panel/overlay-theme-mode';
import * as PANEL_SITE_SEARCH_PROVIDERS from './panel/site-search-providers';
import * as PANEL_SLASH_COMMANDS from './panel/slash-commands';
import * as PANEL_COMMAND_ACTIONS from './panel/command-actions';
import * as PANEL_ROW_ACTIONS from './panel/row-actions';
import * as PANEL_SUGGESTION_SOURCES from './panel/suggestion-sources';
import * as PANEL_SUGGESTION_THEMES from './panel/suggestion-themes';
import * as PANEL_SUGGESTIONS_RENDER from './panel/suggestions-render';
import * as PANEL_TAB_MATCHING from './panel/tab-matching';
import * as OVERLAY_CONTEXT from './overlay-context';
import { TAB_SWITCHER_HOST_ID } from '../shared/tab-switcher/host';
import type { OverlaySizePreset } from './lifecycle';
import type { ThemeMode } from '../domain/settings/appearance';
import type { SuggestionElement } from '../shared/react/search/suggestion-list/types';
import type { NumberShortcutOptions } from '../shared/search/suggestion-navigation';
import * as LumnoOverlayRuntime from './runtime';
import * as LumnoOverlaySiteFixes from './site-fixes';
import * as LumnoMessaging from '../platform/messaging';
import { isOverlayOpenState, setOverlayOpenState } from '../platform/content-registry';
import { getOverlayShellApi } from './react/shell';
import { createSearchInput } from '../shared/react/search-input';
import { SiteSearchCatalog } from '../shared/search-panel/site-search/catalog';
import { DefaultSearchEngine } from '../shared/search-panel/default-engine';
import { SurfaceLocale, getSystemLocale } from '../shared/i18n/surface-locale';
import { loadExtensionLocaleMessages } from '../shared/i18n/locale-messages';
import { themeColorCache, themeHostCache } from '../shared/favicon/theme-caches';
import {
  searchInputHistory,
  searchSourceOrder,
  siteSearchIconCache as siteSearchIconCacheSetting
} from '../domain/settings/search';
import { createSettingPort } from '../platform/settings-store';
import { createOverlaySettings } from './overlay-settings';
import * as FaviconDecisionLog from '../domain/favicon/decision-log';
import * as FaviconHostPolicy from '../domain/favicon/host-policy';
import * as BundledIcons from '../domain/favicon/shortcut-favicon/bundled-icons';
import { overlaySizeMode, overlayWidth } from '../domain/settings/overlay-panel';
import { numberShortcutInstantEnabled } from '../domain/settings/search';
import { SearchQuery } from '../shared/search-panel/search-query';
import { SuggestionSource } from '../shared/search-panel/suggestion-source';
import { SuggestionModifiers } from '../shared/search-panel/suggestion-modifiers';
import { createColorScheme } from '../shared/ui/color-scheme';
import { SiteSearchRunner } from '../shared/search-panel/site-search/runner';
import { SearchModeMenu } from '../shared/search-panel/mode-menu';
import { SearchModeActions } from '../shared/search-panel/mode-actions';
import { SearchModeMenuOrder } from '../shared/search-panel/mode-menu-order';
import { SearchMatching } from '../shared/search-panel/matching';
import { SearchResults } from '../shared/search-panel/search-results';
import { SearchMode } from '../shared/search-panel/search-mode';
import { SearchAutocomplete } from '../shared/search-panel/autocomplete';
import type { InputModeProvider } from '../shared/search/input-mode/types';
import type { OverlaySuggestion } from './panel/types';
import { isAggregateSearchProvider } from '../domain/search/aggregate-search-store';
import { getSiteSearchDisplayName, getSiteSearchPrefixText } from '../shared/search-panel/labels';
import { OVERLAY_HOST_ID, OVERLAY_PANEL_ID } from '../domain/injected-commands';
import * as SearchSiteSearchMatching from '../domain/search/utils/site-search-matching';

// Favicon data and preloaded icons the overlay resolved, kept across its
// openings in this page.
const faviconDataCache = new Map<string, string>();
const faviconDataPending = new Map<string, Promise<string | null>>();
const iconPreloadCache = new Map<string, HTMLImageElement>();

// Opens or closes the search overlay with the window's tabs and the context
// it was opened with, both read as untrusted.
let pageMenuOrder: SearchModeMenuOrder | null = null;

function toggleSearchOverlay(requestedTabs: unknown, overlayContext: unknown): void {
  const overlayLifecycle = LumnoOverlayLifecycle;
  const overlayRuntime = LumnoOverlayRuntime;
  // Set by the overlay's React bundle, which the worker injects first.
  const overlayShell = getOverlayShellApi();
  if (!overlayShell) {
    console.warn('Lumno: overlay shell not available.');
    return;
  }
  const openOptions = OVERLAY_CONTEXT.readOverlayOpenOptions(overlayContext, Date.now());
  const initialOverlayTabs = OVERLAY_CONTEXT.readOverlayTabs(requestedTabs);
  const requestedTabZoomFactor = openOptions.tabZoomFactor;
  const initialPrefillQuery = openOptions.prefillQuery;
  const initialContextTabId = openOptions.currentTabId;
  const ensureOverlayOpen = openOptions.ensureOpen;
  const initialOverlayOpenStartedAt = openOptions.openedAt;
  const initialLoadingSession = openOptions.loadingSession;
  const shouldIgnoreTabZoomCompensation = OVERLAY_CONTEXT.isLocalFileLikeUrl(openOptions.currentTabUrl);
  // Web clip needs Document Picture-in-Picture, which Firefox does not ship.
  const documentPipSupported = 'documentPictureInPicture' in window;
  // Warm local icon lookup immediately, but never put it on the overlay reveal path.
  const siteSearchIconCache = new SiteSearchIconCache(LumnoShortcutFaviconStore.createSiteSearchIconStore({
    chromeApi: chrome,
    storageArea: chrome && chrome.storage ? chrome.storage.local : null
  }));
  void siteSearchIconCache.load();

  // The session's parts that hold what it shows and lists.
  const elements = new OverlayPanelElements();
  const notices = new OverlayNotices();
  const overlayTabs = new OpenTabs(initialOverlayTabs, initialContextTabId);
  const lastRender = new LastRender();
  const overlayThemeChoice = new OverlayThemeMode();
  const settings = createOverlaySettings(chrome);
  // A custom width replaces the size's own; the size keeps its height cap
  // and content scale.
  function getOverlaySizePreset(mode: unknown): OverlaySizePreset {
    const preset = SETTINGS.getOverlaySizePreset(mode);
    const customWidth = SETTINGS.overlayWidth.parse(settings.get(overlayWidth));
    return customWidth ? { ...preset, width: customWidth } : preset;
  }

  // Teardown steps owned by this invocation's overlay session. Controllers
  // created deep inside the mount block register here so removeOverlay can
  // release them without stashing them on DOM expandos.
  const overlaySessionCleanups = overlayLifecycle.createSessionCleanupRegistry();
  const {
    applyOverlayInputExtensionIsolation,
    applyNoTranslate,
    applyNoTranslateDeep,
    stopOverlayAntiTranslateObserver,
    pauseOverlayAntiTranslateObserverForScroll,
    pauseOverlayAntiTranslateObserverForMutationBurst,
    startOverlayAntiTranslateObserver
  } = PANEL_PAGE_GUARDS.createPageGuards({
    window
  });

  const overlayNoticeLayer = OVERLAY_NOTICES.createNoticeLayer(window, {
    getUpdateNotice: () => notices.update,
    getGraphicsNotice: () => notices.graphics,
    getEngagementNotice: () => notices.engagement,
    getSizePreset: () => getOverlaySizePreset(settings.get(overlaySizeMode)),
    decorate: (element) => applyNoTranslateDeep(element)
  });
  const overlayViewportSizeSync = overlayLifecycle.createViewportSizeSync(window, {
    getSizePreset: () => getOverlaySizePreset(settings.get(overlaySizeMode)),
    getRequestedTabZoomFactor: () => requestedTabZoomFactor,
    shouldIgnoreTabZoomCompensation: () => shouldIgnoreTabZoomCompensation
  });
  const imeKeyGuard = LumnoImeKeyGuard.createImeKeyGuard();
  const suggestionInputPreview = SUGGESTION_INPUT_PREVIEW.createSuggestionInputPreview();
  const overlayMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const defaultTheme = createDefaultTheme();
  const urlHighlightTheme = createUrlHighlightTheme();
  const prioritizeCurrentPageMatch = openOptions.prioritizeCurrentPageMatch;
  const currentTabPinned = openOptions.currentTabPinned;
  const initialContextTabUrl = openOptions.currentTabUrl;
  const {
    shouldSwitchMatchedTabSuggestion,
    getUrlDisplay,
    filterTabsForOverlay,
    getMatchedOpenTabIdForSuggestion,
    isCurrentOverlayTabUrl
  } = PANEL_TAB_MATCHING.createTabMatching({
    settings,
    overlayTabs,
    initialContextTabUrl,
    prioritizeCurrentPageMatch
  });

  // They follow storage only once the panel mounts, below.
  const locale = new SurfaceLocale(settings.store, loadExtensionLocaleMessages);
  const { t, formatMessage } = locale;
  const searchQuery = new SearchQuery();
  const suggestionModifiers = new SuggestionModifiers(settings.store);
  const colorScheme = createColorScheme();
  const siteSearchRunner = new SiteSearchRunner({
    t: (key, fallback) => locale.t(key, fallback),
    showToast: (message, isError) => showOverlayToast(message, isError),
    getHelpCenterLocale: () => locale.store.getSnapshot().locale,
    openInCurrentTab: (url) => LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'createTab', url, disposition: 'currentTab' })
  });
  // The mode menu's moves can be undone for as long as the page lives,
  // across panel openings.
  if (!pageMenuOrder) {
    pageMenuOrder = new SearchModeMenuOrder(settings.store);
  }
  const menuOrder = pageMenuOrder;
  const searchMatching = new SearchMatching({
    settings: settings.store,
    getUrlDisplay: (url) => getUrlDisplay(url)
  });
  const searchResults = new SearchResults<OverlaySuggestion>();
  const suggestionSource = new SuggestionSource(searchQuery, searchResults);
  const searchMode = new SearchMode<InputModeProvider>();
  const searchAutocomplete = new SearchAutocomplete({
    settings: settings.store,
    query: searchQuery,
    getInput: () => elements.searchInput,
    preview: suggestionInputPreview,
    isModeActive: () => Boolean(searchMode.site || searchMode.local),
    getUrlDisplay: (url) => getUrlDisplay(url)
  });
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
      getThemeForProvider: (provider) => getThemeForProvider(provider),
      beforeEnterSite: () => cancelPendingOpenTabsPrefixEntry()
    }
  });
  const searchEngine = new DefaultSearchEngine(settings.store);
  const siteSearchCatalog = new SiteSearchCatalog(settings.store, searchEngine, openOptions.siteSearchProviders);
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
        initialContextTabUrl,
        providers
      ),
      beforeDoubleTab: () => {
        cancelPendingOpenTabsPrefixEntry();
      },
      getProviderIcon: (provider) => getPageRenderableProviderIcon(provider),
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

  const logOverlayFaviconDecision = FaviconDecisionLog.createFaviconDecisionLogger({ surface: 'overlay' });

  const suggestionItems: SuggestionElement[] = [];

  const numberShortcutOptions: NumberShortcutOptions = {
    onHoldStart: function() {
      showOverlayToast(t(
        'search_number_jump_release_hint',
        'Release to show numbers'
      ), false, { duration: 0 });
    },
    onHoldEnd: () => hideOverlayToast(),
    instantActive: () => settings.get(numberShortcutInstantEnabled)
  };

  const overlayFrameTracker = overlayLifecycle.createFrameTracker(window);

  const setInputScopedStyle = (element: HTMLElement | null, property: string, value: string): void => {
    if (!element) {
      return;
    }
    element.style.setProperty(property, value);
  };

  const {
    getOverlayStrictFaviconReason,
    isOverlayEnhancedFaviconFetchEnabled,
    filterOverlayBlacklistedSuggestions,
    normalizeSearchResultDisplayLimit,
    limitOverlaySuggestionsForDisplay,
    isLocalNetworkHost,
    shouldBlockOverlayFaviconForHost,
    getOverlayFaviconUrlResolver,
    isBlockedOverlayFaviconUrl,
    isLocalNetworkInput,
    getExtensionFaviconUrl,
    getGstaticFaviconUrl,
    getChromeFaviconUrl,
    getPageFaviconCandidateUrl,
    getHostFromUrl,
    isFaviconProxyUrl,
    isChromeMonogramFaviconUrl
  } = PANEL_FAVICON_POLICY.createFaviconPolicy({
    settings,
    logOverlayFaviconDecision
  });

  const faviconRuntime = LumnoOverlayFaviconView.createOverlayFaviconViewRuntime({
    document,
    windowObj: window,
    chromeApi: chrome,
    getHostFromUrl,
    getExtensionFaviconUrl,
    getGstaticFaviconUrl,
    getChromeFaviconUrl,
    shouldBlockFaviconForHost: shouldBlockOverlayFaviconForHost,
    shouldAvoidDirectFaviconForHost: FaviconHostPolicy.shouldAvoidDirectFaviconForHost,
    shouldBlockOverlayFaviconForHost,
    isEnhancedFaviconFetchEnabled: isOverlayEnhancedFaviconFetchEnabled,
    getStrictFaviconReason: getOverlayStrictFaviconReason,
    logFaviconDecision: logOverlayFaviconDecision,
    isBlockedLocalFaviconUrl: isBlockedOverlayFaviconUrl,
    isFaviconProxyUrl,
    isChromeMonogramFaviconUrl,
    faviconDataCache,
    faviconDataPending,
    iconPreloadCache,
    getOverlayPanel: () => elements.overlay,
    getSuggestionRowsRoot: () => elements.suggestionsContainer,
    rerenderReplacedFaviconRows,
    hasThemeForHost: (hostKey) => Boolean(hostKey && themeHostCache.has(hostKey))
  });

  const {
    shouldSkipOverlayEntryMotion,
    shouldSkipOverlayEntryMotionForSlowStartup,
    getOverlayEnterAnimationRevealTransform,
    clearOverlayPanelEnterCleanup,
    finishOverlayPanelEnterAnimation,
    applyOverlayEnterAnimationInitialState,
    playOverlayPanelEnterAnimation,
    clearOverlayEnterAnimationFrames
  } = PANEL_ENTRY_MOTION.createEntryMotion({
    settings,
    initialOverlayOpenStartedAt,
    overlayFrameTracker
  });

  const {
    attachKeyRouter,
    attachRevealGate,
    isLoadingSessionTracked,
    replayWithoutLoadingNotification,
    getOverlayMountHost,
    setOverlayStoredContextToken,
    setOverlayMountVisibility,
    isStaleOverlay,
    createOverlayWheelIsolationHandler,
    notifyOverlayLoadingSession,
    removeOverlay,
    closeOverlayWithMotion,
    destroyExistingOverlaySession
  } = PANEL_PANEL_SESSION.createPanelSession({
    notices,
    elements,
    loadingSessionTrackingActive: openOptions.loadingSessionTracked,
    overlayViewportSizeSync,
    overlayNoticeLayer,
    overlaySessionCleanups,
    settings,
    pauseOverlayAntiTranslateObserverForScroll,
    clearOverlayEnterAnimationFrames,
    clearOverlayPanelEnterCleanup,
    suggestionSource,
    stopOverlayAntiTranslateObserver,
    overlayShell,
    overlayLifecycle
  });

  const {
    resultActivation,
    finishOverlayResultActivation,
    getOpenDisposition
  } = PANEL_RESULT_ACTIVATION.createResultActivation({
    elements,
    currentTabPinned,
    settings,
    removeOverlay
  });

  const {
    events: panelThemeEvents,
    getHighlightColors,
    detectPageTheme,
    invalidatePageTheme,
    syncOverlayPageThemeObservation,
    applyOverlayFontFamily,
    applyOverlayThemeVariables,
    isOverlayDarkMode,
    getThemeForMode,
    getHoverColors,
    getNeutralHoverActionColors
  } = PANEL_PANEL_THEME.createPanelTheme({
    overlayThemeChoice,
    overlaySessionCleanups,
    elements,
    defaultTheme,
    overlayMediaQuery,
    settings,
    parseCssColor
  });

  const {
    openSiteSearchProviderQuery,
    getProviderIcon,
    toPageRenderableIconUrl,
    getPageRenderableProviderIcon
  } = PANEL_SITE_SEARCH_PROVIDERS.createSiteSearchProviders({
    siteSearchRunner,
    favicons: faviconRuntime,
    resultActivation,
    finishOverlayResultActivation,
    getOverlayFaviconUrlResolver,
    siteSearchIconCache,
    faviconDataCache
  });

  const {
    getBrandAccentForUrl,
    getProviderThemeHost,
    getThemeForProvider,
    getThemeForSuggestion,
    getImmediateThemeForSuggestion,
    applyThemeVariables,
    applyMarkVariables,
    preloadThemeFromFavicon
  } = PANEL_SUGGESTION_THEMES.createSuggestionThemes({
    defaultTheme,
    favicons: faviconRuntime,
    getHostFromUrl,
    isFaviconProxyUrl,
    themeColorCache,
    themeHostCache,
    getOverlayFaviconUrlResolver,
    buildTheme,
    defaultAccentColor,
    shouldBlockOverlayFaviconForHost,
    faviconDataCache,
    getProviderIcon,
    getThemeForMode
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
    prioritizeCurrentPageMatch,
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
    applyOverlayTheme,
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

  const {
    openOverlayCommunityQrDialog,
    openDocumentPipPickerFromOverlay,
    applyThemeModeChange,
    applyWebAppearanceMode,
    applyNextWebAppearanceMode
  } = PANEL_COMMAND_ACTIONS.createCommandActions({
    removeOverlay,
    t,
    isModeCommand,
    isSlashCommandInput,
    updateModeBadge,
    getWebAppearanceMode,
    setWebAppearanceState,
    getNextWebAppearanceMode,
    settings,
    applyOverlayTheme,
    updateSearchSuggestions,
    elements
  });

  const {
    isApplyingInputHistory,
    handleTabKey,
    handleSearchInputKeydown,
    getSuggestionNavigationKey,
    handleOverlayKeydown,
    handleOverlayKeyup,
    isSearchInputActive
  } = PANEL_PANEL_KEYS.createPanelKeys({
    shouldSwitchMatchedTabSuggestion,
    overlayThemeChoice,
    elements,
    suggestionInputPreview,
    settings,
    suggestionModifiers,
    modeActions,
    searchMatching,
    searchResults,
    searchMode,
    searchAutocomplete,
    searchQuery,
    modeMenu,
    activateOpenTabsSearchMode,
    siteSearchCatalog,
    requestOverlaySearchSuggestions,
    clearSearchSuggestions,
    clearOpenTabsSearchMode,
    imeKeyGuard,
    suggestionItems,
    numberShortcutOptions,
    removeOverlay,
    closeOverlayWithMotion,
    scrollSelectedSuggestionIntoView,
    getCommandMatch,
    applyThemeModeChange,
    getNextThemeMode,
    applyWebAppearanceMode,
    applyNextWebAppearanceMode,
    openDocumentPipPickerFromOverlay,
    isModeCommand,
    openOverlayCommunityQrDialog,
    openSiteSearchProviderQuery,
    finishOverlayResultActivation,
    resultActivation,
    isSlashCommandInput,
    updateSearchSuggestions,
    quickNavigation
  });

  const {
    syncLiveSearchInputFromEvent,
    syncSearchTriggerHintFromInput,
    handleSearchInputCompositionStart,
    handleSearchInputCompositionEnd,
    handleSearchInputEvent
  } = PANEL_SEARCH_INPUT_EVENTS.createSearchInputEvents({
    isApplyingInputHistory,
    notices,
    elements,
    suggestionInputPreview,
    imeKeyGuard,
    searchMatching,
    locale,
    searchResults,
    searchMode,
    searchAutocomplete,
    searchQuery,
    siteSearchCatalog,
    applyNoTranslate,
    clearSiteSearchTabHint,
    isSlashCommandInput,
    setSiteSearchTabHint,
    suggestionSource,
    notifyOverlayLoadingSession,
    updateModeBadge,
    updateSearchSuggestions,
    renderCachedTabsOrRequest,
    getDirectUrlSuggestion,
    updatePendingSearchSuggestions,
    requestOverlaySearchSuggestions,
    clearSearchSuggestions
  });

  const {
    getDefaultPlaceholderText,
    applyOverlayCjkFontFace,
    applyLanguageStrings
  } = PANEL_PANEL_LANGUAGE.createPanelLanguage({
    notices,
    elements,
    defaultTheme,
    modeActions,
    searchResults,
    searchMode,
    searchQuery,
    locale,
    updateModeBadge,
    getThemeForProvider,
    updateSearchSuggestions,
    requestTabsAndRender,
    applyInputActionLabels
  });


  // Follows the system's scheme while the theme follows the system.
  let overlayThemeMediaListener: (() => void) | null = null;
  // A page that changed its own theme is followed at once.
  panelThemeEvents.on('pageThemeChanged', () => applyOverlayTheme(overlayThemeChoice.mode));

  function applyOverlayTheme(mode: ThemeMode): void {
    overlayThemeChoice.set(mode);
    const previousResolvedTheme = elements.overlay ? elements.overlay.getAttribute('data-theme') : '';
    applyOverlayThemeVariables(mode);
    overlayNoticeLayer.sync(elements.overlay);
    const nextResolvedTheme = elements.overlay ? elements.overlay.getAttribute('data-theme') : '';
    colorScheme.setState({ dark: nextResolvedTheme === 'dark' });
    updateModeBadge(elements.searchInput ? elements.searchInput.value : '');
    if (previousResolvedTheme !== nextResolvedTheme) {
      refreshOverlayThemeAwareFavicons();
    }
    if (overlayToastElement) {
      overlayToastElement.setAttribute('data-theme', nextResolvedTheme || 'light');
    }
    syncOverlayPageThemeObservation();
    if (mode === 'system') {
      if (!overlayThemeMediaListener) {
        const listener = () => {
          if (overlayThemeChoice.mode === 'system') {
            // Re-apply in full: updating only the panel's variables would leave
            // the rows on the previous scheme's colors.
            // A page that follows the system theme may have switched too.
            invalidatePageTheme();
            applyOverlayTheme('system');
          }
        };
        overlayThemeMediaListener = listener;
        overlayMediaQuery.addEventListener('change', listener);
      }
      return;
    }
    stopFollowingSystemTheme();
  }

  function stopFollowingSystemTheme(): void {
    if (overlayThemeMediaListener) {
      overlayMediaQuery.removeEventListener('change', overlayThemeMediaListener);
      overlayThemeMediaListener = null;
    }
  }

  const overlaySiteFixes = LumnoOverlaySiteFixes;
  const addOverlaySessionCleanup = overlaySessionCleanups.add;
  addOverlaySessionCleanup(stopFollowingSystemTheme);

  const OVERLAY_MODE_MENU_DOUBLE_TAB_DURATION_MS = 700;
  const RI_CSS_URL = overlayRuntime.getRuntimeUrl(chrome, 'assets/remixicon/fonts/remixicon.css');
  const SEARCH_INPUT_CSS_URL = overlayRuntime.getRuntimeUrl(chrome, 'src/shared/search/search-input.css');
  const FEATURE_HINTS_CSS_URL = overlayRuntime.getRuntimeUrl(chrome, 'src/shared/ui/feature-hints.css');
  const TOOLTIP_CSS_URL = overlayRuntime.getRuntimeUrl(chrome, 'src/shared/ui/tooltip.css');
  const CURSOR_TOOLTIP_CSS_URL = overlayRuntime.getRuntimeUrl(chrome, 'src/shared/ui/cursor-tooltip.css');
  const TOAST_CSS_URL = overlayRuntime.getRuntimeUrl(chrome, 'src/shared/ui/toast.css');
  const EXTERNAL_LINK_ICON_CSS_URL = overlayRuntime.getRuntimeUrl(chrome, 'src/shared/ui/external-link-icon.css');
  const OVERLAY_SUGGESTIONS_CSS_URL = overlayRuntime.getRuntimeUrl(chrome, 'src/overlay/suggestions-view.css');

  faviconRuntime.onFaviconData(preloadThemeFromFavicon);

  // The search icon opens the scope panel, except while a scope is set.
  let searchScopeIconEnabled = true;

  // The overlay's faces on the host document (see overlay-font-faces.ts),
  // unless the page registered them while it loaded. The icon class rules
  // load inside the overlay's shadow root (remixicon.css, re-pointed at the
  // scoped face by suggestions-view.css).
  function ensureOverlayFontFaces() {
    const styleId = '_x_extension_overlay_font_faces_2026_unique_';
    const host = document.head || document.documentElement;
    if (!host || document.getElementById(styleId) ||
        OVERLAY_FONT_FACES.hasEarlyOverlayFontFaces(window)) {
      return;
    }
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = OVERLAY_FONT_FACES.buildOverlayFontFaceCss(
      (assetPath) => overlayRuntime.getRuntimeUrl(chrome, assetPath)
    );
    host.appendChild(style);
    // Every face added to a page that has already laid out restyles and
    // relays out the whole page, so the CJK face joins in the same task,
    // guessed from the browser language. The language setting changes it
    // later only when it calls for another script.
    applyOverlayCjkFontFace(getSystemLocale());
  }

  function startOverlayViewportSizeSync(overlayElement: HTMLElement): void {
    overlayViewportSizeSync.start(overlayElement);
    overlayNoticeLayer.sync(overlayElement);
  }

  // Check if the overlay already exists
  elements.holdExisting(overlayShell.findOverlayPanel(document, {
    hostId: OVERLAY_HOST_ID,
    id: OVERLAY_PANEL_ID
  }));

  if (elements.overlay) {
    // A press while the overlay is still playing its exit reopens it: the
    // closing session is dropped at once and a fresh one mounts below.
    const shouldReplaceClosingOverlay =
      elements.overlay.getAttribute('data-lumno-overlay-exit') === 'running';
    const shouldReplaceExistingOverlay = shouldReplaceClosingOverlay ||
      isStaleOverlay(elements.overlay);
    if (ensureOverlayOpen && !shouldReplaceExistingOverlay) {
      setOverlayOpenState(true);
      return;
    }
    destroyExistingOverlaySession(elements.overlay, {
      preserveLoadingIntent: shouldReplaceExistingOverlay,
      animateExit: !shouldReplaceExistingOverlay
    });
    if (!shouldReplaceExistingOverlay) {
      return;
    }
  }

  // No overlay is open here (an open one has closed above, a stale one is
  // being replaced): create it.
  addOverlaySessionCleanup(locale.follow());
  addOverlaySessionCleanup(searchEngine.follow());
  addOverlaySessionCleanup(siteSearchCatalog.follow());
  // Read the page theme while the page's layout is still settled: the font
  // faces and the overlay host below each invalidate it, and sampling the
  // page after them pays for a full style and layout pass.
  detectPageTheme();
  ensureOverlayFontFaces();
  const initialOverlaySizePreset = getOverlaySizePreset(settings.get(overlaySizeMode));
  const overlayMount = overlayShell.createOverlayMount(document, {
    hostId: OVERLAY_HOST_ID,
    id: OVERLAY_PANEL_ID,
    width: initialOverlaySizePreset.width,
    maxHeightVh: initialOverlaySizePreset.maxHeightVh,
    remixIconCssUrl: RI_CSS_URL,
    searchInputCssUrl: SEARCH_INPUT_CSS_URL,
    featureHintsCssUrl: FEATURE_HINTS_CSS_URL,
    tooltipCssUrl: TOOLTIP_CSS_URL,
    cursorTooltipCssUrl: CURSOR_TOOLTIP_CSS_URL,
    toastCssUrl: TOAST_CSS_URL,
    externalLinkIconCssUrl: EXTERNAL_LINK_ICON_CSS_URL,
    overlaySuggestionsCssUrl: OVERLAY_SUGGESTIONS_CSS_URL
  });
  if (!overlayMount) {
    console.warn('Lumno: overlay mount could not be created.');
    return;
  }
  elements.mountShell(overlayMount);
  const overlayHost = overlayMount.host;
  // The panel's shadow root, which holds its styles.
  const overlayStyleRoot = overlayMount.root;
  setOverlayStoredContextToken(elements.overlay);
  addOverlaySessionCleanup(overlayLifecycle.onSessionDestroyRequest(overlayHost, (options) => {
    if (options.animateExit === true) closeOverlayWithMotion(elements.overlay);
    else removeOverlay(elements.overlay, options);
  }));
  overlayMount.panel.classList.add('x-lumno-search-entry');
  setOverlayMountVisibility(overlayHost, true);
  applyNoTranslate(elements.overlay);

  overlayShell.appendOverlayStyleNodes(document, {
    root: overlayStyleRoot,
    remixIconCssUrl: RI_CSS_URL,
    searchInputCssUrl: SEARCH_INPUT_CSS_URL,
    featureHintsCssUrl: FEATURE_HINTS_CSS_URL,
    tooltipCssUrl: TOOLTIP_CSS_URL,
    cursorTooltipCssUrl: CURSOR_TOOLTIP_CSS_URL,
    toastCssUrl: TOAST_CSS_URL,
    externalLinkIconCssUrl: EXTERNAL_LINK_ICON_CSS_URL,
    overlaySuggestionsCssUrl: OVERLAY_SUGGESTIONS_CSS_URL
  });
  const overlayToastElement = applyNoTranslate(document.createElement('div'));
  overlayToastElement.id = '_x_extension_overlay_toast_2026_unique_';
  overlayToastElement.className = '_x_extension_overlay_toast_2026_unique_ x-lumno-toast';
  overlayToastElement.style.setProperty(
    '--x-lumno-toast-top',
    'max(24px, calc(20vh - 48px))'
  );
  overlayToastElement.style.setProperty('--x-lumno-toast-z-index', '2147483647');
  overlayToastElement.setAttribute('data-show', 'false');
  overlayToastElement.setAttribute('role', 'status');
  overlayToastElement.setAttribute('aria-live', 'polite');
  const overlayToastStylesheet = overlayStyleRoot
    .getElementById('_x_extension_toast_style_2026_unique_');
  const overlayToastStyleGate = createToastStyleGate(
    overlayToastElement,
    {
      windowObj: window,
      stylesheetElement: overlayToastStylesheet
    }
  );
  overlayStyleRoot.appendChild(overlayToastElement);
  const overlayToastController = OVERLAY_TOAST.createToastController(
    overlayToastElement,
    { windowObj: window }
  );
  addOverlaySessionCleanup(() => {
    overlayToastStyleGate.destroy();
    overlayToastController.destroy();
  });

  const {
    hideOverlayToast,
    showOverlayToast,
    copySearchResultUrl
  } = PANEL_COPY_ACTIONS.createCopyActions({
    overlayToastController,
    t
  });

  const overlayRevealGate = overlaySiteFixes.createOverlayRevealGate(window, {
    overlay: overlayMount.panel,
    styleRoot: overlayStyleRoot
  });
  attachRevealGate(overlayRevealGate);

  // The first messages are in before the panel's copy is drawn; later
  // changes redraw it.
  const initialLanguageReady = locale.ready.then(() => {
    applyOverlayCjkFontFace(locale.store.getSnapshot().locale);
  }).catch(() => {});

  const inputParts = createSearchInput({
    portals: overlayMount.portals,
    container: overlayMount.inputContainer,
    styleRoot: overlayStyleRoot,
    placeholder: t('overlay_search_placeholder', t('search_placeholder', getDefaultPlaceholderText())),
    inputId: '_x_extension_search_input_2024_unique_',
    iconId: '_x_extension_search_icon_2024_unique_',
    containerId: '_x_extension_input_container_2024_unique_',
    containerStyleOverrides: {
      height: '56px',
      'min-height': '56px',
      'max-height': '56px',
      'border-radius': 'var(--x-ov-panel-radius, 26px) var(--x-ov-panel-radius, 26px) 0 0',
      'corner-shape': 'superellipse(1.25)',
      overflow: 'visible'
    },
    inputStyleOverrides: {
      height: '56px',
      'min-height': '56px',
      'max-height': '56px',
      'line-height': '1.3',
      'padding-top': '0',
      'padding-bottom': '0',
      'padding-left': '50px',
      'padding-right': '92px'
    },
    iconStyleOverrides: {
      left: '13px'
    },
    rightIconStyleOverrides: {
      '--x-ext-input-right-icon-inset': '13px',
      cursor: 'pointer'
    },
    clearAction: {
      id: '_x_extension_search_clear_2026_unique_',
      ariaLabel: t('search_input_clear', '清空'),
      icon: { name: 'ri-close-line', size: 16 },
      styleOverrides: {
        '--x-ext-input-clear-right': '85px',
        '--x-ext-input-clear-top': '13px'
      }
    },
    secondaryAction: {
      id: '_x_extension_search_close_other_tabs_2026_unique_',
      className: 'x-ov-close-other-tabs',
      ariaLabel: t('overlay_close_other_tabs_tooltip', '关闭其他标签页'),
      icon: { name: 'ri-brush-2-line', size: 16 },
      confirm: {
        getCopy: getCloseOtherTabsConfirmCopy,
        onConfirm: confirmCloseOtherTabs
      }
    },
    modeBadge: {
      id: '_x_extension_mode_badge_2024_unique_',
      className: 'x-lumno-search-input-mode__badge',
      surface: 'overlay',
      visible: false
    },
    showUnderlineWhenEmpty: true
  });
  elements.mountInput(inputParts, SEARCH_INPUT_HISTORY.createSearchInputHistoryController({
    storage: createSettingPort(settings.store, searchInputHistory)
  }));
  applyOverlayInputExtensionIsolation(inputParts.input);
  const rightIcon = inputParts.rightIcon;

  PANEL_PANEL_NOTICES.createPanelNotices({
    openOverlayCommunityQrDialog,
    notices,
    elements,
    portals: overlayMount.portals,
    removeOverlay,
    t,
    getOpenDisposition,
    locale
  });

  PANEL_ROW_ACTIONS.createRowActions({
    rowEvents,
    elements,
    searchQuery,
    modeActions,
    resultActivation,
    finishOverlayResultActivation,
    shouldSwitchMatchedTabSuggestion,
    removeOverlay,
    activateOpenTabsSearchMode,
    openDocumentPipPickerFromOverlay,
    openOverlayCommunityQrDialog,
    applyThemeModeChange,
    applyWebAppearanceMode,
    openSiteSearchProviderQuery,
    copySearchResultUrl,
    updateSearchSuggestions,
    requestOverlaySearchSuggestions
  });

  applyNoTranslate(elements.searchInput);
  applyNoTranslate(elements.inputContainer);
  applyNoTranslate(rightIcon);
  const topActionTooltipController = LumnoTooltip.createController({
    portals: overlayMount.portals,
    documentObj: document,
    windowObj: window,
    id: '_x_extension_top_action_tooltip_2026_unique_',
    appendTo: elements.overlay,
    boundaryElement: elements.overlay,
    positionMode: 'absolute',
    maxWidth: 420,
    decorateElement: applyNoTranslate
  });
  const overlayCursorTooltipController = LumnoCursorTooltip.createController({
    portals: overlayMount.portals,
    documentObj: document,
    windowObj: window,
    id: '_x_extension_overlay_cursor_tooltip_2026_unique_',
    appendTo: elements.overlay,
    boundaryElement: elements.overlay,
    positionMode: 'absolute',
    maxWidth: 520,
    offsetX: 14,
    offsetY: 16,
    decorateElement: applyNoTranslate
  });
  elements.mountTooltips(topActionTooltipController, overlayCursorTooltipController);
  const overlayModeMenuCursorTooltipController = LumnoCursorTooltip.createController({
    portals: overlayMount.portals,
    documentObj: document,
    windowObj: window,
    id: '_x_extension_overlay_mode_menu_cursor_tooltip_2026_unique_',
    appendTo: overlayStyleRoot,
    positionMode: 'fixed',
    maxWidth: 320,
    offsetX: 14,
    offsetY: 16,
    decorateElement: (element) => {
      applyNoTranslate(element);
      element.style.setProperty('--x-extension-tooltip-z-index', '2147483647');
    }
  });
  addOverlaySessionCleanup(() => {
    topActionTooltipController.destroy();
    overlayCursorTooltipController.destroy();
    overlayModeMenuCursorTooltipController.destroy();
  });
  const bindInputActionCursorTooltip = (button: HTMLElement | null, getText: () => string): void => {
    if (!button) {
      return;
    }
    overlayCursorTooltipController.bind(button, getText, {
      boundaryElement: elements.overlay,
      positionMode: 'absolute',
      maxWidth: 420,
      deferHideVisibility: true,
      preserveVisibleOnTargetSwitch: true,
      handoffRoot: elements.inputContainer
    });
  };
  const hideInputActionCursorTooltip = () => {
    overlayCursorTooltipController.hide();
  };
  const searchClearButton = inputParts.clearAction;
  inputParts.setChrome({
    tooltip: { bind: bindInputActionCursorTooltip, hide: hideInputActionCursorTooltip }
  });

  const suggestionsContainer = overlayMount.suggestionsContainer;
  elements.mountResults(suggestionsContainer);
  applyNoTranslate(suggestionsContainer);
  suggestionsContainer.addEventListener('wheel', function(event) {
    SUGGESTION_NAVIGATION.preventNumberShortcutWheel(event, suggestionsContainer);
  }, { passive: false });
  overlayMount.panel.addEventListener('pointerdown', function() {
    SUGGESTION_NAVIGATION.cancelNumberShortcuts(suggestionsContainer);
  }, true);
  suggestionsContainer.addEventListener('animationend', (event) => {
    if (event.animationName !== '_x_ov_scope_result_enter_2026_unique_') {
      return;
    }
    suggestionsContainer.setAttribute('data-scope-result-enter', 'done');
  });
  const wheelIsolationHandler = createOverlayWheelIsolationHandler(overlayMount.panel);
  overlayMount.panel.addEventListener('wheel', wheelIsolationHandler, { passive: false, capture: true });
  addOverlaySessionCleanup(() => overlayMount.panel.removeEventListener('wheel', wheelIsolationHandler, true));

  initialLanguageReady.then(() => {
    if (elements.overlay && elements.overlay.isConnected) {
      applyLanguageStrings({ refreshResults: false });
    }
    let shownMessages = locale.store.getSnapshot().messages;
    locale.store.subscribe(() => {
      const { messages, locale: shownLocale } = locale.store.getSnapshot();
      if (messages !== shownMessages) {
        shownMessages = messages;
        applyOverlayCjkFontFace(shownLocale);
        applyLanguageStrings();
      }
    });
  });

  function activateSearchScopeIcon(): void {
    if (elements.inputModeController) {
      elements.inputModeController.resetModeMenuDoubleTab();
    }
    void modeMenu.openFromDoubleTab();
  }
  function setSearchScopeIconEnabled(enabled: boolean): void {
    searchScopeIconEnabled = enabled;
    if (!enabled) {
      hideInputActionCursorTooltip();
    }
    applyInputActionLabels();
  }
  // The input's buttons' names and tooltips in the current language.
  function applyInputActionLabels(): void {
    if (!elements.inputParts) {
      return;
    }
    elements.inputParts.setChrome({
      rightIconLabel: formatMessage('command_settings', '打开设置', { name: 'Lumno' }),
      secondaryLabel: t('overlay_close_other_tabs_tooltip', '关闭其他标签页'),
      clearLabel: t('search_input_clear', '清空'),
      scopeAction: {
        enabled: searchScopeIconEnabled,
        label: t('shortcut_reference_search_open_scope_menu_title', '打开搜索范围面板'),
        onActivate: activateSearchScopeIcon
      }
    });
  }
  applyInputActionLabels();

  if (rightIcon) {
    rightIcon.addEventListener('click', function(event) {
      event.preventDefault();
      event.stopPropagation();
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'openOptionsPage' });
      removeOverlay(elements.overlay);
    });
  }
  if (searchClearButton) {
    inputParts.input.addEventListener('input', () => {
      if (elements.inputModeController) {
        elements.inputModeController.updateLayout();
      }
    });
  }

  function getCloseOtherTabsConfirmCopy() {
    return {
      message: t('overlay_close_other_tabs_confirm', '关闭此窗口中的其他标签页？置顶和分组内的标签页会保留。'),
      messageKey: 'overlay_close_other_tabs_confirm',
      confirmLabel: t('overlay_close_other_tabs_confirm_button', '关闭'),
      confirmLabelKey: 'overlay_close_other_tabs_confirm_button'
    };
  }

  function confirmCloseOtherTabs(event: MouseEvent): void {
    if (event.isTrusted !== true) {
      return;
    }
    // The confirm button is going away with its bubble; keep typing in the field.
    if (elements.searchInput) {
      elements.searchInput.focus({ preventScroll: true });
    }
    LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'closeOtherTabsForOverlay' }, (response) => {
      if (!response || response.ok !== true) {
        return;
      }
      if (searchQuery.text) {
        requestOverlaySearchSuggestions(searchQuery.text);
        return;
      }
      requestTabsAndRender();
    });
  }

  // Focusing the input hands the selection back to it.
  inputParts.input.addEventListener('focus', function() {
    searchResults.select(-1);
    suggestionInputPreview.restore(elements.searchInput, searchQuery.raw);
  });

  const defaultPlaceholder = inputParts.input.placeholder;
  const attachFaviconData = faviconRuntime.attachFaviconData;
  const attachInputModeFaviconData =
    BundledIcons.createSiteSearchProviderIconHydrator(attachFaviconData);
  const refreshOverlayThemeAwareFavicons = faviconRuntime.refreshOverlayThemeAwareFavicons;
  const refreshOverlayFaviconsForPolicyChange = faviconRuntime.refreshOverlayFaviconsForPolicyChange;
  const defaultCaretColor = inputParts.input.style.caretColor || 'var(--x-ext-input-caret, #7DB7FF)';
  const inputModePrefixTransition = 'opacity 140ms cubic-bezier(0.22, 1, 0.36, 1), transform 160ms cubic-bezier(0.22, 1, 0.36, 1), background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease, color 140ms ease';

  const settingsApplied = PANEL_SETTINGS_SYNC.createSettingsSync({
    setDocumentPipEnabled,
    overlayTabs,
    elements,
    overlayViewportSizeSync,
    overlayNoticeLayer,
    settings,
    modeActions,
    searchResults,
    searchMode,
    searchQuery,
    updateSearchSuggestions,
    applyOverlayTheme,
    searchEngine,
    requestOverlaySearchSuggestions,
    shouldShowOpenTabsForEmptyQuery,
    renderTabSuggestions,
    filterTabsForOverlay,
    refreshOverlayFaviconsForPolicyChange,
    getImmediateThemeForSuggestion,
    requestTabsAndRender,
    clearDefaultOpenTabsSuggestions,
    documentPipSupported,
    applyOverlayFontFamily
  });

  function rerenderReplacedFaviconRows() {
    const failedSlots = Array.from(suggestionsContainer.querySelectorAll(
      '[data-favicon-failed="true"]'
    ));
    if (failedSlots.length === 0) {
      return false;
    }
    failedSlots.forEach((slot) => {
      slot.dispatchEvent(new CustomEvent('lumno-favicon-retry'));
    });
    return true;
  }

  elements.mountModeController(SEARCH_INPUT_MODE.createInputModeController(inputParts, {
    surface: 'overlay',
    prefixTransition: inputModePrefixTransition,
    defaultPlaceholder: getDefaultPlaceholderText() || defaultPlaceholder,
    getDefaultPlaceholder: () => getDefaultPlaceholderText() || defaultPlaceholder,
    defaultCaretColor,
    modeBadgeElement: elements.modeBadge,
    rightReserveBase: 92,
    rightAnchorOffset: 86,
    // The clear button adds a 30px slot plus a 6px gap left of the close-other-tabs button.
    getExtraRightInset: () => (inputParts.syncClearAction() ? 36 : 0),
    baseInputPaddingLeft: 50,
    setInputStyle: setInputScopedStyle,
    getThemeForMode,
    defaultTheme: defaultTheme,
    defaultAccentColor,
    parseCssColor,
    rgbToCss,
    isDarkMode: isOverlayDarkMode,
    getProviderIcon: getPageRenderableProviderIcon,
    resolveProviderIconUrl: (provider, iconUrl) => {
      const pageUrl = BundledIcons.getSiteSearchProviderPageUrl(provider);
      return toPageRenderableIconUrl(getOverlayFaviconUrlResolver().getProviderFaviconUrl(pageUrl, iconUrl), pageUrl);
    },
    getProviderThemeHost,
    getThemeForProvider,
    getSiteSearchPrefixText: (provider) => getSiteSearchPrefixText(locale, provider),
    getSiteSearchDisplayName: (provider) => getSiteSearchDisplayName(locale, provider),
    attachFaviconData: attachInputModeFaviconData,
    formatMessage,
    modeMenuDoubleTabDuration: OVERLAY_MODE_MENU_DOUBLE_TAB_DURATION_MS,
    modeMenuCursorTooltipController: overlayModeMenuCursorTooltipController,
    getModeMenuItems: modeMenu.getItems,
    onModeMenuSelect: modeMenu.select,
    onModeMenuReorder: menuOrder.reorder,
    onModeMenuGroupMove: menuOrder.moveGroup,
    onModeMenuHistory: menuOrder.step,
    onModeTagRemovalConfirmation: () => {
      showOverlayToast(t(
        'search_scope_remove_confirmation',
        'Press Backspace again to remove the scope.'
      ));
    },
    onModeTagRemovalConfirmationReset: hideOverlayToast,
    onModeTagActiveChange: (active) => {
      setSearchScopeIconEnabled(!active);
    },
    onModeMenuLayoutChange: syncSearchModeMenuResultOffset,
    isTabHintSuppressed: () => Boolean(
      searchMode.site ||
      searchMode.local ||
      searchMode.openTabs
    )
  }));
  syncSearchModeMenuResultOffset();
  if (typeof window.ResizeObserver === 'function') {
    const modeMenuResultResizeObserver = new window.ResizeObserver(
      syncSearchModeMenuResultOffset
    );
    modeMenuResultResizeObserver.observe(suggestionsContainer);
    addOverlaySessionCleanup(() => {
      modeMenuResultResizeObserver.disconnect();
    });
  }
  siteSearchIconCache.load().then(() => {
    if (!searchMode.site || !elements.inputModeController) {
      return;
    }
    const activeProvider = searchMode.site;
    modeActions.setSiteSearchPrefix(activeProvider, defaultTheme);
    getThemeForProvider(activeProvider).then((theme) => {
      if (searchMode.site === activeProvider) {
        modeActions.setSiteSearchPrefix(activeProvider, theme);
      }
    }).catch(() => {});
  });

  void siteSearchCatalog.loadProviders();
  siteSearchCatalog.loadAggregates().then(() => {
    if (elements.inputModeController) {
      elements.inputModeController.refreshModeMenu();
    }
    if (elements.searchInput && elements.searchInput.value) {
      syncSearchTriggerHintFromInput(elements.searchInput.value);
    }
    if (searchQuery.text) {
      requestOverlaySearchSuggestions(searchQuery.text);
    }
  });

  // A new order from Settings or another surface reaches an open scope
  // panel now; a closed one reads it when it opens.
  settings.follow(searchSourceOrder, () => {
    if (elements.inputModeController) {
      elements.inputModeController.refreshModeMenu();
    }
  });
  // A changed list may drop the aggregate search the input is in, or
  // change its sources.
  siteSearchCatalog.store.subscribe(() => {
    const activeProvider = searchMode.site;
    if (activeProvider && isAggregateSearchProvider(activeProvider)) {
      const activeId = String(activeProvider.aggregateId || '');
      const definition = siteSearchCatalog.aggregates.find((item) => String(item && item.id ? item.id : '') === activeId);
      const updatedProvider = definition && siteSearchCatalog.isAggregateAvailable(definition)
        ? AGGREGATE_SEARCH_STORE.createScopeProvider(definition)
        : null;
      if (updatedProvider) {
        searchMode.replaceSite(updatedProvider);
        modeActions.setSiteSearchPrefix(updatedProvider, defaultTheme, { animate: false });
      } else {
        modeActions.clearSiteSearch();
      }
    }
    if (elements.inputModeController) {
      elements.inputModeController.refreshModeMenu();
    }
    if (searchQuery.text) {
      requestOverlaySearchSuggestions(searchQuery.text);
    }
  });

  settings.follow(siteSearchIconCacheSetting, () => {
    siteSearchIconCache.applyStored(settings.store.getStored(siteSearchIconCacheSetting));
    if (searchMode.site && elements.inputModeController) {
      const activeProvider = searchMode.site;
      modeActions.setSiteSearchPrefix(activeProvider, defaultTheme);
      getThemeForProvider(activeProvider).then((theme) => {
        if (searchMode.site === activeProvider) {
          modeActions.setSiteSearchPrefix(activeProvider, theme);
        }
      }).catch(() => {});
    }
    if (elements.inputModeController) {
      elements.inputModeController.refreshModeMenu();
    }
    if (searchQuery.text) {
      requestOverlaySearchSuggestions(searchQuery.text);
    }
  });

  inputParts.input.addEventListener('compositionstart', handleSearchInputCompositionStart);
  inputParts.input.addEventListener('compositionend', handleSearchInputCompositionEnd);
  inputParts.input.addEventListener('input', handleSearchInputEvent);
  inputParts.container.addEventListener('compositionstart', handleSearchInputCompositionStart, true);
  inputParts.container.addEventListener('compositionend', handleSearchInputCompositionEnd, true);
  inputParts.container.addEventListener('input', handleSearchInputEvent, true);
  const handleOverlayLoadingSessionSelection = (event: Event): void => {
    notifyOverlayLoadingSession(syncLiveSearchInputFromEvent(event));
  };
  inputParts.container.addEventListener('select', handleOverlayLoadingSessionSelection, true);
  inputParts.container.addEventListener('focusin', handleOverlayLoadingSessionSelection, true);
  inputParts.container.addEventListener('pointerup', handleOverlayLoadingSessionSelection, true);

  // Add click outside to close functionality
  const clickOutsideHandler = function(event: MouseEvent): void {
    const overlay = elements.overlay;
    if (!overlay) {
      return;
    }
    const eventPath = event.composedPath();
    const clickedInsideOverlay = eventPath.includes(overlay) || eventPath.includes(overlayHost);
    if (!clickedInsideOverlay) {
      closeOverlayWithMotion(overlay);
    }
  };
  document.addEventListener('click', clickOutsideHandler);
  addOverlaySessionCleanup(() => document.removeEventListener('click', clickOutsideHandler));
  inputParts.input.addEventListener('keydown', handleSearchInputKeydown);
  inputParts.input.addEventListener('keypress', function(e) {
    if (!e.metaKey && !e.ctrlKey && !e.altKey) {
      e.stopPropagation();
    }
  });
  inputParts.input.addEventListener('keyup', function(e) {
    suggestionModifiers.syncFromEvent(e);
    if (!e.metaKey && !e.ctrlKey && !e.altKey) {
      e.stopPropagation();
    }
  });

  function closeOverlayOnEscape(): void {
    if (elements.overlay) {
      closeOverlayWithMotion(elements.overlay);
    }
  }
  const overlayKeyRouter = new OVERLAY_KEYBOARD.OverlayKeyRouter(window, {
    getMount: () => ({
      document,
      host: getOverlayMountHost(elements.overlay),
      panel: elements.overlay
    }),
    isOverlayConnected: () => Boolean(elements.overlay && elements.overlay.isConnected),
    isKeyboardYielded: () => Boolean(document.getElementById(TAB_SWITCHER_HOST_ID)),
    isSearchInputActive,
    shouldHandleModeMenuKey: (e) => Boolean(
      elements.inputModeController &&
      typeof elements.inputModeController.shouldHandleModeMenuKeyEvent === 'function' &&
      elements.inputModeController.shouldHandleModeMenuKeyEvent(e)
    ),
    handleModeMenuKey(e) {
      if (!elements.inputModeController ||
          typeof elements.inputModeController.handleModeMenuKeyEvent !== 'function') {
        return false;
      }
      elements.inputModeController.handleModeMenuKeyEvent(e);
      return true;
    },
    isImeComposition: imeKeyGuard.shouldIgnoreKeydown,
    onKeyUp: () => imeKeyGuard.markKeyUp(),
    syncModifiers: suggestionModifiers.syncFromEvent,
    handleNumberShortcut: (e) => SUGGESTION_NAVIGATION.handleNumberShortcutKeyEvent(
      e,
      suggestionItems,
      elements.suggestionsContainer,
      numberShortcutOptions
    ),
    getSuggestionNavigationKey,
    handleInputKeydown: handleSearchInputKeydown,
    handleTab: handleTabKey,
    handleOverlayKeydown,
    handleOverlayKeyup,
    onEscapeOutside: closeOverlayOnEscape,
    onEscapeTaken: closeOverlayOnEscape,
    onBlur: () => {
      suggestionModifiers.set(false, false, false);
      SUGGESTION_NAVIGATION.cancelNumberShortcuts(elements.suggestionsContainer);
    }
  });
  overlayKeyRouter.start();
  attachKeyRouter(overlayKeyRouter);
  addOverlaySessionCleanup(() => overlayKeyRouter.stop());

  if (!shouldShowOpenTabsForEmptyQuery()) {
    clearDefaultOpenTabsSuggestions();
  }
  applyNoTranslateDeep(elements.overlay);
  applyOverlayThemeVariables(overlayThemeChoice.mode);
  // Reader extensions such as SimpRead can hide the original body and mount
  // their reading surface directly under <html>. Keep the overlay out of a
  // potentially hidden body while preserving fullscreen containment.
  const overlayMountParent = document.fullscreenElement ||
    document.documentElement ||
    document.body;
  overlayMountParent.appendChild(overlayHost);
  setOverlayOpenState(true);
  if (typeof overlayHost.showPopover === 'function') {
    try {
      overlayHost.showPopover();
    } catch (e) {
      // Keep the fixed-position fallback visible if top-layer promotion fails.
      overlayHost.removeAttribute('popover');
    }
  }
  const mountConnectionGuard = overlayLifecycle.createMountConnectionGuard(window, {
    getMountParent(doc) {
      return doc.fullscreenElement || doc.documentElement || doc.body;
    },
    onRestore(restoredHost) {
      setOverlayOpenState(true);
      if (typeof restoredHost.showPopover === 'function') {
        try {
          restoredHost.showPopover();
        } catch (error) {
          restoredHost.removeAttribute('popover');
        }
      }
      overlayViewportSizeSync.apply(elements.overlay);
      const restoreFocus = () => {
        if (restoredHost.isConnected &&
            isOverlayOpenState()) {
          focusOverlayInputForReveal();
        }
      };
      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(restoreFocus);
      } else {
        window.setTimeout(restoreFocus, 0);
      }
    }
  });
  addOverlaySessionCleanup(() => {
    mountConnectionGuard.stop();
  });
  mountConnectionGuard.start(overlayHost);
  // Over a fullscreen video, the first Escape closes the overlay.
  const fullscreenEscapeLock = createFullscreenEscapeLock(window);
  addOverlaySessionCleanup(() => {
    fullscreenEscapeLock.stop();
  });
  fullscreenEscapeLock.start();
  startOverlayViewportSizeSync(overlayMount.panel);
  overlayNoticeLayer.startFrameSync(elements.overlay);
  startOverlayAntiTranslateObserver(overlayMount.panel);

  function focusOverlayInputForReveal() {
    if (!elements.searchInput || !elements.searchInput.isConnected) {
      return;
    }
    if (initialLoadingSession && initialLoadingSession.focused === false) {
      return;
    }
    elements.searchInput.focus({ preventScroll: true });
  }

  settings.loaded.then(() => {
    const searchInput = elements.searchInput;
    if (!elements.overlay || !elements.overlay.isConnected || !searchInput) {
      return false;
    }
    if (initialLoadingSession || initialPrefillQuery) {
      const initialInputValue = initialLoadingSession
        ? initialLoadingSession.inputValue
        : initialPrefillQuery;
      searchInput.value = initialInputValue;
      const selectionStart = initialLoadingSession
        ? initialLoadingSession.selectionStart
        : initialInputValue.length;
      const selectionEnd = initialLoadingSession
        ? initialLoadingSession.selectionEnd
        : initialInputValue.length;
      const selectionDirection = initialLoadingSession
        ? initialLoadingSession.selectionDirection
        : 'none';
      searchInput.setSelectionRange(selectionStart, selectionEnd, selectionDirection);
      searchQuery.set(initialInputValue);
      updateModeBadge(initialInputValue);
      replayWithoutLoadingNotification(() => {
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
      return true;
    }
    return initialLanguageReady.catch(() => {}).then(() => {
      requestTabsAndRender();
      return true;
    });
  }).catch(() => false);

  const revealOverlay = (options: { forceInstant: boolean }): void => {
    if (!elements.overlay || !elements.overlay.isConnected) {
      return;
    }
    setOverlayMountVisibility(overlayHost, false);
    overlayRevealGate.release();
    // The style gate has just released the result surface, so take one last
    // measurement before it can become visible on a slow stylesheet load.
    syncOpenTabsScrollbarGutter();
    // Focusing before the two animation frames lets typing begin as soon as
    // the command bar is visually released, instead of after the entry
    // motion has already started.
    focusOverlayInputForReveal();
    const reduceMotion = options.forceInstant ||
      shouldSkipOverlayEntryMotion();
    const revealTransform = getOverlayEnterAnimationRevealTransform();
    if (reduceMotion) {
      elements.overlay.style.setProperty('transition', 'none', 'important');
      elements.overlay.style.setProperty('opacity', '1', 'important');
      elements.overlay.style.setProperty('transform', revealTransform, 'important');
      finishOverlayPanelEnterAnimation(elements.overlay);
      overlayNoticeLayer.scheduleMount(elements.overlay, elements.overlayStyleRoot, 0);
    } else {
      clearOverlayEnterAnimationFrames();
      overlayFrameTracker.runEnterAnimation(elements.overlay, () => {
        playOverlayPanelEnterAnimation(elements.overlay, revealTransform);
        overlayNoticeLayer.scheduleMount(elements.overlay, elements.overlayStyleRoot, 360);
      });
    }
  };
  const revealReady = overlayRevealGate.waitUntilReady();
  Promise.all([
    Promise.resolve(revealReady).catch(() => null),
    settingsApplied.catch(() => {})
  ]).then((readyStates) => {
    if (!elements.overlay || !elements.overlay.isConnected) {
      return;
    }
    applyOverlayEnterAnimationInitialState(elements.overlay);
    const styleGateResult = readyStates[0];
    const revealGate = overlayRevealGate;
    // The gate gives up on its first-frame budget while the settings above
    // are still loading, so the stylesheets have often arrived by now.
    const stylesReady = Boolean(styleGateResult && styleGateResult.ok === true) ||
      Boolean(revealGate && revealGate.isReady());
    revealOverlay({
      // A late stylesheet uses the shell's stable fallback. Starting a
      // spring while that fallback is about to upgrade only makes slow
      // devices look more broken, so reveal its final state instead.
      forceInstant: !stylesReady || shouldSkipOverlayEntryMotionForSlowStartup()
    });
  });
  const scrollPauseHandler = () => {
    pauseOverlayAntiTranslateObserverForScroll();
  };
  window.addEventListener('scroll', scrollPauseHandler, true);
  window.addEventListener('wheel', scrollPauseHandler, { passive: true, capture: true });
  window.addEventListener('touchmove', scrollPauseHandler, { passive: true, capture: true });
  addOverlaySessionCleanup(() => {
    window.removeEventListener('scroll', scrollPauseHandler, true);
    window.removeEventListener('wheel', scrollPauseHandler, true);
    window.removeEventListener('touchmove', scrollPauseHandler, true);
  });

}

export { toggleSearchOverlay };
