const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parsePageCss } = require('../helpers/css-rules');
const { getPageScripts } = require('../helpers/runtime-scripts');
const { openDragPage } = require('../helpers/newtab-drag-page');

// Dragging across New Tab's surfaces: the cross-surface planning helpers,
// unit-tested here, and what a drag shows on the page (the insertion line,
// a folder's drop highlight, Escape). Where drops land, and their undo, is
// covered by test-newtab-shortcut-bookmark-drop-targets.js and
// test-newtab-bookmark-shortcut-transfer-history.js.

const repoRoot = path.resolve(__dirname, '..', '..');
const {
  getInsertionGapNeighbors,
  getRowInsertionSlot,
  isBookmarkFolderDropTarget,
  planBookmarkToShortcut,
  setInsertionGap
} = require(path.join(repoRoot, 'src', 'newtab', 'cross-surface-drag.ts'));

// Drag slides honor a reduced-motion preference.
{
  const { prefersReducedMotion } = require(path.join(repoRoot, 'src', 'newtab', 'cross-surface-drag.ts'));
  const windowWith = (reduce) => ({
    matchMedia: (query) => ({ matches: reduce && query === '(prefers-reduced-motion: reduce)' })
  });
  assert.strictEqual(prefersReducedMotion(windowWith(true)), true);
  assert.strictEqual(prefersReducedMotion(windowWith(false)), false);
  assert.strictEqual(prefersReducedMotion({}), false, 'no matchMedia means full motion');
}

function rect(left, top, width = 60, height = 60) {
  return {
    rect: {
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
      centerX: left + (width / 2),
      centerY: top + (height / 2)
    }
  };
}

{
  const folders = [
    { id: 'design-entry', type: 'folder', folderId: '42' },
    { id: 'archive-entry', type: 'folder', folderId: '43' }
  ];
  const duplicatePlan = planBookmarkToShortcut({
    shortcuts: folders, record: { id: 'duplicate', type: 'folder', folderId: '42' },
    index: 2, maxShortcuts: 2
  });
  assert.deepStrictEqual(duplicatePlan.shortcuts.map((item) => item.id), ['archive-entry', 'design-entry']);
  assert.strictEqual(planBookmarkToShortcut({
    shortcuts: folders, record: { type: 'folder', folderId: '44' }, index: 0, maxShortcuts: 2
  }), null, 'new folders must not evict entries when the dock is full');
}

// Two rows: three tiles on top, two below.
const tiles = [
  rect(0, 0), rect(70, 0), rect(140, 0),
  rect(0, 80), rect(70, 80)
];

assert.deepStrictEqual(
  getRowInsertionSlot([], 10, 10),
  { index: 0, anchorIndex: -1, markerPosition: 'before' },
  'an empty grid should insert at the first slot'
);
assert.deepStrictEqual(
  getRowInsertionSlot(tiles, 5, 30),
  { index: 0, anchorIndex: 0, markerPosition: 'before' },
  'the left half of the first tile should insert before it'
);
assert.deepStrictEqual(
  getRowInsertionSlot(tiles, 110, 30),
  { index: 2, anchorIndex: 2, markerPosition: 'before' },
  'a point between row tiles should insert before the next tile'
);
assert.deepStrictEqual(
  getRowInsertionSlot(tiles, 400, 30),
  { index: 3, anchorIndex: 2, markerPosition: 'after' },
  'the end of a wrapped row should insert after its last tile, not before the next row'
);
assert.deepStrictEqual(
  getRowInsertionSlot(tiles, 400, 500),
  { index: 5, anchorIndex: 4, markerPosition: 'after' },
  'points below the grid should snap to the nearest (last) row'
);
assert.deepStrictEqual(
  getRowInsertionSlot(tiles, 50, 70),
  { index: 1, anchorIndex: 1, markerPosition: 'before' },
  'row gaps should resolve to the nearest row without a dead zone'
);

