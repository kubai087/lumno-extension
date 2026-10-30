import { describe, expect, it } from 'vitest';
import { carryOverEngineSuggestions, getKeywordSearchSuggestionState, getSearchEngineSuggestionPolicy, groupSearchSuggestionsByKind, normalizeSearchEngineSuggestions } from './engine-suggestions';
import { buildSearchQueryContext } from './selection-stats';

describe('search engine suggestions', () => {
  it("keeps webpage and search blocks together, moving the whole search block first in search-first mode", () => {
    expect(groupSearchSuggestionsByKind([
        { type: 'history', title: 'Page A' },
        { type: 'googleSuggest', title: 'Search A' },
        { type: 'topSite', title: 'Page B' },
        { type: 'newtab', title: 'Search query' },
        { type: 'googleSuggest', title: 'Search B' }
      ]).map((item) => item.title), 'navigation-first mode should keep webpage and keyword-search blocks contiguous').toEqual(['Page A', 'Page B', 'Search A', 'Search query', 'Search B']);
    expect(groupSearchSuggestionsByKind([
        { type: 'history', title: 'Page A' },
        { type: 'googleSuggest', title: 'Search A' },
        { type: 'newtab', title: 'Search query' }
      ], { searchFirst: true }).map((item) => item.title), 'search-first mode should move the whole search block instead of interleaving individual rows').toEqual(['Search A', 'Search query', 'Page A']);
  });

  it("carries over only pending suggestions that extend the new query (#120)", () => {
    // #120: while a query's suggestions are pending, the previous suggestions
    // that still start with the query stay instead of dropping out.
    const previousEngineSlate = [
      { type: 'history', title: 'WhatsApp Web', url: 'https://web.whatsapp.com/' },
      { type: 'googleSuggest', title: 'whatsapp web' },
      { type: 'googleSuggest', title: 'whatsapp web login' },
      { type: 'googleSuggest', title: 'whatsapp desktop' },
      { type: 'googleSuggest', title: 'whatsapp' }
    ];
    expect(carryOverEngineSuggestions(previousEngineSlate, 'WhatsApp W').map((item) => item.title), 'only search suggestions that extend the new query should carry over').toEqual(['whatsapp web', 'whatsapp web login']);
    expect(carryOverEngineSuggestions(previousEngineSlate, 'whatsapp web').map((item) => item.title), 'a suggestion equal to the query is the search action itself and should not carry over').toEqual(['whatsapp web login']);
    expect(carryOverEngineSuggestions(previousEngineSlate, '  ')).toEqual([]);
    expect(carryOverEngineSuggestions(null, 'whatsapp')).toEqual([]);
  });

  it("drops the query itself and duplicates before the cap", () => {
    expect(normalizeSearchEngineSuggestions([
        'foo',
        'foo bar',
        'Foo Bar',
        'foo baz',
        'foo qux'
      ], 'foo', { limit: 2 }), 'search engine suggestions should drop exact-query and duplicate items before applying the cap').toEqual(['foo bar', 'foo baz']);
  });

  it("autocompletes from engine suggestions only when there are no local results", () => {
    const keywordOnlySuggestionState = getKeywordSearchSuggestionState([
      { type: 'newtab', title: 'Search', url: 'https://www.google.com/search?q=foo' },
      { type: 'googleSuggest', title: 'foo bar', url: 'https://www.google.com/search?q=foo%20bar' }
    ]);
    expect(keywordOnlySuggestionState.onlyKeywordSuggestions, 'keyword-only state should cover the explicit search action plus engine suggestions').toBe(true);
    expect(keywordOnlySuggestionState.autocompleteSuggestions.map((item) => item.type), 'keyword-only autocomplete pool can keep engine suggestions because there are no local results to outrank').toEqual(['newtab', 'googleSuggest']);
    const mixedKeywordSuggestionState = getKeywordSearchSuggestionState([
      { type: 'newtab', title: 'Search', url: 'https://www.google.com/search?q=foo' },
      { type: 'googleSuggest', title: 'foo bar', url: 'https://www.google.com/search?q=foo%20bar' },
      { type: 'history', title: 'Foo Local', url: 'https://foo.example.com/' }
    ]);
    expect(mixedKeywordSuggestionState.onlyKeywordSuggestions, 'mixed local result state should not be treated as keyword-only').toBe(false);
    expect(mixedKeywordSuggestionState.autocompleteSuggestions.map((item) => item.type), 'engine suggestions should be removed from autocomplete candidates when local results exist').toEqual(['newtab', 'history']);
  });

  it("asks for a few supplemental suggestions beside local results, and the full cap otherwise or search first", () => {
    const enginePolicyWithLocalResults = getSearchEngineSuggestionPolicy(
      buildSearchQueryContext('github'),
      [{ type: 'history', title: 'GitHub', url: 'https://github.com/' }],
      { maxEngineSuggestions: 5 }
    );
    expect(enginePolicyWithLocalResults.limit, 'engine suggestion policy should allow up to three supplemental items when local results exist').toBe(3);
    expect(enginePolicyWithLocalResults.score <= 1, 'engine suggestion policy should keep supplemental items below local result scores').toBeTruthy();
    expect(getSearchEngineSuggestionPolicy(
        buildSearchQueryContext('github'),
        [{ type: 'history', title: 'GitHub', url: 'https://github.com/' }],
        { maxEngineSuggestions: 5, searchFirst: true }
      ).limit, 'search-first mode should request the full engine-suggestion cap even when local results exist').toBe(5);
    expect(getSearchEngineSuggestionPolicy(
        buildSearchQueryContext('什么东西'),
        [],
        { maxEngineSuggestions: 5 }
      ).limit, 'engine suggestion policy should allow the full cap when no local results exist').toBe(5);
  });

});
