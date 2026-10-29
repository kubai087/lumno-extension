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
  CachedWallpaperImage
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
import { WallpaperPanelUi } from './runtime/panel-ui';
import { OnlineWallpapers } from './runtime/online-wallpapers';
import { WallpaperLibrary } from './runtime/wallpaper-library';
import { WallpaperChoice } from './runtime/wallpaper-choice';
import { InitialWallpaper } from './runtime/initial-wallpaper';
import { WallpaperPanelView } from './runtime/panel-view';
import * as WALLPAPER_WALLPAPER_EFFECT_PREFS from './runtime/wallpaper-effect-prefs';
import { WallpaperOverlay } from './runtime/wallpaper-overlay';
import * as WALLPAPER_WALLPAPER_SELECTION from './runtime/wallpaper-selection';
import * as WALLPAPER_WALLPAPER_SOURCES from './runtime/wallpaper-sources';
import * as WALLPAPER_WALLPAPER_STORAGE from './runtime/wallpaper-storage';
import * as WALLPAPER_PRELOAD_CACHE from './runtime/wallpaper-preload-cache';
import * as WALLPAPER_IMAGE_COPIES from './runtime/wallpaper-image-copies';
import * as WALLPAPER_WALLPAPER_VISUAL from './runtime/wallpaper-visual';
import * as WALLPAPER_ADAPTIVE_TONE from './wallpaper-adaptive-tone';
import * as WALLPAPER_EFFECTS from './wallpaper-effects';
import type { WallpaperEffects } from './wallpaper-effects';
import { createEventBus } from '../../shared/state/events';
import * as WALLPAPER_LOCAL_STORE from '../../shared/wallpaper-local-store';
import * as WALLPAPER_CACHES from '../../shared/wallpaper-caches';
import { readBootValue } from '../../platform/boot-handoff';
import { newtabFavicon, newtabWallpaperEffect, newtabWallpaperOverlay } from '../../domain/settings/newtab-wallpaper';
import { bingDailyCache } from '../../domain/settings/newtab-wallpaper';
import type { SettingsStore } from '../../platform/settings-store';
import type { SettingPreview } from '../setting-preview';
import { CRT_PARAMETER_PHYSICAL_MAX } from './wallpaper-options';

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

// The longest the page's content waits for the wallpaper's tones.
const WALLPAPER_TONE_REVEAL_WAIT_MAX_MS = 200;

