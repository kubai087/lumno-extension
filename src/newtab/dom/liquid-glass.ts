import { isElementNode, isHtmlElement } from '../../shared/dom-guards';
import { queryHtmlElements } from '../../shared/dom-lookup';
import { SVG_NS, createSvgElement, type SvgNode } from '../../shared/ui/svg-tree';
import {
  BAR_BEZEL_PX,
  BAR_RADIUS_PX,
  ROUND_CORNER,
  getCornerExponent,
  getLensLayout,
  getLensTilePixels,
  getSurfaceBezel,
  getSurfaceDisplacementScale,
  type LiquidGlassShape
} from '../../domain/liquid-glass-lens';
// Liquid glass: the wallpaper behind a surface's rim bends inward the way a thick glass edge
// refracts, and splits slightly into its colors there. An SVG displacement map drives the bend
// through `backdrop-filter: url(#…)`, which only Chromium renders; other browsers keep the CSS-only
// glass. The bookmarks bar drives one surface; New Tab's glass style drives many through
// createLiquidSurfaces.
//
// The map is a nine-slice lens (domain/liquid-glass-lens.ts). The tiles are built and decoded once
// per corner and rim and shared by every surface; a surface that resizes only moves its tiles, in
// the same frame, so nothing is rebuilt, encoded or decoded while the page resizes or the results
// plate grows.

// Red bends further than blue: each channel samples the backdrop at its own share of the bend, so
// the rim fringes where the wallpaper has edges. Nothing splits in the flat middle. The split
// grows with the bend, so it stays small.
export const LIQUID_GLASS_DISPERSION = 0.15;

// What a lens tile is drawn on: a canvas, or a stand-in where there is none.
export interface LensTileCanvas {
  width: number;
  height: number;
  getContext(contextId: '2d'): LensTileContext | null;
  toDataURL(type: string): string;
}

interface LensTileContext {
  createImageData(width: number, height: number): { readonly data: Uint8ClampedArray };
  putImageData(image: { readonly data: Uint8ClampedArray }, dx: number, dy: number): void;
}

// The computed style a surface's lens reads.
type LensStyle = Pick<CSSStyleDeclaration, 'borderTopLeftRadius' | 'getPropertyValue'>;

// A resize observer as the lenses use it: they read only each entry's target.
type LensResizeCallback = (entries: ReadonlyArray<Pick<ResizeObserverEntry, 'target'>>) => void;

// The parts of the window the liquid glass reads.
interface LiquidGlassWindow {
  CSS?: Pick<typeof CSS, 'supports'>;
  navigator?: Pick<Navigator, 'userAgent'>;
  innerWidth?: number;
  requestAnimationFrame(callback: FrameRequestCallback): number;
  getComputedStyle(element: Element): LensStyle;
  ResizeObserver?: new (callback: LensResizeCallback) => Pick<ResizeObserver, 'observe' | 'unobserve' | 'disconnect'>;
  MutationObserver?: new (callback: MutationCallback) => Pick<MutationObserver, 'observe' | 'disconnect'>;
}

let filterCount = 0;

export function isLiquidGlassSupported(windowObj: Pick<LiquidGlassWindow, 'CSS' | 'navigator'>) {
  const css = windowObj.CSS;
  const userAgent = String(windowObj.navigator?.userAgent || '');
  // Firefox parses url() in backdrop-filter but draws nothing for it.
  return Boolean(
    css &&
      typeof css.supports === 'function' &&
      css.supports('backdrop-filter', 'url(#a)') &&
      !/Firefox\//.test(userAgent)
  );
}

export interface LensTiles {
  shape: LiquidGlassShape;
  size: number;
  urls: string[];
}

// The rim a lens draws: the surface's shape, its corner radius and corner shape (a superellipse
// exponent), and the rim's width.
interface LensRim {
  shape: LiquidGlassShape;
  radius: number;
  corner: number;
  bezel: number;
}

type Rect = ReturnType<typeof getLensLayout>[number];

