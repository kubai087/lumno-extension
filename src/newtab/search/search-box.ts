// Builds the search box: the suggestions view, the search input with its
// key, input and focus handling, the global listeners that return focus to
// it, and the search scope icon.
import type { createSearchInputHistoryController } from '../../domain/search/search-input-history';
import type { createImeKeyGuard } from '../../domain/search/ime-key-guard';
import type { SuggestionInputPreview } from '../../domain/search/suggestion-input-preview';
import type { SiteSearchProvider, SuggestionLike } from '../../domain/search/types';
import * as LumnoMessaging from '../../platform/messaging';
import { isHtmlTag } from '../../shared/dom-guards';
import type { createSearchInput, SearchInputParts } from '../../shared/react/search-input';
import type {
  OpenTabSuggestion,
  Suggestion,
  SuggestionsViewController,
  SuggestionsViewOptions
} from '../../shared/react/search/suggestion-list/types';
import type { InputModeController } from '../../shared/search/search-input-mode';
import type { BindCursorTooltip, FormatMessage, Translate } from '../newtab-types';
import * as NEWTAB_BACKGROUND_SEARCH_FOCUS from './background-search-focus';
import type { SearchModes } from './search-modes';
import type { RenderSuggestions, RequestSuggestions } from './search-types';
import { createSuggestionsView } from '../../shared/react/search/suggestions';
import { macosCtrlSuggestionNavigationEnabled, tabRankScoreDebug } from '../../domain/settings/search';
import { simpleModeEnabled } from '../../domain/settings/appearance';
import type { SettingsStore } from '../../platform/settings-store';
import type { SurfaceLocale } from '../../shared/i18n/surface-locale';
import type { SearchQuery } from '../../shared/search-panel/search-query';
import type { SearchAutocomplete } from '../../shared/search-panel/autocomplete';
import type { SearchMode } from '../../shared/search-panel/search-mode';
import type { SearchResults } from '../../shared/search-panel/search-results';
import { getSiteSearchDisplayName } from '../../shared/search-panel/labels';
import type { SearchModeActions } from '../../shared/search-panel/mode-actions';
import type { SuggestionModifiers } from '../../shared/search-panel/suggestion-modifiers';
import type { SuggestionSource } from '../../shared/search-panel/suggestion-source';
import * as SUGGESTION_NAVIGATION from '../../shared/search/suggestion-navigation';
import * as SEARCH_INPUT_HISTORY from '../../domain/search/search-input-history';
import type { ResultActivation } from '../../shared/search-panel/result-activation';

// An option the suggestions view is handed as it is.
type ViewOption<K extends keyof SuggestionsViewOptions> = NonNullable<SuggestionsViewOptions[K]>;

interface SearchBoxState {
  suggestionsView: SuggestionsViewController | null;
  suggestionsContainer: HTMLElement | null;
  // The search suggestion the arrows show in the input.
  suggestionInputPreview: SuggestionInputPreview;
  inputParts: SearchInputParts | null;
  inputModeController: Pick<InputModeController, 'shouldRemoveModeTagOnBackspace' | 'resetModeMenuDoubleTab' | 'closeModeMenu'> | null;
  defaultPlaceholderText: string;
  // Hidden from the background; the input's focus shows them again.
  searchSuggestionsDismissed: boolean;
  handleTabKey: ((event: KeyboardEvent) => unknown) | null;
  searchLayer: HTMLElement | null;
  modeBadge: HTMLElement | null;
  searchScopeIcon: HTMLElement | null;
}

