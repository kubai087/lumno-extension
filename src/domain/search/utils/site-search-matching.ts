// Matching site search providers: provider hosts and path scopes, the
// provider for a page, for a key or typed prefix, and for a suggestion,
// and the trigger candidate for what is typed.
import type { SiteSearchProvider, SuggestionLike } from '../types';
import { normalizeHost } from './direct-navigation';
import { buildSearchUrlFromTemplate, findSiteSearchProvider, getSiteSearchProviderHost, getUrlHost, isAiSiteSearchProvider, isSearchEngineSiteSearchProvider, normalizeSiteSearchTemplate, siteSearchHostsMatch } from './site-search-providers';
import { hasSearchLiteral, normalizeSearchText, splitSearchTitleTokens } from './text-normalize';

type Providers = readonly SiteSearchProvider[] | null | undefined;
type MaybeProvider = SiteSearchProvider | null | undefined;
type MaybeSuggestion = SuggestionLike | null | undefined;

interface InlineSiteSearchCandidate {
  provider: SiteSearchProvider;
  query: string;
}

interface TriggerCandidateOptions {
  matchesTopSitePrefix?: (topSiteMatch: SuggestionLike, input: string) => boolean;
}

const SITE_SEARCH_QUERY_PROBE = '__lumno_site_search_query__';

function getSearchSuggestionHost(suggestion: MaybeSuggestion): string {
  return getUrlHost(suggestion && suggestion.url);
}

function siteSearchPageHostMatchesProvider(pageHost: string, providerHost: string): boolean {
  const normalizedPageHost = normalizeHost(pageHost);
  const normalizedProviderHost = normalizeHost(providerHost);
  if (!normalizedPageHost || !normalizedProviderHost) {
    return false;
  }
  return normalizedPageHost === normalizedProviderHost ||
    normalizedPageHost.endsWith(`.${normalizedProviderHost}`);
}

function getSiteSearchProviderPathScope(provider: MaybeProvider): string {
  const template = normalizeSiteSearchTemplate(provider && provider.template);
  if (!template) {
    return '';
  }
  try {
    const url = new URL(buildSearchUrlFromTemplate(template, 'scope'));
    const firstPathSegment = url.pathname.split('/').filter(Boolean)[0] || '';
    return firstPathSegment ? `/${firstPathSegment}` : '';
  } catch (e) {
    return '';
  }
}

// The site search of the site a page is on (not a search engine or AI).
function findSiteSearchProviderForPageUrl(pageUrl: unknown, providers: Providers): SiteSearchProvider | null {
  let parsedPageUrl: URL;
  try {
    parsedPageUrl = new URL(String(pageUrl || ''));
  } catch (e) {
    return null;
  }
  const pageHost = normalizeHost(parsedPageUrl.hostname);
  if (!pageHost) {
    return null;
  }
  const providerItems: readonly SiteSearchProvider[] = Array.isArray(providers) ? providers : [];
  const searchEngineHosts = new Set(
    providerItems
      .filter(isSearchEngineSiteSearchProvider)
      .map(getSiteSearchProviderHost)
      .filter(Boolean)
  );
  return providerItems.find((provider) => {
    if (isSearchEngineSiteSearchProvider(provider) || isAiSiteSearchProvider(provider)) {
      return false;
    }
    const providerHost = getSiteSearchProviderHost(provider);
    if (!siteSearchPageHostMatchesProvider(pageHost, providerHost)) {
      return false;
    }
    if (!searchEngineHosts.has(providerHost)) {
      return true;
    }
    if (pageHost !== providerHost) {
      return false;
    }
    const pathScope = getSiteSearchProviderPathScope(provider);
    const pagePath = parsedPageUrl.pathname || '/';
    return Boolean(
      pathScope &&
      (pagePath === pathScope || pagePath.startsWith(`${pathScope}/`))
    );
  }) || null;
}

function findSiteSearchProviderByKey(trigger: unknown, providers: Providers): SiteSearchProvider | null {
  const key = String(trigger || '').toLowerCase();
  if (!key) {
    return null;
  }
  return (providers || []).find((provider) => String(provider && provider.key || '').toLowerCase() === key) || null;
}

function findSiteSearchProviderKeyConflict(trigger: unknown, providers: Providers, allowedKey: unknown): SiteSearchProvider | null {
  const key = String(trigger || '').trim().toLowerCase();
  const allowed = String(allowedKey || '').trim().toLowerCase();
  if (!key || key === allowed) {
    return null;
  }
  return findSiteSearchProviderByKey(key, providers);
}

function suggestionMatchesSiteSearchProvider(suggestion: MaybeSuggestion, provider: MaybeProvider): boolean {
  if (!suggestion || !provider || !suggestion.url) {
    return false;
  }
  return siteSearchHostsMatch(getSearchSuggestionHost(suggestion), getSiteSearchProviderHost(provider));
}

function isAsciiProviderToken(token: string): boolean {
  return /^[a-z0-9]+$/i.test(token || '');
}

