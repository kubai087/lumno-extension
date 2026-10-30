import { describe, expect, it } from 'vitest';
import { getElement } from '../../fakes/dom';
import { parseStylesheet, type ParsedCss } from '../../fakes/css';
import { openSearchSurface } from './surfaces';

// The search shell's border colors are defined once, in the shared search
// input stylesheet, and every surface that frames a search box or a menu
// reads them from there in light and dark themes.

const LIGHT = '--x-lumno-search-shell-border-light';
const DARK = '--x-lumno-search-shell-border-dark';

// Every declaration of `property` in a stylesheet.
function declarations(css: ParsedCss, property: string): Array<{ selectors: readonly string[]; value: string }> {
  return css.entries
    .filter((entry) => entry.style.getPropertyValue(property))
    .map((entry) => ({
      selectors: entry.selectors,
      value: entry.style.getPropertyValue(property).replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim()
    }));
}

function declaredFor(css: ParsedCss, property: string, selectorPattern: RegExp): string | null {
  const found = declarations(css, property).find((declaration) => declaration.selectors.some((selector) => selectorPattern.test(selector)));
  return found ? found.value : null;
}

function border(css: ParsedCss, selector: string): string | null {
  const rule = css.rule(selector);
  return rule ? rule.get('border') : null;
}

describe('Search shell border', () => {
  it('is defined for light and dark in the shared search input stylesheet', () => {
    const shared = parseStylesheet('src/shared/search/search-input.css');
    expect(declarations(shared, LIGHT).length).toBeGreaterThan(0);
    expect(declarations(shared, DARK).length).toBeGreaterThan(0);
  });

  it('frames the New Tab search shell, its surfaces and its menus in both themes', () => {
    const page = parseStylesheet('src/newtab/styles/page.css');
    const light = /^:root$/;
    const dark = /^body\[data-theme="dark"\]/;
    expect(declaredFor(page, '--x-nt-search-shell-border', light)).toMatch(new RegExp(`var\\(${LIGHT}`));
    expect(declaredFor(page, '--x-nt-search-shell-border', dark)).toMatch(new RegExp(`var\\(${DARK}`));
    expect(declaredFor(page, '--x-nt-surface-border', light)).toMatch(new RegExp(`var\\(${LIGHT}`));
    expect(declaredFor(page, '--x-nt-surface-border', dark)).toMatch(new RegExp(`var\\(${DARK}`));
    [light, dark].forEach((theme) => {
      expect(declaredFor(page, '--x-extension-select-menu-border', theme)).toBe('var(--x-nt-surface-border)');
    });
    expect(border(page, '#_x_extension_newtab_root_2024_unique_')).toMatch(/var\(--x-nt-search-shell-border\)/);
    expect(border(parseStylesheet('src/newtab/styles/notices-and-suggestions.css'), '#_x_extension_newtab_suggestions_outline_2026_unique_'))
      .toMatch(/var\(--x-nt-search-shell-border\)/);
    expect(border(parseStylesheet('src/newtab/styles/bookmark-cascade.css'), '.x-nt-bookmark-cascade-level')).toMatch(/var\(--x-nt-surface-border\)/);
    expect(border(parseStylesheet('src/newtab/styles/corner-controls.css'), '.x-nt-feedback-popover')).toMatch(/var\(--x-nt-surface-border\)/);
    expect(parseStylesheet('src/shared/ui/custom-select.css').entries
      .some((entry) => /var\(\s*--x-extension-select-menu-border\s*,/.test(entry.style.getPropertyValue('border')))).toBe(true);
  });

  it('borders the onboarding overlay preview with the shared light border', () => {
    const preview = parseStylesheet('src/onboarding/styles/newtab-preview-sections.css');
    expect(declarations(preview, '--x-ov-border').some((declaration) => declaration.value.startsWith(`var(${LIGHT}`))).toBe(true);
  });

  it.each([[false, LIGHT], [true, DARK]])('borders the overlay shell with the shared token (dark system: %s)', async (darkSystem, name) => {
    const surface = await openSearchSurface('overlay', { darkSystem });
    const overlay = getElement(surface.root(), '#_x_extension_overlay_2024_unique_');
    expect(overlay.style.getPropertyValue('--x-ov-border').startsWith(`var(${name}`)).toBe(true);
  });

  it('borders the New Tab scope panel with the surface border', async () => {
    const surface = await openSearchSurface('newtab');
    await surface.openScopeMenu();
    const menu = getElement(document, '.x-lumno-search-input-mode__menu');
    expect(menu.style.getPropertyValue('border')).toMatch(/var\(--x-nt-surface-border/);
  });
});
