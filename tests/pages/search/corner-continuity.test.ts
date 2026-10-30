import { describe, expect, it } from 'vitest';
import { getElement } from '../../fakes/dom';
import { parsePageCss, parseStylesheet, type ParsedCss } from '../../fakes/css';
import { openSearchSurface } from './surfaces';

// The search shells are rounded rectangles with continuous (superellipse)
// corners, and the radii nest: each inner surface's radius is the outer one
// minus the space between them. Read from the stylesheets as the browser
// parses them, and from the live overlay where its styles are inline.

const CONTINUOUS = 'superellipse(1.25)';

// Each selector's corner-shape, as its last declaring rule (in any @supports
// block) leaves it, with " !important" when it has that priority.
function cornerShapes(css: ParsedCss): Map<string, string> {
  const shapes = new Map<string, string>();
  css.entries.forEach((entry) => {
    const value = entry.style.getPropertyValue('corner-shape');
    if (!value) return;
    const priority = entry.style.getPropertyPriority('corner-shape');
    entry.selectors.forEach((selector) => shapes.set(selector, priority ? `${value} !${priority}` : value));
  });
  return shapes;
}

// A custom property's value where it is first declared.
function token(css: ParsedCss, name: string): string {
  const entry = css.entries.find((item) => item.style.getPropertyValue(name));
  if (!entry) throw new Error(`missing ${name}`);
  return entry.style.getPropertyValue(name).replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();
}

function px(css: ParsedCss, name: string): number {
  const match = /^(\d+)px$/.exec(token(css, name));
  if (!match) throw new Error(`${name} should be a pixel length`);
  return Number(match[1]);
}

function ruleValue(css: ParsedCss, selector: string, property: string): string | null {
  const rule = css.rule(selector);
  return rule ? rule.get(property) : null;
}

