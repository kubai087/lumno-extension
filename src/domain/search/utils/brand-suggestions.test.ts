import { describe, expect, it } from 'vitest';
import type { SuggestionLike } from '../types';
import { applySearchSuggestionHostDiversity, buildSearchBrandDirectSuggestion, composeSearchSuggestionSlate, filterSearchSuggestionsBySourceTypes, limitSearchSuggestionsForDisplay } from './brand-suggestions';
import { getSearchSuggestionFamilyKey } from './direct-navigation';
import { getSearchSuggestionClusterInfo } from './query-intent';
import { calculateSearchRelevanceScore } from './relevance-score';
import { buildSearchQueryContext } from './selection-stats';

const RANKING = { isLocalNetworkHost: () => false, isOwnExtensionUrl: () => false };

function score(item: { title: string; url: string }, query: string, sourceType = 'history'): number {
  return calculateSearchRelevanceScore(item, sourceType, buildSearchQueryContext(query), RANKING);
}

describe('brand suggestions and the result slate', () => {
  it("represents a brand by its site, caps its family at three local rows and keeps navigation ahead of search suggestions", () => {
    const xiaohongshuContext = buildSearchQueryContext('小红书');
    const xiaohongshuCashierScore = score({
      title: '小红书',
      url: 'https://mall.xiaohongshu.com/finance/cashier/web'
    }, '小红书');
    const xiaohongshuCreatorScore = score({
      title: '小红书创作服务平台',
      url: 'https://creator.xiaohongshu.com/'
    }, '小红书');
    const xiaohongshuCandidates: SuggestionLike[] = [
      {
        type: 'history',
        title: '小红书',
        url: 'https://mall.xiaohongshu.com/finance/cashier/web',
        score: xiaohongshuCashierScore
      },
      {
        type: 'history',
        title: '小红书创作服务平台',
        url: 'https://creator.xiaohongshu.com/',
        score: xiaohongshuCreatorScore
      },
      {
        type: 'history',
        title: '小红书 - 你的生活兴趣社区',
        url: 'https://www.xiaohongshu.com/explore',
        score: 240
      },
      {
        type: 'history',
        title: '小红书 - 你的生活兴趣社区',
        url: 'https://www.xiaohongshu.com/explore/6a4dcb39000000001',
        score: 180
      }
    ];
    const xiaohongshuOpenTab = {
      ...xiaohongshuCandidates[3],
      _xMatchedTabId: 26,
      score: 40
    };
    const xiaohongshuDirect = buildSearchBrandDirectSuggestion(
      xiaohongshuCandidates,
      xiaohongshuContext
    );
    expect(xiaohongshuDirect &&
        xiaohongshuDirect.url === 'https://www.xiaohongshu.com/' &&
        xiaohongshuDirect.isBrandRepresentative === true, 'an exact configured brand alias should synthesize its stable site representative when history lacks one').toBeTruthy();
    const xiaohongshuDiverse = applySearchSuggestionHostDiversity(
      [
        xiaohongshuDirect,
        ...xiaohongshuCandidates.slice(0, 3),
        xiaohongshuOpenTab
      ].filter((item) => item !== null),
      { context: xiaohongshuContext }
    );
    expect(xiaohongshuDiverse.length <= 3 &&
        xiaohongshuDiverse.every((item) => getSearchSuggestionFamilyKey(item.url) === 'xiaohongshu.com'), 'a pure brand query should cap one brand family at three local results').toBeTruthy();
    expect(xiaohongshuDiverse.some((item) => item && item._xMatchedTabId === 26), 'a brand-family cap should reserve one slot for an already-open matching tab').toBeTruthy();
    const xiaohongshuSlate = composeSearchSuggestionSlate([
      ...xiaohongshuDiverse,
      {
        type: 'googleSuggest',
        title: '小红书薯币购买',
        url: 'https://www.google.com/search?q=%E5%B0%8F%E7%BA%A2%E4%B9%A6%E8%96%AF%E5%B8%81%E8%B4%AD%E4%B9%B0'
      }
    ], xiaohongshuContext);
    expect(xiaohongshuSlate[1]._xMatchedTabId, 'an already-open brand page should stay ahead of supplemental search suggestions').toBe(26);
    expect(xiaohongshuSlate[xiaohongshuSlate.length - 1].type, 'brand result composition should keep search suggestions after the contiguous navigation group').toBe('googleSuggest');
    expect(xiaohongshuSlate.slice(0, -1).every((item) => item.type !== 'googleSuggest'), 'brand result composition should not interleave webpages and search suggestions').toBeTruthy();
  });

  it("names the row that goes to a site by the part of a page title that names it", () => {
    const direct = buildSearchBrandDirectSuggestion([{
      type: 'history',
      title: 'TypeScript: Handbook - Generics',
      url: 'https://www.typescriptlang.org/docs/handbook/2/generics.html',
      score: 120
    }], buildSearchQueryContext('typescript'), RANKING);
    expect(direct && direct.url, 'a brand query should add a row for the site itself').toBe('https://typescriptlang.org/');
    expect(direct && direct.title, 'the site row should not borrow a deep page title').toBe('TypeScript');
  });

  it("ranks an app's start page and dashboard as the site, not as an action or utility page", () => {
    expect(getSearchSuggestionClusterInfo('https://claude.ai/new').category, 'a top-level /new is where an app starts').toBe('section');
    expect(getSearchSuggestionClusterInfo('https://www.yuque.com/dashboard').category, 'a dashboard is an app\'s home').toBe('section');
    expect(getSearchSuggestionClusterInfo('https://example.com/new/project').category, 'a deeper /new still creates something').toBe('action');
    expect(score({ title: 'Claude', url: 'https://claude.ai/new' }, 'claude') > 200, 'an app\'s start page should rank as its site').toBeTruthy();
  });

  it("stops at the display limit, keeping the order, and filters only disabled local types", () => {
    const displaySuggestionItems = Array.from({ length: 12 }, (_, index) => ({
      type: 'history',
      title: `Result ${index + 1}`,
      url: `https://example.com/${index + 1}`
    }));
    expect(limitSearchSuggestionsForDisplay(displaySuggestionItems).length, 'display suggestions should default to the shared visible-result cap').toBe(10);
    expect(limitSearchSuggestionsForDisplay(displaySuggestionItems, { limit: 5 }).map((item) => item.title), 'display suggestion limiting should preserve ranking order').toEqual(['Result 1', 'Result 2', 'Result 3', 'Result 4', 'Result 5']);
    expect(limitSearchSuggestionsForDisplay(displaySuggestionItems, { limit: 10 }).length, 'display suggestions should accept the maximum configurable visible-result cap').toBe(10);
    expect(limitSearchSuggestionsForDisplay(displaySuggestionItems, { limit: 11 }).length, 'display suggestions should fall back to the shared cap for out-of-range values').toBe(10);
    const withLateTab = [...displaySuggestionItems.slice(0, 7), { ...displaySuggestionItems[7], title: 'Open tab', _xMatchedTabId: 5 }];
    expect(limitSearchSuggestionsForDisplay(withLateTab, { limit: 5 }).map((item) => item.title), 'a matching open tab past the cap should take the last visible place').toEqual(['Result 1', 'Result 2', 'Result 3', 'Result 4', 'Open tab']);
    const withShownTab = [{ ...displaySuggestionItems[0], _xMatchedTabId: 1 }, ...withLateTab.slice(1)];
    expect(limitSearchSuggestionsForDisplay(withShownTab, { limit: 5 }).map((item) => item.title), 'one visible open tab is enough').toEqual(['Result 1', 'Result 2', 'Result 3', 'Result 4', 'Result 5']);
    const sourceRows = [
      { type: 'topSite', title: 'Frequent', url: 'https://frequent.example.com/' },
      { type: 'bookmark', title: 'Bookmark', url: 'https://bookmark.example.com/' },
      { type: 'history', title: 'History', url: 'https://history.example.com/' },
      { type: 'googleSuggest', title: 'Search Suggestion', url: 'https://google.example.com/' },
      { type: 'newtab', title: 'Search', url: 'https://example.com/' },
      { type: 'directUrl', title: 'Direct', url: 'https://direct.example.com/' }
    ];
    expect(filterSearchSuggestionsBySourceTypes(sourceRows, ['bookmark']).map((item) => item.type), 'source filtering should only remove disabled local result types').toEqual(['bookmark', 'googleSuggest', 'newtab', 'directUrl']);
    expect(filterSearchSuggestionsBySourceTypes(sourceRows, []).map((item) => item.type), 'no chosen sources should remove every local result type').toEqual(['googleSuggest', 'newtab', 'directUrl']);
  });

  it("does not collapse search engine suggestions by host", () => {
    const engineSuggestionItems = [
      '什么东西补血',
      '什么东西解酒',
      '什么东西补钙',
      '什么东西补铁',
      '什么东西化痰'
    ].map((query) => ({
      type: 'googleSuggest',
      title: query,
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`
    }));
    expect(applySearchSuggestionHostDiversity(engineSuggestionItems).map((item) => item.title), 'search engine keyword suggestions should not be collapsed by same-host diversity limits').toEqual(engineSuggestionItems.map((item) => item.title));
  });

  it("does not move a reserved top-site slot ahead of stronger results", () => {
    expect(applySearchSuggestionHostDiversity([
        { type: 'bookmark', title: 'Docs', url: 'https://notes.example.com/a/b', score: 400 },
        { type: 'history', title: 'React docs', url: 'https://react.dev/learn', score: 300 },
        { type: 'topSite', isTopSite: true, title: 'Google Docs', url: 'https://docs.google.com/', score: 60 }
      ], { context: buildSearchQueryContext('docs') }).map((item) => item.title), 'a reserved top-site slot should not jump ahead of stronger results').toEqual(['Docs', 'React docs', 'Google Docs']);
  });

});
