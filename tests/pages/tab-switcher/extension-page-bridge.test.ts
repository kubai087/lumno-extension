import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { act } from 'react';
import { bootTabSwitcherPage, settle, switcherTabs, type SwitcherMessage, type TabSwitcherPage } from './boot';
import { required } from '../../fakes/dom';
import { setPageUrl } from '../../fakes/content-page';

// Extension pages (New Tab, Settings, Onboarding) take no injected scripts,
// so they run the tab switcher themselves and the worker reaches it over a
// named port. This drives that bridge through the port as the worker does.

const PORT_NAME = 'lumno-tab-switcher-extension-page';
const PAGE_URL = 'chrome-extension://lumno/src/options/options.html';
let testUrl = '';

beforeAll(() => {
  testUrl = location.href;
  setPageUrl(PAGE_URL);
});

afterAll(() => {
  setPageUrl(testUrl);
});

async function bootExtensionPage(respond?: (message: SwitcherMessage) => unknown) {
  return bootTabSwitcherPage({ bridge: true, currentTab: { id: 42, windowId: 1 }, respond });
}

let nextRequestId = 1;
// A request over the page's first port, and the page's answer to it.
function request(page: TabSwitcherPage, message: Record<string, unknown>) {
  const port = required(page.ports[0], 'the bridge port');
  const requestId = nextRequestId;
  nextRequestId += 1;
  port.deliver({ requestId, ...message });
  return required(port.sent.find((sent) => sent.requestId === requestId), `the answer to ${String(message.action)}`);
}

const relays = (page: TabSwitcherPage) => page.messages.filter((message) => message.action === 'notifyTabSwitcherShortcutModifierReleased');

