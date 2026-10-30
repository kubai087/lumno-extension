import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { restrictedAction } from '../domain/settings/overlay-panel';
import { bootWorker, settleWorker } from '../../tests/fakes/worker';
import {
  buildNewtabFallbackUrl,
  isLocalFileLikeTargetUrl,
  openBrowserNewtabFallback,
  openNewtabFallback,
  openNewtabFallbackForUrl,
  swapNewtabForFocus
} from './newtab-fallback';

const LUMNO_NEWTAB = 'chrome-extension://abc/src/newtab/lumno-newtab.html';
const NEWTAB = 'chrome-extension://abc/newtab.html';

function tab(fields: Pick<chrome.tabs.Tab, 'id'> & Partial<Pick<chrome.tabs.Tab, 'index' | 'windowId' | 'openerTabId' | 'url'>>): chrome.tabs.Tab {
  return {
    index: 0, windowId: 1, pinned: false, highlighted: false, active: false, incognito: false, selected: false,
    discarded: false, autoDiscardable: true, frozen: false, groupId: -1, lastAccessed: 0, ...fields
  };
}

// The worker's browser as the fallback reaches it: new tabs, groups, file
// access (off), closing tabs and Firefox's recently closed list.
function stubBrowser() {
  const created: chrome.tabs.CreateProperties[] = [];
  const browser = {
    runtime: { getURL: (value: string) => `chrome-extension://abc/${value}`, lastError: null },
    extension: { isAllowedFileSchemeAccess: vi.fn((callback: (allowed: boolean) => void) => callback(false)) },
    tabs: {
      create: vi.fn((properties: chrome.tabs.CreateProperties, callback?: (created: chrome.tabs.Tab) => void) => {
        created.push({ ...properties });
        callback?.(tab({ id: 99 + created.length, windowId: typeof properties.windowId === 'number' ? properties.windowId : 1, url: properties.url || '' }));
      }),
      group: vi.fn((options: { groupId?: number }, callback?: (groupId: number) => void) => callback?.(options.groupId || 7)),
      remove: vi.fn((_tabId: number, callback: () => void) => callback())
    },
    tabGroups: { TAB_GROUP_ID_NONE: -1 },
    sessions: {
      getRecentlyClosed: (_filter: unknown, callback: (sessions: unknown[]) => void) => callback([
        { lastModified: Date.now(), tab: { url: 'https://example.com/', sessionId: 'other', windowId: 3 } },
        { lastModified: Date.now(), tab: { url: NEWTAB, sessionId: 'swapped', windowId: 3 } },
        { lastModified: 1, tab: { url: NEWTAB, sessionId: 'user-closed', windowId: 3 } }
      ]),
      forgetClosedTab: vi.fn((_windowId: number, _sessionId: string) => Promise.resolve())
    }
  };
  vi.stubGlobal('chrome', browser);
  return { browser, created };
}

