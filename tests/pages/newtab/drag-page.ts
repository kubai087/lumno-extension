// New Tab laid out for drag tests: booted (boot.ts) over a bookmarks tree
// that changes (tests/fakes/bookmarks.ts), with the shortcut row, the
// bookmark grid and the recent sites row given boxes (tests/fakes/layout.ts)
// that follow their current order, so a test drags between them through New
// Tab's own pointer handling. Timers are fake once the page is up; `advance`
// runs them.
//
//   const newtab = await openDragPage({ shortcuts, bookmarks });
//   await newtab.dragTo(newtab.card('link'), newtab.shortcutSlot(1));
//   await newtab.undo(); await newtab.redo();
import { act } from 'react';
import { onTestFinished, vi } from 'vitest';
import { createShortcutStoragePlan } from '../../../src/domain/shortcuts/storage-plan';
import { motionEffectsEnabled } from '../../../src/domain/settings/appearance';
import { recentCount, recentMode } from '../../../src/domain/settings/recent-sites';
import { webdavStatus } from '../../../src/domain/settings/sync-state';
import { createBrowserFake, type BrowserFake, type FakeHistoryItem } from '../../fakes/browser';
import { createBookmarksFake, type BookmarkInput, type BookmarksFake } from '../../fakes/bookmarks';
import { createLayout, type Layout, type Row } from '../../fakes/layout';
import { expectElement, getElementById, getElements } from '../../fakes/dom';
import { bootNewtab, waitFor } from './boot';

const BOOKMARKS_SECTION_ID = '_x_extension_newtab_bookmarks_2024_unique_';
const BOOKMARK_GRID_ID = '_x_extension_newtab_bookmarks_grid_2024_unique_';
const RECENT_SECTION_ID = '_x_extension_newtab_recent_sites_2024_unique_';
const TOAST_ID = '_x_extension_toast_2024_unique_';

const SHORTCUT_ROW: Row = { left: 300, top: 400, width: 64, height: 64, gap: 8 };
const BOOKMARK_ROW: Row = { left: 100, top: 100, width: 188, height: 51, gap: 12 };
const RECENT_ROW: Row = { left: 100, top: 560, width: 120, height: 80, gap: 10 };

type Point = [number, number];

interface DragPageOptions {
  // Shortcut inputs: { url, title } for a website, { type: 'folder', folderId, title } for a folder.
  shortcuts?: object[];
  bookmarks?: BookmarkInput[];
  otherBookmarks?: BookmarkInput[];
  sync?: Record<string, unknown>;
  local?: Record<string, unknown>;
  // A WebDAV backup covers the shortcuts, so bookmarks move instead of being copied.
  webdavBackup?: boolean;
  // History entries shown as recent sites.
  recent?: FakeHistoryItem[];
  // Leaves the rows without boxes, for a test that lays the page out itself.
  unplaced?: boolean;
  // The window's size from the start.
  viewport?: { width?: number; height?: number };
  // Runs before the page's scripts, e.g. to watch the page as it starts.
  beforeBoot?(browser: BrowserFake): void;
}

interface PointerOptions {
  target?: Element;
  release?: boolean;
}

const FAKED_TIMERS: Array<'setTimeout' | 'clearTimeout' | 'setInterval' | 'clearInterval' | 'requestAnimationFrame' | 'cancelAnimationFrame'> =
  ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame'];

// Runs the page's timers until `booting` settles. Its entries load as
// modules, which takes turns of the real event loop as well.
async function runBooting(booting: Promise<void>): Promise<void> {
  let settled = false;
  const done = booting.finally(() => {
    settled = true;
  });
  // Date stays real: the first boot of a file also compiles the entries.
  const deadline = Date.now() + 15000;
  while (!settled && Date.now() < deadline) {
    await new Promise((resolve) => setImmediate(resolve));
    await advance(20);
  }
  if (!settled) {
    throw new Error('New Tab did not finish booting');
  }
  await done;
}

