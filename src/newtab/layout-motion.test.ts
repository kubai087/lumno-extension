import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LAYOUT_MOTION_EASING, createLayoutMotion, parseTranslate, type LayoutMotionTarget } from './layout-motion';
import { FakeAnimation } from '../../tests/fakes/animation';
import { createLayout } from '../../tests/fakes/layout';

// The page's blocks as boxes the test moves: the search entry, and the
// bookmarks and recent sites inside the bottom dock, which moves them. A
// played animation draws its block at its first frame until it is canceled.

interface Played {
  element: Element;
  keyframes: Keyframe[];
  timing: KeyframeAnimationOptions;
}

let played: Played[] = [];

beforeEach(() => {
  played = [];
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    value(this: HTMLElement, keyframes: Keyframe[], timing: KeyframeAnimationOptions) {
      const { style } = this;
      style.setProperty('translate', String(keyframes[0].translate));
      const animation = new FakeAnimation();
      animation.cancel.mockImplementation(() => {
        style.setProperty('translate', 'none');
        animation.emitCancel();
      });
      played.push({ element: this, keyframes, timing });
      return animation;
    }
  });
});

afterEach(() => {
  Reflect.deleteProperty(Element.prototype, 'animate');
});

interface Block {
  element: HTMLElement;
  top: number;
  left: number;
  width: number;
}

function createFixture(options: { hidden?: string[] } = {}) {
  const layout = createLayout();
  layout.viewport({ width: 1440, height: 900 });
  const block = (top: number, parent: HTMLElement): Block => {
    const element = document.createElement('div');
    parent.append(element);
    const state: Block = { element, top, left: 40, width: 320 };
    layout.place(element, () => {
      const offset = parseTranslate(element.style.getPropertyValue('translate'));
      const scrolled = element.parentElement && element.parentElement !== document.body ? element.parentElement.scrollTop : 0;
      return { left: state.left + offset.x, top: state.top + offset.y - scrolled, width: state.width, height: 48 };
    });
    return state;
  };
  const search = block(156, document.body);
  const dock = block(400, document.body);
  const bookmarks = block(408, dock.element);
  const recent = block(650, dock.element);
  let allowed = true;
  const targets = (): LayoutMotionTarget[] => [
    { key: 'search', element: search.element },
    { key: 'bookmarks', element: bookmarks.element, mover: dock.element },
    { key: 'recent', element: recent.element, mover: dock.element }
  ];
  const motion = createLayoutMotion({
    documentObj: document,
    windowObj: window,
    getTargets: () => targets().filter((target) => !(options.hidden || []).includes(target.key)),
    canAnimate: () => allowed
  });
  return {
    layout,
    motion,
    search,
    dock,
    bookmarks,
    recent,
    setAllowed(value: boolean) {
      allowed = value;
    }
  };
}

describe('layout motion', () => {
  it('eases in and out', () => {
    expect(LAYOUT_MOTION_EASING).toBe('cubic-bezier(0.65, 0, 0.35, 1)');
  });

  it('eases a block that moved from where it was drawn', () => {
    const fixture = createFixture();
    fixture.motion.commit();
    expect(played).toHaveLength(0);

    fixture.search.top = 263;
    fixture.motion.commit();

    expect(played).toHaveLength(1);
    expect(played[0].element).toBe(fixture.search.element);
    expect(played[0].keyframes).toEqual([{ translate: '0px -107px' }, { translate: '0px 0px' }]);
    expect(played[0].timing.easing).toBe(LAYOUT_MOTION_EASING);
  });

  it('continues from the drawn position when a pass comes during a move', () => {
    const fixture = createFixture();
    fixture.motion.commit();
    fixture.search.top = 263;
    fixture.motion.commit();

    fixture.search.element.style.setProperty('translate', '0px -50px');
    fixture.search.top = 156;
    fixture.motion.commit();

    expect(played[1].keyframes[0]).toEqual({ translate: '0px 57px' });
  });

  it('moves the dock once when its sections slide together', () => {
    const fixture = createFixture();
    fixture.motion.commit();
    fixture.bookmarks.top = 678;
    fixture.recent.top = 920;

    fixture.motion.commit();

    expect(played).toHaveLength(1);
    expect(played[0].element).toBe(fixture.dock.element);
    expect(played[0].keyframes[0]).toEqual({ translate: '0px -270px' });
  });

  it('leaves the dock in place when its sections shift apart', () => {
    const fixture = createFixture();
    fixture.motion.commit();
    fixture.bookmarks.top = 338;

    fixture.motion.commit();

    expect(played).toHaveLength(0);
  });

  it('does not take scrolling the dock for a move', () => {
    const fixture = createFixture();
    fixture.motion.commit();
    fixture.dock.element.scrollTop = 120;

    fixture.motion.commit();

    expect(played).toHaveLength(0);
  });

  // A shortcut size step narrows the centered shortcut row; its left edge
  // moves but the row has not, so nothing eases it back from the old edge.
  it('lets a centered block resize in place but eases one whose center shifted', () => {
    const fixture = createFixture();
    fixture.motion.commit();
    fixture.search.left = 120;
    fixture.search.width = 160;
    fixture.motion.commit();
    expect(played).toHaveLength(0);

    fixture.search.left = 160;
    fixture.motion.commit();

    expect(played[0].keyframes[0]).toEqual({ translate: '-40px 0px' });
  });

  it('records the new place without moving when it may not animate', () => {
    const fixture = createFixture();
    fixture.motion.commit();
    fixture.setAllowed(false);
    fixture.search.top = 263;
    fixture.motion.commit();
    fixture.setAllowed(true);

    fixture.motion.commit();

    expect(played).toHaveLength(0);
  });

  it('jumps to the layout of a new viewport size', () => {
    const fixture = createFixture();
    fixture.motion.commit();
    fixture.layout.viewport({ height: 760 });
    fixture.search.top = 120;

    fixture.motion.commit();

    expect(played).toHaveLength(0);
  });
});
