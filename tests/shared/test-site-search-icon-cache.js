const assert = require('assert');
const { SiteSearchIconCache } = require('../../src/shared/search/site-search-icon-cache.ts');
const shortcutFavicon = require('../helpers/shortcut-favicon.ts');
const { siteSearchIconCache } = require('../../src/domain/settings/search.ts');

// Site search icons are read from storage once per surface; a change to the
// stored copy replaces them at once and wins over a read still underway.

const STORAGE_KEY = siteSearchIconCache.key;
const CACHE_OPTIONS = shortcutFavicon.SITE_SEARCH_CACHE_OPTIONS;
const NOW = 1_700_000_000_000;
const PAGE = 'https://example.com/';
const OTHER_PAGE = 'https://other.example/';
const ICON = 'data:image/png;base64,AA==';

function createStore(readAll) {
  return { storageKey: STORAGE_KEY, cacheOptions: CACHE_OPTIONS, readAll };
}

function deferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

function storedIcons(page) {
  return shortcutFavicon.setCachedIcon({}, page, ICON, '', NOW, CACHE_OPTIONS);
}

(async () => {
  {
    let reads = 0;
    const read = deferred();
    const cache = new SiteSearchIconCache(createStore(() => { reads += 1; return read.promise; }));
    assert.strictEqual(cache.storageKey, STORAGE_KEY, 'the cache names the key its changes arrive under');
    const first = cache.load();
    assert.strictEqual(cache.load(), first, 'a second caller shares the read underway');
    const stored = storedIcons(PAGE);
    read.resolve(stored);
    assert.strictEqual(await first, stored);
    assert.strictEqual(cache.icons, stored);
    assert.strictEqual(cache.loaded, true);
    assert.strictEqual(await cache.load(), stored, 'later callers get the loaded icons');
    assert.strictEqual(reads, 1, 'storage is read once');
  }
  {
    const read = deferred();
    const cache = new SiteSearchIconCache(createStore(() => read.promise), () => NOW);
    const loading = cache.load();
    // The stored copy changes while the first read is underway.
    const changed = cache.applyStored(storedIcons(OTHER_PAGE));
    assert.deepStrictEqual(Object.keys(changed), [OTHER_PAGE]);
    assert.strictEqual(cache.icons, changed, 'the change applies at once');
    assert.strictEqual(cache.loaded, true);
    assert.strictEqual(await cache.load(), changed, 'new callers get the changed icons');
    read.resolve(storedIcons(PAGE));
    assert.strictEqual(await loading, changed, 'the older read does not overwrite the change');
    assert.strictEqual(cache.icons, changed);
  }
  {
    const cache = new SiteSearchIconCache(createStore(() => Promise.resolve({})), () => NOW);
    assert.deepStrictEqual(cache.applyStored('not a cache'), {},
      'a stored value that is no cache leaves no icons');
    assert.deepStrictEqual(
      cache.applyStored({ [PAGE]: { dataUrl: ICON, sourceUrl: '', updatedAt: NOW - CACHE_OPTIONS.cacheTtlMs - 1 } }),
      {},
      'icons past the cache lifetime are dropped'
    );
  }
  {
    const cache = new SiteSearchIconCache(createStore(() => Promise.reject(new Error('quota'))));
    assert.deepStrictEqual(await cache.load(), {}, 'a failed read leaves no icons');
    assert.strictEqual(cache.loaded, true, 'and is not retried on every call');
  }
  console.log('site search icon cache tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
