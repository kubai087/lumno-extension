import { buildTheme, createDefaultTheme, createUrlHighlightTheme, defaultAccentColor } from '../shared/favicon/favicon-theme';
import { parseCssColor, rgbToCss } from '../domain/color';
import * as COMMUNITY_LINKS from '../platform/community-links';
import * as OVERLAY_FONT_FACES from '../shared/overlay-font-faces';
import * as LumnoShortcutFaviconStore from '../platform/shortcut-favicon-store';
import * as AGGREGATE_SEARCH_STORE from '../domain/search/aggregate-search-store';
import * as LumnoImeKeyGuard from '../domain/search/ime-key-guard';
import * as SEARCH_INPUT_HISTORY from '../domain/search/search-input-history';
import * as SEARCH_INPUT_MODE from '../shared/search/search-input-mode';
import * as SEARCH_SOURCE_ORDER from '../domain/search/search-source-order';
import * as SUGGESTION_ACTION_MODEL from '../domain/search/suggestion-action-model';
import * as SUGGESTION_INPUT_PREVIEW from '../domain/search/suggestion-input-preview';
import * as SUGGESTION_NAVIGATION from '../shared/search/suggestion-navigation';
import * as SUGGESTIONS_HEIGHT_LAYOUT from '../shared/search/suggestions-height-layout';
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
import * as PANEL_SEARCH_MODE_MENU from './panel/search-mode-menu';
import * as PANEL_SEARCH_MODES from './panel/search-modes';
import * as PANEL_SETTINGS_SYNC from './panel/settings-sync';
import * as PANEL_SITE_SEARCH_PROVIDERS from './panel/site-search-providers';
import * as PANEL_SLASH_COMMANDS from './panel/slash-commands';
import * as PANEL_SUGGESTION_SOURCES from './panel/suggestion-sources';
import * as PANEL_SUGGESTION_THEMES from './panel/suggestion-themes';
import * as PANEL_SUGGESTIONS_RENDER from './panel/suggestions-render';
import * as PANEL_TAB_MATCHING from './panel/tab-matching';
import * as OVERLAY_CONTEXT from './overlay-context';
import * as OVERLAY_STATE from './overlay-state';
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
import * as ShortcutIconCache from '../domain/favicon/shortcut-favicon/persisted';
import { overlaySizeMode, overlayWidth } from '../domain/settings/overlay-panel';
import { numberShortcutInstantEnabled } from '../domain/settings/search';
import { SearchQuery } from '../shared/search-panel/search-query';
import { SearchMode } from '../shared/search-panel/search-mode';
import { SearchAutocomplete } from '../shared/search-panel/autocomplete';
import type { InputModeProvider } from '../shared/search/input-mode/types';

// Favicon data and preloaded icons the overlay resolved, kept across its
// openings in this page.
const faviconDataCache = new Map<string, string>();
const faviconDataPending = new Map<string, Promise<string | null>>();
const iconPreloadCache = new Map<string, HTMLImageElement>();

