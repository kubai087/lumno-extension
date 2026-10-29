const assert = require('assert');
const { JSDOM } = require('jsdom');
const { createFakeBookmarks } = require('../helpers/newtab-fixtures');
const actionsModule = require('../../src/newtab/bookmarks/bookmark-move-actions.ts');
const bookmarksRuntimeModule = require('../../src/newtab/bookmarks/bookmarks-runtime.ts');
const moveHistory = require('../../src/newtab/bookmarks/bookmark-move-history.ts');
const crossSurfaceDrag = require('../../src/newtab/cross-surface-drag.ts');
const shortcutsStore = require('../helpers/shortcuts-store.ts');
const { BookmarksShown } = require('../../src/newtab/bookmarks/bookmarks-shown.ts');

// Bookmark moves and deletes go on the move history; undo and redo replay
// them, and the shortcut changes that share the history.

const wait = () => new Promise((resolve) => setTimeout(resolve, 20));

async function setUp() {
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'chrome-extension://lumno/newtab.html' });
  // Node 22 has a getter-only global navigator, so plain assignment is ignored.
  Object.defineProperty(global, 'navigator', { value: { platform: 'MacIntel' }, configurable: true });
  const bookmarks = createFakeBookmarks(dom.window, [
    { id: '10', title: 'Alpha', url: 'https://alpha.example/' },
    { id: '11', title: 'Beta', url: 'https://beta.example/' },
    { id: '20', title: 'Folder', children: [] }
  ]);
  const runtime = bookmarksRuntimeModule.createBookmarksRuntime({ chromeApi: { bookmarks, runtime: {} } });
  await runtime.ensureReady(true);
  const toasts = [];
  // The page's shortcut list, which persisting replaces.
  const shortcutList = {
    items: [],
    icons: {},
    replaceItems(items) { this.items = items; },
    replaceIcons(icons) { this.icons = icons; }
  };
  const pageState = {
    bookmarkMoveHistoryBusy: false
  };
  const history = moveHistory.createBookmarkMoveHistory();
  const actions = actionsModule.createBookmarkMoveActions({
    bookmarksRuntime: runtime,
    bookmarkMoveHistory: history,
    NEWTAB_BOOKMARK_MOVE_HISTORY: moveHistory,
    NEWTAB_CROSS_SURFACE_DRAG: crossSurfaceDrag,
    transfer: {
      applyBookmarkShortcutTransfer: () => Promise.resolve(false),
      applyShortcutStack: () => Promise.resolve(false)
    },
    applyShortcutGroupDeleteRecord: () => Promise.resolve(false),
    persistShortcuts: (items) => {
      shortcutList.items = items;
      return Promise.resolve(true);
    },
    MAX_NEWTAB_SHORTCUTS: 30,
    refreshShortcutFolderReferences: () => Promise.resolve(),
    scheduleWallpaperAdaptiveToneUpdate() {},
    markBookmarkTreeDirty() {},
    loadBookmarks() {},
    refreshOpenBookmarkCascadeMenu: () => Promise.resolve(false),
    queueLayoutAnimation() {},
    dropLayoutAnimation() {},
    showToast: (message) => toasts.push(message),
    t: (key, fallback) => fallback,
    formatMessage: (key, fallback, params) => fallback.replace('{shortcut}', params && params.shortcut),
    shortcutList,
    // The bar's root folder, browsed from its first page.
    bookmarksShown: new BookmarksShown(),
    bookmarkParts: { cascade: null },
    pageState
  });
  const barIds = () => bookmarks.root.children[0].children.map((node) => node.title);
  return { bookmarks, runtime, actions, pageState, shortcutList, history, toasts, barIds };
}

(async () => {
  {
    const { actions, history, toasts, barIds, runtime } = await setUp();
    assert.strictEqual(actions.getBookmarkUndoShortcutLabel(), '⌘Z');
    assert.strictEqual(actions.deleteBookmarkFromContextTarget({ bookmarkId: '10' }), true);
    await wait();
    assert.deepStrictEqual(barIds(), ['Beta', 'Folder'], 'the bookmark is deleted');
    assert.ok(history.peekUndo());
    assert.strictEqual(actions.performBookmarkMoveHistoryAction('undo'), true);
    await wait();
    await runtime.ensureReady(true);
    assert.deepStrictEqual(barIds(), ['Alpha', 'Beta', 'Folder'], 'undo puts it back where it was');
    assert.deepStrictEqual(toasts, ['Deletion undone · ⇧⌘Z to delete again']);
    assert.strictEqual(actions.performBookmarkMoveHistoryAction('redo'), true);
    await wait();
    assert.deepStrictEqual(barIds(), ['Beta', 'Folder'], 'redo deletes it again');
    assert.strictEqual(actions.performBookmarkMoveHistoryAction('redo'), false, 'nothing is left to redo');
  }
  {
    const { actions, bookmarks, history, barIds, runtime } = await setUp();
    const session = { bookmarkId: '10', parentId: '1', originalIndex: 0, itemTitle: 'Alpha', keepCascadeOpenAfterDrop: false };
    assert.strictEqual(await actions.persistBookmarkCrossLevelMove(session, { kind: 'card', surface: 'grid', folderId: '20' }), true);
    assert.deepStrictEqual(bookmarks.find('20').children.map((node) => node.title), ['Alpha'], 'the bookmark moves into the folder');
    assert.ok(history.peekUndo());
    await runtime.ensureReady(true);
    actions.performBookmarkMoveHistoryAction('undo');
    await wait();
    assert.deepStrictEqual(barIds(), ['Alpha', 'Beta', 'Folder'], 'undo moves it back');
    assert.strictEqual(await actions.persistBookmarkCrossLevelMove(session, { kind: 'blocked', surface: 'folder' }), false,
      'a blocked drop moves nothing');
  }
  {
    const { actions, pageState, history, toasts, shortcutList } = await setUp();
    const snapshot = shortcutsStore.createShortcutRecord({ id: 's1', title: 'Alpha', url: 'https://alpha.example/' });
    shortcutList.items = [snapshot];
    history.push(moveHistory.createShortcutAddRecord({ snapshot, index: 0 }));
    actions.performBookmarkMoveHistoryAction('undo');
    await wait();
    assert.deepStrictEqual(shortcutList.items, [], 'undoing an addition takes the shortcut out');
    assert.deepStrictEqual(toasts, ['Shortcut add undone · ⇧⌘Z to redo']);
    actions.performBookmarkMoveHistoryAction('redo');
    await wait();
    assert.deepStrictEqual(shortcutList.items.map((item) => item.id), ['s1'], 'redo adds it again');
    pageState.bookmarkMoveHistoryBusy = true;
    assert.strictEqual(actions.performBookmarkMoveHistoryAction('undo'), false, 'nothing replays while a change runs');
  }
  console.log('bookmark move actions tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
