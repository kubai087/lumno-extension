import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createToastController } from './toast';

function createToast() {
  const element = document.createElement('div');
  document.body.appendChild(element);
  return { element, controller: createToastController(element, { windowObj: window }) };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DOM toast', () => {
  it('shows a message for 2.2 seconds, or until hidden', () => {
    const { element, controller } = createToast();
    controller.show('Press Backspace again');
    expect(element.textContent).toBe('Press Backspace again');
    expect(element.getAttribute('data-show')).toBe('true');
    vi.advanceTimersByTime(2199);
    expect(element.getAttribute('data-show')).toBe('true');
    vi.advanceTimersByTime(1);
    expect(element.getAttribute('data-show')).toBe('false');

    controller.show('Again');
    controller.hide();
    expect(element.getAttribute('data-show')).toBe('false');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('takes the error palette from its stylesheet and keeps a message without a duration', () => {
    const { element, controller } = createToast();
    controller.show('Failed', { error: true, duration: 0 });
    expect(element.getAttribute('data-tone')).toBe('error');
    // The error palette comes from toast.css so its text color can follow.
    expect(element.style.getPropertyValue('background')).toBe('');
    expect(vi.getTimerCount()).toBe(0);
    controller.show('Saved', { duration: 0 });
    expect(element.getAttribute('data-tone')).not.toBe('error');
  });

  it('never flashes the loading copy of a quick task', () => {
    const { element, controller } = createToast();
    const task = controller.begin('Importing…');
    expect(element.getAttribute('data-show')).not.toBe('true');
    task.done('Imported');
    expect(element.textContent).toBe('Imported');
    expect(element.getAttribute('data-tone')).not.toBe('loading');
  });

  it('keeps a slow task on screen around a message from elsewhere', () => {
    const { element, controller } = createToast();
    const task = controller.begin('Syncing…');
    vi.runOnlyPendingTimers();
    expect(element.getAttribute('data-tone')).toBe('loading');
    expect(element.getAttribute('data-show')).toBe('true');
    expect(element.textContent).toBe('Syncing…');
    controller.show('Saved');
    expect(element.textContent).toBe('Saved');
    vi.runOnlyPendingTimers();
    expect(element.textContent).toBe('Syncing…');
    expect(element.getAttribute('data-tone')).toBe('loading');
    task.fail('Sync failed');
    expect(element.getAttribute('data-tone')).toBe('error');
    expect(element.textContent).toBe('Sync failed');
    vi.runOnlyPendingTimers();
    expect(element.getAttribute('data-show')).toBe('false');
  });

  it('hides a cancelled task and ignores its result', () => {
    const { element, controller } = createToast();
    const task = controller.begin('Saving…', { delay: 0 });
    expect(element.textContent).toBe('Saving…');
    task.cancel();
    expect(element.getAttribute('data-show')).toBe('false');
    task.done('Ignored after cancel');
    expect(element.getAttribute('data-show')).toBe('false');
  });

  it('ignores everything once destroyed', () => {
    const { element, controller } = createToast();
    controller.show('Kept', { duration: 0 });
    controller.hide();
    controller.destroy();
    controller.show('Ignored');
    expect(element.textContent).toBe('Kept');
    controller.begin('Ignored', { delay: 0 }).done('Ignored');
    expect(element.getAttribute('data-show')).toBe('false');
  });
});
