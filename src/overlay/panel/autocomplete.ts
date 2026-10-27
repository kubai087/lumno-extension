import type { SuggestionInputPreview } from '../../domain/search/suggestion-input-preview';
import type { SuggestionLike } from '../../domain/search/types';
import { searchResultPriority } from '../../domain/settings/search';
import type { OverlaySettings } from '../overlay-settings';

// What a row offers for completion; command rows complete to their text.
interface AutocompleteRow extends SuggestionLike {
  commandText?: string;
  commandAliases?: string[];
}

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

interface AutocompleteOverlayState {
  settings: Pick<OverlaySettings, 'get'>;
  autocompleteState: AutocompleteState | null;
  searchInput: HTMLInputElement | null;
  latestRawInputValue: string;
  latestOverlayQuery: string;
  // 'search' keeps the search action first, so nothing is completed.
  // When the user last deleted text; completing right after would fight it.
  lastDeletionAt: number;
  // Only whether a site search or a local scope is active.
  siteSearchState: unknown;
  localSearchScopeState: unknown;
  // A suggestion the arrows show keeps the input until it is dropped.
  suggestionInputPreview: Pick<SuggestionInputPreview, 'isActive'>;
}

interface AutocompleteDeps {
  getUrlDisplay(url: string | undefined): string;
  isEnglishQuery(query: string): boolean;
  getKeywordSearchSuggestionState(suggestions: AutocompleteRow[]): { autocompleteSuggestions: AutocompleteRow[] };
  overlayState: AutocompleteOverlayState;
}

