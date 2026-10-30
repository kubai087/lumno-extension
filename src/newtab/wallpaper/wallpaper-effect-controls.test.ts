import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NOT_DRAGGING,
  STORAGE_KEYS,
  TYPED,
  createRuntime,
  installBroadcastChannel,
  installMatchMedia,
  openPanel,
  panelActions,
  panelOf,
  panelState
} from '../../../tests/fakes/wallpaper/runtime';
import { normalizeWallpaperEffectStoragePrefs } from './wallpaper';
import type { WallpaperRuntime } from './wallpaper';
import type { BrowserFake } from '../../../tests/fakes/browser';
import { installCanvasFake } from '../../../tests/fakes/canvas';

vi.mock('../react/wallpaper-view', async () => ({
  createWallpaperViewController: (await import('../../../tests/fakes/wallpaper/view-recorder')).createRecordingWallpaperView
}));

beforeEach(() => {
  installMatchMedia();
  installBroadcastChannel();
  installCanvasFake();
});

const effectState = (runtime: WallpaperRuntime) => panelState(runtime).wallpaper.effect;
const sliders = (runtime: WallpaperRuntime) => effectState(runtime).sliders;

// The effect saved for a mode, once the panel's debounced save has run.
function savedEffect(browser: BrowserFake, mode: 'light' | 'dark'): Record<string, unknown> {
  const stored = browser.storage.sync.values[STORAGE_KEYS.effect];
  if (typeof stored !== 'object' || stored === null || !(mode in stored)) {
    throw new Error('No wallpaper effect is saved.');
  }
  const prefs: unknown = Reflect.get(stored, mode);
  if (typeof prefs !== 'object' || prefs === null) {
    throw new Error(`No ${mode} wallpaper effect is saved.`);
  }
  return { ...prefs };
}

async function waitForSaved(browser: BrowserFake, mode: 'light' | 'dark', field: string, value: unknown): Promise<void> {
  await vi.waitFor(() => expect(savedEffect(browser, mode)[field]).toBe(value));
}

async function setup(effect?: unknown) {
  const harness = await createRuntime({ sync: effect === undefined ? {} : { [STORAGE_KEYS.effect]: effect } });
  harness.runtime.createControls();
  openPanel(harness.runtime);
  await harness.runtime.bootstrapInitialWallpaperEffect();
  return harness;
}

const v4Prefs = (type: string) => ({ version: 4, type, inkTone: 'auto', strength: 50, size: 50, spacing: 50 });

describe('the wallpaper filter ink tone', () => {
  it('shows the shadow or highlight picker for halftone and saves the choice for both modes', async () => {
    const { runtime, browser } = await setup({ version: 4, light: v4Prefs('halftone'), dark: v4Prefs('halftone') });
    const inkTone = () => effectState(runtime).inkTone;
    expect(inkTone().visible).toBe(true);
    // Automatic tone shows the dark default for the light wallpaper mode.
    expect(inkTone().tabs.active).toBe('dark');
    expect(inkTone().tabs.options.map((option) => [option.value, option.label])).toEqual([['dark', 'Shadows'], ['light', 'Highlights']]);

    panelActions(runtime).selectInkTone('light');
    expect(inkTone().tabs.active).toBe('light');
    await waitForSaved(browser, 'light', 'inkTone', 'light');
    expect(savedEffect(browser, 'dark').inkTone).toBe('light');
  });

  it('keeps the picker for ASCII and hides it for dither and grain', async () => {
    const { runtime } = await setup({ version: 4, light: v4Prefs('halftone'), dark: v4Prefs('halftone') });
    const actions = panelActions(runtime);
    actions.selectEffect('ascii');
    expect(effectState(runtime).inkTone.visible).toBe(true);
    actions.selectEffect('dither');
    expect(effectState(runtime).inkTone.visible).toBe(false);
    actions.selectEffect('grain');
    expect(effectState(runtime).inkTone.visible).toBe(false);
  });
});

