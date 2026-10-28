// What the appearance panel's controls do: the action table the React view
// calls, slider value inputs, and the wallpaper sources feature hint.
import type * as LumnoFeatureHints from '../../../shared/ui/feature-hints';
import type { FeatureHintChromeApi, FeatureHintController, FeatureHintOptions } from '../../../shared/ui/feature-hint-catalog';
import type { Translate } from '../../newtab-types';
import type { EffectSliderKey, GlassTheme, ThemeScope, WallpaperPanelActions } from '../../react/wallpaper-panel/panel-model';
import type { SliderChange } from '../../react/wallpaper-panel/panel-primitives';
import type { WallpaperViewController } from '../../react/wallpaper-view';
import type { QuoteRuntime } from '../../top-content/quotes';
import type { WallpaperEffectPrefs } from '../wallpaper-effects';
import type { CustomWallpapers } from './custom-wallpapers';
import type { DailyWallpapers } from './daily-wallpapers';
import type { FaviconChooser } from './favicon-chooser';
import type { PanelMotion } from './panel-motion';
import type { PanelSettings, SliderConfig } from './panel-settings';
import type { CrtParameterKey, PanelState } from './panel-state';
import type { WallpaperEffectPrefsRuntime } from './wallpaper-effect-prefs';
import type { WallpaperOverlay } from './wallpaper-overlay';
import type { WallpaperSelection } from './wallpaper-selection';
import type { WallpaperSources } from './wallpaper-sources';
import type { WallpaperStorage } from './wallpaper-storage';
import type { WallpaperState } from './wallpaper-runtime-types';
import type { SettingsStore } from '../../../platform/settings-store';
import { newtabTimeFont } from '../../../domain/settings/newtab-time';
import * as REMOTE_CONTENT from '../../remote-content';
import * as SETTINGS from '../../../domain/settings';

// Whether a layout change is only shown or also saved.
type PersistOptions = { persist: boolean };

// The bookmark and site card settings, which the panel draws from their runtime's model.
interface SectionPanelSettings {
  bindSettings(view: WallpaperViewController | null): void;
}

