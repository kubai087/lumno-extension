import { afterEach, describe, expect, it, vi } from 'vitest';
import { newtabGlassInkHint } from '../../domain/settings/newtab-wallpaper';
import { installCanvasFake, installImageFake, sourceUrl } from '../../../tests/fakes/canvas';
import { createWallpaperAdaptiveTone, getGlassAdaptation, type AdaptiveToneTarget, type RgbColor } from './wallpaper-adaptive-tone';

const grey = (value: number): RgbColor => ({ red: value, green: value, blue: value });

// How much tint a glass plate takes and which ink it reads in, over the
// wallpaper patch behind it.
describe('glass adaptation', () => {
  const bright = getGlassAdaptation(0.9, 0.04, grey(230), 'light', null);
  const midTone = getGlassAdaptation(0.55, 0.04, grey(140), 'light', null);
  const busy = getGlassAdaptation(0.85, 0.6, grey(200), 'light', null);
  const dark = getGlassAdaptation(0.12, 0.04, grey(30), 'light', null);
  const darkBusy = getGlassAdaptation(0.25, 0.5, grey(60), 'light', null);
  const darkThemeBright = getGlassAdaptation(0.9, 0.04, grey(230), 'dark', null);
  const darkThemeDark = getGlassAdaptation(0.12, 0.04, grey(30), 'dark', null);
  const vivid = getGlassAdaptation(0.45, 0.1, { red: 20, green: 90, blue: 220 }, 'light', null);

  it('keeps dark ink on the thinnest tint over a bright calm patch, thickening for a mid-tone or busy one', () => {
    expect(bright.ink).toBe('dark');
    expect(bright.density).toBeLessThan(0.15);
    expect(midTone.ink).toBe('dark');
    expect(midTone.density).toBeGreaterThan(bright.density + 0.3);
    expect(busy.density).toBeGreaterThan(bright.density + 0.3);
  });

  it('flips to light ink on a thin tint over a dark patch, thickening for a busy one', () => {
    expect(dark.ink).toBe('light');
    expect(dark.density).toBeLessThan(0.15);
    expect(darkBusy.ink).toBe('light');
    expect(darkBusy.density).toBeGreaterThan(dark.density + 0.3);
  });

  it('splits a fresh decision at one threshold and holds a plate’s ink near it', () => {
    expect(getGlassAdaptation(0.48, 0.1, grey(122), 'light', null).ink).toBe('light');
    expect(getGlassAdaptation(0.52, 0.1, grey(133), 'light', null).ink).toBe('dark');
    expect(getGlassAdaptation(0.48, 0.1, grey(122), 'light', '').ink).toBe('light');
    expect(getGlassAdaptation(0.52, 0.1, grey(133), 'light', 'light').ink).toBe('light');
    expect(getGlassAdaptation(0.48, 0.1, grey(122), 'light', 'dark').ink).toBe('dark');
    expect(getGlassAdaptation(0.57, 0.1, grey(145), 'light', 'light').ink).toBe('dark');
    expect(getGlassAdaptation(0.43, 0.1, grey(110), 'light', 'dark').ink).toBe('light');
  });

  it('reads light in the dark theme, thickening over a bright patch', () => {
    expect(darkThemeBright.ink).toBe('light');
    expect(darkThemeBright.density).toBeGreaterThan(darkThemeDark.density + 0.4);
  });

  it('keeps less of the saturation boost over a vivid patch, and stays within range', () => {
    expect(bright.saturate).toBe(1);
    expect(vivid.saturate).toBeLessThan(0.6);
    expect(vivid.saturate).toBeGreaterThanOrEqual(0.45);
    [bright, midTone, busy, dark, darkBusy, darkThemeBright, darkThemeDark, vivid].forEach((result) => {
      expect(result.density).toBeGreaterThanOrEqual(0);
      expect(result.density).toBeLessThanOrEqual(1);
      expect(result.saturate).toBeGreaterThanOrEqual(0.45);
      expect(result.saturate).toBeLessThanOrEqual(1);
    });
  });

  it('shares a row’s ink, thickening a patch that disagrees with it', () => {
    const inBrightRow = getGlassAdaptation(0.2, 0.05, grey(50), 'light', null, 0.7);
    expect(inBrightRow.ink).toBe('dark');
    expect(inBrightRow.density).toBeGreaterThan(0.5);
    const inDarkRow = getGlassAdaptation(0.85, 0.05, grey(220), 'light', null, 0.2);
    expect(inDarkRow.ink).toBe('light');
    expect(inDarkRow.density).toBeGreaterThan(0.5);
  });
});

// The page-wide glass ink: one threshold for a fresh decision (a setting
// changed, or a new set of plates), hysteresis only while re-sampling the
// same plates, floating surfaces following the plates, and only the light
// theme's own ink remembered.
function plateAt(left: number, top: number): HTMLElement {
  const element = document.createElement('div');
  document.body.appendChild(element);
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    left, top, right: left + 100, bottom: top + 60, width: 100, height: 60, x: left, y: top, toJSON: () => ({})
  });
  return element;
}

