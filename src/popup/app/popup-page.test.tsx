import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import popupHtml from '../popup.html?raw';
import enMessages from '../../../_locales/en/messages.json';
import { runPageBundle } from '../../../tests/react/page-bundles';
import { createBrowserFake, type BrowserFake } from '../../../tests/react/browser-fake';
import { getTags } from '../../../tests/react/dom';

// Boots the real toolbar popup (its markup and its entries) against an
// in-memory browser, on a web page as the active tab.

async function settle(passes = 10): Promise<void> {
  await act(async () => {
    for (let pass = 0; pass < passes; pass += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
}

async function bootPopup(): Promise<BrowserFake> {
  const parsed = new DOMParser().parseFromString(popupHtml, 'text/html');
  Array.from(parsed.body.children)
    .filter((node) => node.tagName !== 'SCRIPT')
    .forEach((node) => document.body.appendChild(document.importNode(node, true)));
  const browser = createBrowserFake({
    tabs: [{ id: 7, windowId: 1, index: 0, url: 'https://page.example/article', title: 'An article', active: true, pinned: false }]
  });
  vi.stubGlobal('chrome', browser);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {}
  }));
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => enMessages })));
  vi.resetModules();
  await runPageBundle('popup-preload');
  await act(async () => {
    await runPageBundle('popup');
  });
  await settle();
  return browser;
}

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

const THEME_MODE_KEY = '_x_extension_theme_mode_2024_unique_';

describe('Toolbar popup', () => {
  it('draws the active page with its actions and quick settings', async () => {
    await bootPopup();
    const text = document.body.textContent || '';

    expect(text).toContain('An article');
    expect(text).toContain('page.example');
    ['Open command bar', 'Copy link', 'Add shortcut', 'Pin to Recent', 'Quick settings'].forEach((label) => {
      expect(text).toContain(label);
    });
  });

  it('saves the theme picked in its quick settings', async () => {
    const browser = await bootPopup();
    const dark = getTags(document, 'button', 'button').find((button) => (button.textContent || '').trim() === 'Dark');
    if (!dark) {
      throw new Error('Expected the Dark theme button');
    }

    await act(async () => dark.click());
    await settle();

    const stored = { ...browser.storage.sync.values, ...browser.storage.local.values };
    expect(stored[THEME_MODE_KEY]).toBe('dark');
  });
});
