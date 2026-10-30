import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as LumnoFeatureHints from '../../shared/ui/feature-hints';
import { FEATURE_HINTS } from '../../shared/ui/feature-hint-catalog';
import type { FeatureHintController, FeatureHintOptions } from '../../shared/ui/feature-hint-catalog';
import {
  DEFAULT_WALLPAPER_ID,
  NOT_DRAGGING,
  STORAGE_KEYS,
  TYPED,
  clickTile,
  createRuntime,
  findTile,
  installBroadcastChannel,
  installMatchMedia,
  openPanel,
  panelActions,
  panelState,
  shownWallpaperImage
} from '../../../tests/fakes/wallpaper/runtime';
import { settleTasks } from '../../../tests/fakes/wallpaper/uploads';
import { installCanvasFake, installImageFake } from '../../../tests/fakes/canvas';
import type { FakeImage } from '../../../tests/fakes/canvas';
import { required } from '../../../tests/fakes/dom';

vi.mock('../react/wallpaper-view', async () => ({
  createWallpaperViewController: (await import('../../../tests/fakes/wallpaper/view-recorder')).createRecordingWallpaperView
}));

beforeEach(() => {
  installMatchMedia();
  installBroadcastChannel();
  installCanvasFake();
});

const DRAGGED = Object.freeze({ dragging: true, final: false });

describe('the mask and filter sliders', () => {
  it('snap to their marks only while dragged, and the mask saves once it settles', async () => {
    installImageFake();
    const { runtime, browser } = await createRuntime();
    const syncWrites = vi.spyOn(browser.storage.sync, 'set');
    runtime.createControls();
    openPanel(runtime);
    await runtime.bootstrapInitialWallpaperOverlay();
    await runtime.bootstrapInitialWallpaperEffect();
    const actions = panelActions(runtime);
    const overlay = () => panelState(runtime).wallpaper.overlay;
    expect([overlay().label, overlay().value, overlay().min, overlay().max]).toEqual(['Mask effect', 50, 0, 100]);
    actions.setOverlay(53, DRAGGED);
    expect(overlay().value).toBe(50);
    // The cover end only snaps when reached exactly.
    actions.setOverlay(97, DRAGGED);
    expect(overlay().value).toBe(97);
    // Keys and typed values keep their exact value, clamped to the range.
    actions.setOverlay(53, NOT_DRAGGING);
    expect(overlay().value).toBe(53);
    actions.setOverlay(148, TYPED);
    expect(overlay().value).toBe(100);

    // Only the mask of the shown mode changes.
    await vi.waitFor(() => expect(browser.storage.sync.values[STORAGE_KEYS.overlay]).toEqual({ version: 2, light: 100, dark: 50 }));
    await settleTasks();
    expect(syncWrites.mock.calls.filter(([items]) => STORAGE_KEYS.overlay in items)).toHaveLength(1);

    actions.selectEffect('grain');
    actions.setEffectParameter('strength', 47, DRAGGED);
    expect(panelState(runtime).wallpaper.effect.sliders.strength.value).toBe(50);
    actions.setEffectParameter('spacing', 47, DRAGGED);
    expect(panelState(runtime).wallpaper.effect.sliders.spacing.value).toBe(47);
  });
});

