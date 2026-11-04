// Suggestions the ranking adds or reshapes: open tabs, brand direct
// navigation, host diversity, and limiting and filtering by source type.
import type {
  SearchQueryContext,
  SearchRankingOptions,
  SearchSuggestion,
  SiteSearchProvider,
  SuggestionLike
} from '../types';
import { getSearchDirectNavigationTitle, getSearchDirectNavigationUrl, getSearchSuggestionFamilyKey } from './direct-navigation';
import { getSearchSuggestionClusterInfo } from './query-intent';
import { calculateSearchRelevanceScore, createSearchSuggestion } from './relevance-score';
import type { ScoredItem } from './relevance-score';
import { buildSearchDedupEntryKey, buildSearchDedupUrlKey } from './result-dedup';
import { DEFAULT_SITE_SEARCH_PROVIDERS, SEARCH_POLICY } from './search-policy';
import { findSiteSearchProviderByKey } from './site-search-matching';
import { findSiteSearchProvider } from './site-search-providers';
import { groupSearchSuggestionsByKind } from './engine-suggestions';
import { getSearchBrandHostMatchScore, getSearchNavigationRepresentativeSignal, hasSearchHomeTitle } from './navigation-signals';
import { getSearchTitleUnitMatch } from './text-matching';
import { hasSearchLiteral, normalizeSearchText } from './text-normalize';

interface BrandDirectOptions extends SearchRankingOptions {
  siteSearchProviders?: readonly SiteSearchProvider[];
  buildReasons?: (item: ScoredItem, sourceType: string, context: SearchQueryContext) => string[];
  buildFavicon?: (url: string) => string;
}

// The host whose pages best stand for a brand query.
interface BrandHostGroup<T> {
  host: string;
  sourceSuggestion: T;
  hasRepresentative: boolean;
  totalScore: number;
}

// The fields every function here reads from a slate row.
type SlateRow = SuggestionLike & { url?: string };

function isSearchOpenTabSuggestion(suggestion: SuggestionLike | null | undefined): boolean {
  return Boolean(
    suggestion &&
    (
      suggestion.type === 'openTab' ||
      typeof suggestion._xMatchedTabId === 'number'
    )
  );
}

// The first `limit` rows. A matching open tab always shows: when none of
// them is one, the first open tab further down takes the last place.
function keepOpenTabWithinLimit<T extends SuggestionLike>(list: readonly T[], limit: number): T[] {
  const shown = list.slice(0, Math.max(0, limit));
  if (shown.length === 0 || list.length <= shown.length || shown.some(isSearchOpenTabSuggestion)) {
    return shown;
  }
  const openTab = list.slice(shown.length).find(isSearchOpenTabSuggestion);
  if (openTab) {
    shown[shown.length - 1] = openTab;
  }
  return shown;
}

type DirectSourceType = 'topSite' | 'bookmark' | 'history';

// A synthetic "go to the site" row; the scored item must still match the query.
function createBrandDirectRow(
  directItem: ScoredItem,
  sourceType: DirectSourceType,
  context: SearchQueryContext,
  settings: BrandDirectOptions,
  flags: { isBrandRepresentative?: true }
): SearchSuggestion | null {
  const baseScore = calculateSearchRelevanceScore(directItem, sourceType, context, settings);
  if (baseScore <= 0) {
    return null;
  }
  const reasons = ['站点直达'];
  if (typeof settings.buildReasons === 'function') {
    reasons.push(...settings.buildReasons(directItem, sourceType, context));
  }
  return createSearchSuggestion(directItem, sourceType, baseScore + 36, {
    favicon: typeof settings.buildFavicon === 'function' ? settings.buildFavicon(directItem.url || '') : '',
    reasons: reasons.slice(0, 3),
    isTopSite: true,
    isSyntheticDirect: true,
    ...flags
  });
}

