// Inline autocomplete for the search input: the completion the rows give
// for what is typed, shown in the input after the typed text and selected,
// and dropped again. This is the one owner of the completion shown; the
// keys and the navigation read it from here.
import type { SuggestionInputPreview } from '../../domain/search/suggestion-input-preview';
import type { SuggestionLike } from '../../domain/search/types';
import { getKeywordSearchSuggestionState } from '../../domain/search/utils/engine-suggestions';
import { searchResultPriority } from '../../domain/settings/search';
import type { SettingsStore } from '../../platform/settings-store';
import type { SearchQuery } from './search-query';

// What a row offers for completion; command rows complete to their text.
interface AutocompleteRow extends SuggestionLike {
  commandText?: string;
  commandAliases?: string[];
}

// A completion and what it completes to.
interface AutocompleteCandidate {
  completion: string;
  url: string;
  title: string;
  type: 'command' | 'url' | 'title';
}

// The completion shown in the input, selected after what was typed.
interface AutocompleteState {
  completion: string;
  displayText: string;
  url: string;
  rawQuery: string;
  title: string;
  type: string;
}

type GetUrlDisplay = (url: string | undefined) => string;

interface SearchAutocompleteOptions {
  settings: Pick<SettingsStore, 'get'>;
  query: SearchQuery;
  getInput(): HTMLInputElement | null;
  // A suggestion the arrows show keeps the input until it is dropped.
  preview: Pick<SuggestionInputPreview, 'isActive'>;
  // A site search or a local scope completes nothing.
  isModeActive(): boolean;
  // An address as the surface shows it.
  getUrlDisplay: GetUrlDisplay;
}

function isEnglishQuery(query: string): boolean {
  return Boolean(query) && /^[A-Za-z0-9\s._/-]+$/.test(query);
}

function commandCandidate(row: AutocompleteRow, rawLower: string): AutocompleteCandidate | null {
  if (!row.commandText) {
    return null;
  }
  const names = [row.commandText].concat(Array.isArray(row.commandAliases) ? row.commandAliases : []);
  const name = names.find((entry) => String(entry || '').toLowerCase().startsWith(rawLower));
  return name ? { completion: name, url: '', title: row.title || '', type: 'command' } : null;
}

function titleCandidate(row: AutocompleteRow, rawLower: string): AutocompleteCandidate | null {
  const titleText = row.title || '';
  return titleText && titleText.toLowerCase().startsWith(rawLower)
    ? { completion: titleText, url: row.url || '', title: titleText, type: 'title' }
    : null;
}

// The first row whose command, address or title starts with what was typed;
// engine suggestions only when nothing else does.
function getAutocompleteCandidate(
  rows: readonly (AutocompleteRow | null | undefined)[] | null | undefined,
  rawQuery: string,
  getUrlDisplay: GetUrlDisplay
): AutocompleteCandidate | null {
  if (!Array.isArray(rows) || !rawQuery) {
    return null;
  }
  const rawLower = rawQuery.toLowerCase();
  for (const skipGoogleSuggest of [true, false]) {
    for (const row of rows) {
      if (!row || row.type === 'newtab' || (skipGoogleSuggest && row.type === 'googleSuggest')) {
        continue;
      }
      const command = commandCandidate(row, rawLower);
      if (command) {
        return command;
      }
      const urlText = getUrlDisplay(row.url);
      if (urlText && urlText.toLowerCase().startsWith(rawLower)) {
        return { completion: urlText, url: row.url || '', title: row.title || '', type: 'url' };
      }
      const title = titleCandidate(row, rawLower);
      if (title) {
        return title;
      }
    }
  }
  return null;
}

// The first row whose host starts with what was typed.
function getDomainPrefixCandidate(
  rows: readonly (AutocompleteRow | null | undefined)[] | null | undefined,
  rawQuery: string,
  getUrlDisplay: GetUrlDisplay
): AutocompleteCandidate | null {
  if (!Array.isArray(rows) || !rawQuery) {
    return null;
  }
  const rawLower = rawQuery.toLowerCase();
  for (const row of rows) {
    if (!row || row.type === 'newtab') {
      continue;
    }
    const urlText = getUrlDisplay(row.url);
    if (urlText && (urlText.split('/')[0] || '').toLowerCase().startsWith(rawLower)) {
      return { completion: urlText, url: row.url || '', title: row.title || '', type: 'url' };
    }
  }
  return null;
}

// What one row completes the typed text to, if anything.
function getRowCandidate(
  row: AutocompleteRow | null | undefined,
  rawQuery: string,
  getUrlDisplay: GetUrlDisplay
): AutocompleteCandidate | null {
  if (!row || !rawQuery || row.type === 'newtab') {
    return null;
  }
  const rawLower = rawQuery.toLowerCase();
  const command = commandCandidate(row, rawLower);
  if (command) {
    return command;
  }
  const urlText = getUrlDisplay(row.url);
  if (urlText && ((urlText.split('/')[0] || '').toLowerCase().startsWith(rawLower) ||
      urlText.toLowerCase().startsWith(rawLower))) {
    return { completion: urlText, url: row.url || '', title: row.title || '', type: 'url' };
  }
  return titleCandidate(row, rawLower);
}

