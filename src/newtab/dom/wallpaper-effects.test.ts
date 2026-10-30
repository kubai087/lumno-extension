import { describe, expect, it } from 'vitest';
import {
  EFFECT_TYPES,
  analyzeImageData,
  getBlurRadius,
  getEffectCanvasScale,
  liftSampleColor,
  normalizePrefs,
  normalizeStoragePrefs,
  quantizeDitherColor,
  resolveAutoInkTone,
  resolvePrefsForMode,
  resolveUseDarkInk
} from './wallpaper-effects';
import { normalizeWallpaperEffectStoragePrefs } from '../wallpaper/wallpaper';
import { WALLPAPER_EFFECT_MODE_STORAGE_VERSION } from '../wallpaper/wallpaper-options';

const DEFAULTS = {
  version: 11,
  type: 'none',
  inkTone: 'auto',
  strength: 50,
  size: 50,
  spacing: 50,
  texture: 20,
  blockSize: 1,
  crtStrength: 20,
  crtBloom: 15,
  crtRgbOffset: 35,
  crtCurvature: 18
};

const plain = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

describe('wallpaper effect types', () => {
  it('include dither, glass blur, blocks and CRT', () => {
    expect(EFFECT_TYPES).toEqual(expect.arrayContaining(['dither', 'blur', 'blocks', 'crt']));
  });

  it('keep a subtle two-pixel glass at zero blur strength', () => {
    expect(getBlurRadius(0)).toBe(2);
  });
});

describe('sampled wallpaper colors', () => {
  it('brighten while keeping a warm or cool hue, and no cast on neutral gray', () => {
    const warm = liftSampleColor({ red: 180, green: 90, blue: 30 }, 0.4, 0.2);
    expect(warm.red).toBeGreaterThan(180);
    expect(warm.red).toBeGreaterThan(warm.green);
    expect(warm.green).toBeGreaterThan(warm.blue);
    const cool = liftSampleColor({ red: 40, green: 90, blue: 160 }, 0.4, 0.2);
    expect(cool.blue).toBeGreaterThan(160);
    expect(cool.blue).toBeGreaterThan(cool.green);
    expect(cool.green).toBeGreaterThan(cool.red);
    expect(plain(liftSampleColor({ red: 80, green: 80, blue: 80 }, 0.4, 0.2))).toEqual({ red: 150, green: 150, blue: 150 });
  });

  it('promote a channel to the next palette level under a low Bayer threshold only', () => {
    expect(plain(quantizeDitherColor({ red: 100, green: 150, blue: 200 }, 0.1, 4, 1))).toEqual({ red: 170, green: 170, blue: 255 });
    expect(plain(quantizeDitherColor({ red: 100, green: 150, blue: 200 }, 0.9, 4, 1))).toEqual({ red: 85, green: 85, blue: 170 });
  });
});

describe('a wallpaper\'s tone profile', () => {
  it('keeps a dark wallpaper dark, under light characters', () => {
    const profile = analyzeImageData([10, 20, 30, 255, 30, 40, 50, 255]);
    expect(profile.averageLuminance).toBeLessThan(0.2);
    expect(profile.lowLuminance).toBeLessThanOrEqual(profile.highLuminance);
    expect(profile.useDarkInk).toBe(false);
  });

  it('keeps a light wallpaper light with its tonal range, under dark characters', () => {
    const profile = analyzeImageData([238, 242, 248, 255, 250, 246, 240, 255]);
    expect(profile.averageLuminance).toBeGreaterThan(0.9);
    expect(profile.lowLuminance).toBeGreaterThan(0.9);
    expect(profile.useDarkInk).toBe(true);
  });

  it('reads transparent pixels over white, like the sampler', () => {
    const profile = analyzeImageData([0, 0, 0, 0]);
    expect(profile.averageLuminance).toBeGreaterThan(0.99);
    expect(profile.useDarkInk).toBe(true);
  });

  it('falls back to a mid profile without pixels', () => {
    expect(plain(analyzeImageData(null))).toEqual({ averageLuminance: 0.5, lowLuminance: 0.1, highLuminance: 0.9, useDarkInk: false });
  });
});

