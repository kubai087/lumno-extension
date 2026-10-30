import { describe, expect, it } from 'vitest';
import {
  chooseReadableInk,
  getAdaptiveInkTones,
  getContrastRatio,
  getTranslucentToneContrast,
  getWordmarkInkColor,
  type RgbColor,
  type ToneInk
} from './wallpaper-adaptive-tone';

function gray(level: number): RgbColor {
  return { red: level, green: level, blue: level };
}

// Rec. 601 luminance, the scale the sampler hands to the tone functions.
function sampledLuminance(color: RgbColor): number {
  return ((color.red * 0.299) + (color.green * 0.587) + (color.blue * 0.114)) / 255;
}

const INKS: ToneInk[] = ['light', 'dark'];

describe('adaptive ink contrast', () => {
  // Either family can come out of the hysteresis band (0.5 to 0.62), so start
  // from each; chooseReadableInk settles the family the tones are drawn in.
  it.each([102, 115, 128, 140, 150, 158, 166])('reads on a gray %i wallpaper from either starting ink', (level) => {
    const background = gray(level);
    const luminance = sampledLuminance(background);
    const bestPossible = Math.max(
      getContrastRatio({ red: 248, green: 250, blue: 252 }, background),
      getContrastRatio({ red: 15, green: 23, blue: 42 }, background)
    );
    INKS.forEach((startInk) => {
      const ink = chooseReadableInk(startInk, luminance, background, 'none');
      const tones = getAdaptiveInkTones(luminance, ink, background, 'none');
      expect(getTranslucentToneContrast(tones.ink, background)).toBeGreaterThanOrEqual(Math.min(4.5, bestPossible) - 0.05);
      expect(getTranslucentToneContrast(tones.muted, background)).toBeGreaterThanOrEqual(3 - 0.05);
    });
  });

  // The old fixed interpolation gave light ink on a 0.6 gray roughly 1.6:1.
  it('turns the whole family dark where light ink cannot reach the floor, and never mixes families', () => {
    const background = gray(150);
    const luminance = sampledLuminance(background);
    expect(chooseReadableInk('light', luminance, background, 'none')).toBe('dark');
    expect(getTranslucentToneContrast(getAdaptiveInkTones(luminance, 'dark', background, 'none').ink, background))
      .toBeGreaterThanOrEqual(4.45);
    expect(getAdaptiveInkTones(luminance, 'light', background, 'none').ink.color.red).toBeGreaterThan(200);
  });

  it('keeps a family that already reads on a clearly light or dark wallpaper', () => {
    expect(chooseReadableInk('light', sampledLuminance(gray(30)), gray(30), 'none')).toBe('light');
    expect(chooseReadableInk('dark', sampledLuminance(gray(230)), gray(230), 'none')).toBe('dark');
  });

  it('keeps tones that already read translucent', () => {
    const dark = gray(20);
    const onDark = getAdaptiveInkTones(sampledLuminance(dark), 'light', dark, 'none');
    expect(onDark.ink.alpha).toBeLessThan(1);
    expect(onDark.muted.alpha).toBeLessThan(1);
    expect(getTranslucentToneContrast(onDark.ink, dark)).toBeGreaterThanOrEqual(4.5);

    const bright = gray(240);
    const onBright = getAdaptiveInkTones(sampledLuminance(bright), 'dark', bright, 'none');
    expect(onBright.ink.alpha).toBeLessThan(1);
    expect(getTranslucentToneContrast(onBright.ink, bright)).toBeGreaterThanOrEqual(4.5);
  });

  it('counts translucency against contrast', () => {
    const background = gray(128);
    expect(getTranslucentToneContrast({ color: gray(20), alpha: 0.5 }, background))
      .toBeLessThan(getTranslucentToneContrast({ color: gray(20), alpha: 1 }, background));
  });

  it('reads a filtered wallpaper by its luminance, not the sampled hue', () => {
    const saturated = { red: 220, green: 40, blue: 40 };
    const ink = chooseReadableInk('dark', 0.5, saturated, 'dither');
    const tones = getAdaptiveInkTones(0.5, ink, saturated, 'dither');
    expect(getTranslucentToneContrast(tones.ink, gray(Math.round(0.5 * 255)))).toBeGreaterThanOrEqual(4.45);
  });
});

// The wordmark and clock ink keeps the wallpaper's hue at a decisive
// lightness: never the washed grey that sat right at a 3.25:1 floor.
describe('the wordmark ink', () => {
  const wordmarkInk = (color: RgbColor, ink: ToneInk, effectType = 'none', textureContrast = 0.05) =>
    getWordmarkInkColor(color, sampledLuminance(color), ink, 0, 0, textureContrast, effectType);
  const paleSky = { red: 200, green: 214, blue: 228 };

  it('clears 5.5:1 in dark ink and keeps the wallpaper\'s hue', () => {
    const skyInk = wordmarkInk(paleSky, 'dark');
    expect(getContrastRatio(skyInk, paleSky)).toBeGreaterThanOrEqual(5.5);
    expect(skyInk.blue).toBeGreaterThan(skyInk.red);
    const creamInk = wordmarkInk({ red: 236, green: 226, blue: 206 }, 'dark');
    expect(creamInk.red).toBeGreaterThan(creamInk.blue);
  });

  it('is a near white, not a mid grey, in light ink', () => {
    const navy = { red: 22, green: 30, blue: 52 };
    const navyInk = wordmarkInk(navy, 'light');
    expect(Math.min(navyInk.red, navyInk.green, navyInk.blue)).toBeGreaterThanOrEqual(230);
    expect(getContrastRatio(navyInk, navy)).toBeGreaterThanOrEqual(4.5);
  });

  it('raises the dark floor over a busy texture', () => {
    const busy = { red: 210, green: 214, blue: 220 };
    expect(getContrastRatio(wordmarkInk(busy, 'dark', 'dither'), gray(Math.round(sampledLuminance(busy) * 255))))
      .toBeGreaterThanOrEqual(7);
  });

  it('takes the extreme on a mid tone no lightness can lift to the floor', () => {
    const midGreenInk = wordmarkInk({ red: 104, green: 132, blue: 88 }, 'dark');
    expect(Math.max(midGreenInk.red, midGreenInk.green, midGreenInk.blue)).toBeLessThan(40);
  });

  it('keeps the plain off-wallpaper color on a fully covered wallpaper', () => {
    expect({ ...getWordmarkInkColor(paleSky, 0.8, 'dark', 1, 0.9, 0, 'none') }).toEqual({ red: 242, green: 242, blue: 242 });
  });
});