describe('Tab switcher extension page bridge', () => {
  it('registers its own tab over the named port', async () => {
    const page = await bootExtensionPage();
    expect(page.connect.mock.calls.map(([info]) => info)).toEqual([{ name: PORT_NAME }]);
    expect(page.ports[0].sent[0]).toEqual({
      action: 'registerTabSwitcherExtensionPage',
      tabId: 42,
      url: PAGE_URL,
      title: ''
    });
  });

  it('opens, advances, updates and commits the switcher on the port\'s requests', async () => {
    const page = await bootExtensionPage();
    const closed = request(page, { action: 'getOpenTabSwitcherState' });
    expect(closed).toEqual({
      action: 'tabSwitcherExtensionPageResponse', requestId: closed.requestId, tabId: 42, ok: true, reason: '',
      advanced: null, committed: null, open: false, suppressed: false
    });
    expect(request(page, { action: 'openTabSwitcherFromCommand', context: { tabs: switcherTabs(3) } }).ok).toBe(true);
    expect(page.cards()).toHaveLength(3);
    expect(request(page, { action: 'getOpenTabSwitcherState' }).open).toBe(true);

    const advanced = request(page, { action: 'advanceOpenTabSwitcherFromCommand', offset: 1 });
    expect([advanced.advanced, advanced.suppressed]).toEqual([true, false]);
    expect(page.selectedIndex()).toBe(1);
    expect(request(page, { action: 'updateTabSwitcherThumbnail', tabId: 3, url: 'https://site3.example.test/', thumbnail: 'data:image/png;base64,Zm9v' }).ok)
      .toBe(true);

    expect(request(page, { action: 'commitOpenTabSwitcherFromShortcutRelease' }).committed).toBe(true);
    await settle();
    expect(page.switches()).toEqual([{ action: 'switchToTab', tabId: 2, windowId: 1 }]);
    expect(request(page, { action: 'commitOpenTabSwitcherFromShortcutRelease' }).committed).toBe(false);

    // A failed open reaches the worker, so it can fall back.
    const failed = request(page, { action: 'openTabSwitcherFromCommand', context: { tabs: [] } });
    expect([failed.ok, failed.reason]).toEqual([false, 'empty']);
  });

  it('hides the switcher while the worker captures the tab, then gives it its own visibility back', async () => {
    const page = await bootExtensionPage();
    request(page, { action: 'openTabSwitcherFromCommand', context: { tabs: switcherTabs(2) } });
    const host = required(page.host(), 'the switcher host');
    host.style.setProperty('visibility', 'visible');
    request(page, { action: 'setTabSwitcherCaptureVisibility', hidden: true });
    expect(host.style.getPropertyValue('visibility')).toBe('hidden');
    request(page, { action: 'setTabSwitcherCaptureVisibility', hidden: true });
    request(page, { action: 'setTabSwitcherCaptureVisibility', hidden: false });
    expect(host.style.getPropertyValue('visibility')).toBe('visible');
    expect(host.style.getPropertyPriority('visibility')).toBe('');
  });

  it('answers the worker\'s runtime messages too', async () => {
    const page = await bootExtensionPage();
    page.toggle({ tabs: switcherTabs(2) });
    const answers: unknown[] = [];
    act(() => {
      page.browser.runtime.onMessage.fire({ action: 'getOpenTabSwitcherState' }, {}, (answer: unknown) => answers.push(answer));
    });
    expect(answers).toContainEqual({ ok: true, open: true });
  });

  it('replays a release that beat the arm message, for the current command only', async () => {
    const page = await bootExtensionPage();
    const commandStartedAt = Date.now();
    page.press('q', { code: 'KeyQ', altKey: true });
    page.release('Alt', { code: 'AltLeft' });
    request(page, { action: 'armTabSwitcherShortcutRelease', keys: ['Alt'], commandStartedAt });
    expect(relays(page)).toEqual([{ action: 'notifyTabSwitcherShortcutModifierReleased', key: 'Alt' }]);

    request(page, { action: 'armTabSwitcherShortcutRelease', keys: ['Alt'], commandStartedAt: Date.now() + 10000 });
    expect(relays(page)).toHaveLength(1);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt', code: 'AltLeft' }));
    });
    expect(relays(page)).toHaveLength(1);
    page.release('Alt', { code: 'AltRight' });
    expect(relays(page)).toHaveLength(2);
    page.release('Alt', { code: 'AltRight' });
    expect(relays(page)).toHaveLength(2);
  });

  // A tab an earlier switcher left armed relays a quick release before the
  // next switcher opens; the release stays buffered until it commits.
  it('keeps an early release in an armed page for its switcher, until one commits', async () => {
    let committed = false;
    const page = await bootExtensionPage((message) => (message.action === 'notifyTabSwitcherShortcutModifierReleased' ? { ok: true, committed } : undefined));
    request(page, { action: 'armTabSwitcherShortcutRelease', keys: ['Alt'], commandStartedAt: 0 });
    const commandStartedAt = Date.now();
    page.press('Alt', { code: 'AltLeft', altKey: true });
    page.release('Alt', { code: 'AltLeft' });
    await settle();
    expect(relays(page)).toHaveLength(1);
    request(page, { action: 'armTabSwitcherShortcutRelease', keys: ['Alt'], commandStartedAt });
    expect(relays(page)).toHaveLength(2);

    committed = true;
    request(page, { action: 'armTabSwitcherShortcutRelease', keys: ['Alt'], commandStartedAt: 0 });
    page.press('Alt', { code: 'AltLeft', altKey: true });
    page.release('Alt', { code: 'AltLeft' });
    await settle();
    request(page, { action: 'armTabSwitcherShortcutRelease', keys: ['Alt'], commandStartedAt });
    expect(relays(page)).toHaveLength(3);
  });

  it('reconnects when the worker drops the port, but not while the page is being left', async () => {
    const page = await bootExtensionPage();
    page.ports[0].disconnect();
    await settle(1100);
    expect(page.connect).toHaveBeenCalledTimes(2);
    expect(page.ports[1].sent[0].action).toBe('registerTabSwitcherExtensionPage');

    window.dispatchEvent(new Event('pagehide'));
    page.ports[1].disconnect();
    await settle(1100);
    expect(page.connect).toHaveBeenCalledTimes(2);
  });
});
