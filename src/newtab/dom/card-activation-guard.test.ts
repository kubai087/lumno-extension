import { describe, expect, it } from 'vitest';
import {
  CONTEXT_MENU_CLICK_THROUGH_GUARD_MS,
  CONTEXT_MENU_PRESS_CLICK_MAX_MS,
  createCardActivationGuard
} from './card-activation-guard';

// Presses that belong to a card context menu (made while it is open, or just
// after, through the fading menu) must not open the card underneath.
function setUp() {
  const menu = document.createElement('div');
  menu.className = 'x-nt-shortcut-context-menu-portal';
  document.body.appendChild(menu);
  let now = 1_000_000;
  const guard = createCardActivationGuard({ documentObj: document, now: () => now });
  return {
    guard,
    press: () => document.dispatchEvent(new Event('pointerdown')),
    setOpen: (open: boolean) => menu.setAttribute('data-open', String(open)),
    advance: (ms: number) => {
      now += ms;
    }
  };
}

describe('card activation guard', () => {
  it('lets a press with no menu open open the card', () => {
    const { guard, press } = setUp();
    expect(guard.isCardActivationSuppressed()).toBe(false);
    press();
    expect(guard.isCardActivationSuppressed()).toBe(false);
  });

  it('gives a press while the menu is open, and its click, to the menu', () => {
    const { guard, press, setOpen, advance } = setUp();
    setOpen(true);
    press();
    expect(guard.isCardActivationSuppressed()).toBe(true);
    advance(CONTEXT_MENU_PRESS_CLICK_MAX_MS - 1);
    expect(guard.isCardActivationSuppressed()).toBe(true);
    advance(1);
    expect(guard.isCardActivationSuppressed()).toBe(false);
  });

  it('counts from the last press inside the menu once it has closed', () => {
    const { guard, press, setOpen, advance } = setUp();
    setOpen(true);
    press();
    advance(CONTEXT_MENU_PRESS_CLICK_MAX_MS);
    setOpen(false);
    advance(100);
    press();
    expect(guard.isCardActivationSuppressed()).toBe(false);
  });

  it('gives a press through the fading menu to the menu, and a later one to the card', () => {
    const { guard, press, setOpen, advance } = setUp();
    setOpen(true);
    press();
    setOpen(false);
    advance(CONTEXT_MENU_CLICK_THROUGH_GUARD_MS - 1);
    press();
    expect(guard.isCardActivationSuppressed()).toBe(true);
    advance(CONTEXT_MENU_CLICK_THROUGH_GUARD_MS);
    press();
    expect(guard.isCardActivationSuppressed()).toBe(false);
  });
});