interface PanelActionsDeps extends
  Pick<WallpaperEffectPrefsRuntime, 'getWallpaperEffectPrefsForEditMode' | 'persistWallpaperEffectPrefs'>,
  Pick<PanelState, 'getWallpaperStyleSliderValue' | 'getWallpaperButtonLabel' | 'renderWallpaperPanelState' |
    'isWallpaperTileSelected'>,
  Pick<WallpaperSources, 'getWallpaperById'>,
  Pick<DailyWallpapers, 'clearDailyWallpaperPick' | 'selectBingWallpaper' | 'loadBingCatalog' |
    'setCuratedDailyWallpaper' | 'selectCuratedCategory' | 'setCuratedMixCategory' | 'showMoreCuratedWallpapers' |
    'getActiveDailyWallpaperId' | 'setDailyWallpaperPick'>,
  Pick<WallpaperSelection, 'persistNewtabWallpaper' | 'persistWallpaperEnabled' | 'persistWallpaperModeConsistency' |
    'primeWallpaperImage' | 'loadCustomWallpapers'>,
  Pick<PanelMotion, 'isWallpaperPanelOpen' | 'animateWallpaperAppearanceScopeChange' | 'setWallpaperActiveMode' |
    'setWallpaperActiveTab' | 'syncWallpaperSourceTabToEditMode' | 'setWallpaperPanelOpenState'>,
  Pick<PanelSettings, 'persistSearchWidthFromSlider' | 'persistTopContentMode' | 'persistTimeFontWeight' |
    'persistTimeFontSizeFromSlider' | 'persistTimeOpacityFromSlider' | 'persistTimeInk' | 'persistTimeFont' |
    'persistTimeSecondsVisible' | 'persistTime12Hour' | 'persistShortcutColumnsFromSlider' |
    'persistShortcutSizeFromSlider' | 'persistShortcutGapFromSlider' | 'getShortcutLayoutDefault'>,
  Pick<CustomWallpapers, 'deleteCustomWallpaper' | 'importCustomWallpaperFile' | 'isLocalWallpaperLibraryFull' |
    'showLocalWallpaperLimitToast' | 'setCustomWallpaperUrlFormOpen' | 'openOnlineWallpaperMenu' |
    'submitCustomWallpaperUrl'>,
  Pick<WallpaperStorage, 'getWallpaperSelectionIdForUi' | 'getResolvedWallpaperMode'>,
  Pick<WallpaperOverlay, 'getResolvedWallpaperOverlayMode' | 'persistWallpaperOverlayOpacity' |
    'getWallpaperOverlayOpacityForCurrentMode'>,
  Pick<FaviconChooser, 'persistNewtabFavicon'> {
  settings: Pick<SettingsStore, 'get'>;
  CRT_PARAMETER_PHYSICAL_MAX: Readonly<Record<CrtParameterKey, number>>;
  getCrtParameterPercent(key: CrtParameterKey, value: unknown): number;
  getCrtParameterPhysicalValue(key: CrtParameterKey, percent: unknown): number;
  NEWTAB_WALLPAPER_DEFAULT_ID: string;
  showTopActionTooltip(anchor: HTMLElement, text: string, options?: { placement?: string }): void;
  hideTopActionTooltip(): void;
  getThemeScope(): string;
  setThemeMode(mode: string): void;
  setInputAutoFocusEnabled(enabled: boolean): void;
  setGlassStyle(value: string): void;
  setGlassTheme(value: GlassTheme): void;
  setShortcutsVisible(visible: boolean, options: PersistOptions): void;
  setShortcutAddVisible(visible: boolean, options: PersistOptions): void;
  setShortcutDockMagnificationEnabled(enabled: boolean, options: PersistOptions): void;
  shortcutSizeConfig: SliderConfig;
  shortcutGapConfig: SliderConfig;
  options: {
    getQuoteRuntime?: () => Pick<QuoteRuntime, 'bindSettings'> | null | undefined;
    getSectionPanelSettings?: () => SectionPanelSettings | null | undefined;
  };
  document: Document;
  featureHints: Pick<typeof LumnoFeatureHints, 'createFeatureHint'> | null;
  window: FeatureHintOptions['windowObj'];
  chrome: FeatureHintChromeApi | null | undefined;
  featureHintVisibilityGate: PromiseLike<unknown> | null;
  t: Translate;
  closeWallpaperPanel(): void;
  wallpaperState: Pick<WallpaperState,
    'customWallpaperImporting' | 'customWallpaperUrlFormOpen' | 'customWallpaperUrlInvalid' |
    'wallpaperViewController' | 'wallpaperSourcesHintController' | 'wallpaperControl' | 'wallpaperPanel' |
    'wallpaperButton' | 'wallpaperPanelOpen' | 'activeWallpaperTab' | 'activeWallpaperMode'>;
}

// The effect settings an effect slider writes to.
type EffectParameterKey = Exclude<EffectSliderKey, 'strength' | 'size'> | 'strength' | 'crtStrength' | 'size' | 'blockSize';

function isCrtParameterKey(key: EffectParameterKey): key is CrtParameterKey {
  return key === 'crtStrength' || key === 'crtBloom' || key === 'crtRgbOffset' || key === 'crtCurvature';
}

