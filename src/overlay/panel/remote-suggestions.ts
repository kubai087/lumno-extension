// Remote search suggestions: requesting them from the background and
// merging late responses into what is shown.
import { carryOverEngineSuggestions } from '../../domain/search/utils/engine-suggestions';
import type { LocalSearchScope, SuggestionLike } from '../../domain/search/types';
import * as LumnoMessaging from '../../platform/messaging';
import { holdSuggestionsHeight } from '../../shared/search/suggestions-height-layout';
import { searchResultPriority } from '../../domain/settings/search';
import type { OverlaySettings } from '../overlay-settings';
import type { SearchQuery } from '../../shared/search-panel/search-query';

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

interface RemoteSuggestionsState {
  settings: Pick<OverlaySettings, 'get'>;
  suggestionsContainer: HTMLElement | null;
  lastSuggestionResponse: SuggestionLike[];
  // The last answer that had the search engine's suggestions in it.
  lastEngineSuggestionResponse: SuggestionLike[];
  // The query of the rows shown; empty for the open tabs list.
  lastRenderedQuery: string;
  // Only whether a site search is active.
  siteSearchState: unknown;
  localSearchScopeState: LocalSearchScope | null;
  // Raised for each request, so a late answer to an older one is dropped.
  overlaySuggestionRequestSeq: number;
  overlayRemoteSuggestionDebounceTimer: number | null;
  overlayFirstResultRevealTimer: number | null;
}

interface RemoteSuggestionsDeps {
  searchQuery: SearchQuery;
  updateSearchSuggestions(rows: SuggestionLike[], query: string, options?: SuggestionUpdateOptions): void;
  isSlashCommandInput(input: string): boolean;
  getDirectUrlSuggestion(query: string): unknown;
  overlayState: RemoteSuggestionsState;
}

