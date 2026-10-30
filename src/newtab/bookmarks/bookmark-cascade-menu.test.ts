import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import {
  buildCascadeSafeTriangle,
  getTranslateNeutralRect,
  isPointInsideCascadeSafeTriangle,
  type Rect
} from './bookmark-cascade-position';
import {
  createBookmarkCascadeMenuRuntime,
  type BookmarkCascadeMenuOptions,
  type BookmarkCascadeRuntime,
  type BookmarkMenuAnchor
} from '../dom/bookmark-cascade-menu';
import type { BookmarkItem } from './bookmarks-store';
import type { MenuSurfaceElement } from '../../shared/ui/menu-surface';
import { getElements, getTags } from '../../../tests/fakes/dom';

// Longer than the menus' hover-intent delay and their close delay, and
// shorter than how long a safe triangle protects an open submenu.
const HOVER_PAUSE_MS = 400;
const CLOSE_PAUSE_MS = 600;

// jsdom lays nothing out, so each element reports the box a test gives it,
// or a menu row's size.
const rects = new WeakMap<Element, Rect>();

function box(left: number, top: number, width: number, height: number): Rect {
  return { left, top, width, height, right: left + width, bottom: top + height };
}

function setRect(element: Element, rect: Rect): void {
  rects.set(element, rect);
}

function createClock() {
  let now = 0;
  let nextId = 1;
  const timers: Array<{ id: number; due: number; callback: () => void; cleared: boolean }> = [];
  return {
    now: () => now,
    setTimeout(callback: () => void, delay: number): number {
      const id = nextId;
      nextId += 1;
      timers.push({ id, due: now + Math.max(0, Number(delay) || 0), callback, cleared: false });
      return id;
    },
    clearTimeout(id: number): void {
      timers.forEach((timer) => {
        if (timer.id === id) timer.cleared = true;
      });
    },
    advance(ms: number): void {
      now += ms;
      act(() => {
        for (;;) {
          timers.sort((a, b) => a.due - b.due);
          const next = timers.find((timer) => !timer.cleared && timer.due <= now);
          if (!next) break;
          timers.splice(timers.indexOf(next), 1);
          next.callback();
        }
      });
    }
  };
}

function levels(): HTMLElement[] {
  return getElements(document, '.x-nt-bookmark-cascade-level');
}

function items(level: HTMLElement | undefined): HTMLButtonElement[] {
  return level ? getTags(level, '.x-nt-bookmark-cascade-item', 'button') : [];
}

function folder(id: string, title: string, index = 0): BookmarkItem {
  return { type: 'folder', id, title, index, parentId: '', url: '', host: '', themeUrl: '', childCount: 0, previewUrls: [] };
}

function site(id: string, title: string, url: string, index = 0): BookmarkItem {
  return { type: 'bookmark', id, title, url, index, parentId: '', host: '', themeUrl: '' };
}

function activeLabel(level: HTMLElement | undefined): string {
  const active = level ? level.querySelector('.x-nt-bookmark-cascade-item[data-active="true"]') : null;
  return active ? String(active.textContent) : '';
}

function levelTitle(level: HTMLElement | undefined): string {
  const title = level ? level.querySelector('.x-nt-bookmark-cascade-title') : null;
  return title ? String(title.textContent) : '';
}

// Lays a level out at `rect`, with its rows stacked under a 34px title.
function layOut(level: HTMLElement | undefined, rect: Partial<Rect>): void {
  if (!level) return;
  const levelRect = box(rect.left ?? 40, rect.top ?? 70, rect.width ?? 210, rect.height ?? 140);
  setRect(level, levelRect);
  items(level).forEach((item, index) => {
    setRect(item, box(levelRect.left, levelRect.top + 34 + index * 32, levelRect.width, 32));
  });
}

interface PointerInit {
  clientX?: number;
  clientY?: number;
  relatedTarget?: EventTarget | null;
}

function pointer(type: string, target: Element, init: PointerInit = {}): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
    relatedTarget: init.relatedTarget ?? null
  });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  act(() => {
    target.dispatchEvent(event);
  });
}

