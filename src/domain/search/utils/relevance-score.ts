// The relevance score of a suggestion for a query, the selection boost,
// source ranks and the comparison results are sorted by.
import type {
  BrowserItem,
  SearchQueryContext,
  SearchRankingOptions,
  SearchSuggestion,
  SuggestionLike
} from '../types';
import { readSearchItemFields, scoreSearchItemText } from './item-matching';
import { getOwnExtensionUtilityPenalty, getSearchSourceAdjustment, getSearchSuggestionCategoryAdjustment, getSearchSuggestionClusterInfo, getSearchTermCoverageStats } from './query-intent';
import { buildSearchDedupUrlKey, getSearchSuggestionDisplayTitle } from './result-dedup';
import { SEARCH_POLICY, SEARCH_SELECTION_POLICY } from './search-policy';
import { getNow, normalizeSearchSelectionQuery } from './selection-stats';
import { getSearchDirectNavigationAdjustment } from './navigation-signals';

// What a ranking pass scores: a browser page, with the source it came from.
type ScoredItem = Pick<BrowserItem, 'url' | 'title' | 'lastVisitTime' | 'visitCount' | 'typedCount' | 'type' | 'isTopSite'>;

// Selection stats as they come from storage; read defensively.
interface StoredSelectionStats {
  queries?: Record<string, { entries?: Record<string, { lastSelectedAt?: number; count?: number } | undefined> } | undefined>;
}

// Extra fields for createSearchSuggestion; they are copied onto the result.
interface SuggestionExtras {
  favicon?: string;
  reasons?: string[];
  [field: string]: unknown;
}

// Recent, frequent and typed visits.
function scoreVisits(item: ScoredItem, now: number): number {
  let score = 0;
  const lastVisitTime = Number(item.lastVisitTime) || 0;
  if (lastVisitTime) {
    const hoursSinceVisit = (now - lastVisitTime) / (1000 * 60 * 60);
    const daysSinceVisit = hoursSinceVisit / 24;
    if (daysSinceVisit < 1) score += 10;
    else if (daysSinceVisit < 7) score += 5;
    else if (daysSinceVisit < 30) score += 2;
    if (hoursSinceVisit < 2) score += 20;
    else if (hoursSinceVisit < 24) score += 14;
    else if (hoursSinceVisit < 72) score += 8;
  }
  const visitCount = Number(item.visitCount) > 0 ? Number(item.visitCount) : 0;
  const typedCount = Number(item.typedCount) > 0 ? Number(item.typedCount) : 0;
  if (visitCount > 0) score += Math.min(18, Math.log2(visitCount + 1) * 4);
  if (typedCount > 0) score += Math.min(12, typedCount * 2);
  return score;
}

const SOURCE_BASE_SCORES: Readonly<Record<string, number>> = Object.freeze({ bookmark: 12, history: 4, topSite: 6 });

function scoreSource(sourceType: string, intentType: unknown): number {
  const base = Object.prototype.hasOwnProperty.call(SOURCE_BASE_SCORES, sourceType) ? SOURCE_BASE_SCORES[sourceType] : 0;
  return base + getSearchSourceAdjustment(sourceType, intentType);
}

function calculateSearchRelevanceScore(
  item: ScoredItem,
  sourceType: string,
  context: SearchQueryContext,
  options?: SearchRankingOptions | null
): number {
  const settings: SearchRankingOptions = options && typeof options === 'object' ? options : {};
  const fields = readSearchItemFields(item);
  const textScore = scoreSearchItemText(fields, context, settings);
  if (textScore <= 0) {
    return 0;
  }
  const coverageStats = getSearchTermCoverageStats(context, fields, settings);
  const clusterInfo = getSearchSuggestionClusterInfo(item.url);
  const isGenericBrandDeepTitle = context.intentType === 'brand' && fields.titleLower === context.queryLower && clusterInfo.depth > 0;
  return textScore +
    scoreVisits(item, getNow(settings)) +
    scoreSource(sourceType, context.intentType) +
    getSearchSuggestionCategoryAdjustment(item, context, coverageStats) +
    getSearchDirectNavigationAdjustment(item, sourceType, context, settings) -
    (isGenericBrandDeepTitle ? SEARCH_POLICY.genericBrandDeepTitlePenalty : 0) -
    getOwnExtensionUtilityPenalty(item, {
      hasSettingsIntent: context.hasSettingsIntent,
      isOwnExtensionUrl: settings.isOwnExtensionUrl
    });
}

type SelectionEntry = { lastSelectedAt?: number; count?: number };

// The stats entry for this query and page.
function findSelectionEntry(
  item: SuggestionLike & { url: string },
  context: Pick<SearchQueryContext, 'lookupQuery' | 'queryLower'>,
  stats: StoredSelectionStats
): SelectionEntry | null {
  const queryKey = normalizeSearchSelectionQuery(context.lookupQuery || context.queryLower);
  const bucket = queryKey && stats.queries && stats.queries[queryKey] ? stats.queries[queryKey] : null;
  if (!bucket || !bucket.entries) {
    return null;
  }
  const urlKey = buildSearchDedupUrlKey(item.url);
  return (urlKey && bucket.entries[urlKey]) || null;
}

