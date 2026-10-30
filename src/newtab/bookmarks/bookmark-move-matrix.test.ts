import { describe, expect, it } from 'vitest';
import { canMoveBookmarkToFolder, canMoveBookmarkToLocation, normalizeMoveDestinationIndex } from './bookmark-move-history';
import { buildBookmarkFolderCache, type BookmarkNode } from './bookmarks-store';
import { shouldKeepCascadeOpenAfterDrop } from '../dom/bookmark-drag';
import type { DragDropTarget } from '../cross-surface-drag';
import { required } from '../../../tests/fakes/dom';

// Bookmark moves across a tree three folders deep, from the grid's cards and
// from the cascade menus: which are allowed, that a move keeps every id and
// bookmarks of the same URL apart, and when the source menu stays open.

const DUPLICATE_URL = 'https://same.example/';

interface Tree {
  id: string;
  title: string;
  url?: string;
  children?: Tree[];
}

const bookmark = (id: string): Tree => ({ id, title: id, url: DUPLICATE_URL });
const folder = (id: string, children: Tree[]): Tree => ({ id, title: id, children });

function createTree(): BookmarkNode[] {
  const bar = folder('1', [
    bookmark('root-existing'),
    bookmark('root-move'),
    folder('folder-a', [
      bookmark('a-existing'),
      bookmark('a-move'),
      folder('folder-a-child', [
        bookmark('a-child-existing'),
        bookmark('a-child-move'),
        folder('folder-a-grandchild', [bookmark('a-grand-existing'), bookmark('a-grand-move')])
      ]),
      bookmark('a-tail')
    ]),
    folder('folder-b', [
      bookmark('b-existing'),
      folder('folder-b-child', [bookmark('b-child-existing'), bookmark('b-child-move')])
    ]),
    bookmark('root-tail')
  ]);
  const adopt = (item: Tree, parentId: string, index: number): BookmarkNode => ({
    id: item.id, title: item.title, parentId, index, syncing: false,
    ...(item.url ? { url: item.url } : {}),
    ...(item.children ? { children: item.children.map((child, childIndex) => adopt(child, item.id, childIndex)) } : {})
  });
  return [{ id: '0', title: '', syncing: false, children: [adopt(bar, '0', 0)] }];
}

interface Found {
  node: BookmarkNode;
  parent: BookmarkNode | null;
  index: number;
}

function findNode(nodes: readonly BookmarkNode[], id: string, parent: BookmarkNode | null = null): Found | null {
  for (let index = 0; index < nodes.length; index += 1) {
    if (nodes[index].id === id) return { node: nodes[index], parent, index };
    const nested = findNode(nodes[index].children || [], id, nodes[index]);
    if (nested) return nested;
  }
  return null;
}

function reindex(nodes: BookmarkNode[], parentId = ''): void {
  nodes.forEach((node, index) => {
    node.parentId = parentId;
    node.index = index;
    reindex(node.children || [], node.id);
  });
}

const allIds = (nodes: readonly BookmarkNode[]): string[] =>
  nodes.flatMap((node) => [node.id, ...allIds(node.children || [])]);

function surface(name: 'cascade' | 'grid'): DragDropTarget {
  return name === 'cascade'
    ? { kind: 'insertion', surface: 'cascade', folderId: '1', title: '', element: null, markerElement: null, markerPosition: '' }
    : { kind: 'blocked', surface: 'grid' };
}

interface Scenario {
  name: string;
  bookmarkId: string;
  targetParentId: string;
  targetIndex: number | 'append';
  dropKind: 'folder' | 'insertion';
  sourceKind: 'card' | 'cascade';
  targetSurface: 'cascade' | 'grid';
  allowed: boolean;
  expectedOrder?: string[];
}

