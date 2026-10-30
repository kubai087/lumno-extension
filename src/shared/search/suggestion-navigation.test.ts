import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getSuggestionNavigationKey,
  getVisibleRowsViewportHeight,
  handleNumberShortcutKeyEvent,
  preventNumberShortcutWheel
} from './suggestion-navigation';

const MAC = { platform: 'MacIntel' };

function ctrl(key: string, code: string, extra: KeyboardEventInit = {}) {
  return { key, code, ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, ...extra };
}

describe('suggestion navigation keys', () => {
  it('moves with Ctrl+N and Ctrl+P only with the macOS experiment on, on macOS, without other modifiers', () => {
    expect(getSuggestionNavigationKey(ctrl('n', 'KeyN'), { macosCtrlEnabled: false, navigatorLike: MAC })).toBe('');
    expect(getSuggestionNavigationKey(ctrl('n', 'KeyN'), { macosCtrlEnabled: true, navigatorLike: MAC })).toBe('ArrowDown');
    expect(getSuggestionNavigationKey(ctrl('p', 'KeyP'), { macosCtrlEnabled: true, navigatorLike: MAC })).toBe('ArrowUp');
    expect(getSuggestionNavigationKey(ctrl('n', 'KeyN'), { macosCtrlEnabled: true, navigatorLike: { platform: 'Win32' } })).toBe('');
    expect(getSuggestionNavigationKey(ctrl('n', 'KeyN', { shiftKey: true }), { macosCtrlEnabled: true, navigatorLike: MAC })).toBe('');
  });

  it('moves with the arrow keys on every platform', () => {
    expect(getSuggestionNavigationKey({ key: 'ArrowDown' }, { macosCtrlEnabled: false, navigatorLike: { platform: 'Win32' } })).toBe('ArrowDown');
  });
});

describe('visible rows viewport', () => {
  const rows = { visibleRowLimit: 5, rowHeight: 52, rowGap: 4, paddingTop: 12, paddingBottom: 12 };

  it('includes the gap after the last visible row only when more rows follow', () => {
    expect(getVisibleRowsViewportHeight({ ...rows, itemCount: 10 })).toBe(304);
    expect(getVisibleRowsViewportHeight({ ...rows, itemCount: 5 })).toBe(300);
  });

  it('forces no height on an empty list', () => {
    expect(getVisibleRowsViewportHeight({ ...rows, itemCount: 0 })).toBe(0);
  });
});

