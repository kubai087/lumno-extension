import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OverlayKeyRouter, isOverlayKeyEvent, type OverlayKeyRouterHandlers } from './keyboard';
import { handleNumberShortcutKeyEvent } from '../shared/search/suggestion-navigation';
import { dispatchTrusted, trustedKey } from '../../tests/fakes/trusted-events';

// The overlay listens for keys on the host page's window and document; its
// panel sits in a closed shadow root.
function createOverlayMount() {
  const panel = document.body.appendChild(document.createElement('div'));
  const host = document.body.appendChild(document.createElement('div'));
  const shadowRoot = host.attachShadow({ mode: 'closed' });
  const input = document.createElement('input');
  const button = document.createElement('button');
  const modeMenu = document.createElement('div');
  modeMenu.tabIndex = -1;
  shadowRoot.append(input, button, modeMenu);
  return { host, panel, shadowRoot, input, button, modeMenu, mount: { document, host, panel } };
}

const keyInit = (key: string, init: KeyboardEventInit = {}): KeyboardEventInit => ({ key, ...init });

afterEach(() => {
  document.body.replaceChildren();
});

describe('Overlay key ownership', () => {
  function ownershipAt(target: EventTarget, mount: ReturnType<typeof createOverlayMount>['mount'], key = 'ArrowDown') {
    let owned: boolean | null = null;
    const listener = (event: KeyboardEvent) => {
      owned = isOverlayKeyEvent(event, mount);
    };
    document.addEventListener('keydown', listener);
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true }));
    document.removeEventListener('keydown', listener);
    return owned;
  }

  it('claims keys from its own controls, and keys sent while nothing on the page is focused', () => {
    const { input, button, mount } = createOverlayMount();
    expect(ownershipAt(input, mount)).toBe(true);
    expect(ownershipAt(button, mount, 'Enter')).toBe(true);
    expect(ownershipAt(document.body, mount)).toBe(true);
    expect(ownershipAt(document.documentElement, mount)).toBe(true);
  });

  it('leaves a focused host-page control its arrows, Enter and digits', () => {
    const { mount } = createOverlayMount();
    const field = document.body.appendChild(document.createElement('textarea'));
    const pageButton = document.body.appendChild(document.createElement('button'));
    const editor = document.body.appendChild(document.createElement('div'));
    editor.setAttribute('contenteditable', 'true');

    expect(ownershipAt(field, mount, 'Enter')).toBe(false);
    expect(ownershipAt(field, mount)).toBe(false);
    expect(ownershipAt(pageButton, mount, '2')).toBe(false);
    expect(ownershipAt(editor, mount)).toBe(false);
  });

  it('leaves an editable host-page body its keys', () => {
    const { mount } = createOverlayMount();
    document.body.setAttribute('contenteditable', 'true');
    try {
      expect(ownershipAt(document.body, mount)).toBe(false);
    } finally {
      document.body.removeAttribute('contenteditable');
    }
  });

  it('claims no key without an event', () => {
    expect(isOverlayKeyEvent(null, createOverlayMount().mount)).toBe(false);
  });
});