describe('the Blocks filter', () => {
  it('is offered and applies to the page', async () => {
    const { runtime } = await setup();
    expect(effectState(runtime).select.options.some((option) => option.value === 'blocks' && option.label === 'Blocks')).toBe(true);
    panelActions(runtime).selectEffect('blocks');
    expect(effectState(runtime).select.value).toBe('blocks');
    expect(document.body.getAttribute('data-wallpaper-effect')).toBe('blocks');
  });

  it('keeps clicks in the filter menu inside the panel, and Escape closes the menu first', async () => {
    const { runtime } = await setup();
    const panel = panelOf(runtime);
    expect(runtime.containsTarget(panel.selectMenu)).toBe(true);
    panel.selectOpen = true;
    expect(runtime.closeOpenMenu()).toBe(true);
    expect(runtime.closeOpenMenu()).toBe(false);
  });

  it('shows only a whole-step block size, starting at the first level', async () => {
    const { runtime } = await setup();
    panelActions(runtime).selectEffect('blocks');
    const { size, strength, texture, spacing } = sliders(runtime);
    expect(size.visible).toBe(true);
    expect(size.label).toBe('Block size');
    expect(effectState(runtime).inkTone.visible).toBe(false);
    expect([strength.visible, texture.visible, spacing.visible]).toEqual([false, false, false]);
    expect(size.max).toBe(5);
    expect(size.step).toBeUndefined();
    expect(size.suffix).toBe('');
    expect(size.value).toBe(1);
  });

  it('saves its block size apart from the shared controls', async () => {
    const { runtime, browser } = await setup();
    panelActions(runtime).selectEffect('blocks');
    panelActions(runtime).setEffectParameter('size', 5, NOT_DRAGGING);
    expect(sliders(runtime).size.value).toBe(5);
    await waitForSaved(browser, 'light', 'blockSize', 5);
    expect(savedEffect(browser, 'light')).toMatchObject({ type: 'blocks', strength: 50, texture: 20, size: 50, spacing: 50 });
    expect(savedEffect(browser, 'dark').type).toBe('blocks');
  });
});

describe('the filter parameters', () => {
  it('keep each filter\'s own values when switching between filters', async () => {
    const modePrefs = {
      version: 11, type: 'grain', inkTone: 'auto', strength: 80, size: 65, spacing: 35, texture: 25,
      blockSize: 1, crtStrength: 20, crtBloom: 15, crtRgbOffset: 35, crtCurvature: 18
    };
    const { runtime, browser } = await setup({ version: 11, light: { ...modePrefs }, dark: { ...modePrefs } });
    const actions = panelActions(runtime);
    expect(sliders(runtime).strength.value).toBe(80);

    actions.selectEffect('crt');
    expect(sliders(runtime).strength.value).toBe(100);
    actions.setEffectParameter('strength', 50, NOT_DRAGGING);
    actions.selectEffect('grain');
    expect(sliders(runtime).strength.value).toBe(80);

    actions.selectEffect('blocks');
    expect(sliders(runtime).size.value).toBe(1);
    actions.setEffectParameter('size', 4, NOT_DRAGGING);
    actions.selectEffect('halftone');
    expect(sliders(runtime).size.value).toBe(65);
    actions.selectEffect('blocks');
    expect(sliders(runtime).size.value).toBe(4);
    actions.selectEffect('grain');

    await waitForSaved(browser, 'light', 'blockSize', 4);
    expect(savedEffect(browser, 'light')).toMatchObject({
      type: 'grain',
      strength: 80, size: 65, spacing: 35, texture: 25, blockSize: 4, crtStrength: 10
    });
  });
});

describe('the glass blur filter', () => {
  it('shows texture and strength, clamps typed values and saves them', async () => {
    const off = { version: 4, light: v4Prefs('none'), dark: v4Prefs('none') };
    const { runtime, browser } = await setup(off);
    const actions = panelActions(runtime);
    actions.selectEffect('blur');
    expect(effectState(runtime).select.value).toBe('blur');
    expect(document.body.getAttribute('data-wallpaper-effect')).toBe('blur');
    const { size, spacing, texture, strength } = sliders(runtime);
    expect([size.visible, spacing.visible, texture.visible]).toEqual([false, false, true]);
    expect(texture.disabled).toBe(false);
    expect([texture.min, texture.max]).toEqual([0, 100]);
    expect(texture.label).toBe('Texture');
    expect(strength.label).toBe('Blur strength');

    actions.setEffectParameter('texture', 180.75, TYPED);
    await waitForSaved(browser, 'light', 'texture', 100);
    actions.setEffectParameter('strength', 150, TYPED);
    await waitForSaved(browser, 'light', 'strength', 100);
    expect(savedEffect(browser, 'light').type).toBe('blur');
  });

  it('turns off with no filter, which has no settings', async () => {
    const { runtime, browser } = await setup({ version: 4, light: v4Prefs('blur'), dark: v4Prefs('blur') });
    panelActions(runtime).selectEffect('none');
    expect(effectState(runtime).select.value).toBe('none');
    expect(document.body.getAttribute('data-wallpaper-effect')).toBe('none');
    expect(sliders(runtime).strength.visible).toBe(false);
    await waitForSaved(browser, 'light', 'type', 'none');
    expect(savedEffect(browser, 'dark').type).toBe('none');
  });
});