function isUrlListed(candidates: ReadonlyArray<SlateRow | null | undefined> | null | undefined, url: string): boolean {
  const urlKey = buildSearchDedupUrlKey(url);
  return (Array.isArray(candidates) ? candidates : []).some((suggestion) => (
    suggestion && suggestion.url && buildSearchDedupUrlKey(suggestion.url) === urlKey
  ));
}

// A site search provider named by the query that has its own home page.
function buildConfiguredSearchBrandDirectSuggestion(
  candidates: ReadonlyArray<SlateRow | null | undefined> | null | undefined,
  context: SearchQueryContext,
  options?: BrandDirectOptions | null
): SearchSuggestion | null {
  const settings: BrandDirectOptions = options && typeof options === 'object' ? options : {};
  const providers: readonly SiteSearchProvider[] = Array.isArray(settings.siteSearchProviders)
    ? settings.siteSearchProviders
    : DEFAULT_SITE_SEARCH_PROVIDERS;
  const provider = findSiteSearchProvider(context.lookupQuery || context.queryLower, providers) ||
    findSiteSearchProviderByKey(context.lookupQuery || context.queryLower, providers);
  const directUrl = String(provider && provider.directNavigationUrl || '').trim();
  if (!provider || !directUrl || isUrlListed(candidates, directUrl)) {
    return null;
  }
  const directItem: ScoredItem = {
    title: String(provider.directNavigationTitle || context.lookupQuery || provider.name || '').trim(),
    url: directUrl
  };
  return createBrandDirectRow(directItem, 'topSite', context, settings, { isBrandRepresentative: true });
}

function groupCandidatesByHost(candidates: ReadonlyArray<SlateRow | null | undefined> | null | undefined): Map<string, SlateRow[]> {
  const hostGroups = new Map<string, SlateRow[]>();
  (Array.isArray(candidates) ? candidates : []).forEach((suggestion: SlateRow | null | undefined) => {
    if (!suggestion || !suggestion.url || suggestion.type === 'googleSuggest') {
      return;
    }
    const info = getSearchSuggestionClusterInfo(suggestion.url);
    if (!info.host) {
      return;
    }
    const list = hostGroups.get(info.host) || [];
    list.push(suggestion);
    hostGroups.set(info.host, list);
  });
  return hostGroups;
}

// A row that already stands for the site: its root, a section, a landing
// page or its home.
function isHostRepresentative(suggestion: SlateRow): boolean {
  const info = getSearchSuggestionClusterInfo(suggestion && suggestion.url);
  return info.category === 'site-root' ||
    info.category === 'repo-root' ||
    info.category === 'section' ||
    info.category === 'landing' ||
    hasSearchHomeTitle(suggestion && suggestion.title);
}

function scoreHostGroup(host: string, group: SlateRow[], context: SearchQueryContext): BrandHostGroup<SlateRow> | null {
  const hostScore = getSearchBrandHostMatchScore(host, context);
  if (hostScore <= 0) {
    return null;
  }
  const sourceSuggestion = group
    .slice()
    .sort((a, b) => {
      const signalDiff = getSearchNavigationRepresentativeSignal(b, context) -
        getSearchNavigationRepresentativeSignal(a, context);
      return signalDiff !== 0 ? signalDiff : (b.score || 0) - (a.score || 0);
    })[0];
  return {
    host,
    sourceSuggestion,
    hasRepresentative: group.some(isHostRepresentative),
    totalScore: hostScore +
      Math.max(0, getSearchNavigationRepresentativeSignal(sourceSuggestion, context)) +
      Math.min(8, group.length * 2)
  };
}

function pickBrandHostGroup(hostGroups: Map<string, SlateRow[]>, context: SearchQueryContext): BrandHostGroup<SlateRow> | null {
  let bestGroup: BrandHostGroup<SlateRow> | null = null;
  for (const [host, group] of hostGroups) {
    const scored = scoreHostGroup(host, group, context);
    if (scored && (!bestGroup || scored.totalScore > bestGroup.totalScore)) {
      bestGroup = scored;
    }
  }
  return bestGroup;
}

