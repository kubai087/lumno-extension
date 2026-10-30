import { afterEach, describe, expect, it, vi } from 'vitest';
import { readPageSource } from '../../fakes/css';
import { createBrowserFake } from '../../fakes/browser';
import { expectElement } from '../../fakes/dom';
import { runPageBundle } from '../page-bundles';

// The New Tab's head paints its icon and wallpaper before the page's own
// scripts and styles load.
const page = new DOMParser().parseFromString(readPageSource('newtab.html'), 'text/html');

function precedes(first: Element, second: Element): boolean {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}

afterEach(() => {
  Array.from(document.documentElement.attributes).forEach((attribute) => document.documentElement.removeAttribute(attribute.name));
  localStorage.clear();
  Reflect.deleteProperty(globalThis, '__lumnoBoot');
  vi.unstubAllGlobals();
});

describe('the New Tab head', () => {
  const favicon = expectElement(page.querySelector('link[data-lumno-newtab-favicon="true"]'), 'the static favicon');
  const preload = expectElement(page.querySelector('script[src="../../build/newtab-preload.js"]'), 'the New Tab preload');

  it('names the monochrome favicon before the title can show the extension icon', () => {
    expect(favicon.getAttribute('href')).toBe('../../assets/images/lumno-newtab-favicon.svg');
    expect(precedes(favicon, expectElement(page.querySelector('title'), 'the title'))).toBe(true);
  });

  it('runs its preload after the favicon and before any stylesheet', () => {
    expect(precedes(favicon, preload)).toBe(true);
    expect(precedes(preload, expectElement(page.querySelector('link[rel="stylesheet"]'), 'the first stylesheet'))).toBe(true);
  });

  it('starts the wallpaper effect before the New Tab content boots', () => {
    const effectPreload = expectElement(page.querySelector('script[src="../../build/wallpaper-effect-preload.js"]'), 'the effect preload');
    const root = expectElement(page.getElementById('_x_extension_newtab_root_2024_unique_'), 'the New Tab root');
    expect(precedes(effectPreload, root)).toBe(true);
  });

  it('paints the cached wallpaper from its preload', async () => {
    vi.stubGlobal('chrome', createBrowserFake());
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }));
    localStorage.setItem('_x_extension_newtab_wallpaper_preload_2026_unique_', JSON.stringify({
      version: 4,
      mode: 'light',
      themeMode: 'light',
      overlayStops: { light: { top: 0, mid: 0, bottom: 0 }, dark: { top: 0, mid: 0, bottom: 0 } },
      wallpapers: { light: { id: 'white-shanshui', path: 'assets/wallpapers/lumno-newtab-white-shanshui.webp' }, dark: null }
    }));
    vi.resetModules();

    await runPageBundle('newtab-preload');

    expect(document.documentElement.style.getPropertyValue('--x-nt-wallpaper-image')).toContain('lumno-newtab-white-shanshui.webp');
  });
});
