const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const historyApi = require(path.join(repoRoot, 'src/shared/search-input-history.js'));

function createStorage(initialValue) {
  const state = {
    [historyApi.STORAGE_KEY]: initialValue
  };
  return {
    state,
    get(keys, callback) {
      const result = {};
      keys.forEach((key) => {
        result[key] = state[key];
      });
      callback(result);
    },
    set(payload) {
      Object.assign(state, payload);
    }
  };
}

async function testHistoryNavigationRestoresDraft() {
  const storage = createStorage(['first query', 'second query']);
  const controller = historyApi.createSearchInputHistoryController({
    storageArea: storage
  });
  await controller.load();

  assert.deepStrictEqual(
    controller.move('previous', 'unfinished draft'),
    { handled: true, value: 'second query' }
  );
  assert.deepStrictEqual(
    controller.move('previous', 'second query'),
    { handled: true, value: 'first query' }
  );
  assert.deepStrictEqual(
    controller.move('next', 'first query'),
    { handled: true, value: 'second query' }
  );
  assert.deepStrictEqual(
    controller.move('next', 'second query'),
    { handled: true, value: 'unfinished draft' }
  );
}

async function testRecordDeduplicatesAndPersists() {
  const storage = createStorage(['one', 'two', 'one']);
  const controller = historyApi.createSearchInputHistoryController({
    maxEntries: 3,
    storageArea: storage
  });
  await controller.load();

  assert.deepStrictEqual(controller.getEntries(), ['two', 'one']);
  assert.strictEqual(controller.record('  three  '), true);
  assert.strictEqual(controller.record('two'), true);
  assert.deepStrictEqual(controller.getEntries(), ['one', 'three', 'two']);
  assert.deepStrictEqual(
    storage.state[historyApi.STORAGE_KEY],
    ['one', 'three', 'two']
  );
}

function testShortcutDetection() {
  assert.strictEqual(
    historyApi.getShortcutDirection({
      key: 'ArrowUp',
      code: 'ArrowUp',
      ctrlKey: false,
      altKey: true,
      metaKey: false,
      shiftKey: false
    }),
    'previous'
  );
  assert.strictEqual(
    historyApi.getShortcutDirection({
      key: 'ArrowDown',
      code: 'ArrowDown',
      ctrlKey: false,
      altKey: true,
      metaKey: false,
      shiftKey: false
    }),
    'next'
  );
  assert.strictEqual(
    historyApi.getShortcutDirection({
      key: 'ArrowUp',
      code: 'ArrowUp',
      ctrlKey: false,
      altKey: true,
      metaKey: false,
      shiftKey: true
    }),
    ''
  );
}

function testSurfaceIntegrationContract() {
  const newtabHtml = fs.readFileSync(
    path.join(repoRoot, 'src/newtab/newtab.html'),
    'utf8'
  );
  const backgroundSource = fs.readFileSync(
    path.join(repoRoot, 'src/background/background.js'),
    'utf8'
  );
  const newtabSource = fs.readFileSync(
    path.join(repoRoot, 'src/newtab/newtab.js'),
    'utf8'
  );
  const overlaySource = fs.readFileSync(
    path.join(repoRoot, 'src/overlay/search-panel.js'),
    'utf8'
  );
  const shortcutReferenceSource = fs.readFileSync(
    path.join(repoRoot, 'src/shared/shortcut-reference.js'),
    'utf8'
  );

  assert.ok(
    newtabHtml.includes('<script src="../shared/search-input-history.js"></script>'),
    'New Tab should load the shared input history helper'
  );
  assert.ok(
    backgroundSource.includes("'src/shared/search-input-history.js'"),
    'overlay injection should load the shared input history helper'
  );
  assert.ok(
    newtabSource.includes('SEARCH_INPUT_HISTORY.getShortcutDirection(event)'),
    'New Tab should handle the input history shortcut'
  );
  assert.ok(
    overlaySource.includes('SEARCH_INPUT_HISTORY.getShortcutDirection(e)'),
    'overlay should handle the input history shortcut'
  );
  assert.ok(
    shortcutReferenceSource.includes("shortcut: 'Alt+ArrowUp / Alt+ArrowDown'"),
    'General settings should list the input history shortcut'
  );
  assert.ok(
    overlaySource.includes("normalizedKey === 'n' || code === 'KeyN'") &&
      overlaySource.includes("normalizedKey === 'p' || code === 'KeyP'"),
    'overlay should map Ctrl+N/Ctrl+P to suggestion navigation on macOS'
  );
  assert.ok(
    newtabSource.includes("normalizedKey === 'n' || code === 'KeyN'") &&
      newtabSource.includes("normalizedKey === 'p' || code === 'KeyP'"),
    'New Tab should map Ctrl+N/Ctrl+P to suggestion navigation on macOS'
  );
  assert.ok(
    shortcutReferenceSource.includes("mac: 'ArrowUp / ArrowDown / Ctrl+P / Ctrl+N'"),
    'General settings should list Ctrl+P/Ctrl+N as macOS alternatives for suggestion navigation'
  );
}

(async () => {
  await testHistoryNavigationRestoresDraft();
  await testRecordDeduplicatesAndPersists();
  testShortcutDetection();
  testSurfaceIntegrationContract();
  console.log('search input history tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
