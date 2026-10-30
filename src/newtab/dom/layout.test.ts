import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CONTENT_MAX_WIDTH_PX,
  SEARCH_WIDTH_CONFIG,
  STANDARD_SEARCH_MAX_WIDTH_PX,
  createLayoutController,
  getAdaptiveGridColumnCount,
  getGridContentWidthForColumns,
  type LayoutConstants
} from './layout';
import { createLayout, type Box, type Layout } from '../../../tests/fakes/layout';

// The layout controller over a page of plain elements: the search entry
// (root, layer and input), the wordmark above it, the shortcuts, the bottom
// dock with its sections and the suggestions, each with a box.

interface FixtureOptions {
  innerWidth?: number;
  innerHeight?: number;
  rootBox?: Partial<Box>;
  shortcutBox?: Partial<Box> | (() => Box);
  shortcutVisible?: boolean;
  topInsetPx?: number;
  // The dock's scroller, which holds the section corridor.
  scroller?: HTMLElement;
  cornerControls?: HTMLElement[];
  constants?: LayoutConstants;
}

afterEach(() => {
  document.body.removeAttribute('style');
  document.body.removeAttribute('class');
  Array.from(document.body.attributes).forEach((attribute) => document.body.removeAttribute(attribute.name));
  vi.useRealTimers();
});

function element(style: Record<string, string> = {}): HTMLElement {
  const node = document.createElement('div');
  Object.entries(style).forEach(([name, value]) => node.style.setProperty(name, value));
  return node;
}

function box(left: number, top: number, width: number, height: number): Box {
  return { left, top, width, height };
}

function createFixture(layout: Layout, options: FixtureOptions = {}) {
  layout.viewport({ width: options.innerWidth ?? 1280, height: options.innerHeight ?? 900 });
  const root = layout.place(element({ 'padding-top': '4px', 'padding-bottom': '4px', 'border-top': '1px solid', 'border-bottom': '1px solid', 'min-height': '55px' }),
    { ...box(180, 200, 720, 55), ...options.rootBox });
  const searchLayer = layout.place(element({ 'border-top': '1px solid', 'border-bottom': '1px solid', 'min-height': '45px' }), box(180, 200, 720, 45));
  const inputContainer = layout.place(element(), box(184, 204, 712, 45));
  const wordmark = layout.place(element(), box(180, 98, 720, 74));
  wordmark.setAttribute('data-visible', 'true');
  const bottomDock = layout.place(element(), box(80, 680, 920, 220));
  const shortcutSection = element();
  const shortcutBox = options.shortcutBox;
  layout.place(shortcutSection, typeof shortcutBox === 'function' ? shortcutBox : { ...box(420, 270, 240, 72), ...shortcutBox });
  shortcutSection.setAttribute('data-visible', options.shortcutVisible ? 'true' : 'false');
  const bookmarkSection = element();
  const recentSection = element();
  bookmarkSection.setAttribute('data-visible', 'true');
  recentSection.setAttribute('data-visible', 'true');
  const sectionSafeCorridor = element();
  if (options.scroller) options.scroller.append(sectionSafeCorridor);
  (options.cornerControls || []).forEach((control) => {
    control.classList.add('x-nt-wallpaper-control');
    document.body.append(control);
  });
  const suggestionsContainer = layout.place(element({ 'padding-top': '8px', 'padding-bottom': '12px' }), box(180, 255, 720, 0));
  const suggestionsSurface = element();
  const suggestionsOutline = element();
  const controller = createLayoutController({
    documentObj: document,
    windowObj: window,
    root,
    searchLayer,
    inputParts: { container: inputContainer },
    topContentContainer: wordmark,
    shortcutSection,
    bottomDock,
    bookmarkSection,
    recentSection,
    sectionSafeCorridor,
    suggestionsContainer,
    suggestionsSurface,
    suggestionsOutline,
    getTopInsetPx: () => options.topInsetPx || 0,
    constants: {
      minTopPx: 28,
      minBottomPx: 20,
      upshiftRatio: 0.06,
      upshiftMinPx: 24,
      upshiftMaxPx: 80,
      contentSectionsExtraUpshiftPx: 20,
      emptySectionsExtraUpshiftPx: 96,
      ...options.constants
    }
  });
  return { body: document.body, bottomDock, shortcutSection, suggestionsContainer, suggestionsSurface, suggestionsOutline, controller };
}

