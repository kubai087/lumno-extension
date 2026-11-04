// The search overlay: its size, width, fonts, entry animation, theme
// adaptation, open tabs, and what the search shortcut does where the
// extension cannot run.
import { defineSetting } from './define';
import { custom, flag, isRecord } from './schema';

type OverlaySizeMode = 'compact' | 'standard' | 'large';

type OverlayEnterAnimation = 'fade' | 'elastic';

// What the search shortcut does on a page the extension cannot run on:
// 'default' opens Lumno's New Tab, 'none' the browser's own.
type RestrictedAction = 'default' | 'none';

interface OverlaySizePreset {
  // The panel width in CSS px before zoom compensation.
  width: number;
  maxHeightVh: number;
  // The scale applied to the panel's contents.
  uiScale: number;
}

// What each size draws: the panel width before zoom compensation, its height
// cap and the scale applied to its contents.
const OVERLAY_SIZE_PRESETS: Readonly<Record<OverlaySizeMode, Readonly<OverlaySizePreset>>> = Object.freeze({
  compact: Object.freeze({ width: 680, maxHeightVh: 72, uiScale: 0.94 }),
  standard: Object.freeze({ width: 760, maxHeightVh: 75, uiScale: 1 }),
  large: Object.freeze({ width: 840, maxHeightVh: 80, uiScale: 1.06 })
});
const OVERLAY_WIDTH_MIN = 560;
const OVERLAY_WIDTH_MAX = 1040;
// The shared text stack token (tokens.css). The overlay's closed shadow root
// defines it on the panel and re-points it at the chosen families, so every
// text rule follows without a rule the search-panel script would inject.
const OVERLAY_FONT_FAMILY_CSS_VAR = '--lumno-font-sans';
// The bundled stack the overlay draws with when no family is chosen. The
// same value as --lumno-font-sans in tokens.css and on the overlay panel
// (src/overlay/react/shell.tsx); chosen families go in front of it.
const OVERLAY_FONT_DEFAULT_STACK = "'Lumno Open Sans', 'Open Sans', -apple-system, " +
  "BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const overlaySizeMode = defineSetting({
  key: '_x_extension_overlay_size_mode_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: custom((value): OverlaySizeMode => (value === 'compact' || value === 'large' ? value : 'standard'))
});

// A custom panel width in CSS px; null follows the size mode's own width.
const overlayWidth = defineSetting({
  key: '_x_extension_overlay_width_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: custom((value): number | null => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return null;
    }
    return Math.min(OVERLAY_WIDTH_MAX, Math.max(OVERLAY_WIDTH_MIN, Math.round(number)));
  })
});

const overlayEnterAnimation = defineSetting({
  key: '_x_extension_overlay_enter_animation_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: custom((value): OverlayEnterAnimation => (value === 'fade' ? 'fade' : 'elastic'))
});

const overlayPageThemeAdaptationEnabled = defineSetting({
  key: '_x_extension_overlay_page_theme_adaptation_enabled_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: flag(true)
});

const overlayOpenTabsDefaultVisible = defineSetting({
  key: '_x_extension_overlay_open_tabs_default_visible_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: flag(true)
});

// Results of the webpage search bar open in the current tab instead of a
// new one.
const overlayOpenInCurrentTab = defineSetting({
  key: '_x_extension_overlay_open_in_current_tab_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: flag(false)
});

// Whether Enter on a result that is already open switches to its tab
// instead of opening it again. Older versions stored the mode names.
const overlayTabPriority = defineSetting({
  key: '_x_extension_overlay_tab_priority_2024_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: custom((value) => value !== 'newtabFirst' && value !== false)
});

const restrictedAction = defineSetting({
  key: '_x_extension_restricted_action_2024_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: custom((value): RestrictedAction => (value === 'none' ? 'none' : 'default'))
});

// Set once the restricted-page action has been matched to the browser's
// own New Tab setting.
const restrictedActionAutoBrowserSettingDone = defineSetting({
  key: '_x_extension_restricted_action_auto_browser_setting_done_2026_unique_',
  area: 'preferences',
  schema: flag(false)
});

