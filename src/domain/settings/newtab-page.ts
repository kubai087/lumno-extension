// The New Tab's page-wide settings: width, search box, theme, glass
// material, buttons, zen mode and where clicks open.
import { defineSetting } from './define';
import { custom, flag, isRecord, oneOf } from './schema';
import { themeMode } from './appearance';

type NewtabWidthMode = 'standard' | 'wide';

// 'none' keeps the original New Tab surfaces; the others swap in a glass material.
type NewtabGlassStyle = 'none' | 'frosted' | 'liquid';

// Light or dark under a glass material: 'follow' takes the New Tab's own theme (where the light
// theme still turns plates dark over a dark wallpaper); 'light' and 'dark' hold the page there.
type NewtabGlassTheme = 'follow' | 'light' | 'dark';

// The New Tab's own theme, or 'global' to follow the global theme.
type NewtabThemeMode = 'global' | 'light' | 'dark';

// Whether the New Tab theme applies to the home page only or everywhere.
type NewtabThemeScope = 'home' | 'global';

type NewtabOpenInNewTabSurface = 'search' | 'shortcuts' | 'bookmarks' | 'recentSites';

// Which New Tab surfaces open a plain click in a new foreground tab.
type NewtabOpenInNewTab = Record<NewtabOpenInNewTabSurface, boolean>;

interface SearchWidthOptions {
  min?: number;
  max?: number;
  fallback?: number;
  // Read a missing width as null (no custom width) instead of the fallback.
  allowNull?: boolean;
}

const NEWTAB_GLASS_STYLES: readonly NewtabGlassStyle[] = Object.freeze(['none', 'frosted', 'liquid']);
const NEWTAB_GLASS_THEMES: readonly NewtabGlassTheme[] = Object.freeze(['follow', 'light', 'dark']);
const NEWTAB_OPEN_IN_NEW_TAB_SURFACES: readonly NewtabOpenInNewTabSurface[] =
  Object.freeze(['search', 'shortcuts', 'bookmarks', 'recentSites']);
const NEWTAB_SEARCH_WIDTH_MIN = 640;
const NEWTAB_SEARCH_WIDTH_MAX = 1040;
const NEWTAB_SEARCH_WIDTH_DEFAULT = 920;

function getNumberOption(value: unknown, fallback: number): number {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function normalizeNewtabSearchWidth(value: unknown, options?: SearchWidthOptions & { allowNull?: false }): number;
function normalizeNewtabSearchWidth(value: unknown, options: SearchWidthOptions): number | null;
function normalizeNewtabSearchWidth(value: unknown, options?: SearchWidthOptions): number | null {
  const config = options || {};
  const allowNull = Boolean(config.allowNull);
  const min = getNumberOption(config.min, NEWTAB_SEARCH_WIDTH_MIN);
  const max = getNumberOption(config.max, NEWTAB_SEARCH_WIDTH_MAX);
  const fallback = getNumberOption(config.fallback, NEWTAB_SEARCH_WIDTH_DEFAULT);
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return allowNull ? null : fallback;
  }
  return Math.min(max, Math.max(min, Math.round(number)));
}

const newtabWidthMode = defineSetting({
  key: '_x_extension_newtab_width_mode_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: custom((value): NewtabWidthMode => (value === 'standard' ? 'standard' : 'wide'))
});

// A custom search box width, or null for the width mode's own.
const newtabSearchWidth = defineSetting({
  key: '_x_extension_newtab_search_width_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: custom((value) => normalizeNewtabSearchWidth(value, { allowNull: true }))
});

const newtabInputAutoFocusEnabled = defineSetting({
  key: '_x_extension_newtab_input_auto_focus_enabled_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: flag(false)
});

const newtabThemeMode = defineSetting({
  key: '_x_extension_newtab_theme_mode_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: custom((value): NewtabThemeMode => (value === 'light' || value === 'dark' ? value : 'global'))
});

const newtabThemeScope = defineSetting({
  key: '_x_extension_newtab_theme_scope_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: custom((value): NewtabThemeScope => (value === 'home' ? 'home' : 'global'))
});

const newtabZenMode = defineSetting({
  key: '_x_extension_newtab_zen_mode_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: flag(false)
});

const newtabFeedbackButtonVisible = defineSetting({
  key: '_x_extension_newtab_feedback_button_visible_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: flag(true)
});

const newtabAppearanceButtonVisible = defineSetting({
  key: '_x_extension_newtab_appearance_button_visible_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: flag(true)
});

const newtabGlassStyle = defineSetting({
  key: '_x_extension_newtab_glass_style_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: oneOf(NEWTAB_GLASS_STYLES, 'none')
});

const newtabGlassTheme = defineSetting({
  key: '_x_extension_newtab_glass_theme_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: oneOf(NEWTAB_GLASS_THEMES, 'follow')
});

// Which New Tab surfaces open a plain click in a new foreground tab instead of the New Tab itself.
const newtabOpenInNewTab = defineSetting({
  key: '_x_extension_newtab_open_in_new_tab_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: custom((value): NewtabOpenInNewTab => {
    const source = isRecord(value) && !Array.isArray(value) ? value : {};
    return {
      search: source.search === true,
      shortcuts: source.shortcuts === true,
      bookmarks: source.bookmarks === true,
      recentSites: source.recentSites === true
    };
  })
});

// The theme a glass material holds the New Tab in, or '' when the page keeps its own theme.
function getNewtabGlassThemeOverride(style: unknown, theme: unknown): Exclude<NewtabGlassTheme, 'follow'> | '' {
  const glassTheme = newtabGlassTheme.parse(theme);
  return newtabGlassStyle.parse(style) !== 'none' && glassTheme !== 'follow' ? glassTheme : '';
}

// The settings that decide the page's theme.
const NEWTAB_THEME_SETTINGS = [themeMode, newtabThemeMode, newtabThemeScope, newtabGlassStyle, newtabGlassTheme];

export {
  NEWTAB_THEME_SETTINGS,
  NEWTAB_GLASS_STYLES,
  NEWTAB_GLASS_THEMES,
  NEWTAB_OPEN_IN_NEW_TAB_SURFACES,
  NEWTAB_SEARCH_WIDTH_DEFAULT,
  NEWTAB_SEARCH_WIDTH_MAX,
  NEWTAB_SEARCH_WIDTH_MIN,
  getNewtabGlassThemeOverride,
  newtabAppearanceButtonVisible,
  newtabFeedbackButtonVisible,
  newtabGlassStyle,
  newtabGlassTheme,
  newtabInputAutoFocusEnabled,
  newtabOpenInNewTab,
  newtabSearchWidth,
  newtabThemeMode,
  newtabThemeScope,
  newtabWidthMode,
  newtabZenMode,
  normalizeNewtabSearchWidth
};
export type {
  NewtabGlassStyle,
  NewtabGlassTheme,
  NewtabOpenInNewTab,
  NewtabOpenInNewTabSurface,
  NewtabThemeMode,
  NewtabThemeScope,
  NewtabWidthMode,
  SearchWidthOptions
};
