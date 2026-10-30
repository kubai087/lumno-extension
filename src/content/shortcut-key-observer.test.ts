import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContentChrome } from '../../tests/fakes/content-chrome';
import type { ContentChrome } from '../../tests/fakes/content-chrome';
import { resetContentRegistry, trackPageListeners } from '../../tests/fakes/content-page';
import { trustedKey } from '../../tests/fakes/trusted-events';

// What the script every frame of an ordinary page loads at document start
// sends the worker while the user works in the page.

let removeListeners: (() => void) | null = null;

async function loadObserver(options: { subframe?: boolean } = {}): Promise<ContentChrome> {
  resetContentRegistry();
  removeListeners = trackPageListeners();
  vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
  if (options.subframe) {
    vi.spyOn(window, 'top', 'get').mockReturnValue(null);
  }
  const fake = createContentChrome({ replies: { getShowSearchShortcut: () => ({ shortcut: 'Command+Shift+K' }) } });
  vi.stubGlobal('chrome', fake.chrome);
  vi.resetModules();
  await import('./shortcut-key-observer-entry');
  await vi.advanceTimersByTimeAsync(10);
  return fake;
}

// The window taking focus. Under Vitest the script's `window` is the test
// global, not the JSDOM window an event is dispatched on, so the event names
// the global as its target, as the page's own window would be in a browser.
function focusWindow(): void {
  const event = new FocusEvent('focus');
  Object.defineProperty(event, 'target', { get: () => window });
  window.dispatchEvent(event);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  if (removeListeners) removeListeners();
  removeListeners = null;
  resetContentRegistry();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('shortcut key observer page cost', () => {
  it('asks for the search shortcut once on load and stays quiet while elements take focus', async () => {
    const fake = await loadObserver();
    expect(fake.takeActions()).toEqual(['notifyTopFrameDocumentStarted', 'getShowSearchShortcut']);
    await vi.advanceTimersByTimeAsync(5000);
    for (let index = 0; index < 10; index += 1) {
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
    }
    await vi.advanceTimersByTimeAsync(10);
    expect(fake.takeActions()).toEqual([]);
  });

  it('refreshes the shortcut on window focus at most every two seconds, never reporting visibility', async () => {
    const fake = await loadObserver();
    fake.takeActions();
    // A focus right after load folds into the startup request.
    focusWindow();
    expect(fake.takeActions()).toEqual([]);
    await vi.advanceTimersByTimeAsync(2500);
    // The focus and visibilitychange of one tab switch ask once.
    focusWindow();
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(10);
    expect(fake.takeActions()).toEqual(['getShowSearchShortcut']);
    await vi.advanceTimersByTimeAsync(2500);
    focusWindow();
    expect(fake.takeActions()).toEqual(['getShowSearchShortcut']);
  });

  it('refreshes the shortcut when the page comes back from the back/forward cache', async () => {
    const fake = await loadObserver();
    fake.takeActions();
    await vi.advanceTimersByTimeAsync(5000);
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));
    expect(fake.takeActions()).toEqual([]);
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    await vi.advanceTimersByTimeAsync(10);
    expect(fake.takeActions()).toEqual(['getShowSearchShortcut']);
  });

  it('asks from a subframe only once its window takes focus', async () => {
    const fake = await loadObserver({ subframe: true });
    expect(fake.takeActions()).toEqual([]);
    focusWindow();
    await vi.advanceTimersByTimeAsync(10);
    expect(fake.takeActions()).toEqual(['getShowSearchShortcut']);
  });
});

