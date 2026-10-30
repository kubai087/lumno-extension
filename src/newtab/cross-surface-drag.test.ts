import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getInsertionGapNeighbors,
  getRowInsertionSlot,
  isBookmarkFolderDropTarget,
  planBookmarkToShortcut,
  planShortcutReorder,
  planShortcutStack,
  prefersReducedMotion,
  setInsertionGap,
  type LayoutRect
} from './cross-surface-drag';
import type { BookmarkNode } from './bookmarks/bookmarks-store';
import type { ShortcutItem } from '../domain/shortcuts/types';
import { createShortcutRecord, isShortcutFolder } from '../domain/shortcuts/normalize';
import { required } from '../../tests/fakes/dom';
import { buildNodeMap, describe as describeFolder, resolveReference } from '../domain/bookmark-folder-reference';
import { folderTree } from '../../tests/fakes/bookmark-folder-tree';

const site = (id: string): ShortcutItem => ({ id, title: id[0].toUpperCase() + id.slice(1), url: `https://${id}.example/`, host: `${id}.example` });

describe('planning a shortcut stack', () => {
  const shortcuts = [site('one'), site('two'), site('three')];
  const sources = [{ snapshot: shortcuts[1], index: 1 }, { snapshot: shortcuts[2], index: 2 }];
  const folder = { snapshot: { id: 'stack', type: 'folder', folderId: '70', title: 'New folder' } satisfies ShortcutItem, index: 1 };
  const stacked = planShortcutStack({ shortcuts, sources, folder, maxShortcuts: 10 }) || [];

  it('replaces the target with the folder entry, and undo brings both sources back', () => {
    expect(stacked.map((item) => item.id)).toEqual(['one', 'stack']);
    expect(planShortcutStack({ shortcuts: stacked, sources, folder, undo: true, maxShortcuts: 10 })?.map((item) => item.id))
      .toEqual(['one', 'two', 'three']);
  });

  it('cannot stack a folder entry that already exists again', () => {
    expect(planShortcutStack({ shortcuts: stacked, sources, folder, maxShortcuts: 10 })).toBeNull();
  });

  it('is blocked by a missing source', () => {
    expect(planShortcutStack({ shortcuts: shortcuts.slice(0, 2), sources, folder, maxShortcuts: 10 })).toBeNull();
  });

  it('never duplicates a website added again later when undone', () => {
    expect(planShortcutStack({ shortcuts: [...stacked, site('two')], sources, folder, undo: true, maxShortcuts: 10 })).toBeNull();
  });
});

function rect(left: number, top: number, width = 60, height = 60): { rect: LayoutRect } {
  return { rect: { left, top, right: left + width, bottom: top + height, width, height, centerX: left + width / 2, centerY: top + height / 2 } };
}

function record(fields: Record<string, unknown>): ShortcutItem {
  return required(createShortcutRecord(fields));
}

describe('reduced motion for drag slides', () => {
  const windowWith = (reduce: boolean) => ({
    matchMedia: (query: string) => ({ matches: reduce && query === '(prefers-reduced-motion: reduce)' })
  });

  it('follows the preference, and moves fully without matchMedia', () => {
    expect(prefersReducedMotion(windowWith(true))).toBe(true);
    expect(prefersReducedMotion(windowWith(false))).toBe(false);
    expect(prefersReducedMotion({})).toBe(false);
  });
});

describe('row insertion slots', () => {
  // Two rows: three tiles on top, two below.
  const tiles = [rect(0, 0), rect(70, 0), rect(140, 0), rect(0, 80), rect(70, 80)];

  it('inserts first in an empty grid', () => {
    expect(getRowInsertionSlot([], 10, 10)).toEqual({ index: 0, anchorIndex: -1, markerPosition: 'before' });
  });

  it('inserts before the tile whose left half is under the pointer', () => {
    expect(getRowInsertionSlot(tiles, 5, 30)).toEqual({ index: 0, anchorIndex: 0, markerPosition: 'before' });
    expect(getRowInsertionSlot(tiles, 110, 30)).toEqual({ index: 2, anchorIndex: 2, markerPosition: 'before' });
  });

  it('inserts after the last tile at the end of a wrapped row, not before the next row', () => {
    expect(getRowInsertionSlot(tiles, 400, 30)).toEqual({ index: 3, anchorIndex: 2, markerPosition: 'after' });
  });

  it('snaps points below the grid to the last row and row gaps to the nearest row', () => {
    expect(getRowInsertionSlot(tiles, 400, 500)).toEqual({ index: 5, anchorIndex: 4, markerPosition: 'after' });
    expect(getRowInsertionSlot(tiles, 50, 70)).toEqual({ index: 1, anchorIndex: 1, markerPosition: 'before' });
  });
});

