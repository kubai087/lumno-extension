// Keys inside the panel: Tab into modes and autocomplete, the input's
// keydown, and navigating, opening and deleting results.
import type { ShortcutRule, WebAppearanceMode } from '../../domain/messages';
import type { createSearchInputHistoryController } from '../../domain/search/search-input-history';
import type { SuggestionInputPreview } from '../../domain/search/suggestion-input-preview';
import type { SuggestionLike } from '../../domain/search/types';
import type { ThemeMode } from '../../domain/settings/appearance';
import * as LumnoMessaging from '../../platform/messaging';
import type { SuggestionElement } from '../../shared/react/search/suggestion-list/types';
import type { InputModeController } from '../../shared/search/search-input-mode';
import type { InputModeProvider } from '../../shared/search/input-mode/types';
import type { NumberShortcutOptions } from '../../shared/search/suggestion-navigation';
import type { ActivationEvent } from './result-activation';
import type { SlashCommand } from './slash-commands';
import type { OverlaySuggestion } from './types';
import { shortcutRulesCache } from '../../shared/search/shortcut-rules-cache';
import { overlayTabPriority } from '../../domain/settings/overlay-panel';
import { macosCtrlSuggestionNavigationEnabled } from '../../domain/settings/search';
import type { OverlaySettings } from '../overlay-settings';
import type { SiteSearchCatalog } from '../../shared/search-panel/site-search/catalog';
import type { SearchQuery } from '../../shared/search-panel/search-query';
import type { SearchAutocomplete } from '../../shared/search-panel/autocomplete';
import type { SearchMode } from '../../shared/search-panel/search-mode';
import type { SearchResults } from '../../shared/search-panel/search-results';
import { isAggregateSearchProvider } from '../../domain/search/aggregate-search-store';
import type { SearchMatching } from '../../shared/search-panel/matching';
import type { SearchModeActions } from '../../shared/search-panel/mode-actions';
import type { SuggestionModifiers } from '../../shared/search-panel/suggestion-modifiers';
import * as SEARCH_INPUT_HISTORY from '../../domain/search/search-input-history';
import * as SUGGESTION_NAVIGATION from '../../shared/search/suggestion-navigation';
import type { ResultActivation } from '../../shared/search-panel/result-activation';
import type { SearchModeMenu } from '../../shared/search-panel/mode-menu';

interface PanelKeysState {
  settings: Pick<OverlaySettings, 'get'>;
  overlay: HTMLElement | null;
  searchInput: HTMLInputElement | null;
  suggestionsContainer: HTMLElement | null;
  inputModeController: Pick<InputModeController,
    'handleModeMenuTabFocusToggle' | 'shouldCompleteModeMenuDoubleTab' | 'shouldOpenModeMenuForActiveModeOnTab' |
    'openModeMenu' | 'shouldOpenModeMenuOnDoubleTab' | 'shouldRemoveModeTagOnBackspace' | 'closeModeMenu'> | null;
  inputHistoryController: Pick<ReturnType<typeof createSearchInputHistoryController>, 'move' | 'record'> | null;
  isApplyingSearchInputHistory: boolean;
  // The search suggestion the arrows show in the input.
  suggestionInputPreview: SuggestionInputPreview;
  overlayThemeMode: ThemeMode;
  prioritizeCurrentPageMatch: boolean;
  currentOverlayTabId: number | null;
}

