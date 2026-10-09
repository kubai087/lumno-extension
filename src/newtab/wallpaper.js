(function() {
  const WALLPAPER_ADAPTIVE_TONE = globalThis.LumnoNewtabWallpaperAdaptiveTone;
  const WALLPAPER_EFFECTS = globalThis.LumnoNewtabWallpaperEffects;
  const WALLPAPER_LOCAL_STORE = globalThis.LumnoNewtabWallpaperLocalStore;
  const SETTINGS = globalThis.LumnoSettings;
  const REMOTE_CONTENT = globalThis.LumnoNewtabRemoteContent;
  const DEFAULT_STORAGE_KEYS = {
    wallpaper: '_x_extension_newtab_wallpaper_2026_unique_',
    localWallpaper: '_x_extension_newtab_local_wallpaper_2026_unique_',
    onlineWallpaper: SETTINGS.NEWTAB_ONLINE_WALLPAPER_STORAGE_KEY,
    linkWallpapers: SETTINGS.NEWTAB_LINK_WALLPAPERS_STORAGE_KEY,
    dailyWallpaperPicks: SETTINGS.NEWTAB_DAILY_WALLPAPER_PICKS_STORAGE_KEY,
    overlay: '_x_extension_newtab_wallpaper_overlay_2026_unique_',
    effect: '_x_extension_newtab_wallpaper_effect_2026_unique_',
    topContentMode: SETTINGS.NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY ||
      '_x_extension_newtab_wordmark_visible_2026_unique_',
    timeFontWeight: SETTINGS.NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY ||
      '_x_extension_newtab_time_font_weight_2026_unique_',
    timeSecondsVisible: SETTINGS.NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY ||
      '_x_extension_newtab_time_seconds_visible_2026_unique_',
    favicon: '_x_extension_newtab_favicon_2026_unique_'
  };
  const PRELOAD_STORAGE_KEY = '_x_extension_newtab_wallpaper_preload_2026_unique_';
  const PRELOAD_STORAGE_VERSION = 4;
  const WALLPAPER_EFFECT_MODE_STORAGE_VERSION = 11;
  const NEWTAB_TIME_FONT_WEIGHT_MIN = Number(SETTINGS.NEWTAB_TIME_FONT_WEIGHT_MIN) || 300;
  const NEWTAB_TIME_FONT_WEIGHT_MAX = Number(SETTINGS.NEWTAB_TIME_FONT_WEIGHT_MAX) || 800;
  const NEWTAB_TIME_FONT_WEIGHT_DEFAULT = Number(SETTINGS.NEWTAB_TIME_FONT_WEIGHT_DEFAULT) || 320;
  const CRT_PARAMETER_PHYSICAL_MAX = Object.freeze({
    crtStrength: 20,
    crtBloom: 20,
    crtRgbOffset: 100,
    crtCurvature: 35
  });
  const BLOCK_PARAMETER_MAX = 5;
  function getCrtParameterPercent(key, value) {
    const physicalMax = CRT_PARAMETER_PHYSICAL_MAX[key];
    const number = Number(value);
    if (!Number.isFinite(physicalMax) || !Number.isFinite(number) || physicalMax <= 0) {
      return 0;
    }
    return Math.round(Math.max(0, Math.min(100, (number / physicalMax) * 100)));
  }

  function getCrtParameterPhysicalValue(key, percent) {
    const physicalMax = CRT_PARAMETER_PHYSICAL_MAX[key];
    const number = Number(percent);
    if (!Number.isFinite(physicalMax) || !Number.isFinite(number) || physicalMax <= 0) {
      return 0;
    }
    return Math.round((Math.max(0, Math.min(100, number)) / 100) * physicalMax * 1000) / 1000;
  }

  function normalizeSingleWallpaperEffectPrefs(value, inheritedVersion) {
    return WALLPAPER_EFFECTS.normalizePrefs(value, inheritedVersion);
  }

  function normalizeWallpaperEffectStoragePrefs(value) {
    return WALLPAPER_EFFECTS.normalizeStoragePrefs(value);
  }

  function createWallpaperRuntime(options) {
    options = options || {};
    const documentObj = options.documentObj || document;
    const windowObj = options.windowObj || window;
    const document = documentObj;
    const window = windowObj;
    const chrome = options.chromeObj || globalThis.chrome || {};
    const extensionRoutes = options.extensionRoutes || globalThis.LumnoExtensionRoutes || {};
    const storageArea = options.storageArea || null;
    const localWallpaperStorageArea = options.localWallpaperStorageArea || null;
    const wallpaperView = options.view || globalThis.LumnoNewtabWallpaperView || null;
    const storageKeys = Object.assign({}, DEFAULT_STORAGE_KEYS, options.storageKeys || {});
    const NEWTAB_WALLPAPER_STORAGE_KEY = storageKeys.wallpaper;
    const NEWTAB_LOCAL_WALLPAPER_STORAGE_KEY = storageKeys.localWallpaper;
    const NEWTAB_ONLINE_WALLPAPER_STORAGE_KEY = storageKeys.onlineWallpaper;
    const NEWTAB_LINK_WALLPAPERS_STORAGE_KEY = storageKeys.linkWallpapers;
    const NEWTAB_DAILY_WALLPAPER_PICKS_STORAGE_KEY = storageKeys.dailyWallpaperPicks;
    const NEWTAB_WALLPAPER_OVERLAY_STORAGE_KEY = storageKeys.overlay;
    const NEWTAB_WALLPAPER_EFFECT_STORAGE_KEY = storageKeys.effect;
    const NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY = storageKeys.topContentMode;
    const NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY = storageKeys.timeFontWeight;
    const NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY = storageKeys.timeSecondsVisible;
    const NEWTAB_FAVICON_STORAGE_KEY = storageKeys.favicon;
    const t = typeof options.t === 'function'
      ? options.t
      : function(_key, fallback) { return fallback || ''; };
    const formatMessage = typeof options.formatMessage === 'function'
      ? options.formatMessage
      : function(_key, fallback, params) {
        let text = fallback || '';
        Object.keys(params || {}).forEach((token) => {
          text = text.replace(new RegExp('\\{' + token + '\\}', 'g'), params[token]);
        });
        return text;
      };
    const getThemeMode = typeof options.getThemeMode === 'function'
      ? options.getThemeMode
      : function() { return 'system'; };
    const getEffectiveThemeMode = typeof options.getEffectiveThemeMode === 'function'
      ? options.getEffectiveThemeMode
      : getThemeMode;
    const getThemeScope = typeof options.getThemeScope === 'function'
      ? options.getThemeScope
      : function() { return 'global'; };
    const setThemeMode = typeof options.setThemeMode === 'function'
      ? options.setThemeMode
      : function() {};
    const setThemeScope = typeof options.setThemeScope === 'function'
      ? options.setThemeScope
      : function() {};
    const BroadcastChannelCtor = typeof options.BroadcastChannel === 'function'
      ? options.BroadcastChannel
      : (window && typeof window.BroadcastChannel === 'function'
        ? window.BroadcastChannel
        : (typeof globalThis.BroadcastChannel === 'function' ? globalThis.BroadcastChannel : null));
    const searchWidthConfig = Object.assign({
      min: 720,
      max: 1040,
      fallback: 920,
      snapPoints: [720, 920, 1040],
      snapThreshold: 14
    }, options.searchWidthConfig || {});
    const getSearchWidth = typeof options.getSearchWidth === 'function'
      ? options.getSearchWidth
      : function() { return searchWidthConfig.fallback; };
    const setSearchWidth = typeof options.setSearchWidth === 'function'
      ? options.setSearchWidth
      : function() {};
    const shortcutColumnsConfig = Object.assign({
      min: 4,
      max: 16,
      fallback: 10
    }, options.shortcutColumnsConfig || {});
    const shortcutSizeConfig = Object.assign({
      min: 48,
      max: 80,
      fallback: 64
    }, options.shortcutSizeConfig || {});
    const shortcutGapConfig = Object.assign({
      min: 0,
      max: 24,
      fallback: 4
    }, options.shortcutGapConfig || {});
    const getShortcutsVisible = typeof options.getShortcutsVisible === 'function'
      ? options.getShortcutsVisible
      : function() { return true; };
    const setShortcutsVisible = typeof options.setShortcutsVisible === 'function'
      ? options.setShortcutsVisible
      : function() {};
    const getShortcutAddVisible = typeof options.getShortcutAddVisible === 'function'
      ? options.getShortcutAddVisible
      : function() { return true; };
    const setShortcutAddVisible = typeof options.setShortcutAddVisible === 'function'
      ? options.setShortcutAddVisible
      : function() {};
    const getShortcutDockMagnificationEnabled =
      typeof options.getShortcutDockMagnificationEnabled === 'function'
        ? options.getShortcutDockMagnificationEnabled
        : function() { return true; };
    const setShortcutDockMagnificationEnabled =
      typeof options.setShortcutDockMagnificationEnabled === 'function'
        ? options.setShortcutDockMagnificationEnabled
        : function() {};
    const getShortcutColumns = typeof options.getShortcutColumns === 'function'
      ? options.getShortcutColumns
      : function() { return shortcutColumnsConfig.fallback; };
    const setShortcutColumns = typeof options.setShortcutColumns === 'function'
      ? options.setShortcutColumns
      : function() {};
    const getShortcutSize = typeof options.getShortcutSize === 'function'
      ? options.getShortcutSize
      : function() { return shortcutSizeConfig.fallback; };
    const setShortcutSize = typeof options.setShortcutSize === 'function'
      ? options.setShortcutSize
      : function() {};
    const getShortcutGap = typeof options.getShortcutGap === 'function'
      ? options.getShortcutGap
      : function() { return shortcutGapConfig.fallback; };
    const setShortcutGap = typeof options.setShortcutGap === 'function'
      ? options.setShortcutGap
      : function() {};
    const featureHints = options.featureHints || globalThis.LumnoFeatureHints || {};
    const getInputAutoFocusEnabled = typeof options.getInputAutoFocusEnabled === 'function'
      ? options.getInputAutoFocusEnabled
      : function() { return false; };
    const setInputAutoFocusEnabled = typeof options.setInputAutoFocusEnabled === 'function'
      ? options.setInputAutoFocusEnabled
      : function() {};
    const inputAutoFocusReady = options.inputAutoFocusReady &&
      typeof options.inputAutoFocusReady.then === 'function'
      ? options.inputAutoFocusReady
      : Promise.resolve();
    const featureHintVisibilityGate = options.featureHintVisibilityGate &&
      typeof options.featureHintVisibilityGate.then === 'function'
      ? options.featureHintVisibilityGate
      : null;
    const getRiSvg = typeof options.getRiSvg === 'function'
      ? options.getRiSvg
      : function(id, sizeClass) {
        const size = sizeClass || 'ri-size-16';
        return '<i class="ri-icon ' + size + ' ' + id + '" aria-hidden="true"></i>';
      };
    const showToast = typeof options.showToast === 'function' ? options.showToast : function() {};
    const beginToast = typeof options.beginToast === 'function'
      ? options.beginToast
      : function() {
        return {
          update() {},
          done(result) { if (result) showToast(result, false); },
          fail(result) { if (result) showToast(result, true); },
          cancel() {}
        };
      };
    const showTopActionTooltip = typeof options.showTopActionTooltip === 'function'
      ? options.showTopActionTooltip
      : function() {};
    const hideTopActionTooltip = typeof options.hideTopActionTooltip === 'function'
      ? options.hideTopActionTooltip
      : function() {};
    const applyWordmarkThemeAppearance = typeof options.applyWordmarkThemeAppearance === 'function'
      ? options.applyWordmarkThemeAppearance
      : function() {};
    const hasTopContentModeGetter = typeof options.getTopContentMode === 'function';
    const getTopContentMode = hasTopContentModeGetter
      ? options.getTopContentMode
      : function() { return 'brand'; };
    const setTopContentMode = typeof options.setTopContentMode === 'function'
      ? options.setTopContentMode
      : function() {};
    const hasTimeFontWeightGetter = typeof options.getTimeFontWeight === 'function';
    const getTimeFontWeight = hasTimeFontWeightGetter
      ? options.getTimeFontWeight
      : function() { return NEWTAB_TIME_FONT_WEIGHT_DEFAULT; };
    const setTimeFontWeight = typeof options.setTimeFontWeight === 'function'
      ? options.setTimeFontWeight
      : function() {};
    const hasTimeSecondsVisibleGetter = typeof options.getTimeSecondsVisible === 'function';
    const getTimeSecondsVisible = hasTimeSecondsVisibleGetter
      ? options.getTimeSecondsVisible
      : function() { return false; };
    const setTimeSecondsVisible = typeof options.setTimeSecondsVisible === 'function'
      ? options.setTimeSecondsVisible
      : function() {};
    const getAdaptiveToneTargets = typeof options.getAdaptiveToneTargets === 'function'
      ? options.getAdaptiveToneTargets
      : function() { return []; };
    const localWallpaperStore = WALLPAPER_LOCAL_STORE.createWallpaperLocalStore({
      documentObj,
      windowObj
    });
    const wallpaperImageCache = typeof WALLPAPER_LOCAL_STORE.createWallpaperImageCache === 'function'
      ? WALLPAPER_LOCAL_STORE.createWallpaperImageCache({ windowObj })
      : null;
    const remoteClient = REMOTE_CONTENT.createClient({
      storageArea: localWallpaperStorageArea,
      fetch: options.fetchRemoteContent,
      getLanguage: () => document.documentElement && document.documentElement.lang ||
        (chrome.i18n && chrome.i18n.getUILanguage ? chrome.i18n.getUILanguage() : 'en')
    });

    const NEWTAB_WALLPAPER_DEFAULT_DIRECTORY = 'assets/wallpapers';
    const NEWTAB_WALLPAPER_EXTENSION_DIRECTORY = 'assets/wallpapers';
    const NEWTAB_WALLPAPER_THUMBNAIL_SUFFIX = '-thumb.webp';
    const NEWTAB_WALLPAPER_DEFAULT_ID = 'monet-coastal-white';
    const NEWTAB_CUSTOM_WALLPAPER_ID = WALLPAPER_LOCAL_STORE.CUSTOM_WALLPAPER_ID || 'custom-upload';
    const NEWTAB_LOCAL_WALLPAPER_DISABLED_VALUE = '__lumno_local_wallpaper_disabled__';
    const NEWTAB_WALLPAPER_PREFS_STORAGE_VERSION = 2;
    const NEWTAB_WALLPAPER_MODE_LIGHT = 'light';
    const NEWTAB_WALLPAPER_MODE_DARK = 'dark';
    const NEWTAB_WALLPAPER_MODES = [NEWTAB_WALLPAPER_MODE_LIGHT, NEWTAB_WALLPAPER_MODE_DARK];
    const NEWTAB_WALLPAPER_OPTIONS = [
      {
        id: 'dark-linocut-topographic',
        nameKey: 'newtab_wallpaper_name_dark_linocut_topographic',
        fallbackName: 'Night topography',
        file: 'lumno-newtab-dark-linocut-topographic.webp'
      },
      {
        id: 'dark-monet-lily-nocturne',
        nameKey: 'newtab_wallpaper_name_dark_monet_lily_nocturne',
        fallbackName: 'Lily nocturne',
        file: 'lumno-newtab-dark-monet-lily-nocturne.webp'
      },
      {
        id: 'dark-shanshui-moonlit',
        nameKey: 'newtab_wallpaper_name_dark_shanshui_moonlit',
        fallbackName: 'Moonlit shanshui',
        file: 'lumno-newtab-dark-shanshui-moonlit.webp'
      },
      {
        id: 'monet-coastal-white',
        nameKey: 'newtab_wallpaper_name_monet_coastal_white',
        fallbackName: 'Monet coast',
        file: 'lumno-newtab-monet-coastal-white.webp'
      },
      {
        id: 'monet-field-white',
        nameKey: 'newtab_wallpaper_name_monet_field_white',
        fallbackName: 'Monet field',
        file: 'lumno-newtab-monet-field-white.webp'
      },
      {
        id: 'monet-lily-pond-white',
        nameKey: 'newtab_wallpaper_name_monet_lily_pond_white',
        fallbackName: 'Lily pond',
        file: 'lumno-newtab-monet-lily-pond-white.webp'
      },
      {
        id: 'impressionist-orchard-white',
        nameKey: 'newtab_wallpaper_name_impressionist_orchard_white',
        fallbackName: 'Orchard morning',
        file: 'lumno-newtab-impressionist-orchard-white.webp'
      },
      {
        id: 'seurat-coast-white',
        nameKey: 'newtab_wallpaper_name_seurat_coast_white',
        fallbackName: 'Seurat coast',
        file: 'lumno-newtab-seurat-coast-white.webp'
      },
      {
        id: 'seurat-park-white',
        nameKey: 'newtab_wallpaper_name_seurat_park_white',
        fallbackName: 'Seurat park',
        file: 'lumno-newtab-seurat-park-white.webp'
      },
      {
        id: 'seurat-riverside-white',
        nameKey: 'newtab_wallpaper_name_seurat_riverside_white',
        fallbackName: 'Seurat riverside',
        file: 'lumno-newtab-seurat-riverside-white.webp'
      },
      {
        id: 'pointillist-lakeside-white',
        nameKey: 'newtab_wallpaper_name_pointillist_lakeside_white',
        fallbackName: 'Lakeside pointillism',
        file: 'lumno-newtab-pointillist-lakeside-white.webp'
      },
      {
        id: 'white-3d-architecture',
        nameKey: 'newtab_wallpaper_name_white_3d_architecture',
        fallbackName: 'Daylight architecture',
        file: 'lumno-newtab-white-3d-architecture.webp'
      },
      {
        id: 'white-3d-observatory',
        nameKey: 'newtab_wallpaper_name_white_3d_observatory',
        fallbackName: 'Misty observatory',
        file: 'lumno-newtab-white-3d-observatory.webp'
      },
      {
        id: 'white-linocut-topographic',
        nameKey: 'newtab_wallpaper_name_white_linocut_topographic',
        fallbackName: 'Daylight topography',
        file: 'lumno-newtab-white-linocut-topographic.webp'
      },
      {
        id: 'white-risograph-collage',
        nameKey: 'newtab_wallpaper_name_white_risograph_collage',
        fallbackName: 'Daylight collage',
        file: 'lumno-newtab-white-risograph-collage.webp'
      },
      {
        id: 'white-shanshui',
        nameKey: 'newtab_wallpaper_name_white_shanshui',
        fallbackName: 'Clear shanshui',
        file: 'lumno-newtab-white-shanshui.webp'
      },
      {
        id: 'white-shanshui-bamboo-bridge',
        nameKey: 'newtab_wallpaper_name_white_shanshui_bamboo_bridge',
        fallbackName: 'Bamboo bridge',
        file: 'lumno-newtab-white-shanshui-bamboo-bridge.webp'
      },
      {
        id: 'settings-bg-light-monet-newtab',
        nameKey: 'newtab_wallpaper_name_settings_bg_light_monet_newtab',
        fallbackName: 'Monet light',
        file: 'settings-bg-light-monet-newtab.webp'
      }
    ];
    const NEWTAB_WALLPAPER_OVERLAY_STORAGE_VERSION = 2;
    const NEWTAB_WALLPAPER_OVERLAY_DEFAULTS = { light: 50, dark: 50 };
    const NEWTAB_WALLPAPER_OVERLAY_SNAP_POINTS = [0, 50, 100];
    const NEWTAB_WALLPAPER_OVERLAY_SNAP_THRESHOLD = 4;
    const NEWTAB_WALLPAPER_OVERLAY_STOPS = {
      light: { top: 54, mid: 20, bottom: 38 },
      dark: { top: 44, mid: 20, bottom: 50 }
    };
    const NEWTAB_WALLPAPER_EFFECT_DEFAULTS = WALLPAPER_EFFECTS.DEFAULT_PREFS || {
      version: 11,
      type: 'none',
      inkTone: 'auto',
      strength: 50,
      size: 50,
      spacing: 50,
      texture: 20,
      blockSize: 1,
      crtStrength: 20,
      crtBloom: 15,
      crtRgbOffset: 35,
      crtCurvature: 18
    };
    const NEWTAB_WALLPAPER_EFFECT_TYPES = [
      { type: 'none', labelKey: 'newtab_wallpaper_effect_none', fallback: 'Off' },
      { type: 'blur', labelKey: 'newtab_wallpaper_effect_blur', fallback: 'Glass blur' },
      { type: 'grain', labelKey: 'newtab_wallpaper_effect_grain', fallback: 'Grain' },
      { type: 'blocks', labelKey: 'newtab_wallpaper_effect_blocks', fallback: 'Blocks' },
      { type: 'halftone', labelKey: 'newtab_wallpaper_effect_halftone', fallback: 'Halftone' },
      { type: 'dither', labelKey: 'newtab_wallpaper_effect_dither', fallback: 'Dither' },
      { type: 'ascii', labelKey: 'newtab_wallpaper_effect_ascii', fallback: 'ASCII' },
      { type: 'crt', labelKey: 'newtab_wallpaper_effect_crt', fallback: 'CRT' }
    ];
    const NEWTAB_WALLPAPER_EFFECT_INK_TONES = [
      { tone: 'dark', labelKey: 'newtab_wallpaper_effect_ink_dark', fallback: 'Shadows' },
      { tone: 'light', labelKey: 'newtab_wallpaper_effect_ink_light', fallback: 'Highlights' }
    ];
    const NEWTAB_FAVICON_DEFAULT_ID = 'default';
    const NEWTAB_FAVICON_OPTIONS = [
      {
        id: 'default',
        nameKey: 'newtab_favicon_name_default',
        fallbackName: 'Default',
        file: 'assets/images/lumno.png',
        type: 'image/png'
      },
      {
        id: 'alternate',
        nameKey: 'newtab_favicon_name_alternate',
        fallbackName: 'Alternate',
        file: 'assets/images/lumno-newtab-favicon.svg',
        preview: 'inlineSvg',
        themeAwareSvg: true,
        type: 'image/svg+xml',
        sizes: 'any'
      }
    ];
    const NEWTAB_FAVICON_THEME_QUERY = '(prefers-color-scheme: dark)';
    const NEWTAB_FAVICON_THEME_BROADCAST_CHANNEL = 'lumno:newtab-favicon-theme';
    const NEWTAB_FAVICON_THEME_REFRESH_ACTION = 'lumno:newtab-favicon-theme-refresh';
    const NEWTAB_FAVICON_PRELOAD_STORAGE_KEY = '_x_extension_newtab_favicon_preload_2026_unique_';
    const NEWTAB_FAVICON_SVG_SHADOW_PATH = 'M14.1832 28.5107C14.7736 26.0503 17.4872 24.8712 19.8045 25.8872L29.0688 29.9483C23.1024 42.5571 20.9583 59.1892 34.0764 74.4517C35.5367 76.1508 37.0158 77.6786 38.5039 79.0511C15.0742 61.6944 10.3754 44.3784 14.1832 28.5107ZM50.1563 62.6667C55.3534 57.1072 64.2555 57.3891 69.0898 63.2669L69.4706 63.7295C65.5069 61.937 61.0203 61.3468 56.5866 62.1747L49.3526 63.5259L50.1563 62.6667Z';
    const NEWTAB_FAVICON_SVG_MAIN_PATH = 'M34.0761 74.4516C15.8955 53.2991 27.0297 29.5157 37.0262 17.4579C38.6314 15.5217 41.5522 15.6368 43.1924 17.5435L54.2217 30.3654C58.8053 35.6938 59.7099 43.2656 56.5107 49.524L49.3531 63.5257L56.8412 62.1274C64.6007 60.6784 72.5332 63.5719 77.5374 69.6765L83.762 77.2699C85.0646 78.859 85.0813 81.1684 83.4746 82.4491C74.4334 89.6554 52.1633 95.4955 34.0761 74.4516Z';
    const NEWTAB_FAVICON_THEMES = {
      light: {
        color: '#000000',
        shadowOpacity: '0.2',
        mainOpacity: '0.5'
      },
      dark: {
        color: '#f1f3f4',
        shadowOpacity: '0.34',
        mainOpacity: '0.72'
      }
    };
    const WALLPAPER_PANEL_RESIZE_DURATION_MS = 260;
    const WALLPAPER_PANEL_RESIZE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
    const WALLPAPER_VISUAL_TRANSITION_MS = 220;
    const WALLPAPER_FILTER_TRANSITION_MS = 180;
    const WALLPAPER_VISUAL_REFRESH_DELAY_MS = 80;
    const WALLPAPER_IMAGE_READY_CACHE_LIMIT = 8;
    const WALLPAPER_NETWORK_IMAGE_TIMEOUT_MS = 8000;

    let initialWallpaperApplied = false;
    let hasWallpaperBootstrapStarted = false;
    let hasStoredWallpaperStateLoaded = false;
    let hasNewtabFaviconBootstrapStarted = false;
    let resolveInitialWallpaperReady = null;
    const initialWallpaperReadyPromise = new Promise((resolve) => {
      resolveInitialWallpaperReady = resolve;
    });
    let initialNewtabFaviconReadyPromise = null;
    let initialWallpaperOverlayReadyPromise = null;
    let initialWallpaperEffectReadyPromise = null;
    let hasStoredWallpaperEffectLoaded = false;
    let wallpaperControl = null;
    let wallpaperViewController = null;
    let wallpaperReactPanelBound = false;
    let wallpaperButton = null;
    let wallpaperPanel = null;
    let wallpaperPanelHeader = null;
    let wallpaperPanelTitle = null;
    let wallpaperAccordionTrigger = null;
    let wallpaperSectionExpanded = true;
    let wallpaperEnabledToggle = null;
    let topContentTitle = null;
    let searchSectionTitle = null;
    let topContentTabs = null;
    let topContentTabsIndicator = null;
    let topContentBrandTab = null;
    let topContentTimeTab = null;
    let topContentOffTab = null;
    let topContentWeightControl = null;
    let topContentWeightTitle = null;
    let topContentWeightSlider = null;
    let topContentSecondsRow = null;
    let topContentSecondsTitle = null;
    let topContentSecondsToggle = null;
    let wallpaperAppearanceTitle = null;
    let wallpaperThemeSectionTitle = null;
    let wallpaperAppearanceInfoButton = null;
    let wallpaperAppearanceScopeTabs = null;
    let wallpaperAppearanceScopeTabsIndicator = null;
    let wallpaperAppearanceOptions = null;
    let wallpaperSearchWidthControl = null;
    let wallpaperSearchWidthLabel = null;
    let wallpaperSearchWidthSlider = null;
    let wallpaperInputAutoFocusTitle = null;
    let wallpaperInputAutoFocusInfoButton = null;
    let wallpaperInputAutoFocusToggle = null;
    let wallpaperSourcesHintController = null;
    let wallpaperShortcutsAccordion = null;
    let wallpaperShortcutsAccordionTrigger = null;
    let wallpaperShortcutsTitle = null;
    let wallpaperShortcutsDetails = null;
    let wallpaperShortcutsToggle = null;
    let wallpaperShortcutAddTitle = null;
    let wallpaperShortcutAddToggle = null;
    let wallpaperShortcutDockMagnificationTitle = null;
    let wallpaperShortcutDockMagnificationToggle = null;
    let wallpaperShortcutColumnsControl = null;
    let wallpaperShortcutColumnsLabel = null;
    let wallpaperShortcutColumnsSlider = null;
    let wallpaperShortcutSizeControl = null;
    let wallpaperShortcutSizeLabel = null;
    let wallpaperShortcutSizeSlider = null;
    let wallpaperShortcutSizeResetButton = null;
    let wallpaperShortcutGapControl = null;
    let wallpaperShortcutGapLabel = null;
    let wallpaperShortcutGapSlider = null;
    let wallpaperShortcutGapResetButton = null;
    let wallpaperShortcutsAccordionExpanded = false;
    let wallpaperAppearanceMoreSettingsLink = null;
    let wallpaperAppearanceMoreSettingsText = null;
    let wallpaperSearchWidthSaveTimer = null;
    let wallpaperShortcutColumnsSaveTimer = null;
    let wallpaperShortcutSizeSaveTimer = null;
    let wallpaperShortcutGapSaveTimer = null;
    let wallpaperOverlayLabel = null;
    let wallpaperOverlaySlider = null;
    let wallpaperEffectLabel = null;
    let wallpaperEffectInkToneControl = null;
    let wallpaperEffectInkToneLabel = null;
    let wallpaperEffectInkToneOptions = null;
    let wallpaperEffectInkToneIndicator = null;
    let wallpaperEffectStrengthControl = null;
    let wallpaperEffectStrengthLabel = null;
    let wallpaperEffectSlider = null;
    let wallpaperEffectSizeControl = null;
    let wallpaperEffectSizeLabel = null;
    let wallpaperEffectSizeSlider = null;
    let wallpaperEffectSpacingControl = null;
    let wallpaperEffectSpacingLabel = null;
    let wallpaperEffectSpacingSlider = null;
    let wallpaperEffectTextureControl = null;
    let wallpaperEffectTextureLabel = null;
    let wallpaperEffectTextureSlider = null;
    let wallpaperEffectCrtBloomControl = null;
    let wallpaperEffectCrtBloomLabel = null;
    let wallpaperEffectCrtBloomSlider = null;
    let wallpaperEffectCrtRgbOffsetControl = null;
    let wallpaperEffectCrtRgbOffsetLabel = null;
    let wallpaperEffectCrtRgbOffsetSlider = null;
    let wallpaperEffectCrtCurvatureControl = null;
    let wallpaperEffectCrtCurvatureLabel = null;
    let wallpaperEffectCrtCurvatureSlider = null;
    let newtabFaviconTitle = null;
    let newtabFaviconOptions = null;
    let newtabFaviconThemeQueryList = null;
    let newtabFaviconThemeChangeHandler = null;
    let hasNewtabFaviconLifecycleListeners = false;
    let newtabFaviconLifecycleRefreshHandler = null;
    let newtabFaviconThemeBroadcastChannel = null;
    let hasNewtabFaviconThemeBroadcastListener = false;
    let wallpaperSliderValueBubble = null;
    let wallpaperSliderValueHideTimer = null;
    let wallpaperSliderValueTarget = null;
    let wallpaperSliderValueDragTarget = null;
    let wallpaperOverlaySaveTimer = null;
    let wallpaperEffectSaveTimer = null;
    let wallpaperPanelResizeTimer = null;
    let wallpaperPanelResizeCleanup = null;
    let wallpaperTabsIndicatorRefreshFrame = 0;
    let wallpaperModeTabsIndicatorRefreshFrame = 0;
    let wallpaperEffectTabsIndicatorRefreshFrame = 0;
    let topContentTabsIndicatorRefreshFrame = 0;
    let appearanceScopeTabsIndicatorRefreshFrame = 0;
    let wallpaperActiveSlider = null;
    let wallpaperAppearanceAnimationTimers = [];
    let wallpaperAppearanceModeLabelsHeld = false;
    let customWallpapers = [];
    let customWallpaperCatalogLoaded = false;
    let customWallpaperCatalogPromise = null;
    let customWallpaperUploadTile = null;
    let customWallpaperInput = null;
    let customWallpaperImporting = false;
    let customWallpaperUrlTile = null;
    let customWallpaperUrlForm = null;
    let customWallpaperUrlInput = null;
    let customWallpaperUrlSubmit = null;
    // Link wallpapers sync as { id, url, addedAt } entries. Their images, and museum prints, are
    // downscaled once per device and cached by photo ID.
    let linkWallpapers = [];
    const cachedWallpaperImages = new Map();
    const wallpaperImageCaching = new Map();
    const LINK_WALLPAPER_ID_PATTERN = /^link-[a-z0-9]{4,32}$/;
    const LINK_WALLPAPER_URL_MAX_LENGTH = 2048;
    // chrome.storage.sync holds 8 KB per item; normalized URLs are ASCII, so length counts bytes.
    const LINK_WALLPAPERS_MAX_BYTES = 8000;
    let wallpaperStorageChangeSeq = 0;
    let wallpaperVisualSeq = 0;
    let wallpaperVisualRefreshTimer = 0;
    let appliedWallpaperVisualUrl = '';
    let appliedWallpaperVisualActive = false;
    const wallpaperImageReadyCache = new Map();
    // Whether each network image loaded on this page: 'loaded' or 'failed'. A new tab tries again.
    const wallpaperNetworkImageStates = new Map();

    function ensureWallpaperSliderValueBubble() {
      if (wallpaperSliderValueBubble && wallpaperSliderValueBubble.isConnected) {
        return wallpaperSliderValueBubble;
      }
      wallpaperSliderValueBubble = document.createElement('div');
      wallpaperSliderValueBubble.id = '_x_extension_newtab_slider_value_bubble_2026_unique_';
      wallpaperSliderValueBubble.className = 'x-lumno-feature-hint x-nt-slider-value-bubble';
      wallpaperSliderValueBubble.setAttribute('data-visible', 'false');
      wallpaperSliderValueBubble.setAttribute('data-arrow-side', 'bottom');
      wallpaperSliderValueBubble.setAttribute('data-arrow-align', 'center');
      wallpaperSliderValueBubble.setAttribute('aria-hidden', 'true');
      const host = document.body || document.documentElement;
      if (host) {
        host.appendChild(wallpaperSliderValueBubble);
      }
      return wallpaperSliderValueBubble;
    }

    function isElementHovered(element) {
      if (!element || typeof element.matches !== 'function') {
        return false;
      }
      try {
        return element.matches(':hover');
      } catch (e) {
        return false;
      }
    }

    function isElementFocusVisible(element) {
      if (!element || typeof element.matches !== 'function') {
        return false;
      }
      try {
        return element.matches(':focus-visible');
      } catch (e) {
        return false;
      }
    }

    function formatWallpaperSliderValue(slider) {
      if (!slider) {
        return '';
      }
      const value = Number(slider.value);
      if (!Number.isFinite(value)) {
        return String(slider.value || '');
      }
      const suffix = slider.getAttribute('data-value-suffix') || '';
      return `${Math.round(value)}${suffix}`;
    }

    function getWallpaperSliderPercent(slider) {
      const min = Number(slider && slider.min);
      const max = Number(slider && slider.max);
      const value = Number(slider && slider.value);
      if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min || !Number.isFinite(value)) {
        return 0;
      }
      return clampNumber((value - min) / (max - min), 0, 1);
    }

    function shouldShowWallpaperSliderValue(slider) {
      return Boolean(slider && slider.isConnected && !slider.disabled &&
        (wallpaperSliderValueDragTarget === slider ||
          (document.activeElement === slider && isElementFocusVisible(slider)) ||
          isElementHovered(slider)));
    }

    function positionWallpaperSliderValueBubble(slider) {
      const bubble = ensureWallpaperSliderValueBubble();
      if (!bubble || !slider) {
        return;
      }
      bubble.textContent = formatWallpaperSliderValue(slider);
      const sliderRect = slider.getBoundingClientRect();
      const bubbleRect = bubble.getBoundingClientRect();
      const viewportWidth = Math.max(0, window.innerWidth || 0);
      const thumbSize = 16;
      const percent = getWallpaperSliderPercent(slider);
      const centerX = sliderRect.left + (thumbSize / 2) + Math.max(0, sliderRect.width - thumbSize) * percent;
      const spacing = 12;
      let arrowSide = 'bottom';
      let top = sliderRect.top - bubbleRect.height - spacing;
      if (top < 8) {
        arrowSide = 'top';
        top = sliderRect.bottom + spacing;
      }
      const maxLeft = viewportWidth > 0 ? viewportWidth - bubbleRect.width - 8 : centerX;
      const left = clampNumber(centerX - (bubbleRect.width / 2), 8, Math.max(8, maxLeft));
      bubble.setAttribute('data-arrow-side', arrowSide);
      bubble.setAttribute('data-arrow-align', 'center');
      bubble.style.setProperty('top', `${Math.round(top)}px`);
      bubble.style.setProperty('left', `${Math.round(left)}px`);
    }

    function syncWallpaperSliderValueBubble(slider) {
      if (wallpaperSliderValueTarget !== slider) {
        return;
      }
      if (!shouldShowWallpaperSliderValue(slider)) {
        hideWallpaperSliderValueBubble(slider, { force: true });
        return;
      }
      positionWallpaperSliderValueBubble(slider);
      if (wallpaperSliderValueBubble) {
        wallpaperSliderValueBubble.setAttribute('data-visible', 'true');
      }
    }

    function showWallpaperSliderValueBubble(slider) {
      if (!slider || slider.disabled) {
        return;
      }
      wallpaperSliderValueTarget = slider;
      if (wallpaperSliderValueHideTimer !== null) {
        window.clearTimeout(wallpaperSliderValueHideTimer);
        wallpaperSliderValueHideTimer = null;
      }
      positionWallpaperSliderValueBubble(slider);
      window.requestAnimationFrame(() => {
        if (wallpaperSliderValueTarget !== slider || !shouldShowWallpaperSliderValue(slider)) {
          return;
        }
        if (wallpaperSliderValueBubble) {
          wallpaperSliderValueBubble.setAttribute('data-visible', 'true');
        }
      });
    }

    function hideWallpaperSliderValueBubble(slider, options) {
      const force = Boolean(options && options.force);
      const target = slider || wallpaperSliderValueTarget;
      if (!target && !wallpaperSliderValueBubble) {
        return;
      }
      if (!force && target && wallpaperSliderValueDragTarget === target) {
        return;
      }
      if (!force && target && shouldShowWallpaperSliderValue(target)) {
        return;
      }
      wallpaperSliderValueTarget = null;
      if (wallpaperSliderValueBubble) {
        wallpaperSliderValueBubble.setAttribute('data-visible', 'false');
      }
      if (wallpaperSliderValueHideTimer !== null) {
        window.clearTimeout(wallpaperSliderValueHideTimer);
      }
      wallpaperSliderValueHideTimer = window.setTimeout(() => {
        wallpaperSliderValueHideTimer = null;
      }, 180);
    }

    function finishWallpaperSliderValueDrag() {
      const slider = wallpaperSliderValueDragTarget;
      wallpaperSliderValueDragTarget = null;
      window.removeEventListener('pointerup', finishWallpaperSliderValueDrag, true);
      window.removeEventListener('pointercancel', finishWallpaperSliderValueDrag, true);
      if (slider && shouldShowWallpaperSliderValue(slider)) {
        showWallpaperSliderValueBubble(slider);
        return;
      }
      hideWallpaperSliderValueBubble(slider, { force: true });
    }

    function blurWallpaperPanelActiveElement() {
      const activeElement = document.activeElement;
      if (!activeElement || !wallpaperPanel || !wallpaperPanel.contains(activeElement)) {
        return;
      }
      if (typeof activeElement.blur !== 'function') {
        return;
      }
      activeElement.blur();
    }

    function cancelWallpaperPanelActiveControls() {
      finishWallpaperSliderValueDrag();
      wallpaperActiveSlider = null;
      blurWallpaperPanelActiveElement();
    }

    function bindWallpaperSliderValueBubble(slider) {
      if (!slider) {
        return;
      }
      slider.addEventListener('mouseenter', () => {
        showWallpaperSliderValueBubble(slider);
      });
      slider.addEventListener('mousemove', () => {
        syncWallpaperSliderValueBubble(slider);
      });
      slider.addEventListener('mouseleave', () => {
        hideWallpaperSliderValueBubble(slider);
      });
      slider.addEventListener('focus', () => {
        showWallpaperSliderValueBubble(slider);
      });
      slider.addEventListener('blur', () => {
        hideWallpaperSliderValueBubble(slider, { force: true });
      });
      slider.addEventListener('pointerdown', () => {
        if (slider.disabled) {
          return;
        }
        wallpaperSliderValueDragTarget = slider;
        showWallpaperSliderValueBubble(slider);
        window.addEventListener('pointerup', finishWallpaperSliderValueDrag, true);
        window.addEventListener('pointercancel', finishWallpaperSliderValueDrag, true);
      });
      slider.addEventListener('input', () => {
        showWallpaperSliderValueBubble(slider);
      });
      slider.addEventListener('change', () => {
        syncWallpaperSliderValueBubble(slider);
      });
    }

    function setWallpaperActiveSlider(slider) {
      wallpaperActiveSlider = slider || null;
    }

    function clearWallpaperActiveSlider(slider) {
      if (!slider || wallpaperActiveSlider === slider) {
        wallpaperActiveSlider = null;
      }
    }

    let currentWallpaperOverlayOpacity = {
      light: NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.light,
      dark: NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.dark
    };
    let currentWallpaperEffectPrefsByMode = normalizeWallpaperEffectStoragePrefs(
      NEWTAB_WALLPAPER_EFFECT_DEFAULTS
    );
    let currentAppliedWallpaperEffectPrefs = Object.assign({}, NEWTAB_WALLPAPER_EFFECT_DEFAULTS);
    let wallpaperBuiltInGrid = null;
    let wallpaperLocalGrid = null;
    let wallpaperBody = null;
    let wallpaperModeSyncTitle = null;
    let wallpaperModeSyncToggle = null;
    let wallpaperModeTabs = null;
    let wallpaperModeTabsIndicator = null;
    let wallpaperLightModeTab = null;
    let wallpaperDarkModeTab = null;
    let wallpaperModeRow = null;
    let wallpaperModeLabel = null;
    let wallpaperTabs = null;
    let wallpaperTabsIndicator = null;
    let wallpaperSourceLabel = null;
    let wallpaperBuiltInTab = null;
    let wallpaperLocalTab = null;
    let wallpaperBingTab = null;
    let wallpaperBingPanel = null;
    let wallpaperBingGrid = null;
    let wallpaperBingRefresh = null;
    let wallpaperBingStatus = null;
    let bingItems = [];
    let bingCatalogSeq = 0;
    let bingSelectionSeq = 0;
    let bingStatus = '';
    let bingLoading = false;
    let bingSelecting = false;
    const BING_RECENT_TILE_LIMIT = 6;
    let wallpaperCuratedTab = null;
    let wallpaperCuratedPanel = null;
    let wallpaperCuratedGrid = null;
    let wallpaperCuratedRefresh = null;
    let wallpaperCuratedCategoryTabs = null;
    // Three full rows; the refresh button pages through the category.
    const CURATED_TILE_LIMIT = 9;
    let curatedCategory = REMOTE_CONTENT.CURATED_CATEGORIES[0] || '';
    let curatedPage = 0;
    const WALLPAPER_SOURCE_TABS = ['built-in', 'local', 'bing', 'curated'];
    const BING_DAILY_HINT = 'A new Bing photo every day. A photo you pick while this is on stays for the rest of the day.';
    const CURATED_DAILY_HINT = 'A new photo every day from the category shown when you turn this on, ' +
      'the same on every synced device. A photo you pick stays for the rest of the day.';
    let dailyWallpaperCheckedDay = '';
    // { day, picks: { [daily ID]: photo ID } }; picks from another date no longer count.
    let dailyWallpaperPicks = { day: '', picks: {} };
    let hasWallpaperPageShownListeners = false;
    let activeWallpaperTab = 'built-in';
    let lastSyncedWallpaperSourceId = null;
    let activeWallpaperMode = NEWTAB_WALLPAPER_MODE_LIGHT;
    let wallpaperPanelRendered = false;
    let currentWallpaperPrefs = null;
    let currentLocalWallpaperOverrides = null;
    let currentWallpaperId = '';
    let lastActiveWallpaperId = '';
    let lastActiveWallpaperIdsByMode = {
      light: '',
      dark: ''
    };
    let currentTopContentMode = normalizeNewtabTopContentMode(getTopContentMode());
    let currentTimeFontWeight = normalizeNewtabTimeFontWeight(getTimeFontWeight());
    let currentTimeSecondsVisible = normalizeNewtabTimeSecondsVisible(getTimeSecondsVisible());
    let currentNewtabFaviconId = NEWTAB_FAVICON_DEFAULT_ID;

    function normalizeWallpaperMode(mode) {
      return mode === NEWTAB_WALLPAPER_MODE_DARK
        ? NEWTAB_WALLPAPER_MODE_DARK
        : NEWTAB_WALLPAPER_MODE_LIGHT;
    }

    function getDefaultWallpaperPrefs() {
      return {
        version: NEWTAB_WALLPAPER_PREFS_STORAGE_VERSION,
        sameForModes: true,
        light: NEWTAB_WALLPAPER_DEFAULT_ID,
        dark: NEWTAB_WALLPAPER_DEFAULT_ID
      };
    }

    function getDefaultLocalWallpaperOverrides() {
      return {
        light: null,
        dark: null
      };
    }

    currentWallpaperPrefs = getDefaultWallpaperPrefs();
    currentLocalWallpaperOverrides = getDefaultLocalWallpaperOverrides();

    function cloneWallpaperPrefs(prefs) {
      const source = prefs && typeof prefs === 'object' ? prefs : getDefaultWallpaperPrefs();
      const lightId = normalizeNewtabWallpaperId(source.light) || '';
      const darkId = normalizeNewtabWallpaperId(source.dark) || lightId;
      const sameForModes = source.sameForModes !== false;
      return {
        version: NEWTAB_WALLPAPER_PREFS_STORAGE_VERSION,
        sameForModes,
        light: lightId,
        dark: sameForModes ? lightId : darkId
      };
    }

    function cloneLocalWallpaperOverrides(overrides) {
      const source = overrides && typeof overrides === 'object' ? overrides : getDefaultLocalWallpaperOverrides();
      return {
        light: source.light || null,
        dark: source.dark || null
      };
    }

    function isCustomWallpaperId(id) {
      return localWallpaperStore.isCustomWallpaperId(id);
    }

    function getCustomWallpaperById(id) {
      const normalizedId = String(id || '').trim();
      if (!normalizedId) {
        return null;
      }
      return customWallpapers.find((item) => item && item.id === normalizedId) || null;
    }

    function getWallpaperById(id) {
      const normalizedId = String(id || '').trim();
      if (!normalizedId) {
        return null;
      }
      if (isCustomWallpaperId(normalizedId)) {
        return getCustomWallpaperById(normalizedId);
      }
      if (isLinkWallpaperId(normalizedId)) {
        return getLinkWallpaperById(normalizedId);
      }
      if (REMOTE_CONTENT.wallpaperFromId(normalizedId)) {
        const pickId = getDailyWallpaperPick(normalizedId);
        const pick = pickId && remoteClient.getWallpaper(pickId);
        return pick
          ? Object.assign({}, pick, { id: normalizedId, daily: true, dailyId: pickId, picked: true })
          : remoteClient.getWallpaper(normalizedId);
      }
      return NEWTAB_WALLPAPER_OPTIONS.find((item) => item && item.id === normalizedId) || null;
    }

    function getWallpaperTileContainers() {
      return [wallpaperBuiltInGrid, wallpaperLocalGrid, wallpaperBingGrid, wallpaperCuratedGrid].filter(Boolean);
    }

    function getWallpaperRestoreId() {
      const mode = getWallpaperEditMode();
      return normalizeNewtabWallpaperId(lastActiveWallpaperIdsByMode[mode]) ||
        normalizeNewtabWallpaperId(lastActiveWallpaperId) ||
        NEWTAB_WALLPAPER_DEFAULT_ID;
    }

    function normalizeNewtabTopContentMode(value) {
      return SETTINGS.normalizeNewtabTopContentMode(value);
    }

    function normalizeNewtabTimeSecondsVisible(value) {
      return SETTINGS.normalizeNewtabTimeSecondsVisible(value);
    }

    function normalizeNewtabTimeFontWeight(value) {
      return SETTINGS.normalizeNewtabTimeFontWeight(value);
    }

    function getNewtabFaviconById(id) {
      const normalizedId = String(id || '').trim();
      return NEWTAB_FAVICON_OPTIONS.find((item) => item && item.id === normalizedId) || null;
    }

    function normalizeNewtabFaviconId(value) {
      const raw = value && typeof value === 'object' && value.id
        ? value.id
        : value;
      const id = String(raw || '').trim();
      return getNewtabFaviconById(id) ? id : NEWTAB_FAVICON_DEFAULT_ID;
    }

    function getNewtabFaviconDisplayName(item) {
      if (!item) {
        return '';
      }
      return t(item.nameKey, item.fallbackName || item.id || '');
    }

    function getNewtabFaviconUrl(item) {
      return item && item.file ? getRuntimeAssetUrl(item.file) : '';
    }

    function getNewtabFaviconThemeQueryList() {
      if (!window || typeof window.matchMedia !== 'function') {
        return null;
      }
      try {
        return window.matchMedia(NEWTAB_FAVICON_THEME_QUERY);
      } catch (_error) {
        return null;
      }
    }

    function getNewtabFaviconBrowserTheme() {
      const queryList = getNewtabFaviconThemeQueryList();
      return queryList && queryList.matches ? 'dark' : 'light';
    }

    function buildNewtabFaviconSvgDataUrl(themeName) {
      const theme = NEWTAB_FAVICON_THEMES[themeName] || NEWTAB_FAVICON_THEMES.light;
      const svg = [
        '<svg width="104" height="104" viewBox="0 0 104 104" fill="none" xmlns="http://www.w3.org/2000/svg">',
        `<path opacity="${theme.shadowOpacity}" d="${NEWTAB_FAVICON_SVG_SHADOW_PATH}" fill="${theme.color}"/>`,
        `<path d="${NEWTAB_FAVICON_SVG_MAIN_PATH}" fill="${theme.color}" fill-opacity="${theme.mainOpacity}"/>`,
        '</svg>'
      ].join('');
      return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    }

    function getNewtabFaviconHref(item) {
      if (item && item.themeAwareSvg) {
        return buildNewtabFaviconSvgDataUrl(getNewtabFaviconBrowserTheme());
      }
      return getNewtabFaviconUrl(item);
    }

    function cacheNewtabFaviconPreloadId(id) {
      const normalizedId = normalizeNewtabFaviconId(id);
      try {
        if (window && window.localStorage) {
          window.localStorage.setItem(NEWTAB_FAVICON_PRELOAD_STORAGE_KEY, normalizedId);
        }
      } catch (_error) {
        // The main runtime still applies the favicon even when localStorage is unavailable.
      }
    }

    function clearNewtabFaviconThemeListener() {
      if (!newtabFaviconThemeQueryList || !newtabFaviconThemeChangeHandler) {
        newtabFaviconThemeQueryList = null;
        newtabFaviconThemeChangeHandler = null;
        return;
      }
      if (typeof newtabFaviconThemeQueryList.removeEventListener === 'function') {
        newtabFaviconThemeQueryList.removeEventListener('change', newtabFaviconThemeChangeHandler);
      } else if (typeof newtabFaviconThemeQueryList.removeListener === 'function') {
        newtabFaviconThemeQueryList.removeListener(newtabFaviconThemeChangeHandler);
      }
      newtabFaviconThemeQueryList = null;
      newtabFaviconThemeChangeHandler = null;
    }

    function applyNewtabFaviconLinkAttributes(link, item) {
      const themeName = item && item.themeAwareSvg ? getNewtabFaviconBrowserTheme() : '';
      link.setAttribute('rel', 'icon');
      link.setAttribute('type', item.type || 'image/png');
      link.setAttribute('href', getNewtabFaviconHref(item));
      if (item.sizes) {
        link.setAttribute('sizes', item.sizes);
      } else {
        link.removeAttribute('sizes');
      }
      link.setAttribute('data-newtab-favicon-id', item.id);
      if (themeName) {
        link.setAttribute('data-lumno-newtab-favicon-theme', themeName);
      } else {
        link.removeAttribute('data-lumno-newtab-favicon-theme');
      }
    }

    function refreshNewtabFaviconLink() {
      const item = getNewtabFaviconById(currentNewtabFaviconId) ||
        getNewtabFaviconById(NEWTAB_FAVICON_DEFAULT_ID);
      const link = getNewtabFaviconLink();
      if (link && item) {
        applyNewtabFaviconLinkAttributes(link, item);
      }
    }

    function refreshNewtabFaviconLinkIfThemeAware() {
      const item = getNewtabFaviconById(currentNewtabFaviconId);
      if (item && item.themeAwareSvg) {
        refreshNewtabFaviconLink();
      }
    }

    function getNewtabFaviconThemeBroadcastChannel() {
      if (newtabFaviconThemeBroadcastChannel) {
        return newtabFaviconThemeBroadcastChannel;
      }
      if (typeof BroadcastChannelCtor !== 'function') {
        return null;
      }
      try {
        newtabFaviconThemeBroadcastChannel = new BroadcastChannelCtor(NEWTAB_FAVICON_THEME_BROADCAST_CHANNEL);
      } catch (_error) {
        newtabFaviconThemeBroadcastChannel = null;
      }
      return newtabFaviconThemeBroadcastChannel;
    }

    function bindNewtabFaviconThemeBroadcastListener() {
      if (hasNewtabFaviconThemeBroadcastListener) {
        return;
      }
      hasNewtabFaviconThemeBroadcastListener = true;
      const channel = getNewtabFaviconThemeBroadcastChannel();
      if (!channel) {
        return;
      }
      const handleMessage = (event) => {
        const data = event && event.data ? event.data : null;
        if (!data || data.action !== NEWTAB_FAVICON_THEME_REFRESH_ACTION) {
          return;
        }
        refreshNewtabFaviconLinkIfThemeAware();
      };
      if (typeof channel.addEventListener === 'function') {
        channel.addEventListener('message', handleMessage);
      } else {
        channel.onmessage = handleMessage;
      }
    }

    function broadcastNewtabFaviconThemeRefresh() {
      const channel = getNewtabFaviconThemeBroadcastChannel();
      if (!channel || typeof channel.postMessage !== 'function') {
        return;
      }
      try {
        channel.postMessage({
          action: NEWTAB_FAVICON_THEME_REFRESH_ACTION,
          at: Date.now()
        });
      } catch (_error) {
        // BroadcastChannel can be unavailable in constrained extension contexts.
      }
    }

    function bindNewtabFaviconLifecycleRefreshListeners() {
      if (hasNewtabFaviconLifecycleListeners) {
        return;
      }
      hasNewtabFaviconLifecycleListeners = true;
      newtabFaviconLifecycleRefreshHandler = () => {
        refreshNewtabFaviconLinkIfThemeAware();
      };
      if (window && typeof window.addEventListener === 'function') {
        window.addEventListener('focus', newtabFaviconLifecycleRefreshHandler, { passive: true });
        window.addEventListener('pageshow', newtabFaviconLifecycleRefreshHandler, { passive: true });
      }
      if (document && typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', newtabFaviconLifecycleRefreshHandler, { passive: true });
      }
    }

    function bindNewtabFaviconThemeListener(item) {
      clearNewtabFaviconThemeListener();
      if (!item || !item.themeAwareSvg) {
        return;
      }
      bindNewtabFaviconLifecycleRefreshListeners();
      bindNewtabFaviconThemeBroadcastListener();
      const queryList = getNewtabFaviconThemeQueryList();
      if (!queryList) {
        return;
      }
      newtabFaviconThemeQueryList = queryList;
      newtabFaviconThemeChangeHandler = () => {
        refreshNewtabFaviconLinkIfThemeAware();
        broadcastNewtabFaviconThemeRefresh();
      };
      if (typeof queryList.addEventListener === 'function') {
        queryList.addEventListener('change', newtabFaviconThemeChangeHandler);
      } else if (typeof queryList.addListener === 'function') {
        queryList.addListener(newtabFaviconThemeChangeHandler);
      }
    }

    function normalizeNewtabWallpaperId(value) {
      const raw = value && typeof value === 'object' && value.id
        ? value.id
        : value;
      const id = String(raw || '').trim();
      if (id === NEWTAB_CUSTOM_WALLPAPER_ID) {
        const firstCustomWallpaper = customWallpapers[0];
        return firstCustomWallpaper ? firstCustomWallpaper.id : '';
      }
      // Move existing online selections to the daily Bing source without contacting the old provider.
      if (/^wallhaven-[a-z0-9]{6}$/.test(id) && remoteClient) return REMOTE_CONTENT.BING_DAILY_ID;
      if (getWallpaperById(id)) {
        return id;
      }
      const matchedByPath = NEWTAB_WALLPAPER_OPTIONS.find((item) => {
        const localPath = getWallpaperLocalPath(item);
        const runtimePath = getWallpaperRuntimePath(item);
        const legacyFile = getWallpaperLegacyFile(item);
        return id === localPath ||
          id === runtimePath ||
          id.endsWith(`/${item.file}`) ||
          (legacyFile && id.endsWith(`/${legacyFile}`));
      });
      return matchedByPath ? matchedByPath.id : '';
    }

    function getWallpaperLegacyFile(item) {
      const file = item && item.file ? item.file : '';
      return file.endsWith('.webp') ? file.replace(/\.webp$/, '.png') : '';
    }

    function getWallpaperThumbnailFile(item) {
      const file = item && item.file ? item.file : '';
      return file ? file.replace(/\.[^.]+$/, NEWTAB_WALLPAPER_THUMBNAIL_SUFFIX) : '';
    }

    function getWallpaperLocalPath(item) {
      if (!item || !item.file) {
        return '';
      }
      return `${NEWTAB_WALLPAPER_DEFAULT_DIRECTORY}/${item.file}`;
    }

    function getWallpaperRuntimePath(item, options) {
      if (item && isCustomWallpaperId(item.id)) {
        return '';
      }
      if (!item || !item.file) {
        return '';
      }
      const file = options && options.thumbnail ? getWallpaperThumbnailFile(item) : item.file;
      return file ? `${NEWTAB_WALLPAPER_EXTENSION_DIRECTORY}/${file}` : '';
    }

    function getCachedWallpaperImage(photoId, url) {
      const image = cachedWallpaperImages.get(photoId);
      return image && image.url === url ? image : null;
    }

    function getWallpaperImageUrl(item) {
      if (item && remoteClient && item.cacheImage) {
        const cached = getCachedWallpaperImage(item.dailyId || item.id, item.imageUrl);
        return cached ? cached.imageDataUrl : item.thumbnailUrl;
      }
      if (item && remoteClient && REMOTE_CONTENT.wallpaperFromId(item.id)) {
        return item.imageUrl || getWallpaperImageUrl(getWallpaperById(NEWTAB_WALLPAPER_DEFAULT_ID));
      }
      if (item && isCustomWallpaperId(item.id)) {
        return item.imageDataUrl || '';
      }
      if (item && isLinkWallpaperId(item.id)) {
        return item.imageDataUrl || item.url;
      }
      const runtimePath = getWallpaperRuntimePath(item);
      if (!runtimePath) {
        return '';
      }
      if (chrome && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
        return chrome.runtime.getURL(runtimePath);
      }
      return `../../${runtimePath}`;
    }

    function isNetworkWallpaperImageUrl(url) {
      return /^https?:/i.test(String(url || ''));
    }

    // A network image never paints straight from CSS: it would hold the tab's loading spinner, and
    // a failed download would leave the page blank. It shows once loaded after the page; if it fails
    // or stalls, the bundled default wallpaper stands in. Copies in IndexedDB and bundled files
    // show at once, and the fallback never depends on data that sync or pruning may remove.
    function getDisplayedWallpaperImageUrl(item) {
      const url = getWallpaperImageUrl(item);
      if (!isNetworkWallpaperImageUrl(url)) {
        return url;
      }
      const state = wallpaperNetworkImageStates.get(url);
      if (state === 'loaded') {
        return url;
      }
      return state === 'failed' ? getWallpaperImageUrl(getWallpaperById(NEWTAB_WALLPAPER_DEFAULT_ID)) : '';
    }

    function getWallpaperThumbnailUrl(item) {
      if (item && remoteClient && REMOTE_CONTENT.wallpaperFromId(item.id)) {
        return item.thumbnailUrl || getWallpaperImageUrl(item);
      }
      if (item && isCustomWallpaperId(item.id)) {
        return item.thumbnailDataUrl || item.imageDataUrl || '';
      }
      if (item && isLinkWallpaperId(item.id)) {
        return item.thumbnailDataUrl || item.url;
      }
      const runtimePath = getWallpaperRuntimePath(item, { thumbnail: true });
      if (!runtimePath) {
        return getWallpaperImageUrl(item);
      }
      if (chrome && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
        return chrome.runtime.getURL(runtimePath);
      }
      return `../../${runtimePath}`;
    }

    function getWallpaperDisplayName(item) {
      if (!item) {
        return '';
      }
      if (item.nameKey) {
        return t(item.nameKey, item.fallbackName || item.id || '');
      }
      const storedName = String(item.name || '').trim();
      if (!storedName) {
        return t('newtab_wallpaper_custom_name', 'Local wallpaper');
      }
      return storedName;
    }

    // Used by overlay math; adaptive image sampling lives in wallpaper-adaptive-tone.js.
    function clampNumber(value, min, max) {
      const number = Number(value);
      if (!Number.isFinite(number)) {
        return min;
      }
      return Math.min(max, Math.max(min, number));
    }

    function getViewportSize() {
      const docEl = document.documentElement;
      return {
        width: Math.max(1, window.innerWidth || (docEl ? docEl.clientWidth : 0) || 1),
        height: Math.max(1, window.innerHeight || (docEl ? docEl.clientHeight : 0) || 1)
      };
    }

    function getWallpaperOverlayAlphaAtViewportY(viewportY) {
      const mode = getResolvedWallpaperOverlayMode();
      const stops = NEWTAB_WALLPAPER_OVERLAY_STOPS[mode] || NEWTAB_WALLPAPER_OVERLAY_STOPS.light;
      const opacity = getWallpaperOverlayOpacityForCurrentMode();
      const topAlpha = getWallpaperOverlayStopPercent(stops.top, opacity) / 100;
      const midAlpha = getWallpaperOverlayStopPercent(stops.mid, opacity) / 100;
      const bottomAlpha = getWallpaperOverlayStopPercent(stops.bottom, opacity) / 100;
      const viewport = getViewportSize();
      const position = clampNumber(viewportY / viewport.height, 0, 1);
      if (position <= 0.42) {
        return topAlpha + ((midAlpha - topAlpha) * (position / 0.42));
      }
      return midAlpha + ((bottomAlpha - midAlpha) * ((position - 0.42) / 0.58));
    }

    function getWallpaperAdaptiveToneTargets() {
      const externalTargets = typeof getAdaptiveToneTargets === 'function'
        ? getAdaptiveToneTargets()
        : [];
      const targets = Array.isArray(externalTargets) ? externalTargets.slice() : [];
      targets.push({
        element: wallpaperButton,
        sampleElement: wallpaperButton,
        minWidth: 54,
        minHeight: 54,
        iconButton: true
      });
      return targets;
    }

    let wallpaperEffects = null;
    const wallpaperAdaptiveTone = WALLPAPER_ADAPTIVE_TONE.createWallpaperAdaptiveTone({
      documentObj,
      windowObj,
      getTargets: getWallpaperAdaptiveToneTargets,
      getCurrentWallpaper: () => getWallpaperById(currentWallpaperId),
      getWallpaperImageUrl: getDisplayedWallpaperImageUrl,
      getOverlayAlphaAtViewportY: getWallpaperOverlayAlphaAtViewportY,
      getOverlayLuminance: () => getResolvedWallpaperOverlayMode() === 'dark' ? 0 : 1,
      getEffectLuminanceAtViewport: (viewportX, viewportY, baseLuminance) => {
        return wallpaperEffects && typeof wallpaperEffects.getLuminanceAtViewport === 'function'
          ? wallpaperEffects.getLuminanceAtViewport(viewportX, viewportY, baseLuminance)
          : null;
      },
      applyWordmarkThemeAppearance
    });
    const wallpaperEffectPreload = globalThis.LumnoNewtabWallpaperEffectPreload || null;
    const wallpaperEffectRuntimeOptions = {
        documentObj,
        windowObj,
        getCurrentWallpaper: () => getWallpaperById(currentWallpaperId),
        getWallpaperImageUrl: getDisplayedWallpaperImageUrl,
        shouldAnimateTransition: () => Boolean(
          documentObj.body &&
          documentObj.body.getAttribute('data-nt-enter') === 'done'
        ),
        onRender: scheduleWallpaperAdaptiveToneUpdate
      };
    if (wallpaperEffectPreload && wallpaperEffectPreload.controller) {
      wallpaperEffectPreload.attach({
        onRender: scheduleWallpaperAdaptiveToneUpdate,
        shouldAnimateTransition: wallpaperEffectRuntimeOptions.shouldAnimateTransition
      });
      wallpaperEffects = wallpaperEffectPreload.controller;
    } else {
      if (wallpaperEffectPreload) {
        wallpaperEffectPreload.claimed = true;
      }
      wallpaperEffects = WALLPAPER_EFFECTS.createWallpaperEffects(wallpaperEffectRuntimeOptions);
    }

    function scheduleWallpaperAdaptiveToneUpdate() {
      wallpaperAdaptiveTone.schedule();
    }

    function refreshWallpaperAdaptiveSampler() {
      wallpaperAdaptiveTone.refresh();
    }

    function refreshWallpaperEffects() {
      if (wallpaperEffects) {
        return wallpaperEffects.refresh();
      }
      return Promise.resolve();
    }

    function getRuntimeAssetUrl(path) {
      const value = String(path || '').trim();
      if (!value) {
        return '';
      }
      if (chrome && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
        return chrome.runtime.getURL(value);
      }
      return `../../${value}`;
    }

    function getCssUrlValue(url) {
      const safe = String(url || '')
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '')
        .replace(/\r/g, '');
      return safe ? `url("${safe}")` : 'none';
    }

    function cacheWallpaperImageReady(url, promise) {
      if (!url || !promise) {
        return;
      }
      if (wallpaperImageReadyCache.has(url)) {
        wallpaperImageReadyCache.delete(url);
      }
      wallpaperImageReadyCache.set(url, promise);
      while (wallpaperImageReadyCache.size > WALLPAPER_IMAGE_READY_CACHE_LIMIT) {
        const firstKey = wallpaperImageReadyCache.keys().next().value;
        wallpaperImageReadyCache.delete(firstKey);
      }
    }

    function waitForWallpaperImageReady(url) {
      const imageUrl = String(url || '').trim();
      if (!imageUrl) {
        return Promise.resolve();
      }
      const cached = wallpaperImageReadyCache.get(imageUrl);
      if (cached) {
        return cached;
      }
      const isNetwork = isNetworkWallpaperImageUrl(imageUrl);
      const load = () => new Promise((resolve) => {
        const image = new Image();
        let timer = 0;
        let settled = false;
        const finish = (loaded) => {
          if (settled) {
            return;
          }
          settled = true;
          window.clearTimeout(timer);
          if (isNetwork) {
            wallpaperNetworkImageStates.set(imageUrl, loaded ? 'loaded' : 'failed');
          }
          resolve();
        };
        if (isNetwork) {
          timer = window.setTimeout(() => {
            finish(false);
            image.src = '';
          }, WALLPAPER_NETWORK_IMAGE_TIMEOUT_MS);
        }
        image.decoding = 'async';
        image.onload = () => {
          if (typeof image.decode === 'function') {
            image.decode().then(() => finish(true)).catch(() => finish(true));
            return;
          }
          finish(true);
        };
        image.onerror = () => finish(false);
        image.src = imageUrl;
      });
      const promise = isNetwork ? waitForDocumentLoad().then(load) : load();
      cacheWallpaperImageReady(imageUrl, promise);
      return promise;
    }

    // Network images start after the page has loaded, so they never hold the tab's spinner.
    function waitForDocumentLoad() {
      if (!document || typeof document.readyState !== 'string' || document.readyState === 'complete') {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        window.addEventListener('load', () => resolve(), { once: true });
      });
    }

    function createWallpaperTransitionLayer() {
      if (!document.body ||
          document.body.getAttribute('data-nt-enter') !== 'done' ||
          shouldReduceMotion()) {
        return null;
      }
      const computedStyle = window.getComputedStyle(document.body);
      const layer = document.createElement('div');
      layer.className = 'x-nt-wallpaper-transition-layer';
      layer.style.backgroundColor = computedStyle.backgroundColor;
      if (document.body.getAttribute('data-wallpaper-effect') === 'blur') {
        layer.setAttribute('data-wallpaper-effect', 'blur');
        layer.style.backgroundImage =
          computedStyle.getPropertyValue('--x-nt-wallpaper-image').trim() || 'none';
        layer.style.backgroundSize =
          computedStyle.getPropertyValue('--x-nt-wallpaper-size').trim() || 'cover';
        layer.style.backgroundPosition =
          computedStyle.getPropertyValue('--x-nt-wallpaper-position').trim() || 'center center';
        [
          '--x-nt-wallpaper-blur-overscan',
          '--x-nt-wallpaper-blur-radius',
          '--x-nt-wallpaper-blur-saturate',
          '--x-nt-wallpaper-blur-brightness',
          '--x-nt-wallpaper-blur-contrast'
        ].forEach((propertyName) => {
          const propertyValue = computedStyle.getPropertyValue(propertyName).trim();
          if (propertyValue) {
            layer.style.setProperty(propertyName, propertyValue);
          }
        });
      } else {
        layer.style.backgroundImage = computedStyle.backgroundImage;
        layer.style.backgroundSize = computedStyle.backgroundSize;
        layer.style.backgroundPosition = computedStyle.backgroundPosition;
      }
      layer.style.backgroundRepeat = computedStyle.backgroundRepeat;
      layer.style.backgroundAttachment = 'fixed';
      document.body.insertBefore(layer, document.body.firstChild);
      return layer;
    }

    function releaseWallpaperTransitionLayer(layer) {
      if (!layer || !layer.parentNode) {
        return;
      }
      window.requestAnimationFrame(() => {
        layer.setAttribute('data-exit', 'true');
        window.setTimeout(() => {
          if (layer.parentNode) {
            layer.parentNode.removeChild(layer);
          }
        }, (layer.getAttribute('data-wallpaper-filter-transition') === 'true'
          ? WALLPAPER_FILTER_TRANSITION_MS
          : WALLPAPER_VISUAL_TRANSITION_MS) + 80);
      });
    }

    function applyWallpaperVisualState(wallpaper) {
      const target = document.documentElement;
      const imageUrl = wallpaper ? getDisplayedWallpaperImageUrl(wallpaper) : '';
      const wallpaperPreload = globalThis.LumnoNewtabWallpaperPreload;
      if (wallpaperPreload && typeof wallpaperPreload === 'object') {
        // A copy the preload is still reading must not paint over the runtime's choice.
        wallpaperPreload.runtimeApplied = true;
      }
      appliedWallpaperVisualUrl = imageUrl;
      appliedWallpaperVisualActive = Boolean(wallpaper);
      if (target) {
        target.style.setProperty('--x-nt-wallpaper-image', imageUrl ? getCssUrlValue(imageUrl) : 'none');
        target.style.setProperty('--x-nt-wallpaper-size', 'cover');
        target.style.setProperty('--x-nt-wallpaper-position', 'center center');
        target.setAttribute('data-wallpaper-active', wallpaper ? 'true' : 'false');
      }
      if (document.body) {
        document.body.setAttribute('data-wallpaper-active', wallpaper ? 'true' : 'false');
      }
      if (wallpaperEffectPreload && typeof wallpaperEffectPreload.updateSource === 'function') {
        wallpaperEffectPreload.updateSource(wallpaper, imageUrl);
      }
      return imageUrl;
    }

    function runWallpaperVisualRefresh(seq) {
      if (seq !== wallpaperVisualSeq) {
        return;
      }
      refreshWallpaperAdaptiveSampler();
      refreshWallpaperEffects();
    }

    function scheduleWallpaperVisualRefresh(seq) {
      if (wallpaperVisualRefreshTimer) {
        window.clearTimeout(wallpaperVisualRefreshTimer);
        wallpaperVisualRefreshTimer = 0;
      }
      wallpaperVisualRefreshTimer = window.setTimeout(() => {
        wallpaperVisualRefreshTimer = 0;
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            runWallpaperVisualRefresh(seq);
          });
        });
      }, WALLPAPER_VISUAL_REFRESH_DELAY_MS);
    }

    function getRawWallpaperId(value) {
      return value && typeof value === 'object' && value.id ? value.id : value;
    }

    function hasStorageValue(result, key) {
      return Boolean(result && Object.prototype.hasOwnProperty.call(result, key));
    }

    function readStorageValue(area, key) {
      return new Promise((resolve) => {
        if (!area || !key || typeof area.get !== 'function') {
          resolve({ hasValue: false, value: undefined });
          return;
        }
        area.get([key], (result) => {
          resolve({
            hasValue: hasStorageValue(result, key),
            value: result ? result[key] : undefined
          });
        });
      });
    }

    function writeStorageValue(area, key, value, onError) {
      if (!area || !key || typeof area.set !== 'function') {
        return;
      }
      area.set({ [key]: value }, () => {
        if (chrome.runtime && chrome.runtime.lastError && typeof onError === 'function') {
          onError();
        }
      });
    }

    function isOnlineWallpaperId(value) {
      const id = String(getRawWallpaperId(value) || '').trim();
      return Boolean(REMOTE_CONTENT.wallpaperFromId(id)) || isLinkWallpaperId(id);
    }

    // Versions without online wallpapers clear IDs they do not recognize, and that clear syncs to every device.
    // Online picks therefore live in their own key, leaving a built-in stand-in under the shared key.
    function buildSharedSyncedWallpaperValue(value) {
      if (!value || typeof value !== 'object') {
        return isOnlineWallpaperId(value) ? NEWTAB_WALLPAPER_DEFAULT_ID : value;
      }
      const shared = Object.assign({}, value);
      NEWTAB_WALLPAPER_MODES.forEach((mode) => {
        if (isOnlineWallpaperId(shared[mode])) {
          shared[mode] = NEWTAB_WALLPAPER_DEFAULT_ID;
        }
      });
      return shared;
    }

    // The online pick only counts while the shared key still holds its stand-in; any other value
    // means an older version changed the wallpaper since, and that newer choice wins.
    function mergeOnlineWallpaperValue(synced, online) {
      const entry = online && online.hasValue ? online.value : null;
      if (!entry || typeof entry !== 'object' || !synced.hasValue ||
          !getWallpaperStorageRawIds(entry.value).some(isOnlineWallpaperId) ||
          getComparableSyncedWallpaperStorageValue(entry.shared) !==
            getComparableSyncedWallpaperStorageValue(synced.value)) {
        return synced;
      }
      return { hasValue: true, value: entry.value, fromOnlineKey: true };
    }

    function writeSyncedWallpaperValue(value, options) {
      if (!storageArea || typeof storageArea.set !== 'function') {
        return;
      }
      const hasOnlineWallpaper = getWallpaperStorageRawIds(value).some(isOnlineWallpaperId);
      const shared = hasOnlineWallpaper ? buildSharedSyncedWallpaperValue(value) : value;
      storageArea.set({
        [NEWTAB_WALLPAPER_STORAGE_KEY]: shared,
        [NEWTAB_ONLINE_WALLPAPER_STORAGE_KEY]: hasOnlineWallpaper ? { value, shared } : ''
      }, () => {
        if (chrome.runtime && chrome.runtime.lastError && options && options.showError) {
          showToast(t('newtab_wallpaper_save_error', 'Failed to save wallpaper'), true);
        }
      });
    }

    function writeLocalWallpaperValue(value, options) {
      writeStorageValue(localWallpaperStorageArea, NEWTAB_LOCAL_WALLPAPER_STORAGE_KEY, value, () => {
        if (options && options.showError) {
          showToast(t('newtab_wallpaper_save_error', 'Failed to save wallpaper'), true);
        }
      });
    }

    function getWallpaperStorageModeValue(value, mode, fallback) {
      if (!value || typeof value !== 'object') {
        return fallback;
      }
      const normalizedMode = normalizeWallpaperMode(mode);
      if (Object.prototype.hasOwnProperty.call(value, normalizedMode)) {
        return value[normalizedMode];
      }
      if (normalizedMode === NEWTAB_WALLPAPER_MODE_DARK &&
          Object.prototype.hasOwnProperty.call(value, NEWTAB_WALLPAPER_MODE_LIGHT)) {
        return value[NEWTAB_WALLPAPER_MODE_LIGHT];
      }
      if (Object.prototype.hasOwnProperty.call(value, 'id')) {
        return value.id;
      }
      return fallback;
    }

    function getWallpaperStorageRawIds(value) {
      if (!value || typeof value !== 'object') {
        return [String(getRawWallpaperId(value) || '').trim()].filter(Boolean);
      }
      return NEWTAB_WALLPAPER_MODES
        .map((mode) => String(getRawWallpaperId(getWallpaperStorageModeValue(value, mode, '')) || '').trim())
        .filter(Boolean);
    }

    function shouldWaitForCustomWallpapers(value) {
      return getWallpaperStorageRawIds(value).some((id) => {
        return id === NEWTAB_CUSTOM_WALLPAPER_ID || isCustomWallpaperId(id);
      });
    }

    function getStoredCustomWallpaperIds(storedValues) {
      const ids = [];
      (Array.isArray(storedValues) ? storedValues : []).forEach((storedValue) => {
        if (!storedValue || !storedValue.hasValue) {
          return;
        }
        getWallpaperStorageRawIds(storedValue.value).forEach((id) => {
          if ((id === NEWTAB_CUSTOM_WALLPAPER_ID || isCustomWallpaperId(id)) && !ids.includes(id)) {
            ids.push(id);
          }
        });
      });
      return ids;
    }

    function hasLoadedStoredCustomWallpaper(id) {
      if (id === NEWTAB_CUSTOM_WALLPAPER_ID) {
        return customWallpapers.length > 0;
      }
      return Boolean(getCustomWallpaperById(id));
    }

    function getComparableSyncedWallpaperStorageValue(value) {
      if (!value || typeof value !== 'object') {
        return String(getRawWallpaperId(value) || '');
      }
      return JSON.stringify({
        version: Number(value.version) || 0,
        sameForModes: value.sameForModes !== false,
        light: String(getWallpaperStorageModeValue(value, NEWTAB_WALLPAPER_MODE_LIGHT, '') || ''),
        dark: String(getWallpaperStorageModeValue(value, NEWTAB_WALLPAPER_MODE_DARK, '') || '')
      });
    }

    function buildSyncedWallpaperStorageValue(prefs) {
      const normalized = cloneWallpaperPrefs(prefs);
      if (normalized.sameForModes && normalized.light === normalized.dark) {
        return normalized.light;
      }
      return {
        version: NEWTAB_WALLPAPER_PREFS_STORAGE_VERSION,
        sameForModes: normalized.sameForModes,
        light: normalized.light,
        dark: normalized.dark
      };
    }

    function getComparableLocalWallpaperStorageValue(value) {
      if (!value || typeof value !== 'object') {
        return String(getRawWallpaperId(value) || '');
      }
      return JSON.stringify({
        version: Number(value.version) || 0,
        light: String(getWallpaperStorageModeValue(value, NEWTAB_WALLPAPER_MODE_LIGHT, '') || ''),
        dark: String(getWallpaperStorageModeValue(value, NEWTAB_WALLPAPER_MODE_DARK, '') || '')
      });
    }

    function buildLocalWallpaperStorageValue(overrides, sameForModes) {
      const normalized = cloneLocalWallpaperOverrides(overrides);
      if (sameForModes && (normalized.light || null) === (normalized.dark || null)) {
        return normalized.light || '';
      }
      if (!normalized.light && !normalized.dark) {
        return '';
      }
      return {
        version: NEWTAB_WALLPAPER_PREFS_STORAGE_VERSION,
        light: normalized.light || '',
        dark: normalized.dark || ''
      };
    }

    function resolveSyncedWallpaperModeValue(raw, hasRaw) {
      const value = hasRaw ? raw : NEWTAB_WALLPAPER_DEFAULT_ID;
      if (shouldWaitForCustomWallpapers(value)) {
        const nextCustomId = normalizeNewtabWallpaperId(value);
        if (nextCustomId && isCustomWallpaperId(nextCustomId)) {
          return {
            id: NEWTAB_WALLPAPER_DEFAULT_ID,
            localMigrationId: nextCustomId,
            sanitized: true
          };
        }
        return {
          id: NEWTAB_WALLPAPER_DEFAULT_ID,
          localMigrationId: '',
          sanitized: true
        };
      }
      const nextId = normalizeNewtabWallpaperId(value);
      // An ID this version does not recognize may come from a newer install sharing sync storage.
      // Show the default here, but never write it back, or that install's wallpaper turns off.
      if (!nextId && String(getRawWallpaperId(value) || '').trim()) {
        return {
          id: NEWTAB_WALLPAPER_DEFAULT_ID,
          localMigrationId: '',
          sanitized: false,
          unrecognized: true
        };
      }
      return {
        id: nextId,
        localMigrationId: '',
        sanitized: !hasRaw || (value && value !== nextId)
      };
    }

    function resolveSyncedWallpaperValue(value, hasValue) {
      const isObjectValue = Boolean(value && typeof value === 'object');
      const sameForModes = isObjectValue ? value.sameForModes !== false : true;
      const rawLight = isObjectValue
        ? getWallpaperStorageModeValue(value, NEWTAB_WALLPAPER_MODE_LIGHT, hasValue ? value : NEWTAB_WALLPAPER_DEFAULT_ID)
        : (hasValue ? value : NEWTAB_WALLPAPER_DEFAULT_ID);
      const lightResolution = resolveSyncedWallpaperModeValue(rawLight, hasValue || isObjectValue);
      const rawDark = sameForModes
        ? rawLight
        : getWallpaperStorageModeValue(value, NEWTAB_WALLPAPER_MODE_DARK, rawLight);
      const darkResolution = sameForModes
        ? lightResolution
        : resolveSyncedWallpaperModeValue(rawDark, true);
      const prefs = {
        version: NEWTAB_WALLPAPER_PREFS_STORAGE_VERSION,
        sameForModes,
        light: lightResolution.id,
        dark: sameForModes ? lightResolution.id : darkResolution.id
      };
      const localMigrations = getDefaultLocalWallpaperOverrides();
      if (lightResolution.localMigrationId) {
        localMigrations.light = lightResolution.localMigrationId;
      }
      if (sameForModes) {
        localMigrations.dark = localMigrations.light;
      } else if (darkResolution.localMigrationId) {
        localMigrations.dark = darkResolution.localMigrationId;
      }
      const sanitizedValue = buildSyncedWallpaperStorageValue(prefs);
      const hasUnrecognizedId = lightResolution.unrecognized || (!sameForModes && darkResolution.unrecognized);
      const shouldSanitize = !hasUnrecognizedId && (!hasValue ||
        lightResolution.sanitized ||
        (!sameForModes && darkResolution.sanitized) ||
        (isObjectValue && (
          Number(value.version) !== NEWTAB_WALLPAPER_PREFS_STORAGE_VERSION ||
          getComparableSyncedWallpaperStorageValue(value) !== getComparableSyncedWallpaperStorageValue(sanitizedValue)
        )));
      return {
        prefs,
        sanitizedValue: shouldSanitize ? sanitizedValue : null,
        localMigrations
      };
    }

    function resolveLocalWallpaperModeValue(raw, hasRaw) {
      if (!hasRaw) {
        return { override: null, shouldClear: false };
      }
      const rawId = String(getRawWallpaperId(raw) || '').trim();
      if (!rawId) {
        return { override: null, shouldClear: false };
      }
      if (rawId === NEWTAB_LOCAL_WALLPAPER_DISABLED_VALUE) {
        return { override: NEWTAB_LOCAL_WALLPAPER_DISABLED_VALUE, shouldClear: false };
      }
      const nextId = normalizeNewtabWallpaperId(raw);
      if (nextId && isCustomWallpaperId(nextId)) {
        return { override: nextId, shouldClear: false };
      }
      return { override: null, shouldClear: true };
    }

    function resolveLocalWallpaperOverride(value, hasValue) {
      const overrides = getDefaultLocalWallpaperOverrides();
      if (!hasValue) {
        return { overrides, shouldClear: false };
      }
      if (!value || typeof value !== 'object') {
        const resolution = resolveLocalWallpaperModeValue(value, true);
        overrides.light = resolution.override;
        overrides.dark = resolution.override;
        return {
          overrides,
          shouldClear: resolution.shouldClear
        };
      }
      const lightResolution = resolveLocalWallpaperModeValue(
        getWallpaperStorageModeValue(value, NEWTAB_WALLPAPER_MODE_LIGHT, ''),
        true
      );
      const darkResolution = resolveLocalWallpaperModeValue(
        getWallpaperStorageModeValue(value, NEWTAB_WALLPAPER_MODE_DARK, ''),
        true
      );
      overrides.light = lightResolution.override;
      overrides.dark = darkResolution.override;
      const normalizedValue = buildLocalWallpaperStorageValue(overrides, false);
      return {
        overrides,
        shouldClear: lightResolution.shouldClear ||
        darkResolution.shouldClear ||
          getComparableLocalWallpaperStorageValue(value) !== getComparableLocalWallpaperStorageValue(normalizedValue)
      };
    }

    function getWallpaperLocalOverrideForMode(mode) {
      const normalizedMode = normalizeWallpaperMode(mode);
      const overrides = currentLocalWallpaperOverrides || getDefaultLocalWallpaperOverrides();
      return overrides[normalizedMode] || null;
    }

    function getSyncedWallpaperIdForMode(mode) {
      const normalizedMode = normalizeWallpaperMode(mode);
      const prefs = currentWallpaperPrefs || getDefaultWallpaperPrefs();
      const id = prefs.sameForModes ? prefs.light : prefs[normalizedMode];
      return normalizeNewtabWallpaperId(id) || '';
    }

    function getEffectiveWallpaperIdForMode(mode) {
      const override = getWallpaperLocalOverrideForMode(mode);
      if (override === NEWTAB_LOCAL_WALLPAPER_DISABLED_VALUE) {
        return '';
      }
      if (override && isCustomWallpaperId(override)) {
        return normalizeNewtabWallpaperId(override) || '';
      }
      return getSyncedWallpaperIdForMode(mode);
    }

    function getResolvedWallpaperMode() {
      return document.body && document.body.getAttribute('data-theme') === 'dark'
        ? NEWTAB_WALLPAPER_MODE_DARK
        : NEWTAB_WALLPAPER_MODE_LIGHT;
    }

    function getWallpaperEditMode() {
      if (currentWallpaperPrefs && currentWallpaperPrefs.sameForModes) {
        return getResolvedWallpaperMode();
      }
      return normalizeWallpaperMode(activeWallpaperMode);
    }

    // Daily mode highlights the photo it currently resolves to.
    function getWallpaperTileSelectionId(id) {
      if (!REMOTE_CONTENT.isDailyWallpaperId(id)) return id;
      const daily = getWallpaperById(id);
      return daily && daily.dailyId || id;
    }

    function getWallpaperSelectionIdForUi() {
      return getEffectiveWallpaperIdForMode(getWallpaperEditMode());
    }

    function hasAnyWallpaperEnabled() {
      return NEWTAB_WALLPAPER_MODES.some((mode) => Boolean(getEffectiveWallpaperIdForMode(mode)));
    }

    function normalizeWallpaperSourceTab(tab) {
      return WALLPAPER_SOURCE_TABS.includes(tab) ? tab : 'built-in';
    }

    function getWallpaperSourceTabForId(id) {
      const provider = REMOTE_CONTENT.getWallpaperProvider(id);
      if (provider) return normalizeWallpaperSourceTab(provider);
      return isCustomWallpaperId(id) || isLinkWallpaperId(id) ? 'local' : 'built-in';
    }

    function getWallpaperModeLabel(mode) {
      const normalizedMode = normalizeWallpaperMode(mode);
      return normalizedMode === NEWTAB_WALLPAPER_MODE_DARK
        ? t('settings_theme_dark', 'Dark')
        : t('settings_theme_light', 'Light');
    }

    function getWallpaperModePreferenceOrder() {
      const modes = [];
      const addMode = (mode) => {
        const normalizedMode = normalizeWallpaperMode(mode);
        if (!modes.includes(normalizedMode)) {
          modes.push(normalizedMode);
        }
      };
      addMode(getResolvedWallpaperMode());
      addMode(getWallpaperEditMode());
      NEWTAB_WALLPAPER_MODES.forEach(addMode);
      return modes;
    }

    function getFirstEnabledWallpaperIdForModes(modes) {
      for (let i = 0; i < modes.length; i += 1) {
        const id = getEffectiveWallpaperIdForMode(modes[i]);
        if (id) {
          return id;
        }
      }
      return '';
    }

    function getCopyableWallpaperLocalOverrideForId(modes, id) {
      const normalizedId = normalizeNewtabWallpaperId(id);
      if (!normalizedId || !isCustomWallpaperId(normalizedId)) {
        return null;
      }
      for (let i = 0; i < modes.length; i += 1) {
        const override = getWallpaperLocalOverrideForMode(modes[i]);
        if (override &&
            override !== NEWTAB_LOCAL_WALLPAPER_DISABLED_VALUE &&
            isCustomWallpaperId(override) &&
            normalizeNewtabWallpaperId(override) === normalizedId) {
          return override;
        }
      }
      return null;
    }

    function setWallpaperPrefs(nextPrefs, nextOverrides) {
      currentWallpaperPrefs = cloneWallpaperPrefs(nextPrefs);
      currentLocalWallpaperOverrides = cloneLocalWallpaperOverrides(nextOverrides);
      if (currentWallpaperPrefs.sameForModes) {
        activeWallpaperMode = getResolvedWallpaperMode();
      } else {
        activeWallpaperMode = normalizeWallpaperMode(activeWallpaperMode);
      }
    }

    function getWritableWallpaperPrefs() {
      return cloneWallpaperPrefs(currentWallpaperPrefs);
    }

    function getWritableLocalWallpaperOverrides() {
      return cloneLocalWallpaperOverrides(currentLocalWallpaperOverrides);
    }

    function applyLocalWallpaperMigrations(overrides, migrations) {
      const nextOverrides = cloneLocalWallpaperOverrides(overrides);
      let changed = false;
      NEWTAB_WALLPAPER_MODES.forEach((mode) => {
        const migrationId = migrations && migrations[mode] ? migrations[mode] : '';
        if (!migrationId) {
          return;
        }
        nextOverrides[mode] = migrationId;
        changed = true;
      });
      return { overrides: nextOverrides, changed };
    }

    function writeCurrentWallpaperPrefs(options) {
      const config = options || {};
      writeSyncedWallpaperValue(buildSyncedWallpaperStorageValue(currentWallpaperPrefs), config);
      writeLocalWallpaperValue(
        buildLocalWallpaperStorageValue(currentLocalWallpaperOverrides, currentWallpaperPrefs.sameForModes),
        config
      );
    }

    function getWallpaperPreloadEntryForMode(mode) {
      const wallpaper = getWallpaperById(getEffectiveWallpaperIdForMode(mode));
      // Online photos and links cannot paint on the first frame, but the preload reads this device's
      // IndexedDB copy while the page is still parsing.
      if (wallpaper && (REMOTE_CONTENT.wallpaperFromId(wallpaper.id) || isLinkWallpaperId(wallpaper.id))) {
        const photoId = isLinkWallpaperId(wallpaper.id) ? wallpaper.id : wallpaper.dailyId || wallpaper.id;
        const sourceUrl = isLinkWallpaperId(wallpaper.id) ? wallpaper.url : wallpaper.imageUrl;
        return (wallpaper.cacheImage || isLinkWallpaperId(wallpaper.id)) && getCachedWallpaperImage(photoId, sourceUrl)
          ? { id: wallpaper.id, cachedImage: { id: photoId, url: sourceUrl } }
          : null;
      }
      const path = wallpaper && !isCustomWallpaperId(wallpaper.id)
        ? getWallpaperRuntimePath(wallpaper)
        : '';
      return path ? { id: wallpaper.id, path } : null;
    }

    function getWallpaperPreloadOverlayStops() {
      const result = {};
      NEWTAB_WALLPAPER_MODES.forEach((mode) => {
        const stops = NEWTAB_WALLPAPER_OVERLAY_STOPS[mode];
        const opacity = currentWallpaperOverlayOpacity[mode];
        result[mode] = {
          top: Number(getWallpaperOverlayStopPercent(stops.top, opacity).toFixed(1)),
          mid: Number(getWallpaperOverlayStopPercent(stops.mid, opacity).toFixed(1)),
          bottom: Number(getWallpaperOverlayStopPercent(stops.bottom, opacity).toFixed(1))
        };
      });
      return result;
    }

    function writeWallpaperPreloadCache() {
      try {
        if (!window.localStorage) {
          return;
        }
        const wallpapers = {
          light: getWallpaperPreloadEntryForMode(NEWTAB_WALLPAPER_MODE_LIGHT),
          dark: getWallpaperPreloadEntryForMode(NEWTAB_WALLPAPER_MODE_DARK)
        };
        window.localStorage.setItem(PRELOAD_STORAGE_KEY, JSON.stringify({
          version: PRELOAD_STORAGE_VERSION,
          mode: getResolvedWallpaperMode(),
          themeMode: getEffectiveThemeMode(),
          wallpapers,
          overlayStops: getWallpaperPreloadOverlayStops(),
          wallpaperEffects: getWallpaperEffectStorageValue(),
          updatedAt: Date.now()
        }));
      } catch (e) {
        // localStorage may be unavailable in constrained contexts; storage is only a fast-path cache.
      }
    }

    function normalizeCustomWallpaperRecord(record) {
      return localWallpaperStore.normalizeRecord(record);
    }

    function readCustomWallpaperRecords() {
      return localWallpaperStore.readAll();
    }

    function readCustomWallpaperRecordsByIds(ids) {
      return localWallpaperStore.readByIds(ids);
    }

    function writeCustomWallpaperRecord(record) {
      return localWallpaperStore.write(record);
    }

    function deleteCustomWallpaperRecord(record) {
      return localWallpaperStore.remove(record);
    }

    function buildCustomWallpaperRecordFromFile(file) {
      return localWallpaperStore.buildRecordFromFile(file);
    }

    function normalizeWallpaperOverlayOpacity(value, fallback) {
      const fallbackValue = Number.isFinite(Number(fallback)) ? Number(fallback) : 50;
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed)) {
        return Math.max(0, Math.min(100, Math.round(fallbackValue)));
      }
      return Math.max(0, Math.min(100, parsed));
    }

    function snapWallpaperOverlaySliderValue(value) {
      const normalized = normalizeWallpaperOverlayOpacity(value, 50);
      const target = NEWTAB_WALLPAPER_OVERLAY_SNAP_POINTS.find((point) => {
        const threshold = point === 100 ? 0 : NEWTAB_WALLPAPER_OVERLAY_SNAP_THRESHOLD;
        return Math.abs(normalized - point) <= threshold;
      });
      return typeof target === 'number' ? target : normalized;
    }

    function legacyWallpaperOverlayOpacityToSliderValue(value, fallback) {
      return normalizeWallpaperOverlayOpacity(
        Math.round(normalizeWallpaperOverlayOpacity(value, 100) / 2),
        fallback
      );
    }

    function normalizeWallpaperOverlayPrefs(value) {
      if (value && typeof value === 'object') {
        if (value.version !== NEWTAB_WALLPAPER_OVERLAY_STORAGE_VERSION) {
          return {
            version: NEWTAB_WALLPAPER_OVERLAY_STORAGE_VERSION,
            light: legacyWallpaperOverlayOpacityToSliderValue(value.light, NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.light),
            dark: legacyWallpaperOverlayOpacityToSliderValue(value.dark, NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.dark)
          };
        }
        return {
          version: NEWTAB_WALLPAPER_OVERLAY_STORAGE_VERSION,
          light: normalizeWallpaperOverlayOpacity(value.light, NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.light),
          dark: normalizeWallpaperOverlayOpacity(value.dark, NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.dark)
        };
      }
      const shared = typeof value === 'undefined' || value === null
        ? NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.light
        : legacyWallpaperOverlayOpacityToSliderValue(value, NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.light);
      return {
        version: NEWTAB_WALLPAPER_OVERLAY_STORAGE_VERSION,
        light: shared,
        dark: shared
      };
    }

    function getResolvedWallpaperOverlayMode() {
      return document.body && document.body.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }

    function getWallpaperOverlayOpacityForCurrentMode() {
      const mode = getResolvedWallpaperOverlayMode();
      return normalizeWallpaperOverlayOpacity(
        currentWallpaperOverlayOpacity[mode],
        NEWTAB_WALLPAPER_OVERLAY_DEFAULTS[mode]
      );
    }

    function getWallpaperOverlayStopPercent(base, value) {
      const basePercent = clampNumber(Number(base) || 0, 0, 100);
      const sliderValue = normalizeWallpaperOverlayOpacity(value, 50);
      if (sliderValue <= 50) {
        return basePercent * Math.pow(sliderValue / 50, 1.08);
      }
      const progress = (sliderValue - 50) / 50;
      return basePercent + ((100 - basePercent) * Math.pow(progress, 1.08));
    }

    function formatOverlayCssPercent(base, opacity) {
      const value = getWallpaperOverlayStopPercent(base, opacity);
      return `${Number(value.toFixed(1))}%`;
    }

    function applyWallpaperOverlayOpacity(value) {
      currentWallpaperOverlayOpacity = normalizeWallpaperOverlayPrefs(value);
      const target = document.documentElement;
      if (target) {
        ['light', 'dark'].forEach((mode) => {
          const stops = NEWTAB_WALLPAPER_OVERLAY_STOPS[mode];
          const opacity = currentWallpaperOverlayOpacity[mode];
          target.style.setProperty(`--x-nt-wallpaper-overlay-${mode}-top`, formatOverlayCssPercent(stops.top, opacity));
          target.style.setProperty(`--x-nt-wallpaper-overlay-${mode}-mid`, formatOverlayCssPercent(stops.mid, opacity));
          target.style.setProperty(`--x-nt-wallpaper-overlay-${mode}-bottom`, formatOverlayCssPercent(stops.bottom, opacity));
        });
      }
      updateWallpaperOverlayControlUi();
      scheduleWallpaperAdaptiveToneUpdate();
      if (hasStoredWallpaperStateLoaded) {
        writeWallpaperPreloadCache();
      }
    }

    function updateWallpaperSliderElement(slider, config) {
      if (!slider) {
        return;
      }
      if (typeof config.dynamicRange === 'boolean') {
        if (config.dynamicRange) {
          slider.setAttribute('data-wallpaper-dynamic-range', 'true');
          slider.step = 'any';
        } else {
          slider.removeAttribute('data-wallpaper-dynamic-range');
          slider.min = String(Number.isFinite(Number(config.min)) ? Number(config.min) : 0);
          slider.max = String(Number.isFinite(Number(config.max)) ? Number(config.max) : 100);
          slider.step = '1';
        }
      }
      const value = Number(config.value);
      const normalizedValue = Number.isFinite(value) ? value : 0;
      ensureDynamicWallpaperSliderRange(slider, normalizedValue, false);
      slider.value = String(normalizedValue);
      updateWallpaperSliderFill(slider, normalizedValue);
      slider.setAttribute('aria-valuenow', String(normalizedValue));
      slider.setAttribute(
        'aria-valuetext',
        config.percent === true ? `${normalizedValue}%` : String(normalizedValue)
      );
      if (typeof config.enabled === 'boolean') {
        slider.disabled = !config.enabled;
        if (slider.parentElement) {
          slider.parentElement.setAttribute('data-disabled', config.enabled ? 'false' : 'true');
        }
      }
      if (config.labelKey) {
        slider.setAttribute('aria-label', t(config.labelKey, config.fallback));
      }
      syncWallpaperSliderValueInput(slider);
      syncWallpaperSliderValueBubble(slider);
      const sliderRow = typeof slider.closest === 'function'
        ? slider.closest('.x-nt-range-slider-row')
        : null;
      if (sliderRow) {
        if (config.percent === true) {
          sliderRow.setAttribute('data-value-suffix', '%');
          slider.setAttribute('data-value-suffix', '%');
        } else {
          sliderRow.removeAttribute('data-value-suffix');
          slider.removeAttribute('data-value-suffix');
        }
      }
      const endTick = sliderRow
        ? sliderRow.querySelector('.x-nt-overlay-tick[data-align="end"]')
        : null;
      if (endTick && !isDynamicWallpaperSlider(slider)) {
        endTick.textContent = Number(slider.max) === 100 ? '100%' : slider.max;
      }
      const middleTick = sliderRow
        ? sliderRow.querySelector('.x-nt-overlay-tick[data-overlay-tick="default"]')
        : null;
      if (middleTick && !isDynamicWallpaperSlider(slider)) {
        middleTick.textContent = config.percent === true
          ? `${Math.round((Number(slider.min) + Number(slider.max)) / 2)}%`
          : Number(slider.max) === 100
          ? t('newtab_wallpaper_overlay_default_tick', 'Default')
          : String(Math.round((Number(slider.min) + Number(slider.max)) / 2));
      }
    }

    function getWallpaperSliderValueInput(slider) {
      if (!slider || typeof slider.closest !== 'function') {
        return null;
      }
      const row = slider.closest('.x-nt-range-slider-row');
      return row
        ? row.querySelector('._x_extension_range_slider_value_input_2026_unique_')
        : null;
    }

    function isDynamicWallpaperSlider(slider) {
      return Boolean(slider && slider.getAttribute('data-wallpaper-dynamic-range') === 'true');
    }

    function ensureDynamicWallpaperSliderRange(slider, value, recenterAtEdge) {
      if (!isDynamicWallpaperSlider(slider) || !Number.isFinite(Number(value))) {
        return false;
      }
      const number = Number(value);
      const currentMin = Number(slider.min);
      const currentMax = Number(slider.max);
      const hasRange = Number.isFinite(currentMin) && Number.isFinite(currentMax) && currentMax > currentMin;
      const outside = !hasRange || number < currentMin || number > currentMax;
      const atEdge = hasRange && (number <= currentMin || number >= currentMax);
      if (!outside && !(recenterAtEdge && atEdge)) {
        return false;
      }
      const currentRadius = hasRange ? (currentMax - currentMin) / 2 : 50;
      const radius = Math.max(50, Math.abs(number) * 0.25, currentRadius);
      const rawMin = number - radius;
      const rawMax = number + radius;
      const nextMin = Number.isFinite(rawMin) ? rawMin : -Number.MAX_VALUE;
      const nextMax = Number.isFinite(rawMax) ? rawMax : Number.MAX_VALUE;
      if (!(nextMax > nextMin)) {
        return false;
      }
      slider.min = String(nextMin);
      slider.max = String(nextMax);
      return true;
    }

    function updateWallpaperSliderFill(slider, value) {
      if (!slider || !slider.style) {
        return;
      }
      const min = Number(slider.min);
      const max = Number(slider.max);
      const number = Number(value);
      const percent = Number.isFinite(number) && Number.isFinite(min) && Number.isFinite(max) && max > min
        ? ((number - min) / (max - min)) * 100
        : 0;
      slider.style.setProperty('--x-range-slider-percent', `${percent}%`);
    }

    function syncWallpaperSliderValueInput(slider) {
      const valueInput = getWallpaperSliderValueInput(slider);
      if (!valueInput) {
        return;
      }
      if (isDynamicWallpaperSlider(slider)) {
        valueInput.removeAttribute('min');
        valueInput.removeAttribute('max');
        valueInput.step = 'any';
      } else {
        valueInput.min = slider.min;
        valueInput.max = slider.max;
        valueInput.step = slider.step;
      }
      valueInput.value = slider.value;
      valueInput.disabled = Boolean(slider.disabled);
      const label = String(slider.getAttribute('aria-label') || '').trim();
      if (label) {
        // The spin button role already tells it apart from the slider; keep the localized name.
        valueInput.setAttribute('aria-label', label);
      }
    }

    function commitWallpaperSliderValueInput(slider) {
      const valueInput = getWallpaperSliderValueInput(slider);
      if (!slider || !valueInput) {
        return;
      }
      const draft = String(valueInput.value || '').trim();
      const number = Number(draft);
      if (!draft || !Number.isFinite(number)) {
        syncWallpaperSliderValueInput(slider);
        return;
      }
      const min = Number(slider.min);
      const max = Number(slider.max);
      const step = Number(slider.step);
      const dynamicRange = isDynamicWallpaperSlider(slider);
      if (dynamicRange) {
        ensureDynamicWallpaperSliderRange(slider, number, false);
      }
      const bounded = dynamicRange
        ? number
        : Math.min(
          Number.isFinite(max) ? max : number,
          Math.max(Number.isFinite(min) ? min : number, number)
        );
      const nextValue = !dynamicRange && Number.isFinite(step) && step > 0 && Number.isFinite(min)
        ? min + Math.round((bounded - min) / step) * step
        : bounded;
      slider.value = String(nextValue);
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
      syncWallpaperSliderValueInput(slider);
    }

    function bindWallpaperSliderValueInput(slider) {
      const valueInput = getWallpaperSliderValueInput(slider);
      if (!slider || !valueInput || valueInput.dataset.sliderValueInputBound === 'true') {
        return;
      }
      valueInput.dataset.sliderValueInputBound = 'true';
      slider.addEventListener('input', () => {
        syncWallpaperSliderValueInput(slider);
      });
      slider.addEventListener('change', () => {
        syncWallpaperSliderValueInput(slider);
      });
      valueInput.addEventListener('input', () => {
        if (isDynamicWallpaperSlider(slider)) {
          return;
        }
        const number = Number(valueInput.value);
        const min = Number(slider.min);
        const max = Number(slider.max);
        if (!Number.isFinite(number)) {
          return;
        }
        if (Number.isFinite(min) && number < min) {
          valueInput.value = String(min);
        } else if (Number.isFinite(max) && number > max) {
          valueInput.value = String(max);
        }
      });
      valueInput.addEventListener('blur', () => {
        commitWallpaperSliderValueInput(slider);
      });
      valueInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          valueInput.blur();
        }
      });
      syncWallpaperSliderValueInput(slider);
    }

    function updateWallpaperOverlayControlUi() {
      const value = getWallpaperOverlayOpacityForCurrentMode();
      updateWallpaperSliderElement(wallpaperOverlaySlider, {
        value,
        labelKey: 'newtab_wallpaper_overlay_opacity',
        fallback: 'Mask effect'
      });
      if (wallpaperOverlayLabel) {
        wallpaperOverlayLabel.textContent = t('newtab_wallpaper_overlay_opacity', 'Mask effect');
      }
    }

    function persistWallpaperOverlayOpacity(mode, value) {
      const nextMode = mode === 'dark' ? 'dark' : 'light';
      const nextValue = normalizeWallpaperOverlayOpacity(value, currentWallpaperOverlayOpacity[nextMode]);
      const nextPrefs = {
        version: NEWTAB_WALLPAPER_OVERLAY_STORAGE_VERSION,
        light: currentWallpaperOverlayOpacity.light,
        dark: currentWallpaperOverlayOpacity.dark,
        [nextMode]: nextValue
      };
      applyWallpaperOverlayOpacity(nextPrefs);
      if (!storageArea) {
        return;
      }
      if (wallpaperOverlaySaveTimer !== null) {
        clearTimeout(wallpaperOverlaySaveTimer);
      }
      wallpaperOverlaySaveTimer = setTimeout(() => {
        wallpaperOverlaySaveTimer = null;
        storageArea.set({ [NEWTAB_WALLPAPER_OVERLAY_STORAGE_KEY]: nextPrefs });
      }, 120);
    }

    function bootstrapInitialWallpaperOverlay() {
      if (initialWallpaperOverlayReadyPromise) {
        return initialWallpaperOverlayReadyPromise;
      }
      initialWallpaperOverlayReadyPromise = new Promise((resolve) => {
        if (!storageArea) {
          applyWallpaperOverlayOpacity({
            version: NEWTAB_WALLPAPER_OVERLAY_STORAGE_VERSION,
            light: NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.light,
            dark: NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.dark
          });
          resolve();
          return;
        }
        storageArea.get([NEWTAB_WALLPAPER_OVERLAY_STORAGE_KEY], (result) => {
          const raw = result ? result[NEWTAB_WALLPAPER_OVERLAY_STORAGE_KEY] : null;
          const prefs = normalizeWallpaperOverlayPrefs(raw);
          applyWallpaperOverlayOpacity(prefs);
          if (raw && JSON.stringify(raw) !== JSON.stringify(prefs)) {
            storageArea.set({ [NEWTAB_WALLPAPER_OVERLAY_STORAGE_KEY]: prefs });
          }
          resolve();
        });
      });
      return initialWallpaperOverlayReadyPromise;
    }

    function normalizeWallpaperEffectPrefs(value) {
      return normalizeSingleWallpaperEffectPrefs(value);
    }

    function getWallpaperEffectPrefsForMode(mode) {
      const normalizedMode = normalizeWallpaperMode(mode);
      return normalizeWallpaperEffectPrefs(
        currentWallpaperEffectPrefsByMode &&
          currentWallpaperEffectPrefsByMode[normalizedMode]
      );
    }

    function getWallpaperEffectEditMode() {
      return currentWallpaperPrefs && currentWallpaperPrefs.sameForModes === false
        ? getWallpaperEditMode()
        : getResolvedWallpaperMode();
    }

    function getWallpaperEffectPrefsForEditMode() {
      return getWallpaperEffectPrefsForMode(getWallpaperEffectEditMode());
    }

    function cloneWallpaperEffectStoragePrefs(value) {
      return normalizeWallpaperEffectStoragePrefs(value);
    }

    function setWallpaperEffectPrefsForModes(nextPrefsByMode) {
      currentWallpaperEffectPrefsByMode = cloneWallpaperEffectStoragePrefs(nextPrefsByMode);
    }

    function getWallpaperEffectStorageValue() {
      return cloneWallpaperEffectStoragePrefs(currentWallpaperEffectPrefsByMode);
    }

    function setSharedWallpaperEffectPrefs(value) {
      const shared = normalizeWallpaperEffectPrefs(value);
      setWallpaperEffectPrefsForModes({
        version: WALLPAPER_EFFECT_MODE_STORAGE_VERSION,
        light: shared,
        dark: shared
      });
    }

    function synchronizeWallpaperEffectPrefsWithWallpaperModes(sourceMode) {
      if (!hasStoredWallpaperEffectLoaded ||
          !hasStoredWallpaperStateLoaded ||
          !currentWallpaperPrefs ||
          currentWallpaperPrefs.sameForModes === false) {
        return false;
      }
      const mode = normalizeWallpaperMode(sourceMode || getResolvedWallpaperMode());
      const before = JSON.stringify(getWallpaperEffectStorageValue());
      setSharedWallpaperEffectPrefs(getWallpaperEffectPrefsForMode(mode));
      return before !== JSON.stringify(getWallpaperEffectStorageValue());
    }

    function doesWallpaperEffectSupportSize(type) {
      return type === 'blocks' || type === 'halftone' || type === 'dither' || type === 'ascii';
    }

    function doesWallpaperEffectSupportSpacing(type) {
      return type === 'halftone' || type === 'dither' || type === 'ascii';
    }

    function doesWallpaperEffectSupportInkTone(type) {
      return type === 'halftone' || type === 'ascii';
    }

    function getWallpaperEffectInkToneForUi(prefs) {
      return WALLPAPER_EFFECTS.resolveAutoInkTone(prefs && prefs.inkTone, getWallpaperEffectEditMode());
    }

    function getWallpaperEffectInkToneLabel(tone) {
      const item = NEWTAB_WALLPAPER_EFFECT_INK_TONES.find((option) => option.tone === tone) ||
        NEWTAB_WALLPAPER_EFFECT_INK_TONES[0];
      return t(item.labelKey, item.fallback);
    }

    function getWallpaperEffectLabel(type) {
      const item = NEWTAB_WALLPAPER_EFFECT_TYPES.find((effect) => effect.type === type) ||
        NEWTAB_WALLPAPER_EFFECT_TYPES[0];
      return t(item.labelKey, item.fallback);
    }

    function updateWallpaperEffectTabsIndicator() {
      updateWallpaperTabsIndicatorFor(
        wallpaperEffectInkToneOptions,
        wallpaperEffectInkToneIndicator,
        'button[data-wallpaper-effect-ink-tone][data-active="true"]'
      );
    }

    function scheduleWallpaperEffectTabsIndicatorRefresh() {
      if (wallpaperEffectTabsIndicatorRefreshFrame) {
        return;
      }
      wallpaperEffectTabsIndicatorRefreshFrame = requestAnimationFrame(() => {
        wallpaperEffectTabsIndicatorRefreshFrame = requestAnimationFrame(() => {
          wallpaperEffectTabsIndicatorRefreshFrame = 0;
          updateWallpaperEffectTabsIndicator();
        });
      });
    }

    // Measurement is shared with every segmented control (react-src/shared/segmented-indicator.ts).
    function updateWallpaperTabsIndicatorFor(tabs, indicator, selector) {
      const segmentedIndicator = globalThis.LumnoSegmentedIndicator;
      if (!tabs || !indicator || !segmentedIndicator) {
        return;
      }
      segmentedIndicator.apply(
        indicator,
        segmentedIndicator.measure(tabs, indicator, tabs.querySelector(selector))
      );
    }

    function updateWallpaperTabsIndicator() {
      updateWallpaperTabsIndicatorFor(
        wallpaperTabs,
        wallpaperTabsIndicator,
        'button[data-wallpaper-tab][data-active="true"]'
      );
    }

    function updateWallpaperModeTabsIndicator() {
      updateWallpaperTabsIndicatorFor(
        wallpaperModeTabs,
        wallpaperModeTabsIndicator,
        'button[data-wallpaper-mode][data-active="true"]'
      );
    }

    function updateTopContentTabsIndicator() {
      updateWallpaperTabsIndicatorFor(
        topContentTabs,
        topContentTabsIndicator,
        'button[data-newtab-top-content][data-active="true"]'
      );
    }

    function updateAppearanceScopeTabsIndicator() {
      updateWallpaperTabsIndicatorFor(
        wallpaperAppearanceScopeTabs,
        wallpaperAppearanceScopeTabsIndicator,
        'button[data-theme-scope][data-active="true"]'
      );
    }

    function scheduleWallpaperTabsIndicatorRefresh() {
      if (wallpaperTabsIndicatorRefreshFrame) {
        return;
      }
      wallpaperTabsIndicatorRefreshFrame = requestAnimationFrame(() => {
        wallpaperTabsIndicatorRefreshFrame = requestAnimationFrame(() => {
          wallpaperTabsIndicatorRefreshFrame = 0;
          updateWallpaperTabsIndicator();
        });
      });
    }

    function scheduleWallpaperModeTabsIndicatorRefresh() {
      if (wallpaperModeTabsIndicatorRefreshFrame) {
        return;
      }
      wallpaperModeTabsIndicatorRefreshFrame = requestAnimationFrame(() => {
        wallpaperModeTabsIndicatorRefreshFrame = requestAnimationFrame(() => {
          wallpaperModeTabsIndicatorRefreshFrame = 0;
          updateWallpaperModeTabsIndicator();
        });
      });
    }

    function scheduleTopContentTabsIndicatorRefresh() {
      if (topContentTabsIndicatorRefreshFrame) {
        return;
      }
      topContentTabsIndicatorRefreshFrame = requestAnimationFrame(() => {
        topContentTabsIndicatorRefreshFrame = requestAnimationFrame(() => {
          topContentTabsIndicatorRefreshFrame = 0;
          updateTopContentTabsIndicator();
        });
      });
    }

    function scheduleAppearanceScopeTabsIndicatorRefresh() {
      if (appearanceScopeTabsIndicatorRefreshFrame) {
        return;
      }
      appearanceScopeTabsIndicatorRefreshFrame = requestAnimationFrame(() => {
        appearanceScopeTabsIndicatorRefreshFrame = requestAnimationFrame(() => {
          appearanceScopeTabsIndicatorRefreshFrame = 0;
          updateAppearanceScopeTabsIndicator();
        });
      });
    }

    function updateWallpaperPanelTabIndicators() {
      updateWallpaperModeTabsIndicator();
      updateWallpaperTabsIndicator();
      updateWallpaperEffectTabsIndicator();
      updateTopContentTabsIndicator();
      updateAppearanceScopeTabsIndicator();
    }

    function scheduleWallpaperPanelTabIndicatorsRefresh() {
      scheduleWallpaperModeTabsIndicatorRefresh();
      scheduleWallpaperTabsIndicatorRefresh();
      scheduleWallpaperEffectTabsIndicatorRefresh();
      scheduleTopContentTabsIndicatorRefresh();
      scheduleAppearanceScopeTabsIndicatorRefresh();
    }

    function scheduleWallpaperPanelOpenTabIndicatorsRefresh() {
      scheduleWallpaperPanelTabIndicatorsRefresh();
      window.setTimeout(() => {
        if (isWallpaperPanelOpen()) {
          updateWallpaperPanelTabIndicators();
        }
      }, 240);
      if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
        document.fonts.ready.then(() => {
          if (isWallpaperPanelOpen()) {
            scheduleWallpaperPanelTabIndicatorsRefresh();
          }
        }).catch(() => {});
      }
    }

    function cleanupWallpaperPanelResize() {
      if (wallpaperPanelResizeTimer !== null) {
        window.clearTimeout(wallpaperPanelResizeTimer);
        wallpaperPanelResizeTimer = null;
      }
      if (typeof wallpaperPanelResizeCleanup === 'function') {
        wallpaperPanelResizeCleanup();
        wallpaperPanelResizeCleanup = null;
      }
    }

    function measureWallpaperPanelOpenHeight() {
      if (!wallpaperPanel) {
        return 0;
      }
      const previousHeight = wallpaperPanel.style.height;
      const previousTransition = wallpaperPanel.style.transition;
      wallpaperPanel.style.transition = 'none';
      wallpaperPanel.style.height = 'auto';
      const height = wallpaperPanel.getBoundingClientRect().height;
      wallpaperPanel.style.height = previousHeight;
      wallpaperPanel.style.transition = previousTransition;
      return height;
    }

    function animateWallpaperPanelResize(mutate) {
      if (typeof mutate !== 'function') {
        return;
      }
      const canAnimate = wallpaperPanel &&
        isWallpaperPanelOpen() &&
        !shouldReduceMotion();
      if (!canAnimate) {
        mutate();
        scheduleWallpaperPanelTabIndicatorsRefresh();
        return;
      }

      cleanupWallpaperPanelResize();
      const startHeight = wallpaperPanel.getBoundingClientRect().height;
      const previousHeight = wallpaperPanel.style.height;
      const previousOverflow = wallpaperPanel.style.overflow;
      const previousTransition = wallpaperPanel.style.transition;
      const previousWillChange = wallpaperPanel.style.willChange;

      wallpaperPanel.style.height = `${startHeight}px`;
      wallpaperPanel.style.overflow = 'hidden';
      wallpaperPanel.style.willChange = 'height, transform, opacity, filter';
      mutate();
      const endHeight = measureWallpaperPanelOpenHeight();

      const restorePanel = () => {
        wallpaperPanel.style.height = previousHeight;
        wallpaperPanel.style.overflow = previousOverflow;
        wallpaperPanel.style.transition = previousTransition;
        wallpaperPanel.style.willChange = previousWillChange;
        wallpaperPanel.removeEventListener('transitionend', handleTransitionEnd);
        if (wallpaperPanelResizeTimer !== null) {
          window.clearTimeout(wallpaperPanelResizeTimer);
          wallpaperPanelResizeTimer = null;
        }
        wallpaperPanelResizeCleanup = null;
        scheduleWallpaperPanelTabIndicatorsRefresh();
      };
      function handleTransitionEnd(event) {
        if (event && event.target === wallpaperPanel && event.propertyName === 'height') {
          restorePanel();
        }
      }

      if (Math.abs(endHeight - startHeight) < 1) {
        restorePanel();
        return;
      }

      wallpaperPanelResizeCleanup = restorePanel;
      wallpaperPanel.style.height = `${startHeight}px`;
      wallpaperPanel.style.transition = `height ${WALLPAPER_PANEL_RESIZE_DURATION_MS}ms ${WALLPAPER_PANEL_RESIZE_EASING}`;
      void wallpaperPanel.offsetHeight;
      wallpaperPanel.addEventListener('transitionend', handleTransitionEnd);
      requestAnimationFrame(() => {
        if (!wallpaperPanelResizeCleanup) {
          return;
        }
        wallpaperPanel.style.height = `${endHeight}px`;
      });
      wallpaperPanelResizeTimer = window.setTimeout(restorePanel, WALLPAPER_PANEL_RESIZE_DURATION_MS + 80);
    }

    function updateWallpaperTabSelectionUi(tab) {
      const nextTab = normalizeWallpaperSourceTab(tab);
      if (wallpaperBody) {
        wallpaperBody.setAttribute('data-active-tab', nextTab);
      }
      [
        { tab: 'built-in', button: wallpaperBuiltInTab, panel: wallpaperBuiltInGrid },
        { tab: 'local', button: wallpaperLocalTab, panel: wallpaperLocalGrid },
        { tab: 'bing', button: wallpaperBingTab, panel: wallpaperBingPanel },
        { tab: 'curated', button: wallpaperCuratedTab, panel: wallpaperCuratedPanel }
      ].forEach((item) => {
        const selected = item.tab === nextTab;
        if (item.button) {
          item.button.setAttribute('data-active', selected ? 'true' : 'false');
          item.button.setAttribute('aria-selected', selected ? 'true' : 'false');
          item.button.tabIndex = selected ? 0 : -1;
        }
        if (item.panel) {
          item.panel.setAttribute('aria-hidden', selected ? 'false' : 'true');
        }
      });
    }

    function setWallpaperElementVisible(element, visible) {
      if (!element) {
        return false;
      }
      const nextVisible = visible ? 'true' : 'false';
      const changed = element.getAttribute('data-visible') !== nextVisible;
      element.setAttribute('data-visible', nextVisible);
      element.setAttribute('aria-hidden', visible ? 'false' : 'true');
      if (changed && visible) {
        playWallpaperEnterMotion(element, 'enter');
      }
      return changed;
    }

    function updateWallpaperModeTabsUi() {
      const activeMode = normalizeWallpaperMode(activeWallpaperMode);
      [
        { mode: NEWTAB_WALLPAPER_MODE_LIGHT, button: wallpaperLightModeTab },
        { mode: NEWTAB_WALLPAPER_MODE_DARK, button: wallpaperDarkModeTab }
      ].forEach((item) => {
        const selected = item.mode === activeMode;
        if (!item.button) {
          return;
        }
        item.button.setAttribute('data-active', selected ? 'true' : 'false');
        item.button.setAttribute('aria-selected', selected ? 'true' : 'false');
        item.button.tabIndex = selected ? 0 : -1;
      });
      scheduleWallpaperModeTabsIndicatorRefresh();
    }


    function updateWallpaperModeControlsUi(options) {
      const animate = !options || options.animate !== false;
      const showSplitControls = Boolean(currentWallpaperPrefs && currentWallpaperPrefs.sameForModes === false);
      const apply = () => {
        if (wallpaperModeSyncToggle) {
          const checked = !showSplitControls;
          wallpaperModeSyncToggle.checked = checked;
          wallpaperModeSyncToggle.setAttribute('aria-checked', checked ? 'true' : 'false');
          wallpaperModeSyncToggle.setAttribute(
            'aria-label',
            t('newtab_wallpaper_mode_sync_toggle_label', 'Use the same wallpaper for light and dark mode')
          );
        }
        if (wallpaperModeSyncTitle) {
          wallpaperModeSyncTitle.textContent = t('newtab_wallpaper_mode_sync_title', 'Match light and dark mode');
        }
        if (wallpaperModeTabs) {
          wallpaperModeTabs.setAttribute('aria-label', t('newtab_wallpaper_mode_tabs_label', 'Wallpaper color mode'));
          wallpaperModeTabs.querySelectorAll('.x-nt-wallpaper-mode-tab').forEach((button) => {
            const mode = normalizeWallpaperMode(button.getAttribute('data-wallpaper-mode'));
            button.textContent = mode === NEWTAB_WALLPAPER_MODE_DARK
              ? t('newtab_wallpaper_dark_mode_tab', 'Dark')
              : t('newtab_wallpaper_light_mode_tab', 'Light');
            button.setAttribute('aria-label', formatMessage(
              'newtab_wallpaper_mode_select_label',
              'Edit {mode} wallpaper',
              { mode: getWallpaperModeLabel(mode) }
            ));
          });
        }
        if (wallpaperModeLabel) {
          wallpaperModeLabel.textContent = t('newtab_wallpaper_mode_row_title', 'Mode');
        }
        const changed = setWallpaperElementVisible(wallpaperModeRow, showSplitControls);
        updateWallpaperModeTabsUi();
        if (changed) {
          scheduleWallpaperPanelTabIndicatorsRefresh();
        }
      };
      const shouldResize = Boolean(wallpaperModeRow) &&
        (wallpaperModeRow.getAttribute('data-visible') === 'true') !== showSplitControls;
      if (animate && shouldResize) {
        animateWallpaperPanelResize(apply);
        return;
      }
      apply();
    }

    function setWallpaperActiveTab(tab) {
      const nextTab = normalizeWallpaperSourceTab(tab);
      const isSameTab = activeWallpaperTab === nextTab &&
        wallpaperBody &&
        wallpaperBody.getAttribute('data-active-tab') === nextTab;
      if (isSameTab) {
        updateWallpaperTabSelectionUi(nextTab);
        scheduleWallpaperTabsIndicatorRefresh();
        if (nextTab === 'local' && isWallpaperPanelOpen()) {
          loadCustomWallpapers();
        }
        return;
      }
      animateWallpaperPanelResize(() => {
        const previousTab = activeWallpaperTab;
        activeWallpaperTab = nextTab;
        if (nextTab === 'curated') showCuratedCategoryOfSelection();
        updateWallpaperTabSelectionUi(nextTab);
        playWallpaperEnterMotion(
          getWallpaperGridForTab(nextTab),
          WALLPAPER_SOURCE_TABS.indexOf(nextTab) < WALLPAPER_SOURCE_TABS.indexOf(previousTab) ? 'enter-prev' : 'enter-next'
        );
      });
      scheduleWallpaperTabsIndicatorRefresh();
      if (nextTab === 'local' && isWallpaperPanelOpen()) {
        loadCustomWallpapers();
      }
      if (nextTab === 'bing' && isWallpaperPanelOpen()) loadBingCatalog();
    }

    // Opening the curated source shows the category and page of the chosen or daily photo.
    function showCuratedCategoryOfSelection() {
      const selectedId = getWallpaperSelectionIdForUi();
      const selected = getWallpaperById(selectedId);
      // A daily choice keeps its own category, which may be the random mix.
      const category = selected && selected.provider === 'curated'
        ? (REMOTE_CONTENT.isDailyWallpaperId(selectedId) ? REMOTE_CONTENT.wallpaperFromId(selectedId).category : selected.category)
        : '';
      if (!category) {
        return;
      }
      curatedCategory = category;
      showCuratedPageOfSelection();
      renderCuratedTiles();
    }

    // Follow the selection only when it moves, so storage reloads (deleting a
    // local wallpaper, syncs, theme changes) keep the tab the user is browsing.
    function syncWallpaperSourceTabToEditMode(options) {
      const selectedId = getWallpaperSelectionIdForUi();
      const force = Boolean(options && options.force);
      if (!force && selectedId === lastSyncedWallpaperSourceId) {
        return;
      }
      lastSyncedWallpaperSourceId = selectedId;
      if (selectedId) {
        setWallpaperActiveTab(getWallpaperSourceTabForId(selectedId));
      }
    }

    function setWallpaperActiveMode(mode) {
      bingSelectionSeq += 1;
      const nextMode = normalizeWallpaperMode(mode);
      if (activeWallpaperMode === nextMode &&
          wallpaperModeTabs &&
          wallpaperModeTabs.querySelector(`button[data-wallpaper-mode="${nextMode}"][data-active="true"]`)) {
        updateWallpaperModeControlsUi({ animate: false });
        updateWallpaperSelectionUi();
        updateWallpaperEffectControlUi();
        return;
      }
      animateWallpaperPanelResize(() => {
        activeWallpaperMode = nextMode;
        updateWallpaperModeControlsUi({ animate: false });
        updateWallpaperSelectionUi();
        updateWallpaperEffectControlUi();
        syncWallpaperSourceTabToEditMode({ force: true });
        playWallpaperEnterMotion(getWallpaperGridForTab(activeWallpaperTab), 'enter');
      });
      scheduleWallpaperPanelTabIndicatorsRefresh();
    }

    function updateWallpaperAccordionUi(enabled) {
      if (!wallpaperAccordionTrigger) return;
      const expanded = Boolean(enabled && wallpaperSectionExpanded);
      wallpaperAccordionTrigger.disabled = !enabled;
      wallpaperAccordionTrigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      wallpaperAccordionTrigger.setAttribute('aria-disabled', enabled ? 'false' : 'true');
    }

    // Sections without an on/off switch only need a plain expand/collapse toggle.
    function bindPanelSectionDisclosure(trigger, body) {
      if (!trigger || !body) return;
      const apply = (expanded) => {
        trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        body.hidden = !expanded;
        body.setAttribute('data-visible', expanded ? 'true' : 'false');
        body.setAttribute('aria-hidden', expanded ? 'false' : 'true');
        if (expanded) scheduleWallpaperPanelTabIndicatorsRefresh();
      };
      apply(trigger.getAttribute('aria-expanded') !== 'false');
      trigger.addEventListener('click', () => {
        apply(trigger.getAttribute('aria-expanded') !== 'true');
      });
    }

    function setWallpaperBodyVisible(visible) {
      if (!wallpaperBody) {
        return;
      }
      const nextVisible = visible ? 'true' : 'false';
      if (wallpaperBody.getAttribute('data-visible') === nextVisible) {
        wallpaperBody.setAttribute('aria-hidden', visible ? 'false' : 'true');
        if (visible) {
          scheduleWallpaperPanelTabIndicatorsRefresh();
        }
        return;
      }
      // Height and fade are animated by the .x-nt-panel-collapsible styles.
      wallpaperBody.setAttribute('data-visible', nextVisible);
      wallpaperBody.setAttribute('aria-hidden', visible ? 'false' : 'true');
      if (visible) {
        scheduleWallpaperTabsIndicatorRefresh();
        scheduleWallpaperEffectTabsIndicatorRefresh();
      }
    }

    function setWallpaperEffectSliderControlVisible(control, visible) {
      if (!control) {
        return false;
      }
      const nextVisible = visible ? 'true' : 'false';
      const changed = control.getAttribute('data-visible') !== nextVisible;
      control.setAttribute('data-visible', nextVisible);
      control.setAttribute('aria-hidden', visible ? 'false' : 'true');
      if (changed && visible) {
        playWallpaperEnterMotion(control, 'enter');
      }
      return changed;
    }

    function applyWallpaperEffectForResolvedMode() {
      const previousType = currentAppliedWallpaperEffectPrefs.type;
      const nextPrefs = getWallpaperEffectPrefsForMode(getResolvedWallpaperMode());
      const transitionLayer = previousType !== nextPrefs.type
        ? createWallpaperTransitionLayer()
        : null;
      if (transitionLayer) {
        transitionLayer.setAttribute('data-wallpaper-filter-transition', 'true');
      }
      currentAppliedWallpaperEffectPrefs = nextPrefs;
      if (document.body) {
        document.body.setAttribute('data-wallpaper-effect', currentAppliedWallpaperEffectPrefs.type);
      }
      const effectRenderReady = wallpaperEffects
        ? wallpaperEffects.apply(WALLPAPER_EFFECTS.resolvePrefsForMode(
          currentAppliedWallpaperEffectPrefs,
          getResolvedWallpaperMode()
        ))
        : null;
      if (transitionLayer && effectRenderReady && typeof effectRenderReady.then === 'function') {
        Promise.resolve(effectRenderReady).then(
          () => releaseWallpaperTransitionLayer(transitionLayer),
          () => releaseWallpaperTransitionLayer(transitionLayer)
        );
      } else {
        releaseWallpaperTransitionLayer(transitionLayer);
      }
      updateWallpaperEffectControlUi();
    }

    function applyWallpaperEffectPrefs(value) {
      setWallpaperEffectPrefsForModes(normalizeWallpaperEffectStoragePrefs(value));
      synchronizeWallpaperEffectPrefsWithWallpaperModes();
      applyWallpaperEffectForResolvedMode();
    }

    function getWallpaperEffectControlVisibility(prefs) {
      return {
        inkTone: doesWallpaperEffectSupportInkTone(prefs.type),
        strength: prefs.type !== 'none' && prefs.type !== 'blocks',
        size: doesWallpaperEffectSupportSize(prefs.type),
        spacing: doesWallpaperEffectSupportSpacing(prefs.type),
        texture: prefs.type === 'blur',
        crtBloom: prefs.type === 'crt',
        crtRgbOffset: prefs.type === 'crt',
        crtCurvature: prefs.type === 'crt'
      };
    }

    function isWallpaperEffectControlVisibilityChanged(control, visible) {
      return Boolean(control &&
        control.getAttribute('data-visible') !== (visible ? 'true' : 'false'));
    }

    function updateWallpaperEffectControlsVisibility(visibility) {
      const changed = [
        [wallpaperEffectInkToneControl, visibility.inkTone],
        [wallpaperEffectStrengthControl, visibility.strength],
        [wallpaperEffectSizeControl, visibility.size],
        [wallpaperEffectSpacingControl, visibility.spacing],
        [wallpaperEffectTextureControl, visibility.texture],
        [wallpaperEffectCrtBloomControl, visibility.crtBloom],
        [wallpaperEffectCrtRgbOffsetControl, visibility.crtRgbOffset],
        [wallpaperEffectCrtCurvatureControl, visibility.crtCurvature]
      ].some((item) => isWallpaperEffectControlVisibilityChanged(item[0], item[1]));
      const applyVisibility = () => {
        setWallpaperEffectSliderControlVisible(wallpaperEffectInkToneControl, visibility.inkTone);
        setWallpaperEffectSliderControlVisible(wallpaperEffectStrengthControl, visibility.strength);
        setWallpaperEffectSliderControlVisible(wallpaperEffectSizeControl, visibility.size);
        setWallpaperEffectSliderControlVisible(wallpaperEffectSpacingControl, visibility.spacing);
        setWallpaperEffectSliderControlVisible(wallpaperEffectTextureControl, visibility.texture);
        setWallpaperEffectSliderControlVisible(wallpaperEffectCrtBloomControl, visibility.crtBloom);
        setWallpaperEffectSliderControlVisible(wallpaperEffectCrtRgbOffsetControl, visibility.crtRgbOffset);
        setWallpaperEffectSliderControlVisible(wallpaperEffectCrtCurvatureControl, visibility.crtCurvature);
      };
      if (changed) {
        animateWallpaperPanelResize(applyVisibility);
        return;
      }
      applyVisibility();
    }

    function updateWallpaperEffectOptionsUi(prefs) {
      if (!wallpaperViewController) {
        return;
      }
      wallpaperViewController.renderEffectSelect({
        ariaLabel: t('newtab_wallpaper_effect_title', 'Wallpaper filter'),
        options: NEWTAB_WALLPAPER_EFFECT_TYPES.map((item) => ({
          value: item.type,
          label: getWallpaperEffectLabel(item.type)
        })),
        value: prefs.type,
        onChange: (type) => {
          persistWallpaperEffectPrefs({ type });
        }
      });
    }

    function updateWallpaperEffectInkToneUi(prefs) {
      if (!wallpaperEffectInkToneOptions) {
        return;
      }
      const selectedTone = getWallpaperEffectInkToneForUi(prefs);
      wallpaperEffectInkToneOptions.querySelectorAll('[data-wallpaper-effect-ink-tone]').forEach((button) => {
        const tone = button.getAttribute('data-wallpaper-effect-ink-tone') || 'dark';
        const selected = tone === selectedTone;
        const label = getWallpaperEffectInkToneLabel(tone);
        button.textContent = label;
        button.setAttribute('data-active', selected ? 'true' : 'false');
        button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        button.setAttribute(
          'aria-label',
          formatMessage('newtab_wallpaper_effect_ink_select_label', 'Sample {tone} for dots or characters', {
            tone: label
          })
        );
      });
      const title = t('newtab_wallpaper_effect_ink_title', 'Sample tones');
      if (wallpaperEffectInkToneLabel) {
        wallpaperEffectInkToneLabel.textContent = title;
      }
      wallpaperEffectInkToneOptions.setAttribute('aria-label', title);
      scheduleWallpaperEffectTabsIndicatorRefresh();
    }

    function getWallpaperEffectStrengthLabel(prefs) {
      if (prefs.type === 'blur') {
        return { labelKey: 'newtab_wallpaper_effect_blur_strength', fallback: 'Blur strength' };
      }
      if (prefs.type === 'crt') {
        return { labelKey: 'newtab_wallpaper_effect_crt_strength', fallback: 'Display intensity' };
      }
      return { labelKey: 'newtab_wallpaper_effect_strength', fallback: 'Sampling strength' };
    }

    function getWallpaperEffectSizeLabel(prefs) {
      if (prefs.type === 'blocks') {
        return { labelKey: 'newtab_wallpaper_effect_blocks_size', fallback: 'Block size' };
      }
      return { labelKey: 'newtab_wallpaper_effect_size', fallback: 'Size' };
    }

    function getWallpaperEffectSpacingLabel(prefs) {
      return { labelKey: 'newtab_wallpaper_effect_spacing', fallback: 'Spacing' };
    }

    function getWallpaperEffectTextureLabel() {
      return { labelKey: 'newtab_wallpaper_effect_texture', fallback: 'Texture' };
    }

    function updateWallpaperEffectSlidersUi(prefs, visibility) {
      const strengthLabel = getWallpaperEffectStrengthLabel(prefs);
      const sizeLabel = getWallpaperEffectSizeLabel(prefs);
      const spacingLabel = getWallpaperEffectSpacingLabel(prefs);
      const textureLabel = getWallpaperEffectTextureLabel();
      updateWallpaperSliderElement(wallpaperEffectSlider, {
        value: prefs.type === 'crt'
          ? getCrtParameterPercent('crtStrength', prefs.crtStrength)
          : prefs.strength,
        enabled: visibility.strength,
        dynamicRange: false,
        min: 0,
        max: 100,
        percent: prefs.type === 'crt',
        labelKey: strengthLabel.labelKey,
        fallback: strengthLabel.fallback
      });
      updateWallpaperSliderElement(wallpaperEffectSizeSlider, {
        value: prefs.type === 'blocks' ? prefs.blockSize : prefs.size,
        enabled: visibility.size,
        dynamicRange: false,
        min: 0,
        max: prefs.type === 'blocks' ? BLOCK_PARAMETER_MAX : 100,
        percent: false,
        labelKey: sizeLabel.labelKey,
        fallback: sizeLabel.fallback
      });
      updateWallpaperSliderElement(wallpaperEffectSpacingSlider, {
        value: Math.round(clampNumber(prefs.spacing, 0, prefs.type === 'blocks' ? 5 : 100)),
        enabled: visibility.spacing,
        dynamicRange: false,
        min: 0,
        max: prefs.type === 'blocks' ? BLOCK_PARAMETER_MAX : 100,
        percent: true,
        labelKey: spacingLabel.labelKey,
        fallback: spacingLabel.fallback
      });
      updateWallpaperSliderElement(wallpaperEffectTextureSlider, {
        value: prefs.texture,
        enabled: visibility.texture,
        dynamicRange: false,
        labelKey: textureLabel.labelKey,
        fallback: textureLabel.fallback
      });
      [
        { prefKey: 'crtBloom', slider: wallpaperEffectCrtBloomSlider, value: prefs.crtBloom, enabled: visibility.crtBloom, key: 'newtab_wallpaper_effect_crt_bloom', fallback: 'Bloom' },
        { prefKey: 'crtRgbOffset', slider: wallpaperEffectCrtRgbOffsetSlider, value: prefs.crtRgbOffset, enabled: visibility.crtRgbOffset, key: 'newtab_wallpaper_effect_crt_rgb_offset', fallback: 'RGB offset' },
        { prefKey: 'crtCurvature', slider: wallpaperEffectCrtCurvatureSlider, value: prefs.crtCurvature, enabled: visibility.crtCurvature, key: 'newtab_wallpaper_effect_crt_curvature', fallback: 'Screen curvature' }
      ].forEach((item) => updateWallpaperSliderElement(item.slider, {
        value: getCrtParameterPercent(item.prefKey, item.value),
        enabled: item.enabled,
        dynamicRange: false,
        min: 0,
        max: 100,
        percent: true,
        labelKey: item.key,
        fallback: item.fallback
      }));
    }

    function updateWallpaperEffectTextUi(prefs) {
      if (wallpaperEffectLabel) {
        wallpaperEffectLabel.textContent = t('newtab_wallpaper_effect_title', 'Wallpaper filter');
      }
      if (wallpaperEffectStrengthLabel) {
        const strengthLabel = getWallpaperEffectStrengthLabel(prefs);
        wallpaperEffectStrengthLabel.textContent = t(
          strengthLabel.labelKey,
          strengthLabel.fallback
        );
      }
      if (wallpaperEffectSizeLabel) {
        const sizeLabel = getWallpaperEffectSizeLabel(prefs);
        wallpaperEffectSizeLabel.textContent = t(sizeLabel.labelKey, sizeLabel.fallback);
      }
      if (wallpaperEffectSpacingLabel) {
        const spacingLabel = getWallpaperEffectSpacingLabel(prefs);
        wallpaperEffectSpacingLabel.textContent = t(spacingLabel.labelKey, spacingLabel.fallback);
      }
      if (wallpaperEffectTextureLabel) {
        const textureLabel = getWallpaperEffectTextureLabel();
        wallpaperEffectTextureLabel.textContent = t(textureLabel.labelKey, textureLabel.fallback);
      }
      [
        [wallpaperEffectCrtBloomLabel, 'newtab_wallpaper_effect_crt_bloom', 'Bloom'],
        [wallpaperEffectCrtRgbOffsetLabel, 'newtab_wallpaper_effect_crt_rgb_offset', 'RGB offset'],
        [wallpaperEffectCrtCurvatureLabel, 'newtab_wallpaper_effect_crt_curvature', 'Screen curvature']
      ].forEach((item) => {
        if (item[0]) item[0].textContent = t(item[1], item[2]);
      });
    }

    function updateWallpaperEffectControlUi() {
      const prefs = getWallpaperEffectPrefsForEditMode();
      const visibility = getWallpaperEffectControlVisibility(prefs);
      updateWallpaperEffectControlsVisibility(visibility);
      updateWallpaperEffectOptionsUi(prefs);
      updateWallpaperEffectInkToneUi(prefs);
      updateWallpaperEffectSlidersUi(prefs, visibility);
      updateWallpaperEffectTextUi(prefs);
    }

    function persistWallpaperEffectPrefs(partial) {
      const editMode = getWallpaperEffectEditMode();
      const nextPrefs = normalizeWallpaperEffectPrefs(Object.assign(
        {},
        getWallpaperEffectPrefsForMode(editMode),
        partial || {}
      ));
      const nextPrefsByMode = getWallpaperEffectStorageValue();
      const targetModes = currentWallpaperPrefs && currentWallpaperPrefs.sameForModes === false
        ? [editMode]
        : NEWTAB_WALLPAPER_MODES;
      targetModes.forEach((mode) => {
        nextPrefsByMode[mode] = nextPrefs;
      });
      setWallpaperEffectPrefsForModes(nextPrefsByMode);
      applyWallpaperEffectForResolvedMode();
      if (hasStoredWallpaperStateLoaded) {
        writeWallpaperPreloadCache();
      }
      if (!storageArea) {
        return;
      }
      if (wallpaperEffectSaveTimer !== null) {
        clearTimeout(wallpaperEffectSaveTimer);
      }
      wallpaperEffectSaveTimer = setTimeout(() => {
        wallpaperEffectSaveTimer = null;
        storageArea.set({
          [NEWTAB_WALLPAPER_EFFECT_STORAGE_KEY]: getWallpaperEffectStorageValue()
        });
      }, 120);
    }

    function bootstrapInitialWallpaperEffect() {
      if (initialWallpaperEffectReadyPromise) {
        return initialWallpaperEffectReadyPromise;
      }
      if (!storageArea) {
        initialWallpaperEffectReadyPromise = Promise.resolve().then(() => {
          hasStoredWallpaperEffectLoaded = true;
          applyWallpaperEffectPrefs(NEWTAB_WALLPAPER_EFFECT_DEFAULTS);
          if (hasStoredWallpaperStateLoaded) {
            writeWallpaperPreloadCache();
          }
        });
        return initialWallpaperEffectReadyPromise;
      }
      initialWallpaperEffectReadyPromise = new Promise((resolve) => {
        storageArea.get([NEWTAB_WALLPAPER_EFFECT_STORAGE_KEY], (result) => {
          const raw = result ? result[NEWTAB_WALLPAPER_EFFECT_STORAGE_KEY] : null;
          const prefs = normalizeWallpaperEffectStoragePrefs(raw);
          hasStoredWallpaperEffectLoaded = true;
          applyWallpaperEffectPrefs(prefs);
          if (hasStoredWallpaperStateLoaded) {
            writeWallpaperPreloadCache();
          }
          const storedPrefs = getWallpaperEffectStorageValue();
          if (raw && JSON.stringify(raw) !== JSON.stringify(storedPrefs)) {
            storageArea.set({ [NEWTAB_WALLPAPER_EFFECT_STORAGE_KEY]: storedPrefs });
          }
          resolve();
        });
      });
      return initialWallpaperEffectReadyPromise;
    }

    function waitForInitialWallpaperEffectVisual() {
      const effectPreferencesReady = initialWallpaperEffectReadyPromise ||
        bootstrapInitialWallpaperEffect();
      return Promise.all([
        initialWallpaperReadyPromise,
        effectPreferencesReady
      ]).then(() => {
        if (!wallpaperEffects ||
            !currentWallpaperId ||
            currentAppliedWallpaperEffectPrefs.type === 'none') {
          return;
        }
        return wallpaperEffects.refresh({ immediate: true });
      });
    }

    function finalizeInitialWallpaper() {
      if (initialWallpaperApplied) {
        return;
      }
      initialWallpaperApplied = true;
      if (typeof resolveInitialWallpaperReady === 'function') {
        resolveInitialWallpaperReady();
      }
    }

    function updateWallpaperSelectionUi() {
      const wallpaperEnabled = hasAnyWallpaperEnabled();
      const selectedWallpaperId = getWallpaperSelectionIdForUi();
      if (wallpaperButton) {
        const isActive = Boolean(currentWallpaperId);
        wallpaperButton.setAttribute('data-active', isActive ? 'true' : 'false');
        wallpaperButton.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      }
      if (wallpaperEnabledToggle) {
        wallpaperEnabledToggle.checked = wallpaperEnabled;
        wallpaperEnabledToggle.setAttribute('aria-checked', wallpaperEnabled ? 'true' : 'false');
        wallpaperEnabledToggle.setAttribute('aria-label', t('newtab_wallpaper_toggle_label', 'Toggle wallpaper'));
      }
      setWallpaperBodyVisible(wallpaperEnabled && wallpaperSectionExpanded);
      updateWallpaperAccordionUi(wallpaperEnabled);
      const tileContainers = getWallpaperTileContainers();
      if (tileContainers.length === 0) {
        return;
      }
      const selectedTileId = getWallpaperTileSelectionId(selectedWallpaperId);
      tileContainers.forEach((container) => {
        container.querySelectorAll('.x-nt-wallpaper-tile').forEach((tile) => {
          const selected = tile.getAttribute('data-wallpaper-id') === selectedTileId;
          tile.setAttribute('data-selected', selected ? 'true' : 'false');
          tile.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });
      });
      updateBingUi();
      updateCuratedUi();
    }

    function updateTopContentModeUi() {
      if (hasTopContentModeGetter) {
        currentTopContentMode = normalizeNewtabTopContentMode(getTopContentMode());
      }
      [topContentBrandTab, topContentTimeTab, topContentOffTab].forEach((button) => {
        if (!button) {
          return;
        }
        const active = button.getAttribute('data-newtab-top-content') === currentTopContentMode;
        button.setAttribute('data-active', active ? 'true' : 'false');
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      updateTimeFontWeightUi();
      updateTimeSecondsVisibleUi();
      scheduleTopContentTabsIndicatorRefresh();
    }

    function updateTimeFontWeightUi() {
      if (hasTimeFontWeightGetter) {
        currentTimeFontWeight = normalizeNewtabTimeFontWeight(getTimeFontWeight());
      }
      const visible = currentTopContentMode === 'time';
      if (topContentWeightControl) {
        topContentWeightControl.hidden = !visible;
        topContentWeightControl.setAttribute('data-visible', visible ? 'true' : 'false');
        topContentWeightControl.setAttribute('aria-hidden', visible ? 'false' : 'true');
      }
      if (topContentWeightSlider) {
        const percent = (currentTimeFontWeight - NEWTAB_TIME_FONT_WEIGHT_MIN) /
          (NEWTAB_TIME_FONT_WEIGHT_MAX - NEWTAB_TIME_FONT_WEIGHT_MIN) * 100;
        topContentWeightSlider.min = String(NEWTAB_TIME_FONT_WEIGHT_MIN);
        topContentWeightSlider.max = String(NEWTAB_TIME_FONT_WEIGHT_MAX);
        topContentWeightSlider.step = '1';
        topContentWeightSlider.value = String(currentTimeFontWeight);
        topContentWeightSlider.style.setProperty(
          '--x-range-slider-percent',
          `${Math.max(0, Math.min(100, percent))}%`
        );
        topContentWeightSlider.setAttribute('aria-valuenow', String(currentTimeFontWeight));
        topContentWeightSlider.setAttribute('aria-valuetext', String(currentTimeFontWeight));
        syncWallpaperSliderValueInput(topContentWeightSlider);
      }
    }

    function updateTimeSecondsVisibleUi() {
      if (hasTimeSecondsVisibleGetter) {
        currentTimeSecondsVisible = normalizeNewtabTimeSecondsVisible(getTimeSecondsVisible());
      }
      const visible = currentTopContentMode === 'time';
      if (topContentSecondsRow) {
        topContentSecondsRow.hidden = !visible;
        topContentSecondsRow.setAttribute('data-visible', visible ? 'true' : 'false');
        topContentSecondsRow.setAttribute('aria-hidden', visible ? 'false' : 'true');
      }
      if (topContentSecondsToggle) {
        topContentSecondsToggle.checked = currentTimeSecondsVisible;
        topContentSecondsToggle.setAttribute(
          'aria-checked',
          currentTimeSecondsVisible ? 'true' : 'false'
        );
      }
    }

    function applyTopContentMode(value) {
      currentTopContentMode = normalizeNewtabTopContentMode(value);
      setTopContentMode(currentTopContentMode);
      updateTopContentModeUi();
    }

    function persistTopContentMode(value) {
      const nextValue = normalizeNewtabTopContentMode(value);
      applyTopContentMode(nextValue);
      if (!storageArea || !NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY) {
        return;
      }
      storageArea.set({ [NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY]: nextValue });
    }

    function applyTimeFontWeight(value) {
      currentTimeFontWeight = normalizeNewtabTimeFontWeight(value);
      setTimeFontWeight(currentTimeFontWeight);
      updateTimeFontWeightUi();
    }

    function persistTimeFontWeight(value) {
      const nextValue = normalizeNewtabTimeFontWeight(value);
      applyTimeFontWeight(nextValue);
      if (!storageArea || !NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY) {
        return;
      }
      storageArea.set({ [NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY]: nextValue });
    }

    function applyTimeSecondsVisible(value) {
      currentTimeSecondsVisible = normalizeNewtabTimeSecondsVisible(value);
      setTimeSecondsVisible(currentTimeSecondsVisible);
      updateTimeSecondsVisibleUi();
    }

    function persistTimeSecondsVisible(value) {
      const nextValue = normalizeNewtabTimeSecondsVisible(value);
      applyTimeSecondsVisible(nextValue);
      if (!storageArea || !NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY) {
        return;
      }
      storageArea.set({ [NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY]: nextValue });
    }

    function getNewtabFaviconOptionButtons() {
      if (!newtabFaviconOptions) {
        return [];
      }
      return Array.from(newtabFaviconOptions.children || []).filter((child) => {
        return child && String(child.className || '').split(/\s+/).includes('x-nt-favicon-option');
      });
    }

    function getNewtabFaviconLink() {
      const head = document.head || document.getElementsByTagName && document.getElementsByTagName('head')[0];
      if (!head) {
        return null;
      }
      const children = Array.from(head.children || []);
      let link = children.find((child) => child &&
        String(child.tagName || '').toUpperCase() === 'LINK' &&
        child.getAttribute &&
        child.getAttribute('data-lumno-newtab-favicon') === 'true');
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('data-lumno-newtab-favicon', 'true');
        head.appendChild(link);
      }
      return link;
    }

    function updateNewtabFaviconSelectionUi() {
      const currentItem = getNewtabFaviconById(currentNewtabFaviconId) ||
        getNewtabFaviconById(NEWTAB_FAVICON_DEFAULT_ID);
      if (newtabFaviconTitle) {
        newtabFaviconTitle.textContent = t('newtab_favicon_title', 'New Tab favicon');
      }
      if (newtabFaviconOptions) {
        newtabFaviconOptions.setAttribute('aria-label', t('newtab_favicon_title', 'New Tab favicon'));
      }
      getNewtabFaviconOptionButtons().forEach((button) => {
        const item = getNewtabFaviconById(button.getAttribute('data-newtab-favicon-id'));
        if (!item) {
          return;
        }
        const selected = currentItem && item.id === currentItem.id;
        const name = getNewtabFaviconDisplayName(item);
        button.setAttribute('data-selected', selected ? 'true' : 'false');
        button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        button.setAttribute('aria-label', formatMessage('newtab_favicon_select_label', 'Select {name} favicon', {
          name
        }));
      });
    }

    function applyNewtabFavicon(value) {
      const nextId = normalizeNewtabFaviconId(value);
      const item = getNewtabFaviconById(nextId) || getNewtabFaviconById(NEWTAB_FAVICON_DEFAULT_ID);
      currentNewtabFaviconId = item ? item.id : NEWTAB_FAVICON_DEFAULT_ID;
      cacheNewtabFaviconPreloadId(currentNewtabFaviconId);
      bindNewtabFaviconThemeListener(item);
      const link = getNewtabFaviconLink();
      if (link && item) {
        applyNewtabFaviconLinkAttributes(link, item);
      }
      updateNewtabFaviconSelectionUi();
    }

    function persistNewtabFavicon(value) {
      const nextId = normalizeNewtabFaviconId(value);
      applyNewtabFavicon(nextId);
      writeStorageValue(storageArea, NEWTAB_FAVICON_STORAGE_KEY, nextId, () => {
        showToast(t('newtab_favicon_save_error', 'Failed to save favicon'), true);
      });
    }

    function bootstrapInitialNewtabFavicon() {
      if (hasNewtabFaviconBootstrapStarted) {
        return initialNewtabFaviconReadyPromise || Promise.resolve();
      }
      hasNewtabFaviconBootstrapStarted = true;
      initialNewtabFaviconReadyPromise = readStorageValue(storageArea, NEWTAB_FAVICON_STORAGE_KEY).then((storedValue) => {
        const nextId = normalizeNewtabFaviconId(storedValue.value);
        applyNewtabFavicon(nextId);
        if (storedValue.hasValue && storedValue.value !== nextId) {
          writeStorageValue(storageArea, NEWTAB_FAVICON_STORAGE_KEY, nextId);
        }
      });
      return initialNewtabFaviconReadyPromise;
    }

    function getWallpaperAppearanceOptionButtons() {
      if (!wallpaperAppearanceOptions) {
        return [];
      }
      return Array.from(wallpaperAppearanceOptions.querySelectorAll('.x-nt-appearance-option'));
    }

    function getWallpaperAppearanceOptionMotionElement(button) {
      if (!button || typeof button.querySelector !== 'function') {
        return button;
      }
      return button.querySelector('.x-nt-appearance-option-content') || button;
    }

    function updateWallpaperAppearanceScopeTabsUi(scope) {
      if (wallpaperAppearanceScopeTabs) {
        const activeScope = scope === 'home' ? 'home' : 'global';
        wallpaperAppearanceScopeTabs.querySelectorAll('.x-nt-appearance-scope-tab').forEach((button) => {
          const active = button.getAttribute('data-theme-scope') === activeScope;
          button.setAttribute('data-active', active ? 'true' : 'false');
          button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        scheduleAppearanceScopeTabsIndicatorRefresh();
      }
      updateWallpaperSearchWidthControlUi();
    }

    function getSearchWidthMin() {
      return Number.isFinite(Number(searchWidthConfig.min)) ? Number(searchWidthConfig.min) : 720;
    }

    function getSearchWidthMax() {
      const min = getSearchWidthMin();
      const max = Number.isFinite(Number(searchWidthConfig.max)) ? Number(searchWidthConfig.max) : 1040;
      return Math.max(min + 1, max);
    }

    function normalizeSearchWidthValue(value) {
      const min = getSearchWidthMin();
      const max = getSearchWidthMax();
      const fallback = Number.isFinite(Number(searchWidthConfig.fallback))
        ? Number(searchWidthConfig.fallback)
        : 920;
      const number = Number(value);
      if (!Number.isFinite(number)) {
        return Math.min(max, Math.max(min, Math.round(fallback)));
      }
      return Math.min(max, Math.max(min, Math.round(number)));
    }

    function getSearchWidthSnapPoints() {
      const points = Array.isArray(searchWidthConfig.snapPoints)
        ? searchWidthConfig.snapPoints
        : [720, 920, 1040];
      return points.map(normalizeSearchWidthValue)
        .filter((value, index, array) => array.indexOf(value) === index)
        .sort((a, b) => a - b);
    }

    function getSearchWidthPercent(value) {
      const min = getSearchWidthMin();
      const max = getSearchWidthMax();
      return ((normalizeSearchWidthValue(value) - min) / (max - min)) * 100;
    }

    function snapSearchWidthValue(value, threshold) {
      const width = normalizeSearchWidthValue(value);
      const snapThreshold = Number.isFinite(Number(threshold))
        ? Number(threshold)
        : Number(searchWidthConfig.snapThreshold || 14);
      const matched = getSearchWidthSnapPoints().find((point) => Math.abs(point - width) <= snapThreshold);
      return Number.isFinite(matched) ? matched : width;
    }

    function formatSearchWidthValue(value) {
      return `${normalizeSearchWidthValue(value)} px`;
    }

    function updateSearchWidthSliderElement(width) {
      if (!wallpaperSearchWidthSlider) {
        return;
      }
      const value = normalizeSearchWidthValue(width);
      wallpaperSearchWidthSlider.min = String(getSearchWidthMin());
      wallpaperSearchWidthSlider.max = String(getSearchWidthMax());
      wallpaperSearchWidthSlider.value = String(value);
      wallpaperSearchWidthSlider.style.setProperty('--x-range-slider-percent', `${getSearchWidthPercent(value)}%`);
      wallpaperSearchWidthSlider.setAttribute('aria-valuenow', String(value));
      wallpaperSearchWidthSlider.setAttribute('aria-valuetext', formatSearchWidthValue(value));
      syncWallpaperSliderValueInput(wallpaperSearchWidthSlider);
    }

    function setSearchWidthControlVisible(visible) {
      if (!wallpaperSearchWidthControl) {
        return;
      }
      const nextVisible = visible ? 'true' : 'false';
      if (wallpaperSearchWidthControl.getAttribute('data-visible') === nextVisible) {
        wallpaperSearchWidthControl.setAttribute('aria-hidden', visible ? 'false' : 'true');
        return;
      }
      animateWallpaperPanelResize(() => {
        wallpaperSearchWidthControl.setAttribute('data-visible', nextVisible);
        wallpaperSearchWidthControl.setAttribute('aria-hidden', visible ? 'false' : 'true');
        if (visible) {
          playWallpaperEnterMotion(wallpaperSearchWidthControl, 'enter');
        }
      });
    }

    function updateWallpaperSearchWidthControlUi() {
      if (!wallpaperSearchWidthControl) {
        return;
      }
      if (wallpaperSearchWidthLabel) {
        wallpaperSearchWidthLabel.textContent = t('newtab_search_width_title', 'Search box width');
      }
      if (wallpaperSearchWidthSlider) {
        wallpaperSearchWidthSlider.setAttribute(
          'aria-label',
          t('newtab_search_width_aria', 'Adjust New Tab search box width')
        );
      }
      if (wallpaperSearchWidthControl) {
        wallpaperSearchWidthControl.querySelectorAll('[data-search-width-tick]').forEach((tick) => {
          const key = tick.getAttribute('data-search-width-tick');
          if (key === 'standard') {
            tick.textContent = t('newtab_search_width_standard', 'Standard');
          } else if (key === 'wide') {
            tick.textContent = t('newtab_search_width_wide', 'Wide');
          } else if (key === 'max') {
            tick.textContent = t('newtab_search_width_max', 'Max');
          }
        });
      }
      updateSearchWidthSliderElement(getSearchWidth());
      setSearchWidthControlVisible(true);
    }

    function persistSearchWidthFromSlider(value, options) {
      const final = Boolean(options && options.final);
      const threshold = final
        ? Number(searchWidthConfig.snapThreshold || 14) * 1.35
        : Number(searchWidthConfig.snapThreshold || 14);
      const width = snapSearchWidthValue(value, threshold);
      if (wallpaperSearchWidthSlider && wallpaperSearchWidthSlider.value !== String(width)) {
        wallpaperSearchWidthSlider.value = String(width);
      }
      setSearchWidth(width, { persist: false });
      updateSearchWidthSliderElement(width);
      if (wallpaperSearchWidthSaveTimer !== null) {
        window.clearTimeout(wallpaperSearchWidthSaveTimer);
        wallpaperSearchWidthSaveTimer = null;
      }
      const persist = () => {
        wallpaperSearchWidthSaveTimer = null;
        setSearchWidth(width, { persist: true });
      };
      if (final) {
        persist();
        return;
      }
      wallpaperSearchWidthSaveTimer = window.setTimeout(persist, 140);
    }

    function getShortcutColumnsMin() {
      return Number.isFinite(Number(shortcutColumnsConfig.min))
        ? Number(shortcutColumnsConfig.min)
        : 4;
    }

    function getShortcutColumnsMax() {
      const min = getShortcutColumnsMin();
      const max = Number.isFinite(Number(shortcutColumnsConfig.max))
        ? Number(shortcutColumnsConfig.max)
        : 16;
      return Math.max(min, max);
    }

    function normalizeShortcutColumnsValue(value) {
      const min = getShortcutColumnsMin();
      const max = getShortcutColumnsMax();
      const fallback = Number.isFinite(Number(shortcutColumnsConfig.fallback))
        ? Number(shortcutColumnsConfig.fallback)
        : 10;
      const number = Number(value);
      if (!Number.isFinite(number)) {
        return Math.min(max, Math.max(min, Math.round(fallback)));
      }
      return Math.min(max, Math.max(min, Math.round(number)));
    }

    function getShortcutColumnsTickValues() {
      return [4, 8, 12, 16].map(normalizeShortcutColumnsValue)
        .filter((value, index, array) => array.indexOf(value) === index)
        .sort((a, b) => a - b);
    }

    function getShortcutColumnsPercent(value) {
      const min = getShortcutColumnsMin();
      const max = getShortcutColumnsMax();
      if (max <= min) {
        return 0;
      }
      return ((normalizeShortcutColumnsValue(value) - min) / (max - min)) * 100;
    }

    function updateShortcutColumnsSliderElements(columns) {
      const value = normalizeShortcutColumnsValue(columns);
      if (wallpaperShortcutColumnsSlider) {
        wallpaperShortcutColumnsSlider.min = String(getShortcutColumnsMin());
        wallpaperShortcutColumnsSlider.max = String(getShortcutColumnsMax());
        wallpaperShortcutColumnsSlider.step = '1';
        wallpaperShortcutColumnsSlider.value = String(value);
        wallpaperShortcutColumnsSlider.style.setProperty(
          '--x-range-slider-percent',
          `${getShortcutColumnsPercent(value)}%`
        );
        wallpaperShortcutColumnsSlider.setAttribute('aria-valuenow', String(value));
        wallpaperShortcutColumnsSlider.setAttribute('aria-valuetext', String(value));
        syncWallpaperSliderValueInput(wallpaperShortcutColumnsSlider);
      }
    }

    function persistShortcutColumnsFromSlider(value, options) {
      const config = options || {};
      const final = Boolean(config.final);
      const columns = normalizeShortcutColumnsValue(value);
      setShortcutColumns(columns, { persist: false });
      updateShortcutColumnsSliderElements(columns);
      if (wallpaperShortcutColumnsSaveTimer !== null) {
        window.clearTimeout(wallpaperShortcutColumnsSaveTimer);
        wallpaperShortcutColumnsSaveTimer = null;
      }
      const persist = () => {
        wallpaperShortcutColumnsSaveTimer = null;
        setShortcutColumns(columns, { persist: true });
      };
      if (final) {
        persist();
        return;
      }
      wallpaperShortcutColumnsSaveTimer = window.setTimeout(persist, 140);
    }

    function getShortcutLayoutMin(config, fallback) {
      return Number.isFinite(Number(config && config.min))
        ? Number(config.min)
        : fallback;
    }

    function getShortcutLayoutMax(config, fallbackMin, fallbackMax) {
      const min = getShortcutLayoutMin(config, fallbackMin);
      const max = Number.isFinite(Number(config && config.max))
        ? Number(config.max)
        : fallbackMax;
      return Math.max(min, max);
    }

    function getShortcutLayoutDefault(config, fallbackMin, fallbackMax, fallbackValue) {
      const min = getShortcutLayoutMin(config, fallbackMin);
      const max = getShortcutLayoutMax(config, fallbackMin, fallbackMax);
      const value = Number.isFinite(Number(config && config.fallback))
        ? Number(config.fallback)
        : fallbackValue;
      return Math.min(max, Math.max(min, Math.round(value)));
    }

    function normalizeShortcutLayoutValue(
      value,
      config,
      fallbackMin,
      fallbackMax,
      fallbackValue
    ) {
      const min = getShortcutLayoutMin(config, fallbackMin);
      const max = getShortcutLayoutMax(config, fallbackMin, fallbackMax);
      const fallback = getShortcutLayoutDefault(
        config,
        fallbackMin,
        fallbackMax,
        fallbackValue
      );
      const number = Number(value);
      return Math.min(
        max,
        Math.max(min, Number.isFinite(number) ? Math.round(number) : fallback)
      );
    }

    function getShortcutLayoutPercent(
      value,
      config,
      fallbackMin,
      fallbackMax,
      fallbackValue
    ) {
      const min = getShortcutLayoutMin(config, fallbackMin);
      const max = getShortcutLayoutMax(config, fallbackMin, fallbackMax);
      if (max <= min) {
        return 0;
      }
      const normalized = normalizeShortcutLayoutValue(
        value,
        config,
        fallbackMin,
        fallbackMax,
        fallbackValue
      );
      return ((normalized - min) / (max - min)) * 100;
    }

    function updateShortcutLayoutSliderElements(slider, resetButton, value, config) {
      if (!slider) {
        return;
      }
      const normalized = normalizeShortcutLayoutValue(
        value,
        config.source,
        config.min,
        config.max,
        config.fallback
      );
      const defaultValue = getShortcutLayoutDefault(
        config.source,
        config.min,
        config.max,
        config.fallback
      );
      slider.min = String(getShortcutLayoutMin(config.source, config.min));
      slider.max = String(getShortcutLayoutMax(config.source, config.min, config.max));
      slider.step = '1';
      slider.value = String(normalized);
      slider.style.setProperty(
        '--x-range-slider-percent',
        `${getShortcutLayoutPercent(
          normalized,
          config.source,
          config.min,
          config.max,
          config.fallback
        )}%`
      );
      slider.setAttribute('aria-valuenow', String(normalized));
      slider.setAttribute('aria-valuetext', `${normalized} px`);
      syncWallpaperSliderValueInput(slider);
      if (resetButton) {
        resetButton.disabled = Boolean(slider.disabled || normalized === defaultValue);
      }
    }

    function normalizeShortcutSizeValue(value) {
      return normalizeShortcutLayoutValue(value, shortcutSizeConfig, 48, 80, 64);
    }

    function normalizeShortcutGapValue(value) {
      return normalizeShortcutLayoutValue(value, shortcutGapConfig, 0, 24, 4);
    }

    function updateShortcutSizeSliderElements(value) {
      updateShortcutLayoutSliderElements(
        wallpaperShortcutSizeSlider,
        wallpaperShortcutSizeResetButton,
        value,
        { source: shortcutSizeConfig, min: 48, max: 80, fallback: 64 }
      );
    }

    function updateShortcutGapSliderElements(value) {
      updateShortcutLayoutSliderElements(
        wallpaperShortcutGapSlider,
        wallpaperShortcutGapResetButton,
        value,
        { source: shortcutGapConfig, min: 0, max: 24, fallback: 4 }
      );
    }

    function persistShortcutSizeFromSlider(value, options) {
      const final = Boolean(options && options.final);
      const size = normalizeShortcutSizeValue(value);
      setShortcutSize(size, { persist: false });
      updateShortcutSizeSliderElements(size);
      if (wallpaperShortcutSizeSaveTimer !== null) {
        window.clearTimeout(wallpaperShortcutSizeSaveTimer);
        wallpaperShortcutSizeSaveTimer = null;
      }
      const persist = () => {
        wallpaperShortcutSizeSaveTimer = null;
        setShortcutSize(size, { persist: true });
      };
      if (final) {
        persist();
        return;
      }
      wallpaperShortcutSizeSaveTimer = window.setTimeout(persist, 140);
    }

    function persistShortcutGapFromSlider(value, options) {
      const final = Boolean(options && options.final);
      const gap = normalizeShortcutGapValue(value);
      setShortcutGap(gap, { persist: false });
      updateShortcutGapSliderElements(gap);
      if (wallpaperShortcutGapSaveTimer !== null) {
        window.clearTimeout(wallpaperShortcutGapSaveTimer);
        wallpaperShortcutGapSaveTimer = null;
      }
      const persist = () => {
        wallpaperShortcutGapSaveTimer = null;
        setShortcutGap(gap, { persist: true });
      };
      if (final) {
        persist();
        return;
      }
      wallpaperShortcutGapSaveTimer = window.setTimeout(persist, 140);
    }

    function applyWallpaperShortcutsAccordionUi() {
      const enabled = Boolean(getShortcutsVisible());
      const expanded = Boolean(wallpaperShortcutsAccordionExpanded && enabled);
      wallpaperShortcutsAccordionExpanded = expanded;
      if (wallpaperShortcutsAccordion) {
        wallpaperShortcutsAccordion.setAttribute('data-expanded', expanded ? 'true' : 'false');
        wallpaperShortcutsAccordion.setAttribute('data-enabled', enabled ? 'true' : 'false');
      }
      if (wallpaperShortcutsAccordionTrigger) {
        wallpaperShortcutsAccordionTrigger.disabled = !enabled;
        wallpaperShortcutsAccordionTrigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        wallpaperShortcutsAccordionTrigger.setAttribute('aria-disabled', enabled ? 'false' : 'true');
      }
      if (wallpaperShortcutsDetails) {
        wallpaperShortcutsDetails.hidden = !expanded;
        wallpaperShortcutsDetails.setAttribute('data-visible', expanded ? 'true' : 'false');
        wallpaperShortcutsDetails.setAttribute('aria-hidden', expanded ? 'false' : 'true');
      }
      [
        wallpaperShortcutColumnsControl,
        wallpaperShortcutSizeControl,
        wallpaperShortcutGapControl
      ].forEach((control) => {
        if (control) {
          control.setAttribute('data-visible', expanded ? 'true' : 'false');
          control.setAttribute('aria-hidden', expanded ? 'false' : 'true');
        }
      });
      [wallpaperShortcutAddToggle, wallpaperShortcutDockMagnificationToggle].forEach((toggle) => {
        if (!toggle) {
          return;
        }
        toggle.disabled = !enabled || !expanded;
        toggle.setAttribute('aria-checked', toggle.checked ? 'true' : 'false');
      });
      [
        wallpaperShortcutColumnsSlider,
        getWallpaperSliderValueInput(wallpaperShortcutColumnsSlider),
        wallpaperShortcutSizeSlider,
        getWallpaperSliderValueInput(wallpaperShortcutSizeSlider),
        wallpaperShortcutGapSlider,
        getWallpaperSliderValueInput(wallpaperShortcutGapSlider)
      ].forEach((input) => {
        if (input) {
          input.disabled = !enabled || !expanded;
        }
      });
      updateShortcutSizeSliderElements(getShortcutSize());
      updateShortcutGapSliderElements(getShortcutGap());
    }

    function setWallpaperShortcutsAccordionExpanded(expanded) {
      const nextExpanded = Boolean(expanded && getShortcutsVisible());
      wallpaperShortcutsAccordionExpanded = nextExpanded;
      // The details region animates itself through .x-nt-panel-collapsible.
      applyWallpaperShortcutsAccordionUi();
    }

    function updateWallpaperShortcutsUi() {
      const enabled = Boolean(getShortcutsVisible());
      if (!enabled) {
        wallpaperShortcutsAccordionExpanded = false;
      }
      if (wallpaperShortcutsTitle) {
        wallpaperShortcutsTitle.textContent = t('settings_newtab_shortcuts_title', 'Shortcuts');
      }
      if (wallpaperShortcutsToggle) {
        wallpaperShortcutsToggle.checked = enabled;
        wallpaperShortcutsToggle.setAttribute('aria-label', t(
          'settings_newtab_shortcuts_title',
          'Shortcuts'
        ));
        wallpaperShortcutsToggle.setAttribute('aria-checked', enabled ? 'true' : 'false');
      }
      if (wallpaperShortcutsAccordionTrigger) {
        wallpaperShortcutsAccordionTrigger.setAttribute('aria-label', t(
          'settings_newtab_shortcuts_title',
          'Shortcuts'
        ));
      }
      if (wallpaperShortcutAddTitle) {
        wallpaperShortcutAddTitle.textContent = t(
          'settings_newtab_shortcut_add_title',
          'Show “+”'
        );
      }
      if (wallpaperShortcutAddToggle) {
        wallpaperShortcutAddToggle.checked = Boolean(getShortcutAddVisible());
        wallpaperShortcutAddToggle.setAttribute('aria-label', t(
          'settings_newtab_shortcut_add_title',
          'Show “+”'
        ));
      }
      if (wallpaperShortcutDockMagnificationTitle) {
        wallpaperShortcutDockMagnificationTitle.textContent = t(
          'settings_newtab_shortcut_dock_magnification_title',
          'macOS Dock-style magnification'
        );
      }
      if (wallpaperShortcutDockMagnificationToggle) {
        wallpaperShortcutDockMagnificationToggle.checked = Boolean(
          getShortcutDockMagnificationEnabled()
        );
        wallpaperShortcutDockMagnificationToggle.setAttribute('aria-label', t(
          'settings_newtab_shortcut_dock_magnification_title',
          'macOS Dock-style magnification'
        ));
      }
      if (wallpaperShortcutColumnsLabel || wallpaperShortcutColumnsSlider) {
        const label = t('settings_newtab_shortcut_columns_title', 'Shortcuts per row');
        if (wallpaperShortcutColumnsLabel) {
          wallpaperShortcutColumnsLabel.textContent = label;
        }
        if (wallpaperShortcutColumnsSlider) {
          wallpaperShortcutColumnsSlider.setAttribute('aria-label', label);
        }
      }
      if (wallpaperShortcutSizeLabel || wallpaperShortcutSizeSlider) {
        const label = t('settings_newtab_shortcut_size_title', 'Shortcut size');
        const resetLabel = t(
          'settings_newtab_shortcut_size_reset',
          'Reset shortcut size'
        );
        if (wallpaperShortcutSizeLabel) {
          wallpaperShortcutSizeLabel.textContent = label;
        }
        if (wallpaperShortcutSizeSlider) {
          wallpaperShortcutSizeSlider.setAttribute('aria-label', label);
        }
        if (wallpaperShortcutSizeResetButton) {
          wallpaperShortcutSizeResetButton.setAttribute('aria-label', resetLabel);
          wallpaperShortcutSizeResetButton.setAttribute('title', resetLabel);
        }
      }
      if (wallpaperShortcutGapLabel || wallpaperShortcutGapSlider) {
        const label = t('settings_newtab_shortcut_gap_title', 'Shortcut spacing');
        const resetLabel = t(
          'settings_newtab_shortcut_gap_reset',
          'Reset shortcut spacing'
        );
        if (wallpaperShortcutGapLabel) {
          wallpaperShortcutGapLabel.textContent = label;
        }
        if (wallpaperShortcutGapSlider) {
          wallpaperShortcutGapSlider.setAttribute('aria-label', label);
        }
        if (wallpaperShortcutGapResetButton) {
          wallpaperShortcutGapResetButton.setAttribute('aria-label', resetLabel);
          wallpaperShortcutGapResetButton.setAttribute('title', resetLabel);
        }
      }
      updateShortcutColumnsSliderElements(getShortcutColumns());
      updateShortcutSizeSliderElements(getShortcutSize());
      updateShortcutGapSliderElements(getShortcutGap());
      applyWallpaperShortcutsAccordionUi();
    }

    function updateWallpaperAppearanceSelectionUi() {
      updateWallpaperAppearanceScopeTabsUi(getThemeScope());
      if (wallpaperAppearanceOptions) {
        getWallpaperAppearanceOptionButtons().forEach((button) => {
          const selected = button.getAttribute('data-theme-mode') === getThemeMode();
          button.setAttribute('data-selected', selected ? 'true' : 'false');
          button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });
      }
      updateWallpaperSearchWidthControlUi();
      updateWallpaperShortcutsUi();
    }

    function updateCustomWallpaperUploadTile() {
      if (!customWallpaperUploadTile) {
        return;
      }
      const loading = customWallpaperImporting ? 'true' : 'false';
      customWallpaperUploadTile.setAttribute('data-loading', loading);
      customWallpaperUploadTile.setAttribute('aria-busy', loading);
      customWallpaperUploadTile.setAttribute('aria-disabled', loading);
      customWallpaperUploadTile.setAttribute('aria-label', t('newtab_wallpaper_add_local', 'Add local wallpaper'));
      if (customWallpaperImporting) {
        hideCustomWallpaperTooltip();
      }
      updateCustomWallpaperUrlControls();
    }

    function primeWallpaperTileImage(tile) {
      const wallpaperId = tile && tile.getAttribute
        ? tile.getAttribute('data-wallpaper-id')
        : '';
      const wallpaper = getWallpaperById(wallpaperId);
      return waitForWallpaperImageReady(wallpaper ? getWallpaperImageUrl(wallpaper) : '');
    }

    function bindWallpaperTileImagePreload(tile) {
      if (!tile) {
        return;
      }
      const prime = () => {
        primeWallpaperTileImage(tile);
      };
      tile.addEventListener('pointerenter', prime, { passive: true });
      tile.addEventListener('focus', prime, { passive: true });
      tile.addEventListener('pointerdown', prime, { passive: true });
    }

    function bindWallpaperTileActivation(tile, onActivate, shouldIgnoreEvent) {
      bindWallpaperTileImagePreload(tile);
      const activate = (event) => {
        if (typeof shouldIgnoreEvent === 'function' && shouldIgnoreEvent(event)) {
          return;
        }
        onActivate(event);
      };
      tile.addEventListener('click', activate);
      tile.addEventListener('keydown', (event) => {
        if (!event || (event.key !== 'Enter' && event.key !== ' ')) {
          return;
        }
        if (typeof shouldIgnoreEvent === 'function' && shouldIgnoreEvent(event)) {
          return;
        }
        event.preventDefault();
        onActivate(event);
      });
    }

    function isWallpaperDeleteButtonEvent(event) {
      return Boolean(
        event &&
        event.target &&
        event.target.closest &&
        event.target.closest('.x-nt-wallpaper-delete-button')
      );
    }

    function renderCustomWallpaperTiles() {
      if (!wallpaperLocalGrid || !customWallpaperUploadTile) {
        return;
      }
      animateWallpaperPanelResize(() => {
        const items = customWallpapers.concat(linkWallpapers.map((item) => getLinkWallpaperById(item.id)))
          .sort((a, b) => a.updatedAt - b.updatedAt);
        const tiles = wallpaperViewController.renderCustomWallpapers(
          items.map((item) => ({
            id: item.id,
            thumbnailUrl: getWallpaperThumbnailUrl(item)
          }))
        );
        tiles.forEach((tile) => {
          const wallpaperId = tile.getAttribute('data-wallpaper-id');
          bindWallpaperTileActivation(
            tile,
            () => persistNewtabWallpaper(wallpaperId),
            isWallpaperDeleteButtonEvent
          );
          const deleteButton = tile.querySelector('.x-nt-wallpaper-delete-button');
          if (deleteButton) {
            deleteButton.addEventListener('click', (event) => {
              event.preventDefault();
              event.stopPropagation();
              deleteCustomWallpaper(wallpaperId);
            });
          }
        });
      });
      updateWallpaperLanguageStrings();
      updateWallpaperSelectionUi();
    }

    function loadCustomWallpapers() {
      if (customWallpaperCatalogLoaded) {
        return Promise.resolve(customWallpapers);
      }
      if (customWallpaperCatalogPromise) {
        return customWallpaperCatalogPromise;
      }
      const linkImagesTask = readCachedWallpaperImages(linkWallpapers.map((item) => item.id));
      customWallpaperCatalogPromise = readCustomWallpaperRecords().then((records) => {
        const showRecords = () => {
          customWallpapers = records;
          customWallpaperCatalogLoaded = true;
          updateCustomWallpaperUploadTile();
          renderCustomWallpaperTiles();
          return records;
        };
        // Wait for cached link images so the tiles do not load full images from the links first.
        return linkWallpapers.length ? linkImagesTask.then(showRecords) : showRecords();
      }).catch(() => {
        updateCustomWallpaperUploadTile();
        renderCustomWallpaperTiles();
        return customWallpapers;
      }).finally(() => {
        customWallpaperCatalogPromise = null;
        cacheListedLinkWallpapers();
      });
      return customWallpaperCatalogPromise;
    }

    function refreshCustomWallpapers() {
      customWallpaperCatalogLoaded = false;
      return loadCustomWallpapers();
    }

    function mergeCustomWallpaperRecords(records) {
      const recordsById = new Map();
      customWallpapers.forEach((record) => {
        if (record && record.id) {
          recordsById.set(record.id, record);
        }
      });
      (Array.isArray(records) ? records : []).forEach((record) => {
        const normalized = normalizeCustomWallpaperRecord(record);
        if (normalized) {
          recordsById.set(normalized.id, normalized);
        }
      });
      customWallpapers = Array.from(recordsById.values()).sort((a, b) => a.updatedAt - b.updatedAt);
      return customWallpapers;
    }

    function rememberActiveWallpaperId(mode, id) {
      const nextId = normalizeNewtabWallpaperId(id);
      if (!nextId) {
        return;
      }
      const normalizedMode = normalizeWallpaperMode(mode);
      lastActiveWallpaperId = nextId;
      lastActiveWallpaperIdsByMode[normalizedMode] = nextId;
      if (currentWallpaperPrefs && currentWallpaperPrefs.sameForModes) {
        NEWTAB_WALLPAPER_MODES.forEach((item) => {
          lastActiveWallpaperIdsByMode[item] = nextId;
        });
      }
    }

    function applyNewtabWallpaper(value, options) {
      const config = options || {};
      const mode = normalizeWallpaperMode(config.mode || getResolvedWallpaperMode());
      const nextId = normalizeNewtabWallpaperId(value);
      const wallpaper = getWallpaperById(nextId);
      const imageUrl = wallpaper ? getWallpaperImageUrl(wallpaper) : '';
      const isInitialWallpaperApply = !initialWallpaperApplied;
      const visualSeq = ++wallpaperVisualSeq;
      currentWallpaperId = wallpaper ? wallpaper.id : '';
      if (currentWallpaperId) {
        rememberActiveWallpaperId(mode, currentWallpaperId);
      }
      writeWallpaperPreloadCache();
      updateWallpaperSelectionUi();
      if (isInitialWallpaperApply) {
        applyWallpaperVisualState(wallpaper);
        refreshWallpaperAdaptiveSampler();
        scheduleWallpaperVisualRefresh(visualSeq);
        finalizeInitialWallpaper();
        if (appliedWallpaperVisualUrl !== imageUrl) {
          showWallpaperWhenReady(wallpaper, imageUrl, visualSeq);
        }
        return;
      }
      finalizeInitialWallpaper();
      showWallpaperWhenReady(wallpaper, imageUrl, visualSeq);
    }

    // Keeps the current wallpaper until the next one has loaded, or until its fallback is ready.
    function showWallpaperWhenReady(wallpaper, imageUrl, visualSeq) {
      waitForWallpaperImageReady(imageUrl).then(() => {
        return waitForWallpaperImageReady(wallpaper ? getDisplayedWallpaperImageUrl(wallpaper) : '');
      }).then(() => {
        if (visualSeq !== wallpaperVisualSeq) {
          return;
        }
        const displayedUrl = wallpaper ? getDisplayedWallpaperImageUrl(wallpaper) : '';
        const shouldAnimateVisualChange = displayedUrl !== appliedWallpaperVisualUrl ||
          Boolean(wallpaper) !== appliedWallpaperVisualActive;
        const transitionLayer = shouldAnimateVisualChange ? createWallpaperTransitionLayer() : null;
        applyWallpaperVisualState(wallpaper);
        releaseWallpaperTransitionLayer(transitionLayer);
        scheduleWallpaperVisualRefresh(visualSeq);
      });
    }

    function applyResolvedNewtabWallpaper(options) {
      const mode = getResolvedWallpaperMode();
      applyNewtabWallpaper(getEffectiveWallpaperIdForMode(mode), Object.assign({}, options || {}, { mode }));
      if (hasStoredWallpaperStateLoaded) cacheShownWallpaperImages();
    }

    function applyStoredWallpaperState(syncedValue, localValue) {
      const syncedResolution = resolveSyncedWallpaperValue(syncedValue.value, syncedValue.hasValue);
      const localResolution = resolveLocalWallpaperOverride(localValue.value, localValue.hasValue);
      const migrated = applyLocalWallpaperMigrations(
        localResolution.overrides,
        syncedResolution.localMigrations
      );
      setWallpaperPrefs(syncedResolution.prefs, migrated.overrides);
      hasStoredWallpaperStateLoaded = true;
      bindWallpaperPageShownListeners();
      activeWallpaperMode = currentWallpaperPrefs.sameForModes
        ? getResolvedWallpaperMode()
        : normalizeWallpaperMode(activeWallpaperMode);
      const didSyncWallpaperEffects = synchronizeWallpaperEffectPrefsWithWallpaperModes();
      applyWallpaperEffectForResolvedMode();
      applyResolvedNewtabWallpaper();
      syncWallpaperSourceTabToEditMode();
      updateWallpaperModeControlsUi({ animate: false });
      updateWallpaperSelectionUi();
      if (syncedResolution.sanitizedValue !== null) {
        writeSyncedWallpaperValue(syncedResolution.sanitizedValue);
      } else if (!syncedValue.fromOnlineKey && getWallpaperStorageRawIds(syncedValue.value).some(isOnlineWallpaperId)) {
        // Move online picks saved under the shared key before older versions can clear them.
        writeSyncedWallpaperValue(syncedValue.value);
      }
      if (localResolution.shouldClear || migrated.changed) {
        writeLocalWallpaperValue(buildLocalWallpaperStorageValue(
          currentLocalWallpaperOverrides,
          currentWallpaperPrefs.sameForModes
        ));
      }
      if (didSyncWallpaperEffects && storageArea) {
        storageArea.set({
          [NEWTAB_WALLPAPER_EFFECT_STORAGE_KEY]: getWallpaperEffectStorageValue()
        });
      }
    }

    function loadStoredWallpaperState(options) {
      const config = options || {};
      const changeSeq = wallpaperStorageChangeSeq;
      return Promise.all([
        readStorageValue(storageArea, NEWTAB_WALLPAPER_STORAGE_KEY),
        readStorageValue(localWallpaperStorageArea, NEWTAB_LOCAL_WALLPAPER_STORAGE_KEY),
        readStorageValue(storageArea, NEWTAB_ONLINE_WALLPAPER_STORAGE_KEY),
        readStorageValue(storageArea, NEWTAB_LINK_WALLPAPERS_STORAGE_KEY),
        readStorageValue(storageArea, NEWTAB_DAILY_WALLPAPER_PICKS_STORAGE_KEY)
      ]).then((stored) => {
        dailyWallpaperPicks = normalizeDailyWallpaperPicks(stored[4].value);
        const results = [mergeOnlineWallpaperValue(stored[0], stored[2]), stored[1]];
        const linksChanged = setLinkWallpapers(stored[3].value);
        const linkIds = getWallpaperStorageRawIds(results[0].value).filter(isLinkWallpaperId);
        const customWallpaperIds = getStoredCustomWallpaperIds(results)
          .filter((id) => !hasLoadedStoredCustomWallpaper(id));
        const customWallpaperPromise = customWallpaperIds.length > 0
          ? readCustomWallpaperRecordsByIds(customWallpaperIds).then((records) => {
            mergeCustomWallpaperRecords(records);
          }).catch(() => {})
          : Promise.resolve();
        const remoteIds = getWallpaperStorageRawIds(results[0].value)
          .map((id) => normalizeNewtabWallpaperId(id))
          .filter((id) => REMOTE_CONTENT.wallpaperFromId(id));
        // Picks are dated Bing photos or bundled ones; restore them like any chosen photo.
        const pickIds = remoteIds.map(getDailyWallpaperPick).filter(Boolean);
        // Read cached copies only once photos are restored: the daily Bing photo resolves from storage.
        const cachedImagesTask = Promise.all(remoteIds.concat(pickIds).map((id) => remoteClient.restoreWallpaper(id)))
          .then(() => readCachedWallpaperImages(linkIds.concat(remoteIds.map((id) => getWallpaperById(id))
            .filter((item) => item && item.cacheImage).map((item) => item.dailyId || item.id))));
        return Promise.all([customWallpaperPromise, cachedImagesTask]).then(() => {
          if (changeSeq !== wallpaperStorageChangeSeq ||
              typeof config.shouldApply === 'function' && !config.shouldApply()) {
            return false;
          }
          applyStoredWallpaperState(results[0], results[1]);
          cacheShownWallpaperImages();
          if (linksChanged && customWallpaperCatalogLoaded) {
            renderCustomWallpaperTiles();
            cacheListedLinkWallpapers();
          }
          remoteClient.setPinnedIds(remoteIds);
          if (remoteIds.includes(REMOTE_CONTENT.BING_DAILY_ID)) {
            remoteClient.ensureWallpaper(REMOTE_CONTENT.BING_DAILY_ID).then(() => {
              if (getEffectiveWallpaperIdForMode(getResolvedWallpaperMode()) === REMOTE_CONTENT.BING_DAILY_ID) {
                applyResolvedNewtabWallpaper();
              }
              renderBingTiles();
            }).catch(() => {});
          }
          return true;
        });
      });
    }

    function bootstrapInitialWallpaper() {
      if (hasWallpaperBootstrapStarted) {
        return initialWallpaperReadyPromise;
      }
      hasWallpaperBootstrapStarted = true;
      loadStoredWallpaperState();
      return initialWallpaperReadyPromise;
    }

    function normalizeWallpaperRestoreId(mode) {
      const normalizedMode = normalizeWallpaperMode(mode);
      return normalizeNewtabWallpaperId(lastActiveWallpaperIdsByMode[normalizedMode]) ||
        normalizeNewtabWallpaperId(lastActiveWallpaperId) ||
        NEWTAB_WALLPAPER_DEFAULT_ID;
    }

    function persistWallpaperEnabled(enabled) {
      bingSelectionSeq += 1;
      wallpaperStorageChangeSeq += 1;
      const prefs = getWritableWallpaperPrefs();
      const overrides = getWritableLocalWallpaperOverrides();
      if (enabled) {
        NEWTAB_WALLPAPER_MODES.forEach((mode) => {
          if (getEffectiveWallpaperIdForMode(mode)) {
            return;
          }
          overrides[mode] = null;
          prefs[mode] = normalizeWallpaperRestoreId(mode);
        });
        if (prefs.sameForModes) {
          const sharedId = prefs.light || prefs.dark || normalizeWallpaperRestoreId(getResolvedWallpaperMode());
          prefs.light = sharedId;
          prefs.dark = sharedId;
          overrides.dark = overrides.light;
        }
        setWallpaperPrefs(prefs, overrides);
        applyResolvedNewtabWallpaper();
        syncWallpaperSourceTabToEditMode();
        updateWallpaperModeControlsUi();
        updateWallpaperSelectionUi();
        writeCurrentWallpaperPrefs({ showError: true });
        return;
      }
      NEWTAB_WALLPAPER_MODES.forEach((mode) => {
        const activeId = getEffectiveWallpaperIdForMode(mode);
        if (activeId) {
          rememberActiveWallpaperId(mode, activeId);
        }
        if (activeId && isCustomWallpaperId(activeId)) {
          overrides[mode] = NEWTAB_LOCAL_WALLPAPER_DISABLED_VALUE;
          return;
        }
        overrides[mode] = null;
        prefs[mode] = '';
      });
      if (prefs.sameForModes) {
        prefs.dark = prefs.light;
        overrides.dark = overrides.light;
      }
      setWallpaperPrefs(prefs, overrides);
      applyResolvedNewtabWallpaper();
      syncWallpaperSourceTabToEditMode();
      updateWallpaperModeControlsUi();
      updateWallpaperSelectionUi();
      writeCurrentWallpaperPrefs({ showError: true });
    }

    function persistWallpaperModeConsistency(sameForModes) {
      const nextSameForModes = sameForModes !== false;
      const prefs = getWritableWallpaperPrefs();
      const overrides = getWritableLocalWallpaperOverrides();
      if (prefs.sameForModes === nextSameForModes) {
        updateWallpaperModeControlsUi();
        return;
      }
      if (!nextSameForModes) {
        const sharedEffectPrefs = getWallpaperEffectPrefsForEditMode();
        const modeOrder = getWallpaperModePreferenceOrder();
        const sharedId = hasAnyWallpaperEnabled()
          ? getFirstEnabledWallpaperIdForModes(modeOrder)
          : '';
        const sharedOverride = getCopyableWallpaperLocalOverrideForId(modeOrder, sharedId);
        prefs.sameForModes = false;
        prefs.light = sharedOverride
          ? (prefs.light || NEWTAB_WALLPAPER_DEFAULT_ID)
          : sharedId;
        prefs.dark = prefs.light;
        if (sharedOverride) {
          overrides.light = sharedOverride;
          overrides.dark = sharedOverride;
        } else {
          overrides.light = null;
          overrides.dark = null;
        }
        activeWallpaperMode = getResolvedWallpaperMode();
        setSharedWallpaperEffectPrefs(sharedEffectPrefs);
      } else {
        const sharedMode = getWallpaperEditMode();
        const sharedEffectPrefs = getWallpaperEffectPrefsForMode(sharedMode);
        const sharedId = getEffectiveWallpaperIdForMode(sharedMode);
        const sharedOverride = getWallpaperLocalOverrideForMode(sharedMode);
        prefs.sameForModes = true;
        prefs.light = sharedOverride && isCustomWallpaperId(sharedOverride)
          ? (prefs[sharedMode] || NEWTAB_WALLPAPER_DEFAULT_ID)
          : sharedId;
        prefs.dark = prefs.light;
        overrides.light = sharedOverride || null;
        overrides.dark = overrides.light;
        activeWallpaperMode = getResolvedWallpaperMode();
        setSharedWallpaperEffectPrefs(sharedEffectPrefs);
      }
      setWallpaperPrefs(prefs, overrides);
      applyWallpaperEffectForResolvedMode();
      applyResolvedNewtabWallpaper();
      syncWallpaperSourceTabToEditMode();
      updateWallpaperModeControlsUi();
      updateWallpaperSelectionUi();
      writeCurrentWallpaperPrefs({ showError: true });
      if (storageArea) {
        storageArea.set({
          [NEWTAB_WALLPAPER_EFFECT_STORAGE_KEY]: getWallpaperEffectStorageValue()
        });
      }
    }

    function persistNewtabWallpaper(id) {
      bingSelectionSeq += 1;
      wallpaperStorageChangeSeq += 1;
      const nextId = normalizeNewtabWallpaperId(id);
      const prefs = getWritableWallpaperPrefs();
      const overrides = getWritableLocalWallpaperOverrides();
      const targetModes = prefs.sameForModes
        ? NEWTAB_WALLPAPER_MODES.slice()
        : [getWallpaperEditMode()];
      targetModes.forEach((mode) => {
        if (nextId && isCustomWallpaperId(nextId)) {
          overrides[mode] = nextId;
          rememberActiveWallpaperId(mode, nextId);
          return;
        }
        overrides[mode] = null;
        prefs[mode] = nextId;
        if (nextId) {
          rememberActiveWallpaperId(mode, nextId);
        }
      });
      if (prefs.sameForModes) {
        prefs.dark = prefs.light;
        overrides.dark = overrides.light;
      }
      setWallpaperPrefs(prefs, overrides);
      remoteClient.setPinnedIds([prefs.light, prefs.dark]);
      applyResolvedNewtabWallpaper();
      updateBingUi();
      updateWallpaperSelectionUi();
      updateWallpaperModeControlsUi({ animate: false });
      if (nextId && isCustomWallpaperId(nextId)) {
        writeLocalWallpaperValue(
          buildLocalWallpaperStorageValue(currentLocalWallpaperOverrides, currentWallpaperPrefs.sameForModes),
          { showError: true }
        );
        return;
      }
      writeCurrentWallpaperPrefs({ showError: true });
    }

    function canShowCustomWallpaperTooltip(target) {
      return Boolean(target &&
        target.isConnected &&
        !customWallpaperImporting &&
        target.getAttribute('data-loading') !== 'true');
    }

    function showCustomWallpaperTooltip(target) {
      if (!canShowCustomWallpaperTooltip(target)) {
        hideCustomWallpaperTooltip();
        return;
      }
      showTopActionTooltip(target, t('newtab_wallpaper_add_local', 'Add local wallpaper'));
    }

    function hideCustomWallpaperTooltip() {
      hideTopActionTooltip();
    }

    function openCustomWallpaperPicker() {
      if (customWallpaperInput && !customWallpaperImporting) {
        hideCustomWallpaperTooltip();
        customWallpaperInput.click();
      }
    }

    function bindCustomWallpaperUploadTile(tile) {
      if (!tile) {
        return;
      }
      tile.addEventListener('click', openCustomWallpaperPicker);
      tile.addEventListener('keydown', (event) => {
        if (!event || (event.key !== 'Enter' && event.key !== ' ')) {
          return;
        }
        event.preventDefault();
        openCustomWallpaperPicker();
      });
      tile.addEventListener('mouseenter', () => {
        showCustomWallpaperTooltip(tile);
      });
      tile.addEventListener('mouseleave', hideCustomWallpaperTooltip);
      tile.addEventListener('focusin', () => {
        showCustomWallpaperTooltip(tile);
      });
      tile.addEventListener('focusout', (event) => {
        const nextTarget = event && event.relatedTarget ? event.relatedTarget : null;
        if (!nextTarget || !tile.contains(nextTarget)) {
          hideCustomWallpaperTooltip();
        }
      });
    }

    function importCustomWallpaperFile(file) {
      if (!file || customWallpaperImporting) {
        return;
      }
      customWallpaperImporting = true;
      updateCustomWallpaperUploadTile();
      const toastTask = beginToast(t('newtab_wallpaper_importing', 'Importing wallpaper…'));
      buildCustomWallpaperRecordFromFile(file).then((record) => {
        return writeCustomWallpaperRecord(record).then(() => record);
      }).then((record) => {
        const nextWallpaper = normalizeCustomWallpaperRecord(record);
        if (!nextWallpaper) {
          throw new Error('Invalid wallpaper record.');
        }
        customWallpapers = customWallpapers.concat(nextWallpaper);
        persistNewtabWallpaper(nextWallpaper.id);
        renderCustomWallpaperTiles();
        toastTask.done(t('newtab_wallpaper_import_done', 'Wallpaper imported'));
      }).catch(() => {
        toastTask.fail(t('newtab_wallpaper_import_error', 'Failed to import wallpaper'));
      }).finally(() => {
        customWallpaperImporting = false;
        if (customWallpaperInput) {
          customWallpaperInput.value = '';
        }
        updateCustomWallpaperUploadTile();
      });
    }

    function normalizeCustomWallpaperUrl(value) {
      try {
        const url = new URL(String(value || '').trim());
        return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
      } catch (_error) {
        return '';
      }
    }

    function getCustomWallpaperUrlName(url) {
      try {
        const parsed = new URL(url);
        const file = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '');
        return (file.replace(/\.[^.]+$/, '') || parsed.hostname).slice(0, 80);
      } catch (_error) {
        return '';
      }
    }

    // Some hosts label images as generic binaries; the file extension then names the type.
    function getCustomWallpaperUrlMimeType(url, type) {
      const mime = String(type || '').split(';')[0].trim().toLowerCase();
      if (mime.startsWith('image/')) return mime === 'image/jpg' ? 'image/jpeg' : mime;
      const extension = (/\.([a-z0-9]{3,4})$/i.exec(new URL(url).pathname) || [])[1] || '';
      return { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[extension.toLowerCase()] || mime;
    }

    async function fetchCustomWallpaperFile(url) {
      const fetcher = typeof options.fetchRemoteContent === 'function'
        ? options.fetchRemoteContent
        : windowObj.fetch.bind(windowObj);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetcher(url, {
          signal: controller.signal,
          credentials: 'omit',
          referrerPolicy: 'no-referrer'
        });
        if (!response.ok) {
          throw new Error(`Request failed (${response.status}).`);
        }
        const blob = await response.blob();
        return new File([blob], getCustomWallpaperUrlName(response.url || url), {
          type: getCustomWallpaperUrlMimeType(response.url || url, blob.type)
        });
      } finally {
        clearTimeout(timer);
      }
    }

    function updateCustomWallpaperUrlControls() {
      if (!customWallpaperUrlTile) {
        return;
      }
      const label = t('newtab_wallpaper_add_url', 'Add image link');
      customWallpaperUrlTile.setAttribute('aria-label', label);
      customWallpaperUrlTile.setAttribute('aria-expanded', customWallpaperUrlForm.hidden ? 'false' : 'true');
      customWallpaperUrlTile.setAttribute('aria-disabled', customWallpaperImporting ? 'true' : 'false');
      customWallpaperUrlInput.placeholder = t('newtab_wallpaper_url_placeholder', 'Paste an image link (https://…)');
      customWallpaperUrlInput.setAttribute('aria-label', label);
      customWallpaperUrlInput.disabled = customWallpaperImporting;
      customWallpaperUrlSubmit.textContent = t('newtab_wallpaper_url_submit', 'Add');
      customWallpaperUrlSubmit.disabled = customWallpaperImporting;
    }

    function setCustomWallpaperUrlFormOpen(open) {
      if (!customWallpaperUrlForm || customWallpaperUrlForm.hidden === !open) {
        if (open && customWallpaperUrlInput) customWallpaperUrlInput.focus();
        return;
      }
      animateWallpaperPanelResize(() => {
        customWallpaperUrlForm.hidden = !open;
        customWallpaperUrlInput.removeAttribute('aria-invalid');
        updateCustomWallpaperUrlControls();
      });
      if (open) {
        customWallpaperUrlInput.focus();
      }
    }

    function isLinkWallpaperId(id) {
      return LINK_WALLPAPER_ID_PATTERN.test(String(id || ''));
    }

    function normalizeLinkWallpapers(value) {
      const ids = new Set();
      return (Array.isArray(value) ? value : []).map((entry) => ({
        id: String(entry && entry.id || ''),
        url: normalizeCustomWallpaperUrl(entry && entry.url),
        addedAt: Number(entry && entry.addedAt) || 0
      })).filter((entry) => {
        if (!isLinkWallpaperId(entry.id) || !entry.url || ids.has(entry.id)) return false;
        ids.add(entry.id);
        return true;
      });
    }

    function setLinkWallpapers(value) {
      const next = normalizeLinkWallpapers(value);
      const changed = JSON.stringify(next) !== JSON.stringify(linkWallpapers);
      linkWallpapers = next;
      return changed;
    }

    function getLinkWallpaperById(id) {
      const entry = linkWallpapers.find((item) => item.id === id);
      if (!entry) return null;
      const cached = getCachedWallpaperImage(id, entry.url);
      return {
        id,
        url: entry.url,
        name: getCustomWallpaperUrlName(entry.url),
        imageDataUrl: cached ? cached.imageDataUrl : '',
        thumbnailDataUrl: cached ? cached.thumbnailDataUrl : '',
        updatedAt: entry.addedAt
      };
    }

    // The preload already reads the shown photo's copy; take it instead of opening the cache again.
    function takePreloadedWallpaperImage() {
      const wallpaperPreload = globalThis.LumnoNewtabWallpaperPreload;
      const ready = wallpaperPreload && wallpaperPreload.imageReady;
      if (!ready || typeof ready.then !== 'function') return Promise.resolve();
      wallpaperPreload.imageReady = null;
      return ready.then(() => {
        const record = wallpaperPreload.cachedImageRecord;
        if (record && record.id && record.imageDataUrl && !cachedWallpaperImages.has(record.id)) {
          cachedWallpaperImages.set(record.id, record);
        }
      }, () => {});
    }

    function readCachedWallpaperImages(ids) {
      return takePreloadedWallpaperImage().then(() => readStoredCachedWallpaperImages(ids));
    }

    function readStoredCachedWallpaperImages(ids) {
      const missing = ids.filter((id) => !cachedWallpaperImages.has(id));
      if (!wallpaperImageCache || !missing.length) return Promise.resolve();
      return wallpaperImageCache.readByIds(missing).then((records) => {
        records.forEach((record) => {
          if (record && record.imageDataUrl) cachedWallpaperImages.set(record.id, record);
        });
      }).catch(() => {});
    }

    function rememberCachedWallpaperImage(id, url, record) {
      const image = { id, url, imageDataUrl: record.imageDataUrl, thumbnailDataUrl: record.thumbnailDataUrl,
        cachedAt: Date.now() };
      cachedWallpaperImages.set(id, image);
      if (wallpaperImageCache) wallpaperImageCache.write(image).catch(() => {});
    }

    // A link names a single image. Each device downloads it, or a curated photo or print, once and
    // keeps a downscaled copy, so new tabs skip the network and the wallpaper keeps showing if the
    // link later breaks.
    function cacheWallpaperImage(photoId, url) {
      if (getCachedWallpaperImage(photoId, url)) return Promise.resolve(true);
      if (wallpaperImageCaching.has(photoId)) return wallpaperImageCaching.get(photoId);
      const task = readCachedWallpaperImages([photoId]).then(() => getCachedWallpaperImage(photoId, url) ||
        fetchCustomWallpaperFile(url).then(buildCustomWallpaperRecordFromFile).then((record) => {
          rememberCachedWallpaperImage(photoId, url, record);
          pruneCachedWallpaperImages();
        }))
        .then(() => {
          const showing = NEWTAB_WALLPAPER_MODES.some((mode) => getEffectiveWallpaperPhotoId(mode) === photoId);
          if (showing) applyResolvedNewtabWallpaper();
          if (customWallpaperCatalogLoaded && isLinkWallpaperId(photoId)) renderCustomWallpaperTiles();
          return true;
        })
        .catch(() => false)
        .finally(() => wallpaperImageCaching.delete(photoId));
      wallpaperImageCaching.set(photoId, task);
      return task;
    }

    function cacheLinkWallpaper(id) {
      const entry = linkWallpapers.find((item) => item.id === id);
      return entry ? cacheWallpaperImage(id, entry.url) : Promise.resolve(false);
    }

    // The photo a mode shows: the link itself, or the photo or print a curated or daily pick resolves to.
    function getEffectiveWallpaperPhotoId(mode) {
      const id = getEffectiveWallpaperIdForMode(mode);
      if (isLinkWallpaperId(id)) return id;
      const item = id && REMOTE_CONTENT.wallpaperFromId(id) ? getWallpaperById(id) : null;
      return item && item.cacheImage ? item.dailyId || item.id : '';
    }

    function cacheShownWallpaperImages() {
      NEWTAB_WALLPAPER_MODES.forEach((mode) => {
        const id = getEffectiveWallpaperIdForMode(mode);
        if (isLinkWallpaperId(id)) {
          cacheLinkWallpaper(id);
          return;
        }
        const item = id && REMOTE_CONTENT.wallpaperFromId(id) ? getWallpaperById(id) : null;
        if (item && item.cacheImage) cacheWallpaperImage(item.dailyId || item.id, item.imageUrl);
      });
    }

    // Saved links keep their copies; a curated photo or print stays only while a mode shows it, so
    // daily picks do not pile up one image per day.
    function pruneCachedWallpaperImages() {
      if (!wallpaperImageCache || !hasStoredWallpaperStateLoaded) return;
      const keep = new Set(linkWallpapers.map((item) => item.id)
        .concat(NEWTAB_WALLPAPER_MODES.map(getEffectiveWallpaperPhotoId)));
      wallpaperImageCache.keys().then((keys) => keys.filter((key) => !keep.has(key)).forEach((key) => {
        cachedWallpaperImages.delete(key);
        wallpaperImageCache.remove(key).catch(() => {});
      })).catch(() => {});
    }

    function cacheListedLinkWallpapers() {
      linkWallpapers.forEach((item) => cacheLinkWallpaper(item.id));
    }

    function writeLinkWallpapers(list) {
      linkWallpapers = list;
      writeStorageValue(storageArea, NEWTAB_LINK_WALLPAPERS_STORAGE_KEY, list, () => {
        showToast(t('newtab_wallpaper_save_error', 'Failed to save wallpaper'), true);
      });
    }

    // Deleting a link removes it from every synced device, like the other synced settings.
    function deleteLinkWallpaper(id) {
      hideTopActionTooltip();
      // Read the selection while the link still resolves.
      const prefs = getWritableWallpaperPrefs();
      const selected = NEWTAB_WALLPAPER_MODES.filter((mode) => prefs[mode] === id);
      selected.forEach((mode) => { prefs[mode] = NEWTAB_WALLPAPER_DEFAULT_ID; });
      writeLinkWallpapers(linkWallpapers.filter((item) => item.id !== id));
      cachedWallpaperImages.delete(id);
      if (wallpaperImageCache) wallpaperImageCache.remove(id).catch(() => {});
      if (selected.length) {
        setWallpaperPrefs(prefs, getWritableLocalWallpaperOverrides());
        applyResolvedNewtabWallpaper();
        writeCurrentWallpaperPrefs({ showError: true });
      }
      renderCustomWallpaperTiles();
      showToast(t('newtab_wallpaper_delete_done', 'Deleted'), false);
    }

    function finishCustomWallpaperUrlEntry() {
      customWallpaperUrlInput.value = '';
      setCustomWallpaperUrlFormOpen(false);
    }

    function submitCustomWallpaperUrl() {
      const url = normalizeCustomWallpaperUrl(customWallpaperUrlInput.value);
      if (!url) {
        customWallpaperUrlInput.setAttribute('aria-invalid', 'true');
        showToast(t('newtab_wallpaper_url_invalid', 'Enter a link that starts with http:// or https://'), true);
        customWallpaperUrlInput.focus();
        return;
      }
      customWallpaperUrlInput.removeAttribute('aria-invalid');
      const existing = linkWallpapers.find((item) => item.url === url);
      if (existing) {
        persistNewtabWallpaper(existing.id);
        finishCustomWallpaperUrlEntry();
        return;
      }
      const entry = {
        id: `link-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
        url,
        addedAt: Date.now()
      };
      if (url.length > LINK_WALLPAPER_URL_MAX_LENGTH ||
          JSON.stringify(linkWallpapers.concat(entry)).length > LINK_WALLPAPERS_MAX_BYTES) {
        showToast(t('newtab_wallpaper_url_limit',
          'This link is too long, or too many links are saved. Remove some and try again.'), true);
        return;
      }
      customWallpaperImporting = true;
      updateCustomWallpaperUploadTile();
      const toastTask = beginToast(t('newtab_wallpaper_importing', 'Importing wallpaper…'));
      // Load the image before saving the link, so a broken link never reaches other devices.
      fetchCustomWallpaperFile(url).then(buildCustomWallpaperRecordFromFile).then((record) => {
        rememberCachedWallpaperImage(entry.id, url, record);
        writeLinkWallpapers(linkWallpapers.concat(entry));
        persistNewtabWallpaper(entry.id);
        renderCustomWallpaperTiles();
        finishCustomWallpaperUrlEntry();
        toastTask.done(t('newtab_wallpaper_import_done', 'Wallpaper imported'));
      }).catch(() => {
        toastTask.fail(t('newtab_wallpaper_url_import_error', 'Could not add an image from this link'));
        if (customWallpaperUrlInput.isConnected) customWallpaperUrlInput.focus();
      }).finally(() => {
        customWallpaperImporting = false;
        updateCustomWallpaperUploadTile();
      });
    }

    function bindCustomWallpaperUrlControls() {
      if (!customWallpaperUrlTile || !customWallpaperUrlForm) {
        return;
      }
      const label = () => t('newtab_wallpaper_add_url', 'Add image link');
      bindWallpaperTileActivation(customWallpaperUrlTile, () => {
        if (!customWallpaperImporting) setCustomWallpaperUrlFormOpen(customWallpaperUrlForm.hidden);
      });
      customWallpaperUrlTile.addEventListener('mouseenter', () => showTopActionTooltip(customWallpaperUrlTile, label()));
      customWallpaperUrlTile.addEventListener('mouseleave', hideTopActionTooltip);
      customWallpaperUrlTile.addEventListener('focus', () => showTopActionTooltip(customWallpaperUrlTile, label()));
      customWallpaperUrlTile.addEventListener('blur', hideTopActionTooltip);
      customWallpaperUrlForm.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!customWallpaperImporting) submitCustomWallpaperUrl();
      });
      customWallpaperUrlInput.addEventListener('input', () => customWallpaperUrlInput.removeAttribute('aria-invalid'));
      updateCustomWallpaperUrlControls();
    }

    // Escape closes an open link form before it closes the whole panel.
    function closeCustomWallpaperUrlForm() {
      if (!customWallpaperUrlForm || customWallpaperUrlForm.hidden || activeWallpaperTab !== 'local') {
        return false;
      }
      const hadFocus = customWallpaperUrlForm.contains(document.activeElement);
      setCustomWallpaperUrlFormOpen(false);
      if (hadFocus) customWallpaperUrlTile.focus();
      return true;
    }

    function deleteCustomWallpaper(id) {
      if (isLinkWallpaperId(id)) {
        deleteLinkWallpaper(id);
        return;
      }
      const targetWallpaper = getCustomWallpaperById(id);
      if (!targetWallpaper || customWallpaperImporting) {
        return;
      }
      hideTopActionTooltip();
      deleteCustomWallpaperRecord(targetWallpaper).then(() => {
        customWallpapers = customWallpapers.filter((item) => item && item.id !== targetWallpaper.id);
        renderCustomWallpaperTiles();
        const overrides = getWritableLocalWallpaperOverrides();
        let changed = false;
        NEWTAB_WALLPAPER_MODES.forEach((mode) => {
          if (overrides[mode] !== targetWallpaper.id) {
            return;
          }
          overrides[mode] = NEWTAB_LOCAL_WALLPAPER_DISABLED_VALUE;
          changed = true;
        });
        if (changed) {
          setWallpaperPrefs(currentWallpaperPrefs, overrides);
          applyResolvedNewtabWallpaper();
          updateWallpaperSelectionUi();
          writeLocalWallpaperValue(buildLocalWallpaperStorageValue(
            currentLocalWallpaperOverrides,
            currentWallpaperPrefs.sameForModes
          ), { showError: true });
        } else {
          updateWallpaperSelectionUi();
        }
        showToast(t('newtab_wallpaper_delete_done', 'Deleted'), false);
      }).catch(() => {
        showToast(t('newtab_wallpaper_delete_error', 'Failed to delete wallpaper'), true);
      });
    }

    function isWallpaperPanelOpen() {
      return Boolean(wallpaperPanel && wallpaperPanel.getAttribute('data-open') === 'true');
    }

    function setWallpaperPanelOpenState(open) {
      if (!document.body) {
        return;
      }
      if (open) {
        document.body.setAttribute('data-wallpaper-panel-open', 'true');
        return;
      }
      document.body.removeAttribute('data-wallpaper-panel-open');
    }

    function getWallpaperAppearanceModeLabel(mode) {
      if (mode === 'light') {
        return t('settings_theme_light', 'Light');
      }
      if (mode === 'dark') {
        return t('settings_theme_dark', 'Dark');
      }
      if (getThemeScope() === 'home') {
        return t('newtab_theme_follow_global', 'Follow "Global"');
      }
      return t('settings_theme_system', 'Follow system');
    }

    function updateWallpaperAppearanceModeLabels() {
      if (wallpaperAppearanceModeLabelsHeld) {
        return;
      }
      if (!wallpaperAppearanceOptions) {
        return;
      }
      getWallpaperAppearanceOptionButtons().forEach((button) => {
        const mode = button.getAttribute('data-theme-mode') || 'system';
        const modeLabel = getWallpaperAppearanceModeLabel(mode);
        button.setAttribute('aria-label', formatMessage('mode_switch_title', '{name}: switch to {mode} mode', {
          name: 'Lumno',
          mode: modeLabel
        }));
        const label = button.querySelector('.x-nt-appearance-label');
        if (label) {
          label.textContent = modeLabel;
        }
      });
    }

    function clearWallpaperAppearanceScopeAnimation(options) {
      wallpaperAppearanceAnimationTimers.forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      wallpaperAppearanceAnimationTimers = [];
      if (!options || options.releaseLabels !== false) {
        wallpaperAppearanceModeLabelsHeld = false;
      }
      getWallpaperAppearanceOptionButtons().forEach((button) => {
        const motionElement = getWallpaperAppearanceOptionMotionElement(button);
        if (!motionElement) {
          return;
        }
        motionElement.style.removeProperty('transition');
        motionElement.style.removeProperty('transform');
        motionElement.style.removeProperty('opacity');
        motionElement.style.removeProperty('will-change');
      });
      if (wallpaperAppearanceOptions) {
        wallpaperAppearanceOptions.removeAttribute('data-scope-animating');
      }
    }

    function shouldReduceMotion() {
      return Boolean(window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    function playWallpaperEnterMotion(element, state) {
      if (!element) {
        return;
      }
      const nextState = state || 'enter';
      if (shouldReduceMotion()) {
        element.removeAttribute('data-motion');
        return;
      }
      element.setAttribute('data-motion', nextState);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (element.getAttribute('data-motion') === nextState) {
            element.removeAttribute('data-motion');
          }
        });
      });
    }

    function getWallpaperGridForTab(tab) {
      if (tab === 'bing') return wallpaperBingPanel;
      if (tab === 'curated') return wallpaperCuratedPanel;
      return tab === 'local' ? wallpaperLocalGrid : wallpaperBuiltInGrid;
    }

    function getAppearanceScopeDirection(scope) {
      return scope === 'home' ? 1 : -1;
    }

    function getAppearanceOptionDelay(index, count, direction) {
      const visualIndex = direction > 0 ? (count - 1 - index) : index;
      return Math.max(0, visualIndex * 20);
    }

    function animateWallpaperAppearanceScopeChange(previousScope, nextScope) {
      const targetScope = nextScope === 'home' ? 'home' : 'global';
      const sourceScope = previousScope === 'home' ? 'home' : 'global';
      const buttons = getWallpaperAppearanceOptionButtons();
      clearWallpaperAppearanceScopeAnimation();
      if (!buttons.length || sourceScope === targetScope || shouldReduceMotion()) {
        setThemeScope(targetScope);
        updateWallpaperAppearanceSelectionUi();
        updateWallpaperAppearanceModeLabels();
        return;
      }
      const direction = getAppearanceScopeDirection(targetScope);
      const offsetPx = 24;
      const durationMs = 220;
      const fadeDurationMs = 140;
      const handoffOverlapMs = 70;
      const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';
      wallpaperAppearanceModeLabelsHeld = true;
      if (wallpaperAppearanceOptions) {
        wallpaperAppearanceOptions.setAttribute('data-scope-animating', 'true');
      }
      updateWallpaperAppearanceScopeTabsUi(targetScope);

      let maxOutDelay = 0;
      buttons.forEach((button, index) => {
        const motionElement = getWallpaperAppearanceOptionMotionElement(button);
        if (!motionElement) {
          return;
        }
        const delay = getAppearanceOptionDelay(index, buttons.length, direction);
        maxOutDelay = Math.max(maxOutDelay, delay);
        motionElement.style.setProperty('will-change', 'transform, opacity');
        motionElement.style.setProperty(
          'transition',
          `transform ${durationMs}ms ${easing} ${delay}ms, opacity ${fadeDurationMs}ms ${easing} ${delay}ms`
        );
        motionElement.style.setProperty('opacity', '0');
        motionElement.style.setProperty('transform', `translate3d(${direction * -offsetPx}px, 0, 0)`);
      });

      const handoffDelayMs = Math.max(0, durationMs + maxOutDelay - handoffOverlapMs);
      const handoffTimer = window.setTimeout(() => {
        wallpaperAppearanceAnimationTimers = wallpaperAppearanceAnimationTimers.filter((timerId) => timerId !== handoffTimer);
        setThemeScope(targetScope);
        wallpaperAppearanceModeLabelsHeld = false;
        updateWallpaperAppearanceSelectionUi();
        updateWallpaperAppearanceModeLabels();
        buttons.forEach((button) => {
          const motionElement = getWallpaperAppearanceOptionMotionElement(button);
          if (!motionElement) {
            return;
          }
          motionElement.style.setProperty('transition', 'none');
          motionElement.style.setProperty('opacity', '0');
          motionElement.style.setProperty('transform', `translate3d(${direction * offsetPx}px, 0, 0)`);
        });
        if (wallpaperAppearanceOptions) {
          void wallpaperAppearanceOptions.offsetHeight;
        }
        let maxInDelay = 0;
        buttons.forEach((button, index) => {
          const motionElement = getWallpaperAppearanceOptionMotionElement(button);
          if (!motionElement) {
            return;
          }
          const delay = getAppearanceOptionDelay(index, buttons.length, direction);
          maxInDelay = Math.max(maxInDelay, delay);
          motionElement.style.setProperty(
            'transition',
            `transform ${durationMs}ms ${easing} ${delay}ms, opacity ${fadeDurationMs}ms ${easing} ${delay}ms`
          );
          motionElement.style.setProperty('opacity', '1');
          motionElement.style.setProperty('transform', 'translate3d(0, 0, 0)');
        });
        const cleanupTimer = window.setTimeout(() => {
          wallpaperAppearanceAnimationTimers = wallpaperAppearanceAnimationTimers.filter((timerId) => timerId !== cleanupTimer);
          clearWallpaperAppearanceScopeAnimation();
          updateWallpaperAppearanceSelectionUi();
          updateWallpaperAppearanceModeLabels();
        }, durationMs + maxInDelay + 24);
        wallpaperAppearanceAnimationTimers.push(cleanupTimer);
      }, handoffDelayMs);
      wallpaperAppearanceAnimationTimers.push(handoffTimer);
    }

    function getWallpaperButtonLabel() {
      return t('settings_tab_appearance', 'Appearance');
    }

    function updateWallpaperButtonLanguageStrings() {
      if (wallpaperButton) {
        const label = getWallpaperButtonLabel();
        wallpaperButton.setAttribute('aria-label', label);
        wallpaperButton.removeAttribute('title');
      }
    }

    function isFocusRoutePending() {
      return Boolean(
        document.documentElement &&
        document.documentElement.getAttribute('data-nt-focus-route-pending') === 'true'
      );
    }

    // Points at the appearance button until the panel is opened once.
    function createWallpaperSourcesFeatureHint() {
      if (wallpaperSourcesHintController ||
          isFocusRoutePending() ||
          !wallpaperControl ||
          !featureHints ||
          typeof featureHints.createFeatureHint !== 'function') {
        return wallpaperSourcesHintController;
      }
      const controller = featureHints.createFeatureHint({
        documentObj: document,
        windowObj: window,
        chromeApi: chrome,
        definition: 'newtab-wallpaper-sources',
        visibilityGate: featureHintVisibilityGate,
        t,
        getRiSvg
      });
      if (!controller || !controller.element) {
        return null;
      }
      wallpaperSourcesHintController = controller;
      wallpaperControl.appendChild(controller.element);
      return controller;
    }

    function dismissWallpaperSourcesFeatureHint() {
      if (wallpaperSourcesHintController &&
          typeof wallpaperSourcesHintController.dismiss === 'function') {
        wallpaperSourcesHintController.dismiss();
      }
    }

    function updateInputAutoFocusUi() {
      const enabled = Boolean(getInputAutoFocusEnabled());
      if (wallpaperInputAutoFocusToggle) {
        wallpaperInputAutoFocusToggle.checked = enabled;
        wallpaperInputAutoFocusToggle.setAttribute('aria-checked', enabled ? 'true' : 'false');
      }
    }

    function updateWallpaperAppearanceLanguageStrings() {
      if (wallpaperAppearanceTitle) {
        wallpaperAppearanceTitle.textContent = t('newtab_appearance_settings_title', 'Appearance settings');
      }
      if (wallpaperThemeSectionTitle) {
        wallpaperThemeSectionTitle.textContent = t('settings_theme_title', 'Theme mode');
      }
      if (wallpaperAppearanceMoreSettingsLink) {
        const label = t('newtab_more_settings', 'More settings');
        wallpaperAppearanceMoreSettingsLink.setAttribute('aria-label', label);
        wallpaperAppearanceMoreSettingsLink.setAttribute('href', buildAppearanceSettingsUrl());
        if (wallpaperAppearanceMoreSettingsText) {
          wallpaperAppearanceMoreSettingsText.textContent = label;
        }
      }
      if (wallpaperAppearanceInfoButton) {
        wallpaperAppearanceInfoButton.setAttribute(
          'aria-label',
          t('newtab_theme_scope_help_label', 'Theme scope info')
        );
      }
      if (wallpaperInputAutoFocusTitle) {
        wallpaperInputAutoFocusTitle.textContent = t(
          'newtab_input_auto_focus_title',
          'Automatically focus input'
        );
      }
      if (wallpaperInputAutoFocusInfoButton) {
        wallpaperInputAutoFocusInfoButton.setAttribute(
          'aria-label',
          t('newtab_input_auto_focus_help_label', 'Input auto-focus info')
        );
      }
      if (wallpaperInputAutoFocusToggle) {
        wallpaperInputAutoFocusToggle.setAttribute(
          'aria-label',
          t('newtab_input_auto_focus_title', 'Automatically focus input')
        );
      }
      if (wallpaperSourcesHintController &&
          typeof wallpaperSourcesHintController.updateLanguage === 'function') {
        wallpaperSourcesHintController.updateLanguage();
      }
      updateWallpaperShortcutsUi();
      if (wallpaperAppearanceScopeTabs) {
        wallpaperAppearanceScopeTabs.setAttribute('aria-label', t('newtab_theme_scope_label', 'Theme scope'));
        wallpaperAppearanceScopeTabs.querySelectorAll('.x-nt-appearance-scope-tab').forEach((button) => {
          const scope = button.getAttribute('data-theme-scope') === 'home' ? 'home' : 'global';
          const label = scope === 'home'
            ? t('newtab_theme_scope_home', 'New Tab')
            : t('newtab_theme_scope_global', 'Global');
          button.textContent = label;
          button.setAttribute('aria-label', formatMessage(
            'newtab_theme_scope_select_label',
            'Apply theme changes to {scope}',
            { scope: label }
          ));
        });
        scheduleAppearanceScopeTabsIndicatorRefresh();
      }
    }

    function updateWallpaperSectionLanguageStrings() {
      if (wallpaperPanelTitle) {
        const title = t('newtab_wallpaper_title', 'Wallpaper');
        wallpaperPanelTitle.textContent = title;
        if (wallpaperAccordionTrigger) wallpaperAccordionTrigger.setAttribute('aria-label', title);
        if (wallpaperPanel) {
          wallpaperPanel.setAttribute('aria-label', t('settings_tab_appearance', 'Appearance'));
        }
      }
      if (wallpaperSourceLabel) {
        wallpaperSourceLabel.textContent = t('newtab_wallpaper_source_title', 'Source');
      }
      if (wallpaperTabs) {
        wallpaperTabs.setAttribute('aria-label', t('newtab_wallpaper_source_title', 'Source'));
      }
      if (wallpaperBuiltInTab) {
        const label = t('newtab_wallpaper_builtin_section', 'Built-in');
        wallpaperBuiltInTab.textContent = label;
        wallpaperBuiltInTab.setAttribute('aria-label', label);
      }
      if (wallpaperBuiltInGrid) {
        wallpaperBuiltInGrid.setAttribute('aria-label', t('newtab_wallpaper_builtin_section', 'Built-in'));
      }
      if (wallpaperLocalTab) {
        const label = t('newtab_wallpaper_local_section', 'Local');
        wallpaperLocalTab.textContent = label;
        wallpaperLocalTab.setAttribute('aria-label', label);
      }
      if (wallpaperLocalGrid) {
        wallpaperLocalGrid.setAttribute('aria-label', t('newtab_wallpaper_local_section', 'Local'));
      }
      if (searchSectionTitle) {
        searchSectionTitle.textContent = t('newtab_search_section_title', 'Search box');
      }
      if (topContentTitle) {
        topContentTitle.textContent = t('settings_newtab_wordmark_title', 'Content above the search bar');
      }
      if (topContentTabs) {
        topContentTabs.setAttribute('aria-label', t('settings_newtab_wordmark_title', 'Content above the search bar'));
      }
      if (topContentBrandTab) {
        const label = t('newtab_top_content_brand', 'Brand');
        topContentBrandTab.textContent = label;
        topContentBrandTab.setAttribute('aria-label', label);
      }
      if (topContentTimeTab) {
        const label = t('newtab_top_content_time', 'Time');
        topContentTimeTab.textContent = label;
        topContentTimeTab.setAttribute('aria-label', label);
      }
      if (topContentOffTab) {
        const label = t('newtab_top_content_off', 'Hide');
        topContentOffTab.textContent = label;
        topContentOffTab.setAttribute('aria-label', label);
      }
      if (topContentWeightTitle || topContentWeightSlider) {
        const label = t('newtab_time_font_weight_title', 'Time font weight');
        if (topContentWeightTitle) {
          topContentWeightTitle.textContent = label;
        }
        if (topContentWeightSlider) {
          topContentWeightSlider.setAttribute('aria-label', label);
        }
      }
      if (topContentSecondsTitle || topContentSecondsToggle) {
        const label = t('newtab_time_show_seconds_title', 'Show seconds');
        if (topContentSecondsTitle) {
          topContentSecondsTitle.textContent = label;
        }
        if (topContentSecondsToggle) {
          topContentSecondsToggle.setAttribute('aria-label', label);
        }
      }
      scheduleTopContentTabsIndicatorRefresh();
      updateWallpaperModeControlsUi({ animate: false });
    }

    function updateWallpaperScaleLanguageStrings() {
      if (wallpaperPanel) {
        wallpaperPanel.querySelectorAll('[data-overlay-tick="transparent"]').forEach((tick) => {
          tick.textContent = t('newtab_wallpaper_overlay_transparent_tick', 'Transparent');
        });
        wallpaperPanel.querySelectorAll('[data-overlay-tick="default"]').forEach((tick) => {
          tick.textContent = t('newtab_wallpaper_overlay_default_tick', 'Default');
        });
        wallpaperPanel.querySelectorAll('[data-overlay-tick="cover"]').forEach((tick) => {
          tick.textContent = t('newtab_wallpaper_overlay_cover_tick', 'Cover');
        });
      }
    }

    function updateWallpaperTileLanguageStrings() {
      const tileContainers = getWallpaperTileContainers();
      if (tileContainers.length === 0) {
        return;
      }
      tileContainers.forEach((container) => {
        container.querySelectorAll('.x-nt-wallpaper-delete-button').forEach((button) => {
          button.setAttribute('aria-label', t('newtab_wallpaper_delete_local', 'Delete imported wallpaper'));
        });
        container.querySelectorAll('.x-nt-wallpaper-tile').forEach((tile) => {
          const wallpaperId = tile.getAttribute('data-wallpaper-id');
          const item = getWallpaperById(wallpaperId);
          if (!item) {
            return;
          }
          tile.setAttribute('aria-label', formatMessage('newtab_wallpaper_select_label', 'Select {name}', {
            name: getWallpaperDisplayName(item)
          }));
        });
      });
    }

    function formatBingDate(date) {
      return /^\d{8}$/.test(String(date || ''))
        ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}` : '';
    }

    // Bing credits read "Place (© Photographer)"; show them as "Place · © Photographer".
    function formatBingCopyright(copyright) {
      const text = String(copyright || '').trim();
      const match = /^(.*?)\s*[(（]\s*(©[^()（）]*)[)）]\s*$/.exec(text);
      return match ? [match[1], match[2].trim()].filter(Boolean).join(' · ') : text;
    }

    function getBingWallpaperLabel(item) {
      return item ? [item.name, formatBingDate(item.date)].filter(Boolean).join(' · ') : '';
    }

    function updateBingUi() {
      if (!wallpaperBingPanel || !wallpaperViewController) return;
      const refs = wallpaperViewController.getRefs();
      const selectedId = getWallpaperSelectionIdForUi();
      const daily = selectedId === REMOTE_CONTENT.BING_DAILY_ID;
      const selected = REMOTE_CONTENT.getWallpaperProvider(selectedId) === 'bing' && getWallpaperById(selectedId);
      const busy = bingLoading || bingSelecting;
      updateDailyRestoreButton(refs.bingDailyRestore, selected);
      refs.bingDailyLabel.textContent = t('newtab_bing_daily', 'Auto-update daily');
      refs.bingDailyInfoButton.setAttribute('aria-label', t('newtab_bing_daily_hint', BING_DAILY_HINT));
      refs.bingDailyToggle.checked = daily;
      refs.bingDailyToggle.disabled = bingSelecting;
      refs.bingDailyToggle.setAttribute('aria-label', t('newtab_bing_daily', 'Auto-update daily'));
      refs.bingRecentLabel.textContent = t('newtab_bing_recent', 'Recent wallpapers');
      wallpaperBingRefresh.disabled = busy;
      wallpaperBingRefresh.setAttribute('aria-busy', bingLoading ? 'true' : 'false');
      wallpaperBingRefresh.setAttribute('aria-label', t('newtab_bing_refresh', 'Refresh'));
      wallpaperBingGrid.setAttribute('aria-busy', String(busy));
      wallpaperBingGrid.setAttribute('data-loading', bingLoading && !bingItems.length ? 'true' : 'false');
      wallpaperBingStatus.textContent = bingStatus === 'loading' && !bingItems.length
        ? t('newtab_bing_loading', 'Loading wallpapers…')
        : bingStatus === 'error'
          ? t('newtab_bing_error', 'Could not load wallpapers. Please try again.') : '';
      wallpaperBingPanel.setAttribute('aria-label', 'Bing');
      wallpaperBingTab.setAttribute('aria-label', 'Bing');
      const hasSource = Boolean(selected && selected.date);
      refs.bingSelectedSource.hidden = !hasSource;
      refs.bingSelectedTitle.textContent = hasSource ? selected.name : '';
      refs.bingSelectedMeta.textContent = hasSource ? formatBingCopyright(selected.copyright) : '';
      refs.bingSelectedLink.setAttribute('aria-label', hasSource
        ? `${getBingWallpaperLabel(selected)} · ${t('newtab_bing_source', 'View wallpaper source')}` : '');
      if (hasSource) refs.bingSelectedLink.href = selected.sourceUrl;
    }

    function renderBingTiles() {
      if (!wallpaperBingGrid || !wallpaperViewController.renderOnlineWallpapers) return;
      const selectedId = getWallpaperSelectionIdForUi();
      const selected = REMOTE_CONTENT.getWallpaperProvider(selectedId) === 'bing' && getWallpaperById(selectedId);
      // Bing skips some days, so cap the list to two full rows instead of leaving a ragged last row.
      const items = (selected && selectedId !== REMOTE_CONTENT.BING_DAILY_ID && !bingItems.some((item) => item.id === selectedId)
        ? [selected, ...bingItems] : bingItems).slice(0, BING_RECENT_TILE_LIMIT);
      const tiles = wallpaperViewController.renderOnlineWallpapers(items.map((item) => ({
        id: item.id, thumbnailUrl: getWallpaperThumbnailUrl(remoteClient.getWallpaper(item.id))
      })));
      tiles.forEach((tile) => {
        const id = tile.getAttribute('data-wallpaper-id');
        const label = getBingWallpaperLabel(remoteClient.getWallpaper(id));
        tile.onclick = () => {
          // The highlighted tile is already applied; re-clicking it should not leave daily mode.
          if (tile.getAttribute('data-selected') === 'true') return;
          selectBingWallpaper(id, { asDailyPick: true });
        };
        tile.onmouseenter = () => showTopActionTooltip(tile, label);
        tile.onfocus = tile.onmouseenter;
        tile.onmouseleave = hideTopActionTooltip;
        tile.onblur = hideTopActionTooltip;
        tile.disabled = bingSelecting;
        tile.setAttribute('aria-label', formatMessage('newtab_wallpaper_select_label', 'Select {name}', { name: label }));
      });
      updateWallpaperSelectionUi();
      updateBingUi();
    }

    async function loadBingCatalog(refresh) {
      if (!wallpaperBingGrid) return;
      const seq = ++bingCatalogSeq;
      bingLoading = true;
      bingStatus = 'loading';
      updateBingUi();
      try {
        const items = await remoteClient.getCatalog(Boolean(refresh));
        if (seq !== bingCatalogSeq) return;
        bingItems = items;
        bingStatus = '';
        if (NEWTAB_WALLPAPER_MODES.some((mode) => getEffectiveWallpaperIdForMode(mode) === REMOTE_CONTENT.BING_DAILY_ID)) {
          // The list loaded; if the daily photo still fails, the current wallpaper simply stays.
          await remoteClient.ensureWallpaper(REMOTE_CONTENT.BING_DAILY_ID).catch(() => {});
          if (seq !== bingCatalogSeq) return;
          if (getEffectiveWallpaperIdForMode(getResolvedWallpaperMode()) === REMOTE_CONTENT.BING_DAILY_ID) {
            applyResolvedNewtabWallpaper();
          }
        }
      } catch (_error) {
        if (seq !== bingCatalogSeq) return;
        bingStatus = 'error';
      } finally {
        if (seq === bingCatalogSeq) {
          bingLoading = false;
          renderBingTiles();
          scheduleWallpaperPanelTabIndicatorsRefresh();
        }
      }
    }

    function bindInfoButtonTooltip(button, getText) {
      if (!button) return;
      const show = () => showTopActionTooltip(button, getText());
      button.addEventListener('mouseenter', show);
      button.addEventListener('mouseleave', hideTopActionTooltip);
      button.addEventListener('focus', show);
      button.addEventListener('blur', hideTopActionTooltip);
    }

    // A New Tab can stay open past midnight; pick up the new daily photo when it is shown again.
    function refreshDailyWallpapersIfStale() {
      if (!hasStoredWallpaperStateLoaded || document.visibilityState === 'hidden') return;
      const day = REMOTE_CONTENT.localDay(Date.now());
      if (day === dailyWallpaperCheckedDay) return;
      const dailyIds = NEWTAB_WALLPAPER_MODES.map((mode) => getEffectiveWallpaperIdForMode(mode))
        .filter((id) => REMOTE_CONTENT.isDailyWallpaperId(id));
      if (!dailyIds.length) return;
      dailyWallpaperCheckedDay = day;
      // Curated picks follow the date alone, so the new one is ready without a request.
      if (dailyIds.some((id) => id !== REMOTE_CONTENT.BING_DAILY_ID)) {
        applyResolvedNewtabWallpaper();
        renderCuratedTiles();
      }
      if (!dailyIds.includes(REMOTE_CONTENT.BING_DAILY_ID)) return;
      remoteClient.ensureWallpaper(REMOTE_CONTENT.BING_DAILY_ID).then(() => {
        if (getEffectiveWallpaperIdForMode(getResolvedWallpaperMode()) === REMOTE_CONTENT.BING_DAILY_ID) {
          applyResolvedNewtabWallpaper();
        }
        renderBingTiles();
      }).catch(() => {});
    }

    // A background tab can miss the effect redraw for a photo that changed while it was hidden.
    function syncWallpaperEffectSource() {
      if (document.visibilityState === 'hidden' || !wallpaperEffects ||
          typeof wallpaperEffects.isSourceStale !== 'function' || !wallpaperEffects.isSourceStale()) {
        return;
      }
      wallpaperEffects.refresh({ immediate: true });
    }

    function handleWallpaperPageShown() {
      refreshDailyWallpapersIfStale();
      syncWallpaperEffectSource();
    }

    // Bound once the stored wallpaper loads, so a tab that never opens the panel still rolls over.
    function bindWallpaperPageShownListeners() {
      if (hasWallpaperPageShownListeners) return;
      hasWallpaperPageShownListeners = true;
      dailyWallpaperCheckedDay = REMOTE_CONTENT.localDay(Date.now());
      if (window && typeof window.addEventListener === 'function') {
        window.addEventListener('focus', handleWallpaperPageShown, { passive: true });
      }
      if (document && typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', handleWallpaperPageShown, { passive: true });
      }
    }

    function normalizeDailyWallpaperPicks(value) {
      const picks = {};
      const source = value && typeof value === 'object' && value.picks && typeof value.picks === 'object'
        ? value.picks
        : {};
      Object.keys(source).forEach((dailyId) => {
        const pickId = String(source[dailyId] || '');
        if (REMOTE_CONTENT.isDailyWallpaperId(dailyId) && !REMOTE_CONTENT.isDailyWallpaperId(pickId) &&
            REMOTE_CONTENT.getWallpaperProvider(pickId) === REMOTE_CONTENT.getWallpaperProvider(dailyId)) {
          picks[dailyId] = pickId;
        }
      });
      return { day: value && typeof value.day === 'string' ? value.day : '', picks };
    }

    function getDailyWallpaperPick(dailyId) {
      if (!REMOTE_CONTENT.isDailyWallpaperId(dailyId) ||
          dailyWallpaperPicks.day !== REMOTE_CONTENT.localDay(Date.now())) {
        return '';
      }
      return dailyWallpaperPicks.picks[dailyId] || '';
    }

    function getActiveDailyWallpaperId(provider) {
      const id = getWallpaperSelectionIdForUi();
      return REMOTE_CONTENT.isDailyWallpaperId(id) && REMOTE_CONTENT.getWallpaperProvider(id) === provider ? id : '';
    }

    // Choosing today's own photo, or restoring it, simply drops the pick.
    function setDailyWallpaperPick(dailyId, pickId) {
      const today = REMOTE_CONTENT.localDay(Date.now());
      const picks = dailyWallpaperPicks.day === today ? Object.assign({}, dailyWallpaperPicks.picks) : {};
      const scheduled = remoteClient.getWallpaper(dailyId);
      if (!pickId || scheduled && scheduled.dailyId === pickId) delete picks[dailyId];
      else picks[dailyId] = pickId;
      dailyWallpaperPicks = { day: today, picks };
      writeStorageValue(storageArea, NEWTAB_DAILY_WALLPAPER_PICKS_STORAGE_KEY,
        Object.keys(picks).length ? dailyWallpaperPicks : '', () => {
          showToast(t('newtab_wallpaper_save_error', 'Failed to save wallpaper'), true);
        });
      applyResolvedNewtabWallpaper();
      renderBingTiles();
      renderCuratedTiles();
    }

    function clearDailyWallpaperPick(dailyId) {
      if (getDailyWallpaperPick(dailyId)) setDailyWallpaperPick(dailyId, '');
    }

    function updateDailyRestoreButton(button, selected) {
      if (!button) return;
      const label = t('newtab_daily_restore', "Back to today's wallpaper");
      button.hidden = !(selected && selected.picked);
      button.setAttribute('aria-label', label);
    }

    function getCuratedTileItems() {
      const items = REMOTE_CONTENT.getCuratedWallpapers(curatedCategory);
      if (!items.length) return [];
      // Wrap around the end of the category so every page fills both rows.
      const start = (curatedPage * CURATED_TILE_LIMIT) % items.length;
      return Array.from({ length: Math.min(CURATED_TILE_LIMIT, items.length) },
        (_, index) => items[(start + index) % items.length]);
    }

    // Pages keep a fixed order, so choosing a photo never reshuffles the grid; instead the list
    // opens on the page that holds the chosen or daily photo.
    function showCuratedPageOfSelection() {
      const selectedId = getWallpaperTileSelectionId(getWallpaperSelectionIdForUi());
      const index = REMOTE_CONTENT.getCuratedWallpapers(curatedCategory).findIndex((item) => item.id === selectedId);
      curatedPage = index >= 0 ? Math.floor(index / CURATED_TILE_LIMIT) : 0;
    }

    // Paintings are named by title, photos by photographer.
    function getCuratedPhotoLabel(item) {
      if (item && item.title) return item.title;
      return item && item.name && item.name !== 'Picsum'
        ? formatMessage('newtab_curated_photo_by', 'Photo by {name}', { name: item.name })
        : '';
    }

    function getCuratedPhotoMeta(item) {
      if (item && item.title) {
        return [item.name, t('newtab_curated_art_meta', 'The Cleveland Museum of Art')].filter(Boolean).join(' · ');
      }
      return t('newtab_curated_source_meta', 'Unsplash · via Lorem Picsum');
    }

    function getCuratedCategoryLabel(category) {
      const fallbacks = { random: 'Mix', nature: 'Nature', water: 'Water', city: 'City', minimal: 'Minimal', art: 'Art' };
      return t(`newtab_curated_category_${category}`, fallbacks[category] || category);
    }

    function isCuratedDailyWallpaperActive() {
      const selectedId = getWallpaperSelectionIdForUi();
      return REMOTE_CONTENT.isDailyWallpaperId(selectedId) &&
        REMOTE_CONTENT.getWallpaperProvider(selectedId) === 'curated';
    }

    function updateCuratedUi() {
      if (!wallpaperCuratedPanel || !wallpaperViewController) return;
      const refs = wallpaperViewController.getRefs();
      const selectedId = getWallpaperSelectionIdForUi();
      const selected = REMOTE_CONTENT.getWallpaperProvider(selectedId) === 'curated'
        ? getWallpaperById(selectedId)
        : null;
      updateDailyRestoreButton(refs.curatedDailyRestore, selected);
      const dailyLabel = t('newtab_bing_daily', 'Auto-update daily');
      refs.curatedDailyLabel.textContent = dailyLabel;
      refs.curatedDailyInfoButton.setAttribute('aria-label', t(
        'newtab_curated_daily_hint',
        CURATED_DAILY_HINT
      ));
      refs.curatedDailyToggle.checked = isCuratedDailyWallpaperActive();
      refs.curatedDailyToggle.setAttribute('aria-label', dailyLabel);
      refs.curatedCategoryLabel.textContent = t('newtab_curated_category', 'Category');
      wallpaperCuratedCategoryTabs.setAttribute('aria-label', t('newtab_curated_category', 'Category'));
      wallpaperCuratedCategoryTabs.querySelectorAll('[data-curated-category]').forEach((button) => {
        const category = button.getAttribute('data-curated-category');
        const active = category === curatedCategory;
        button.textContent = getCuratedCategoryLabel(category);
        button.setAttribute('data-active', active ? 'true' : 'false');
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      if (globalThis.LumnoSegmentedIndicator) {
        globalThis.LumnoSegmentedIndicator.sync(refs.curatedCategoryIndicator);
      }
      refs.curatedListLabel.textContent = t('newtab_curated_list', 'Photos');
      wallpaperCuratedRefresh.setAttribute('aria-label', t('newtab_curated_more', 'Show others'));
      const label = t('newtab_wallpaper_curated_section', 'Curated');
      wallpaperCuratedPanel.setAttribute('aria-label', label);
      wallpaperCuratedTab.textContent = label;
      wallpaperCuratedTab.setAttribute('aria-label', label);
      const hasSource = Boolean(selected && selected.imageUrl && getCuratedPhotoLabel(selected));
      refs.curatedSelectedSource.hidden = !hasSource;
      refs.curatedSelectedTitle.textContent = hasSource ? getCuratedPhotoLabel(selected) : '';
      refs.curatedSelectedMeta.textContent = hasSource ? getCuratedPhotoMeta(selected) : '';
      refs.curatedSelectedLink.setAttribute('aria-label', hasSource
        ? `${getCuratedPhotoLabel(selected)} · ${t('newtab_bing_source', 'View wallpaper source')}` : '');
      if (hasSource) refs.curatedSelectedLink.href = selected.sourceUrl;
    }

    function renderCuratedTiles() {
      if (!wallpaperCuratedGrid || !wallpaperViewController.renderCuratedWallpapers) return;
      const tiles = wallpaperViewController.renderCuratedWallpapers(getCuratedTileItems().map((item) => ({
        id: item.id, thumbnailUrl: item.thumbnailUrl
      })));
      tiles.forEach((tile) => {
        const id = tile.getAttribute('data-wallpaper-id');
        const item = remoteClient.getWallpaper(id);
        const label = [getCuratedPhotoLabel(item), item && item.title ? item.name : ''].filter(Boolean).join(' · ');
        tile.onclick = () => {
          // The highlighted tile is already applied; re-clicking it should not leave daily mode.
          if (tile.getAttribute('data-selected') === 'true') return;
          const daily = getActiveDailyWallpaperId('curated');
          if (daily) setDailyWallpaperPick(daily, id);
          else persistNewtabWallpaper(id);
        };
        tile.onpointerenter = () => primeWallpaperTileImage(tile);
        tile.onmouseenter = () => showTopActionTooltip(tile, label);
        tile.onfocus = tile.onmouseenter;
        tile.onmouseleave = hideTopActionTooltip;
        tile.onblur = hideTopActionTooltip;
        tile.setAttribute('aria-label', formatMessage('newtab_wallpaper_select_label', 'Select {name}', { name: label }));
      });
      updateWallpaperSelectionUi();
    }

    // Category tabs only browse; the wallpaper and the daily category stay as they are.
    function selectCuratedCategory(category) {
      if (!REMOTE_CONTENT.CURATED_CATEGORIES.includes(category) || category === curatedCategory) return;
      animateWallpaperPanelResize(() => {
        curatedCategory = category;
        showCuratedPageOfSelection();
        renderCuratedTiles();
        playWallpaperEnterMotion(wallpaperCuratedGrid, 'enter');
      });
    }

    function showMoreCuratedWallpapers() {
      curatedPage += 1;
      renderCuratedTiles();
      playWallpaperEnterMotion(wallpaperCuratedGrid, 'enter');
    }

    function setCuratedDailyWallpaper(enabled) {
      if (enabled) {
        const dailyId = REMOTE_CONTENT.curatedDailyId(curatedCategory);
        clearDailyWallpaperPick(dailyId);
        persistNewtabWallpaper(dailyId);
        showCuratedPageOfSelection();
      } else {
        // Keep the photo on screen, picked or not, as turning off the Bing daily wallpaper does.
        const daily = getWallpaperById(getWallpaperSelectionIdForUi());
        persistNewtabWallpaper(daily && daily.dailyId || NEWTAB_WALLPAPER_DEFAULT_ID);
      }
      renderCuratedTiles();
    }

    async function selectBingWallpaper(id, options) {
      if (bingSelecting) return;
      // A tile chosen while the daily photo is on replaces it for today only.
      const dailyId = options && options.asDailyPick ? getActiveDailyWallpaperId('bing') : '';
      const seq = ++bingSelectionSeq;
      const mode = getWallpaperEditMode();
      const sameForModes = currentWallpaperPrefs.sameForModes;
      bingSelecting = true;
      renderBingTiles();
      // The new wallpaper is its own success signal, so only a failure leaves a message.
      const toastTask = beginToast(t('newtab_bing_saving', 'Saving wallpaper…'));
      try {
        await remoteClient.ensureWallpaper(id);
        toastTask.done();
        if (seq !== bingSelectionSeq || mode !== getWallpaperEditMode() ||
            sameForModes !== currentWallpaperPrefs.sameForModes) return;
        if (dailyId) setDailyWallpaperPick(dailyId, id);
        else persistNewtabWallpaper(id);
      } catch (_error) {
        toastTask.fail(seq === bingSelectionSeq
          ? t('newtab_bing_save_error', 'Could not save wallpaper. Please try again.')
          : '');
      } finally {
        bingSelecting = false;
        renderBingTiles();
      }
    }

    function updateWallpaperLanguageStrings() {
      updateWallpaperButtonLanguageStrings();
      updateWallpaperAppearanceLanguageStrings();
      updateWallpaperOverlayControlUi();
      updateWallpaperEffectControlUi();
      updateCustomWallpaperUploadTile();
      updateWallpaperSectionLanguageStrings();
      updateTopContentModeUi();
      updateNewtabFaviconSelectionUi();
      updateWallpaperAppearanceModeLabels();
      updateWallpaperScaleLanguageStrings();
      updateWallpaperTileLanguageStrings();
      updateBingUi();
      const quoteRuntime = options.getQuoteRuntime && options.getQuoteRuntime();
      if (quoteRuntime) quoteRuntime.updateLanguage();
    }

    function buildAppearanceSettingsUrl() {
      if (extensionRoutes && typeof extensionRoutes.buildOptionsUrl === 'function') {
        return extensionRoutes.buildOptionsUrl(chrome, 'appearance');
      }
      if (chrome && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
        return `${chrome.runtime.getURL('src/options/options.html')}#appearance`;
      }
      try {
        return new URL('../options/options.html#appearance', document.baseURI || window.location.href).toString();
      } catch (e) {
        return '../options/options.html#appearance';
      }
    }

    function createReactWallpaperViewModel() {
      const searchWidthTicks = [];
      const min = getSearchWidthMin();
      if (min < 720) {
        searchWidthTicks.push({
          searchKey: 'min',
          align: 'start',
          label: '',
          percent: getSearchWidthPercent(min)
        });
      }
      [
        { searchKey: 'standard', value: 720, label: 'Standard' },
        { searchKey: 'wide', value: 920, label: 'Wide' },
        { searchKey: 'max', value: 1040, label: 'Max', align: 'end' }
      ].forEach((tick) => {
        searchWidthTicks.push({
          searchKey: tick.searchKey,
          align: tick.align,
          label: tick.label,
          percent: getSearchWidthPercent(tick.value)
        });
      });
      const faviconInlineSvg = [
        '<svg viewBox="0 0 104 104" fill="none" xmlns="http://www.w3.org/2000/svg">',
        `<path opacity="var(--x-nt-favicon-shadow-opacity, 0.2)" d="${NEWTAB_FAVICON_SVG_SHADOW_PATH}" fill="currentColor"/>`,
        `<path d="${NEWTAB_FAVICON_SVG_MAIN_PATH}" fill="currentColor" fill-opacity="var(--x-nt-favicon-main-opacity, 0.5)"/>`,
        '</svg>'
      ].join('');
      return {
        activeTab: activeWallpaperTab,
        appearanceOptions: [
          { mode: 'system', imageUrl: getRuntimeAssetUrl('assets/images/system.svg') },
          { mode: 'light', imageUrl: getRuntimeAssetUrl('assets/images/light.svg') },
          { mode: 'dark', imageUrl: getRuntimeAssetUrl('assets/images/dark.svg') }
        ],
        effectInkTones: NEWTAB_WALLPAPER_EFFECT_INK_TONES,
        curatedCategories: REMOTE_CONTENT.CURATED_CATEGORIES.map((value) => ({
          value,
          label: getCuratedCategoryLabel(value)
        })),
        favicons: NEWTAB_FAVICON_OPTIONS.map((item) => ({
          id: item.id,
          inlineSvg: item.preview === 'inlineSvg' ? faviconInlineSvg : '',
          previewUrl: item.preview === 'inlineSvg' ? '' : getNewtabFaviconUrl(item)
        })),
        icons: {
          add: getRiSvg('ri-add-large-line', 'ri-size-18'),
          arrow: getRiSvg('ri-arrow-right-s-line', 'ri-size-14'),
          check: getRiSvg('ri-check-line', 'ri-size-16'),
        delete: getRiSvg('ri-close-line', 'ri-size-14'),
          refresh: getRiSvg('ri-refresh-line', 'ri-size-14'),
          info: getRiSvg('ri-information-line', 'ri-size-14'),
          restore: getRiSvg('ri-arrow-go-back-line', 'ri-size-14'),
          link: getRiSvg('ri-link', 'ri-size-18'),
          wallpaper: getRiSvg('ri-t-shirt-2-line', 'ri-size-20')
        },
        moreSettingsUrl: buildAppearanceSettingsUrl(),
        topContentOptions: [
          { value: 'brand', label: t('newtab_top_content_brand', 'Brand') },
          { value: 'time', label: t('newtab_top_content_time', 'Time') },
          { value: 'off', label: t('newtab_top_content_off', 'Hide') }
        ],
        timeFontWeight: {
          min: NEWTAB_TIME_FONT_WEIGHT_MIN,
          max: NEWTAB_TIME_FONT_WEIGHT_MAX,
          defaultValue: NEWTAB_TIME_FONT_WEIGHT_DEFAULT
        },
        quoteFontSize: {
          min: SETTINGS.NEWTAB_QUOTE_FONT_SIZE_MIN || 12,
          max: SETTINGS.NEWTAB_QUOTE_FONT_SIZE_MAX || 24,
          defaultValue: SETTINGS.NEWTAB_QUOTE_FONT_SIZE_DEFAULT || 15
        },
        searchWidth: {
          min: getSearchWidthMin(),
          max: getSearchWidthMax(),
          ticks: searchWidthTicks
        },
        shortcutColumns: {
          defaultValue: normalizeShortcutColumnsValue(getShortcutColumns()),
          min: getShortcutColumnsMin(),
          max: getShortcutColumnsMax(),
          ticks: getShortcutColumnsTickValues().map((value, index, values) => ({
            align: index === 0 ? 'start' : (index === values.length - 1 ? 'end' : 'center'),
            label: String(value),
            percent: getShortcutColumnsPercent(value)
          }))
        },
        shortcutSize: {
          defaultValue: normalizeShortcutSizeValue(getShortcutSize()),
          min: getShortcutLayoutMin(shortcutSizeConfig, 48),
          max: getShortcutLayoutMax(shortcutSizeConfig, 48, 80),
          ticks: [48, 64, 80]
            .map(normalizeShortcutSizeValue)
            .filter((value, index, values) => values.indexOf(value) === index)
            .sort((a, b) => a - b)
            .map((value, index, values) => ({
              align: index === 0 ? 'start' : (index === values.length - 1 ? 'end' : 'center'),
              label: String(value),
              percent: getShortcutLayoutPercent(
                value,
                shortcutSizeConfig,
                48,
                80,
                64
              )
            }))
        },
        shortcutGap: {
          defaultValue: normalizeShortcutGapValue(getShortcutGap()),
          min: getShortcutLayoutMin(shortcutGapConfig, 0),
          max: getShortcutLayoutMax(shortcutGapConfig, 0, 24),
          ticks: [0, 8, 16, 24]
            .map(normalizeShortcutGapValue)
            .filter((value, index, values) => values.indexOf(value) === index)
            .sort((a, b) => a - b)
            .map((value, index, values) => ({
              align: index === 0 ? 'start' : (index === values.length - 1 ? 'end' : 'center'),
              label: String(value),
              percent: getShortcutLayoutPercent(value, shortcutGapConfig, 0, 24, 4)
            }))
        },
        wallpapers: NEWTAB_WALLPAPER_OPTIONS.map((item) => ({
          id: item.id,
          path: getWallpaperLocalPath(item),
          thumbnailUrl: getWallpaperThumbnailUrl(item)
        }))
      };
    }

    function assignReactWallpaperViewRefs() {
      if (!wallpaperViewController) {
        return null;
      }
      const refs = wallpaperViewController.getRefs();
      wallpaperPanelHeader = refs.panelHeader;
      wallpaperPanelTitle = refs.panelTitle;
      wallpaperAccordionTrigger = refs.wallpaperAccordionTrigger;
      wallpaperEnabledToggle = refs.enabledToggle;
      topContentTitle = refs.topContentTitle;
      searchSectionTitle = refs.searchSectionTitle || null;
      topContentTabs = refs.topContentTabs;
      topContentTabsIndicator = refs.topContentTabsIndicator;
      topContentBrandTab = refs.topContentBrandTab;
      topContentTimeTab = refs.topContentTimeTab;
      topContentOffTab = refs.topContentOffTab;
      topContentWeightControl = refs.topContentWeightControl;
      topContentWeightTitle = refs.topContentWeightTitle;
      topContentWeightSlider = refs.topContentWeightSlider;
      topContentSecondsRow = refs.topContentSecondsRow;
      topContentSecondsTitle = refs.topContentSecondsTitle;
      topContentSecondsToggle = refs.topContentSecondsToggle;
      wallpaperAppearanceTitle = refs.appearanceTitle;
      wallpaperThemeSectionTitle = refs.themeSectionTitle || null;
      wallpaperAppearanceInfoButton = refs.appearanceInfoButton;
      wallpaperAppearanceScopeTabs = refs.appearanceScopeTabs;
      wallpaperAppearanceScopeTabsIndicator = refs.appearanceScopeTabsIndicator || null;
      wallpaperAppearanceOptions = refs.appearanceOptions;
      wallpaperSearchWidthControl = refs.searchWidthControl;
      wallpaperSearchWidthLabel = refs.searchWidthLabel;
      wallpaperSearchWidthSlider = refs.searchWidthSlider;
      wallpaperInputAutoFocusTitle = refs.inputAutoFocusTitle;
      wallpaperInputAutoFocusInfoButton = refs.inputAutoFocusInfoButton;
      wallpaperInputAutoFocusToggle = refs.inputAutoFocusToggle;
      wallpaperShortcutsAccordion = refs.shortcutsAccordion;
      wallpaperShortcutsAccordionTrigger = refs.shortcutsAccordionTrigger;
      wallpaperShortcutsTitle = refs.shortcutsTitle;
      wallpaperShortcutsDetails = refs.shortcutsDetails;
      wallpaperShortcutsToggle = refs.shortcutsToggle;
      wallpaperShortcutAddTitle = refs.shortcutAddTitle;
      wallpaperShortcutAddToggle = refs.shortcutAddToggle;
      wallpaperShortcutDockMagnificationTitle = refs.shortcutDockMagnificationTitle;
      wallpaperShortcutDockMagnificationToggle = refs.shortcutDockMagnificationToggle;
      wallpaperShortcutColumnsControl = refs.shortcutColumnsControl;
      wallpaperShortcutColumnsLabel = refs.shortcutColumnsLabel;
      wallpaperShortcutColumnsSlider = refs.shortcutColumnsSlider;
      wallpaperShortcutSizeControl = refs.shortcutSizeControl;
      wallpaperShortcutSizeLabel = refs.shortcutSizeLabel;
      wallpaperShortcutSizeSlider = refs.shortcutSizeSlider;
      wallpaperShortcutSizeResetButton = refs.shortcutSizeResetButton;
      wallpaperShortcutGapControl = refs.shortcutGapControl;
      wallpaperShortcutGapLabel = refs.shortcutGapLabel;
      wallpaperShortcutGapSlider = refs.shortcutGapSlider;
      wallpaperShortcutGapResetButton = refs.shortcutGapResetButton;
      wallpaperAppearanceMoreSettingsLink = refs.moreSettingsLink;
      wallpaperAppearanceMoreSettingsText = refs.moreSettingsText;
      wallpaperOverlayLabel = refs.overlayLabel;
      wallpaperOverlaySlider = refs.overlaySlider;
      wallpaperEffectLabel = refs.effectLabel;
      wallpaperEffectInkToneControl = refs.effectInkToneControl;
      wallpaperEffectInkToneLabel = refs.effectInkToneLabel;
      wallpaperEffectInkToneOptions = refs.effectInkToneOptions;
      wallpaperEffectInkToneIndicator = refs.effectInkToneIndicator;
      wallpaperEffectStrengthControl = refs.effectStrengthControl;
      wallpaperEffectStrengthLabel = refs.effectStrengthLabel;
      wallpaperEffectSlider = refs.effectStrengthSlider;
      wallpaperEffectSizeControl = refs.effectSizeControl;
      wallpaperEffectSizeLabel = refs.effectSizeLabel;
      wallpaperEffectSizeSlider = refs.effectSizeSlider;
      wallpaperEffectSpacingControl = refs.effectSpacingControl;
      wallpaperEffectSpacingLabel = refs.effectSpacingLabel;
      wallpaperEffectSpacingSlider = refs.effectSpacingSlider;
      wallpaperEffectTextureControl = refs.effectTextureControl;
      wallpaperEffectTextureLabel = refs.effectTextureLabel;
      wallpaperEffectTextureSlider = refs.effectTextureSlider;
      wallpaperEffectCrtBloomControl = refs.effectCrtBloomControl;
      wallpaperEffectCrtBloomLabel = refs.effectCrtBloomLabel;
      wallpaperEffectCrtBloomSlider = refs.effectCrtBloomSlider;
      wallpaperEffectCrtRgbOffsetControl = refs.effectCrtRgbOffsetControl;
      wallpaperEffectCrtRgbOffsetLabel = refs.effectCrtRgbOffsetLabel;
      wallpaperEffectCrtRgbOffsetSlider = refs.effectCrtRgbOffsetSlider;
      wallpaperEffectCrtCurvatureControl = refs.effectCrtCurvatureControl;
      wallpaperEffectCrtCurvatureLabel = refs.effectCrtCurvatureLabel;
      wallpaperEffectCrtCurvatureSlider = refs.effectCrtCurvatureSlider;
      newtabFaviconTitle = refs.faviconTitle;
      newtabFaviconOptions = refs.faviconOptions;
      customWallpaperUploadTile = refs.uploadTile;
      customWallpaperInput = refs.customInput;
      wallpaperBody = refs.body;
      wallpaperBuiltInGrid = refs.builtInGrid;
      wallpaperLocalGrid = refs.localGrid;
      wallpaperModeSyncTitle = refs.modeSyncTitle;
      wallpaperModeSyncToggle = refs.modeSyncToggle;
      wallpaperModeTabs = refs.modeTabs;
      wallpaperModeTabsIndicator = refs.modeTabsIndicator;
      wallpaperLightModeTab = refs.lightModeTab;
      wallpaperDarkModeTab = refs.darkModeTab;
      wallpaperModeRow = refs.modeRow;
      wallpaperModeLabel = refs.modeLabel;
      wallpaperSourceLabel = refs.sourceLabel;
      wallpaperTabs = refs.tabs;
      wallpaperTabsIndicator = refs.tabsIndicator;
      wallpaperBuiltInTab = refs.builtInTab;
      wallpaperLocalTab = refs.localTab;
      wallpaperBingTab = refs.bingTab;
      wallpaperBingPanel = refs.bingPanel;
      wallpaperBingGrid = refs.bingItemsHost;
      wallpaperBingRefresh = refs.bingRefresh;
      wallpaperBingStatus = refs.bingStatus;
      wallpaperCuratedTab = refs.curatedTab;
      wallpaperCuratedPanel = refs.curatedPanel;
      wallpaperCuratedGrid = refs.curatedItemsHost;
      wallpaperCuratedRefresh = refs.curatedRefresh;
      wallpaperCuratedCategoryTabs = refs.curatedCategoryTabs;
      customWallpaperUrlTile = refs.urlTile;
      customWallpaperUrlForm = refs.urlForm;
      customWallpaperUrlInput = refs.urlInput;
      customWallpaperUrlSubmit = refs.urlSubmit;
      const quoteRuntime = options.getQuoteRuntime && options.getQuoteRuntime();
      if (quoteRuntime) quoteRuntime.bindSettings(refs, wallpaperViewController);
      bindPanelSectionDisclosure(refs.themeSectionTrigger, refs.themeSectionBody);
      bindPanelSectionDisclosure(refs.searchSectionTrigger, refs.searchSectionBody);
      bindPanelSectionDisclosure(refs.faviconSectionTrigger, refs.faviconSectionBody);
      return refs;
    }

    function bindReactWallpaperSlider(slider, getFallbackValue, persist, options) {
      if (!slider) {
        return;
      }
      const snapWhileDragging = !options || options.snapWhileDragging !== false;
      const supportsDynamicRange = Boolean(options && options.dynamicRange);
      slider.addEventListener('pointerdown', () => {
        setWallpaperActiveSlider(slider);
      });
      slider.addEventListener('pointerup', () => {
        clearWallpaperActiveSlider(slider);
      });
      slider.addEventListener('pointercancel', () => {
        clearWallpaperActiveSlider(slider);
      });
      slider.addEventListener('blur', () => {
        clearWallpaperActiveSlider(slider);
      });
      slider.addEventListener('input', () => {
        const fallbackValue = typeof getFallbackValue === 'function'
          ? getFallbackValue()
          : Number(slider.value);
        const rawValue = Number(slider.value);
        const dynamicRange = supportsDynamicRange && isDynamicWallpaperSlider(slider);
        const value = dynamicRange
          ? (Number.isFinite(rawValue) ? rawValue : Number(fallbackValue))
          : (wallpaperActiveSlider === slider && snapWhileDragging
            ? snapWallpaperOverlaySliderValue(slider.value)
            : normalizeWallpaperOverlayOpacity(slider.value, fallbackValue));
        if (String(value) !== slider.value) {
          slider.value = String(value);
        }
        persist(value);
      });
      if (supportsDynamicRange) {
        slider.addEventListener('change', () => {
          const value = Number(slider.value);
          if (ensureDynamicWallpaperSliderRange(slider, value, true)) {
            updateWallpaperSliderFill(slider, value);
            syncWallpaperSliderValueInput(slider);
          }
        });
      }
      bindWallpaperSliderValueBubble(slider);
      bindWallpaperSliderValueInput(slider);
    }

    function bindReactWallpaperPanel() {
      const refs = wallpaperViewController.getRefs();
      if (wallpaperReactPanelBound || !wallpaperPanel) {
        return;
      }
      wallpaperReactPanelBound = true;
      wallpaperPanel.addEventListener('scroll', () => {
        hideWallpaperSliderValueBubble(null, { force: true });
      }, { passive: true });
      const showAppearanceHelp = () => {
        showTopActionTooltip(
          wallpaperAppearanceInfoButton,
          t(
            'newtab_theme_scope_help',
            'Global: the default theme for all pages.\nNew Tab: applies only to the new tab page. Choose Follow "Global" to keep it in sync.'
          )
        );
      };
      wallpaperAppearanceInfoButton.addEventListener('mouseenter', showAppearanceHelp);
      wallpaperAppearanceInfoButton.addEventListener('mouseleave', hideTopActionTooltip);
      wallpaperAppearanceInfoButton.addEventListener('focus', showAppearanceHelp);
      wallpaperAppearanceInfoButton.addEventListener('blur', hideTopActionTooltip);
      if (wallpaperInputAutoFocusInfoButton) {
        const showInputAutoFocusHelp = () => {
          showTopActionTooltip(
            wallpaperInputAutoFocusInfoButton,
            t(
              'newtab_input_auto_focus_help',
              'If you prefer to use the browser’s native address bar, turn this option off. The extension URL will no longer appear in the address bar.'
            )
          );
        };
        wallpaperInputAutoFocusInfoButton.addEventListener('mouseenter', showInputAutoFocusHelp);
        wallpaperInputAutoFocusInfoButton.addEventListener('mouseleave', hideTopActionTooltip);
        wallpaperInputAutoFocusInfoButton.addEventListener('focus', showInputAutoFocusHelp);
        wallpaperInputAutoFocusInfoButton.addEventListener('blur', hideTopActionTooltip);
      }
      wallpaperAppearanceScopeTabs.querySelectorAll('[data-theme-scope]').forEach((button) => {
        button.addEventListener('click', () => {
          animateWallpaperAppearanceScopeChange(
            getThemeScope(),
            button.getAttribute('data-theme-scope')
          );
        });
      });
      wallpaperAppearanceOptions.querySelectorAll('[data-theme-mode]').forEach((button) => {
        button.addEventListener('click', () => {
          setThemeMode(button.getAttribute('data-theme-mode'));
        });
      });
      wallpaperAppearanceMoreSettingsLink.addEventListener('click', () => {
        wallpaperAppearanceMoreSettingsLink.setAttribute('href', buildAppearanceSettingsUrl());
      });
      wallpaperSearchWidthSlider.addEventListener('input', () => {
        persistSearchWidthFromSlider(wallpaperSearchWidthSlider.value, { final: false });
      });
      wallpaperSearchWidthSlider.addEventListener('change', () => {
        persistSearchWidthFromSlider(wallpaperSearchWidthSlider.value, { final: true });
      });
      bindWallpaperSliderValueBubble(wallpaperSearchWidthSlider);
      bindWallpaperSliderValueInput(wallpaperSearchWidthSlider);
      if (wallpaperInputAutoFocusToggle) {
        wallpaperInputAutoFocusToggle.addEventListener('change', () => {
          setInputAutoFocusEnabled(wallpaperInputAutoFocusToggle.checked);
          updateInputAutoFocusUi();
        });
      }
      if (wallpaperShortcutsAccordionTrigger) {
        wallpaperShortcutsAccordionTrigger.addEventListener('click', () => {
          if (!getShortcutsVisible()) {
            return;
          }
          setWallpaperShortcutsAccordionExpanded(!wallpaperShortcutsAccordionExpanded);
        });
      }
      if (wallpaperShortcutsToggle) {
        wallpaperShortcutsToggle.addEventListener('change', () => {
          setShortcutsVisible(wallpaperShortcutsToggle.checked, { persist: true });
          updateWallpaperShortcutsUi();
        });
      }
      if (wallpaperShortcutAddToggle) {
        wallpaperShortcutAddToggle.addEventListener('change', () => {
          setShortcutAddVisible(wallpaperShortcutAddToggle.checked, { persist: true });
          updateWallpaperShortcutsUi();
        });
      }
      if (wallpaperShortcutDockMagnificationToggle) {
        wallpaperShortcutDockMagnificationToggle.addEventListener('change', () => {
          setShortcutDockMagnificationEnabled(
            wallpaperShortcutDockMagnificationToggle.checked,
            { persist: true }
          );
          updateWallpaperShortcutsUi();
        });
      }
      if (wallpaperShortcutColumnsSlider) {
        wallpaperShortcutColumnsSlider.addEventListener('input', () => {
          persistShortcutColumnsFromSlider(wallpaperShortcutColumnsSlider.value, {
            final: false
          });
        });
        wallpaperShortcutColumnsSlider.addEventListener('change', () => {
          persistShortcutColumnsFromSlider(wallpaperShortcutColumnsSlider.value, {
            final: true
          });
        });
      }
      if (wallpaperShortcutColumnsSlider) {
        bindWallpaperSliderValueInput(wallpaperShortcutColumnsSlider);
      }
      if (wallpaperShortcutSizeSlider) {
        wallpaperShortcutSizeSlider.addEventListener('input', () => {
          persistShortcutSizeFromSlider(wallpaperShortcutSizeSlider.value, {
            final: false
          });
        });
        wallpaperShortcutSizeSlider.addEventListener('change', () => {
          persistShortcutSizeFromSlider(wallpaperShortcutSizeSlider.value, {
            final: true
          });
        });
        bindWallpaperSliderValueInput(wallpaperShortcutSizeSlider);
      }
      if (wallpaperShortcutSizeResetButton) {
        wallpaperShortcutSizeResetButton.addEventListener('click', () => {
          persistShortcutSizeFromSlider(
            getShortcutLayoutDefault(shortcutSizeConfig, 48, 80, 64),
            { final: true }
          );
          wallpaperShortcutSizeResetButton.blur();
        });
      }
      if (wallpaperShortcutGapSlider) {
        wallpaperShortcutGapSlider.addEventListener('input', () => {
          persistShortcutGapFromSlider(wallpaperShortcutGapSlider.value, {
            final: false
          });
        });
        wallpaperShortcutGapSlider.addEventListener('change', () => {
          persistShortcutGapFromSlider(wallpaperShortcutGapSlider.value, {
            final: true
          });
        });
        bindWallpaperSliderValueInput(wallpaperShortcutGapSlider);
      }
      if (wallpaperShortcutGapResetButton) {
        wallpaperShortcutGapResetButton.addEventListener('click', () => {
          persistShortcutGapFromSlider(
            getShortcutLayoutDefault(shortcutGapConfig, 0, 24, 4),
            { final: true }
          );
          wallpaperShortcutGapResetButton.blur();
        });
      }
      wallpaperEnabledToggle.addEventListener('change', () => {
        persistWallpaperEnabled(wallpaperEnabledToggle.checked);
      });
      if (wallpaperAccordionTrigger) {
        wallpaperAccordionTrigger.addEventListener('click', () => {
          if (!hasAnyWallpaperEnabled()) return;
          wallpaperSectionExpanded = !wallpaperSectionExpanded;
          updateWallpaperSelectionUi();
        });
      }
      customWallpaperInput.addEventListener('change', (event) => {
        const file = event && event.target && event.target.files
          ? event.target.files[0]
          : null;
        importCustomWallpaperFile(file);
      });
      wallpaperModeSyncToggle.addEventListener('change', () => {
        persistWallpaperModeConsistency(wallpaperModeSyncToggle.checked);
      });
      wallpaperLightModeTab.addEventListener('click', () => {
        setWallpaperActiveMode(NEWTAB_WALLPAPER_MODE_LIGHT);
      });
      wallpaperDarkModeTab.addEventListener('click', () => {
        setWallpaperActiveMode(NEWTAB_WALLPAPER_MODE_DARK);
      });
      wallpaperBuiltInTab.addEventListener('click', () => {
        setWallpaperActiveTab('built-in');
      });
      wallpaperLocalTab.addEventListener('click', () => {
        setWallpaperActiveTab('local');
      });
      if (wallpaperBingTab) wallpaperBingTab.addEventListener('click', () => setWallpaperActiveTab('bing'));
      if (wallpaperCuratedTab) wallpaperCuratedTab.addEventListener('click', () => setWallpaperActiveTab('curated'));
      if (wallpaperCuratedRefresh) {
        const showCuratedRefreshTooltip = () => showTopActionTooltip(wallpaperCuratedRefresh, t('newtab_curated_more', 'Show others'));
        wallpaperCuratedRefresh.addEventListener('click', showMoreCuratedWallpapers);
        wallpaperCuratedRefresh.addEventListener('mouseenter', showCuratedRefreshTooltip);
        wallpaperCuratedRefresh.addEventListener('mouseleave', hideTopActionTooltip);
        wallpaperCuratedRefresh.addEventListener('focus', showCuratedRefreshTooltip);
        wallpaperCuratedRefresh.addEventListener('blur', hideTopActionTooltip);
      }
      if (wallpaperCuratedCategoryTabs) {
        wallpaperCuratedCategoryTabs.querySelectorAll('[data-curated-category]').forEach((button) => {
          button.addEventListener('click', () => selectCuratedCategory(button.getAttribute('data-curated-category')));
        });
      }
      bindInfoButtonTooltip(refs.curatedDailyInfoButton, () => t(
        'newtab_curated_daily_hint',
        CURATED_DAILY_HINT
      ));
      if (refs.curatedDailyToggle) {
        refs.curatedDailyToggle.addEventListener('change', () => setCuratedDailyWallpaper(refs.curatedDailyToggle.checked));
      }
      renderCuratedTiles();
      bindCustomWallpaperUrlControls();
      if (wallpaperBingRefresh) {
        const showBingRefreshTooltip = () => showTopActionTooltip(wallpaperBingRefresh, t('newtab_bing_refresh', 'Refresh'));
        wallpaperBingRefresh.addEventListener('click', () => loadBingCatalog(true));
        wallpaperBingRefresh.addEventListener('mouseenter', showBingRefreshTooltip);
        wallpaperBingRefresh.addEventListener('mouseleave', hideTopActionTooltip);
        wallpaperBingRefresh.addEventListener('focus', showBingRefreshTooltip);
        wallpaperBingRefresh.addEventListener('blur', hideTopActionTooltip);
      }
      bindInfoButtonTooltip(refs.bingDailyInfoButton, () => t('newtab_bing_daily_hint', BING_DAILY_HINT));
      [refs.bingDailyRestore, refs.curatedDailyRestore].forEach((button) => {
        if (!button) return;
        bindInfoButtonTooltip(button, () => t('newtab_daily_restore', "Back to today's wallpaper"));
        button.addEventListener('click', () => {
          const dailyId = getWallpaperSelectionIdForUi();
          hideTopActionTooltip();
          if (REMOTE_CONTENT.isDailyWallpaperId(dailyId)) clearDailyWallpaperPick(dailyId);
        });
      });
      bindInfoButtonTooltip(refs.quoteInfoButton, () => t('newtab_quote_provider', 'Powered by Hitokoto'));
      if (refs.bingDailyToggle) refs.bingDailyToggle.addEventListener('change', () => {
        const daily = getWallpaperById(REMOTE_CONTENT.BING_DAILY_ID);
        if (refs.bingDailyToggle.checked) {
          clearDailyWallpaperPick(REMOTE_CONTENT.BING_DAILY_ID);
          selectBingWallpaper(REMOTE_CONTENT.BING_DAILY_ID);
        }
        else if (daily && daily.dailyId) selectBingWallpaper(daily.dailyId);
        // An unresolved daily photo shows the built-in default, so keep that one.
        else persistNewtabWallpaper(NEWTAB_WALLPAPER_DEFAULT_ID);
      });
      bindCustomWallpaperUploadTile(customWallpaperUploadTile);
      wallpaperBuiltInGrid.querySelectorAll('[data-wallpaper-id]').forEach((tile) => {
        bindWallpaperTileImagePreload(tile);
        tile.addEventListener('click', () => {
          persistNewtabWallpaper(tile.getAttribute('data-wallpaper-id'));
        });
      });
      updateWallpaperEffectOptionsUi(getWallpaperEffectPrefsForEditMode());
      wallpaperEffectInkToneOptions.querySelectorAll('[data-wallpaper-effect-ink-tone]').forEach((button) => {
        button.addEventListener('click', () => {
          persistWallpaperEffectPrefs({
            inkTone: button.getAttribute('data-wallpaper-effect-ink-tone')
          });
        });
      });
      bindReactWallpaperSlider(
        wallpaperOverlaySlider,
        getWallpaperOverlayOpacityForCurrentMode,
        (value) => persistWallpaperOverlayOpacity(getResolvedWallpaperOverlayMode(), value)
      );
      [
        {
          key: 'strength',
          resolveKey: (prefs) => prefs.type === 'crt' ? 'crtStrength' : 'strength',
          slider: wallpaperEffectSlider
        },
        {
          key: 'size',
          resolveKey: (prefs) => prefs.type === 'blocks' ? 'blockSize' : 'size',
          slider: wallpaperEffectSizeSlider
        },
        {
          key: 'spacing',
          slider: wallpaperEffectSpacingSlider
        },
        {
          key: 'texture',
          slider: wallpaperEffectTextureSlider
        },
        {
          key: 'crtBloom',
          slider: wallpaperEffectCrtBloomSlider
        },
        {
          key: 'crtRgbOffset',
          slider: wallpaperEffectCrtRgbOffsetSlider
        },
        {
          key: 'crtCurvature',
          slider: wallpaperEffectCrtCurvatureSlider
        },
      ].forEach((entry) => {
        bindReactWallpaperSlider(
          entry.slider,
          () => {
            const currentPrefs = getWallpaperEffectPrefsForEditMode();
            const key = typeof entry.resolveKey === 'function'
              ? entry.resolveKey(currentPrefs)
              : entry.key;
            if (currentPrefs.type === 'crt' && CRT_PARAMETER_PHYSICAL_MAX[key]) {
              return getCrtParameterPercent(key, currentPrefs[key]);
            }
            return currentPrefs[key];
          },
          (value) => {
            const currentPrefs = getWallpaperEffectPrefsForEditMode();
            const key = typeof entry.resolveKey === 'function'
              ? entry.resolveKey(currentPrefs)
              : entry.key;
            let persistedValue = value;
            if (currentPrefs.type === 'crt' && CRT_PARAMETER_PHYSICAL_MAX[key]) {
              persistedValue = getCrtParameterPhysicalValue(key, value);
            }
            persistWallpaperEffectPrefs({ [key]: persistedValue });
          },
          {
            dynamicRange: false,
            snapWhileDragging: entry.key === 'strength'
          }
        );
      });
      newtabFaviconOptions.querySelectorAll('[data-newtab-favicon-id]').forEach((tile) => {
        tile.addEventListener('click', () => {
          persistNewtabFavicon(tile.getAttribute('data-newtab-favicon-id'));
        });
      });
      if (topContentWeightSlider) {
        topContentWeightSlider.addEventListener('input', () => {
          persistTimeFontWeight(topContentWeightSlider.value);
        });
        bindWallpaperSliderValueBubble(topContentWeightSlider);
        bindWallpaperSliderValueInput(topContentWeightSlider);
      }
      if (topContentSecondsToggle) {
        topContentSecondsToggle.addEventListener('change', () => {
          persistTimeSecondsVisible(topContentSecondsToggle.checked);
        });
      }
      topContentTabs.querySelectorAll('[data-newtab-top-content]').forEach((button) => {
        button.addEventListener('click', () => {
          persistTopContentMode(button.getAttribute('data-newtab-top-content'));
        });
      });
    }

    function renderWallpaperPanel() {
      if (!wallpaperPanel || wallpaperPanelRendered) {
        return;
      }
      wallpaperPanelRendered = true;
      assignReactWallpaperViewRefs();
      bindReactWallpaperPanel();
      renderCustomWallpaperTiles();
      updateWallpaperLanguageStrings();
      syncWallpaperSourceTabToEditMode({ force: true });
      updateCustomWallpaperUploadTile();
      updateWallpaperSelectionUi();
      updateWallpaperModeControlsUi({ animate: false });
      updateWallpaperAppearanceSelectionUi();
      updateInputAutoFocusUi();
      updateWallpaperShortcutsUi();
      updateNewtabFaviconSelectionUi();
    }

    function openWallpaperPanel() {
      if (!wallpaperPanel || !wallpaperButton) {
        return;
      }
      renderWallpaperPanel();
      dismissWallpaperSourcesFeatureHint();
      wallpaperPanel.setAttribute('data-open', 'true');
      wallpaperButton.setAttribute('data-open', 'true');
      wallpaperButton.setAttribute('aria-expanded', 'true');
      if (wallpaperControl) {
        wallpaperControl.setAttribute('data-panel-open', 'true');
      }
      setWallpaperPanelOpenState(true);
      scheduleWallpaperPanelOpenTabIndicatorsRefresh();
      if (activeWallpaperTab === 'local') {
        loadCustomWallpapers();
      }
      if (activeWallpaperTab === 'bing') loadBingCatalog();
    }

    function closeWallpaperPanel(options) {
      if (!wallpaperPanel || !wallpaperButton) {
        return;
      }
      cancelWallpaperPanelActiveControls();
      hideWallpaperSliderValueBubble(null, { force: true });
      wallpaperViewController.closeOpenSelect();
      wallpaperPanel.setAttribute('data-open', 'false');
      wallpaperButton.setAttribute('data-open', 'false');
      wallpaperButton.setAttribute('aria-expanded', 'false');
      if (wallpaperControl) {
        wallpaperControl.setAttribute('data-panel-open', 'false');
      }
      setWallpaperPanelOpenState(false);
      if (options && options.restoreFocus) {
        try {
          wallpaperButton.focus({ preventScroll: true });
        } catch (e) {
          wallpaperButton.focus();
        }
      }
    }

    function toggleWallpaperPanel() {
      if (isWallpaperPanelOpen()) {
        closeWallpaperPanel();
        return;
      }
      openWallpaperPanel();
    }

    function createWallpaperControls() {
      wallpaperViewController = wallpaperView.createController({
        documentObj,
        model: createReactWallpaperViewModel()
      });
      wallpaperControl = wallpaperViewController.control;
      wallpaperButton = wallpaperViewController.button;
      wallpaperPanel = wallpaperViewController.panel;
      wallpaperButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        hideTopActionTooltip();
        toggleWallpaperPanel();
      });
      const showWallpaperButtonTooltip = () => {
        if (isWallpaperPanelOpen()) {
          hideTopActionTooltip();
          return;
        }
        showTopActionTooltip(wallpaperButton, getWallpaperButtonLabel(), {
          placement: 'top'
        });
      };
      wallpaperButton.addEventListener('mouseenter', showWallpaperButtonTooltip);
      wallpaperButton.addEventListener('mouseleave', hideTopActionTooltip);
      wallpaperButton.addEventListener('focus', showWallpaperButtonTooltip);
      wallpaperButton.addEventListener('blur', hideTopActionTooltip);
      inputAutoFocusReady.then(updateInputAutoFocusUi);
      window.addEventListener('resize', scheduleWallpaperPanelTabIndicatorsRefresh, { passive: true });
      window.addEventListener('resize', () => {
        hideWallpaperSliderValueBubble(null, { force: true });
      }, { passive: true });
      updateWallpaperLanguageStrings();
      updateWallpaperSelectionUi();
      createWallpaperSourcesFeatureHint();
    }

    function handleThemeModeChange() {
      if (!hasStoredWallpaperStateLoaded) {
        return;
      }
      if (currentWallpaperPrefs && (currentWallpaperPrefs.sameForModes || !isWallpaperPanelOpen())) {
        activeWallpaperMode = getResolvedWallpaperMode();
      }
      applyResolvedNewtabWallpaper();
      updateWallpaperOverlayControlUi();
      applyWallpaperEffectForResolvedMode();
      updateWallpaperModeControlsUi({ animate: false });
      syncWallpaperSourceTabToEditMode();
      updateWallpaperSelectionUi();
      scheduleWallpaperPanelTabIndicatorsRefresh();
    }

    function handleStorageChange(changes) {
      if (!changes) {
        return false;
      }
      let handled = false;
      if (changes[REMOTE_CONTENT.BING_DAILY_CACHE_KEY] && hasStoredWallpaperStateLoaded) {
        remoteClient.restoreWallpaper(REMOTE_CONTENT.BING_DAILY_ID).then(() => {
          if (getEffectiveWallpaperIdForMode(getResolvedWallpaperMode()) === REMOTE_CONTENT.BING_DAILY_ID) {
            applyResolvedNewtabWallpaper();
          }
          renderBingTiles();
        }).catch(() => {});
        handled = true;
      }
      if (changes[SETTINGS.ASSET_REVISION_STORAGE_KEY]) {
        refreshCustomWallpapers().then(() => loadStoredWallpaperState());
        handled = true;
      }
      if (changes[NEWTAB_WALLPAPER_OVERLAY_STORAGE_KEY]) {
        applyWallpaperOverlayOpacity(changes[NEWTAB_WALLPAPER_OVERLAY_STORAGE_KEY].newValue);
        handled = true;
      }
      const wallpaperStorageChanged = Boolean(
        (NEWTAB_LOCAL_WALLPAPER_STORAGE_KEY && changes[NEWTAB_LOCAL_WALLPAPER_STORAGE_KEY]) ||
        changes[NEWTAB_WALLPAPER_STORAGE_KEY] ||
        (NEWTAB_ONLINE_WALLPAPER_STORAGE_KEY && changes[NEWTAB_ONLINE_WALLPAPER_STORAGE_KEY]) ||
        (NEWTAB_LINK_WALLPAPERS_STORAGE_KEY && changes[NEWTAB_LINK_WALLPAPERS_STORAGE_KEY]) ||
        (NEWTAB_DAILY_WALLPAPER_PICKS_STORAGE_KEY && changes[NEWTAB_DAILY_WALLPAPER_PICKS_STORAGE_KEY])
      );
      if (wallpaperStorageChanged) {
        bingSelectionSeq += 1;
        const changeSeq = ++wallpaperStorageChangeSeq;
        loadStoredWallpaperState({
          shouldApply: () => changeSeq === wallpaperStorageChangeSeq
        });
        handled = true;
      }
      if (changes[NEWTAB_WALLPAPER_EFFECT_STORAGE_KEY]) {
        const raw = changes[NEWTAB_WALLPAPER_EFFECT_STORAGE_KEY].newValue;
        applyWallpaperEffectPrefs(raw);
        if (hasStoredWallpaperStateLoaded) {
          writeWallpaperPreloadCache();
        }
        const storedPrefs = getWallpaperEffectStorageValue();
        if (storageArea && raw && JSON.stringify(raw) !== JSON.stringify(storedPrefs)) {
          storageArea.set({ [NEWTAB_WALLPAPER_EFFECT_STORAGE_KEY]: storedPrefs });
        }
        handled = true;
      }
      if (NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY && changes[NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY]) {
        const raw = changes[NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY].newValue;
        const nextValue = normalizeNewtabTopContentMode(raw);
        applyTopContentMode(nextValue);
        if (storageArea && raw !== nextValue) {
          storageArea.set({ [NEWTAB_TOP_CONTENT_MODE_STORAGE_KEY]: nextValue });
        }
        handled = true;
      }
      if (NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY &&
          changes[NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY]) {
        const raw = changes[NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY].newValue;
        const nextValue = normalizeNewtabTimeFontWeight(raw);
        applyTimeFontWeight(nextValue);
        if (storageArea && raw !== nextValue) {
          storageArea.set({ [NEWTAB_TIME_FONT_WEIGHT_STORAGE_KEY]: nextValue });
        }
        handled = true;
      }
      if (NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY &&
          changes[NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY]) {
        const raw = changes[NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY].newValue;
        const nextValue = normalizeNewtabTimeSecondsVisible(raw);
        applyTimeSecondsVisible(nextValue);
        if (storageArea && raw !== nextValue) {
          storageArea.set({ [NEWTAB_TIME_SECONDS_VISIBLE_STORAGE_KEY]: nextValue });
        }
        handled = true;
      }
      if (NEWTAB_FAVICON_STORAGE_KEY && changes[NEWTAB_FAVICON_STORAGE_KEY]) {
        const raw = changes[NEWTAB_FAVICON_STORAGE_KEY].newValue;
        const nextId = normalizeNewtabFaviconId(raw);
        applyNewtabFavicon(nextId);
        if (storageArea && raw !== nextId) {
          writeStorageValue(storageArea, NEWTAB_FAVICON_STORAGE_KEY, nextId);
        }
        handled = true;
      }
      return handled;
    }

    function getControlElement() {
      return wallpaperControl;
    }

    function containsTarget(target) {
      if (!target) {
        return false;
      }
      if (wallpaperControl && (target === wallpaperControl || wallpaperControl.contains(target))) {
        return true;
      }
      return Boolean(wallpaperViewController && wallpaperViewController.containsSelectMenuTarget(target));
    }

    return {
      storageKeys,
      createControls: createWallpaperControls,
      getControlElement,
      containsTarget,
      closeOpenMenu: () => Boolean(wallpaperViewController &&
        wallpaperViewController.closeOpenSelect({ restoreFocus: true })) || closeCustomWallpaperUrlForm(),
      isPanelOpen: isWallpaperPanelOpen,
      closePanel: closeWallpaperPanel,
      updateLanguageStrings: updateWallpaperLanguageStrings,
      updateAppearanceSelectionUi: updateWallpaperAppearanceSelectionUi,
      updateSearchWidthUi: updateWallpaperSearchWidthControlUi,
      updateShortcutsUi: updateWallpaperShortcutsUi,
      updateInputAutoFocusUi,
      updateTopContentModeUi,
      updateTimeFontWeightUi,
      updateTimeSecondsVisibleUi,
      refreshCustomWallpapers,
      bootstrapInitialWallpaper,
      bootstrapInitialWallpaperOverlay,
      bootstrapInitialWallpaperEffect,
      waitForInitialWallpaperEffectVisual,
      bootstrapInitialNewtabFavicon,
      handleStorageChange,
      handleThemeModeChange,
      scheduleAdaptiveToneUpdate: scheduleWallpaperAdaptiveToneUpdate
    };
  }

  globalThis.LumnoNewtabWallpaper = {
    STORAGE_KEYS: DEFAULT_STORAGE_KEYS,
    WALLPAPER_EFFECT_MODE_STORAGE_VERSION,
    normalizeWallpaperEffectStoragePrefs,
    createWallpaperRuntime
  };
})();
