import { describe, expect, it } from 'vitest';
import {
  applyToneCurve,
  boostSampleColor,
  getBlockColorCss,
  getBlockMaterialVariation,
  getCoarseNoiseByte,
  getControlRange,
  getEffectAlpha,
  getGridStart,
  getLayerEffectTone,
  getLuminance,
  getLuminanceFromRgb,
  getNoiseByte,
  getOverlayBlendLuminance,
  getRenderedMetrics,
  mixBlockColors,
  quantizeBlockColor,
  sampleColor,
  shadeBlockColor,
  smoothstep,
  writeTransparentNoisePixel,
  type EffectSampler
} from './wallpaper-effect-pixels';

const sampler: EffectSampler = {
  width: 2,
  height: 1,
  naturalWidth: 200,
  naturalHeight: 100,
  scaleX: 0.005,
  scaleY: 0.005,
  data: new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 128]),
  averageLuminance: 0.3,
  lowLuminance: 0.2,
  highLuminance: 0.8,
  useDarkInk: false
};

describe('wallpaper effect pixels', () => {
  it('cover-fits an image to the viewport and centers its overflow', () => {
    const metrics = getRenderedMetrics(sampler, { width: 100, height: 100 });
    expect(metrics).toEqual({ scale: 1, offsetX: -50, offsetY: 0, renderedWidth: 200, renderedHeight: 100 });
    expect(sampleColor(sampler, metrics, 0, 50)).toEqual({ red: 255, green: 0, blue: 0 });
  });

  it('reads a translucent pixel over white', () => {
    const metrics = getRenderedMetrics(sampler, { width: 100, height: 100 });
    expect(sampleColor(sampler, metrics, 99, 50)).toEqual({ red: 127, green: 127, blue: 255 });
  });

  it('measures luminance and shapes tone', () => {
    expect(getLuminanceFromRgb(255, 255, 255)).toBeCloseTo(1, 9);
    expect(getLuminance({ red: 0, green: 0, blue: 0 })).toBeCloseTo(0, 9);
    expect([smoothstep(-1), smoothstep(0.5), smoothstep(2)]).toEqual([0, 0.5, 1]);
    expect(applyToneCurve(0.3, 0)).toBeCloseTo(0.3, 9);
    expect(applyToneCurve(0.1, 100)).toBeLessThan(0.1);
  });

  it('multiplies an overlay over a dark base and screens it over a light one', () => {
    expect(getOverlayBlendLuminance(0.25, 0.5)).toBeCloseTo(0.25, 9);
    expect(getOverlayBlendLuminance(0.75, 0.5)).toBeCloseTo(0.75, 9);
  });

  it('keeps the tone of a flat image', () => {
    expect(getLayerEffectTone(0.5, { ...sampler, lowLuminance: 0.5, highLuminance: 0.51 }, 0, false)).toBeCloseTo(0.5, 9);
  });

  it('maps controls from 0-100 onto their range and alpha onto the strength', () => {
    expect(getControlRange(50, 10, 20)).toBeCloseTo(15, 9);
    expect(getEffectAlpha(0.8, 50)).toBeCloseTo(0.4, 9);
  });

  it('quantizes, shades and mixes block colors', () => {
    expect(quantizeBlockColor({ red: 100, green: 128, blue: 250 }, 0)).toEqual({ red: 85, green: 170, blue: 255 });
    expect(shadeBlockColor({ red: 100, green: 100, blue: 100 }, 0.5)).toEqual({ red: 178, green: 178, blue: 178 });
    expect(shadeBlockColor({ red: 100, green: 100, blue: 100 }, -1)).toEqual({ red: 0, green: 0, blue: 0 });
    expect(mixBlockColors({ red: 0, green: 0, blue: 0 }, { red: 200, green: 100, blue: 50 }, 0.5))
      .toEqual({ red: 100, green: 50, blue: 25 });
    expect(mixBlockColors({ red: 9, green: 9, blue: 9 }, null, 1)).toEqual({ red: 9, green: 9, blue: 9 });
  });

  it('writes block colors as CSS and varies blocks by at most 2%', () => {
    expect(getBlockColorCss({ red: 1, green: 2, blue: 3 })).toBe('rgb(1 2 3)');
    expect(getBlockColorCss({ red: 1, green: 2, blue: 3 }, 2)).toBe('rgb(1 2 3 / 1)');
    expect(Math.abs(getBlockMaterialVariation(3, 4))).toBeLessThanOrEqual(0.02);
  });

  it('finds no saturation to boost in gray', () => {
    expect(boostSampleColor({ red: 128, green: 128, blue: 128 }, 1)).toEqual({ red: 128, green: 128, blue: 128 });
  });

  it('starts a grid half a step in, or at the last line before the minimum', () => {
    expect(getGridStart(10, 0)).toBe(5);
    expect(getGridStart(10, 27)).toBe(25);
  });

  it('gives the same noise byte for the same pixel', () => {
    const noise = getNoiseByte(3, 7, 42);
    expect(getNoiseByte(3, 7, 42)).toBe(noise);
    expect(noise).toBeGreaterThanOrEqual(0);
    expect(noise).toBeLessThanOrEqual(255);
    expect(getCoarseNoiseByte(0, 0, 64)).toBe(getNoiseByte(0, 0, 0x51f15e));
  });

  it('lightens with bright noise and darkens with dark noise', () => {
    const data = new Uint8ClampedArray(8);
    writeTransparentNoisePixel(data, 0, 255, 1);
    writeTransparentNoisePixel(data, 4, 0, 0.5);
    expect(Array.from(data)).toEqual([255, 255, 255, 255, 0, 0, 0, 128]);
  });
});
