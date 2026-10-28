// Asks the worker for a query's rows: the local results first, then the
// search engine's suggestions after the wait the surface chooses. Each
// answer reaches its handler only while its request is the current one
// and the query is still the one typed; a newer request or cancel() drops
// the rest, the wait before the engine included.
import type { SearchContext } from '../../domain/messages';
import type { SearchSourceType, SuggestionLike } from '../../domain/search/types';
import * as LumnoMessaging from '../../platform/messaging';
import type { SearchQuery } from './search-query';
import type { SearchResults } from './search-results';

interface RowRequest {
  query: string;
  context: SearchContext;
  // Narrows the local results to one source (a local scope).
  sourceTypes?: SearchSourceType[];
  searchFirst: boolean;
  // How long the local rows may take before onLocalLate runs.
  lateAfterMs?: number;
}

interface RowHandlers {
  // The local rows. Returns how long to wait before asking the search
  // engine, or null not to ask it.
  onLocal(rows: SuggestionLike[]): number | null;
  // The local rows could not be asked for or did not come.
  onLocalFailed(): void;
  // The local rows are late (see lateAfterMs); the request still runs.
  onLocalLate?(): void;
  // The engine's rows, or null when it had none, aborted or failed.
  onRemote(rows: SuggestionLike[] | null, localRows: SuggestionLike[]): void;
}

class SuggestionSource {
  private readonly query: Pick<SearchQuery, 'text'>;
  private readonly results: Pick<SearchResults<unknown>, 'beginRequest' | 'cancelRequests' | 'isCurrentRequest' | 'setLastEngineResponse'>;
  private remoteTimer: ReturnType<typeof setTimeout> | null = null;
  private lateTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    query: Pick<SearchQuery, 'text'>,
    results: Pick<SearchResults<unknown>, 'beginRequest' | 'cancelRequests' | 'isCurrentRequest' | 'setLastEngineResponse'>
  ) {
    this.query = query;
    this.results = results;
  }

  // Starts a request and returns it; its answers go to the handlers.
  request(request: RowRequest, handlers: RowHandlers): number {
    this.clearTimers();
    const id = this.results.beginRequest();
    const isCurrent = () => this.results.isCurrentRequest(id) && request.query === this.query.text;
    const onLocalLate = handlers.onLocalLate;
    if (request.lateAfterMs !== undefined && onLocalLate) {
      this.lateTimer = setTimeout(() => {
        this.lateTimer = null;
        if (isCurrent()) {
          onLocalLate();
        }
      }, request.lateAfterMs);
    }
    const sent = this.send<'getSearchSuggestions'>({
      action: 'getSearchSuggestions',
      query: request.query,
      context: request.context,
      sourceTypes: request.sourceTypes,
      includeOpenTabs: request.sourceTypes ? false : undefined
    }, (response) => {
      this.clearLateTimer();
      if (!isCurrent()) {
        return;
      }
      if (chrome.runtime && chrome.runtime.lastError) {
        handlers.onLocalFailed();
        return;
      }
      const localRows = response && Array.isArray(response.suggestions) ? response.suggestions : [];
      const remoteDelay = handlers.onLocal(localRows);
      if (remoteDelay !== null) {
        this.remoteTimer = setTimeout(() => {
          this.remoteTimer = null;
          if (isCurrent()) {
            this.askEngine(request, localRows, isCurrent, handlers);
          }
        }, remoteDelay);
      }
    });
    if (!sent) {
      this.clearLateTimer();
      if (isCurrent()) {
        handlers.onLocalFailed();
      }
    }
    return id;
  }

  // Drops every request made so far and the waits that came with it.
  cancel(): void {
    this.results.cancelRequests();
    this.clearTimers();
  }

  private askEngine(request: RowRequest, localRows: SuggestionLike[], isCurrent: () => boolean, handlers: RowHandlers): void {
    const sent = this.send<'getSearchEngineSuggestions'>({
      action: 'getSearchEngineSuggestions',
      query: request.query,
      context: request.context,
      localSuggestions: localRows,
      searchFirst: request.searchFirst
    }, (reply) => {
      if (!isCurrent()) {
        return;
      }
      const usable = !(chrome.runtime && chrome.runtime.lastError) && reply && reply.aborted !== true &&
        reply.hasRemoteSuggestions === true && Array.isArray(reply.suggestions);
      if (!usable) {
        handlers.onRemote(null, localRows);
        return;
      }
      this.results.setLastEngineResponse(reply.suggestions);
      handlers.onRemote(reply.suggestions, localRows);
    });
    if (!sent) {
      handlers.onRemote(null, localRows);
    }
  }

  private send<A extends 'getSearchSuggestions' | 'getSearchEngineSuggestions'>(
    message: Parameters<typeof LumnoMessaging.sendBackgroundMessage<A>>[1],
    callback: Parameters<typeof LumnoMessaging.sendBackgroundMessage<A>>[2]
  ): boolean {
    if (typeof chrome === 'undefined' || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
      return false;
    }
    try {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, message, callback);
      return true;
    } catch {
      return false;
    }
  }

  private clearTimers(): void {
    if (this.remoteTimer !== null) {
      clearTimeout(this.remoteTimer);
      this.remoteTimer = null;
    }
    this.clearLateTimer();
  }

  private clearLateTimer(): void {
    if (this.lateTimer !== null) {
      clearTimeout(this.lateTimer);
      this.lateTimer = null;
    }
  }
}

export { SuggestionSource };
export type { RowHandlers, RowRequest };