function isSiteSearchProviderTokenEligible(token: unknown): boolean {
  if (!token) {
    return false;
  }
  const normalized = String(token).trim();
  if (!normalized) {
    return false;
  }
  if (isAsciiProviderToken(normalized)) {
    return normalized.length >= 3;
  }
  return normalized.length >= 2;
}

function providerMatchesSiteSearchSuggestion(provider: MaybeProvider, suggestion: MaybeSuggestion): boolean {
  if (!provider || !suggestion) {
    return false;
  }
  return suggestionMatchesSiteSearchProvider(suggestion, provider);
}

function findProviderForSiteSearchSuggestion(suggestion: MaybeSuggestion, providers: Providers): SiteSearchProvider | null {
  if (!suggestion) {
    return null;
  }
  const eligibleTypes = new Set(['topSite', 'history', 'bookmark']);
  if (!eligibleTypes.has(String(suggestion.type)) && !suggestion.isTopSite) {
    return null;
  }
  return (providers || []).find((provider) => providerMatchesSiteSearchSuggestion(provider, suggestion)) || null;
}

// By the first word typed: a key, name or alias, or a host.
function findSiteSearchProviderByInput(input: unknown, providers: Providers): SiteSearchProvider | null {
  const raw = String(input || '').trim();
  if (!raw) {
    return null;
  }
  const firstToken = raw.split(/\s+/)[0];
  const keyMatch = findSiteSearchProvider(firstToken, providers) ||
    findSiteSearchProviderByKey(firstToken, providers);
  if (keyMatch) {
    return keyMatch;
  }
  let host = '';
  if (/[./]/.test(firstToken)) {
    try {
      const url = firstToken.includes('://') ? firstToken : `https://${firstToken}`;
      host = new URL(url).hostname;
    } catch (e) {
      host = firstToken.split('/')[0] || '';
    }
  }
  if (!host) {
    return null;
  }
  const normalizedHost = normalizeHost(host);
  return (providers || []).find((provider) => siteSearchHostsMatch(
    normalizedHost,
    getSiteSearchProviderHost(provider)
  )) || null;
}

// "yt cats": the provider and the query after it.
function getInlineSiteSearchCandidate(input: unknown, providers: Providers): InlineSiteSearchCandidate | null {
  const raw = String(input || '').trim();
  if (!raw) {
    return null;
  }
  const tokens = raw.split(/\s+/);
  if (tokens.length < 2) {
    return null;
  }
  const provider = findSiteSearchProviderByInput(raw, providers);
  if (!provider) {
    return null;
  }
  const firstToken = tokens[0];
  const remainder = raw.slice(raw.indexOf(firstToken) + firstToken.length).trim();
  if (!remainder) {
    return null;
  }
  return { provider: provider, query: remainder };
}

function tokenMatchesInput(token: string, needle: string): boolean {
  return Boolean(token) && (token === needle || (needle.length >= 2 && token.startsWith(needle)));
}

// The provider's key, name, aliases or the first label of its host start
// with the input; an aggregate search matches by its key only.
function providerMatchesSiteSearchInputPrefix(provider: MaybeProvider, input: unknown): boolean {
  const needle = String(input || '').toLowerCase();
  if (!needle || !provider) {
    return false;
  }
  const tokens = provider._xIsAggregateSearch === true
    ? [provider.key]
    : [provider.key, provider.name].concat(provider.aliases || []);
  if (tokens.some((token) => tokenMatchesInput(String(token || '').toLowerCase(), needle))) {
    return true;
  }
  const host = normalizeHost(getSiteSearchProviderHost(provider));
  return Boolean(host) && tokenMatchesInput(host.split('.')[0] || host, needle);
}

function siteSearchTemplatePartMatchesCandidate(candidatePart: string, probePart: string): boolean {
  const candidateValue = String(candidatePart || '');
  const probeValue = String(probePart || '');
  if (!probeValue.includes(SITE_SEARCH_QUERY_PROBE)) {
    return candidateValue === probeValue;
  }
  const markerIndex = probeValue.indexOf(SITE_SEARCH_QUERY_PROBE);
  const prefix = probeValue.slice(0, markerIndex);
  const suffix = probeValue.slice(markerIndex + SITE_SEARCH_QUERY_PROBE.length);
  return candidateValue.startsWith(prefix) &&
    candidateValue.endsWith(suffix) &&
    candidateValue.length > prefix.length + suffix.length;
}

