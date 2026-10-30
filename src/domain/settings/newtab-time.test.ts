import { describe, expect, it } from 'vitest';
import { BROWSER_SYNC_KEYS } from './registry';
import {
  NEWTAB_TIME_FONTS,
  NEWTAB_TIME_FONT_WEIGHT_DEFAULT,
  NEWTAB_TIME_FONT_WEIGHT_MAX,
  NEWTAB_TIME_FONT_WEIGHT_MIN,
  getNewtabTimeFontTracking,
  newtabTimeFont,
  newtabTimeFontWeight,
  newtabTimeSecondsVisible,
  resolveNewtabTimeFontWeight
} from './newtab-time';
import { newtabTime12Hour, newtabTimeFontSize, newtabTimeInk, newtabTimeOpacity, newtabTopContentMode } from './newtab-time';

// The New Tab clock's font, weight and seconds settings.
describe('New Tab clock settings', () => {
  it('stores the clock settings under their keys and syncs them', () => {
    expect(newtabTimeSecondsVisible.key).toBe('_x_extension_newtab_time_seconds_visible_2026_unique_');
    expect(newtabTimeFontWeight.key).toBe('_x_extension_newtab_time_font_weight_2026_unique_');
    expect(newtabTimeFont.key).toBe('_x_extension_newtab_time_font_2026_unique_');
    expect(BROWSER_SYNC_KEYS).toEqual(expect.arrayContaining([newtabTimeFont.key, newtabTimeFontWeight.key, newtabTimeSecondsVisible.key]));
  });

  it('keeps the stored weight within 300 to 800, 320 by default', () => {
    expect([NEWTAB_TIME_FONT_WEIGHT_MIN, NEWTAB_TIME_FONT_WEIGHT_MAX, NEWTAB_TIME_FONT_WEIGHT_DEFAULT]).toEqual([300, 800, 320]);
    expect(newtabTimeFontWeight.parse(undefined)).toBe(320);
    expect(newtabTimeFontWeight.parse(299)).toBe(300);
    expect(newtabTimeFontWeight.parse(650)).toBe(650);
    expect(newtabTimeFontWeight.parse(801)).toBe(800);
  });

  it('reads a known face, and Open Sans otherwise', () => {
    expect(newtabTimeFont.parse(undefined)).toBe('open-sans');
    expect(newtabTimeFont.parse('comic-sans')).toBe('open-sans');
    expect(newtabTimeFont.parse('bitcount')).toBe('bitcount');
    expect(NEWTAB_TIME_FONTS.map((font) => font.id)).toEqual(['open-sans', 'geist', 'jetbrains-mono', 'bricolage-grotesque', 'unbounded', 'bitcount']);
  });

  it.each(NEWTAB_TIME_FONTS)('opens $id at a weight it can draw within the stored range', (font) => {
    expect(font.minWeight).toBeGreaterThanOrEqual(NEWTAB_TIME_FONT_WEIGHT_MIN);
    expect(font.maxWeight).toBeLessThanOrEqual(NEWTAB_TIME_FONT_WEIGHT_MAX);
    expect(font.defaultWeight).toBeGreaterThanOrEqual(font.minWeight);
    expect(font.defaultWeight).toBeLessThanOrEqual(font.maxWeight);
  });

  it('holds a heavier weight where a face stops drawing well', () => {
    // Bitcount's dots run together past 550.
    expect(resolveNewtabTimeFontWeight('bitcount', 800)).toBe(550);
    expect(resolveNewtabTimeFontWeight('bitcount', 320)).toBe(320);
    expect(resolveNewtabTimeFontWeight('geist', 800)).toBe(800);
    expect(resolveNewtabTimeFontWeight('unknown', 'bad')).toBe(320);
  });

  it('loosens the tracking from a face’s lightest weight to its heaviest', () => {
    expect(getNewtabTimeFontTracking('open-sans', 500)).toBeNull();
    NEWTAB_TIME_FONTS.forEach((font) => {
      if (!Array.isArray(font.tracking)) return;
      const light = getNewtabTimeFontTracking(font.id, font.minWeight);
      const heavy = getNewtabTimeFontTracking(font.id, font.maxWeight);
      expect([light, heavy]).toEqual(font.tracking);
      expect(Number(light)).toBeLessThan(Number(heavy));
    });
    expect(getNewtabTimeFontTracking('bitcount', 800)).toBe(0);
  });

  it('hides the seconds by default', () => {
    expect(newtabTimeSecondsVisible.parse(undefined)).toBe(false);
    expect(newtabTimeSecondsVisible.parse(true)).toBe(true);
  });
});

describe('New Tab top content and clock look', () => {
  it('reads the old wordmark switch as the brand or nothing, and keeps the brand, the time or nothing', () => {
    expect(newtabTopContentMode.key).toBe('_x_extension_newtab_wordmark_visible_2026_unique_');
    expect([false, true, 'brand', 'time', 'off', undefined].map((value) => newtabTopContentMode.parse(value)))
      .toEqual(['off', 'brand', 'brand', 'time', 'off', 'brand']);
  });

  it('reads a weight given as a string', () => {
    expect(newtabTimeFontWeight.parse(320)).toBe(320);
    expect(newtabTimeFontWeight.parse('537')).toBe(537);
  });

  it('keeps the clock size within 32 to 96, 54 by default', () => {
    expect([undefined, null, 10, '72.4', 500].map((value) => newtabTimeFontSize.parse(value))).toEqual([54, 54, 32, 72, 96]);
  });

  it('keeps the clock opacity within 20 to 100, fully opaque by default', () => {
    expect([undefined, 0, 65, 140].map((value) => newtabTimeOpacity.parse(value))).toEqual([100, 20, 65, 100]);
  });

  it('reads a light or dark clock ink, automatic otherwise', () => {
    expect([undefined, 'light', 'dark', 'purple'].map((value) => newtabTimeInk.parse(value))).toEqual(['auto', 'light', 'dark', 'auto']);
  });

  it('reads the seconds and the 12-hour clock off for a stored string', () => {
    expect(newtabTimeSecondsVisible.parse(false)).toBe(false);
    expect(newtabTimeSecondsVisible.parse('true')).toBe(false);
    expect(newtabTime12Hour.key).toBe('_x_extension_newtab_time_12_hour_2026_unique_');
    expect([undefined, false, true, 'true'].map((value) => newtabTime12Hour.parse(value))).toEqual([false, false, true, false]);
  });
});
