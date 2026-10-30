import { describe, expect, it } from 'vitest';
import type { SuggestionLike } from '../types';
import type { RankSlateOptions, SlateMatchers } from './slate-types';
import { composeSearchFirstSuggestionSlate, pinExactSearchActionSecond, rankSearchSuggestionSlate } from './suggestion-slate';

describe('search-first suggestion slate', () => {
  it("reserves sixty percent for search rows, caps each local source and backfills unused quota", () => {
    const searchFirstQuotaInput = [
      { type: 'history', title: 'History 1' },
      { type: 'history', title: 'History 2' },
      { type: 'history', title: 'History 3' },
      { type: 'bookmark', title: 'Bookmark 1' },
      { type: 'bookmark', title: 'Bookmark 2' },
      { type: 'topSite', title: 'Frequent 1' },
      { type: 'googleSuggest', title: 'Suggestion 1' },
      { type: 'googleSuggest', title: 'Suggestion 2' },
      { type: 'googleSuggest', title: 'Suggestion 3' },
      { type: 'googleSuggest', title: 'Suggestion 4' },
      { type: 'googleSuggest', title: 'Suggestion 5' },
      { type: 'newtab', title: 'Search query' }
    ];
    const defaultSearchFirstSlate = composeSearchFirstSuggestionSlate(
      searchFirstQuotaInput,
      { limit: 10 }
    ).slice(0, 10);
    expect(defaultSearchFirstSlate.map((item) => item.type), 'a ten-row search-first slate should reserve six search rows and cap history/bookmark to two initial local rows each').toEqual([
        'newtab',
        'googleSuggest',
        'googleSuggest',
        'googleSuggest',
        'googleSuggest',
        'googleSuggest',
        'history',
        'history',
        'bookmark',
        'bookmark'
      ]);
    expect(composeSearchFirstSuggestionSlate(searchFirstQuotaInput, { limit: 5 })
        .slice(0, 5)
        .map((item) => item.type), 'a five-row search-first slate should keep the same sixty-percent search allocation').toEqual(['newtab', 'googleSuggest', 'googleSuggest', 'history', 'bookmark']);
    expect(composeSearchFirstSuggestionSlate([
        { type: 'history', title: 'History 1' },
        { type: 'history', title: 'History 2' },
        { type: 'history', title: 'History 3' },
        { type: 'googleSuggest', title: 'Suggestion 1' },
        { type: 'googleSuggest', title: 'Suggestion 2' },
        { type: 'newtab', title: 'Search query' }
      ], { limit: 5 }).slice(0, 5).map((item) => item.type), 'unused local-source quota should backfill instead of leaving the result list empty').toEqual(['newtab', 'googleSuggest', 'googleSuggest', 'history', 'history']);
  });

  it("puts a local row titled exactly as the query second (#123)", () => {
    const searchFirstQuotaInput = [
      { type: 'history', title: 'History 1' },
      { type: 'history', title: 'History 2' },
      { type: 'history', title: 'History 3' },
      { type: 'bookmark', title: 'Bookmark 1' },
      { type: 'bookmark', title: 'Bookmark 2' },
      { type: 'topSite', title: 'Frequent 1' },
      { type: 'googleSuggest', title: 'Suggestion 1' },
      { type: 'googleSuggest', title: 'Suggestion 2' },
      { type: 'googleSuggest', title: 'Suggestion 3' },
      { type: 'googleSuggest', title: 'Suggestion 4' },
      { type: 'googleSuggest', title: 'Suggestion 5' },
      { type: 'newtab', title: 'Search query' }
    ];
    // #123: a bookmark titled exactly as typed comes right after the search
    // action, and counts as a local row so the search rows keep their share.
    const whatsappSlate = [
      { type: 'googleSuggest', title: 'whatsapp web' },
      { type: 'googleSuggest', title: 'whatsapp desktop' },
      { type: 'googleSuggest', title: 'whatsapp download' },
      { type: 'googleSuggest', title: 'whatsapp online' },
      { type: 'googleSuggest', title: 'whatsapp störung' },
      { type: 'history', title: 'WhatsApp Business' },
      { type: 'bookmark', title: 'WhatsApp' },
      { type: 'newtab', title: 'whatsapp' }
    ];
    expect(composeSearchFirstSuggestionSlate(whatsappSlate, { limit: 7, query: 'whatsapp' })
        .slice(0, 7).map((item) => item.title), 'search-first should put a local row titled exactly as the query second').toEqual(['whatsapp', 'WhatsApp', 'whatsapp web', 'whatsapp desktop', 'whatsapp download', 'whatsapp online', 'WhatsApp Business']);
    expect(composeSearchFirstSuggestionSlate(whatsappSlate, { limit: 7, query: 'Whats App' })[1].title, 'the exact-title match should ignore case and spaces').toBe('WhatsApp');
    expect(composeSearchFirstSuggestionSlate(whatsappSlate, { limit: 7, query: 'whats' })[1].title, 'a title that only starts with the query should keep its usual place').toBe('whatsapp web');
    expect(composeSearchFirstSuggestionSlate(searchFirstQuotaInput, { limit: 10 }).map((item) => item.title), 'without an exact-title row the search-first slate should not change').toEqual(composeSearchFirstSuggestionSlate(searchFirstQuotaInput, { limit: 10, query: 'nothing matches' }).map((item) => item.title));
  });

  it("pins the exact search action second, or keeps it first among keywords", () => {
    const pinnedExactSearchActionSuggestions = pinExactSearchActionSecond([
      { type: 'history', title: 'Local A' },
      { type: 'history', title: 'Local B' },
      { type: 'googleSuggest', title: 'query suggestion' },
      { type: 'newtab', title: 'query', searchQuery: 'query', forceSearch: true }
    ]);
    expect(pinnedExactSearchActionSuggestions.map((item) => item.type), 'autocomplete-first results should reserve the second row for the exact-query search action').toEqual(['history', 'newtab', 'history', 'googleSuggest']);
    expect({
        title: pinnedExactSearchActionSuggestions[1].title,
        searchQuery: pinnedExactSearchActionSuggestions[1].searchQuery,
        forceSearch: pinnedExactSearchActionSuggestions[1].forceSearch
      }, 'the pinned row should search exactly what the user entered instead of an autocomplete rewrite').toEqual({ title: 'query', searchQuery: 'query', forceSearch: true });
    expect(pinExactSearchActionSecond([
        { type: 'newtab', title: 'query', searchQuery: 'query', forceSearch: true },
        { type: 'googleSuggest', title: 'query suggestion' }
      ]).map((item) => item.type), 'keyword-only results should keep the exact-query search action first').toEqual(['newtab', 'googleSuggest']);
    expect(pinExactSearchActionSecond([
        { type: 'googleSuggest', title: 'query suggestion' },
        { type: 'newtab', title: 'query', searchQuery: 'query', forceSearch: true },
        { type: 'bookmark', title: 'Local Bookmark' }
      ]).map((item) => item.type), 'the exact-query row should not be displaced by a search-engine autocomplete item').toEqual(['bookmark', 'newtab', 'googleSuggest']);
  });

});

