import { describe, expect, it } from 'vitest';
import { createBrowserFake, type BrowserFake } from '../../fakes/browser';
import { parseCss, parsePageCss, readStylesheet } from '../../fakes/css';
import { getElement } from '../../fakes/dom';
import { waitFor } from './boot';
import { dispatch, openSearchPage, pause } from './search-page';

// The search icon at the start of the New Tab search box opens the scope
// panel, like the overlay's, and shares a cursor-following bubble with the
// settings icon at the other end.
const ICON = '[data-search-scope-action="true"]';
const TOOLTIP = '#_x_extension_newtab_search_input_cursor_tooltip_2026_unique_';

const icon = () => getElement(document, ICON);
const prefix = () => document.querySelector('[data-search-input-mode-prefix]');
const scopeMenuOpen = () => prefix()?.getAttribute('data-menu-open') === 'true';
const scopeLabel = () => (prefix()?.querySelector('[data-search-input-mode-prefix-text]')?.textContent || '').trim();

function expectNoNavigation(browser: BrowserFake): void {
  expect(browser.search.query).not.toHaveBeenCalled();
  expect(browser.tabs.create).not.toHaveBeenCalled();
  expect(browser.tabs.update).not.toHaveBeenCalled();
}

async function hover(element: Element, at: MouseEventInit): Promise<void> {
  await dispatch(element, new MouseEvent('pointerover', { bubbles: true, ...at }));
  await dispatch(element, new MouseEvent('pointerenter', at));
  await dispatch(element, new MouseEvent('mouseover', { bubbles: true, ...at }));
  await dispatch(element, new MouseEvent('mouseenter', at));
}

describe('New Tab search scope button', () => {
  it('opens the scope panel on a click, keeping the query, then steps aside while a scope is active', async () => {
    const search = await openSearchPage(createBrowserFake());
    expect([icon().getAttribute('role'), icon().getAttribute('tabindex'), icon().getAttribute('aria-disabled')]).toEqual(['button', '0', 'false']);
    expect(icon().getAttribute('data-tooltip')).toBeTruthy();

    await search.type('cats');
    await dispatch(icon(), new MouseEvent('click', { bubbles: true, cancelable: true }));
    await waitFor(scopeMenuOpen, 'clicking the icon should open the scope panel');
    expect(search.input.value).toBe('cats');
    expect(scopeLabel()).toBeTruthy();
    expect([icon().getAttribute('aria-disabled'), icon().getAttribute('tabindex'), icon().getAttribute('data-tooltip')]).toEqual(['true', '-1', null]);

    await search.press('Escape');
    await pause(60);
    await dispatch(icon(), new MouseEvent('click', { bubbles: true, cancelable: true }));
    await pause(60);
    expect(scopeMenuOpen()).toBe(false);
  });

  it.each(['Enter', ' '])('opens the scope panel with %j on the focused icon without typing or searching', async (key) => {
    const browser = createBrowserFake();
    const search = await openSearchPage(browser);
    icon().focus();

    const event = await search.press(key, {}, icon());
    await waitFor(scopeMenuOpen, 'the key on the focused icon should open the scope panel');
    expect(search.input.value).toBe('');
    expect(event.defaultPrevented).toBe(true);
    expectNoNavigation(browser);
  });

  it('hands one bubble from the search icon to the settings icon, in New Tab colours', async () => {
    await openSearchPage(createBrowserFake());
    const settings = getElement(document, '.x-lumno-search-input__right-icon');
    const bubble = () => document.querySelector(TOOLTIP);
    expect(settings.getAttribute('data-tooltip')).toBeTruthy();

    await hover(icon(), { clientX: 20, clientY: 40 });
    await pause(200);
    expect((bubble()?.textContent || '').trim()).toBe(icon().getAttribute('data-tooltip'));
    await dispatch(icon(), new MouseEvent('pointerleave', { relatedTarget: settings, clientX: 600, clientY: 40 }));
    await dispatch(icon(), new MouseEvent('mouseleave', { relatedTarget: settings, clientX: 600, clientY: 40 }));
    await hover(settings, { clientX: 600, clientY: 40 });
    await pause(200);
    expect((bubble()?.textContent || '').trim()).toBe(settings.getAttribute('data-tooltip'));
    expect(settings.style.getPropertyValue('--x-ext-input-icon-hover-bg')).toMatch(/var\(--x-nt-settings-action-hover-bg/);
  });

  it.each([':root', 'body[data-theme="dark"]'])('defines the settings action hover colours for %s', (theme) => {
    const declared = parsePageCss('newtab.html').entries.filter((entry) => entry.selectors.includes(theme));
    expect(declared.some((entry) => entry.style.getPropertyValue('--x-nt-settings-action-hover-bg') &&
      entry.style.getPropertyValue('--x-nt-settings-action-hover-color'))).toBe(true);
  });

  it('gives the search action the settings action’s hit target and hover', () => {
    const input = parseCss(readStylesheet('src/shared/search/search-input.css'));
    const action = input.rule('.x-lumno-search-input__icon[data-search-scope-action="true"]');
    expect([action?.get('width'), action?.get('height'), action?.get('cursor')]).toEqual(['30px', '30px', 'pointer']);
    const disabled = input.rule('.x-lumno-search-input__icon[data-search-scope-action="true"][aria-disabled="true"]');
    expect([disabled?.get('pointer-events'), disabled?.get('cursor')]).toEqual(['none', 'default']);
    const hovered = input.rule('.x-lumno-search-input__icon[data-search-scope-action="true"][data-hover-active="true"]');
    const values = (hovered?.names() || []).map((name) => hovered?.get(name)).join(' ');
    expect(values).toMatch(/--x-ext-input-icon-hover-bg[\s\S]*--x-ext-input-icon-hover|--x-ext-input-icon-hover[\s\S]*--x-ext-input-icon-hover-bg/);
    expect(input.rule('.x-lumno-search-input__icon[data-search-scope-action="true"][data-hover-active="true"] .ri-icon')?.get('transform')).toBe('scale(1.06)');
  });
});
