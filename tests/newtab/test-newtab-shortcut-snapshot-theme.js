// A tile tints itself when it mounts. When its icon snapshot arrives only
// afterwards (first load after picking an icon service), the tint must be
// worked out again from that snapshot rather than keep the default one.
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
const { png } = require('../helpers/favicon-acquisition');

global.document = { body: { getAttribute: () => '1' } };
global.window = global;

function createElementStub() {
  return { setAttribute() {}, addEventListener() {}, getAttribute: () => null };
}

function createTile(attributes) {
  return {
    isConnected: true,
    _xHost: 'example.com',
    getAttribute: (name) => (name in attributes ? attributes[name] : null)
  };
}

const pageUrl = 'https://example.com/docs/';
const otherUrl = 'https://other.example.com/';
const snapshot = `data:image/png;base64,${png(64, 7).toString('base64')}`;
const pageState = {
  newtabShortcuts: [
    { id: 'a', url: pageUrl, title: 'Docs', iconSource: 'service' },
    { id: 'b', url: otherUrl, title: 'Other' }
  ],
  newtabShortcutFavicons: {},
  shortcutFaviconPendingCacheEntries: {},
  shortcutFaviconPolicyRevision: 0,
  shortcutGrid: null,
  shortcutSection: null,
  addShortcutButton: null
};
const shortcutTiles = [
  createTile({ 'data-shortcut-url': pageUrl }),
  createTile({ 'data-shortcut-url': pageUrl, 'data-shortcut-custom-icon': 'true' }),
  createTile({ 'data-shortcut-url': otherUrl })
];
const queued = [];
const applied = [];
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
  shortcutTiles,
  queueThemeForTarget: (target, suggestion, applyTheme, options) => {
    queued.push({ target, suggestion, options });
    applyTheme({ accent: 'orange' });
  },
  applyShortcutTileTheme: (tile, theme, host) => applied.push({ tile, theme, host }),
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
  pageState
});

(async () => {
  controller.createShortcutsSection();
  assert.strictEqual(controller.getShortcutFaviconDataUrl(pageUrl), '', 'no snapshot before the fetch');

  assert.strictEqual(await viewOptions.resolveShortcutFaviconDataUrl(pageUrl), snapshot);
  assert.strictEqual(controller.getShortcutFaviconDataUrl(pageUrl), snapshot,
    'a site-wide service snapshot counts for a page on that site');
  assert.deepStrictEqual(queued.map((entry) => entry.target), [shortcutTiles[0]],
    'only the tile showing the new snapshot is tinted again, not custom icons or other sites');
  assert.deepStrictEqual(queued[0].suggestion, { type: 'shortcut', url: pageUrl, title: '', customIconDataUrl: '' });
  assert.strictEqual(queued[0].options.priority, 0);
  assert.strictEqual(applied.length, 1);
  assert.strictEqual(applied[0].tile._xTheme.accent, 'orange');
  assert.strictEqual(applied[0].host, 'example.com');

  queued.length = 0;
  assert.strictEqual(await viewOptions.resolveShortcutFaviconDataUrl(pageUrl), snapshot);
  assert.strictEqual(queued.length, 0, 'an existing snapshot leaves the tint alone');

  console.log('newtab shortcut snapshot theme tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
