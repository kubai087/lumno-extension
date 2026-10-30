import { afterEach, describe, expect, it, vi } from 'vitest';
import { newtabInputAutoFocusEnabled } from '../domain/settings/newtab-page';
import { newtabInputAutoFocusCache } from '../domain/settings/page-cache';
import { createBrowserFake } from '../../tests/fakes/browser';

// The focus route a New Tab takes before first paint: the focused page when
// input auto-focus is on, by same-tab navigation in Chrome and by a tab swap
// in Firefox. The preload runs once per page; each case runs it fresh.
const ENABLED_KEY = newtabInputAutoFocusEnabled.key;
const CACHE_KEY = newtabInputAutoFocusCache.key;
const root = document.documentElement;

interface EntryRun {
  storedValue?: unknown;
  search?: string;
  storageAvailable?: boolean;
  cachedEnabled?: string;
  scheme?: 'chrome-extension' | 'moz-extension';
  visibilityState?: DocumentVisibilityState;
  swapResponse?: unknown;
}

async function runEntry(run: EntryRun = {}) {
  const { search = '', scheme = 'chrome-extension' } = run;
  if (typeof run.cachedEnabled === 'string') {
    window.localStorage.setItem(CACHE_KEY, run.cachedEnabled);
  }
  const url = new URL(`${scheme}://abc/newtab.html${search}`);
  const replace = vi.fn();
  vi.stubGlobal('location', { href: url.href, protocol: url.protocol, search: url.search, hash: url.hash, replace });
  let visibility: DocumentVisibilityState = run.visibilityState || 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  const browser = createBrowserFake({
    sync: { [ENABLED_KEY]: run.storedValue },
    respond: () => run.swapResponse || { ok: true, removed: true }
  });
  const syncGet = vi.spyOn(browser.storage.sync, 'get');
  vi.stubGlobal('chrome', run.storageAvailable === false ? {} : browser);
  vi.resetModules();
  await import('./newtab-focus-entry');
  // The read settles once the active storage area is known.
  await new Promise((resolve) => setTimeout(resolve, 0));
  return {
    replacedUrls: () => replace.mock.calls.map((call) => call[0]),
    sentMessages: () => browser.runtime.sendMessage.mock.calls.map((call) => call[0]),
    storageReads: () => syncGet.mock.calls.filter((call) => JSON.stringify(call[0]) === JSON.stringify([ENABLED_KEY])).length,
    cachedEnabled: () => window.localStorage.getItem(CACHE_KEY),
    show() {
      visibility = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
    }
  };
}

describe('New Tab focus entry', () => {
  afterEach(() => {
    window.localStorage.clear();
    ['data-nt-focus-route', 'data-nt-focus-route-pending'].forEach((name) => root.removeAttribute(name));
    vi.unstubAllGlobals();
  });

  it('shows the page in place when input auto-focus is off', async () => {
    const entry = await runEntry({ storedValue: false });

    expect(entry.replacedUrls()).toEqual([]);
    expect(entry.storageReads()).toBe(1);
    expect(root.hasAttribute('data-nt-focus-route-pending')).toBe(false);
    expect(entry.cachedEnabled()).toBe('false');
  });

  it('treats a missing preference as off', async () => {
    const entry = await runEntry({ storedValue: undefined });

    expect(entry.replacedUrls()).toEqual([]);
    expect(entry.storageReads()).toBe(1);
    expect(root.hasAttribute('data-nt-focus-route-pending')).toBe(false);
  });

  it('navigates to the focus route when input auto-focus is on', async () => {
    const entry = await runEntry({ storedValue: true });

    expect(entry.replacedUrls()).toEqual(['chrome-extension://abc/newtab.html?focus=1']);
    expect(entry.storageReads()).toBe(1);
  });

  it('marks the focus route for first paint without reading storage or redirecting again', async () => {
    const entry = await runEntry({ search: '?focus=1', storedValue: true });

    expect(entry.replacedUrls()).toEqual([]);
    expect(entry.storageReads()).toBe(0);
    expect(root.hasAttribute('data-nt-focus-route')).toBe(true);
  });

  it('routes at once on a remembered enabled choice, before storage answers', async () => {
    const entry = await runEntry({ storedValue: true, cachedEnabled: 'true' });

    expect(entry.replacedUrls()).toEqual(['chrome-extension://abc/newtab.html?focus=1']);
    expect(entry.storageReads()).toBe(0);
  });

  it('asks storage on a remembered disabled choice and refreshes the copy', async () => {
    const entry = await runEntry({ storedValue: true, cachedEnabled: 'false' });

    expect(entry.replacedUrls()).toEqual(['chrome-extension://abc/newtab.html?focus=1']);
    expect(entry.storageReads()).toBe(1);
    expect(entry.cachedEnabled()).toBe('true');
  });

  it('swaps tabs in Firefox instead of navigating, hidden meanwhile', async () => {
    const entry = await runEntry({ scheme: 'moz-extension', storedValue: true });

    expect(entry.replacedUrls()).toEqual([]);
    expect(entry.sentMessages()).toEqual([{ action: 'swapNewtabForFocus' }]);
    expect(root.getAttribute('data-nt-focus-route-pending')).toBe('true');
  });

  it('swaps tabs in Firefox on a remembered choice without reading storage', async () => {
    const entry = await runEntry({ scheme: 'moz-extension', storedValue: true, cachedEnabled: 'true' });

    expect(entry.replacedUrls()).toEqual([]);
    expect(entry.storageReads()).toBe(0);
    expect(entry.sentMessages()).toEqual([{ action: 'swapNewtabForFocus' }]);
  });

  it('waits until a preloaded hidden Firefox page is shown before swapping', async () => {
    const entry = await runEntry({ scheme: 'moz-extension', storedValue: true, visibilityState: 'hidden' });
    expect(entry.sentMessages()).toEqual([]);

    entry.show();
    expect(entry.sentMessages()).toEqual([{ action: 'swapNewtabForFocus' }]);
  });

  it('reveals the current page when the Firefox swap fails', async () => {
    await runEntry({ scheme: 'moz-extension', storedValue: true, swapResponse: { ok: false, reason: 'invalid-sender' } });

    expect(root.hasAttribute('data-nt-focus-route-pending')).toBe(false);
  });

  it('does not swap again in the swapped-in Firefox tab', async () => {
    const entry = await runEntry({ scheme: 'moz-extension', search: '#focus', storedValue: true });

    expect(entry.sentMessages()).toEqual([]);
    expect(entry.storageReads()).toBe(0);
    expect(root.hasAttribute('data-nt-focus-route')).toBe(true);
  });

  it('does not swap in Firefox while input auto-focus is off', async () => {
    const entry = await runEntry({ scheme: 'moz-extension', storedValue: false });

    expect(entry.sentMessages()).toEqual([]);
  });

  it('keeps the disabled default when storage is unavailable', async () => {
    const entry = await runEntry({ storageAvailable: false });

    expect(entry.replacedUrls()).toEqual([]);
    expect(root.hasAttribute('data-nt-focus-route-pending')).toBe(false);
  });
});