class SearchAutocomplete {
  private shown: AutocompleteState | null = null;
  private readonly options: SearchAutocompleteOptions;

  constructor(options: SearchAutocompleteOptions) {
    this.options = options;
  }

  // The completion shown, or null.
  get state(): AutocompleteState | null {
    return this.shown;
  }

  getCandidate(rows: readonly (AutocompleteRow | null | undefined)[] | null | undefined, rawQuery: string): AutocompleteCandidate | null {
    return getAutocompleteCandidate(rows, rawQuery, this.options.getUrlDisplay);
  }

  clear(): void {
    this.shown = null;
  }

  // Takes the completion shown as typed text, as if it had been typed.
  accept(): void {
    const completion = this.shown ? this.shown.completion : '';
    const input = this.options.getInput();
    if (!completion || !input) {
      return;
    }
    input.value = completion;
    input.setSelectionRange(completion.length, completion.length);
    this.options.query.set(completion);
    this.clear();
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Puts back the text as typed in place of the completion; false when
  // none was showing.
  restoreTyped(): boolean {
    if (!this.shown || !this.shown.completion) {
      return false;
    }
    const rawQuery = this.shown.rawQuery;
    const input = this.options.getInput();
    if (input && input.value !== rawQuery) {
      input.value = rawQuery;
      input.setSelectionRange(rawQuery.length, rawQuery.length);
    }
    this.options.query.set(rawQuery);
    this.clear();
    return true;
  }

  // Any key but Tab, Enter or a lone modifier drops the completion; true
  // when there was one.
  dismissOnKey(event: Pick<KeyboardEvent, 'key'> | null): boolean {
    if (!event || event.key === 'Tab' || event.key === 'Enter' ||
        event.key === 'Shift' || event.key === 'Control' || event.key === 'Alt' || event.key === 'Meta') {
      return false;
    }
    return this.restoreTyped();
  }

  // Shows the completion the rows give for the typed text, keeping to the
  // first row when the list highlights it for a reason.
  apply(
    rows: readonly (AutocompleteRow | null | undefined)[] | null | undefined,
    primaryRow?: AutocompleteRow | null,
    primaryHighlightReason?: string
  ): void {
    const { settings, query, preview, getUrlDisplay } = this.options;
    const rawQuery = query.raw;
    const input = this.options.getInput();
    if (preview.isActive()) {
      return;
    }
    if (settings.get(searchResultPriority) === 'search') {
      if (input && input.value !== rawQuery) {
        input.value = rawQuery;
        input.setSelectionRange(rawQuery.length, rawQuery.length);
      }
      this.clear();
      return;
    }
    if (Date.now() - query.lastDeletionAt < 250 || this.options.isModeActive() ||
        !rawQuery || !isEnglishQuery(rawQuery.trim()) || !Array.isArray(rows) || !input) {
      this.clear();
      return;
    }
    if (input.selectionStart !== input.value.length || input.selectionEnd !== input.value.length) {
      return;
    }
    const forcePrimary = Boolean(primaryRow && primaryHighlightReason &&
      primaryHighlightReason !== 'autocomplete' && primaryHighlightReason !== 'default');
    let candidate = primaryRow ? getRowCandidate(primaryRow, rawQuery, getUrlDisplay) : null;
    if (!candidate && forcePrimary) {
      this.clear();
      return;
    }
    if (!candidate) {
      const pool = getKeywordSearchSuggestionState(rows.filter((row): row is AutocompleteRow => Boolean(row)))
        .autocompleteSuggestions;
      candidate = getDomainPrefixCandidate(pool, rawQuery, getUrlDisplay) ||
        getAutocompleteCandidate(pool, rawQuery, getUrlDisplay);
    }
    if (!candidate || !candidate.completion || candidate.type === 'title' ||
        candidate.completion.length <= rawQuery.length ||
        !candidate.completion.toLowerCase().startsWith(rawQuery.toLowerCase())) {
      this.clear();
      return;
    }
    // The typed part stays as typed: "4A" completes to "4Anet.com", not
    // the candidate's own "4anet.com".
    const displayText = rawQuery + candidate.completion.slice(rawQuery.length);
    input.value = displayText;
    input.setSelectionRange(rawQuery.length, displayText.length);
    this.shown = {
      completion: displayText,
      displayText,
      url: candidate.url || '',
      rawQuery,
      title: candidate.title || '',
      type: candidate.type
    };
  }
}

export { SearchAutocomplete, getAutocompleteCandidate, isEnglishQuery };
export type { AutocompleteCandidate, AutocompleteRow, AutocompleteState };
