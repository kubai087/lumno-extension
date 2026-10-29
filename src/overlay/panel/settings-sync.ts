import type { OverlayThemeMode } from './overlay-theme-mode';
import type { OverlayTab } from '../../domain/messages';
import { simpleModeEnabled, themeMode } from '../../domain/settings/appearance';
import { documentPipEnabled } from '../../domain/settings/features';
import {
  overlayFontFallback,
  overlayFontFamily,
  overlayOpenTabsDefaultVisible,
  overlayPageThemeAdaptationEnabled,
  overlaySizeMode,
  overlayTabPriority,
  overlayWidth
} from '../../domain/settings/overlay-panel';
import {
  faviconEnhancedFetchEnabled,
  faviconRequestBlacklist,
  numberShortcutInstantEnabled,
  searchBlacklist,
  searchResultDisplayLimit,
  searchResultPriority,
  searchResultSourceTypes,
  tabRankScoreDebug
} from '../../domain/settings/search';
import type { OverlaySettings } from '../overlay-settings';
import type { DefaultSearchEngine } from '../../shared/search-panel/default-engine';
import type { SearchQuery } from '../../shared/search-panel/search-query';
import type { SearchMode } from '../../shared/search-panel/search-mode';
import type { SearchResults } from '../../shared/search-panel/search-results';
import type { SearchModeActions } from '../../shared/search-panel/mode-actions';
import type { InputModeProvider, InputModeTheme } from '../../shared/search/input-mode/types';
import * as SUGGESTION_NAVIGATION from '../../shared/search/suggestion-navigation';
import type { OverlayPanelElements } from './panel-elements';
import type { OpenTabs } from '../../shared/search-panel/open-tabs';

// Row is a suggestion row; this module only passes it along.

interface SettingsSyncDeps<Row> {
  modeActions: SearchModeActions<InputModeProvider>;
  searchResults: Pick<SearchResults<Row>, 'lastResponse'>;
  searchMode: Pick<SearchMode<InputModeProvider>, 'site' | 'local' | 'openTabs'>;
  searchQuery: SearchQuery;
  updateSearchSuggestions(rows: Row[], query: string, options?: { forceFullRerender?: boolean }): void;
  requestOverlaySearchSuggestions(query: string): void;
  overlayThemeChoice: Pick<OverlayThemeMode, 'apply'>;
  applyOverlayFontFamily(): void;
  searchEngine: DefaultSearchEngine;
  shouldShowOpenTabsForEmptyQuery(): boolean;
  renderTabSuggestions(tabs: OverlayTab[]): void;
  filterTabsForOverlay(tabs: OverlayTab[], query: string): OverlayTab[];
  requestTabsAndRender(query?: string): void;
  clearDefaultOpenTabsSuggestions(): void;
  refreshOverlayFaviconsForPolicyChange(): void;
  getImmediateThemeForSuggestion(suggestion: { provider: InputModeProvider }): InputModeTheme | null;
  documentPipSupported: boolean;
  settings: OverlaySettings;
  overlayNoticeLayer: { sync(overlayElement: HTMLElement | null): void };
  overlayViewportSizeSync: { apply(overlayElement: HTMLElement | null): void };
  elements: Pick<OverlayPanelElements, 'inputModeController' | 'overlay' | 'suggestionsContainer'>;
  overlayTabs: Pick<OpenTabs, 'tabs'>;
  setDocumentPipEnabled(enabled: boolean): void;
}

