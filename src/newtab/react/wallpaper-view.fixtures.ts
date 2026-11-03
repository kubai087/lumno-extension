import type {
  QuoteSettingsActions,
  QuoteSettingsModel,
  SectionSettingsActions,
  SectionSettingsModel,
  DailyState,
  SelectedSourceState,
  WallpaperPanelActions,
  WallpaperPanelState
} from './wallpaper-view';
import type { SliderState, ToggleState } from './wallpaper-panel/panel-primitives';

// A complete panel state with English labels, for tests to edit; the runtime builds
// the real one (src/newtab/wallpaper/wallpaper.ts).

// Every panel action, each one made by `make`; the type keeps the list complete.
export function createPanelActions<F extends () => void>(make: () => F): Record<keyof WallpaperPanelActions, F> {
  return {
    clearUrlInvalid: make(),
    deleteWallpaper: make(),
    hideTooltip: make(),
    importWallpaperFile: make(),
    openOnlineWallpaperMenu: make(),
    primeWallpaper: make(),
    refreshBing: make(),
    resetLiquidGlassTint: make(),
    resetShortcutGap: make(),
    resetShortcutSize: make(),
    resetTimeFontSize: make(),
    resetTimeFontWeight: make(),
    resetTimeOpacity: make(),
    restoreDailyWallpaper: make(),
    selectBingWallpaper: make(),
    selectCuratedCategory: make(),
    selectCuratedWallpaper: make(),
    selectEffect: make(),
    selectFavicon: make(),
    selectInkTone: make(),
    selectSourceTab: make(),
    selectThemeMode: make(),
    selectThemeScope: make(),
    selectTimeInk: make(),
    selectTopContent: make(),
    selectWallpaper: make(),
    selectWallpaperMode: make(),
    setBingDaily: make(),
    setCuratedDaily: make(),
    setCuratedMixCategory: make(),
    setEffectParameter: make(),
    setGlassStyle: make(),
    setInputAutoFocus: make(),
    setGlassAdaptive: make(),
    setLiquidGlassTint: make(),
    setModeSync: make(),
    setOverlay: make(),
    setSearchWidth: make(),
    setShortcutAddVisible: make(),
    setShortcutColumns: make(),
    setShortcutDockMagnification: make(),
    setShortcutGap: make(),
    setShortcutSize: make(),
    setShortcutsVisible: make(),
    setTime12Hour: make(),
    setTimeFont: make(),
    setTimeFontSize: make(),
    setTimeFontWeight: make(),
    setTimeOpacity: make(),
    setTimeSecondsVisible: make(),
    setWallpaperEnabled: make(),
    showButtonTooltip: make(),
    showLocalWallpaperLimit: make(),
    showMoreCurated: make(),
    showTooltip: make(),
    submitWallpaperUrl: make(),
    togglePanel: make(),
    toggleUrlForm: make()
  };
}

const noop = () => {};

function createNoopActions(): WallpaperPanelActions {
  return createPanelActions(() => noop);
}

const slider = (label: string, value: number, min: number, max: number, extra: Partial<SliderState> = {}): SliderState => ({
  label,
  max,
  min,
  value,
  ...extra
});

const toggle = (label: string, checked = false): ToggleState => ({ checked, label });

const daily = (label: string): DailyState => ({
  infoTooltip: '',
  label,
  restoreLabel: '',
  restoreVisible: false,
  toggle: toggle(label)
});

const noSource: SelectedSourceState = { linkLabel: '', meta: '', title: '', url: '', visible: false };

