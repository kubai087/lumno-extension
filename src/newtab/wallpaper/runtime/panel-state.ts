// The appearance panel's view model: the panel header, the theme, search
// and shortcut sections, each wallpaper source's tiles, effects, favicons,
// and drawing the model into the React view.
import type * as LumnoExtensionRoutes from '../../../domain/extension-routes';
import * as LumnoCommunityLinks from '../../../platform/community-links';
import type { WallpaperLocalStore } from '../../../shared/wallpaper-records';
import type { WallpaperThumbnailCache } from '../../../shared/wallpaper-caches';
import type { FormatMessage, Translate } from '../../newtab-types';
import type {
  GlassTheme,
  TileState,
  OnlineTileState,
  SelectedSourceState,
  DailyState,
  CuratedMixState,
  ThemeScope,
  TimeInk,
  TopContentMode,
  WallpaperPanelActions,
  WallpaperPanelModel,
  WallpaperPanelState,
  WallpaperSourceTab
} from '../../react/wallpaper-panel/panel-model';
import type { SegmentOption, SliderChange, SliderState, ToggleState } from '../../react/wallpaper-panel/panel-primitives';
import type { RemoteContentClient } from '../../remote-content';
import type { RemoteWallpaper } from '../../remote-content-types';
import type { WallpaperImageCopies } from './wallpaper-image-copies';
import type { DailyWallpapers } from './daily-wallpapers';
import type { FaviconChooser } from './favicon-chooser';
import type { PanelSettings, SliderConfig } from './panel-settings';
import type { WallpaperEffectPrefsRuntime } from './wallpaper-effect-prefs';
import { normalizeWallpaperOverlayOpacity, snapWallpaperOverlaySliderValue } from './wallpaper-overlay';
import type { WallpaperOverlay } from './wallpaper-overlay';
import { clampNumber } from '../wallpaper-effect-pixels';
import type { WallpaperSources } from './wallpaper-sources';
import type { WallpaperStorage } from './wallpaper-storage';
import type {
  AppearanceMode,
  WallpaperItem
} from './wallpaper-runtime-types';
import type { SvgNode } from '../../../shared/ui/svg-tree';
import type { SettingsStore } from '../../../platform/settings-store';
import type { SettingPreview } from '../../setting-preview';
import { NEWTAB_TOP_CONTENT_SETTINGS, newtabTime12Hour, newtabTimeFont, newtabTimeFontSize, newtabTimeFontWeight, newtabTimeInk, newtabTimeOpacity, newtabTimeSecondsVisible, newtabTopContentMode } from '../../../domain/settings/newtab-time';
import * as SETTINGS from '../../../domain/settings';
import * as REMOTE_CONTENT from '../../remote-content';
import { BLOCK_PARAMETER_MAX, NEWTAB_FAVICON_OPTIONS, NEWTAB_FAVICON_SVG_MAIN_PATH, NEWTAB_FAVICON_SVG_SHADOW_PATH, NEWTAB_WALLPAPER_EFFECT_INK_TONES, NEWTAB_WALLPAPER_EFFECT_TYPES, NEWTAB_WALLPAPER_MODES, NEWTAB_WALLPAPER_MODE_DARK, NEWTAB_WALLPAPER_OPTIONS } from '../wallpaper-options';
import type { WallpaperPanelUi } from './panel-ui';
import type { OnlineWallpapers } from './online-wallpapers';
import type { WallpaperLibrary } from './wallpaper-library';
import type { WallpaperChoice } from './wallpaper-choice';
import { createWallpaperViewController } from '../../react/wallpaper-view';
import type { WallpaperPanelView } from './panel-view';
import { getAppearanceModeLabels } from './appearance-labels';
import { isLinkWallpaperId } from './wallpaper-library';
import { NEWTAB_SHORTCUT_GRID_SETTINGS } from '../../../domain/settings/newtab-shortcuts';
import { newtabInputAutoFocusEnabled, newtabSearchWidth, newtabWidthMode } from '../../../domain/settings/newtab-page';

// The CRT settings stored as physical values and shown as percentages.
type CrtParameterKey = 'crtStrength' | 'crtBloom' | 'crtRgbOffset' | 'crtCurvature';