// For failures nothing on the page can recover from but that should not happen,
// such as IndexedDB refusing a read; expected ones (offline photo requests) are
// caught where they occur, with the reason.
function warnWallpaperFailure(message: string): (error: unknown) => void {
  return (error) => {
    console.warn(`[Lumno] ${message}`, error);
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

  const panelUi = new WallpaperPanelUi();
  const online = new OnlineWallpapers();
  const library = new WallpaperLibrary();
  const choice = new WallpaperChoice(documentObj);
  const initialWallpaper = new InitialWallpaper();
  const overlay = new WallpaperOverlay(documentObj, windowObj, options.settings);
  const panelView = new WallpaperPanelView();

  const {
    getLinkWallpaperById,
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
    library,
    online,
    localWallpaperStore,
    remoteClient,
    cachedWallpaperImages,
    dailyWallpaperStandIns,
    chrome,
    wallpaperNetworkImageStates,
    t
  });

  choice.setPrefs(getDefaultWallpaperPrefs(), getDefaultLocalWallpaperOverrides());

  const {
    mergeCustomWallpaperRecords,
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
    normalizeCustomWallpaperRecord,
    readCustomWallpaperRecords,
    readCustomWallpaperRecordsByIds,
    writeCustomWallpaperRecord,
    deleteCustomWallpaperRecord,
    buildCustomWallpaperRecordFromFile
  } = WALLPAPER_WALLPAPER_STORAGE.createWallpaperStorage({
    choice,
    library,
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
    getWallpaperById,
    localWallpaperStore
  });

  // The effects draw over the wallpaper; the tones follow each render.
  const effectRenders = createEventBus<{ rendered: null }>();
  const wallpaperEffectPreload = readBootValue('wallpaperEffectPreload') || null;
  const wallpaperEffects = createPageWallpaperEffects();

  function createPageWallpaperEffects(): WallpaperEffects {
    const shouldAnimateTransition = () => Boolean(
      documentObj.body &&
      documentObj.body.getAttribute('data-nt-enter') === 'done'
    );
    const onRender = () => effectRenders.emit('rendered', null);
    if (wallpaperEffectPreload && wallpaperEffectPreload.controller) {
      wallpaperEffectPreload.attach({ onRender, shouldAnimateTransition });
      return wallpaperEffectPreload.controller;
    }
    if (wallpaperEffectPreload) {
      wallpaperEffectPreload.claimed = true;
    }
    return WALLPAPER_EFFECTS.createWallpaperEffects({
      documentObj,
      windowObj,
      getCurrentWallpaper: () => getWallpaperById(choice.state.shownId),
      getWallpaperImageUrl: getDisplayedWallpaperImageUrl,
      getWallpaperSample,
      shouldAnimateTransition,
      onRender
    });
  }

  const {
    store: effectPrefsStore,
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
    waitForInitialWallpaperEffectVisual
  } = WALLPAPER_WALLPAPER_EFFECT_PREFS.createWallpaperEffectPrefs({
    wallpaperEffects,
    initialWallpaper,
    choice,
    normalizeSingleWallpaperEffectPrefs,
    normalizeWallpaperMode,
    normalizeWallpaperEffectStoragePrefs,
    t,
    document,
    settings: options.settings,
    window
  });

  const { rememberWallpaperLuminance, writeWallpaperPreloadCache } = WALLPAPER_PRELOAD_CACHE.createWallpaperPreloadCache({
    isCustomWallpaperId,
    getWallpaperById,
    getCachedWallpaperImage,
    getShownWallpaperCopy,
    getWallpaperRuntimePath,
    getDisplayedWallpaperImageUrl,
    getWallpaperImageUrl,
    getWallpaperSample,
    getEffectiveWallpaperIdForMode,
    remoteClient,
    window,
    getEffectiveThemeMode,
    getWallpaperEffectStorageValue,
    choice,
    overlay
  });
  // The next page's preload paints the chosen effects.
  effectPrefsStore.subscribe(() => {
    if (choice.state.loaded) {
      writeWallpaperPreloadCache();
    }
  });

  const {
    events: imageCopyEvents,
    fetchWallpaperFile,
    takePreloadedCustomWallpaper,
    readCachedWallpaperImages,
    rememberCachedWallpaperImage,
    cacheShownWallpaperImages,
    cacheListedLinkWallpapers
  } = WALLPAPER_IMAGE_COPIES.createWallpaperImageCopies({
    writeWallpaperPreloadCache,
    buildCustomWallpaperRecordFromFile,
    mergeCustomWallpaperRecords,
    getEffectiveWallpaperIdForMode,
    getCachedWallpaperImage,
    getWallpaperById,
    getShownWallpaperCopy,
    fetchRemoteContent: options.fetchRemoteContent,
    windowObj,
    window,
    document,
    cachedWallpaperImages,
    dailyWallpaperStandIns,
    wallpaperImageCache,
    warnWallpaperStoreFailure,
    library,
    choice
  });

  const {
    events: visualEvents,
    beginVisualChange,
    isLatestVisualChange,
    getAppliedVisual,
    getWallpaperOverlayAlphaAtViewportY,
    getWallpaperAdaptiveToneTargets,
    getRuntimeAssetUrl,
    takePreloadedDecodedImage,
    waitForWallpaperImageReady,
    applyWallpaperVisualState,
    scheduleWallpaperVisualRefresh
  } = WALLPAPER_WALLPAPER_VISUAL.createWallpaperVisual({
    wallpaperEffects,
    panelView,
    overlay,
    document,
    window,
    getAdaptiveToneTargets,
    chrome,
    windowObj,
    isNetworkWallpaperImageUrl,
    wallpaperNetworkImageStates,
    getDisplayedWallpaperImageUrl,
    getWallpaperSample,
    wallpaperEffectPreload
  });

  const wallpaperAdaptiveTone = WALLPAPER_ADAPTIVE_TONE.createWallpaperAdaptiveTone({
    documentObj,
    windowObj,
    getTargets: getWallpaperAdaptiveToneTargets,
    getCurrentWallpaper: () => getWallpaperById(choice.state.shownId),
    getWallpaperImageUrl: getDisplayedWallpaperImageUrl,
    getWallpaperSample,
    getOverlayAlphaAtViewportY: getWallpaperOverlayAlphaAtViewportY,
    getOverlayLuminance: () => overlay.getResolvedMode() === 'dark' ? 0 : 1,
    getEffectLuminanceAtViewport: (viewportX, viewportY, baseLuminance) => {
      return typeof wallpaperEffects.getLuminanceAtViewport === 'function'
        ? wallpaperEffects.getLuminanceAtViewport(viewportX, viewportY, baseLuminance)
        : null;
    },
    applyWordmarkThemeAppearance,
    onSamplerReady: rememberWallpaperLuminance,
    getPreloadedImage: takePreloadedDecodedImage
  });

  effectRenders.on('rendered', () => wallpaperAdaptiveTone.schedule());
  visualEvents.on('settled', () => wallpaperAdaptiveTone.refresh());

  function scheduleWallpaperAdaptiveToneUpdate(scheduleOptions?: ToneScheduleOptions | Event | null): void {
    wallpaperAdaptiveTone.schedule(scheduleOptions);
  }

  // The page's content shows once the wallpaper's tones are on its controls, so nothing enters in
  // the theme's default colors and changes a moment later. A slow image never holds it for long.
  function waitForInitialWallpaperTone(): Promise<void> {
    return initialWallpaper.ready.then(() => new Promise<void>((resolve) => {
      const timer = windowObj.setTimeout(resolve, WALLPAPER_TONE_REVEAL_WAIT_MAX_MS);
      void wallpaperAdaptiveTone.whenSettled().then(() => {
        windowObj.clearTimeout(timer);
        resolve();
      });
    }));
  }

  const {
    events: selectionEvents,
    primeWallpaperImage,
    loadCustomWallpapers,
    refreshCustomWallpapers,
    applyResolvedNewtabWallpaper,
    loadStoredWallpaperState,
    bootstrapInitialWallpaper,
    persistWallpaperEnabled,
    persistWallpaperModeConsistency,
    persistNewtabWallpaper
  } = WALLPAPER_WALLPAPER_SELECTION.createWallpaperSelection({
    mergeCustomWallpaperRecords,
    document,
    getAppliedVisual,
    isLatestVisualChange,
    beginVisualChange,
    initialWallpaper,
    choice,
    library,
    online,
    getWallpaperById,
    waitForWallpaperImageReady,
    getWallpaperImageUrl,
    readCachedWallpaperImages,
    readCustomWallpaperRecords,
    cacheListedLinkWallpapers,
    normalizeCustomWallpaperRecord,
    normalizeNewtabWallpaperId,
    normalizeWallpaperMode,
    writeWallpaperPreloadCache,
    applyWallpaperVisualState,
    refreshWallpaperAdaptiveSampler: wallpaperAdaptiveTone.refresh,
    scheduleWallpaperVisualRefresh,
    getDisplayedWallpaperImageUrl,
    getEffectiveWallpaperIdForMode,
    cacheShownWallpaperImages,
    resolveSyncedWallpaperValue,
    resolveLocalWallpaperOverride,
    applyLocalWallpaperMigrations,
    setWallpaperPrefs,
    synchronizeWallpaperEffectPrefsWithWallpaperModes,
    applyWallpaperEffectForResolvedMode,
    writeSyncedWallpaperValue,
    getWallpaperStorageRawIds,
    isOnlineWallpaperId,
    writeLocalWallpaperValue,
    buildLocalWallpaperStorageValue,
    settings: options.settings,
    getWallpaperEffectStorageValue,
    readStoredSetting,
    mergeOnlineWallpaperValue,
    takePreloadedCustomWallpaper,
    getStoredCustomWallpaperIds,
    hasLoadedStoredCustomWallpaper,
    readCustomWallpaperRecordsByIds,
    warnWallpaperStoreFailure,
    remoteClient,
    getCachedWallpaperImage,
    dailyWallpaperStandIns,
    window,
    getWritableWallpaperPrefs,
    getWritableLocalWallpaperOverrides,
    writeCurrentWallpaperPrefs,
    isCustomWallpaperId,
    getWallpaperEffectPrefsForEditMode,
    getWallpaperModePreferenceOrder,
    hasAnyWallpaperEnabled,
    getFirstEnabledWallpaperIdForModes,
    getCopyableWallpaperLocalOverrideForId,
    setSharedWallpaperEffectPrefs,
    getWallpaperEffectPrefsForMode,
    getWallpaperLocalOverrideForMode
  });

  imageCopyEvents.on('cached', (copy) => {
    if (copy.shown) {
      applyResolvedNewtabWallpaper();
    }
  });

  const {
    formatBingCopyright,
    getBingWallpaperLabel,
    loadBingCatalog,
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
    wallpaperEffects,
    panelView,
    choice,
    online,
    remoteClient,
    getEffectiveWallpaperIdForMode,
    applyResolvedNewtabWallpaper,
    document,
    window,
    getWallpaperSelectionIdForUi,
    writeSetting,
    showToast,
    t,
    getWallpaperTileSelectionId,
    formatMessage,
    persistNewtabWallpaper,
    getWallpaperById,
    beginToast
  });

  const {
    showLocalWallpaperLimitToast,
    importCustomWallpaperFile,
    setCustomWallpaperUrlFormOpen,
    isOnlineWallpaperMenuNode,
    closeOnlineWallpaperMenu,
    openOnlineWallpaperMenu,
    submitCustomWallpaperUrl,
    closeCustomWallpaperUrlForm,
    deleteCustomWallpaper
  } = WALLPAPER_CUSTOM_WALLPAPERS.createCustomWallpapers({
    rememberCachedWallpaperImage,
    readCachedWallpaperImages,
    fetchWallpaperFile,
    panelView,
    library,
    panelUi,
    showToast,
    formatMessage,
    beginToast,
    t,
    buildCustomWallpaperRecordFromFile,
    writeCustomWallpaperRecord,
    normalizeCustomWallpaperRecord,
    persistNewtabWallpaper,
    windowObj,
    getCachedWallpaperImage,
    cachedWallpaperImages,
    wallpaperImageCache,
    warnWallpaperStoreFailure,
    applyResolvedNewtabWallpaper,
    writeSetting,
    hideTopActionTooltip,
    getWritableWallpaperPrefs,
    setWallpaperPrefs,
    getWritableLocalWallpaperOverrides,
    writeCurrentWallpaperPrefs,
    remoteClient,
    loadCustomWallpapers,
    document,
    getCustomWallpaperById,
    deleteCustomWallpaperRecord,
    writeLocalWallpaperValue,
    buildLocalWallpaperStorageValue
  });

  const {
    store: faviconStore,
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
    writeSetting,
    showToast,
    readStoredSetting,
    formatMessage
  });

  const {
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
    panelView,
    settings: options.settings,
    preview: options.preview,
    searchWidthConfig,
    setSearchWidth,
    shortcutColumnsConfig,
    setShortcutColumns,
    shortcutSizeConfig,
    shortcutGapConfig,
    setShortcutSize,
    setShortcutGap
  });

  const {
    animateWallpaperPanelResize,
    setWallpaperActiveTab,
    syncWallpaperSourceTabToEditMode,
    setWallpaperActiveMode,
    isWallpaperPanelOpen,
    setWallpaperPanelOpenState,
    animateWallpaperAppearanceScopeChange
  } = WALLPAPER_PANEL_MOTION.createPanelMotion({
    selectionEvents,
    panelView,
    choice,
    online,
    panelUi,
    window,
    normalizeWallpaperSourceTab,
    loadCustomWallpapers,
    loadBingCatalog,
    getWallpaperSelectionIdForUi,
    getWallpaperById,
    showCuratedPageOfSelection,
    getWallpaperSourceTabForId,
    normalizeWallpaperMode,
    document,
    t,
    getThemeScope,
    getWallpaperAppearanceOptionButtons,
    getWallpaperAppearanceOptionMotionElement,
    setThemeScope
  });

  const {
    mountWallpaperPanel,
    getWallpaperButtonLabel,
    renderWallpaperPanelState,
    drawWallpaperPanelState,
    isWallpaperTileSelected,
    getWallpaperStyleSliderValue
  } = WALLPAPER_PANEL_STATE.createPanelState({
    imageCopyEvents,
    faviconStore,
    effectPrefsStore,
    panelView,
    overlay,
    choice,
    library,
    online,
    panelUi,
    t,
    getNewtabFaviconUrl,
    getSearchWidthSnapPoints,
    getSearchWidthPercent,
    getShortcutColumnsTickValues,
    getShortcutColumnsPercent,
    normalizeShortcutSizeValue,
    getShortcutLayoutPercent,
    shortcutSizeConfig,
    normalizeShortcutGapValue,
    shortcutGapConfig,
    getThemeScope,
    getRuntimeAssetUrl,
    getGlobalThemeMode,
    getThemeMode,
    formatMessage,
    settings: options.settings,
    preview: options.preview,
    normalizeSearchWidthValue,
    getSearchWidth,
    getSearchWidthMin,
    getSearchWidthMax,
    formatSearchWidthValue,
    getInputAutoFocusEnabled,
    getShortcutsVisible,
    getShortcutSize,
    getShortcutGap,
    getShortcutAddVisible,
    getShortcutDockMagnificationEnabled,
    normalizeShortcutColumnsValue,
    getShortcutColumns,
    getShortcutColumnsMin,
    getShortcutColumnsMax,
    getShortcutLayoutMin,
    getShortcutLayoutMax,
    getShortcutLayoutDefault,
    getWallpaperThumbnailUrl,
    getWallpaperDisplayName,
    getLinkWallpaperById,
    getWallpaperById,
    formatBingCopyright,
    getBingWallpaperLabel,
    remoteClient,
    wallpaperThumbnailCache,
    fetchWallpaperFile,
    localWallpaperStore,
    warnWallpaperStoreFailure,
    getCuratedPhotoLabel,
    isCuratedDailyWallpaperActive,
    getCuratedCategoryLabel,
    getCuratedPhotoMeta,
    getCuratedTileItems,
    getWallpaperEffectPrefsForEditMode,
    getWallpaperEffectControlVisibility,
    getCrtParameterPercent,
    getWallpaperEffectLabel,
    getWallpaperEffectInkToneForUi,
    getWallpaperEffectInkToneLabel,
    getWallpaperEffectStrengthLabel,
    getWallpaperEffectSizeLabel,
    getWallpaperEffectSpacingLabel,
    getWallpaperEffectTextureLabel,
    hasAnyWallpaperEnabled,
    getWallpaperSelectionIdForUi,
    getWallpaperTileSelectionId,
    normalizeWallpaperMode,
    getWallpaperModeLabel,
    getWallpaperLocalPath,
    getGlassStyle,
    getGlassTheme,
    buildNewtabFaviconState,
    animateWallpaperPanelResize,
    document,
    extensionRoutes,
    chrome,
    window
  });

  const {
    closeWallpaperPanel,
    updateWallpaperSourcesHintLanguage,
    createWallpaperPanelActions,
    createWallpaperSourcesFeatureHint
  } = WALLPAPER_PANEL_ACTIONS.createPanelActions({
    drawWallpaperPanelState,
    closeOnlineWallpaperMenu,
    panelView,
    overlay,
    choice,
    library,
    panelUi,
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
    persistNewtabFavicon,
    options,
    document,
    featureHints,
    window,
    chrome,
    featureHintVisibilityGate,
    t,
    syncWallpaperSourceTabToEditMode,
    setWallpaperPanelOpenState,
    loadCustomWallpapers
  });

  function updateWallpaperLanguageStrings(): void {
    renderWallpaperPanelState();
    updateWallpaperSourcesHintLanguage();
    const quoteRuntime = options.getQuoteRuntime && options.getQuoteRuntime();
    if (quoteRuntime) quoteRuntime.updateLanguage();
    const sectionSettings = options.getSectionPanelSettings && options.getSectionPanelSettings();
    if (sectionSettings) sectionSettings.updateLanguage();
  }
  function createWallpaperControls(): void {
    mountWallpaperPanel(createWallpaperPanelActions());
    if (!panelView.controller) {
      return;
    }
    void inputAutoFocusReady.then(() => renderWallpaperPanelState());
    updateWallpaperLanguageStrings();
    createWallpaperSourcesFeatureHint();
  }
  function handleThemeModeChange(): void {
    if (!choice.state.loaded) {
      return;
    }
    if (choice.state.prefs && (choice.state.prefs.sameForModes || !isWallpaperPanelOpen())) {
      choice.setEditMode(choice.getResolvedWallpaperMode());
    }
    applyResolvedNewtabWallpaper();
    applyWallpaperEffectForResolvedMode();
    syncWallpaperSourceTabToEditMode();
  }

  // Another page's changes: the daily picture it fetched, custom files it
  // added, the overlay, the chosen wallpaper and its lists, the effect and
  // the tab icon. An invalid effect or icon is written back normalized.
  function followStoredWallpaper(): void {
    const { settings } = options;
    settings.subscribe(bingDailyCache, () => {
      if (!choice.state.loaded) {
        return;
      }
      remoteClient.restoreWallpaper(REMOTE_CONTENT.BING_DAILY_ID).then(() => {
        if (getEffectiveWallpaperIdForMode(choice.getResolvedWallpaperMode()) === REMOTE_CONTENT.BING_DAILY_ID) {
          applyResolvedNewtabWallpaper();
        }
        online.remoteContentChanged();
      }).catch(warnWallpaperFailure('Could not restore the daily Bing wallpaper another tab saved.'));
    });
    settings.subscribe(SETTINGS.assetRevision, () => {
      void refreshCustomWallpapers().then(() => loadStoredWallpaperState());
    });
    settings.subscribe(newtabWallpaperOverlay, () => {
      overlay.apply(settings.getStored(newtabWallpaperOverlay));
    });
    settings.subscribe([
      SETTINGS.newtabWallpaper,
      SETTINGS.newtabLocalWallpaper,
      SETTINGS.newtabOnlineWallpaper,
      SETTINGS.newtabLinkWallpapers,
      SETTINGS.newtabDailyWallpaperPicks,
      SETTINGS.newtabCuratedMixExcluded
    ], () => {
      online.dropSelections();
      const changeSeq = choice.beginStorageChange();
      void loadStoredWallpaperState({
        shouldApply: () => choice.isLatestStorageChange(changeSeq)
      });
    });
    settings.subscribe(newtabWallpaperEffect, () => {
      const raw = settings.getStored(newtabWallpaperEffect);
      applyWallpaperEffectPrefs(raw);
      if (choice.state.loaded) {
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

  // The tones read the overlay, and the next page's preload paints it.
  overlay.store.subscribe(() => {
    scheduleWallpaperAdaptiveToneUpdate();
    if (choice.state.loaded) {
      writeWallpaperPreloadCache();
    }
  });

  function getControlElement(): HTMLDivElement | null {
    return panelView.control;
  }

  function containsTarget(target: Node | null | undefined): boolean {
    if (!target) {
      return false;
    }
    if (panelView.control && (target === panelView.control || panelView.control.contains(target))) {
      return true;
    }
    if (isOnlineWallpaperMenuNode(target)) {
      return true;
    }
    return Boolean(panelView.controller && panelView.controller.containsSelectMenuTarget(target));
  }

  return {
    createControls: createWallpaperControls,
    getControlElement,
    containsTarget,
    closeOpenMenu: () => Boolean(panelView.controller &&
      panelView.controller.closeOpenSelect({ restoreFocus: true })) || closeCustomWallpaperUrlForm(),
    isPanelOpen: isWallpaperPanelOpen,
    closePanel: closeWallpaperPanel,
    updateLanguageStrings: updateWallpaperLanguageStrings,
    // The page calls these after changing a setting the panel shows.
    updateAppearanceSelectionUi: renderWallpaperPanelState,
    updateShortcutsUi: renderWallpaperPanelState,
    updateInputAutoFocusUi: renderWallpaperPanelState,
    refreshCustomWallpapers,
    bootstrapInitialWallpaper,
    bootstrapInitialWallpaperOverlay: overlay.bootstrap,
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
