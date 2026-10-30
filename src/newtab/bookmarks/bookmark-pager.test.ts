import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBookmarkPager } from './bookmark-pager';
import { BookmarksShown } from './bookmarks-shown';
import type { BookmarkItem } from './bookmarks-store';
import { DragSessions } from '../drag-sessions';
import { FakeAnimation } from '../../../tests/fakes/animation';
import { createLayout } from '../../../tests/fakes/layout';
import { required } from '../../../tests/fakes/dom';

// The bookmark grid's pager over the grid, the shown state and an animate()
// that records each slide. The view is a stand-in that, like React, draws
// the cards of the page the state holds, removing only its own cards.

interface Slide {
  element: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  animation: FakeAnimation;
}

let reducedMotion = false;
let slides: Slide[] = [];

beforeEach(() => {
  reducedMotion = false;
  slides = [];
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reducedMotion && query === '(prefers-reduced-motion: reduce)' }));
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    value(this: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
      const animation = new FakeAnimation();
      animation.startTime = 0;
      slides.push({ element: this, keyframes, options, animation });
      return animation;
    }
  });
});

afterEach(() => {
  Reflect.deleteProperty(Element.prototype, 'animate');
  document.documentElement.removeAttribute('data-lumno-motion-effects');
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function items(count: number): BookmarkItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: String(index), parentId: '1', index, title: `Bookmark ${index}`, url: `https://b${index}.example/`,
    host: `b${index}.example`, themeUrl: '', type: 'bookmark'
  }));
}

function createPager({ pages = 8, page = 0, limit = 2, columns = 2 } = {}) {
  const layout = createLayout();
  const grid = document.createElement('div');
  document.body.append(grid);
  grid.style.setProperty('column-gap', '12px');
  grid.style.setProperty('grid-template-columns', '200px 200px');
  layout.place(grid, { left: 0, top: 0, width: 412, height: 51 });
  const clock = { now: 0 };
  let headerUpdates = 0;
  const state = new BookmarksShown();
  state.setItems(items(pages * limit));
  state.showPage(page);
  state.grid.subscribe(() => {
    const { content } = state.grid.getSnapshot();
    const shown = content && content.kind === 'cards' ? content.items : [];
    Array.from(grid.children).filter((child) => child.tagName === 'BUTTON').forEach((card) => card.remove());
    grid.append(...shown.map((item) => {
      const card = document.createElement('button');
      card.id = `card-${item.id}`;
      card.textContent = String(item.id);
      card.style.setProperty('--x-nt-glass-refraction', `url(#lens-${item.id})`);
      return card;
    }));
  });
  const pager = createBookmarkPager({
    bookmarksShown: state,
    bookmarkGrid: grid,
    now: () => clock.now,
    settings: { get: (setting) => setting.default },
    getBookmarkLimit: () => limit,
    updateBookmarkHeader() {
      headerUpdates += 1;
    },
    getBookmarkGridColumnCount: () => columns,
    updateBookmarkSectionPosition() {},
    bookmarkParts: { view: { getCacheKey: (item) => String(item.id), setFolderIconsVisible: (value) => value, getCards: () => [] } },
    dragSessions: new DragSessions(),
    shortcutSection: document.createElement('section'),
    setBookmarkSurfaceVisible() {}
  });
  return { pager, state, grid, clock, headerUpdates: () => headerUpdates };
}

