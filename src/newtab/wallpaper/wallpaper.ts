// The New Tab wallpaper runtime: wires the wallpaper, effect, adaptive tone
// and appearance panel parts in runtime/ together around one shared state.
import * as LumnoExtensionRoutes from '../../domain/extension-routes';
import * as SETTINGS from '../../domain/settings';
import type { StorageAreaLike } from '../../domain/storage-port';
import type { ToastTask } from '../../shared/ui/toast-screen';
import type { FeatureHintChromeApi } from '../../shared/ui/feature-hint-catalog';
import type { FormatMessage, ShowToast, Translate } from '../newtab-types';
import type { GlassTheme, ThemeScope } from '../react/wallpaper-panel/panel-model';
import type { QuoteRuntime } from '../top-content/quotes';
import type { AdaptiveToneTarget, ToneScheduleOptions } from './wallpaper-adaptive-tone';
import type { WallpaperEffectPrefs, WallpaperEffectStoragePrefs } from './wallpaper-effects';
import type { SearchWidthConfig, SliderConfig } from './runtime/panel-settings';
import type { CrtParameterKey } from './runtime/panel-state';
import type { SectionPanelSettings } from './runtime/panel-actions';
import type {
  CachedWallpaperImage,
  DebouncedSaver,
  WallpaperState
} from './runtime/wallpaper-runtime-types';
import * as LumnoFeatureHints from '../../shared/ui/feature-hints';
import * as REMOTE_CONTENT from '../remote-content';
import * as WALLPAPER_CUSTOM_WALLPAPERS from './runtime/custom-wallpapers';
import * as WALLPAPER_DAILY_WALLPAPERS from './runtime/daily-wallpapers';
import * as WALLPAPER_FAVICON_CHOOSER from './runtime/favicon-chooser';
import * as WALLPAPER_PANEL_ACTIONS from './runtime/panel-actions';
import * as WALLPAPER_PANEL_MOTION from './runtime/panel-motion';
import * as WALLPAPER_PANEL_SETTINGS from './runtime/panel-settings';
import * as WALLPAPER_PANEL_STATE from './runtime/panel-state';
import * as WALLPAPER_WALLPAPER_EFFECT_PREFS from './runtime/wallpaper-effect-prefs';
import * as WALLPAPER_WALLPAPER_OVERLAY from './runtime/wallpaper-overlay';
import * as WALLPAPER_WALLPAPER_SELECTION from './runtime/wallpaper-selection';
import * as WALLPAPER_WALLPAPER_SOURCES from './runtime/wallpaper-sources';
import * as WALLPAPER_WALLPAPER_STORAGE from './runtime/wallpaper-storage';
import * as WALLPAPER_WALLPAPER_VISUAL from './runtime/wallpaper-visual';
import * as WALLPAPER_ADAPTIVE_TONE from './wallpaper-adaptive-tone';
import * as WALLPAPER_EFFECTS from './wallpaper-effects';
import * as WALLPAPER_LOCAL_STORE from '../../shared/wallpaper-local-store';
import * as WALLPAPER_CACHES from '../../shared/wallpaper-caches';
import { readBootValue } from '../../platform/boot-handoff';
import { createWallpaperViewController } from '../react/wallpaper-view';
import { newtabFavicon, newtabWallpaperEffect, newtabWallpaperOverlay } from '../../domain/settings/newtab-wallpaper';
import { bingDailyCache } from '../../domain/settings/newtab-wallpaper';
import type { SettingsStore } from '../../platform/settings-store';
import type { SettingPreview } from '../setting-preview';
import { NEWTAB_TOP_CONTENT_SETTINGS } from '../../domain/settings/newtab-time';
import { NEWTAB_SHORTCUT_GRID_SETTINGS } from '../../domain/settings/newtab-shortcuts';
import { newtabSearchWidth, newtabWidthMode } from '../../domain/settings/newtab-page';
import { CRT_PARAMETER_PHYSICAL_MAX, NEWTAB_FAVICON_DEFAULT_ID, NEWTAB_WALLPAPER_EFFECT_DEFAULTS, NEWTAB_WALLPAPER_MODE_LIGHT, NEWTAB_WALLPAPER_OVERLAY_DEFAULTS } from './wallpaper-options';

function getCrtParameterPercent(key: CrtParameterKey, value: unknown): number {
  const physicalMax = CRT_PARAMETER_PHYSICAL_MAX[key];
  const number = Number(value);
  if (!Number.isFinite(physicalMax) || !Number.isFinite(number) || physicalMax <= 0) {
    return 0;
  }
  return Math.round(Math.max(0, Math.min(100, (number / physicalMax) * 100)));
}

function getCrtParameterPhysicalValue(key: CrtParameterKey, percent: unknown): number {
  const physicalMax = CRT_PARAMETER_PHYSICAL_MAX[key];
  const number = Number(percent);
  if (!Number.isFinite(physicalMax) || !Number.isFinite(number) || physicalMax <= 0) {
    return 0;
  }
  return Math.round((Math.max(0, Math.min(100, number)) / 100) * physicalMax * 1000) / 1000;
}

// For failures nothing on the page can recover from but that should not happen,
// such as IndexedDB refusing a read; expected ones (offline photo requests) are
// caught where they occur, with the reason.
function warnWallpaperFailure(message: string): (error: unknown) => void {
  return (error) => {
    console.warn(`[Lumno] ${message}`, error);
  };
}

// Runs once the next frame has painted: the first frame's callback still runs
// before that frame paints, so it takes two.
function afterNextPaint(windowObj: Window, callback: () => void): void {
  windowObj.requestAnimationFrame(() => {
    windowObj.requestAnimationFrame(callback);
  });
}

// One pending save per setting while a slider moves: each change restarts the
// wait, and a final change (the end of a drag, a typed value) saves at once.
function createDebouncedSaver(windowObj: Window, delayMs: number): DebouncedSaver {
  const timers = new Map<string, number>();
  return function save(key, write, options) {
    const pending = timers.get(key);
    if (pending !== undefined) {
      windowObj.clearTimeout(pending);
      timers.delete(key);
    }
    if (options && options.final) {
      write();
      return;
    }
    timers.set(key, windowObj.setTimeout(() => {
      timers.delete(key);
      write();
    }, delayMs));
  };
}

function normalizeSingleWallpaperEffectPrefs(value: unknown, inheritedVersion?: unknown): WallpaperEffectPrefs {
  return WALLPAPER_EFFECTS.normalizePrefs(value, inheritedVersion);
}

function normalizeWallpaperEffectStoragePrefs(value: unknown): WallpaperEffectStoragePrefs {
  return WALLPAPER_EFFECTS.normalizeStoragePrefs(value);
}

type StorageArea = Pick<StorageAreaLike, 'get' | 'set'>;

// Whether a layout change is only shown or also saved.
type PersistOptions = { persist: boolean };

// The extension API parts the runtime reads.
interface WallpaperChromeApi {
  runtime?: FeatureHintChromeApi['runtime'] & { getURL?: (path: string) => string };
  i18n?: { getUILanguage?: () => string };
  storage?: FeatureHintChromeApi['storage'];
}


