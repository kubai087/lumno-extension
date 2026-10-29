// A shortcut drag moves React-rendered tiles by hand, so renders asked for
// while it runs (favicons resolving, storage changes) must wait and run once
// after the drag ends.
const assert = require('assert');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
let dragActive = false;
let renders = 0;
globalThis.__lumnoTestModuleStubs = {
  'src/newtab/react/shortcuts.tsx': {
    createShortcutsView: () => ({
      render: () => { renders += 1; },
      getAddButton: () => null
    })
  }
};
const NEWTAB_SHORTCUTS_STORE = require(path.join(repoRoot, 'tests/helpers/shortcuts-store.ts'));
const LumnoNewtabShortcutsController = require(path.join(repoRoot, 'src/newtab/shortcuts/shortcuts-controller.ts'));

global.document = { body: { getAttribute: () => '1' } };
global.window = global;

function createElementStub() {
  return { setAttribute() {}, addEventListener() {}, getAttribute: () => null };
}

// The page's shortcut list.
const shortcutList = {
  items: [],
  icons: {},
  replaceItems(next) { this.items = next; },
  replaceIcons(next) { this.icons = next; }
};
const noop = () => {};
const controller = LumnoNewtabShortcutsController.createShortcutsController({
  NEWTAB_SHORTCUTS_STORE,
  NEWTAB_SHORTCUT_ICON_PLATE: require(path.join(repoRoot, 'src/newtab/shortcuts/shortcut-icon-plate.ts')),
  // A shortcut drag runs while `dragActive` is set.
  dragSessions: { get shortcutDragging() { return dragActive; } },
  shortcutFolderRuntime: { visibleItems: (items) => items, flush: () => Promise.resolve() },
  bookmarksRuntime: { getNodeMap: () => new Map(), getSnapshot: () => ({ ready: true, nodeMap: new Map() }) },
  pageStructureRuntime: { shortcut: { section: createElementStub(), grid: createElementStub() } },
  locale: { store: { subscribe: () => () => {} } },
  shortcutFavicons: {},
  t: (key, fallback) => fallback,
  formatMessage: (key, fallback) => fallback,
  hideShortcutTooltip: noop,
  closeShortcutContextMenu: noop,
  syncOpenBookmarkCascadeAnchorVisual: noop,
  applyNewtabShortcutsVisibility: noop,
  updateShortcutLanguageStrings: noop,
  updateBookmarkSectionPosition: noop,
  applyNewtabShortcutDockMagnification: noop,
  scheduleWallpaperAdaptiveToneUpdate: noop,
  shortcutList,
  // Only followed here: no setting changes in these tests.
  settings: { subscribe: () => () => {} }
});

controller.createShortcutsSection();
const afterSetup = renders;

controller.renderShortcuts();
assert.strictEqual(renders, afterSetup + 1, 'renders right away while no drag runs');

dragActive = true;
controller.renderShortcuts();
controller.renderShortcuts();
assert.strictEqual(renders, afterSetup + 1, 'renders wait while a shortcut drag runs');

controller.flushDeferredShortcutRender();
assert.strictEqual(renders, afterSetup + 1, 'a flush during the drag still waits');

dragActive = false;
controller.flushDeferredShortcutRender();
assert.strictEqual(renders, afterSetup + 2, 'the held renders run once after the drag');

controller.flushDeferredShortcutRender();
assert.strictEqual(renders, afterSetup + 2, 'nothing is left to flush afterwards');

dragActive = true;
controller.renderShortcuts();
dragActive = false;
controller.renderShortcuts();
controller.flushDeferredShortcutRender();
assert.strictEqual(renders, afterSetup + 3, 'a render after the drag clears the held one');

console.log('newtab shortcut render deferral tests passed');
