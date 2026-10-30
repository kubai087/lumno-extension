import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createToastStyleGate } from './toast-style-gate';

const BOOTSTRAP = ['opacity', 'pointer-events', 'transform', 'transition'];

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('toast style gate', () => {
  it('keeps the toast hidden and still until its stylesheet loads, then releases it two frames later', () => {
    const toast = document.createElement('div');
    const stylesheet = document.createElement('link');
    const removeListener = vi.spyOn(stylesheet, 'removeEventListener');
    const gate = createToastStyleGate(toast, { stylesheetElement: stylesheet, windowObj: window });
    expect(toast.style.getPropertyValue('opacity')).toBe('0');
    expect(toast.style.getPropertyValue('pointer-events')).toBe('none');
    expect(toast.style.getPropertyValue('transform')).toBe('translateX(-50%) translateY(-10px)');
    expect(toast.style.getPropertyValue('transition')).toBe('none');
    expect(gate.isReady()).toBe(false);

    stylesheet.dispatchEvent(new Event('load'));
    expect(gate.isReady()).toBe(true);
    expect(removeListener).toHaveBeenCalledWith('load', expect.any(Function));
    expect(toast.style.getPropertyValue('opacity')).toBe('0');
    vi.advanceTimersToNextFrame();
    expect(toast.style.getPropertyValue('opacity')).toBe('0');
    vi.advanceTimersToNextFrame();
    BOOTSTRAP.forEach((property) => expect(toast.style.getPropertyValue(property)).toBe(''));
    gate.destroy();
  });

  it('keeps the bootstrap styles when destroyed before the frames run', () => {
    const toast = document.createElement('div');
    const gate = createToastStyleGate(toast, { windowObj: window });
    gate.markReady();
    gate.destroy();
    vi.advanceTimersToNextFrame();
    vi.advanceTimersToNextFrame();
    expect(toast.style.getPropertyValue('opacity')).toBe('0');
  });
});
