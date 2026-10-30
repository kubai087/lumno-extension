import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { newtabInputAutoFocusEnabled } from '../../../src/domain/settings/newtab-page';
import { createBrowserFake } from '../../fakes/browser';
import { getElementById } from '../../fakes/dom';
import { bootNewtab } from './boot';
import { pause } from './search-page';

// Whether New Tab puts the cursor in its search box when it opens. Chrome
// keeps the address bar focused on a fresh New Tab, so with auto-focus on the
// page reopens itself at ?focus=1, which may take focus. Off by default, so
// the address bar keeps focus. Settings' switch is covered by
// tests/pages/options/newtab-page-rows.test.ts.
const KEY = newtabInputAutoFocusEnabled.key;
const INPUT_ID = '_x_extension_newtab_search_input_2024_unique_';
const root = document.documentElement;

// The page's address, which JSDOM cannot set to an extension URL: the
// navigations and address rewrites it is asked for are recorded.
function stubAddress(search: string) {
  const url = new URL(`chrome-extension://lumno/newtab.html${search}`);
  const address = {
    get href() { return url.href; },
    get protocol() { return url.protocol; },
    get origin() { return url.origin; },
    get pathname() { return url.pathname; },
    get search() { return url.search; },
    get hash() { return url.hash; },
    replace: vi.fn(),
    assign: vi.fn(),
    reload: vi.fn()
  };
  vi.stubGlobal('location', address);
  const rewrites: string[] = [];
  vi.spyOn(window.history, 'replaceState').mockImplementation((_state, _title, next) => {
    rewrites.push(String(next));
    const rewritten = new URL(String(next));
    url.search = rewritten.search;
    url.hash = rewritten.hash;
  });
  return { navigations: address.replace, rewrites };
}

async function openNewtab(sync: Record<string, unknown>, search = '') {
  const address = stubAddress(search);
  // The tab is in the foreground (JSDOM reports no focus by default).
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  const browser = createBrowserFake({ sync });
  const set = vi.spyOn(browser.storage.sync, 'set');
  await bootNewtab(browser);
  await pause(250);
  return { ...address, set };
}

const inputHasFocus = () => document.activeElement !== null && document.activeElement.id === INPUT_ID;

async function returnToTab(): Promise<boolean> {
  await act(async () => {
    getElementById(INPUT_ID).blur();
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await pause(80);
  return inputHasFocus();
}

describe('New Tab input auto-focus', () => {
  afterEach(() => {
    ['data-nt-focus-route', 'data-nt-focus-route-pending', 'data-nt-focus-resume'].forEach((name) => root.removeAttribute(name));
  });

  it('leaves focus alone and shows the page in place while off', async () => {
    const page = await openNewtab({ [KEY]: false });

    expect(inputHasFocus()).toBe(false);
    expect(root.getAttribute('data-nt-focus-route-pending')).toBeNull();
    expect(page.navigations).not.toHaveBeenCalled();
  });

  it('stays hidden while it moves to its focus route when on', async () => {
    const page = await openNewtab({ [KEY]: true });

    expect(root.getAttribute('data-nt-focus-route-pending')).toBe('true');
    expect(page.navigations.mock.calls).toEqual([['chrome-extension://lumno/newtab.html?focus=1']]);
  });

  it('focuses the search box on the focus route, and again when the user comes back to the tab', async () => {
    await openNewtab({ [KEY]: true }, '?focus=1');

    expect(inputHasFocus()).toBe(true);
    expect(await returnToTab()).toBe(true);
  });

  it('uses the search shortcut’s focus hint once while off, dropping it from the address without navigating', async () => {
    const page = await openNewtab({}, '?focus=1&q=x');

    expect(inputHasFocus()).toBe(true);
    expect(page.rewrites.map((next) => new URL(next).search)).toEqual(['?q=x']);
    expect(page.navigations).not.toHaveBeenCalled();
    expect(await returnToTab()).toBe(false);
    expect(page.set.mock.calls.some((call) => KEY in call[0])).toBe(false);
  });
});
