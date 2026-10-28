// Inline autocomplete for the search input.
import type { SuggestionInputPreview } from '../../domain/search/suggestion-input-preview';
import type { SiteSearchProvider } from '../../domain/search/types';
import type { SearchInputParts } from '../../shared/react/search-input';
import type { Suggestion } from '../../shared/react/search/suggestion-list/types';
import type { AutocompleteState } from './search-types';
import type { SiteSearchProviders } from './site-search-providers';
import { searchResultPriority } from '../../domain/settings/search';
import type { SettingsStore } from '../../platform/settings-store';
import type { SearchQuery } from '../../shared/search-panel/search-query';

interface SearchAutocompleteState {
  inputParts: SearchInputParts | null;
  autocompleteState: AutocompleteState | null;
  siteSearchState: SiteSearchProvider | null;
  // A suggestion the arrows show keeps the input until it is dropped.
  suggestionInputPreview: Pick<SuggestionInputPreview, 'isActive'>;
}

interface SearchAutocompleteDeps {
  searchQuery: SearchQuery;
  settings: Pick<SettingsStore, 'get'>;
  getUrlDisplay(url: string | undefined): string;
  isEnglishQuery(query: string): boolean;
  getKeywordSearchSuggestionState: SiteSearchProviders['getKeywordSearchSuggestionState'];
  pageState: SearchAutocompleteState;
}

// A completion and what it completes to.
interface AutocompleteCandidate {
  completion: string;
  url: string;
  title: string;
  type: 'command' | 'url' | 'title';
}

type SuggestionList = readonly (Suggestion | null | undefined)[];

function createSearchAutocomplete(deps: SearchAutocompleteDeps) {
  const {
    searchQuery,
    settings,
    getUrlDisplay,
    isEnglishQuery,
    getKeywordSearchSuggestionState
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  function getAutocompleteCandidate(allSuggestions: SuggestionList | null | undefined, rawQuery: string): AutocompleteCandidate | null {
    if (!allSuggestions || !rawQuery) {
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
          const aliases = suggestion.commandAliases || [];
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

  function getDomainPrefixCandidate(allSuggestions: SuggestionList | null | undefined, rawQuery: string): AutocompleteCandidate | null {
    if (!allSuggestions || !rawQuery) {
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

  function getAutocompleteCandidateFromSuggestion(suggestion: Suggestion | null | undefined, rawQuery: string): AutocompleteCandidate | null {
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
      const aliases = suggestion.commandAliases || [];
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
    pageState.autocompleteState = null;
  }

  // Puts back the text as typed in place of a completion; false when none
  // was showing.
  function restoreUserAuthoredSearchInput(): boolean {
    if (!pageState.autocompleteState || !pageState.autocompleteState.completion) {
      return false;
    }
    const rawQuery = pageState.autocompleteState.rawQuery;
    if (pageState.inputParts && pageState.inputParts.input.value !== rawQuery) {
      pageState.inputParts.input.value = rawQuery;
      pageState.inputParts.input.setSelectionRange(rawQuery.length, rawQuery.length);
    }
    searchQuery.set(rawQuery);
    clearAutocomplete();
    return true;
  }

  function dismissAutocompletePreviewOnNonTabKey(event: Pick<KeyboardEvent, 'key'>): boolean {
    if (event.key === 'Tab') {
      return false;
    }
    const isModifierOnly = event.key === 'Shift' || event.key === 'Control' || event.key === 'Alt' || event.key === 'Meta';
    if (isModifierOnly) {
      return false;
    }
    return restoreUserAuthoredSearchInput();
  }

  // Shows the completion the suggestions give for the typed text, keeping
  // to the first row when the list highlights it for a reason.
  function applyAutocomplete(
    allSuggestions: SuggestionList | null | undefined,
    primarySuggestion?: Suggestion | null,
    primaryHighlightReason?: string
  ): void {
    const rawQuery = searchQuery.raw;
    const trimmedQuery = rawQuery.trim();
    const inputParts = pageState.inputParts;
    if (pageState.suggestionInputPreview.isActive()) {
      return;
    }
    if (settings.get(searchResultPriority) === 'search') {
      if (inputParts && inputParts.input.value !== rawQuery) {
        inputParts.input.value = rawQuery;
        inputParts.input.setSelectionRange(rawQuery.length, rawQuery.length);
      }
      clearAutocomplete();
      return;
    }
    if (Date.now() - searchQuery.lastDeletionAt < 250) {
      clearAutocomplete();
      return;
    }
    if (pageState.siteSearchState) {
      clearAutocomplete();
      return;
    }
    if (!isEnglishQuery(trimmedQuery) || !rawQuery) {
      clearAutocomplete();
      return;
    }
    if (!allSuggestions || !inputParts) {
      clearAutocomplete();
      return;
    }
    const input = inputParts.input;
    if (input.selectionStart !== input.value.length ||
        input.selectionEnd !== input.value.length) {
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
      const autocompleteSuggestions = getKeywordSearchSuggestionState(
        allSuggestions.filter((item): item is Suggestion => Boolean(item))
      ).autocompleteSuggestions;
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
    pageState.autocompleteState = {
      completion: displayText,
      displayText: displayText,
      url: candidate.url || '',
      rawQuery: rawQuery,
      title: candidate.title || '',
      type: candidate.type
    };
  }

  return {
    getAutocompleteCandidate,
    clearAutocomplete,
    restoreUserAuthoredSearchInput,
    dismissAutocompletePreviewOnNonTabKey,
    applyAutocomplete
  };
}

type SearchAutocomplete = ReturnType<typeof createSearchAutocomplete>;

export { createSearchAutocomplete };
export type { AutocompleteCandidate, SearchAutocomplete, SearchAutocompleteDeps, SearchAutocompleteState };
