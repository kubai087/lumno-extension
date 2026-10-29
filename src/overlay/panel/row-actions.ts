// What a click or key does on a result row: run its command or mode
// switch, switch to its open tab, open its page or site search, delete it
// from history and refresh the list, or copy its address. The rows tell of
// these through the results' row events.
import type { WebAppearanceMode } from '../../domain/messages';
import type { InputModeProvider } from '../../shared/search/input-mode/types';
import type { SearchModeActions } from '../../shared/search-panel/mode-actions';
import type { SearchQuery } from '../../shared/search-panel/search-query';
import type { ResultActivation } from '../../shared/search-panel/result-activation';
import type { Suggestion, SuggestionElement } from '../../shared/react/search/suggestion-list/types';
import * as LumnoMessaging from '../../platform/messaging';
import type { ActivationEvent } from './result-activation';
import type { OverlayPanelElements } from './panel-elements';
import type { OverlaySuggestion } from './types';
import type { SuggestionsRender } from './suggestions-render';

interface RowActionsDeps {
  rowEvents: SuggestionsRender['rowEvents'];
  elements: Pick<OverlayPanelElements, 'overlay' | 'searchInput'>;
  searchQuery: SearchQuery;
  modeActions: Pick<SearchModeActions<InputModeProvider>, 'activateSiteSearch'>;
  resultActivation: ResultActivation;
  finishOverlayResultActivation(event: ActivationEvent | null, canOpenInBackground: boolean): boolean;
  shouldSwitchMatchedTabSuggestion(suggestion: Suggestion | null, index: number): boolean;
  removeOverlay(overlay: HTMLElement | null): void;
  activateOpenTabsSearchMode(): void;
  openDocumentPipPickerFromOverlay(): void;
  openOverlayCommunityQrDialog(qrUrl: string): void;
  applyThemeModeChange(mode: string): void;
  applyWebAppearanceMode(mode: WebAppearanceMode): void;
  openSiteSearchProviderQuery(provider: InputModeProvider, query: string, event: ActivationEvent | null): boolean;
  copySearchResultUrl(url: string): void;
  updateSearchSuggestions(rows: never[], query: string): void;
  requestOverlaySearchSuggestions(query: string): void;
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

function createRowActions(deps: RowActionsDeps): void {
  const {
    rowEvents,
    elements,
    searchQuery,
    modeActions,
    resultActivation,
    finishOverlayResultActivation,
    shouldSwitchMatchedTabSuggestion,
    removeOverlay,
    activateOpenTabsSearchMode,
    openDocumentPipPickerFromOverlay,
    openOverlayCommunityQrDialog,
    applyThemeModeChange,
    applyWebAppearanceMode,
    openSiteSearchProviderQuery,
    copySearchResultUrl,
    updateSearchSuggestions,
    requestOverlaySearchSuggestions
  } = deps;

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

  // A click on an open tab row switches to it.
  function switchToOpenTab(tab: { id?: number; title?: string; url?: string; favIconUrl?: string } | null, event: MouseEvent): void {
    const suggestion: OverlaySuggestion = {
      type: 'openTab',
      title: tab && tab.title ? tab.title : '',
      url: tab && tab.url ? tab.url : '',
      favicon: tab && tab.favIconUrl ? tab.favIconUrl : '',
      _xMatchedTabId: tab && typeof tab.id === 'number' ? tab.id : undefined
    };
    const input = elements.searchInput;
    resultActivation.openMatchedTab(suggestion, event, null, input ? String(input.value || '').trim() : '');
    finishOverlayResultActivation(event, Boolean(suggestion.url));
  }

  rowEvents.on('activate', (row) => activateRenderedOverlaySuggestion(row.suggestion, row.query, row.event, row.index, row.item));
  rowEvents.on('switchTab', (row) => switchToOpenTab(row.tab, row.event));
  rowEvents.on('deleteHistory', (row) => deleteRenderedOverlayHistorySuggestion(row.suggestion));
  rowEvents.on('copyUrl', (row) => copySearchResultUrl(row.url));
}

export { createRowActions };