function buildLensTiles(createTileCanvas: () => LensTileCanvas, rim: LensRim): LensTiles | null {
  const { size, tiles } = getLensTilePixels(rim.shape, rim.radius, rim.bezel, rim.corner);
  const urls: string[] = [];
  for (const tile of tiles) {
    const canvas = createTileCanvas();
    canvas.width = tile.width;
    canvas.height = tile.height;
    const context = canvas.getContext('2d');
    if (!context) {
      return null;
    }
    const image = context.createImageData(tile.width, tile.height);
    image.data.set(tile.data);
    context.putImageData(image, 0, 0);
    urls.push(canvas.toDataURL('image/png'));
  }
  return { shape: rim.shape, size, urls };
}

// Lens tiles for one rim, built once and resolved once every tile has decoded,
// so no surface points at a filter whose images are still loading (it would draw without its blur).
function createLensCache(documentObj: Document, createTileCanvas: () => LensTileCanvas) {
  const cache = new Map<string, Promise<LensTiles>>();
  return (rim: LensRim) => {
    const key = `${rim.shape}:${rim.radius}:${rim.corner}:${rim.bezel}`;
    let entry = cache.get(key);
    if (!entry) {
      const tiles = buildLensTiles(createTileCanvas, rim);
      entry = tiles
        ? Promise.all(tiles.urls.map((url) => {
          const image = documentObj.createElement('img');
          image.src = url;
          return typeof image.decode === 'function' ? image.decode() : undefined;
        })).then(() => tiles)
        : Promise.reject(new Error('no canvas'));
      entry.catch(() => cache.delete(key));
      cache.set(key, entry);
    }
    return entry;
  };
}

// Too small a surface has no flat middle to look through, so it goes without a lens.
const LENS_MIN_PX = 32;

const at = (rect: Rect) => ({ x: rect[0], y: rect[1], width: rect[2], height: rect[3] });

// The filter. The map is the lens tiles over a flat flood; the backdrop is displaced by it once, or
// once per color channel, each by its own scale, the three channels added back together (screen on
// single channels is a sum). Every pass covers the whole surface: Chrome 155 draws displacement
// passes held to a primitive subregion wrong over a backdrop (parts left unblurred, rims lit), so
// limiting the passes to the rim is not an option.
export function buildLensFilter(
  id: string,
  width: number,
  height: number,
  tiles: LensTiles,
  scale: number,
  dispersion: boolean
): SvgNode {
  const tileRects = getLensLayout(tiles.shape, width, height, tiles.size);
  const pieces = tileRects.map((rect, index): SvgNode =>
    ['feImage', { href: tiles.urls[index], preserveAspectRatio: 'none', ...at(rect), result: `t${index}` }]);
  const pass = (channelScale: number): SvgNode => ['feDisplacementMap', {
    in: 'SourceGraphic', in2: 'map', xChannelSelector: 'R', yChannelSelector: 'G', scale: channelScale.toFixed(1)
  }];
  const bend: SvgNode[] = dispersion
    ? [
      ...['r', 'g', 'b'].flatMap((name, index): SvgNode[] => [
        pass(scale * (1 + (1 - index) * LIQUID_GLASS_DISPERSION)),
        // Keeps this channel and alpha only: a 1 on the diagonal of the 4x5 color matrix.
        ['feColorMatrix', {
          type: 'matrix',
          values: Array.from({ length: 20 }, (_, cell) => Number(cell === index * 6 || cell === 18)).join(' '),
          result: name
        }]
      ]),
      ['feBlend', { in: 'r', in2: 'g', mode: 'screen' }],
      ['feBlend', { in2: 'b', mode: 'screen' }]
    ]
    : [pass(scale)];
  return ['filter', {
    id, filterUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB', x: 0, y: 0, width, height
  }, [
    ['feFlood', { 'flood-color': 'rgb(128,128,128)', result: 'flat' }],
    ...pieces,
    ['feMerge', { result: 'map' }, [
      ['feMergeNode', { in: 'flat' }],
      ...tileRects.map((_rect, index): SvgNode => ['feMergeNode', { in: `t${index}` }])
    ]],
    ...bend
  ]];
}

