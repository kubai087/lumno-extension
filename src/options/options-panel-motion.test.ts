import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeAnimation } from '../../tests/fakes/animation';
import { getElement } from '../../tests/fakes/dom';
import { createLayout } from '../../tests/fakes/layout';
import { createPanelHeightAnimator } from './options-panel-motion';

// A shown panel has a box; JSDOM gives every element none.
class OneBoxList implements DOMRectList {
  [index: number]: DOMRect;
  readonly length = 1;
  private readonly box: DOMRect;

  constructor(box: DOMRect) {
    this.box = box;
    this[0] = box;
  }

  item(index: number): DOMRect | null {
    return index === 0 ? this.box : null;
  }

  [Symbol.iterator]() {
    return [this.box][Symbol.iterator]();
  }
}

interface Played {
  animation: FakeAnimation;
  keyframes: Keyframe[] | PropertyIndexedKeyframes | null;
  timing: number | KeyframeAnimationOptions | undefined;
}

function setUp(options: { ready?: boolean; reducedMotion?: boolean; scrollHeight?: number } = {}) {
  const root = document.createElement('div');
  const panel = document.createElement('div');
  const toggle = document.createElement('button');
  const row = document.createElement('div');
  row.id = 'row';
  panel.append(toggle, row);
  root.append(panel);
  document.body.append(root);
  document.documentElement.setAttribute('data-lumno-options-ready', options.ready === false ? 'false' : 'true');
  const layout = createLayout();
  let panelHeight = 400;
  let toggleTop = 300;
  layout.place(panel, () => ({ left: 0, top: 0, width: 600, height: panelHeight }));
  layout.place(toggle, () => ({ left: 0, top: toggleTop, width: 40, height: 20 }));
  layout.measure(document.documentElement, { scrollHeight: options.scrollHeight ?? 2000 });
  panel.getClientRects = () => new OneBoxList(new DOMRect(0, 0, 600, panelHeight));
  const played: Played[] = [];
  panel.animate = (keyframes, timing) => {
    const animation = new FakeAnimation();
    played.push({ animation, keyframes, timing });
    return animation;
  };
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: Boolean(options.reducedMotion), media: query }));
  const scrolls: number[] = [];
  vi.spyOn(window, 'scrollBy').mockImplementation((_x: number, y: number) => {
    scrolls.push(y);
    toggleTop -= y;
  });
  const animator = createPanelHeightAnimator({ documentObj: document, panel, reserveHost: root, windowObj: window });
  return {
    animator,
    panel,
    played,
    root,
    scrolls,
    toggle,
    // The layout a change leaves behind.
    relayout(height: number, top: number) {
      panelHeight = height;
      toggleTop = top;
      return true;
    }
  };
}

afterEach(() => {
  document.documentElement.removeAttribute('data-lumno-options-ready');
  vi.unstubAllGlobals();
});

describe('Options panel height motion', () => {
  it('animates between the measured heights and lets go of the fill effect when done', () => {
    const page = setUp();
    expect(page.animator.animate(() => page.relayout(480, 300))).toBe(true);
    expect(page.played).toHaveLength(1);
    const [{ animation, keyframes, timing }] = page.played;
    expect(keyframes).toEqual([{ height: '400px' }, { height: '480px' }]);
    expect(timing).toMatchObject({ duration: 280 });
    expect(page.panel.style.height).toBe('480px');
    expect(page.panel.getAttribute('data-height-animating')).toBe('true');
    animation.emitFinish();
    expect(animation.cancel).toHaveBeenCalled();
    expect(page.panel.style.height).toBe('');
    expect(page.panel.hasAttribute('data-height-animating')).toBe(false);
  });

  it('keeps the focused control in its place on screen through the change', () => {
    const page = setUp();
    page.toggle.focus();
    page.animator.animate(() => page.relayout(300, 260));
    expect(page.scrolls[0]).toBe(-40);
  });

  it('keeps room below the panel near the page bottom until a click elsewhere', () => {
    const page = setUp({ scrollHeight: 500 });
    page.toggle.focus();
    page.animator.animate(() => page.relayout(300, 300));
    expect(page.root.style.getPropertyValue('--settings-focus-anchor-reserve')).not.toBe('');
    getElement(document, '#row').dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(page.root.style.getPropertyValue('--settings-focus-anchor-reserve')).toBe('');
  });

  it('animates nothing when nothing changed, and a newer change replaces a running one', () => {
    const page = setUp();
    expect(page.animator.animate(() => false)).toBe(false);
    expect(page.played).toHaveLength(0);
    expect(page.panel.hasAttribute('data-height-animating')).toBe(false);
    page.animator.animate(() => page.relayout(500, 300));
    page.animator.animate(() => page.relayout(450, 300));
    expect(page.played[0].animation.cancel).toHaveBeenCalled();
    expect(page.played[1].keyframes).toEqual([{ height: '500px' }, { height: '450px' }]);
    page.animator.cancel();
    expect(page.played[1].animation.cancel).toHaveBeenCalled();
    expect(page.panel.style.height).toBe('');
  });

  it.each([{ reducedMotion: true }, { ready: false }])('changes the layout at once with %o', (options) => {
    const page = setUp(options);
    expect(page.animator.animate(() => page.relayout(500, 300))).toBe(true);
    expect(page.played).toHaveLength(0);
    expect(page.panel.hasAttribute('data-height-animating')).toBe(false);
  });
});
