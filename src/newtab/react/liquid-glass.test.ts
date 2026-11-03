import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LIQUID_GLASS_DISPERSION,
  buildLensFilter,
  createLiquidSurfaces,
  isLiquidGlassSupported,
  placeLensFilter,
  type LensTileCanvas
} from '../dom/liquid-glass';
import { getSurfaceDisplacementScale } from '../../domain/liquid-glass-lens';
import { required } from '../../../tests/fakes/dom';
import { createSvgElement } from '../../shared/ui/svg-tree';

function fakeWindow(supportsUrl: boolean, userAgent: string) {
  return {
    CSS: { supports: () => supportsUrl },
    navigator: { userAgent }
  };
}

describe('New Tab bookmarks bar liquid glass', () => {
  it('runs only where backdrop-filter draws SVG filters', () => {
    expect(isLiquidGlassSupported(fakeWindow(true, 'Mozilla/5.0 Chrome/140.0'))).toBe(true);
    expect(isLiquidGlassSupported(fakeWindow(true, 'Mozilla/5.0 Firefox/140.0'))).toBe(false);
    expect(isLiquidGlassSupported(fakeWindow(false, 'Mozilla/5.0 Chrome/140.0'))).toBe(false);
  });

  it('splits the bend into color channels on plates, red bending furthest', () => {
    const tiles = { shape: 'floating' as const, size: 20, urls: Array.from({ length: 8 }, (_, i) => `data:t${i}`) };
    const filter = createSvgElement(document, buildLensFilter('lens', 120, 70, tiles, 90, true));
    const scales = Array.from(filter.querySelectorAll('feDisplacementMap'), (bend) => Number(bend.getAttribute('scale')));
    expect(LIQUID_GLASS_DISPERSION).toBe(0.15);
    expect(scales).toEqual([103.5, 90, 76.5]);
    expect(filter.querySelectorAll('feColorMatrix')[1].getAttribute('values')).toBe('0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0');
    expect(filter.querySelectorAll('feBlend')).toHaveLength(2);
    expect(filter.querySelectorAll('feImage')).toHaveLength(8);
    expect(['id', 'filterUnits', 'color-interpolation-filters', 'x', 'y', 'width', 'height'].map((name) => filter.getAttribute(name)))
      .toEqual(['lens', 'userSpaceOnUse', 'sRGB', '0', '0', '120', '70']);
    // A small control bends in one pass.
    const single = createSvgElement(document, buildLensFilter('lens', 40, 40, tiles, 60, false));
    expect(single.querySelectorAll('feDisplacementMap')).toHaveLength(1);
    expect(single.querySelectorAll('feBlend')).toHaveLength(0);
  });

  it('bends the whole surface in every pass and moves only its tiles on resize', () => {
    const tiles = { shape: 'floating' as const, size: 30, urls: Array.from({ length: 8 }, (_, i) => `data:t${i}`) };
    const host = document.body.appendChild(createSvgElement(document, ['svg', {}, [
      buildLensFilter('lens', 640, 470, tiles, 90, true)
    ]]));
    const filter = required(host.querySelector('filter'), 'filter');
    // No pass that reads the backdrop is held to a subregion: Chrome draws those wrong.
    const bends = Array.from(filter.querySelectorAll('feDisplacementMap'));
    expect(bends).toHaveLength(3);
    bends.forEach((bend) => ['x', 'y', 'width', 'height'].forEach((name) => expect(bend.hasAttribute(name)).toBe(false)));
    placeLensFilter(filter, 640, 300, tiles);
    expect(filter.getAttribute('height')).toBe('300');
    expect(filter.querySelectorAll('feImage')[3].getAttribute('y')).toBe('270');
    document.body.replaceChildren();
  });

  describe('surfaces', () => {
    afterEach(() => {
      vi.restoreAllMocks();
      document.body.replaceChildren();
    });

    function setup() {
      // jsdom draws no canvas, so the tiles go onto stand-ins.
      const encoded = vi.fn((_type: string) => 'data:image/png;base64,AA==');
      const createTileCanvas = (): LensTileCanvas => ({
        width: 0,
        height: 0,
        getContext: () => ({
          createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
          putImageData() {}
        }),
        toDataURL: encoded
      });
      const frames: FrameRequestCallback[] = [];
      const addSurface = (size: { width: number; height: number }) => {
        const element = document.createElement('div');
        element.className = 'glass';
        document.body.appendChild(element);
        Object.defineProperty(element, 'offsetWidth', { get: () => size.width });
        Object.defineProperty(element, 'offsetHeight', { get: () => size.height });
        return element;
      };
      const size = { width: 200, height: 64 };
      const corner = { radius: '16px', rim: '', strength: '', shape: '' };
      const card = addSurface(size);
      type ResizedCallback = (entries: ReadonlyArray<Pick<ResizeObserverEntry, 'target'>>) => void;
      let resized: ResizedCallback = () => {};
      class FakeResizeObserver {
        constructor(callback: ResizedCallback) {
          resized = callback;
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      }
      const windowObj = {
        CSS: { supports: () => true },
        navigator: { userAgent: 'Chrome/140.0' },
        getComputedStyle: () => ({
          borderTopLeftRadius: corner.radius,
          getPropertyValue: (name: string) => ({
            '--rim': corner.rim,
            '--strength': corner.strength,
            'corner-top-left-shape': corner.shape
          })[name] ?? ''
        }),
        requestAnimationFrame: (callback: FrameRequestCallback) => frames.push(callback),
        cancelAnimationFrame() {},
        ResizeObserver: FakeResizeObserver,
        MutationObserver
      };
      const surfaces = createLiquidSurfaces({
        documentObj: document,
        dispersionSelector: '.glass.search',
        property: '--refraction',
        rimProperty: '--rim',
        selector: '.glass',
        strengthProperty: '--strength',
        windowObj,
        createTileCanvas
      });
      const resize = (width: number, height: number) => {
        size.width = width;
        size.height = height;
        resized([{ target: card }]);
      };
      // Lets the tiles' decode settle, then runs the frames it queues.
      const settle = async () => {
        for (let round = 0; round < 4; round += 1) {
          await Promise.resolve();
          await Promise.resolve();
          frames.splice(0).forEach((callback) => callback(0));
        }
      };
      const filters = () => Array.from(document.querySelectorAll('filter'));
      const pointedAt = (element = card) => element.style.getPropertyValue('--refraction').replace(/^url\(#|\)$/g, '');
      const observe = (element: HTMLElement) =>
        resized([{ target: element }]);
      return { addSurface, corner, encoded, filters, observe, pointedAt, resize, settle, surfaces };
    }

    it('fits a resize in place in the same frame, with nothing rebuilt', async () => {
      const { encoded, filters, pointedAt, resize, settle, surfaces } = setup();
      resize(200, 64);
      await settle();
      const first = pointedAt();
      expect(first).not.toBe('');
      expect(filters().map((filter) => filter.id)).toEqual([first]);
      const builds = encoded.mock.calls.length;

      // Same corner and rim: the filter just moves its tiles, before the frame paints.
      resize(260, 64);
      expect(pointedAt()).toBe(first);
      const filter = filters()[0];
      expect(filter.getAttribute('width')).toBe('260');
      const topRight = filter.querySelectorAll('feImage')[1];
      expect(Number(topRight.getAttribute('x'))).toBe(260 - Number(topRight.getAttribute('width')));
      expect(encoded.mock.calls.length).toBe(builds);
      expect(filters()).toHaveLength(1);
      surfaces.destroy();
    });

    it('keeps a surface on its old lens until the tiles for a new rim are ready', async () => {
      const { corner, filters, pointedAt, resize, settle, surfaces } = setup();
      resize(200, 64);
      await settle();
      const first = pointedAt();

      // Rounder: the corner tiles change, which needs new tiles.
      corner.radius = '24px';
      resize(200, 90);
      expect(pointedAt()).toBe(first);
      await settle();
      const second = pointedAt();
      expect(second).not.toBe(first);
      expect(filters().map((filter) => filter.id)).toEqual([second]);
      expect(filters()[0].getAttribute('height')).toBe('90');

      // Back to the first corner: its tiles are cached, so no new images, but a fresh filter.
      corner.radius = '16px';
      resize(200, 64);
      await settle();
      expect(pointedAt()).not.toBe(second);
      expect(filters()).toHaveLength(1);
      surfaces.destroy();
      expect(filters()).toEqual([]);
      expect(pointedAt()).toBe('');
    });

    it('draws the rim for the corner\'s own curve', async () => {
      const { corner, encoded, pointedAt, resize, settle, surfaces } = setup();
      corner.shape = 'round';
      resize(200, 64);
      await settle();
      const round = pointedAt();
      const builds = encoded.mock.calls.length;
      // A superellipse corner of the same radius needs corner tiles of its own.
      corner.shape = 'superellipse(1.25)';
      resize(200, 65);
      await settle();
      expect(pointedAt()).not.toBe(round);
      expect(encoded.mock.calls.length).toBeGreaterThan(builds);
      surfaces.destroy();
    });

    it('gives every surface its own lens, sized to it', async () => {
      const { addSurface, filters, observe, pointedAt, resize, settle, surfaces } = setup();
      const menu = addSurface({ width: 168, height: 138 });
      const plate = addSurface({ width: 640, height: 470 });
      resize(640, 70);
      observe(menu);
      observe(plate);
      await settle();
      const ids = [pointedAt(), pointedAt(menu), pointedAt(plate)];
      expect(new Set(ids).size).toBe(3);
      // Each id names one filter, the size of the surface pointing at it.
      expect(filters().map((filter) => filter.id).sort()).toEqual(ids.slice().sort());
      const sizeOf = (id: string) => {
        const filter = required(document.getElementById(id), id);
        return [filter.getAttribute('width'), filter.getAttribute('height')];
      };
      expect(sizeOf(ids[0])).toEqual(['640', '70']);
      expect(sizeOf(ids[1])).toEqual(['168', '138']);
      expect(sizeOf(ids[2])).toEqual(['640', '470']);
      surfaces.destroy();
    });

    it('splits colors only on the surfaces chosen for it', async () => {
      const { addSurface, filters, observe, pointedAt, resize, settle, surfaces } = setup();
      const search = addSurface({ width: 640, height: 70 });
      search.classList.add('search');
      resize(270, 156);
      observe(search);
      await settle();
      const passes = (id: string) => required(document.getElementById(id), id).querySelectorAll('feDisplacementMap').length;
      expect(passes(pointedAt())).toBe(1);
      expect(passes(pointedAt(search))).toBe(3);
      expect(filters()).toHaveLength(2);
      surfaces.destroy();
    });

    it('holds a rim the surface sets for itself while it grows', async () => {
      const { corner, encoded, filters, pointedAt, resize, settle, surfaces } = setup();
      corner.rim = '22px';
      resize(640, 70);
      await settle();
      const first = pointedAt();
      const builds = encoded.mock.calls.length;
      // The default would widen the rim as the plate grew, up to 40px at 140px; this one is 22px
      // from the start, so growing never asks for new tiles.
      const map = () => required(filters()[0].querySelector('feDisplacementMap'), 'feDisplacementMap').getAttribute('scale');
      expect(map()).toBe(getSurfaceDisplacementScale(22).toFixed(1));
      resize(640, 180);
      resize(640, 412);
      await settle();
      expect(pointedAt()).toBe(first);
      expect(encoded.mock.calls.length).toBe(builds);
      // Too short for it, the rim narrows to half the surface.
      resize(640, 40);
      await settle();
      expect(map()).toBe(getSurfaceDisplacementScale(20).toFixed(1));
      surfaces.destroy();
    });

    it('bends further for a surface that sets its own strength', async () => {
      const { corner, filters, pointedAt, resize, settle, surfaces } = setup();
      corner.rim = '30px';
      resize(640, 180);
      await settle();
      const first = pointedAt();
      const map = () => required(required(filters().at(-1), 'last filter').querySelector('feDisplacementMap'), 'feDisplacementMap')
        .getAttribute('scale');
      expect(map()).toBe(getSurfaceDisplacementScale(30).toFixed(1));
      // A new strength is a new lens, with the same tiles.
      corner.strength = '1.6';
      resize(640, 181);
      await settle();
      expect(pointedAt()).not.toBe(first);
      expect(map()).toBe(getSurfaceDisplacementScale(30, 1.6).toFixed(1));
      surfaces.destroy();
    });

    it('leaves small controls without a lens', async () => {
      const { filters, pointedAt, resize, settle, surfaces } = setup();
      resize(28, 28);
      await settle();
      expect(pointedAt()).toBe('');
      expect(filters()).toEqual([]);
      // Grown into a plate, it gets one; shrunk again, it drops it.
      resize(200, 64);
      await settle();
      expect(pointedAt()).not.toBe('');
      resize(28, 28);
      expect(pointedAt()).toBe('');
      expect(filters()).toEqual([]);
      surfaces.destroy();
    });
  });
});
