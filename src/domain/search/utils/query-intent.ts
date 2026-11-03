// What a query is after: URL clusters, navigation versus information
// intent, source adjustments, term coverage and category adjustments.
import type {
  SearchClusterCategory,
  SearchClusterInfo,
  SearchIntentType,
  SearchQueryContext,
  SearchTermCoverage
} from '../types';
import { getSearchSiteConfig, normalizeHost } from './direct-navigation';
import { matchesSearchHostSpelling, matchesSearchItem, matchesSearchTerm } from './item-matching';
import type { SearchItemFields } from './item-matching';
import { splitSearchTerms } from './text-normalize';
import type { TitleMatchOptions } from './text-matching';

// What the intent checks read from a result.
interface IntentItem {
  url?: string;
  title?: string;
  type?: string;
  isTopSite?: boolean;
}

type QueryTextContext = Pick<SearchQueryContext, 'queryLower'> &
  Partial<Pick<SearchQueryContext, 'coreQueryTerms' | 'queryTerms' | 'queryHostSpellings'>>;

const SEARCH_PATH_INTENT_TERMS = new Set([
  'release',
  'releases',
  'issue',
  'issues',
  'pull',
  'pulls',
  'docs',
  'doc',
  'wiki',
  'guide',
  'guides',
  'pricing',
  'price',
  'download',
  'admin',
  'bookmark',
  'bookmarks',
  'chat',
  'message',
  'messages',
  'dm',
  'dms',
  'setting',
  'settings',
  'profile',
  'account',
  'notification',
  'notifications',
  '设置',
  '通知',
  '文档',
  '价格',
  '下载',
  '发布'
]);

const SEARCH_UTILITY_SEGMENTS = new Set([
  'settings',
  'setting',
  'preferences',
  'preference',
  'prefs',
  'profile',
  'profiles',
  'account',
  'accounts',
  'notification',
  'notifications',
  'activity',
  'activities',
  'like',
  'likes',
  'admin',
  'manage',
  'management',
  'billing',
  'payment',
  'payments',
  'login',
  'signin',
  'sign-in',
  'auth',
  'oauth',
  'callback',
  'checkout',
  'cashier',
  'cart',
  'pay'
]);

const SEARCH_ACTION_SEGMENTS = new Set([
  'new',
  'edit',
  'create',
  'update',
  'delete',
  'compose'
]);

function looksLikeVersionSegment(segment: unknown): boolean {
  const value = String(segment || '').trim().toLowerCase();
  if (!value) {
    return false;
  }
  return /^v?\d+(\.\d+){1,3}([.-][a-z0-9]+)?$/i.test(value);
}

function looksLikeOpaqueIdSegment(segment: unknown): boolean {
  const value = String(segment || '').trim().toLowerCase();
  if (!value) {
    return false;
  }
  if (/^\d+$/.test(value)) {
    return true;
  }
  if (/^[0-9a-f]{8,}$/i.test(value)) {
    return true;
  }
  if (/^[0-9a-f]{8}-[0-9a-f-]{8,}$/i.test(value)) {
    return true;
  }
  return false;
}

function normalizeClusterSegment(segment: unknown): string {
  const value = String(segment || '').trim().toLowerCase();
  if (!value) {
    return '';
  }
  if (looksLikeVersionSegment(value)) {
    return ':version';
  }
  if (looksLikeOpaqueIdSegment(value)) {
    return ':id';
  }
  return value;
}

type ClusterPlace = Pick<SearchClusterInfo, 'host' | 'path'>;

