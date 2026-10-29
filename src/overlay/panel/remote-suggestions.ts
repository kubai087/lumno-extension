// Remote search suggestions: requesting them from the background and
// merging late responses into what is shown.
import { carryOverEngineSuggestions } from '../../domain/search/utils/engine-suggestions';
import type { SuggestionLike } from '../../domain/search/types';
import { holdSuggestionsHeight } from '../../shared/search/suggestions-height-layout';
import { searchResultPriority } from '../../domain/settings/search';
import type { OverlaySettings } from '../overlay-settings';
import type { SearchQuery } from '../../shared/search-panel/search-query';
import type { SearchMode } from '../../shared/search-panel/search-mode';
import type { InputModeProvider } from '../../shared/search/input-mode/types';
import type { SearchResults } from '../../shared/search-panel/search-results';
import type { OverlaySuggestion } from './types';
import type { SuggestionSource } from '../../shared/search-panel/suggestion-source';
import type { OverlayPanelElements } from './panel-elements';
import type { LastRender } from './last-render';

// Shared by the renders of one request: whether the search engine's
// suggestions came back, and whether the list showed its final mix.
interface RemoteMixState {
  settled: boolean;
  visualSettled?: boolean;
}

interface SuggestionUpdateOptions {
  remoteMixState?: RemoteMixState;
  // The search engine's suggestions are in, or will not come.
  finalRemoteMix?: boolean;
}

interface RemoteSuggestionsDeps {
  suggestionSource: SuggestionSource;
  searchResults: SearchResults<OverlaySuggestion>;
  searchMode: SearchMode<InputModeProvider>;
  searchQuery: SearchQuery;
  updateSearchSuggestions(rows: SuggestionLike[], query: string, options?: SuggestionUpdateOptions): void;
  isSlashCommandInput(input: string): boolean;
  getDirectUrlSuggestion(query: string): unknown;
  settings: Pick<OverlaySettings, 'get'>;
  elements: Pick<OverlayPanelElements, 'suggestionsContainer'>;
  lastRender: LastRender;
}

