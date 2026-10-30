import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { bootOverlayPage, bundledSiteSearchProviders, click, settle, suggestionOf, waitFor } from './boot';
import { getElement, required } from '../../fakes/dom';
import { parseCss, readStylesheet } from '../../fakes/css';

// The search icon at the start of the overlay's input opens the search scope
// menu, by pointer or keyboard, and steps aside while a scope tag is active;
// the first tagged result moves in under the open menu. The current-label
// slot itself is covered by src/shared/react/search-input-mode.test.ts.

const ENTER_ANIMATION = '_x_ov_scope_result_enter_2026_unique_';

async function openWithProviders() {
  const page = await bootOverlayPage({ stylesheetsLoad: 5 });
  const root = await page.open({ siteSearchProviders: bundledSiteSearchProviders() });
  const icon = getElement(root, '[data-search-scope-action="true"]');
  const menuOpen = () => getElement(root, '[data-search-input-mode-prefix]').getAttribute('data-menu-open') === 'true';
  return { page, root, icon, menuOpen };
}

function keyAt(target: Element, key: string): void {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  });
}

function animationEnd(target: Element, animationName: string): void {
  act(() => {
    target.dispatchEvent(new AnimationEvent('animationend', { bubbles: true, animationName }));
  });
}

describe('Overlay search scope', () => {
  it('starts the input with a focusable scope button that explains itself', async () => {
    const { icon } = await openWithProviders();
    expect([icon.getAttribute('role'), icon.getAttribute('tabindex'), icon.getAttribute('aria-disabled'), icon.style.left])
      .toEqual(['button', '0', 'false', '13px']);
    expect(icon.getAttribute('data-tooltip')).toBeTruthy();
  });

  it('opens the scope menu on a click, keeps the query, and steps aside while a scope tag is active', async () => {
    const { page, icon, menuOpen } = await openWithProviders();
    await page.type('cats');
    click(icon);
    await waitFor(menuOpen, 'clicking the icon did not open the scope menu');
    expect(page.input()?.value).toBe('cats');
    expect([icon.getAttribute('aria-disabled'), icon.getAttribute('tabindex'), icon.getAttribute('data-tooltip')]).toEqual(['true', '-1', null]);

    page.press('Escape');
    await settle(50);
    click(icon);
    await settle(50);
    expect(menuOpen()).toBe(false);
  });

  it('opens the scope menu with Enter or Space on the button, and not with other keys', async () => {
    const enter = await openWithProviders();
    keyAt(enter.icon, 'a');
    await settle(50);
    expect(enter.menuOpen()).toBe(false);
    keyAt(enter.icon, 'Enter');
    await waitFor(enter.menuOpen, 'Enter on the icon did not open the scope menu');
  });

  it('opens the scope menu with Space on the button', async () => {
    const { icon, menuOpen } = await openWithProviders();
    keyAt(icon, ' ');
    await waitFor(menuOpen, 'Space on the icon did not open the scope menu');
  });

  it('moves the first tagged result in under the open menu, once', async () => {
    const { page, root, icon } = await openWithProviders();
    const results = getElement(root, '.x-ov-suggestions-container');
    click(icon);
    await waitFor(() => root.querySelector('[data-mode-id="provider:yt"]'), 'the scope menu did not open');
    expect(results.getAttribute('data-scope-result-enter')).toBeNull();

    await page.type('cats');
    await waitFor(() => page.suggestions().some((row) => suggestionOf(row).type === 'siteSearch'), 'the tagged result did not render');
    expect(results.getAttribute('data-scope-result-enter')).toBe('run');
    animationEnd(results, 'something-else');
    expect(results.getAttribute('data-scope-result-enter')).toBe('run');
    animationEnd(results, ENTER_ANIMATION);
    expect(results.getAttribute('data-scope-result-enter')).toBe('done');

    page.press('Escape');
    await settle(30);
    await page.type('dogs');
    await settle(80);
    expect(results.getAttribute('data-scope-result-enter')).not.toBe('run');
  });

  it('plays the tagged result entrance with the lower panel timing, and not under reduced motion', () => {
    const css = parseCss(readStylesheet('src/overlay/suggestions-view.css'));
    const running = required(css.entries.find((entry) => entry.conditions.length === 0 &&
      entry.selectors.some((selector) => selector.includes('[data-scope-result-enter="run"]')) &&
      entry.style.getPropertyValue('animation')), 'the running entrance rule');
    expect(running.style.getPropertyValue('animation')).toMatch(new RegExp(`${ENTER_ANIMATION} 180ms ease-in-out both`));
    const frames = required(css.keyframes(ENTER_ANIMATION), 'the entrance keyframes');
    expect(frames['0%'].getPropertyValue('transform')).toMatch(/translateY\(8px\)/);
    expect(frames['100%'].getPropertyValue('transform')).toMatch(/translateY\(0\)/);
    const reduced = css.entries.find((entry) => entry.conditions.some((condition) => /prefers-reduced-motion/.test(condition)) &&
      entry.selectors.some((selector) => selector.includes('[data-scope-result-enter="run"]')));
    expect(reduced && [reduced.style.getPropertyValue('animation'), reduced.style.getPropertyValue('transform')]).toEqual(['none', 'none']);
  });

  it('shares the settings action hover tokens with New Tab', () => {
    const css = parseCss(readStylesheet('src/shared/search/search-input.css'));
    const hover = required(css.entries.find((entry) => entry.selectors.some((selector) =>
      selector.includes('.x-lumno-search-input__icon[data-search-scope-action="true"][data-hover-active="true"]'))), 'the hover rule');
    expect(hover.style.getPropertyValue('background') || hover.style.getPropertyValue('background-color')).toMatch(/var\(--x-ext-input-icon-hover-bg/);
  });
});
