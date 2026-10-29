// Wallpaper-adaptive tones: samples the wallpaper under each text, icon and
// glass surface of the New Tab page and sets the ink and colors that read on it.
import { createCanvas } from '../../shared/dom/canvas';
import type { WallpaperSample } from '../dom/wallpaper-effects';
import { newtabGlassInkHint } from '../../domain/settings/newtab-wallpaper';
import { adaptiveToneEvents } from './tone-requests';

type ToneInk = 'light' | 'dark';
type ThemeMode = 'light' | 'dark';

interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

// A translucent color, alpha 0-1.
interface Tone {
  color: RgbColor;
  alpha: number;
}

// What a glass plate needs: its ink, tint density (0-1) and how much of the
// material's saturation boost to keep.
interface GlassAdaptation {
  ink: ToneInk;
  density: number;
  saturate: number;
}

// Something with a box on screen to sample under.
interface SampleSource {
  getBoundingClientRect(): Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>;
}

interface ScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

type SampleRect = Pick<ScreenRect, 'left' | 'top' | 'width' | 'height'>;

// An element the tone is set on, and how it samples the wallpaper.
interface AdaptiveToneTarget {
  element: HTMLElement | null | undefined;
  // The element (or elements, read as one box) whose wallpaper is sampled.
  sampleElement?: SampleSource | Array<SampleSource | null | undefined> | null;
  // Targets in one group read one sample and keep one ink.
  toneGroup?: string;
  // The smallest area sampled around the element, in px.
  minWidth?: number;
  minHeight?: number;
  disabled?: boolean;
  // An ink the user fixed for this target.
  ink?: ToneInk | '';
  // Icon buttons sample more points and get a solid fill while pointed at.
  iconButton?: boolean;
  // Samples the wallpaper without the overlay mask over it.
  ignoreOverlay?: boolean;
  surface?: 'topbar';
  // A top bar keeps the light or dark family of a strong mask.
  preferOverlayPolarity?: boolean;
  forcedIconBackground?: 'shortcut-fallback' | 'shortcut-add' | 'default-theme';
  // A glass plate: it gets a glass ink and tint density instead.
  glass?: boolean;
  glassGroup?: string;
  // A glass surface whose ink follows the theme.
  themeInk?: boolean;
  // A glass surface whose controls switch to the dark palette with light ink.
  paletteSwap?: boolean;
  // A panel, menu or dialog over the page: it takes the plates' ink without weighing in.
  floating?: boolean;
}

interface ToneScheduleOptions {
  // Decide the glass ink afresh instead of holding the last one.
  resetInk?: boolean;
}

// The wallpaper under a target, as shown: its mean luminance and color, how
// much overlay covers it, and how far its brightest and darkest points differ.
interface ToneSample {
  luminance: number;
  color: RgbColor;
  overlayAlpha: number;
  textureContrast: number;
}

// The shown image drawn into a small canvas, with how its pixels map onto
// the full image.
interface AdaptiveToneSampler {
  url: string;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  imageData: Uint8ClampedArray | null;
  naturalWidth: number;
  naturalHeight: number;
  sampleScaleX: number;
  sampleScaleY: number;
}

// The page the tones are set on and the wallpaper they are sampled from. W is
// the page's wallpaper record, which the tone only hands back to it.
interface WallpaperAdaptiveToneOptions<W> {
  documentObj?: Document;
  windowObj?: Window;
  getTargets?: () => ReadonlyArray<AdaptiveToneTarget | null | undefined>;
  getCurrentWallpaper?: () => W | null | undefined;
  getWallpaperImageUrl?: (wallpaper: W) => string;
  // The sampler is only a few hundred pixels across, so it reads the small
  // copy instead of decoding the full wallpaper.
  getWallpaperSample?: (wallpaper: W) => WallpaperSample | null | undefined;
  // How opaque the overlay mask is at a viewport height, 0-1.
  getOverlayAlphaAtViewportY?: (viewportY: number) => number;
  // The mask's luminance: 0 black, 1 white.
  getOverlayLuminance?: () => number;
  getEffectLuminanceAtViewport?: (viewportX: number, viewportY: number, baseLuminance: number) => number | null | undefined;
  // Hears each new sampler, whose canvas holds the shown image scaled down.
  onSamplerReady?: (sampler: AdaptiveToneSampler) => void;
  // An image another script already loaded and decoded to sample this URL's
  // wallpaper (the wallpaper preload's small copy), or null.
  getPreloadedImage?: (url: string) => PromiseLike<HTMLImageElement | null> | null | undefined;
}

// The global timers with the DOM's numeric ids.
const globalTimers: Pick<Window, 'setTimeout' | 'clearTimeout'> = globalThis;

function clampNumber(value: unknown, min: number, max: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return min;
  }
  return Math.min(max, Math.max(min, number));
}

const adaptiveToneStyleProps = [
  '--x-nt-wallpaper-adaptive-ink',
  '--x-nt-wallpaper-adaptive-ink-muted',
  '--x-nt-wallpaper-adaptive-hover-bg',
  '--x-nt-wallpaper-adaptive-shadow',
  '--x-nt-wallpaper-adaptive-halo',
  '--x-nt-wallpaper-wordmark-ink',
  '--x-nt-wallpaper-wordmark-shadow',
  '--x-nt-wallpaper-wordmark-halo',
  '--x-nt-wallpaper-icon-solid-bg',
  '--x-nt-wallpaper-icon-solid-bg-hover',
  '--x-nt-wallpaper-icon-solid-ink',
  '--x-nt-wallpaper-icon-solid-ink-hover',
  '--x-nt-wallpaper-surface-border',
  '--x-nt-wallpaper-surface-clear',
  '--x-nt-wallpaper-surface-clear-terminal',
  '--x-nt-wallpaper-surface-mist',
  '--x-nt-wallpaper-surface-mist-terminal',
  '--x-nt-shortcut-wallpaper-icon-bg',
  '--x-nt-shortcut-wallpaper-icon-color',
  '--x-nt-shortcut-fallback-icon-bg',
  '--x-nt-shortcut-fallback-icon-color',
  '--x-nt-shortcut-add-bg',
  '--x-nt-shortcut-add-color'
];
// The wordmark and clock are display text: dark ink sits well clear of the
// wallpaper, light ink at least at AA, and both go further on busy textures.
const WORDMARK_DARK_INK_CONTRAST = 5.5;
const WORDMARK_DARK_INK_TEXTURED_CONTRAST = 7;
const WORDMARK_LIGHT_INK_CONTRAST = 4.5;
const WORDMARK_LIGHT_INK_TEXTURED_CONTRAST = 6;
// Lightness ranges the ink is searched in, from its gentlest to its extreme.
const WORDMARK_DARK_INK_LIGHTNESS = [0.3, 0.08];
const WORDMARK_LIGHT_INK_LIGHTNESS = [0.94, 1];
// Neutral wallpapers take the page's slate hue instead of a hue they lack.
const WORDMARK_NEUTRAL_SATURATION = 0.06;
const WORDMARK_NEUTRAL_HUE = 215;
// WCAG AA for small text, and for the secondary text set in the muted ink.
const ADAPTIVE_INK_MIN_CONTRAST = 4.5;
const ADAPTIVE_INK_MUTED_MIN_CONTRAST = 3;
const TONE_LIGHT_TARGET: RgbColor = { red: 248, green: 250, blue: 252 };
const TONE_DARK_TARGET: RgbColor = { red: 15, green: 23, blue: 42 };
const TOPBAR_MASK_POLARITY_MIN_ALPHA = 0.36;
// Chrome drops a hidden window's last frame (a minimized one, say) and, once the window is shown
// again, fills it with the page's background color until the wallpaper is drawn anew. The wallpaper
// covers that color at every other moment, so it takes the mean of what the wallpaper shows, mask
// and effect included, and the gap no longer flashes white or black (styles/page.css reads it).
const PAGE_BASE_COLOR_PROP = '--x-nt-wallpaper-base-color';
const PAGE_BASE_COLOR_COLUMNS = 8;
const PAGE_BASE_COLOR_ROWS = 6;
const BLACK: RgbColor = { red: 0, green: 0, blue: 0 };
const WHITE: RgbColor = { red: 255, green: 255, blue: 255 };

function mixNumber(start: number, end: number, amount: number): number {
  return start + ((end - start) * clampNumber(amount, 0, 1));
}

function mixChannel(start: number, end: number, amount: number): number {
  return Math.round(mixNumber(start, end, amount));
}

function formatRgb(red: number, green: number, blue: number, alphaPercent: number): string {
  return `rgb(${red} ${green} ${blue} / ${Math.round(alphaPercent)}%)`;
}

function formatSolidRgb(color: RgbColor): string {
  return `rgb(${Math.round(color.red)} ${Math.round(color.green)} ${Math.round(color.blue)})`;
}

function getColorLuminance(color: RgbColor): number {
  return ((color.red * 0.299) + (color.green * 0.587) + (color.blue * 0.114)) / 255;
}

function getRelativeLuminance(color: Partial<RgbColor> | null | undefined): number {
  const resolvedColor = getValidToneColor(color);
  function linearize(channel: number): number {
    const value = clampNumber(channel, 0, 255) / 255;
    return value <= 0.04045
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  }
  return (0.2126 * linearize(resolvedColor.red)) +
    (0.7152 * linearize(resolvedColor.green)) +
    (0.0722 * linearize(resolvedColor.blue));
}