describe('the CRT filter', () => {
  it('survives the storage fallback before the renderer exists', () => {
    expect(normalizeWallpaperEffectStoragePrefs({ type: 'crt' }).light.type).toBe('crt');
  });

  it('shows its display controls in percent', async () => {
    const legacy = { version: 7, type: 'none', strength: 50, size: 50, spacing: 240, texture: 20 };
    const { runtime } = await setup({ version: 7, light: { ...legacy }, dark: { ...legacy } });
    const actions = panelActions(runtime);
    expect(effectState(runtime).select.options.some((option) => option.value === 'crt')).toBe(true);
    actions.selectEffect('crt');
    expect(document.body.getAttribute('data-wallpaper-effect')).toBe('crt');
    // A fixed phosphor grille and two-pixel scanline: no size, spacing or texture.
    expect([sliders(runtime).size.visible, sliders(runtime).spacing.visible, sliders(runtime).texture.visible])
      .toEqual([false, false, false]);
    expect(sliders(runtime).strength.label).toBe('Display intensity');
    const { crtBloom: bloom, crtRgbOffset: offset, crtCurvature: curvature } = sliders(runtime);
    expect([bloom, offset, curvature].map((slider) => [slider.visible, slider.label]))
      .toEqual([[true, 'Bloom'], [true, 'RGB offset'], [true, 'Screen curvature']]);

    actions.setEffectParameter('strength', 50, TYPED);
    actions.setEffectParameter('crtBloom', 100, TYPED);
    actions.setEffectParameter('crtCurvature', 50, TYPED);
    expect(sliders(runtime).crtCurvature.value).toBe(50);
    actions.setEffectParameter('crtRgbOffset', 50, TYPED);
    const { strength, crtBloom, crtRgbOffset, crtCurvature } = sliders(runtime);
    [strength, crtBloom, crtRgbOffset, crtCurvature].forEach((slider) => {
      expect(slider.max).toBe(100);
      expect(slider.suffix).toBe('%');
      expect(slider.valueText).toBe(`${slider.value}%`);
    });
  });

  it('saves its controls on their physical scales and keeps the other filters\' spacing in range', async () => {
    const legacy = { version: 7, type: 'none', strength: 50, size: 50, spacing: 240, texture: 20 };
    const { runtime, browser } = await setup({ version: 7, light: { ...legacy }, dark: { ...legacy } });
    const actions = panelActions(runtime);
    actions.selectEffect('crt');
    actions.setEffectParameter('strength', 50, TYPED);
    actions.setEffectParameter('crtBloom', 100, TYPED);
    actions.setEffectParameter('crtCurvature', 50, TYPED);
    actions.setEffectParameter('crtRgbOffset', 50, TYPED);
    actions.selectEffect('grain');
    expect(sliders(runtime).spacing.max).toBe(100);
    expect(sliders(runtime).spacing.value).toBe(100);
    expect(sliders(runtime).spacing.suffix).toBe('%');
    await waitForSaved(browser, 'light', 'spacing', 100);
    actions.setEffectParameter('spacing', 240, TYPED);
    expect(sliders(runtime).spacing.value).toBe(100);
    actions.selectEffect('crt');
    expect(sliders(runtime).spacing.visible).toBe(false);

    await waitForSaved(browser, 'light', 'type', 'crt');
    const light = savedEffect(browser, 'light');
    expect(savedEffect(browser, 'dark').type).toBe('crt');
    expect(light).not.toHaveProperty('crtPreset');
    expect(savedEffect(browser, 'dark')).not.toHaveProperty('crtPreset');
    // 50% intensity is half of its 20-unit range, and 50% curvature half of 35.
    expect(light).toMatchObject({ crtStrength: 10, strength: 50, crtBloom: 20, crtRgbOffset: 50, crtCurvature: 17.5, spacing: 100 });
  });
});
