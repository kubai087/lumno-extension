import { describe, expect, it } from 'vitest';
import { bootOverlayPage, bundledSiteSearchProviders, click, settle, suggestionOf, waitFor, type OverlayMessage, type OverlayPage } from './boot';
import { getElement } from '../../fakes/dom';

// How the overlay replaces its results while the user types or changes
// scope: which rows show before the remote suggestions arrive, that rows stay
// up until their replacement renders, and that late answers for an earlier
// query or scope are dropped.

const PRIORITY_KEY = '_x_extension_search_result_priority_2026_unique_';
const LOCAL = { type: 'history', title: 'Local cats page', url: 'https://pets.example.test/cats' };
const REMOTE = { type: 'googleSuggest', title: 'cats remote', url: '' };

const rowTypes = (page: OverlayPage) => page.suggestions().map((row) => suggestionOf(row).type);

// Every row list the overlay showed, to tell whether rows were cleared
// before their replacement arrived.
function watchRows(page: OverlayPage, root: ShadowRoot): unknown[][] {
  const seen: unknown[][] = [];
  new MutationObserver(() => seen.push(rowTypes(page))).observe(root, { childList: true, subtree: true });
  return seen;
}

// Remote suggestions and the open tabs answer when the test says so.
async function bootMixPage(priority: string) {
  const pending: Array<() => void> = [];
  const respond = (message: OverlayMessage) => {
    if (message.action === 'getSearchSuggestions') {
      return { suggestions: [LOCAL] };
    }
    if (message.action === 'getSearchEngineSuggestions') {
      const local = Array.isArray(message.localSuggestions) ? message.localSuggestions : [];
      return new Promise((resolve) => pending.push(() => resolve({ suggestions: local.concat([REMOTE]), hasRemoteSuggestions: true })));
    }
    if (message.action === 'getTabsForOverlay') {
      return new Promise((resolve) => pending.push(() => resolve({ tabs: [{ id: 5, title: 'Late tab', url: 'https://late.example.test/' }] })));
    }
    return undefined;
  };
  const page = await bootOverlayPage({ stylesheetsLoad: 5, settings: { [PRIORITY_KEY]: priority }, respond });
  return { page, answerRemote: () => pending.splice(0).forEach((answer) => answer()) };
}

describe('Overlay result replacement', () => {
  it('shows only the exact search until the final mix when search comes first, never clearing rows', async () => {
    const { page, answerRemote } = await bootMixPage('search');
    const root = await page.open();
    const seen = watchRows(page, root);
    await page.type('cats');
    await settle(150);
    expect(rowTypes(page)).toEqual(['newtab']);

    answerRemote();
    await waitFor(() => rowTypes(page).includes('googleSuggest'), 'the final mix did not render');
    expect(rowTypes(page)).toEqual(['newtab', 'googleSuggest', 'history']);
    expect(seen.some((types) => types.length === 0)).toBe(false);
  });

  it('shows local results at once when autocomplete comes first, and does not reshuffle them later', async () => {
    const { page, answerRemote } = await bootMixPage('autocomplete');
    await page.open();
    await page.type('cats');
    await settle(150);
    expect(rowTypes(page)).toEqual(['history', 'newtab']);

    answerRemote();
    await settle(150);
    expect(rowTypes(page)).toEqual(['history', 'newtab']);
  });

  it('offers a typed address without waiting for its results', async () => {
    // Only the first query is answered.
    const page = await bootOverlayPage({
      respond: (message) => (message.action === 'getSearchSuggestions'
        ? (message.query === 'cats' ? { suggestions: [LOCAL] } : new Promise(() => {}))
        : undefined)
    });
    await page.open();
    await page.type('cats');
    await waitFor(() => rowTypes(page).includes('history'), 'the results did not show');
    await page.type('example.com');
    expect(rowTypes(page)[0]).toBe('directUrl');
  });

  it('keeps the rows and the query up until the chosen scope renders its own', async () => {
    const { page } = await bootMixPage('autocomplete');
    const root = await page.open({ siteSearchProviders: bundledSiteSearchProviders() });
    await page.type('cats');
    await settle(150);
    const seen = watchRows(page, root);
    click(getElement(root, '[data-search-scope-action="true"]'));
    await waitFor(() => root.querySelector('[data-mode-id="provider:yt"]'), 'the scope menu did not open');
    expect(rowTypes(page).length).toBeGreaterThan(0);

    click(getElement(root, '[data-mode-id="provider:yt"]'));
    await settle(200);
    expect(page.input()?.value).toBe('cats');
    expect(seen.some((types) => types.length === 0)).toBe(false);
  });

  it('drops an open-tab answer that arrives after leaving open-tab mode', async () => {
    const { page, answerRemote } = await bootMixPage('autocomplete');
    const root = await page.open({ siteSearchProviders: bundledSiteSearchProviders() });
    await page.type('/tabs');
    page.press('Enter');
    await settle(80);
    // Backspace on the empty input removes the open-tab tag; a second press confirms.
    page.press('Backspace');
    await settle(60);
    page.press('Backspace');
    await settle(60);
    answerRemote();
    await settle(150);
    expect(root.textContent).not.toContain('Late tab');
  });
});
