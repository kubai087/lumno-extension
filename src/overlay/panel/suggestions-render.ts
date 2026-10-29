// Rendering suggestions: the React suggestions view, selection and
// scrolling, activating or deleting a row, favicons in rows, the empty
// state and the open tabs list.
import type { OverlayTab, WebAppearanceMode } from '../../domain/messages';
import type { SuggestionInputPreview } from '../../domain/search/suggestion-input-preview';
import * as LumnoMessaging from '../../platform/messaging';
import type {
  FaviconCandidates,
  OpenTabSuggestion,
  Suggestion,
  SuggestionElement,
  SuggestionsRenderPayload,
  SuggestionsViewController,
  SuggestionsViewOptions,
  ThemeValue
} from '../../shared/react/search/suggestion-list/types';
import type { InputModeProvider } from '../../shared/search/input-mode/types';
import type { ActivationEvent } from './result-activation';
import type { OverlaySuggestion } from './types';
import { createSuggestionsView } from '../../shared/react/search/suggestions';
import * as SearchDirectNavigation from '../../domain/search/utils/direct-navigation';
import { simpleModeEnabled } from '../../domain/settings/appearance';
import { searchResultDisplayLimit, tabRankScoreDebug } from '../../domain/settings/search';
import type { OverlaySettings } from '../overlay-settings';
import type { OverlayFaviconRuntime } from '../favicon-view';
import * as SearchSiteSearchProviders from '../../domain/search/utils/site-search-providers';
import type { DefaultSearchEngine } from '../../shared/search-panel/default-engine';
import type { SearchQuery } from '../../shared/search-panel/search-query';
import type { SearchMode } from '../../shared/search-panel/search-mode';
import type { SearchResults } from '../../shared/search-panel/search-results';
import { isAggregateSearchProvider } from '../../domain/search/aggregate-search-store';
import { getSiteSearchDisplayName } from '../../shared/search-panel/labels';
import type { SearchLocale } from '../../shared/search-panel/labels';
import type { SearchModeActions } from '../../shared/search-panel/mode-actions';
import * as SUGGESTION_NAVIGATION from '../../shared/search/suggestion-navigation';
import * as SUGGESTIONS_HEIGHT_LAYOUT from '../../shared/search/suggestions-height-layout';
import type { ResultActivation } from '../../shared/search-panel/result-activation';
import type { SuggestionModifiers } from '../../shared/search-panel/suggestion-modifiers';
import type { ColorScheme } from '../../shared/ui/color-scheme';
import type { OverlayPanelElements } from './panel-elements';
import type { OverlayTabs } from './overlay-tabs';
import type { createSessionCleanupRegistry } from '../lifecycle';
import type { LastRender } from './last-render';

// What the view takes for an option this module passes straight through.
type ViewOption<K extends keyof SuggestionsViewOptions> = NonNullable<SuggestionsViewOptions[K]>;

