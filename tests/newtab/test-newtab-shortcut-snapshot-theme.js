// A tile tints itself when it mounts. When its icon snapshot arrives only
// afterwards (first load after picking an icon service), the tiles are told,
// so the one showing that page works out its tint again from the snapshot.
const assert = require('assert');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
let viewOptions = null;
globalThis.__lumnoTestModuleStubs = {
  'src/newtab/react/shortcuts.tsx': {
    createShortcutsView: (options) => {
      viewOptions = options;
      return { render() {}, getAddButton: () => null };
    }
  }
};
const NEWTAB_SHORTCUTS_STORE = require(path.join(repoRoot, 'tests/helpers/shortcuts-store.ts'));
const SHORTCUT_FAVICON = require(path.join(repoRoot, 'tests/helpers/shortcut-favicon.ts'));
const FAVICON_UTILS = require(path.join(repoRoot, 'tests/helpers/favicon-utils.ts'));
const LumnoNewtabShortcutsController = require(path.join(repoRoot, 'src/newtab/shortcuts/shortcuts-controller.ts'));
const { shortcutIconEvents } = require(path.join(repoRoot, 'src/newtab/shortcuts/shortcut-icon-events.ts'));
const { png } = require('../helpers/favicon-acquisition');

global.document = { body: { getAttribute: () => '1' } };
global.window = global;

function createElementStub() {
  return { setAttribute() {}, addEventListener() {}, getAttribute: () => null };
}

const pageUrl = 'https://example.com/docs/';
const otherUrl = 'https://other.example.com/';
const snapshot = `data:image/png;base64,${png(64, 7).toString('base64')}`;
// The page's shortcut list.
const shortcutList = {
  items: [
    { id: 'a', url: pageUrl, title: 'Docs', iconSource: 'service' },
    { id: 'b', url: otherUrl, title: 'Other' }
  ],
  icons: {},
  replaceItems(next) { this.items = next; },
  replaceIcons(next) { this.icons = next; }
};
const saved = [];
shortcutIconEvents.on('snapshotSaved', (event) => saved.push(event.pageUrl));
const noop = () => {};
const controller = LumnoNewtabShortcutsController.createShortcutsController({
  NEWTAB_SHORTCUTS_STORE,
  NEWTAB_SHORTCUT_ICON_PLATE: require(path.join(repoRoot, 'src/newtab/shortcuts/shortcut-icon-plate.ts')),
  SHORTCUT_FAVICON,
  FAVICON_UTILS,
  isShortcutDragActive: () => false,
  shortcutFolderRuntime: { visibleItems: (items) => items, flush: () => Promise.resolve() },
  bookmarksRuntime: { getNodeMap: () => new Map() },
  pageStructureRuntime: { shortcut: { section: createElementStub(), grid: createElementStub() } },
  shortcutTiles: [],
  queueThemeForTarget: noop,
  getTileThemeOnSiteChange: noop,
  applyShortcutTileTheme: noop,
  faviconCacheRuntime: { ensureCachesReady: () => Promise.resolve() },
  getPersistedFaviconDataEntry: () => null,
  getPageFaviconUrlResolver: () => ({ getShortcutFaviconFetchCandidates: () => [{ kind: 'proxy' }] }),
  sendRuntimeMessage: (message, callback) => {
    callback({ data: snapshot, sourceUrl: FAVICON_UTILS.getGstaticFaviconUrl(message.pageUrl) });
    return true;
  },
  shortcutFaviconStore: { mergeAll: (entries) => Promise.resolve(entries) },
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
  settings: { subscribe: () => () => {} },
  pageState: {}
});

(async () => {
  controller.createShortcutsSection();
  assert.strictEqual(controller.getShortcutFaviconDataUrl(pageUrl), '', 'no snapshot before the fetch');

  assert.strictEqual(await viewOptions.resolveShortcutFaviconDataUrl(pageUrl), snapshot);
  assert.strictEqual(controller.getShortcutFaviconDataUrl(pageUrl), snapshot,
    'a site-wide service snapshot counts for a page on that site');
  assert.deepStrictEqual(saved, [pageUrl], 'the tiles are told which page has a new snapshot');

  assert.strictEqual(await viewOptions.resolveShortcutFaviconDataUrl(pageUrl), snapshot);
  assert.deepStrictEqual(saved, [pageUrl], 'an existing snapshot leaves the tint alone');

  console.log('newtab shortcut snapshot theme tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
