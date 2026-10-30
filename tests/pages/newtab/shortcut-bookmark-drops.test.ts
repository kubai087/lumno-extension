import { describe, expect, it } from 'vitest';
import type { BookmarkInput } from '../../fakes/bookmarks';
import type { Row } from '../../fakes/layout';
import { getElementById, getElements, required } from '../../fakes/dom';
import { openDragPage, waitUntil, type DragPage } from './drag-page';

// Dragging a New Tab shortcut onto the bookmarks (the grid, the list or the
// bookmarks bar) places it where it lands: between two bookmarks inserts it
// there, the middle of a folder files it inside, and its own folder just
// removes the shortcut. Each drop is undone before the next.

const MODE_KEY = '_x_extension_bookmark_view_mode_2026_unique_';
type Mode = 'folder' | 'list' | 'top';
type SourceType = 'website' | 'folder';
const SOURCES = {
  website: { url: 'https://source.example/', title: 'Source website' },
  folder: { type: 'folder', folderId: '30', title: 'Source folder' }
};
const GEOMETRY: Record<Mode, Row> = {
  folder: { left: 100, top: 100, width: 188, height: 51, gap: 12 },
  list: { left: 100, top: 100, width: 188, height: 51, gap: 12 },
  top: { left: 100, top: 4, width: 100, height: 28, gap: 2 }
};

interface Options {
  websites?: boolean;
  empty?: boolean;
  firstFolderChildren?: BookmarkInput[];
  sourceAsCard?: boolean;
}

interface Placement {
  parentId?: unknown;
  index?: unknown;
  title?: unknown;
  url?: unknown;
}

function placementOf(value: unknown): Placement {
  return typeof value === 'object' && value !== null ? Object.fromEntries(Object.entries(value)) : {};
}

function barItems(options: Options): BookmarkInput[] {
  const items = (options.empty ? [] : ['first', 'second', 'third']).map((title, index): BookmarkInput => (options.websites
    ? { id: String(21 + index), title, url: `https://${title}.example/` }
    : { id: String(21 + index), title, children: [] }));
  if (options.firstFolderChildren) items[0].children = options.firstFolderChildren;
  if (options.sourceAsCard) items[0] = { id: '30', title: 'Source folder', children: [{ id: '31', title: 'Inner', children: [] }] };
  return items;
}

async function openNewtab(mode: Mode, sourceType: SourceType, options: Options = {}) {
  const items = barItems(options);
  const newtab: DragPage = await openDragPage({
    unplaced: true,
    sync: { [MODE_KEY]: mode },
    shortcuts: [SOURCES[sourceType]],
    bookmarks: items,
    // A folder shortcut's own folder lives elsewhere unless the case puts it on the bar.
    otherBookmarks: options.sourceAsCard ? [] : [{ id: '30', title: 'Source folder', children: [] }]
  });
  const geometry = GEOMETRY[mode];
  const tiles = () => getElements(document, '.x-nt-shortcut-tile:not(.x-nt-shortcut-tile--add)');
  const cards = () => getElements(getElementById('_x_extension_newtab_bookmarks_grid_2024_unique_'), '.x-nt-bookmark-card');
  const restored = () => cards().length === items.length && tiles().length === 1;
  await waitUntil(restored, 'New Tab should show the bookmarks and the shortcut');

  const layoutPage = () => {
    const grid = getElementById('_x_extension_newtab_bookmarks_grid_2024_unique_');
    const width = Math.max(1, cards().length) * (geometry.width + (geometry.gap || 0)) - (geometry.gap || 0);
    if (mode === 'top') {
      newtab.layout.place(getElementById('_x_extension_newtab_bookmarks_topbar_2026_unique_'), { left: 0, top: 0, width: 900, height: 36 });
      newtab.layout.place(getElementById('_x_extension_newtab_bookmarks_topbar_viewport_2026_unique_'), { left: 100, top: 4, width: 700, height: 28 });
      newtab.layout.place(getElementById('_x_extension_newtab_bookmarks_topbar_items_2026_unique_'), { left: 100, top: 4, width: 700, height: 28 });
    } else {
      newtab.layout.place(getElementById('_x_extension_newtab_bookmarks_2024_unique_'), { left: 80, top: 80, width: 700, height: 100 });
    }
    newtab.layout.place(grid, { left: geometry.left, top: geometry.top, width, height: geometry.height });
    const boxes = newtab.layout.row(cards(), geometry);
    const [tile] = tiles();
    if (tile && tile.parentElement) {
      newtab.layout.place(tile.parentElement, { left: 300, top: 400, width: 400, height: 80 });
      newtab.layout.place(tile, { left: 300, top: 400, width: 64, height: 64 });
    }
    return { boxes, tile, y: geometry.top + geometry.height / 2 };
  };

  return {
    newtab,
    layoutPage,
    // Drags the shortcut to (x, y), reports the bookmarks it created or
    // moved and the shortcuts left, then undoes the drop.
    async dropAt(x: number, y: number) {
      const tile = required(layoutPage().tile, `the shortcut, before dropping at ${x},${y}`);
      const before = newtab.bookmarks.calls.length;
      await newtab.drag(tile, [[320, 300], [x, y]]);
      await newtab.advance(400);
      const calls = newtab.bookmarks.calls.slice(before).filter((call) => call.name === 'create' || call.name === 'move');
      const shortcutsLeft = tiles().length;
      await newtab.undo();
      await waitUntil(restored, `undoing the drop at ${x},${y} should restore the page`);
      newtab.bookmarks.calls.length = 0;
      return {
        moved: calls.map((call) => call.name),
        changes: calls.map((call) => placementOf(call.args[call.name === 'move' ? 1 : 0])),
        shortcutsLeft
      };
    }
  };
}

