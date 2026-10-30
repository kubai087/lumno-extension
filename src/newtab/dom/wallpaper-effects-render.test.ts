import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWallpaperEffects, type WallpaperEffects, type WallpaperSample } from './wallpaper-effects';
import {
  installCanvasFake,
  installImageFake,
  isGradient,
  solidPixels,
  type CanvasFake,
  type ImageFakeOptions
} from '../../../tests/fakes/canvas';

interface Wallpaper {
  id: string;
}

interface EffectsSetup {
  imageUrl?: () => string;
  sample?: () => WallpaperSample | null;
  animate?: boolean;
  luminanceHint?: (imageUrl: string) => number | null;
  pixels?: (width: number, height: number) => Uint8ClampedArray;
  images?: ImageFakeOptions;
  viewport?: { width: number; height: number };
}

const controllers: WallpaperEffects[] = [];

function setup(options: EffectsSetup = {}) {
  const viewport = options.viewport || { width: 1200, height: 800 };
  vi.stubGlobal('innerWidth', viewport.width);
  vi.stubGlobal('innerHeight', viewport.height);
  const canvas = installCanvasFake({ readPixels: options.pixels || solidPixels([120, 120, 120, 255]) });
  const images = installImageFake(options.images || { size: () => ({ width: 1200, height: 800 }) });
  const imageUrl = options.imageUrl || (() => '');
  const controller = createWallpaperEffects<Wallpaper>({
    getCurrentWallpaper: () => ({ id: imageUrl() || 'test-wallpaper' }),
    getWallpaperImageUrl: () => imageUrl(),
    getWallpaperSample: options.sample,
    shouldAnimateTransition: () => Boolean(options.animate),
    getLuminanceHint: options.luminanceHint
  });
  controllers.push(controller);
  // The effect layer is the first canvas drawn.
  const layer = () => canvas.canvases[0];
  return { canvas, controller, images, layer };
}

const operationsOf = (canvas: CanvasFake, target: HTMLCanvasElement) => canvas.record(target).operations;
const bodyProp = (name: string) => document.body.style.getPropertyValue(name);
const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  document.body.setAttribute('data-wallpaper-active', 'true');
});

afterEach(() => {
  controllers.splice(0).forEach((controller) => controller.destroy());
  Array.from(document.body.attributes).forEach((attribute) => document.body.removeAttribute(attribute.name));
  vi.unstubAllGlobals();
});