// Runs the page's timers for `ms`, letting React commit what they do.
async function advance(ms = 0): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function pointer(type: string, x: number, y: number, target?: Element): void {
  const at = target || document.elementFromPoint(x, y) || document.body;
  at.dispatchEvent(new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    buttons: type === 'pointerup' ? 0 : 1,
    clientX: x,
    clientY: y
  }));
}

// Presses on `source`, moves past the drag threshold and along `points`,
// then releases on the last one unless `release` is false.
async function drag(source: Element, points: Point[], options: PointerOptions = {}): Promise<void> {
  const box = source.getBoundingClientRect();
  const start: Point = [box.left + box.width / 2, box.top + box.height / 2];
  pointer('pointerdown', start[0], start[1], source);
  pointer('pointermove', start[0] + 12, start[1] + 12);
  await advance(20);
  for (const [x, y] of points) {
    pointer('pointermove', x, y);
    await advance(20);
  }
  const last = points[points.length - 1];
  pointer('pointermove', last[0], last[1]);
  await advance(20);
  if (options.release !== false) {
    pointer('pointerup', last[0], last[1]);
    await advance(120);
  }
}

// Runs the page's timers until `check` holds, for at most `ms` of page
// time. Each step also lets real tasks run, such as a lazily imported module
// loading.
async function waitUntil(check: () => boolean, message: string, ms = 3000): Promise<void> {
  for (let waited = 0; waited < ms && !check(); waited += 20) {
    await act(async () => {
      await new Promise((resolve) => setImmediate(resolve));
    });
    await advance(20);
  }
  if (!check()) throw new Error(message);
}

async function key(init: KeyboardEventInit): Promise<void> {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
  await advance(300);
}

function slotX(boxes: DOMRect[], index: number): number {
  if (index <= 0) return boxes[0].left + 2;
  if (index >= boxes.length) return boxes[boxes.length - 1].right - 2;
  return (boxes[index - 1].right + boxes[index].left) / 2;
}

function storagePayload(options: DragPageOptions): { sync: Record<string, unknown>; local: Record<string, unknown> } {
  const sync: Record<string, unknown> = {
    [motionEffectsEnabled.key]: false,
    ...(options.shortcuts ? createShortcutStoragePlan({ items: options.shortcuts }).payload : {}),
    ...(options.recent ? { [recentCount.key]: 8, [recentMode.key]: 'latest' } : {}),
    ...options.sync
  };
  const local: Record<string, unknown> = {
    ...(options.webdavBackup ? { [webdavStatus.key]: { enabled: true, state: 'ready' } } : {}),
    ...options.local
  };
  return { sync, local };
}

function layOut(layout: Layout): void {
  layout.place(getElementById(BOOKMARKS_SECTION_ID), { left: 80, top: 80, width: 1100, height: 100 });
  const grid = getElementById(BOOKMARK_GRID_ID);
  layout.place(grid, { left: 100, top: 100, width: 1000, height: 51 });
  layout.flow(grid, '.x-nt-bookmark-card', BOOKMARK_ROW);
  const tile = document.querySelector('.x-nt-shortcut-tile');
  const shortcutGrid = tile ? tile.parentElement : null;
  if (shortcutGrid) {
    layout.place(shortcutGrid, { left: 300, top: 400, width: 600, height: 80 });
    layout.flow(shortcutGrid, '.x-nt-shortcut-tile', SHORTCUT_ROW);
  }
  const recentSection = document.getElementById(RECENT_SECTION_ID);
  const recentCard = document.querySelector('.x-nt-recent-card');
  if (recentSection && recentCard && recentCard.parentElement) {
    layout.place(recentSection, { left: 80, top: 540, width: 700, height: 120 });
    layout.flow(recentCard.parentElement, '.x-nt-recent-card', RECENT_ROW);
  }
}

