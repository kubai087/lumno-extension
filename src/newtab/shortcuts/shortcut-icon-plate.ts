// A shortcut icon whose artwork has no background of its own (a bare logo on
// transparency) gets a plate, so it reads as a tile like the icons that
// bring their own square. The plate is a soft tint of the artwork's main
// color. Each shortcut can turn this on or off, or pick the plate color.
import { createCanvas } from '../dom/canvas';
const SAMPLE_SIZE = 32;
const TRANSPARENT_ALPHA = 24;
const OPAQUE_ALPHA = 128;
// A rounded-square icon leaves only its corners clear; a bare logo or a
// round badge leaves most of the edge clear.
const MIN_CLEAR_EDGE_RATIO = 0.4;
const MAX_OPAQUE_COVERAGE = 0.9;
// Yellow on a pale plate still reads; a white logo on white does not.
const MIN_PLATE_CONTRAST = 1.4;
const MAX_PALETTE_SIZE = 3;
const MIN_PALETTE_SHARE = 0.12;
const MIN_PALETTE_DISTANCE = 96;
const MAX_CACHE_ENTRIES = 400;
// Red, green and blue, 0 to 255.
type Rgb = readonly number[];

type PlateMode = 'on' | 'off';

// What the plate logic reads from an icon's artwork.
interface IconAnalysis {
  // See-through at its edge, so it needs a plate to read as a tile.
  transparent: boolean;
  accent: number[] | null;
  palette: number[][];
}

interface PlateColors {
  light: string;
  dark: string;
}

const PLATE_MODES: readonly PlateMode[] = Object.freeze(['on', 'off']);
const LIGHT_BASE: Rgb = [255, 255, 255];
const DARK_BASE: Rgb = [42, 42, 44];
const analysisCache = new Map<string, IconAnalysis | null>();

function clampChannel(value: unknown): number {
  return Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
}

function mixColor(color: Rgb, target: Rgb, amount: number): number[] {
  return [0, 1, 2].map((index) => clampChannel(color[index] + ((target[index] - color[index]) * amount)));
}

function getLuminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
}