interface SuggestionsRenderDeps {
  suggestionModifiers: SuggestionModifiers;
  colorScheme: ColorScheme;
  modeActions: SearchModeActions<InputModeProvider>;
  locale: SearchLocale;
  searchResults: SearchResults<OverlaySuggestion>;
  searchMode: SearchMode<InputModeProvider>;
  searchQuery: SearchQuery;
  favicons: Pick<OverlayFaviconRuntime, 'attachResolvedFaviconWithFallbacks' | 'applyFaviconOpticalAlignment' | 'preloadIcon'>;
  updateSearchSuggestions(rows: never[], query: string): void;
  requestOverlaySearchSuggestions(query: string): void;
  // The rendered rows, filled by the view.
  suggestionItems: SuggestionElement[];
  syncSearchModeMenuResultOffset(): void;
  removeOverlay(overlay: HTMLElement | null): void;
  activateOpenTabsSearchMode(): void;
  openDocumentPipPickerFromOverlay(): void;
  openOverlayCommunityQrDialog(qrUrl: string): void;
  applyThemeModeChange(mode: string): void;
  applyWebAppearanceMode(mode: WebAppearanceMode): void;
  shouldSwitchMatchedTabSuggestion: ViewOption<'shouldSwitchMatchedTabSuggestion'>;
  resultActivation: ResultActivation;
  finishOverlayResultActivation(event: ActivationEvent | null, canOpenInBackground: boolean): boolean;
  openSiteSearchProviderQuery(provider: InputModeProvider | null, query: string, event: ActivationEvent | null): boolean;
  getOverlayFaviconUrlResolver(): {
    getPageFaviconRenderCandidates(url: string, explicitUrl: string, options?: { includeChromeFallback?: boolean; allowRemoteImage?: boolean }): FaviconCandidates;
  } | null;
  t: ViewOption<'t'>;
  formatMessage: ViewOption<'formatMessage'>;
  shouldBlockOverlayFaviconForHost: ViewOption<'shouldBlockFaviconForHost'>;
  isLocalNetworkHost: ViewOption<'isLocalNetworkHost'>;
  getChromeFaviconUrl: ViewOption<'getChromeFaviconUrl'>;
  getPageFaviconCandidateUrl: ViewOption<'getBrowserPageFaviconUrl'>;
  getHostFromUrl(url: string): string;
  getUrlDisplay: ViewOption<'getUrlDisplay'>;
  getImmediateThemeForSuggestion: ViewOption<'getImmediateThemeForSuggestion'>;
  getThemeForSuggestion: ViewOption<'getThemeForSuggestion'>;
  getThemeForMode: ViewOption<'getThemeForMode'>;
  getHoverColors: ViewOption<'getHoverColors'>;
  getHighlightColors: ViewOption<'getHighlightColors'>;
  getNeutralHoverActionColors: ViewOption<'getNeutralHoverActionColors'>;
  applyThemeVariables: ViewOption<'applyThemeVariables'>;
  applyMarkVariables: ViewOption<'applyMarkVariables'>;
  copySearchResultUrl: ViewOption<'onCopyUrl'>;
  searchEngine: DefaultSearchEngine;
  getBrandAccentForUrl: ViewOption<'getBrandAccentForUrl'>;
  buildTheme(accent: unknown): ThemeValue;
  normalizeSearchResultDisplayLimit(value: unknown): number;
  pauseOverlayAntiTranslateObserverForMutationBurst(): void;
  setOpenTabsResultsViewport(active: boolean, itemCount?: number): void;
  setOverlayResultsCollapsed(collapsed: boolean, options?: { deferLayoutSync?: boolean } | null): void;
  filterTabsForOverlay(tabs: OverlayTab[], query: string): OverlayTab[];
  shouldShowOpenTabsForEmptyQuery(): boolean;
  clearDefaultOpenTabsSuggestions(): void;
  settings: Pick<OverlaySettings, 'get'>;
  // Dropping the selection puts back what the arrows wrote over.
  suggestionInputPreview: Pick<SuggestionInputPreview, 'restore'>;
  defaultTheme: ThemeValue;
  urlHighlightTheme: ThemeValue;
  elements: Pick<OverlayPanelElements, 'inputModeController' | 'inputParts' | 'overlay' | 'overlayPortals' | 'overlayStyleRoot' | 'searchInput' | 'suggestionsContainer' | 'topActionTooltip' | 'cursorTooltip'>;
  overlayTabs: Pick<OverlayTabs, 'currentTabId' | 'ready' | 'received' | 'tabs'>;
  isLoadingSessionTracked(): boolean;
  overlaySessionCleanups: Pick<ReturnType<typeof createSessionCleanupRegistry>, 'add'>;
  lastRender: LastRender;
}

// A row's provider is a full site search provider once it has its key, the
// one field a provider must have; every provider the overlay puts on its
// rows does.
function isFullRowProvider(provider: Suggestion['provider']): provider is InputModeProvider {
  return typeof provider === 'object' && provider !== null && typeof provider.key === 'string';
}