const nodeMap = new Map([
  ['0', { id: '0' }],
  ['1', { id: '1', parentId: '0' }],
  ['work', { id: 'work', parentId: '1' }],
  ['link', { id: 'link', parentId: '1', url: 'https://example.com/' }]
]);
assert.strictEqual(isBookmarkFolderDropTarget('1', nodeMap), true, 'the bookmarks bar accepts drops');
assert.strictEqual(isBookmarkFolderDropTarget('work', nodeMap), true, 'nested folders accept drops');
assert.strictEqual(isBookmarkFolderDropTarget('0', nodeMap), false, 'the tree root never accepts drops');
assert.strictEqual(isBookmarkFolderDropTarget('link', nodeMap), false, 'URL bookmarks are not folders');
assert.strictEqual(isBookmarkFolderDropTarget('missing', nodeMap), false, 'unknown folders are rejected');
assert.strictEqual(isBookmarkFolderDropTarget('', nodeMap), false, 'empty folder ids are rejected');

const shortcuts = ['a', 'b', 'c', 'd'].map((id) => ({ id, url: `https://${id}.test/` }));
const record = { id: 'new', url: 'https://new.test/' };
assert.deepStrictEqual(
  planBookmarkToShortcut({ shortcuts, record, index: 1, maxShortcuts: 60 }).shortcuts.map((item) => item.id),
  ['a', 'new', 'b', 'c', 'd'],
  'a new bookmark URL should be inserted at the drop index'
);
assert.strictEqual(
  planBookmarkToShortcut({ shortcuts, record, index: 1, maxShortcuts: 60 }).shortcutId,
  'new',
  'the plan should report the inserted shortcut id for sync-limit warnings'
);
assert.strictEqual(
  planBookmarkToShortcut({ shortcuts, record, index: 1, maxShortcuts: 4 }),
  null,
  'a full shortcut list should reject new URLs'
);
assert.deepStrictEqual(
  planBookmarkToShortcut({
    shortcuts,
    record: { id: 'dup', url: 'https://a.test/' },
    index: 3,
    maxShortcuts: 4
  }).shortcuts.map((item) => item.id),
  ['b', 'c', 'a', 'd'],
  'an existing URL should move its shortcut forward instead of duplicating it, even when full'
);
assert.deepStrictEqual(
  planBookmarkToShortcut({
    shortcuts,
    record: { id: 'dup', url: 'https://d.test/' },
    index: 0,
    maxShortcuts: 60
  }).shortcuts.map((item) => item.id),
  ['d', 'a', 'b', 'c'],
  'an existing URL should move its shortcut backward to the drop index'
);
assert.strictEqual(
  planBookmarkToShortcut({ shortcuts, record: null, index: 0, maxShortcuts: 60 }),
  null,
  'bookmarks without a shortcut-compatible URL should be rejected'
);

{
  const [a, b, c, d] = ['a', 'b', 'c', 'd'];
  const items = [a, b, c, d];
  assert.deepStrictEqual(getInsertionGapNeighbors(items, b, 'before'), { before: a, after: b },
    'a gap before an item leans its previous sibling and the item apart');
  assert.deepStrictEqual(getInsertionGapNeighbors(items, b, 'after'), { before: b, after: c },
    'a gap after an item leans the item and its next sibling apart');
  assert.deepStrictEqual(getInsertionGapNeighbors(items, a, 'before'), { before: null, after: a },
    'a gap at the start only moves the first item');
  assert.deepStrictEqual(getInsertionGapNeighbors(items, d, 'after'), { before: d, after: null },
    'a gap at the end only moves the last item');
  const rowOf = { a: 0, b: 0, c: 1, d: 1 };
  assert.deepStrictEqual(
    getInsertionGapNeighbors(items, b, 'after', (item, anchor) => rowOf[item] === rowOf[anchor]),
    { before: b, after: null },
    'a neighbour that wrapped to the next row stays put'
  );
  assert.deepStrictEqual(getInsertionGapNeighbors(items, 'x', 'before'), { before: null, after: null },
    'an anchor outside the list leans nothing');
}