function positiveSetting(value: unknown, fallback: number): number {
  return Number(value) > 0 ? Number(value) : fallback;
}

function getRecencyBoost(ageDays: number): number {
  if (ageDays < 1) return 64;
  if (ageDays < 7) return 44;
  return ageDays < 30 ? 24 : 10;
}

// A brand query's deep pages are capped, so the site itself stays first.
function capBrandDeepPage(boost: number, item: SuggestionLike & { url: string }, intentType: unknown, settings: SearchRankingOptions): number {
  if (intentType !== 'brand' || getSearchSuggestionClusterInfo(item.url).depth <= 0) {
    return boost;
  }
  return Math.min(boost, positiveSetting(settings.brandDeepSelectionBoostLimit, SEARCH_POLICY.brandDeepSelectionBoostLimit));
}

function getSearchSelectionBoost(
  item: SuggestionLike | null | undefined,
  context: Pick<SearchQueryContext, 'lookupQuery' | 'queryLower' | 'intentType'> | null | undefined,
  stats: StoredSelectionStats | null | undefined,
  options?: SearchRankingOptions | null
): number {
  if (!item || !item.url || !context || !stats || typeof stats !== 'object') {
    return 0;
  }
  const page = { ...item, url: item.url };
  const entry = findSelectionEntry(page, context, stats);
  const lastSelectedAt = Number(entry && entry.lastSelectedAt) || 0;
  if (!entry || !lastSelectedAt) {
    return 0;
  }
  const settings: SearchRankingOptions = options && typeof options === 'object' ? options : {};
  const ageDays = (getNow(settings) - lastSelectedAt) / (1000 * 60 * 60 * 24);
  if (ageDays > positiveSetting(settings.retentionDays, SEARCH_SELECTION_POLICY.retentionDays)) {
    return 0;
  }
  const count = Math.max(1, Number(entry.count) || 1);
  const frequencyBoost = Math.min(256, Math.log2(count + 1) * 64);
  const maxBoost = positiveSetting(settings.maxSelectionBoost, SEARCH_SELECTION_POLICY.maxSelectionBoost);
  return capBrandDeepPage(Math.min(maxBoost, frequencyBoost + getRecencyBoost(ageDays)), page, context.intentType, settings);
}

function getSearchSuggestionSourceRank(suggestion: SuggestionLike | null | undefined): number {
  if (!suggestion) {
    return 0;
  }
  if (suggestion.type === 'bookmark') {
    return 3;
  }
  if (suggestion.type === 'history') {
    return 2;
  }
  if (suggestion.type === 'topSite' || suggestion.isTopSite) {
    return 1;
  }
  return 0;
}

function compareSearchSuggestions(a: SuggestionLike, b: SuggestionLike): number {
  const scoreDiff = (b.score || 0) - (a.score || 0);
  if (scoreDiff !== 0) {
    return scoreDiff;
  }
  const sourceRankDiff = getSearchSuggestionSourceRank(b) - getSearchSuggestionSourceRank(a);
  if (sourceRankDiff !== 0) {
    return sourceRankDiff;
  }
  const visitDiff = (Number(b.visitCount) || 0) - (Number(a.visitCount) || 0);
  if (visitDiff !== 0) {
    return visitDiff;
  }
  const aVisit = a.lastVisitTime || 0;
  const bVisit = b.lastVisitTime || 0;
  return bVisit - aVisit;
}

// A result row; fields in extras are copied onto it and win over the
// ones worked out here.
function createSearchSuggestion(item: ScoredItem, sourceType: string, score: number): SearchSuggestion;
function createSearchSuggestion<E extends SuggestionExtras>(
  item: ScoredItem,
  sourceType: string,
  score: number,
  extras: E
): SearchSuggestion & E;
function createSearchSuggestion(
  item: ScoredItem,
  sourceType: string,
  score: number,
  extras?: SuggestionExtras | null
): SearchSuggestion {
  const suggestion: SearchSuggestion = {
    type: sourceType,
    title: getSearchSuggestionDisplayTitle(item, sourceType),
    url: item.url,
    favicon: extras && extras.favicon ? extras.favicon : '',
    score,
    lastVisitTime: Number(item.lastVisitTime) || 0,
    visitCount: Number(item.visitCount) || 0,
    typedCount: Number(item.typedCount) || 0,
    reasons: extras && Array.isArray(extras.reasons) ? extras.reasons : []
  };
  return extras ? { ...suggestion, ...extras } : suggestion;
}

export {
  calculateSearchRelevanceScore,
  compareSearchSuggestions,
  createSearchSuggestion,
  getSearchSelectionBoost,
  getSearchSuggestionSourceRank
};
export type { ScoredItem, StoredSelectionStats, SuggestionExtras };
