import { describe, expect, it } from 'vitest';
import {
  canMoveBookmarkToFolder,
  canMoveBookmarkToLocation,
  cloneBookmarkSnapshot,
  createBookmarkMoveHistory,
  createDeleteRecord,
  createMoveRecord,
  createShortcutGroupDeleteRecord,
  createShortcutReorderRecord,
  createShortcutStackRecord,
  getMoveApiDestinationIndex,
  isFolderInsideBookmark,
  normalizeMoveDestinationIndex
} from './bookmark-move-history';
import type { BookmarkNode } from './bookmarks-store';
import { createShortcutRecord } from '../../domain/shortcuts/normalize';
import { required } from '../../../tests/fakes/dom';

function node(id: string, parentId: string): BookmarkNode {
  return { id, parentId, title: id, syncing: false };
}

const nodeMap = new Map<string, BookmarkNode>([
  ['1', node('1', '0')],
  ['design', node('design', '1')],
  ['research', node('research', 'design')],
  ['archive', node('archive', '1')],
  ['link', node('link', 'design')]
]);

describe('moving a bookmark into a folder', () => {
  it('knows a nested folder lies inside the folder dragged', () => {
    expect(isFolderInsideBookmark(nodeMap, 'design', 'research')).toBe(true);
  });

  it('never moves a folder into one of its descendants', () => {
    expect(canMoveBookmarkToFolder({ bookmarkId: 'design', sourceParentId: '1', targetFolderId: 'research', nodeMap })).toBe(false);
  });

  it('does nothing for a drop on the current parent', () => {
    expect(canMoveBookmarkToFolder({ bookmarkId: 'link', sourceParentId: 'design', targetFolderId: 'design', nodeMap })).toBe(false);
  });

  it('moves a bookmark to another folder or up into an ancestor', () => {
    expect(canMoveBookmarkToFolder({ bookmarkId: 'link', sourceParentId: 'design', targetFolderId: 'archive', nodeMap })).toBe(true);
    expect(canMoveBookmarkToFolder({ bookmarkId: 'link', sourceParentId: 'research', targetFolderId: 'design', nodeMap })).toBe(true);
  });
});

describe('insertion indexes within one folder', () => {
  const within = (sourceIndex: number, targetIndex: number) =>
    ({ sourceParentId: 'design', sourceIndex, targetParentId: 'design', targetIndex });

  it('counts the removal of the moved bookmark when it moves forward', () => {
    expect(normalizeMoveDestinationIndex(within(1, 4))).toBe(3);
    const items = ['1', '2', '3', '4'];
    const [moved] = items.splice(0, 1);
    items.splice(normalizeMoveDestinationIndex(within(0, 3)), 0, moved);
    expect(items).toEqual(['2', '3', '1', '4']);
  });

  it('hands Chrome the boundary before the removal when moving forward', () => {
    expect(getMoveApiDestinationIndex(within(0, 2))).toBe(3);
    expect(getMoveApiDestinationIndex(within(1, 8))).toBe(9);
    expect(getMoveApiDestinationIndex(within(1, 9))).toBe(10);
    expect(getMoveApiDestinationIndex(within(1, 15))).toBe(16);
  });

  it('allows a reorder only when the final index changes', () => {
    expect(canMoveBookmarkToLocation({ bookmarkId: 'link', ...within(1, 0), nodeMap })).toBe(true);
    expect(canMoveBookmarkToLocation({ bookmarkId: 'link', ...within(1, 2), nodeMap })).toBe(false);
  });
});

