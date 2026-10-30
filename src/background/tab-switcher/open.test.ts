import { describe, expect, it, vi } from 'vitest';
import { tabSwitcherCurrentWindowOnly, tabSwitcherEnabled } from '../../domain/settings/features';
import { siteThemeCache } from '../../domain/settings/search';
import type { WorkerFakeOptions, WorkerTab } from '../../../tests/fakes/worker';
import {
  EXTENSION_ORIGIN, browserTab, createPort, injectedCommand, injectedModules, injectionsInto, installWorkerFake, settleWorker
} from '../../../tests/fakes/worker';

// The tab switcher shortcut (chrome.commands "show-tab-switcher") against
// the worker, with the messages it sends to tabs answered the way the
// injected switcher, the extension-page bridge and the release observer do.

type Responder = (message: Record<string, unknown>, tabId: number) => unknown;

function webTabs(): WorkerTab[] {
  return [
    { id: 11, windowId: 1, index: 0, active: true, url: 'https://mail.example.com/', title: 'Mail', status: 'complete', favIconUrl: 'https://tracker.example.net/mail.ico' },
    { id: 12, windowId: 1, index: 1, active: false, url: 'https://news.example.com/', title: 'News', status: 'complete' },
    { id: 13, windowId: 1, index: 2, active: false, url: 'chrome://settings/', title: 'Settings', status: 'complete' },
    { id: 14, windowId: 1, index: 3, active: false, url: 'https://private.example.com/', title: 'Private', status: 'complete', incognito: true },
    { id: 15, windowId: 2, index: 0, active: true, url: 'https://other-window.example.com/', title: 'Other window', status: 'complete' }
  ];
}

