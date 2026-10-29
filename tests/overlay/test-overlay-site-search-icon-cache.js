const assert = require('assert');
const fs = require('fs');
const shortcutFavicon = require('../helpers/shortcut-favicon.ts');
const searchUtils = require('../helpers/search-utils.ts');
const { parseCss } = require('../helpers/css-rules');
const { getInjectedScripts, runsBefore } = require('../helpers/runtime-scripts');
const { siteSearchIconCache } = require('../../src/domain/settings/search.ts');

// The bundled provider tiles and the shared icon cache rules. How the worker
// warms icons is covered by tests/background/test-background-site-search-icons.js,
// and how the overlay shows them by test-overlay-site-search-icons.js.

const siteSearchSource = fs.readFileSync('assets/data/site-search.json', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

assert.ok(
  runsBefore(getInjectedScripts('overlay'), 'src/domain/favicon/shortcut-favicon/bundled-icons.ts', 'src/overlay/app/main.ts'),
  'the injected overlay should load the shared high-resolution shortcut favicon runtime first'
);

const webAccessibleResources = (manifest.web_accessible_resources || [])
  .flatMap((entry) => entry && Array.isArray(entry.resources) ? entry.resources : []);
const bundledProviderIconResourcePatterns = [
  'assets/images/site-search/*.png'
];
assert.ok(
  bundledProviderIconResourcePatterns.every((pattern) => webAccessibleResources.includes(pattern)),
  'all bundled provider artwork should remain web-accessible without per-icon manifest maintenance'
);
const siteSearchProviders = JSON.parse(siteSearchSource).items;
const expectedBundledProviderIcons = Object.freeze(Object.fromEntries(
  siteSearchProviders.map((provider) => [
    provider.key,
    `assets/images/site-search/tile-${provider.key}.png`
  ])
));
assert.deepStrictEqual(
  shortcutFavicon.SITE_SEARCH_PINNED_ICON_ASSETS,
  expectedBundledProviderIcons,
  'every built-in provider should resolve to its self-contained local tile'
);
assert.deepStrictEqual(
  siteSearchProviders.map((provider) => provider.key),
  Object.keys(expectedBundledProviderIcons),
  'the bundled provider icon map should cover the complete built-in catalog in order'
);
siteSearchProviders.forEach((provider) => {
  assert.ok(!provider.icon && !provider.iconUrl,
    `${provider.key} should not retain a remote icon fallback`);
});
searchUtils.getDefaultSiteSearchProviders().forEach((provider) => {
  assert.ok(!provider.icon && !provider.iconUrl,
    `${provider.key} fallback should not retain a remote icon URL`);
});
new Set(Object.values(expectedBundledProviderIcons)).forEach((resourcePath) => {
  assert.ok(fs.existsSync(resourcePath), `${resourcePath} should be bundled`);
  assert.match(
    resourcePath,
    /^assets\/images\/site-search\/tile-[a-z0-9]+\.png$/,
    `${resourcePath} should be a generated local PNG tile`
  );
  assert.ok(
    webAccessibleResources.includes(resourcePath) ||
      bundledProviderIconResourcePatterns.some((pattern) => webAccessibleResources.includes(pattern)),
    `${resourcePath} should be web-accessible`
  );
  const pngHeader = fs.readFileSync(resourcePath).subarray(0, 33);
  assert.deepStrictEqual(
    [...pngHeader.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
    `${resourcePath} should be a valid PNG asset`
  );
  assert.strictEqual(pngHeader.readUInt32BE(16), 144, `${resourcePath} should be 144px wide`);
  assert.strictEqual(pngHeader.readUInt32BE(20), 144, `${resourcePath} should be 144px high`);
  assert.strictEqual(pngHeader[25], 6, `${resourcePath} should preserve RGBA rounded corners`);
});

const googleProvider = {
  key: 'gg',
  template: 'https://www.google.com/search?q={query}',
  iconUrl: shortcutFavicon.GOOGLE_BRAND_ICON_URL
};
const googlePageUrl = shortcutFavicon.getSiteSearchProviderPageUrl(googleProvider);
const now = Date.now();
assert.strictEqual(
  shortcutFavicon.getSiteSearchProviderIcon({
    [shortcutFavicon.getCacheKey(googlePageUrl)]: {
      dataUrl: 'data:image/png;base64,AA==',
      sourceUrl: 'https://www.google.com/favicon.ico',
      updatedAt: now
    }
  }, googleProvider, now, shortcutFavicon.SITE_SEARCH_CACHE_OPTIONS),
  shortcutFavicon.GOOGLE_BRAND_ICON_URL,
  'the pinned Google brand icon should bypass stale page-discovery cache entries'
);

assert.strictEqual(
  shortcutFavicon.shouldHydrateSiteSearchProviderIcon(
    'chrome-extension://lumno/assets/images/site-search/tile-bi.png'
  ),
  false,
  'the shared Bing tile should bypass asynchronous favicon hydration on both surfaces'
);

const inputModeCss = parseCss(fs.readFileSync('src/shared/search/search-input.css', 'utf8'));
const currentSlot = inputModeCss.rule('.x-lumno-search-input-mode__prefix [data-search-input-mode-current]');
assert.deepStrictEqual([currentSlot.get('overflow'), currentSlot.priority('overflow')], ['hidden', 'important'],
  'the current-mode slot should clip only its own horizontal expansion');
assert.deepStrictEqual([currentSlot.get('display'), currentSlot.priority('display')], ['none', 'important'],
  'the current-mode label should stay hidden until revealed');
const revealed = inputModeCss.entries.find((entry) => entry.selectors.some((selector) =>
  selector.includes('[data-current-visible="true"]') && selector.endsWith('[data-search-input-mode-current]')));
assert.ok(revealed, 'the current-mode label should have a dedicated reveal state');
assert.deepStrictEqual([revealed.style.getPropertyValue('display'), revealed.style.getPropertyPriority('display')], ['inline-flex', 'important']);

(async () => {
  // Provider icons should warm as soon as the background runtime starts: the
  // warmup reads the canonical provider icon cache before fetching icons.
  const { loadBackground, wait } = require('../helpers/background-harness');
  const harness = loadBackground({
    fetch: async (url) => {
      if (String(url).endsWith('assets/data/site-search.json')) {
        return { ok: true, json: async () => JSON.parse(siteSearchSource) };
      }
      throw new Error('offline');
    }
  });
  await wait(80);
  const readKeys = harness.storage.local.reads.flatMap((keys) => (Array.isArray(keys) ? keys : [keys]));
  assert.ok(
    readKeys.includes(siteSearchIconCache.key),
    'provider icons should warm as soon as the background runtime starts'
  );
  console.log('overlay site-search icon cache tests passed');
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