const searchTop = () => Number.parseFloat(document.body.style.getPropertyValue('padding-top'));

const SHORT_DOCK: LayoutConstants = {
  bottomDockTopReservePx: 240,
  compactDockViewportMaxHeightPx: 800,
  compactDockSearchGapPx: 30,
  compactDockShortcutGapPx: 8,
  compactDockMinTopReservePx: 168
};

describe('the search entry', () => {
  it('stays put when a restore pass refreshes the sections', () => {
    const layout = createLayout();
    const { body, bottomDock, controller } = createFixture(layout);
    controller.updateBottomDockLayout();
    const initialTop = body.style.getPropertyValue('padding-top');
    expect(initialTop).toMatch(/px$/);

    layout.place(bottomDock, box(80, 680, 920, 260));
    controller.updateBottomDockLayout({ preserveSearchEntryLayout: true });

    expect(body.style.getPropertyValue('padding-top')).toBe(initialTop);
  });

  it('reserves an occupied top surface plus the normal gap on short viewports', () => {
    const layout = createLayout();
    const { controller } = createFixture(layout, {
      innerHeight: 460, topInsetPx: 36, constants: { shortViewportMaxHeightPx: 680, shortMinTopPx: 44 }
    });

    controller.updateSearchEntryLayout();

    expect(searchTop()).toBeGreaterThanOrEqual(80);
  });

  it('moves up by the capped height of a desktop top bar', () => {
    const layout = createLayout();
    const regular = createFixture(layout, { innerHeight: 900 });
    regular.controller.updateSearchEntryLayout();
    const regularTop = searchTop();
    document.body.removeAttribute('style');
    const withTopbar = createFixture(layout, { innerHeight: 900, topInsetPx: 36 });
    withTopbar.controller.updateSearchEntryLayout();

    expect(regularTop - searchTop()).toBe(36);
  });

  it('takes the narrow inset gradually near the breakpoint', () => {
    const layout = createLayout();
    const topAt = (innerWidth: number) => {
      document.body.removeAttribute('style');
      const { controller } = createFixture(layout, {
        innerWidth, innerHeight: 900,
        constants: { narrowViewportMinWidthPx: 520, narrowViewportMaxWidthPx: 1440, narrowTopInsetPx: 16, narrowTopInsetTransitionPx: 64 }
      });
      controller.updateSearchEntryLayout();
      return searchTop();
    };
    const tops = [1441, 1440, 1439, 1438, 1437, 1436].map(topAt);
    tops.slice(1).forEach((top, index) => expect(Math.abs(top - tops[index])).toBeLessThanOrEqual(1));

    expect(topAt(1376) - topAt(1441)).toBe(16);
  });
});

describe('the suggestions', () => {
  it('commit their natural height without a tween after a render', () => {
    const layout = createLayout();
    const { controller, suggestionsContainer, suggestionsSurface, suggestionsOutline } = createFixture(layout);
    ['data-height-clipped', 'data-input-height-locked', 'data-resizing'].forEach((name) => suggestionsContainer.setAttribute(name, 'true'));
    Object.entries({
      height: '236px', 'overflow-y': 'hidden', 'padding-top': '8px', 'padding-bottom': '12px',
      transition: 'height 180ms ease', 'will-change': 'height'
    }).forEach(([name, value]) => suggestionsContainer.style.setProperty(name, value));
    [suggestionsSurface, suggestionsOutline].forEach((part) => {
      part.style.setProperty('transition', 'height 180ms ease');
      part.style.setProperty('will-change', 'height');
    });

    expect(controller.commitSuggestionsNaturalHeightAfterRender()).toBe(true);

    ['data-height-clipped', 'data-input-height-locked', 'data-resizing']
      .forEach((name) => expect(suggestionsContainer.getAttribute(name)).toBeNull());
    ['height', 'overflow-y', 'padding-top', 'padding-bottom', 'will-change']
      .forEach((name) => expect(suggestionsContainer.style.getPropertyValue(name)).toBe(''));
    expect(suggestionsContainer.style.getPropertyValue('transition')).toBe('none');
    [suggestionsSurface, suggestionsOutline].forEach((part) => {
      expect(part.style.getPropertyValue('transition')).toBe('');
      expect(part.style.getPropertyValue('will-change')).toBe('');
    });
  });
});