describe('the wallpaper effect layer', () => {
  it('paints its canvas, follows resizes and is removed with its listener once destroyed', async () => {
    const added = vi.spyOn(window, 'addEventListener');
    const removed = vi.spyOn(window, 'removeEventListener');
    const { controller, layer } = setup();
    void controller.apply({ type: 'grain', strength: 50, size: 50, spacing: 50 });
    await controller.refresh({ immediate: true });
    expect(layer().getAttribute('data-effect')).toBe('grain');
    expect(layer().style.opacity).not.toBe('0');
    expect(added.mock.calls.map((call) => call[0])).toContain('resize');
    // Same-tab navigation leaves the effect painted until the page is replaced.
    expect(added.mock.calls.map((call) => call[0])).not.toContain('beforeunload');

    controller.destroy();
    expect(layer().parentNode).toBeNull();
    expect(removed.mock.calls.map((call) => call[0])).toContain('resize');
  });

  it('reports a source the canvas no longer shows until it is redrawn', async () => {
    let imageUrl = 'test://yesterday';
    const { controller } = setup({ imageUrl: () => imageUrl });
    void controller.apply({ type: 'dither', strength: 50, size: 50, spacing: 50 });
    await controller.refresh({ immediate: true });
    expect(controller.isSourceStale()).toBe(false);

    imageUrl = 'test://today';
    expect(controller.isSourceStale()).toBe(true);
    const redraw = controller.refresh({ immediate: true });
    expect(controller.isSourceStale()).toBe(false);
    await redraw;
    expect(controller.isSourceStale()).toBe(false);

    await controller.apply({ type: 'grain', strength: 50, size: 50, spacing: 50 });
    imageUrl = 'test://tomorrow';
    // Grain does not draw from the photo.
    expect(controller.isSourceStale()).toBe(false);
  });

  it('samples the small copy for the sampled effects, CRT the full image, and the full image when the copy fails', async () => {
    let sampleUrl = 'test://small';
    const { controller, images, layer } = setup({
      imageUrl: () => 'test://full',
      sample: () => ({ url: sampleUrl, width: 2048, height: 1152 }),
      images: { size: () => ({ width: 512, height: 288 }), outcome: (src) => (src === 'test://broken' ? 'error' : 'load') }
    });
    for (const type of ['dither', 'halftone', 'ascii', 'blocks']) {
      await controller.apply({ type, strength: 50, size: 50, spacing: 50 });
      // The fake canvas cannot measure glyphs, so ASCII stops before it draws.
      if (type !== 'ascii') expect(layer().getAttribute('data-effect')).toBe(type);
    }
    expect(images.sources()).toEqual(['test://small']);
    // An effect drawn from the small copy shows the full image it stands for.
    expect(controller.isSourceStale()).toBe(false);

    await controller.apply({ type: 'crt', strength: 50, crtStrength: 14 });
    expect(images.sources().slice(1)).toEqual(['test://full']);
    expect(layer().getAttribute('data-effect')).toBe('crt');

    const before = images.images.length;
    await controller.apply({ type: 'dither', strength: 50, size: 50, spacing: 50 });
    expect(images.sources().slice(before)).toEqual(['test://small']);

    const beforeBroken = images.images.length;
    sampleUrl = 'test://broken';
    await controller.apply({ type: 'halftone', strength: 50, size: 50, spacing: 50 });
    expect(images.sources().slice(beforeBroken)).toEqual(['test://broken', 'test://full']);
    expect(layer().getAttribute('data-effect')).toBe('halftone');
    expect(controller.isSourceStale()).toBe(false);
  });

  // The bundled small copy is the sampler's own image (520x293 for a 2048x1152
  // wallpaper), so read with the full image's size it draws what the full image draws.
  it('draws the same dither from the small copy, placed by the full image size', async () => {
    const sizes: Record<string, { width: number; height: number }> = {
      'test://full': { width: 2048, height: 1152 },
      'test://small': { width: 520, height: 293 }
    };
    // Every sampler pixel has its own color, so a sample one pixel off draws differently.
    const pixels = (width: number, height: number) => {
      const data = new Uint8ClampedArray(width * height * 4);
      for (let index = 0; index < width * height; index += 1) {
        data.set([(index * 37) % 256, (index * 101) % 256, (index * 13) % 256, 255], index * 4);
      }
      return data;
    };
    const drawDither = async (sample: WallpaperSample | null) => {
      const { canvas, controller } = setup({
        imageUrl: () => 'test://full',
        sample: () => sample,
        pixels,
        images: { size: (src) => sizes[src] },
        viewport: { width: 1440, height: 900 }
      });
      await controller.apply({ type: 'dither', strength: 50, size: 0, spacing: 50 });
      const drawn = canvas.canvases.flatMap((target) => operationsOf(canvas, target).filter((operation) => operation.op === 'putImageData'));
      controller.destroy();
      expect(drawn).toHaveLength(1);
      return drawn[0].data || [];
    };
    const fromFull = await drawDither(null);
    const fromCopy = await drawDither({ url: 'test://small', width: 2048, height: 1152 });
    expect(fromFull.length).toBeGreaterThan(0);
    expect(fromCopy).toEqual(fromFull);
    // Without the full image size the samples shift, so the check above can fail.
    expect(await drawDither({ url: 'test://small', width: 0, height: 0 })).not.toEqual(fromFull);
  });
});

