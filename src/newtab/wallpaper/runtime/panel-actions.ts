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
import type { SettingsStore } from '../../../platform/settings-store';
import { newtabTimeFont } from '../../../domain/settings/newtab-time';
import * as REMOTE_CONTENT from '../../remote-content';
import * as SETTINGS from '../../../domain/settings';
import { CRT_PARAMETER_PHYSICAL_MAX, NEWTAB_WALLPAPER_DEFAULT_ID } from '../wallpaper-options';
import { getPagePortals } from '../../app/portals';
import type { WallpaperPanelUi } from './panel-ui';
import type { WallpaperLibrary } from './wallpaper-library';
import type { WallpaperChoice } from './wallpaper-choice';
import type { WallpaperPanelView } from './panel-view';

// Whether a layout change is only shown or also saved.
type PersistOptions = { persist: boolean };

// The bookmark and site card settings, which the panel draws from their runtime's model.
interface SectionPanelSettings {
  bindSettings(view: WallpaperViewController | null): void;
}

interface PanelActionsDeps extends
  Pick<WallpaperEffectPrefsRuntime, 'getWallpaperEffectPrefsForEditMode' | 'persistWallpaperEffectPrefs'>,
  Pick<PanelState, 'getWallpaperStyleSliderValue' | 'getWallpaperButtonLabel' | 'renderWallpaperPanelState' | 'drawWallpaperPanelState' |
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
  Pick<CustomWallpapers, 'deleteCustomWallpaper' | 'importCustomWallpaperFile' | 
    'showLocalWallpaperLimitToast' | 'setCustomWallpaperUrlFormOpen' | 'openOnlineWallpaperMenu' | 'closeOnlineWallpaperMenu' |
    'submitCustomWallpaperUrl'>,
  Pick<WallpaperStorage, 'getWallpaperSelectionIdForUi'>,
  Pick<FaviconChooser, 'persistNewtabFavicon'> {
  settings: Pick<SettingsStore, 'get'>;
  getCrtParameterPercent(key: CrtParameterKey, value: unknown): number;
  getCrtParameterPhysicalValue(key: CrtParameterKey, percent: unknown): number;
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
  panelUi: WallpaperPanelUi;
  library: Pick<WallpaperLibrary, 'isFull'>;
  choice: WallpaperChoice;
  overlay: Pick<WallpaperOverlay, 'getResolvedMode' | 'persist' | 'getOpacityForCurrentMode'>;
  panelView: WallpaperPanelView;
}

// The effect settings an effect slider writes to.
type EffectParameterKey = Exclude<EffectSliderKey, 'strength' | 'size'> | 'strength' | 'crtStrength' | 'size' | 'blockSize';

function isCrtParameterKey(key: EffectParameterKey): key is CrtParameterKey {
  return key === 'crtStrength' || key === 'crtBloom' || key === 'crtRgbOffset' || key === 'crtCurvature';
}