// Inline autocomplete: the candidate for what is typed (domains, prefixes,
// suggestions), showing it in the input and dismissing it.
function createAutocomplete(deps: AutocompleteDeps) {
  const {
    getUrlDisplay,
    isEnglishQuery,
    getKeywordSearchSuggestionState
  } = deps;

  // The panel state object shared with search-panel.ts and the other modules.
  const overlayState = deps.overlayState;

  function getAutocompleteCandidate(allSuggestions: AutocompleteRow[] | null, rawQuery: string): AutocompleteCandidate | null {
    if (!Array.isArray(allSuggestions) || !rawQuery) {
      return null;
    }
    const rawLower = rawQuery.toLowerCase();
    const passes = [true, false];
    for (let passIndex = 0; passIndex < passes.length; passIndex += 1) {
      const skipGoogleSuggest = passes[passIndex];
      for (let i = 0; i < allSuggestions.length; i += 1) {
        const suggestion = allSuggestions[i];
        if (!suggestion || suggestion.type === 'newtab') {
          continue;
        }
        if (skipGoogleSuggest && suggestion.type === 'googleSuggest') {
          continue;
        }
        if (suggestion.commandText) {
          const commandText = String(suggestion.commandText).toLowerCase();
          if (commandText.startsWith(rawLower)) {
            return {
              completion: suggestion.commandText,
              url: '',
              title: suggestion.title || '',
              type: 'command'
            };
          }
          const aliases = Array.isArray(suggestion.commandAliases) ? suggestion.commandAliases : [];
          for (let aliasIndex = 0; aliasIndex < aliases.length; aliasIndex += 1) {
            const alias = String(aliases[aliasIndex] || '').toLowerCase();
            if (alias && alias.startsWith(rawLower)) {
              return {
                completion: aliases[aliasIndex],
                url: '',
                title: suggestion.title || '',
                type: 'command'
              };
            }
          }
        }
        const urlText = getUrlDisplay(suggestion.url);
        if (urlText && urlText.toLowerCase().startsWith(rawLower)) {
          return {
            completion: urlText,
            url: suggestion.url || '',
            title: suggestion.title || '',
            type: 'url'
          };
        }
        const titleText = suggestion.title || '';
        if (titleText && titleText.toLowerCase().startsWith(rawLower)) {
          return {
            completion: titleText,
            url: suggestion.url || '',
            title: suggestion.title || '',
            type: 'title'
          };
        }
      }
    }
    return null;
  }

  function getDomainPrefixCandidate(allSuggestions: AutocompleteRow[] | null, rawQuery: string): AutocompleteCandidate | null {
    if (!Array.isArray(allSuggestions) || !rawQuery) {
      return null;
    }
    const rawLower = rawQuery.toLowerCase();
    for (let i = 0; i < allSuggestions.length; i += 1) {
      const suggestion = allSuggestions[i];
      if (!suggestion || suggestion.type === 'newtab') {
        continue;
      }
      const urlText = getUrlDisplay(suggestion.url);
      if (!urlText) {
        continue;
      }
      const host = urlText.split('/')[0] || '';
      if (host.toLowerCase().startsWith(rawLower)) {
        return {
          completion: urlText,
          url: suggestion.url || '',
          title: suggestion.title || '',
          type: 'url'
        };
      }
    }
    return null;
  }

  function getAutocompleteCandidateFromSuggestion(suggestion: AutocompleteRow | null, rawQuery: string): AutocompleteCandidate | null {
    if (!suggestion || !rawQuery || suggestion.type === 'newtab') {
      return null;
    }
    const rawLower = rawQuery.toLowerCase();
    if (suggestion.commandText) {
      const commandText = String(suggestion.commandText).toLowerCase();
      if (commandText.startsWith(rawLower)) {
        return {
          completion: suggestion.commandText,
          url: '',
          title: suggestion.title || '',
          type: 'command'
        };
      }
      const aliases = Array.isArray(suggestion.commandAliases) ? suggestion.commandAliases : [];
      for (let aliasIndex = 0; aliasIndex < aliases.length; aliasIndex += 1) {
        const alias = String(aliases[aliasIndex] || '');
        if (alias.toLowerCase().startsWith(rawLower)) {
          return {
            completion: alias,
            url: '',
            title: suggestion.title || '',
            type: 'command'
          };
        }
      }
    }
    const urlText = getUrlDisplay(suggestion.url);
    if (urlText) {
      const host = urlText.split('/')[0] || '';
      if (host.toLowerCase().startsWith(rawLower) || urlText.toLowerCase().startsWith(rawLower)) {
        return {
          completion: urlText,
          url: suggestion.url || '',
          title: suggestion.title || '',
          type: 'url'
        };
      }
    }
    const titleText = suggestion.title || '';
    if (titleText && titleText.toLowerCase().startsWith(rawLower)) {
      return {
        completion: titleText,
        url: suggestion.url || '',
        title: suggestion.title || '',
        type: 'title'
      };
    }
    return null;
  }

  function clearAutocomplete(): void {
    overlayState.autocompleteState = null;
  }

  // Any key but Tab or Enter drops the shown completion and restores what
  // was typed; true when there was one.
  function dismissAutocompletePreviewOnNonTabKey(event: KeyboardEvent | null): boolean {
    if (!event || event.key === 'Tab' || event.key === 'Enter') {
      return false;
    }
    const isModifierOnly = event.key === 'Shift' || event.key === 'Control' || event.key === 'Alt' || event.key === 'Meta';
    if (isModifierOnly) {
      return false;
    }
    if (!overlayState.autocompleteState || !overlayState.autocompleteState.completion) {
      return false;
    }
    const rawQuery = typeof overlayState.autocompleteState.rawQuery === 'string'
      ? overlayState.autocompleteState.rawQuery
      : String(overlayState.latestRawInputValue || '');
    if (overlayState.searchInput && overlayState.searchInput.value !== rawQuery) {
      overlayState.searchInput.value = rawQuery;
      overlayState.searchInput.setSelectionRange(rawQuery.length, rawQuery.length);
    }
    overlayState.latestRawInputValue = rawQuery;
    overlayState.latestOverlayQuery = rawQuery.trim();
    clearAutocomplete();
    return true;
  }

  function applyAutocomplete(
    allSuggestions: AutocompleteRow[] | null,
    primarySuggestion: AutocompleteRow | null,
    primaryHighlightReason: string
  ): void {
    const rawQuery = overlayState.latestRawInputValue;
    const trimmedQuery = rawQuery.trim();
    if (overlayState.suggestionInputPreview.isActive()) {
      return;
    }
    if (overlayState.settings.get(searchResultPriority) === 'search') {
      if (overlayState.searchInput && overlayState.searchInput.value !== rawQuery) {
        overlayState.searchInput.value = rawQuery;
        overlayState.searchInput.setSelectionRange(rawQuery.length, rawQuery.length);
      }
      clearAutocomplete();
      return;
    }
    if (Date.now() - overlayState.lastDeletionAt < 250) {
      clearAutocomplete();
      return;
    }
    if (overlayState.siteSearchState || overlayState.localSearchScopeState) {
      clearAutocomplete();
      return;
    }
    if (!isEnglishQuery(trimmedQuery) || !rawQuery) {
      clearAutocomplete();
      return;
    }
    if (!allSuggestions || !Array.isArray(allSuggestions)) {
      clearAutocomplete();
      return;
    }
    const input = overlayState.searchInput;
    if (!input) {
      return;
    }
    if (input.selectionStart !== input.value.length || input.selectionEnd !== input.value.length) {
      return;
    }
    const shouldForcePrimaryAlignment = Boolean(
      primarySuggestion &&
      primaryHighlightReason &&
      primaryHighlightReason !== 'autocomplete' &&
      primaryHighlightReason !== 'default'
    );
    let candidate: AutocompleteCandidate | null = null;
    if (primarySuggestion) {
      candidate = getAutocompleteCandidateFromSuggestion(primarySuggestion, rawQuery);
    }
    if (!candidate && shouldForcePrimaryAlignment) {
      clearAutocomplete();
      return;
    }
    if (!candidate) {
      const autocompleteSuggestions = getKeywordSearchSuggestionState(allSuggestions).autocompleteSuggestions;
      candidate = getDomainPrefixCandidate(autocompleteSuggestions, rawQuery) ||
        getAutocompleteCandidate(autocompleteSuggestions, rawQuery);
    }
    if (!candidate || !candidate.completion) {
      clearAutocomplete();
      return;
    }
    if (candidate.type === 'title') {
      clearAutocomplete();
      return;
    }
    if (candidate.completion.length <= rawQuery.length) {
      clearAutocomplete();
      return;
    }
    if (!candidate.completion.toLowerCase().startsWith(rawQuery.toLowerCase())) {
      clearAutocomplete();
      return;
    }
    // The typed part stays as typed: "4A" completes to "4Anet.com", not
    // the candidate's own "4anet.com".
    const displayText = rawQuery + candidate.completion.slice(rawQuery.length);
    input.value = displayText;
    input.setSelectionRange(rawQuery.length, displayText.length);
    overlayState.autocompleteState = {
      completion: displayText,
      displayText: displayText,
      url: candidate.url || '',
      rawQuery: rawQuery,
      title: candidate.title || '',
      type: candidate.type || ''
    };
  }

  return {
    getAutocompleteCandidate,
    clearAutocomplete,
    dismissAutocompletePreviewOnNonTabKey,
    applyAutocomplete
  };
}

export { createAutocomplete };
export type { AutocompleteDeps, AutocompleteOverlayState, AutocompleteRow, AutocompleteState };