describe('Overlay key router', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // The real router with the overlay's handlers recorded. Keys reach it as
  // trusted input, the way the keyboard gives them.
  function startRouter(handlers: OverlayKeyRouterHandlers = {}) {
    const parts = createOverlayMount();
    const { shadowRoot, input, modeMenu, panel } = parts;
    const suggestionsContainer = panel.appendChild(document.createElement('div'));
    const state = { yielded: false, ctrlNavigation: false };
    const activated: number[] = [];
    const holdSignals: string[] = [];
    const inputKeys: string[] = [];
    const modeMenuKeys: string[] = [];
    const takenEscapes: string[] = [];
    const onKeyUp = vi.fn();
    const rows = [0, 1, 2].map((index) => ({ click: () => activated.push(index) }));
    const router = new OverlayKeyRouter(window, {
      getMount: () => parts.mount,
      isOverlayConnected: () => panel.isConnected,
      isKeyboardYielded: () => state.yielded,
      isSearchInputActive: () => shadowRoot.activeElement === input,
      shouldHandleModeMenuKey: () => shadowRoot.activeElement === modeMenu,
      handleModeMenuKey(event) {
        modeMenuKeys.push(event.key);
        event.preventDefault();
        if (event.key === 'Tab') {
          input.focus();
        }
        return true;
      },
      isImeComposition: (event) => event.isComposing,
      handleInputKeydown(event) {
        inputKeys.push(event.key);
        if (event.key === 'Tab') {
          event.preventDefault();
        }
      },
      handleNumberShortcut: (event) => handleNumberShortcutKeyEvent(event, rows, suggestionsContainer, {
        primaryModifier: 'meta',
        holdDurationMs: 5,
        timeoutMs: 50,
        onHoldStart: () => holdSignals.push('toast-show'),
        onHoldEnd: () => holdSignals.push('toast-hide')
      }),
      getSuggestionNavigationKey: (event) => (state.ctrlNavigation && event.ctrlKey && event.key.toLowerCase() === 'n' ? 'ArrowDown' : ''),
      onKeyUp,
      onEscapeTaken: (event) => takenEscapes.push(event.type),
      ...handlers
    });
    router.start();
    // What the host page (and another extension) hears.
    const pageKeys: string[] = [];
    const record = (event: KeyboardEvent) => pageKeys.push(`${event.type}:${event.key}`);
    document.addEventListener('keydown', record);
    document.addEventListener('keyup', record);
    document.addEventListener('keypress', record);
    const press = (target: EventTarget, key: string, init: KeyboardEventInit = {}) => trustedKey(target, 'keydown', keyInit(key, init));
    const release = (target: EventTarget, key: string, init: KeyboardEventInit = {}) => trustedKey(target, 'keyup', keyInit(key, init));
    input.focus();
    return {
      ...parts, router, state, activated, holdSignals, inputKeys, modeMenuKeys, takenEscapes, onKeyUp,
      suggestionsContainer, pageKeys, press, release
    };
  }

  it('keeps an IME composition away from both Lumno and the page, without blocking it', () => {
    const { input, inputKeys, pageKeys, press } = startRouter();
    const event = press(input, 'f', { code: 'KeyF', isComposing: true });
    expect(event.defaultPrevented).toBe(false);
    expect(inputKeys).toEqual([]);
    expect(pageKeys).toEqual([]);
  });

  it('runs typed keys through the overlay input and keeps them from page shortcuts', () => {
    const { input, inputKeys, pageKeys, press } = startRouter();
    press(input, 'x', { code: 'KeyX' });
    expect(inputKeys).toEqual(['x']);
    expect(pageKeys).toEqual([]);
  });

  it('keeps both presses of the double-Tab shortcut in the input', () => {
    const { input, inputKeys, pageKeys, press, release } = startRouter();
    const presses = [0, 1].map(() => {
      const event = press(input, 'Tab', { code: 'Tab' });
      release(input, 'Tab', { code: 'Tab' });
      return event;
    });
    expect(inputKeys).toEqual(['Tab', 'Tab']);
    expect(presses.every((event) => event.defaultPrevented)).toBe(true);
    expect(pageKeys).toEqual([]);
  });

  it('moves through results with Ctrl+N only while that experiment is on', () => {
    const { input, inputKeys, pageKeys, press, state } = startRouter();
    press(input, 'n', { code: 'KeyN', ctrlKey: true });
    expect(pageKeys).toEqual(['keydown:n']);
    expect(inputKeys).toEqual([]);

    pageKeys.length = 0;
    state.ctrlNavigation = true;
    press(input, 'n', { code: 'KeyN', ctrlKey: true });
    expect(inputKeys).toEqual(['n']);
    expect(pageKeys).toEqual([]);
  });

  it('opens number jump mode on a held modifier and picks a result by its number', () => {
    const { input, activated, holdSignals, suggestionsContainer, pageKeys, press, release } = startRouter();
    const hold = press(input, 'Meta', { code: 'MetaLeft', metaKey: true });
    expect(suggestionsContainer.getAttribute('data-number-shortcuts-active')).toBeNull();
    expect(hold.defaultPrevented).toBe(false);
    expect(pageKeys).toEqual(['keydown:Meta']);

    vi.advanceTimersByTime(10);
    expect(holdSignals).toEqual(['toast-show']);
    expect(suggestionsContainer.getAttribute('data-number-shortcuts-scroll-locked')).toBe('true');
    const letGo = release(input, 'Meta', { code: 'MetaLeft' });
    expect(suggestionsContainer.getAttribute('data-number-shortcuts-active')).toBe('true');
    expect(letGo.defaultPrevented).toBe(true);
    expect(holdSignals).toEqual(['toast-show', 'toast-hide']);

    pageKeys.length = 0;
    const choose = press(input, '2', { code: 'Digit2' });
    expect(activated).toEqual([2]);
    expect(suggestionsContainer.getAttribute('data-number-shortcuts-active')).toBeNull();
    expect(choose.defaultPrevented).toBe(true);
    expect(pageKeys).toEqual([]);
  });

  it('runs the scope panel keys through its own handler, keeping them from the page', () => {
    const { input, modeMenu, shadowRoot, modeMenuKeys, onKeyUp, pageKeys, press, release } = startRouter();
    modeMenu.focus();
    ['ArrowDown', 'Enter', 'Tab'].forEach((key) => {
      press(modeMenu, key);
      release(key === 'Tab' ? input : modeMenu, key);
    });
    expect(modeMenuKeys).toEqual(['ArrowDown', 'Enter', 'Tab']);
    expect(shadowRoot.activeElement).toBe(input);
    expect(pageKeys).toEqual([]);
    // A keyup ends the window in which an IME commit's Enter is ignored.
    expect(onKeyUp).toHaveBeenCalled();
  });

  // ChatGPT focuses its composer on a window keypress, Cmd+V included, while
  // the focused element is not a native input, which the shadow host never is.
  it('keeps modifier keypresses from the page, while modifier keydowns pass for shortcuts', () => {
    const { input, pageKeys, press } = startRouter();
    const windowKeypresses: string[] = [];
    const recordKeypress = (event: KeyboardEvent) => windowKeypresses.push(event.key);
    window.addEventListener('keypress', recordKeypress);
    try {
      const paste = press(input, 'v', { code: 'KeyV', metaKey: true });
      pageKeys.length = 0;
      ['metaKey', 'ctrlKey', 'altKey'].forEach((modifier) => {
        dispatchTrusted(input, new KeyboardEvent('keypress', { key: 'v', code: 'KeyV', bubbles: true, cancelable: true, composed: true, [modifier]: true }));
      });
      expect(windowKeypresses).toEqual([]);
      expect(pageKeys).toEqual([]);
      expect(paste.defaultPrevented).toBe(false);
    } finally {
      window.removeEventListener('keypress', recordKeypress);
    }

    pageKeys.length = 0;
    press(input, 'v', { code: 'KeyV', metaKey: true });
    expect(pageKeys).toEqual(['keydown:v']);
  });

  it('lets every key pass while the tab switcher holds the keyboard', () => {
    const { input, inputKeys, press, release, state } = startRouter();
    state.yielded = true;
    const switcherKeys: string[] = [];
    const recordSwitcherKey = (event: KeyboardEvent) => switcherKeys.push(`${event.type}:${event.key}`);
    // The switcher listens on the window after the router.
    window.addEventListener('keydown', recordSwitcherKey, true);
    window.addEventListener('keyup', recordSwitcherKey, true);
    try {
      ['ArrowRight', 'Enter', 'Escape', 'Tab'].forEach((key) => press(input, key));
      release(input, 'Alt', { code: 'AltLeft' });
    } finally {
      window.removeEventListener('keydown', recordSwitcherKey, true);
      window.removeEventListener('keyup', recordSwitcherKey, true);
    }
    expect(switcherKeys).toEqual(['keydown:ArrowRight', 'keydown:Enter', 'keydown:Escape', 'keydown:Tab', 'keyup:Alt']);
    expect(inputKeys).toEqual([]);
  });

  // Surfingkeys keeps the Escape keydown that leaves its insert mode (#127).
  it('closes on an Escape keyup whose keydown another listener took, and only then', () => {
    const { input, takenEscapes, press, release, state } = startRouter();
    press(input, 'Escape', { code: 'Escape' });
    release(input, 'Escape', { code: 'Escape' });
    expect(takenEscapes).toEqual([]);

    state.yielded = true;
    press(input, 'Escape', { code: 'Escape' });
    state.yielded = false;
    release(input, 'Escape', { code: 'Escape' });
    expect(takenEscapes).toEqual([]);

    release(input, 'Escape', { code: 'Escape' });
    expect(takenEscapes).toEqual(['keyup']);
  });

  it('stops isolating the input once stopped', () => {
    const { input, router, pageKeys, press } = startRouter();
    router.stop();
    press(input, 'y');
    expect(pageKeys).toEqual(['keydown:y']);
  });

  // A web page can dispatch key events of its own; they must neither drive
  // the overlay nor reach the page's own listeners through it.
  it('swallows synthetic keys before the page sees them and hands them to no handler', () => {
    const calls: string[] = [];
    const recordCall = (name: string) => (event: KeyboardEvent) => {
      calls.push(`${name}:${event.key}`);
      return true;
    };
    const { input, pageKeys } = startRouter({
      handleInputKeydown: recordCall('input'),
      handleTab: recordCall('tab'),
      handleOverlayKeydown: recordCall('overlay-keydown'),
      handleOverlayKeyup: recordCall('overlay-keyup'),
      handleNumberShortcut: () => false,
      onEscapeOutside: recordCall('escape')
    });
    ['Enter', 'Tab', 'ArrowDown', 'Escape'].forEach((key) => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }));
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      document.body.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
    });
    expect(calls).toEqual([]);
    expect(pageKeys).toEqual([]);

    trustedKey(input, 'keydown', { key: 'Enter' });
    expect(calls).toEqual(['input:Enter']);
  });
});