interface PanelKeysDeps {
  suggestionModifiers: SuggestionModifiers;
  modeActions: SearchModeActions<InputModeProvider>;
  searchMatching: SearchMatching;
  searchResults: SearchResults<OverlaySuggestion>;
  searchMode: SearchMode<InputModeProvider>;
  searchAutocomplete: SearchAutocomplete;
  searchQuery: SearchQuery;
  siteSearchCatalog: SiteSearchCatalog;
  cancelPendingOpenTabsPrefixEntry(): boolean;
  modeMenu: Pick<SearchModeMenu, 'openFromDoubleTab'>;
  activateOpenTabsSearchMode(options?: { deferPrefixEntry?: boolean; preserveModeMenuDoubleTab?: boolean }): void;
  getShortcutRules(): Promise<ShortcutRule[]>;
  requestOverlaySearchSuggestions(query: string): void;
  clearSearchSuggestions(): void;
  clearOpenTabsSearchMode(): void;
  isImeCompositionEvent(event: KeyboardEvent): boolean;
  // The rendered rows, in list order.
  suggestionItems: SuggestionElement[];
  numberShortcutOptions: NumberShortcutOptions;
  removeOverlay(overlay: HTMLElement | null): void;
  closeOverlayWithMotion(overlay: HTMLElement | null): void;
  updateSelection(): void;
  scrollSelectedSuggestionIntoView(direction: 'up' | 'down', didWrap: boolean): void;
  getCommandMatch(rawInput: string): { command: SlashCommand; completion: string } | null;
  applyThemeModeChange(mode: string): void;
  getNextThemeMode(mode: string): ThemeMode;
  applyWebAppearanceMode(mode: WebAppearanceMode): void;
  applyNextWebAppearanceMode(): void;
  openDocumentPipPickerFromOverlay(): void;
  isModeCommand(input: string): boolean;
  openOverlayCommunityQrDialog(qrUrl: string): void;
  openSiteSearchProviderQuery(provider: InputModeProvider | null, query: string, event: ActivationEvent | null): boolean;
  finishOverlayResultActivation(event: ActivationEvent | null, canOpenInBackground: boolean): boolean;
  resultActivation: ResultActivation;
  isSlashCommandInput(input: string): boolean;
  // Called with no rows: the list rebuilds from the typed command.
  updateSearchSuggestions(rows: never[], query: string): void;
  // The address a query leads straight to, or '' to search it.
  resolveQuickNavigation(query: string): Promise<string>;
  overlayState: PanelKeysState;
}

function isWebAppearanceMode(value: unknown): value is WebAppearanceMode {
  return value === 'auto' || value === 'light' || value === 'dark';
}