// Fits a lens filter to a new size by moving its tiles; the images stay as they are.
export function placeLensFilter(filter: Element, width: number, height: number, tiles: LensTiles) {
  filter.setAttribute('width', String(width));
  filter.setAttribute('height', String(height));
  const tileRects = getLensLayout(tiles.shape, width, height, tiles.size);
  filter.querySelectorAll('feImage').forEach((piece, index) => {
    ['x', 'y', 'width', 'height'].forEach((name, at) => piece.setAttribute(name, String(tileRects[index][at])));
  });
}

const svgNamespace = SVG_NS;

// Each filter gets an <svg> of its own. Adding a filter to an <svg> that holds others can make
// Chrome reload all their images, and a backdrop-filter naming a filter whose images are reloading
// drops its blur too, so one new lens would briefly clear every plate.
function createFilterHost(documentObj: Document, description: SvgNode): { host: SVGSVGElement; filter: Element } {
  const host = documentObj.createElementNS(svgNamespace, 'svg');
  host.setAttribute('aria-hidden', 'true');
  host.setAttribute('style', 'position:absolute;width:0;height:0;pointer-events:none');
  const filter = host.appendChild(createSvgElement(documentObj, description));
  (documentObj.body || documentObj.documentElement).appendChild(host);
  return { host, filter };
}

// One surface's lens: which tiles it uses and the filter that draws them.
interface Lens {
  key: string;
  host: SVGSVGElement;
  filter: Element;
  tiles: LensTiles;
  width: number;
  height: number;
}

function placeLens(lens: Lens, width: number, height: number) {
  if (lens.width !== width || lens.height !== height) {
    lens.width = width;
    lens.height = height;
    placeLensFilter(lens.filter, width, height, lens.tiles);
  }
}

// Swaps a surface onto a lens for a new key once its tiles have decoded, one frame after the new
// filter is in the document so it never draws before its images; meanwhile the old lens stays.
function createLensSwitcher(options: {
  documentObj: Document;
  windowObj: LiquidGlassWindow;
  createTileCanvas: () => LensTileCanvas;
  idPrefix: string;
  apply(filterId: string, lens: Lens): void;
  measure(): [number, number];
}) {
  const { documentObj, windowObj, createTileCanvas, idPrefix, apply, measure } = options;
  const tilesFor = createLensCache(documentObj, createTileCanvas);
  let wanted = '';
  let current: Lens | null = null;
  let destroyed = false;
  return {
    // Fits the current lens when the key holds, or prepares one for the new key.
    update(rim: LensRim, scale: number, dispersion: boolean) {
      const key = `${rim.shape}:${rim.radius}:${rim.corner}:${rim.bezel}:${scale}:${dispersion ? 'rgb' : 'g'}`;
      const [width, height] = measure();
      // The current lens follows the size even while a lens for a new key is prepared, so its filter
      // never stops short of the surface.
      if (current) {
        placeLens(current, width, height);
      }
      if (current && current.key === key) {
        wanted = key;
        return;
      }
      if (wanted === key) {
        return;
      }
      wanted = key;
      tilesFor(rim).then((tiles) => {
        if (destroyed || wanted !== key) {
          return;
        }
        const [nextWidth, nextHeight] = measure();
        // Numbered across every lens on the page: url(#id) takes the first element with an id, so a
        // repeated id would give every surface the first surface's lens.
        const filterId = `${idPrefix}_${(filterCount += 1)}_2026_unique_`;
        const { host, filter } = createFilterHost(
          documentObj,
          buildLensFilter(filterId, nextWidth, nextHeight, tiles, scale, dispersion)
        );
        windowObj.requestAnimationFrame(() => {
          if (destroyed || wanted !== key) {
            host.remove();
            return;
          }
          const previous = current;
          current = {
            key,
            host,
            filter,
            tiles,
            width: nextWidth,
            height: nextHeight
          };
          placeLens(current, ...measure());
          apply(filterId, current);
          windowObj.requestAnimationFrame(() => previous?.host.remove());
        });
      }).catch(() => {
        if (wanted === key) {
          wanted = '';
        }
      });
    },
    destroy() {
      destroyed = true;
      wanted = '';
      current?.host.remove();
      current = null;
    }
  };
}

export interface LiquidGlass {
  destroy(): void;
  sync(): void;
}