describe('the bottom dock scrollbar', () => {
  function scroller(layout: Layout, clientWidth: number) {
    return layout.measure(layout.place(element(), box(36, 480, 1058, 420)), { offsetWidth: 1058, clientWidth });
  }

  it('hands its gutter to CSS and ends its track above a corner control over it', () => {
    const layout = createLayout();
    const dockScroller = scroller(layout, 1048);
    const overBar = layout.place(element(), box(1060, 806, 38, 38));
    const besideBar = layout.place(element(), box(1110, 760, 38, 38));
    const { controller } = createFixture(layout, { scroller: dockScroller, cornerControls: [overBar, besideBar] });

    controller.updateBottomDockLayout();

    expect(dockScroller.style.getPropertyValue('--x-nt-bottom-dock-scrollbar-gutter')).toBe('10px');
    expect(dockScroller.style.getPropertyValue('--x-nt-bottom-dock-scrollbar-end-inset')).toBe('102px');

    layout.place(dockScroller, box(36, 820, 1058, 80));
    controller.updateBottomDockLayout();
    expect(dockScroller.style.getPropertyValue('--x-nt-bottom-dock-scrollbar-end-inset')).toBe('8px');
  });

  it('takes no gutter and no inset for overlay scrollbars', () => {
    const layout = createLayout();
    const dockScroller = scroller(layout, 1058);
    const { controller } = createFixture(layout, { scroller: dockScroller, cornerControls: [layout.place(element(), box(1060, 806, 38, 38))] });

    controller.updateBottomDockLayout();

    expect(dockScroller.style.getPropertyValue('--x-nt-bottom-dock-scrollbar-gutter')).toBe('0px');
    expect(dockScroller.style.getPropertyValue('--x-nt-bottom-dock-scrollbar-end-inset')).toBe('0px');
  });
});

