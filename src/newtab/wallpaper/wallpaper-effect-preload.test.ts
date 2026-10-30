import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WallpaperEffectPrefs, WallpaperEffects, WallpaperEffectsOptions } from '../dom/wallpaper-effects';
import { normalizePrefs } from '../dom/wallpaper-effects';
import { publishBootValue, readBootValue } from '../../platform/boot-handoff';
import { required } from '../../../tests/fakes/dom';

const effects = vi.hoisted(() => ({
  create: vi.fn<(options?: WallpaperEffectsOptions<unknown> | null) => WallpaperEffects>()
}));

vi.mock('../dom/wallpaper-effects', async (importOriginal) => ({
  ...await importOriginal<typeof import('../dom/wallpaper-effects')>(),
  createWallpaperEffects: effects.create
}));

// The effect layer the preload starts, recording what it is asked to draw.
function recordingController() {
  const applied: unknown[] = [];
  let refreshes = 0;
  const controller: WallpaperEffects = {
    apply(prefs) {
      applied.push(prefs);
      return Promise.resolve();
    },
    refresh() {
      refreshes += 1;
      return Promise.resolve();
    },
    destroy() {},
    getLuminanceAtViewport: () => null,
    isSourceStale: () => false,
    normalizePrefs
  };
  effects.create.mockImplementation(() => controller);
  return { applied, refreshes: () => refreshes };
}

interface PreloadSeed {
  prefs: Partial<WallpaperEffectPrefs>;
  imageUrl?: string;
  imageReady?: Promise<string>;
}

async function runEffectPreload({ prefs, imageUrl = '', imageReady }: PreloadSeed) {
  publishBootValue('wallpaperPreload', {
    effectPrefsReady: Promise.resolve(normalizePrefs(prefs)),
    initialImageUrl: imageUrl,
    luminance: null,
    mode: 'light',
    imageUrl,
    imageReady,
    sample: null,
    decodedImage: null,
    wallpaper: { id: 'test-wallpaper' }
  });
  vi.resetModules();
  await import('./wallpaper-effect-preload');
  return required(readBootValue('wallpaperEffectPreload'), 'the effect preload');
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  effects.create.mockReset();
});

afterEach(() => {
  Array.from(document.body.attributes).forEach((attribute) => document.body.removeAttribute(attribute.name));
  document.documentElement.removeAttribute('data-nt-focus-route');
  Reflect.deleteProperty(globalThis, '__lumnoBoot');
});

describe('the wallpaper effect preload', () => {
  it.each([true, false])('draws the cached effect before the page\'s scripts run (focus route: %s)', async (focusRoute) => {
    if (focusRoute) document.documentElement.setAttribute('data-nt-focus-route', 'true');
    const controller = recordingController();
    const preload = await runEffectPreload({
      prefs: { type: 'grain', strength: 50, size: 50, spacing: 50 },
      imageUrl: 'chrome-extension://abc/assets/wallpapers/test.webp'
    });
    await settle();
    expect(controller.applied).toHaveLength(1);
    expect(document.body.getAttribute('data-wallpaper-effect')).toBe('grain');
    expect(document.body.getAttribute('data-nt-wallpaper-ready')).toBe('1');
    // wallpaper.ts adopts the preload's controller.
    expect(typeof required(preload.controller).refresh).toBe('function');
  });

  it('starts its controller before the image is read, and never replaces what wallpaper.ts applied', async () => {
    const controller = recordingController();
    let resolveImage: (url: string) => void = () => {};
    const preload = await runEffectPreload({
      prefs: { type: 'grain', strength: 50, size: 50, spacing: 50 },
      imageReady: new Promise((resolve) => { resolveImage = resolve; })
    });
    // The controller exists before the image does, so wallpaper.ts never starts its own.
    void required(preload.controller).apply({ type: 'dither' });
    resolveImage('data:image/webp;base64,AAAA');
    await settle();
    expect(controller.applied).toEqual([{ type: 'dither' }]);
    expect(controller.refreshes()).toBe(0);
    // Once wallpaper.ts owns the effect it also decides when the wallpaper is ready.
    expect(document.body.getAttribute('data-nt-wallpaper-ready')).toBeNull();
  });

  it('records when it revealed the wallpaper, which the entry measures its lead from', async () => {
    recordingController();
    const before = performance.now();
    const preload = await runEffectPreload({ prefs: { type: 'none' }, imageUrl: 'chrome-extension://abc/assets/wallpapers/test.webp' });
    await settle();
    expect(document.body.getAttribute('data-nt-wallpaper-ready')).toBe('1');
    expect(preload.wallpaperShownAt).toBeGreaterThanOrEqual(before);
    expect(preload.wallpaperShownAt).toBeLessThanOrEqual(performance.now());
  });
});
