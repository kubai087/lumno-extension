import { describe, expect, it } from 'vitest';
import { findProviderForSiteSearchSuggestion, findSiteSearchProviderByInput, findSiteSearchProviderForPageUrl, findSiteSearchProviderKeyConflict, getInlineSiteSearchCandidate, getSiteSearchTriggerCandidate, suggestionMatchesSiteSearchProvider } from './site-search-matching';
import { findSiteSearchProvider, getDefaultSiteSearchProviders } from './site-search-providers';

describe('site search matching', () => {
  it("picks the provider of the current page only on its own host or path", () => {
    const currentPageProviders = getDefaultSiteSearchProviders();
    expect(findSiteSearchProviderForPageUrl(
        'https://www.google.com/search?q=tail+scale+download',
        currentPageProviders
      ), 'a Google results page should not be mistaken for Scholar or Maps').toBe(null);
    expect(findSiteSearchProviderForPageUrl(
        'https://scholar.google.com/scholar?q=interaction+design',
        currentPageProviders
      )?.key, 'an exact Scholar page should still select Google Scholar').toBe('gs');
    expect(findSiteSearchProviderForPageUrl(
        'https://www.google.com/maps/place/Bangkok',
        currentPageProviders
      )?.key, 'a path-scoped service should match only inside its own Google Maps path').toBe('maps');
    expect(findSiteSearchProviderForPageUrl(
        'https://mail.google.com/mail/u/0/',
        currentPageProviders
      ), 'a sibling Google service should not inherit the Maps provider').toBe(null);
    expect(findSiteSearchProviderForPageUrl(
        'https://docs.github.com/en/get-started',
        currentPageProviders
      )?.key, 'a page below a provider host should still inherit that site-search provider').toBe('gh');
  });

  it("finds trigger conflicts without case, letting an edited provider keep its trigger", () => {
    const duplicateDbProvider = findSiteSearchProviderKeyConflict(
      'DB',
      [{ key: 'db', name: 'Douban' }],
      ''
    );
    expect(duplicateDbProvider && duplicateDbProvider.name, 'site-search trigger conflicts should be detected case-insensitively').toBe('Douban');
    expect(findSiteSearchProviderKeyConflict(
        'db',
        [{ key: 'db', name: 'Douban' }],
        'db'
      ), 'editing a provider should allow it to retain its current trigger').toBe(null);
  });

  it("does not take an arbitrary Weixin developer page for WeChat Official Accounts search", () => {
    const wechatProvider = getDefaultSiteSearchProviders().find((provider) => provider.key === 'wx');
    expect(findProviderForSiteSearchSuggestion(
        {
          type: 'history',
          title: '下载',
          url: 'https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html'
        },
        wechatProvider ? [wechatProvider] : []
      ), 'site-search provider inference should not treat arbitrary Weixin developer URLs as WeChat Official Accounts search').toBe(null);
  });

  it("offers each configured trigger, a provider title or domain, and aggregates only by their trigger", () => {
    const githubProvider = {
      key: 'gh',
      aliases: ['github'],
      name: 'GitHub',
      template: 'https://github.com/search?q={query}'
    };
    const defaultSiteSearchProviders = getDefaultSiteSearchProviders();
    defaultSiteSearchProviders.forEach((provider) => {
      const triggers = [provider.key].concat(provider.aliases || []);
      triggers.forEach((trigger) => {
        expect(getSiteSearchTriggerCandidate(trigger, defaultSiteSearchProviders, null), `the configured site-search trigger "${trigger}" should expose the matching Tab hint`).toBe(provider);
      });
    });
    expect(findSiteSearchProvider('github', [githubProvider]), 'provider aliases should match site-search triggers').toBe(githubProvider);
    const namedProvider = {
      key: 'forge',
      aliases: [],
      name: 'Code Forge',
      template: 'https://code.example.com/search?q={query}'
    };
    expect(findSiteSearchProvider('  Code Forge  ', [namedProvider]), 'a trimmed exact provider title should match a site-search trigger').toBe(namedProvider);
    expect(getSiteSearchTriggerCandidate('Code Forge', [namedProvider], null), 'an exact multi-word provider title should expose the site-search trigger').toBe(namedProvider);
    const aggregateProvider = {
      key: 'tech',
      aliases: [],
      name: 'Technology search',
      template: '',
      _xIsAggregateSearch: true
    };
    expect(findSiteSearchProvider('tech', [aggregateProvider]), 'an aggregate search should match its configured trigger').toBe(aggregateProvider);
    expect(findSiteSearchProvider('Technology search', [aggregateProvider]), 'an aggregate search name must not become an implicit alias').toBe(null);
    expect(getSiteSearchTriggerCandidate('tec', [aggregateProvider], null), 'an aggregate trigger must require an exact match without implicit name aliases').toBe(null);
    expect(findSiteSearchProviderByInput('docs.github.com lumno', [githubProvider]), 'provider input parsing should match subdomains to provider hosts').toBe(githubProvider);
    expect(getSiteSearchTriggerCandidate('github.com', [githubProvider], null), 'an exact provider domain should expose the site-search trigger without requiring a short key').toBe(githubProvider);
    expect(getSiteSearchTriggerCandidate('git', [githubProvider], null), 'a partial provider title should not trigger site search without a matching local site result').toBe(null);
    expect(getSiteSearchTriggerCandidate('github lumno', [githubProvider], null), 'a provider followed by query text should remain an inline search candidate instead of a bare trigger').toBe(null);
    expect(getInlineSiteSearchCandidate('gh lumno extension', [githubProvider]), 'inline site-search parsing should preserve the query after the provider trigger').toEqual({ provider: githubProvider, query: 'lumno extension' });
    expect(suggestionMatchesSiteSearchProvider(
        { type: 'topSite', title: 'GitHub Docs', url: 'https://docs.github.com/' },
        githubProvider
      ), 'provider host matching should accept subdomain suggestions').toBeTruthy();
    expect(findProviderForSiteSearchSuggestion(
        { type: 'history', title: 'GitHub Docs', url: 'https://docs.github.com/' },
        [githubProvider]
      ), 'provider suggestion matching should work for eligible suggestion types').toBe(githubProvider);
    expect(getSiteSearchTriggerCandidate(
        'gh',
        [githubProvider],
        { type: 'topSite', title: 'GitLab', url: 'https://gitlab.com/' },
        { matchesTopSitePrefix: () => true }
      ), 'short provider triggers should not hijack a mismatched top-site prefix').toBe(null);
  });

  it("lets a matched provider host use its site title as a keyword, but not its search result pages", () => {
    const titledProvider = {
      key: 'apps',
      aliases: [],
      name: 'Apps Library',
      template: 'https://downloads.example.com/search?q={query}'
    };
    expect(getSiteSearchTriggerCandidate(
        'macked',
        [titledProvider],
        { type: 'topSite', title: 'MacKed - Mac Apps Library', url: 'https://downloads.example.com/' }
      ), 'site-search triggers should allow the matched provider host to use the site title as a keyword').toBe(titledProvider);
    expect(getSiteSearchTriggerCandidate(
        'macked',
        [titledProvider],
        { type: 'topSite', title: 'MacKed - Search Results', url: 'https://downloads.example.com/search?q=macked' }
      ), 'site-search title matching should ignore provider search-result URLs to avoid query-title overlap').toBe(null);
  });

});
