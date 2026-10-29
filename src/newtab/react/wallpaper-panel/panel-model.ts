// The appearance panel's model, state and actions types, and the ids and
// refs its tabs, selects and effect sliders are found by.
import type {
  ToggleState,
  TooltipActions,
  SliderChange,
  SegmentState,
  SliderState
} from './panel-primitives';
import type { SelectMenuOption } from '../../../shared/react/select-menu/menu-options';
import type { SvgNode } from '../../../shared/ui/svg-tree';

// The appearance panel renders from two inputs: a static model (asset URLs, icons,
// slider marks) given once, and the state the wallpaper runtime rebuilds whenever a
// setting changes. Every control reports through `state.actions`; the runtime owns
// the data and its storage. The bookmark and site card sections, and the quote
// section, render from models of their own, which their runtimes hand the panel.

export type WallpaperSourceTab = 'built-in' | 'local' | 'bing' | 'curated';
export type WallpaperMode = 'light' | 'dark';
export type ThemeScope = 'global' | 'home';
export type TopContentMode = 'brand' | 'time' | 'off';
export type TimeInk = 'auto' | 'light' | 'dark';
export type GlassTheme = 'follow' | 'light' | 'dark';
export type EffectSliderKey =
  | 'strength'
  | 'size'
  | 'spacing'
  | 'texture'
  | 'crtBloom'
  | 'crtRgbOffset'
  | 'crtCurvature';

export const EFFECT_SLIDER_KEYS: EffectSliderKey[] = [
  'strength',
  'size',
  'spacing',
  'texture',
  'crtBloom',
  'crtRgbOffset',
  'crtCurvature'
];

type WallpaperItem = {
  id: string;
  path?: string;
  thumbnailUrl: string;
};

export type FaviconItem = {
  id: string;
  inlineSvg?: SvgNode;
  previewUrl?: string;
};

export interface WallpaperPanelModel {
  appearanceOptions?: Array<{ mode: string }>;
  favicons?: FaviconItem[];
  /** Notches (0-100) drawn on each slider's track. */
  marks?: Partial<Record<'searchWidth' | 'shortcutColumns' | 'shortcutSize' | 'shortcutGap' | 'timeWeight' | 'timeSize', number[]>>;
  wallpapers?: WallpaperItem[];
}

export interface TileState {
  id: string;
  label: string;
  path?: string;
  selected: boolean;
  thumbnailUrl: string;
}

export interface OnlineTileState extends TileState {
  // Its context menu is open.
  contextMenuOpen?: boolean;
  disabled?: boolean;
  tooltip: string;
}

export interface SelectedSourceState {
  linkLabel: string;
  meta: string;
  title: string;
  url: string;
  visible: boolean;
}

export interface DailyState {
  infoTooltip: string;
  label: string;
  restoreLabel: string;
  restoreVisible: boolean;
  toggle: ToggleState;
}

export interface PanelSelectModel {
  ariaLabel: string;
  onChange(value: string): void;
  options: SelectMenuOption[];
  value: string;
}

// The bookmark section's settings in the panel.
export interface BookmarkSettingsState {
  title: string;
  // The section shows on the page.
  enabled: boolean;
  expanded: boolean;
  viewModeLabel: string;
  viewModeSelect: PanelSelectModel;
  // The top bar replaces the grid, with settings of its own.
  topbarMode: boolean;
  rows: SliderState;
  columns: SliderState;
  folderIconsTitle: string;
  folderIcons: ToggleState;
  topbarLayoutLabel: string;
  topbarLayout: SegmentState<'docked' | 'floating'>;
  topbarSurfaceLabel: string;
  topbarSurfaceSelect: PanelSelectModel;
}

// The site card section's settings in the panel.
export interface RecentSettingsState {
  title: string;
  enabled: boolean;
  expanded: boolean;
  modeLabel: string;
  mode: SegmentState<'latest' | 'most'>;
  rowsLabel: string;
  rows: SegmentState<'1' | '2'>;
}

