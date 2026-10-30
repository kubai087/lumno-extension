import { describe, expect, it } from 'vitest';
import { SITE_SEARCH_CACHE_OPTIONS, setCachedIcon } from '../../domain/favicon/shortcut-favicon/persisted';
import type { CachedIconMap } from '../../domain/favicon/shortcut-favicon/types';
import { siteSearchIconCache } from '../../domain/settings/search';
import { SiteSearchIconCache } from './site-search-icon-cache';

// Site search icons are read from storage once per surface; a change to the
// stored copy replaces them at once and wins over a read still underway.
const NOW = 1_700_000_000_000;
const PAGE = 'https://example.com/';
const OTHER_PAGE = 'https://other.example/';
const ICON = 'data:image/png;base64,AA==';

function createStore(readAll: () => Promise<CachedIconMap>) {
  return { storageKey: siteSearchIconCache.key, cacheOptions: SITE_SEARCH_CACHE_OPTIONS, readAll };
}

function deferred() {
  let resolve: (value: CachedIconMap) => void = () => {};
  const promise = new Promise<CachedIconMap>((done) => { resolve = done; });
  return { promise, resolve: (value: CachedIconMap) => resolve(value) };
}

function storedIcons(page: string): CachedIconMap {
  return setCachedIcon({}, page, ICON, '', NOW, SITE_SEARCH_CACHE_OPTIONS);
}

describe('site search icon cache', () => {
  it('reads storage once and shares the read with every caller', async () => {
    let reads = 0;
    const read = deferred();
    const cache = new SiteSearchIconCache(createStore(() => { reads += 1; return read.promise; }));
    expect(cache.storageKey).toBe(siteSearchIconCache.key);
    const first = cache.load();
    expect(cache.load()).toBe(first);
    const stored = storedIcons(PAGE);
    read.resolve(stored);
    expect(await first).toBe(stored);
    expect(cache.icons).toBe(stored);
    expect(cache.loaded).toBe(true);
    expect(await cache.load()).toBe(stored);
    expect(reads).toBe(1);
  });

  it('applies a change to the stored copy at once, and an older read does not overwrite it', async () => {
    const read = deferred();
    const cache = new SiteSearchIconCache(createStore(() => read.promise), () => NOW);
    const loading = cache.load();
    const changed = cache.applyStored(storedIcons(OTHER_PAGE));
    expect(Object.keys(changed)).toEqual([OTHER_PAGE]);
    expect(cache.icons).toBe(changed);
    expect(cache.loaded).toBe(true);
    expect(await cache.load()).toBe(changed);
    read.resolve(storedIcons(PAGE));
    expect(await loading).toBe(changed);
    expect(cache.icons).toBe(changed);
  });

  it('leaves no icons for a stored value that is no cache, or for icons past their lifetime', () => {
    const cache = new SiteSearchIconCache(createStore(() => Promise.resolve({})), () => NOW);
    expect(cache.applyStored('not a cache')).toEqual({});
    expect(cache.applyStored({ [PAGE]: { dataUrl: ICON, sourceUrl: '', updatedAt: NOW - SITE_SEARCH_CACHE_OPTIONS.cacheTtlMs - 1 } })).toEqual({});
  });

  it('leaves no icons after a failed read and does not retry it on every call', async () => {
    const cache = new SiteSearchIconCache(createStore(() => Promise.reject(new Error('quota'))));
    expect(await cache.load()).toEqual({});
    expect(cache.loaded).toBe(true);
  });
});
