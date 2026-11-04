// The results of one search as they are collected from each source: one row
// per page, keeping the strongest evidence any source gave for it.
import type { SearchQueryContext, SearchRankingOptions, SearchSelectionStats, SuggestionLike } from '../../domain/search/types';
import { getSearchSelectionBoost } from './selection-stats';
import { buildSearchSuggestionFavicon, buildSuggestionReasons } from './suggestion-rows';
import type { OpenTabItem, RowExtras, SourceItem, SuggestionRow } from './types';
import * as SearchBrandSuggestions from '../../domain/search/utils/brand-suggestions';
import * as SearchRelevanceScore from '../../domain/search/utils/relevance-score';
import * as SearchResultDedup from '../../domain/search/utils/result-dedup';

interface SuggestionSetOptions {
  context: SearchQueryContext;
  scoreOptions: SearchRankingOptions;
  selectionStats: SearchSelectionStats;
}

function getSuggestionKey(item: SourceItem | SuggestionLike | null | undefined): string {
  return SearchResultDedup.buildSearchDedupEntryKey(item);
}

// The rows in ranking order, one per page, at most `limit`, keeping a
// matching open tab among them.
function takeRankedUniqueRows(rows: readonly SuggestionRow[], limit: number): SuggestionRow[] {
  const sorted = rows.slice().sort((a, b) => SearchRelevanceScore.compareSearchSuggestions(a, b));
  const unique: SuggestionRow[] = [];
  const seenKeys = new Set<string>();
  for (let index = 0; index < sorted.length; index += 1) {
    const key = getSuggestionKey(sorted[index]);
    if (key && !seenKeys.has(key)) {
      seenKeys.add(key);
      unique.push(sorted[index]);
    }
  }
  return SearchBrandSuggestions.keepOpenTabWithinLimit(unique, limit);
}

class SuggestionSet {
  readonly rows: SuggestionRow[] = [];
  private readonly indexByKey = new Map<string, number>();
  private readonly options: SuggestionSetOptions;

  constructor(options: SuggestionSetOptions) {
    this.options = options;
  }

  private find(item: SourceItem | SuggestionLike): { key: string; index: number | undefined } {
    const key = getSuggestionKey(item);
    return { key, index: this.indexByKey.get(key) };
  }

  private put(key: string, index: number | undefined, row: SuggestionRow): void {
    if (typeof index === 'number') {
      this.rows[index] = row;
      return;
    }
    this.indexByKey.set(key, this.rows.length);
    this.rows.push(row);
  }

  // Bookmarks and top sites carry no visit data. When the same page was
  // already seen in history, its behavior signals are kept so adding a
  // bookmark never makes a frequently used page rank lower.
  private mergeSignals(rawItem: SourceItem & { url: string }, existing: SuggestionRow | null): SourceItem & { url: string } {
    if (!existing) {
      return { ...rawItem };
    }
    return {
      ...rawItem,
      lastVisitTime: Math.max(Number(rawItem.lastVisitTime) || 0, Number(existing.lastVisitTime) || 0),
      visitCount: Math.max(Number(rawItem.visitCount) || 0, Number(existing.visitCount) || 0),
      typedCount: Math.max(Number(rawItem.typedCount) || 0, Number(existing.typedCount) || 0),
      isTopSite: Boolean(rawItem.isTopSite || existing.isTopSite)
    };
  }

  // Adds a page from a source, or strengthens the row it already has.
  upsert(rawItem: SourceItem | null | undefined, sourceType: string, extras?: RowExtras): SuggestionRow | null {
    if (!rawItem || !rawItem.url) {
      return null;
    }
    const { context, scoreOptions, selectionStats } = this.options;
    const { key, index } = this.find(rawItem);
    const existing = typeof index === 'number' ? this.rows[index] : null;
    const item = this.mergeSignals({ ...rawItem, url: rawItem.url }, existing);
    const baseScore = SearchRelevanceScore.calculateSearchRelevanceScore(item, sourceType, context, scoreOptions);
    if (baseScore <= 0 && sourceType !== 'openTab') {
      return null;
    }
    const normalizedExtras: RowExtras = extras && typeof extras === 'object' ? { ...extras } : {};
    const scoreAdjustment = Number(normalizedExtras.scoreAdjustment) || 0;
    delete normalizedExtras.scoreAdjustment;
    const selectionBoost = getSearchSelectionBoost(item, context, selectionStats, scoreOptions);
    if (selectionBoost > 0) {
      normalizedExtras.selectionBoost = selectionBoost;
    }
    const rankedScore = baseScore + scoreAdjustment + selectionBoost;
    // Open tabs have already passed query matching. Ranking penalties must
    // not make a matching live page disappear from search, and being open
    // earns no extra rank.
    const sourceScore = sourceType === 'openTab' ? Math.max(1, rankedScore) : rankedScore;
    // The page keeps its strongest evidence: a bookmark title that matches
    // the query less well must not demote a page history already ranked.
    const score = existing ? Math.max(sourceScore, Number(existing.score) || 0) : sourceScore;
    const rowExtras: RowExtras = {
      favicon: buildSearchSuggestionFavicon(item.url),
      reasons: buildSuggestionReasons(item, sourceType, context, scoreOptions),
      ...(item.isTopSite ? { isTopSite: true } : {}),
      ...normalizedExtras
    };
    const row: SuggestionRow = SearchRelevanceScore.createSearchSuggestion(item, sourceType, score, rowExtras);
    this.put(key, index, row);
    return row;
  }

  // An open tab marks the row of its page as switchable, or adds one.
  upsertOpenTab(item: OpenTabItem | null | undefined): void {
    if (!item || !item.url || typeof item._xMatchedTabId !== 'number') {
      return;
    }
    const { index } = this.find(item);
    if (typeof index === 'number') {
      this.rows[index] = { ...this.rows[index], _xMatchedTabId: item._xMatchedTabId };
      return;
    }
    this.upsert(item, 'openTab', { _xMatchedTabId: item._xMatchedTabId });
  }

  // A top site already listed only gains its mark and a little score;
  // returns false when it is not listed yet.
  markTopSite(site: SourceItem): boolean {
    const { index } = this.find(site);
    if (typeof index !== 'number') {
      return false;
    }
    const existing = this.rows[index];
    this.rows[index] = { ...existing, isTopSite: true, score: (existing.score || 0) + 6 };
    return true;
  }

  // A finished row from elsewhere (the brand's own site), replacing the
  // page's row when it has one.
  putRow(row: SuggestionRow): void {
    const { key, index } = this.find(row);
    this.put(key, index, row);
  }
}

export { SuggestionSet, takeRankedUniqueRows };
export type { SuggestionSetOptions };
