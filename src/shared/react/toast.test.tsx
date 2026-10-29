import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createToastController } from './toast';
import type { ToastController } from '../ui/toast-screen';
import { getTestPortals } from '../../../tests/react/portals';

let controllers: ToastController[] = [];

function createController(duration = 2200): {
  controller: ToastController;
  element: HTMLDivElement;
} {
  const element = document.createElement('div');
  element.setAttribute('data-show', 'false');
  document.body.appendChild(element);
  const controller = createToastController(element, getTestPortals(), {
    windowObj: window,
    duration
  });
  controllers.push(controller);
  return { controller, element };
}

afterEach(() => {
  act(() => {
    controllers.forEach((controller) => controller.destroy());
  });
  controllers = [];
  vi.useRealTimers();
});

describe('Toast React island', () => {
  it('preserves the synchronous show and error palette contract', () => {
    const { controller, element } = createController();

    act(() => {
      controller.show('Saved', { error: true, duration: 0 });
    });

    expect(element.dataset.reactIsland).toBe('toast');
    expect(element.dataset.show).toBe('true');
    expect(element.textContent).toBe('Saved');
    expect(element.dataset.tone).toBe('error');
    expect(element.style.getPropertyValue('background')).toBe('');

    act(() => {
      controller.show('Done', { duration: 0 });
    });

    expect(element.textContent).toBe('Done');
    expect(element.dataset.tone).toBeUndefined();
  });

  it('skips the loading state for tasks that settle within the delay', () => {
    vi.useFakeTimers();
    const { controller, element } = createController();

    act(() => {
      const task = controller.begin('Importing…');
      vi.advanceTimersByTime(100);
      task.done('Imported');
    });

    expect(element.textContent).toBe('Imported');
    expect(element.dataset.tone).toBeUndefined();
    expect(element.querySelector('.x-lumno-toast-spinner')).toBeNull();
  });

  it('keeps a slow task on screen until it settles, around other messages', () => {
    vi.useFakeTimers();
    const { controller, element } = createController(1000);
    let task = controller.begin('');

    act(() => {
      task.cancel();
      task = controller.begin('Syncing…');
      vi.advanceTimersByTime(240);
    });
    expect(element.dataset.show).toBe('true');
    expect(element.dataset.tone).toBe('loading');
    expect(element.textContent).toBe('Syncing…');
    expect(element.querySelector('.x-lumno-toast-spinner')).not.toBeNull();

    act(() => {
      controller.show('Saved');
    });
    expect(element.textContent).toBe('Saved');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(element.textContent).toBe('Syncing…');
    expect(element.dataset.tone).toBe('loading');

    act(() => {
      task.fail('Sync failed');
    });
    expect(element.textContent).toBe('Sync failed');
    expect(element.dataset.tone).toBe('error');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(element.dataset.show).toBe('false');
  });

  it('hides a cancelled task without showing a result', () => {
    const { controller, element } = createController();
    let task = controller.begin('');

    act(() => {
      task.cancel();
      task = controller.begin('Saving…', { delay: 0 });
    });
    expect(element.dataset.show).toBe('true');

    act(() => {
      task.cancel();
      task.done('Ignored');
    });
    expect(element.dataset.show).toBe('false');
  });

  it('restarts the auto-hide timer when a newer message arrives', () => {
    vi.useFakeTimers();
    const { controller, element } = createController(1000);

    act(() => {
      controller.show('First');
      vi.advanceTimersByTime(700);
      controller.show('Second');
      vi.advanceTimersByTime(700);
    });
    expect(element.dataset.show).toBe('true');
    expect(element.textContent).toBe('Second');

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(element.dataset.show).toBe('false');
  });

  it('hides and unmounts safely when destroyed', () => {
    const { controller, element } = createController();

    act(() => {
      controller.show('Visible', { duration: 0 });
      controller.hide();
    });
    expect(element.dataset.show).toBe('false');

    act(() => {
      controller.destroy();
      controller.show('Ignored', { duration: 0 });
    });
    expect(element.textContent).toBe('');
    expect(element.dataset.show).toBe('false');
  });

  it('returns a safe no-op controller when no host exists', () => {
    const controller = createToastController(null, getTestPortals());
    expect(() => {
      controller.show('Ignored');
      controller.hide();
      controller.begin('Ignored').done('Ignored');
      controller.destroy();
    }).not.toThrow();
  });
});
