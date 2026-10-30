import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFullscreenEscapeLock } from './fullscreen-escape-lock';

interface Harness {
  calls: unknown[][];
  setFullscreen(value: boolean): void;
}

function setFullscreenElement(element: Element | null): void {
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: element });
}

function createHarness(options: { fullscreen?: boolean; withoutKeyboard?: boolean; rejectLock?: boolean } = {}): Harness {
  const calls: unknown[][] = [];
  const player = document.createElement('video');
  setFullscreenElement(options.fullscreen ? player : null);
  const keyboard = options.withoutKeyboard ? undefined : {
    lock(keys: string[]) {
      calls.push(['lock', keys]);
      return options.rejectLock ? Promise.reject(new Error('refused')) : Promise.resolve();
    },
    unlock() {
      calls.push(['unlock']);
    }
  };
  Object.defineProperty(window.navigator, 'keyboard', { configurable: true, value: keyboard });
  return {
    calls,
    setFullscreen(value) {
      setFullscreenElement(value ? player : null);
      window.dispatchEvent(new Event('fullscreenchange'));
    }
  };
}

afterEach(() => {
  Reflect.deleteProperty(document, 'fullscreenElement');
  Reflect.deleteProperty(window.navigator, 'keyboard');
});

describe('fullscreen escape lock', () => {
  it('locks Escape while an element is fullscreen until the overlay closes', () => {
    const harness = createHarness({ fullscreen: true });
    const lock = createFullscreenEscapeLock(window);
    lock.start();
    expect(harness.calls).toEqual([['lock', ['Escape']]]);
    lock.start();
    expect(harness.calls).toHaveLength(1);
    lock.stop();
    expect(harness.calls).toEqual([['lock', ['Escape']], ['unlock']]);
    harness.setFullscreen(true);
    expect(harness.calls).toHaveLength(2);
    lock.stop();
    expect(harness.calls).toHaveLength(2);
  });

  it('locks nothing when no element is fullscreen', () => {
    const harness = createHarness();
    const lock = createFullscreenEscapeLock(window);
    lock.start();
    lock.stop();
    expect(harness.calls).toEqual([]);
  });

  it('follows fullscreen entered and left while the overlay is open', () => {
    const harness = createHarness();
    const lock = createFullscreenEscapeLock(window);
    lock.start();
    harness.setFullscreen(true);
    expect(harness.calls).toEqual([['lock', ['Escape']]]);
    harness.setFullscreen(false);
    expect(harness.calls).toEqual([['lock', ['Escape']], ['unlock']]);
    lock.stop();
    expect(harness.calls).toHaveLength(2);
  });

  it('ignores a fullscreen change after the overlay closed', () => {
    const harness = createHarness();
    const lock = createFullscreenEscapeLock(window);
    lock.start();
    lock.stop();
    harness.setFullscreen(true);
    expect(harness.calls).toEqual([]);
  });

  it('listens for nothing in a browser without the Keyboard Lock API', () => {
    createHarness({ fullscreen: true, withoutKeyboard: true });
    const addListener = vi.spyOn(window, 'addEventListener');
    const lock = createFullscreenEscapeLock(window);
    lock.start();
    lock.stop();
    expect(addListener).not.toHaveBeenCalled();
  });

  it('still releases a lock the browser refused', () => {
    const harness = createHarness({ fullscreen: true, rejectLock: true });
    const lock = createFullscreenEscapeLock(window);
    lock.start();
    lock.stop();
    expect(harness.calls).toEqual([['lock', ['Escape']], ['unlock']]);
  });
});