function getContrastRatio(
  firstColor: Partial<RgbColor> | null | undefined,
  secondColor: Partial<RgbColor> | null | undefined
): number {
  const firstLuminance = getRelativeLuminance(firstColor);
  const secondLuminance = getRelativeLuminance(secondColor);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function mixColor(color: RgbColor, target: RgbColor, amount: number): RgbColor {
  return {
    red: mixChannel(color.red, target.red, amount),
    green: mixChannel(color.green, target.green, amount),
    blue: mixChannel(color.blue, target.blue, amount)
  };
}

// Moves a color toward black or white until it has the given luminance, keeping its hue.
function matchColorLuminance(color: RgbColor, luminance: number): RgbColor {
  const current = getColorLuminance(color);
  const target = clampNumber(luminance, 0, 1);
  if (target < current) {
    return mixColor(color, BLACK, 1 - (target / current));
  }
  if (target > current) {
    return mixColor(color, WHITE, (target - current) / (1 - current));
  }
  return color;
}

function smoothstep(value: number): number {
  const amount = clampNumber(value, 0, 1);
  return amount * amount * (3 - (2 * amount));
}

function setStyleProperty(element: HTMLElement, name: string, value: string): void {
  if (element.style.getPropertyValue(name) === value) {
    return;
  }
  element.style.setProperty(name, value);
}

function clearAdaptiveToneStyles(element: HTMLElement): void {
  adaptiveToneStyleProps.forEach((prop) => {
    element.style.removeProperty(prop);
  });
}

function getWallpaperOffWordmarkColor(overlayLuminance: number): RgbColor {
  return overlayLuminance >= 0.5
    ? { red: 242, green: 242, blue: 242 }
    : { red: 38, green: 38, blue: 38 };
}

function rgbToHsl(color: RgbColor): { hue: number; saturation: number; lightness: number } {
  const red = clampNumber(color.red, 0, 255) / 255;
  const green = clampNumber(color.green, 0, 255) / 255;
  const blue = clampNumber(color.blue, 0, 255) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) {
    return { hue: 0, saturation: 0, lightness };
  }
  const saturation = delta / (1 - Math.abs((2 * lightness) - 1));
  let hue: number;
  if (max === red) {
    hue = ((green - blue) / delta) % 6;
  } else if (max === green) {
    hue = ((blue - red) / delta) + 2;
  } else {
    hue = ((red - green) / delta) + 4;
  }
  return { hue: ((hue * 60) + 360) % 360, saturation: clampNumber(saturation, 0, 1), lightness };
}

function hslToRgb(hue: number, saturation: number, lightness: number): RgbColor {
  const chroma = (1 - Math.abs((2 * lightness) - 1)) * saturation;
  const segment = ((hue % 360) + 360) % 360 / 60;
  const second = chroma * (1 - Math.abs((segment % 2) - 1));
  const [red, green, blue] = segment < 1 ? [chroma, second, 0]
    : segment < 2 ? [second, chroma, 0]
      : segment < 3 ? [0, chroma, second]
        : segment < 4 ? [0, second, chroma]
          : segment < 5 ? [second, 0, chroma]
            : [chroma, 0, second];
  const offset = lightness - (chroma / 2);
  return {
    red: Math.round((red + offset) * 255),
    green: Math.round((green + offset) * 255),
    blue: Math.round((blue + offset) * 255)
  };
}

// The hue the wordmark ink and its shadow borrow from the wallpaper, with a
// restrained saturation so the ink reads as a tinted neutral, not a color.
function getWordmarkTint(color: RgbColor): { hue: number; saturation: number } {
  const hsl = rgbToHsl(color);
  if (hsl.saturation < WORDMARK_NEUTRAL_SATURATION) {
    return { hue: WORDMARK_NEUTRAL_HUE, saturation: 0.14 };
  }
  return { hue: hsl.hue, saturation: clampNumber(hsl.saturation * 0.6, 0.12, 0.38) };
}

function getWordmarkInkColor(
  color: Partial<RgbColor> | null | undefined,
  luminance: number,
  ink: string,
  overlayAlpha: number,
  overlayLuminance: number,
  textureContrast: number | null | undefined,
  effectType: string | null | undefined
): RgbColor {
  const resolvedOverlayAlpha = clampNumber(overlayAlpha, 0, 1);
  if (isWallpaperOverlayCovered(resolvedOverlayAlpha)) {
    return getWallpaperOffWordmarkColor(clampNumber(overlayLuminance, 0, 1));
  }
  const baseColor = getValidToneColor(color);
  const highTexture = isHighTextureTone(textureContrast, effectType, 0.16);
  const background = effectType && effectType !== 'none'
    ? {
        red: clampNumber(luminance, 0, 1) * 255,
        green: clampNumber(luminance, 0, 1) * 255,
        blue: clampNumber(luminance, 0, 1) * 255
      }
    : baseColor;
  const dark = ink === 'dark';
  const tint = getWordmarkTint(baseColor);
  const saturation = dark ? tint.saturation : tint.saturation * 0.5;
  const [gentlest, extreme] = dark ? WORDMARK_DARK_INK_LIGHTNESS : WORDMARK_LIGHT_INK_LIGHTNESS;
  const minimumContrast = dark
    ? (highTexture ? WORDMARK_DARK_INK_TEXTURED_CONTRAST : WORDMARK_DARK_INK_CONTRAST)
    : (highTexture ? WORDMARK_LIGHT_INK_TEXTURED_CONTRAST : WORDMARK_LIGHT_INK_CONTRAST);
  const inkAt = (amount: number) => hslToRgb(tint.hue, saturation, mixNumber(gentlest, extreme, amount));
  // The ink keeps the wallpaper's hue and settles only its lightness: the
  // gentlest lightness that reaches the floor, or the extreme when none does
  // (mid tones, where the shadow carries the rest).
  if (getContrastRatio(inkAt(0), background) >= minimumContrast) {
    return inkAt(0);
  }
  let low = 0;
  let high = 1;
  for (let index = 0; index < 10; index += 1) {
    const amount = (low + high) / 2;
    if (getContrastRatio(inkAt(amount), background) >= minimumContrast) {
      high = amount;
    } else {
      low = amount;
    }
  }
  return inkAt(high);
}

function mixColorToMaxLuminance(color: RgbColor, target: RgbColor, maxLuminance: number): RgbColor {
  let low = 0;
  let high = 1;
  let best = color;
  for (let index = 0; index < 8; index += 1) {
    const amount = (low + high) / 2;
    const mixed = mixColor(color, target, amount);
    if (getColorLuminance(mixed) <= maxLuminance) {
      best = mixed;
      high = amount;
    } else {
      low = amount;
    }
  }
  return best;
}

function mixColorToMinLuminance(color: RgbColor, target: RgbColor, minLuminance: number): RgbColor {
  let low = 0;
  let high = 1;
  let best = color;
  for (let index = 0; index < 8; index += 1) {
    const amount = (low + high) / 2;
    const mixed = mixColor(color, target, amount);
    if (getColorLuminance(mixed) >= minLuminance) {
      best = mixed;
      high = amount;
    } else {
      low = amount;
    }
  }
  return best;
}

function isTexturedWallpaperEffect(effectType: string | null | undefined): boolean {
  return effectType === 'ascii' || effectType === 'dither' || effectType === 'halftone';
}

function isHighTextureTone(
  textureContrast: number | null | undefined,
  effectType: string | null | undefined,
  threshold: number
): boolean {
  return isTexturedWallpaperEffect(effectType) ||
    (typeof textureContrast === 'number' && Number.isFinite(textureContrast) && textureContrast >= threshold);
}

// How much help ink needs beyond its color: busy textures and mid tones near
// the light/dark threshold are where a flat color alone stops reading.
function getToneProtection(
  luminance: number,
  textureContrast: number | null | undefined,
  effectType: string | null | undefined
): number {
  const textureRisk = isHighTextureTone(textureContrast, effectType, 0.16)
    ? 1
    : clampNumber((Number(textureContrast) || 0) / 0.2, 0, 1);
  const middleLuminanceRisk = 1 - Math.min(1, Math.abs(luminance - 0.52) / 0.48);
  return Math.max(textureRisk, middleLuminanceRisk * 0.5);
}

function isWallpaperOverlayCovered(overlayAlpha: number): boolean {
  return clampNumber(overlayAlpha, 0, 1) >= 0.995;
}

function chooseSurfaceInk(overlayAlpha: number, overlayLuminance: number, fallbackInk: ToneInk): ToneInk {
  // Once the mask is visually strong enough to establish the top edge, keep
  // the material in the same light/dark family as that mask. Otherwise a
  // bright wallpaper under a black mask can land exactly on the generic ink
  // threshold and produce a pale surface with dark text (and vice versa).
  if (clampNumber(overlayAlpha, 0, 1) >= TOPBAR_MASK_POLARITY_MIN_ALPHA) {
    return clampNumber(overlayLuminance, 0, 1) < 0.5 ? 'light' : 'dark';
  }
  return fallbackInk;
}

function shouldUseIconSolidBackground(
  luminance: number,
  overlayAlpha: number,
  textureContrast: number,
  effectType: string
): boolean {
  if (clampNumber(overlayAlpha, 0, 1) >= 0.9) {
    return false;
  }
  if (isHighTextureTone(textureContrast, effectType, 0.1)) {
    return true;
  }
  return luminance > 0.08 && luminance < 0.96;
}

