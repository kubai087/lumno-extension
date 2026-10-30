import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { createBrowserFake, type BrowserFake } from '../../fakes/browser';
import { bootReadyNewtab, settle } from './boot';
import { createShortcutStoragePlan } from '../../../src/domain/shortcuts/storage-plan';
import { getElementById, getElements, getTag } from '../../fakes/dom';

// Boots the real New Tab (its markup and the entries it loads, in order)
// against an in-memory browser, and checks the page by what it shows and
// writes: it gets ready, draws the stored shortcuts, the bookmarks bar and
// the recent sites, follows a setting changed elsewhere and searches.

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
