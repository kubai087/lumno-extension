import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RecentModeSwitch, type RecentModeSwitchModel } from './recent-mode-switch';
import { getTag, getTags } from '../../../tests/fakes/dom';

let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
  vi.useRealTimers();
});

function mount(value: string, onChange = vi.fn()) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const model = (next: string): RecentModeSwitchModel => ({
    title: 'Display mode',
    value: next,
    options: [{ value: 'latest', label: 'Recent' }, { value: 'most', label: 'Most visited' }],
    onChange
  });
  const nextRoot = createRoot(host);
  root = nextRoot;
  act(() => nextRoot.render(<RecentModeSwitch model={model(value)} />));
  return {
    host,
    onChange,
    rerender: (next: string) => act(() => nextRoot.render(<RecentModeSwitch model={model(next)} />)),
    control: () => getTag(host, '.x-nt-recent-mode-switch', 'div'),
    options: () => getTags(host, '.x-nt-recent-mode-switch-option', 'button')
  };
}

describe('New Tab recent mode switch', () => {
  it('reads as the current mode with it first, as a radio group', () => {
    const view = mount('most');

    expect(view.control().getAttribute('role')).toBe('radiogroup');
    expect(view.control().getAttribute('aria-label')).toBe('Display mode');
    expect(view.control().dataset.expanded).toBe('false');
    expect(view.options().map((option) => option.dataset.value)).toEqual(['most', 'latest']);
    expect(view.options().map((option) => option.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    expect(view.options().map((option) => option.tabIndex)).toEqual([0, -1]);
  });

  it('opens on the first click and switches on the next', () => {
    const view = mount('latest');

    act(() => view.options()[1].click());
    expect(view.control().dataset.expanded).toBe('true');
    expect(view.onChange).not.toHaveBeenCalled();
    act(() => view.options()[1].click());
    expect(view.onChange).toHaveBeenCalledWith('most');
  });

  it('opens on hover after a pause and closes after the pointer leaves', () => {
    vi.useFakeTimers();
    const view = mount('latest');
    const pointer = (type: string) => {
      const event = new MouseEvent(type, { bubbles: true });
      Object.defineProperty(event, 'pointerType', { value: 'mouse' });
      view.control().dispatchEvent(event);
    };

    act(() => pointer('pointerover'));
    act(() => { vi.advanceTimersByTime(120); });
    expect(view.control().dataset.expanded).toBe('true');
    act(() => pointer('pointerout'));
    act(() => { vi.advanceTimersByTime(220); });
    expect(view.control().dataset.expanded).toBe('false');
  });

  it('moves the selection with arrow keys and closes on Escape', () => {
    const view = mount('latest');

    act(() => {
      view.options()[0].dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }));
    });
    expect(view.control().dataset.expanded).toBe('true');
    expect(view.onChange).toHaveBeenCalledWith('most');
    act(() => {
      view.control().dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    });
    expect(view.control().dataset.expanded).toBe('false');
  });

  it('puts a new current mode first once it is collapsed again', () => {
    vi.useFakeTimers();
    const view = mount('latest');

    act(() => view.options()[0].click());
    view.rerender('most');
    // Still open: the options keep their places under the pointer.
    expect(view.options().map((option) => option.dataset.value)).toEqual(['latest', 'most']);
    act(() => {
      document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    });
    act(() => { vi.advanceTimersByTime(260); });
    expect(view.control().dataset.expanded).toBe('false');
    expect(view.options().map((option) => option.dataset.value)).toEqual(['most', 'latest']);
    expect(view.control().hasAttribute('data-instant')).toBe(false);
  });
});
