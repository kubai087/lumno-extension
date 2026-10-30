import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWallpaperAdaptiveTone, type AdaptiveToneSampler, type AdaptiveToneTarget } from './wallpaper-adaptive-tone';
import { installCanvasFake, installImageFake, type CanvasFake, type ImageFake } from '../../../tests/fakes/canvas';

interface Pixel {
  red: number;
  green: number;
  blue: number;
}

interface Wallpaper {
  id: string;
  url: string;
  sampleUrl?: string;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

// The pixels each loaded image draws: one color, or a dark left half.
const painted = new WeakMap<object, { pixel: Pixel; leftPixel: Pixel | null }>();
let frames = new Map<number, FrameRequestCallback>();
let canvas: CanvasFake;
let images: ImageFake;

function readPixels(width: number, height: number, drawn: unknown): Uint8ClampedArray {
  const paint = typeof drawn === 'object' && drawn !== null ? painted.get(drawn) : undefined;
  const pixel = paint ? paint.pixel : { red: 128, green: 128, blue: 128 };
  const data = new Uint8ClampedArray(Math.max(1, width * height) * 4);
  for (let index = 0; index < data.length; index += 4) {
    const tone = paint && paint.leftPixel && ((index / 4) % width) < width / 2 ? paint.leftPixel : pixel;
    data.set([tone.red, tone.green, tone.blue, 255], index);
  }
  return data;
}

function placed(rect: Rect = { left: 100, top: 100, width: 48, height: 48 }): HTMLElement {
  const element = document.createElement('div');
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    ...rect,
    x: rect.left,
    y: rect.top,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    toJSON: () => rect
  });
  return element;
}

