import { describe, expect, it } from 'vitest';
import { promoteStrongNavigationMatch } from './navigation-matching';
import { calculateSearchRelevanceScore, createSearchSuggestion, getSearchSelectionBoost } from './relevance-score';
import { SEARCH_POLICY } from './search-policy';
import { buildSearchQueryContext, normalizeSearchSelectionStats, recordSearchSelectionInStats } from './selection-stats';

const RANKING = { isLocalNetworkHost: () => false, isOwnExtensionUrl: () => false };

function score(item: { title: string; url: string }, query: string, sourceType = 'history'): number {
  return calculateSearchRelevanceScore(item, sourceType, buildSearchQueryContext(query), RANKING);
}

describe('search relevance score', () => {
  it("ranks a specific page over the site root for a path query", () => {
    const rootScore = score({ title: 'Lumno', url: 'https://lumno.kubai.design/' }, 'lumno release', 'topSite');
    const releaseScore = score({ title: 'Release | Lumno', url: 'https://lumno.kubai.design/release/' }, 'lumno release', 'history');
    expect(releaseScore > rootScore, 'specific release page should outrank root for path-intent queries').toBeTruthy();
  });

  it("ranks a descriptive product root over a generic brand title on a deep utility page", () => {
    const xiaohongshuCashierScore = score({
      title: '小红书',
      url: 'https://mall.xiaohongshu.com/finance/cashier/web'
    }, '小红书');
    const xiaohongshuCreatorScore = score({
      title: '小红书创作服务平台',
      url: 'https://creator.xiaohongshu.com/'
    }, '小红书');
    expect(xiaohongshuCreatorScore > xiaohongshuCashierScore, 'a generic brand title on a deep utility page should not outrank a descriptive product root').toBeTruthy();
  });

  it("lets query-specific selection history outrank a generic top site, but not take over a brand query from one click", () => {
    const xiaohongshuContext = buildSearchQueryContext('小红书');
    const selectionNow = 1_800_000_000_000;
    let selectionStats = normalizeSearchSelectionStats(null, { now: selectionNow });
    for (let i = 0; i < 12; i += 1) {
      selectionStats = recordSearchSelectionInStats(selectionStats, {
        query: 'ProjectX',
        title: 'ProjectX | Selected Project',
        url: 'https://selected.example.com/',
        type: 'history'
      }, { now: selectionNow + i });
    }
    const selectionContext = buildSearchQueryContext('ProjectX');
    const selectedCandidate = {
      title: 'ProjectX | Selected Project',
      url: 'https://selected.example.com/',
      visitCount: 5,
      lastVisitTime: selectionNow
    };
    const topSiteCandidate = {
      title: 'ProjectX',
      url: 'https://projectx.example.com/',
      visitCount: 40,
      lastVisitTime: selectionNow
    };
    const selectionOptions = {
      now: selectionNow + 12,
      isLocalNetworkHost: () => false,
      isOwnExtensionUrl: () => false
    };
    const selectedScore = calculateSearchRelevanceScore(selectedCandidate, 'history', selectionContext, selectionOptions) +
      getSearchSelectionBoost(selectedCandidate, selectionContext, selectionStats, selectionOptions);
    const topSiteScore = calculateSearchRelevanceScore(topSiteCandidate, 'topSite', selectionContext, selectionOptions);
    expect(selectedScore > topSiteScore, 'query-specific selection history should be strong enough to outrank a generic top-site match').toBeTruthy();
    const selectedSelectionBoost = getSearchSelectionBoost(
      selectedCandidate,
      selectionContext,
      selectionStats,
      selectionOptions
    );
    let brandDeepSelectionStats = normalizeSearchSelectionStats(null, { now: selectionNow });
    brandDeepSelectionStats = recordSearchSelectionInStats(brandDeepSelectionStats, {
      query: '小红书',
      title: '小红书',
      url: 'https://mall.xiaohongshu.com/finance/cashier/web',
      type: 'history'
    }, { now: selectionNow });
    expect(getSearchSelectionBoost(
        {
          title: '小红书',
          url: 'https://mall.xiaohongshu.com/finance/cashier/web'
        },
        xiaohongshuContext,
        brandDeepSelectionStats,
        { now: selectionNow + 1 }
      ), 'one recent click should not give a deep page enough learned weight to take over a pure brand query').toBe(SEARCH_POLICY.brandDeepSelectionBoostLimit);
    const learnedNavigationList = [
      {
        type: 'topSite',
        title: topSiteCandidate.title,
        url: topSiteCandidate.url,
        isTopSite: true
      },
      {
        type: 'history',
        title: selectedCandidate.title,
        url: selectedCandidate.url,
        selectionBoost: selectedSelectionBoost
      }
    ];
    const learnedNavigationMatch = promoteStrongNavigationMatch(learnedNavigationList, 'ProjectX');
    expect(learnedNavigationMatch?.url, 'strong navigation promotion should respect query-specific selection boost').toBe(selectedCandidate.url);
  });

  it("gives a configured site root a stable title, leaving profile paths and bookmark titles alone", () => {
    const xRootSuggestion = createSearchSuggestion({
      title: '(1) نوف | Nouf (@Nouf0633) / X',
      url: 'https://x.com/'
    }, 'history', 100);
    expect(xRootSuggestion.title, 'configured site roots should use stable direct titles').toBe('X');

    const xProfileSuggestion = createSearchSuggestion({
      title: '(1) نوف | Nouf (@Nouf0633) / X',
      url: 'https://x.com/Nouf0633'
    }, 'history', 100);
    expect(xProfileSuggestion.title, 'configured titles should not replace profile paths').toBe('(1) نوف | Nouf (@Nouf0633) / X');

    const xBookmarkSuggestion = createSearchSuggestion({
      title: 'My X bookmark',
      url: 'https://x.com/'
    }, 'bookmark', 100);
    expect(xBookmarkSuggestion.title, 'bookmark titles should remain user controlled').toBe('My X bookmark');
  });

});
