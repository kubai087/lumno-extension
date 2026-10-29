// URL classification, favicon source policy and the search/favicon blacklists
// used by New Tab suggestions, recent sites and favicons.
import * as LumnoUrlGuards from '../platform/url-guards';
import type { Translate } from './newtab-types';
import * as FaviconCanonical from '../domain/favicon/canonical';
import * as FaviconHostPolicy from '../domain/favicon/host-policy';
import type { FaviconUrlResolver } from '../domain/favicon/resolver';
import * as SearchBrandSuggestions from '../domain/search/utils/brand-suggestions';
import { faviconEnhancedFetchEnabled, faviconRequestBlacklist, searchBlacklist, searchResultDisplayLimit } from '../domain/settings/search';
import type { SettingsStore } from '../platform/settings-store';
import * as EXTENSION_ROUTES from '../domain/extension-routes';
import * as BLACKLIST_UTILS from '../domain/blacklist-utils';
import * as FaviconDecisionLog from '../domain/favicon/decision-log';
import * as FaviconResolver from '../domain/favicon/resolver';

// What the search blacklist reads from a suggestion.
interface BlacklistableSuggestion {
  type?: string;
  url?: string;
}

interface UrlPolicyDeps {
  settings: Pick<SettingsStore, 'get'>;
  t: Translate;
  // The browser's own icon for a page, where _favicon is missing (Firefox).
  getBrowserIconUrl?: (pageUrl: string) => string;
}