// Settles the pending load of url as an image of pixel.
function resolveImage(url: string, pixel: Pixel, leftPixel: Pixel | null = null): void {
  const image = images.pending(url);
  painted.set(image, { pixel, leftPixel });
  image.load();
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function runFrames(): void {
  while (frames.size > 0) {
    const [id, callback] = frames.entries().next().value ?? [0, () => {}];
    frames.delete(id);
    callback(0);
  }
}

function rgbChannels(value: string): number[] {
  const channels = value.match(/[\d.]+/g);
  return channels ? channels.slice(0, 3).map(Number) : [];
}

const ink = (element: HTMLElement) => element.getAttribute('data-wallpaper-ink');
const prop = (element: HTMLElement, name: string) => element.style.getPropertyValue(name);

beforeEach(() => {
  frames = new Map();
  let nextFrame = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    nextFrame += 1;
    frames.set(nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.stubGlobal('innerWidth', 1000);
  vi.stubGlobal('innerHeight', 600);
  canvas = installCanvasFake({ readPixels });
  images = installImageFake({ outcome: () => 'pending' });
  document.body.setAttribute('data-wallpaper-active', 'true');
});

afterEach(() => {
  Array.from(document.body.attributes).forEach((attribute) => document.body.removeAttribute(attribute.name));
  vi.unstubAllGlobals();
});

describe('the wallpaper tone sampler', () => {
  function setup() {
    const target = placed();
    const page = {
      wallpaper: { id: 'dark-wallpaper', url: 'test://dark-wallpaper' },
      overlayAlpha: 0,
      overlayLuminance: 1,
      preferOverlayPolarity: true,
      extraTargets: new Array<AdaptiveToneTarget>()
    };
    const readySamplers: AdaptiveToneSampler[] = [];
    const runtime = createWallpaperAdaptiveTone<Wallpaper>({
      getTargets: () => [{
        element: target,
        sampleElement: target,
        minWidth: 42,
        minHeight: 42,
        iconButton: true,
        surface: 'topbar',
        preferOverlayPolarity: page.preferOverlayPolarity
      }, ...page.extraTargets],
      getCurrentWallpaper: () => page.wallpaper,
      getWallpaperImageUrl: (wallpaper) => wallpaper.url,
      getOverlayAlphaAtViewportY: () => page.overlayAlpha,
      getOverlayLuminance: () => page.overlayLuminance,
      getEffectLuminanceAtViewport: () => null,
      onSamplerReady: (sampler) => readySamplers.push(sampler)
    });
    // Shows a wallpaper of one pixel color and lets its sample apply.
    const show = async (id: string, pixel: Pixel, leftPixel: Pixel | null = null) => {
      page.wallpaper = { id, url: `test://${id}` };
      runtime.refresh();
      resolveImage(`test://${id}`, pixel, leftPixel);
      await flush();
    };
    return { page, readySamplers, runtime, show, target };
  }

  it('tints the target, the top bar material and the page base from the first sample', async () => {
    const { readySamplers, runtime, target } = setup();
    runtime.refresh();
    resolveImage('test://dark-wallpaper', { red: 16, green: 24, blue: 32 });
    await flush();

    expect(readySamplers.map((sampler) => sampler.url)).toEqual(['test://dark-wallpaper']);
    expect(readySamplers[0].canvas).toBe(canvas.canvases[0]);
    expect(ink(target)).toBe('light');
    expect(prop(target, '--x-nt-wallpaper-adaptive-ink')).not.toBe('');
    expect(prop(target, '--x-nt-wallpaper-surface-mist')).not.toBe('');
    expect(prop(target, '--x-nt-wallpaper-surface-clear')).not.toBe('');
    expect(prop(target, '--x-nt-wallpaper-surface-mist')).not.toBe(prop(target, '--x-nt-wallpaper-surface-clear'));
    expect(frames.size).toBe(1);
    // The page color under the wallpaper takes its mean, so a restored window does not flash.
    expect(prop(document.body, '--x-nt-wallpaper-base-color')).toBe('rgb(16 24 32)');
  });

  it('keeps the last tones while a replacement loads, and reuses the shown sampler on the way back', async () => {
    const { page, runtime, show, target } = setup();
    await show('dark-wallpaper', { red: 16, green: 24, blue: 32 });
    const darkInk = ink(target);
    const darkColor = prop(target, '--x-nt-wallpaper-adaptive-ink');
    const darkMist = prop(target, '--x-nt-wallpaper-surface-mist');

    page.wallpaper = { id: 'middle-wallpaper', url: 'test://middle-wallpaper' };
    runtime.refresh();
    expect(frames.size).toBe(0);
    expect(ink(target)).toBe(darkInk);
    expect(prop(target, '--x-nt-wallpaper-adaptive-ink')).toBe(darkColor);
    runtime.schedule();
    expect(frames.size).toBe(0);

    const staleMiddle = images.pending('test://middle-wallpaper');
    page.wallpaper = { id: 'dark-wallpaper', url: 'test://dark-wallpaper' };
    runtime.refresh();
    expect(images.sources().filter((src) => src === 'test://dark-wallpaper')).toHaveLength(1);
    expect(frames.size).toBe(1);

    painted.set(staleMiddle, { pixel: { red: 150, green: 150, blue: 150 }, leftPixel: null });
    staleMiddle.load();
    await flush();
    expect(ink(target)).toBe(darkInk);

    // A replacement chooses fresh ink instead of inheriting the previous wallpaper's hysteresis.
    page.wallpaper = { id: 'middle-wallpaper', url: 'test://middle-wallpaper' };
    runtime.refresh();
    resolveImage('test://middle-wallpaper', { red: 150, green: 150, blue: 150 });
    await flush();
    expect(ink(target)).toBe('dark');
    expect(prop(target, '--x-nt-wallpaper-adaptive-ink')).not.toBe(darkColor);
    expect(prop(target, '--x-nt-wallpaper-surface-mist')).not.toBe(darkMist);
  });

  it('keeps the last tones while a load is pending and hands back the theme once it fails', async () => {
    const { page, runtime, show, target } = setup();
    await show('middle-wallpaper', { red: 150, green: 150, blue: 150 });
    page.wallpaper = { id: 'failed-wallpaper', url: 'test://failed-wallpaper' };
    runtime.refresh();
    expect(ink(target)).toBe('dark');

    images.pending('test://failed-wallpaper').fail();
    await flush();
    expect(ink(target)).toBeNull();
    expect(prop(target, '--x-nt-wallpaper-adaptive-ink')).toBe('');
    expect(prop(target, '--x-nt-wallpaper-surface-mist')).toBe('');
    expect(prop(document.body, '--x-nt-wallpaper-base-color')).toBe('');
  });

  it('keeps a top bar in the family of a strong black mask, and counts the mask in the page base', async () => {
    const { page, show, target } = setup();
    document.body.setAttribute('data-theme', 'dark');
    page.overlayAlpha = 0.44;
    page.overlayLuminance = 0;
    await show('bright-wallpaper-with-dark-mask', { red: 255, green: 255, blue: 255 });
    expect(ink(target)).toBe('light');
    const surface = rgbChannels(prop(target, '--x-nt-wallpaper-surface-mist'));
    expect(surface).toHaveLength(3);
    expect(Math.max(...surface)).toBeLessThan(80);
    expect(prop(document.body, '--x-nt-wallpaper-base-color')).toBe('rgb(143 143 143)');
  });

  it('keeps a top bar in the family of a strong white mask', async () => {
    const { page, show, target } = setup();
    document.body.setAttribute('data-theme', 'light');
    page.overlayAlpha = 0.54;
    page.overlayLuminance = 1;
    await show('dark-wallpaper-with-light-mask', { red: 0, green: 0, blue: 0 });
    expect(ink(target)).toBe('dark');
    const surface = rgbChannels(prop(target, '--x-nt-wallpaper-surface-mist'));
    expect(surface).toHaveLength(3);
    expect(Math.min(...surface)).toBeGreaterThan(200);
  });

  it('picks a transparent top bar\'s ink from the background actually drawn', async () => {
    const { page, show, target } = setup();
    page.preferOverlayPolarity = false;
    document.body.setAttribute('data-theme', 'dark');
    page.overlayAlpha = 0.44;
    page.overlayLuminance = 0;
    await show('bright-wallpaper-under-transparent-topbar', { red: 255, green: 255, blue: 255 });
    expect(ink(target)).toBe('dark');
  });

  it('backs light wordmark ink on a textured mid tone with a deep shadow and the full halo', async () => {
    const { page, show, target } = setup();
    page.preferOverlayPolarity = false;
    document.body.setAttribute('data-theme', 'light');
    document.body.setAttribute('data-wallpaper-effect', 'dither');
    await show('mid-tone-textured-wallpaper', { red: 120, green: 120, blue: 120 });
    expect(ink(target)).toBe('light');
    expect(Math.min(...rgbChannels(prop(target, '--x-nt-wallpaper-wordmark-ink')))).toBeGreaterThan(200);
    const shadow = prop(target, '--x-nt-wallpaper-wordmark-shadow');
    expect(Math.max(...rgbChannels(shadow))).toBeLessThan(40);
    expect(shadow).toMatch(/ \/ 30%\)$/);
    expect(prop(target, '--x-nt-wallpaper-wordmark-halo')).toMatch(/ \/ 20%\)$/);
    // Light ink at the threshold does not get the weakest shadow.
    expect(prop(target, '--x-nt-wallpaper-adaptive-shadow')).toBe('rgb(15 23 42 / 42%)');
  });

  it('gives dark wordmark ink on a calm bright wallpaper only a faint halo and no offset shadow', async () => {
    const { page, show, target } = setup();
    page.preferOverlayPolarity = false;
    await show('calm-bright-wallpaper', { red: 236, green: 238, blue: 240 });
    expect(ink(target)).toBe('dark');
    expect(Math.max(...rgbChannels(prop(target, '--x-nt-wallpaper-wordmark-ink')))).toBeLessThan(160);
    const halo = prop(target, '--x-nt-wallpaper-wordmark-halo');
    expect(halo.startsWith('rgb(248 250 252 /')).toBe(true);
    expect(Number((halo.match(/\/ ([\d.]+)%/) || [])[1])).toBeLessThanOrEqual(12);
    expect(prop(target, '--x-nt-wallpaper-wordmark-shadow')).toBe('transparent');
  });

  // A caption and its heading read one sample over the box around both, so a
  // heading over the dark half and a caption over the bright half share one ink.
  describe('over a wallpaper dark on its left half', () => {
    const twoTone = async () => {
      const harness = setup();
      const heading = placed({ left: 380, top: 100, width: 100, height: 60 });
      const caption = placed({ left: 520, top: 170, width: 100, height: 30 });
      const captionTargets = (grouped: boolean): AdaptiveToneTarget[] => [heading, caption].map((element) => ({
        element,
        sampleElement: grouped ? [heading, caption] : element,
        toneGroup: grouped ? 'caption' : '',
        minWidth: 42,
        minHeight: 32
      }));
      harness.page.extraTargets = captionTargets(false);
      await harness.show('two-tone-wallpaper', { red: 236, green: 238, blue: 240 }, { red: 20, green: 24, blue: 30 });
      runFrames();
      return { ...harness, caption, captionTargets, heading };
    };

    it('gives a caption its heading\'s ink and sample once they are grouped', async () => {
      const { caption, captionTargets, heading, page, runtime } = await twoTone();
      expect(ink(heading)).not.toBe(ink(caption));
      page.extraTargets = captionTargets(true);
      runtime.schedule();
      runFrames();
      expect(ink(caption)).toBe(ink(heading));
      expect(prop(caption, '--x-nt-wallpaper-local-luma')).toBe(prop(heading, '--x-nt-wallpaper-local-luma'));
      expect(prop(caption, '--x-nt-wallpaper-adaptive-ink')).toBe(prop(heading, '--x-nt-wallpaper-adaptive-ink'));
    });

    // A clock ink the user fixed holds whatever the sample says and gets that
    // ink's shadow; its caption keeps the sampled ink.
    it('holds a fixed clock ink until it goes back to automatic', async () => {
      const { caption, captionTargets, heading, page, runtime } = await twoTone();
      page.extraTargets = captionTargets(true);
      runtime.schedule();
      runFrames();
      const sampledInk = ink(heading);
      const fixedInk = sampledInk === 'dark' ? 'light' : 'dark';
      page.extraTargets = captionTargets(true).map((entry) => (entry.element === heading ? { ...entry, ink: fixedInk } : entry));
      runtime.schedule();
      runFrames();
      expect(ink(heading)).toBe(fixedInk);
      expect(ink(caption)).toBe(sampledInk);
      const wordmark = rgbChannels(prop(heading, '--x-nt-wallpaper-wordmark-ink'));
      if (fixedInk === 'light') {
        expect(Math.min(...wordmark)).toBeGreaterThan(200);
      } else {
        expect(Math.max(...wordmark)).toBeLessThan(120);
      }
      expect(prop(heading, '--x-nt-wallpaper-wordmark-shadow') === 'transparent').toBe(fixedInk === 'dark');

      page.extraTargets = captionTargets(true);
      runtime.schedule();
      runFrames();
      expect(ink(heading)).toBe(sampledInk);
    });

    // One icon far off the left edge must not drag the sample over the dark half.
    it('samples only the icons of a row that are on screen', async () => {
      const { page, runtime } = await twoTone();
      const shownFolder = placed({ left: 620, top: 500, width: 48, height: 48 });
      const shownAdd = placed({ left: 720, top: 500, width: 48, height: 48 });
      const scrolledAway = placed({ left: -1400, top: 500, width: 48, height: 48 });
      const row = [scrolledAway, shownFolder, shownAdd];
      page.extraTargets = row.map((element) => ({ element, sampleElement: row, toneGroup: 'row', minWidth: 42, minHeight: 42 }));
      runtime.schedule();
      runFrames();
      expect(Number(prop(shownFolder, '--x-nt-wallpaper-local-luma'))).toBeGreaterThan(0.8);
      expect(ink(shownAdd)).toBe('dark');
      expect(ink(shownAdd)).toBe(ink(shownFolder));
    });
  });
});