// Opens or closes the search overlay with the window's tabs and the context
// it was opened with, both read as untrusted.
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
  const siteSearchIconCache = new SiteSearchIconCache(LumnoShortcutFaviconStore.createShortcutFaviconStore({
    chromeApi: chrome,
    storageArea: chrome && chrome.storage ? chrome.storage.local : null,
    storageKey: siteSearchIconCacheSetting.key,
    ...ShortcutIconCache.SITE_SEARCH_CACHE_OPTIONS
  }));
  void siteSearchIconCache.load();

  // Panel state shared with the parts of this panel in overlay/panel/: each
  // receives this one object as `overlayState` and reads and writes the same
  // properties this function does.
  const overlayState = OVERLAY_STATE.createOverlayState({
    settings: createOverlaySettings(chrome),
    // Teardown steps owned by this invocation's overlay session. Controllers
    // created deep inside the mount block register here so removeOverlay can
    // release them without stashing them on DOM expandos.
    overlaySessionCleanups: overlayLifecycle.createSessionCleanupRegistry(),
    overlayNoticeLayer: OVERLAY_NOTICES.createNoticeLayer(window, {
      getUpdateNotice: () => overlayState.overlayUpdateNoticeController,
      getGraphicsNotice: () => overlayState.overlayGraphicsNoticeController,
      getEngagementNotice: () => overlayState.overlayEngagementNoticeController,
      getSizePreset: () => getOverlaySizePreset(overlayState.settings.get(overlaySizeMode)),
      decorate: (element) => applyNoTranslateDeep(element)
    }),
    overlayViewportSizeSync: overlayLifecycle.createViewportSizeSync(window, {
      getSizePreset: () => getOverlaySizePreset(overlayState.settings.get(overlaySizeMode)),
      getRequestedTabZoomFactor: () => requestedTabZoomFactor,
      shouldIgnoreTabZoomCompensation: () => shouldIgnoreTabZoomCompensation
    }),
    imeKeyGuard: LumnoImeKeyGuard.createImeKeyGuard(),
    suggestionInputPreview: SUGGESTION_INPUT_PREVIEW.createSuggestionInputPreview(),
    overlayMediaQuery: window.matchMedia('(prefers-color-scheme: dark)'),
    defaultTheme: createDefaultTheme(),
    urlHighlightTheme: createUrlHighlightTheme(),
    prioritizeCurrentPageMatch: openOptions.prioritizeCurrentPageMatch,
    currentTabPinned: openOptions.currentTabPinned,
    initialContextTabUrl: openOptions.currentTabUrl,
    loadingSessionTrackingActive: openOptions.loadingSessionTracked,
    documentPipEnabled: documentPipSupported && openOptions.documentPipEnabled,
    tabs: initialOverlayTabs,
    currentOverlayTabId: initialContextTabId
  });
  // They follow storage only once the panel mounts, below.
  const locale = new SurfaceLocale(overlayState.settings.store, loadExtensionLocaleMessages);
  const { t, formatMessage } = locale;
  const searchQuery = new SearchQuery();
  const searchMode = new SearchMode<InputModeProvider>();
  const searchAutocomplete = new SearchAutocomplete({
    settings: overlayState.settings.store,
    query: searchQuery,
    getInput: () => overlayState.searchInput,
    preview: overlayState.suggestionInputPreview,
    isModeActive: () => Boolean(searchMode.site || searchMode.local),
    getUrlDisplay: (url) => getUrlDisplay(url)
  });
  const searchEngine = new DefaultSearchEngine(overlayState.settings.store);
  const siteSearchCatalog = new SiteSearchCatalog(overlayState.settings.store, searchEngine, openOptions.siteSearchProviders);

  const logOverlayFaviconDecision = FaviconDecisionLog.createFaviconDecisionLogger({ surface: 'overlay' });

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
    SETTINGS,
    logOverlayFaviconDecision,
    overlayState
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
    getOverlayPanel: () => overlayState.overlay,
    getSuggestionRowsRoot: () => overlayState.suggestionsContainer,
    rerenderReplacedFaviconRows,
    hasThemeForHost: (hostKey) => Boolean(hostKey && themeHostCache.has(hostKey))
  });
  function cancelPendingOverlaySuggestionRequests() {
    overlayState.overlaySuggestionRequestSeq += 1;
    if (overlayState.overlayRemoteSuggestionDebounceTimer) {
      clearTimeout(overlayState.overlayRemoteSuggestionDebounceTimer);
      overlayState.overlayRemoteSuggestionDebounceTimer = null;
    }
    if (overlayState.overlayFirstResultRevealTimer) {
      clearTimeout(overlayState.overlayFirstResultRevealTimer);
      overlayState.overlayFirstResultRevealTimer = null;
    }
  }
  const OVERLAY_HOST_ID = '_x_extension_overlay_host_2026_unique_';
  const OVERLAY_PANEL_ID = '_x_extension_overlay_2024_unique_';

  const {
    getOrCreateOverlayContextToken,
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
    pauseOverlayAntiTranslateObserverForScroll: (...args) => pauseOverlayAntiTranslateObserverForScroll(...args),
    clearOverlayEnterAnimationFrames: (...args) => clearOverlayEnterAnimationFrames(...args),
    clearOverlayPanelEnterCleanup: (...args) => clearOverlayPanelEnterCleanup(...args),
    cancelPendingOverlaySuggestionRequests,
    stopOverlayAntiTranslateObserver: (...args) => stopOverlayAntiTranslateObserver(...args),
    overlayShell,
    stopOverlayPageThemeObserver,
    overlayLifecycle,
    overlayState
  });

  overlayState.overlayContextToken = getOrCreateOverlayContextToken();


  const {
    getUrlDisplay,
    filterTabsForOverlay,
    getMatchedOpenTabIdForSuggestion,
    isCurrentOverlayTabUrl
  } = PANEL_TAB_MATCHING.createTabMatching({
    overlayState
  });




  const suggestionItems: SuggestionElement[] = [];

  const numberShortcutOptions: NumberShortcutOptions = {
    onHoldStart: function() {
      showOverlayToast(t(
        'search_number_jump_release_hint',
        'Release to show numbers'
      ), false, { duration: 0 });
    },
    onHoldEnd: () => hideOverlayToast(),
    instantActive: () => overlayState.settings.get(numberShortcutInstantEnabled)
  };



  const applyOverlayTheme = (mode: ThemeMode): void => {
    overlayState.overlayThemeMode = mode;
    const previousResolvedTheme = overlayState.overlay ? overlayState.overlay.getAttribute('data-theme') : '';
    applyOverlayThemeVariables(mode);
    overlayState.overlayNoticeLayer.sync(overlayState.overlay);
    const nextResolvedTheme = overlayState.overlay ? overlayState.overlay.getAttribute('data-theme') : '';
    suggestionItems.forEach((item) => {
      if (item && item._xTheme) {
        applyThemeVariables(item, item._xTheme);
      }
    });
    updateSelection();
    updateModeBadge(overlayState.searchInput ? overlayState.searchInput.value : '');
    if (previousResolvedTheme !== nextResolvedTheme) {
      refreshOverlayThemeAwareFavicons();
    }
    if (overlayToastElement) {
      overlayToastElement.setAttribute('data-theme', nextResolvedTheme || 'light');
    }
    syncOverlayPageThemeObservation();
    if (mode === 'system') {
      if (!overlayState.overlayThemeMediaListener) {
        const listener = () => {
          if (overlayState.overlayThemeMode === 'system') {
            // Re-apply in full: updating only the panel's variables would leave
            // the rows on the previous scheme's colors.
            // A page that follows the system theme may have switched too.
            invalidatePageTheme();
            applyOverlayTheme('system');
          }
        };
        overlayState.overlayThemeMediaListener = listener;
        overlayState.overlayMediaQuery.addEventListener('change', listener);
      }
      return;
    }
    if (overlayState.overlayThemeMediaListener) {
      overlayState.overlayMediaQuery.removeEventListener('change', overlayState.overlayThemeMediaListener);
      overlayState.overlayThemeMediaListener = null;
    }
  };

  const {
    getShortcutRules,
    getDirectNavigationUrl,
    getDirectUrlSuggestion,
    resolveQuickNavigation,
    getHelpCenterLocale,
    updateSearchSuggestions,
    clearSearchSuggestions
  } = PANEL_SUGGESTION_SOURCES.createSuggestionSources({
    searchMode,
    searchAutocomplete,
    searchQuery,
    favicons: faviconRuntime,
    formatMessage: (...args) => formatMessage(...args),
    getPageFaviconCandidateUrl: (...args) => getPageFaviconCandidateUrl(...args),
    isLocalNetworkInput: (...args) => isLocalNetworkInput(...args),
    getHostFromUrl: (...args) => getHostFromUrl(...args),
    isLocalNetworkHost: (...args) => isLocalNetworkHost(...args),
    SUGGESTION_ACTION_MODEL,
    locale,
    getProviderIcon: (...args) => getProviderIcon(...args),
    COMMUNITY_LINKS,
    t: (...args) => t(...args),
    isSlashCommandInput: (...args) => isSlashCommandInput(...args),
    isModeCommand: (...args) => isModeCommand(...args),
    applyOverlayTheme,
    searchEngine,
    getCommandMatches: (...args) => getCommandMatches(...args),
    buildModeSuggestion: (...args) => buildModeSuggestion(...args),
    buildCommandSuggestion: (...args) => buildCommandSuggestion(...args),
    isCurrentOverlayTabUrl,
    siteSearchCatalog,
    getInlineSiteSearchCandidate: (...args) => getInlineSiteSearchCandidate(...args),
    buildSearchUrl: (...args) => buildSearchUrl(...args),
    getSiteSearchActionTitle: (...args) => getSiteSearchActionTitle(...args),
    isAggregateSearchProvider: (...args) => isAggregateSearchProvider(...args),
    getMatchedOpenTabIdForSuggestion,
    filterOverlayBlacklistedSuggestions: (...args) => filterOverlayBlacklistedSuggestions(...args),
    getKeywordSearchSuggestionState: (...args) => getKeywordSearchSuggestionState(...args),
    promoteStrongNavigationMatch: (...args) => promoteStrongNavigationMatch(...args),
    promoteTopSiteMatch: (...args) => promoteTopSiteMatch(...args),
    getSiteSearchTriggerCandidate: (...args) => getSiteSearchTriggerCandidate(...args),
    getUrlDisplay,
    getLocalSearchScopeCandidate: (...args) => getLocalSearchScopeCandidate(...args),
    setSiteSearchTabHint: (...args) => setSiteSearchTabHint(...args),
    getLocalSearchScopeTabHintProvider: (...args) => getLocalSearchScopeTabHintProvider(...args),
    clearSiteSearchTabHint: (...args) => clearSiteSearchTabHint(...args),
    limitOverlaySuggestionsForDisplay: (...args) => limitOverlaySuggestionsForDisplay(...args),
    getSearchPanelsLayoutTransitionMenu: (...args) => getSearchPanelsLayoutTransitionMenu(...args),
    pauseOverlayAntiTranslateObserverForMutationBurst: (...args) => pauseOverlayAntiTranslateObserverForMutationBurst(...args),
    setOpenTabsResultsViewport: (...args) => setOpenTabsResultsViewport(...args),
    ensureOverlaySuggestionsView: (...args) => ensureOverlaySuggestionsView(...args),
    setOverlayResultsCollapsed: (...args) => setOverlayResultsCollapsed(...args),
    syncSuggestionLastState: (...args) => syncSuggestionLastState(...args),
    updateSelection: (...args) => updateSelection(...args),
    commitSuggestionsNaturalHeightAfterRender: (...args) => commitSuggestionsNaturalHeightAfterRender(...args),
    cancelPendingOverlaySuggestionRequests,
    shouldShowOpenTabsForEmptyQuery: (...args) => shouldShowOpenTabsForEmptyQuery(...args),
    requestTabsAndRender: (...args) => requestTabsAndRender(...args),
    clearDefaultOpenTabsSuggestions: (...args) => clearDefaultOpenTabsSuggestions(...args),
    overlayState
  });

  const {
    updatePendingSearchSuggestions,
    requestOverlaySearchSuggestions
  } = PANEL_REMOTE_SUGGESTIONS.createRemoteSuggestions({
    searchMode,
    searchQuery,
    updateSearchSuggestions,
    isSlashCommandInput: (...args) => isSlashCommandInput(...args),
    getDirectUrlSuggestion,
    overlayState
  });

  const {
    updateSelection,
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
    searchMode,
    searchQuery,
    favicons: faviconRuntime,
    updateSearchSuggestions,
    requestOverlaySearchSuggestions,
    suggestionItems,
    SUGGESTION_NAVIGATION,
    SUGGESTIONS_HEIGHT_LAYOUT,
    syncSearchModeMenuResultOffset: (...args) => syncSearchModeMenuResultOffset(...args),
    removeOverlay,
    activateOpenTabsSearchMode: (...args) => activateOpenTabsSearchMode(...args),
    openDocumentPipPickerFromOverlay: (...args) => openDocumentPipPickerFromOverlay(...args),
    activateSiteSearch: (...args) => activateSiteSearch(...args),
    openOverlayCommunityQrDialog: (...args) => openOverlayCommunityQrDialog(...args),
    applyThemeModeChange: (...args) => applyThemeModeChange(...args),
    applyWebAppearanceMode: (...args) => applyWebAppearanceMode(...args),
    shouldSwitchMatchedTabSuggestion: (...args) => shouldSwitchMatchedTabSuggestion(...args),
    openMatchedTabSuggestion: (...args) => openMatchedTabSuggestion(...args),
    finishOverlayResultActivation: (...args) => finishOverlayResultActivation(...args),
    openSiteSearchProviderQuery: (...args) => openSiteSearchProviderQuery(...args),
    shouldOpenSearchResultInBackgroundTab: (...args) => shouldOpenSearchResultInBackgroundTab(...args),
    recordSearchSuggestionSelectionFromSuggestion: (...args) => recordSearchSuggestionSelectionFromSuggestion(...args),
    getSearchResultDisposition: (...args) => getSearchResultDisposition(...args),
    isCurrentTabDefault: (...args) => isCurrentTabDefault(...args),
    getOverlayFaviconUrlResolver: (...args) => getOverlayFaviconUrlResolver(...args),
    t: (...args) => t(...args),
    formatMessage: (...args) => formatMessage(...args),
    shouldBlockOverlayFaviconForHost: (...args) => shouldBlockOverlayFaviconForHost(...args),
    isLocalNetworkHost: (...args) => isLocalNetworkHost(...args),
    getChromeFaviconUrl: (...args) => getChromeFaviconUrl(...args),
    getPageFaviconCandidateUrl: (...args) => getPageFaviconCandidateUrl(...args),
    getHostFromUrl: (...args) => getHostFromUrl(...args),
    getUrlDisplay,
    getImmediateThemeForSuggestion: (...args) => getImmediateThemeForSuggestion(...args),
    getThemeForSuggestion: (...args) => getThemeForSuggestion(...args),
    getThemeForMode: (...args) => getThemeForMode(...args),
    getHoverColors: (...args) => getHoverColors(...args),
    getHighlightColors: (...args) => getHighlightColors(...args),
    getNeutralHoverActionColors: (...args) => getNeutralHoverActionColors(...args),
    applyThemeVariables: (...args) => applyThemeVariables(...args),
    applyMarkVariables: (...args) => applyMarkVariables(...args),
    copySearchResultUrl: (...args) => copySearchResultUrl(...args),
    getSiteSearchDisplayName: (...args) => getSiteSearchDisplayName(...args),
    isAiSiteSearchProvider: (...args) => isAiSiteSearchProvider(...args),
    searchEngine,
    getBrandAccentForUrl: (...args) => getBrandAccentForUrl(...args),
    buildTheme,
    normalizeSearchResultDisplayLimit: (...args) => normalizeSearchResultDisplayLimit(...args),
    pauseOverlayAntiTranslateObserverForMutationBurst: (...args) => pauseOverlayAntiTranslateObserverForMutationBurst(...args),
    setOpenTabsResultsViewport: (...args) => setOpenTabsResultsViewport(...args),
    setOverlayResultsCollapsed: (...args) => setOverlayResultsCollapsed(...args),
    isAggregateSearchProvider: (...args) => isAggregateSearchProvider(...args),
    filterTabsForOverlay,
    shouldShowOpenTabsForEmptyQuery: (...args) => shouldShowOpenTabsForEmptyQuery(...args),
    clearDefaultOpenTabsSuggestions: (...args) => clearDefaultOpenTabsSuggestions(...args),
    overlayState
  });

  const {
    handleTabKey,
    handleSearchInputKeydown,
    shouldSwitchMatchedTabSuggestion,
    getSuggestionNavigationKey,
    handleOverlayKeydown,
    handleOverlayKeyup,
    isSearchInputActive
  } = PANEL_PANEL_KEYS.createPanelKeys({
    searchMode,
    searchAutocomplete,
    searchQuery,
    cancelPendingOpenTabsPrefixEntry: (...args) => cancelPendingOpenTabsPrefixEntry(...args),
    openSearchModeMenuFromDoubleTab: (...args) => openSearchModeMenuFromDoubleTab(...args),
    activateOpenTabsSearchMode: (...args) => activateOpenTabsSearchMode(...args),
    activateSiteSearch: (...args) => activateSiteSearch(...args),
    activateLocalSearchScope: (...args) => activateLocalSearchScope(...args),
    getTopSiteMatchCandidate: (...args) => getTopSiteMatchCandidate(...args),
    getSiteSearchTriggerCandidate: (...args) => getSiteSearchTriggerCandidate(...args),
    getLocalSearchScopeCandidate: (...args) => getLocalSearchScopeCandidate(...args),
    siteSearchCatalog,
    getShortcutRules,
    syncSuggestionActionModifiersFromEvent: (...args) => syncSuggestionActionModifiersFromEvent(...args),
    clearSiteSearch: (...args) => clearSiteSearch(...args),
    clearLocalSearchScope: (...args) => clearLocalSearchScope(...args),
    requestOverlaySearchSuggestions,
    clearSearchSuggestions,
    clearOpenTabsSearchMode: (...args) => clearOpenTabsSearchMode(...args),
    isImeCompositionEvent,
    SEARCH_INPUT_HISTORY,
    suggestionItems,
    SUGGESTION_NAVIGATION,
    numberShortcutOptions,
    removeOverlay,
    closeOverlayWithMotion,
    updateSelection,
    scrollSelectedSuggestionIntoView,
    getCommandMatch: (...args) => getCommandMatch(...args),
    applyThemeModeChange: (...args) => applyThemeModeChange(...args),
    getNextThemeMode: (...args) => getNextThemeMode(...args),
    applyWebAppearanceMode: (...args) => applyWebAppearanceMode(...args),
    applyNextWebAppearanceMode: (...args) => applyNextWebAppearanceMode(...args),
    openDocumentPipPickerFromOverlay: (...args) => openDocumentPipPickerFromOverlay(...args),
    isModeCommand: (...args) => isModeCommand(...args),
    openOverlayCommunityQrDialog: (...args) => openOverlayCommunityQrDialog(...args),
    openSiteSearchProviderQuery: (...args) => openSiteSearchProviderQuery(...args),
    finishOverlayResultActivation: (...args) => finishOverlayResultActivation(...args),
    openMatchedTabSuggestion: (...args) => openMatchedTabSuggestion(...args),
    shouldOpenSearchResultInBackgroundTab: (...args) => shouldOpenSearchResultInBackgroundTab(...args),
    recordSearchSuggestionSelectionFromSuggestion: (...args) => recordSearchSuggestionSelectionFromSuggestion(...args),
    getSearchResultDisposition: (...args) => getSearchResultDisposition(...args),
    isSlashCommandInput: (...args) => isSlashCommandInput(...args),
    updateSearchSuggestions,
    isAggregateSearchProvider: (...args) => isAggregateSearchProvider(...args),
    resolveQuickNavigation,
    overlayState
  });

  const {
    openDocumentPipPickerFromOverlay,
    syncLiveSearchInputFromEvent,
    syncSearchTriggerHintFromInput,
    handleSearchInputCompositionStart,
    handleSearchInputCompositionEnd,
    handleSearchInputEvent
  } = PANEL_SEARCH_INPUT_EVENTS.createSearchInputEvents({
    searchMode,
    searchAutocomplete,
    searchQuery,
    siteSearchCatalog,
    applyNoTranslate: (...args) => applyNoTranslate(...args),
    clearSiteSearchTabHint: (...args) => clearSiteSearchTabHint(...args),
    isSlashCommandInput: (...args) => isSlashCommandInput(...args),
    getInlineSiteSearchCandidate: (...args) => getInlineSiteSearchCandidate(...args),
    getSiteSearchTriggerCandidate: (...args) => getSiteSearchTriggerCandidate(...args),
    setSiteSearchTabHint: (...args) => setSiteSearchTabHint(...args),
    getLocalSearchScopeCandidate: (...args) => getLocalSearchScopeCandidate(...args),
    getLocalSearchScopeTabHintProvider: (...args) => getLocalSearchScopeTabHintProvider(...args),
    cancelPendingOverlaySuggestionRequests,
    notifyOverlayLoadingSession,
    updateModeBadge: (...args) => updateModeBadge(...args),
    updateSelection,
    updateSearchSuggestions,
    renderCachedTabsOrRequest,
    getDirectUrlSuggestion,
    updatePendingSearchSuggestions,
    requestOverlaySearchSuggestions,
    clearSearchSuggestions,
    overlayState
  });

  const {
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
  } = PANEL_SEARCH_MODES.createSearchModes({
    searchMode,
    searchAutocomplete,
    searchQuery,
    t: (...args) => t(...args),
    isAggregateSearchProvider: (...args) => isAggregateSearchProvider(...args),
    formatMessage: (...args) => formatMessage(...args),
    isAiSiteSearchProvider: (...args) => isAiSiteSearchProvider(...args),
    getDirectNavigationUrl,
    getUrlDisplay,
    cancelPendingOverlaySuggestionRequests,
    clearSearchSuggestions,
    getImmediateThemeForSuggestion: (...args) => getImmediateThemeForSuggestion(...args),
    getThemeForProvider: (...args) => getThemeForProvider(...args),
    renderCachedTabsForOverlay,
    requestTabsAndRender,
    isSlashCommandInput: (...args) => isSlashCommandInput(...args),
    updateSearchSuggestions,
    requestOverlaySearchSuggestions,
    overlayState
  });



  const {
    buildSearchUrl,
    isAiSiteSearchProvider,
    isSearchEngineSiteSearchProvider,
    isAggregateSearchProvider,
    openSiteSearchProviderQuery,
    recordSearchSuggestionSelectionFromSuggestion,
    getProviderIcon,
    toPageRenderableIconUrl,
    getPageRenderableProviderIcon
  } = PANEL_SITE_SEARCH_PROVIDERS.createSiteSearchProviders({
    favicons: faviconRuntime,
    getHelpCenterLocale,
    AGGREGATE_SEARCH_STORE,
    showOverlayToast: (...args) => showOverlayToast(...args),
    t: (...args) => t(...args),
    getSearchResultDisposition: (...args) => getSearchResultDisposition(...args),
    getSearchResultNewTabDisposition: (...args) => getSearchResultNewTabDisposition(...args),
    finishOverlayResultActivation: (...args) => finishOverlayResultActivation(...args),
    getOverlayFaviconUrlResolver: (...args) => getOverlayFaviconUrlResolver(...args),
    siteSearchIconCache,
    faviconDataCache
  });

  const {
    getSearchModeMenuItems,
    reorderSearchModeMenu,
    stepSearchModeMenuHistory,
    moveSearchModeMenuGroup,
    openSearchModeMenuFromDoubleTab,
    selectSearchModeMenuItem
  } = PANEL_SEARCH_MODE_MENU.createSearchModeMenu({
    searchMode,
    searchQuery,
    searchEngine,
    AGGREGATE_SEARCH_STORE,
    t: (...args) => t(...args),
    isAggregateSearchProvider,
    isSearchEngineSiteSearchProvider,
    isAiSiteSearchProvider,
    getSiteSearchDisplayName,
    getPageRenderableProviderIcon,
    getLocalSearchScopeLabel,
    getLocalSearchScopeIconName,
    SEARCH_SOURCE_ORDER,
    siteSearchIconCache,
    siteSearchCatalog,
    cancelPendingOpenTabsPrefixEntry,
    activateSiteSearch,
    activateOpenTabsSearchMode,
    activateLocalSearchScope,
    overlayState
  });

  const {
    setSuggestionActionModifiersActive,
    syncSuggestionActionModifiersFromEvent,
    shouldOpenSearchResultInBackgroundTab,
    finishOverlayResultActivation,
    getOpenDisposition,
    getSearchResultNewTabDisposition,
    getSearchResultDisposition,
    isCurrentTabDefault,
    openMatchedTabSuggestion
  } = PANEL_RESULT_ACTIVATION.createResultActivation({
    ensureOverlaySuggestionsView,
    SUGGESTION_ACTION_MODEL,
    removeOverlay,
    recordSearchSuggestionSelectionFromSuggestion,
    overlayState
  });
  const overlaySiteFixes = LumnoOverlaySiteFixes;
  const addOverlaySessionCleanup = overlayState.overlaySessionCleanups.add;
  const overlayFrameTracker = overlayLifecycle.createFrameTracker(window);

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
    initialOverlayOpenStartedAt,
    overlayFrameTracker,
    overlayState
  });

  const overlayAntiTranslateGuard = overlayLifecycle.createAntiTranslateGuard(window, {
    applyNoTranslateDeep: (...args) => applyNoTranslateDeep(...args),
    restoreProtectedNode: (...args) => restoreProtectedNode(...args),
    restoreProtectedAncestors: (...args) => restoreProtectedAncestors(...args)
  });

  const {
    applyOverlayInputExtensionIsolation,
    applyNoTranslate,
    applyNoTranslateDeep,
    restoreProtectedNode,
    restoreProtectedAncestors,
    stopOverlayAntiTranslateObserver,
    pauseOverlayAntiTranslateObserverForScroll,
    pauseOverlayAntiTranslateObserverForMutationBurst,
    startOverlayAntiTranslateObserver
  } = PANEL_PAGE_GUARDS.createPageGuards({
    overlayAntiTranslateGuard
  });
  const OVERLAY_MODE_MENU_DOUBLE_TAB_DURATION_MS = 700;
  const OVERLAY_FONT_FAMILY_CSS_VAR = SETTINGS.OVERLAY_FONT_FAMILY_CSS_VAR;
  const RI_CSS_URL = overlayRuntime.getRuntimeUrl(chrome, 'assets/remixicon/fonts/remixicon.css');
  const SEARCH_INPUT_CSS_URL = overlayRuntime.getRuntimeUrl(chrome, 'src/shared/search/search-input.css');
  const FEATURE_HINTS_CSS_URL = overlayRuntime.getRuntimeUrl(chrome, 'src/shared/ui/feature-hints.css');
  const TOOLTIP_CSS_URL = overlayRuntime.getRuntimeUrl(chrome, 'src/shared/ui/tooltip.css');
  const CURSOR_TOOLTIP_CSS_URL = overlayRuntime.getRuntimeUrl(chrome, 'src/shared/ui/cursor-tooltip.css');
  const TOAST_CSS_URL = overlayRuntime.getRuntimeUrl(chrome, 'src/shared/ui/toast.css');
  const EXTERNAL_LINK_ICON_CSS_URL = overlayRuntime.getRuntimeUrl(chrome, 'src/shared/ui/external-link-icon.css');
  const OVERLAY_SUGGESTIONS_CSS_URL = overlayRuntime.getRuntimeUrl(chrome, 'src/overlay/suggestions-view.css');

  function stopOverlayPageThemeObserver() {
    if (overlayState.overlayPageThemeObserver) {
      overlayState.overlayPageThemeObserver.stop();
    }
  }

  const setInputScopedStyle = (element: HTMLElement | null, property: string, value: string): void => {
    if (!element) {
      return;
    }
    element.style.setProperty(property, value);
  };



  const {
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
    parseCssColor,
    stopOverlayPageThemeObserver,
    applyOverlayTheme,
    SETTINGS,
    OVERLAY_FONT_FAMILY_CSS_VAR,
    overlayState
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
    getThemeForMode,
    overlayState
  });
  faviconRuntime.onFaviconData(preloadThemeFromFavicon);

  const {
    getCommandMatches,
    isSlashCommandInput,
    getCommandMatch,
    buildCommandSuggestion,
    updateModeBadge,
    getNextThemeMode,
    isModeCommand,
    buildModeSuggestion,
    applyThemeModeChange,
    applyWebAppearanceMode,
    applyNextWebAppearanceMode
  } = PANEL_SLASH_COMMANDS.createSlashCommands({
    t: (...args) => t(...args),
    formatMessage: (...args) => formatMessage(...args),
    updateInputRightPadding: (...args) => updateInputRightPadding(...args),
    detectPageTheme,
    settings: overlayState.settings,
    applyOverlayTheme,
    updateSearchSuggestions,
    overlayState
  });

  const {
    syncOpenTabsScrollbarGutter,
    setOpenTabsResultsViewport,
    syncSearchModeMenuResultOffset,
    setOverlayResultsCollapsed,
    shouldShowOpenTabsForEmptyQuery,
    clearDefaultOpenTabsSuggestions,
    updateInputRightPadding,
    setSiteSearchTabHint,
    clearSiteSearchTabHint
  } = PANEL_RESULTS_LAYOUT.createResultsLayout({
    searchMode,
    normalizeSearchResultDisplayLimit,
    SUGGESTION_NAVIGATION,
    setInputScopedStyle,
    SUGGESTIONS_HEIGHT_LAYOUT,
    ensureOverlaySuggestionsView,
    suggestionItems,
    updateSelection,
    overlayState
  });

  const {
    applyOverlayCjkFontFace,
    applyLanguageStrings
  } = PANEL_PANEL_LANGUAGE.createPanelLanguage({
    searchMode,
    searchQuery,
    locale,
    updateModeBadge,
    setSiteSearchPrefix,
    getThemeForProvider,
    updateSiteSearchPrefixLayout,
    setLocalSearchScopePrefix,
    updateSearchSuggestions,
    requestTabsAndRender,
    applyInputActionLabels: () => applyInputActionLabels(),
    overlayState
  });
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

  // A custom width replaces the size's own; the size keeps its height cap
  // and content scale.
  function getOverlaySizePreset(mode: unknown): OverlaySizePreset {
    const preset = SETTINGS.getOverlaySizePreset(mode);
    const customWidth = SETTINGS.overlayWidth.parse(overlayState.settings.get(overlayWidth));
    return customWidth ? { ...preset, width: customWidth } : preset;
  }

  function startOverlayViewportSizeSync(overlayElement: HTMLElement): void {
    overlayState.overlayViewportSizeSync.start(overlayElement);
    overlayState.overlayNoticeLayer.sync(overlayElement);
  }

  // Check if the overlay already exists
  overlayState.overlay = overlayShell.findOverlayPanel(document, {
    hostId: OVERLAY_HOST_ID,
    id: OVERLAY_PANEL_ID
  });

  if (overlayState.overlay) {
    // A press while the overlay is still playing its exit reopens it: the
    // closing session is dropped at once and a fresh one mounts below.
    const shouldReplaceClosingOverlay =
      overlayState.overlay.getAttribute('data-lumno-overlay-exit') === 'running';
    const shouldReplaceExistingOverlay = shouldReplaceClosingOverlay ||
      isStaleOverlay(overlayState.overlay);
    if (ensureOverlayOpen && !shouldReplaceExistingOverlay) {
      setOverlayOpenState(true);
      return;
    }
    destroyExistingOverlaySession(overlayState.overlay, {
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
  const initialOverlaySizePreset = getOverlaySizePreset(overlayState.settings.get(overlaySizeMode));
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
  overlayState.overlay = overlayMount.panel;
  overlayState.overlayPanelView = overlayMount.view;
  const overlayHost = overlayMount.host;
  // The panel's shadow root, which holds its styles.
  const overlayStyleRoot = overlayMount.root;
  overlayState.overlayStyleRoot = overlayStyleRoot;
  setOverlayStoredContextToken(overlayState.overlay);
  addOverlaySessionCleanup(overlayLifecycle.onSessionDestroyRequest(overlayHost, (options) => {
    if (options.animateExit === true) closeOverlayWithMotion(overlayState.overlay);
    else removeOverlay(overlayState.overlay, options);
  }));
  overlayState.overlay.classList.add('x-lumno-search-entry');
  setOverlayMountVisibility(overlayHost, true);
  applyNoTranslate(overlayState.overlay);

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

  overlayState.overlayRevealGate = overlaySiteFixes.createOverlayRevealGate(window, {
    overlay: overlayState.overlay,
    styleRoot: overlayStyleRoot
  });

  // The first messages are in before the panel's copy is drawn; later
  // changes redraw it.
  const initialLanguageReady = locale.ready.then(() => {
    applyOverlayCjkFontFace(locale.store.getSnapshot().locale);
  }).catch(() => {});

  const inputParts = createSearchInput({
    container: overlayMount.inputContainer,
    styleRoot: overlayStyleRoot,
    placeholder: t('overlay_search_placeholder', t('search_placeholder', overlayState.defaultPlaceholderText)),
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
  overlayState.inputParts = inputParts;
  overlayState.searchInput = inputParts.input;
  applyOverlayInputExtensionIsolation(overlayState.searchInput);
  overlayState.inputContainer = overlayState.inputParts.container;
  const rightIcon = inputParts.rightIcon;
  overlayState.inputHistoryController =
    SEARCH_INPUT_HISTORY.createSearchInputHistoryController({
      storage: createSettingPort(overlayState.settings.store, searchInputHistory)
    });

  const {
    openOverlayCommunityQrDialog
  } = PANEL_PANEL_NOTICES.createPanelNotices({
    removeOverlay,
    COMMUNITY_LINKS,
    t,
    getOpenDisposition,
    locale,
    overlayState
  });

  applyNoTranslate(overlayState.searchInput);
  applyNoTranslate(overlayState.inputContainer);
  applyNoTranslate(rightIcon);
  const topActionTooltipController = LumnoTooltip.createController({
    documentObj: document,
    windowObj: window,
    id: '_x_extension_top_action_tooltip_2026_unique_',
    appendTo: overlayState.overlay,
    boundaryElement: overlayState.overlay,
    positionMode: 'absolute',
    maxWidth: 420,
    decorateElement: applyNoTranslate
  });
  overlayState.topActionTooltipController = topActionTooltipController;
  const overlayCursorTooltipController = LumnoCursorTooltip.createController({
    documentObj: document,
    windowObj: window,
    id: '_x_extension_overlay_cursor_tooltip_2026_unique_',
    appendTo: overlayState.overlay,
    boundaryElement: overlayState.overlay,
    positionMode: 'absolute',
    maxWidth: 520,
    offsetX: 14,
    offsetY: 16,
    decorateElement: applyNoTranslate
  });
  overlayState.overlayCursorTooltipController = overlayCursorTooltipController;
  const overlayModeMenuCursorTooltipController = LumnoCursorTooltip.createController({
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
      boundaryElement: overlayState.overlay,
      positionMode: 'absolute',
      maxWidth: 420,
      deferHideVisibility: true,
      preserveVisibleOnTargetSwitch: true,
      handoffRoot: overlayState.inputContainer
    });
  };
  const hideInputActionCursorTooltip = () => {
    overlayCursorTooltipController.hide();
  };
  const searchClearButton = inputParts.clearAction;
  inputParts.setChrome({
    tooltip: { bind: bindInputActionCursorTooltip, hide: hideInputActionCursorTooltip }
  });
  overlayState.modeBadge = overlayState.inputParts.modeBadge;

  const suggestionsContainer = overlayMount.suggestionsContainer;
  overlayState.suggestionsContainer = suggestionsContainer;
  applyNoTranslate(suggestionsContainer);
  suggestionsContainer.addEventListener('wheel', function(event) {
    SUGGESTION_NAVIGATION.preventNumberShortcutWheel(event, suggestionsContainer);
  }, { passive: false });
  overlayState.overlay.addEventListener('pointerdown', function() {
    SUGGESTION_NAVIGATION.cancelNumberShortcuts(suggestionsContainer);
  }, true);
  suggestionsContainer.addEventListener('animationend', (event) => {
    if (event.animationName !== '_x_ov_scope_result_enter_2026_unique_') {
      return;
    }
    suggestionsContainer.setAttribute('data-scope-result-enter', 'done');
  });
  overlayState.overlayWheelIsolationHandler = createOverlayWheelIsolationHandler(overlayState.overlay);
  overlayState.overlay.addEventListener('wheel', overlayState.overlayWheelIsolationHandler, { passive: false, capture: true });

  initialLanguageReady.then(() => {
    if (overlayState.overlay && overlayState.overlay.isConnected) {
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
    if (overlayState.inputModeController) {
      overlayState.inputModeController.resetModeMenuDoubleTab();
    }
    openSearchModeMenuFromDoubleTab();
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
    if (!overlayState.inputParts) {
      return;
    }
    overlayState.inputParts.setChrome({
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
      removeOverlay(overlayState.overlay);
    });
  }
  if (searchClearButton) {
    overlayState.inputParts.input.addEventListener('input', () => {
      if (overlayState.inputModeController) {
        overlayState.inputModeController.updateLayout();
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
    if (overlayState.searchInput) {
      overlayState.searchInput.focus({ preventScroll: true });
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
  overlayState.searchInput.addEventListener('focus', function() {
    overlayState.selectedIndex = -1;
    updateSelection();
    overlayState.suggestionInputPreview.restore(overlayState.searchInput, searchQuery.raw);
  });

  function isImeCompositionEvent(event: KeyboardEvent): boolean {
    return overlayState.imeKeyGuard.shouldIgnoreKeydown(event);
  }
  const defaultPlaceholder = overlayState.searchInput.placeholder;
  const attachFaviconData = faviconRuntime.attachFaviconData;
  const attachInputModeFaviconData =
    BundledIcons.createSiteSearchProviderIconHydrator(attachFaviconData);
  const refreshOverlayThemeAwareFavicons = faviconRuntime.refreshOverlayThemeAwareFavicons;
  const refreshOverlayFaviconsForPolicyChange = faviconRuntime.refreshOverlayFaviconsForPolicyChange;
  const defaultCaretColor = overlayState.searchInput.style.caretColor || 'var(--x-ext-input-caret, #7DB7FF)';
  const inputModePrefixTransition = 'opacity 140ms cubic-bezier(0.22, 1, 0.36, 1), transform 160ms cubic-bezier(0.22, 1, 0.36, 1), background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease, color 140ms ease';


  const settingsApplied = PANEL_SETTINGS_SYNC.createSettingsSync({
    searchMode,
    searchQuery,
    updateSearchSuggestions,
    applyOverlayTheme,
    searchEngine,
    clearLocalSearchScope,
    requestOverlaySearchSuggestions,
    shouldShowOpenTabsForEmptyQuery,
    renderTabSuggestions,
    filterTabsForOverlay,
    SUGGESTION_NAVIGATION,
    refreshOverlayFaviconsForPolicyChange,
    setSiteSearchPrefix,
    getImmediateThemeForSuggestion,
    requestTabsAndRender,
    clearDefaultOpenTabsSuggestions,
    documentPipSupported,
    applyOverlayFontFamily,
    overlayState
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

  overlayState.inputModeController = SEARCH_INPUT_MODE.createInputModeController(inputParts, {
    surface: 'overlay',
    prefixTransition: inputModePrefixTransition,
    defaultPlaceholder: overlayState.defaultPlaceholderText || defaultPlaceholder,
    getDefaultPlaceholder: () => overlayState.defaultPlaceholderText || defaultPlaceholder,
    defaultCaretColor,
    modeBadgeElement: overlayState.modeBadge,
    rightReserveBase: 92,
    rightAnchorOffset: 86,
    // The clear button adds a 30px slot plus a 6px gap left of the close-other-tabs button.
    getExtraRightInset: () => (inputParts.syncClearAction() ? 36 : 0),
    baseInputPaddingLeft: 50,
    setInputStyle: setInputScopedStyle,
    getThemeForMode,
    defaultTheme: overlayState.defaultTheme,
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
    getSiteSearchPrefixText,
    getSiteSearchDisplayName,
    isAiSiteSearchProvider,
    attachFaviconData: attachInputModeFaviconData,
    formatMessage,
    modeMenuDoubleTabDuration: OVERLAY_MODE_MENU_DOUBLE_TAB_DURATION_MS,
    modeMenuCursorTooltipController: overlayModeMenuCursorTooltipController,
    getModeMenuItems: getSearchModeMenuItems,
    onModeMenuSelect: selectSearchModeMenuItem,
    onModeMenuReorder: reorderSearchModeMenu,
    onModeMenuGroupMove: moveSearchModeMenuGroup,
    onModeMenuHistory: stepSearchModeMenuHistory,
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
  });
  syncSearchModeMenuResultOffset();
  if (typeof window.ResizeObserver === 'function') {
    const modeMenuResultResizeObserver = new window.ResizeObserver(
      syncSearchModeMenuResultOffset
    );
    modeMenuResultResizeObserver.observe(overlayState.suggestionsContainer);
    addOverlaySessionCleanup(() => {
      modeMenuResultResizeObserver.disconnect();
    });
  }
  siteSearchIconCache.load().then(() => {
    if (!searchMode.site || !overlayState.inputModeController) {
      return;
    }
    const activeProvider = searchMode.site;
    setSiteSearchPrefix(activeProvider, overlayState.defaultTheme);
    getThemeForProvider(activeProvider).then((theme) => {
      if (searchMode.site === activeProvider) {
        setSiteSearchPrefix(activeProvider, theme);
      }
    }).catch(() => {});
  });

  void siteSearchCatalog.loadProviders();
  siteSearchCatalog.loadAggregates().then(() => {
    if (overlayState.inputModeController) {
      overlayState.inputModeController.refreshModeMenu();
    }
    if (overlayState.searchInput && overlayState.searchInput.value) {
      syncSearchTriggerHintFromInput(overlayState.searchInput.value);
    }
    if (searchQuery.text) {
      requestOverlaySearchSuggestions(searchQuery.text);
    }
  });

  // A new order from Settings or another surface reaches an open scope
  // panel now; a closed one reads it when it opens.
  overlayState.settings.follow(searchSourceOrder, () => {
    if (overlayState.inputModeController) {
      overlayState.inputModeController.refreshModeMenu();
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
        setSiteSearchPrefix(updatedProvider, overlayState.defaultTheme, { animate: false });
      } else {
        clearSiteSearch();
      }
    }
    if (overlayState.inputModeController) {
      overlayState.inputModeController.refreshModeMenu();
    }
    if (searchQuery.text) {
      requestOverlaySearchSuggestions(searchQuery.text);
    }
  });

  overlayState.settings.follow(siteSearchIconCacheSetting, () => {
    siteSearchIconCache.applyStored(overlayState.settings.store.getStored(siteSearchIconCacheSetting));
    if (searchMode.site && overlayState.inputModeController) {
      const activeProvider = searchMode.site;
      setSiteSearchPrefix(activeProvider, overlayState.defaultTheme);
      getThemeForProvider(activeProvider).then((theme) => {
        if (searchMode.site === activeProvider) {
          setSiteSearchPrefix(activeProvider, theme);
        }
      }).catch(() => {});
    }
    if (overlayState.inputModeController) {
      overlayState.inputModeController.refreshModeMenu();
    }
    if (searchQuery.text) {
      requestOverlaySearchSuggestions(searchQuery.text);
    }
  });

  overlayState.searchInput.addEventListener('compositionstart', handleSearchInputCompositionStart);
  overlayState.searchInput.addEventListener('compositionend', handleSearchInputCompositionEnd);
  overlayState.searchInput.addEventListener('input', handleSearchInputEvent);
  overlayState.inputContainer.addEventListener('compositionstart', handleSearchInputCompositionStart, true);
  overlayState.inputContainer.addEventListener('compositionend', handleSearchInputCompositionEnd, true);
  overlayState.inputContainer.addEventListener('input', handleSearchInputEvent, true);
  const handleOverlayLoadingSessionSelection = (event: Event): void => {
    notifyOverlayLoadingSession(syncLiveSearchInputFromEvent(event));
  };
  overlayState.inputContainer.addEventListener('select', handleOverlayLoadingSessionSelection, true);
  overlayState.inputContainer.addEventListener('focusin', handleOverlayLoadingSessionSelection, true);
  overlayState.inputContainer.addEventListener('pointerup', handleOverlayLoadingSessionSelection, true);

  // Add click outside to close functionality
  overlayState.clickOutsideHandler = function(event) {
    const overlay = overlayState.overlay;
    if (!overlay) {
      return;
    }
    const eventPath = event.composedPath();
    const clickedInsideOverlay = eventPath.includes(overlay) || eventPath.includes(overlayHost);
    if (!clickedInsideOverlay) {
      closeOverlayWithMotion(overlay);
    }
  };
  document.addEventListener('click', overlayState.clickOutsideHandler);
  overlayState.searchInput.addEventListener('keydown', handleSearchInputKeydown);
  overlayState.searchInput.addEventListener('keypress', function(e) {
    if (!e.metaKey && !e.ctrlKey && !e.altKey) {
      e.stopPropagation();
    }
  });
  overlayState.searchInput.addEventListener('keyup', function(e) {
    syncSuggestionActionModifiersFromEvent(e);
    if (!e.metaKey && !e.ctrlKey && !e.altKey) {
      e.stopPropagation();
    }
  });

  function closeOverlayOnEscape(): void {
    if (overlayState.overlay) {
      closeOverlayWithMotion(overlayState.overlay);
    }
  }
  const overlayKeyRouter = new OVERLAY_KEYBOARD.OverlayKeyRouter(window, {
    getMount: () => ({
      document,
      host: getOverlayMountHost(overlayState.overlay),
      panel: overlayState.overlay
    }),
    isOverlayConnected: () => Boolean(overlayState.overlay && overlayState.overlay.isConnected),
    isKeyboardYielded: () => Boolean(document.getElementById(TAB_SWITCHER_HOST_ID)),
    isSearchInputActive,
    shouldHandleModeMenuKey: (e) => Boolean(
      overlayState.inputModeController &&
      typeof overlayState.inputModeController.shouldHandleModeMenuKeyEvent === 'function' &&
      overlayState.inputModeController.shouldHandleModeMenuKeyEvent(e)
    ),
    handleModeMenuKey(e) {
      if (!overlayState.inputModeController ||
          typeof overlayState.inputModeController.handleModeMenuKeyEvent !== 'function') {
        return false;
      }
      overlayState.inputModeController.handleModeMenuKeyEvent(e);
      return true;
    },
    isImeComposition: isImeCompositionEvent,
    onKeyUp: () => overlayState.imeKeyGuard.markKeyUp(),
    syncModifiers: syncSuggestionActionModifiersFromEvent,
    handleNumberShortcut: (e) => SUGGESTION_NAVIGATION.handleNumberShortcutKeyEvent(
      e,
      suggestionItems,
      overlayState.suggestionsContainer,
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
      setSuggestionActionModifiersActive(false, false, false);
      SUGGESTION_NAVIGATION.cancelNumberShortcuts(overlayState.suggestionsContainer);
    }
  });
  overlayKeyRouter.start();
  overlayState.overlayKeyRouter = overlayKeyRouter;
  addOverlaySessionCleanup(() => overlayKeyRouter.stop());

  if (!shouldShowOpenTabsForEmptyQuery()) {
    clearDefaultOpenTabsSuggestions();
  }
  applyNoTranslateDeep(overlayState.overlay);
  applyOverlayThemeVariables(overlayState.overlayThemeMode);
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
      overlayState.overlayViewportSizeSync.apply(overlayState.overlay);
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
  startOverlayViewportSizeSync(overlayState.overlay);
  overlayState.overlayNoticeLayer.startFrameSync(overlayState.overlay);
  startOverlayAntiTranslateObserver(overlayState.overlay);

  function focusOverlayInputForReveal() {
    if (!overlayState.searchInput || !overlayState.searchInput.isConnected) {
      return;
    }
    if (initialLoadingSession && initialLoadingSession.focused === false) {
      return;
    }
    overlayState.searchInput.focus({ preventScroll: true });
  }

  overlayState.settings.loaded.then(() => {
    const searchInput = overlayState.searchInput;
    if (!overlayState.overlay || !overlayState.overlay.isConnected || !searchInput) {
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
      overlayState.suppressOverlayLoadingSessionNotification = true;
      try {
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      } finally {
        overlayState.suppressOverlayLoadingSessionNotification = false;
      }
      return true;
    }
    return initialLanguageReady.catch(() => {}).then(() => {
      requestTabsAndRender();
      return true;
    });
  }).catch(() => false);

  const revealOverlay = (options: { forceInstant: boolean }): void => {
    if (!overlayState.overlay || !overlayState.overlay.isConnected) {
      return;
    }
    setOverlayMountVisibility(overlayHost, false);
    if (overlayState.overlayRevealGate) {
      overlayState.overlayRevealGate.release();
    }
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
      overlayState.overlay.style.setProperty('transition', 'none', 'important');
      overlayState.overlay.style.setProperty('opacity', '1', 'important');
      overlayState.overlay.style.setProperty('transform', revealTransform, 'important');
      finishOverlayPanelEnterAnimation(overlayState.overlay);
      overlayState.overlayNoticeLayer.scheduleMount(overlayState.overlay, overlayState.overlayStyleRoot, 0);
    } else {
      clearOverlayEnterAnimationFrames();
      overlayFrameTracker.runEnterAnimation(overlayState.overlay, () => {
        playOverlayPanelEnterAnimation(overlayState.overlay, revealTransform);
        overlayState.overlayNoticeLayer.scheduleMount(overlayState.overlay, overlayState.overlayStyleRoot, 360);
      });
    }
  };
  const revealReady = overlayState.overlayRevealGate
    ? overlayState.overlayRevealGate.waitUntilReady()
    : Promise.resolve({ ok: true, reason: 'no-site-fix' });
  Promise.all([
    Promise.resolve(revealReady).catch(() => null),
    settingsApplied.catch(() => {})
  ]).then((readyStates) => {
    if (!overlayState.overlay || !overlayState.overlay.isConnected) {
      return;
    }
    applyOverlayEnterAnimationInitialState(overlayState.overlay);
    const styleGateResult = readyStates[0];
    const revealGate = overlayState.overlayRevealGate;
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
  overlayState.overlayScrollPauseHandler = () => {
    pauseOverlayAntiTranslateObserverForScroll();
  };
  window.addEventListener('scroll', overlayState.overlayScrollPauseHandler, true);
  window.addEventListener('wheel', overlayState.overlayScrollPauseHandler, { passive: true, capture: true });
  window.addEventListener('touchmove', overlayState.overlayScrollPauseHandler, { passive: true, capture: true });

}

export { toggleSearchOverlay };
