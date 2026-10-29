// The page's wallpaper: the wallpaper runtime and its panel controls, and
// the first wallpaper, overlay and effect shown at startup.
import type { StorageAreaLike } from '../../domain/storage-port';
import type { ToastTask } from '../../shared/ui/toast-screen';
import type { FormatMessage, ShowToast, Translate } from '../newtab-types';
import type { ThemeScope } from '../react/wallpaper-panel/panel-model';
import type { QuoteRuntime } from '../top-content/quotes';
import type { AdaptiveToneTarget } from './wallpaper-adaptive-tone';
import * as NEWTAB_WALLPAPER from './wallpaper';
import type { SectionPanelSettings } from './runtime/panel-actions';
import type { AppliedThemeMode } from '../theme/applied-theme-mode';
import type { SurfaceLocale } from '../../shared/i18n/surface-locale';
import { readBootValue } from '../../platform/boot-handoff';
import type { SettingsStore } from '../../platform/settings-store';
import type { SettingPreview } from '../setting-preview';
import { themeMode } from '../../domain/settings/appearance';
import { NEWTAB_THEME_SETTINGS, newtabGlassStyle, newtabGlassTheme, newtabInputAutoFocusEnabled } from '../../domain/settings/newtab-page';
import { NEWTAB_SHORTCUT_COLUMNS_DEFAULT, NEWTAB_SHORTCUT_COLUMNS_MAX, NEWTAB_SHORTCUT_COLUMNS_MIN, NEWTAB_SHORTCUT_GAP_DEFAULT, NEWTAB_SHORTCUT_GAP_MAX, NEWTAB_SHORTCUT_GAP_MIN, NEWTAB_SHORTCUT_SIZE_DEFAULT, NEWTAB_SHORTCUT_SIZE_MAX, NEWTAB_SHORTCUT_SIZE_MIN, newtabShortcutAddVisible, newtabShortcutColumns, newtabShortcutDockMagnificationEnabled, newtabShortcutGap, newtabShortcutSize, newtabShortcutsVisible } from '../../domain/settings/newtab-shortcuts';
import * as EXTENSION_ROUTES from '../../domain/extension-routes';
import { SEARCH_WIDTH_CONFIG } from '../dom/layout';
import { adaptiveToneEvents } from './tone-requests';

type StorageArea = Pick<StorageAreaLike, 'get' | 'set'>;

// Whether a layout change is only shown or also saved.
type PersistOptions = { persist: boolean };

// The page state parts the wallpaper reads and sets.

interface WallpaperPageDeps {
  // The surfaces whose text and glass follow the wallpaper's tone, as they are now.
  getAdaptiveToneTargets(): AdaptiveToneTarget[];
  settings: SettingsStore;
  preview: SettingPreview;
  // A dock tile's icon, which its tone samples.
  // The search box.
  localStorageArea: StorageArea | null;
  t: Translate;
  formatMessage: FormatMessage;
  getSelectedThemeMode(): string;
  getScopedThemeMode(): string;
  getThemeScope(): string;
  setThemeMode(mode: string): void;
  setThemeScope(scope: ThemeScope): void;
  showToast: ShowToast;
  beginToast(message: string): ToastTask;
  showTopActionTooltip(anchor: HTMLElement, text: string, options?: { placement?: string }): void;
  hideTopActionTooltip(): void;
  getEffectiveNewtabSearchWidth(): number;
  setNewtabSearchWidth(width: number, options: PersistOptions): void;
  setNewtabShortcutsVisible(visible: boolean, options: PersistOptions): void;
  setNewtabShortcutAddVisible(visible: boolean, options: PersistOptions): void;
  setNewtabShortcutDockMagnificationEnabled(enabled: boolean, options: PersistOptions): void;
  setNewtabShortcutColumns(columns: number, options: PersistOptions): void;
  setNewtabShortcutSize(size: number, options: PersistOptions): void;
  setNewtabShortcutGap(gap: number, options: PersistOptions): void;
  // Settles once the page's entry animation is done.
  newtabEntryAnimationReadyPromise: PromiseLike<unknown>;
  // Settles once the auto-focus setting is read.
  initialNewtabInputAutoFocusReadyTask: PromiseLike<unknown>;
  followTheme(): PromiseLike<unknown>;
  quoteRuntime: Pick<QuoteRuntime, 'element' | 'getTextElement' | 'bindSettings' | 'settingsState' | 'getProviderLabel' | 'updateLanguage'>;
  sectionPanelSettings: SectionPanelSettings & { updateLanguage(): void };
  appliedTheme: Pick<AppliedThemeMode, 'events'>;
  locale: Pick<SurfaceLocale, 'store'>;
}