{
  const makeElement = () => {
    const attributes = new Map();
    return {
      getAttribute: (name) => attributes.has(name) ? attributes.get(name) : null,
      setAttribute: (name, value) => attributes.set(name, String(value)),
      removeAttribute: (name) => attributes.delete(name)
    };
  };
  const [first, second, third] = [makeElement(), makeElement(), makeElement()];
  const owner = {};
  setInsertionGap(owner, first, second);
  assert.strictEqual(first.getAttribute('data-drag-gap'), 'before');
  assert.strictEqual(second.getAttribute('data-drag-gap'), 'after');
  setInsertionGap(owner, second, third);
  assert.strictEqual(first.getAttribute('data-drag-gap'), 'rest',
    'a released neighbour keeps its transition while it slides back');
  assert.strictEqual(second.getAttribute('data-drag-gap'), 'before',
    'a neighbour that stays adjacent switches sides without resting');
  assert.strictEqual(third.getAttribute('data-drag-gap'), 'after');
  setInsertionGap(owner, null, null);
  assert.strictEqual(second.getAttribute('data-drag-gap'), 'rest');
  assert.strictEqual(third.getAttribute('data-drag-gap'), 'rest');
  [first, second, third].forEach((element) => clearTimeout(element._xInsertionGapRestTimer));
}

// Shortcut groups: undo restores each entry's group, a move that only
// changes the group is still a recorded move, and a stacked folder takes the
// group of the site it was stacked onto.
{
  const crossSurface = require(path.join(repoRoot, 'src', 'newtab', 'cross-surface-drag.ts'));
  const history = require(path.join(repoRoot, 'src', 'newtab', 'bookmarks', 'bookmark-move-history.ts'));
  const shortcuts = [
    { id: 'a', url: 'https://a.example/', groupId: 'g0' },
    { id: 'b', url: 'https://b.example/', groupId: 'work' },
    { id: 'c', url: 'https://c.example/', groupId: 'work' }
  ];
  const regrouped = crossSurface.planShortcutReorder({
    shortcuts, order: ['a', 'b', 'c'], groups: ['work', 'work', 'g0']
  });
  assert.deepStrictEqual(regrouped.map((item) => [item.id, item.groupId]), [['a', 'work'], ['b', 'work'], ['c', 'g0']]);
  assert.strictEqual(regrouped[1], shortcuts[1], 'entries already in their group keep their object');
  assert.deepStrictEqual(crossSurface.planShortcutReorder({ shortcuts, order: ['c', 'a', 'b'] }).map((item) => item.groupId),
    ['work', 'g0', 'work'], 'an order without groups leaves memberships alone');

  const dropped = crossSurface.planBookmarkToShortcut({
    shortcuts, record: { id: 'new', url: 'https://new.example/' }, index: 1, groupId: 'work', maxShortcuts: 10
  });
  assert.deepStrictEqual(dropped.shortcuts.map((item) => [item.id, item.groupId]),
    [['a', 'g0'], ['new', 'work'], ['b', 'work'], ['c', 'work']], 'a dropped bookmark joins the group it was dropped in');
  const movedIn = crossSurface.planBookmarkToShortcut({
    shortcuts, record: { url: 'https://c.example/' }, index: 0, groupId: 'g0', maxShortcuts: 10
  });
  assert.deepStrictEqual(movedIn.shortcuts[0], { ...shortcuts[2], groupId: 'g0' },
    'dropping an existing site moves it into the drop group');

  const groupOnly = history.createShortcutReorderRecord({
    fromOrder: ['a', 'b'], toOrder: ['a', 'b'], fromGroups: ['g0', 'work'], toGroups: ['work', 'work']
  });
  assert.ok(groupOnly, 'moving a site into the next group without changing the order is recorded');
  assert.deepStrictEqual(groupOnly.fromGroups, ['g0', 'work']);
  assert.deepStrictEqual(groupOnly.toGroups, ['work', 'work']);
  assert.strictEqual(history.createShortcutReorderRecord({
    fromOrder: ['a', 'b'], toOrder: ['a', 'b'], fromGroups: ['g0', 'work'], toGroups: ['g0', 'work']
  }), null, 'nothing moved, nothing recorded');
  assert.strictEqual(history.createShortcutReorderRecord({ fromOrder: ['a', 'b'], toOrder: ['b', 'a'] }).fromGroups, undefined);

  const stacked = crossSurface.planShortcutStack({
    shortcuts,
    sources: [{ snapshot: shortcuts[1], index: 1 }, { snapshot: shortcuts[0], index: 0 }],
    folder: { snapshot: { id: 'folder', type: 'folder' }, index: 0, groupId: 'work' }
  });
  assert.deepStrictEqual(stacked.map((item) => [item.id, item.groupId]), [['folder', 'work'], ['c', 'work']]);
  const stackRecord = history.createShortcutStackRecord({
    snapshot: { title: 'New folder', children: [{ title: 'A', url: 'https://a.example/' }, { title: 'B', url: 'https://b.example/' }] },
    sources: [{ snapshot: shortcuts[1], index: 1 }, { snapshot: shortcuts[0], index: 0 }],
    folderShortcut: { id: 'folder', index: 0, groupId: 'work' }
  });
  assert.strictEqual(stackRecord.folderShortcut.groupId, 'work');

  const groupDelete = history.createShortcutGroupDeleteRecord({
    group: { id: 'work', title: '工作' }, groupIndex: 1, targetGroupId: '', movedIds: [],
    removed: [{ snapshot: shortcuts[1], index: 1, iconDataUrl: 'data:image/png;base64,AA==' }]
  });
  assert.strictEqual(groupDelete.kind, 'shortcut-group-delete');
  assert.deepStrictEqual(groupDelete.removed[0].snapshot, shortcuts[1]);
  assert.strictEqual(history.createShortcutGroupDeleteRecord({ group: { title: 'No id' } }), null);
  assert.strictEqual(history.createShortcutGroupDeleteRecord({ group: { id: 'x' }, removed: [{}] }), null,
    'a removed site without a snapshot cannot be restored');
}

