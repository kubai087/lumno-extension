const assert = require('assert');
const fs = require('fs');
const refs = require('../src/shared/bookmark-folder-reference.js');
const shortcuts = require('../src/newtab/shortcuts-store.js');
const settings = require('../src/shared/settings.js');
const drag = require('../src/newtab/cross-surface-drag.js');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

function tree(folderId = '42', rootId = '1', rootTitle = '书签栏') {
  return [{ id: '0', children: [{ id: rootId, parentId: '0', title: rootTitle,
    folderType: 'bookmarks-bar', syncing: true, children: [{ id: folderId, parentId: rootId,
      title: '灵感', children: [{ id: `${folderId}-url`, parentId: folderId,
        title: 'Design', url: 'https://example.com/design' }] }] }] }];
}
function device(initial = {}, nodes = tree()) {
  const listeners = [];
  const events = {};
  const chrome = { runtime: { lastError: null }, storage: { onChanged: { addListener(fn) { listeners.push(fn); } } },
    bookmarks: { getTree(fn) { fn(structuredClone(nodes)); } } };
  for (const name of ['onCreated', 'onRemoved', 'onChanged', 'onMoved', 'onChildrenReordered', 'onImportEnded']) {
    events[name] = [];
    chrome.bookmarks[name] = { addListener(fn) { events[name].push(fn); } };
  }
  for (const name of ['local', 'sync']) {
    const values = structuredClone(initial[name] || {});
    chrome.storage[name] = { values, QUOTA_BYTES: 102400,
      get(keys, fn) { fn(keys === null ? structuredClone(values) : Object.fromEntries(keys.filter((key) =>
        Object.hasOwn(values, key)).map((key) => [key, structuredClone(values[key])]))); },
      set(payload, fn) {
        const changes = {};
        for (const [key, value] of Object.entries(payload)) {
          if (JSON.stringify(value) !== JSON.stringify(values[key])) changes[key] = { newValue: structuredClone(value) };
          values[key] = structuredClone(value);
        }
        if (Object.keys(changes).length) listeners.forEach((listener) => listener(changes, name));
        if (fn) fn();
      }
    };
  }
  return { chrome, setTree(value, name = 'onChanged') { nodes = value; events[name].forEach((fn) => fn()); } };
}
function entry(map, id = 'entry-a', folderId = '42') {
  return shortcuts.createShortcutRecord({ id, type: 'folder', title: '灵感', folderRef: refs.describe(folderId, map) }, { now: 1 });
}
function functionSource(source, name) {
  let start = source.indexOf(`function ${name}(`);
  const body = source.indexOf('{', start);
  if (source.slice(start - 6, start) === 'async ') start -= 6;
  let depth = 0;
  for (let index = body; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Missing function ${name}`);
}

async function run() {
  const aMap = refs.buildNodeMap(tree());
  const item = entry(aMap);
  const bMap = refs.buildNodeMap(tree('117', '900', 'Bookmarks bar'));
  assert.strictEqual(refs.resolveReference(item.folderRef, bMap).id, '117', 'root labels and IDs are device-local');
  const firefoxNodes = [{ id: 'root________', children: [{ id: 'toolbar_____', parentId: 'root________',
    title: 'Bookmarks Toolbar', children: [{ id: 'ffFolder0001', parentId: 'toolbar_____', title: '灵感',
      children: [{ id: 'ffBookmark01', parentId: 'ffFolder0001', title: 'Design',
        url: 'https://example.com/design' }] }] }] }];
  const firefoxMap = refs.buildNodeMap(firefoxNodes);
  assert.strictEqual(refs.resolveReference(item.folderRef, firefoxMap).id, 'ffFolder0001',
    'a folder referenced in Chrome resolves in Firefox, whose roots use GUIDs');
  assert.strictEqual(refs.describe('ffFolder0001', firefoxMap).root, 'bookmarks-bar');
  assert.strictEqual(refs.describe('root________', firefoxMap), null, 'the Firefox tree root is not a folder target');
  const menuNodes = [{ id: 'root________', children: [{ id: 'menu________', parentId: 'root________',
    title: 'Bookmarks Menu', children: [{ id: 'ffMenuFold01', parentId: 'menu________', title: 'Reading', children: [] }] }] }];
  const menuRef = refs.describe('ffMenuFold01', refs.buildNodeMap(menuNodes));
  assert.strictEqual(menuRef.root, 'other',
    'Firefox menu folders use a root type that existing clients accept, since references sync through WebDAV');
  assert(!Object.hasOwn(item, 'folderId'), 'portable records contain no numeric bookmark ID');
  const generated = shortcuts.createShortcutRecord({ type: 'folder', folderRef: item.folderRef });
  assert(generated.id && generated.id.startsWith('shortcut-folder-'));
  assert.deepStrictEqual(shortcuts.normalizeShortcuts([generated]), [generated], 'normalization keeps the entry identity');
  assert.strictEqual(shortcuts.normalizeShortcutItem({ ...item, id: '' }), null,
    'a malformed portable record cannot generate a different binding identity on every read');
  assert.strictEqual(refs.normalizeReference({ ...item.folderRef, path: ['x'.repeat(1025)] }), null);
  assert.strictEqual(refs.normalizeReference({ ...item.folderRef, fingerprint: 'invalid' }), null);
  assert.strictEqual(refs.resolveReference(item.folderRef, new Map()), null);

  const duplicate = tree('117');
  const duplicateRoot = duplicate[0].children[0];
  duplicateRoot.children.push({ ...structuredClone(duplicateRoot.children[0]), id: '118' });
  assert.strictEqual(refs.resolveReference(item.folderRef, refs.buildNodeMap(duplicate)), null, 'identical candidates remain hidden');
  duplicateRoot.children[1].children[0].url = 'https://different.example/';
  assert.strictEqual(refs.resolveReference(item.folderRef, refs.buildNodeMap(duplicate)).id, '117', 'content disambiguates duplicate paths');
  const localTree = tree();
  localTree[0].children[0].syncing = false;
  assert.strictEqual(refs.resolveReference(refs.describe('42', refs.buildNodeMap(localTree)), aMap), null,
    'local-only folders never attach to another device through matching names');
  const reordered = tree();
  reordered[0].children[0].children[0].children.push({ id: 'another', title: 'Other', url: 'https://other.example/' });
  const refBefore = refs.describe('42', refs.buildNodeMap(reordered));
  reordered[0].children[0].children[0].children.reverse();
  assert.deepStrictEqual(refs.describe('42', refs.buildNodeMap(reordered)), refBefore, 'item order is not target identity');

  const a = device();
  const aRuntime = refs.createRuntime({ chrome: a.chrome });
  await aRuntime.ready;
  aRuntime.bind(item.id, '42');
  await aRuntime.flush();
  const restarted = refs.createRuntime({ chrome: a.chrome });
  await restarted.ready;
  assert.strictEqual(restarted.getNode(item, aMap).id, '42', 'drag-selected binding survives restart');

  const b = device();
  const bRuntime = refs.createRuntime({ chrome: b.chrome });
  await bRuntime.ready;
  const before = shortcuts.createShortcutRecord({ id: 'before', url: 'https://before.example/' }, { now: 1 });
  const after = shortcuts.createShortcutRecord({ id: 'after', url: 'https://after.example/' }, { now: 1 });
  const complete = [before, item, after];
  assert.deepStrictEqual(bRuntime.visibleItems(complete, new Map()).map((row) => row.id), ['before', 'after']);
  assert.deepStrictEqual(complete.map((row) => row.id), ['before', item.id, 'after'], 'hiding preserves original order and list');
  assert.deepStrictEqual(bRuntime.visibleItems(complete, bMap).map((row) => row.id), ['before', item.id, 'after']);
  await bRuntime.flush();
  assert.strictEqual(b.chrome.storage.local.values[refs.BINDINGS_KEY][item.id].folderId, '117');
  assert(!Object.keys(b.chrome.storage.sync.values).includes(refs.BINDINGS_KEY));

  const moved = tree('117', '900');
  moved[0].children[0].children[0].title = '新名字';
  moved[0].children[0].children[0].children[0].url = 'https://updated.example/';
  const movedMap = refs.buildNodeMap(moved);
  const refreshed = bRuntime.reconcile(complete, movedMap);
  assert.deepStrictEqual(refreshed[1].folderRef.path, ['新名字']);
  assert.strictEqual(bRuntime.visibleItems(refreshed, movedMap)[1].folderId, '117', 'existing binding follows edits without re-selection');
  const recreated = refs.buildNodeMap(tree('118', '900'));
  assert.strictEqual(bRuntime.getNode(item, recreated), null, 'deleted bindings never attach to a replacement folder');

  const legacy = shortcuts.createShortcutRecord({ type: 'folder', folderId: '42', title: '灵感' }, { now: 1 });
  const legacyRuntime = refs.createRuntime({ chrome: device().chrome });
  await legacyRuntime.ready;
  assert.strictEqual(legacyRuntime.reconcile([legacy], aMap)[0].folderRef.path[0], '灵感');
  assert.strictEqual(legacyRuntime.reconcile([{ ...legacy, id: 'untrusted', folderId: '117' }], aMap)[0].folderRef, undefined,
    'a legacy numeric ID from another profile is not trusted');

  const pageSource = readNewtabRuntimeSource();
  const render = new Function('runtime', 'map', 'store', 'initial', `
    const shortcutFolderRuntime = runtime;
    const bookmarksRuntime = { getNodeMap: () => map };
    const NEWTAB_SHORTCUTS_STORE = store;
    let newtabShortcuts = initial, visible = [];
    const shortcutGrid = {}, shortcutsView = { render(items) { visible = items; }, getAddButton() {} };
    const shortcutSection = { setAttribute() {} }, document = { body: null };
    let addShortcutButton;
    function getShortcutStoreOptions() { return {}; }
    function hideShortcutTooltip() {} function closeShortcutContextMenu() {}
    function syncOpenBookmarkCascadeAnchorVisual() {} function applyNewtabShortcutsVisibility() {}
    function updateShortcutLanguageStrings() {} function updateBookmarkSectionPosition() {}
    ${functionSource(pageSource, 'getVisibleShortcuts')}
    ${functionSource(pageSource, 'renderShortcuts')}
    renderShortcuts();
    return { complete: newtabShortcuts, visible };
  `);
  const rendered = render(bRuntime, new Map(), shortcuts, complete);
  assert.deepStrictEqual(rendered.complete, complete, 'actual render keeps hidden sync records');
  assert.deepStrictEqual(rendered.visible.map((row) => row.id), ['before', 'after']);
  assert.strictEqual(render(bRuntime, bMap, shortcuts, complete).visible[1].folderId, '117');

  const dropDevice = device();
  const dropRuntime = refs.createRuntime({ chrome: dropDevice.chrome });
  await dropRuntime.ready;
  const ambiguousMap = refs.buildNodeMap(tree('117'));
  const duplicateTarget = { ...structuredClone(ambiguousMap.get('117')), id: '118' };
  ambiguousMap.get('1').children.push(duplicateTarget);
  ambiguousMap.set('118', duplicateTarget);
  const drop = new Function('shortcutFolderRuntime', 'FOLDER_REFERENCES', 'NEWTAB_CROSS_SURFACE_DRAG', 'store', 'map', 'NEWTAB_BOOKMARK_MOVE_HISTORY', `
    let newtabShortcuts = [];
    const newtabShortcutIcons = {};
    const MAX_NEWTAB_SHORTCUTS = 60;
    const bookmarkMoveHistory = NEWTAB_BOOKMARK_MOVE_HISTORY.createBookmarkMoveHistory();
    let bookmarkMoveHistoryBusy = false;
    const bookmarkCascadeRuntime = null;
    const bookmarksRuntime = {
      getNodeMap: () => map, getNode: (id) => map.get(id),
      ensureReady: () => Promise.resolve(true),
      runControlledMutation: (run) => Promise.resolve().then(run)
    };
    function getShortcutFolderId(item) { return item.folderId || shortcutFolderRuntime.getNode(item, map)?.id || ''; }
    async function persistShortcuts(items) { newtabShortcuts = store.normalizeShortcuts(items); return true; }
    function t(key, text) { return text; }
    function showToast(message) {
      if (message !== 'Folder added to shortcuts') throw new Error('A selected folder must not ask for confirmation');
    }
    function markBookmarkTreeDirty() {} function loadBookmarks() {}
    function queueBookmarkLayoutAnimation() {}
    function refreshShortcutFolderReferences() { return Promise.resolve(); }
    let bookmarkPendingLayoutAnimation;
    ${functionSource(pageSource, 'applyBookmarkShortcutTransfer')}
    ${functionSource(pageSource, 'moveBookmarkToShortcuts')}
    return { move: moveBookmarkToShortcuts, getItems: () => newtabShortcuts };
  `)(dropRuntime, refs, drag, shortcuts, ambiguousMap, require('../src/newtab/bookmark-move-history'));
  const dropTarget = { record: shortcuts.createShortcutRecord({ type: 'folder', folderId: '118', title: '灵感' }), index: 0 };
  assert.strictEqual(await drop.move({ bookmarkId: '118' }, dropTarget), true);
  const selected = drop.getItems()[0];
  assert(selected.folderRef && !Object.hasOwn(selected, 'folderId'));
  assert.strictEqual(dropRuntime.visibleItems([selected], ambiguousMap)[0].folderId, '118',
    'actual drop binds the selected folder immediately even with identical sibling folders');
  assert.strictEqual(await drop.move({ bookmarkId: '118' }, dropTarget), true);
  assert.strictEqual(drop.getItems().length, 1);
  assert.strictEqual(drop.getItems()[0].id, selected.id, 'a repeat drop retains the existing entry identity');

  const reorder = new Function('initial', 'tiles', 'id', 'index', `
    let newtabShortcuts = initial;
    const getShortcutReorderTiles = () => tiles;
    const getShortcutTileId = (tile) => tile.id;
    ${functionSource(pageSource, 'moveShortcutItem')}
    moveShortcutItem(id, index);
    return newtabShortcuts;
  `);
  assert.deepStrictEqual(reorder(complete, [{ id: 'before' }, { id: 'after' }], 'after', 0).map((row) => row.id),
    ['after', 'before', item.id], 'visible reorder does not discard hidden entries');
  for (const [id, index] of [['before', 0], ['after', 1]]) {
    assert.deepStrictEqual(reorder(complete, [{ id: 'before' }, { id: 'after' }], id, index), complete,
      'a drag within the current visible slot does not move records around hidden entries');
  }

  const longEntry = shortcuts.createShortcutRecord({ ...item, id: 'long-path',
    folderRef: { ...item.folderRef, path: Array(10).fill('x'.repeat(1024)) } });
  const orderDevice = device();
  const saveOrder = new Function('initial', 'NEWTAB_SHORTCUTS_STORE', 'storageArea', `
    let newtabShortcuts = initial, newtabShortcutIcons = {}, shortcutPersistenceInFlightCount = 0;
    let overflow = [], renderCount = 0;
    function getShortcutStoreOptions() { return {}; }
    function getNextShortcutIconMap() { return {}; }
    function areShortcutIconMapsEqual() { return true; }
    function getShortcutSyncByteBudget() { return Promise.resolve(23040); }
    function isShortcutSyncStorageActive() { return true; }
    function writeShortcutLocalState(items) { overflow = items; return Promise.resolve(); }
    function getShortcutStorageLastError() { return null; }
    function pruneShortcutFavicons() {} function renderShortcuts() { renderCount += 1; }
    function showToast() { throw new Error('Successful reorder should not show an error'); }
    ${functionSource(pageSource, 'persistShortcuts')}
    ${functionSource(pageSource, 'persistShortcutOrder')}
    return persistShortcutOrder().then((items) => ({ items, overflow, renderCount }));
  `);
  const savedOrder = await saveOrder([after, longEntry, before], shortcuts, orderDevice.chrome.storage.sync);
  assert.deepStrictEqual(savedOrder.items.map((row) => row.id), ['after', 'long-path', 'before'],
    'actual reorder persistence keeps the complete list when a folder path exceeds the sync item quota');
  assert.deepStrictEqual(savedOrder.overflow.map((row) => row.id), ['long-path', 'before'],
    'overflow retains the suffix so loading restores the same ordering');
  assert.deepStrictEqual((await shortcuts.loadShortcuts(orderDevice.chrome.storage.sync)).map((row) => row.id), ['after']);
  assert.strictEqual(savedOrder.renderCount, 0, 'the drag release owns the final render');

  const visibility = new Function('count', 'addVisible', `
    const shortcutSection = {}, newtabShortcuts = Array(count).fill({});
    const MAX_NEWTAB_SHORTCUTS = 60, newtabShortcutAddVisible = addVisible;
    const newtabShortcutsVisible = true, zenModeEnabled = false;
    let visible;
    function getVisibleShortcuts() { return []; }
    function setContentSectionVisible(section, value) { visible = value; }
    function resetShortcutDockHover() {} function closeShortcutContextMenu() {} function closeShortcutDialog() {}
    ${functionSource(pageSource, 'applyNewtabShortcutsVisibility')}
    applyNewtabShortcutsVisibility(); return visible;
  `);
  assert.strictEqual(visibility(60, true), false, 'all-hidden entries at capacity do not leave an empty rail');
  assert.strictEqual(visibility(2, true), true, 'the add button remains available below capacity');
  assert.strictEqual(visibility(2, false), false);

  const other = entry(aMap, 'entry-other');
  await shortcuts.saveShortcuts(b.chrome.storage.sync, [item, other]);
  await shortcuts.saveShortcut(b.chrome.storage.sync, { ...item, title: 'Updated' });
  assert.strictEqual((await shortcuts.loadShortcuts(b.chrome.storage.sync)).length, 2, 'saving one portable entry preserves other folders');
  const plan = drag.planBookmarkToShortcut({ shortcuts: [item], record: legacy, index: 1, maxShortcuts: 1,
    getFolderId: (row) => row.folderId || aRuntime.getNode(row, aMap)?.id });
  assert.strictEqual(plan.shortcutId, item.id, 'repeat drag uses the existing portable entry');

  const sourceDevice = device({ sync: shortcuts.createShortcutStoragePayload([legacy]) });
  const controller = refs.createSyncController({ chrome: sourceDevice.chrome, settings, shortcuts });
  controller.start();
  await controller.refresh();
  await controller.refresh();
  const migrated = await shortcuts.loadShortcuts(sourceDevice.chrome.storage.sync);
  assert(migrated[0].folderRef, 'background migrates old entries without an open new-tab');
  assert(!Object.hasOwn(migrated[0], 'folderId'));
  const renamed = tree();
  renamed[0].children[0].children[0].title = 'Moved';
  sourceDevice.setTree(renamed);
  await controller.refresh();
  assert.deepStrictEqual((await shortcuts.loadShortcuts(sourceDevice.chrome.storage.sync))[0].folderRef.path, ['Moved']);
  const originalFolder = renamed[0].children[0].children[0];
  originalFolder.parentId = '88';
  renamed[0].children[0].children = [{ id: '88', parentId: '1', title: 'Design', children: [originalFolder] }];
  sourceDevice.setTree(renamed, 'onMoved');
  await controller.refresh();
  assert.deepStrictEqual((await shortcuts.loadShortcuts(sourceDevice.chrome.storage.sync))[0].folderRef.path, ['Design', 'Moved']);
  assert.strictEqual(sourceDevice.chrome.storage.sync.values[refs.BINDINGS_KEY], undefined);
  console.log('Folder reference tests passed: per-device IDs, direct binding, hidden/recovered order, ambiguity, legacy migration, background edits and isolated storage.');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