function isSiteSearchProviderSearchResultUrl(suggestion: MaybeSuggestion, provider: MaybeProvider): boolean {
  const template = normalizeSiteSearchTemplate(provider && provider.template);
  if (!template || !template.includes('{query}') || !suggestion || !suggestion.url) {
    return false;
  }
  try {
    const candidateUrl = new URL(String(suggestion.url));
    const probeUrl = new URL(buildSearchUrlFromTemplate(template, SITE_SEARCH_QUERY_PROBE));
    if (!siteSearchHostsMatch(candidateUrl.hostname, probeUrl.hostname)) {
      return false;
    }
    if (!siteSearchTemplatePartMatchesCandidate(candidateUrl.pathname, probeUrl.pathname)) {
      return false;
    }
    if (probeUrl.pathname.includes(SITE_SEARCH_QUERY_PROBE)) {
      return true;
    }
    let queryParamMatches = false;
    probeUrl.searchParams.forEach((value, key) => {
      if (String(value || '').includes(SITE_SEARCH_QUERY_PROBE) && candidateUrl.searchParams.has(key)) {
        queryParamMatches = true;
      }
    });
    if (queryParamMatches) {
      return true;
    }
    return probeUrl.hash.includes(SITE_SEARCH_QUERY_PROBE) &&
      siteSearchTemplatePartMatchesCandidate(candidateUrl.hash, probeUrl.hash);
  } catch (e) {
    return false;
  }
}

function siteSearchSuggestionTitleMatchesInput(suggestion: MaybeSuggestion, input: unknown): boolean {
  const needle = String(input || '').trim().toLowerCase();
  if (!isSiteSearchProviderTokenEligible(needle)) {
    return false;
  }
  const title = String(suggestion && suggestion.title || '').trim();
  const titleLower = normalizeSearchText(title);
  if (!titleLower) {
    return false;
  }
  if (titleLower === needle || titleLower.startsWith(needle)) {
    return true;
  }
  const titleTokens = splitSearchTitleTokens(title);
  return titleTokens.includes(needle) ||
    titleTokens.some((token) => token.startsWith(needle)) ||
    hasSearchLiteral(titleLower, needle);
}

function providerMatchesSiteSearchSuggestionTitle(provider: MaybeProvider, suggestion: MaybeSuggestion, input: unknown): boolean {
  if (!provider || !suggestion || !suggestionMatchesSiteSearchProvider(suggestion, provider)) {
    return false;
  }
  if (isSiteSearchProviderSearchResultUrl(suggestion, provider)) {
    return false;
  }
  return siteSearchSuggestionTitleMatchesInput(suggestion, input);
}

// The provider a site-search tag would offer for what is typed, using the
// top site match when the input only names its site.
// The provider behind the top site the input already matches.
function findTopSiteProvider(providers: Providers, topSiteMatch: SuggestionLike, trimmed: string): SiteSearchProvider | null {
  return (providers || []).find((candidate) => {
    if (!suggestionMatchesSiteSearchProvider(topSiteMatch, candidate)) {
      return false;
    }
    return providerMatchesSiteSearchInputPrefix(candidate, trimmed) ||
      providerMatchesSiteSearchSuggestionTitle(candidate, topSiteMatch, trimmed);
  }) || null;
}

// A one- or two-letter input that already completes a top site only offers
// that site's own search.
function conflictsWithTopSite(
  provider: SiteSearchProvider,
  topSiteMatch: SuggestionLike | null | undefined,
  trimmed: string,
  options: TriggerCandidateOptions | null | undefined
): boolean {
  const matchesTopSitePrefix = options && typeof options.matchesTopSitePrefix === 'function'
    ? options.matchesTopSitePrefix
    : null;
  if (!topSiteMatch || trimmed.length > 2 || !matchesTopSitePrefix || !matchesTopSitePrefix(topSiteMatch, trimmed)) {
    return false;
  }
  return !siteSearchHostsMatch(getSiteSearchProviderHost(provider), getSearchSuggestionHost(topSiteMatch));
}

function getSiteSearchTriggerCandidate(
  input: unknown,
  providers: Providers,
  topSiteMatch?: SuggestionLike | null,
  options?: TriggerCandidateOptions | null
): SiteSearchProvider | null {
  const trimmed = String(input || '').trim();
  if (!trimmed) {
    return null;
  }
  const exactProvider = findSiteSearchProvider(trimmed, providers) ||
    findSiteSearchProviderByKey(trimmed, providers);
  if (/\s/.test(trimmed) && !exactProvider) {
    return null;
  }
  const provider = exactProvider ||
    findSiteSearchProviderByInput(trimmed, providers) ||
    (topSiteMatch ? findTopSiteProvider(providers, topSiteMatch, trimmed) : null);
  if (!provider || conflictsWithTopSite(provider, topSiteMatch, trimmed, options)) {
    return null;
  }
  return provider;
}

export {
  findProviderForSiteSearchSuggestion,
  findSiteSearchProviderByInput,
  findSiteSearchProviderByKey,
  findSiteSearchProviderForPageUrl,
  findSiteSearchProviderKeyConflict,
  getInlineSiteSearchCandidate,
  getSearchSuggestionHost,
  getSiteSearchTriggerCandidate,
  isSiteSearchProviderTokenEligible,
  providerMatchesSiteSearchInputPrefix,
  providerMatchesSiteSearchSuggestion,
  suggestionMatchesSiteSearchProvider
};
export type { InlineSiteSearchCandidate };
