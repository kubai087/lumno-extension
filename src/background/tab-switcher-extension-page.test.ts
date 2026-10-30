import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browserTab, createPort, installWorkerFake } from '../../tests/fakes/worker';

type Channel = typeof import('./tab-switcher-extension-page');

let channel: Channel;

afterEach(() => {
  vi.useRealTimers();
});

beforeEach(async () => {
  installWorkerFake();
  channel = await import('./tab-switcher-extension-page');
});

function pagePort(tabId: number, name = channel.TAB_SWITCHER_EXTENSION_PAGE_PORT_NAME) {
  return createPort(name, { tab: browserTab({ id: tabId }), url: 'chrome-extension://lumno-test/newtab.html' });
}

function requestIdOf(message: unknown): number {
  const requestId: unknown = message && typeof message === 'object' ? Reflect.get(message, 'requestId') : undefined;
  if (typeof requestId !== 'number') throw new Error('the message has no request id');
  return requestId;
}

const extensionTab = { id: 5, url: 'chrome-extension://lumno-test/newtab.html' };
const webTab = { id: 7, url: 'https://example.com/' };

describe('the tab switcher channel to extension pages', () => {
  it("is open to Lumno's pages, and to the browser's New Tab only once it connected", () => {
    expect(channel.isTabSwitcherExtensionPageMessageTarget(extensionTab)).toBe(true);
    expect(channel.isTabSwitcherExtensionPageMessageTarget(webTab)).toBe(false);
    expect(channel.isTabSwitcherExtensionPageMessageTarget({ id: 6, url: 'chrome://newtab/' })).toBe(false);
  });

  it('takes only ports opened for it', () => {
    channel.registerTabSwitcherExtensionPagePortConnection(pagePort(9, 'another-port').port);
    expect(channel.hasTabSwitcherExtensionPagePort({ id: 9 })).toBe(false);

    channel.registerTabSwitcherExtensionPagePortConnection(pagePort(5).port);
    expect(channel.hasTabSwitcherExtensionPagePort(extensionTab)).toBe(true);
  });

  it('delivers each answer to the request it answers', () => {
    const page = pagePort(5);
    channel.registerTabSwitcherExtensionPagePortConnection(page.port);
    const replies: unknown[] = [];

    expect(channel.postTabSwitcherMessageToExtensionPage(extensionTab, { action: 'getOpenTabSwitcherState' },
      (ok, reason, response) => replies.push([ok, reason, response && response.open]))).toBe(true);
    expect(page.sent).toEqual([expect.objectContaining({ action: 'getOpenTabSwitcherState' })]);
    const requestId = requestIdOf(page.sent[0]);

    page.receive({ action: 'tabSwitcherExtensionPageResponse', requestId: requestId + 100, ok: true });
    expect(replies).toEqual([]);
    page.receive({ action: 'tabSwitcherExtensionPageResponse', requestId, ok: true, open: true });
    expect(replies).toEqual([[true, '', true]]);
  });

  it('fails a request that gets no answer within a second', async () => {
    vi.useFakeTimers();
    channel.registerTabSwitcherExtensionPagePortConnection(pagePort(5).port);
    const late: unknown[] = [];
    channel.postTabSwitcherMessageToExtensionPage(extensionTab, { action: 'getOpenTabSwitcherState' }, (ok, reason) => late.push([ok, reason]));

    await vi.advanceTimersByTimeAsync(999);
    expect(late).toEqual([]);
    await vi.advanceTimersByTimeAsync(51);
    expect(late).toEqual([[false, 'extension-page-timeout']]);
  });

  it('fails what a page still owed when it goes away', () => {
    const page = pagePort(5);
    channel.registerTabSwitcherExtensionPagePortConnection(page.port);
    const dropped: unknown[] = [];
    channel.postTabSwitcherMessageToExtensionPage(extensionTab, { action: 'getOpenTabSwitcherState' }, (ok, reason) => dropped.push([ok, reason]));
    page.disconnect();

    expect(dropped).toEqual([[false, 'disconnected']]);
    expect(channel.hasTabSwitcherExtensionPagePort(extensionTab)).toBe(false);
  });

  it('refuses a web page', () => {
    const missing: unknown[] = [];
    channel.postTabSwitcherMessageToExtensionPage(webTab, { action: 'getOpenTabSwitcherState' }, (ok, reason) => missing.push([ok, reason]));

    expect(missing).toEqual([[false, 'not-extension-page']]);
  });

  it('waits a moment for the page to connect', async () => {
    vi.useFakeTimers();
    const waiting: unknown[] = [];
    channel.postTabSwitcherMessageToExtensionPage(extensionTab, { action: 'getOpenTabSwitcherState' }, (ok, reason) => waiting.push([ok, reason]));
    await vi.advanceTimersByTimeAsync(20);
    const page = pagePort(5);
    channel.registerTabSwitcherExtensionPagePortConnection(page.port);
    await vi.advanceTimersByTimeAsync(80);

    expect(page.sent).toHaveLength(1);
    page.receive({ action: 'tabSwitcherExtensionPageResponse', requestId: requestIdOf(page.sent[0]), ok: false, reason: 'busy' });
    expect(waiting).toEqual([[false, 'busy']]);
  });
});
