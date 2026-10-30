import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORAGE_KEYS,
  createRuntime,
  installBroadcastChannel,
  installMatchMedia,
  openPanel,
  panelActions
} from '../../../tests/fakes/wallpaper/runtime';
import * as WallpaperEffects from '../dom/wallpaper-effects';
import { installCanvasFake } from '../../../tests/fakes/canvas';
import { expectElement } from '../../../tests/fakes/dom';

vi.mock('../react/wallpaper-view', async () => ({
  createWallpaperViewController: (await import('../../../tests/fakes/wallpaper/view-recorder')).createRecordingWallpaperView
}));
vi.mock('../dom/wallpaper-effects', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../dom/wallpaper-effects')>();
  return { ...actual, createWallpaperEffects: vi.fn(actual.createWallpaperEffects) };
});

let media: ReturnType<typeof installMatchMedia>;

beforeEach(() => {
  media = installMatchMedia();
  installBroadcastChannel();
  installCanvasFake();
});

// Settles once the browser has drawn `count` more frames.
async function nextFrames(count: number): Promise<void> {
  for (let frame = 0; frame < count; frame += 1) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

const transitionLayer = () => document.body.querySelector('.x-nt-wallpaper-transition-layer');

describe('switching to and from glass blur', () => {
  async function setup() {
    const actual = await vi.importActual<typeof import('../dom/wallpaper-effects')>('../dom/wallpaper-effects');
    let finishBlurRender: () => void = () => {};
    const blurRendered = new Promise<void>((resolve) => {
      finishBlurRender = resolve;
    });
    // The effect draws nothing; glass blur's render finishes when the test says.
    vi.mocked(WallpaperEffects.createWallpaperEffects).mockImplementation((options) => ({
      ...actual.createWallpaperEffects(options),
      apply: (prefs: unknown) => (WallpaperEffects.normalizePrefs(prefs).type === 'blur' ? blurRendered : Promise.resolve()),
      refresh: () => Promise.resolve()
    }));
    media.setSilently('(prefers-reduced-motion: reduce)', false);
    const grain = { version: 7, type: 'grain', strength: 50, size: 50, spacing: 50, texture: 20 };
    const { runtime } = await createRuntime({ sync: { [STORAGE_KEYS.effect]: { version: 7, light: { ...grain }, dark: { ...grain } } } });
    runtime.createControls();
    openPanel(runtime);
    await runtime.bootstrapInitialWallpaperEffect();
    document.body.setAttribute('data-nt-enter', 'done');
    return { runtime, finishBlurRender };
  }

  it('holds the outgoing frame until the blurred background and texture are drawn', async () => {
    const { runtime, finishBlurRender } = await setup();
    expect(document.body.getAttribute('data-wallpaper-effect')).toBe('grain');

    panelActions(runtime).selectEffect('blur');
    const entering = expectElement(transitionLayer(), 'the outgoing frame');
    expect(entering.getAttribute('data-exit')).toBeNull();
    expect(document.body.getAttribute('data-wallpaper-effect')).toBe('blur');
    await nextFrames(3);
    expect(entering.getAttribute('data-exit')).toBeNull();

    finishBlurRender();
    await vi.waitFor(() => expect(entering.getAttribute('data-exit')).toBe('true'));
    await vi.waitFor(() => expect(entering.parentNode).toBeNull());
  });

  it('freezes the blur on the outgoing frame when leaving glass blur', async () => {
    const { runtime, finishBlurRender } = await setup();
    panelActions(runtime).selectEffect('blur');
    const entering = expectElement(transitionLayer(), 'the outgoing frame');
    finishBlurRender();
    await vi.waitFor(() => expect(entering.parentNode).toBeNull());
    const blurProperties: Record<string, string> = {
      '--x-nt-wallpaper-blur-overscan': '42px',
      '--x-nt-wallpaper-blur-radius': '18px',
      '--x-nt-wallpaper-blur-saturate': '110%',
      '--x-nt-wallpaper-blur-brightness': '106%',
      '--x-nt-wallpaper-blur-contrast': '84%'
    };
    Object.entries(blurProperties).forEach(([name, value]) => document.body.style.setProperty(name, value));

    panelActions(runtime).selectEffect('grain');

    const leaving = expectElement(transitionLayer(), 'the blurred outgoing frame');
    expect(leaving.getAttribute('data-wallpaper-effect')).toBe('blur');
    Object.entries(blurProperties).forEach(([name, value]) => {
      expect(leaving.style.getPropertyValue(name)).toBe(value);
    });
    expect(document.body.getAttribute('data-wallpaper-effect')).toBe('grain');
  });
});
