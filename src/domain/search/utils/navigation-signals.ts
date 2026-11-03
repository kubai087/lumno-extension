// How strongly a row stands for the site a query names: home titles,
// brand and product queries, and the direct navigation adjustment.
import type { SearchClusterInfo, SearchTermCoverage } from '../types';
import { getSearchHostNameLabels, readSearchItemFields } from './item-matching';
import { getSearchSuggestionClusterInfo, getSearchTermCoverageStats } from './query-intent';
import type { IntentItem } from './query-intent';
import { hasSearchLiteral, normalizeSearchText, splitSearchTerms } from './text-normalize';
import type { TitleMatchOptions } from './text-matching';
import type { SlateContext } from './slate-types';

const SEARCH_HOME_TITLE_TERMS = new Set([
  'home',
  'homepage',
  'overview',
  'workspace',
  'console',
  'dashboard',
  '首页',
  '主页',
  '概览',
  '控制台',
  '工作台'
]);

function hasSearchHomeTitle(title: unknown): boolean {
  const titleTerms = splitSearchTerms(String(title || '').toLowerCase());
  return titleTerms.some((term) => SEARCH_HOME_TITLE_TERMS.has(term));
}

function isSearchLikelyBrandProductQuery(context: SlateContext | null | undefined): boolean {
  if (!context || context.intentType !== 'object') {
    return false;
  }
  if (context.hasInformationalIntent || context.hasSettingsIntent) {
    return false;
  }
  // queryTerms also carries the whole phrase, so count the split words.
  if (!Array.isArray(context.coreQueryTerms) || context.coreQueryTerms.length !== 2) {
    return false;
  }
  return context.queryLower.length <= 28;
}

function isSearchLikelyDirectNavigationQuery(context: SlateContext | null | undefined): boolean {
  if (!context || context.hasInformationalIntent) {
    return false;
  }
  return context.intentType === 'brand' || isSearchLikelyBrandProductQuery(context);
}

function getSearchBrandHostMatchScore(host: string, context: SlateContext | null | undefined): number {
  if (!host || !context || context.intentType !== 'brand') {
    return 0;
  }
  const query = String(context.queryLower || '').trim();
  if (!query) {
    return 0;
  }
  const hostLabels = getSearchHostNameLabels(host);
  let score = 0;
  hostLabels.forEach((label) => {
    if (label === query) {
      score = Math.max(score, 100);
      return;
    }
    if (query.length >= 2 && label.startsWith(query)) {
      score = Math.max(score, 60);
    }
  });
  return score;
}

// Roots, sections and home pages stand for a site.
function getPageKindBonus(info: SearchClusterInfo, hasHomeTitle: boolean): number {
  if (info.category === 'site-root' || info.category === 'repo-root') {
    return 4;
  }
  if (info.category === 'section' || info.category === 'landing') {
    return 3;
  }
  if (hasHomeTitle && info.category !== 'utility' && info.category !== 'action') {
    return 3;
  }
  return info.category === 'content' && info.depth <= 2 ? 1 : 0;
}

// Utility, action and user pages do not, nor does deep content.
function getPageKindPenalty(info: SearchClusterInfo, hasHomeTitle: boolean): number {
  if (info.category === 'utility' || info.category === 'action' || info.category === 'user') {
    return 3;
  }
  return info.category === 'content' && info.depth >= 2 && !hasHomeTitle ? 1 : 0;
}

function getTitleSignal(titleLower: string, context: SlateContext): number {
  if (titleLower === context.queryLower) {
    return 4;
  }
  if (titleLower.startsWith(context.queryLower)) {
    return 3;
  }
  return context.queryTerms.every((term) => term && hasSearchLiteral(titleLower, term)) ? 2 : 0;
}

// Query terms that name the host, or start one of its labels.
function getHostTermSignal(url: string, context: SlateContext): number {
  let hostLabels: string[];
  try {
    hostLabels = getSearchHostNameLabels(new URL(url).hostname);
  } catch (e) {
    return 0;
  }
  return context.queryTerms.reduce((signal, term) => {
    if (!term) {
      return signal;
    }
    if (hostLabels.includes(term)) {
      return signal + 2;
    }
    return term.length >= 2 && hostLabels.some((label) => label.startsWith(term)) ? signal + 1 : signal;
  }, 0);
}