// What the panel does when an overlay setting changes while it is open;
// the panel's modules read the settings themselves. The returned promise
// settles once the theme, the size and the fonts the session read are
// applied.
function createSettingsSync<Row>(deps: SettingsSyncDeps<Row>): Promise<void> {
  const {
    setDocumentPipEnabled,
    overlayTabs,
    elements,
    overlayViewportSizeSync,
    overlayNoticeLayer,
    settings,
    modeActions,
    searchResults,
    searchMode,
    searchQuery,
    updateSearchSuggestions,
    overlayThemeChoice,
    searchEngine,
    requestOverlaySearchSuggestions,
    shouldShowOpenTabsForEmptyQuery,
    renderTabSuggestions,
    filterTabsForOverlay,
    refreshOverlayFaviconsForPolicyChange,
    getImmediateThemeForSuggestion,
    requestTabsAndRender,
    clearDefaultOpenTabsSuggestions,
    documentPipSupported,
    applyOverlayFontFamily
  } = deps;

  const loaded = settings.loaded;

  function applyOverlaySize(): void {
    overlayViewportSizeSync.apply(elements.overlay);
    overlayNoticeLayer.sync(elements.overlay);
  }

  function refreshOverlaySuggestionsFromLastResponse(): void {
    if (searchQuery.text) {
      updateSearchSuggestions(searchResults.lastResponse, searchQuery.text);
    }
  }

  function showsOpenTabs(): boolean {
    return searchMode.openTabs ||
      (!searchQuery.text && shouldShowOpenTabsForEmptyQuery());
  }

  function redrawRows(options?: { forceFullRerender?: boolean }): void {
    if (showsOpenTabs()) {
      renderTabSuggestions(filterTabsForOverlay(overlayTabs.tabs, searchQuery.text));
      return;
    }
    if (searchQuery.text) {
      updateSearchSuggestions(searchResults.lastResponse, searchQuery.text, options);
    }
  }

  settings.follow([themeMode, overlayPageThemeAdaptationEnabled], () => overlayThemeChoice.apply(settings.get(themeMode)));

  searchEngine.store.subscribe(refreshOverlaySuggestionsFromLastResponse);

  settings.follow([searchResultPriority, searchBlacklist, overlayTabPriority], refreshOverlaySuggestionsFromLastResponse);
  settings.follow(searchResultSourceTypes, () => {
    const scope = searchMode.local;
    if (scope && !settings.get(searchResultSourceTypes).some((type) => type === scope.sourceType)) {
      modeActions.clearLocalSearchScope();
    }
    if (searchQuery.text) {
      requestOverlaySearchSuggestions(searchQuery.text);
    }
  });
  settings.follow(searchResultDisplayLimit, () => redrawRows());
  settings.follow(numberShortcutInstantEnabled, () => {
    SUGGESTION_NAVIGATION.cancelNumberShortcuts(elements.suggestionsContainer);
  });
  settings.follow(simpleModeEnabled, () => redrawRows({ forceFullRerender: true }));

  settings.follow([faviconEnhancedFetchEnabled, faviconRequestBlacklist], () => {
    refreshOverlayFaviconsForPolicyChange();
    if (elements.inputModeController) {
      const provider = searchMode.site;
      if (provider) {
        modeActions.setSiteSearchPrefix(provider, getImmediateThemeForSuggestion({ provider }), { animate: false });
      }
      elements.inputModeController.refreshModeMenu();
    }
  });

  settings.follow(overlayOpenTabsDefaultVisible, () => {
    if (searchQuery.text || searchMode.openTabs) {
      return;
    }
    if (settings.get(overlayOpenTabsDefaultVisible)) {
      requestTabsAndRender('');
    } else {
      clearDefaultOpenTabsSuggestions();
    }
  });

  // The open context says whether Picture-in-Picture is on until the
  // session's own read.
  function readDocumentPip(): void {
    setDocumentPipEnabled(documentPipSupported && settings.get(documentPipEnabled));
    refreshOverlaySuggestionsFromLastResponse();
  }
  settings.follow(documentPipEnabled, readDocumentPip);

  settings.follow([overlaySizeMode, overlayWidth], applyOverlaySize);
  // The fonts are this device's own choice (installed faces).
  settings.follow([overlayFontFamily, overlayFontFallback], applyOverlayFontFamily);

  settings.follow(tabRankScoreDebug, () => {
    if (!searchQuery.text || !searchQuery.text.trim()) {
      requestTabsAndRender();
    }
  });

  return loaded.then(() => {
    readDocumentPip();
    overlayThemeChoice.apply(settings.get(themeMode));
    applyOverlaySize();
    applyOverlayFontFamily();
  });
}

export { createSettingsSync };
export type { SettingsSyncDeps };