// A GitHub repository: its root, its known areas, its code by folder, and
// everything else under the repository.
function getRepoClusterInfo(place: ClusterPlace, segments: readonly string[]): SearchClusterInfo {
  const { host, path } = place;
  const depth = segments.length;
  const repoBase = `${host}/${segments[0]}/${segments[1]}`;
  if (depth === 2) {
    return { host, category: 'repo-root', clusterKey: repoBase, depth, path };
  }
  const third = segments[2] || '';
  const siteConfig = getSearchSiteConfig(host);
  const repoAreaCategory = siteConfig && siteConfig.repoAreaCategories ? siteConfig.repoAreaCategories.get(third) : undefined;
  if (repoAreaCategory) {
    return { host, category: repoAreaCategory, clusterKey: `${repoBase}/${third}`, depth, path };
  }
  if (third === 'tree' || third === 'blob') {
    const area = segments[4] || segments[3] || 'root';
    return { host, category: 'repo-code', clusterKey: `${repoBase}/code/${area}`, depth, path };
  }
  return { host, category: 'repo-child', clusterKey: `${repoBase}/${third || 'root'}`, depth, path };
}

const USER_SEGMENTS: ReadonlySet<string> = new Set(['u', 'user', 'users', 'profile', 'profiles']);
const LANDING_SEGMENTS: ReadonlySet<string> = new Set(['release', 'releases', 'onboarding', 'changelog']);
const DOCS_SEGMENTS: ReadonlySet<string> = new Set(['docs', 'doc', 'wiki', 'help', 'guide', 'guides']);

// What a page under a site is by its first path segments.
function getPathClusterInfo(place: ClusterPlace, segments: readonly string[]): SearchClusterInfo {
  const { host, path } = place;
  const depth = segments.length;
  const first = segments[0] || '';
  const second = segments[1] || '';
  const utilitySegment = segments.slice(0, 3).find((segment) => SEARCH_UTILITY_SEGMENTS.has(segment));
  if (utilitySegment) {
    return { host, category: 'utility', clusterKey: `${host}/utility/${utilitySegment}`, depth, path };
  }
  // claude.ai/new is where an app starts, not an action under the site.
  if (SEARCH_ACTION_SEGMENTS.has(first) && !(first === 'new' && depth === 1)) {
    return { host, category: 'action', clusterKey: `${host}/action/${first}`, depth, path };
  }
  if (USER_SEGMENTS.has(first) && second) {
    return { host, category: 'user', clusterKey: `${host}/user/${second}`, depth, path };
  }
  if (LANDING_SEGMENTS.has(first)) {
    return { host, category: 'landing', clusterKey: `${host}/${first}`, depth, path };
  }
  if (DOCS_SEGMENTS.has(first)) {
    return { host, category: 'docs', clusterKey: `${host}/${first}/${second || 'root'}`, depth, path };
  }
  if (depth === 1) {
    return { host, category: 'section', clusterKey: `${host}/${first}`, depth, path };
  }
  return { host, category: 'content', clusterKey: `${host}/${first}/${second}`, depth, path };
}

function getSearchSuggestionClusterInfo(url: unknown): SearchClusterInfo {
  if (!url) {
    return { host: '', category: 'unknown', clusterKey: '', depth: 0, path: '/' };
  }
  try {
    const parsed = new URL(String(url));
    const host = normalizeHost(parsed.hostname);
    const path = parsed.pathname !== '/' ? (parsed.pathname.replace(/\/+$/, '') || '/') : '/';
    const segments = path.split('/').filter(Boolean).map((item) => normalizeClusterSegment(decodeURIComponent(item).toLowerCase()));
    if (host === 'github.com' && segments.length >= 2) {
      return getRepoClusterInfo({ host, path }, segments);
    }
    if (segments.length === 0) {
      return { host, category: 'site-root', clusterKey: `${host}/`, depth: 0, path };
    }
    return getPathClusterInfo({ host, path }, segments);
  } catch (e) {
    return { host: '', category: 'unknown', clusterKey: String(url).trim().toLowerCase(), depth: 0, path: '/' };
  }
}