function getSearchNavigationRepresentativeSignal(item: IntentItem | null | undefined, context: SlateContext): number {
  if (!item || !item.url) {
    return 0;
  }
  const info = getSearchSuggestionClusterInfo(item.url);
  const titleLower = normalizeSearchText(item.title);
  const sourceSignal = item.type === 'topSite' || item.isTopSite || item.type === 'bookmark' ? 1 : 0;
  const hasHomeTitle = hasSearchHomeTitle(titleLower);
  return getPageKindBonus(info, hasHomeTitle) - getPageKindPenalty(info, hasHomeTitle) +
    getTitleSignal(titleLower, context) +
    getHostTermSignal(item.url, context) +
    sourceSignal;
}

// For a brand or a brand's product, the site's own pages rank up and deep
// content down.
function getBrandPageAdjustment(info: SearchClusterInfo, hasHomeTitle: boolean, context: SlateContext): number {
  const isRoot = info.category === 'site-root' || info.category === 'repo-root';
  const isDeepContent = info.category === 'content' && info.depth >= 2;
  if (context.intentType === 'brand') {
    if (isRoot) return 70;
    if (info.category === 'section' || info.category === 'landing') return 32;
    if (hasHomeTitle) return 42;
    return isDeepContent ? -28 : 0;
  }
  if (!isSearchLikelyBrandProductQuery(context)) {
    return 0;
  }
  if (isRoot) return 34;
  if (info.category === 'section' || info.category === 'landing' || hasHomeTitle) return 28;
  return isDeepContent ? -12 : 0;
}

// A site page that misses some of several query terms ranks down.
function getMissingTermPenalty(info: SearchClusterInfo, coverageStats: SearchTermCoverage, representativeSignal: number): number {
  if (coverageStats.total < 2 || coverageStats.allMatched) {
    return 0;
  }
  const sitePagePenalty = info.category === 'site-root' || info.category === 'section' || info.category === 'landing'
    ? Math.min(42, coverageStats.missingCount * 22)
    : 0;
  return sitePagePenalty + (representativeSignal >= 6 ? 10 : 0);
}

function getSearchDirectNavigationAdjustment(
  item: IntentItem | null | undefined,
  sourceType: unknown,
  context: SlateContext,
  options?: TitleMatchOptions | null
): number {
  if (!isSearchLikelyDirectNavigationQuery(context) || !item || !item.url) {
    return 0;
  }
  const url = item.url;
  const info = getSearchSuggestionClusterInfo(url);
  const hasHomeTitle = hasSearchHomeTitle(item.title);
  const representativeSignal = getSearchNavigationRepresentativeSignal(item, context);
  const coverageStats = getSearchTermCoverageStats(context, readSearchItemFields(item), options);
  const representativeAdjustment = representativeSignal >= 6 ? 18 : (representativeSignal <= 0 ? -12 : 0);
  const unrequestedUtilityPenalty = (info.category === 'utility' || info.category === 'action' || info.category === 'user') &&
    !context.hasSettingsIntent ? 36 : 0;
  const topSiteHomeBonus = sourceType === 'topSite' && (info.category === 'site-root' || hasHomeTitle) ? 10 : 0;
  return getBrandPageAdjustment(info, hasHomeTitle, context) +
    representativeAdjustment -
    unrequestedUtilityPenalty +
    topSiteHomeBonus -
    getMissingTermPenalty(info, coverageStats, representativeSignal);
}

export {
  SEARCH_HOME_TITLE_TERMS,
  getBrandPageAdjustment,
  getHostTermSignal,
  getMissingTermPenalty,
  getPageKindBonus,
  getPageKindPenalty,
  getSearchBrandHostMatchScore,
  getSearchDirectNavigationAdjustment,
  getSearchNavigationRepresentativeSignal,
  getTitleSignal,
  hasSearchHomeTitle,
  isSearchLikelyBrandProductQuery,
  isSearchLikelyDirectNavigationQuery
};
