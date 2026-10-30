import { describe, expect, it, vi } from 'vitest';
import { bootOverlayPage, OVERLAY_ID, settle, waitFor, type OverlayPage, type OverlayPageOptions } from './boot';
import { getElement, required } from '../../fakes/dom';
import { parseCss, readStylesheet } from '../../fakes/css';

// How the overlay enters and lays itself out: the Web Animations it plays
// for each entry setting, when it skips them, the state it rests in, its
// theme elevation, its width and its corner radii with and without results.
// The shell's own rest state is covered by src/overlay/react/shell.test.tsx.

const MOTION_KEY = '_x_extension_motion_effects_enabled_2026_unique_';
const ANIMATION_KEY = '_x_extension_overlay_enter_animation_2026_unique_';
const OPEN_TABS_VISIBLE_KEY = '_x_extension_overlay_open_tabs_default_visible_2026_unique_';
const THEME_KEY = '_x_extension_theme_mode_2024_unique_';
const SIZE_KEY = '_x_extension_overlay_size_mode_2026_unique_';
const WIDTH_KEY = '_x_extension_overlay_width_2026_unique_';
const REST = 'translateX(-50%) translateY(0) scale(var(--x-ov-visible-scale, 1)) scale(1)';
const SPRING_EASING = /^linear\(0, .*, 1\)$/;

// The overlay skips its entry when it starts more than 280ms after the open
// was asked for; with `freezeClock` the start always looks instant, for a
// case about what else holds the entry back.
async function openWithMotion(settings: Record<string, unknown> = {}, options: OverlayPageOptions = {}, freezeClock = false) {
  const page = await bootOverlayPage({ settings: { [MOTION_KEY]: true, ...settings }, stylesheetsLoad: 5, ...options });
  if (freezeClock) {
    vi.spyOn(Date, 'now').mockReturnValue(Date.now());
  }
  const root = await page.open({ openedAt: Date.now() });
  await settle(80);
  return { page, root, overlay: getElement(root, `#${OVERLAY_ID}`) };
}

function entryAnimations(page: OverlayPage, overlay: Element) {
  const onPanel = page.animations.filter((animation) => animation.target === overlay);
  return {
    transform: onPanel.find((animation) => animation.keyframes.some((frame) => 'transform' in frame)),
    opacity: onPanel.find((animation) => animation.keyframes.some((frame) => 'opacity' in frame))
  };
}

const opacityOf = (overlay: HTMLElement) => [overlay.style.getPropertyValue('opacity'), overlay.style.getPropertyPriority('opacity')];

describe('Overlay entry motion', () => {
  it.each([
    ['the spring', {}, 'translateY(8px) scale(0.94)', 180, SPRING_EASING, 80],
    ['the spring over open tabs', { [OPEN_TABS_VISIBLE_KEY]: true }, 'translateY(8px) scale(0.96)', 180, SPRING_EASING, 80],
    ['the fade', { [ANIMATION_KEY]: 'fade' }, 'translateY(16px) scale(0.985)', 170, 'cubic-bezier(0.2, 1, 0.36, 1)', 110]
  ])('plays %s on top of the centred rest transform, then releases its hints', async (_name, settings, startDelta, duration, easing, opacityDuration) => {
    const { page, overlay } = await openWithMotion(settings);
    await waitFor(() => {
      const started = entryAnimations(page, overlay);
      return started.transform && started.opacity;
    }, 'the panel did not animate');
    const { transform, opacity } = entryAnimations(page, overlay);
    const transformMotion = required(transform, 'the transform animation');
    const opacityMotion = required(opacity, 'the opacity animation');
    expect(transformMotion.keyframes).toEqual([{ transform: startDelta }, { transform: 'none' }]);
    expect([transformMotion.options.composite, transformMotion.options.fill, transformMotion.options.duration]).toEqual(['add', 'backwards', duration]);
    if (easing instanceof RegExp) {
      expect(transformMotion.options.easing).toMatch(easing);
    } else {
      expect(transformMotion.options.easing).toBe(easing);
    }
    expect(opacityMotion.keyframes).toEqual([{ opacity: 0 }, { opacity: 1 }]);
    expect(opacityMotion.options.duration).toBe(opacityDuration);
    expect(overlay.style.getPropertyValue('transform')).toBe(REST);
    expect(overlay.style.getPropertyValue('will-change')).toBe('transform, opacity');
    // The backdrop-filtered panel never animates its filter.
    expect(page.animations.some((animation) => animation.keyframes.some((frame) => 'filter' in frame))).toBe(false);
    expect(overlay.style.getPropertyValue('zoom')).toBe('');

    transformMotion.animation.emitFinish();
    await settle(20);
    expect(overlay.style.getPropertyValue('will-change')).toBe('auto');
    expect(opacityOf(overlay)).toEqual(['1', 'important']);
    expect(overlay.style.getPropertyValue('transform')).toBe(REST);
    expect(overlay.style.getPropertyValue('transition')).toBe('');
  });

  it.each([
    ['motion effects are off', { [MOTION_KEY]: false }, {}],
    ['its stylesheets are still loading', {}, { stylesheetsLoad: false }],
    ['it starts late', {}, { storageDelayMs: 320 }]
  ] satisfies Array<[string, Record<string, unknown>, OverlayPageOptions]>)('shows at once when %s', async (_name, settings, options) => {
    const { page, overlay } = await openWithMotion(settings, options);
    expect(page.animations.filter((animation) => animation.target === overlay)).toEqual([]);
    expect(opacityOf(overlay)).toEqual(['1', 'important']);
    expect(overlay.style.getPropertyValue('transform')).toBe(REST);
    expect(page.root()?.activeElement).toBe(page.input());
  });

  // A page's first open loads the stylesheets cold. Arriving after the
  // reveal gate's budget but before the settings, they still style the panel
  // before it shows, and it still plays its entry.
  it('still plays the entry when the stylesheets arrive late but before the settings', async () => {
    const { page, overlay } = await openWithMotion({}, { stylesheetsLoad: 110, storageDelayMs: 160 }, true);
    const { transform, opacity } = entryAnimations(page, overlay);
    expect(transform && opacity).toBeTruthy();
    expect(overlay.hasAttribute('data-lumno-site-fix-style-fallback')).toBe(false);
  });
});

