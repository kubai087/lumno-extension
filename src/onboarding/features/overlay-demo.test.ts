import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PageRequest } from '../../domain/messages';
import { followSearchCommand } from './overlay-demo';

type MessageListener = (request: unknown, sender: object, sendResponse: (reply: unknown) => void) => boolean;

// The onboarding tab (id 5) as the browser reports it; the worker answers the
// overlay's tab list.
function stubBrowser() {
  const listeners: MessageListener[] = [];
  const sendMessage = vi.fn((_message: unknown, callback?: (reply: unknown) => void) => {
    if (callback) callback({ tabs: [], currentTabId: 5 });
  });
  vi.stubGlobal('chrome', {
    runtime: {
      lastError: null,
      getURL: (path: string) => `chrome-extension://lumno/${path}`,
      onMessage: { addListener: (listener: MessageListener) => listeners.push(listener) },
      sendMessage
    },
    tabs: {
      getCurrent: (callback: (tab: object) => void) => callback({ id: 5 }),
      getZoom: vi.fn((_tabId: number, callback: (zoom: number) => void) => callback(1.25))
    }
  });
  // The overlay app itself is not served here.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  followSearchCommand();
  return { listeners, sendMessage };
}

// What the worker forwards when the browser's search command fires on this
// page; the message contract it shares with the worker names it.
function forwardedCommand(tabId: number): PageRequest<'triggerOnboardingSearchOverlayFromCommand'> {
  return { action: 'triggerOnboardingSearchOverlayFromCommand', tabId, source: 'command' };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Onboarding search command', () => {
  it('opens the demo overlay when the worker forwards the browser search command', () => {
    const { listeners, sendMessage } = stubBrowser();
    expect(listeners).toHaveLength(1);
    const sendResponse = vi.fn();
    const pending = listeners[0](forwardedCommand(5), {}, sendResponse);
    expect(pending).toBe(true);
    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
    // Opening the overlay asks the worker for the tabs it lists.
    expect(sendMessage.mock.calls.map(([message]) => message)).toEqual([{ action: 'getTabsForOverlay', currentTabId: 5 }]);
  });

  it('leaves the overlay closed when the command was meant for another tab', () => {
    const { listeners, sendMessage } = stubBrowser();
    const sendResponse = vi.fn();
    listeners[0](forwardedCommand(9), {}, sendResponse);
    expect(sendResponse).toHaveBeenCalledWith({ ok: false, reason: 'tab-mismatch' });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('ignores other messages', () => {
    const { listeners, sendMessage } = stubBrowser();
    const sendResponse = vi.fn();
    expect(listeners[0]({ action: 'somethingElse' }, {}, sendResponse)).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