export interface SectionSettingsActions {
  toggleBookmarkExpanded(): void;
  setBookmarkVisible(visible: boolean): void;
  setBookmarkRows(rows: number, change: SliderChange): void;
  setBookmarkColumns(columns: number, change: SliderChange): void;
  setBookmarkFolderIconsVisible(visible: boolean): void;
  setBookmarkTopbarLayout(layout: 'docked' | 'floating'): void;
  toggleRecentExpanded(): void;
  setRecentVisible(visible: boolean): void;
  setRecentMode(mode: 'latest' | 'most'): void;
  setRecentRows(rows: '1' | '2'): void;
}

// What the bookmark and site card runtime hands the panel.
export interface SectionSettingsModel {
  bookmark: BookmarkSettingsState;
  recent: RecentSettingsState;
  actions: SectionSettingsActions;
}

// The quote section's settings in the panel.
export interface QuoteSettingsState {
  title: string;
  enabled: boolean;
  expanded: boolean;
  // Where the quotes come from, beside the title.
  infoTooltip: string;
  sourceLabel: string;
  source: SegmentState<'hitokoto' | 'custom'>;
  customMode: boolean;
  library: {
    title: string;
    infoTooltip: string;
    importLabel: string;
    importing: boolean;
    shuffleLabel: string;
    shuffleVisible: boolean;
    // Shown under the title when an import fails.
    status: { text: string; error: boolean } | null;
    // How many quotes the collection holds; hovering it names the file.
    count: { text: string; label: string; filename: string } | null;
  };
  categoryLabel: string;
  category: SegmentState<'literature' | 'poetry'>;
  positionLabel: string;
  positionSelect: PanelSelectModel;
  fontLabel: string;
  fontSelect: PanelSelectModel;
  fontSize: SliderState;
}

export interface QuoteSettingsActions {
  toggleExpanded(): void;
  setEnabled(enabled: boolean): void;
  setProvider(provider: 'hitokoto' | 'custom'): void;
  importFile(file: File): void;
  shuffleLibrary(): void;
  setCategory(category: 'literature' | 'poetry'): void;
  setFontSize(size: number, change: SliderChange): void;
}

// What the quote runtime hands the panel.
export interface QuoteSettingsModel {
  quote: QuoteSettingsState;
  actions: QuoteSettingsActions;
}

export interface CuratedMixState {
  ariaLabel: string;
  label: string;
  options: SelectMenuOption[];
  visible: boolean;
}

export interface WallpaperPanelActions extends TooltipActions {
  clearUrlInvalid(): void;
  deleteWallpaper(id: string): void;
  importWallpaperFile(file: File): void;
  /** Right-click on a Bing or curated photo. */
  openOnlineWallpaperMenu(id: string, element: HTMLElement, point: { x: number; y: number }): void;
  primeWallpaper(id: string): void;
  refreshBing(): void;
  resetShortcutGap(): void;
  resetShortcutSize(): void;
  resetTimeFontWeight(): void;
  resetTimeFontSize(): void;
  resetTimeOpacity(): void;
  restoreDailyWallpaper(): void;
  selectBingWallpaper(id: string): void;
  selectCuratedCategory(category: string): void;
  setCuratedMixCategory(category: string, included: boolean): void;
  selectCuratedWallpaper(id: string): void;
  selectEffect(type: string): void;
  selectFavicon(id: string): void;
  selectInkTone(tone: string): void;
  selectSourceTab(tab: WallpaperSourceTab): void;
  selectThemeMode(mode: string): void;
  selectThemeScope(scope: ThemeScope): void;
  selectTimeInk(ink: TimeInk): void;
  selectTopContent(mode: TopContentMode): void;
  selectWallpaper(id: string): void;
  selectWallpaperMode(mode: WallpaperMode): void;
  setBingDaily(enabled: boolean): void;
  setCuratedDaily(enabled: boolean): void;
  setEffectParameter(key: EffectSliderKey, value: number, change: SliderChange): void;
  setInputAutoFocus(enabled: boolean): void;
  selectGlassTheme(theme: GlassTheme): void;
  setGlassStyle(value: string): void;
  setModeSync(enabled: boolean): void;
  setOverlay(value: number, change: SliderChange): void;
  setSearchWidth(value: number, change: SliderChange): void;
  setShortcutAddVisible(visible: boolean): void;
  setShortcutColumns(value: number, change: SliderChange): void;
  setShortcutDockMagnification(enabled: boolean): void;
  setShortcutGap(value: number, change: SliderChange): void;
  setShortcutSize(value: number, change: SliderChange): void;
  setShortcutsVisible(visible: boolean): void;
  setTimeFontWeight(value: number, change: SliderChange): void;
  setTimeFontSize(value: number, change: SliderChange): void;
  setTimeOpacity(value: number, change: SliderChange): void;
  setTimeFont(value: string): void;
  setTimeSecondsVisible(visible: boolean): void;
  setTime12Hour(enabled: boolean): void;
  setWallpaperEnabled(enabled: boolean): void;
  showButtonTooltip(anchor: HTMLElement): void;
  showLocalWallpaperLimit(): void;
  showMoreCurated(): void;
  submitWallpaperUrl(url: string): void;
  togglePanel(): void;
  toggleUrlForm(): void;
}

