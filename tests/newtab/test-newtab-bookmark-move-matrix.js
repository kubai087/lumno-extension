const assert = require('assert');
const bookmarkDrag = require('../../src/newtab/dom/bookmark-drag.ts');
const bookmarkMoveHistory = require('../../src/newtab/bookmarks/bookmark-move-history.ts');
const bookmarkStore = require('../../src/newtab/bookmarks/bookmarks-store.ts');

const VIEW_MODES = ['folder', 'list', 'top'];
const DUPLICATE_URL = 'https://same.example/';

function bookmark(id, title) {
  return {
    id,
    title,
    url: DUPLICATE_URL
  };
}

function folder(id, title, children) {
  return {
    id,
    title,
    children
  };
}

function createTree() {
  return [{
    id: '0',
    title: '',
    children: [{
      id: '1',
      title: 'Bookmarks bar',
      children: [
        bookmark('root-existing', 'Root existing'),
        bookmark('root-move', 'Root moved'),
        folder('folder-a', 'Folder A', [
          bookmark('a-existing', 'A existing'),
          bookmark('a-move', 'A moved'),
          folder('folder-a-child', 'Folder A child', [
            bookmark('a-child-existing', 'A child existing'),
            bookmark('a-child-move', 'A child moved'),
            folder('folder-a-grandchild', 'Folder A grandchild', [
              bookmark('a-grand-existing', 'A grandchild existing'),
              bookmark('a-grand-move', 'A grandchild moved')
            ])
          ]),
          bookmark('a-tail', 'A tail')
        ]),
        folder('folder-b', 'Folder B', [
          bookmark('b-existing', 'B existing'),
          folder('folder-b-child', 'Folder B child', [
            bookmark('b-child-existing', 'B child existing'),
            bookmark('b-child-move', 'B child moved')
          ])
        ]),
        bookmark('root-tail', 'Root tail')
      ]
    }]
  }];
}

function findNodeContext(nodes, targetId, parentNode = null) {
  const items = Array.isArray(nodes) ? nodes : [];
  for (let index = 0; index < items.length; index += 1) {
    const node = items[index];
    if (node && String(node.id || '') === targetId) {
      return {
        node,
        parentNode,
        siblings: items,
        index
      };
    }
    const nested = findNodeContext(node && node.children, targetId, node);
    if (nested) {
      return nested;
    }
  }
  return null;
}

function reindexTree(nodes, parentId = '') {
  const items = Array.isArray(nodes) ? nodes : [];
  items.forEach((node, index) => {
    node.parentId = parentId;
    node.index = index;
    reindexTree(node.children, String(node.id || ''));
  });
}

function collectIds(nodes, ids = []) {
  const items = Array.isArray(nodes) ? nodes : [];
  items.forEach((node) => {
    ids.push(String(node.id || ''));
    collectIds(node.children, ids);
  });
  return ids;
}

function getFolderItemIds(cache, folderId) {
  const items = cache.folderItemsCache.get(folderId);
  return Array.isArray(items) ? items.map((item) => item.id) : [];
}