function directSourceType(source: SlateRow): DirectSourceType {
  if (source.type === 'bookmark') {
    return 'bookmark';
  }
  return source.type === 'topSite' || source.isTopSite ? 'topSite' : 'history';
}

// The part of a page's title that names its site, for the row that goes to
// the site's root: "TypeScript" from "TypeScript: Handbook - Generics",
// 小红书 from "小红书 - 你的生活兴趣社区". The whole title when no one part
// shows the query.
function readSiteNameFromTitle(title: string, context: SearchQueryContext, settings: BrandDirectOptions): string {
  const parts = title.split(/\s+[-–—|·•]\s+|\s*[|｜_]\s*|:\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) {
    return title;
  }
  const naming = parts.filter((part) => (
    hasSearchLiteral(normalizeSearchText(part), context.queryLower) ||
    Boolean(context.unitQuery && getSearchTitleUnitMatch(part, context.unitQuery, settings))
  ));
  return naming.length > 0 ? naming.sort((left, right) => left.length - right.length)[0] : title;
}

// For a brand query whose site has rows but none for its home page, a row
// that goes to the site itself.
function buildSearchBrandDirectSuggestion(
  candidates: ReadonlyArray<SlateRow | null | undefined> | null | undefined,
  context: SearchQueryContext,
  options?: BrandDirectOptions | null
): SearchSuggestion | null {
  const settings: BrandDirectOptions = options && typeof options === 'object' ? options : {};
  if (context.intentType !== 'brand' || context.hasInformationalIntent) {
    return null;
  }
  const configuredDirectSuggestion = buildConfiguredSearchBrandDirectSuggestion(candidates, context, settings);
  if (configuredDirectSuggestion) {
    return configuredDirectSuggestion;
  }
  const bestGroup = pickBrandHostGroup(groupCandidatesByHost(candidates), context);
  if (!bestGroup || bestGroup.hasRepresentative || !bestGroup.sourceSuggestion) {
    return null;
  }
  const source = bestGroup.sourceSuggestion;
  const directItem: ScoredItem = {
    title: getSearchDirectNavigationTitle(bestGroup.host, readSiteNameFromTitle(source.title || '', context, settings) || bestGroup.host),
    url: getSearchDirectNavigationUrl(bestGroup.host),
    lastVisitTime: source.lastVisitTime || 0,
    visitCount: Number(source.visitCount) || 0,
    typedCount: Number(source.typedCount) || 0
  };
  return createBrandDirectRow(directItem, directSourceType(source), context, settings, {});
}

// Keeps a few rows per host, cluster and (for brand queries) site family,
// so one site cannot fill the slate.
// The rows picked so far, and how many each host, cluster and site family has.
interface DiverseSelection<T> {
  selected: T[];
  selectedKeys: Set<string>;
  hostCounts: Map<string, number>;
  clusterCounts: Map<string, number>;
  familyCounts: Map<string, number>;
}

interface DiversityLimits {
  host: number;
  cluster: number;
  family: number;
}

// An engine suggestion is its own host, cluster and family.
function getDiversityKeys(suggestion: SlateRow, dedupKey: string): { host: string; cluster: string; family: string } {
  if (suggestion.type === 'googleSuggest') {
    return { host: dedupKey, cluster: dedupKey, family: dedupKey };
  }
  const info = getSearchSuggestionClusterInfo(suggestion.url);
  const host = info.host || '__nohost__';
  return {
    host,
    cluster: info.clusterKey || dedupKey,
    family: getSearchSuggestionFamilyKey(info.host) || host
  };
}

