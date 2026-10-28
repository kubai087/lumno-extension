// The New Tab clock: what the top of the page shows, and the clock's face,
// weight, size, opacity, ink, seconds and 12-hour time.
import { defineSetting } from './define';
import { custom, flag, integer, oneOf } from './schema';

// What the top of the New Tab shows.
type NewtabTopContentMode = 'brand' | 'time' | 'off';

// The clock's ink: 'auto' follows the wallpaper or theme behind it; 'light'
// and 'dark' hold it there.
type NewtabTimeInk = 'auto' | 'light' | 'dark';

interface NewtabTimeFont {
  id: string;
  label: string;
  family: string;
  // CSS font-stretch, or '' for the face's own.
  stretch: string;
  minWeight: number;
  maxWeight: number;
  defaultWeight: number;
  // Letter spacing in em at minWeight and maxWeight; null for Open Sans's
  // stepped weight-based tracking.
  tracking: readonly [number, number] | null;
  // Space around the colon and its vertical shift, in em.
  colonGap: number;
  colonShift: number;
}

const NEWTAB_TOP_CONTENT_BRAND: NewtabTopContentMode = 'brand';
const NEWTAB_TOP_CONTENT_TIME: NewtabTopContentMode = 'time';
const NEWTAB_TOP_CONTENT_OFF: NewtabTopContentMode = 'off';
const NEWTAB_TIME_FONT_WEIGHT_MIN = 300;
const NEWTAB_TIME_FONT_WEIGHT_MAX = 800;
const NEWTAB_TIME_FONT_WEIGHT_DEFAULT = 320;
// The clock's size at full window width, in px; narrower windows scale it
// down in proportion.
const NEWTAB_TIME_FONT_SIZE_MIN = 32;
const NEWTAB_TIME_FONT_SIZE_MAX = 96;
const NEWTAB_TIME_FONT_SIZE_DEFAULT = 54;
// The clock's opacity, in percent.
const NEWTAB_TIME_OPACITY_MIN = 20;
const NEWTAB_TIME_OPACITY_MAX = 100;
const NEWTAB_TIME_OPACITY_DEFAULT = 100;
const NEWTAB_TIME_INKS: readonly NewtabTimeInk[] = Object.freeze(['auto', 'light', 'dark']);
const NEWTAB_TIME_INK_DEFAULT: NewtabTimeInk = 'auto';
const NEWTAB_TIME_FONT_DEFAULT = 'open-sans';
// The stored weight stays within 300-800; each face clamps it to the range
// it draws well. The "Lumno Clock" faces are digit-only subsets declared in
// assets/fonts/clock/clock-fonts.css (scripts/build/subset-clock-fonts.py), so
// their weight ranges must match the ones built there. tracking is the
// letter spacing in em at the face's lightest and heaviest weight: light
// strokes leave room to set digits tighter, heavy ones need air. null keeps
// Open Sans's stepped weight-based tracking.
const OPEN_SANS_TIME_FONT: NewtabTimeFont = Object.freeze({
  id: NEWTAB_TIME_FONT_DEFAULT,
  label: 'Open Sans',
  family: '"Open Sans", sans-serif',
  stretch: '86%',
  minWeight: 300,
  maxWeight: 800,
  defaultWeight: 320,
  tracking: null,
  colonGap: 0.055,
  colonShift: -0.035
});
const NEWTAB_TIME_FONTS: readonly NewtabTimeFont[] = Object.freeze([
  OPEN_SANS_TIME_FONT,
  Object.freeze<NewtabTimeFont>({
    id: 'geist',
    label: 'Geist',
    family: '"Lumno Clock Geist", "Open Sans", sans-serif',
    stretch: '',
    minWeight: 300,
    maxWeight: 800,
    defaultWeight: 320,
    tracking: [-0.045, -0.02],
    colonGap: 0.04,
    colonShift: -0.06
  }),
  Object.freeze<NewtabTimeFont>({
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    family: '"Lumno Clock JetBrains Mono", "Open Sans", monospace',
    stretch: '',
    minWeight: 300,
    maxWeight: 800,
    defaultWeight: 320,
    tracking: [-0.06, -0.035],
    colonGap: -0.06,
    colonShift: -0.02
  }),
  Object.freeze<NewtabTimeFont>({
    id: 'bricolage-grotesque',
    label: 'Bricolage Grotesque',
    family: '"Lumno Clock Bricolage Grotesque", "Open Sans", sans-serif',
    stretch: '',
    minWeight: 300,
    maxWeight: 800,
    defaultWeight: 320,
    tracking: [-0.045, -0.015],
    colonGap: 0.1,
    colonShift: -0.06
  }),
  Object.freeze<NewtabTimeFont>({
    id: 'unbounded',
    label: 'Unbounded',
    family: '"Lumno Clock Unbounded", "Open Sans", sans-serif',
    stretch: '',
    minWeight: 300,
    maxWeight: 800,
    defaultWeight: 320,
    tracking: [-0.05, -0.02],
    colonGap: 0.05,
    colonShift: -0.04
  }),
  // Solid round dots; past 550 the dots run into each other.
  Object.freeze<NewtabTimeFont>({
    id: 'bitcount',
    label: 'Bitcount',
    family: '"Lumno Clock Bitcount", "Open Sans", monospace',
    stretch: '',
    minWeight: 300,
    maxWeight: 550,
    defaultWeight: 480,
    tracking: [-0.03, 0],
    colonGap: -0.08,
    colonShift: -0.09
  })
]);

