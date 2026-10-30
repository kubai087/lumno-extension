// Site search providers: templates, local search scopes, the built-in
// and help center providers, AI and search engine providers, and
// normalizing, sanitizing and merging provider lists.
import type {
  LocalSearchScope,
  LocalSearchScopeRule,
  NormalizedSiteSearchProvider,
  SearchEngineState,
  SearchSourceType,
  SiteSearchProvider
} from '../types';
import { normalizeHost } from './direct-navigation';
import { DEFAULT_SITE_SEARCH_PROVIDERS } from './search-policy';

type Providers = readonly SiteSearchProvider[] | null | undefined;

// A provider as settings may hold it: a stored entry with any of the
// provider fields, possibly missing or malformed.
type ProviderInput = Partial<SiteSearchProvider> | null | undefined;

// Stored entries may be objects of any shape; normalizeSiteSearchProvider
// reads each field defensively, so any object can stand in for a provider.
function isProviderEntry(value: unknown): value is Partial<SiteSearchProvider> {
  return Boolean(value) && typeof value === 'object';
}

function normalizeSiteSearchTemplate(template: unknown): string {
  if (!template) {
    return '';
  }
  return String(template)
    .trim()
    .replace(/\{\{\{s\}\}\}/g, '{query}')
    .replace(/\{s\}/g, '{query}')
    .replace(/\{searchTerms\}/g, '{query}');
}

function isLocalSearchSourceType(value: string): value is SearchSourceType {
  return value === 'topSite' || value === 'bookmark' || value === 'history';
}