function getContrastRatio(first: Rgb, second: Rgb): number {
  const a = getLuminance(first);
  const b = getLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function isNearWhite(rgb: Rgb): boolean {
  return Math.min(rgb[0], rgb[1], rgb[2]) > 232;
}

function getColorDistance(first: Rgb, second: Rgb): number {
  return Math.abs(first[0] - second[0]) + Math.abs(first[1] - second[1]) + Math.abs(first[2] - second[2]);
}

function getSaturation(rgb: Rgb): number {
  const max = Math.max(rgb[0], rgb[1], rgb[2]) / 255;
  const min = Math.min(rgb[0], rgb[1], rgb[2]) / 255;
  if (max === min) return 0;
  const lightness = (max + min) / 2;
  return (max - min) / (1 - Math.abs((2 * lightness) - 1));
}

function rgbToHex(rgb: Rgb): string {
  return `#${rgb.map((channel) => clampChannel(channel).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function hexToRgb(value: unknown): number[] | null {
  const match = /^#([\da-f]{6})$/i.exec(String(value || '').trim());
  if (!match) return null;
  return [0, 2, 4].map((offset) => parseInt(match[1].slice(offset, offset + 2), 16));
}

function rgbToCss(rgb: Rgb): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

// '' means automatic: a plate only behind see-through artwork.
function normalizePlateMode(value: unknown): PlateMode | '' {
  return value === 'on' || value === 'off' ? value : '';
}

function normalizePlateColor(value: unknown): string {
  const rgb = hexToRgb(value);
  return rgb ? rgbToHex(rgb) : '';
}

// Reads RGBA pixels of a square sample. Returns whether the artwork is
// see-through at its edge, its main color and a few distinct colors.
function analyzePixels(data: ArrayLike<number> | null | undefined, size: number): IconAnalysis | null {
  const side = Math.max(1, Math.floor(Number(size) || SAMPLE_SIZE));
  if (!data || data.length < side * side * 4) {
    return null;
  }
  let edgeCount = 0;
  let clearEdgeCount = 0;
  let opaqueCount = 0;
  let visibleCount = 0;
  const buckets = new Map<number, { weight: number; count: number; r: number; g: number; b: number }>();
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      const offset = ((y * side) + x) * 4;
      const alpha = data[offset + 3];
      const onEdge = x < 2 || y < 2 || x >= side - 2 || y >= side - 2;
      if (onEdge) {
        edgeCount += 1;
        if (alpha < TRANSPARENT_ALPHA) clearEdgeCount += 1;
      }
      if (alpha >= OPAQUE_ALPHA) opaqueCount += 1;
      if (alpha < OPAQUE_ALPHA) continue;
      visibleCount += 1;
      const rgb = [data[offset], data[offset + 1], data[offset + 2]];
      // Colorful pixels outweigh white or gray detail, so a white letter on
      // an orange bag still reads as orange.
      const weight = (alpha / 255) * (isNearWhite(rgb) ? 0.08 : 0.3 + getSaturation(rgb));
      const key = ((rgb[0] >> 5) << 6) | ((rgb[1] >> 5) << 3) | (rgb[2] >> 5);
      const bucket = buckets.get(key) || { weight: 0, count: 0, r: 0, g: 0, b: 0 };
      bucket.weight += weight;
      bucket.count += 1;
      bucket.r += rgb[0];
      bucket.g += rgb[1];
      bucket.b += rgb[2];
      buckets.set(key, bucket);
    }
  }
  const total = side * side;
  const transparent = edgeCount > 0 &&
    (clearEdgeCount / edgeCount) >= MIN_CLEAR_EDGE_RATIO &&
    (opaqueCount / total) <= MAX_OPAQUE_COVERAGE &&
    visibleCount > 0;
  const sorted = Array.from(buckets.values()).sort((first, second) => second.weight - first.weight);
  const totalWeight = sorted.reduce((sum, bucket) => sum + bucket.weight, 0);
  const ranked = sorted.map((bucket) => ({
    share: totalWeight ? bucket.weight / totalWeight : 0,
    rgb: [bucket.r / bucket.count, bucket.g / bucket.count, bucket.b / bucket.count].map(clampChannel)
  }));
  // Only colors that make up a real part of the artwork, not the blends at
  // its anti-aliased edges; white is always offered on its own.
  const palette: number[][] = [];
  ranked.forEach(({ share, rgb }) => {
    if (palette.length >= MAX_PALETTE_SIZE || share < MIN_PALETTE_SHARE || isNearWhite(rgb)) return;
    if (palette.some((color) => getColorDistance(color, rgb) < MIN_PALETTE_DISTANCE)) return;
    palette.push(rgb);
  });
  return {
    transparent,
    // A white-only logo keeps white as its color.
    accent: palette[0] || (ranked[0] ? ranked[0].rgb : null),
    palette
  };
}

function analyzeImage(
  image: HTMLImageElement | null | undefined,
  options?: { documentObj?: Pick<Document, 'createElement'> | null }
): IconAnalysis | null {
  const opts = options || {};
  const source = image && (image.currentSrc || image.src) ? String(image.currentSrc || image.src) : '';
  if (!image || !source || !image.complete || !(image.naturalWidth > 0)) {
    return null;
  }
  const cached = analysisCache.get(source);
  if (cached !== undefined) {
    return cached;
  }
  const documentObj = opts.documentObj || globalThis.document;
  if (!documentObj || typeof documentObj.createElement !== 'function') {
    return null;
  }
  let result: IconAnalysis | null = null;
  try {
    const canvas = createCanvas(documentObj, SAMPLE_SIZE, SAMPLE_SIZE);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.clearRect(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    result = analyzePixels(context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data, SAMPLE_SIZE);
  } catch (error) {
    // A cross-origin image taints the canvas; such icons keep no plate.
    result = null;
  }
  const oldest = analysisCache.keys().next();
  if (analysisCache.size >= MAX_CACHE_ENTRIES && !oldest.done) {
    analysisCache.delete(oldest.value);
  }
  analysisCache.set(source, result);
  return result;
}

// The first tint that keeps the artwork legible, on the mode's own surface
// first: a black logo gets a light plate even in dark mode, a white logo a
// dark one in light mode.
function pickPlate(accent: Rgb, candidates: readonly Rgb[]): Rgb {
  let best = candidates[0];
  let bestContrast = 0;
  for (const candidate of candidates) {
    const contrast = getContrastRatio(candidate, accent);
    if (contrast >= MIN_PLATE_CONTRAST) return candidate;
    if (contrast > bestContrast) {
      best = candidate;
      bestContrast = contrast;
    }
  }
  return best;
}

function getAutoPlateColors(accent: Rgb | null | undefined): PlateColors {
  const color = Array.isArray(accent) && accent.length === 3 ? accent : null;
  if (!color) {
    return { light: rgbToCss(LIGHT_BASE), dark: rgbToCss([58, 58, 60]) };
  }
  // The tile around the plate is tinted from the same color. In light mode
  // the plate is a paler tint than the tile, gray and black artwork getting
  // plain white; in dark mode a stronger one, so it reads as its own square.
  const strength = getSaturation(color);
  const light = pickPlate(color, [
    mixColor(color, LIGHT_BASE, 1 - (0.12 * strength)),
    mixColor(color, DARK_BASE, 0.62)
  ]);
  const dark = pickPlate(color, [
    mixColor(color, DARK_BASE, 0.78 - (0.26 * strength)),
    mixColor(color, LIGHT_BASE, 0.88)
  ]);
  return { light: rgbToCss(light), dark: rgbToCss(dark) };
}

// Plate colors a person can pick in the shortcut dialog: a soft and a
// stronger tint of the artwork's main color, soft tints of its other
// colors, then white and near-black.
function getPlateColorChoices(analysis: IconAnalysis | null | undefined): string[] {
  const palette = analysis && Array.isArray(analysis.palette) ? analysis.palette : [];
  const candidates: Rgb[] = [];
  palette.forEach((rgb, index) => {
    candidates.push(pickPlate(rgb, [mixColor(rgb, LIGHT_BASE, 0.86), mixColor(rgb, DARK_BASE, 0.6)]));
    if (index === 0) {
      candidates.push(pickPlate(rgb, [mixColor(rgb, LIGHT_BASE, 0.68), mixColor(rgb, DARK_BASE, 0.4)]));
    }
  });
  candidates.push(LIGHT_BASE, [28, 28, 30]);
  const choices: Rgb[] = [];
  candidates.forEach((rgb) => {
    if (choices.some((color) => getColorDistance(color, rgb) < 24)) return;
    choices.push(rgb);
  });
  return choices.map(rgbToHex);
}

// What a tile shows: null for no plate, else the plate colors per mode.
function resolvePlate(input: {
  mode?: unknown;
  // false when the icon cannot take a plate at all.
  eligible?: boolean;
  analysis?: IconAnalysis | null;
  color?: unknown;
} | null | undefined): (PlateColors & { custom: boolean }) | null {
  const source = input || {};
  const mode = normalizePlateMode(source.mode);
  if (mode === 'off' || source.eligible === false) {
    return null;
  }
  const analysis = source.analysis || null;
  if (mode !== 'on' && !(analysis && analysis.transparent)) {
    return null;
  }
  const customRgb = hexToRgb(normalizePlateColor(source.color));
  if (customRgb) {
    const css = rgbToCss(customRgb);
    return { light: css, dark: css, custom: true };
  }
  return { ...getAutoPlateColors(analysis && analysis.accent), custom: false };
}

export {
  SAMPLE_SIZE,
  PLATE_MODES,
  normalizePlateMode,
  normalizePlateColor,
  analyzePixels,
  analyzeImage,
  getAutoPlateColors,
  getPlateColorChoices,
  resolvePlate,
  rgbToHex,
  hexToRgb,
  getContrastRatio
};
export type { IconAnalysis, PlateColors, PlateMode };
