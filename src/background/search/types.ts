// What the worker's search modules share: the rows and source items they
// pass around, and reading a row a page sent back.
import type { BrowserItem, SuggestionLike } from '../../domain/search/types';

// A suggestion row as the surfaces get it: the ranking's fields plus
// whatever the row carries for display.
type SuggestionRow = SuggestionLike & Record<string, unknown>;

// The default search engine this device last searched with.
interface DefaultSearchEngineState {
  id: string;
  name: string;
  host: string;
  searchTemplate: string;
  updatedAt: number;
}

// A short-lived copy of a browser source.
interface TimedCache<T> {
  expiresAt: number;
  items: T[];
}

interface BookmarkNodeInfo {
  title: string;
  parentId: string | null;
  hasUrl: boolean;
}

interface BookmarkItem extends BrowserItem {
  id: string;
  parentId: string | null;
  title: string;
}

interface OpenTabItem extends BrowserItem {
  title: string;
  _xMatchedTabId: number;
}

// One search engine suggestion fetch, shared by the prefetch and the request
// that consumes it.
interface EngineSuggestionRequest {
  requestKey: string;
  query: string;
  controller: AbortController;
  startTimer: ReturnType<typeof setTimeout> | null;
  releaseTimer: ReturnType<typeof setTimeout> | null;
  // The engine's raw answer, read by normalizeSearchEngineSuggestions.
  promise: Promise<unknown[]> | null;
  consumed: boolean;
}

interface SearchSuggestionOptions {
  sourceTypes?: unknown;
  includeOpenTabs?: unknown;
  // Retry with the query read in other keyboard layouts when nothing matched.
  keyboardLayoutRetry?: boolean;
}

interface EngineSuggestionOptions {
  signal?: AbortSignal | null;
  rawEngineSuggestionsPromise?: Promise<unknown> | null;
  searchFirst?: boolean;
}

type HistoryRemoval = { allHistory: boolean; urls?: string[] };

// A page from one of the local sources, as ranking reads it.
interface SourceItem {
  id?: string | number;
  url?: string;
  title?: string;
  parentId?: string | null;
  lastVisitTime?: number;
  visitCount?: number;
  typedCount?: number;
  type?: string;
  isTopSite?: boolean;
  _xMatchedTabId?: number;
}

// Extra fields createSearchSuggestion copies onto a row.
interface RowExtras {
  favicon?: string;
  reasons?: string[];
  [field: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

// The ranking's fields of a row a page sent back, each kept only when it has
// the expected type; the row's other fields pass through.
const SUGGESTION_FIELD_CHECKS: Readonly<Record<string, (value: unknown) => boolean>> = Object.freeze({
  type: (value: unknown) => typeof value === 'string',
  url: (value: unknown) => typeof value === 'string',
  title: (value: unknown) => typeof value === 'string',
  score: (value: unknown) => typeof value === 'number',
  isTopSite: (value: unknown) => typeof value === 'boolean',
  selectionBoost: (value: unknown) => typeof value === 'number',
  lastVisitTime: (value: unknown) => typeof value === 'number',
  visitCount: (value: unknown) => typeof value === 'number',
  typedCount: (value: unknown) => typeof value === 'number',
  _xMatchedTabId: (value: unknown) => typeof value === 'number'
});

function readSuggestionRow(value: unknown): SuggestionRow | null {
  if (!isRecord(value)) {
    return null;
  }
  const row: SuggestionRow = {};
  Object.keys(value).forEach((key) => {
    const check = Object.prototype.hasOwnProperty.call(SUGGESTION_FIELD_CHECKS, key) ? SUGGESTION_FIELD_CHECKS[key] : null;
    if (!check || check(value[key])) {
      row[key] = value[key];
    }
  });
  return row;
}

export { isRecord, readSuggestionRow };
export type {
  BookmarkItem,
  BookmarkNodeInfo,
  DefaultSearchEngineState,
  EngineSuggestionOptions,
  EngineSuggestionRequest,
  HistoryRemoval,
  OpenTabItem,
  RowExtras,
  SearchSuggestionOptions,
  SourceItem,
  SuggestionRow,
  TimedCache
};