describe('bookmark move history', () => {
  it('undoes and redoes a move', () => {
    const history = createBookmarkMoveHistory({ maxEntries: 2 });
    const move = createMoveRecord({ bookmarkId: 'link', title: 'Lumno', from: { parentId: 'design', index: 1 }, to: { parentId: 'archive', index: 0 } });
    expect(history.push(move)).toBe(true);
    expect(history.peekUndo()).toEqual(move);
    expect(history.peekRedo()).toBeNull();
    expect(history.commitUndo()).toEqual(move);
    expect(history.peekRedo()).toEqual(move);
    expect(history.commitRedo()).toEqual(move);
    expect(history.peekUndo()).toEqual(move);
  });

  it('keeps a frozen snapshot of a deleted folder and everything in it', () => {
    const snapshot = required(cloneBookmarkSnapshot({
      title: 'Folder A',
      children: [
        { title: 'Link A', url: 'https://example.com/a' },
        { title: 'Folder B', children: [{ title: 'Link B', url: 'https://example.com/b' }] }
      ]
    }));
    expect(snapshot).toEqual({
      title: 'Folder A',
      url: '',
      children: [
        { title: 'Link A', url: 'https://example.com/a', children: [] },
        { title: 'Folder B', url: '', children: [{ title: 'Link B', url: 'https://example.com/b', children: [] }] }
      ]
    });
    expect(Object.isFrozen(snapshot) && Object.isFrozen(snapshot.children)).toBe(true);
  });

  it('records where a deleted bookmark was and follows the id undo gives it', () => {
    const record = required(createDeleteRecord({
      bookmarkId: 'folder-a',
      title: 'Folder A',
      parentId: '1',
      index: 3,
      snapshot: { title: 'Folder A', children: [] }
    }));
    expect([record.kind, record.parentId, record.index, record.runtime.currentBookmarkId]).toEqual(['delete', '1', 3, '']);
    const history = createBookmarkMoveHistory({ maxEntries: 4 });
    expect(history.push(record)).toBe(true);
    const stored = required(history.peekUndo());
    if (stored.kind !== 'delete') throw new Error('Expected the delete record.');
    stored.runtime.currentBookmarkId = 'restored-folder-a';
    const undone = required(history.commitUndo());
    const redo = required(history.peekRedo());
    expect([undone, redo].map((entry) => (entry.kind === 'delete' ? entry.runtime.currentBookmarkId : ''))).toEqual(['restored-folder-a', 'restored-folder-a']);
  });

  it('maps the ids undo recreates bookmarks under, and forgets them with the trimmed records', () => {
    const history = createBookmarkMoveHistory({ maxEntries: 2 });
    for (let index = 0; index < 8; index += 1) {
      history.push(createMoveRecord({ bookmarkId: `old-${index}`, from: { parentId: '1', index: 0 }, to: { parentId: '2', index: 0 } }));
      history.remapBookmarkId(`old-${index}`, `restored-${index}`);
      history.remapBookmarkId(`old-${index}`, `restored-again-${index}`);
    }
    expect(history.resolveBookmarkId('old-7')).toBe('restored-again-7');
    expect(history.resolveBookmarkId('old-6')).toBe('restored-again-6');
    expect(history.resolveBookmarkId('old-5')).toBe('old-5');
    history.clear();
    expect(history.resolveBookmarkId('old-7')).toBe('old-7');
  });
});

describe('shortcut history records', () => {
  const shortcuts = [
    required(createShortcutRecord({ id: 'a', url: 'https://a.example/', groupId: 'g0' })),
    required(createShortcutRecord({ id: 'b', url: 'https://b.example/', groupId: 'work' }))
  ];

  it('records a move that only changes the group', () => {
    const groupOnly = required(createShortcutReorderRecord({
      fromOrder: ['a', 'b'], toOrder: ['a', 'b'], fromGroups: ['g0', 'work'], toGroups: ['work', 'work']
    }));
    expect([groupOnly.fromGroups, groupOnly.toGroups]).toEqual([['g0', 'work'], ['work', 'work']]);
  });

  it('records nothing when nothing moved, and no groups for a plain reorder', () => {
    expect(createShortcutReorderRecord({
      fromOrder: ['a', 'b'], toOrder: ['a', 'b'], fromGroups: ['g0', 'work'], toGroups: ['g0', 'work']
    })).toBeNull();
    expect(required(createShortcutReorderRecord({ fromOrder: ['a', 'b'], toOrder: ['b', 'a'] })).fromGroups).toBeUndefined();
  });

  it('keeps the group a stacked folder took', () => {
    const record = required(createShortcutStackRecord({
      snapshot: { title: 'New folder', children: [{ title: 'A', url: 'https://a.example/' }, { title: 'B', url: 'https://b.example/' }] },
      sources: [{ snapshot: shortcuts[1], index: 1 }, { snapshot: shortcuts[0], index: 0 }],
      folderShortcut: { id: 'folder', index: 0, groupId: 'work' }
    }));
    expect(record.folderShortcut.groupId).toBe('work');
  });

  it('keeps the sites a deleted group removed, and needs each one whole', () => {
    const groupDelete = required(createShortcutGroupDeleteRecord({
      group: { id: 'work', title: '工作' }, groupIndex: 1, targetGroupId: '', movedIds: [],
      removed: [{ snapshot: shortcuts[1], index: 1, iconDataUrl: 'data:image/png;base64,AA==' }]
    }));
    expect(groupDelete.kind).toBe('shortcut-group-delete');
    expect(groupDelete.removed[0].snapshot).toEqual(shortcuts[1]);
    expect(createShortcutGroupDeleteRecord({ group: { title: 'No id' } })).toBeNull();
    expect(createShortcutGroupDeleteRecord({ group: { id: 'x' }, removed: [{}] })).toBeNull();
  });
});