interface SearchBoxDeps {
  suggestionSource: SuggestionSource;
  suggestionModifiers: SuggestionModifiers;
  modeActions: SearchModeActions<SiteSearchProvider>;
  searchResults: SearchResults<Suggestion>;
  searchMode: SearchMode<SiteSearchProvider>;
  searchAutocomplete: SearchAutocomplete;
  searchQuery: SearchQuery;
  locale: Pick<SurfaceLocale, 'store' | 't' | 'formatMessage'>;
  settings: Pick<SettingsStore, 'get'>;
  suggestionItems: ViewOption<'items'>;
  t: Translate;
  formatMessage: FormatMessage;
  sanitizeDisplayText: ViewOption<'sanitizeDisplayText'>;
  shouldBlockFaviconForHost: ViewOption<'shouldBlockFaviconForHost'>;
  isLocalNetworkHost: ViewOption<'isLocalNetworkHost'>;
  getHostFromUrl: ViewOption<'getHostFromUrl'>;
  getUrlDisplay: ViewOption<'getUrlDisplay'>;
  getThemeHostForSuggestion: ViewOption<'getThemeHostForSuggestion'>;
  getImmediateThemeForSuggestion: ViewOption<'getImmediateThemeForSuggestion'>;
  getThemeForSuggestion: ViewOption<'getThemeForSuggestion'>;
  shouldUseUrlFallbackThemeForSuggestion: ViewOption<'shouldUseUrlFallbackThemeForSuggestion'>;
  getThemeForMode: ViewOption<'getThemeForMode'>;
  getHoverColors: ViewOption<'getHoverColors'>;
  getNeutralHoverActionColors: ViewOption<'getNeutralHoverActionColors'>;
  applyThemeVariables: ViewOption<'applyThemeVariables'>;
  applyMarkVariables: ViewOption<'applyMarkVariables'>;
  applyFaviconOpticalAlignment: ViewOption<'applyFaviconOpticalAlignment'>;
  applyFaviconOpticalShift: ViewOption<'applyFaviconOpticalShift'>;
  applyFallbackIcon: ViewOption<'applyFallbackIcon'>;
  setFaviconSrcWithAnimation: ViewOption<'setFaviconSrcWithAnimation'>;
  attachFaviconWithFallbacks: ViewOption<'attachFaviconWithFallbacks'>;
  preloadIcon: ViewOption<'preloadIcon'>;
  getChromeFaviconUrl: ViewOption<'getChromeFaviconUrl'>;
  getBrowserPageFaviconUrl: ViewOption<'getBrowserPageFaviconUrl'>;
  getPageFaviconRenderCandidates: ViewOption<'getPageFaviconRenderCandidates'>;
  setSuggestionsVisible: ViewOption<'setSuggestionsVisible'>;
  resultActivation: ResultActivation;
  activateRenderedSuggestion: ViewOption<'onActivateSuggestion'>;
  deleteRenderedHistorySuggestion: ViewOption<'onDeleteHistory'>;
  copySearchResultUrl: ViewOption<'onCopyUrl'>;
  showTopActionTooltip: ViewOption<'showTopActionTooltip'>;
  hideTopActionTooltip: ViewOption<'hideTopActionTooltip'>;
  bindCursorTooltip: ViewOption<'bindCursorTooltip'>;
  getSearchActionLabel: ViewOption<'getSearchActionLabel'>;
  getDefaultSearchEngineThemeUrl: ViewOption<'getDefaultSearchEngineThemeUrl'>;
  getBrandAccentForUrl: ViewOption<'getBrandAccentForUrl'>;
  buildThemeFromAccent: ViewOption<'buildThemeFromAccent'>;
  newtabSuggestionActionModel: ViewOption<'actionModel'>;
  shouldSwitchMatchedTabSuggestion: ViewOption<'shouldSwitchMatchedTabSuggestion'>;
  defaultTheme: ViewOption<'defaultTheme'>;
  urlHighlightTheme: ViewOption<'urlHighlightTheme'>;
  createSearchInput: typeof createSearchInput;
  searchInputHistoryController: Pick<ReturnType<typeof createSearchInputHistoryController>, 'resetNavigation' | 'move' | 'record'>;
  updateModeBadge(rawValue: string): void;
  imeKeyGuard: Pick<ReturnType<typeof createImeKeyGuard>, 'isComposing'>;
  clearSearchSuggestions(): void;
  isSlashCommandInput(query: string): boolean;
  renderSuggestions: RenderSuggestions;
  // The address the query is, as a suggestion; null when it is not one.
  getDirectUrlSuggestion(query: string): SuggestionLike | null;
  renderPendingSuggestions(query: string): unknown;
  requestSuggestions: RequestSuggestions;
  isImeCompositionEvent(event: KeyboardEvent): boolean;
  // The row a step from `selectedIndex` lands on, and whether it wrapped.
  getNextSuggestionIndex(direction: number, selectedIndex: number, itemCount: number, autoIndex: number): { index: number; didWrap: boolean };
  getAutoHighlightIndex(): number;
  updateSelection(): void;
  scrollSelectedSuggestionIntoView(direction: 'up' | 'down', didWrap: boolean): void;
  submitSearchQuery(query: string, event: KeyboardEvent): unknown;
  root: HTMLElement | null;
  dismissSearchSuggestionsFromBackground(): void;
  focusSearchInputPreservingScroll(): boolean;
  finishNewtabEntryAnimation(): void;
  handleGlobalTypingFocus(event: KeyboardEvent): void;
  refreshFallbackShortcut(force: boolean): void;
  restoreDismissedSearchSuggestions(): void;
  hideSearchInputCursorTooltip(): void;
  openSearchModeMenuFromDoubleTab: SearchModes['openSearchModeMenuFromDoubleTab'];
  bindSearchInputCursorTooltip: BindCursorTooltip;
  pageState: SearchBoxState;
}

