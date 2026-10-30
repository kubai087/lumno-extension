import { describe, expect, it } from 'vitest';
import { parseStylesheet } from '../../../tests/fakes/css';

// The shortcut editor's own stylesheet.
describe('shortcut dialog styles', () => {
  const css = parseStylesheet('src/newtab/shortcuts/shortcut-dialog.css');
  const declared = (selector: string, property: string, condition?: string | RegExp) => css.rule(selector, condition)?.get(property) ?? null;

  it('owns the dialog, its backdrop and the Lumno action buttons', () => {
    ['.x-nt-shortcut-dialog', '.x-nt-shortcut-dialog-backdrop', '.x-lumno-action-button', '.x-lumno-action-button--primary',
      '.x-lumno-action-button--secondary'].forEach((selector) => expect(css.selectors(), selector).toContain(selector));
  });

  it('floats a solid, borderless panel with continuous corners on it and its fields where supported', () => {
    expect(declared('.x-nt-shortcut-dialog', 'background')).toBe('var(--x-nt-shortcut-dialog-bg, rgb(255 255 255 / 0.98))');
    expect(declared('.x-nt-shortcut-dialog', 'border')).toBe('0');
    ['.x-nt-shortcut-dialog', '._x_extension_shortcut_input_2024_unique_'].forEach((selector) => {
      expect(declared(selector, 'corner-shape', /corner-shape:\s*superellipse\(1\.25\)/), selector).toBe('superellipse(1.25)');
    });
  });

  it('enters from the side of the tile that opened it, animates open and respects reduced motion', () => {
    expect(declared('.x-nt-shortcut-dialog', 'transform')).toBe('translateX(var(--x-nt-shortcut-dialog-enter-x, 0px)) scale(0.98)');
    expect(css.selectors()).toContain('.x-nt-shortcut-dialog-backdrop[data-open="true"] .x-nt-shortcut-dialog');
    // Transitions are off while its start position is prepared.
    expect(css.selectors()).toContain('.x-nt-shortcut-dialog-backdrop[data-preparing="true"] .x-nt-shortcut-dialog');
    expect(css.entries.some((entry) => entry.conditions.includes('(prefers-reduced-motion: reduce)'))).toBe(true);
  });

  it('blocks the page with its backdrop while it opens and closes', () => {
    expect(declared('.x-nt-shortcut-dialog-backdrop', 'pointer-events')).toBe('auto');
  });

  it('gives its fields the Settings input appearance', () => {
    expect([declared('._x_extension_shortcut_input_2024_unique_', 'border'), declared('._x_extension_shortcut_input_2024_unique_', 'background')])
      .toEqual(['1px solid var(--tab-border)', 'var(--control-bg)']);
  });
});
