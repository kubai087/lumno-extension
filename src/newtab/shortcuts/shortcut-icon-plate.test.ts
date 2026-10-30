import { describe, expect, it } from 'vitest';
import {
  SAMPLE_SIZE,
  analyzePixels,
  getAutoPlateColors,
  getContrastRatio,
  getPlateColorChoices,
  normalizePlateColor,
  normalizePlateMode,
  resolvePlate,
  type IconAnalysis
} from './shortcut-icon-plate';

// See-through artwork gets a plate tinted from its main color; icons that
// bring their own square, a rounded one included, do not.

type Paint = (x: number, y: number) => readonly number[] | null;

function createPixels(paint: Paint): Uint8ClampedArray {
  const data = new Uint8ClampedArray(SAMPLE_SIZE * SAMPLE_SIZE * 4);
  for (let y = 0; y < SAMPLE_SIZE; y += 1) {
    for (let x = 0; x < SAMPLE_SIZE; x += 1) {
      const color = paint(x, y);
      if (!color) continue;
      const offset = ((y * SAMPLE_SIZE) + x) * 4;
      data[offset] = color[0];
      data[offset + 1] = color[1];
      data[offset + 2] = color[2];
      data[offset + 3] = color.length > 3 ? color[3] : 255;
    }
  }
  return data;
}

function analyze(paint: Paint): IconAnalysis {
  const analysis = analyzePixels(createPixels(paint), SAMPLE_SIZE);
  if (!analysis) {
    throw new Error('Expected the pixels to be analyzed.');
  }
  return analysis;
}

const ORANGE = [238, 77, 45];
const WHITE = [255, 255, 255];
const BLACK = [17, 17, 17];

function insideRoundedSquare(x: number, y: number, inset: number, radius: number): boolean {
  const min = inset;
  const max = SAMPLE_SIZE - 1 - inset;
  if (x < min || x > max || y < min || y > max) return false;
  const cx = Math.min(Math.max(x, min + radius), max - radius);
  const cy = Math.min(Math.max(y, min + radius), max - radius);
  return ((x - cx) ** 2) + ((y - cy) ** 2) <= radius ** 2;
}

function parseRgb(css: string): number[] {
  return (css.match(/\d+/g) || []).map(Number);
}

describe('shortcut icon plate', () => {
  it('finds a bare logo see-through and keeps its main color', () => {
    // An orange bag with a white letter, floating on transparency.
    const analysis = analyze((x, y) => {
      if (!insideRoundedSquare(x, y, 6, 3)) return null;
      return x > 13 && x < 18 && y > 10 && y < 22 ? WHITE : ORANGE;
    });

    expect(analysis.transparent).toBe(true);
    // The white letter does not wash out the main color, and is offered as
    // its own choice rather than from the palette.
    expect(analysis.accent).toEqual(ORANGE);
    expect(analysis.palette).toEqual([ORANGE]);
  });

  it('does not count clear corners alone as see-through', () => {
    expect(analyze((x, y) => (insideRoundedSquare(x, y, 0, 7) ? ORANGE : null)).transparent).toBe(false);
  });

  it('gives full-bleed and empty images no plate', () => {
    expect(analyze(() => WHITE).transparent).toBe(false);
    const empty = analyze(() => null);
    expect(empty.transparent).toBe(false);
    expect(empty.accent).toBeNull();
    expect(analyzePixels(new Uint8ClampedArray(4), SAMPLE_SIZE)).toBeNull();
  });

  it('gives a round badge a plate', () => {
    const center = (SAMPLE_SIZE - 1) / 2;
    const analysis = analyze((x, y) => (
      ((x - center) ** 2) + ((y - center) ** 2) <= (SAMPLE_SIZE / 2) ** 2 ? [91, 80, 214] : null
    ));

    expect(analysis.transparent).toBe(true);
  });

  it('keeps the artwork legible on its automatic plate in both modes', () => {
    [ORANGE, WHITE, BLACK, [250, 204, 21], [37, 99, 235]].forEach((accent) => {
      const colors = getAutoPlateColors(accent);
      expect(getContrastRatio(parseRgb(colors.light), accent)).toBeGreaterThanOrEqual(1.4);
      expect(getContrastRatio(parseRgb(colors.dark), accent)).toBeGreaterThanOrEqual(1.4);
    });
  });

  it('tints a colorful light plate paler than its tile', () => {
    const light = parseRgb(getAutoPlateColors(ORANGE).light);
    // Shortcut tiles tint 18% toward the artwork's color.
    const tile = ORANGE.map((channel) => channel + ((255 - channel) * 0.82));

    expect(light[0]).toBeGreaterThan(light[2]);
    expect(light[1]).toBeGreaterThan(tile[1] + 10);
    expect(light[1]).toBeLessThan(250);
  });

  it('gives gray and black artwork a white plate, and a light one even in dark mode', () => {
    expect(parseRgb(getAutoPlateColors(BLACK).light)).toEqual([255, 255, 255]);
    expect(Math.min(...parseRgb(getAutoPlateColors(BLACK).dark))).toBeGreaterThan(180);
  });

  it('follows the shortcut\'s plate choice', () => {
    const transparent = { transparent: true, accent: ORANGE, palette: [ORANGE] };
    const opaque = { transparent: false, accent: ORANGE, palette: [ORANGE] };

    expect(resolvePlate({ mode: '', analysis: transparent })).not.toBeNull();
    expect(resolvePlate({ mode: '', analysis: opaque })).toBeNull();
    expect(resolvePlate({ mode: '', analysis: null })).toBeNull();
    expect(resolvePlate({ mode: 'on', analysis: opaque })).not.toBeNull();
    // "Always" works before the icon is read.
    expect(resolvePlate({ mode: 'on', analysis: null })).not.toBeNull();
    expect(resolvePlate({ mode: 'off', analysis: transparent })).toBeNull();
    expect(resolvePlate({ mode: '', eligible: false, analysis: transparent })).toBeNull();
    expect(resolvePlate({ mode: 'on', color: '#fdeee4', analysis: opaque }))
      .toEqual({ light: 'rgb(253, 238, 228)', dark: 'rgb(253, 238, 228)', custom: true });
  });

  it('offers tints of the artwork\'s colors, then white and near-black', () => {
    const choices = getPlateColorChoices({ transparent: true, accent: ORANGE, palette: [ORANGE, [37, 99, 235]] });

    // Two tints of the main color, one of the other, white and near-black.
    expect(choices).toHaveLength(5);
    expect(choices.slice(-2)).toEqual(['#FFFFFF', '#1C1C1E']);
    choices.forEach((color) => expect(color).toMatch(/^#[\dA-F]{6}$/));
    expect(getPlateColorChoices(null)).toEqual(['#FFFFFF', '#1C1C1E']);
  });

  it('keeps anti-aliased edge pixels out of the palette', () => {
    // A green disc whose few edge pixels blend toward brown.
    const center = (SAMPLE_SIZE - 1) / 2;
    const analysis = analyze((x, y) => {
      const distance = Math.sqrt(((x - center) ** 2) + ((y - center) ** 2));
      if (distance > 12) return null;
      return distance > 11.4 ? [120, 90, 60, 160] : [22, 163, 74];
    });

    expect(analysis.palette).toEqual([[22, 163, 74]]);
  });

  it('reads stored plate modes and colors', () => {
    expect(normalizePlateMode('on')).toBe('on');
    expect(normalizePlateMode('auto')).toBe('');
    expect(normalizePlateColor('#abcdef')).toBe('#ABCDEF');
    expect(normalizePlateColor('red')).toBe('');
  });
});
