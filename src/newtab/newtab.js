(function() {
  const root = document.getElementById('_x_extension_newtab_root_2024_unique_');
  const createSearchInput = window._x_extension_createSearchInput_2024_unique_;
  if (!root || typeof createSearchInput !== 'function') {
    return;
  }
  if (document.body) {
    document.body.removeAttribute('data-nt-ready');
  }
  const newtabStartupProfiler = globalThis.__lumnoCodexDebugStartupProfilerV1 || null;
  function markNewtabStartupMilestone(name) {
    if (newtabStartupProfiler &&
        typeof newtabStartupProfiler.markMilestone === 'function') {
      newtabStartupProfiler.markMilestone(name);
    }
  }
  function observeNewtabStartupTask(name, task) {
    if (newtabStartupProfiler &&
        typeof newtabStartupProfiler.observeTask === 'function') {
      newtabStartupProfiler.observeTask(name, task);
    }
    return task;
  }
  markNewtabStartupMilestone('script-start');

  const settingsRuntimeApi = globalThis.LumnoSettings;
  const providerStorageRuntime = settingsRuntimeApi.createProviderStorageRuntime(chrome);
  const rawStorageArea = providerStorageRuntime
    ? providerStorageRuntime.area
    : ((chrome && chrome.storage && chrome.storage.sync)
        ? chrome.storage.sync
        : (chrome && chrome.storage ? chrome.storage.local : null));
  // The next New Tab prefetches these keys before its scripts load (newtab-storage-prefetch.js).
  function rememberStartupStorageKeys(keys) {
    if (!Array.isArray(keys) || !keys.length) {
      return;
    }
    try {
      const value = JSON.stringify(keys.slice().sort());
      const cacheKey = settingsRuntimeApi.NEWTAB_STARTUP_STORAGE_KEYS_CACHE_KEY;
      if (window.localStorage.getItem(cacheKey) !== value) {
        window.localStorage.setItem(cacheKey, value);
      }
    } catch (_error) {
      // localStorage is only a fast path; the next load reads storage as before.
    }
  }
  const startupStorageReadBatch = rawStorageArea
    ? settingsRuntimeApi.createStorageReadBatch(rawStorageArea)
    : null;
  const storageArea = startupStorageReadBatch
    ? startupStorageReadBatch.area
    : rawStorageArea;
  if (startupStorageReadBatch) {
    startupStorageReadBatch.ready.then((metrics) => {
      rememberStartupStorageKeys(metrics && metrics.keys);
      if (!document.documentElement) {
        return;
      }
      document.documentElement.setAttribute(
        'data-lumno-newtab-bootstrap-storage-reads',
        String(Number(metrics && metrics.underlyingReadCount) || 0)
      );
      document.documentElement.setAttribute(
        'data-lumno-newtab-bootstrap-storage-requests',
        String(Number(metrics && metrics.requestCount) || 0)
      );
      document.documentElement.setAttribute(
        'data-lumno-newtab-bootstrap-storage-keys',
        metrics && metrics.keyCount === null
          ? 'all'
          : String(Number(metrics && metrics.keyCount) || 0)
      );
    });
  }
  // The first recent-sites pass waits for every layout preference, so the browser reads start now
  // and that pass takes them; later passes, or one long after load, read afresh.
  const STARTUP_RECENT_SOURCE_MAX_AGE_MS = 3000;
  const startupRecentSourceReadsAt = Date.now();
  const startupRecentSourceReads = {
    historyItems: readRecentHistoryItems(),
    topSites: readRecentTopSites(),
    tabs: readRecentOpenTabs()
  };

  const localStorageArea = (chrome && chrome.storage && chrome.storage.local)
    ? chrome.storage.local
    : storageArea;
  const bookmarkTopbarSurfaceStorageArea =
    (chrome && chrome.storage && chrome.storage.local)
      ? chrome.storage.local
      : null;
  const recentSitesStorageArea = storageArea || localStorageArea;
  const storageAreaName = providerStorageRuntime ? providerStorageRuntime.name : (rawStorageArea
    ? (rawStorageArea === (chrome && chrome.storage ? chrome.storage.sync : null) ? 'sync' : 'local')
    : null);
  const recentSitesStorageAreaName = storageAreaName || (recentSitesStorageArea ? 'local' : null);
  function isPrimaryStorageAreaName(areaName) {
    return providerStorageRuntime
      ? providerStorageRuntime.isActiveAreaName(areaName)
      : Boolean(storageAreaName) && areaName === storageAreaName;
  }
  function addStorageChangeListener(listener) {
    return SETTINGS.addStorageChangeListener(chrome, listener);
  }
  function getExtensionResourceUrl(resourcePath) {
    const normalizedPath = String(resourcePath || '').replace(/^\/+/, '');
    if (chrome && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
      return chrome.runtime.getURL(normalizedPath);
    }
    const baseUrl = document.baseURI || window.location.href;
    return new URL(`../../${normalizedPath}`, baseUrl).href;
  }
  function sendRuntimeMessage(message, callback) {
    if (typeof chrome === 'undefined' ||
        !chrome.runtime ||
        typeof chrome.runtime.sendMessage !== 'function') {
      return false;
    }
    try {
      chrome.runtime.sendMessage(message, callback);
      return true;
    } catch (_error) {
      return false;
    }
  }
  function getNewtabVisualViewportInsets() {
    const visualViewport = window.visualViewport;
    if (!visualViewport) {
      return { top: 0, bottom: 0 };
    }
    const top = Number.isFinite(Number(visualViewport.offsetTop))
      ? Math.max(0, Number(visualViewport.offsetTop))
      : 0;
    const viewportHeight = Number.isFinite(Number(visualViewport.height))
      ? Math.max(0, Number(visualViewport.height))
      : Math.max(0, Number(window.innerHeight) || 0);
    const layoutHeight = Math.max(0, Number(window.innerHeight) || viewportHeight);
    const bottom = Math.max(0, layoutHeight - top - viewportHeight);
    return { top, bottom };
  }
  function syncNewtabVisualViewportInsets() {
    if (!document.documentElement || !document.documentElement.style) {
      return;
    }
    const insets = getNewtabVisualViewportInsets();
    document.documentElement.style.setProperty(
      '--x-nt-visual-viewport-top-inset',
      `${Math.round(insets.top)}px`
    );
    document.documentElement.style.setProperty(
      '--x-nt-visual-viewport-bottom-inset',
      `${Math.round(insets.bottom)}px`
    );
  }
  syncNewtabVisualViewportInsets();
  window.addEventListener('resize', syncNewtabVisualViewportInsets, { passive: true });
  if (window.visualViewport &&
      typeof window.visualViewport.addEventListener === 'function') {
    window.visualViewport.addEventListener(
      'resize',
      syncNewtabVisualViewportInsets,
      { passive: true }
    );
    window.visualViewport.addEventListener(
      'scroll',
      syncNewtabVisualViewportInsets,
      { passive: true }
    );
  }

  const SETTINGS = settingsRuntimeApi;
  const BROWSER_PROFILE = globalThis.LumnoBrowserProfile;
  const SHORTCUT_KEY_MATCHER = globalThis.LumnoShortcutKeyMatcher;
  const THEME_STORAGE_KEY = '_x_extension_theme_mode_2024_unique_';
  const LANGUAGE_STORAGE_KEY = '_x_extension_language_2024_unique_';
  const RECENT_MODE_STORAGE_KEY = '_x_extension_recent_mode_2024_unique_';
  const RECENT_COUNT_STORAGE_KEY = '_x_extension_recent_count_2024_unique_';
  const NEWTAB_WIDTH_MODE_STORAGE_KEY = '_x_extension_newtab_width_mode_2026_unique_';
  const NEWTAB_SEARCH_WIDTH_STORAGE_KEY = '_x_extension_newtab_search_width_2026_unique_';
  const NEWTAB_INPUT_AUTO_FOCUS_ENABLED_STORAGE_KEY = SETTINGS.NEWTAB_INPUT_AUTO_FOCUS_ENABLED_STORAGE_KEY ||
    '_x_extension_newtab_input_auto_focus_enabled_2026_unique_';
  const NEWTAB_QUOTE_PREFS_STORAGE_KEY = SETTINGS.NEWTAB_QUOTE_PREFS_STORAGE_KEY ||
    '_x_extension_newtab_quote_prefs_2026_unique_';
  const NEWTAB_FEEDBACK_BUTTON_VISIBLE_STORAGE_KEY = SETTINGS.NEWTAB_FEEDBACK_BUTTON_VISIBLE_STORAGE_KEY ||
    '_x_extension_newtab_feedback_button_visible_2026_unique_';
  const NEWTAB_APPEARANCE_BUTTON_VISIBLE_STORAGE_KEY = SETTINGS.NEWTAB_APPEARANCE_BUTTON_VISIBLE_STORAGE_KEY ||
    '_x_extension_newtab_appearance_button_visible_2026_unique_';
  const NUMBER_SHORTCUT_INSTANT_ENABLED_STORAGE_KEY = SETTINGS.NUMBER_SHORTCUT_INSTANT_ENABLED_STORAGE_KEY ||
    '_x_extension_number_shortcut_instant_enabled_2026_unique_';
  const MACOS_CTRL_SUGGESTION_NAVIGATION_ENABLED_STORAGE_KEY =
    SETTINGS.MACOS_CTRL_SUGGESTION_NAVIGATION_ENABLED_STORAGE_KEY ||
    '_x_extension_macos_ctrl_suggestion_navigation_enabled_2026_unique_';
  const SIMPLE_MODE_ENABLED_STORAGE_KEY = SETTINGS.SIMPLE_MODE_ENABLED_STORAGE_KEY ||
    '_x_extension_simple_mode_enabled_2026_unique_';
  const NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY = SETTINGS.NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY ||
    '_x_extension_newtab_wordmark_visible_2026_unique_';
  const NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY =
    SETTINGS.NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY ||
    '_x_extension_newtab_time_font_weight_2026_unique_';
  const NEWTAB_TIME_FONT_WEIGHT_DEFAULT = Number(SETTINGS.NEWTAB_TIME_FONT_WEIGHT_DEFAULT) || 320;
  const NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY =
    SETTINGS.NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY ||
    '_x_extension_newtab_time_seconds_visible_2026_unique_';
  const NEWTAB_ZEN_MODE_STORAGE_KEY = '_x_extension_newtab_zen_mode_2026_unique_';
  const NEWTAB_THEME_MODE_STORAGE_KEY = '_x_extension_newtab_theme_mode_2026_unique_';
  const NEWTAB_THEME_SCOPE_STORAGE_KEY = '_x_extension_newtab_theme_scope_2026_unique_';
  const NEWTAB_WALLPAPER_STORAGE_KEY = '_x_extension_newtab_wallpaper_2026_unique_';
  const NEWTAB_LOCAL_WALLPAPER_STORAGE_KEY = '_x_extension_newtab_local_wallpaper_2026_unique_';
  const NEWTAB_WALLPAPER_OVERLAY_STORAGE_KEY = '_x_extension_newtab_wallpaper_overlay_2026_unique_';
  const NEWTAB_WALLPAPER_EFFECT_STORAGE_KEY = '_x_extension_newtab_wallpaper_effect_2026_unique_';
  const NEWTAB_FAVICON_STORAGE_KEY = '_x_extension_newtab_favicon_2026_unique_';
  const BOOKMARK_COUNT_STORAGE_KEY = '_x_extension_bookmark_count_2024_unique_';
  const BOOKMARK_COLUMNS_STORAGE_KEY = '_x_extension_bookmark_columns_2024_unique_';
  const BOOKMARK_VIEW_MODE_STORAGE_KEY = '_x_extension_bookmark_view_mode_2026_unique_';
  const BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY = '_x_extension_bookmark_folder_icons_visible_2026_unique_';
  const BOOKMARK_CASCADE_DEBUG_STORAGE_KEY = '_x_extension_bookmark_cascade_debug_2026_unique_';
  const BOOKMARK_TOPBAR_PICK_COLOR_ACTION = 'pick-bookmark-topbar-color';
  const BOOKMARK_TOPBAR_SURFACE_MODE_ACTION = 'set-bookmark-topbar-surface-mode';
  // Flip this to true when inspecting bookmark cascade hover intent and safe-triangle timing.
  const BOOKMARK_CASCADE_DEBUG_UI_ENABLED = false;
  const DEFAULT_SEARCH_ENGINE_STORAGE_KEY = '_x_extension_default_search_engine_2024_unique_';
  const SEARCH_RESULT_PRIORITY_STORAGE_KEY = '_x_extension_search_result_priority_2026_unique_';
  const OVERLAY_TAB_PRIORITY_STORAGE_KEY = '_x_extension_overlay_tab_priority_2024_unique_';
  const SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY = '_x_extension_search_result_source_types_2026_unique_';
  const SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY = SETTINGS.SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY ||
    '_x_extension_search_result_display_limit_2026_unique_';
  const SEARCH_BLACKLIST_STORAGE_KEY = '_x_extension_search_blacklist_2026_unique_';
  const FAVICON_REQUEST_BLACKLIST_STORAGE_KEY = '_x_extension_favicon_request_blacklist_2026_unique_';
  const FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY = '_x_extension_favicon_enhanced_fetch_enabled_2026_unique_';
  const BLACKLIST_UTILS = globalThis.LumnoBlacklistUtils;
  const EXTENSION_ROUTES = globalThis.LumnoExtensionRoutes;
  const NAVIGATION_DISPOSITION = globalThis.LumnoNavigationDisposition;
  const SEARCH_UTILS = globalThis.LumnoSearchUtils;
  const AGGREGATE_SEARCH_STORE = globalThis.LumnoAggregateSearchStore;
  const AGGREGATE_SEARCH_SURFACE = globalThis.LumnoAggregateSearchSurface;
  const SITE_DISPLAY_NAME = globalThis.LumnoSiteDisplayName;
  const SITE_SEARCH_STORE = globalThis.LumnoSiteSearchStore;
  const SUGGESTION_ACTION_MODEL = globalThis.LumnoSuggestionActionModel;
  const SUGGESTION_NAVIGATION = globalThis.LumnoSuggestionNavigation;
  const SEARCH_INPUT_HISTORY = globalThis.LumnoSearchInputHistory;
  const SEARCH_INPUT_MODE = globalThis.LumnoSearchInputMode;
  const FEATURE_HINTS = globalThis.LumnoFeatureHints;
  const UPDATE_NOTICE = globalThis.LumnoUpdateNotice;
  const ENGAGEMENT_NOTICE = globalThis.LumnoEngagementNotice;
  const COMMUNITY_LINKS = globalThis.LumnoCommunityLinks;
  const LUMNO_FEEDBACK_LINKS_FALLBACK = COMMUNITY_LINKS.FALLBACK_LINKS;
  const FAVICON_UTILS = globalThis.LumnoFaviconUtils;
  const NEWTAB_FAVICON_CACHE = globalThis.LumnoFaviconCache;
  const SHORTCUT_FAVICON = globalThis.LumnoShortcutFavicon;
  const NEWTAB_FAVICON_THEME = globalThis.LumnoNewtabFaviconTheme;
  const NEWTAB_FAVICON_VIEW = globalThis.LumnoNewtabFaviconView;
  const NEWTAB_RECENT_STORE = globalThis.LumnoNewtabRecentSitesStore;
  const NEWTAB_BOOKMARKS_STORE = globalThis.LumnoNewtabBookmarksStore;
  const NEWTAB_BOOKMARKS_RUNTIME = globalThis.LumnoNewtabBookmarksRuntime;
  const NEWTAB_BOOKMARKS_TOPBAR = globalThis.LumnoNewtabBookmarksTopbar;
  const BOOKMARK_TOPBAR_HEIGHT_PX = Math.max(
    0,
    Number(NEWTAB_BOOKMARKS_TOPBAR.HEIGHT_PX) || 36
  );
  const NEWTAB_BOOKMARK_MOVE_HISTORY = globalThis.LumnoNewtabBookmarkMoveHistory;
  const NEWTAB_BOOKMARK_DRAG = globalThis.LumnoNewtabBookmarkDrag;
  const NEWTAB_CROSS_SURFACE_DRAG = globalThis.LumnoNewtabCrossSurfaceDrag;
  const NEWTAB_BOOKMARK_FOLDER_ICON = globalThis.LumnoNewtabBookmarkFolderIcon;
  const NEWTAB_PAGE_NOTICE = globalThis.LumnoNewtabPageNotice;
  const NEWTAB_TOAST = globalThis.LumnoNewtabToast;
  const NEWTAB_LAYOUT = globalThis.LumnoNewtabLayout;
  const NEWTAB_DOCK = globalThis.LumnoNewtabDock;
  const NEWTAB_DIRECT_NAVIGATION_SETTLE = globalThis.LumnoNewtabDirectNavigationSettle;
  const NEWTAB_BACKGROUND_SEARCH_FOCUS = globalThis.LumnoNewtabBackgroundSearchFocus;
  const NEWTAB_RECENT_VIEW = globalThis.LumnoNewtabRecentSitesView;
  const NEWTAB_BOOKMARKS_VIEW = globalThis.LumnoNewtabBookmarksView;
  const NEWTAB_BOOKMARK_CASCADE_POSITION = globalThis.LumnoNewtabBookmarkCascadePosition;
  const NEWTAB_BOOKMARK_CASCADE_MENU = globalThis.LumnoNewtabBookmarkCascadeMenu;
  const NEWTAB_SUGGESTIONS_VIEW = globalThis.LumnoNewtabSuggestionsView;
  const NEWTAB_SHORTCUTS_STORE = globalThis.LumnoNewtabShortcutsStore;
  const FOLDER_REFERENCES = globalThis.LumnoBookmarkFolderReference;
  const NEWTAB_SHORTCUT_ICON_STORE = globalThis.LumnoNewtabShortcutIconStore;
  const NEWTAB_SHORTCUT_DIALOG = globalThis.LumnoNewtabShortcutDialog;
  const NEWTAB_RECENT_HISTORY_DIALOG = globalThis.LumnoNewtabRecentHistoryDialog;
  const PROGRESS_MATCH = globalThis.LumnoProgressMatch;
  const PROGRESS_HISTORY = globalThis.LumnoProgressHistory;
  const NEWTAB_SHORTCUTS_VIEW = globalThis.LumnoNewtabShortcutsView;
  const NEWTAB_WALLPAPER = globalThis.LumnoNewtabWallpaper;
  const NEWTAB_WALLPAPER_VIEW = globalThis.LumnoNewtabWallpaperView;
  const NEWTAB_FEEDBACK_CONTROL = globalThis.LumnoNewtabFeedbackControl;

  const NEWTAB_FEEDBACK_CONTROL_RUNTIME = globalThis.LumnoNewtabFeedbackControlRuntime;
  const {
    getFeedbackWebLocale,
    openFeedbackExternalUrl,
    updateFeedbackLanguageStrings,
    isFeedbackPopoverOpen,
    closeFeedbackPopover,
    createFeedbackControls
  } = NEWTAB_FEEDBACK_CONTROL_RUNTIME.createFeedbackControlRuntime({
    COMMUNITY_LINKS,
    LUMNO_FEEDBACK_LINKS_FALLBACK,
    getSystemLocale,
    normalizeLocale,
    t,
    openExternalNewTabUrl: (...args) => openExternalNewTabUrl(...args),
    hideTopActionTooltip: (...args) => hideTopActionTooltip(...args),
    NEWTAB_FEEDBACK_CONTROL,
    showTopActionTooltip: (...args) => showTopActionTooltip(...args),
    pageState: {
      get feedbackLinks() {
        return feedbackLinks;
      },
      set feedbackLinks(value) {
        feedbackLinks = value;
      },
      get currentResolvedLocale() {
        return currentResolvedLocale;
      },
      get currentLanguageMode() {
        return currentLanguageMode;
      },
      get feedbackControl() {
        return feedbackControl;
      },
      set feedbackControl(value) {
        feedbackControl = value;
      },
      get feedbackButton() {
        return feedbackButton;
      },
      set feedbackButton(value) {
        feedbackButton = value;
      },
      get feedbackReactController() {
        return feedbackReactController;
      },
      set feedbackReactController(value) {
        feedbackReactController = value;
      }
    }
  });

  const NEWTAB_SELECT_MENU = globalThis.LumnoNewtabSelectMenu;
  const NEWTAB_TOP_CONTENT = globalThis.LumnoNewtabTopContent;
  const NEWTAB_PAGE_STRUCTURE = globalThis.LumnoNewtabPageStructure;
  const NEWTAB_BOOKMARK_CASCADE_VIEW =
    globalThis.LumnoNewtabBookmarkCascadeView;
  const NEWTAB_BOOKMARK_BREADCRUMB =
    globalThis.LumnoNewtabBookmarkBreadcrumb;
  const SITE_DISPLAY_NAME_OPTIONS = Object.freeze({
    getBrandName(brandHost, fallback) {
      if (brandHost === 'mp.weixin.qq.com') {
        return t('site_brand_wechat_official', '微信公众号');
      }
      if (brandHost === 'weibo.com') {
        return t('site_search_name_weibo', '微博');
      }
      return fallback;
    }
  });
  const getFigmaFolderSvg = NEWTAB_BOOKMARK_FOLDER_ICON.getFigmaFolderSvg;
  function initFolderPathMorph(icon) {
    NEWTAB_BOOKMARK_FOLDER_ICON.initFolderPathMorph(icon);
    applySavedFolderColor(icon);
  }
  const playFolderPathMorph = NEWTAB_BOOKMARK_FOLDER_ICON.playFolderPathMorph;
  const setFolderPathMorphState = NEWTAB_BOOKMARK_FOLDER_ICON.setFolderPathMorphState;
  const normalizeHost = NEWTAB_FAVICON_THEME.normalizeHost;
  const bookmarksRuntime = NEWTAB_BOOKMARKS_RUNTIME.createBookmarksRuntime({
    chromeApi: typeof chrome !== 'undefined' ? chrome : null,
    store: NEWTAB_BOOKMARKS_STORE,
    normalizeHost
  });

  const NEWTAB_CONTEXT_MENU_OPEN_VALUE = 'open-in-new-tab';
  const SHORTCUT_CONTEXT_MENU_EDIT_VALUE = 'edit';
  const SHORTCUT_CONTEXT_MENU_REMOVE_VALUE = 'remove';
  const SHORTCUT_CONTEXT_MENU_HIDE_ADD_VALUE = 'hide-add';
  const FOLDER_COLOR_CONTEXT_MENU_VALUE = 'folder-color';
  const BOOKMARK_CONTEXT_MENU_EDIT_VALUE = 'edit';
  const BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE = 'open-in-new-tab-group';

  const NEWTAB_BOOKMARK_CONTEXT_MENU = globalThis.LumnoNewtabBookmarkContextMenu;
  const {
    getBookmarkContextMenuOptions,
    isBookmarkContextMenuNode,
    closeBookmarkContextMenu,
    handleBookmarkItemContextMenu
  } = NEWTAB_BOOKMARK_CONTEXT_MENU.createBookmarkContextMenu({
    bookmarksRuntime,
    NEWTAB_BOOKMARKS_STORE,
    BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE,
    t,
    NEWTAB_CONTEXT_MENU_OPEN_VALUE,
    FOLDER_COLOR_CONTEXT_MENU_VALUE,
    BOOKMARK_CONTEXT_MENU_EDIT_VALUE,
    openFolderColorPicker,
    openExternalNewTabUrl: (...args) => openExternalNewTabUrl(...args),
    openBookmarkEditor,
    openBookmarkFolderTabGroupConfirmation,
    deleteBookmarkFromContextTarget: (...args) => deleteBookmarkFromContextTarget(...args),
    closeShortcutContextMenu: (...args) => closeShortcutContextMenu(...args),
    closeRecentContextMenu: (...args) => closeRecentContextMenu(...args),
    hideCursorTooltip: (...args) => hideCursorTooltip(...args),
    pageState: {
      get bookmarkContextMenu() {
        return bookmarkContextMenu;
      },
      set bookmarkContextMenu(value) {
        bookmarkContextMenu = value;
      },
      get bookmarkContextMenuSelectController() {
        return bookmarkContextMenuSelectController;
      },
      get bookmarkContextMenuTarget() {
        return bookmarkContextMenuTarget;
      },
      set bookmarkContextMenuTarget(value) {
        bookmarkContextMenuTarget = value;
      },
      get bookmarkDragState() {
        return bookmarkDragState;
      }
    }
  });

  const shortcutFolderRuntime = FOLDER_REFERENCES.createRuntime({ chrome });
  shortcutFolderRuntime.ready.catch((error) => {
    console.warn('[Lumno] Could not load shortcut folder bindings.', error);
  });
  const TAB_RANK_SCORE_DEBUG_STORAGE_KEY = '_x_extension_tab_rank_score_debug_2026_unique_';
  const NEWTAB_OPEN_TAB_SUGGESTION_LIMIT = 8;
  const FAVICON_CACHE_BOOT_WAIT_MS = 120;
  const RESTORE_SEARCH_LAYOUT_LOCK_MS = 900;
  const PINNED_RECENT_SITES_STORAGE_KEY = '_x_extension_newtab_pinned_recent_sites_2026_unique_';
  const HIDDEN_RECENT_SITES_STORAGE_KEY = '_x_extension_newtab_hidden_recent_sites_2026_unique_';
  const NEWTAB_SHORTCUTS_STORAGE_KEY = '_x_extension_newtab_shortcuts_2026_unique_';
  const NEWTAB_SHORTCUTS_LOCAL_OVERFLOW_STORAGE_KEY =
    '_x_extension_newtab_shortcuts_local_overflow_2026_unique_';
  const NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY = '_x_extension_newtab_shortcuts_visible_2026_unique_';
  const NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY = '_x_extension_newtab_shortcut_add_visible_2026_unique_';
  const NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY = '_x_extension_newtab_shortcut_dock_magnification_enabled_2026_unique_';
  const NEWTAB_SHORTCUT_WIDTH_STORAGE_KEY = SETTINGS.NEWTAB_SHORTCUT_WIDTH_STORAGE_KEY ||
    '_x_extension_newtab_shortcut_width_2026_unique_';
  const NEWTAB_SHORTCUT_WIDTH_MIN = Number.isFinite(Number(SETTINGS.NEWTAB_SHORTCUT_WIDTH_MIN))
    ? Number(SETTINGS.NEWTAB_SHORTCUT_WIDTH_MIN)
    : 360;
  const NEWTAB_SHORTCUT_WIDTH_MAX = Number.isFinite(Number(SETTINGS.NEWTAB_SHORTCUT_WIDTH_MAX))
    ? Number(SETTINGS.NEWTAB_SHORTCUT_WIDTH_MAX)
    : 1440;
  const NEWTAB_SHORTCUT_WIDTH_DEFAULT = Number.isFinite(Number(SETTINGS.NEWTAB_SHORTCUT_WIDTH_DEFAULT))
    ? Number(SETTINGS.NEWTAB_SHORTCUT_WIDTH_DEFAULT)
    : 920;
  const NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY = SETTINGS.NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY ||
    '_x_extension_newtab_shortcut_columns_2026_unique_';
  const NEWTAB_SHORTCUT_COLUMNS_MIN = Number.isFinite(Number(SETTINGS.NEWTAB_SHORTCUT_COLUMNS_MIN))
    ? Number(SETTINGS.NEWTAB_SHORTCUT_COLUMNS_MIN)
    : 4;
  const NEWTAB_SHORTCUT_COLUMNS_MAX = Number.isFinite(Number(SETTINGS.NEWTAB_SHORTCUT_COLUMNS_MAX))
    ? Number(SETTINGS.NEWTAB_SHORTCUT_COLUMNS_MAX)
    : 16;
  const NEWTAB_SHORTCUT_COLUMNS_DEFAULT = Number.isFinite(
    Number(SETTINGS.NEWTAB_SHORTCUT_COLUMNS_DEFAULT)
  )
    ? Number(SETTINGS.NEWTAB_SHORTCUT_COLUMNS_DEFAULT)
    : 10;
  const NEWTAB_SHORTCUT_SIZE_STORAGE_KEY = SETTINGS.NEWTAB_SHORTCUT_SIZE_STORAGE_KEY ||
    '_x_extension_newtab_shortcut_size_2026_unique_';
  const NEWTAB_SHORTCUT_SIZE_MIN = Number.isFinite(Number(SETTINGS.NEWTAB_SHORTCUT_SIZE_MIN))
    ? Number(SETTINGS.NEWTAB_SHORTCUT_SIZE_MIN)
    : 48;
  const NEWTAB_SHORTCUT_SIZE_MAX = Number.isFinite(Number(SETTINGS.NEWTAB_SHORTCUT_SIZE_MAX))
    ? Number(SETTINGS.NEWTAB_SHORTCUT_SIZE_MAX)
    : 80;
  const NEWTAB_SHORTCUT_SIZE_DEFAULT = Number.isFinite(
    Number(SETTINGS.NEWTAB_SHORTCUT_SIZE_DEFAULT)
  )
    ? Number(SETTINGS.NEWTAB_SHORTCUT_SIZE_DEFAULT)
    : 64;
  const NEWTAB_SHORTCUT_GAP_STORAGE_KEY = SETTINGS.NEWTAB_SHORTCUT_GAP_STORAGE_KEY ||
    '_x_extension_newtab_shortcut_gap_2026_unique_';
  const NEWTAB_SHORTCUT_GAP_MIN = Number.isFinite(Number(SETTINGS.NEWTAB_SHORTCUT_GAP_MIN))
    ? Number(SETTINGS.NEWTAB_SHORTCUT_GAP_MIN)
    : 0;
  const NEWTAB_SHORTCUT_GAP_MAX = Number.isFinite(Number(SETTINGS.NEWTAB_SHORTCUT_GAP_MAX))
    ? Number(SETTINGS.NEWTAB_SHORTCUT_GAP_MAX)
    : 24;
  const NEWTAB_SHORTCUT_GAP_DEFAULT = Number.isFinite(
    Number(SETTINGS.NEWTAB_SHORTCUT_GAP_DEFAULT)
  )
    ? Number(SETTINGS.NEWTAB_SHORTCUT_GAP_DEFAULT)
    : 4;
  const NEWTAB_SHORTCUT_ICONS_STORAGE_KEY =
    NEWTAB_SHORTCUT_ICON_STORE.DEFAULT_STORAGE_KEY ||
    '_x_extension_newtab_shortcut_icons_2026_unique_';
  const NEWTAB_SHORTCUT_FAVICON_CACHE_STORAGE_KEY =
    SHORTCUT_FAVICON.DEFAULT_STORAGE_KEY ||
    '_x_extension_newtab_shortcut_favicon_cache_2026_unique_';
  const SITE_SEARCH_ICON_CACHE_STORAGE_KEY =
    SHORTCUT_FAVICON.SITE_SEARCH_STORAGE_KEY ||
    '_x_extension_site_search_icon_cache_canonical_2026_unique_';
  const siteSearchIconCacheOptions = SHORTCUT_FAVICON.SITE_SEARCH_CACHE_OPTIONS || {
    cacheTtlMs: 1000 * 60 * 60 * 24 * 180,
    cacheMaxEntries: 40,
    maxDataUrlLength: 192 * 1024
  };
  const MAX_PINNED_RECENT_SITES = 3;
  const MAX_NEWTAB_SHORTCUTS = 60;
  const NEWTAB_SHORTCUTS_CRITICAL_SYNC_RESERVE_BYTES = 64 * 1024;
  const NEWTAB_SHORTCUTS_STORAGE_KEYS = NEWTAB_SHORTCUTS_STORE.getShortcutStorageKeys({
    key: NEWTAB_SHORTCUTS_STORAGE_KEY,
    maxShortcuts: MAX_NEWTAB_SHORTCUTS
  });
  const NEWTAB_EXTERNAL_CHANGE_DEBOUNCE_MS = 120;
  const NEWTAB_RESIZE_DENSITY_SETTLE_MS = 140;
  const pageSearchParams = new URLSearchParams(window.location.search || '');
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  let globalThemeMode = 'system';
  let newtabThemeMode = 'global';
  let newtabThemeScope = 'global';
  let currentThemeMode = 'system';
  let initialThemeApplied = false;
  let resolveInitialThemeReady = null;
  const initialThemeReadyPromise = new Promise((resolve) => {
    resolveInitialThemeReady = resolve;
  });

  const NEWTAB_BOOKMARK_DISPLAY_SETTINGS = globalThis.LumnoNewtabBookmarkDisplaySettings;
  const {
    normalizeBookmarkViewMode,
    shouldRepairBookmarkViewModeStorageValue,
    persistBookmarkViewMode,
    loadInitialBookmarkViewMode,
    getEffectiveBookmarkTopbarSurfaceMode,
    syncBookmarkTopbarSurfaceAppearance,
    loadInitialBookmarkTopbarSurfaceMode,
    syncBookmarkTopbarSurfaceColorForTheme,
    loadInitialBookmarkTopbarSurfaceColors,
    handleBookmarkTopbarSurfaceColorStorageChanges,
    handleBookmarkModeMenuAction
  } = NEWTAB_BOOKMARK_DISPLAY_SETTINGS.createBookmarkDisplaySettings({
    storageArea,
    BOOKMARK_VIEW_MODE_STORAGE_KEY,
    applyBookmarkViewMode: (...args) => applyBookmarkViewMode(...args),
    localStorageArea,
    isPrimaryStorageAreaName,
    NEWTAB_BOOKMARKS_TOPBAR,
    bookmarkTopbarSurfaceStorageArea,
    updateBookmarkModeMenu: (...args) => updateBookmarkModeMenu(...args),
    scheduleWallpaperAdaptiveToneUpdate,
    initialThemeReadyPromise,
    showToast,
    t,
    BOOKMARK_TOPBAR_PICK_COLOR_ACTION,
    BOOKMARK_TOPBAR_SURFACE_MODE_ACTION,
    pageState: {
      get resolveInitialBookmarkViewModeReady() {
        return resolveInitialBookmarkViewModeReady;
      },
      set resolveInitialBookmarkViewModeReady(value) {
        resolveInitialBookmarkViewModeReady = value;
      },
      get bookmarkViewModeRevision() {
        return bookmarkViewModeRevision;
      },
      get bookmarkTopbarRuntime() {
        return bookmarkTopbarRuntime;
      }
    }
  });

  let resolveInitialLanguageReady = null;
  const initialLanguageReadyPromise = new Promise((resolve) => {
    resolveInitialLanguageReady = resolve;
  });
  let resolveInitialBookmarkViewModeReady = null;
  const initialBookmarkViewModeReadyPromise = new Promise((resolve) => {
    resolveInitialBookmarkViewModeReady = resolve;
    if (!storageArea) {
      resolve();
    }
  });
  let modeBadge = null;
  let siteSearchTabHint = null;
  let inputModeController = null;
  let inputParts = null;
  const recentCards = [];
  const bookmarkCards = [];
  const bookmarkCardElementCache = new Map();
  const suggestionItems = [];
  let selectedIndex = -1;
  let currentSuggestions = [];
  let lastSuggestionResponse = [];
  let latestQuery = '';
  let latestRawQuery = '';
  let siteSearchTriggerState = null;
  let localSearchScopeTriggerState = null;
  let suggestionsView = null;
  let recentSourceItems = [];
  let pinnedRecentSites = [];
  // Progress tracking (Labs): the switch and the versions tracked cards left.
  let progressTrackingEnabled = false;
  let progressHistoryMap = {};
  let hiddenRecentSites = [];
  let initialPinnedRecentSitesReadyTask = Promise.resolve([]);
  let initialHiddenRecentSitesReadyTask = Promise.resolve([]);
  let searchBlacklistItems = [];
  let currentMessages = null;
  let currentLanguageMode = 'system';
  let currentResolvedLocale = null;
  let defaultPlaceholderText = 'Search or enter URL…';
  let toastElement = null;
  let toastController = null;
  let layoutController = null;
  let faviconViewRuntime = null;
  let searchEntryRestoreLayoutLockUntil = 0;
  let newtabResizeLayoutLocked = false;
  let newtabReadyRequested = false;
  let newtabReadyViewportRevision = 0;
  let resolveNewtabEntryAnimationReady = null;
  const newtabEntryAnimationReadyPromise = new Promise((resolve) => {
    resolveNewtabEntryAnimationReady = resolve;
  });
  let searchEntryLastVisibleViewportWidth = Math.max(0, window.innerWidth || 0);
  let searchEntryLastVisibleViewportHeight = Math.max(0, window.innerHeight || 0);
  let currentRecentMode = 'most';
  let currentRecentCount = 4;
  let currentBookmarkCount = 8;
  let currentBookmarkColumns = 6;
  let currentBookmarkViewMode = 'folder';
  let bookmarkViewModeRevision = 0;
  let bookmarkFolderIconsVisible = true;
  let tabRankScoreDebugEnabled = false;
  let searchLayer = null;
  let topContentContainer = null;
  let topContentController = null;
  let wordmarkImageEl = null;
  let wallpaperControl = null;
  let wallpaperRuntime = null;
  let quoteRuntime = null;
  let feedbackControl = null;
  let feedbackReactController = null;
  let feedbackButton = null;
  let feedbackLinks = LUMNO_FEEDBACK_LINKS_FALLBACK;
  let updateNoticeController = null;
  let engagementNoticeController = null;
  let webdavFeatureHintController = null;
  let pageNoticeController = null;
  let newtabTopContentMode = 'brand';
  let newtabTimeFontWeight = NEWTAB_TIME_FONT_WEIGHT_DEFAULT;
  let newtabTimeSecondsVisible = false;
  let newtabInputAutoFocusEnabled = false;
  let newtabFeedbackButtonVisible = true;
  let newtabAppearanceButtonVisible = true;
  let numberShortcutInstantEnabled = false;
  let macosCtrlSuggestionNavigationEnabled = false;
  let simpleModeEnabled = false;
  let zenModeEnabled = false;
  let bookmarkCurrentPage = 0;
  let bookmarkAllItems = [];
  let bookmarkCurrentFolderId = '1';
  let bookmarkRootFolderId = '1';
  let bookmarkFolderPath = [];
  let bookmarkRootTotalCount = 0;
  let bookmarkRootVisibleCount = 0;
  let bookmarkTitleWrap = null;
  let bookmarkHeading = null;
  let bookmarkModeMenu = null;
  let bookmarkGrid = null;
  let bookmarkCascadeRuntime = null;
  let bookmarkTopbarRuntime = null;
  let recentHeader = null;
  let recentHeading = null;
  let recentModeMenu = null;
  let recentGrid = null;
  let bookmarkBreadcrumb = null;
  let bookmarkBreadcrumbController = null;
  let bookmarkPagerPrevButton = null;
  let bookmarkPagerNextButton = null;
  let bookmarkOpenManagerButton = null;
  let bookmarkPageAnimating = false;
  let bookmarkDragState = null;
  const bookmarkMoveHistory = NEWTAB_BOOKMARK_MOVE_HISTORY.createBookmarkMoveHistory({ maxEntries: 30 });
  let bookmarkMoveHistoryBusy = false;
  let bookmarkContextMenu = null;
  let bookmarkContextMenuTarget = null;
  let recentContextMenu = null;
  let recentContextMenuTarget = null;
  let bookmarkWheelLastAt = 0;
  let recentMouseInsideSection = false;
  let recentMouseLeftAt = 0;
  let recentSitesView = null;
  let bookmarksView = null;
  let shortcutSection = null;
  let shortcutGrid = null;
  let addShortcutButton = null;
  let shortcutDialogController = null;
  let recentHistoryDialogController = null;
  let recentHistoryDialogLoadPromise = null;
  let shortcutDialogLoadPromise = null;
  let shortcutDialogOpenRevision = 0;
  let shortcutContextMenu = null;
  let shortcutContextMenuTarget = null;
  let newtabShortcuts = [];
  let newtabShortcutIcons = {};
  let newtabShortcutFavicons = {};
  let newtabShortcutsVisible = true;
  let newtabShortcutAddVisible = true;
  let newtabShortcutDockMagnificationEnabled = true;
  let newtabShortcutColumns = NEWTAB_SHORTCUT_COLUMNS_DEFAULT;
  let newtabShortcutSize = NEWTAB_SHORTCUT_SIZE_DEFAULT;
  let newtabShortcutGap = NEWTAB_SHORTCUT_GAP_DEFAULT;
  let shortcutPersistenceInFlightCount = 0;

  const NEWTAB_SHORTCUT_CONTEXT_MENU = globalThis.LumnoNewtabShortcutContextMenu;
  const {
    isShortcutContextMenuOpen,
    isShortcutContextMenuNode,
    clearShortcutContextMenuTileActive,
    applyShortcutContextMenuDockHover,
    closeShortcutContextMenu,
    handleShortcutContextMenu,
    openShortcutAddContextMenu
  } = NEWTAB_SHORTCUT_CONTEXT_MENU.createShortcutContextMenu({
    getShortcutDockIcon: (...args) => getShortcutDockIcon(...args),
    setShortcutDockHover: (...args) => setShortcutDockHover(...args),
    resetShortcutDockHover: (...args) => resetShortcutDockHover(...args),
    getShortcutTileFromNode,
    getShortcutById,
    SHORTCUT_CONTEXT_MENU_HIDE_ADD_VALUE,
    hideShortcutAddFromContextMenu: (...args) => hideShortcutAddFromContextMenu(...args),
    FOLDER_COLOR_CONTEXT_MENU_VALUE,
    openFolderColorPicker,
    getShortcutFolderId: (...args) => getShortcutFolderId(...args),
    SHORTCUT_CONTEXT_MENU_EDIT_VALUE,
    openShortcutEditor,
    NEWTAB_CONTEXT_MENU_OPEN_VALUE,
    openShortcutUrl: (...args) => openShortcutUrl(...args),
    openExternalNewTabUrl: (...args) => openExternalNewTabUrl(...args),
    SHORTCUT_CONTEXT_MENU_REMOVE_VALUE,
    removeShortcutById: (...args) => removeShortcutById(...args),
    t,
    getShortcutContextMenuOptions,
    closeRecentContextMenu: (...args) => closeRecentContextMenu(...args),
    hideShortcutTooltip: (...args) => hideShortcutTooltip(...args),
    getShortcutTileId,
    pageState: {
      get shortcutContextMenu() {
        return shortcutContextMenu;
      },
      set shortcutContextMenu(value) {
        shortcutContextMenu = value;
      },
      get shortcutContextMenuSelectController() {
        return shortcutContextMenuSelectController;
      },
      get shortcutGrid() {
        return shortcutGrid;
      },
      get shortcutContextMenuTarget() {
        return shortcutContextMenuTarget;
      },
      set shortcutContextMenuTarget(value) {
        shortcutContextMenuTarget = value;
      },
      get shortcutSection() {
        return shortcutSection;
      },
      get addShortcutButton() {
        return addShortcutButton;
      }
    }
  });

  const NEWTAB_SHORTCUT_DOCK = globalThis.LumnoNewtabShortcutDock;
  const {
    getShortcutDockIcon,
    applyNewtabShortcutDockMagnification,
    resetShortcutDockHover,
    setShortcutDockHover,
    handleShortcutDockPointerOver,
    handleShortcutDockPointerMove
  } = NEWTAB_SHORTCUT_DOCK.createShortcutDock({
    isShortcutDragActive: (...args) => isShortcutDragActive(...args),
    isBookmarkDragActive: (...args) => isBookmarkDragActive(...args),
    isShortcutContextMenuOpen,
    applyShortcutContextMenuDockHover,
    clearShortcutContextMenuTileActive,
    getShortcutTileFromNode,
    pageState: {
      get shortcutGrid() {
        return shortcutGrid;
      },
      get newtabShortcutDockMagnificationEnabled() {
        return newtabShortcutDockMagnificationEnabled;
      },
      get shortcutDockPendingPointerX() {
        return shortcutDockPendingPointerX;
      },
      set shortcutDockPendingPointerX(value) {
        shortcutDockPendingPointerX = value;
      },
      get shortcutContextMenuTarget() {
        return shortcutContextMenuTarget;
      }
    }
  });

  let shortcutDockPendingPointerX = Number.NaN;
  let shortcutDragState = null;
  const shortcutTiles = [];
  const SHORTCUT_DIALOG_MODE_EDIT = NEWTAB_SHORTCUT_DIALOG.MODE_EDIT || 'edit';
  const SHORTCUT_DIALOG_ITEM_BOOKMARK = 'bookmark';
  const SHORTCUT_DIALOG_ITEM_FOLDER = 'folder';
  const folderColorApi = globalThis.LumnoNewtabFolderColorPicker;
  const LEGACY_FOLDER_COLORS_STORAGE_KEY = NEWTAB_BOOKMARK_FOLDER_ICON.FOLDER_COLORS_STORAGE_KEY;
  const FOLDER_COLOR_REFS_STORAGE_KEY = NEWTAB_BOOKMARK_FOLDER_ICON.FOLDER_COLOR_REFS_STORAGE_KEY;
  const FOLDER_COLOR_PRESETS_STORAGE_KEY = SETTINGS.BOOKMARK_FOLDER_COLOR_PRESETS_STORAGE_KEY ||
    '_x_extension_bookmark_folder_color_presets_2026_unique_';
  // Synced colors keyed by folder path, and the colors they resolve to for
  // this device's bookmark ids.
  let folderColorRefs = {};
  let folderColors = {};

  const defaultSiteSearchProviders = SEARCH_UTILS.getDefaultSiteSearchProviders();

  const SITE_SEARCH_STORAGE_KEY = '_x_extension_site_search_custom_2024_unique_';
  const SITE_SEARCH_DISABLED_STORAGE_KEY = '_x_extension_site_search_disabled_2024_unique_';

  const NEWTAB_SITE_SEARCH_PROVIDERS = globalThis.LumnoNewtabSiteSearchProviders;
  const {
    buildSearchUrl,
    isAiSiteSearchProvider,
    isSearchEngineSiteSearchProvider,
    isAggregateSearchProvider,
    runSiteSearchProviderQuery,
    getProviderFaviconPageUrl,
    getProviderIcon,
    attachInputModeProviderIcon,
    getSiteSearchProviders,
    reloadSiteSearchProvidersFromStorage,
    getAggregateSearches,
    createAggregateSearchScopeProvider,
    getSiteSearchDisplayName,
    getSiteSearchActionTitle,
    getSiteSearchPrefixText,
    findProviderForSuggestionMatch,
    getInlineSiteSearchCandidate,
    promoteStrongNavigationMatch,
    getKeywordSearchSuggestionState,
    getTopSiteMatchCandidate,
    promoteTopSiteMatch,
    getProviderHost,
    getSiteSearchTriggerCandidate,
    normalizeEnabledSearchResultSourceTypes,
    normalizeSearchResultDisplayLimit,
    getLocalSearchScopeCandidate,
    getLocalSearchScopeLabel,
    getLocalSearchScopeIconClass,
    getSearchModeProviderId
  } = NEWTAB_SITE_SEARCH_PROVIDERS.createSiteSearchProviders({
    SEARCH_UTILS,
    AGGREGATE_SEARCH_STORE,
    AGGREGATE_SEARCH_SURFACE,
    showToast,
    t,
    navigateToUrl: (...args) => navigateToUrl(...args),
    SHORTCUT_FAVICON,
    getPageFaviconUrlResolver,
    siteSearchIconCacheOptions,
    getExtensionResourceUrl,
    getCanonicalPageUrlForFavicon: (...args) => getCanonicalPageUrlForFavicon(...args),
    getHostFromUrl: (...args) => getHostFromUrl(...args),
    getPageFaviconRenderCandidates: (...args) => getPageFaviconRenderCandidates(...args),
    isFaviconProxyUrl: (...args) => isFaviconProxyUrl(...args),
    attachFaviconWithFallbacks: (...args) => attachFaviconWithFallbacks(...args),
    SITE_SEARCH_STORE,
    storageArea,
    SITE_SEARCH_STORAGE_KEY,
    SITE_SEARCH_DISABLED_STORAGE_KEY,
    defaultSiteSearchProviders,
    formatMessage,
    getDirectNavigationUrl: (...args) => getDirectNavigationUrl(...args),
    getUrlDisplay: (...args) => getUrlDisplay(...args),
    SETTINGS,
    pageState: {
      get siteSearchIconCacheLoaded() {
        return siteSearchIconCacheLoaded;
      },
      get siteSearchIconCache() {
        return siteSearchIconCache;
      },
      get siteSearchProvidersLoadVersion() {
        return siteSearchProvidersLoadVersion;
      },
      set siteSearchProvidersLoadVersion(value) {
        siteSearchProvidersLoadVersion = value;
      },
      get siteSearchProvidersCache() {
        return siteSearchProvidersCache;
      },
      set siteSearchProvidersCache(value) {
        siteSearchProvidersCache = value;
      },
      get aggregateSearchesCache() {
        return aggregateSearchesCache;
      },
      set aggregateSearchesCache(value) {
        aggregateSearchesCache = value;
      },
      get aggregateSearchesLoadPromise() {
        return aggregateSearchesLoadPromise;
      },
      set aggregateSearchesLoadPromise(value) {
        aggregateSearchesLoadPromise = value;
      },
      get aggregateSearchesLoadVersion() {
        return aggregateSearchesLoadVersion;
      },
      get AGGREGATE_SEARCH_STORAGE_KEY() {
        return AGGREGATE_SEARCH_STORAGE_KEY;
      },
      get enabledSearchResultSourceTypes() {
        return enabledSearchResultSourceTypes;
      }
    }
  });

  const defaultAccentColor = NEWTAB_FAVICON_THEME.defaultAccentColor;
  const mixColor = NEWTAB_FAVICON_THEME.mixColor;
  const stableHashCode = NEWTAB_FAVICON_THEME.stableHashCode;
  const rgbToCss = NEWTAB_FAVICON_THEME.rgbToCss;
  const rgbToCssAlpha = NEWTAB_FAVICON_THEME.rgbToCssAlpha;
  const rgbToCssParts = NEWTAB_FAVICON_THEME.rgbToCssParts;
  const parseCssColor = NEWTAB_FAVICON_THEME.parseCssColor;
  const getReadableTextColor = NEWTAB_FAVICON_THEME.getReadableTextColor;
  const getBrandAccentForUrl = NEWTAB_FAVICON_THEME.getBrandAccentForUrl;
  const buildFallbackThemeForHost = NEWTAB_FAVICON_THEME.buildFallbackThemeForHost;
  const extractAverageColor = NEWTAB_FAVICON_THEME.extractAverageColor;
  const defaultTheme = NEWTAB_FAVICON_THEME.createDefaultTheme();
  const urlHighlightTheme = NEWTAB_FAVICON_THEME.createUrlHighlightTheme();

  const NEWTAB_SITE_THEME_RESOLVER = globalThis.LumnoNewtabSiteThemeResolver;
  const {
    normalizeFaviconHost,
    isFaviconProxyUrl,
    themeColorCache,
    themeHostCache,
    getHostFromUrl,
    getCanonicalPageUrlForFavicon,
    normalizeAccentRgb,
    normalizeThemeConfidence,
    getThemeSourcePriority,
    getThemeSource,
    buildThemeFromAccent,
    isLowConfidenceTheme,
    isPersistableTheme,
    getProviderThemeHost,
    getThemeHostForSuggestion,
    setResolvedThemeForHost,
    getThemeForProvider,
    getThemeForSuggestion,
    getImmediateThemeForSuggestion,
    shouldUseUrlFallbackThemeForSuggestion,
    scheduleThemeResolutionFlush,
    queueThemeForTarget,
    isNewtabDarkMode,
    getThemeForMode,
    getHoverColors,
    getNeutralHoverActionColors,
    applyThemeVariables,
    applyMarkVariables
  } = NEWTAB_SITE_THEME_RESOLVER.createSiteThemeResolver({
    NEWTAB_FAVICON_THEME,
    FAVICON_UTILS,
    getExtensionResourceUrl,
    normalizeHost,
    parseCssColor,
    defaultAccentColor,
    defaultTheme,
    getProviderHost,
    recentCards,
    applyRecentCardTheme: (...args) => applyRecentCardTheme(...args),
    bookmarkCards,
    applyBookmarkCardTheme: (...args) => applyBookmarkCardTheme(...args),
    shortcutTiles,
    applyShortcutTileTheme: (...args) => applyShortcutTileTheme(...args),
    suggestionItems,
    setSiteSearchPrefix,
    updateSelection: (...args) => updateSelection(...args),
    setPersistedSiteThemeEntry,
    getPersistedSiteThemeEntry,
    getPageFaviconUrlResolver,
    getBrandAccentForUrl,
    extractAverageColor,
    getProviderIcon,
    isHostFaviconVisitDirty,
    stableHashCode,
    getThemeSourceForSuggestion,
    areFaviconRenderCachesReady,
    pageState: {
      get siteSearchState() {
        return siteSearchState;
      },
      get faviconDataCache() {
        return faviconDataCache;
      },
      get requestFaviconData() {
        return requestFaviconData;
      },
      get faviconCacheRuntime() {
        return faviconCacheRuntime;
      }
    }
  });

  const NEWTAB_URL_POLICY = globalThis.LumnoNewtabUrlPolicy;
  const {
    isEnglishQuery,
    getUrlDisplay,
    isBrowserPageRecentUrl,
    isOwnExtensionUrl,
    getOwnExtensionPageDisplay,
    getExtensionFaviconUrl,
    getGstaticFaviconUrl,
    getChromeFaviconUrl,
    getBrowserPageFaviconUrl,
    getPageFaviconCandidateUrl,
    getPageFaviconRenderCandidates,
    isLocalNetworkHost,
    shouldBlockFaviconForHost,
    shouldAvoidDirectFaviconForHost,
    normalizeSearchBlacklistItems,
    normalizeFaviconRequestBlacklistItems,
    normalizeFaviconEnhancedFetchEnabled,
    loadSearchBlacklistItems,
    isUrlBlockedByFaviconRequestBlacklist,
    getNewtabStrictFaviconReason,
    isNewtabEnhancedFaviconFetchEnabled,
    loadFaviconRequestBlacklistItems,
    loadFaviconEnhancedFetchEnabled,
    filterBlacklistedSuggestions,
    limitSuggestionsForDisplay,
    shouldExcludeFromRecentSites
  } = NEWTAB_URL_POLICY.createUrlPolicy({
    EXTENSION_ROUTES,
    t,
    getPageFaviconUrlResolver,
    normalizeFaviconHost,
    getExtensionResourceUrl,
    FAVICON_UTILS,
    BLACKLIST_UTILS,
    SETTINGS,
    storageArea,
    SEARCH_BLACKLIST_STORAGE_KEY,
    FAVICON_REQUEST_BLACKLIST_STORAGE_KEY,
    FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY,
    SEARCH_UTILS,
    pageState: {
      get searchBlacklistItems() {
        return searchBlacklistItems;
      },
      set searchBlacklistItems(value) {
        searchBlacklistItems = value;
      },
      get faviconRequestBlacklistItems() {
        return faviconRequestBlacklistItems;
      },
      set faviconRequestBlacklistItems(value) {
        faviconRequestBlacklistItems = value;
      },
      get faviconEnhancedFetchEnabled() {
        return faviconEnhancedFetchEnabled;
      },
      set faviconEnhancedFetchEnabled(value) {
        faviconEnhancedFetchEnabled = value;
      },
      get searchResultDisplayLimit() {
        return searchResultDisplayLimit;
      }
    }
  });

  const NEWTAB_RECENT_SITES_CONTROLLER = globalThis.LumnoNewtabRecentSitesController;
  const {
    getRecentContextMenuOptions,
    closeRecentContextMenu,
    handleRecentCardContextMenu,
    getRecentStoreOptions,
    getRecentSiteUrlKey,
    normalizeHiddenRecentSites,
    readHiddenRecentSites,
    writeHiddenRecentSites,
    isRecentSiteHidden,
    normalizeRecentSiteRecord,
    normalizePinnedRecentSites,
    readPinnedRecentSites,
    isRecentSitePinned,
    mergeRecentSitesWithPinned,
    togglePinnedRecentSite,
    updateRecentPinButton,
    getRecentProgressState,
    toggleRecentProgressTracking,
    restoreProgressVersion
  } = NEWTAB_RECENT_SITES_CONTROLLER.createRecentSitesController({
    NEWTAB_CONTEXT_MENU_OPEN_VALUE,
    t,
    showToast,
    openExternalNewTabUrl: (...args) => openExternalNewTabUrl(...args),
    hasShortcutForSite: (...args) => hasShortcutForSite(...args),
    addSiteToShortcuts: (...args) => addSiteToShortcuts(...args),
    closeShortcutContextMenu,
    closeBookmarkContextMenu,
    canDismissRecentCard: (...args) => canDismissRecentCard(...args),
    hideCursorTooltip: (...args) => hideCursorTooltip(...args),
    hideTopActionTooltip: (...args) => hideTopActionTooltip(...args),
    normalizeHost,
    getHostFromUrl,
    getCanonicalPageUrlForFavicon,
    sanitizeDisplayText,
    getSiteDisplayName,
    shouldExcludeFromRecentSites,
    isBrowserPageRecentUrl,
    MAX_PINNED_RECENT_SITES,
    NEWTAB_RECENT_STORE,
    recentSitesStorageArea,
    HIDDEN_RECENT_SITES_STORAGE_KEY,
    renderRecentSites: (...args) => renderRecentSites(...args),
    PINNED_RECENT_SITES_STORAGE_KEY,
    progressMatch: PROGRESS_MATCH,
    progressHistory: PROGRESS_HISTORY,
    progressHistoryStorageArea: localStorageArea,
    openProgressHistory: (item) => openRecentHistoryDialog(item),
    pageState: {
      get progressTrackingEnabled() {
        return progressTrackingEnabled;
      },
      get progressHistoryMap() {
        return progressHistoryMap;
      },
      set progressHistoryMap(value) {
        progressHistoryMap = value;
      },
      get recentContextMenu() {
        return recentContextMenu;
      },
      set recentContextMenu(value) {
        recentContextMenu = value;
      },
      get recentContextMenuSelectController() {
        return recentContextMenuSelectController;
      },
      get recentContextMenuTarget() {
        return recentContextMenuTarget;
      },
      set recentContextMenuTarget(value) {
        recentContextMenuTarget = value;
      },
      get hiddenRecentSites() {
        return hiddenRecentSites;
      },
      set hiddenRecentSites(value) {
        hiddenRecentSites = value;
      },
      get pinnedRecentSites() {
        return pinnedRecentSites;
      },
      set pinnedRecentSites(value) {
        pinnedRecentSites = value;
      },
      get recentRenderSignature() {
        return recentRenderSignature;
      },
      set recentRenderSignature(value) {
        recentRenderSignature = value;
      },
      get recentSourceItems() {
        return recentSourceItems;
      }
    }
  });

  let folderColorPreview = null;
  let folderColorPicker = null;

  function getFolderColor(folderId) {
    return folderColorPreview && folderColorPreview.folderId === String(folderId)
      ? folderColorPreview.color
      : folderColors[String(folderId)] || folderColorApi.DEFAULT_FOLDER_COLOR;
  }

  function applySavedFolderColor(icon) {
    if (!icon) return;
    const svg = icon.querySelector('svg[data-folder-color-id]');
    const folderId = svg && svg.getAttribute('data-folder-color-id');
    if (folderId) NEWTAB_BOOKMARK_FOLDER_ICON.applyFolderColor(icon, getFolderColor(folderId));
  }

  function refreshFolderColors() {
    document.querySelectorAll('svg[data-folder-color-id]').forEach((svg) => {
      applySavedFolderColor(svg.parentElement);
    });
  }

  function folderColorStorage(area, method, value) {
    return new Promise((resolve, reject) => {
      if (!area) { reject(new Error('Storage unavailable')); return; }
      area[method](value, (data) => {
        const error = chrome.runtime && chrome.runtime.lastError;
        if (error) reject(new Error(error.message));
        else resolve(data || {});
      });
    });
  }

  function readFolderColorRefs() {
    return folderColorStorage(storageArea, 'get', [FOLDER_COLOR_REFS_STORAGE_KEY]).then((data) =>
      NEWTAB_BOOKMARK_FOLDER_ICON.normalizeFolderColorRefs(data[FOLDER_COLOR_REFS_STORAGE_KEY]));
  }

  function writeFolderColorRefs(refs) {
    return folderColorStorage(storageArea, 'set', { [FOLDER_COLOR_REFS_STORAGE_KEY]: refs });
  }

  // Bookmark ids and paths can change underneath the synced map; resolving
  // again also moves a renamed or moved folder's color to its new path.
  // Only this device's own load or bookmark changes write that move back.
  // A map arriving from another device whose bookmarks have not caught up
  // would otherwise move the entry back and forth between the two devices.
  function applyFolderColorRefs(persist) {
    const resolved = NEWTAB_BOOKMARK_FOLDER_ICON.resolveFolderColors(folderColorRefs, bookmarksRuntime.getNodeMap());
    folderColors = resolved.colors;
    refreshFolderColors();
    if (!resolved.changed || !persist) return Promise.resolve();
    folderColorRefs = resolved.refs;
    return writeFolderColorRefs(resolved.refs).catch((error) => {
      console.warn('[Lumno] Could not update folder color references.', error);
    });
  }

  function syncFolderColorsWithBookmarks(persist) {
    if (!Object.keys(folderColorRefs).length) {
      folderColors = {};
      refreshFolderColors();
      return Promise.resolve();
    }
    return bookmarksRuntime.ensureReady(false).then((ready) => {
      if (ready) return applyFolderColorRefs(persist);
      return undefined;
    });
  }

  // Bookmark sync can deliver many changes at once; resolve after they settle.
  let folderColorSyncTimer = 0;
  function scheduleFolderColorSync() {
    if (!Object.keys(folderColorRefs).length) return;
    clearTimeout(folderColorSyncTimer);
    folderColorSyncTimer = setTimeout(() => {
      folderColorSyncTimer = 0;
      syncFolderColorsWithBookmarks(true).catch(() => {});
    }, 200);
  }

  // Colors saved before they synced were keyed by this device's bookmark ids.
  async function migrateLegacyFolderColors() {
    const data = await folderColorStorage(localStorageArea, 'get', [LEGACY_FOLDER_COLORS_STORAGE_KEY]);
    const legacy = NEWTAB_BOOKMARK_FOLDER_ICON.normalizeFolderColorMap(data[LEGACY_FOLDER_COLORS_STORAGE_KEY]);
    if (!Object.keys(legacy).length) return;
    if (!await bookmarksRuntime.ensureReady(false)) return;
    const refs = await readFolderColorRefs();
    const next = NEWTAB_BOOKMARK_FOLDER_ICON.importFolderColorMap(legacy, refs, bookmarksRuntime.getNodeMap());
    if (JSON.stringify(next) !== JSON.stringify(refs)) await writeFolderColorRefs(next);
    await folderColorStorage(localStorageArea, 'remove', [LEGACY_FOLDER_COLORS_STORAGE_KEY]);
  }

  function loadFolderColors() {
    return migrateLegacyFolderColors().catch((error) => {
      console.warn('[Lumno] Could not migrate folder colors.', error);
    }).then(readFolderColorRefs).then((refs) => {
      folderColorRefs = refs;
      return syncFolderColorsWithBookmarks(true);
    }).catch(() => {});
  }

  async function saveFolderColor(folderId, color) {
    const [refs, ready] = await Promise.all([readFolderColorRefs(), bookmarksRuntime.ensureReady(false)]);
    const next = ready
      ? NEWTAB_BOOKMARK_FOLDER_ICON.setFolderColorRef(refs, folderId, color, bookmarksRuntime.getNodeMap())
      : null;
    if (!next) throw new Error('Folder is unavailable');
    await writeFolderColorRefs(next);
    folderColorRefs = next;
    await applyFolderColorRefs(true);
  }

  async function openFolderColorPicker(folderId, title, sourceElement) {
    closeBookmarkCascadeMenu();
    closeShortcutDialog();
    hideCursorTooltip();
    if (!folderColorPicker) {
      try {
        folderColorPicker = await folderColorApi.createFolderColorPicker({
          documentObj: document, t,
          getFolderSvg: getFigmaFolderSvg,
          initFolderIcon: NEWTAB_BOOKMARK_FOLDER_ICON.initFolderPathMorph,
          animateFolderIcon: playFolderPathMorph,
          applyFolderColor: NEWTAB_BOOKMARK_FOLDER_ICON.applyFolderColor,
          bindTooltip: bindShortcutDialogTooltip,
          hideTooltip: hideShortcutDialogTooltip,
          readSavedColors: () => folderColorStorage(storageArea, 'get', [FOLDER_COLOR_PRESETS_STORAGE_KEY])
            .then((data) => data[FOLDER_COLOR_PRESETS_STORAGE_KEY]),
          saveSavedColors: (colors) => folderColorStorage(storageArea, 'set', { [FOLDER_COLOR_PRESETS_STORAGE_KEY]: colors }),
          onPreview: (id, color) => {
            folderColorPreview = { folderId: id, color };
            refreshFolderColors();
          },
          onSubmit: saveFolderColor,
          onClose: () => { folderColorPreview = null; refreshFolderColors(); }
        });
      } catch {
        showToast(t('folder_color_save_failed', 'Could not save the folder color. Try again.'), true);
        return;
      }
    }
    folderColorPicker.open({ folderId: String(folderId), title, color: getFolderColor(folderId), sourceElement });
  }
  const shortcutIconStore = NEWTAB_SHORTCUT_ICON_STORE.createShortcutIconStore({
    documentObj: document,
    windowObj: window,
    storageArea: localStorageArea,
    storageKey: NEWTAB_SHORTCUT_ICONS_STORAGE_KEY
  });
  const shortcutFaviconStore = SHORTCUT_FAVICON.createShortcutFaviconStore({
    chromeApi: typeof chrome !== 'undefined' ? chrome : null,
    storageArea: localStorageArea,
    storageKey: NEWTAB_SHORTCUT_FAVICON_CACHE_STORAGE_KEY,
    lockManager: window.navigator && window.navigator.locks
  });
  const siteSearchIconStore = SHORTCUT_FAVICON.createShortcutFaviconStore({
    chromeApi: typeof chrome !== 'undefined' ? chrome : null,
    storageArea: localStorageArea,
    storageKey: SITE_SEARCH_ICON_CACHE_STORAGE_KEY,
    ...siteSearchIconCacheOptions
  });
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
    const loadRevision = siteSearchIconCacheRevision;
    siteSearchIconCacheLoadPromise = siteSearchIconStore.readAll().then((cache) => {
      if (siteSearchIconCacheRevision === loadRevision) {
        siteSearchIconCache = cache && typeof cache === 'object' ? cache : {};
      }
      siteSearchIconCacheLoaded = true;
      return siteSearchIconCache;
    }).catch(() => {
      if (siteSearchIconCacheRevision === loadRevision) {
        siteSearchIconCache = {};
      }
      siteSearchIconCacheLoaded = true;
      return siteSearchIconCache;
    });
    return siteSearchIconCacheLoadPromise;
  }

  loadSiteSearchIconCache();
  let shortcutFaviconPolicyRevision = 0;
  let shortcutFaviconPendingCacheEntries = {};
  const sectionModeSelectController =
    NEWTAB_SELECT_MENU.createController({
      documentObj: document,
      windowObj: window,
      onBeforeOpen: (...args) => hideTopActionTooltip(...args),
      getViewportTopInset: (...args) => getNewtabViewportTopPaddingPx(...args)
    });
  const shortcutContextMenuSelectController =
    NEWTAB_SELECT_MENU.createController({
      documentObj: document,
      windowObj: window,
      onBeforeOpen: () => {
        hideShortcutTooltip();
        hideTopActionTooltip();
      },
      getViewportTopInset: (...args) => getNewtabViewportTopPaddingPx(...args)
    });
  const bookmarkContextMenuSelectController =
    NEWTAB_SELECT_MENU.createController({
      documentObj: document,
      windowObj: window,
      onBeforeOpen: () => {
        hideCursorTooltip();
        hideTopActionTooltip();
      },
      getViewportTopInset: (...args) => getNewtabViewportTopPaddingPx(...args)
    });
  const recentContextMenuSelectController =
    NEWTAB_SELECT_MENU.createController({
      documentObj: document,
      windowObj: window,
      onBeforeOpen: () => {
        hideCursorTooltip();
        hideTopActionTooltip();
      },
      getViewportTopInset: (...args) => getNewtabViewportTopPaddingPx(...args)
    });
  const BOOKMARK_WHEEL_SWITCH_COOLDOWN_MS = 220;
  const BOOKMARK_HOVER_DELAY_FROM_RECENT_MS = 56;

  const NEWTAB_CARD_THEMES = globalThis.LumnoNewtabCardThemes;
  const {
    applyRecentCardTheme,
    applyBookmarkCardTheme,
    applyShortcutTileTheme,
    shouldDelayBookmarkHoverFromRecent
  } = NEWTAB_CARD_THEMES.createCardThemes({
    buildFallbackThemeForHost,
    defaultTheme,
    getThemeForMode,
    parseCssColor,
    defaultAccentColor,
    mixColor,
    rgbToCss,
    rgbToCssParts,
    rgbToCssAlpha,
    normalizeAccentRgb,
    getReadableTextColor,
    getThemeSource,
    normalizeThemeConfidence,
    isLowConfidenceTheme,
    scheduleWallpaperAdaptiveToneUpdate,
    pageState: {
      get recentMouseInsideSection() {
        return recentMouseInsideSection;
      },
      get recentMouseLeftAt() {
        return recentMouseLeftAt;
      }
    }
  });

  const NEWTAB_APPEARANCE_MODES = globalThis.LumnoNewtabAppearanceModes;
  const {
    applyLanguageMode,
    refreshThemeAwareFavicons,
    scheduleThemeAwareFaviconRescue,
    applyThemeMode,
    normalizeThemeMode,
    normalizeNewtabThemeMode,
    normalizeNewtabThemeScope,
    isNewtabThemeFollowingGlobal,
    getScopedThemeMode,
    getSelectedThemeMode,
    applyScopedThemeMode,
    bootstrapInitialThemeMode,
    bootstrapInitialLanguageMode,
    syncSystemThemeMode
  } = NEWTAB_APPEARANCE_MODES.createAppearanceModes({
    t,
    renderNewtabTopContent: (...args) => renderNewtabTopContent(...args),
    updateRecentHeading: (...args) => updateRecentHeading(...args),
    updateBookmarkHeading: (...args) => updateBookmarkHeading(...args),
    updateBookmarkPagerLabels: (...args) => updateBookmarkPagerLabels(...args),
    updateBookmarkBreadcrumb: (...args) => updateBookmarkBreadcrumb(...args),
    updateRecentModeMenu: (...args) => updateRecentModeMenu(...args),
    updateBookmarkModeMenu: (...args) => updateBookmarkModeMenu(...args),
    updateWallpaperLanguageStrings,
    updateWallpaperAppearanceSelectionUi,
    updateFeedbackLanguageStrings,
    updateShortcutLanguageStrings,
    setLocalSearchScopePrefix: (...args) => setLocalSearchScopePrefix(...args),
    updateModeBadge: (...args) => updateModeBadge(...args),
    recentCards,
    formatMessage,
    bookmarkCards,
    renderSuggestions: (...args) => renderSuggestions(...args),
    getSystemLocale,
    normalizeLocale,
    applyDocumentLanguage,
    forceReloadRecentSitesForI18n: (...args) => forceReloadRecentSitesForI18n(...args),
    loadLocaleMessages,
    shortcutTiles,
    applyShortcutTileTheme,
    resolveTheme,
    syncBookmarkTopbarSurfaceColorForTheme,
    applyWordmarkThemeAppearance: (...args) => applyWordmarkThemeAppearance(...args),
    suggestionItems,
    applyThemeVariables,
    applyRecentCardTheme,
    applyBookmarkCardTheme,
    updateSelection: (...args) => updateSelection(...args),
    addMediaQueryChangeListener,
    mediaQuery,
    removeMediaQueryChangeListener,
    scheduleWallpaperAdaptiveToneUpdate,
    initialThemeReadyPromise,
    storageArea,
    THEME_STORAGE_KEY,
    NEWTAB_THEME_MODE_STORAGE_KEY,
    NEWTAB_THEME_SCOPE_STORAGE_KEY,
    initialLanguageReadyPromise,
    LANGUAGE_STORAGE_KEY,
    pageState: {
      get topContentController() {
        return topContentController;
      },
      get newtabTopContentMode() {
        return newtabTopContentMode;
      },
      get bookmarkTopbarRuntime() {
        return bookmarkTopbarRuntime;
      },
      get quoteRuntime() {
        return quoteRuntime;
      },
      get inputModeController() {
        return inputModeController;
      },
      get updateNoticeController() {
        return updateNoticeController;
      },
      get engagementNoticeController() {
        return engagementNoticeController;
      },
      get webdavFeatureHintController() {
        return webdavFeatureHintController;
      },
      get inputParts() {
        return inputParts;
      },
      get defaultPlaceholderText() {
        return defaultPlaceholderText;
      },
      set defaultPlaceholderText(value) {
        defaultPlaceholderText = value;
      },
      get siteSearchState() {
        return siteSearchState;
      },
      get localSearchScopeState() {
        return localSearchScopeState;
      },
      get latestQuery() {
        return latestQuery;
      },
      get lastSuggestionResponse() {
        return lastSuggestionResponse;
      },
      get currentLanguageMode() {
        return currentLanguageMode;
      },
      set currentLanguageMode(value) {
        currentLanguageMode = value;
      },
      get currentResolvedLocale() {
        return currentResolvedLocale;
      },
      set currentResolvedLocale(value) {
        currentResolvedLocale = value;
      },
      get resolveInitialLanguageReady() {
        return resolveInitialLanguageReady;
      },
      get currentMessages() {
        return currentMessages;
      },
      set currentMessages(value) {
        currentMessages = value;
      },
      get faviconViewRuntime() {
        return faviconViewRuntime;
      },
      get currentThemeMode() {
        return currentThemeMode;
      },
      set currentThemeMode(value) {
        currentThemeMode = value;
      },
      get wallpaperRuntime() {
        return wallpaperRuntime;
      },
      get initialThemeApplied() {
        return initialThemeApplied;
      },
      set initialThemeApplied(value) {
        initialThemeApplied = value;
      },
      get resolveInitialThemeReady() {
        return resolveInitialThemeReady;
      },
      get newtabThemeMode() {
        return newtabThemeMode;
      },
      set newtabThemeMode(value) {
        newtabThemeMode = value;
      },
      get globalThemeMode() {
        return globalThemeMode;
      },
      set globalThemeMode(value) {
        globalThemeMode = value;
      },
      get newtabThemeScope() {
        return newtabThemeScope;
      },
      set newtabThemeScope(value) {
        newtabThemeScope = value;
      }
    }
  });

  const SECTION_MODE_MENU_MIN_WIDTH_PX = 168;
  const SECTION_MODE_MENU_MAX_WIDTH_PX = 240;
  const SECTION_MODE_MENU_PORTAL_Z_INDEX = 10020;
  const SECTION_MODE_MENU_PORTAL_OFFSET_PX = 8;
  const SEARCH_LAYOUT_MIN_TOP_PX = 28;
  const SEARCH_LAYOUT_MIN_BOTTOM_PX = 20;
  const SEARCH_LAYOUT_UPSHIFT_RATIO = 0.06;
  const SEARCH_LAYOUT_UPSHIFT_MIN_PX = 24;
  const SEARCH_LAYOUT_UPSHIFT_MAX_PX = 80;
  const SEARCH_LAYOUT_CONTENT_SECTIONS_EXTRA_UPSHIFT_PX = 20;
  const SEARCH_LAYOUT_EMPTY_SECTIONS_EXTRA_UPSHIFT_PX = 96;
  const SEARCH_LAYOUT_NARROW_VIEWPORT_MIN_WIDTH_PX = 520;
  const SEARCH_LAYOUT_NARROW_VIEWPORT_MAX_WIDTH_PX = 1440;
  const SEARCH_LAYOUT_NARROW_TOP_INSET_PX = 16;
  const SEARCH_LAYOUT_NARROW_TOP_INSET_TRANSITION_PX = 64;
  const SEARCH_LAYOUT_SHORT_VIEWPORT_MAX_HEIGHT_PX = 680;
  const SEARCH_LAYOUT_SHORT_MIN_TOP_PX = 44;
  const WORDMARK_ENTRY_ANIMATION_NAME = '_x_nt_wordmark_enter_2026_unique_';
  const BOOKMARK_CARD_TARGET_WIDTH_PX = 154;
  const BOOKMARK_GRID_GAP_PX = 12;
  const RECENT_CARD_TARGET_WIDTH_PX = 248;
  const RECENT_GRID_GAP_PX = 12;
  const NEWTAB_MOBILE_FLOW_BREAKPOINT_PX = 640;
  const RECENT_WIDE_MAX_COLUMNS = 6;
  const RECENT_WIDE_CONTENT_MAX_WIDTH_PX = NEWTAB_LAYOUT.getGridContentWidthForColumns(
    RECENT_WIDE_MAX_COLUMNS,
    RECENT_CARD_TARGET_WIDTH_PX,
    RECENT_GRID_GAP_PX
  );
  const NEWTAB_WIDTH_MODE_CONFIGS = {
    standard: {
      searchMaxWidth: 720,
      contentMaxWidth: 1040,
      recentMaxColumns: 4
    },
    wide: {
      searchMaxWidth: 920,
      contentMaxWidth: RECENT_WIDE_CONTENT_MAX_WIDTH_PX,
      recentMaxColumns: RECENT_WIDE_MAX_COLUMNS
    }
  };
  const NEWTAB_SEARCH_WIDTH_CONFIG = {
    min: 640,
    max: 1040,
    fallback: 920,
    snapPoints: [640, 720, 920, 1040],
    snapThreshold: 14
  };
  let currentNewtabWidthMode = 'wide';
  let currentNewtabSearchWidth = null;
  let currentRecentGridColumns = 4;
  toastElement = document.getElementById('_x_extension_toast_2024_unique_');
  toastController = NEWTAB_TOAST.createToastController(toastElement, { windowObj: window });
  markNewtabStartupMilestone('core-runtimes-created');

  function normalizeRecentCount(value) {
    return NEWTAB_RECENT_STORE.normalizeRecentCount(value);
  }

  function normalizeRecentMode(value, fallback) {
    if (value === 'latest' || value === 'most') {
      return value;
    }
    return fallback === 'latest' || fallback === 'most' ? fallback : 'latest';
  }

  const NEWTAB_PAGE_PREFERENCES = globalThis.LumnoNewtabPagePreferences;
  const {
    normalizeNewtabWidthMode,
    normalizeNewtabSearchWidth,
    normalizeNewtabTopContentMode,
    normalizeNewtabTimeSecondsVisible,
    normalizeNewtabTimeFontWeight,
    normalizeNewtabShortcutsVisible,
    normalizeNewtabShortcutAddVisible,
    normalizeNewtabShortcutDockMagnificationEnabled,
    normalizeNewtabShortcutColumns,
    normalizeNewtabShortcutSize,
    normalizeNewtabShortcutGap,
    inferNewtabShortcutColumnsFromWidth,
    normalizeNewtabInputAutoFocusEnabled,
    normalizeNewtabFeedbackButtonVisible,
    normalizeNewtabAppearanceButtonVisible,
    updateNewtabInputAutoFocusUi,
    setNewtabInputAutoFocusEnabled,
    updateNewtabShortcutPreferencesUi,
    setNewtabShortcutsVisible,
    setNewtabShortcutAddVisible,
    setNewtabShortcutDockMagnificationEnabled,
    setNewtabShortcutColumns,
    setNewtabShortcutSize,
    setNewtabShortcutGap,
    initialNewtabInputAutoFocusReadyTask,
    normalizeSimpleModeEnabled,
    normalizeMacosCtrlSuggestionNavigationEnabled,
    normalizeNumberShortcutInstantEnabled,
    normalizeBookmarkFolderIconsVisible,
    normalizeZenModeEnabled,
    normalizeSearchResultPriority,
    normalizeOverlayTabPriorityMode,
    normalizeBookmarkCount,
    getBookmarkLimit,
    normalizeBookmarkColumns,
    normalizeTabRankScoreDebugMode,
    normalizeBookmarkCascadeDebugMode
  } = NEWTAB_PAGE_PREFERENCES.createPagePreferences({
    SETTINGS,
    NEWTAB_SEARCH_WIDTH_CONFIG,
    NEWTAB_SHORTCUT_COLUMNS_MIN,
    NEWTAB_SHORTCUT_COLUMNS_MAX,
    NEWTAB_SHORTCUT_COLUMNS_DEFAULT,
    NEWTAB_SHORTCUT_SIZE_MIN,
    NEWTAB_SHORTCUT_SIZE_MAX,
    NEWTAB_SHORTCUT_SIZE_DEFAULT,
    NEWTAB_SHORTCUT_GAP_MIN,
    NEWTAB_SHORTCUT_GAP_MAX,
    NEWTAB_SHORTCUT_GAP_DEFAULT,
    NEWTAB_SHORTCUT_WIDTH_MIN,
    NEWTAB_SHORTCUT_WIDTH_MAX,
    storageArea,
    NEWTAB_INPUT_AUTO_FOCUS_ENABLED_STORAGE_KEY,
    applyNewtabShortcutsVisibility,
    updateBookmarkSectionPosition,
    NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY,
    renderShortcuts: (...args) => renderShortcuts(...args),
    NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY,
    applyNewtabShortcutDockMagnification,
    scheduleWallpaperAdaptiveToneUpdate,
    NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY,
    applyNewtabShortcutColumns,
    NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY,
    applyNewtabShortcutLayoutPreferences,
    NEWTAB_SHORTCUT_SIZE_STORAGE_KEY,
    NEWTAB_SHORTCUT_GAP_STORAGE_KEY,
    NUMBER_SHORTCUT_INSTANT_ENABLED_STORAGE_KEY,
    SIMPLE_MODE_ENABLED_STORAGE_KEY,
    MACOS_CTRL_SUGGESTION_NAVIGATION_ENABLED_STORAGE_KEY,
    getBookmarkGridColumnCount,
    pageState: {
      get wallpaperRuntime() {
        return wallpaperRuntime;
      },
      get newtabInputAutoFocusEnabled() {
        return newtabInputAutoFocusEnabled;
      },
      set newtabInputAutoFocusEnabled(value) {
        newtabInputAutoFocusEnabled = value;
      },
      get newtabShortcutsVisible() {
        return newtabShortcutsVisible;
      },
      set newtabShortcutsVisible(value) {
        newtabShortcutsVisible = value;
      },
      get newtabShortcutAddVisible() {
        return newtabShortcutAddVisible;
      },
      set newtabShortcutAddVisible(value) {
        newtabShortcutAddVisible = value;
      },
      get newtabShortcutDockMagnificationEnabled() {
        return newtabShortcutDockMagnificationEnabled;
      },
      set newtabShortcutDockMagnificationEnabled(value) {
        newtabShortcutDockMagnificationEnabled = value;
      },
      get newtabShortcutColumns() {
        return newtabShortcutColumns;
      },
      set newtabShortcutColumns(value) {
        newtabShortcutColumns = value;
      },
      get newtabShortcutSize() {
        return newtabShortcutSize;
      },
      set newtabShortcutSize(value) {
        newtabShortcutSize = value;
      },
      get newtabShortcutGap() {
        return newtabShortcutGap;
      },
      set newtabShortcutGap(value) {
        newtabShortcutGap = value;
      },
      get numberShortcutInstantEnabled() {
        return numberShortcutInstantEnabled;
      },
      set numberShortcutInstantEnabled(value) {
        numberShortcutInstantEnabled = value;
      },
      get simpleModeEnabled() {
        return simpleModeEnabled;
      },
      set simpleModeEnabled(value) {
        simpleModeEnabled = value;
      },
      get macosCtrlSuggestionNavigationEnabled() {
        return macosCtrlSuggestionNavigationEnabled;
      },
      set macosCtrlSuggestionNavigationEnabled(value) {
        macosCtrlSuggestionNavigationEnabled = value;
      },
      get currentBookmarkCount() {
        return currentBookmarkCount;
      }
    }
  });

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

  function getBookmarkGridColumnCount() {
    const config = getNewtabWidthModeConfig();
    const maxColumns = Math.max(2, normalizeBookmarkColumns(currentBookmarkColumns));
    return NEWTAB_LAYOUT.getAdaptiveGridColumnCount({
      viewportWidth: window.innerWidth,
      mobileBreakpointPx: NEWTAB_MOBILE_FLOW_BREAKPOINT_PX,
      mobileColumns: 2,
      compactBreakpointPx: 860,
      compactColumns: 2,
      contentMaxWidth: Number(config.contentMaxWidth || 1040),
      targetColumnWidth: BOOKMARK_CARD_TARGET_WIDTH_PX,
      gap: BOOKMARK_GRID_GAP_PX,
      minColumns: 2,
      maxColumns
    });
  }

  function getNewtabWidthModeBaseConfig() {
    return NEWTAB_WIDTH_MODE_CONFIGS[normalizeNewtabWidthMode(currentNewtabWidthMode)] || NEWTAB_WIDTH_MODE_CONFIGS.wide;
  }

  function getEffectiveNewtabSearchWidth() {
    const customWidth = normalizeNewtabSearchWidth(currentNewtabSearchWidth, { allowNull: true });
    return customWidth || getNewtabWidthModeBaseConfig().searchMaxWidth || NEWTAB_SEARCH_WIDTH_CONFIG.fallback;
  }

  function getNewtabWidthModeConfig() {
    return Object.assign({}, getNewtabWidthModeBaseConfig(), {
      searchMaxWidth: getEffectiveNewtabSearchWidth()
    });
  }

  function getRecentGridColumnCount() {
    const config = getNewtabWidthModeConfig();
    const maxColumns = Math.max(4, Number(config.recentMaxColumns || 4));
    return NEWTAB_LAYOUT.getAdaptiveGridColumnCount({
      viewportWidth: window.innerWidth,
      mobileBreakpointPx: NEWTAB_MOBILE_FLOW_BREAKPOINT_PX,
      mobileColumns: 2,
      compactBreakpointPx: 860,
      compactColumns: 2,
      contentMaxWidth: Number(config.contentMaxWidth || 1040),
      targetColumnWidth: RECENT_CARD_TARGET_WIDTH_PX,
      gap: RECENT_GRID_GAP_PX,
      minColumns: 4,
      maxColumns
    });
  }

  function clearPageNoticeQueryParam() {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('notice')) {
        return;
      }
      url.searchParams.delete('notice');
      window.history.replaceState({}, '', url.toString());
    } catch (e) {
      // Ignore URL rewrite failures.
    }
  }

  function dismissPageNoticeBanner() {
    if (pageNoticeController && typeof pageNoticeController.dismiss === 'function') {
      pageNoticeController.dismiss();
      return;
    }
    clearPageNoticeQueryParam();
  }

  function openExtensionDetailsPage(detailsUrl) {
    if (chrome && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
      chrome.runtime.sendMessage({ action: 'openExtensionDetailsPage' }, (response) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          if (detailsUrl) {
            window.open(detailsUrl, '_blank');
          }
          return;
        }
        if (!response || response.ok !== true) {
          const fallbackUrl = response && response.url ? response.url : detailsUrl;
          if (fallbackUrl) {
            window.open(fallbackUrl, '_blank');
          }
        }
      });
      return;
    }
    if (detailsUrl) {
      window.open(detailsUrl, '_blank');
    }
  }

  function showFileAccessNotice(detailsUrl) {
    pageNoticeController = NEWTAB_PAGE_NOTICE.renderPageNotice({
      params: pageSearchParams,
      chromeApi: chrome,
      document,
      windowObj: window,
      bottomDock,
      messages: {
        t,
        getRiSvg,
        detailsUrl
      },
      onClose: () => {
        pageNoticeController = null;
        clearPageNoticeQueryParam();
      },
      openExtensionDetailsPage
    });
  }

  function maybeShowFileAccessNotice() {
    const notice = String(pageSearchParams.get('notice') || '').trim();
    if (notice !== 'file-access') {
      return;
    }
    if (!chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
      clearPageNoticeQueryParam();
      return;
    }
    chrome.runtime.sendMessage({ action: 'getFileSchemeAccessStatus' }, (response) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        clearPageNoticeQueryParam();
        return;
      }
      if (!response || response.supported === false || response.allowed === true) {
        clearPageNoticeQueryParam();
        return;
      }
      showFileAccessNotice(response.detailsUrl || '');
    });
  }

  function getRecentLimit() {
    const normalized = normalizeRecentCount(currentRecentCount);
    if (normalized <= 0) {
      return 0;
    }
    const rows = Math.max(1, Math.round(normalized / 4));
    return rows * Math.max(1, getRecentGridColumnCount());
  }

  function getRecentSourceLimit() {
    const normalized = normalizeRecentCount(currentRecentCount);
    if (normalized <= 0) {
      return 0;
    }
    const rows = Math.max(1, Math.round(normalized / 4));
    const config = getNewtabWidthModeConfig();
    const maxColumns = Math.max(4, Number(config.recentMaxColumns || 4));
    return rows * maxColumns;
  }

  function applyBookmarkGridColumns() {
    if (!bookmarkGrid) {
      return false;
    }
    const previousColumns = Number.parseInt(bookmarkGrid.style.getPropertyValue('--x-nt-bookmark-columns'), 10);
    const columns = Math.max(1, getBookmarkGridColumnCount());
    bookmarkGrid.style.setProperty('--x-nt-bookmark-columns', String(columns));
    return previousColumns !== columns;
  }

  function keepBookmarkPageAnchorAfterLimitChange(previousLimit) {
    const prev = Math.max(1, Number.parseInt(previousLimit, 10) || 1);
    const next = Math.max(1, getBookmarkLimit());
    const firstVisibleIndex = Math.max(0, bookmarkCurrentPage * prev);
    bookmarkCurrentPage = Math.floor(firstVisibleIndex / next);
  }

  function applyRecentGridColumns() {
    if (!recentGrid) {
      return false;
    }
    const columns = getRecentGridColumnCount();
    const changed = currentRecentGridColumns !== columns;
    currentRecentGridColumns = columns;
    recentGrid.style.setProperty('--x-nt-recent-columns', String(columns));
    return changed;
  }

  function applyNewtabWidthMode() {
    if (layoutController && typeof layoutController.applyWidthMode === 'function') {
      layoutController.applyWidthMode(getNewtabWidthModeConfig());
    }
  }

  function updateNewtabSearchWidthLayout() {
    applyNewtabWidthMode();
    updateSuggestionsFloatingLayout();
    updateBookmarkSectionPosition();
  }

  function setNewtabSearchWidth(value, options) {
    const config = options || {};
    const nextWidth = normalizeNewtabSearchWidth(value, { allowNull: Boolean(config.allowNull) });
    const changed = currentNewtabSearchWidth !== nextWidth;
    currentNewtabSearchWidth = nextWidth;
    updateNewtabSearchWidthLayout();
    if (wallpaperRuntime && typeof wallpaperRuntime.updateSearchWidthUi === 'function') {
      wallpaperRuntime.updateSearchWidthUi();
    }
    if (config.persist && storageArea && nextWidth !== null) {
      storageArea.set({ [NEWTAB_SEARCH_WIDTH_STORAGE_KEY]: nextWidth });
    }
    return changed;
  }

  // 使用本地打包字体，避免外链字体依赖。
  let defaultSearchEngineState = {
    id: '',
    name: '',
    host: '',
    updatedAt: 0
  };

  const SEARCH_ENGINE_DEFS = [
    {
      id: 'google',
      name: 'Google',
      hostMatches: ['google.'],
      searchUrl: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`
    },
    {
      id: 'kagi',
      name: 'Kagi',
      hostMatches: ['kagi.com'],
      searchUrl: (query) => `https://kagi.com/search?q=${encodeURIComponent(query)}`
    },
    {
      id: 'bing',
      name: 'Bing',
      hostMatches: ['bing.com'],
      searchUrl: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`
    },
    {
      id: 'baidu',
      name: '百度',
      hostMatches: ['baidu.com'],
      searchUrl: (query) => `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`
    },
    {
      id: 'duckduckgo',
      name: 'DuckDuckGo',
      hostMatches: ['duckduckgo.com'],
      searchUrl: (query) => `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
    },
    {
      id: 'yahoo',
      name: 'Yahoo',
      hostMatches: ['search.yahoo.com'],
      searchUrl: (query) => `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`
    },
    {
      id: 'yandex',
      name: 'Yandex',
      hostMatches: ['yandex.com'],
      searchUrl: (query) => `https://yandex.com/search/?text=${encodeURIComponent(query)}`
    },
    {
      id: 'sogou',
      name: '搜狗',
      hostMatches: ['sogou.com'],
      searchUrl: (query) => `https://www.sogou.com/web?query=${encodeURIComponent(query)}`
    },
    {
      id: 'shenma',
      name: '神马',
      hostMatches: ['sm.cn'],
      searchUrl: (query) => `https://m.sm.cn/s?q=${encodeURIComponent(query)}`
    }
  ];

  function resolveTheme(mode, mediaMatchesOverride) {
    if (mode === 'dark') {
      return 'dark';
    }
    if (mode === 'light') {
      return 'light';
    }
    if (typeof mediaMatchesOverride === 'boolean') {
      return mediaMatchesOverride ? 'dark' : 'light';
    }
    return mediaQuery.matches ? 'dark' : 'light';
  }

  function addMediaQueryChangeListener(queryList, listener) {
    if (!queryList || typeof listener !== 'function') {
      return false;
    }
    if (typeof queryList.addEventListener === 'function') {
      queryList.addEventListener('change', listener);
      return true;
    }
    if (typeof queryList.addListener === 'function') {
      queryList.addListener(listener);
      return true;
    }
    return false;
  }

  function removeMediaQueryChangeListener(queryList, listener) {
    if (!queryList || typeof listener !== 'function') {
      return;
    }
    if (typeof queryList.removeEventListener === 'function') {
      queryList.removeEventListener('change', listener);
      return;
    }
    if (typeof queryList.removeListener === 'function') {
      queryList.removeListener(listener);
    }
  }

  function normalizeLocale(locale) {
    return SETTINGS.normalizeLocale(locale);
  }

  function localeToHtmlLang(locale) {
    return SETTINGS.localeToHtmlLang(locale);
  }

  function applyDocumentLanguage(locale) {
    if (!document.documentElement) {
      return;
    }
    document.documentElement.lang = localeToHtmlLang(locale);
  }

  function migrateStorageIfNeeded(keys, providerReady) {
    if (providerStorageRuntime && !providerReady) {
      providerStorageRuntime.ready.then(() => migrateStorageIfNeeded(keys, true));
      return;
    }
    if (!storageArea || !chrome || !chrome.storage || !chrome.storage.local) {
      return;
    }
    if (isPrimaryStorageAreaName('local')) {
      return;
    }
    chrome.storage.local.get(keys, (localResult) => {
      const hasLocal = keys.some((key) => typeof localResult[key] !== 'undefined');
      if (!hasLocal) {
        return;
      }
      storageArea.get(keys, (syncResult) => {
        const missingSyncValues = {};
        keys.forEach((key) => {
          if (typeof localResult[key] !== 'undefined' && typeof syncResult[key] === 'undefined') {
            missingSyncValues[key] = localResult[key];
          }
        });
        const missingKeys = Object.keys(missingSyncValues);
        if (missingKeys.length === 0) {
          return;
        }
        storageArea.get(missingKeys, (latestSyncResult) => {
          const stillMissingSyncValues = {};
          missingKeys.forEach((key) => {
            if (typeof latestSyncResult[key] === 'undefined') {
              stillMissingSyncValues[key] = missingSyncValues[key];
            }
          });
          if (Object.keys(stillMissingSyncValues).length > 0) {
            storageArea.set(stillMissingSyncValues);
          }
        });
      });
    });
  }

  function getSystemLocale() {
    if (chrome && chrome.i18n && chrome.i18n.getUILanguage) {
      return normalizeLocale(chrome.i18n.getUILanguage());
    }
    return normalizeLocale(navigator.language || 'en');
  }

  function sanitizeDisplayText(text) {
    const raw = String(text || '');
    const withoutSpecial = raw.replace(/[\u0000-\u001F\u007F-\u009F\uFEFF\uFFF9-\uFFFD]|\p{Co}/gu, '');
    return withoutSpecial.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
  }

  function loadLocaleMessages(locale) {
    const normalized = normalizeLocale(locale);
    const localePath = getExtensionResourceUrl(`_locales/${normalized}/messages.json`);
    return fetch(localePath, { cache: 'no-store' })
      .then((response) => response.json())
      .catch(() => ({}));
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

  function getRiSvg(id, sizeClass, extraClass) {
    const size = sizeClass || 'ri-size-16';
    const extra = extraClass ? ` ${extraClass}` : '';
    return `<i class="ri-icon ${size}${extra} ${id}" aria-hidden="true"></i>`;
  }

  function createWallpaperAdaptiveToneTargets() {
    const bookmarkPager = bookmarkPagerPrevButton && bookmarkPagerPrevButton.parentElement
      ? bookmarkPagerPrevButton.parentElement
      : null;
    const shortcutToneTargets = shortcutTiles.map((tile) => ({
      element: tile,
      sampleElement: getShortcutDockIcon(tile) || tile,
      minWidth: 42,
      minHeight: 42,
      iconButton: true,
      forcedIconBackground: 'shortcut-fallback'
    }));
    if (addShortcutButton) {
      shortcutToneTargets.push({
        element: addShortcutButton,
        sampleElement: getShortcutDockIcon(addShortcutButton) || addShortcutButton,
        minWidth: 42,
        minHeight: 42,
        iconButton: true,
        forcedIconBackground: 'shortcut-add'
      });
    }
    return [
      {
        element: bookmarkTopbarRuntime && bookmarkTopbarRuntime.element,
        sampleElement: bookmarkTopbarRuntime && bookmarkTopbarRuntime.element,
        minWidth: 280,
        minHeight: 64,
        surface: 'topbar',
        preferOverlayPolarity: getEffectiveBookmarkTopbarSurfaceMode() === 'adaptive',
        disabled: !isBookmarkTopbarMode() ||
          getEffectiveBookmarkTopbarSurfaceMode() === 'custom'
      },
      {
        element: topContentContainer,
        sampleElement: topContentController && typeof topContentController.getContent === 'function'
          ? (topContentController.getContent() || topContentContainer)
          : (wordmarkImageEl || topContentContainer),
        minWidth: 220,
        minHeight: 72
      },
      {
        element: quoteRuntime && quoteRuntime.element,
        sampleElement: quoteRuntime && (quoteRuntime.textElement || quoteRuntime.element),
        minWidth: 160,
        minHeight: 32
      },
      {
        element: bookmarkTitleWrap,
        sampleElement: bookmarkTitleWrap,
        minWidth: 112,
        minHeight: 44
      },
      // The display-mode trigger is appended to bookmarkPager in the regular
      // section layout. Keep it on the pager's shared tone target so one
      // visual toolbar does not split into independently sampled colors.
      {
        element: bookmarkPager,
        sampleElement: bookmarkPager,
        minWidth: 92,
        minHeight: 42,
        iconButton: true
      },
      {
        element: recentHeader,
        sampleElement: recentHeader,
        minWidth: 112,
        minHeight: 44
      },
      {
        element: recentModeMenu && recentModeMenu.control,
        sampleElement: recentModeMenu && (recentModeMenu.trigger || recentModeMenu.control),
        minWidth: 42,
        minHeight: 42,
        iconButton: true
      },
      {
        element: feedbackButton,
        sampleElement: feedbackButton,
        minWidth: 42,
        minHeight: 42,
        iconButton: true
      },
      {
        element: BOOKMARK_CASCADE_DEBUG_UI_ENABLED && bookmarkCascadeRuntime && bookmarkCascadeRuntime.getDebugButton(),
        sampleElement: BOOKMARK_CASCADE_DEBUG_UI_ENABLED && bookmarkCascadeRuntime && bookmarkCascadeRuntime.getDebugButton(),
        minWidth: 42,
        minHeight: 42,
        iconButton: true
      }
    ].concat(shortcutToneTargets);
  }

  quoteRuntime = globalThis.LumnoNewtabQuotes.createRuntime({
    documentObj: document, windowObj: window, chromeObj: chrome,
    storageArea, localStorageArea, t, showToast,
    getLocale: () => currentResolvedLocale,
    getSearchRoot: () => root,
    getShortcutSection: () => shortcutSection,
    getTooltipController: () => topActionTooltipController,
    isPreferenceArea: (areaName) => providerStorageRuntime
      ? providerStorageRuntime.isActiveAreaName(areaName) : areaName === 'sync',
    onLayout: () => window.requestAnimationFrame(() => {
      updateBookmarkSectionPosition();
      scheduleWallpaperAdaptiveToneUpdate();
    })
  });
  wallpaperRuntime = NEWTAB_WALLPAPER.createWallpaperRuntime({
    documentObj: document,
    windowObj: window,
    chromeObj: chrome,
    extensionRoutes: EXTENSION_ROUTES,
    storageArea,
    localWallpaperStorageArea: localStorageArea,
    getQuoteRuntime: () => quoteRuntime,
    storageKeys: {
      wallpaper: NEWTAB_WALLPAPER_STORAGE_KEY,
      localWallpaper: NEWTAB_LOCAL_WALLPAPER_STORAGE_KEY,
      overlay: NEWTAB_WALLPAPER_OVERLAY_STORAGE_KEY,
      effect: NEWTAB_WALLPAPER_EFFECT_STORAGE_KEY,
      topContentMode: NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY,
      timeFontWeight: NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY,
      timeSecondsVisible: NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY,
      favicon: NEWTAB_FAVICON_STORAGE_KEY
    },
    searchWidthConfig: NEWTAB_SEARCH_WIDTH_CONFIG,
    t,
    formatMessage,
    getThemeMode: getSelectedThemeMode,
    getEffectiveThemeMode: getScopedThemeMode,
    getThemeScope: (...args) => getThemeScope(...args),
    setThemeMode: (...args) => setThemeMode(...args),
    setThemeScope: (...args) => setThemeScope(...args),
    getRiSvg,
    showToast,
    beginToast,
    showTopActionTooltip: (...args) => showTopActionTooltip(...args),
    hideTopActionTooltip: (...args) => hideTopActionTooltip(...args),
    applyWordmarkThemeAppearance: (...args) => applyWordmarkThemeAppearance(...args),
    getTopContentMode: () => newtabTopContentMode,
    setTopContentMode: (value) => {
      setNewtabTopContentMode(value);
    },
    getTimeFontWeight: () => newtabTimeFontWeight,
    setTimeFontWeight: (...args) => setNewtabTimeFontWeight(...args),
    getTimeSecondsVisible: () => newtabTimeSecondsVisible,
    setTimeSecondsVisible: (...args) => setNewtabTimeSecondsVisible(...args),
    getSearchWidth: getEffectiveNewtabSearchWidth,
    setSearchWidth: (value, options) => {
      setNewtabSearchWidth(value, options);
    },
    shortcutColumnsConfig: {
      min: NEWTAB_SHORTCUT_COLUMNS_MIN,
      max: NEWTAB_SHORTCUT_COLUMNS_MAX,
      fallback: NEWTAB_SHORTCUT_COLUMNS_DEFAULT
    },
    shortcutSizeConfig: {
      min: NEWTAB_SHORTCUT_SIZE_MIN,
      max: NEWTAB_SHORTCUT_SIZE_MAX,
      fallback: NEWTAB_SHORTCUT_SIZE_DEFAULT
    },
    shortcutGapConfig: {
      min: NEWTAB_SHORTCUT_GAP_MIN,
      max: NEWTAB_SHORTCUT_GAP_MAX,
      fallback: NEWTAB_SHORTCUT_GAP_DEFAULT
    },
    getShortcutsVisible: () => newtabShortcutsVisible,
    setShortcutsVisible: setNewtabShortcutsVisible,
    getShortcutAddVisible: () => newtabShortcutAddVisible,
    setShortcutAddVisible: setNewtabShortcutAddVisible,
    getShortcutDockMagnificationEnabled: () => newtabShortcutDockMagnificationEnabled,
    setShortcutDockMagnificationEnabled: setNewtabShortcutDockMagnificationEnabled,
    getShortcutColumns: () => newtabShortcutColumns,
    setShortcutColumns: setNewtabShortcutColumns,
    getShortcutSize: () => newtabShortcutSize,
    setShortcutSize: setNewtabShortcutSize,
    getShortcutGap: () => newtabShortcutGap,
    setShortcutGap: setNewtabShortcutGap,
    featureHints: FEATURE_HINTS,
    featureHintVisibilityGate: newtabEntryAnimationReadyPromise,
    inputAutoFocusReady: initialNewtabInputAutoFocusReadyTask,
    getInputAutoFocusEnabled: () => newtabInputAutoFocusEnabled,
    setInputAutoFocusEnabled: setNewtabInputAutoFocusEnabled,
    getAdaptiveToneTargets: createWallpaperAdaptiveToneTargets,
    view: NEWTAB_WALLPAPER_VIEW
  });

  function updateWallpaperLanguageStrings() {
    if (wallpaperRuntime) {
      wallpaperRuntime.updateLanguageStrings();
    }
  }

  function updateWallpaperAppearanceSelectionUi() {
    if (wallpaperRuntime) {
      wallpaperRuntime.updateAppearanceSelectionUi();
    }
  }

  function bootstrapInitialWallpaper() {
    if (!wallpaperRuntime) {
      return Promise.resolve();
    }
    return bootstrapInitialThemeMode().then(() => wallpaperRuntime.bootstrapInitialWallpaper());
  }

  function bootstrapInitialWallpaperOverlay() {
    return wallpaperRuntime ? wallpaperRuntime.bootstrapInitialWallpaperOverlay() : Promise.resolve();
  }

  function bootstrapInitialWallpaperEffect() {
    return wallpaperRuntime ? wallpaperRuntime.bootstrapInitialWallpaperEffect() : Promise.resolve();
  }

  function waitForInitialWallpaperEffectVisual() {
    return wallpaperRuntime && typeof wallpaperRuntime.waitForInitialWallpaperEffectVisual === 'function'
      ? wallpaperRuntime.waitForInitialWallpaperEffectVisual()
      : Promise.resolve();
  }

  function markInitialWallpaperVisualReady() {
    if (document.body) {
      document.body.setAttribute('data-nt-wallpaper-ready', '1');
    }
  }

  function bootstrapInitialNewtabFavicon() {
    return wallpaperRuntime && typeof wallpaperRuntime.bootstrapInitialNewtabFavicon === 'function'
      ? wallpaperRuntime.bootstrapInitialNewtabFavicon()
      : Promise.resolve();
  }

  function createWallpaperControls() {
    if (!wallpaperRuntime) {
      return;
    }
    wallpaperRuntime.createControls();
    wallpaperControl = wallpaperRuntime.getControlElement();
  }

  function isWallpaperPanelOpen() {
    return wallpaperRuntime ? wallpaperRuntime.isPanelOpen() : false;
  }

  function closeWallpaperPanel(options) {
    if (wallpaperRuntime) {
      wallpaperRuntime.closePanel(options);
    }
  }

  function scheduleWallpaperAdaptiveToneUpdate() {
    if (wallpaperRuntime) {
      wallpaperRuntime.scheduleAdaptiveToneUpdate();
    }
  }

  function getSearchEngineById(id) {
    if (!id) {
      return null;
    }
    return SEARCH_ENGINE_DEFS.find((engine) => engine.id === id) || null;
  }

  function buildDefaultSearchUrl(query) {
    const engine = getSearchEngineById(defaultSearchEngineState.id);
    if (engine && typeof engine.searchUrl === 'function') {
      return engine.searchUrl(query);
    }
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  }

  function getDefaultSearchEngineThemeUrl() {
    const engine = getSearchEngineById(defaultSearchEngineState.id);
    if (engine && typeof engine.searchUrl === 'function') {
      return engine.searchUrl('test');
    }
    return 'https://www.google.com';
  }

  function getDefaultSearchEngineFaviconUrl() {
    return getPageFaviconCandidateUrl(getDefaultSearchEngineThemeUrl());
  }

  function getSearchActionLabel() {
    return t('action_search', '搜索');
  }

  function loadDefaultSearchEngineState() {
    if (!storageArea) {
      return;
    }
    storageArea.get([DEFAULT_SEARCH_ENGINE_STORAGE_KEY], (result) => {
      const stored = result ? result[DEFAULT_SEARCH_ENGINE_STORAGE_KEY] : null;
      if (stored && stored.id &&
          (!SEARCH_UTILS.isRetiredSearchEngineState(stored))) {
        defaultSearchEngineState = stored;
      }
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') {
      rememberSearchEntryViewport();
      hideToast();
    }
    if (document.visibilityState !== 'visible') {
      return;
    }
    syncSystemThemeMode();
  });
  window.addEventListener('pageshow', () => {
    hideToast();
    syncSystemThemeMode();
  });
  window.addEventListener('focus', () => {
    hideToast();
    syncSystemThemeMode();
  });
  window.addEventListener('blur', hideToast);
  window.addEventListener('pagehide', hideToast);

  const initialWallpaperOverlayReadyTask = bootstrapInitialWallpaperOverlay();
  observeNewtabStartupTask('wallpaper-overlay', initialWallpaperOverlayReadyTask);
  const initialWallpaperVisualReadyTask = Promise.all([
    bootstrapInitialThemeMode(),
    initialWallpaperOverlayReadyTask.then(() => bootstrapInitialWallpaper()),
    initialWallpaperOverlayReadyTask,
    bootstrapInitialWallpaperEffect()
  ]).then(() => waitForInitialWallpaperEffectVisual()).catch((error) => {
    console.warn('[Lumno] Initial new tab wallpaper setup failed.', error);
  }).then(() => {
    markInitialWallpaperVisualReady();
  });
  observeNewtabStartupTask('wallpaper-visual', initialWallpaperVisualReadyTask);
  const initialAppearanceReadyTask = Promise.all([
    initialWallpaperVisualReadyTask,
    bootstrapInitialNewtabFavicon()
  ]).catch((error) => {
    console.warn('[Lumno] Initial new tab appearance setup failed.', error);
  });
  observeNewtabStartupTask('appearance', initialAppearanceReadyTask);
  markNewtabStartupMilestone('appearance-bootstrap-scheduled');

  addStorageChangeListener((changes, areaName) => {
    if (areaName === 'local' && changes[FOLDER_REFERENCES.BINDINGS_KEY]) {
      shortcutFolderRuntime.accept(changes[FOLDER_REFERENCES.BINDINGS_KEY].newValue);
      if (!isShortcutDragActive()) renderShortcuts();
    }
    if (isPrimaryStorageAreaName(areaName) && changes[FOLDER_COLOR_REFS_STORAGE_KEY]) {
      folderColorRefs = NEWTAB_BOOKMARK_FOLDER_ICON.normalizeFolderColorRefs(changes[FOLDER_COLOR_REFS_STORAGE_KEY].newValue);
      syncFolderColorsWithBookmarks(false).catch(() => {});
    }
    if (areaName === 'local' && changes[NEWTAB_SHORTCUT_ICONS_STORAGE_KEY]) {
      newtabShortcutIcons = NEWTAB_SHORTCUT_ICON_STORE.normalizeIconMap(
        changes[NEWTAB_SHORTCUT_ICONS_STORAGE_KEY].newValue
      );
      renderShortcuts();
    }
    if (areaName === 'local' && changes[NEWTAB_SHORTCUT_FAVICON_CACHE_STORAGE_KEY]) {
      newtabShortcutFavicons = SHORTCUT_FAVICON.normalizeCacheMap({
        ...(changes[NEWTAB_SHORTCUT_FAVICON_CACHE_STORAGE_KEY].newValue || {}),
        ...shortcutFaviconPendingCacheEntries
      });
      renderShortcuts();
    }
    if (areaName === 'local' && changes[SITE_SEARCH_ICON_CACHE_STORAGE_KEY]) {
      siteSearchIconCache = SHORTCUT_FAVICON.normalizeCacheMap(
        changes[SITE_SEARCH_ICON_CACHE_STORAGE_KEY].newValue,
        Date.now(),
        siteSearchIconCacheOptions
      );
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
      if (latestQuery) {
        requestSuggestions(latestQuery, { immediate: true });
      }
    }
    if (areaName === 'local' &&
        changes[NEWTAB_SHORTCUTS_LOCAL_OVERFLOW_STORAGE_KEY] &&
        isShortcutSyncStorageActive() &&
        shortcutPersistenceInFlightCount === 0) {
      scheduleShortcutStorageReload();
    }
    handleBookmarkTopbarSurfaceColorStorageChanges(changes, areaName);
    if (areaName === 'local' && changes[PROGRESS_HISTORY.STORAGE_KEY]) {
      progressHistoryMap = PROGRESS_HISTORY.normalizeHistoryMap(changes[PROGRESS_HISTORY.STORAGE_KEY].newValue);
    }
    const isPrimaryArea = isPrimaryStorageAreaName(areaName);
    if (!isPrimaryArea) {
      if (recentSitesStorageAreaName &&
          isPrimaryStorageAreaName(areaName) &&
          changes[PINNED_RECENT_SITES_STORAGE_KEY]) {
        pinnedRecentSites = normalizePinnedRecentSites(changes[PINNED_RECENT_SITES_STORAGE_KEY].newValue);
        recentRenderSignature = '';
        renderRecentSites(recentSourceItems);
      }
      if (recentSitesStorageAreaName &&
          isPrimaryStorageAreaName(areaName) &&
          changes[HIDDEN_RECENT_SITES_STORAGE_KEY]) {
        hiddenRecentSites = normalizeHiddenRecentSites(changes[HIDDEN_RECENT_SITES_STORAGE_KEY].newValue);
        recentRenderSignature = '';
        renderRecentSites(recentSourceItems);
      }
      if (areaName === 'local' &&
          (changes[NEWTAB_LOCAL_WALLPAPER_STORAGE_KEY] || changes[settingsRuntimeApi.ASSET_REVISION_STORAGE_KEY] ||
            (changes[globalThis.LumnoNewtabRemoteContent.BING_DAILY_CACHE_KEY])) &&
          wallpaperRuntime) {
        wallpaperRuntime.handleStorageChange(changes);
      }
      return;
    }
    if (changes[THEME_STORAGE_KEY]) {
      globalThemeMode = normalizeThemeMode(changes[THEME_STORAGE_KEY].newValue);
      if (isNewtabThemeFollowingGlobal()) {
        applyScopedThemeMode();
      } else {
        updateWallpaperAppearanceSelectionUi();
        updateModeCommandSuggestions();
      }
    }
    if (changes[NEWTAB_THEME_MODE_STORAGE_KEY]) {
      newtabThemeMode = normalizeNewtabThemeMode(changes[NEWTAB_THEME_MODE_STORAGE_KEY].newValue);
      applyScopedThemeMode();
    }
    if (changes[NEWTAB_THEME_SCOPE_STORAGE_KEY]) {
      newtabThemeScope = normalizeNewtabThemeScope(changes[NEWTAB_THEME_SCOPE_STORAGE_KEY].newValue);
      updateWallpaperLanguageStrings();
      updateModeCommandSuggestions();
    }
    if (wallpaperRuntime) {
      wallpaperRuntime.handleStorageChange(changes);
    }
    if (changes[LANGUAGE_STORAGE_KEY]) {
      applyLanguageMode(changes[LANGUAGE_STORAGE_KEY].newValue || 'system');
    }
    if (changes[NEWTAB_INPUT_AUTO_FOCUS_ENABLED_STORAGE_KEY]) {
      const rawValue = changes[NEWTAB_INPUT_AUTO_FOCUS_ENABLED_STORAGE_KEY].newValue;
      newtabInputAutoFocusEnabled = normalizeNewtabInputAutoFocusEnabled(rawValue);
      settingsRuntimeApi.cacheNewtabInputAutoFocusEnabled(newtabInputAutoFocusEnabled);
      updateNewtabInputAutoFocusUi();
    }
    if (changes[RECENT_COUNT_STORAGE_KEY]) {
      const nextCount = normalizeRecentCount(changes[RECENT_COUNT_STORAGE_KEY].newValue);
      currentRecentCount = nextCount;
      markRecentDataDirty();
      loadRecentSites({ force: true });
    }
    if (changes[NEWTAB_WIDTH_MODE_STORAGE_KEY]) {
      const previousBookmarkLimit = getBookmarkLimit();
      const rawMode = changes[NEWTAB_WIDTH_MODE_STORAGE_KEY].newValue;
      const nextMode = normalizeNewtabWidthMode(rawMode);
      currentNewtabWidthMode = nextMode;
      if (storageArea && rawMode !== nextMode) {
        storageArea.set({ [NEWTAB_WIDTH_MODE_STORAGE_KEY]: nextMode });
      }
      applyNewtabWidthMode();
      if (wallpaperRuntime && typeof wallpaperRuntime.updateSearchWidthUi === 'function') {
        wallpaperRuntime.updateSearchWidthUi();
      }
      const recentColumnsChanged = applyRecentGridColumns();
      const bookmarkColumnsChanged = applyBookmarkGridColumns();
      if (recentColumnsChanged) {
        markRecentDataDirty();
        loadRecentSites({ force: true });
      }
      if (bookmarkColumnsChanged) {
        keepBookmarkPageAnchorAfterLimitChange(previousBookmarkLimit);
        renderCurrentBookmarkPage();
      }
      updateBookmarkGridHeightLock();
      updateBookmarkSectionPosition();
    }
    if (changes[NEWTAB_SEARCH_WIDTH_STORAGE_KEY]) {
      const rawWidth = changes[NEWTAB_SEARCH_WIDTH_STORAGE_KEY].newValue;
      currentNewtabSearchWidth = normalizeNewtabSearchWidth(rawWidth, { allowNull: true });
      updateNewtabSearchWidthLayout();
      if (wallpaperRuntime && typeof wallpaperRuntime.updateSearchWidthUi === 'function') {
        wallpaperRuntime.updateSearchWidthUi();
      }
    }
    if (changes[NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY]) {
      const raw = changes[NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY].newValue;
      const nextValue = normalizeNewtabTopContentMode(raw);
      if (storageArea && raw !== nextValue) {
        storageArea.set({ [NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY]: nextValue });
      }
      setNewtabTopContentMode(nextValue);
    }
    if (changes[NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY]) {
      const raw = changes[NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY].newValue;
      const nextValue = normalizeNewtabTimeFontWeight(raw);
      if (storageArea && raw !== nextValue) {
        storageArea.set({ [NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY]: nextValue });
      }
      setNewtabTimeFontWeight(nextValue);
    }
    if (changes[NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY]) {
      const raw = changes[NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY].newValue;
      const nextValue = normalizeNewtabTimeSecondsVisible(raw);
      if (storageArea && raw !== nextValue) {
        storageArea.set({ [NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY]: nextValue });
      }
      setNewtabTimeSecondsVisible(nextValue);
    }
    if (changes[NEWTAB_FEEDBACK_BUTTON_VISIBLE_STORAGE_KEY]) {
      const raw = changes[NEWTAB_FEEDBACK_BUTTON_VISIBLE_STORAGE_KEY].newValue;
      newtabFeedbackButtonVisible = normalizeNewtabFeedbackButtonVisible(raw);
      if (storageArea && raw !== newtabFeedbackButtonVisible) {
        storageArea.set({
          [NEWTAB_FEEDBACK_BUTTON_VISIBLE_STORAGE_KEY]: newtabFeedbackButtonVisible
        });
      }
      applyNewtabActionButtonVisibility();
    }
    if (changes[NEWTAB_APPEARANCE_BUTTON_VISIBLE_STORAGE_KEY]) {
      const raw = changes[NEWTAB_APPEARANCE_BUTTON_VISIBLE_STORAGE_KEY].newValue;
      newtabAppearanceButtonVisible = normalizeNewtabAppearanceButtonVisible(raw);
      if (storageArea && raw !== newtabAppearanceButtonVisible) {
        storageArea.set({
          [NEWTAB_APPEARANCE_BUTTON_VISIBLE_STORAGE_KEY]: newtabAppearanceButtonVisible
        });
      }
      applyNewtabActionButtonVisibility();
    }
    if (changes[NEWTAB_ZEN_MODE_STORAGE_KEY]) {
      zenModeEnabled = normalizeZenModeEnabled(changes[NEWTAB_ZEN_MODE_STORAGE_KEY].newValue);
      applyZenMode();
      updateZenCommandSuggestions();
    }
    if (changes[NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY]) {
      const raw = changes[NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY].newValue;
      const nextValue = normalizeNewtabShortcutsVisible(raw);
      newtabShortcutsVisible = nextValue;
      if (storageArea && raw !== nextValue) {
        storageArea.set({ [NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY]: nextValue });
      }
      applyNewtabShortcutsVisibility();
      updateNewtabShortcutPreferencesUi();
    }
    if (changes[NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY]) {
      const raw = changes[NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY].newValue;
      const nextValue = normalizeNewtabShortcutAddVisible(raw);
      newtabShortcutAddVisible = nextValue;
      if (storageArea && raw !== nextValue) {
        storageArea.set({ [NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY]: nextValue });
      }
      renderShortcuts();
      updateNewtabShortcutPreferencesUi();
    }
    if (changes[NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY]) {
      const raw = changes[NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY].newValue;
      const nextValue = normalizeNewtabShortcutDockMagnificationEnabled(raw);
      newtabShortcutDockMagnificationEnabled = nextValue;
      if (storageArea && raw !== nextValue) {
        storageArea.set({ [NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY]: nextValue });
      }
      applyNewtabShortcutDockMagnification();
      updateNewtabShortcutPreferencesUi();
    }
    if (changes[NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY]) {
      const raw = changes[NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY].newValue;
      const nextValue = normalizeNewtabShortcutColumns(raw);
      newtabShortcutColumns = nextValue;
      if (storageArea && raw !== nextValue) {
        storageArea.set({ [NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY]: nextValue });
      }
      applyNewtabShortcutColumns();
      updateBookmarkSectionPosition({
        preserveSearchEntryLayout: true,
        stabilizeDockDensity: true
      });
      updateNewtabShortcutPreferencesUi();
    }
    if (changes[NEWTAB_SHORTCUT_SIZE_STORAGE_KEY]) {
      const raw = changes[NEWTAB_SHORTCUT_SIZE_STORAGE_KEY].newValue;
      const nextValue = normalizeNewtabShortcutSize(raw);
      newtabShortcutSize = nextValue;
      if (storageArea && raw !== nextValue) {
        storageArea.set({ [NEWTAB_SHORTCUT_SIZE_STORAGE_KEY]: nextValue });
      }
      applyNewtabShortcutLayoutPreferences();
      updateBookmarkSectionPosition({
        preserveSearchEntryLayout: true,
        stabilizeDockDensity: true
      });
      updateNewtabShortcutPreferencesUi();
    }
    if (changes[NEWTAB_SHORTCUT_GAP_STORAGE_KEY]) {
      const raw = changes[NEWTAB_SHORTCUT_GAP_STORAGE_KEY].newValue;
      const nextValue = normalizeNewtabShortcutGap(raw);
      newtabShortcutGap = nextValue;
      if (storageArea && raw !== nextValue) {
        storageArea.set({ [NEWTAB_SHORTCUT_GAP_STORAGE_KEY]: nextValue });
      }
      applyNewtabShortcutLayoutPreferences();
      updateBookmarkSectionPosition({
        preserveSearchEntryLayout: true,
        stabilizeDockDensity: true
      });
      updateNewtabShortcutPreferencesUi();
    }
    if (changes[RECENT_MODE_STORAGE_KEY]) {
      const nextMode = normalizeRecentMode(changes[RECENT_MODE_STORAGE_KEY].newValue, 'latest');
      if (currentRecentMode === nextMode) {
        updateRecentModeMenu();
      } else {
        currentRecentMode = nextMode;
        updateRecentHeading();
        updateRecentModeMenu();
        markRecentDataDirty();
        loadRecentSites({ force: true });
      }
    }
    if (changes[BOOKMARK_VIEW_MODE_STORAGE_KEY]) {
      const rawMode = changes[BOOKMARK_VIEW_MODE_STORAGE_KEY].newValue;
      const nextMode = normalizeBookmarkViewMode(rawMode);
      if (shouldRepairBookmarkViewModeStorageValue(rawMode, nextMode)) {
        persistBookmarkViewMode(nextMode);
      }
      applyBookmarkViewMode(nextMode, { force: true });
    }
    if (changes[BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY]) {
      const raw = changes[BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY].newValue;
      const nextValue = normalizeBookmarkFolderIconsVisible(raw);
      bookmarkFolderIconsVisible = nextValue;
      if (storageArea && raw !== nextValue) {
        storageArea.set({ [BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY]: nextValue });
      }
      if (bookmarksView && typeof bookmarksView.setFolderIconsVisible === 'function') {
        bookmarksView.setFolderIconsVisible(nextValue);
      }
    }
    if (changes[BOOKMARK_COUNT_STORAGE_KEY]) {
      const raw = changes[BOOKMARK_COUNT_STORAGE_KEY].newValue;
      const nextCount = normalizeBookmarkCount(raw);
      currentBookmarkCount = nextCount;
      if (storageArea && raw !== nextCount) {
        storageArea.set({ [BOOKMARK_COUNT_STORAGE_KEY]: nextCount });
      }
      bookmarkCurrentPage = 0;
      markBookmarkDataDirty();
      loadBookmarks({ force: true });
    }
    if (changes[BOOKMARK_COLUMNS_STORAGE_KEY]) {
      const previousLimit = getBookmarkLimit();
      const raw = changes[BOOKMARK_COLUMNS_STORAGE_KEY].newValue;
      const nextColumns = normalizeBookmarkColumns(raw);
      currentBookmarkColumns = nextColumns;
      if (storageArea && raw !== nextColumns) {
        storageArea.set({ [BOOKMARK_COLUMNS_STORAGE_KEY]: nextColumns });
      }
      keepBookmarkPageAnchorAfterLimitChange(previousLimit);
      applyBookmarkGridColumns();
      renderCurrentBookmarkPage();
      updateBookmarkGridHeightLock();
      updateBookmarkSectionPosition();
    }
    if (changes[TAB_RANK_SCORE_DEBUG_STORAGE_KEY]) {
      tabRankScoreDebugEnabled = normalizeTabRankScoreDebugMode(changes[TAB_RANK_SCORE_DEBUG_STORAGE_KEY].newValue);
      if (!latestQuery || !latestQuery.trim()) {
        requestTabsAndRender();
      }
    }
    if (BOOKMARK_CASCADE_DEBUG_UI_ENABLED && changes[BOOKMARK_CASCADE_DEBUG_STORAGE_KEY]) {
      setBookmarkCascadeDebugEnabled(changes[BOOKMARK_CASCADE_DEBUG_STORAGE_KEY].newValue, {
        persist: false
      });
    }
    if (changes[PINNED_RECENT_SITES_STORAGE_KEY]) {
      pinnedRecentSites = normalizePinnedRecentSites(changes[PINNED_RECENT_SITES_STORAGE_KEY].newValue);
      recentRenderSignature = '';
      renderRecentSites(recentSourceItems);
    }
    if (changes[settingsRuntimeApi.PROGRESS_TRACKING_ENABLED_STORAGE_KEY]) {
      progressTrackingEnabled = settingsRuntimeApi.normalizeProgressTrackingEnabled(
        changes[settingsRuntimeApi.PROGRESS_TRACKING_ENABLED_STORAGE_KEY].newValue
      );
      if (!progressTrackingEnabled && recentHistoryDialogController) {
        recentHistoryDialogController.close({ restoreFocus: false });
      }
      recentRenderSignature = '';
      renderRecentSites(recentSourceItems);
    }
    if (changes[HIDDEN_RECENT_SITES_STORAGE_KEY]) {
      hiddenRecentSites = normalizeHiddenRecentSites(changes[HIDDEN_RECENT_SITES_STORAGE_KEY].newValue);
      recentRenderSignature = '';
      renderRecentSites(recentSourceItems);
    }
    if (shortcutPersistenceInFlightCount === 0 &&
        NEWTAB_SHORTCUTS_STORAGE_KEYS.some((key) => changes[key])) {
      scheduleShortcutStorageReload();
    }
  });

  if (chrome && chrome.runtime && chrome.runtime.onMessage && typeof chrome.runtime.onMessage.addListener === 'function') {
    chrome.runtime.onMessage.addListener((message) => {
      if (!message) {
        return;
      }
      if (message.action === 'lumno:wallpapers-updated') {
        if (wallpaperRuntime && typeof wallpaperRuntime.refreshCustomWallpapers === 'function') {
          wallpaperRuntime.refreshCustomWallpapers();
        }
        return;
      }
      if (message.action !== 'lumno:newtab-refresh-sections') return;
      const section = message.section || 'all';
      if (section === 'recent' || section === 'all') {
        markRecentDataDirty();
        loadRecentSites({ force: true });
      }
      if (section === 'bookmarks' || section === 'all') {
        markBookmarkDataDirty();
        loadBookmarks({ force: true });
      }
    });
  }

  if (storageArea) {
    bootstrapInitialLanguageMode();
    storageArea.get([settingsRuntimeApi.PROGRESS_TRACKING_ENABLED_STORAGE_KEY], (result) => {
      progressTrackingEnabled = settingsRuntimeApi.normalizeProgressTrackingEnabled(
        result && result[settingsRuntimeApi.PROGRESS_TRACKING_ENABLED_STORAGE_KEY]
      );
      if (progressTrackingEnabled && recentSourceItems.length > 0) {
        recentRenderSignature = '';
        renderRecentSites(recentSourceItems);
      }
    });
    if (localStorageArea) {
      localStorageArea.get([PROGRESS_HISTORY.STORAGE_KEY], (result) => {
        progressHistoryMap = PROGRESS_HISTORY.normalizeHistoryMap(result && result[PROGRESS_HISTORY.STORAGE_KEY]);
      });
    }
    initialPinnedRecentSitesReadyTask = readPinnedRecentSites().then((items) => {
      pinnedRecentSites = items;
      if (recentSourceItems.length > 0) {
        recentRenderSignature = '';
        renderRecentSites(recentSourceItems);
      }
      return items;
    }).catch(() => {
      pinnedRecentSites = [];
      return pinnedRecentSites;
    });
    initialHiddenRecentSitesReadyTask = readHiddenRecentSites().then((items) => {
      hiddenRecentSites = items;
      if (recentSourceItems.length > 0) {
        recentRenderSignature = '';
        renderRecentSites(recentSourceItems);
      }
      return items;
    }).catch(() => {
      hiddenRecentSites = [];
      return hiddenRecentSites;
    });

    storageArea.get([RECENT_COUNT_STORAGE_KEY], (result) => {
      const stored = result[RECENT_COUNT_STORAGE_KEY];
      const count = normalizeRecentCount(stored);
      const changed = currentRecentCount !== count;
      currentRecentCount = count;
      if (stored !== count) {
        storageArea.set({ [RECENT_COUNT_STORAGE_KEY]: count });
      }
      if (changed || !recentLoadedOnce) {
        markRecentDataDirty();
        loadRecentSites();
      }
    });
    storageArea.get([NEWTAB_WIDTH_MODE_STORAGE_KEY, NEWTAB_SEARCH_WIDTH_STORAGE_KEY], (result) => {
      const previousBookmarkLimit = getBookmarkLimit();
      const stored = result[NEWTAB_WIDTH_MODE_STORAGE_KEY];
      const mode = normalizeNewtabWidthMode(stored);
      const changed = currentNewtabWidthMode !== mode;
      currentNewtabWidthMode = mode;
      currentNewtabSearchWidth = normalizeNewtabSearchWidth(result[NEWTAB_SEARCH_WIDTH_STORAGE_KEY], {
        allowNull: true
      });
      if (stored !== mode) {
        storageArea.set({ [NEWTAB_WIDTH_MODE_STORAGE_KEY]: mode });
      }
      applyNewtabWidthMode();
      if (wallpaperRuntime && typeof wallpaperRuntime.updateSearchWidthUi === 'function') {
        wallpaperRuntime.updateSearchWidthUi();
      }
      const recentColumnsChanged = applyRecentGridColumns();
      const bookmarkColumnsChanged = applyBookmarkGridColumns();
      if (changed || recentColumnsChanged) {
        markRecentDataDirty();
        loadRecentSites({ force: true });
      }
      if (bookmarkColumnsChanged && bookmarkLoadedOnce) {
        keepBookmarkPageAnchorAfterLimitChange(previousBookmarkLimit);
        renderCurrentBookmarkPage();
      }
      updateBookmarkGridHeightLock();
      updateBookmarkSectionPosition();
    });
    storageArea.get([
      NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY,
      NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY,
      NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY
    ], (result) => {
      const raw = result[NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY];
      const nextValue = normalizeNewtabTopContentMode(raw);
      const rawFontWeight = result[NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY];
      const nextFontWeight = normalizeNewtabTimeFontWeight(rawFontWeight);
      const rawSecondsVisible = result[NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY];
      const nextSecondsVisible = normalizeNewtabTimeSecondsVisible(rawSecondsVisible);
      if (raw !== nextValue) {
        storageArea.set({ [NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY]: nextValue });
      }
      if (rawFontWeight !== nextFontWeight) {
        storageArea.set({ [NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY]: nextFontWeight });
      }
      if (rawSecondsVisible !== nextSecondsVisible) {
        storageArea.set({ [NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY]: nextSecondsVisible });
      }
      setNewtabTimeFontWeight(nextFontWeight);
      setNewtabTimeSecondsVisible(nextSecondsVisible);
      setNewtabTopContentMode(nextValue);
      if (wallpaperRuntime && typeof wallpaperRuntime.updateTopContentModeUi === 'function') {
        wallpaperRuntime.updateTopContentModeUi();
      }
    });
    storageArea.get([RECENT_MODE_STORAGE_KEY], (result) => {
      const stored = result[RECENT_MODE_STORAGE_KEY];
      const hasStored = stored === 'latest' || stored === 'most';
      const mode = normalizeRecentMode(stored, 'most');
      const changed = currentRecentMode !== mode;
      currentRecentMode = mode;
      updateRecentHeading();
      updateRecentModeMenu();
      if (!hasStored) {
        storageArea.set({ [RECENT_MODE_STORAGE_KEY]: mode });
      }
      if (changed || !recentLoadedOnce) {
        markRecentDataDirty();
        loadRecentSites();
      }
    });
    loadInitialBookmarkViewMode();
    loadInitialBookmarkTopbarSurfaceColors();
    loadInitialBookmarkTopbarSurfaceMode();
    storageArea.get([BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY], (result) => {
      const raw = result[BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY];
      const nextValue = normalizeBookmarkFolderIconsVisible(raw);
      bookmarkFolderIconsVisible = nextValue;
      if (raw !== nextValue) {
        storageArea.set({ [BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY]: nextValue });
      }
      if (bookmarksView && typeof bookmarksView.setFolderIconsVisible === 'function') {
        bookmarksView.setFolderIconsVisible(nextValue);
      }
    });
    storageArea.get([BOOKMARK_COUNT_STORAGE_KEY], (result) => {
      const stored = result[BOOKMARK_COUNT_STORAGE_KEY];
      const count = normalizeBookmarkCount(stored);
      const changed = currentBookmarkCount !== count;
      currentBookmarkCount = count;
      if (stored !== count) {
        storageArea.set({ [BOOKMARK_COUNT_STORAGE_KEY]: count });
      }
      if (changed || !bookmarkLoadedOnce) {
        markBookmarkDataDirty();
        loadBookmarks();
      }
    });
    storageArea.get([BOOKMARK_COLUMNS_STORAGE_KEY], (result) => {
      const stored = result[BOOKMARK_COLUMNS_STORAGE_KEY];
      const columns = normalizeBookmarkColumns(stored);
      currentBookmarkColumns = columns;
      if (stored !== columns) {
        storageArea.set({ [BOOKMARK_COLUMNS_STORAGE_KEY]: columns });
      }
      applyBookmarkGridColumns();
      updateBookmarkGridHeightLock();
      updateBookmarkSectionPosition();
    });
    storageArea.get([TAB_RANK_SCORE_DEBUG_STORAGE_KEY], (result) => {
      const raw = result[TAB_RANK_SCORE_DEBUG_STORAGE_KEY];
      const next = normalizeTabRankScoreDebugMode(raw);
      tabRankScoreDebugEnabled = next;
      if (raw !== next) {
        storageArea.set({ [TAB_RANK_SCORE_DEBUG_STORAGE_KEY]: next });
      }
    });
    if (BOOKMARK_CASCADE_DEBUG_UI_ENABLED) {
      storageArea.get([BOOKMARK_CASCADE_DEBUG_STORAGE_KEY], (result) => {
        const raw = result[BOOKMARK_CASCADE_DEBUG_STORAGE_KEY];
        const next = normalizeBookmarkCascadeDebugMode(raw);
        setBookmarkCascadeDebugEnabled(next, { persist: false });
        if (raw !== next) {
          storageArea.set({ [BOOKMARK_CASCADE_DEBUG_STORAGE_KEY]: next });
        }
      });
    }
  }

  let lastDeletionAt = 0;
  let autocompleteState = null;
  let inlineSearchState = null;
  const imeKeyGuard = LumnoImeKeyGuard.createImeKeyGuard();
  const searchInputHistoryController =
    SEARCH_INPUT_HISTORY.createSearchInputHistoryController({
      storageArea: localStorageArea,
      storageChanges: chrome && chrome.storage ? chrome.storage.onChanged : null,
      storageAreaName: 'local'
    });
  let isApplyingSearchInputHistory = false;
  function isImeCompositionEvent(event) {
    return imeKeyGuard.shouldIgnoreKeydown(event);
  }
  let siteSearchState = null;
  let localSearchScopeState = null;
  let remoteSuggestionDebounceTimer = null;
  let tabs = [];
  let currentNewtabTabId = null;
  let siteSearchProvidersCache = null;
  let siteSearchProvidersLoadVersion = 0;
  let aggregateSearchesCache = null;
  let aggregateSearchesLoadPromise = null;
  let aggregateSearchesLoadVersion = 0;
  let suggestionRequestSeq = 0;
  let searchSuggestionsDismissed = false;
  let suggestionRequestWatchdogTimer = null;
  let searchResultPriorityMode = 'autocomplete';
  let enabledSearchResultSourceTypes = ['topSite', 'bookmark', 'history'];
  let searchResultDisplayLimit = 10;
  let openTabQuickSwitchEnabled = true;
  let searchInputRef = null;
  let faviconRequestBlacklistItems = [];
  let faviconEnhancedFetchEnabled = false;
  loadDefaultSearchEngineState();
  if (chrome && chrome.storage && chrome.storage.onChanged) {
    addStorageChangeListener((changes, areaName) => {
      if (!isPrimaryStorageAreaName(areaName)) {
        return;
      }
      if (changes[DEFAULT_SEARCH_ENGINE_STORAGE_KEY]) {
        const nextValue = changes[DEFAULT_SEARCH_ENGINE_STORAGE_KEY].newValue;
        if (nextValue && nextValue.id &&
            (!SEARCH_UTILS.isRetiredSearchEngineState(nextValue))) {
          defaultSearchEngineState = nextValue;
        }
      }
      if (changes[SEARCH_RESULT_PRIORITY_STORAGE_KEY]) {
        searchResultPriorityMode = normalizeSearchResultPriority(changes[SEARCH_RESULT_PRIORITY_STORAGE_KEY].newValue);
      }
      if (changes[SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY]) {
        enabledSearchResultSourceTypes = normalizeEnabledSearchResultSourceTypes(
          changes[SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY].newValue
        );
        if (localSearchScopeState &&
            !enabledSearchResultSourceTypes.includes(localSearchScopeState.sourceType)) {
          clearLocalSearchScope();
        }
      }
      if (changes[SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY]) {
        searchResultDisplayLimit = normalizeSearchResultDisplayLimit(
          changes[SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY].newValue
        );
        if (latestQuery) {
          renderSuggestions(lastSuggestionResponse, latestQuery);
        }
      }
      if (changes[NUMBER_SHORTCUT_INSTANT_ENABLED_STORAGE_KEY]) {
        numberShortcutInstantEnabled = normalizeNumberShortcutInstantEnabled(
          changes[NUMBER_SHORTCUT_INSTANT_ENABLED_STORAGE_KEY].newValue
        );
        SUGGESTION_NAVIGATION.cancelNumberShortcuts(suggestionsContainer);
      }
      if (changes[MACOS_CTRL_SUGGESTION_NAVIGATION_ENABLED_STORAGE_KEY]) {
        macosCtrlSuggestionNavigationEnabled = normalizeMacosCtrlSuggestionNavigationEnabled(
          changes[MACOS_CTRL_SUGGESTION_NAVIGATION_ENABLED_STORAGE_KEY].newValue
        );
      }
      if (changes[SIMPLE_MODE_ENABLED_STORAGE_KEY]) {
        simpleModeEnabled = normalizeSimpleModeEnabled(
          changes[SIMPLE_MODE_ENABLED_STORAGE_KEY].newValue
        );
        if (latestQuery) {
          renderSuggestions(lastSuggestionResponse, latestQuery);
        }
      }
      if (changes[OVERLAY_TAB_PRIORITY_STORAGE_KEY]) {
        openTabQuickSwitchEnabled = normalizeOverlayTabPriorityMode(changes[OVERLAY_TAB_PRIORITY_STORAGE_KEY].newValue);
        if (latestQuery) {
          requestSuggestions(latestQuery, { immediate: true });
        }
      }
      if (changes[SEARCH_BLACKLIST_STORAGE_KEY]) {
        searchBlacklistItems = normalizeSearchBlacklistItems(changes[SEARCH_BLACKLIST_STORAGE_KEY].newValue);
        markRecentDataDirty();
        scheduleRecentReloadIfVisible();
      }
      if (changes[FAVICON_REQUEST_BLACKLIST_STORAGE_KEY]) {
        faviconRequestBlacklistItems = normalizeFaviconRequestBlacklistItems(changes[FAVICON_REQUEST_BLACKLIST_STORAGE_KEY].newValue);
        markRecentDataDirty();
        scheduleRecentReloadIfVisible();
        scheduleBookmarkReloadIfVisible();
        if (typeof refreshThemeAwareFavicons === 'function') {
          refreshThemeAwareFavicons();
        }
      }
      if (changes[FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY]) {
        faviconEnhancedFetchEnabled = normalizeFaviconEnhancedFetchEnabled(
          changes[FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY].newValue
        );
        markRecentDataDirty();
        scheduleRecentReloadIfVisible();
        scheduleBookmarkReloadIfVisible();
        if (typeof refreshThemeAwareFavicons === 'function') {
          refreshThemeAwareFavicons();
        }
      }
      if (changes[FAVICON_REQUEST_BLACKLIST_STORAGE_KEY] || changes[FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY]) {
        shortcutFaviconPolicyRevision += 1;
        renderShortcuts();
        if (inputModeController) {
          if (siteSearchState) {
            setSiteSearchPrefix(siteSearchState, getImmediateThemeForSuggestion({ provider: siteSearchState }), { animate: false });
          }
          inputModeController.refreshModeMenu();
        }
      }
      if (latestQuery && latestQuery.trim() && (
        changes[DEFAULT_SEARCH_ENGINE_STORAGE_KEY] ||
        changes[SEARCH_RESULT_PRIORITY_STORAGE_KEY] ||
        changes[SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY] ||
        changes[SEARCH_BLACKLIST_STORAGE_KEY] ||
        changes[FAVICON_REQUEST_BLACKLIST_STORAGE_KEY] ||
        changes[FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY]
      )) {
        requestSuggestions(latestQuery, { immediate: true });
      }
    });
  }
  const AGGREGATE_SEARCH_STORAGE_KEY = SETTINGS.AGGREGATE_SEARCH_STORAGE_KEY ||
    AGGREGATE_SEARCH_STORE.STORAGE_KEY ||
    '_x_extension_aggregate_searches_2026_unique_';
  migrateStorageIfNeeded([
    THEME_STORAGE_KEY,
    LANGUAGE_STORAGE_KEY,
    RECENT_MODE_STORAGE_KEY,
    RECENT_COUNT_STORAGE_KEY,
    NEWTAB_WIDTH_MODE_STORAGE_KEY,
    NEWTAB_SEARCH_WIDTH_STORAGE_KEY,
    NEWTAB_INPUT_AUTO_FOCUS_ENABLED_STORAGE_KEY,
    NEWTAB_QUOTE_PREFS_STORAGE_KEY,
    NEWTAB_FEEDBACK_BUTTON_VISIBLE_STORAGE_KEY,
    NEWTAB_APPEARANCE_BUTTON_VISIBLE_STORAGE_KEY,
    NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY,
    NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY,
    NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY,
    NEWTAB_THEME_MODE_STORAGE_KEY,
    NEWTAB_THEME_SCOPE_STORAGE_KEY,
    NEWTAB_ZEN_MODE_STORAGE_KEY,
    NEWTAB_WALLPAPER_STORAGE_KEY,
    NEWTAB_WALLPAPER_OVERLAY_STORAGE_KEY,
    NEWTAB_WALLPAPER_EFFECT_STORAGE_KEY,
    NEWTAB_FAVICON_STORAGE_KEY,
    BOOKMARK_COUNT_STORAGE_KEY,
    BOOKMARK_COLUMNS_STORAGE_KEY,
    BOOKMARK_VIEW_MODE_STORAGE_KEY,
    BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY,
    BOOKMARK_CASCADE_DEBUG_STORAGE_KEY,
    TAB_RANK_SCORE_DEBUG_STORAGE_KEY,
    DEFAULT_SEARCH_ENGINE_STORAGE_KEY,
    SEARCH_RESULT_PRIORITY_STORAGE_KEY,
    SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY,
    SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY,
    SITE_SEARCH_STORAGE_KEY,
    SITE_SEARCH_DISABLED_STORAGE_KEY,
    AGGREGATE_SEARCH_STORAGE_KEY,
    SEARCH_BLACKLIST_STORAGE_KEY,
    FAVICON_REQUEST_BLACKLIST_STORAGE_KEY,
    FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY,
    PINNED_RECENT_SITES_STORAGE_KEY,
    HIDDEN_RECENT_SITES_STORAGE_KEY,
    ...NEWTAB_SHORTCUTS_STORAGE_KEYS,
    NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY,
    NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY,
    NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY,
    NEWTAB_SHORTCUT_WIDTH_STORAGE_KEY,
    NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY,
    NEWTAB_SHORTCUT_SIZE_STORAGE_KEY,
    NEWTAB_SHORTCUT_GAP_STORAGE_KEY
  ]);
  let handleTabKey = null;

  const faviconDataCache = new Map();
  const faviconDataPending = new Map();
  const faviconCacheRuntime = NEWTAB_FAVICON_CACHE.createFaviconCache({
    storageArea: (chrome && chrome.storage && chrome.storage.local) ? chrome.storage.local : null,
    windowObj: window,
    normalizeFaviconHost,
    isBlockedLocalFaviconUrl,
    isChromeMonogramFaviconUrl,
    faviconCacheBootWaitMs: FAVICON_CACHE_BOOT_WAIT_MS
  });

  function isFaviconPersistLoaded() {
    return faviconCacheRuntime.isFaviconPersistLoaded();
  }

  function isFaviconDataPersistLoaded() {
    return faviconCacheRuntime.isFaviconDataPersistLoaded();
  }

  function isSiteThemePersistLoaded() {
    return faviconCacheRuntime.isSiteThemePersistLoaded();
  }

  function waitForFaviconCachesOrTimeout(maxWaitMs) {
    return faviconCacheRuntime.waitForCachesOrTimeout(maxWaitMs);
  }

  function areFaviconRenderCachesReady() {
    return isFaviconPersistLoaded() && isFaviconDataPersistLoaded() && isSiteThemePersistLoaded();
  }

  function waitForFaviconRenderCaches(maxWaitMs) {
    if (areFaviconRenderCachesReady()) {
      return Promise.resolve();
    }
    return waitForFaviconCachesOrTimeout(maxWaitMs);
  }

  function isHostFaviconVisitDirty(hostname) {
    return faviconCacheRuntime.isHostVisitDirty(hostname);
  }

  function setPersistedFaviconUrl(cacheKey, url) {
    faviconCacheRuntime.setPersistedUrl(cacheKey, url);
  }

  function getPersistedFaviconEntry(cacheKey) {
    return faviconCacheRuntime.getPersistedEntry(cacheKey);
  }

  function getPersistedFaviconDataEntry(cacheKey) {
    return faviconCacheRuntime.getPersistedDataEntry(cacheKey);
  }

  function setPersistedFaviconData(cacheKey, dataUrl) {
    faviconCacheRuntime.setPersistedData(cacheKey, dataUrl);
  }

  function getPersistedSiteThemeEntry(hostKey) {
    return faviconCacheRuntime.getPersistedThemeEntry(hostKey);
  }

  function setPersistedSiteThemeEntry(hostKey, theme) {
    if (!theme || !isPersistableTheme(theme)) {
      return false;
    }
    const accentRgb = normalizeAccentRgb(theme.accentRgb || parseCssColor(theme.accent));
    if (!accentRgb) {
      return false;
    }
    return faviconCacheRuntime.setPersistedThemeEntry(hostKey, {
      accentRgb,
      source: getThemeSource(theme),
      neutral: isLowConfidenceTheme(theme) || theme._xThemeNeutral === true,
      confidence: normalizeThemeConfidence(theme._xThemeConfidence, accentRgb)
    });
  }

  const logNewtabFaviconDecision = FAVICON_UTILS.createFaviconDecisionLogger({ surface: 'newtab' });
  faviconViewRuntime = NEWTAB_FAVICON_VIEW.createFaviconViewRuntime({
    document,
    windowObj: window,
    chromeApi: chrome,
    getRiSvg,
    getExtensionFaviconUrl,
    getGstaticFaviconUrl,
    getChromeFaviconUrl,
    isOwnExtensionUrl,
    isBlockedLocalFaviconUrl,
    shouldBlockFaviconForHost,
    shouldAvoidDirectFaviconForHost,
    isEnhancedFaviconFetchEnabled: isNewtabEnhancedFaviconFetchEnabled,
    getStrictFaviconReason: getNewtabStrictFaviconReason,
    logFaviconDecision: logNewtabFaviconDecision,
    getHostFromUrl,
    isFaviconProxyUrl,
    isChromeMonogramFaviconUrl,
    getPersistedFaviconEntry,
    getPersistedFaviconDataEntry,
    setPersistedFaviconUrl,
    setPersistedFaviconData,
    preloadThemeFromFavicon,
    faviconDataCache,
    faviconDataPending,
    hasThemeForHost: (hostKey) => Boolean(hostKey && themeHostCache.has(hostKey))
  });
  const applyFaviconOpticalShift = faviconViewRuntime.applyFaviconOpticalShift;
  const applyFaviconOpticalAlignment = faviconViewRuntime.applyFaviconOpticalAlignment;
  const reportMissingIcon = faviconViewRuntime.reportMissingIcon;
  const applyFallbackIcon = faviconViewRuntime.applyFallbackIcon;
  const requestFaviconData = faviconViewRuntime.requestFaviconData;
  const setFaviconSrcWithAnimation = faviconViewRuntime.setFaviconSrcWithAnimation;
  const attachFaviconData = faviconViewRuntime.attachFaviconData;
  const preloadIcon = faviconViewRuntime.preloadIcon;
  const warmIconCache = faviconViewRuntime.warmIconCache;
  const attachFaviconWithFallbacks = faviconViewRuntime.attachFaviconWithFallbacks;
  const rescueThemeAwareFallbackFavicons = faviconViewRuntime.rescueThemeAwareFallbackFavicons;

  function isAllowedFaviconProxyRequestUrl(url) {
    return FAVICON_UTILS.isAllowedFaviconProxyRequestUrl(url);
  }

  function isBlockedLocalFaviconUrl(url) {
    const blockedByLocalRules = FAVICON_UTILS.isBlockedLocalFaviconUrl(url);
    return blockedByLocalRules ||
      (!isAllowedFaviconProxyRequestUrl(url) && isUrlBlockedByFaviconRequestBlacklist(url));
  }

  function isChromeMonogramFaviconUrl(url) {
    return FAVICON_UTILS.isChromeMonogramFaviconUrl(url);
  }

  function preloadThemeFromFavicon(url, dataUrl, hostOverride) {
    const cachedTheme = themeColorCache.get(url);
    if (!url || (cachedTheme && !cachedTheme._xIsDefault)) {
      return;
    }
    const hostKey = normalizeHost(hostOverride || getHostFromUrl(url));
    const useHostCache = hostKey && (Boolean(hostOverride) || !isFaviconProxyUrl(url));
    const cachedHostTheme = useHostCache ? themeHostCache.get(hostKey) : null;
    if (
      cachedHostTheme &&
      getThemeSourcePriority(getThemeSource(cachedHostTheme), cachedHostTheme) > getThemeSourcePriority('favicon')
    ) {
      return;
    }
    if (!dataUrl) {
      return;
    }
    const image = new Image();
    image.onload = function() {
      const avg = extractAverageColor(image);
      // Generic globes would otherwise become the whole host's theme.
      if (!avg || FAVICON_UTILS.isPlaceholderFaviconColor(avg)) {
        return;
      }
      const theme = buildThemeFromAccent(avg, 'favicon');
      themeColorCache.set(url, theme);
      if (useHostCache) {
        setResolvedThemeForHost(hostKey, theme, { iconUrl: url });
      }
    };
    image.onerror = function() {};
    image.src = dataUrl;
  }

  const FAVICON_PROXY_SIZE = 128;
  let pageFaviconUrlResolver = null;

  function getPageFaviconUrlResolver() {
    if (!pageFaviconUrlResolver) {
      pageFaviconUrlResolver = FAVICON_UTILS.createFaviconUrlResolver({
        chromeApi: chrome,
        size: FAVICON_PROXY_SIZE,
        shouldBlockFaviconForHost,
        shouldAvoidDirectFaviconForHost,
        isEnhancedFaviconFetchEnabled: isNewtabEnhancedFaviconFetchEnabled,
        getStrictFaviconReason: getNewtabStrictFaviconReason,
        logFaviconDecision: logNewtabFaviconDecision
      });
    }
    return pageFaviconUrlResolver;
  }

  function getThemeSourceForSuggestion(suggestion) {
    if (suggestion && suggestion.type === 'shortcut') {
      return getShortcutFaviconCandidateUrl(suggestion.url) || getShortcutFaviconDataUrl(suggestion.url);
    }
    if (suggestion && suggestion.provider) {
      const resolver = getPageFaviconUrlResolver();
      return resolver ? resolver.resolveFaviconSource(
        getProviderIcon(suggestion.provider), getProviderFaviconPageUrl(suggestion.provider)
      ) : '';
    }
    const resolver = getPageFaviconUrlResolver();
    return resolver
      ? resolver.resolveFaviconSource(suggestion && suggestion.favicon, suggestion && suggestion.url)
      : '';
  }

  const NEWTAB_PAGE_NAVIGATION = globalThis.LumnoNewtabPageNavigation;
  const {
    navigateToUrl,
    isMiddleClick,
    isBackgroundOpenEvent,
    getOpenDisposition,
    openExternalNewTabUrl,
    openUrlFromNewtabCard,
    openShortcutUrl,
    recordSearchSuggestionSelection,
    openBookmarkFolder,
    navigateToQuery
  } = NEWTAB_PAGE_NAVIGATION.createPageNavigation({
    NAVIGATION_DISPOSITION,
    getShortcutTileById,
    bookmarksRuntime,
    getShortcutFolderId: (...args) => getShortcutFolderId(...args),
    showToast,
    t,
    openBookmarkCascadeMenu,
    navigateBookmarkFolder: (...args) => navigateBookmarkFolder(...args),
    getDirectNavigationUrl: (...args) => getDirectNavigationUrl(...args),
    buildDefaultSearchUrl,
    pageState: {
      get numberShortcutInstantEnabled() {
        return numberShortcutInstantEnabled;
      },
      get latestRawQuery() {
        return latestRawQuery;
      },
      get inputParts() {
        return inputParts;
      }
    }
  });

  const pageStructureRuntime = NEWTAB_PAGE_STRUCTURE.createPageStructure({
    documentObj: document,
    getRiSvg
  });
  const suggestionsContainer = pageStructureRuntime.suggestions.container;
  suggestionsContainer.addEventListener('wheel', function(event) {
    SUGGESTION_NAVIGATION.preventNumberShortcutWheel(event, suggestionsContainer);
  }, { passive: false });
  document.addEventListener('pointerdown', function() {
    SUGGESTION_NAVIGATION.cancelNumberShortcuts(suggestionsContainer);
  }, true);
  const suggestionsSurface = pageStructureRuntime.suggestions.surface;
  const suggestionsOutline = pageStructureRuntime.suggestions.outline;
  const bookmarkSection = pageStructureRuntime.bookmark.section;
  const recentSection = pageStructureRuntime.recent.section;

  const NEWTAB_TOP_CONTENT_RUNTIME = globalThis.LumnoNewtabTopContentRuntime;
  const {
    captureTopContentLayout,
    captureRecentCardLayout,
    cancelTopContentLayoutAnimations,
    cancelRecentResizeLayoutAnimations,
    shouldSkipNewtabEntryMotion,
    shouldAnimateNewtabLayoutShift,
    animateTopContentLayout,
    animateRecentResizeLayout,
    applyNewtabTopContentVisibility,
    finishWordmarkEntryAnimation,
    applyWordmarkThemeAppearance,
    renderNewtabTopContent,
    setNewtabTopContentMode,
    setNewtabTimeFontWeight,
    setNewtabTimeSecondsVisible
  } = NEWTAB_TOP_CONTENT_RUNTIME.createTopContentRuntime({
    root,
    COMMUNITY_LINKS,
    bookmarkSection,
    recentSection,
    recentCards,
    SETTINGS,
    updateSearchEntryLayout,
    updateSuggestionsFloatingLayout,
    scheduleWallpaperAdaptiveToneUpdate,
    normalizeNewtabTopContentMode,
    normalizeNewtabTimeFontWeight,
    normalizeNewtabTimeSecondsVisible,
    pageState: {
      get topContentContainer() {
        return topContentContainer;
      },
      get shortcutSection() {
        return shortcutSection;
      },
      get updateNoticeController() {
        return updateNoticeController;
      },
      get engagementNoticeController() {
        return engagementNoticeController;
      },
      get newtabTopContentMode() {
        return newtabTopContentMode;
      },
      set newtabTopContentMode(value) {
        newtabTopContentMode = value;
      },
      get zenModeEnabled() {
        return zenModeEnabled;
      },
      get wordmarkImageEl() {
        return wordmarkImageEl;
      },
      set wordmarkImageEl(value) {
        wordmarkImageEl = value;
      },
      get topContentController() {
        return topContentController;
      },
      get newtabTimeFontWeight() {
        return newtabTimeFontWeight;
      },
      set newtabTimeFontWeight(value) {
        newtabTimeFontWeight = value;
      },
      get newtabTimeSecondsVisible() {
        return newtabTimeSecondsVisible;
      },
      set newtabTimeSecondsVisible(value) {
        newtabTimeSecondsVisible = value;
      },
      get wallpaperRuntime() {
        return wallpaperRuntime;
      }
    }
  });

  const NEWTAB_ENTRY_MOTION = globalThis.LumnoNewtabEntryMotion;
  const {
    finishNewtabEntryAnimation,
    scheduleNewtabReadyAfterViewportSettle,
    markNewtabReady
  } = NEWTAB_ENTRY_MOTION.createEntryMotion({
    root,
    shouldSkipNewtabEntryMotion,
    updateBookmarkSectionPosition,
    finishWordmarkEntryAnimation,
    markNewtabStartupMilestone,
    rememberSearchEntryViewport,
    getSearchEntryViewportSnapshot,
    hasSearchEntryViewportChanged,
    pageState: {
      get resolveNewtabEntryAnimationReady() {
        return resolveNewtabEntryAnimationReady;
      },
      set resolveNewtabEntryAnimationReady(value) {
        resolveNewtabEntryAnimationReady = value;
      },
      get newtabReadyRequested() {
        return newtabReadyRequested;
      },
      set newtabReadyRequested(value) {
        newtabReadyRequested = value;
      },
      get newtabReadyViewportRevision() {
        return newtabReadyViewportRevision;
      },
      get newtabResizeLayoutLocked() {
        return newtabResizeLayoutLocked;
      }
    }
  });

  searchLayer = pageStructureRuntime.searchLayer;
  const topActionTooltipController = globalThis.LumnoTooltip.createController({
    documentObj: document,
    windowObj: window,
    id: '_x_extension_newtab_top_action_tooltip_2026_unique_',
    appendTo: document.body,
    maxWidth: 420
  });
  const shortcutTooltipController = globalThis.LumnoTooltip.createController({
    documentObj: document,
    windowObj: window,
    id: '_x_extension_newtab_shortcut_tooltip_2026_unique_',
    className: 'x-nt-shortcut-tooltip',
    appendTo: document.body,
    maxWidth: 360
  });
  const shortcutDialogTooltipController = globalThis.LumnoTooltip.createController({
    documentObj: document,
    windowObj: window,
    id: '_x_extension_newtab_shortcut_dialog_tooltip_2026_unique_',
    className: 'x-nt-shortcut-dialog-tooltip',
    appendTo: document.body,
    maxWidth: 320
  });
  const bookmarkCascadeCopyTooltipController = globalThis.LumnoTooltip.createController({
    documentObj: document,
    windowObj: window,
    id: '_x_extension_newtab_bookmark_cascade_copy_tooltip_2026_unique_',
    className: 'x-nt-bookmark-cascade-copy-tooltip',
    appendTo: document.body,
    maxWidth: 200
  });
  const bookmarkCursorTooltipController = globalThis.LumnoCursorTooltip.createController({
    documentObj: document,
    windowObj: window,
    id: '_x_extension_newtab_bookmark_cursor_tooltip_2026_unique_',
    className: 'x-nt-bookmark-cursor-tooltip',
    appendTo: document.body,
    maxWidth: 460,
    offsetX: 14,
    offsetY: 16
  });
  const searchInputCursorTooltipController = globalThis.LumnoCursorTooltip.createController({
    documentObj: document,
    windowObj: window,
    id: '_x_extension_newtab_search_input_cursor_tooltip_2026_unique_',
    appendTo: document.body,
    maxWidth: 520,
    offsetX: 14,
    offsetY: 16
  });
  markNewtabStartupMilestone('page-structure-created');

  const NEWTAB_TOOLTIP_BINDINGS = globalThis.LumnoNewtabTooltipBindings;
  const {
    showTopActionTooltip,
    hideTopActionTooltip,
    bindSearchInputCursorTooltip,
    hideSearchInputCursorTooltip,
    bindShortcutTooltip,
    hideShortcutTooltip,
    bindShortcutDialogTooltip,
    hideShortcutDialogTooltip,
    bindCursorTooltip,
    hideCursorTooltip
  } = NEWTAB_TOOLTIP_BINDINGS.createTooltipBindings({
    topActionTooltipController,
    searchInputCursorTooltipController,
    shortcutTooltipController,
    t,
    isShortcutDragActive: (...args) => isShortcutDragActive(...args),
    isBookmarkDragActive: (...args) => isBookmarkDragActive(...args),
    isShortcutContextMenuOpen,
    shortcutDialogTooltipController,
    bookmarkCursorTooltipController,
    shouldSuppressBookmarkHover: (...args) => shouldSuppressBookmarkHover(...args),
    pageState: {
      get inputParts() {
        return inputParts;
      },
      get newtabShortcutDockMagnificationEnabled() {
        return newtabShortcutDockMagnificationEnabled;
      },
      get shortcutGrid() {
        return shortcutGrid;
      }
    }
  });

  const NEWTAB_SECTION_HEADERS = globalThis.LumnoNewtabSectionHeaders;
  const {
    updateRecentHeading,
    updateRecentModeMenu,
    setRecentMode,
    canDismissRecentCard,
    updateBookmarkHeading,
    isBookmarkTopbarMode,
    getNewtabTopOccupiedInsetPx,
    getNewtabViewportTopPaddingPx,
    getBookmarkCascadeViewportTopPaddingPx,
    setNewtabTopOccupied,
    syncBookmarkSurfaceMode,
    setBookmarkSurfaceVisible,
    updateBookmarkModeMenu,
    applyBookmarkViewMode,
    setBookmarkViewMode,
    navigateBookmarkFolder,
    updateBookmarkPagerLabels,
    bindBookmarkPagerTooltip,
    updateBookmarkBreadcrumb
  } = NEWTAB_SECTION_HEADERS.createSectionHeaders({
    t,
    normalizeRecentMode,
    storageArea,
    RECENT_MODE_STORAGE_KEY,
    markRecentDataDirty: (...args) => markRecentDataDirty(...args),
    loadRecentSites: (...args) => loadRecentSites(...args),
    getNewtabVisualViewportInsets,
    BOOKMARK_TOPBAR_HEIGHT_PX,
    updateSearchEntryLayout,
    setContentSectionVisible,
    bookmarkSection,
    bookmarkCards,
    normalizeBookmarkViewMode,
    markBookmarkDataDirty: (...args) => markBookmarkDataDirty(...args),
    loadBookmarks: (...args) => loadBookmarks(...args),
    closeBookmarkCascadeMenu,
    persistBookmarkViewMode,
    showTopActionTooltip,
    hideTopActionTooltip,
    pageState: {
      get recentHeading() {
        return recentHeading;
      },
      get currentRecentMode() {
        return currentRecentMode;
      },
      set currentRecentMode(value) {
        currentRecentMode = value;
      },
      get recentModeMenu() {
        return recentModeMenu;
      },
      get bookmarkHeading() {
        return bookmarkHeading;
      },
      get currentBookmarkViewMode() {
        return currentBookmarkViewMode;
      },
      set currentBookmarkViewMode(value) {
        currentBookmarkViewMode = value;
      },
      get bookmarkCascadeRuntime() {
        return bookmarkCascadeRuntime;
      },
      get bookmarkTopbarRuntime() {
        return bookmarkTopbarRuntime;
      },
      get currentBookmarkCount() {
        return currentBookmarkCount;
      },
      get zenModeEnabled() {
        return zenModeEnabled;
      },
      get bookmarkModeMenu() {
        return bookmarkModeMenu;
      },
      get bookmarkGrid() {
        return bookmarkGrid;
      },
      get bookmarkViewModeRevision() {
        return bookmarkViewModeRevision;
      },
      set bookmarkViewModeRevision(value) {
        bookmarkViewModeRevision = value;
      },
      get bookmarkLoadedOnce() {
        return bookmarkLoadedOnce;
      },
      get bookmarkCurrentPage() {
        return bookmarkCurrentPage;
      },
      set bookmarkCurrentPage(value) {
        bookmarkCurrentPage = value;
      },
      get bookmarkRenderSignature() {
        return bookmarkRenderSignature;
      },
      set bookmarkRenderSignature(value) {
        bookmarkRenderSignature = value;
      },
      get bookmarkCurrentFolderId() {
        return bookmarkCurrentFolderId;
      },
      set bookmarkCurrentFolderId(value) {
        bookmarkCurrentFolderId = value;
      },
      get bookmarkRootFolderId() {
        return bookmarkRootFolderId;
      },
      get bookmarkPagerPrevButton() {
        return bookmarkPagerPrevButton;
      },
      get bookmarkPagerNextButton() {
        return bookmarkPagerNextButton;
      },
      get bookmarkOpenManagerButton() {
        return bookmarkOpenManagerButton;
      },
      get bookmarkBreadcrumbController() {
        return bookmarkBreadcrumbController;
      },
      get bookmarkFolderPath() {
        return bookmarkFolderPath;
      }
    }
  });

  const NEWTAB_SHORTCUTS_CONTROLLER = globalThis.LumnoNewtabShortcutsController;
  const {
    getShortcutFolderId,
    getVisibleShortcuts,
    refreshShortcutFolderReferences,
    getShortcutStoreOptions,
    isShortcutSyncStorageActive,
    scheduleShortcutStorageReload,
    getShortcutIconDataUrl,
    getShortcutFaviconDataUrl,
    getShortcutFaviconCandidateUrl,
    getShortcutTitle,
    renderShortcuts,
    loadNewtabShortcutPreferences,
    loadVisibleShortcuts,
    persistShortcuts,
    removeShortcutById,
    hasShortcutForSite,
    addSiteToShortcuts,
    hideShortcutAddFromContextMenu,
    createShortcutsSection,
    createShortcutDialogComponent
  } = NEWTAB_SHORTCUTS_CONTROLLER.createShortcutsController({
    shortcutFolderRuntime,
    bookmarksRuntime,
    isShortcutDragActive: (...args) => isShortcutDragActive(...args),
    NEWTAB_SHORTCUTS_STORAGE_KEY,
    MAX_NEWTAB_SHORTCUTS,
    normalizeHost,
    sanitizeDisplayText,
    providerStorageRuntime,
    storageAreaName,
    NEWTAB_SHORTCUTS_STORE,
    NEWTAB_SHORTCUTS_STORAGE_KEYS,
    NEWTAB_SHORTCUTS_CRITICAL_SYNC_RESERVE_BYTES,
    NEWTAB_SHORTCUTS_LOCAL_OVERFLOW_STORAGE_KEY,
    shortcutIconStore,
    SHORTCUT_FAVICON,
    getPageFaviconUrlResolver,
    SEARCH_UTILS,
    getExtensionResourceUrl,
    sendRuntimeMessage,
    shortcutFaviconStore,
    faviconCacheRuntime,
    FAVICON_UTILS,
    getPersistedFaviconDataEntry,
    t,
    hideShortcutTooltip,
    closeShortcutContextMenu,
    syncOpenBookmarkCascadeAnchorVisual: (...args) => syncOpenBookmarkCascadeAnchorVisual(...args),
    applyNewtabShortcutsVisibility,
    updateShortcutLanguageStrings,
    updateBookmarkSectionPosition,
    storageArea,
    NEWTAB_SHORTCUT_ICON_STORE,
    NEWTAB_SHORTCUT_COLUMNS_DEFAULT,
    NEWTAB_SHORTCUT_SIZE_DEFAULT,
    NEWTAB_SHORTCUT_GAP_DEFAULT,
    applyNewtabShortcutLayoutPreferences,
    applyNewtabShortcutDockMagnification,
    updateNewtabShortcutPreferencesUi,
    NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY,
    NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY,
    NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY,
    NEWTAB_SHORTCUT_WIDTH_STORAGE_KEY,
    NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY,
    NEWTAB_SHORTCUT_SIZE_STORAGE_KEY,
    NEWTAB_SHORTCUT_GAP_STORAGE_KEY,
    normalizeNewtabShortcutsVisible,
    normalizeNewtabShortcutAddVisible,
    normalizeNewtabShortcutDockMagnificationEnabled,
    inferNewtabShortcutColumnsFromWidth,
    normalizeNewtabShortcutColumns,
    normalizeNewtabShortcutSize,
    normalizeNewtabShortcutGap,
    loadFolderColors,
    showToast,
    formatMessage,
    getShortcutById,
    SHORTCUT_DIALOG_MODE_EDIT,
    SHORTCUT_DIALOG_ITEM_FOLDER,
    markBookmarkTreeDirty: (...args) => markBookmarkTreeDirty(...args),
    loadBookmarks: (...args) => loadBookmarks(...args),
    refreshOpenBookmarkCascadeMenu: (...args) => refreshOpenBookmarkCascadeMenu(...args),
    NEWTAB_BOOKMARK_MOVE_HISTORY,
    bookmarkMoveHistory,
    getBookmarkUndoShortcutLabel: (...args) => getBookmarkUndoShortcutLabel(...args),
    resetShortcutDockHover,
    scheduleWallpaperAdaptiveToneUpdate,
    pageStructureRuntime,
    NEWTAB_SHORTCUTS_VIEW,
    shortcutTiles,
    getFigmaFolderSvg,
    initFolderPathMorph,
    playFolderPathMorph,
    getHostFromUrl,
    getImmediateThemeForSuggestion,
    applyShortcutTileTheme,
    queueThemeForTarget,
    attachFaviconWithFallbacks,
    bindShortcutTooltip,
    isMiddleClick,
    openShortcutUrl,
    handleShortcutContextMenu,
    handleShortcutNativeDragStart,
    getRiSvg,
    openShortcutDialog,
    openShortcutAddContextMenu,
    handleShortcutDragPointerDown: (...args) => handleShortcutDragPointerDown(...args),
    handleShortcutDockPointerOver,
    handleShortcutDockPointerMove,
    NEWTAB_SHORTCUT_DIALOG,
    bindShortcutDialogTooltip,
    hideShortcutDialogTooltip,
    SHORTCUT_DIALOG_ITEM_BOOKMARK,
    pageState: {
      get newtabShortcuts() {
        return newtabShortcuts;
      },
      set newtabShortcuts(value) {
        newtabShortcuts = value;
      },
      get bookmarkMoveHistoryBusy() {
        return bookmarkMoveHistoryBusy;
      },
      set bookmarkMoveHistoryBusy(value) {
        bookmarkMoveHistoryBusy = value;
      },
      get newtabShortcutIcons() {
        return newtabShortcutIcons;
      },
      set newtabShortcutIcons(value) {
        newtabShortcutIcons = value;
      },
      get newtabShortcutFavicons() {
        return newtabShortcutFavicons;
      },
      set newtabShortcutFavicons(value) {
        newtabShortcutFavicons = value;
      },
      get shortcutFaviconPolicyRevision() {
        return shortcutFaviconPolicyRevision;
      },
      get shortcutFaviconPendingCacheEntries() {
        return shortcutFaviconPendingCacheEntries;
      },
      set shortcutFaviconPendingCacheEntries(value) {
        shortcutFaviconPendingCacheEntries = value;
      },
      get shortcutDialogController() {
        return shortcutDialogController;
      },
      get shortcutGrid() {
        return shortcutGrid;
      },
      set shortcutGrid(value) {
        shortcutGrid = value;
      },
      get addShortcutButton() {
        return addShortcutButton;
      },
      set addShortcutButton(value) {
        addShortcutButton = value;
      },
      get shortcutSection() {
        return shortcutSection;
      },
      set shortcutSection(value) {
        shortcutSection = value;
      },
      get newtabShortcutsVisible() {
        return newtabShortcutsVisible;
      },
      set newtabShortcutsVisible(value) {
        newtabShortcutsVisible = value;
      },
      get newtabShortcutAddVisible() {
        return newtabShortcutAddVisible;
      },
      set newtabShortcutAddVisible(value) {
        newtabShortcutAddVisible = value;
      },
      get newtabShortcutDockMagnificationEnabled() {
        return newtabShortcutDockMagnificationEnabled;
      },
      set newtabShortcutDockMagnificationEnabled(value) {
        newtabShortcutDockMagnificationEnabled = value;
      },
      get newtabShortcutColumns() {
        return newtabShortcutColumns;
      },
      set newtabShortcutColumns(value) {
        newtabShortcutColumns = value;
      },
      get newtabShortcutSize() {
        return newtabShortcutSize;
      },
      set newtabShortcutSize(value) {
        newtabShortcutSize = value;
      },
      get newtabShortcutGap() {
        return newtabShortcutGap;
      },
      set newtabShortcutGap(value) {
        newtabShortcutGap = value;
      },
      get shortcutPersistenceInFlightCount() {
        return shortcutPersistenceInFlightCount;
      },
      set shortcutPersistenceInFlightCount(value) {
        shortcutPersistenceInFlightCount = value;
      },
      get bookmarkCascadeRuntime() {
        return bookmarkCascadeRuntime;
      }
    }
  });

  const NEWTAB_BOOKMARK_DRAG_CONTROLLER = globalThis.LumnoNewtabBookmarkDragController;
  const {
    queueBookmarkLayoutAnimation,
    playPendingBookmarkLayoutAnimation,
    updateBookmarkDragLayoutCache,
    setBookmarkDragCardTransform,
    isEmptyBookmarkRootHidden,
    getExternalBookmarkSurfacePoint,
    isValidExternalBookmarkDropTarget,
    getShortcutFolderDropTargetAt,
    getExternalBookmarkDropTarget,
    isPointOverShortcutDropSurface,
    applyBookmarkShortcutTransfer,
    clearDragDropTarget,
    isBookmarkCascadeSurfaceAtPoint,
    setDragDropTarget,
    getBookmarkDragPageSwitchDirection,
    clearBookmarkDragPageSwitch,
    clearBookmarkDragFolderSwitch,
    scheduleBookmarkDragFolderSwitch,
    scheduleBookmarkDragPageSwitch,
    scheduleBookmarkDragMove,
    deleteBookmarkFromContextTarget,
    getBookmarkUndoShortcutLabel,
    refreshOpenBookmarkCascadeMenu,
    syncOpenBookmarkCascadeAnchorVisual,
    performBookmarkMoveHistoryAction,
    isBookmarkDragActive,
    shouldSuppressBookmarkHover,
    finishBookmarkDrag,
    handleBookmarkDragPointerDown,
    handleBookmarkCascadeItemPointerDown
  } = NEWTAB_BOOKMARK_DRAG_CONTROLLER.createBookmarkDragController({
    isBookmarkTopbarMode,
    getBookmarkLimit,
    NEWTAB_BOOKMARK_DRAG,
    getFigmaFolderSvg,
    initFolderPathMorph,
    setFolderPathMorphState,
    isContentSectionVisible,
    bookmarkSection,
    bookmarksRuntime,
    NEWTAB_CROSS_SURFACE_DRAG,
    NEWTAB_BOOKMARK_MOVE_HISTORY,
    getShortcutById,
    getShortcutFolderId,
    getShortcutReorderTiles,
    getShortcutTileLayoutRect: (...args) => getShortcutTileLayoutRect(...args),
    NEWTAB_SHORTCUTS_STORE,
    getShortcutStoreOptions,
    getShortcutInsertionSlotAt: (...args) => getShortcutInsertionSlotAt(...args),
    MAX_NEWTAB_SHORTCUTS,
    getShortcutTileId,
    FOLDER_REFERENCES,
    bookmarkMoveHistory,
    showToast,
    t,
    refreshShortcutFolderReferences,
    shortcutFolderRuntime,
    persistShortcuts,
    markBookmarkTreeDirty: (...args) => markBookmarkTreeDirty(...args),
    loadBookmarks: (...args) => loadBookmarks(...args),
    getBookmarkPageCount: (...args) => getBookmarkPageCount(...args),
    isBookmarkSurfaceDragStateActive: (...args) => isBookmarkSurfaceDragStateActive(...args),
    openBookmarkCascadeMenu,
    navigateBookmarkFolder,
    switchBookmarkPageDuringDrag: (...args) => switchBookmarkPageDuringDrag(...args),
    setShortcutDragTileTransform: (...args) => setShortcutDragTileTransform(...args),
    scheduleWallpaperAdaptiveToneUpdate,
    formatMessage,
    isShortcutDragActive: (...args) => isShortcutDragActive(...args),
    hideCursorTooltip,
    isEditableElement: (...args) => isEditableElement(...args),
    closeBookmarkCascadeMenu,
    suppressCanceledDragClick: (...args) => suppressCanceledDragClick(...args),
    renderCurrentBookmarkPage: (...args) => renderCurrentBookmarkPage(...args),
    closeBookmarkContextMenu,
    pageState: {
      get bookmarkGrid() {
        return bookmarkGrid;
      },
      get bookmarkAllItems() {
        return bookmarkAllItems;
      },
      set bookmarkAllItems(value) {
        bookmarkAllItems = value;
      },
      get bookmarkCurrentPage() {
        return bookmarkCurrentPage;
      },
      get bookmarkCurrentFolderId() {
        return bookmarkCurrentFolderId;
      },
      get currentBookmarkCount() {
        return currentBookmarkCount;
      },
      get bookmarkTopbarRuntime() {
        return bookmarkTopbarRuntime;
      },
      get bookmarkLoadedOnce() {
        return bookmarkLoadedOnce;
      },
      get bookmarkRootFolderId() {
        return bookmarkRootFolderId;
      },
      get shortcutDragState() {
        return shortcutDragState;
      },
      get bookmarkCascadeRuntime() {
        return bookmarkCascadeRuntime;
      },
      get shortcutGrid() {
        return shortcutGrid;
      },
      get shortcutSection() {
        return shortcutSection;
      },
      get newtabShortcuts() {
        return newtabShortcuts;
      },
      get addShortcutButton() {
        return addShortcutButton;
      },
      get bookmarkMoveHistoryBusy() {
        return bookmarkMoveHistoryBusy;
      },
      set bookmarkMoveHistoryBusy(value) {
        bookmarkMoveHistoryBusy = value;
      },
      get newtabShortcutIcons() {
        return newtabShortcutIcons;
      },
      get bookmarkPagerPrevButton() {
        return bookmarkPagerPrevButton;
      },
      get bookmarkPagerNextButton() {
        return bookmarkPagerNextButton;
      },
      get currentBookmarkViewMode() {
        return currentBookmarkViewMode;
      },
      get bookmarkDragState() {
        return bookmarkDragState;
      },
      set bookmarkDragState(value) {
        bookmarkDragState = value;
      },
      get bookmarkPageAnimating() {
        return bookmarkPageAnimating;
      }
    }
  });

  function getSectionModeSelectOptions(config) {
    const rawOptions = config && typeof config.getOptions === 'function'
      ? config.getOptions()
      : (config && config.options);
    const options = Array.isArray(rawOptions) ? rawOptions : [];
    return options.map((item) => {
      const value = String(item && item.value !== undefined ? item.value : '');
      const option = {
        value,
        label: t(item && item.labelKey, (item && item.fallback) || value)
      };
      if (item && item.action) {
        option.action = String(item.action);
      }
      if (item && item.iconClass) {
        option.iconClass = String(item.iconClass);
      }
      if (item && item.dividerBefore) {
        option.dividerBefore = true;
      }
      if (item && item.groupTitleKey) {
        option.groupTitle = t(item.groupTitleKey, item.groupTitleFallback || '');
      }
      if (item && item.radio) {
        option.radio = true;
        option.checked = item.checked === true;
      }
      if (item && item.trailingIconClass) {
        option.trailingIconClass = String(item.trailingIconClass);
      }
      return option;
    });
  }

  function getBookmarkViewModeOptions() {
    const effectiveSurfaceMode = getEffectiveBookmarkTopbarSurfaceMode();
    const options = [
      {
        value: 'folder',
        labelKey: 'bookmark_view_mode_folder',
        fallback: 'Multi-layer folder view'
      },
      {
        value: 'list',
        labelKey: 'bookmark_view_mode_list',
        fallback: 'Multi-level list view'
      },
      {
        value: 'top',
        labelKey: 'bookmark_view_mode_top',
        fallback: 'Top bookmarks bar'
      }
    ];
    if (!isBookmarkTopbarMode()) {
      return options;
    }
    options.push({
      value: '__bookmark_topbar_surface_adaptive__',
      action: `${BOOKMARK_TOPBAR_SURFACE_MODE_ACTION}:adaptive`,
      labelKey: 'bookmark_topbar_surface_adaptive',
      fallback: 'Adaptive mist',
      radio: true,
      checked: effectiveSurfaceMode === 'adaptive',
      dividerBefore: true,
      groupTitleKey: 'bookmark_topbar_surface_title',
      groupTitleFallback: 'Bar background'
    });
    options.push({
      value: '__bookmark_topbar_surface_clear__',
      action: `${BOOKMARK_TOPBAR_SURFACE_MODE_ACTION}:clear`,
      labelKey: 'bookmark_topbar_surface_clear',
      fallback: 'Clear glass',
      radio: true,
      checked: effectiveSurfaceMode === 'clear'
    });
    options.push({
      value: '__bookmark_topbar_surface_transparent__',
      action: `${BOOKMARK_TOPBAR_SURFACE_MODE_ACTION}:transparent`,
      labelKey: 'bookmark_topbar_surface_transparent',
      fallback: 'Transparent',
      radio: true,
      checked: effectiveSurfaceMode === 'transparent'
    });
    options.push({
      value: '__pick_bookmark_topbar_color__',
      action: BOOKMARK_TOPBAR_PICK_COLOR_ACTION,
      labelKey: 'bookmark_topbar_surface_custom',
      fallback: 'Custom color',
      radio: true,
      trailingIconClass: 'ri-dropper-line',
      checked: effectiveSurfaceMode === 'custom'
    });
    return options;
  }

  function createSectionModeSelect(config) {
    if (!sectionModeSelectController || typeof sectionModeSelectController.createSelect !== 'function') {
      return null;
    }
    const currentValue = typeof config.getValue === 'function' ? config.getValue() : '';
    const title = t(config.menuTitleKey, config.menuTitleFallback || 'Display mode');
    const created = sectionModeSelectController.createSelect({
      id: config.id,
      selectId: config.id ? `${config.id}_select` : '',
      className: 'x-nt-section-mode-select',
      iconOnly: true,
      triggerIconClass: 'ri-more-line',
      menuClassName: 'x-nt-section-mode-portal',
      menuAlign: 'left',
      menuWidth: 'content',
      menuMinWidth: SECTION_MODE_MENU_MIN_WIDTH_PX,
      menuMaxWidth: SECTION_MODE_MENU_MAX_WIDTH_PX,
      menuPortal: true,
      menuPortalZIndex: SECTION_MODE_MENU_PORTAL_Z_INDEX,
      menuPortalOffset: SECTION_MODE_MENU_PORTAL_OFFSET_PX,
      menuTitle: title,
      value: currentValue,
      ariaLabel: title,
      tooltip: title,
      onAction: typeof config.onAction === 'function'
        ? ({ action }) => config.onAction(action)
        : null,
      options: getSectionModeSelectOptions(config)
    });
    const control = created.wrapper;
    const select = created.select;
    const trigger = created.trigger;
    if (!control || !select || !trigger) {
      return null;
    }
    const api = {
      control,
      select,
      trigger,
      update: () => {
        const nextTitle = t(config.menuTitleKey, config.menuTitleFallback || 'Display mode');
        const nextValue = typeof config.getValue === 'function' ? config.getValue() : '';
        if (typeof sectionModeSelectController.setMenuTitle === 'function') {
          sectionModeSelectController.setMenuTitle(control, nextTitle);
        }
        sectionModeSelectController.setOptions(control, getSectionModeSelectOptions(config), nextValue);
        trigger.setAttribute('aria-label', nextTitle);
        trigger.setAttribute('data-tooltip', nextTitle);
      }
    };
    select.addEventListener('change', () => {
      const nextMode = String(select.value || '');
      if (typeof config.onChange === 'function') {
        config.onChange(nextMode);
      }
    });
    const showButtonTooltip = () => {
      if (sectionModeSelectController.isOpen(control)) {
        return;
      }
      const placement = trigger.closest &&
        trigger.closest('.x-nt-bookmarks-topbar')
        ? 'bottom'
        : 'top';
      showTopActionTooltip(
        trigger,
        trigger.getAttribute('data-tooltip') || t('display_mode_title', 'Display mode'),
        { placement }
      );
    };
    trigger.addEventListener('mouseenter', showButtonTooltip);
    trigger.addEventListener('mouseleave', hideTopActionTooltip);
    trigger.addEventListener('focus', showButtonTooltip);
    trigger.addEventListener('blur', hideTopActionTooltip);
    api.update();
    return api;
  }

  function setContentSectionVisible(section, visible) {
    if (!section) {
      return;
    }
    section.setAttribute('data-content-visible', visible ? 'true' : 'false');
    section.setAttribute('data-visible', visible && !zenModeEnabled ? 'true' : 'false');
    if (section === recentSection && (!visible || zenModeEnabled)) {
      closeRecentContextMenu();
    }
    scheduleWallpaperAdaptiveToneUpdate();
  }

  function isContentSectionVisible(section) {
    return Boolean(section && section.getAttribute('data-visible') === 'true');
  }

  function applyNewtabShortcutLayoutPreferences() {
    if (!document.documentElement || !document.documentElement.style) {
      return;
    }
    const rootStyle = document.documentElement.style;
    const size = normalizeNewtabShortcutSize(newtabShortcutSize);
    const gap = normalizeNewtabShortcutGap(newtabShortcutGap);
    rootStyle.setProperty('--x-nt-shortcut-user-tile-size', `${size}px`);
    rootStyle.setProperty('--x-nt-shortcut-user-icon-size', `${size * 0.75}px`);
    rootStyle.setProperty('--x-nt-shortcut-user-icon-radius', `${size * 0.25}px`);
    rootStyle.setProperty('--x-nt-shortcut-user-favicon-size', `${size * 0.4375}px`);
    rootStyle.setProperty('--x-nt-shortcut-user-tile-padding', `${size * 0.125}px`);
    rootStyle.setProperty('--x-nt-shortcut-user-column-gap', `${gap}px`);
    rootStyle.setProperty('--x-nt-shortcut-user-row-gap', `${gap + 6}px`);
    applyNewtabShortcutColumns();
  }

  function applyNewtabShortcutColumns() {
    if (!document.documentElement || !document.documentElement.style) {
      return;
    }
    document.documentElement.style.setProperty(
      '--x-nt-shortcut-columns',
      String(newtabShortcutColumns)
    );
    if (!shortcutGrid || typeof window.getComputedStyle !== 'function') {
      return;
    }
    const gridStyle = window.getComputedStyle(shortcutGrid);
    const tileSize = Number.parseFloat(
      gridStyle.getPropertyValue('--x-nt-shortcut-tile-size')
    );
    const columnGap = Number.parseFloat(gridStyle.columnGap);
    const paddingLeft = Number.parseFloat(gridStyle.paddingLeft);
    const paddingRight = Number.parseFloat(gridStyle.paddingRight);
    if (![tileSize, columnGap, paddingLeft, paddingRight].every(Number.isFinite)) {
      return;
    }
    const targetWidth =
      (tileSize * newtabShortcutColumns) +
      (columnGap * Math.max(0, newtabShortcutColumns - 1)) +
      paddingLeft +
      paddingRight;
    document.documentElement.style.setProperty(
      '--x-nt-shortcuts-target-width',
      `${Math.round(targetWidth)}px`
    );
  }

  function applyNewtabShortcutsVisibility() {
    if (!shortcutSection) {
      return;
    }
    const hasVisibleContent = getVisibleShortcuts().length > 0 ||
      (newtabShortcutAddVisible && newtabShortcuts.length < MAX_NEWTAB_SHORTCUTS);
    setContentSectionVisible(
      shortcutSection,
      Boolean(newtabShortcutsVisible && hasVisibleContent)
    );
    if (!newtabShortcutsVisible || !hasVisibleContent || zenModeEnabled) {
      resetShortcutDockHover();
      closeShortcutContextMenu();
      closeShortcutDialog();
    }
  }

  function updateShortcutDialogLanguageStrings() {
    if (shortcutDialogController) {
      shortcutDialogController.updateLanguage();
    }
  }

  function getShortcutContextMenuOptions(target) {
    if (target && target.kind === 'add') {
      return [
        {
          value: SHORTCUT_CONTEXT_MENU_HIDE_ADD_VALUE,
          label: t('newtab_shortcuts_hide_add', 'Hide')
        }
      ];
    }
    const shortcut = target && getShortcutById(target.shortcutId);
    if (shortcut && shortcut.type === 'folder') {
      return [
        { action: NEWTAB_CONTEXT_MENU_OPEN_VALUE, value: NEWTAB_CONTEXT_MENU_OPEN_VALUE,
          label: t('newtab_shortcuts_open_folder', 'Open folder') },
        { action: SHORTCUT_CONTEXT_MENU_EDIT_VALUE, value: SHORTCUT_CONTEXT_MENU_EDIT_VALUE,
          label: t('folder_rename', 'Rename'), dividerBefore: true },
        { action: FOLDER_COLOR_CONTEXT_MENU_VALUE, value: FOLDER_COLOR_CONTEXT_MENU_VALUE,
          label: t('folder_color_change', 'Change color') },
        { action: SHORTCUT_CONTEXT_MENU_REMOVE_VALUE, value: SHORTCUT_CONTEXT_MENU_REMOVE_VALUE,
          label: t('shortcuts_remove', 'Remove') }
      ];
    }
    return [
      {
        action: NEWTAB_CONTEXT_MENU_OPEN_VALUE,
        value: NEWTAB_CONTEXT_MENU_OPEN_VALUE,
        label: t('newtab_open_in_new_tab', 'Open in new tab')
      },
      {
        action: SHORTCUT_CONTEXT_MENU_EDIT_VALUE,
        value: SHORTCUT_CONTEXT_MENU_EDIT_VALUE,
        label: t('shortcuts_edit', 'Edit'),
        dividerBefore: true
      },
      {
        action: SHORTCUT_CONTEXT_MENU_REMOVE_VALUE,
        value: SHORTCUT_CONTEXT_MENU_REMOVE_VALUE,
        label: t('shortcuts_remove', 'Remove')
      }
    ];
  }

  function updateShortcutContextMenuLanguageStrings() {
    if (!shortcutContextMenu || !shortcutContextMenuSelectController) {
      return;
    }
    const label = t('newtab_shortcuts_context_menu_label', 'Shortcut actions');
    if (shortcutContextMenu.trigger) {
      shortcutContextMenu.trigger.setAttribute('aria-label', label);
    }
    if (typeof shortcutContextMenuSelectController.setOptions === 'function') {
      shortcutContextMenuSelectController.setOptions(
        shortcutContextMenu.control,
        getShortcutContextMenuOptions(shortcutContextMenuTarget),
        shortcutContextMenuTarget && shortcutContextMenuTarget.kind === 'add'
          ? SHORTCUT_CONTEXT_MENU_HIDE_ADD_VALUE
          : NEWTAB_CONTEXT_MENU_OPEN_VALUE
      );
    }
  }

  function updateBookmarkContextMenuLanguageStrings() {
    if (!bookmarkContextMenu || !bookmarkContextMenuSelectController) {
      return;
    }
    if (bookmarkContextMenu.trigger) {
      bookmarkContextMenu.trigger.setAttribute(
        'aria-label',
        t('bookmarks_context_menu_label', 'Bookmark actions')
      );
    }
    if (typeof bookmarkContextMenuSelectController.setOptions === 'function') {
      bookmarkContextMenuSelectController.setOptions(
        bookmarkContextMenu.control,
        getBookmarkContextMenuOptions(bookmarkContextMenuTarget),
        bookmarkContextMenuTarget && bookmarkContextMenuTarget.isFolder
          ? BOOKMARK_CONTEXT_MENU_OPEN_GROUP_VALUE
          : bookmarkContextMenuTarget
            ? NEWTAB_CONTEXT_MENU_OPEN_VALUE
            : BOOKMARK_CONTEXT_MENU_EDIT_VALUE
      );
    }
  }

  function updateRecentContextMenuLanguageStrings() {
    if (!recentContextMenu || !recentContextMenuSelectController) {
      return;
    }
    if (recentContextMenu.trigger) {
      recentContextMenu.trigger.setAttribute(
        'aria-label',
        t('recent_context_menu_label', 'Recent site actions')
      );
    }
    if (typeof recentContextMenuSelectController.setOptions === 'function') {
      recentContextMenuSelectController.setOptions(
        recentContextMenu.control,
        getRecentContextMenuOptions(recentContextMenuTarget),
        NEWTAB_CONTEXT_MENU_OPEN_VALUE
      );
    }
  }

  function updateShortcutLanguageStrings() {
    if (shortcutSection) {
      shortcutSection.setAttribute('aria-label', t('newtab_shortcuts_section_label', 'Shortcuts'));
    }
    if (addShortcutButton) {
      const addLabel = t('newtab_shortcuts_add', 'Add shortcut');
      addShortcutButton.setAttribute('aria-label', addLabel);
      addShortcutButton.setAttribute('data-tooltip', addLabel);
    }
    updateShortcutDialogLanguageStrings();
    if (shortcutGrid) {
      Array.from(shortcutGrid.querySelectorAll('.x-nt-shortcut-tile[data-shortcut-url]')).forEach((tile) => {
        const title = tile.getAttribute('data-shortcut-title') || '';
        tile.setAttribute('aria-label', formatMessage('open_prefix', '打开 {title}', { title }));
      });
    }
    updateShortcutContextMenuLanguageStrings();
    updateBookmarkContextMenuLanguageStrings();
    updateRecentContextMenuLanguageStrings();
  }

  function closeShortcutDialog(options) {
    shortcutDialogOpenRevision += 1;
    if (shortcutDialogController) {
      shortcutDialogController.close({
        ...(options || {}),
        force: true
      });
    }
  }

  async function openShortcutDialog(options) {
    const revision = ++shortcutDialogOpenRevision;
    try {
      if (!shortcutDialogController) {
        if (!shortcutDialogLoadPromise) {
          shortcutDialogLoadPromise = Promise.resolve(createShortcutDialogComponent()).then((controller) => {
            if (!controller) throw new Error('Shortcut dialog unavailable');
            shortcutDialogController = controller;
            controller.mount(document.body);
          }).finally(() => { shortcutDialogLoadPromise = null; });
        }
        await shortcutDialogLoadPromise;
      }
      if (revision === shortcutDialogOpenRevision) shortcutDialogController.open(options);
    } catch (error) {
      console.warn('[Lumno] Failed to load shortcut dialog', error);
      if (revision === shortcutDialogOpenRevision) showToast(t('toast_error', 'Operation failed. Please try again.'), true);
    }
  }

  function getShortcutTileFromNode(node) {
    if (!shortcutGrid || !node) {
      return null;
    }
    const tile = typeof node.closest === 'function'
      ? node.closest('.x-nt-shortcut-tile')
      : null;
    return tile && shortcutGrid.contains(tile) ? tile : null;
  }

  function getShortcutTileId(tile) {
    return tile && typeof tile.getAttribute === 'function'
      ? tile.getAttribute('data-shortcut-id') || ''
      : '';
  }

  function refreshShortcutTileCacheFromDom() {
    if (!shortcutGrid) {
      return;
    }
    shortcutTiles.length = 0;
    Array.from(shortcutGrid.querySelectorAll('.x-nt-shortcut-tile[data-shortcut-id]')).forEach((tile) => {
      shortcutTiles.push(tile);
    });
  }

  function getShortcutReorderTiles() {
    return shortcutGrid
      ? Array.from(shortcutGrid.querySelectorAll('.x-nt-shortcut-tile[data-shortcut-id]'))
      : [];
  }

  function getShortcutById(shortcutId) {
    const id = String(shortcutId || '');
    if (!id) {
      return null;
    }
    return newtabShortcuts.find((item) => item && item.id === id) || null;
  }

  function getShortcutTileById(shortcutId) {
    const id = String(shortcutId || '');
    if (!id) {
      return null;
    }
    return getShortcutReorderTiles().find((tile) => getShortcutTileId(tile) === id) || null;
  }

  function requestBookmarkFolderTabGroup(folderId, title) {
    return new Promise((resolve) => {
      if (!chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
        resolve({ ok: false, reason: 'runtime-unavailable' });
        return;
      }
      chrome.runtime.sendMessage({
        action: 'openBookmarkFolderInNewTabGroup',
        folderId,
        title
      }, (response) => {
        const error = chrome.runtime && chrome.runtime.lastError
          ? chrome.runtime.lastError.message || 'runtime-error'
          : '';
        resolve(error ? { ok: false, reason: error } : (response || { ok: false }));
      });
    });
  }

  function openBookmarkFolderTabGroupConfirmation(target) {
    if (!target || !target.isFolder || !target.bookmarkId) {
      return;
    }
    const node = bookmarksRuntime.getNode(target.bookmarkId);
    const count = NEWTAB_BOOKMARKS_STORE.collectFolderBookmarkUrls(node).length;
    if (count <= 0) {
      return;
    }
    const folderTitle = String((node && node.title) || target.title || '').trim() ||
      t('bookmarks_untitled_folder', 'Untitled folder');
    openShortcutDialog({
      sourceElement: target.element,
      confirmationTitle: formatMessage(
        'bookmarks_open_group_confirm_title',
        'Open {count} tabs?',
        { count }
      ),
      confirmationDescription: formatMessage(
        'bookmarks_open_group_confirm_description',
        'All bookmarks in “{folder}” and its subfolders will open in one tab group.',
        { folder: folderTitle }
      ),
      confirmLabel: t('bookmarks_open_group_confirm_button', 'Open'),
      async onConfirm() {
        const response = await requestBookmarkFolderTabGroup(
          String(target.bookmarkId),
          folderTitle
        );
        const openedCount = Math.max(0, Number(response && response.openedCount) || 0);
        const failedCount = Math.max(0, Number(response && response.failedCount) || 0);
        if (openedCount > 0 && failedCount > 0) {
          showToast(formatMessage(
            'bookmarks_open_group_partial_failed',
            'Opened {openedCount} tabs; {failedCount} could not be opened.',
            { openedCount, failedCount }
          ), true);
        } else if (!response || response.ok !== true) {
          showToast(t(
            'bookmarks_open_group_failed',
            'Could not open the bookmark folder'
          ), true);
        }
        return true;
      }
    });
  }

  function handleShortcutNativeDragStart(event) {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
  }

  function openShortcutEditor(shortcut, sourceElement) {
    if (!shortcut) {
      return;
    }
    if (shortcut.type === 'folder') {
      openBookmarkEditor({ bookmarkId: getShortcutFolderId(shortcut), isFolder: true,
        title: getShortcutTitle(shortcut), element: sourceElement });
      return;
    }
    openShortcutDialog({
      mode: SHORTCUT_DIALOG_MODE_EDIT,
      shortcut: {
        ...shortcut,
        iconDataUrl: getShortcutIconDataUrl(shortcut.id)
      },
      sourceElement
    });
  }

  function openBookmarkEditor(target) {
    if (!target || !target.bookmarkId) {
      return;
    }
    const node = bookmarksRuntime.getNode(target.bookmarkId);
    const isFolder = Boolean(target.isFolder);
    openShortcutDialog({
      mode: SHORTCUT_DIALOG_MODE_EDIT,
      itemType: isFolder ? SHORTCUT_DIALOG_ITEM_FOLDER : SHORTCUT_DIALOG_ITEM_BOOKMARK,
      shortcut: {
        id: String(target.bookmarkId),
        title: String((node && node.title) || target.title || ''),
        url: isFolder ? '' : String((node && node.url) || target.url || '')
      },
      sourceElement: target.element
    });
  }

  createShortcutsSection();
  markNewtabStartupMilestone('shortcut-surface-created');

  setContentSectionVisible(bookmarkSection, false);
  const bookmarkHeader = pageStructureRuntime.bookmark.header;
  bookmarkTitleWrap = pageStructureRuntime.bookmark.titleWrap;
  bookmarkHeading = pageStructureRuntime.bookmark.heading;
  updateBookmarkHeading();
  bookmarkBreadcrumb = pageStructureRuntime.bookmark.breadcrumb;
  bookmarkBreadcrumbController =
    NEWTAB_BOOKMARK_BREADCRUMB.createBookmarkBreadcrumbController(
      bookmarkBreadcrumb,
      { onNavigate: navigateBookmarkFolder }
    );
  bookmarkBreadcrumbController.render({ items: [] });
  bookmarkModeMenu = createSectionModeSelect({
    id: '_x_extension_newtab_bookmark_mode_2026_unique_',
    menuTitleKey: 'display_mode_title',
    menuTitleFallback: 'Display mode',
    getValue: () => currentBookmarkViewMode,
    onChange: setBookmarkViewMode,
    onAction: handleBookmarkModeMenuAction,
    getOptions: getBookmarkViewModeOptions
  });
  const bookmarkPager = pageStructureRuntime.bookmark.pager;
  bookmarkPagerPrevButton = pageStructureRuntime.bookmark.previousButton;
  bookmarkPagerNextButton = pageStructureRuntime.bookmark.nextButton;
  bookmarkOpenManagerButton = pageStructureRuntime.bookmark.managerButton;
  bindBookmarkPagerTooltip(
    bookmarkPagerPrevButton,
    () => bookmarkPagerPrevButton.getAttribute('data-tooltip') || t('bookmarks_page_prev', '上一页')
  );
  bindBookmarkPagerTooltip(
    bookmarkPagerNextButton,
    () => bookmarkPagerNextButton.getAttribute('data-tooltip') || t('bookmarks_page_next', '下一页')
  );
  bindBookmarkPagerTooltip(
    bookmarkOpenManagerButton,
    () => bookmarkOpenManagerButton.getAttribute('data-tooltip') || t('bookmarks_open_manager', '打开书签管理页')
  );
  if (bookmarkModeMenu) {
    bookmarkPager.appendChild(bookmarkModeMenu.control);
  }
  bookmarkHeading.addEventListener('click', () => {
    if (!bookmarkHeading._xCanNavigateRoot) {
      return;
    }
    navigateBookmarkFolder(bookmarkRootFolderId);
  });
  bookmarkHeading.addEventListener('keydown', (event) => {
    if (!bookmarkHeading._xCanNavigateRoot) {
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    navigateBookmarkFolder(bookmarkRootFolderId);
  });
  updateBookmarkPagerLabels();
  updateBookmarkBreadcrumb();
  bookmarkGrid = pageStructureRuntime.bookmark.grid;
  bookmarkGrid.setAttribute('data-view-mode', currentBookmarkViewMode);
  bookmarkGrid.addEventListener('pointerdown', handleBookmarkDragPointerDown, true);
  applyBookmarkGridColumns();
  bookmarksView = NEWTAB_BOOKMARKS_VIEW.createBookmarksView({
    documentObj: document,
    windowObj: window,
    grid: bookmarkGrid,
    cards: bookmarkCards,
    cardElementCache: bookmarkCardElementCache,
    folderIconsVisible: bookmarkFolderIconsVisible,
    t,
    formatMessage,
    sanitizeDisplayText,
    getHostFromUrl,
    getSiteDisplayName,
    getUrlDisplay,
    getRiSvg,
    getFigmaFolderSvg,
    initFolderPathMorph,
    playFolderPathMorph,
    stableHashCode,
    normalizeHost,
    attachFaviconWithFallbacks,
    isLocalNetworkHost,
    getChromeFaviconUrl,
    getBrowserPageFaviconUrl,
    getImmediateThemeForSuggestion,
    queueThemeForTarget,
    applyCardTheme: applyBookmarkCardTheme,
    shouldDelayHoverFromRecent: shouldDelayBookmarkHoverFromRecent,
    hoverDelayFromRecentMs: BOOKMARK_HOVER_DELAY_FROM_RECENT_MS,
    shouldSuppressHover: shouldSuppressBookmarkHover,
    bindCursorTooltip,
    hideCursorTooltip,
    openFolder: openBookmarkFolder,
    openFolderMenu: openBookmarkCascadeMenu,
    copyUrl: copyBookmarkUrl,
    onItemContextMenu: handleBookmarkItemContextMenu,
    navigateToUrl,
    openUrl: openUrlFromNewtabCard
  });
  bookmarkCascadeRuntime = NEWTAB_BOOKMARK_CASCADE_MENU.createBookmarkCascadeMenuRuntime({
    documentObj: document,
    windowObj: window,
    storageArea,
    debugStorageKey: BOOKMARK_CASCADE_DEBUG_STORAGE_KEY,
    positionUtils: NEWTAB_BOOKMARK_CASCADE_POSITION,
    crossSurfaceDrag: NEWTAB_CROSS_SURFACE_DRAG,
    menuSurface: globalThis.LumnoMenuSurface,
    t,
    sanitizeDisplayText,
    getHostFromUrl,
    getSiteDisplayName,
    getUrlDisplay,
    getRiSvg,
    getFigmaFolderSvg,
    initFolderPathMorph,
    playFolderPathMorph,
    attachFaviconWithFallbacks,
    isLocalNetworkHost,
    getChromeFaviconUrl,
    getBrowserPageFaviconUrl,
    ensureReady: (forceReload) => bookmarksRuntime.ensureReady(forceReload),
    getItems: (folderId) => {
      return bookmarksRuntime.getFolderItems(folderId);
    },
    navigateToUrl,
    openUrl: openUrlFromNewtabCard,
    shouldSuppressHover: shouldSuppressBookmarkHover,
    bindCursorTooltip,
    hideCursorTooltip,
    copyUrl: copyBookmarkUrl,
    copyTooltipController: bookmarkCascadeCopyTooltipController,
    showTopActionTooltip,
    hideTopActionTooltip,
    onItemPointerDown: handleBookmarkCascadeItemPointerDown,
    onItemContextMenu: handleBookmarkItemContextMenu,
    shouldKeepOpenForExternalNode: isBookmarkContextMenuNode,
    getViewportTopPadding: getBookmarkCascadeViewportTopPaddingPx,
    view: NEWTAB_BOOKMARK_CASCADE_VIEW
  });
  bookmarkTopbarRuntime = NEWTAB_BOOKMARKS_TOPBAR.createBookmarksTopbar({
    documentObj: document,
    windowObj: window,
    grid: bookmarkGrid,
    modeControl: bookmarkModeMenu ? bookmarkModeMenu.control : null,
    managerButton: bookmarkOpenManagerButton,
    ariaLabel: t('bookmark_view_mode_top', 'Top bookmarks bar'),
    onVisibilityChange: setNewtabTopOccupied
  });
  syncBookmarkTopbarSurfaceAppearance({ updateMenu: false, scheduleTone: false });
  syncBookmarkSurfaceMode();
  let bookmarkRenderSignature = '';
  let sectionDataRevision = 0;
  let bookmarkLoadedOnce = false;

  setContentSectionVisible(recentSection, false);
  recentSection.addEventListener('pointerenter', (event) => {
    if (!event || event.pointerType !== 'mouse') {
      return;
    }
    recentMouseInsideSection = true;
    recentMouseLeftAt = 0;
  });
  recentSection.addEventListener('pointerleave', (event) => {
    if (!event || event.pointerType !== 'mouse') {
      return;
    }
    recentMouseInsideSection = false;
    recentMouseLeftAt = Date.now();
    hideTopActionTooltip();
  });
  recentSection.addEventListener('pointercancel', () => {
    recentMouseInsideSection = false;
    hideTopActionTooltip();
  });
  recentHeader = pageStructureRuntime.recent.header;
  recentHeading = pageStructureRuntime.recent.heading;
  updateRecentHeading();
  recentModeMenu = createSectionModeSelect({
    id: '_x_extension_newtab_recent_mode_2026_unique_',
    menuTitleKey: 'display_mode_title',
    menuTitleFallback: 'Display mode',
    getValue: () => currentRecentMode,
    onChange: (nextMode) => {
      setRecentMode(nextMode);
    },
    options: [
      {
        value: 'latest',
        labelKey: 'recent_mode_latest',
        fallback: 'Recent'
      },
      {
        value: 'most',
        labelKey: 'recent_mode_most',
        fallback: 'Most visited'
      }
    ]
  });
  recentGrid = pageStructureRuntime.recent.grid;
  applyRecentGridColumns();
  recentSitesView = NEWTAB_RECENT_VIEW.createRecentSitesView({
    documentObj: document,
    windowObj: window,
    grid: recentGrid,
    cards: recentCards,
    t,
    formatMessage,
    sanitizeDisplayText,
    getOwnExtensionPageDisplay,
    getHostFromUrl,
    getCanonicalPageUrlForFavicon,
    getSiteDisplayName,
    getUrlDisplay,
    getRiSvg,
    attachFaviconWithFallbacks,
    getBrowserPageFaviconUrl,
    getImmediateThemeForSuggestion,
    queueThemeForTarget,
    applyCardTheme: applyRecentCardTheme,
    getCurrentRecentCount: () => getRecentLimit(),
    isPinned: isRecentSitePinned,
    getPinnedCount: () => pinnedRecentSites.length,
    getMaxPinnedCount: () => MAX_PINNED_RECENT_SITES,
    updatePinButton: updateRecentPinButton,
    showToast,
    showTopActionTooltip,
    hideTopActionTooltip,
    navigateToUrl,
    bindCursorTooltip,
    hideCursorTooltip,
    openUrl: openUrlFromNewtabCard,
    togglePinned: togglePinnedRecentSite,
    onItemContextMenu: handleRecentCardContextMenu,
    getProgressState: getRecentProgressState,
    toggleProgressTracking: toggleRecentProgressTracking
  });
  if (recentModeMenu) {
    recentHeader.appendChild(recentModeMenu.control);
  }
  let recentRenderSignature = '';
  let recentLoadedOnce = false;
  const bottomDockRuntime = NEWTAB_DOCK.createBottomDockRuntime({
    documentObj: document,
    windowObj: window,
    layoutRuntime: NEWTAB_LAYOUT,
    root,
    searchLayer: () => searchLayer,
    inputParts: () => inputParts,
    topContentContainer: () => topContentContainer,
    shortcutSection: () => shortcutSection,
    quoteSection: () => quoteRuntime && quoteRuntime.element,
    bookmarkSection,
    recentSection,
    suggestionsContainer,
    suggestionsSurface,
    suggestionsOutline,
    getTopInsetPx: getNewtabTopOccupiedInsetPx,
    constants: {
      minTopPx: SEARCH_LAYOUT_MIN_TOP_PX,
      minBottomPx: SEARCH_LAYOUT_MIN_BOTTOM_PX,
      upshiftRatio: SEARCH_LAYOUT_UPSHIFT_RATIO,
      upshiftMinPx: SEARCH_LAYOUT_UPSHIFT_MIN_PX,
      upshiftMaxPx: SEARCH_LAYOUT_UPSHIFT_MAX_PX,
      contentSectionsExtraUpshiftPx: SEARCH_LAYOUT_CONTENT_SECTIONS_EXTRA_UPSHIFT_PX,
      emptySectionsExtraUpshiftPx: SEARCH_LAYOUT_EMPTY_SECTIONS_EXTRA_UPSHIFT_PX,
      narrowViewportMinWidthPx: SEARCH_LAYOUT_NARROW_VIEWPORT_MIN_WIDTH_PX,
      narrowViewportMaxWidthPx: SEARCH_LAYOUT_NARROW_VIEWPORT_MAX_WIDTH_PX,
      narrowTopInsetPx: SEARCH_LAYOUT_NARROW_TOP_INSET_PX,
      narrowTopInsetTransitionPx: SEARCH_LAYOUT_NARROW_TOP_INSET_TRANSITION_PX,
      shortViewportMaxHeightPx: SEARCH_LAYOUT_SHORT_VIEWPORT_MAX_HEIGHT_PX,
      shortMinTopPx: SEARCH_LAYOUT_SHORT_MIN_TOP_PX,
      mobileFlowBreakpointPx: NEWTAB_MOBILE_FLOW_BREAKPOINT_PX
    }
  });
  const bottomDock = bottomDockRuntime.element;
  layoutController = bottomDockRuntime.layoutController;
  applyNewtabWidthMode();
  markNewtabStartupMilestone('dock-runtime-created');

  bookmarkPagerPrevButton.addEventListener('click', () => {
    if (bookmarkCurrentPage <= 0) {
      return;
    }
    switchBookmarkPage(bookmarkCurrentPage - 1);
  });
  bookmarkPagerNextButton.addEventListener('click', () => {
    const pageCount = getBookmarkPageCount();
    if (bookmarkCurrentPage >= (pageCount - 1)) {
      return;
    }
    switchBookmarkPage(bookmarkCurrentPage + 1);
  });
  bookmarkOpenManagerButton.addEventListener('click', () => {
    if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
      return;
    }
    chrome.runtime.sendMessage({ action: 'openBookmarkManager' });
  });
  bookmarkSection.addEventListener('wheel', (event) => {
    if (!event) {
      return;
    }
    if (!isContentSectionVisible(bookmarkSection)) {
      return;
    }
    const pageCount = getBookmarkPageCount();
    if (pageCount <= 1) {
      return;
    }
    const deltaY = Number(event.deltaY) || 0;
    if (Math.abs(deltaY) < 6) {
      return;
    }
    event.preventDefault();
    if (bookmarkPageAnimating) {
      return;
    }
    const now = Date.now();
    if ((now - bookmarkWheelLastAt) < BOOKMARK_WHEEL_SWITCH_COOLDOWN_MS) {
      return;
    }
    let targetPage = bookmarkCurrentPage;
    if (deltaY > 0 && bookmarkCurrentPage < (pageCount - 1)) {
      targetPage = bookmarkCurrentPage + 1;
    } else if (deltaY < 0 && bookmarkCurrentPage > 0) {
      targetPage = bookmarkCurrentPage - 1;
    }
    if (targetPage === bookmarkCurrentPage) {
      return;
    }
    bookmarkWheelLastAt = now;
    switchBookmarkPage(targetPage);
  }, { passive: false });

  const NEWTAB_BOOKMARK_PAGER = globalThis.LumnoNewtabBookmarkPager;
  const {
    getBookmarkPageCount,
    updateBookmarkPagerState,
    updateBookmarkGridHeightLock,
    renderCurrentBookmarkPage,
    switchBookmarkPageDuringDrag,
    switchBookmarkPage
  } = NEWTAB_BOOKMARK_PAGER.createBookmarkPager({
    isBookmarkTopbarMode,
    getBookmarkLimit,
    NEWTAB_BOOKMARKS_STORE,
    hideTopActionTooltip,
    getBookmarkGridColumnCount,
    renderBookmarks: (...args) => renderBookmarks(...args),
    updateBookmarkSectionPosition,
    stableHashCode,
    pageState: {
      get bookmarkAllItems() {
        return bookmarkAllItems;
      },
      get bookmarkCurrentPage() {
        return bookmarkCurrentPage;
      },
      set bookmarkCurrentPage(value) {
        bookmarkCurrentPage = value;
      },
      get bookmarkPagerPrevButton() {
        return bookmarkPagerPrevButton;
      },
      get bookmarkPagerNextButton() {
        return bookmarkPagerNextButton;
      },
      get bookmarkGrid() {
        return bookmarkGrid;
      },
      get bookmarkCurrentFolderId() {
        return bookmarkCurrentFolderId;
      },
      get bookmarkRootFolderId() {
        return bookmarkRootFolderId;
      },
      get bookmarkRootTotalCount() {
        return bookmarkRootTotalCount;
      },
      get bookmarkRootVisibleCount() {
        return bookmarkRootVisibleCount;
      },
      get bookmarkPageAnimating() {
        return bookmarkPageAnimating;
      },
      set bookmarkPageAnimating(value) {
        bookmarkPageAnimating = value;
      }
    }
  });

  const NEWTAB_SHORTCUT_DRAG = globalThis.LumnoNewtabShortcutDrag;
  const {
    getShortcutTileLayoutRect,
    setShortcutDragTileTransform,
    getShortcutInsertionSlotAt,
    scheduleShortcutDragMove,
    suppressCanceledDragClick,
    finishShortcutDrag,
    isShortcutDragActive,
    isBookmarkSurfaceDragStateActive,
    handleShortcutDragPointerDown
  } = NEWTAB_SHORTCUT_DRAG.createShortcutDrag({
    getShortcutReorderTiles,
    NEWTAB_CROSS_SURFACE_DRAG,
    refreshShortcutTileCacheFromDom,
    getShortcutTileId,
    getShortcutTileById,
    renderShortcuts,
    resetShortcutDockHover,
    NEWTAB_BOOKMARK_MOVE_HISTORY,
    persistShortcuts,
    bookmarkMoveHistory,
    hideCursorTooltip,
    closeBookmarkCascadeMenu,
    hideShortcutTooltip,
    isEmptyBookmarkRootHidden,
    renderCurrentBookmarkPage,
    isBookmarkTopbarMode,
    isBookmarkCascadeSurfaceAtPoint,
    getExternalBookmarkSurfacePoint,
    isPointOverShortcutDropSurface,
    clearBookmarkDragPageSwitch,
    clearBookmarkDragFolderSwitch,
    clearDragDropTarget,
    scheduleWallpaperAdaptiveToneUpdate,
    getBookmarkDragPageSwitchDirection,
    scheduleBookmarkDragPageSwitch,
    getShortcutFolderDropTargetAt,
    getExternalBookmarkDropTarget,
    setDragDropTarget,
    scheduleBookmarkDragFolderSwitch,
    getShortcutById,
    isValidExternalBookmarkDropTarget,
    bookmarksRuntime,
    getShortcutFolderId,
    queueBookmarkLayoutAnimation,
    applyBookmarkShortcutTransfer,
    showToast,
    t,
    refreshShortcutFolderReferences,
    isShortcutContextMenuNode,
    getShortcutTileFromNode,
    closeShortcutContextMenu,
    pageState: {
      get shortcutGrid() {
        return shortcutGrid;
      },
      get shortcutDragState() {
        return shortcutDragState;
      },
      set shortcutDragState(value) {
        shortcutDragState = value;
      },
      get addShortcutButton() {
        return addShortcutButton;
      },
      get newtabShortcuts() {
        return newtabShortcuts;
      },
      set newtabShortcuts(value) {
        newtabShortcuts = value;
      },
      get bookmarkMoveHistoryBusy() {
        return bookmarkMoveHistoryBusy;
      },
      set bookmarkMoveHistoryBusy(value) {
        bookmarkMoveHistoryBusy = value;
      },
      get bookmarkTopbarRuntime() {
        return bookmarkTopbarRuntime;
      },
      get bookmarkGrid() {
        return bookmarkGrid;
      },
      get bookmarkDragState() {
        return bookmarkDragState;
      },
      get newtabShortcutIcons() {
        return newtabShortcutIcons;
      }
    }
  });

  const NEWTAB_SECTION_LOADERS = globalThis.LumnoNewtabSectionLoaders;
  const {
    renderBookmarks,
    renderRecentSites,
    markBookmarkDataDirty,
    markBookmarkTreeDirty,
    markRecentDataDirty,
    loadBookmarks,
    loadRecentSites,
    handleRecentVisibilityChange,
    forceReloadRecentSitesForI18n
  } = NEWTAB_SECTION_LOADERS.createSectionLoaders({
    isShortcutDragActive,
    isBookmarkTopbarMode,
    scheduleShortcutDragMove,
    updateBookmarkDragLayoutCache,
    setBookmarkDragCardTransform,
    scheduleBookmarkDragMove,
    syncOpenBookmarkCascadeAnchorVisual,
    setBookmarkSurfaceVisible,
    updateBookmarkGridHeightLock,
    updateBookmarkSectionPosition,
    updateBookmarkPagerState,
    normalizeRecentSiteRecord,
    getRecentSiteUrlKey,
    writeHiddenRecentSites,
    shouldExcludeFromRecentSites,
    isRecentSiteHidden,
    mergeRecentSitesWithPinned,
    getRecentLimit,
    setContentSectionVisible,
    recentSection,
    bookmarksRuntime,
    closeBookmarkCascadeMenu,
    bootstrapInitialThemeMode,
    areFaviconRenderCachesReady,
    FAVICON_CACHE_BOOT_WAIT_MS,
    waitForFaviconRenderCaches,
    getTopBookmarks,
    getBookmarkLimit,
    getBookmarkPageCount,
    updateBookmarkBreadcrumb,
    renderCurrentBookmarkPage,
    playPendingBookmarkLayoutAnimation,
    renderShortcuts,
    getRecentSourceLimit,
    getRecentSites,
    MAX_PINNED_RECENT_SITES,
    beginSearchEntryRestoreLayoutLock,
    pageState: {
      get bookmarkCurrentFolderId() {
        return bookmarkCurrentFolderId;
      },
      get bookmarkRootFolderId() {
        return bookmarkRootFolderId;
      },
      get bookmarkDragState() {
        return bookmarkDragState;
      },
      get bookmarkGrid() {
        return bookmarkGrid;
      },
      get bookmarksView() {
        return bookmarksView;
      },
      get bookmarkRenderSignature() {
        return bookmarkRenderSignature;
      },
      set bookmarkRenderSignature(value) {
        bookmarkRenderSignature = value;
      },
      get currentBookmarkViewMode() {
        return currentBookmarkViewMode;
      },
      get shortcutDragState() {
        return shortcutDragState;
      },
      get hiddenRecentSites() {
        return hiddenRecentSites;
      },
      get recentSourceItems() {
        return recentSourceItems;
      },
      set recentSourceItems(value) {
        recentSourceItems = value;
      },
      get recentSitesView() {
        return recentSitesView;
      },
      get recentRenderSignature() {
        return recentRenderSignature;
      },
      set recentRenderSignature(value) {
        recentRenderSignature = value;
      },
      get sectionDataRevision() {
        return sectionDataRevision;
      },
      get initialThemeApplied() {
        return initialThemeApplied;
      },
      get bookmarkLoadedOnce() {
        return bookmarkLoadedOnce;
      },
      set bookmarkLoadedOnce(value) {
        bookmarkLoadedOnce = value;
      },
      get currentBookmarkCount() {
        return currentBookmarkCount;
      },
      get bookmarkAllItems() {
        return bookmarkAllItems;
      },
      set bookmarkAllItems(value) {
        bookmarkAllItems = value;
      },
      get bookmarkRootTotalCount() {
        return bookmarkRootTotalCount;
      },
      set bookmarkRootTotalCount(value) {
        bookmarkRootTotalCount = value;
      },
      get bookmarkRootVisibleCount() {
        return bookmarkRootVisibleCount;
      },
      set bookmarkRootVisibleCount(value) {
        bookmarkRootVisibleCount = value;
      },
      get bookmarkCurrentPage() {
        return bookmarkCurrentPage;
      },
      set bookmarkCurrentPage(value) {
        bookmarkCurrentPage = value;
      },
      get newtabShortcuts() {
        return newtabShortcuts;
      },
      get recentLoadedOnce() {
        return recentLoadedOnce;
      },
      set recentLoadedOnce(value) {
        recentLoadedOnce = value;
      },
      get currentRecentMode() {
        return currentRecentMode;
      }
    }
  });

  function getCurrentSearchEntryPaddingTop() {
    if (!document.body || !document.body.style) {
      return null;
    }
    const value = Number.parseFloat(document.body.style.getPropertyValue('padding-top'));
    return Number.isFinite(value) ? Math.round(value) : null;
  }

  function getSearchEntryViewportSnapshot() {
    return {
      width: Math.max(0, Math.round(window.innerWidth || 0)),
      height: Math.max(0, Math.round(window.innerHeight || 0))
    };
  }

  function hasSearchEntryViewportChanged(referenceViewport) {
    const currentViewport = getSearchEntryViewportSnapshot();
    const reference = referenceViewport || {};
    return Math.abs(currentViewport.width - (Number(reference.width) || 0)) > 1 ||
      Math.abs(currentViewport.height - (Number(reference.height) || 0)) > 1;
  }

  function rememberSearchEntryViewport() {
    const viewport = getSearchEntryViewportSnapshot();
    searchEntryLastVisibleViewportWidth = viewport.width;
    searchEntryLastVisibleViewportHeight = viewport.height;
  }

  function hasSearchEntryViewportChangedSinceLastVisible() {
    const viewport = getSearchEntryViewportSnapshot();
    return Math.abs(viewport.width - searchEntryLastVisibleViewportWidth) > 1 ||
      Math.abs(viewport.height - searchEntryLastVisibleViewportHeight) > 1;
  }

  function beginSearchEntryRestoreLayoutLock() {
    if (!document.body ||
        document.body.getAttribute('data-nt-ready') !== '1' ||
        hasSearchEntryViewportChangedSinceLastVisible() ||
        getCurrentSearchEntryPaddingTop() === null) {
      return;
    }
    searchEntryRestoreLayoutLockUntil = Date.now() + RESTORE_SEARCH_LAYOUT_LOCK_MS;
  }

  function shouldPreserveSearchEntryLayout() {
    if (!searchEntryRestoreLayoutLockUntil || Date.now() > searchEntryRestoreLayoutLockUntil) {
      searchEntryRestoreLayoutLockUntil = 0;
      return false;
    }
    if (getCurrentSearchEntryPaddingTop() === null) {
      searchEntryRestoreLayoutLockUntil = 0;
      return false;
    }
    return true;
  }

  function updateBookmarkSectionPosition(options) {
    const layoutOptions = options || {};
    if (layoutController && typeof layoutController.updateBottomDockLayout === 'function') {
      layoutController.updateBottomDockLayout({
        preserveSearchEntryLayout: Boolean(layoutOptions.preserveSearchEntryLayout) ||
          newtabResizeLayoutLocked ||
          shouldPreserveSearchEntryLayout(),
        stabilizeDockDensity: Boolean(layoutOptions.stabilizeDockDensity),
        releaseDockDensityLock: Boolean(layoutOptions.releaseDockDensityLock),
        onRecentHidden: () => {
          recentMouseInsideSection = false;
          recentMouseLeftAt = 0;
        }
      });
    }
    rememberSearchEntryViewport();
    scheduleWallpaperAdaptiveToneUpdate();
  }

  function updateSearchEntryLayout(options) {
    if (layoutController && typeof layoutController.updateSearchEntryLayout === 'function') {
      layoutController.updateSearchEntryLayout(options);
    }
  }

  // The change history dialog is loaded the first time someone opens it.
  function openRecentHistoryDialog(item) {
    if (!recentHistoryDialogLoadPromise) {
      recentHistoryDialogLoadPromise = Promise.resolve(
        NEWTAB_RECENT_HISTORY_DIALOG && typeof NEWTAB_RECENT_HISTORY_DIALOG.createRecentHistoryDialog === 'function'
          ? NEWTAB_RECENT_HISTORY_DIALOG.createRecentHistoryDialog({
            documentObj: document,
            windowObj: window,
            t,
            onRestore: restoreProgressVersion,
            onRestoreSuccess() {
              showToast(t('recent_history_restore_success', '已恢复为所选版本'), false);
            }
          })
          : null
      ).then((controller) => {
        if (!controller) throw new Error('Recent history dialog unavailable');
        controller.mount(document.body);
        recentHistoryDialogController = controller;
        return controller;
      }).catch((error) => {
        recentHistoryDialogLoadPromise = null;
        throw error;
      });
    }
    return recentHistoryDialogLoadPromise.then((controller) => {
      if (progressTrackingEnabled) controller.open({ item });
    }).catch(() => {
      showToast(t('toast_error', '操作失败，请重试。'), true);
    });
  }

  function hideToast() {
    if (toastController && typeof toastController.hide === 'function') {
      toastController.hide();
    }
  }

  function showToast(message, isError, options) {
    if (toastController && typeof toastController.show === 'function') {
      toastController.show(message, Object.assign({}, options, {
        error: Boolean(isError)
      }));
    }
  }

  // A task that may run long: its loading Toast turns into the result in place.
  function beginToast(message) {
    if (toastController && typeof toastController.begin === 'function') {
      return toastController.begin(message);
    }
    return {
      update() {},
      done(result) { if (result) showToast(result, false); },
      fail(result) { if (result) showToast(result, true); },
      cancel() {}
    };
  }

  const numberShortcutOptions = {
    onHoldStart: function() {
      showToast(t(
        'search_number_jump_release_hint',
        'Release to show numbers'
      ), false, { duration: 0 });
    },
    onHoldEnd: hideToast,
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

  function copyBookmarkUrl(url) {
    const value = String(url || '').trim();
    if (!value) {
      showToast(t('bookmarks_copy_url_failed', 'Couldn’t copy the link. Try again.'), true);
      return Promise.resolve(false);
    }
    return copyTextToClipboard(value).then(() => {
      showToast(t('bookmarks_copy_url_success', 'Bookmark link copied'));
      return true;
    }).catch(() => {
      showToast(t('bookmarks_copy_url_failed', 'Couldn’t copy the link. Try again.'), true);
      return false;
    });
  }

  function copySearchResultUrl(url) {
    const value = String(url || '').trim();
    if (!value) {
      showToast(t('search_copy_url_failed', 'Couldn’t copy the result link. Try again.'), true);
      return Promise.resolve(false);
    }
    return copyTextToClipboard(value).then(() => {
      showToast(t('search_copy_url_success', 'Result link copied'));
      return true;
    }).catch(() => {
      showToast(t('search_copy_url_failed', 'Couldn’t copy the result link. Try again.'), true);
      return false;
    });
  }

  function getSearchModeMenuResultOffset() {
    if (!suggestionsContainer ||
        suggestionsContainer.getAttribute('data-visible') !== 'true') {
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
      '--x-nt-suggestions-menu-fit-max-height';
    const resultHeightLimit =
      typeof inputModeController.fitModeMenuWithinViewport === 'function'
        ? inputModeController.fitModeMenuWithinViewport({ bottomInset: 24 })
        : null;
    if (Number.isFinite(resultHeightLimit)) {
      suggestionsContainer.style.setProperty(
        fitMaxHeightProperty,
        `${resultHeightLimit}px`
      );
    } else {
      suggestionsContainer.style.removeProperty(fitMaxHeightProperty);
    }
    inputModeController.setModeMenuResultOffset(
      getSearchModeMenuResultOffset()
    );
  }

  function setSuggestionsVisible(visible) {
    if (layoutController && typeof layoutController.setSuggestionsVisible === 'function') {
      layoutController.setSuggestionsVisible(visible);
    }
    syncSearchModeMenuResultOffset();
  }

  function updateSuggestionsFloatingLayout() {
    if (layoutController && typeof layoutController.updateSuggestionsFloatingLayout === 'function') {
      layoutController.updateSuggestionsFloatingLayout();
    }
  }

  function readRecentOpenTabs() {
    return new Promise((resolve) => {
      if (!chrome.tabs || !chrome.tabs.query) {
        resolve([]);
        return;
      }
      chrome.tabs.query({}, (tabs) => {
        resolve(chrome.runtime.lastError || !Array.isArray(tabs) ? [] : tabs);
      });
    });
  }

  function readRecentTopSites() {
    return new Promise((resolve) => {
      if (!chrome.topSites || !chrome.topSites.get) {
        resolve(null);
        return;
      }
      chrome.topSites.get((items) => {
        resolve(chrome.runtime.lastError || !Array.isArray(items) ? null : items);
      });
    });
  }

  function readRecentHistoryItems() {
    return new Promise((resolve) => {
      if (!chrome.history || !chrome.history.search) {
        resolve(null);
        return;
      }
      chrome.history.search({
        text: '',
        maxResults: 60,
        startTime: Date.now() - 1000 * 60 * 60 * 24 * 30
      }, (items) => {
        resolve(chrome.runtime.lastError || !Array.isArray(items) ? null : items);
      });
    });
  }

  function takeStartupRecentSourceRead(name, read) {
    const pending = startupRecentSourceReads[name];
    startupRecentSourceReads[name] = null;
    return pending && Date.now() - startupRecentSourceReadsAt <= STARTUP_RECENT_SOURCE_MAX_AGE_MS
      ? pending
      : read();
  }

  function getRecentSites(limit, mode) {
    const safeLimit = Math.max(0, Number(limit) || 0);
    const viewMode = mode === 'most' ? 'most' : 'latest';
    if (safeLimit <= 0) {
      return Promise.resolve([]);
    }

    const mergeSources = (sources, mergeMode) => NEWTAB_RECENT_STORE.mergeRecentSiteSources({
      ...getRecentStoreOptions(),
      ...(sources || {}),
      mode: mergeMode || viewMode,
      limit: safeLimit,
      candidateLimit: safeLimit,
      pinned: [],
      hidden: []
    });

    const readOpenTabs = () => takeStartupRecentSourceRead('tabs', readRecentOpenTabs);
    const readTopSites = () => takeStartupRecentSourceRead('topSites', readRecentTopSites);
    const readHistoryItems = () => takeStartupRecentSourceRead('historyItems', readRecentHistoryItems);

    const mergeWithTabsIfNeeded = (sources, mergeMode) => {
      const withoutTabs = mergeSources(sources, mergeMode);
      return readOpenTabs().then((tabs) => {
        const shouldMergeTabs = withoutTabs.length < safeLimit ||
          (Array.isArray(tabs) && tabs.some((tab) => isBrowserPageRecentUrl(tab && tab.url)));
        if (!shouldMergeTabs) {
          return withoutTabs;
        }
        return mergeSources({
          ...(sources || {}),
          tabs
        }, mergeMode);
      });
    };

    const loadLatestRecentSites = () => readHistoryItems().then((historyItems) => {
      if (!Array.isArray(historyItems)) {
        return [];
      }
      const historyOnly = mergeSources({ historyItems }, 'latest');
      if (historyOnly.length >= safeLimit) {
        return mergeWithTabsIfNeeded({ historyItems }, 'latest');
      }
      return readTopSites().then((topSites) => mergeWithTabsIfNeeded({
        historyItems,
        topSites: Array.isArray(topSites) ? topSites : []
      }, 'latest'));
    });

    if (viewMode === 'most') {
      return readTopSites().then((topSites) => {
        const topSiteItems = Array.isArray(topSites) ? topSites : [];
        const topOnly = mergeSources({ topSites: topSiteItems }, 'most');
        if (topOnly.length === 0) {
          return loadLatestRecentSites();
        }
        if (topOnly.length >= safeLimit) {
          return mergeWithTabsIfNeeded({ topSites: topSiteItems }, 'most');
        }
        return mergeWithTabsIfNeeded({ topSites: topSiteItems }, 'most');
      });
    }

    return loadLatestRecentSites();
  }

  // Kick off favicon cache warmup early; theme tint work flushes when storage is ready.
  faviconCacheRuntime.ensureCachesReady().then(() => {
    scheduleThemeResolutionFlush(0);
    refreshThemeAwareFavicons();
    scheduleThemeAwareFaviconRescue();
  });

  function openBookmarkCascadeMenu(item, anchorElement, options) {
    if (bookmarkCascadeRuntime) {
      bookmarkCascadeRuntime.open(item, anchorElement, {
        ...options,
        toggle: !options || options.dragMode !== true
      });
    }
  }

  function closeBookmarkCascadeMenu() {
    if (bookmarkCascadeRuntime) {
      bookmarkCascadeRuntime.close();
    }
  }

  function positionBookmarkCascadeLevels() {
    if (bookmarkCascadeRuntime) {
      bookmarkCascadeRuntime.positionLevels();
    }
  }

  function setBookmarkCascadeDebugEnabled(enabled, options) {
    if (bookmarkCascadeRuntime) {
      bookmarkCascadeRuntime.setDebugEnabled(enabled, options);
    }
  }

  function getTopBookmarks(limit, folderId) {
    const parsedLimit = Number.parseInt(limit, 10);
    const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 0;
    return bookmarksRuntime.readFolder(
      folderId || bookmarkCurrentFolderId || bookmarkRootFolderId,
      {
        limit: safeLimit,
        rootTitle: t('bookmarks_heading', '书签')
      }
    ).then((result) => {
      bookmarkRootFolderId = String(result.rootFolderId || '1');
      bookmarkCurrentFolderId = String(result.folderId || bookmarkRootFolderId);
      bookmarkFolderPath = Array.isArray(result.path)
        ? result.path
        : [{ id: bookmarkRootFolderId, title: t('bookmarks_heading', '书签') }];
      return Array.isArray(result.items) ? result.items : [];
    });
  }

  function getSiteDisplayName(hostname, title) {
    return SITE_DISPLAY_NAME.getSiteDisplayName(
      hostname,
      title,
      SITE_DISPLAY_NAME_OPTIONS
    );
  }

  const NEWTAB_SEARCH_AUTOCOMPLETE = globalThis.LumnoNewtabSearchAutocomplete;
  const {
    getAutocompleteCandidate,
    clearAutocomplete,
    restoreUserAuthoredSearchInput,
    dismissAutocompletePreviewOnNonTabKey,
    applyAutocomplete
  } = NEWTAB_SEARCH_AUTOCOMPLETE.createSearchAutocomplete({
    getUrlDisplay,
    isEnglishQuery,
    getKeywordSearchSuggestionState,
    pageState: {
      get autocompleteState() {
        return autocompleteState;
      },
      set autocompleteState(value) {
        autocompleteState = value;
      },
      get latestRawQuery() {
        return latestRawQuery;
      },
      set latestRawQuery(value) {
        latestRawQuery = value;
      },
      get inputParts() {
        return inputParts;
      },
      get latestQuery() {
        return latestQuery;
      },
      set latestQuery(value) {
        latestQuery = value;
      },
      get searchResultPriorityMode() {
        return searchResultPriorityMode;
      },
      get lastDeletionAt() {
        return lastDeletionAt;
      },
      get siteSearchState() {
        return siteSearchState;
      }
    }
  });

  const attachInputModeFaviconData =
    SHORTCUT_FAVICON.createSiteSearchProviderIconHydrator(attachFaviconData);

  const NEWTAB_SEARCH_MODES = globalThis.LumnoNewtabSearchModes;
  const {
    getSearchModeProviders,
    isAggregateSearchDefinitionAvailable,
    getSearchTriggerProviders,
    getSearchModeMenuItems,
    openSearchModeMenuFromDoubleTab,
    selectSearchModeMenuItem,
    getLocalSearchScopeTabHintProvider,
    setLocalSearchScopePrefix,
    activateLocalSearchScope,
    clearLocalSearchScope,
    activateSiteSearch,
    clearSiteSearch
  } = NEWTAB_SEARCH_MODES.createSearchModes({
    SEARCH_UTILS,
    defaultSiteSearchProviders,
    getSearchModeProviderId,
    AGGREGATE_SEARCH_STORE,
    t,
    createAggregateSearchScopeProvider,
    isAggregateSearchProvider,
    isSearchEngineSiteSearchProvider,
    isAiSiteSearchProvider,
    getSiteSearchDisplayName,
    getProviderIcon,
    getLocalSearchScopeLabel,
    getLocalSearchScopeIconClass,
    loadSiteSearchIconCache,
    getSiteSearchProviders,
    getAggregateSearches,
    formatMessage,
    defaultTheme,
    clearAutocomplete,
    clearSearchSuggestions: (...args) => clearSearchSuggestions(...args),
    clearSiteSearchPrefix,
    setSiteSearchPrefix,
    getThemeForProvider,
    pageState: {
      get defaultSearchEngineState() {
        return defaultSearchEngineState;
      },
      get siteSearchProvidersCache() {
        return siteSearchProvidersCache;
      },
      get aggregateSearchesCache() {
        return aggregateSearchesCache;
      },
      get siteSearchState() {
        return siteSearchState;
      },
      set siteSearchState(value) {
        siteSearchState = value;
      },
      get enabledSearchResultSourceTypes() {
        return enabledSearchResultSourceTypes;
      },
      get localSearchScopeState() {
        return localSearchScopeState;
      },
      set localSearchScopeState(value) {
        localSearchScopeState = value;
      },
      get inputParts() {
        return inputParts;
      },
      get inputModeController() {
        return inputModeController;
      },
      get latestRawQuery() {
        return latestRawQuery;
      },
      set latestRawQuery(value) {
        latestRawQuery = value;
      },
      get latestQuery() {
        return latestQuery;
      },
      set latestQuery(value) {
        latestQuery = value;
      },
      get suggestionRequestSeq() {
        return suggestionRequestSeq;
      },
      set suggestionRequestSeq(value) {
        suggestionRequestSeq = value;
      },
      get localSearchScopeTriggerState() {
        return localSearchScopeTriggerState;
      },
      set localSearchScopeTriggerState(value) {
        localSearchScopeTriggerState = value;
      },
      get siteSearchTriggerState() {
        return siteSearchTriggerState;
      },
      set siteSearchTriggerState(value) {
        siteSearchTriggerState = value;
      },
      get inlineSearchState() {
        return inlineSearchState;
      },
      set inlineSearchState(value) {
        inlineSearchState = value;
      }
    }
  });

  const NEWTAB_SEARCH_NAVIGATION = globalThis.LumnoNewtabSearchNavigation;
  const {
    getShortcutRules,
    buildKeywordSuggestions,
    getDirectUrlSuggestion,
    getDirectNavigationUrl,
    getMatchedOpenTabIdForSuggestion,
    shouldSwitchMatchedTabSuggestion,
    shouldOpenSearchResultInBackgroundTab,
    openSearchResultUrl,
    openMatchedTabSuggestion,
    refreshTabsForSearchContext,
    resolveQuickNavigation
  } = NEWTAB_SEARCH_NAVIGATION.createSearchNavigation({
    formatMessage,
    getExtensionResourceUrl,
    BROWSER_PROFILE,
    getPageFaviconCandidateUrl,
    SEARCH_UTILS,
    SUGGESTION_ACTION_MODEL,
    isBackgroundOpenEvent,
    recordSearchSuggestionSelection,
    navigateToUrl,
    pageState: {
      get tabs() {
        return tabs;
      },
      set tabs(value) {
        tabs = value;
      },
      get openTabQuickSwitchEnabled() {
        return openTabQuickSwitchEnabled;
      },
      get currentNewtabTabId() {
        return currentNewtabTabId;
      },
      set currentNewtabTabId(value) {
        currentNewtabTabId = value;
      }
    }
  });

  const NEWTAB_SUGGESTIONS_CONTROLLER = globalThis.LumnoNewtabSuggestionsController;
  const {
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
    directNavigationSettleController,
    requestSuggestions
  } = NEWTAB_SUGGESTIONS_CONTROLLER.createSuggestionsController({
    SUGGESTION_ACTION_MODEL,
    activateSiteSearch,
    focusSearchInputPreservingScroll: (...args) => focusSearchInputPreservingScroll(...args),
    setVisibleThemeMode: (...args) => setVisibleThemeMode(...args),
    setZenModeEnabled: (...args) => setZenModeEnabled(...args),
    shouldSwitchMatchedTabSuggestion,
    openMatchedTabSuggestion,
    runSiteSearchProviderQuery,
    shouldOpenSearchResultInBackgroundTab,
    openSearchResultUrl,
    navigateToQuery,
    suggestionsContainer,
    suggestionItems,
    SUGGESTION_NAVIGATION,
    refreshTabsForSearchContext,
    clearSiteSearchTabHint,
    restoreUserAuthoredSearchInput,
    isSlashCommandInput: (...args) => isSlashCommandInput(...args),
    getShortcutRules,
    isModeCommand: (...args) => isModeCommand(...args),
    isZenCommand: (...args) => isZenCommand(...args),
    storageArea,
    THEME_STORAGE_KEY,
    NEWTAB_THEME_MODE_STORAGE_KEY,
    NEWTAB_THEME_SCOPE_STORAGE_KEY,
    normalizeThemeMode,
    normalizeNewtabThemeMode,
    normalizeNewtabThemeScope,
    getScopedThemeMode,
    applyThemeMode,
    getCommandMatches: (...args) => getCommandMatches(...args),
    buildModeSuggestion: (...args) => buildModeSuggestion(...args),
    buildZenSuggestion: (...args) => buildZenSuggestion(...args),
    buildCommandSuggestion: (...args) => buildCommandSuggestion(...args),
    getDirectUrlSuggestion,
    buildKeywordSuggestions,
    defaultSiteSearchProviders,
    getSearchTriggerProviders,
    getSiteSearchProviders,
    getInlineSiteSearchCandidate,
    buildSearchUrl,
    getSiteSearchActionTitle,
    getProviderIcon,
    formatMessage,
    buildDefaultSearchUrl,
    getDefaultSearchEngineFaviconUrl,
    isAggregateSearchProvider,
    SEARCH_UTILS,
    getMatchedOpenTabIdForSuggestion,
    filterBlacklistedSuggestions,
    getKeywordSearchSuggestionState,
    promoteStrongNavigationMatch,
    promoteTopSiteMatch,
    getSiteSearchTriggerCandidate,
    getAutocompleteCandidate,
    getUrlDisplay,
    getDirectNavigationUrl,
    findProviderForSuggestionMatch,
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
    pageState: {
      get suggestionsView() {
        return suggestionsView;
      },
      get numberShortcutInstantEnabled() {
        return numberShortcutInstantEnabled;
      },
      get tabRankScoreDebugEnabled() {
        return tabRankScoreDebugEnabled;
      },
      get selectedIndex() {
        return selectedIndex;
      },
      set selectedIndex(value) {
        selectedIndex = value;
      },
      get latestQuery() {
        return latestQuery;
      },
      set latestQuery(value) {
        latestQuery = value;
      },
      get inputParts() {
        return inputParts;
      },
      get currentSuggestions() {
        return currentSuggestions;
      },
      set currentSuggestions(value) {
        currentSuggestions = value;
      },
      get tabs() {
        return tabs;
      },
      set tabs(value) {
        tabs = value;
      },
      get inlineSearchState() {
        return inlineSearchState;
      },
      set inlineSearchState(value) {
        inlineSearchState = value;
      },
      get siteSearchTriggerState() {
        return siteSearchTriggerState;
      },
      set siteSearchTriggerState(value) {
        siteSearchTriggerState = value;
      },
      get localSearchScopeTriggerState() {
        return localSearchScopeTriggerState;
      },
      set localSearchScopeTriggerState(value) {
        localSearchScopeTriggerState = value;
      },
      get lastSuggestionResponse() {
        return lastSuggestionResponse;
      },
      set lastSuggestionResponse(value) {
        lastSuggestionResponse = value;
      },
      get searchSuggestionsDismissed() {
        return searchSuggestionsDismissed;
      },
      set searchSuggestionsDismissed(value) {
        searchSuggestionsDismissed = value;
      },
      get suggestionRequestSeq() {
        return suggestionRequestSeq;
      },
      set suggestionRequestSeq(value) {
        suggestionRequestSeq = value;
      },
      get remoteSuggestionDebounceTimer() {
        return remoteSuggestionDebounceTimer;
      },
      set remoteSuggestionDebounceTimer(value) {
        remoteSuggestionDebounceTimer = value;
      },
      get suggestionRequestWatchdogTimer() {
        return suggestionRequestWatchdogTimer;
      },
      set suggestionRequestWatchdogTimer(value) {
        suggestionRequestWatchdogTimer = value;
      },
      get latestRawQuery() {
        return latestRawQuery;
      },
      set latestRawQuery(value) {
        latestRawQuery = value;
      },
      get localSearchScopeState() {
        return localSearchScopeState;
      },
      get siteSearchState() {
        return siteSearchState;
      },
      get globalThemeMode() {
        return globalThemeMode;
      },
      set globalThemeMode(value) {
        globalThemeMode = value;
      },
      get newtabThemeMode() {
        return newtabThemeMode;
      },
      set newtabThemeMode(value) {
        newtabThemeMode = value;
      },
      get newtabThemeScope() {
        return newtabThemeScope;
      },
      set newtabThemeScope(value) {
        newtabThemeScope = value;
      },
      get currentThemeMode() {
        return currentThemeMode;
      },
      get siteSearchProvidersCache() {
        return siteSearchProvidersCache;
      },
      get aggregateSearchesCache() {
        return aggregateSearchesCache;
      },
      get simpleModeEnabled() {
        return simpleModeEnabled;
      },
      get searchResultPriorityMode() {
        return searchResultPriorityMode;
      },
      get searchResultDisplayLimit() {
        return searchResultDisplayLimit;
      },
      get openTabQuickSwitchEnabled() {
        return openTabQuickSwitchEnabled;
      },
      get currentNewtabTabId() {
        return currentNewtabTabId;
      }
    }
  });

  const NEWTAB_INPUT_FOCUS = globalThis.LumnoNewtabInputFocus;
  const {
    isEditableElement,
    refreshFallbackShortcut,
    focusSearchInputPreservingScroll,
    handleGlobalTypingFocus
  } = NEWTAB_INPUT_FOCUS.createInputFocus({
    SHORTCUT_KEY_MATCHER,
    refreshTabsIfIdle,
    initialNewtabInputAutoFocusReadyTask,
    isImeCompositionEvent,
    pageState: {
      get inputParts() {
        return inputParts;
      },
      get newtabInputAutoFocusEnabled() {
        return newtabInputAutoFocusEnabled;
      },
      get folderColorPicker() {
        return folderColorPicker;
      },
      get inputModeController() {
        return inputModeController;
      },
      get searchScopeIcon() {
        return searchScopeIcon;
      }
    }
  });

  const NEWTAB_MODE_COMMANDS = globalThis.LumnoNewtabModeCommands;
  const {
    getCommandMatches,
    getCommandMatch,
    buildCommandSuggestion,
    updateModeBadge,
    getNextThemeMode,
    isModeCommand,
    isZenCommand,
    isSlashCommandInput,
    buildModeSuggestion,
    buildZenSuggestion,
    updateModeCommandSuggestions,
    updateZenCommandSuggestions,
    applyZenMode,
    setZenModeEnabled,
    loadZenMode,
    getThemeScope,
    setThemeMode,
    setVisibleThemeMode,
    setThemeScope
  } = NEWTAB_MODE_COMMANDS.createModeCommands({
    t,
    formatMessage,
    updateInputRightPadding,
    getExtensionResourceUrl,
    renderSuggestions,
    applyNewtabTopContentVisibility,
    applyNewtabShortcutsVisibility,
    bookmarkSection,
    recentSection,
    isBookmarkTopbarMode,
    bookmarkCards,
    closeBookmarkCascadeMenu,
    closeShortcutContextMenu,
    closeRecentContextMenu,
    closeShortcutDialog,
    closeWallpaperPanel,
    closeFeedbackPopover,
    hideTopActionTooltip,
    hideShortcutTooltip,
    hideCursorTooltip,
    updateBookmarkSectionPosition,
    updateSearchEntryLayout,
    scheduleWallpaperAdaptiveToneUpdate,
    normalizeZenModeEnabled,
    storageArea,
    NEWTAB_ZEN_MODE_STORAGE_KEY,
    SETTINGS,
    THEME_STORAGE_KEY,
    applyScopedThemeMode,
    updateWallpaperLanguageStrings,
    normalizeThemeMode,
    NEWTAB_THEME_MODE_STORAGE_KEY,
    normalizeNewtabThemeMode,
    isNewtabThemeFollowingGlobal,
    normalizeNewtabThemeScope,
    NEWTAB_THEME_SCOPE_STORAGE_KEY,
    pageState: {
      get modeBadge() {
        return modeBadge;
      },
      get zenModeEnabled() {
        return zenModeEnabled;
      },
      set zenModeEnabled(value) {
        zenModeEnabled = value;
      },
      get currentThemeMode() {
        return currentThemeMode;
      },
      get inputParts() {
        return inputParts;
      },
      get bookmarkTopbarRuntime() {
        return bookmarkTopbarRuntime;
      },
      get currentBookmarkCount() {
        return currentBookmarkCount;
      },
      get newtabThemeScope() {
        return newtabThemeScope;
      },
      set newtabThemeScope(value) {
        newtabThemeScope = value;
      },
      get globalThemeMode() {
        return globalThemeMode;
      },
      set globalThemeMode(value) {
        globalThemeMode = value;
      },
      get newtabThemeMode() {
        return newtabThemeMode;
      },
      set newtabThemeMode(value) {
        newtabThemeMode = value;
      }
    }
  });

  suggestionsView = NEWTAB_SUGGESTIONS_VIEW.createSuggestionsView({
    document,
    container: suggestionsContainer,
    items: suggestionItems,
    t,
    formatMessage,
    getRiSvg,
    sanitizeDisplayText,
    formatTabRankDebugText,
    isTabRankScoreDebugEnabled: () => tabRankScoreDebugEnabled,
    shouldBlockFaviconForHost,
    isLocalNetworkHost,
    getHostFromUrl,
    getUrlDisplay,
    isSimpleModeEnabled: () => simpleModeEnabled,
    getThemeHostForSuggestion,
    getImmediateThemeForSuggestion,
    getThemeForSuggestion,
    shouldUseUrlFallbackThemeForSuggestion,
    getThemeForMode,
    getHoverColors,
    getNeutralHoverActionColors,
    applyThemeVariables,
    applyMarkVariables,
    applyFaviconOpticalAlignment,
    applyFaviconOpticalShift,
    applyFallbackIcon,
    setFaviconSrcWithAnimation,
    attachFaviconWithFallbacks,
    reportMissingIcon,
    preloadIcon,
    getChromeFaviconUrl,
    getBrowserPageFaviconUrl,
    getPageFaviconRenderCandidates,
    setSuggestionsVisible,
    onSetSelectedIndex: (nextIndex) => {
      selectedIndex = nextIndex;
    },
    getSelectedIndex: () => selectedIndex,
    onSwitchToTab: (tab, event) => {
      if (shouldOpenSearchResultInBackgroundTab(event) && tab && tab.url) {
        chrome.runtime.sendMessage({
          action: 'createTab',
          url: tab.url,
          disposition: 'backgroundTab'
        });
        return;
      }
      chrome.runtime.sendMessage({
        action: 'switchToTab',
        tabId: tab.id
      });
    },
    onActivateSuggestion: activateRenderedSuggestion,
    onDeleteHistory: deleteRenderedHistorySuggestion,
    onCopyUrl: copySearchResultUrl,
    showTopActionTooltip,
    hideTopActionTooltip,
    bindCursorTooltip,
    getSearchActionLabel,
    getSiteSearchDisplayName,
    isAiSiteSearchProvider,
    getDefaultSearchEngineThemeUrl,
    getBrandAccentForUrl,
    buildThemeFromAccent,
    actionModel: SUGGESTION_ACTION_MODEL,
    shouldSwitchMatchedTabSuggestion,
    defaultTheme,
    urlHighlightTheme,
    openTabSuggestionLimit: NEWTAB_OPEN_TAB_SUGGESTION_LIMIT
  });

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

  inputParts = createSearchInput({
    useImportantStyles: false,
    useInlineBaseStyles: false,
    containerId: '_x_extension_newtab_input_container_2024_unique_',
    inputId: '_x_extension_newtab_search_input_2024_unique_',
    iconId: '_x_extension_newtab_search_icon_2024_unique_',
    placeholder: t('search_placeholder', defaultPlaceholderText),
    modeBadge: {
      id: '_x_extension_newtab_mode_badge_2024_unique_',
      className: 'x-lumno-search-input-mode__badge',
      surface: 'newtab',
      visible: false
    },
    containerStyleOverrides: {
      'border-radius': '24px',
      'background': 'transparent',
      'border': 'none',
      'box-shadow': 'none',
      'min-width': '100%',
      'min-height': '44px',
      'height': '44px',
      'position': 'relative',
      'z-index': '2',
      'overflow': 'visible'
    },
    inputStyleOverrides: {
      'border-bottom': 'none',
      'color': 'var(--x-nt-text, #111827)',
      'caret-color': 'var(--x-nt-link, #2563EB)',
      'padding': '8px 64px 8px 44px',
      'min-height': '44px',
      'height': '44px',
      'line-height': '24px'
    },
    iconStyleOverrides: {
      'color': 'var(--x-nt-subtext, #6B7280)',
      'left': '7px'
    },
    rightIconStyleOverrides: {
      '--x-ext-input-right-icon-inset': '7px',
      '--x-ext-input-icon-hover-bg': 'var(--x-nt-settings-action-hover-bg, rgba(148, 163, 184, 0.16))',
      '--x-ext-input-icon-hover': 'var(--x-nt-settings-action-hover-color, #4B5563)',
      cursor: 'pointer'
    },
    onInput: function(event) {
      searchSuggestionsDismissed = false;
      if (!isApplyingSearchInputHistory) {
        searchInputHistoryController.resetNavigation();
      }
      const rawValue = event.target.value;
      const query = rawValue.trim();
      updateModeBadge(rawValue);
      const inputType = event && event.inputType;
      const isPaste = inputType === 'insertFromPaste';
      const isDelete = inputType && inputType.startsWith('delete');
      if (isDelete) {
        lastDeletionAt = Date.now();
      }
      if (imeKeyGuard.isComposing()) {
        latestQuery = query;
        latestRawQuery = rawValue;
        return;
      }
      if (!query) {
        latestQuery = '';
        latestRawQuery = '';
        clearAutocomplete();
        if (remoteSuggestionDebounceTimer) {
          clearTimeout(remoteSuggestionDebounceTimer);
          remoteSuggestionDebounceTimer = null;
        }
        if (suggestionRequestWatchdogTimer) {
          clearTimeout(suggestionRequestWatchdogTimer);
          suggestionRequestWatchdogTimer = null;
        }
        clearSearchSuggestions();
        return;
      }
      latestRawQuery = rawValue;
      clearAutocomplete();
      if (!localSearchScopeState && isSlashCommandInput(query)) {
        latestQuery = query;
        renderSuggestions([], query);
        return;
      }
      const directUrlSuggestion = getDirectUrlSuggestion(query);
      const hasCachedOpenTabMatch = Boolean(
        directUrlSuggestion &&
        typeof directUrlSuggestion._xMatchedTabId === 'number'
      );
      if (isPaste || directUrlSuggestion) {
        latestQuery = query;
        if (!directUrlSuggestion || hasCachedOpenTabMatch) {
          renderPendingSuggestions(query);
        }
        requestSuggestions(query, {
          immediate: true,
          deferInitialDirectNavigationRender: Boolean(
            directUrlSuggestion && !hasCachedOpenTabMatch
          )
        });
        return;
      }
      requestSuggestions(query);
    },
    onKeyDown: function(event) {
      syncSuggestionActionModifiersFromEvent(event);
      dismissAutocompletePreviewOnNonTabKey(event);
      const suggestionNavigationKey =
        SUGGESTION_NAVIGATION.getSuggestionNavigationKey(event, {
          macosCtrlEnabled: macosCtrlSuggestionNavigationEnabled,
          navigatorLike: typeof navigator === 'object' && navigator ? navigator : null
        });
      if (event.key !== 'Backspace' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        latestRawQuery = inputParts.input.value;
        latestQuery = inputParts.input.value.trim();
      }
      if (event.key === 'Escape' && siteSearchState) {
        event.preventDefault();
        clearSiteSearch();
        return;
      }
      if (event.key === 'Escape' && localSearchScopeState) {
        event.preventDefault();
        clearLocalSearchScope();
        const fallbackQuery = inputParts.input.value.trim();
        if (fallbackQuery) {
          requestSuggestions(fallbackQuery, { immediate: true });
        } else {
          clearSearchSuggestions();
        }
        return;
      }
      if (event.key === 'Backspace' && siteSearchState && !inputParts.input.value) {
        if (!shouldRemoveSearchModeTagOnBackspace(event)) {
          return;
        }
        clearSiteSearch();
        return;
      }
      if (event.key === 'Backspace' && localSearchScopeState && !inputParts.input.value) {
        if (!shouldRemoveSearchModeTagOnBackspace(event)) {
          return;
        }
        clearLocalSearchScope();
        clearSearchSuggestions();
        return;
      }
      if (isImeCompositionEvent(event)) {
        return;
      }
      const inputHistoryDirection =
        SEARCH_INPUT_HISTORY.getShortcutDirection(event);
      if (inputHistoryDirection) {
        event.preventDefault();
        event.stopPropagation();
        const result = searchInputHistoryController.move(
          inputHistoryDirection,
          inputParts.input.value
        );
        if (result.handled) {
          isApplyingSearchInputHistory = true;
          try {
            inputParts.input.value = result.value;
            inputParts.input.setSelectionRange(result.value.length, result.value.length);
            inputParts.input.dispatchEvent(new Event('input', { bubbles: true }));
          } finally {
            isApplyingSearchInputHistory = false;
          }
        }
        return;
      }
      if (suggestionNavigationKey) {
        if (suggestionItems.length === 0) {
          return;
        }
        event.preventDefault();
        let didWrap = false;
        if (suggestionNavigationKey === 'ArrowDown') {
          if (selectedIndex === -1) {
            const autoIndex = getAutoHighlightIndex();
            selectedIndex = autoIndex >= 0
              ? (autoIndex + 1) % suggestionItems.length
              : 0;
            didWrap = autoIndex >= 0 && selectedIndex === 0;
          } else {
            const previousIndex = selectedIndex;
            selectedIndex = (selectedIndex + 1) % suggestionItems.length;
            didWrap = previousIndex === suggestionItems.length - 1 && selectedIndex === 0;
          }
        } else {
          if (selectedIndex === 0) {
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
              selectedIndex = suggestionItems.length - 1;
              didWrap = true;
            }
          } else {
            selectedIndex = selectedIndex - 1;
          }
        }
        updateSelection();
        scrollSelectedSuggestionIntoView(
          suggestionNavigationKey === 'ArrowDown' ? 'down' : 'up',
          didWrap
        );
        return;
      }
      if (event.key === 'Tab' && handleTabKey) {
        handleTabKey(event);
        return;
      }
      if (event.key !== 'Enter') {
        return;
      }
      const query = event.target.value.trim();
      if (!query) {
        return;
      }
      searchInputHistoryController.record(query);
      const commandMatch = localSearchScopeState ? null : getCommandMatch(query);
      if (commandMatch && selectedIndex === -1) {
        if (commandMatch.command.type === 'commandNewTab') {
          chrome.runtime.sendMessage({ action: 'openNewTab' });
          return;
        }
        if (commandMatch.command.type === 'commandSettings') {
          chrome.runtime.sendMessage({ action: 'openOptionsPage' });
          return;
        }
      }
      if (!localSearchScopeState && isModeCommand(query)) {
        setVisibleThemeMode(getNextThemeMode(currentThemeMode));
        return;
      }
      if (!localSearchScopeState && isZenCommand(query)) {
        setZenModeEnabled(!zenModeEnabled);
        return;
      }
      const executeSuggestion = (selectedSuggestion, event, activeSuggestionIndex) => {
        if (!selectedSuggestion) {
          return false;
        }
        const activeItem = Number.isInteger(activeSuggestionIndex)
          ? suggestionItems[activeSuggestionIndex]
          : null;
        if (selectedSuggestion.type === 'modeSwitch') {
          setVisibleThemeMode(selectedSuggestion.nextMode);
          return true;
        }
        if (selectedSuggestion.type === 'zenSwitch') {
          setZenModeEnabled(selectedSuggestion.nextEnabled);
          return true;
        }
        if (selectedSuggestion.type === 'commandNewTab') {
          chrome.runtime.sendMessage({ action: 'openNewTab' });
          return true;
        }
        if (selectedSuggestion.type === 'commandSettings') {
          chrome.runtime.sendMessage({ action: 'openOptionsPage' });
          return true;
        }
        if (selectedSuggestion.type === 'siteSearchPrompt' && selectedSuggestion.provider) {
          activateSiteSearch(selectedSuggestion.provider);
          focusSearchInputPreservingScroll();
          return true;
        }
        if (selectedSuggestion.provider && selectedSuggestion.searchQuery) {
          return runSiteSearchProviderQuery(
            selectedSuggestion.provider,
            selectedSuggestion.searchQuery,
            shouldOpenSearchResultInBackgroundTab(event) ? 'backgroundTab' : 'currentTab'
          );
        }
        if (shouldSwitchMatchedTabSuggestion(selectedSuggestion, activeSuggestionIndex)) {
          openMatchedTabSuggestion(selectedSuggestion, event, activeItem, query);
          return true;
        }
        if (shouldOpenSearchResultInBackgroundTab(event) && selectedSuggestion.url) {
          return openSearchResultUrl(selectedSuggestion, query, event);
        }
        if (selectedSuggestion.forceSearch && selectedSuggestion.searchQuery) {
          navigateToQuery(selectedSuggestion.searchQuery, true);
          return true;
        }
        if (selectedSuggestion.url) {
          return openSearchResultUrl(selectedSuggestion, query, event);
        }
        return false;
      };
      if (selectedIndex >= 0 && currentSuggestions[selectedIndex]) {
        if (executeSuggestion(currentSuggestions[selectedIndex], event, selectedIndex)) {
          return;
        }
      } else {
        const autoIndex = getAutoHighlightIndex();
        if (autoIndex >= 0 && currentSuggestions[autoIndex]) {
          if (executeSuggestion(currentSuggestions[autoIndex], event, autoIndex)) {
            return;
          }
        }
      }
      if (!localSearchScopeState && isSlashCommandInput(query)) {
        renderSuggestions([], query);
        return;
      }
      if (localSearchScopeState) {
        return;
      }
      if (siteSearchState) {
        if (runSiteSearchProviderQuery(
          siteSearchState,
          query,
          shouldOpenSearchResultInBackgroundTab(event) ? 'backgroundTab' : 'currentTab'
        )) {
          return;
        }
      }
      const currentRawInput = (latestRawQuery || inputParts.input.value || '').trim();
      if (inlineSearchState && inlineSearchState.isAuto &&
          inlineSearchState.rawInput === currentRawInput) {
        if (inlineSearchState.provider && inlineSearchState.query) {
          if (runSiteSearchProviderQuery(
            inlineSearchState.provider,
            inlineSearchState.query,
            shouldOpenSearchResultInBackgroundTab(event) ? 'backgroundTab' : 'currentTab'
          )) {
            return;
          }
        } else if (inlineSearchState.url) {
          openSearchResultUrl({
            url: inlineSearchState.url,
            title: inlineSearchState.url,
            type: 'inlineSiteSearch'
          }, query, event);
          return;
        }
      }
      if (autocompleteState && autocompleteState.url) {
        openSearchResultUrl({
          url: autocompleteState.url,
          title: autocompleteState.title || '',
          type: 'autocomplete'
        }, query, event);
        return;
      }
      resolveQuickNavigation(query).then((targetUrl) => {
        const backgroundOpen = shouldOpenSearchResultInBackgroundTab(event);
        if (targetUrl) {
          openSearchResultUrl({
            url: targetUrl,
            title: query,
            type: 'quickNavigation'
          }, query, event);
          return;
        }
        if (backgroundOpen) {
          chrome.runtime.sendMessage({
            action: 'searchOrNavigate',
            query: query,
            disposition: 'backgroundTab'
          });
          return;
        }
        navigateToQuery(query);
      });
    }
  });
  markNewtabStartupMilestone('search-input-created');

  const handleBackgroundPointerFocus = NEWTAB_BACKGROUND_SEARCH_FOCUS.createBackgroundFocusHandler({
    getBackgroundTargets: () => [document.body, root, searchLayer],
    getSearchValue: () => inputParts.input.value,
    dismissSearchResults: dismissSearchSuggestionsFromBackground,
    focusSearch: focusSearchInputPreservingScroll
  });

  window.addEventListener('keydown', finishNewtabEntryAnimation, true);
  window.addEventListener('pointerdown', finishNewtabEntryAnimation, true);
  window.addEventListener('keydown', handleGlobalTypingFocus, true);
  window.addEventListener('focus', () => refreshFallbackShortcut(true), true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refreshFallbackShortcut(false);
    }
  }, true);
  window.addEventListener('pointerdown', handleBackgroundPointerFocus, true);
  modeBadge = inputParts.modeBadge;
  const searchInput = inputParts.input;
  searchInput.addEventListener('focus', restoreDismissedSearchSuggestions);
  searchInputRef = searchInput;
  const searchScopeIcon = inputParts.icon;
  const rightIcon = inputParts.rightIcon;
  const searchScopeTooltipText = () => t(
    'shortcut_reference_search_open_scope_menu_title',
    '打开搜索范围面板'
  );
  function setSearchScopeIconVisualState(active) {
    if (!searchScopeIcon) {
      return;
    }
    const enabled = searchScopeIcon.getAttribute('aria-disabled') !== 'true';
    searchScopeIcon.dataset.hoverActive = active && enabled ? 'true' : 'false';
  }
  function setSearchScopeIconEnabled(enabled) {
    if (!searchScopeIcon) {
      return;
    }
    const nextEnabled = enabled !== false;
    searchScopeIcon.setAttribute('aria-disabled', nextEnabled ? 'false' : 'true');
    searchScopeIcon.setAttribute('tabindex', nextEnabled ? '0' : '-1');
    searchScopeIcon.setAttribute('aria-label', searchScopeTooltipText());
    if (nextEnabled) {
      searchScopeIcon.setAttribute('data-tooltip', searchScopeTooltipText());
      return;
    }
    searchScopeIcon.removeAttribute('data-tooltip');
    hideSearchInputCursorTooltip();
    setSearchScopeIconVisualState(false);
    if (typeof searchScopeIcon.blur === 'function') {
      searchScopeIcon.blur();
    }
  }
  function activateSearchScopeIcon(event) {
    if (!searchScopeIcon || searchScopeIcon.getAttribute('aria-disabled') === 'true') {
      return;
    }
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    if (event && typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }
    hideSearchInputCursorTooltip();
    setSearchScopeIconVisualState(false);
    if (inputModeController &&
        typeof inputModeController.resetModeMenuDoubleTab === 'function') {
      inputModeController.resetModeMenuDoubleTab();
    }
    openSearchModeMenuFromDoubleTab();
    if (searchScopeIcon && typeof searchScopeIcon.blur === 'function') {
      searchScopeIcon.blur();
    }
  }
  if (searchScopeIcon) {
    searchScopeIcon.dataset.searchScopeAction = 'true';
    searchScopeIcon.setAttribute('role', 'button');
    setSearchScopeIconEnabled(true);
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
    bindSearchInputCursorTooltip(searchScopeIcon, searchScopeTooltipText);
  }
  function openWordmarkUrl(event) {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    if (event && typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }
    openExternalNewTabUrl(COMMUNITY_LINKS.getStoreListing().url, event);
  }
  const shouldAnimateWordmarkEntry = !shouldSkipNewtabEntryMotion();
  topContentContainer = document.createElement('div');
  topContentController = NEWTAB_TOP_CONTENT.createTopContentController(
    topContentContainer,
    {
      onActivate(disposition) {
        openWordmarkUrl(disposition);
      },
      onEntryAnimationComplete(animationName) {
        if (!animationName || animationName === WORDMARK_ENTRY_ANIMATION_NAME) {
          finishWordmarkEntryAnimation();
        }
      }
    }
  );
  renderNewtabTopContent(shouldAnimateWordmarkEntry);
  applyNewtabTopContentVisibility();
  function updateNoticeClaimsSessionSlot() {
    return Boolean(
      updateNoticeController &&
      typeof updateNoticeController.hasSessionSlot === 'function' &&
      updateNoticeController.hasSessionSlot()
    );
  }
  updateNoticeController = UPDATE_NOTICE.createUpdateNotice({
    documentObj: document,
    featureHints: FEATURE_HINTS,
    chromeApi: chrome,
    surface: 'newtab',
    t,
    getRiSvg,
    onSessionSlotClaimed() {
      if (engagementNoticeController &&
          typeof engagementNoticeController.suppressForSession === 'function') {
        engagementNoticeController.suppressForSession();
      }
    },
    onDetailsClick(_notice, event) {
      chrome.runtime.sendMessage({
        action: 'openReleasePage',
        reason: 'notice',
        disposition: getOpenDisposition(event, 'newTab')
      });
    }
  });
  function createNewtabEngagementNoticeController() {
    return ENGAGEMENT_NOTICE.createEngagementNotice({
      documentObj: document,
      featureHints: FEATURE_HINTS,
      chromeApi: chrome,
      surface: 'newtab',
      locale: getFeedbackWebLocale(),
      t,
      getRiSvg,
      exposureGate: updateNoticeController && updateNoticeController.ready,
      canShow() {
        const updateNoticeVisible = Boolean(
          updateNoticeController &&
          updateNoticeController.element &&
          updateNoticeController.element.getAttribute('data-visible') === 'true'
        );
        return !updateNoticeVisible &&
          !updateNoticeClaimsSessionSlot() &&
          document.visibilityState === 'visible' &&
          !String(inputParts.input.value || '').trim() &&
          document.body.getAttribute('data-nt-suggestions-open') !== 'true' &&
          !isFeedbackPopoverOpen();
      },
      onReview(event) {
        const links = feedbackLinks || LUMNO_FEEDBACK_LINKS_FALLBACK;
        openFeedbackExternalUrl(
          COMMUNITY_LINKS.getReviewUrl(links),
          getOpenDisposition(event, 'newTab')
        );
      },
      onCommunity(event) {
        const disposition = getOpenDisposition(event, 'newTab');
        const communityUrlPromise = ENGAGEMENT_NOTICE.loadCommunityUrl({
          force: true,
          locale: getFeedbackWebLocale()
        });
        communityUrlPromise.then((url) => {
          openFeedbackExternalUrl(url, disposition);
        });
      }
    });
  }
  inputParts.input.addEventListener('input', function() {
    if (!String(inputParts.input.value || '').trim() ||
        !engagementNoticeController ||
        typeof engagementNoticeController.recordMeaningfulUse !== 'function') {
      return;
    }
    engagementNoticeController.recordMeaningfulUse();
  });

  if (rightIcon) {
    const settingsTooltipText = () => formatMessage(
      'command_settings',
      '打开设置',
      { name: 'Lumno' }
    );
    rightIcon.setAttribute('aria-label', settingsTooltipText());
    rightIcon.setAttribute('data-tooltip', settingsTooltipText());
    bindSearchInputCursorTooltip(rightIcon, settingsTooltipText);
    rightIcon.addEventListener('click', function(event) {
      event.preventDefault();
      event.stopPropagation();
      hideSearchInputCursorTooltip();
      dismissWebdavFeatureHint();
      const runtime = typeof chrome !== 'undefined' && chrome && chrome.runtime
        ? chrome.runtime
        : null;
      if (runtime && typeof runtime.openOptionsPage === 'function') {
        runtime.openOptionsPage();
        return;
      }
      const optionsUrl = runtime &&
          typeof runtime.getURL === 'function'
        ? EXTENSION_ROUTES.buildOptionsUrl(chrome)
        : getExtensionResourceUrl('src/options/options.html');
      window.open(optionsUrl, '_blank');
    });
    // Above the settings icon, point to WebDAV sync under Account & sync until it is dismissed.
    if (typeof FEATURE_HINTS.createFeatureHint === 'function' &&
        document.documentElement.getAttribute('data-nt-focus-route-pending') !== 'true') {
      webdavFeatureHintController = FEATURE_HINTS.createFeatureHint({
        documentObj: document,
        windowObj: window,
        chromeApi: chrome,
        definition: 'newtab-webdav-sync',
        visibilityGate: newtabEntryAnimationReadyPromise,
        t,
        getRiSvg,
        onLinkClick(event) {
          dismissWebdavFeatureHint();
          chrome.runtime.sendMessage({
            action: 'openOptionsPage',
            hash: 'account',
            disposition: getOpenDisposition(event, 'newTab')
          });
        }
      });
      if (webdavFeatureHintController && webdavFeatureHintController.element) {
        inputParts.container.appendChild(webdavFeatureHintController.element);
      }
    }
  }

  function dismissWebdavFeatureHint() {
    if (webdavFeatureHintController && typeof webdavFeatureHintController.dismiss === 'function') {
      webdavFeatureHintController.dismiss();
    }
  }

  function updateInputRightPadding() {
    if (inputModeController) {
      inputModeController.updateLayout();
    }
  }

  function setNewtabActionControlVisibility(element, visible) {
    if (!element) {
      return;
    }
    const nextVisible = visible !== false;
    element.hidden = !nextVisible;
    element.style.setProperty('display', nextVisible ? '' : 'none');
    element.setAttribute('aria-hidden', nextVisible ? 'false' : 'true');
    element.inert = !nextVisible;
    if (nextVisible) {
      element.removeAttribute('inert');
    } else {
      element.setAttribute('inert', '');
    }
  }

  function applyNewtabActionButtonVisibility() {
    if (!newtabFeedbackButtonVisible && feedbackReactController) {
      closeFeedbackPopover();
    }
    if (!newtabAppearanceButtonVisible && wallpaperRuntime) {
      closeWallpaperPanel();
    }
    setNewtabActionControlVisibility(feedbackControl, newtabFeedbackButtonVisible);
    setNewtabActionControlVisibility(wallpaperControl, newtabAppearanceButtonVisible);
  }

  function loadNewtabActionButtonVisibility() {
    if (!storageArea) {
      newtabFeedbackButtonVisible = true;
      newtabAppearanceButtonVisible = true;
      applyNewtabActionButtonVisibility();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      storageArea.get([
        NEWTAB_FEEDBACK_BUTTON_VISIBLE_STORAGE_KEY,
        NEWTAB_APPEARANCE_BUTTON_VISIBLE_STORAGE_KEY
      ], (result) => {
        const stored = result || {};
        const rawFeedback = stored[NEWTAB_FEEDBACK_BUTTON_VISIBLE_STORAGE_KEY];
        const rawAppearance = stored[NEWTAB_APPEARANCE_BUTTON_VISIBLE_STORAGE_KEY];
        newtabFeedbackButtonVisible = normalizeNewtabFeedbackButtonVisible(rawFeedback);
        newtabAppearanceButtonVisible = normalizeNewtabAppearanceButtonVisible(rawAppearance);
        const repairs = {};
        if (rawFeedback !== newtabFeedbackButtonVisible) {
          repairs[NEWTAB_FEEDBACK_BUTTON_VISIBLE_STORAGE_KEY] = newtabFeedbackButtonVisible;
        }
        if (rawAppearance !== newtabAppearanceButtonVisible) {
          repairs[NEWTAB_APPEARANCE_BUTTON_VISIBLE_STORAGE_KEY] = newtabAppearanceButtonVisible;
        }
        applyNewtabActionButtonVisibility();
        if (Object.keys(repairs).length > 0) {
          storageArea.set(repairs);
        }
        resolve();
      });
    });
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

  if (storageArea) {
    storageArea.get([
      SEARCH_RESULT_PRIORITY_STORAGE_KEY,
      SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY,
      SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY,
      OVERLAY_TAB_PRIORITY_STORAGE_KEY
    ], (result) => {
      const raw = result ? result[SEARCH_RESULT_PRIORITY_STORAGE_KEY] : null;
      const nextMode = normalizeSearchResultPriority(raw);
      searchResultPriorityMode = nextMode;
      enabledSearchResultSourceTypes = normalizeEnabledSearchResultSourceTypes(
        result ? result[SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY] : null
      );
      const rawDisplayLimit = result ? result[SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY] : null;
      searchResultDisplayLimit = normalizeSearchResultDisplayLimit(rawDisplayLimit);
      openTabQuickSwitchEnabled = normalizeOverlayTabPriorityMode(
        result ? result[OVERLAY_TAB_PRIORITY_STORAGE_KEY] : null
      );
      if (raw !== nextMode) {
        storageArea.set({ [SEARCH_RESULT_PRIORITY_STORAGE_KEY]: nextMode });
      }
      if (rawDisplayLimit !== searchResultDisplayLimit) {
        storageArea.set({ [SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY]: searchResultDisplayLimit });
      }
      if (latestQuery) {
        renderSuggestions(lastSuggestionResponse, latestQuery);
      }
    });
  }
  const defaultPlaceholder = searchInput.placeholder;
  const defaultCaretColor = searchInput.style.caretColor || '#7DB7FF';
  const inputModePrefixTransition = 'opacity 140ms cubic-bezier(0.22, 1, 0.36, 1), transform 160ms cubic-bezier(0.22, 1, 0.36, 1), background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease, color 140ms ease';
  inputModeController = SEARCH_INPUT_MODE.createInputModeController(inputParts, {
    surface: 'newtab',
    useImportantStyles: false,
    prefixTransition: inputModePrefixTransition,
    defaultPlaceholder,
    defaultCaretColor,
    modeBadgeElement: modeBadge,
    rightReserveBase: 64,
    rightAnchorOffset: 52,
    baseInputPaddingLeft: 44,
    getThemeForMode,
    defaultTheme,
    defaultAccentColor,
    parseCssColor,
    rgbToCss,
    isDarkMode: isNewtabDarkMode,
    getProviderIcon,
    resolveProviderIconUrl: (provider, iconUrl) => getPageFaviconUrlResolver().getProviderFaviconUrl(
      getProviderFaviconPageUrl(provider), iconUrl
    ),
    getProviderThemeHost,
    getThemeForProvider,
    getSiteSearchPrefixText,
    getSiteSearchDisplayName,
    isAiSiteSearchProvider,
    attachFaviconData: attachInputModeFaviconData,
    attachProviderIcon: attachInputModeProviderIcon,
    preferDirectProviderIcons: true,
    formatMessage,
    modeMenuCursorTooltipController: bookmarkCursorTooltipController,
    getModeMenuItems: getSearchModeMenuItems,
    onModeMenuSelect: selectSearchModeMenuItem,
    onModeTagRemovalConfirmation: () => {
      showToast(t(
        'search_scope_remove_confirmation',
        'Press Backspace again to remove the scope.'
      ));
    },
    onModeTagRemovalConfirmationReset: hideToast,
    onModeTagActiveChange: (active) => {
      setSearchScopeIconEnabled(!active);
    },
    onModeMenuLayoutChange: syncSearchModeMenuResultOffset,
    isTabHintSuppressed: () => Boolean(siteSearchState || localSearchScopeState)
  });
  syncSearchModeMenuResultOffset();
  if (typeof window.ResizeObserver === 'function') {
    const searchModeMenuResultResizeObserver = new window.ResizeObserver(
      syncSearchModeMenuResultOffset
    );
    searchModeMenuResultResizeObserver.observe(suggestionsContainer);
  }
  siteSearchTabHint = inputModeController.tabHintElement;
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
  markNewtabStartupMilestone('search-controller-created');

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

  function clearSiteSearchPrefix() {
    if (inputModeController) {
      inputModeController.clearProviderPrefix();
    }
  }

  let newtabResizeFrame = 0;
  let newtabResizeSettleTimer = 0;
  function handleNewtabResize() {
    newtabResizeFrame = 0;
    const previousBookmarkLimit = getBookmarkLimit();
    applyNewtabWidthMode();
    applyNewtabShortcutColumns();
    const recentLayoutBefore = recentLoadedOnce && shouldAnimateNewtabLayoutShift()
      ? captureRecentCardLayout()
      : null;
    const recentColumnsChanged = applyRecentGridColumns();
    const bookmarkColumnsChanged = applyBookmarkGridColumns();
    updateSiteSearchPrefixLayout();
    if (bookmarkColumnsChanged && bookmarkLoadedOnce) {
      keepBookmarkPageAnchorAfterLimitChange(previousBookmarkLimit);
      renderCurrentBookmarkPage();
    }
    updateBookmarkGridHeightLock();
    updateBookmarkSectionPosition({
      preserveSearchEntryLayout: true,
      stabilizeDockDensity: true
    });
    positionBookmarkCascadeLevels();
    updateSuggestionsFloatingLayout();
    if (recentColumnsChanged && recentLoadedOnce) {
      cancelRecentResizeLayoutAnimations();
      renderRecentSites(recentSourceItems);
      animateRecentResizeLayout(recentLayoutBefore);
    }
  }

  window.addEventListener('resize', () => {
    newtabReadyViewportRevision += 1;
    newtabResizeLayoutLocked = true;
    if (newtabResizeSettleTimer) {
      window.clearTimeout(newtabResizeSettleTimer);
    }
    newtabResizeSettleTimer = window.setTimeout(() => {
      newtabResizeSettleTimer = 0;
      const fromLayout = shouldAnimateNewtabLayoutShift()
        ? captureTopContentLayout()
        : null;
      cancelTopContentLayoutAnimations();
      newtabResizeLayoutLocked = false;
      updateBookmarkSectionPosition({ releaseDockDensityLock: true });
      animateTopContentLayout(fromLayout);
    }, NEWTAB_RESIZE_DENSITY_SETTLE_MS);
    if (newtabReadyRequested &&
        document.body &&
        document.body.getAttribute('data-nt-ready') !== '1') {
      scheduleNewtabReadyAfterViewportSettle();
    }
    if (newtabResizeFrame) {
      return;
    }
    newtabResizeFrame = window.requestAnimationFrame(handleNewtabResize);
  }, { passive: true });

  handleTabKey = function(event) {
    if (!event || event.defaultPrevented) {
      return false;
    }
    if (inputModeController &&
        typeof inputModeController.handleModeMenuTabFocusToggle === 'function' &&
        inputModeController.handleModeMenuTabFocusToggle(event)) {
      return true;
    }
    if (inputModeController &&
        typeof inputModeController.shouldOpenModeMenuForActiveModeOnTab === 'function' &&
        inputModeController.shouldOpenModeMenuForActiveModeOnTab(event)) {
      inputModeController.openModeMenu('none');
      return true;
    }
    if (siteSearchState || localSearchScopeState) {
      return false;
    }
    const rawValue = inputParts.input.value;
    const rawTrigger = latestRawQuery || rawValue;
    const triggerInput = (rawTrigger || rawValue).trim();
    if (!triggerInput && inputModeController &&
        typeof inputModeController.shouldOpenModeMenuOnDoubleTab === 'function') {
      const shouldOpenModeMenu = inputModeController.shouldOpenModeMenuOnDoubleTab(event);
      if (shouldOpenModeMenu) {
        openSearchModeMenuFromDoubleTab();
      }
      return Boolean(event.defaultPrevented);
    }
    if (siteSearchTriggerState &&
        siteSearchTriggerState.rawInput === triggerInput &&
        siteSearchTriggerState.provider) {
      event.preventDefault();
      activateSiteSearch(siteSearchTriggerState.provider);
      return true;
    }
    if (localSearchScopeTriggerState &&
        localSearchScopeTriggerState.rawInput === triggerInput &&
        localSearchScopeTriggerState.scope) {
      event.preventDefault();
      return activateLocalSearchScope(localSearchScopeTriggerState.scope);
    }
    if (triggerInput) {
      event.preventDefault();
      const siteProviders = (siteSearchProvidersCache && siteSearchProvidersCache.length > 0)
        ? siteSearchProvidersCache
        : defaultSiteSearchProviders;
      const providers = getSearchTriggerProviders(
        siteProviders,
        aggregateSearchesCache
      );
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
      Promise.all([
        getSiteSearchProviders(),
        getAggregateSearches(),
        getShortcutRules()
      ]).then(([items, definitions, rules]) => {
        if (siteSearchState || localSearchScopeState ||
            String(inputParts.input.value || '').trim() !== triggerInput) {
          return;
        }
        const asyncTopSiteMatch = getTopSiteMatchCandidate(currentSuggestions, triggerInput);
        const asyncProvider = getSiteSearchTriggerCandidate(
          triggerInput,
          getSearchTriggerProviders(items, definitions),
          asyncTopSiteMatch
        );
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
          inputParts.input.value = autocompleteState.completion;
          inputParts.input.setSelectionRange(autocompleteState.completion.length, autocompleteState.completion.length);
          latestRawQuery = autocompleteState.completion;
          latestQuery = autocompleteState.completion.trim();
          autocompleteState = null;
          inputParts.input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      return true;
    }
    if (autocompleteState && autocompleteState.completion) {
      event.preventDefault();
      inputParts.input.value = autocompleteState.completion;
      inputParts.input.setSelectionRange(autocompleteState.completion.length, autocompleteState.completion.length);
      latestRawQuery = autocompleteState.completion;
      latestQuery = autocompleteState.completion.trim();
      autocompleteState = null;
      inputParts.input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    return false;
  };

  document.addEventListener('keydown', function(event) {
    if (folderColorPicker && folderColorPicker.isOpen()) return;
    if (event && event.key === 'Escape' && (shortcutDragState || bookmarkDragState)) {
      finishShortcutDrag(null, { cancel: true });
      finishBookmarkDrag(null, { canceled: true });
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!event || event.defaultPrevented || event.altKey || isEditableElement(event.target)) {
      return;
    }
    const hasCommandModifier = event.metaKey || event.ctrlKey;
    if (!hasCommandModifier) {
      return;
    }
    const key = String(event.key || '').toLowerCase();
    const wantsUndo = key === 'z' && !event.shiftKey;
    const wantsRedo = (key === 'z' && event.shiftKey) ||
      (key === 'y' && event.ctrlKey && !event.metaKey);
    const direction = wantsUndo ? 'undo' : wantsRedo ? 'redo' : '';
    if (!direction || !performBookmarkMoveHistoryAction(direction)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }, true);

  document.addEventListener('keydown', function(event) {
    if (folderColorPicker && folderColorPicker.isOpen()) return;
    syncSuggestionActionModifiersFromEvent(event);
    if (SUGGESTION_NAVIGATION.handleNumberShortcutKeyEvent(
      event,
      suggestionItems,
      suggestionsContainer,
      numberShortcutOptions
    )) {
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    if (document.activeElement !== inputParts.input) {
      return;
    }
    if (handleTabKey) {
      handleTabKey(event);
    }
  }, true);
  document.addEventListener('keyup', function(event) {
    syncSuggestionActionModifiersFromEvent(event);
    SUGGESTION_NAVIGATION.handleNumberShortcutKeyEvent(
      event,
      suggestionItems,
      suggestionsContainer,
      numberShortcutOptions
    );
  }, true);
  window.addEventListener('blur', function() {
    setSuggestionActionModifiersActive(false, false, false);
    SUGGESTION_NAVIGATION.cancelNumberShortcuts(suggestionsContainer);
  });

  getSiteSearchProviders();
  getAggregateSearches().then(() => {
    if (inputModeController && typeof inputModeController.refreshModeMenu === 'function') {
      inputModeController.refreshModeMenu();
    }
    if (latestQuery) {
      requestSuggestions(latestQuery, { immediate: true });
    }
  });

  addStorageChangeListener((changes, areaName) => {
    if (!isPrimaryStorageAreaName(areaName) || !(
      changes[SITE_SEARCH_STORAGE_KEY] ||
      changes[SITE_SEARCH_DISABLED_STORAGE_KEY] ||
      changes[AGGREGATE_SEARCH_STORAGE_KEY]
    )) {
      return;
    }
    if (changes[AGGREGATE_SEARCH_STORAGE_KEY]) {
      aggregateSearchesLoadVersion += 1;
      aggregateSearchesLoadPromise = null;
      aggregateSearchesCache = AGGREGATE_SEARCH_STORE.normalizeAggregateSearches(
        changes[AGGREGATE_SEARCH_STORAGE_KEY].newValue
      );
      if (isAggregateSearchProvider(siteSearchState)) {
        const currentId = String(siteSearchState.aggregateId || '');
        const updatedDefinition = aggregateSearchesCache.find(
          (item) => String(item && item.id ? item.id : '') === currentId
        );
        const updatedProvider = isAggregateSearchDefinitionAvailable(
          updatedDefinition,
          getSearchModeProviders()
        )
          ? createAggregateSearchScopeProvider(updatedDefinition)
          : null;
        if (updatedProvider) {
          siteSearchState = updatedProvider;
          setSiteSearchPrefix(updatedProvider, defaultTheme, { animate: false });
        } else {
          clearSiteSearch();
        }
      }
      if (inputModeController && typeof inputModeController.refreshModeMenu === 'function') {
        inputModeController.refreshModeMenu();
      }
      if (latestQuery) {
        requestSuggestions(latestQuery, { immediate: true });
      }
    }
    if (!changes[SITE_SEARCH_STORAGE_KEY] && !changes[SITE_SEARCH_DISABLED_STORAGE_KEY]) {
      return;
    }
    if (!storageArea) {
      return;
    }
    const providerReload = reloadSiteSearchProvidersFromStorage();
    providerReload.promise.then(() => {
      if (providerReload.version !== siteSearchProvidersLoadVersion) {
        return;
      }
      if (isAggregateSearchProvider(siteSearchState)) {
        const activeDefinition = (aggregateSearchesCache || []).find((item) => (
          String(item && item.id ? item.id : '') === String(siteSearchState.aggregateId || '')
        ));
        if (!isAggregateSearchDefinitionAvailable(activeDefinition, siteSearchProvidersCache)) {
          clearSiteSearch();
        }
      }
      if (inputModeController && typeof inputModeController.refreshModeMenu === 'function') {
        inputModeController.refreshModeMenu();
      }
      if (latestQuery) {
        requestSuggestions(latestQuery, { immediate: true });
      }
    });
  });

  inputParts.input.addEventListener('compositionstart', function(event) {
    suggestionRequestSeq += 1;
    directNavigationSettleController.cancel();
    if (remoteSuggestionDebounceTimer) {
      clearTimeout(remoteSuggestionDebounceTimer);
      remoteSuggestionDebounceTimer = null;
    }
    if (suggestionRequestWatchdogTimer) {
      clearTimeout(suggestionRequestWatchdogTimer);
      suggestionRequestWatchdogTimer = null;
    }
    imeKeyGuard.markCompositionStart(event);
    clearAutocomplete();
  });

  inputParts.input.addEventListener('compositionend', function(event) {
    imeKeyGuard.markCompositionEnd(event);
    const rawValue = event.target.value;
    const query = rawValue.trim();
    latestQuery = query;
    latestRawQuery = rawValue;
    clearAutocomplete();
    if (!query) {
      if (remoteSuggestionDebounceTimer) {
        clearTimeout(remoteSuggestionDebounceTimer);
        remoteSuggestionDebounceTimer = null;
      }
      clearSearchSuggestions();
      return;
    }
    const directUrlSuggestion = getDirectUrlSuggestion(query);
    if (directUrlSuggestion) {
      const hasCachedOpenTabMatch =
        typeof directUrlSuggestion._xMatchedTabId === 'number';
      if (hasCachedOpenTabMatch) {
        renderPendingSuggestions(query);
      }
      requestSuggestions(query, {
        immediate: true,
        deferInitialDirectNavigationRender: !hasCachedOpenTabMatch
      });
      return;
    }
    requestSuggestions(query);
  });

  if (BOOKMARK_CASCADE_DEBUG_UI_ENABLED && bookmarkCascadeRuntime) {
    bookmarkCascadeRuntime.createDebugControls();
  }
  createWallpaperControls();
  createFeedbackControls();
  markNewtabStartupMilestone('auxiliary-controls-created');
  document.addEventListener('pointerdown', function(event) {
    if (!isFeedbackPopoverOpen()) {
      return;
    }
    const target = event && event.target ? event.target : null;
    if (feedbackControl && (target === feedbackControl || feedbackControl.contains(target))) {
      return;
    }
    closeFeedbackPopover();
  }, true);
  document.addEventListener('keydown', function(event) {
    if (!event || event.key !== 'Escape' || !isFeedbackPopoverOpen()) {
      return;
    }
    event.preventDefault();
    closeFeedbackPopover({ restoreFocus: true });
  }, true);
  document.addEventListener('pointerdown', function(event) {
    if (!isWallpaperPanelOpen()) {
      return;
    }
    const target = event && event.target ? event.target : null;
    if (wallpaperRuntime && wallpaperRuntime.containsTarget(target)) {
      return;
    }
    closeWallpaperPanel();
  }, true);
  document.addEventListener('keydown', function(event) {
    if (!event || event.key !== 'Escape' || !isWallpaperPanelOpen()) {
      return;
    }
    event.preventDefault();
    // Escape dismisses an open filter menu before it closes the whole panel.
    if (wallpaperRuntime.closeOpenMenu()) {
      return;
    }
    closeWallpaperPanel({ restoreFocus: true });
  }, true);

  document.body.insertBefore(topContentContainer, root);
  searchLayer.appendChild(inputParts.container);
  root.appendChild(searchLayer);
  const newtabUpdateNoticeAnchor = root.nextSibling;
  if (shortcutSection) {
    document.body.insertBefore(shortcutSection, newtabUpdateNoticeAnchor);
  }
  if (updateNoticeController && updateNoticeController.element) {
    document.body.insertBefore(updateNoticeController.element, newtabUpdateNoticeAnchor);
    if (typeof updateNoticeController.recordExposure === 'function') {
      updateNoticeController.recordExposure();
    }
  }
  document.body.insertBefore(suggestionsSurface, newtabUpdateNoticeAnchor);
  document.body.insertBefore(suggestionsOutline, newtabUpdateNoticeAnchor);
  document.body.insertBefore(suggestionsContainer, newtabUpdateNoticeAnchor);
  // 等首轮语言解析完成后再创建，避免默认文案在新标签页首帧短暂闪现。
  Promise.all([
    initialLanguageReadyPromise,
    updateNoticeController && updateNoticeController.ready
      ? updateNoticeController.ready
      : Promise.resolve(false)
  ]).then(() => {
    if (engagementNoticeController) {
      return;
    }
    engagementNoticeController = createNewtabEngagementNoticeController();
    if (!engagementNoticeController || !engagementNoticeController.element) {
      return;
    }
    const engagementNoticeAnchor = suggestionsSurface.parentNode === document.body
      ? suggestionsSurface
      : newtabUpdateNoticeAnchor;
    document.body.insertBefore(engagementNoticeController.element, engagementNoticeAnchor);
    if (String(inputParts.input.value || '').trim() &&
        typeof engagementNoticeController.recordMeaningfulUse === 'function') {
      engagementNoticeController.recordMeaningfulUse();
    }
  });
  if (bookmarkTopbarRuntime) {
    bookmarkTopbarRuntime.mount(document.body);
  }
  bottomDockRuntime.mount(document.body);
  const initialQuoteReadyTask = quoteRuntime
    ? quoteRuntime.mount().catch(() => true)
    : Promise.resolve(true);
  if (wallpaperControl) {
    document.body.appendChild(wallpaperControl);
  }
  if (feedbackControl) {
    document.body.appendChild(feedbackControl);
  }
  if (shortcutDialogController) {
    shortcutDialogController.mount(document.body);
  }
  if (BOOKMARK_CASCADE_DEBUG_UI_ENABLED && bookmarkCascadeRuntime && bookmarkCascadeRuntime.getDebugControl()) {
    document.body.appendChild(bookmarkCascadeRuntime.getDebugControl());
  }
  markNewtabStartupMilestone('dom-mounted');

  let recentExternalChangeTimer = 0;
  let bookmarkExternalChangeTimer = 0;
  function scheduleRecentReloadIfVisible() {
    if (document.visibilityState !== 'visible') {
      return;
    }
    if (recentExternalChangeTimer) {
      window.clearTimeout(recentExternalChangeTimer);
    }
    recentExternalChangeTimer = window.setTimeout(() => {
      recentExternalChangeTimer = 0;
      if (document.visibilityState === 'visible') {
        loadRecentSites({ force: true });
      }
    }, NEWTAB_EXTERNAL_CHANGE_DEBOUNCE_MS);
  }

  function scheduleBookmarkReloadIfVisible() {
    if (document.visibilityState !== 'visible') {
      return;
    }
    if (bookmarkExternalChangeTimer) {
      window.clearTimeout(bookmarkExternalChangeTimer);
    }
    bookmarkExternalChangeTimer = window.setTimeout(() => {
      bookmarkExternalChangeTimer = 0;
      if (document.visibilityState === 'visible') {
        loadBookmarks({ force: true });
      }
    }, NEWTAB_EXTERNAL_CHANGE_DEBOUNCE_MS);
  }

  function bindRecentAndBookmarkChangeListeners() {
    if (chrome.history && chrome.history.onVisited && chrome.history.onVisited.addListener) {
      chrome.history.onVisited.addListener(() => {
        markRecentDataDirty();
        scheduleRecentReloadIfVisible();
      });
    }
    bookmarksRuntime.subscribe((change) => {
      // Folder entries remain useful even when the bookmarks section is hidden.
      if (newtabShortcuts.some((shortcut) => shortcut.type === 'folder')) {
        refreshShortcutFolderReferences();
      }
      scheduleFolderColorSync();
      const cascadeOpen = Boolean(
        bookmarkCascadeRuntime &&
        typeof bookmarkCascadeRuntime.isOpen === 'function' &&
        bookmarkCascadeRuntime.isOpen()
      );
      if (change.isControlled) {
        markBookmarkTreeDirty({
          preserveCascadeOpen: cascadeOpen,
          skipRuntimeInvalidate: true
        });
        return;
      }
      if (change.invalidatesHistory) {
        bookmarkMoveHistory.clear();
      }
      const shouldRefreshOpenCascade = change.shouldRefreshCascade && cascadeOpen;
      markBookmarkTreeDirty({
        preserveCascadeOpen: shouldRefreshOpenCascade,
        skipRuntimeInvalidate: true
      });
      scheduleBookmarkReloadIfVisible();
      if (shouldRefreshOpenCascade) {
        refreshOpenBookmarkCascadeMenu();
      }
    });
  }

  bindRecentAndBookmarkChangeListeners();
  window.addEventListener('blur', () => {
    finishShortcutDrag(null, { cancel: true });
    finishBookmarkDrag(null, { canceled: true });
  });
  window.addEventListener('visibilitychange', handleRecentVisibilityChange);
  window.addEventListener('resize', scheduleWallpaperAdaptiveToneUpdate, { passive: true });
  window.addEventListener('scroll', () => {
    scheduleWallpaperAdaptiveToneUpdate();
    positionBookmarkCascadeLevels();
  }, { passive: true });
  bottomDockRuntime.onScroll(scheduleWallpaperAdaptiveToneUpdate, { passive: true });
  const actionButtonVisibilityReadyPromise = loadNewtabActionButtonVisibility();
  observeNewtabStartupTask('action-button-visibility', actionButtonVisibilityReadyPromise);
  const shortcutPreferencesReadyPromise = loadNewtabShortcutPreferences();
  observeNewtabStartupTask('shortcut-preferences', shortcutPreferencesReadyPromise);
  const shortcutsReadyPromise = shortcutPreferencesReadyPromise.then(loadVisibleShortcuts);
  observeNewtabStartupTask('visible-shortcuts', shortcutsReadyPromise);
  const initialShortcutsReadyTask = shortcutsReadyPromise.catch((error) => {
    console.warn('[Lumno] Deferred shortcut loading failed.', error);
    return [];
  });
  const sectionPolicyReadyPromise = Promise.all([
    loadSearchBlacklistItems(),
    loadFaviconRequestBlacklistItems(),
    loadFaviconEnhancedFetchEnabled()
  ]);
  observeNewtabStartupTask('section-policy', sectionPolicyReadyPromise);
  const initialLanguageReadyTask = bootstrapInitialLanguageMode();
  observeNewtabStartupTask('language', initialLanguageReadyTask);
  const initialMotionPreferenceReadyTask = globalThis.LumnoMotionPreferenceReady;
  const initialLayoutStorageReadyTask = startupStorageReadBatch
    ? startupStorageReadBatch.ready
    : Promise.resolve(true);
  const initialFontsReadyTask = document.fonts && document.fonts.ready &&
    typeof document.fonts.ready.then === 'function'
      ? document.fonts.ready.catch(() => true)
      : Promise.resolve(true);
  observeNewtabStartupTask('fonts', initialFontsReadyTask);
  observeNewtabStartupTask('quote', initialQuoteReadyTask);
  const initialVisualReadyPromise = Promise.all([
    initialAppearanceReadyTask,
    initialBookmarkViewModeReadyPromise,
    loadZenMode(),
    actionButtonVisibilityReadyPromise,
    initialMotionPreferenceReadyTask,
    initialLanguageReadyTask,
    sectionPolicyReadyPromise,
    initialShortcutsReadyTask,
    initialPinnedRecentSitesReadyTask,
    initialHiddenRecentSitesReadyTask,
    initialLayoutStorageReadyTask,
    initialFontsReadyTask,
    initialQuoteReadyTask
  ]).catch((error) => {
    console.warn('[Lumno] Initial new tab layout setup failed.', error);
  }).then(() => {
    // Run one authoritative data pass after every layout-affecting preference
    // has settled. This keeps cached/default geometry from becoming visible and
    // then moving the entire entry when bookmarks or history arrive.
    sectionDataRevision += 1;
    const initialSectionDataRevision = sectionDataRevision;
    const recentSitesReadyTask = loadRecentSites({
      force: true,
      sectionDataRevision: initialSectionDataRevision
    });
    const bookmarksReadyTask = loadBookmarks({
      force: true,
      sectionDataRevision: initialSectionDataRevision
    });
    observeNewtabStartupTask('recent-sites', recentSitesReadyTask);
    observeNewtabStartupTask('bookmarks', bookmarksReadyTask);
    return Promise.all([recentSitesReadyTask, bookmarksReadyTask]);
  }).catch((error) => {
    console.warn('[Lumno] Initial new tab content setup failed.', error);
  }).then(() => {
    maybeShowFileAccessNotice();
    markNewtabReady();
  });
  observeNewtabStartupTask('visual-ready', initialVisualReadyPromise);
  updateBookmarkSectionPosition();
  markNewtabStartupMilestone('script-end');

})();