describe('Overlay panel layout', () => {
  it('gives each theme its own neutral elevation and caps the dark backdrop blur', async () => {
    const { page, overlay } = await openWithMotion();
    const lightShadow = overlay.style.getPropertyValue('--x-ov-shadow');
    expect(lightShadow).toBeTruthy();
    expect(overlay.style.getPropertyValue('--x-ov-blur')).toBe('14px');

    page.changeSetting(THEME_KEY, 'dark');
    await settle();
    const darkShadow = overlay.style.getPropertyValue('--x-ov-shadow');
    expect(darkShadow).not.toBe(lightShadow);
    expect((darkShadow.match(/rgba\(\d+, \d+, \d+/g) || []).every((color) => /rgba\((0, 0, 0|255, 255, 255)/.test(color))).toBe(true);
    expect(overlay.style.getPropertyValue('--x-ov-blur')).toBe('28px');
  });

  it('uses a custom width within its range in place of the size, and the size without one', async () => {
    const { page, overlay } = await openWithMotion({ [SIZE_KEY]: 'large', [WIDTH_KEY]: 920 });
    expect(overlay.style.getPropertyValue('width')).toBe('920px');
    page.changeSetting(WIDTH_KEY, 5000);
    await settle();
    expect(overlay.style.getPropertyValue('width')).toBe('1040px');
    page.changeSetting(WIDTH_KEY, undefined);
    await settle();
    expect(overlay.style.getPropertyValue('width')).toBe('840px');
    page.changeSetting(SIZE_KEY, 'compact');
    await settle();
    expect(overlay.style.getPropertyValue('width')).toBe('680px');
  });

  it('squares the input\'s lower corners while results show, keeping the panel round', async () => {
    const page = await bootOverlayPage({
      respond: (message) => {
        if (message.action === 'getSearchSuggestions') {
          return { suggestions: [{ type: 'history', title: 'Local history hit', url: 'https://local.example.test/' }] };
        }
        if (message.action === 'getSearchEngineSuggestions') {
          const local = Array.isArray(message.localSuggestions) ? message.localSuggestions : [];
          return { suggestions: local.concat([{ type: 'googleSuggest', title: 'remote phrase', url: '' }]), hasRemoteSuggestions: true };
        }
        return undefined;
      }
    });
    const root = await page.open();
    const overlay = getElement(root, `#${OVERLAY_ID}`);
    const inputShell = () => required(Array.from(root.querySelectorAll('[style]'))
      .find((element): element is HTMLElement => element instanceof HTMLElement &&
        /content-radius/.test(element.style.getPropertyValue('border-radius'))), 'the input shell');
    const shows = (text: string) => (root.textContent || '').includes(text);
    expect(overlay.style.getPropertyValue('border-radius')).toBe('var(--x-ov-panel-radius, 26px)');

    await page.type('local');
    await waitFor(() => shows('Local history hit'), 'the local results did not render');
    await waitFor(() => shows('remote phrase'), 'the remote results did not join them');
    expect(inputShell().style.getPropertyValue('border-radius')).toBe('var(--x-ov-content-radius, 25px) var(--x-ov-content-radius, 25px) 0 0');
    expect(overlay.style.getPropertyValue('border-radius')).toBe('var(--x-ov-panel-radius, 26px)');
    // Results keep their natural height, not a fixed one.
    expect(getElement(root, '.x-ov-suggestions-container').style.getPropertyValue('height')).not.toMatch(/^\d+px$/);

    await page.type('');
    await waitFor(() => page.suggestions().length === 0, 'clearing did not collapse the results');
    expect(inputShell().style.getPropertyValue('border-radius')).toBe('var(--x-ov-content-radius, 25px)');
  });

  it('rounds the results\' lower corners to the inner radius', () => {
    const css = parseCss(readStylesheet('src/overlay/suggestions-view.css'));
    const container = required(css.entries.find((entry) => entry.selectors.some((selector) => selector.endsWith('.x-ov-suggestions-container')) &&
      entry.style.getPropertyValue('border-radius')), 'the results rule');
    expect(container.style.getPropertyValue('border-radius')).toBe('0 0 var(--x-ov-content-radius, 25px) var(--x-ov-content-radius, 25px)');
  });

  it('shares its entry motion fallback and scope menu spring with New Tab', () => {
    const css = parseCss(readStylesheet('src/shared/search/search-input.css'));
    const tokens = required(css.entries.find((entry) => entry.style.getPropertyValue('--x-lumno-search-entry-scale-start')), 'the motion tokens');
    expect(tokens.style.getPropertyValue('--x-lumno-search-entry-scale-start').trim()).toBe('0.97');
    expect(tokens.style.getPropertyValue('--x-lumno-search-entry-easing').trim()).toBe('cubic-bezier(0.16, 1, 0.3, 1)');
    expect(css.rule('.x-lumno-search-input-mode__menu:not([hidden])')?.get('transition'))
      .toMatch(/transform 360ms cubic-bezier\(0\.2, 1\.45, 0\.35, 1\)/);
    const reduced = css.rule('.x-lumno-search-input-mode__menu', /prefers-reduced-motion/);
    expect([reduced?.get('animation'), reduced?.get('transition')]).toEqual(['none', 'none']);
  });
});
