import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openSearchResultTab } from './split-view-tabs';

const createSearchResultTab = vi.hoisted(() => vi.fn());
vi.mock('./browser-urls-service', () => ({ createSearchResultTab }));

function tab(fields: Partial<chrome.tabs.Tab> & Pick<chrome.tabs.Tab, 'id'>): chrome.tabs.Tab {
  return {
    index: 0, windowId: 1, pinned: false, highlighted: false, active: true, incognito: false, selected: false,
    discarded: false, autoDiscardable: true, frozen: false, groupId: -1, lastAccessed: 0, ...fields
  };
}

// The worker's tabs API, with split views (Chrome 155+) or without, and a
// browser that may refuse the split.
function stubTabs(options: { splitViews: boolean; refuse?: boolean }) {
  const runtime: { lastError: { message: string } | null } = { lastError: null };
  const create = vi.fn((properties: chrome.tabs.CreateProperties, callback: (created?: chrome.tabs.Tab) => void) => {
    if (options.refuse) {
      runtime.lastError = { message: 'Tabs cannot be split.' };
      callback();
      runtime.lastError = null;
      return;
    }
    callback(tab({ id: 50, url: properties.url }));
  });
  vi.stubGlobal('chrome', {
    runtime,
    tabs: { create, ...(options.splitViews ? { createSplit: vi.fn() } : {}) }
  });
  return create;
}

describe('opening a search result in a split view', () => {
  const source = tab({ id: 7, windowId: 3 });

  beforeEach(() => {
    createSearchResultTab.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens it on the right of the tab it came from', () => {
    const create = stubTabs({ splitViews: true });
    const done = vi.fn();
    openSearchResultTab('https://example.com/', 'splitTab', source, done);
    expect(create).toHaveBeenCalledWith(
      { url: 'https://example.com/', windowId: 3, splitWithTabId: 7, active: true },
      expect.any(Function)
    );
    expect(done).toHaveBeenCalledWith(expect.objectContaining({ id: 50 }), { ok: true, reason: '', grouped: false });
    expect(createSearchResultTab).not.toHaveBeenCalled();
  });

  it.each([
    ['a browser without split views', { splitViews: false }, source],
    ['a split the browser refuses', { splitViews: true, refuse: true }, source],
    ['a tab already in a split view', { splitViews: true }, tab({ id: 7, windowId: 3, splitViewId: 2 })]
  ])('opens it as a new tab in front with %s', (_case, browser, sourceTab) => {
    stubTabs(browser);
    openSearchResultTab('https://example.com/', 'splitTab', sourceTab);
    expect(createSearchResultTab).toHaveBeenCalledWith({ url: 'https://example.com/', active: true }, sourceTab, undefined, undefined);
  });

  it('opens other dispositions as before, in the background when asked', () => {
    const create = stubTabs({ splitViews: true });
    openSearchResultTab('https://example.com/', 'backgroundTab', source);
    openSearchResultTab('https://example.com/', 'newTab', source);
    expect(createSearchResultTab.mock.calls.map((call) => call[0])).toEqual([
      { url: 'https://example.com/', active: false },
      { url: 'https://example.com/', active: true }
    ]);
    expect(create).not.toHaveBeenCalled();
  });
});
