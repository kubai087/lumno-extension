import { statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import optionsHtml from '../../../src/options/options.html?raw';
import { themeMode } from '../../../src/domain/settings/appearance';
import { optionsThemePreload } from '../../../src/domain/settings/page-cache';
import { createBrowserFake } from '../../fakes/browser';
import { parsePageCss, readPageSource, REPO_ROOT } from '../../fakes/css';
import { getElement, getElements } from '../../fakes/dom';
import { runPageBundle } from '../page-bundles';

// What the Options page paints before its page script runs: the preload in
// <head> sets the theme, the background and the linked tab from the cache
// and the stored theme.

const BACKGROUND_PRELOAD = '_x_extension_options_background_preload_2026_unique_';
const shipped = new DOMParser().parseFromString(optionsHtml, 'text/html');

function activeValues(selector: string, attribute: string): Array<[string | undefined, string | undefined]> {
  return getElements(document, selector).map((element) => [element.getAttribute(attribute) ?? undefined, element.dataset.active]);
}

// The shipped markup in this document, its <head> meta tags included.
function loadMarkup(): void {
  shipped.head.querySelectorAll('meta').forEach((meta) => document.head.appendChild(document.importNode(meta, true)));
  Array.from(shipped.body.children)
    .filter((node) => node.tagName !== 'SCRIPT')
    .forEach((node) => document.body.appendChild(document.importNode(node, true)));
}

afterEach(() => {
  document.head.replaceChildren();
  ['data-theme-ready', 'data-options-preload-theme', 'data-options-theme-mode', 'data-options-initial-tab', 'style']
    .forEach((name) => document.documentElement.removeAttribute(name));
  document.body.removeAttribute('data-theme');
  localStorage.clear();
  history.replaceState(null, '', '#');
  vi.unstubAllGlobals();
});

describe('Options cold start', () => {
  it('runs its preload before any render-blocking stylesheet', () => {
    const first = shipped.head.querySelector('script, link[rel="stylesheet"]');
    expect(first?.tagName).toBe('SCRIPT');
    expect(first?.getAttribute('src')).toBe('../../build/options-preload.js');
  });

  it('paints the General tab from the markup alone', () => {
    const button = shipped.querySelector('._x_extension_settings_tab_button_2024_unique_[data-active="true"]');
    const content = shipped.querySelector('._x_extension_settings_content_2024_unique_[data-active="true"]');
    expect(button?.getAttribute('data-tab')).toBe('general');
    expect(content?.getAttribute('data-content')).toBe('general');
  });

  it('draws its background from the small WebP images', () => {
    const css = parsePageCss('src/options/options.html');
    expect(css.rule('.settings-bg-light')?.get('background')).toContain('assets/images/settings-bg-light.webp');
    expect(css.rule('body[data-theme="dark"] .settings-bg-light')?.get('background-image'))
      .toContain('assets/images/settings-bg-dark.webp');
    expect(readPageSource('src/options/options.html')).not.toMatch(/settings-bg-(?:light|dark)\.png/);
    ['light', 'dark'].forEach((theme) => {
      expect(statSync(join(REPO_ROOT, `assets/images/settings-bg-${theme}.webp`)).size).toBeLessThan(1024 * 1024);
    });
  });

  it('paints the stored theme, opens the linked tab and preloads the matching background', async () => {
    loadMarkup();
    history.replaceState(null, '', '#shortcuts:site-search-ai');
    vi.stubGlobal('chrome', createBrowserFake({ sync: { [themeMode.key]: 'dark' } }));
    const appended: Array<[string, string]> = [];
    const appendChild = document.head.appendChild.bind(document.head);
    vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      if (node instanceof HTMLLinkElement) appended.push([node.id, node.href]);
      return appendChild(node);
    });
    vi.resetModules();
    await runPageBundle('options-preload');
    const root = document.documentElement;
    await vi.waitFor(() => {
      expect(root.getAttribute('data-options-preload-theme')).toBe('dark');
    });
    expect(root.getAttribute('data-theme-ready')).toBe('true');
    expect(root.getAttribute('data-options-theme-mode')).toBe('dark');
    expect(document.body.getAttribute('data-theme')).toBe('dark');
    expect(getElement(document, '#_x_extension_settings_panel_2024_unique_').dataset.theme).toBe('dark');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#111111');
    expect(root.getAttribute('data-options-initial-tab')).toBe('shortcuts');
    const tabs = ['general', 'account', 'appearance', 'shortcuts', 'blacklist', 'labs'];
    const expected = tabs.map((tab): [string, string] => [tab, tab === 'shortcuts' ? 'true' : 'false']);
    expect(activeValues('._x_extension_settings_tab_button_2024_unique_[data-tab]', 'data-tab')).toEqual(expected);
    expect(activeValues('._x_extension_settings_content_2024_unique_[data-content]', 'data-content')).toEqual(expected);
    // The stored preference refreshes the cache the next load paints from.
    expect(localStorage.getItem(optionsThemePreload.key)).toBe('dark');
    // The background link goes in with its address set, for the cached or
    // system theme, and follows the stored one.
    expect(appended.find(([id]) => id === BACKGROUND_PRELOAD)?.[1])
      .toBe('chrome-extension://lumno/assets/images/settings-bg-light.webp');
    const preload = document.getElementById(BACKGROUND_PRELOAD);
    expect(preload instanceof HTMLLinkElement && [preload.rel, preload.as, preload.fetchPriority, preload.href]).toEqual([
      'preload', 'image', 'high', 'chrome-extension://lumno/assets/images/settings-bg-dark.webp'
    ]);
  });

  it('paints the cached theme while there is no stored one to read', async () => {
    loadMarkup();
    localStorage.setItem(optionsThemePreload.key, 'dark');
    vi.stubGlobal('chrome', { runtime: { getURL: (path: string) => `chrome-extension://lumno/${path}` } });
    vi.resetModules();
    await runPageBundle('options-preload');
    expect(document.documentElement.getAttribute('data-options-preload-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-options-initial-tab')).toBe('general');
  });
});
