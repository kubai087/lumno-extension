import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import newtabHtml from '../../../newtab.html?raw';
import enMessages from '../../../_locales/en/messages.json';
import { runPageBundle } from '../page-bundles';
import { createBrowserFake, type BrowserFake } from '../../fakes/browser';
import { createShortcutStoragePlan } from '../../../src/domain/shortcuts/storage-plan';
import { getElementById, getElements, getTag } from '../../fakes/dom';

// Boots the real New Tab (its markup and the entries it loads, in order)
// against an in-memory browser, and checks the page by what it shows and
// writes: it gets ready, draws the stored shortcuts, the bookmarks bar and
// the recent sites, follows a setting changed elsewhere and searches.

async function settle(passes = 8): Promise<void> {
  await act(async () => {
    for (let pass = 0; pass < passes; pass += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
}

async function waitFor(check: () => boolean, message: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (check()) return;
    await settle(2);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }
  throw new Error(message);
}

async function bootNewtab(browser: BrowserFake): Promise<void> {
  const parsed = new DOMParser().parseFromString(newtabHtml, 'text/html');
  Array.from(parsed.body.attributes).forEach((attribute) => document.body.setAttribute(attribute.name, attribute.value));
  Array.from(parsed.body.children)
    .filter((node) => node.tagName !== 'SCRIPT')
    .forEach((node) => document.body.appendChild(document.importNode(node, true)));
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
  await runPageBundle('newtab-preload');
  await runPageBundle('wallpaper-effect-preload');
  await act(async () => {
    await runPageBundle('newtab');
  });
  await settle();
}

afterEach(() => {
  document.body.replaceChildren();
  Array.from(document.body.attributes).forEach((attribute) => document.body.removeAttribute(attribute.name));
  vi.unstubAllGlobals();
});

const SHORTCUTS_SECTION_ID = '_x_extension_newtab_shortcuts_2026_unique_';
const SEARCH_INPUT_ID = '_x_extension_newtab_search_input_2024_unique_';
const SHORTCUTS_VISIBLE_KEY = '_x_extension_newtab_shortcuts_visible_2026_unique_';

// A browser with one stored shortcut, one bookmark on the bar, one site in
// history, and the New Tab as the window's active tab.
function createStockedBrowser(): BrowserFake {
  const shortcuts = createShortcutStoragePlan({ items: [{ id: 's1', title: 'Example', url: 'https://example.com/' }] });
  return createBrowserFake({
    sync: shortcuts.payload,
    bookmarksBar: [{ id: '10', title: 'Docs', url: 'https://docs.example/' }],
    history: [{ url: 'https://news.example/', title: 'News', lastVisitTime: Date.now() - 1000, visitCount: 3 }],
    tabs: [{ id: 1, windowId: 1, index: 0, url: 'chrome://newtab/', title: 'New Tab', active: true, pinned: false }]
  });
}

async function bootReadyNewtab(browser: BrowserFake): Promise<void> {
  await bootNewtab(browser);
  await waitFor(() => document.body.getAttribute('data-nt-ready') === '1', 'New Tab did not mark itself ready');
}

describe('New Tab page', () => {
  it('gets ready with the stored shortcuts, the bookmarks bar and the recent sites drawn', async () => {
    await bootReadyNewtab(createStockedBrowser());

    expect(getElements(document, '[data-shortcut-id]').map((tile) => tile.dataset.shortcutId)).toEqual(['s1']);
    expect(getElements(document, '.x-nt-bookmark-card').map((card) => card.dataset.bookmarkId)).toEqual(['10']);
    const recent = getElements(document, '.x-nt-recent-card');
    expect(recent).toHaveLength(1);
    expect(recent[0].textContent).toContain('News');
    expect(getElementById(SHORTCUTS_SECTION_ID).dataset.visible).toBe('true');
  });

  it('follows a setting another page changed', async () => {
    const browser = createStockedBrowser();
    await bootReadyNewtab(browser);

    await act(async () => browser.storage.sync.externalSet({ [SHORTCUTS_VISIBLE_KEY]: false }));
    await settle();

    expect(getElementById(SHORTCUTS_SECTION_ID).dataset.visible).toBe('false');
  });

  it('offers a web search for what is typed and runs it on Enter', async () => {
    const browser = createStockedBrowser();
    await bootReadyNewtab(browser);
    const input = getTag(document, `#${SEARCH_INPUT_ID}`, 'input');

    await act(async () => {
      input.focus();
      input.value = 'news';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await settle(20);
    expect(getElements(document, '.x-nt-suggestion-item').some((row) => (row.textContent || '').includes('Search "news"'))).toBe(true);

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    await settle(10);
    expect(browser.search.query.mock.calls.map((call) => call[0])).toEqual([{ text: 'news', disposition: 'CURRENT_TAB' }]);
  });
});
