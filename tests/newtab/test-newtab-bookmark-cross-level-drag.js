const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parsePageCss } = require('../helpers/css-rules');
const { openDragPage } = require('../helpers/newtab-drag-page');
const { getPageScripts, runsBefore } = require('../helpers/runtime-scripts');

const repoRoot = path.resolve(__dirname, '..', '..');
const {
  canMoveBookmarkToLocation,
  canMoveBookmarkToFolder,
  createBookmarkMoveHistory,
  createMoveRecord,
  getMoveApiDestinationIndex,
  isFolderInsideBookmark,
  normalizeMoveDestinationIndex
} = require(path.join(repoRoot, 'src', 'newtab', 'bookmarks', 'bookmark-move-history.ts'));

const nodeMap = new Map([
  ['1', { id: '1', parentId: '0' }],
  ['design', { id: 'design', parentId: '1' }],
  ['research', { id: 'research', parentId: 'design' }],
  ['archive', { id: 'archive', parentId: '1' }],
  ['link', { id: 'link', parentId: 'design' }]
]);

assert.strictEqual(
  isFolderInsideBookmark(nodeMap, 'design', 'research'),
  true,
  'a nested folder should be recognized as a descendant of the dragged folder'
);
assert.strictEqual(
  canMoveBookmarkToFolder({
    bookmarkId: 'design',
    sourceParentId: '1',
    targetFolderId: 'research',
    nodeMap
  }),
  false,
  'a folder must not be moved into one of its descendants'
);
assert.strictEqual(
  canMoveBookmarkToFolder({
    bookmarkId: 'link',
    sourceParentId: 'design',
    targetFolderId: 'design',
    nodeMap
  }),
  false,
  'dropping on the current parent should remain a no-op'
);
assert.strictEqual(
  canMoveBookmarkToFolder({
    bookmarkId: 'link',
    sourceParentId: 'design',
    targetFolderId: 'archive',
    nodeMap
  }),
  true,
  'a bookmark should be movable to a different folder'
);
assert.strictEqual(
  canMoveBookmarkToFolder({
    bookmarkId: 'link',
    sourceParentId: 'research',
    targetFolderId: 'design',
    nodeMap
  }),
  true,
  'a nested bookmark should be movable into an ancestor folder'
);
assert.strictEqual(
  normalizeMoveDestinationIndex({
    sourceParentId: 'design',
    sourceIndex: 1,
    targetParentId: 'design',
    targetIndex: 4
  }),
  3,
  'same-parent insertion indexes should account for removing the source item first'
);
assert.strictEqual(
  getMoveApiDestinationIndex({
    sourceParentId: 'design',
    sourceIndex: 0,
    targetParentId: 'design',
    targetIndex: 2
  }),
  3,
  'Chrome should receive the original insertion boundary when moving forward within one parent'
);
assert.strictEqual(
  getMoveApiDestinationIndex({
    sourceParentId: 'design',
    sourceIndex: 1,
    targetParentId: 'design',
    targetIndex: 8
  }),
  9,
  'moving forward to the next page start should keep the bookmark at that page start after removal'
);
assert.strictEqual(
  getMoveApiDestinationIndex({
    sourceParentId: 'design',
    sourceIndex: 1,
    targetParentId: 'design',
    targetIndex: 9
  }),
  10,
  'moving forward to the first item right edge should keep the bookmark in the second page slot'
);
assert.strictEqual(
  getMoveApiDestinationIndex({
    sourceParentId: 'design',
    sourceIndex: 1,
    targetParentId: 'design',
    targetIndex: 15
  }),
  16,
  'moving forward to the last item left edge should keep the bookmark in the last page slot'
);
function moveWithinParent(items, sourceIndex, targetIndex) {
  const nextItems = items.slice();
  const movedItem = nextItems.splice(sourceIndex, 1)[0];
  const destinationIndex = sourceIndex < targetIndex
    ? targetIndex - 1
    : targetIndex;
  nextItems.splice(destinationIndex, 0, movedItem);
  return nextItems;
}
const crossPageItems = Array.from({ length: 24 }, (_value, index) => String(index));
assert.deepStrictEqual(
  moveWithinParent(crossPageItems, 20, 8).slice(8, 12),
  ['20', '8', '9', '10'],
  'dropping at the first item left edge should occupy the first page slot and push the old last item forward'
);
assert.deepStrictEqual(
  moveWithinParent(crossPageItems, 20, 9).slice(8, 12),
  ['8', '20', '9', '10'],
  'dropping at the first item right edge should occupy the second page slot and push the old last item forward'
);
assert.deepStrictEqual(
  moveWithinParent(crossPageItems, 20, 11).slice(8, 12),
  ['8', '9', '10', '20'],
  'dropping at the last item left edge should occupy the last page slot and push the old last item forward'
);
assert.deepStrictEqual(
  (() => {
    const items = ['1', '2', '3', '4'];
    const moved = items.splice(0, 1)[0];
    items.splice(normalizeMoveDestinationIndex({
      sourceParentId: 'design',
      sourceIndex: 0,
      targetParentId: 'design',
      targetIndex: 3
    }), 0, moved);
    return items;
  })(),
  ['2', '3', '1', '4'],
  'dragging 1 to the 3-4 boundary should leave it directly between 3 and 4'
);
assert.strictEqual(
  canMoveBookmarkToLocation({
    bookmarkId: 'link',
    sourceParentId: 'design',
    sourceIndex: 1,
    targetParentId: 'design',
    targetIndex: 0,
    nodeMap
  }),
  true,
  'same-folder reordering should be valid when the final index changes'
);
assert.strictEqual(
  canMoveBookmarkToLocation({
    bookmarkId: 'link',
    sourceParentId: 'design',
    sourceIndex: 1,
    targetParentId: 'design',
    targetIndex: 2,
    nodeMap
  }),
  false,
  'an insertion boundary that resolves to the current index should remain a no-op'
);

