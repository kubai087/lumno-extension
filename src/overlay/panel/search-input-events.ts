// Input events in the search box: reading the live value, the trigger
// hint, IME composition and the main input handler.
import type { createImeKeyGuard } from '../../domain/search/ime-key-guard';
import type { createSearchInputHistoryController } from '../../domain/search/search-input-history';
import type { SuggestionInputPreview } from '../../domain/search/suggestion-input-preview';
import type { SiteSearchProvider } from '../../domain/search/types';
import * as LumnoMessaging from '../../platform/messaging';
import type { EngagementNoticeController } from '../../shared/engagement-notice';
import type { InputModeProvider } from '../../shared/search/input-mode/types';
import type { SiteSearchCatalog } from '../../shared/search-panel/site-search/catalog';
import type { SearchQuery } from '../../shared/search-panel/search-query';
import type { SearchAutocomplete } from '../../shared/search-panel/autocomplete';
import type { SearchMode } from '../../shared/search-panel/search-mode';
import type { SearchResults } from '../../shared/search-panel/search-results';
import type { OverlaySuggestion } from './types';
import { getLocalSearchScopeTabHintProvider } from '../../shared/search-panel/labels';
import type { SearchLocale } from '../../shared/search-panel/labels';
import { getInlineSiteSearchCandidate } from '../../domain/search/utils/site-search-matching';
import type { SearchMatching } from '../../shared/search-panel/matching';
import { getLoadedShortcutRules } from '../../shared/search-panel/shortcut-rules';

interface SearchInputEventsState {
  searchInput: HTMLInputElement | null;
  inputContainer: HTMLElement | null;
  imeKeyGuard: Pick<ReturnType<typeof createImeKeyGuard>, 'markCompositionStart' | 'markCompositionEnd' | 'isComposing'>;
  inputHistoryController: Pick<ReturnType<typeof createSearchInputHistoryController>, 'resetNavigation'> | null;
  // History is being written into the input, which is not typing.
  isApplyingSearchInputHistory: boolean;
  // Typing on from a suggestion the arrows show keeps it as typed text.
  suggestionInputPreview: Pick<SuggestionInputPreview, 'commit'>;
  overlayEngagementNoticeController: Pick<EngagementNoticeController, 'recordMeaningfulUse'> | null;
}

interface SearchInputEventsDeps {
  searchMatching: SearchMatching;
  locale: SearchLocale;
  searchResults: SearchResults<OverlaySuggestion>;
  searchMode: SearchMode<InputModeProvider>;
  searchAutocomplete: SearchAutocomplete;
  searchQuery: SearchQuery;
  siteSearchCatalog: SiteSearchCatalog;
  applyNoTranslate(element: Element): unknown;
  clearSiteSearchTabHint(): void;
  isSlashCommandInput(input: string): boolean;
  setSiteSearchTabHint(provider: SiteSearchProvider | InputModeProvider): void;
  cancelPendingOverlaySuggestionRequests(): void;
  notifyOverlayLoadingSession(input: HTMLInputElement | null): void;
  updateModeBadge(rawValue: string): void;
  // Called with no rows: the list rebuilds from the typed command.
  updateSearchSuggestions(rows: never[], query: string): void;
  renderCachedTabsOrRequest(query: string): void;
  getDirectUrlSuggestion(query: string): unknown;
  updatePendingSearchSuggestions(query: string): boolean;
  requestOverlaySearchSuggestions(query: string): void;
  clearSearchSuggestions(): void;
  overlayState: SearchInputEventsState;
}

function readInputType(event: Event | null): string {
  return event && 'inputType' in event && typeof event.inputType === 'string' ? event.inputType : '';
}