// rankSearchSuggestionSlate is the highlight and ordering decision the
// overlay and the New Tab search box share; each case pins one highlight
// reason with simple surface matchers.
describe('ranking the suggestion slate', () => {
  const searchAction: SuggestionLike & { searchQuery: string } = { type: 'newtab', title: 'Search "git"', url: 'https://search.test/?q=git', searchQuery: 'git' };
  const history: SuggestionLike = { type: 'history', title: 'Git docs', url: 'https://git-scm.com/docs' };
  const bookmark: SuggestionLike = { type: 'bookmark', title: 'GitHub', url: 'https://github.com/' };
  const engine: SuggestionLike = { type: 'googleSuggest', title: 'git commit', url: 'https://search.test/?q=git+commit' };

  function urlDisplay(url: string | undefined): string {
    try {
      const parsed = new URL(String(url));
      return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname === '/' ? '' : parsed.pathname}`;
    } catch {
      return '';
    }
  }

  function moveFirst(list: SuggestionLike[], suggestion: SuggestionLike): SuggestionLike {
    const index = list.indexOf(suggestion);
    if (index > 0) {
      list.splice(index, 1);
      list.unshift(suggestion);
    }
    return suggestion;
  }

  function createMatchers(overrides: Partial<SlateMatchers<SuggestionLike>> = {}): SlateMatchers<SuggestionLike> {
    return {
      promoteStrongNavigationMatch: () => null,
      promoteTopSiteMatch: () => null,
      getSiteSearchTriggerCandidate: () => null,
      getAutocompleteCandidate: () => null,
      getUrlDisplay: urlDisplay,
      filterSuggestions: (list) => list,
      ...overrides
    };
  }

  function rank(suggestions: SuggestionLike[], options: Partial<RankSlateOptions<SuggestionLike>> = {}) {
    return rankSearchSuggestionSlate(suggestions, {
      query: 'git',
      rawQuery: 'git',
      triggerInput: 'git',
      providers: [],
      preferAutocompleteFirst: true,
      autocompleteSuggestions: suggestions.filter((item) => item.type !== 'newtab'),
      matchers: createMatchers(),
      ...options
    });
  }

  it("highlights the first row and pins the exact search action second, leaving the input list alone", () => {
    const input = [searchAction, history, bookmark];
    const result = rank(input);
    expect(result.suggestions, 'the first local result leads and the search action is pinned second').toEqual([history, searchAction, bookmark]);
    expect(result.primaryHighlightIndex).toBe(0);
    expect(result.primaryHighlightReason).toBe('default');
    expect(result.primarySuggestion).toBe(history);
    expect(input, 'the input list is not reordered').toEqual([searchAction, history, bookmark]);
  });

  it("highlights a strong navigation match", () => {
    const result = rank([searchAction, history, bookmark], {
      matchers: createMatchers({
        promoteStrongNavigationMatch: (list) => moveFirst(list, bookmark)
      })
  });
    expect(result.primaryHighlightReason).toBe('navigation');
    expect(result.primarySuggestion).toBe(bookmark);
  });

  it("moves the autocomplete target to the front, from the autocomplete pool and the raw query", () => {
    const result = rank([searchAction, history, bookmark], {
      matchers: createMatchers({
        getAutocompleteCandidate: (pool, rawQuery) => {
          expect(pool, 'autocomplete only considers the shared autocomplete pool, not the search action').toEqual([history, bookmark]);
          expect(rawQuery, 'autocomplete sees the raw (untrimmed) query').toBe('git');
          return { completion: 'github.com', url: '' };
        }
      })
  });
    expect(result.primaryHighlightReason).toBe('autocomplete');
    expect(result.suggestions[0]).toBe(bookmark);
  });

  it("never autocompletes a keyword-only slate, keeping the search action first", () => {
    const result = rank([searchAction, engine], {
      onlyKeywordSuggestions: true,
      matchers: createMatchers({
        getAutocompleteCandidate: () => expect.unreachable('keyword-only slates must not autocomplete')
      })
  });
    expect(result.primaryHighlightReason).toBe('default');
    expect(result.primarySuggestion, 'search-engine suggestions must not be promoted ahead of the explicit search action').toBe(searchAction);
  });

  it("keeps the search action first in a keyword-only slate with a matched tab", () => {
    const engineTab = Object.assign({}, engine, { _xMatchedTabId: 3 });
    const result = rank([searchAction, engineTab], {
      onlyKeywordSuggestions: true,
      openTabMatch: { openTabQuickSwitchEnabled: true }
  });
    expect(result.primarySuggestion).toBe(searchAction);
  });

  it("An inline site search leads, passes through the surface filter, and suppresses local promotions.", () => {
    const inline = { type: 'inlineSiteSearch', title: 'Search GitHub', url: 'https://github.com/search?q=x' };
    const filtered = [];
    const result = rank([searchAction, history], {
      inlineSuggestion: inline,
      matchers: createMatchers({
        promoteStrongNavigationMatch: () => expect.unreachable('inline search skips navigation promotion'),
        filterSuggestions: (list) => {
          filtered.push(list.slice());
          return list;
        }
      })
  });
    expect(result.primaryHighlightReason).toBe('inline');
    expect(result.suggestions[0]).toBe(inline);
    expect(filtered.length, 'the inline row is filtered with the slate').toBe(1);
    expect(result.siteSearchTrigger, 'inline search has no Tab trigger').toBe(null);
  });

  it("highlights a promoted top site and offers it as the site search trigger context", () => {
    let triggerContext = null;
    const provider = { key: 'gh', name: 'GitHub' };
    const result = rank([searchAction, history, bookmark], {
      triggerInput: 'gh',
      providers: [provider],
      matchers: createMatchers({
        promoteTopSiteMatch: (list) => moveFirst(list, bookmark),
        getSiteSearchTriggerCandidate: (input, providers, topSiteMatch) => {
          triggerContext = { input, providers, topSiteMatch };
          return provider;
        }
      })
  });
    expect(result.primaryHighlightReason).toBe('topSite');
    expect(result.primarySuggestion).toBe(bookmark);
    expect(triggerContext).toEqual({ input: 'gh', providers: [provider], topSiteMatch: bookmark });
    expect(result.siteSearchTrigger).toBe(provider);
  });

  it("switches to a matching open tab only with quick switch on, and to the current page when asked", () => {
    const tabRow = Object.assign({}, history, { _xMatchedTabId: 7 });
    const options = {
      openTabMatch: { openTabQuickSwitchEnabled: true, currentTabId: 1 }
    };
    const result = rank([searchAction, bookmark, tabRow], options);
    expect(result.primaryHighlightReason).toBe('openTab');
    expect(result.suggestions[0]).toBe(tabRow);

    const disabled = rank([searchAction, bookmark, tabRow], { openTabMatch: null });
    expect(disabled.primaryHighlightReason).toBe('default');

    const currentPage = rank([searchAction, bookmark, Object.assign({}, tabRow, { _xMatchedTabId: 1 })], {
      openTabMatch: { prioritizeCurrentPageMatch: true, currentTabId: 1, openTabQuickSwitchEnabled: false }
  });
    expect(currentPage.primaryHighlightReason).toBe('currentOpenTab');
  });

  it("keeps the slate order and skips local promotions when search comes first", () => {
    const result = rank([searchAction, history, bookmark], {
      preferAutocompleteFirst: false,
      openTabMatch: { openTabQuickSwitchEnabled: true },
      matchers: createMatchers({
        promoteStrongNavigationMatch: () => expect.unreachable('search-first skips navigation promotion'),
        promoteTopSiteMatch: () => expect.unreachable('search-first skips top-site promotion'),
        getAutocompleteCandidate: () => expect.unreachable('search-first skips autocomplete')
      })
  });
    expect(result.suggestions).toEqual([searchAction, history, bookmark]);
    expect(result.primaryHighlightReason).toBe('default');
    expect(result.primarySuggestion).toBe(searchAction);
  });

  it("offers no Tab trigger with a site search tag active", () => {
    const result = rank([searchAction, history], {
      siteSearchActive: true,
      matchers: createMatchers({
        getSiteSearchTriggerCandidate: () => expect.unreachable('an active tag has no Tab trigger')
      })
  });
    expect(result.siteSearchTrigger).toBe(null);
  });

  it("highlights nothing without a query", () => {
    const result = rank([history], { query: '' });
    expect(result.primaryHighlightIndex).toBe(-1);
    expect(result.primarySuggestion).toBe(null);
    expect(result.mergedProvider).toBe(null);
  });
});
