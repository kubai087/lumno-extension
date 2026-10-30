import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createPageThemeObserver,
  detectPageTheme,
  detectPageVisualTheme,
  getCssColorThemeSignal,
  getThemeClassTokenTheme,
  resolveOverlayTheme,
  resolvePageThemeSignals,
  shouldStrengthenDarkOverlayBackground,
  syncPageThemeObservation
} from './page-theme';
import { parseCssColor } from '../../domain/color';
import { required } from '../../../tests/fakes/dom';

// How the overlay reads the theme of the page it opens on: colors sampled
// across the viewport, weighed with the page's own hints.

// JSDOM has no layout: every point sampled lands where `at` says.
function sampleAt(at: (call: number) => Element | null): void {
  let call = 0;
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: () => {
      call += 1;
      return at(call);
    }
  });
}

function surface(backgroundColor: string, color: string, id = ''): HTMLElement {
  const element = document.body.appendChild(document.createElement('div'));
  element.id = id;
  element.style.backgroundColor = backgroundColor;
  element.style.color = color;
  return element;
}

interface PageOptions {
  htmlAttributes?: Record<string, string>;
  // The page's <meta> tags, by name.
  meta?: Record<string, string>;
  bodyBackground?: string;
  bodyClass?: string;
  sample?: { backgroundColor: string; color: string };
}

function setPage(options: PageOptions): void {
  Object.entries(options.htmlAttributes || {}).forEach(([name, value]) => document.documentElement.setAttribute(name, value));
  Object.entries(options.meta || {}).forEach(([name, content]) => {
    const meta = document.head.appendChild(document.createElement('meta'));
    meta.name = name;
    meta.content = content;
  });
  if (options.bodyBackground) {
    document.body.style.backgroundColor = options.bodyBackground;
  }
  if (options.bodyClass) {
    document.body.className = options.bodyClass;
  }
  if (options.sample) {
    const sample = surface(options.sample.backgroundColor, options.sample.color);
    sampleAt(() => sample);
  }
}

const detectTheme = () => detectPageTheme({ document, window, parseThemeColorRgb: parseCssColor });

afterEach(() => {
  Reflect.deleteProperty(document, 'elementFromPoint');
  document.head.querySelectorAll('meta').forEach((meta) => meta.remove());
  [document.documentElement, document.body].forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => element.removeAttribute(attribute.name));
  });
  vi.useRealTimers();
});

describe('Page visual theme', () => {
  it('reads visible dark surfaces over a light root behind a transparent body', () => {
    document.documentElement.style.backgroundColor = 'rgb(250, 250, 250)';
    const dark = surface('rgb(18, 18, 18)', 'rgb(238, 238, 238)');
    sampleAt(() => dark);
    expect(detectPageVisualTheme({ document, window })).toBe('dark');
  });

  it('calls no theme for mid-tone surfaces', () => {
    const middle = surface('rgb(128, 128, 128)', 'rgb(96, 96, 96)');
    sampleAt(() => middle);
    expect(detectPageVisualTheme({ document, window })).toBeNull();
  });

  it('reads light text on a transparent surface as a dark interface', () => {
    const transparent = surface('rgba(0, 0, 0, 0)', 'rgb(245, 245, 245)');
    sampleAt(() => transparent);
    expect(detectPageVisualTheme({ document, window })).toBe('dark');
  });

  it('skips the overlay\'s own elements, so it never reinforces its own theme', () => {
    const panel = surface('rgb(20, 20, 20)', 'rgb(238, 238, 238)', '_x_extension_overlay_2024_unique_');
    const light = surface('rgb(255, 255, 255)', 'rgb(17, 24, 39)');
    sampleAt((call) => (call <= 2 ? panel : light));
    expect(detectPageVisualTheme({ document, window })).toBe('light');
  });

  it('samples the whole footprint of the overlay, not a few points', () => {
    document.body.style.backgroundColor = 'rgb(18, 18, 18)';
    const dark = surface('rgb(18, 18, 18)', 'rgb(238, 238, 238)');
    const elementFromPoint = vi.fn(() => dark);
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: elementFromPoint });
    expect(detectPageVisualTheme({ document, window })).toBe('dark');
    expect(elementFromPoint.mock.calls.length).toBeGreaterThanOrEqual(24);
  });
});

describe('Page theme signals', () => {
  it('reads a transparent color as no signal, and a faint black over the canvas as light', () => {
    expect(getCssColorThemeSignal('rgba(0, 0, 0, 0)', 0.78)).toBeNull();
    expect(getCssColorThemeSignal('rgba(0, 0, 0, 0.1)', 0.78)?.theme).toBe('light');
  });

  // As on wappalyzer.com: explicit light hints and a mostly light viewport
  // beat a dark brand theme-color.
  it('resolves a light page with a dark brand color as light', () => {
    expect(resolvePageThemeSignals([
      { theme: 'light', confidence: 0.74, weight: 0.48 },
      { theme: 'light', confidence: 0.62, weight: 0.26 },
      getCssColorThemeSignal('#4608ad', 0.72),
      getCssColorThemeSignal('rgba(0, 0, 0, 0)', 0.78),
      getCssColorThemeSignal('rgba(0, 0, 0, 0)', 0.58),
      { theme: 'light', confidence: 0.62, weight: 1.05 }
    ])).toBe('light');
  });
});

