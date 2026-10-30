import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInputFocus } from './input-focus';
import { createSearchInput, destroySearchInput, type SearchInputParts } from '../shared/react/search-input';
import { createBrowserFake } from '../../tests/fakes/browser';
import { getTestPortals } from '../../tests/fakes/portals';
import { required } from '../../tests/fakes/dom';

// The search shortcut on New Tab focuses Lumno's input even with input
// auto-focus off. When the address bar holds keyboard focus, the page reopens
// on the focus route instead, because focus() cannot take it from there.

const ACTION = 'lumno:newtab-focus-input';

interface PageOptions {
  href?: string;
  tabId?: number;
  pageHasFocus?: boolean;
  autoFocusEnabled?: boolean;
}

type Reply = { ok: boolean; reopened?: boolean };

let mounted: SearchInputParts[] = [];

afterEach(() => {
  act(() => mounted.forEach((parts) => destroySearchInput(parts)));
  mounted = [];
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function bootPage(options: PageOptions = {}) {
  const href = options.href || 'chrome-extension://abc/newtab.html';
  const url = new URL(href);
  const replace = vi.fn();
  vi.stubGlobal('location', { href, protocol: url.protocol, search: url.search, hash: url.hash, replace });
  const browser = createBrowserFake({
    tabs: [{ id: options.tabId === undefined ? 7 : options.tabId, windowId: 1, index: 0, url: href, title: 'New Tab', active: true, pinned: false }],
    respond: (message) => (message.action === 'getShowSearchShortcut' ? { shortcut: 'Ctrl+Shift+K' } : undefined)
  });
  const addListener = vi.spyOn(browser.runtime.onMessage, 'addListener');
  vi.stubGlobal('chrome', browser);
  vi.spyOn(document, 'hasFocus').mockReturnValue(options.pageHasFocus === true);
  document.body.setAttribute('data-nt-ready', '1');

  const created: { parts: SearchInputParts | null } = { parts: null };
  act(() => {
    created.parts = createSearchInput({ portals: getTestPortals() });
  });
  const parts = required(created.parts, 'the search input');
  mounted.push(parts);
  document.body.appendChild(parts.container);
  const select = vi.spyOn(parts.input, 'select');
  // How many reloads had happened each time the search was saved.
  const preparedAt: number[] = [];
  const prepareFocusReload = vi.fn(() => {
    preparedAt.push(replace.mock.calls.length);
    return true;
  });
  createInputFocus({
    // Only the auto-focus choice is read here.
    settings: { get: (setting) => setting.parse(options.autoFocusEnabled === true) },
    searchBox: {
      inputParts: parts,
      modeController: null,
      focusInput() {
        parts.input.focus();
        return document.activeElement === parts.input;
      }
    },
    focusResume: { prepareFocusReload },
    refreshTabsIfIdle() {},
    initialNewtabInputAutoFocusReadyTask: Promise.resolve(),
    isImeCompositionEvent: () => false,
    isFolderColorPickerOpen: () => false
  });
  const listener = required(addListener.mock.calls[0], 'the focus message listener')[0];

  return {
    input: parts.input,
    select,
    replace,
    prepareFocusReload,
    preparedAt,
    sentActions: () => browser.runtime.sendMessage.mock.calls.map(([message]) => (
      typeof message === 'object' && message !== null && 'action' in message ? message.action : undefined
    )),
    // The background's message to this page; what the listener returned and
    // what it answered.
    async send(message: Record<string, unknown>) {
      const replies: Reply[] = [];
      const respond = (reply: Reply) => replies.push(reply);
      const result: unknown = Reflect.apply(listener, undefined, [{ action: ACTION, ...message }, {}, respond]);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      return { result, replies };
    }
  };
}

describe('the search shortcut on New Tab', () => {
  it('reopens the addressed tab on the focus route while the address bar holds focus', async () => {
    const page = bootPage();
    const { result, replies } = await page.send({ source: 'commands', tabId: 7 });

    // The listener answers asynchronously after checking its tab.
    expect(result).toBe(true);
    expect(page.replace.mock.calls).toEqual([['chrome-extension://abc/newtab.html?focus=1']]);
    // The search is saved before the page reloads.
    expect(page.preparedAt).toEqual([0]);
    expect(replies[0].reopened).toBe(true);
  });

  it('leaves another window\'s New Tab alone', async () => {
    const page = bootPage({ tabId: 9 });
    const { replies } = await page.send({ source: 'commands', tabId: 7 });

    expect(page.replace).not.toHaveBeenCalled();
    expect(page.prepareFocusReload).not.toHaveBeenCalled();
    expect(replies).toHaveLength(0);
    expect(document.activeElement).not.toBe(page.input);
  });

  it('reaches the input from the prefill shortcut too', async () => {
    const page = bootPage();
    await page.send({ source: 'commands-prefill', tabId: 7 });

    expect(page.replace).toHaveBeenCalledTimes(1);
  });

  it('focuses the input in place, selecting the query, when the page already has focus', async () => {
    const page = bootPage({ pageHasFocus: true });
    const { result, replies } = await page.send({ source: 'commands', tabId: 7 });

    expect(result).toBe(false);
    expect(page.replace).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(page.input);
    expect(page.select).toHaveBeenCalledTimes(1);
    expect(replies[0].ok).toBe(true);
  });

  it('never reloads the page for the toolbar popup, which holds focus while it asks', async () => {
    const page = bootPage();
    await page.send({ source: 'popup', tabId: 7 });

    expect(page.replace).not.toHaveBeenCalled();
  });

  it('swaps the tab in Firefox, which keeps address bar focus through same-tab navigation', async () => {
    const page = bootPage({ href: 'moz-extension://abc/newtab.html' });
    await page.send({ source: 'commands', tabId: 7 });

    expect(page.replace).not.toHaveBeenCalled();
    expect(page.sentActions()).toContain('swapNewtabForFocus');
    // The swapped-in tab gets the search too.
    expect(page.preparedAt).toEqual([0]);
  });

  it('focuses the input once on the reopened page although auto-focus is off', async () => {
    vi.useFakeTimers();
    const page = bootPage({ href: 'chrome-extension://abc/newtab.html?focus=1', pageHasFocus: true });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(document.activeElement).toBe(page.input);
  });

  it('leaves the input alone without the focus hint while auto-focus is off', async () => {
    vi.useFakeTimers();
    const page = bootPage({ pageHasFocus: true });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(document.activeElement).not.toBe(page.input);
  });
});