// A family name arrives from storage or from the picker, so anything that
// is not a plausible CSS family name is dropped.
// Quotes and backslashes would end the quoted family early; control
// characters and braces would break out of the declaration.
function normalizeOverlayFontFamily(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  const family = value.trim();
  if (!family || family.length > 120 || /["\\{}\u0000-\u001f\u007f]/.test(family)) {
    return '';
  }
  return family;
}

// Only plausible names survive. Given the chosen families, the map keeps
// just theirs; read without them, it keeps at most the two a writer stored.
function normalizeOverlayFontLabels(value: unknown, families?: readonly unknown[] | null): Record<string, string> {
  const labels: Record<string, string> = {};
  if (!isRecord(value) || Array.isArray(value)) {
    return labels;
  }
  for (const family of Array.isArray(families) ? families : Object.keys(value).slice(0, 2)) {
    const key = normalizeOverlayFontFamily(family);
    const stored = key && Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined;
    const label = typeof stored === 'string' ? stored.trim() : '';
    if (label && label.length <= 120 && !/[\u0000-\u001f\u007f]/.test(label)) {
      labels[key] = label;
    }
  }
  return labels;
}

// What the overlay writes into OVERLAY_FONT_FAMILY_CSS_VAR: the chosen
// families in order, then the bundled stack so missing faces and glyphs
// still resolve. An empty value clears the property, which restores the CSS
// fallbacks exactly.
function getOverlayFontFamilyCssValue(value: unknown, fallbackValue: unknown): string {
  const families = [normalizeOverlayFontFamily(value), normalizeOverlayFontFamily(fallbackValue)]
    .filter(Boolean);
  if (families.length === 0) {
    return '';
  }
  return `${families.map((family) => `"${family}"`).join(', ')}, ${OVERLAY_FONT_DEFAULT_STACK}`;
}

// The fonts are this computer's installed faces, so the choice stays on the
// device: never browser sync, WebDAV or an export. Another device has its
// own fonts and its own choice.
// An installed family name, or '' for the bundled Lumno stack. A missing
// face falls back to the bundled stack.
const overlayFontFamily = defineSetting({
  key: '_x_extension_overlay_font_family_2026_unique_',
  area: 'device',
  schema: custom(normalizeOverlayFontFamily)
});

// Second family in the stack, used for glyphs the first one lacks (an
// English face leaves the Chinese text to this one).
const overlayFontFallback = defineSetting({
  key: '_x_extension_overlay_font_fallback_2026_unique_',
  area: 'device',
  schema: custom(normalizeOverlayFontFamily)
});

// Display names of the two chosen families ({ family: name }), so a face
// uninstalled later is still named by its localized name ("PingFang SC" is
// only the family name).
const overlayFontLabels = defineSetting({
  key: '_x_extension_overlay_font_labels_2026_unique_',
  area: 'device',
  schema: custom((value) => normalizeOverlayFontLabels(value))
});

const OVERLAY_FONT_SETTINGS = Object.freeze([overlayFontFamily, overlayFontFallback, overlayFontLabels]);
const OVERLAY_FONT_KEYS: readonly string[] = Object.freeze(OVERLAY_FONT_SETTINGS.map((setting) => setting.key));

function getOverlaySizePreset(mode: unknown): Readonly<OverlaySizePreset> {
  return OVERLAY_SIZE_PRESETS[overlaySizeMode.parse(mode)];
}

export {
  OVERLAY_FONT_DEFAULT_STACK,
  OVERLAY_FONT_FAMILY_CSS_VAR,
  OVERLAY_FONT_KEYS,
  OVERLAY_FONT_SETTINGS,
  OVERLAY_SIZE_PRESETS,
  OVERLAY_WIDTH_MAX,
  OVERLAY_WIDTH_MIN,
  getOverlayFontFamilyCssValue,
  getOverlaySizePreset,
  normalizeOverlayFontFamily,
  normalizeOverlayFontLabels,
  overlayEnterAnimation,
  overlayFontFallback,
  overlayFontFamily,
  overlayFontLabels,
  overlayOpenInCurrentTab,
  overlayOpenTabsDefaultVisible,
  overlayPageThemeAdaptationEnabled,
  overlaySizeMode,
  overlayTabPriority,
  overlayWidth,
  restrictedAction,
  restrictedActionAutoBrowserSettingDone
};
export type { OverlayEnterAnimation, OverlaySizeMode, OverlaySizePreset, RestrictedAction };
