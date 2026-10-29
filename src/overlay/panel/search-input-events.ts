// Input events in the search box: reading the live value, the trigger
// hint, IME composition and the main input handler.
import type { createImeKeyGuard } from '../../domain/search/ime-key-guard';
import type { SuggestionInputPreview } from '../../domain/search/suggestion-input-preview';
import type { SiteSearchProvider } from '../../domain/search/types';
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
import type { OverlayPanelElements } from './panel-elements';
import type { OverlayNotices } from './overlay-notices';

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
  imeKeyGuard: Pick<ReturnType<typeof createImeKeyGuard>, 'markCompositionStart' | 'markCompositionEnd' | 'isComposing'>;
  // Typing on from a suggestion the arrows show keeps it as typed text.
  suggestionInputPreview: Pick<SuggestionInputPreview, 'commit'>;
  elements: Pick<OverlayPanelElements, 'followLiveInput' | 'inputContainer' | 'inputHistoryController' | 'searchInput'>;
  notices: Pick<OverlayNotices, 'recordMeaningfulUse'>;
  // Whether a history step is replaying the input's events.
  isApplyingInputHistory(): boolean;
}

function readInputType(event: Event | null): string {
  return event && 'inputType' in event && typeof event.inputType === 'string' ? event.inputType : '';
}

function createSearchInputEvents(deps: SearchInputEventsDeps) {
  const {
    isApplyingInputHistory,
    notices,
    elements,
    suggestionInputPreview,
    imeKeyGuard,
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

  // The same event can reach the input and the panel; each handles it once.
  const handledSearchInputEvents = new WeakSet<Event>();

  // The input the event came from: a page script may have replaced the
  // panel's input with a copy.
  function getLiveSearchInputFromEvent(event: Event | null): HTMLInputElement | null {
    const target = event ? event.target : null;
    const container = elements.inputContainer;
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
    return elements.searchInput;
  }

  function syncLiveSearchInputFromEvent(event: Event | null): HTMLInputElement | null {
    const liveInput = getLiveSearchInputFromEvent(event);
    if (liveInput && liveInput !== elements.searchInput) {
      elements.followLiveInput(liveInput);
      applyNoTranslate(liveInput);
    }
    return elements.searchInput;
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
      suggestionInputPreview.commit();
      cancelPendingOverlaySuggestionRequests();
      syncLiveSearchInputFromEvent(event);
      imeKeyGuard.markCompositionStart(event);
      searchAutocomplete.clear();
      clearPendingSearchTriggerHint();
    });
  }

  function handleSearchInputCompositionEnd(event: Event | null): void {
    runSearchInputEventOnce(event, () => {
      imeKeyGuard.markCompositionEnd(event);
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
      suggestionInputPreview.commit();
      if (elements.inputHistoryController && !isApplyingInputHistory()) {
        elements.inputHistoryController.resetNavigation();
      }
      const liveInput = syncLiveSearchInputFromEvent(event);
      notifyOverlayLoadingSession(liveInput);
      const rawValue = liveInput ? liveInput.value : '';
      const query = rawValue.trim();
      if (query) {
        notices.recordMeaningfulUse();
      }
      updateModeBadge(rawValue);
      const inputType = readInputType(event);
      const isPaste = inputType === 'insertFromPaste';
      const isDelete = inputType.startsWith('delete');
      if (isDelete) {
        searchQuery.markDeletion();
      }
      if (imeKeyGuard.isComposing()) {
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
    syncLiveSearchInputFromEvent,
    syncSearchTriggerHintFromInput,
    handleSearchInputCompositionStart,
    handleSearchInputCompositionEnd,
    handleSearchInputEvent
  };
}

export { createSearchInputEvents };
export type { SearchInputEventsDeps };
