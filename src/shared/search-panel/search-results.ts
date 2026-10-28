// The results of the search panel: the rows shown, the last full answer
// and the search engine's own part of it, the selected row, and which
// request is the current one, so a slower answer to an older query never
// replaces a newer one. This is their one owner.
import { createStore } from '../state/store';
import type { Store } from '../state/store';

interface SearchResultsState<Row> {
  // The rows the list shows.
  rows: Row[];
  // The last answer for the query, to show again without asking.
  lastResponse: Row[];
  // The search engine's suggestions in the last answer.
  lastEngineResponse: Row[];
  selectedIndex: number;
}

class SearchResults<Row> {
  readonly store: Store<SearchResultsState<Row>> = createStore<SearchResultsState<Row>>({
    rows: [],
    lastResponse: [],
    lastEngineResponse: [],
    selectedIndex: -1
  });
  private request = 0;

  get rows(): Row[] {
    return this.store.getSnapshot().rows;
  }

  get lastResponse(): Row[] {
    return this.store.getSnapshot().lastResponse;
  }

  get lastEngineResponse(): Row[] {
    return this.store.getSnapshot().lastEngineResponse;
  }

  get selectedIndex(): number {
    return this.store.getSnapshot().selectedIndex;
  }

  show(rows: Row[]): void {
    this.store.setState({ rows });
  }

  setLastResponse(rows: Row[]): void {
    this.store.setState({ lastResponse: rows });
  }

  setLastEngineResponse(rows: Row[]): void {
    this.store.setState({ lastEngineResponse: rows });
  }

  select(index: number): void {
    this.store.setState({ selectedIndex: index });
  }

  // Starts a request; its answer counts while it stays the current one.
  beginRequest(): number {
    this.request += 1;
    return this.request;
  }

  // Answers to every request made so far no longer count.
  cancelRequests(): void {
    this.request += 1;
  }

  isCurrentRequest(request: number): boolean {
    return request === this.request;
  }
}

export { SearchResults };
export type { SearchResultsState };
