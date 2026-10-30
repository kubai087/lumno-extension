import { describe, expect, it } from 'vitest';
import { getSearchSuggestionClusterInfo, getSearchTermCoverageStats, matchesSearchQueryText } from './query-intent';
import { buildSearchQueryContext } from './selection-stats';

describe('search query intent', () => {
  it("needs every term of a query, across the title and the address", () => {
    const multiTermContext = buildSearchQueryContext('codex 最爱');
    expect(matchesSearchQueryText(
        { title: 'Codex workspace', url: 'https://example.com/tools' },
        multiTermContext
      ), 'multi-term queries should not match when only one term is present').toBe(false);
    expect(matchesSearchQueryText(
        { title: 'Codex workspace', url: 'https://example.com/最爱' },
        multiTermContext
      ), 'multi-term queries should allow their terms to match across title and URL').toBe(true);
  });

  it("covers a multi-term query with title and path tokens", () => {
    const releaseContext = buildSearchQueryContext('lumno release');
    const releaseCoverage = getSearchTermCoverageStats(releaseContext, {
      titleLower: 'lumno',
      hostname: 'lumno.kubai.design',
      urlLower: 'https://lumno.kubai.design/release/',
      titleTokens: ['lumno'],
      hostLabels: ['lumno', 'kubai', 'design'],
      pathTokens: ['release']
    });
    expect(releaseCoverage.allMatched, 'title + path tokens should cover multi-term queries').toBe(true);
  });

  it("recognizes a transactional utility below the first path segment", () => {
    expect(getSearchSuggestionClusterInfo('https://mall.xiaohongshu.com/finance/cashier/web').category, 'transactional utility segments should be recognized below the first path segment').toBe('utility');
  });

});