// The pointer moves from `from` onto `to` (or off both when `to` is null).
function movePointer(from: Element | null, to: Element | null, init: PointerInit = {}): void {
  if (from) {
    pointer('pointerout', from, { ...init, relatedTarget: to });
  } else if (to) {
    pointer('pointerover', to, { ...init, relatedTarget: null });
  }
}

function key(name: string, extra: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...extra });
  act(() => {
    (document.activeElement || document.body).dispatchEvent(event);
  });
  return event;
}

function click(target: Element, init: MouseEventInit = {}, type = 'click'): MouseEvent {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

const FOLDERS: Record<string, BookmarkItem[]> = {
  root: [folder('research', 'Research', 0), site('archive', 'Archive', 'https://example.com/archive', 1)],
  research: [site('amazon', 'Amazon Menu Aim', 'https://example.com/amazon', 0)]
};

interface Fixture {
  anchor: BookmarkMenuAnchor;
  anchorStates: boolean[];
  clock: ReturnType<typeof createClock>;
  openedLevels: MenuSurfaceElement[];
  openedUrls: Array<{ url: string; background: boolean; anchor: unknown }>;
  runtime: BookmarkCascadeRuntime;
}

let runtimes: BookmarkCascadeRuntime[] = [];

function createFixture(options: Partial<BookmarkCascadeMenuOptions> & { folders?: Record<string, BookmarkItem[]> } = {}): Fixture {
  const { folders = FOLDERS, ...overrides } = options;
  const clock = createClock();
  const openedLevels: MenuSurfaceElement[] = [];
  const openedUrls: Fixture['openedUrls'] = [];
  const anchorStates: boolean[] = [];
  const anchor: BookmarkMenuAnchor = document.createElement('button');
  // Draws its own expanded state, as the views' folder cards and tiles do.
  anchor._xSetBookmarkMenuVisualActive = (active) => {
    anchorStates.push(active);
    anchor.setAttribute('aria-expanded', String(active));
  };
  setRect(anchor, box(20, 20, 120, 40));
  document.body.appendChild(anchor);
  const runtime = createBookmarkCascadeMenuRuntime({
    documentObj: document,
    windowObj: {
      innerWidth: 1024,
      innerHeight: 720,
      performance: { now: clock.now },
      setTimeout: clock.setTimeout,
      clearTimeout: clock.clearTimeout,
      requestAnimationFrame: () => 0,
      getComputedStyle: () => ({ transform: 'none' })
    },
    positionUtils: {
      placeRootCascadeMenu: () => ({ left: 40, top: 70, horizontal: 'left', vertical: 'below' }),
      placeCascadeSubmenu: () => ({ left: 252, top: 70, side: 'right' }),
      getTranslateNeutralRect,
      buildCascadeSafeTriangle,
      isPointInsideCascadeSafeTriangle
    },
    menuSurface: {
      open<T extends MenuSurfaceElement>(element: T | null | undefined): T | null {
        if (!element) return null;
        openedLevels.push(element);
        element.setAttribute('data-open', 'true');
        return element;
      }
    },
    t: (_key, fallback) => fallback || '',
    ensureReady: () => Promise.resolve(true),
    getItems: (folderId) => folders[folderId] || [],
    openUrl: (url, openOptions) => {
      openedUrls.push({ url, background: openOptions.openInBackgroundTab, anchor: openOptions.anchor });
    },
    ...overrides
  });
  runtimes.push(runtime);
  return { anchor, anchorStates, clock, openedLevels, openedUrls, runtime };
}

async function openRoot(fixture: Fixture, openOptions?: Parameters<BookmarkCascadeRuntime['open']>[2]): Promise<void> {
  act(() => fixture.runtime.open({ id: 'root', title: 'Root' }, fixture.anchor, openOptions));
  await settle();
}

// Opens the root menu and the Research submenu, laid out side by side.
async function openWithSubmenu(options: Parameters<typeof createFixture>[0] = {}): Promise<Fixture> {
  const fixture = createFixture(options);
  await openRoot(fixture);
  layOut(levels()[0], { left: 40, top: 70 });
  click(items(levels()[0])[0]);
  layOut(levels()[0], { left: 40, top: 70 });
  layOut(levels()[1], { left: 252, top: 104, height: 120 });
  return fixture;
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const rect = rects.get(this) || box(0, 0, 210, 32);
    return { ...rect, x: rect.left, y: rect.top, toJSON: () => rect };
  });
});