interface PanelStateDeps extends
  Pick<PanelSettings,
    'getSearchWidthSnapPoints' | 'getSearchWidthPercent' | 'getShortcutColumnsTickValues' |
    'getShortcutColumnsPercent' | 'normalizeShortcutSizeValue' | 'getShortcutLayoutPercent' |
    'normalizeShortcutGapValue' | 'normalizeSearchWidthValue' | 'getSearchWidthMin' | 'getSearchWidthMax' |
    'formatSearchWidthValue' | 'normalizeShortcutColumnsValue' | 'getShortcutColumnsMin' |
    'getShortcutColumnsMax' | 'getShortcutLayoutMin' | 'getShortcutLayoutMax' | 'getShortcutLayoutDefault'>,
  Pick<WallpaperSources,
    'getWallpaperThumbnailUrl' | 'getWallpaperDisplayName' | 'getWallpaperById' | 'normalizeWallpaperMode' |
    'getWallpaperLocalPath'>,
  Pick<WallpaperImageCopies, 'fetchWallpaperFile'>,
  Pick<WallpaperSources, 'getLinkWallpaperById'>,
  Pick<DailyWallpapers,
    'formatBingCopyright' | 'getBingWallpaperLabel' | 'getCuratedPhotoLabel' | 'isCuratedDailyWallpaperActive' |
    'getCuratedCategoryLabel' | 'getCuratedPhotoMeta' | 'getCuratedTileItems'>,
  Pick<WallpaperEffectPrefsRuntime,
    'getWallpaperEffectPrefsForEditMode' | 'getWallpaperEffectControlVisibility' | 'getWallpaperEffectLabel' |
    'getWallpaperEffectInkToneForUi' | 'getWallpaperEffectInkToneLabel' | 'getWallpaperEffectStrengthLabel' |
    'getWallpaperEffectSizeLabel' | 'getWallpaperEffectSpacingLabel' | 'getWallpaperEffectTextureLabel'>,
  Pick<WallpaperStorage,
    'hasAnyWallpaperEnabled' | 'getWallpaperSelectionIdForUi' | 'getWallpaperTileSelectionId' | 'getWallpaperModeLabel'>,
  Pick<FaviconChooser, 'getNewtabFaviconUrl' | 'buildNewtabFaviconState'> {
  t: Translate;
  formatMessage: FormatMessage;
  shortcutSizeConfig: SliderConfig;
  shortcutGapConfig: SliderConfig;
  // The page's theme settings: its scope, mode and the global mode.
  getThemeScope(): string;
  getGlobalThemeMode(): string;
  getThemeMode(): string;
  getRuntimeAssetUrl(path: unknown): string;
  settings: Pick<SettingsStore, 'get' | 'subscribe'>;
  // The clock's size and opacity as shown, a dragged slider's value included.
  preview: Pick<SettingPreview, 'get' | 'store'>;
  getSearchWidth(): unknown;
  getInputAutoFocusEnabled(): unknown;
  getShortcutsVisible(): unknown;
  getShortcutSize(): unknown;
  getShortcutGap(): unknown;
  getShortcutAddVisible(): unknown;
  getShortcutDockMagnificationEnabled(): unknown;
  getShortcutColumns(): unknown;
  getGlassStyle(): string;
  getGlassTheme(): unknown;
  remoteClient: Pick<RemoteContentClient, 'getWallpaper'>;
  wallpaperThumbnailCache: WallpaperThumbnailCache | null;
  localWallpaperStore: Pick<WallpaperLocalStore, 'buildTileThumbnail'>;
  warnWallpaperStoreFailure(message: string): (error: unknown) => void;
  getCrtParameterPercent(key: CrtParameterKey, value: unknown): number;
  // Runs a change to the open panel while animating its height.
  animateWallpaperPanelResize(mutate: () => void): void;
  document: Document;
  extensionRoutes: Pick<typeof LumnoExtensionRoutes, 'buildOptionsUrl'> | null | undefined;
  chrome: { runtime?: { getURL?: (path: string) => string } } | null | undefined;
  window: Window;
  panelUi: WallpaperPanelUi;
  online: OnlineWallpapers;
  library: WallpaperLibrary;
  choice: WallpaperChoice;
  overlay: Pick<WallpaperOverlay, 'store' | 'getOpacityForCurrentMode'>;
  panelView: WallpaperPanelView;
  effectPrefsStore: WallpaperEffectPrefsRuntime['store'];
  faviconStore: FaviconChooser['store'];
  imageCopyEvents: WallpaperImageCopies['events'];
}

const WALLPAPER_APPEARANCE_MODES: readonly AppearanceMode[] = ['system', 'light', 'dark'];
const THEME_SCOPES: readonly ThemeScope[] = ['global', 'home'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

// A cached panel tile: the thumbnail's URL and the data URL drawn from it.
interface TileThumbnailRecord {
  id: string;
  url: string;
  dataUrl: string;
}

function readTileThumbnailRecord(value: unknown): TileThumbnailRecord | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.dataUrl !== 'string' || !value.dataUrl) {
    return null;
  }
  return { id: value.id, url: typeof value.url === 'string' ? value.url : '', dataUrl: value.dataUrl };
}