describe('the effect canvas scale', () => {
  it('supersamples common viewports within the budget and never upscales a huge one', () => {
    expect(getEffectCanvasScale(2, 1920, 1080)).toBeGreaterThan(1.4);
    expect(getEffectCanvasScale(2, 2560, 1440)).toBeGreaterThan(1);
    expect(getEffectCanvasScale(3, 390, 844)).toBe(1.6);
    expect(getEffectCanvasScale(2, 5120, 2880)).toBe(1);
  });
});

describe('effect preferences', () => {
  it('clamp the shared controls and drop removed ones', () => {
    expect(plain(normalizePrefs({
      type: 'ascii', inkTone: 'light', strength: 140, size: -4.5, spacing: 160.25, texture: -240.75,
      // Legacy stored values may still contain this removed preference.
      hover: false
    }))).toEqual({ ...DEFAULTS, type: 'ascii', inkTone: 'light', strength: 100, size: 0, spacing: 100, texture: 0 });
  });

  it('fall back to bounded defaults for non-finite controls', () => {
    expect(plain(normalizePrefs({ size: Infinity, spacing: NaN, texture: -Infinity }))).toEqual(DEFAULTS);
  });

  it('are off by default and keep each stored effect type', () => {
    expect(normalizePrefs(undefined).type).toBe('none');
    ['dither', 'crt', 'blur', 'blocks'].forEach((type) => expect(normalizePrefs({ type }).type).toBe(type));
  });

  it('follow the wallpaper with automatic ink, and the opposite of the mode once resolved for it', () => {
    expect(resolveUseDarkInk('dark', { useDarkInk: false })).toBe(true);
    expect(resolveUseDarkInk('light', { useDarkInk: true })).toBe(false);
    expect(resolveUseDarkInk('auto', { useDarkInk: true })).toBe(true);
    expect(resolveAutoInkTone('auto', 'light')).toBe('dark');
    expect(resolveAutoInkTone('auto', 'dark')).toBe('light');
    expect(resolveAutoInkTone('dark', 'dark')).toBe('dark');
    expect(resolveAutoInkTone('light', 'light')).toBe('light');
    // The tone rendered is the one the panel highlights for the active mode.
    expect(resolvePrefsForMode({ type: 'ascii', inkTone: 'auto' }, 'dark').inkTone).toBe('light');
    expect(normalizePrefs({ inkTone: 'unknown' }).inkTone).toBe('auto');
  });

  it('bound the texture of glass and blocks without forcing it', () => {
    expect(normalizePrefs({ type: 'blur', texture: 180.75 }).texture).toBe(100);
    expect(normalizePrefs({ type: 'blur', texture: -40 }).texture).toBe(0);
    expect(normalizePrefs({ version: 11, type: 'blocks', texture: 180.75 }).texture).toBe(100);
    expect(normalizePrefs({ version: 11, type: 'blocks', texture: -40 }).texture).toBe(0);
    expect(normalizePrefs({ version: 11, type: 'blocks', strength: 12 }).strength).toBe(12);
  });

  it('move a percentage block size onto the 0-5 scale once, and clamp a v10 one', () => {
    expect(normalizePrefs({ type: 'blocks', size: 80 }).blockSize).toBe(4);
    expect(normalizePrefs({ version: 10, type: 'blocks', size: 8 }).blockSize).toBe(5);
    const migrated = normalizePrefs({ version: 9, type: 'blocks', size: 80 });
    expect(plain(normalizePrefs(migrated))).toEqual(plain(migrated));
    expect(normalizePrefs({ type: 'blocks' }).blockSize).toBe(1);
    expect(normalizePrefs({ type: 'blocks' }).spacing).toBe(50);
    expect(normalizePrefs({ version: 11, type: 'blocks', spacing: -10 }).spacing).toBe(0);
  });

  it('migrate mode-aware storage straight to one stable latest schema', () => {
    const migrated = normalizeStoragePrefs({ version: 9, light: { type: 'blocks', size: 80 }, dark: { type: 'blocks', size: 20 } });
    expect(migrated.version).toBe(11);
    expect(migrated.light.version).toBe(11);
    expect(migrated.light.blockSize).toBe(4);
    expect(migrated.dark.blockSize).toBe(1);
    expect(plain(normalizeStoragePrefs(migrated))).toEqual(plain(migrated));
  });

  it('bound the CRT controls on their physical scale and give old CRT values the RGB defaults', () => {
    const crt = normalizePrefs({ version: 7, type: 'crt', spacing: 240, strength: 140, crtBloom: 140, crtRgbOffset: -20, crtCurvature: 38.4 });
    expect([crt.version, crt.spacing, crt.strength, crt.crtStrength, crt.crtBloom, crt.crtRgbOffset, crt.crtCurvature])
      .toEqual([11, 100, 50, 20, 20, 0, 35]);
    const fractional = normalizePrefs({ type: 'crt', strength: 10.5, crtBloom: 10.5, crtCurvature: 17.5 });
    expect([fractional.strength, fractional.crtStrength, fractional.crtBloom, fractional.crtCurvature]).toEqual([50, 10.5, 10.5, 17.5]);
    expect(plain(normalizePrefs({ version: 7, type: 'crt' }))).toEqual({ ...DEFAULTS, type: 'crt' });
    expect(normalizePrefs({ type: 'grain', spacing: -20 }).spacing).toBe(0);
    expect(normalizePrefs({ type: 'grain', spacing: 240 }).spacing).toBe(100);
  });

  it('keep each effect\'s own controls apart from the shared ones across switches', () => {
    const grain = normalizePrefs({ version: 11, type: 'grain', strength: 80, size: 65, spacing: 35, texture: 25, blockSize: 4, crtStrength: 10 });
    const crt = normalizePrefs({ ...grain, type: 'crt' });
    const blocks = normalizePrefs({ ...crt, type: 'blocks' });
    const back = normalizePrefs({ ...blocks, type: 'grain' });
    expect(crt.strength).toBe(80);
    expect(crt.crtStrength).toBe(10);
    expect(blocks.blockSize).toBe(4);
    expect([back.strength, back.size, back.spacing, back.texture]).toEqual([80, 65, 35, 25]);
  });
});

