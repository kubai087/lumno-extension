import { describe, expect, it } from 'vitest';
import { parseStylesheet } from '../../../tests/fakes/css';
import type { CssRule, ParsedCss } from '../../../tests/fakes/css';

const ARROW_BORDER = 'var(--x-lumno-feature-hint-arrow-border)';

function rule(css: ParsedCss, selector: string): CssRule {
  const found = css.rule(selector);
  if (!found) {
    throw new Error(`feature-hints.css has no rule for ${selector}`);
  }
  return found;
}

describe('feature hint styles', () => {
  const css = parseStylesheet('src/shared/ui/feature-hints.css');

  it('draws the arrow and its rounded tip in one opaque border color per theme', () => {
    expect(rule(css, '.x-lumno-feature-hint').get('--x-lumno-feature-hint-arrow-border')).toBe('#d8dde4');
    const sides: Array<[string, string]> = [['top', 'bottom'], ['right', 'left'], ['bottom', 'top'], ['left', 'right']];
    sides.forEach(([side, edge]) => {
      expect(rule(css, `.x-lumno-feature-hint[data-arrow-side="${side}"]::before`).get(`border-${edge}`))
        .toContain(`solid ${ARROW_BORDER}`);
    });
    expect(rule(css, '.x-lumno-feature-hint__arrow-tip').get('background')).toBe(ARROW_BORDER);
    expect(rule(css, 'body[data-theme="dark"] .x-lumno-feature-hint').get('--x-lumno-feature-hint-arrow-border')).toBe('#3a4150');
    expect(rule(css, '#_x_extension_overlay_2024_unique_[data-theme="dark"] .x-lumno-feature-hint')
      .get('--x-lumno-feature-hint-arrow-border')).toBe('#3a4150');
  });

  it('leaves the arrow color to the shared component, not to one placement', () => {
    const placements = css.entries.filter((entry) => entry.selectors.some((selector) => selector.includes('x-lumno-feature-hint--newtab-webdav-sync')));
    expect(placements.length).toBeGreaterThan(0);
    placements.forEach((entry) => expect(entry.style.names).not.toContain('--x-lumno-feature-hint-arrow-border'));
  });

  it('places the overlay update notice as a fixed capsule that blurs in untouchable while mounting', () => {
    expect(rule(css, '.x-lumno-feature-hint--update-notice-overlay').get('position')).toBe('fixed');
    expect(css.entries.some((entry) => entry.selectors.some((selector) => selector.startsWith('.x-lumno-feature-hint--update-notice')) &&
      entry.style.getPropertyValue('border-radius') === '999px')).toBe(true);
    const mounting = rule(css, '.x-lumno-feature-hint--update-notice-overlay[data-overlay-mounting="true"]');
    expect([mounting.get('filter'), mounting.get('pointer-events')]).toEqual(['blur(8px)', 'none']);
  });

  it('keeps the update notice title on one row, cut with an ellipsis', () => {
    const row = rule(css, '.x-lumno-feature-hint--update-notice[data-width-mode="container"]');
    const title = rule(css, '.x-lumno-feature-hint--update-notice .x-lumno-feature-hint__text');
    expect([row.get('flex-wrap'), row.get('white-space')]).toEqual(['nowrap', 'nowrap']);
    expect([title.get('overflow'), title.get('overflow-wrap'), title.get('text-overflow'), title.get('white-space')])
      .toEqual(['hidden', 'normal', 'ellipsis', 'nowrap']);
  });

  it('reserves room before a wide emoji in a text badge icon', () => {
    const icon = rule(css, '.x-lumno-feature-hint__badge-icon[data-icon-type="text"]');
    expect([icon.get('width'), icon.get('padding-inline-start'), icon.get('justify-content')]).toEqual(['22px', '4px', 'flex-end']);
  });

  it('gives the update notice badge its own material in light and dark', () => {
    expect(rule(css, '.x-lumno-feature-hint--update-notice .x-lumno-feature-hint__badge').has('--x-lumno-feature-hint-badge-bg')).toBe(true);
    expect(rule(css, 'body[data-theme="dark"] .x-lumno-feature-hint--update-notice .x-lumno-feature-hint__badge')
      .has('--x-lumno-feature-hint-badge-gloss')).toBe(true);
    expect(rule(css, 'body[data-theme="dark"] .x-lumno-feature-hint--update-notice').has('--x-lumno-feature-hint-sweep-core')).toBe(true);
  });
});