// The bar's size before it is first shown (it is display: none until then), so its first frame
// already has the glass; the real size replaces the estimate once the bar lays out.
const DOCKED_HEIGHT_PX = 36;
const FLOATING_HEIGHT_PX = 40;
const FLOATING_SIDE_INSET_PX = 12;

// Keeps the bar's lens matched to its size and shape while the bookmarks bar uses the clear glass
// surface.
export function createLiquidGlass(options: {
  documentObj: Document;
  element: HTMLElement;
  windowObj: LiquidGlassWindow;
  createTileCanvas?: () => LensTileCanvas;
}): LiquidGlass {
  const { documentObj, element, windowObj } = options;
  const createTileCanvas = options.createTileCanvas || (() => documentObj.createElement('canvas'));
  const supported = isLiquidGlassSupported(windowObj);
  const shapeOf = (): LiquidGlassShape => element.dataset.layout === 'floating' ? 'floating' : 'docked';
  const measure = (): [number, number] => {
    if (element.clientWidth && element.clientHeight) {
      return [Math.round(element.clientWidth), Math.round(element.clientHeight)];
    }
    const viewportWidth = documentObj.documentElement.clientWidth || windowObj.innerWidth || 0;
    return shapeOf() === 'floating'
      ? [Math.round(viewportWidth - FLOATING_SIDE_INSET_PX * 2), FLOATING_HEIGHT_PX]
      : [Math.round(viewportWidth), DOCKED_HEIGHT_PX];
  };
  let lens: ReturnType<typeof createLensSwitcher> | null = null;
  let destroyed = false;

  const disable = () => {
    lens?.destroy();
    lens = null;
    element.removeAttribute('data-liquid-glass');
    element.style.removeProperty('--x-nt-bookmarks-topbar-liquid-filter');
  };

  const isWanted = () =>
    supported &&
    element.dataset.surfaceMode === 'clear' &&
    element.dataset.active === 'true';

  return {
    sync() {
      if (destroyed) {
        return;
      }
      if (!isWanted()) {
        disable();
        return;
      }
      const [width, height] = measure();
      if (width <= 0 || height <= 0) {
        return;
      }
      if (!lens) {
        lens = createLensSwitcher({
          documentObj,
          windowObj,
          createTileCanvas,
          idPrefix: '_x_extension_newtab_liquid_glass',
          measure,
          apply(filterId) {
            element.style.setProperty('--x-nt-bookmarks-topbar-liquid-filter', `url(#${filterId})`);
            element.dataset.liquidGlass = 'true';
          }
        });
      }
      const shape = shapeOf();
      const radius = shape === 'floating' ? Math.round(Math.min(BAR_RADIUS_PX, width / 2, height / 2)) : 0;
      const bezel = Math.round(Math.min(BAR_BEZEL_PX, height / 2));
      lens.update({ shape, radius, corner: ROUND_CORNER, bezel }, getSurfaceDisplacementScale(bezel), false);
    },
    destroy() {
      destroyed = true;
      disable();
    }
  };
}

function readCornerRadius(style: LensStyle, width: number, height: number) {
  const value = String(style.borderTopLeftRadius || '0').split(' ')[0];
  const amount = Number.parseFloat(value) || 0;
  return value.endsWith('%') ? (amount / 100) * Math.min(width, height) : amount;
}

export interface LiquidSurfaces {
  destroy(): void;
  refresh(): void;
}

