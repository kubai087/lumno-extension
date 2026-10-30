// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parsePageCss, parseStylesheet } from '../fakes/css';
import { builtModules } from './repository';

// Result rows take their colors from the site's favicon theme
// (src/shared/favicon/favicon-theme.test.ts checks their contrast).
describe('themed result colors', () => {
  it('ship the shared theme algorithm with the injected overlay', () => {
    expect(builtModules('injected/overlay.js')).toContain('src/shared/favicon/favicon-theme.ts');
  });

  // Softened passive borders keep a strong keyboard focus ring on both surfaces.
  it.each([
    ['New Tab', () => parsePageCss('newtab.html'), 'x-nt'],
    ['the overlay', () => parseStylesheet('src/overlay/suggestions-view.css'), 'x-ov']
  ])('keep a strong focus ring on the action and utility buttons of %s', (_surface, read, prefix) => {
    const css = read();
    ['action', 'utility'].forEach((kind) => {
      const focused = css.entries.find((entry) => entry.selectors.some((selector) => selector.endsWith(`.${prefix}-suggestion-${kind}-button:focus-visible`)) &&
        entry.style.getPropertyValue('outline'));
      expect(focused ? focused.style.getPropertyValue('outline').trim() : null).toBe('2px solid currentColor');
    });
  });
});