export interface WallpaperPanelState {
  actions: WallpaperPanelActions;
  button: { active: boolean; label: string };
  favicon: {
    options: Array<{ id: string; label: string; selected: boolean }>;
    title: string;
  };
  header: {
    helpPrompt: string;
    helpText: string;
    helpUrl: string;
    moreSettingsLabel: string;
    moreSettingsUrl: string;
    title: string;
  };
  open: boolean;
  panelLabel: string;
  glassStyle: {
    ariaLabel: string;
    infoTooltip: string;
    options: SelectMenuOption[];
    sectionTitle: string;
    theme: { infoTooltip: string; tabs: SegmentState<GlassTheme>; title: string; visible: boolean };
    title: string;
    value: string;
  };
  search: {
    autoFocus: { infoLabel: string; infoTooltip: string; title: string; toggle: ToggleState };
    seconds: { title: string; toggle: ToggleState; visible: boolean };
    twelveHour: { title: string; toggle: ToggleState; visible: boolean };
    timeFont: { ariaLabel: string; options: SelectMenuOption[]; title: string; value: string; visible: boolean };
    timeWeight: SliderState & { resetLabel: string; resetVisible: boolean; visible: boolean };
    timeSize: SliderState & { resetLabel: string; resetVisible: boolean; visible: boolean };
    timeOpacity: SliderState & { resetLabel: string; resetVisible: boolean; visible: boolean };
    timeInk: { tabs: SegmentState<TimeInk>; title: string; visible: boolean };
    title: string;
    topContent: { title: string; tabs: SegmentState<TopContentMode> };
    width: SliderState;
  };
  shortcuts: {
    add: { title: string; toggle: ToggleState };
    columns: SliderState;
    dock: { title: string; toggle: ToggleState };
    enabled: boolean;
    gap: SliderState & { resetLabel: string; resetVisible: boolean };
    size: SliderState & { resetLabel: string; resetVisible: boolean };
    title: string;
    toggle: ToggleState;
  };
  theme: {
    infoLabel: string;
    infoTooltip: string;
    modes: Array<{
      ariaLabel: string;
      badgeUrl?: string;
      imageUrl: string;
      label: string;
      mode: string;
      selected: boolean;
    }>;
    scope: SegmentState<ThemeScope>;
    title: string;
  };
  wallpaper: {
    activeTab: WallpaperSourceTab;
    bing: {
      busy: boolean;
      daily: DailyState & { busy: boolean };
      label: string;
      loading: boolean;
      recentLabel: string;
      refresh: { busy: boolean; disabled: boolean; label: string };
      selected: SelectedSourceState;
      status: string;
      tiles: OnlineTileState[];
    };
    builtIn: { label: string; tiles: TileState[] };
    curated: {
      category: { label: string; tabs: SegmentState };
      daily: DailyState;
      label: string;
      listLabel: string;
      mix?: CuratedMixState;
      refreshLabel: string;
      selected: SelectedSourceState;
      tiles: OnlineTileState[];
    };
    effect: {
      inkTone: { label: string; tabs: SegmentState; visible: boolean };
      label: string;
      select: { ariaLabel: string; options: SelectMenuOption[]; value: string };
      sliders: Record<EffectSliderKey, SliderState & { visible: boolean }>;
    };
    enabled: boolean;
    local: {
      deleteLabel: string;
      label: string;
      tiles: TileState[];
      upload: { full?: boolean; label: string; loading: boolean };
      url: {
        clearToken: number;
        disabled: boolean;
        inputLabel: string;
        invalid: boolean;
        open: boolean;
        placeholder: string;
        submitLabel: string;
        tileLabel: string;
      };
    };
    mode: { label: string; tabs: SegmentState<WallpaperMode>; visible: boolean };
    modeSync: { title: string; toggle: ToggleState };
    overlay: SliderState;
    source: { label: string; tabs: SegmentState<WallpaperSourceTab> };
    title: string;
    toggle: ToggleState;
  };
}