async function openDragPage(options: DragPageOptions = {}) {
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
  const { sync, local } = storagePayload(options);
  const base = createBrowserFake({
    sync,
    local,
    history: options.recent,
    tabs: [{ id: 1, windowId: 1, index: 0, url: 'chrome://newtab/', title: 'New Tab', active: true, pinned: false }]
  });
  const bookmarks: BookmarksFake = createBookmarksFake({ bar: options.bookmarks, other: options.otherBookmarks, runtime: base.runtime });
  const browser: BrowserFake = { ...base, bookmarks: bookmarks.api };
  const layout = createLayout();
  if (options.viewport) layout.viewport(options.viewport);
  if (options.beforeBoot) options.beforeBoot(browser);
  // The page's clock is fake from before it boots: modules that keep a timer
  // function they read at start (the tooltips' frames) run on it too.
  vi.useFakeTimers({ toFake: FAKED_TIMERS });
  // The next test, and the next boot, start on the real clock.
  onTestFinished(() => {
    vi.useRealTimers();
  });
  await runBooting(bootNewtab(browser).then(() => waitFor(
    () => document.body.getAttribute('data-nt-ready') === '1',
    'New Tab did not mark itself ready'
  )));
  await advance(300);
  if (!options.unplaced) layOut(layout);

  const tiles = () => getElements(document, '.x-nt-shortcut-tile:not(.x-nt-shortcut-tile--add)');
  const grid = () => getElementById(BOOKMARK_GRID_ID);
  const label = (element: Element) => (element.getAttribute('aria-label') || '').replace(/^Open /, '');
  const find = (elements: HTMLElement[], title: string, what: string) => {
    const found = elements.find((element) => label(element) === title);
    return expectElement(found, `${what} ${title}`);
  };
  return {
    browser,
    bookmarks,
    layout,
    advance,
    waitUntil,
    drag,
    pointer,
    key,
    tile: (title: string) => find(tiles(), title, 'the shortcut'),
    shortcuts: () => tiles().map(label),
    card: (id: string) => expectElement(grid().querySelector(`.x-nt-bookmark-card[data-bookmark-id="${id}"]`), `the bookmark card ${id}`),
    recentCard: (title: string) => find(getElements(document, '.x-nt-recent-card'), title, 'the recent site'),
    // The titles on the bookmarks bar.
    bar: () => bookmarks.titles('1'),
    // The Toast's text while it shows, else ''.
    toast() {
      const toast = getElementById(TOAST_ID);
      return toast.getAttribute('data-show') === 'true' ? toast.textContent || '' : '';
    },
    // The point between the shortcuts at `index` - 1 and `index`.
    shortcutSlot(index: number): Point {
      return [slotX(tiles().map((tile) => tile.getBoundingClientRect()), index), SHORTCUT_ROW.top + SHORTCUT_ROW.height / 2];
    },
    // The point between the bookmarks at `index` - 1 and `index`.
    bookmarkSlot(index: number): Point {
      const boxes = getElements(grid(), '.x-nt-bookmark-card').map((card) => card.getBoundingClientRect());
      return [slotX(boxes, index), BOOKMARK_ROW.top + BOOKMARK_ROW.height / 2];
    },
    async dragTo(source: Element, point: Point) {
      await drag(source, [[point[0], point[1] - 40], point]);
      await advance(200);
    },
    undo: () => key({ key: 'z', code: 'KeyZ', metaKey: true }),
    redo: () => key({ key: 'z', code: 'KeyZ', metaKey: true, shiftKey: true }),
    // Makes saving fail in both storage areas, or work again.
    failWrites(failing: boolean) {
      [browser.storage.sync, browser.storage.local].forEach((area) => {
        if (failing) {
          vi.spyOn(area, 'set').mockImplementation(() => {
            throw new Error('QUOTA_BYTES quota exceeded');
          });
        } else {
          vi.mocked(area.set).mockRestore();
        }
      });
    }
  };
}

type DragPage = Awaited<ReturnType<typeof openDragPage>>;

export { advance, drag, openDragPage, pointer, waitUntil };
export type { DragPage, DragPageOptions, Point };
