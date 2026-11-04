import { describe, expect, it } from 'vitest';
import { getContrastRatio } from './color';
import { GLASS_TEXT_CONTRAST, getGlassTintFloor } from './glass-legibility';

const level = (value: number) => {
  const channel = Math.round(value * 255);
  return [channel, channel, channel];
};

describe('glass tint floor', () => {
  it('asks for no tint where the ink already stands out', () => {
    expect(getGlassTintFloor(0.12, 0.04, 'light')).toBe(0);
    expect(getGlassTintFloor(0.92, 0.04, 'dark')).toBe(0);
  });

  it('asks for enough tint to bring the text to the target contrast, and no more', () => {
    for (const [luminance, ink, tint, rgb] of [
      [0.82, 'light', 30 / 255, [245, 245, 247]],
      [0.3, 'dark', 250 / 255, [29, 29, 31]]
    ] as const) {
      const floor = getGlassTintFloor(luminance, 0, ink);
      const plate = (alpha: number) => level(luminance + (tint - luminance) * alpha);
      expect(floor).toBeGreaterThan(0.2);
      expect(getContrastRatio(rgb, plate(floor))).toBeGreaterThanOrEqual(GLASS_TEXT_CONTRAST);
      expect(getContrastRatio(rgb, plate(floor - 0.03))).toBeLessThan(GLASS_TEXT_CONTRAST);
    }
  });

  it('reads against the brightest or darkest part of a busy patch', () => {
    expect(getGlassTintFloor(0.6, 0.4, 'light')).toBeGreaterThan(getGlassTintFloor(0.6, 0, 'light'));
    expect(getGlassTintFloor(0.6, 0.4, 'dark')).toBeGreaterThan(getGlassTintFloor(0.6, 0, 'dark'));
  });

  it('grows with how close the patch is to the ink, and stops short of solid', () => {
    const light = [0.4, 0.6, 0.8, 1].map((luminance) => getGlassTintFloor(luminance, 0, 'light'));
    expect(light).toEqual(light.slice().sort((a, b) => a - b));
    expect(getGlassTintFloor(1, 1, 'light')).toBeLessThanOrEqual(0.9);
    expect(getGlassTintFloor(0, 1, 'dark')).toBeLessThanOrEqual(0.9);
  });
});
