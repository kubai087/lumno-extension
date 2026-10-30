import { describe, expect, it } from 'vitest';
import { bootOverlayPage, OVERLAY_ID, settle } from './boot';
import { getElement, required } from '../../fakes/dom';
import { parseCss, readRepoFile } from '../../fakes/css';
import {
  OVERLAY_FONT_DEFAULT_STACK,
  getOverlayFontFamilyCssValue,
  overlayFontFallback,
  overlayFontFamily
} from '../../../src/domain/settings/overlay-panel';

// The font chosen in Settings, as the overlay applies it from this device's
// storage. The Settings rows are covered by the Options appearance tests;
// that the fonts never leave the device by tests/repo/overlay-font.test.ts
// and the settings migrations.

const FAMILY_KEY = overlayFontFamily.key;
const FALLBACK_KEY = overlayFontFallback.key;
const FONT_VAR = '--lumno-font-sans';

describe('Overlay font', () => {
  it('points the font token at the family and fallback chosen on this device, and follows changes there only', async () => {
    const page = await bootOverlayPage({ local: { [FAMILY_KEY]: 'Inter', [FALLBACK_KEY]: 'Georgia' } });
    const root = await page.open();
    const overlay = getElement(root, `#${OVERLAY_ID}`);
    expect(overlay.style.getPropertyValue(FONT_VAR)).toBe(getOverlayFontFamilyCssValue('Inter', 'Georgia'));
    const fontRead = required(page.storageReads.find((read) => read.keys.includes(FAMILY_KEY)), 'the font read');
    expect(fontRead.area).toBe('local');
    expect(fontRead.keys).toContain(FALLBACK_KEY);
    const preferenceRead = required(page.storageReads.find((read) => read.keys.includes('_x_extension_language_2024_unique_')), 'the preference read');
    expect(preferenceRead.keys.some((key) => key.includes('overlay_font'))).toBe(false);

    page.changeSetting(FAMILY_KEY, 'Menlo', 'local');
    await settle();
    const chosen = getOverlayFontFamilyCssValue('Menlo', 'Georgia');
    expect(overlay.style.getPropertyValue(FONT_VAR)).toBe(chosen);
    // A font in browser sync is ignored.
    page.changeSetting(FAMILY_KEY, 'Arial', 'sync');
    await settle();
    expect(overlay.style.getPropertyValue(FONT_VAR)).toBe(chosen);
    page.changeSetting('_x_extension_theme_mode_2024_unique_', 'dark', 'sync');
    await settle();
    expect(overlay.style.getPropertyValue(FONT_VAR)).toBe(chosen);
  });

  it('styles inline input parts with the token, and defines the bundled stack in its shadow root', async () => {
    const page = await bootOverlayPage();
    const root = await page.open();
    const inlineFonts = Array.from(root.querySelectorAll('[style]'))
      .map((element) => (element instanceof HTMLElement ? element.style.fontFamily : ''))
      .filter(Boolean);
    expect(inlineFonts.length).toBeGreaterThan(0);
    inlineFonts.forEach((value) => expect(value).toContain(`var(${FONT_VAR}`));
    // tokens.css never reaches the shadow root.
    const panelStyles = parseCss(Array.from(root.querySelectorAll('style'), (style) => style.textContent || '').join('\n'));
    expect(panelStyles.rule(`:where(#${OVERLAY_ID})`)?.get(FONT_VAR)).toBe(OVERLAY_FONT_DEFAULT_STACK);
  });

  it('holds the bundled stack in tokens.css, and every overlay text rule follows the token', () => {
    expect(parseCss(readRepoFile('src/shared/tokens.css')).rule(':root')?.get(FONT_VAR)).toBe(OVERLAY_FONT_DEFAULT_STACK);
    // Each text rule names the token or inherits it; none repeats the stack.
    ['src/overlay/suggestions-view.css', 'src/shared/search/search-input.css'].forEach((file) => {
      const fontRules = parseCss(readRepoFile(file)).entries
        .filter((entry) => entry.style.getPropertyValue('font-family') || entry.style.getPropertyValue('font'));
      expect(fontRules.length).toBeGreaterThan(0);
      fontRules.forEach((entry) => {
        const value = entry.style.getPropertyValue('font-family') || entry.style.getPropertyValue('font');
        if (value === 'inherit') {
          return;
        }
        if (/remixicon/.test(value)) {
          // Only icon glyphs keep their own font.
          expect(entry.selectors.some((selector) => selector.includes('ri-'))).toBe(true);
          return;
        }
        expect(value, `${file} ${entry.selectors.join(', ')}`).toMatch(/var\(--lumno-font-sans, sans-serif\)/);
      });
    });
  });
});