// The original key, from when the top of the page was a brand switch: a
// stored false still means off.
const newtabTopContentMode = defineSetting({
  key: '_x_extension_newtab_wordmark_visible_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: custom((value): NewtabTopContentMode => {
    if (value === NEWTAB_TOP_CONTENT_TIME) {
      return NEWTAB_TOP_CONTENT_TIME;
    }
    if (value === NEWTAB_TOP_CONTENT_OFF || value === false) {
      return NEWTAB_TOP_CONTENT_OFF;
    }
    return NEWTAB_TOP_CONTENT_BRAND;
  })
});

// A stored null reads as 0 and so as the lightest weight, as it always has.
const newtabTimeFontWeight = defineSetting({
  key: '_x_extension_newtab_time_font_weight_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: integer({ min: NEWTAB_TIME_FONT_WEIGHT_MIN, max: NEWTAB_TIME_FONT_WEIGHT_MAX, fallback: NEWTAB_TIME_FONT_WEIGHT_DEFAULT })
});

const newtabTimeFontSize = defineSetting({
  key: '_x_extension_newtab_time_font_size_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: integer({
    min: NEWTAB_TIME_FONT_SIZE_MIN,
    max: NEWTAB_TIME_FONT_SIZE_MAX,
    fallback: NEWTAB_TIME_FONT_SIZE_DEFAULT,
    blankIsMissing: true
  })
});

const newtabTimeOpacity = defineSetting({
  key: '_x_extension_newtab_time_opacity_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: integer({
    min: NEWTAB_TIME_OPACITY_MIN,
    max: NEWTAB_TIME_OPACITY_MAX,
    fallback: NEWTAB_TIME_OPACITY_DEFAULT,
    blankIsMissing: true
  })
});

const newtabTimeInk = defineSetting({
  key: '_x_extension_newtab_time_ink_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: oneOf(NEWTAB_TIME_INKS, NEWTAB_TIME_INK_DEFAULT)
});

function getNewtabTimeFont(value: unknown): NewtabTimeFont {
  return NEWTAB_TIME_FONTS.find((font) => font.id === value) || OPEN_SANS_TIME_FONT;
}

const newtabTimeFont = defineSetting({
  key: '_x_extension_newtab_time_font_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: custom((value) => getNewtabTimeFont(value).id)
});

const newtabTimeSecondsVisible = defineSetting({
  key: '_x_extension_newtab_time_seconds_visible_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: flag(false)
});

// Off keeps the 24-hour clock; on draws 1-12 with the locale's AM/PM.
const newtabTime12Hour = defineSetting({
  key: '_x_extension_newtab_time_12_hour_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: flag(false)
});

// The weight a face actually draws with: the stored weight, held to the
// range that face supports.
// The ink a fixed clock color draws in, or '' when the clock follows the
// wallpaper or the theme (or no clock shows).
function getFixedTimeInk(mode: NewtabTopContentMode, ink: NewtabTimeInk): Exclude<NewtabTimeInk, 'auto'> | '' {
  return mode === 'time' && ink !== 'auto' ? ink : '';
}

function resolveNewtabTimeFontWeight(fontId: unknown, weight: unknown): number {
  const font = getNewtabTimeFont(fontId);
  return Math.min(font.maxWeight, Math.max(font.minWeight, newtabTimeFontWeight.parse(weight)));
}

// Letter spacing in em for a face at a weight, or null for Open Sans's own
// stepped tracking.
function getNewtabTimeFontTracking(fontId: unknown, weight: unknown): number | null {
  const font = getNewtabTimeFont(fontId);
  if (!font.tracking) {
    return null;
  }
  const resolvedWeight = resolveNewtabTimeFontWeight(font.id, weight);
  const span = font.maxWeight - font.minWeight;
  const amount = span > 0 ? (resolvedWeight - font.minWeight) / span : 0;
  const [light, heavy] = font.tracking;
  return Math.round((light + ((heavy - light) * amount)) * 1000) / 1000;
}

// The settings the wordmark and clock area above the search box draws from.
const NEWTAB_TOP_CONTENT_SETTINGS = [
  newtabTopContentMode,
  newtabTimeFont,
  newtabTimeFontWeight,
  newtabTimeFontSize,
  newtabTimeOpacity,
  newtabTimeInk,
  newtabTimeSecondsVisible,
  newtabTime12Hour
];

export {
  NEWTAB_TOP_CONTENT_SETTINGS,
  NEWTAB_TIME_FONTS,
  NEWTAB_TIME_FONT_DEFAULT,
  NEWTAB_TIME_FONT_SIZE_DEFAULT,
  NEWTAB_TIME_FONT_SIZE_MAX,
  NEWTAB_TIME_FONT_SIZE_MIN,
  NEWTAB_TIME_FONT_WEIGHT_DEFAULT,
  NEWTAB_TIME_FONT_WEIGHT_MAX,
  NEWTAB_TIME_FONT_WEIGHT_MIN,
  NEWTAB_TIME_INKS,
  NEWTAB_TIME_INK_DEFAULT,
  NEWTAB_TIME_OPACITY_DEFAULT,
  NEWTAB_TIME_OPACITY_MAX,
  NEWTAB_TIME_OPACITY_MIN,
  NEWTAB_TOP_CONTENT_BRAND,
  NEWTAB_TOP_CONTENT_OFF,
  NEWTAB_TOP_CONTENT_TIME,
  getFixedTimeInk,
  getNewtabTimeFont,
  getNewtabTimeFontTracking,
  newtabTime12Hour,
  newtabTimeFont,
  newtabTimeFontSize,
  newtabTimeFontWeight,
  newtabTimeInk,
  newtabTimeOpacity,
  newtabTimeSecondsVisible,
  newtabTopContentMode,
  resolveNewtabTimeFontWeight
};
export type { NewtabTimeFont, NewtabTimeInk, NewtabTopContentMode };