// The wallpaper is one tone, or `leftPixel` on its left half and `pixel` on its right.
async function openPage(pixel: RgbColor, targets: AdaptiveToneTarget[], leftPixel: RgbColor | null = null) {
  vi.useFakeTimers();
  vi.stubGlobal('innerWidth', 1000);
  vi.stubGlobal('innerHeight', 600);
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1000);
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(600);
  document.body.setAttribute('data-wallpaper-active', 'true');
  installImageFake();
  installCanvasFake({
    readPixels(width, height, drawn) {
      const data = new Uint8ClampedArray(Math.max(1, width * height) * 4);
      const wallpaper = sourceUrl(drawn) === 'test://wallpaper';
      for (let index = 0; index < data.length; index += 4) {
        const column = (index / 4) % Math.max(1, width);
        const tone = wallpaper && leftPixel && column < width / 2 ? leftPixel : pixel;
        data.set([tone.red, tone.green, tone.blue, 255], index);
      }
      return data;
    }
  });
  const runtime = createWallpaperAdaptiveTone({
    getTargets: () => targets,
    getCurrentWallpaper: () => ({ id: 'wallpaper', url: 'test://wallpaper' }),
    getWallpaperImageUrl: (wallpaper) => wallpaper.url,
    getOverlayAlphaAtViewportY: () => 0,
    getOverlayLuminance: () => 1,
    getEffectLuminanceAtViewport: () => null
  });
  runtime.refresh();
  await vi.advanceTimersByTimeAsync(100);
  return {
    runtime,
    async resample(options?: Parameters<typeof runtime.schedule>[0]) {
      runtime.schedule(options);
      await vi.advanceTimersByTimeAsync(50);
    },
    remembered: () => window.localStorage.getItem(newtabGlassInkHint.key)
  };
}

describe('page glass ink', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    window.localStorage.clear();
    Array.from(document.body.attributes).forEach((attribute) => document.body.removeAttribute(attribute.name));
  });

  it('opens a wallpaper in the hysteresis band in light ink, under the threshold, and remembers it', async () => {
    const plate = plateAt(100, 100);
    const page = await openPage(grey(120), [{ element: plate, sampleElement: plate, glass: true }]);

    expect(plate.getAttribute('data-glass-ink')).toBe('light');
    expect(document.body.getAttribute('data-glass-ink-hint')).toBe('light');
    expect(page.remembered()).toBe('light');
  });

  it('keeps dark ink while a material is held light, and decides afresh back on Auto', async () => {
    const plate = plateAt(100, 100);
    const page = await openPage(grey(120), [{ element: plate, sampleElement: plate, glass: true }]);
    document.body.setAttribute('data-glass-theme', 'light');
    document.body.setAttribute('data-glass-ink-hint', 'dark');

    await page.resample();
    expect(plate.getAttribute('data-glass-ink')).toBe('dark');
    expect(page.remembered()).toBe('light');
    document.body.removeAttribute('data-glass-theme');
    await page.resample({ resetInk: true });
    expect(plate.getAttribute('data-glass-ink')).toBe('light');
    expect(document.body.getAttribute('data-glass-ink-hint')).toBe('light');
  });

  it('keeps the ink it has on a re-sample without a reset, such as a resize', async () => {
    const plate = plateAt(100, 100);
    const page = await openPage(grey(120), [{ element: plate, sampleElement: plate, glass: true }]);
    document.body.setAttribute('data-glass-ink-hint', 'dark');

    await page.resample(new Event('resize'));
    expect(plate.getAttribute('data-glass-ink')).toBe('dark');
    await page.resample({ resetInk: true });
    expect(plate.getAttribute('data-glass-ink')).toBe('light');
  });

  it('decides afresh when a plate renders later, as a new layout', async () => {
    const plate = plateAt(100, 100);
    const targets: AdaptiveToneTarget[] = [{ element: plate, sampleElement: plate, glass: true }];
    const page = await openPage(grey(120), targets);
    document.body.setAttribute('data-glass-ink-hint', 'dark');
    await page.resample();
    expect(plate.getAttribute('data-glass-ink')).toBe('dark');

    const laterPlate = plateAt(300, 100);
    targets.push({ element: laterPlate, sampleElement: laterPlate, glass: true });
    await page.resample();
    expect(plate.getAttribute('data-glass-ink')).toBe('light');
    expect(laterPlate.getAttribute('data-glass-ink')).toBe('light');
  });

  it('reads light ink in the dark theme without writing the hint a light page opens in', async () => {
    const plate = plateAt(100, 100);
    const page = await openPage(grey(120), [{ element: plate, sampleElement: plate, glass: true }]);
    document.body.setAttribute('data-glass-ink-hint', 'dark');
    document.body.setAttribute('data-theme', 'dark');

    await page.resample({ resetInk: true });
    expect(plate.getAttribute('data-glass-ink')).toBe('light');
    expect(document.body.getAttribute('data-glass-ink-hint')).toBe('dark');
  });

  it('has a floating panel over a bright patch follow the plates instead of turning the page', async () => {
    const darkPlate = plateAt(100, 100);
    const panel = plateAt(700, 100);
    await openPage(grey(240), [
      { element: darkPlate, sampleElement: darkPlate, glass: true },
      { element: panel, sampleElement: panel, glass: true, paletteSwap: true, floating: true }
    ], grey(20));

    expect(darkPlate.getAttribute('data-glass-ink')).toBe('light');
    expect(panel.getAttribute('data-glass-ink')).toBe('light');
    expect(panel.getAttribute('data-glass-ink-theme')).toBe('dark');
  });
});