export function createDefaultPanelState(): WallpaperPanelState {
  const effectSlider = (label: string) => ({ ...slider(label, 50, 0, 100, { disabled: true }), visible: false });
  return {
    actions: createNoopActions(),
    button: { active: false, label: 'Appearance' },
    favicon: { options: [], title: 'New Tab favicon' },
    header: {
      helpPrompt: '',
      helpText: '',
      helpUrl: '',
      moreSettingsLabel: 'More settings',
      moreSettingsUrl: '',
      title: 'Appearance settings'
    },
    open: false,
    panelLabel: 'Appearance',
    glassStyle: {
      ariaLabel: 'Material',
      infoTooltip: 'Works best with a wallpaper.',
      options: [
        { value: 'none', label: 'Default' },
        { value: 'frosted', label: 'Acrylic' },
        { value: 'liquid', label: 'Liquid glass' }
      ],
      sectionTitle: 'Style',
      adaptive: {
        infoTooltip: 'Turns dark over darker wallpapers.',
        title: 'Adapt material to wallpaper',
        toggle: toggle('Adapt material to wallpaper', true),
        visible: false
      },
      tint: {
        infoTooltip: 'How much tint the liquid glass keeps.',
        title: 'Tint opacity',
        visible: false,
        light: { ...slider('Light tint', 100, 0, 150, { suffix: '%', step: 5 }), resetLabel: 'Reset light tint', resetVisible: false },
        dark: { ...slider('Dark tint', 100, 0, 150, { suffix: '%', step: 5 }), resetLabel: 'Reset dark tint', resetVisible: false }
      },
      title: 'Material',
      value: 'none'
    },
    search: {
      autoFocus: { infoLabel: '', infoTooltip: '', title: '', toggle: toggle('Automatically focus input') },
      seconds: { title: 'Show seconds', toggle: toggle('Show seconds'), visible: false },
      twelveHour: { title: '12-hour clock', toggle: toggle('12-hour clock'), visible: false },
      timeFont: {
        ariaLabel: 'Time font',
        options: [
          { value: 'open-sans', label: 'Open Sans' },
          { value: 'bitcount', label: 'Bitcount' }
        ],
        title: 'Time font',
        value: 'open-sans',
        visible: false
      },
      timeWeight: {
        ...slider('Time font weight', 320, 300, 800),
        resetLabel: '',
        resetVisible: false,
        visible: false
      },
      timeSize: {
        ...slider('Time size', 54, 32, 96, { suffix: ' px' }),
        resetLabel: '',
        resetVisible: false,
        visible: false
      },
      timeOpacity: {
        ...slider('Time opacity', 100, 20, 100, { suffix: '%' }),
        resetLabel: '',
        resetVisible: false,
        visible: false
      },
      timeInk: {
        tabs: {
          active: 'auto',
          options: [
            { label: 'Auto', value: 'auto' },
            { label: 'Light', value: 'light' },
            { label: 'Dark', value: 'dark' }
          ]
        },
        title: 'Time color',
        visible: false
      },
      title: 'Search box',
      topContent: {
        tabs: {
          active: 'brand',
          options: [
            { label: 'Brand', value: 'brand' },
            { label: 'Time', value: 'time' },
            { label: 'Hide', value: 'off' }
          ]
        },
        title: 'Content above the search bar'
      },
      width: slider('Search box width', 920, 720, 1040, { suffix: ' px' })
    },
    shortcuts: {
      add: { title: 'Show “+”', toggle: toggle('Show “+”', true) },
      columns: slider('Shortcuts per row', 10, 4, 16),
      dock: { title: '', toggle: toggle('', true) },
      enabled: true,
      gap: { ...slider('Shortcut spacing', 4, 0, 24, { suffix: ' px' }), resetLabel: '', resetVisible: false },
      size: { ...slider('Shortcut size', 64, 48, 112, { suffix: ' px' }), resetLabel: '', resetVisible: false },
      title: 'Shortcuts',
      toggle: toggle('Shortcuts', true)
    },
    theme: {
      infoLabel: '',
      infoTooltip: '',
      modes: [],
      scope: {
        active: 'global',
        options: [
          { label: 'Global', value: 'global' },
          { label: 'New Tab', value: 'home' }
        ]
      },
      title: 'Theme mode'
    },
    wallpaper: {
      activeTab: 'built-in',
      bing: {
        busy: false,
        daily: { ...daily('Auto-update daily'), busy: false },
        label: 'Bing',
        loading: false,
        recentLabel: '',
        refresh: { busy: false, disabled: false, label: 'Refresh' },
        selected: noSource,
        status: '',
        tiles: []
      },
      builtIn: { label: 'Built-in', tiles: [] },
      curated: {
        category: { label: 'Category', tabs: { active: '', options: [] } },
        daily: daily('Auto-update daily'),
        label: 'Curated',
        listLabel: '',
        refreshLabel: '',
        selected: noSource,
        tiles: []
      },
      effect: {
        inkTone: {
          label: 'Sample tones',
          tabs: {
            active: 'dark',
            options: [
              { label: 'Shadows', value: 'dark' },
              { label: 'Highlights', value: 'light' }
            ]
          },
          visible: false
        },
        label: 'Wallpaper filter',
        select: { ariaLabel: 'Wallpaper filter', options: [], value: 'none' },
        sliders: {
          crtBloom: effectSlider('Bloom'),
          crtCurvature: effectSlider('Screen curvature'),
          crtRgbOffset: effectSlider('RGB offset'),
          size: effectSlider('Size'),
          spacing: effectSlider('Spacing'),
          strength: effectSlider('Sampling strength'),
          texture: effectSlider('Texture')
        }
      },
      enabled: true,
      local: {
        deleteLabel: '',
        label: 'Local',
        tiles: [],
        upload: { label: 'Add local wallpaper', loading: false },
        url: {
          clearToken: 0,
          disabled: false,
          inputLabel: 'Add image link',
          invalid: false,
          open: false,
          placeholder: '',
          submitLabel: 'Add',
          tileLabel: 'Add image link'
        }
      },
      mode: {
        label: 'Mode',
        tabs: {
          active: 'light',
          options: [
            { label: 'Light', value: 'light' },
            { label: 'Dark', value: 'dark' }
          ]
        },
        visible: false
      },
      modeSync: { title: '', toggle: toggle('', true) },
      overlay: slider('Mask effect', 50, 0, 100),
      source: {
        label: 'Source',
        tabs: {
          active: 'built-in',
          options: [
            { label: 'Built-in', value: 'built-in' },
            { label: 'Local', value: 'local' },
            { label: 'Bing', value: 'bing' },
            { label: 'Curated', value: 'curated' }
          ]
        }
      },
      title: 'Wallpaper',
      toggle: toggle('Toggle wallpaper', true)
    }
  };
}