function createPanelActions(deps: PanelActionsDeps) {
  const {
    closeOnlineWallpaperMenu,
    drawWallpaperPanelState,
    panelView,
    overlay,
    choice,
    library,
    panelUi,
    settings,
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
  } = deps;


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
        if (panelUi.state.importing) {
          return;
        }
        if (!panelUi.state.urlFormOpen && library.isFull()) {
          showLocalWallpaperLimitToast();
          return;
        }
        setCustomWallpaperUrlFormOpen(!panelUi.state.urlFormOpen);
      },
      openOnlineWallpaperMenu: (id, element, point) => openOnlineWallpaperMenu(id, element, point),
      showLocalWallpaperLimit: () => showLocalWallpaperLimitToast(),
      submitWallpaperUrl(url) {
        if (!panelUi.state.importing) {
          submitCustomWallpaperUrl(url);
        }
      },
      clearUrlInvalid() {
        panelUi.setUrlInvalid(false);
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
        const mode = overlay.getResolvedMode();
        overlay.persist(mode, getWallpaperStyleSliderValue(
          value,
          overlay.getOpacityForCurrentMode(),
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
    if (quoteRuntime) quoteRuntime.bindSettings(panelView.controller);
    const sectionSettings = options.getSectionPanelSettings && options.getSectionPanelSettings();
    if (sectionSettings) {
      sectionSettings.bindSettings(panelView.controller);
    }
  }

  function isFocusRoutePending(): boolean {
    return Boolean(
      document.documentElement &&
      document.documentElement.getAttribute('data-nt-focus-route-pending') === 'true'
    );
  }

  let sourcesHint: FeatureHintController | null = null;

  // Points at the appearance button until the panel is opened once.
  function createWallpaperSourcesFeatureHint(): FeatureHintController | null {
    const control = panelView.control;
    if (sourcesHint ||
        isFocusRoutePending() ||
        !control ||
        !featureHints ||
        typeof featureHints.createFeatureHint !== 'function') {
      return sourcesHint;
    }
    const controller = featureHints.createFeatureHint({
      portals: getPagePortals(),
      documentObj: document,
      windowObj: window,
      chromeApi: chrome,
      definition: 'newtab-wallpaper-sources',
      visibilityGate: featureHintVisibilityGate,
      t
    });
    if (!controller || !controller.element) {
      return null;
    }
    sourcesHint = controller;
    control.appendChild(controller.element);
    return controller;
  }

  function updateWallpaperSourcesHintLanguage(): void {
    if (sourcesHint && typeof sourcesHint.updateLanguage === 'function') {
      sourcesHint.updateLanguage();
    }
  }

  function dismissWallpaperSourcesFeatureHint(): void {
    if (sourcesHint &&
        typeof sourcesHint.dismiss === 'function') {
      sourcesHint.dismiss();
    }
  }

  function openWallpaperPanel(): void {
    if (!panelView.panel || !panelView.button) {
      return;
    }
    // The panel opens on the wallpaper the page shows. With light and dark
    // set apart, the mode picked on an earlier open (or the light default
    // a page starts with) would leave every change to the other mode's
    // wallpaper and filter, out of sight.
    const shownMode = choice.getResolvedWallpaperMode();
    const modeChanged = choice.state.editMode !== shownMode;
    choice.setEditMode(shownMode);
    if (!wallpaperPanelRendered) {
      bindWallpaperPanelSectionRuntimes();
    }
    if (!wallpaperPanelRendered || modeChanged) {
      // The source tab shows where that wallpaper comes from.
      syncWallpaperSourceTabToEditMode({ force: true });
    }
    dismissWallpaperSourcesFeatureHint();
    panelUi.setOpen(true);
    setWallpaperPanelOpenState(true);
    if (panelUi.state.tab === 'local') {
      void loadCustomWallpapers();
    }
    if (panelUi.state.tab === 'bing') void loadBingCatalog();
  }
  function toggleWallpaperPanel(): void {
    if (isWallpaperPanelOpen()) {
      closeWallpaperPanel();
      return;
    }
    openWallpaperPanel();
  }

  function cancelWallpaperPanelActiveControls(): void {
    const activeElement = document.activeElement;
    if (!activeElement || !panelView.panel || !panelView.panel.contains(activeElement)) {
      return;
    }
    if ('blur' in activeElement && typeof activeElement.blur === 'function') {
      activeElement.blur();
    }
  }

  function closeWallpaperPanel(closeOptions?: { restoreFocus?: boolean } | null): void {
    const button = panelView.button;
    if (!panelView.panel || !button) {
      return;
    }
    cancelWallpaperPanelActiveControls();
    if (panelView.controller) {
      panelView.controller.closeOpenSelect();
    }
    closeOnlineWallpaperMenu();
    const wasOpen = panelUi.state.open;
    panelUi.setOpen(false);
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

  return {
    closeWallpaperPanel,
    updateWallpaperSourcesHintLanguage,
    createWallpaperPanelActions,
    createWallpaperSourcesFeatureHint
  };
}

type PanelActions = ReturnType<typeof createPanelActions>;

export { createPanelActions };
export type { PanelActions, PanelActionsDeps, SectionPanelSettings };