// The text in the input an event came from.
function readInputValue(event: Event): string {
  return isHtmlTag(event.target, 'input') ? event.target.value : '';
}

function createSearchBox(deps: SearchBoxDeps) {
  const {
    suggestionSource,
    suggestionModifiers,
    modeActions,
    searchResults,
    searchMode,
    searchAutocomplete,
    searchQuery,
    locale,
    settings,
    suggestionItems,
    t,
    formatMessage,
    sanitizeDisplayText,
    shouldBlockFaviconForHost,
    isLocalNetworkHost,
    getHostFromUrl,
    getUrlDisplay,
    getThemeHostForSuggestion,
    getImmediateThemeForSuggestion,
    getThemeForSuggestion,
    shouldUseUrlFallbackThemeForSuggestion,
    getThemeForMode,
    getHoverColors,
    getNeutralHoverActionColors,
    applyThemeVariables,
    applyMarkVariables,
    applyFaviconOpticalAlignment,
    applyFaviconOpticalShift,
    applyFallbackIcon,
    setFaviconSrcWithAnimation,
    attachFaviconWithFallbacks,
    preloadIcon,
    getChromeFaviconUrl,
    getBrowserPageFaviconUrl,
    getPageFaviconRenderCandidates,
    setSuggestionsVisible,
    resultActivation,
    activateRenderedSuggestion,
    deleteRenderedHistorySuggestion,
    copySearchResultUrl,
    showTopActionTooltip,
    hideTopActionTooltip,
    bindCursorTooltip,
    getSearchActionLabel,
    getDefaultSearchEngineThemeUrl,
    getBrandAccentForUrl,
    buildThemeFromAccent,
    newtabSuggestionActionModel,
    shouldSwitchMatchedTabSuggestion,
    defaultTheme,
    urlHighlightTheme,
    createSearchInput,
    searchInputHistoryController,
    updateModeBadge,
    imeKeyGuard,
    clearSearchSuggestions,
    isSlashCommandInput,
    renderSuggestions,
    getDirectUrlSuggestion,
    renderPendingSuggestions,
    requestSuggestions,
    isImeCompositionEvent,
    getNextSuggestionIndex,
    getAutoHighlightIndex,
    updateSelection,
    scrollSelectedSuggestionIntoView,
    submitSearchQuery,
    root,
    dismissSearchSuggestionsFromBackground,
    focusSearchInputPreservingScroll,
    finishNewtabEntryAnimation,
    handleGlobalTypingFocus,
    refreshFallbackShortcut,
    restoreDismissedSearchSuggestions,
    hideSearchInputCursorTooltip,
    openSearchModeMenuFromDoubleTab,
    bindSearchInputCursorTooltip
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  // The page structure creates the results container before the search box.
  const suggestionsContainer = pageState.suggestionsContainer;
  if (!suggestionsContainer) {
    throw new Error('Search results container unavailable');
  }

  const NEWTAB_OPEN_TAB_SUGGESTION_LIMIT = 8;

  function formatTabRankDebugText(tab: OpenTabSuggestion): string {
    const scoreRaw = Number(tab && tab._xTabRankScore);
    const score = Number.isFinite(scoreRaw) ? scoreRaw.toFixed(2) : '0.00';
    const count30mRaw = Number(tab && tab._xTabSwitchCount30m);
    const count24hRaw = Number(tab && tab._xTabSwitchCount24h);
    const debugTotalRaw = Number(tab && tab._xTabDebugEventTotal);
    const lastAccessedRaw = Number(tab && tab._xTabLastAccessedRaw);
    const sortAtRaw = Number(tab && tab._xTabSortAt);
    const fetchSeqRaw = Number(tab && tab._xTabFetchSeq);
    const count30m = Number.isFinite(count30mRaw) ? Math.max(0, Math.round(count30mRaw)) : 0;
    const count24h = Number.isFinite(count24hRaw) ? Math.max(0, Math.round(count24hRaw)) : 0;
    const debugTotal = Number.isFinite(debugTotalRaw) ? Math.max(0, Math.round(debugTotalRaw)) : 0;
    const lastAccessedSec = Number.isFinite(lastAccessedRaw) && lastAccessedRaw > 0 ? Math.round(lastAccessedRaw / 1000) : 0;
    const sortAtSec = Number.isFinite(sortAtRaw) && sortAtRaw > 0 ? Math.round(sortAtRaw / 1000) : 0;
    const fetchSeq = Number.isFinite(fetchSeqRaw) ? Math.max(0, Math.round(fetchSeqRaw)) : 0;
    return `score ${score} · 30m ${count30m} · 24h ${count24h} · ev ${debugTotal} · la ${lastAccessedSec} · s ${sortAtSec} · fs ${fetchSeq} · build 20260308-1`;
  }
  let isApplyingSearchInputHistory = false;
  pageState.suggestionsView = createSuggestionsView({
    document,
    container: suggestionsContainer,
    items: suggestionItems,
    t,
    formatMessage,
    sanitizeDisplayText,
    formatTabRankDebugText,
    isTabRankScoreDebugEnabled: () => settings.get(tabRankScoreDebug),
    shouldBlockFaviconForHost,
    isLocalNetworkHost,
    getHostFromUrl,
    getUrlDisplay,
    isSimpleModeEnabled: () => settings.get(simpleModeEnabled),
    getThemeHostForSuggestion,
    getImmediateThemeForSuggestion,
    getThemeForSuggestion,
    shouldUseUrlFallbackThemeForSuggestion,
    getThemeForMode,
    getHoverColors,
    getNeutralHoverActionColors,
    applyThemeVariables,
    applyMarkVariables,
    applyFaviconOpticalAlignment,
    applyFaviconOpticalShift,
    applyFallbackIcon,
    setFaviconSrcWithAnimation,
    attachFaviconWithFallbacks,
    preloadIcon,
    getChromeFaviconUrl,
    getBrowserPageFaviconUrl,
    getPageFaviconRenderCandidates,
    setSuggestionsVisible,
    onSetSelectedIndex: (nextIndex) => {
      searchResults.select(nextIndex);
      if (nextIndex < 0) {
        pageState.suggestionInputPreview.restore(
          pageState.inputParts ? pageState.inputParts.input : null,
          searchQuery.raw
        );
      }
    },
    getSelectedIndex: () => searchResults.selectedIndex,
    onSwitchToTab: (tab, event) => {
      if (resultActivation.opensInBackground(event) && tab.url) {
        LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
          action: 'createTab',
          url: tab.url,
          disposition: 'backgroundTab'
        });
        return;
      }
      if (typeof tab.id === 'number') {
        LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
          action: 'switchToTab',
          tabId: tab.id
        });
      }
    },
    onActivateSuggestion: activateRenderedSuggestion,
    onDeleteHistory: deleteRenderedHistorySuggestion,
    onCopyUrl: copySearchResultUrl,
    showTopActionTooltip,
    hideTopActionTooltip,
    bindCursorTooltip,
    getSearchActionLabel,
    getSiteSearchDisplayName: (provider) => getSiteSearchDisplayName(locale, provider),
    getDefaultSearchEngineThemeUrl,
    getBrandAccentForUrl,
    buildThemeFromAccent,
    actionModel: newtabSuggestionActionModel,
    shouldSwitchMatchedTabSuggestion,
    defaultTheme,
    urlHighlightTheme,
    openTabSuggestionLimit: NEWTAB_OPEN_TAB_SUGGESTION_LIMIT
  });

  function shouldRemoveSearchModeTagOnBackspace(event: KeyboardEvent): boolean {
    if (!pageState.inputModeController) {
      return true;
    }
    const shouldRemove = pageState.inputModeController.shouldRemoveModeTagOnBackspace(event);
    if (!shouldRemove) {
      event.preventDefault();
    }
    return shouldRemove;
  }

  const inputParts = createSearchInput({
    containerId: '_x_extension_newtab_input_container_2024_unique_',
    inputId: '_x_extension_newtab_search_input_2024_unique_',
    iconId: '_x_extension_newtab_search_icon_2024_unique_',
    placeholder: t('search_placeholder', pageState.defaultPlaceholderText),
    modeBadge: {
      id: '_x_extension_newtab_mode_badge_2024_unique_',
      className: 'x-lumno-search-input-mode__badge',
      surface: 'newtab',
      visible: false
    },
    containerStyleOverrides: {
      'border-radius': '24px',
      'background': 'transparent',
      'border': 'none',
      'box-shadow': 'none',
      'min-width': '100%',
      'min-height': '44px',
      'height': '44px',
      'position': 'relative',
      'z-index': '2',
      'overflow': 'visible'
    },
    inputStyleOverrides: {
      'border-bottom': 'none',
      'color': 'var(--x-nt-text, #111827)',
      'caret-color': 'var(--x-nt-link, #2563EB)',
      'padding': '8px 100px 8px 44px',
      'min-height': '44px',
      'height': '44px',
      'line-height': '24px'
    },
    iconStyleOverrides: {
      'color': 'var(--x-nt-subtext, #6B7280)',
      'left': '7px'
    },
    rightIconStyleOverrides: {
      '--x-ext-input-right-icon-inset': '7px',
      '--x-ext-input-icon-hover-bg': 'var(--x-nt-settings-action-hover-bg, rgba(148, 163, 184, 0.16))',
      '--x-ext-input-icon-hover': 'var(--x-nt-settings-action-hover-color, #4B5563)',
      cursor: 'pointer'
    },
    clearAction: {
      id: '_x_extension_newtab_search_clear_2026_unique_',
      ariaLabel: t('search_input_clear', '清空'),
      icon: { name: 'ri-close-line', size: 16 },
      styleOverrides: {
        '--x-ext-input-clear-right': '79px',
        '--x-ext-input-clear-top': '7px',
        '--x-ext-input-icon-hover-bg': 'var(--x-nt-settings-action-hover-bg, rgba(148, 163, 184, 0.16))',
        '--x-ext-input-icon-hover': 'var(--x-nt-settings-action-hover-color, #4B5563)'
      }
    },
    secondaryAction: {
      id: '_x_extension_newtab_close_other_tabs_2026_unique_',
      className: 'x-nt-close-other-tabs',
      ariaLabel: t('overlay_close_other_tabs_tooltip', '关闭其他标签页'),
      icon: { name: 'ri-brush-2-line', size: 16 },
      confirm: {
        getCopy: getCloseOtherTabsConfirmCopy,
        onConfirm: closeOtherTabs
      }
    },
    onInput: function(event) {
      // Typing on from a suggestion the arrows show keeps it as typed text.
      pageState.suggestionInputPreview.commit();
      pageState.searchSuggestionsDismissed = false;
      if (!isApplyingSearchInputHistory) {
        searchInputHistoryController.resetNavigation();
      }
      const rawValue = readInputValue(event);
      const query = rawValue.trim();
      updateModeBadge(rawValue);
      const inputType = 'inputType' in event && typeof event.inputType === 'string' ? event.inputType : '';
      const isPaste = inputType === 'insertFromPaste';
      const isDelete = inputType.startsWith('delete');
      if (isDelete) {
        searchQuery.markDeletion();
      }
      if (imeKeyGuard.isComposing()) {
        searchQuery.set(rawValue, query);
        return;
      }
      if (!query) {
        searchQuery.clear();
        searchAutocomplete.clear();
        suggestionSource.cancel();
        clearSearchSuggestions();
        return;
      }
      searchQuery.setRaw(rawValue);
      searchAutocomplete.clear();
      if (!searchMode.local && isSlashCommandInput(query)) {
        searchQuery.setText(query);
        renderSuggestions([], query);
        return;
      }
      const directUrlSuggestion = getDirectUrlSuggestion(query);
      const hasCachedOpenTabMatch = Boolean(
        directUrlSuggestion &&
        typeof directUrlSuggestion._xMatchedTabId === 'number'
      );
      if (isPaste || directUrlSuggestion) {
        searchQuery.setText(query);
        if (!directUrlSuggestion || hasCachedOpenTabMatch) {
          renderPendingSuggestions(query);
        }
        requestSuggestions(query, {
          immediate: true,
          deferInitialDirectNavigationRender: Boolean(
            directUrlSuggestion && !hasCachedOpenTabMatch
          )
        });
        return;
      }
      requestSuggestions(query);
    },
    onKeyDown: function(event) {
      suggestionModifiers.syncFromEvent(event);
      searchAutocomplete.dismissOnKey(event);
      const suggestionNavigationKey =
        SUGGESTION_NAVIGATION.getSuggestionNavigationKey(event, {
          macosCtrlEnabled: settings.get(macosCtrlSuggestionNavigationEnabled),
          navigatorLike: typeof navigator === 'object' && navigator ? navigator : null
        });
      const input = inputParts.input;
      if (event.key !== 'Backspace' && !event.metaKey && !event.ctrlKey && !event.altKey &&
          !pageState.suggestionInputPreview.isActive()) {
        searchQuery.set(input.value);
      }
      // An open scope menu closes first and leaves the scope as it is.
      if (event.key === 'Escape' && pageState.inputModeController &&
          pageState.inputModeController.closeModeMenu(false)) {
        event.preventDefault();
        return;
      }
      // Then the text typed before the arrows showed a suggestion comes back.
      if (event.key === 'Escape' && pageState.suggestionInputPreview.restore(input, searchQuery.raw)) {
        event.preventDefault();
        searchResults.select(-1);
        updateSelection();
        return;
      }
      // Leaving a site search lists the query's ordinary results.
      if (event.key === 'Escape' && searchMode.site) {
        event.preventDefault();
        modeActions.clearSiteSearch();
        const fallbackQuery = input.value.trim();
        if (fallbackQuery) {
          requestSuggestions(fallbackQuery, { immediate: true });
        } else {
          clearSearchSuggestions();
        }
        return;
      }
      if (event.key === 'Escape' && searchMode.local) {
        event.preventDefault();
        modeActions.clearLocalSearchScope();
        const fallbackQuery = input.value.trim();
        if (fallbackQuery) {
          requestSuggestions(fallbackQuery, { immediate: true });
        } else {
          clearSearchSuggestions();
        }
        return;
      }
      if (event.key === 'Backspace' && searchMode.site && !input.value) {
        if (!shouldRemoveSearchModeTagOnBackspace(event)) {
          return;
        }
        modeActions.clearSiteSearch();
        return;
      }
      if (event.key === 'Backspace' && searchMode.local && !input.value) {
        if (!shouldRemoveSearchModeTagOnBackspace(event)) {
          return;
        }
        modeActions.clearLocalSearchScope();
        clearSearchSuggestions();
        return;
      }
      if (isImeCompositionEvent(event)) {
        return;
      }
      const inputHistoryDirection =
        SEARCH_INPUT_HISTORY.getShortcutDirection(event);
      if (inputHistoryDirection) {
        event.preventDefault();
        event.stopPropagation();
        const result = searchInputHistoryController.move(
          inputHistoryDirection,
          input.value
        );
        if (result.handled) {
          isApplyingSearchInputHistory = true;
          try {
            input.value = result.value;
            input.setSelectionRange(result.value.length, result.value.length);
            input.dispatchEvent(new Event('input', { bubbles: true }));
          } finally {
            isApplyingSearchInputHistory = false;
          }
        }
        return;
      }
      if (suggestionNavigationKey) {
        if (suggestionItems.length === 0) {
          return;
        }
        event.preventDefault();
        const next = getNextSuggestionIndex(
          suggestionNavigationKey === 'ArrowDown' ? 1 : -1,
          searchResults.selectedIndex,
          suggestionItems.length,
          searchResults.selectedIndex === -1 ? getAutoHighlightIndex() : -1
        );
        searchResults.select(next.index);
        const didWrap = next.didWrap;
        updateSelection();
        // A search suggestion shows in the input; other rows keep what was typed.
        const selectedItem = suggestionItems[next.index];
        pageState.suggestionInputPreview.show(
          input,
          selectedItem && selectedItem._xIsSearchSuggestion ? searchResults.rows[next.index] : null,
          searchQuery.raw
        );
        scrollSelectedSuggestionIntoView(
          suggestionNavigationKey === 'ArrowDown' ? 'down' : 'up',
          didWrap
        );
        return;
      }
      if (event.key === 'Tab' && pageState.handleTabKey) {
        pageState.handleTabKey(event);
        return;
      }
      if (event.key !== 'Enter') {
        return;
      }
      // A suggestion the arrows show opens as its row; the query stays what
      // was typed.
      const query = (pageState.suggestionInputPreview.isActive()
        ? searchQuery.raw
        : readInputValue(event)).trim();
      if (!query) {
        return;
      }
      searchInputHistoryController.record(query);
      submitSearchQuery(query, event);
    }
  });
  pageState.inputParts = inputParts;

  const handleBackgroundPointerFocus = NEWTAB_BACKGROUND_SEARCH_FOCUS.createBackgroundFocusHandler({
    getBackgroundTargets: () => [document.body, root, pageState.searchLayer],
    getSearchValue: () => inputParts.input.value,
    dismissSearchResults: dismissSearchSuggestionsFromBackground,
    focusSearch: focusSearchInputPreservingScroll
  });

  window.addEventListener('keydown', finishNewtabEntryAnimation, true);
  window.addEventListener('pointerdown', finishNewtabEntryAnimation, true);
  window.addEventListener('keydown', handleGlobalTypingFocus, true);
  window.addEventListener('focus', () => refreshFallbackShortcut(true), true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refreshFallbackShortcut(false);
    }
  }, true);
  window.addEventListener('pointerdown', handleBackgroundPointerFocus, true);
  window.addEventListener('mousedown', handleBackgroundPointerFocus, true);
  pageState.modeBadge = inputParts.modeBadge;
  const searchInput = inputParts.input;
  searchInput.addEventListener('focus', restoreDismissedSearchSuggestions);
  const searchScopeIcon: HTMLElement = inputParts.icon;
  pageState.searchScopeIcon = searchScopeIcon;
  const rightIcon = inputParts.rightIcon;
  const searchScopeTooltipText = (): string => t(
    'shortcut_reference_search_open_scope_menu_title',
    '打开搜索范围面板'
  );
  function activateSearchScopeIcon(): void {
    if (pageState.inputModeController) {
      pageState.inputModeController.resetModeMenuDoubleTab();
    }
    void openSearchModeMenuFromDoubleTab();
  }
  // The search icon opens the scope panel, except while a scope is set.
  let searchScopeIconEnabled = true;
  function setSearchScopeIconEnabled(enabled: boolean): void {
    searchScopeIconEnabled = enabled !== false;
    if (!searchScopeIconEnabled) {
      hideSearchInputCursorTooltip();
    }
    inputParts.setChrome({
      scopeAction: {
        enabled: searchScopeIconEnabled,
        label: searchScopeTooltipText(),
        onActivate: activateSearchScopeIcon
      }
    });
  }
  locale.store.subscribe(() => {
    setSearchScopeIconEnabled(searchScopeIconEnabled);
  });
  inputParts.setChrome({
    tooltip: { bind: bindSearchInputCursorTooltip, hide: hideSearchInputCursorTooltip }
  });
  setSearchScopeIconEnabled(true);

  function getCloseOtherTabsConfirmCopy() {
    return {
      message: t('overlay_close_other_tabs_confirm', '关闭此窗口中的其他标签页？置顶和分组内的标签页会保留。'),
      messageKey: 'overlay_close_other_tabs_confirm',
      confirmLabel: t('overlay_close_other_tabs_confirm_button', '关闭'),
      confirmLabelKey: 'overlay_close_other_tabs_confirm_button'
    };
  }

  function closeOtherTabs(event: Event): void {
    if (event.isTrusted !== true) {
      return;
    }
    // The confirm button is going away with its bubble; keep typing in the field.
    searchInput.focus({ preventScroll: true });
    LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'closeOtherTabsForOverlay' }, (response) => {
      if (chrome.runtime.lastError || !response || response.ok !== true) {
        return;
      }
      // Closed tabs may still be listed among the open-tab suggestions.
      const query = searchInput.value.trim();
      if (query) {
        requestSuggestions(query, { immediate: true });
      }
    });
  }

  return {
    inputParts,
    searchInput,
    rightIcon,
    setSearchScopeIconEnabled
  };
}

type SearchBox = ReturnType<typeof createSearchBox>;

export { createSearchBox };
export type { SearchBox, SearchBoxDeps, SearchBoxState };
