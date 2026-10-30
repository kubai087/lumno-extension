import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attach } from './sortable-drag';
import type { SortableDragOptions } from './sortable-drag';
import { getElement, getElements } from '../../../tests/fakes/dom';

type Reorder = [key: string | undefined, fromIndex: number, toIndex: number];

// JSDOM has no layout, so each item reports a fixed box: a column of 40px rows
// with 10px gaps, or a row of 80px tiles.
function createList(count: number, layout: 'row' | 'column'): HTMLElement {
  const container = document.createElement('div');
  for (let index = 0; index < count; index += 1) {
    const item = document.createElement('div');
    item.className = 'item';
    item.dataset.key = `k${index}`;
    const control = document.createElement('button');
    control.className = 'control';
    item.appendChild(control);
    const box = layout === 'row'
      ? { left: index * 90, top: 0, width: 80, height: 40 }
      : { left: 0, top: index * 50, width: 200, height: 40 };
    const rect = { ...box, x: box.left, y: box.top, right: box.left + box.width, bottom: box.top + box.height };
    vi.spyOn(item, 'getBoundingClientRect').mockReturnValue({ ...rect, toJSON: () => rect });
    container.appendChild(item);
  }
  document.body.appendChild(container);
  return container;
}

function pointer(target: EventTarget, type: string, x: number, y: number): void {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }));
}

function items(container: HTMLElement): HTMLElement[] {
  return getElements(container, ':scope > .item');
}

// A released item glides into its slot before the drop lands.
function settle(): void {
  vi.advanceTimersByTime(220);
}

function attachList(container: HTMLElement, calls: Reorder[], extra: Partial<SortableDragOptions> = {}): () => void {
  return attach(container, {
    itemSelector: '.item',
    getPeers: () => items(container),
    onReorder: (item, fromIndex, toIndex) => calls.push([item.dataset.key, fromIndex, toIndex]),
    ...extra
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('sortable drag', () => {
  it('reorders a column once the dragged row glides into its slot', () => {
    const container = createList(4, 'column');
    const calls: Reorder[] = [];
    const detach = attachList(container, calls);
    const [first, second, third, fourth] = items(container);
    pointer(first, 'pointerdown', 20, 20);
    pointer(window, 'pointermove', 20, 40);
    expect(first.getAttribute('data-sort-dragging')).toBe('true');
    expect(first.style.getPropertyValue('transform')).toMatch(/translate\(0px, 20px\)/);
    pointer(window, 'pointermove', 20, 125);
    // Rows the dragged one passes slide up by one row and gap.
    expect(second.style.getPropertyValue('transform')).toBe('translate(0px, -50px)');
    // The rows either side of the open slot lean away from it.
    expect(third.style.getPropertyValue('translate')).toBe('0px -3px');
    expect(fourth.style.getPropertyValue('translate')).toBe('0px 3px');
    expect(second.style.getPropertyValue('translate')).toBe('');
    pointer(window, 'pointerup', 20, 125);
    expect(first.style.getPropertyValue('transform')).toMatch(/translate\(0px, 100px\)/);
    expect(third.style.getPropertyValue('translate')).toBe('');
    expect(calls).toEqual([]);
    // The click that ends the drag does not activate the row.
    const click = vi.fn();
    first.addEventListener('click', click);
    first.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(click).not.toHaveBeenCalled();
    settle();
    expect(calls).toEqual([['k0', 0, 2]]);
    expect(first.hasAttribute('data-sort-dragging')).toBe(false);
    expect(second.style.getPropertyValue('transform')).toBe('');
    expect(first.style.getPropertyValue('transform')).toBe('');
    detach();
  });

  it('keeps a small move a click', () => {
    const container = createList(3, 'column');
    const calls: Reorder[] = [];
    attachList(container, calls);
    const [first] = items(container);
    const click = vi.fn();
    first.addEventListener('click', click);
    pointer(first, 'pointerdown', 20, 20);
    pointer(window, 'pointermove', 22, 22);
    pointer(window, 'pointerup', 22, 22);
    first.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(calls).toEqual([]);
    expect(click).toHaveBeenCalledOnce();
  });

  it('leaves presses on controls inside an item alone', () => {
    const container = createList(3, 'column');
    const calls: Reorder[] = [];
    attachList(container, calls);
    const [first] = items(container);
    pointer(getElement(first, '.control'), 'pointerdown', 20, 20);
    pointer(window, 'pointermove', 20, 120);
    pointer(window, 'pointerup', 20, 120);
    expect(calls).toEqual([]);
    expect(first.hasAttribute('data-sort-dragging')).toBe(false);
  });

  it('cancels on Escape and glides the row back to its own slot', () => {
    const container = createList(3, 'column');
    const calls: Reorder[] = [];
    attachList(container, calls);
    const [first, , third] = items(container);
    pointer(third, 'pointerdown', 20, 120);
    pointer(window, 'pointermove', 20, 10);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    pointer(window, 'pointerup', 20, 10);
    expect(first.style.getPropertyValue('transform')).toBe('');
    expect(third.style.getPropertyValue('transform')).toBe('');
    settle();
    expect(calls).toEqual([]);
  });

  it('reorders a row of tiles when canStart allows it, one drag at a time', () => {
    const container = createList(3, 'row');
    const calls: Reorder[] = [];
    let allowed = false;
    attachList(container, calls, { canStart: () => allowed });
    const [first, second, third] = items(container);
    pointer(third, 'pointerdown', 200, 20);
    pointer(window, 'pointermove', 10, 20);
    pointer(window, 'pointerup', 10, 20);
    expect(calls).toEqual([]);
    allowed = true;
    pointer(third, 'pointerdown', 200, 20);
    pointer(window, 'pointermove', 10, 20);
    // The tile after the open slot leans away sideways; the first slot has
    // none before it.
    expect(first.style.getPropertyValue('translate')).toBe('6px 0px');
    pointer(window, 'pointerup', 10, 20);
    expect(third.style.getPropertyValue('transform')).toMatch(/translate\(-180px, 0px\)/);
    pointer(second, 'pointerdown', 110, 20);
    pointer(window, 'pointermove', 10, 20);
    // No new drag starts while the last one settles.
    expect(second.hasAttribute('data-sort-dragging')).toBe(false);
    pointer(window, 'pointerup', 10, 20);
    settle();
    expect(calls).toEqual([['k2', 2, 0]]);
  });
});