describe('Search corner continuity', () => {
  it('nests the New Tab radii inside a rounded-rectangle shell with continuous corners', () => {
    const css = parsePageCss('newtab.html');
    const outer = px(css, '--x-nt-search-shell-radius');
    const border = px(css, '--x-nt-search-shell-border-width');
    const padding = px(css, '--x-nt-search-shell-padding');
    const inset = px(css, '--x-nt-search-results-padding-inline');
    expect(outer).toBe(26);
    expect(px(css, '--x-nt-search-resting-radius')).toBe(outer);
    expect(outer).toBeLessThan(56 / 2);
    expect(outer - border - padding).toBe(21);
    expect(outer - border - padding - inset).toBe(13);
    expect(token(css, '--x-nt-search-content-radius')).toBe('calc(var(--x-nt-search-shell-radius) - var(--x-nt-search-content-inset))');
    expect(token(css, '--x-nt-search-result-radius')).toBe('calc(var(--x-nt-search-content-radius) - var(--x-nt-search-results-padding-inline))');
    expect(token(css, '--x-nt-search-resting-content-radius')).toBe('calc(var(--x-nt-search-resting-radius) - var(--x-nt-search-content-inset))');
    expect(ruleValue(css, 'body[data-nt-suggestions-open="true"] #_x_extension_newtab_search_layer_2024_unique_', 'border-radius'))
      .toBe('var(--x-nt-search-resting-content-radius, 21px) var(--x-nt-search-resting-content-radius, 21px) 0 0');
    ['#_x_extension_newtab_suggestions_surface_2026_unique_', '#_x_extension_newtab_suggestions_outline_2026_unique_'].forEach((selector) => {
      expect(ruleValue(css, selector, 'border-radius')).toBe(
        'var(--x-nt-search-resting-radius, 26px) var(--x-nt-search-resting-radius, 26px) var(--x-nt-search-shell-radius, 26px) var(--x-nt-search-shell-radius, 26px)');
    });
    expect(ruleValue(css, '.x-nt-suggestion-item', 'border-radius')).toBe('var(--x-nt-search-result-radius, 13px)');
    const shapes = cornerShapes(css);
    [
      '#_x_extension_newtab_root_2024_unique_',
      '#_x_extension_newtab_search_layer_2024_unique_',
      '#_x_extension_newtab_suggestions_surface_2026_unique_',
      '#_x_extension_newtab_suggestions_outline_2026_unique_',
      '#_x_extension_newtab_suggestions_container_2024_unique_',
      '.x-nt-suggestion-item'
    ].forEach((selector) => expect([selector, shapes.get(selector)]).toEqual([selector, CONTINUOUS]));
    expect(shapes.get('.x-nt-suggestion-visit-button')).toBe('round');
  });

  it('nests the overlay radii the same way, in its stylesheet and on the live panel', async () => {
    const css = parseStylesheet('src/overlay/suggestions-view.css');
    const border = px(css, '--x-ov-panel-border-width');
    const inset = px(css, '--x-ov-results-inset');
    expect(token(css, '--x-ov-content-radius')).toBe('calc(var(--x-ov-panel-radius, 26px) - var(--x-ov-panel-border-width))');
    expect(token(css, '--x-ov-result-radius')).toBe('calc(var(--x-ov-content-radius) - var(--x-ov-results-inset))');
    const scope = ':is(#_x_extension_overlay_2024_unique_, #_x_extension_onboarding_overlay_demo_2026_unique_)';
    expect(ruleValue(css, `${scope} .x-ov-suggestion-item`, 'border-radius')).toBe('var(--x-ov-result-radius, 13px)');
    const shapes = cornerShapes(css);
    ['.x-ov-suggestions-container', '.x-ov-close-other-tabs', '.x-ov-suggestion-item', '.x-ov-action-tag'].forEach((part) => {
      expect([part, shapes.get(`${scope} ${part}`)]).toEqual([part, CONTINUOUS]);
    });
    expect(shapes.get(`${scope} .x-ov-suggestion-visit-button`)).toBe('round');

    const surface = await openSearchSurface('overlay');
    const panel = getElement(surface.root(), '#_x_extension_overlay_2024_unique_');
    const radius = Number((/(\d+)px\)$/.exec(panel.style.getPropertyValue('border-radius')) || [])[1]);
    // The single-row overlay (a 56px input inside its border) must read as a
    // rounded rectangle, not a capsule, with the same radius as New Tab.
    expect(radius).toBe(26);
    expect(radius).toBeLessThan((56 + border * 2) / 2 - 2);
    expect(radius - border).toBe(25);
    expect(radius - border - inset).toBe(13);
    const input = getElement(surface.root(), '#_x_extension_input_container_2024_unique_');
    expect(input.style.getPropertyValue('border-radius')).toMatch(/^var\(--x-ov-content-radius, 25px\)/);
    // Its base styles reset with `all: unset`, so the shape travels inline.
    expect(input.style.getPropertyValue('corner-shape')).toBe(CONTINUOUS);
  });

  it('leaves the shared input its own shape and gives its buttons and scope menu continuous corners', () => {
    const css = parseStylesheet('src/shared/search/search-input.css');
    expect(css.entries.some((entry) => entry.style.getPropertyValue('border-radius').replace(/\s+/g, ' ') ===
      'var(--x-ext-search-input-corners, 28px 28px 0 0)')).toBe(true);
    const shapes = cornerShapes(css);
    expect(shapes.get('.x-lumno-search-input')).toBeUndefined();
    expect(shapes.get('.x-lumno-search-input__container')).toBeUndefined();
    expect(shapes.get('.x-lumno-search-input__right-icon')).toBe(`${CONTINUOUS} !important`);
    expect(shapes.get('.x-lumno-search-input__icon[data-search-scope-action="true"]')).toBe(`${CONTINUOUS} !important`);
    expect(shapes.get('.x-lumno-search-input-mode__menu')).toBe(CONTINUOUS);
    // Mode menu parts reset with `all: unset !important`, so their shape
    // comes last and matches that priority.
    const last = css.entries[css.entries.length - 1];
    expect([last?.selectors, last?.style.getPropertyValue('corner-shape'), last?.style.getPropertyPriority('corner-shape')])
      .toEqual([['.x-lumno-search-input-mode__menu-item', '.x-lumno-search-input-mode__menu-footer-key'], CONTINUOUS, 'important']);
  });

  it('mirrors the real surfaces in the onboarding previews', () => {
    const css = parsePageCss('src/onboarding/onboarding.html');
    expect(ruleValue(css, '.newtab-preview-viewport', '--x-nt-search-shell-radius')).toBe('26px');
    expect(ruleValue(css, '.newtab-preview-viewport', '--x-nt-search-content-radius')).toMatch(/^calc\(/);
    expect(ruleValue(css, '.newtab-preview-viewport', '--x-nt-search-result-radius')).toMatch(/^calc\(/);
    const shapes = cornerShapes(css);
    [
      '.lumno-overlay-panel',
      '.site-search-demo-card',
      '.newtab-preview-viewport #_x_extension_newtab_root_2024_unique_',
      '.site-search-demo-result',
      '.newtab-preview-viewport #_x_extension_newtab_suggestions_surface_2026_unique_'
    ].forEach((selector) => expect([selector, shapes.get(selector)]).toEqual([selector, CONTINUOUS]));
  });
});