// The New Tab reveals its content once the first sample is on the page
// (whenSettled), and that sample reads the image the preload already decoded.
describe('waiting for the first wallpaper sample', () => {
  function setup() {
    const target = placed();
    let wallpaper: Wallpaper | null = { id: 'preloaded-wallpaper', url: 'test://preloaded-wallpaper' };
    const preloadedRequests: string[] = [];
    let resolvePreloaded: (image: HTMLImageElement) => void = () => {};
    const preloaded = new Map<string, Promise<HTMLImageElement | null>>([
      ['test://preloaded-wallpaper', new Promise((resolve) => { resolvePreloaded = resolve; })],
      ['test://preload-missing', Promise.resolve(null)]
    ]);
    const runtime = createWallpaperAdaptiveTone<Wallpaper>({
      getTargets: () => [{ element: target, sampleElement: target, minWidth: 42, minHeight: 42, iconButton: true }],
      getCurrentWallpaper: () => wallpaper,
      getWallpaperImageUrl: (shown) => shown.url,
      getWallpaperSample: (shown) => (shown.sampleUrl ? { url: shown.sampleUrl, width: 2048, height: 1152 } : null),
      getPreloadedImage(url) {
        preloadedRequests.push(url);
        return preloaded.get(url) || null;
      }
    });
    const settles = () => {
      const state = { settled: false };
      void runtime.whenSettled().then(() => { state.settled = true; });
      return state;
    };
    const show = (next: Wallpaper | null) => {
      wallpaper = next;
      runtime.refresh();
      return settles();
    };
    return { preloadedRequests, resolvePreloaded: (image: HTMLImageElement) => resolvePreloaded(image), runtime, show, target };
  }

  it('reads the image the preload decoded instead of loading the file again', async () => {
    const { preloadedRequests, resolvePreloaded, runtime, show, target } = setup();
    await runtime.whenSettled();
    const wait = show({ id: 'preloaded-wallpaper', url: 'test://preloaded-wallpaper' });
    await flush();
    expect(preloadedRequests).toEqual(['test://preloaded-wallpaper']);
    expect(wait.settled).toBe(false);
    expect(images.sources()).not.toContain('test://preloaded-wallpaper');

    const decoded = document.createElement('img');
    decoded.width = 10;
    decoded.height = 10;
    painted.set(decoded, { pixel: { red: 16, green: 24, blue: 32 }, leftPixel: null });
    resolvePreloaded(decoded);
    await flush();
    expect(wait.settled).toBe(true);
    expect(ink(target)).toBe('light');
  });

  it('loads the file itself without a preloaded image', async () => {
    const { show } = setup();
    const wait = show({ id: 'preload-missing', url: 'test://preload-missing' });
    await flush();
    resolveImage('test://preload-missing', { red: 236, green: 238, blue: 240 });
    await flush();
    expect(wait.settled).toBe(true);
  });

  it('never holds the page on a wallpaper that fails to load', async () => {
    const { show } = setup();
    const wait = show({ id: 'broken-wallpaper', url: 'test://broken-wallpaper' });
    images.pending('test://broken-wallpaper').fail();
    await flush();
    expect(wait.settled).toBe(true);
  });

  it('samples a wallpaper\'s small copy and never decodes the full image for it', async () => {
    const { show } = setup();
    const wait = show({ id: 'thumbed', url: 'test://thumbed-full', sampleUrl: 'test://thumbed-small' });
    await flush();
    resolveImage('test://thumbed-small', { red: 16, green: 24, blue: 32 });
    await flush();
    expect(wait.settled).toBe(true);
    expect(images.sources()).not.toContain('test://thumbed-full');
  });

  it('falls back to the full image when the small copy fails', async () => {
    const { show } = setup();
    const wait = show({ id: 'thumb-broken', url: 'test://thumb-broken-full', sampleUrl: 'test://thumb-broken-small' });
    await flush();
    images.pending('test://thumb-broken-small').fail();
    await flush();
    expect(wait.settled).toBe(false);
    resolveImage('test://thumb-broken-full', { red: 236, green: 238, blue: 240 });
    await flush();
    expect(wait.settled).toBe(true);
  });

  it('settles at once without a wallpaper', async () => {
    const { runtime, show } = setup();
    show(null);
    await expect(runtime.whenSettled()).resolves.toBeUndefined();
  });
});
