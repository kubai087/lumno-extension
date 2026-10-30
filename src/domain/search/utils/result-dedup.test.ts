import { describe, expect, it } from 'vitest';
import { buildSearchDedupEntryKey, buildSearchDedupUrlKey } from './result-dedup';

describe('search result dedup', () => {
  it("drops tracking parameters and hashes from the dedup URL", () => {
    const dedupUrl = buildSearchDedupUrlKey('https://www.example.com/docs/?utm_source=x&ref=abc&keep=1#section');
    expect(dedupUrl, 'dedupe URL should drop tracking params and hashes').toBe('https://example.com/docs?keep=1');
  });

  it("gives the same page under different titles one key", () => {
    expect(buildSearchDedupEntryKey({ title: 'GitHub', url: 'https://github.com/' }), 'the same page under different titles should share one dedup key').toBe(buildSearchDedupEntryKey({ title: 'GH home', url: 'https://github.com/#top' }));
  });

});
