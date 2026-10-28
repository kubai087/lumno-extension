// Rendering suggestions: the React suggestions view, selection and
// scrolling, activating or deleting a row, favicons in rows, the empty
// state and the open tabs list.
import type { OverlayTab, WebAppearanceMode } from '../../domain/messages';
import type { Disposition } from '../../domain/navigation-disposition';
import * as SuggestionActionModel from '../../domain/search/suggestion-action-model';
import type { DisplayedSuggestion } from '../../domain/search/suggestion-action-model';
import type { SuggestionInputPreview } from '../../domain/search/suggestion-input-preview';
import type { SiteSearchProvider } from '../../domain/search/types';
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
import type { InputModeController } from '../../shared/search/search-input-mode';
import type { InputModeParts } from '../../shared/search/input-mode/controller-types';
import type { InputModeProvider } from '../../shared/search/input-mode/types';
import type * as SuggestionNavigation from '../../shared/search/suggestion-navigation';
import type * as SuggestionsHeightLayout from '../../shared/search/suggestions-height-layout';
import type { CursorTooltipController } from '../../shared/ui/cursor-tooltip-model';
import type { TooltipController } from '../../shared/ui/tooltip';
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

// What the view takes for an option this module passes straight through.
type ViewOption<K extends keyof SuggestionsViewOptions> = NonNullable<SuggestionsViewOptions[K]>;

interface SuggestionsRenderState {
  settings: Pick<OverlaySettings, 'get'>;
  overlay: HTMLElement | null;
  overlayStyleRoot: ShadowRoot | null;
  searchInput: HTMLInputElement | null;
  suggestionsContainer: HTMLElement | null;
  inputModeController: Pick<InputModeController, 'isModeMenuVisible' | 'menuElement'> | null;
  inputParts: Pick<InputModeParts, 'modeMenu'> | null;
  overlaySuggestionsView: SuggestionsViewController | null;
  // Made once the panel has mounted.
  topActionTooltipController: Pick<TooltipController, 'show' | 'hide'> | null;
  overlayCursorTooltipController: Pick<CursorTooltipController, 'bind'> | null;
  selectedIndex: number;
  // Dropping the selection puts back what the arrows wrote over.
  suggestionInputPreview: Pick<SuggestionInputPreview, 'restore'>;
  currentSuggestions: OverlaySuggestion[];
  lastRenderedQuery: string;
  lastRenderedActionContextKey: string;
  tabs: OverlayTab[];
  // The open tabs have been listed at least once.
  overlayTabsCacheReady: boolean;
  currentOverlayTabId: number | null;
  loadingSessionTrackingActive: boolean;
  defaultTheme: ThemeValue;
  urlHighlightTheme: ThemeValue;
}