// Holding the primary modifier over results arms number jump mode (the
// surface shows a Toast); releasing it shows a number on each result, and a
// digit opens that result.
describe('number shortcuts', () => {
  let container: HTMLElement;
  let activated: number[];
  let items: Array<{ click(): void }>;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    activated = [];
    items = Array.from({ length: 3 }, (_, index) => ({ click: () => activated.push(index) }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const key = (type: 'keydown' | 'keyup', init: KeyboardEventInit) => new KeyboardEvent(type, { cancelable: true, bubbles: true, ...init });
  const handle = (event: KeyboardEvent, options: object) => handleNumberShortcutKeyEvent(event, items, container, options);
  const mode = () => [container.getAttribute('data-number-shortcuts-active'), container.getAttribute('data-number-shortcuts-scroll-locked')];

  function holdOptions(signals: string[], primaryModifier = 'meta') {
    return {
      primaryModifier,
      holdDurationMs: 5,
      timeoutMs: 20,
      onHoldStart: () => signals.push('start'),
      onHoldEnd: () => signals.push('end')
    };
  }

  it('locks scrolling after the hold and shows the numbers on release, leaving the modifier to the browser until then', () => {
    const signals: string[] = [];
    const options = holdOptions(signals);
    const down = key('keydown', { key: 'Meta', code: 'MetaLeft', metaKey: true });
    expect(handle(down, options)).toBe(false);
    expect(down.defaultPrevented).toBe(false);
    expect(mode()).toEqual([null, null]);

    vi.advanceTimersByTime(10);
    expect(signals).toEqual(['start']);
    expect(mode()).toEqual([null, 'true']);
    const wheel = new WheelEvent('wheel', { cancelable: true });
    expect(preventNumberShortcutWheel(wheel, container)).toBe(true);
    expect(wheel.defaultPrevented).toBe(true);

    const up = key('keyup', { key: 'Meta', code: 'MetaLeft' });
    expect(handle(up, options)).toBe(true);
    expect(signals).toEqual(['start', 'end']);
    expect(up.defaultPrevented).toBe(true);
    expect(mode()).toEqual(['true', 'true']);
    expect(activated).toEqual([]);
  });

  it('opens the result of a plain digit after the release and leaves number mode', () => {
    const options = holdOptions([]);
    handle(key('keydown', { key: 'Meta', code: 'MetaLeft', metaKey: true }), options);
    vi.advanceTimersByTime(10);
    handle(key('keyup', { key: 'Meta', code: 'MetaLeft' }), options);
    const digit = key('keydown', { key: '2', code: 'Digit2' });
    expect(handle(digit, options)).toBe(true);
    expect(digit.defaultPrevented).toBe(true);
    expect(digit.cancelBubble).toBe(true);
    expect(activated).toEqual([2]);
    expect(mode()).toEqual([null, null]);
  });

  it('stays invisible and unconsumed on a quick tap of the modifier', () => {
    const signals: string[] = [];
    const options = { primaryModifier: 'meta', holdDurationMs: 20, onHoldStart: () => signals.push('start'), onHoldEnd: () => signals.push('end') };
    handle(key('keydown', { key: 'Meta', metaKey: true }), options);
    expect(handle(key('keyup', { key: 'Meta' }), options)).toBe(false);
    vi.advanceTimersByTime(25);
    expect(signals).toEqual([]);
    expect(mode()[0]).toBeNull();
  });

  it('leaves Command with a digit to the browser while Command is held', () => {
    const event = key('keydown', { key: '1', metaKey: true });
    expect(handle(event, holdOptions([]))).toBe(false);
    expect(event.defaultPrevented).toBe(false);
    expect(activated).toEqual([]);
  });

  it('in instant mode shows the numbers while the modifier is held and opens a digit pressed with it', () => {
    const options = { primaryModifier: 'meta', timeoutMs: 5, instantActive: true };
    expect(handle(key('keydown', { key: 'Meta', code: 'MetaLeft', metaKey: true }), options)).toBe(false);
    expect(mode()[0]).toBe('true');
    vi.advanceTimersByTime(10);
    expect(mode()[0]).toBe('true');
    expect(handle(key('keyup', { key: 'Meta', code: 'MetaLeft' }), options)).toBe(false);
    expect(mode()[0]).toBeNull();

    handle(key('keydown', { key: 'Meta', code: 'MetaLeft', metaKey: true }), options);
    expect(handle(key('keydown', { key: '1', code: 'Digit1', metaKey: true }), options)).toBe(true);
    expect(activated).toEqual([1]);
    expect(mode()[0]).toBeNull();
  });

  it('cancels an armed hold on another key without taking it', () => {
    const signals: string[] = [];
    const options = { ...holdOptions(signals, 'ctrl'), timeoutMs: 10 };
    handle(key('keydown', { key: 'Control', ctrlKey: true }), options);
    vi.advanceTimersByTime(10);
    const enter = key('keydown', { key: 'Enter', ctrlKey: true });
    expect(handle(enter, options)).toBe(false);
    expect(signals).toEqual(['start', 'end']);
    expect(enter.defaultPrevented).toBe(false);
    expect(mode()[1]).toBeNull();
  });

  it('leaves number mode on Escape, or by itself after its timeout, when scrolling resumes', () => {
    const options = { ...holdOptions([], 'ctrl'), timeoutMs: 10 };
    const arm = () => {
      handle(key('keydown', { key: 'Control', ctrlKey: true }), options);
      vi.advanceTimersByTime(10);
      handle(key('keyup', { key: 'Control' }), options);
    };
    arm();
    const escape = key('keydown', { key: 'Escape', code: 'Escape' });
    expect(handle(escape, options)).toBe(true);
    expect(escape.defaultPrevented).toBe(true);

    arm();
    vi.advanceTimersByTime(15);
    expect(mode()[0]).toBeNull();
    expect(preventNumberShortcutWheel(new WheelEvent('wheel', { cancelable: true }), container)).toBe(false);
  });
});
