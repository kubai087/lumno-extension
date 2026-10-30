// The page a content script runs in, for tests that load a content script
// fresh each time: the page's address, the isolated world's content registry,
// and the listeners a script adds to the page, removed again afterwards so a
// later test's page does not hear an earlier script.
import { vi } from 'vitest';

interface Reconfigurable {
  reconfigure(settings: { url: string }): void;
}

function isReconfigurable(value: unknown): value is Reconfigurable {
  return typeof value === 'object' && value !== null && 'reconfigure' in value && typeof value.reconfigure === 'function';
}

// Moves the test page to another address, origin included.
function setPageUrl(url: string): void {
  const dom: unknown = Reflect.get(globalThis, 'jsdom');
  if (!isReconfigurable(dom)) {
    throw new Error('setPageUrl needs the jsdom environment.');
  }
  dom.reconfigure({ url });
}

// Forgets which classic content scripts already claimed this world.
function resetContentRegistry(): void {
  Reflect.deleteProperty(globalThis, '__lumnoContent');
}

// Records the listeners added to the window and the document from now on;
// the returned function removes them.
function trackPageListeners(): () => void {
  const targets: EventTarget[] = [window, document];
  const spies = targets.map((target) => ({ target, spy: vi.spyOn(target, 'addEventListener') }));
  return () => {
    spies.forEach(({ target, spy }) => {
      spy.mock.calls.forEach(([type, listener, options]) => {
        target.removeEventListener(type, listener, options);
      });
    });
  };
}

// Sets what document.visibilityState answers; dispatches visibilitychange
// unless told not to.
function setVisibility(state: DocumentVisibilityState, dispatch = true): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  if (dispatch) {
    document.dispatchEvent(new Event('visibilitychange'));
  }
}

export { resetContentRegistry, setPageUrl, setVisibility, trackPageListeners };