describe('New Tab fallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('treats file URLs, nested file sources and PDFs as local files, and web pages not', () => {
    expect(isLocalFileLikeTargetUrl('file:///Users/example/document.pdf')).toBe(true);
    expect(isLocalFileLikeTargetUrl('https://example.com/viewer?src=file:///tmp/a.html')).toBe(true);
    expect(isLocalFileLikeTargetUrl('https://example.com/docs/report.pdf')).toBe(true);
    expect(isLocalFileLikeTargetUrl('https://example.com/')).toBe(false);
  });

  describe('opening a tab', () => {
    let created: chrome.tabs.CreateProperties[] = [];
    let browser: ReturnType<typeof stubBrowser>['browser'];

    beforeEach(() => {
      ({ created, browser } = stubBrowser());
    });

    it('opens the focused standalone New Tab, with the file-access notice for a file without access', () => {
      expect(buildNewtabFallbackUrl({ notice: 'file-access' })).toBe(`${LUMNO_NEWTAB}?focus=1&notice=file-access`);
      openNewtabFallbackForUrl('file:///Users/example/document.pdf');
      openNewtabFallbackForUrl('https://example.com/');
      openBrowserNewtabFallback();

      expect(created.map((properties) => properties.url)).toEqual([`${LUMNO_NEWTAB}?focus=1&notice=file-access`, `${LUMNO_NEWTAB}?focus=1`, undefined]);
    });

    it('lets the browser pick its New Tab when following it, except to show the file-access notice', () => {
      openNewtabFallbackForUrl('file:///Users/example/document.pdf', { followBrowserNewtab: true });
      openNewtabFallbackForUrl('https://example.com/', { followBrowserNewtab: true });
      // Firefox reports file access as unknown, so its PDF viewer follows the browser too.
      Reflect.deleteProperty(browser.extension, 'isAllowedFileSchemeAccess');
      openNewtabFallbackForUrl('https://example.com/docs/report.pdf', { followBrowserNewtab: true });

      expect(created.map((properties) => properties.url)).toEqual([`${LUMNO_NEWTAB}?focus=1&notice=file-access`, undefined, undefined]);
    });

    it('opens in the source tab’s window and joins its group', () => {
      openNewtabFallback({ sourceTab: { id: 20, windowId: 5, groupId: 9 } });
      openBrowserNewtabFallback({ sourceTab: { id: 21, windowId: 6, groupId: 11 } });

      expect(created[0].windowId).toBe(5);
      expect(browser.tabs.group.mock.calls.map((call) => call[0])).toEqual([{ tabIds: 100, groupId: 9 }, { tabIds: 101, groupId: 11 }]);
    });
  });

  describe('swapping a New Tab for its focus route', () => {
    it('opens the focused New Tab in place of the sender, closes the sender and forgets it', () => {
      const { browser, created } = stubBrowser();
      const done = vi.fn();
      const source = Object.assign(tab({ id: 30, index: 4, windowId: 3, openerTabId: 12 }), { cookieStoreId: 'firefox-default' });

      swapNewtabForFocus(source, NEWTAB, done);
      expect(created).toEqual([{ url: `${NEWTAB}#focus`, index: 4, windowId: 3, active: true, openerTabId: 12 }]);
      expect(browser.tabs.remove.mock.calls.map((call) => call[0])).toEqual([30]);
      // Firefox rejects a callback argument for sessions.forgetClosedTab.
      expect(browser.sessions.forgetClosedTab.mock.calls).toEqual([[3, 'swapped']]);
      expect(done.mock.calls).toEqual([[{ ok: true, removed: true }]]);
    });

    it('refuses a sender that is not Lumno’s New Tab, and a container tab', () => {
      const { created } = stubBrowser();
      const done = vi.fn();

      swapNewtabForFocus(tab({ id: 31, windowId: 3 }), 'https://example.com/newtab.html', done);
      swapNewtabForFocus(Object.assign(tab({ id: 32, windowId: 3 }), { cookieStoreId: 'firefox-container-2' }), NEWTAB, done);
      expect(created).toEqual([]);
      expect(done.mock.calls).toEqual([[{ ok: false, reason: 'invalid-sender' }], [{ ok: false, reason: 'container-tab' }]]);
    });
  });
});

// When the overlay cannot be injected into the page (a store page, a PDF),
// the worker follows the restricted page rule: Lumno's New Tab by default,
// the browser's own New Tab when the rule says so.
describe('a search the page refuses', () => {
  it.each([['default', 'lumno'], ['none', 'browser']])('opens one fallback tab under the %s rule', async (rule, expected) => {
    const fake = await bootWorker({
      tabs: [{ id: 7, windowId: 1, index: 0, active: true, title: 'Page', url: 'https://page.example.test/a', status: 'complete' }],
      sync: { [restrictedAction.key]: rule }
    });
    await settleWorker(50);
    fake.chrome.scripting.executeScript.mockImplementation((_injection, callback) => {
      if (!callback) {
        return Promise.reject(new Error('Frame with ID 0 is showing error page'));
      }
      setTimeout(() => {
        fake.chrome.runtime.lastError = { message: 'Frame with ID 0 is showing error page' };
        try {
          callback([]);
        } finally {
          fake.chrome.runtime.lastError = null;
        }
      }, 0);
      return undefined;
    });

    fake.chrome.commands.onCommand.fire('show-search');
    await vi.waitFor(() => expect(fake.chrome.tabs.create).toHaveBeenCalled(), { timeout: 3000, interval: 20 });
    await settleWorker(200);
    const created = fake.chrome.tabs.create.mock.calls.map((call) => call[0]);
    expect(created).toHaveLength(1);
    if (expected === 'lumno') {
      expect(created[0].url).toMatch(/src\/newtab\/lumno-newtab\.html\?focus=1$/);
    } else {
      expect(created[0].url).toBeUndefined();
    }
  });
});