function looksLikeNavigationQuery(query: unknown): boolean {
  const value = String(query || '').trim().toLowerCase();
  if (!value) {
    return false;
  }
  if (value.includes('://')) {
    return true;
  }
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+([/#?].*)?$/i.test(value)) {
    return true;
  }
  return false;
}

function classifySearchIntent(query: unknown, queryTerms: readonly string[] | null | undefined): SearchIntentType {
  const raw = String(query || '').trim().toLowerCase();
  const terms = (queryTerms || []).filter(Boolean);
  if (looksLikeNavigationQuery(raw)) {
    return 'navigation';
  }

  if (terms.some((term) => SEARCH_PATH_INTENT_TERMS.has(term))) {
    return 'path';
  }

  if (terms.some((term) => looksLikeVersionSegment(term)) || /v?\d+(\.\d+){1,3}/i.test(raw)) {
    return 'revisit';
  }

  if (terms.length >= 2) {
    if (terms.some((term) => /\d/.test(term))) {
      return 'revisit';
    }
    return 'object';
  }

  if (terms.length === 1) {
    return 'brand';
  }

  return 'object';
}

// How much each source counts for each kind of query.
const SOURCE_ADJUSTMENTS: Readonly<Record<string, Readonly<Record<string, number>>>> = Object.freeze({
  navigation: { bookmark: 24, topSite: 20, history: 4 },
  brand: { bookmark: 24, topSite: 20, history: 4 },
  path: { history: 18, bookmark: 10, topSite: 8 },
  revisit: { history: 18, bookmark: 10, topSite: 8 },
  object: { bookmark: 18, history: 12, topSite: 10 }
});

function getSearchSourceAdjustment(sourceType: unknown, intentType: unknown): number {
  const source = String(sourceType || '');
  const intent = String(intentType || 'object');
  const bySource = Object.prototype.hasOwnProperty.call(SOURCE_ADJUSTMENTS, intent) ? SOURCE_ADJUSTMENTS[intent] : null;
  return bySource && Object.prototype.hasOwnProperty.call(bySource, source) ? bySource[source] : 0;
}

// Whether a page matches the query: the whole query, or every word of it,
// in its title, the labels that name its host or its path (item-matching).
function matchesSearchQueryText(
  item: IntentItem | null | undefined,
  context: QueryTextContext,
  options?: TitleMatchOptions | null
): boolean {
  if (!item || !item.url) {
    return false;
  }
  return matchesSearchItem(item, context, options);
}

// How many of the query's words the page shows, by the same rules a match
// reads. A Han query its host spells counts for every word.
function getSearchTermCoverageStats(
  context: Partial<Pick<SearchQueryContext, 'coreQueryTerms' | 'queryLower' | 'queryHostSpellings'>> | null | undefined,
  fields: SearchItemFields,
  options?: TitleMatchOptions | null
): SearchTermCoverage {
  const coreTerms = context && context.coreQueryTerms;
  const terms = Array.isArray(coreTerms) && coreTerms.length > 0
    ? coreTerms
    : splitSearchTerms(context && context.queryLower ? context.queryLower : '');
  if (terms.length === 0) {
    return { total: 0, matchedCount: 0, missingCount: 0, allMatched: false };
  }
  const spelledByHost = matchesSearchHostSpelling(fields.hostLabels, context);
  const matchedCount = terms.filter((term) => (
    Boolean(term) && (spelledByHost || matchesSearchTerm(fields, term, options))
  )).length;
  return {
    total: terms.length,
    matchedCount,
    missingCount: Math.max(0, terms.length - matchedCount),
    allMatched: matchedCount === terms.length
  };
}

function isRootCategory(category: string): boolean {
  return category === 'site-root' || category === 'repo-root';
}

// Site roots, sections, landing pages and docs rank up, more so as top sites.
function getPageKindAdjustment(info: SearchClusterInfo, isTopSite: boolean): number {
  let adjustment = 0;
  if (isRootCategory(info.category)) {
    adjustment += 18;
  } else if (info.category === 'section') {
    adjustment += 8;
  } else if (info.category === 'landing' || info.category === 'docs') {
    adjustment += 10;
  }
  if (isTopSite) {
    if (isRootCategory(info.category)) {
      adjustment += 20;
    } else {
      adjustment += info.category === 'section' || info.category === 'landing' ? 10 : 4;
    }
  }
  return adjustment;
}

// Deep pages, utility and action pages and repository code rank down,
// unless the query asks for settings or an action.
function getPageDepthPenalty(info: SearchClusterInfo, querySet: ReadonlySet<string>, hasSettingsIntent: boolean): number {
  const hasActionIntent = ['new', 'edit', 'create', 'settings', '设置'].some((term) => querySet.has(term));
  let penalty = 0;
  if (info.depth >= 3 && info.category !== 'docs' && info.category !== 'repo-code') {
    penalty += Math.min(16, (info.depth - 2) * 4);
  }
  if (info.category === 'utility') {
    penalty += hasSettingsIntent ? 10 : 95;
  }
  if (info.category === 'action') {
    penalty += hasActionIntent ? 8 : 80;
  }
  if (info.category === 'repo-code') {
    penalty += 18;
  }
  if (info.category === 'repo-child' && info.depth >= 4) {
    penalty += 14;
  }
  return penalty;
}

// With two or more terms: a page matching all of them ranks up, a
// representative page missing some ranks down.
function getCoverageAdjustment(info: SearchClusterInfo, isTopSite: boolean, coverageStats: SearchTermCoverage | null | undefined): number {
  if (!coverageStats || coverageStats.total < 2) {
    return 0;
  }
  const isRepresentativePage = isRootCategory(info.category) || info.category === 'section' || info.category === 'landing';
  if (coverageStats.allMatched) {
    if (info.category === 'repo-root') {
      return 18;
    }
    return isRepresentativePage ? 0 : 12;
  }
  if (!isRepresentativePage) {
    return 0;
  }
  const topSitePenalty = isTopSite && info.category !== 'repo-root' ? 6 : 0;
  return -Math.min(36, coverageStats.missingCount * 18) - topSitePenalty;
}

function getSearchSuggestionCategoryAdjustment(
  item: IntentItem | null | undefined,
  context: Partial<Pick<SearchQueryContext, 'queryTerms' | 'hasSettingsIntent'>> | null | undefined,
  coverageStats: SearchTermCoverage | null | undefined
): number {
  if (!item || !item.url) {
    return 0;
  }
  const info = getSearchSuggestionClusterInfo(item.url);
  const queryTerms = context && context.queryTerms;
  const querySet = new Set(Array.isArray(queryTerms) ? queryTerms : []);
  const isTopSite = item.type === 'topSite' || Boolean(item.isTopSite);
  return getPageKindAdjustment(info, isTopSite) -
    getPageDepthPenalty(info, querySet, Boolean(context && context.hasSettingsIntent)) +
    getCoverageAdjustment(info, isTopSite, coverageStats);
}

function getOwnExtensionUtilityPenalty(
  item: IntentItem | null | undefined,
  options?: { isOwnExtensionUrl?: (url: string) => boolean; hasSettingsIntent?: boolean } | null
): number {
  const settings: { isOwnExtensionUrl?: (url: string) => boolean; hasSettingsIntent?: boolean } =
    options && typeof options === 'object' ? options : {};
  const isOwnExtensionUrl = typeof settings.isOwnExtensionUrl === 'function'
    ? settings.isOwnExtensionUrl
    : () => false;
  const hasSettingsIntent = Boolean(settings.hasSettingsIntent);
  if (!item || !item.url || !isOwnExtensionUrl(item.url) || hasSettingsIntent) {
    return 0;
  }
  try {
    const parsedUrl = new URL(item.url);
    const pathnameLower = String(parsedUrl.pathname || '').toLowerCase();
    if (pathnameLower.endsWith('/options.html') || pathnameLower.endsWith('options.html')) {
      return 110;
    }
  } catch (e) {
    return 0;
  }
  return 0;
}

export {
  classifySearchIntent,
  getOwnExtensionUtilityPenalty,
  getSearchSourceAdjustment,
  getSearchSuggestionCategoryAdjustment,
  getSearchSuggestionClusterInfo,
  getSearchTermCoverageStats,
  matchesSearchQueryText
};
export type { IntentItem, QueryTextContext, SearchClusterCategory };
