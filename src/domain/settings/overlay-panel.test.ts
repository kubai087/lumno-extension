import { describe, expect, it } from 'vitest';
import { overlayPageThemeAdaptationEnabled } from './overlay-panel';
import { BROWSER_SYNC_KEYS } from './registry';
import {
  OVERLAY_FONT_DEFAULT_STACK,
  OVERLAY_FONT_FAMILY_CSS_VAR,
  OVERLAY_FONT_KEYS,
  getOverlayFontFamilyCssValue,
  normalizeOverlayFontFamily,
  normalizeOverlayFontLabels,
  overlayEnterAnimation,
  overlayFontFallback,
  overlayFontFamily,
  overlayFontLabels,
  overlayOpenTabsDefaultVisible,
  overlaySizeMode,
  overlayTabPriority
} from './overlay-panel';

describe('Overlay page theme adaptation setting', () => {
  it('syncs under its own key and reads on unless turned off', () => {
    expect(overlayPageThemeAdaptationEnabled.key).toBe('_x_extension_overlay_page_theme_adaptation_enabled_2026_unique_');
    expect(BROWSER_SYNC_KEYS).toContain(overlayPageThemeAdaptationEnabled.key);
    expect(overlayPageThemeAdaptationEnabled.parse(undefined)).toBe(true);
    expect(overlayPageThemeAdaptationEnabled.parse(false)).toBe(false);
  });
});

describe('Overlay panel settings', () => {
  it('shows the open tabs unless turned off', () => {
    expect([false, true, undefined, 'false'].map((value) => overlayOpenTabsDefaultVisible.parse(value))).toEqual([false, true, true, true]);
  });

  it('reads a known size, standard otherwise', () => {
    expect(['compact', 'large', 'standard', 'other'].map((value) => overlaySizeMode.parse(value))).toEqual(['compact', 'large', 'standard', 'standard']);
  });

  it('reads a known entry animation, elastic otherwise', () => {
    expect(overlayEnterAnimation.key).toBe('_x_extension_overlay_enter_animation_2026_unique_');
    expect(['elastic', 'fade', undefined, 'other'].map((value) => overlayEnterAnimation.parse(value))).toEqual(['elastic', 'fade', 'elastic', 'elastic']);
  });

  it('prefers switching to an open tab unless the new tab comes first', () => {
    expect(['switchTabFirst', 'newtabFirst', false, undefined].map((value) => overlayTabPriority.parse(value))).toEqual([true, false, false, true]);
  });
});

describe('Overlay font settings', () => {
  it('keeps a font family name that is safe in CSS and drops anything else', () => {
    expect(overlayFontFamily.key).toBe('_x_extension_overlay_font_family_2026_unique_');
    expect(normalizeOverlayFontFamily('Zapfino')).toBe('Zapfino');
    expect(normalizeOverlayFontFamily('  PingFang SC  ')).toBe('PingFang SC');
    expect(normalizeOverlayFontFamily('a;b')).toBe('a;b');
    ['', '   ', null, 42, 'a"b', 'a\\b', 'x'.repeat(121), '换行\n字体'].forEach((value) => {
      expect(normalizeOverlayFontFamily(value)).toBe('');
    });
  });

  it('clears the custom property for no choice, so the stylesheet stack wins', () => {
    expect(getOverlayFontFamilyCssValue('', undefined)).toBe('');
    expect(getOverlayFontFamilyCssValue(null, undefined)).toBe('');
    expect(getOverlayFontFamilyCssValue('', '')).toBe('');
  });

  it('puts the chosen family, then the fallback family, before the default stack', () => {
    expect(getOverlayFontFamilyCssValue('Zapfino', undefined)).toBe(`"Zapfino", ${OVERLAY_FONT_DEFAULT_STACK}`);
    expect(getOverlayFontFamilyCssValue('Zapfino', 'PingFang SC')).toBe(`"Zapfino", "PingFang SC", ${OVERLAY_FONT_DEFAULT_STACK}`);
    expect(getOverlayFontFamilyCssValue('', 'PingFang SC')).toBe(`"PingFang SC", ${OVERLAY_FONT_DEFAULT_STACK}`);
    expect(getOverlayFontFamilyCssValue('Zapfino', 'bad"name')).toBe(`"Zapfino", ${OVERLAY_FONT_DEFAULT_STACK}`);
    expect(OVERLAY_FONT_DEFAULT_STACK).toContain("'Lumno Open Sans'");
    expect(OVERLAY_FONT_FAMILY_CSS_VAR).toBe('--lumno-font-sans');
  });

  it('keeps the display names of the chosen families only, two at most when the families are not known yet', () => {
    expect(normalizeOverlayFontLabels({ 'PingFang SC': ' 苹方-简 ', Zapfino: 'Zapfino', Old: 'Old' }, ['PingFang SC', ''])).toEqual({ 'PingFang SC': '苹方-简' });
    expect(normalizeOverlayFontLabels({ A: 'a', B: 'b', C: 'c' })).toEqual({ A: 'a', B: 'b' });
    expect(normalizeOverlayFontLabels({ 'bad"name': 'x', ok: 'bad\u0001' })).toEqual({});
    expect(normalizeOverlayFontLabels(['PingFang SC'])).toEqual({});
    expect(normalizeOverlayFontLabels(null)).toEqual({});
  });

  it('keeps the fonts, this computer’s installed faces, out of browser sync', () => {
    expect(OVERLAY_FONT_KEYS).toEqual([overlayFontFamily.key, overlayFontFallback.key, overlayFontLabels.key]);
    OVERLAY_FONT_KEYS.forEach((key) => expect(BROWSER_SYNC_KEYS).not.toContain(key));
  });
});
