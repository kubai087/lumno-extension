// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parsePageCss, parseStylesheet } from '../fakes/css';
import { readRepoText } from './repository';

// Styles and markup that spare the browser work: rows off screen skip
// layout, motion avoids paint-heavy filters, images reserve their space.
// (What the pages coalesce at run time is checked in tests/pages.)
describe('performance and style stability', () => {
  it('lets off-screen overlay rows skip layout and paint', () => {
    const row = parseStylesheet('src/overlay/suggestions-view.css')
      .rule(':is(#_x_extension_overlay_2024_unique_, #_x_extension_onboarding_overlay_demo_2026_unique_) .x-ov-suggestion-item');

    expect(row ? row.get('content-visibility') : null).toBe('auto');
    expect(row ? row.has('contain-intrinsic-block-size') : false).toBe(true);
  });

  it('animates favicon entry without blur filters', () => {
    expect(parseStylesheet('src/overlay/suggestions-view.css').entries.filter((entry) =>
      entry.selectors.some((selector) => /data-favicon-load-state="(?:priming|loaded)"\]/.test(selector)) &&
      /blur/.test(entry.style.getPropertyValue('filter')))).toEqual([]);
  });

  it('keeps a keyboard focus ring on the Settings toggles and scrolls its tabs instead of wrapping them', () => {
    const options = parsePageCss('src/options/options.html');

    expect(options.rule('._x_extension_toggle_2024_unique_ input:focus-visible')?.has('outline')).toBe(true);
    expect(options.rule('#_x_extension_settings_tabs_2024_unique_')?.get('overflow-x')).toBe('auto');
    expect(options.rule('._x_extension_settings_tab_button_2024_unique_')?.get('white-space')).toBe('nowrap');
  });

  it('opens the wallpaper panel without a full-surface blur filter', () => {
    const panel = parsePageCss('newtab.html').entries.filter((entry) => entry.selectors.includes('.x-nt-wallpaper-panel'));

    expect(panel.length).toBeGreaterThan(0);
    panel.forEach((entry) => {
      expect(entry.style.getPropertyValue('filter')).toBe('');
      expect(entry.style.getPropertyValue('will-change')).not.toMatch(/filter/);
    });
  });

  it.each(['newtab.html', 'src/options/options.html', 'src/onboarding/onboarding.html'])('defines a theme color and sized images in %s', (page) => {
    const doc = new DOMParser().parseFromString(readRepoText(page), 'text/html');

    expect(doc.querySelector('meta[name="theme-color"]')).not.toBeNull();
    expect(Array.from(doc.querySelectorAll('img')).filter((image) => !image.hasAttribute('width') || !image.hasAttribute('height'))
      .map((image) => image.outerHTML)).toEqual([]);
  });
});
