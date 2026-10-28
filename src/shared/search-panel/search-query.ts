// What is typed in the search input: the text as typed and the query it
// makes (the same text trimmed, unless the panel says otherwise), and when
// the person last deleted text, which holds autocomplete off for a moment.
// This is their one owner; the input, the modes and the results set them.
import { createStore } from '../state/store';
import type { Store } from '../state/store';

interface SearchQueryState {
  raw: string;
  text: string;
}

class SearchQuery {
  readonly store: Store<SearchQueryState> = createStore<SearchQueryState>({ raw: '', text: '' });
  private deletedAt = 0;

  // The input's text as typed.
  get raw(): string {
    return this.store.getSnapshot().raw;
  }

  // The query the results answer.
  get text(): string {
    return this.store.getSnapshot().text;
  }

  get lastDeletionAt(): number {
    return this.deletedAt;
  }

  set(raw: string, text: string = raw.trim()): void {
    this.store.setState({ raw, text });
  }

  setRaw(raw: string): void {
    this.store.setState({ raw });
  }

  setText(text: string): void {
    this.store.setState({ text });
  }

  clear(): void {
    this.set('', '');
  }

  markDeletion(now: number = Date.now()): void {
    this.deletedAt = now;
  }
}

export { SearchQuery };
export type { SearchQueryState };
