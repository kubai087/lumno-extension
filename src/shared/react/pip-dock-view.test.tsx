import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPipDockView, type PipDockModel, type PipDockViewController } from './pip-dock-view';
import { getElement, getTags } from '../../../tests/fakes/dom';

let views: PipDockViewController[] = [];

const model: PipDockModel = {
  theme: {
    hudBackground: 'rgb(1, 1, 1)',
    hudBorder: 'rgb(2, 2, 2)',
    cardShadow: 'none',
    buttonBackground: 'rgb(3, 3, 3)',
    buttonText: 'rgb(4, 4, 4)',
    buttonShadow: 'none',
    secondaryButtonBackground: 'rgb(5, 5, 5)'
  },
  labels: { reselect: 'Reselect', close: 'Close' }
};

function setUp() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const handlers = { onReselect: vi.fn(), onClose: vi.fn() };
  const view = createPipDockView(host, handlers);
  views.push(view);
  act(() => view.render(model));
  return { host, handlers, dock: getElement(host, '[data-lumno-pip-dock="1"]') };
}

afterEach(() => {
  act(() => views.forEach((view) => view.destroy()));
  views = [];
  document.body.textContent = '';
  vi.useRealTimers();
});

describe('Page clip dock', () => {
  it('peeks out until the pointer nears the bottom edge, and hides again after a moment', () => {
    vi.useFakeTimers();
    const { dock } = setUp();
    expect([dock.dataset.expanded, dock.style.opacity]).toEqual([undefined, '0.92']);
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientY: window.innerHeight - 10 }));
    });
    expect([dock.dataset.expanded, dock.style.transform]).toEqual(['true', 'translateX(-50%) translateY(0)']);
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientY: 10 }));
    });
    expect(dock.dataset.expanded).toBe('true');
    act(() => {
      vi.advanceTimersByTime(140);
    });
    expect(dock.dataset.expanded).toBeUndefined();
  });

  it('draws its buttons in the clip theme and reports them', () => {
    const { host, handlers } = setUp();
    const buttons = getTags(host, '.lumno-pip-dock-btn', 'button');
    expect(buttons.map((button) => [button.textContent, button.style.background])).toEqual([
      ['Reselect', 'rgb(3, 3, 3)'],
      ['Close', 'rgb(5, 5, 5)']
    ]);
    act(() => buttons[0]?.click());
    act(() => buttons[1]?.click());
    expect([handlers.onReselect.mock.calls.length, handlers.onClose.mock.calls.length]).toEqual([1, 1]);
  });
});