// On the page: a bookmark dragged over the shortcuts shows where it would
// land with the insertion line; over a folder shortcut the folder lights up
// instead; Escape cancels the drag and clears both.
async function testDragFeedback() {
  const newtab = await openDragPage({
    shortcuts: [{ url: 'https://one.example/', title: 'One' }, { url: 'https://two.example/', title: 'Two' }, { type: 'folder', folderId: 'design', title: 'Design' }],
    bookmarks: [{ id: 'design', title: 'Design', children: [] }, { id: '20', title: 'Start', url: 'https://start.example/' }]
  });
  const { page } = newtab;
  const grid = newtab.tile('One').parentElement;
  const line = () => [grid.getAttribute('data-insert-line-position'), grid.getAttribute('data-insert-line-motion'),
    grid.style.getPropertyValue('--x-nt-insert-line-left'), grid.style.getPropertyValue('--x-nt-insert-line-height')];
  const move = async (point) => {
    page.pointer('pointermove', point[0], point[1]);
    await page.settle(40);
  };
  await page.drag(newtab.card('20'), [newtab.shortcutSlot(1)], { release: false });
  assert.strictEqual(page.document.body.getAttribute('data-drag-source'), 'bookmark', 'the page should know a bookmark is being dragged');
  const gaps = () => ['One', 'Two', 'Design'].map((title) => newtab.tile(title).getAttribute('data-drag-gap'));
  assert.deepStrictEqual(line(), [null, null, '', ''], 'the shortcut row draws no insertion line');
  assert.deepStrictEqual(gaps(), ['before', 'after', null], 'the tiles beside the gap under the pointer lean apart instead');
  await move(newtab.shortcutSlot(2));
  assert.deepStrictEqual(gaps(), ['rest', 'before', 'after'], 'a new gap moves the lean');
  const design = newtab.tile('Design').getBoundingClientRect();
  await move([design.left + design.width / 2, design.top + design.height / 2]);
  assert.strictEqual(newtab.tile('Design').getAttribute('data-bookmark-drop-target'), 'true', 'over a folder shortcut the folder lights up');
  assert.deepStrictEqual(line(), [null, null, '', ''], 'and still no line shows');
  await move(newtab.shortcutSlot(1));
  assert.strictEqual(newtab.tile('Design').getAttribute('data-bookmark-drop-target'), null, 'leaving the folder clears its highlight');
  page.trusted(page.document.body, 'keydown', { key: 'Escape', bubbles: true, cancelable: true });
  await page.settle(200);
  assert.deepStrictEqual(line(), [null, null, '', ''], 'Escape clears the line');
  assert.strictEqual(page.document.body.getAttribute('data-drag-source'), null, 'and ends the drag');
  assert.deepStrictEqual([newtab.shortcuts(), newtab.bar()], [['One', 'Two', 'Design'], ['Design', 'Start']], 'without moving anything');
  newtab.close();
}

