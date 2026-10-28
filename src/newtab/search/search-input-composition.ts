// IME composition in the search input: holds suggestion updates while a
// composition is open and runs them once it commits.
import type { SuggestionLike } from '../../domain/search/types';
import type { createImeKeyGuard } from '../../domain/search/ime-key-guard';
import type { DirectNavigationSettleController } from './direct-navigation-settle';
import type { RequestSuggestions } from './search-types';
import type { SearchQuery } from '../../shared/search-panel/search-query';

interface SearchInputCompositionState {
  inputParts: { input: HTMLInputElement } | null;
  // Bumped by each request, so an older one's results are dropped.
  suggestionRequestSeq: number;
  remoteSuggestionDebounceTimer: ReturnType<typeof setTimeout> | null;
  suggestionRequestWatchdogTimer: ReturnType<typeof setTimeout> | null;
}

interface SearchInputCompositionDeps {
  searchQuery: SearchQuery;
  directNavigationSettleController: Pick<DirectNavigationSettleController<unknown>, 'cancel'>;
  imeKeyGuard: Pick<ReturnType<typeof createImeKeyGuard>, 'markCompositionStart' | 'markCompositionEnd' | 'markKeyUp'>;
  clearAutocomplete(): void;
  clearSearchSuggestions(): void;
  // The address the query is, as a suggestion; null when it is not one.
  getDirectUrlSuggestion(query: string): SuggestionLike | null;
  renderPendingSuggestions(query: string): unknown;
  requestSuggestions: RequestSuggestions;
  pageState: SearchInputCompositionState;
}

function createSearchInputComposition(deps: SearchInputCompositionDeps): void {
  const {
    searchQuery,
    directNavigationSettleController,
    imeKeyGuard,
    clearAutocomplete,
    clearSearchSuggestions,
    getDirectUrlSuggestion,
    renderPendingSuggestions,
    requestSuggestions
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  // The search box exists before this module is created.
  const inputParts = pageState.inputParts;
  if (!inputParts) {
    throw new Error('Search input unavailable');
  }

  const input = inputParts.input;

  input.addEventListener('compositionstart', function(event) {
    pageState.suggestionRequestSeq += 1;
    directNavigationSettleController.cancel();
    if (pageState.remoteSuggestionDebounceTimer) {
      clearTimeout(pageState.remoteSuggestionDebounceTimer);
      pageState.remoteSuggestionDebounceTimer = null;
    }
    if (pageState.suggestionRequestWatchdogTimer) {
      clearTimeout(pageState.suggestionRequestWatchdogTimer);
      pageState.suggestionRequestWatchdogTimer = null;
    }
    imeKeyGuard.markCompositionStart(event);
    clearAutocomplete();
  });

  input.addEventListener('keyup', imeKeyGuard.markKeyUp, true);

  input.addEventListener('compositionend', function(event) {
    imeKeyGuard.markCompositionEnd(event);
    const rawValue = input.value;
    const query = rawValue.trim();
    searchQuery.set(rawValue, query);
    clearAutocomplete();
    if (!query) {
      if (pageState.remoteSuggestionDebounceTimer) {
        clearTimeout(pageState.remoteSuggestionDebounceTimer);
        pageState.remoteSuggestionDebounceTimer = null;
      }
      clearSearchSuggestions();
      return;
    }
    const directUrlSuggestion = getDirectUrlSuggestion(query);
    if (directUrlSuggestion) {
      const hasCachedOpenTabMatch =
        typeof directUrlSuggestion._xMatchedTabId === 'number';
      if (hasCachedOpenTabMatch) {
        renderPendingSuggestions(query);
      }
      requestSuggestions(query, {
        immediate: true,
        deferInitialDirectNavigationRender: !hasCachedOpenTabMatch
      });
      return;
    }
    requestSuggestions(query);
  });
}

export { createSearchInputComposition };
export type { SearchInputCompositionDeps, SearchInputCompositionState };
