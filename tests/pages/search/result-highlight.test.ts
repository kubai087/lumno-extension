import { describe, expect, it } from 'vitest';
import { getElement } from '../../fakes/dom';
import { parsePageCss, parseStylesheet, type CssRule, type ParsedCss } from '../../fakes/css';
import { SURFACES, openSearchSurface, type SurfaceMessage } from './surfaces';

// How the highlighted search result looks: a background, not an outline or
// shadow, with a white tile behind a dark-theme favicon; and on the live
// surfaces, the row state the styles key off.

function rule(css: ParsedCss, selector: string): CssRule {
  const found = css.rule(selector);
  if (!found) throw new Error(`missing CSS rule: ${selector}`);
  return found;
}

const FAVICON = 'data:image/png;base64,iVBORw0KGgo=';
const RESULTS = Array.from({ length: 3 }, (_, index) => ({
  type: 'history', title: `Result ${index}`, url: `https://r${index}.test/`, favicon: index === 0 ? FAVICON : ''
}));

describe('Highlighted result styles', () => {
  const newtab = parsePageCss('newtab.html');
  const overlay = parseStylesheet('src/overlay/suggestions-view.css');
  const overlayScope = ':is(#_x_extension_overlay_2024_unique_, #_x_extension_onboarding_overlay_demo_2026_unique_)';
  const overlayDark = ':is(#_x_extension_overlay_2024_unique_[data-theme="dark"], #_x_extension_onboarding_overlay_demo_2026_unique_[data-theme="dark"])';

  it('marks the New Tab row with a background only, its rows reserving their border and animating the background', () => {
    const active = rule(newtab, '.x-nt-suggestion-item[data-row-state="active"]');
    expect(active.get('background')).toMatch(/var\(--x-nt-suggestion-active-bg/);
    ['border', 'border-color', 'box-shadow'].forEach((property) => expect([property, active.has(property)]).toEqual([property, false]));
    const row = rule(newtab, '.x-nt-suggestion-item');
    expect(row.get('border')).toBe('1px solid transparent');
    expect(row.get('transition')).toMatch(/^background-color (0\.2s|200ms) ease$/);
  });

  it('gives overlay rows their background from the row token, with no shadow', () => {
    const row = rule(overlay, `${overlayScope} .x-ov-suggestion-item`);
    expect(row.get('background')).toMatch(/var\(--x-ov-suggestion-row-bg/);
    expect(row.get('border')).toBe('1px solid transparent');
    expect(row.has('box-shadow')).toBe(false);
    expect(row.get('transition')).toMatch(/^background-color (0\.2s|200ms) ease$/);
  });

  it('puts a highlighted dark-theme favicon on a white tile on both surfaces', () => {
    const tile = '.x-ov-suggestion-item[data-row-state="active"] .x-ov-suggestion-icon-slot[data-favicon="true"]';
    expect(rule(overlay, `${overlayDark} ${tile}`).get('background-color')).toBe('#FFFFFF');
    expect(rule(newtab, 'body[data-theme="dark"] .x-nt-suggestion-item[data-row-state="active"] .x-nt-suggestion-icon-slot[data-favicon="true"]')
      .get('background-color')).toBe('#FFFFFF');
  });
});

describe.each(SURFACES)('%s highlighted result', (name) => {
  it('marks the highlighted and last rows, emphasises matches more there and follows the highlight', async () => {
    const surface = await openSearchSurface(name, {
      respond(message: SurfaceMessage) {
        if (message.action === 'getSearchSuggestions') return { suggestions: RESULTS };
        if (message.action === 'getSearchEngineSuggestions') {
          const local = Array.isArray(message.localSuggestions) ? message.localSuggestions : [];
          return new Promise((resolve) => setTimeout(() => resolve({
            suggestions: local.concat([{ type: 'googleSuggest', title: 'result x', url: 'https://www.google.com/search?q=x' }]),
            hasRemoteSuggestions: true
          }), 150));
        }
        return undefined;
      }
    });
    await surface.type('result');
    await surface.settle(300);
    const rows = surface.suggestions();
    const markBg = (index: number) => rows[index]?.style.getPropertyValue('--x-ext-mark-bg');
    expect(rows.map((row) => row.getAttribute('data-last'))).toEqual(rows.map((_row, index) => String(index === rows.length - 1)));
    expect(rows.map((row) => row.getAttribute('data-row-state'))).toEqual(['active', ...rows.slice(1).map(() => null)]);
    expect(markBg(0)).not.toBe(markBg(1));
    expect(rows.slice(0, 2).map((row) => getElement(row, '[data-favicon]').getAttribute('data-favicon'))).toEqual(['true', 'false']);

    surface.press('ArrowDown');
    await surface.settle(40);
    expect(rows.slice(0, 2).map((row) => row.getAttribute('data-row-state'))).toEqual([null, 'active']);
    expect(markBg(0)).toBe(markBg(2));
  });
});