// The bookmark and site card sections' model as their runtime would hand it over.
export function createSectionSettingsModel(
  actions: SectionSettingsActions,
  edit?: (model: SectionSettingsModel) => void
): SectionSettingsModel {
  const select = (ariaLabel: string, values: string[], value: string) => ({
    ariaLabel,
    onChange: () => undefined,
    options: values.map((option) => ({ value: option, label: option })),
    value
  });
  const model: SectionSettingsModel = {
    bookmark: {
      title: 'Bookmarks',
      enabled: true,
      expanded: false,
      viewModeLabel: 'Display mode',
      viewModeSelect: select('Display mode', ['folder', 'list', 'top'], 'folder'),
      topbarMode: false,
      rows: { label: 'Bookmark rows', min: 1, max: 8, value: 2 },
      columns: { label: 'Bookmarks per row', min: 4, max: 8, value: 6 },
      folderIconsTitle: 'Show icons inside bookmark folders',
      folderIcons: { checked: true, label: 'Show icons inside bookmark folders' },
      topbarLayoutLabel: 'Bar style',
      topbarLayout: {
        active: 'docked',
        label: 'Bar style',
        options: [{ value: 'docked', label: 'Docked to top' }, { value: 'floating', label: 'Floating' }]
      },
      topbarSurfaceLabel: 'Bar background',
      topbarSurfaceSelect: select('Bar background', ['adaptive', 'transparent', 'custom'], 'adaptive')
    },
    recent: {
      title: 'Site cards',
      enabled: true,
      expanded: false,
      modeLabel: 'Display mode',
      mode: {
        active: 'latest',
        label: 'Display mode',
        options: [{ value: 'latest', label: 'Recent' }, { value: 'most', label: 'Most visited' }]
      },
      rowsLabel: 'Site card rows',
      rows: { active: '1', label: 'Site card rows', options: [{ value: '1', label: '1' }, { value: '2', label: '2' }] }
    },
    actions
  };
  edit?.(model);
  return model;
}

// The quote section's model as its runtime would hand it over.
export function createQuoteSettingsModel(
  actions: QuoteSettingsActions,
  edit?: (model: QuoteSettingsModel) => void
): QuoteSettingsModel {
  const model: QuoteSettingsModel = {
    quote: {
      title: 'Daily quote',
      enabled: false,
      expanded: true,
      infoTooltip: 'Powered by Hitokoto',
      sourceLabel: 'Source',
      source: {
        active: 'hitokoto',
        label: 'Source',
        options: [{ value: 'hitokoto', label: 'Hitokoto' }, { value: 'custom', label: 'Custom' }]
      },
      customMode: false,
      library: {
        title: 'Quote collection',
        infoTooltip: 'TXT / MD',
        importLabel: 'Import file',
        importing: false,
        shuffleLabel: 'Shuffle',
        shuffleVisible: false,
        status: null,
        count: null
      },
      categoryLabel: 'Quote category',
      category: {
        active: 'literature',
        label: 'Quote category',
        options: [{ value: 'literature', label: 'Literature' }, { value: 'poetry', label: 'Poetry' }]
      },
      positionLabel: 'Quote position',
      positionSelect: {
        ariaLabel: 'Quote position',
        onChange: () => undefined,
        options: ['top', 'input', 'search', 'bottom'].map((value) => ({ value, label: value })),
        value: 'search'
      },
      fontLabel: 'Font',
      fontSelect: {
        ariaLabel: 'Quote font',
        onChange: () => undefined,
        options: ['wenkai', 'xiaowei', 'sans'].map((value) => ({ value, label: value })),
        value: 'wenkai'
      },
      fontSize: { label: 'Font size', ariaLabel: 'Quote font size (px)', min: 12, max: 24, value: 15 }
    },
    actions
  };
  edit?.(model);
  return model;
}
