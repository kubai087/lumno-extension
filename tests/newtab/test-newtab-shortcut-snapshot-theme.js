// A tile tints itself when it mounts. When its icon snapshot arrives only
// afterwards (first load after picking an icon service), the tiles are told,
// so the one showing that page works out its tint again from the snapshot.
const assert = require('assert');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const FAVICON_UTILS = require(path.join(repoRoot, 'tests/helpers/favicon-utils.ts'));
const { createShortcutFavicons } = require(path.join(repoRoot, 'src/newtab/shortcuts/shortcut-favicons.ts'));
const { shortcutIconEvents } = require(path.join(repoRoot, 'src/newtab/shortcuts/shortcut-icon-events.ts'));
const { png } = require('../helpers/favicon-acquisition');

global.window = global;
// The background answers each icon request with the snapshot.
global.chrome = {
  runtime: {
    sendMessage: (message, callback) => {
      callback({ data: snapshot, sourceUrl: FAVICON_UTILS.getGstaticFaviconUrl(message.pageUrl) });
    }
  }
};

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
const favicons = createShortcutFavicons({
  shortcutList,
  faviconCacheRuntime: { ensureCachesReady: () => Promise.resolve() },
  getPersistedFaviconDataEntry: () => null,
  getPageFaviconUrlResolver: () => ({ getShortcutFaviconFetchCandidates: () => [{ kind: 'proxy' }] }),
  shortcutFaviconStore: { mergeAll: (entries) => Promise.resolve(entries) },
  // Only followed here: no setting changes in these tests.
  settings: { subscribe: () => () => {} }
});

(async () => {
  assert.strictEqual(favicons.getShortcutFaviconDataUrl(pageUrl), '', 'no snapshot before the fetch');

  assert.strictEqual(await favicons.resolveShortcutFaviconDataUrl(pageUrl), snapshot);
  assert.strictEqual(favicons.getShortcutFaviconDataUrl(pageUrl), snapshot,
    'a site-wide service snapshot counts for a page on that site');
  assert.deepStrictEqual(saved, [pageUrl], 'the tiles are told which page has a new snapshot');

  assert.strictEqual(await favicons.resolveShortcutFaviconDataUrl(pageUrl), snapshot);
  assert.deepStrictEqual(saved, [pageUrl], 'an existing snapshot leaves the tint alone');

  console.log('newtab shortcut snapshot theme tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
