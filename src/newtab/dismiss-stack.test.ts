import { describe, expect, it } from 'vitest';
import { createDismissStack } from './dismiss-stack';

// One Escape closes one New Tab layer: the open layer that opened last, or
// an active drag (higher priority) whenever one runs. Layers register once
// and the stack notices on its own when they open.
function createPage() {
  const page = document.implementation.createHTMLDocument('New Tab');
  return {
    page,
    press(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
      const event = new KeyboardEvent('keydown', { key, cancelable: true, ...init });
      page.dispatchEvent(event);
      return event;
    },
    // A pointer press that opens `layer` (the press comes first).
    openWithPress(layer: { open: boolean }): void {
      page.dispatchEvent(new Event('pointerdown', { cancelable: true }));
      layer.open = true;
    }
  };
}

function createLayer(name: string, closed: string[], priority?: number) {
  const layer = {
    open: false,
    priority,
    isOpen: () => layer.open,
    close: () => {
      layer.open = false;
      closed.push(name);
    }
  };
  return layer;
}

describe('New Tab dismiss stack', () => {
  it('closes one layer per Escape, the most recently opened first, whatever order they registered in', () => {
    const { page, press, openWithPress } = createPage();
    const stack = createDismissStack({ documentObj: page });
    const closed: string[] = [];
    const panel = createLayer('panel', closed);
    const popover = createLayer('popover', closed);
    const menu = createLayer('menu', closed);
    stack.register('menu', menu);
    stack.register('panel', panel);
    stack.register('popover', popover);
    let pageSawEscape = false;
    // A menu underneath that listens on the document too, added later.
    page.addEventListener('keydown', () => { pageSawEscape = true; }, true);

    openWithPress(popover);
    openWithPress(panel);
    openWithPress(menu);
    expect(press('Escape').defaultPrevented).toBe(true);
    expect(closed).toEqual(['menu']);
    expect(pageSawEscape).toBe(false);
    press('Escape');
    expect(closed).toEqual(['menu', 'panel']);
    press('Escape');
    expect(closed).toEqual(['menu', 'panel', 'popover']);

    expect(press('Escape').defaultPrevented).toBe(false);
    expect(pageSawEscape).toBe(true);
  });

  it('skips a layer closed some other way and raises a reopened one', () => {
    const { page, openWithPress } = createPage();
    const stack = createDismissStack({ documentObj: page });
    const closed: string[] = [];
    const panel = createLayer('panel', closed);
    const menu = createLayer('menu', closed);
    stack.register('panel', panel);
    stack.register('menu', menu);

    openWithPress(panel);
    openWithPress(menu);
    expect(stack.getTopKey()).toBe('menu');
    menu.open = false;
    expect(stack.getTopKey()).toBe('panel');
    openWithPress(menu);
    expect(stack.getTopKey()).toBe('menu');
    panel.open = false;
    openWithPress(panel);
    expect(stack.getTopKey()).toBe('panel');
  });

  it('lets a drag outrank a layer opened after it started', () => {
    const { page, press, openWithPress } = createPage();
    const stack = createDismissStack({ documentObj: page });
    const closed: string[] = [];
    const drag = createLayer('drag', closed, 1);
    const menu = createLayer('menu', closed);
    stack.register('drag', drag);
    stack.register('menu', menu);

    openWithPress(drag);
    menu.open = true;
    press('Escape');
    expect(closed).toEqual(['drag']);
    press('Escape');
    expect(closed).toEqual(['drag', 'menu']);
  });

  it('lets other keys, composing input and ignored moments pass by', () => {
    const { page, press, openWithPress } = createPage();
    let ignore = false;
    const stack = createDismissStack({ documentObj: page, shouldIgnore: () => ignore });
    const closed: string[] = [];
    const menu = createLayer('menu', closed);
    stack.register('menu', menu);

    openWithPress(menu);
    press('ArrowDown');
    press('Escape', { isComposing: true });
    ignore = true;
    press('Escape');
    expect(closed).toEqual([]);
    ignore = false;
    press('Escape');
    expect(closed).toEqual(['menu']);
  });
});