// Takes the row unless it repeats one or its host, cluster or family is full.
function takeDiverse<T extends SlateRow>(selection: DiverseSelection<T>, suggestion: T | null | undefined, limits: DiversityLimits): boolean {
  if (!suggestion) {
    return false;
  }
  const dedupKey = buildSearchDedupEntryKey(suggestion);
  if (!dedupKey || selection.selectedKeys.has(dedupKey)) {
    return false;
  }
  const keys = getDiversityKeys(suggestion, dedupKey);
  const hostCount = selection.hostCounts.get(keys.host) || 0;
  const clusterCount = selection.clusterCounts.get(keys.cluster) || 0;
  const familyCount = selection.familyCounts.get(keys.family) || 0;
  if (hostCount >= limits.host || clusterCount >= limits.cluster || familyCount >= limits.family) {
    return false;
  }
  selection.selected.push(suggestion);
  selection.selectedKeys.add(dedupKey);
  selection.hostCounts.set(keys.host, hostCount + 1);
  selection.clusterCounts.set(keys.cluster, clusterCount + 1);
  selection.familyCounts.set(keys.family, familyCount + 1);
  return true;
}

// One top site per host that stands for the site (its root, a section or a
// landing page) is guaranteed a slot.
function takeTopSiteRepresentatives<T extends SlateRow>(selection: DiverseSelection<T>, candidates: readonly T[], familyLimit: number): void {
  const hostHasTopSiteRepresentative = new Set<string>();
  candidates.forEach((suggestion) => {
    if (!suggestion || !(suggestion.type === 'topSite' || suggestion.isTopSite)) {
      return;
    }
    const info = getSearchSuggestionClusterInfo(suggestion.url);
    const hostKey = info.host || '__nohost__';
    const isRepresentativeCategory = info.category === 'site-root' || info.category === 'repo-root' ||
      info.category === 'section' || info.category === 'landing';
    if (hostHasTopSiteRepresentative.has(hostKey) || !isRepresentativeCategory) {
      return;
    }
    if (takeDiverse(selection, suggestion, {
      host: SEARCH_POLICY.topSiteRepresentativeHostLimit,
      cluster: SEARCH_POLICY.topSiteRepresentativeClusterLimit,
      family: familyLimit
    })) {
      hostHasTopSiteRepresentative.add(hostKey);
    }
  });
}

// The first open tabs keep their place whatever the limits.
function takeProtectedOpenTabs<T extends SlateRow>(selection: DiverseSelection<T>, candidates: readonly T[]): void {
  let protectedOpenTabCount = 0;
  candidates.forEach((suggestion) => {
    if (protectedOpenTabCount >= SEARCH_POLICY.brandProtectedOpenTabLimit || !isSearchOpenTabSuggestion(suggestion)) {
      return;
    }
    if (takeDiverse(selection, suggestion, { host: Infinity, cluster: Infinity, family: Infinity })) {
      protectedOpenTabCount += 1;
    }
  });
}

function applySearchSuggestionHostDiversity<T extends SlateRow>(
  list: readonly T[] | null | undefined,
  options?: { context?: Pick<SearchQueryContext, 'intentType' | 'hasInformationalIntent'> | null } | null
): T[] {
  const candidates: readonly T[] = Array.isArray(list) ? list : [];
  const context = options && typeof options === 'object' && options.context && typeof options.context === 'object'
    ? options.context
    : null;
  const useBrandFamilyLimit = Boolean(context && context.intentType === 'brand' && !context.hasInformationalIntent);
  const selection: DiverseSelection<T> = {
    selected: [],
    selectedKeys: new Set(),
    hostCounts: new Map(),
    clusterCounts: new Map(),
    familyCounts: new Map()
  };
  takeTopSiteRepresentatives(selection, candidates, useBrandFamilyLimit ? SEARCH_POLICY.brandPrimaryFamilyLimit : Infinity);
  takeProtectedOpenTabs(selection, candidates);
  candidates.forEach((suggestion) => {
    takeDiverse(selection, suggestion, {
      host: SEARCH_POLICY.primaryHostLimit,
      cluster: SEARCH_POLICY.primaryClusterLimit,
      family: useBrandFamilyLimit ? SEARCH_POLICY.brandPrimaryFamilyLimit : Infinity
    });
  });

  // The reserved passes above only guarantee a slot; they must not jump
  // ahead of stronger results. Restore the incoming rank order for every
  // primary pick, then let secondary picks fill the tail.
  const candidateIndex = new Map(candidates.map((suggestion, index) => [suggestion, index]));
  selection.selected.sort((a, b) => (candidateIndex.get(a) ?? 0) - (candidateIndex.get(b) ?? 0));

  if (selection.selected.length < SEARCH_POLICY.finalSuggestionLimit) {
    candidates.forEach((suggestion) => {
      takeDiverse(selection, suggestion, {
        host: SEARCH_POLICY.secondaryHostLimit,
        cluster: SEARCH_POLICY.secondaryClusterLimit,
        family: useBrandFamilyLimit ? SEARCH_POLICY.brandSecondaryFamilyLimit : Infinity
      });
    });
  }

  return keepOpenTabWithinLimit(selection.selected, SEARCH_POLICY.finalSuggestionLimit);
}