describe('the bottom dock density', () => {
  it('reserves room below the search entry on short viewports and turns compact', () => {
    const layout = createLayout();
    const { bottomDock, controller } = createFixture(layout, { innerHeight: 620, rootBox: { top: 200, height: 55 }, constants: SHORT_DOCK });

    controller.updateBottomDockLayout();

    expect(bottomDock.style.getPropertyValue('max-height')).toBe('335px');
    expect(bottomDock.getAttribute('data-density')).toBe('compact');
  });

  it('turns tiny on very short viewports, on the body too', () => {
    const layout = createLayout();
    const { body, bottomDock, controller } = createFixture(layout, { innerHeight: 460, rootBox: { top: 190, height: 55 }, constants: SHORT_DOCK });

    controller.updateBottomDockLayout();

    expect(bottomDock.getAttribute('data-density')).toBe('tiny');
    expect(body.getAttribute('data-nt-bottom-dock-density')).toBe('tiny');
  });

  it('reserves room for a visible shortcut row first', () => {
    const layout = createLayout();
    const { bottomDock, controller } = createFixture(layout, {
      innerHeight: 520, rootBox: { top: 93, height: 56 }, shortcutBox: { top: 161, height: 72 }, shortcutVisible: true, constants: SHORT_DOCK
    });

    controller.updateBottomDockLayout();

    expect(bottomDock.style.getPropertyValue('max-height')).toBe('279px');
    expect(bottomDock.getAttribute('data-density')).toBe('compact');
  });

  // A wrapped shortcut row ends higher when the dock is compact, which would
  // give the dock the room to go back to its default density.
  function wrappingShortcuts(layout: Layout, innerHeight: number) {
    vi.useFakeTimers();
    const dock: { element: HTMLElement | null } = { element: null };
    const fixture = createFixture(layout, {
      innerHeight, rootBox: { top: 120, height: 55 }, shortcutVisible: true, constants: SHORT_DOCK,
      shortcutBox: () => {
        const bottom = dock.element && dock.element.getAttribute('data-density') === 'compact' ? 240 : 270;
        return box(420, 160, 240, bottom - 160);
      }
    });
    dock.element = fixture.bottomDock;
    return fixture;
  }

  it('does not alternate between compact and default for a wrapped shortcut row', () => {
    const layout = createLayout();
    const { bottomDock, controller } = wrappingShortcuts(layout, 620);
    const densities = () => {
      const seen = [bottomDock.getAttribute('data-density')];
      vi.advanceTimersToNextFrame();
      seen.push(bottomDock.getAttribute('data-density'));
      vi.advanceTimersToNextFrame();
      seen.push(bottomDock.getAttribute('data-density'));
      return seen;
    };

    controller.updateBottomDockLayout();
    expect(densities()).toEqual(['compact', 'compact', 'compact']);
    controller.updateBottomDockLayout();
    expect(bottomDock.getAttribute('data-density')).toBe('compact');
    controller.updateBottomDockLayout();
    expect(densities()).toEqual(['compact', 'compact', 'compact']);

    layout.viewport({ height: 760 });
    controller.updateBottomDockLayout();
    vi.advanceTimersToNextFrame();
    expect(bottomDock.getAttribute('data-density')).toBe('default');
  });

  it('holds its density through a live resize and settles once it ends', () => {
    const layout = createLayout();
    const { bottomDock, controller } = wrappingShortcuts(layout, 630);
    controller.updateBottomDockLayout();
    vi.advanceTimersToNextFrame();
    expect(bottomDock.getAttribute('data-density')).toBe('compact');

    const resizing: Array<string | null> = [];
    for (let width = 1279; width > 1271; width -= 1) {
      layout.viewport({ width });
      controller.updateBottomDockLayout({ stabilizeDockDensity: true });
      resizing.push(bottomDock.getAttribute('data-density'));
      vi.advanceTimersToNextFrame();
      resizing.push(bottomDock.getAttribute('data-density'));
    }
    expect(resizing).toEqual(Array(16).fill('compact'));

    layout.viewport({ width: 1271, height: 760 });
    controller.updateBottomDockLayout({ stabilizeDockDensity: true });
    vi.advanceTimersToNextFrame();
    expect(bottomDock.getAttribute('data-density')).toBe('compact');

    controller.updateBottomDockLayout();
    vi.advanceTimersToNextFrame();
    expect(bottomDock.getAttribute('data-density')).toBe('default');
  });
});