function createUrlPolicy(deps: UrlPolicyDeps) {
  const {
    settings,
    t,
    getBrowserIconUrl
  } = deps;


  function isEnglishQuery(query: string | null | undefined): boolean {
    if (!query) {
      return false;
    }
    return /^[A-Za-z0-9\s._/-]+$/.test(query);
  }

  function getUrlDisplay(url: string | null | undefined): string {
    if (!url) {
      return '';
    }
    const ownExtensionDisplay = getOwnExtensionPageDisplay(url);
    if (ownExtensionDisplay) {
      return ownExtensionDisplay.urlText;
    }
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./i, '');
      const path = parsed.pathname === '/' ? '' : parsed.pathname;
      return `${host}${path}${parsed.search || ''}${parsed.hash || ''}`;
    } catch {
      return url;
    }
  }

  function isBrowserExtensionProtocol(protocol: unknown): boolean {
    const guards = LumnoUrlGuards;
    return guards.isBrowserExtensionProtocol(protocol);
  }

  function isBrowserNewtabUrl(url: unknown): boolean {
    const guards = LumnoUrlGuards;
    return guards.isBrowserNewtabUrl(url);
  }

  function isBrowserInternalUrl(url: unknown): boolean {
    const guards = LumnoUrlGuards;
    return guards.isBrowserInternalUrl(url);
  }

  function isBrowserPageRecentUrl(url: string | null | undefined): boolean {
    return Boolean(url && isBrowserInternalUrl(url) && !isBrowserNewtabUrl(url));
  }

  function isOwnExtensionUrl(url: string | null | undefined): boolean {
    if (!url || !chrome || !chrome.runtime || !chrome.runtime.id) {
      return false;
    }
    try {
      const parsed = new URL(url);
      return isBrowserExtensionProtocol(parsed.protocol) &&
        String(parsed.hostname || '') === String(chrome.runtime.id);
    } catch {
      return false;
    }
  }

  function getOwnExtensionPageLabel(url: string | null | undefined): string {
    if (!url || !isOwnExtensionUrl(url)) {
      return '';
    }
    try {
      const routeType = EXTENSION_ROUTES.classifyExtensionUrl(url);
      if (routeType === 'newtab') {
        return t('newtab_page_label', '新标签页');
      }
      if (routeType === 'options') {
        return t('settings_title', '设置');
      }
      const parsed = new URL(url);
      const path = String(parsed.pathname || '').toLowerCase();
      if (path.endsWith('/newtab.html') || path === '/newtab.html') {
        return t('newtab_page_label', '新标签页');
      }
      if (path.endsWith('/options.html') || path === '/options.html') {
        return t('settings_title', '设置');
      }
      return t('extension_page_label', '扩展页面');
    } catch {
      return t('extension_page_label', '扩展页面');
    }
  }

  function getOwnExtensionPageDisplay(
    url: string | null | undefined,
    title?: unknown
  ): { siteName: string; titleText: string; urlText: string } | null {
    if (!isOwnExtensionUrl(url)) {
      return null;
    }
    const pageLabel = getOwnExtensionPageLabel(url);
    const rawTitle = String(title || '').trim();
    const runtimeId = String(chrome && chrome.runtime && chrome.runtime.id ? chrome.runtime.id : '').toLowerCase();
    const titleLooksLikeId = rawTitle && runtimeId && rawTitle.toLowerCase().includes(runtimeId);
    const titleText = rawTitle && !titleLooksLikeId
      ? rawTitle
      : `Lumno ${pageLabel}`.trim();
    return {
      siteName: 'Lumno',
      titleText: titleText,
      urlText: `Lumno · ${pageLabel}`.trim()
    };
  }

  // Logs why an icon source was skipped, once per site and reason.
  const logFaviconDecision = FaviconDecisionLog.createFaviconDecisionLogger({ surface: 'newtab' });
  const FAVICON_PROXY_SIZE = 128;
  let pageFaviconUrlResolver: FaviconUrlResolver | null = null;

  function getPageFaviconUrlResolver(): FaviconUrlResolver {
    if (!pageFaviconUrlResolver) {
      pageFaviconUrlResolver = FaviconResolver.createFaviconUrlResolver({
        chromeApi: chrome,
        size: FAVICON_PROXY_SIZE,
        shouldBlockFaviconForHost,
        shouldAvoidDirectFaviconForHost,
        isEnhancedFaviconFetchEnabled: isNewtabEnhancedFaviconFetchEnabled,
        getStrictFaviconReason: getNewtabStrictFaviconReason,
        logFaviconDecision
      });
    }
    return pageFaviconUrlResolver;
  }

  function getExtensionFaviconUrl(pageUrl: string): string {
    const resolver = getPageFaviconUrlResolver();
    const extensionUrl = resolver ? resolver.getExtensionFaviconUrl(pageUrl) : '';
    // Without _favicon (Firefox), the browser's own icons stand in for it.
    return extensionUrl || (typeof getBrowserIconUrl === 'function' ? getBrowserIconUrl(pageUrl) : '');
  }

  function getGstaticFaviconUrl(pageUrl: string): string {
    const resolver = getPageFaviconUrlResolver();
    return resolver ? resolver.getGstaticFaviconUrl(pageUrl) : '';
  }

  function getChromeFaviconUrl(pageUrl: string): string {
    const resolver = getPageFaviconUrlResolver();
    return resolver ? resolver.getChromeFaviconUrl(pageUrl) : '';
  }

  function getBrowserPageFaviconUrl(pageUrl: string): string {
    const resolver = getPageFaviconUrlResolver();
    return resolver ? resolver.getBrowserPageFaviconUrl(pageUrl) : '';
  }

  function getPageFaviconCandidateUrl(pageUrl: string): string {
    const resolver = getPageFaviconUrlResolver();
    return resolver ? resolver.getPageFaviconCandidateUrl(pageUrl) : '';
  }

  function getPageFaviconRenderCandidates(
    pageUrl: Parameters<FaviconUrlResolver['getPageFaviconRenderCandidates']>[0],
    explicitUrl?: Parameters<FaviconUrlResolver['getPageFaviconRenderCandidates']>[1],
    options?: Parameters<FaviconUrlResolver['getPageFaviconRenderCandidates']>[2]
  ): ReturnType<FaviconUrlResolver['getPageFaviconRenderCandidates']> {
    const resolver = getPageFaviconUrlResolver();
    return resolver && typeof resolver.getPageFaviconRenderCandidates === 'function'
      ? resolver.getPageFaviconRenderCandidates(pageUrl, explicitUrl, options)
      : { primaryUrl: '', browserUrl: '' };
  }

  function isLocalNetworkHost(hostname: string): boolean {
    return FaviconHostPolicy.isLocalNetworkHost(hostname);
  }

  function shouldBlockFaviconForHost(hostname: string): boolean {
    return FaviconHostPolicy.shouldBlockFaviconForHost(hostname);
  }

  function shouldAvoidDirectFaviconForHost(hostname: string): boolean {
    return FaviconHostPolicy.shouldAvoidDirectFaviconForHost(hostname);
  }

  function getFaviconRequestMatchUrl(url: unknown): string {
    const raw = String(url || '').trim();
    if (!raw) {
      return '';
    }
    return String(FaviconCanonical.getCanonicalPageUrlForFavicon(raw) || raw).trim();
  }

  function isUrlBlockedByFaviconRequestBlacklist(url: unknown): boolean {
    const target = getFaviconRequestMatchUrl(url);
    return Boolean(
      target &&
      BLACKLIST_UTILS.isUrlBlocked &&
      BLACKLIST_UTILS.isUrlBlocked(target, BLACKLIST_UTILS.normalizeItems(settings.get(faviconRequestBlacklist), 'prefix'))
    );
  }

  function getNewtabStrictFaviconReason(pageUrl: unknown): '' | 'exclusion' | 'global-off' {
    if (isUrlBlockedByFaviconRequestBlacklist(pageUrl)) {
      return 'exclusion';
    }
    if (!settings.get(faviconEnhancedFetchEnabled)) {
      return 'global-off';
    }
    return '';
  }

  function isNewtabEnhancedFaviconFetchEnabled(pageUrl: unknown): boolean {
    return getNewtabStrictFaviconReason(pageUrl) === '';
  }

  function isUrlBlockedBySearchBlacklist(url: unknown): boolean {
    return BLACKLIST_UTILS.isUrlBlocked
      ? BLACKLIST_UTILS.isUrlBlocked(url, BLACKLIST_UTILS.normalizeItems(settings.get(searchBlacklist), 'prefix'))
      : false;
  }

  function isSuggestionBlockedBySearchBlacklist(suggestion: BlacklistableSuggestion | null | undefined): boolean {
    if (!suggestion) {
      return false;
    }
    if (
      suggestion.type === 'newtab' ||
      suggestion.type === 'siteSearch' ||
      suggestion.type === 'inlineSiteSearch' ||
      suggestion.type === 'siteSearchPrompt'
    ) {
      return false;
    }
    if (suggestion.url && isUrlBlockedBySearchBlacklist(suggestion.url)) {
      return true;
    }
    return false;
  }

  function filterBlacklistedSuggestions<T extends BlacklistableSuggestion>(
    list: readonly T[] | null | undefined,
    _queryForProvider?: unknown
  ): T[] {
    if (!list || list.length === 0) {
      return [];
    }
    return list.filter((suggestion) => !isSuggestionBlockedBySearchBlacklist(suggestion));
  }

  function limitSuggestionsForDisplay<T>(list: T[] | null | undefined, options?: { uncapped?: boolean } | null): T[] {
    const config = options && typeof options === 'object' ? options : {};
    if (config.uncapped === true) {
      return list || [];
    }
    return SearchBrandSuggestions.limitSearchSuggestionsForDisplay(list, {
      limit: settings.get(searchResultDisplayLimit)
    });
  }

  function shouldExcludeFromRecentSites(url: string | null | undefined): boolean {
    if (!url) {
      return true;
    }
    if (isBrowserNewtabUrl(url)) {
      return true;
    }
    try {
      const parsed = new URL(url);
      if (isBrowserExtensionProtocol(parsed.protocol)) {
        return true;
      }
      return isUrlBlockedBySearchBlacklist(parsed.toString());
    } catch {
      return true;
    }
  }

  return {
    getPageFaviconUrlResolver,
    logFaviconDecision,
    isEnglishQuery,
    getUrlDisplay,
    isBrowserPageRecentUrl,
    isOwnExtensionUrl,
    getOwnExtensionPageDisplay,
    getExtensionFaviconUrl,
    getGstaticFaviconUrl,
    getChromeFaviconUrl,
    getBrowserPageFaviconUrl,
    getPageFaviconCandidateUrl,
    getPageFaviconRenderCandidates,
    isLocalNetworkHost,
    shouldBlockFaviconForHost,
    shouldAvoidDirectFaviconForHost,
    isUrlBlockedByFaviconRequestBlacklist,
    getNewtabStrictFaviconReason,
    isNewtabEnhancedFaviconFetchEnabled,
    filterBlacklistedSuggestions,
    limitSuggestionsForDisplay,
    shouldExcludeFromRecentSites
  };
}

type UrlPolicy = ReturnType<typeof createUrlPolicy>;

export { createUrlPolicy };
export type { UrlPolicy, UrlPolicyDeps };
