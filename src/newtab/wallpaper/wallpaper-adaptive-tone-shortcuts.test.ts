import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWallpaperAdaptiveTone } from './wallpaper-adaptive-tone';
import { installCanvasFake, installImageFake, type ImageFake } from '../../../tests/fakes/canvas';

// The shortcut tiles on a wallpaper: a tile tinted from its favicon keeps its
// own background, while the add tile and the fallback surface of icons that
// could not load follow the wallpaper and the theme, and stay readable.

interface Pixel {
  red: number;
  green: number;
  blue: number;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

// The color every pixel of the shown wallpaper has.
let wallpaperPixel: Pixel = { red: 128, green: 128, blue: 128 };
let images: ImageFake;

function readPixels(width: number, height: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(Math.max(1, width * height) * 4);
  for (let index = 0; index < data.length; index += 4) {
    data.set([wallpaperPixel.red, wallpaperPixel.green, wallpaperPixel.blue, 255], index);
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

function parseSolidRgb(value: string): Pixel {
  const match = /^rgb\((\d+) (\d+) (\d+)\)$/.exec(value);
  if (!match) {
    throw new Error(`Expected a solid rgb() color, got ${value}`);
  }
  return { red: Number(match[1]), green: Number(match[2]), blue: Number(match[3]) };
}

function luminance(color: Pixel): number {
  return ((color.red * 0.299) + (color.green * 0.587) + (color.blue * 0.114)) / 255;
}

function relativeLuminance(color: Pixel): number {
  const linearize = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return (0.2126 * linearize(color.red)) + (0.7152 * linearize(color.green)) + (0.0722 * linearize(color.blue));
}

function contrast(first: Pixel, second: Pixel): number {
  const [light, dark] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

const prop = (element: HTMLElement, name: string) => element.style.getPropertyValue(name);

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal('innerWidth', 1000);
  vi.stubGlobal('innerHeight', 600);
  installCanvasFake({ readPixels });
  images = installImageFake({ outcome: () => 'pending' });
  document.body.setAttribute('data-wallpaper-active', 'true');
});

afterEach(() => {
  Array.from(document.body.attributes).forEach((attribute) => document.body.removeAttribute(attribute.name));
  vi.unstubAllGlobals();
});

// The wordmark, a tile tinted from its favicon, the add tile and a target
// that is switched off, toned over a wallpaper of one color.
async function toneOver(pixel: Pixel, tileBackground: string, overlayLuminance: number) {
  wallpaperPixel = pixel;
  const wordmark = placed({ left: 390, top: 54, width: 220, height: 72 });
  const tile = placed();
  const addTile = placed();
  const disabled = placed();
  tile.setAttribute('data-shortcut-theme-default', 'true');
  tile.style.setProperty('--x-nt-shortcut-icon-bg', tileBackground);
  disabled.setAttribute('data-wallpaper-ink', 'light');
  disabled.setAttribute('data-wallpaper-icon-bg', 'true');
  disabled.style.setProperty('--x-nt-wallpaper-icon-solid-bg', 'rgb(20 28 45)');
  const runtime = createWallpaperAdaptiveTone({
    getTargets: () => [
      { element: wordmark, sampleElement: wordmark, minWidth: 220, minHeight: 72 },
      { element: tile, sampleElement: tile, minWidth: 42, minHeight: 42, iconButton: true, forcedIconBackground: 'shortcut-fallback' },
      { element: addTile, sampleElement: addTile, minWidth: 42, minHeight: 42, iconButton: true, forcedIconBackground: 'shortcut-add' },
      { element: disabled, sampleElement: disabled, minWidth: 42, minHeight: 42, iconButton: true, disabled: true }
    ],
    getCurrentWallpaper: () => ({ id: 'test-wallpaper' }),
    getWallpaperImageUrl: () => 'test://wallpaper',
    getOverlayAlphaAtViewportY: () => 0,
    getOverlayLuminance: () => overlayLuminance,
    getEffectLuminanceAtViewport: () => null
  });
  runtime.refresh();
  images.pending('test://wallpaper').load();
  await new Promise((resolve) => setTimeout(resolve, 5));
  return { runtime, wordmark, tile, addTile, disabled };
}

describe('shortcut tiles on a wallpaper', () => {
  it('keep a favicon\'s light background on a dark wallpaper, with a dark add tile and fallback surface', async () => {
    const pixel = { red: 17, green: 85, blue: 101 };
    const { runtime, wordmark, tile, addTile, disabled } = await toneOver(pixel, 'rgb(220 233 253)', 0);

    // A switched-off target loses its wallpaper tones.
    expect(disabled.getAttribute('data-wallpaper-ink')).toBeNull();
    expect(disabled.getAttribute('data-wallpaper-icon-bg')).toBeNull();
    expect(prop(disabled, '--x-nt-wallpaper-icon-solid-bg')).toBe('');
    // The wordmark stays readable on a similarly colored background.
    expect(contrast(parseSolidRgb(prop(wordmark, '--x-nt-wallpaper-wordmark-ink')), pixel)).toBeGreaterThanOrEqual(3.25);
    expect(prop(tile, '--x-nt-shortcut-wallpaper-icon-bg')).toBe('');
    expect(prop(tile, '--x-nt-shortcut-icon-bg')).toBe('rgb(220 233 253)');
    expect(luminance(parseSolidRgb(prop(addTile, '--x-nt-shortcut-add-bg')))).toBeLessThan(0.42);
    expect(luminance(parseSolidRgb(prop(addTile, '--x-nt-shortcut-add-color')))).toBeGreaterThan(0.72);
    const fallbackBackground = parseSolidRgb(prop(tile, '--x-nt-shortcut-fallback-icon-bg'));
    expect(luminance(fallbackBackground)).toBeLessThan(0.42);
    expect(contrast(fallbackBackground, parseSolidRgb(prop(tile, '--x-nt-shortcut-fallback-icon-color')))).toBeGreaterThanOrEqual(4.5);

    // Removing the wallpaper restores the static fallback surface.
    runtime.clear();
    expect(prop(tile, '--x-nt-shortcut-fallback-icon-bg')).toBe('');
  });

  it('keep a favicon\'s dark background on a light wallpaper in the dark theme, with dark add and fallback surfaces', async () => {
    document.body.setAttribute('data-theme', 'dark');
    const pixel = { red: 238, green: 242, blue: 247 };
    const { runtime, wordmark, tile, addTile } = await toneOver(pixel, 'rgb(33 52 85)', 1);

    expect(contrast(parseSolidRgb(prop(wordmark, '--x-nt-wallpaper-wordmark-ink')), pixel)).toBeGreaterThanOrEqual(3.25);
    expect(prop(tile, '--x-nt-shortcut-wallpaper-icon-bg')).toBe('');
    expect(prop(tile, '--x-nt-shortcut-icon-bg')).toBe('rgb(33 52 85)');
    expect(luminance(parseSolidRgb(prop(addTile, '--x-nt-shortcut-add-bg')))).toBeLessThan(0.42);
    expect(luminance(parseSolidRgb(prop(addTile, '--x-nt-shortcut-add-color')))).toBeGreaterThan(0.72);
    const fallbackBackground = parseSolidRgb(prop(tile, '--x-nt-shortcut-fallback-icon-bg'));
    expect(luminance(fallbackBackground)).toBeLessThan(0.42);
    expect(contrast(fallbackBackground, parseSolidRgb(prop(tile, '--x-nt-shortcut-fallback-icon-color')))).toBeGreaterThanOrEqual(4.5);

    // Clearing the wallpaper restores the theme's own fallback foreground.
    runtime.clear();
    expect(prop(tile, '--x-nt-shortcut-fallback-icon-color')).toBe('');
  });
});