export const SOURCE_TAB_REFS: Record<WallpaperSourceTab, string> = {
  'built-in': 'builtInTab',
  local: 'localTab',
  bing: 'bingTab',
  curated: 'curatedTab'
};

export const sourceTabId = (tab: string) => `_x_extension_newtab_wallpaper_tab_${tab}_2026_unique_`;
export const sourcePanelId = (tab: string) => `_x_extension_newtab_wallpaper_panel_${tab}_2026_unique_`;

export const EFFECT_SELECT_ID = 'x-nt-wallpaper-effect';
export const CURATED_MIX_SELECT_ID = 'x-nt-curated-mix';
export const QUOTE_POSITION_SELECT_ID = 'x-nt-quote-position';
export const QUOTE_FONT_SELECT_ID = 'x-nt-quote-font';
export const BOOKMARK_VIEW_MODE_SELECT_ID = 'x-nt-bookmark-view-mode';
export const BOOKMARK_TOPBAR_SURFACE_SELECT_ID = 'x-nt-bookmark-topbar-surface';
export const GLASS_STYLE_SELECT_ID = 'x-nt-glass-style';
export const TIME_FONT_SELECT_ID = 'x-nt-time-font';
export const SELECT_HOST_REFS: Record<string, string> = {
  [GLASS_STYLE_SELECT_ID]: 'glassStyleSelectHost',
  [TIME_FONT_SELECT_ID]: 'timeFontSelectHost',
  [EFFECT_SELECT_ID]: 'effectSelectHost',
  [CURATED_MIX_SELECT_ID]: 'curatedMixSelectHost',
  [QUOTE_POSITION_SELECT_ID]: 'quotePositionSelectHost',
  [QUOTE_FONT_SELECT_ID]: 'quoteFontSelectHost',
  [BOOKMARK_VIEW_MODE_SELECT_ID]: 'bookmarkViewModeSelectHost',
  [BOOKMARK_TOPBAR_SURFACE_SELECT_ID]: 'bookmarkTopbarSurfaceSelectHost'
};
export const SELECT_IDS = Object.keys(SELECT_HOST_REFS);


export const EFFECT_SLIDER_REFS: Record<EffectSliderKey, string> = {
  strength: 'effectStrength',
  size: 'effectSize',
  spacing: 'effectSpacing',
  texture: 'effectTexture',
  crtBloom: 'effectCrtBloom',
  crtRgbOffset: 'effectCrtRgbOffset',
  crtCurvature: 'effectCrtCurvature'
};

export function controlVisibility(visible: boolean) {
  return {
    'aria-hidden': visible ? 'false' as const : 'true' as const,
    'data-visible': visible ? 'true' : 'false'
  };
}

export function collapsible(expanded: boolean, withHidden = true) {
  return {
    ...controlVisibility(expanded),
    ...(withHidden ? { hidden: !expanded } : {})
  };
}

// The panel's state as its owner last set it.
export interface WallpaperPanelStateSlot {
  state: WallpaperPanelState;
}

// A section's model as its runtime last set it; null until the panel first opens.
export interface SectionSettingsSlot {
  model: SectionSettingsModel | null;
}

export interface QuoteSettingsSlot {
  model: QuoteSettingsModel | null;
}