function composeSearchSuggestionSlate<T extends SlateRow>(
  list: readonly T[] | null | undefined,
  context: Pick<SearchQueryContext, 'intentType' | 'hasInformationalIntent'> | null | undefined
): T[] {
  const suggestions: T[] = Array.isArray(list) ? list.slice() : [];
  if (!context || context.intentType !== 'brand' || context.hasInformationalIntent) {
    return suggestions;
  }
  return groupSearchSuggestionsByKind(suggestions);
}

function limitSearchSuggestionsForDisplay<T extends SuggestionLike>(list: readonly T[] | null | undefined, options?: { limit?: number } | null): T[] {
  const suggestions: readonly T[] = Array.isArray(list) ? list : [];
  const settings: { limit?: number } = options && typeof options === 'object' ? options : {};
  const rawLimit = Number(settings.limit);
  const fallbackLimit = Number(SEARCH_POLICY.displaySuggestionLimit) || 10;
  const limit = Number.isInteger(rawLimit) && rawLimit >= 5 && rawLimit <= 10
    ? rawLimit
    : fallbackLimit;
  return keepOpenTabWithinLimit(suggestions, limit);
}

function normalizeSearchSuggestionSourceFilterType(value: unknown): '' | 'topSite' | 'bookmark' | 'history' {
  if (value === 'topSite' || value === 'topSites' || value === 'frequent' || value === 'common') {
    return 'topSite';
  }
  if (value === 'bookmark' || value === 'bookmarks') {
    return 'bookmark';
  }
  if (value === 'history') {
    return 'history';
  }
  return '';
}

function getSearchSuggestionFilterType(suggestion: SuggestionLike | null | undefined): '' | 'topSite' | 'bookmark' | 'history' {
  if (!suggestion) {
    return '';
  }
  if (suggestion.type === 'topSite' || suggestion.isTopSite) {
    return 'topSite';
  }
  if (suggestion.type === 'bookmark') {
    return 'bookmark';
  }
  if (suggestion.type === 'history') {
    return 'history';
  }
  return '';
}

// Rows of the chosen local sources (none when the list is empty); rows of no
// local source always stay.
function filterSearchSuggestionsBySourceTypes<T extends SuggestionLike>(
  list: readonly T[] | null | undefined,
  sourceTypes: unknown
): T[] {
  const suggestions: readonly T[] = Array.isArray(list) ? list : [];
  if (!Array.isArray(sourceTypes)) {
    return suggestions.slice();
  }
  const selected = new Set(sourceTypes.map(normalizeSearchSuggestionSourceFilterType).filter(Boolean));
  return suggestions.filter((suggestion) => {
    const filterType = getSearchSuggestionFilterType(suggestion);
    return !filterType || selected.has(filterType);
  });
}

export {
  applySearchSuggestionHostDiversity,
  buildSearchBrandDirectSuggestion,
  composeSearchSuggestionSlate,
  filterSearchSuggestionsBySourceTypes,
  isSearchOpenTabSuggestion,
  keepOpenTabWithinLimit,
  limitSearchSuggestionsForDisplay
};
export type { BrandDirectOptions };