function createRemoteSuggestions(deps: RemoteSuggestionsDeps) {
  const {
    searchQuery,
    updateSearchSuggestions,
    isSlashCommandInput,
    getDirectUrlSuggestion
  } = deps;

  // The panel state object shared with search-panel.ts and the other modules.
  const overlayState = deps.overlayState;

  const OVERLAY_FIRST_RESULT_REVEAL_DELAY_MS = 120;

  function clearFirstResultRevealTimer(): void {
    if (overlayState.overlayFirstResultRevealTimer !== null) {
      window.clearTimeout(overlayState.overlayFirstResultRevealTimer);
    }
    overlayState.overlayFirstResultRevealTimer = null;
  }

  function isResultsListOpen(container: HTMLElement | null): container is HTMLElement {
    return Boolean(container &&
      container.getAttribute('data-collapsed') !== 'true' &&
      container.getAttribute('aria-hidden') !== 'true');
  }

  // Shows the last answer again while a request is pending; false while
  // the list is collapsed or hidden.
  function updatePendingSearchSuggestions(query: string): boolean {
    if (!isResultsListOpen(overlayState.suggestionsContainer)) {
      return false;
    }
    updateSearchSuggestions(overlayState.lastSuggestionResponse, query);
    return true;
  }

  // Asks the worker for local results, then for the search engine's
  // suggestions, and renders each answer that is still current.
  function requestOverlaySearchSuggestions(query: string): void {
    const requestQuery = String(query || '').trim();
    const requestLocalSearchScope = overlayState.localSearchScopeState;
    if (!requestLocalSearchScope && isSlashCommandInput(requestQuery)) {
      updateSearchSuggestions([], requestQuery);
      return;
    }
    if (overlayState.siteSearchState && requestQuery) {
      updateSearchSuggestions([], requestQuery);
      return;
    }
    if (!requestQuery || !chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
      return;
    }
    const requestSeq = ++overlayState.overlaySuggestionRequestSeq;
    const requestStartedAt = Date.now();
    const requestSearchFirst = overlayState.settings.get(searchResultPriority) === 'search';
    const showExactSearchPendingState = requestSearchFirst &&
      !requestLocalSearchScope &&
      !getDirectUrlSuggestion(requestQuery);
    const remoteMixState: RemoteMixState = { settled: false };
    // A list of another query's results keeps its height until this
    // query's full answer; the open tabs list gives way at once.
    if (!requestLocalSearchScope && overlayState.lastRenderedQuery &&
        isResultsListOpen(overlayState.suggestionsContainer)) {
      holdSuggestionsHeight(overlayState.suggestionsContainer, window);
    }
    // Shown with the local results until this query's suggestions arrive.
    const carriedEngineSuggestions = carryOverEngineSuggestions(
      overlayState.lastEngineSuggestionResponse,
      requestQuery
    );
    if (overlayState.overlayRemoteSuggestionDebounceTimer) {
      window.clearTimeout(overlayState.overlayRemoteSuggestionDebounceTimer);
      overlayState.overlayRemoteSuggestionDebounceTimer = null;
    }
    if (overlayState.overlayFirstResultRevealTimer) {
      window.clearTimeout(overlayState.overlayFirstResultRevealTimer);
      overlayState.overlayFirstResultRevealTimer = null;
    }
    if (showExactSearchPendingState) {
      updateSearchSuggestions(carriedEngineSuggestions, requestQuery, { remoteMixState });
    }
    LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
      action: 'getSearchSuggestions',
      query: requestQuery,
      context: 'overlay',
      sourceTypes: requestLocalSearchScope ? [requestLocalSearchScope.sourceType] : undefined,
      includeOpenTabs: requestLocalSearchScope ? false : undefined
    }, function(response) {
      if (requestSeq !== overlayState.overlaySuggestionRequestSeq || requestQuery !== searchQuery.text) {
        return;
      }
      if (chrome.runtime && chrome.runtime.lastError) {
        updatePendingSearchSuggestions(requestQuery);
        return;
      }
      const localSuggestions = response && Array.isArray(response.suggestions) ? response.suggestions : [];
      if (requestLocalSearchScope) {
        remoteMixState.settled = true;
        updateSearchSuggestions(localSuggestions, requestQuery);
        return;
      }
      // Search-first already shows the exact search action while remote
      // suggestions are pending. Autocomplete-first keeps its short mix
      // budget so a collapsed result surface still opens only once.
      const container = overlayState.suggestionsContainer;
      const waitForFirstResultMix = !requestSearchFirst &&
        Boolean(container && container.getAttribute('data-collapsed') === 'true');
      if (waitForFirstResultMix) {
        overlayState.overlayFirstResultRevealTimer = window.setTimeout(() => {
          overlayState.overlayFirstResultRevealTimer = null;
          if (requestSeq !== overlayState.overlaySuggestionRequestSeq ||
              requestQuery !== searchQuery.text ||
              remoteMixState.visualSettled) {
            return;
          }
          remoteMixState.visualSettled = true;
          updateSearchSuggestions(localSuggestions, requestQuery, {
            remoteMixState,
            finalRemoteMix: true
          });
        }, OVERLAY_FIRST_RESULT_REVEAL_DELAY_MS);
      } else if (!showExactSearchPendingState) {
        updateSearchSuggestions([...localSuggestions, ...carriedEngineSuggestions], requestQuery, {
          remoteMixState
        });
      }
      const remoteDelay = (requestSearchFirst || waitForFirstResultMix)
        ? 0
        : Math.max(0, 120 - (Date.now() - requestStartedAt));
      overlayState.overlayRemoteSuggestionDebounceTimer = window.setTimeout(function() {
        overlayState.overlayRemoteSuggestionDebounceTimer = null;
        if (requestSeq !== overlayState.overlaySuggestionRequestSeq || requestQuery !== searchQuery.text) {
          return;
        }
        LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
          action: 'getSearchEngineSuggestions',
          query: requestQuery,
          context: 'overlay',
          localSuggestions: localSuggestions,
          searchFirst: requestSearchFirst
        }, function(remoteResponse) {
          if (requestSeq !== overlayState.overlaySuggestionRequestSeq || requestQuery !== searchQuery.text) {
            return;
          }
          if (chrome.runtime && chrome.runtime.lastError) {
            remoteMixState.settled = true;
            if (waitForFirstResultMix && !remoteMixState.visualSettled) {
              clearFirstResultRevealTimer();
              remoteMixState.visualSettled = true;
              updateSearchSuggestions(localSuggestions, requestQuery, {
                remoteMixState,
                finalRemoteMix: true
              });
            } else {
              updateSearchSuggestions(localSuggestions, requestQuery, {
                remoteMixState,
                finalRemoteMix: true
              });
            }
            return;
          }
          if (!remoteResponse ||
              remoteResponse.aborted === true ||
              remoteResponse.hasRemoteSuggestions !== true ||
              !Array.isArray(remoteResponse.suggestions)) {
            remoteMixState.settled = true;
            if (waitForFirstResultMix && !remoteMixState.visualSettled) {
              clearFirstResultRevealTimer();
              remoteMixState.visualSettled = true;
              updateSearchSuggestions(localSuggestions, requestQuery, {
                remoteMixState,
                finalRemoteMix: true
              });
            } else {
              updateSearchSuggestions(localSuggestions, requestQuery, {
                remoteMixState,
                finalRemoteMix: true
              });
            }
            return;
          }
          remoteMixState.settled = true;
          overlayState.lastEngineSuggestionResponse = remoteResponse.suggestions;
          if (waitForFirstResultMix) {
            if (remoteMixState.visualSettled) {
              return;
            }
            clearFirstResultRevealTimer();
            remoteMixState.visualSettled = true;
            updateSearchSuggestions(remoteResponse.suggestions, requestQuery, {
              remoteMixState,
              finalRemoteMix: true
            });
            return;
          }
          updateSearchSuggestions(remoteResponse.suggestions, requestQuery, {
            remoteMixState,
            finalRemoteMix: true
          });
        });
      }, remoteDelay);
    });
  }

  return {
    updatePendingSearchSuggestions,
    requestOverlaySearchSuggestions
  };
}

export { createRemoteSuggestions };
export type { RemoteMixState, RemoteSuggestionsDeps, RemoteSuggestionsState, SuggestionUpdateOptions };
