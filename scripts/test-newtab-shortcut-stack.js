const assert = require('assert');
const vm = require('vm');
const historyApi = require('../src/newtab/bookmark-move-history');
const dragApi = require('../src/newtab/cross-surface-drag');
const store = require('../src/newtab/shortcuts-store');
const references = require('../src/shared/bookmark-folder-reference');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

const source = readNewtabRuntimeSource();
function extractFunction(name) {
  let start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `Missing ${name}`);
  const body = source.indexOf('{', start);
  if (source.slice(start - 6, start) === 'async ') start -= 6;
  let depth = 0;
  for (let index = body; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unterminated ${name}`);
}
const json = (value) => JSON.parse(JSON.stringify(value));
const settle = () => new Promise((resolve) => setImmediate(resolve));

const site = (id) => ({ id, title: id[0].toUpperCase() + id.slice(1), url: `https://${id}.example/` });

function createRuntime() {
  const nodes = new Map();
  let created = 0;
  const context = vm.createContext({
    newtabShortcuts: store.normalizeShortcuts([site('one'), site('two'), site('three')], { now: 456 }),
    newtabShortcutIcons: { two: 'data:image/png;base64,two' },
    bookmarkMoveHistory: historyApi.createBookmarkMoveHistory(),
    bookmarkMoveHistoryBusy: false,
    NEWTAB_BOOKMARK_MOVE_HISTORY: historyApi,
    NEWTAB_CROSS_SURFACE_DRAG: dragApi,
    FOLDER_REFERENCES: references,
    MAX_NEWTAB_SHORTCUTS: 10,
    bookmarkCascadeRuntime: null,
    bookmarkPendingLayoutAnimation: null,
    calls: [], toasts: [], bindings: new Map(), settled: [], folderIcons: {},
    getFolderItemIconForShortcut(shortcut, iconDataUrl) {
      if (iconDataUrl) return { iconSource: 'custom', dataUrl: iconDataUrl };
      return shortcut.id === 'three' ? { iconSource: 'builtin' } : null;
    },
    updateFolderItemIcons(changes) {
      Object.entries(changes).forEach(([id, entry]) => {
        if (entry) context.folderIcons[id] = entry; else delete context.folderIcons[id];
      });
      return Promise.resolve(context.folderIcons);
    },
    failSave: 0, failCreate: 0, failRemove: 0,
    getShortcutById(id) { return context.newtabShortcuts.find((item) => item.id === id) || null; },
    shortcutFolderRuntime: {
      ready: Promise.resolve(),
      bind(id, folderId) { context.bindings.set(id, folderId); },
      flush: () => Promise.resolve(),
      reconcile: (items) => items
    },
    isShortcutDragActive: () => false,
    persistShortcuts(items, message, iconChange) {
      context.calls.push({ kind: 'save', ids: items.map((item) => item.id) });
      if (context.failSave > 0) {
        context.failSave -= 1;
        return Promise.resolve(false);
      }
      context.newtabShortcuts = store.normalizeShortcuts(items, { now: 456 });
      const ids = new Set(items.map((item) => item.id));
      context.newtabShortcutIcons = Object.fromEntries(Object.entries(context.newtabShortcutIcons)
        .filter(([id]) => ids.has(id)));
      [].concat(iconChange || []).forEach((change) => {
        context.newtabShortcutIcons[change.shortcutId] = change.dataUrl;
      });
      return Promise.resolve(true);
    },
    showToast(message, isError) { context.toasts.push({ message, isError: Boolean(isError) }); },
    t: (_key, fallback) => fallback,
    formatMessage: (_key, fallback, values) => fallback.replace('{shortcut}', values.shortcut),
    getBookmarkUndoShortcutLabel: () => 'Ctrl+Z',
    getBookmarkRedoShortcutLabel: () => 'Ctrl+Shift+Z',
    queueBookmarkLayoutAnimation() {}, markBookmarkTreeDirty() {}, loadBookmarks() {},
    refreshOpenBookmarkCascadeMenu() {}, renderShortcuts() {}, scheduleWallpaperAdaptiveToneUpdate() {},
    settleShortcutDragTile(tile) { context.settled.push(tile); },
    persistShortcutOrder: () => Promise.resolve(true),
    console: { warn() {} }
  });
  function reindex(parentId) {
    nodes.get(parentId).children.forEach((node, index) => { node.index = index; node.parentId = parentId; });
  }
  function add(node) {
    const item = { title: '', ...node, ...(!node.url ? { children: [] } : {}) };
    nodes.set(item.id, item);
    if (item.parentId) {
      const children = nodes.get(item.parentId).children;
      children.splice(Math.min(item.index ?? children.length, children.length), 0, item);
      reindex(item.parentId);
    }
    return item;
  }
  function removeTree(node) {
    (node.children || []).forEach(removeTree);
    nodes.delete(node.id);
  }
  add({ id: '0' });
  add({ id: '1', parentId: '0', title: 'Bookmarks bar' });
  add({ id: '2', parentId: '0', title: 'Other bookmarks' });
  add({ id: 'existing', parentId: '1', title: 'Existing', url: 'https://existing.example/' });
  context.bookmarksRuntime = {
    getNodeMap: () => nodes,
    getNode: (id) => nodes.has(String(id)) ? json(nodes.get(String(id))) : null,
    getRootFolderId: () => '1',
    ensureReady: () => Promise.resolve(true),
    runControlledMutation: (operation) => Promise.resolve().then(operation),
    create(details) {
      context.calls.push({ kind: 'create', ...details });
      if (context.failCreate > 0) { context.failCreate -= 1; return Promise.reject(new Error('create failed')); }
      return Promise.resolve(json(add({ ...details, id: `created-${++created}` })));
    },
    remove(id, options) {
      context.calls.push({ kind: 'remove', id, recursive: Boolean(options && options.recursive) });
      if (context.failRemove > 0) { context.failRemove -= 1; return Promise.reject(new Error('remove failed')); }
      const node = nodes.get(String(id));
      assert.ok(node, `Cannot remove missing ${id}`);
      assert.ok(node.url || (options && options.recursive), 'folders are removed as a tree');
      nodes.get(node.parentId).children.splice(node.index, 1);
      reindex(node.parentId);
      removeTree(node);
      return Promise.resolve(true);
    }
  };
  context.getShortcutFolderId = (item) => item && (item.folderId || context.bindings.get(item.id)) || '';
  vm.runInContext(['refreshShortcutFolderReferences', 'applyShortcutStack', 'stackShortcuts',
    'performBookmarkMoveHistoryAction'].map(extractFunction).join('\n'), context);
  context.nodes = nodes;
  context.bar = () => nodes.get('1').children.map((node) => node.title);
  context.folder = () => nodes.get('1').children.find((node) => !node.url) || null;
  context.stack = (sourceId, targetId, state = {}) => context.stackShortcuts({
    shortcutId: sourceId, tile: { id: sourceId }, originalShortcuts: context.newtabShortcuts.slice(), ...state
  }, { kind: 'shortcut-stack', shortcutId: targetId });
  context.action = async (direction) => {
    assert.strictEqual(context.performBookmarkMoveHistoryAction(direction), true);
    await settle();
    assert.strictEqual(context.bookmarkMoveHistoryBusy, false);
  };
  return context;
}

function createTargetRuntime(sourceType) {
  const tiles = [
    { id: 'one', left: 0 },
    { id: 'two', left: 60 },
    { id: 'folder', left: 120, folder: true }
  ].map((tile) => ({
    ...tile,
    hasAttribute: (name) => name === 'data-bookmark-drop-folder-id' && Boolean(tile.folder)
  }));
  const shortcuts = [
    sourceType === 'folder' ? { id: 'one', type: 'folder', folderId: 'f1' } : site('one'),
    site('two'),
    { id: 'folder', type: 'folder', folderId: 'f2' }
  ];
  const context = vm.createContext({
    getShortcutById: (id) => shortcuts.find((item) => item.id === id) || null,
    getShortcutReorderTiles: () => tiles,
    getShortcutTileId: (tile) => tile.id,
    getShortcutTileLayoutRect: (tile) => ({ left: tile.left, right: tile.left + 48, top: 0, bottom: 48, width: 48, height: 48 }),
    isPointOverShortcutDropSurface: () => true
  });
  vm.runInContext(extractFunction('getShortcutStackTargetAt'), context);
  return { context, state: { shortcutId: 'one', tile: tiles[0] } };
}

(async () => {
  // Pure planning: stacking replaces the target, undo restores both sources.
  const shortcuts = [site('one'), site('two'), site('three')];
  const sources = [{ snapshot: shortcuts[1], index: 1 }, { snapshot: shortcuts[2], index: 2 }];
  const folder = { snapshot: { id: 'stack', type: 'folder' }, index: 1 };
  const stacked = dragApi.planShortcutStack({ shortcuts, sources, folder, maxShortcuts: 10 });
  assert.deepStrictEqual(stacked.map((item) => item.id), ['one', 'stack']);
  assert.deepStrictEqual(dragApi.planShortcutStack({ shortcuts: stacked, sources, folder, undo: true, maxShortcuts: 10 })
    .map((item) => item.id), ['one', 'two', 'three']);
  assert.strictEqual(dragApi.planShortcutStack({ shortcuts: stacked, sources, folder, maxShortcuts: 10 }), null,
    'a folder entry that already exists cannot be stacked again');
  assert.strictEqual(dragApi.planShortcutStack({ shortcuts: shortcuts.slice(0, 2), sources, folder, maxShortcuts: 10 }), null,
    'a missing source blocks the stack');
  assert.strictEqual(dragApi.planShortcutStack({ shortcuts: [...stacked, site('two')], sources, folder, undo: true, maxShortcuts: 10 }), null,
    'undo never duplicates a website added again later');

  // Stack targets: the middle half of another website tile only.
  const websiteDrag = createTargetRuntime('website');
  const target = websiteDrag.context.getShortcutStackTargetAt(websiteDrag.state, 84, 24);
  assert.strictEqual(target.kind, 'shortcut-stack');
  assert.strictEqual(target.shortcutId, 'two');
  assert.strictEqual(websiteDrag.context.getShortcutStackTargetAt(websiteDrag.state, 64, 24), null,
    'the outer quarter keeps reordering');
  assert.strictEqual(websiteDrag.context.getShortcutStackTargetAt(websiteDrag.state, 24, 24), null,
    'a tile never stacks onto itself');
  assert.strictEqual(websiteDrag.context.getShortcutStackTargetAt(websiteDrag.state, 144, 24), null,
    'folder tiles keep their move-into-folder target');
  const folderDrag = createTargetRuntime('folder');
  assert.strictEqual(folderDrag.context.getShortcutStackTargetAt(folderDrag.state, 84, 24), null,
    'folder shortcuts do not stack');

  // Stacking creates a bookmarks-bar folder holding both sites.
  const runtime = createRuntime();
  const before = json(runtime.newtabShortcuts);
  const barBefore = runtime.bar();
  assert.strictEqual(await runtime.stack('three', 'two'), true);
  const created = runtime.folder();
  assert.strictEqual(created.title, 'New folder');
  assert.strictEqual(created.parentId, '1');
  assert.strictEqual(created.index, 1, 'new folders go to the end of the bookmarks bar');
  assert.deepStrictEqual(created.children.map((node) => node.url), ['https://two.example/', 'https://three.example/'],
    'the stack target comes first in the new folder');
  const entry = runtime.newtabShortcuts[1];
  assert.deepStrictEqual(runtime.newtabShortcuts.map((item) => item.type || 'site'), ['site', 'folder']);
  assert.strictEqual(runtime.newtabShortcuts[0].id, 'one');
  assert.ok(entry.folderRef && !entry.folderId, 'the folder entry syncs a portable reference');
  assert.strictEqual(runtime.bindings.get(entry.id), created.id, 'this device binds the new folder at once');
  assert.deepStrictEqual(json(runtime.newtabShortcutIcons), {});
  const [twoNode, threeNode] = created.children;
  assert.deepStrictEqual(json(runtime.folderIcons), {
    [twoNode.id]: { iconSource: 'custom', dataUrl: 'data:image/png;base64,two' },
    [threeNode.id]: { iconSource: 'builtin' }
  }, 'stacked sites keep their icons inside the folder');
  assert.strictEqual(runtime.bookmarkMoveHistory.peekUndo().kind, 'shortcut-stack');
  assert.deepStrictEqual(runtime.toasts.map((toast) => toast.message), ['Folder created · Ctrl+Z to undo']);

  for (let cycle = 0; cycle < 3; cycle += 1) {
    await runtime.action('undo');
    assert.deepStrictEqual(json(runtime.newtabShortcuts), before);
    assert.strictEqual(runtime.newtabShortcutIcons.two, 'data:image/png;base64,two', 'undo restores custom icons');
    assert.deepStrictEqual(runtime.bar(), barBefore);
    assert.ok(![...runtime.nodes.values()].some((node) => node.url === 'https://two.example/'));
    assert.deepStrictEqual(json(runtime.folderIcons), {}, 'undo drops the removed items\' icons');
    await runtime.action('redo');
    assert.deepStrictEqual(runtime.newtabShortcuts.map((item) => item.id), ['one', entry.id],
      'redo keeps the folder entry identity');
    assert.strictEqual(runtime.bindings.get(entry.id), runtime.folder().id);
    assert.deepStrictEqual(runtime.folder().children.map((node) => node.title), ['Two', 'Three']);
    assert.deepStrictEqual(Object.keys(runtime.folderIcons).sort(), runtime.folder().children.map((node) => node.id).sort(),
      'redo gives the recreated items their icons');
  }
  assert.ok(runtime.toasts.slice(1).every((toast) => !toast.isError));

  // Redo restores the folder where and under the name it was left.
  const renamed = createRuntime();
  await renamed.stack('one', 'three');
  const renamedFolder = renamed.nodes.get(renamed.folder().id);
  renamedFolder.title = 'Reading';
  renamed.nodes.get('1').children.unshift(renamed.nodes.get('1').children.pop());
  renamed.nodes.get('1').children.forEach((node, index) => { node.index = index; });
  await renamed.action('undo');
  await renamed.action('redo');
  assert.strictEqual(renamed.folder().title, 'Reading');
  assert.strictEqual(renamed.folder().index, 0);

  // Undo never deletes bookmarks that were added to the stacked folder later.
  const changed = createRuntime();
  await changed.stack('three', 'two');
  const changedRecord = changed.bookmarkMoveHistory.peekUndo();
  await changed.bookmarksRuntime.create({ parentId: changed.folder().id, title: 'Later', url: 'https://later.example/' });
  await changed.action('undo');
  assert.strictEqual(changed.bookmarkMoveHistory.peekUndo(), changedRecord);
  assert.strictEqual(changed.folder().children.length, 3);
  assert.deepStrictEqual(changed.newtabShortcuts.map((item) => item.type || 'site'), ['site', 'folder']);
  assert.ok(changed.toasts.at(-1).isError);

  // Undo reverts the drag's reordering along with the stack.
  const reordered = createRuntime();
  const beforeDrag = json(reordered.newtabShortcuts);
  const originalShortcuts = reordered.newtabShortcuts.slice();
  reordered.newtabShortcuts = [originalShortcuts[0], originalShortcuts[2], originalShortcuts[1]];
  await reordered.stack('three', 'one', { originalShortcuts, hasReordered: true });
  assert.deepStrictEqual(reordered.newtabShortcuts.map((item) => item.type || item.id), ['folder', 'two']);
  await reordered.action('undo');
  assert.deepStrictEqual(json(reordered.newtabShortcuts), beforeDrag);

  // Failures roll back every completed write and keep history clean.
  for (const failure of ['failSave', 'failCreate']) {
    const failed = createRuntime();
    const beforeFailure = json(failed.newtabShortcuts);
    failed[failure] = 1;
    assert.strictEqual(await failed.stack('three', 'two'), false);
    assert.deepStrictEqual(json(failed.newtabShortcuts), beforeFailure);
    assert.strictEqual(failed.folder(), null, `${failure} must not leave a stray folder`);
    assert.strictEqual(failed.bookmarkMoveHistory.canUndo(), false);
    assert.strictEqual(failed.bookmarkMoveHistoryBusy, false);
    assert.deepStrictEqual(failed.settled.map((tile) => tile.id), ['three'], 'the dragged tile settles back');
  }
  const failedChild = createRuntime();
  const originalCreate = failedChild.bookmarksRuntime.create;
  let createCount = 0;
  failedChild.bookmarksRuntime.create = (details) => (++createCount === 3
    ? Promise.reject(new Error('child failed')) : originalCreate(details));
  assert.strictEqual(await failedChild.stack('three', 'two'), false);
  assert.strictEqual(failedChild.folder(), null, 'a partly filled folder is removed');

  const undoFailure = createRuntime();
  await undoFailure.stack('three', 'two');
  const stackRecord = undoFailure.bookmarkMoveHistory.peekUndo();
  const stackedShortcuts = json(undoFailure.newtabShortcuts);
  undoFailure.failRemove = 1;
  await undoFailure.action('undo');
  assert.strictEqual(undoFailure.bookmarkMoveHistory.peekUndo(), stackRecord);
  assert.deepStrictEqual(json(undoFailure.newtabShortcuts).map((item) => item.id), stackedShortcuts.map((item) => item.id),
    'a failed folder removal restores the stacked shortcuts');
  assert.ok(undoFailure.folder());

  const full = createRuntime();
  await full.stack('three', 'two');
  full.newtabShortcuts.push(store.createShortcutRecord({ url: 'https://two.example/' }, { now: 789 }));
  await full.action('undo');
  assert.strictEqual(full.bookmarkMoveHistory.peekUndo().kind, 'shortcut-stack',
    'undo never duplicates a website that was added again');
  assert.ok(full.folder());

  console.log('Shortcut stacking passed: targets, folder creation, portable binding, undo/redo, rename and reorder, conflicts and rollback.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