describe('the mobile flow', () => {
  const MOBILE = { innerWidth: 375, innerHeight: 667, constants: { mobileFlowBreakpointPx: 640 } };

  it('releases the fixed dock and centers the logo and search above it', () => {
    const layout = createLayout();
    const { body, bottomDock, controller } = createFixture(layout, MOBILE);
    body.style.setProperty('padding-top', '120px');
    bottomDock.style.setProperty('max-height', '427px');

    controller.updateBottomDockLayout();

    expect(body.classList.contains('x-nt-mobile-flow')).toBe(true);
    expect(body.getAttribute('data-nt-bottom-dock-density')).toBe('mobile');
    expect(bottomDock.getAttribute('data-layout')).toBe('flow');
    expect(bottomDock.style.getPropertyValue('max-height')).toBe('');
    // Logo 74 + search 57, centered in 667 - 220 dock and lifted 4% of that space.
    expect(body.style.getPropertyValue('padding-top')).toBe(`${Math.round(((667 - 220) - (74 + 57)) / 2 - (667 - 220) * 0.04)}px`);
  });

  it('counts the shortcuts and falls back to the minimum top when they do not fit', () => {
    const layout = createLayout();
    const { controller } = createFixture(layout, { ...MOBILE, shortcutVisible: true, shortcutBox: { height: 220 } });

    controller.updateBottomDockLayout();

    expect(searchTop()).toBe(48);
  });

  it('clears the bookmark top bar plus a gap', () => {
    const layout = createLayout();
    const { body, controller } = createFixture(layout, { ...MOBILE, topInsetPx: 52, shortcutVisible: true, shortcutBox: { height: 220 } });

    controller.updateBottomDockLayout();

    expect(body.style.getPropertyValue('padding-top')).toBe('64px');
  });

  it('holds the search entry still while the suggestions are open', () => {
    const layout = createLayout();
    const { body, bottomDock, controller } = createFixture(layout, MOBILE);
    controller.updateBottomDockLayout();
    const initialTop = body.style.getPropertyValue('padding-top');
    body.setAttribute('data-nt-suggestions-open', 'true');
    layout.place(bottomDock, box(80, 680, 920, 120));

    controller.updateSearchEntryLayout();

    expect(body.style.getPropertyValue('padding-top')).toBe(initialTop);
  });

  it('restores the fixed dock when the window widens', () => {
    const layout = createLayout();
    const { body, bottomDock, controller } = createFixture(layout, MOBILE);
    controller.updateBottomDockLayout();

    layout.viewport({ width: 1024 });
    controller.updateBottomDockLayout();

    expect(body.classList.contains('x-nt-mobile-flow')).toBe(false);
    expect(bottomDock.getAttribute('data-layout')).toBe('fixed');
    expect(bottomDock.style.getPropertyValue('max-height')).toMatch(/^\d+px$/);
    expect(body.style.getPropertyValue('padding-top')).toMatch(/^\d+px$/);
  });

  it('lets tall shortcuts keep their height, since the page scrolls', () => {
    const layout = createLayout();
    const { shortcutSection, controller } = createFixture(layout, {
      innerWidth: 500, shortcutBox: { top: 270, height: 900 }, shortcutVisible: true, constants: { mobileFlowBreakpointPx: 640 }
    });
    attachShortcutGrid(layout, shortcutSection, 900);

    controller.updateBottomDockLayout();

    expect(shortcutSection.getAttribute('data-shortcuts-scrollable')).toBeNull();
  });
});

function attachShortcutGrid(layout: Layout, section: HTMLElement, gridHeight: number): HTMLElement {
  const grid = element();
  grid.className = 'x-nt-shortcuts-grid';
  section.append(grid);
  layout.measure(grid, { offsetHeight: gridHeight });
  layout.measure(section, { offsetWidth: 260, clientWidth: 240, clientHeight: 200, scrollHeight: gridHeight });
  return grid;
}

// Shortcuts taller than the room above the bottom dock scroll inside their
// section instead of running under the dock, which takes their pointer events.
describe('a tall shortcut area', () => {
  it('scrolls above the bottom dock and drops the limit once the shortcuts fit', () => {
    const layout = createLayout();
    const { bottomDock, shortcutSection, controller } = createFixture(layout, { shortcutBox: { top: 270, height: 600 }, shortcutVisible: true });
    const grid = attachShortcutGrid(layout, shortcutSection, 600);

    controller.updateBottomDockLayout();

    expect(shortcutSection.getAttribute('data-shortcuts-scrollable')).toBe('true');
    expect(shortcutSection.style.getPropertyValue('--x-nt-shortcuts-max-height')).toBe('402px');
    expect(shortcutSection.style.getPropertyValue('--x-nt-shortcuts-scrollbar-gutter')).toBe('20px');
    expect(shortcutSection.getAttribute('data-shortcuts-more-below')).toBe('true');
    expect(shortcutSection.getAttribute('data-shortcuts-more-above')).toBe('false');

    const dockScroller = layout.place(element(), box(80, 650, 920, 250));
    bottomDock.append(dockScroller);
    controller.updateBottomDockLayout();
    expect(shortcutSection.style.getPropertyValue('--x-nt-shortcuts-max-height')).toBe('372px');

    layout.measure(grid, { offsetHeight: 300 });
    layout.measure(shortcutSection, { scrollHeight: 300 });
    controller.updateBottomDockLayout();
    expect(shortcutSection.getAttribute('data-shortcuts-scrollable')).toBeNull();
    expect(shortcutSection.style.getPropertyValue('--x-nt-shortcuts-max-height')).toBe('');
  });

  it('leaves the dock its minimum room on short screens', () => {
    const layout = createLayout();
    const { shortcutSection, controller } = createFixture(layout, {
      innerHeight: 600, rootBox: { top: 93, height: 56 }, shortcutBox: { top: 161, height: 500 }, shortcutVisible: true, constants: SHORT_DOCK
    });
    attachShortcutGrid(layout, shortcutSection, 500);

    controller.updateBottomDockLayout();

    expect(shortcutSection.style.getPropertyValue('--x-nt-shortcuts-max-height')).toBe('219px');
  });
});