const scenarios: Scenario[] = [
  { name: 'a card from the root to a direct child', bookmarkId: 'root-move', targetParentId: 'folder-a', targetIndex: 'append', dropKind: 'folder', sourceKind: 'card', targetSurface: 'cascade', allowed: true },
  { name: 'a card from the root to a deep descendant menu', bookmarkId: 'root-move', targetParentId: 'folder-a-grandchild', targetIndex: 'append', dropKind: 'folder', sourceKind: 'card', targetSurface: 'cascade', allowed: true },
  { name: 'a menu row to a direct child submenu', bookmarkId: 'a-move', targetParentId: 'folder-a-child', targetIndex: 'append', dropKind: 'folder', sourceKind: 'cascade', targetSurface: 'cascade', allowed: true },
  { name: 'a menu row to a deep descendant submenu', bookmarkId: 'a-move', targetParentId: 'folder-a-grandchild', targetIndex: 'append', dropKind: 'folder', sourceKind: 'cascade', targetSurface: 'cascade', allowed: true },
  { name: 'a menu row one level up to a card folder', bookmarkId: 'a-child-move', targetParentId: 'folder-a', targetIndex: 'append', dropKind: 'folder', sourceKind: 'cascade', targetSurface: 'grid', allowed: true },
  { name: 'a menu row several levels up to the root', bookmarkId: 'a-grand-move', targetParentId: '1', targetIndex: 'append', dropKind: 'folder', sourceKind: 'cascade', targetSurface: 'grid', allowed: true },
  { name: 'a card across deep sibling branches', bookmarkId: 'a-child-move', targetParentId: 'folder-b-child', targetIndex: 'append', dropKind: 'folder', sourceKind: 'card', targetSurface: 'cascade', allowed: true },
  { name: 'a menu row back across deep sibling branches', bookmarkId: 'b-child-move', targetParentId: 'folder-a-grandchild', targetIndex: 'append', dropKind: 'folder', sourceKind: 'cascade', targetSurface: 'cascade', allowed: true },
  { name: 'a reorder forward in the same folder', bookmarkId: 'a-move', targetParentId: 'folder-a', targetIndex: 4, dropKind: 'insertion', sourceKind: 'card', targetSurface: 'grid', allowed: true, expectedOrder: ['a-existing', 'folder-a-child', 'a-tail', 'a-move'] },
  { name: 'a reorder backward in the same folder', bookmarkId: 'a-tail', targetParentId: 'folder-a', targetIndex: 0, dropKind: 'insertion', sourceKind: 'card', targetSurface: 'grid', allowed: true, expectedOrder: ['a-tail', 'a-existing', 'a-move', 'folder-a-child'] },
  { name: 'a nested folder to an ancestor', bookmarkId: 'folder-a-grandchild', targetParentId: '1', targetIndex: 'append', dropKind: 'folder', sourceKind: 'cascade', targetSurface: 'grid', allowed: true },
  { name: 'a nested folder across branches', bookmarkId: 'folder-b-child', targetParentId: 'folder-a', targetIndex: 'append', dropKind: 'folder', sourceKind: 'cascade', targetSurface: 'cascade', allowed: true },
  { name: 'a folder into itself', bookmarkId: 'folder-a', targetParentId: 'folder-a', targetIndex: 'append', dropKind: 'folder', sourceKind: 'card', targetSurface: 'grid', allowed: false },
  { name: 'a folder into its descendant', bookmarkId: 'folder-a', targetParentId: 'folder-a-grandchild', targetIndex: 'append', dropKind: 'folder', sourceKind: 'cascade', targetSurface: 'cascade', allowed: false },
  { name: 'a drop onto the current parent', bookmarkId: 'a-move', targetParentId: 'folder-a', targetIndex: 'append', dropKind: 'folder', sourceKind: 'cascade', targetSurface: 'cascade', allowed: false }
];

describe('bookmark moves across the tree', () => {
  it.each(scenarios)('$name: allowed $allowed, keeping every id', (scenario) => {
    const tree = createTree();
    const initial = buildBookmarkFolderCache(tree);
    const source = required(findNode(tree, scenario.bookmarkId), 'the source');
    const sourceParent = required(source.parent, 'the source folder');
    const target = required(findNode(tree, scenario.targetParentId), 'the target');
    const targetChildren = required(target.node.children, 'the target folder');
    const targetIndex = scenario.targetIndex === 'append' ? targetChildren.length : scenario.targetIndex;
    const moveOptions = {
      bookmarkId: scenario.bookmarkId,
      sourceParentId: sourceParent.id,
      sourceIndex: source.index,
      targetParentId: scenario.targetParentId,
      targetFolderId: scenario.targetParentId,
      targetIndex,
      nodeMap: initial.nodeMap
    };
    const allowed = scenario.dropKind === 'folder' ? canMoveBookmarkToFolder(moveOptions) : canMoveBookmarkToLocation(moveOptions);
    expect(allowed).toBe(scenario.allowed);
    expect(shouldKeepCascadeOpenAfterDrop(scenario.sourceKind, surface(scenario.targetSurface)))
      .toBe(scenario.sourceKind === 'cascade' && scenario.targetSurface === 'cascade');

    const before = JSON.stringify(tree);
    if (allowed) {
      const destinationIndex = scenario.dropKind === 'folder' ? targetIndex : normalizeMoveDestinationIndex(moveOptions);
      const [moved] = required(sourceParent.children).splice(source.index, 1);
      const destination = required(required(findNode(tree, scenario.targetParentId)).node.children);
      destination.splice(Math.min(destination.length, Math.max(0, destinationIndex)), 0, moved);
      reindex(tree);
    } else {
      expect(JSON.stringify(tree)).toBe(before);
    }

    const cache = buildBookmarkFolderCache(tree);
    expect(allIds(tree).sort()).toEqual(allIds(createTree()).sort());
    expect(cache.nodeMap.size).toBe(initial.nodeMap.size);
    if (!allowed) return;
    const idsIn = (folderId: string) => (cache.folderItemsCache.get(folderId) || []).map((item) => item.id);
    expect(idsIn(scenario.targetParentId).filter((id) => id === scenario.bookmarkId)).toHaveLength(1);
    if (sourceParent.id !== scenario.targetParentId) {
      expect(idsIn(sourceParent.id)).not.toContain(scenario.bookmarkId);
    }
    if (required(cache.nodeMap.get(scenario.bookmarkId)).url) {
      const sameUrl = (cache.folderItemsCache.get(scenario.targetParentId) || [])
        .filter((item) => item.url === DUPLICATE_URL).map((item) => item.id);
      expect(sameUrl.length).toBeGreaterThanOrEqual(2);
      expect(sameUrl).toContain(scenario.bookmarkId);
    }
    if (scenario.expectedOrder) {
      expect(idsIn(scenario.targetParentId)).toEqual(scenario.expectedOrder);
    }
  });
});
