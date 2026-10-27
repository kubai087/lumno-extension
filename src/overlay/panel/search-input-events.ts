// Input events in the search box: reading the live value, the trigger
// hint, IME composition and the main input handler.
import type { ShortcutRule } from '../../domain/messages';
import type { createImeKeyGuard } from '../../domain/search/ime-key-guard';
import type { createSearchInputHistoryController } from '../../domain/search/search-input-history';
import type { SuggestionInputPreview } from '../../domain/search/suggestion-input-preview';
import type { AggregateSearch } from '../../domain/search/aggregate-search-store';
import type { LocalSearchScope, SiteSearchProvider } from '../../domain/search/types';
import * as LumnoMessaging from '../../platform/messaging';
import type { EngagementNoticeController } from '../../shared/engagement-notice';
import type { InputModeProvider } from '../../shared/search/input-mode/types';
import type { LocalSearchScopeTrigger, SiteSearchTrigger } from './types';
import { shortcutRulesCache } from '../../shared/search/shortcut-rules-cache';
import type { SiteSearchCatalog } from '../features/site-search/catalog';

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
  siteSearchTriggerState: SiteSearchTrigger<SiteSearchProvider> | null;
  localSearchScopeTriggerState: LocalSearchScopeTrigger | null;
  // Only whether a site search or a local scope is active.
  siteSearchState: unknown;
  localSearchScopeState: LocalSearchScope | null;
  openTabsSearchModeActive: boolean;
  selectedIndex: number;
  latestOverlayQuery: string;
  latestRawInputValue: string;
  lastDeletionAt: number;
}

interface SearchInputEventsDeps {
  siteSearchCatalog: SiteSearchCatalog;
  applyNoTranslate(element: Element): unknown;
  clearSiteSearchTabHint(): void;
  isSlashCommandInput(input: string): boolean;
  getSearchTriggerProviders(siteProviders: SiteSearchProvider[], aggregates: AggregateSearch[]): SiteSearchProvider[];
  getInlineSiteSearchCandidate(input: string, providers: SiteSearchProvider[]): unknown;
  getSiteSearchTriggerCandidate(input: string, providers: SiteSearchProvider[], options: null): SiteSearchProvider | null;
  setSiteSearchTabHint(provider: SiteSearchProvider | InputModeProvider): void;
  getLocalSearchScopeCandidate(input: string, rules: ShortcutRule[] | undefined): LocalSearchScope | null;
  getLocalSearchScopeTabHintProvider(scope: LocalSearchScope): InputModeProvider;
  cancelPendingOverlaySuggestionRequests(): void;
  clearAutocomplete(): void;
  notifyOverlayLoadingSession(input: HTMLInputElement | null): void;
  updateModeBadge(rawValue: string): void;
  updateSelection(): void;
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
    siteSearchCatalog,
    applyNoTranslate,
    clearSiteSearchTabHint,
    isSlashCommandInput,
    getSearchTriggerProviders,
    getInlineSiteSearchCandidate,
    getSiteSearchTriggerCandidate,
    setSiteSearchTabHint,
    getLocalSearchScopeCandidate,
    getLocalSearchScopeTabHintProvider,
    cancelPendingOverlaySuggestionRequests,
    clearAutocomplete,
    notifyOverlayLoadingSession,
    updateModeBadge,
    updateSelection,
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
    overlayState.siteSearchTriggerState = null;
    overlayState.localSearchScopeTriggerState = null;
    clearSiteSearchTabHint();
  }

  // Shows the Tab hint for an exact trigger as soon as it is typed.
  function syncSearchTriggerHintFromInput(rawValue: string): void {
    const triggerInput = String(rawValue || '').trim();
    if (!triggerInput ||
        overlayState.siteSearchState ||
        overlayState.localSearchScopeState ||
        overlayState.openTabsSearchModeActive ||
        isSlashCommandInput(triggerInput)) {
      clearPendingSearchTriggerHint();
      return;
    }

    const siteProviders = siteSearchCatalog.providers;
    const providers = getSearchTriggerProviders(
      siteProviders,
      siteSearchCatalog.aggregates
    );
    if (getInlineSiteSearchCandidate(triggerInput, providers)) {
      clearPendingSearchTriggerHint();
      return;
    }

    // Resolve every exact configured key, name, alias, domain, or local-scope
    // trigger synchronously so its matching Tab hint does not wait for the
    // asynchronous suggestion request to finish.
    const provider = getSiteSearchTriggerCandidate(triggerInput, providers, null);
    if (provider) {
      overlayState.siteSearchTriggerState = { provider, rawInput: triggerInput };
      overlayState.localSearchScopeTriggerState = null;
      setSiteSearchTabHint(provider);
      return;
    }

    const shortcutRules = shortcutRulesCache.rules;
    const localScope = getLocalSearchScopeCandidate(triggerInput, shortcutRules);
    if (localScope) {
      overlayState.siteSearchTriggerState = null;
      overlayState.localSearchScopeTriggerState = { scope: localScope, rawInput: triggerInput };
      setSiteSearchTabHint(getLocalSearchScopeTabHintProvider(localScope));
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
      clearAutocomplete();
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
      if (overlayState.selectedIndex >= 0) {
        overlayState.selectedIndex = -1;
        updateSelection();
      }
      overlayState.latestOverlayQuery = query;
      overlayState.latestRawInputValue = rawValue;
      clearAutocomplete();
      syncSearchTriggerHintFromInput(rawValue);
      if (query.length > 0) {
        if (!overlayState.localSearchScopeState && isSlashCommandInput(query)) {
          updateSearchSuggestions([], query);
          return;
        }
        if (overlayState.openTabsSearchModeActive) {
          renderCachedTabsOrRequest(query);
          return;
        }
        if (getDirectUrlSuggestion(query)) {
          updatePendingSearchSuggestions(query);
        }
        requestOverlaySearchSuggestions(query);
      } else {
        if (overlayState.openTabsSearchModeActive) {
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
        overlayState.lastDeletionAt = Date.now();
      }
      if (overlayState.imeKeyGuard.isComposing()) {
        overlayState.latestRawInputValue = rawValue;
        overlayState.latestOverlayQuery = query;
        return;
      }
      if (overlayState.selectedIndex >= 0) {
        overlayState.selectedIndex = -1;
        updateSelection();
      }
      if (!query && overlayState.siteSearchState) {
        overlayState.latestOverlayQuery = '';
        overlayState.latestRawInputValue = '';
        clearAutocomplete();
        clearSearchSuggestions();
        return;
      }
      overlayState.latestOverlayQuery = query;
      overlayState.latestRawInputValue = rawValue;
      clearAutocomplete();
      syncSearchTriggerHintFromInput(rawValue);
      if (query.length > 0) {
        if (!overlayState.localSearchScopeState && isSlashCommandInput(query)) {
          updateSearchSuggestions([], query);
          return;
        }
        if (overlayState.openTabsSearchModeActive) {
          renderCachedTabsOrRequest(query);
          return;
        }
        if (isPaste || getDirectUrlSuggestion(query)) {
          updatePendingSearchSuggestions(query);
        }
        requestOverlaySearchSuggestions(query);
      } else {
        if (overlayState.openTabsSearchModeActive) {
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