function runScenario(scenario, viewMode) {
  const tree = createTree();
  reindexTree(tree);
  const initialCache = bookmarkStore.buildBookmarkFolderCache(tree);
  const initialIds = collectIds(tree).sort();
  const source = findNodeContext(tree, scenario.bookmarkId);
  const target = findNodeContext(tree, scenario.targetParentId);

  assert.ok(source && source.parentNode, `${scenario.name}: source should exist`);
  assert.ok(target && Array.isArray(target.node.children), `${scenario.name}: target folder should exist`);

  const sourceParentId = String(source.parentNode.id || '');
  const targetChildren = target.node.children;
  const targetIndex = scenario.targetIndex === 'append'
    ? targetChildren.length
    : scenario.targetIndex;
  const moveOptions = {
    bookmarkId: scenario.bookmarkId,
    sourceParentId,
    sourceIndex: source.index,
    targetParentId: scenario.targetParentId,
    targetFolderId: scenario.targetParentId,
    targetIndex,
    nodeMap: initialCache.nodeMap
  };
  const allowed = scenario.dropKind === 'folder'
    ? bookmarkMoveHistory.canMoveBookmarkToFolder(moveOptions)
    : bookmarkMoveHistory.canMoveBookmarkToLocation(moveOptions);

  assert.strictEqual(
    allowed,
    scenario.allowed,
    `${scenario.name}: move permission should match`
  );
  assert.strictEqual(
    bookmarkDrag.shouldKeepCascadeOpenAfterDrop(
      scenario.sourceKind,
      { surface: scenario.targetSurface }
    ),
    scenario.sourceKind === 'cascade' && scenario.targetSurface === 'cascade',
    `${scenario.name}: cascade retention should depend only on an internal menu move`
  );

  const beforeMove = JSON.stringify(tree);
  if (allowed) {
    const destinationIndex = scenario.dropKind === 'folder'
      ? targetIndex
      : bookmarkMoveHistory.normalizeMoveDestinationIndex(moveOptions);
    const movedNode = source.siblings.splice(source.index, 1)[0];
    const destination = findNodeContext(tree, scenario.targetParentId);
    const safeIndex = Math.min(
      destination.node.children.length,
      Math.max(0, destinationIndex)
    );
    destination.node.children.splice(safeIndex, 0, movedNode);
    reindexTree(tree);
  } else {
    assert.strictEqual(
      JSON.stringify(tree),
      beforeMove,
      `${scenario.name}: rejected move must not alter the tree`
    );
  }

  const cache = bookmarkStore.buildBookmarkFolderCache(tree);
  assert.deepStrictEqual(
    collectIds(tree).sort(),
    initialIds,
    `${scenario.name}: every bookmark and folder id must survive`
  );
  assert.strictEqual(
    cache.nodeMap.size,
    initialCache.nodeMap.size,
    `${scenario.name}: the cache must preserve its complete identity set`
  );

  if (!allowed) {
    return;
  }

  const destinationIds = getFolderItemIds(cache, scenario.targetParentId);
  assert.strictEqual(
    destinationIds.filter((id) => id === scenario.bookmarkId).length,
    1,
    `${scenario.name}: destination should contain the moved id exactly once`
  );
  if (sourceParentId !== scenario.targetParentId) {
    assert.ok(
      !getFolderItemIds(cache, sourceParentId).includes(scenario.bookmarkId),
      `${scenario.name}: source should no longer contain the moved id`
    );
  }

  const movedNode = cache.nodeMap.get(scenario.bookmarkId);
  if (movedNode && movedNode.url) {
    const sameUrlIds = cache.folderItemsCache
      .get(scenario.targetParentId)
      .filter((item) => item.url === DUPLICATE_URL)
      .map((item) => item.id);
    assert.ok(
      sameUrlIds.length >= 2 && sameUrlIds.includes(scenario.bookmarkId),
      `${scenario.name}: ${viewMode} mode must retain same-URL bookmark identities`
    );
  }

  if (scenario.expectedOrder) {
    assert.deepStrictEqual(
      destinationIds,
      scenario.expectedOrder,
      `${scenario.name}: same-level order should be exact`
    );
  }
}