describe('Page theme', () => {
  it('does not let a dark brand theme-color override a visibly light page', () => {
    setPage({
      meta: { 'theme-color': '#1a0b3d' },
      bodyBackground: 'rgb(255, 255, 255)',
      sample: { backgroundColor: 'rgb(255, 255, 255)', color: 'rgb(17, 24, 39)' }
    });
    expect(detectTheme()).toBe('light');
  });

  it('counts the theme-color when nothing else speaks', () => {
    setPage({ meta: { 'theme-color': '#111111' } });
    expect(detectTheme()).toBe('dark');
  });

  it('takes no signal from a theme-color it cannot read', () => {
    setPage({ meta: { 'theme-color': 'transparent' } });
    expect(detectTheme()).toBeNull();
  });

  it('weighs an explicit dark class against a visibly light page instead of obeying it', () => {
    setPage({
      htmlAttributes: { class: 'dark' },
      bodyBackground: 'rgb(255, 255, 255)',
      sample: { backgroundColor: 'rgb(255, 255, 255)', color: 'rgb(17, 24, 39)' }
    });
    expect(detectTheme()).toBe('light');
  });

  it('follows an explicit theme attribute nothing contradicts', () => {
    setPage({ htmlAttributes: { 'data-theme': 'dark' } });
    expect(detectTheme()).toBe('dark');
  });

  it('reads a dark color-scheme meta as a signal', () => {
    setPage({ meta: { 'color-scheme': 'dark' } });
    expect(detectTheme()).toBe('dark');
  });

  it('does not let a light color-scheme hint override a visibly dark page', () => {
    setPage({
      meta: { 'color-scheme': 'light' },
      bodyBackground: 'rgb(18, 18, 18)',
      sample: { backgroundColor: 'rgb(18, 18, 18)', color: 'rgb(240, 240, 240)' }
    });
    expect(detectTheme()).toBe('dark');
  });

  it('reads theme class names, and not class names that only mention light or dark', () => {
    expect(getThemeClassTokenTheme('light-rays')).toBeNull();
    expect(getThemeClassTokenTheme('dark-veil')).toBeNull();
    expect(getThemeClassTokenTheme('theme-dark')).toBe('dark');
    expect(getThemeClassTokenTheme('light-mode')).toBe('light');
    expect(getThemeClassTokenTheme('night')).toBe('dark');
    document.body.appendChild(document.createElement('div')).className = 'light-rays dark-veil';
    setPage({ bodyClass: 'dark-veil' });
    expect(detectTheme()).toBeNull();
  });
});

describe('Page theme observer', () => {
  it('syncs once when started, without claiming the page changed', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const frame = vi.spyOn(window, 'requestAnimationFrame');
    const observer = createPageThemeObserver(window, onChange);
    observer.start();
    observer.start();
    expect(observer.active).toBe(true);
    expect(frame).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(20);
    expect(onChange.mock.calls).toEqual([[{ pageChanged: false }]]);
    observer.stop();
    expect(observer.active).toBe(false);
  });

  it('collapses a burst of theme attribute changes into one sync, and ignores other attributes', async () => {
    vi.useFakeTimers();
    const changes: unknown[] = [];
    const observer = createPageThemeObserver(window, (change) => changes.push(change));
    observer.start();
    vi.advanceTimersByTime(20);
    const afterStart = changes.length;
    const nextFrame = async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(20);
    };

    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.setAttribute('data-color-mode', 'dark');
    await nextFrame();
    expect(changes).toHaveLength(afterStart + 1);
    expect(required(changes.at(-1), 'the sync')).toEqual({ pageChanged: true });

    document.documentElement.setAttribute('aria-label', 'unrelated');
    await nextFrame();
    expect(changes).toHaveLength(afterStart + 1);

    observer.stop();
    document.documentElement.setAttribute('data-theme', 'light');
    await nextFrame();
    expect(changes).toHaveLength(afterStart + 1);
  });
});

describe('Overlay theme policy', () => {
  it.each([
    [{ mode: 'system', pageTheme: 'light', systemTheme: 'dark' }, 'light'],
    [{ mode: 'system', pageTheme: 'light', systemTheme: 'dark', pageThemeAdaptationEnabled: false }, 'dark'],
    [{ mode: 'system', pageTheme: 'dark', systemTheme: 'light', pageThemeAdaptationEnabled: false }, 'light'],
    [{ mode: 'light', pageTheme: 'dark', systemTheme: 'dark', pageThemeAdaptationEnabled: false }, 'light'],
    [{ mode: 'dark', pageTheme: 'light', systemTheme: 'light', pageThemeAdaptationEnabled: false }, 'dark']
  ])('resolves %o to %s', (options, theme) => {
    expect(resolveOverlayTheme(options)).toBe(theme);
  });

  it.each([
    [{ resolvedTheme: 'dark', pageTheme: 'light' }, true],
    [{ resolvedTheme: 'dark', pageTheme: 'dark' }, false],
    [{ resolvedTheme: 'dark', pageTheme: null }, false],
    [{ resolvedTheme: 'light', pageTheme: 'dark' }, false]
  ])('strengthens the dark panel background for %o: %s', (options, strengthen) => {
    expect(shouldStrengthenDarkOverlayBackground(options)).toBe(strengthen);
  });

  it.each([
    [{ mode: 'dark', pageThemeAdaptationEnabled: false, systemTheme: 'light' }, true],
    [{ mode: 'light', pageThemeAdaptationEnabled: true, systemTheme: 'dark' }, false],
    [{ mode: 'system', pageThemeAdaptationEnabled: true, systemTheme: 'light' }, true],
    [{ mode: 'system', pageThemeAdaptationEnabled: false, systemTheme: 'dark' }, true],
    [{ mode: 'system', pageThemeAdaptationEnabled: false, systemTheme: 'light' }, false]
  ])('watches the page for %o: %s', (options, watches) => {
    const events: string[] = [];
    expect(syncPageThemeObservation({ ...options, start: () => events.push('start'), stop: () => events.push('stop') })).toBe(watches);
    expect(events).toEqual([watches ? 'start' : 'stop']);
  });
});
