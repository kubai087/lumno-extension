import { describe, expect, it } from 'vitest';
import { DRAG_CLICK_GUARD_MS, createDragClickGuard } from './drag-click-guard';

// Every New Tab drag shares one policy for the click its release fires:
// swallow that single click, wherever it lands, within a time cap; a new
// press ends the guard.
function setUp() {
  let time = 1000;
  const guard = createDragClickGuard({ windowObj: window, now: () => time });
  const opened: string[] = [];
  // A control on the page; the window sees its events first.
  const click = (label: string, detail = 1) => {
    const button = document.createElement('button');
    button.addEventListener('click', () => opened.push(label));
    document.body.appendChild(button);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, detail });
    button.dispatchEvent(event);
    return event;
  };
  const pointer = (type: string, pointerId: number) =>
    document.body.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId }));
  return {
    guard,
    opened,
    click,
    keyClick: (label: string) => click(label, 0),
    pointer,
    advance: (ms: number) => {
      time += ms;
    }
  };
}

describe('drag click guard', () => {
  it('guards for 420ms', () => {
    expect(DRAG_CLICK_GUARD_MS).toBe(420);
  });

  it('swallows exactly the click that follows a released drag', () => {
    const { guard, opened, click } = setUp();
    guard.armAfterDrag(new PointerEvent('pointerup', { pointerId: 1 }), 1);
    expect(click('release').defaultPrevented).toBe(true);
    expect(opened).toEqual([]);
    click('next');
    expect(opened).toEqual(['next']);
    expect(guard.isArmed()).toBe(false);
  });

  it('leaves no guard behind once the cap passes without a click', () => {
    const { guard, opened, click, advance } = setUp();
    guard.armAfterRelease();
    advance(DRAG_CLICK_GUARD_MS + 1);
    expect(guard.isArmed()).toBe(false);
    expect(click('late').defaultPrevented).toBe(false);
    expect(opened).toEqual(['late']);
  });

  it('never swallows a keyboard activation', () => {
    const { guard, opened, click, keyClick } = setUp();
    guard.armAfterRelease();
    keyClick('enter');
    expect(opened).toEqual(['enter']);
    click('release');
    expect(opened).toEqual(['enter']);
  });

  it('ends the guard on a new press, so a quick deliberate click works', () => {
    const { guard, opened, click, pointer } = setUp();
    guard.armAfterRelease();
    pointer('pointerdown', 2);
    click('deliberate');
    expect(opened).toEqual(['deliberate']);
  });

  it('waits for the held pointer of a canceled drag, then guards its click', () => {
    const { guard, opened, click, pointer, advance } = setUp();
    guard.armAfterDrag(null, 7);
    advance(5000);
    expect(guard.isArmed()).toBe(true);
    pointer('pointerup', 8);
    advance(5000);
    expect(guard.isArmed()).toBe(true);
    pointer('pointerup', 7);
    click('release');
    expect(opened).toEqual([]);
    click('next');
    expect(opened).toEqual(['next']);
  });

  it('replaces an earlier guard when armed again rather than stacking', () => {
    const { guard, opened, click } = setUp();
    guard.armAfterDrag(null, 7);
    guard.armAfterRelease();
    guard.armAfterRelease();
    click('release');
    click('next');
    expect(opened).toEqual(['next']);
  });
});