function normalizeLocalSearchScopeTrigger(value: unknown): string {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function findLocalSearchScope(input: unknown, rules: ReadonlyArray<LocalSearchScopeRule | null | undefined> | null | undefined): LocalSearchScope | null {
  const trigger = normalizeLocalSearchScopeTrigger(input);
  if (!trigger || !Array.isArray(rules)) {
    return null;
  }
  for (let i = 0; i < rules.length; i += 1) {
    const rule = rules[i];
    const sourceType = String(rule && rule.searchSourceType ? rule.searchSourceType : '').trim();
    const keys = rule && rule.keys;
    if (!isLocalSearchSourceType(sourceType) || !Array.isArray(keys)) {
      continue;
    }
    const matchedKey = keys.find((key) => normalizeLocalSearchScopeTrigger(key) === trigger);
    if (!matchedKey) {
      continue;
    }
    return {
      sourceType,
      trigger,
      key: String(matchedKey)
    };
  }
  return null;
}

const INTERACTIVE_SITE_SEARCH_SUBMIT_STRATEGIES = Object.freeze([
  'geminiPrompt',
  'chatgptPrompt',
  'doubaoPrompt',
  'qianwenQuery',
  'yuanbaoPrompt',
  'minimaxPrompt',
  'deepseekPrompt',
  'kimiPrompt',
  'copilotPrompt',
  'grokPrompt',
  'qwenChatPrompt',
  'aiStudioPrompt'
]);

const SITE_SEARCH_PROVIDER_DISPLAY_NAME_MESSAGES: Readonly<Record<string, readonly [string, string]>> = Object.freeze({
  gpt: ['site_search_name_chatgpt', 'ChatGPT'],
  gm: ['site_search_name_gemini', 'Gemini'],
  dbai: ['site_search_name_doubao', 'Doubao'],
  qw: ['site_search_name_qianwen', 'Qianwen'],
  yb: ['site_search_name_yuanbao', 'Yuanbao'],
  mx: ['site_search_name_minimax', 'MiniMax'],
  ds: ['site_search_name_deepseek', 'DeepSeek'],
  kimi: ['site_search_name_kimi', 'Kimi'],
  cp: ['site_search_name_copilot', 'Copilot'],
  grok: ['site_search_name_grok', 'Grok'],
  qwen: ['site_search_name_qwen_chat', 'Qwen Chat'],
  ais: ['site_search_name_ai_studio', 'Google AI Studio'],
  metaso: ['site_search_name_metaso', 'Metaso AI Search'],
  bd: ['site_search_name_baidu', 'Baidu'],
  sg: ['site_search_name_sogou', 'Sogou'],
  sm: ['site_search_name_shenma', 'Shenma'],
  zh: ['site_search_name_zhihu', 'Zhihu'],
  db: ['site_search_name_douban', 'Douban'],
  jj: ['site_search_name_juejin', 'Juejin'],
  tb: ['site_search_name_taobao', 'Taobao'],
  tm: ['site_search_name_tmall', 'Tmall'],
  wx: ['site_search_name_wechat', 'WeChat Official Accounts'],
  wb: ['site_search_name_weibo', 'Weibo'],
  xhs: ['site_search_name_xiaohongshu', 'Xiaohongshu'],
  dy: ['site_search_name_douyin', 'Douyin'],
  jd: ['site_search_name_jd', 'JD.com'],
  zw: ['site_search_name_wikipedia', 'Wikipedia'],
  lm: ['site_search_name_lumno_help', 'Lumno Help Center']
});

const HELP_CENTER_SITE_SEARCH_PROVIDER_KEY = 'lm';
const HELP_CENTER_HOST = 'lumno.kubai.design';

function cloneSiteSearchProvider(provider: SiteSearchProvider): SiteSearchProvider {
  return {
    ...provider,
    aliases: Array.isArray(provider.aliases) ? provider.aliases.slice() : []
  };
}

function getSiteSearchProviderDisplayNameMessage(provider: ProviderInput): { messageKey: string; fallback: string } | null {
  if (provider && provider._xIsCustom === true) {
    return null;
  }
  const key = String(provider && provider.key ? provider.key : '').toLowerCase();
  const mapping = SITE_SEARCH_PROVIDER_DISPLAY_NAME_MESSAGES[key];
  if (!mapping) {
    return null;
  }
  return {
    messageKey: mapping[0],
    fallback: mapping[1]
  };
}

// The built-in Lumno Help Center search, also after the person edits it, as long as it
// still searches the help center: its results come from the site's own search index.
function isHelpCenterSiteSearchProvider(provider: ProviderInput): boolean {
  if (!provider || provider._xIsAggregateSearch === true) {
    return false;
  }
  const key = String(provider.builtinKey || provider.key || '').toLowerCase();
  if (key !== HELP_CENTER_SITE_SEARCH_PROVIDER_KEY) {
    return false;
  }
  try {
    const url = new URL(String(provider.template || '').replace(/\{query\}/g, 'test'));
    return normalizeHost(url.hostname) === HELP_CENTER_HOST && url.pathname.startsWith('/help/');
  } catch (e) {
    return false;
  }
}

// Help Center links carry the interface language its results came from (lang=), since the
// site otherwise follows the browser language for pages opened from the extension.
function withHelpCenterLocale(url: string, provider: ProviderInput, locale: unknown): string {
  const lang = String(locale || '').trim().replace(/_/g, '-');
  if (!url || !lang || !isHelpCenterSiteSearchProvider(provider)) {
    return url;
  }
  try {
    const next = new URL(url);
    next.searchParams.set('lang', lang);
    return next.href;
  } catch (e) {
    return url;
  }
}

function getDefaultSiteSearchProviders(): SiteSearchProvider[] {
  return DEFAULT_SITE_SEARCH_PROVIDERS.map(cloneSiteSearchProvider);
}

function isInteractiveSiteSearchSubmitStrategy(strategy: unknown): boolean {
  const value = String(strategy || '').trim();
  return INTERACTIVE_SITE_SEARCH_SUBMIT_STRATEGIES.some((candidate) => candidate === value);
}

function hasOpenAndSubmitSiteSearchAction(provider: ProviderInput): boolean {
  return Boolean(
    provider &&
    String(provider.action || '').trim() === 'openAndSubmit'
  );
}

// A provider's place in the mode menu and its stored order.
function getSearchModeProviderId(provider: ProviderInput): string {
  return `provider:${provider && (provider.key || provider.name) ? (provider.key || provider.name) : ''}`;
}

function isAiSiteSearchProvider(provider: ProviderInput): boolean {
  if (!provider) {
    return false;
  }
  if (String(provider.category || '').trim() === 'aiSearch') {
    return true;
  }
  if (hasOpenAndSubmitSiteSearchAction(provider)) {
    return true;
  }
  const template = normalizeSiteSearchTemplate(provider.template);
  return Boolean(template) && !template.includes('{query}');
}

const SEARCH_ENGINE_SITE_SEARCH_PROVIDER_KEYS = new Set([
  'bd',
  'bi',
  'gg',
  'kg',
  'ddg',
  'br',
  'eco',
  'sg',
  'yh',
  'yx',
  'sm'
]);

function isRetiredSearchEngineState(searchEngineState: SearchEngineState | null | undefined): boolean {
  const state: SearchEngineState = searchEngineState && typeof searchEngineState === 'object'
    ? searchEngineState
    : {};
  const stateId = String(state.id || '').trim().toLowerCase();
  const stateHost = normalizeHost(state.host) || getUrlHost(state.searchTemplate);
  return stateId === 'so' || stateHost === 'so.com' || stateHost.endsWith('.so.com');
}

function isSearchEngineSiteSearchProvider(provider: ProviderInput): boolean {
  if (!provider) {
    return false;
  }
  const category = String(provider.category || '').trim();
  if (category === 'searchEngine') {
    return true;
  }
  if (provider._xIsCustom === true) {
    return false;
  }
  const key = String(provider.key || '').trim().toLowerCase();
  return SEARCH_ENGINE_SITE_SEARCH_PROVIDER_KEYS.has(key);
}

// The provider for the browser's search engine: a listed one where it can
// be told apart, else one made from the engine's own template.
function sameText(value: unknown, expected: string): boolean {
  return String(value || '').trim().toLowerCase() === expected;
}

// The listed engine the browser's default search engine is: by host, then
// name, then id.
function findListedEngine(
  state: SearchEngineState,
  engineProviders: readonly SiteSearchProvider[],
  stateHost: string
): SiteSearchProvider | null {
  const stateName = String(state.name || '').trim().toLowerCase();
  const stateId = String(state.id || '').trim().toLowerCase();
  return (stateHost && engineProviders.find((provider) => siteSearchHostsMatch(stateHost, getSiteSearchProviderHost(provider)))) ||
    (stateName && engineProviders.find((provider) => sameText(provider && provider.name, stateName))) ||
    (stateId && engineProviders.find((provider) => {
      const aliases = provider && provider.aliases;
      return Array.isArray(aliases) && aliases.some((alias: unknown) => sameText(alias, stateId));
    })) ||
    null;
}

// An engine this list does not know, from the template the browser reports.
function createDetectedEngine(state: SearchEngineState, stateHost: string, template: string): SiteSearchProvider {
  const stateName = String(state.name || '').trim().toLowerCase();
  const stateId = String(state.id || '').trim().toLowerCase();
  const keyToken = (stateId || stateHost || stateName || 'detected')
    .replace(/[^a-z0-9.-]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'detected';
  return {
    key: `engine-${keyToken}`,
    aliases: stateId ? [stateId] : [],
    name: String(state.name || state.host || state.id || '').trim() || 'Search',
    template,
    category: 'searchEngine',
    _xIsDetectedSearchEngine: true
  };
}

function getSearchEngineSiteSearchProvider(
  searchEngineState: SearchEngineState | null | undefined,
  providers: readonly SiteSearchProvider[] | null | undefined
): SiteSearchProvider | null {
  const state: SearchEngineState = searchEngineState && typeof searchEngineState === 'object'
    ? searchEngineState
    : {};
  const engineProviders: SiteSearchProvider[] = (Array.isArray(providers) ? providers : [])
    .filter(isSearchEngineSiteSearchProvider);
  const fallbackProvider = findSiteSearchProvider('google', engineProviders);
  if (isRetiredSearchEngineState(state)) {
    return fallbackProvider || null;
  }
  const stateHost = normalizeHost(state.host) || getUrlHost(state.searchTemplate);
  const listed = findListedEngine(state, engineProviders, stateHost);
  const normalizedTemplate = normalizeSiteSearchTemplate(state.searchTemplate);
  if (listed) {
    // A regional site of a listed engine, such as yandex.ru, keeps its own address.
    const onOtherSite = stateHost && normalizedTemplate.includes('{query}') &&
      getUrlHost(normalizedTemplate) === stateHost &&
      !siteSearchHostsMatch(stateHost, getSiteSearchProviderHost(listed));
    return onOtherSite ? { ...listed, template: normalizedTemplate } : listed;
  }
  if (!normalizedTemplate || !normalizedTemplate.includes('{query}')) {
    return fallbackProvider || null;
  }
  return createDetectedEngine(state, stateHost, normalizedTemplate);
}

function isInteractiveSiteSearchProvider(provider: ProviderInput): boolean {
  return Boolean(
    hasOpenAndSubmitSiteSearchAction(provider) &&
    provider && isInteractiveSiteSearchSubmitStrategy(provider.submitStrategy)
  );
}

// A stored provider, filled in from the built-in it started from; null
// when it has no key or no usable template.
// A field from the entry, or from the provider it customizes.
function inheritedText(item: ProviderInput, baseProvider: ProviderInput, field: keyof SiteSearchProvider): string {
  return String((item && item[field]) || (baseProvider && baseProvider[field]) || '').trim();
}

function inheritedAliases(item: ProviderInput, baseProvider: ProviderInput): string[] {
  const itemAliases = item && item.aliases;
  const baseAliases = baseProvider && baseProvider.aliases;
  const aliasSource: readonly unknown[] = Array.isArray(itemAliases)
    ? itemAliases
    : (Array.isArray(baseAliases) ? baseAliases : []);
  return aliasSource.filter((alias): alias is string => typeof alias === 'string' && Boolean(alias));
}

// A provider needs a key and a template with {query}; an AI provider's page
// takes the prompt without one.
function hasUsableTemplate(item: ProviderInput, baseProvider: ProviderInput, key: string, template: string): boolean {
  return Boolean(key && template) && (template.includes('{query}') || isAiSiteSearchProvider({
    ...(baseProvider || {}),
    ...(item || {}),
    key,
    template
  }));
}

function normalizeSiteSearchProvider(item: ProviderInput, baseProvider?: ProviderInput): NormalizedSiteSearchProvider | null {
  if (!item && !baseProvider) {
    return null;
  }
  const key = inheritedText(item, baseProvider, 'key');
  const template = normalizeSiteSearchTemplate(inheritedText(item, baseProvider, 'template'));
  if (!hasUsableTemplate(item, baseProvider, key, template)) {
    return null;
  }
  const provider: NormalizedSiteSearchProvider = {
    id: inheritedText(item, baseProvider, 'id'),
    key,
    aliases: inheritedAliases(item, baseProvider),
    name: String(inheritedText(item, baseProvider, 'name') || key).trim() || key,
    template,
    action: inheritedText(item, baseProvider, 'action'),
    submitStrategy: inheritedText(item, baseProvider, 'submitStrategy'),
    category: inheritedText(item, baseProvider, 'category'),
    disabled: Boolean(item && item.disabled),
    disabledReason: String((item && item.disabledReason) || '').trim(),
    icon: inheritedText(item, baseProvider, 'icon'),
    iconUrl: inheritedText(item, baseProvider, 'iconUrl')
  };
  const builtinKey = inheritedText(item, baseProvider, 'builtinKey').toLowerCase();
  if (builtinKey) {
    provider.builtinKey = builtinKey;
  }
  return provider;
}

function sanitizeSiteSearchProviders(items: unknown, baseItems?: unknown): NormalizedSiteSearchProvider[] {
  const baseEntries: unknown[] = Array.isArray(baseItems) ? baseItems : [];
  const baseMap = new Map<string, ProviderInput>(baseEntries.filter(isProviderEntry).map((item): [string, ProviderInput] => [
    String(item.key || '').toLowerCase(),
    item
  ]));
  const entries: unknown[] = Array.isArray(items) ? items : [];
  return entries
    .map((entry) => {
      const item = isProviderEntry(entry) ? entry : null;
      const key = String(item && item.key ? item.key : '').toLowerCase();
      const builtinKey = String(item && item.builtinKey ? item.builtinKey : '').toLowerCase();
      return normalizeSiteSearchProvider(item, baseMap.get(builtinKey || key));
    })
    .filter((provider): provider is NormalizedSiteSearchProvider => Boolean(provider));
}

function inheritSiteSearchProviderBehavior<T extends SiteSearchProvider>(provider: T, baseProvider?: ProviderInput): T {
  if (!provider) {
    return provider;
  }
  return {
    ...provider,
    action: String(provider.action || (baseProvider && baseProvider.action) || '').trim(),
    submitStrategy: String(
      provider.submitStrategy || (baseProvider && baseProvider.submitStrategy) || ''
    ).trim()
  };
}

// The reader's providers first (marked _xIsCustom), then the built-ins
// they do not replace.
function mergeCustomProviders(
  baseItems: readonly SiteSearchProvider[] | null | undefined,
  customItems: readonly SiteSearchProvider[] | null | undefined
): SiteSearchProvider[] {
  const merged: SiteSearchProvider[] = [];
  const seen = new Set<string>();
  const baseMap = new Map((baseItems || []).map((item): [string, SiteSearchProvider] => [String(item && item.key ? item.key : '').toLowerCase(), item]));
  (customItems || []).forEach((item) => {
    if (item && item.disabled) {
      return;
    }
    const key = String(item && item.key ? item.key : '').toLowerCase();
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    const builtinKey = String(item && item.builtinKey ? item.builtinKey : '').toLowerCase();
    merged.push({
      ...inheritSiteSearchProviderBehavior(item, baseMap.get(builtinKey || key)),
      _xIsCustom: true
    });
  });
  (baseItems || []).forEach((item) => {
    const key = String(item && item.key ? item.key : '').toLowerCase();
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    merged.push(item);
  });
  return merged;
}

function buildSearchUrlFromTemplate(template: unknown, query: unknown): string {
  const normalizedTemplate = normalizeSiteSearchTemplate(template);
  if (!normalizedTemplate) {
    return '';
  }
  if (!normalizedTemplate.includes('{query}')) {
    return normalizedTemplate;
  }
  return normalizedTemplate.replace(/\{query\}/g, encodeURIComponent(String(query || '')));
}

function buildBlacklistProbeUrlFromTemplate(template: unknown, query: unknown): string {
  return buildSearchUrlFromTemplate(template, String(query || '').trim() || 'test');
}

function getUrlHost(url: unknown): string {
  if (!url) {
    return '';
  }
  try {
    return normalizeHost(new URL(String(url)).hostname);
  } catch (e) {
    return '';
  }
}

function siteSearchHostsMatch(a: unknown, b: unknown): boolean {
  const hostA = normalizeHost(a);
  const hostB = normalizeHost(b);
  if (!hostA || !hostB) {
    return false;
  }
  return hostA === hostB || hostA.endsWith(`.${hostB}`) || hostB.endsWith(`.${hostA}`);
}

function getSiteSearchProviderHost(provider: Pick<Partial<SiteSearchProvider>, 'template'> | null | undefined): string {
  if (!provider || !provider.template) {
    return '';
  }
  try {
    const url = String(provider.template).replace(/\{query\}/g, 'test');
    return normalizeHost(new URL(url).hostname);
  } catch (e) {
    return '';
  }
}

// By key, name or alias.
function findSiteSearchProvider(trigger: unknown, providers: Providers): SiteSearchProvider | null {
  const key = String(trigger || '').trim().toLowerCase();
  if (!key) {
    return null;
  }
  return (providers || []).find((provider) => {
    const providerKey = String(provider && provider.key || '').toLowerCase();
    if (providerKey === key) {
      return true;
    }
    if (provider && provider._xIsAggregateSearch === true) {
      return false;
    }
    const providerName = String(provider && provider.name || '').trim().toLowerCase();
    if (providerName === key) {
      return true;
    }
    const providerAliases = provider && provider.aliases;
    const aliases: unknown[] = Array.isArray(providerAliases) ? providerAliases : [];
    return aliases.some((alias) => String(alias).toLowerCase() === key);
  }) || null;
}

export {
  getSearchModeProviderId,
  buildBlacklistProbeUrlFromTemplate,
  buildSearchUrlFromTemplate,
  findLocalSearchScope,
  findSiteSearchProvider,
  getDefaultSiteSearchProviders,
  getSearchEngineSiteSearchProvider,
  getSiteSearchProviderDisplayNameMessage,
  getSiteSearchProviderHost,
  getUrlHost,
  hasOpenAndSubmitSiteSearchAction,
  inheritSiteSearchProviderBehavior,
  isAiSiteSearchProvider,
  isHelpCenterSiteSearchProvider,
  isInteractiveSiteSearchProvider,
  isInteractiveSiteSearchSubmitStrategy,
  isRetiredSearchEngineState,
  isSearchEngineSiteSearchProvider,
  mergeCustomProviders,
  normalizeSiteSearchProvider,
  normalizeSiteSearchTemplate,
  sanitizeSiteSearchProviders,
  siteSearchHostsMatch,
  withHelpCenterLocale
};