afterEach(() => {
  act(() => runtimes.forEach((runtime) => runtime.close()));
  runtimes = [];
  document.body.replaceChildren();
});

describe('New Tab bookmark folder menu: hover intent', () => {
  it('does not open a folder while hover is suppressed during a drag', async () => {
    let suppress = false;
    const fixture = createFixture({ shouldSuppressHover: () => suppress });
    const { clock } = fixture;
    await openRoot(fixture);
    layOut(levels()[0], {});
    suppress = true;
    movePointer(null, items(levels()[0])[0], { clientX: 80, clientY: 104 });
    clock.advance(HOVER_PAUSE_MS);

    expect(levels()).toHaveLength(1);
    expect(items(levels()[0])[0].getAttribute('data-hover-suppressed')).toBe('true');
  });

  it('stays open in drag mode when the pointer leaves its levels', async () => {
    const fixture = createFixture();
    await openRoot(fixture);
    layOut(levels()[0], {});
    act(() => fixture.runtime.setDragMode(true));
    act(() => {
      document.body.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 900, clientY: 650 }));
    });
    fixture.clock.advance(CLOSE_PAUSE_MS);

    expect(fixture.runtime.isOpen()).toBe(true);
  });

  it('keeps an open submenu while the pointer heads diagonally toward it', async () => {
    const { clock } = await openWithSubmenu();
    const rootItems = items(levels()[0]);
    act(() => {
      document.body.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 120, clientY: 120 }));
    });
    movePointer(rootItems[0], rootItems[1], { clientX: 220, clientY: 138 });
    clock.advance(HOVER_PAUSE_MS);

    expect(levels()).toHaveLength(2);
    expect(activeLabel(levels()[0])).toBe('Research');
  });

  it('protects the submenu mid-lane and quiets the crossed row meanwhile', async () => {
    const { clock } = await openWithSubmenu();
    const rootItems = items(levels()[0]);
    act(() => {
      document.body.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 120, clientY: 120 }));
    });
    movePointer(rootItems[0], rootItems[1], { clientX: 170, clientY: 138 });
    clock.advance(HOVER_PAUSE_MS);

    expect(levels()).toHaveLength(2);
    expect(activeLabel(levels()[0])).toBe('Research');
    expect(rootItems[1].getAttribute('data-hover-suppressed')).toBe('true');

    movePointer(rootItems[1], levels()[1], { clientX: 252, clientY: 138 });
    expect(rootItems[1].hasAttribute('data-hover-suppressed')).toBe(false);
  });

  it('switches rows after the usual pause when the pointer moves straight down', async () => {
    const { clock } = await openWithSubmenu();
    const rootItems = items(levels()[0]);
    act(() => {
      document.body.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 120, clientY: 120 }));
    });
    pointer('pointerout', rootItems[0], { clientX: 150, clientY: 138, relatedTarget: levels()[0] });

    expect(levels()).toHaveLength(1);
    expect(activeLabel(levels()[0])).toBe('');

    movePointer(null, rootItems[1], { clientX: 150, clientY: 138 });
    clock.advance(HOVER_PAUSE_MS);
    expect(levels()).toHaveLength(1);
    expect(activeLabel(levels()[0])).toBe('Archive');
  });

  it('keeps an expanded submenu when its folder is clicked again', async () => {
    const { openedLevels } = await openWithSubmenu();
    const opened = openedLevels.length;
    const submenu = levels()[1];
    click(items(levels()[0])[0]);

    expect(openedLevels).toHaveLength(opened);
    expect(levels()).toHaveLength(2);
    expect(levels()[1]).toBe(submenu);
    expect(activeLabel(levels()[0])).toBe('Research');
  });

  it('opens a site in the background on Command-click or middle-click and stays open', async () => {
    const bindings: Array<{ target: HTMLElement | null; getText: unknown; options: unknown }> = [];
    const hideCursorTooltip = vi.fn();
    const fixture = await openWithSubmenu({
      bindCursorTooltip: (target, getText, options) => {
        bindings.push({ target, getText, options });
        return target;
      },
      hideCursorTooltip
    });
    const site = items(levels()[1])[0];
    const binding = bindings.find((entry) => entry.target === site);
    expect(binding).toBeDefined();
    expect(typeof binding?.getText === 'function' ? binding.getText(site) : '').toBe('Amazon Menu Aim');
    expect(binding?.options).not.toHaveProperty('getTagText');

    click(site, { metaKey: true });
    expect(fixture.runtime.isOpen()).toBe(true);
    click(site, { button: 1 }, 'auxclick');
    expect(fixture.runtime.isOpen()).toBe(true);
    expect(fixture.openedUrls.map(({ url, background }) => ({ url, background }))).toEqual([
      { url: 'https://example.com/amazon', background: true },
      { url: 'https://example.com/amazon', background: true }
    ]);
    expect(hideCursorTooltip).toHaveBeenCalled();

    act(() => {
      document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    });
    expect(fixture.runtime.isOpen()).toBe(false);
  });

  it('closes on an ordinary click and opens the site in place', async () => {
    const fixture = await openWithSubmenu();
    click(items(levels()[1])[0]);

    expect(fixture.runtime.isOpen()).toBe(false);
    expect(fixture.openedUrls.map(({ url, background }) => ({ url, background }))).toEqual([
      { url: 'https://example.com/amazon', background: false }
    ]);
  });

  it('marks the row whose context menu is open', async () => {
    const fixture = await openWithSubmenu();
    act(() => fixture.runtime.setContextMenuBookmark('amazon'));
    expect(items(levels()[1])[0].getAttribute('data-bookmark-context-menu-open')).toBe('true');
    expect(items(levels()[0]).some((row) => row.hasAttribute('data-bookmark-context-menu-open'))).toBe(false);
    act(() => fixture.runtime.setContextMenuBookmark(null));
    expect(items(levels()[1])[0].hasAttribute('data-bookmark-context-menu-open')).toBe(false);
  });

  it('opens a site in the background on Ctrl+Enter and stays open', async () => {
    const fixture = await openWithSubmenu();
    const site = items(levels()[1])[0];
    act(() => {
      site.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }));
    });

    expect(fixture.openedUrls.map(({ url, background }) => ({ url, background }))).toEqual([
      { url: 'https://example.com/amazon', background: true }
    ]);
    expect(fixture.runtime.isOpen()).toBe(true);
  });
});