function createPanelState(deps: PanelStateDeps) {
  const {
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
    settings,
    preview,
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
  } = deps;


  // A closed panel is drawn again only when it next opens; meanwhile this records that its
  // drawn state is out of date.
  let wallpaperPanelDrawPending = false;
  // Per curated photo: its panel tile from the thumbnail cache, '' while it is read or downloaded,
  // or null when that failed and the tile loads from Picsum as before.
  const curatedTileThumbnails = new Map<string, string | null>();
  // Shown while a tile is being read, so the tile does not start a Picsum request it may not need.
  const EMPTY_TILE_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  const BING_RECENT_TILE_LIMIT = 6;
  const BING_DAILY_HINT = 'A new Bing photo every day. A photo you pick while this is on stays for the rest of the day.';
  const CURATED_DAILY_HINT = 'A new photo every day from the category shown when you turn this on, ' +
    'the same on every synced device. A photo you pick stays for the rest of the day.';
  function getWallpaperButtonLabel(): string {
    return t('settings_tab_appearance', 'Appearance');
  }

  // ---- Appearance panel ----
  // The panel view renders from the state built here and calls back through
  // wallpaperPanelActions; this runtime owns the settings and their storage.

  function buildPanelToggle(checked: unknown, label: string): ToggleState {
    return { checked: Boolean(checked), label };
  }

  function getSliderMarks(values: readonly number[], toPercent: (value: number) => number): number[] {
    return values.map((value) => toPercent(value));
  }

  // Asset URLs, icons and slider marks: fixed for the page's lifetime.
  function createWallpaperPanelModel(): WallpaperPanelModel {
    const faviconInlineSvg: SvgNode = ['svg', { viewBox: '0 0 104 104', fill: 'none' }, [
      ['path', { opacity: 'var(--x-nt-favicon-shadow-opacity, 0.2)', d: NEWTAB_FAVICON_SVG_SHADOW_PATH, fill: 'currentColor' }],
      ['path', { d: NEWTAB_FAVICON_SVG_MAIN_PATH, fill: 'currentColor', 'fill-opacity': 'var(--x-nt-favicon-main-opacity, 0.5)' }]
    ]];
    const uniqueSorted = (values: number[]) => values
      .filter((value, index, array) => array.indexOf(value) === index)
      .sort((a, b) => a - b);
    return {
      appearanceOptions: WALLPAPER_APPEARANCE_MODES.map((mode) => ({ mode })),
      favicons: NEWTAB_FAVICON_OPTIONS.map((item) => ({
        id: item.id,
        inlineSvg: item.preview === 'inlineSvg' ? faviconInlineSvg : undefined,
        previewUrl: item.preview === 'inlineSvg' ? '' : getNewtabFaviconUrl(item)
      })),
      marks: {
        // One mark per snap point, so the marks show where the slider settles.
        searchWidth: getSliderMarks(getSearchWidthSnapPoints(), getSearchWidthPercent),
        shortcutColumns: getSliderMarks(getShortcutColumnsTickValues(), getShortcutColumnsPercent),
        shortcutSize: getSliderMarks(
          uniqueSorted([48, 64, 80, 96, 112].map((value) => normalizeShortcutSizeValue(value))),
          (value) => getShortcutLayoutPercent(value, shortcutSizeConfig, 48, 112, 64)
        ),
        shortcutGap: getSliderMarks(
          uniqueSorted([0, 8, 16, 24].map((value) => normalizeShortcutGapValue(value))),
          (value) => getShortcutLayoutPercent(value, shortcutGapConfig, 0, 24, 4)
        ),
        timeWeight: [50],
        // The default size, which the reset button returns to.
        timeSize: [getSliderMarkPercent(
          SETTINGS.NEWTAB_TIME_FONT_SIZE_DEFAULT,
          SETTINGS.NEWTAB_TIME_FONT_SIZE_MIN,
          SETTINGS.NEWTAB_TIME_FONT_SIZE_MAX
        )]
      }
    };
  }

  function getSliderMarkPercent(value: number, min: number, max: number): number {
    return max > min ? Math.round(((value - min) / (max - min)) * 10000) / 100 : 0;
  }

  function buildWallpaperPanelHeaderState(): WallpaperPanelState['header'] {
    return {
      title: t('newtab_appearance_settings_title', 'Appearance settings'),
      moreSettingsLabel: t('newtab_more_settings', 'More settings'),
      moreSettingsUrl: buildAppearanceSettingsUrl(),
      helpPrompt: t('newtab_help_footer_prompt', 'Not sure what an option does?'),
      helpText: t('newtab_help_footer_action', 'Visit the Help Center'),
      helpUrl: buildHelpCenterUrl()
    };
  }

  function getWallpaperAppearancePreviewUrl(mode: AppearanceMode): string {
    // Global covers every page, so it keeps the shared previews; New Tab gets miniature New Tabs.
    if (getThemeScope() !== 'home') {
      return getRuntimeAssetUrl(`assets/images/${mode}.svg`);
    }
    // Following "Global" looks like whatever Global is set to, not like following the system.
    const previewMode = mode === 'system' ? getGlobalThemeMode() : mode;
    return getRuntimeAssetUrl(`assets/images/newtab-${previewMode}.svg`);
  }

  function buildWallpaperThemeState(): WallpaperPanelState['theme'] {
    const scope: ThemeScope = panelUi.state.pendingThemeScope || (getThemeScope() === 'home' ? 'home' : 'global');
    const themeMode = getThemeMode();
    // While the options slide between scopes they keep the labels they left with.
    const modeLabels = panelUi.state.heldModeLabels || getAppearanceModeLabels(t, getThemeScope());
    return {
      title: t('settings_theme_title', 'Theme mode'),
      infoLabel: t('newtab_theme_scope_help_label', 'Theme scope info'),
      infoTooltip: t(
        'newtab_theme_scope_help',
        'Global: the default theme for all pages.\nNew Tab: applies only to the new tab page. Choose Follow "Global" to keep it in sync.'
      ),
      scope: {
        active: scope,
        label: t('newtab_theme_scope_label', 'Theme scope'),
        options: THEME_SCOPES.map((value) => {
          const label = value === 'home'
            ? t('newtab_theme_scope_home', 'New Tab')
            : t('newtab_theme_scope_global', 'Global');
          return {
            value,
            label,
            ariaLabel: formatMessage(
              'newtab_theme_scope_select_label',
              'Apply theme changes to {scope}',
              { scope: label }
            )
          };
        })
      },
      modes: WALLPAPER_APPEARANCE_MODES.map((mode) => ({
        mode,
        selected: mode === themeMode,
        label: modeLabels[mode],
        imageUrl: getWallpaperAppearancePreviewUrl(mode),
        // Marks the card that hands the choice back to Lumno's global setting.
        badgeUrl: mode === 'system' && getThemeScope() === 'home'
          ? getRuntimeAssetUrl('assets/images/lumno.png')
          : '',
        ariaLabel: formatMessage('mode_switch_title', '{name}: switch to {mode} mode', {
          name: 'Lumno',
          mode: modeLabels[mode]
        })
      }))
    };
  }

  function buildWallpaperSearchState(): WallpaperPanelState['search'] {
    const topContentMode = settings.get(newtabTopContentMode);
    const timeFont = SETTINGS.getNewtabTimeFont(settings.get(newtabTimeFont));
    const timeFontWeight = SETTINGS.resolveNewtabTimeFontWeight(timeFont.id, settings.get(newtabTimeFontWeight));
    const timeFontTitle = t('newtab_time_font_title', 'Time font');
    const timeFontSize = preview.get(newtabTimeFontSize);
    const timeOpacity = preview.get(newtabTimeOpacity);
    const timeInkTitle = t('newtab_time_ink_title', 'Time color');
    const width = normalizeSearchWidthValue(getSearchWidth());
    const timeVisible = topContentMode === 'time';
    const autoFocusTitle = t('newtab_input_auto_focus_title', 'Automatically focus input');
    const topContentTitle = t('settings_newtab_wordmark_title', 'Content above the search bar');
    const secondsTitle = t('newtab_time_show_seconds_title', 'Show seconds');
    const twelveHourTitle = t('newtab_time_12_hour_title', '12-hour clock');
    return {
      title: t('newtab_search_section_title', 'Search box'),
      width: {
        label: t('newtab_search_width_title', 'Search box width'),
        ariaLabel: t('newtab_search_width_aria', 'Adjust New Tab search box width'),
        value: width,
        min: getSearchWidthMin(),
        max: getSearchWidthMax(),
        suffix: ' px',
        valueText: formatSearchWidthValue(width)
      },
      autoFocus: {
        title: autoFocusTitle,
        infoLabel: t('newtab_input_auto_focus_help_label', 'Input auto-focus info'),
        infoTooltip: t(
          'newtab_input_auto_focus_help',
          'If you prefer to use the browser’s native address bar, turn this option off. The extension URL will no longer appear in the address bar.'
        ),
        toggle: buildPanelToggle(getInputAutoFocusEnabled(), autoFocusTitle)
      },
      topContent: {
        title: topContentTitle,
        tabs: {
          active: topContentMode,
          label: topContentTitle,
          options: withAriaLabels<TopContentMode>([
            { value: 'brand', label: t('newtab_top_content_brand', 'Brand') },
            { value: 'time', label: t('newtab_top_content_time', 'Time') },
            { value: 'off', label: t('newtab_top_content_off', 'Hide') }
          ])
        }
      },
      timeFont: {
        visible: timeVisible,
        title: timeFontTitle,
        ariaLabel: timeFontTitle,
        value: timeFont.id,
        options: SETTINGS.NEWTAB_TIME_FONTS.map((font) => ({ value: font.id, label: font.label }))
      },
      timeWeight: {
        visible: timeVisible,
        label: t('newtab_time_font_weight_title', 'Time font weight'),
        value: timeFontWeight,
        min: timeFont.minWeight,
        max: timeFont.maxWeight,
        resetLabel: t('newtab_time_font_weight_reset', 'Reset time font weight'),
        resetVisible: timeFontWeight !== timeFont.defaultWeight
      },
      timeSize: {
        visible: timeVisible,
        label: t('newtab_time_font_size_title', 'Time size'),
        value: timeFontSize,
        min: SETTINGS.NEWTAB_TIME_FONT_SIZE_MIN,
        max: SETTINGS.NEWTAB_TIME_FONT_SIZE_MAX,
        suffix: ' px',
        resetLabel: t('newtab_time_font_size_reset', 'Reset time size'),
        resetVisible: timeFontSize !== SETTINGS.NEWTAB_TIME_FONT_SIZE_DEFAULT
      },
      timeOpacity: {
        visible: timeVisible,
        label: t('newtab_time_opacity_title', 'Time opacity'),
        value: timeOpacity,
        min: SETTINGS.NEWTAB_TIME_OPACITY_MIN,
        max: SETTINGS.NEWTAB_TIME_OPACITY_MAX,
        suffix: '%',
        valueText: `${timeOpacity}%`,
        resetLabel: t('newtab_time_opacity_reset', 'Reset time opacity'),
        resetVisible: timeOpacity !== SETTINGS.NEWTAB_TIME_OPACITY_DEFAULT
      },
      timeInk: {
        visible: timeVisible,
        title: timeInkTitle,
        tabs: {
          active: settings.get(newtabTimeInk),
          label: timeInkTitle,
          options: withAriaLabels<TimeInk>([
            { value: 'auto', label: t('newtab_time_ink_auto', 'Auto') },
            { value: 'light', label: t('newtab_time_ink_light', 'Light') },
            { value: 'dark', label: t('newtab_time_ink_dark', 'Dark') }
          ])
        }
      },
      seconds: {
        visible: timeVisible,
        title: secondsTitle,
        toggle: buildPanelToggle(settings.get(newtabTimeSecondsVisible), secondsTitle)
      },
      twelveHour: {
        visible: timeVisible,
        title: twelveHourTitle,
        toggle: buildPanelToggle(settings.get(newtabTime12Hour), twelveHourTitle)
      }
    };
  }

  // Segment options whose buttons are named by their labels.
  function withAriaLabels<V extends string>(options: Array<SegmentOption<V>>): Array<SegmentOption<V>> {
    return options.map((option) => Object.assign(option, { ariaLabel: option.label }));
  }

  function buildWallpaperShortcutsState(): WallpaperPanelState['shortcuts'] {
    const enabled = Boolean(getShortcutsVisible());
    const title = t('settings_newtab_shortcuts_title', 'Shortcuts');
    const addTitle = t('settings_newtab_shortcut_add_title', 'Show “+”');
    const dockTitle = t(
      'settings_newtab_shortcut_dock_magnification_title',
      'macOS Dock-style magnification'
    );
    const size = normalizeShortcutSizeValue(getShortcutSize());
    const gap = normalizeShortcutGapValue(getShortcutGap());
    return {
      enabled,
      title,
      toggle: buildPanelToggle(enabled, title),
      add: { title: addTitle, toggle: buildPanelToggle(getShortcutAddVisible(), addTitle) },
      dock: { title: dockTitle, toggle: buildPanelToggle(getShortcutDockMagnificationEnabled(), dockTitle) },
      columns: {
        label: t('settings_newtab_shortcut_columns_title', 'Shortcuts per row'),
        value: normalizeShortcutColumnsValue(getShortcutColumns()),
        min: getShortcutColumnsMin(),
        max: getShortcutColumnsMax()
      },
      size: {
        label: t('settings_newtab_shortcut_size_title', 'Shortcut size'),
        value: size,
        min: getShortcutLayoutMin(shortcutSizeConfig, 48),
        max: getShortcutLayoutMax(shortcutSizeConfig, 48, 112),
        suffix: ' px',
        valueText: `${size} px`,
        resetLabel: t('settings_newtab_shortcut_size_reset', 'Reset shortcut size'),
        resetVisible: size !== getShortcutLayoutDefault(shortcutSizeConfig, 48, 112, 64)
      },
      gap: {
        label: t('settings_newtab_shortcut_gap_title', 'Shortcut spacing'),
        value: gap,
        min: getShortcutLayoutMin(shortcutGapConfig, 0),
        max: getShortcutLayoutMax(shortcutGapConfig, 0, 24),
        suffix: ' px',
        valueText: `${gap} px`,
        resetLabel: t('settings_newtab_shortcut_gap_reset', 'Reset shortcut spacing'),
        resetVisible: gap !== getShortcutLayoutDefault(shortcutGapConfig, 0, 24, 4)
      }
    };
  }

  function getWallpaperSelectLabel(name: string): string {
    return formatMessage('newtab_wallpaper_select_label', 'Select {name}', { name });
  }

  function buildWallpaperTileState(item: WallpaperItem, selectedTileId: string): TileState {
    return {
      id: item.id,
      thumbnailUrl: getWallpaperThumbnailUrl(item),
      selected: item.id === selectedTileId,
      label: getWallpaperSelectLabel(getWallpaperDisplayName(item))
    };
  }

  const NO_SELECTED_SOURCE: SelectedSourceState = Object.freeze({ visible: false, title: '', meta: '', url: '', linkLabel: '' });

  function buildSelectedSourceState(title: string, meta: string, url: string): SelectedSourceState {
    return {
      visible: true,
      title,
      meta,
      url,
      linkLabel: `${title} · ${t('newtab_bing_source', 'View wallpaper source')}`
    };
  }

  function buildDailyState(toggleChecked: boolean, hint: string, selected: WallpaperItem | null): DailyState {
    const label = t('newtab_bing_daily', 'Auto-update daily');
    return {
      label,
      infoTooltip: hint,
      restoreLabel: t('newtab_daily_restore', "Back to today's wallpaper"),
      restoreVisible: Boolean(selected && selected.picked),
      toggle: buildPanelToggle(toggleChecked, label)
    };
  }

  function getLocalWallpaperItems(): WallpaperItem[] {
    const { uploads, links } = library.state;
    return [...uploads, ...links.map((item) => getLinkWallpaperById(item.id))]
      .filter((item): item is WallpaperItem => Boolean(item))
      .sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
  }

  function buildLocalWallpaperState(label: string, selectedTileId: string): WallpaperPanelState['wallpaper']['local'] {
    const urlLabel = t('newtab_wallpaper_add_url', 'Add image link');
    return {
      label,
      deleteLabel: t('newtab_wallpaper_delete_local', 'Delete imported wallpaper'),
      upload: {
        label: t('newtab_wallpaper_add_local', 'Add local wallpaper'),
        loading: panelUi.state.importing,
        full: library.isFull()
      },
      url: {
        open: panelUi.state.urlFormOpen,
        invalid: panelUi.state.urlInvalid,
        clearToken: panelUi.state.urlClearToken,
        disabled: panelUi.state.importing,
        tileLabel: urlLabel,
        inputLabel: urlLabel,
        placeholder: t('newtab_wallpaper_url_placeholder', 'Paste an image link (https://…)'),
        submitLabel: t('newtab_wallpaper_url_submit', 'Add')
      },
      tiles: getLocalWallpaperItems().map((item) => buildWallpaperTileState(item, selectedTileId))
    };
  }

  function buildBingWallpaperState(selectedId: string, selectedTileId: string): WallpaperPanelState['wallpaper']['bing'] {
    const selected = REMOTE_CONTENT.getWallpaperProvider(selectedId) === 'bing'
      ? getWallpaperById(selectedId)
      : null;
    const busy = online.state.bingLoading || online.state.bingSelecting;
    // Bing skips some days, so cap the list to two full rows instead of leaving a ragged last row.
    const recent: WallpaperItem[] = online.state.bingItems;
    const items = (selected && selectedId !== REMOTE_CONTENT.BING_DAILY_ID &&
      !online.state.bingItems.some((item) => item.id === selectedId)
      ? [selected, ...recent]
      : recent).slice(0, BING_RECENT_TILE_LIMIT);
    const daily = buildDailyState(
      selectedId === REMOTE_CONTENT.BING_DAILY_ID,
      t('newtab_bing_daily_hint', BING_DAILY_HINT),
      selected
    );
    return {
      label: 'Bing',
      busy,
      loading: online.state.bingLoading && !online.state.bingItems.length,
      daily: Object.assign(daily, { busy: online.state.bingSelecting }),
      recentLabel: t('newtab_bing_recent', 'Recent wallpapers'),
      refresh: { label: t('newtab_bing_refresh', 'Refresh'), busy: online.state.bingLoading, disabled: busy },
      status: online.state.bingStatus === 'loading' && !online.state.bingItems.length
        ? t('newtab_bing_loading', 'Loading wallpapers…')
        : online.state.bingStatus === 'error'
          ? t('newtab_bing_error', 'Could not load wallpapers. Please try again.') : '',
      selected: selected && selected.date
        ? Object.assign(buildSelectedSourceState(selected.name || '', formatBingCopyright(selected.copyright),
          selected.sourceUrl || ''), {
          linkLabel: `${getBingWallpaperLabel(selected)} · ${t('newtab_bing_source', 'View wallpaper source')}`
        })
        : NO_SELECTED_SOURCE,
      tiles: items.map((item): OnlineTileState => {
        const wallpaper = remoteClient.getWallpaper(item.id);
        const label = getBingWallpaperLabel(wallpaper);
        return {
          id: item.id,
          thumbnailUrl: getWallpaperThumbnailUrl(wallpaper),
          selected: item.id === selectedTileId,
          contextMenuOpen: item.id === panelUi.state.onlineMenuId,
          disabled: online.state.bingSelecting,
          tooltip: label,
          label: getWallpaperSelectLabel(label)
        };
      })
    };
  }

  function getCuratedTileThumbnailUrl(item: RemoteWallpaper): string {
    const url = getWallpaperThumbnailUrl(item);
    // A photo with a cached wallpaper copy already shows that copy's thumbnail.
    if (!wallpaperThumbnailCache || url !== item.thumbnailUrl) return url;
    const tile = curatedTileThumbnails.get(item.id);
    // The closed panel keeps its grid in the page, where a Picsum URL would load on every new tab;
    // a tile not read yet stays empty until the curated tab shows it.
    return tile === null ? url : tile || EMPTY_TILE_IMAGE;
  }

  // Tiles the curated tab shows come from this device's thumbnail cache; a tile seen for the
  // first time downloads once and is kept, so reopening the panel, even days later, asks Picsum
  // only for photos it has not shown before.
  function loadCuratedTileThumbnails(items: RemoteWallpaper[]): RemoteWallpaper[] {
    if (!wallpaperThumbnailCache || !panelUi.state.open || panelUi.state.tab !== 'curated') return items;
    const pending = items.filter((item) => item.thumbnailUrl && !curatedTileThumbnails.has(item.id) &&
      getWallpaperThumbnailUrl(item) === item.thumbnailUrl);
    if (!pending.length) return items;
    pending.forEach((item) => curatedTileThumbnails.set(item.id, ''));
    void wallpaperThumbnailCache.readByIds(pending.map((item) => item.id)).catch((): unknown[] => []).then((records) => {
      const stored = new Map(records.flatMap((value): Array<[string, TileThumbnailRecord]> => {
        const record = readTileThumbnailRecord(value);
        return record ? [[record.id, record]] : [];
      }));
      pending.forEach((item) => {
        const record = stored.get(item.id);
        if (record && record.url === item.thumbnailUrl) {
          curatedTileThumbnails.set(item.id, record.dataUrl);
        } else {
          downloadCuratedTileThumbnail(item);
        }
      });
      renderWallpaperPanelState();
    });
    return items;
  }

  function downloadCuratedTileThumbnail(item: RemoteWallpaper): void {
    const thumbnailUrl = item.thumbnailUrl;
    const cache = wallpaperThumbnailCache;
    if (!thumbnailUrl || !cache) {
      return;
    }
    void fetchWallpaperFile(thumbnailUrl)
      .then((file) => localWallpaperStore.buildTileThumbnail(file))
      .then((dataUrl) => {
        curatedTileThumbnails.set(item.id, dataUrl);
        cache.write({ id: item.id, url: thumbnailUrl, dataUrl })
          .catch(warnWallpaperStoreFailure('Could not cache a wallpaper thumbnail.'));
      }, () => {
        curatedTileThumbnails.set(item.id, null);
      })
      .then(() => renderWallpaperPanelState());
  }

  function buildCuratedWallpaperState(
    label: string,
    selectedId: string,
    selectedTileId: string
  ): WallpaperPanelState['wallpaper']['curated'] {
    const selected = REMOTE_CONTENT.getWallpaperProvider(selectedId) === 'curated'
      ? getWallpaperById(selectedId)
      : null;
    const categoryLabel = t('newtab_curated_category', 'Category');
    const photoLabel = selected && selected.imageUrl ? getCuratedPhotoLabel(selected) : '';
    return {
      label,
      daily: buildDailyState(
        isCuratedDailyWallpaperActive(),
        t('newtab_curated_daily_hint', CURATED_DAILY_HINT),
        selected
      ),
      category: {
        label: categoryLabel,
        tabs: {
          active: online.state.curatedCategory,
          label: categoryLabel,
          options: REMOTE_CONTENT.CURATED_CATEGORIES.map((value) => ({
            value,
            label: getCuratedCategoryLabel(value)
          }))
        }
      },
      listLabel: t('newtab_curated_list', 'Photos'),
      mix: buildCuratedMixState(),
      refreshLabel: t('newtab_curated_more', 'Show others'),
      selected: photoLabel && selected
        ? buildSelectedSourceState(photoLabel, getCuratedPhotoMeta(selected), selected.sourceUrl || '')
        : NO_SELECTED_SOURCE,
      tiles: loadCuratedTileThumbnails(getCuratedTileItems()).map((item): OnlineTileState => {
        const wallpaper = remoteClient.getWallpaper(item.id);
        const tileLabel = [getCuratedPhotoLabel(wallpaper), wallpaper && wallpaper.title ? wallpaper.name : '']
          .filter(Boolean)
          .join(' · ');
        return {
          id: item.id,
          thumbnailUrl: getCuratedTileThumbnailUrl(item),
          selected: item.id === selectedTileId,
          contextMenuOpen: item.id === panelUi.state.onlineMenuId,
          tooltip: tileLabel,
          label: getWallpaperSelectLabel(tileLabel)
        };
      })
    };
  }

  // Shown on the random tab only: which categories the mix, and its daily photo, draw from.
  function buildCuratedMixState(): CuratedMixState {
    const included = REMOTE_CONTENT.getRandomMixCategories();
    const categories = REMOTE_CONTENT.CURATED_CATEGORIES.filter((value) => value !== REMOTE_CONTENT.RANDOM_CATEGORY);
    const names = included.map((value) => getCuratedCategoryLabel(value));
    let label = t('newtab_curated_mix_all', 'All categories');
    if (included.length < categories.length) {
      label = included.length <= 2
        ? names.join(t('newtab_curated_mix_separator', ', '))
        : formatMessage('newtab_curated_mix_count', '{count} categories', { count: included.length });
    }
    return {
      visible: online.state.curatedCategory === REMOTE_CONTENT.RANDOM_CATEGORY,
      label,
      ariaLabel: t('newtab_curated_mix_aria', 'Categories in the mix'),
      options: categories.map((value) => {
        const checked = included.includes(value);
        return {
          value,
          label: getCuratedCategoryLabel(value),
          checkbox: true,
          checked,
          // The mix keeps at least one category.
          disabled: checked && included.length === 1
        };
      })
    };
  }

  function buildWallpaperEffectSliderState(
    labelInfo: { labelKey: string; fallback: string },
    value: unknown,
    visible: boolean,
    max: number,
    percent: boolean
  ): SliderState & { visible: boolean } {
    const number = Number(value);
    const normalizedValue = Number.isFinite(number) ? number : 0;
    return {
      label: t(labelInfo.labelKey, labelInfo.fallback),
      value: normalizedValue,
      min: 0,
      max,
      visible,
      disabled: !visible,
      suffix: percent ? '%' : '',
      valueText: percent ? `${normalizedValue}%` : String(normalizedValue)
    };
  }

  function buildWallpaperEffectState(): WallpaperPanelState['wallpaper']['effect'] {
    const prefs = getWallpaperEffectPrefsForEditMode();
    const visibility = getWallpaperEffectControlVisibility(prefs);
    const title = t('newtab_wallpaper_effect_title', 'Wallpaper filter');
    const inkTitle = t('newtab_wallpaper_effect_ink_title', 'Sample tones');
    const blockMax = prefs.type === 'blocks' ? BLOCK_PARAMETER_MAX : 100;
    const crtSlider = (key: 'crtBloom' | 'crtRgbOffset' | 'crtCurvature', labelKey: string, fallback: string) => buildWallpaperEffectSliderState(
      { labelKey, fallback },
      getCrtParameterPercent(key, prefs[key]),
      visibility[key],
      100,
      true
    );
    return {
      label: title,
      select: {
        ariaLabel: title,
        value: prefs.type,
        options: NEWTAB_WALLPAPER_EFFECT_TYPES.map((item) => ({
          value: item.type,
          label: getWallpaperEffectLabel(item.type)
        }))
      },
      inkTone: {
        visible: visibility.inkTone,
        label: inkTitle,
        tabs: {
          active: getWallpaperEffectInkToneForUi(prefs),
          label: inkTitle,
          options: NEWTAB_WALLPAPER_EFFECT_INK_TONES.map((item) => {
            const label = getWallpaperEffectInkToneLabel(item.tone);
            return {
              value: item.tone,
              label,
              ariaLabel: formatMessage(
                'newtab_wallpaper_effect_ink_select_label',
                'Sample {tone} for dots or characters',
                { tone: label }
              )
            };
          })
        }
      },
      sliders: {
        strength: buildWallpaperEffectSliderState(
          getWallpaperEffectStrengthLabel(prefs),
          prefs.type === 'crt' ? getCrtParameterPercent('crtStrength', prefs.crtStrength) : prefs.strength,
          visibility.strength,
          100,
          prefs.type === 'crt'
        ),
        size: buildWallpaperEffectSliderState(
          getWallpaperEffectSizeLabel(prefs),
          prefs.type === 'blocks' ? prefs.blockSize : prefs.size,
          visibility.size,
          blockMax,
          false
        ),
        spacing: buildWallpaperEffectSliderState(
          getWallpaperEffectSpacingLabel(prefs),
          Math.round(clampNumber(prefs.spacing, 0, prefs.type === 'blocks' ? 5 : 100)),
          visibility.spacing,
          blockMax,
          true
        ),
        texture: buildWallpaperEffectSliderState(
          getWallpaperEffectTextureLabel(),
          prefs.texture,
          visibility.texture,
          100,
          false
        ),
        crtBloom: crtSlider('crtBloom', 'newtab_wallpaper_effect_crt_bloom', 'Bloom'),
        crtRgbOffset: crtSlider('crtRgbOffset', 'newtab_wallpaper_effect_crt_rgb_offset', 'RGB offset'),
        crtCurvature: crtSlider('crtCurvature', 'newtab_wallpaper_effect_crt_curvature', 'Screen curvature')
      }
    };
  }

  function buildWallpaperSectionState(): WallpaperPanelState['wallpaper'] {
    const enabled = hasAnyWallpaperEnabled();
    const selectedId = getWallpaperSelectionIdForUi();
    const selectedTileId = getWallpaperTileSelectionId(selectedId);
    const split = Boolean(choice.state.prefs && choice.state.prefs.sameForModes === false);
    const builtInLabel = t('newtab_wallpaper_builtin_section', 'Built-in');
    const localLabel = t('newtab_wallpaper_local_section', 'Local');
    const curatedLabel = t('newtab_wallpaper_curated_section', 'Curated');
    const sourceLabel = t('newtab_wallpaper_source_title', 'Source');
    return {
      title: t('newtab_wallpaper_title', 'Wallpaper'),
      enabled,
      toggle: buildPanelToggle(enabled, t('newtab_wallpaper_toggle_label', 'Toggle wallpaper')),
      activeTab: panelUi.state.tab,
      modeSync: {
        title: t('newtab_wallpaper_mode_sync_title', 'Match light and dark mode'),
        toggle: buildPanelToggle(
          !split,
          t('newtab_wallpaper_mode_sync_toggle_label', 'Use the same wallpaper for light and dark mode')
        )
      },
      mode: {
        visible: split,
        label: t('newtab_wallpaper_mode_row_title', 'Mode'),
        tabs: {
          active: normalizeWallpaperMode(choice.state.editMode),
          label: t('newtab_wallpaper_mode_tabs_label', 'Wallpaper color mode'),
          options: NEWTAB_WALLPAPER_MODES.map((mode) => ({
            value: mode,
            label: mode === NEWTAB_WALLPAPER_MODE_DARK
              ? t('newtab_wallpaper_dark_mode_tab', 'Dark')
              : t('newtab_wallpaper_light_mode_tab', 'Light'),
            ariaLabel: formatMessage(
              'newtab_wallpaper_mode_select_label',
              'Edit {mode} wallpaper',
              { mode: getWallpaperModeLabel(mode) }
            )
          }))
        }
      },
      source: {
        label: sourceLabel,
        tabs: {
          active: panelUi.state.tab,
          label: sourceLabel,
          options: withAriaLabels<WallpaperSourceTab>([
            { value: 'built-in', label: builtInLabel },
            { value: 'local', label: localLabel },
            { value: 'bing', label: 'Bing' },
            { value: 'curated', label: curatedLabel }
          ])
        }
      },
      builtIn: {
        label: builtInLabel,
        tiles: NEWTAB_WALLPAPER_OPTIONS.map((item) => Object.assign(
          buildWallpaperTileState(item, selectedTileId),
          { path: getWallpaperLocalPath(item) }
        ))
      },
      local: buildLocalWallpaperState(localLabel, selectedTileId),
      bing: buildBingWallpaperState(selectedId, selectedTileId),
      curated: buildCuratedWallpaperState(curatedLabel, selectedId, selectedTileId),
      overlay: {
        label: t('newtab_wallpaper_overlay_opacity', 'Mask effect'),
        value: overlay.getOpacityForCurrentMode(),
        min: 0,
        max: 100
      },
      effect: buildWallpaperEffectState()
    };
  }

  // The panel's state, once its actions exist.
  function buildWallpaperPanelState(): WallpaperPanelState | null {
    const actions = panelActions;
    if (!actions) {
      return null;
    }
    const glassStyleValue = getGlassStyle();
    const glassThemeTitle = t('settings_newtab_glass_theme_title', 'Material theme');
    return {
      actions,
      open: panelUi.state.open,
      panelLabel: t('settings_tab_appearance', 'Appearance'),
      button: { active: Boolean(choice.state.shownId), label: getWallpaperButtonLabel() },
      header: buildWallpaperPanelHeaderState(),
      theme: buildWallpaperThemeState(),
      glassStyle: {
        sectionTitle: t('newtab_style_section_title', 'Style'),
        title: t('settings_newtab_glass_style_title', 'Material'),
        infoTooltip: t('settings_newtab_glass_style_desc', 'Change the material of New Tab UI elements.'),
        ariaLabel: t('settings_newtab_glass_style_title', 'Material'),
        value: glassStyleValue,
        options: [
          { value: 'none', label: t('settings_newtab_glass_style_none', 'Default') },
          { value: 'frosted', label: t('settings_newtab_glass_style_frosted', 'Frosted glass'), badge: 'Beta' },
          { value: 'liquid', label: t('settings_newtab_glass_style_liquid', 'Liquid glass'), badge: 'Beta' }
        ],
        theme: {
          visible: glassStyleValue !== 'none',
          title: glassThemeTitle,
          infoTooltip: t('settings_newtab_glass_theme_desc', 'Auto: follows Theme mode, but switches to dark material over darker wallpapers to keep text legible.\nLight / Dark: fix the material and set New Tab to the same theme.'),
          tabs: {
            active: SETTINGS.newtabGlassTheme.parse(getGlassTheme()),
            label: glassThemeTitle,
            options: withAriaLabels<GlassTheme>([
              { value: 'follow', label: t('settings_newtab_glass_theme_follow', 'Auto') },
              { value: 'light', label: t('settings_newtab_glass_theme_light', 'Light') },
              { value: 'dark', label: t('settings_newtab_glass_theme_dark', 'Dark') }
            ])
          }
        }
      },
      search: buildWallpaperSearchState(),
      shortcuts: buildWallpaperShortcutsState(),
      wallpaper: buildWallpaperSectionState(),
      favicon: buildNewtabFaviconState()
    };
  }

  // What changes the panel's height: a change here animates the resize.
  function getWallpaperPanelLayoutKey(state: WallpaperPanelState): string {
    const wallpaper = state.wallpaper;
    return JSON.stringify([
      wallpaper.activeTab,
      wallpaper.mode.visible ? wallpaper.mode.tabs.active : '',
      wallpaper.local.tiles.length,
      wallpaper.curated.category.tabs.active
    ]);
  }

  // The panel's actions, and the state and layout last drawn.
  let panelActions: WallpaperPanelActions | null = null;
  let drawnState: WallpaperPanelState | null = null;
  let drawnLayoutKey = '';

  // Draws the panel for the first time, with the actions its controls call.
  function mountWallpaperPanel(actions: WallpaperPanelActions): void {
    panelActions = actions;
    const state = buildWallpaperPanelState();
    if (!state) {
      return;
    }
    drawnState = state;
    drawnLayoutKey = getWallpaperPanelLayoutKey(state);
    panelView.mount(createWallpaperViewController({
      documentObj: document,
      model: createWallpaperPanelModel(),
      state
    }));
  }

  // Rebuilds the panel state and renders it; while the panel is open the DOM is current when
  // this returns. A closed panel waits for its next open, and only its button, which stays on
  // the page, follows the state at once: the New Tab start-up changes the state many times,
  // and drawing the whole hidden panel for each change held the page back.
  function renderWallpaperPanelState(): void {
    if (!panelView.controller) {
      return;
    }
    if (!panelUi.state.open) {
      wallpaperPanelDrawPending = true;
      syncClosedWallpaperButton();
      return;
    }
    drawWallpaperPanelState();
  }

  // The button's attributes as the view draws them; React leaves an attribute alone while its
  // value matches the last render, so the DOM set here stays right until the next draw.
  function syncClosedWallpaperButton(): void {
    if (!panelView.button) {
      return;
    }
    const label = getWallpaperButtonLabel();
    const active = choice.state.shownId ? 'true' : 'false';
    if (label) {
      panelView.button.setAttribute('aria-label', label);
    } else {
      panelView.button.removeAttribute('aria-label');
    }
    panelView.button.setAttribute('aria-pressed', active);
    panelView.button.setAttribute('data-active', active);
  }

  function drawWallpaperPanelState(): void {
    const controller = panelView.controller;
    const state = controller ? buildWallpaperPanelState() : null;
    if (!controller || !state) {
      return;
    }
    const previous = wallpaperPanelDrawPending ? null : drawnState;
    wallpaperPanelDrawPending = false;
    const layoutKey = getWallpaperPanelLayoutKey(state);
    const layoutChanged = Boolean(previous) && layoutKey !== drawnLayoutKey;
    drawnState = state;
    drawnLayoutKey = layoutKey;
    // Rows that show or hide (mode, link form, effect controls) animate their own height
    // through .x-nt-panel-collapsible.
    const apply = () => controller.render(state);
    if (layoutChanged) {
      animateWallpaperPanelResize(apply);
      return;
    }
    apply();
  }

  function getWallpaperPanelRefs(): Readonly<Partial<Record<string, HTMLElement>>> {
    return panelView.controller ? panelView.controller.getRefs() : {};
  }

  function isWallpaperTileSelected(id: string): boolean {
    return getWallpaperTileSelectionId(getWallpaperSelectionIdForUi()) === id;
  }

  // Overlay and filter sliders snap to their marks while dragged.
  function getWallpaperStyleSliderValue(
    value: unknown,
    fallbackValue: unknown,
    change: SliderChange | null | undefined,
    snap: boolean
  ): number {
    return change && change.dragging && snap
      ? snapWallpaperOverlaySliderValue(value)
      : normalizeWallpaperOverlayOpacity(value, fallbackValue);
  }
  // The wallpaper article opens with how this panel works, so it is the panel's help page.
  function buildHelpCenterUrl(): string {
    const communityLinks = LumnoCommunityLinks;
    if (!communityLinks || typeof communityLinks.getHelpUrl !== 'function') {
      return '';
    }
    const htmlLang = document.documentElement && document.documentElement.lang;
    return communityLinks.getHelpUrl(htmlLang, 'newtab-wallpaper');
  }

  function buildAppearanceSettingsUrl(): string {
    if (extensionRoutes && typeof extensionRoutes.buildOptionsUrl === 'function') {
      return extensionRoutes.buildOptionsUrl(chrome, 'appearance');
    }
    if (chrome && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
      return `${chrome.runtime.getURL('src/options/options.html')}#appearance`;
    }
    try {
      return new URL('../options/options.html#appearance', document.baseURI || window.location.href).toString();
    } catch {
      return '../options/options.html#appearance';
    }
  }


  // The panel draws whatever it shows as soon as that changes.
  panelUi.store.subscribe(() => renderWallpaperPanelState());
  online.store.subscribe(() => renderWallpaperPanelState());
  library.store.subscribe(() => renderWallpaperPanelState());
  choice.store.subscribe(() => renderWallpaperPanelState());
  overlay.store.subscribe(() => renderWallpaperPanelState());
  effectPrefsStore.subscribe(() => renderWallpaperPanelState());
  faviconStore.subscribe(() => renderWallpaperPanelState());
  // A link's tile shows its copy once cached.
  imageCopyEvents.on('cached', (copy) => {
    if (library.state.uploadsLoaded && isLinkWallpaperId(copy.photoId)) {
      renderWallpaperPanelState();
    }
  });
  // The settings the panel shows, whoever changed them, and the sliders' previews.
  settings.subscribe(
    [...NEWTAB_TOP_CONTENT_SETTINGS, ...NEWTAB_SHORTCUT_GRID_SETTINGS, newtabWidthMode, newtabSearchWidth, newtabInputAutoFocusEnabled],
    () => renderWallpaperPanelState()
  );
  preview.store.subscribe(() => renderWallpaperPanelState());

  return {
    mountWallpaperPanel,
    getWallpaperButtonLabel,
    createWallpaperPanelModel,
    buildWallpaperPanelState,
    getWallpaperPanelLayoutKey,
    renderWallpaperPanelState,
    drawWallpaperPanelState,
    getWallpaperPanelRefs,
    isWallpaperTileSelected,
    getWallpaperStyleSliderValue
  };
}

type PanelState = ReturnType<typeof createPanelState>;

export { createPanelState };
export type { CrtParameterKey, PanelState, PanelStateDeps };