interface SuggestionsRenderDeps {
  searchMode: SearchMode<InputModeProvider>;
  searchQuery: SearchQuery;
  favicons: Pick<OverlayFaviconRuntime, 'attachResolvedFaviconWithFallbacks' | 'applyFaviconOpticalAlignment' | 'preloadIcon'>;
  updateSearchSuggestions(rows: never[], query: string): void;
  requestOverlaySearchSuggestions(query: string): void;
  // The rendered rows, filled by the view.
  suggestionItems: SuggestionElement[];
  SUGGESTION_NAVIGATION: Pick<typeof SuggestionNavigation, 'scrollItemIntoView'>;
  SUGGESTIONS_HEIGHT_LAYOUT: Pick<typeof SuggestionsHeightLayout, 'applyNaturalSuggestionsHeightLayout'>;
  syncSearchModeMenuResultOffset(): void;
  removeOverlay(overlay: HTMLElement | null): void;
  activateOpenTabsSearchMode(): void;
  openDocumentPipPickerFromOverlay(): void;
  activateSiteSearch(provider: InputModeProvider | null): void;
  openOverlayCommunityQrDialog(qrUrl: string): void;
  applyThemeModeChange(mode: string): void;
  applyWebAppearanceMode(mode: WebAppearanceMode): void;
  shouldSwitchMatchedTabSuggestion: ViewOption<'shouldSwitchMatchedTabSuggestion'>;
  openMatchedTabSuggestion(
    suggestion: DisplayedSuggestion,
    event: ActivationEvent | null,
    item: { _xVisitButtonAction?: string } | null,
    query: string
  ): void;
  finishOverlayResultActivation(event: ActivationEvent | null, canOpenInBackground: boolean): boolean;
  openSiteSearchProviderQuery(provider: InputModeProvider | null, query: string, event: ActivationEvent | null): boolean;
  shouldOpenSearchResultInBackgroundTab(event: ActivationEvent | null): boolean;
  recordSearchSuggestionSelectionFromSuggestion(suggestion: DisplayedSuggestion, query: string, source: string): void;
  getSearchResultDisposition(event: ActivationEvent | null): Disposition;
  // Whether a plain open goes to the current tab, so rows say 「前往」.
  isCurrentTabDefault(): boolean;
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
  getSiteSearchDisplayName: ViewOption<'getSiteSearchDisplayName'>;
  isAiSiteSearchProvider: ViewOption<'isAiSiteSearchProvider'>;
  searchEngine: DefaultSearchEngine;
  getBrandAccentForUrl: ViewOption<'getBrandAccentForUrl'>;
  buildTheme(accent: unknown): ThemeValue;
  normalizeSearchResultDisplayLimit(value: unknown): number;
  pauseOverlayAntiTranslateObserverForMutationBurst(): void;
  setOpenTabsResultsViewport(active: boolean, itemCount?: number): void;
  setOverlayResultsCollapsed(collapsed: boolean, options?: { deferLayoutSync?: boolean } | null): void;
  isAggregateSearchProvider(provider: Partial<SiteSearchProvider> | null): boolean;
  filterTabsForOverlay(tabs: OverlayTab[], query: string): OverlayTab[];
  shouldShowOpenTabsForEmptyQuery(): boolean;
  clearDefaultOpenTabsSuggestions(): void;
  overlayState: SuggestionsRenderState;
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
    searchMode,
    searchQuery,
    favicons,
    updateSearchSuggestions,
    requestOverlaySearchSuggestions,
    suggestionItems,
    SUGGESTION_NAVIGATION,
    SUGGESTIONS_HEIGHT_LAYOUT,
    syncSearchModeMenuResultOffset,
    removeOverlay,
    activateOpenTabsSearchMode,
    openDocumentPipPickerFromOverlay,
    activateSiteSearch,
    openOverlayCommunityQrDialog,
    applyThemeModeChange,
    applyWebAppearanceMode,
    shouldSwitchMatchedTabSuggestion,
    openMatchedTabSuggestion,
    finishOverlayResultActivation,
    openSiteSearchProviderQuery,
    shouldOpenSearchResultInBackgroundTab,
    recordSearchSuggestionSelectionFromSuggestion,
    getSearchResultDisposition,
    isCurrentTabDefault,
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
    getSiteSearchDisplayName,
    isAiSiteSearchProvider,
    searchEngine,
    getBrandAccentForUrl,
    buildTheme,
    normalizeSearchResultDisplayLimit,
    pauseOverlayAntiTranslateObserverForMutationBurst,
    setOpenTabsResultsViewport,
    setOverlayResultsCollapsed,
    isAggregateSearchProvider,
    filterTabsForOverlay,
    shouldShowOpenTabsForEmptyQuery,
    clearDefaultOpenTabsSuggestions
  } = deps;

  // The panel state object shared with search-panel.ts and the other modules.
  const overlayState = deps.overlayState;

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
    if (!button || !text || !overlayState.topActionTooltipController) {
      return;
    }
    overlayState.topActionTooltipController.show(button, text, {
      boundaryElement: overlayState.overlay,
      positionMode: 'absolute',
      maxWidth: 420
    });
  };
  const hideTopActionTooltip = (): void => {
    if (overlayState.topActionTooltipController) {
      overlayState.topActionTooltipController.hide();
    }
  };

  function readInputQuery(): string {
    return overlayState.searchInput ? String(overlayState.searchInput.value || '').trim() : '';
  }

  function getOverlaySuggestionRefreshQuery(): string {
    return searchQuery.text || (overlayState.searchInput ? String(overlayState.searchInput.value || '').trim() : '');
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

  function updateSelection(): void {
    ensureOverlaySuggestionsView().updateSelection(overlayState.selectedIndex);
  }

  function syncSuggestionLastState(): void {
    suggestionItems.forEach((item, index) => {
      if (item) {
        item.setAttribute('data-last', index === suggestionItems.length - 1 ? 'true' : 'false');
      }
    });
  }

  function scrollSelectedSuggestionIntoView(direction: 'up' | 'down', didWrap: boolean): void {
    if (!overlayState.suggestionsContainer || overlayState.selectedIndex < 0) {
      return;
    }
    const item = suggestionItems[overlayState.selectedIndex];
    SUGGESTION_NAVIGATION.scrollItemIntoView(overlayState.suggestionsContainer, item, {
      direction,
      didWrap,
      inset: 8
    });
  }

  // The open mode menu, which the results move with; null when closed.
  function getSearchPanelsLayoutTransitionMenu(): HTMLElement | null {
    const controller = overlayState.inputModeController;
    if (!controller ||
        typeof controller.isModeMenuVisible !== 'function' ||
        !controller.isModeMenuVisible()) {
      return null;
    }
    const menu = controller.menuElement
      ? controller.menuElement
      : (overlayState.inputParts ? overlayState.inputParts.modeMenu : null);
    return menu && !menu.hidden ? menu : null;
  }

  function commitSuggestionsNaturalHeightAfterRender(): void {
    SUGGESTIONS_HEIGHT_LAYOUT.applyNaturalSuggestionsHeightLayout(
      overlayState.suggestionsContainer
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
    const input = overlayState.searchInput;
    const provider = isFullRowProvider(suggestion.provider) ? suggestion.provider : null;
    if (suggestion.type === 'commandNewTab') {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'openNewTab' });
      removeOverlay(overlayState.overlay);
      return;
    }
    if (suggestion.type === 'commandSettings') {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'openOptionsPage' });
      removeOverlay(overlayState.overlay);
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
      removeOverlay(overlayState.overlay);
      return;
    }
    if (suggestion.type === 'commandDocumentPip') {
      openDocumentPipPickerFromOverlay();
      removeOverlay(overlayState.overlay);
      return;
    }
    if (suggestion.type === 'siteSearchPrompt' && provider) {
      activateSiteSearch(provider);
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
      openMatchedTabSuggestion(suggestion, event, item, query);
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
      if (shouldOpenSearchResultInBackgroundTab(event) && suggestion.url) {
        recordSearchSuggestionSelectionFromSuggestion(
          suggestion,
          query,
          'overlay'
        );
        LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
          action: 'createTab',
          url: suggestion.url,
          disposition: 'backgroundTab'
        });
      } else {
        LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
          action: 'searchOrNavigate',
          query: suggestion.searchQuery,
          forceSearch: true,
          disposition: getSearchResultDisposition(event)
        });
      }
    } else {
      recordSearchSuggestionSelectionFromSuggestion(
        suggestion,
        query,
        'overlay'
      );
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
        action: 'createTab',
        url: suggestion.url || '',
        disposition: getSearchResultDisposition(event)
      });
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

  // While results open in the current tab, rows say 「前往」 and Option/Alt
  // turns them to 「新开」.
  const overlayActionModel: ViewOption<'actionModel'> = {
    ...SuggestionActionModel,
    createSearchActionModel: (input) => SuggestionActionModel.createSearchActionModel({
      ...input,
      currentTabByDefault: isCurrentTabDefault()
    }),
    getModifierAdjustedAction: (action, modifiers) => SuggestionActionModel.getModifierAdjustedAction(action, {
      ...modifiers,
      currentTabByDefault: isCurrentTabDefault()
    })
  };

  // The view, made on first use.
  function ensureOverlaySuggestionsView(): SuggestionsViewController {
    if (overlayState.overlaySuggestionsView) {
      return overlayState.overlaySuggestionsView;
    }
    const view = createSuggestionsView({
      surface: 'overlay',
      document,
      container: overlayState.suggestionsContainer,
      items: suggestionItems,
      t,
      formatMessage,
      sanitizeDisplayText: SearchDirectNavigation.sanitizeDisplayText,
      formatTabRankDebugText,
      isTabRankScoreDebugEnabled: () => overlayState.settings.get(tabRankScoreDebug),
      shouldBlockFaviconForHost: shouldBlockOverlayFaviconForHost,
      isLocalNetworkHost,
      getChromeFaviconUrl,
      getBrowserPageFaviconUrl: getPageFaviconCandidateUrl,
      getPageFaviconRenderCandidates: getReactOverlayFaviconCandidates,
      getHostFromUrl,
      getUrlDisplay,
      isSimpleModeEnabled: () => overlayState.settings.get(simpleModeEnabled),
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
      onSetSelectedIndex: (nextIndex) => {
        overlayState.selectedIndex = nextIndex;
        if (nextIndex < 0) {
          overlayState.suggestionInputPreview.restore(overlayState.searchInput, searchQuery.raw);
        }
      },
      getSelectedIndex: () => overlayState.selectedIndex,
      onSwitchToTab: (tab, event) => {
        const suggestion: OverlaySuggestion = {
          type: 'openTab',
          title: tab && tab.title ? tab.title : '',
          url: tab && tab.url ? tab.url : '',
          favicon: tab && tab.favIconUrl ? tab.favIconUrl : '',
          _xMatchedTabId: tab && typeof tab.id === 'number' ? tab.id : undefined
        };
        openMatchedTabSuggestion(
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
        overlayState.overlayCursorTooltipController && overlayState.overlayCursorTooltipController.bind(
          target,
          getText,
          Object.assign(
            {
              boundaryElement: overlayState.overlay,
              positionMode: 'absolute'
            },
            options || {}
          )
        )
      ),
      // Fixed in the overlay's shadow root, like the mode menu's tooltip, so it can sit beside the panel.
      getHelpPassageHost: () => overlayState.overlayStyleRoot || document.body,
      getSearchActionLabel: () => t('action_search', '搜索'),
      getSiteSearchDisplayName,
      isAiSiteSearchProvider,
      getDefaultSearchEngineThemeUrl: () => searchEngine.themeUrl(),
      getBrandAccentForUrl,
      buildThemeFromAccent: (accent) => buildTheme(accent),
      actionModel: overlayActionModel,
      shouldSwitchMatchedTabSuggestion,
      defaultTheme: overlayState.defaultTheme,
      urlHighlightTheme: overlayState.urlHighlightTheme,
      openTabSuggestionLimit: 1000,
      // Keep every visible row immediately keyboard-accessible. Rows below
      // the viewport hydrate during browser idle time; use smaller commits
      // while the host Document is still spending its own loading budget.
      openTabInitialRenderLimit: 10,
      getOpenTabInitialRenderLimit: () =>
        normalizeSearchResultDisplayLimit(overlayState.settings.get(searchResultDisplayLimit)),
      openTabRenderBatchSize: 16,
      getOpenTabRenderBatchSize: () =>
        overlayState.loadingSessionTrackingActive || document.readyState === 'loading'
          ? 8
          : 16,
      enterAction: 'openNewTab',
      autoHighlightFirstTab: true
    });
    overlayState.overlaySuggestionsView = view;
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
    const container = overlayState.suggestionsContainer;
    if (container) {
      container.removeAttribute('data-scope-result-enter');
    }
    const reactView = ensureOverlaySuggestionsView();
    suggestionItems.length = 0;
    overlayState.currentSuggestions = [];
    overlayState.lastRenderedQuery = '';
    overlayState.lastRenderedActionContextKey = '';
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
    overlayState.selectedIndex = -1;
    updateSelection();
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
    if (!overlayState.overlayTabsCacheReady) {
      return false;
    }
    const query = typeof filterQuery === 'string'
      ? filterQuery
      : readInputQuery();
    renderTabSuggestions(filterTabsForOverlay(overlayState.tabs, query));
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
    if (typeof overlayState.currentOverlayTabId === 'number') {
      request.currentTabId = overlayState.currentOverlayTabId;
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
      overlayState.currentOverlayTabId = (response && typeof response.currentTabId === 'number')
        ? response.currentTabId
        : null;
      overlayState.tabs = freshTabs;
      overlayState.overlayTabsCacheReady = true;
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
    updateSelection,
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
export type { SuggestionsRenderDeps, SuggestionsRenderState };