function expectedPlacement(sourceType: SourceType, parentId: string, index: number) {
  return sourceType === 'folder'
    ? { moved: ['move'], changes: [{ parentId, index }] }
    : { moved: ['create'], changes: [{ parentId, index, title: 'Source website', url: 'https://source.example/' }] };
}

const MODES: Mode[] = ['folder', 'list', 'top'];
const SOURCE_TYPES: SourceType[] = ['website', 'folder'];
const CASES = MODES.flatMap((mode) => SOURCE_TYPES.flatMap((sourceType) => [false, true].map((websites) => ({ mode, sourceType, websites }))));

describe('a shortcut dropped on the bookmarks', () => {
  it.each(CASES)('$mode view, a $sourceType shortcut, over websites $websites: inserts between bookmarks, at the ends and into folders',
    async ({ mode, sourceType, websites }) => {
      const page = await openNewtab(mode, sourceType, { websites });
      const { boxes, y } = page.layoutPage();
      const [first, second, last] = boxes;
      for (const x of [first.right - 2, (first.right + second.left) / 2, second.left + 2]) {
        const result = await page.dropAt(x, y);
        expect({ moved: result.moved, changes: result.changes }, `x=${x}`).toEqual(expectedPlacement(sourceType, '1', 1));
        expect(result.shortcutsLeft).toBe(0);
      }
      for (const [x, index] of [[first.left + 2, 0], [last.right - 2, 3]]) {
        const result = await page.dropAt(x, y);
        expect(result.changes.map((change) => change.index), `x=${x}`).toEqual([index]);
      }
      if (!websites) {
        const result = await page.dropAt(first.left + first.width / 2, y);
        expect(result.changes.map((change) => change.parentId)).toEqual(['21']);
      }
      if (mode === 'top') {
        expect((await page.dropAt(850, y)).changes).toEqual([]);
        expect((await page.dropAt((first.right + second.left) / 2, 40)).changes.map((change) => change.index)).toEqual([1]);
      }
    });

  it.each(MODES.flatMap((mode) => SOURCE_TYPES.map((sourceType) => ({ mode, sourceType }))))(
    '$mode view, a $sourceType shortcut: an empty bar takes it first', async ({ mode, sourceType }) => {
      const page = await openNewtab(mode, sourceType, { empty: true });
      const result = await page.dropAt(150, mode === 'top' ? 18 : 125);
      expect(result.changes.map((change) => [change.parentId, change.index])).toEqual([['1', 0]]);
    });

  it.each(MODES)('%s view: a folder shortcut dropped on its own folder is only removed', async (mode) => {
    const page = await openNewtab(mode, 'folder', { sourceAsCard: true });
    const { boxes, y } = page.layoutPage();
    const result = await page.dropAt(boxes[0].left + boxes[0].width / 2, y);
    expect(result.changes).toEqual([]);
    expect(result.shortcutsLeft).toBe(0);
  });

  // Holding a dragged shortcut over a folder on the bookmarks bar opens the
  // folder's menu, whose rows take the shortcut too.
  it.each(SOURCE_TYPES)('a %s shortcut held over a bar folder drops into the gap between two of its menu rows', async (sourceType) => {
    const page = await openNewtab('top', sourceType, {
      firstFolderChildren: [0, 1, 2].map((index) => ({ id: String(41 + index), title: `row-${index}`, children: [] }))
    });
    const { newtab } = page;
    const { boxes, tile } = page.layoutPage();
    await newtab.drag(required(tile, 'the shortcut'), [[320, 300], [boxes[0].left + boxes[0].width / 2, boxes[0].top + boxes[0].height / 2]], { release: false });
    await waitUntil(() => document.querySelector('.x-nt-bookmark-cascade-level') !== null, 'holding over a folder should open its menu');
    const level = getElements(document, '.x-nt-bookmark-cascade-level')[0];
    const rows = getElements(level, '.x-nt-bookmark-cascade-item');
    expect(rows).toHaveLength(3);
    newtab.layout.place(getElements(document, '.x-nt-bookmark-cascade-menu')[0], { left: 100, top: 40, width: 230, height: 120 });
    newtab.layout.place(level, { left: 100, top: 40, width: 230, height: 120 });
    // Rows stack 36px apart; each item measures by its row.
    const rowBoxes = rows.map((item, index) => {
      const box = { left: 108, top: 48 + index * 36, width: 214, height: 32 };
      newtab.layout.place(item.closest('.x-nt-bookmark-cascade-row') || item, box);
      newtab.layout.place(item, box);
      return item.getBoundingClientRect();
    });
    const gap = [215, (rowBoxes[0].bottom + rowBoxes[1].top) / 2];
    const before = newtab.bookmarks.calls.length;
    newtab.pointer('pointermove', gap[0], gap[1]);
    await newtab.advance(60);
    newtab.pointer('pointermove', gap[0], gap[1]);
    await newtab.advance(60);
    newtab.pointer('pointerup', gap[0], gap[1]);
    await newtab.advance(250);
    const changes = newtab.bookmarks.calls.slice(before).filter((call) => call.name === 'create' || call.name === 'move')
      .map((call) => placementOf(call.args[call.name === 'move' ? 1 : 0]));
    expect(changes.map((change) => [change.parentId, change.index])).toEqual([['21', 1]]);
  });
});