// What the page hands the runtime: its storage and the settings the panel
// shows, read and written through the page.
interface WallpaperRuntimeOptions {
  documentObj?: Document;
  windowObj?: Window & typeof globalThis;
  chromeObj?: WallpaperChromeApi;
  extensionRoutes?: Pick<typeof LumnoExtensionRoutes, 'buildOptionsUrl'>;
  settings: SettingsStore;
  preview: SettingPreview;
  localWallpaperStorageArea?: StorageArea | null;
  t?: Translate;
  formatMessage?: FormatMessage;
  getThemeMode?: () => string;
  getEffectiveThemeMode?: () => string;
  getThemeScope?: () => string;
  getGlobalThemeMode?: () => string;
  setThemeMode?: (mode: string) => void;
  setThemeScope?: (scope: ThemeScope) => void;
  BroadcastChannel?: typeof BroadcastChannel;
  searchWidthConfig?: SearchWidthConfig;
  getSearchWidth?: () => unknown;
  setSearchWidth?: (width: number, options: PersistOptions) => void;
  shortcutColumnsConfig?: SliderConfig;
  shortcutSizeConfig?: SliderConfig;
  shortcutGapConfig?: SliderConfig;
  getShortcutsVisible?: () => unknown;
  setShortcutsVisible?: (visible: boolean, options: PersistOptions) => void;
  getShortcutAddVisible?: () => unknown;
  setShortcutAddVisible?: (visible: boolean, options: PersistOptions) => void;
  getShortcutDockMagnificationEnabled?: () => unknown;
  setShortcutDockMagnificationEnabled?: (enabled: boolean, options: PersistOptions) => void;
  getShortcutColumns?: () => unknown;
  setShortcutColumns?: (columns: number, options: PersistOptions) => void;
  getShortcutSize?: () => unknown;
  setShortcutSize?: (size: number, options: PersistOptions) => void;
  getShortcutGap?: () => unknown;
  setShortcutGap?: (gap: number, options: PersistOptions) => void;
  featureHints?: typeof LumnoFeatureHints;
  getInputAutoFocusEnabled?: () => unknown;
  setInputAutoFocusEnabled?: (enabled: boolean) => void;
  // Settles once the auto-focus setting is read.
  inputAutoFocusReady?: PromiseLike<unknown>;
  getGlassStyle?: () => string;
  setGlassStyle?: (value: string) => void;
  getGlassTheme?: () => unknown;
  setGlassTheme?: (value: GlassTheme) => void;
  // Feature hints stay hidden until this settles.
  featureHintVisibilityGate?: PromiseLike<unknown>;
  showToast?: ShowToast;
  beginToast?: (message: string) => ToastTask;
  showTopActionTooltip?: (anchor: HTMLElement, text: string, options?: { placement?: string }) => void;
  hideTopActionTooltip?: () => void;
  applyWordmarkThemeAppearance?: () => void;
  // The page's own adaptive tone targets.
  getAdaptiveToneTargets?: () => ReadonlyArray<AdaptiveToneTarget | null | undefined>;
  fetchRemoteContent?: (url: string, init: RequestInit) => Promise<Response>;
  getQuoteRuntime?: () => Pick<QuoteRuntime, 'bindSettings' | 'getProviderLabel' | 'updateLanguage'> | null | undefined;
  getSectionPanelSettings?: () => (SectionPanelSettings & { updateLanguage(): void }) | null | undefined;
}

