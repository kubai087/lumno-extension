// Alt+Arrow on a focused shortcut moves it one place and saves it the way a
// drop does: one undoable reorder record, and the tile keeps focus.
const assert = require('assert');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const NEWTAB_BOOKMARK_MOVE_HISTORY = require(path.join(repoRoot, 'src/newtab/bookmarks/bookmark-move-history.ts'));
const NEWTAB_CROSS_SURFACE_DRAG = require(path.join(repoRoot, 'src/newtab/cross-surface-drag.ts'));
require(path.join(repoRoot, 'src/newtab/dismiss-stack.ts'));
const LumnoNewtabShortcutDrag = require(path.join(repoRoot, 'src/newtab/shortcuts/shortcut-drag.ts'));

global.window = global;
global.document = { activeElement: null, body: { setAttribute() {}, removeAttribute() {} } };

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function createFixture(shortcuts) {
  // The page's shortcut list, which a move replaces.
  const shortcutList = {
    items: shortcuts.map((item) => ({ ...item })),
    icons: {},
    replaceItems(next) { this.items = next; },
    replaceIcons(next) { this.icons = next; }
  };
  const pageState = {
    shortcutDragState: null,
    bookmarkMoveHistoryBusy: false
  };
  const saved = [];
  const history = [];
  let renders = 0;
  // The rendered grid lists visible tiles group by group.
  const createTile = (shortcut) => ({
    getAttribute: (name) => (name === 'data-shortcut-id' ? shortcut.id
      : name === 'data-shortcut-group-id' ? shortcut.groupId || '' : null),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
    focus() { global.document.activeElement = this; }
  });
  const getTiles = () => shortcutList.items.map(createTile);
  let tiles = getTiles();
  const drag = LumnoNewtabShortcutDrag.createShortcutDrag({
    NEWTAB_CROSS_SURFACE_DRAG,
    NEWTAB_BOOKMARK_MOVE_HISTORY,
    getShortcutReorderTiles: () => tiles,
    getShortcutTileId: (tile) => tile.getAttribute('data-shortcut-id'),
    getShortcutTileById: (id) => tiles.find((tile) => tile.getAttribute('data-shortcut-id') === id) || null,
    persistShortcuts: (items) => {
      saved.push(items.map((item) => `${item.groupId || ''}:${item.id}`));
      return Promise.resolve(true);
    },
    bookmarkMoveHistory: { push: (record) => history.push(record) },
    renderShortcuts: () => {
      renders += 1;
      tiles = getTiles();
    },
    scheduleWallpaperAdaptiveToneUpdate() {},
    shortcutList,
    shortcutGrid: null,
    getAddShortcutButton: () => null,
    pageState
  });
  return {
    drag,
    pageState,
    saved,
    history,
    order: () => shortcutList.items.map((item) => `${item.groupId || ''}:${item.id}`),
    renders: () => renders
  };
}

(async () => {
  // Within a group the tile swaps places with its neighbor.
  {
    const fixture = createFixture([
      { id: 'a', groupId: 'g1' }, { id: 'b', groupId: 'g1' }, { id: 'c', groupId: 'g1' }
    ]);
    assert.strictEqual(fixture.drag.moveShortcutByKeyboard('a', 1), true);
    assert.deepStrictEqual(fixture.order(), ['g1:b', 'g1:a', 'g1:c']);
    await settle();
    assert.deepStrictEqual(fixture.saved, [['g1:b', 'g1:a', 'g1:c']]);
    assert.strictEqual(fixture.history.length, 1, 'one undoable reorder');
    assert.strictEqual(fixture.history[0].kind, 'shortcut-reorder');
    assert.strictEqual(fixture.renders(), 1);
    assert.strictEqual(global.document.activeElement.getAttribute('data-shortcut-id'), 'a',
      'the moved tile keeps focus');

    assert.strictEqual(fixture.drag.moveShortcutByKeyboard('a', -1), true);
    assert.deepStrictEqual(fixture.order(), ['g1:a', 'g1:b', 'g1:c']);
    await settle();
  }

  // The first and last tiles go no further.
  {
    const fixture = createFixture([{ id: 'a', groupId: 'g1' }, { id: 'b', groupId: 'g1' }]);
    assert.strictEqual(fixture.drag.moveShortcutByKeyboard('a', -1), false);
    assert.strictEqual(fixture.drag.moveShortcutByKeyboard('b', 1), false);
    await settle();
    assert.deepStrictEqual(fixture.saved, []);
  }

  // At a group's edge the tile joins the neighboring group.
  {
    const fixture = createFixture([
      { id: 'a', groupId: 'g1' }, { id: 'b', groupId: 'g1' }, { id: 'c', groupId: 'g2' }
    ]);
    assert.strictEqual(fixture.drag.moveShortcutByKeyboard('b', 1), true);
    assert.deepStrictEqual(fixture.order(), ['g1:a', 'g2:b', 'g2:c'], 'first in the next group');
    await settle();
    assert.strictEqual(fixture.drag.moveShortcutByKeyboard('b', -1), true);
    assert.deepStrictEqual(fixture.order(), ['g1:a', 'g1:b', 'g2:c'], 'last in the previous group');
    await settle();
    assert.strictEqual(fixture.history.length, 2);
  }

  // Nothing moves while a drag or another history action runs.
  {
    const fixture = createFixture([{ id: 'a', groupId: 'g1' }, { id: 'b', groupId: 'g1' }]);
    fixture.pageState.bookmarkMoveHistoryBusy = true;
    assert.strictEqual(fixture.drag.moveShortcutByKeyboard('a', 1), false);
    fixture.pageState.bookmarkMoveHistoryBusy = false;
    fixture.pageState.shortcutDragState = { tile: null };
    assert.strictEqual(fixture.drag.moveShortcutByKeyboard('a', 1), false);
    assert.deepStrictEqual(fixture.order(), ['g1:a', 'g1:b']);
  }

  console.log('newtab shortcut keyboard reorder tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