const KEYBOARD_FOLDERS: Record<string, BookmarkItem[]> = {
  root: [
    folder('research', 'Research', 0),
    folder('patterns', 'Patterns', 1),
    site('archive', 'Archive', 'https://example.com/archive', 2),
    site('router', 'Router', 'http://192.168.1.1/admin', 3)
  ],
  research: [
    site('amazon', 'Amazon Menu Aim', 'https://example.com/amazon', 0),
    site('nngroup', 'NNGroup', 'https://example.com/nngroup', 1)
  ],
  patterns: [site('pattern-library', 'Pattern Library', 'https://example.com/patterns', 0)]
};

describe('New Tab bookmark folder menu: keyboard, copy and toggling', () => {
  function createKeyboardFixture() {
    const faviconCalls: Array<{ url: string; host: string; browserUrl: string }> = [];
    const copyCalls: string[] = [];
    const tooltipCalls: Array<Record<string, unknown>> = [];
    const fixture = createFixture({
      folders: KEYBOARD_FOLDERS,
      positionUtils: {
        placeRootCascadeMenu: () => ({ left: 40, top: 70, horizontal: 'right', vertical: 'below' }),
        placeCascadeSubmenu: () => ({ left: 260, top: 70, side: 'right' }),
        getTranslateNeutralRect,
        buildCascadeSafeTriangle: () => null,
        isPointInsideCascadeSafeTriangle: () => false
      },
      getHostFromUrl: (url) => new URL(url).hostname,
      attachFaviconWithFallbacks(_image, url, host, options) {
        faviconCalls.push({ url, host, browserUrl: options.browserUrl });
      },
      isLocalNetworkHost: (host) => host.startsWith('192.168.'),
      getChromeFaviconUrl: (url) => `chrome://favicon2/?pageUrl=${encodeURIComponent(url)}&size=128`,
      copyTooltipController: {
        show(target, text, options) {
          tooltipCalls.push({ type: 'show', target, text, ...options });
          return null;
        },
        hide() {
          tooltipCalls.push({ type: 'hide' });
          return null;
        }
      },
      copyUrl(url) {
        copyCalls.push(url);
        return Promise.resolve(true);
      }
    });
    return { ...fixture, copyCalls, faviconCalls, tooltipCalls };
  }

  it('opens with the first row selected and focused, at a locked width', async () => {
    const fixture = createKeyboardFixture();
    await openRoot(fixture);

    expect(fixture.anchorStates).toEqual([true]);
    expect(levels()).toHaveLength(1);
    expect(levels()[0].style.getPropertyValue('width')).toBe('210px');
    expect(levelTitle(levels()[0])).toBe('Root');
    expect(items(levels()[0])).toHaveLength(4);
    expect(fixture.faviconCalls).toContainEqual({
      url: 'http://192.168.1.1/admin',
      host: '192.168.1.1',
      browserUrl: 'chrome://favicon2/?pageUrl=http%3A%2F%2F192.168.1.1%2Fadmin&size=128'
    });
    expect(activeLabel(levels()[0])).toBe('Research');
    expect(document.activeElement).toBe(items(levels()[0])[0]);

    const rootLevel = levels()[0];
    await openRoot(fixture);
    expect(levels()[0]).toBe(rootLevel);
    expect(fixture.anchorStates).toEqual([true]);
  });

  it('copies a site link from its own button with its own tooltip', async () => {
    const fixture = createKeyboardFixture();
    await openRoot(fixture);
    const copyButtons = getTags(levels()[0], '.x-nt-bookmark-cascade-copy-trigger', 'button');
    expect(copyButtons).toHaveLength(2);
    const [archiveCopy] = copyButtons;
    expect(archiveCopy.getAttribute('aria-label')).toBe('Copy link');
    const expectedShow = { type: 'show', target: archiveCopy, text: 'Copy link', placement: 'top', maxWidth: 200, spacing: 8 };

    const before = fixture.tooltipCalls.length;
    const row = archiveCopy.parentElement;
    if (row) movePointer(null, row);
    expect(fixture.tooltipCalls).toHaveLength(before);

    movePointer(null, archiveCopy);
    expect(fixture.tooltipCalls.at(-1)).toEqual(expectedShow);

    const bubbled = vi.fn();
    document.addEventListener('click', bubbled);
    const copyClick = click(archiveCopy);
    document.removeEventListener('click', bubbled);
    await settle();
    expect(fixture.copyCalls).toEqual(['https://example.com/archive']);
    expect(copyClick.defaultPrevented).toBe(true);
    expect(bubbled).not.toHaveBeenCalled();
    expect(fixture.openedUrls).toEqual([]);

    pointer('pointerout', archiveCopy, { relatedTarget: null });
    expect(fixture.tooltipCalls.at(-1)).toEqual({ type: 'hide' });
    act(() => archiveCopy.focus());
    expect(fixture.tooltipCalls.at(-1)).toEqual(expectedShow);
  });

  it('moves through rows and submenus with the arrow keys and closes on Escape', async () => {
    const pointerMoves = { added: 0, removed: 0 };
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    const fixture = createKeyboardFixture();
    await openRoot(fixture);
    const rootItems = items(levels()[0]);

    key('ArrowDown');
    expect(activeLabel(levels()[0])).toBe('Patterns');
    expect(document.activeElement).toBe(rootItems[1]);
    key('ArrowUp');
    expect(activeLabel(levels()[0])).toBe('Research');
    expect(document.activeElement).toBe(rootItems[0]);

    expect(key('ArrowRight').defaultPrevented).toBe(true);
    expect(levels()).toHaveLength(2);
    expect(rootItems[0].getAttribute('aria-expanded')).toBe('true');
    expect(levelTitle(levels()[1])).toBe('Research');
    expect(items(levels()[1])).toHaveLength(2);
    expect(activeLabel(levels()[1])).toBe('Amazon Menu Aim');
    expect(document.activeElement).toBe(items(levels()[1])[0]);

    key('ArrowDown');
    expect(activeLabel(levels()[1])).toBe('NNGroup');

    key('ArrowLeft');
    expect(levels()).toHaveLength(1);
    expect(rootItems[0].getAttribute('aria-expanded')).toBe('false');
    expect(activeLabel(levels()[0])).toBe('Research');
    expect(document.activeElement).toBe(rootItems[0]);

    key('ArrowDown');
    key('ArrowRight');
    expect(levels()).toHaveLength(2);
    expect(levelTitle(levels()[1])).toBe('Patterns');
    expect(activeLabel(levels()[1])).toBe('Pattern Library');

    add.mock.calls.forEach(([type]) => {
      if (type === 'pointermove') pointerMoves.added += 1;
    });
    key('Escape');
    remove.mock.calls.forEach(([type]) => {
      if (type === 'pointermove') pointerMoves.removed += 1;
    });
    expect(fixture.runtime.isOpen()).toBe(false);
    expect(pointerMoves).toEqual({ added: 1, removed: 1 });
    expect(document.activeElement).toBe(fixture.anchor);
    expect(fixture.anchorStates.at(-1)).toBe(false);
  });

  it('opens sites in place or in the background, carrying the menu anchor', async () => {
    const fixture = createKeyboardFixture();
    await openRoot(fixture);
    click(items(levels()[0])[2]);
    expect(fixture.openedUrls[0]).toEqual({ url: 'https://example.com/archive', background: false, anchor: fixture.anchor });
    expect(fixture.runtime.isOpen()).toBe(false);

    await openRoot(fixture);
    click(items(levels()[0])[2], { button: 1 }, 'auxclick');
    expect(fixture.openedUrls[1]).toEqual({ url: 'https://example.com/archive', background: true, anchor: fixture.anchor });
    expect(fixture.runtime.isOpen()).toBe(true);
  });

  it('toggles from its folder, honouring the last of quick repeated activations', async () => {
    const fixture = createKeyboardFixture();
    const toggle = { toggle: true };
    await openRoot(fixture, toggle);
    expect(fixture.runtime.isOpen()).toBe(true);
    expect(fixture.anchor.getAttribute('aria-expanded')).toBe('true');
    key('ArrowRight');
    act(() => fixture.runtime.open({ id: 'root', title: 'Root' }, fixture.anchor, toggle));
    expect(fixture.runtime.isOpen()).toBe(false);
    expect(levels()).toHaveLength(0);
    expect(fixture.anchor.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.anchorStates.at(-1)).toBe(false);
    expect(document.activeElement).toBe(fixture.anchor);

    await openRoot(fixture, toggle);
    expect(fixture.runtime.isOpen()).toBe(true);
    act(() => fixture.runtime.close());

    act(() => {
      fixture.runtime.open({ id: 'root', title: 'Root' }, fixture.anchor, toggle);
      fixture.runtime.open({ id: 'root', title: 'Root' }, fixture.anchor, toggle);
    });
    await settle();
    expect(fixture.runtime.isOpen()).toBe(false);
    expect(fixture.anchor.getAttribute('aria-expanded')).toBe('false');

    act(() => {
      fixture.runtime.open({ id: 'root', title: 'Root' }, fixture.anchor, toggle);
      fixture.runtime.open({ id: 'root', title: 'Root' }, fixture.anchor, toggle);
      fixture.runtime.open({ id: 'root', title: 'Root' }, fixture.anchor, toggle);
    });
    await settle();
    expect(fixture.runtime.isOpen()).toBe(true);
    act(() => fixture.runtime.close());

    await openRoot(fixture, { dragMode: true, toggle: true });
    const dragMenu = document.querySelector('.x-nt-bookmark-cascade-menu');
    act(() => fixture.runtime.open({ id: 'root', title: 'Root' }, fixture.anchor, { dragMode: true, toggle: true }));
    expect(fixture.runtime.isOpen()).toBe(true);
    expect(document.querySelector('.x-nt-bookmark-cascade-menu')).toBe(dragMenu);
  });
});
