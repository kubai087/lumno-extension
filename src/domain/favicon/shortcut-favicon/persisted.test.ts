import { describe, expect, it } from 'vitest';
import { SITE_SEARCH_CACHE_OPTIONS, getCachedIconDataUrl, normalizeCacheMap, retainCachedIcons, setCachedIcon } from './persisted';

const NOW = 1_800_000_000_000;
const DATA_URL = 'data:image/png;base64,aGlnaC1yZXM=';
const DAY = 1000 * 60 * 60 * 24;

describe('saved shortcut icons', () => {
  it('finds an icon by its page without the fragment, and drops icons of other pages', () => {
    const cache = setCachedIcon({}, 'https://example.com/docs#section', DATA_URL, 'https://example.com/icon-192.png', NOW);
    expect(getCachedIconDataUrl(cache, 'https://example.com/docs', NOW)).toBe(DATA_URL);
    expect(retainCachedIcons(cache, ['https://other.example/'], NOW)).toEqual({});
  });

  it('keeps every shortcut snapshot for years without refetching', () => {
    const fiveYearsAgo = NOW - DAY * 365 * 5;
    let cache = {};
    for (let index = 0; index < 60; index += 1) {
      cache = setCachedIcon(cache, `https://shortcut-${index}.example/`, DATA_URL, '', fiveYearsAgo + index);
    }
    expect(Object.keys(normalizeCacheMap(cache, NOW))).toHaveLength(60);
    expect(getCachedIconDataUrl(cache, 'https://shortcut-0.example/', NOW)).toBe(DATA_URL);
  });

  it('still expires old entries under an explicit finite lifetime', () => {
    const cache = setCachedIcon({}, 'https://shortcut.example/', DATA_URL, '', NOW - DAY);
    expect(Object.keys(normalizeCacheMap(cache, NOW, { cacheTtlMs: 1000 }))).toHaveLength(0);
  });

  it('gives the site search providers their own entry cap and a long lifetime', () => {
    let cache = {};
    for (let index = 0; index < 30; index += 1) {
      cache = setCachedIcon(cache, `https://provider-${index}.example/`, DATA_URL, `https://provider-${index}.example/icon-192.png`,
        NOW - index, SITE_SEARCH_CACHE_OPTIONS);
    }
    expect(Object.keys(cache)).toHaveLength(30);
    const fiveMonthsAgo = NOW - DAY * 150;
    const longLived = setCachedIcon({}, 'https://long-lived.example/', DATA_URL, 'https://long-lived.example/icon.svg', fiveMonthsAgo,
      SITE_SEARCH_CACHE_OPTIONS);
    expect(getCachedIconDataUrl(longLived, 'https://long-lived.example/', NOW, SITE_SEARCH_CACHE_OPTIONS)).toBe(DATA_URL);
  });
});
