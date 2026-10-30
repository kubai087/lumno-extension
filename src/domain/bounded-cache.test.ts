import { describe, expect, it } from 'vitest';
import { setBoundedCacheEntry } from './bounded-cache';

describe('bounded cache', () => {
  it('moves a rewritten entry to the newest place and drops the oldest past the limit', () => {
    const cache = new Map<string, number>();
    setBoundedCacheEntry(cache, 'a', 1, 2);
    setBoundedCacheEntry(cache, 'b', 2, 2);
    setBoundedCacheEntry(cache, 'a', 3, 2);
    setBoundedCacheEntry(cache, 'c', 4, 2);

    expect(Array.from(cache)).toEqual([['a', 3], ['c', 4]]);
  });
});
