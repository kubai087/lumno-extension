const assert = require('assert');
const vm = require('vm');
const { runModuleInContext } = require('../helpers/module-script');

// Shortcut tiles must tint from the artwork they show, and Chrome/Google's
// generic globe must never become a host-wide theme.

const SNAPSHOT_URL = 'data:image/png;base64,c25hcHNob3Q=';
const GLOBE_URL = 'data:image/png;base64,Z2xvYmU=';
const RED = [255, 36, 66];
const GLOBE_GRAY = [95, 99, 104];
const averageBySource = new Map([
  [SNAPSHOT_URL, RED],
  [GLOBE_URL, GLOBE_GRAY]
]);

const sandbox = {
  console,
  URL,
  setTimeout,
  clearTimeout,
  Promise
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
sandbox.document = {
  body: { getAttribute: () => 'light' }
};
sandbox.Image = class {
  set src(value) {
    this._src = value;
    Promise.resolve().then(() => this.onload && this.onload());
  }
  get src() {
    return this._src;
  }
};

vm.createContext(sandbox);
runModuleInContext('src/newtab/theme/site-theme-resolver.ts', sandbox, 'LumnoNewtabSiteThemeResolver');
runModuleInContext('src/shared/favicon/favicon-theme.ts', sandbox, 'LumnoNewtabFaviconTheme');
runModuleInContext('src/domain/color.ts', sandbox, 'LumnoColor');
runModuleInContext('src/domain/favicon/brand-accents.ts', sandbox, 'LumnoBrandAccents');
runModuleInContext('tests/helpers/favicon-utils.ts', sandbox, 'LumnoFaviconUtils');

const FAVICON_UTILS = sandbox.LumnoFaviconUtils;
const NEWTAB_FAVICON_THEME = sandbox.LumnoNewtabFaviconTheme;
const COLOR = sandbox.LumnoColor;
const BRAND_ACCENTS = sandbox.LumnoBrandAccents;
const defaultTheme = NEWTAB_FAVICON_THEME.createDefaultTheme();

function createTile(url) {
  const attributes = { 'data-shortcut-url': url };
  return {
    isConnected: true,
    _xHost: 'xiaohongshu.com',
    getAttribute: (name) => (name in attributes ? attributes[name] : null),
    applied: []
  };
}

const shortcutTiles = [];
const persistedThemes = new Map();
const shortcutIconSources = new Map([['https://www.xiaohongshu.com/', SNAPSHOT_URL]]);

const resolver = sandbox.LumnoNewtabSiteThemeResolver.createSiteThemeResolver({
  searchMode: { site: null },
  FAVICON_UTILS,
  getExtensionResourceUrl: (path) => path,
  normalizeHost: BRAND_ACCENTS.normalizeHost,
  parseCssColor: COLOR.parseCssColor,
  defaultAccentColor: NEWTAB_FAVICON_THEME.defaultAccentColor,
  defaultTheme,
  getProviderHost: () => '',
  recentCards: [],
  applyRecentCardTheme: () => {},
  bookmarkCards: [],
  applyBookmarkCardTheme: () => {},
  shortcutTiles,
  applyShortcutTileTheme: (tile, theme) => tile.applied.push(theme),
  suggestionItems: [],
  setSiteSearchPrefix: () => {},
  refreshRowStyles: () => {},
  setPersistedSiteThemeEntry: (host, theme) => persistedThemes.set(host, theme),
  getPersistedSiteThemeEntry: (host) => persistedThemes.get(host) || null,
  getPageFaviconUrlResolver: () => ({ getSafeFaviconCandidateUrl: (url) => url }),
  getBrandAccentForUrl: () => null,
  extractAverageColor: (image) => averageBySource.get(image.src) || null,
  getProviderIcon: () => '',
  isHostFaviconVisitDirty: () => false,
  stableHashCode: COLOR.stableHashCode,
  getThemeSourceForSuggestion: (suggestion) => shortcutIconSources.get(suggestion && suggestion.url) || '',
  areFaviconRenderCachesReady: () => true,
  pageState: {
    faviconDataCache: new Map(),
    requestFaviconData: () => Promise.resolve(null)
  }
});

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function accentOf(theme) {
  return Array.from(theme.accentRgb).join(',');
}

(async () => {
  assert.strictEqual(FAVICON_UTILS.isPlaceholderFaviconColor(GLOBE_GRAY), true);

  // Another surface loads the generic globe for the host: it must not stick.
  const globeTheme = await resolver.getThemeForSuggestion({ type: 'shortcut', url: 'https://globe.example/' });
  assert.strictEqual(globeTheme, defaultTheme, 'shortcut without artwork falls back to the default theme');
  shortcutIconSources.set('https://globe.example/', GLOBE_URL);
  const placeholderTheme = await resolver.getThemeForSuggestion({ type: 'shortcut', url: 'https://globe.example/' });
  assert.strictEqual(placeholderTheme, defaultTheme, 'placeholder globe resolves like a missing icon');
  assert.strictEqual(resolver.themeHostCache.has('globe.example'), false, 'placeholder globe never reaches the host cache');

  // Persisted placeholder entries from older builds are ignored.
  persistedThemes.set('legacy.example', { accentRgb: GLOBE_GRAY, source: 'favicon', confidence: 'neutral' });
  assert.strictEqual(
    resolver.getImmediateThemeForSuggestion({ type: 'recent', url: 'https://legacy.example/' }),
    defaultTheme
  );

  // A gray host theme from elsewhere must not override the tile's own artwork.
  const grayHostTheme = resolver.buildThemeFromAccent([110, 110, 120], 'favicon');
  resolver.themeHostCache.set('xiaohongshu.com', grayHostTheme);
  const shortcutTheme = await resolver.getThemeForSuggestion({ type: 'shortcut', url: 'https://www.xiaohongshu.com/' });
  assert.strictEqual(accentOf(shortcutTheme), RED.join(','), 'shortcut tints from its own snapshot');
  assert.strictEqual(
    accentOf(resolver.getImmediateThemeForSuggestion({ type: 'shortcut', url: 'https://www.xiaohongshu.com/' })),
    RED.join(','),
    'first paint reuses the snapshot theme'
  );

  // Host-wide refreshes repaint a snapshot tile with its own artwork.
  const tile = createTile('https://www.xiaohongshu.com/');
  shortcutTiles.push(tile);
  resolver.themeHostCache.delete('xiaohongshu.com');
  resolver.setResolvedThemeForHost('xiaohongshu.com', resolver.buildThemeFromAccent([40, 120, 200], 'meta'));
  await flush();
  assert.strictEqual(tile.applied.length, 1);
  assert.strictEqual(accentOf(tile.applied[0]), RED.join(','), 'host refresh keeps the tile on its own artwork');

  // Tiles still waiting for a snapshot follow the host theme as before.
  const pendingTile = createTile('https://www.xiaohongshu.com/pending');
  shortcutTiles.push(pendingTile);
  const hostTheme = resolver.buildThemeFromAccent([0, 160, 90], 'meta');
  resolver.themeHostCache.delete('xiaohongshu.com');
  resolver.setResolvedThemeForHost('xiaohongshu.com', hostTheme);
  await flush();
  assert.strictEqual(pendingTile.applied[pendingTile.applied.length - 1], hostTheme);

  console.log('newtab shortcut icon theme tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