function isWebAppearanceMode(value: unknown): value is WebAppearanceMode {
  return value === 'auto' || value === 'light' || value === 'dark';
}

function createSuggestionsRender(deps: SuggestionsRenderDeps) {
  const {
    lastRender,
    isLoadingSessionTracked,
    overlaySessionCleanups,
    overlayTabs,
    elements,
    urlHighlightTheme,
    defaultTheme,
    suggestionInputPreview,
    settings,
    suggestionModifiers,
    colorScheme,
    modeActions,
    locale,
    searchResults,
    searchMode,
    searchQuery,
    favicons,
    updateSearchSuggestions,
    requestOverlaySearchSuggestions,
    suggestionItems,
    syncSearchModeMenuResultOffset,
    removeOverlay,
    activateOpenTabsSearchMode,
    openDocumentPipPickerFromOverlay,
    openOverlayCommunityQrDialog,
    applyThemeModeChange,
    applyWebAppearanceMode,
    shouldSwitchMatchedTabSuggestion,
    resultActivation,
    finishOverlayResultActivation,
    openSiteSearchProviderQuery,
    getOverlayFaviconUrlResolver,
    t,
    formatMessage,
    shouldBlockOverlayFaviconForHost,
    isLocalNetworkHost,
    getChromeFaviconUrl,
    getPageFaviconCandidateUrl,
    getHostFromUrl,
    getUrlDisplay,
    getImmediateThemeForSuggestion,
    getThemeForSuggestion,
    getThemeForMode,
    getHoverColors,
    getHighlightColors,
    getNeutralHoverActionColors,
    applyThemeVariables,
    applyMarkVariables,
    copySearchResultUrl,
    searchEngine,
    getBrandAccentForUrl,
    buildTheme,
    normalizeSearchResultDisplayLimit,
    pauseOverlayAntiTranslateObserverForMutationBurst,
    setOpenTabsResultsViewport,
    setOverlayResultsCollapsed,
    filterTabsForOverlay,
    shouldShowOpenTabsForEmptyQuery,
    clearDefaultOpenTabsSuggestions
  } = deps;

  // A tab's switch ranking, shown under it while score debugging is on.
  function formatTabRankDebugText(tab: OpenTabSuggestion & { _xTabFetchSeq?: number }): string {
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
  let overlayTabsRequestInFlight = false;
  let overlayTabsRequestSeq = 0;
  const showTopActionTooltip = (button: HTMLElement, text: string): void => {
    if (!button || !text || !elements.topActionTooltip) {
      return;
    }
    elements.topActionTooltip.show(button, text, {
      boundaryElement: elements.overlay,
      positionMode: 'absolute',
      maxWidth: 420
    });
  };
  const hideTopActionTooltip = (): void => {
    if (elements.topActionTooltip) {
      elements.topActionTooltip.hide();
    }
  };

  function readInputQuery(): string {
    return elements.searchInput ? String(elements.searchInput.value || '').trim() : '';
  }

  function getOverlaySuggestionRefreshQuery(): string {
    return searchQuery.text || (elements.searchInput ? String(elements.searchInput.value || '').trim() : '');
  }

  function refreshOverlaySuggestionsAfterHistoryDelete(): void {
    const queryToRefresh = getOverlaySuggestionRefreshQuery();
    if (!queryToRefresh) {
      updateSearchSuggestions([], '');
      return;
    }
    requestOverlaySearchSuggestions(queryToRefresh);
  }

  function deleteHistorySuggestionUrl(suggestion: { url?: string } | null): void {
    const targetUrl = suggestion && suggestion.url ? String(suggestion.url) : '';
    if (!targetUrl) {
      return;
    }
    LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
      action: 'deleteHistoryUrl',
      url: targetUrl
    }, function(response) {
      if (chrome.runtime && chrome.runtime.lastError) {
        return;
      }
      if (!response || response.ok !== true) {
        return;
      }
      refreshOverlaySuggestionsAfterHistoryDelete();
    });
  }

  function syncSuggestionLastState(): void {
    suggestionItems.forEach((item, index) => {
      if (item) {
        item.setAttribute('data-last', index === suggestionItems.length - 1 ? 'true' : 'false');
      }
    });
  }

  function scrollSelectedSuggestionIntoView(direction: 'up' | 'down', didWrap: boolean): void {
    if (!elements.suggestionsContainer || searchResults.selectedIndex < 0) {
      return;
    }
    const item = suggestionItems[searchResults.selectedIndex];
    SUGGESTION_NAVIGATION.scrollItemIntoView(elements.suggestionsContainer, item, {
      direction,
      didWrap,
      inset: 8
    });
  }

  // The open mode menu, which the results move with; null when closed.
  function getSearchPanelsLayoutTransitionMenu(): HTMLElement | null {
    const controller = elements.inputModeController;
    if (!controller ||
        typeof controller.isModeMenuVisible !== 'function' ||
        !controller.isModeMenuVisible()) {
      return null;
    }
    const menu = controller.menuElement
      ? controller.menuElement
      : (elements.inputParts ? elements.inputParts.modeMenu : null);
    return menu && !menu.hidden ? menu : null;
  }

  function commitSuggestionsNaturalHeightAfterRender(): void {
    SUGGESTIONS_HEIGHT_LAYOUT.applyNaturalSuggestionsHeightLayout(
      elements.suggestionsContainer
    );
    syncSearchModeMenuResultOffset();
  }

  // A click on a row: run its command or mode switch, or open its page.
  function activateRenderedOverlaySuggestion(
    suggestion: Suggestion,
    query: string,
    event: MouseEvent,
    index: number,
    item: SuggestionElement
  ): void {
    if (!suggestion) {
      return;
    }
    const input = elements.searchInput;
    const provider = isFullRowProvider(suggestion.provider) ? suggestion.provider : null;
    if (suggestion.type === 'commandNewTab') {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'openNewTab' });
      removeOverlay(elements.overlay);
      return;
    }
    if (suggestion.type === 'commandSettings') {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'openOptionsPage' });
      removeOverlay(elements.overlay);
      return;
    }
    if (suggestion.type === 'commandOpenTabs') {
      if (input) {
        input.value = '';
      }
      searchQuery.clear();
      activateOpenTabsSearchMode();
      if (input) {
        input.focus();
      }
      return;
    }
    if (suggestion.type === 'commandCopyUrl') {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'copyCurrentPageUrl' });
      removeOverlay(elements.overlay);
      return;
    }
    if (suggestion.type === 'commandDocumentPip') {
      openDocumentPipPickerFromOverlay();
      removeOverlay(elements.overlay);
      return;
    }
    if (suggestion.type === 'siteSearchPrompt' && provider) {
      modeActions.activateSiteSearch(provider);
      if (input) {
        input.focus();
      }
      return;
    }
    if (suggestion.type === 'helpFeedback' && suggestion.feedbackKey === 'community') {
      openOverlayCommunityQrDialog(suggestion.url || '');
      return;
    }
    if (suggestion.type === 'modeSwitch') {
      applyThemeModeChange(suggestion.nextMode || '');
      if (input) {
        input.focus();
      }
      return;
    }
    if (suggestion.type === 'webAppearanceSwitch') {
      if (isWebAppearanceMode(suggestion.nextMode)) {
        applyWebAppearanceMode(suggestion.nextMode);
      }
      if (input) {
        input.focus();
      }
      return;
    }
    if (shouldSwitchMatchedTabSuggestion(suggestion, index)) {
      resultActivation.openMatchedTab(suggestion, event, item, query);
      finishOverlayResultActivation(event, Boolean(suggestion.url));
      return;
    }
    if (provider && suggestion.searchQuery) {
      if (openSiteSearchProviderQuery(
        provider,
        suggestion.searchQuery,
        event
      )) {
        finishOverlayResultActivation(event, true);
      }
      return;
    }
    if (suggestion.forceSearch && suggestion.searchQuery) {
      if (resultActivation.opensInBackground(event) && suggestion.url) {
        resultActivation.openUrl(suggestion, query, event);
      } else {
        LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
          action: 'searchOrNavigate',
          query: suggestion.searchQuery,
          forceSearch: true,
          disposition: resultActivation.getDisposition(event)
        });
      }
    } else {
      resultActivation.openUrl(suggestion, query, event);
    }
    finishOverlayResultActivation(
      event,
      !(suggestion.forceSearch && !suggestion.url)
    );
  }

  function deleteRenderedOverlayHistorySuggestion(suggestion: Suggestion): void {
    deleteHistorySuggestionUrl(suggestion);
  }

  // Loads a row's favicon with the overlay's fallbacks; when all fail the
  // row hears of it and shows its glyph.
  function attachReactOverlayFavicon(image: HTMLImageElement, pageUrl: string, host: string, candidates: FaviconCandidates): void {
    const resolvedCandidates: FaviconCandidates = candidates && typeof candidates === 'object'
      ? candidates
      : {};
    favicons.attachResolvedFaviconWithFallbacks(
      image,
      pageUrl || '',
      host || '',
      resolvedCandidates.primaryUrl || resolvedCandidates.browserUrl || '',
      () => {
        image.dispatchEvent(new CustomEvent('lumno-favicon-fallback', {
          bubbles: true
        }));
      },
      { allowRemoteImage: resolvedCandidates.allowRemoteImage === true }
    );
  }

  function getReactOverlayFaviconCandidates(
    url: string,
    explicitUrl: string,
    options?: { includeChromeFallback?: boolean; allowRemoteImage?: boolean }
  ): FaviconCandidates {
    const resolver = getOverlayFaviconUrlResolver();
    return resolver ? resolver.getPageFaviconRenderCandidates(url, explicitUrl, options) : {};
  }

  // The view, made on first use; it goes with the session.
  let suggestionsView: SuggestionsViewController | null = null;
  function ensureOverlaySuggestionsView(): SuggestionsViewController {
    if (suggestionsView) {
      return suggestionsView;
    }
    const portals = elements.overlayPortals;
    if (!portals) {
      throw new Error('The overlay panel has not mounted.');
    }
    const view = createSuggestionsView({
      surface: 'overlay',
      document,
      portals,
      container: elements.suggestionsContainer,
      items: suggestionItems,
      t,
      formatMessage,
      sanitizeDisplayText: SearchDirectNavigation.sanitizeDisplayText,
      formatTabRankDebugText,
      isTabRankScoreDebugEnabled: () => settings.get(tabRankScoreDebug),
      shouldBlockFaviconForHost: shouldBlockOverlayFaviconForHost,
      isLocalNetworkHost,
      getChromeFaviconUrl,
      getBrowserPageFaviconUrl: getPageFaviconCandidateUrl,
      getPageFaviconRenderCandidates: getReactOverlayFaviconCandidates,
      getHostFromUrl,
      getUrlDisplay,
      isSimpleModeEnabled: () => settings.get(simpleModeEnabled),
      getThemeHostForSuggestion: (suggestion) => (
        suggestion && suggestion.url ? getHostFromUrl(suggestion.url) : ''
      ),
      getImmediateThemeForSuggestion,
      getThemeForSuggestion,
      getThemeForMode,
      getHoverColors,
      getHighlightColors,
      getNeutralHoverActionColors,
      applyThemeVariables,
      applyMarkVariables,
      applyFaviconOpticalAlignment: favicons.applyFaviconOpticalAlignment,
      attachFaviconWithFallbacks: attachReactOverlayFavicon,
      preloadIcon: favicons.preloadIcon,
      // A list drawn anew drops the selection, and the input shows what
      // was typed again.
      selection: {
        store: searchResults.store,
        select: (nextIndex) => {
          searchResults.select(nextIndex);
          if (nextIndex < 0) {
            suggestionInputPreview.restore(elements.searchInput, searchQuery.raw);
          }
        }
      },
      modifiers: suggestionModifiers,
      colorScheme,
      onSwitchToTab: (tab, event) => {
        const suggestion: OverlaySuggestion = {
          type: 'openTab',
          title: tab && tab.title ? tab.title : '',
          url: tab && tab.url ? tab.url : '',
          favicon: tab && tab.favIconUrl ? tab.favIconUrl : '',
          _xMatchedTabId: tab && typeof tab.id === 'number' ? tab.id : undefined
        };
        resultActivation.openMatchedTab(
          suggestion,
          event,
          null,
          readInputQuery()
        );
        finishOverlayResultActivation(event, Boolean(suggestion.url));
      },
      onActivateSuggestion: activateRenderedOverlaySuggestion,
      onDeleteHistory: deleteRenderedOverlayHistorySuggestion,
      onCopyUrl: copySearchResultUrl,
      showTopActionTooltip,
      hideTopActionTooltip,
      bindCursorTooltip: (target, getText, options) => (
        elements.cursorTooltip && elements.cursorTooltip.bind(
          target,
          getText,
          Object.assign(
            {
              boundaryElement: elements.overlay,
              positionMode: 'absolute'
            },
            options || {}
          )
        )
      ),
      // Fixed in the overlay's shadow root, like the mode menu's tooltip, so it can sit beside the panel.
      getHelpPassageHost: () => elements.overlayStyleRoot || document.body,
      getSearchActionLabel: () => t('action_search', '搜索'),
      getSiteSearchDisplayName: (provider) => getSiteSearchDisplayName(locale, provider),
      getDefaultSearchEngineThemeUrl: () => searchEngine.themeUrl(),
      getBrandAccentForUrl,
      buildThemeFromAccent: (accent) => buildTheme(accent),
      actionModel: resultActivation.actionModel,
      shouldSwitchMatchedTabSuggestion,
      defaultTheme: defaultTheme,
      urlHighlightTheme: urlHighlightTheme,
      openTabSuggestionLimit: 1000,
      // Keep every visible row immediately keyboard-accessible. Rows below
      // the viewport hydrate during browser idle time; use smaller commits
      // while the host Document is still spending its own loading budget.
      openTabInitialRenderLimit: 10,
      getOpenTabInitialRenderLimit: () =>
        normalizeSearchResultDisplayLimit(settings.get(searchResultDisplayLimit)),
      openTabRenderBatchSize: 16,
      getOpenTabRenderBatchSize: () =>
        isLoadingSessionTracked() || document.readyState === 'loading'
          ? 8
          : 16,
      enterAction: 'openNewTab',
      autoHighlightFirstTab: true
    });
    suggestionsView = view;
    overlaySessionCleanups.add(() => view.destroy());
    return view;
  }

  function renderOverlayEmptyState(message: string, art?: SuggestionsRenderPayload['emptyArt']): void {
    pauseOverlayAntiTranslateObserverForMutationBurst();
    ensureOverlaySuggestionsView().render({
      suggestions: [],
      query: searchQuery.text,
      emptyMessage: message || t('overlay_empty_result', '无匹配结果'),
      emptyArt: art || 'noResults'
    });
  }

  function renderTabSuggestions(tabList: OverlayTab[]): void {
    pauseOverlayAntiTranslateObserverForMutationBurst();
    const container = elements.suggestionsContainer;
    if (container) {
      container.removeAttribute('data-scope-result-enter');
    }
    const reactView = ensureOverlaySuggestionsView();
    suggestionItems.length = 0;
    searchResults.show([]);
    lastRender.clear();
    const list = Array.isArray(tabList) ? tabList.slice() : [];
    setOpenTabsResultsViewport(true, list.length);
    if (list.length === 0) {
      const emptyText = searchMode.openTabs
        ? t('overlay_empty_open_tabs', '未找到匹配的已打开标签页')
        : t('overlay_empty_result', '无匹配结果');
      renderOverlayEmptyState(emptyText, 'noTabs');
      setOverlayResultsCollapsed(false, { deferLayoutSync: true });
      commitSuggestionsNaturalHeightAfterRender();
      return;
    }
    reactView.renderTabs(list);
    if (container) {
      container.scrollTop = 0;
    }
    setOverlayResultsCollapsed(false, { deferLayoutSync: true });
    searchResults.select(-1);
    commitSuggestionsNaturalHeightAfterRender();
  }

  // Which mode a tab listing was asked for, so a late answer for another
  // mode is not shown.
  function getOverlaySearchModeKey(): string {
    if (searchMode.openTabs) {
      return 'openTabs';
    }
    if (searchMode.local && searchMode.local.sourceType) {
      return `local:${searchMode.local.sourceType}`;
    }
    const provider = searchMode.site;
    if (provider) {
      if (isAggregateSearchProvider(provider)) {
        return `aggregate:${String(provider.aggregateId || '')}`;
      }
      return `provider:${SearchSiteSearchProviders.getSearchModeProviderId(provider)}`;
    }
    return 'default';
  }

  function renderCachedTabsForOverlay(filterQuery?: string): boolean {
    if (!overlayTabs.ready) {
      return false;
    }
    const query = typeof filterQuery === 'string'
      ? filterQuery
      : readInputQuery();
    renderTabSuggestions(filterTabsForOverlay(overlayTabs.tabs, query));
    return true;
  }

  function renderCachedTabsOrRequest(filterQuery?: string): void {
    if (renderCachedTabsForOverlay(filterQuery)) {
      return;
    }
    if (!overlayTabsRequestInFlight) {
      requestTabsAndRender(filterQuery);
    }
  }

  // Lists the window's tabs from the worker and shows them when the mode
  // and query still want them.
  function requestTabsAndRender(filterQuery?: string): void {
    const requestQuery = typeof filterQuery === 'string'
      ? filterQuery
      : readInputQuery();
    const requestModeKey = getOverlaySearchModeKey();
    if (!requestQuery && !shouldShowOpenTabsForEmptyQuery()) {
      clearDefaultOpenTabsSuggestions();
      return;
    }
    const request: { action: 'getTabsForOverlay'; currentTabId?: number } = { action: 'getTabsForOverlay' };
    if (typeof overlayTabs.currentTabId === 'number') {
      request.currentTabId = overlayTabs.currentTabId;
    }
    overlayTabsRequestSeq += 1;
    const requestSeq = overlayTabsRequestSeq;
    overlayTabsRequestInFlight = true;
    LumnoMessaging.sendBackgroundMessage(chrome.runtime, request, (response) => {
      if (requestSeq !== overlayTabsRequestSeq) {
        return;
      }
      overlayTabsRequestInFlight = false;
      const freshTabs = response && Array.isArray(response.tabs) ? response.tabs : [];
      overlayTabs.received(freshTabs, response && typeof response.currentTabId === 'number'
        ? response.currentTabId
        : null);
      if (requestModeKey !== getOverlaySearchModeKey()) {
        return;
      }
      const activeQuery = searchQuery.text;
      if (!searchMode.openTabs &&
          (activeQuery || !shouldShowOpenTabsForEmptyQuery())) {
        return;
      }
      renderCachedTabsForOverlay(activeQuery);
    });
  }

  return {
    syncSuggestionLastState,
    scrollSelectedSuggestionIntoView,
    getSearchPanelsLayoutTransitionMenu,
    commitSuggestionsNaturalHeightAfterRender,
    ensureOverlaySuggestionsView,
    renderTabSuggestions,
    renderCachedTabsForOverlay,
    renderCachedTabsOrRequest,
    requestTabsAndRender
  };
}

export { createSuggestionsRender };
export type { SuggestionsRenderDeps };