// Gives every element matching `selector` a rim-refraction filter in the inline custom property
// `property`. Only surfaces matching `dispersionSelector` split the bend into colors; each costs
// three displacement passes instead of one. A surface may set its own rim width in the CSS property
// `rimProperty`, held whatever its size (narrowed only on a surface too short for it), so a plate
// that grows keeps one lens instead of a new one at every step. It may also scale how far its rim
// bends in the CSS property `strengthProperty` (1 when unset). Sizes are followed from a
// ResizeObserver, which runs after layout and before paint, so a surface's lens fits its new size
// in the frame it changes.
export function createLiquidSurfaces(options: {
  documentObj: Document;
  dispersionSelector?: string;
  property: string;
  rimProperty?: string;
  selector: string;
  strengthProperty?: string;
  windowObj: LiquidGlassWindow;
  createTileCanvas?: () => LensTileCanvas;
}): LiquidSurfaces {
  const { documentObj, dispersionSelector, property, rimProperty, selector, strengthProperty, windowObj } = options;
  const createTileCanvas = options.createTileCanvas || (() => documentObj.createElement('canvas'));
  const supported = isLiquidGlassSupported(windowObj);
  const idPrefix = '_x_extension_newtab_liquid_surface';
  const lenses = new Map<HTMLElement, ReturnType<typeof createLensSwitcher>>();
  let destroyed = false;

  const size = (element: HTMLElement): [number, number] =>
    [Math.round(element.offsetWidth), Math.round(element.offsetHeight)];

  const drop = (element: HTMLElement) => {
    lenses.get(element)?.destroy();
    lenses.delete(element);
    element.style.removeProperty(property);
  };

  const update = (element: HTMLElement) => {
    if (destroyed) {
      return;
    }
    if (!element.isConnected || !element.matches(selector)) {
      drop(element);
      resizeObserver?.unobserve(element);
      return;
    }
    const [width, height] = size(element);
    // Hidden (the closed results plate): keep the lens for when it shows again.
    if (width <= 0 || height <= 0) {
      return;
    }
    if (Math.min(width, height) < LENS_MIN_PX) {
      drop(element);
      return;
    }
    let lens = lenses.get(element);
    if (!lens) {
      lens = createLensSwitcher({
        documentObj,
        windowObj,
        createTileCanvas,
        idPrefix,
        measure: () => size(element),
        apply: (filterId) => element.style.setProperty(property, `url(#${filterId})`)
      });
      lenses.set(element, lens);
    }
    const style = windowObj.getComputedStyle(element);
    const radius = Math.round(Math.min(readCornerRadius(style, width, height), width / 2, height / 2));
    // The rim width the surface sets for itself, in px; none leaves it to getSurfaceBezel.
    const rim = rimProperty ? Number.parseFloat(style.getPropertyValue(rimProperty)) : 0;
    const bezel = Math.round(rim > 0 ? Math.min(rim, Math.min(width, height) / 2) : getSurfaceBezel(width, height));
    const dispersion = Boolean(dispersionSelector && element.matches(dispersionSelector));
    const setStrength = strengthProperty ? Number.parseFloat(style.getPropertyValue(strengthProperty)) : 0;
    const strength = setStrength > 0 ? setStrength : 1;
    // The lens follows the corner's own curve: a circle, or the superellipse New Tab's plates use.
    const corner = getCornerExponent(String(style.getPropertyValue('corner-top-left-shape') || ''));
    lens.update({ shape: 'floating', radius, corner, bezel }, getSurfaceDisplacementScale(bezel, strength), dispersion);
  };

  const ResizeObserverCtor = windowObj.ResizeObserver;
  const MutationObserverCtor = windowObj.MutationObserver;
  const resizeObserver = supported && ResizeObserverCtor
    ? new ResizeObserverCtor((entries) => entries.forEach((entry) => {
      if (isHtmlElement(entry.target)) {
        update(entry.target);
      }
    }))
    : null;
  const observeAll = () => queryHtmlElements(documentObj, selector).forEach((element) => {
    resizeObserver?.observe(element);
  });
  // Only changes that add or remove a surface matter; the clock alone rewrites its digits every second.
  const touchesSurface = (nodes: NodeList) => Array.from(nodes).some((node) =>
    isElementNode(node) && (node.matches(selector) || Boolean(node.querySelector(selector))));
  const mutationObserver = supported && MutationObserverCtor
    ? new MutationObserverCtor((records) => {
      if (records.some((record) => touchesSurface(record.removedNodes))) {
        Array.from(lenses.keys()).filter((element) => !element.isConnected).forEach(drop);
      }
      if (records.some((record) => touchesSurface(record.addedNodes))) {
        observeAll();
      }
    })
    : null;

  if (supported) {
    mutationObserver?.observe(documentObj.body || documentObj.documentElement, { childList: true, subtree: true });
    observeAll();
  }

  return {
    refresh() {
      observeAll();
      lenses.forEach((_lens, element) => update(element));
    },
    destroy() {
      destroyed = true;
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
      Array.from(lenses.keys()).forEach(drop);
    }
  };
}
