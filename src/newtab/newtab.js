(function() {
  const root = document.getElementById('_x_extension_newtab_root_2024_unique_');
  const createSearchInput = window._x_extension_createSearchInput_2024_unique_;
  if (!root || typeof createSearchInput !== 'function') {
    return;
  }
  if (document.body) {
    document.body.removeAttribute('data-nt-ready');
  }

  const storageArea = (chrome && chrome.storage && chrome.storage.sync)
    ? chrome.storage.sync
    : (chrome && chrome.storage ? chrome.storage.local : null);
  const localStorageArea = (chrome && chrome.storage && chrome.storage.local)
    ? chrome.storage.local
    : storageArea;
  const recentSitesStorageArea = storageArea || localStorageArea;
  const storageAreaName = storageArea
    ? (storageArea === (chrome && chrome.storage ? chrome.storage.sync : null) ? 'sync' : 'local')
    : null;
  const recentSitesStorageAreaName = recentSitesStorageArea
    ? (recentSitesStorageArea === (chrome && chrome.storage ? chrome.storage.sync : null) ? 'sync' : 'local')
    : null;

  const THEME_STORAGE_KEY = '_x_extension_theme_mode_2024_unique_';
  const LANGUAGE_STORAGE_KEY = '_x_extension_language_2024_unique_';
  const LANGUAGE_MESSAGES_STORAGE_KEY = '_x_extension_language_messages_2024_unique_';
  const RECENT_MODE_STORAGE_KEY = '_x_extension_recent_mode_2024_unique_';
  const RECENT_COUNT_STORAGE_KEY = '_x_extension_recent_count_2024_unique_';
  const NEWTAB_WIDTH_MODE_STORAGE_KEY = '_x_extension_newtab_width_mode_2026_unique_';
  const NEWTAB_SEARCH_WIDTH_STORAGE_KEY = '_x_extension_newtab_search_width_2026_unique_';
  const NEWTAB_WORDMARK_VISIBLE_STORAGE_KEY = '_x_extension_newtab_wordmark_visible_2026_unique_';
  const NEWTAB_ZEN_MODE_STORAGE_KEY = '_x_extension_newtab_zen_mode_2026_unique_';
  const NEWTAB_THEME_MODE_STORAGE_KEY = '_x_extension_newtab_theme_mode_2026_unique_';
  const NEWTAB_THEME_SCOPE_STORAGE_KEY = '_x_extension_newtab_theme_scope_2026_unique_';
  const NEWTAB_WALLPAPER_STORAGE_KEY = '_x_extension_newtab_wallpaper_2026_unique_';
  const NEWTAB_LOCAL_WALLPAPER_STORAGE_KEY = '_x_extension_newtab_local_wallpaper_2026_unique_';
  const NEWTAB_WALLPAPER_OVERLAY_STORAGE_KEY = '_x_extension_newtab_wallpaper_overlay_2026_unique_';
  const NEWTAB_WALLPAPER_EFFECT_STORAGE_KEY = '_x_extension_newtab_wallpaper_effect_2026_unique_';
  const NEWTAB_FAVICON_STORAGE_KEY = '_x_extension_newtab_favicon_2026_unique_';
  const LUMNO_CHROME_WEB_STORE_URL = 'https://chromewebstore.google.com/detail/lumno-%E8%81%9A%E7%84%A6%E6%90%9C%E7%B4%A2%E6%96%B0%E6%A0%87%E7%AD%BE%E9%A1%B5/nggfkkbmogmadfoikakkfegkoilfcfao?utm_source=item-share-cb';
  const LUMNO_CHROME_WEB_STORE_REVIEW_URL = 'https://chromewebstore.google.com/detail/lumno-%E8%81%9A%E7%84%A6%E6%90%9C%E7%B4%A2%E6%96%B0%E6%A0%87%E7%AD%BE%E9%A1%B5/nggfkkbmogmadfoikakkfegkoilfcfao/reviews?utm_source=item-share-cb';
  const LUMNO_WEB_ORIGIN = 'https://lumno.kubai.design';
  const LUMNO_COMMUNITY_LINKS_URL = `${LUMNO_WEB_ORIGIN}/community-links.json`;
  const LUMNO_FEEDBACK_GITHUB_ISSUE_URL = 'https://github.com/kubai087/lumno-extension/issues/new';
  const LUMNO_FEEDBACK_LINKS_FETCH_TIMEOUT_MS = 2500;
  const LUMNO_FEEDBACK_LINKS_FALLBACK = Object.freeze({
    x: 'https://x.com/kubai087',
    githubIssue: LUMNO_FEEDBACK_GITHUB_ISSUE_URL,
    chromeReview: LUMNO_CHROME_WEB_STORE_REVIEW_URL,
    discord: 'https://discord.gg/2u9sg7ZNkJ',
    wechatQr: `${LUMNO_WEB_ORIGIN}/qrcode.JPG`,
    communityByLocale: Object.freeze({
      'zh-CN': 'wechat',
      'zh-TW': 'discord',
      ja: 'discord',
      en: 'discord'
    })
  });
  const BOOKMARK_COUNT_STORAGE_KEY = '_x_extension_bookmark_count_2024_unique_';
  const BOOKMARK_COLUMNS_STORAGE_KEY = '_x_extension_bookmark_columns_2024_unique_';
  const BOOKMARK_VIEW_MODE_STORAGE_KEY = '_x_extension_bookmark_view_mode_2026_unique_';
  const BOOKMARK_CASCADE_DEBUG_STORAGE_KEY = '_x_extension_bookmark_cascade_debug_2026_unique_';
  // Flip this to true when inspecting bookmark cascade hover intent and safe-triangle timing.
  const BOOKMARK_CASCADE_DEBUG_UI_ENABLED = false;
  const DEFAULT_SEARCH_ENGINE_STORAGE_KEY = '_x_extension_default_search_engine_2024_unique_';
  const SEARCH_RESULT_PRIORITY_STORAGE_KEY = '_x_extension_search_result_priority_2026_unique_';
  const OVERLAY_TAB_PRIORITY_STORAGE_KEY = '_x_extension_overlay_tab_priority_2024_unique_';
  const SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY = '_x_extension_search_result_source_types_2026_unique_';
  const SEARCH_BLACKLIST_STORAGE_KEY = '_x_extension_search_blacklist_2026_unique_';
  const FAVICON_REQUEST_BLACKLIST_STORAGE_KEY = '_x_extension_favicon_request_blacklist_2026_unique_';
  const BLACKLIST_UTILS = globalThis.LumnoBlacklistUtils || {};
  const SETTINGS = globalThis.LumnoSettings || {};
  const EXTENSION_ROUTES = globalThis.LumnoExtensionRoutes || {};
  const NAVIGATION_DISPOSITION = globalThis.LumnoNavigationDisposition || {};
  const SEARCH_UTILS = globalThis.LumnoSearchUtils || {};
  const SITE_SEARCH_STORE = globalThis.LumnoSiteSearchStore || {};
  const SUGGESTION_ACTION_MODEL = globalThis.LumnoSuggestionActionModel || {};
  const SUGGESTION_NAVIGATION = globalThis.LumnoSuggestionNavigation || {};
  const SEARCH_INPUT_MODE = globalThis.LumnoSearchInputMode || {};
  const FEATURE_HINTS = globalThis.LumnoFeatureHints || {};
  const UPDATE_NOTICE = globalThis.LumnoUpdateNotice || {};
  const FAVICON_UTILS = globalThis.LumnoFaviconUtils || {};
  const NEWTAB_FAVICON_CACHE = globalThis.LumnoFaviconCache || globalThis.LumnoNewtabFaviconCache || {};
  const NEWTAB_FAVICON_THEME = globalThis.LumnoNewtabFaviconTheme || {};
  const NEWTAB_FAVICON_VIEW = globalThis.LumnoNewtabFaviconView || {};
  const NEWTAB_RECENT_STORE = globalThis.LumnoNewtabRecentSitesStore || {};
  const NEWTAB_BOOKMARKS_STORE = globalThis.LumnoNewtabBookmarksStore || {};
  const NEWTAB_PAGE_NOTICE = globalThis.LumnoNewtabPageNotice || {};
  const NEWTAB_TOAST = globalThis.LumnoNewtabToast || {};
  const NEWTAB_LAYOUT = globalThis.LumnoNewtabLayout || {};
  const NEWTAB_DOCK = globalThis.LumnoNewtabDock || {};
  const NEWTAB_BACKGROUND_SEARCH_FOCUS = globalThis.LumnoNewtabBackgroundSearchFocus || {};
  const NEWTAB_RECENT_VIEW = globalThis.LumnoNewtabRecentSitesView || {};
  const NEWTAB_BOOKMARKS_VIEW = globalThis.LumnoNewtabBookmarksView || {};
  const NEWTAB_BOOKMARK_CASCADE_POSITION = globalThis.LumnoNewtabBookmarkCascadePosition || {};
  const NEWTAB_BOOKMARK_CASCADE_MENU = globalThis.LumnoNewtabBookmarkCascadeMenu || {};
  const NEWTAB_SUGGESTIONS_VIEW = globalThis.LumnoNewtabSuggestionsView || {};
  const NEWTAB_SHORTCUTS_STORE = globalThis.LumnoNewtabShortcutsStore || {};
  const NEWTAB_WALLPAPER_LOCAL_STORE = globalThis.LumnoNewtabWallpaperLocalStore || {};
  const NEWTAB_WALLPAPER_ADAPTIVE_TONE = globalThis.LumnoNewtabWallpaperAdaptiveTone || {};
  const NEWTAB_WALLPAPER_EFFECTS = globalThis.LumnoNewtabWallpaperEffects || {};
  const NEWTAB_WALLPAPER = globalThis.LumnoNewtabWallpaper || {};
  if (typeof NEWTAB_FAVICON_CACHE.createFaviconCache !== 'function' ||
      typeof NEWTAB_FAVICON_THEME.buildTheme !== 'function' ||
      typeof NEWTAB_FAVICON_VIEW.createFaviconViewRuntime !== 'function' ||
      typeof SEARCH_INPUT_MODE.createInputModeController !== 'function' ||
      typeof NEWTAB_RECENT_STORE.normalizeRecentSiteItem !== 'function' ||
      typeof NEWTAB_BOOKMARKS_STORE.buildBookmarkFolderCache !== 'function' ||
      typeof NEWTAB_BOOKMARKS_STORE.shouldApplyBookmarkCacheHydration !== 'function' ||
      typeof NEWTAB_PAGE_NOTICE.renderPageNotice !== 'function' ||
      typeof NEWTAB_TOAST.createToastController !== 'function' ||
      typeof NEWTAB_LAYOUT.createLayoutController !== 'function' ||
      typeof NEWTAB_LAYOUT.getAdaptiveGridColumnCount !== 'function' ||
      typeof NEWTAB_LAYOUT.getGridContentWidthForColumns !== 'function' ||
      typeof NEWTAB_DOCK.createBottomDockRuntime !== 'function' ||
      typeof NEWTAB_BACKGROUND_SEARCH_FOCUS.createBackgroundFocusHandler !== 'function' ||
      typeof NEWTAB_RECENT_VIEW.createRecentSitesView !== 'function' ||
      typeof NEWTAB_BOOKMARKS_VIEW.createBookmarksView !== 'function' ||
      typeof NEWTAB_BOOKMARK_CASCADE_POSITION.placeRootCascadeMenu !== 'function' ||
      typeof NEWTAB_BOOKMARK_CASCADE_POSITION.placeCascadeSubmenu !== 'function' ||
      typeof NEWTAB_BOOKMARK_CASCADE_MENU.createBookmarkCascadeMenuRuntime !== 'function' ||
      typeof NEWTAB_SUGGESTIONS_VIEW.createSuggestionsView !== 'function' ||
      typeof NEWTAB_SHORTCUTS_STORE.normalizeShortcuts !== 'function' ||
      typeof NEWTAB_SHORTCUTS_STORE.loadShortcuts !== 'function' ||
      typeof NEWTAB_SHORTCUTS_STORE.saveShortcuts !== 'function' ||
      typeof NEWTAB_SHORTCUTS_STORE.saveShortcut !== 'function' ||
      typeof NEWTAB_SHORTCUTS_STORE.createShortcutRecord !== 'function' ||
      typeof NEWTAB_WALLPAPER_LOCAL_STORE.createWallpaperLocalStore !== 'function' ||
      typeof NEWTAB_WALLPAPER_ADAPTIVE_TONE.createWallpaperAdaptiveTone !== 'function' ||
      typeof NEWTAB_WALLPAPER_EFFECTS.createWallpaperEffects !== 'function' ||
      typeof NEWTAB_WALLPAPER.createWallpaperRuntime !== 'function') {
    console.warn('Lumno: newtab helpers not available.');
    return;
  }
  const normalizeHost = NEWTAB_FAVICON_THEME.normalizeHost;
  const TAB_RANK_SCORE_DEBUG_STORAGE_KEY = '_x_extension_tab_rank_score_debug_2026_unique_';
  const NEWTAB_OPEN_TAB_SUGGESTION_LIMIT = 8;
  const FAVICON_CACHE_BOOT_WAIT_MS = 120;
  const THEME_ICON_LOAD_TIMEOUT_MS = 2400;
  const THEME_RESOLUTION_BATCH_SIZE = 2;
  const THEME_RESOLUTION_BATCH_DELAY_MS = 160;
  const RESTORE_SEARCH_LAYOUT_LOCK_MS = 900;
  const NEWTAB_RECENT_CACHE_STORAGE_KEY = '_x_extension_newtab_recent_cache_2024_unique_';
  const NEWTAB_BOOKMARK_CACHE_STORAGE_KEY = '_x_extension_newtab_bookmark_cache_2024_unique_';
  const PINNED_RECENT_SITES_STORAGE_KEY = '_x_extension_newtab_pinned_recent_sites_2026_unique_';
  const HIDDEN_RECENT_SITES_STORAGE_KEY = '_x_extension_newtab_hidden_recent_sites_2026_unique_';
  const NEWTAB_SHORTCUTS_STORAGE_KEY = '_x_extension_newtab_shortcuts_2026_unique_';
  const NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY = '_x_extension_newtab_shortcuts_visible_2026_unique_';
  const MAX_PINNED_RECENT_SITES = 3;
  const MAX_HIDDEN_RECENT_SITES = 60;
  const MAX_NEWTAB_SHORTCUTS = 10;
  const SHORTCUT_DRAG_START_THRESHOLD_PX = 10;
  const SHORTCUT_REORDER_ANIMATION_MS = 180;
  const SHORTCUT_DROP_ANIMATION_MS = 210;
  const SHORTCUT_REORDER_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const BOOKMARK_DRAG_START_THRESHOLD_PX = 10;
  const BOOKMARK_REORDER_ANIMATION_MS = 180;
  const BOOKMARK_DROP_ANIMATION_MS = 210;
  const BOOKMARK_REORDER_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const NEWTAB_SECTION_CACHE_TTL_MS = 1000 * 60 * 5;
  const pageSearchParams = new URLSearchParams(window.location.search || '');
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  let mediaListenerAttached = false;
  let globalThemeMode = 'system';
  let newtabThemeMode = 'global';
  let newtabThemeScope = 'global';
  let currentThemeMode = 'system';
  let initialThemeApplied = false;
  let hasThemeBootstrapStarted = false;
  let resolveInitialThemeReady = null;
  const initialThemeReadyPromise = new Promise((resolve) => {
    resolveInitialThemeReady = resolve;
  });
  let initialLanguageApplied = false;
  let hasLanguageBootstrapStarted = false;
  let resolveInitialLanguageReady = null;
  const initialLanguageReadyPromise = new Promise((resolve) => {
    resolveInitialLanguageReady = resolve;
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
  let siteSearchTriggerState = null;
  let lastRenderedQuery = '';
  let lastRenderedActionContextKey = '';
  let suggestionsView = null;
  let recentSourceItems = [];
  let pinnedRecentSites = [];
  let hiddenRecentSites = [];
  let searchBlacklistItems = [];
  let currentMessages = null;
  let currentLanguageMode = 'system';
  let currentResolvedLocale = null;
  let defaultPlaceholderText = 'Search or enter URL...';
  let toastElement = null;
  let toastController = null;
  let layoutController = null;
  let searchEntryRestoreLayoutLockUntil = 0;
  let searchEntryLastVisibleViewportWidth = Math.max(0, window.innerWidth || 0);
  let searchEntryLastVisibleViewportHeight = Math.max(0, window.innerHeight || 0);
  let currentRecentMode = 'most';
  let currentRecentCount = 4;
  let currentBookmarkCount = 8;
  let currentBookmarkColumns = 4;
  let currentBookmarkViewMode = 'folder';
  let tabRankScoreDebugEnabled = false;
  let searchLayer = null;
  let wordmarkContainer = null;
  let wordmarkImageEl = null;
  let wordmarkSolidEl = null;
  let wordmarkVisibilityTransitionTimer = 0;
  let wordmarkVisibilityLayoutFrame = 0;
  let wordmarkEntryTransitionTimer = 0;
  let wallpaperControl = null;
  let wallpaperRuntime = null;
  let feedbackControl = null;
  let feedbackButton = null;
  let feedbackPopover = null;
  let feedbackMenu = null;
  let feedbackXLink = null;
  let feedbackGithubIssueLink = null;
  let feedbackChromeReviewLink = null;
  let feedbackCommunityButton = null;
  let feedbackDetail = null;
  let feedbackPopoverCloseTimer = 0;
  let feedbackLinks = LUMNO_FEEDBACK_LINKS_FALLBACK;
  let feedbackLinksLoaded = false;
  let feedbackLinksLoadingPromise = null;
  let updateNoticeController = null;
  let pageNoticeController = null;
  let newtabWordmarkVisible = true;
  let zenModeEnabled = false;
  let bookmarkCurrentPage = 0;
  let bookmarkAllItems = [];
  let bookmarkCurrentFolderId = '1';
  let bookmarkRootFolderId = '1';
  let bookmarkFolderPath = [];
  let bookmarkRootTotalCount = 0;
  let bookmarkRootVisibleCount = 0;
  let bookmarkNodeMap = new Map();
  let bookmarkFolderItemsCache = new Map();
  let bookmarkTreeCacheReady = false;
  let bookmarkTreeCacheDirty = true;
  let bookmarkTreeCacheLoadingPromise = null;
  let bookmarkTitleWrap = null;
  let bookmarkHeading = null;
  let bookmarkModeMenu = null;
  let bookmarkGrid = null;
  let bookmarkCascadeRuntime = null;
  let recentHeader = null;
  let recentHeading = null;
  let recentModeMenu = null;
  let recentGrid = null;
  let bookmarkBreadcrumb = null;
  let bookmarkPagerPrevButton = null;
  let bookmarkPagerNextButton = null;
  let bookmarkOpenManagerButton = null;
  let bookmarkPageAnimating = false;
  let bookmarkDragState = null;
  let bookmarkWheelLastAt = 0;
  let recentMouseInsideSection = false;
  let recentMouseLeftAt = 0;
  let recentSitesView = null;
  let bookmarksView = null;
  let shortcutSection = null;
  let shortcutGrid = null;
  let addShortcutButton = null;
  let shortcutDialogBackdrop = null;
  let shortcutDialog = null;
  let shortcutForm = null;
  let shortcutDialogTitle = null;
  let shortcutNameInput = null;
  let shortcutUrlInput = null;
  let shortcutNameLabel = null;
  let shortcutUrlLabel = null;
  let shortcutCancelButton = null;
  let shortcutDoneButton = null;
  let shortcutError = null;
  let shortcutDialogPreviousFocus = null;
  let shortcutDialogOpenFrame = 0;
  let shortcutDialogCloseTimer = 0;
  let shortcutDialogMode = 'add';
  let shortcutDialogEditingId = '';
  let shortcutContextMenu = null;
  let shortcutContextMenuTargetId = '';
  let newtabShortcuts = [];
  let newtabShortcutsVisible = true;
  let shortcutDragState = null;
  const shortcutTiles = [];
  const SHORTCUT_DIALOG_MODE_ADD = 'add';
  const SHORTCUT_DIALOG_MODE_EDIT = 'edit';
  const SHORTCUT_CONTEXT_MENU_EDIT_VALUE = 'edit';
  const SHORTCUT_CONTEXT_MENU_REMOVE_VALUE = 'remove';
  const sectionModeSelectController = globalThis.LumnoCustomSelect &&
      typeof globalThis.LumnoCustomSelect.createController === 'function'
    ? globalThis.LumnoCustomSelect.createController({
      documentObj: document,
      windowObj: window,
      onBeforeOpen: hideTopActionTooltip
    })
    : null;
  const shortcutContextMenuSelectController = globalThis.LumnoCustomSelect &&
      typeof globalThis.LumnoCustomSelect.createController === 'function'
    ? globalThis.LumnoCustomSelect.createController({
      documentObj: document,
      windowObj: window,
      onBeforeOpen: () => {
        hideShortcutTooltip();
        hideTopActionTooltip();
      }
    })
    : null;
  const BOOKMARK_WHEEL_SWITCH_COOLDOWN_MS = 220;
  const BOOKMARK_HOVER_DELAY_FROM_RECENT_MS = 56;
  const BOOKMARK_HOVER_RECENT_TRANSFER_WINDOW_MS = 220;
  const SECTION_MODE_MENU_MIN_WIDTH_PX = 168;
  const SECTION_MODE_MENU_MAX_WIDTH_PX = 240;
  const SECTION_MODE_MENU_PORTAL_Z_INDEX = 10020;
  const SECTION_MODE_MENU_PORTAL_OFFSET_PX = 8;
  const SHORTCUT_CONTEXT_MENU_MIN_WIDTH_PX = 124;
  const SHORTCUT_CONTEXT_MENU_MAX_WIDTH_PX = 180;
  const SHORTCUT_CONTEXT_MENU_PORTAL_Z_INDEX = 10040;
  const SHORTCUT_CONTEXT_MENU_PORTAL_OFFSET_PX = -6;
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
  const SEARCH_LAYOUT_SHORT_VIEWPORT_MAX_HEIGHT_PX = 680;
  const SEARCH_LAYOUT_SHORT_MIN_TOP_PX = 44;
  const WORDMARK_ENTRY_ANIMATION_NAME = '_x_nt_wordmark_enter_2026_unique_';
  const WORDMARK_ENTRY_ANIMATION_TOTAL_MS = 660;
  const WORDMARK_WALLPAPER_COVER_DARK_OPACITY = '0.32';
  const WORDMARK_WALLPAPER_COVER_LIGHT_OPACITY = '0.32';
  const WORDMARK_VISIBILITY_TRANSITION_MS = 260;
  const WORDMARK_VISIBILITY_TRANSITION_CSS =
    'max-height 260ms cubic-bezier(0.22, 1, 0.36, 1), ' +
    'margin-bottom 260ms cubic-bezier(0.22, 1, 0.36, 1), ' +
    'opacity 180ms ease, ' +
    'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)';
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

  function normalizeRecentCount(value) {
    return NEWTAB_RECENT_STORE.normalizeRecentCount(value);
  }

  function normalizeRecentMode(value, fallback) {
    if (value === 'latest' || value === 'most') {
      return value;
    }
    return fallback === 'latest' || fallback === 'most' ? fallback : 'latest';
  }

  function normalizeBookmarkViewMode(value) {
    return value === 'list' ? 'list' : 'folder';
  }

  function normalizeNewtabWidthMode(value) {
    return typeof SETTINGS.normalizeNewtabWidthMode === 'function'
      ? SETTINGS.normalizeNewtabWidthMode(value)
      : (value === 'standard' ? 'standard' : 'wide');
  }

  function normalizeNewtabSearchWidth(value, options) {
    if (typeof SETTINGS.normalizeNewtabSearchWidth === 'function') {
      return SETTINGS.normalizeNewtabSearchWidth(value, Object.assign({}, NEWTAB_SEARCH_WIDTH_CONFIG, options || {}));
    }
    const config = Object.assign({}, NEWTAB_SEARCH_WIDTH_CONFIG, options || {});
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return config.allowNull ? null : config.fallback;
    }
    return Math.min(config.max, Math.max(config.min, Math.round(number)));
  }

  function normalizeNewtabWordmarkVisible(value) {
    return typeof SETTINGS.normalizeNewtabWordmarkVisible === 'function'
      ? SETTINGS.normalizeNewtabWordmarkVisible(value)
      : value !== false;
  }

  function normalizeNewtabShortcutsVisible(value) {
    return typeof SETTINGS.normalizeNewtabShortcutsVisible === 'function'
      ? SETTINGS.normalizeNewtabShortcutsVisible(value)
      : value !== false;
  }

  function normalizeZenModeEnabled(value) {
    return value === true;
  }

  function normalizeSearchResultPriority(value) {
    return typeof SETTINGS.normalizeSearchResultPriority === 'function'
      ? SETTINGS.normalizeSearchResultPriority(value)
      : (value === 'search' ? 'search' : 'autocomplete');
  }

  function normalizeOverlayTabPriorityMode(value) {
    return typeof SETTINGS.normalizeOverlayTabPriorityMode === 'function'
      ? SETTINGS.normalizeOverlayTabPriorityMode(value)
      : (value !== 'newtabFirst' && value !== false);
  }

  function normalizeBookmarkCount(value) {
    const parsed = Number.parseInt(value, 10);
    if (parsed === 0 || parsed === 4 || parsed === 8 || parsed === 16 || parsed === 32) {
      return parsed;
    }
    return 8;
  }

  function getBookmarkLimit() {
    const normalized = normalizeBookmarkCount(currentBookmarkCount);
    if (normalized <= 0) {
      return 8;
    }
    const rows = Math.max(1, Math.round(normalized / 4));
    // Use the actual rendered column count so "show N rows" remains accurate on responsive layouts.
    const columns = Math.max(1, getBookmarkGridColumnCount());
    return rows * columns;
  }

  function normalizeBookmarkColumns(value) {
    const parsed = Number.parseInt(value, 10);
    if (parsed === 4 || parsed === 6 || parsed === 8) {
      return parsed;
    }
    return 4;
  }

  function normalizeTabRankScoreDebugMode(value) {
    return typeof SETTINGS.normalizeTabRankScoreDebugMode === 'function'
      ? SETTINGS.normalizeTabRankScoreDebugMode(value)
      : value === true;
  }

  function normalizeBookmarkCascadeDebugMode(value) {
    return value === true;
  }

  function applyNewtabWordmarkVisibility() {
    if (!wordmarkContainer) {
      return;
    }
    const body = document.body;
    const nextVisible = Boolean(newtabWordmarkVisible && !zenModeEnabled);
    const wasVisible = wordmarkContainer.getAttribute('data-visible') !== 'false';
    const stateChanged = wasVisible !== nextVisible;
    const prefersReducedMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const suggestionsOpen = Boolean(
      body && body.getAttribute('data-nt-suggestions-open') === 'true'
    );
    const shouldAnimate = Boolean(
      body &&
      body.getAttribute('data-nt-ready') === '1' &&
      stateChanged &&
      !suggestionsOpen &&
      !prefersReducedMotion
    );
    if (stateChanged && wordmarkVisibilityTransitionTimer) {
      window.clearTimeout(wordmarkVisibilityTransitionTimer);
      wordmarkVisibilityTransitionTimer = 0;
    }
    if (body) {
      if (shouldAnimate) {
        body.setAttribute('data-wordmark-transition', 'true');
      } else if (!wordmarkVisibilityTransitionTimer) {
        body.removeAttribute('data-wordmark-transition');
      }
    }
    wordmarkContainer.setAttribute('data-visible', nextVisible ? 'true' : 'false');
    wordmarkContainer.style.setProperty('display', 'flex');
    wordmarkContainer.style.setProperty(
      'transition',
      shouldAnimate ? WORDMARK_VISIBILITY_TRANSITION_CSS : 'none'
    );
    wordmarkContainer.style.setProperty('max-height', nextVisible ? '74px' : '0');
    wordmarkContainer.style.setProperty('margin-bottom', nextVisible ? '28px' : '0');
    wordmarkContainer.style.setProperty('opacity', nextVisible ? '1' : '0');
    wordmarkContainer.style.setProperty(
      'transform',
      nextVisible ? 'translate3d(0, 0, 0)' : 'translate3d(0, -8px, 0)'
    );
    wordmarkContainer.style.setProperty('pointer-events', nextVisible ? 'auto' : 'none');
    if (stateChanged && !nextVisible) {
      finishWordmarkEntryAnimation();
    } else if (shouldAnimate && nextVisible) {
      restartWordmarkEntryAnimation();
    }
    updateSearchEntryLayout();
    syncSearchSurfaceDuringWordmarkTransition(shouldAnimate);
    scheduleWallpaperAdaptiveToneUpdate();
    if (shouldAnimate && body) {
      wordmarkVisibilityTransitionTimer = window.setTimeout(() => {
        wordmarkVisibilityTransitionTimer = 0;
        body.removeAttribute('data-wordmark-transition');
        updateSearchEntryLayout();
        updateSuggestionsFloatingLayout();
      }, WORDMARK_VISIBILITY_TRANSITION_MS + 80);
    }
  }

  function syncSearchSurfaceDuringWordmarkTransition(shouldAnimate) {
    if (wordmarkVisibilityLayoutFrame) {
      window.cancelAnimationFrame(wordmarkVisibilityLayoutFrame);
      wordmarkVisibilityLayoutFrame = 0;
    }
    updateSuggestionsFloatingLayout();
    if (!shouldAnimate || typeof window.requestAnimationFrame !== 'function') {
      return;
    }
    const syncUntil = Date.now() + WORDMARK_VISIBILITY_TRANSITION_MS + 80;
    const syncLayout = () => {
      updateSuggestionsFloatingLayout();
      if (Date.now() >= syncUntil) {
        wordmarkVisibilityLayoutFrame = 0;
        return;
      }
      wordmarkVisibilityLayoutFrame = window.requestAnimationFrame(syncLayout);
    };
    wordmarkVisibilityLayoutFrame = window.requestAnimationFrame(syncLayout);
  }

  function finishWordmarkEntryAnimation() {
    if (wordmarkEntryTransitionTimer) {
      window.clearTimeout(wordmarkEntryTransitionTimer);
      wordmarkEntryTransitionTimer = 0;
    }
    if (wordmarkContainer) {
      wordmarkContainer.setAttribute('data-enter', 'done');
    }
  }

  function restartWordmarkEntryAnimation() {
    if (!wordmarkContainer) {
      return;
    }
    const prefersReducedMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      finishWordmarkEntryAnimation();
      return;
    }
    const wordmarkButton = wordmarkContainer.querySelector('button');
    if (wordmarkEntryTransitionTimer) {
      window.clearTimeout(wordmarkEntryTransitionTimer);
      wordmarkEntryTransitionTimer = 0;
    }
    wordmarkContainer.setAttribute('data-enter', 'done');
    if (wordmarkButton) {
      void wordmarkButton.offsetWidth;
    }
    wordmarkContainer.setAttribute('data-enter', 'run');
    wordmarkEntryTransitionTimer = window.setTimeout(
      finishWordmarkEntryAnimation,
      WORDMARK_ENTRY_ANIMATION_TOTAL_MS
    );
  }

  function getWordmarkSolidFill(wallpaperActive, wallpaperInk, theme) {
    if (wallpaperActive) {
      return wallpaperInk === 'dark'
        ? 'var(--x-nt-wallpaper-wordmark-ink, rgb(238 240 242))'
        : 'var(--x-nt-wallpaper-wordmark-ink, rgb(78 84 94))';
    }
    return theme === 'dark' ? 'rgb(248 250 252)' : 'rgb(31 41 55)';
  }

  function applyWordmarkSolidFill(fill) {
    if (!wordmarkContainer || !wordmarkSolidEl) {
      return;
    }
    wordmarkContainer.style.setProperty('--x-nt-wordmark-solid-fill', fill);
  }

  function applyWordmarkSolidLayerVisible(visible) {
    if (!wordmarkSolidEl) {
      return;
    }
    wordmarkSolidEl.style.setProperty('opacity', visible ? '1' : '0');
  }

  function applyWordmarkThemeAppearance(resolvedTheme) {
    if (!wordmarkImageEl) {
      return;
    }
    const theme = resolvedTheme || (document.body ? document.body.getAttribute('data-theme') : 'light');
    const wallpaperActive = document.body &&
      document.body.getAttribute('data-wallpaper-active') === 'true';
    const lightSrc = '../../assets/images/lumno-wordmark.svg';
    const darkSrc = '../../assets/images/lumno-wordmark-dark.svg';
    if (wallpaperActive) {
      const wallpaperOverlayCover = wordmarkContainer &&
        wordmarkContainer.getAttribute('data-wallpaper-overlay-cover') === 'true';
      if (wallpaperOverlayCover) {
        applyWordmarkSolidLayerVisible(false);
        const themeSrc = theme === 'dark' ? darkSrc : lightSrc;
        if (wordmarkImageEl.getAttribute('src') !== themeSrc) {
          wordmarkImageEl.setAttribute('src', themeSrc);
        }
        applyWordmarkSolidFill(getWordmarkSolidFill(false, '', theme));
        wordmarkImageEl.style.setProperty(
          'opacity',
          theme === 'dark'
            ? WORDMARK_WALLPAPER_COVER_DARK_OPACITY
            : WORDMARK_WALLPAPER_COVER_LIGHT_OPACITY
        );
        return;
      }
      const wallpaperInk = wordmarkContainer
        ? wordmarkContainer.getAttribute('data-wallpaper-ink')
        : '';
      const wallpaperSrc = wallpaperInk === 'dark' ? lightSrc : darkSrc;
      if (wordmarkImageEl.getAttribute('src') !== wallpaperSrc) {
        wordmarkImageEl.setAttribute('src', wallpaperSrc);
      }
      applyWordmarkSolidFill(getWordmarkSolidFill(true, wallpaperInk, theme));
      applyWordmarkSolidLayerVisible(true);
      wordmarkImageEl.style.setProperty('opacity', '0');
      return;
    }
    applyWordmarkSolidLayerVisible(false);
    if (theme === 'dark') {
      if (wordmarkImageEl.getAttribute('src') !== darkSrc) {
        wordmarkImageEl.setAttribute('src', darkSrc);
      }
      applyWordmarkSolidFill(getWordmarkSolidFill(false, '', theme));
      wordmarkImageEl.style.setProperty('opacity', '0.9');
      return;
    }
    if (wordmarkImageEl.getAttribute('src') !== lightSrc) {
      wordmarkImageEl.setAttribute('src', lightSrc);
    }
    applyWordmarkSolidFill(getWordmarkSolidFill(false, '', theme));
    wordmarkImageEl.style.setProperty('opacity', '0.82');
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
      mobileColumns: 1,
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
      id: 'so',
      name: '360搜索',
      hostMatches: ['so.com'],
      searchUrl: (query) => `https://www.so.com/s?q=${encodeURIComponent(query)}`
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
    return typeof SETTINGS.normalizeLocale === 'function'
      ? SETTINGS.normalizeLocale(locale)
      : 'en';
  }

  function localeToHtmlLang(locale) {
    return typeof SETTINGS.localeToHtmlLang === 'function'
      ? SETTINGS.localeToHtmlLang(locale)
      : normalizeLocale(locale).replace('_', '-');
  }

  function applyDocumentLanguage(locale) {
    if (!document.documentElement) {
      return;
    }
    document.documentElement.lang = localeToHtmlLang(locale);
  }

  function migrateStorageIfNeeded(keys) {
    if (!storageArea || !chrome || !chrome.storage || !chrome.storage.local) {
      return;
    }
    if (storageArea === chrome.storage.local) {
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
        if (Object.keys(missingSyncValues).length === 0) {
          return;
        }
        storageArea.set(missingSyncValues);
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
    const localePath = chrome.runtime.getURL(`_locales/${normalized}/messages.json`);
    return fetch(localePath)
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

  function markNewtabReady() {
    if (!document.body) {
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.body.setAttribute('data-nt-ready', '1');
      });
    });
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

  function normalizeFeedbackHttpsUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) {
      return '';
    }
    try {
      const url = new URL(raw);
      return url.protocol === 'https:' ? url.toString() : '';
    } catch (error) {
      return '';
    }
  }

  function normalizeFeedbackCommunityChannel(value, fallback) {
    return value === 'wechat' || value === 'discord' ? value : fallback;
  }

  function normalizeFeedbackCommunityMap(value) {
    const fallbackMap = LUMNO_FEEDBACK_LINKS_FALLBACK.communityByLocale;
    const source = value && typeof value === 'object' ? value : {};
    return {
      'zh-CN': normalizeFeedbackCommunityChannel(source['zh-CN'] || source.zh_CN, fallbackMap['zh-CN']),
      'zh-TW': normalizeFeedbackCommunityChannel(source['zh-TW'] || source.zh_TW, fallbackMap['zh-TW']),
      ja: normalizeFeedbackCommunityChannel(source.ja, fallbackMap.ja),
      en: normalizeFeedbackCommunityChannel(source.en, fallbackMap.en)
    };
  }

  function normalizeFeedbackLinksPayload(payload) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const links = source.links && typeof source.links === 'object' ? source.links : source;
    return {
      x: normalizeFeedbackHttpsUrl(links.x) || LUMNO_FEEDBACK_LINKS_FALLBACK.x,
      githubIssue: normalizeFeedbackHttpsUrl(links.githubIssue || links.github_issue || links.issue) ||
        LUMNO_FEEDBACK_LINKS_FALLBACK.githubIssue,
      chromeReview: normalizeFeedbackHttpsUrl(
        links.chromeReview ||
        links.chrome_review ||
        links.chromeWebStoreReview ||
        links.chrome_web_store_review ||
        links.chromeRating ||
        links.chrome_rating
      ) || LUMNO_FEEDBACK_LINKS_FALLBACK.chromeReview,
      discord: normalizeFeedbackHttpsUrl(links.discord) || LUMNO_FEEDBACK_LINKS_FALLBACK.discord,
      wechatQr: normalizeFeedbackHttpsUrl(links.wechatQr) || LUMNO_FEEDBACK_LINKS_FALLBACK.wechatQr,
      communityByLocale: normalizeFeedbackCommunityMap(source.communityByLocale)
    };
  }

  function loadFeedbackLinks(options) {
    const force = Boolean(options && options.force);
    if (!force && feedbackLinksLoaded) {
      return Promise.resolve(feedbackLinks);
    }
    if (feedbackLinksLoadingPromise) {
      return feedbackLinksLoadingPromise;
    }
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutId = controller
      ? window.setTimeout(() => controller.abort(), LUMNO_FEEDBACK_LINKS_FETCH_TIMEOUT_MS)
      : 0;
    feedbackLinksLoadingPromise = fetch(LUMNO_COMMUNITY_LINKS_URL, {
      cache: 'no-store',
      signal: controller ? controller.signal : undefined
    })
      .then((response) => {
        if (!response || !response.ok) {
          throw new Error('feedback links unavailable');
        }
        return response.json();
      })
      .then((payload) => {
        feedbackLinks = normalizeFeedbackLinksPayload(payload);
        feedbackLinksLoaded = true;
        return feedbackLinks;
      })
      .catch(() => feedbackLinks || LUMNO_FEEDBACK_LINKS_FALLBACK)
      .finally(() => {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
        feedbackLinksLoadingPromise = null;
      });
    return feedbackLinksLoadingPromise;
  }

  function getFeedbackWebLocale() {
    const locale = currentResolvedLocale ||
      (currentLanguageMode === 'system' ? getSystemLocale() : normalizeLocale(currentLanguageMode));
    if (locale === 'zh_CN') {
      return 'zh-CN';
    }
    if (locale === 'zh_TW') {
      return 'zh-TW';
    }
    if (locale === 'ja') {
      return 'ja';
    }
    return 'en';
  }

  function getFeedbackCommunityChannel(links) {
    const source = links && links.communityByLocale ? links.communityByLocale : LUMNO_FEEDBACK_LINKS_FALLBACK.communityByLocale;
    const channel = source[getFeedbackWebLocale()];
    return channel === 'wechat' ? 'wechat' : 'discord';
  }

  function setFeedbackActionLabel(action, label, tooltip) {
    if (!action) {
      return;
    }
    const actionText = tooltip || label;
    action.setAttribute('aria-label', actionText);
    action.setAttribute('data-tooltip', actionText);
    action.removeAttribute('title');
  }

  function bindFeedbackActionTooltip(action, getLabel) {
    if (!action || typeof getLabel !== 'function') {
      return;
    }
    const showTooltip = () => {
      if (!isFeedbackPopoverOpen()) {
        return;
      }
      showTopActionTooltip(action, getLabel(), { placement: 'top' });
    };
    action.addEventListener('pointerenter', showTooltip);
    action.addEventListener('pointerleave', hideTopActionTooltip);
    action.addEventListener('mouseenter', showTooltip);
    action.addEventListener('mouseleave', hideTopActionTooltip);
    action.addEventListener('focus', showTooltip);
    action.addEventListener('blur', hideTopActionTooltip);
  }

  function updateFeedbackContactUi() {
    const links = feedbackLinks || LUMNO_FEEDBACK_LINKS_FALLBACK;
    const channel = getFeedbackCommunityChannel(links);
    if (feedbackXLink) {
      const label = t('newtab_feedback_x_label', 'X');
      const tooltip = t('newtab_feedback_x_tooltip', 'Contacting on X');
      feedbackXLink.href = links.x || LUMNO_FEEDBACK_LINKS_FALLBACK.x;
      setFeedbackActionLabel(feedbackXLink, label, tooltip);
    }
    if (feedbackGithubIssueLink) {
      const label = t('newtab_feedback_github_issue_label', 'GitHub Issue');
      const tooltip = t('newtab_feedback_github_issue_tooltip', 'Opening a GitHub Issue');
      feedbackGithubIssueLink.href = links.githubIssue || LUMNO_FEEDBACK_LINKS_FALLBACK.githubIssue;
      setFeedbackActionLabel(feedbackGithubIssueLink, label, tooltip);
    }
    if (feedbackChromeReviewLink) {
      const label = t('newtab_feedback_chrome_review_label', 'Chrome rating');
      const tooltip = t('newtab_feedback_chrome_review_tooltip', 'Rate on Chrome Web Store');
      feedbackChromeReviewLink.href = links.chromeReview || LUMNO_FEEDBACK_LINKS_FALLBACK.chromeReview;
      setFeedbackActionLabel(feedbackChromeReviewLink, label, tooltip);
    }
    if (feedbackCommunityButton) {
      const label = channel === 'wechat'
        ? t('newtab_feedback_wechat_label', 'WeChat')
        : t('newtab_feedback_discord_label', 'Discord');
      const tooltip = channel === 'wechat'
        ? t('newtab_feedback_wechat_tooltip', 'Joining WeChat group')
        : t('newtab_feedback_discord_tooltip', 'Joining Discord');
      feedbackCommunityButton.innerHTML = getRiSvg(
        channel === 'wechat' ? 'ri-wechat-fill' : 'ri-discord-fill',
        'ri-size-16'
      );
      setFeedbackActionLabel(feedbackCommunityButton, label, tooltip);
      feedbackCommunityButton.setAttribute('data-channel', channel);
      feedbackCommunityButton.setAttribute('aria-haspopup', channel === 'wechat' ? 'true' : 'false');
      if (channel !== 'wechat') {
        feedbackCommunityButton.setAttribute('aria-expanded', 'false');
      }
    }
    if (feedbackDetail && !feedbackDetail.hidden) {
      if (channel === 'wechat') {
        renderFeedbackDetail();
      } else {
        setFeedbackDetailOpen(false);
      }
    }
  }

  function renderFeedbackDetail() {
    if (!feedbackDetail) {
      return;
    }
    const links = feedbackLinks || LUMNO_FEEDBACK_LINKS_FALLBACK;
    const channel = getFeedbackCommunityChannel(links);
    feedbackDetail.innerHTML = '';
    feedbackDetail.setAttribute('data-channel', channel);

    const title = document.createElement('div');
    const header = document.createElement('div');
    const collapseButton = document.createElement('button');

    header.className = 'x-nt-feedback-detail-header';
    collapseButton.type = 'button';
    collapseButton.className = 'x-nt-feedback-action x-nt-feedback-detail-collapse';
    collapseButton.setAttribute(
      'aria-label',
      t('newtab_feedback_wechat_collapse_aria', 'Collapse WeChat group')
    );
    collapseButton.setAttribute('role', 'menuitem');
    collapseButton.innerHTML = getRiSvg('ri-arrow-down-s-line', 'ri-size-16');
    collapseButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      hideTopActionTooltip();
      setFeedbackDetailOpen(false);
      if (feedbackCommunityButton) {
        try {
          feedbackCommunityButton.focus({ preventScroll: true });
        } catch (error) {
          feedbackCommunityButton.focus();
        }
      }
    });
    title.className = 'x-nt-feedback-detail-title';
    title.textContent = channel === 'wechat'
      ? t('newtab_feedback_wechat_panel_title', 'Bug reports & feature requests')
      : t('newtab_feedback_discord_label', 'Discord');
    header.appendChild(collapseButton);
    header.appendChild(title);
    feedbackDetail.appendChild(header);

    if (channel === 'wechat') {
      const image = document.createElement('img');
      image.className = 'x-nt-feedback-qr-image';
      image.width = 1080;
      image.height = 1596;
      image.src = links.wechatQr || LUMNO_FEEDBACK_LINKS_FALLBACK.wechatQr;
      image.alt = t('newtab_feedback_wechat_qr_alt', 'Lumno WeChat group QR code');
      image.loading = 'lazy';
      feedbackDetail.appendChild(image);
    }
  }

  function setFeedbackDetailOpen(open) {
    if (!feedbackDetail || !feedbackCommunityButton) {
      return;
    }
    if (feedbackControl) {
      feedbackControl.setAttribute('data-detail-open', open ? 'true' : 'false');
    }
    if (feedbackPopover) {
      feedbackPopover.setAttribute('data-detail-open', open ? 'true' : 'false');
    }
    feedbackDetail.hidden = !open;
    feedbackCommunityButton.setAttribute('data-active', open ? 'true' : 'false');
    feedbackCommunityButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      renderFeedbackDetail();
    }
  }

  function openFeedbackExternalUrl(url, disposition) {
    const safeUrl = normalizeFeedbackHttpsUrl(url);
    if (!safeUrl) {
      return false;
    }
    return openExternalNewTabUrl(safeUrl, disposition || 'newTab');
  }

  function updateFeedbackLanguageStrings() {
    if (feedbackButton) {
      const label = t('newtab_feedback_button_aria', 'Send feedback');
      feedbackButton.setAttribute('aria-label', label);
      feedbackButton.removeAttribute('title');
      feedbackButton.setAttribute('aria-expanded', isFeedbackPopoverOpen() ? 'true' : 'false');
    }
    if (feedbackPopover) {
      feedbackPopover.setAttribute('aria-label', t('newtab_feedback_menu_aria', 'Feedback channels'));
    }
    updateFeedbackContactUi();
  }

  function isFeedbackPopoverOpen() {
    return Boolean(feedbackControl && feedbackControl.getAttribute('data-menu-open') === 'true');
  }

  function closeFeedbackPopover(options) {
    setFeedbackPopoverOpen(false, options);
  }

  function setFeedbackPopoverOpen(open, options) {
    if (!feedbackControl || !feedbackButton || !feedbackPopover) {
      return;
    }
    if (!open) {
      hideTopActionTooltip();
    }
    if (feedbackPopoverCloseTimer) {
      window.clearTimeout(feedbackPopoverCloseTimer);
      feedbackPopoverCloseTimer = 0;
    }
    feedbackControl.setAttribute('data-menu-open', open ? 'true' : 'false');
    feedbackButton.setAttribute('data-open', open ? 'true' : 'false');
    feedbackButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      feedbackPopover.hidden = false;
      setFeedbackDetailOpen(false);
      updateFeedbackContactUi();
      loadFeedbackLinks({ force: true }).then(() => {
        updateFeedbackContactUi();
      });
      return;
    }
    setFeedbackDetailOpen(false);
    feedbackPopoverCloseTimer = window.setTimeout(() => {
      if (!isFeedbackPopoverOpen() && feedbackPopover) {
        feedbackPopover.hidden = true;
      }
      feedbackPopoverCloseTimer = 0;
    }, 160);
    if (options && options.restoreFocus && feedbackButton) {
      try {
        feedbackButton.focus({ preventScroll: true });
      } catch (error) {
        feedbackButton.focus();
      }
    }
  }

  function toggleFeedbackPopover() {
    setFeedbackPopoverOpen(!isFeedbackPopoverOpen());
  }

  async function handleFeedbackCommunityClick(event) {
    event.preventDefault();
    event.stopPropagation();
    hideTopActionTooltip();

    const currentLinks = feedbackLinks || LUMNO_FEEDBACK_LINKS_FALLBACK;
    if (getFeedbackCommunityChannel(currentLinks) === 'wechat') {
      if (isMiddleClick(event)) {
        return;
      }
      setFeedbackDetailOpen(feedbackDetail ? feedbackDetail.hidden : true);
      return;
    }

    const disposition = getOpenDisposition(event, 'newTab');

    const links = await loadFeedbackLinks({ force: false });
    updateFeedbackContactUi();
    if (getFeedbackCommunityChannel(links) === 'wechat') {
      setFeedbackDetailOpen(true);
      return;
    }
    closeFeedbackPopover();
    openFeedbackExternalUrl(
      (links && links.discord) || LUMNO_FEEDBACK_LINKS_FALLBACK.discord,
      disposition
    );
  }

  function createFeedbackControls() {
    feedbackControl = document.createElement('div');
    feedbackControl.className = 'x-nt-feedback-control';
    feedbackControl.setAttribute('data-menu-open', 'false');
    feedbackControl.setAttribute('data-detail-open', 'false');

    feedbackButton = document.createElement('button');
    feedbackButton.type = 'button';
    feedbackButton.className = 'x-nt-feedback-button';
    feedbackButton.setAttribute('aria-haspopup', 'menu');
    feedbackButton.setAttribute('aria-expanded', 'false');
    feedbackButton.setAttribute('aria-controls', '_x_extension_newtab_feedback_popover_2026_unique_');
    feedbackButton.innerHTML = getRiSvg('ri-message-3-line', 'ri-size-20');

    feedbackButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      hideTopActionTooltip();
      toggleFeedbackPopover();
    });
    const showFeedbackButtonTooltip = () => {
      if (isFeedbackPopoverOpen()) {
        return;
      }
      showTopActionTooltip(feedbackButton, t('newtab_feedback_button_aria', 'Send feedback'), {
        placement: 'top'
      });
    };
    feedbackButton.addEventListener('mouseenter', showFeedbackButtonTooltip);
    feedbackButton.addEventListener('mouseleave', hideTopActionTooltip);
    feedbackButton.addEventListener('focus', showFeedbackButtonTooltip);
    feedbackButton.addEventListener('blur', hideTopActionTooltip);

    feedbackPopover = document.createElement('div');
    feedbackPopover.className = 'x-nt-feedback-popover';
    feedbackPopover.id = '_x_extension_newtab_feedback_popover_2026_unique_';
    feedbackPopover.hidden = true;
    feedbackPopover.setAttribute('role', 'menu');

    feedbackMenu = document.createElement('div');
    feedbackMenu.className = 'x-nt-feedback-menu';

    feedbackXLink = document.createElement('a');
    feedbackXLink.className = 'x-nt-feedback-action';
    feedbackXLink.target = '_blank';
    feedbackXLink.rel = 'noreferrer noopener';
    feedbackXLink.setAttribute('role', 'menuitem');
    feedbackXLink.innerHTML = getRiSvg('ri-twitter-x-line', 'ri-size-16');
    feedbackXLink.addEventListener('click', () => {
      hideTopActionTooltip();
      closeFeedbackPopover();
    });
    bindFeedbackActionTooltip(
      feedbackXLink,
      () => feedbackXLink.getAttribute('data-tooltip') || t('newtab_feedback_x_tooltip', 'Contacting on X')
    );

    feedbackGithubIssueLink = document.createElement('a');
    feedbackGithubIssueLink.className = 'x-nt-feedback-action';
    feedbackGithubIssueLink.target = '_blank';
    feedbackGithubIssueLink.rel = 'noreferrer noopener';
    feedbackGithubIssueLink.setAttribute('role', 'menuitem');
    feedbackGithubIssueLink.innerHTML = getRiSvg('ri-github-line', 'ri-size-16');
    feedbackGithubIssueLink.addEventListener('click', () => {
      hideTopActionTooltip();
      closeFeedbackPopover();
    });
    bindFeedbackActionTooltip(
      feedbackGithubIssueLink,
      () => feedbackGithubIssueLink.getAttribute('data-tooltip') ||
        t('newtab_feedback_github_issue_tooltip', 'Opening a GitHub Issue')
    );

    feedbackChromeReviewLink = document.createElement('a');
    feedbackChromeReviewLink.className = 'x-nt-feedback-action';
    feedbackChromeReviewLink.target = '_blank';
    feedbackChromeReviewLink.rel = 'noreferrer noopener';
    feedbackChromeReviewLink.setAttribute('role', 'menuitem');
    feedbackChromeReviewLink.innerHTML = getRiSvg('ri-star-line', 'ri-size-16');
    feedbackChromeReviewLink.addEventListener('click', () => {
      hideTopActionTooltip();
      closeFeedbackPopover();
    });
    bindFeedbackActionTooltip(
      feedbackChromeReviewLink,
      () => feedbackChromeReviewLink.getAttribute('data-tooltip') ||
        t('newtab_feedback_chrome_review_tooltip', 'Rate on Chrome Web Store')
    );

    feedbackCommunityButton = document.createElement('button');
    feedbackCommunityButton.type = 'button';
    feedbackCommunityButton.className = 'x-nt-feedback-action x-nt-feedback-action-community';
    feedbackCommunityButton.setAttribute('role', 'menuitem');
    feedbackCommunityButton.setAttribute('aria-haspopup', 'false');
    feedbackCommunityButton.setAttribute('aria-expanded', 'false');
    feedbackCommunityButton.addEventListener('click', handleFeedbackCommunityClick);
    feedbackCommunityButton.addEventListener('auxclick', (event) => {
      if (!isMiddleClick(event)) {
        return;
      }
      handleFeedbackCommunityClick(event);
    });
    bindFeedbackActionTooltip(
      feedbackCommunityButton,
      () => feedbackCommunityButton.getAttribute('data-tooltip') ||
        t('newtab_feedback_discord_tooltip', 'Joining Discord')
    );

    feedbackDetail = document.createElement('div');
    feedbackDetail.className = 'x-nt-feedback-detail';
    feedbackDetail.hidden = true;

    feedbackMenu.appendChild(feedbackXLink);
    feedbackMenu.appendChild(feedbackGithubIssueLink);
    feedbackMenu.appendChild(feedbackChromeReviewLink);
    feedbackMenu.appendChild(feedbackCommunityButton);
    feedbackPopover.appendChild(feedbackMenu);
    feedbackPopover.appendChild(feedbackDetail);
    feedbackControl.appendChild(feedbackButton);
    feedbackControl.appendChild(feedbackPopover);
    updateFeedbackLanguageStrings();
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
      forcedIconBackground: 'default-theme'
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
        element: wordmarkContainer,
        sampleElement: wordmarkImageEl || wordmarkContainer,
        minWidth: 220,
        minHeight: 72
      },
      {
        element: bookmarkTitleWrap,
        sampleElement: bookmarkTitleWrap,
        minWidth: 112,
        minHeight: 44
      },
      {
        element: bookmarkModeMenu && bookmarkModeMenu.control,
        sampleElement: bookmarkModeMenu && (bookmarkModeMenu.trigger || bookmarkModeMenu.control),
        minWidth: 42,
        minHeight: 42,
        iconButton: true
      },
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

  wallpaperRuntime = NEWTAB_WALLPAPER.createWallpaperRuntime({
    documentObj: document,
    windowObj: window,
    chromeObj: chrome,
    extensionRoutes: EXTENSION_ROUTES,
    storageArea,
    localWallpaperStorageArea: localStorageArea,
    storageKeys: {
      wallpaper: NEWTAB_WALLPAPER_STORAGE_KEY,
      localWallpaper: NEWTAB_LOCAL_WALLPAPER_STORAGE_KEY,
      overlay: NEWTAB_WALLPAPER_OVERLAY_STORAGE_KEY,
      effect: NEWTAB_WALLPAPER_EFFECT_STORAGE_KEY,
      wordmark: NEWTAB_WORDMARK_VISIBLE_STORAGE_KEY,
      favicon: NEWTAB_FAVICON_STORAGE_KEY
    },
    searchWidthConfig: NEWTAB_SEARCH_WIDTH_CONFIG,
    t,
    formatMessage,
    getThemeMode: getSelectedThemeMode,
    getEffectiveThemeMode: getScopedThemeMode,
    getThemeScope,
    setThemeMode,
    setThemeScope,
    getRiSvg,
    showToast,
    showTopActionTooltip,
    hideTopActionTooltip,
    applyWordmarkThemeAppearance,
    getWordmarkVisible: () => newtabWordmarkVisible,
    setWordmarkVisible: (value) => {
      newtabWordmarkVisible = normalizeNewtabWordmarkVisible(value);
      applyNewtabWordmarkVisibility();
    },
    getSearchWidth: getEffectiveNewtabSearchWidth,
    setSearchWidth: (value, options) => {
      setNewtabSearchWidth(value, options);
    },
    getAdaptiveToneTargets: createWallpaperAdaptiveToneTargets
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

  function getFigmaFolderSvg(idSuffix) {
    const suffix = String(idSuffix || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
    const baseLowerFilterId = `x-nt-folder-filter-lower-base-${suffix}`;
    const baseUpperFilterId = `x-nt-folder-filter-upper-base-${suffix}`;
    const hoverLowerFilterId = `x-nt-folder-filter-lower-hover-${suffix}`;
    const hoverUpperFilterId = `x-nt-folder-filter-upper-hover-${suffix}`;
    const baseLowerGradientId = `x-nt-folder-gradient-lower-base-${suffix}`;
    const baseUpperGradientId = `x-nt-folder-gradient-upper-base-${suffix}`;
    const hoverLowerGradientId = `x-nt-folder-gradient-lower-hover-${suffix}`;
    const hoverUpperGradientId = `x-nt-folder-gradient-upper-hover-${suffix}`;
    const hoverUpperOverlayGradientId = `x-nt-folder-gradient-upper-overlay-hover-${suffix}`;
    const morphUpperGradientId = `x-nt-folder-gradient-upper-morph-${suffix}`;
    const morphUpperOverlayGradientId = `x-nt-folder-gradient-upper-overlay-morph-${suffix}`;
    return `
      <svg viewBox="0 0 31 29" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <g data-folder-layer="lower">
          <g class="x-nt-folder-shape x-nt-folder-shape--base" filter="url(#${baseLowerFilterId})">
            <path data-folder-part="lower-body" data-folder-fill-base="url(#${baseLowerGradientId})" data-folder-fill-hover="url(#${hoverLowerGradientId})" d="M7.24 2C6.08213 2 5.5032 2 5.06414 2.23247C4.70983 2.42007 4.42007 2.70983 4.23247 3.06414C4 3.5032 4 4.08213 4 5.24V19.76C4 20.9179 4 21.4968 4.23247 21.9359C4.42007 22.2902 4.70983 22.5799 5.06414 22.7675C5.5032 23 6.08213 23 7.24 23H23.76C24.9179 23 25.4968 23 25.9359 22.7675C26.2902 22.5799 26.5799 22.2902 26.7675 21.9359C27 21.4968 27 20.9179 27 19.76V8.24C27 7.08213 27 6.5032 26.7675 6.06414C26.5799 5.70983 26.2902 5.42007 25.9359 5.23247C25.4968 5 24.9179 5 23.76 5H16.2872C15.7668 5 15.5067 5 15.2631 4.93779C15.0647 4.88712 14.8753 4.80628 14.7014 4.69811C14.488 4.56531 14.308 4.37746 13.948 4.00178L12.9862 2.99822C12.6262 2.62254 12.4462 2.43469 12.2327 2.30189C12.0589 2.19372 11.8694 2.11288 11.6711 2.06221C11.4275 2 11.1673 2 10.647 2H7.24Z" fill="url(#${baseLowerGradientId})"/>
            <path data-folder-part="lower-outline" d="M7.24023 2.5H10.6465C11.1918 2.5 11.3785 2.50393 11.5469 2.54688C11.6957 2.58488 11.8384 2.64543 11.9688 2.72656C12.1163 2.8184 12.2478 2.95016 12.625 3.34375L13.5869 4.34766C13.9294 4.70501 14.1583 4.94931 14.4375 5.12305C14.6547 5.25816 14.8918 5.35857 15.1396 5.42188C15.4582 5.50321 15.7923 5.5 16.2871 5.5H23.7598C24.3471 5.5 24.7568 5.50049 25.0752 5.52734C25.3875 5.5537 25.5669 5.60319 25.7021 5.6748C25.9676 5.81544 26.1846 6.03242 26.3252 6.29785C26.3968 6.4331 26.4463 6.61249 26.4727 6.9248C26.4995 7.24322 26.5 7.65291 26.5 8.24023V19.7598C26.5 20.3471 26.4995 20.7568 26.4727 21.0752C26.4463 21.3875 26.3968 21.5669 26.3252 21.7021C26.1846 21.9676 25.9676 22.1846 25.7021 22.3252C25.5669 22.3968 25.3875 22.4463 25.0752 22.4727C24.7568 22.4995 24.3471 22.5 23.7598 22.5H7.24023C6.65291 22.5 6.24322 22.4995 5.9248 22.4727C5.61249 22.4463 5.4331 22.3968 5.29785 22.3252C5.03242 22.1846 4.81544 21.9676 4.6748 21.7021C4.60319 21.5669 4.5537 21.3875 4.52734 21.0752C4.50049 20.7568 4.5 20.3471 4.5 19.7598V5.24023C4.5 4.65291 4.50049 4.24322 4.52734 3.9248C4.5537 3.61249 4.60319 3.4331 4.6748 3.29785C4.81544 3.03242 5.03242 2.81544 5.29785 2.6748C5.4331 2.60319 5.61249 2.5537 5.9248 2.52734C6.24322 2.50049 6.65291 2.5 7.24023 2.5Z" stroke="var(--stroke-0, #5393FF)"/>
          </g>
          <g class="x-nt-folder-shape x-nt-folder-shape--hover" filter="url(#${hoverLowerFilterId})">
            <path data-folder-part-hover="lower-body" d="M7.27966 3C6.06845 3 5.46284 3 5.01299 3.24717C4.65028 3.44648 4.35832 3.75339 4.17738 4.12561C3.95298 4.58724 3.98322 5.19209 4.04371 6.4018L4.71971 19.9218C4.77497 21.027 4.8026 21.5797 5.04189 21.9962C5.23514 22.3326 5.52208 22.6056 5.86774 22.7818C6.29572 23 6.84904 23 7.95566 23H24.4374C25.6583 23 26.2687 23 26.7204 22.7502C27.0846 22.5488 27.3769 22.2388 27.5565 21.8635C27.7794 21.3979 27.7435 20.7885 27.6718 19.5697L27.053 9.04974C26.9885 7.95383 26.9563 7.40587 26.716 6.99327C26.5218 6.65999 26.2354 6.38996 25.8913 6.21572C25.4653 6 24.9164 6 23.8186 6H16.1608C15.6405 6 15.3803 6 15.1367 5.93779C14.9383 5.88712 14.7489 5.80628 14.5751 5.69811C14.3616 5.56531 14.1816 5.37746 13.8216 5.00178L12.8598 3.99822C12.4998 3.62254 12.3198 3.43469 12.1063 3.30189C11.9325 3.19372 11.7431 3.11288 11.5447 3.06221C11.3011 3 11.0409 3 10.5206 3H7.27966Z" fill="url(#${hoverLowerGradientId})"/>
            <path data-folder-part-hover="lower-outline" d="M7.27987 3.5H10.5201C11.0655 3.5 11.2521 3.50393 11.4205 3.54688C11.5693 3.58488 11.712 3.64543 11.8424 3.72656C11.9899 3.8184 12.1214 3.95016 12.4986 4.34375L13.4605 5.34766C13.803 5.70501 14.0319 5.94931 14.3111 6.12305C14.5283 6.25816 14.7654 6.35857 15.0133 6.42188C15.3318 6.50321 15.6659 6.5 16.1607 6.5H23.8189C24.3759 6.5 24.7636 6.50051 25.066 6.52539C25.362 6.54976 25.5338 6.59535 25.6656 6.66211C25.9236 6.7928 26.1382 6.99524 26.2838 7.24512C26.3581 7.37281 26.4139 7.54183 26.4556 7.83594C26.4982 8.13633 26.5216 8.5232 26.5543 9.0791L27.1724 19.5986C27.2088 20.2168 27.2344 20.6491 27.2252 20.9854C27.2161 21.3158 27.1734 21.5048 27.1051 21.6475C26.9703 21.929 26.7512 22.1615 26.4781 22.3125C26.3398 22.389 26.1537 22.4423 25.8248 22.4707C25.4896 22.4996 25.0563 22.5 24.4371 22.5H7.95565C7.3943 22.5 7.00355 22.4998 6.69881 22.4746C6.40048 22.45 6.22764 22.4034 6.09529 22.3359C5.83605 22.2038 5.62012 21.9994 5.47518 21.7471C5.40123 21.6183 5.34672 21.4481 5.30721 21.1514C5.26684 20.8482 5.24736 20.4574 5.21932 19.8965L4.54354 6.37695C4.51286 5.76336 4.49152 5.33461 4.5035 5.00098C4.51527 4.67332 4.5587 4.48532 4.62752 4.34375C4.7632 4.06493 4.98177 3.83493 5.2535 3.68555C5.39147 3.60973 5.57715 3.55741 5.90389 3.5293C6.23648 3.50069 6.66562 3.5 7.27987 3.5Z" stroke="var(--stroke-0, #5393FF)"/>
          </g>
        </g>
        <g data-folder-layer="file">
          <g class="x-nt-folder-shape x-nt-folder-shape--base">
            <path data-folder-part="file-body" d="M7 10C7 9.44772 7.44772 9 8 9H23C23.5523 9 24 9.44772 24 10V17C24 17.5523 23.5523 18 23 18H8C7.44772 18 7 17.5523 7 17V10Z" fill="var(--fill-0, white)"/>
            <path data-folder-part="file-line" d="M13 11L18 11" stroke="var(--stroke-0, #DDE8FB)" stroke-linecap="round"/>
          </g>
          <g class="x-nt-folder-shape x-nt-folder-shape--hover">
            <path data-folder-part-hover="file-body" d="M7.87362 10C7.87362 9.44772 8.32133 9 8.87362 9H23.8736C24.4259 9 24.8736 9.44772 24.8736 10V17C24.8736 17.5523 24.4259 18 23.8736 18H8.87362C8.32133 18 7.87362 17.5523 7.87362 17V10Z" fill="var(--fill-0, white)"/>
            <path data-folder-part-hover="file-line" d="M13.8736 11L18.8736 11" stroke="var(--stroke-0, #DDE8FB)" stroke-linecap="round"/>
          </g>
        </g>
        <g data-folder-layer="upper">
          <g class="x-nt-folder-shape x-nt-folder-shape--base">
            <g filter="url(#${baseUpperFilterId})">
              <path data-folder-part="upper-body" data-folder-fill-base="url(#${morphUpperGradientId})" data-folder-fill-hover="url(#${morphUpperGradientId})" d="M7.24 5C6.08213 5 5.5032 5 5.06414 5.23247C4.70983 5.42007 4.42007 5.70983 4.23247 6.06414C4 6.5032 4 7.08213 4 8.24V19.76C4 20.9179 4 21.4968 4.23247 21.9359C4.42007 22.2902 4.70983 22.5799 5.06414 22.7675C5.5032 23 6.08213 23 7.24 23H23.76C24.9179 23 25.4968 23 25.9359 22.7675C26.2902 22.5799 26.5799 22.2902 26.7675 21.9359C27 21.4968 27 20.9179 27 19.76V8.24C27 7.08213 27 6.5032 26.7675 6.06414C26.5799 5.70983 26.2902 5.42007 25.9359 5.23247C25.4968 5 24.9179 5 23.76 5H14.9046H7.24Z" fill="url(#${morphUpperGradientId})"/>
              <path data-folder-part="upper-overlay" data-folder-fill-base="url(#${morphUpperOverlayGradientId})" data-folder-fill-hover="url(#${morphUpperOverlayGradientId})" data-folder-opacity-base="0" data-folder-opacity-hover="1" d="M7.24 5C6.08213 5 5.5032 5 5.06414 5.23247C4.70983 5.42007 4.42007 5.70983 4.23247 6.06414C4 6.5032 4 7.08213 4 8.24V19.76C4 20.9179 4 21.4968 4.23247 21.9359C4.42007 22.2902 4.70983 22.5799 5.06414 22.7675C5.5032 23 6.08213 23 7.24 23H23.76C24.9179 23 25.4968 23 25.9359 22.7675C26.2902 22.5799 26.5799 22.2902 26.7675 21.9359C27 21.4968 27 20.9179 27 19.76V8.24C27 7.08213 27 6.5032 26.7675 6.06414C26.5799 5.70983 26.2902 5.42007 25.9359 5.23247C25.4968 5 24.9179 5 23.76 5H14.9046H7.24Z" fill="url(#${morphUpperOverlayGradientId})" opacity="0"/>
            </g>
            <path data-folder-part="upper-outline" d="M7.24023 5.5H23.7598C24.3471 5.5 24.7568 5.50049 25.0752 5.52734C25.3875 5.5537 25.5669 5.60319 25.7021 5.6748C25.9676 5.81544 26.1846 6.03242 26.3252 6.29785C26.3968 6.4331 26.4463 6.61249 26.4727 6.9248C26.4995 7.24322 26.5 7.65291 26.5 8.24023V19.7598C26.5 20.3471 26.4995 20.7568 26.4727 21.0752C26.4463 21.3875 26.3968 21.5669 26.3252 21.7021C26.1846 21.9676 25.9676 22.1846 25.7021 22.3252C25.5669 22.3968 25.3875 22.4463 25.0752 22.4727C24.7568 22.4995 24.3471 22.5 23.7598 22.5H7.24023C6.65291 22.5 6.24322 22.4995 5.9248 22.4727C5.61249 22.4463 5.4331 22.3968 5.29785 22.3252C5.03242 22.1846 4.81544 21.9676 4.6748 21.7021C4.60319 21.5669 4.5537 21.3875 4.52734 21.0752C4.50049 20.7568 4.5 20.3471 4.5 19.7598V8.24023C4.5 7.65291 4.50049 7.24322 4.52734 6.9248C4.5537 6.61249 4.60319 6.4331 4.6748 6.29785C4.81544 6.03242 5.03242 5.81544 5.29785 5.6748C5.4331 5.60319 5.61249 5.5537 5.9248 5.52734C6.24322 5.50049 6.65291 5.5 7.24023 5.5Z" stroke="var(--stroke-0, #5393FF)"/>
          </g>
          <g class="x-nt-folder-shape x-nt-folder-shape--hover">
            <g filter="url(#${hoverUpperFilterId})">
              <path data-folder-part-hover="upper-body" d="M9.52978 13C8.56387 13 8.08092 13 7.68721 13.1785C7.36853 13.3231 7.09334 13.5487 6.88913 13.8328C6.63684 14.1839 6.54213 14.6574 6.3527 15.6046L5.6487 19.1246C5.37742 20.481 5.24179 21.1591 5.43499 21.6872C5.59036 22.1119 5.88507 22.4713 6.27102 22.707C6.75093 23 7.44255 23 8.82578 23H25.2175C26.1834 23 26.6663 23 27.06 22.8215C27.3787 22.6769 27.6539 22.4513 27.8581 22.1672C28.1104 21.8161 28.2051 21.3426 28.3945 20.3954L29.0985 16.8754C29.3698 15.519 29.5054 14.8409 29.3122 14.3128C29.1569 13.8881 28.8622 13.5287 28.4762 13.293C27.9963 13 27.3047 13 25.9215 13H17.7782H9.52978Z" fill="url(#${hoverUpperGradientId})"/>
              <path data-folder-part-hover="upper-overlay" d="M9.52978 13C8.56387 13 8.08092 13 7.68721 13.1785C7.36853 13.3231 7.09334 13.5487 6.88913 13.8328C6.63684 14.1839 6.54213 14.6574 6.3527 15.6046L5.6487 19.1246C5.37742 20.481 5.24179 21.1591 5.43499 21.6872C5.59036 22.1119 5.88507 22.4713 6.27102 22.707C6.75093 23 7.44255 23 8.82578 23H25.2175C26.1834 23 26.6663 23 27.06 22.8215C27.3787 22.6769 27.6539 22.4513 27.8581 22.1672C28.1104 21.8161 28.2051 21.3426 28.3945 20.3954L29.0985 16.8754C29.3698 15.519 29.5054 14.8409 29.3122 14.3128C29.1569 13.8881 28.8622 13.5287 28.4762 13.293C27.9963 13 27.3047 13 25.9215 13H17.7782H9.52978Z" fill="url(#${hoverUpperOverlayGradientId})"/>
            </g>
            <path data-folder-part-hover="upper-outline" d="M9.52987 13.5H25.9215C26.6224 13.5 27.1147 13.5001 27.4928 13.5342C27.866 13.5679 28.0704 13.6312 28.2154 13.7197C28.5048 13.8964 28.7258 14.166 28.8424 14.4844C28.9007 14.6439 28.9225 14.8569 28.8824 15.2295C28.8417 15.6069 28.7455 16.09 28.608 16.7773L27.9039 20.2969C27.8077 20.7777 27.741 21.1113 27.6685 21.3691C27.5978 21.6206 27.5306 21.7653 27.4517 21.875C27.2986 22.0881 27.0921 22.2578 26.8531 22.3662C26.7301 22.4219 26.5753 22.4595 26.315 22.4795C26.0479 22.5 25.7079 22.5 25.2174 22.5H8.82576C8.12483 22.5 7.63254 22.4999 7.25447 22.4658C6.88123 22.4321 6.67684 22.3688 6.53182 22.2803C6.24245 22.1036 6.02143 21.834 5.90487 21.5156C5.84649 21.3561 5.8247 21.1431 5.86483 20.7705C5.90551 20.3931 6.00177 19.91 6.13924 19.2227L6.84334 15.7031C6.93951 15.2223 7.00623 14.8887 7.07869 14.6309C7.14939 14.3794 7.21668 14.2347 7.29549 14.125C7.44865 13.9119 7.65511 13.7422 7.89412 13.6338C8.0171 13.5781 8.17191 13.5405 8.43221 13.5205C8.69934 13.5 9.03932 13.5 9.52987 13.5Z" stroke="var(--stroke-0, #5393FF)"/>
          </g>
        </g>
        <defs>
          <filter id="${baseLowerFilterId}" x="0" y="0" width="31" height="29" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
            <feFlood flood-opacity="0" result="BackgroundImageFix"/>
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
            <feOffset dy="2"/>
            <feGaussianBlur stdDeviation="2"/>
            <feComposite in2="hardAlpha" operator="out"/>
            <feColorMatrix type="matrix" values="0 0 0 0 0.541176 0 0 0 0 0.713726 0 0 0 0 1 0 0 0 0.21 0"/>
            <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow"/>
            <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape"/>
          </filter>
          <filter id="${hoverLowerFilterId}" x="0" y="1" width="31.7267" height="28" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
            <feFlood flood-opacity="0" result="BackgroundImageFix"/>
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
            <feOffset dy="2"/>
            <feGaussianBlur stdDeviation="2"/>
            <feComposite in2="hardAlpha" operator="out"/>
            <feColorMatrix type="matrix" values="0 0 0 0 0.541176 0 0 0 0 0.713726 0 0 0 0 1 0 0 0 0.21 0"/>
            <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow"/>
            <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape"/>
          </filter>
          <filter id="${baseUpperFilterId}" x="3.5" y="5" width="26" height="18.8" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
            <feFlood flood-opacity="0" result="BackgroundImageFix"/>
            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
            <feOffset dy="0.8"/>
            <feGaussianBlur stdDeviation="0.7"/>
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
            <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.72 0"/>
            <feBlend mode="normal" in2="shape" result="effect1_innerShadow"/>
          </filter>
          <filter id="${hoverUpperFilterId}" x="5.34419" y="13" width="24.0589" height="10.8" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
            <feFlood flood-opacity="0" result="BackgroundImageFix"/>
            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
            <feOffset dy="0.8"/>
            <feGaussianBlur stdDeviation="0.7"/>
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
            <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.72 0"/>
            <feBlend mode="normal" in2="shape" result="effect1_innerShadow"/>
          </filter>
          <linearGradient id="${baseLowerGradientId}" x1="15.5" y1="2" x2="15.5" y2="23" gradientUnits="userSpaceOnUse">
            <stop stop-color="#93BBFF"/>
            <stop offset="0.884515" stop-color="#81B0FF"/>
            <stop offset="0.884615" stop-color="#4389FF"/>
            <stop offset="1" stop-color="#97BEFF"/>
          </linearGradient>
          <linearGradient id="${baseUpperGradientId}" x1="15.5" y1="2" x2="15.5" y2="23" gradientUnits="userSpaceOnUse">
            <stop stop-color="#CCDFFF"/>
            <stop offset="0.884515" stop-color="#B2CEFF"/>
            <stop offset="0.884615" stop-color="#89B5FF"/>
            <stop offset="1" stop-color="#97BEFF"/>
          </linearGradient>
          <linearGradient id="${hoverLowerGradientId}" x1="16.3736" y1="2" x2="16.3736" y2="23" gradientUnits="userSpaceOnUse">
            <stop stop-color="#93BBFF"/>
            <stop offset="0.884515" stop-color="#81B0FF"/>
            <stop offset="0.884615" stop-color="#4389FF"/>
            <stop offset="1" stop-color="#97BEFF"/>
          </linearGradient>
          <linearGradient id="${hoverUpperGradientId}" x1="16.3736" y1="2" x2="16.3736" y2="23" gradientUnits="userSpaceOnUse">
            <stop stop-color="#93BBFF"/>
            <stop offset="0.884515" stop-color="#81B0FF"/>
            <stop offset="0.884615" stop-color="#4389FF"/>
            <stop offset="1" stop-color="#97BEFF"/>
          </linearGradient>
          <linearGradient id="${hoverUpperOverlayGradientId}" x1="17.3736" y1="11.3333" x2="17.3736" y2="23" gradientUnits="userSpaceOnUse">
            <stop stop-color="#CCDFFF"/>
            <stop offset="0.884515" stop-color="#B2CEFF"/>
            <stop offset="0.884615" stop-color="#89B5FF"/>
            <stop offset="1" stop-color="#97BEFF"/>
          </linearGradient>
          <linearGradient id="${morphUpperGradientId}" data-folder-gradient-morph="upper-main" x1="15.5" y1="2" x2="15.5" y2="23" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#CCDFFF"></stop>
            <stop offset="0.884515" stop-color="#B2CEFF"></stop>
            <stop offset="0.884615" stop-color="#89B5FF"></stop>
            <stop offset="1" stop-color="#97BEFF"></stop>
          </linearGradient>
          <linearGradient id="${morphUpperOverlayGradientId}" data-folder-gradient-morph="upper-overlay" x1="15.5" y1="2" x2="15.5" y2="23" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#CCDFFF"></stop>
            <stop offset="0.884515" stop-color="#B2CEFF"></stop>
            <stop offset="0.884615" stop-color="#89B5FF"></stop>
            <stop offset="1" stop-color="#97BEFF"></stop>
          </linearGradient>
        </defs>
      </svg>
    `;
  }

  const FOLDER_PATH_MORPH_DURATION_MS = 460;
  const FOLDER_PATH_MORPH_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const FOLDER_PATH_MORPH_POINT_SAMPLE_COUNT = 140;
  const FOLDER_PATH_MORPH_BEZIER = {
    x1: 0.22,
    y1: 1,
    x2: 0.36,
    y2: 1
  };

  function cubicBezierSampleCurveX(t, x1, x2) {
    const inv = 1 - t;
    return 3 * inv * inv * t * x1 + 3 * inv * t * t * x2 + t * t * t;
  }

  function cubicBezierSampleCurveY(t, y1, y2) {
    const inv = 1 - t;
    return 3 * inv * inv * t * y1 + 3 * inv * t * t * y2 + t * t * t;
  }

  function cubicBezierSampleCurveDerivativeX(t, x1, x2) {
    const inv = 1 - t;
    return 3 * inv * inv * x1 + 6 * inv * t * (x2 - x1) + 3 * t * t * (1 - x2);
  }

  function cubicBezierEase(progress, bezier) {
    const clamped = Math.max(0, Math.min(1, progress));
    if (clamped === 0 || clamped === 1) {
      return clamped;
    }
    let t = clamped;
    for (let i = 0; i < 8; i += 1) {
      const x = cubicBezierSampleCurveX(t, bezier.x1, bezier.x2) - clamped;
      const dx = cubicBezierSampleCurveDerivativeX(t, bezier.x1, bezier.x2);
      if (Math.abs(x) < 1e-6 || Math.abs(dx) < 1e-6) {
        break;
      }
      t -= x / dx;
    }
    t = Math.max(0, Math.min(1, t));
    return cubicBezierSampleCurveY(t, bezier.y1, bezier.y2);
  }

  function buildPathMorphTemplate(fromD, toD) {
    const numberPattern = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;
    const fromNumbers = (String(fromD || '').match(numberPattern) || []).map((value) => Number(value));
    const toNumbers = (String(toD || '').match(numberPattern) || []).map((value) => Number(value));
    if (!fromNumbers.length || fromNumbers.length !== toNumbers.length) {
      return null;
    }
    const fromMask = String(fromD).replace(numberPattern, '#');
    const toMask = String(toD).replace(numberPattern, '#');
    if (fromMask !== toMask) {
      return null;
    }
    const segments = String(fromD).split(numberPattern);
    return { type: 'number', segments, fromNumbers, toNumbers };
  }

  function composeNumberPathD(segments, numbers) {
    let output = '';
    for (let i = 0; i < numbers.length; i += 1) {
      output += `${segments[i]}${Number(numbers[i].toFixed(6))}`;
    }
    output += segments[numbers.length] || '';
    return output;
  }

  function isClosedPathData(d) {
    return /[zZ]\s*$/.test(String(d || '').trim());
  }

  function samplePathPoints(svgEl, d, sampleCount) {
    if (!svgEl || !d) {
      return null;
    }
    const count = Math.max(8, sampleCount | 0);
    const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempPath.setAttribute('d', d);
    tempPath.setAttribute('fill', 'none');
    tempPath.setAttribute('stroke', 'none');
    tempPath.style.opacity = '0';
    tempPath.style.pointerEvents = 'none';
    svgEl.appendChild(tempPath);
    try {
      const total = tempPath.getTotalLength();
      if (!Number.isFinite(total) || total <= 0) {
        return null;
      }
      const closed = isClosedPathData(d);
      const points = [];
      const divisor = closed ? count : Math.max(1, count - 1);
      for (let i = 0; i < count; i += 1) {
        const ratio = i / divisor;
        const len = Math.max(0, Math.min(total, total * ratio));
        const point = tempPath.getPointAtLength(len);
        points.push({ x: point.x, y: point.y });
      }
      return { points, closed };
    } catch (error) {
      return null;
    } finally {
      svgEl.removeChild(tempPath);
    }
  }

  function buildPointMorphTemplate(pathEl, fromD, toD) {
    if (!pathEl) {
      return null;
    }
    const svgEl = pathEl.closest('svg');
    if (!svgEl) {
      return null;
    }
    const sampleCount = FOLDER_PATH_MORPH_POINT_SAMPLE_COUNT;
    const fromData = samplePathPoints(svgEl, fromD, sampleCount);
    const toData = samplePathPoints(svgEl, toD, sampleCount);
    if (!fromData || !toData || fromData.points.length !== toData.points.length) {
      return null;
    }
    const closed = fromData.closed && toData.closed;
    let fromPoints = fromData.points;
    let toPoints = toData.points;
    if (closed && fromPoints.length > 4) {
      const alignClosedPoints = (sourcePoints, targetPoints) => {
        const rotatePoints = (points, shift) => {
          const len = points.length;
          const normalizedShift = ((shift % len) + len) % len;
          if (!normalizedShift) {
            return points.slice();
          }
          return points.slice(normalizedShift).concat(points.slice(0, normalizedShift));
        };
        const reversePoints = (points) => points.slice().reverse();
        const calcScore = (aPoints, bPoints) => {
          let total = 0;
          for (let i = 0; i < aPoints.length; i += 1) {
            const dx = aPoints[i].x - bPoints[i].x;
            const dy = aPoints[i].y - bPoints[i].y;
            total += dx * dx + dy * dy;
          }
          return total;
        };
        let best = targetPoints.slice();
        let bestScore = Number.POSITIVE_INFINITY;
        const directions = [targetPoints, reversePoints(targetPoints)];
        for (let dirIndex = 0; dirIndex < directions.length; dirIndex += 1) {
          const dirPoints = directions[dirIndex];
          for (let shift = 0; shift < dirPoints.length; shift += 1) {
            const candidate = rotatePoints(dirPoints, shift);
            const score = calcScore(sourcePoints, candidate);
            if (score < bestScore) {
              bestScore = score;
              best = candidate;
            }
          }
        }
        return best;
      };
      toPoints = alignClosedPoints(fromPoints, toPoints);
    }
    return {
      type: 'point',
      fromPoints,
      toPoints,
      closed
    };
  }

  function composePointPathD(points, closed) {
    if (!Array.isArray(points) || !points.length) {
      return '';
    }
    let d = `M ${Number(points[0].x.toFixed(6))} ${Number(points[0].y.toFixed(6))}`;
    for (let i = 1; i < points.length; i += 1) {
      d += ` L ${Number(points[i].x.toFixed(6))} ${Number(points[i].y.toFixed(6))}`;
    }
    if (closed) {
      d += ' Z';
    }
    return d;
  }

  function cancelFolderPathMorph(part) {
    if (!part) {
      return;
    }
    if (part.animationFrameId) {
      cancelAnimationFrame(part.animationFrameId);
      part.animationFrameId = 0;
    }
  }

  function hexToRgb(hex) {
    const raw = String(hex || '').trim();
    const normalized = raw.startsWith('#') ? raw.slice(1) : raw;
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
      return null;
    }
    return {
      r: Number.parseInt(normalized.slice(0, 2), 16),
      g: Number.parseInt(normalized.slice(2, 4), 16),
      b: Number.parseInt(normalized.slice(4, 6), 16)
    };
  }

  function rgbToHex(rgb) {
    const toHex = (value) => {
      const v = Math.max(0, Math.min(255, Math.round(value)));
      return v.toString(16).padStart(2, '0');
    };
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
  }

  function lerpNumber(fromValue, toValue, t) {
    return fromValue + (toValue - fromValue) * t;
  }

  function applyGradientMorphConfig(gradientEl, config) {
    if (!gradientEl || !config) {
      return;
    }
    gradientEl.setAttribute('x1', String(config.x1));
    gradientEl.setAttribute('y1', String(config.y1));
    gradientEl.setAttribute('x2', String(config.x2));
    gradientEl.setAttribute('y2', String(config.y2));
    const stops = gradientEl.querySelectorAll('stop');
    config.stops.forEach((stopConfig, index) => {
      const stopEl = stops[index];
      if (!stopEl) {
        return;
      }
      stopEl.setAttribute('offset', String(stopConfig.offset));
      stopEl.setAttribute('stop-color', stopConfig.color);
    });
  }

  function interpolateGradientConfig(fromConfig, toConfig, t) {
    const progress = Math.max(0, Math.min(1, t));
    const next = {
      x1: Number(lerpNumber(fromConfig.x1, toConfig.x1, progress).toFixed(6)),
      y1: Number(lerpNumber(fromConfig.y1, toConfig.y1, progress).toFixed(6)),
      x2: Number(lerpNumber(fromConfig.x2, toConfig.x2, progress).toFixed(6)),
      y2: Number(lerpNumber(fromConfig.y2, toConfig.y2, progress).toFixed(6)),
      stops: []
    };
    for (let i = 0; i < fromConfig.stops.length; i += 1) {
      const fromStop = fromConfig.stops[i];
      const toStop = toConfig.stops[i];
      if (!fromStop || !toStop) {
        continue;
      }
      const fromRgb = hexToRgb(fromStop.color);
      const toRgb = hexToRgb(toStop.color);
      const color = (fromRgb && toRgb)
        ? rgbToHex({
          r: lerpNumber(fromRgb.r, toRgb.r, progress),
          g: lerpNumber(fromRgb.g, toRgb.g, progress),
          b: lerpNumber(fromRgb.b, toRgb.b, progress)
        })
        : (progress < 0.5 ? fromStop.color : toStop.color);
      next.stops.push({
        offset: Number(lerpNumber(fromStop.offset, toStop.offset, progress).toFixed(6)),
        color
      });
    }
    return next;
  }

  function initFolderUpperGradientMorph(folderIcon) {
    if (!folderIcon || folderIcon._xUpperGradientMorph) {
      return;
    }
    const svg = folderIcon.querySelector('svg');
    if (!svg) {
      return;
    }
    const mainGradientEl = svg.querySelector('[data-folder-gradient-morph="upper-main"]');
    const overlayGradientEl = svg.querySelector('[data-folder-gradient-morph="upper-overlay"]');
    if (!mainGradientEl || !overlayGradientEl) {
      return;
    }
    const baseMain = {
      x1: 15.5, y1: 2, x2: 15.5, y2: 23,
      stops: [
        { offset: 0, color: '#CCDFFF' },
        { offset: 0.884515, color: '#B2CEFF' },
        { offset: 0.884615, color: '#89B5FF' },
        { offset: 1, color: '#97BEFF' }
      ]
    };
    const hoverMain = {
      x1: 16.3736, y1: 2, x2: 16.3736, y2: 23,
      stops: [
        { offset: 0, color: '#93BBFF' },
        { offset: 0.884515, color: '#81B0FF' },
        { offset: 0.884615, color: '#4389FF' },
        { offset: 1, color: '#97BEFF' }
      ]
    };
    const baseOverlay = {
      x1: 15.5, y1: 2, x2: 15.5, y2: 23,
      stops: [
        { offset: 0, color: '#CCDFFF' },
        { offset: 0.884515, color: '#B2CEFF' },
        { offset: 0.884615, color: '#89B5FF' },
        { offset: 1, color: '#97BEFF' }
      ]
    };
    const hoverOverlay = {
      x1: 17.3736, y1: 11.3333, x2: 17.3736, y2: 23,
      stops: [
        { offset: 0, color: '#CCDFFF' },
        { offset: 0.827284, color: '#B2CEFF' },
        { offset: 0.85339, color: '#89B5FF' },
        { offset: 1, color: '#97BEFF' }
      ]
    };
    folderIcon._xUpperGradientMorph = {
      mainGradientEl,
      overlayGradientEl,
      baseMain,
      hoverMain,
      baseOverlay,
      hoverOverlay,
      state: 'base',
      rafId: 0
    };
    applyGradientMorphConfig(mainGradientEl, baseMain);
    applyGradientMorphConfig(overlayGradientEl, baseOverlay);
  }

  function playFolderUpperGradientMorph(folderIcon, toHover) {
    if (!folderIcon) {
      return;
    }
    if (!folderIcon._xUpperGradientMorph) {
      initFolderUpperGradientMorph(folderIcon);
    }
    const morphState = folderIcon._xUpperGradientMorph;
    if (!morphState) {
      return;
    }
    const targetState = toHover ? 'hover' : 'base';
    if (morphState.state === targetState) {
      return;
    }
    morphState.state = targetState;
    if (morphState.rafId) {
      cancelAnimationFrame(morphState.rafId);
      morphState.rafId = 0;
    }
    const fromMain = toHover ? morphState.baseMain : morphState.hoverMain;
    const toMain = toHover ? morphState.hoverMain : morphState.baseMain;
    const fromOverlay = toHover ? morphState.baseOverlay : morphState.hoverOverlay;
    const toOverlay = toHover ? morphState.hoverOverlay : morphState.baseOverlay;
    const startTime = performance.now();
    const tick = (now) => {
      const rawProgress = Math.max(0, Math.min(1, (now - startTime) / FOLDER_PATH_MORPH_DURATION_MS));
      const eased = cubicBezierEase(rawProgress, FOLDER_PATH_MORPH_BEZIER);
      applyGradientMorphConfig(morphState.mainGradientEl, interpolateGradientConfig(fromMain, toMain, eased));
      applyGradientMorphConfig(morphState.overlayGradientEl, interpolateGradientConfig(fromOverlay, toOverlay, eased));
      if (rawProgress < 1) {
        morphState.rafId = requestAnimationFrame(tick);
        return;
      }
      morphState.rafId = 0;
      applyGradientMorphConfig(morphState.mainGradientEl, toMain);
      applyGradientMorphConfig(morphState.overlayGradientEl, toOverlay);
    };
    morphState.rafId = requestAnimationFrame(tick);
  }

  function setFolderUpperFilterSuspended(folderIcon, suspended) {
    if (!folderIcon) {
      return;
    }
    const svg = folderIcon.querySelector('svg');
    if (!svg) {
      return;
    }
    const upperFilterGroup = svg.querySelector('g[data-folder-layer="upper"] .x-nt-folder-shape--base > g[filter]');
    if (!upperFilterGroup) {
      return;
    }
    if (suspended) {
      if (typeof upperFilterGroup._xOriginalFilterAttr === 'undefined') {
        upperFilterGroup._xOriginalFilterAttr = upperFilterGroup.getAttribute('filter');
      }
      upperFilterGroup.setAttribute('filter', 'none');
      return;
    }
    const original = upperFilterGroup._xOriginalFilterAttr;
    if (typeof original === 'string' && original) {
      upperFilterGroup.setAttribute('filter', original);
    } else {
      upperFilterGroup.removeAttribute('filter');
    }
  }

  function animatePathDWithCurve(part, fromD, toD) {
    let template = buildPathMorphTemplate(fromD, toD);
    if (!template) {
      template = buildPointMorphTemplate(part.pathEl, fromD, toD);
    }
    if (!template) {
      part.pathEl.setAttribute('d', toD);
      return false;
    }
    cancelFolderPathMorph(part);
    const startTime = performance.now();
    const syncFollowers = (dValue) => {
      if (!part || !Array.isArray(part.linkedFollowers) || !part.linkedFollowers.length) {
        return;
      }
      part.linkedFollowers.forEach((el) => {
        if (el && typeof el.setAttribute === 'function') {
          el.setAttribute('d', dValue);
        }
      });
    };
    const tick = (now) => {
      const elapsed = now - startTime;
      const rawProgress = Math.max(0, Math.min(1, elapsed / FOLDER_PATH_MORPH_DURATION_MS));
      const eased = cubicBezierEase(rawProgress, FOLDER_PATH_MORPH_BEZIER);
      if (template.type === 'number') {
        const values = template.fromNumbers.map((fromValue, index) => {
          const toValue = template.toNumbers[index];
          return fromValue + (toValue - fromValue) * eased;
        });
        const nextD = composeNumberPathD(template.segments, values);
        part.pathEl.setAttribute('d', nextD);
        syncFollowers(nextD);
      } else {
        const points = template.fromPoints.map((fromPoint, index) => {
          const toPoint = template.toPoints[index];
          return {
            x: fromPoint.x + (toPoint.x - fromPoint.x) * eased,
            y: fromPoint.y + (toPoint.y - fromPoint.y) * eased
          };
        });
        const nextD = composePointPathD(points, template.closed);
        part.pathEl.setAttribute('d', nextD);
        syncFollowers(nextD);
      }
      if (rawProgress < 1) {
        part.animationFrameId = requestAnimationFrame(tick);
        return;
      }
      part.pathEl.setAttribute('d', toD);
      syncFollowers(toD);
      part.animationFrameId = 0;
    };
    part.animationFrameId = requestAnimationFrame(tick);
    return true;
  }

  function initFolderPathMorph(folderIcon) {
    if (!folderIcon || folderIcon._xFolderMorphParts) {
      return;
    }
    const svg = folderIcon.querySelector('svg');
    if (!svg) {
      folderIcon._xFolderMorphParts = [];
      return;
    }
    const hoverPathMap = new Map();
    svg.querySelectorAll('[data-folder-part-hover]').forEach((pathEl) => {
      const partName = pathEl.getAttribute('data-folder-part-hover');
      const partD = pathEl.getAttribute('d');
      if (!partName || !partD) {
        return;
      }
      hoverPathMap.set(partName, partD);
    });
    const parts = [];
    svg.querySelectorAll('[data-folder-part]').forEach((pathEl) => {
      const partName = pathEl.getAttribute('data-folder-part');
      const baseD = pathEl.getAttribute('d');
      const hoverD = hoverPathMap.get(partName);
      if (!partName || !baseD || !hoverD) {
        return;
      }
      parts.push({
        partName,
        pathEl,
        baseD,
        hoverD,
        fillBase: pathEl.getAttribute('data-folder-fill-base') || '',
        fillHover: pathEl.getAttribute('data-folder-fill-hover') || '',
        opacityBase: Number.parseFloat(pathEl.getAttribute('data-folder-opacity-base')),
        opacityHover: Number.parseFloat(pathEl.getAttribute('data-folder-opacity-hover')),
        linkedFollowers: [],
        animationFrameId: 0
      });
    });
    const partMap = new Map();
    parts.forEach((part) => {
      partMap.set(part.partName, part);
    });
    const upperBodyPart = partMap.get('upper-body');
    const upperOverlayPart = partMap.get('upper-overlay');
    if (upperBodyPart && upperOverlayPart) {
      upperBodyPart.linkedFollowers.push(upperOverlayPart.pathEl);
    }
    parts.forEach((part) => {
      if (part.fillBase) {
        part.pathEl.setAttribute('fill', part.fillBase);
      }
      if (Number.isFinite(part.opacityBase)) {
        part.pathEl.style.opacity = String(part.opacityBase);
      }
    });
    folderIcon._xFolderMorphParts = parts;
    folderIcon._xFolderMorphState = 'base';
  }

  function playFolderPathMorph(folderIcon, toHover) {
    if (!folderIcon) {
      return;
    }
    if (!folderIcon._xFolderMorphParts) {
      initFolderPathMorph(folderIcon);
    }
    const parts = Array.isArray(folderIcon._xFolderMorphParts) ? folderIcon._xFolderMorphParts : [];
    if (!parts.length) {
      return;
    }
    const targetState = toHover ? 'hover' : 'base';
    if (folderIcon._xFolderMorphState === targetState) {
      return;
    }
    setFolderUpperFilterSuspended(folderIcon, true);
    playFolderUpperGradientMorph(folderIcon, toHover);
    if (folderIcon._xUpperFilterRestoreTimerId) {
      clearTimeout(folderIcon._xUpperFilterRestoreTimerId);
      folderIcon._xUpperFilterRestoreTimerId = 0;
    }
    folderIcon._xUpperFilterRestoreTimerId = window.setTimeout(() => {
      folderIcon._xUpperFilterRestoreTimerId = 0;
      setFolderUpperFilterSuspended(folderIcon, false);
    }, FOLDER_PATH_MORPH_DURATION_MS + 48);
    folderIcon._xFolderMorphState = targetState;
    parts.forEach((part) => {
      const currentD = part.pathEl && typeof part.pathEl.getAttribute === 'function'
        ? (part.pathEl.getAttribute('d') || '')
        : '';
      const fromD = currentD || (toHover ? part.baseD : part.hoverD);
      const toD = toHover ? part.hoverD : part.baseD;
      if (!part.pathEl || !fromD || !toD) {
        return;
      }
      const targetFill = toHover ? part.fillHover : part.fillBase;
      if (targetFill) {
        part.pathEl.setAttribute('fill', targetFill);
      }
      if (Number.isFinite(part.opacityBase) && Number.isFinite(part.opacityHover)) {
        part.pathEl.style.transition = `opacity ${FOLDER_PATH_MORPH_DURATION_MS}ms ${FOLDER_PATH_MORPH_EASING}`;
        part.pathEl.style.opacity = String(toHover ? part.opacityHover : part.opacityBase);
      }
      if (part.partName === 'upper-overlay') {
        const upperBodyPart = parts.find((item) => item.partName === 'upper-body');
        if (upperBodyPart && upperBodyPart.pathEl) {
          part.pathEl.setAttribute('d', upperBodyPart.pathEl.getAttribute('d') || toD);
          return;
        }
      }
      const animated = animatePathDWithCurve(part, fromD, toD);
      if (!animated) {
        part.pathEl.setAttribute('d', toD);
        part.animationFrameId = 0;
      }
    });
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
    if (defaultSearchEngineState.host) {
      return `https://${defaultSearchEngineState.host}/favicon.ico`;
    }
    const engine = getSearchEngineById(defaultSearchEngineState.id);
    if (engine) {
      try {
        const host = new URL(engine.searchUrl('test')).hostname;
        return `https://${host}/favicon.ico`;
      } catch (e) {
        return '';
      }
    }
    return 'https://www.google.com/favicon.ico';
  }

  function getSearchActionLabel() {
    if (defaultSearchEngineState && defaultSearchEngineState.name) {
      return formatMessage('action_search_engine', '在 {engine} 中搜索', {
        engine: defaultSearchEngineState.name
      });
    }
    return t('action_search', '搜索');
  }

  function loadDefaultSearchEngineState() {
    if (!storageArea) {
      return;
    }
    storageArea.get([DEFAULT_SEARCH_ENGINE_STORAGE_KEY], (result) => {
      const stored = result ? result[DEFAULT_SEARCH_ENGINE_STORAGE_KEY] : null;
      if (stored && stored.id) {
        defaultSearchEngineState = stored;
      }
    });
  }

  function updateRecentHeading() {
    if (!recentHeading) {
      return;
    }
    const key = currentRecentMode === 'most' ? 'recent_heading_most' : 'recent_heading_latest';
    const fallback = currentRecentMode === 'most' ? 'Most visited' : 'Recent visits';
    recentHeading.textContent = t(key, fallback);
  }

  function updateRecentModeMenu() {
    if (recentModeMenu && typeof recentModeMenu.update === 'function') {
      recentModeMenu.update();
    }
  }

  function setRecentMode(nextMode) {
    const mode = normalizeRecentMode(nextMode, 'latest');
    if (currentRecentMode === mode) {
      updateRecentModeMenu();
      return;
    }
    currentRecentMode = mode;
    updateRecentHeading();
    updateRecentModeMenu();
    if (storageArea) {
      storageArea.set({ [RECENT_MODE_STORAGE_KEY]: mode });
    }
    markRecentDataDirty();
    loadRecentSites({ force: true });
  }

  function canDismissRecentCard() {
    return true;
  }

  function updateBookmarkHeading() {
    if (!bookmarkHeading) {
      return;
    }
    bookmarkHeading.textContent = t('bookmarks_heading', '书签');
  }

  function updateBookmarkModeMenu() {
    if (bookmarkModeMenu && typeof bookmarkModeMenu.update === 'function') {
      bookmarkModeMenu.update();
    }
    if (bookmarkGrid) {
      bookmarkGrid.setAttribute('data-view-mode', currentBookmarkViewMode);
    }
  }

  function setBookmarkViewMode(nextMode) {
    const mode = normalizeBookmarkViewMode(nextMode);
    if (currentBookmarkViewMode === mode) {
      updateBookmarkModeMenu();
      return;
    }
    closeBookmarkCascadeMenu();
    currentBookmarkViewMode = mode;
    bookmarkCurrentPage = 0;
    bookmarkRenderSignature = '';
    updateBookmarkModeMenu();
    if (storageArea) {
      storageArea.set({ [BOOKMARK_VIEW_MODE_STORAGE_KEY]: mode });
    }
    markBookmarkDataDirty();
    loadBookmarks({ force: true });
  }

  function navigateBookmarkFolder(targetId) {
    const id = String(targetId || '').trim();
    if (!id) {
      return;
    }
    closeBookmarkCascadeMenu();
    bookmarkCurrentFolderId = id;
    bookmarkCurrentPage = 0;
    bookmarkRenderSignature = '';
    loadBookmarks({ force: true });
  }

  function updateBookmarkHeadingRootLinkState(isNested) {
    if (!bookmarkHeading) {
      return;
    }
    const nested = !!isNested;
    bookmarkHeading.classList.toggle('x-nt-bookmarks-heading--link', nested);
    bookmarkHeading._xCanNavigateRoot = nested;
    if (nested) {
      const rootLabel = t('bookmarks_heading', '书签');
      bookmarkHeading.setAttribute('role', 'button');
      bookmarkHeading.setAttribute('tabindex', '0');
      bookmarkHeading.setAttribute('aria-label', rootLabel);
      bookmarkHeading.title = rootLabel;
    } else {
      bookmarkHeading.removeAttribute('role');
      bookmarkHeading.removeAttribute('tabindex');
      bookmarkHeading.removeAttribute('aria-label');
      bookmarkHeading.title = '';
    }
  }

  function updateBookmarkPagerLabels() {
    if (bookmarkPagerPrevButton) {
      const prevLabel = t('bookmarks_page_prev', '上一页');
      bookmarkPagerPrevButton.setAttribute('aria-label', prevLabel);
      bookmarkPagerPrevButton.setAttribute('data-tooltip', prevLabel);
      bookmarkPagerPrevButton.removeAttribute('title');
    }
    if (bookmarkPagerNextButton) {
      const nextLabel = t('bookmarks_page_next', '下一页');
      bookmarkPagerNextButton.setAttribute('aria-label', nextLabel);
      bookmarkPagerNextButton.setAttribute('data-tooltip', nextLabel);
      bookmarkPagerNextButton.removeAttribute('title');
    }
    if (bookmarkOpenManagerButton) {
      const managerLabel = t('bookmarks_open_manager', '打开书签管理页');
      bookmarkOpenManagerButton.setAttribute('aria-label', managerLabel);
      bookmarkOpenManagerButton.setAttribute('data-tooltip', managerLabel);
      bookmarkOpenManagerButton.removeAttribute('title');
    }
  }

  function bindBookmarkPagerTooltip(button, getLabel) {
    if (!button || typeof getLabel !== 'function') {
      return;
    }
    const showTooltip = () => {
      const label = String(getLabel() || '').trim();
      if (!label) {
        return;
      }
      showTopActionTooltip(button, label, { placement: 'top' });
    };
    button.addEventListener('pointerenter', showTooltip);
    button.addEventListener('pointerleave', hideTopActionTooltip);
    button.addEventListener('focus', showTooltip);
    button.addEventListener('blur', hideTopActionTooltip);
  }

  function updateBookmarkBreadcrumb() {
    if (!bookmarkBreadcrumb) {
      return;
    }
    const path = Array.isArray(bookmarkFolderPath) ? bookmarkFolderPath : [];
    bookmarkBreadcrumb.innerHTML = '';
    if (path.length <= 1) {
      bookmarkBreadcrumb.style.setProperty('display', 'none');
      updateBookmarkHeadingRootLinkState(false);
      return;
    }
    updateBookmarkHeadingRootLinkState(true);
    const pathWithoutRoot = path.slice(1);
    bookmarkBreadcrumb.style.setProperty('display', 'inline-flex');
    pathWithoutRoot.forEach((crumb, index) => {
      const isCurrent = index === (pathWithoutRoot.length - 1);
      const separator = document.createElement('span');
      separator.className = 'x-nt-bookmarks-crumb-sep';
      separator.textContent = '/';
      bookmarkBreadcrumb.appendChild(separator);
      const crumbButton = document.createElement('button');
      crumbButton.type = 'button';
      crumbButton.className = 'x-nt-bookmarks-crumb';
      const title = String(crumb && crumb.title ? crumb.title : '').trim() || t('bookmarks_heading', '书签');
      crumbButton.textContent = title;
      crumbButton.title = title;
      crumbButton.setAttribute('aria-label', title);
      if (isCurrent) {
        crumbButton.setAttribute('aria-current', 'page');
        crumbButton.disabled = true;
      } else {
        crumbButton.addEventListener('click', () => {
          const targetId = crumb && crumb.id ? String(crumb.id) : '';
          if (!targetId) {
            return;
          }
          navigateBookmarkFolder(targetId);
        });
      }
      bookmarkBreadcrumb.appendChild(crumbButton);
    });
  }

  function applyLanguageStrings() {
    document.title = t('newtab_page_title', 'New Tab');
    updateRecentHeading();
    updateBookmarkHeading();
    updateBookmarkPagerLabels();
    updateBookmarkBreadcrumb();
    updateRecentModeMenu();
    updateBookmarkModeMenu();
    updateWallpaperLanguageStrings();
    updateWallpaperAppearanceSelectionUi();
    updateFeedbackLanguageStrings();
    updateShortcutLanguageStrings();
    if (updateNoticeController &&
        typeof updateNoticeController.updateLanguage === 'function') {
      updateNoticeController.updateLanguage();
    }
    if (inputParts && inputParts.input) {
      defaultPlaceholderText = t('search_placeholder', defaultPlaceholderText);
      if (!siteSearchState) {
        inputParts.input.placeholder = defaultPlaceholderText;
      }
    }
    updateModeBadge(inputParts && inputParts.input ? inputParts.input.value : '');
    recentCards.forEach((card) => {
      if (!card || !card._xActionText || !card._xTitleText) {
        return;
      }
      card._xActionText.textContent = t('action_go_current_tab', '前往');
      card.setAttribute('aria-label', formatMessage('open_prefix', '打开 {title}', {
        title: card._xTitleText
      }));
    });
    bookmarkCards.forEach((card) => {
      if (!card || !card._xTitleText) {
        return;
      }
      card.setAttribute('aria-label', formatMessage('open_prefix', '打开 {title}', {
        title: card._xTitleText
      }));
    });
    if (latestQuery && latestQuery.trim()) {
      renderSuggestions(lastSuggestionResponse, latestQuery);
    }
  }


  function applyLanguageMode(mode) {
    currentLanguageMode = mode || 'system';
    const targetLocale = currentLanguageMode === 'system' ? getSystemLocale() : normalizeLocale(currentLanguageMode);
    currentResolvedLocale = targetLocale;
    applyDocumentLanguage(targetLocale);
    const finalizeLanguageInit = () => {
      if (initialLanguageApplied) {
        return;
      }
      initialLanguageApplied = true;
      if (typeof resolveInitialLanguageReady === 'function') {
        resolveInitialLanguageReady();
      }
    };
    if (storageArea) {
      storageArea.get([LANGUAGE_MESSAGES_STORAGE_KEY], (result) => {
        const payload = result[LANGUAGE_MESSAGES_STORAGE_KEY];
        if (payload && payload.locale === targetLocale && payload.messages) {
          currentMessages = payload.messages || {};
          applyLanguageStrings();
          forceReloadRecentSitesForI18n();
          finalizeLanguageInit();
          return;
        }
        loadLocaleMessages(targetLocale).then((messages) => {
          currentMessages = messages || {};
          applyLanguageStrings();
          forceReloadRecentSitesForI18n();
          finalizeLanguageInit();
        });
      });
      return;
    }
    loadLocaleMessages(targetLocale).then((messages) => {
      currentMessages = messages || {};
      applyLanguageStrings();
      forceReloadRecentSitesForI18n();
      finalizeLanguageInit();
    });
  }

  function refreshShortcutTileThemes() {
    shortcutTiles.forEach((tile) => {
      if (!tile) {
        return;
      }
      applyShortcutTileTheme(tile, tile._xTheme, tile._xHost || '');
    });
  }

  function applyThemeMode(mode, options) {
    const previousThemeMode = currentThemeMode;
    currentThemeMode = normalizeThemeMode(mode);
    const mediaMatchesOverride = options && typeof options.mediaMatches === 'boolean'
      ? options.mediaMatches
      : null;
    const previousResolved = document.body ? document.body.getAttribute('data-theme') : '';
    const resolved = resolveTheme(mode, mediaMatchesOverride);
    document.body.setAttribute('data-theme', resolved);
    if (document.documentElement) {
      document.documentElement.removeAttribute('data-wallpaper-preload-theme');
    }
    applyWordmarkThemeAppearance(resolved);
    const didResolvedThemeChange = previousResolved !== resolved;
    suggestionItems.forEach((item) => {
      if (item && item._xTheme) {
        applyThemeVariables(item, item._xTheme);
      }
    });
    recentCards.forEach((card) => {
      if (!card) {
        return;
      }
      applyRecentCardTheme(card, card._xTheme, card._xHost || '');
    });
    bookmarkCards.forEach((card) => {
      if (!card) {
        return;
      }
      // 文件夹卡片通常没有 host/theme，也需要在主题切换时重算阴影与变量。
      applyBookmarkCardTheme(card, card._xTheme, card._xHost || '');
    });
    refreshShortcutTileThemes();
    applyLanguageStrings();
    updateSelection();
    updateModeBadge(inputParts && inputParts.input ? inputParts.input.value : '');
    refreshFallbackIcons();
    if (didResolvedThemeChange) {
      refreshThemeAwareFavicons();
      scheduleThemeAwareFaviconRescue();
    }
    if ((didResolvedThemeChange || previousThemeMode !== currentThemeMode) &&
        wallpaperRuntime && typeof wallpaperRuntime.handleThemeModeChange === 'function') {
      wallpaperRuntime.handleThemeModeChange();
    }
    if (!initialThemeApplied) {
      initialThemeApplied = true;
      if (typeof resolveInitialThemeReady === 'function') {
        resolveInitialThemeReady();
      }
    }
    if (mode === 'system' && !mediaListenerAttached) {
      mediaListenerAttached = addMediaQueryChangeListener(mediaQuery, handleMediaChange);
    }
    if (mode !== 'system' && mediaListenerAttached) {
      removeMediaQueryChangeListener(mediaQuery, handleMediaChange);
      mediaListenerAttached = false;
    }
    scheduleWallpaperAdaptiveToneUpdate();
  }

  function normalizeThemeMode(value) {
    if (value === 'light' || value === 'dark') {
      return value;
    }
    return 'system';
  }

  function normalizeNewtabThemeMode(value) {
    if (value === 'light' || value === 'dark') {
      return value;
    }
    return 'global';
  }

  function normalizeNewtabThemeScope(value) {
    return value === 'home' ? 'home' : 'global';
  }

  function isNewtabThemeFollowingGlobal() {
    return newtabThemeMode === 'global';
  }

  function getScopedThemeMode() {
    return isNewtabThemeFollowingGlobal() ? globalThemeMode : newtabThemeMode;
  }

  function getSelectedThemeMode() {
    if (newtabThemeScope !== 'home') {
      return globalThemeMode;
    }
    return isNewtabThemeFollowingGlobal() ? 'system' : newtabThemeMode;
  }

  function applyScopedThemeMode(options) {
    applyThemeMode(getScopedThemeMode(), options);
  }

  function bootstrapInitialThemeMode() {
    if (hasThemeBootstrapStarted) {
      return initialThemeReadyPromise;
    }
    hasThemeBootstrapStarted = true;
    if (!storageArea) {
      globalThemeMode = 'system';
      newtabThemeMode = 'global';
      newtabThemeScope = 'global';
      applyScopedThemeMode();
      return initialThemeReadyPromise;
    }
    storageArea.get([
      THEME_STORAGE_KEY,
      NEWTAB_THEME_MODE_STORAGE_KEY,
      NEWTAB_THEME_SCOPE_STORAGE_KEY
    ], (result) => {
      globalThemeMode = normalizeThemeMode(result ? result[THEME_STORAGE_KEY] : 'system');
      newtabThemeMode = normalizeNewtabThemeMode(result ? result[NEWTAB_THEME_MODE_STORAGE_KEY] : 'global');
      newtabThemeScope = normalizeNewtabThemeScope(result ? result[NEWTAB_THEME_SCOPE_STORAGE_KEY] : 'global');
      applyScopedThemeMode();
    });
    return initialThemeReadyPromise;
  }

  function bootstrapInitialLanguageMode() {
    if (hasLanguageBootstrapStarted) {
      return initialLanguageReadyPromise;
    }
    hasLanguageBootstrapStarted = true;
    if (!storageArea) {
      applyLanguageMode('system');
      return initialLanguageReadyPromise;
    }
    storageArea.get([LANGUAGE_STORAGE_KEY], (result) => {
      applyLanguageMode(result[LANGUAGE_STORAGE_KEY] || 'system');
    });
    return initialLanguageReadyPromise;
  }

  function handleMediaChange(event) {
    if (currentThemeMode !== 'system') {
      return;
    }
    // 仅更新 data-theme 会遗漏依赖 JS 混色的卡片；系统主题切换时需完整重算。
    const mediaMatches = event && typeof event.matches === 'boolean'
      ? event.matches
      : mediaQuery.matches;
    applyThemeMode('system', { mediaMatches });
  }

  function syncSystemThemeMode() {
    if (currentThemeMode !== 'system') {
      return;
    }
    const resolved = resolveTheme('system');
    if (!document.body || document.body.getAttribute('data-theme') === resolved) {
      return;
    }
    applyThemeMode('system', { mediaMatches: mediaQuery.matches });
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

  bootstrapInitialThemeMode();
  bootstrapInitialWallpaper();
  bootstrapInitialWallpaperOverlay();
  bootstrapInitialWallpaperEffect();
  bootstrapInitialNewtabFavicon();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    const isPrimaryArea = Boolean(storageAreaName) && areaName === storageAreaName;
    if (!isPrimaryArea) {
      if (recentSitesStorageAreaName &&
          areaName === recentSitesStorageAreaName &&
          changes[PINNED_RECENT_SITES_STORAGE_KEY]) {
        pinnedRecentSites = normalizePinnedRecentSites(changes[PINNED_RECENT_SITES_STORAGE_KEY].newValue);
        recentRenderSignature = '';
        renderRecentSites(recentSourceItems);
      }
      if (recentSitesStorageAreaName &&
          areaName === recentSitesStorageAreaName &&
          changes[HIDDEN_RECENT_SITES_STORAGE_KEY]) {
        hiddenRecentSites = normalizeHiddenRecentSites(changes[HIDDEN_RECENT_SITES_STORAGE_KEY].newValue);
        recentRenderSignature = '';
        renderRecentSites(recentSourceItems);
      }
      if (areaName === 'local' &&
          changes[NEWTAB_LOCAL_WALLPAPER_STORAGE_KEY] &&
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
    if (changes[NEWTAB_WORDMARK_VISIBLE_STORAGE_KEY]) {
      const raw = changes[NEWTAB_WORDMARK_VISIBLE_STORAGE_KEY].newValue;
      const nextValue = normalizeNewtabWordmarkVisible(raw);
      newtabWordmarkVisible = nextValue;
      if (storageArea && raw !== nextValue) {
        storageArea.set({ [NEWTAB_WORDMARK_VISIBLE_STORAGE_KEY]: nextValue });
      }
      applyNewtabWordmarkVisibility();
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
      if (storageArea && rawMode !== nextMode) {
        storageArea.set({ [BOOKMARK_VIEW_MODE_STORAGE_KEY]: nextMode });
      }
      if (currentBookmarkViewMode === nextMode) {
        updateBookmarkModeMenu();
      } else {
        closeBookmarkCascadeMenu();
        currentBookmarkViewMode = nextMode;
        bookmarkCurrentPage = 0;
        bookmarkRenderSignature = '';
        updateBookmarkModeMenu();
        markBookmarkDataDirty();
        loadBookmarks({ force: true });
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
    if (changes[LANGUAGE_MESSAGES_STORAGE_KEY]) {
      const payload = changes[LANGUAGE_MESSAGES_STORAGE_KEY].newValue;
      const targetLocale = currentLanguageMode === 'system' ? getSystemLocale() : normalizeLocale(currentLanguageMode);
      if (payload && payload.locale === targetLocale && payload.messages) {
        currentMessages = payload.messages || {};
        applyLanguageStrings();
        forceReloadRecentSitesForI18n();
      }
    }
    if (changes[PINNED_RECENT_SITES_STORAGE_KEY]) {
      pinnedRecentSites = normalizePinnedRecentSites(changes[PINNED_RECENT_SITES_STORAGE_KEY].newValue);
      recentRenderSignature = '';
      renderRecentSites(recentSourceItems);
    }
    if (changes[HIDDEN_RECENT_SITES_STORAGE_KEY]) {
      hiddenRecentSites = normalizeHiddenRecentSites(changes[HIDDEN_RECENT_SITES_STORAGE_KEY].newValue);
      recentRenderSignature = '';
      renderRecentSites(recentSourceItems);
    }
    if (changes[NEWTAB_SHORTCUTS_STORAGE_KEY]) {
      newtabShortcuts = NEWTAB_SHORTCUTS_STORE.normalizeShortcuts(
        changes[NEWTAB_SHORTCUTS_STORAGE_KEY].newValue,
        getShortcutStoreOptions()
      );
      renderShortcuts();
    }
  });

  if (chrome && chrome.runtime && chrome.runtime.onMessage && typeof chrome.runtime.onMessage.addListener === 'function') {
    chrome.runtime.onMessage.addListener((message) => {
      if (!message || message.action !== 'lumno:newtab-refresh-sections') {
        return;
      }
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
    readPinnedRecentSites().then((items) => {
      pinnedRecentSites = items;
      if (recentSourceItems.length > 0) {
        recentRenderSignature = '';
        renderRecentSites(recentSourceItems);
      }
    });
    readHiddenRecentSites().then((items) => {
      hiddenRecentSites = items;
      if (recentSourceItems.length > 0) {
        recentRenderSignature = '';
        renderRecentSites(recentSourceItems);
      }
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
    storageArea.get([NEWTAB_WORDMARK_VISIBLE_STORAGE_KEY], (result) => {
      const raw = result[NEWTAB_WORDMARK_VISIBLE_STORAGE_KEY];
      const nextValue = normalizeNewtabWordmarkVisible(raw);
      newtabWordmarkVisible = nextValue;
      if (raw !== nextValue) {
        storageArea.set({ [NEWTAB_WORDMARK_VISIBLE_STORAGE_KEY]: nextValue });
      }
      applyNewtabWordmarkVisibility();
      if (wallpaperRuntime && typeof wallpaperRuntime.updateWordmarkVisibilityUi === 'function') {
        wallpaperRuntime.updateWordmarkVisibilityUi();
      }
    });
    storageArea.get([NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY], (result) => {
      const raw = result[NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY];
      const nextValue = normalizeNewtabShortcutsVisible(raw);
      newtabShortcutsVisible = nextValue;
      if (raw !== nextValue) {
        storageArea.set({ [NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY]: nextValue });
      }
      applyNewtabShortcutsVisibility();
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
    storageArea.get([BOOKMARK_VIEW_MODE_STORAGE_KEY], (result) => {
      const stored = result[BOOKMARK_VIEW_MODE_STORAGE_KEY];
      const mode = normalizeBookmarkViewMode(stored);
      const changed = currentBookmarkViewMode !== mode;
      currentBookmarkViewMode = mode;
      updateBookmarkModeMenu();
      if (stored !== mode) {
        storageArea.set({ [BOOKMARK_VIEW_MODE_STORAGE_KEY]: mode });
      }
      if (changed || !bookmarkLoadedOnce) {
        bookmarkCurrentPage = 0;
        bookmarkRenderSignature = '';
        markBookmarkDataDirty();
        loadBookmarks();
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
    }
  ];

  function getCommandMatch(rawInput) {
    const input = String(rawInput || '').trim().toLowerCase();
    if (!input.startsWith('/')) {
      return null;
    }
    for (let i = 0; i < commandDefinitions.length; i += 1) {
      const command = commandDefinitions[i];
      const tokens = [command.primary].concat(command.aliases || []);
      for (let j = 0; j < tokens.length; j += 1) {
        const token = tokens[j];
        if (token.startsWith(input) || input.startsWith(token)) {
          return {
            command: command,
            completion: command.primary
          };
        }
      }
    }
    return null;
  }

  function buildCommandSuggestion(command) {
    let titleText = '';
    if (command.type === 'commandSettings') {
      titleText = formatMessage('command_settings', '打开 Lumno 设置', {
        name: 'Lumno'
      });
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
    const zenCommandActive = isZenCommand(rawValue || '');
    const shouldShow = isModeCommand(rawValue || '') || zenCommandActive;
    if (!shouldShow) {
      modeBadge.setAttribute('data-visible', 'false');
      updateInputRightPadding();
      return;
    }
    modeBadge.textContent = zenCommandActive
      ? t(
        zenModeEnabled ? 'zen_badge_on' : 'zen_badge_off',
        zenModeEnabled ? 'Zen：已开启' : 'Zen：已关闭'
      )
      : formatMessage('mode_badge', '模式：{mode}', {
        mode: getThemeModeLabel(currentThemeMode)
      });
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

  function isZenCommand(input) {
    const raw = String(input || '').trim().toLowerCase();
    return raw === '/zen' || raw.startsWith('/zen ');
  }

  function isSlashCommandInput(input) {
    const raw = String(input || '').trim();
    return raw.startsWith('/');
  }

  function buildModeSuggestion() {
    const nextMode = getNextThemeMode(currentThemeMode);
    return {
      type: 'modeSwitch',
      title: formatMessage('mode_switch_title', `Lumno：切换到${getThemeModeLabel(nextMode)}模式`, {
        name: 'Lumno',
        mode: getThemeModeLabel(nextMode)
      }),
      url: '',
      favicon: chrome.runtime.getURL('assets/images/lumno.png'),
      nextMode: nextMode
    };
  }

  function buildZenSuggestion() {
    return {
      type: 'zenSwitch',
      title: zenModeEnabled
        ? formatMessage('zen_disable_title', '{name}：退出 Zen 模式', { name: 'Lumno' })
        : formatMessage('zen_enable_title', '{name}：进入 Zen 模式', { name: 'Lumno' }),
      url: '',
      favicon: chrome.runtime.getURL('assets/images/lumno.png'),
      nextEnabled: !zenModeEnabled
    };
  }

  function updateModeCommandSuggestions() {
    if (isModeCommand(inputParts && inputParts.input ? inputParts.input.value : '')) {
      renderSuggestions([], (inputParts.input.value || '').trim());
    }
  }

  function updateZenCommandSuggestions() {
    if (isZenCommand(inputParts && inputParts.input ? inputParts.input.value : '')) {
      renderSuggestions([], (inputParts.input.value || '').trim());
    }
  }

  function syncSectionZenVisibility(section) {
    if (!section) {
      return;
    }
    let configuredVisible = section.getAttribute('data-content-visible');
    if (configuredVisible !== 'true' && configuredVisible !== 'false') {
      configuredVisible = section.getAttribute('data-visible') === 'true' ? 'true' : 'false';
      section.setAttribute('data-content-visible', configuredVisible);
    }
    section.setAttribute(
      'data-visible',
      configuredVisible === 'true' && !zenModeEnabled ? 'true' : 'false'
    );
  }

  function applyZenMode() {
    if (document.body) {
      document.body.setAttribute('data-zen-mode', zenModeEnabled ? 'true' : 'false');
    }
    applyNewtabWordmarkVisibility();
    applyNewtabShortcutsVisibility();
    syncSectionZenVisibility(bookmarkSection);
    syncSectionZenVisibility(recentSection);
    if (zenModeEnabled) {
      closeBookmarkCascadeMenu();
      closeShortcutContextMenu();
      closeShortcutDialog();
      closeWallpaperPanel();
      closeFeedbackPopover();
      hideTopActionTooltip();
      hideShortcutTooltip();
      hideCursorTooltip();
    }
    updateBookmarkSectionPosition();
    updateSearchEntryLayout();
    scheduleWallpaperAdaptiveToneUpdate();
    updateModeBadge(inputParts && inputParts.input ? inputParts.input.value : '');
  }

  function setZenModeEnabled(enabled) {
    const nextEnabled = normalizeZenModeEnabled(enabled);
    zenModeEnabled = nextEnabled;
    if (!storageArea) {
      applyZenMode();
      updateZenCommandSuggestions();
      return;
    }
    storageArea.set({ [NEWTAB_ZEN_MODE_STORAGE_KEY]: nextEnabled }, () => {
      applyZenMode();
      updateZenCommandSuggestions();
    });
  }

  function loadZenMode() {
    if (!storageArea) {
      zenModeEnabled = false;
      applyZenMode();
      return Promise.resolve(zenModeEnabled);
    }
    return new Promise((resolve) => {
      storageArea.get([NEWTAB_ZEN_MODE_STORAGE_KEY], (result) => {
        zenModeEnabled = normalizeZenModeEnabled(result && result[NEWTAB_ZEN_MODE_STORAGE_KEY]);
        applyZenMode();
        resolve(zenModeEnabled);
      });
    });
  }

  function getThemeScope() {
    return newtabThemeScope;
  }

  function getGlobalThemeStorageUpdate(mode) {
    if (SETTINGS && typeof SETTINGS.createGlobalThemeModeStorageUpdate === 'function') {
      return SETTINGS.createGlobalThemeModeStorageUpdate(mode);
    }
    const nextMode = normalizeThemeMode(mode);
    return {
      [THEME_STORAGE_KEY]: nextMode
    };
  }

  function setGlobalThemeMode(mode) {
    const updates = getGlobalThemeStorageUpdate(mode);
    globalThemeMode = updates[THEME_STORAGE_KEY];
    if (!storageArea) {
      applyScopedThemeMode();
      updateWallpaperLanguageStrings();
      updateModeCommandSuggestions();
      return;
    }
    storageArea.set(updates, () => {
      applyScopedThemeMode();
      updateWallpaperLanguageStrings();
      updateModeCommandSuggestions();
    });
  }

  function setThemeMode(mode) {
    const nextMode = normalizeThemeMode(mode);
    const isEditingNewtabTheme = newtabThemeScope === 'home';
    const targetKey = isEditingNewtabTheme
      ? NEWTAB_THEME_MODE_STORAGE_KEY
      : THEME_STORAGE_KEY;
    const nextStoredMode = isEditingNewtabTheme && nextMode === 'system'
      ? 'global'
      : nextMode;
    if (!isEditingNewtabTheme) {
      setGlobalThemeMode(nextMode);
      return;
    }
    newtabThemeMode = normalizeNewtabThemeMode(nextStoredMode);
    if (!storageArea) {
      applyScopedThemeMode();
      updateWallpaperLanguageStrings();
      updateModeCommandSuggestions();
      return;
    }
    storageArea.set({ [targetKey]: nextStoredMode }, () => {
      applyScopedThemeMode();
      updateWallpaperLanguageStrings();
      updateModeCommandSuggestions();
    });
  }

  function setVisibleThemeMode(mode) {
    const nextMode = normalizeThemeMode(mode);
    if (isNewtabThemeFollowingGlobal()) {
      setGlobalThemeMode(nextMode);
      return;
    }
    const nextStoredMode = nextMode === 'system' ? 'global' : nextMode;
    newtabThemeMode = normalizeNewtabThemeMode(nextStoredMode);
    if (!storageArea) {
      applyScopedThemeMode();
      updateWallpaperLanguageStrings();
      updateModeCommandSuggestions();
      return;
    }
    storageArea.set({ [NEWTAB_THEME_MODE_STORAGE_KEY]: nextStoredMode }, () => {
      applyScopedThemeMode();
      updateWallpaperLanguageStrings();
      updateModeCommandSuggestions();
    });
  }

  function setThemeScope(scope) {
    const nextScope = normalizeNewtabThemeScope(scope);
    const updates = { [NEWTAB_THEME_SCOPE_STORAGE_KEY]: nextScope };
    newtabThemeScope = nextScope;
    if (!storageArea) {
      updateWallpaperLanguageStrings();
      updateModeCommandSuggestions();
      return;
    }
    storageArea.set(updates, () => {
      updateWallpaperLanguageStrings();
      updateModeCommandSuggestions();
    });
  }

  let latestQuery = '';
  let latestRawQuery = '';
  let lastDeletionAt = 0;
  let fallbackShortcutRaw = '';
  let fallbackShortcutSpec = null;
  let fallbackShortcutRefreshAt = 0;
  let autocompleteState = null;
  let inlineSearchState = null;
  const imeKeyGuard = LumnoImeKeyGuard.createImeKeyGuard();
  function isImeCompositionEvent(event) {
    return imeKeyGuard.shouldIgnoreKeydown(event);
  }
  let siteSearchState = null;
  let remoteSuggestionDebounceTimer = null;
  let tabs = [];
  let currentNewtabTabId = null;
  let siteSearchProvidersCache = null;
  let pendingProviderReload = false;
  let suggestionRequestSeq = 0;
  let suggestionRequestWatchdogTimer = null;
  let searchResultPriorityMode = 'autocomplete';
  let openTabQuickSwitchEnabled = true;
  let searchInputRef = null;
  let faviconRequestBlacklistItems = [];
  loadDefaultSearchEngineState();
  if (chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (!storageAreaName || areaName !== storageAreaName) {
        return;
      }
      if (changes[DEFAULT_SEARCH_ENGINE_STORAGE_KEY]) {
        const nextValue = changes[DEFAULT_SEARCH_ENGINE_STORAGE_KEY].newValue;
        if (nextValue && nextValue.id) {
          defaultSearchEngineState = nextValue;
        }
      }
      if (changes[SEARCH_RESULT_PRIORITY_STORAGE_KEY]) {
        searchResultPriorityMode = normalizeSearchResultPriority(changes[SEARCH_RESULT_PRIORITY_STORAGE_KEY].newValue);
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
      if (latestQuery && latestQuery.trim() && (
        changes[DEFAULT_SEARCH_ENGINE_STORAGE_KEY] ||
        changes[SEARCH_RESULT_PRIORITY_STORAGE_KEY] ||
        changes[SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY] ||
        changes[SEARCH_BLACKLIST_STORAGE_KEY] ||
        changes[FAVICON_REQUEST_BLACKLIST_STORAGE_KEY]
      )) {
        requestSuggestions(latestQuery, { immediate: true });
      }
    });
  }
  const SITE_SEARCH_STORAGE_KEY = '_x_extension_site_search_custom_2024_unique_';
  const SITE_SEARCH_DISABLED_STORAGE_KEY = '_x_extension_site_search_disabled_2024_unique_';
  migrateStorageIfNeeded([
    THEME_STORAGE_KEY,
    LANGUAGE_STORAGE_KEY,
    LANGUAGE_MESSAGES_STORAGE_KEY,
    RECENT_MODE_STORAGE_KEY,
    RECENT_COUNT_STORAGE_KEY,
    NEWTAB_WIDTH_MODE_STORAGE_KEY,
    NEWTAB_SEARCH_WIDTH_STORAGE_KEY,
    NEWTAB_WORDMARK_VISIBLE_STORAGE_KEY,
    NEWTAB_THEME_MODE_STORAGE_KEY,
    NEWTAB_THEME_SCOPE_STORAGE_KEY,
    NEWTAB_WALLPAPER_STORAGE_KEY,
    NEWTAB_WALLPAPER_OVERLAY_STORAGE_KEY,
    NEWTAB_WALLPAPER_EFFECT_STORAGE_KEY,
    BOOKMARK_COUNT_STORAGE_KEY,
    BOOKMARK_COLUMNS_STORAGE_KEY,
    BOOKMARK_VIEW_MODE_STORAGE_KEY,
    BOOKMARK_CASCADE_DEBUG_STORAGE_KEY,
    TAB_RANK_SCORE_DEBUG_STORAGE_KEY,
    DEFAULT_SEARCH_ENGINE_STORAGE_KEY,
    SEARCH_RESULT_PRIORITY_STORAGE_KEY,
    SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY,
    SITE_SEARCH_STORAGE_KEY,
    SITE_SEARCH_DISABLED_STORAGE_KEY,
    SEARCH_BLACKLIST_STORAGE_KEY,
    FAVICON_REQUEST_BLACKLIST_STORAGE_KEY,
    PINNED_RECENT_SITES_STORAGE_KEY,
    HIDDEN_RECENT_SITES_STORAGE_KEY,
    NEWTAB_SHORTCUTS_STORAGE_KEY,
    NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY
  ]);
  let handleTabKey = null;
  const defaultSiteSearchProviders = typeof SEARCH_UTILS.getDefaultSiteSearchProviders === 'function'
    ? SEARCH_UTILS.getDefaultSiteSearchProviders()
    : [];
  const defaultAccentColor = NEWTAB_FAVICON_THEME.defaultAccentColor;
  const mixColor = NEWTAB_FAVICON_THEME.mixColor;
  const stableHashCode = NEWTAB_FAVICON_THEME.stableHashCode;
  const rgbToCss = NEWTAB_FAVICON_THEME.rgbToCss;
  const rgbToCssAlpha = NEWTAB_FAVICON_THEME.rgbToCssAlpha;
  const rgbToCssParts = NEWTAB_FAVICON_THEME.rgbToCssParts;
  const parseCssColor = NEWTAB_FAVICON_THEME.parseCssColor;
  const getReadableTextColor = typeof NEWTAB_FAVICON_THEME.getReadableTextColor === 'function'
    ? NEWTAB_FAVICON_THEME.getReadableTextColor
    : (() => '#111827');
  const buildTheme = NEWTAB_FAVICON_THEME.buildTheme;
  const getBrandAccentForHost = NEWTAB_FAVICON_THEME.getBrandAccentForHost;
  const getBrandAccentForUrl = NEWTAB_FAVICON_THEME.getBrandAccentForUrl;
  const buildFallbackThemeForHost = NEWTAB_FAVICON_THEME.buildFallbackThemeForHost;
  const getThemeFingerprint = typeof NEWTAB_FAVICON_THEME.getThemeFingerprint === 'function'
    ? NEWTAB_FAVICON_THEME.getThemeFingerprint
    : ((theme) => {
      const rgb = theme && (theme.accentRgb || parseCssColor(theme.accent));
      const accent = rgb && rgb.length === 3 ? rgb : defaultAccentColor;
      return `${theme && theme._xThemeSource ? theme._xThemeSource : 'unknown'}:${accent.join(',')}`;
    });
  const normalizeFaviconHost = FAVICON_UTILS.normalizeFaviconHost || NEWTAB_FAVICON_THEME.normalizeFaviconHost;
  const hasThemeTokenInUrl = FAVICON_UTILS.hasThemeTokenInUrl || NEWTAB_FAVICON_THEME.hasThemeTokenInUrl;
  const shouldSkipThemeUpgradeCandidate = FAVICON_UTILS.shouldSkipThemeUpgradeCandidate || NEWTAB_FAVICON_THEME.shouldSkipThemeUpgradeCandidate;
  const getKnownThemedFaviconCandidates = typeof FAVICON_UTILS.getKnownThemedFaviconCandidateUrls === 'function'
    ? ((hostname, preferredTheme) => FAVICON_UTILS.getKnownThemedFaviconCandidateUrls(hostname, preferredTheme, {
      getRuntimeUrl: (path) => chrome.runtime.getURL(path)
    }))
    : NEWTAB_FAVICON_THEME.getKnownThemedFaviconCandidates;
  const getRootFaviconCandidates = typeof FAVICON_UTILS.getRootFaviconCandidateUrls === 'function'
    ? FAVICON_UTILS.getRootFaviconCandidateUrls
    : (() => []);
  const hostHasExplicitDarkFavicon = FAVICON_UTILS.hostHasExplicitDarkFavicon || NEWTAB_FAVICON_THEME.hostHasExplicitDarkFavicon;
  const isFaviconProxyUrl = FAVICON_UTILS.isFaviconProxyUrl || NEWTAB_FAVICON_THEME.isFaviconProxyUrl;
  const extractAverageColor = NEWTAB_FAVICON_THEME.extractAverageColor;
  const defaultTheme = NEWTAB_FAVICON_THEME.createDefaultTheme();
  const urlHighlightTheme = NEWTAB_FAVICON_THEME.createUrlHighlightTheme();
  const themeColorCache = window._x_extension_theme_color_cache_2024_unique_ || new Map();
  window._x_extension_theme_color_cache_2024_unique_ = themeColorCache;
  const themeHostCache = window._x_extension_theme_host_cache_2024_unique_ || new Map();
  window._x_extension_theme_host_cache_2024_unique_ = themeHostCache;
  const siteThemeRequestPending = new Map();
  const themeFaviconCandidateRequestPending = new Map();

  function getHighlightColors(theme) {
    const resolvedTheme = getThemeForMode(theme);
    if (!resolvedTheme || !resolvedTheme._xIsBrand) {
      return {
        bg: 'var(--x-nt-hover-bg, #F3F4F6)',
        border: 'transparent'
      };
    }
    return {
      bg: resolvedTheme.highlightBg,
      border: resolvedTheme.highlightBorder
    };
  }

  function getHostFromUrl(url) {
    if (!url) {
      return '';
    }
    try {
      return normalizeHost(new URL(getCanonicalPageUrlForFavicon(url) || url).hostname);
    } catch (e) {
      return '';
    }
  }

  function getCanonicalPageUrlForFavicon(url) {
    return typeof FAVICON_UTILS.getCanonicalPageUrlForFavicon === 'function'
      ? FAVICON_UTILS.getCanonicalPageUrlForFavicon(url)
      : String(url || '');
  }

  function normalizeAccentRgb(value) {
    if (!Array.isArray(value) || value.length !== 3) {
      return null;
    }
    const rgb = value.map((channel) => Math.round(Number(channel)));
    return rgb.every((channel) => Number.isFinite(channel) && channel >= 0 && channel <= 255)
      ? rgb
      : null;
  }

  function isNeutralThemeAccent(value) {
    const rgb = normalizeAccentRgb(value);
    if (!rgb) {
      return false;
    }
    if (typeof FAVICON_UTILS.isNeutralThemeColor === 'function') {
      return FAVICON_UTILS.isNeutralThemeColor(rgb);
    }
    const max = Math.max(...rgb);
    const min = Math.min(...rgb);
    const range = max - min;
    const saturation = max === 0 ? 0 : range / max;
    return range <= 24 ||
      saturation <= 0.12 ||
      (min >= 235 && max >= 245) ||
      (max <= 36 && min <= 24);
  }

  function normalizeThemeConfidence(value, accentRgb) {
    const confidence = String(value || '').trim().toLowerCase();
    if (confidence === 'color' || confidence === 'neutral') {
      return confidence;
    }
    return isNeutralThemeAccent(accentRgb) ? 'neutral' : 'color';
  }

  function normalizeThemeSource(source) {
    const value = String(source || '').trim().toLowerCase();
    if (
      value === 'brand' ||
      value === 'mask-icon' ||
      value === 'meta' ||
      value === 'manifest' ||
      value === 'favicon' ||
      value === 'url'
    ) {
      return value;
    }
    return 'fallback';
  }

  function getThemeSourcePriority(source, theme) {
    const value = normalizeThemeSource(source);
    if (value === 'brand') {
      return 40;
    }
    if (value === 'mask-icon') {
      return 38;
    }
    if (value === 'meta') {
      return theme && isLowConfidenceTheme(theme) ? 20 : 34;
    }
    if (value === 'manifest') {
      return theme && isLowConfidenceTheme(theme) ? 18 : 32;
    }
    if (value === 'favicon') {
      return 24;
    }
    if (value === 'url') {
      return 18;
    }
    return 10;
  }

  function getThemeSource(theme) {
    if (!theme) {
      return 'fallback';
    }
    return normalizeThemeSource(theme._xThemeSource || (theme._xIsDefault ? 'fallback' : (theme._xIsBrand ? 'brand' : 'fallback')));
  }

  function getThemeColorFingerprint(theme) {
    const rgb = theme && normalizeAccentRgb(theme.accentRgb || parseCssColor(theme.accent));
    return (rgb || defaultAccentColor).join(',');
  }

  function buildThemeFromAccent(accentRgb, source) {
    const rgb = normalizeAccentRgb(accentRgb);
    if (!rgb) {
      return defaultTheme;
    }
    const theme = buildTheme(rgb);
    const normalizedSource = normalizeThemeSource(source);
    const confidence = normalizeThemeConfidence(null, rgb);
    theme._xThemeSource = normalizedSource;
    theme._xIsBrand = normalizedSource !== 'fallback';
    theme._xIsDefault = normalizedSource === 'fallback';
    theme._xThemeNeutral = confidence === 'neutral';
    theme._xThemeConfidence = confidence;
    return theme;
  }

  function buildThemeFromThemeResult(result, fallbackSource) {
    const accentRgb = result && normalizeAccentRgb(result.accentRgb);
    if (!accentRgb) {
      return null;
    }
    const source = normalizeThemeSource((result && result.source) || fallbackSource || 'meta');
    const confidence = normalizeThemeConfidence(result && result.confidence, accentRgb);
    const theme = buildThemeFromAccent(accentRgb, source);
    theme._xThemeNeutral = typeof (result && result.neutral) === 'boolean'
      ? result.neutral
      : confidence === 'neutral';
    theme._xThemeConfidence = confidence;
    return theme;
  }

  function isLowConfidenceTheme(theme) {
    if (!theme) {
      return false;
    }
    const source = getThemeSource(theme);
    if (source !== 'meta' && source !== 'manifest') {
      return false;
    }
    const accentRgb = normalizeAccentRgb(theme.accentRgb || parseCssColor(theme.accent));
    const confidence = normalizeThemeConfidence(theme._xThemeConfidence, accentRgb);
    return theme._xThemeNeutral === true || confidence === 'neutral';
  }

  function isPersistableTheme(theme) {
    const source = getThemeSource(theme);
    return source === 'brand' ||
      source === 'mask-icon' ||
      source === 'meta' ||
      source === 'manifest' ||
      source === 'favicon';
  }

  function getProviderThemeHost(provider) {
    return normalizeHost(getProviderHost(provider));
  }

  function getThemeHostForSuggestion(suggestion) {
    if (!suggestion) {
      return '';
    }
    if (suggestion.provider) {
      return getProviderThemeHost(suggestion.provider);
    }
    if (suggestion.url) {
      return getHostFromUrl(suggestion.url);
    }
    if (suggestion.favicon) {
      return getHostFromUrl(suggestion.favicon);
    }
    return '';
  }

  function getThemePageUrlForSuggestion(suggestion, hostKey) {
    if (suggestion && suggestion.url) {
      try {
        const parsed = new URL(getCanonicalPageUrlForFavicon(suggestion.url) || suggestion.url);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          return parsed.href;
        }
      } catch (e) {
        // Ignore malformed URLs.
      }
    }
    const host = normalizeHost(hostKey || '');
    return host ? `https://${host}/` : '';
  }

  function refreshThemeConsumersForHost(hostKey, theme) {
    const normalizedHost = normalizeHost(hostKey);
    if (!normalizedHost || !theme) {
      return;
    }
    recentCards.forEach((card) => {
      if (card && normalizeHost(card._xHost || '') === normalizedHost) {
        card._xTheme = theme;
        applyRecentCardTheme(card, theme, normalizedHost);
      }
    });
    bookmarkCards.forEach((card) => {
      if (card && normalizeHost(card._xHost || '') === normalizedHost) {
        card._xTheme = theme;
        applyBookmarkCardTheme(card, theme, normalizedHost);
      }
    });
    shortcutTiles.forEach((tile) => {
      if (tile && normalizeHost(tile._xHost || '') === normalizedHost) {
        tile._xTheme = theme;
        applyShortcutTileTheme(tile, theme, normalizedHost);
      }
    });
    suggestionItems.forEach((item) => {
      if (item && normalizeHost(item._xThemeHost || '') === normalizedHost) {
        item._xTheme = theme;
        applyThemeVariables(item, theme);
      }
    });
    if (siteSearchState && getProviderThemeHost(siteSearchState) === normalizedHost) {
      setSiteSearchPrefix(siteSearchState, theme);
    }
    updateSelection();
  }

  function setResolvedThemeForHost(hostKey, theme, options) {
    const normalizedHost = normalizeHost(hostKey);
    const nextTheme = theme || defaultTheme;
    const iconUrl = options && options.iconUrl ? String(options.iconUrl) : '';
    if (iconUrl) {
      themeColorCache.set(iconUrl, nextTheme);
    }
    if (!normalizedHost) {
      return nextTheme;
    }
    const currentTheme = themeHostCache.get(normalizedHost);
    if (
      currentTheme &&
      getThemeSourcePriority(getThemeSource(currentTheme), currentTheme) >
        getThemeSourcePriority(getThemeSource(nextTheme), nextTheme)
    ) {
      if (iconUrl) {
        themeColorCache.set(iconUrl, currentTheme);
      }
      return currentTheme;
    }
    const previousFingerprint = currentTheme ? getThemeFingerprint(currentTheme) : '';
    const nextFingerprint = getThemeFingerprint(nextTheme);
    if (currentTheme && previousFingerprint === nextFingerprint) {
      return currentTheme;
    }
    const shouldRefreshConsumers = !currentTheme ||
      getThemeColorFingerprint(currentTheme) !== getThemeColorFingerprint(nextTheme);
    themeHostCache.set(normalizedHost, nextTheme);
    if (isPersistableTheme(nextTheme) && (!options || options.persist !== false)) {
      setPersistedSiteThemeEntry(normalizedHost, nextTheme);
    }
    if (shouldRefreshConsumers && (!options || options.refresh !== false)) {
      refreshThemeConsumersForHost(normalizedHost, nextTheme);
    }
    return nextTheme;
  }

  function getPersistedThemeForHost(hostKey) {
    const normalizedHost = normalizeHost(hostKey);
    if (!normalizedHost) {
      return null;
    }
    const entry = getPersistedSiteThemeEntry(normalizedHost);
    const accentRgb = entry ? normalizeAccentRgb(entry.accentRgb) : null;
    if (!accentRgb) {
      return null;
    }
    const theme = buildThemeFromThemeResult(entry, entry.source);
    if (!theme) {
      return null;
    }
    if (isLowConfidenceTheme(theme)) {
      return theme;
    }
    return setResolvedThemeForHost(normalizedHost, theme, { persist: false, refresh: false });
  }

  function requestSiteThemeColor(pageUrl, hostKey) {
    const url = String(pageUrl || '').trim();
    const host = normalizeHost(hostKey);
    if (!url || !host || !chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
      return Promise.resolve(null);
    }
    const requestKey = `${host}::${url}::${getFaviconPreferredTheme()}`;
    if (siteThemeRequestPending.has(requestKey)) {
      return siteThemeRequestPending.get(requestKey);
    }
    const promise = new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'resolveSiteThemeColor',
        url,
        host,
        preferredTheme: getFaviconPreferredTheme()
      }, (response) => {
        const accentRgb = response && normalizeAccentRgb(response.accentRgb);
        resolve(accentRgb ? {
          accentRgb,
          source: response.source || 'meta',
          neutral: response.neutral === true,
          confidence: normalizeThemeConfidence(response.confidence, accentRgb)
        } : null);
      });
    }).catch(() => null).then((result) => {
      siteThemeRequestPending.delete(requestKey);
      return result;
    });
    siteThemeRequestPending.set(requestKey, promise);
    return promise;
  }

  function getThemeFaviconCandidateUrls(urls) {
    if (typeof FAVICON_UTILS.getThemeFaviconCandidateUrls === 'function') {
      return FAVICON_UTILS.getThemeFaviconCandidateUrls(urls, { includeProxy: true });
    }
    const seen = new Set();
    const concrete = [];
    const proxy = [];
    (Array.isArray(urls) ? urls : []).forEach((item) => {
      const value = String(item || '').trim();
      if (!value || seen.has(value) || isBlockedLocalFaviconUrl(value) || isChromeMonogramFaviconUrl(value)) {
        return;
      }
      seen.add(value);
      if (isFaviconProxyUrl(value)) {
        proxy.push(value);
      } else {
        concrete.push(value);
      }
    });
    return concrete.concat(proxy);
  }

  function requestThemeFaviconCandidates(pageUrl, hostKey) {
    const url = String(pageUrl || '').trim();
    const host = normalizeHost(hostKey);
    if (!url || !host || !chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
      return Promise.resolve([]);
    }
    const requestKey = `${host}::${url}::${getFaviconPreferredTheme()}`;
    if (themeFaviconCandidateRequestPending.has(requestKey)) {
      return themeFaviconCandidateRequestPending.get(requestKey);
    }
    const promise = new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'resolveFaviconCandidates',
        url,
        host,
        fallbackUrl: '',
        preferredTheme: getFaviconPreferredTheme(),
        excludeChromeFallback: true
      }, (response) => {
        const resolved = response && Array.isArray(response.urls) ? response.urls : [];
        resolve(getThemeFaviconCandidateUrls(resolved));
      });
    }).catch(() => []).then((result) => {
      themeFaviconCandidateRequestPending.delete(requestKey);
      return Array.isArray(result) ? result : [];
    });
    themeFaviconCandidateRequestPending.set(requestKey, promise);
    return promise;
  }

  function getThemeFromUrl(url, hostOverride) {
    if (!url) {
      return Promise.resolve(defaultTheme);
    }
    const hostKey = normalizeHost(hostOverride || getHostFromUrl(url));
    const isProxy = isFaviconProxyUrl(url);
    const useHostCache = hostKey && (!isProxy || Boolean(hostOverride));
    if (useHostCache && themeHostCache.has(hostKey)) {
      const cachedTheme = themeHostCache.get(hostKey);
      if (
        cachedTheme &&
        !cachedTheme._xIsDefault &&
        getThemeSourcePriority(getThemeSource(cachedTheme), cachedTheme) >= getThemeSourcePriority('favicon')
      ) {
        return Promise.resolve(cachedTheme);
      }
    }
    if (themeColorCache.has(url)) {
      const cachedTheme = themeColorCache.get(url);
      if (cachedTheme && !isLowConfidenceTheme(cachedTheme)) {
        return Promise.resolve(cachedTheme);
      }
    }
    const brandAccent = (isProxy && hostOverride) ? null : getBrandAccentForUrl(url);
    if (brandAccent) {
      const brandTheme = buildThemeFromAccent(brandAccent, 'brand');
      themeColorCache.set(url, brandTheme);
      if (useHostCache) {
        setResolvedThemeForHost(hostKey, brandTheme, { iconUrl: url });
      }
      return Promise.resolve(brandTheme);
    }
    const cachedFaviconData = faviconDataCache.get(url);
    if (cachedFaviconData) {
      return loadThemeFromImageSource(url, cachedFaviconData, hostKey, useHostCache);
    }
    return withThemeTimeout(requestFaviconData(url), THEME_ICON_LOAD_TIMEOUT_MS, null).then((dataUrl) => {
      if (dataUrl) {
        return loadThemeFromImageSource(url, dataUrl, hostKey, useHostCache);
      }
      if (isProxy) {
        themeColorCache.set(url, defaultTheme);
        return defaultTheme;
      }
      return loadThemeFromImageSource(url, url, hostKey, useHostCache, { crossOrigin: true });
    });
  }

  function withThemeTimeout(promise, timeoutMs, fallbackValue) {
    return new Promise((resolve) => {
      let settled = false;
      const timer = Number.isFinite(timeoutMs) && timeoutMs > 0
        ? window.setTimeout(() => finish(fallbackValue), timeoutMs)
        : null;
      function finish(value) {
        if (settled) {
          return;
        }
        settled = true;
        if (timer !== null) {
          window.clearTimeout(timer);
        }
        resolve(value);
      }
      Promise.resolve(promise).then(finish).catch(() => finish(fallbackValue));
    });
  }

  function loadThemeFromImageSource(url, imageSource, hostKey, useHostCache, options) {
    return new Promise((resolve) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        themeColorCache.set(url, defaultTheme);
        finish(defaultTheme);
      }, THEME_ICON_LOAD_TIMEOUT_MS);
      function finish(theme) {
        if (settled) {
          return;
        }
        settled = true;
        if (timer !== null) {
          window.clearTimeout(timer);
        }
        resolve(theme || defaultTheme);
      }
      const image = new Image();
      if (options && options.crossOrigin) {
        image.crossOrigin = 'anonymous';
      }
      image.onload = function() {
        const avg = extractAverageColor(image);
        if (!avg) {
          themeColorCache.set(url, defaultTheme);
          finish(defaultTheme);
          return;
        }
        const theme = buildThemeFromAccent(avg, 'favicon');
        themeColorCache.set(url, theme);
        if (useHostCache) {
          setResolvedThemeForHost(hostKey, theme, { iconUrl: url });
        }
        finish(theme);
      };
      image.onerror = function() {
        themeColorCache.set(url, defaultTheme);
        finish(defaultTheme);
      };
      image.src = imageSource;
    });
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
    const brandTheme = buildThemeFromAccent(brandAccent, 'brand');
    setResolvedThemeForHost(normalizedHost, brandTheme, {
      iconUrl,
      refresh: false
    });
    if (iconUrl) {
      themeColorCache.set(iconUrl, brandTheme);
    }
    return brandTheme;
  }

  function getThemeFromResolvedFaviconCandidates(pageUrl, hostKey, iconUrl) {
    return requestThemeFaviconCandidates(pageUrl, hostKey).then((candidateUrls) => {
      const candidates = getThemeFaviconCandidateUrls([
        ...candidateUrls,
        iconUrl
      ]);
      let index = 0;
      const next = () => {
        const candidate = candidates[index];
        index += 1;
        if (!candidate) {
          return Promise.resolve(defaultTheme);
        }
        return getThemeFromUrl(candidate, hostKey).then((theme) => {
          if (theme && !theme._xIsDefault) {
            return theme;
          }
          return next();
        });
      };
      return next();
    });
  }

  function resolveThemeWithFaviconFallback(hostKey, iconUrl, persistedTheme, siteTheme, pageUrl) {
    const siteThemeValue = siteTheme ? buildThemeFromThemeResult(siteTheme, siteTheme.source || 'meta') : null;
    if (siteThemeValue && !isLowConfidenceTheme(siteThemeValue)) {
      return Promise.resolve(setResolvedThemeForHost(hostKey, siteThemeValue, { iconUrl }));
    }
    return getThemeFromUrl(iconUrl, hostKey).then((theme) => {
      if (theme && !theme._xIsDefault) {
        return theme;
      }
      return getThemeFromResolvedFaviconCandidates(pageUrl, hostKey, iconUrl).then((candidateTheme) => {
        if (candidateTheme && !candidateTheme._xIsDefault) {
          return candidateTheme;
        }
        if (siteThemeValue) {
          return setResolvedThemeForHost(hostKey, siteThemeValue, { iconUrl });
        }
        if (persistedTheme) {
          return setResolvedThemeForHost(hostKey, persistedTheme, {
            iconUrl,
            persist: false
          });
        }
        return defaultTheme;
      });
    });
  }

  function getThemeForProvider(provider) {
    const hostKey = getProviderThemeHost(provider);
    const iconUrl = getProviderIcon(provider);
    if (hostKey && themeHostCache.has(hostKey)) {
      const cachedTheme = themeHostCache.get(hostKey);
      if (cachedTheme && !isLowConfidenceTheme(cachedTheme)) {
        return Promise.resolve(cachedTheme);
      }
    }
    if (iconUrl && themeColorCache.has(iconUrl)) {
      const cachedIconTheme = themeColorCache.get(iconUrl);
      if (cachedIconTheme && !isLowConfidenceTheme(cachedIconTheme)) {
        return Promise.resolve(cachedIconTheme);
      }
    }
    const brandTheme = buildAndCacheBrandThemeForHost(hostKey, iconUrl);
    if (brandTheme) {
      return Promise.resolve(brandTheme);
    }
    const persistedTheme = getPersistedThemeForHost(hostKey);
    if (persistedTheme && !isHostFaviconVisitDirty(hostKey) && !isLowConfidenceTheme(persistedTheme)) {
      return Promise.resolve(persistedTheme);
    }
    const pageUrl = getThemePageUrlForSuggestion({ provider }, hostKey);
    return requestSiteThemeColor(pageUrl, hostKey).then((siteTheme) => {
      return resolveThemeWithFaviconFallback(hostKey, iconUrl, persistedTheme, siteTheme, pageUrl);
    });
  }

  function shouldUseBrandTheme(suggestion) {
    if (!suggestion) {
      return false;
    }
    const neutralTypes = ['googleSuggest', 'newtab', 'modeSwitch', 'zenSwitch', 'chatgpt', 'perplexity', 'commandNewTab', 'commandSettings', 'commandDocumentPip'];
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
    const hostKey = getThemeHostForSuggestion(suggestion);
    const iconUrl = getThemeSourceForSuggestion(suggestion);
    const brandTheme = buildAndCacheBrandThemeForHost(hostKey, iconUrl);
    if (brandTheme) {
      return Promise.resolve(brandTheme);
    }
    const persistedTheme = getPersistedThemeForHost(hostKey);
    if (persistedTheme && !isHostFaviconVisitDirty(hostKey) && !isLowConfidenceTheme(persistedTheme)) {
      return Promise.resolve(persistedTheme);
    }
    const pageUrl = getThemePageUrlForSuggestion(suggestion, hostKey);
    return requestSiteThemeColor(pageUrl, hostKey).then((siteTheme) => {
      return resolveThemeWithFaviconFallback(hostKey, iconUrl, persistedTheme, siteTheme, pageUrl);
    });
  }

  function getImmediateThemeForSuggestion(suggestion) {
    if (!shouldUseBrandTheme(suggestion)) {
      return defaultTheme;
    }
    if (suggestion && suggestion.provider) {
      const hostKey = getProviderThemeHost(suggestion.provider);
      const iconUrl = getProviderIcon(suggestion.provider);
      if (hostKey && themeHostCache.has(hostKey)) {
        const cachedTheme = themeHostCache.get(hostKey);
        if (cachedTheme && !isLowConfidenceTheme(cachedTheme)) {
          return cachedTheme;
        }
      }
      if (iconUrl && themeColorCache.has(iconUrl)) {
        const cachedIconTheme = themeColorCache.get(iconUrl);
        if (cachedIconTheme && !isLowConfidenceTheme(cachedIconTheme)) {
          return cachedIconTheme;
        }
      }
      const brandTheme = buildAndCacheBrandThemeForHost(hostKey, iconUrl);
      if (brandTheme) {
        return brandTheme;
      }
      const persistedTheme = getPersistedThemeForHost(hostKey);
      if (persistedTheme && !isLowConfidenceTheme(persistedTheme)) {
        return persistedTheme;
      }
      return defaultTheme;
    }
    if (suggestion && suggestion.url) {
      const hostKey = getHostFromUrl(suggestion.url);
      if (hostKey && themeHostCache.has(hostKey)) {
        const cachedTheme = themeHostCache.get(hostKey);
        if (cachedTheme && !isLowConfidenceTheme(cachedTheme)) {
          return cachedTheme;
        }
      }
      if (themeColorCache.has(suggestion.url)) {
        const cachedUrlTheme = themeColorCache.get(suggestion.url);
        if (cachedUrlTheme && !isLowConfidenceTheme(cachedUrlTheme)) {
          return cachedUrlTheme;
        }
      }
      const brandTheme = buildAndCacheBrandThemeForHost(hostKey, suggestion.url);
      if (brandTheme) {
        return brandTheme;
      }
      const persistedTheme = getPersistedThemeForHost(hostKey);
      if (persistedTheme && !isLowConfidenceTheme(persistedTheme)) {
        return persistedTheme;
      }
      return defaultTheme;
    }
    return defaultTheme;
  }

  function shouldUseUrlFallbackThemeForSuggestion(suggestion, theme) {
    if (!suggestion || !shouldUseBrandTheme(suggestion)) {
      return false;
    }
    const resolvedTheme = theme || defaultTheme;
    if (!resolvedTheme._xIsDefault && !isLowConfidenceTheme(resolvedTheme)) {
      return false;
    }
    const iconUrl = getThemeSourceForSuggestion(suggestion);
    return Boolean(iconUrl && isFaviconProxyUrl(iconUrl));
  }

  const themeResolutionQueue = [];
  const queuedThemeResolutionByTarget = new WeakMap();
  let themeResolutionSequence = 0;
  let themeResolutionFlushTimer = null;
  let themeResolutionCacheWaitStarted = false;

  function scheduleThemeResolutionFlush(delayMs) {
    if (themeResolutionFlushTimer !== null) {
      return;
    }
    themeResolutionFlushTimer = window.setTimeout(() => {
      themeResolutionFlushTimer = null;
      flushThemeResolutionQueue();
    }, Math.max(0, Number(delayMs) || 0));
  }

  function flushThemeResolutionQueue() {
    if (themeResolutionQueue.length === 0) {
      return;
    }
    if (!areFaviconRenderCachesReady()) {
      if (!themeResolutionCacheWaitStarted) {
        themeResolutionCacheWaitStarted = true;
        faviconCacheRuntime.ensureCachesReady().then(() => {
          themeResolutionCacheWaitStarted = false;
          scheduleThemeResolutionFlush(0);
        });
      }
      return;
    }
    themeResolutionQueue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.sequence - b.sequence;
    });
    const batch = themeResolutionQueue.splice(0, THEME_RESOLUTION_BATCH_SIZE);
    batch.forEach((item) => {
      if (!item || !item.target || !item.target.isConnected) {
        return;
      }
      if (queuedThemeResolutionByTarget.get(item.target) !== item) {
        return;
      }
      queuedThemeResolutionByTarget.delete(item.target);
      getThemeForSuggestion(item.suggestion).then((theme) => {
        if (!item.target || !item.target.isConnected) {
          return;
        }
        item.applyTheme(theme || defaultTheme);
      });
    });
    if (themeResolutionQueue.length > 0) {
      scheduleThemeResolutionFlush(THEME_RESOLUTION_BATCH_DELAY_MS);
    }
  }

  function queueThemeForTarget(target, suggestion, applyTheme, options) {
    if (!target || typeof applyTheme !== 'function') {
      return;
    }
    if (!shouldUseBrandTheme(suggestion)) {
      return;
    }
    const existing = queuedThemeResolutionByTarget.get(target);
    const item = {
      target,
      suggestion,
      applyTheme,
      priority: Number.isFinite(options && options.priority) ? options.priority : 1,
      sequence: themeResolutionSequence += 1
    };
    if (existing) {
      existing.suggestion = item.suggestion;
      existing.applyTheme = item.applyTheme;
      existing.priority = Math.min(existing.priority, item.priority);
      existing.sequence = item.sequence;
    } else {
      queuedThemeResolutionByTarget.set(target, item);
      themeResolutionQueue.push(item);
    }
    scheduleThemeResolutionFlush(options && Number.isFinite(options.delayMs)
      ? options.delayMs
      : THEME_RESOLUTION_BATCH_DELAY_MS);
  }

  function isNewtabDarkMode() {
    return document.body.getAttribute('data-theme') === 'dark';
  }

  function getFaviconPreferredTheme() {
    return isNewtabDarkMode() ? 'dark' : 'light';
  }

  function getThemeForMode(theme) {
    return NEWTAB_FAVICON_THEME.getThemeForMode(theme, {
      defaultTheme,
      isDarkMode: isNewtabDarkMode
    });
  }

  function getHoverColors(theme) {
    return NEWTAB_FAVICON_THEME.getHoverColors(theme, {
      defaultTheme,
      isDarkMode: isNewtabDarkMode
    });
  }

  function getNeutralHoverActionColors() {
    return isNewtabDarkMode()
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
    const highlight = getHighlightColors(theme);
    const hover = resolvedTheme._xIsBrand
      ? getHoverColors(theme)
      : {
        bg: 'var(--x-nt-hover-bg, #F3F4F6)',
        border: 'transparent'
      };
    target.style.setProperty('--x-nt-suggestion-active-bg', highlight.bg);
    target.style.setProperty('--x-nt-suggestion-active-border', highlight.border);
    target.style.setProperty('--x-nt-suggestion-hover-bg', hover.bg);
    target.style.setProperty('--x-nt-suggestion-hover-border', hover.border);
  }

  function applyMarkVariables(target, theme) {
    if (!target || !theme) {
      return;
    }
    const resolvedTheme = getThemeForMode(theme);
    target.style.setProperty('--x-ext-mark-bg', resolvedTheme.markBg);
    target.style.setProperty('--x-ext-mark-text', resolvedTheme.markText);
  }

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
    return typeof faviconCacheRuntime.isSiteThemePersistLoaded === 'function'
      ? faviconCacheRuntime.isSiteThemePersistLoaded()
      : true;
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

  function setPersistedFaviconData(cacheKey, dataUrl) {
    faviconCacheRuntime.setPersistedData(cacheKey, dataUrl);
  }

  function getPersistedSiteThemeEntry(hostKey) {
    return typeof faviconCacheRuntime.getPersistedThemeEntry === 'function'
      ? faviconCacheRuntime.getPersistedThemeEntry(hostKey)
      : null;
  }

  function setPersistedSiteThemeEntry(hostKey, theme) {
    if (!theme || !isPersistableTheme(theme)) {
      return false;
    }
    const accentRgb = normalizeAccentRgb(theme.accentRgb || parseCssColor(theme.accent));
    if (!accentRgb || typeof faviconCacheRuntime.setPersistedThemeEntry !== 'function') {
      return false;
    }
    return faviconCacheRuntime.setPersistedThemeEntry(hostKey, {
      accentRgb,
      source: getThemeSource(theme),
      neutral: isLowConfidenceTheme(theme) || theme._xThemeNeutral === true,
      confidence: normalizeThemeConfidence(theme._xThemeConfidence, accentRgb)
    });
  }

  const faviconViewRuntime = NEWTAB_FAVICON_VIEW.createFaviconViewRuntime({
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
    getHostFromUrl,
    isFaviconProxyUrl,
    isChromeMonogramFaviconUrl,
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
  const refreshFallbackIcons = faviconViewRuntime.refreshFallbackIcons;
  const requestFaviconData = faviconViewRuntime.requestFaviconData;
  const setFaviconSrcWithAnimation = faviconViewRuntime.setFaviconSrcWithAnimation;
  const attachFaviconData = faviconViewRuntime.attachFaviconData;
  const preloadIcon = faviconViewRuntime.preloadIcon;
  const warmIconCache = faviconViewRuntime.warmIconCache;
  const attachFaviconWithFallbacks = faviconViewRuntime.attachFaviconWithFallbacks;
  const refreshThemeAwareFavicons = faviconViewRuntime.refreshThemeAwareFavicons;
  const rescueThemeAwareFallbackFavicons = faviconViewRuntime.rescueThemeAwareFallbackFavicons;
  const scheduleThemeAwareFaviconRescue = faviconViewRuntime.scheduleThemeAwareFaviconRescue;

  function isAllowedFaviconProxyRequestUrl(url) {
    return typeof FAVICON_UTILS.isAllowedFaviconProxyRequestUrl === 'function'
      ? FAVICON_UTILS.isAllowedFaviconProxyRequestUrl(url)
      : /^chrome-extension:\/\/[^/]+\/_favicon\//i.test(String(url || '').trim()) ||
        /^chrome:\/\/favicon2\//i.test(String(url || '').trim());
  }

  function isBlockedLocalFaviconUrl(url) {
    const blockedByLocalRules = typeof FAVICON_UTILS.isBlockedLocalFaviconUrl === 'function'
      ? FAVICON_UTILS.isBlockedLocalFaviconUrl(url)
      : false;
    return blockedByLocalRules ||
      (!isAllowedFaviconProxyRequestUrl(url) && isUrlBlockedByFaviconRequestBlacklist(url));
  }

  function isChromeMonogramFaviconUrl(url) {
    return typeof FAVICON_UTILS.isChromeMonogramFaviconUrl === 'function'
      ? FAVICON_UTILS.isChromeMonogramFaviconUrl(url)
      : /^chrome:\/\/favicon2\//i.test(String(url || '').trim());
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
      if (!avg) {
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
    if (!pageFaviconUrlResolver && typeof FAVICON_UTILS.createFaviconUrlResolver === 'function') {
      pageFaviconUrlResolver = FAVICON_UTILS.createFaviconUrlResolver({
        chromeApi: chrome,
        size: FAVICON_PROXY_SIZE,
        shouldBlockFaviconForHost,
        shouldAvoidDirectFaviconForHost
      });
    }
    return pageFaviconUrlResolver;
  }

  function getThemeSourceForSuggestion(suggestion) {
    if (suggestion && suggestion.provider) {
      const hostKey = getProviderThemeHost(suggestion.provider);
      if (hostKey && shouldBlockFaviconForHost(hostKey)) {
        return '';
      }
      return getProviderIcon(suggestion.provider) || (hostKey ? getHostFaviconUrl(hostKey) : '');
    }
    if (suggestion && suggestion.url && isUrlBlockedByFaviconRequestBlacklist(suggestion.url)) {
      if (suggestion.favicon && isAllowedFaviconProxyRequestUrl(suggestion.favicon)) {
        return suggestion.favicon;
      }
      return getPageFaviconCandidateUrl(getCanonicalPageUrlForFavicon(suggestion.url) || suggestion.url);
    }
    if (suggestion && suggestion.url) {
      try {
        const pageUrl = getCanonicalPageUrlForFavicon(suggestion.url) || suggestion.url;
        const hostname = normalizeHost(new URL(pageUrl).hostname);
        if (hostname) {
          return getGstaticFaviconUrl(pageUrl) || getHostFaviconUrl(hostname);
        }
      } catch (e) {
        // Ignore malformed URLs.
      }
    }
    return suggestion && suggestion.favicon ? suggestion.favicon : '';
  }

  function getSiteFaviconUrl(hostname) {
    if (!hostname) {
      return '';
    }
    return `https://${hostname}/favicon.ico`;
  }

  function navigateToUrl(url) {
    if (!url) {
      return;
    }
    if (chrome.tabs && chrome.tabs.getCurrent) {
      chrome.tabs.getCurrent(function(tab) {
        if (chrome.runtime.lastError) {
          window.location.href = url;
          return;
        }
        if (tab && tab.id) {
          chrome.tabs.update(tab.id, { url: url });
        } else {
          window.location.href = url;
        }
      });
    } else {
      window.location.href = url;
    }
  }

  function isMiddleClick(event) {
    if (typeof NAVIGATION_DISPOSITION.isMiddleClick === 'function') {
      return NAVIGATION_DISPOSITION.isMiddleClick(event);
    }
    return Boolean(event && Number(event.button) === 1);
  }

  function isBackgroundOpenEvent(event) {
    if (typeof NAVIGATION_DISPOSITION.isBackgroundOpenEvent === 'function') {
      return NAVIGATION_DISPOSITION.isBackgroundOpenEvent(event);
    }
    return Boolean(event && (event.metaKey || event.ctrlKey || isMiddleClick(event)));
  }

  function getOpenDisposition(event, fallback) {
    if (typeof event === 'string') {
      return event === 'backgroundTab' ? 'backgroundTab' : (fallback || event || 'newTab');
    }
    if (typeof NAVIGATION_DISPOSITION.getDisposition === 'function') {
      return NAVIGATION_DISPOSITION.getDisposition(event, fallback);
    }
    return isBackgroundOpenEvent(event) ? 'backgroundTab' : (fallback || 'newTab');
  }

  function openExternalNewTabUrl(url, eventOrDisposition) {
    if (!url) {
      return false;
    }
    const disposition = typeof eventOrDisposition === 'string'
      ? eventOrDisposition
      : getOpenDisposition(eventOrDisposition, 'newTab');
    if (chrome && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
      chrome.runtime.sendMessage({
        action: 'createTab',
        url,
        disposition
      });
      return true;
    }
    if (chrome && chrome.tabs && typeof chrome.tabs.create === 'function') {
      chrome.tabs.create({ url, active: disposition !== 'backgroundTab' });
      return true;
    }
    window.open(url, '_blank', 'noopener');
    return true;
  }

  function openUrlFromNewtabCard(url, options) {
    if (!url) {
      return;
    }
    const config = options && typeof options === 'object' ? options : {};
    if (config.openInBackgroundTab &&
        chrome && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
      chrome.runtime.sendMessage({
        action: 'createTab',
        url: url,
        disposition: 'backgroundTab'
      });
      return;
    }
    navigateToUrl(url);
  }

  function openShortcutUrl(shortcut, event) {
    if (!shortcut || !shortcut.url) {
      return;
    }
    openUrlFromNewtabCard(shortcut.url, {
      openInBackgroundTab: isBackgroundOpenEvent(event)
    });
  }

  function recordSearchSuggestionSelection(suggestion, rawQuery) {
    if (!suggestion || suggestion.forceSearch || suggestion.provider || !suggestion.url ||
        !chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
      return;
    }
    const query = String(rawQuery || latestRawQuery || (inputParts && inputParts.input ? inputParts.input.value : '') || '').trim();
    if (!query) {
      return;
    }
    chrome.runtime.sendMessage({
      action: 'recordSearchSuggestionSelection',
      query,
      url: suggestion.url,
      title: suggestion.title || '',
      type: suggestion.type || 'history',
      source: 'newtab'
    }, () => {
      if (chrome.runtime && chrome.runtime.lastError) {
        // Best-effort ranking signal.
      }
    });
  }

  function openBookmarkFolder(nodeId) {
    const id = String(nodeId || '').trim();
    if (!id) {
      return;
    }
    navigateBookmarkFolder(id);
  }

  function markCurrentTabForSearchTracking() {
    if (!chrome || !chrome.tabs || !chrome.tabs.getCurrent || !chrome.runtime || !chrome.runtime.sendMessage) {
      return;
    }
    chrome.tabs.getCurrent((tab) => {
      if (tab && typeof tab.id === 'number') {
        chrome.runtime.sendMessage({ action: 'trackSearchTab', tabId: tab.id });
      }
    });
  }

  function runBrowserSearch(query, disposition, onFail) {
    if (chrome && chrome.search && typeof chrome.search.query === 'function') {
      try {
        chrome.search.query({ text: query, disposition: disposition || 'CURRENT_TAB' }, () => {
          if (chrome.runtime && chrome.runtime.lastError && typeof onFail === 'function') {
            onFail();
          }
        });
        return true;
      } catch (e) {
        if (typeof onFail === 'function') {
          onFail();
        }
        return false;
      }
    }
    return false;
  }

  function navigateToQuery(query, forceSearch) {
    const directUrl = !forceSearch ? getDirectNavigationUrl(query) : '';
    let targetUrl = query;
    if (directUrl) {
      navigateToUrl(directUrl);
      return;
    }
    markCurrentTabForSearchTracking();
    const attempted = runBrowserSearch(query, 'CURRENT_TAB', () => {
      const fallbackUrl = buildDefaultSearchUrl(query);
      navigateToUrl(fallbackUrl);
    });
    if (attempted) {
      return;
    }
    targetUrl = buildDefaultSearchUrl(query);
    navigateToUrl(targetUrl);
  }

  const suggestionsContainer = document.createElement('div');
  suggestionsContainer.id = '_x_extension_newtab_suggestions_container_2024_unique_';
  suggestionsContainer.setAttribute('data-visible', 'false');
  const suggestionsSurface = document.createElement('div');
  suggestionsSurface.id = '_x_extension_newtab_suggestions_surface_2026_unique_';
  suggestionsSurface.setAttribute('data-visible', 'false');
  const suggestionsOutline = document.createElement('div');
  suggestionsOutline.id = '_x_extension_newtab_suggestions_outline_2026_unique_';
  suggestionsOutline.setAttribute('data-visible', 'false');
  const topActionTooltipController = globalThis.LumnoTooltip &&
      typeof globalThis.LumnoTooltip.createController === 'function'
    ? globalThis.LumnoTooltip.createController({
      documentObj: document,
      windowObj: window,
      id: '_x_extension_newtab_top_action_tooltip_2026_unique_',
      appendTo: document.body,
      maxWidth: 420
    })
    : null;
  const shortcutTooltipController = globalThis.LumnoTooltip &&
      typeof globalThis.LumnoTooltip.createController === 'function'
    ? globalThis.LumnoTooltip.createController({
      documentObj: document,
      windowObj: window,
      id: '_x_extension_newtab_shortcut_tooltip_2026_unique_',
      className: 'x-nt-shortcut-tooltip',
      appendTo: document.body,
      maxWidth: 360
    })
    : null;
  const bookmarkCursorTooltipController = globalThis.LumnoCursorTooltip &&
      typeof globalThis.LumnoCursorTooltip.createController === 'function'
    ? globalThis.LumnoCursorTooltip.createController({
      documentObj: document,
      windowObj: window,
      id: '_x_extension_newtab_bookmark_cursor_tooltip_2026_unique_',
      className: 'x-nt-bookmark-cursor-tooltip',
      appendTo: document.body,
      maxWidth: 460,
      offsetX: 14,
      offsetY: 16
    })
    : null;

  function showTopActionTooltip(button, text, options) {
    if (!topActionTooltipController || !button || !text) {
      return;
    }
    const tooltipOptions = options && typeof options === 'object' ? options : {};
    const placement = tooltipOptions.placement === 'left' || tooltipOptions.placement === 'left-above'
      ? tooltipOptions.placement
      : 'top';
    topActionTooltipController.show(button, text, Object.assign({}, tooltipOptions, {
      placement,
      maxWidth: 420
    }));
  }

  function hideTopActionTooltip() {
    if (!topActionTooltipController) {
      return;
    }
    topActionTooltipController.hide();
  }

  function bindShortcutTooltip(target, getText, options) {
    if (!shortcutTooltipController || !target) {
      return null;
    }
    const tooltipOptions = options && typeof options === 'object' ? options : {};
    const resolveText = typeof getText === 'function'
      ? getText
      : () => (typeof target.getAttribute === 'function' ? target.getAttribute('data-tooltip') : '');
    return shortcutTooltipController.bind(target, (tooltipTarget) => {
      if (isShortcutTooltipSuppressed()) {
        return '';
      }
      return resolveText(tooltipTarget);
    }, Object.assign({
      placement: 'bottom',
      maxWidth: 360,
      spacing: -6,
      showOnFocus: false
    }, tooltipOptions));
  }

  function isShortcutTooltipSuppressed() {
    return Boolean(
      (shortcutDragState && shortcutDragState.isDragging) ||
      (shortcutGrid && shortcutGrid.getAttribute('data-shortcut-dragging') === 'true') ||
      isShortcutContextMenuOpen()
    );
  }

  function hideShortcutTooltip() {
    if (!shortcutTooltipController) {
      return;
    }
    shortcutTooltipController.hide();
  }

  function bindCursorTooltip(target, getText, options) {
    if (!bookmarkCursorTooltipController || !target) {
      return null;
    }
    const tooltipOptions = options && typeof options === 'object' ? options : {};
    const originalShouldShow = typeof tooltipOptions.shouldShow === 'function'
      ? tooltipOptions.shouldShow
      : null;
    return bookmarkCursorTooltipController.bind(target, getText, Object.assign({
      maxWidth: 460
    }, tooltipOptions, {
      shouldShow: (tooltipTarget, inputEvent) => {
        if (isBookmarkCursorTooltipSuppressed(tooltipTarget)) {
          return false;
        }
        return originalShouldShow ? originalShouldShow(tooltipTarget, inputEvent) !== false : true;
      }
    }));
  }

  function isBookmarkCursorTooltipSuppressed(target) {
    return shouldSuppressBookmarkHover(target);
  }

  function hideCursorTooltip() {
    if (!bookmarkCursorTooltipController) {
      return;
    }
    bookmarkCursorTooltipController.hide();
  }

  function getSectionModeSelectOptions(config) {
    const options = Array.isArray(config && config.options) ? config.options : [];
    return options.map((item) => {
      const value = String(item && item.value !== undefined ? item.value : '');
      return {
        value,
        label: t(item && item.labelKey, (item && item.fallback) || value)
      };
    });
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
      showTopActionTooltip(trigger, trigger.getAttribute('data-tooltip') || t('display_mode_title', 'Display mode'));
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
    scheduleWallpaperAdaptiveToneUpdate();
  }

  function isContentSectionVisible(section) {
    return Boolean(section && section.getAttribute('data-visible') === 'true');
  }

  function applyNewtabShortcutsVisibility() {
    if (!shortcutSection) {
      return;
    }
    setContentSectionVisible(shortcutSection, Boolean(newtabShortcutsVisible));
    if (!newtabShortcutsVisible || zenModeEnabled) {
      resetShortcutDockHover();
      closeShortcutContextMenu();
      closeShortcutDialog();
    }
  }

  function getShortcutStoreOptions(extraOptions) {
    return {
      key: NEWTAB_SHORTCUTS_STORAGE_KEY,
      maxShortcuts: MAX_NEWTAB_SHORTCUTS,
      normalizeHost,
      sanitizeDisplayText,
      ...(extraOptions || {})
    };
  }

  function getShortcutTitle(shortcut) {
    return sanitizeDisplayText(shortcut && shortcut.title ? shortcut.title : '') ||
      sanitizeDisplayText(shortcut && shortcut.host ? shortcut.host : '') ||
      sanitizeDisplayText(shortcut && shortcut.url ? shortcut.url : '') ||
      t('newtab_shortcuts_add', 'Add shortcut');
  }

  function setShortcutError(message) {
    if (!shortcutError) {
      return;
    }
    const text = String(message || '').trim();
    shortcutError.textContent = text;
    shortcutError.setAttribute('data-visible', text ? 'true' : 'false');
  }

  function updateShortcutDialogLanguageStrings() {
    const isEditMode = shortcutDialogMode === SHORTCUT_DIALOG_MODE_EDIT;
    if (shortcutDialogTitle) {
      shortcutDialogTitle.textContent = isEditMode
        ? t('newtab_shortcuts_edit_dialog_title', 'Edit shortcut')
        : t('newtab_shortcuts_dialog_title', 'Add shortcut');
    }
    if (shortcutNameLabel) {
      shortcutNameLabel.textContent = t('newtab_shortcuts_name_label', 'Name');
    }
    if (shortcutUrlLabel) {
      shortcutUrlLabel.textContent = t('newtab_shortcuts_url_label', 'URL');
    }
    if (shortcutNameInput) {
      shortcutNameInput.placeholder = t('newtab_shortcuts_name_placeholder', 'Lumno');
    }
    if (shortcutUrlInput) {
      shortcutUrlInput.placeholder = t('newtab_shortcuts_url_placeholder', 'https://example.com');
    }
    if (shortcutCancelButton) {
      shortcutCancelButton.textContent = t('newtab_shortcuts_cancel', 'Cancel');
    }
    if (shortcutDoneButton) {
      shortcutDoneButton.textContent = isEditMode
        ? t('newtab_shortcuts_save', 'Save')
        : t('newtab_shortcuts_done', 'Done');
    }
  }

  function getShortcutContextMenuOptions() {
    return [
      {
        value: SHORTCUT_CONTEXT_MENU_EDIT_VALUE,
        label: t('shortcuts_edit', 'Edit')
      },
      {
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
        getShortcutContextMenuOptions(),
        SHORTCUT_CONTEXT_MENU_EDIT_VALUE
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
  }

  function closeShortcutDialog(options) {
    if (!shortcutDialogBackdrop) {
      return;
    }
    if (shortcutDialogOpenFrame) {
      cancelAnimationFrame(shortcutDialogOpenFrame);
      shortcutDialogOpenFrame = 0;
    }
    shortcutDialogBackdrop.removeAttribute('data-preparing');
    if (shortcutDialogCloseTimer) {
      clearTimeout(shortcutDialogCloseTimer);
      shortcutDialogCloseTimer = 0;
    }
    shortcutDialogBackdrop.setAttribute('data-open', 'false');
    if (shortcutDialogBackdrop.hidden) {
      shortcutDialogBackdrop.hidden = true;
    } else {
      shortcutDialogCloseTimer = window.setTimeout(() => {
        shortcutDialogCloseTimer = 0;
        if (shortcutDialogBackdrop &&
            shortcutDialogBackdrop.getAttribute('data-open') !== 'true') {
          shortcutDialogBackdrop.hidden = true;
        }
      }, 180);
    }
    setShortcutError('');
    if (options && options.restoreFocus && shortcutDialogPreviousFocus &&
        typeof shortcutDialogPreviousFocus.focus === 'function') {
      try {
        shortcutDialogPreviousFocus.focus({ preventScroll: true });
      } catch (error) {
        shortcutDialogPreviousFocus.focus();
      }
    }
    shortcutDialogPreviousFocus = null;
  }

  function clampShortcutDialogEnterOffset(value, limit) {
    const raw = Number(value);
    const max = Number.isFinite(Number(limit)) ? Math.max(0, Number(limit)) : 28;
    if (!Number.isFinite(raw)) {
      return 0;
    }
    return Math.max(-max, Math.min(max, raw));
  }

  function getShortcutDialogEnterOffset(sourceCenter, targetCenter) {
    const delta = Number(sourceCenter) - Number(targetCenter);
    if (!Number.isFinite(delta) || Math.abs(delta) < 4) {
      return 0;
    }
    const offset = clampShortcutDialogEnterOffset(delta * 0.12, 28);
    if (Math.abs(offset) < 6) {
      return delta < 0 ? -6 : 6;
    }
    return offset;
  }

  function setShortcutDialogEnterDirection(sourceElement) {
    if (!shortcutDialog) {
      return;
    }
    let enterX = 0;
    let enterY = 12;
    let originX = 'center';
    let originY = 'bottom';
    if (sourceElement && typeof sourceElement.getBoundingClientRect === 'function') {
      const sourceRect = sourceElement.getBoundingClientRect();
      const dialogRect = shortcutDialog.getBoundingClientRect();
      const viewportWidth = Math.max(0, window.innerWidth || document.documentElement.clientWidth || 0);
      const viewportHeight = Math.max(0, window.innerHeight || document.documentElement.clientHeight || 0);
      const targetX = dialogRect.width ? dialogRect.left + dialogRect.width / 2 : viewportWidth / 2;
      const targetY = dialogRect.height ? dialogRect.top + dialogRect.height / 2 : viewportHeight / 2;
      const sourceX = sourceRect.left + sourceRect.width / 2;
      const sourceY = sourceRect.top + sourceRect.height / 2;
      enterX = getShortcutDialogEnterOffset(sourceX, targetX);
      enterY = getShortcutDialogEnterOffset(sourceY, targetY);
      if (Math.abs(enterX) < 2) {
        enterX = 0;
      }
      if (Math.abs(enterY) < 2) {
        enterY = 0;
      }
      originX = enterX < -2 ? 'left' : enterX > 2 ? 'right' : 'center';
      originY = enterY < -2 ? 'top' : enterY > 2 ? 'bottom' : 'center';
    }
    shortcutDialog.style.setProperty('--x-nt-shortcut-dialog-enter-x', `${Math.round(enterX)}px`);
    shortcutDialog.style.setProperty('--x-nt-shortcut-dialog-enter-y', `${Math.round(enterY)}px`);
    shortcutDialog.style.transformOrigin = `${originX} ${originY}`;
  }

  function setShortcutDialogMode(mode, shortcut) {
    const isEditMode = mode === SHORTCUT_DIALOG_MODE_EDIT && shortcut;
    shortcutDialogMode = isEditMode ? SHORTCUT_DIALOG_MODE_EDIT : SHORTCUT_DIALOG_MODE_ADD;
    shortcutDialogEditingId = isEditMode ? String(shortcut.id || '') : '';
    updateShortcutDialogLanguageStrings();
    if (!isEditMode) {
      return;
    }
    if (shortcutNameInput) {
      shortcutNameInput.value = shortcut.title || '';
    }
    if (shortcutUrlInput) {
      shortcutUrlInput.value = shortcut.url || '';
    }
  }

  function openShortcutDialog() {
    if (!shortcutDialogBackdrop || !shortcutForm) {
      return;
    }
    const options = arguments.length > 0 ? arguments[0] : null;
    const dialogMode = options && options.mode === SHORTCUT_DIALOG_MODE_EDIT
      ? SHORTCUT_DIALOG_MODE_EDIT
      : SHORTCUT_DIALOG_MODE_ADD;
    shortcutDialogPreviousFocus = (options && options.sourceElement) || document.activeElement;
    shortcutForm.reset();
    setShortcutError('');
    setShortcutDialogMode(dialogMode, options && options.shortcut);
    if (shortcutDialogCloseTimer) {
      clearTimeout(shortcutDialogCloseTimer);
      shortcutDialogCloseTimer = 0;
    }
    if (shortcutDialogOpenFrame) {
      cancelAnimationFrame(shortcutDialogOpenFrame);
      shortcutDialogOpenFrame = 0;
    }
    shortcutDialogBackdrop.setAttribute('data-open', 'false');
    shortcutDialogBackdrop.hidden = false;
    shortcutDialogBackdrop.setAttribute('data-preparing', 'true');
    setShortcutDialogEnterDirection(options && options.sourceElement);
    if (shortcutDialog) {
      void shortcutDialog.offsetWidth;
    }
    shortcutDialogOpenFrame = requestAnimationFrame(() => {
      shortcutDialogOpenFrame = 0;
      if (!shortcutDialogBackdrop || shortcutDialogBackdrop.hidden) {
        return;
      }
      shortcutDialogBackdrop.removeAttribute('data-preparing');
      if (shortcutDialog) {
        void shortcutDialog.offsetWidth;
      }
      shortcutDialogBackdrop.setAttribute('data-open', 'true');
      if (!shortcutNameInput) {
        return;
      }
      try {
        shortcutNameInput.focus({ preventScroll: true });
      } catch (error) {
        shortcutNameInput.focus();
      }
    });
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

  function getShortcutDockPointerX(event) {
    const value = Number(event && event.clientX);
    return Number.isFinite(value) ? value : null;
  }

  function getShortcutDockIcon(tile) {
    return tile && typeof tile.querySelector === 'function'
      ? tile.querySelector('.x-nt-shortcut-icon')
      : null;
  }

  function resetShortcutDockTile(tile) {
    if (!tile) {
      return;
    }
    tile.removeAttribute('data-dock-distance');
    tile.removeAttribute('data-dock-side');
    const icon = getShortcutDockIcon(tile);
    if (!icon || !icon.style || typeof icon.style.removeProperty !== 'function') {
      return;
    }
    icon.style.removeProperty('--x-nt-shortcut-dock-scale');
    icon.style.removeProperty('--x-nt-shortcut-dock-shift-x');
    icon.style.removeProperty('--x-nt-shortcut-dock-rise');
  }

  function getShortcutDockInfluence(pointerX, icon) {
    if (!icon || typeof icon.getBoundingClientRect !== 'function' || !Number.isFinite(pointerX)) {
      return null;
    }
    const rect = icon.getBoundingClientRect();
    const iconWidth = Math.max(1, rect.width || rect.height || 48);
    const centerX = rect.left + ((rect.width || iconWidth) / 2);
    const distancePx = Math.abs(pointerX - centerX);
    const influenceRadius = Math.max(144, iconWidth * 4);
    const raw = Math.max(0, 1 - (distancePx / influenceRadius));
    const eased = raw * raw * (3 - (2 * raw));
    return {
      eased,
      side: centerX < pointerX ? 'before' : centerX > pointerX ? 'after' : 'active'
    };
  }

  function applyShortcutDockPointerStyles(tile, pointerX, offset) {
    const icon = getShortcutDockIcon(tile);
    const influence = getShortcutDockInfluence(pointerX, icon);
    if (!icon || !influence || !icon.style || typeof icon.style.setProperty !== 'function') {
      return;
    }
    const eased = Math.max(0, Math.min(1, influence.eased));
    if (eased <= 0.015) {
      icon.style.removeProperty('--x-nt-shortcut-dock-scale');
      icon.style.removeProperty('--x-nt-shortcut-dock-shift-x');
      icon.style.removeProperty('--x-nt-shortcut-dock-rise');
      return;
    }
    const numericOffset = Number(offset);
    const sideMultiplier = numericOffset < 0 ? -1 : numericOffset > 0 ? 1 : 0;
    const distanceFalloff = sideMultiplier === 0
      ? 0
      : 1 / Math.max(1, Math.abs(numericOffset));
    const landingTaper = Math.max(0, 1 - eased);
    const shiftPx = sideMultiplier * 16 * eased * landingTaper * distanceFalloff;
    icon.style.setProperty('--x-nt-shortcut-dock-scale', (1 + (0.28 * eased)).toFixed(3));
    icon.style.setProperty('--x-nt-shortcut-dock-shift-x', `${Math.round(shiftPx)}px`);
    icon.style.setProperty('--x-nt-shortcut-dock-rise', `${Math.round(-6 * eased)}px`);
  }

  function resetShortcutDockHover() {
    if (!shortcutGrid) {
      return;
    }
    if (isShortcutContextMenuOpen() && shortcutContextMenuTargetId) {
      const activeTile = getShortcutTileById(shortcutContextMenuTargetId);
      if (activeTile) {
        applyShortcutContextMenuDockHover(activeTile);
        return;
      }
    }
    shortcutGrid.removeAttribute('data-dock-active');
    Array.from(shortcutGrid.querySelectorAll('.x-nt-shortcut-tile')).forEach((tile) => {
      resetShortcutDockTile(tile);
    });
    clearShortcutContextMenuTileActive();
  }

  function setShortcutDockHover(activeTile, pointerX) {
    if (!shortcutGrid || !activeTile) {
      return;
    }
    const tiles = Array.from(shortcutGrid.querySelectorAll('.x-nt-shortcut-tile'));
    const activeIndex = tiles.indexOf(activeTile);
    if (activeIndex < 0) {
      resetShortcutDockHover();
      return;
    }
    shortcutGrid.setAttribute('data-dock-active', 'true');
    tiles.forEach((tile, index) => {
      const offset = index - activeIndex;
      const distance = Math.abs(offset);
      if (distance > 2) {
        resetShortcutDockTile(tile);
        return;
      }
      tile.setAttribute('data-dock-distance', String(distance));
      tile.setAttribute('data-dock-side', offset < 0 ? 'before' : offset > 0 ? 'after' : 'active');
      if (Number.isFinite(pointerX)) {
        applyShortcutDockPointerStyles(tile, pointerX, offset);
      }
    });
  }

  function handleShortcutDockPointerOver(event) {
    if (shortcutDragState && shortcutDragState.isDragging) {
      return;
    }
    const tile = getShortcutTileFromNode(event.target);
    if (tile) {
      setShortcutDockHover(tile, getShortcutDockPointerX(event));
    }
  }

  function handleShortcutDockPointerMove(event) {
    if (shortcutDragState && shortcutDragState.isDragging) {
      return;
    }
    const tile = getShortcutTileFromNode(event.target);
    if (tile) {
      setShortcutDockHover(tile, getShortcutDockPointerX(event));
    }
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

  function isShortcutContextMenuOpen() {
    return Boolean(
      shortcutContextMenu &&
      shortcutContextMenuSelectController &&
      shortcutContextMenuSelectController.isOpen(shortcutContextMenu.control)
    );
  }

  function isShortcutContextMenuNode(node) {
    if (!node || !shortcutContextMenu) {
      return false;
    }
    const { control, menu } = shortcutContextMenu;
    return Boolean(
      (control && (node === control || (typeof control.contains === 'function' && control.contains(node)))) ||
      (menu && (node === menu || (typeof menu.contains === 'function' && menu.contains(node))))
    );
  }

  function clearShortcutContextMenuTileActive() {
    getShortcutReorderTiles().forEach((tile) => {
      tile.removeAttribute('data-shortcut-context-menu-open');
    });
  }

  function setShortcutContextMenuTileActive(shortcutId) {
    clearShortcutContextMenuTileActive();
    const tile = getShortcutTileById(shortcutId);
    if (tile) {
      tile.setAttribute('data-shortcut-context-menu-open', 'true');
    }
  }

  function getShortcutContextMenuAnchorElement(tile) {
    return getShortcutDockIcon(tile) || tile;
  }

  function getShortcutContextMenuAnchorX(tile) {
    const anchor = getShortcutContextMenuAnchorElement(tile);
    if (!anchor || typeof anchor.getBoundingClientRect !== 'function') {
      return null;
    }
    const rect = anchor.getBoundingClientRect();
    const centerX = rect.left + (rect.width / 2);
    return Number.isFinite(centerX) ? centerX : null;
  }

  function applyShortcutContextMenuDockHover(tile) {
    if (!tile) {
      return;
    }
    setShortcutDockHover(tile, getShortcutContextMenuAnchorX(tile));
    tile.setAttribute('data-shortcut-context-menu-open', 'true');
  }

  function syncShortcutDockHoverFromPoint(clientX, clientY) {
    const pointerX = Number(clientX);
    const pointerY = Number(clientY);
    if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY) ||
        typeof document.elementFromPoint !== 'function') {
      resetShortcutDockHover();
      return;
    }
    const tile = getShortcutTileFromNode(document.elementFromPoint(pointerX, pointerY));
    if (tile) {
      setShortcutDockHover(tile, pointerX);
      return;
    }
    resetShortcutDockHover();
  }

  function closeShortcutContextMenu(options) {
    const closeOptions = options && typeof options === 'object' ? options : {};
    if (!shortcutContextMenu || !shortcutContextMenuSelectController) {
      shortcutContextMenuTargetId = '';
      clearShortcutContextMenuTileActive();
      return;
    }
    const wasOpen = isShortcutContextMenuOpen() || Boolean(shortcutContextMenuTargetId);
    shortcutContextMenuSelectController.setOpen(shortcutContextMenu.control, false);
    shortcutContextMenuTargetId = '';
    clearShortcutContextMenuTileActive();
    if (!wasOpen) {
      return;
    }
    if (closeOptions.syncHoverFromPointer) {
      syncShortcutDockHoverFromPoint(closeOptions.clientX, closeOptions.clientY);
      return;
    }
    resetShortcutDockHover();
  }

  function getShortcutContextMenuPoint(tile) {
    const anchor = getShortcutContextMenuAnchorElement(tile);
    if (anchor && typeof anchor.getBoundingClientRect === 'function') {
      const rect = anchor.getBoundingClientRect();
      return {
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.bottom)
      };
    }
    return { x: 0, y: 0 };
  }

  function setShortcutContextMenuPosition(tile) {
    if (!shortcutContextMenu || !shortcutContextMenu.control) {
      return;
    }
    const point = getShortcutContextMenuPoint(tile);
    shortcutContextMenu.control.style.left = `${Math.round(point.x)}px`;
    shortcutContextMenu.control.style.top = `${Math.round(point.y)}px`;
  }

  function handleShortcutContextMenuAction(actionValue) {
    const action = String(actionValue || '');
    const targetId = shortcutContextMenuTargetId;
    const shortcut = getShortcutById(targetId);
    const sourceElement = getShortcutTileById(targetId);
    closeShortcutContextMenu();
    if (!shortcut || !action) {
      return;
    }
    if (action === SHORTCUT_CONTEXT_MENU_EDIT_VALUE) {
      openShortcutEditor(shortcut, sourceElement);
      return;
    }
    if (action === SHORTCUT_CONTEXT_MENU_REMOVE_VALUE) {
      removeShortcutById(targetId);
    }
  }

  function handleShortcutContextMenuActionClick(event) {
    const target = event && event.target;
    const option = target && typeof target.closest === 'function'
      ? target.closest('._x_extension_select_option_2024_unique_')
      : null;
    if (!option || !shortcutContextMenu || !shortcutContextMenu.menu ||
        !shortcutContextMenu.menu.contains(option)) {
      return;
    }
    event.stopPropagation();
    handleShortcutContextMenuAction(option.getAttribute('data-value'));
  }

  function handleShortcutContextMenuDocumentPointerDown(event) {
    if (!isShortcutContextMenuOpen() || isShortcutContextMenuNode(event.target)) {
      return;
    }
    closeShortcutContextMenu({
      syncHoverFromPointer: true,
      clientX: event.clientX,
      clientY: event.clientY
    });
  }

  function createShortcutContextMenu() {
    if (!shortcutContextMenuSelectController ||
        typeof shortcutContextMenuSelectController.createSelect !== 'function') {
      return null;
    }
    const created = shortcutContextMenuSelectController.createSelect({
      id: '_x_extension_newtab_shortcut_context_menu_2026_unique_',
      selectId: '_x_extension_newtab_shortcut_context_menu_select_2026_unique_',
      className: 'x-nt-shortcut-context-menu',
      iconOnly: true,
      triggerIconClass: 'ri-more-line',
      menuClassName: 'x-nt-shortcut-context-menu-portal',
      menuAlign: 'middle',
      menuWidth: 'content',
      menuMinWidth: SHORTCUT_CONTEXT_MENU_MIN_WIDTH_PX,
      menuMaxWidth: SHORTCUT_CONTEXT_MENU_MAX_WIDTH_PX,
      menuPortal: true,
      menuPortalZIndex: SHORTCUT_CONTEXT_MENU_PORTAL_Z_INDEX,
      menuPortalOffset: SHORTCUT_CONTEXT_MENU_PORTAL_OFFSET_PX,
      value: SHORTCUT_CONTEXT_MENU_EDIT_VALUE,
      ariaLabel: t('newtab_shortcuts_context_menu_label', 'Shortcut actions'),
      options: getShortcutContextMenuOptions()
    });
    const control = created.wrapper;
    const select = created.select;
    const trigger = created.trigger;
    const menu = created.menu;
    if (!control || !select || !trigger || !menu) {
      return null;
    }
    trigger.tabIndex = -1;
    const stopContextMenuEvent = (event) => {
      event.stopPropagation();
    };
    [control, trigger, menu].forEach((element) => {
      element.addEventListener('pointerdown', stopContextMenuEvent);
      element.addEventListener('click', stopContextMenuEvent);
      element.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    });
    menu.addEventListener('click', handleShortcutContextMenuActionClick);
    document.addEventListener('pointerdown', handleShortcutContextMenuDocumentPointerDown, true);
    (document.body || shortcutSection || document.documentElement).appendChild(control);
    return {
      control,
      select,
      trigger,
      menu
    };
  }

  function openShortcutContextMenu(tile) {
    const shortcutId = getShortcutTileId(tile);
    if (!shortcutId) {
      return;
    }
    if (!shortcutContextMenu) {
      shortcutContextMenu = createShortcutContextMenu();
    }
    if (!shortcutContextMenu || !shortcutContextMenuSelectController) {
      return;
    }
    hideShortcutTooltip();
    resetShortcutDockHover();
    shortcutContextMenuTargetId = shortcutId;
    setShortcutContextMenuTileActive(shortcutId);
    applyShortcutContextMenuDockHover(tile);
    setShortcutContextMenuPosition(tile);
    if (typeof shortcutContextMenuSelectController.setOptions === 'function') {
      shortcutContextMenuSelectController.setOptions(
        shortcutContextMenu.control,
        getShortcutContextMenuOptions(),
        SHORTCUT_CONTEXT_MENU_EDIT_VALUE
      );
    }
    shortcutContextMenu.select.value = SHORTCUT_CONTEXT_MENU_EDIT_VALUE;
    shortcutContextMenuSelectController.sync(shortcutContextMenu.control);
    shortcutContextMenuSelectController.setOpen(shortcutContextMenu.control, true);
  }

  function handleShortcutContextMenu(event) {
    const tile = getShortcutTileFromNode(event.currentTarget || event.target);
    if (!tile || !getShortcutTileId(tile)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    openShortcutContextMenu(tile);
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
    openShortcutDialog({
      mode: SHORTCUT_DIALOG_MODE_EDIT,
      shortcut,
      sourceElement
    });
  }

  function getShortcutTileRectMap() {
    const rects = new Map();
    getShortcutReorderTiles().forEach((tile) => {
      if (tile && typeof tile.getBoundingClientRect === 'function') {
        rects.set(tile, tile.getBoundingClientRect());
      }
    });
    return rects;
  }

  function getShortcutTileLayoutRect(tile) {
    if (!tile || !shortcutGrid || typeof tile.offsetLeft !== 'number' ||
        typeof tile.offsetTop !== 'number') {
      return null;
    }
    const offsetParent = tile.offsetParent && typeof tile.offsetParent.getBoundingClientRect === 'function'
      ? tile.offsetParent
      : shortcutGrid;
    const parentRect = typeof offsetParent.getBoundingClientRect === 'function'
      ? offsetParent.getBoundingClientRect()
      : { left: 0, top: 0 };
    const width = Number(tile.offsetWidth) || 0;
    const height = Number(tile.offsetHeight) || 0;
    const left = parentRect.left + tile.offsetLeft;
    const top = parentRect.top + tile.offsetTop;
    return {
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
      centerX: left + (width / 2),
      centerY: top + (height / 2)
    };
  }

  function clearShortcutTileLayoutAnimation(tile) {
    if (!tile || !tile.style) {
      return;
    }
    if (tile._xShortcutLayoutAnimationTimer) {
      window.clearTimeout(tile._xShortcutLayoutAnimationTimer);
      tile._xShortcutLayoutAnimationTimer = 0;
    }
    tile.style.removeProperty('transition');
    if (tile.getAttribute && tile.getAttribute('data-shortcut-dragging') !== 'true' &&
        tile.getAttribute('data-shortcut-dropping') !== 'true') {
      tile.style.removeProperty('transform');
    }
  }

  function animateShortcutLayoutShift(beforeRects, draggedTile) {
    if (!beforeRects || !shortcutGrid) {
      return;
    }
    getShortcutReorderTiles().forEach((tile) => {
      if (!tile || tile === draggedTile || !tile.style || typeof tile.getBoundingClientRect !== 'function') {
        return;
      }
      const before = beforeRects.get(tile);
      if (!before) {
        return;
      }
      clearShortcutTileLayoutAnimation(tile);
      const after = tile.getBoundingClientRect();
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        return;
      }
      tile.style.transition = 'none';
      tile.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      void tile.offsetWidth;
      window.requestAnimationFrame(() => {
        if (!tile.isConnected) {
          return;
        }
        tile.style.transition = `transform ${SHORTCUT_REORDER_ANIMATION_MS}ms ${SHORTCUT_REORDER_EASING}`;
        tile.style.transform = 'translate3d(0, 0, 0)';
        tile._xShortcutLayoutAnimationTimer = window.setTimeout(() => {
          tile._xShortcutLayoutAnimationTimer = 0;
          clearShortcutTileLayoutAnimation(tile);
        }, SHORTCUT_REORDER_ANIMATION_MS + 80);
      });
    });
  }

  function setShortcutDragTileTransform(state, pointerX, pointerY) {
    if (!state || !state.tile || !state.tile.style ||
        typeof state.tile.getBoundingClientRect !== 'function') {
      return;
    }
    const rect = state.tile.getBoundingClientRect();
    const currentX = Number(state.translateX) || 0;
    const currentY = Number(state.translateY) || 0;
    const baseLeft = rect.left - currentX;
    const baseTop = rect.top - currentY;
    const nextX = pointerX - state.grabOffsetX - baseLeft;
    const nextY = pointerY - state.grabOffsetY - baseTop;
    state.translateX = nextX;
    state.translateY = nextY;
    state.tile.style.transition = 'none';
    state.tile.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`;
  }

  function settleShortcutDragTile(tile) {
    if (!tile || !tile.style) {
      return;
    }
    tile.setAttribute('data-shortcut-dropping', 'true');
    tile.style.pointerEvents = '';
    tile.style.transition = `transform ${SHORTCUT_DROP_ANIMATION_MS}ms ${SHORTCUT_REORDER_EASING}`;
    tile.style.transform = 'translate3d(0, 0, 0)';
    if (tile._xShortcutDropTimer) {
      window.clearTimeout(tile._xShortcutDropTimer);
    }
    tile._xShortcutDropTimer = window.setTimeout(() => {
      tile._xShortcutDropTimer = 0;
      tile.removeAttribute('data-shortcut-dragging');
      tile.removeAttribute('data-shortcut-dropping');
      tile.style.removeProperty('transition');
      tile.style.removeProperty('transform');
      tile.style.removeProperty('will-change');
      tile.style.pointerEvents = '';
    }, SHORTCUT_DROP_ANIMATION_MS + 90);
  }

  function getShortcutTileInsertionIndex(tile) {
    if (!tile) {
      return -1;
    }
    return getShortcutReorderTiles().indexOf(tile);
  }

  function getShortcutDragInsertionIndex(pointerX, pointerY) {
    if (!shortcutGrid || !shortcutDragState || !Number.isFinite(pointerX) ||
        !Number.isFinite(pointerY)) {
      return -1;
    }
    const draggedTile = shortcutDragState.tile;
    const layoutItems = getShortcutReorderTiles()
      .filter((tile) => tile && tile !== draggedTile)
      .map((tile) => ({
        tile,
        rect: getShortcutTileLayoutRect(tile)
      }))
      .filter((item) => item.rect && item.rect.width > 0 && item.rect.height > 0);
    if (!layoutItems.length) {
      return 0;
    }
    let nearestItem = layoutItems[0];
    let nearestDistance = Infinity;
    layoutItems.forEach((item) => {
      const rect = item.rect;
      const verticalDistance = pointerY < rect.top
        ? rect.top - pointerY
        : pointerY > rect.bottom
          ? pointerY - rect.bottom
          : 0;
      if (verticalDistance < nearestDistance) {
        nearestDistance = verticalDistance;
        nearestItem = item;
      }
    });
    const rowCenterY = nearestItem.rect.centerY;
    const rowTiles = layoutItems
      .filter((item) => Math.abs(item.rect.centerY - rowCenterY) <=
        Math.max(8, Math.min(item.rect.height, nearestItem.rect.height) / 2))
      .sort((first, second) => first.rect.left - second.rect.left);
    const insertionAnchor = rowTiles.find((item) => pointerX < item.rect.centerX);
    if (insertionAnchor) {
      return layoutItems.findIndex((item) => item.tile === insertionAnchor.tile);
    }
    const lastRowTile = rowTiles[rowTiles.length - 1];
    return layoutItems.findIndex((item) => item.tile === lastRowTile.tile) + 1;
  }

  function moveShortcutTileElement(tile, targetIndex) {
    if (!shortcutGrid || !tile || tile.parentNode !== shortcutGrid ||
        !Number.isFinite(targetIndex)) {
      return false;
    }
    const currentIndex = getShortcutTileInsertionIndex(tile);
    const remainingTiles = getShortcutReorderTiles().filter((item) => item !== tile);
    const boundedIndex = Math.max(0, Math.min(remainingTiles.length, targetIndex));
    if (currentIndex === boundedIndex) {
      return false;
    }
    shortcutGrid.insertBefore(tile, remainingTiles[boundedIndex] || null);
    refreshShortcutTileCacheFromDom();
    return true;
  }

  function moveShortcutItem(shortcutId, targetIndex) {
    if (!shortcutId || !Number.isFinite(targetIndex)) {
      return false;
    }
    const currentIndex = newtabShortcuts.findIndex((item) => item && item.id === shortcutId);
    if (currentIndex < 0) {
      return false;
    }
    const nextShortcuts = newtabShortcuts.slice();
    const shortcutItem = nextShortcuts.splice(currentIndex, 1)[0];
    const boundedIndex = Math.max(0, Math.min(nextShortcuts.length, targetIndex));
    if (currentIndex === boundedIndex) {
      return false;
    }
    nextShortcuts.splice(boundedIndex, 0, shortcutItem);
    newtabShortcuts = nextShortcuts;
    return true;
  }

  function persistShortcutOrder() {
    const options = getShortcutStoreOptions();
    newtabShortcuts = NEWTAB_SHORTCUTS_STORE.normalizeShortcuts(newtabShortcuts, options);
    if (!storageArea) {
      return Promise.resolve(newtabShortcuts);
    }
    return NEWTAB_SHORTCUTS_STORE.saveShortcuts(storageArea, newtabShortcuts, options).then((items) => {
      newtabShortcuts = Array.isArray(items) ? items : newtabShortcuts;
      return newtabShortcuts;
    });
  }

  function startShortcutDrag(event, tile) {
    if (!shortcutGrid || !tile || !shortcutDragState || shortcutDragState.tile !== tile) {
      return;
    }
    shortcutDragState.isDragging = true;
    hideShortcutTooltip();
    resetShortcutDockHover();
    shortcutGrid.setAttribute('data-shortcut-dragging', 'true');
    tile.setAttribute('data-shortcut-dragging', 'true');
    tile.setAttribute('aria-grabbed', 'true');
    tile.style.pointerEvents = 'none';
    tile.style.willChange = 'transform';
    setShortcutDragTileTransform(shortcutDragState, Number(event.clientX), Number(event.clientY));
    if (typeof tile.setPointerCapture === 'function') {
      try {
        tile.setPointerCapture(event.pointerId);
      } catch (error) {
        // Pointer capture can fail if the browser already canceled the pointer.
      }
    }
  }

  function finishShortcutDrag(event, options) {
    if (!shortcutDragState) {
      return;
    }
    if (event && shortcutDragState.pointerId !== event.pointerId) {
      return;
    }
    const state = shortcutDragState;
    shortcutDragState = null;
    const tile = state.tile;
    if (shortcutGrid) {
      shortcutGrid.removeAttribute('data-shortcut-dragging');
    }
    if (tile) {
      tile.removeAttribute('aria-grabbed');
      if (typeof tile.releasePointerCapture === 'function' && event) {
        try {
          tile.releasePointerCapture(event.pointerId);
        } catch (error) {
          // Ignore stale pointer capture releases.
        }
      }
      if (state.isDragging) {
        settleShortcutDragTile(tile);
      } else {
        tile.removeAttribute('data-shortcut-dragging');
        tile.removeAttribute('data-shortcut-dropping');
        tile.style.pointerEvents = '';
      }
      if (state.isDragging) {
        tile._xShortcutSuppressClick = true;
        window.setTimeout(() => {
          tile._xShortcutSuppressClick = false;
        }, 0);
      }
    }
    if (state.isDragging && state.hasReordered) {
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      persistShortcutOrder().then(() => {
        scheduleWallpaperAdaptiveToneUpdate();
      });
      return;
    }
    if (options && options.cancel) {
      resetShortcutDockHover();
    }
  }

  function handleShortcutDragPointerDown(event) {
    if (isShortcutContextMenuNode(event.target)) {
      return;
    }
    const tile = getShortcutTileFromNode(event.target);
    const shortcutId = getShortcutTileId(tile);
    if (!tile || !shortcutId || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }
    closeShortcutContextMenu();
    shortcutDragState = {
      pointerId: event.pointerId,
      tile,
      shortcutId,
      startX: Number(event.clientX),
      startY: Number(event.clientY),
      grabOffsetX: 0,
      grabOffsetY: 0,
      translateX: 0,
      translateY: 0,
      isDragging: false,
      hasReordered: false
    };
    if (typeof tile.getBoundingClientRect === 'function') {
      const rect = tile.getBoundingClientRect();
      shortcutDragState.grabOffsetX = Number(event.clientX) - rect.left;
      shortcutDragState.grabOffsetY = Number(event.clientY) - rect.top;
    }
    if (typeof tile.setPointerCapture === 'function') {
      try {
        tile.setPointerCapture(event.pointerId);
      } catch (error) {
        // Pointer capture can fail if the browser already canceled the pointer.
      }
    }
  }

  function handleShortcutDragPointerMove(event) {
    if (!shortcutDragState || shortcutDragState.pointerId !== event.pointerId) {
      return;
    }
    const pointerX = Number(event.clientX);
    const pointerY = Number(event.clientY);
    if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
      return;
    }
    const dx = pointerX - shortcutDragState.startX;
    const dy = pointerY - shortcutDragState.startY;
    if (!shortcutDragState.isDragging &&
        Math.hypot(dx, dy) < SHORTCUT_DRAG_START_THRESHOLD_PX) {
      return;
    }
    if (!shortcutDragState.isDragging) {
      startShortcutDrag(event, shortcutDragState.tile);
    }
    if (!shortcutDragState.isDragging) {
      return;
    }
    event.preventDefault();
    setShortcutDragTileTransform(shortcutDragState, pointerX, pointerY);
    const targetIndex = getShortcutDragInsertionIndex(pointerX, pointerY);
    if (targetIndex < 0 || targetIndex === getShortcutTileInsertionIndex(shortcutDragState.tile)) {
      return;
    }
    const beforeRects = getShortcutTileRectMap();
    if (moveShortcutItem(shortcutDragState.shortcutId, targetIndex) &&
        moveShortcutTileElement(shortcutDragState.tile, targetIndex)) {
      animateShortcutLayoutShift(beforeRects, shortcutDragState.tile);
      setShortcutDragTileTransform(shortcutDragState, pointerX, pointerY);
      shortcutDragState.hasReordered = true;
    }
  }

  function handleShortcutDragPointerUp(event) {
    finishShortcutDrag(event);
  }

  function handleShortcutDragPointerCancel(event) {
    finishShortcutDrag(event, { cancel: true });
  }

  function renderShortcutTile(shortcut) {
    const title = getShortcutTitle(shortcut);
    const shortcutHost = shortcut && shortcut.host ? shortcut.host : getHostFromUrl(shortcut && shortcut.url);
    const themeSuggestion = { type: 'shortcut', url: shortcut.url, title };
    const immediateTheme = getImmediateThemeForSuggestion(themeSuggestion);
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'x-nt-shortcut-tile';
    tile.draggable = false;
    tile.setAttribute('data-shortcut-id', shortcut.id || shortcut.url || '');
    tile.setAttribute('data-shortcut-url', shortcut.url || '');
    tile.setAttribute('data-shortcut-title', title);
    tile.setAttribute('data-shortcut-draggable', 'true');
    tile.setAttribute('data-tooltip', title);
    tile.setAttribute('aria-label', formatMessage('open_prefix', '打开 {title}', { title }));
    tile._xHost = shortcutHost;
    tile._xTheme = immediateTheme;
    applyShortcutTileTheme(tile, immediateTheme, shortcutHost);
    queueThemeForTarget(tile, themeSuggestion, (theme) => {
      if (!tile.isConnected) {
        return;
      }
      tile._xTheme = theme || tile._xTheme;
      applyShortcutTileTheme(tile, theme, shortcutHost);
    }, { priority: 0 });
    const activateShortcut = (event) => {
      if (tile._xShortcutSuppressClick) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      hideShortcutTooltip();
      openShortcutUrl(shortcut, event);
    };
    tile.addEventListener('click', activateShortcut);
    tile.addEventListener('auxclick', (event) => {
      if (!isMiddleClick(event)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      openShortcutUrl(shortcut, event);
    });
    tile.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      event.preventDefault();
      activateShortcut(event);
    });
    tile.addEventListener('contextmenu', handleShortcutContextMenu);
    tile.addEventListener('dragstart', handleShortcutNativeDragStart);

    const icon = document.createElement('span');
    icon.className = 'x-nt-shortcut-icon';
    const faviconMask = document.createElement('span');
    faviconMask.className = 'x-nt-shortcut-favicon-mask';
    const img = document.createElement('img');
    img.className = 'x-nt-shortcut-favicon';
    img.alt = '';
    img.loading = 'lazy';
    img.draggable = false;
    img.setAttribute('draggable', 'false');
    attachFaviconWithFallbacks(img, shortcut.url, shortcut.host, {
      primaryUrl: getBrowserPageFaviconUrl(shortcut.url)
    });
    faviconMask.appendChild(img);
    icon.appendChild(faviconMask);

    tile.appendChild(icon);
    shortcutTiles.push(tile);
    bindShortcutTooltip(tile, () => tile.getAttribute('data-shortcut-title') || title, {
      maxWidth: 360
    });
    return tile;
  }

  function renderShortcuts() {
    if (!shortcutGrid || !addShortcutButton) {
      return;
    }
    hideShortcutTooltip();
    closeShortcutContextMenu();
    shortcutGrid.innerHTML = '';
    shortcutTiles.length = 0;
    const items = NEWTAB_SHORTCUTS_STORE.normalizeShortcuts
      ? NEWTAB_SHORTCUTS_STORE.normalizeShortcuts(newtabShortcuts, getShortcutStoreOptions())
      : [];
    newtabShortcuts = items;
    items.forEach((shortcut) => {
      shortcutGrid.appendChild(renderShortcutTile(shortcut));
    });
    shortcutGrid.appendChild(addShortcutButton);
    if (shortcutSection) {
      shortcutSection.setAttribute('data-count', String(items.length));
    }
    applyNewtabShortcutsVisibility();
    updateShortcutLanguageStrings();
    scheduleWallpaperAdaptiveToneUpdate();
  }

  function loadShortcuts() {
    if (!storageArea) {
      newtabShortcuts = typeof NEWTAB_SHORTCUTS_STORE.getDefaultShortcuts === 'function'
        ? NEWTAB_SHORTCUTS_STORE.getDefaultShortcuts(getShortcutStoreOptions())
        : [];
      renderShortcuts();
      return Promise.resolve(newtabShortcuts);
    }
    return NEWTAB_SHORTCUTS_STORE.loadShortcuts(storageArea, getShortcutStoreOptions()).then((items) => {
      newtabShortcuts = Array.isArray(items) ? items : [];
      renderShortcuts();
      return newtabShortcuts;
    });
  }

  function loadNewtabShortcutsVisibility() {
    if (!storageArea) {
      newtabShortcutsVisible = true;
      applyNewtabShortcutsVisibility();
      return Promise.resolve(newtabShortcutsVisible);
    }
    return new Promise((resolve) => {
      storageArea.get([NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY], (result) => {
        const raw = result && result[NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY];
        const nextValue = normalizeNewtabShortcutsVisible(raw);
        newtabShortcutsVisible = nextValue;
        if (raw !== nextValue) {
          storageArea.set({ [NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY]: nextValue });
        }
        applyNewtabShortcutsVisibility();
        resolve(newtabShortcutsVisible);
      });
    });
  }

  function loadVisibleShortcuts() {
    const shortcutsReadyPromise = loadShortcuts();
    return shortcutsReadyPromise;
  }

  function persistShortcuts(nextShortcuts, toastMessage) {
    const options = getShortcutStoreOptions();
    const normalized = NEWTAB_SHORTCUTS_STORE.normalizeShortcuts(nextShortcuts, options);
    if (!storageArea) {
      newtabShortcuts = normalized;
      renderShortcuts();
      if (toastMessage) {
        showToast(toastMessage);
      }
      return Promise.resolve(true);
    }
    return NEWTAB_SHORTCUTS_STORE.saveShortcuts(storageArea, normalized, options).then((items) => {
      newtabShortcuts = Array.isArray(items) ? items : normalized;
      renderShortcuts();
      if (toastMessage) {
        showToast(toastMessage);
      }
      return true;
    });
  }

  function saveNewShortcutFromDialog(title, url) {
    const options = getShortcutStoreOptions();
    const nextShortcut = NEWTAB_SHORTCUTS_STORE.createShortcutRecord({ title, url }, options);
    if (!nextShortcut) {
      setShortcutError(t('newtab_shortcuts_invalid_url', 'Enter a valid http or https URL.'));
      return Promise.resolve(false);
    }
    if (!storageArea) {
      const withoutDuplicate = newtabShortcuts.filter((item) => item && item.url !== nextShortcut.url);
      const nextShortcuts = withoutDuplicate.concat(nextShortcut).slice(-MAX_NEWTAB_SHORTCUTS);
      return persistShortcuts(nextShortcuts, t('newtab_shortcuts_added', 'Shortcut added'));
    }
    return NEWTAB_SHORTCUTS_STORE.saveShortcut(storageArea, { title, url }, options).then((items) => {
      newtabShortcuts = Array.isArray(items) ? items : [];
      renderShortcuts();
      showToast(t('newtab_shortcuts_added', 'Shortcut added'));
      return true;
    });
  }

  function saveEditedShortcutFromDialog(title, url) {
    const currentShortcut = getShortcutById(shortcutDialogEditingId);
    if (!currentShortcut) {
      setShortcutError(t('newtab_shortcuts_invalid_url', 'Enter a valid http or https URL.'));
      return Promise.resolve(false);
    }
    const options = getShortcutStoreOptions();
    const nextShortcut = NEWTAB_SHORTCUTS_STORE.createShortcutRecord({ title, url }, options);
    if (!nextShortcut) {
      setShortcutError(t('newtab_shortcuts_invalid_url', 'Enter a valid http or https URL.'));
      return Promise.resolve(false);
    }
    nextShortcut.id = currentShortcut.id;
    nextShortcut.createdAt = currentShortcut.createdAt;
    nextShortcut.updatedAt = Date.now();
    const nextShortcuts = [];
    newtabShortcuts.forEach((item) => {
      if (!item) {
        return;
      }
      if (item.id === currentShortcut.id) {
        nextShortcuts.push(nextShortcut);
        return;
      }
      if (item.url === nextShortcut.url) {
        return;
      }
      nextShortcuts.push(item);
    });
    return persistShortcuts(nextShortcuts, t('newtab_shortcuts_edited', 'Shortcut updated'));
  }

  function saveShortcutFromDialog(title, url) {
    if (shortcutDialogMode === SHORTCUT_DIALOG_MODE_EDIT) {
      return saveEditedShortcutFromDialog(title, url);
    }
    return saveNewShortcutFromDialog(title, url);
  }

  function removeShortcutById(shortcutId) {
    const id = String(shortcutId || '');
    if (!id) {
      return Promise.resolve(false);
    }
    const nextShortcuts = newtabShortcuts.filter((item) => item && item.id !== id);
    if (nextShortcuts.length === newtabShortcuts.length) {
      return Promise.resolve(false);
    }
    return persistShortcuts(nextShortcuts, t('newtab_shortcuts_removed', 'Shortcut removed'));
  }

  function handleShortcutFormSubmit(event) {
    if (event) {
      event.preventDefault();
    }
    const title = shortcutNameInput ? shortcutNameInput.value : '';
    const url = shortcutUrlInput ? shortcutUrlInput.value : '';
    setShortcutError('');
    if (shortcutDoneButton) {
      shortcutDoneButton.disabled = true;
    }
    saveShortcutFromDialog(title, url).then((saved) => {
      if (saved) {
        closeShortcutDialog({ restoreFocus: true });
      }
    }).finally(() => {
      if (shortcutDoneButton) {
        shortcutDoneButton.disabled = false;
      }
    });
  }

  function createShortcutsSection() {
    shortcutSection = document.createElement('section');
    shortcutSection.id = '_x_extension_newtab_shortcuts_2026_unique_';
    shortcutSection.className = 'x-nt-shortcuts-section';
    shortcutSection.setAttribute('aria-label', t('newtab_shortcuts_section_label', 'Shortcuts'));

    shortcutGrid = document.createElement('div');
    shortcutGrid.className = 'x-nt-shortcuts-grid';

    addShortcutButton = document.createElement('button');
    addShortcutButton.type = 'button';
    addShortcutButton.className = 'x-nt-shortcut-tile x-nt-shortcut-tile--add';
    addShortcutButton.innerHTML = `
      <span class="x-nt-shortcut-icon x-nt-shortcut-icon--add">${getRiSvg('ri-add-line', 'ri-size-28')}</span>
    `;
    bindShortcutTooltip(addShortcutButton, () =>
      addShortcutButton.getAttribute('data-tooltip') || t('newtab_shortcuts_add', 'Add shortcut'), {
        maxWidth: 260
      });
    addShortcutButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      hideShortcutTooltip();
      openShortcutDialog({ sourceElement: event.currentTarget });
    });

    shortcutGrid.appendChild(addShortcutButton);
    shortcutGrid.addEventListener('pointerdown', handleShortcutDragPointerDown);
    shortcutGrid.addEventListener('pointerover', handleShortcutDockPointerOver);
    shortcutGrid.addEventListener('pointermove', handleShortcutDockPointerMove);
    shortcutGrid.addEventListener('pointermove', handleShortcutDragPointerMove);
    shortcutGrid.addEventListener('pointerup', handleShortcutDragPointerUp);
    shortcutGrid.addEventListener('pointercancel', handleShortcutDragPointerCancel);
    shortcutGrid.addEventListener('pointerleave', resetShortcutDockHover);
    shortcutSection.appendChild(shortcutGrid);
    updateShortcutLanguageStrings();
  }

  function createShortcutDialog() {
    shortcutDialogBackdrop = document.createElement('div');
    shortcutDialogBackdrop.className = 'x-nt-shortcut-dialog-backdrop';
    shortcutDialogBackdrop.hidden = true;
    shortcutDialogBackdrop.setAttribute('data-open', 'false');

    shortcutDialog = document.createElement('div');
    shortcutDialog.className = 'x-nt-shortcut-dialog';
    shortcutDialog.setAttribute('role', 'dialog');
    shortcutDialog.setAttribute('aria-modal', 'true');
    shortcutDialog.setAttribute('aria-labelledby', '_x_extension_newtab_shortcut_dialog_title_2026_unique_');

    shortcutForm = document.createElement('form');
    shortcutForm.className = 'x-nt-shortcut-form';
    shortcutForm.addEventListener('submit', handleShortcutFormSubmit);

    shortcutDialogTitle = document.createElement('h2');
    shortcutDialogTitle.id = '_x_extension_newtab_shortcut_dialog_title_2026_unique_';
    shortcutDialogTitle.className = 'x-nt-shortcut-dialog-title';

    const nameField = document.createElement('label');
    nameField.className = 'x-nt-shortcut-field';
    shortcutNameLabel = document.createElement('span');
    const nameInputShell = document.createElement('div');
    nameInputShell.className = '_x_extension_shortcut_input_affix_2026_unique_';
    nameInputShell.setAttribute('data-has-prefix', 'false');
    shortcutNameInput = document.createElement('input');
    shortcutNameInput.type = 'text';
    shortcutNameInput.autocomplete = 'off';
    shortcutNameInput.maxLength = 64;
    shortcutNameInput.className = '_x_extension_shortcut_input_2024_unique_';
    nameInputShell.appendChild(shortcutNameInput);
    nameField.appendChild(shortcutNameLabel);
    nameField.appendChild(nameInputShell);

    const urlField = document.createElement('label');
    urlField.className = 'x-nt-shortcut-field';
    shortcutUrlLabel = document.createElement('span');
    const urlInputShell = document.createElement('div');
    urlInputShell.className = '_x_extension_shortcut_input_affix_2026_unique_';
    urlInputShell.setAttribute('data-has-prefix', 'false');
    shortcutUrlInput = document.createElement('input');
    shortcutUrlInput.type = 'text';
    shortcutUrlInput.inputMode = 'url';
    shortcutUrlInput.autocomplete = 'url';
    shortcutUrlInput.required = true;
    shortcutUrlInput.className = '_x_extension_shortcut_input_2024_unique_';
    urlInputShell.appendChild(shortcutUrlInput);
    urlField.appendChild(shortcutUrlLabel);
    urlField.appendChild(urlInputShell);

    shortcutError = document.createElement('div');
    shortcutError.className = 'x-nt-shortcut-error';
    shortcutError.setAttribute('data-visible', 'false');
    shortcutError.setAttribute('role', 'alert');

    const actions = document.createElement('div');
    actions.className = 'x-nt-shortcut-dialog-actions';
    shortcutCancelButton = document.createElement('button');
    shortcutCancelButton.type = 'button';
    shortcutCancelButton.className = 'x-lumno-action-button x-lumno-action-button--secondary x-nt-shortcut-dialog-button x-nt-shortcut-dialog-button--secondary';
    shortcutCancelButton.addEventListener('click', () => closeShortcutDialog({ restoreFocus: true }));
    shortcutDoneButton = document.createElement('button');
    shortcutDoneButton.type = 'submit';
    shortcutDoneButton.className = 'x-lumno-action-button x-lumno-action-button--primary x-nt-shortcut-dialog-button x-nt-shortcut-dialog-button--primary';
    actions.appendChild(shortcutCancelButton);
    actions.appendChild(shortcutDoneButton);

    shortcutForm.appendChild(shortcutDialogTitle);
    shortcutForm.appendChild(nameField);
    shortcutForm.appendChild(urlField);
    shortcutForm.appendChild(shortcutError);
    shortcutForm.appendChild(actions);
    shortcutDialog.appendChild(shortcutForm);
    shortcutDialogBackdrop.appendChild(shortcutDialog);
    shortcutDialogBackdrop.addEventListener('pointerdown', (event) => {
      if (event.target === shortcutDialogBackdrop) {
        closeShortcutDialog({ restoreFocus: true });
      }
    });
    shortcutDialog.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
    });
    shortcutDialogBackdrop.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeShortcutDialog({ restoreFocus: true });
      }
    });
    updateShortcutDialogLanguageStrings();
  }

  createShortcutsSection();
  createShortcutDialog();

  const bookmarkSection = document.createElement('section');
  bookmarkSection.id = '_x_extension_newtab_bookmarks_2024_unique_';
  setContentSectionVisible(bookmarkSection, false);
  const bookmarkHeader = document.createElement('div');
  bookmarkHeader.className = 'x-nt-bookmarks-header';
  bookmarkTitleWrap = document.createElement('div');
  bookmarkTitleWrap.className = 'x-nt-bookmarks-title-wrap';
  bookmarkHeading = document.createElement('div');
  bookmarkHeading.className = 'x-nt-bookmarks-heading';
  updateBookmarkHeading();
  bookmarkBreadcrumb = document.createElement('div');
  bookmarkBreadcrumb.className = 'x-nt-bookmarks-breadcrumb';
  bookmarkBreadcrumb.style.setProperty('display', 'none');
  bookmarkModeMenu = createSectionModeSelect({
    id: '_x_extension_newtab_bookmark_mode_2026_unique_',
    menuTitleKey: 'display_mode_title',
    menuTitleFallback: 'Display mode',
    getValue: () => currentBookmarkViewMode,
    onChange: setBookmarkViewMode,
    options: [
      {
        value: 'folder',
        labelKey: 'bookmark_view_mode_folder',
        fallback: 'Multi-layer folder view'
      },
      {
        value: 'list',
        labelKey: 'bookmark_view_mode_list',
        fallback: 'Multi-level list view'
      }
    ]
  });
  const bookmarkPager = document.createElement('div');
  bookmarkPager.className = 'x-nt-bookmarks-pager';
  bookmarkPagerPrevButton = document.createElement('button');
  bookmarkPagerPrevButton.type = 'button';
  bookmarkPagerPrevButton.className = 'x-nt-bookmarks-pager-btn';
  bookmarkPagerPrevButton.innerHTML = getRiSvg('ri-arrow-left-s-line', 'ri-size-16');
  bookmarkPagerNextButton = document.createElement('button');
  bookmarkPagerNextButton.type = 'button';
  bookmarkPagerNextButton.className = 'x-nt-bookmarks-pager-btn';
  bookmarkPagerNextButton.innerHTML = getRiSvg('ri-arrow-right-s-line', 'ri-size-16');
  bookmarkOpenManagerButton = document.createElement('button');
  bookmarkOpenManagerButton.type = 'button';
  bookmarkOpenManagerButton.className = 'x-nt-bookmarks-pager-btn';
  bookmarkOpenManagerButton.innerHTML = getRiSvg('ri-bookmark-line', 'ri-size-16');
  bookmarkPager.appendChild(bookmarkPagerPrevButton);
  bookmarkPager.appendChild(bookmarkPagerNextButton);
  bookmarkPager.appendChild(bookmarkOpenManagerButton);
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
  bookmarkTitleWrap.appendChild(bookmarkHeading);
  if (bookmarkModeMenu) {
    bookmarkTitleWrap.appendChild(bookmarkModeMenu.control);
  }
  bookmarkTitleWrap.appendChild(bookmarkBreadcrumb);
  bookmarkHeader.appendChild(bookmarkTitleWrap);
  bookmarkHeader.appendChild(bookmarkPager);
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
  bookmarkGrid = document.createElement('div');
  bookmarkGrid.id = '_x_extension_newtab_bookmarks_grid_2024_unique_';
  bookmarkGrid.setAttribute('data-view-mode', currentBookmarkViewMode);
  bookmarkGrid.addEventListener('pointerdown', handleBookmarkDragPointerDown, true);
  bookmarkGrid.addEventListener('pointermove', handleBookmarkDragPointerMove);
  bookmarkGrid.addEventListener('pointerup', handleBookmarkDragPointerUp);
  bookmarkGrid.addEventListener('pointercancel', handleBookmarkDragPointerCancel);
  applyBookmarkGridColumns();
  bookmarksView = NEWTAB_BOOKMARKS_VIEW.createBookmarksView({
    documentObj: document,
    windowObj: window,
    grid: bookmarkGrid,
    cards: bookmarkCards,
    cardElementCache: bookmarkCardElementCache,
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
    navigateToUrl,
    openUrl: openUrlFromNewtabCard
  });
  bookmarkCascadeRuntime = NEWTAB_BOOKMARK_CASCADE_MENU.createBookmarkCascadeMenuRuntime({
    documentObj: document,
    windowObj: window,
    storageArea,
    debugStorageKey: BOOKMARK_CASCADE_DEBUG_STORAGE_KEY,
    positionUtils: NEWTAB_BOOKMARK_CASCADE_POSITION,
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
    ensureReady: ensureBookmarkTreeCache,
    getItems: (folderId) => {
      const id = String(folderId || '');
      return id ? (bookmarkFolderItemsCache.get(id) || []) : [];
    },
    navigateToUrl,
    openUrl: openUrlFromNewtabCard,
    shouldSuppressHover: shouldSuppressBookmarkHover,
    bindCursorTooltip,
    hideCursorTooltip,
    showTopActionTooltip,
    hideTopActionTooltip
  });
  bookmarkSection.appendChild(bookmarkHeader);
  bookmarkSection.appendChild(bookmarkGrid);
  let bookmarkRenderSignature = '';
  let bookmarkLoadToken = 0;
  let bookmarkDataDirty = true;
  let bookmarkLoadedOnce = false;

  const recentSection = document.createElement('section');
  recentSection.id = '_x_extension_newtab_recent_sites_2024_unique_';
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
  recentHeader = document.createElement('div');
  recentHeader.className = 'x-nt-recent-header-bar';
  recentHeading = document.createElement('div');
  recentHeading.className = 'x-nt-recent-heading';
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
  recentGrid = document.createElement('div');
  recentGrid.id = '_x_extension_newtab_recent_sites_grid_2024_unique_';
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
    canDismiss: canDismissRecentCard,
    getDismissTooltip: getRecentDismissTooltip,
    updatePinButton: updateRecentPinButton,
    updateDismissButton: updateRecentDismissButton,
    showToast,
    showTopActionTooltip,
    hideTopActionTooltip,
    navigateToUrl,
    bindCursorTooltip,
    hideCursorTooltip,
    openUrl: openUrlFromNewtabCard,
    togglePinned: togglePinnedRecentSite,
    hideTemporarily: hideRecentSiteTemporarily
  });
  recentHeader.appendChild(recentHeading);
  if (recentModeMenu) {
    recentHeader.appendChild(recentModeMenu.control);
  }
  recentSection.appendChild(recentHeader);
  recentSection.appendChild(recentGrid);
  let recentRenderSignature = '';
  let recentLoadToken = 0;
  let recentDataDirty = true;
  let recentLoadedOnce = false;
  const bottomDockRuntime = NEWTAB_DOCK.createBottomDockRuntime({
    documentObj: document,
    windowObj: window,
    layoutRuntime: NEWTAB_LAYOUT,
    root,
    searchLayer: () => searchLayer,
    inputParts: () => inputParts,
    wordmarkContainer: () => wordmarkContainer,
    shortcutSection: () => shortcutSection,
    bookmarkSection,
    recentSection,
    suggestionsContainer,
    suggestionsSurface,
    suggestionsOutline,
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
      shortViewportMaxHeightPx: SEARCH_LAYOUT_SHORT_VIEWPORT_MAX_HEIGHT_PX,
      shortMinTopPx: SEARCH_LAYOUT_SHORT_MIN_TOP_PX,
      mobileFlowBreakpointPx: NEWTAB_MOBILE_FLOW_BREAKPOINT_PX
    }
  });
  const bottomDock = bottomDockRuntime.element;
  layoutController = bottomDockRuntime.layoutController;
  applyNewtabWidthMode();

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

  function getBookmarkPageCount() {
    const total = Array.isArray(bookmarkAllItems) ? bookmarkAllItems.length : 0;
    return Math.max(1, Math.ceil(total / getBookmarkLimit()));
  }

  function getBookmarkPageItems() {
    if (!Array.isArray(bookmarkAllItems) || bookmarkAllItems.length === 0) {
      return [];
    }
    const pageCount = getBookmarkPageCount();
    bookmarkCurrentPage = Math.min(Math.max(0, bookmarkCurrentPage), pageCount - 1);
    return NEWTAB_BOOKMARKS_STORE.getBookmarkPageItems(
      bookmarkAllItems,
      bookmarkCurrentPage,
      getBookmarkLimit()
    );
  }

  function setBookmarkPagerButtonAvailability(button, available) {
    if (!button) {
      return;
    }
    const enabled = Boolean(available);
    button.removeAttribute('disabled');
    button.setAttribute('aria-disabled', enabled ? 'false' : 'true');
    button.tabIndex = enabled ? 0 : -1;
    if (!enabled && document.activeElement === button) {
      button.blur();
      hideTopActionTooltip();
    }
  }

  function updateBookmarkPagerState() {
    if (!bookmarkPagerPrevButton || !bookmarkPagerNextButton) {
      return;
    }
    const pageCount = getBookmarkPageCount();
    const atStart = bookmarkCurrentPage <= 0;
    const atEnd = bookmarkCurrentPage >= (pageCount - 1);
    setBookmarkPagerButtonAvailability(bookmarkPagerPrevButton, !atStart);
    setBookmarkPagerButtonAvailability(bookmarkPagerNextButton, !atEnd);
  }

  function updateBookmarkGridHeightLock() {
    if (!bookmarkGrid) {
      return;
    }
    const total = Array.isArray(bookmarkAllItems) ? bookmarkAllItems.length : 0;
    const cols = getBookmarkGridColumnCount();
    const firstCard = bookmarkGrid.querySelector('.x-nt-bookmark-card');
    const cardHeight = firstCard ? firstCard.getBoundingClientRect().height : 51;
    const gridStyle = window.getComputedStyle(bookmarkGrid);
    const rowGap = Number.parseFloat(gridStyle.rowGap) || 16;
    const isAtRoot = String(bookmarkCurrentFolderId || '') === String(bookmarkRootFolderId || '1');
    const pageLimit = getBookmarkLimit();
    let targetItemCount = 0;

    if (isAtRoot) {
      if (total <= pageLimit) {
        bookmarkGrid.style.removeProperty('min-height');
        return;
      }
      targetItemCount = pageLimit;
    } else {
      if (bookmarkRootTotalCount > pageLimit) {
        targetItemCount = pageLimit;
      } else {
        targetItemCount = Math.max(0, bookmarkRootVisibleCount);
      }
      if (targetItemCount <= 0) {
        if (total <= pageLimit) {
          bookmarkGrid.style.removeProperty('min-height');
          return;
        }
        targetItemCount = pageLimit;
      }
    }

    const rowsPerPage = Math.max(1, Math.ceil(targetItemCount / cols));
    const minHeight = (rowsPerPage * cardHeight) + ((rowsPerPage - 1) * rowGap);
    bookmarkGrid.style.setProperty('min-height', `${Math.ceil(minHeight)}px`);
  }

  function renderCurrentBookmarkPage() {
    renderBookmarks(getBookmarkPageItems());
    updateBookmarkPagerState();
  }

  function switchBookmarkPage(nextPage) {
    const pageCount = getBookmarkPageCount();
    const targetPage = Math.min(Math.max(0, Number(nextPage) || 0), pageCount - 1);
    if (targetPage === bookmarkCurrentPage) {
      return;
    }
    if (bookmarkPageAnimating) {
      return;
    }
    if (!bookmarkGrid) {
      bookmarkCurrentPage = targetPage;
      renderCurrentBookmarkPage();
      updateBookmarkSectionPosition();
      return;
    }
    const direction = targetPage > bookmarkCurrentPage ? 1 : -1;
    const offsetPx = 34;
    const durationMs = 220;
    const fadeBlurDurationMs = 150;
    const colStaggerMs = 24;
    const rowStaggerMs = 10;
    const randomJitterRangeMs = 6;
    const handoffOverlapMs = 70;
    const cols = getBookmarkGridColumnCount();
    const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';
    bookmarkPageAnimating = true;
    const getCards = () => Array.from(bookmarkGrid.children || []);
    const getDelayByIndex = (card, index, pageSeed) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const seedText = `${pageSeed || 0}|${index}|${card && card._xTitleText ? card._xTitleText : ''}`;
      const seed = Math.abs(stableHashCode(seedText));
      const jitter = (seed % (randomJitterRangeMs * 2 + 1)) - randomJitterRangeMs;
      return Math.max(0, (col * colStaggerMs) + (row * rowStaggerMs) + jitter);
    };

    const cleanupCards = (cards) => {
      cards.forEach((card) => {
        card.style.removeProperty('transition');
        card.style.removeProperty('transform');
        card.style.removeProperty('opacity');
        card.style.removeProperty('filter');
        card.style.removeProperty('will-change');
      });
    };

    const cleanup = (cards) => {
      cleanupCards(cards);
      bookmarkPageAnimating = false;
    };

    const enterNextPage = () => {
      bookmarkCurrentPage = targetPage;
      renderCurrentBookmarkPage();
      updateBookmarkSectionPosition();
      const nextCards = getCards();
      if (nextCards.length === 0) {
        cleanup(nextCards);
        return;
      }
      nextCards.forEach((card, index) => {
        card.style.setProperty('will-change', 'transform, opacity, filter');
        card.style.setProperty('transition', 'none');
        card.style.setProperty('opacity', '0');
        card.style.setProperty('filter', 'blur(5px)');
        card.style.setProperty('transform', `translateX(${direction * offsetPx}px)`);
      });
      void bookmarkGrid.offsetHeight;
      let maxInDelay = 0;
      nextCards.forEach((card, index) => {
        const delay = getDelayByIndex(card, index, targetPage);
        if (delay > maxInDelay) {
          maxInDelay = delay;
        }
        card.style.setProperty(
          'transition',
          `transform ${durationMs}ms ${easing} ${delay}ms, opacity ${fadeBlurDurationMs}ms ${easing} ${delay}ms, filter ${fadeBlurDurationMs}ms ${easing} ${delay}ms`
        );
        card.style.setProperty('opacity', '1');
        card.style.setProperty('filter', 'blur(0px)');
        card.style.setProperty('transform', 'translateX(0)');
      });
      const inTotalMs = durationMs + maxInDelay;
      window.setTimeout(() => cleanup(nextCards), inTotalMs + 20);
    };

    const currentCards = getCards();
    if (currentCards.length === 0) {
      enterNextPage();
      return;
    }
    let maxOutDelay = 0;
    currentCards.forEach((card, index) => {
      const delay = getDelayByIndex(card, index, bookmarkCurrentPage);
      if (delay > maxOutDelay) {
        maxOutDelay = delay;
      }
      card.style.setProperty('will-change', 'transform, opacity, filter');
      card.style.setProperty(
        'transition',
        `transform ${durationMs}ms ${easing} ${delay}ms, opacity ${fadeBlurDurationMs}ms ${easing} ${delay}ms, filter ${fadeBlurDurationMs}ms ${easing} ${delay}ms`
      );
      card.style.setProperty('opacity', '0');
      card.style.setProperty('filter', 'blur(5px)');
      card.style.setProperty('transform', `translateX(${direction * -offsetPx}px)`);
    });
    const outTotalMs = durationMs + maxOutDelay;
    const handoffDelayMs = Math.max(0, outTotalMs - handoffOverlapMs);
    window.setTimeout(() => {
      cleanupCards(currentCards);
      enterNextPage();
    }, handoffDelayMs);
  }

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

  function updateBookmarkSectionPosition() {
    if (layoutController && typeof layoutController.updateBottomDockLayout === 'function') {
      layoutController.updateBottomDockLayout({
        preserveSearchEntryLayout: shouldPreserveSearchEntryLayout(),
        onRecentHidden: () => {
          recentMouseInsideSection = false;
          recentMouseLeftAt = 0;
        }
      });
    }
    rememberSearchEntryViewport();
    scheduleWallpaperAdaptiveToneUpdate();
  }

  function updateSearchEntryLayout() {
    if (layoutController && typeof layoutController.updateSearchEntryLayout === 'function') {
      layoutController.updateSearchEntryLayout();
    }
  }

  function getBookmarkCardFromNode(node) {
    return node && typeof node.closest === 'function'
      ? node.closest('.x-nt-bookmark-card')
      : null;
  }

  function getBookmarkCardId(card) {
    return card && typeof card.getAttribute === 'function'
      ? card.getAttribute('data-bookmark-id') || ''
      : '';
  }

  function getBookmarkCardParentId(card) {
    return card && typeof card.getAttribute === 'function'
      ? card.getAttribute('data-bookmark-parent-id') || ''
      : '';
  }

  function getBookmarkReorderCards() {
    return bookmarkGrid
      ? Array.from(bookmarkGrid.querySelectorAll('.x-nt-bookmark-card[data-bookmark-draggable="true"]'))
      : [];
  }

  function getBookmarkCardInsertionIndex(card) {
    if (!card) {
      return -1;
    }
    return getBookmarkReorderCards().indexOf(card);
  }

  function getBookmarkCardAllIndex(bookmarkId) {
    const id = String(bookmarkId || '');
    return id
      ? bookmarkAllItems.findIndex((item) => item && String(item.id || '') === id)
      : -1;
  }

  function getBookmarkPageStartIndex() {
    return Math.max(0, bookmarkCurrentPage * getBookmarkLimit());
  }

  function getBookmarkCardLayoutRect(card) {
    if (!card || !bookmarkGrid || typeof card.offsetLeft !== 'number' ||
        typeof card.offsetTop !== 'number') {
      return null;
    }
    const offsetParent = card.offsetParent && typeof card.offsetParent.getBoundingClientRect === 'function'
      ? card.offsetParent
      : bookmarkGrid;
    const parentRect = typeof offsetParent.getBoundingClientRect === 'function'
      ? offsetParent.getBoundingClientRect()
      : { left: 0, top: 0 };
    const width = Number(card.offsetWidth) || 0;
    const height = Number(card.offsetHeight) || 0;
    const left = parentRect.left + card.offsetLeft;
    const top = parentRect.top + card.offsetTop;
    return {
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
      centerX: left + (width / 2),
      centerY: top + (height / 2)
    };
  }

  function clearBookmarkCardLayoutAnimation(card) {
    if (!card || !card.style) {
      return;
    }
    if (card._xBookmarkLayoutAnimationTimer) {
      window.clearTimeout(card._xBookmarkLayoutAnimationTimer);
      card._xBookmarkLayoutAnimationTimer = 0;
    }
    card.style.removeProperty('transition');
    if (card.getAttribute && card.getAttribute('data-bookmark-dragging') !== 'true' &&
        card.getAttribute('data-bookmark-dropping') !== 'true') {
      card.style.removeProperty('transform');
    }
  }

  function getBookmarkCachedRectMap(state) {
    const rects = new Map();
    const layoutItems = Array.isArray(state && state.layoutItems) ? state.layoutItems : [];
    layoutItems.forEach((item) => {
      if (item && item.card && item.rect) {
        rects.set(item.card, item.rect);
      }
    });
    return rects;
  }

  function animateBookmarkLayoutShift(beforeRects, draggedCard) {
    if (!beforeRects || !bookmarkGrid) {
      return;
    }
    const cardsToAnimate = getBookmarkReorderCards().filter((card) =>
      card && card !== draggedCard && card.style && beforeRects.has(card)
    );
    cardsToAnimate.forEach(clearBookmarkCardLayoutAnimation);
    const shifts = [];
    cardsToAnimate.forEach((card) => {
      const before = beforeRects.get(card);
      const after = getBookmarkCardLayoutRect(card);
      if (!before || !after) {
        return;
      }
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        return;
      }
      shifts.push({ card, dx, dy });
    });
    shifts.forEach(({ card, dx, dy }) => {
      card.style.transition = 'none';
      card.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    });
    window.requestAnimationFrame(() => {
      shifts.forEach(({ card }) => {
        if (!card.isConnected) {
          return;
        }
        card.style.transition = `transform ${BOOKMARK_REORDER_ANIMATION_MS}ms ${BOOKMARK_REORDER_EASING}`;
        card.style.transform = 'translate3d(0, 0, 0)';
        card._xBookmarkLayoutAnimationTimer = window.setTimeout(() => {
          card._xBookmarkLayoutAnimationTimer = 0;
          clearBookmarkCardLayoutAnimation(card);
        }, BOOKMARK_REORDER_ANIMATION_MS + 80);
      });
    });
  }

  function updateBookmarkDragLayoutCache(state) {
    if (!state || !state.card) {
      return;
    }
    const draggedCard = state.card;
    state.layoutItems = getBookmarkReorderCards()
      .filter((card) => card && card !== draggedCard)
      .map((card) => ({
        card,
        rect: getBookmarkCardLayoutRect(card)
      }))
      .filter((item) => item.rect && item.rect.width > 0 && item.rect.height > 0);
    const draggedLayoutRect = getBookmarkCardLayoutRect(draggedCard);
    if (draggedLayoutRect) {
      state.baseLeft = draggedLayoutRect.left;
      state.baseTop = draggedLayoutRect.top;
    }
  }

  function cancelBookmarkDragMoveFrame(state) {
    if (!state || !state.moveFrameId) {
      return;
    }
    window.cancelAnimationFrame(state.moveFrameId);
    state.moveFrameId = 0;
  }

  function setBookmarkDragCardTransform(state, pointerX, pointerY) {
    if (!state || !state.card || !state.card.style) {
      return;
    }
    const baseLeft = Number(state.baseLeft) || 0;
    const baseTop = Number(state.baseTop) || 0;
    const nextX = pointerX - state.grabOffsetX - baseLeft;
    const nextY = pointerY - state.grabOffsetY - baseTop;
    state.translateX = nextX;
    state.translateY = nextY;
    state.card.style.transition = 'none';
    state.card.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`;
  }

  function settleBookmarkDragCard(card) {
    if (!card || !card.style) {
      return;
    }
    card.setAttribute('data-bookmark-dropping', 'true');
    card.style.pointerEvents = '';
    card.style.transition = `transform ${BOOKMARK_DROP_ANIMATION_MS}ms ${BOOKMARK_REORDER_EASING}`;
    card.style.transform = 'translate3d(0, 0, 0)';
    if (card._xBookmarkDropTimer) {
      window.clearTimeout(card._xBookmarkDropTimer);
    }
    card._xBookmarkDropTimer = window.setTimeout(() => {
      card._xBookmarkDropTimer = 0;
      card.removeAttribute('data-bookmark-dragging');
      card.removeAttribute('data-bookmark-dropping');
      card.style.removeProperty('transition');
      card.style.removeProperty('transform');
      card.style.removeProperty('will-change');
      card.style.pointerEvents = '';
    }, BOOKMARK_DROP_ANIMATION_MS + 90);
  }

  function getBookmarkDragInsertionIndex(pointerX, pointerY) {
    if (!bookmarkGrid || !bookmarkDragState || !Number.isFinite(pointerX) ||
        !Number.isFinite(pointerY)) {
      return -1;
    }
    const layoutItems = Array.isArray(bookmarkDragState.layoutItems)
      ? bookmarkDragState.layoutItems
      : [];
    if (!layoutItems.length) {
      return 0;
    }
    let nearestItem = layoutItems[0];
    let nearestDistance = Infinity;
    layoutItems.forEach((item) => {
      const rect = item.rect;
      const verticalDistance = pointerY < rect.top
        ? rect.top - pointerY
        : pointerY > rect.bottom
          ? pointerY - rect.bottom
          : 0;
      if (verticalDistance < nearestDistance) {
        nearestDistance = verticalDistance;
        nearestItem = item;
      }
    });
    const rowCenterY = nearestItem.rect.centerY;
    const rowCards = layoutItems
      .filter((item) => Math.abs(item.rect.centerY - rowCenterY) <=
        Math.max(8, Math.min(item.rect.height, nearestItem.rect.height) / 2))
      .sort((first, second) => first.rect.left - second.rect.left);
    const insertionAnchor = rowCards.find((item) => pointerX < item.rect.centerX);
    if (insertionAnchor) {
      return layoutItems.findIndex((item) => item.card === insertionAnchor.card);
    }
    const lastRowCard = rowCards[rowCards.length - 1];
    return layoutItems.findIndex((item) => item.card === lastRowCard.card) + 1;
  }

  function processBookmarkDragMove(state) {
    if (!state || bookmarkDragState !== state || !state.isDragging) {
      return;
    }
    state.moveFrameId = 0;
    const pointerX = Number(state.pendingPointerX);
    const pointerY = Number(state.pendingPointerY);
    if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
      return;
    }
    setBookmarkDragCardTransform(state, pointerX, pointerY);
    const targetPageIndex = getBookmarkDragInsertionIndex(pointerX, pointerY);
    const currentPageIndex = Number.isFinite(state.pageIndex)
      ? state.pageIndex
      : getBookmarkCardInsertionIndex(state.card);
    if (targetPageIndex < 0 || targetPageIndex === currentPageIndex) {
      return;
    }
    const targetAllIndex = getBookmarkPageStartIndex() + targetPageIndex;
    const beforeRects = getBookmarkCachedRectMap(state);
    if (moveBookmarkItemInMemory(state.bookmarkId, targetAllIndex) &&
        moveBookmarkCardElement(state.card, targetPageIndex)) {
      animateBookmarkLayoutShift(beforeRects, state.card);
      updateBookmarkDragLayoutCache(state);
      setBookmarkDragCardTransform(state, pointerX, pointerY);
      state.pageIndex = targetPageIndex;
      state.hasReordered = true;
    }
  }

  function scheduleBookmarkDragMove(state, pointerX, pointerY) {
    if (!state || !state.isDragging) {
      return;
    }
    state.pendingPointerX = pointerX;
    state.pendingPointerY = pointerY;
    if (state.moveFrameId) {
      return;
    }
    state.moveFrameId = window.requestAnimationFrame(() => {
      processBookmarkDragMove(state);
    });
  }

  function moveBookmarkCardElement(card, targetIndex) {
    if (!bookmarkGrid || !card || card.parentNode !== bookmarkGrid ||
        !Number.isFinite(targetIndex)) {
      return false;
    }
    const currentIndex = getBookmarkCardInsertionIndex(card);
    const remainingCards = getBookmarkReorderCards().filter((item) => item !== card);
    const boundedIndex = Math.max(0, Math.min(remainingCards.length, targetIndex));
    if (currentIndex === boundedIndex) {
      return false;
    }
    bookmarkGrid.insertBefore(card, remainingCards[boundedIndex] || null);
    return true;
  }

  function moveBookmarkItemInMemory(bookmarkId, targetAllIndex) {
    const currentIndex = getBookmarkCardAllIndex(bookmarkId);
    if (currentIndex < 0 || !Number.isFinite(targetAllIndex)) {
      return false;
    }
    const nextItems = bookmarkAllItems.slice();
    const movedItem = nextItems.splice(currentIndex, 1)[0];
    const boundedIndex = Math.max(0, Math.min(nextItems.length, targetAllIndex));
    if (currentIndex === boundedIndex) {
      return false;
    }
    nextItems.splice(boundedIndex, 0, movedItem);
    bookmarkAllItems = nextItems;
    return true;
  }

  function getBookmarkMoveDestination(bookmarkId) {
    const movedIndex = getBookmarkCardAllIndex(bookmarkId);
    if (movedIndex < 0) {
      return null;
    }
    const movedItem = bookmarkAllItems[movedIndex];
    const parentId = String((movedItem && movedItem.parentId) || bookmarkCurrentFolderId || '');
    const sourceIndex = Number(movedItem && movedItem.index);
    if (!parentId) {
      return null;
    }
    const afterItem = bookmarkAllItems.slice(movedIndex + 1).find((item) =>
      item && String(item.parentId || parentId) === parentId && Number.isFinite(Number(item.index))
    );
    let destinationIndex = 0;
    if (afterItem) {
      destinationIndex = Number(afterItem.index);
    } else {
      const beforeItems = bookmarkAllItems.slice(0, movedIndex).reverse();
      const beforeItem = beforeItems.find((item) =>
        item && String(item.parentId || parentId) === parentId && Number.isFinite(Number(item.index))
      );
      destinationIndex = beforeItem ? Number(beforeItem.index) + 1 : 0;
    }
    if (Number.isFinite(sourceIndex) && sourceIndex < destinationIndex) {
      destinationIndex -= 1;
    }
    return {
      parentId,
      index: Math.max(0, Math.round(destinationIndex))
    };
  }

  function moveChromeBookmarkNode(bookmarkId, destination) {
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.bookmarks || typeof chrome.bookmarks.move !== 'function' ||
          !bookmarkId || !destination) {
        reject(new Error('Chrome bookmarks.move is unavailable.'));
        return;
      }
      chrome.bookmarks.move(String(bookmarkId), {
        parentId: String(destination.parentId || ''),
        index: Math.max(0, Number(destination.index) || 0)
      }, (node) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || 'Failed to move bookmark.'));
          return;
        }
        resolve(node);
      });
    });
  }

  function persistBookmarkDragOrder(state) {
    if (!state || !state.bookmarkId) {
      return Promise.resolve(false);
    }
    const destination = getBookmarkMoveDestination(state.bookmarkId);
    if (!destination) {
      return Promise.resolve(false);
    }
    return moveChromeBookmarkNode(state.bookmarkId, destination).then(() => {
      markBookmarkTreeDirty();
      loadBookmarks({ force: true });
      return true;
    }).catch((error) => {
      console.warn('[Lumno] Failed to reorder bookmark', error);
      markBookmarkTreeDirty();
      loadBookmarks({ force: true });
      return false;
    });
  }

  function isBookmarkDragActive() {
    return Boolean(
      (bookmarkDragState && bookmarkDragState.isDragging) ||
      (bookmarkGrid && bookmarkGrid.getAttribute('data-bookmark-dragging') === 'true')
    );
  }

  function isBookmarkReorderInteractionActive() {
    return Boolean(bookmarkDragState || isBookmarkDragActive());
  }

  function shouldSuppressBookmarkHover(target) {
    return Boolean(
      target &&
      isBookmarkReorderInteractionActive() &&
      (
        (target.classList &&
          typeof target.classList.contains === 'function' &&
          target.classList.contains('x-nt-bookmark-card')) ||
        (typeof target.closest === 'function' &&
          target.closest('.x-nt-bookmark-card, .x-nt-bookmark-cascade-item'))
      )
    );
  }

  function startBookmarkDrag(event, card) {
    if (!bookmarkGrid || !card || !bookmarkDragState || bookmarkDragState.card !== card) {
      return;
    }
    bookmarkDragState.isDragging = true;
    hideCursorTooltip();
    closeBookmarkCascadeMenu();
    bookmarkGrid.setAttribute('data-bookmark-dragging', 'true');
    card.setAttribute('data-bookmark-dragging', 'true');
    card.setAttribute('aria-grabbed', 'true');
    if (typeof card._xDeactivateBookmarkHoverVisual === 'function') {
      card._xDeactivateBookmarkHoverVisual();
    }
    card.style.pointerEvents = 'none';
    card.style.willChange = 'transform';
    updateBookmarkDragLayoutCache(bookmarkDragState);
    setBookmarkDragCardTransform(bookmarkDragState, Number(event.clientX), Number(event.clientY));
    if (typeof card.setPointerCapture === 'function') {
      try {
        card.setPointerCapture(event.pointerId);
      } catch (error) {
        // Pointer capture can fail if the browser already canceled the pointer.
      }
    }
  }

  function finishBookmarkDrag(event) {
    if (!bookmarkDragState) {
      return;
    }
    if (event && bookmarkDragState.pointerId !== event.pointerId) {
      return;
    }
    const state = bookmarkDragState;
    if (state.isDragging && state.moveFrameId) {
      cancelBookmarkDragMoveFrame(state);
      processBookmarkDragMove(state);
    }
    bookmarkDragState = null;
    const card = state.card;
    if (bookmarkGrid) {
      bookmarkGrid.removeAttribute('data-bookmark-dragging');
    }
    if (card) {
      card.removeAttribute('aria-grabbed');
      if (typeof card.releasePointerCapture === 'function' && event) {
        try {
          card.releasePointerCapture(event.pointerId);
        } catch (error) {
          // Ignore stale pointer capture releases.
        }
      }
      if (state.isDragging) {
        settleBookmarkDragCard(card);
      } else {
        card.removeAttribute('data-bookmark-dragging');
        card.removeAttribute('data-bookmark-dropping');
        card.style.pointerEvents = '';
      }
      if (state.isDragging) {
        card._xBookmarkSuppressClick = true;
        window.setTimeout(() => {
          card._xBookmarkSuppressClick = false;
        }, 0);
      }
    }
    if (state.isDragging && state.hasReordered) {
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      persistBookmarkDragOrder(state);
    }
  }

  function handleBookmarkDragPointerDown(event) {
    if (bookmarkPageAnimating) {
      return;
    }
    const card = getBookmarkCardFromNode(event.target);
    const bookmarkId = getBookmarkCardId(card);
    const parentId = getBookmarkCardParentId(card);
    if (!card || !bookmarkId || !parentId ||
        card.getAttribute('data-bookmark-draggable') !== 'true' ||
        (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }
    hideCursorTooltip();
    closeBookmarkCascadeMenu();
    bookmarkDragState = {
      pointerId: event.pointerId,
      card,
      bookmarkId,
      parentId,
      startX: Number(event.clientX),
      startY: Number(event.clientY),
      grabOffsetX: 0,
      grabOffsetY: 0,
      baseLeft: 0,
      baseTop: 0,
      translateX: 0,
      translateY: 0,
      pendingPointerX: Number(event.clientX),
      pendingPointerY: Number(event.clientY),
      moveFrameId: 0,
      pageIndex: getBookmarkCardInsertionIndex(card),
      layoutItems: [],
      isDragging: false,
      hasReordered: false
    };
    const rect = getBookmarkCardLayoutRect(card) ||
      (typeof card.getBoundingClientRect === 'function' ? card.getBoundingClientRect() : null);
    if (rect) {
      bookmarkDragState.grabOffsetX = Number(event.clientX) - rect.left;
      bookmarkDragState.grabOffsetY = Number(event.clientY) - rect.top;
      bookmarkDragState.baseLeft = rect.left;
      bookmarkDragState.baseTop = rect.top;
    }
    if (typeof card._xDeactivateBookmarkHoverVisual === 'function') {
      card._xDeactivateBookmarkHoverVisual();
    }
    if (typeof card.setPointerCapture === 'function') {
      try {
        card.setPointerCapture(event.pointerId);
      } catch (error) {
        // Pointer capture can fail if the browser already canceled the pointer.
      }
    }
  }

  function handleBookmarkDragPointerMove(event) {
    if (!bookmarkDragState || bookmarkDragState.pointerId !== event.pointerId) {
      return;
    }
    const pointerX = Number(event.clientX);
    const pointerY = Number(event.clientY);
    if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
      return;
    }
    const dx = pointerX - bookmarkDragState.startX;
    const dy = pointerY - bookmarkDragState.startY;
    if (!bookmarkDragState.isDragging &&
        Math.hypot(dx, dy) < BOOKMARK_DRAG_START_THRESHOLD_PX) {
      return;
    }
    if (!bookmarkDragState.isDragging) {
      startBookmarkDrag(event, bookmarkDragState.card);
    }
    if (!bookmarkDragState.isDragging) {
      return;
    }
    event.preventDefault();
    scheduleBookmarkDragMove(bookmarkDragState, pointerX, pointerY);
  }

  function handleBookmarkDragPointerUp(event) {
    finishBookmarkDrag(event);
  }

  function handleBookmarkDragPointerCancel(event) {
    finishBookmarkDrag(event);
  }

  function renderBookmarks(items) {
    const normalizedItems = Array.isArray(items) ? items : [];
    const isAtRoot = String(bookmarkCurrentFolderId || '') === String(bookmarkRootFolderId || '1');
    const renderResult = bookmarksView.render(normalizedItems, {
      signature: bookmarkRenderSignature,
      folderId: bookmarkCurrentFolderId,
      rootFolderId: bookmarkRootFolderId,
      viewMode: currentBookmarkViewMode,
      menuMode: currentBookmarkViewMode === 'list'
    });
    if (!renderResult.changed) {
      if (normalizedItems.length === 0) {
        if (isAtRoot) {
          setContentSectionVisible(bookmarkSection, false);
        } else {
          setContentSectionVisible(bookmarkSection, true);
        }
      } else {
        setContentSectionVisible(bookmarkSection, true);
        updateBookmarkGridHeightLock();
        updateBookmarkSectionPosition();
      }
      updateBookmarkPagerState();
      return;
    }
    bookmarkRenderSignature = renderResult.signature;
    if (normalizedItems.length === 0) {
      if (isAtRoot) {
        setContentSectionVisible(bookmarkSection, false);
      } else {
        setContentSectionVisible(bookmarkSection, true);
      }
      updateBookmarkGridHeightLock();
      updateBookmarkSectionPosition();
      updateBookmarkPagerState();
      return;
    }
    setContentSectionVisible(bookmarkSection, true);
    updateBookmarkPagerState();
    updateBookmarkGridHeightLock();
    updateBookmarkSectionPosition();
  }

  function renderRecentSites(items) {
    const sourceItems = Array.isArray(items) ? items : [];
    const resolvedHiddenUrls = new Set();
    sourceItems.forEach((item) => {
      const normalizedItem = normalizeRecentSiteRecord(item);
      if (!normalizedItem) {
        return;
      }
      const key = getRecentSiteUrlKey(normalizedItem);
      if (!key) {
        return;
      }
      const hiddenEntry = hiddenRecentSites.find((entry) => entry && entry.url === key);
      if (!hiddenEntry) {
        return;
      }
      if ((Number(normalizedItem.lastVisitTime) || 0) > (Number(hiddenEntry.lastVisitTime) || 0)) {
        resolvedHiddenUrls.add(key);
      }
    });
    if (resolvedHiddenUrls.size > 0) {
      writeHiddenRecentSites(
        hiddenRecentSites.filter((entry) => entry && !resolvedHiddenUrls.has(entry.url))
      );
    }
    const normalizedSourceItems = sourceItems
      .filter((item) => {
        const url = item && item.url ? String(item.url) : '';
        return !shouldExcludeFromRecentSites(url) && !isRecentSiteHidden(item);
      });
    recentSourceItems = normalizedSourceItems.slice();
    const mergedItems = mergeRecentSitesWithPinned(normalizedSourceItems, getRecentLimit());
    const renderResult = recentSitesView.render(mergedItems, {
      signature: recentRenderSignature
    });
    if (!renderResult.changed) {
      if (mergedItems.length === 0) {
        setContentSectionVisible(recentSection, false);
      } else {
        setContentSectionVisible(recentSection, true);
      }
      updateBookmarkSectionPosition();
      return;
    }
    recentRenderSignature = renderResult.signature;
    if (mergedItems.length === 0) {
      setContentSectionVisible(recentSection, false);
      updateBookmarkSectionPosition();
      return;
    }
    setContentSectionVisible(recentSection, true);
    updateBookmarkSectionPosition();
  }

  function markBookmarkDataDirty() {
    bookmarkDataDirty = true;
  }

  function markBookmarkTreeDirty() {
    bookmarkDataDirty = true;
    bookmarkTreeCacheDirty = true;
    bookmarkTreeCacheReady = false;
    bookmarkTreeCacheLoadingPromise = null;
    bookmarkFolderItemsCache.clear();
    closeBookmarkCascadeMenu();
  }

  function markRecentDataDirty() {
    recentDataDirty = true;
  }

  function readSectionCache(cacheKey) {
    return new Promise((resolve) => {
      if (!localStorageArea || !cacheKey) {
        resolve(null);
        return;
      }
      localStorageArea.get([cacheKey], (result) => {
        const payload = result && result[cacheKey];
        if (!payload || typeof payload !== 'object') {
          resolve(null);
          return;
        }
        const updatedAt = Number(payload.updatedAt || 0);
        const items = Array.isArray(payload.items) ? payload.items : null;
        if (!items || !Number.isFinite(updatedAt)) {
          resolve(null);
          return;
        }
        if ((Date.now() - updatedAt) > NEWTAB_SECTION_CACHE_TTL_MS) {
          resolve(null);
          return;
        }
        resolve(items);
      });
    });
  }

  function writeSectionCache(cacheKey, items) {
    if (!localStorageArea || !cacheKey || !Array.isArray(items)) {
      return;
    }
    localStorageArea.set({
      [cacheKey]: {
        updatedAt: Date.now(),
        items: items
      }
    });
  }

  function hydrateSectionsFromCache() {
    Promise.all([
      readSectionCache(NEWTAB_RECENT_CACHE_STORAGE_KEY),
      waitForFaviconRenderCaches(FAVICON_CACHE_BOOT_WAIT_MS)
    ]).then(([items]) => {
      if (!Array.isArray(items) || items.length === 0) {
        return;
      }
      const recentLimit = getRecentLimit();
      if (!recentLimit || recentLimit <= 0) {
        return;
      }
      const cachedItems = items.slice(0, Math.max(0, recentLimit + MAX_PINNED_RECENT_SITES));
      renderRecentSites(cachedItems);
      recentLoadedOnce = true;
    });
    const bookmarkCacheHydrationLoadToken = bookmarkLoadToken;
    Promise.all([
      readSectionCache(NEWTAB_BOOKMARK_CACHE_STORAGE_KEY),
      waitForFaviconRenderCaches(FAVICON_CACHE_BOOT_WAIT_MS)
    ]).then(([items]) => {
      if (!NEWTAB_BOOKMARKS_STORE.shouldApplyBookmarkCacheHydration(
        { loadToken: bookmarkCacheHydrationLoadToken },
        {
          loadToken: bookmarkLoadToken,
          loadedOnce: bookmarkLoadedOnce,
          dataDirty: bookmarkDataDirty
        }
      )) {
        return;
      }
      if (!Array.isArray(items) || items.length === 0) {
        return;
      }
      if (!currentBookmarkCount || currentBookmarkCount <= 0) {
        return;
      }
      bookmarkCurrentPage = 0;
      bookmarkAllItems = items.slice(0, Math.max(0, getBookmarkLimit()));
      bookmarkRootTotalCount = bookmarkAllItems.length;
      bookmarkRootVisibleCount = bookmarkAllItems.length;
      bookmarkRenderSignature = '';
      renderCurrentBookmarkPage();
      bookmarkLoadedOnce = true;
    });
  }

  function loadBookmarks(options) {
    if (!initialThemeApplied) {
      bootstrapInitialThemeMode().then(() => {
        loadBookmarks(options);
      });
      return;
    }
    const forceReload = Boolean(options && options.force);
    const skipFaviconWait = Boolean(options && options.skipFaviconWait);
    if (!skipFaviconWait && !areFaviconRenderCachesReady()) {
      const waitMs = forceReload ? Math.min(80, FAVICON_CACHE_BOOT_WAIT_MS) : FAVICON_CACHE_BOOT_WAIT_MS;
      waitForFaviconRenderCaches(waitMs).then(() => {
        loadBookmarks({ force: forceReload, skipFaviconWait: true });
      });
      return;
    }
    if (!forceReload && !bookmarkDataDirty && bookmarkLoadedOnce) {
      updateBookmarkSectionPosition();
      return;
    }
    const requestToken = ++bookmarkLoadToken;
    if (!currentBookmarkCount || currentBookmarkCount <= 0) {
      closeBookmarkCascadeMenu();
      bookmarkAllItems = [];
      bookmarkRootTotalCount = 0;
      bookmarkRootVisibleCount = 0;
      bookmarkCurrentPage = 0;
      bookmarkRenderSignature = '';
      bookmarksView.clear();
      setContentSectionVisible(bookmarkSection, false);
      bookmarkDataDirty = false;
      bookmarkLoadedOnce = true;
      updateBookmarkSectionPosition();
      return;
    }
    getTopBookmarks(0, bookmarkCurrentFolderId).then((items) => {
      if (requestToken !== bookmarkLoadToken) {
        return;
      }
      if (!currentBookmarkCount || currentBookmarkCount <= 0) {
        closeBookmarkCascadeMenu();
        bookmarkAllItems = [];
        bookmarkRootTotalCount = 0;
        bookmarkRootVisibleCount = 0;
        bookmarkCurrentPage = 0;
        bookmarkRenderSignature = '';
        bookmarksView.clear();
        setContentSectionVisible(bookmarkSection, false);
        bookmarkDataDirty = false;
        bookmarkLoadedOnce = true;
        updateBookmarkSectionPosition();
        return;
      }
      bookmarkAllItems = Array.isArray(items) ? items : [];
      const isAtRoot = String(bookmarkCurrentFolderId || '') === String(bookmarkRootFolderId || '1');
      if (isAtRoot) {
        bookmarkRootTotalCount = bookmarkAllItems.length;
        bookmarkRootVisibleCount = Math.min(getBookmarkLimit(), bookmarkAllItems.length);
      }
      bookmarksView.syncCardElementCache(bookmarkAllItems);
      const pageCount = getBookmarkPageCount();
      if (bookmarkCurrentPage > (pageCount - 1)) {
        bookmarkCurrentPage = pageCount - 1;
      }
      if (bookmarkCurrentPage < 0) {
        bookmarkCurrentPage = 0;
      }
      updateBookmarkBreadcrumb();
      renderCurrentBookmarkPage();
      if (isAtRoot) {
        writeSectionCache(NEWTAB_BOOKMARK_CACHE_STORAGE_KEY, bookmarkAllItems.slice(0, getBookmarkLimit()));
      }
      bookmarkDataDirty = false;
      bookmarkLoadedOnce = true;
    });
  }

  function loadRecentSites(options) {
    if (!initialThemeApplied) {
      bootstrapInitialThemeMode().then(() => {
        loadRecentSites(options);
      });
      return;
    }
    const forceReload = Boolean(options && options.force);
    const skipFaviconWait = Boolean(options && options.skipFaviconWait);
    if (!skipFaviconWait && !areFaviconRenderCachesReady()) {
      const waitMs = forceReload ? Math.min(80, FAVICON_CACHE_BOOT_WAIT_MS) : FAVICON_CACHE_BOOT_WAIT_MS;
      waitForFaviconRenderCaches(waitMs).then(() => {
        loadRecentSites({ force: forceReload, skipFaviconWait: true });
      });
      return;
    }
    if (!forceReload && !recentDataDirty && recentLoadedOnce) {
      updateBookmarkSectionPosition();
      return;
    }
    const requestToken = ++recentLoadToken;
    const recentLimit = getRecentLimit();
    if (!recentLimit || recentLimit <= 0) {
      recentRenderSignature = '';
      recentSourceItems = [];
      recentSitesView.clear();
      setContentSectionVisible(recentSection, false);
      recentDataDirty = false;
      recentLoadedOnce = true;
      updateBookmarkSectionPosition();
      return;
    }
    getRecentSites(recentLimit + MAX_PINNED_RECENT_SITES, currentRecentMode).then((items) => {
      if (requestToken !== recentLoadToken) {
        return;
      }
      const normalizedItems = Array.isArray(items) ? items : [];
      renderRecentSites(normalizedItems);
      writeSectionCache(
        NEWTAB_RECENT_CACHE_STORAGE_KEY,
        normalizedItems.slice(0, Math.max(0, recentLimit + MAX_PINNED_RECENT_SITES))
      );
      recentDataDirty = false;
      recentLoadedOnce = true;
    });
  }

  function handleRecentVisibilityChange() {
    if (document.visibilityState !== 'visible') {
      return;
    }
    const shouldReloadRecent = recentDataDirty || !recentLoadedOnce;
    const shouldReloadBookmarks = bookmarkDataDirty || !bookmarkLoadedOnce;
    if (shouldReloadRecent || shouldReloadBookmarks) {
      beginSearchEntryRestoreLayoutLock();
    }
    if (shouldReloadRecent) {
      loadRecentSites();
    }
    if (shouldReloadBookmarks) {
      loadBookmarks();
    }
  }

  function forceReloadRecentSitesForI18n() {
    recentRenderSignature = '';
    bookmarkRenderSignature = '';
    markRecentDataDirty();
    markBookmarkDataDirty();
    loadRecentSites();
    loadBookmarks();
  }

  function getRecentStoreOptions(extraOptions) {
    return {
      normalizeHost,
      getHostFromUrl,
      getCanonicalPageUrlForFavicon,
      sanitizeDisplayText,
      getSiteDisplayName,
      shouldExcludeUrl: shouldExcludeFromRecentSites,
      shouldPrioritizeTabUrl: isBrowserPageRecentUrl,
      maxPinned: MAX_PINNED_RECENT_SITES,
      maxHidden: MAX_HIDDEN_RECENT_SITES,
      ...(extraOptions || {})
    };
  }

  function getRecentSiteUrlKey(item) {
    return NEWTAB_RECENT_STORE.getRecentSiteUrlKey(item);
  }

  function normalizeHiddenRecentSiteEntry(item) {
    return NEWTAB_RECENT_STORE.normalizeHiddenRecentSiteEntry(item);
  }

  function normalizeHiddenRecentSites(items) {
    return NEWTAB_RECENT_STORE.normalizeHiddenRecentSites(items, getRecentStoreOptions());
  }

  function readHiddenRecentSites() {
    return NEWTAB_RECENT_STORE.loadHiddenRecentSites(recentSitesStorageArea, getRecentStoreOptions({
      key: HIDDEN_RECENT_SITES_STORAGE_KEY
    }));
  }

  function writeHiddenRecentSites(items) {
    return NEWTAB_RECENT_STORE.saveHiddenRecentSites(recentSitesStorageArea, items, getRecentStoreOptions({
      key: HIDDEN_RECENT_SITES_STORAGE_KEY
    })).then((normalized) => {
      hiddenRecentSites = normalized;
      return normalized;
    });
  }

  function isRecentSiteHidden(item) {
    return NEWTAB_RECENT_STORE.isRecentSiteHidden(item, hiddenRecentSites);
  }

  function hideRecentSiteTemporarily(item) {
    const normalizedItem = normalizeRecentSiteRecord(item);
    const key = getRecentSiteUrlKey(normalizedItem);
    if (!normalizedItem || !key) {
      return Promise.resolve({ hidden: false, wasPinned: false });
    }
    const hiddenEntry = normalizeHiddenRecentSiteEntry({
      url: key,
      lastVisitTime: Number(normalizedItem.lastVisitTime) || 0,
      hiddenAt: Date.now()
    });
    const wasPinned = isRecentSitePinned(normalizedItem);
    const nextPinnedItems = wasPinned
      ? pinnedRecentSites.filter((pinnedItem) => !isSameRecentSite(pinnedItem, normalizedItem))
      : pinnedRecentSites.slice();
    const nextHiddenItems = [hiddenEntry].concat(
      hiddenRecentSites.filter((entry) => entry && entry.url !== key)
    );
    const persistPinned = wasPinned
      ? writePinnedRecentSites(nextPinnedItems)
      : Promise.resolve(pinnedRecentSites.slice());
    return persistPinned.then(() => writeHiddenRecentSites(nextHiddenItems)).then(() => {
      recentRenderSignature = '';
      renderRecentSites(recentSourceItems);
      return { hidden: true, wasPinned };
    });
  }

  function getRecentDismissTooltip(item) {
    const normalizedItem = normalizeRecentSiteRecord(item);
    if (normalizedItem && isRecentSitePinned(normalizedItem)) {
      return t(
        'recent_dismiss_pinned_tooltip',
        '取消置顶并从最近访问移除，再次访问后会重新出现'
      );
    }
    return t(
      'recent_dismiss_tooltip',
      '从最近访问移除，再次访问后会重新出现'
    );
  }

  function getRecentSiteHostKey(item) {
    return NEWTAB_RECENT_STORE.getRecentSiteHostKey(item, getRecentStoreOptions());
  }

  function normalizeRecentSiteRecord(item, options) {
    return NEWTAB_RECENT_STORE.normalizeRecentSiteItem(item, getRecentStoreOptions(options));
  }

  function isSameRecentSite(a, b) {
    return NEWTAB_RECENT_STORE.isSameRecentSite(a, b, getRecentStoreOptions());
  }

  function normalizePinnedRecentSites(items) {
    return NEWTAB_RECENT_STORE.normalizePinnedRecentSites(items, getRecentStoreOptions());
  }

  function readPinnedRecentSites() {
    return NEWTAB_RECENT_STORE.loadPinnedRecentSites(recentSitesStorageArea, getRecentStoreOptions({
      key: PINNED_RECENT_SITES_STORAGE_KEY
    }));
  }

  function writePinnedRecentSites(items) {
    return NEWTAB_RECENT_STORE.savePinnedRecentSites(recentSitesStorageArea, items, getRecentStoreOptions({
      key: PINNED_RECENT_SITES_STORAGE_KEY
    })).then((normalized) => {
      pinnedRecentSites = normalized;
      return normalized;
    });
  }

  function isRecentSitePinned(item) {
    return pinnedRecentSites.some((pinnedItem) => isSameRecentSite(pinnedItem, item));
  }

  function mergeRecentSitesWithPinned(items, limit) {
    return NEWTAB_RECENT_STORE.mergeRecentSitesWithPinned(
      items,
      pinnedRecentSites,
      hiddenRecentSites,
      limit,
      getRecentStoreOptions()
    );
  }

  function togglePinnedRecentSite(item) {
    const normalizedItem = normalizeRecentSiteRecord(item, { ignoreBlacklist: true });
    if (!normalizedItem) {
      return Promise.resolve({ pinned: false, limitReached: false });
    }
    const existingIndex = pinnedRecentSites.findIndex((pinnedItem) => isSameRecentSite(pinnedItem, normalizedItem));
    if (existingIndex >= 0) {
      const nextItems = pinnedRecentSites.filter((_, index) => index !== existingIndex);
      return writePinnedRecentSites(nextItems).then((savedItems) => {
        recentRenderSignature = '';
        renderRecentSites(recentSourceItems);
        return {
          pinned: false,
          limitReached: false,
          items: savedItems
        };
      });
    }
    if (pinnedRecentSites.length >= MAX_PINNED_RECENT_SITES) {
      return Promise.resolve({ pinned: false, limitReached: true, items: pinnedRecentSites.slice() });
    }
    const nextItems = [{
      ...normalizedItem,
      pinnedAt: Date.now()
    }].concat(pinnedRecentSites);
    return writePinnedRecentSites(nextItems).then((savedItems) => {
      recentRenderSignature = '';
      renderRecentSites(recentSourceItems);
      return {
        pinned: true,
        limitReached: false,
        items: savedItems
      };
    });
  }

  function updateRecentPinButton(button, isPinned, limitReached) {
    if (!button) {
      return;
    }
    button.classList.toggle('x-nt-recent-pin--active', Boolean(isPinned));
    button.disabled = false;
    button.classList.toggle('x-nt-recent-pin--limit', Boolean(!isPinned && limitReached));
    button.setAttribute('aria-pressed', isPinned ? 'true' : 'false');
    const label = isPinned
      ? t('recent_pin_remove', '取消置顶')
      : (limitReached
        ? t('recent_pin_limit', '最多置顶 3 个')
        : t('recent_pin_add', '置顶'));
    button.setAttribute('aria-label', label);
    button.setAttribute('data-tooltip', label);
    button.removeAttribute('title');
    button.innerHTML = getRiSvg(
      isPinned ? 'ri-pushpin-fill' : 'ri-pushpin-line',
      'ri-size-16'
    );
  }

  function updateRecentDismissButton(button, item) {
    if (!button) {
      return;
    }
    const enabled = canDismissRecentCard();
    const label = getRecentDismissTooltip(item);
    button.setAttribute('aria-label', label);
    button.setAttribute('data-tooltip', label);
    button.removeAttribute('title');
    button.innerHTML = getRiSvg('ri-subtract-line', 'ri-size-16');
    button.disabled = !enabled;
    button.tabIndex = enabled ? 0 : -1;
    button.setAttribute('aria-hidden', enabled ? 'false' : 'true');
    button.style.setProperty('display', enabled ? 'inline-flex' : 'none');
  }

  function hideToast() {
    if (toastController && typeof toastController.hide === 'function') {
      toastController.hide();
    }
  }

  function showToast(message, isError) {
    if (toastController && typeof toastController.show === 'function') {
      toastController.show(message, { error: Boolean(isError) });
    }
  }

  function setSuggestionsVisible(visible) {
    if (layoutController && typeof layoutController.setSuggestionsVisible === 'function') {
      layoutController.setSuggestionsVisible(visible);
    }
  }

  function updateSuggestionsFloatingLayout() {
    if (layoutController && typeof layoutController.updateSuggestionsFloatingLayout === 'function') {
      layoutController.updateSuggestionsFloatingLayout();
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
    const ownExtensionDisplay = getOwnExtensionPageDisplay(url);
    if (ownExtensionDisplay) {
      return ownExtensionDisplay.urlText;
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

  function isBrowserExtensionProtocol(protocol) {
    const guards = window.LumnoUrlGuards || {};
    if (typeof guards.isBrowserExtensionProtocol === 'function') {
      return guards.isBrowserExtensionProtocol(protocol);
    }
    const normalized = String(protocol || '').toLowerCase();
    return normalized === 'chrome-extension:' ||
      normalized === 'moz-extension:' ||
      normalized === 'ms-browser-extension:';
  }

  function isBrowserNewtabUrl(url) {
    const guards = window.LumnoUrlGuards || {};
    if (typeof guards.isBrowserNewtabUrl === 'function') {
      return guards.isBrowserNewtabUrl(url);
    }
    const lower = String(url || '').trim().toLowerCase().replace(/[?#].*$/, '').replace(/\/+$/, '');
    return lower === 'chrome://newtab' ||
      lower === 'chrome://new-tab-page' ||
      lower === 'edge://newtab' ||
      lower === 'brave://newtab' ||
      lower === 'vivaldi://newtab' ||
      lower === 'opera://startpage';
  }

  function isBrowserInternalUrl(url) {
    const guards = window.LumnoUrlGuards || {};
    if (typeof guards.isBrowserInternalUrl === 'function') {
      return guards.isBrowserInternalUrl(url);
    }
    const lower = String(url || '').trim().toLowerCase();
    return lower.startsWith('chrome://') ||
      lower.startsWith('edge://') ||
      lower.startsWith('brave://') ||
      lower.startsWith('vivaldi://') ||
      lower.startsWith('opera://') ||
      lower.startsWith('about:');
  }

  function isBrowserPageRecentUrl(url) {
    return Boolean(url && isBrowserInternalUrl(url) && !isBrowserNewtabUrl(url));
  }

  function isOwnExtensionUrl(url) {
    if (!url || !chrome || !chrome.runtime || !chrome.runtime.id) {
      return false;
    }
    try {
      const parsed = new URL(url);
      return isBrowserExtensionProtocol(parsed.protocol) &&
        String(parsed.hostname || '') === String(chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  function getOwnExtensionPageLabel(url) {
    if (!isOwnExtensionUrl(url)) {
      return '';
    }
    try {
      const routeType = typeof EXTENSION_ROUTES.classifyExtensionUrl === 'function'
        ? EXTENSION_ROUTES.classifyExtensionUrl(url)
        : '';
      if (routeType === 'newtab') {
        return t('newtab_page_label', '新标签页');
      }
      if (routeType === 'options') {
        return t('settings_title', '设置');
      }
      const parsed = new URL(url);
      const path = String(parsed.pathname || '').toLowerCase();
      if (path.endsWith('/newtab.html') || path === '/newtab.html') {
        return t('newtab_page_label', '新标签页');
      }
      if (path.endsWith('/options.html') || path === '/options.html') {
        return t('settings_title', '设置');
      }
      return t('extension_page_label', '扩展页面');
    } catch (e) {
      return t('extension_page_label', '扩展页面');
    }
  }

  function getOwnExtensionPageDisplay(url, title) {
    if (!isOwnExtensionUrl(url)) {
      return null;
    }
    const pageLabel = getOwnExtensionPageLabel(url);
    const rawTitle = String(title || '').trim();
    const runtimeId = String(chrome && chrome.runtime && chrome.runtime.id ? chrome.runtime.id : '').toLowerCase();
    const titleLooksLikeId = rawTitle && runtimeId && rawTitle.toLowerCase().includes(runtimeId);
    const titleText = rawTitle && !titleLooksLikeId
      ? rawTitle
      : `Lumno ${pageLabel}`.trim();
    return {
      siteName: 'Lumno',
      titleText: titleText,
      urlText: `Lumno · ${pageLabel}`.trim()
    };
  }

  function isRestrictedUrl(url) {
    const guards = window.LumnoUrlGuards || {};
    if (typeof guards.isRestrictedUrl === 'function') {
      return guards.isRestrictedUrl(url);
    }
    if (!url) {
      return true;
    }
    const lower = String(url).toLowerCase();
    if (lower.startsWith('chrome://') ||
      lower.startsWith('edge://') ||
      lower.startsWith('brave://') ||
      lower.startsWith('vivaldi://') ||
      lower.startsWith('opera://') ||
      lower.startsWith('about:')) {
      return true;
    }
    try {
      const parsed = new URL(url);
      if (isBrowserExtensionProtocol(parsed.protocol)) {
        return true;
      }
      const host = parsed.hostname.toLowerCase();
      const path = parsed.pathname.toLowerCase();
      if ((host === 'chrome.google.com' && path.startsWith('/webstore')) ||
          host === 'chromewebstore.google.com' ||
          (host === 'microsoftedge.microsoft.com' && path.startsWith('/addons')) ||
          host === 'addons.opera.com') {
        return true;
      }
    } catch (e) {
      return true;
    }
    return false;
  }

  function getExtensionFaviconUrl(pageUrl) {
    const resolver = getPageFaviconUrlResolver();
    return resolver ? resolver.getExtensionFaviconUrl(pageUrl) : '';
  }

  function getGstaticFaviconUrl(pageUrl) {
    const resolver = getPageFaviconUrlResolver();
    return resolver ? resolver.getGstaticFaviconUrl(pageUrl) : '';
  }

  function getChromeFaviconUrl(pageUrl) {
    const resolver = getPageFaviconUrlResolver();
    return resolver ? resolver.getChromeFaviconUrl(pageUrl) : '';
  }

  function getBrowserPageFaviconUrl(pageUrl) {
    const resolver = getPageFaviconUrlResolver();
    return resolver ? resolver.getBrowserPageFaviconUrl(pageUrl) : '';
  }

  function getPageFaviconCandidateUrl(pageUrl) {
    const resolver = getPageFaviconUrlResolver();
    return resolver ? resolver.getPageFaviconCandidateUrl(pageUrl) : '';
  }

  function getPageFaviconRenderCandidates(pageUrl, explicitUrl, options) {
    const resolver = getPageFaviconUrlResolver();
    return resolver && typeof resolver.getPageFaviconRenderCandidates === 'function'
      ? resolver.getPageFaviconRenderCandidates(pageUrl, explicitUrl, options)
      : { primaryUrl: String(explicitUrl || '').trim(), browserUrl: '' };
  }

  function getHostFaviconUrl(hostname) {
    const normalized = normalizeFaviconHost(hostname);
    if (!normalized) {
      return '';
    }
    if (normalized === 'lumno.kubai.design') {
      return (chrome && chrome.runtime && typeof chrome.runtime.getURL === 'function')
        ? chrome.runtime.getURL('assets/images/lumno.png')
        : 'https://lumno.kubai.design/favicon.png';
    }
    return getGstaticFaviconUrl(`https://${normalized}/`);
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

  function normalizeSearchBlacklistMatchModes(value) {
    if (BLACKLIST_UTILS.normalizeMatchModes) {
      return BLACKLIST_UTILS.normalizeMatchModes(value, 'prefix');
    }
    return ['prefix'];
  }

  function normalizeSearchBlacklistItems(items) {
    if (BLACKLIST_UTILS.normalizeItems) {
      return BLACKLIST_UTILS.normalizeItems(items, 'prefix');
    }
    return [];
  }

  function normalizeFaviconRequestBlacklistItems(items) {
    if (BLACKLIST_UTILS.normalizeItems) {
      return BLACKLIST_UTILS.normalizeItems(items, 'prefix');
    }
    return [];
  }

  function loadSearchBlacklistItems() {
    return new Promise((resolve) => {
      if (!storageArea) {
        resolve([]);
        return;
      }
      storageArea.get([SEARCH_BLACKLIST_STORAGE_KEY], (result) => {
        const items = normalizeSearchBlacklistItems(result && result[SEARCH_BLACKLIST_STORAGE_KEY]);
        searchBlacklistItems = items;
        resolve(items);
      });
    });
  }

  function getFaviconRequestMatchUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) {
      return '';
    }
    return typeof FAVICON_UTILS.getCanonicalPageUrlForFavicon === 'function'
      ? String(FAVICON_UTILS.getCanonicalPageUrlForFavicon(raw) || raw).trim()
      : raw;
  }

  function isUrlBlockedByFaviconRequestBlacklist(url) {
    const target = getFaviconRequestMatchUrl(url);
    return Boolean(
      target &&
      BLACKLIST_UTILS.isUrlBlocked &&
      BLACKLIST_UTILS.isUrlBlocked(target, faviconRequestBlacklistItems)
    );
  }

  function loadFaviconRequestBlacklistItems() {
    return new Promise((resolve) => {
      if (!storageArea) {
        resolve([]);
        return;
      }
      storageArea.get([FAVICON_REQUEST_BLACKLIST_STORAGE_KEY], (result) => {
        const items = normalizeFaviconRequestBlacklistItems(result && result[FAVICON_REQUEST_BLACKLIST_STORAGE_KEY]);
        faviconRequestBlacklistItems = items;
        resolve(items);
      });
    });
  }

  function isUrlBlockedBySearchBlacklist(url) {
    return BLACKLIST_UTILS.isUrlBlocked
      ? BLACKLIST_UTILS.isUrlBlocked(url, searchBlacklistItems)
      : false;
  }

  function isSuggestionBlockedBySearchBlacklist(suggestion) {
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
    if (suggestion.url && isUrlBlockedBySearchBlacklist(suggestion.url)) {
      return true;
    }
    return false;
  }

  function filterBlacklistedSuggestions(list, queryForProvider) {
    if (!Array.isArray(list) || list.length === 0) {
      return [];
    }
    return list.filter((suggestion) => !isSuggestionBlockedBySearchBlacklist(suggestion));
  }

  function limitSuggestionsForDisplay(list) {
    if (typeof SEARCH_UTILS.limitSearchSuggestionsForDisplay === 'function') {
      return SEARCH_UTILS.limitSearchSuggestionsForDisplay(list);
    }
    const suggestions = Array.isArray(list) ? list : [];
    const policy = SEARCH_UTILS.SEARCH_POLICY || {};
    const limit = Number(policy.displaySuggestionLimit) || 10;
    return suggestions.slice(0, limit);
  }

  function shouldExcludeFromRecentSites(url) {
    if (!url) {
      return true;
    }
    if (isBrowserNewtabUrl(url)) {
      return true;
    }
    try {
      const parsed = new URL(url);
      if (isBrowserExtensionProtocol(parsed.protocol)) {
        return true;
      }
      return isUrlBlockedBySearchBlacklist(parsed.toString());
    } catch (e) {
      return true;
    }
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

    const readOpenTabs = () => new Promise((resolve) => {
      if (!chrome.tabs || !chrome.tabs.query) {
        resolve([]);
        return;
      }
      chrome.tabs.query({}, (tabs) => {
        resolve(chrome.runtime.lastError || !Array.isArray(tabs) ? [] : tabs);
      });
    });

    const readTopSites = () => new Promise((resolve) => {
      if (!chrome.topSites || !chrome.topSites.get) {
        resolve(null);
        return;
      }
      chrome.topSites.get((items) => {
        resolve(chrome.runtime.lastError || !Array.isArray(items) ? null : items);
      });
    });

    const readHistoryItems = () => new Promise((resolve) => {
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

  function rebuildBookmarkTreeCache(nodes) {
    const cache = NEWTAB_BOOKMARKS_STORE.buildBookmarkFolderCache(nodes, { normalizeHost });
    bookmarkNodeMap = cache.nodeMap || new Map();
    bookmarkFolderItemsCache = cache.folderItemsCache || new Map();
    const barNode = cache.rootNode || null;
    if (!barNode) {
      bookmarkTreeCacheReady = false;
      return false;
    }
    bookmarkRootFolderId = String(cache.rootFolderId || barNode.id || '1');
    bookmarkTreeCacheReady = true;
    bookmarkTreeCacheDirty = false;
    return true;
  }

  function ensureBookmarkTreeCache(forceReload) {
    if (!chrome.bookmarks || !chrome.bookmarks.getTree) {
      bookmarkFolderPath = [{ id: '1', title: t('bookmarks_heading', '书签') }];
      return Promise.resolve(false);
    }
    if (!forceReload && bookmarkTreeCacheReady && !bookmarkTreeCacheDirty) {
      return Promise.resolve(true);
    }
    if (bookmarkTreeCacheLoadingPromise) {
      return bookmarkTreeCacheLoadingPromise;
    }
    bookmarkTreeCacheLoadingPromise = new Promise((resolve) => {
      chrome.bookmarks.getTree((nodes) => {
        let ok = false;
        if (!chrome.runtime.lastError && Array.isArray(nodes) && nodes.length > 0) {
          ok = rebuildBookmarkTreeCache(nodes);
        } else {
          bookmarkFolderItemsCache.clear();
          bookmarkTreeCacheReady = false;
        }
        if (!ok) {
          bookmarkFolderPath = [{ id: String(bookmarkRootFolderId || '1'), title: t('bookmarks_heading', '书签') }];
        }
        bookmarkTreeCacheLoadingPromise = null;
        resolve(ok);
      });
    });
    return bookmarkTreeCacheLoadingPromise;
  }

  function buildBookmarkFolderPath(folderId) {
    return NEWTAB_BOOKMARKS_STORE.buildBookmarkFolderPath(folderId, {
      nodeMap: bookmarkNodeMap,
      rootId: bookmarkRootFolderId,
      rootTitle: t('bookmarks_heading', '书签')
    });
  }

  function openBookmarkCascadeMenu(item, anchorElement) {
    if (bookmarkCascadeRuntime) {
      bookmarkCascadeRuntime.open(item, anchorElement);
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
    return new Promise((resolve) => {
      const parsedLimit = Number.parseInt(limit, 10);
      const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 0;
      ensureBookmarkTreeCache(false).then((ready) => {
        if (!ready) {
          resolve([]);
          return;
        }
        const rootId = String(bookmarkRootFolderId || '1');
        const targetFolderId = String(folderId || bookmarkCurrentFolderId || rootId);
        const targetNode = bookmarkNodeMap.get(targetFolderId) || bookmarkNodeMap.get(rootId);
        if (!targetNode) {
          bookmarkFolderPath = [{ id: rootId, title: t('bookmarks_heading', '书签') }];
          resolve([]);
          return;
        }
        bookmarkCurrentFolderId = String(targetNode.id || rootId);
        bookmarkFolderPath = buildBookmarkFolderPath(bookmarkCurrentFolderId);
        const cachedItems = bookmarkFolderItemsCache.get(bookmarkCurrentFolderId) || [];
        resolve(safeLimit > 0 ? cachedItems.slice(0, safeLimit) : cachedItems);
      });
    });
  }

  function getSiteDisplayName(hostname, title) {
    const rawTitle = String(title || '').trim();
    const host = String(hostname || '').toLowerCase().replace(/^(www|m)\./i, '');
    const brandMap = {
      'lumno.kubai.design': 'Lumno',
      'github.com': 'GitHub',
      'youtube.com': 'YouTube',
      'google.com': 'Google',
      'mp.weixin.qq.com': t('site_brand_wechat_official', '微信公众号'),
      'weibo.com': '微博',
      'x.com': 'X',
      'twitter.com': 'X',
      'immersivetranslate.com': 'Immersive Translate',
      'abouttrans.info': 'aboutTrans',
      'aboutrans.info': 'aboutTrans'
    };
    const suffixes = new Set([
      'co.uk', 'org.uk', 'gov.uk', 'ac.uk',
      'com.cn', 'net.cn', 'org.cn', 'gov.cn',
      'com.hk', 'com.tw', 'com.au', 'com.sg',
      'co.jp', 'co.kr'
    ]);
    const noisySubdomains = new Set([
      'onboarding', 'login', 'signin', 'auth', 'account',
      'web', 'app', 'admin', 'stage', 'staging', 'preview', 'dev'
    ]);
    const separators = [' | ', ' - ', ' — ', ' – ', ' · ', ' • ', '：', ':'];

    function getPrimaryLabelFromHost(hostValue) {
      if (!hostValue) {
        return '';
      }
      const parts = hostValue.split('.').filter(Boolean);
      if (parts.length === 0) {
        return '';
      }
      if (parts.length === 1) {
        return parts[0];
      }
      const tail2 = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
      const index = suffixes.has(tail2) && parts.length >= 3 ? parts.length - 3 : parts.length - 2;
      return parts[index] || parts[0];
    }

    function prettifyLabel(label) {
      const value = String(label || '').trim();
      if (!value) {
        return '';
      }
      if (value.length === 1) {
        return value.toUpperCase();
      }
      if (/^[a-z]+$/.test(value)) {
        return value.charAt(0).toUpperCase() + value.slice(1);
      }
      return value;
    }

    function pickTitleCandidate() {
      if (!rawTitle) {
        return '';
      }
      const candidates = [rawTitle];
      separators.forEach((sep) => {
        if (rawTitle.includes(sep)) {
          rawTitle.split(sep).forEach((part) => candidates.push(part));
        }
      });
      let best = '';
      let bestScore = -1;
      candidates.forEach((part) => {
        const value = String(part || '').trim();
        if (!value || value.length < 2 || value.length > 24) {
          return;
        }
        if (/https?:|\/|\\|\?|=|&/.test(value)) {
          return;
        }
        if (/^\d+$/.test(value)) {
          return;
        }
        let score = 0;
        if (/[\u4e00-\u9fff]/.test(value)) {
          score += 2;
        }
        if (/\s/.test(value)) {
          score += 1;
        }
        if (value.length >= 3 && value.length <= 14) {
          score += 1;
        }
        if (score > bestScore) {
          best = value;
          bestScore = score;
        }
      });
      return best;
    }

    function normalizeWordToken(value) {
      return String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    }

    function pickCasedLabelFromTitle(hostLabelRaw) {
      const raw = String(hostLabelRaw || '').trim();
      if (!raw || !rawTitle) {
        return '';
      }
      const target = normalizeWordToken(raw);
      if (!target) {
        return '';
      }
      const candidates = [rawTitle];
      separators.forEach((sep) => {
        if (rawTitle.includes(sep)) {
          rawTitle.split(sep).forEach((part) => candidates.push(part));
        }
      });
      for (let i = 0; i < candidates.length; i += 1) {
        const token = String(candidates[i] || '').trim();
        if (!token) {
          continue;
        }
        if (normalizeWordToken(token) === target) {
          return token;
        }
      }
      const words = rawTitle.split(/[\s|—–\-·•:：()（）\[\]【】]+/).map((part) => String(part || '').trim()).filter(Boolean);
      for (let i = 0; i < words.length; i += 1) {
        const word = words[i];
        if (normalizeWordToken(word) === target) {
          return word;
        }
      }
      return '';
    }

    function isWeakHostLabel(label) {
      const value = String(label || '').trim().toLowerCase();
      if (!value) {
        return true;
      }
      if (value.length <= 1 || /^\d+$/.test(value)) {
        return true;
      }
      return noisySubdomains.has(value);
    }

    if (host) {
      if (brandMap[host]) {
        return brandMap[host];
      }
      const matchedBrandHost = Object.keys(brandMap).find((key) => host === key || host.endsWith(`.${key}`));
      if (matchedBrandHost) {
        return brandMap[matchedBrandHost];
      }
      const primaryHostLabel = getPrimaryLabelFromHost(host);
      const casedFromTitle = pickCasedLabelFromTitle(primaryHostLabel);
      const hostLabel = casedFromTitle || prettifyLabel(primaryHostLabel);
      const titleCandidate = pickTitleCandidate();
      const firstSubdomain = host.split('.').filter(Boolean)[0] || '';
      if (noisySubdomains.has(firstSubdomain) && titleCandidate) {
        return titleCandidate;
      }
      if (isWeakHostLabel(hostLabel) && titleCandidate) {
        return titleCandidate;
      }
      if (hostLabel) {
        return hostLabel;
      }
      if (titleCandidate) {
        return titleCandidate;
      }
    }
    return rawTitle || hostname || '';
  }

  function getRecentCardColors(theme, host) {
    const fallbackTheme = theme || buildFallbackThemeForHost(host) || defaultTheme;
    const resolvedTheme = getThemeForMode(fallbackTheme);
    const accentRgb = resolvedTheme.accentRgb || parseCssColor(resolvedTheme.accent) || defaultAccentColor;
    const isDark = document.body && document.body.getAttribute('data-theme') === 'dark';
    const accentEmphasis = mixColor(accentRgb, [0, 0, 0], isDark ? 0.1 : 0.18);
    const baseTarget = isDark ? [22, 22, 22] : [255, 255, 255];
    const base = mixColor(accentRgb, baseTarget, isDark ? 0.72 : 0.82);
    const border = mixColor(base, isDark ? [255, 255, 255] : [0, 0, 0], isDark ? 0.12 : 0.1);
    const innerTint = mixColor(accentRgb, [255, 255, 255], 0.82);
    return {
      base: rgbToCss(base),
      border: rgbToCss(border),
      innerTint: rgbToCssParts(innerTint),
      accent: rgbToCss(accentEmphasis),
      accentSoft: rgbToCssAlpha(accentRgb, isDark ? 0.14 : 0.12),
      accentBorder: rgbToCssAlpha(accentRgb, isDark ? 0.24 : 0.18)
    };
  }

  function applyRecentCardTheme(card, theme, host) {
    if (!card) {
      return;
    }
    const colors = getRecentCardColors(theme, host);
    card.style.setProperty('--x-nt-recent-card-color', colors.base);
    card.style.setProperty('--x-nt-recent-card-border-color', colors.border);
    card.style.setProperty('--x-nt-recent-inner-tint-rgb', colors.innerTint);
    card.style.setProperty('--x-nt-recent-accent-color', colors.accent);
    card.style.setProperty('--x-nt-recent-accent-soft', colors.accentSoft);
    card.style.setProperty('--x-nt-recent-accent-border', colors.accentBorder);
  }

  function getBookmarkCardColors(theme, host) {
    const fallbackTheme = theme || buildFallbackThemeForHost(host) || defaultTheme;
    const resolvedTheme = getThemeForMode(fallbackTheme);
    const accentRgb = resolvedTheme.accentRgb || parseCssColor(resolvedTheme.accent) || defaultAccentColor;
    const isDark = document.body && document.body.getAttribute('data-theme') === 'dark';
    const baseTarget = isDark ? [24, 24, 24] : [255, 255, 255];
    const base = mixColor(accentRgb, baseTarget, isDark ? 0.9 : 0.94);
    const border = mixColor(base, isDark ? [255, 255, 255] : [0, 0, 0], isDark ? 0.12 : 0.07);
    const icon = mixColor(accentRgb, baseTarget, isDark ? 0.92 : 0.96);
    const hover = mixColor(accentRgb, baseTarget, isDark ? 0.84 : 0.9);
    const shadow = isDark
      ? mixColor(accentRgb, [18, 26, 40], 0.62)
      : mixColor(accentRgb, [138, 146, 160], 0.46);
    return {
      base: rgbToCss(base),
      hover: rgbToCssAlpha(hover, isDark ? 0.78 : 0.86),
      border: rgbToCss(border),
      iconBg: rgbToCss(icon),
      shadowRgb: rgbToCssParts(shadow)
    };
  }

  function applyBookmarkCardTheme(card, theme, host) {
    if (!card) {
      return;
    }
    if (card._xNoThemeTint) {
      card.style.removeProperty('--x-nt-bookmark-card-color');
      card.style.removeProperty('--x-nt-bookmark-card-hover-color');
      card.style.removeProperty('--x-nt-bookmark-card-border-color');
      card.style.removeProperty('--x-nt-bookmark-icon-color');
      const isDark = document.body && document.body.getAttribute('data-theme') === 'dark';
      card.style.setProperty('--x-nt-bookmark-shadow-rgb', isDark ? '52, 96, 180' : '86, 138, 220');
      return;
    }
    const colors = getBookmarkCardColors(theme, host);
    card.style.setProperty('--x-nt-bookmark-card-color', colors.base);
    card.style.setProperty('--x-nt-bookmark-card-hover-color', colors.hover);
    card.style.setProperty('--x-nt-bookmark-card-border-color', colors.border);
    card.style.setProperty('--x-nt-bookmark-icon-color', colors.iconBg);
    card.style.setProperty('--x-nt-bookmark-shadow-rgb', colors.shadowRgb);
  }

  function getShortcutIconColors(theme, host) {
    const fallbackTheme = theme || buildFallbackThemeForHost(host) || defaultTheme;
    const resolvedTheme = getThemeForMode(fallbackTheme);
    const accentRgb = normalizeAccentRgb(resolvedTheme.accentRgb || parseCssColor(resolvedTheme.accent)) || defaultAccentColor;
    const isDark = document.body && document.body.getAttribute('data-theme') === 'dark';
    const baseTarget = isDark ? [22, 22, 22] : [255, 255, 255];
    const iconBgRgb = mixColor(accentRgb, baseTarget, isDark ? 0.72 : 0.82);
    return {
      iconBg: rgbToCss(iconBgRgb),
      iconColor: getReadableTextColor(iconBgRgb)
    };
  }

  function isShortcutThemeDefaultForWallpaper(theme) {
    const source = getThemeSource(theme);
    if (!theme || theme._xIsDefault || source === 'fallback') {
      return true;
    }
    if (source === 'favicon') {
      const accentRgb = normalizeAccentRgb(theme.accentRgb || parseCssColor(theme.accent));
      return theme._xThemeNeutral === true ||
        normalizeThemeConfidence(theme._xThemeConfidence, accentRgb) === 'neutral';
    }
    return isLowConfidenceTheme(theme);
  }

  function applyShortcutTileTheme(tile, theme, host) {
    if (!tile) {
      return;
    }
    const fallbackTheme = theme || buildFallbackThemeForHost(host) || defaultTheme;
    const isDefaultTheme = isShortcutThemeDefaultForWallpaper(fallbackTheme);
    const colors = getShortcutIconColors(theme, host);
    tile.setAttribute('data-shortcut-theme-default', isDefaultTheme ? 'true' : 'false');
    tile.setAttribute('data-shortcut-theme-source', getThemeSource(fallbackTheme));
    if (!isDefaultTheme) {
      tile.style.removeProperty('--x-nt-shortcut-wallpaper-icon-bg');
      tile.style.removeProperty('--x-nt-shortcut-wallpaper-icon-color');
    }
    tile.style.setProperty('--x-nt-shortcut-icon-bg', colors.iconBg);
    tile.style.setProperty('--x-nt-shortcut-icon-color', colors.iconColor);
    scheduleWallpaperAdaptiveToneUpdate();
  }

  function shouldDelayBookmarkHoverFromRecent(pointerType) {
    if (pointerType && pointerType !== 'mouse') {
      return false;
    }
    if (recentMouseInsideSection) {
      return true;
    }
    if (!recentMouseLeftAt) {
      return false;
    }
    return (Date.now() - recentMouseLeftAt) <= BOOKMARK_HOVER_RECENT_TRANSFER_WINDOW_MS;
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
    if (!event || event.key === 'Tab') {
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
      : String(latestRawQuery || '');
    if (inputParts && inputParts.input && inputParts.input.value !== rawQuery) {
      inputParts.input.value = rawQuery;
      inputParts.input.setSelectionRange(rawQuery.length, rawQuery.length);
    }
    latestRawQuery = rawQuery;
    latestQuery = rawQuery.trim();
    clearAutocomplete();
    return true;
  }

  function applyAutocomplete(allSuggestions, primarySuggestion, primaryHighlightReason) {
    const rawQuery = latestRawQuery;
    const trimmedQuery = rawQuery.trim();
    if (searchResultPriorityMode === 'search') {
      if (inputParts && inputParts.input && inputParts.input.value !== rawQuery) {
        inputParts.input.value = rawQuery;
        inputParts.input.setSelectionRange(rawQuery.length, rawQuery.length);
      }
      clearAutocomplete();
      return;
    }
    if (Date.now() - lastDeletionAt < 250) {
      clearAutocomplete();
      return;
    }
    if (siteSearchState) {
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
    if (inputParts.input.selectionStart !== inputParts.input.value.length ||
        inputParts.input.selectionEnd !== inputParts.input.value.length) {
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
    inputParts.input.value = displayText;
    inputParts.input.setSelectionRange(rawQuery.length, displayText.length);
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
    if (typeof SEARCH_UTILS.hasOpenAndSubmitSiteSearchAction === 'function') {
      return SEARCH_UTILS.hasOpenAndSubmitSiteSearchAction(provider);
    }
    return Boolean(
      provider &&
      String(provider.action || '').trim() === 'openAndSubmit'
    );
  }

  function isAiSiteSearchProvider(provider) {
    if (typeof SEARCH_UTILS.isAiSiteSearchProvider === 'function') {
      return SEARCH_UTILS.isAiSiteSearchProvider(provider);
    }
    const template = normalizeSiteSearchTemplate(String((provider && provider.template) || '').trim());
    return Boolean(
      provider &&
      (
        hasOpenAndSubmitSiteSearchAction(provider) ||
        (template && !template.includes('{query}'))
      )
    );
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

  function runSiteSearchProviderQuery(provider, query, disposition) {
    const trimmedQuery = String(query || '').trim();
    if (!provider || !trimmedQuery) {
      return false;
    }
    if (isInteractiveSiteSearchProvider(provider)) {
      chrome.runtime.sendMessage({
        action: 'runSiteSearchProviderQuery',
        provider: provider,
        query: trimmedQuery,
        disposition: disposition || 'currentTab'
      });
      return true;
    }
    const siteUrl = buildSearchUrl(provider.template, trimmedQuery);
    if (!siteUrl) {
      return false;
    }
    if (disposition === 'backgroundTab') {
      chrome.runtime.sendMessage({
        action: 'createTab',
        url: siteUrl,
        disposition: 'backgroundTab'
      });
      return true;
    }
    navigateToUrl(siteUrl);
    return true;
  }

  function getProviderFaviconPageUrl(provider) {
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

  function getProviderIcon(provider) {
    const explicitIcon = provider && (provider.icon || provider.iconUrl) ? (provider.icon || provider.iconUrl) : '';
    const providerIconPageUrl = explicitIcon ? getCanonicalPageUrlForFavicon(explicitIcon) : '';
    if (providerIconPageUrl && providerIconPageUrl !== explicitIcon) {
      return getPageFaviconCandidateUrl(providerIconPageUrl) || explicitIcon;
    }
    if (explicitIcon) {
      return explicitIcon;
    }
    const providerPageUrl = getProviderFaviconPageUrl(provider);
    try {
      const hostname = normalizeHost(new URL(providerPageUrl).hostname);
      return getPageFaviconCandidateUrl(providerPageUrl) || getHostFaviconUrl(hostname);
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
    if (!icon || !iconUrl || iconUrl.startsWith('data:')) {
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
    const candidates = getPageFaviconRenderCandidates(pageUrl, iconUrl) || {};
    attachFaviconWithFallbacks(icon, pageUrl, hostKey, {
      primaryUrl: candidates.primaryUrl || iconUrl,
      browserUrl: candidates.browserUrl || ''
    });
    return true;
  }

  function getSiteSearchProviders() {
    if (siteSearchProvidersCache) {
      return Promise.resolve(siteSearchProvidersCache);
    }
    if (typeof SITE_SEARCH_STORE.loadSiteSearchProviders !== 'function') {
      siteSearchProvidersCache = defaultSiteSearchProviders.slice();
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
      mergeCustomProviders: SEARCH_UTILS.mergeCustomProviders
    }).then((items) => {
      siteSearchProvidersCache = items;
      return items;
    });
  }

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

  function getProviderHost(provider) {
    return SEARCH_UTILS.getSiteSearchProviderHost(provider);
  }

  function getSiteSearchTriggerCandidate(input, providers, topSiteMatch) {
    return SEARCH_UTILS.getSiteSearchTriggerCandidate(input, providers, topSiteMatch, {
      matchesTopSitePrefix
    });
  }

  function activateSiteSearch(provider) {
    if (!provider) {
      return;
    }
    siteSearchState = provider;
    inlineSearchState = null;
    inputParts.input.value = '';
    latestRawQuery = '';
    latestQuery = '';
    clearAutocomplete();
    setSiteSearchPrefix(provider, defaultTheme, { animate: true });
    getThemeForProvider(provider).then((theme) => {
      if (siteSearchState === provider) {
        setSiteSearchPrefix(provider, theme);
      }
    });
    clearSearchSuggestions();
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
    if (window._x_extension_shortcut_rules_2024_unique_) {
      return Promise.resolve(window._x_extension_shortcut_rules_2024_unique_);
    }
    if (window._x_extension_shortcut_rules_promise_2024_unique_) {
      return window._x_extension_shortcut_rules_promise_2024_unique_;
    }
    const rulesUrl = chrome.runtime.getURL('assets/data/shortcut-rules.json');
    const rulesPromise = fetch(rulesUrl)
      .then((response) => response.json())
      .then((data) => {
        const items = data && Array.isArray(data.items) ? data.items : [];
        window._x_extension_shortcut_rules_2024_unique_ = items;
        return items;
      })
      .catch(() => new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'getShortcutRules' }, (response) => {
          const items = response && Array.isArray(response.items) ? response.items : [];
          window._x_extension_shortcut_rules_2024_unique_ = items;
          resolve(items);
        });
      }));
    window._x_extension_shortcut_rules_promise_2024_unique_ = rulesPromise;
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

  function getDirectUrlSuggestion(input) {
    const targetUrl = getDirectNavigationUrl(input);
    if (!targetUrl) {
      return null;
    }
    return {
      type: 'directUrl',
      title: formatMessage('open_url', '打开 {url}', { url: targetUrl }),
      url: targetUrl,
      favicon: getPageFaviconCandidateUrl(targetUrl)
    };
  }

  function getDirectNavigationUrl(input) {
    if (SEARCH_UTILS && typeof SEARCH_UTILS.getDirectNavigationUrl === 'function') {
      return SEARCH_UTILS.getDirectNavigationUrl(input);
    }
    return '';
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
    return null;
  }

  function shouldSwitchMatchedTabSuggestion(suggestion, index) {
    if (!suggestion || typeof suggestion._xMatchedTabId !== 'number') {
      return false;
    }
    if (!openTabQuickSwitchEnabled) {
      return false;
    }
    return index === 0;
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
      openInBackgroundTab: isBackgroundOpenEvent(event),
      openInCurrentTab: Boolean(event && event.altKey)
    };
    if (SUGGESTION_ACTION_MODEL &&
        typeof SUGGESTION_ACTION_MODEL.getSearchResultOpenDisposition === 'function') {
      return SUGGESTION_ACTION_MODEL.getSearchResultOpenDisposition(config) === 'backgroundTab';
    }
    return Boolean(config.openInBackgroundTab && !config.openInCurrentTab);
  }

  function getSearchResultNewTabDisposition(event) {
    return shouldOpenSearchResultInBackgroundTab(event) ? 'backgroundTab' : 'newTab';
  }

  function openSearchResultUrl(suggestion, query, event) {
    if (!suggestion || !suggestion.url) {
      return false;
    }
    recordSearchSuggestionSelection(suggestion, query);
    if (shouldOpenSearchResultInBackgroundTab(event)) {
      chrome.runtime.sendMessage({
        action: 'createTab',
        url: suggestion.url,
        disposition: 'backgroundTab'
      });
      return true;
    }
    navigateToUrl(suggestion.url);
    return true;
  }

  function openMatchedTabSuggestion(suggestion, event, item, query) {
    if (shouldUseNewTabForSwitchAction(suggestion, event, item) ||
        shouldOpenSearchResultInBackgroundTab(event)) {
      recordSearchSuggestionSelection(suggestion, query);
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

  function refreshTabsForSearchContext(callback) {
    if (!chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
      if (typeof callback === 'function') {
        callback(false);
      }
      return;
    }
    const request = { action: 'getTabsForOverlay' };
    if (typeof currentNewtabTabId === 'number') {
      request.currentTabId = currentNewtabTabId;
    }
    let settled = false;
    let timeout = null;
    const finish = (ok) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      if (typeof callback === 'function') {
        callback(ok);
      }
    };
    timeout = setTimeout(() => finish(false), 240);
    chrome.runtime.sendMessage(request, (response) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        finish(false);
        return;
      }
      tabs = response && Array.isArray(response.tabs) ? response.tabs : [];
      currentNewtabTabId = response && typeof response.currentTabId === 'number'
        ? response.currentTabId
        : null;
      finish(true);
    });
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
  let openInCurrentTabModifierActive = false;
  let openSwitchInNewTabModifierActive = false;
  let openInBackgroundTabModifierActive = false;

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
    if (suggestionsView && typeof suggestionsView.setOpenInCurrentTabModifierActive === 'function') {
      suggestionsView.setOpenInCurrentTabModifierActive(nextOpenInCurrentTabActive);
    }
    if (suggestionsView && typeof suggestionsView.setOpenSwitchInNewTabModifierActive === 'function') {
      suggestionsView.setOpenSwitchInNewTabModifierActive(nextOpenSwitchInNewTabActive);
    }
    if (suggestionsView && typeof suggestionsView.setOpenInBackgroundTabModifierActive === 'function') {
      suggestionsView.setOpenInBackgroundTabModifierActive(nextOpenInBackgroundTabActive);
    }
  }

  function syncSuggestionActionModifiersFromEvent(event) {
    setSuggestionActionModifiersActive(
      Boolean(event && event.altKey),
      Boolean(event && event.shiftKey),
      Boolean(event && (event.metaKey || event.ctrlKey))
    );
  }

  function getAutoHighlightIndex() {
    return suggestionsView.getAutoHighlightIndex();
  }

  function isSameSuggestion(a, b) {
    if (!a || !b) {
      return false;
    }
    if (a.type !== b.type) {
      return false;
    }
    if ((a.url || '') !== (b.url || '')) {
      return false;
    }
    if ((a.title || '') !== (b.title || '')) {
      return false;
    }
    const providerA = a.provider && a.provider.key ? a.provider.key : '';
    const providerB = b.provider && b.provider.key ? b.provider.key : '';
    return providerA === providerB;
  }

  function isSuggestionPrefix(previous, next) {
    if (!Array.isArray(previous) || !Array.isArray(next)) {
      return false;
    }
    if (previous.length === 0 || previous.length > next.length) {
      return false;
    }
    for (let i = 0; i < previous.length; i += 1) {
      if (!isSameSuggestion(previous[i], next[i])) {
        return false;
      }
    }
    return true;
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

  function updateSelection() {
    if (!suggestionsView) {
      return;
    }
    suggestionsView.updateSelection(selectedIndex);
  }

  function activateRenderedSuggestion(suggestion, query, event, index, item) {
    if (suggestion.type === 'commandNewTab') {
      chrome.runtime.sendMessage({ action: 'openNewTab' });
      return;
    }
    if (suggestion.type === 'commandSettings') {
      chrome.runtime.sendMessage({ action: 'openOptionsPage' });
      return;
    }
    if (suggestion.type === 'siteSearchPrompt' && suggestion.provider) {
      activateSiteSearch(suggestion.provider);
      focusSearchInputPreservingScroll();
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
    if (Number.isInteger(index) && shouldSwitchMatchedTabSuggestion(suggestion, index)) {
      openMatchedTabSuggestion(suggestion, event, item, query);
      return;
    }
    if (suggestion.provider && suggestion.searchQuery) {
      runSiteSearchProviderQuery(
        suggestion.provider,
        suggestion.searchQuery,
        shouldOpenSearchResultInBackgroundTab(event) ? 'backgroundTab' : 'currentTab'
      );
      return;
    }
    if (shouldOpenSearchResultInBackgroundTab(event) && suggestion.url) {
      openSearchResultUrl(suggestion, query, event);
      return;
    }
    if (suggestion.forceSearch && suggestion.searchQuery) {
      navigateToQuery(suggestion.searchQuery, true);
      return;
    }
    openSearchResultUrl(suggestion, query, event);
  }

  function deleteRenderedHistorySuggestion(suggestion) {
    chrome.runtime.sendMessage({
      action: 'deleteHistoryUrl',
      url: suggestion.url
    }, function(response) {
      if (chrome.runtime && chrome.runtime.lastError) {
        return;
      }
      if (!response || response.ok !== true) {
        return;
      }
      const refreshQuery = latestQuery || (inputParts && inputParts.input ? String(inputParts.input.value || '').trim() : '');
      if (!refreshQuery) {
        clearSearchSuggestions();
        return;
      }
      requestSuggestions(refreshQuery, { immediate: true });
    });
  }

  function scrollSelectedSuggestionIntoView(direction, didWrap) {
    if (!suggestionsContainer || selectedIndex < 0) {
      return;
    }
    const item = suggestionItems[selectedIndex];
    if (typeof SUGGESTION_NAVIGATION.scrollItemIntoView !== 'function') {
      return;
    }
    SUGGESTION_NAVIGATION.scrollItemIntoView(suggestionsContainer, item, {
      direction,
      didWrap,
      inset: 8
    });
  }

  function renderTabSuggestions(tabList) {
    currentSuggestions = [];
    lastRenderedQuery = '';
    lastRenderedActionContextKey = '';
    suggestionsView.renderTabs(tabList);
  }

  function requestTabsAndRender() {
    tabs = [];
    clearSearchSuggestions();
  }

  function refreshTabsIfIdle() {
    if (!latestQuery || !latestQuery.trim()) {
      clearSearchSuggestions();
    }
  }

  function clearSearchSuggestions() {
    inlineSearchState = null;
    siteSearchTriggerState = null;
    clearSiteSearchTabHint();
    suggestionsView.clear();
    currentSuggestions = [];
    lastSuggestionResponse = [];
    selectedIndex = -1;
    lastRenderedQuery = '';
    lastRenderedActionContextKey = '';
  }

  function renderSuggestions(suggestions, query) {
    if (!query) {
      clearSearchSuggestions();
      return;
    }
    lastSuggestionResponse = Array.isArray(suggestions) ? suggestions : [];

    getShortcutRules().then((rules) => {
      if (query !== latestQuery) {
        return;
      }
      const rawTagInput = (latestRawQuery || inputParts.input.value || '').trim();
      const siteSearchQueryModeActive = Boolean(siteSearchState && String(query || '').trim());
      const modeCommandActive = !siteSearchQueryModeActive && isModeCommand(rawTagInput);
      const zenCommandActive = !siteSearchQueryModeActive && isZenCommand(rawTagInput);
      const toggleCommandActive = modeCommandActive || zenCommandActive;
      if (modeCommandActive) {
        if (storageArea) {
          storageArea.get([
            THEME_STORAGE_KEY,
            NEWTAB_THEME_MODE_STORAGE_KEY,
            NEWTAB_THEME_SCOPE_STORAGE_KEY
          ], (result) => {
            globalThemeMode = normalizeThemeMode(result ? result[THEME_STORAGE_KEY] : 'system');
            newtabThemeMode = normalizeNewtabThemeMode(result ? result[NEWTAB_THEME_MODE_STORAGE_KEY] : 'global');
            newtabThemeScope = normalizeNewtabThemeScope(result ? result[NEWTAB_THEME_SCOPE_STORAGE_KEY] : 'global');
            const storedMode = getScopedThemeMode();
            if (storedMode !== currentThemeMode && query === latestQuery) {
              applyThemeMode(storedMode);
              renderSuggestions([], query);
            }
          });
        }
      }
      const commandMatch = (!toggleCommandActive && !siteSearchQueryModeActive)
        ? getCommandMatch(rawTagInput)
        : null;
      const hasCommand = Boolean(commandMatch);
      const preSuggestions = [];
      if (modeCommandActive) {
        preSuggestions.push(buildModeSuggestion());
      } else if (zenCommandActive) {
        preSuggestions.push(buildZenSuggestion());
      } else if (!siteSearchQueryModeActive) {
        if (hasCommand) {
          preSuggestions.push(buildCommandSuggestion(commandMatch.command));
        }
        const directUrlSuggestion = getDirectUrlSuggestion(query);
        if (directUrlSuggestion) {
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
          if (query !== latestQuery) {
            return;
          }
          siteSearchProvidersCache = items;
          renderSuggestions(lastSuggestionResponse, query);
        });
      }
      const inlineCandidate = (!siteSearchQueryModeActive && !toggleCommandActive && !hasCommand)
        ? getInlineSiteSearchCandidate(rawTagInput, providersForTags)
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

      const newTabSuggestion = (toggleCommandActive || siteSearchQueryModeActive)
        ? null
        : {
          type: 'newtab',
          title: formatMessage('search_query', '搜索 "{query}"', {
            query: query
          }),
          url: buildDefaultSearchUrl(query),
          favicon: getDefaultSearchEngineFaviconUrl(),
          searchQuery: query,
          forceSearch: true
        };
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

      let allSuggestions = siteSearchQueryModeActive
        ? (siteSearchSuggestion ? [siteSearchSuggestion] : [])
        : (toggleCommandActive ? [...preSuggestions] : [...preSuggestions, newTabSuggestion, ...suggestions]);
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

      const keywordSuggestionState = getKeywordSearchSuggestionState(allSuggestions);
      const onlyKeywordSuggestions = keywordSuggestionState.onlyKeywordSuggestions;

      let autocompleteCandidate = null;
      let primaryHighlightIndex = -1;
      let primaryHighlightReason = 'none';
      let strongNavigationMatch = null;
      let topSiteMatch = null;
      let mergedProvider = null;
      let primarySuggestion = null;
      const inlineEnabled = Boolean(inlineSuggestion);
      let siteSearchTrigger = null;
      const preferAutocompleteFirst = searchResultPriorityMode !== 'search';
      if (!toggleCommandActive && !hasCommand) {
        if (!siteSearchState && !inlineEnabled && preferAutocompleteFirst) {
          strongNavigationMatch = promoteStrongNavigationMatch(allSuggestions, latestRawQuery.trim());
          if (strongNavigationMatch) {
            primaryHighlightIndex = 0;
            primaryHighlightReason = 'navigation';
          }
          topSiteMatch = promoteTopSiteMatch(allSuggestions, latestRawQuery.trim());
        }
        siteSearchTrigger = (!siteSearchState && !inlineEnabled)
          ? getSiteSearchTriggerCandidate(rawTagInput, providersForTags, topSiteMatch)
          : null;
        if (!siteSearchState && !inlineEnabled && !strongNavigationMatch && preferAutocompleteFirst && !onlyKeywordSuggestions) {
          autocompleteCandidate = getAutocompleteCandidate(keywordSuggestionState.autocompleteSuggestions, latestRawQuery);
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
          allSuggestions = filterBlacklistedSuggestions(allSuggestions, query);
          primaryHighlightIndex = 0;
          primaryHighlightReason = 'inline';
        } else if (!strongNavigationMatch && topSiteMatch && preferAutocompleteFirst) {
          primaryHighlightIndex = 0;
          primaryHighlightReason = 'topSite';
        }
        if (!siteSearchState && query && !onlyKeywordSuggestions && openTabQuickSwitchEnabled) {
          const openTabMatch = typeof SEARCH_UTILS.findSearchOpenTabMatchIndex === 'function'
            ? SEARCH_UTILS.findSearchOpenTabMatchIndex(allSuggestions, {
              rawQuery: latestRawQuery.trim(),
              primaryHighlightIndex,
              currentTabId: currentNewtabTabId,
              openTabQuickSwitchEnabled,
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
              rawInput: rawTagInput,
              isAuto: inlineAutoHighlight
            }
          : null;
        const resolvedProvider = siteSearchTrigger;
        siteSearchTriggerState = resolvedProvider
          ? { provider: resolvedProvider, rawInput: rawTagInput }
          : null;
        if (siteSearchTriggerState) {
          setSiteSearchTabHint(resolvedProvider);
        } else {
          clearSiteSearchTabHint();
        }
      } else if (modeCommandActive) {
        clearAutocomplete();
        inlineSearchState = null;
        siteSearchTriggerState = null;
        clearSiteSearchTabHint();
        primaryHighlightIndex = 0;
        primaryHighlightReason = 'modeSwitch';
      } else if (zenCommandActive) {
        clearAutocomplete();
        inlineSearchState = null;
        siteSearchTriggerState = null;
        clearSiteSearchTabHint();
        primaryHighlightIndex = 0;
        primaryHighlightReason = 'zenSwitch';
      } else if (hasCommand) {
        clearAutocomplete();
        inlineSearchState = null;
        siteSearchTriggerState = null;
        clearSiteSearchTabHint();
        primaryHighlightIndex = 0;
        primaryHighlightReason = 'command';
      }
      if (hasCommand) {
        applyAutocomplete(allSuggestions, primarySuggestion, primaryHighlightReason);
      }
      allSuggestions = limitSuggestionsForDisplay(allSuggestions);

      const actionContextKey = getSuggestionActionContextKey({
        primaryHighlightIndex,
        primaryHighlightReason,
        onlyKeywordSuggestions,
        primarySuggestion,
        mergedProvider
      });
      const canAppend = query === lastRenderedQuery &&
        actionContextKey === lastRenderedActionContextKey &&
        isSuggestionPrefix(currentSuggestions, allSuggestions);
      const startIndex = canAppend ? currentSuggestions.length : 0;

      currentSuggestions = allSuggestions;
      lastRenderedQuery = query;
      lastRenderedActionContextKey = actionContextKey;
      warmIconCache(allSuggestions);
      suggestionsView.render({
        suggestions: allSuggestions,
        query,
        canAppend,
        startIndex,
        primaryHighlightIndex,
        primarySuggestion,
        primaryHighlightReason,
        onlyKeywordSuggestions,
        mergedProvider
      });
      updateSelection();
      setSuggestionsVisible(true);
    });
  }

  function requestSuggestions(query, options) {
    latestQuery = query;
    const immediate = options && options.immediate;
    const retryCount = options && Number(options.retryCount) > 0 ? Number(options.retryCount) : 0;
    const requestStartedAt = Date.now();
    const requestQuery = latestQuery;
    const requestSeq = ++suggestionRequestSeq;
    if (remoteSuggestionDebounceTimer) {
      clearTimeout(remoteSuggestionDebounceTimer);
      remoteSuggestionDebounceTimer = null;
    }
    if (suggestionRequestWatchdogTimer) {
      clearTimeout(suggestionRequestWatchdogTimer);
      suggestionRequestWatchdogTimer = null;
    }
    suggestionRequestWatchdogTimer = setTimeout(function() {
      if (requestSeq !== suggestionRequestSeq || requestQuery !== latestQuery) {
        return;
      }
      if (retryCount < 1) {
        requestSuggestions(requestQuery, { immediate: true, retryCount: retryCount + 1 });
        return;
      }
      renderSuggestions([], requestQuery);
    }, immediate ? 1200 : 1300);
    chrome.runtime.sendMessage({
      action: 'getSearchSuggestions',
      query: requestQuery,
      context: 'newtab'
    }, function(response) {
      if (suggestionRequestWatchdogTimer) {
        clearTimeout(suggestionRequestWatchdogTimer);
        suggestionRequestWatchdogTimer = null;
      }
      if (requestSeq !== suggestionRequestSeq || requestQuery !== latestQuery) {
        return;
      }
      if (chrome.runtime && chrome.runtime.lastError) {
        renderSuggestions([], requestQuery);
        return;
      }
      const localSuggestions = response && Array.isArray(response.suggestions) ? response.suggestions : [];
      renderSuggestions(localSuggestions, requestQuery);
      refreshTabsForSearchContext(() => {});
      const remoteDelay = immediate ? 0 : Math.max(0, 120 - (Date.now() - requestStartedAt));
      remoteSuggestionDebounceTimer = setTimeout(function() {
        remoteSuggestionDebounceTimer = null;
        if (requestSeq !== suggestionRequestSeq || requestQuery !== latestQuery) {
          return;
        }
        chrome.runtime.sendMessage({
          action: 'getSearchEngineSuggestions',
          query: requestQuery,
          context: 'newtab',
          localSuggestions: localSuggestions
        }, function(remoteResponse) {
          if (requestSeq !== suggestionRequestSeq || requestQuery !== latestQuery) {
            return;
          }
          if (chrome.runtime && chrome.runtime.lastError) {
            return;
          }
          if (!remoteResponse ||
              remoteResponse.aborted === true ||
              remoteResponse.hasRemoteSuggestions !== true ||
              !Array.isArray(remoteResponse.suggestions)) {
            return;
          }
          renderSuggestions(remoteResponse.suggestions, requestQuery);
        });
      }, remoteDelay);
    });
  }

  inputParts = createSearchInput({
    useImportantStyles: false,
    useInlineBaseStyles: false,
    containerId: '_x_extension_newtab_input_container_2024_unique_',
    inputId: '_x_extension_newtab_search_input_2024_unique_',
    iconId: '_x_extension_newtab_search_icon_2024_unique_',
    placeholder: t('search_placeholder', defaultPlaceholderText),
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
      'color': 'var(--x-nt-subtext, #6B7280)'
    },
    rightIconStyleOverrides: {
      '--x-ext-input-right-icon-inset': '7px',
      cursor: 'pointer'
    },
    onInput: function(event) {
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
      if (isModeCommand(query) || isZenCommand(query) || getCommandMatch(query)) {
        latestQuery = query;
        renderSuggestions([], query);
        return;
      }
      if (isPaste || getDirectUrlSuggestion(query)) {
        latestQuery = query;
        renderSuggestions([], query);
        requestSuggestions(query, { immediate: true });
        return;
      }
      requestSuggestions(query);
    },
    onBlur: function(event) {
      const rawValue = event && event.target ? event.target.value : '';
      if (!isSlashCommandInput(rawValue)) {
        return;
      }
      latestRawQuery = '';
      latestQuery = '';
      clearAutocomplete();
      clearSearchSuggestions();
      if (event && event.target) {
        event.target.value = '';
      }
      updateModeBadge('');
    },
    onKeyDown: function(event) {
      syncSuggestionActionModifiersFromEvent(event);
      dismissAutocompletePreviewOnNonTabKey(event);
      if (event.key !== 'Backspace' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        latestRawQuery = inputParts.input.value;
        latestQuery = inputParts.input.value.trim();
      }
      if (event.key === 'Escape' && siteSearchState) {
        event.preventDefault();
        clearSiteSearch();
        return;
      }
      if (event.key === 'Backspace' && siteSearchState && !inputParts.input.value) {
        clearSiteSearch();
        return;
      }
      if (isImeCompositionEvent(event)) {
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (suggestionItems.length === 0) {
          return;
        }
        event.preventDefault();
        let didWrap = false;
        if (event.key === 'ArrowDown') {
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
        scrollSelectedSuggestionIntoView(event.key === 'ArrowDown' ? 'down' : 'up', didWrap);
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
      const commandMatch = getCommandMatch(query);
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
      if (isModeCommand(query)) {
        setVisibleThemeMode(getNextThemeMode(currentThemeMode));
        return;
      }
      if (isZenCommand(query)) {
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

  function isEditableElement(el) {
    if (!el) {
      return false;
    }
    const tagName = el.tagName ? el.tagName.toLowerCase() : '';
    if (tagName === 'input' || tagName === 'textarea') {
      return true;
    }
    return Boolean(el.isContentEditable);
  }

  function parseFallbackShortcut(shortcut) {
    const value = String(shortcut || '').trim();
    if (!value) {
      return null;
    }
    const parts = value.split('+').map((item) => String(item || '').trim()).filter(Boolean);
    if (parts.length === 0) {
      return null;
    }
    const keyToken = parts[parts.length - 1];
    const modifierTokens = parts.slice(0, -1);
    const spec = {
      ctrl: false,
      alt: false,
      shift: false,
      meta: false,
      key: ''
    };

    modifierTokens.forEach((token) => {
      const lower = token.toLowerCase();
      if (lower === 'ctrl' || lower === 'control' || lower === 'macctrl') {
        spec.ctrl = true;
      } else if (lower === 'alt' || lower === 'option') {
        spec.alt = true;
      } else if (lower === 'shift') {
        spec.shift = true;
      } else if (lower === 'command' || lower === 'cmd' || lower === 'meta' || lower === 'super') {
        spec.meta = true;
      }
    });

    const keyLower = keyToken.toLowerCase();
    const specialMap = {
      tab: 'Tab',
      enter: 'Enter',
      return: 'Enter',
      esc: 'Escape',
      escape: 'Escape',
      space: ' ',
      spacebar: ' ',
      up: 'ArrowUp',
      down: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight',
      comma: ',',
      period: '.',
      slash: '/',
      semicolon: ';',
      quote: '\'',
      minus: '-',
      plus: '+',
      backslash: '\\',
      backquote: '`',
      bracketleft: '[',
      bracketright: ']'
    };
    if (specialMap[keyLower]) {
      spec.key = specialMap[keyLower];
      return spec;
    }
    if (/^f\d{1,2}$/.test(keyLower)) {
      spec.key = keyLower.toUpperCase();
      return spec;
    }
    if (keyLower.length === 1) {
      spec.key = keyLower;
      return spec;
    }
    spec.key = keyToken;
    return spec;
  }

  function getFallbackShortcutKeyTokenFromCode(rawCode) {
    const code = String(rawCode || '').trim();
    if (!code) {
      return '';
    }
    if (/^Key[A-Z]$/.test(code)) {
      return code.slice(3).toLowerCase();
    }
    if (/^Digit[0-9]$/.test(code)) {
      return code.slice(5);
    }
    const codeMap = {
      Backquote: '`',
      Minus: '-',
      Equal: '+',
      BracketLeft: '[',
      BracketRight: ']',
      Backslash: '\\',
      Semicolon: ';',
      Quote: '\'',
      Comma: ',',
      Period: '.',
      Slash: '/',
      Space: ' ',
      Tab: 'Tab',
      Enter: 'Enter',
      Escape: 'Escape',
      ArrowUp: 'ArrowUp',
      ArrowDown: 'ArrowDown',
      ArrowLeft: 'ArrowLeft',
      ArrowRight: 'ArrowRight'
    };
    if (codeMap[code]) {
      return codeMap[code];
    }
    if (/^F\d{1,2}$/.test(code)) {
      return code.toUpperCase();
    }
    return '';
  }

  function getFallbackShortcutKeyTokenFromEvent(event) {
    if (!event) {
      return '';
    }
    return getFallbackShortcutKeyTokenFromCode(event.code) || String(event.key || '');
  }

  function shortcutMatchesEvent(event, spec) {
    if (!event || !spec) {
      return false;
    }
    if (Boolean(event.ctrlKey) !== spec.ctrl ||
      Boolean(event.altKey) !== spec.alt ||
      Boolean(event.shiftKey) !== spec.shift ||
      Boolean(event.metaKey) !== spec.meta) {
      return false;
    }
    const eventKey = getFallbackShortcutKeyTokenFromEvent(event);
    if (spec.key.length === 1) {
      return eventKey.toLowerCase() === spec.key;
    }
    if (spec.key.startsWith('F')) {
      return eventKey.toUpperCase() === spec.key;
    }
    return eventKey === spec.key;
  }

  function refreshFallbackShortcut(force) {
    const now = Date.now();
    if (!force && (now - fallbackShortcutRefreshAt) < 15000) {
      return;
    }
    fallbackShortcutRefreshAt = now;
    try {
      chrome.runtime.sendMessage({ action: 'getShowSearchShortcut' }, (response) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          return;
        }
        const nextShortcut = response && typeof response.shortcut === 'string'
          ? response.shortcut
          : '';
        if (nextShortcut === fallbackShortcutRaw) {
          return;
        }
        fallbackShortcutRaw = nextShortcut;
        fallbackShortcutSpec = parseFallbackShortcut(nextShortcut);
      });
    } catch (e) {
      // Ignore runtime bridge failures.
    }
  }

  function focusSearchInputPreservingScroll() {
    if (!inputParts || !inputParts.input) {
      return false;
    }
    try {
      inputParts.input.focus({ preventScroll: true });
    } catch (error) {
      inputParts.input.focus();
    }
    return document.activeElement === inputParts.input;
  }

  function tryFocusSearchInput(force) {
    if (!inputParts || !inputParts.input) {
      return false;
    }
    if (document.activeElement === inputParts.input) {
      return true;
    }
    if (!force) {
      const activeElement = document.activeElement;
      const hasMeaningfulActiveElement = Boolean(activeElement) &&
        activeElement !== document.body &&
        activeElement !== document.documentElement;
      if (hasMeaningfulActiveElement) {
        return false;
      }
    }
    return focusSearchInputPreservingScroll();
  }

  function activateNewtabShortcutFocus() {
    if (!tryFocusSearchInput(true)) {
      return false;
    }
    try {
      inputParts.input.select();
    } catch (e) {
      // Ignore selection failures.
    }
    return true;
  }

  if (chrome && chrome.runtime && chrome.runtime.onMessage && typeof chrome.runtime.onMessage.addListener === 'function') {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || message.action !== 'lumno:newtab-focus-input') {
        return;
      }
      if (document.visibilityState !== 'visible') {
        return;
      }
      const focused = activateNewtabShortcutFocus();
      sendResponse({ ok: focused });
      return;
    });
  }

  function scheduleAutoFocusRecovery() {
    const hasExplicitFocusHint = window.location.search.includes('focus=1') ||
      window.location.hash.includes('focus');

    const retryDelays = [0, 60, 140, 280, 520, 900, 1400];
    const attemptFocusIfVisible = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      if (!document.hasFocus()) {
        return;
      }
      tryFocusSearchInput(hasExplicitFocusHint);
    };

    retryDelays.forEach((delay) => {
      setTimeout(attemptFocusIfVisible, delay);
    });

    window.addEventListener('focus', () => {
      setTimeout(attemptFocusIfVisible, 0);
      setTimeout(refreshTabsIfIdle, 0);
    }, true);
    window.addEventListener('pageshow', () => {
      attemptFocusIfVisible();
      refreshTabsIfIdle();
    }, true);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        setTimeout(attemptFocusIfVisible, 0);
        setTimeout(refreshTabsIfIdle, 0);
      }
    }, true);
  }

  scheduleAutoFocusRecovery();
  refreshFallbackShortcut(true);

  function handleGlobalTypingFocus(event) {
    if (!event || event.defaultPrevented) {
      return;
    }
    refreshFallbackShortcut(false);
    if (fallbackShortcutSpec && shortcutMatchesEvent(event, fallbackShortcutSpec)) {
      event.preventDefault();
      event.stopPropagation();
      activateNewtabShortcutFocus();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    const activeElement = document.activeElement;
    if (activeElement === inputParts.input || isEditableElement(activeElement)) {
      return;
    }
    if (isImeCompositionEvent(event)) {
      focusSearchInputPreservingScroll();
      return;
    }
    const key = event.key || '';
    if (!key || key === 'Tab' || key === 'Escape' || key.startsWith('Arrow')) {
      return;
    }
    focusSearchInputPreservingScroll();
    const currentValue = inputParts.input.value || '';
    if (key === 'Backspace') {
      if (currentValue) {
        inputParts.input.value = currentValue.slice(0, -1);
        inputParts.input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      event.preventDefault();
      return;
    }
    if (key.length === 1) {
      inputParts.input.value = currentValue + key;
      inputParts.input.setSelectionRange(inputParts.input.value.length, inputParts.input.value.length);
      inputParts.input.dispatchEvent(new Event('input', { bubbles: true }));
      event.preventDefault();
    }
  }

  const handleBackgroundPointerFocus = NEWTAB_BACKGROUND_SEARCH_FOCUS.createBackgroundFocusHandler({
    getBackgroundTargets: () => [document.body, root, searchLayer],
    focusSearch: focusSearchInputPreservingScroll
  });

  window.addEventListener('keydown', handleGlobalTypingFocus, true);
  window.addEventListener('focus', () => refreshFallbackShortcut(true), true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refreshFallbackShortcut(false);
    }
  }, true);
  window.addEventListener('pointerdown', handleBackgroundPointerFocus, true);
  modeBadge = document.createElement('div');
  modeBadge.id = '_x_extension_newtab_mode_badge_2024_unique_';
  modeBadge.className = 'x-lumno-search-input-mode__badge';
  modeBadge.setAttribute('data-surface', 'newtab');
  modeBadge.setAttribute('data-visible', 'false');
  inputParts.container.appendChild(modeBadge);
  const searchInput = inputParts.input;
  searchInputRef = searchInput;
  const rightIcon = inputParts.rightIcon;
  wordmarkContainer = document.createElement('div');
  wordmarkContainer.id = '_x_extension_newtab_wordmark_2026_unique_';
  wordmarkContainer.setAttribute('aria-hidden', 'true');
  wordmarkContainer.style.cssText = `
    all: unset;
    width: 90vw;
    max-width: var(--x-nt-search-max-width, 720px);
    max-height: 74px;
    min-height: 0;
    margin: 0 0 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    position: relative;
    z-index: 3;
    overflow: hidden;
    pointer-events: auto;
    opacity: 1;
    transform: translate3d(0, 0, 0);
    transition: ${WORDMARK_VISIBILITY_TRANSITION_CSS};
    user-select: none;
  `;
  const wordmarkButton = document.createElement('button');
  wordmarkButton.type = 'button';
  wordmarkButton.setAttribute('aria-label', 'Lumno Chrome Web Store');
  wordmarkButton.style.cssText = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    cursor: pointer;
    line-height: 0;
    pointer-events: auto;
  `;
  function openWordmarkUrl(event) {
    event.preventDefault();
    event.stopPropagation();
    openExternalNewTabUrl(LUMNO_CHROME_WEB_STORE_URL, event);
  }
  wordmarkButton.addEventListener('click', openWordmarkUrl);
  wordmarkButton.addEventListener('auxclick', (event) => {
    if (!isMiddleClick(event)) {
      return;
    }
    openWordmarkUrl(event);
  });
  const shouldAnimateWordmarkEntry = !window.matchMedia ||
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  wordmarkContainer.setAttribute('data-enter', shouldAnimateWordmarkEntry ? 'run' : 'done');
  if (shouldAnimateWordmarkEntry) {
    wordmarkButton.addEventListener('animationend', (event) => {
      if (!event || event.animationName === WORDMARK_ENTRY_ANIMATION_NAME) {
        finishWordmarkEntryAnimation();
      }
    });
    wordmarkButton.addEventListener('animationcancel', finishWordmarkEntryAnimation);
  }
  wordmarkSolidEl = document.createElement('span');
  wordmarkSolidEl.setAttribute('aria-hidden', 'true');
  wordmarkSolidEl.style.cssText = `
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    opacity: 0;
    background: var(--x-nt-wordmark-solid-fill, rgb(31 41 55));
    -webkit-mask: url("../../assets/images/lumno-wordmark-mask.svg") center / contain no-repeat;
    mask: url("../../assets/images/lumno-wordmark-mask.svg") center / contain no-repeat;
    contain: paint;
    transition: background-color 180ms ease, opacity 180ms ease;
  `;
  wordmarkImageEl = document.createElement('img');
  wordmarkImageEl.src = '../../assets/images/lumno-wordmark.svg';
  wordmarkImageEl.alt = '';
  wordmarkImageEl.draggable = false;
  wordmarkImageEl.style.cssText = `
    width: 180px;
    max-width: 52%;
    height: auto;
    display: block;
    position: relative;
    z-index: 1;
    object-fit: contain;
    opacity: 0.82;
    filter: none;
    transform: translateY(0);
    transition: opacity 180ms ease;
  `;
  wordmarkButton.appendChild(wordmarkSolidEl);
  wordmarkButton.appendChild(wordmarkImageEl);
  wordmarkContainer.appendChild(wordmarkButton);
  applyNewtabWordmarkVisibility();
  applyWordmarkThemeAppearance();
  searchLayer = document.createElement('div');
  searchLayer.id = '_x_extension_newtab_search_layer_2024_unique_';
  updateNoticeController = typeof UPDATE_NOTICE.createUpdateNotice === 'function'
    ? UPDATE_NOTICE.createUpdateNotice({
      documentObj: document,
      featureHints: FEATURE_HINTS,
      chromeApi: chrome,
      surface: 'newtab',
      t,
      getRiSvg,
      onDetailsClick(_notice, event) {
        chrome.runtime.sendMessage({
          action: 'openReleasePage',
          reason: 'notice',
          disposition: getOpenDisposition(event, 'newTab')
        });
      }
    })
    : null;

  if (rightIcon) {
    rightIcon.addEventListener('click', function(event) {
      event.preventDefault();
      event.stopPropagation();
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
        return;
      }
      const optionsUrl = typeof EXTENSION_ROUTES.buildOptionsUrl === 'function'
        ? EXTENSION_ROUTES.buildOptionsUrl(chrome)
        : chrome.runtime.getURL('src/options/options.html');
      window.open(optionsUrl, '_blank');
    });
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

  if (storageArea) {
    storageArea.get([SEARCH_RESULT_PRIORITY_STORAGE_KEY, OVERLAY_TAB_PRIORITY_STORAGE_KEY], (result) => {
      const raw = result ? result[SEARCH_RESULT_PRIORITY_STORAGE_KEY] : null;
      const nextMode = normalizeSearchResultPriority(raw);
      searchResultPriorityMode = nextMode;
      openTabQuickSwitchEnabled = normalizeOverlayTabPriorityMode(
        result ? result[OVERLAY_TAB_PRIORITY_STORAGE_KEY] : null
      );
      if (raw !== nextMode) {
        storageArea.set({ [SEARCH_RESULT_PRIORITY_STORAGE_KEY]: nextMode });
      }
    });
  }
  const defaultPlaceholder = searchInput.placeholder;
  const defaultCaretColor = searchInput.style.caretColor || '#7DB7FF';
  const inputModePrefixTransition = 'opacity 220ms cubic-bezier(0.22, 1, 0.36, 1), transform 300ms cubic-bezier(0.22, 1, 0.36, 1), filter 260ms cubic-bezier(0.22, 1, 0.36, 1), background-color 180ms ease, box-shadow 180ms ease';
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
    getProviderThemeHost,
    getSiteSearchPrefixText,
    getSiteSearchDisplayName,
    isAiSiteSearchProvider,
    attachFaviconData,
    attachProviderIcon: attachInputModeProviderIcon,
    formatMessage,
    isTabHintSuppressed: () => Boolean(siteSearchState)
  });
  siteSearchTabHint = inputModeController.tabHintElement;

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
  function handleNewtabResize() {
    newtabResizeFrame = 0;
    const previousBookmarkLimit = getBookmarkLimit();
    applyNewtabWidthMode();
    const recentColumnsChanged = applyRecentGridColumns();
    const bookmarkColumnsChanged = applyBookmarkGridColumns();
    updateSiteSearchPrefixLayout();
    if (bookmarkColumnsChanged && bookmarkLoadedOnce) {
      keepBookmarkPageAnchorAfterLimitChange(previousBookmarkLimit);
      renderCurrentBookmarkPage();
    }
    updateBookmarkGridHeightLock();
    updateBookmarkSectionPosition();
    positionBookmarkCascadeLevels();
    updateSuggestionsFloatingLayout();
    if (recentColumnsChanged) {
      markRecentDataDirty();
      loadRecentSites({ force: true });
    }
  }

  window.addEventListener('resize', () => {
    if (newtabResizeFrame) {
      return;
    }
    newtabResizeFrame = window.requestAnimationFrame(handleNewtabResize);
  }, { passive: true });

  handleTabKey = function(event) {
    if (siteSearchState) {
      return false;
    }
    const rawValue = inputParts.input.value;
    const rawTrigger = latestRawQuery || rawValue;
    const triggerInput = (rawTrigger || rawValue).trim();
    if (siteSearchTriggerState &&
        siteSearchTriggerState.rawInput === triggerInput &&
        siteSearchTriggerState.provider) {
      event.preventDefault();
      activateSiteSearch(siteSearchTriggerState.provider);
      return true;
    }
    if (triggerInput) {
      event.preventDefault();
      const providers = (siteSearchProvidersCache && siteSearchProvidersCache.length > 0)
        ? siteSearchProvidersCache
        : defaultSiteSearchProviders;
      const topSiteMatch = getTopSiteMatchCandidate(currentSuggestions, triggerInput);
      const directProvider = getSiteSearchTriggerCandidate(triggerInput, providers, topSiteMatch);
      if (directProvider) {
        activateSiteSearch(directProvider);
        return true;
      }
      getSiteSearchProviders().then((items) => {
        const asyncTopSiteMatch = getTopSiteMatchCandidate(currentSuggestions, triggerInput);
        const asyncProvider = getSiteSearchTriggerCandidate(triggerInput, items, asyncTopSiteMatch);
        if (asyncProvider) {
          activateSiteSearch(asyncProvider);
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
    syncSuggestionActionModifiersFromEvent(event);
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
  }, true);
  window.addEventListener('blur', function() {
    setSuggestionActionModifiersActive(false, false, false);
  });

  getSiteSearchProviders();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (!storageAreaName || areaName !== storageAreaName ||
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
      siteSearchProvidersCache = typeof SITE_SEARCH_STORE.mergeStoredProviders === 'function'
        ? SITE_SEARCH_STORE.mergeStoredProviders(
          defaultSiteSearchProviders,
          customItems,
          disabledKeys,
          SEARCH_UTILS.mergeCustomProviders
        )
        : defaultSiteSearchProviders.slice();
      if (latestQuery) {
        requestSuggestions(latestQuery, { immediate: true });
      }
    });
  });

  inputParts.input.addEventListener('compositionstart', function(event) {
    suggestionRequestSeq += 1;
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
    requestSuggestions(query);
  });

  if (BOOKMARK_CASCADE_DEBUG_UI_ENABLED && bookmarkCascadeRuntime) {
    bookmarkCascadeRuntime.createDebugControls();
  }
  createWallpaperControls();
  createFeedbackControls();
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
    closeWallpaperPanel({ restoreFocus: true });
  }, true);

  document.body.insertBefore(wordmarkContainer, root);
  searchLayer.appendChild(inputParts.container);
  root.appendChild(searchLayer);
  const newtabUpdateNoticeAnchor = root.nextSibling;
  if (shortcutSection) {
    document.body.insertBefore(shortcutSection, newtabUpdateNoticeAnchor);
  }
  if (updateNoticeController && updateNoticeController.element) {
    document.body.insertBefore(updateNoticeController.element, newtabUpdateNoticeAnchor);
  }
  document.body.insertBefore(suggestionsSurface, newtabUpdateNoticeAnchor);
  document.body.insertBefore(suggestionsOutline, newtabUpdateNoticeAnchor);
  document.body.insertBefore(suggestionsContainer, newtabUpdateNoticeAnchor);
  bottomDockRuntime.mount(document.body);
  if (wallpaperControl) {
    document.body.appendChild(wallpaperControl);
  }
  if (feedbackControl) {
    document.body.appendChild(feedbackControl);
  }
  if (shortcutDialogBackdrop) {
    document.body.appendChild(shortcutDialogBackdrop);
  }
  if (BOOKMARK_CASCADE_DEBUG_UI_ENABLED && bookmarkCascadeRuntime && bookmarkCascadeRuntime.getDebugControl()) {
    document.body.appendChild(bookmarkCascadeRuntime.getDebugControl());
  }

  function scheduleRecentReloadIfVisible() {
    if (document.visibilityState !== 'visible') {
      return;
    }
    loadRecentSites({ force: true });
  }

  function scheduleBookmarkReloadIfVisible() {
    if (document.visibilityState !== 'visible') {
      return;
    }
    loadBookmarks({ force: true });
  }

  function bindRecentAndBookmarkChangeListeners() {
    if (chrome.history && chrome.history.onVisited && chrome.history.onVisited.addListener) {
      chrome.history.onVisited.addListener(() => {
        markRecentDataDirty();
        scheduleRecentReloadIfVisible();
      });
    }
    if (chrome.bookmarks) {
      const bindBookmarkEvent = (eventName) => {
        const eventTarget = chrome.bookmarks[eventName];
        if (!eventTarget || !eventTarget.addListener) {
          return;
        }
        eventTarget.addListener(() => {
          markBookmarkTreeDirty();
          scheduleBookmarkReloadIfVisible();
        });
      };
      bindBookmarkEvent('onCreated');
      bindBookmarkEvent('onRemoved');
      bindBookmarkEvent('onChanged');
      bindBookmarkEvent('onMoved');
      bindBookmarkEvent('onChildrenReordered');
      bindBookmarkEvent('onImportEnded');
    }
  }

  bindRecentAndBookmarkChangeListeners();
  window.addEventListener('visibilitychange', handleRecentVisibilityChange);
  window.addEventListener('resize', scheduleWallpaperAdaptiveToneUpdate, { passive: true });
  window.addEventListener('scroll', () => {
    scheduleWallpaperAdaptiveToneUpdate();
    positionBookmarkCascadeLevels();
  }, { passive: true });
  bottomDockRuntime.onScroll(scheduleWallpaperAdaptiveToneUpdate, { passive: true });
  const shortcutsReadyPromise = loadNewtabShortcutsVisibility().then(loadVisibleShortcuts);
  Promise.all([
    bootstrapInitialThemeMode(),
    bootstrapInitialLanguageMode(),
    bootstrapInitialWallpaper(),
    bootstrapInitialWallpaperOverlay(),
    bootstrapInitialWallpaperEffect(),
    bootstrapInitialNewtabFavicon(),
    loadZenMode(),
    loadSearchBlacklistItems(),
    loadFaviconRequestBlacklistItems()
  ]).then(() => {
    hydrateSectionsFromCache();
    return shortcutsReadyPromise;
  }).then(() => {
    loadRecentSites();
    loadBookmarks();
    maybeShowFileAccessNotice();
    markNewtabReady();
  });
  updateBookmarkSectionPosition();

})();
