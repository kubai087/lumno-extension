'use strict';

window._x_extension_search_overlay_runtime_version_2026_unique_ =
  '2026-08-17-fast-reveal-navigation-intent-v10';
window._x_extension_search_overlay_open_2026_unique_ = false;

window._x_extension_toggleSearchOverlay_2026_unique_ = function(tabs, overlayContext) {
  let captureTabHandler = null;
  let overlayThemeStorageListener = null;
  let overlayLanguageStorageListener = null;
  let overlaySearchEngineStorageListener = null;
  let overlaySearchResultPriorityStorageListener = null;
  let overlaySearchResultSourceTypesStorageListener = null;
  let overlaySearchResultDisplayLimitStorageListener = null;
  let overlayNumberShortcutInstantStorageListener = null;
  let overlayMacosCtrlSuggestionNavigationStorageListener = null;
  let overlaySimpleModeStorageListener = null;
  let overlaySearchBlacklistStorageListener = null;
  let overlayFaviconEnhancedFetchStorageListener = null;
  let overlayOpenTabsDefaultVisibleStorageListener = null;
  let overlayDocumentPipStorageListener = null;
  let overlaySizeStorageListener = null;
  let overlayTabPriorityStorageListener = null;
  let overlayTabScoreDebugStorageListener = null;
  let overlayThemeMediaListener = null;
  let overlayPageThemeObserver = null;
  let overlayPageThemeSyncRaf = null;
  let siteSearchStorageListener = null;
  let siteSearchIconStorageListener = null;
  let keydownHandler = null;
  let keyupHandler = null;
  let overlayKeyCaptureHandler = null;
  let overlayModifierBlurHandler = null;
  let clickOutsideHandler = null;
  let overlayScrollPauseHandler = null;
  let overlayWheelIsolationHandler = null;
  let overlayRevealGate = null;
  let overlayUpdateNoticeController = null;
  let overlayEngagementNoticeController = null;
  let inputHistoryController = null;
  let isApplyingSearchInputHistory = false;
  let overlayUpdateNoticeFrameListener = null;
  let overlayUpdateNoticeFrameVisualViewport = null;
  let overlayUpdateNoticeMountTimer = null;
  let overlayEnterCleanupElement = null;
  let overlayEnterCleanupTimer = null;
  let overlayEnterTransitionEndHandler = null;
  let overlayEnterAnimations = [];
  let overlayEnterAnimationRevision = 0;
  let overlaySuggestionsView = null;
  let overlaySuggestionRequestSeq = 0;
  let overlayRemoteSuggestionDebounceTimer = null;
  let overlayFirstResultRevealTimer = null;
  let suppressOverlayLoadingSessionNotification = false;
  const OVERLAY_FIRST_RESULT_REVEAL_DELAY_MS = 120;
  let openInCurrentTabModifierActive = false;
  let openSwitchInNewTabModifierActive = false;
  let openInBackgroundTabModifierActive = false;
  function cancelPendingOverlaySuggestionRequests() {
    overlaySuggestionRequestSeq += 1;
    if (overlayRemoteSuggestionDebounceTimer) {
      clearTimeout(overlayRemoteSuggestionDebounceTimer);
      overlayRemoteSuggestionDebounceTimer = null;
    }
    if (overlayFirstResultRevealTimer) {
      clearTimeout(overlayFirstResultRevealTimer);
      overlayFirstResultRevealTimer = null;
    }
  }
  const OVERLAY_HOST_ID = '_x_extension_overlay_host_2026_unique_';
  const OVERLAY_PANEL_ID = '_x_extension_overlay_2024_unique_';
  const OVERLAY_CONTEXT_TOKEN_KEY = '__lumnoOverlayContextToken2026';
  const OVERLAY_CONTEXT_TOKEN_ATTRIBUTE = 'data-lumno-overlay-context-token';
  const overlayContextToken = getOrCreateOverlayContextToken();
  const SETTINGS = window.LumnoSettings || {};
  const NAVIGATION_DISPOSITION = window.LumnoNavigationDisposition || {};
  const SEARCH_UTILS = window.LumnoSearchUtils || {};
  const SITE_SEARCH_STORE = window.LumnoSiteSearchStore || {};
  const SHORTCUT_FAVICON = window.LumnoShortcutFavicon || {};
  const SUGGESTION_ACTION_MODEL = window.LumnoSuggestionActionModel || {};
  const SUGGESTION_NAVIGATION = window.LumnoSuggestionNavigation || {};
  const SEARCH_INPUT_HISTORY = window.LumnoSearchInputHistory || {};
  const OVERLAY_SUGGESTIONS_VIEW = window.LumnoOverlaySuggestionsView || {};
  const OVERLAY_TOAST = window.LumnoToast || {};
  const SEARCH_INPUT_MODE = window.LumnoSearchInputMode || {};
  const FEATURE_HINTS = window.LumnoFeatureHints || {};
  const UPDATE_NOTICE = window.LumnoUpdateNotice || {};
  const ENGAGEMENT_NOTICE = window.LumnoEngagementNotice || {};
  const FAVICON_UTILS = window.LumnoFaviconUtils || {};
  const FAVICON_THEME = window.LumnoNewtabFaviconTheme || {};
  const overlayRuntime = window.LumnoOverlayRuntime;
  const overlayLifecycle = window.LumnoOverlayLifecycle;
  const overlayFaviconView = window.LumnoOverlayFaviconView;
  const overlaySiteFixes = window.LumnoOverlaySiteFixes;
  const overlayPageTheme = window.LumnoOverlayPageTheme || {};
  if (!overlayRuntime ||
      !overlayRuntime.STORAGE_KEYS ||
      typeof overlayRuntime.getRuntimeUrl !== 'function' ||
      typeof overlayRuntime.getStorageArea !== 'function' ||
      typeof overlayRuntime.getStorageValues !== 'function' ||
      typeof overlayRuntime.loadLocaleMessages !== 'function') {
    console.warn('Lumno: overlay runtime helper not available.');
    return;
  }
  if (typeof SITE_SEARCH_STORE.loadSiteSearchProviders !== 'function' ||
      typeof SITE_SEARCH_STORE.mergeStoredProviders !== 'function') {
    console.warn('Lumno: site search store helper not available.');
    return;
  }
  if (typeof SUGGESTION_NAVIGATION.scrollItemIntoView !== 'function' ||
      typeof SUGGESTION_NAVIGATION.getVisibleRowsViewportHeight !== 'function') {
    console.warn('Lumno: suggestion navigation helper not available.');
    return;
  }
  if (typeof SUGGESTION_ACTION_MODEL.getSuggestionStructureIdentity !== 'function' ||
      typeof SUGGESTION_ACTION_MODEL.getSuggestionPresentationFingerprint !== 'function' ||
      typeof SUGGESTION_ACTION_MODEL.getSuggestionUpdateKind !== 'function') {
    console.warn('Lumno: suggestion action model helper not available.');
    return;
  }
  if (typeof SEARCH_INPUT_MODE.createInputModeController !== 'function') {
    console.warn('Lumno: search input mode helper not available.');
    return;
  }
  if (typeof OVERLAY_TOAST.createToastController !== 'function' ||
      typeof OVERLAY_TOAST.createToastStyleGate !== 'function') {
    console.warn('Lumno: overlay toast helper not available.');
    return;
  }
  if (!overlayLifecycle ||
      typeof overlayLifecycle.createFrameTracker !== 'function' ||
      typeof overlayLifecycle.createViewportSizeSync !== 'function' ||
      typeof overlayLifecycle.createMountConnectionGuard !== 'function' ||
      typeof overlayLifecycle.createAntiTranslateGuard !== 'function') {
    console.warn('Lumno: overlay lifecycle helper not available.');
    return;
  }
  if (!overlayFaviconView ||
      typeof overlayFaviconView.createOverlayFaviconViewRuntime !== 'function') {
    console.warn('Lumno: overlay favicon view helper not available.');
    return;
  }
  if (typeof FAVICON_THEME.buildTheme !== 'function' ||
      typeof FAVICON_THEME.getThemeForMode !== 'function' ||
      typeof FAVICON_THEME.getHoverColors !== 'function') {
    console.warn('Lumno: shared favicon theme helper not available.');
    return;
  }
  function getSearchUtilsRuntime() {
    return window.LumnoSearchUtils || SEARCH_UTILS || {};
  }
  function applyOverlayInputExtensionIsolation(input) {
    if (!input || typeof input.setAttribute !== 'function') {
      return;
    }
    const exclusionAttributes = {
      'data-1p-ignore': 'true',
      'data-op-ignore': 'true',
      'data-lpignore': 'true',
      'data-bwignore': 'true',
      'data-form-type': 'other',
      'data-gramm': 'false',
      'data-lt-active': 'false',
      'spellcheck': 'false',
      'writingsuggestions': 'false'
    };
    Object.entries(exclusionAttributes).forEach(([name, value]) => {
      input.setAttribute(name, value);
    });
  }
  const normalizedOverlayContext = (overlayContext && typeof overlayContext === 'object') ? overlayContext : {};
  const requestedTabZoomFactorRaw = Number(normalizedOverlayContext.tabZoomFactor);
  const initialPrefillQuery = typeof normalizedOverlayContext.prefillQuery === 'string'
    ? String(normalizedOverlayContext.prefillQuery).trim()
    : '';
  const prioritizeCurrentPageMatch = Boolean(normalizedOverlayContext.prioritizeCurrentPageMatch);
  const initialContextTabId = Number.isFinite(Number(normalizedOverlayContext.currentTabId))
    ? Number(normalizedOverlayContext.currentTabId)
    : null;
  const initialContextTabUrl = typeof normalizedOverlayContext.currentTabUrl === 'string'
    ? String(normalizedOverlayContext.currentTabUrl).trim()
    : '';
  const ensureOverlayOpen = normalizedOverlayContext.ensureOpen === true;
  const initialOverlayOpenStartedAtRaw = Number(normalizedOverlayContext.openedAt);
  const initialOverlayClockNow = Date.now();
  const initialOverlayOpenStartedAt = Number.isFinite(initialOverlayOpenStartedAtRaw) &&
    initialOverlayOpenStartedAtRaw <= initialOverlayClockNow + 1000 &&
    initialOverlayOpenStartedAtRaw >= initialOverlayClockNow - 60 * 1000
    ? initialOverlayOpenStartedAtRaw
    : initialOverlayClockNow;
  const OVERLAY_STARTUP_ENTRY_MOTION_BUDGET_MS = 280;
  let loadingSessionTrackingActive = normalizedOverlayContext.loadingSessionTracked === true;
  const rawLoadingSession = normalizedOverlayContext.loadingSession &&
    typeof normalizedOverlayContext.loadingSession === 'object'
    ? normalizedOverlayContext.loadingSession
    : null;
  const initialLoadingSession = rawLoadingSession &&
    typeof rawLoadingSession.inputValue === 'string'
    ? (() => {
        const inputValue = rawLoadingSession.inputValue;
        const inputLength = inputValue.length;
        const rawStart = Number(rawLoadingSession.selectionStart);
        const selectionStart = Number.isFinite(rawStart)
          ? Math.max(0, Math.min(inputLength, Math.trunc(rawStart)))
          : inputLength;
        const rawEnd = Number(rawLoadingSession.selectionEnd);
        const selectionEnd = Number.isFinite(rawEnd)
          ? Math.max(selectionStart, Math.min(inputLength, Math.trunc(rawEnd)))
          : selectionStart;
        return {
          inputValue,
          selectionStart,
          selectionEnd,
          selectionDirection: rawLoadingSession.selectionDirection === 'backward' ||
            rawLoadingSession.selectionDirection === 'forward'
            ? rawLoadingSession.selectionDirection
            : 'none',
          focused: rawLoadingSession.focused !== false
        };
      })()
    : null;
  function isLocalFileLikeOverlayUrl(url) {
    if (!url) {
      return false;
    }
    try {
      const parsed = new URL(url);
      const protocol = String(parsed.protocol || '').toLowerCase();
      if (protocol === 'file:') {
        return true;
      }
      const pathname = String(parsed.pathname || '').toLowerCase();
      const srcParam = parsed.searchParams ? parsed.searchParams.get('src') : '';
      if (pathname.endsWith('.pdf')) {
        return true;
      }
      if (srcParam) {
        try {
          const nested = new URL(srcParam);
          if (String(nested.protocol || '').toLowerCase() === 'file:') {
            return true;
          }
          if (String(nested.pathname || '').toLowerCase().endsWith('.pdf')) {
            return true;
          }
        } catch (e) {
          if (String(srcParam).toLowerCase().startsWith('file://') || String(srcParam).toLowerCase().includes('.pdf')) {
            return true;
          }
        }
      }
    } catch (e) {
      return String(url).toLowerCase().startsWith('file://') || String(url).toLowerCase().includes('.pdf');
    }
    return false;
  }
  const shouldIgnoreTabZoomCompensation = isLocalFileLikeOverlayUrl(initialContextTabUrl);
  const initialOverlayTabs = Array.isArray(tabs)
    ? tabs.map((tab) => ({
      ...tab,
      url: tab && typeof tab.url === 'string' ? String(tab.url).trim() : ''
    }))
    : [];
  const requestedTabZoomFactor = Number.isFinite(requestedTabZoomFactorRaw) && requestedTabZoomFactorRaw > 0
    ? requestedTabZoomFactorRaw
    : 1;
  const overlayFrameTracker = overlayLifecycle.createFrameTracker(window);
  const overlayViewportSizeSync = overlayLifecycle.createViewportSizeSync(window, {
    getSizePreset: () => getOverlaySizePreset(overlaySizeMode),
    getRequestedTabZoomFactor: () => requestedTabZoomFactor,
    shouldIgnoreTabZoomCompensation: () => shouldIgnoreTabZoomCompensation
  });
  const overlayAntiTranslateGuard = overlayLifecycle.createAntiTranslateGuard(window, {
    applyNoTranslate,
    applyNoTranslateDeep,
    restoreProtectedNode,
    restoreProtectedAncestors
  });
  const overlayStorageKeys = overlayRuntime.STORAGE_KEYS;
  const THEME_STORAGE_KEY = overlayStorageKeys.themeMode;
  const LANGUAGE_STORAGE_KEY = overlayStorageKeys.language;
  const DEFAULT_SEARCH_ENGINE_STORAGE_KEY = overlayStorageKeys.defaultSearchEngine;
  const OVERLAY_MODE_MENU_DOUBLE_TAB_DURATION_MS = 700;
  const OVERLAY_OPEN_TABS_PREFIX_FEEDBACK_DELAY_MS = 120;
  const SITE_SEARCH_STORAGE_KEY = overlayStorageKeys.siteSearchCustom;
  const SITE_SEARCH_DISABLED_STORAGE_KEY = overlayStorageKeys.siteSearchDisabled;
  const SITE_SEARCH_ICON_CACHE_STORAGE_KEY = overlayStorageKeys.siteSearchIconCache ||
    SHORTCUT_FAVICON.SITE_SEARCH_STORAGE_KEY ||
    '_x_extension_site_search_icon_cache_canonical_2026_unique_';
  const DOCUMENT_PIP_ENABLED_STORAGE_KEY = overlayStorageKeys.documentPipEnabled;
  const SEARCH_RESULT_PRIORITY_STORAGE_KEY = overlayStorageKeys.searchResultPriority;
  const SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY = overlayStorageKeys.searchResultSourceTypes;
  const SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY = overlayStorageKeys.searchResultDisplayLimit ||
    '_x_extension_search_result_display_limit_2026_unique_';
  const SEARCH_BLACKLIST_STORAGE_KEY = overlayStorageKeys.searchBlacklist;
  const FAVICON_REQUEST_BLACKLIST_STORAGE_KEY = overlayStorageKeys.faviconRequestBlacklist;
  const FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY = overlayStorageKeys.faviconEnhancedFetchEnabled;
  const OVERLAY_OPEN_TABS_DEFAULT_VISIBLE_STORAGE_KEY = overlayStorageKeys.overlayOpenTabsDefaultVisible;
  const OVERLAY_SIZE_MODE_STORAGE_KEY = overlayStorageKeys.overlaySizeMode;
  const OVERLAY_ENTER_ANIMATION_STORAGE_KEY = overlayStorageKeys.overlayEnterAnimation ||
    '_x_extension_overlay_enter_animation_2026_unique_';
  const OVERLAY_PAGE_THEME_ADAPTATION_ENABLED_STORAGE_KEY =
    overlayStorageKeys.overlayPageThemeAdaptationEnabled ||
    '_x_extension_overlay_page_theme_adaptation_enabled_2026_unique_';
  const MOTION_EFFECTS_ENABLED_STORAGE_KEY = overlayStorageKeys.motionEffectsEnabled ||
    '_x_extension_motion_effects_enabled_2026_unique_';
  const SIMPLE_MODE_ENABLED_STORAGE_KEY = overlayStorageKeys.simpleModeEnabled ||
    '_x_extension_simple_mode_enabled_2026_unique_';
  const NUMBER_SHORTCUT_INSTANT_ENABLED_STORAGE_KEY = overlayStorageKeys.numberShortcutInstantEnabled ||
    '_x_extension_number_shortcut_instant_enabled_2026_unique_';
  const MACOS_CTRL_SUGGESTION_NAVIGATION_ENABLED_STORAGE_KEY =
    overlayStorageKeys.macosCtrlSuggestionNavigationEnabled ||
    '_x_extension_macos_ctrl_suggestion_navigation_enabled_2026_unique_';
  const OVERLAY_TAB_PRIORITY_STORAGE_KEY = overlayStorageKeys.overlayTabPriority;
  const TAB_RANK_SCORE_DEBUG_STORAGE_KEY = overlayStorageKeys.tabRankScoreDebug;
  const storageRuntime = overlayRuntime.getStorageArea(chrome);
  const storageArea = storageRuntime.area;
  const storageAreaName = storageRuntime.name;
  function isPrimaryStorageAreaName(areaName) {
    return typeof storageRuntime.isActiveAreaName === 'function'
      ? storageRuntime.isActiveAreaName(areaName)
      : Boolean(storageAreaName) && areaName === storageAreaName;
  }
  const localStorageArea = chrome && chrome.storage && chrome.storage.local
    ? chrome.storage.local
    : storageArea;
  const RI_CSS_URL = overlayRuntime.getRuntimeUrl(chrome, 'assets/remixicon/fonts/remixicon.css');
  const OPEN_SANS_CSS_URL = overlayRuntime.getRuntimeUrl(chrome, 'assets/fonts/open-sans/open-sans.css');
  const SEARCH_INPUT_CSS_URL = overlayRuntime.getRuntimeUrl(chrome, 'src/shared/search-input.css');
  const FEATURE_HINTS_CSS_URL = overlayRuntime.getRuntimeUrl(chrome, 'src/shared/feature-hints.css');
  const TOOLTIP_CSS_URL = overlayRuntime.getRuntimeUrl(chrome, 'src/shared/tooltip.css');
  const CURSOR_TOOLTIP_CSS_URL = overlayRuntime.getRuntimeUrl(chrome, 'src/shared/cursor-tooltip.css');
  const TOAST_CSS_URL = overlayRuntime.getRuntimeUrl(chrome, 'src/shared/toast.css');
  const OVERLAY_SUGGESTIONS_CSS_URL = overlayRuntime.getRuntimeUrl(chrome, 'src/overlay/suggestions-view.css');
  const overlayMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  let overlayThemeMode = 'system';
  let overlaySearchResultPriorityMode = 'autocomplete';
  let overlaySearchResultDisplayLimit = 10;
  let overlaySizeMode = 'standard';
  let overlayEnterAnimation = 'elastic';
  let motionEffectsEnabled = true;
  let simpleModeEnabled = false;
  let overlayPageThemeAdaptationEnabled = true;
  const OVERLAY_ENTER_MOTION = Object.freeze({
    elastic: Object.freeze({
      opacityDurationMs: 130,
      panelDelayMs: 0,
      panelDurationMs: 210,
      panelEasing: 'cubic-bezier(0.18, 1.32, 0.32, 1)'
    }),
    fade: Object.freeze({
      opacityDurationMs: 220,
      panelDelayMs: 0,
      panelDurationMs: 340,
      panelEasing: 'cubic-bezier(0.2, 1, 0.36, 1)'
    })
  });
  const OVERLAY_ELASTIC_ENTRY_SCALE_START = 0.88;
  const OVERLAY_ELASTIC_OPEN_TABS_ENTRY_SCALE_START = 0.94;
  const OVERLAY_ENTER_CLEANUP_BUFFER_MS = 80;
  let overlaySearchBlacklistItems = [];
  let overlayFaviconRequestBlacklistItems = [];
  let faviconEnhancedFetchEnabled = false;
  let initialFaviconEnhancedFetchReady = Promise.resolve();
  let overlayOpenTabsDefaultVisible = true;
  let overlayOpenTabsDefaultVisibleLoaded = !storageArea;
  let initialOverlayOpenTabsDefaultVisibleReady = Promise.resolve();
  let documentPipEnabled = Boolean(normalizedOverlayContext.documentPipEnabled);
  let overlayThemeListenerAttached = false;
  let numberShortcutInstantEnabled = false;
  let macosCtrlSuggestionNavigationEnabled = false;
  const initialOverlaySettingsReady = overlayRuntime.getStorageValues(
    storageArea,
    [
      LANGUAGE_STORAGE_KEY,
      THEME_STORAGE_KEY,
      OVERLAY_PAGE_THEME_ADAPTATION_ENABLED_STORAGE_KEY,
      OVERLAY_SIZE_MODE_STORAGE_KEY,
      OVERLAY_ENTER_ANIMATION_STORAGE_KEY,
      MOTION_EFFECTS_ENABLED_STORAGE_KEY,
      SIMPLE_MODE_ENABLED_STORAGE_KEY,
      FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY,
      FAVICON_REQUEST_BLACKLIST_STORAGE_KEY,
      SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY,
      OVERLAY_OPEN_TABS_DEFAULT_VISIBLE_STORAGE_KEY,
      NUMBER_SHORTCUT_INSTANT_ENABLED_STORAGE_KEY,
      MACOS_CTRL_SUGGESTION_NAVIGATION_ENABLED_STORAGE_KEY
    ]
  ).catch(() => ({}));
  const initialOverlayEnterAnimationReady = initialOverlaySettingsReady.then((result) => {
    overlayEnterAnimation = normalizeOverlayEnterAnimation(
      result[OVERLAY_ENTER_ANIMATION_STORAGE_KEY]
    );
    return overlayEnterAnimation;
  });
  const initialMotionEffectsReady = initialOverlaySettingsReady.then((result) => {
    motionEffectsEnabled = typeof SETTINGS.normalizeMotionEffectsEnabled === 'function'
      ? SETTINGS.normalizeMotionEffectsEnabled(result[MOTION_EFFECTS_ENABLED_STORAGE_KEY])
      : result[MOTION_EFFECTS_ENABLED_STORAGE_KEY] !== false;
    return motionEffectsEnabled;
  });
  const initialSimpleModeReady = initialOverlaySettingsReady.then((result) => {
    const rawValue = result[SIMPLE_MODE_ENABLED_STORAGE_KEY];
    simpleModeEnabled = typeof SETTINGS.normalizeSimpleModeEnabled === 'function'
      ? SETTINGS.normalizeSimpleModeEnabled(rawValue)
      : rawValue === true;
    return simpleModeEnabled;
  });
  const initialSearchResultDisplayLimitReady = initialOverlaySettingsReady.then((result) => {
    const rawValue = result[SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY];
    overlaySearchResultDisplayLimit = normalizeSearchResultDisplayLimit(rawValue);
    if (storageArea && rawValue !== overlaySearchResultDisplayLimit) {
      storageArea.set({
        [SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY]: overlaySearchResultDisplayLimit
      });
    }
    return overlaySearchResultDisplayLimit;
  });
  const initialNumberShortcutInstantReady = initialOverlaySettingsReady.then((result) => {
    numberShortcutInstantEnabled = typeof SETTINGS.normalizeNumberShortcutInstantEnabled === 'function'
      ? SETTINGS.normalizeNumberShortcutInstantEnabled(result[NUMBER_SHORTCUT_INSTANT_ENABLED_STORAGE_KEY])
      : result[NUMBER_SHORTCUT_INSTANT_ENABLED_STORAGE_KEY] === true;
    return numberShortcutInstantEnabled;
  });
  const initialMacosCtrlSuggestionNavigationReady = initialOverlaySettingsReady.then((result) => {
    const rawValue = result[MACOS_CTRL_SUGGESTION_NAVIGATION_ENABLED_STORAGE_KEY];
    macosCtrlSuggestionNavigationEnabled =
      typeof SETTINGS.normalizeMacosCtrlSuggestionNavigationEnabled === 'function'
        ? SETTINGS.normalizeMacosCtrlSuggestionNavigationEnabled(rawValue)
        : rawValue === true;
    return macosCtrlSuggestionNavigationEnabled;
  });

  function normalizeOverlaySearchBlacklistItems(items) {
    if (globalThis.LumnoBlacklistUtils && typeof globalThis.LumnoBlacklistUtils.normalizeItems === 'function') {
      return globalThis.LumnoBlacklistUtils.normalizeItems(items, 'prefix');
    }
    return [];
  }

  function normalizeOverlayFaviconRequestBlacklistItems(items) {
    if (globalThis.LumnoBlacklistUtils && typeof globalThis.LumnoBlacklistUtils.normalizeItems === 'function') {
      return globalThis.LumnoBlacklistUtils.normalizeItems(items, 'prefix');
    }
    return [];
  }

  function getOverlayFaviconMatchUrl(url) {
    const raw = String(url || '').trim();
    return typeof FAVICON_UTILS.getCanonicalPageUrlForFavicon === 'function'
      ? String(FAVICON_UTILS.getCanonicalPageUrlForFavicon(raw) || raw)
      : raw;
  }

  function isUrlExcludedFromOverlayFaviconRequests(url) {
    const target = getOverlayFaviconMatchUrl(url);
    return Boolean(
      target &&
      globalThis.LumnoBlacklistUtils &&
      typeof globalThis.LumnoBlacklistUtils.isUrlBlocked === 'function' &&
      globalThis.LumnoBlacklistUtils.isUrlBlocked(target, overlayFaviconRequestBlacklistItems)
    );
  }

  function getOverlayStrictFaviconReason(pageUrl) {
    if (!faviconEnhancedFetchEnabled) {
      return 'global-off';
    }
    return isUrlExcludedFromOverlayFaviconRequests(pageUrl) ? 'exclusion' : '';
  }

  function isOverlayEnhancedFaviconFetchEnabled(pageUrl) {
    return getOverlayStrictFaviconReason(pageUrl) === '';
  }

  const logOverlayFaviconDecision = typeof FAVICON_UTILS.createFaviconDecisionLogger === 'function'
    ? FAVICON_UTILS.createFaviconDecisionLogger({ surface: 'overlay' })
    : (() => false);

  function isUrlBlockedByOverlaySearchBlacklist(url) {
    if (globalThis.LumnoBlacklistUtils && typeof globalThis.LumnoBlacklistUtils.isUrlBlocked === 'function') {
      return globalThis.LumnoBlacklistUtils.isUrlBlocked(url, overlaySearchBlacklistItems);
    }
    return false;
  }

  function isOverlaySuggestionBlockedBySearchBlacklist(suggestion, queryForProvider) {
    if (!suggestion) {
      return false;
    }
    if (
      suggestion.type === 'newtab' ||
      suggestion.type === 'siteSearch' ||
      suggestion.type === 'inlineSiteSearch' ||
      suggestion.type === 'siteSearchPrompt'
    ) {
      return false;
    }
    if (suggestion.url && isUrlBlockedByOverlaySearchBlacklist(suggestion.url)) {
      return true;
    }
    return false;
  }

  function filterOverlayBlacklistedSuggestions(list, queryForProvider) {
    if (!Array.isArray(list) || list.length === 0) {
      return [];
    }
    return list.filter((suggestion) => !isOverlaySuggestionBlockedBySearchBlacklist(suggestion, queryForProvider));
  }

  function normalizeSearchResultDisplayLimit(value) {
    if (typeof SETTINGS.normalizeSearchResultDisplayLimit === 'function') {
      return SETTINGS.normalizeSearchResultDisplayLimit(value);
    }
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 5 && parsed <= 10 ? parsed : 10;
  }

  function limitOverlaySuggestionsForDisplay(list, options) {
    const config = options && typeof options === 'object' ? options : {};
    if (config.uncapped === true) {
      return Array.isArray(list) ? list : [];
    }
    if (typeof SEARCH_UTILS.limitSearchSuggestionsForDisplay === 'function') {
      return SEARCH_UTILS.limitSearchSuggestionsForDisplay(list, {
        limit: overlaySearchResultDisplayLimit
      });
    }
    const suggestions = Array.isArray(list) ? list : [];
    return suggestions.slice(0, normalizeSearchResultDisplayLimit(overlaySearchResultDisplayLimit));
  }

  function loadOverlaySearchBlacklistItems(onReload) {
    if (!storageArea) {
      overlaySearchBlacklistItems = [];
      return;
    }
    storageArea.get([SEARCH_BLACKLIST_STORAGE_KEY], (result) => {
      overlaySearchBlacklistItems = normalizeOverlaySearchBlacklistItems(
        result ? result[SEARCH_BLACKLIST_STORAGE_KEY] : null
      );
      if (typeof onReload === 'function') {
        onReload();
      }
    });
  }

  function normalizeSearchResultPriority(value) {
    return typeof SETTINGS.normalizeSearchResultPriority === 'function'
      ? SETTINGS.normalizeSearchResultPriority(value)
      : (value === 'search' ? 'search' : 'autocomplete');
  }

  function normalizeFaviconEnhancedFetchEnabled(value) {
    return typeof SETTINGS.normalizeFaviconEnhancedFetchEnabled === 'function'
      ? SETTINGS.normalizeFaviconEnhancedFetchEnabled(value)
      : value !== false;
  }

  function normalizeOverlayOpenTabsDefaultVisible(value) {
    return typeof SETTINGS.normalizeOverlayOpenTabsDefaultVisible === 'function'
      ? SETTINGS.normalizeOverlayOpenTabsDefaultVisible(value)
      : value !== false;
  }

  function normalizeOverlayPageThemeAdaptationEnabled(value) {
    return typeof SETTINGS.normalizeOverlayPageThemeAdaptationEnabled === 'function'
      ? SETTINGS.normalizeOverlayPageThemeAdaptationEnabled(value)
      : value !== false;
  }

  function stopOverlayPageThemeObserver() {
    if (overlayPageThemeSyncRaf !== null) {
      cancelAnimationFrame(overlayPageThemeSyncRaf);
      overlayPageThemeSyncRaf = null;
    }
    if (overlayPageThemeObserver) {
      overlayPageThemeObserver.disconnect();
      overlayPageThemeObserver = null;
    }
  }

  function sanitizeDisplayText(text) {
    const raw = String(text || '');
    const withoutSpecial = raw.replace(/[\u0000-\u001F\u007F-\u009F\uFEFF\uFFF9-\uFFFD]|\p{Co}/gu, '');
    return withoutSpecial.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
  }

  function applyNoTranslate(element) {
    if (!element || !element.setAttribute) {
      return element;
    }
    element.setAttribute('translate', 'no');
    element.setAttribute('lang', 'zxx');
    element.setAttribute('notranslate', '');
    element.setAttribute('data-no-translate', 'true');
    if (element.classList) {
      element.classList.add('notranslate');
    }
    return element;
  }

  function applyNoTranslateDeep(root) {
    if (!root || typeof root !== 'object') {
      return root;
    }
    applyNoTranslate(root);
    if (!root.querySelectorAll) {
      return root;
    }
    root.querySelectorAll('*').forEach((element) => {
      applyNoTranslate(element);
    });
    return root;
  }

  function restoreProtectedNode(node) {
    return false;
  }

  function restoreProtectedAncestors(node, root) {
    return false;
  }

  function stopOverlayAntiTranslateObserver() {
    overlayAntiTranslateGuard.stop();
  }

  function pauseOverlayAntiTranslateObserverForScroll() {
    overlayAntiTranslateGuard.pauseForScroll();
  }

  function pauseOverlayAntiTranslateObserverForMutationBurst() {
    overlayAntiTranslateGuard.pauseForMutationBurst();
  }

  function startOverlayAntiTranslateObserver(root) {
    overlayAntiTranslateGuard.start(root);
  }

  let modeBadge = null;
  let inputModeController = null;
  let overlayLanguageMode = 'system';
  let overlayTabQuickSwitchEnabled = true;
  let overlayTabScoreDebugEnabled = false;
  let currentMessages = null;
  let defaultPlaceholderText = 'Search or enter URL...';
  let lastSuggestionResponse = [];
  let overlaySearchEngineState = {
    id: '',
    name: '',
    host: '',
    searchTemplate: ''
  };
  let overlaySearchEngineStateReady = Promise.resolve(overlaySearchEngineState);

  function ensureRemixIconStyles() {
    if (document.getElementById('_x_extension_remixicon_css_2024_unique_')) {
      return;
    }
    const host = document.head || document.documentElement;
    if (!host) {
      return;
    }
    const link = document.createElement('link');
    link.id = '_x_extension_remixicon_css_2024_unique_';
    link.rel = 'stylesheet';
    link.href = RI_CSS_URL;
    host.appendChild(link);
  }

  function ensureOpenSansStyles() {
    if (document.getElementById('_x_extension_open_sans_css_2024_unique_')) {
      return;
    }
    const host = document.head || document.documentElement;
    if (!host) {
      return;
    }
    const link = document.createElement('link');
    link.id = '_x_extension_open_sans_css_2024_unique_';
    link.rel = 'stylesheet';
    link.href = OPEN_SANS_CSS_URL;
    host.appendChild(link);
  }

  ensureOpenSansStyles();
  ensureRemixIconStyles();

  function normalizeLocale(locale) {
    return typeof SETTINGS.normalizeLocale === 'function'
      ? SETTINGS.normalizeLocale(locale)
      : 'en';
  }

  function getSystemLocale() {
    if (chrome && chrome.i18n && chrome.i18n.getUILanguage) {
      return normalizeLocale(chrome.i18n.getUILanguage());
    }
    return normalizeLocale(navigator.language || 'en');
  }

  function loadLocaleMessages(locale) {
    return overlayRuntime.loadLocaleMessages({
      chromeApi: chrome,
      locale,
      normalizeLocale
    });
  }

  function t(key, fallback) {
    if (currentMessages && currentMessages[key] && currentMessages[key].message) {
      return currentMessages[key].message;
    }
    if (chrome && chrome.i18n && chrome.i18n.getMessage) {
      const message = chrome.i18n.getMessage(key);
      if (message) {
        return message;
      }
    }
    return fallback || '';
  }

  function getStorageValuesAsync(keys) {
    return overlayRuntime.getStorageValues(storageArea, keys);
  }

  function loadPreferredLocaleMessages(locale, fallbackMessages) {
    return loadLocaleMessages(locale).then((messages) => {
      if (messages && Object.keys(messages).length > 0) {
        return messages;
      }
      return fallbackMessages || {};
    }).catch(() => fallbackMessages || {});
  }

  async function bootstrapOverlayLanguageForInitialRender(settingsReady) {
    const result = await Promise.resolve(settingsReady ||
      getStorageValuesAsync([LANGUAGE_STORAGE_KEY]));
    overlayLanguageMode = result[LANGUAGE_STORAGE_KEY] || 'system';
    const targetLocale = overlayLanguageMode === 'system'
      ? getSystemLocale()
      : normalizeLocale(overlayLanguageMode);
    currentMessages = await loadPreferredLocaleMessages(targetLocale, null);
  }

  function formatMessage(key, fallback, params) {
    let text = t(key, fallback);
    if (!params) {
      return text;
    }
    Object.keys(params).forEach((token) => {
      const value = params[token];
      text = text.replace(new RegExp(`\\{${token}\\}`, 'g'), value);
    });
    return text;
  }

  function normalizeOverlayTabPriorityMode(mode) {
    return typeof SETTINGS.normalizeOverlayTabPriorityMode === 'function'
      ? SETTINGS.normalizeOverlayTabPriorityMode(mode)
      : mode !== 'newtabFirst' && mode !== false;
  }

  function normalizeTabRankScoreDebugMode(mode) {
    return typeof SETTINGS.normalizeTabRankScoreDebugMode === 'function'
      ? SETTINGS.normalizeTabRankScoreDebugMode(mode)
      : mode === true;
  }

  function normalizeOverlaySizeMode(mode) {
    return typeof SETTINGS.normalizeOverlaySizeMode === 'function'
      ? SETTINGS.normalizeOverlaySizeMode(mode)
      : ((mode === 'compact' || mode === 'large') ? mode : 'standard');
  }

  function normalizeOverlayEnterAnimation(mode) {
    return typeof SETTINGS.normalizeOverlayEnterAnimation === 'function'
      ? SETTINGS.normalizeOverlayEnterAnimation(mode)
      : (mode === 'fade' ? 'fade' : 'elastic');
  }

  function shouldSkipOverlayEntryMotion() {
    if (typeof SETTINGS.shouldSkipEntryMotion === 'function') {
      return SETTINGS.shouldSkipEntryMotion(window, motionEffectsEnabled);
    }
    return motionEffectsEnabled === false ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function shouldSkipOverlayEntryMotionForSlowStartup() {
    return Date.now() - initialOverlayOpenStartedAt > OVERLAY_STARTUP_ENTRY_MOTION_BUDGET_MS;
  }

  function getOverlayEnterAnimationRevealTransform() {
    if (overlayEnterAnimation === 'fade') {
      return 'translateX(-50%) translateY(0) scale(var(--x-ov-visible-scale, 1)) scale(1)';
    }
    return 'translateX(-50%) translateY(0) scale(var(--x-ov-visible-scale, 1)) scaleX(1)';
  }

  function getOverlayElasticEntryScaleStart() {
    return overlayOpenTabsDefaultVisibleLoaded && overlayOpenTabsDefaultVisible
      ? OVERLAY_ELASTIC_OPEN_TABS_ENTRY_SCALE_START
      : OVERLAY_ELASTIC_ENTRY_SCALE_START;
  }

  function getOverlayEnterAnimationStartTransform() {
    if (overlayEnterAnimation === 'fade') {
      return 'translateX(-50%) translateY(16px) scale(var(--x-ov-visible-scale, 1)) scale(0.985)';
    }
    return `translateX(-50%) translateY(12px) scale(var(--x-ov-visible-scale, 1)) scaleX(var(--x-lumno-search-entry-scale-start, ${getOverlayElasticEntryScaleStart()}))`;
  }

  function getOverlayEnterAnimationDeltaTransform() {
    if (overlayEnterAnimation === 'fade') {
      return 'translateY(16px) scale(0.985)';
    }
    return `translateY(12px) scaleX(${getOverlayElasticEntryScaleStart()})`;
  }

  function getOverlayEnterMotion() {
    return OVERLAY_ENTER_MOTION[overlayEnterAnimation] ||
      OVERLAY_ENTER_MOTION.elastic;
  }

  function clearOverlayPanelEnterCleanup() {
    overlayEnterAnimationRevision += 1;
    if (overlayEnterCleanupTimer !== null) {
      clearTimeout(overlayEnterCleanupTimer);
      overlayEnterCleanupTimer = null;
    }
    if (overlayEnterCleanupElement && overlayEnterTransitionEndHandler) {
      overlayEnterCleanupElement.removeEventListener(
        'transitionend',
        overlayEnterTransitionEndHandler
      );
    }
    overlayEnterAnimations.forEach((animation) => {
      if (animation && typeof animation.cancel === 'function') {
        try {
          animation.cancel();
        } catch (error) {
          // A finished animation may already have released its effect.
        }
      }
    });
    overlayEnterAnimations = [];
    overlayEnterCleanupElement = null;
    overlayEnterTransitionEndHandler = null;
  }

  function finishOverlayPanelEnterAnimation(overlayElement, animationRevision) {
    if (!overlayElement ||
        (animationRevision && animationRevision !== overlayEnterAnimationRevision)) {
      return;
    }
    clearOverlayPanelEnterCleanup();
    overlayElement.style.setProperty('opacity', '1', 'important');
    overlayElement.style.setProperty(
      'transform',
      getOverlayEnterAnimationRevealTransform(),
      'important'
    );
    overlayElement.setAttribute('data-lumno-overlay-entry', 'done');
    overlayElement.style.removeProperty('transition');
    overlayElement.style.setProperty('will-change', 'auto', 'important');
    overlayElement.style.removeProperty('--x-lumno-search-entry-scale-start');
    overlayElement.style.removeProperty('--x-lumno-search-entry-duration');
    overlayElement.style.removeProperty('--x-lumno-search-entry-delay');
  }

  function trackOverlayPanelEnterAnimation(overlayElement, animations) {
    const animationRevision = overlayEnterAnimationRevision;
    overlayElement.setAttribute('data-lumno-overlay-entry', 'running');
    overlayEnterCleanupElement = overlayElement;
    overlayEnterAnimations = Array.isArray(animations)
      ? animations.filter(Boolean)
      : [];
    const primaryAnimation = overlayEnterAnimations[0] || null;
    if (primaryAnimation) {
      primaryAnimation.onfinish = () => {
        finishOverlayPanelEnterAnimation(overlayElement, animationRevision);
      };
    } else {
      overlayEnterTransitionEndHandler = (event) => {
        if (!event || event.target !== overlayElement || event.propertyName !== 'transform') {
          return;
        }
        finishOverlayPanelEnterAnimation(overlayElement, animationRevision);
      };
      overlayElement.addEventListener('transitionend', overlayEnterTransitionEndHandler);
    }
    const motion = getOverlayEnterMotion();
    const cleanupDelayMs = motion.panelDelayMs +
      motion.panelDurationMs + OVERLAY_ENTER_CLEANUP_BUFFER_MS;
    overlayEnterCleanupTimer = setTimeout(() => {
      overlayEnterCleanupTimer = null;
      finishOverlayPanelEnterAnimation(overlayElement, animationRevision);
    }, cleanupDelayMs);
    return animationRevision;
  }

  function applyOverlayEnterAnimationInitialState(overlayElement) {
    if (!overlayElement) {
      return;
    }
    clearOverlayPanelEnterCleanup();
    const motion = getOverlayEnterMotion();
    overlayElement.setAttribute('data-lumno-overlay-entry', 'prepared');
    overlayElement.style.setProperty('opacity', '0', 'important');
    overlayElement.style.setProperty('transition', 'none', 'important');
    overlayElement.style.setProperty('will-change', 'transform, opacity', 'important');
    if (overlayEnterAnimation !== 'fade') {
      overlayElement.style.setProperty(
        '--x-lumno-search-entry-scale-start',
        String(getOverlayElasticEntryScaleStart())
      );
    }
    overlayElement.style.setProperty('--x-lumno-search-entry-duration', `${motion.panelDurationMs}ms`);
    overlayElement.style.setProperty('--x-lumno-search-entry-delay', `${motion.panelDelayMs}ms`);
    overlayElement.style.setProperty(
      'transform',
      getOverlayEnterAnimationStartTransform(),
      'important'
    );
  }

  function playOverlayPanelEnterAnimation(overlayElement, revealTransform) {
    if (!overlayElement || !overlayElement.style) {
      return false;
    }
    clearOverlayPanelEnterCleanup();
    const motion = getOverlayEnterMotion();
    const startTransform = getOverlayEnterAnimationStartTransform();
    const deltaTransform = getOverlayEnterAnimationDeltaTransform();
    overlayElement.style.setProperty('transition', 'none', 'important');
    if (typeof overlayElement.animate === 'function') {
      let transformAnimation = null;
      let opacityAnimation = null;
      try {
        // WAAPI animation values sit below author !important declarations.
        // The shell reset stays at normal priority inside Shadow DOM, so only
        // the two animated longhands need their protected priority released.
        overlayElement.style.setProperty('will-change', 'transform, opacity', 'important');
        overlayElement.style.setProperty('opacity', '1');
        overlayElement.style.setProperty('transform', revealTransform);
        transformAnimation = overlayElement.animate([
          { transform: deltaTransform },
          { transform: 'none' }
        ], {
          composite: 'add',
          delay: motion.panelDelayMs,
          duration: motion.panelDurationMs,
          easing: motion.panelEasing,
          fill: 'backwards'
        });
        opacityAnimation = overlayElement.animate([
          { opacity: 0 },
          { opacity: 1 }
        ], {
          duration: motion.opacityDurationMs,
          easing: 'ease-out',
          fill: 'backwards'
        });
        trackOverlayPanelEnterAnimation(
          overlayElement,
          [transformAnimation, opacityAnimation]
        );
        return true;
      } catch (error) {
        [transformAnimation, opacityAnimation].forEach((animation) => {
          if (animation && typeof animation.cancel === 'function') {
            try {
              animation.cancel();
            } catch (cancelError) {
              // Continue into the CSS fallback with a clean protected state.
            }
          }
        });
        // Fall through to the CSS transition path for restricted documents.
      }
    }
    overlayElement.style.setProperty('opacity', '0', 'important');
    overlayElement.style.setProperty('transform', startTransform, 'important');
    overlayElement.style.setProperty(
      'transition',
      `transform ${motion.panelDurationMs}ms ${motion.panelEasing} ${motion.panelDelayMs}ms, opacity ${motion.opacityDurationMs}ms ease-out`,
      'important'
    );
    trackOverlayPanelEnterAnimation(overlayElement, []);
    overlayFrameTracker.runEnterAnimation(overlayElement, () => {
      overlayElement.style.setProperty('opacity', '1', 'important');
      overlayElement.style.setProperty('transform', revealTransform, 'important');
    });
    return true;
  }

  function getOverlaySizePreset(mode) {
    const normalizedMode = normalizeOverlaySizeMode(mode);
    if (normalizedMode === 'compact') {
      return { width: 680, maxHeightVh: 72, uiScale: 0.94 };
    }
    if (normalizedMode === 'large') {
      return { width: 840, maxHeightVh: 80, uiScale: 1.06 };
    }
    return { width: 760, maxHeightVh: 75, uiScale: 1 };
  }

  function formatTabRankDebugText(tab) {
    const scoreRaw = Number(tab && tab._xTabRankScore);
    const score = Number.isFinite(scoreRaw) ? scoreRaw.toFixed(2) : '0.00';
    const count30mRaw = Number(tab && tab._xTabSwitchCount30m);
    const count24hRaw = Number(tab && tab._xTabSwitchCount24h);
    const debugTotalRaw = Number(tab && tab._xTabDebugEventTotal);
    const lastAccessedRaw = Number(tab && tab._xTabLastAccessedRaw);
    const sortAtRaw = Number(tab && tab._xTabSortAt);
    const fetchSeqRaw = Number(tab && tab._xTabFetchSeq);
    const count30m = Number.isFinite(count30mRaw) ? Math.max(0, Math.round(count30mRaw)) : 0;
    const count24h = Number.isFinite(count24hRaw) ? Math.max(0, Math.round(count24hRaw)) : 0;
    const debugTotal = Number.isFinite(debugTotalRaw) ? Math.max(0, Math.round(debugTotalRaw)) : 0;
    const lastAccessedSec = Number.isFinite(lastAccessedRaw) && lastAccessedRaw > 0 ? Math.round(lastAccessedRaw / 1000) : 0;
    const sortAtSec = Number.isFinite(sortAtRaw) && sortAtRaw > 0 ? Math.round(sortAtRaw / 1000) : 0;
    const fetchSeq = Number.isFinite(fetchSeqRaw) ? Math.max(0, Math.round(fetchSeqRaw)) : 0;
    return `score ${score} · 30m ${count30m} · 24h ${count24h} · ev ${debugTotal} · la ${lastAccessedSec} · s ${sortAtSec} · fs ${fetchSeq} · build 20260308-1`;
  }

  function getRiSvg(id, sizeClass, extraClass) {
    const size = sizeClass || 'ri-size-16';
    const extra = extraClass ? ` ${extraClass}` : '';
    return '<i class="ri-icon ' + size + extra + ' ' + id + '" aria-hidden="true"></i>';
  }

  function buildSearchUrlFromTemplate(template, query) {
    if (!template) {
      return '';
    }
    return template.replace(/\{query\}/g, encodeURIComponent(query || ''));
  }

  function getOverlaySearchEngineState() {
    return overlaySearchEngineState || {};
  }

  function buildDefaultSearchUrlForOverlay(query) {
    const state = getOverlaySearchEngineState();
    if (state.searchTemplate) {
      return buildSearchUrlFromTemplate(state.searchTemplate, query);
    }
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  }

  function getDefaultSearchEngineFaviconUrlForOverlay() {
    if (!isOverlayEnhancedFaviconFetchEnabled(getDefaultSearchEngineThemeUrlForOverlay())) {
      return '';
    }
    const state = getOverlaySearchEngineState();
    if (state.id === 'google') {
      return 'https://www.gstatic.com/images/branding/googleg/1x/googleg_standard_color_128dp.png';
    }
    if (state.host) {
      return `https://${state.host}/favicon.ico`;
    }
    if (state.searchTemplate) {
      try {
        const url = buildSearchUrlFromTemplate(state.searchTemplate, 'test');
        const host = new URL(url).hostname;
        return `https://${host}/favicon.ico`;
      } catch (e) {
        return '';
      }
    }
    return 'https://www.gstatic.com/images/branding/googleg/1x/googleg_standard_color_128dp.png';
  }

  function getDefaultSearchEngineThemeUrlForOverlay() {
    const state = getOverlaySearchEngineState();
    if (state.searchTemplate) {
      return buildSearchUrlFromTemplate(state.searchTemplate, 'test');
    }
    if (state.host) {
      return `https://${state.host}`;
    }
    return 'https://www.google.com';
  }

  function getSearchActionLabel() {
    return t('action_search', '搜索');
  }

  function loadOverlaySearchEngineState(onReload) {
    if (!storageArea || typeof storageArea.get !== 'function') {
      return Promise.resolve(overlaySearchEngineState);
    }
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (settled) {
          return;
        }
        settled = true;
        const stored = result ? result[DEFAULT_SEARCH_ENGINE_STORAGE_KEY] : null;
        if (stored && stored.id &&
            (typeof SEARCH_UTILS.isRetiredSearchEngineState !== 'function' ||
              !SEARCH_UTILS.isRetiredSearchEngineState(stored))) {
          overlaySearchEngineState = stored;
          if (typeof onReload === 'function') {
            onReload();
          }
        }
        resolve(overlaySearchEngineState);
      };
      try {
        const maybePromise = storageArea.get([DEFAULT_SEARCH_ENGINE_STORAGE_KEY], finish);
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(finish, () => finish(null));
        }
      } catch (error) {
        finish(null);
      }
    });
  }


  function isLocalNetworkHost(hostname) {
    return typeof FAVICON_UTILS.isLocalNetworkHost === 'function'
      ? FAVICON_UTILS.isLocalNetworkHost(hostname)
      : false;
  }

  function isSuspiciousLocalFaviconHost(hostname) {
    return typeof FAVICON_UTILS.isSuspiciousLocalFaviconHost === 'function'
      ? FAVICON_UTILS.isSuspiciousLocalFaviconHost(hostname)
      : false;
  }

  function shouldBlockFaviconForHost(hostname) {
    return typeof FAVICON_UTILS.shouldBlockFaviconForHost === 'function'
      ? FAVICON_UTILS.shouldBlockFaviconForHost(hostname)
      : false;
  }

  function shouldAvoidDirectFaviconForHost(hostname) {
    return typeof FAVICON_UTILS.shouldAvoidDirectFaviconForHost === 'function'
      ? FAVICON_UTILS.shouldAvoidDirectFaviconForHost(hostname)
      : (isLocalNetworkHost(hostname) || isSuspiciousLocalFaviconHost(hostname));
  }

  function shouldBlockOverlayFaviconForHost(hostname) {
    return shouldBlockFaviconForHost(hostname);
  }

  let overlayFaviconUrlResolver = null;

  function getOverlayFaviconUrlResolver() {
    if (!overlayFaviconUrlResolver && typeof FAVICON_UTILS.createFaviconUrlResolver === 'function') {
      overlayFaviconUrlResolver = FAVICON_UTILS.createFaviconUrlResolver({
        chromeApi: chrome,
        size: 128,
        shouldBlockFaviconForHost: shouldBlockOverlayFaviconForHost,
        shouldAvoidDirectFaviconForHost,
        isEnhancedFaviconFetchEnabled: isOverlayEnhancedFaviconFetchEnabled,
        getStrictFaviconReason: getOverlayStrictFaviconReason,
        logFaviconDecision: logOverlayFaviconDecision,
        isBlockedLocalFaviconUrl: typeof FAVICON_UTILS.isBlockedLocalFaviconUrl === 'function'
          ? FAVICON_UTILS.isBlockedLocalFaviconUrl
          : null
      });
    }
    return overlayFaviconUrlResolver;
  }

  function isBrowserInternalPageUrl(url) {
    const resolver = getOverlayFaviconUrlResolver();
    return resolver ? resolver.isBrowserInternalPageUrl(url) : false;
  }

  function isBlockedOverlayFaviconPageUrl(url) {
    const resolver = getOverlayFaviconUrlResolver();
    return resolver ? resolver.isBlockedFaviconPageUrl(url) : false;
  }

  function isBlockedOverlayFaviconUrl(url) {
    const resolver = getOverlayFaviconUrlResolver();
    return resolver ? resolver.isBlockedFaviconUrl(url) : false;
  }

  function getSafeOverlayFaviconUrl(url) {
    const value = String(url || '').trim();
    return value && !isBlockedOverlayFaviconUrl(value) ? value : '';
  }

  function isLocalNetworkInput(input) {
    const raw = String(input || '').trim().toLowerCase();
    if (!raw) {
      return false;
    }
    const withoutScheme = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
    const authority = withoutScheme.split(/[/?#]/)[0] || '';
    const host = authority.includes('@') ? authority.split('@').pop() : authority;
    const normalizedHost = (() => {
      const value = String(host || '').trim().toLowerCase();
      if (!value) {
        return '';
      }
      if (value.startsWith('[')) {
        const endBracket = value.indexOf(']');
        if (endBracket > 1) {
          return value.slice(1, endBracket);
        }
      }
      return value.replace(/^\[|\]$/g, '').split(':')[0];
    })();
    if (!normalizedHost) {
      return false;
    }
    return isLocalNetworkHost(normalizedHost);
  }
  function clearOverlayEnterAnimationFrames() {
    overlayFrameTracker.clear();
  }

  function stopOverlayViewportSizeSync() {
    overlayViewportSizeSync.stop();
  }

  function syncOverlayUpdateNoticeFrame(overlayElement) {
    const noticeElement = overlayUpdateNoticeController && overlayUpdateNoticeController.element
      ? overlayUpdateNoticeController.element
      : null;
    const engagementNoticeElement =
      overlayEngagementNoticeController && overlayEngagementNoticeController.element
        ? overlayEngagementNoticeController.element
        : null;
    const noticeElements = [noticeElement, engagementNoticeElement].filter(Boolean);
    if (noticeElements.length === 0 || !overlayElement) {
      return;
    }
    const sizePreset = getOverlaySizePreset(overlaySizeMode);
    const width = overlayElement.style.getPropertyValue('width') || `${sizePreset.width}px`;
    const maxWidth = overlayElement.style.getPropertyValue('max-width') || 'calc(100vw - 24px)';
    const left = overlayElement.style.getPropertyValue('left') || '50%';
    const top = overlayElement.style.getPropertyValue('top') || '20vh';
    const visibleScale = overlayElement.style.getPropertyValue('--x-ov-visible-scale') || '1';
    noticeElements.forEach((element) => {
      element.style.setProperty('width', width, 'important');
      element.style.setProperty('max-width', maxWidth, 'important');
      element.style.setProperty('left', left, 'important');
      element.style.setProperty('top', top, 'important');
      element.style.setProperty('--x-ov-visible-scale', visibleScale, 'important');
      if (typeof element.style.removeProperty === 'function') {
        element.style.removeProperty('zoom');
      }
      element.setAttribute('data-theme', overlayElement.getAttribute('data-theme') || '');
    });
  }

  function stopOverlayUpdateNoticeFrameSync() {
    if (overlayUpdateNoticeFrameListener) {
      window.removeEventListener('resize', overlayUpdateNoticeFrameListener);
      if (overlayUpdateNoticeFrameVisualViewport &&
          typeof overlayUpdateNoticeFrameVisualViewport.removeEventListener === 'function') {
        overlayUpdateNoticeFrameVisualViewport.removeEventListener('resize', overlayUpdateNoticeFrameListener);
      }
      overlayUpdateNoticeFrameListener = null;
      overlayUpdateNoticeFrameVisualViewport = null;
    }
  }

  function clearOverlayUpdateNoticeMountTimer() {
    if (overlayUpdateNoticeMountTimer !== null) {
      clearTimeout(overlayUpdateNoticeMountTimer);
      overlayUpdateNoticeMountTimer = null;
    }
  }

  function startOverlayUpdateNoticeFrameSync(overlayElement) {
    stopOverlayUpdateNoticeFrameSync();
    if (!overlayElement) {
      return;
    }
    overlayUpdateNoticeFrameListener = () => {
      syncOverlayUpdateNoticeFrame(overlayElement);
    };
    window.addEventListener('resize', overlayUpdateNoticeFrameListener, { passive: true });
    if (window.visualViewport && typeof window.visualViewport.addEventListener === 'function') {
      window.visualViewport.addEventListener('resize', overlayUpdateNoticeFrameListener, { passive: true });
      overlayUpdateNoticeFrameVisualViewport = window.visualViewport;
    }
    syncOverlayUpdateNoticeFrame(overlayElement);
  }

  function applyOverlaySizeForPageZoom(overlayElement) {
    overlayViewportSizeSync.apply(overlayElement);
    syncOverlayUpdateNoticeFrame(overlayElement);
  }

  function startOverlayViewportSizeSync(overlayElement) {
    overlayViewportSizeSync.start(overlayElement);
    syncOverlayUpdateNoticeFrame(overlayElement);
  }

  function getOrCreateOverlayContextToken() {
    try {
      const storedToken = window[OVERLAY_CONTEXT_TOKEN_KEY];
      if (typeof storedToken === 'string' && storedToken) {
        return storedToken;
      }
    } catch (e) {
      // Fall through to a fresh token when the isolated world cannot persist it.
    }
    const nextToken = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
    try {
      window[OVERLAY_CONTEXT_TOKEN_KEY] = nextToken;
    } catch (e) {
      // The returned token is still useful for this invocation.
    }
    return nextToken;
  }

  function getOverlayMountHost(overlayElement) {
    if (!overlayElement) {
      return null;
    }
    if (overlayElement._lumnoOverlayHost) {
      return overlayElement._lumnoOverlayHost;
    }
    try {
      if (typeof overlayElement.getRootNode === 'function') {
        const root = overlayElement.getRootNode();
        if (root && root.host) {
          return root.host;
        }
      }
    } catch (e) {
      // Fall back to removing the element itself.
    }
    return overlayElement;
  }

  function getOverlayElementContextToken(element) {
    if (!element || typeof element.getAttribute !== 'function') {
      return '';
    }
    return String(element.getAttribute(OVERLAY_CONTEXT_TOKEN_ATTRIBUTE) || '').trim();
  }

  function setOverlayStoredContextToken(overlayElement) {
    const mountHost = getOverlayMountHost(overlayElement);
    [overlayElement, mountHost].forEach((element) => {
      if (element && typeof element.setAttribute === 'function') {
        element.setAttribute(OVERLAY_CONTEXT_TOKEN_ATTRIBUTE, overlayContextToken);
      }
    });
  }

  function getOverlayStoredContextToken(overlayElement) {
    return getOverlayElementContextToken(overlayElement) ||
      getOverlayElementContextToken(getOverlayMountHost(overlayElement));
  }

  function setOverlayMountVisibility(mountHost, hidden) {
    if (!mountHost || !mountHost.style || typeof mountHost.style.setProperty !== 'function') {
      return;
    }
    if (hidden) {
      mountHost.setAttribute('data-lumno-overlay-mount-hidden', 'true');
      mountHost.style.setProperty('visibility', 'hidden', 'important');
      return;
    }
    mountHost.removeAttribute('data-lumno-overlay-mount-hidden');
    if (typeof mountHost.style.removeProperty === 'function') {
      mountHost.style.removeProperty('visibility');
    }
  }

  function isStaleOverlay(overlayElement) {
    const storedToken = getOverlayStoredContextToken(overlayElement);
    return storedToken !== overlayContextToken;
  }

  function isScrollableOverflowValue(value) {
    return value === 'auto' || value === 'scroll' || value === 'overlay';
  }

  function canScrollByWheelDelta(scrollPosition, viewportSize, scrollSize, delta) {
    if (!delta) {
      return false;
    }
    const maxScroll = Math.max(0, scrollSize - viewportSize);
    if (maxScroll <= 0) {
      return false;
    }
    if (delta < 0) {
      return scrollPosition > 0;
    }
    return scrollPosition < maxScroll - 1;
  }

  function canScrollElementWithWheel(element, event) {
    if (!element || element.nodeType !== 1 || !event) {
      return false;
    }
    const doc = element.ownerDocument || document;
    if (element === doc.body || element === doc.documentElement) {
      return false;
    }
    const win = doc.defaultView || window;
    const style = win && typeof win.getComputedStyle === 'function'
      ? win.getComputedStyle(element)
      : null;
    if (!style) {
      return false;
    }
    const deltaY = Number(event.deltaY) || 0;
    const deltaX = Number(event.deltaX) || 0;
    const scrollHeight = Number(element.scrollHeight) || 0;
    const clientHeight = Number(element.clientHeight) || 0;
    const scrollWidth = Number(element.scrollWidth) || 0;
    const clientWidth = Number(element.clientWidth) || 0;
    const canScrollY = isScrollableOverflowValue(style.overflowY) &&
      scrollHeight > clientHeight + 1 &&
      canScrollByWheelDelta(Number(element.scrollTop) || 0, clientHeight, scrollHeight, deltaY);
    const canScrollX = isScrollableOverflowValue(style.overflowX) &&
      scrollWidth > clientWidth + 1 &&
      canScrollByWheelDelta(Number(element.scrollLeft) || 0, clientWidth, scrollWidth, deltaX);
    return canScrollY || canScrollX;
  }

  function findOverlayWheelScrollableElement(event, overlayElement) {
    if (!event || !overlayElement) {
      return null;
    }
    const path = typeof event.composedPath === 'function'
      ? event.composedPath()
      : [];
    for (const node of path) {
      if (node === overlayElement) {
        break;
      }
      if (canScrollElementWithWheel(node, event)) {
        return node;
      }
    }
    let current = event.target && event.target.nodeType === 1
      ? event.target
      : event.target && event.target.parentElement
        ? event.target.parentElement
        : null;
    while (current && current !== overlayElement) {
      if (canScrollElementWithWheel(current, event)) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  function createOverlayWheelIsolationHandler(overlayElement) {
    return function(event) {
      if (!event || !overlayElement || !overlayElement.isConnected) {
        return;
      }
      const path = typeof event.composedPath === 'function'
        ? event.composedPath()
        : [];
      const target = event.target;
      const isInsideOverlay = (target && overlayElement.contains(target)) || path.includes(overlayElement);
      if (!isInsideOverlay) {
        return;
      }
      event.stopPropagation();
      pauseOverlayAntiTranslateObserverForScroll();
      if (findOverlayWheelScrollableElement(event, overlayElement)) {
        return;
      }
      event.preventDefault();
    };
  }

  function notifyOverlayClosed() {
    if (!chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
      return;
    }
    try {
      chrome.runtime.sendMessage({ action: 'notifyOverlayClosed' }, () => {
        void chrome.runtime.lastError;
      });
    } catch (error) {
      // The document may already be unloading.
    }
  }

  function isOverlayInputFocused(input) {
    if (!input) {
      return false;
    }
    if (document.activeElement === input) {
      return true;
    }
    const root = typeof input.getRootNode === 'function' ? input.getRootNode() : null;
    return Boolean(root && root.activeElement === input);
  }

  function notifyOverlayLoadingSession(input) {
    if (suppressOverlayLoadingSessionNotification || !loadingSessionTrackingActive || !input ||
        !chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
      return;
    }
    const inputValue = typeof input.value === 'string' ? input.value : '';
    const inputLength = inputValue.length;
    const rawSelectionStart = Number(input.selectionStart);
    const selectionStart = Number.isFinite(rawSelectionStart)
      ? Math.max(0, Math.min(inputLength, Math.trunc(rawSelectionStart)))
      : inputLength;
    const rawSelectionEnd = Number(input.selectionEnd);
    const selectionEnd = Number.isFinite(rawSelectionEnd)
      ? Math.max(selectionStart, Math.min(inputLength, Math.trunc(rawSelectionEnd)))
      : selectionStart;
    try {
      chrome.runtime.sendMessage({
        action: 'updateOverlayLoadingSession',
        session: {
          inputValue,
          selectionStart,
          selectionEnd,
          selectionDirection: input.selectionDirection === 'backward' ||
            input.selectionDirection === 'forward'
            ? input.selectionDirection
            : 'none',
          focused: isOverlayInputFocused(input)
        }
      }, (response) => {
        if (chrome.runtime.lastError) {
          return;
        }
        if (response && response.tracked === false) {
          loadingSessionTrackingActive = false;
        }
      });
    } catch (error) {
      // The loading Document can be replaced between the input event and delivery.
    }
  }

  // Helper function to remove overlay and clean up styles
  function removeOverlay(overlayElement, options) {
    const removalOptions = options && typeof options === 'object' ? options : {};
    window._x_extension_search_overlay_open_2026_unique_ = false;
    if (removalOptions.preserveLoadingIntent !== true) {
      notifyOverlayClosed();
    }
    clearOverlayEnterAnimationFrames();
    clearOverlayPanelEnterCleanup();
    cancelPendingOverlaySuggestionRequests();
    const suggestionsHeightSettleTimer = overlayElement &&
      overlayElement._lumnoSuggestionsHeightSettleTimer;
    if (suggestionsHeightSettleTimer) {
      clearTimeout(suggestionsHeightSettleTimer);
      overlayElement._lumnoSuggestionsHeightSettleTimer = 0;
    }
    if (overlayRevealGate && typeof overlayRevealGate.cancel === 'function') {
      overlayRevealGate.cancel();
      overlayRevealGate = null;
    }
    stopOverlayViewportSizeSync();
    stopOverlayUpdateNoticeFrameSync();
    clearOverlayUpdateNoticeMountTimer();
    stopOverlayAntiTranslateObserver();
    if (overlayElement) {
      if (overlayWheelIsolationHandler) {
        overlayElement.removeEventListener('wheel', overlayWheelIsolationHandler, true);
        overlayWheelIsolationHandler = null;
      }
      const mountHost = getOverlayMountHost(overlayElement);
      const mountConnectionGuard = mountHost && mountHost._lumnoMountConnectionGuard;
      if (mountConnectionGuard && typeof mountConnectionGuard.stop === 'function') {
        mountConnectionGuard.stop();
      }
      if (mountHost) {
        mountHost._lumnoMountConnectionGuard = null;
      }
      const mountedSuggestionsView = overlayElement._lumnoSuggestionsView ||
        overlaySuggestionsView;
      if (mountedSuggestionsView &&
          typeof mountedSuggestionsView.destroy === 'function') {
        mountedSuggestionsView.destroy();
      }
      overlayElement._lumnoSuggestionsView = null;
      if (overlaySuggestionsView === mountedSuggestionsView) {
        overlaySuggestionsView = null;
      }
      const mountedToastController = overlayElement._lumnoToastController;
      if (mountedToastController &&
          typeof mountedToastController.destroy === 'function') {
        mountedToastController.destroy();
      }
      overlayElement._lumnoToastController = null;
      const mountedToastStyleGate = overlayElement._lumnoToastStyleGate;
      if (mountedToastStyleGate &&
          typeof mountedToastStyleGate.destroy === 'function') {
        mountedToastStyleGate.destroy();
      }
      overlayElement._lumnoToastStyleGate = null;
      const shellRuntime = window.LumnoOverlayShell || {};
      if (typeof shellRuntime.destroyOverlayMount === 'function') {
        shellRuntime.destroyOverlayMount(mountHost);
      }
      mountHost.remove();
    } else if (overlayWheelIsolationHandler) {
      overlayWheelIsolationHandler = null;
    }
    // Also remove the scrollbar style
    const scrollbarStyle = document.getElementById('_x_extension_scrollbar_style_2024_unique_');
    if (scrollbarStyle) {
      scrollbarStyle.remove();
    }
    const overlayThemeStyle = document.getElementById('_x_extension_overlay_theme_style_2024_unique_');
    if (overlayThemeStyle) {
      overlayThemeStyle.remove();
    }
    if (captureTabHandler) {
      document.removeEventListener('keydown', captureTabHandler, true);
      captureTabHandler = null;
    }
    if (keydownHandler) {
      document.removeEventListener('keydown', keydownHandler);
      keydownHandler = null;
    }
    if (keyupHandler) {
      document.removeEventListener('keyup', keyupHandler);
      keyupHandler = null;
    }
    if (clickOutsideHandler) {
      document.removeEventListener('click', clickOutsideHandler);
      clickOutsideHandler = null;
    }
    if (overlayKeyCaptureHandler) {
      window.removeEventListener('keydown', overlayKeyCaptureHandler, true);
      window.removeEventListener('keypress', overlayKeyCaptureHandler, true);
      window.removeEventListener('keyup', overlayKeyCaptureHandler, true);
      overlayKeyCaptureHandler = null;
    }
    if (overlayModifierBlurHandler) {
      window.removeEventListener('blur', overlayModifierBlurHandler);
      overlayModifierBlurHandler = null;
    }
    if (overlayThemeStorageListener) {
      chrome.storage.onChanged.removeListener(overlayThemeStorageListener);
      overlayThemeStorageListener = null;
    }
    if (overlayLanguageStorageListener) {
      chrome.storage.onChanged.removeListener(overlayLanguageStorageListener);
      overlayLanguageStorageListener = null;
    }
    if (overlaySearchEngineStorageListener) {
      chrome.storage.onChanged.removeListener(overlaySearchEngineStorageListener);
      overlaySearchEngineStorageListener = null;
    }
    if (overlaySearchResultPriorityStorageListener) {
      chrome.storage.onChanged.removeListener(overlaySearchResultPriorityStorageListener);
      overlaySearchResultPriorityStorageListener = null;
    }
    if (overlaySearchResultSourceTypesStorageListener) {
      chrome.storage.onChanged.removeListener(overlaySearchResultSourceTypesStorageListener);
      overlaySearchResultSourceTypesStorageListener = null;
    }
    if (overlaySearchResultDisplayLimitStorageListener) {
      chrome.storage.onChanged.removeListener(overlaySearchResultDisplayLimitStorageListener);
      overlaySearchResultDisplayLimitStorageListener = null;
    }
    if (overlayNumberShortcutInstantStorageListener) {
      chrome.storage.onChanged.removeListener(overlayNumberShortcutInstantStorageListener);
      overlayNumberShortcutInstantStorageListener = null;
    }
    if (overlayMacosCtrlSuggestionNavigationStorageListener) {
      chrome.storage.onChanged.removeListener(overlayMacosCtrlSuggestionNavigationStorageListener);
      overlayMacosCtrlSuggestionNavigationStorageListener = null;
    }
    if (overlaySimpleModeStorageListener) {
      chrome.storage.onChanged.removeListener(overlaySimpleModeStorageListener);
      overlaySimpleModeStorageListener = null;
    }
    if (overlaySearchBlacklistStorageListener) {
      chrome.storage.onChanged.removeListener(overlaySearchBlacklistStorageListener);
      overlaySearchBlacklistStorageListener = null;
    }
    if (overlayFaviconEnhancedFetchStorageListener) {
      chrome.storage.onChanged.removeListener(overlayFaviconEnhancedFetchStorageListener);
      overlayFaviconEnhancedFetchStorageListener = null;
    }
    if (overlayOpenTabsDefaultVisibleStorageListener) {
      chrome.storage.onChanged.removeListener(overlayOpenTabsDefaultVisibleStorageListener);
      overlayOpenTabsDefaultVisibleStorageListener = null;
    }
    if (overlayDocumentPipStorageListener) {
      chrome.storage.onChanged.removeListener(overlayDocumentPipStorageListener);
      overlayDocumentPipStorageListener = null;
    }
    if (overlayTabPriorityStorageListener) {
      chrome.storage.onChanged.removeListener(overlayTabPriorityStorageListener);
      overlayTabPriorityStorageListener = null;
    }
    if (overlayTabScoreDebugStorageListener) {
      chrome.storage.onChanged.removeListener(overlayTabScoreDebugStorageListener);
      overlayTabScoreDebugStorageListener = null;
    }
    if (overlaySizeStorageListener) {
      chrome.storage.onChanged.removeListener(overlaySizeStorageListener);
      overlaySizeStorageListener = null;
    }
    if (overlayThemeMediaListener) {
      overlayMediaQuery.removeEventListener('change', overlayThemeMediaListener);
      overlayThemeMediaListener = null;
    }
    if (overlayScrollPauseHandler) {
      window.removeEventListener('scroll', overlayScrollPauseHandler, true);
      window.removeEventListener('wheel', overlayScrollPauseHandler, true);
      window.removeEventListener('touchmove', overlayScrollPauseHandler, true);
      overlayScrollPauseHandler = null;
    }
    stopOverlayPageThemeObserver();
    if (siteSearchStorageListener) {
      chrome.storage.onChanged.removeListener(siteSearchStorageListener);
      siteSearchStorageListener = null;
    }
    if (siteSearchIconStorageListener) {
      chrome.storage.onChanged.removeListener(siteSearchIconStorageListener);
      siteSearchIconStorageListener = null;
    }
    if (inputModeController) {
      inputModeController.destroy();
      inputModeController = null;
    }
    const storedModeMenuCursorTooltipController = overlayElement &&
      overlayElement._lumnoModeMenuCursorTooltipController;
    if (storedModeMenuCursorTooltipController &&
        typeof storedModeMenuCursorTooltipController.destroy === 'function') {
      storedModeMenuCursorTooltipController.destroy();
    }
    if (overlayElement) {
      overlayElement._lumnoModeMenuCursorTooltipController = null;
    }
    const storedModeMenuResultResizeObserver = overlayElement &&
      overlayElement._lumnoModeMenuResultResizeObserver;
    if (storedModeMenuResultResizeObserver &&
        typeof storedModeMenuResultResizeObserver.disconnect === 'function') {
      storedModeMenuResultResizeObserver.disconnect();
    }
    if (overlayElement) {
      overlayElement._lumnoModeMenuResultResizeObserver = null;
    }
    const storedInputHistoryController =
      overlayElement && overlayElement._lumnoInputHistoryController;
    if (storedInputHistoryController &&
        typeof storedInputHistoryController.destroy === 'function') {
      storedInputHistoryController.destroy();
    }
    if (inputHistoryController === storedInputHistoryController) {
      inputHistoryController = null;
    }
    if (overlayElement) {
      overlayElement._lumnoInputHistoryController = null;
    }
    const storedUpdateNoticeController = overlayElement && overlayElement._lumnoUpdateNoticeController;
    if (storedUpdateNoticeController && typeof storedUpdateNoticeController.destroy === 'function') {
      if (storedUpdateNoticeController.element && storedUpdateNoticeController.element.parentNode) {
        storedUpdateNoticeController.element.parentNode.removeChild(storedUpdateNoticeController.element);
      }
      storedUpdateNoticeController.destroy();
      if (storedUpdateNoticeController === overlayUpdateNoticeController) {
        overlayUpdateNoticeController = null;
      }
      if (overlayElement) {
        overlayElement._lumnoUpdateNoticeController = null;
      }
    }
    if (overlayUpdateNoticeController && typeof overlayUpdateNoticeController.destroy === 'function') {
      if (overlayUpdateNoticeController.element && overlayUpdateNoticeController.element.parentNode) {
        overlayUpdateNoticeController.element.parentNode.removeChild(overlayUpdateNoticeController.element);
      }
      overlayUpdateNoticeController.destroy();
      overlayUpdateNoticeController = null;
    }
    const storedEngagementNoticeController =
      overlayElement && overlayElement._lumnoEngagementNoticeController;
    if (storedEngagementNoticeController &&
        typeof storedEngagementNoticeController.destroy === 'function') {
      if (storedEngagementNoticeController.element &&
          storedEngagementNoticeController.element.parentNode) {
        storedEngagementNoticeController.element.parentNode.removeChild(
          storedEngagementNoticeController.element
        );
      }
      storedEngagementNoticeController.destroy();
      if (storedEngagementNoticeController === overlayEngagementNoticeController) {
        overlayEngagementNoticeController = null;
      }
      if (overlayElement) {
        overlayElement._lumnoEngagementNoticeController = null;
      }
    }
    if (overlayEngagementNoticeController &&
        typeof overlayEngagementNoticeController.destroy === 'function') {
      if (overlayEngagementNoticeController.element &&
          overlayEngagementNoticeController.element.parentNode) {
        overlayEngagementNoticeController.element.parentNode.removeChild(
          overlayEngagementNoticeController.element
        );
      }
      overlayEngagementNoticeController.destroy();
      overlayEngagementNoticeController = null;
    }
  }

  const overlayShell = window.LumnoOverlayShell;

  // Check if the overlay already exists
  let overlay = overlayShell && typeof overlayShell.findOverlayPanel === 'function'
    ? overlayShell.findOverlayPanel(document, {
      hostId: OVERLAY_HOST_ID,
      id: OVERLAY_PANEL_ID
    })
    : document.getElementById(OVERLAY_PANEL_ID);

  let shouldReplaceExistingOverlay = false;
  if (overlay) {
    const shouldReplaceStaleOverlay = isStaleOverlay(overlay);
    shouldReplaceExistingOverlay = shouldReplaceStaleOverlay;
    if (ensureOverlayOpen && !shouldReplaceStaleOverlay) {
      window._x_extension_search_overlay_open_2026_unique_ = true;
      return;
    }
    removeOverlay(overlay, {
      preserveLoadingIntent: shouldReplaceStaleOverlay
    });
    if (!shouldReplaceStaleOverlay) {
      return;
    }
  }

  if (!overlay || shouldReplaceExistingOverlay) {
    // If it doesn't exist, create it (toggle on)
    if (!overlayShell ||
        typeof overlayShell.createOverlayMount !== 'function' ||
        typeof overlayShell.appendOverlayStyleNodes !== 'function') {
      console.warn('Lumno: overlay shell helper not available.');
      return;
    }
    const initialOverlaySizePreset = getOverlaySizePreset(overlaySizeMode);
    const overlayMount = overlayShell.createOverlayMount(document, {
      hostId: OVERLAY_HOST_ID,
      id: OVERLAY_PANEL_ID,
      width: initialOverlaySizePreset.width,
      maxHeightVh: initialOverlaySizePreset.maxHeightVh,
      openSansCssUrl: OPEN_SANS_CSS_URL,
      remixIconCssUrl: RI_CSS_URL,
      searchInputCssUrl: SEARCH_INPUT_CSS_URL,
      featureHintsCssUrl: FEATURE_HINTS_CSS_URL,
      tooltipCssUrl: TOOLTIP_CSS_URL,
      cursorTooltipCssUrl: CURSOR_TOOLTIP_CSS_URL,
      toastCssUrl: TOAST_CSS_URL,
      overlaySuggestionsCssUrl: OVERLAY_SUGGESTIONS_CSS_URL
    });
    overlay = overlayMount && overlayMount.panel ? overlayMount.panel : null;
    const overlayHost = overlayMount && overlayMount.host ? overlayMount.host : overlay;
    const overlayStyleRoot = overlayMount && overlayMount.root ? overlayMount.root : null;
    if (!overlay || !overlayHost) {
      console.warn('Lumno: overlay mount could not be created.');
      return;
    }
    setOverlayStoredContextToken(overlay);
    overlay.classList.add('x-lumno-search-entry');
    setOverlayMountVisibility(overlayHost, true);
    applyNoTranslate(overlay);

    let tabs = [];
    let currentOverlayTabId = null;
    if (initialOverlayTabs.length > 0) {
      tabs = initialOverlayTabs;
    }
    let overlayTabsCacheReady = initialOverlayTabs.length > 0;
    let overlayTabsRequestInFlight = false;
    let overlayTabsRequestSeq = 0;
    if (typeof initialContextTabId === 'number') {
      currentOverlayTabId = initialContextTabId;
    }
    let latestOverlayQuery = '';
    let latestRawInputValue = '';
    let lastDeletionAt = 0;
    let autocompleteState = null;
    let inlineSearchState = null;
    let siteSearchTriggerState = null;
    let localSearchScopeTriggerState = null;
    let siteSearchState = null;
    let localSearchScopeState = null;
    let enabledSearchResultSourceTypes = ['topSite', 'bookmark', 'history'];
    let openTabsSearchModeActive = false;
    let pendingOpenTabsPrefixEntryTimer = 0;
    const imeKeyGuard = LumnoImeKeyGuard.createImeKeyGuard();
    let selectedIndex = -1; // -1 means input is focused, 0+ means suggestion is selected
    const suggestionItems = [];
    let currentSuggestions = []; // Store current suggestions for keyboard navigation
    let lastRenderedQuery = '';
    let lastRenderedActionContextKey = '';

    const applyOverlayTheme = (mode) => {
      overlayThemeMode = mode;
      const previousResolvedTheme = overlay ? overlay.getAttribute('data-theme') : '';
      applyOverlayThemeVariables(overlay, mode);
      syncOverlayUpdateNoticeFrame(overlay);
      const nextResolvedTheme = overlay ? overlay.getAttribute('data-theme') : '';
      suggestionItems.forEach((item) => {
        if (item && item._xTheme) {
          applyThemeVariables(item, item._xTheme);
        }
      });
      updateSelection();
      updateModeBadge(searchInput ? searchInput.value : '');
      if (previousResolvedTheme !== nextResolvedTheme) {
        refreshOverlayThemeAwareFavicons();
      }
      if (overlayToastElement) {
        overlayToastElement.setAttribute('data-theme', nextResolvedTheme || 'light');
      }
      syncOverlayPageThemeObservation();
      if (mode === 'system') {
        if (!overlayThemeListenerAttached) {
          overlayThemeMediaListener = function() {
            if (overlayThemeMode === 'system') {
              // 仅更新容器变量会导致建议项主题变量滞后，系统主题切换时完整刷新。
              applyOverlayTheme('system');
            }
          };
          overlayMediaQuery.addEventListener('change', overlayThemeMediaListener);
          overlayThemeListenerAttached = true;
        }
        return;
      }
      if (overlayThemeListenerAttached) {
        overlayMediaQuery.removeEventListener('change', overlayThemeMediaListener);
        overlayThemeMediaListener = null;
        overlayThemeListenerAttached = false;
      }
    };

    // 使用系统字体，避免外链字体依赖。

    overlayShell.appendOverlayStyleNodes(document, {
      root: overlayStyleRoot,
      openSansCssUrl: OPEN_SANS_CSS_URL,
      remixIconCssUrl: RI_CSS_URL,
      searchInputCssUrl: SEARCH_INPUT_CSS_URL,
      featureHintsCssUrl: FEATURE_HINTS_CSS_URL,
      tooltipCssUrl: TOOLTIP_CSS_URL,
      cursorTooltipCssUrl: CURSOR_TOOLTIP_CSS_URL,
      toastCssUrl: TOAST_CSS_URL,
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
    const overlayToastStyleRoot = overlayStyleRoot || document;
    const overlayToastStylesheet = overlayToastStyleRoot &&
        typeof overlayToastStyleRoot.getElementById === 'function'
      ? overlayToastStyleRoot.getElementById('_x_extension_toast_style_2026_unique_')
      : (overlayToastStyleRoot && typeof overlayToastStyleRoot.querySelector === 'function'
        ? overlayToastStyleRoot.querySelector('#_x_extension_toast_style_2026_unique_')
        : null);
    const overlayToastStyleGate = OVERLAY_TOAST.createToastStyleGate(
      overlayToastElement,
      {
        windowObj: window,
        stylesheetElement: overlayToastStylesheet
      }
    );
    (overlayStyleRoot || overlayHost).appendChild(overlayToastElement);
    const overlayToastController = OVERLAY_TOAST.createToastController(
      overlayToastElement,
      { windowObj: window }
    );
    overlay._lumnoToastController = overlayToastController;
    overlay._lumnoToastStyleGate = overlayToastStyleGate;

    function hideOverlayToast() {
      if (overlayToastController && typeof overlayToastController.hide === 'function') {
        overlayToastController.hide();
      }
    }

    function showOverlayToast(message, isError, options) {
      if (overlayToastController && typeof overlayToastController.show === 'function') {
        overlayToastController.show(message, Object.assign({}, options, {
          error: Boolean(isError)
        }));
      }
    }

    const numberShortcutOptions = {
      onHoldStart: function() {
        showOverlayToast(t(
          'search_number_jump_release_hint',
          'Release to show numbers'
        ), false, { duration: 0 });
      },
      onHoldEnd: hideOverlayToast,
      instantActive: () => numberShortcutInstantEnabled
    };

    function fallbackCopyText(text) {
      if (!document || !document.body || typeof document.execCommand !== 'function') {
        return false;
      }
      const activeElement = document.activeElement;
      const textarea = document.createElement('textarea');
      textarea.value = String(text || '');
      textarea.setAttribute('readonly', '');
      textarea.style.setProperty('position', 'fixed');
      textarea.style.setProperty('left', '-9999px');
      textarea.style.setProperty('top', '0');
      document.body.appendChild(textarea);
      textarea.select();
      let copied = false;
      try {
        copied = document.execCommand('copy');
      } catch (error) {
        copied = false;
      }
      textarea.remove();
      if (activeElement && typeof activeElement.focus === 'function') {
        activeElement.focus({ preventScroll: true });
      }
      return copied;
    }

    function copyTextToClipboard(text) {
      const value = String(text || '');
      const clipboard = window.navigator && window.navigator.clipboard;
      if (clipboard && typeof clipboard.writeText === 'function') {
        return Promise.resolve(clipboard.writeText(value)).catch((error) => {
          if (fallbackCopyText(value)) {
            return true;
          }
          throw error;
        });
      }
      return fallbackCopyText(value)
        ? Promise.resolve(true)
        : Promise.reject(new Error('clipboard-write-failed'));
    }

    function copySearchResultUrl(url) {
      const value = String(url || '').trim();
      if (!value) {
        showOverlayToast(t(
          'search_copy_url_failed',
          'Could not copy result link'
        ), true);
        return Promise.resolve(false);
      }
      return copyTextToClipboard(value).then(() => {
        showOverlayToast(t(
          'search_copy_url_success',
          'Result link copied'
        ));
        return true;
      }).catch(() => {
        showOverlayToast(t(
          'search_copy_url_failed',
          'Could not copy result link'
        ), true);
        return false;
      });
    }

    overlayRevealGate = overlaySiteFixes && typeof overlaySiteFixes.createOverlayRevealGate === 'function'
      ? overlaySiteFixes.createOverlayRevealGate(window, {
        overlay,
        styleRoot: overlayStyleRoot || document.head || document.documentElement
      })
      : null;
    if (typeof window._x_extension_createSearchInput_2024_unique_ !== 'function') {
      console.warn('Lumno: input UI helper not available.');
      removeOverlay(overlay);
      return;
    }

    const initialLanguageReady = bootstrapOverlayLanguageForInitialRender(
      initialOverlaySettingsReady
    ).catch(() => {});

    const inputUsesIsolatedStyles = Boolean(overlayStyleRoot);
    const inputParts = window._x_extension_createSearchInput_2024_unique_({
      styleRoot: overlayStyleRoot,
      useIsolatedStyles: inputUsesIsolatedStyles,
      useInlineBaseStyles: !inputUsesIsolatedStyles,
      placeholder: t('overlay_search_placeholder', t('search_placeholder', defaultPlaceholderText)),
      inputId: '_x_extension_search_input_2024_unique_',
      iconId: '_x_extension_search_icon_2024_unique_',
      containerId: '_x_extension_input_container_2024_unique_',
      rightIconUrl: chrome.runtime.getURL('assets/images/lumno-input-light.png'),
      containerStyleOverrides: {
        height: '56px',
        'min-height': '56px',
        'max-height': '56px',
        'border-radius': 'var(--x-ov-panel-radius, 28px) var(--x-ov-panel-radius, 28px) 0 0',
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
      secondaryAction: {
        id: '_x_extension_search_close_other_tabs_2026_unique_',
        className: 'x-ov-close-other-tabs',
        ariaLabel: t('overlay_close_other_tabs_tooltip', '关闭其他标签页'),
        html: getRiSvg('ri-brush-2-line', 'ri-size-16')
      },
      modeBadge: {
        id: '_x_extension_mode_badge_2024_unique_',
        className: 'x-lumno-search-input-mode__badge',
        surface: 'overlay',
        visible: false
      },
      showUnderlineWhenEmpty: true
    });
    let searchInput = inputParts.input;
    applyOverlayInputExtensionIsolation(searchInput);
    const inputContainer = inputParts.container;
    const searchScopeIcon = inputParts.icon;
    const rightIcon = inputParts.rightIcon;
    inputHistoryController =
      typeof SEARCH_INPUT_HISTORY.createSearchInputHistoryController === 'function'
        ? SEARCH_INPUT_HISTORY.createSearchInputHistoryController({
            storageArea: chrome && chrome.storage
              ? (chrome.storage.local || storageArea)
              : storageArea,
            storageChanges: chrome && chrome.storage ? chrome.storage.onChanged : null,
            storageAreaName: chrome && chrome.storage && chrome.storage.local
              ? 'local'
              : storageAreaName
          })
        : null;
    overlay._lumnoInputHistoryController = inputHistoryController;
    const handledSearchInputEvents = new WeakSet();
    function overlayUpdateNoticeClaimsSessionSlot() {
      return Boolean(
        overlayUpdateNoticeController &&
        typeof overlayUpdateNoticeController.hasSessionSlot === 'function' &&
        overlayUpdateNoticeController.hasSessionSlot()
      );
    }
    overlayUpdateNoticeController = typeof UPDATE_NOTICE.createUpdateNotice === 'function'
      ? UPDATE_NOTICE.createUpdateNotice({
        documentObj: document,
        featureHints: FEATURE_HINTS,
        chromeApi: chrome,
        surface: 'overlay',
        t,
        getRiSvg,
        onSessionSlotClaimed() {
          if (overlayEngagementNoticeController &&
              typeof overlayEngagementNoticeController.suppressForSession === 'function') {
            overlayEngagementNoticeController.suppressForSession();
          }
        },
        onDetailsClick(_notice, event) {
          chrome.runtime.sendMessage({
            action: 'openReleasePage',
            reason: 'notice',
            disposition: getOpenDisposition(event, 'newTab')
          });
        }
      })
      : null;
    if (overlayUpdateNoticeController) {
      overlay._lumnoUpdateNoticeController = overlayUpdateNoticeController;
    }
    overlayEngagementNoticeController =
      typeof ENGAGEMENT_NOTICE.createEngagementNotice === 'function'
        ? ENGAGEMENT_NOTICE.createEngagementNotice({
          documentObj: document,
          featureHints: FEATURE_HINTS,
          chromeApi: chrome,
          surface: 'overlay',
          locale: overlayLanguageMode === 'system'
            ? getSystemLocale()
            : normalizeLocale(overlayLanguageMode),
          t,
          getRiSvg,
          exposureGate: overlayUpdateNoticeController && overlayUpdateNoticeController.ready,
          canShow() {
            const updateNoticeVisible = Boolean(
              overlayUpdateNoticeController &&
              overlayUpdateNoticeController.element &&
              overlayUpdateNoticeController.element.getAttribute('data-visible') === 'true'
            );
            return !updateNoticeVisible &&
              !overlayUpdateNoticeClaimsSessionSlot() &&
              document.visibilityState === 'visible' &&
              overlay &&
              overlay.isConnected &&
              !String(searchInput.value || '').trim();
          },
          onReview(event) {
            chrome.runtime.sendMessage({
              action: 'createTab',
              url: ENGAGEMENT_NOTICE.REVIEW_URL,
              disposition: getOpenDisposition(event, 'newTab')
            });
          },
          onCommunity(event) {
            const disposition = getOpenDisposition(event, 'newTab');
            const communityUrlPromise =
              typeof ENGAGEMENT_NOTICE.loadCommunityUrl === 'function'
                ? ENGAGEMENT_NOTICE.loadCommunityUrl({
                  force: true,
                  locale: overlayLanguageMode === 'system'
                    ? getSystemLocale()
                    : normalizeLocale(overlayLanguageMode)
                })
                : Promise.resolve(ENGAGEMENT_NOTICE.WECHAT_QR_URL);
            communityUrlPromise.then((url) => {
              chrome.runtime.sendMessage({
                action: 'createTab',
                url,
                disposition
              });
            });
          }
        })
        : null;
    if (overlayEngagementNoticeController) {
      overlay._lumnoEngagementNoticeController = overlayEngagementNoticeController;
    }
    function shouldAnimateOverlayUpdateNoticeMount(noticeElement) {
      if (!noticeElement || noticeElement.getAttribute('data-visible') !== 'true') {
        return false;
      }
      return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function finishOverlayUpdateNoticeMountAnimation(noticeElement) {
      if (noticeElement) {
        noticeElement.removeAttribute('data-overlay-mounting');
      }
    }

    function mountOverlayUpdateNotice() {
      const noticeElement = overlayUpdateNoticeController && overlayUpdateNoticeController.element
        ? overlayUpdateNoticeController.element
        : null;
      if (!noticeElement || noticeElement.parentNode) {
        return;
      }
      const animateMount = shouldAnimateOverlayUpdateNoticeMount(noticeElement);
      if (animateMount) {
        noticeElement.setAttribute('data-overlay-mounting', 'true');
      }
      applyNoTranslateDeep(noticeElement);
      if (overlayStyleRoot && typeof overlayStyleRoot.insertBefore === 'function') {
        overlayStyleRoot.insertBefore(noticeElement, overlay);
      } else if (document.body) {
        document.body.appendChild(noticeElement);
      }
      syncOverlayUpdateNoticeFrame(overlay);
      if (animateMount) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            finishOverlayUpdateNoticeMountAnimation(noticeElement);
          });
        });
      } else {
        finishOverlayUpdateNoticeMountAnimation(noticeElement);
      }
      const engagementNoticeElement =
        overlayEngagementNoticeController && overlayEngagementNoticeController.element
          ? overlayEngagementNoticeController.element
          : null;
      if (engagementNoticeElement && !engagementNoticeElement.parentNode) {
        applyNoTranslateDeep(engagementNoticeElement);
        if (overlayStyleRoot && typeof overlayStyleRoot.insertBefore === 'function') {
          overlayStyleRoot.insertBefore(engagementNoticeElement, overlay);
        } else if (document.body) {
          document.body.appendChild(engagementNoticeElement);
        }
        syncOverlayUpdateNoticeFrame(overlay);
      }
    }
    const setInputScopedStyle = (element, property, value) => {
      if (!element) {
        return;
      }
      element.style.setProperty(property, value, inputUsesIsolatedStyles ? '' : 'important');
    };
    const setOverlayPanelScopedStyle = (element, property, value) => {
      if (!element) {
        return;
      }
      element.style.setProperty(property, value, 'important');
    };
    applyNoTranslate(searchInput);
    applyNoTranslate(inputContainer);
    applyNoTranslate(rightIcon);
    const topActionTooltipController = window.LumnoTooltip &&
        typeof window.LumnoTooltip.createController === 'function'
      ? window.LumnoTooltip.createController({
        documentObj: document,
        windowObj: window,
        id: '_x_extension_top_action_tooltip_2026_unique_',
        appendTo: overlay,
        boundaryElement: overlay,
        positionMode: 'absolute',
        maxWidth: 420,
        decorateElement: applyNoTranslate
      })
      : null;
    const overlayCursorTooltipController = window.LumnoCursorTooltip &&
        typeof window.LumnoCursorTooltip.createController === 'function'
      ? window.LumnoCursorTooltip.createController({
        documentObj: document,
        windowObj: window,
        id: '_x_extension_overlay_cursor_tooltip_2026_unique_',
        appendTo: overlay,
        boundaryElement: overlay,
        positionMode: 'absolute',
        maxWidth: 520,
        offsetX: 14,
        offsetY: 16,
        decorateElement: applyNoTranslate
      })
      : null;
    const overlayModeMenuCursorTooltipController = window.LumnoCursorTooltip &&
        typeof window.LumnoCursorTooltip.createController === 'function'
      ? window.LumnoCursorTooltip.createController({
        documentObj: document,
        windowObj: window,
        id: '_x_extension_overlay_mode_menu_cursor_tooltip_2026_unique_',
        appendTo: overlayStyleRoot || document.body,
        positionMode: 'fixed',
        maxWidth: 320,
        offsetX: 14,
        offsetY: 16,
        decorateElement: (element) => {
          applyNoTranslate(element);
          element.style.setProperty('--x-extension-tooltip-z-index', '2147483647');
        }
      })
      : null;
    overlay._lumnoModeMenuCursorTooltipController =
      overlayModeMenuCursorTooltipController;
    const showTopActionTooltip = (button, text) => {
      if (!topActionTooltipController || !button || !text) {
        return;
      }
      topActionTooltipController.show(button, text, {
        boundaryElement: overlay,
        positionMode: 'absolute',
        maxWidth: 420
      });
    };
    const hideTopActionTooltip = () => {
      if (!topActionTooltipController) {
        return;
      }
      topActionTooltipController.hide();
    };
    const bindInputActionCursorTooltip = (button, getText) => {
      if (!overlayCursorTooltipController || !button) {
        return;
      }
      overlayCursorTooltipController.bind(button, getText, {
        boundaryElement: overlay,
        positionMode: 'absolute',
        maxWidth: 420,
        deferHideVisibility: true,
        preserveVisibleOnTargetSwitch: true,
        handoffRoot: inputContainer
      });
    };
    const hideInputActionCursorTooltip = () => {
      if (!overlayCursorTooltipController) {
        return;
      }
      overlayCursorTooltipController.hide();
    };
    function isSuggestionTitleOverflowing(title) {
      const overflowApi = window.LumnoCursorTooltip || {};
      if (typeof overflowApi.isElementTextTruncated === 'function') {
        return overflowApi.isElementTextTruncated(title);
      }
      return Boolean(title) &&
        Number(title.clientWidth) > 0 &&
        Number(title.scrollWidth) > Number(title.clientWidth);
    }
    function getSuggestionTextCursorTooltipOptions(extraOptions) {
      return Object.assign({
        boundaryElement: overlay,
        positionMode: 'absolute',
        maxWidth: 520,
        shouldShow: isSuggestionTitleOverflowing,
        deferHideVisibility: true,
        preserveVisibleOnTargetSwitch: true
      }, extraOptions || {});
    }
    function bindSuggestionTitleCursorTooltip(title, suggestion, query) {
      if (!overlayCursorTooltipController || !title || !suggestion) {
        return;
      }
      const titleText = sanitizeDisplayText(suggestion.title || '');
      if (!titleText) {
        return;
      }
      overlayCursorTooltipController.bind(
        title,
        () => titleText,
        getSuggestionTextCursorTooltipOptions()
      );
    }
    function bindSuggestionUrlCursorTooltip(urlLine, url) {
      if (!overlayCursorTooltipController || !urlLine || !url) {
        return;
      }
      const urlText = sanitizeDisplayText(url);
      if (!urlText) {
        return;
      }
      overlayCursorTooltipController.bind(
        urlLine,
        () => urlText,
        getSuggestionTextCursorTooltipOptions()
      );
    }
    const closeOtherTabsButton = inputParts.secondaryAction;
    const resetCloseOtherTabsButtonVisualState = () => {
      closeOtherTabsButton.removeAttribute('data-hover-active');
    };
    resetCloseOtherTabsButtonVisualState();
    closeOtherTabsButton.addEventListener('mouseenter', () => {
      closeOtherTabsButton.setAttribute('data-hover-active', 'true');
    });
    closeOtherTabsButton.addEventListener('mouseleave', resetCloseOtherTabsButtonVisualState);
    closeOtherTabsButton.addEventListener('blur', resetCloseOtherTabsButtonVisualState);
    closeOtherTabsButton.addEventListener('pointerup', resetCloseOtherTabsButtonVisualState);
    closeOtherTabsButton.addEventListener('pointercancel', resetCloseOtherTabsButtonVisualState);
    modeBadge = inputParts.modeBadge;

    const suggestionsContainer = document.createElement('div');
    applyNoTranslate(suggestionsContainer);
    suggestionsContainer.id = '_x_extension_suggestions_container_2024_unique_';
    suggestionsContainer.className = 'x-ov-suggestions-container';
    suggestionsContainer.addEventListener('wheel', function(event) {
      SUGGESTION_NAVIGATION.preventNumberShortcutWheel(event, suggestionsContainer);
    }, { passive: false });
    overlay.addEventListener('pointerdown', function() {
      SUGGESTION_NAVIGATION.cancelNumberShortcuts(suggestionsContainer);
    }, true);
    suggestionsContainer.addEventListener('animationend', (event) => {
      if (!event || event.animationName !== '_x_ov_scope_result_enter_2026_unique_') {
        return;
      }
      suggestionsContainer.setAttribute('data-scope-result-enter', 'done');
    });
    function readComputedCssPixels(computedStyle, property) {
      if (!computedStyle) {
        return 0;
      }
      const rawValue = property.startsWith('--') &&
          typeof computedStyle.getPropertyValue === 'function'
        ? computedStyle.getPropertyValue(property)
        : computedStyle[property];
      const value = Number.parseFloat(rawValue);
      return Number.isFinite(value) ? Math.max(0, value) : 0;
    }
    function syncOpenTabsScrollbarGutter(computedStyle) {
      if (!suggestionsContainer.hasAttribute('data-open-tabs-visible-row-limit')) {
        return;
      }
      const style = computedStyle || window.getComputedStyle(suggestionsContainer);
      const gutterWidth = Math.max(
        0,
        Math.round(
          (Number(suggestionsContainer.offsetWidth) || 0) -
          (Number(suggestionsContainer.clientWidth) || 0) -
          readComputedCssPixels(style, 'borderLeftWidth') -
          readComputedCssPixels(style, 'borderRightWidth')
        )
      );
      // Keep the CSS fallback while an async stylesheet has not exposed its
      // native gutter yet. Once it has, give that exact width back to rows.
      if (!gutterWidth) {
        return;
      }
      suggestionsContainer.style.setProperty(
        '--x-ov-open-tabs-scrollbar-gutter',
        `${gutterWidth}px`,
        inputUsesIsolatedStyles ? '' : 'important'
      );
    }
    function setOpenTabsResultsViewport(active, itemCount) {
      if (!active) {
        suggestionsContainer.style.removeProperty('--x-ov-suggestions-max-height');
        suggestionsContainer.style.removeProperty('--x-ov-open-tabs-scrollbar-gutter');
        suggestionsContainer.removeAttribute('data-open-tabs-visible-row-limit');
        return;
      }
      const visibleRowLimit = normalizeSearchResultDisplayLimit(
        overlaySearchResultDisplayLimit
      );
      suggestionsContainer.setAttribute(
        'data-open-tabs-visible-row-limit',
        String(visibleRowLimit)
      );
      const computedStyle = window.getComputedStyle(suggestionsContainer);
      syncOpenTabsScrollbarGutter(computedStyle);
      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => {
          syncOpenTabsScrollbarGutter();
        });
      }
      const maxHeight = SUGGESTION_NAVIGATION.getVisibleRowsViewportHeight({
        visibleRowLimit,
        itemCount,
        rowHeight: readComputedCssPixels(computedStyle, '--x-ov-suggestion-row-height'),
        rowGap: readComputedCssPixels(computedStyle, '--x-ov-suggestion-row-gap'),
        paddingTop: readComputedCssPixels(computedStyle, 'paddingTop'),
        paddingBottom: readComputedCssPixels(computedStyle, 'paddingBottom')
      });
      if (maxHeight > 0) {
        suggestionsContainer.style.setProperty(
          '--x-ov-suggestions-max-height',
          `${maxHeight}px`,
          inputUsesIsolatedStyles ? '' : 'important'
        );
      } else {
        suggestionsContainer.style.removeProperty('--x-ov-suggestions-max-height');
      }
    }
    const inputDivider = inputParts.divider;
    overlayWheelIsolationHandler = createOverlayWheelIsolationHandler(overlay);
    overlay.addEventListener('wheel', overlayWheelIsolationHandler, { passive: false, capture: true });

    function setInputDividerVisible(visible) {
      if (!inputDivider) {
        return;
      }
      inputDivider.setAttribute('data-visible', visible ? 'true' : 'false');
      inputDivider.style.setProperty('display', visible ? 'block' : 'none', inputUsesIsolatedStyles ? '' : 'important');
    }

    function getSearchModeMenuResultOffset() {
      if (!suggestionsContainer ||
          suggestionsContainer.getAttribute('data-collapsed') === 'true' ||
          suggestionsContainer.getAttribute('aria-hidden') === 'true') {
        return 0;
      }
      const layoutHeight = Math.max(
        0,
        Number(suggestionsContainer.offsetHeight) || 0
      );
      if (layoutHeight > 0) {
        return layoutHeight;
      }
      const rect = suggestionsContainer.getBoundingClientRect();
      return Math.max(0, Number(rect && rect.height) || 0);
    }

    function syncSearchModeMenuResultOffset() {
      if (!inputModeController ||
          typeof inputModeController.setModeMenuResultOffset !== 'function') {
        return;
      }
      const fitMaxHeightProperty =
        '--x-ov-suggestions-menu-fit-max-height';
      const resultHeightLimit =
        typeof inputModeController.fitModeMenuWithinViewport === 'function'
          ? inputModeController.fitModeMenuWithinViewport({ bottomInset: 24 })
          : null;
      if (Number.isFinite(resultHeightLimit)) {
        suggestionsContainer.style.setProperty(
          fitMaxHeightProperty,
          `${resultHeightLimit}px`,
          inputUsesIsolatedStyles ? '' : 'important'
        );
      } else {
        suggestionsContainer.style.removeProperty(fitMaxHeightProperty);
      }
      inputModeController.setModeMenuResultOffset(
        getSearchModeMenuResultOffset()
      );
    }

    function setOverlayResultsCollapsed(collapsed, options) {
      const stateOptions = options && typeof options === 'object'
        ? options
        : {};
      const shouldSyncLayout = stateOptions.deferLayoutSync !== true;
      const shouldCollapse = Boolean(collapsed);
      const wasCollapsed = suggestionsContainer.getAttribute('data-collapsed') === 'true';
      overlay.setAttribute('data-open-tabs-default-collapsed', shouldCollapse ? 'true' : 'false');
      suggestionsContainer.setAttribute('data-collapsed', shouldCollapse ? 'true' : 'false');
      suggestionsContainer.setAttribute('aria-hidden', shouldCollapse ? 'true' : 'false');
      setOverlayPanelScopedStyle(
        overlay,
        'border-radius',
        'var(--x-ov-panel-radius, 28px)'
      );
      setInputScopedStyle(
        inputContainer,
        'border-radius',
        shouldCollapse
          ? 'var(--x-ov-content-radius, 27px)'
          : 'var(--x-ov-content-radius, 27px) var(--x-ov-content-radius, 27px) 0 0'
      );
      if (shouldCollapse) {
        applyInstantSuggestionsHeightLayout(suggestionsContainer);
        suggestionsContainer.style.setProperty('max-height', '0px', inputUsesIsolatedStyles ? '' : 'important');
        suggestionsContainer.style.setProperty('min-height', '0px', inputUsesIsolatedStyles ? '' : 'important');
        suggestionsContainer.style.setProperty('padding-top', '0px', inputUsesIsolatedStyles ? '' : 'important');
        suggestionsContainer.style.setProperty('padding-bottom', '0px', inputUsesIsolatedStyles ? '' : 'important');
        suggestionsContainer.style.setProperty('opacity', '0', inputUsesIsolatedStyles ? '' : 'important');
        suggestionsContainer.style.setProperty('pointer-events', 'none', inputUsesIsolatedStyles ? '' : 'important');
        suggestionsContainer.style.setProperty('overflow', 'hidden', inputUsesIsolatedStyles ? '' : 'important');
        setInputDividerVisible(false);
        syncSearchModeMenuResultOffset();
        return;
      }
      applyInstantSuggestionsHeightLayout(suggestionsContainer);
      if (!wasCollapsed) {
        setInputDividerVisible(true);
        if (shouldSyncLayout) {
          syncSearchModeMenuResultOffset();
        }
        return;
      }
      suggestionsContainer.style.removeProperty('max-height');
      suggestionsContainer.style.removeProperty('min-height');
      suggestionsContainer.style.removeProperty('padding-top');
      suggestionsContainer.style.removeProperty('padding-bottom');
      suggestionsContainer.style.removeProperty('opacity');
      suggestionsContainer.style.removeProperty('pointer-events');
      suggestionsContainer.style.removeProperty('overflow');
      suggestionsContainer.removeAttribute('aria-hidden');
      setInputDividerVisible(true);
      if (shouldSyncLayout) {
        syncSearchModeMenuResultOffset();
      }
    }

    function shouldShowOpenTabsForEmptyQuery() {
      if (siteSearchState || localSearchScopeState) {
        return false;
      }
      return openTabsSearchModeActive ||
        (overlayOpenTabsDefaultVisibleLoaded && overlayOpenTabsDefaultVisible);
    }

    function clearDefaultOpenTabsSuggestions() {
      ensureOverlaySuggestionsView().clear();
      setOpenTabsResultsViewport(false);
      suggestionsContainer.removeAttribute('data-scope-result-enter');
      suggestionItems.length = 0;
      currentSuggestions = [];
      lastRenderedQuery = '';
      lastRenderedActionContextKey = '';
      selectedIndex = -1;
      setOverlayResultsCollapsed(true);
      updateSelection();
    }

    function updateInputRightPadding() {
      if (inputModeController) {
        inputModeController.updateLayout();
      }
    }

    function setSiteSearchTabHint(provider) {
      if (inputModeController) {
        inputModeController.setTabHintVisible(true, provider);
      }
    }

    function clearSiteSearchTabHint() {
      if (inputModeController) {
        inputModeController.setTabHintVisible(false);
      }
    }


    function applyLanguageStrings(options) {
      const refreshResults = !options || options.refreshResults !== false;
      if (inputModeController &&
          typeof inputModeController.refreshModeMenuLanguage === 'function') {
        inputModeController.refreshModeMenuLanguage();
      }
      if (overlayUpdateNoticeController &&
          typeof overlayUpdateNoticeController.updateLanguage === 'function') {
        overlayUpdateNoticeController.updateLanguage();
      }
      if (overlayEngagementNoticeController &&
          typeof overlayEngagementNoticeController.updateLanguage === 'function') {
        overlayEngagementNoticeController.updateLanguage();
      }
      const settingsTooltipText = formatMessage('command_settings', '打开设置', { name: 'Lumno' });
      const closeOtherTooltipText = t('overlay_close_other_tabs_tooltip', '关闭其他标签页');
      if (searchInput) {
        defaultPlaceholderText = t('overlay_search_placeholder', t('search_placeholder', defaultPlaceholderText));
        if (!siteSearchState && !localSearchScopeState) {
          searchInput.placeholder = defaultPlaceholderText;
        }
      }
      if (rightIcon) {
        rightIcon.setAttribute('aria-label', settingsTooltipText);
      }
      if (closeOtherTabsButton) {
        closeOtherTabsButton.setAttribute('aria-label', closeOtherTooltipText);
      }
      if (modeBadge) {
        updateModeBadge(searchInput ? searchInput.value : '');
      }
      if (siteSearchState) {
        const activeSiteSearchProvider = siteSearchState;
        setSiteSearchPrefix(activeSiteSearchProvider, defaultTheme);
        getThemeForProvider(activeSiteSearchProvider).then((theme) => {
          if (siteSearchState === activeSiteSearchProvider) {
            setSiteSearchPrefix(activeSiteSearchProvider, theme);
          }
        });
        updateSiteSearchPrefixLayout();
      } else if (localSearchScopeState) {
        setLocalSearchScopePrefix(localSearchScopeState);
        updateSiteSearchPrefixLayout();
      }
      if (!refreshResults) {
        return;
      }
      if (latestOverlayQuery) {
        updateSearchSuggestions(lastSuggestionResponse, latestOverlayQuery);
      } else {
        requestTabsAndRender();
      }
    }

    function applyLanguageMode(mode) {
      overlayLanguageMode = mode || 'system';
      const targetLocale = overlayLanguageMode === 'system'
        ? getSystemLocale()
        : normalizeLocale(overlayLanguageMode);
      loadPreferredLocaleMessages(targetLocale, null).then((messages) => {
        currentMessages = messages || {};
        applyLanguageStrings();
      });
    }

    initialLanguageReady.then(() => {
      if (overlay && overlay.isConnected) {
        applyLanguageStrings({ refreshResults: false });
      }
    });

    function getThemeModeLabel(mode) {
      if (mode === 'dark') {
        return t('theme_label_dark', '深色');
      }
      if (mode === 'light') {
        return t('theme_label_light', '浅色');
      }
      return t('theme_label_system', '跟随系统');
    }

    const commandDefinitions = [
      {
        type: 'commandNewTab',
        primary: '/new',
        aliases: ['/n', '/newtab', '/nt']
      },
      {
        type: 'commandSettings',
        primary: '/settings',
        aliases: ['/set', '/settings', '/s']
      },
      {
        type: 'modeSwitch',
        primary: '/mode',
        aliases: []
      },
      {
        type: 'commandOpenTabs',
        primary: '/tabs',
        aliases: ['/tab', '/t']
      },
      {
        type: 'commandCopyUrl',
        primary: '/copy',
        aliases: ['/c']
      },
      {
        type: 'commandDocumentPip',
        // legacy primary: 'clip'
        primary: '/clip',
        aliases: [],
        legacyExactAliases: ['clip', 'webclip', 'web clip'],
        requiresDocumentPipEnabled: true
      }
    ];

    function getCommandMatches(rawInput) {
      const input = String(rawInput || '').trim().toLowerCase();
      const matches = [];
      for (let i = 0; i < commandDefinitions.length; i += 1) {
        const command = commandDefinitions[i];
        if (command.requiresDocumentPipEnabled && !documentPipEnabled) {
          continue;
        }
        const tokens = [command.primary].concat(command.aliases || []);
        if (command.legacyExactAliases) {
          if (command.legacyExactAliases.includes(input)) {
            matches.push(command);
          }
          if (!input.startsWith('/')) {
            continue;
          }
        }
        if (!input.startsWith('/')) {
          continue;
        }
        for (let j = 0; j < tokens.length; j += 1) {
          const token = String(tokens[j] || '').trim().toLowerCase();
          if (token.startsWith(input)) {
            matches.push(command);
            break;
          }
        }
      }
      return matches;
    }

    function isSlashCommandInput(input) {
      return String(input || '').trim().startsWith('/');
    }

    function getCommandMatch(rawInput) {
      const matches = getCommandMatches(rawInput);
      return matches.length > 0
        ? {
            command: matches[0],
            completion: matches[0].primary
          }
        : null;
    }

    function buildCommandSuggestion(command) {
      if (command.type === 'modeSwitch') {
        return {
          ...buildModeSuggestion(),
          commandText: command.primary,
          commandAliases: command.aliases || []
        };
      }
      let titleText = '';
      if (command.type === 'commandSettings') {
        titleText = formatMessage('command_settings', '打开设置', {
          name: 'Lumno'
        });
      } else if (command.type === 'commandOpenTabs') {
        titleText = t('command_tabs_title', '仅搜索已打开的标签页');
      } else if (command.type === 'commandCopyUrl') {
        titleText = t('command_copy_title', '复制当前页面链接');
      } else if (command.type === 'commandDocumentPip') {
        titleText = t('document_pip_command_title', '开启网页剪裁');
      } else {
        titleText = t('command_newtab', '新建标签页');
      }
      return {
        type: command.type,
        title: titleText,
        url: '',
        commandText: command.primary,
        commandAliases: command.aliases || []
      };
    }

    function updateModeBadge(rawValue) {
      if (!modeBadge) {
        return;
      }
      const shouldShow = isModeCommand(rawValue || '');
      if (!shouldShow) {
        modeBadge.setAttribute('data-visible', 'false');
        updateInputRightPadding();
        return;
      }
      if (overlayThemeMode === 'system') {
        const pageTheme = detectPageTheme();
        if (pageTheme) {
          modeBadge.textContent = formatMessage('mode_badge_follow_site', '模式：{mode}（跟随网站）', {
            mode: getThemeModeLabel(pageTheme)
          });
        } else {
          const systemResolved = overlayMediaQuery.matches ? 'dark' : 'light';
          modeBadge.textContent = formatMessage('mode_badge_follow_system', '模式：{mode}（跟随系统）', {
            mode: getThemeModeLabel(systemResolved)
          });
        }
      } else {
        modeBadge.textContent = formatMessage('mode_badge', '模式：{mode}', {
          mode: getThemeModeLabel(overlayThemeMode)
        });
      }
      modeBadge.setAttribute('data-visible', 'true');
      updateInputRightPadding();
    }

    function getNextThemeMode(mode) {
      const order = ['system', 'light', 'dark'];
      const index = order.indexOf(mode);
      if (index === -1) {
        return 'light';
      }
      return order[(index + 1) % order.length];
    }

    function isModeCommand(input) {
      const raw = String(input || '').trim().toLowerCase();
      return raw === '/mode' || raw.startsWith('/mode ');
    }

    function buildModeSuggestion() {
      const nextMode = getNextThemeMode(overlayThemeMode || 'system');
      return {
        type: 'modeSwitch',
        title: formatMessage('mode_switch_title', `Lumno：切换到${getThemeModeLabel(nextMode)}模式`, {
          name: 'Lumno',
          mode: getThemeModeLabel(nextMode)
        }),
        url: '',
        favicon: chrome.runtime.getURL('assets/images/lumno.png'),
        commandText: '/mode',
        commandAliases: [],
        nextMode: nextMode
      };
    }

    function getThemeStorageUpdate(mode) {
      if (SETTINGS && typeof SETTINGS.createGlobalThemeModeStorageUpdate === 'function') {
        return SETTINGS.createGlobalThemeModeStorageUpdate(mode);
      }
      const nextMode = mode === 'dark' || mode === 'light' ? mode : 'system';
      return {
        [THEME_STORAGE_KEY]: nextMode
      };
    }

    function applyThemeModeChange(mode) {
      const updates = getThemeStorageUpdate(mode);
      if (storageArea) {
        storageArea.set(updates);
      }
      applyOverlayTheme(updates[THEME_STORAGE_KEY]);
      if (isModeCommand(searchInput.value || '')) {
        updateSearchSuggestions([], (searchInput.value || '').trim());
      }
    }

    const searchScopeTooltipText = () => t(
      'shortcut_reference_search_open_scope_menu_title',
      '打开搜索范围面板'
    );
    const setSearchScopeIconVisualState = (active) => {
      if (!searchScopeIcon) {
        return;
      }
      searchScopeIcon.dataset.hoverActive = active ? 'true' : 'false';
    };
    const activateSearchScopeIcon = (event) => {
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation();
      }
      hideInputActionCursorTooltip();
      setSearchScopeIconVisualState(false);
      if (inputModeController &&
          typeof inputModeController.resetModeMenuDoubleTab === 'function') {
        inputModeController.resetModeMenuDoubleTab();
      }
      openSearchModeMenuFromDoubleTab();
      if (searchScopeIcon && typeof searchScopeIcon.blur === 'function') {
        searchScopeIcon.blur();
      }
    };
    if (searchScopeIcon) {
      searchScopeIcon.dataset.searchScopeAction = 'true';
      searchScopeIcon.setAttribute('role', 'button');
      searchScopeIcon.setAttribute('tabindex', '0');
      searchScopeIcon.setAttribute('aria-label', searchScopeTooltipText());
      searchScopeIcon.setAttribute('data-tooltip', searchScopeTooltipText());
      setSearchScopeIconVisualState(false);
      searchScopeIcon.addEventListener('mouseenter', () => {
        setSearchScopeIconVisualState(true);
      });
      searchScopeIcon.addEventListener('focus', () => {
        setSearchScopeIconVisualState(true);
      });
      ['mouseleave', 'blur', 'pointerup', 'pointercancel'].forEach((type) => {
        searchScopeIcon.addEventListener(type, () => {
          setSearchScopeIconVisualState(false);
        });
      });
      searchScopeIcon.addEventListener('click', activateSearchScopeIcon);
      searchScopeIcon.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return;
        }
        activateSearchScopeIcon(event);
      });
      bindInputActionCursorTooltip(searchScopeIcon, searchScopeTooltipText);
    }

    if (rightIcon) {
      const settingsTooltipText = () => formatMessage('command_settings', '打开设置', { name: 'Lumno' });
      bindInputActionCursorTooltip(rightIcon, settingsTooltipText);
      rightIcon.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        hideInputActionCursorTooltip();
        chrome.runtime.sendMessage({ action: 'openOptionsPage' });
        removeOverlay(overlay);
        if (clickOutsideHandler) {
          document.removeEventListener('click', clickOutsideHandler);
        }
        if (keydownHandler) {
          document.removeEventListener('keydown', keydownHandler);
        }
        if (captureTabHandler) {
          document.removeEventListener('keydown', captureTabHandler, true);
        }
      });
    }
    if (closeOtherTabsButton) {
      const closeOtherTooltipText = () => t('overlay_close_other_tabs_tooltip', '关闭其他标签页');
      bindInputActionCursorTooltip(closeOtherTabsButton, closeOtherTooltipText);
      closeOtherTabsButton.addEventListener('click', function(event) {
        if (!event || event.isTrusted !== true) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        hideInputActionCursorTooltip();
        chrome.runtime.sendMessage({ action: 'closeOtherTabsForOverlay' }, (response) => {
          resetCloseOtherTabsButtonVisualState();
          if (typeof closeOtherTabsButton.blur === 'function') {
            closeOtherTabsButton.blur();
          }
          if (!response || response.ok !== true) {
            return;
          }
          if (latestOverlayQuery) {
            requestOverlaySearchSuggestions(latestOverlayQuery);
            return;
          }
          requestTabsAndRender();
        });
      });
    }

    // Add focus styles
    searchInput.addEventListener('focus', function() {
      selectedIndex = -1;
      updateSelection();
    });

    searchInput.addEventListener('blur', function() {
      // Don't change selectedIndex here to allow keyboard navigation
    });

    function isImeCompositionEvent(event) {
      return imeKeyGuard.shouldIgnoreKeydown(event);
    }
    const defaultPlaceholder = searchInput.placeholder;
    const initialSiteSearchProviders = Array.isArray(overlayContext && overlayContext.siteSearchProviders)
      ? overlayContext.siteSearchProviders
      : [];
    let siteSearchProvidersCache = initialSiteSearchProviders.length > 0
      ? initialSiteSearchProviders
      : null;
    let pendingProviderReload = false;
    const siteSearchIconCacheOptions = SHORTCUT_FAVICON.SITE_SEARCH_CACHE_OPTIONS || {
      cacheTtlMs: 1000 * 60 * 60 * 24 * 180,
      cacheMaxEntries: 40,
      maxDataUrlLength: 192 * 1024
    };
    const siteSearchIconStore = typeof SHORTCUT_FAVICON.createShortcutFaviconStore === 'function'
      ? SHORTCUT_FAVICON.createShortcutFaviconStore({
        chromeApi: chrome,
        storageArea: localStorageArea,
        storageKey: SITE_SEARCH_ICON_CACHE_STORAGE_KEY,
        ...siteSearchIconCacheOptions
      })
      : null;
    let siteSearchIconCache = {};
    let siteSearchIconCacheLoaded = false;
    let siteSearchIconCacheLoadPromise = null;
    let siteSearchIconCacheRevision = 0;

    function loadSiteSearchIconCache() {
      if (siteSearchIconCacheLoaded) {
        return Promise.resolve(siteSearchIconCache);
      }
      if (siteSearchIconCacheLoadPromise) {
        return siteSearchIconCacheLoadPromise;
      }
      if (!siteSearchIconStore || typeof siteSearchIconStore.readAll !== 'function') {
        siteSearchIconCacheLoaded = true;
        return Promise.resolve(siteSearchIconCache);
      }
      const loadRevision = siteSearchIconCacheRevision;
      siteSearchIconCacheLoadPromise = siteSearchIconStore.readAll()
        .then((cache) => {
          if (siteSearchIconCacheRevision === loadRevision) {
            siteSearchIconCache = cache && typeof cache === 'object' ? cache : {};
          }
          siteSearchIconCacheLoaded = true;
          return siteSearchIconCache;
        })
        .catch(() => {
          if (siteSearchIconCacheRevision === loadRevision) {
            siteSearchIconCache = {};
          }
          siteSearchIconCacheLoaded = true;
          return siteSearchIconCache;
        });
      return siteSearchIconCacheLoadPromise;
    }

    // Warm local icon lookup immediately, but never put it on the overlay reveal path.
    loadSiteSearchIconCache();
    const defaultSiteSearchProviders = typeof SEARCH_UTILS.getDefaultSiteSearchProviders === 'function'
      ? SEARCH_UTILS.getDefaultSiteSearchProviders()
      : initialSiteSearchProviders;
    const defaultAccentColor = FAVICON_THEME.defaultAccentColor;
    const themeColorCache = window._x_extension_theme_color_cache_2024_unique_ || new Map();
    window._x_extension_theme_color_cache_2024_unique_ = themeColorCache;
    const themeHostCache = window._x_extension_theme_host_cache_2024_unique_ || new Map();
    window._x_extension_theme_host_cache_2024_unique_ = themeHostCache;
    const OVERLAY_THEME_COLOR_CACHE_MAX_ENTRIES = 384;
    const OVERLAY_THEME_HOST_CACHE_MAX_ENTRIES = 256;
    function setBoundedOverlayCacheEntry(cache, key, value, maxEntries) {
      if (typeof FAVICON_UTILS.setBoundedCacheEntry === 'function') {
        return FAVICON_UTILS.setBoundedCacheEntry(cache, key, value, maxEntries);
      }
      if (!cache || typeof cache.set !== 'function') {
        return value;
      }
      if (typeof cache.delete === 'function' && typeof cache.has === 'function' && cache.has(key)) {
        cache.delete(key);
      }
      cache.set(key, value);
      while (cache.size > maxEntries && typeof cache.keys === 'function' &&
          typeof cache.delete === 'function') {
        const oldest = cache.keys().next();
        if (!oldest || oldest.done) {
          break;
        }
        cache.delete(oldest.value);
      }
      return value;
    }
    function cacheOverlayThemeColor(key, value) {
      return setBoundedOverlayCacheEntry(
        themeColorCache,
        key,
        value,
        OVERLAY_THEME_COLOR_CACHE_MAX_ENTRIES
      );
    }
    function cacheOverlayThemeHost(key, value) {
      return setBoundedOverlayCacheEntry(
        themeHostCache,
        key,
        value,
        OVERLAY_THEME_HOST_CACHE_MAX_ENTRIES
      );
    }

    const faviconDataCache = window._x_extension_overlay_favicon_data_cache_2026_unique_ || new Map();
    window._x_extension_overlay_favicon_data_cache_2026_unique_ = faviconDataCache;
    const faviconDataPending = window._x_extension_overlay_favicon_data_pending_2026_unique_ || new Map();
    window._x_extension_overlay_favicon_data_pending_2026_unique_ = faviconDataPending;
    const iconPreloadCache = window._x_extension_overlay_icon_preload_cache_2026_unique_ || new Map();
    window._x_extension_overlay_icon_preload_cache_2026_unique_ = iconPreloadCache;
    const overlayFaviconRuntime = overlayFaviconView.createOverlayFaviconViewRuntime({
      document,
      windowObj: window,
      chromeApi: chrome,
      getRiSvg,
      getHostFromUrl,
      getExtensionFaviconUrl,
      getGstaticFaviconUrl,
      getChromeFaviconUrl,
      shouldBlockFaviconForHost: shouldBlockOverlayFaviconForHost,
      shouldAvoidDirectFaviconForHost,
      shouldBlockOverlayFaviconForHost,
      isEnhancedFaviconFetchEnabled: isOverlayEnhancedFaviconFetchEnabled,
      getStrictFaviconReason: getOverlayStrictFaviconReason,
      logFaviconDecision: logOverlayFaviconDecision,
      isBlockedLocalFaviconUrl: isBlockedOverlayFaviconUrl,
      isFaviconProxyUrl,
      isChromeMonogramFaviconUrl,
      preloadThemeFromFavicon,
      faviconDataCache,
      faviconDataPending,
      iconPreloadCache,
      getOverlayPanel: () => overlay,
      getSuggestionRowsRoot: () => suggestionsContainer,
      rerenderReplacedFaviconRows,
      hasThemeForHost: (hostKey) => Boolean(hostKey && themeHostCache.has(hostKey))
    });
    const applyFaviconOpticalShift = overlayFaviconRuntime.applyFaviconOpticalShift;
    const applyFaviconOpticalAlignment = overlayFaviconRuntime.applyFaviconOpticalAlignment;
    const isBlockedLocalFaviconUrl = overlayFaviconRuntime.isBlockedLocalFaviconUrl;
    const requestFaviconData = overlayFaviconRuntime.requestFaviconData;
    const setFaviconSrcWithAnimation = overlayFaviconRuntime.setFaviconSrcWithAnimation;
    const attachFaviconData = overlayFaviconRuntime.attachFaviconData;
    const attachInputModeFaviconData =
      typeof SHORTCUT_FAVICON.createSiteSearchProviderIconHydrator === 'function'
        ? SHORTCUT_FAVICON.createSiteSearchProviderIconHydrator(attachFaviconData)
        : attachFaviconData;
    const attachResolvedFaviconWithFallbacks = overlayFaviconRuntime.attachResolvedFaviconWithFallbacks;
    const refreshOverlayThemeAwareFavicons = overlayFaviconRuntime.refreshOverlayThemeAwareFavicons;
    const refreshOverlayFaviconsForPolicyChange = overlayFaviconRuntime.refreshOverlayFaviconsForPolicyChange;
    const preloadIcon = overlayFaviconRuntime.preloadIcon;
    const warmIconCache = overlayFaviconRuntime.warmIconCache;
    const defaultCaretColor = searchInput.style.caretColor || 'var(--x-ext-input-caret, #7DB7FF)';
    const inputModePrefixTransition = 'opacity 140ms cubic-bezier(0.22, 1, 0.36, 1), transform 160ms cubic-bezier(0.22, 1, 0.36, 1), background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease, color 140ms ease';

    const mixColor = FAVICON_THEME.mixColor;
    const rgbToCss = FAVICON_THEME.rgbToCss;
    const parseCssColor = FAVICON_THEME.parseCssColor;
    const getLuminance = FAVICON_THEME.getLuminance;
    const buildTheme = FAVICON_THEME.buildTheme;

    function getHighlightColors(theme) {
      const resolvedTheme = getThemeForMode(theme);
      if (!resolvedTheme || !resolvedTheme._xIsBrand) {
        return {
          bg: 'var(--x-ov-hover-bg, #F3F4F6)',
          border: 'transparent'
        };
      }
      return {
        bg: resolvedTheme.highlightBg,
        border: resolvedTheme.highlightBorder
      };
    }

    const defaultTheme = FAVICON_THEME.createDefaultTheme();
    const urlHighlightTheme = FAVICON_THEME.createUrlHighlightTheme();
    const overlayThemeTokens = {
      light: {
        bg: 'linear-gradient(135deg, rgba(255, 255, 255, 0.97) 0%, rgba(255, 255, 255, 0.95) 100%)',
        modeMenuBg: '#FFFFFF',
        border: 'rgba(0, 0, 0, 0.14)',
        shadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.72), 0 2px 5px -2px rgba(15, 23, 42, 0.11), 0 16px 42px -12px rgba(15, 23, 42, 0.17), 0 48px 112px -30px rgba(15, 23, 42, 0.19)',
        text: '#111827',
        subtext: '#6B7280',
        link: '#2563EB',
        placeholder: '#9CA3AF',
        hoverBg: 'rgba(200, 208, 218, 0.45)',
        neutralMarkBg: '#E5E7EB',
        neutralMarkText: '#111827',
        tagBg: '#F3F4F6',
        tagText: '#667085',
        bookmarkTagBg: '#F3F4F6',
        bookmarkTagText: '#667085',
        underline: '#E5E7EB',
        dividerOpacity: '0.5',
        dividerInset: '24px',
        blur: '14px',
        saturate: '175%'
      },
      dark: {
        bg: 'rgba(20, 20, 20, 0.62)',
        lightPageBg: 'rgba(20, 20, 20, 0.82)',
        modeMenuBg: '#141414',
        border: 'rgba(255, 255, 255, 0.16)',
        shadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 2px 6px -2px rgba(0, 0, 0, 0.28), 0 18px 48px -14px rgba(0, 0, 0, 0.42), 0 52px 124px -34px rgba(0, 0, 0, 0.52)',
        text: '#E5E7EB',
        subtext: '#9CA3AF',
        link: '#D1D5DB',
        placeholder: '#9CA3AF',
        hoverBg: 'rgba(255, 255, 255, 0.08)',
        neutralMarkBg: 'rgba(148, 163, 184, 0.28)',
        neutralMarkText: '#F8FAFC',
        tagBg: 'rgba(255, 255, 255, 0.12)',
        tagText: '#E5E7EB',
        bookmarkTagBg: 'rgba(255, 255, 255, 0.12)',
        bookmarkTagText: '#E5E7EB',
        underline: 'rgba(255, 255, 255, 0.18)',
        dividerOpacity: '0.35',
        dividerInset: '24px',
        blur: '28px',
        saturate: '145%'
      }
    };
    function resolveOverlayTheme(mode, pageTheme) {
      const systemTheme = overlayMediaQuery.matches ? 'dark' : 'light';
      if (overlayPageTheme && typeof overlayPageTheme.resolveOverlayTheme === 'function') {
        return overlayPageTheme.resolveOverlayTheme({
          mode,
          pageTheme,
          pageThemeAdaptationEnabled: overlayPageThemeAdaptationEnabled,
          systemTheme
        });
      }
      if (mode === 'dark' || mode === 'light') {
        return mode;
      }
      return overlayPageThemeAdaptationEnabled && pageTheme ? pageTheme : systemTheme;
    }

    function pushThemeCandidate(candidates, element) {
      if (!element || candidates.includes(element)) {
        return;
      }
      candidates.push(element);
    }

    function getFirstElementByTagName(tagName) {
      if (typeof document.getElementsByTagName !== 'function') {
        return null;
      }
      const elements = document.getElementsByTagName(tagName);
      return elements && elements.length > 0 ? elements[0] : null;
    }

    function getPageThemeCandidateElements(docEl, body) {
      const candidates = [];
      pushThemeCandidate(candidates, docEl);
      pushThemeCandidate(candidates, body);
      ['app', 'root', '__next', '__nuxt'].forEach((id) => {
        if (typeof document.getElementById === 'function') {
          pushThemeCandidate(candidates, document.getElementById(id));
        }
      });
      pushThemeCandidate(candidates, getFirstElementByTagName('ytd-app'));
      pushThemeCandidate(candidates, getFirstElementByTagName('ytm-app'));
      if (body && body.children && body.children.length) {
        const candidateLimit = Math.min(body.children.length, 8);
        for (let i = 0; i < candidateLimit; i += 1) {
          pushThemeCandidate(candidates, body.children[i]);
        }
      }
      return candidates;
    }

    function classifyThemeToken(value) {
      const normalized = String(value || '').toLowerCase();
      if (!normalized) {
        return null;
      }
      if (
        normalized.includes('dark') ||
        normalized.includes('night') ||
        normalized === '1' ||
        normalized === 'true' ||
        normalized === 'on'
      ) {
        return 'dark';
      }
      if (
        normalized.includes('light') ||
        normalized.includes('day') ||
        normalized === '0' ||
        normalized === 'false' ||
        normalized === 'off'
      ) {
        return 'light';
      }
      return null;
    }

    function getElementClassTheme(element) {
      if (!element) {
        return null;
      }
      const className = typeof element.className === 'string'
        ? element.className
        : (typeof element.getAttribute === 'function' ? element.getAttribute('class') : '');
      const classText = String(className || '').toLowerCase();
      if (!classText) {
        return null;
      }
      const tokenList = classText.split(/\s+/);
      for (let i = 0; i < tokenList.length; i += 1) {
        const theme = getThemeClassTokenTheme(tokenList[i]);
        if (theme) {
          return theme;
        }
      }
      return null;
    }

    function getThemeClassTokenTheme(token) {
      const normalized = String(token || '').toLowerCase().trim();
      if (!normalized) {
        return null;
      }
      if (normalized === 'dark' || normalized === 'darkmode' || normalized === 'night') {
        return 'dark';
      }
      if (normalized === 'light' || normalized === 'lightmode' || normalized === 'day') {
        return 'light';
      }
      if (/^(theme|mode|scheme|color-scheme|appearance|is|has)-(dark|night)$/.test(normalized) ||
          /^(dark|night)-(theme|mode|scheme|color-scheme|appearance)$/.test(normalized)) {
        return 'dark';
      }
      if (/^(theme|mode|scheme|color-scheme|appearance|is|has)-(light|day)$/.test(normalized) ||
          /^(light|day)-(theme|mode|scheme|color-scheme|appearance)$/.test(normalized)) {
        return 'light';
      }
      return null;
    }

    function getElementAttributeTheme(element) {
      if (!element || typeof element.hasAttribute !== 'function') {
        return null;
      }
      if (element.hasAttribute('dark') ||
          element.hasAttribute('data-dark') ||
          element.hasAttribute('dark-mode')) {
        return 'dark';
      }
      if (element.hasAttribute('light')) {
        return 'light';
      }
      const attrNames = [
        'data-theme',
        'data-color-scheme',
        'data-color-mode',
        'data-mode',
        'data-appearance',
        'color-scheme',
        'theme',
        'data-bs-theme'
      ];
      for (let i = 0; i < attrNames.length; i += 1) {
        const value = typeof element.getAttribute === 'function'
          ? element.getAttribute(attrNames[i])
          : '';
        const theme = classifyThemeToken(value);
        if (theme) {
          return theme;
        }
      }
      return getElementClassTheme(element);
    }

    function getHeadMetaContent(name) {
      const head = document.head;
      if (!head || typeof head.querySelector !== 'function') {
        return '';
      }
      const meta = head.querySelector(`meta[name="${name}"]`);
      return meta ? String(meta.getAttribute('content') || '') : '';
    }

    function detectPageVisualTheme() {
      if (!overlayPageTheme || typeof overlayPageTheme.detectPageVisualTheme !== 'function') {
        return null;
      }
      return overlayPageTheme.detectPageVisualTheme({
        document,
        window
      });
    }

    function detectPageVisualThemeSignal() {
      if (overlayPageTheme && typeof overlayPageTheme.detectPageVisualThemeSignal === 'function') {
        return overlayPageTheme.detectPageVisualThemeSignal({
          document,
          window
        });
      }
      const theme = detectPageVisualTheme();
      return theme ? { theme, confidence: 0.58, score: theme === 'dark' ? -0.58 : 0.58 } : null;
    }

    function clampThemeConfidence(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) {
        return 0;
      }
      return Math.min(1, Math.max(0, number));
    }

    function getThemeSignalFromRgb(rgb, weight) {
      if (!rgb || rgb.length !== 3) {
        return null;
      }
      const luminance = getLuminance(rgb);
      if (luminance < 0.42) {
        return {
          theme: 'dark',
          confidence: clampThemeConfidence((0.42 - luminance) / 0.42),
          weight: Number.isFinite(Number(weight)) ? Math.max(0, Number(weight)) : 1
        };
      }
      if (luminance > 0.58) {
        return {
          theme: 'light',
          confidence: clampThemeConfidence((luminance - 0.58) / 0.42),
          weight: Number.isFinite(Number(weight)) ? Math.max(0, Number(weight)) : 1
        };
      }
      return null;
    }

    function getThemeSignalFromCssColor(color, weight) {
      if (overlayPageTheme && typeof overlayPageTheme.getCssColorThemeSignal === 'function') {
        return overlayPageTheme.getCssColorThemeSignal(color, weight);
      }
      let rgb = null;
      if (overlayPageTheme && typeof overlayPageTheme.parseCssColor === 'function') {
        const parsed = overlayPageTheme.parseCssColor(color);
        if (parsed && parsed.rgb && parsed.rgb.length === 3) {
          if (parsed.alpha <= 0.08) {
            return null;
          }
          rgb = parsed.alpha < 1
            ? parsed.rgb.map((channel) => Math.round(
              (channel * parsed.alpha) + (255 * (1 - parsed.alpha))
            ))
            : parsed.rgb;
        }
      }
      if (!rgb || rgb.length !== 3) {
        rgb = parseCssColor(color);
      }
      return getThemeSignalFromRgb(rgb, weight);
    }

    function getThemeSignalFromTheme(theme, weight, confidence) {
      if (theme !== 'dark' && theme !== 'light') {
        return null;
      }
      return {
        theme,
        confidence: clampThemeConfidence(
          Number.isFinite(Number(confidence)) ? Number(confidence) : 0.7
        ),
        weight: Number.isFinite(Number(weight)) ? Math.max(0, Number(weight)) : 1
      };
    }

    function getThemeSignalFromSchemeValue(value, weight) {
      const normalized = String(value || '').toLowerCase();
      if (!normalized) {
        return null;
      }
      const hasDark = normalized.includes('dark');
      const hasLight = normalized.includes('light');
      if (hasDark && !hasLight) {
        return getThemeSignalFromTheme('dark', weight, 0.62);
      }
      if (hasLight && !hasDark) {
        return getThemeSignalFromTheme('light', weight, 0.62);
      }
      return null;
    }

    function normalizeThemeSignal(signal, defaultWeight) {
      if (!signal || (signal.theme !== 'dark' && signal.theme !== 'light')) {
        return null;
      }
      return {
        theme: signal.theme,
        confidence: clampThemeConfidence(signal.confidence),
        weight: Number.isFinite(Number(signal.weight))
          ? Math.max(0, Number(signal.weight))
          : (Number.isFinite(Number(defaultWeight)) ? Math.max(0, Number(defaultWeight)) : 1)
      };
    }

    function resolvePageThemeSignals(signals) {
      if (overlayPageTheme && typeof overlayPageTheme.resolvePageThemeSignals === 'function') {
        return overlayPageTheme.resolvePageThemeSignals(signals);
      }
      let totalScore = 0;
      let totalWeight = 0;
      signals.forEach((signal) => {
        const normalized = normalizeThemeSignal(signal);
        if (!normalized || normalized.confidence <= 0 || normalized.weight <= 0) {
          return;
        }
        const direction = normalized.theme === 'dark' ? -1 : 1;
        const contributionWeight = normalized.confidence * normalized.weight;
        totalScore += direction * contributionWeight;
        totalWeight += contributionWeight;
      });
      if (totalWeight <= 0.2) {
        return null;
      }
      const confidence = totalScore / totalWeight;
      if (confidence <= -0.22) {
        return 'dark';
      }
      if (confidence >= 0.22) {
        return 'light';
      }
      return null;
    }

    function detectPageTheme() {
      const docEl = document.documentElement;
      const body = document.body;
      if (!docEl) {
        return null;
      }
      const candidateTheme = getPageThemeCandidateElements(docEl, body)
        .map(getElementAttributeTheme)
        .find(Boolean);
      const colorSchemeMeta = getHeadMetaContent('color-scheme').toLowerCase();
      const schemeValue = (window.getComputedStyle(docEl).colorScheme || '').toLowerCase();
      const themeColor = getHeadMetaContent('theme-color').trim();
      const themeColorRgb = parseCssColor(themeColor);
      const docStyleForSignals = window.getComputedStyle(docEl);
      const bodyStyleForSignals = body ? window.getComputedStyle(body) : null;
      const visualSignal = detectPageVisualThemeSignal();
      const fusedTheme = resolvePageThemeSignals([
        getThemeSignalFromTheme(candidateTheme, 0.48, 0.74),
        getThemeSignalFromSchemeValue(colorSchemeMeta, 0.4),
        getThemeSignalFromSchemeValue(schemeValue, 0.26),
        getThemeSignalFromRgb(themeColorRgb, 0.72),
        getThemeSignalFromCssColor(docStyleForSignals.backgroundColor, 0.78),
        getThemeSignalFromCssColor(bodyStyleForSignals && bodyStyleForSignals.backgroundColor, 0.58),
        normalizeThemeSignal(visualSignal, 1.05)
      ]);
      if (fusedTheme) {
        return fusedTheme;
      }
      const bodyStyle = body ? window.getComputedStyle(body) : null;
      const docStyle = window.getComputedStyle(docEl);
      const bgColor = (bodyStyle && bodyStyle.backgroundColor && bodyStyle.backgroundColor !== 'transparent')
        ? bodyStyle.backgroundColor
        : docStyle.backgroundColor;
      const backgroundSignal = getThemeSignalFromCssColor(bgColor, 1);
      return backgroundSignal ? backgroundSignal.theme : null;
    }

    function scheduleOverlayPageThemeSync() {
      if (overlayPageThemeSyncRaf !== null) {
        return;
      }
      overlayPageThemeSyncRaf = requestAnimationFrame(() => {
        overlayPageThemeSyncRaf = null;
        if (!overlay || !overlay.isConnected || !shouldObserveOverlayPageTheme()) {
          return;
        }
        applyOverlayTheme(overlayThemeMode);
      });
    }

    function shouldObserveOverlayPageTheme() {
      if (overlayPageTheme && typeof overlayPageTheme.shouldObservePageTheme === 'function') {
        return overlayPageTheme.shouldObservePageTheme({
          mode: overlayThemeMode,
          pageThemeAdaptationEnabled: overlayPageThemeAdaptationEnabled,
          systemTheme: overlayMediaQuery.matches ? 'dark' : 'light'
        });
      }
      if (overlayThemeMode === 'dark') {
        return true;
      }
      if (overlayThemeMode !== 'system') {
        return false;
      }
      return overlayPageThemeAdaptationEnabled || overlayMediaQuery.matches;
    }

    function syncOverlayPageThemeObservation() {
      if (overlayPageTheme && typeof overlayPageTheme.syncPageThemeObservation === 'function') {
        return overlayPageTheme.syncPageThemeObservation({
          mode: overlayThemeMode,
          pageThemeAdaptationEnabled: overlayPageThemeAdaptationEnabled,
          systemTheme: overlayMediaQuery.matches ? 'dark' : 'light',
          start: startOverlayPageThemeObserver,
          stop: stopOverlayPageThemeObserver
        });
      }
      if (shouldObserveOverlayPageTheme()) {
        startOverlayPageThemeObserver();
        return true;
      }
      stopOverlayPageThemeObserver();
      return false;
    }

    function startOverlayPageThemeObserver() {
      if (overlayPageThemeObserver || !shouldObserveOverlayPageTheme()) {
        return;
      }
      const themeAttrFilter = [
        'class',
        'style',
        'data-theme',
        'data-color-scheme',
        'data-color-mode',
        'data-mode',
        'data-appearance',
        'theme',
        'color-scheme',
        'dark',
        'light',
        'data-bs-theme'
      ];
      overlayPageThemeObserver = new MutationObserver(() => {
        scheduleOverlayPageThemeSync();
      });
      const docEl = document.documentElement;
      if (docEl) {
        overlayPageThemeObserver.observe(docEl, {
          attributes: true,
          attributeFilter: themeAttrFilter
        });
      }
      const body = document.body;
      if (body) {
        overlayPageThemeObserver.observe(body, {
          attributes: true,
          attributeFilter: themeAttrFilter
        });
      }
      const head = document.head;
      if (head) {
        overlayPageThemeObserver.observe(head, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['name', 'content', 'media']
        });
      }
      scheduleOverlayPageThemeSync();
    }

    function applyOverlayThemeVariables(target, mode) {
      if (!target) {
        return;
      }
      const pageTheme = detectPageTheme();
      const resolved = resolveOverlayTheme(mode, pageTheme);
      const tokens = overlayThemeTokens[resolved] || overlayThemeTokens.light;
      const shouldStrengthenDarkBackground = overlayPageTheme &&
        typeof overlayPageTheme.shouldStrengthenDarkOverlayBackground === 'function'
        ? overlayPageTheme.shouldStrengthenDarkOverlayBackground({
          resolvedTheme: resolved,
          pageTheme
        })
        : resolved === 'dark' && pageTheme === 'light';
      target.setAttribute('data-theme', resolved);
      target.style.setProperty(
        '--x-ov-bg',
        shouldStrengthenDarkBackground && tokens.lightPageBg ? tokens.lightPageBg : tokens.bg
      );
      target.style.setProperty('--x-ov-mode-menu-bg', tokens.modeMenuBg);
      target.style.setProperty('--x-ov-border', tokens.border);
      target.style.setProperty('--x-ov-shadow', tokens.shadow);
      target.style.setProperty('--x-ov-text', tokens.text);
      target.style.setProperty('--x-ov-subtext', tokens.subtext);
      target.style.setProperty('--x-ov-link', tokens.link);
      target.style.setProperty('--x-ov-placeholder', tokens.placeholder);
      target.style.setProperty('--x-ov-hover-bg', tokens.hoverBg);
      target.style.setProperty('--x-ov-neutral-mark-bg', tokens.neutralMarkBg);
      target.style.setProperty('--x-ov-neutral-mark-text', tokens.neutralMarkText);
      target.style.setProperty('--x-ov-tag-bg', tokens.tagBg);
      target.style.setProperty('--x-ov-tag-text', tokens.tagText);
      target.style.setProperty('--x-ov-bookmark-tag-bg', tokens.bookmarkTagBg);
      target.style.setProperty('--x-ov-bookmark-tag-text', tokens.bookmarkTagText);
      target.style.setProperty('--x-ov-blur', tokens.blur);
      target.style.setProperty('--x-ov-saturate', tokens.saturate);
      target.style.setProperty('--x-ext-input-text', tokens.text);
      target.style.setProperty('--x-ext-input-caret', tokens.link);
      target.style.setProperty('--x-ext-input-icon', tokens.subtext);
      target.style.setProperty('--x-ext-input-icon-hover-bg', tokens.hoverBg);
      target.style.setProperty('--x-ext-input-icon-hover', tokens.text);
      target.style.setProperty('--x-ext-input-underline', tokens.underline);
      target.style.setProperty('--x-ext-input-divider-inset', tokens.dividerInset);
      target.style.setProperty('--x-ext-input-divider-opacity', tokens.dividerOpacity);
    }

    function refreshOverlaySuggestionsFromLastResponse() {
      if (latestOverlayQuery) {
        updateSearchSuggestions(lastSuggestionResponse, latestOverlayQuery);
      }
    }

    const initialOverlayThemeReady = initialOverlaySettingsReady.then((result) => {
      if (!storageArea) {
        applyOverlayTheme('system');
        return 'system';
      }
      const initialThemeMode = result[THEME_STORAGE_KEY] || 'system';
      const rawAdaptationEnabled = result[OVERLAY_PAGE_THEME_ADAPTATION_ENABLED_STORAGE_KEY];
      overlayPageThemeAdaptationEnabled = normalizeOverlayPageThemeAdaptationEnabled(
        rawAdaptationEnabled
      );
      if (rawAdaptationEnabled !== overlayPageThemeAdaptationEnabled) {
        storageArea.set({
          [OVERLAY_PAGE_THEME_ADAPTATION_ENABLED_STORAGE_KEY]: overlayPageThemeAdaptationEnabled
        });
      }
      applyOverlayTheme(initialThemeMode);
      return initialThemeMode;
    });
    overlayThemeStorageListener = (changes, areaName) => {
      if (!isPrimaryStorageAreaName(areaName) || (
        !changes[THEME_STORAGE_KEY] &&
        !changes[OVERLAY_PAGE_THEME_ADAPTATION_ENABLED_STORAGE_KEY]
      )) {
        return;
      }
      if (changes[OVERLAY_PAGE_THEME_ADAPTATION_ENABLED_STORAGE_KEY]) {
        overlayPageThemeAdaptationEnabled = normalizeOverlayPageThemeAdaptationEnabled(
          changes[OVERLAY_PAGE_THEME_ADAPTATION_ENABLED_STORAGE_KEY].newValue
        );
      }
      const nextMode = changes[THEME_STORAGE_KEY]
        ? changes[THEME_STORAGE_KEY].newValue || 'system'
        : overlayThemeMode;
      applyOverlayTheme(nextMode);
    };
    chrome.storage.onChanged.addListener(overlayThemeStorageListener);

    overlayLanguageStorageListener = (changes, areaName) => {
      if (!isPrimaryStorageAreaName(areaName)) {
        return;
      }
      if (changes[LANGUAGE_STORAGE_KEY]) {
        applyLanguageMode(changes[LANGUAGE_STORAGE_KEY].newValue || 'system');
      }
    };
    chrome.storage.onChanged.addListener(overlayLanguageStorageListener);

    overlaySearchEngineStateReady = loadOverlaySearchEngineState(
      refreshOverlaySuggestionsFromLastResponse
    );
    overlaySearchEngineStorageListener = (changes, areaName) => {
      if (!isPrimaryStorageAreaName(areaName) || !changes[DEFAULT_SEARCH_ENGINE_STORAGE_KEY]) {
        return;
      }
      const nextValue = changes[DEFAULT_SEARCH_ENGINE_STORAGE_KEY].newValue;
      if (nextValue && nextValue.id &&
          (typeof SEARCH_UTILS.isRetiredSearchEngineState !== 'function' ||
            !SEARCH_UTILS.isRetiredSearchEngineState(nextValue))) {
        overlaySearchEngineState = nextValue;
        if (latestOverlayQuery) {
          updateSearchSuggestions(lastSuggestionResponse, latestOverlayQuery);
        }
      }
    };
    chrome.storage.onChanged.addListener(overlaySearchEngineStorageListener);

    function updatePendingSearchSuggestions(query) {
      if (suggestionsContainer.getAttribute('data-collapsed') === 'true' ||
          suggestionsContainer.getAttribute('aria-hidden') === 'true') {
        return false;
      }
      updateSearchSuggestions(lastSuggestionResponse, query);
      return true;
    }

    function requestOverlaySearchSuggestions(query) {
      const requestQuery = String(query || '').trim();
      const requestLocalSearchScope = localSearchScopeState;
      if (!requestLocalSearchScope && isSlashCommandInput(requestQuery)) {
        updateSearchSuggestions([], requestQuery);
        return;
      }
      if (siteSearchState && requestQuery) {
        updateSearchSuggestions([], requestQuery);
        return;
      }
      if (!requestQuery || !chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
        return;
      }
      const requestSeq = ++overlaySuggestionRequestSeq;
      const requestStartedAt = Date.now();
      const remoteMixState = {
        settled: false,
        hasFinalSuggestions: false
      };
      if (overlayRemoteSuggestionDebounceTimer) {
        clearTimeout(overlayRemoteSuggestionDebounceTimer);
        overlayRemoteSuggestionDebounceTimer = null;
      }
      if (overlayFirstResultRevealTimer) {
        clearTimeout(overlayFirstResultRevealTimer);
        overlayFirstResultRevealTimer = null;
      }
      chrome.runtime.sendMessage({
        action: 'getSearchSuggestions',
        query: requestQuery,
        context: 'overlay',
        sourceTypes: requestLocalSearchScope ? [requestLocalSearchScope.sourceType] : undefined,
        includeOpenTabs: requestLocalSearchScope ? false : undefined
      }, function(response) {
        if (requestSeq !== overlaySuggestionRequestSeq || requestQuery !== latestOverlayQuery) {
          return;
        }
        if (chrome.runtime && chrome.runtime.lastError) {
          updatePendingSearchSuggestions(requestQuery);
          return;
        }
        const localSuggestions = response && Array.isArray(response.suggestions) ? response.suggestions : [];
        if (requestLocalSearchScope) {
          remoteMixState.settled = true;
          updateSearchSuggestions(localSuggestions, requestQuery);
          return;
        }
        // A collapsed surface has no useful intermediate height to preserve.
        // Give the remote mix one short response budget so the first visible
        // result set is committed once at its final height. If that budget is
        // missed, reveal local results and ignore the late mix instead of
        // moving the whole result surface a second time.
        const waitForFirstResultMix =
          suggestionsContainer.getAttribute('data-collapsed') === 'true';
        if (waitForFirstResultMix) {
          overlayFirstResultRevealTimer = setTimeout(() => {
            overlayFirstResultRevealTimer = null;
            if (requestSeq !== overlaySuggestionRequestSeq ||
                requestQuery !== latestOverlayQuery ||
                remoteMixState.visualSettled) {
              return;
            }
            remoteMixState.visualSettled = true;
            updateSearchSuggestions(localSuggestions, requestQuery, {
              remoteMixState,
              finalRemoteMix: true
            });
          }, OVERLAY_FIRST_RESULT_REVEAL_DELAY_MS);
        } else {
          updateSearchSuggestions(localSuggestions, requestQuery, {
            remoteMixState
          });
        }
        const remoteDelay = waitForFirstResultMix
          ? 0
          : Math.max(0, 120 - (Date.now() - requestStartedAt));
        overlayRemoteSuggestionDebounceTimer = setTimeout(function() {
          overlayRemoteSuggestionDebounceTimer = null;
          if (requestSeq !== overlaySuggestionRequestSeq || requestQuery !== latestOverlayQuery) {
            return;
          }
          chrome.runtime.sendMessage({
            action: 'getSearchEngineSuggestions',
            query: requestQuery,
            context: 'overlay',
            localSuggestions: localSuggestions
          }, function(remoteResponse) {
            if (requestSeq !== overlaySuggestionRequestSeq || requestQuery !== latestOverlayQuery) {
              return;
            }
            if (chrome.runtime && chrome.runtime.lastError) {
              remoteMixState.settled = true;
              if (waitForFirstResultMix && !remoteMixState.visualSettled) {
                clearTimeout(overlayFirstResultRevealTimer);
                overlayFirstResultRevealTimer = null;
                remoteMixState.visualSettled = true;
                updateSearchSuggestions(localSuggestions, requestQuery, {
                  remoteMixState,
                  finalRemoteMix: true
                });
              } else {
                updateSearchSuggestions(localSuggestions, requestQuery, {
                  remoteMixState,
                  finalRemoteMix: true
                });
              }
              return;
            }
            if (!remoteResponse ||
                remoteResponse.aborted === true ||
                remoteResponse.hasRemoteSuggestions !== true ||
                !Array.isArray(remoteResponse.suggestions)) {
              remoteMixState.settled = true;
              if (waitForFirstResultMix && !remoteMixState.visualSettled) {
                clearTimeout(overlayFirstResultRevealTimer);
                overlayFirstResultRevealTimer = null;
                remoteMixState.visualSettled = true;
                updateSearchSuggestions(localSuggestions, requestQuery, {
                  remoteMixState,
                  finalRemoteMix: true
                });
              } else {
                updateSearchSuggestions(localSuggestions, requestQuery, {
                  remoteMixState,
                  finalRemoteMix: true
                });
              }
              return;
            }
            remoteMixState.settled = true;
            remoteMixState.hasFinalSuggestions = true;
            if (waitForFirstResultMix) {
              if (remoteMixState.visualSettled) {
                return;
              }
              clearTimeout(overlayFirstResultRevealTimer);
              overlayFirstResultRevealTimer = null;
              remoteMixState.visualSettled = true;
              updateSearchSuggestions(remoteResponse.suggestions, requestQuery, {
                remoteMixState,
                finalRemoteMix: true
              });
              return;
            }
            updateSearchSuggestions(remoteResponse.suggestions, requestQuery, {
              remoteMixState,
              finalRemoteMix: true
            });
          });
        }, remoteDelay);
      });
    }
    if (storageArea) {
      storageArea.get([
        SEARCH_RESULT_PRIORITY_STORAGE_KEY,
        SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY
      ], (result) => {
        overlaySearchResultPriorityMode = normalizeSearchResultPriority(result[SEARCH_RESULT_PRIORITY_STORAGE_KEY]);
        enabledSearchResultSourceTypes = normalizeEnabledSearchResultSourceTypes(
          result[SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY]
        );
      });
    }
    loadOverlaySearchBlacklistItems(refreshOverlaySuggestionsFromLastResponse);
    overlaySearchResultPriorityStorageListener = (changes, areaName) => {
      if (!isPrimaryStorageAreaName(areaName) || !changes[SEARCH_RESULT_PRIORITY_STORAGE_KEY]) {
        return;
      }
      overlaySearchResultPriorityMode = normalizeSearchResultPriority(changes[SEARCH_RESULT_PRIORITY_STORAGE_KEY].newValue);
      if (latestOverlayQuery) {
        updateSearchSuggestions(lastSuggestionResponse, latestOverlayQuery);
      }
    };
    chrome.storage.onChanged.addListener(overlaySearchResultPriorityStorageListener);
    overlaySearchResultSourceTypesStorageListener = (changes, areaName) => {
      if (!isPrimaryStorageAreaName(areaName) || !changes[SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY]) {
        return;
      }
      enabledSearchResultSourceTypes = normalizeEnabledSearchResultSourceTypes(
        changes[SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY].newValue
      );
      if (localSearchScopeState &&
          !enabledSearchResultSourceTypes.includes(localSearchScopeState.sourceType)) {
        clearLocalSearchScope();
      }
      if (latestOverlayQuery) {
        requestOverlaySearchSuggestions(latestOverlayQuery);
      }
    };
    chrome.storage.onChanged.addListener(overlaySearchResultSourceTypesStorageListener);
    overlaySearchResultDisplayLimitStorageListener = (changes, areaName) => {
      if (!isPrimaryStorageAreaName(areaName) || !changes[SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY]) {
        return;
      }
      overlaySearchResultDisplayLimit = normalizeSearchResultDisplayLimit(
        changes[SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY].newValue
      );
      if (openTabsSearchModeActive || (!latestOverlayQuery && shouldShowOpenTabsForEmptyQuery())) {
        renderTabSuggestions(filterTabsForOverlay(tabs, latestOverlayQuery));
        return;
      }
      refreshOverlaySuggestionsFromLastResponse();
    };
    chrome.storage.onChanged.addListener(overlaySearchResultDisplayLimitStorageListener);
    overlayNumberShortcutInstantStorageListener = (changes, areaName) => {
      if (!isPrimaryStorageAreaName(areaName) ||
          !changes[NUMBER_SHORTCUT_INSTANT_ENABLED_STORAGE_KEY]) {
        return;
      }
      const rawValue = changes[NUMBER_SHORTCUT_INSTANT_ENABLED_STORAGE_KEY].newValue;
      numberShortcutInstantEnabled = typeof SETTINGS.normalizeNumberShortcutInstantEnabled === 'function'
        ? SETTINGS.normalizeNumberShortcutInstantEnabled(rawValue)
        : rawValue === true;
      SUGGESTION_NAVIGATION.cancelNumberShortcuts(suggestionsContainer);
    };
    chrome.storage.onChanged.addListener(overlayNumberShortcutInstantStorageListener);
    overlayMacosCtrlSuggestionNavigationStorageListener = (changes, areaName) => {
      if (!isPrimaryStorageAreaName(areaName) ||
          !changes[MACOS_CTRL_SUGGESTION_NAVIGATION_ENABLED_STORAGE_KEY]) {
        return;
      }
      const rawValue = changes[MACOS_CTRL_SUGGESTION_NAVIGATION_ENABLED_STORAGE_KEY].newValue;
      macosCtrlSuggestionNavigationEnabled =
        typeof SETTINGS.normalizeMacosCtrlSuggestionNavigationEnabled === 'function'
          ? SETTINGS.normalizeMacosCtrlSuggestionNavigationEnabled(rawValue)
          : rawValue === true;
    };
    chrome.storage.onChanged.addListener(overlayMacosCtrlSuggestionNavigationStorageListener);
    overlaySimpleModeStorageListener = (changes, areaName) => {
      if (!isPrimaryStorageAreaName(areaName) || !changes[SIMPLE_MODE_ENABLED_STORAGE_KEY]) {
        return;
      }
      const rawValue = changes[SIMPLE_MODE_ENABLED_STORAGE_KEY].newValue;
      simpleModeEnabled = typeof SETTINGS.normalizeSimpleModeEnabled === 'function'
        ? SETTINGS.normalizeSimpleModeEnabled(rawValue)
        : rawValue === true;
      if (openTabsSearchModeActive || (!latestOverlayQuery && shouldShowOpenTabsForEmptyQuery())) {
        renderTabSuggestions(filterTabsForOverlay(tabs, latestOverlayQuery));
        return;
      }
      if (latestOverlayQuery) {
        updateSearchSuggestions(lastSuggestionResponse, latestOverlayQuery, {
          forceFullRerender: true
        });
      }
    };
    chrome.storage.onChanged.addListener(overlaySimpleModeStorageListener);
    overlaySearchBlacklistStorageListener = (changes, areaName) => {
      if (!isPrimaryStorageAreaName(areaName) || !changes[SEARCH_BLACKLIST_STORAGE_KEY]) {
        return;
      }
      overlaySearchBlacklistItems = normalizeOverlaySearchBlacklistItems(
        changes[SEARCH_BLACKLIST_STORAGE_KEY].newValue
      );
      if (latestOverlayQuery) {
        updateSearchSuggestions(lastSuggestionResponse, latestOverlayQuery);
      }
    };
    chrome.storage.onChanged.addListener(overlaySearchBlacklistStorageListener);
    if (storageArea) {
      initialFaviconEnhancedFetchReady = initialOverlaySettingsReady.then((result) => {
        faviconEnhancedFetchEnabled = normalizeFaviconEnhancedFetchEnabled(
          result ? result[FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY] : true
        );
        overlayFaviconRequestBlacklistItems = normalizeOverlayFaviconRequestBlacklistItems(
          result ? result[FAVICON_REQUEST_BLACKLIST_STORAGE_KEY] : null
        );
      });
    }
    overlayFaviconEnhancedFetchStorageListener = (changes, areaName) => {
      if (!isPrimaryStorageAreaName(areaName) || (
        !changes[FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY] &&
        !changes[FAVICON_REQUEST_BLACKLIST_STORAGE_KEY]
      )) {
        return;
      }
      if (changes[FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY]) {
        faviconEnhancedFetchEnabled = normalizeFaviconEnhancedFetchEnabled(
          changes[FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY].newValue
        );
      }
      if (changes[FAVICON_REQUEST_BLACKLIST_STORAGE_KEY]) {
        overlayFaviconRequestBlacklistItems = normalizeOverlayFaviconRequestBlacklistItems(
          changes[FAVICON_REQUEST_BLACKLIST_STORAGE_KEY].newValue
        );
      }
      refreshOverlayFaviconsForPolicyChange();
    };
    chrome.storage.onChanged.addListener(overlayFaviconEnhancedFetchStorageListener);
    if (storageArea) {
      initialOverlayOpenTabsDefaultVisibleReady = initialOverlaySettingsReady.then((result) => {
        const rawValue = result ? result[OVERLAY_OPEN_TABS_DEFAULT_VISIBLE_STORAGE_KEY] : undefined;
        const normalized = normalizeOverlayOpenTabsDefaultVisible(rawValue);
        overlayOpenTabsDefaultVisible = normalized;
        overlayOpenTabsDefaultVisibleLoaded = true;
        if (rawValue !== normalized) {
          storageArea.set({ [OVERLAY_OPEN_TABS_DEFAULT_VISIBLE_STORAGE_KEY]: normalized });
        }
      });
    }
    overlayOpenTabsDefaultVisibleStorageListener = (changes, areaName) => {
      if (!isPrimaryStorageAreaName(areaName) || !changes[OVERLAY_OPEN_TABS_DEFAULT_VISIBLE_STORAGE_KEY]) {
        return;
      }
      const rawValue = changes[OVERLAY_OPEN_TABS_DEFAULT_VISIBLE_STORAGE_KEY].newValue;
      const normalized = normalizeOverlayOpenTabsDefaultVisible(rawValue);
      overlayOpenTabsDefaultVisible = normalized;
      overlayOpenTabsDefaultVisibleLoaded = true;
      if (rawValue !== normalized && storageArea) {
        storageArea.set({ [OVERLAY_OPEN_TABS_DEFAULT_VISIBLE_STORAGE_KEY]: normalized });
      }
      if (latestOverlayQuery || openTabsSearchModeActive) {
        return;
      }
      if (normalized) {
        requestTabsAndRender('');
      } else {
        clearDefaultOpenTabsSuggestions();
      }
    };
    chrome.storage.onChanged.addListener(overlayOpenTabsDefaultVisibleStorageListener);
    if (storageArea) {
      storageArea.get([DOCUMENT_PIP_ENABLED_STORAGE_KEY], (result) => {
        documentPipEnabled = result && result[DOCUMENT_PIP_ENABLED_STORAGE_KEY] === true;
        if (latestOverlayQuery) {
          updateSearchSuggestions(lastSuggestionResponse, latestOverlayQuery);
        }
      });
    }
    overlayDocumentPipStorageListener = (changes, areaName) => {
      if (!isPrimaryStorageAreaName(areaName) || !changes[DOCUMENT_PIP_ENABLED_STORAGE_KEY]) {
        return;
      }
      documentPipEnabled = changes[DOCUMENT_PIP_ENABLED_STORAGE_KEY].newValue === true;
      if (latestOverlayQuery) {
        updateSearchSuggestions(lastSuggestionResponse, latestOverlayQuery);
      }
    };
    chrome.storage.onChanged.addListener(overlayDocumentPipStorageListener);

    if (storageArea) {
      storageArea.get([OVERLAY_TAB_PRIORITY_STORAGE_KEY], (result) => {
        overlayTabQuickSwitchEnabled = normalizeOverlayTabPriorityMode(result[OVERLAY_TAB_PRIORITY_STORAGE_KEY]);
      });
    }
    overlayTabPriorityStorageListener = (changes, areaName) => {
      if (!isPrimaryStorageAreaName(areaName) || !changes[OVERLAY_TAB_PRIORITY_STORAGE_KEY]) {
        return;
      }
      overlayTabQuickSwitchEnabled = normalizeOverlayTabPriorityMode(changes[OVERLAY_TAB_PRIORITY_STORAGE_KEY].newValue);
      if (latestOverlayQuery) {
        updateSearchSuggestions(lastSuggestionResponse, latestOverlayQuery);
      }
    };
    chrome.storage.onChanged.addListener(overlayTabPriorityStorageListener);
    const initialOverlaySizeReady = initialOverlaySettingsReady.then((result) => {
      overlaySizeMode = normalizeOverlaySizeMode(result[OVERLAY_SIZE_MODE_STORAGE_KEY]);
      applyOverlaySizeForPageZoom(overlay);
      return overlaySizeMode;
    });
    overlaySizeStorageListener = (changes, areaName) => {
      if (!isPrimaryStorageAreaName(areaName) || !changes[OVERLAY_SIZE_MODE_STORAGE_KEY]) {
        return;
      }
      overlaySizeMode = normalizeOverlaySizeMode(changes[OVERLAY_SIZE_MODE_STORAGE_KEY].newValue);
      applyOverlaySizeForPageZoom(overlay);
    };
    chrome.storage.onChanged.addListener(overlaySizeStorageListener);
    if (storageArea) {
      storageArea.get([TAB_RANK_SCORE_DEBUG_STORAGE_KEY], (result) => {
        overlayTabScoreDebugEnabled = normalizeTabRankScoreDebugMode(result[TAB_RANK_SCORE_DEBUG_STORAGE_KEY]);
      });
    }
    overlayTabScoreDebugStorageListener = (changes, areaName) => {
      if (!isPrimaryStorageAreaName(areaName) || !changes[TAB_RANK_SCORE_DEBUG_STORAGE_KEY]) {
        return;
      }
      overlayTabScoreDebugEnabled = normalizeTabRankScoreDebugMode(changes[TAB_RANK_SCORE_DEBUG_STORAGE_KEY].newValue);
      if (!latestOverlayQuery || !latestOverlayQuery.trim()) {
        requestTabsAndRender();
      }
    };
    chrome.storage.onChanged.addListener(overlayTabScoreDebugStorageListener);

    function isOverlayDarkMode() {
      return overlay && overlay.getAttribute('data-theme') === 'dark';
    }

    function getThemeForMode(theme) {
      return FAVICON_THEME.getThemeForMode(theme, {
        defaultTheme,
        isDarkMode: isOverlayDarkMode
      });
    }

    function getHoverColors(theme) {
      return FAVICON_THEME.getHoverColors(theme, {
        defaultTheme,
        isDarkMode: isOverlayDarkMode
      });
    }

    function getNeutralHoverActionColors() {
      return isOverlayDarkMode()
        ? {
          bg: 'rgba(255, 255, 255, 0.10)',
          border: 'rgba(255, 255, 255, 0.18)',
          text: '#E5E7EB'
        }
        : {
          bg: 'rgba(200, 208, 218, 0.45)',
          border: 'rgba(148, 163, 184, 0.28)',
          text: '#4B5563'
        };
    }
    const brandAccentMap = {
      'github.com': [36, 41, 46],
      'docs.github.com': [36, 41, 46],
      'douban.com': [0, 181, 29],
      'zhihu.com': [23, 127, 255],
      'bilibili.com': [0, 174, 236],
      'youtube.com': [255, 0, 0],
      'youtu.be': [255, 0, 0],
      'google.com': [66, 133, 244],
      'chatgpt.com': [16, 163, 127],
      'gemini.google.com': [66, 133, 244],
      'doubao.com': [79, 70, 229],
      'qianwen.com': [37, 99, 235],
      'yuanbao.tencent.com': [0, 82, 217],
      'chat.minimax.io': [24, 119, 242],
      'chat.deepseek.com': [74, 107, 255],
      'kimi.com': [77, 92, 255],
      'bing.com': [0, 120, 215],
      'baidu.com': [41, 98, 255],
      'taobao.com': [255, 80, 0],
      'tmall.com': [226, 35, 26],
      'juejin.cn': [30, 128, 255],
      'reddit.com': [255, 69, 0],
      'wikipedia.org': [64, 64, 64],
      'zh.wikipedia.org': [64, 64, 64],
      'x.com': [17, 24, 39],
      'twitter.com': [29, 161, 242]
    };

    function normalizeHost(hostname) {
      if (!hostname) {
        return '';
      }
      const lower = String(hostname).toLowerCase();
      const stripped = lower.replace(/^www\./i, '');
      if (stripped === 'my.feishu.cn') {
        return 'feishu.cn';
      }
      return stripped;
    }

    function normalizeFaviconHost(hostname) {
      return typeof FAVICON_UTILS.normalizeFaviconHost === 'function'
        ? FAVICON_UTILS.normalizeFaviconHost(hostname)
        : String(hostname || '').toLowerCase().replace(/^www\./i, '');
    }

    function getCanonicalPageUrlForFavicon(url) {
      return typeof FAVICON_UTILS.getCanonicalPageUrlForFavicon === 'function'
        ? FAVICON_UTILS.getCanonicalPageUrlForFavicon(url)
        : String(url || '');
    }

    function getExtensionFaviconUrl(pageUrl) {
      const resolver = getOverlayFaviconUrlResolver();
      return resolver ? resolver.getExtensionFaviconUrl(pageUrl) : '';
    }

    function getGstaticFaviconUrl(pageUrl) {
      const resolver = getOverlayFaviconUrlResolver();
      return resolver
        ? resolver.getSafeFaviconCandidateUrl(resolver.getGstaticFaviconUrl(pageUrl))
        : '';
    }

    function getChromeFaviconUrl(pageUrl) {
      const resolver = getOverlayFaviconUrlResolver();
      return resolver ? resolver.getChromeFaviconUrl(pageUrl) : '';
    }

    function getPageFaviconCandidateUrl(pageUrl) {
      const resolver = getOverlayFaviconUrlResolver();
      return resolver ? resolver.getPageFaviconCandidateUrl(pageUrl) : '';
    }

    function getHostFaviconUrl(hostname) {
      const normalized = normalizeFaviconHost(hostname);
      if (!normalized) {
        return '';
      }
      if (shouldBlockOverlayFaviconForHost(normalized)) {
        return '';
      }
      if (normalized === 'lumno.kubai.design') {
        return (chrome && chrome.runtime && typeof chrome.runtime.getURL === 'function')
          ? chrome.runtime.getURL('assets/images/lumno.png')
          : 'https://lumno.kubai.design/favicon.png';
      }
      return getGstaticFaviconUrl(`https://${normalized}/`);
    }

    function getBrandAccentForHost(hostname) {
      const host = String(hostname || '').toLowerCase();
      if (!host) {
        return null;
      }
      if (brandAccentMap[host]) {
        return brandAccentMap[host];
      }
      const entry = Object.keys(brandAccentMap).find((key) => host === key || host.endsWith(`.${key}`));
      return entry ? brandAccentMap[entry] : null;
    }

    function getBrandAccentForUrl(url) {
      if (!url) {
        return null;
      }
      try {
        const hostname = normalizeHost(new URL(url).hostname);
        return getBrandAccentForHost(hostname);
      } catch (e) {
        return null;
      }
    }

    function buildFallbackThemeForHost(hostname) {
      const theme = buildTheme(defaultAccentColor);
      theme._xIsDefault = true;
      theme._xIsBrand = false;
      theme._xThemeSource = 'fallback';
      theme._xIsFallback = true;
      return theme;
    }

    function getHostFromUrl(url) {
      if (!url) {
        return '';
      }
      try {
        return normalizeHost(new URL(url).hostname);
      } catch (e) {
        return '';
      }
    }

    function extractAverageColor(image) {
      const size = 16;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) {
        return null;
      }
      try {
        context.drawImage(image, 0, 0, size, size);
        const data = context.getImageData(0, 0, size, size).data;
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha < 32) {
            continue;
          }
          const red = data[i];
          const green = data[i + 1];
          const blue = data[i + 2];
          const brightness = (red + green + blue) / 3;
          if (brightness > 245) {
            continue;
          }
          r += red;
          g += green;
          b += blue;
          count += 1;
        }
        if (!count) {
          for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];
            if (alpha < 32) {
              continue;
            }
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count += 1;
          }
        }
        if (!count) {
          return null;
        }
        return [
          Math.round(r / count),
          Math.round(g / count),
          Math.round(b / count)
        ];
      } catch (e) {
        return null;
      }
    }

    function isFaviconProxyUrl(url) {
      return typeof FAVICON_UTILS.isFaviconProxyUrl === 'function'
        ? FAVICON_UTILS.isFaviconProxyUrl(url)
        : false;
    }

    function isChromeMonogramFaviconUrl(url) {
      return typeof FAVICON_UTILS.isChromeMonogramFaviconUrl === 'function'
        ? FAVICON_UTILS.isChromeMonogramFaviconUrl(url)
        : /^chrome:\/\/favicon2\//i.test(String(url || '').trim());
    }

    function getThemeFromUrl(url, hostOverride) {
      if (!url) {
        return Promise.resolve(defaultTheme);
      }
      const hostKey = hostOverride || getHostFromUrl(url);
      if (isBlockedLocalFaviconUrl(url) || (hostKey && shouldBlockOverlayFaviconForHost(hostKey))) {
        const fallbackTheme = buildFallbackThemeForHost(hostKey);
        return Promise.resolve(fallbackTheme || defaultTheme);
      }
      const isProxy = isFaviconProxyUrl(url);
      const useHostCache = hostKey && (!isProxy || Boolean(hostOverride));
      if (useHostCache && themeHostCache.has(hostKey)) {
        return Promise.resolve(themeHostCache.get(hostKey));
      }
      if (themeColorCache.has(url)) {
        return Promise.resolve(themeColorCache.get(url));
      }
      const brandAccent = (isProxy && hostOverride) ? null : getBrandAccentForUrl(url);
      if (brandAccent) {
        const brandTheme = buildTheme(brandAccent);
        brandTheme._xIsBrand = true;
        cacheOverlayThemeColor(url, brandTheme);
        if (useHostCache) {
          cacheOverlayThemeHost(hostKey, brandTheme);
        }
        return Promise.resolve(brandTheme);
      }
      const cachedFaviconData = faviconDataCache.get(url);
      if (cachedFaviconData) {
        return new Promise((resolve) => {
          const image = new Image();
          image.onload = function() {
            const avg = extractAverageColor(image);
            if (!avg) {
              cacheOverlayThemeColor(url, defaultTheme);
              resolve(defaultTheme);
              return;
            }
            const theme = buildTheme(avg);
            theme._xIsBrand = true;
            cacheOverlayThemeColor(url, theme);
            if (useHostCache) {
              cacheOverlayThemeHost(hostKey, theme);
            }
            resolve(theme);
          };
          image.onerror = function() {
            cacheOverlayThemeColor(url, defaultTheme);
            resolve(defaultTheme);
          };
          image.src = cachedFaviconData;
        });
      }
      if (isProxy) {
        return requestFaviconData(url).then((dataUrl) => {
          if (!dataUrl) {
            cacheOverlayThemeColor(url, defaultTheme);
            return defaultTheme;
          }
          return new Promise((resolve) => {
            const image = new Image();
            image.onload = function() {
              const avg = extractAverageColor(image);
              if (!avg) {
                cacheOverlayThemeColor(url, defaultTheme);
                resolve(defaultTheme);
                return;
              }
              const theme = buildTheme(avg);
              theme._xIsBrand = true;
              cacheOverlayThemeColor(url, theme);
              if (useHostCache) {
                cacheOverlayThemeHost(hostKey, theme);
              }
              resolve(theme);
            };
            image.onerror = function() {
              cacheOverlayThemeColor(url, defaultTheme);
              resolve(defaultTheme);
            };
            image.src = dataUrl;
          });
        });
      }
      return new Promise((resolve) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = function() {
          const avg = extractAverageColor(image);
          if (!avg) {
            cacheOverlayThemeColor(url, defaultTheme);
            resolve(defaultTheme);
            return;
          }
          const theme = buildTheme(avg);
          theme._xIsBrand = true;
          cacheOverlayThemeColor(url, theme);
          if (useHostCache) {
            cacheOverlayThemeHost(hostKey, theme);
          }
          resolve(theme);
        };
        image.onerror = function() {
          cacheOverlayThemeColor(url, defaultTheme);
          resolve(defaultTheme);
        };
        image.src = url;
      });
    }

    function getProviderThemeHost(provider) {
      return normalizeHost(getProviderHost(provider));
    }

    function buildAndCacheBrandThemeForHost(hostKey, iconUrl) {
      const normalizedHost = normalizeHost(hostKey);
      if (!normalizedHost) {
        return null;
      }
      const brandAccent = getBrandAccentForHost(normalizedHost);
      if (!brandAccent) {
        return null;
      }
      const brandTheme = buildTheme(brandAccent);
      brandTheme._xIsBrand = true;
      cacheOverlayThemeHost(normalizedHost, brandTheme);
      if (iconUrl) {
        cacheOverlayThemeColor(iconUrl, brandTheme);
      }
      return brandTheme;
    }

    function getThemeForProvider(provider) {
      const hostKey = getProviderThemeHost(provider);
      const providerPageUrl = getProviderFaviconPageUrl(provider);
      const iconUrl = isOverlayEnhancedFaviconFetchEnabled(providerPageUrl)
        ? getProviderIcon(provider)
        : getPageFaviconCandidateUrl(providerPageUrl);
      if (hostKey && themeHostCache.has(hostKey)) {
        return Promise.resolve(themeHostCache.get(hostKey));
      }
      if (iconUrl && themeColorCache.has(iconUrl)) {
        return Promise.resolve(themeColorCache.get(iconUrl));
      }
      const brandTheme = buildAndCacheBrandThemeForHost(hostKey, iconUrl);
      if (brandTheme) {
        return Promise.resolve(brandTheme);
      }
      return getThemeFromUrl(iconUrl, hostKey);
    }

    function shouldUseBrandTheme(suggestion) {
      if (!suggestion) {
        return false;
      }
      const neutralTypes = ['googleSuggest', 'newtab', 'modeSwitch', 'zenSwitch', 'chatgpt', 'perplexity', 'commandNewTab', 'commandSettings', 'commandOpenTabs', 'commandCopyUrl', 'commandDocumentPip'];
      if (neutralTypes.includes(suggestion.type)) {
        return false;
      }
      return true;
    }

    function getThemeForSuggestion(suggestion) {
      if (!shouldUseBrandTheme(suggestion)) {
        return Promise.resolve(defaultTheme);
      }
      if (suggestion && suggestion.provider) {
        return getThemeForProvider(suggestion.provider);
      }
      if (suggestion && suggestion.url) {
        const brandAccent = getBrandAccentForUrl(suggestion.url);
        if (brandAccent) {
          const brandTheme = buildTheme(brandAccent);
          brandTheme._xIsBrand = true;
          return Promise.resolve(brandTheme);
        }
      }
      const hostKey = suggestion && suggestion.url ? getHostFromUrl(suggestion.url) : '';
      if (hostKey && shouldBlockOverlayFaviconForHost(hostKey)) {
        const fallbackTheme = buildFallbackThemeForHost(hostKey);
        return Promise.resolve(fallbackTheme || defaultTheme);
      }
      const siteFavicon = hostKey && !isUrlExcludedFromOverlayFaviconRequests(suggestion && suggestion.url)
        ? getSiteFaviconUrl(hostKey)
        : '';
      if (siteFavicon) {
        return getThemeFromUrl(siteFavicon, hostKey).then((theme) => {
          if (theme && !theme._xIsDefault) {
            return theme;
          }
          return getThemeFromUrl(getThemeSourceForSuggestion(suggestion), hostKey);
        });
      }
      return getThemeFromUrl(getThemeSourceForSuggestion(suggestion), hostKey);
    }

    function getImmediateThemeForSuggestion(suggestion) {
      if (!shouldUseBrandTheme(suggestion)) {
        return defaultTheme;
      }
      if (suggestion && suggestion.provider) {
        const hostKey = getProviderThemeHost(suggestion.provider);
        const iconUrl = getProviderIcon(suggestion.provider);
        if (hostKey && themeHostCache.has(hostKey)) {
          return themeHostCache.get(hostKey);
        }
        if (iconUrl && themeColorCache.has(iconUrl)) {
          return themeColorCache.get(iconUrl);
        }
        const brandTheme = buildAndCacheBrandThemeForHost(hostKey, iconUrl);
        if (brandTheme) {
          return brandTheme;
        }
        const fallbackTheme = buildFallbackThemeForHost(hostKey);
        if (fallbackTheme) {
          return fallbackTheme;
        }
      }
      if (suggestion && suggestion.url) {
        const hostKey = getHostFromUrl(suggestion.url);
        if (hostKey && themeHostCache.has(hostKey)) {
          return themeHostCache.get(hostKey);
        }
        if (themeColorCache.has(suggestion.url)) {
          return themeColorCache.get(suggestion.url);
        }
        const brandAccent = getBrandAccentForUrl(suggestion.url);
        if (brandAccent) {
          const brandTheme = buildTheme(brandAccent);
          brandTheme._xIsBrand = true;
          return brandTheme;
        }
        const fallbackTheme = buildFallbackThemeForHost(hostKey);
        if (fallbackTheme) {
          return fallbackTheme;
        }
      }
      return null;
    }

    function applyThemeVariables(target, theme) {
      if (!target || !theme) {
        return;
      }
      const resolvedTheme = getThemeForMode(theme);
      target.style.setProperty('--x-ext-mark-bg', resolvedTheme.markBg);
      target.style.setProperty('--x-ext-mark-text', resolvedTheme.markText);
      target.style.setProperty('--x-ext-tag-bg', resolvedTheme.tagBg);
      target.style.setProperty('--x-ext-tag-text', resolvedTheme.tagText);
      target.style.setProperty('--x-ext-tag-border', resolvedTheme.tagBorder);
      target.style.setProperty('--x-ext-key-bg', resolvedTheme.keyBg);
      target.style.setProperty('--x-ext-key-text', resolvedTheme.keyText);
      target.style.setProperty('--x-ext-key-border', resolvedTheme.keyBorder);
      target.style.setProperty('--x-ext-icon-color', resolvedTheme.accent);
    }

    function applyMarkVariables(target, theme, active) {
      if (!target || !theme) {
        return;
      }
      const resolvedTheme = getThemeForMode(theme);
      const markBg = active
        ? resolvedTheme.activeMarkBg || resolvedTheme.markBg
        : resolvedTheme.markBg;
      const markText = active
        ? resolvedTheme.activeMarkText || resolvedTheme.markText
        : resolvedTheme.markText;
      target.style.setProperty('--x-ext-mark-bg', markBg);
      target.style.setProperty('--x-ext-mark-text', markText);
    }

    function preloadThemeFromFavicon(url, dataUrl, hostOverride) {
      if (!url || themeColorCache.has(url)) {
        return;
      }
      const hostKey = hostOverride || getHostFromUrl(url);
      const useHostCache = hostKey && (Boolean(hostOverride) || !isFaviconProxyUrl(url));
      if (useHostCache && themeHostCache.has(hostKey)) {
        return;
      }
      if (!dataUrl) {
        return;
      }
      const image = new Image();
      image.onload = function() {
        const avg = extractAverageColor(image);
        if (!avg) {
          return;
        }
        const theme = buildTheme(avg);
        theme._xIsBrand = true;
        cacheOverlayThemeColor(url, theme);
        if (useHostCache) {
          cacheOverlayThemeHost(hostKey, theme);
        }
      };
      image.onerror = function() {};
      image.src = dataUrl;
    }

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


    function setSuggestionActionModifiersActive(openInCurrentTabActive, openSwitchInNewTabActive, openInBackgroundTabActive) {
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
      const reactView = ensureOverlaySuggestionsView();
      reactView.setOpenInCurrentTabModifierActive(
        nextOpenInCurrentTabActive
      );
      reactView.setOpenSwitchInNewTabModifierActive(
        nextOpenSwitchInNewTabActive
      );
      reactView.setOpenInBackgroundTabModifierActive(
        nextOpenInBackgroundTabActive
      );
    }

    function syncSuggestionActionModifiersFromEvent(event) {
      setSuggestionActionModifiersActive(
        Boolean(event && event.altKey),
        Boolean(event && event.shiftKey),
        Boolean(event && (event.metaKey || event.ctrlKey) && !numberShortcutInstantEnabled)
      );
    }

    function shouldUseCurrentTabForOpenNewTabAction(suggestion, event, item) {
      if (!event || !event.altKey) {
        return false;
      }
      const action = item && item._xVisitButtonAction ? item._xVisitButtonAction : '';
      if (SUGGESTION_ACTION_MODEL &&
          typeof SUGGESTION_ACTION_MODEL.shouldOpenNewTabActionInCurrentTab === 'function') {
        return SUGGESTION_ACTION_MODEL.shouldOpenNewTabActionInCurrentTab(suggestion, {
          action,
          openInCurrentTab: true
        });
      }
      return action === 'openNewTab';
    }

    function shouldUseNewTabForSwitchAction(suggestion, event, item) {
      if (!event || !event.shiftKey) {
        return false;
      }
      const action = item && item._xVisitButtonAction ? item._xVisitButtonAction : 'switch';
      if (SUGGESTION_ACTION_MODEL &&
          typeof SUGGESTION_ACTION_MODEL.shouldOpenSwitchActionInNewTab === 'function') {
        return SUGGESTION_ACTION_MODEL.shouldOpenSwitchActionInNewTab(suggestion, {
          action,
          openSwitchInNewTab: true
        });
      }
      return Boolean(suggestion && suggestion.url && action === 'switch');
    }

    function shouldOpenSearchResultInBackgroundTab(event) {
      const config = {
        openInBackgroundTab: Boolean(event && (
          ((event.metaKey || event.ctrlKey) && !numberShortcutInstantEnabled) ||
          isMiddleClick(event)
        )),
        openInCurrentTab: Boolean(event && event.altKey)
      };
      if (SUGGESTION_ACTION_MODEL &&
          typeof SUGGESTION_ACTION_MODEL.getSearchResultOpenDisposition === 'function') {
        return SUGGESTION_ACTION_MODEL.getSearchResultOpenDisposition(config) === 'backgroundTab';
      }
      return Boolean(config.openInBackgroundTab && !config.openInCurrentTab);
    }

    function finishOverlayResultActivation(event, canOpenInBackground) {
      if (canOpenInBackground !== false &&
          shouldOpenSearchResultInBackgroundTab(event)) {
        searchInput.focus({ preventScroll: true });
        return false;
      }
      removeOverlay(overlay);
      return true;
    }

    function isMiddleClick(event) {
      if (typeof NAVIGATION_DISPOSITION.isMiddleClick === 'function') {
        return NAVIGATION_DISPOSITION.isMiddleClick(event);
      }
      return Boolean(event && Number(event.button) === 1);
    }

    function getOpenDisposition(event, fallback) {
      if (numberShortcutInstantEnabled || typeof NAVIGATION_DISPOSITION.getDisposition !== 'function') {
        return (isMiddleClick(event) || Boolean(event && (event.metaKey || event.ctrlKey) && !numberShortcutInstantEnabled))
          ? 'backgroundTab'
          : (fallback || 'newTab');
      }
      return NAVIGATION_DISPOSITION.getDisposition(event, fallback);
    }

    function getSearchResultNewTabDisposition(event) {
      return shouldOpenSearchResultInBackgroundTab(event) ? 'backgroundTab' : 'newTab';
    }

    function getSearchResultCreateDisposition(suggestion, event, item) {
      if (shouldUseCurrentTabForOpenNewTabAction(suggestion, event, item)) {
        return 'currentTab';
      }
      return getSearchResultNewTabDisposition(event);
    }

    function openMatchedTabSuggestion(suggestion, event, item, query) {
      if (suggestion && suggestion.url &&
          (shouldUseNewTabForSwitchAction(suggestion, event, item) ||
            shouldOpenSearchResultInBackgroundTab(event))) {
        recordSearchSuggestionSelectionFromSuggestion(suggestion, query, 'overlay');
        chrome.runtime.sendMessage({
          action: 'createTab',
          url: suggestion.url,
          disposition: getSearchResultNewTabDisposition(event)
        });
        return;
      }
      chrome.runtime.sendMessage({
        action: 'switchToTab',
        tabId: suggestion._xMatchedTabId
      });
    }

    function createSuggestionActionModel(optionsArg) {
      if (SUGGESTION_ACTION_MODEL &&
          typeof SUGGESTION_ACTION_MODEL.createSearchActionModel === 'function') {
        return SUGGESTION_ACTION_MODEL.createSearchActionModel(optionsArg);
      }
      return {
        actionTags: [],
        visitButtonAction: 'openNewTab',
        alwaysHideVisitButton: false,
        hasActionTags: false,
        hasSwitchAction: false,
        hideSourceTags: false
      };
    }

    function getThemeSourceForSuggestion(suggestion) {
      if (suggestion && suggestion.provider) {
        const hostKey = getProviderThemeHost(suggestion.provider);
        if (hostKey && shouldBlockOverlayFaviconForHost(hostKey)) {
          return '';
        }
        const providerPageUrl = getProviderFaviconPageUrl(suggestion.provider);
        if (!isOverlayEnhancedFaviconFetchEnabled(providerPageUrl)) {
          return getPageFaviconCandidateUrl(providerPageUrl);
        }
        return getProviderIcon(suggestion.provider) || (hostKey ? getHostFaviconUrl(hostKey) : '');
      }
      if (suggestion && suggestion.url && isUrlExcludedFromOverlayFaviconRequests(suggestion.url)) {
        return getPageFaviconCandidateUrl(suggestion.url);
      }
      if (suggestion && suggestion.url) {
        try {
          const hostname = normalizeHost(new URL(suggestion.url).hostname);
          if (hostname) {
            if (shouldBlockOverlayFaviconForHost(hostname)) {
              return '';
            }
            return getGstaticFaviconUrl(suggestion.url) || getHostFaviconUrl(hostname);
          }
        } catch (e) {
          // Ignore malformed URLs.
        }
      }
      return suggestion && suggestion.favicon ? suggestion.favicon : '';
    }

    function getSiteFaviconUrl(hostname) {
      const normalized = normalizeFaviconHost(hostname);
      if (!normalized) {
        return '';
      }
      if (!faviconEnhancedFetchEnabled) {
        return '';
      }
      if (shouldAvoidDirectFaviconForHost(normalized)) {
        return getGstaticFaviconUrl(`https://${normalized}/`);
      }
      return `https://${normalized}/favicon.ico`;
    }

    inputModeController = SEARCH_INPUT_MODE.createInputModeController(inputParts, {
      surface: 'overlay',
      useImportantStyles: !inputUsesIsolatedStyles,
      prefixTransition: inputModePrefixTransition,
      defaultPlaceholder: defaultPlaceholderText || defaultPlaceholder,
      getDefaultPlaceholder: () => defaultPlaceholderText || defaultPlaceholder,
      defaultCaretColor,
      modeBadgeElement: modeBadge,
      rightReserveBase: 92,
      rightAnchorOffset: 86,
      baseInputPaddingLeft: 50,
      setInputStyle: setInputScopedStyle,
      applyNoTranslate,
      getThemeForMode,
      defaultTheme,
      defaultAccentColor,
      parseCssColor,
      rgbToCss,
      isDarkMode: isOverlayDarkMode,
      getProviderIcon,
      getProviderThemeHost,
      getThemeForProvider,
      getSiteSearchPrefixText,
      getSiteSearchDisplayName,
      isAiSiteSearchProvider,
      attachFaviconData: attachInputModeFaviconData,
      attachProviderIcon: attachInputModeProviderIcon,
      preferDirectProviderIcons: true,
      formatMessage,
      modeMenuDoubleTabDuration: OVERLAY_MODE_MENU_DOUBLE_TAB_DURATION_MS,
      modeMenuCursorTooltipController: overlayModeMenuCursorTooltipController,
      getModeMenuItems: getSearchModeMenuItems,
      onModeMenuSelect: selectSearchModeMenuItem,
      onModeTagRemovalConfirmation: () => {
        showOverlayToast(t(
          'search_scope_remove_confirmation',
          'Press Backspace again to remove the scope'
        ));
      },
      onModeTagRemovalConfirmationReset: hideOverlayToast,
      onModeMenuLayoutChange: syncSearchModeMenuResultOffset,
      isTabHintSuppressed: () => Boolean(
        siteSearchState ||
        localSearchScopeState ||
        openTabsSearchModeActive
      )
    });
    syncSearchModeMenuResultOffset();
    if (typeof window.ResizeObserver === 'function') {
      const modeMenuResultResizeObserver = new window.ResizeObserver(
        syncSearchModeMenuResultOffset
      );
      modeMenuResultResizeObserver.observe(suggestionsContainer);
      overlay._lumnoModeMenuResultResizeObserver =
        modeMenuResultResizeObserver;
    }
    loadSiteSearchIconCache().then(() => {
      if (!siteSearchState || !inputModeController) {
        return;
      }
      const activeProvider = siteSearchState;
      setSiteSearchPrefix(activeProvider, defaultTheme);
      getThemeForProvider(activeProvider).then((theme) => {
        if (siteSearchState === activeProvider) {
          setSiteSearchPrefix(activeProvider, theme);
        }
      }).catch(() => {});
    });

    function updateSiteSearchPrefixLayout() {
      if (inputModeController) {
        inputModeController.updateLayout();
      }
    }

    function setSiteSearchPrefix(provider, theme, options) {
      if (inputModeController) {
        inputModeController.setProviderPrefix(provider, theme, options);
      }
    }

    function setOpenTabsSearchPrefix(theme, options) {
      if (inputModeController) {
        const prefixOptions = options || {};
        inputModeController.setPrefixText(
          t('search_open_tabs_only_entry', '搜索已打开标签页'),
          theme,
          {
            animate: prefixOptions.animate !== false,
            iconClass: 'ri-window-line',
            menuIconName: 'browser',
            modeId: 'openTabs',
            preserveModeMenuDoubleTab: Boolean(
              prefixOptions.preserveModeMenuDoubleTab
            )
          }
        );
      }
    }

    function cancelPendingOpenTabsPrefixEntry() {
      if (!pendingOpenTabsPrefixEntryTimer) {
        return false;
      }
      window.clearTimeout(pendingOpenTabsPrefixEntryTimer);
      pendingOpenTabsPrefixEntryTimer = 0;
      return true;
    }

    function scheduleOpenTabsPrefixEntry(options) {
      cancelPendingOpenTabsPrefixEntry();
      const prefixOptions = options || {};
      pendingOpenTabsPrefixEntryTimer = window.setTimeout(() => {
        pendingOpenTabsPrefixEntryTimer = 0;
        if (!openTabsSearchModeActive || siteSearchState || localSearchScopeState) {
          return;
        }
        setOpenTabsSearchPrefix(defaultTheme, {
          animate: true,
          preserveModeMenuDoubleTab: Boolean(
            prefixOptions.preserveModeMenuDoubleTab
          )
        });
      }, OVERLAY_OPEN_TABS_PREFIX_FEEDBACK_DELAY_MS);
    }

    function clearSiteSearchPrefix() {
      if (inputModeController) {
        inputModeController.clearProviderPrefix();
      }
    }

    function isEnglishQuery(query) {
      if (!query) {
        return false;
      }
      return /^[A-Za-z0-9\s._/-]+$/.test(query);
    }

    function getUrlDisplay(url) {
      if (!url) {
        return '';
      }
      try {
        const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./i, '');
        const path = parsed.pathname === '/' ? '' : parsed.pathname;
        return `${host}${path}${parsed.search || ''}${parsed.hash || ''}`;
      } catch (e) {
        return url;
      }
    }

    function normalizeTabSearchToken(value) {
      return String(value || '').trim().toLowerCase();
    }

    function buildTabSearchText(tab) {
      if (!tab) {
        return '';
      }
      const parts = [];
      if (tab.title) {
        parts.push(String(tab.title));
      }
      if (tab.url) {
        parts.push(String(tab.url));
      }
      try {
        const parsed = new URL(tab.url || '');
        if (parsed.hostname) {
          parts.push(parsed.hostname);
        }
        if (parsed.pathname) {
          parts.push(parsed.pathname);
        }
      } catch (e) {
        // Ignore malformed URLs.
      }
      return parts.join(' ').toLowerCase();
    }

    function filterTabsForOverlay(tabList, queryText) {
      const list = Array.isArray(tabList) ? tabList : [];
      const normalized = normalizeTabSearchToken(queryText);
      if (!normalized) {
        if (list.length < 2 || typeof currentOverlayTabId !== 'number') {
          return list.slice();
        }
        if (!list[0] || list[0].id !== currentOverlayTabId) {
          return list.slice();
        }
        const reordered = list.slice();
        const currentTab = reordered.shift();
        if (currentTab) {
          reordered.splice(1, 0, currentTab);
        }
        return reordered;
      }
      const tokens = normalized.split(/\s+/).filter(Boolean);
      if (tokens.length === 0) {
        return list.slice();
      }
      return list.filter((tab) => {
        const haystack = buildTabSearchText(tab);
        if (!haystack) {
          return false;
        }
        return tokens.every((token) => haystack.includes(token));
      });
    }

    function normalizeTabMatchUrl(url) {
      if (SEARCH_UTILS && typeof SEARCH_UTILS.buildTabMatchUrl === 'function') {
        return SEARCH_UTILS.buildTabMatchUrl(url);
      }
      if (!url) {
        return '';
      }
      try {
        const parsed = new URL(url);
        const protocol = String(parsed.protocol || '').toLowerCase();
        if (protocol !== 'http:' && protocol !== 'https:') {
          return String(url).trim().toLowerCase();
        }
        const hostname = normalizeHost(parsed.hostname);
        const host = parsed.port ? `${hostname}:${parsed.port}` : hostname;
        let path = parsed.pathname || '/';
        path = path.replace(/\/+$/, '');
        if (!path) {
          path = '/';
        }
        return `${host}${path}${parsed.search || ''}`;
      } catch (e) {
        return String(url).trim().toLowerCase();
      }
    }

    function normalizeTabMatchUrlWithoutSearch(url) {
      if (SEARCH_UTILS && typeof SEARCH_UTILS.buildTabMatchUrl === 'function') {
        return SEARCH_UTILS.buildTabMatchUrl(url, { includeSearch: false });
      }
      if (!url) {
        return '';
      }
      try {
        const parsed = new URL(url);
        const protocol = String(parsed.protocol || '').toLowerCase();
        if (protocol !== 'http:' && protocol !== 'https:') {
          return String(url).trim().toLowerCase();
        }
        const hostname = normalizeHost(parsed.hostname);
        const host = parsed.port ? `${hostname}:${parsed.port}` : hostname;
        let path = parsed.pathname || '/';
        path = path.replace(/\/+$/, '');
        if (!path) {
          path = '/';
        }
        return `${host}${path}`;
      } catch (e) {
        return String(url).trim().toLowerCase();
      }
    }

    function getMatchedOpenTabIdForSuggestion(suggestion) {
      if (!suggestion || !suggestion.url || !Array.isArray(tabs) || tabs.length === 0) {
        return null;
      }
      const target = normalizeTabMatchUrl(suggestion.url);
      if (!target) {
        return null;
      }
      for (let i = 0; i < tabs.length; i += 1) {
        const tab = tabs[i];
        if (!tab || typeof tab.id !== 'number' || !tab.url) {
          continue;
        }
        const current = normalizeTabMatchUrl(tab.url);
        if (current && current === target) {
          return tab.id;
        }
      }
      if (prioritizeCurrentPageMatch && typeof currentOverlayTabId === 'number') {
        const currentTab = tabs.find((tab) => tab && tab.id === currentOverlayTabId) || null;
        const targetNoSearch = normalizeTabMatchUrlWithoutSearch(suggestion.url);
        const currentNoSearch = currentTab ? normalizeTabMatchUrlWithoutSearch(currentTab.url) : '';
        if (targetNoSearch && currentNoSearch && targetNoSearch === currentNoSearch) {
          return currentOverlayTabId;
        }
      }
      return null;
    }

    function isCurrentOverlayTabUrl(url) {
      if (!prioritizeCurrentPageMatch || !url) {
        return false;
      }
      const currentTab = typeof currentOverlayTabId === 'number'
        ? (tabs.find((tab) => tab && tab.id === currentOverlayTabId) || null)
        : null;
      const currentUrl = currentTab && currentTab.url
        ? currentTab.url
        : initialContextTabUrl;
      if (!currentUrl) {
        return false;
      }
      const targetFull = normalizeTabMatchUrl(url);
      const currentFull = normalizeTabMatchUrl(currentUrl);
      if (targetFull && currentFull && targetFull === currentFull) {
        return true;
      }
      const targetNoSearch = normalizeTabMatchUrlWithoutSearch(url);
      const currentNoSearch = normalizeTabMatchUrlWithoutSearch(currentUrl);
      return Boolean(targetNoSearch && currentNoSearch && targetNoSearch === currentNoSearch);
    }

    function getAutocompleteCandidate(allSuggestions, rawQuery) {
      if (!Array.isArray(allSuggestions) || !rawQuery) {
        return null;
      }
      const rawLower = rawQuery.toLowerCase();
      const passes = [true, false];
      for (let passIndex = 0; passIndex < passes.length; passIndex += 1) {
        const skipGoogleSuggest = passes[passIndex];
        for (let i = 0; i < allSuggestions.length; i += 1) {
          const suggestion = allSuggestions[i];
          if (!suggestion || suggestion.type === 'newtab') {
            continue;
          }
          if (skipGoogleSuggest && suggestion.type === 'googleSuggest') {
            continue;
          }
          if (suggestion.commandText) {
            const commandText = String(suggestion.commandText).toLowerCase();
            if (commandText.startsWith(rawLower)) {
              return {
                completion: suggestion.commandText,
                url: '',
                title: suggestion.title || '',
                type: 'command'
              };
            }
            const aliases = Array.isArray(suggestion.commandAliases) ? suggestion.commandAliases : [];
            for (let aliasIndex = 0; aliasIndex < aliases.length; aliasIndex += 1) {
              const alias = String(aliases[aliasIndex] || '').toLowerCase();
              if (alias && alias.startsWith(rawLower)) {
                return {
                  completion: aliases[aliasIndex],
                  url: '',
                  title: suggestion.title || '',
                  type: 'command'
                };
              }
            }
          }
          const urlText = getUrlDisplay(suggestion.url);
          if (urlText && urlText.toLowerCase().startsWith(rawLower)) {
            return {
              completion: urlText,
              url: suggestion.url || '',
              title: suggestion.title || '',
              type: 'url'
            };
          }
          const titleText = suggestion.title || '';
          if (titleText && titleText.toLowerCase().startsWith(rawLower)) {
            return {
              completion: titleText,
              url: suggestion.url || '',
              title: suggestion.title || '',
              type: 'title'
            };
          }
        }
      }
      return null;
    }

    function getDomainPrefixCandidate(allSuggestions, rawQuery) {
      if (!Array.isArray(allSuggestions) || !rawQuery) {
        return null;
      }
      const rawLower = rawQuery.toLowerCase();
      for (let i = 0; i < allSuggestions.length; i += 1) {
        const suggestion = allSuggestions[i];
        if (!suggestion || suggestion.type === 'newtab') {
          continue;
        }
        const urlText = getUrlDisplay(suggestion.url);
        if (!urlText) {
          continue;
        }
        const host = urlText.split('/')[0] || '';
        if (host.toLowerCase().startsWith(rawLower)) {
          return {
            completion: urlText,
            url: suggestion.url || '',
            title: suggestion.title || '',
            type: 'url'
          };
        }
      }
      return null;
    }

    function getAutocompleteCandidateFromSuggestion(suggestion, rawQuery) {
      if (!suggestion || !rawQuery || suggestion.type === 'newtab') {
        return null;
      }
      const rawLower = rawQuery.toLowerCase();
      if (suggestion.commandText) {
        const commandText = String(suggestion.commandText).toLowerCase();
        if (commandText.startsWith(rawLower)) {
          return {
            completion: suggestion.commandText,
            url: '',
            title: suggestion.title || '',
            type: 'command'
          };
        }
        const aliases = Array.isArray(suggestion.commandAliases) ? suggestion.commandAliases : [];
        for (let aliasIndex = 0; aliasIndex < aliases.length; aliasIndex += 1) {
          const alias = String(aliases[aliasIndex] || '');
          if (alias.toLowerCase().startsWith(rawLower)) {
            return {
              completion: alias,
              url: '',
              title: suggestion.title || '',
              type: 'command'
            };
          }
        }
      }
      const urlText = getUrlDisplay(suggestion.url);
      if (urlText) {
        const host = urlText.split('/')[0] || '';
        if (host.toLowerCase().startsWith(rawLower) || urlText.toLowerCase().startsWith(rawLower)) {
          return {
            completion: urlText,
            url: suggestion.url || '',
            title: suggestion.title || '',
            type: 'url'
          };
        }
      }
      const titleText = suggestion.title || '';
      if (titleText && titleText.toLowerCase().startsWith(rawLower)) {
        return {
          completion: titleText,
          url: suggestion.url || '',
          title: suggestion.title || '',
          type: 'title'
        };
      }
      return null;
    }

    function clearAutocomplete() {
      autocompleteState = null;
    }

    function dismissAutocompletePreviewOnNonTabKey(event) {
      if (!event || event.key === 'Tab' || event.key === 'Enter') {
        return false;
      }
      const isModifierOnly = event.key === 'Shift' || event.key === 'Control' || event.key === 'Alt' || event.key === 'Meta';
      if (isModifierOnly) {
        return false;
      }
      if (!autocompleteState || !autocompleteState.completion) {
        return false;
      }
      const rawQuery = typeof autocompleteState.rawQuery === 'string'
        ? autocompleteState.rawQuery
        : String(latestRawInputValue || '');
      if (searchInput && searchInput.value !== rawQuery) {
        searchInput.value = rawQuery;
        searchInput.setSelectionRange(rawQuery.length, rawQuery.length);
      }
      latestRawInputValue = rawQuery;
      latestOverlayQuery = rawQuery.trim();
      clearAutocomplete();
      return true;
    }

    function applyAutocomplete(allSuggestions, primarySuggestion, primaryHighlightReason) {
      const rawQuery = latestRawInputValue;
      const trimmedQuery = rawQuery.trim();
      if (overlaySearchResultPriorityMode === 'search') {
        if (searchInput && searchInput.value !== rawQuery) {
          searchInput.value = rawQuery;
          searchInput.setSelectionRange(rawQuery.length, rawQuery.length);
        }
        clearAutocomplete();
        return;
      }
      if (Date.now() - lastDeletionAt < 250) {
        clearAutocomplete();
        return;
      }
      if (siteSearchState || localSearchScopeState) {
        clearAutocomplete();
        return;
      }
      if (!isEnglishQuery(trimmedQuery) || !rawQuery) {
        clearAutocomplete();
        return;
      }
      if (!allSuggestions || !Array.isArray(allSuggestions)) {
        clearAutocomplete();
        return;
      }
      if (searchInput.selectionStart !== searchInput.value.length || searchInput.selectionEnd !== searchInput.value.length) {
        return;
      }
      const shouldForcePrimaryAlignment = Boolean(
        primarySuggestion &&
        primaryHighlightReason &&
        primaryHighlightReason !== 'autocomplete' &&
        primaryHighlightReason !== 'default'
      );
      let candidate = null;
      if (primarySuggestion) {
        candidate = getAutocompleteCandidateFromSuggestion(primarySuggestion, rawQuery);
      }
      if (!candidate && shouldForcePrimaryAlignment) {
        clearAutocomplete();
        return;
      }
      if (!candidate) {
        const autocompleteSuggestions = getKeywordSearchSuggestionState(allSuggestions).autocompleteSuggestions;
        candidate = getDomainPrefixCandidate(autocompleteSuggestions, rawQuery) ||
          getAutocompleteCandidate(autocompleteSuggestions, rawQuery);
      }
      if (!candidate || !candidate.completion) {
        clearAutocomplete();
        return;
      }
      if (candidate.type === 'title') {
        clearAutocomplete();
        return;
      }
      if (candidate.completion.length <= rawQuery.length) {
        clearAutocomplete();
        return;
      }
      if (!candidate.completion.toLowerCase().startsWith(rawQuery.toLowerCase())) {
        clearAutocomplete();
        return;
      }
      const displayText = candidate.completion;
      searchInput.value = displayText;
      searchInput.setSelectionRange(rawQuery.length, displayText.length);
      autocompleteState = {
        completion: candidate.completion,
        displayText: displayText,
        url: candidate.url || '',
        rawQuery: rawQuery,
        title: candidate.title || '',
        type: candidate.type || ''
      };
    }

    function buildSearchUrl(template, query) {
      if (!template) {
        return '';
      }
      return template.replace(/\{query\}/g, encodeURIComponent(query));
    }

    function hasOpenAndSubmitSiteSearchAction(provider) {
      return Boolean(
        provider &&
        String(provider.action || '').trim() === 'openAndSubmit'
      );
    }

    function normalizeOverlaySiteSearchTemplate(template) {
      if (typeof SEARCH_UTILS.normalizeSiteSearchTemplate === 'function') {
        return SEARCH_UTILS.normalizeSiteSearchTemplate(template);
      }
      return String(template || '')
        .trim()
        .replace(/\{\{\{s\}\}\}/g, '{query}')
        .replace(/\{s\}/g, '{query}')
        .replace(/\{searchTerms\}/g, '{query}');
    }

    function isAiSiteSearchProvider(provider) {
      if (typeof SEARCH_UTILS.isAiSiteSearchProvider === 'function') {
        return SEARCH_UTILS.isAiSiteSearchProvider(provider);
      }
      const template = normalizeOverlaySiteSearchTemplate(provider && provider.template);
      return Boolean(
      provider &&
      (
        String(provider.category || '').trim() === 'aiSearch' ||
        hasOpenAndSubmitSiteSearchAction(provider) ||
          (template && !template.includes('{query}'))
        )
      );
    }

    function isSearchEngineSiteSearchProvider(provider) {
      if (typeof SEARCH_UTILS.isSearchEngineSiteSearchProvider === 'function') {
        return SEARCH_UTILS.isSearchEngineSiteSearchProvider(provider);
      }
      return Boolean(provider && String(provider.category || '').trim() === 'searchEngine');
    }

    function isInteractiveSiteSearchProvider(provider) {
      if (typeof SEARCH_UTILS.isInteractiveSiteSearchProvider === 'function') {
        return SEARCH_UTILS.isInteractiveSiteSearchProvider(provider);
      }
      return Boolean(
        hasOpenAndSubmitSiteSearchAction(provider) &&
        ['geminiPrompt', 'chatgptPrompt', 'doubaoPrompt', 'qianwenQuery', 'yuanbaoPrompt', 'minimaxPrompt', 'deepseekPrompt', 'kimiPrompt'].includes(String(provider.submitStrategy || '').trim())
      );
    }

    function openSiteSearchProviderQuery(provider, query, event) {
      const trimmedQuery = String(query || '').trim();
      if (!provider || !trimmedQuery) {
        return false;
      }
      if (isInteractiveSiteSearchProvider(provider)) {
        chrome.runtime.sendMessage({
          action: 'runSiteSearchProviderQuery',
          provider: provider,
          query: trimmedQuery,
          disposition: getSearchResultNewTabDisposition(event)
        });
        return true;
      }
      const siteUrl = buildSearchUrl(provider.template, trimmedQuery);
      if (!siteUrl) {
        return false;
      }
      chrome.runtime.sendMessage({
        action: 'createTab',
        url: siteUrl,
        disposition: getSearchResultNewTabDisposition(event)
      });
      return true;
    }

    function getProviderFaviconPageUrl(provider) {
      if (typeof SHORTCUT_FAVICON.getSiteSearchProviderPageUrl === 'function') {
        return SHORTCUT_FAVICON.getSiteSearchProviderPageUrl(provider);
      }
      const template = provider && provider.template ? provider.template : '';
      if (!template) {
        return '';
      }
      try {
        const url = template.replace(/\{query\}/g, 'test');
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return '';
        }
        return `${parsed.origin}/`;
      } catch (e) {
        return '';
      }
    }

    function recordSearchSuggestionSelectionFromSuggestion(suggestion, query, source) {
      if (!suggestion || suggestion.forceSearch || suggestion.provider || !suggestion.url) {
        return;
      }
      try {
        chrome.runtime.sendMessage({
          action: 'recordSearchSuggestionSelection',
          query: String(query || '').trim(),
          url: suggestion.url,
          title: suggestion.title || '',
          type: suggestion.type || 'history',
          source: source || 'overlay'
        });
      } catch (e) {
        // Selection ranking is best-effort; never block opening the target.
      }
    }

    function getProviderIcon(provider) {
      if (typeof SHORTCUT_FAVICON.getSiteSearchProviderIcon === 'function') {
        const resolvedIcon = SHORTCUT_FAVICON.getSiteSearchProviderIcon(
          siteSearchIconCacheLoaded ? siteSearchIconCache : {},
          provider,
          Date.now(),
          {
            ...siteSearchIconCacheOptions,
            resolveAssetUrl: (path) => chrome.runtime.getURL(path)
          }
        );
        const safeResolvedIcon = getSafeOverlayFaviconUrl(resolvedIcon);
        if (safeResolvedIcon) {
          return safeResolvedIcon;
        }
      }
      const explicitIcon = provider && (provider.icon || provider.iconUrl) ? (provider.icon || provider.iconUrl) : '';
      const safeExplicitIcon = getSafeOverlayFaviconUrl(explicitIcon);
      const providerIconPageUrl = explicitIcon ? getCanonicalPageUrlForFavicon(explicitIcon) : '';
      if (providerIconPageUrl && providerIconPageUrl !== explicitIcon) {
        return getSafeOverlayFaviconUrl(getPageFaviconCandidateUrl(providerIconPageUrl)) || safeExplicitIcon;
      }
      if (safeExplicitIcon) {
        return safeExplicitIcon;
      }
      const providerPageUrl = getProviderFaviconPageUrl(provider);
      try {
        const hostname = normalizeHost(new URL(providerPageUrl).hostname);
        return getSafeOverlayFaviconUrl(getPageFaviconCandidateUrl(providerPageUrl) || getHostFaviconUrl(hostname));
      } catch (e) {
        return '';
      }
    }

    function getProviderIconAttachPageUrl(provider, iconUrl, iconHost) {
      const providerPageUrl = getProviderFaviconPageUrl(provider);
      if (providerPageUrl) {
        return providerPageUrl;
      }
      const canonicalIconPageUrl = getCanonicalPageUrlForFavicon(iconUrl);
      if (canonicalIconPageUrl && canonicalIconPageUrl !== iconUrl) {
        return canonicalIconPageUrl;
      }
      const host = String(iconHost || '').trim();
      return host ? `https://${host}/` : '';
    }

    function attachInputModeProviderIcon(icon, context) {
      const iconUrl = context && context.iconUrl ? String(context.iconUrl).trim() : '';
      if (!icon || !iconUrl || iconUrl.startsWith('data:') || iconUrl.startsWith('chrome-extension:')) {
        return false;
      }
      const iconHost = context && context.iconHost ? String(context.iconHost).trim() : '';
      const pageUrl = getProviderIconAttachPageUrl(
        context && context.provider ? context.provider : null,
        iconUrl,
        iconHost
      );
      if (!pageUrl) {
        return false;
      }
      const hostKey = iconHost || getHostFromUrl(pageUrl);
      attachResolvedFaviconWithFallbacks(icon, pageUrl, hostKey, iconUrl, () => {
        if (context && typeof context.onIconUnavailable === 'function') {
          context.onIconUnavailable();
          return;
        }
        if (icon && typeof icon.remove === 'function') {
          icon.remove();
        }
      });
      return true;
    }

    function getSiteSearchProviders() {
      if (siteSearchProvidersCache) {
        return Promise.resolve(siteSearchProvidersCache);
      }
      return SITE_SEARCH_STORE.loadSiteSearchProviders({
        chromeApi: chrome,
        storageArea,
        storageKeys: {
          custom: SITE_SEARCH_STORAGE_KEY,
          disabled: SITE_SEARCH_DISABLED_STORAGE_KEY
        },
        defaultProviders: defaultSiteSearchProviders,
        mergeCustomProviders: SEARCH_UTILS.mergeCustomProviders,
        getStorageValues: getStorageValuesAsync
      }).then((items) => {
        siteSearchProvidersCache = items;
        return items;
      });
    }

    getSiteSearchProviders();

    siteSearchStorageListener = (changes, areaName) => {
      if (!isPrimaryStorageAreaName(areaName) ||
          (!changes[SITE_SEARCH_STORAGE_KEY] && !changes[SITE_SEARCH_DISABLED_STORAGE_KEY])) {
        return;
      }
      if (!storageArea) {
        return;
      }
      storageArea.get([SITE_SEARCH_STORAGE_KEY, SITE_SEARCH_DISABLED_STORAGE_KEY], (result) => {
        const customItems = Array.isArray(result[SITE_SEARCH_STORAGE_KEY]) ? result[SITE_SEARCH_STORAGE_KEY] : [];
        const disabledKeys = Array.isArray(result[SITE_SEARCH_DISABLED_STORAGE_KEY])
          ? result[SITE_SEARCH_DISABLED_STORAGE_KEY]
          : [];
        siteSearchProvidersCache = SITE_SEARCH_STORE.mergeStoredProviders(
          defaultSiteSearchProviders,
          customItems,
          disabledKeys,
          SEARCH_UTILS.mergeCustomProviders
        );
        if (latestOverlayQuery) {
          requestOverlaySearchSuggestions(latestOverlayQuery);
        }
      });
    };
    chrome.storage.onChanged.addListener(siteSearchStorageListener);

    siteSearchIconStorageListener = (changes, areaName) => {
      const iconChange = changes && changes[SITE_SEARCH_ICON_CACHE_STORAGE_KEY];
      if (areaName !== 'local' || !iconChange) {
        return;
      }
      siteSearchIconCache = typeof SHORTCUT_FAVICON.normalizeCacheMap === 'function'
        ? SHORTCUT_FAVICON.normalizeCacheMap(
          iconChange.newValue,
          Date.now(),
          siteSearchIconCacheOptions
        )
        : (iconChange.newValue && typeof iconChange.newValue === 'object'
          ? iconChange.newValue
          : {});
      siteSearchIconCacheLoaded = true;
      siteSearchIconCacheRevision += 1;
      siteSearchIconCacheLoadPromise = Promise.resolve(siteSearchIconCache);
      if (siteSearchState && inputModeController) {
        const activeProvider = siteSearchState;
        setSiteSearchPrefix(activeProvider, defaultTheme);
        getThemeForProvider(activeProvider).then((theme) => {
          if (siteSearchState === activeProvider) {
            setSiteSearchPrefix(activeProvider, theme);
          }
        }).catch(() => {});
      }
      if (inputModeController && typeof inputModeController.refreshModeMenu === 'function') {
        inputModeController.refreshModeMenu();
      }
      if (latestOverlayQuery) {
        requestOverlaySearchSuggestions(latestOverlayQuery);
      }
    };
    chrome.storage.onChanged.addListener(siteSearchIconStorageListener);

    function getSiteSearchDisplayName(provider) {
      if (!provider) {
        return t('site_search_default', '站内');
      }
      const mapping = typeof SEARCH_UTILS.getSiteSearchProviderDisplayNameMessage === 'function'
        ? SEARCH_UTILS.getSiteSearchProviderDisplayNameMessage(provider)
        : null;
      if (mapping) {
        return t(mapping.messageKey, mapping.fallback);
      }
      return provider.name || provider.key || t('site_search_default', '站内');
    }

    function getSiteSearchActionTitle(provider, query) {
      const site = getSiteSearchDisplayName(provider);
      const queryText = String(query || '').trim();
      if (isAiSiteSearchProvider(provider)) {
        return queryText
          ? formatMessage('ask_ai_provider_query', '向 {site} 提问 "{query}"', { site, query: queryText })
          : formatMessage('ask_ai_provider', '向 {site} 提问', { site });
      }
      return queryText
        ? formatMessage('search_in_site_query', '在 {site} 中搜索 "{query}"', { site, query: queryText })
        : formatMessage('search_in_site', '在 {site} 中搜索', { site });
    }

    function getSiteSearchPrefixText(provider) {
      if (isAiSiteSearchProvider(provider)) {
        return getSiteSearchDisplayName(provider);
      }
      return getSiteSearchDisplayName(provider) || formatMessage('search_in_site', '在 {site} 中搜索', {
        site: provider && provider.name ? provider.name : ''
      });
    }

    function getProviderHost(provider) {
      return SEARCH_UTILS.getSiteSearchProviderHost(provider);
    }

    function findProviderForSuggestionMatch(suggestion, providers) {
      return SEARCH_UTILS.findProviderForSiteSearchSuggestion(suggestion, providers);
    }

    function getInlineSiteSearchCandidate(input, providers) {
      return SEARCH_UTILS.getInlineSiteSearchCandidate(input, providers);
    }

    function promoteStrongNavigationMatch(list, rawQuery) {
      if (typeof SEARCH_UTILS.promoteStrongNavigationMatch !== 'function') {
        return null;
      }
      return SEARCH_UTILS.promoteStrongNavigationMatch(list, rawQuery, {
        getDirectNavigationUrl,
        getUrlDisplay
      });
    }

    function getKeywordSearchSuggestionState(list) {
      return SEARCH_UTILS.getKeywordSearchSuggestionState(list);
    }

    function matchesTopSitePrefix(suggestion, input) {
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

    function getTopSiteMatchCandidate(list, input) {
      if (!Array.isArray(list)) {
        return null;
      }
      const query = String(input || '').trim();
      if (!query || /\s/.test(query)) {
        return null;
      }
      let fallback = null;
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

    function promoteTopSiteMatch(list, queryText) {
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

    function getSiteSearchTriggerCandidate(input, providers, topSiteMatch) {
      return SEARCH_UTILS.getSiteSearchTriggerCandidate(input, providers, topSiteMatch, {
        matchesTopSitePrefix
      });
    }

    function normalizeEnabledSearchResultSourceTypes(value) {
      if (SETTINGS && typeof SETTINGS.normalizeSearchResultSourceTypes === 'function') {
        return SETTINGS.normalizeSearchResultSourceTypes(value);
      }
      return ['topSite', 'bookmark', 'history'];
    }

    function getLocalSearchScopeCandidate(input, rules) {
      if (!SEARCH_UTILS || typeof SEARCH_UTILS.findLocalSearchScope !== 'function') {
        return null;
      }
      const scope = SEARCH_UTILS.findLocalSearchScope(input, rules);
      if (!scope || !enabledSearchResultSourceTypes.includes(scope.sourceType)) {
        return null;
      }
      return scope;
    }

    function getLocalSearchScopeLabel(scope) {
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

    function getLocalSearchScopeIconClass(sourceType) {
      if (sourceType === 'bookmark') {
        return 'ri-bookmark-3-line';
      }
      if (sourceType === 'history') {
        return 'ri-history-line';
      }
      return 'ri-star-line';
    }

    function getSearchModeProviderId(provider) {
      return `provider:${provider && (provider.key || provider.name) ? (provider.key || provider.name) : ''}`;
    }

    function getOverlayDefaultSearchModeProvider(providers) {
      if (typeof SEARCH_UTILS.getSearchEngineSiteSearchProvider === 'function') {
        return SEARCH_UTILS.getSearchEngineSiteSearchProvider(
          overlaySearchEngineState,
          providers
        );
      }
      return SEARCH_UTILS.findSiteSearchProvider(
        overlaySearchEngineState.id || 'google',
        providers
      );
    }

    function getCurrentPageSiteSearchModeProvider(providers) {
      const currentPageHost = typeof SEARCH_UTILS.getUrlHost === 'function'
        ? SEARCH_UTILS.getUrlHost(initialContextTabUrl)
        : '';
      if (!currentPageHost) {
        return null;
      }
      return (providers || []).find((provider) => (
        !isSearchEngineSiteSearchProvider(provider) &&
        !isAiSiteSearchProvider(provider) &&
        SEARCH_UTILS.siteSearchHostsMatch(
          currentPageHost,
          getProviderHost(provider)
        )
      )) || null;
    }

    function getSearchModeProviders() {
      const providers = (siteSearchProvidersCache && siteSearchProvidersCache.length > 0)
        ? siteSearchProvidersCache
        : defaultSiteSearchProviders;
      const defaultProvider = getOverlayDefaultSearchModeProvider(providers);
      if (!defaultProvider || providers.some((provider) => (
        getSearchModeProviderId(provider) === getSearchModeProviderId(defaultProvider)
      ))) {
        return providers;
      }
      return [defaultProvider].concat(providers);
    }

    function buildSearchModeMenuItems() {
      const engineGroup = t('search_scope_group_engines', '搜索引擎');
      const localGroup = t('search_scope_group_local', '浏览器内容');
      const aiGroup = t('search_scope_group_ai', 'AI 搜索');
      const siteGroup = t('search_scope_group_sites', '站内搜索');
      const items = [];
      const providers = getSearchModeProviders();
      providers
        .filter((provider) => isSearchEngineSiteSearchProvider(provider))
        .concat(providers.filter((provider) => (
          !isSearchEngineSiteSearchProvider(provider) && !isAiSiteSearchProvider(provider)
        )))
        .concat(providers.filter((provider) => isAiSiteSearchProvider(provider)))
        .forEach((provider) => {
          const isAi = isAiSiteSearchProvider(provider);
          const isSearchEngine = isSearchEngineSiteSearchProvider(provider);
          items.push({
            id: getSearchModeProviderId(provider),
            kind: 'provider',
            provider,
            label: getSiteSearchDisplayName(provider),
            group: isSearchEngine ? engineGroup : (isAi ? aiGroup : siteGroup),
            iconUrl: getProviderIcon(provider),
            iconClass: isAi ? 'ri-search-ai-line' : 'ri-global-line',
            isAi,
            active: Boolean(siteSearchState && getSearchModeProviderId(siteSearchState) === getSearchModeProviderId(provider))
          });
        });
      items.push({
        id: 'openTabs',
        kind: 'openTabs',
        label: t('search_open_tabs_only_entry', '搜索已打开标签页'),
        searchTerms: ['open tabs', 'tabs', 'browser'],
        group: localGroup,
        iconClass: 'ri-window-line',
        menuIconName: 'browser',
        active: openTabsSearchModeActive
      });
      ['topSite', 'bookmark', 'history'].forEach((sourceType) => {
        if (!enabledSearchResultSourceTypes.includes(sourceType)) {
          return;
        }
        items.push({
          id: `local:${sourceType}`,
          kind: 'local',
          sourceType,
          label: getLocalSearchScopeLabel({ sourceType }),
          searchTerms: sourceType === 'topSite'
            ? ['top sites', 'frequent sites', 'favorites']
            : (sourceType === 'bookmark'
              ? ['bookmark', 'bookmarks']
              : ['history', 'browsing history']),
          group: localGroup,
          iconClass: getLocalSearchScopeIconClass(sourceType),
          menuIconName: sourceType === 'topSite' ? 'star' : sourceType,
          active: Boolean(localSearchScopeState && localSearchScopeState.sourceType === sourceType)
        });
      });
      return items;
    }

    function getSearchModeMenuItems() {
      if (siteSearchIconCacheLoaded) {
        return buildSearchModeMenuItems();
      }
      return loadSiteSearchIconCache().then(buildSearchModeMenuItems);
    }

    function openSearchModeMenuFromDoubleTab() {
      cancelPendingOpenTabsPrefixEntry();
      const expectedSiteSearchState = siteSearchState;
      const expectedLocalSearchScopeState = localSearchScopeState;
      const expectedOpenTabsSearchModeActive = openTabsSearchModeActive;
      const expectedInputValue = String(searchInput.value || '');
      const isActivationCurrent = () => Boolean(
        inputModeController &&
        siteSearchState === expectedSiteSearchState &&
        localSearchScopeState === expectedLocalSearchScopeState &&
        openTabsSearchModeActive === expectedOpenTabsSearchModeActive &&
        String(searchInput.value || '') === expectedInputValue &&
        !expectedSiteSearchState &&
        !expectedLocalSearchScopeState
      );
      const activateDefaultProvider = (providers) => {
        if (!isActivationCurrent()) {
          return false;
        }
        const currentPageProvider = getCurrentPageSiteSearchModeProvider(providers);
        const provider = currentPageProvider ||
          getOverlayDefaultSearchModeProvider(providers);
        if (!provider) {
          return false;
        }
        if (expectedInputValue.trim()) {
          activateSiteSearch(provider, {
            animatePrefix: false,
            preserveResults: true
          });
          restoreSearchModeQuery(expectedInputValue);
        } else {
          activateSiteSearch(provider, { animatePrefix: false });
        }
        const openResult = inputModeController.openModeMenu(
          currentPageProvider ? 'input' : 'none'
        );
        return Promise.resolve(openResult).then(Boolean);
      };
      return Promise.all([
        overlaySearchEngineStateReady.catch(() => overlaySearchEngineState),
        getSiteSearchProviders().catch(() => defaultSiteSearchProviders),
        loadSiteSearchIconCache().catch(() => siteSearchIconCache)
      ]).then(([, providers]) => activateDefaultProvider(providers));
    }

    function restoreSearchModeQuery(rawQuery) {
      const value = String(rawQuery || '');
      searchInput.value = value;
      latestRawInputValue = value;
      latestOverlayQuery = value.trim();
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function shouldPreserveSearchModeResults(rawQuery) {
      return Boolean(String(rawQuery || '').trim());
    }

    function selectSearchModeMenuItem(item) {
      if (!item || !item.kind) {
        return;
      }
      const rawQuery = searchInput.value || '';
      const preserveResults = shouldPreserveSearchModeResults(rawQuery);
      if (item.kind === 'openTabs') {
        activateOpenTabsSearchMode({
          deferResults: true,
          preserveResults
        });
        restoreSearchModeQuery(rawQuery);
        return;
      }
      if (item.kind === 'local') {
        activateLocalSearchScope(
          { sourceType: item.sourceType },
          { preserveResults }
        );
        restoreSearchModeQuery(rawQuery);
        return;
      }
      if (item.kind === 'provider' && item.provider) {
        activateSiteSearch(item.provider, { preserveResults });
        restoreSearchModeQuery(rawQuery);
      }
    }

    function getLocalSearchScopeTabHintProvider(scope) {
      const source = getLocalSearchScopeLabel(scope);
      return {
        name: source,
        tabHintLabel: formatMessage(
          'local_search_tab_hint',
          '仅搜索{source}',
          { source }
        )
      };
    }

    function setLocalSearchScopePrefix(scope) {
      if (!inputModeController || !scope) {
        return;
      }
      inputModeController.setPrefixText(
        getLocalSearchScopeLabel(scope),
        defaultTheme,
        {
          animate: true,
          iconClass: getLocalSearchScopeIconClass(scope.sourceType),
          menuIconName: scope.sourceType === 'topSite' ? 'star' : scope.sourceType,
          modeId: `local:${scope.sourceType}`
        }
      );
    }

    function activateLocalSearchScope(scope, activationOptions) {
      if (!scope || !enabledSearchResultSourceTypes.includes(scope.sourceType)) {
        return false;
      }
      const options = activationOptions && typeof activationOptions === 'object'
        ? activationOptions
        : {};
      cancelPendingOverlaySuggestionRequests();
      openTabsSearchModeActive = false;
      localSearchScopeState = scope;
      localSearchScopeTriggerState = null;
      siteSearchState = null;
      siteSearchTriggerState = null;
      inlineSearchState = null;
      searchInput.value = '';
      latestRawInputValue = '';
      latestOverlayQuery = '';
      clearAutocomplete();
      setLocalSearchScopePrefix(scope);
      if (options.preserveResults !== true) {
        clearSearchSuggestions();
      }
      return true;
    }

    function clearLocalSearchScope() {
      if (!localSearchScopeState) {
        return false;
      }
      overlaySuggestionRequestSeq += 1;
      localSearchScopeState = null;
      localSearchScopeTriggerState = null;
      inlineSearchState = null;
      clearSiteSearchPrefix();
      clearAutocomplete();
      return true;
    }

    function activateSiteSearch(provider, activationOptions) {
      if (!provider) {
        return;
      }
      const options = activationOptions && typeof activationOptions === 'object'
        ? activationOptions
        : {};
      cancelPendingOpenTabsPrefixEntry();
      if (options.preserveResults === true) {
        cancelPendingOverlaySuggestionRequests();
      }
      openTabsSearchModeActive = false;
      localSearchScopeState = null;
      localSearchScopeTriggerState = null;
      siteSearchState = provider;
      inlineSearchState = null;
      searchInput.value = '';
      latestRawInputValue = '';
      latestOverlayQuery = '';
      clearAutocomplete();
      const immediateTheme = getImmediateThemeForSuggestion({ provider }) || defaultTheme;
      setSiteSearchPrefix(provider, immediateTheme, {
        animate: options.animatePrefix !== false
      });
      getThemeForProvider(provider).then((theme) => {
        if (siteSearchState === provider) {
          setSiteSearchPrefix(provider, theme);
        }
      });
      if (options.preserveResults !== true) {
        clearSearchSuggestions();
      }
    }

    function clearSiteSearch() {
      if (!siteSearchState) {
        return;
      }
      siteSearchState = null;
      inlineSearchState = null;
      clearSiteSearchPrefix();
      clearAutocomplete();
    }

    function activateOpenTabsSearchMode(options) {
      const prefixOptions = options || {};
      cancelPendingOpenTabsPrefixEntry();
      cancelPendingOverlaySuggestionRequests();
      openTabsSearchModeActive = true;
      siteSearchState = null;
      localSearchScopeState = null;
      localSearchScopeTriggerState = null;
      inlineSearchState = null;
      siteSearchTriggerState = null;
      clearAutocomplete();
      if (prefixOptions.deferPrefixEntry === true) {
        scheduleOpenTabsPrefixEntry(prefixOptions);
      } else {
        setOpenTabsSearchPrefix(defaultTheme, prefixOptions);
      }
      latestRawInputValue = searchInput.value || '';
      latestOverlayQuery = latestRawInputValue.trim();
      if (prefixOptions.deferResults !== true) {
        renderCachedTabsForOverlay(latestOverlayQuery);
        requestTabsAndRender(latestOverlayQuery);
      }
    }

    function clearOpenTabsSearchMode() {
      if (!openTabsSearchModeActive) {
        return;
      }
      cancelPendingOpenTabsPrefixEntry();
      openTabsSearchModeActive = false;
      clearSiteSearchPrefix();
      clearAutocomplete();
      const rawValue = searchInput.value || '';
      const query = rawValue.trim();
      latestRawInputValue = rawValue;
      latestOverlayQuery = query;
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

    function openDocumentPipPickerFromOverlay() {
      chrome.runtime.sendMessage({ action: 'openDocumentPipPicker' });
    }

    function getLiveSearchInputFromEvent(event) {
      const target = event && event.target && event.target.tagName
        ? event.target
        : null;
      if (target &&
          String(target.tagName || '').toLowerCase() === 'input' &&
          inputContainer &&
          typeof inputContainer.contains === 'function' &&
          inputContainer.contains(target)) {
        return target;
      }
      if (inputContainer && typeof inputContainer.querySelector === 'function') {
        const currentInput = inputContainer.querySelector('#_x_extension_search_input_2024_unique_') ||
          inputContainer.querySelector('input');
        if (currentInput) {
          return currentInput;
        }
      }
      return searchInput;
    }

    function syncLiveSearchInputFromEvent(event) {
      const liveInput = getLiveSearchInputFromEvent(event);
      if (liveInput && liveInput !== searchInput) {
        searchInput = liveInput;
        applyNoTranslate(searchInput);
      }
      return searchInput;
    }

    function runSearchInputEventOnce(event, handler) {
      if (event) {
        if (handledSearchInputEvents.has(event)) {
          return;
        }
        handledSearchInputEvents.add(event);
      }
      handler(event);
    }

    function clearPendingSearchTriggerHint() {
      siteSearchTriggerState = null;
      localSearchScopeTriggerState = null;
      clearSiteSearchTabHint();
    }

    function syncSearchTriggerHintFromInput(rawValue) {
      const triggerInput = String(rawValue || '').trim();
      if (!triggerInput ||
          siteSearchState ||
          localSearchScopeState ||
          openTabsSearchModeActive ||
          isSlashCommandInput(triggerInput)) {
        clearPendingSearchTriggerHint();
        return;
      }

      const providers = (siteSearchProvidersCache && siteSearchProvidersCache.length > 0)
        ? siteSearchProvidersCache
        : defaultSiteSearchProviders;
      if (getInlineSiteSearchCandidate(triggerInput, providers)) {
        clearPendingSearchTriggerHint();
        return;
      }

      // Resolve every exact configured key, name, alias, domain, or local-scope
      // trigger synchronously so its matching Tab hint does not wait for the
      // asynchronous suggestion request to finish.
      const provider = getSiteSearchTriggerCandidate(triggerInput, providers, null);
      if (provider) {
        siteSearchTriggerState = { provider, rawInput: triggerInput };
        localSearchScopeTriggerState = null;
        setSiteSearchTabHint(provider);
        return;
      }

      const shortcutRules = window._x_extension_shortcut_rules_2024_unique_;
      const localScope = getLocalSearchScopeCandidate(triggerInput, shortcutRules);
      if (localScope) {
        siteSearchTriggerState = null;
        localSearchScopeTriggerState = { scope: localScope, rawInput: triggerInput };
        setSiteSearchTabHint(getLocalSearchScopeTabHintProvider(localScope));
        return;
      }

      clearPendingSearchTriggerHint();
    }

    // Add input event for search suggestions
    function handleSearchInputCompositionStart(event) {
      runSearchInputEventOnce(event, () => {
        cancelPendingOverlaySuggestionRequests();
        syncLiveSearchInputFromEvent(event);
        imeKeyGuard.markCompositionStart(event);
        clearAutocomplete();
        clearPendingSearchTriggerHint();
      });
    }

    function handleSearchInputCompositionEnd(event) {
      runSearchInputEventOnce(event, () => {
        imeKeyGuard.markCompositionEnd(event);
        const liveInput = syncLiveSearchInputFromEvent(event);
        notifyOverlayLoadingSession(liveInput);
        const rawValue = liveInput ? (liveInput.value || '') : '';
        const query = rawValue.trim();
        updateModeBadge(rawValue);
        if (selectedIndex >= 0) {
          selectedIndex = -1;
          updateSelection();
        }
        latestOverlayQuery = query;
        latestRawInputValue = rawValue;
        clearAutocomplete();
        syncSearchTriggerHintFromInput(rawValue);
        if (query.length > 0) {
          if (!localSearchScopeState && isSlashCommandInput(query)) {
            updateSearchSuggestions([], query);
            return;
          }
          if (openTabsSearchModeActive) {
            renderCachedTabsOrRequest(query);
            return;
          }
          if (getDirectUrlSuggestion(query)) {
            updatePendingSearchSuggestions(query);
          }
          requestOverlaySearchSuggestions(query);
        } else {
          if (openTabsSearchModeActive) {
            renderCachedTabsOrRequest('');
            return;
          }
          clearSearchSuggestions();
        }
      });
    }

    function handleSearchInputEvent(event) {
      runSearchInputEventOnce(event, () => {
        if (inputHistoryController && !isApplyingSearchInputHistory) {
          inputHistoryController.resetNavigation();
        }
        const liveInput = syncLiveSearchInputFromEvent(event);
        notifyOverlayLoadingSession(liveInput);
        const rawValue = liveInput ? liveInput.value : '';
        const query = rawValue.trim();
        if (query &&
            overlayEngagementNoticeController &&
            typeof overlayEngagementNoticeController.recordMeaningfulUse === 'function') {
          overlayEngagementNoticeController.recordMeaningfulUse();
        }
        updateModeBadge(rawValue);
        const inputType = event && event.inputType;
        const isPaste = inputType === 'insertFromPaste';
        const isDelete = inputType && inputType.startsWith('delete');
        if (isDelete) {
          lastDeletionAt = Date.now();
        }
        if (imeKeyGuard.isComposing()) {
          latestRawInputValue = rawValue;
          latestOverlayQuery = query;
          return;
        }
        if (selectedIndex >= 0) {
          selectedIndex = -1;
          updateSelection();
        }
        if (!query && siteSearchState) {
          latestOverlayQuery = '';
          latestRawInputValue = '';
          clearAutocomplete();
          clearSearchSuggestions();
          return;
        }
        latestOverlayQuery = query;
        latestRawInputValue = rawValue;
        clearAutocomplete();
        syncSearchTriggerHintFromInput(rawValue);
        if (query.length > 0) {
          if (!localSearchScopeState && isSlashCommandInput(query)) {
            updateSearchSuggestions([], query);
            return;
          }
          if (openTabsSearchModeActive) {
            renderCachedTabsOrRequest(query);
            return;
          }
          if (isPaste || getDirectUrlSuggestion(query)) {
            updatePendingSearchSuggestions(query);
          }
          requestOverlaySearchSuggestions(query);
        } else {
          if (openTabsSearchModeActive) {
            renderCachedTabsOrRequest('');
            return;
          }
          // Clear suggestions and show tabs
          clearSearchSuggestions();
        }
      });
    }

    searchInput.addEventListener('compositionstart', handleSearchInputCompositionStart);
    searchInput.addEventListener('compositionend', handleSearchInputCompositionEnd);
    searchInput.addEventListener('input', handleSearchInputEvent);
    inputContainer.addEventListener('compositionstart', handleSearchInputCompositionStart, true);
    inputContainer.addEventListener('compositionend', handleSearchInputCompositionEnd, true);
    inputContainer.addEventListener('input', handleSearchInputEvent, true);
    const handleOverlayLoadingSessionSelection = (event) => {
      notifyOverlayLoadingSession(syncLiveSearchInputFromEvent(event));
    };
    inputContainer.addEventListener('select', handleOverlayLoadingSessionSelection, true);
    inputContainer.addEventListener('focusin', handleOverlayLoadingSessionSelection, true);
    inputContainer.addEventListener('pointerup', handleOverlayLoadingSessionSelection, true);

    // Add click outside to close functionality
    clickOutsideHandler = function(e) {
      const eventPath = e && typeof e.composedPath === 'function' ? e.composedPath() : [];
      const clickedInsideOverlay = overlay.contains(e.target) ||
        eventPath.includes(overlay) ||
        eventPath.includes(overlay._lumnoOverlayHost);
      if (!clickedInsideOverlay) {
        removeOverlay(overlay);
        document.removeEventListener('click', clickOutsideHandler);
      }
    };
    document.addEventListener('click', clickOutsideHandler);

    function handleTabKey(e) {
      if (!e || e.defaultPrevented) {
        return false;
      }
      if (inputModeController &&
          typeof inputModeController.handleModeMenuTabFocusToggle === 'function' &&
          inputModeController.handleModeMenuTabFocusToggle(e)) {
        return true;
      }
      if (inputModeController &&
          typeof inputModeController.shouldCompleteModeMenuDoubleTab === 'function') {
        const shouldOpenModeMenu =
          inputModeController.shouldCompleteModeMenuDoubleTab(e);
        if (shouldOpenModeMenu) {
          cancelPendingOpenTabsPrefixEntry();
          openSearchModeMenuFromDoubleTab();
          return true;
        }
        if (e.defaultPrevented) {
          return true;
        }
      }
      if (inputModeController &&
          typeof inputModeController.shouldOpenModeMenuForActiveModeOnTab === 'function' &&
          inputModeController.shouldOpenModeMenuForActiveModeOnTab(e)) {
        inputModeController.openModeMenu('none');
        return true;
      }
      if (siteSearchState || localSearchScopeState || openTabsSearchModeActive) {
        return false;
      }
      const rawValue = searchInput.value;
      const rawTrigger = latestRawInputValue || rawValue;
      const triggerInput = (rawTrigger || rawValue).trim();
      if (!triggerInput && inputModeController &&
          typeof inputModeController.shouldOpenModeMenuOnDoubleTab === 'function') {
        const shouldOpenModeMenu = inputModeController.shouldOpenModeMenuOnDoubleTab(e);
        if (shouldOpenModeMenu) {
          cancelPendingOpenTabsPrefixEntry();
          openSearchModeMenuFromDoubleTab();
          return true;
        }
        if (e.defaultPrevented) {
          activateOpenTabsSearchMode({
            deferPrefixEntry: true,
            preserveModeMenuDoubleTab: true
          });
          return true;
        }
        return false;
      }
      if (siteSearchTriggerState &&
          siteSearchTriggerState.rawInput === triggerInput &&
          siteSearchTriggerState.provider) {
        e.preventDefault();
        activateSiteSearch(siteSearchTriggerState.provider);
        return true;
      }
      if (localSearchScopeTriggerState &&
          localSearchScopeTriggerState.rawInput === triggerInput &&
          localSearchScopeTriggerState.scope) {
        e.preventDefault();
        return activateLocalSearchScope(localSearchScopeTriggerState.scope);
      }
      if (triggerInput) {
        e.preventDefault();
        const providers = (siteSearchProvidersCache && siteSearchProvidersCache.length > 0)
          ? siteSearchProvidersCache
          : defaultSiteSearchProviders;
        const topSiteMatch = getTopSiteMatchCandidate(currentSuggestions, triggerInput);
        const directProvider = getSiteSearchTriggerCandidate(triggerInput, providers, topSiteMatch);
        if (directProvider) {
          activateSiteSearch(directProvider);
          return true;
        }
        const cachedRules = window._x_extension_shortcut_rules_2024_unique_;
        const directLocalScope = getLocalSearchScopeCandidate(triggerInput, cachedRules);
        if (siteSearchProvidersCache && directLocalScope) {
          activateLocalSearchScope(directLocalScope);
          return true;
        }
        Promise.all([getSiteSearchProviders(), getShortcutRules()]).then(([items, rules]) => {
          if (siteSearchState || localSearchScopeState || openTabsSearchModeActive ||
              String(searchInput.value || '').trim() !== triggerInput) {
            return;
          }
          const asyncTopSiteMatch = getTopSiteMatchCandidate(currentSuggestions, triggerInput);
          const asyncProvider = getSiteSearchTriggerCandidate(triggerInput, items, asyncTopSiteMatch);
          if (asyncProvider) {
            activateSiteSearch(asyncProvider);
            return;
          }
          const asyncLocalScope = getLocalSearchScopeCandidate(triggerInput, rules);
          if (asyncLocalScope) {
            activateLocalSearchScope(asyncLocalScope);
            return;
          }
          if (autocompleteState && autocompleteState.completion) {
            searchInput.value = autocompleteState.completion;
            searchInput.setSelectionRange(autocompleteState.completion.length, autocompleteState.completion.length);
            latestRawInputValue = autocompleteState.completion;
            latestOverlayQuery = autocompleteState.completion.trim();
            autocompleteState = null;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
        return true;
      }
      if (autocompleteState && autocompleteState.completion) {
        e.preventDefault();
        searchInput.value = autocompleteState.completion;
        searchInput.setSelectionRange(autocompleteState.completion.length, autocompleteState.completion.length);
        latestRawInputValue = autocompleteState.completion;
        latestOverlayQuery = autocompleteState.completion.trim();
        autocompleteState = null;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
      return false;
    }

    captureTabHandler = function(e) {
      if (!e || e.isTrusted !== true) {
        return;
      }
      if (e.key !== 'Tab') {
        return;
      }
      const searchRoot = searchInput && typeof searchInput.getRootNode === 'function'
        ? searchInput.getRootNode()
        : null;
      const activeInRoot = searchRoot && searchRoot.activeElement ? searchRoot.activeElement : null;
      if (document.activeElement !== searchInput && activeInRoot !== searchInput) {
        return;
      }
      handleTabKey(e);
    };
    document.addEventListener('keydown', captureTabHandler, true);

    function shouldRemoveSearchModeTagOnBackspace(event) {
      if (!inputModeController ||
          typeof inputModeController.shouldRemoveModeTagOnBackspace !== 'function') {
        return true;
      }
      const shouldRemove = inputModeController.shouldRemoveModeTagOnBackspace(event);
      if (!shouldRemove && event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      return shouldRemove;
    }

    function handleSearchInputKeydown(e) {
      syncSuggestionActionModifiersFromEvent(e);
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        e.stopPropagation();
      }
      if (e.key === 'Escape' && siteSearchState) {
        e.preventDefault();
        e.stopPropagation();
        clearSiteSearch();
        return;
      }
      if (e.key === 'Escape' && localSearchScopeState) {
        e.preventDefault();
        e.stopPropagation();
        clearLocalSearchScope();
        const fallbackQuery = searchInput.value.trim();
        if (fallbackQuery) {
          requestOverlaySearchSuggestions(fallbackQuery);
        } else {
          clearSearchSuggestions();
        }
        return;
      }
      if (e.key === 'Escape' && openTabsSearchModeActive) {
        e.preventDefault();
        e.stopPropagation();
        clearOpenTabsSearchMode();
        return;
      }
      if (e.key === 'Backspace' && siteSearchState && !searchInput.value) {
        if (!shouldRemoveSearchModeTagOnBackspace(e)) {
          return;
        }
        clearSiteSearch();
        return;
      }
      if (e.key === 'Backspace' && localSearchScopeState && !searchInput.value) {
        if (!shouldRemoveSearchModeTagOnBackspace(e)) {
          return;
        }
        clearLocalSearchScope();
        clearSearchSuggestions();
        return;
      }
      if (e.key === 'Backspace' && openTabsSearchModeActive && !searchInput.value) {
        if (!shouldRemoveSearchModeTagOnBackspace(e)) {
          return;
        }
        clearOpenTabsSearchMode();
        return;
      }
      if (isImeCompositionEvent(e)) {
        return;
      }
      const inputHistoryDirection =
        typeof SEARCH_INPUT_HISTORY.getShortcutDirection === 'function'
          ? SEARCH_INPUT_HISTORY.getShortcutDirection(e)
          : '';
      if (inputHistoryDirection) {
        e.preventDefault();
        e.stopPropagation();
        if (inputHistoryController) {
          const result = inputHistoryController.move(
            inputHistoryDirection,
            searchInput.value
          );
          if (result.handled) {
            isApplyingSearchInputHistory = true;
            try {
              searchInput.value = result.value;
              searchInput.setSelectionRange(result.value.length, result.value.length);
              searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            } finally {
              isApplyingSearchInputHistory = false;
            }
          }
        }
        return;
      }
      if (e.key === 'Tab') {
        handleTabKey(e);
        return;
      }
      const suggestionNavigationKey = getSuggestionNavigationKey(e);
      if (suggestionNavigationKey || e.key === 'Enter' || e.key === 'Escape') {
        if (suggestionNavigationKey) {
          e.stopPropagation();
        }
        keydownHandler(e);
        return;
      }
      dismissAutocompletePreviewOnNonTabKey(e);
      if (e.key !== 'Backspace' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        latestRawInputValue = searchInput.value;
        latestOverlayQuery = searchInput.value.trim();
      }
    }
    searchInput.addEventListener('keydown', handleSearchInputKeydown);
    searchInput.addEventListener('keypress', function(e) {
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        e.stopPropagation();
      }
    });
    searchInput.addEventListener('keyup', function(e) {
      syncSuggestionActionModifiersFromEvent(e);
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        e.stopPropagation();
      }
    });

    // Add keyboard navigation
    function getAutoHighlightIndex() {
      return suggestionItems.findIndex((item) => Boolean(item && item._xIsAutocompleteTop));
    }

    function shouldSwitchMatchedTabSuggestion(suggestion, index) {
      if (!suggestion || typeof suggestion._xMatchedTabId !== 'number') {
        return false;
      }
      if (prioritizeCurrentPageMatch &&
        typeof currentOverlayTabId === 'number' &&
        suggestion._xMatchedTabId === currentOverlayTabId &&
        index === 0) {
        return true;
      }
      if (!overlayTabQuickSwitchEnabled) {
        return false;
      }
      return index === 0;
    }

    function getSuggestionNavigationKey(event) {
      if (typeof SUGGESTION_NAVIGATION.getSuggestionNavigationKey === 'function') {
        return SUGGESTION_NAVIGATION.getSuggestionNavigationKey(event, {
          macosCtrlEnabled: macosCtrlSuggestionNavigationEnabled,
          navigatorLike: window && window.navigator ? window.navigator : null
        });
      }
      return event && (event.key === 'ArrowDown' || event.key === 'ArrowUp')
        ? event.key
        : '';
    }

    keydownHandler = function(e) {
      if (!e || e.isTrusted !== true) {
        return;
      }
      syncSuggestionActionModifiersFromEvent(e);
      if (SUGGESTION_NAVIGATION.handleNumberShortcutKeyEvent(
        e,
        suggestionItems,
        suggestionsContainer,
        numberShortcutOptions
      )) {
        return;
      }
      if (isImeCompositionEvent(e)) {
        return;
      }
      const suggestionNavigationKey = getSuggestionNavigationKey(e);
      dismissAutocompletePreviewOnNonTabKey(e);
      if (e.key === 'Escape' && overlay) {
        removeOverlay(overlay);
        document.removeEventListener('keydown', keydownHandler);
      } else if (suggestionNavigationKey === 'ArrowDown') {
        e.preventDefault();
        if (suggestionItems.length === 0) {
          return;
        }
        let didWrap = false;
        if (selectedIndex === -1) {
          // Move from auto highlight (or input) to next suggestion
          const autoIndex = getAutoHighlightIndex();
          selectedIndex = autoIndex >= 0
            ? (autoIndex + 1) % suggestionItems.length
            : 0;
          didWrap = autoIndex >= 0 && selectedIndex === 0;
        } else {
          // Move to next suggestion
          const previousIndex = selectedIndex;
          selectedIndex = (selectedIndex + 1) % suggestionItems.length;
          didWrap = previousIndex === suggestionItems.length - 1 && selectedIndex === 0;
        }
        updateSelection();
        scrollSelectedSuggestionIntoView('down', didWrap);
        searchInput.focus();
      } else if (suggestionNavigationKey === 'ArrowUp') {
        e.preventDefault();
        if (suggestionItems.length === 0) {
          return;
        }
        let didWrap = false;
        if (selectedIndex === 0) {
          // Wrap from first suggestion to the last suggestion
          selectedIndex = suggestionItems.length - 1;
          didWrap = true;
        } else if (selectedIndex === -1) {
          const autoIndex = getAutoHighlightIndex();
          if (autoIndex > 0) {
            selectedIndex = autoIndex - 1;
          } else if (autoIndex === 0) {
            selectedIndex = suggestionItems.length - 1;
            didWrap = true;
          } else {
            // Move from input to last suggestion
            selectedIndex = suggestionItems.length - 1;
            didWrap = true;
          }
        } else {
          // Move to previous suggestion
          selectedIndex = selectedIndex - 1;
        }
        updateSelection();
        scrollSelectedSuggestionIntoView('up', didWrap);
        searchInput.focus();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query && inputHistoryController) {
          inputHistoryController.record(query);
        }
        const commandMatch = localSearchScopeState ? null : getCommandMatch(query);
        if (commandMatch && selectedIndex === -1) {
          if (commandMatch.command.type === 'modeSwitch') {
            applyThemeModeChange(getNextThemeMode(overlayThemeMode || 'system'));
            searchInput.focus();
            return;
          } else if (commandMatch.command.type === 'commandNewTab') {
            chrome.runtime.sendMessage({ action: 'openNewTab' });
          } else if (commandMatch.command.type === 'commandSettings') {
            chrome.runtime.sendMessage({ action: 'openOptionsPage' });
          } else if (commandMatch.command.type === 'commandOpenTabs') {
            searchInput.value = '';
            latestRawInputValue = '';
            latestOverlayQuery = '';
            activateOpenTabsSearchMode();
            searchInput.focus();
            return;
          } else if (commandMatch.command.type === 'commandCopyUrl') {
            chrome.runtime.sendMessage({ action: 'copyCurrentPageUrl' });
          } else if (commandMatch.command.type === 'commandDocumentPip') {
            openDocumentPipPickerFromOverlay();
          }
          removeOverlay(overlay);
          document.removeEventListener('click', clickOutsideHandler);
          document.removeEventListener('keydown', keydownHandler);
          document.removeEventListener('keydown', captureTabHandler, true);
          return;
        }
        if (!localSearchScopeState && isModeCommand(query) && selectedIndex === -1) {
          applyThemeModeChange(getNextThemeMode(overlayThemeMode || 'system'));
          return;
        }

        const activeSuggestionIndex = selectedIndex >= 0
          ? selectedIndex
          : getAutoHighlightIndex();
        if (activeSuggestionIndex >= 0 && suggestionItems[activeSuggestionIndex]) {
          // Check if we're showing search suggestions or tab suggestions
          const activeItem = suggestionItems[activeSuggestionIndex];
          const isSearchSuggestion = Boolean(activeItem._xIsSearchSuggestion);
          let canKeepOverlayOpen = false;

          if (isSearchSuggestion && currentSuggestions[activeSuggestionIndex]) {
            const selectedSuggestion = currentSuggestions[activeSuggestionIndex];
            if (selectedSuggestion.type === 'modeSwitch') {
              applyThemeModeChange(selectedSuggestion.nextMode);
              searchInput.focus();
              return;
            }
            if (selectedSuggestion.type === 'commandNewTab') {
              chrome.runtime.sendMessage({ action: 'openNewTab' });
              removeOverlay(overlay);
              document.removeEventListener('click', clickOutsideHandler);
              document.removeEventListener('keydown', keydownHandler);
              document.removeEventListener('keydown', captureTabHandler, true);
              return;
            }
            if (selectedSuggestion.type === 'commandSettings') {
              chrome.runtime.sendMessage({ action: 'openOptionsPage' });
              removeOverlay(overlay);
              document.removeEventListener('click', clickOutsideHandler);
              document.removeEventListener('keydown', keydownHandler);
              document.removeEventListener('keydown', captureTabHandler, true);
              return;
            }
            if (selectedSuggestion.type === 'commandOpenTabs') {
              searchInput.value = '';
              latestRawInputValue = '';
              latestOverlayQuery = '';
              activateOpenTabsSearchMode();
              searchInput.focus();
              return;
            }
            if (selectedSuggestion.type === 'commandCopyUrl') {
              chrome.runtime.sendMessage({ action: 'copyCurrentPageUrl' });
              removeOverlay(overlay);
              document.removeEventListener('click', clickOutsideHandler);
              document.removeEventListener('keydown', keydownHandler);
              document.removeEventListener('keydown', captureTabHandler, true);
              return;
            }
            if (selectedSuggestion.type === 'commandDocumentPip') {
              openDocumentPipPickerFromOverlay();
              removeOverlay(overlay);
              document.removeEventListener('click', clickOutsideHandler);
              document.removeEventListener('keydown', keydownHandler);
              document.removeEventListener('keydown', captureTabHandler, true);
              return;
            }
            if (selectedSuggestion.type === 'siteSearchPrompt' && selectedSuggestion.provider) {
              activateSiteSearch(selectedSuggestion.provider);
              searchInput.focus();
              return;
            }
            if (selectedSuggestion.provider && selectedSuggestion.searchQuery) {
              if (openSiteSearchProviderQuery(selectedSuggestion.provider, selectedSuggestion.searchQuery, e)) {
                finishOverlayResultActivation(e, true);
              }
              return;
            }
            if (shouldSwitchMatchedTabSuggestion(selectedSuggestion, activeSuggestionIndex)) {
              openMatchedTabSuggestion(selectedSuggestion, e, activeItem, query);
              canKeepOverlayOpen = Boolean(selectedSuggestion.url);
            } else if (selectedSuggestion.forceSearch && selectedSuggestion.searchQuery) {
              if (shouldOpenSearchResultInBackgroundTab(e) && selectedSuggestion.url) {
                recordSearchSuggestionSelectionFromSuggestion(selectedSuggestion, query, 'overlay');
                chrome.runtime.sendMessage({
                  action: 'createTab',
                  url: selectedSuggestion.url,
                  disposition: 'backgroundTab'
                });
              } else {
                chrome.runtime.sendMessage({
                  action: 'searchOrNavigate',
                  query: selectedSuggestion.searchQuery,
                  forceSearch: true
                });
              }
              canKeepOverlayOpen = Boolean(selectedSuggestion.url);
            } else {
              // Navigate to the suggested URL
              recordSearchSuggestionSelectionFromSuggestion(selectedSuggestion, query, 'overlay');
              chrome.runtime.sendMessage({
                action: 'createTab',
                url: selectedSuggestion.url,
                disposition: getSearchResultCreateDisposition(selectedSuggestion, e, activeItem)
              });
              canKeepOverlayOpen = true;
            }
          } else if (!isSearchSuggestion) {
            if (activeItem && activeItem._xIsOpenTabsModeEntry) {
              activateOpenTabsSearchMode();
              searchInput.focus();
              return;
            }
            // Switch to existing tab
            if (activeItem && activeItem._xIsRenderedTabSuggestion && activeItem._xSuggestion) {
              openMatchedTabSuggestion(activeItem._xSuggestion, e, activeItem, query);
              canKeepOverlayOpen = Boolean(activeItem._xSuggestion.url);
            } else if (activeItem && typeof activeItem._xTabId === 'number') {
              chrome.runtime.sendMessage({
                action: 'switchToTab',
                tabId: activeItem._xTabId
              });
            }
          }
          finishOverlayResultActivation(e, canKeepOverlayOpen);
        } else if (query) {
          if (!localSearchScopeState && isSlashCommandInput(query)) {
            updateSearchSuggestions([], query);
            return;
          }
          if (localSearchScopeState) {
            return;
          }
          if (siteSearchState) {
            if (openSiteSearchProviderQuery(siteSearchState, query, e)) {
              finishOverlayResultActivation(e, true);
              return;
            }
          }
          const currentRawInput = (latestRawInputValue || searchInput.value || '').trim();
          if (inlineSearchState && inlineSearchState.isAuto &&
              inlineSearchState.rawInput === currentRawInput) {
            if (inlineSearchState.provider && inlineSearchState.query) {
              if (!openSiteSearchProviderQuery(inlineSearchState.provider, inlineSearchState.query, e)) {
                return;
              }
            } else if (inlineSearchState.url) {
              chrome.runtime.sendMessage({
                action: 'createTab',
                url: inlineSearchState.url,
                disposition: getSearchResultNewTabDisposition(e)
              });
            } else {
              return;
            }
            finishOverlayResultActivation(e, true);
            return;
          }
          if (autocompleteState && autocompleteState.url) {
            recordSearchSuggestionSelectionFromSuggestion({
              url: autocompleteState.url,
              title: autocompleteState.title || '',
              type: 'autocomplete'
            }, query, 'overlay');
            chrome.runtime.sendMessage({
              action: 'createTab',
              url: autocompleteState.url,
              disposition: getSearchResultNewTabDisposition(e)
            });
            finishOverlayResultActivation(e, true);
            return;
          }
          resolveQuickNavigation(query).then((targetUrl) => {
            if (targetUrl) {
              chrome.runtime.sendMessage({
                action: 'createTab',
                url: targetUrl,
                disposition: getSearchResultNewTabDisposition(e)
              });
            } else if (shouldOpenSearchResultInBackgroundTab(e)) {
              chrome.runtime.sendMessage({
                action: 'searchOrNavigate',
                query: query,
                disposition: 'backgroundTab'
              });
            } else {
              // Handle search or URL navigation
              chrome.runtime.sendMessage({
                action: 'searchOrNavigate',
                query: query
              });
            }
            finishOverlayResultActivation(e, true);
          });
        }
      }
    };

    keyupHandler = function(e) {
      if (!e || e.isTrusted !== true) {
        return;
      }
      syncSuggestionActionModifiersFromEvent(e);
      SUGGESTION_NAVIGATION.handleNumberShortcutKeyEvent(
        e,
        suggestionItems,
        suggestionsContainer,
        numberShortcutOptions
      );
    };

    overlayKeyCaptureHandler = function(e) {
      if (!e || e.isTrusted !== true) {
        if (e && typeof e.stopImmediatePropagation === 'function') {
          e.stopImmediatePropagation();
        }
        return;
      }
      if (!overlay || !overlay.isConnected) {
        return;
      }
      const searchRoot = searchInput && typeof searchInput.getRootNode === 'function'
        ? searchInput.getRootNode()
        : null;
      const activeInRoot = searchRoot && searchRoot.activeElement ? searchRoot.activeElement : null;
      const searchInputActive = document.activeElement === searchInput ||
        activeInRoot === searchInput;
      const modeMenuActive = Boolean(
        inputModeController &&
        typeof inputModeController.shouldHandleModeMenuKeyEvent === 'function' &&
        inputModeController.shouldHandleModeMenuKeyEvent(e)
      );
      if (!searchInputActive && !modeMenuActive) {
        return;
      }
      if (isImeCompositionEvent(e)) {
        e.stopImmediatePropagation();
        return;
      }
      syncSuggestionActionModifiersFromEvent(e);
      if ((e.type === 'keydown' || e.type === 'keyup') &&
          SUGGESTION_NAVIGATION.handleNumberShortcutKeyEvent(
            e,
            suggestionItems,
            suggestionsContainer,
            numberShortcutOptions
          )) {
        e.stopImmediatePropagation();
        return;
      }
      if (e.type === 'keydown' && searchInputActive && getSuggestionNavigationKey(e)) {
        handleSearchInputKeydown(e);
        e.stopImmediatePropagation();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }
      if (e.type === 'keydown') {
        if (modeMenuActive &&
            typeof inputModeController.handleModeMenuKeyEvent === 'function') {
          inputModeController.handleModeMenuKeyEvent(e);
        } else {
          handleSearchInputKeydown(e);
        }
      } else if (e.type === 'keyup') {
        syncSuggestionActionModifiersFromEvent(e);
      }
      e.stopImmediatePropagation();
    };

    window.addEventListener('keydown', overlayKeyCaptureHandler, true);
    window.addEventListener('keypress', overlayKeyCaptureHandler, true);
    window.addEventListener('keyup', overlayKeyCaptureHandler, true);
    document.addEventListener('keydown', keydownHandler);
    document.addEventListener('keyup', keyupHandler);
    overlayModifierBlurHandler = function() {
      setSuggestionActionModifiersActive(false, false, false);
      SUGGESTION_NAVIGATION.cancelNumberShortcuts(suggestionsContainer);
    };
    window.addEventListener('blur', overlayModifierBlurHandler);

    function getOverlaySuggestionRefreshQuery() {
      return latestOverlayQuery || (searchInput ? String(searchInput.value || '').trim() : '');
    }

    function refreshOverlaySuggestionsAfterHistoryDelete() {
      const queryToRefresh = getOverlaySuggestionRefreshQuery();
      if (!queryToRefresh) {
        updateSearchSuggestions([], '');
        return;
      }
      requestOverlaySearchSuggestions(queryToRefresh);
    }

    function deleteHistorySuggestionUrl(suggestion) {
      const targetUrl = suggestion && suggestion.url ? String(suggestion.url) : '';
      if (!targetUrl) {
        return;
      }
      chrome.runtime.sendMessage({
        action: 'deleteHistoryUrl',
        url: targetUrl
      }, function(response) {
        if (chrome.runtime && chrome.runtime.lastError) {
          return;
        }
        if (!response || response.ok !== true) {
          return;
        }
        refreshOverlaySuggestionsAfterHistoryDelete();
      });
    }

    function updateSelection() {
      ensureOverlaySuggestionsView().updateSelection(selectedIndex);
    }

    function syncSuggestionLastState() {
      suggestionItems.forEach((item, index) => {
        if (item && typeof item.setAttribute === 'function') {
          item.setAttribute('data-last', index === suggestionItems.length - 1 ? 'true' : 'false');
        }
      });
    }

    function scrollSelectedSuggestionIntoView(direction, didWrap) {
      if (!suggestionsContainer || selectedIndex < 0) {
        return;
      }
      const item = suggestionItems[selectedIndex];
      SUGGESTION_NAVIGATION.scrollItemIntoView(suggestionsContainer, item, {
        direction,
        didWrap,
        inset: 8
      });
    }

    function getSearchPanelsLayoutTransitionMenu() {
      if (!inputModeController ||
          typeof inputModeController.isModeMenuVisible !== 'function' ||
          !inputModeController.isModeMenuVisible()) {
        return null;
      }
      const menu = inputModeController && inputModeController.menuElement
        ? inputModeController.menuElement
        : inputParts.modeMenu;
      return menu && !menu.hidden ? menu : null;
    }

    function applyInstantSuggestionsHeightLayout(container) {
      if (!container) {
        return;
      }
      container.removeAttribute('data-height-clipped');
      [
        'flex',
        'height',
        'overflow',
        'overflow-x',
        'overflow-y',
        'padding-top',
        'padding-bottom',
        'transition',
        'will-change'
      ].forEach((property) => container.style.removeProperty(property));
      // Results adopt their natural height in the same render commit. Keep an
      // explicit guard so page styles cannot reintroduce a container tween.
      container.style.setProperty('transition', 'none', 'important');
    }

    function commitSuggestionsNaturalHeightAfterRender() {
      applyInstantSuggestionsHeightLayout(suggestionsContainer);
      syncSearchModeMenuResultOffset();
    }

    function closeOverlayAfterCommand() {
      removeOverlay(overlay);
      document.removeEventListener('click', clickOutsideHandler);
      document.removeEventListener('keydown', keydownHandler);
      document.removeEventListener('keydown', captureTabHandler, true);
    }

    function activateRenderedOverlaySuggestion(suggestion, query, event, index, item) {
      if (!suggestion) {
        return;
      }
      if (suggestion.type === 'commandNewTab') {
        chrome.runtime.sendMessage({ action: 'openNewTab' });
        closeOverlayAfterCommand();
        return;
      }
      if (suggestion.type === 'commandSettings') {
        chrome.runtime.sendMessage({ action: 'openOptionsPage' });
        closeOverlayAfterCommand();
        return;
      }
      if (suggestion.type === 'commandOpenTabs') {
        searchInput.value = '';
        latestRawInputValue = '';
        latestOverlayQuery = '';
        activateOpenTabsSearchMode();
        searchInput.focus();
        return;
      }
      if (suggestion.type === 'commandCopyUrl') {
        chrome.runtime.sendMessage({ action: 'copyCurrentPageUrl' });
        closeOverlayAfterCommand();
        return;
      }
      if (suggestion.type === 'commandDocumentPip') {
        openDocumentPipPickerFromOverlay();
        closeOverlayAfterCommand();
        return;
      }
      if (suggestion.type === 'siteSearchPrompt' && suggestion.provider) {
        activateSiteSearch(suggestion.provider);
        searchInput.focus();
        return;
      }
      if (suggestion.type === 'modeSwitch') {
        applyThemeModeChange(suggestion.nextMode);
        searchInput.focus();
        return;
      }
      if (shouldSwitchMatchedTabSuggestion(suggestion, index)) {
        openMatchedTabSuggestion(suggestion, event, item, query);
        finishOverlayResultActivation(event, Boolean(suggestion.url));
        return;
      }
      if (suggestion.provider && suggestion.searchQuery) {
        openSiteSearchProviderQuery(
          suggestion.provider,
          suggestion.searchQuery,
          event
        );
        finishOverlayResultActivation(event, true);
        return;
      }
      if (suggestion.forceSearch && suggestion.searchQuery) {
        if (shouldOpenSearchResultInBackgroundTab(event) && suggestion.url) {
          recordSearchSuggestionSelectionFromSuggestion(
            suggestion,
            query,
            'overlay'
          );
          chrome.runtime.sendMessage({
            action: 'createTab',
            url: suggestion.url,
            disposition: 'backgroundTab'
          });
        } else {
          chrome.runtime.sendMessage({
            action: 'searchOrNavigate',
            query: suggestion.searchQuery,
            forceSearch: true
          });
        }
      } else {
        recordSearchSuggestionSelectionFromSuggestion(
          suggestion,
          query,
          'overlay'
        );
        chrome.runtime.sendMessage({
          action: 'createTab',
          url: suggestion.url,
          disposition: getSearchResultCreateDisposition(
            suggestion,
            event,
            item
          )
        });
      }
      finishOverlayResultActivation(
        event,
        !(suggestion.forceSearch && !suggestion.url)
      );
    }

    function deleteRenderedOverlayHistorySuggestion(suggestion) {
      deleteHistorySuggestionUrl(suggestion);
    }

    function attachReactOverlayFavicon(image, pageUrl, host, candidates) {
      const resolvedCandidates = candidates && typeof candidates === 'object'
        ? candidates
        : {};
      attachResolvedFaviconWithFallbacks(
        image,
        pageUrl || '',
        host || '',
        resolvedCandidates.primaryUrl || resolvedCandidates.browserUrl || '',
        () => {
          image.dispatchEvent(new CustomEvent('lumno-favicon-fallback', {
            bubbles: true
          }));
        }
      );
    }

    function getReactOverlayFaviconCandidates(url, explicitUrl) {
      return {
        primaryUrl: explicitUrl || getPageFaviconCandidateUrl(url || ''),
        browserUrl: getChromeFaviconUrl(url || '')
      };
    }

    function ensureOverlaySuggestionsView() {
      if (overlaySuggestionsView) {
        return overlaySuggestionsView;
      }
      overlaySuggestionsView = OVERLAY_SUGGESTIONS_VIEW.createSuggestionsView({
        surface: 'overlay',
        document,
        container: suggestionsContainer,
        items: suggestionItems,
        t,
        formatMessage,
        getRiSvg,
        sanitizeDisplayText,
        formatTabRankDebugText,
        isTabRankScoreDebugEnabled: () => overlayTabScoreDebugEnabled,
        shouldBlockFaviconForHost: shouldBlockOverlayFaviconForHost,
        isLocalNetworkHost,
        getChromeFaviconUrl,
        getBrowserPageFaviconUrl: getPageFaviconCandidateUrl,
        getPageFaviconRenderCandidates: getReactOverlayFaviconCandidates,
        getHostFromUrl,
        getUrlDisplay,
        isSimpleModeEnabled: () => simpleModeEnabled,
        getThemeHostForSuggestion: (suggestion) => (
          suggestion && suggestion.url ? getHostFromUrl(suggestion.url) : ''
        ),
        getImmediateThemeForSuggestion,
        getThemeForSuggestion,
        getThemeForMode,
        getHoverColors,
        getHighlightColors,
        getNeutralHoverActionColors,
        applyThemeVariables,
        applyMarkVariables,
        applyFaviconOpticalAlignment,
        attachFaviconWithFallbacks: attachReactOverlayFavicon,
        preloadIcon,
        onSetSelectedIndex: (nextIndex) => {
          selectedIndex = nextIndex;
        },
        getSelectedIndex: () => selectedIndex,
        onSwitchToTab: (tab, event) => {
          const suggestion = {
            type: 'openTab',
            title: tab && tab.title ? tab.title : '',
            url: tab && tab.url ? tab.url : '',
            favicon: tab && tab.favIconUrl ? tab.favIconUrl : '',
            _xMatchedTabId: tab && typeof tab.id === 'number' ? tab.id : null
          };
          openMatchedTabSuggestion(
            suggestion,
            event,
            null,
            searchInput.value.trim()
          );
          finishOverlayResultActivation(event, Boolean(suggestion.url));
        },
        onActivateSuggestion: activateRenderedOverlaySuggestion,
        onDeleteHistory: deleteRenderedOverlayHistorySuggestion,
        onCopyUrl: copySearchResultUrl,
        showTopActionTooltip,
        hideTopActionTooltip,
        bindCursorTooltip: (target, getText, options) => (
          overlayCursorTooltipController &&
          overlayCursorTooltipController.bind(
            target,
            getText,
            Object.assign(
              {
                boundaryElement: overlay,
                positionMode: 'absolute'
              },
              options || {}
            )
          )
        ),
        getSearchActionLabel,
        getSiteSearchDisplayName,
        isAiSiteSearchProvider,
        getDefaultSearchEngineThemeUrl: getDefaultSearchEngineThemeUrlForOverlay,
        getBrandAccentForUrl,
        buildThemeFromAccent: (accent) => buildTheme(accent),
        actionModel: SUGGESTION_ACTION_MODEL,
        shouldSwitchMatchedTabSuggestion,
        defaultTheme,
        urlHighlightTheme,
        openTabSuggestionLimit: 1000,
        openTabInitialRenderLimit: 10,
        openTabRenderBatchSize: 16,
        enterAction: 'openNewTab',
        autoHighlightFirstTab: true
      });
      overlay._lumnoSuggestionsView = overlaySuggestionsView;
      return overlaySuggestionsView;
    }

    function renderOverlayEmptyState(message) {
      pauseOverlayAntiTranslateObserverForMutationBurst();
      ensureOverlaySuggestionsView().render({
        suggestions: [],
        query: latestOverlayQuery,
        emptyMessage: message || t('overlay_empty_result', '无匹配结果')
      });
    }

    function renderTabSuggestions(tabList) {
      pauseOverlayAntiTranslateObserverForMutationBurst();
      suggestionsContainer.removeAttribute('data-scope-result-enter');
      const reactView = ensureOverlaySuggestionsView();
      suggestionItems.length = 0;
      currentSuggestions = [];
      lastRenderedQuery = '';
      lastRenderedActionContextKey = '';
      const list = Array.isArray(tabList) ? tabList.slice() : [];
      setOpenTabsResultsViewport(true, list.length);
      if (list.length === 0) {
        const emptyText = openTabsSearchModeActive
          ? t('overlay_empty_open_tabs', '未找到匹配的已打开标签页')
          : t('overlay_empty_result', '无匹配结果');
        renderOverlayEmptyState(emptyText);
        setOverlayResultsCollapsed(false, { deferLayoutSync: true });
        commitSuggestionsNaturalHeightAfterRender();
        return;
      }
      reactView.renderTabs(list);
      suggestionsContainer.scrollTop = 0;
      setOverlayResultsCollapsed(false, { deferLayoutSync: true });
      selectedIndex = -1;
      updateSelection();
      commitSuggestionsNaturalHeightAfterRender();
    }

    function getOverlaySearchModeKey() {
      if (openTabsSearchModeActive) {
        return 'openTabs';
      }
      if (localSearchScopeState && localSearchScopeState.sourceType) {
        return `local:${localSearchScopeState.sourceType}`;
      }
      if (siteSearchState) {
        return `provider:${getSearchModeProviderId(siteSearchState)}`;
      }
      return 'default';
    }

    function renderCachedTabsForOverlay(filterQuery) {
      if (!overlayTabsCacheReady) {
        return false;
      }
      const query = typeof filterQuery === 'string'
        ? filterQuery
        : String(searchInput.value || '').trim();
      renderTabSuggestions(filterTabsForOverlay(tabs, query));
      return true;
    }

    function renderCachedTabsOrRequest(filterQuery) {
      if (renderCachedTabsForOverlay(filterQuery)) {
        return;
      }
      if (!overlayTabsRequestInFlight) {
        requestTabsAndRender(filterQuery);
      }
    }

    function requestTabsAndRender(filterQuery) {
      const request = { action: 'getTabsForOverlay' };
      const requestQuery = typeof filterQuery === 'string'
        ? filterQuery
        : String(searchInput.value || '').trim();
      const requestModeKey = getOverlaySearchModeKey();
      if (!requestQuery && !shouldShowOpenTabsForEmptyQuery()) {
        clearDefaultOpenTabsSuggestions();
        return;
      }
      if (typeof currentOverlayTabId === 'number') {
        request.currentTabId = currentOverlayTabId;
      }
      overlayTabsRequestSeq += 1;
      const requestSeq = overlayTabsRequestSeq;
      overlayTabsRequestInFlight = true;
      chrome.runtime.sendMessage(request, (response) => {
        if (requestSeq !== overlayTabsRequestSeq) {
          return;
        }
        overlayTabsRequestInFlight = false;
        const freshTabs = response && Array.isArray(response.tabs) ? response.tabs : [];
        currentOverlayTabId = (response && typeof response.currentTabId === 'number')
          ? response.currentTabId
          : null;
        tabs = freshTabs;
        overlayTabsCacheReady = true;
        if (requestModeKey !== getOverlaySearchModeKey()) {
          return;
        }
        const activeQuery = latestOverlayQuery;
        if (!openTabsSearchModeActive &&
            (activeQuery || !shouldShowOpenTabsForEmptyQuery())) {
          return;
        }
        renderCachedTabsForOverlay(activeQuery);
      });
    }

    function getBrowserInternalScheme() {
      const ua = navigator.userAgent || '';
      if (ua.includes('Edg/')) {
        return 'edge://';
      }
      if (ua.includes('Brave')) {
        return 'brave://';
      }
      if (ua.includes('Vivaldi')) {
        return 'vivaldi://';
      }
      if (ua.includes('OPR/') || ua.includes('Opera')) {
        return 'opera://';
      }
      return 'chrome://';
    }

    function normalizeBrandName(brand) {
      return String(brand || '').replace(/\s+/g, ' ').trim();
    }

    function isGreaseBrandName(brand) {
      const compact = normalizeBrandName(brand).toLowerCase().replace(/[^a-z]/g, '');
      return compact.includes('not') && compact.includes('brand');
    }

    function isChromiumEngineBrandName(brand) {
      return normalizeBrandName(brand).toLowerCase() === 'chromium';
    }

    function getClientHintBrowserName(userAgentData) {
      const brands = userAgentData && Array.isArray(userAgentData.brands)
        ? userAgentData.brands
        : [];
      const names = brands
        .map((item) => normalizeBrandName(item && item.brand))
        .filter((name) => name && !isGreaseBrandName(name));
      const productName = names.find((name) => {
        const lower = name.toLowerCase();
        return !isChromiumEngineBrandName(name) &&
          lower !== 'google chrome' &&
          lower !== 'chrome';
      });
      if (productName) {
        return productName;
      }
      return names.find((name) => !isChromiumEngineBrandName(name)) ||
        names.find((name) => isChromiumEngineBrandName(name)) ||
        '';
    }

    function getFallbackBrowserName(scheme) {
      if (scheme === 'edge://') {
        return 'Microsoft Edge';
      }
      if (scheme === 'brave://') {
        return 'Brave';
      }
      if (scheme === 'vivaldi://') {
        return 'Vivaldi';
      }
      if (scheme === 'opera://') {
        return 'Opera';
      }
      return 'Chrome';
    }

    function getBrowserInternalProfile() {
      const scheme = getBrowserInternalScheme();
      return {
        scheme,
        name: getClientHintBrowserName(navigator.userAgentData) ||
          getFallbackBrowserName(scheme)
      };
    }

    function getBrowserPageSuggestionTitle(browserProfile, targetUrl) {
      const browserName = browserProfile && browserProfile.name ? browserProfile.name : '';
      if (browserName) {
        return formatMessage('open_browser_url', '打开 {browser}：{url}', {
          browser: browserName,
          url: targetUrl
        });
      }
      return formatMessage('open_url', '打开 {url}', { url: targetUrl });
    }

    function getShortcutRules() {
      const cacheKey = '_x_extension_shortcut_rules_2024_unique_';
      const promiseKey = '_x_extension_shortcut_rules_promise_2024_unique_';
      if (window[cacheKey]) {
        return Promise.resolve(window[cacheKey]);
      }
      if (window[promiseKey]) {
        return window[promiseKey];
      }
      const rulesUrl = chrome.runtime.getURL('assets/data/shortcut-rules.json');
      const rulesPromise = fetch(rulesUrl)
        .then((response) => response.json())
        .then((data) => {
          const items = data && Array.isArray(data.items) ? data.items : [];
          window[cacheKey] = items;
          return items;
        })
        .catch(() => new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: 'getShortcutRules' }, (response) => {
            const items = response && Array.isArray(response.items) ? response.items : [];
            window[cacheKey] = items;
            resolve(items);
          });
        }));
      window[promiseKey] = rulesPromise;
      return rulesPromise;
    }

    function buildKeywordSuggestions(input, rules) {
      const queryLower = input.toLowerCase();
      const browserProfile = getBrowserInternalProfile();
      const scheme = browserProfile.scheme;
      const matches = [];
      rules.forEach((rule) => {
        if (!rule || !Array.isArray(rule.keys)) {
          return;
        }
        const isMatch = rule.keys.some((key) => queryLower.startsWith(key));
        if (!isMatch) {
          return;
        }
        if (rule.type === 'browserPage' && rule.path) {
          const targetUrl = `${scheme}${rule.path}`;
          matches.push({
            type: 'browserPage',
            title: getBrowserPageSuggestionTitle(browserProfile, targetUrl),
            url: targetUrl,
            favicon: getPageFaviconCandidateUrl(targetUrl) ||
              'https://img.icons8.com/?size=100&id=1LqgD1Q7n2fy&format=png&color=000000'
          });
        } else if (rule.type === 'url' && rule.url) {
          matches.push({
            type: 'browserPage',
            title: formatMessage('open_url', '打开 {url}', { url: rule.url }),
            url: rule.url,
            favicon: getPageFaviconCandidateUrl(rule.url) ||
              'https://img.icons8.com/?size=100&id=1LqgD1Q7n2fy&format=png&color=000000'
          });
        }
      });
      return matches;
    }

    function getDirectNavigationUrl(input) {
      const searchUtils = getSearchUtilsRuntime();
      if (searchUtils && typeof searchUtils.getDirectNavigationUrl === 'function') {
        return searchUtils.getDirectNavigationUrl(input);
      }
      return '';
    }

    function getDirectUrlSuggestion(input) {
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

    function resolveQuickNavigation(query) {
      const directUrlSuggestion = getDirectUrlSuggestion(query);
      if (directUrlSuggestion) {
        return Promise.resolve(directUrlSuggestion.url);
      }
      return getShortcutRules().then((rules) => {
        const keywordSuggestions = buildKeywordSuggestions(query, rules);
        if (keywordSuggestions.length > 0) {
          return keywordSuggestions[0].url;
        }
        return null;
      });
    }

    function getSuggestionVisualIdentity(suggestion) {
      if (typeof SUGGESTION_ACTION_MODEL.getSuggestionStructureIdentity !== 'function') {
        return '';
      }
      return SUGGESTION_ACTION_MODEL.getSuggestionStructureIdentity(suggestion);
    }

    function captureSuggestionVisualStateByIdentity(suggestions, items) {
      const visualStateByIdentity = new Map();
      if (!Array.isArray(suggestions) || !Array.isArray(items)) {
        return visualStateByIdentity;
      }
      suggestions.forEach((suggestion, index) => {
        const identity = getSuggestionVisualIdentity(suggestion);
        const item = items[index];
        if (!identity || !item) {
          return;
        }
        const favicon = typeof item.querySelector === 'function'
          ? item.querySelector('.x-ov-suggestion-favicon')
          : null;
        const faviconHadAppeared = Boolean(
          favicon &&
          favicon.getAttribute('data-favicon-has-appeared') === 'true' &&
          favicon.getAttribute('data-fallback-icon') !== 'true' &&
          favicon.getAttribute('data-favicon-placeholder') !== 'true'
        );
        const visualStates = visualStateByIdentity.get(identity) || [];
        visualStates.push({
          theme: item._xTheme || null,
          favicon: faviconHadAppeared ? favicon : null,
          faviconHadAppeared
        });
        visualStateByIdentity.set(identity, visualStates);
      });
      return visualStateByIdentity;
    }

    function takeSuggestionVisualState(visualStateByIdentity, suggestion) {
      if (!visualStateByIdentity || typeof visualStateByIdentity.get !== 'function') {
        return null;
      }
      const identity = getSuggestionVisualIdentity(suggestion);
      const visualStates = identity ? visualStateByIdentity.get(identity) : null;
      if (!visualStates || visualStates.length === 0) {
        return null;
      }
      const visualState = visualStates.shift();
      if (visualStates.length === 0) {
        visualStateByIdentity.delete(identity);
      }
      return visualState;
    }

    function getSuggestionUpdateKind(options) {
      if (typeof SUGGESTION_ACTION_MODEL.getSuggestionUpdateKind !== 'function') {
        return 'structure';
      }
      return SUGGESTION_ACTION_MODEL.getSuggestionUpdateKind({
        ...(options || {}),
        includeDebugReasons: Boolean(overlayTabScoreDebugEnabled)
      });
    }

    function getSuggestionActionContextKey(options) {
      if (SUGGESTION_ACTION_MODEL &&
          typeof SUGGESTION_ACTION_MODEL.getActionContextKey === 'function') {
        return SUGGESTION_ACTION_MODEL.getActionContextKey(options);
      }
      const config = options || {};
      return [
        Number.isInteger(config.primaryHighlightIndex) ? String(config.primaryHighlightIndex) : '-1',
        String(config.primaryHighlightReason || ''),
        config.onlyKeywordSuggestions ? 'keyword' : 'mixed'
      ].join('|');
    }

    function updateSearchSuggestions(suggestions, query, options) {
      if (query !== latestOverlayQuery) {
        return;
      }
      const renderOptions = options && typeof options === 'object' ? options : {};
      const forceFullRerender = renderOptions.forceFullRerender === true;
      const finalRemoteMix = renderOptions.finalRemoteMix === true;
      const remoteMixState = renderOptions.remoteMixState && typeof renderOptions.remoteMixState === 'object'
        ? renderOptions.remoteMixState
        : null;
      lastSuggestionResponse = Array.isArray(suggestions) ? suggestions : [];
      const rawTagInput = (latestRawInputValue || query || '').trim();
      const localSearchQueryModeActive = Boolean(localSearchScopeState && String(query || '').trim());
      const slashCommandModeActive = !localSearchQueryModeActive && isSlashCommandInput(rawTagInput);
      const siteSearchQueryModeActive = !localSearchQueryModeActive &&
        !slashCommandModeActive &&
        Boolean(siteSearchState && String(query || '').trim());
      const modeCommandActive = slashCommandModeActive && !siteSearchQueryModeActive && isModeCommand(rawTagInput);
      if (modeCommandActive) {
        if (storageArea) {
          storageArea.get([THEME_STORAGE_KEY], (result) => {
            const storedMode = result[THEME_STORAGE_KEY] || 'system';
            if (storedMode !== overlayThemeMode && query === latestOverlayQuery) {
              applyOverlayTheme(storedMode);
              updateSearchSuggestions([], query);
            }
          });
        }
      }

      // Add New Tab suggestion as first item
      const newTabSuggestion = (localSearchQueryModeActive || slashCommandModeActive ||
          modeCommandActive || siteSearchQueryModeActive)
        ? null
        : {
          type: 'newtab',
          title: simpleModeEnabled
            ? query
            : formatMessage('search_query', '搜索 "{query}"', {
                query: query
              }),
          url: buildDefaultSearchUrlForOverlay(query),
          favicon: getDefaultSearchEngineFaviconUrlForOverlay(),
          searchQuery: query,
          forceSearch: true
        };

      // Add ChatGPT suggestion as second item
      // const chatGptSuggestion = {
      //   type: 'chatgpt',
      //   title: `Ask ChatGPT: "${query}"`,
      //   url: `https://chatgpt.com/?q=${encodeURIComponent(query)}`,
      //   favicon: 'https://img.icons8.com/?size=100&id=fO5yVwARGUEB&format=png&color=ffffff'
      // };

      // Add Perplexity suggestion as third item
      // const perplexitySuggestion = {
      //   type: 'perplexity',
      //   title: `Ask Perplexity: "${query}"`,
      //   url: `https://perplexity.ai/search?q=${encodeURIComponent(query)}`,
      //   favicon: 'https://img.icons8.com/?size=100&id=kzJWN5jCDzpq&format=png&color=000000'
      // };

      getShortcutRules().then((rules) => {
        if (query !== latestOverlayQuery) {
          return;
        }
        if (!finalRemoteMix && remoteMixState &&
            remoteMixState.settled && remoteMixState.hasFinalSuggestions) {
          return;
        }
        const commandMatches = (slashCommandModeActive && !modeCommandActive && !siteSearchQueryModeActive)
          ? getCommandMatches(rawTagInput)
          : [];
        const hasCommand = commandMatches.length > 0;
        const preSuggestions = [];
        if (modeCommandActive) {
          preSuggestions.push(buildModeSuggestion());
        } else if (slashCommandModeActive && !siteSearchQueryModeActive) {
          commandMatches.forEach((command) => {
            preSuggestions.push(buildCommandSuggestion(command));
          });
        } else if (!siteSearchQueryModeActive && !localSearchQueryModeActive) {
          const directUrlSuggestion = getDirectUrlSuggestion(query);
          if (directUrlSuggestion && !isCurrentOverlayTabUrl(directUrlSuggestion.url)) {
            preSuggestions.push(directUrlSuggestion);
          }
          const keywordSuggestions = buildKeywordSuggestions(query, rules);
          preSuggestions.push(...keywordSuggestions);
        }

        const providersForTags = (siteSearchProvidersCache && siteSearchProvidersCache.length > 0)
          ? siteSearchProvidersCache
          : defaultSiteSearchProviders;
        if (!siteSearchProvidersCache && !pendingProviderReload) {
          pendingProviderReload = true;
          getSiteSearchProviders().then((items) => {
            pendingProviderReload = false;
            if (query !== latestOverlayQuery) {
              return;
            }
            siteSearchProvidersCache = items;
            updateSearchSuggestions(lastSuggestionResponse, query);
          });
        }
        const rawTagInputForInline = (latestRawInputValue || searchInput.value || '').trim();
        const inlineCandidate = (!localSearchQueryModeActive && !slashCommandModeActive &&
            !siteSearchQueryModeActive && !modeCommandActive && !hasCommand)
          ? getInlineSiteSearchCandidate(rawTagInputForInline, providersForTags)
          : null;
        let inlineSuggestion = null;
        if (inlineCandidate) {
          const inlineUrl = buildSearchUrl(inlineCandidate.provider.template, inlineCandidate.query);
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

        const siteSearchSuggestion = siteSearchQueryModeActive
          ? (() => {
              const siteUrl = buildSearchUrl(siteSearchState.template, query);
              if (!siteUrl) {
                return null;
              }
              return {
                type: 'siteSearch',
                title: getSiteSearchActionTitle(siteSearchState, query),
                url: siteUrl,
                favicon: getProviderIcon(siteSearchState),
                provider: siteSearchState,
                searchQuery: query
              };
            })()
          : null;

        // Add New Tab, ChatGPT and Perplexity suggestions to the beginning
        let allSuggestions = localSearchQueryModeActive
          ? suggestions.filter((item) => (
            item &&
            localSearchScopeState &&
            item.type === localSearchScopeState.sourceType
          ))
          : (slashCommandModeActive ? [...preSuggestions] : (siteSearchQueryModeActive
            ? (siteSearchSuggestion ? [siteSearchSuggestion] : [])
            : (modeCommandActive ? [...preSuggestions] : [...preSuggestions, newTabSuggestion, /*chatGptSuggestion, perplexitySuggestion,*/ ...suggestions])));
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
        allSuggestions = filterOverlayBlacklistedSuggestions(allSuggestions, query);
        const keywordSuggestionState = getKeywordSearchSuggestionState(allSuggestions);
        const onlyKeywordSuggestions = keywordSuggestionState.onlyKeywordSuggestions;

        let autocompleteCandidate = null;
        let primaryHighlightIndex = -1;
        let primaryHighlightReason = 'none';
        let strongNavigationMatch = null;
        let topSiteMatch = null;
        const inlineEnabled = Boolean(inlineSuggestion);
        let siteSearchTrigger = null;
        let mergedProvider = null;
        let primarySuggestion = null;
        const preferAutocompleteFirst = overlaySearchResultPriorityMode !== 'search';
        if (!localSearchQueryModeActive && !slashCommandModeActive && !modeCommandActive && !hasCommand) {
          if (!siteSearchState && !inlineEnabled && preferAutocompleteFirst) {
            strongNavigationMatch = promoteStrongNavigationMatch(allSuggestions, latestRawInputValue.trim());
            if (strongNavigationMatch) {
              primaryHighlightIndex = 0;
              primaryHighlightReason = 'navigation';
            }
            topSiteMatch = promoteTopSiteMatch(allSuggestions, latestRawInputValue.trim());
          }
          siteSearchTrigger = (!siteSearchState && !inlineEnabled)
            ? getSiteSearchTriggerCandidate(rawTagInput, providersForTags, topSiteMatch)
            : null;
          if (!siteSearchState && !inlineEnabled && !strongNavigationMatch && preferAutocompleteFirst && !onlyKeywordSuggestions) {
            autocompleteCandidate = getAutocompleteCandidate(keywordSuggestionState.autocompleteSuggestions, latestRawInputValue);
            if (autocompleteCandidate) {
              const candidateIndex = allSuggestions.findIndex((suggestion) => {
                if (!suggestion || suggestion.type === 'newtab') {
                  return false;
                }
                if (autocompleteCandidate.url && suggestion.url === autocompleteCandidate.url) {
                  return true;
                }
                const suggestionUrlText = getUrlDisplay(suggestion.url);
                if (suggestionUrlText && suggestionUrlText.toLowerCase() === autocompleteCandidate.completion.toLowerCase()) {
                  return true;
                }
                if (suggestion.title && suggestion.title.toLowerCase().startsWith(autocompleteCandidate.completion.toLowerCase())) {
                  return true;
                }
                return false;
              });
              if (candidateIndex >= 0 && candidateIndex !== 0) {
                const [candidateSuggestion] = allSuggestions.splice(candidateIndex, 1);
                allSuggestions.unshift(candidateSuggestion);
              }
              primaryHighlightIndex = 0;
              primaryHighlightReason = 'autocomplete';
            }
          }
          if (inlineSuggestion) {
            allSuggestions.unshift(inlineSuggestion);
            allSuggestions = filterOverlayBlacklistedSuggestions(allSuggestions, query);
            primaryHighlightIndex = 0;
            primaryHighlightReason = 'inline';
          } else if (!strongNavigationMatch && topSiteMatch && preferAutocompleteFirst) {
            primaryHighlightIndex = 0;
            primaryHighlightReason = 'topSite';
          }
          if (!siteSearchState && query && !onlyKeywordSuggestions && (overlayTabQuickSwitchEnabled || prioritizeCurrentPageMatch)) {
            const openTabMatch = typeof SEARCH_UTILS.findSearchOpenTabMatchIndex === 'function'
              ? SEARCH_UTILS.findSearchOpenTabMatchIndex(allSuggestions, {
                rawQuery: latestRawInputValue.trim(),
                primaryHighlightIndex,
                prioritizeCurrentPageMatch,
                currentTabId: currentOverlayTabId,
                openTabQuickSwitchEnabled: overlayTabQuickSwitchEnabled,
                getDirectNavigationUrl
              })
              : { index: -1, reason: '' };
            if (openTabMatch.index >= 0) {
              if (openTabMatch.index > 0) {
                const [openTabMatchSuggestion] = allSuggestions.splice(openTabMatch.index, 1);
                allSuggestions.unshift(openTabMatchSuggestion);
              }
              primaryHighlightIndex = 0;
              primaryHighlightReason = openTabMatch.reason || 'openTab';
            }
          }
          if (query && primaryHighlightIndex < 0 && allSuggestions.length > 0) {
            primaryHighlightIndex = 0;
            primaryHighlightReason = 'default';
          }
          if (primaryHighlightIndex >= 0) {
            primarySuggestion = allSuggestions[primaryHighlightIndex] || null;
            mergedProvider = findProviderForSuggestionMatch(primarySuggestion, providersForTags);
          }
          if (onlyKeywordSuggestions) {
            clearAutocomplete();
          } else {
            applyAutocomplete(allSuggestions, primarySuggestion, primaryHighlightReason);
          }
          const inlineAutoHighlight = Boolean(inlineSuggestion && primaryHighlightIndex === 0);
          inlineSearchState = inlineSuggestion
            ? {
                url: inlineSuggestion.url,
                provider: inlineSuggestion.provider,
                query: inlineSuggestion.searchQuery || '',
                rawInput: rawTagInputForInline,
                isAuto: inlineAutoHighlight
              }
            : null;
          const resolvedProvider = siteSearchTrigger;
          const resolvedLocalScope = !resolvedProvider
            ? getLocalSearchScopeCandidate(rawTagInputForInline, rules)
            : null;
          siteSearchTriggerState = resolvedProvider
            ? { provider: resolvedProvider, rawInput: rawTagInputForInline }
            : null;
          localSearchScopeTriggerState = resolvedLocalScope
            ? { scope: resolvedLocalScope, rawInput: rawTagInputForInline }
            : null;
          if (siteSearchTriggerState) {
            setSiteSearchTabHint(resolvedProvider);
          } else if (localSearchScopeTriggerState) {
            setSiteSearchTabHint(getLocalSearchScopeTabHintProvider(resolvedLocalScope));
          } else {
            clearSiteSearchTabHint();
          }
        } else if (localSearchQueryModeActive) {
          clearAutocomplete();
          inlineSearchState = null;
          siteSearchTriggerState = null;
          localSearchScopeTriggerState = null;
          clearSiteSearchTabHint();
          if (allSuggestions.length > 0) {
            primaryHighlightIndex = 0;
            primaryHighlightReason = 'localScope';
            primarySuggestion = allSuggestions[0];
          }
        } else if (modeCommandActive) {
          clearAutocomplete();
          inlineSearchState = null;
          siteSearchTriggerState = null;
          localSearchScopeTriggerState = null;
          clearSiteSearchTabHint();
          primaryHighlightIndex = 0;
          primaryHighlightReason = 'modeSwitch';
        } else if (slashCommandModeActive) {
          clearAutocomplete();
          inlineSearchState = null;
          siteSearchTriggerState = null;
          localSearchScopeTriggerState = null;
          clearSiteSearchTabHint();
          primaryHighlightIndex = 0;
          primaryHighlightReason = 'command';
        }
        if (hasCommand) {
          applyAutocomplete(allSuggestions, primarySuggestion, primaryHighlightReason);
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
          query,
          lastRenderedQuery,
          actionContextKey,
          lastRenderedActionContextKey,
          currentSuggestions,
          allSuggestions
        });
        const shouldAnimateScopeResultEnter = Boolean(
          getSearchPanelsLayoutTransitionMenu() &&
          siteSearchQueryModeActive &&
          updateKind === 'structure' &&
          currentSuggestions.length === 0 &&
          allSuggestions.some((suggestion) => suggestion && suggestion.type === 'siteSearch')
        );
        const canAppend = updateKind === 'append';
        const shouldPreserveVisualState =
          updateKind === 'content' || updateKind === 'append';
        const previousVisualStateByIdentity = shouldPreserveVisualState
          ? captureSuggestionVisualStateByIdentity(currentSuggestions, suggestionItems)
          : new Map();
        const previousScrollTop = shouldPreserveVisualState
          ? Math.max(0, Number(suggestionsContainer.scrollTop) || 0)
          : 0;
        const startIndex = canAppend ? currentSuggestions.length : 0;
        pauseOverlayAntiTranslateObserverForMutationBurst();
        setOpenTabsResultsViewport(false);
        const reactView = ensureOverlaySuggestionsView();
        currentSuggestions = allSuggestions;
        lastRenderedQuery = query;
        lastRenderedActionContextKey = actionContextKey;
        if (updateKind !== 'highlight') {
          warmIconCache(allSuggestions.filter((item) => (
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
          emptyMessage
        });
        // Reveal only after the target rows render, then adopt their natural
        // height directly in the same commit.
        setOverlayResultsCollapsed(false, {
          deferLayoutSync: true
        });
        if (shouldAnimateScopeResultEnter) {
          suggestionsContainer.setAttribute('data-scope-result-enter', 'run');
        } else {
          suggestionsContainer.removeAttribute('data-scope-result-enter');
        }
        if (updateKind !== 'highlight') {
          if (shouldPreserveVisualState) {
            suggestionsContainer.scrollTop = previousScrollTop;
          }
          syncSuggestionLastState();
          updateSelection();
        }
        commitSuggestionsNaturalHeightAfterRender();
        if (updateKind === 'structure') {
          selectedIndex = -1;
        }
      });
    }
    function clearSearchSuggestions() {
      cancelPendingOverlaySuggestionRequests();
      inlineSearchState = null;
      siteSearchTriggerState = null;
      localSearchScopeTriggerState = null;
      clearSiteSearchTabHint();
      lastSuggestionResponse = [];
      if (shouldShowOpenTabsForEmptyQuery()) {
        requestTabsAndRender();
        return;
      }
      clearDefaultOpenTabsSuggestions();
    }

    overlay.appendChild(inputContainer);
    overlay.appendChild(suggestionsContainer);
    if (!shouldShowOpenTabsForEmptyQuery()) {
      clearDefaultOpenTabsSuggestions();
    }
    applyNoTranslateDeep(overlay);
    applyOverlayThemeVariables(overlay, overlayThemeMode);
    // Reader extensions such as SimpRead can hide the original body and mount
    // their reading surface directly under <html>. Keep the overlay out of a
    // potentially hidden body while preserving fullscreen containment.
    const overlayMountParent = document.fullscreenElement ||
      document.documentElement ||
      document.body;
    overlayMountParent.appendChild(overlayHost);
    window._x_extension_search_overlay_open_2026_unique_ = true;
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
        window._x_extension_search_overlay_open_2026_unique_ = true;
        if (typeof restoredHost.showPopover === 'function') {
          try {
            restoredHost.showPopover();
          } catch (error) {
            restoredHost.removeAttribute('popover');
          }
        }
        overlayViewportSizeSync.apply(overlay);
        const restoreFocus = () => {
          if (restoredHost.isConnected &&
              window._x_extension_search_overlay_open_2026_unique_ === true) {
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
    overlayHost._lumnoMountConnectionGuard = mountConnectionGuard;
    mountConnectionGuard.start(overlayHost);
    startOverlayViewportSizeSync(overlay);
    startOverlayUpdateNoticeFrameSync(overlay);
    startOverlayAntiTranslateObserver(overlay);

    function scheduleOverlayUpdateNoticeMount(delayMs) {
      clearOverlayUpdateNoticeMountTimer();
      overlayUpdateNoticeMountTimer = setTimeout(() => {
        overlayUpdateNoticeMountTimer = null;
        if (!overlay || !overlay.isConnected) {
          return;
        }
        mountOverlayUpdateNotice();
      }, Math.max(0, Number(delayMs) || 0));
    }

    function focusOverlayInputForReveal() {
      if (!searchInput || !searchInput.isConnected ||
          typeof searchInput.focus !== 'function') {
        return;
      }
      if (initialLoadingSession && initialLoadingSession.focused === false) {
        return;
      }
      searchInput.focus({ preventScroll: true });
    }

    const initialOverlayContentReady = Promise.all([
      initialOverlayOpenTabsDefaultVisibleReady,
      initialFaviconEnhancedFetchReady,
      initialSimpleModeReady
    ]).then(() => initialSearchResultDisplayLimitReady).then(() => {
      if (!overlay || !overlay.isConnected) {
        return false;
      }
      if (initialLoadingSession || initialPrefillQuery) {
        const initialInputValue = initialLoadingSession
          ? initialLoadingSession.inputValue
          : initialPrefillQuery;
        searchInput.value = initialInputValue;
        if (typeof searchInput.setSelectionRange === 'function') {
          const selectionStart = initialLoadingSession
            ? initialLoadingSession.selectionStart
            : initialInputValue.length;
          const selectionEnd = initialLoadingSession
            ? initialLoadingSession.selectionEnd
            : initialInputValue.length;
          const selectionDirection = initialLoadingSession
            ? initialLoadingSession.selectionDirection
            : 'none';
          searchInput.setSelectionRange(
            selectionStart,
            selectionEnd,
            selectionDirection
          );
        }
        latestRawInputValue = initialInputValue;
        latestOverlayQuery = initialInputValue.trim();
        updateModeBadge(initialInputValue);
        suppressOverlayLoadingSessionNotification = true;
        try {
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        } finally {
          suppressOverlayLoadingSessionNotification = false;
        }
        return true;
      }
      return initialLanguageReady.catch(() => {}).then(() => {
        requestTabsAndRender();
        return true;
      });
    }).catch(() => false);

    const revealOverlay = (options) => {
      if (!overlay || !overlay.isConnected) {
        return;
      }
      const revealOptions = options && typeof options === 'object' ? options : {};
      setOverlayMountVisibility(overlayHost, false);
      if (overlayRevealGate && typeof overlayRevealGate.release === 'function') {
        overlayRevealGate.release();
      }
      // The style gate has just released the result surface, so take one last
      // measurement before it can become visible on a slow stylesheet load.
      syncOpenTabsScrollbarGutter();
      // Focusing before the two animation frames lets typing begin as soon as
      // the command bar is visually released, instead of after the entry
      // motion has already started.
      focusOverlayInputForReveal();
      const reduceMotion = revealOptions.forceInstant === true ||
        shouldSkipOverlayEntryMotion();
      const revealTransform = getOverlayEnterAnimationRevealTransform();
      if (reduceMotion) {
        overlay.style.setProperty('transition', 'none', 'important');
        overlay.style.setProperty('opacity', '1', 'important');
        overlay.style.setProperty('transform', revealTransform, 'important');
        finishOverlayPanelEnterAnimation(overlay);
        scheduleOverlayUpdateNoticeMount(0);
      } else {
        clearOverlayEnterAnimationFrames();
        overlayFrameTracker.runEnterAnimation(overlay, () => {
          playOverlayPanelEnterAnimation(overlay, revealTransform);
          scheduleOverlayUpdateNoticeMount(360);
        });
      }
    };
    const revealReady = overlayRevealGate && typeof overlayRevealGate.waitUntilReady === 'function'
      ? overlayRevealGate.waitUntilReady()
      : Promise.resolve({ ok: true, reason: 'no-site-fix' });
    Promise.all([
      Promise.resolve(revealReady).catch(() => null),
      initialOverlayThemeReady,
      initialOverlaySizeReady,
      initialOverlayEnterAnimationReady.catch(() => {
        overlayEnterAnimation = 'elastic';
      }),
      initialMotionEffectsReady.catch(() => {
        motionEffectsEnabled = true;
      }),
      initialSimpleModeReady.catch(() => {
        simpleModeEnabled = false;
      }),
      initialNumberShortcutInstantReady.catch(() => {
        numberShortcutInstantEnabled = false;
      }),
      initialMacosCtrlSuggestionNavigationReady.catch(() => {
        macosCtrlSuggestionNavigationEnabled = false;
      })
    ]).then((readyStates) => {
      if (!overlay || !overlay.isConnected) {
        return;
      }
      applyOverlayEnterAnimationInitialState(overlay);
      const styleGateResult = readyStates[0];
      revealOverlay({
        // A late stylesheet uses the shell's stable fallback. Starting a
        // spring while that fallback is about to upgrade only makes slow
        // devices look more broken, so reveal its final state instead.
        forceInstant: !styleGateResult || styleGateResult.ok !== true ||
          shouldSkipOverlayEntryMotionForSlowStartup()
      });
    });
    overlayScrollPauseHandler = () => {
      pauseOverlayAntiTranslateObserverForScroll();
    };
    window.addEventListener('scroll', overlayScrollPauseHandler, true);
    window.addEventListener('wheel', overlayScrollPauseHandler, { passive: true, capture: true });
    window.addEventListener('touchmove', overlayScrollPauseHandler, { passive: true, capture: true });
  }
};
