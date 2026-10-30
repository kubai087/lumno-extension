import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FOLDER_PATH_MORPH_DURATION_MS,
  applyFolderColor,
  getFolderMorphParts,
  getFolderMorphState,
  initFolderPathMorph,
  playFolderPathMorph,
  setFolderPathMorphState
} from './folder-icon';
import { describeFolderIcon } from '../bookmarks/bookmark-folder-icon';
import { createSvgElement } from '../../shared/ui/svg-tree';
import { expectSvg, required } from '../../../tests/fakes/dom';

function drawIcon(suffix: string, folderId?: string): HTMLElement {
  const icon = document.createElement('span');
  icon.appendChild(createSvgElement(document, describeFolderIcon(suffix, folderId)));
  document.body.appendChild(icon);
  initFolderPathMorph(icon);
  return icon;
}

const upperStops = (icon: Element) =>
  Array.from(icon.querySelectorAll('[data-folder-gradient-morph="upper-main"] stop'), (stop) => stop.getAttribute('stop-color'));

const upperBody = (icon: Element) => required(getFolderMorphParts(icon).find((part) => part.partName === 'upper-body'), 'the upper body');

describe('folder icon motion', () => {
  it('morphs in 460ms', () => {
    expect(FOLDER_PATH_MORPH_DURATION_MS).toBe(460);
  });

  it('opens and closes its shapes', () => {
    const icon = drawIcon('folder one');
    expect(getFolderMorphParts(icon).length).toBeGreaterThanOrEqual(6);
    expect(getFolderMorphState(icon)).toBe('base');
    playFolderPathMorph(icon, true, { instant: true });
    expect(getFolderMorphState(icon)).toBe('hover');
    const body = upperBody(icon);
    expect(body.pathEl.getAttribute('d')).toBe(body.hoverD);
    setFolderPathMorphState(icon, false);
    expect(getFolderMorphState(icon)).toBe('base');
    expect(body.pathEl.getAttribute('d')).toBe(body.baseD);
  });

  it('recolors every part, keeping its animated paths and its open shape', () => {
    const icon = drawIcon('folder one');
    const body = upperBody(icon);
    const originalPath = body.pathEl;
    applyFolderColor(icon, '#EF4444');
    expect(expectSvg(icon.querySelector('svg'), 'svg').getAttribute('data-folder-color')).toBe('#EF4444');
    expect(expectSvg(icon.querySelector('[data-folder-part="upper-outline"]'), 'the upper outline').getAttribute('stroke')).toBe('#EF4444');
    const closedStops = upperStops(icon);
    expect(closedStops.every((color) => color !== '#CCDFFF')).toBe(true);
    playFolderPathMorph(icon, true, { instant: true });
    expect(upperBody(icon).pathEl).toBe(originalPath);
    expect(upperStops(icon)).not.toEqual(closedStops);
    applyFolderColor(icon, '#22C55E');
    expect(getFolderMorphState(icon)).toBe('hover');
  });

  it('restores the original blue palette exactly when the color is reset', () => {
    const icon = drawIcon('folder one');
    applyFolderColor(icon, '#22C55E');
    applyFolderColor(icon, null);
    expect(upperStops(icon)).toEqual(['#CCDFFF', '#B2CEFF', '#89B5FF', '#97BEFF']);
  });

  it('animates the current drawing of a folder drawn again', () => {
    const icon = drawIcon('folder one');
    icon.replaceChildren(createSvgElement(document, describeFolderIcon('after-reorder', '123')));
    initFolderPathMorph(icon);
    applyFolderColor(icon, '#EF4444');
    playFolderPathMorph(icon, true, { instant: true });
    expect(upperBody(icon).pathEl).toBe(icon.querySelector('[data-folder-part="upper-body"]'));
    expect(expectSvg(icon.querySelector('svg'), 'svg').getAttribute('data-folder-color-id')).toBe('123');
  });
});

describe('folder icon shape sampling', () => {
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(SVGElement.prototype, 'getTotalLength');
    Reflect.deleteProperty(SVGElement.prototype, 'getPointAtLength');
  });

  // Hovering a folder must not sample its shapes again: every icon draws the
  // same ones, and turning back mid-morph starts from the points on screen.
  it('samples the shapes once for every icon and ends a morph back on the original shapes', async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const fresh = await import('./folder-icon');
    let samples = 0;
    // jsdom has no path geometry; a closed square is enough to sample.
    Object.defineProperty(SVGElement.prototype, 'getTotalLength', { configurable: true, value: () => 4 });
    Object.defineProperty(SVGElement.prototype, 'getPointAtLength', {
      configurable: true,
      value: (length: number) => {
        samples += 1;
        const t = Number(length) % 4;
        if (t < 1) return { x: t, y: 0 };
        if (t < 2) return { x: 1, y: t - 1 };
        return t < 3 ? { x: 3 - t, y: 1 } : { x: 0, y: 4 - t };
      }
    });
    const makeIcon = (suffix: string) => {
      const icon = document.createElement('span');
      icon.appendChild(createSvgElement(document, describeFolderIcon(suffix)));
      document.body.appendChild(icon);
      fresh.initFolderPathMorph(icon);
      return icon;
    };
    const frames = (ms: number) => vi.advanceTimersByTime(ms);

    const first = makeIcon('a');
    fresh.playFolderPathMorph(first, true);
    const firstSamples = samples;
    expect(firstSamples).toBeGreaterThan(0);
    frames(32);
    fresh.playFolderPathMorph(first, false);
    frames(16);
    expect(samples).toBe(firstSamples);
    frames(1000);

    const second = makeIcon('b');
    fresh.playFolderPathMorph(second, true);
    frames(1000);
    fresh.playFolderPathMorph(second, false);
    frames(1000);
    expect(samples).toBe(firstSamples);
    const settled = Array.from(second.querySelectorAll('[data-folder-part]'), (part) => part.getAttribute('d'));
    const untouched = makeIcon('c');
    expect(settled).toEqual(Array.from(untouched.querySelectorAll('[data-folder-part]'), (part) => part.getAttribute('d')));
  });
});