const defaultResponder: Responder = (message) => {
  if (message.action === 'advanceOpenTabSwitcherFromCommand') return { ok: true, open: false, advanced: false, suppressed: false };
  if (message.action === 'commitOpenTabSwitcherFromShortcutRelease') return { ok: true, committed: true };
  if (message.action === 'getOpenTabSwitcherState') return { ok: true, open: false };
  return { ok: true };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function contextOf(message: Record<string, unknown>): Record<string, unknown> {
  return isRecord(message.context) ? message.context : {};
}

function tabsOf(context: Record<string, unknown>): Record<string, unknown>[] {
  return Array.isArray(context.tabs) ? context.tabs.filter(isRecord) : [];
}

interface SwitcherOptions {
  tabs?: WorkerTab[];
  respond?: Responder;
  shortcut?: string;
  reverseShortcut?: string;
  zoom?: number;
  sync?: Record<string, unknown>;
  local?: Record<string, unknown>;
  storage?: WorkerFakeOptions['storage'];
  settle?: boolean;
}

async function bootSwitcher(options: SwitcherOptions = {}) {
  const respond = options.respond || defaultResponder;
  const fake = installWorkerFake({
    tabs: options.tabs || webTabs(),
    sync: { [tabSwitcherEnabled.key]: true, ...(options.sync || {}) },
    local: options.local,
    storage: options.storage,
    commands: [
      { name: 'show-tab-switcher', shortcut: options.shortcut || 'Alt+Q' },
      { name: 'show-tab-switcher-reverse', shortcut: options.reverseShortcut || '' }
    ]
  });
  fake.chrome.tabs.sendMessage.mockImplementation((tabId, message, optionsOrCallback, maybeCallback) => {
    const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
    void Promise.resolve(respond(isRecord(message) ? message : {}, tabId)).then((response) => {
      setTimeout(() => callback && callback(response), 0);
    });
    return undefined;
  });
  fake.chrome.tabs.getZoom.mockImplementation((_tabId, callback) => {
    setTimeout(() => callback && callback(options.zoom || 1), 0);
    return undefined;
  });
  fake.chrome.windows.get.mockImplementation((windowId, optionsOrCallback, maybeCallback) => {
    const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
    setTimeout(() => callback && callback({ id: windowId, focused: true }), 0);
    return undefined;
  });
  await import('../background');
  if (options.settle !== false) await settleWorker(30);
  const sent = (action: string) => fake.chrome.tabs.sendMessage.mock.calls
    .filter(([, message]) => isRecord(message) && message.action === action)
    .map(([tabId, message]) => ({ tabId, message: isRecord(message) ? message : {} }));
  const visit = async (tabIds: number[]) => {
    for (const tabId of tabIds) {
      fake.tabs.forEach((tab) => {
        if (tab.windowId === 1) tab.active = tab.id === tabId;
      });
      fake.chrome.tabs.onActivated.fire({ tabId, windowId: 1 });
      await settleWorker(5);
    }
  };
  const press = (command = 'show-tab-switcher') => fake.chrome.commands.onCommand.fire(command);
  const release = (key: string, tabId: number) => new Promise<unknown>((resolve) => {
    const tab = fake.tabs.find((each) => each.id === tabId);
    fake.chrome.runtime.onMessage.fire({ action: 'notifyTabSwitcherShortcutModifierReleased', key },
      { tab: browserTab(tab || { id: tabId }), url: tab ? tab.url : '' }, resolve);
  });
  const clear = () => {
    fake.chrome.tabs.sendMessage.mockClear();
    fake.chrome.scripting.executeScript.mockClear();
    fake.chrome.tabs.query.mockClear();
    fake.chrome.tabs.update.mockClear();
  };
  const debugStages = async () => {
    const { readTabSwitcherShortcutDebugEvents } = await import('./shortcut-release');
    return readTabSwitcherShortcutDebugEvents().map((event) => event.stage);
  };
  return { fake, sent, visit, press, release, clear, debugStages };
}

describe('the tab switcher command', () => {
  it('opens the recent tabs on the active page through its runtime, armed to commit on release', async () => {
    const session = await bootSwitcher({ shortcut: 'Ctrl+Shift+Y', zoom: 1.5 });
    await session.visit([12, 13, 11]);
    session.clear();
    const before = Date.now();
    session.press();
    await vi.waitFor(() => expect(session.sent('armTabSwitcherShortcutRelease').length).toBe(4));

    const [first] = injectionsInto(session.fake);
    expect(first).toEqual({ target: { tabId: 11, allFrames: true }, files: ['build/shortcut-key-observer.js'] });
    expect(session.sent('advanceOpenTabSwitcherFromCommand').map((entry) => [entry.tabId, entry.message.offset])).toEqual([[11, 1]]);
    const opens = session.sent('openTabSwitcherFromCommand');
    expect(opens.map((entry) => entry.tabId)).toEqual([11]);
    const context = contextOf(opens[0].message);
    expect(tabsOf(context).map((tab) => tab.id)).toEqual([11, 13, 12, 15]);
    expect(context).toMatchObject({
      selectedIndex: 1, currentTabId: 11, shortcut: 'Ctrl+Shift+Y', advanceOnExisting: true,
      suppressInitialShortcutAdvance: true, tabZoomFactor: 1.5
    });
    expect(tabsOf(context)[0].favIconUrl).not.toBe('https://tracker.example.net/mail.ico');
    tabsOf(context).forEach((tab) => {
      expect(['ok', 'pending', 'failed', 'restricted', 'stale', 'missing']).toContain(tab.thumbnailStatus);
      expect(tab).toHaveProperty('thumbnailReason');
    });

    const arms = session.sent('armTabSwitcherShortcutRelease');
    expect(arms.map((entry) => entry.tabId).sort()).toEqual([11, 12, 13, 14]);
    arms.forEach((entry) => {
      expect(entry.message.keys).toEqual(['Control']);
      if (entry.tabId === 11) {
        expect(entry.message.commandStartedAt).toBeGreaterThanOrEqual(before);
        expect(entry.message.commandStartedAt).toBeLessThanOrEqual(Date.now());
      } else {
        expect(entry.message.commandStartedAt).toBe(0);
      }
    });
    expect(await session.debugStages()).toEqual(expect.arrayContaining(['command-received', 'shortcut-configured', 'switcher-opened']));
  });

  it('keeps tabs of other windows out with the current-window setting', async () => {
    const session = await bootSwitcher({ sync: { [tabSwitcherCurrentWindowOnly.key]: true } });
    await session.visit([12, 13, 11]);
    session.press();
    await vi.waitFor(() => expect(session.sent('openTabSwitcherFromCommand')).toHaveLength(1));

    expect(tabsOf(contextOf(session.sent('openTabSwitcherFromCommand')[0].message)).map((tab) => tab.id)).toEqual([11, 13, 12]);
  });

  it('advances an open switcher instead of reopening it, and commits a release relayed from any tab', async () => {
    const session = await bootSwitcher({
      respond: (message, tabId) => (message.action === 'advanceOpenTabSwitcherFromCommand'
        ? { ok: true, open: true, advanced: true }
        : defaultResponder(message, tabId))
    });
    await session.visit([12, 11]);
    session.clear();
    session.press();
    await vi.waitFor(() => expect(session.sent('advanceOpenTabSwitcherFromCommand')).toHaveLength(1));
    await settleWorker(300);

    expect(session.sent('openTabSwitcherFromCommand')).toEqual([]);
    expect(session.fake.chrome.tabs.query.mock.calls.some(([query]) => Object.keys(query || {}).length === 0)).toBe(false);
    expect(injectionsInto(session.fake).filter((injection) => 'func' in injection && injection.func)).toEqual([]);

    session.clear();
    expect(await session.release('Alt', 12)).toEqual({ ok: true, committed: true });
    expect(session.sent('commitOpenTabSwitcherFromShortcutRelease').map((entry) => entry.tabId)).toEqual([11]);
  });

  it('opens on the oldest tab for the reverse command and commits on its modifier', async () => {
    const session = await bootSwitcher({ shortcut: 'Alt+Q', reverseShortcut: '⌃⇧Q' });
    await session.visit([12, 13, 11]);
    session.clear();
    session.press('show-tab-switcher-reverse');
    await vi.waitFor(() => expect(session.sent('armTabSwitcherShortcutRelease').length).toBeGreaterThan(0));

    expect(session.sent('advanceOpenTabSwitcherFromCommand').map((entry) => entry.message.offset)).toEqual([-1]);
    const context = contextOf(session.sent('openTabSwitcherFromCommand')[0].message);
    expect(tabsOf(context).map((tab) => tab.id)).toEqual([11, 13, 12, 15]);
    expect(context).toMatchObject({ selectedIndex: 3, reverse: true, shortcut: '⌃⇧Q' });
    expect(session.sent('armTabSwitcherShortcutRelease')[0].message.keys).toEqual(['Control']);
    expect(await session.release('Control', 12)).toEqual({ ok: true, committed: true });
  });

  it('opens the switcher when the open one suppressed the advance', async () => {
    const session = await bootSwitcher({
      respond: (message, tabId) => (message.action === 'advanceOpenTabSwitcherFromCommand'
        ? { ok: true, open: true, advanced: false, suppressed: true }
        : defaultResponder(message, tabId))
    });
    await session.visit([12, 11]);
    session.press();

    await vi.waitFor(() => expect(session.sent('openTabSwitcherFromCommand')).toHaveLength(1));
  });

  it('loads the switcher into a page that has none, with the icon font preload, in the injection that opens it', async () => {
    const session = await bootSwitcher({
      respond: (message, tabId) => (message.action === 'openTabSwitcherFromCommand' ? undefined : defaultResponder(message, tabId))
    });
    await session.visit([12, 11]);
    session.clear();
    session.press();
    const switcher = () => injectionsInto(session.fake, 11)
      .find((injection) => !injection.target.allFrames && injectedModules(injection).includes('build/injected/tab-switcher.js'));
    await vi.waitFor(() => expect(switcher()).toBeDefined());

    expect(injectedModules(switcher())).toEqual(['build/injected/icon-font-preload.js', 'build/injected/tab-switcher.js']);
    const command = injectedCommand(switcher());
    expect(command).toMatchObject({ type: 'toggle', context: { tabs: expect.any(Array) } });
  });

  it('ignores commands that arrive while the switcher is still opening', async () => {
    let releaseOpen: () => void = () => {};
    const opened = new Promise<void>((resolve) => {
      releaseOpen = resolve;
    });
    const session = await bootSwitcher({
      respond: (message, tabId) => (message.action === 'openTabSwitcherFromCommand'
        ? opened.then(() => ({ ok: true }))
        : defaultResponder(message, tabId))
    });
    await session.visit([12, 11]);
    session.press();
    await settleWorker(150);
    session.press();
    session.press();
    await settleWorker(150);
    releaseOpen();
    await settleWorker(100);

    expect(session.sent('openTabSwitcherFromCommand')).toHaveLength(1);
  });

  it('does not touch the page while the switcher is off', async () => {
    const session = await bootSwitcher({ sync: { [tabSwitcherEnabled.key]: false } });
    session.clear();
    session.press();
    await settleWorker(200);

    expect(session.sent('openTabSwitcherFromCommand')).toEqual([]);
    expect(session.sent('advanceOpenTabSwitcherFromCommand')).toEqual([]);
    expect(injectionsInto(session.fake)).toEqual([]);
  });

  it('hosts the switcher on a recent web tab, brought to the front, for a browser page', async () => {
    const tabs = webTabs();
    tabs.forEach((tab) => {
      tab.active = tab.id === 13 || tab.windowId === 2;
    });
    const session = await bootSwitcher({ tabs });
    await session.visit([12, 11, 13]);
    session.clear();
    session.press();
    await vi.waitFor(() => expect(session.sent('openTabSwitcherFromCommand')).toHaveLength(1));

    const [open] = session.sent('openTabSwitcherFromCommand');
    expect(open.tabId).toBe(11);
    expect(contextOf(open.message).currentTabId).toBe(13);
    expect(session.fake.chrome.tabs.update).toHaveBeenCalledWith(11, expect.objectContaining({ active: true }), expect.anything());
  });

  it('commits only on the modifier of the configured shortcut, straight on the hosting tab', async () => {
    const session = await bootSwitcher({ shortcut: 'Command+Shift+J' });
    await session.visit([12, 11]);
    session.press();
    await vi.waitFor(() => expect(session.sent('armTabSwitcherShortcutRelease').length).toBeGreaterThan(0));
    await settleWorker(100);
    session.clear();

    expect(await session.release('Shift', 12)).toEqual({ ok: true, committed: false });
    expect(session.sent('commitOpenTabSwitcherFromShortcutRelease')).toEqual([]);
    expect(await session.release('Meta', 12)).toEqual({ ok: true, committed: true });
    expect(session.sent('commitOpenTabSwitcherFromShortcutRelease').map((entry) => entry.tabId)).toEqual([11]);
    expect(await session.debugStages()).toEqual(expect.arrayContaining(['commit-host-resolved', 'commit-finished']));
  });

  it('does not report a host that did not switch as a switch', async () => {
    const session = await bootSwitcher({
      respond: (message, tabId) => (message.action === 'commitOpenTabSwitcherFromShortcutRelease'
        ? { ok: true, committed: false }
        : defaultResponder(message, tabId))
    });
    await session.visit([12, 11]);
    session.press();
    await vi.waitFor(() => expect(session.sent('armTabSwitcherShortcutRelease').length).toBeGreaterThan(0));
    await settleWorker(100);

    expect(await session.release('Alt', 11)).toEqual({ ok: true, committed: false });
  });

  it('keeps a switcher the user turned off closed when its command wakes the worker', async () => {
    const session = await bootSwitcher({ sync: { [tabSwitcherEnabled.key]: false }, storage: { sync: { hold: true } }, settle: false });
    session.press();
    await settleWorker(20);
    session.fake.storage.sync.release();
    await settleWorker(50);

    expect(injectionsInto(session.fake)).toEqual([]);
  });

  it('still reaches the active tab once the settings are known when its command wakes the worker', async () => {
    const session = await bootSwitcher({ storage: { sync: { hold: true } }, settle: false });
    session.press();
    await settleWorker(20);
    session.fake.storage.sync.release();

    await vi.waitFor(() => expect(injectionsInto(session.fake).length + session.fake.chrome.tabs.sendMessage.mock.calls
      .filter(([tabId]) => tabId === 11).length).toBeGreaterThan(0));
  });
});

describe('the tab switcher on extension pages', () => {
  // An extension page's bridge, answering what the worker posts to it.
  function connectExtensionPage(fake: Awaited<ReturnType<typeof bootSwitcher>>['fake'], tabId: number) {
    const page = createPort('lumno-tab-switcher-extension-page', { tab: browserTab({ id: tabId, windowId: 1 }), url: `${EXTENSION_ORIGIN}/newtab.html` });
    page.port.postMessage = (message: unknown) => {
      page.sent.push(message);
      if (!isRecord(message)) return;
      const answer = message.action === 'advanceOpenTabSwitcherFromCommand' ? { ok: true, advanced: false } : { ok: true };
      setTimeout(() => page.receive({ action: 'tabSwitcherExtensionPageResponse', requestId: message.requestId, tabId, ...answer }), 0);
    };
    fake.chrome.runtime.onConnect.fire(page.port);
    return page;
  }

  const received = (page: ReturnType<typeof connectExtensionPage>) => page.sent.filter(isRecord);

  it('asks an extension page over its port, never as a web page', async () => {
    const tabs = webTabs().filter((tab) => tab.windowId === 1 && tab.id !== 14);
    tabs.push({ id: 21, windowId: 1, index: 4, active: false, url: `${EXTENSION_ORIGIN}/newtab.html`, title: 'New Tab', status: 'complete' });
    const session = await bootSwitcher({ tabs });
    const page = connectExtensionPage(session.fake, 21);
    await session.visit([12, 11, 21]);
    session.clear();
    session.press();
    await vi.waitFor(() => expect(received(page).map((message) => message.action)).toContain('armTabSwitcherShortcutRelease'));

    const actions = received(page).map((message) => message.action).filter((action) => action !== 'setTabSwitcherCaptureVisibility');
    expect(actions.slice(0, 2)).toEqual(['advanceOpenTabSwitcherFromCommand', 'openTabSwitcherFromCommand']);
    const open = received(page).find((message) => message.action === 'openTabSwitcherFromCommand');
    expect(open && typeof open.requestId).toBe('number');
    expect(tabsOf(open ? contextOf(open) : {}).map((tab) => tab.id)).toEqual([21, 11, 12, 13]);
    expect(session.sent('openTabSwitcherFromCommand')).toEqual([]);
    expect(injectionsInto(session.fake, 21)).toEqual([]);
  });

  it("hosts the switcher on the browser's New Tab through its bridge, and elsewhere once the bridge is gone", async () => {
    const tabs = webTabs().filter((tab) => tab.windowId === 1 && tab.id !== 14);
    tabs.forEach((tab) => {
      tab.active = false;
    });
    tabs.push({ id: 22, windowId: 1, index: 4, active: true, url: 'chrome://newtab/', title: 'New Tab', status: 'complete' });
    const session = await bootSwitcher({ tabs });
    const page = connectExtensionPage(session.fake, 22);
    await session.visit([12, 11, 22]);
    session.press();
    await vi.waitFor(() => expect(received(page).some((message) => message.action === 'openTabSwitcherFromCommand')).toBe(true));
    await settleWorker(200);
    expect(session.fake.chrome.tabs.update.mock.calls.some(([, properties]) => properties.active === true)).toBe(false);

    page.disconnect();
    session.clear();
    await settleWorker(2100);
    session.press();
    await vi.waitFor(() => expect(session.sent('openTabSwitcherFromCommand')).toHaveLength(1), { timeout: 3000 });
    expect(session.sent('openTabSwitcherFromCommand')[0].tabId).not.toBe(22);
  });
});

describe('tab switcher accents', () => {
  it("follow New Tab's site colors, shared by subdomains, with blue for a neutral color", async () => {
    const now = Date.now();
    const session = await bootSwitcher({
      tabs: [
        { id: 31, windowId: 1, index: 0, active: true, url: 'https://www.youtube.com/watch?v=1', title: 'Video', status: 'complete' },
        { id: 32, windowId: 1, index: 1, active: false, url: 'https://checkout.shop-example.com/pay', title: 'Checkout', status: 'complete' },
        { id: 33, windowId: 1, index: 2, active: false, url: 'https://white.example.org/', title: 'White', status: 'complete' }
      ],
      local: {
        [siteThemeCache.key]: {
          version: 1,
          updatedAt: now,
          entries: {
            'youtube.com': { accentRgb: [1, 2, 3], source: 'meta', updatedAt: now },
            'shop-example.com': { accentRgb: [10, 120, 60], source: 'meta', updatedAt: now },
            'white.example.org': { accentRgb: [255, 255, 255], source: 'meta', updatedAt: now }
          }
        }
      }
    });
    await settleWorker(30);
    await session.visit([33, 32, 31]);
    session.press();
    await vi.waitFor(() => expect(session.sent('openTabSwitcherFromCommand')).toHaveLength(1));
    const accents = Object.fromEntries(tabsOf(contextOf(session.sent('openTabSwitcherFromCommand')[0].message))
      .map((tab) => [String(tab.id), tab.accentRgb]));

    expect(accents['31']).toEqual([255, 0, 0]);
    expect(accents['32']).toEqual([10, 120, 60]);
    expect(accents['33']).toEqual([59, 130, 246]);
  });
});