function getIconSolidBackgroundColor(color: RgbColor, luminance: number, ink: ToneInk, hover: boolean): RgbColor {
  const baseColor = getValidToneColor(color);
  const middleRisk = 1 - Math.min(1, Math.abs(luminance - 0.54) / 0.34);
  const hoverLift = hover ? 0.08 : 0;
  if (ink === 'dark') {
    const amount = 0.66 + (middleRisk * 0.18) + hoverLift;
    return mixColor(baseColor, { red: 252, green: 254, blue: 255 }, amount);
  }
  const amount = 0.68 + (middleRisk * 0.18) + hoverLift;
  return mixColor(baseColor, { red: 15, green: 23, blue: 42 }, amount);
}

function getIconSolidForegroundColor(backgroundColor: RgbColor): RgbColor {
  return getColorLuminance(backgroundColor) >= 0.56
    ? { red: 30, green: 41, blue: 59 }
    : { red: 248, green: 250, blue: 252 };
}

function getColorChroma(color: RgbColor): number {
  const max = Math.max(color.red, color.green, color.blue);
  const min = Math.min(color.red, color.green, color.blue);
  return (max - min) / 255;
}

function isFiniteChannel(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

// The color itself when all its channels are numbers, else a neutral slate.
function getValidToneColor(color: Partial<RgbColor> | null | undefined): RgbColor {
  if (color && isFiniteChannel(color.red) && isFiniteChannel(color.green) && isFiniteChannel(color.blue)) {
    return { red: color.red, green: color.green, blue: color.blue };
  }
  return { red: 128, green: 140, blue: 156 };
}

function getShortcutUrlBaseSurfaceColor(color: RgbColor, localLuminance: number, ink: ToneInk): RgbColor {
  const baseColor = getValidToneColor(color);
  const surfaceLuminance = clampNumber(localLuminance, 0, 1);
  const hueStrength = smoothstep((getColorChroma(baseColor) - 0.035) / 0.24);
  if (ink === 'light') {
    const tintAmount = mixNumber(0.025, 0.12, hueStrength);
    const darkBase = surfaceLuminance <= 0.26
      ? { red: 34, green: 38, blue: 46 }
      : { red: 24, green: 28, blue: 35 };
    const backgroundColor = mixColor(darkBase, baseColor, tintAmount);
    const minSeparation = surfaceLuminance <= 0.3 ? 0.07 : 0.1;
    const backgroundLuminance = getColorLuminance(backgroundColor);
    if (Math.abs(backgroundLuminance - surfaceLuminance) >= minSeparation) {
      return backgroundColor;
    }
    if (backgroundLuminance >= surfaceLuminance) {
      return mixColorToMinLuminance(
        backgroundColor,
        { red: 70, green: 78, blue: 92 },
        clampNumber(surfaceLuminance + minSeparation, 0, 0.36)
      );
    }
    return mixColorToMaxLuminance(
      backgroundColor,
      { red: 12, green: 16, blue: 22 },
      clampNumber(surfaceLuminance - minSeparation, 0.06, 1)
    );
  }

  const tintAmount = mixNumber(0.055, 0.2, hueStrength);
  const paleBase = surfaceLuminance >= 0.58
    ? { red: 244, green: 246, blue: 248 }
    : { red: 248, green: 250, blue: 252 };
  const backgroundColor = mixColor(paleBase, baseColor, tintAmount);
  const minSeparation = surfaceLuminance >= 0.78 ? 0.082 : 0.11;
  const backgroundLuminance = getColorLuminance(backgroundColor);
  if (Math.abs(backgroundLuminance - surfaceLuminance) >= minSeparation) {
    return backgroundColor;
  }
  if (surfaceLuminance >= 0.72) {
    const tintedGray = mixColor(
      { red: 218, green: 224, blue: 232 },
      baseColor,
      hueStrength * 0.28
    );
    return mixColorToMaxLuminance(
      backgroundColor,
      tintedGray,
      clampNumber(surfaceLuminance - minSeparation, 0, 1)
    );
  }
  return mixColorToMinLuminance(
    backgroundColor,
    { red: 255, green: 255, blue: 255 },
    clampNumber(surfaceLuminance + minSeparation, 0, 1)
  );
}

function getShortcutUrlSurfaceColor(color: RgbColor, localLuminance: number, ink: ToneInk): RgbColor {
  const baseSurfaceColor = getShortcutUrlBaseSurfaceColor(color, localLuminance, ink);
  const backgroundLuminance = getColorLuminance(baseSurfaceColor);
  if (ink === 'light') {
    const target = backgroundLuminance >= 0.26
      ? { red: 18, green: 22, blue: 28 }
      : { red: 52, green: 58, blue: 68 };
    return mixColor(baseSurfaceColor, target, backgroundLuminance >= 0.26 ? 0.1 : 0.28);
  }
  const target = backgroundLuminance >= 0.56
    ? { red: 255, green: 255, blue: 255 }
    : { red: 248, green: 250, blue: 252 };
  return mixColor(baseSurfaceColor, target, backgroundLuminance >= 0.56 ? 0.34 : 0.22);
}

function getShortcutAddSurfaceColor(urlSurfaceColor: RgbColor, ink: ToneInk): RgbColor {
  const backgroundLuminance = getColorLuminance(urlSurfaceColor);
  if (ink === 'light') {
    const target = backgroundLuminance >= 0.32
      ? { red: 92, green: 102, blue: 118 }
      : { red: 70, green: 78, blue: 92 };
    return mixColor(urlSurfaceColor, target, backgroundLuminance >= 0.32 ? 0.14 : 0.24);
  }
  const target = backgroundLuminance >= 0.5
    ? { red: 255, green: 255, blue: 255 }
    : { red: 248, green: 250, blue: 252 };
  return mixColor(urlSurfaceColor, target, backgroundLuminance >= 0.56 ? 0.28 : 0.18);
}

function getForcedShortcutSurfaceInk(ink: ToneInk, themeMode: ThemeMode): ToneInk {
  return themeMode === 'dark' ? 'light' : ink;
}

function shouldApplyForcedIconBackground(element: HTMLElement | null | undefined, mode: string): boolean {
  if (!element) {
    return false;
  }
  if (mode === 'shortcut-add') {
    return true;
  }
  if (mode === 'default-theme') {
    return element.getAttribute('data-shortcut-theme-default') === 'true';
  }
  return true;
}

function clearForcedIconBackgroundStyles(element: HTMLElement | null | undefined): void {
  if (!element) {
    return;
  }
  element.removeAttribute('data-wallpaper-forced-icon-bg');
  element.style.removeProperty('--x-nt-shortcut-wallpaper-icon-bg');
  element.style.removeProperty('--x-nt-shortcut-wallpaper-icon-color');
  element.style.removeProperty('--x-nt-shortcut-fallback-icon-bg');
  element.style.removeProperty('--x-nt-shortcut-fallback-icon-color');
  element.style.removeProperty('--x-nt-shortcut-add-bg');
  element.style.removeProperty('--x-nt-shortcut-add-color');
}

function applyForcedIconBackgroundStyles(
  element: HTMLElement,
  luminance: number,
  ink: ToneInk,
  color: RgbColor,
  mode: string,
  themeMode: ThemeMode
): void {
  if (!shouldApplyForcedIconBackground(element, mode)) {
    clearForcedIconBackgroundStyles(element);
    return;
  }
  const forcedSurfaceInk = getForcedShortcutSurfaceInk(ink, themeMode);
  const urlSurfaceColor = getShortcutUrlSurfaceColor(color, luminance, forcedSurfaceInk);
  if (mode === 'shortcut-fallback') {
    // CSS selects this palette only for folders and unavailable favicons,
    // so loading/recovering an image keeps its normal site theme immediately.
    setStyleProperty(element, '--x-nt-shortcut-fallback-icon-bg', formatSolidRgb(urlSurfaceColor));
    setStyleProperty(element, '--x-nt-shortcut-fallback-icon-color',
      formatSolidRgb(getIconSolidForegroundColor(urlSurfaceColor)));
    return;
  }
  if (mode === 'shortcut-add') {
    const addBackgroundColor = getShortcutAddSurfaceColor(urlSurfaceColor, forcedSurfaceInk);
    element.setAttribute('data-wallpaper-forced-icon-bg', 'true');
    setStyleProperty(element, '--x-nt-shortcut-add-bg', formatSolidRgb(addBackgroundColor));
    setStyleProperty(element, '--x-nt-shortcut-add-color',
      formatSolidRgb(getIconSolidForegroundColor(addBackgroundColor)));
    return;
  }
  element.setAttribute('data-wallpaper-forced-icon-bg', 'true');
  setStyleProperty(element, '--x-nt-shortcut-wallpaper-icon-bg', formatSolidRgb(urlSurfaceColor));
  setStyleProperty(element, '--x-nt-shortcut-wallpaper-icon-color',
    formatSolidRgb(getIconSolidForegroundColor(urlSurfaceColor)));
}

function applyIconSolidBackgroundStyles(
  element: HTMLElement | null | undefined,
  luminance: number,
  ink: ToneInk,
  color: RgbColor,
  overlayAlpha: number,
  textureContrast: number,
  effectType: string
): void {
  if (!element) {
    return;
  }
  const overlayCovered = isWallpaperOverlayCovered(overlayAlpha);
  element.setAttribute('data-wallpaper-overlay-cover', overlayCovered ? 'true' : 'false');
  const enabled = shouldUseIconSolidBackground(luminance, overlayAlpha, textureContrast, effectType);
  element.setAttribute('data-wallpaper-icon-bg', enabled ? 'true' : 'false');
  if (!enabled) {
    element.style.removeProperty('--x-nt-wallpaper-icon-solid-bg');
    element.style.removeProperty('--x-nt-wallpaper-icon-solid-bg-hover');
    element.style.removeProperty('--x-nt-wallpaper-icon-solid-ink');
    element.style.removeProperty('--x-nt-wallpaper-icon-solid-ink-hover');
    return;
  }
  const backgroundColor = getIconSolidBackgroundColor(color, luminance, ink, false);
  const hoverBackgroundColor = getIconSolidBackgroundColor(color, luminance, ink, true);
  setStyleProperty(element, '--x-nt-wallpaper-icon-solid-bg', formatSolidRgb(backgroundColor));
  setStyleProperty(element, '--x-nt-wallpaper-icon-solid-bg-hover', formatSolidRgb(hoverBackgroundColor));
  setStyleProperty(element, '--x-nt-wallpaper-icon-solid-ink',
    formatSolidRgb(getIconSolidForegroundColor(backgroundColor)));
  setStyleProperty(element, '--x-nt-wallpaper-icon-solid-ink-hover',
    formatSolidRgb(getIconSolidForegroundColor(hoverBackgroundColor)));
}

function applyWordmarkToneStyles(element: HTMLElement, ink: ToneInk, protection: number, color: RgbColor): void {
  // The shadow follows the ink family, a fixed one included. Light ink gets a soft,
  // diffuse shadow in a deep tone of the wallpaper's own hue, so it lifts
  // the ink without a grey smudge; dark ink has no offset shadow at all, only
  // a light bloom where busy textures or mid tones need separating.
  if (ink === 'light') {
    const tint = getWordmarkTint(getValidToneColor(color));
    const shadow = hslToRgb(tint.hue, tint.saturation, 0.1);
    setStyleProperty(element, '--x-nt-wallpaper-wordmark-shadow',
      formatRgb(shadow.red, shadow.green, shadow.blue, mixNumber(16, 30, protection)));
    setStyleProperty(element, '--x-nt-wallpaper-wordmark-halo',
      formatRgb(shadow.red, shadow.green, shadow.blue, mixNumber(8, 20, protection)));
    return;
  }
  setStyleProperty(element, '--x-nt-wallpaper-wordmark-shadow', 'transparent');
  setStyleProperty(element, '--x-nt-wallpaper-wordmark-halo',
    formatRgb(248, 250, 252, mixNumber(0, 34, protection)));
}

// A translucent tone is seen blended with the wallpaper behind it, so its contrast
// is measured on that blend rather than on the tone's own color.
function getTranslucentToneContrast(tone: Tone, backgroundColor: RgbColor): number {
  return getContrastRatio(
    mixColor(backgroundColor, tone.color, clampNumber(tone.alpha, 0, 1)),
    backgroundColor
  );
}

// Headings and breadcrumbs are small text: their ink must reach 4.5:1 and the
// muted ink 3:1 against the sampled background. A tone that falls short moves
// toward the opaque extreme of its ink family. The family itself is settled
// beforehand by chooseReadableInk, so every adaptive style stays in one family.
function ensureTranslucentToneReadable(
  tone: Partial<Tone> | null | undefined,
  backgroundColor: RgbColor,
  ink: string,
  minimumContrast: number
): Tone {
  const background = getValidToneColor(backgroundColor);
  const start: Tone = {
    color: getValidToneColor(tone && tone.color),
    alpha: clampNumber(tone && tone.alpha, 0, 1)
  };
  if (getTranslucentToneContrast(start, background) >= minimumContrast) {
    return start;
  }
  const target = ink === 'dark' ? TONE_DARK_TARGET : TONE_LIGHT_TARGET;
  // Both the color and its opacity move toward the extreme, so contrast grows
  // monotonically and a binary search finds the gentlest tone that reads.
  const candidateAt = (amount: number): Tone => ({
    color: mixColor(start.color, target, amount),
    alpha: mixNumber(start.alpha, 1, amount)
  });
  let low = 0;
  let high = 1;
  let best: Tone = { color: target, alpha: 1 };
  for (let index = 0; index < 12; index += 1) {
    const amount = (low + high) / 2;
    const candidate = candidateAt(amount);
    if (getTranslucentToneContrast(candidate, background) >= minimumContrast) {
      best = candidate;
      high = amount;
    } else {
      low = amount;
    }
  }
  return best;
}

// Filters repaint the wallpaper, so their luminance stands in for the sampled color.
function getAdaptiveToneBackground(
  luminance: number,
  color: Partial<RgbColor> | null | undefined,
  effectType: string | null | undefined
): RgbColor {
  return effectType && effectType !== 'none'
    ? {
        red: clampNumber(luminance, 0, 1) * 255,
        green: clampNumber(luminance, 0, 1) * 255,
        blue: clampNumber(luminance, 0, 1) * 255
      }
    : getValidToneColor(color);
}

// The luminance thresholds pick an ink family with some hysteresis. On mid
// tones the family they keep may be unable to reach the small-text floor even
// fully opaque; then the other family is used when it reads better, and
// data-wallpaper-ink, hover and shadow styles all follow that choice.
function chooseReadableInk(
  ink: ToneInk,
  luminance: number,
  color: Partial<RgbColor> | null | undefined,
  effectType: string | null | undefined
): ToneInk {
  const background = getAdaptiveToneBackground(luminance, color, effectType);
  const own = getContrastRatio(ink === 'dark' ? TONE_DARK_TARGET : TONE_LIGHT_TARGET, background);
  if (own >= ADAPTIVE_INK_MIN_CONTRAST) {
    return ink;
  }
  const other = getContrastRatio(ink === 'dark' ? TONE_LIGHT_TARGET : TONE_DARK_TARGET, background);
  return other > own ? (ink === 'dark' ? 'light' : 'dark') : ink;
}

// Ink and muted ink for adaptive text, with the contrast floor applied.
function getAdaptiveInkTones(
  luminance: number,
  ink: string,
  color: Partial<RgbColor> | null | undefined,
  effectType: string | null | undefined
) {
  const background = getAdaptiveToneBackground(luminance, color, effectType);
  let inkTone: Tone;
  let mutedTone: Tone;
  let amount: number;
  if (ink === 'dark') {
    amount = clampNumber((luminance - 0.52) / 0.42, 0, 1);
    inkTone = {
      color: { red: mixChannel(78, 15, amount), green: mixChannel(90, 23, amount), blue: mixChannel(106, 42, amount) },
      alpha: mixNumber(72, 88, amount) / 100
    };
    mutedTone = {
      color: { red: mixChannel(100, 30, amount), green: mixChannel(116, 41, amount), blue: mixChannel(139, 59, amount) },
      alpha: mixNumber(52, 66, amount) / 100
    };
  } else {
    amount = clampNumber((0.54 - luminance) / 0.42, 0, 1);
    inkTone = {
      color: { red: mixChannel(226, 253, amount), green: mixChannel(232, 254, amount), blue: mixChannel(240, 255, amount) },
      alpha: mixNumber(78, 92, amount) / 100
    };
    mutedTone = {
      color: { red: mixChannel(203, 248, amount), green: mixChannel(213, 250, amount), blue: mixChannel(225, 252, amount) },
      alpha: mixNumber(58, 76, amount) / 100
    };
  }
  return {
    amount,
    background,
    hoverColor: ink === 'dark' ? inkTone.color : TONE_LIGHT_TARGET,
    ink: ensureTranslucentToneReadable(inkTone, background, ink, ADAPTIVE_INK_MIN_CONTRAST),
    muted: ensureTranslucentToneReadable(mutedTone, background, ink, ADAPTIVE_INK_MUTED_MIN_CONTRAST)
  };
}

function formatToneRgb(tone: Tone): string {
  return formatRgb(tone.color.red, tone.color.green, tone.color.blue, tone.alpha * 100);
}

function applyAdaptiveToneStyles(
  element: HTMLElement | null | undefined,
  luminance: number,
  ink: ToneInk,
  color: RgbColor,
  overlayAlpha: number,
  overlayLuminance: number,
  textureContrast: number,
  effectType: string
): void {
  if (!element || !Number.isFinite(luminance)) {
    return;
  }
  const protection = getToneProtection(luminance, textureContrast, effectType);
  const wordmarkInk = getWordmarkInkColor(
    color,
    luminance,
    ink,
    overlayAlpha,
    overlayLuminance,
    textureContrast,
    effectType
  );
  setStyleProperty(element, '--x-nt-wallpaper-wordmark-ink', formatSolidRgb(wordmarkInk));
  applyWordmarkToneStyles(element, ink, protection, color);
  const tones = getAdaptiveInkTones(luminance, ink, color, effectType);
  const amount = tones.amount;
  const hover = tones.hoverColor;
  setStyleProperty(element, '--x-nt-wallpaper-adaptive-ink', formatToneRgb(tones.ink));
  setStyleProperty(element, '--x-nt-wallpaper-adaptive-ink-muted', formatToneRgb(tones.muted));
  setStyleProperty(element, '--x-nt-wallpaper-adaptive-hover-bg', ink === 'dark'
    ? formatRgb(hover.red, hover.green, hover.blue, mixNumber(7, 12, amount))
    : formatRgb(hover.red, hover.green, hover.blue, mixNumber(10, 18, amount)));
  if (ink === 'dark') {
    setStyleProperty(element, '--x-nt-wallpaper-adaptive-shadow', 'transparent');
    setStyleProperty(element, '--x-nt-wallpaper-adaptive-halo', 'transparent');
    return;
  }
  // Light ink is palest right at the threshold, so the shadow must not fade
  // there; protection keeps mid tones and busy textures at full strength.
  setStyleProperty(element, '--x-nt-wallpaper-adaptive-shadow',
    formatRgb(15, 23, 42, Math.max(mixNumber(26, 42, amount), mixNumber(26, 42, protection))));
  setStyleProperty(element, '--x-nt-wallpaper-adaptive-halo',
    formatRgb(15, 23, 42, Math.max(mixNumber(12, 22, amount), mixNumber(12, 26, protection))));
}

function applySurfaceToneStyles(
  element: HTMLElement,
  luminance: number,
  ink: ToneInk,
  color: RgbColor,
  textureContrast: number,
  effectType: string
): void {
  const sourceColor = getValidToneColor(color);
  const neutralColor = ink === 'dark'
    ? { red: 248, green: 250, blue: 252 }
    : { red: 18, green: 24, blue: 34 };
  const hueStrength = smoothstep((getColorChroma(sourceColor) - 0.025) / 0.25);
  const surfaceColor = mixColor(
    neutralColor,
    sourceColor,
    mixNumber(0.08, 0.18, hueStrength)
  );
  const protection = getToneProtection(luminance, textureContrast, effectType);
  const mistAlpha = mixNumber(ink === 'dark' ? 64 : 62, 74, protection);
  // The clear surface is liquid glass: a light tint, raised only where texture threatens the ink.
  const clearAlpha = mixNumber(ink === 'dark' ? 16 : 22, 38, protection);
  const borderColor = ink === 'dark'
    ? { red: 15, green: 23, blue: 42 }
    : { red: 248, green: 250, blue: 252 };

  setStyleProperty(element, '--x-nt-wallpaper-surface-mist',
    formatRgb(surfaceColor.red, surfaceColor.green, surfaceColor.blue, mistAlpha));
  setStyleProperty(element, '--x-nt-wallpaper-surface-mist-terminal',
    formatRgb(surfaceColor.red, surfaceColor.green, surfaceColor.blue, Math.min(88, mistAlpha + 13)));
  setStyleProperty(element, '--x-nt-wallpaper-surface-clear',
    formatRgb(surfaceColor.red, surfaceColor.green, surfaceColor.blue, clearAlpha));
  setStyleProperty(element, '--x-nt-wallpaper-surface-clear-terminal',
    formatRgb(surfaceColor.red, surfaceColor.green, surfaceColor.blue, Math.min(72, clearAlpha + 14)));
  setStyleProperty(element, '--x-nt-wallpaper-surface-border',
    formatRgb(borderColor.red, borderColor.green, borderColor.blue, ink === 'dark' ? 8 : 13));
}

// Under the light theme, glass over wallpaper darker than this takes light ink. A fresh decision
// uses the threshold itself, so the same wallpaper always opens in the same ink; a re-sample of the
// same wallpaper keeps the ink it has within the band around it, so a plate near it does not flicker.
const GLASS_INK_THRESHOLD = 0.5;
const GLASS_INK_HYSTERESIS = 0.05;

// How a glass plate should read over this patch of wallpaper.
// - ink: under the light theme a plate over a dark patch flips to light text on a thin dark tint,
//   so dark wallpaper stays see-through instead of turning milky. previousInk ('' for a fresh
//   decision) holds it within the hysteresis band. The dark theme always reads light.
// - density (0 thin, 1 dense): how much tint the plate needs for its ink to read. It grows with
//   texture and color, and with how close the patch's brightness is to the ink's own.
// - saturate: how much of the material's saturation boost to keep; a vivid patch keeps less, or
//   the plate turns the wallpaper's own color up to a flat blue or orange.
// groupLuminance, when given, decides the ink for a whole row of plates so neighbors never mix.
// fixedInk pins the ink for surfaces whose controls are styled per theme (the Appearance panel, menus).
function getGlassAdaptation(
  luminance: number,
  textureContrast: number,
  color: Partial<RgbColor> | null | undefined,
  themeMode: string,
  previousInk: string | null,
  groupLuminance?: number | null,
  fixedInk?: string
): GlassAdaptation {
  const lum = clampNumber(Number(luminance) || 0, 0, 1);
  const texture = clampNumber(Number(textureContrast) || 0, 0, 1);
  const chroma = clampNumber(getColorChroma(getValidToneColor(color)), 0, 1);
  const inkLuminance = Number.isFinite(groupLuminance) ? clampNumber(groupLuminance, 0, 1) : lum;
  let ink: ToneInk = 'light';
  if (fixedInk === 'light' || fixedInk === 'dark') {
    ink = fixedInk;
  } else if (themeMode !== 'dark') {
    const band = previousInk === 'light'
      ? GLASS_INK_HYSTERESIS
      : previousInk === 'dark' ? -GLASS_INK_HYSTERESIS : 0;
    ink = inkLuminance < GLASS_INK_THRESHOLD + band ? 'light' : 'dark';
  }
  const nearInk = ink === 'dark'
    ? smoothstep(clampNumber((0.8 - lum) / 0.35, 0, 1))
    : smoothstep(clampNumber((lum - 0.12) / 0.4, 0, 1));
  const density = clampNumber((nearInk * 0.55) + (texture * 0.7) + (chroma * 0.3), 0, 1);
  const saturate = clampNumber(1 - (chroma * 0.75), 0.45, 1);
  return { ink, density, saturate };
}

function applyGlassAdaptationStyles(element: HTMLElement, adaptation: GlassAdaptation): void {
  if (element.getAttribute('data-glass-ink') !== adaptation.ink) {
    element.setAttribute('data-glass-ink', adaptation.ink);
  }
  setStyleProperty(element, '--x-nt-glass-density', adaptation.density.toFixed(3));
  setStyleProperty(element, '--x-nt-glass-saturate', adaptation.saturate.toFixed(3));
}

function clearGlassAdaptationStyles(element: HTMLElement): void {
  element.removeAttribute('data-glass-ink');
  element.removeAttribute('data-glass-ink-theme');
  element.style.removeProperty('--x-nt-glass-density');
  element.style.removeProperty('--x-nt-glass-saturate');
}


function createWallpaperAdaptiveTone<W>(options?: WallpaperAdaptiveToneOptions<W> | null) {
  const config: WallpaperAdaptiveToneOptions<W> = options || {};
  const documentObj = config.documentObj || globalThis.document;
  const windowObj = config.windowObj || globalThis.window;
  const getTargets = config.getTargets || (() => []);
  const getCurrentWallpaper = config.getCurrentWallpaper || (() => null);
  const getWallpaperImageUrl = config.getWallpaperImageUrl || (() => '');
  const getWallpaperSample = config.getWallpaperSample || (() => null);
  const getOverlayAlphaAtViewportY = config.getOverlayAlphaAtViewportY || (() => 0);
  const getOverlayLuminance = config.getOverlayLuminance || (() => 1);
  const getEffectLuminanceAtViewport = config.getEffectLuminanceAtViewport || (() => null);
  const onSamplerReady = config.onSamplerReady || (() => {});
  const getPreloadedImage = config.getPreloadedImage || (() => null);

  let sampler: AdaptiveToneSampler | null = null;
  let pendingImageUrl = '';
  let loadToken = 0;
  let toneFrame = 0;
  let pendingResetInk = false;
  let glassPlates: HTMLElement[] = [];
  let settledWaiters: Array<() => void> = [];

  // Resolves once no wallpaper image is still loading for a sample: the shown wallpaper's tones
  // are on the page, or there is nothing to sample.
  function whenSettled(): Promise<void> {
    if (!pendingImageUrl) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      settledWaiters.push(resolve);
    });
  }

  function notifySettled(): void {
    if (pendingImageUrl || settledWaiters.length === 0) {
      return;
    }
    const waiters = settledWaiters;
    settledWaiters = [];
    waiters.forEach((resolve) => resolve());
  }

  function getDocumentThemeMode(): ThemeMode {
    return documentObj && documentObj.body && documentObj.body.getAttribute('data-theme') === 'dark'
      ? 'dark'
      : 'light';
  }

  function requestFrame(callback: () => void): number {
    if (windowObj && typeof windowObj.requestAnimationFrame === 'function') {
      return windowObj.requestAnimationFrame(callback);
    }
    return globalTimers.setTimeout(callback, 16);
  }

  function cancelFrame(id: number): void {
    if (windowObj && typeof windowObj.cancelAnimationFrame === 'function') {
      windowObj.cancelAnimationFrame(id);
      return;
    }
    globalTimers.clearTimeout(id);
  }

  function getViewportSize(): { width: number; height: number } {
    const docEl = documentObj.documentElement;
    return {
      width: Math.max(1, windowObj.innerWidth || (docEl ? docEl.clientWidth : 0) || 1),
      height: Math.max(1, windowObj.innerHeight || (docEl ? docEl.clientHeight : 0) || 1)
    };
  }

  function getToneTargets(): ReadonlyArray<AdaptiveToneTarget | null | undefined> {
    return getTargets() || [];
  }

  function clearTargetTone(element: HTMLElement | null | undefined): void {
    if (!element) {
      return;
    }
    element.removeAttribute('data-wallpaper-ink');
    element.removeAttribute('data-wallpaper-icon-bg');
    element.removeAttribute('data-wallpaper-overlay-cover');
    element.style.removeProperty('--x-nt-wallpaper-local-luma');
    clearForcedIconBackgroundStyles(element);
    clearAdaptiveToneStyles(element);
    clearGlassAdaptationStyles(element);
  }

  function cancelScheduledApply(): void {
    if (toneFrame) {
      cancelFrame(toneFrame);
      toneFrame = 0;
    }
  }

  function clear(options?: { updateWordmark?: boolean } | null): void {
    cancelScheduledApply();
    getToneTargets().forEach((target) => {
      if (!target || !target.element) {
        return;
      }
      clearTargetTone(target.element);
    });
    if (documentObj.body) {
      documentObj.body.style.removeProperty(PAGE_BASE_COLOR_PROP);
    }
    if (!options || options.updateWordmark !== false) {
      adaptiveToneEvents.emit('applied', null);
    }
  }

  // A target may sample several elements at once; it then reads the box around all of them
  // that lies on screen, so a row scrolled partly out of view centers on what is shown.
  function getTargetSampleBounds(sampleElement: NonNullable<AdaptiveToneTarget['sampleElement']>): ScreenRect | null {
    const elements = (Array.isArray(sampleElement) ? sampleElement : [sampleElement])
      .filter((element): element is SampleSource => Boolean(element) && typeof element?.getBoundingClientRect === 'function');
    const viewport = elements.length > 1 ? getViewportSize() : null;
    const rects = elements
      .map((element) => element.getBoundingClientRect())
      .map((rect): ScreenRect => {
        if (!viewport) {
          return rect;
        }
        const left = Math.max(rect.left, 0);
        const top = Math.max(rect.top, 0);
        const right = Math.min(rect.right, viewport.width);
        const bottom = Math.min(rect.bottom, viewport.height);
        return { left, top, right, bottom, width: right - left, height: bottom - top };
      })
      .filter((rect) => rect.width > 1 && rect.height > 1);
    if (rects.length === 0) {
      return null;
    }
    const left = Math.min(...rects.map((rect) => rect.left));
    const top = Math.min(...rects.map((rect) => rect.top));
    const right = Math.max(...rects.map((rect) => rect.right));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }

  function getSampleRect(rect: ScreenRect, target: AdaptiveToneTarget): SampleRect {
    const viewport = getViewportSize();
    // Glass blurs only what lies under its own plate.
    if (target && target.glass) {
      return rect;
    }
    const minWidth = Math.max(1, Number(target && target.minWidth) || 80);
    const minHeight = Math.max(1, Number(target && target.minHeight) || 40);
    const width = Math.min(viewport.width, Math.max(rect.width + 32, minWidth));
    const height = Math.min(viewport.height, Math.max(rect.height + 28, minHeight));
    const centerX = clampNumber((rect.left + rect.right) / 2, 0, viewport.width);
    const centerY = clampNumber((rect.top + rect.bottom) / 2, 0, viewport.height);
    const maxLeft = Math.max(0, viewport.width - width);
    const maxTop = Math.max(0, viewport.height - height);
    return {
      left: clampNumber(centerX - (width / 2), 0, maxLeft),
      top: clampNumber(centerY - (height / 2), 0, maxTop),
      width,
      height
    };
  }

  // Loads the image that samples url's wallpaper: its small copy at sampleUrl when there is one,
  // falling back to the full image.
  function loadImage(url: string, sampleUrl: string): Promise<HTMLImageElement> {
    const loadFromUrls = () => (sampleUrl && sampleUrl !== url
      ? loadImageFromUrl(sampleUrl).catch(() => loadImageFromUrl(url))
      : loadImageFromUrl(url));
    const preloaded = getPreloadedImage(url);
    if (preloaded && typeof preloaded.then === 'function') {
      return Promise.resolve(preloaded).then((image) => image || loadFromUrls(), loadFromUrls);
    }
    return loadFromUrls();
  }

  function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      // Online wallpapers allow CORS; requesting it keeps the canvas readable for pixel sampling.
      if (/^https?:/i.test(url)) image.crossOrigin = 'anonymous';
      image.onload = () => {
        if (typeof image.decode === 'function') {
          image.decode().then(() => {
            resolve(image);
          }).catch(() => {
            resolve(image);
          });
          return;
        }
        resolve(image);
      };
      image.onerror = () => {
        reject(new Error('Failed to load wallpaper image.'));
      };
      image.src = url;
    });
  }

  // Scales the photo down to the sample size off the main thread; drawing the full image into
  // the sample canvas there took tens of milliseconds while the New Tab was opening.
  function scaleImageForSampling(
    image: HTMLImageElement,
    width: number,
    height: number
  ): Promise<HTMLImageElement | ImageBitmap> {
    if (!windowObj || typeof windowObj.createImageBitmap !== 'function') {
      return Promise.resolve(image);
    }
    return windowObj.createImageBitmap(image, {
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: 'low'
    }).catch(() => image);
  }

  // When image is the wallpaper's small copy, sample's width and height are the full image's: the
  // samples then land where they would on the full image.
  function createSampler(
    image: HTMLImageElement,
    url: string,
    sample: WallpaperSample | null | undefined
  ): Promise<AdaptiveToneSampler | null> {
    const imageWidth = Math.max(1, image.naturalWidth || image.width || 1);
    const imageHeight = Math.max(1, image.naturalHeight || image.height || 1);
    const fullSize = sample && sample.width > 0 && sample.height > 0 &&
      (image.currentSrc || image.src) === sample.url ? sample : null;
    const naturalWidth = fullSize ? fullSize.width : imageWidth;
    const naturalHeight = fullSize ? fullSize.height : imageHeight;
    const sampleScale = Math.min(1, 420 / naturalWidth, 260 / naturalHeight);
    const width = Math.max(1, Math.round(naturalWidth * sampleScale));
    const height = Math.max(1, Math.round(naturalHeight * sampleScale));
    return scaleImageForSampling(image, width, height).then((source) => {
      const sampler = drawSampler(source, url, width, height, naturalWidth, naturalHeight);
      if (source !== image && 'close' in source && typeof source.close === 'function') {
        source.close();
      }
      return sampler;
    });
  }

  function drawSampler(
    source: HTMLImageElement | ImageBitmap,
    url: string,
    width: number,
    height: number,
    naturalWidth: number,
    naturalHeight: number
  ): AdaptiveToneSampler | null {
    const canvas = createCanvas(documentObj, width, height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      return null;
    }
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    let imageData: Uint8ClampedArray | null = null;
    try {
      imageData = context.getImageData(0, 0, canvas.width, canvas.height).data;
    } catch {
      imageData = null;
    }
    return {
      url,
      canvas,
      context,
      imageData,
      naturalWidth,
      naturalHeight,
      sampleScaleX: canvas.width / naturalWidth,
      sampleScaleY: canvas.height / naturalHeight
    };
  }

  function getRenderedMetrics(sourceSampler: AdaptiveToneSampler): { scale: number; offsetX: number; offsetY: number } {
    const viewport = getViewportSize();
    const scale = Math.max(
      viewport.width / sourceSampler.naturalWidth,
      viewport.height / sourceSampler.naturalHeight
    );
    const renderedWidth = sourceSampler.naturalWidth * scale;
    const renderedHeight = sourceSampler.naturalHeight * scale;
    return {
      scale,
      offsetX: (viewport.width - renderedWidth) / 2,
      offsetY: (viewport.height - renderedHeight) / 2
    };
  }

  function applyOverlayToLuminance(luminance: number, alpha: number, overlayLuminance: number): number {
    return (luminance * (1 - alpha)) + (overlayLuminance * alpha);
  }

  function applyOverlayToColor(color: RgbColor, alpha: number, overlayLuminance: number): { color: RgbColor; alpha: number } {
    const overlayColor = overlayLuminance >= 0.5
      ? { red: 255, green: 255, blue: 255 }
      : { red: 0, green: 0, blue: 0 };
    return {
      color: mixColor(color, overlayColor, alpha),
      alpha
    };
  }

  function getPixelColor(sourceSampler: AdaptiveToneSampler, x: number, y: number): RgbColor & { alpha: number } {
    let red = 255;
    let green = 255;
    let blue = 255;
    let alpha = 1;
    if (sourceSampler.imageData) {
      const index = ((y * sourceSampler.canvas.width) + x) * 4;
      red = sourceSampler.imageData[index];
      green = sourceSampler.imageData[index + 1];
      blue = sourceSampler.imageData[index + 2];
      alpha = sourceSampler.imageData[index + 3] / 255;
    } else {
      const pixel = sourceSampler.context.getImageData(x, y, 1, 1).data;
      red = pixel[0];
      green = pixel[1];
      blue = pixel[2];
      alpha = pixel[3] / 255;
    }
    return {
      red: (red * alpha) + (255 * (1 - alpha)),
      green: (green * alpha) + (255 * (1 - alpha)),
      blue: (blue * alpha) + (255 * (1 - alpha)),
      alpha
    };
  }

  function getSamplePixelAtViewport(
    sourceSampler: AdaptiveToneSampler,
    metrics: { scale: number; offsetX: number; offsetY: number },
    viewportX: number,
    viewportY: number
  ): RgbColor & { alpha: number } {
    const sourceX = ((viewportX - metrics.offsetX) / metrics.scale) * sourceSampler.sampleScaleX;
    const sourceY = ((viewportY - metrics.offsetY) / metrics.scale) * sourceSampler.sampleScaleY;
    return getPixelColor(
      sourceSampler,
      Math.round(clampNumber(sourceX, 0, sourceSampler.canvas.width - 1)),
      Math.round(clampNumber(sourceY, 0, sourceSampler.canvas.height - 1))
    );
  }

  // The mean color of the whole screen as shown; null for a see-through wallpaper, whose clear
  // parts show the page color itself.
  function samplePageBaseColor(sourceSampler: AdaptiveToneSampler, overlayLuminance: number, effectType: string): RgbColor | null {
    const viewport = getViewportSize();
    const metrics = getRenderedMetrics(sourceSampler);
    const total = { red: 0, green: 0, blue: 0 };
    for (let row = 0; row < PAGE_BASE_COLOR_ROWS; row += 1) {
      for (let column = 0; column < PAGE_BASE_COLOR_COLUMNS; column += 1) {
        const viewportX = viewport.width * ((column + 0.5) / PAGE_BASE_COLOR_COLUMNS);
        const viewportY = viewport.height * ((row + 0.5) / PAGE_BASE_COLOR_ROWS);
        const sourceColor = getSamplePixelAtViewport(sourceSampler, metrics, viewportX, viewportY);
        if (sourceColor.alpha < 1) {
          return null;
        }
        const effectLuminance = effectType && effectType !== 'none'
          ? getEffectLuminanceAtViewport(viewportX, viewportY, getColorLuminance(sourceColor))
          : null;
        const effectColor = typeof effectLuminance === 'number' && Number.isFinite(effectLuminance)
          ? matchColorLuminance(sourceColor, effectLuminance)
          : sourceColor;
        const overlayAlpha = clampNumber(getOverlayAlphaAtViewportY(viewportY), 0, 1);
        const color = applyOverlayToColor(effectColor, overlayAlpha, overlayLuminance).color;
        total.red += color.red;
        total.green += color.green;
        total.blue += color.blue;
      }
    }
    const count = PAGE_BASE_COLOR_COLUMNS * PAGE_BASE_COLOR_ROWS;
    return {
      red: total.red / count,
      green: total.green / count,
      blue: total.blue / count
    };
  }

  function applyPageBaseColor(sourceSampler: AdaptiveToneSampler, overlayLuminance: number, effectType: string): void {
    let color: RgbColor | null = null;
    try {
      color = samplePageBaseColor(sourceSampler, overlayLuminance, effectType);
    } catch {
      color = null;
    }
    if (color) {
      setStyleProperty(documentObj.body, PAGE_BASE_COLOR_PROP, formatSolidRgb(color));
    } else {
      documentObj.body.style.removeProperty(PAGE_BASE_COLOR_PROP);
    }
  }

  function sampleToneForRect(
    sourceSampler: AdaptiveToneSampler | null,
    rect: SampleRect | null,
    target: AdaptiveToneTarget,
    overlayLuminance: number,
    effectType: string
  ): ToneSample | null {
    if (!sourceSampler || !sourceSampler.canvas || !sourceSampler.context || !rect) {
      return null;
    }
    const metrics = getRenderedMetrics(sourceSampler);
    const isIconButton = Boolean(target && target.iconButton);
    const xs = isIconButton
      ? [0.1, 0.24, 0.38, 0.5, 0.62, 0.76, 0.9]
      : [0.18, 0.34, 0.5, 0.66, 0.82];
    const ys = isIconButton
      ? [0.12, 0.32, 0.5, 0.68, 0.88]
      : [0.24, 0.5, 0.76];
    const values: Array<{ luminance: number; color: RgbColor; overlayAlpha: number }> = [];
    const ignoresOverlay = Boolean(target && target.ignoreOverlay);
    try {
      ys.forEach((yRatio) => {
        xs.forEach((xRatio) => {
          const viewportX = rect.left + (rect.width * xRatio);
          const viewportY = rect.top + (rect.height * yRatio);
          const sourceColor = getSamplePixelAtViewport(sourceSampler, metrics, viewportX, viewportY);
          const sourceLuminance = getColorLuminance(sourceColor);
          const effectLuminance = effectType && effectType !== 'none'
            ? getEffectLuminanceAtViewport(viewportX, viewportY, sourceLuminance)
            : null;
          const resolvedLuminance = typeof effectLuminance === 'number' && Number.isFinite(effectLuminance)
            ? effectLuminance
            : sourceLuminance;
          const overlayAlpha = ignoresOverlay
            ? 0
            : clampNumber(getOverlayAlphaAtViewportY(viewportY), 0, 1);
          const overlayColor = ignoresOverlay
            ? { color: sourceColor, alpha: 0 }
            : applyOverlayToColor(sourceColor, overlayAlpha, overlayLuminance);
          values.push({
            luminance: ignoresOverlay
              ? resolvedLuminance
              : applyOverlayToLuminance(resolvedLuminance, overlayAlpha, overlayLuminance),
            color: overlayColor.color,
            overlayAlpha: overlayColor.alpha
          });
        });
      });
    } catch {
      return null;
    }
    if (values.length === 0) {
      return null;
    }
    values.sort((a, b) => a.luminance - b.luminance);
    const textureContrast = values[values.length - 1].luminance - values[0].luminance;
    const trimCount = values.length >= 10 ? 2 : 0;
    const trimmed = values.slice(trimCount, values.length - trimCount);
    const sourceValues = trimmed.length > 0 ? trimmed : values;
    const sum = sourceValues.reduce((total, value) => {
      total.luminance += value.luminance;
      total.red += value.color.red;
      total.green += value.color.green;
      total.blue += value.color.blue;
      total.overlayAlpha += value.overlayAlpha;
      return total;
    }, {
      luminance: 0,
      red: 0,
      green: 0,
      blue: 0,
      overlayAlpha: 0
    });
    return {
      luminance: sum.luminance / sourceValues.length,
      color: {
        red: sum.red / sourceValues.length,
        green: sum.green / sourceValues.length,
        blue: sum.blue / sourceValues.length
      },
      overlayAlpha: sum.overlayAlpha / sourceValues.length,
      textureContrast
    };
  }

  function chooseInk(luminance: number, currentInk: string | null): ToneInk {
    if (!Number.isFinite(luminance)) {
      return currentInk === 'dark' || currentInk === 'light' ? currentInk : 'light';
    }
    if (currentInk === 'dark') {
      return luminance < 0.5 ? 'light' : 'dark';
    }
    if (currentInk === 'light') {
      return luminance > 0.62 ? 'dark' : 'light';
    }
    return luminance >= 0.56 ? 'dark' : 'light';
  }

  function apply(options?: { resetInk?: boolean } | null): void {
    const config = options || {};
    if (!getCurrentWallpaper() ||
        !sampler ||
        !documentObj.body ||
        documentObj.body.getAttribute('data-wallpaper-active') !== 'true') {
      clear({ updateWordmark: false });
      adaptiveToneEvents.emit('applied', null);
      return;
    }
    const viewport = getViewportSize();
    const effectType = documentObj.body.getAttribute('data-wallpaper-effect') || '';
    const overlayLuminance = clampNumber(getOverlayLuminance(), 0, 1);
    const themeMode = getDocumentThemeMode();
    applyPageBaseColor(sampler, overlayLuminance, effectType);
    const glassSamples: Array<{ target: AdaptiveToneTarget & { element: HTMLElement }; sample: ToneSample }> = [];
    // Targets in one tone group read a single sample over all their elements and
    // keep one ink, so a caption never takes a different color from its heading.
    const toneGroups = new Map<string, { sample: ToneSample | null; ink: ToneInk }>();
    const targets = getToneTargets();
    // A new set of plates (the page still filling in, a card added or removed) is a new layout, so
    // its ink is decided afresh; scrolling and resizing move the same plates and keep theirs.
    const plates = targets.flatMap((target) => (
      target && target.element && target.glass && !target.floating && target.disabled !== true ? [target.element] : []
    ));
    const platesChanged = plates.length !== glassPlates.length ||
      plates.some((element, index) => element !== glassPlates[index]);
    glassPlates = plates;
    targets.forEach((target) => {
      if (!target || !target.element) {
        return;
      }
      // Narrowed here, for the samples below.
      const element = target.element;
      if (target.disabled === true) {
        clearTargetTone(target.element);
        return;
      }
      if (!target.sampleElement) {
        return;
      }
      const rect = getTargetSampleBounds(target.sampleElement);
      if (!rect ||
          rect.width <= 1 ||
          rect.height <= 1 ||
          rect.right <= 0 ||
          rect.left >= viewport.width ||
          rect.bottom <= 0 ||
          rect.top >= viewport.height) {
        clearTargetTone(target.element);
        return;
      }
      const shared = target.toneGroup ? toneGroups.get(target.toneGroup) : null;
      const sample = shared
        ? shared.sample
        : sampleToneForRect(sampler, getSampleRect(rect, target), target, overlayLuminance, effectType);
      const sampled = sample && Number.isFinite(sample.luminance) ? sample : null;
      if (target.glass) {
        if (sampled) {
          glassSamples.push({ target: { ...target, element }, sample: sampled });
        } else {
          clearGlassAdaptationStyles(element);
        }
        return;
      }
      if (!sampled) {
        element.removeAttribute('data-wallpaper-overlay-cover');
        clearForcedIconBackgroundStyles(element);
        clearAdaptiveToneStyles(element);
        return;
      }
      const luminance = sampled.luminance;
      const currentInk = config.resetInk === true
        ? null
        : target.element.getAttribute('data-wallpaper-ink');
      const sampledInk = shared
        ? shared.ink
        : target.surface === 'topbar' && target.preferOverlayPolarity === true
          ? chooseSurfaceInk(
              sampled.overlayAlpha,
              overlayLuminance,
              chooseInk(luminance, currentInk)
            )
          : chooseReadableInk(chooseInk(luminance, currentInk), luminance, sampled.color, effectType);
      // An ink the user fixed (the clock's) is its own; the rest of its group keeps the sampled one.
      const nextInk = target.ink || sampledInk;
      if (target.toneGroup && !shared) {
        toneGroups.set(target.toneGroup, { sample, ink: sampledInk });
      }
      const overlayCovered = isWallpaperOverlayCovered(sampled.overlayAlpha);
      target.element.setAttribute('data-wallpaper-ink', nextInk);
      target.element.setAttribute('data-wallpaper-overlay-cover', overlayCovered ? 'true' : 'false');
      target.element.style.setProperty('--x-nt-wallpaper-local-luma', luminance.toFixed(3));
      applyAdaptiveToneStyles(
        target.element,
        luminance,
        nextInk,
        sampled.color,
        sampled.overlayAlpha,
        overlayLuminance,
        sampled.textureContrast,
        effectType
      );
      if (target.surface === 'topbar') {
        applySurfaceToneStyles(
          target.element,
          luminance,
          nextInk,
          sampled.color,
          sampled.textureContrast,
          effectType
        );
      }
      if (target.iconButton) {
        applyIconSolidBackgroundStyles(
          target.element,
          luminance,
          nextInk,
          sampled.color,
          sampled.overlayAlpha,
          sampled.textureContrast,
          effectType
        );
      } else {
        target.element.removeAttribute('data-wallpaper-icon-bg');
      }
      if (target.forcedIconBackground) {
        applyForcedIconBackgroundStyles(
          target.element,
          luminance,
          nextInk,
          sampled.color,
          target.forcedIconBackground,
          themeMode
        );
      } else {
        clearForcedIconBackgroundStyles(target.element);
      }
    });
    applyGlassSamples(glassSamples, themeMode, config.resetInk === true || platesChanged);
    adaptiveToneEvents.emit('applied', null);
  }

  // The whole page reads in one ink, chosen from the mean brightness under its plates, so no plate
  // or menu stays white beside dark ones; each still sets its own tint density from what lies under
  // it, so a plate over a brighter patch thickens rather than flipping. Floating surfaces (the
  // Appearance panel, menus, dialogs) take the page's ink without weighing in, so opening one never
  // turns the page. resetInk decides afresh instead of holding the last ink.
  function applyGlassSamples(
    entries: ReadonlyArray<{ target: AdaptiveToneTarget & { element: HTMLElement }; sample: ToneSample }>,
    themeMode: ThemeMode,
    resetInk: boolean
  ): void {
    const inkCounts: Record<ToneInk, number> = { light: 0, dark: 0 };
    if (entries.length === 0) {
      return;
    }
    const plates = entries.filter((entry) => !entry.target.floating);
    const weighed = plates.length > 0 ? plates : entries;
    const pageLuminance = weighed.reduce((total, entry) => total + entry.sample.luminance, 0) / weighed.length;
    const previousInk = !resetInk && documentObj.body ? documentObj.body.getAttribute('data-glass-ink-hint') : '';
    // A material held light (newtab.js sets data-glass-theme) keeps dark ink over any wallpaper.
    const heldLight = Boolean(documentObj.body) && documentObj.body.getAttribute('data-glass-theme') === 'light';
    [entries].forEach((members) => {
      const groupLuminance = pageLuminance;
      members.forEach((entry) => {
        const adaptation = getGlassAdaptation(
            entry.sample.luminance,
            entry.sample.textureContrast,
            entry.sample.color,
            themeMode,
            previousInk,
            groupLuminance,
            entry.target.themeInk || heldLight ? (themeMode === 'dark' ? 'light' : 'dark') : ''
        );
        applyGlassAdaptationStyles(entry.target.element, adaptation);
        // Panels and menus carry controls styled per theme; flipped to light ink under the light
        // theme they take the dark theme's palette (glass-style.css scopes it to this attribute).
        if (entry.target.paletteSwap) {
          if (themeMode !== 'dark' && adaptation.ink === 'light') {
            entry.target.element.setAttribute('data-glass-ink-theme', 'dark');
          } else {
            entry.target.element.removeAttribute('data-glass-ink-theme');
          }
        } else if (!entry.target.themeInk) {
          inkCounts[adaptation.ink] += 1;
        }
      });
    });
    // Only the light theme's sampled ink is worth remembering: a held material or the dark theme
    // would leave the next light page opening in an ink it did not choose.
    if (!heldLight && themeMode !== 'dark') {
      rememberGlassInkHint(inkCounts);
    }
  }

  // The ink most plates settled on, for the next page to open in (newtab.js reads it back).
  function rememberGlassInkHint(inkCounts: Record<ToneInk, number>): void {
    if (!documentObj.body || inkCounts.light + inkCounts.dark === 0) {
      return;
    }
    const hint = inkCounts.light > inkCounts.dark ? 'light' : 'dark';
    if (documentObj.body.getAttribute('data-glass-ink-hint') !== hint) {
      documentObj.body.setAttribute('data-glass-ink-hint', hint);
    }
    try {
      if (windowObj.localStorage.getItem(newtabGlassInkHint.key) !== hint) {
        windowObj.localStorage.setItem(newtabGlassInkHint.key, hint);
      }
    } catch {
      // localStorage is only a head start; the sample corrects the ink either way.
    }
  }

  // { resetInk: true } when a setting changed what the ink should be (the theme, the material or
  // its theme): the next sample decides afresh, as a newly opened page would. Other callers pass
  // nothing (or an event) and the page keeps its ink within the hysteresis band.
  function schedule(options?: ToneScheduleOptions | Event | null): void {
    if (!getCurrentWallpaper() || !sampler || pendingImageUrl) {
      return;
    }
    if (options && 'resetInk' in options && options.resetInk === true) {
      pendingResetInk = true;
    }
    if (toneFrame) {
      return;
    }
    toneFrame = requestFrame(() => {
      toneFrame = requestFrame(() => {
        toneFrame = 0;
        const resetInk = pendingResetInk;
        pendingResetInk = false;
        apply({ resetInk });
      });
    });
  }

  function refresh(): void {
    const wallpaper = getCurrentWallpaper();
    const imageUrl = wallpaper ? getWallpaperImageUrl(wallpaper) : '';
    if (!wallpaper || !imageUrl) {
      loadToken += 1;
      pendingImageUrl = '';
      sampler = null;
      clear();
      notifySettled();
      return;
    }
    if (sampler && sampler.url === imageUrl) {
      if (pendingImageUrl) {
        loadToken += 1;
        pendingImageUrl = '';
        notifySettled();
      }
      schedule();
      return;
    }
    if (pendingImageUrl === imageUrl) {
      return;
    }
    const token = ++loadToken;
    pendingImageUrl = imageUrl;
    cancelScheduledApply();
    const sample = getWallpaperSample(wallpaper);
    loadImage(imageUrl, sample && sample.url ? sample.url : '').then((image) => (
      token === loadToken ? createSampler(image, imageUrl, sample) : null
    )).then((nextSampler) => {
      if (token !== loadToken) {
        return;
      }
      pendingImageUrl = '';
      sampler = nextSampler;
      apply({ resetInk: true });
      schedule();
      if (sampler) {
        onSamplerReady(sampler);
      }
      notifySettled();
    }).catch(() => {
      if (token !== loadToken) {
        return;
      }
      pendingImageUrl = '';
      sampler = null;
      clear();
      notifySettled();
    });
  }

  return {
    clear,
    refresh,
    schedule,
    whenSettled
  };
}

type WallpaperAdaptiveTone = ReturnType<typeof createWallpaperAdaptiveTone>;

export {
  createWallpaperAdaptiveTone,
  getGlassAdaptation,
  chooseReadableInk,
  getAdaptiveInkTones,
  getWordmarkInkColor,
  getContrastRatio,
  getTranslucentToneContrast
};
export type {
  AdaptiveToneSampler,
  AdaptiveToneTarget,
  GlassAdaptation,
  RgbColor,
  ToneInk,
  ToneScheduleOptions,
  WallpaperAdaptiveTone,
  WallpaperAdaptiveToneOptions
};