describe('standard glass', () => {
  it('layers a veil and reflections over two cached material tiles without a viewport-sized buffer', async () => {
    const { canvas, controller, layer } = setup();
    void controller.apply({ type: 'blur', texture: 100 });
    await controller.refresh({ immediate: true });
    expect(layer().getAttribute('data-effect')).toBe('blur-standard');
    expect(canvas.canvases.length).toBeGreaterThanOrEqual(3);
    expect([layer().width, layer().height]).toEqual([1, 1]);
    expect(layer().style.backgroundImage).toMatch(
      /linear-gradient\(rgba\(248, 250, 252, 0\.55\)[\s\S]*linear-gradient\([\s\S]*radial-gradient\([\s\S]*radial-gradient\([\s\S]*url\("data:image\/png;base64,AA=="\)[\s\S]*url\("data:image\/png;base64,AA=="\)/
    );
    expect(layer().style.opacity).toBe('0.18');
    expect(layer().style.backgroundRepeat).toBe('no-repeat, no-repeat, no-repeat, no-repeat, repeat, repeat');
    expect(layer().style.backgroundSize).toBe('100% 100%, 100% 100%, 100% 100%, 100% 100%, 64px 64px, 320px 320px');
    expect([bodyProp('--x-nt-wallpaper-blur-saturate'), bodyProp('--x-nt-wallpaper-blur-brightness'), bodyProp('--x-nt-wallpaper-blur-contrast')])
      .toEqual(['110%', '106%', '84%']);
    expect(layer().style.mixBlendMode).toBe('soft-light');
  });

  it('answers low textures visibly, reuses its tiles, and clears itself at no texture', async () => {
    const { canvas, controller, layer } = setup();
    void controller.apply({ type: 'blur', texture: 100 });
    await controller.refresh({ immediate: true });
    void controller.apply({ type: 'blur', texture: 25 });
    await controller.refresh({ immediate: true });
    expect(Number(layer().style.opacity)).toBeGreaterThan(0.07);
    void controller.apply({ type: 'blur', texture: 50 });
    await controller.refresh({ immediate: true });
    expect(canvas.canvases.reduce((total, target) => total + canvas.record(target).dataUrlCalls, 0)).toBe(2);

    void controller.apply({ type: 'blur', texture: -200 });
    await controller.refresh({ immediate: true });
    expect(layer().style.opacity).toBe('0');
    expect(layer().style.backgroundImage).toBe('none');
    expect(layer().style.backgroundRepeat).toBe('no-repeat');
    expect([bodyProp('--x-nt-wallpaper-blur-saturate'), bodyProp('--x-nt-wallpaper-blur-brightness'), bodyProp('--x-nt-wallpaper-blur-contrast')])
      .toEqual(['100%', '100%', '100%']);
  });

  it('enters together with the blurred background, keeping a snapshot of the outgoing texture', async () => {
    const { controller, layer } = setup({ animate: true });
    void controller.apply({ type: 'grain', strength: 50, size: 50, spacing: 50 });
    await controller.refresh({ immediate: true });
    const effectCanvas = layer();
    const snapshots = () => Array.from(document.body.children)
      .filter((child) => child !== effectCanvas && child.classList.contains('x-nt-wallpaper-effect-resize-snapshot'));
    const blurRender = controller.apply({ type: 'blur', strength: 50, texture: 50 });
    expect(effectCanvas.getAttribute('data-resize-enter')).toBe('true');
    expect(snapshots().length).toBeGreaterThan(0);

    // The render itself, then one frame for the crossfade it queued.
    await blurRender;
    await nextTask();
    expect(effectCanvas.getAttribute('data-effect')).toBe('blur-standard');
    expect(effectCanvas.getAttribute('data-resize-enter')).toBeNull();

    const glassTexture = effectCanvas.style.backgroundImage;
    void controller.apply({ type: 'grain', strength: 50, size: 50, spacing: 50 });
    const [leaving] = snapshots();
    expect(leaving).toBeDefined();
    // The outgoing texture fades with the blurred wallpaper instead of disappearing.
    expect(leaving instanceof HTMLElement ? leaving.style.backgroundImage : '').toBe(glassTexture);
  });

  it('etches highlights over a dark wallpaper and shadows over a light one', async () => {
    let imageUrl = 'test://dark-wallpaper';
    let rgba = [24, 28, 36, 255];
    const { controller, layer } = setup({ imageUrl: () => imageUrl, pixels: (width, height) => solidPixels(rgba)(width, height) });
    void controller.apply({ type: 'blur', texture: 100 });
    await controller.refresh({ immediate: true });
    expect(layer().style.mixBlendMode).toBe('screen');

    imageUrl = 'test://light-wallpaper';
    rgba = [232, 238, 244, 255];
    await controller.refresh({ immediate: true });
    expect(layer().style.mixBlendMode).toBe('multiply');
  });

  it('blends by the remembered luminance before the image decodes, then by what it measures', async () => {
    const hints: string[] = [];
    const { controller, images, layer } = setup({
      imageUrl: () => 'test://remembered',
      pixels: solidPixels([232, 238, 244, 255]),
      images: { size: () => ({ width: 1200, height: 800 }), outcome: () => 'pending' },
      luminanceHint(url) {
        hints.push(url);
        return 0.2;
      }
    });
    void controller.apply({ type: 'blur', texture: 100 });
    await controller.refresh({ immediate: true });
    expect(hints.at(-1)).toBe('test://remembered');
    expect(layer().style.mixBlendMode).toBe('screen');
    // The image still loads, to confirm the remembered luminance.
    expect(images.images).toHaveLength(1);
    images.images[0].load();
    await vi.waitFor(() => expect(layer().style.mixBlendMode).toBe('multiply'));
  });
});

describe('the textured effects', () => {
  it('draw blocks with side faces, studs and the wallpaper\'s colors on top', async () => {
    const { canvas, controller, layer } = setup({
      imageUrl: () => 'test://blocks-wallpaper',
      pixels: solidPixels([112, 156, 208, 255]),
      images: { size: () => ({ width: 120, height: 80 }) },
      viewport: { width: 120, height: 80 }
    });
    void controller.apply({ version: 11, type: 'blocks', strength: 70, size: 45, spacing: 25, texture: 40, blockSize: 3 });
    await controller.refresh({ immediate: true });
    expect(layer().getAttribute('data-effect')).toBe('blocks');
    const operations = operationsOf(canvas, layer());
    expect(operations.some((operation) => operation.op === 'fill' && operation.points?.length === 4)).toBe(true);
    expect(operations.some((operation) => operation.op === 'fill' &&
      (operation.points || []).some((point) => Number.isFinite(point.radius)))).toBe(true);
    expect(operations.some((operation) => operation.op === 'fillRect' && /rgb\(\d+ \d+ \d+\)/.test(String(operation.fillStyle)))).toBe(true);
  });

  it('draw CRT as the wallpaper with two color fringes, a phosphor mask and a curved vignette', async () => {
    const { canvas, controller, layer } = setup({
      imageUrl: () => 'test://crt-wallpaper',
      pixels: solidPixels([82, 116, 148, 255])
    });
    void controller.apply({ version: 11, type: 'crt', strength: 70, crtStrength: 14, size: 45, spacing: 60 });
    await controller.refresh({ immediate: true });
    expect(layer().getAttribute('data-effect')).toBe('crt');
    const operations = operationsOf(canvas, layer());
    expect(operations.filter((operation) => operation.op === 'drawImage').length).toBeGreaterThanOrEqual(3);
    expect(canvas.canvases.slice(1).some((target) => operationsOf(canvas, target).some((operation) =>
      operation.op === 'fillRect' && /rgb\((?:255 38 48|38 255 132|38 94 255)/.test(String(operation.fillStyle))))).toBe(true);
    expect(operations.some((operation) => operation.op === 'fillRect' && isGradient(operation.fillStyle))).toBe(true);
  });
});