function createPanelKeys(deps: PanelKeysDeps) {
  const {
    suggestionModifiers,
    modeActions,
    searchMatching,
    searchResults,
    searchMode,
    searchAutocomplete,
    searchQuery,
    siteSearchCatalog,
    cancelPendingOpenTabsPrefixEntry,
    modeMenu,
    activateOpenTabsSearchMode,
    getShortcutRules,
    requestOverlaySearchSuggestions,
    clearSearchSuggestions,
    clearOpenTabsSearchMode,
    isImeCompositionEvent,
    suggestionItems,
    numberShortcutOptions,
    removeOverlay,
    closeOverlayWithMotion,
    updateSelection,
    scrollSelectedSuggestionIntoView,
    getCommandMatch,
    applyThemeModeChange,
    getNextThemeMode,
    applyWebAppearanceMode,
    applyNextWebAppearanceMode,
    openDocumentPipPickerFromOverlay,
    isModeCommand,
    openOverlayCommunityQrDialog,
    openSiteSearchProviderQuery,
    finishOverlayResultActivation,
    resultActivation,
    isSlashCommandInput,
    updateSearchSuggestions,
    resolveQuickNavigation
  } = deps;

  // The panel state object shared with search-panel.ts and the other modules.
  const overlayState = deps.overlayState;

  // Tab: the mode menu, a typed trigger's mode, or the shown completion;
  // true when it was used.
  function handleTabKey(e: KeyboardEvent | null): boolean {
    const input = overlayState.searchInput;
    if (!e || e.defaultPrevented || !input) {
      return false;
    }
    if (overlayState.inputModeController &&
        typeof overlayState.inputModeController.handleModeMenuTabFocusToggle === 'function' &&
        overlayState.inputModeController.handleModeMenuTabFocusToggle(e)) {
      return true;
    }
    // Tab takes the suggestion the arrows show as typed text.
    if (!e.shiftKey && overlayState.suggestionInputPreview.commit()) {
      e.preventDefault();
      searchQuery.set(input.value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    if (overlayState.inputModeController &&
        typeof overlayState.inputModeController.shouldCompleteModeMenuDoubleTab === 'function') {
      const shouldOpenModeMenu =
        overlayState.inputModeController.shouldCompleteModeMenuDoubleTab(e);
      if (shouldOpenModeMenu) {
        cancelPendingOpenTabsPrefixEntry();
        void modeMenu.openFromDoubleTab();
        return true;
      }
      if (e.defaultPrevented) {
        return true;
      }
    }
    if (overlayState.inputModeController &&
        typeof overlayState.inputModeController.shouldOpenModeMenuForActiveModeOnTab === 'function' &&
        overlayState.inputModeController.shouldOpenModeMenuForActiveModeOnTab(e)) {
      void overlayState.inputModeController.openModeMenu('none');
      return true;
    }
    if (searchMode.site || searchMode.local || searchMode.openTabs) {
      return false;
    }
    // On a page the arrows selected, Tab puts its address in the input to edit.
    if (!e.shiftKey && overlayState.suggestionInputPreview.editAddress(input, getSelectedSuggestion())) {
      e.preventDefault();
      searchQuery.set(input.value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    const rawValue = input.value;
    const rawTrigger = searchQuery.raw || rawValue;
    const triggerInput = (rawTrigger || rawValue).trim();
    if (!triggerInput && overlayState.inputModeController &&
        typeof overlayState.inputModeController.shouldOpenModeMenuOnDoubleTab === 'function') {
      const shouldOpenModeMenu = overlayState.inputModeController.shouldOpenModeMenuOnDoubleTab(e);
      if (shouldOpenModeMenu) {
        cancelPendingOpenTabsPrefixEntry();
        void modeMenu.openFromDoubleTab();
        return true;
      }
      if (e.defaultPrevented) {
        activateOpenTabsSearchMode({
          deferPrefixEntry: true,
          preserveModeMenuDoubleTab: true
        });
        return true;
      }
      return false;
    }
    const siteTrigger = searchMode.siteTrigger;
    if (siteTrigger && siteTrigger.rawInput === triggerInput && siteTrigger.provider) {
      e.preventDefault();
      modeActions.activateSiteSearch(siteTrigger.provider);
      return true;
    }
    const scopeTrigger = searchMode.localTrigger;
    if (scopeTrigger && scopeTrigger.rawInput === triggerInput && scopeTrigger.scope) {
      e.preventDefault();
      return modeActions.activateLocalSearchScope(scopeTrigger.scope);
    }
    if (triggerInput) {
      e.preventDefault();
      const providers = siteSearchCatalog.triggerProviders;
      const topSiteMatch = searchMatching.getTopSiteMatchCandidate(searchResults.rows, triggerInput);
      const directProvider = searchMatching.getSiteSearchTriggerCandidate(triggerInput, providers, topSiteMatch);
      if (directProvider) {
        modeActions.activateSiteSearch(directProvider);
        return true;
      }
      const cachedRules = shortcutRulesCache.rules;
      const directLocalScope = searchMatching.getLocalSearchScopeCandidate(triggerInput, cachedRules);
      if (siteSearchCatalog.loadedProviders && directLocalScope) {
        modeActions.activateLocalSearchScope(directLocalScope);
        return true;
      }
      void Promise.all([
        siteSearchCatalog.loadProviders(),
        siteSearchCatalog.loadAggregates(),
        getShortcutRules()
      ]).then(([, , rules]) => {
        // The input may have been replaced while the lists loaded.
        const liveInput = overlayState.searchInput;
        if (!liveInput || searchMode.site || searchMode.local ||
            searchMode.openTabs || String(liveInput.value || '').trim() !== triggerInput) {
          return;
        }
        const asyncTopSiteMatch = searchMatching.getTopSiteMatchCandidate(searchResults.rows, triggerInput);
        const asyncProvider = searchMatching.getSiteSearchTriggerCandidate(
          triggerInput,
          siteSearchCatalog.triggerProviders,
          asyncTopSiteMatch
        );
        if (asyncProvider) {
          modeActions.activateSiteSearch(asyncProvider);
          return;
        }
        const asyncLocalScope = searchMatching.getLocalSearchScopeCandidate(triggerInput, rules);
        if (asyncLocalScope) {
          modeActions.activateLocalSearchScope(asyncLocalScope);
          return;
        }
        searchAutocomplete.accept();
      });
      return true;
    }
    if (searchAutocomplete.state && searchAutocomplete.state.completion) {
      e.preventDefault();
      searchAutocomplete.accept();
      return true;
    }
    return false;
  }

  // Backspace in an empty input removes the mode tag, unless the tag asks
  // for a second press first.
  function shouldRemoveSearchModeTagOnBackspace(event: KeyboardEvent): boolean {
    if (!overlayState.inputModeController ||
        typeof overlayState.inputModeController.shouldRemoveModeTagOnBackspace !== 'function') {
      return true;
    }
    const shouldRemove = overlayState.inputModeController.shouldRemoveModeTagOnBackspace(event);
    if (!shouldRemove) {
      event.preventDefault();
    }
    return shouldRemove;
  }

  function handleSearchInputKeydown(e: KeyboardEvent): void {
    const input = overlayState.searchInput;
    if (!input) {
      return;
    }
    suggestionModifiers.syncFromEvent(e);
    if (!e.metaKey && !e.ctrlKey && !e.altKey) {
      e.stopPropagation();
    }
    // An open scope menu closes first and leaves the scope as it is.
    if (e.key === 'Escape' && overlayState.inputModeController &&
        overlayState.inputModeController.closeModeMenu(false)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // Then the text typed before the arrows showed a suggestion comes back.
    if (e.key === 'Escape' && overlayState.suggestionInputPreview.restore(input, searchQuery.raw)) {
      e.preventDefault();
      e.stopPropagation();
      searchResults.select(-1);
      updateSelection();
      return;
    }
    // Leaving a site search lists the query's ordinary results.
    if (e.key === 'Escape' && searchMode.site) {
      e.preventDefault();
      e.stopPropagation();
      modeActions.clearSiteSearch();
      const fallbackQuery = input.value.trim();
      if (fallbackQuery) {
        requestOverlaySearchSuggestions(fallbackQuery);
      } else {
        clearSearchSuggestions();
      }
      return;
    }
    if (e.key === 'Escape' && searchMode.local) {
      e.preventDefault();
      e.stopPropagation();
      modeActions.clearLocalSearchScope();
      const fallbackQuery = input.value.trim();
      if (fallbackQuery) {
        requestOverlaySearchSuggestions(fallbackQuery);
      } else {
        clearSearchSuggestions();
      }
      return;
    }
    if (e.key === 'Escape' && searchMode.openTabs) {
      e.preventDefault();
      e.stopPropagation();
      clearOpenTabsSearchMode();
      return;
    }
    if (e.key === 'Backspace' && searchMode.site && !input.value) {
      if (!shouldRemoveSearchModeTagOnBackspace(e)) {
        return;
      }
      modeActions.clearSiteSearch();
      return;
    }
    if (e.key === 'Backspace' && searchMode.local && !input.value) {
      if (!shouldRemoveSearchModeTagOnBackspace(e)) {
        return;
      }
      modeActions.clearLocalSearchScope();
      clearSearchSuggestions();
      return;
    }
    if (e.key === 'Backspace' && searchMode.openTabs && !input.value) {
      if (!shouldRemoveSearchModeTagOnBackspace(e)) {
        return;
      }
      clearOpenTabsSearchMode();
      return;
    }
    if (isImeCompositionEvent(e)) {
      return;
    }
    const inputHistoryDirection =
      SEARCH_INPUT_HISTORY.getShortcutDirection(e);
    if (inputHistoryDirection) {
      e.preventDefault();
      e.stopPropagation();
      if (overlayState.inputHistoryController) {
        const result = overlayState.inputHistoryController.move(
          inputHistoryDirection,
          input.value
        );
        if (result.handled) {
          overlayState.isApplyingSearchInputHistory = true;
          try {
            input.value = result.value;
            input.setSelectionRange(result.value.length, result.value.length);
            input.dispatchEvent(new Event('input', { bubbles: true }));
          } finally {
            overlayState.isApplyingSearchInputHistory = false;
          }
        }
      }
      return;
    }
    if (e.key === 'Tab') {
      handleTabKey(e);
      return;
    }
    const suggestionNavigationKey = getSuggestionNavigationKey(e);
    if (suggestionNavigationKey || e.key === 'Enter' || e.key === 'Escape') {
      if (suggestionNavigationKey) {
        e.stopPropagation();
      }
      if (e.isTrusted === true) {
        handleOverlayKeydown(e);
      }
      return;
    }
    searchAutocomplete.dismissOnKey(e);
    if (e.key !== 'Backspace' && !e.metaKey && !e.ctrlKey && !e.altKey &&
        !overlayState.suggestionInputPreview.isActive()) {
      searchQuery.set(input.value);
    }
  }

  // Add keyboard navigation
  function getAutoHighlightIndex(): number {
    return suggestionItems.findIndex((item) => Boolean(item && item._xIsAutocompleteTop));
  }

  // Enter on this row switches to the tab it is open in.
  function shouldSwitchMatchedTabSuggestion(suggestion: SuggestionLike | null, index: number): boolean {
    if (!suggestion || typeof suggestion._xMatchedTabId !== 'number') {
      return false;
    }
    if (overlayState.prioritizeCurrentPageMatch &&
      typeof overlayState.currentOverlayTabId === 'number' &&
      suggestion._xMatchedTabId === overlayState.currentOverlayTabId &&
      index === 0) {
      return true;
    }
    if (!overlayState.settings.get(overlayTabPriority)) {
      return false;
    }
    return index === 0;
  }

  // The result row the arrows selected; null for none or an open tab.
  function getSelectedSuggestion(): OverlaySuggestion | null {
    const index = searchResults.selectedIndex;
    const item = suggestionItems[index];
    return item && item._xIsSearchSuggestion ? searchResults.rows[index] || null : null;
  }

  // Shows the selected search suggestion in the input, or what was typed
  // for any other row.
  function previewSelectedSuggestion(input: HTMLInputElement): void {
    overlayState.suggestionInputPreview.show(input, getSelectedSuggestion(), searchQuery.raw);
  }

  function getSuggestionNavigationKey(event: KeyboardEvent): 'ArrowDown' | 'ArrowUp' | '' {
    return SUGGESTION_NAVIGATION.getSuggestionNavigationKey(event, {
      macosCtrlEnabled: overlayState.settings.get(macosCtrlSuggestionNavigationEnabled),
      navigatorLike: window && window.navigator ? window.navigator : null
    });
  }

  // Keys that belong to the overlay (see LumnoOverlayKeyboard), plus the
  // navigation, Enter and Escape keys forwarded by the input handler.
  function handleOverlayKeydown(e: KeyboardEvent): void {
    const input = overlayState.searchInput;
    if (!input) {
      return;
    }
    suggestionModifiers.syncFromEvent(e);
    if (SUGGESTION_NAVIGATION.handleNumberShortcutKeyEvent(
      e,
      suggestionItems,
      overlayState.suggestionsContainer,
      numberShortcutOptions
    )) {
      return;
    }
    if (isImeCompositionEvent(e)) {
      return;
    }
    const suggestionNavigationKey = getSuggestionNavigationKey(e);
    searchAutocomplete.dismissOnKey(e);
    if (e.key === 'Escape' && overlayState.overlay) {
      closeOverlayWithMotion(overlayState.overlay);
    } else if (suggestionNavigationKey === 'ArrowDown') {
      e.preventDefault();
      if (suggestionItems.length === 0) {
        return;
      }
      let didWrap = false;
      if (searchResults.selectedIndex === -1) {
        // Move from auto highlight (or input) to next suggestion
        const autoIndex = getAutoHighlightIndex();
        const nextIndex = autoIndex >= 0 ? (autoIndex + 1) % suggestionItems.length : 0;
        searchResults.select(nextIndex);
        didWrap = autoIndex >= 0 && nextIndex === 0;
      } else {
        // Move to next suggestion
        const previousIndex = searchResults.selectedIndex;
        searchResults.select((searchResults.selectedIndex + 1) % suggestionItems.length);
        didWrap = previousIndex === suggestionItems.length - 1 && searchResults.selectedIndex === 0;
      }
      updateSelection();
      previewSelectedSuggestion(input);
      scrollSelectedSuggestionIntoView('down', didWrap);
      input.focus();
    } else if (suggestionNavigationKey === 'ArrowUp') {
      e.preventDefault();
      if (suggestionItems.length === 0) {
        return;
      }
      let didWrap = false;
      if (searchResults.selectedIndex === 0) {
        // Wrap from first suggestion to the last suggestion
        searchResults.select(suggestionItems.length - 1);
        didWrap = true;
      } else if (searchResults.selectedIndex === -1) {
        const autoIndex = getAutoHighlightIndex();
        if (autoIndex > 0) {
          searchResults.select(autoIndex - 1);
        } else if (autoIndex === 0) {
          searchResults.select(suggestionItems.length - 1);
          didWrap = true;
        } else {
          // Move from input to last suggestion
          searchResults.select(suggestionItems.length - 1);
          didWrap = true;
        }
      } else {
        // Move to previous suggestion
        searchResults.select(searchResults.selectedIndex - 1);
      }
      updateSelection();
      previewSelectedSuggestion(input);
      scrollSelectedSuggestionIntoView('up', didWrap);
      input.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // A suggestion the arrows show opens as its row; the query stays what
      // was typed.
      const query = (overlayState.suggestionInputPreview.isActive()
        ? searchQuery.raw
        : input.value).trim();
      if (query && overlayState.inputHistoryController) {
        overlayState.inputHistoryController.record(query);
      }
      const commandMatch = searchMode.local ? null : getCommandMatch(query);
      if (commandMatch && searchResults.selectedIndex === -1) {
        if (commandMatch.command.type === 'modeSwitch') {
          applyThemeModeChange(getNextThemeMode(overlayState.overlayThemeMode || 'system'));
          input.focus();
          return;
        } else if (commandMatch.command.type === 'webAppearanceSwitch') {
          applyNextWebAppearanceMode();
          input.focus();
          return;
        } else if (commandMatch.command.type === 'commandNewTab') {
          LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'openNewTab' });
        } else if (commandMatch.command.type === 'commandSettings') {
          LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'openOptionsPage' });
        } else if (commandMatch.command.type === 'commandOpenTabs') {
          input.value = '';
          searchQuery.clear();
          activateOpenTabsSearchMode();
          input.focus();
          return;
        } else if (commandMatch.command.type === 'commandCopyUrl') {
          LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'copyCurrentPageUrl' });
        } else if (commandMatch.command.type === 'commandDocumentPip') {
          openDocumentPipPickerFromOverlay();
        }
        removeOverlay(overlayState.overlay);
        return;
      }
      if (!searchMode.local && isModeCommand(query) && searchResults.selectedIndex === -1) {
        applyThemeModeChange(getNextThemeMode(overlayState.overlayThemeMode || 'system'));
        return;
      }

      const activeSuggestionIndex = searchResults.selectedIndex >= 0
        ? searchResults.selectedIndex
        : getAutoHighlightIndex();
      if (activeSuggestionIndex >= 0 && suggestionItems[activeSuggestionIndex]) {
        // Check if we're showing search suggestions or tab suggestions
        const activeItem = suggestionItems[activeSuggestionIndex];
        const isSearchSuggestion = Boolean(activeItem._xIsSearchSuggestion);
        let canKeepOverlayOpen = false;

        if (isSearchSuggestion && searchResults.rows[activeSuggestionIndex]) {
          const selectedSuggestion = searchResults.rows[activeSuggestionIndex];
          if (selectedSuggestion.type === 'modeSwitch') {
            applyThemeModeChange(selectedSuggestion.nextMode || '');
            input.focus();
            return;
          }
          if (selectedSuggestion.type === 'webAppearanceSwitch') {
            if (isWebAppearanceMode(selectedSuggestion.nextMode)) {
              applyWebAppearanceMode(selectedSuggestion.nextMode);
            }
            input.focus();
            return;
          }
          if (selectedSuggestion.type === 'commandNewTab') {
            LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'openNewTab' });
            removeOverlay(overlayState.overlay);
            return;
          }
          if (selectedSuggestion.type === 'commandSettings') {
            LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'openOptionsPage' });
            removeOverlay(overlayState.overlay);
            return;
          }
          if (selectedSuggestion.type === 'commandOpenTabs') {
            input.value = '';
            searchQuery.clear();
            activateOpenTabsSearchMode();
            input.focus();
            return;
          }
          if (selectedSuggestion.type === 'commandCopyUrl') {
            LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'copyCurrentPageUrl' });
            removeOverlay(overlayState.overlay);
            return;
          }
          if (selectedSuggestion.type === 'commandDocumentPip') {
            openDocumentPipPickerFromOverlay();
            removeOverlay(overlayState.overlay);
            return;
          }
          if (selectedSuggestion.type === 'siteSearchPrompt' && selectedSuggestion.provider) {
            modeActions.activateSiteSearch(selectedSuggestion.provider);
            input.focus();
            return;
          }
          if (selectedSuggestion.type === 'helpFeedback' && selectedSuggestion.feedbackKey === 'community') {
            openOverlayCommunityQrDialog(selectedSuggestion.url || '');
            return;
          }
          if (selectedSuggestion.provider && selectedSuggestion.searchQuery) {
            if (openSiteSearchProviderQuery(selectedSuggestion.provider, selectedSuggestion.searchQuery, e)) {
              finishOverlayResultActivation(e, true);
            }
            return;
          }
          if (shouldSwitchMatchedTabSuggestion(selectedSuggestion, activeSuggestionIndex)) {
            resultActivation.openMatchedTab(selectedSuggestion, e, activeItem, query);
            canKeepOverlayOpen = Boolean(selectedSuggestion.url);
          } else if (selectedSuggestion.forceSearch && selectedSuggestion.searchQuery) {
            if (resultActivation.opensInBackground(e) && selectedSuggestion.url) {
              resultActivation.openUrl(selectedSuggestion, query, e);
            } else {
              LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
                action: 'searchOrNavigate',
                query: selectedSuggestion.searchQuery,
                forceSearch: true,
                disposition: resultActivation.getDisposition(e)
              });
            }
            canKeepOverlayOpen = Boolean(selectedSuggestion.url);
          } else {
            resultActivation.openUrl(selectedSuggestion, query, e);
            canKeepOverlayOpen = true;
          }
        } else if (!isSearchSuggestion) {
          // Switch to existing tab
          if (activeItem && typeof activeItem._xTabId === 'number') {
            LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
              action: 'switchToTab',
              tabId: activeItem._xTabId
            });
          }
        }
        finishOverlayResultActivation(e, canKeepOverlayOpen);
      } else if (query) {
        if (!searchMode.local && isSlashCommandInput(query)) {
          updateSearchSuggestions([], query);
          return;
        }
        if (searchMode.local) {
          return;
        }
        const activeProvider = searchMode.site;
        if (activeProvider) {
          const activeAggregateSearch = isAggregateSearchProvider(activeProvider);
          if (openSiteSearchProviderQuery(activeProvider, query, e)) {
            finishOverlayResultActivation(e, true);
            return;
          }
          if (activeAggregateSearch) {
            return;
          }
        }
        const currentRawInput = (searchQuery.raw || input.value || '').trim();
        const inlineSearch = searchMode.inline;
        if (inlineSearch && inlineSearch.isAuto && inlineSearch.rawInput === currentRawInput) {
          if (inlineSearch.provider && inlineSearch.query) {
            if (!openSiteSearchProviderQuery(inlineSearch.provider, inlineSearch.query, e)) {
              return;
            }
          } else if (inlineSearch.url) {
            LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
              action: 'createTab',
              url: inlineSearch.url,
              disposition: resultActivation.getDisposition(e)
            });
          } else {
            return;
          }
          finishOverlayResultActivation(e, true);
          return;
        }
        if (searchAutocomplete.state && searchAutocomplete.state.url) {
          resultActivation.openUrl({
            url: searchAutocomplete.state.url,
            title: searchAutocomplete.state.title || '',
            type: 'autocomplete'
          }, query, e);
          finishOverlayResultActivation(e, true);
          return;
        }
        void resolveQuickNavigation(query).then((targetUrl) => {
          if (targetUrl) {
            LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
              action: 'createTab',
              url: targetUrl,
              disposition: resultActivation.getDisposition(e)
            });
          } else {
            // Handle search or URL navigation
            LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
              action: 'searchOrNavigate',
              query: query,
              disposition: resultActivation.getDisposition(e)
            });
          }
          finishOverlayResultActivation(e, true);
        });
      }
    }
  }

  function handleOverlayKeyup(e: KeyboardEvent): void {
    suggestionModifiers.syncFromEvent(e);
    SUGGESTION_NAVIGATION.handleNumberShortcutKeyEvent(
      e,
      suggestionItems,
      overlayState.suggestionsContainer,
      numberShortcutOptions
    );
  }

  function isSearchInputActive(): boolean {
    const input = overlayState.searchInput;
    if (!input) {
      return false;
    }
    const searchRoot = input.getRootNode();
    const activeInRoot = 'activeElement' in searchRoot ? searchRoot.activeElement : null;
    return document.activeElement === input || activeInRoot === input;
  }

  return {
    handleTabKey,
    handleSearchInputKeydown,
    shouldSwitchMatchedTabSuggestion,
    getSuggestionNavigationKey,
    handleOverlayKeydown,
    handleOverlayKeyup,
    isSearchInputActive
  };
}

export { createPanelKeys };
export type { PanelKeysDeps, PanelKeysState };