function createRemoteSuggestions(deps: RemoteSuggestionsDeps) {
  const {
    lastRender,
    elements,
    settings,
    suggestionSource,
    searchResults,
    searchMode,
    searchQuery,
    updateSearchSuggestions,
    isSlashCommandInput,
    getDirectUrlSuggestion
  } = deps;

  const OVERLAY_FIRST_RESULT_REVEAL_DELAY_MS = 120;
  let firstResultRevealTimer: number | null = null;

  function clearFirstResultRevealTimer(): void {
    if (firstResultRevealTimer !== null) {
      window.clearTimeout(firstResultRevealTimer);
    }
    firstResultRevealTimer = null;
  }

  function isResultsListOpen(container: HTMLElement | null): container is HTMLElement {
    return Boolean(container &&
      container.getAttribute('data-collapsed') !== 'true' &&
      container.getAttribute('aria-hidden') !== 'true');
  }

  // Shows the last answer again while a request is pending; false while
  // the list is collapsed or hidden.
  function updatePendingSearchSuggestions(query: string): boolean {
    if (!isResultsListOpen(elements.suggestionsContainer)) {
      return false;
    }
    updateSearchSuggestions(searchResults.lastResponse, query);
    return true;
  }

  // Asks the worker for local results, then for the search engine's
  // suggestions, and renders each answer that is still current.
  function requestOverlaySearchSuggestions(query: string): void {
    const requestQuery = String(query || '').trim();
    const requestLocalSearchScope = searchMode.local;
    if (!requestLocalSearchScope && isSlashCommandInput(requestQuery)) {
      updateSearchSuggestions([], requestQuery);
      return;
    }
    if (searchMode.site && requestQuery) {
      updateSearchSuggestions([], requestQuery);
      return;
    }
    if (!requestQuery) {
      return;
    }
    const requestStartedAt = Date.now();
    const requestSearchFirst = settings.get(searchResultPriority) === 'search';
    const showExactSearchPendingState = requestSearchFirst &&
      !requestLocalSearchScope &&
      !getDirectUrlSuggestion(requestQuery);
    const remoteMixState: RemoteMixState = { settled: false };
    // A list of another query's results keeps its height until this
    // query's full answer; the open tabs list gives way at once.
    if (!requestLocalSearchScope && lastRender.query &&
        isResultsListOpen(elements.suggestionsContainer)) {
      holdSuggestionsHeight(elements.suggestionsContainer, window);
    }
    // Shown with the local results until this query's suggestions arrive.
    const carriedEngineSuggestions = carryOverEngineSuggestions(
      searchResults.lastEngineResponse,
      requestQuery
    );
    clearFirstResultRevealTimer();
    if (showExactSearchPendingState) {
      updateSearchSuggestions(carriedEngineSuggestions, requestQuery, { remoteMixState });
    }
    // Search-first already shows the exact search action while remote
    // suggestions are pending. Autocomplete-first keeps its short mix
    // budget so a collapsed result surface still opens only once.
    let waitForFirstResultMix = false;
    // The first rows shown when the list opened collapsed: the engine's,
    // or the local ones once their wait ends.
    const settleFirstResultMix = (rows: OverlaySuggestion[]): void => {
      clearFirstResultRevealTimer();
      remoteMixState.visualSettled = true;
      updateSearchSuggestions(rows, requestQuery, { remoteMixState, finalRemoteMix: true });
    };
    const requestSeq = suggestionSource.request({
      query: requestQuery,
      context: 'overlay',
      sourceTypes: requestLocalSearchScope ? [requestLocalSearchScope.sourceType] : undefined,
      searchFirst: requestSearchFirst
    }, {
      onLocal(rows) {
        const localSuggestions: OverlaySuggestion[] = rows;
        if (requestLocalSearchScope) {
          remoteMixState.settled = true;
          updateSearchSuggestions(localSuggestions, requestQuery);
          return null;
        }
        const container = elements.suggestionsContainer;
        waitForFirstResultMix = !requestSearchFirst &&
          Boolean(container && container.getAttribute('data-collapsed') === 'true');
        if (waitForFirstResultMix) {
          firstResultRevealTimer = window.setTimeout(() => {
            firstResultRevealTimer = null;
            if (!searchResults.isCurrentRequest(requestSeq) ||
                requestQuery !== searchQuery.text ||
                remoteMixState.visualSettled) {
              return;
            }
            settleFirstResultMix(localSuggestions);
          }, OVERLAY_FIRST_RESULT_REVEAL_DELAY_MS);
        } else if (!showExactSearchPendingState) {
          updateSearchSuggestions([...localSuggestions, ...carriedEngineSuggestions], requestQuery, {
            remoteMixState
          });
        }
        return (requestSearchFirst || waitForFirstResultMix)
          ? 0
          : Math.max(0, 120 - (Date.now() - requestStartedAt));
      },
      onLocalFailed() {
        updatePendingSearchSuggestions(requestQuery);
      },
      onRemote(rows, localRows) {
        remoteMixState.settled = true;
        const answer: OverlaySuggestion[] = rows || localRows;
        if (waitForFirstResultMix) {
          if (!remoteMixState.visualSettled) {
            settleFirstResultMix(answer);
          } else if (!rows) {
            updateSearchSuggestions(answer, requestQuery, { remoteMixState, finalRemoteMix: true });
          }
          return;
        }
        updateSearchSuggestions(answer, requestQuery, { remoteMixState, finalRemoteMix: true });
      }
    });
  }

  return {
    clearFirstResultRevealTimer,
    updatePendingSearchSuggestions,
    requestOverlaySearchSuggestions
  };
}

export { createRemoteSuggestions };
export type { RemoteMixState, RemoteSuggestionsDeps, SuggestionUpdateOptions };