const history = createBookmarkMoveHistory({ maxEntries: 2 });
const firstMove = createMoveRecord({
  bookmarkId: 'link',
  title: 'Lumno',
  from: { parentId: 'design', index: 1 },
  to: { parentId: 'archive', index: 0 }
});
assert.strictEqual(history.push(firstMove), true);
assert.deepStrictEqual(history.peekUndo(), firstMove);
assert.strictEqual(history.peekRedo(), null);
assert.deepStrictEqual(history.commitUndo(), firstMove);
assert.deepStrictEqual(history.peekRedo(), firstMove);
assert.deepStrictEqual(history.commitRedo(), firstMove);
assert.deepStrictEqual(history.peekUndo(), firstMove);

assert.ok(
  runsBefore(getPageScripts('newtab.html'), 'src/newtab/bookmarks/bookmark-move-history.ts', 'src/newtab/app/main.ts'),
  'new tab should load bookmark move history before the main runtime'
);
assert.ok(
  runsBefore(getPageScripts('newtab.html'), 'src/newtab/dom/bookmark-drag.ts', 'src/newtab/app/main.ts'),
  'new tab should load the bookmark drag runtime before the page entry'
);
// The drag's look, read from the stylesheets.
function testStyles() {
  const css = parsePageCss('newtab.html');
  const selectors = css.selectors();
  [
    '.x-nt-bookmarks-crumb[data-bookmark-drop-target="true"]',
    '.x-nt-bookmark-card--folder[data-bookmark-drop-target="true"]',
    '.x-nt-bookmark-cascade-item--folder[data-bookmark-drop-target="true"]',
    '[data-bookmark-drag-page-target="true"]',
    '.x-nt-bookmark-card.x-nt-bookmark-card--hover:not([aria-expanded="true"])',
    '.x-nt-bookmark-cascade-menu[data-refreshing="true"] .x-nt-bookmark-cascade-level'
  ].forEach((selector) => assert.ok(selectors.some((item) => item.includes(selector)), `missing drag state ${selector}`));
  assert.ok(selectors.some((item) => item.startsWith('.x-nt-bookmark-cascade-menu[data-drag-mode="true"] .x-nt-bookmark-cascade-level')),
    'a cascade switches into drag routing mode');
  assert.ok(selectors.some((item) => item.includes('[data-bookmark-insert-position="before"]')) &&
    selectors.some((item) => item.includes('[data-bookmark-insert-position="after"]')), 'menu rows mark the insertion side');
  assert.ok(!selectors.some((item) => item.includes('.x-nt-bookmark-card[data-bookmark-insert-position]::after')),
    'grid cards use the shared insertion line, not their own');
  const folderTarget = css.rule('.x-nt-bookmark-card--folder[data-bookmark-drop-target="true"]');
  assert.ok(folderTarget.has('border-color') && folderTarget.get('box-shadow') === 'none', 'folder targets keep a crisp edge');
  ['a', 'b'].forEach((variant) => {
    const frames = css.keyframes(`_x_nt_insert_line_extend_${variant}_2026_unique_`);
    assert.ok(frames, `the insertion line extends with keyframes ${variant}`);
    assert.deepStrictEqual([frames['0%'].getPropertyValue('transform'), frames['100%'].getPropertyValue('transform')], ['scaleY(0)', 'scaleY(1)']);
  });
  const topbarTarget = css.entries.find((entry) => entry.selectors.some((item) => item.startsWith('.x-nt-bookmarks-topbar') &&
    item.endsWith('.x-nt-bookmark-card--folder[data-bookmark-drop-target="true"]')));
  assert.strictEqual(topbarTarget && topbarTarget.style.getPropertyValue('background').trim(), 'var(--x-nt-bookmarks-topbar-folder-hover)',
    'bar folders keep a visible background while accepting a bookmark');
  const indicators = css.entries.map((entry) => entry.style.getPropertyValue('--x-nt-insert-indicator').trim()).filter(Boolean);
  assert.ok(indicators.includes('#7a8491') && indicators.includes('#a8b0bc'), 'insertion lines are a neutral gray in both themes');
  assert.ok(!css.entries.some((entry) => entry.selectors.some((item) => item.includes('data-bookmark-insert-position')) &&
    /#2563eb/i.test(entry.style.getPropertyValue('background'))), 'not blue');
  assert.strictEqual(css.rule('.x-nt-bookmark-cascade-drag-preview').get('z-index'), '2147483645', 'a menu row preview floats in its own layer');
  assert.strictEqual(css.rule('.x-nt-bookmark-card[data-bookmark-dragging="true"]:not(.x-nt-bookmark-card-drag-preview)').get('opacity'), '0.36',
    'the dragged card leaves a translucent placeholder');
  assert.strictEqual(css.rule('.x-nt-bookmark-cascade-item[data-bookmark-dragging="true"]:not(.x-nt-bookmark-cascade-drag-preview)').get('opacity'), '0.38');
  const copyTrigger = css.entries.find((entry) => entry.selectors.some((item) => item.includes('.x-nt-bookmark-cascade-row:has(> .x-nt-bookmark-cascade-item[data-bookmark-dragging="true"])') &&
    item.endsWith('> .x-nt-bookmark-cascade-copy-trigger')));
  assert.deepStrictEqual(copyTrigger && [copyTrigger.style.getPropertyValue('opacity'), copyTrigger.style.getPropertyValue('pointer-events')], ['0', 'none'],
    'a dragged menu row hides its copy button');
}

// On the page: dragging a bookmark into a folder or to another place in the
// grid moves it, marks the source and the target while it happens, and can
// be undone. A press without a drag stays a click.
async function testDraggingBookmarks() {
  const newtab = await openDragPage({
    bookmarks: [
      { id: 'link', title: 'Link', url: 'https://link.example/' },
      { id: 'archive', title: 'Archive', children: [] },
      { id: 'other', title: 'Other', url: 'https://other.example/' },
      { id: 'last', title: 'Last', url: 'https://last.example/' }
    ]
  });
  const { page } = newtab;
  const archive = newtab.card('archive').getBoundingClientRect();
  await page.drag(newtab.card('link'), [[archive.left + archive.width / 2, archive.top + archive.height / 2]], { release: false });
  assert.strictEqual(page.document.body.getAttribute('data-drag-source'), 'bookmark', 'the page holds a grabbing state while dragging');
  assert.strictEqual(newtab.card('link').getAttribute('data-bookmark-dragging'), 'true', 'the dragged card stays as a placeholder');
  assert.ok(page.document.querySelector('.x-nt-bookmark-card-drag-preview'), 'with a floating preview under the pointer');
  assert.strictEqual(newtab.card('archive').getAttribute('data-bookmark-drop-target'), 'true', 'the folder under the pointer accepts it');
  page.pointer('pointerup', archive.left + archive.width / 2, archive.top + archive.height / 2);
  await page.settle(300);
  assert.deepStrictEqual(newtab.bar(), ['Archive', 'Other', 'Last'], 'dropping on a folder moves the bookmark into it');
  assert.deepStrictEqual(newtab.node('archive').children.map((node) => node.title), ['Link']);
  assert.strictEqual(page.document.body.getAttribute('data-drag-source'), null);
  assert.strictEqual(page.document.querySelector('.x-nt-bookmark-card-drag-preview'), null, 'and clears the drag visuals');
  await newtab.undo();
  assert.deepStrictEqual(newtab.bar(), ['Link', 'Archive', 'Other', 'Last'], 'undo should put it back');

  await newtab.dragTo(newtab.card('link'), newtab.bookmarkSlot(4));
  assert.deepStrictEqual(newtab.bar(), ['Archive', 'Other', 'Last', 'Link'], 'the end of the row moves it last, counting its own removal once');
  await newtab.undo();
  assert.deepStrictEqual(newtab.bar(), ['Link', 'Archive', 'Other', 'Last']);
  await newtab.redo();
  assert.deepStrictEqual(newtab.bar(), ['Archive', 'Other', 'Last', 'Link']);

  const before = page.created.length + page.messages.filter((message) => message.action === 'createTab').length;
  const card = newtab.card('other');
  const box = card.getBoundingClientRect();
  page.pointer('pointerdown', box.left + 10, box.top + 10, card);
  page.pointer('pointerup', box.left + 10, box.top + 10, card);
  card.dispatchEvent(new page.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, clientX: box.left + 10, clientY: box.top + 10 }));
  await page.settle(150);
  assert.ok(page.created.length + page.messages.filter((message) => message.action === 'createTab').length > before ||
    page.updated.some((update) => update.properties.url === 'https://other.example/'), 'a press without a drag opens the bookmark');
  newtab.close();
}

['en', 'zh_CN', 'zh_TW', 'ja'].forEach((locale) => {
  const messages = JSON.parse(fs.readFileSync(
    path.join(repoRoot, '_locales', locale, 'messages.json'),
    'utf8'
  ));
  ['bookmarks_move_success', 'bookmarks_move_undone', 'bookmarks_move_redone', 'bookmarks_move_failed']
    .forEach((key) => assert.ok(messages[key] && messages[key].message, `${locale} should include ${key}`));
});


(async () => {
  testStyles();
  await testDraggingBookmarks();
  console.log('New tab cross-level bookmark drag tests passed.');
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
