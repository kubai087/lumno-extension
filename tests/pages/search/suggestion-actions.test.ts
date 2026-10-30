import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { getElements } from '../../fakes/dom';
import { parsePageCss, parseStylesheet, type CssRule, type ParsedCss } from '../../fakes/css';
import { searchResultPriority } from '../../../src/domain/settings/search';
import { openSearchSurface, suggestionOf, type SurfaceMessage } from './surfaces';

// A result row's actions on the right: a text action and utility icons that
// show on hover, laid out alike on both surfaces and their onboarding
// previews; and on the real New Tab, how the rows behave.

function rule(css: ParsedCss, selector: string): CssRule {
  const found = css.rule(selector);
  if (!found) throw new Error(`missing CSS rule: ${selector}`);
  return found;
}

const OVERLAY_SCOPE = ':is(#_x_extension_overlay_2024_unique_, #_x_extension_onboarding_overlay_demo_2026_unique_)';

describe('Result action styles', () => {
  it.each([
    ['New Tab', 'x-nt', '', 'x-nt-suggestion-action-tag'],
    ['Overlay', 'x-ov', `${OVERLAY_SCOPE} `, 'x-ov-action-tag']
  ])('%s collapses hidden utility slots and keeps the text action compact', (label, prefix, scope, actionTag) => {
    const css = label === 'New Tab' ? parsePageCss('newtab.html') : parseStylesheet('src/overlay/suggestions-view.css');
    const at = (selector: string) => rule(css, `${scope}${selector}`);
    expect(at(`.${prefix}-suggestion-right`).get('gap')).toBe('0');
    const slot = at(`.${prefix}-suggestion-utility-slot`);
    expect(slot.get('width')).toBe('0');
    expect(slot.get('transition')).toMatch(/width[\s\S]*margin-left[\s\S]*opacity/);
    const visible = at(`.${prefix}-suggestion-utility-slot[data-visible="true"]`);
    expect([visible.get('width'), visible.get('margin-left')]).toEqual(['22px', '3px']);
    expect(at(`.${prefix}-suggestion-utility-slot[data-visible="true"][data-leading="true"]`).get('margin-left')).toBe('10px');
    const tag = at(`.${actionTag}`);
    expect(['border', 'height', 'padding', 'border-radius'].map((name) => tag.get(name))).toEqual(['0', 'auto', '4px 8px', '8px']);
    const search = at(`.${actionTag}[data-action="search"]`);
    expect(['justify-content', 'gap', 'padding'].map((name) => search.get(name))).toEqual(['center', '0', '4px 8px']);
    const visit = at(`.${prefix}-suggestion-item[data-simple-mode="false"] .${prefix}-suggestion-visit-button`);
    expect(['background', 'border', 'padding', 'justify-content', 'text-align'].map((name) => visit.get(name)))
      .toEqual(['transparent', '0', '0', 'flex-end', 'right']);
  });

  it('lays out the onboarding previews the same way', () => {
    const css = parsePageCss('src/onboarding/onboarding.html');
    expect(rule(css, '.newtab-preview-viewport .x-nt-suggestion-right').get('gap')).toBe('0');
    const visible = rule(css, '.newtab-preview-viewport .x-nt-suggestion-utility-slot[data-visible="true"]');
    expect([visible.get('width'), visible.get('margin-left')]).toEqual(['22px', '3px']);
    expect(rule(css, '.newtab-preview-viewport .x-nt-suggestion-utility-slot[data-visible="true"][data-leading="true"]').get('margin-left')).toBe('10px');
    ['.newtab-preview-viewport .x-nt-suggestion-action-tag', '.site-search-demo-result .x-ov-action-tag'].forEach((selector) => {
      const tag = rule(css, selector);
      expect(['border', 'height', 'padding', 'border-radius'].map((name) => tag.get(name))).toEqual(['0', 'auto', '4px 8px', '8px']);
    });
  });
});

const LOCAL = [
  { type: 'history', title: 'Cats history', url: 'https://cats.test/' },
  { type: 'history', title: 'Dev app', url: 'http://localhost:3000/app' }
];
const TABS = [{ id: 7, windowId: 1, title: 'Dev app', url: 'http://localhost:3000/app' }];

function openNewtab(priority?: string) {
  return openSearchSurface('newtab', {
    settings: priority ? { [searchResultPriority.key]: priority } : {},
    respond(message: SurfaceMessage) {
      if (message.action === 'getSearchSuggestions') return { suggestions: LOCAL };
      if (message.action === 'getTabsForOverlay') return { tabs: TABS };
      if (message.action === 'getSearchEngineSuggestions') {
        const local = Array.isArray(message.localSuggestions) ? message.localSuggestions : [];
        return {
          suggestions: local.concat(['cats a', 'cats b'].map((title) => (
            { type: 'googleSuggest', title, url: `https://www.google.com/search?q=${encodeURIComponent(title)}` }
          ))),
          hasRemoteSuggestions: true
        };
      }
      return undefined;
    }
  });
}

describe('New Tab result actions', () => {
  it('reveals the utility actions when the pointer moves onto a row', async () => {
    const surface = await openNewtab();
    await surface.type('cats app');
    await surface.settle(150);
    const row = surface.suggestions()[0] || document.body;
    const slots = () => getElements(row, '.x-nt-suggestion-utility-slot').map((slot) => slot.getAttribute('data-visible'));
    expect(slots().length).toBeGreaterThan(0);
    expect(slots().every((visible) => visible !== 'true')).toBe(true);
    act(() => {
      row.dispatchEvent(new MouseEvent('mouseenter'));
      row.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });
    await surface.settle(30);
    expect(slots().every((visible) => visible === 'true')).toBe(true);
  });

  it('leads with the search rows when search comes first, and switches to a matched open tab wherever it sits', async () => {
    const surface = await openNewtab('search');
    await surface.type('cats app');
    await surface.settle(250);
    const types = surface.suggestions().map((row) => suggestionOf(row).type);
    const firstLocal = types.indexOf('history');
    expect(firstLocal).toBeGreaterThan(0);
    expect(types.slice(0, firstLocal).every((type) => type === 'newtab' || type === 'googleSuggest')).toBe(true);
    const matched = surface.suggestions().findIndex((row) => suggestionOf(row)._xMatchedTabId === 7);
    expect(matched).toBeGreaterThan(0);
    while (surface.selectedIndex() < matched) {
      surface.press('ArrowDown');
      await surface.settle(20);
    }
    const before = surface.messages.length;
    surface.press('Enter');
    await surface.settle(100);
    expect(surface.messages.slice(before).some((message) => message.action === 'switchToTab' && message.tabId === 7)).toBe(true);
  });
});
