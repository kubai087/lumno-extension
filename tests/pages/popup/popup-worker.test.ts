import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBrowserFake } from '../../fakes/browser';

// Starts the real worker against an in-memory browser and talks to it the
// way the toolbar popup and a web page would.

type Listener = (...args: never[]) => unknown;
type MessageListener = (request: unknown, sender: object, sendResponse: (reply: unknown) => void) => unknown;

function createEvent<T extends Listener>() {
  const listeners = new Set<T>();
  return {
    listeners,
    addListener: (listener: T) => listeners.add(listener),
    removeListener: (listener: T) => listeners.delete(listener),
    hasListener: (listener: T) => listeners.has(listener)
  };
}

async function startWorker() {
  const browser = createBrowserFake({
    tabs: [{ id: 1, windowId: 1, index: 0, url: 'https://x.example/', title: 'X', active: true, pinned: false }]
  });
  const onMessage = createEvent<MessageListener>();
  const onClicked = createEvent<Listener>();
  vi.stubGlobal('chrome', {
    ...browser,
    action: { onClicked },
    alarms: { create: vi.fn(), clear: vi.fn(), get: vi.fn(), onAlarm: createEvent() },
    commands: { ...browser.commands, onCommand: createEvent() },
    contextMenus: {
      create: vi.fn(),
      remove: vi.fn(),
      removeAll: vi.fn((callback?: () => void) => callback && callback()),
      update: vi.fn(),
      onClicked: createEvent()
    },
    runtime: {
      ...browser.runtime,
      onMessage,
      onInstalled: createEvent(),
      onStartup: createEvent(),
      onSuspend: createEvent(),
      getPlatformInfo: vi.fn()
    },
    // The worker opens the overlay or the clip picker in the page.
    scripting: { executeScript: vi.fn(() => Promise.resolve([])) },
    tabs: {
      ...browser.tabs,
      getZoom: (_tabId: number, callback: (zoom: number) => void) => callback(1),
      sendMessage: vi.fn((_tabId: number, _message: unknown, callback?: (reply: unknown) => void) => callback && callback(undefined))
    }
  });
  vi.resetModules();
  await import('../../../src/background/background');
  // The worker's answer, or undefined when it gives none in time.
  const send = (request: object, sender: object) => new Promise<unknown>((resolve) => {
    const timer = setTimeout(() => resolve(undefined), 300);
    onMessage.listeners.forEach((listener) => listener(request, sender, (reply) => {
      clearTimeout(timer);
      resolve(reply);
    }));
  });
  return { onClicked, send, popupUrl: browser.runtime.getURL('src/popup/popup.html') };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const POPUP_ACTIONS = [
  'popupOpenDocumentPipPicker', 'popupShowSearch', 'popupAddPageShortcut', 'popupShowPageToast',
  'popupGetRecentPin', 'popupToggleRecentPin'
];

describe('Toolbar popup and the worker', () => {
  it('leaves the toolbar button to the popup instead of a click handler', async () => {
    const { onClicked } = await startWorker();
    expect(onClicked.listeners.size).toBe(0);
  });

  it('answers the popup\'s actions from the popup and refuses them from web pages', async () => {
    const { send, popupUrl } = await startWorker();
    const webPage = { tab: { id: 1 }, url: 'https://x.example/' };
    for (const action of POPUP_ACTIONS) {
      const answer = await send({ action, tabId: 1 }, { url: popupUrl });
      expect(answer, action).toBeTruthy();
      expect(answer, action).not.toMatchObject({ reason: 'sender-not-allowed' });
      expect(await send({ action, tabId: 1 }, webPage), action).toEqual({ ok: false, reason: 'sender-not-allowed' });
    }
  });
});