describe('stored wallpaper effects', () => {
  it('have an explicit mode-aware schema version', () => {
    expect(WALLPAPER_EFFECT_MODE_STORAGE_VERSION).toBe(11);
  });

  it('turn a legacy shared effect into identical light and dark ones', () => {
    const effect = { ...DEFAULTS, type: 'grain', strength: 64, size: 35, spacing: 72 };
    expect(plain(normalizeWallpaperEffectStoragePrefs({ version: 3, type: 'grain', strength: 64, size: 35, spacing: 72 })))
      .toEqual({ version: 11, light: effect, dark: effect });
  });

  it('clamp a fallback effect and drop removed CRT controls', () => {
    const prefs = normalizeWallpaperEffectStoragePrefs({ version: 10, type: 'grain', spacing: 240, crtSpacing: 73, crtGrain: 9 });
    expect(prefs.light.spacing).toBe(100);
    expect(prefs.light).not.toHaveProperty('crtSpacing');
    expect(prefs.light).not.toHaveProperty('crtGrain');
  });

  it('keep the supported values of each mode and discard removed optics', () => {
    expect(plain(normalizeWallpaperEffectStoragePrefs({
      version: 7,
      light: { type: 'blur', strength: 31, size: 42, spacing: 53, texture: 32, glow: 90, haze: 80, refraction: 70, edgeLight: 60 },
      dark: { type: 'ascii', strength: 82, size: 73, spacing: 64, glow: 40 }
    }))).toEqual({
      version: 11,
      light: { ...DEFAULTS, type: 'blur', strength: 31, size: 42, spacing: 53, texture: 32 },
      dark: { ...DEFAULTS, type: 'ascii', strength: 82, size: 73, spacing: 64 }
    });
  });
});