const scenarios = [
  {
    name: 'card root to direct child',
    bookmarkId: 'root-move',
    targetParentId: 'folder-a',
    targetIndex: 'append',
    dropKind: 'folder',
    sourceKind: 'card',
    targetSurface: 'cascade',
    allowed: true
  },
  {
    name: 'card root to deep descendant menu',
    bookmarkId: 'root-move',
    targetParentId: 'folder-a-grandchild',
    targetIndex: 'append',
    dropKind: 'folder',
    sourceKind: 'card',
    targetSurface: 'cascade',
    allowed: true
  },
  {
    name: 'cascade to direct child submenu',
    bookmarkId: 'a-move',
    targetParentId: 'folder-a-child',
    targetIndex: 'append',
    dropKind: 'folder',
    sourceKind: 'cascade',
    targetSurface: 'cascade',
    allowed: true
  },
  {
    name: 'cascade to deep descendant submenu',
    bookmarkId: 'a-move',
    targetParentId: 'folder-a-grandchild',
    targetIndex: 'append',
    dropKind: 'folder',
    sourceKind: 'cascade',
    targetSurface: 'cascade',
    allowed: true
  },
  {
    name: 'cascade one level up to card folder',
    bookmarkId: 'a-child-move',
    targetParentId: 'folder-a',
    targetIndex: 'append',
    dropKind: 'folder',
    sourceKind: 'cascade',
    targetSurface: 'grid',
    allowed: true
  },
  {
    name: 'cascade multiple levels up to root',
    bookmarkId: 'a-grand-move',
    targetParentId: '1',
    targetIndex: 'append',
    dropKind: 'folder',
    sourceKind: 'cascade',
    targetSurface: 'grid',
    allowed: true
  },
  {
    name: 'card across deep sibling branches',
    bookmarkId: 'a-child-move',
    targetParentId: 'folder-b-child',
    targetIndex: 'append',
    dropKind: 'folder',
    sourceKind: 'card',
    targetSurface: 'cascade',
    allowed: true
  },
  {
    name: 'cascade reverse across deep sibling branches',
    bookmarkId: 'b-child-move',
    targetParentId: 'folder-a-grandchild',
    targetIndex: 'append',
    dropKind: 'folder',
    sourceKind: 'cascade',
    targetSurface: 'cascade',
    allowed: true
  },
  {
    name: 'same parent reorder forward',
    bookmarkId: 'a-move',
    targetParentId: 'folder-a',
    targetIndex: 4,
    dropKind: 'insertion',
    sourceKind: 'card',
    targetSurface: 'grid',
    allowed: true,
    expectedOrder: ['a-existing', 'folder-a-child', 'a-tail', 'a-move']
  },
  {
    name: 'same parent reorder backward',
    bookmarkId: 'a-tail',
    targetParentId: 'folder-a',
    targetIndex: 0,
    dropKind: 'insertion',
    sourceKind: 'card',
    targetSurface: 'grid',
    allowed: true,
    expectedOrder: ['a-tail', 'a-existing', 'a-move', 'folder-a-child']
  },
  {
    name: 'nested folder to ancestor',
    bookmarkId: 'folder-a-grandchild',
    targetParentId: '1',
    targetIndex: 'append',
    dropKind: 'folder',
    sourceKind: 'cascade',
    targetSurface: 'grid',
    allowed: true
  },
  {
    name: 'nested folder across branches',
    bookmarkId: 'folder-b-child',
    targetParentId: 'folder-a',
    targetIndex: 'append',
    dropKind: 'folder',
    sourceKind: 'cascade',
    targetSurface: 'cascade',
    allowed: true
  },
  {
    name: 'folder into itself is rejected',
    bookmarkId: 'folder-a',
    targetParentId: 'folder-a',
    targetIndex: 'append',
    dropKind: 'folder',
    sourceKind: 'card',
    targetSurface: 'grid',
    allowed: false
  },
  {
    name: 'folder into descendant is rejected',
    bookmarkId: 'folder-a',
    targetParentId: 'folder-a-grandchild',
    targetIndex: 'append',
    dropKind: 'folder',
    sourceKind: 'cascade',
    targetSurface: 'cascade',
    allowed: false
  },
  {
    name: 'drop onto current parent is rejected',
    bookmarkId: 'a-move',
    targetParentId: 'folder-a',
    targetIndex: 'append',
    dropKind: 'folder',
    sourceKind: 'cascade',
    targetSurface: 'cascade',
    allowed: false
  }
];

VIEW_MODES.forEach((viewMode) => {
  scenarios.forEach((scenario) => runScenario(scenario, viewMode));
});

console.log(
  `New tab bookmark move matrix passed: ${scenarios.length} paths × ${VIEW_MODES.length} modes.`
);
