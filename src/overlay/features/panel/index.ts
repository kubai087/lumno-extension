// The panel's session and looks: the favicon policy and runtime, the panel
// session (mount host, removal, key router and reveal gate), result
// activation, the panel's theme from the page, the site search provider icons
// and the suggestion themes.
import { buildTheme, defaultAccentColor } from '../../../shared/favicon/favicon-theme';
import { parseCssColor } from '../../../domain/color';
import * as LumnoOverlayFaviconView from '../../dom/favicon-view';
import * as PANEL_FAVICON_POLICY from '../../panel/favicon-policy';
import * as PANEL_PANEL_SESSION from '../../panel/panel-session';
import * as PANEL_PANEL_THEME from '../../panel/panel-theme';
import * as PANEL_RESULT_ACTIVATION from '../../panel/result-activation';
import * as PANEL_SITE_SEARCH_PROVIDERS from '../../panel/site-search-providers';
import * as PANEL_SUGGESTION_THEMES from '../../panel/suggestion-themes';
import { themeColorCache, themeHostCache } from '../../../shared/favicon/theme-caches';
import * as FaviconDecisionLog from '../../../domain/favicon/decision-log';
import * as FaviconHostPolicy from '../../../domain/favicon/host-policy';
import { setOverlayOpenState } from '../../../platform/content-registry';
import { findOverlayPanel } from '../../react/shell';
import { OVERLAY_HOST_ID, OVERLAY_PANEL_ID } from '../../../domain/injected-commands';
import type { OverlayContext } from '../../app/context';
import type { CoreFeature } from '../core';

// Favicon data and preloaded icons the overlay resolved, kept across its
// openings in this page.
const faviconDataCache = new Map<string, string>();
const faviconDataPending = new Map<string, Promise<string | null>>();
const iconPreloadCache = new Map<string, HTMLImageElement>();

interface PanelFeatureDeps {
  core: CoreFeature;
}

function createPanelFeature(ctx: OverlayContext, deps: PanelFeatureDeps) {
  const { elements, openOptions, overlaySessionCleanups, settings } = ctx;
  const {
    clearOverlayEnterAnimationFrames,
    clearOverlayPanelEnterCleanup,
    defaultTheme,
    notices,
    overlayMediaQuery,
    overlayNoticeLayer,
    overlayThemeChoice,
    overlayViewportSizeSync,
    pauseOverlayAntiTranslateObserverForScroll,
    stopOverlayAntiTranslateObserver
  } = deps.core;
  const { colorScheme, siteSearchIconCache, siteSearchRunner, suggestionSource } = deps.core;

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
    hasThemeForHost: (hostKey) => Boolean(hostKey && themeHostCache.has(hostKey))
  });
  // Themed icons follow the scheme the panel is drawn in.
  colorScheme.subscribe(() => faviconRuntime.refreshOverlayThemeAwareFavicons());

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
    stopOverlayAntiTranslateObserver
  });

  const {
    resultActivation,
    finishOverlayResultActivation,
    getOpenDisposition
  } = PANEL_RESULT_ACTIVATION.createResultActivation({
    elements,
    currentTabPinned: openOptions.currentTabPinned,
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

  // Finds a panel already on this page. An open one closes, or stays when
  // this opening must not toggle it; one still playing its exit, or left
  // stale, is dropped for this session's own. True when this session mounts
  // its panel.
  function claimPage(): boolean {
    elements.holdExisting(findOverlayPanel(document, {
      hostId: OVERLAY_HOST_ID,
      id: OVERLAY_PANEL_ID
    }));
    if (!elements.overlay) {
      return true;
    }
    const shouldReplaceExistingOverlay =
      elements.overlay.getAttribute('data-lumno-overlay-exit') === 'running' ||
      isStaleOverlay(elements.overlay);
    if (openOptions.ensureOpen && !shouldReplaceExistingOverlay) {
      setOverlayOpenState(true);
      return false;
    }
    destroyExistingOverlaySession(elements.overlay, {
      preserveLoadingIntent: shouldReplaceExistingOverlay,
      animateExit: !shouldReplaceExistingOverlay
    });
    return shouldReplaceExistingOverlay;
  }

  return {
    claimPage,
    applyMarkVariables,
    applyOverlayFontFamily,
    applyOverlayThemeVariables,
    applyThemeVariables,
    attachKeyRouter,
    attachRevealGate,
    closeOverlayWithMotion,
    createOverlayWheelIsolationHandler,
    destroyExistingOverlaySession,
    detectPageTheme,
    faviconRuntime,
    filterOverlayBlacklistedSuggestions,
    finishOverlayResultActivation,
    getBrandAccentForUrl,
    getChromeFaviconUrl,
    getHighlightColors,
    getHostFromUrl,
    getHoverColors,
    getImmediateThemeForSuggestion,
    getNeutralHoverActionColors,
    getOpenDisposition,
    getOverlayFaviconUrlResolver,
    getOverlayMountHost,
    getPageFaviconCandidateUrl,
    getPageRenderableProviderIcon,
    getProviderIcon,
    getProviderThemeHost,
    getThemeForMode,
    getThemeForProvider,
    getThemeForSuggestion,
    invalidatePageTheme,
    isLoadingSessionTracked,
    isLocalNetworkHost,
    isLocalNetworkInput,
    isOverlayDarkMode,
    isStaleOverlay,
    limitOverlaySuggestionsForDisplay,
    normalizeSearchResultDisplayLimit,
    notifyOverlayLoadingSession,
    openSiteSearchProviderQuery,
    panelThemeEvents,
    preloadThemeFromFavicon,
    removeOverlay,
    replayWithoutLoadingNotification,
    resultActivation,
    setOverlayMountVisibility,
    setOverlayStoredContextToken,
    shouldBlockOverlayFaviconForHost,
    syncOverlayPageThemeObservation,
    toPageRenderableIconUrl
  };
}

type PanelFeature = ReturnType<typeof createPanelFeature>;

export { createPanelFeature };
export type { PanelFeature };
