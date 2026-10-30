import { describe, expect, it } from 'vitest';
import {
  buildSearchUrlFromTemplate, findLocalSearchScope, findSiteSearchProvider, getDefaultSiteSearchProviders, getSearchEngineSiteSearchProvider,
  getSiteSearchProviderDisplayNameMessage, isAiSiteSearchProvider, isHelpCenterSiteSearchProvider, isInteractiveSiteSearchProvider,
  isRetiredSearchEngineState, isSearchEngineSiteSearchProvider, mergeCustomProviders, normalizeSiteSearchProvider, sanitizeSiteSearchProviders,
  withHelpCenterLocale
} from './site-search-providers';
import siteSearchCatalog from '../../../../assets/data/site-search.json';
import shortcutRulesCatalog from '../../../../assets/data/shortcut-rules.json';

function present<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('Expected a value.');
  return value;
}

describe('site search providers', () => {
  const defaultSearchEngines = getDefaultSiteSearchProviders().filter(isSearchEngineSiteSearchProvider);

  it("classifies an openAndSubmit provider as interactive AI", () => {
    const geminiBase = normalizeSiteSearchProvider({
      key: 'gm',
      aliases: ['gemini'],
      name: 'Gemini',
      template: 'https://gemini.google.com/app',
      action: 'openAndSubmit',
      submitStrategy: 'geminiPrompt'
    });
    expect(isAiSiteSearchProvider(geminiBase), 'openAndSubmit provider should be AI').toBeTruthy();
    expect(isInteractiveSiteSearchProvider(geminiBase), 'Gemini provider should be interactive').toBeTruthy();
  });

  it("keeps the bundled catalog and the fallback in step, with the engines classified in their order", () => {
    const bundledSiteSearchProviders = siteSearchCatalog.items;
    expect(getDefaultSiteSearchProviders(), 'the bundled provider catalog and JavaScript fallback should stay fully synchronized').toEqual(bundledSiteSearchProviders);
    expect(defaultSearchEngines.map((provider) => provider.key), 'built-in search engines should be explicitly classified and keep their intended order').toEqual(['bd', 'bi', 'gg', 'kg', 'ddg', 'br', 'eco', 'sg', 'yh', 'yx', 'sm']);
    expect(findSiteSearchProvider('so', getDefaultSiteSearchProviders()), 'the retired Baidu so trigger should not match any built-in provider').toBe(null);
    expect(findSiteSearchProvider('bd', getDefaultSiteSearchProviders())?.name, 'Baidu should use bd as its short trigger').toBe('Baidu');
    expect(isAiSiteSearchProvider(
        getDefaultSiteSearchProviders().find((provider) => provider.key === 'pplx')
      ), 'direct-query AI providers should be classified explicitly').toBeTruthy();
  });

  it("bundles direct-query AI providers that encode multilingual queries", () => {
    ['pplx', 'metaso', 'felo'].forEach((providerKey) => {
      const provider = getDefaultSiteSearchProviders().find((item) => item.key === providerKey);
      expect(provider, `${providerKey} should be bundled`).toBeTruthy();
      expect(provider?.category).toBe('aiSearch');
      expect(isInteractiveSiteSearchProvider(provider), `${providerKey} should use its stable query URL without DOM submission`).toBe(false);
      expect(buildSearchUrlFromTemplate(provider?.template, '中文 test'), `${providerKey} should URL-encode multilingual queries`).toMatch(/%E4%B8%AD%E6%96%87%20test/);
    });
  });

  it("opens the Lumno help center from its triggers, reading q, but not from a generic word", () => {
    ['lm', 'lumno', '帮助中心', '說明中心', 'ヘルプセンター'].forEach((trigger) => {
      expect((findSiteSearchProvider(trigger, getDefaultSiteSearchProviders()) || {}).key, `${trigger} should open the Lumno help center search`).toBe('lm');
    });
    expect(buildSearchUrlFromTemplate(
        getDefaultSiteSearchProviders().find((item) => item.key === 'lm')?.template,
        '站内 搜索'
      ), 'the help center reads q and follows the reader language for extension entries').toBe('https://lumno.kubai.design/help/what-is-lumno/?entry=ext&q=%E7%AB%99%E5%86%85%20%E6%90%9C%E7%B4%A2');
    expect(findSiteSearchProvider('help', getDefaultSiteSearchProviders()), 'a generic word like help should not switch into Lumno help center search').toBe(null);
  });

  it("places a custom provider by its saved category", () => {
    expect(isSearchEngineSiteSearchProvider({
        key: 'gg',
        category: 'site',
        _xIsCustom: true
      }), 'a custom provider explicitly placed under site search should not inherit a built-in key category').toBe(false);
    expect(normalizeSiteSearchProvider(
        { key: 'gg', category: 'site', template: 'https://example.com?q={query}' },
        { key: 'gg', category: 'searchEngine', template: 'https://google.com?q={query}' }
      )?.category, 'an explicit custom site placement should survive normalization against a built-in engine').toBe('site');
    expect(isSearchEngineSiteSearchProvider({
        key: 'custom-engine',
        category: 'searchEngine',
        _xIsCustom: true
      }), 'a custom provider placed under search engines should be classified by its saved category').toBe(true);
  });

  it("uses each engine official query URL", () => {
    expect(defaultSearchEngines.find((provider) => provider.key === 'ddg')?.template, 'DuckDuckGo should use its official query URL').toBe('https://duckduckgo.com/?q={query}');
    expect(defaultSearchEngines.find((provider) => provider.key === 'br')?.template, 'Brave Search should use its public result URL').toBe('https://search.brave.com/search?q={query}');
    expect(defaultSearchEngines.find((provider) => provider.key === 'kg')?.template, 'Kagi should use its configured query URL').toBe('https://kagi.com/search?q={query}');
    expect(defaultSearchEngines.find((provider) => provider.key === 'eco')?.template, 'Ecosia should use its documented default-search URL').toBe('https://www.ecosia.org/search?q={query}');
  });

  it("lets a customized or renamed built-in inherit how it submits, and replace its built-in when merged", () => {
    const geminiBase = normalizeSiteSearchProvider({
      key: 'gm',
      aliases: ['gemini'],
      name: 'Gemini',
      template: 'https://gemini.google.com/app',
      action: 'openAndSubmit',
      submitStrategy: 'geminiPrompt'
    });
    const customizedGemini = normalizeSiteSearchProvider({
      key: 'gm',
      aliases: ['g'],
      name: 'Gemini Custom',
      template: 'https://gemini.google.com/app'
    }, geminiBase);
    expect(customizedGemini?.action, 'customized provider should inherit action').toBe('openAndSubmit');
    expect(customizedGemini?.submitStrategy, 'customized provider should inherit submit strategy').toBe('geminiPrompt');

    const renamedGemini = normalizeSiteSearchProvider({
      key: 'gmx',
      builtinKey: 'GM',
      aliases: ['gemini'],
      name: 'Gemini Renamed',
      template: 'https://gemini.google.com/app'
    }, geminiBase);
    expect(renamedGemini?.builtinKey, 'renamed built-in overrides should retain a normalized origin key').toBe('gm');
    expect(renamedGemini?.action, 'renamed built-in overrides should inherit their origin behavior').toBe('openAndSubmit');
    expect(sanitizeSiteSearchProviders([present(renamedGemini)], [present(geminiBase)])[0].submitStrategy, 'sanitization should resolve renamed overrides against their built-in origin').toBe('geminiPrompt');

    const merged = mergeCustomProviders([present(geminiBase)], [present(customizedGemini)]);
    expect(merged.length, 'custom provider should replace same-key built-in provider').toBe(1);
    expect(merged[0].action).toBe('openAndSubmit');
    expect(merged[0]._xIsCustom, 'merged custom providers should retain their custom identity').toBe(true);
  });

  it("names built-in providers from the shared messages, leaving unknown and custom ones their own names", () => {
    expect(getSiteSearchProviderDisplayNameMessage({ key: 'dbai' }), 'AI provider display names should resolve from shared mapping').toEqual({ messageKey: 'site_search_name_doubao', fallback: 'Doubao' });
    expect(getSiteSearchProviderDisplayNameMessage({ key: 'jd' }), 'JD should resolve from the shared localized provider mapping').toEqual({ messageKey: 'site_search_name_jd', fallback: 'JD.com' });
    expect(getSiteSearchProviderDisplayNameMessage({ key: 'wx' }), 'wechat provider display name should describe WeChat Official Accounts search').toEqual({ messageKey: 'site_search_name_wechat', fallback: 'WeChat Official Accounts' });
    expect(getSiteSearchProviderDisplayNameMessage({ key: 'unknown' }), 'unknown provider display names should fall back to caller-owned name').toBe(null);
    expect(getSiteSearchProviderDisplayNameMessage({
        key: 'db',
        name: 'Dribbble',
        _xIsCustom: true
      }), 'custom providers should keep their user-defined names when a key matches a built-in provider').toBe(null);
  });

  it("names the WeChat provider and draws every built-in icon from the bundled set", () => {
    const wechatProvider = getDefaultSiteSearchProviders().find((provider) => provider.key === 'wx');
    expect(wechatProvider && wechatProvider.name, 'default wechat provider name should describe WeChat Official Accounts search').toBe('WeChat Official Accounts');
    getDefaultSiteSearchProviders().forEach((provider) => {
      expect(provider.iconUrl, `${provider.key} should defer to the bundled local SVG map instead of a remote icon URL`).toBe(undefined);
    });
  });

  it("reads a searchTerms template as a query template", () => {
    expect(buildSearchUrlFromTemplate('https://example.com/search?q={searchTerms}', 'hello world'), 'searchTerms templates should normalize to query templates').toBe('https://example.com/search?q=hello%20world');
  });

  it("scopes to browser content only on an exact bundled keyword", () => {
    const shortcutRules = shortcutRulesCatalog.items;
    expect(findLocalSearchScope('  BOOKMARKS  ', shortcutRules), 'bookmark scope should reuse the exact bundled English shortcut keyword').toEqual({ sourceType: 'bookmark', trigger: 'bookmarks', key: 'bookmarks' });
    expect(findLocalSearchScope('历史', shortcutRules), 'history scope should reuse the exact bundled Chinese shortcut keyword').toEqual({ sourceType: 'history', trigger: '历史', key: '历史' });
    expect(findLocalSearchScope('常用', shortcutRules), 'frequent-site scope should expose a Chinese keyword').toEqual({ sourceType: 'topSite', trigger: '常用', key: '常用' });
    expect(findLocalSearchScope('top sites', shortcutRules), 'frequent-site scope should expose an English keyword').toEqual({ sourceType: 'topSite', trigger: 'top sites', key: 'top sites' });
    expect(findLocalSearchScope('history today', shortcutRules), 'local scopes should require an exact keyword so normal searches are not hijacked').toBe(null);
  });

  it('lists help center pages only for the Lumno help center provider, an edited copy included', () => {
    const providers = getDefaultSiteSearchProviders();
    const help = present(providers.find((item) => item.key === 'lm'));
    expect(isHelpCenterSiteSearchProvider(help)).toBe(true);
    expect(isHelpCenterSiteSearchProvider({ ...help, key: 'help', builtinKey: 'lm', _xIsCustom: true })).toBe(true);
    expect(isHelpCenterSiteSearchProvider({ ...help, template: 'https://example.com/?q={query}' })).toBe(false);
    expect(isHelpCenterSiteSearchProvider(providers.find((item) => item.key === 'gh'))).toBe(false);
    expect(getSiteSearchProviderDisplayNameMessage(help)).toEqual({ messageKey: 'site_search_name_lumno_help', fallback: 'Lumno Help Center' });
  });

  it('opens the help center in the language its results came from, leaving other site searches alone', () => {
    const providers = getDefaultSiteSearchProviders();
    const help = present(providers.find((item) => item.key === 'lm'));
    const helpUrl = buildSearchUrlFromTemplate(help.template, 'shortcut');
    expect(withHelpCenterLocale(helpUrl, help, 'zh_TW')).toBe('https://lumno.kubai.design/help/what-is-lumno/?entry=ext&q=shortcut&lang=zh-TW');
    expect(withHelpCenterLocale(helpUrl, help, '')).toBe(helpUrl);
    const github = present(providers.find((item) => item.key === 'gh'));
    const githubUrl = buildSearchUrlFromTemplate(github.template, 'shortcut');
    expect(withHelpCenterLocale(githubUrl, github, 'ja')).toBe(githubUrl);
  });
});