// The observer as the tab switcher uses it: the worker arms the frame with
// the shortcut's modifier, and the frame relays that modifier's release,
// replaying one that came before the arm message.
describe('shortcut key observer tab switcher release relay', () => {
  // The worker answers the show-search shortcut only once a key asks for it,
  // and a release relay with whether it committed a switcher.
  async function loadRelayObserver(committed: () => boolean = () => false) {
    resetContentRegistry();
    removeListeners = trackPageListeners();
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    const fake = createContentChrome({
      replies: {
        getShowSearchShortcut: 'never',
        triggerShowSearchFromPageHotkey: () => ({ shortcut: 'Command+Shift+K' }),
        notifyTabSwitcherShortcutModifierReleased: () => ({ ok: true, committed: committed() })
      }
    });
    vi.stubGlobal('chrome', fake.chrome);
    vi.resetModules();
    await import('./shortcut-key-observer-entry');
    return fake;
  }

  // The worker's arm message, and the frame's answer.
  const arm = (fake: ContentChrome, keys: string[], commandStartedAt?: number) =>
    fake.dispatch({ action: 'armTabSwitcherShortcutRelease', keys, commandStartedAt });
  const press = (init: KeyboardEventInit, target: EventTarget = document.body) => trustedKey(target, 'keydown', init);
  const release = (key: string, code: string) => trustedKey(document.body, 'keyup', { key, code });
  const relayed = (fake: ContentChrome) => fake.messages
    .filter((message) => message.action === 'notifyTabSwitcherShortcutModifierReleased')
    .map((message) => message.key);

  it('announces the committed top-frame Document once, with its own address', async () => {
    const fake = await loadRelayObserver();
    expect(fake.messages.filter((message) => message.action === 'notifyTopFrameDocumentStarted')).toEqual([
      expect.objectContaining({ documentReadyState: 'loading', documentUrl: location.href })
    ]);
  });

  it('lets the worker verify the first trusted shortcut while its own is unknown, then matches it itself', async () => {
    const fake = await loadRelayObserver();
    fake.takeActions();
    const field = document.body.appendChild(document.createElement('input'));
    const pageKeys: string[] = [];
    document.addEventListener('keydown', (event) => pageKeys.push(event.key));
    const shortcut = { key: 'k', code: 'KeyK', metaKey: true, shiftKey: true };

    field.dispatchEvent(new KeyboardEvent('keydown', { ...shortcut, bubbles: true }));
    expect(fake.messages).toEqual([]);

    const unresolved = press(shortcut, field);
    expect(unresolved.defaultPrevented).toBe(false);
    expect(pageKeys).toEqual(['k', 'k']);
    expect(fake.messages).toEqual([expect.objectContaining({
      action: 'triggerShowSearchFromPageHotkey',
      documentIsTop: true,
      documentUrl: location.href,
      observedShortcut: { ctrlKey: false, altKey: false, shiftKey: true, metaKey: true, key: 'k' },
      requiresShortcutVerification: true,
      trustedShortcutFallback: true
    })]);
    // The worker's answer carries the shortcut.
    await vi.advanceTimersByTimeAsync(10);
    fake.messages.length = 0;
    pageKeys.length = 0;

    // In an editable field too.
    const matched = press(shortcut, field);
    expect(matched.defaultPrevented).toBe(true);
    expect(pageKeys).toEqual([]);
    expect(fake.messages).toHaveLength(1);
    expect(fake.messages[0]).toMatchObject({ action: 'triggerShowSearchFromPageHotkey', documentIsTop: true, trustedShortcutFallback: true });
    expect(fake.messages[0].requiresShortcutVerification).toBeUndefined();
    field.remove();
  });

  it('never polls the worker for the shortcut while the user types', async () => {
    const fake = await loadRelayObserver();
    fake.takeActions();
    for (let index = 0; index < 5; index += 1) {
      await vi.advanceTimersByTimeAsync(20 * 1000);
      press({ key: 'a', code: 'KeyA' });
    }
    expect(fake.takeActions()).not.toContain('getShowSearchShortcut');
  });

  it('relays only a trusted release of the armed modifier, once', async () => {
    const fake = await loadRelayObserver();
    document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'Meta', code: 'MetaLeft' }));
    release('1', 'Digit1');
    expect(relayed(fake)).toEqual([]);

    expect(await arm(fake, ['Meta'])).toEqual({ ok: true });
    // Releasing the trigger key leaves Command held: no commit, still armed.
    release('1', 'Digit1');
    expect(relayed(fake)).toEqual([]);
    release('Meta', 'MetaLeft');
    expect(relayed(fake)).toEqual(['Meta']);
    release('Meta', 'MetaLeft');
    expect(relayed(fake)).toEqual(['Meta']);

    // Ctrl+Shift+/ commits on Control, not on Slash.
    await arm(fake, ['Control']);
    release('?', 'Slash');
    expect(relayed(fake)).toEqual(['Meta']);
    release('Control', 'ControlLeft');
    expect(relayed(fake)).toEqual(['Meta', 'Control']);
  });

  it('replays a release that beat the arm message for the same command, and none from before it', async () => {
    const fake = await loadRelayObserver();
    const quickStart = Date.now();
    await vi.advanceTimersByTimeAsync(10);
    release('Meta', 'MetaRight');
    await arm(fake, ['Meta'], quickStart);
    expect(relayed(fake)).toEqual(['Meta']);

    // A press and release just before a cold worker stamped the command.
    press({ key: 'q', code: 'KeyQ', altKey: true });
    release('Alt', 'AltLeft');
    await arm(fake, ['Alt'], Date.now() + 1);
    expect(relayed(fake)).toEqual(['Meta', 'Alt']);

    // A release with no press, from before the command started.
    release('Control', 'ControlRight');
    await arm(fake, ['Control'], Date.now() + 1000);
    expect(relayed(fake)).toEqual(['Meta', 'Alt']);
    release('Control', 'ControlLeft');
    expect(relayed(fake)).toEqual(['Meta', 'Alt', 'Control']);
  });

  // Each switcher command injects the observer into its tab again.
  it('keeps observing through a second injection, with what it already knew', async () => {
    const fake = await loadRelayObserver();
    press({ key: 'k', code: 'KeyK', metaKey: true, shiftKey: true });
    await vi.advanceTimersByTimeAsync(10);
    fake.takeActions();
    const commandStartedAt = Date.now();
    press({ key: 'q', code: 'KeyQ', altKey: true });
    release('Alt', 'AltLeft');

    vi.resetModules();
    await import('./shortcut-key-observer-entry');
    await vi.advanceTimersByTimeAsync(10);
    expect(fake.takeActions()).toEqual([]);

    await arm(fake, ['Alt'], commandStartedAt);
    expect(relayed(fake)).toEqual(['Alt']);
    // One keyup listener: the next release is relayed once.
    await arm(fake, ['Alt']);
    release('Alt', 'AltLeft');
    expect(relayed(fake)).toEqual(['Alt', 'Alt']);
  });

  // Every tab in the window stays armed after a switcher closes, so a quick
  // press there is relayed before the next switcher exists.
  it('keeps an early relayed release buffered until the worker reports a commit', async () => {
    let committed = false;
    const fake = await loadRelayObserver(() => committed);
    await arm(fake, ['Alt'], 0);
    const commandStartedAt = Date.now();
    press({ key: 'Alt', code: 'AltLeft', altKey: true });
    release('Alt', 'AltLeft');
    await vi.advanceTimersByTimeAsync(10);
    expect(relayed(fake)).toEqual(['Alt']);
    await arm(fake, ['Alt'], commandStartedAt);
    expect(relayed(fake)).toEqual(['Alt', 'Alt']);
    await vi.advanceTimersByTimeAsync(10);

    committed = true;
    await arm(fake, ['Alt'], 0);
    press({ key: 'Alt', code: 'AltLeft', altKey: true });
    release('Alt', 'AltLeft');
    await vi.advanceTimersByTimeAsync(10);
    expect(relayed(fake)).toEqual(['Alt', 'Alt', 'Alt']);
    await arm(fake, ['Alt'], commandStartedAt);
    expect(relayed(fake)).toEqual(['Alt', 'Alt', 'Alt']);
  });
});