function createPanelActions(deps: PanelActionsDeps) {
  const {
    settings,
    getWallpaperEffectPrefsForEditMode,
    CRT_PARAMETER_PHYSICAL_MAX,
    getCrtParameterPercent,
    getWallpaperStyleSliderValue,
    persistWallpaperEffectPrefs,
    getCrtParameterPhysicalValue,
    getWallpaperById,
    clearDailyWallpaperPick,
    selectBingWallpaper,
    persistNewtabWallpaper,
    NEWTAB_WALLPAPER_DEFAULT_ID,
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
    closeWallpaperPanel
  } = deps;

  // The runtime state object shared with wallpaper.ts and the other modules.
  const wallpaperState = deps.wallpaperState;

  let wallpaperPanelRendered = false;

  function setWallpaperEffectParameter(sliderKey: EffectSliderKey, value: number, change: SliderChange): void {
    const currentPrefs = getWallpaperEffectPrefsForEditMode();
    const key: EffectParameterKey = sliderKey === 'strength'
      ? (currentPrefs.type === 'crt' ? 'crtStrength' : 'strength')
      : sliderKey === 'size'
        ? (currentPrefs.type === 'blocks' ? 'blockSize' : 'size')
        : sliderKey;
    const crtKey = currentPrefs.type === 'crt' && isCrtParameterKey(key) && CRT_PARAMETER_PHYSICAL_MAX[key] ? key : null;
    const fallbackValue = crtKey
      ? getCrtParameterPercent(crtKey, currentPrefs[crtKey])
      : currentPrefs[key];
    const sliderValue = getWallpaperStyleSliderValue(value, fallbackValue, change, sliderKey === 'strength');
    const nextPrefs: Partial<WallpaperEffectPrefs> = {};
    nextPrefs[key] = crtKey ? getCrtParameterPhysicalValue(crtKey, sliderValue) : sliderValue;
    persistWallpaperEffectPrefs(nextPrefs);
  }

  function setBingDailyWallpaper(enabled: boolean): void {
    const daily = getWallpaperById(REMOTE_CONTENT.BING_DAILY_ID);
    if (enabled) {
      clearDailyWallpaperPick(REMOTE_CONTENT.BING_DAILY_ID);
      void selectBingWallpaper(REMOTE_CONTENT.BING_DAILY_ID);
    } else if (daily && daily.dailyId) {
      void selectBingWallpaper(daily.dailyId);
    } else {
      // An unresolved daily photo shows the built-in default, so keep that one.
      persistNewtabWallpaper(NEWTAB_WALLPAPER_DEFAULT_ID);
    }
  }

  function createWallpaperPanelActions(): WallpaperPanelActions {
    const actions: WallpaperPanelActions = {
      togglePanel: toggleWallpaperPanel,
      showTooltip: (anchor, text) => showTopActionTooltip(anchor, text),
      hideTooltip: () => hideTopActionTooltip(),
      showButtonTooltip(anchor) {
        if (isWallpaperPanelOpen()) {
          hideTopActionTooltip();
          return;
        }
        showTopActionTooltip(anchor, getWallpaperButtonLabel(), { placement: 'top' });
      },
      selectThemeScope: (scope: ThemeScope) => animateWallpaperAppearanceScopeChange(getThemeScope(), scope),
      selectThemeMode: (mode) => setThemeMode(mode),
      setSearchWidth: (value, change) => persistSearchWidthFromSlider(value, change),
      setInputAutoFocus(enabled) {
        setInputAutoFocusEnabled(enabled);
        renderWallpaperPanelState();
      },
      setGlassStyle(value) {
        setGlassStyle(value);
        renderWallpaperPanelState();
      },
      selectGlassTheme(value) {
        setGlassTheme(value);
        renderWallpaperPanelState();
      },
      selectTopContent: (mode) => persistTopContentMode(mode),
      setTimeFontWeight: (value) => persistTimeFontWeight(value),
      resetTimeFontWeight: () => persistTimeFontWeight(SETTINGS.getNewtabTimeFont(settings.get(newtabTimeFont)).defaultWeight),
      setTimeFontSize: (value, change) => persistTimeFontSizeFromSlider(value, change),
      resetTimeFontSize: () => persistTimeFontSizeFromSlider(SETTINGS.NEWTAB_TIME_FONT_SIZE_DEFAULT, { final: true }),
      setTimeOpacity: (value, change) => persistTimeOpacityFromSlider(value, change),
      resetTimeOpacity: () => persistTimeOpacityFromSlider(SETTINGS.NEWTAB_TIME_OPACITY_DEFAULT, { final: true }),
      selectTimeInk: (value) => persistTimeInk(value),
      setTimeFont: (value) => persistTimeFont(value),
      setTimeSecondsVisible: (visible) => persistTimeSecondsVisible(visible),
      setTime12Hour: (enabled) => persistTime12Hour(enabled),
      setShortcutsVisible(visible) {
        setShortcutsVisible(visible, { persist: true });
        renderWallpaperPanelState();
      },
      setShortcutAddVisible(visible) {
        setShortcutAddVisible(visible, { persist: true });
        renderWallpaperPanelState();
      },
      setShortcutDockMagnification(enabled) {
        setShortcutDockMagnificationEnabled(enabled, { persist: true });
        renderWallpaperPanelState();
      },
      setShortcutColumns: (value, change) => persistShortcutColumnsFromSlider(value, change),
      setShortcutSize: (value, change) => persistShortcutSizeFromSlider(value, change),
      setShortcutGap: (value, change) => persistShortcutGapFromSlider(value, change),
      resetShortcutSize: () => persistShortcutSizeFromSlider(
        getShortcutLayoutDefault(shortcutSizeConfig, 48, 112, 64),
        { final: true }
      ),
      resetShortcutGap: () => persistShortcutGapFromSlider(
        getShortcutLayoutDefault(shortcutGapConfig, 0, 24, 4),
        { final: true }
      ),
      setWallpaperEnabled: (enabled) => persistWallpaperEnabled(enabled),
      setModeSync: (enabled) => persistWallpaperModeConsistency(enabled),
      selectWallpaperMode: (mode) => setWallpaperActiveMode(mode),
      selectSourceTab: (tab) => setWallpaperActiveTab(tab),
      selectWallpaper: (id) => persistNewtabWallpaper(id),
      primeWallpaper: (id) => { void primeWallpaperImage(id); },
      deleteWallpaper: (id) => deleteCustomWallpaper(id),
      importWallpaperFile: (file) => importCustomWallpaperFile(file),
      toggleUrlForm() {
        if (wallpaperState.customWallpaperImporting) {
          return;
        }
        if (!wallpaperState.customWallpaperUrlFormOpen && isLocalWallpaperLibraryFull()) {
          showLocalWallpaperLimitToast();
          return;
        }
        setCustomWallpaperUrlFormOpen(!wallpaperState.customWallpaperUrlFormOpen);
      },
      openOnlineWallpaperMenu: (id, element, point) => openOnlineWallpaperMenu(id, element, point),
      showLocalWallpaperLimit: () => showLocalWallpaperLimitToast(),
      submitWallpaperUrl(url) {
        if (!wallpaperState.customWallpaperImporting) {
          submitCustomWallpaperUrl(url);
        }
      },
      clearUrlInvalid() {
        wallpaperState.customWallpaperUrlInvalid = false;
        renderWallpaperPanelState();
      },
      setBingDaily: setBingDailyWallpaper,
      restoreDailyWallpaper() {
        const dailyId = getWallpaperSelectionIdForUi();
        if (REMOTE_CONTENT.isDailyWallpaperId(dailyId)) {
          clearDailyWallpaperPick(dailyId);
        }
      },
      refreshBing: () => { void loadBingCatalog(true); },
      selectBingWallpaper(id) {
        // The highlighted tile is already applied; re-clicking it should not leave daily mode.
        if (!isWallpaperTileSelected(id)) {
          void selectBingWallpaper(id, { asDailyPick: true });
        }
      },
      setCuratedDaily: (enabled) => setCuratedDailyWallpaper(enabled),
      selectCuratedCategory: (category) => selectCuratedCategory(category),
      setCuratedMixCategory: (category, included) => setCuratedMixCategory(category, included),
      showMoreCurated: () => showMoreCuratedWallpapers(),
      selectCuratedWallpaper(id) {
        if (isWallpaperTileSelected(id)) {
          return;
        }
        const daily = getActiveDailyWallpaperId('curated');
        if (daily) setDailyWallpaperPick(daily, id);
        else persistNewtabWallpaper(id);
      },
      setOverlay(value, change) {
        const mode = getResolvedWallpaperOverlayMode();
        persistWallpaperOverlayOpacity(mode, getWallpaperStyleSliderValue(
          value,
          getWallpaperOverlayOpacityForCurrentMode(),
          change,
          true
        ));
      },
      selectEffect: (type) => persistWallpaperEffectPrefs({ type }),
      selectInkTone: (tone) => persistWallpaperEffectPrefs({ inkTone: tone }),
      setEffectParameter: setWallpaperEffectParameter,
      selectFavicon: (id) => persistNewtabFavicon(id)
    };
    return Object.freeze(actions);
  }

  // The bookmark, site card and quote sections belong to their own runtimes; they
  // join the panel the first time it opens.
  function bindWallpaperPanelSectionRuntimes(): void {
    if (wallpaperPanelRendered) {
      return;
    }
    wallpaperPanelRendered = true;
    const quoteRuntime = options.getQuoteRuntime && options.getQuoteRuntime();
    if (quoteRuntime) quoteRuntime.bindSettings(wallpaperState.wallpaperViewController);
    const sectionSettings = options.getSectionPanelSettings && options.getSectionPanelSettings();
    if (sectionSettings) {
      sectionSettings.bindSettings(wallpaperState.wallpaperViewController);
    }
  }

  function isFocusRoutePending(): boolean {
    return Boolean(
      document.documentElement &&
      document.documentElement.getAttribute('data-nt-focus-route-pending') === 'true'
    );
  }

  // Points at the appearance button until the panel is opened once.
  function createWallpaperSourcesFeatureHint(): FeatureHintController | null {
    const control = wallpaperState.wallpaperControl;
    if (wallpaperState.wallpaperSourcesHintController ||
        isFocusRoutePending() ||
        !control ||
        !featureHints ||
        typeof featureHints.createFeatureHint !== 'function') {
      return wallpaperState.wallpaperSourcesHintController;
    }
    const controller = featureHints.createFeatureHint({
      documentObj: document,
      windowObj: window,
      chromeApi: chrome,
      definition: 'newtab-wallpaper-sources',
      visibilityGate: featureHintVisibilityGate,
      t,
    });
    if (!controller || !controller.element) {
      return null;
    }
    wallpaperState.wallpaperSourcesHintController = controller;
    control.appendChild(controller.element);
    return controller;
  }

  function dismissWallpaperSourcesFeatureHint(): void {
    if (wallpaperState.wallpaperSourcesHintController &&
        typeof wallpaperState.wallpaperSourcesHintController.dismiss === 'function') {
      wallpaperState.wallpaperSourcesHintController.dismiss();
    }
  }

  function openWallpaperPanel(): void {
    if (!wallpaperState.wallpaperPanel || !wallpaperState.wallpaperButton) {
      return;
    }
    // The panel opens on the wallpaper the page shows. With light and dark
    // set apart, the mode picked on an earlier open (or the light default
    // a page starts with) would leave every change to the other mode's
    // wallpaper and filter, out of sight.
    const shownMode = getResolvedWallpaperMode();
    const modeChanged = wallpaperState.activeWallpaperMode !== shownMode;
    wallpaperState.activeWallpaperMode = shownMode;
    if (!wallpaperPanelRendered) {
      bindWallpaperPanelSectionRuntimes();
    }
    if (!wallpaperPanelRendered || modeChanged) {
      // The source tab shows where that wallpaper comes from.
      syncWallpaperSourceTabToEditMode({ force: true });
    }
    dismissWallpaperSourcesFeatureHint();
    wallpaperState.wallpaperPanelOpen = true;
    renderWallpaperPanelState();
    setWallpaperPanelOpenState(true);
    if (wallpaperState.activeWallpaperTab === 'local') {
      void loadCustomWallpapers();
    }
    if (wallpaperState.activeWallpaperTab === 'bing') void loadBingCatalog();
  }
  function toggleWallpaperPanel(): void {
    if (isWallpaperPanelOpen()) {
      closeWallpaperPanel();
      return;
    }
    openWallpaperPanel();
  }

  return {
    createWallpaperPanelActions,
    createWallpaperSourcesFeatureHint
  };
}

type PanelActions = ReturnType<typeof createPanelActions>;

export { createPanelActions };
export type { PanelActions, PanelActionsDeps, SectionPanelSettings };
