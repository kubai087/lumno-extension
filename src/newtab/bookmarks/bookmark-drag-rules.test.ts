import { describe, expect, it } from 'vitest';
import {
  getMoveDestination,
  getUndoShortcutLabels,
  isExternalBookmarkDropAllowed,
  isMacContextClick,
  normalizeAnimationRect
} from './bookmark-drag-rules';
import type { DragDropTarget } from '../cross-surface-drag';
import type { BookmarkItem, BookmarkNode } from './bookmarks-store';

function item(id: string, parentId: string, index: number): BookmarkItem {
  return { id, parentId, index, title: id, url: '', host: '', themeUrl: '', type: 'bookmark' };
}

function node(id: string, fields: Partial<BookmarkNode> = {}): BookmarkNode {
  return { id, title: id, syncing: false, ...fields };
}

const nodeMap = new Map<string, BookmarkNode>([
  ['0', node('0', { children: [] })],
  ['1', node('1', { parentId: '0', children: [] })],
  ['managed', node('managed', { parentId: '0', unmodifiable: 'managed', children: [] })],
  ['folder', node('folder', { parentId: '1', children: [] })],
  ['inner', node('inner', { parentId: 'folder', children: [] })],
  ['site', node('site', { parentId: '1', url: 'https://example.com/' })]
]);

function card(folderId: string): DragDropTarget {
  const element = document.createElement('div');
  return { kind: 'card', surface: 'folder', folderId, title: '', element };
}

const back: DragDropTarget = { kind: 'return', surface: 'folder', bookmarkId: 'folder', folderId: '1', element: null, title: '' };

describe('bookmark drag rules', () => {
  it('keeps finite animation boxes, filling in their right and bottom edges', () => {
    expect(normalizeAnimationRect(null)).toBeNull();
    expect(normalizeAnimationRect({ left: 1, top: 2, width: NaN, height: 4 })).toBeNull();
    expect(normalizeAnimationRect({ left: 10, top: 20, width: 30, height: 40 }))
      .toEqual({ left: 10, top: 20, right: 40, bottom: 60, width: 30, height: 40 });
    expect(normalizeAnimationRect({ left: 10, top: 20, width: 30, height: 40, right: 41, bottom: 61 }))
      .toEqual({ left: 10, top: 20, right: 41, bottom: 61, width: 30, height: 40 });
  });

  it('lands a reordered bookmark in the slot of the bookmark after it', () => {
    const items = [item('a', '1', 0), item('moved', '1', 4), item('b', '1', 1), item('c', '1', 2)];
    expect(getMoveDestination(items, 'moved', '1')).toEqual({ parentId: '1', index: 1 });
  });

  it('lands a bookmark moved to the end after the bookmark before it', () => {
    expect(getMoveDestination([item('a', '1', 0), item('b', '1', 1), item('moved', '1', 0)], 'moved', '1'))
      .toEqual({ parentId: '1', index: 2 });
  });

  it('puts a bookmark alone in its folder first', () => {
    expect(getMoveDestination([item('moved', '1', 3)], 'moved', '1')).toEqual({ parentId: '1', index: 0 });
  });

  it('skips the bookmarks of other folders', () => {
    expect(getMoveDestination([item('moved', '7', 3), item('other', '8', 5), item('next', '7', 2)], 'moved', '1'))
      .toEqual({ parentId: '7', index: 2 });
  });

  it('counts items without a parent as the folder shown', () => {
    expect(getMoveDestination([item('moved', '', 0), item('b', '', 4)], 'moved', '9')).toEqual({ parentId: '9', index: 4 });
  });

  it('has no destination for a missing bookmark or without a folder', () => {
    expect(getMoveDestination([item('a', '1', 0)], 'missing', '1')).toBeNull();
    expect(getMoveDestination([item('moved', '', 0)], 'moved', '')).toBeNull();
  });

  it('takes drops from other surfaces on a folder that can change', () => {
    expect(isExternalBookmarkDropAllowed(null, card('1'), nodeMap)).toBe(true);
    expect(isExternalBookmarkDropAllowed(null, null, nodeMap)).toBe(false);
    expect(isExternalBookmarkDropAllowed(null, { kind: 'blocked', surface: 'folder' }, nodeMap)).toBe(false);
    expect(isExternalBookmarkDropAllowed(null, card('managed'), nodeMap)).toBe(false);
    expect(isExternalBookmarkDropAllowed(null, card('site'), nodeMap)).toBe(false);
  });

  it('never drops a folder inside itself', () => {
    expect(isExternalBookmarkDropAllowed({ bookmarkId: 'folder' }, card('inner'), nodeMap)).toBe(false);
    expect(isExternalBookmarkDropAllowed({ bookmarkId: 'folder' }, card('1'), nodeMap)).toBe(true);
  });

  it('returns only a folder shortcut, and only to the folder its bookmark sits in', () => {
    expect(isExternalBookmarkDropAllowed({ bookmarkId: 'folder', shortcutId: 's1' }, back, nodeMap)).toBe(true);
    expect(isExternalBookmarkDropAllowed({ bookmarkId: 'folder' }, back, nodeMap)).toBe(false);
    expect(isExternalBookmarkDropAllowed({ bookmarkId: 'folder', shortcutId: 's1' }, { ...back, folderId: '0' }, nodeMap)).toBe(false);
  });

  it('names the undo keys of the platform', () => {
    expect(getUndoShortcutLabels({ platform: 'MacIntel' })).toEqual({ undo: '⌘Z', redo: '⇧⌘Z' });
    expect(getUndoShortcutLabels({ platform: 'Win32' })).toEqual({ undo: 'Ctrl+Z', redo: 'Ctrl+Shift+Z' });
    expect(getUndoShortcutLabels({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0)' })).toEqual({ undo: '⌘Z', redo: '⇧⌘Z' });
  });

  it('reads a Control-click as a right-click on macOS only', () => {
    expect(isMacContextClick({ ctrlKey: true }, { platform: 'MacIntel' })).toBe(true);
    expect(isMacContextClick({ ctrlKey: false }, { platform: 'MacIntel' })).toBe(false);
    expect(isMacContextClick({ ctrlKey: true }, { platform: 'Win32' })).toBe(false);
  });
});