function createWallpaperPage(deps: WallpaperPageDeps) {
  const {
    getAdaptiveToneTargets,
    quoteRuntime,
    settings,
    preview,
    localStorageArea,
    t,
    formatMessage,
    getSelectedThemeMode,
    getScopedThemeMode,
    getThemeScope,
    setThemeMode,
    setThemeScope,
    showToast,
    beginToast,
    showTopActionTooltip,
    hideTopActionTooltip,
    getEffectiveNewtabSearchWidth,
    setNewtabSearchWidth,
    setNewtabShortcutsVisible,
    setNewtabShortcutAddVisible,
    setNewtabShortcutDockMagnificationEnabled,
    setNewtabShortcutColumns,
    setNewtabShortcutSize,
    setNewtabShortcutGap,
    newtabEntryAnimationReadyPromise,
    initialNewtabInputAutoFocusReadyTask,
    followTheme,
    sectionPanelSettings,
    appliedTheme,
    locale
  } = deps;

  let wallpaperShownAt = 0;


  const wallpaperRuntime = NEWTAB_WALLPAPER.createWallpaperRuntime({
    documentObj: document,
    windowObj: window,
    chromeObj: chrome,
    extensionRoutes: EXTENSION_ROUTES,
    localWallpaperStorageArea: localStorageArea,
    getQuoteRuntime: () => quoteRuntime,
    getSectionPanelSettings: () => sectionPanelSettings,
    searchWidthConfig: SEARCH_WIDTH_CONFIG,
    t,
    formatMessage,
    getThemeMode: getSelectedThemeMode,
    getEffectiveThemeMode: getScopedThemeMode,
    getThemeScope: (...args) => getThemeScope(...args),
    getGlobalThemeMode: () => settings.get(themeMode),
    setThemeMode: (...args) => setThemeMode(...args),
    setThemeScope: (...args) => setThemeScope(...args),
    showToast,
    beginToast,
    showTopActionTooltip: (...args) => showTopActionTooltip(...args),
    hideTopActionTooltip: (...args) => hideTopActionTooltip(...args),
    settings,
    preview,
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
    getShortcutsVisible: () => preview.get(newtabShortcutsVisible),
    setShortcutsVisible: setNewtabShortcutsVisible,
    getShortcutAddVisible: () => preview.get(newtabShortcutAddVisible),
    setShortcutAddVisible: setNewtabShortcutAddVisible,
    getShortcutDockMagnificationEnabled: () => preview.get(newtabShortcutDockMagnificationEnabled),
    setShortcutDockMagnificationEnabled: setNewtabShortcutDockMagnificationEnabled,
    getShortcutColumns: () => preview.get(newtabShortcutColumns),
    setShortcutColumns: setNewtabShortcutColumns,
    getShortcutSize: () => preview.get(newtabShortcutSize),
    setShortcutSize: setNewtabShortcutSize,
    getShortcutGap: () => preview.get(newtabShortcutGap),
    setShortcutGap: setNewtabShortcutGap,
    featureHintVisibilityGate: newtabEntryAnimationReadyPromise,
    inputAutoFocusReady: initialNewtabInputAutoFocusReadyTask,
    getInputAutoFocusEnabled: () => settings.get(newtabInputAutoFocusEnabled),
    setInputAutoFocusEnabled: (enabled) => void settings.set(newtabInputAutoFocusEnabled, enabled),
    getGlassStyle: () => settings.get(newtabGlassStyle),
    setGlassStyle: (value) => void settings.set(newtabGlassStyle, newtabGlassStyle.parse(value)),
    getGlassTheme: () => settings.get(newtabGlassTheme),
    setGlassTheme: (value) => void settings.set(newtabGlassTheme, newtabGlassTheme.parse(value)),
    getAdaptiveToneTargets
  });

  // The panel draws the theme it shows, and the wallpapers follow the page's theme.
  appliedTheme.events.on('changed', () => wallpaperRuntime.handleThemeModeChange());

  function bootstrapInitialWallpaper(): Promise<void> {
    return Promise.resolve(followTheme()).then(() => wallpaperRuntime.bootstrapInitialWallpaper());
  }

  function markInitialWallpaperVisualReady(): void {
    if (!document.body) {
      return;
    }
    if (document.body.getAttribute('data-nt-wallpaper-ready') !== '1') {
      document.body.setAttribute('data-nt-wallpaper-ready', '1');
      wallpaperShownAt = performance.now();
      return;
    }
    // The preload revealed it already.
    const effectPreload = readBootValue('wallpaperEffectPreload');
    if (!wallpaperShownAt && effectPreload && effectPreload.wallpaperShownAt) {
      wallpaperShownAt = effectPreload.wallpaperShownAt;
    }
  }

  // When the wallpaper was revealed (performance.now()); 0 until then.
  function getWallpaperShownAt(): number {
    return wallpaperShownAt;
  }

  // Parts that move or restyle what the tone samples ask for a new sample.
  adaptiveToneEvents.on('stale', (options) => wallpaperRuntime.scheduleAdaptiveToneUpdate(options));

  // The dock's magnification changes what the glass behind it samples.
  settings.subscribe(newtabShortcutDockMagnificationEnabled, () => wallpaperRuntime.scheduleAdaptiveToneUpdate());

  // The panel draws in the page's language.
  locale.store.subscribe(() => wallpaperRuntime.updateLanguageStrings());
  // The panel's theme controls show the theme settings as they are.
  settings.subscribe(NEWTAB_THEME_SETTINGS, () => wallpaperRuntime.updateLanguageStrings());

  return {
    wallpaperRuntime,
    bootstrapInitialWallpaper,
    markInitialWallpaperVisualReady,
    getWallpaperShownAt
  };
}

type WallpaperPage = ReturnType<typeof createWallpaperPage>;

export { createWallpaperPage };
export type { WallpaperPage, WallpaperPageDeps };
