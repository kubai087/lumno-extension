import { describe, expect, it } from 'vitest';
import { getContrastRatio, mixColor, parseCssColor } from '../../domain/color';
import { buildTheme, defaultAccentColor, getHoverColors, getSaturationCappedColor, getThemeForMode, type ThemeVariant } from './favicon-theme';

describe('favicon theme', () => {
  it('draws white and near-white site colors with the shared blue accent', () => {
    expect(buildTheme([255, 255, 255]).accentRgb).toEqual(defaultAccentColor);
    expect(buildTheme([248, 250, 252]).accentRgb).toEqual(defaultAccentColor);
  });
});

function rgb(value: string | readonly number[]): readonly number[] {
  if (typeof value !== 'string') {
    return value;
  }
  const parsed = parseCssColor(value);
  if (!parsed) {
    throw new Error(`expected a parseable theme color, received ${value}`);
  }
  return parsed;
}

const contrast = (foreground: string | readonly number[], background: string | readonly number[]) => getContrastRatio(rgb(foreground), rgb(background));

function saturation(value: string | readonly number[]): number {
  const channels = rgb(value).map((channel) => channel / 255);
  const max = Math.max(...channels);
  const min = Math.min(...channels);
  const delta = max - min;
  return delta ? delta / (1 - Math.abs(max + min - 1)) : 0;
}

const ACCENT_SAMPLES = [
  [255, 193, 7],
  [255, 235, 59],
  [190, 255, 0],
  [0, 174, 236],
  [255, 0, 0],
  [36, 41, 46],
  [248, 250, 252]
];

// Each sample's theme on its light and dark result surfaces.
const VARIANTS = ACCENT_SAMPLES.flatMap((accent) => {
  const light = buildTheme(accent);
  const dark: ThemeVariant = getThemeForMode(light, { isDarkMode: true });
  return [
    { label: `${accent.join(',')} light`, mode: 'light', theme: light, base: [255, 255, 255], hover: getHoverColors(light, { isDarkMode: false }) },
    { label: `${accent.join(',')} dark`, mode: 'dark', theme: dark, base: [48, 48, 48], hover: getHoverColors(light, { isDarkMode: true }) }
  ];
});

describe('favicon theme contrast', () => {
  it.each(VARIANTS)('separates the selected and hovered rows of $label from the page', ({ theme, base, hover }) => {
    expect(contrast(theme.highlightBg, base)).toBeGreaterThanOrEqual(1.18);
    expect(contrast(hover.bg, base)).toBeGreaterThanOrEqual(1.12);
    expect(contrast(theme.highlightBorder, base)).toBeGreaterThanOrEqual(3);
  });

  it.each(VARIANTS)('keeps every themed foreground of $label readable at 4.5:1', ({ theme, base, hover }) => {
    expect(contrast(hover.text, hover.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.accent, theme.highlightBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.placeholderText, base)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.markText, theme.markBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.activeMarkText, theme.activeMarkBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.tagText, theme.tagBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.keyText, theme.keyBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.buttonText, theme.buttonBg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(VARIANTS)('keeps the subtle surface of a match on an unselected row of $label', ({ mode, theme, base }) => {
    const expected = mixColor(getSaturationCappedColor(theme.accentRgb, mode === 'dark' ? 0.6 : 0.68), base, mode === 'dark' ? 0.74 : 0.78);

    expect(rgb(theme.markBg)).toEqual(expected);
    expect(contrast(theme.activeMarkBg, theme.highlightBg)).toBeGreaterThanOrEqual(1.4);
  });

  it.each(VARIANTS)('draws soft 1.4:1 boundaries around the tags, keys and buttons of $label', ({ theme }) => {
    [[theme.tagBorder, theme.tagBg], [theme.keyBorder, theme.keyBg], [theme.buttonBorder, theme.buttonBg]].forEach(([border, background]) => {
      const ratio = contrast(border, background);
      expect(ratio).toBeGreaterThanOrEqual(1.4);
      expect(ratio).toBeLessThanOrEqual(1.47);
    });
  });

  it('keeps the neutral tag and passive match text readable', () => {
    expect(contrast('#667085', '#F3F4F6')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#111827', '#E5E7EB')).toBeGreaterThanOrEqual(4.5);
  });

  it('corrects a bright brand foreground but keeps its color for tinted surfaces', () => {
    const yellow = buildTheme([255, 193, 7]);

    expect(yellow.accentRgb).toEqual([255, 193, 7]);
    expect(yellow.accent).not.toBe('rgb(255, 193, 7)');
  });

  it('keeps large result surfaces colorful but below pastel saturation, alike across hues', () => {
    [buildTheme([255, 193, 7]), buildTheme([255, 0, 0])].forEach((theme) => {
      expect(saturation(theme.highlightBg)).toBeGreaterThanOrEqual(0.62);
      expect(saturation(theme.highlightBg)).toBeLessThanOrEqual(0.7);
    });
    expect(saturation(getSaturationCappedColor([255, 0, 0], 0.68))).toBeLessThanOrEqual(0.69);
  });
});