describe('bookmark folder drop targets', () => {
  const node = (id: string, fields: Partial<BookmarkNode> = {}): BookmarkNode => ({ id, title: id, syncing: false, ...fields });
  const nodeMap = new Map<string, BookmarkNode>([
    ['0', node('0')],
    ['1', node('1', { parentId: '0' })],
    ['work', node('work', { parentId: '1' })],
    ['link', node('link', { parentId: '1', url: 'https://example.com/' })]
  ]);

  it('takes drops on the bookmarks bar and nested folders', () => {
    expect(isBookmarkFolderDropTarget('1', nodeMap)).toBe(true);
    expect(isBookmarkFolderDropTarget('work', nodeMap)).toBe(true);
  });

  it('refuses the tree root, websites, unknown and empty folders', () => {
    expect(['0', 'link', 'missing', ''].map((id) => isBookmarkFolderDropTarget(id, nodeMap))).toEqual([false, false, false, false]);
  });
});

describe('planning a bookmark dropped on the shortcuts', () => {
  const shortcuts = ['a', 'b', 'c', 'd'].map((id) => record({ id, url: `https://${id}.test/` }));
  const added = record({ id: 'new', url: 'https://new.test/' });

  it('inserts a new website at the drop index and names the shortcut it added', () => {
    const plan = required(planBookmarkToShortcut({ shortcuts, record: added, index: 1, maxShortcuts: 60 }));
    expect(plan.shortcuts.map((item) => item.id)).toEqual(['a', 'new', 'b', 'c', 'd']);
    expect(plan.shortcutId).toBe('new');
  });

  it('refuses a new website when the shortcuts are full, or a bookmark with no website', () => {
    expect(planBookmarkToShortcut({ shortcuts, record: added, index: 1, maxShortcuts: 4 })).toBeNull();
    expect(planBookmarkToShortcut({ shortcuts, record: null, index: 0, maxShortcuts: 60 })).toBeNull();
  });

  it('moves the shortcut that has the website already, forward or back, even when full', () => {
    expect(required(planBookmarkToShortcut({ shortcuts, record: record({ id: 'dup', url: 'https://a.test/' }), index: 3, maxShortcuts: 4 }))
      .shortcuts.map((item) => item.id)).toEqual(['b', 'c', 'a', 'd']);
    expect(required(planBookmarkToShortcut({ shortcuts, record: record({ id: 'dup', url: 'https://d.test/' }), index: 0, maxShortcuts: 60 }))
      .shortcuts.map((item) => item.id)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('moves a folder shortcut already there, and adds no new folder to a full dock', () => {
    const folders = [
      record({ id: 'design-entry', type: 'folder', folderId: '42', title: 'Design' }),
      record({ id: 'archive-entry', type: 'folder', folderId: '43', title: 'Archive' })
    ];
    expect(required(planBookmarkToShortcut({
      shortcuts: folders, record: record({ id: 'duplicate', type: 'folder', folderId: '42', title: 'Design' }), index: 2, maxShortcuts: 2
    })).shortcuts.map((item) => item.id)).toEqual(['archive-entry', 'design-entry']);
    expect(planBookmarkToShortcut({
      shortcuts: folders, record: record({ type: 'folder', folderId: '44', title: 'New' }), index: 0, maxShortcuts: 2
    })).toBeNull();
  });

  it('uses the portable folder entry already there when the same folder is dropped again', () => {
    const nodeMap = buildNodeMap(folderTree());
    const entry = record({ id: 'entry-a', type: 'folder', title: '灵感', folderRef: describeFolder('42', nodeMap) });
    const dropped = record({ type: 'folder', folderId: '42', title: '灵感' });
    const folderIdOf = (item: ShortcutItem) => (isShortcutFolder(item) ? item.folderId || resolveReference(item.folderRef, nodeMap)?.id || '' : '');

    const plan = required(planBookmarkToShortcut({ shortcuts: [entry], record: dropped, index: 1, maxShortcuts: 1, getFolderId: folderIdOf }));

    expect(plan.shortcutId).toBe('entry-a');
  });
});

describe('insertion gaps', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('leans apart the two items beside an insertion point', () => {
    const items = ['a', 'b', 'c', 'd'];
    expect(getInsertionGapNeighbors(items, 'b', 'before')).toEqual({ before: 'a', after: 'b' });
    expect(getInsertionGapNeighbors(items, 'b', 'after')).toEqual({ before: 'b', after: 'c' });
    expect(getInsertionGapNeighbors(items, 'a', 'before')).toEqual({ before: null, after: 'a' });
    expect(getInsertionGapNeighbors(items, 'd', 'after')).toEqual({ before: 'd', after: null });
  });

  it('leaves a neighbour that wrapped to the next row, and leans nothing for an anchor outside the list', () => {
    const rowOf: Record<string, number> = { a: 0, b: 0, c: 1, d: 1 };
    const items = ['a', 'b', 'c', 'd'];
    expect(getInsertionGapNeighbors(items, 'b', 'after', (item, anchor) => rowOf[item] === rowOf[anchor])).toEqual({ before: 'b', after: null });
    expect(getInsertionGapNeighbors(items, 'x', 'before')).toEqual({ before: null, after: null });
  });

  it('marks the leaning pair and lets a released neighbour slide back before it rests', () => {
    vi.useFakeTimers();
    const [first, second, third] = [0, 1, 2].map(() => document.createElement('div'));
    const owner = {};
    setInsertionGap(owner, first, second);
    expect([first, second].map((element) => element.getAttribute('data-drag-gap'))).toEqual(['before', 'after']);
    setInsertionGap(owner, second, third);
    expect([first, second, third].map((element) => element.getAttribute('data-drag-gap'))).toEqual(['rest', 'before', 'after']);
    setInsertionGap(owner, null, null);
    expect([second, third].map((element) => element.getAttribute('data-drag-gap'))).toEqual(['rest', 'rest']);
    vi.runAllTimers();
    expect([first, second, third].map((element) => element.getAttribute('data-drag-gap'))).toEqual([null, null, null]);
  });
});

describe('shortcut groups in drag plans', () => {
  const shortcuts = [
    record({ id: 'a', url: 'https://a.example/', groupId: 'g0' }),
    record({ id: 'b', url: 'https://b.example/', groupId: 'work' }),
    record({ id: 'c', url: 'https://c.example/', groupId: 'work' })
  ];

  it('restores each entry\'s group, keeping the entries already in theirs', () => {
    const regrouped = required(planShortcutReorder({ shortcuts, order: ['a', 'b', 'c'], groups: ['work', 'work', 'g0'] }));
    expect(regrouped.map((item) => [item.id, item.groupId])).toEqual([['a', 'work'], ['b', 'work'], ['c', 'g0']]);
    expect(regrouped[1]).toBe(shortcuts[1]);
    expect(required(planShortcutReorder({ shortcuts, order: ['c', 'a', 'b'] })).map((item) => item.groupId)).toEqual(['work', 'g0', 'work']);
  });

  it('puts a dropped bookmark, or a site moved in, into the group it was dropped in', () => {
    const dropped = required(planBookmarkToShortcut({
      shortcuts, record: record({ id: 'new', url: 'https://new.example/' }), index: 1, groupId: 'work', maxShortcuts: 10
    }));
    expect(dropped.shortcuts.map((item) => [item.id, item.groupId])).toEqual([['a', 'g0'], ['new', 'work'], ['b', 'work'], ['c', 'work']]);
    const movedIn = required(planBookmarkToShortcut({
      shortcuts, record: record({ url: 'https://c.example/' }), index: 0, groupId: 'g0', maxShortcuts: 10
    }));
    expect(movedIn.shortcuts[0]).toEqual({ ...shortcuts[2], groupId: 'g0' });
  });

  it('gives a stacked folder the group of the site it was stacked onto', () => {
    const stacked = required(planShortcutStack({
      shortcuts,
      sources: [{ snapshot: shortcuts[1], index: 1 }, { snapshot: shortcuts[0], index: 0 }],
      folder: { snapshot: record({ id: 'folder', type: 'folder', folderId: '70', title: 'New folder' }), index: 0, groupId: 'work' },
      maxShortcuts: 10
    }));
    expect(stacked.map((item) => [item.id, item.groupId])).toEqual([['folder', 'work'], ['c', 'work']]);
  });
});