describe('the browser search engine as a site search', () => {
  const providers = getDefaultSiteSearchProviders();
  const providerFor = (state: { id?: string; host?: string; name?: string; searchTemplate?: string }) => (
    getSearchEngineSiteSearchProvider(state, providers)
  );

  it('reuses the listed provider of a known engine', () => {
    expect(providerFor({ id: 'google', host: 'www.google.com', name: 'Google', searchTemplate: 'https://www.google.com/search?q={query}' })?.key).toBe('gg');
  });

  it('keeps the search address of a regional Yandex site, but the listed one for a regional Google page', () => {
    const yandex = providerFor({ id: 'yandex', host: 'yandex.tm', name: 'Yandex', searchTemplate: 'https://yandex.tm/search/?text={query}' });
    expect(yandex?.key).toBe('yx');
    expect(yandex?.template).toBe('https://yandex.tm/search/?text={query}');
    expect(providerFor({ id: 'google', host: 'google.co.jp', name: 'Google', searchTemplate: 'https://www.google.com/search?q={query}' })?.template)
      .toBe('https://www.google.com/search?q={query}');
  });

  it('falls back to Google for the retired 360 engine and before storage is read', () => {
    expect(isRetiredSearchEngineState({ id: 'so', host: 'www.so.com' })).toBe(true);
    expect(providerFor({ id: 'so', host: 'www.so.com', name: '360搜索', searchTemplate: 'https://www.so.com/s?q={query}' })?.key).toBe('gg');
    expect(providerFor({})?.key).toBe('gg');
  });

  it('turns an unlisted browser default into a search engine provider of its own', () => {
    const unlisted = providerFor({ id: 'private-engine', host: 'search.example.test', name: 'Private Engine', searchTemplate: 'https://search.example.test/?q={query}' });
    expect(unlisted?.key).toBe('engine-private-engine');
    expect(unlisted?.category).toBe('searchEngine');
  });
});