function createSearchInputEvents(deps: SearchInputEventsDeps) {
  const {
    searchMatching,
    locale,
    searchResults,
    searchMode,
    searchAutocomplete,
    searchQuery,
    siteSearchCatalog,
    applyNoTranslate,
    clearSiteSearchTabHint,
    isSlashCommandInput,
    setSiteSearchTabHint,
    cancelPendingOverlaySuggestionRequests,
    notifyOverlayLoadingSession,
    updateModeBadge,
    updateSearchSuggestions,
    renderCachedTabsOrRequest,
    getDirectUrlSuggestion,
    updatePendingSearchSuggestions,
    requestOverlaySearchSuggestions,
    clearSearchSuggestions
  } = deps;

  // The panel state object shared with search-panel.ts and the other modules.
  const overlayState = deps.overlayState;

  // The same event can reach the input and the panel; each handles it once.
  const handledSearchInputEvents = new WeakSet<Event>();

  function openDocumentPipPickerFromOverlay(): void {
    LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'openDocumentPipPicker' });
  }

  // The input the event came from: a page script may have replaced the
  // panel's input with a copy.
  function getLiveSearchInputFromEvent(event: Event | null): HTMLInputElement | null {
    const target = event ? event.target : null;
    const container = overlayState.inputContainer;
    if (target instanceof HTMLInputElement && container && container.contains(target)) {
      return target;
    }
    if (container) {
      const currentInput = container.querySelector('#_x_extension_search_input_2024_unique_') ||
        container.querySelector('input');
      if (currentInput instanceof HTMLInputElement) {
        return currentInput;
      }
    }
    return overlayState.searchInput;
  }

  function syncLiveSearchInputFromEvent(event: Event | null): HTMLInputElement | null {
    const liveInput = getLiveSearchInputFromEvent(event);
    if (liveInput && liveInput !== overlayState.searchInput) {
      overlayState.searchInput = liveInput;
      applyNoTranslate(liveInput);
    }
    return overlayState.searchInput;
  }

  function runSearchInputEventOnce(event: Event | null, handler: () => void): void {
    if (event) {
      if (handledSearchInputEvents.has(event)) {
        return;
      }
      handledSearchInputEvents.add(event);
    }
    handler();
  }

  function clearPendingSearchTriggerHint(): void {
    searchMode.setTriggers(null, null);
    clearSiteSearchTabHint();
  }

  // Shows the Tab hint for an exact trigger as soon as it is typed.
  function syncSearchTriggerHintFromInput(rawValue: string): void {
    const triggerInput = String(rawValue || '').trim();
    if (!triggerInput ||
        searchMode.site ||
        searchMode.local ||
        searchMode.openTabs ||
        isSlashCommandInput(triggerInput)) {
      clearPendingSearchTriggerHint();
      return;
    }

    const providers = siteSearchCatalog.triggerProviders;
    if (getInlineSiteSearchCandidate(triggerInput, providers)) {
      clearPendingSearchTriggerHint();
      return;
    }

    // Resolve every exact configured key, name, alias, domain, or local-scope
    // trigger synchronously so its matching Tab hint does not wait for the
    // asynchronous suggestion request to finish.
    const provider = searchMatching.getSiteSearchTriggerCandidate(triggerInput, providers, null);
    if (provider) {
      searchMode.setTriggers({ provider, rawInput: triggerInput }, null);
      setSiteSearchTabHint(provider);
      return;
    }

    const shortcutRules = getLoadedShortcutRules();
    const localScope = searchMatching.getLocalSearchScopeCandidate(triggerInput, shortcutRules);
    if (localScope) {
      searchMode.setTriggers(null, { scope: localScope, rawInput: triggerInput });
      setSiteSearchTabHint(getLocalSearchScopeTabHintProvider(locale, localScope));
      return;
    }

    clearPendingSearchTriggerHint();
  }

  // Add input event for search suggestions
  function handleSearchInputCompositionStart(event: Event | null): void {
    runSearchInputEventOnce(event, () => {
      overlayState.suggestionInputPreview.commit();
      cancelPendingOverlaySuggestionRequests();
      syncLiveSearchInputFromEvent(event);
      overlayState.imeKeyGuard.markCompositionStart(event);
      searchAutocomplete.clear();
      clearPendingSearchTriggerHint();
    });
  }

  function handleSearchInputCompositionEnd(event: Event | null): void {
    runSearchInputEventOnce(event, () => {
      overlayState.imeKeyGuard.markCompositionEnd(event);
      const liveInput = syncLiveSearchInputFromEvent(event);
      notifyOverlayLoadingSession(liveInput);
      const rawValue = liveInput ? (liveInput.value || '') : '';
      const query = rawValue.trim();
      updateModeBadge(rawValue);
      if (searchResults.selectedIndex >= 0) {
        searchResults.select(-1);
      }
      searchQuery.set(rawValue, query);
      searchAutocomplete.clear();
      syncSearchTriggerHintFromInput(rawValue);
      if (query.length > 0) {
        if (!searchMode.local && isSlashCommandInput(query)) {
          updateSearchSuggestions([], query);
          return;
        }
        if (searchMode.openTabs) {
          renderCachedTabsOrRequest(query);
          return;
        }
        if (getDirectUrlSuggestion(query)) {
          updatePendingSearchSuggestions(query);
        }
        requestOverlaySearchSuggestions(query);
      } else {
        if (searchMode.openTabs) {
          renderCachedTabsOrRequest('');
          return;
        }
        clearSearchSuggestions();
      }
    });
  }

  function handleSearchInputEvent(event: Event | null): void {
    runSearchInputEventOnce(event, () => {
      overlayState.suggestionInputPreview.commit();
      if (overlayState.inputHistoryController && !overlayState.isApplyingSearchInputHistory) {
        overlayState.inputHistoryController.resetNavigation();
      }
      const liveInput = syncLiveSearchInputFromEvent(event);
      notifyOverlayLoadingSession(liveInput);
      const rawValue = liveInput ? liveInput.value : '';
      const query = rawValue.trim();
      const engagementNotice = overlayState.overlayEngagementNoticeController;
      if (query && engagementNotice && typeof engagementNotice.recordMeaningfulUse === 'function') {
        engagementNotice.recordMeaningfulUse();
      }
      updateModeBadge(rawValue);
      const inputType = readInputType(event);
      const isPaste = inputType === 'insertFromPaste';
      const isDelete = inputType.startsWith('delete');
      if (isDelete) {
        searchQuery.markDeletion();
      }
      if (overlayState.imeKeyGuard.isComposing()) {
        searchQuery.set(rawValue, query);
        return;
      }
      if (searchResults.selectedIndex >= 0) {
        searchResults.select(-1);
      }
      if (!query && searchMode.site) {
        searchQuery.clear();
        searchAutocomplete.clear();
        clearSearchSuggestions();
        return;
      }
      searchQuery.set(rawValue, query);
      searchAutocomplete.clear();
      syncSearchTriggerHintFromInput(rawValue);
      if (query.length > 0) {
        if (!searchMode.local && isSlashCommandInput(query)) {
          updateSearchSuggestions([], query);
          return;
        }
        if (searchMode.openTabs) {
          renderCachedTabsOrRequest(query);
          return;
        }
        if (isPaste || getDirectUrlSuggestion(query)) {
          updatePendingSearchSuggestions(query);
        }
        requestOverlaySearchSuggestions(query);
      } else {
        if (searchMode.openTabs) {
          renderCachedTabsOrRequest('');
          return;
        }
        // Clear suggestions and show tabs
        clearSearchSuggestions();
      }
    });
  }

  return {
    openDocumentPipPickerFromOverlay,
    syncLiveSearchInputFromEvent,
    syncSearchTriggerHintFromInput,
    handleSearchInputCompositionStart,
    handleSearchInputCompositionEnd,
    handleSearchInputEvent
  };
}

export { createSearchInputEvents };
export type { SearchInputEventsDeps, SearchInputEventsState };
