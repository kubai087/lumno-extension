const assert = require('assert');
const { JSDOM } = require('jsdom');
const { createFakeBookmarks } = require('../helpers/newtab-fixtures');
const transferModule = require('../../src/newtab/bookmarks/bookmark-shortcut-transfer.ts');
const bookmarksRuntimeModule = require('../../src/newtab/bookmarks/bookmarks-runtime.ts');
const moveHistory = require('../../src/newtab/bookmarks/bookmark-move-history.ts');
const crossSurfaceDrag = require('../../src/newtab/cross-surface-drag.ts');
const shortcutsStore = require('../helpers/shortcuts-store.ts');
const folderReferences = require('../../src/domain/bookmark-folder-reference.ts');
const { MoveHistoryLock } = require('../../src/newtab/bookmarks/move-history-lock.ts');

// A bookmark dropped on the shortcuts: copied while the shortcuts have no
// WebDAV backup, moved while they do, and put back by undo.

const SITE = { id: '10', title: 'Example', url: 'https://example.com/' };

async function setUp(options) {
  const dom = new JSDOM('<!doctype html><body></body>');
  const bookmarks = createFakeBookmarks(dom.window, [SITE, { id: '20', title: 'Folder', children: [] }]);
  const runtime = bookmarksRuntimeModule.createBookmarksRuntime({ chromeApi: { bookmarks, runtime: {} } });
  await runtime.ensureReady(true);
  const toasts = [];
  const layoutNotes = [];
  // The page's shortcut list, which persisting replaces.
  const shortcutList = {
    items: [],
    icons: {},
    replaceItems(items) { this.items = items; },
    replaceIcons(icons) { this.icons = icons; }
  };
  // The lock an undoable change holds while it runs.
  const historyLock = new MoveHistoryLock();
  const history = moveHistory.createBookmarkMoveHistory();
  const transfer = transferModule.createBookmarkShortcutTransfer({
    bookmarksRuntime: runtime,
    NEWTAB_CROSS_SURFACE_DRAG: crossSurfaceDrag,
    NEWTAB_BOOKMARK_MOVE_HISTORY: moveHistory,
    NEWTAB_SHORTCUTS_STORE: shortcutsStore,
    getShortcutStoreOptions: () => ({}),
    getShortcutFolderId: (item) => String(item.folderId || ''),
    MAX_NEWTAB_SHORTCUTS: 30,
    FOLDER_REFERENCES: folderReferences,
    bookmarkMoveHistory: history,
    shortcutFolderRuntime: { bind() {}, flush: () => Promise.resolve() },
    updateFolderItemIcons: () => Promise.resolve({}),
    persistShortcuts: (items) => {
      shortcutList.items = items;
      return Promise.resolve(true);
    },
    refreshShortcutFolderReferences: () => Promise.resolve(),
    isWebDavBackingUpShortcuts: () => Promise.resolve(Boolean(options.webdavBackup)),
    markBookmarkTreeDirty() {},
    loadBookmarks() {},
    queueLayoutAnimation: (id) => layoutNotes.push(id),
    dropLayoutAnimation: () => layoutNotes.push('dropped'),
    showToast: (message) => toasts.push(message),
    t: (key, fallback) => fallback,
    formatMessage: (key, fallback) => fallback,
    shortcutList,
    bookmarkParts: { cascade: null },
    historyLock
  });
  const siteRecord = shortcutsStore.createShortcutRecord({ title: SITE.title, url: SITE.url });
  return { bookmarks, runtime, transfer, historyLock, shortcutList, history, toasts, layoutNotes, siteRecord };
}

(async () => {
  {
    const { bookmarks, transfer, historyLock, history, toasts, layoutNotes, siteRecord, shortcutList } = await setUp({ webdavBackup: false });
    assert.strictEqual(await transfer.moveBookmarkToShortcuts({ bookmarkId: SITE.id }, { record: siteRecord, index: 0, groupId: '' }), true);
    assert.deepStrictEqual(shortcutList.items.map((item) => [item.url, item.fromBookmark]), [[SITE.url, true]],
      'without a backup the shortcut is a copy marked as from the bookmarks');
    assert.ok(bookmarks.find(SITE.id), 'and the bookmark stays');
    assert.deepStrictEqual(toasts, ['Shortcut added']);
    assert.deepStrictEqual(layoutNotes, [SITE.id], 'the cards slide from where they were');
    assert.ok(history.peekUndo(), 'the copy can be undone');
    assert.strictEqual(historyLock.busy, false);
  }
  {
    const { bookmarks, runtime, transfer, history, siteRecord, shortcutList } = await setUp({ webdavBackup: true });
    assert.strictEqual(await transfer.moveBookmarkToShortcuts({ bookmarkId: SITE.id }, { record: siteRecord, index: 0, groupId: '' }), true);
    assert.deepStrictEqual(shortcutList.items.map((item) => [item.url, item.fromBookmark]), [[SITE.url, undefined]],
      'with a backup the site moves into the shortcuts');
    assert.strictEqual(bookmarks.find(SITE.id), null, 'and leaves the bookmarks');
    const record = history.peekUndo();
    assert.strictEqual(await transfer.applyBookmarkShortcutTransfer(record, true), true);
    assert.deepStrictEqual(shortcutList.items, [], 'undo takes the shortcut back out');
    await runtime.ensureReady(true);
    const restored = bookmarks.root.children[0].children.find((node) => node.url === SITE.url);
    assert.ok(restored, 'and puts the bookmark back');
    assert.strictEqual(restored.index, 0, 'where it was');
  }
  {
    const { transfer, historyLock, siteRecord, shortcutList } = await setUp({ webdavBackup: false });
    historyLock.hold();
    assert.strictEqual(await transfer.moveBookmarkToShortcuts({ bookmarkId: SITE.id }, { record: siteRecord, index: 0, groupId: '' }), false,
      'nothing starts while another change runs');
    assert.deepStrictEqual(shortcutList.items, []);
  }
  {
    const { transfer, toasts, shortcutList } = await setUp({ webdavBackup: false });
    assert.strictEqual(transfer.hasShortcutForBookmarkFolder('20'), false);
    assert.strictEqual(await transfer.addBookmarkFolderToShortcuts('20'), true);
    assert.strictEqual(shortcutList.items.length, 1);
    assert.strictEqual(shortcutList.items[0].type, 'folder');
    assert.deepStrictEqual(toasts, ['Folder added to shortcuts']);
    assert.strictEqual(await transfer.addBookmarkFolderToShortcuts(SITE.id), false, 'a site is no folder');
  }
  console.log('bookmark shortcut transfer tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