// Escape during a shortcut reorder puts the tiles back without saving.
async function testEscapeRestoresTheOrder() {
  const newtab = await openDragPage({
    shortcuts: [{ url: 'https://one.example/', title: 'One' }, { url: 'https://two.example/', title: 'Two' }, { url: 'https://three.example/', title: 'Three' }]
  });
  const { page } = newtab;
  const writes = page.storage.sync.writes.length;
  await page.drag(newtab.tile('One'), [[newtab.shortcutSlot(3)[0], 432]], { release: false });
  assert.deepStrictEqual(newtab.shortcuts(), ['Two', 'Three', 'One'], 'the tiles reorder while dragging');
  assert.strictEqual(page.document.body.getAttribute('data-drag-source'), 'shortcut');
  page.trusted(page.document.body, 'keydown', { key: 'Escape', bubbles: true, cancelable: true });
  await page.settle(200);
  assert.deepStrictEqual(newtab.shortcuts(), ['One', 'Two', 'Three'], 'Escape should restore the order');
  assert.strictEqual(page.storage.sync.writes.length, writes, 'and save nothing');
  page.pointer('pointerup', 10, 10);
  await page.settle(100);
  assert.deepStrictEqual(newtab.shortcuts(), ['One', 'Two', 'Three'], 'releasing afterwards changes nothing');
  newtab.close();
}

function testStylesAndCopy() {
  const css = parsePageCss('newtab.html');
  const line = css.entries.find((entry) => entry.selectors.includes('[data-insert-line-position]::after'));
  assert.ok(line && line.style.getPropertyValue('position') === 'absolute' && /^calc\(var\(--x-nt-insert-line-left/.test(line.style.getPropertyValue('left')),
    'both grids should share one attribute-driven insertion line');
  assert.strictEqual(css.rule('.x-nt-shortcuts-grid').get('position'), 'relative', 'the shortcut grid positions its line');
  const dragging = css.rule('body[data-drag-source="shortcut"] .x-nt-shortcuts-section');
  assert.deepStrictEqual([dragging.get('z-index'), dragging.get('pointer-events')], ['10001', 'none'],
    'a dragged shortcut paints above the dock and bookmarks bar without blocking hit tests');
  ['en', 'ja', 'zh_CN', 'zh_TW'].forEach((locale) => {
    const messages = JSON.parse(fs.readFileSync(path.join(repoRoot, '_locales', locale, 'messages.json'), 'utf8'));
    ['newtab_shortcuts_moved_to_bookmarks', 'newtab_shortcuts_move_to_bookmarks_failed', 'bookmarks_moved_to_shortcuts'].forEach((key) => {
      assert.ok(messages[key] && messages[key].message, `${locale} should translate ${key}`);
    });
  });
  const scripts = getPageScripts('newtab.html');
  const pageRuntimeIndex = scripts.indexOf('src/newtab/app/main.ts');
  ['src/newtab/bookmarks/bookmark-drag.ts', 'src/newtab/cross-surface-drag.ts'].forEach((helper) => {
    const helperIndex = scripts.indexOf(helper);
    assert.ok(helperIndex >= 0 && helperIndex < pageRuntimeIndex, `${helper} loads before the page runtime`);
  });
}

(async () => {
  testStylesAndCopy();
  await testDragFeedback();
  await testEscapeRestoresTheOrder();
  console.log('New tab cross-surface drag tests passed.');
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
