import { describe, expect, it } from 'vitest';
import { parseCss } from '../../../tests/fakes/css';
import type { CssCondition, CssRule } from '../../../tests/fakes/css';
import { SELECTION_SURFACE_STYLES } from './surface-styles';

const styles = parseCss(SELECTION_SURFACE_STYLES);

function rule(selector: string, condition?: CssCondition): CssRule {
  const found = styles.rule(selector, condition);
  if (!found) {
    throw new Error(`Expected the selection stylesheet to style ${selector}.`);
  }
  return found;
}

describe('selection toolbar stylesheet', () => {
  it('keeps page pseudo-elements out of the host', () => {
    const pseudo = rule(':host::before');
    expect([pseudo.get('content'), pseudo.priority('content'), pseudo.get('display'), pseudo.priority('display')])
      .toEqual(['none', 'important', 'none', 'important']);
  });

  it('draws the compact entry as an 18 px acrylic button that rises into view', () => {
    const entry = rule('.lumno-selection-main[data-icon-only="true"]');
    expect(entry.get('width')).toBe('18px');
    expect(entry.get('min-height')).toBe('18px');
    expect(rule('.lumno-selection-main[data-icon-only="true"] .lumno-selection-logo').get('width')).toBe('12px');
    expect(rule('.lumno-selection-main[data-icon-only="true"]::before').get('inset')).toBe('-5px');
    expect(entry.get('backdrop-filter')).toMatch(/blur\(/);
    expect(entry.get('opacity')).toBe('0');
    expect(entry.get('filter')).toBeNull();
    const shown = rule(':host([data-visible="true"]) .lumno-selection-main[data-icon-only="true"]');
    expect([shown.get('opacity'), shown.get('transform')]).toEqual(['1', 'translateY(0) scale(1)']);
    expect(styles.entries.some((entry) => entry.style.getPropertyValue('mix-blend-mode') === 'difference')).toBe(false);
  });

  it('gives the compact entry no border or shadow, and a background on hover', () => {
    const compact = rule('.lumno-selection-surface[data-icon-only="true"]');
    expect(compact.get('border')).toBe('0');
    expect(compact.get('box-shadow')).toBe('none');
    expect(rule('.lumno-selection-surface[data-icon-only="true"] .lumno-selection-main:hover').get('background')).toBeTruthy();
  });

  it('sizes the open toolbar as a 38 px shell that does not clip the material glow', () => {
    const surface = rule('.lumno-selection-surface');
    expect(surface.get('height')).toBe('38px');
    expect(surface.get('padding')).toBe('3px');
    expect(surface.get('border-radius')).toBe('var(--lumno-selection-surface-radius)');
    expect(surface.get('overflow')).toBe('visible');
    expect(surface.get('contain')).toBe('layout style');
    expect(surface.get('justify-content')).toBe('flex-start');
    expect(surface.get('color')).toMatch(/^light-dark\(/);
    expect(rule('.lumno-selection-surface[data-icon-only="false"]').get('padding-inline-end')).toBe('1px');
    expect(styles.rule('.lumno-selection-main[data-icon-only="false"] .lumno-selection-logo')).toBeNull();
  });

  it('fills the material separately for light and dark, with a static inner glow', () => {
    const material = rule('.lumno-selection-material');
    expect(material.get('background')).toMatch(/^light-dark\(/);
    expect(material.get('border')).toMatch(/^1px solid light-dark\(/);
    expect(material.get('box-shadow')).toMatch(/inset 0 0 0 1px light-dark\([^)]*\), transparent\)/);
    expect(material.get('backdrop-filter')).toMatch(/^blur\(14px\)/);
    expect(material.get('overflow')).toBe('hidden');
    const glow = rule('.lumno-selection-material::before');
    expect(glow.get('border-radius')).toBe('calc(var(--lumno-selection-surface-radius) - 1px)');
    expect(glow.get('background')).toMatch(/radial-gradient/);
  });

  it.each(['.lumno-selection-surface', '.lumno-selection-material', '.lumno-selection-material::before'])(
    'uses the Overlay corner curve where supported: %s', (selector) => {
      expect(rule(selector, /corner-shape/).get('corner-shape')).toBe('superellipse(1.25)');
    });

  it('styles actions with continuous corners and a visible keyboard focus that pointer hover overrides', () => {
    const button = rule('button');
    expect(button.get('min-height')).toBe('30px');
    expect(button.get('border-radius')).toBe('9px');
    expect(button.get('corner-shape')).toBe('superellipse(1.25)');
    expect(rule('button:hover').get('background')).toBeTruthy();
    expect(rule('button:focus-visible').get('box-shadow')).toMatch(/^inset 0 0 0 1px/);
    const competing = rule('.lumno-selection-toolbar:hover button:focus-visible:not(:hover)');
    expect([competing.get('background'), competing.get('box-shadow')]).toEqual(['transparent', 'none']);
    expect(rule('.lumno-selection-toolbar:focus').get('outline')).toBe('none');
  });

  it('keeps the contents right-aligned in clipping viewports that grow to the right', () => {
    const content = rule('.lumno-selection-content');
    expect([content.get('justify-content'), content.get('overflow'), content.get('min-width')]).toEqual(['flex-end', 'hidden', '0']);
    expect(content.get('border-radius')).toBe('2px');
    const toolbar = rule('.lumno-selection-toolbar');
    expect([toolbar.get('justify-content'), toolbar.get('transform-origin')]).toEqual(['flex-end', 'left center']);
    const actions = rule('.lumno-selection-actions-viewport');
    expect([actions.get('flex'), actions.get('min-width'), actions.get('justify-content'), actions.get('overflow')])
      .toEqual(['0 1 auto', '0', 'flex-end', 'hidden']);
  });

  it('separates actions with dividers as wide as the primary one, and 16 px icons', () => {
    const divider = rule('.lumno-selection-primary-divider');
    expect([divider.get('flex'), divider.get('height')]).toEqual(['0 0 auto', '18px']);
    expect(styles.rule('.lumno-selection-toolbar::before')).toBeNull();
    expect(rule('.lumno-selection-toolbar button + button').get('margin-inline-start')).toBe('7px');
    expect(rule('.lumno-selection-toolbar button + button::before').get('inset-inline-start')).toBe('-4px');
    const icon = rule('.lumno-selection-action-icon');
    expect([icon.get('width'), icon.get('height')]).toEqual(['16px', '16px']);
  });

  it('grows the material and contents through CSS state where Web Animations are missing', () => {
    const fallback = (state: string, part: string) => rule(
      `.lumno-selection-surface[data-toolbar-entrance-mode="fallback"][data-toolbar-entrance-state="${state}"] .lumno-selection-${part}`
    );
    expect(fallback('from', 'material').get('width')).toBe('0');
    expect(fallback('to', 'material').get('width')).toBe('var(--lumno-toolbar-expanded-width)');
    expect(fallback('from', 'content').get('width')).toBe('0');
    expect(fallback('to', 'content').get('width')).toBe('var(--lumno-toolbar-content-width)');
  });
});