describe('turning a bookmark page', () => {
  it('slides both pages together and decelerates into place', () => {
    const { pager, state, grid } = createPager();
    pager.renderCurrentBookmarkPage();

    pager.switchBookmarkPage(1);

    expect(state.currentPage).toBe(1);
    expect(slides).toHaveLength(3);
    expect(slides[0].keyframes[1].transform).toBe('translateX(-424px)');
    expect(slides[1].keyframes[0].transform).toBe('translateX(424px)');
    expect(slides.every(({ options, animation }) => options.duration === 520 && animation.startTime === 0)).toBe(true);
    expect(slides.every(({ keyframes, options }) => keyframes.length === 2 && options.easing === 'cubic-bezier(0.16, 1, 0.3, 1)')).toBe(true);
    expect(grid.style.getPropertyValue('overflow-x')).toBe('clip');
  });

  it('lets the leaving page build no lenses while the arriving cards keep theirs', () => {
    const { pager, grid } = createPager();
    pager.renderCurrentBookmarkPage();

    pager.switchBookmarkPage(1);

    const outgoing = required(grid.lastElementChild, 'the leaving page');
    expect(outgoing.getAttribute('aria-hidden')).toBe('true');
    expect(outgoing instanceof HTMLElement && outgoing.inert).toBe(true);
    expect(outgoing.querySelectorAll('[id]')).toHaveLength(0);
    expect(outgoing.getAttribute('data-bookmark-page-outgoing')).toBe('true');
    const lens = (card: Element) => (card instanceof HTMLElement ? card.style.getPropertyValue('--x-nt-glass-refraction') : '');
    expect(Array.from(outgoing.children).map(lens)).toEqual(['', '']);
    expect(Array.from(grid.children).filter((card) => card !== outgoing).every((card) => lens(card) !== '')).toBe(true);
  });

  it('holds rapid turns early in a slide and runs only the latest once it reaches its tail', () => {
    const { pager, state, grid, clock } = createPager();
    pager.renderCurrentBookmarkPage();
    pager.switchBookmarkPage(1);

    clock.now = 100;
    for (let index = 0; index < 120; index += 1) pager.switchBookmarkPage(state.currentPage + 1);
    expect(state.currentPage).toBe(1);
    expect(slides).toHaveLength(3);
    expect(grid.children).toHaveLength(3);
    expect(vi.getTimerCount()).toBe(1);

    clock.now = 260;
    vi.advanceTimersByTime(159);
    expect(state.currentPage).toBe(1);
    vi.advanceTimersByTime(1);
    expect(state.currentPage).toBe(2);
    expect(slides).toHaveLength(6);
    expect(slides.slice(0, 3).every(({ animation }) => animation.cancel.mock.calls.length > 0)).toBe(true);
    expect(grid.children).toHaveLength(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('turns at once in the tail of a slide, reversing for the previous page, and cleans up when it ends', async () => {
    const { pager, state, grid, clock } = createPager({ page: 1 });
    pager.renderCurrentBookmarkPage();
    pager.switchBookmarkPage(2);

    clock.now = 600;
    pager.switchBookmarkPage(1);

    expect(state.currentPage).toBe(1);
    expect(slides[3].keyframes[1].transform).toBe('translateX(424px)');
    slides.forEach(({ animation }) => animation.emitFinish());
    await vi.advanceTimersByTimeAsync(0);
    expect(state.pageAnimating).toBe(false);
    expect(grid.children).toHaveLength(2);
    expect(grid.style.getPropertyValue('overflow-x')).toBe('');
  });

  it('drops a queued turn when asked for the page already sliding in', () => {
    const { pager, clock } = createPager();
    pager.renderCurrentBookmarkPage();
    clock.now = 1000;
    pager.switchBookmarkPage(2);
    clock.now = 1050;
    pager.switchBookmarkPage(3);
    expect(vi.getTimerCount()).toBe(1);

    pager.switchBookmarkPage(2);

    expect(vi.getTimerCount()).toBe(0);
  });

  it('drops the queued turn and the slide when the page draws again', () => {
    const { pager, state, grid, clock } = createPager();
    pager.renderCurrentBookmarkPage();
    clock.now = 1000;
    pager.switchBookmarkPage(2);
    clock.now = 1050;
    pager.switchBookmarkPage(3);

    pager.renderCurrentBookmarkPage();

    expect(vi.getTimerCount()).toBe(0);
    expect(state.pageAnimating).toBe(false);
    expect(grid.children).toHaveLength(2);
    expect(state.currentPage).toBe(2);
  });

  it('switches without a slide when the user prefers reduced motion', () => {
    const { pager, state } = createPager({ page: 2 });
    pager.renderCurrentBookmarkPage();
    reducedMotion = true;

    pager.switchBookmarkPage(1);

    expect(state.currentPage).toBe(1);
    expect(slides).toHaveLength(0);
  });

  it('switches without a slide when motion effects are off', () => {
    const { pager, state } = createPager({ page: 1 });
    pager.renderCurrentBookmarkPage();
    document.documentElement.setAttribute('data-lumno-motion-effects', 'off');

    pager.switchBookmarkPage(0);

    expect(state.currentPage).toBe(0);
    expect(slides).toHaveLength(0);
  });
});

// Wheel paging, one bookmark per page. Pages switch at once (reduced motion)
// unless `animated` is set, so each test counts page turns directly.
describe('wheel and trackpad paging', () => {
  interface WheelInput {
    deltaX?: number;
    deltaY?: number;
    deltaMode?: number;
    ctrlKey?: boolean;
    wheelDeltaX?: number;
    wheelDeltaY?: number;
    // The time since the previous event; 16ms, a trackpad's rate, by default.
    gap?: number;
  }

  const flick = [2, 5, 12, 30, 40, 30, 20, 12, 8, 5, 3, 2, 1, 1];

  function fixture({ page = 3, pages = 8, animated = false } = {}) {
    reducedMotion = !animated;
    const { pager, state, clock, headerUpdates } = createPager({ page, pages, limit: 1, columns: 1 });
    let at = 1000;
    // Returns, for each event, whether it was kept from scrolling the page.
    const send = (...events: WheelInput[]) => events.map(({ gap = 16, wheelDeltaX, wheelDeltaY, ...init }) => {
      at += gap;
      clock.now = at;
      const event = new WheelEvent('wheel', { cancelable: true, ...init });
      Object.defineProperty(event, 'timeStamp', { value: at });
      if (wheelDeltaX !== undefined) Object.defineProperty(event, 'wheelDeltaX', { value: wheelDeltaX });
      if (wheelDeltaY !== undefined) Object.defineProperty(event, 'wheelDeltaY', { value: wheelDeltaY });
      pager.handleBookmarkWheel(event);
      return event.defaultPrevented;
    });
    const swipe = (axis: 'deltaX' | 'deltaY', deltas: number[], first: WheelInput = {}) => deltas.map((delta, index): WheelInput => ({
      [axis]: delta,
      [axis === 'deltaX' ? 'wheelDeltaX' : 'wheelDeltaY']: -3 * delta,
      ...(index === 0 ? first : {})
    }));
    return { state, clock, send, swipe, headerUpdates };
  }

  it('turns one page for a swipe that accelerates and coasts, never scrolling the page', () => {
    const f = fixture();
    expect(f.send(...f.swipe('deltaX', flick)).every(Boolean)).toBe(true);
    expect(f.state.currentPage).toBe(4);
  });

  it('offers only Previous on the last page and redraws the header only when that changes', () => {
    const f = fixture({ page: 0, pages: 2 });
    f.send(...f.swipe('deltaX', flick));
    expect({ ...f.state.pagerAvailability }).toEqual({ previous: true, next: false });
    const updates = f.headerUpdates();
    expect(updates).toBeGreaterThan(0);

    f.send(...f.swipe('deltaX', flick, { gap: 200 }));

    expect(f.headerUpdates()).toBe(updates);
  });

  it('turns back for a swipe the other way', () => {
    const f = fixture();
    f.send(...f.swipe('deltaX', flick.map((delta) => -delta)));
    expect(f.state.currentPage).toBe(2);
  });

  it('turns pages for vertical scrolling too', () => {
    const f = fixture();
    f.send(...f.swipe('deltaY', flick));
    expect(f.state.currentPage).toBe(4);
  });

  it('turns for a slow swipe once it has moved 6px', () => {
    const f = fixture();
    f.send(...f.swipe('deltaX', [1, 1, 1, 1, 1]));
    expect(f.state.currentPage).toBe(3);
    f.send(...f.swipe('deltaX', [1, 1, 1]));
    expect(f.state.currentPage).toBe(4);
  });

  it('ends a gesture at a pause, so the next swipe turns again', () => {
    const f = fixture();
    f.send(...f.swipe('deltaX', flick), ...f.swipe('deltaX', flick, { gap: 200 }));
    expect(f.state.currentPage).toBe(5);
  });

  it('turns again for a new swipe during momentum', () => {
    const f = fixture();
    f.send(...f.swipe('deltaX', [...flick.slice(0, 10), 8, 20, 35, 20, 5]));
    expect(f.state.currentPage).toBe(5);
  });

  it('does not take momentum jitter for a new swipe', () => {
    const f = fixture();
    f.send(...f.swipe('deltaX', [30, 28, 26, 30, 27, 25]));
    expect(f.state.currentPage).toBe(4);
  });

  it('turns back when the gesture reverses', () => {
    const f = fixture();
    f.send(...f.swipe('deltaX', [8, 12, 10, 6, 3]), ...f.swipe('deltaX', [-10, -20, -10]));
    expect(f.state.currentPage).toBe(3);
  });

  it('does not split a swipe for drift on the other axis', () => {
    const f = fixture();
    f.send({ deltaX: 6, deltaY: 1 }, { deltaX: 12, deltaY: 3 }, { deltaX: 1, deltaY: -3 },
      { deltaX: 2, deltaY: -2 }, { deltaX: 1, deltaY: 2 }, { deltaX: 1, deltaY: 0 });
    expect(f.state.currentPage).toBe(4);
  });

  it('follows the dominant axis of diagonal input', () => {
    const f = fixture();
    f.send({ deltaX: -25, deltaY: 10 });
    expect(f.state.currentPage).toBe(2);
  });

  it('turns a page for each mouse notch, small macOS notches and line or page units included', () => {
    const f = fixture();
    f.send({ deltaY: 100, wheelDeltaY: -120 }, { deltaY: 100, wheelDeltaY: -120, gap: 40 },
      { deltaY: 100, wheelDeltaY: -120, gap: 40 });
    expect(f.state.currentPage).toBe(6);
    f.send({ deltaY: -4, wheelDeltaY: 120, gap: 300 });
    expect(f.state.currentPage).toBe(5);
    f.send({ deltaY: 1, deltaMode: 1, gap: 300 }, { deltaX: -1, deltaMode: 2, gap: 300 });
    expect(f.state.currentPage).toBe(5);
  });

  it('leaves zoom gestures and empty events alone', () => {
    const f = fixture();
    expect(f.send({ deltaX: 20, ctrlKey: true }, { deltaX: 0, deltaY: 0 })).toEqual([false, false]);
    expect(f.state.currentPage).toBe(3);
  });

  it('does not turn past the first page', () => {
    const f = fixture({ page: 0 });
    expect(f.send({ deltaX: -20 })).toEqual([true]);
    expect(f.state.currentPage).toBe(0);
  });

  it('lets the wheel through when there is one page', () => {
    const f = fixture({ pages: 1, page: 0 });
    expect(f.send({ deltaX: 20 })).toEqual([false]);
  });

  it('queues a new swipe during the first half of a slide for its tail', () => {
    const f = fixture({ animated: true });
    f.send(...f.swipe('deltaX', flick.slice(0, 10)));
    expect(f.state.currentPage).toBe(4);
    f.send(...f.swipe('deltaX', [8, 20]));
    expect(f.state.currentPage).toBe(4);
    expect(vi.getTimerCount()).toBe(1);

    f.clock.now += 1000;
    vi.advanceTimersByTime(1000);

    expect(f.state.currentPage).toBe(5);
  });
});