describe('the new wallpapers hint', () => {
  it('waits while the New Tab is about to move to its focused route', async () => {
    document.documentElement.setAttribute('data-nt-focus-route-pending', 'true');
    const createFeatureHint = vi.fn(() => null);
    const { runtime } = await createRuntime({ featureHints: { ...LumnoFeatureHints, createFeatureHint } });
    runtime.createControls();
    await settleTasks(2);
    expect(createFeatureHint).not.toHaveBeenCalled();
  });

  it('shows once beside the appearance button and is dismissed when the panel opens', async () => {
    const featureHintVisibilityGate = Promise.resolve();
    const hintElement = document.createElement('span');
    hintElement.setAttribute('data-feature-hint-id', 'newtab-wallpaper-sources');
    const dismiss = vi.fn();
    const createFeatureHint = vi.fn((_options: FeatureHintOptions): FeatureHintController => ({
      definition: FEATURE_HINTS.NEWTAB_WALLPAPER_SOURCES,
      element: hintElement,
      textId: '',
      destroy() {},
      dismiss,
      isDismissed: () => false,
      isVisible: () => true,
      ready: Promise.resolve(true),
      setVisible() {},
      updateLanguage() {}
    }));
    const { runtime } = await createRuntime({
      featureHints: { ...LumnoFeatureHints, createFeatureHint },
      featureHintVisibilityGate
    });
    runtime.createControls();
    await settleTasks(2);
    expect(createFeatureHint).toHaveBeenCalledTimes(1);
    const options = createFeatureHint.mock.calls[0][0];
    expect(options.definition).toBe('newtab-wallpaper-sources');
    // It keeps its normal Sync dismissal state, and waits for the page's entrance.
    expect(options.dismissStorage).toBeUndefined();
    expect(options.visibilityGate).toBe(featureHintVisibilityGate);
    expect(hintElement.parentNode).toBe(runtime.getControlElement());

    openPanel(runtime);
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});

describe('choosing a wallpaper', () => {
  const imageOf = (images: FakeImage[], file: string) =>
    images.filter((image) => image.src.endsWith(`/assets/wallpapers/${file}`));

  async function setup() {
    const imageFake = installImageFake({ deferDecode: true });
    const { runtime } = await createRuntime({ sync: { [STORAGE_KEYS.wallpaper]: DEFAULT_WALLPAPER_ID } });
    await runtime.bootstrapInitialWallpaper();
    runtime.createControls();
    openPanel(runtime);
    return { images: imageFake.images, runtime };
  }

  it('reuses the image a hovered, focused or pressed tile started decoding', async () => {
    const { images, runtime } = await setup();
    // Hovering, focusing and pressing a tile each prime its image.
    panelActions(runtime).primeWallpaper('white-shanshui');
    panelActions(runtime).primeWallpaper('white-shanshui');
    panelActions(runtime).primeWallpaper('white-shanshui');
    expect(imageOf(images, 'lumno-newtab-white-shanshui.webp')).toHaveLength(1);

    clickTile(runtime, 'white-shanshui');
    expect(imageOf(images, 'lumno-newtab-white-shanshui.webp')).toHaveLength(1);
    // The previous wallpaper stays while the chosen one decodes; its tile is highlighted at once.
    expect(shownWallpaperImage()).toContain('lumno-newtab-monet-coastal-white.webp');
    expect(required(findTile(runtime, 'white-shanshui')).selected).toBe(true);

    imageOf(images, 'lumno-newtab-white-shanshui.webp')[0].finishDecode();
    await vi.waitFor(() => expect(shownWallpaperImage()).toContain('lumno-newtab-white-shanshui.webp'));
  });

  it('never shows a wallpaper chosen earlier whose decode finishes last', async () => {
    const { images, runtime } = await setup();
    clickTile(runtime, 'white-shanshui');
    clickTile(runtime, 'dark-shanshui-moonlit');
    await vi.waitFor(() => {
      expect(imageOf(images, 'lumno-newtab-white-shanshui.webp')).toHaveLength(1);
      expect(imageOf(images, 'lumno-newtab-dark-shanshui-moonlit.webp')).toHaveLength(1);
    });

    imageOf(images, 'lumno-newtab-dark-shanshui-moonlit.webp')[0].finishDecode();
    await vi.waitFor(() => expect(shownWallpaperImage()).toContain('lumno-newtab-dark-shanshui-moonlit.webp'));

    imageOf(images, 'lumno-newtab-white-shanshui.webp')[0].finishDecode();
    await settleTasks();
    expect(shownWallpaperImage()).toContain('lumno-newtab-dark-shanshui-moonlit.webp');
  });
});