function createWallpaperRuntime(options: WallpaperRuntimeOptions) {
  const documentObj = options.documentObj || globalThis.document;
  const windowObj = options.windowObj || globalThis.window;
  const document = documentObj;
  const window = windowObj;
  const chrome: WallpaperChromeApi = options.chromeObj || globalThis.chrome || {};
  const extensionRoutes = options.extensionRoutes || LumnoExtensionRoutes;
  const localWallpaperStorageArea = options.localWallpaperStorageArea || null;
  const t: Translate = typeof options.t === 'function'
    ? options.t
    : function(_key, fallback) { return fallback || ''; };
  const formatMessage: FormatMessage = typeof options.formatMessage === 'function'
    ? options.formatMessage
    : function(_key, fallback, params) {
      let text = fallback || '';
      const values = params || {};
      Object.keys(values).forEach((token) => {
        text = text.replace(new RegExp('\\{' + token + '\\}', 'g'), String(values[token]));
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
  const getGlobalThemeMode = typeof options.getGlobalThemeMode === 'function'
    ? options.getGlobalThemeMode
    : function() { return 'system'; };
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
  // New Tab passes LumnoNewtabLayout.SEARCH_WIDTH_CONFIG; these defaults mirror it.
  const searchWidthConfig: SearchWidthConfig = {
    min: 640,
    max: 1040,
    fallback: 920,
    snapPoints: [640, 720, 920, 1040],
    snapThreshold: 14,
    ...options.searchWidthConfig
  };
  const getSearchWidth = typeof options.getSearchWidth === 'function'
    ? options.getSearchWidth
    : function() { return searchWidthConfig.fallback; };
  const setSearchWidth = typeof options.setSearchWidth === 'function'
    ? options.setSearchWidth
    : function() {};
  const shortcutColumnsConfig: SliderConfig = {
    min: 4,
    max: 16,
    fallback: 10,
    ...options.shortcutColumnsConfig
  };
  const shortcutSizeConfig: SliderConfig = {
    min: 48,
    max: 112,
    fallback: 64,
    ...options.shortcutSizeConfig
  };
  const shortcutGapConfig: SliderConfig = {
    min: 0,
    max: 24,
    fallback: 4,
    ...options.shortcutGapConfig
  };
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
  const featureHints = options.featureHints || LumnoFeatureHints;
  const getInputAutoFocusEnabled = typeof options.getInputAutoFocusEnabled === 'function'
    ? options.getInputAutoFocusEnabled
    : function() { return false; };
  const setInputAutoFocusEnabled = typeof options.setInputAutoFocusEnabled === 'function'
    ? options.setInputAutoFocusEnabled
    : function() {};
  const inputAutoFocusReady: PromiseLike<unknown> = options.inputAutoFocusReady &&
    typeof options.inputAutoFocusReady.then === 'function'
    ? options.inputAutoFocusReady
    : Promise.resolve();
  const getGlassStyle = typeof options.getGlassStyle === 'function'
    ? options.getGlassStyle
    : function() { return 'none'; };
  const setGlassStyle = typeof options.setGlassStyle === 'function'
    ? options.setGlassStyle
    : function() {};
  const getGlassTheme = typeof options.getGlassTheme === 'function'
    ? options.getGlassTheme
    : function() { return 'follow'; };
  const setGlassTheme = typeof options.setGlassTheme === 'function'
    ? options.setGlassTheme
    : function() {};
  const featureHintVisibilityGate: PromiseLike<unknown> | null = options.featureHintVisibilityGate &&
    typeof options.featureHintVisibilityGate.then === 'function'
    ? options.featureHintVisibilityGate
    : null;
  const showToast: ShowToast = typeof options.showToast === 'function' ? options.showToast : function() {};
  const beginToast = typeof options.beginToast === 'function'
    ? options.beginToast
    : function(): ToastTask {
      return {
        update() {},
        done(result) { if (result) showToast(String(result), false); },
        fail(result) { if (result) showToast(String(result), true); },
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
  const getAdaptiveToneTargets = typeof options.getAdaptiveToneTargets === 'function'
    ? options.getAdaptiveToneTargets
    : function(): AdaptiveToneTarget[] { return []; };
  const localWallpaperStore = WALLPAPER_LOCAL_STORE.createWallpaperLocalStore({
    documentObj,
    windowObj
  });
  const wallpaperImageCache = typeof WALLPAPER_CACHES.createWallpaperImageCache === 'function'
    ? WALLPAPER_CACHES.createWallpaperImageCache({ windowObj })
    : null;
  // Without IndexedDB the tiles load from Picsum as before.
  const wallpaperThumbnailCache = typeof WALLPAPER_CACHES.createWallpaperThumbnailCache === 'function' &&
    typeof localWallpaperStore.buildTileThumbnail === 'function' && windowObj && windowObj.indexedDB
    ? WALLPAPER_CACHES.createWallpaperThumbnailCache({ windowObj })
    : null;
  // Pages without IndexedDB (some private windows) simply have no local copies;
  // any other failure of the stores is unexpected and worth a warning.
  function warnWallpaperStoreFailure(message: string): (error: unknown) => void {
    const warn = warnWallpaperFailure(message);
    return (error) => {
      if (windowObj && windowObj.indexedDB) {
        warn(error);
      }
    };
  }
  const remoteClient = REMOTE_CONTENT.createClient({
    storageArea: localWallpaperStorageArea,
    fetch: options.fetchRemoteContent,
    getLanguage: () => document.documentElement && document.documentElement.lang ||
      (chrome.i18n && chrome.i18n.getUILanguage ? chrome.i18n.getUILanguage() : 'en')
  });

  const cachedWallpaperImages = new Map<string, CachedWallpaperImage>();
  // Per daily slot (bing-daily, curated-daily-*): the cached copy it last showed. When the day's new
  // photo has no copy yet (after a weekend away, or Bing publishing overnight), the slot keeps
  // showing this one until the new copy is cached, instead of a network thumbnail the page waits on.
  const dailyWallpaperStandIns = new Map<string, CachedWallpaperImage>();
  // Whether each network image loaded on this page: 'loaded' or 'failed'. A new tab tries again.
  const wallpaperNetworkImageStates = new Map<string, 'loaded' | 'failed'>();

  let resolveInitialWallpaperReady: (() => void) | null = null;
  const initialWallpaperReadyPromise = new Promise<void>((resolve) => {
    resolveInitialWallpaperReady = resolve;
  });
  // Runtime state shared with the parts of this runtime in wallpaper/runtime/:
  // each receives this one object as `wallpaperState` and reads and writes
  // the same properties this function does.
  const wallpaperState: WallpaperState = {
    initialWallpaperApplied: false,
    hasStoredWallpaperStateLoaded: false,
    resolveInitialWallpaperReady,
    initialWallpaperReadyPromise,
    // The view owns the panel's elements; these three are the ones this runtime measures,
    // focuses and samples.
    wallpaperControl: null,
    wallpaperButton: null,
    wallpaperPanel: null,
    wallpaperViewController: null,
    wallpaperPanelActions: null,
    wallpaperPanelState: null,
    wallpaperPanelLayoutKey: '',
    wallpaperPanelOpen: false,
    wallpaperSourcesHintController: null,
    // While the theme options slide to another scope: the scope the tabs already show,
    // and the labels the options keep until they swap.
    pendingThemeScope: null,
    heldAppearanceModeLabels: null,
    saveSliderSetting: createDebouncedSaver(windowObj, 140),
    saveWallpaperStyleSetting: createDebouncedSaver(windowObj, 120),
    customWallpapers: [],
    customWallpaperCatalogLoaded: false,
    customWallpaperImporting: false,
    customWallpaperUrlFormOpen: false,
    customWallpaperUrlInvalid: false,
    // Bumped when a link is saved, so the view clears the field for the next one.
    customWallpaperUrlClearToken: 0,
    // Link wallpapers sync as { id, url, addedAt } entries. Their images, and museum prints, are
    // downscaled once per device and cached by photo ID.
    linkWallpapers: [],
    wallpaperStorageChangeSeq: 0,
    wallpaperVisualSeq: 0,
    appliedWallpaperVisualUrl: '',
    appliedWallpaperVisualActive: false,
    currentWallpaperOverlayOpacity: {
      light: NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.light,
      dark: NEWTAB_WALLPAPER_OVERLAY_DEFAULTS.dark
    },
    currentWallpaperEffectPrefsByMode: normalizeWallpaperEffectStoragePrefs(NEWTAB_WALLPAPER_EFFECT_DEFAULTS),
    currentAppliedWallpaperEffectPrefs: { ...NEWTAB_WALLPAPER_EFFECT_DEFAULTS },
    bingItems: [],
    bingSelectionSeq: 0,
    bingStatus: '',
    bingLoading: false,
    bingSelecting: false,
    onlineWallpaperMenuId: '',
    curatedCategory: REMOTE_CONTENT.CURATED_CATEGORIES[0] || '',
    // { day, picks: { [daily ID]: photo ID } }; picks from another date no longer count.
    dailyWallpaperPicks: { day: '', picks: {} },
    activeWallpaperTab: 'built-in',
    activeWallpaperMode: NEWTAB_WALLPAPER_MODE_LIGHT,
    currentWallpaperPrefs: null,
    currentLocalWallpaperOverrides: null,
    currentWallpaperId: '',
    currentNewtabFaviconId: NEWTAB_FAVICON_DEFAULT_ID,
    wallpaperEffects: null,
    wallpaperAdaptiveTone: null,
    // Per wallpaper (getWallpaperLuminanceKey): its average luminance (0–1), kept in the preload cache
    // so the next page's blur frost blends by it without decoding the full image first.
    wallpaperLuminances: new Map()
  };

  const {
    formatBingCopyright,
    getBingWallpaperLabel,
    loadBingCatalog,
    bindWallpaperPageShownListeners,
    normalizeDailyWallpaperPicks,
    getDailyWallpaperPick,
    getActiveDailyWallpaperId,
    setDailyWallpaperPick,
    clearDailyWallpaperPick,
    getCuratedTileItems,
    showCuratedPageOfSelection,
    getCuratedPhotoLabel,
    getCuratedPhotoMeta,
    getCuratedCategoryLabel,
    isCuratedDailyWallpaperActive,
    selectCuratedCategory,
    setCuratedMixCategory,
    showMoreCuratedWallpapers,
    setCuratedDailyWallpaper,
    selectBingWallpaper
  } = WALLPAPER_DAILY_WALLPAPERS.createDailyWallpapers({
    renderWallpaperPanelState: (...args) => renderWallpaperPanelState(...args),
    remoteClient,
    getEffectiveWallpaperIdForMode: (...args) => getEffectiveWallpaperIdForMode(...args),
    getResolvedWallpaperMode: (...args) => getResolvedWallpaperMode(...args),
    applyResolvedNewtabWallpaper: (...args) => applyResolvedNewtabWallpaper(...args),
    document,
    window,
    getWallpaperSelectionIdForUi: (...args) => getWallpaperSelectionIdForUi(...args),
    writeSetting: (...args) => writeSetting(...args),
    showToast,
    t,
    getWallpaperTileSelectionId: (...args) => getWallpaperTileSelectionId(...args),
    formatMessage,
    playWallpaperEnterMotion: (...args) => playWallpaperEnterMotion(...args),
    getWallpaperPanelRefs: (...args) => getWallpaperPanelRefs(...args),
    persistNewtabWallpaper: (...args) => persistNewtabWallpaper(...args),
    getWallpaperById: (...args) => getWallpaperById(...args),
    getWallpaperEditMode: (...args) => getWallpaperEditMode(...args),
    beginToast,
    wallpaperState
  });

  const {
    getWallpaperButtonLabel,
    createWallpaperPanelModel,
    getWallpaperAppearanceModeLabels,
    buildWallpaperPanelState,
    getWallpaperPanelLayoutKey,
    renderWallpaperPanelState,
    drawWallpaperPanelState,
    getWallpaperPanelRefs,
    isWallpaperTileSelected,
    getWallpaperStyleSliderValue
  } = WALLPAPER_PANEL_STATE.createPanelState({
    t,
    getNewtabFaviconUrl: (...args) => getNewtabFaviconUrl(...args),
    getSearchWidthSnapPoints: (...args) => getSearchWidthSnapPoints(...args),
    getSearchWidthPercent: (...args) => getSearchWidthPercent(...args),
    getShortcutColumnsTickValues: (...args) => getShortcutColumnsTickValues(...args),
    getShortcutColumnsPercent: (...args) => getShortcutColumnsPercent(...args),
    normalizeShortcutSizeValue: (...args) => normalizeShortcutSizeValue(...args),
    getShortcutLayoutPercent: (...args) => getShortcutLayoutPercent(...args),
    shortcutSizeConfig,
    normalizeShortcutGapValue: (...args) => normalizeShortcutGapValue(...args),
    shortcutGapConfig,
    getThemeScope,
    getRuntimeAssetUrl: (...args) => getRuntimeAssetUrl(...args),
    getGlobalThemeMode,
    getWallpaperAppearanceModeLabel: (...args) => getWallpaperAppearanceModeLabel(...args),
    getThemeMode,
    formatMessage,
    settings: options.settings,
    preview: options.preview,
    normalizeSearchWidthValue: (...args) => normalizeSearchWidthValue(...args),
    getSearchWidth,
    getSearchWidthMin: (...args) => getSearchWidthMin(...args),
    getSearchWidthMax: (...args) => getSearchWidthMax(...args),
    formatSearchWidthValue: (...args) => formatSearchWidthValue(...args),
    getInputAutoFocusEnabled,
    getShortcutsVisible,
    getShortcutSize,
    getShortcutGap,
    getShortcutAddVisible,
    getShortcutDockMagnificationEnabled,
    normalizeShortcutColumnsValue: (...args) => normalizeShortcutColumnsValue(...args),
    getShortcutColumns,
    getShortcutColumnsMin: (...args) => getShortcutColumnsMin(...args),
    getShortcutColumnsMax: (...args) => getShortcutColumnsMax(...args),
    getShortcutLayoutMin: (...args) => getShortcutLayoutMin(...args),
    getShortcutLayoutMax: (...args) => getShortcutLayoutMax(...args),
    getShortcutLayoutDefault: (...args) => getShortcutLayoutDefault(...args),
    getWallpaperThumbnailUrl: (...args) => getWallpaperThumbnailUrl(...args),
    getWallpaperDisplayName: (...args) => getWallpaperDisplayName(...args),
    getLinkWallpaperById: (...args) => getLinkWallpaperById(...args),
    isLocalWallpaperLibraryFull: (...args) => isLocalWallpaperLibraryFull(...args),
    getWallpaperById: (...args) => getWallpaperById(...args),
    formatBingCopyright,
    getBingWallpaperLabel,
    remoteClient,
    wallpaperThumbnailCache,
    fetchCustomWallpaperFile: (...args) => fetchCustomWallpaperFile(...args),
    localWallpaperStore,
    warnWallpaperStoreFailure,
    getCuratedPhotoLabel,
    isCuratedDailyWallpaperActive,
    getCuratedCategoryLabel,
    getCuratedPhotoMeta,
    getCuratedTileItems,
    getWallpaperEffectPrefsForEditMode: (...args) => getWallpaperEffectPrefsForEditMode(...args),
    getWallpaperEffectControlVisibility: (...args) => getWallpaperEffectControlVisibility(...args),
    getCrtParameterPercent,
    getWallpaperEffectLabel: (...args) => getWallpaperEffectLabel(...args),
    getWallpaperEffectInkToneForUi: (...args) => getWallpaperEffectInkToneForUi(...args),
    getWallpaperEffectInkToneLabel: (...args) => getWallpaperEffectInkToneLabel(...args),
    getWallpaperEffectStrengthLabel: (...args) => getWallpaperEffectStrengthLabel(...args),
    getWallpaperEffectSizeLabel: (...args) => getWallpaperEffectSizeLabel(...args),
    getWallpaperEffectSpacingLabel: (...args) => getWallpaperEffectSpacingLabel(...args),
    clampNumber: (...args) => clampNumber(...args),
    getWallpaperEffectTextureLabel: (...args) => getWallpaperEffectTextureLabel(...args),
    hasAnyWallpaperEnabled: (...args) => hasAnyWallpaperEnabled(...args),
    getWallpaperSelectionIdForUi: (...args) => getWallpaperSelectionIdForUi(...args),
    getWallpaperTileSelectionId: (...args) => getWallpaperTileSelectionId(...args),
    normalizeWallpaperMode: (...args) => normalizeWallpaperMode(...args),
    getWallpaperModeLabel: (...args) => getWallpaperModeLabel(...args),
    getWallpaperLocalPath: (...args) => getWallpaperLocalPath(...args),
    getWallpaperOverlayOpacityForCurrentMode: (...args) => getWallpaperOverlayOpacityForCurrentMode(...args),
    getGlassStyle,
    getGlassTheme,
    buildNewtabFaviconState: (...args) => buildNewtabFaviconState(...args),
    animateWallpaperPanelResize: (...args) => animateWallpaperPanelResize(...args),
    snapWallpaperOverlaySliderValue: (...args) => snapWallpaperOverlaySliderValue(...args),
    normalizeWallpaperOverlayOpacity: (...args) => normalizeWallpaperOverlayOpacity(...args),
    document,
    extensionRoutes,
    chrome,
    window,
    wallpaperState
  });

  const {
    isLocalWallpaperLibraryFull,
    showLocalWallpaperLimitToast,
    importCustomWallpaperFile,
    fetchCustomWallpaperFile,
    setCustomWallpaperUrlFormOpen,
    isLinkWallpaperId,
    setLinkWallpapers,
    getLinkWallpaperById,
    takePreloadedCustomWallpaper,
    readCachedWallpaperImages,
    cacheShownWallpaperImages,
    getNextLocalDayTimestamp,
    getUpcomingDailyWallpaper,
    cacheListedLinkWallpapers,
    isOnlineWallpaperMenuNode,
    closeOnlineWallpaperMenu,
    openOnlineWallpaperMenu,
    submitCustomWallpaperUrl,
    closeCustomWallpaperUrlForm,
    deleteCustomWallpaper
  } = WALLPAPER_CUSTOM_WALLPAPERS.createCustomWallpapers({
    showToast,
    formatMessage,
    renderWallpaperPanelState,
    beginToast,
    t,
    buildCustomWallpaperRecordFromFile: (...args) => buildCustomWallpaperRecordFromFile(...args),
    writeCustomWallpaperRecord: (...args) => writeCustomWallpaperRecord(...args),
    normalizeCustomWallpaperRecord: (...args) => normalizeCustomWallpaperRecord(...args),
    persistNewtabWallpaper: (...args) => persistNewtabWallpaper(...args),
    options,
    windowObj,
    getCachedWallpaperImage: (...args) => getCachedWallpaperImage(...args),
    cachedWallpaperImages,
    mergeCustomWallpaperRecords: (...args) => mergeCustomWallpaperRecords(...args),
    wallpaperImageCache,
    warnWallpaperStoreFailure,
    applyResolvedNewtabWallpaper: (...args) => applyResolvedNewtabWallpaper(...args),
    getEffectiveWallpaperIdForMode: (...args) => getEffectiveWallpaperIdForMode(...args),
    getWallpaperById: (...args) => getWallpaperById(...args),
    window,
    writeWallpaperPreloadCache: (...args) => writeWallpaperPreloadCache(...args),
    waitForDocumentLoad: (...args) => waitForDocumentLoad(...args),
    getShownWallpaperCopy: (...args) => getShownWallpaperCopy(...args),
    dailyWallpaperStandIns,
    writeSetting: (...args) => writeSetting(...args),
    hideTopActionTooltip,
    getWritableWallpaperPrefs: (...args) => getWritableWallpaperPrefs(...args),
    setWallpaperPrefs: (...args) => setWallpaperPrefs(...args),
    getWritableLocalWallpaperOverrides: (...args) => getWritableLocalWallpaperOverrides(...args),
    writeCurrentWallpaperPrefs: (...args) => writeCurrentWallpaperPrefs(...args),
    remoteClient,
    loadCustomWallpapers: (...args) => loadCustomWallpapers(...args),
    document,
    getWallpaperPanelRefs,
    getCustomWallpaperById: (...args) => getCustomWallpaperById(...args),
    deleteCustomWallpaperRecord: (...args) => deleteCustomWallpaperRecord(...args),
    writeLocalWallpaperValue: (...args) => writeLocalWallpaperValue(...args),
    buildLocalWallpaperStorageValue: (...args) => buildLocalWallpaperStorageValue(...args),
    wallpaperState
  });

  const {
    normalizeWallpaperMode,
    getDefaultWallpaperPrefs,
    getDefaultLocalWallpaperOverrides,
    cloneWallpaperPrefs,
    cloneLocalWallpaperOverrides,
    isCustomWallpaperId,
    getCustomWallpaperById,
    getWallpaperById,
    normalizeNewtabWallpaperId,
    getWallpaperLocalPath,
    getWallpaperRuntimePath,
    getCachedWallpaperImage,
    getShownWallpaperCopy,
    getWallpaperImageUrl,
    isNetworkWallpaperImageUrl,
    getDisplayedWallpaperImageUrl,
    getWallpaperSample,
    getWallpaperThumbnailUrl,
    getWallpaperDisplayName
  } = WALLPAPER_WALLPAPER_SOURCES.createWallpaperSources({
    localWallpaperStore,
    isLinkWallpaperId,
    getLinkWallpaperById,
    getDailyWallpaperPick,
    remoteClient,
    cachedWallpaperImages,
    dailyWallpaperStandIns,
    chrome,
    wallpaperNetworkImageStates,
    t,
    wallpaperState
  });
  const wallpaperEffectPreload = readBootValue('wallpaperEffectPreload') || null;


  const {
    finalizeInitialWallpaper,
    persistTopContentMode,
    persistTimeFontWeight,
    persistTimeFontSizeFromSlider,
    persistTimeOpacityFromSlider,
    persistTimeInk,
    persistTimeFont,
    persistTimeSecondsVisible,
    persistTime12Hour,
    getWallpaperAppearanceOptionButtons,
    getWallpaperAppearanceOptionMotionElement,
    getSearchWidthMin,
    getSearchWidthMax,
    normalizeSearchWidthValue,
    getSearchWidthSnapPoints,
    getSearchWidthPercent,
    formatSearchWidthValue,
    persistSearchWidthFromSlider,
    getShortcutColumnsMin,
    getShortcutColumnsMax,
    normalizeShortcutColumnsValue,
    getShortcutColumnsTickValues,
    getShortcutColumnsPercent,
    persistShortcutColumnsFromSlider,
    getShortcutLayoutMin,
    getShortcutLayoutMax,
    getShortcutLayoutDefault,
    getShortcutLayoutPercent,
    normalizeShortcutSizeValue,
    normalizeShortcutGapValue,
    persistShortcutSizeFromSlider,
    persistShortcutGapFromSlider
  } = WALLPAPER_PANEL_SETTINGS.createPanelSettings({
    renderWallpaperPanelState,
    settings: options.settings,
    preview: options.preview,
    getWallpaperPanelRefs,
    searchWidthConfig,
    setSearchWidth,
    shortcutColumnsConfig,
    setShortcutColumns,
    shortcutSizeConfig,
    shortcutGapConfig,
    setShortcutSize,
    setShortcutGap,
    wallpaperState
  });

  const {
    primeWallpaperImage,
    loadCustomWallpapers,
    refreshCustomWallpapers,
    mergeCustomWallpaperRecords,
    applyResolvedNewtabWallpaper,
    loadStoredWallpaperState,
    bootstrapInitialWallpaper,
    persistWallpaperEnabled,
    persistWallpaperModeConsistency,
    persistNewtabWallpaper
  } = WALLPAPER_WALLPAPER_SELECTION.createWallpaperSelection({
    getWallpaperById,
    waitForWallpaperImageReady: (...args) => waitForWallpaperImageReady(...args),
    getWallpaperImageUrl,
    readCachedWallpaperImages,
    readCustomWallpaperRecords: (...args) => readCustomWallpaperRecords(...args),
    renderWallpaperPanelState,
    cacheListedLinkWallpapers,
    normalizeCustomWallpaperRecord: (...args) => normalizeCustomWallpaperRecord(...args),
    normalizeNewtabWallpaperId,
    normalizeWallpaperMode,
    getResolvedWallpaperMode: (...args) => getResolvedWallpaperMode(...args),
    writeWallpaperPreloadCache: (...args) => writeWallpaperPreloadCache(...args),
    applyWallpaperVisualState: (...args) => applyWallpaperVisualState(...args),
    refreshWallpaperAdaptiveSampler,
    scheduleWallpaperVisualRefresh: (...args) => scheduleWallpaperVisualRefresh(...args),
    finalizeInitialWallpaper,
    getDisplayedWallpaperImageUrl,
    createWallpaperTransitionLayer: (...args) => createWallpaperTransitionLayer(...args),
    releaseWallpaperTransitionLayer: (...args) => releaseWallpaperTransitionLayer(...args),
    getEffectiveWallpaperIdForMode: (...args) => getEffectiveWallpaperIdForMode(...args),
    cacheShownWallpaperImages,
    resolveSyncedWallpaperValue: (...args) => resolveSyncedWallpaperValue(...args),
    resolveLocalWallpaperOverride: (...args) => resolveLocalWallpaperOverride(...args),
    applyLocalWallpaperMigrations: (...args) => applyLocalWallpaperMigrations(...args),
    setWallpaperPrefs: (...args) => setWallpaperPrefs(...args),
    bindWallpaperPageShownListeners,
    synchronizeWallpaperEffectPrefsWithWallpaperModes: (...args) => synchronizeWallpaperEffectPrefsWithWallpaperModes(...args),
    applyWallpaperEffectForResolvedMode: (...args) => applyWallpaperEffectForResolvedMode(...args),
    syncWallpaperSourceTabToEditMode: (...args) => syncWallpaperSourceTabToEditMode(...args),
    writeSyncedWallpaperValue: (...args) => writeSyncedWallpaperValue(...args),
    getWallpaperStorageRawIds: (...args) => getWallpaperStorageRawIds(...args),
    isOnlineWallpaperId: (...args) => isOnlineWallpaperId(...args),
    writeLocalWallpaperValue: (...args) => writeLocalWallpaperValue(...args),
    buildLocalWallpaperStorageValue: (...args) => buildLocalWallpaperStorageValue(...args),
    settings: options.settings,
    getWallpaperEffectStorageValue: (...args) => getWallpaperEffectStorageValue(...args),
    readStoredSetting: (...args) => readStoredSetting(...args),
    normalizeDailyWallpaperPicks,
    mergeOnlineWallpaperValue: (...args) => mergeOnlineWallpaperValue(...args),
    setLinkWallpapers,
    isLinkWallpaperId,
    takePreloadedCustomWallpaper,
    getStoredCustomWallpaperIds: (...args) => getStoredCustomWallpaperIds(...args),
    hasLoadedStoredCustomWallpaper: (...args) => hasLoadedStoredCustomWallpaper(...args),
    readCustomWallpaperRecordsByIds: (...args) => readCustomWallpaperRecordsByIds(...args),
    warnWallpaperStoreFailure,
    getDailyWallpaperPick,
    remoteClient,
    getCachedWallpaperImage,
    dailyWallpaperStandIns,
    window,
    getWritableWallpaperPrefs: (...args) => getWritableWallpaperPrefs(...args),
    getWritableLocalWallpaperOverrides: (...args) => getWritableLocalWallpaperOverrides(...args),
    writeCurrentWallpaperPrefs: (...args) => writeCurrentWallpaperPrefs(...args),
    isCustomWallpaperId,
    getWallpaperEffectPrefsForEditMode: (...args) => getWallpaperEffectPrefsForEditMode(...args),
    getWallpaperModePreferenceOrder: (...args) => getWallpaperModePreferenceOrder(...args),
    hasAnyWallpaperEnabled: (...args) => hasAnyWallpaperEnabled(...args),
    getFirstEnabledWallpaperIdForModes: (...args) => getFirstEnabledWallpaperIdForModes(...args),
    getCopyableWallpaperLocalOverrideForId: (...args) => getCopyableWallpaperLocalOverrideForId(...args),
    setSharedWallpaperEffectPrefs: (...args) => setSharedWallpaperEffectPrefs(...args),
    getWallpaperEditMode: (...args) => getWallpaperEditMode(...args),
    getWallpaperEffectPrefsForMode: (...args) => getWallpaperEffectPrefsForMode(...args),
    getWallpaperLocalOverrideForMode: (...args) => getWallpaperLocalOverrideForMode(...args),
    wallpaperState
  });

  const {
    animateWallpaperPanelResize,
    setWallpaperActiveTab,
    syncWallpaperSourceTabToEditMode,
    setWallpaperActiveMode,
    isWallpaperPanelOpen,
    setWallpaperPanelOpenState,
    getWallpaperAppearanceModeLabel,
    shouldReduceMotion,
    playWallpaperEnterMotion,
    animateWallpaperAppearanceScopeChange
  } = WALLPAPER_PANEL_MOTION.createPanelMotion({
    window,
    normalizeWallpaperSourceTab: (...args) => normalizeWallpaperSourceTab(...args),
    renderWallpaperPanelState,
    loadCustomWallpapers,
    loadBingCatalog,
    getWallpaperSelectionIdForUi: (...args) => getWallpaperSelectionIdForUi(...args),
    getWallpaperById,
    showCuratedPageOfSelection,
    getWallpaperSourceTabForId: (...args) => getWallpaperSourceTabForId(...args),
    normalizeWallpaperMode,
    document,
    t,
    getThemeScope,
    getWallpaperAppearanceOptionButtons,
    getWallpaperAppearanceOptionMotionElement,
    getWallpaperPanelRefs,
    afterNextPaint,
    setThemeScope,
    getWallpaperAppearanceModeLabels,
    wallpaperState
  });

  const {
    getWallpaperEffectPrefsForMode,
    getWallpaperEffectPrefsForEditMode,
    getWallpaperEffectStorageValue,
    setSharedWallpaperEffectPrefs,
    synchronizeWallpaperEffectPrefsWithWallpaperModes,
    getWallpaperEffectInkToneForUi,
    getWallpaperEffectInkToneLabel,
    getWallpaperEffectLabel,
    applyWallpaperEffectForResolvedMode,
    applyWallpaperEffectPrefs,
    getWallpaperEffectControlVisibility,
    getWallpaperEffectStrengthLabel,
    getWallpaperEffectSizeLabel,
    getWallpaperEffectSpacingLabel,
    getWallpaperEffectTextureLabel,
    persistWallpaperEffectPrefs,
    bootstrapInitialWallpaperEffect,
    waitForInitialWallpaperEffectVisual,
    waitForInitialWallpaperTone
  } = WALLPAPER_WALLPAPER_EFFECT_PREFS.createWallpaperEffectPrefs({
    normalizeSingleWallpaperEffectPrefs,
    normalizeWallpaperMode,
    getWallpaperEditMode: (...args) => getWallpaperEditMode(...args),
    getResolvedWallpaperMode: (...args) => getResolvedWallpaperMode(...args),
    normalizeWallpaperEffectStoragePrefs,
    t,
    createWallpaperTransitionLayer: (...args) => createWallpaperTransitionLayer(...args),
    document,
    releaseWallpaperTransitionLayer: (...args) => releaseWallpaperTransitionLayer(...args),
    renderWallpaperPanelState,
    writeWallpaperPreloadCache: (...args) => writeWallpaperPreloadCache(...args),
    settings: options.settings,
    window,
    wallpaperState
  });

  const {
    normalizeWallpaperOverlayOpacity,
    snapWallpaperOverlaySliderValue,
    getResolvedWallpaperOverlayMode,
    getWallpaperOverlayOpacityForCurrentMode,
    getWallpaperOverlayStopPercent,
    applyWallpaperOverlayOpacity,
    persistWallpaperOverlayOpacity,
    bootstrapInitialWallpaperOverlay
  } = WALLPAPER_WALLPAPER_OVERLAY.createWallpaperOverlay({
    document,
    clampNumber: (...args) => clampNumber(...args),
    renderWallpaperPanelState,
    scheduleWallpaperAdaptiveToneUpdate,
    writeWallpaperPreloadCache: (...args) => writeWallpaperPreloadCache(...args),
    settings: options.settings,
    wallpaperState
  });

  const {
    clampNumber,
    getWallpaperOverlayAlphaAtViewportY,
    getWallpaperAdaptiveToneTargets,
    getRuntimeAssetUrl,
    takePreloadedDecodedImage,
    waitForWallpaperImageReady,
    waitForDocumentLoad,
    createWallpaperTransitionLayer,
    releaseWallpaperTransitionLayer,
    applyWallpaperVisualState,
    scheduleWallpaperVisualRefresh
  } = WALLPAPER_WALLPAPER_VISUAL.createWallpaperVisual({
    document,
    window,
    getResolvedWallpaperOverlayMode,
    getWallpaperOverlayOpacityForCurrentMode,
    getWallpaperOverlayStopPercent,
    getAdaptiveToneTargets,
    chrome,
    windowObj,
    isNetworkWallpaperImageUrl,
    wallpaperNetworkImageStates,
    shouldReduceMotion,
    getDisplayedWallpaperImageUrl,
    getWallpaperSample,
    wallpaperEffectPreload,
    refreshWallpaperAdaptiveSampler,
    afterNextPaint,
    wallpaperState
  });

  const {
    readStoredSetting,
    writeSetting,
    isOnlineWallpaperId,
    mergeOnlineWallpaperValue,
    writeSyncedWallpaperValue,
    writeLocalWallpaperValue,
    getWallpaperStorageRawIds,
    getStoredCustomWallpaperIds,
    hasLoadedStoredCustomWallpaper,
    buildLocalWallpaperStorageValue,
    resolveSyncedWallpaperValue,
    resolveLocalWallpaperOverride,
    getWallpaperLocalOverrideForMode,
    getEffectiveWallpaperIdForMode,
    getResolvedWallpaperMode,
    getWallpaperEditMode,
    getWallpaperTileSelectionId,
    getWallpaperSelectionIdForUi,
    hasAnyWallpaperEnabled,
    normalizeWallpaperSourceTab,
    getWallpaperSourceTabForId,
    getWallpaperModeLabel,
    getWallpaperModePreferenceOrder,
    getFirstEnabledWallpaperIdForModes,
    getCopyableWallpaperLocalOverrideForId,
    setWallpaperPrefs,
    getWritableWallpaperPrefs,
    getWritableLocalWallpaperOverrides,
    applyLocalWallpaperMigrations,
    writeCurrentWallpaperPrefs,
    readWallpaperPreloadLuminances,
    rememberWallpaperLuminance,
    writeWallpaperPreloadCache,
    normalizeCustomWallpaperRecord,
    readCustomWallpaperRecords,
    readCustomWallpaperRecordsByIds,
    writeCustomWallpaperRecord,
    deleteCustomWallpaperRecord,
    buildCustomWallpaperRecordFromFile
  } = WALLPAPER_WALLPAPER_STORAGE.createWallpaperStorage({
    isLinkWallpaperId,
    settings: options.settings,
    showToast,
    t,
    normalizeWallpaperMode,
    isCustomWallpaperId,
    getCustomWallpaperById,
    cloneWallpaperPrefs,
    cloneLocalWallpaperOverrides,
    normalizeNewtabWallpaperId,
    getDefaultLocalWallpaperOverrides,
    getDefaultWallpaperPrefs,
    document,
    getWallpaperById,
    getCachedWallpaperImage,
    getShownWallpaperCopy,
    getUpcomingDailyWallpaper,
    getNextLocalDayTimestamp,
    getWallpaperRuntimePath,
    remoteClient,
    window,
    getDisplayedWallpaperImageUrl,
    getWallpaperImageUrl,
    getWallpaperSample,
    getWallpaperOverlayStopPercent,
    getEffectiveThemeMode,
    getWallpaperEffectStorageValue,
    localWallpaperStore,
    wallpaperState
  });

  const {
    normalizeNewtabFaviconId,
    getNewtabFaviconUrl,
    applyNewtabFavicon,
    persistNewtabFavicon,
    bootstrapInitialNewtabFavicon,
    buildNewtabFaviconState
  } = WALLPAPER_FAVICON_CHOOSER.createFaviconChooser({
    t,
    getRuntimeAssetUrl,
    window,
    BroadcastChannelCtor,
    document,
    renderWallpaperPanelState,
    writeSetting,
    showToast,
    readStoredSetting,
    formatMessage,
    wallpaperState
  });

  const {
    createWallpaperPanelActions,
    createWallpaperSourcesFeatureHint
  } = WALLPAPER_PANEL_ACTIONS.createPanelActions({
    settings: options.settings,
    getWallpaperEffectPrefsForEditMode,
    getCrtParameterPercent,
    getWallpaperStyleSliderValue,
    persistWallpaperEffectPrefs,
    getCrtParameterPhysicalValue,
    getWallpaperById,
    clearDailyWallpaperPick,
    selectBingWallpaper,
    persistNewtabWallpaper,
    showTopActionTooltip,
    hideTopActionTooltip,
    isWallpaperPanelOpen,
    getWallpaperButtonLabel,
    animateWallpaperAppearanceScopeChange,
    getThemeScope,
    setThemeMode,
    persistSearchWidthFromSlider,
    setInputAutoFocusEnabled,
    renderWallpaperPanelState,
    setGlassStyle,
    setGlassTheme,
    persistTopContentMode,
    persistTimeFontWeight,
    persistTimeFontSizeFromSlider,
    persistTimeOpacityFromSlider,
    persistTimeInk,
    persistTimeFont,
    persistTimeSecondsVisible,
    persistTime12Hour,
    setShortcutsVisible,
    setShortcutAddVisible,
    setShortcutDockMagnificationEnabled,
    persistShortcutColumnsFromSlider,
    persistShortcutSizeFromSlider,
    persistShortcutGapFromSlider,
    getShortcutLayoutDefault,
    shortcutSizeConfig,
    shortcutGapConfig,
    persistWallpaperEnabled,
    persistWallpaperModeConsistency,
    setWallpaperActiveMode,
    setWallpaperActiveTab,
    primeWallpaperImage,
    deleteCustomWallpaper,
    importCustomWallpaperFile,
    isLocalWallpaperLibraryFull,
    showLocalWallpaperLimitToast,
    setCustomWallpaperUrlFormOpen,
    openOnlineWallpaperMenu,
    submitCustomWallpaperUrl,
    getWallpaperSelectionIdForUi,
    loadBingCatalog,
    isWallpaperTileSelected,
    setCuratedDailyWallpaper,
    selectCuratedCategory,
    setCuratedMixCategory,
    showMoreCuratedWallpapers,
    getActiveDailyWallpaperId,
    setDailyWallpaperPick,
    getResolvedWallpaperOverlayMode,
    persistWallpaperOverlayOpacity,
    getWallpaperOverlayOpacityForCurrentMode,
    persistNewtabFavicon,
    options,
    document,
    featureHints,
    window,
    chrome,
    featureHintVisibilityGate,
    t,
    syncWallpaperSourceTabToEditMode,
    getResolvedWallpaperMode,
    setWallpaperPanelOpenState,
    loadCustomWallpapers,
    closeWallpaperPanel,
    wallpaperState
  });

  function cancelWallpaperPanelActiveControls(): void {
    const activeElement = document.activeElement;
    if (!activeElement || !wallpaperState.wallpaperPanel || !wallpaperState.wallpaperPanel.contains(activeElement)) {
      return;
    }
    if ('blur' in activeElement && typeof activeElement.blur === 'function') {
      activeElement.blur();
    }
  }
  wallpaperState.currentWallpaperPrefs = getDefaultWallpaperPrefs();
  wallpaperState.currentLocalWallpaperOverrides = getDefaultLocalWallpaperOverrides();

  wallpaperState.wallpaperAdaptiveTone = WALLPAPER_ADAPTIVE_TONE.createWallpaperAdaptiveTone({
    documentObj,
    windowObj,
    getTargets: getWallpaperAdaptiveToneTargets,
    getCurrentWallpaper: () => getWallpaperById(wallpaperState.currentWallpaperId),
    getWallpaperImageUrl: getDisplayedWallpaperImageUrl,
    getWallpaperSample,
    getOverlayAlphaAtViewportY: getWallpaperOverlayAlphaAtViewportY,
    getOverlayLuminance: () => getResolvedWallpaperOverlayMode() === 'dark' ? 0 : 1,
    getEffectLuminanceAtViewport: (viewportX, viewportY, baseLuminance) => {
      return wallpaperState.wallpaperEffects && typeof wallpaperState.wallpaperEffects.getLuminanceAtViewport === 'function'
        ? wallpaperState.wallpaperEffects.getLuminanceAtViewport(viewportX, viewportY, baseLuminance)
        : null;
    },
    applyWordmarkThemeAppearance,
    onSamplerReady: rememberWallpaperLuminance,
    getPreloadedImage: takePreloadedDecodedImage
  });
  const wallpaperEffectRuntimeOptions = {
      documentObj,
      windowObj,
      getCurrentWallpaper: () => getWallpaperById(wallpaperState.currentWallpaperId),
      getWallpaperImageUrl: getDisplayedWallpaperImageUrl,
      getWallpaperSample,
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
    wallpaperState.wallpaperEffects = wallpaperEffectPreload.controller;
  } else {
    if (wallpaperEffectPreload) {
      wallpaperEffectPreload.claimed = true;
    }
    wallpaperState.wallpaperEffects = WALLPAPER_EFFECTS.createWallpaperEffects(wallpaperEffectRuntimeOptions);
  }

  function scheduleWallpaperAdaptiveToneUpdate(options?: ToneScheduleOptions | Event | null): void {
    if (wallpaperState.wallpaperAdaptiveTone) {
      wallpaperState.wallpaperAdaptiveTone.schedule(options);
    }
  }

  function refreshWallpaperAdaptiveSampler(): void {
    if (wallpaperState.wallpaperAdaptiveTone) {
      wallpaperState.wallpaperAdaptiveTone.refresh();
    }
  }
  wallpaperState.wallpaperLuminances = readWallpaperPreloadLuminances();

  function updateWallpaperLanguageStrings(): void {
    renderWallpaperPanelState();
    if (wallpaperState.wallpaperSourcesHintController &&
        typeof wallpaperState.wallpaperSourcesHintController.updateLanguage === 'function') {
      wallpaperState.wallpaperSourcesHintController.updateLanguage();
    }
    const quoteRuntime = options.getQuoteRuntime && options.getQuoteRuntime();
    if (quoteRuntime) quoteRuntime.updateLanguage();
    const sectionSettings = options.getSectionPanelSettings && options.getSectionPanelSettings();
    if (sectionSettings) sectionSettings.updateLanguage();
  }
  function closeWallpaperPanel(closeOptions?: { restoreFocus?: boolean } | null): void {
    const button = wallpaperState.wallpaperButton;
    if (!wallpaperState.wallpaperPanel || !button) {
      return;
    }
    cancelWallpaperPanelActiveControls();
    if (wallpaperState.wallpaperViewController) {
      wallpaperState.wallpaperViewController.closeOpenSelect();
    }
    closeOnlineWallpaperMenu();
    const wasOpen = wallpaperState.wallpaperPanelOpen;
    wallpaperState.wallpaperPanelOpen = false;
    // The close itself is drawn, so the panel animates out.
    if (wasOpen) {
      drawWallpaperPanelState();
    } else {
      renderWallpaperPanelState();
    }
    setWallpaperPanelOpenState(false);
    if (closeOptions && closeOptions.restoreFocus) {
      try {
        button.focus({ preventScroll: true });
      } catch {
        button.focus();
      }
    }
  }

  function createWallpaperControls(): void {
    wallpaperState.wallpaperPanelActions = createWallpaperPanelActions();
    const panelState = buildWallpaperPanelState();
    if (!panelState) {
      return;
    }
    wallpaperState.wallpaperPanelState = panelState;
    wallpaperState.wallpaperPanelLayoutKey = getWallpaperPanelLayoutKey(panelState);
    const controller = createWallpaperViewController({
      documentObj,
      model: createWallpaperPanelModel(),
      state: panelState
    });
    wallpaperState.wallpaperViewController = controller;
    wallpaperState.wallpaperControl = controller.control;
    wallpaperState.wallpaperButton = controller.button;
    wallpaperState.wallpaperPanel = controller.panel;
    void inputAutoFocusReady.then(() => renderWallpaperPanelState());
    updateWallpaperLanguageStrings();
    createWallpaperSourcesFeatureHint();
  }
  function handleThemeModeChange(): void {
    if (!wallpaperState.hasStoredWallpaperStateLoaded) {
      return;
    }
    if (wallpaperState.currentWallpaperPrefs && (wallpaperState.currentWallpaperPrefs.sameForModes || !isWallpaperPanelOpen())) {
      wallpaperState.activeWallpaperMode = getResolvedWallpaperMode();
    }
    applyResolvedNewtabWallpaper();
    renderWallpaperPanelState();
    applyWallpaperEffectForResolvedMode();
    renderWallpaperPanelState();
    syncWallpaperSourceTabToEditMode();
    renderWallpaperPanelState();
  }

  // Another page's changes: the daily picture it fetched, custom files it
  // added, the overlay, the chosen wallpaper and its lists, the effect and
  // the tab icon. An invalid effect or icon is written back normalized.
  function followStoredWallpaper(): void {
    const { settings } = options;
    settings.subscribe(bingDailyCache, () => {
      if (!wallpaperState.hasStoredWallpaperStateLoaded) {
        return;
      }
      remoteClient.restoreWallpaper(REMOTE_CONTENT.BING_DAILY_ID).then(() => {
        if (getEffectiveWallpaperIdForMode(getResolvedWallpaperMode()) === REMOTE_CONTENT.BING_DAILY_ID) {
          applyResolvedNewtabWallpaper();
        }
        renderWallpaperPanelState();
      }).catch(warnWallpaperFailure('Could not restore the daily Bing wallpaper another tab saved.'));
    });
    settings.subscribe(SETTINGS.assetRevision, () => {
      void refreshCustomWallpapers().then(() => loadStoredWallpaperState());
    });
    settings.subscribe(newtabWallpaperOverlay, () => {
      applyWallpaperOverlayOpacity(settings.getStored(newtabWallpaperOverlay));
    });
    settings.subscribe([
      SETTINGS.newtabWallpaper,
      SETTINGS.newtabLocalWallpaper,
      SETTINGS.newtabOnlineWallpaper,
      SETTINGS.newtabLinkWallpapers,
      SETTINGS.newtabDailyWallpaperPicks,
      SETTINGS.newtabCuratedMixExcluded
    ], () => {
      wallpaperState.bingSelectionSeq += 1;
      const changeSeq = ++wallpaperState.wallpaperStorageChangeSeq;
      void loadStoredWallpaperState({
        shouldApply: () => changeSeq === wallpaperState.wallpaperStorageChangeSeq
      });
    });
    settings.subscribe(newtabWallpaperEffect, () => {
      const raw = settings.getStored(newtabWallpaperEffect);
      applyWallpaperEffectPrefs(raw);
      if (wallpaperState.hasStoredWallpaperStateLoaded) {
        writeWallpaperPreloadCache();
      }
      const storedPrefs = getWallpaperEffectStorageValue();
      if (raw && JSON.stringify(raw) !== JSON.stringify(storedPrefs)) {
        void settings.set(newtabWallpaperEffect, storedPrefs);
      }
    });
    settings.subscribe(newtabFavicon, () => {
      const raw = settings.getStored(newtabFavicon);
      const nextId = normalizeNewtabFaviconId(raw);
      applyNewtabFavicon(nextId);
      if (raw !== nextId) {
        writeSetting(newtabFavicon, nextId);
      }
    });
  }
  followStoredWallpaper();

  function getControlElement(): HTMLDivElement | null {
    return wallpaperState.wallpaperControl;
  }

  function containsTarget(target: Node | null | undefined): boolean {
    if (!target) {
      return false;
    }
    if (wallpaperState.wallpaperControl && (target === wallpaperState.wallpaperControl || wallpaperState.wallpaperControl.contains(target))) {
      return true;
    }
    if (isOnlineWallpaperMenuNode(target)) {
      return true;
    }
    return Boolean(wallpaperState.wallpaperViewController && wallpaperState.wallpaperViewController.containsSelectMenuTarget(target));
  }

  // The panel shows the clock settings as they are, whoever changed them.
  options.settings.subscribe(
    [...NEWTAB_TOP_CONTENT_SETTINGS, ...NEWTAB_SHORTCUT_GRID_SETTINGS, newtabWidthMode, newtabSearchWidth],
    () => renderWallpaperPanelState()
  );
  options.preview.store.subscribe(() => renderWallpaperPanelState());

  return {
    createControls: createWallpaperControls,
    getControlElement,
    containsTarget,
    closeOpenMenu: () => Boolean(wallpaperState.wallpaperViewController &&
      wallpaperState.wallpaperViewController.closeOpenSelect({ restoreFocus: true })) || closeCustomWallpaperUrlForm(),
    isPanelOpen: isWallpaperPanelOpen,
    closePanel: closeWallpaperPanel,
    updateLanguageStrings: updateWallpaperLanguageStrings,
    // The page calls these after changing a setting the panel shows.
    updateAppearanceSelectionUi: renderWallpaperPanelState,
    updateShortcutsUi: renderWallpaperPanelState,
    updateInputAutoFocusUi: renderWallpaperPanelState,
    refreshCustomWallpapers,
    bootstrapInitialWallpaper,
    bootstrapInitialWallpaperOverlay,
    bootstrapInitialWallpaperEffect,
    waitForInitialWallpaperEffectVisual,
    waitForInitialWallpaperTone,
    bootstrapInitialNewtabFavicon,
    handleThemeModeChange,
    scheduleAdaptiveToneUpdate: scheduleWallpaperAdaptiveToneUpdate
  };
}

type WallpaperRuntime = ReturnType<typeof createWallpaperRuntime>;

export {
  normalizeWallpaperEffectStoragePrefs,
  createWallpaperRuntime
};
export type { WallpaperRuntime, WallpaperRuntimeOptions };
