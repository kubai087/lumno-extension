import { describe, expect, it } from 'vitest';
import { isSearchLikelyBrandProductQuery } from './navigation-signals';
import { buildSearchQueryContext } from './selection-stats';

describe('navigation signals', () => {
  it("reads a two-word query as a brand product, but not a three-word one", () => {
    expect(isSearchLikelyBrandProductQuery(buildSearchQueryContext('notion calendar')), 'a two-word query should be recognized as a brand-product query').toBe(true);
    expect(isSearchLikelyBrandProductQuery(buildSearchQueryContext('notion calendar sync')), 'a three-word query should not be treated as a brand-product query').toBe(false);
  });

});