// Leaving the bookmarks top bar moves the search entry, and the shortcuts
// with it, in the same pass that measures the dock; the dock's height
// follows where the shortcuts end up, not where they were.
describe('a search entry that moves', () => {
  it('takes the dock with the shortcuts to their new place', () => {
    const layout = createLayout();
    const { body, bottomDock, controller } = createFixture(layout, {
      shortcutVisible: true,
      shortcutBox: () => box(420, (searchTop() || 0) + 140, 240, 72)
    });
    controller.updateBottomDockLayout();
    body.style.setProperty('padding-top', '300px');

    controller.updateBottomDockLayout();

    const top = searchTop();
    expect(top).not.toBe(300);
    expect(bottomDock.style.getPropertyValue('max-height')).toBe(`${900 - (top + 140 + 72 + 8)}px`);
  });
});

describe('widths and grid columns', () => {
  // The search width slider's range and snap points are defined once and run
  // from the narrowest setting to the content column.
  it('spans the search width from standard to the content column', () => {
    expect(SEARCH_WIDTH_CONFIG.min).toBe(640);
    expect(SEARCH_WIDTH_CONFIG.max).toBe(CONTENT_MAX_WIDTH_PX);
    expect(Array.from(SEARCH_WIDTH_CONFIG.snapPoints)).toEqual([640, 720, 920, 1040]);
    expect(SEARCH_WIDTH_CONFIG.snapPoints).toContain(STANDARD_SEARCH_MAX_WIDTH_PX);
    expect(SEARCH_WIDTH_CONFIG.snapPoints).toContain(SEARCH_WIDTH_CONFIG.fallback);
    expect(Object.isFrozen(SEARCH_WIDTH_CONFIG) && Object.isFrozen(SEARCH_WIDTH_CONFIG.snapPoints)).toBe(true);
  });

  it('uses the mobile tier before the compact tier', () => {
    const config = {
      mobileBreakpointPx: 640, mobileColumns: 1, compactBreakpointPx: 860, compactColumns: 2,
      contentMaxWidth: 1040, targetColumnWidth: 248, gap: 12, minColumns: 4, maxColumns: 6
    };
    expect(getAdaptiveGridColumnCount({ ...config, viewportWidth: 375 })).toBe(1);
    expect(getAdaptiveGridColumnCount({ ...config, viewportWidth: 768 })).toBe(2);
  });

  it('treats the bookmark column preference as an adaptive maximum', () => {
    const config = {
      mobileBreakpointPx: 640, mobileColumns: 2, compactBreakpointPx: 860, compactColumns: 2,
      contentMaxWidth: 1548, targetColumnWidth: 154, gap: 12, minColumns: 2, maxColumns: 7
    };
    expect([1600, 1000, 390].map((viewportWidth) => getAdaptiveGridColumnCount({ ...config, viewportWidth }))).toEqual([7, 5, 2]);
  });

  it('lets wide recent grids reach their maximum columns', () => {
    expect(getGridContentWidthForColumns(6, 248, 12)).toBe(1548);
    const config = { compactBreakpointPx: 860, compactColumns: 2, contentMaxWidth: 1548, targetColumnWidth: 248, gap: 12, minColumns: 4, maxColumns: 6 };
    expect(getAdaptiveGridColumnCount({ ...config, viewportWidth: 1920 })).toBe(6);
    expect(getAdaptiveGridColumnCount({ ...config, viewportWidth: 1280 })).toBe(4);
  });
});
