import type { OverlayTab } from '../../domain/messages';
import type { LocalSearchScope } from '../../domain/search/types';
import { simpleModeEnabled, themeMode } from '../../domain/settings/appearance';
import type { ThemeMode } from '../../domain/settings/appearance';
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
import type * as SuggestionNavigation from '../../shared/search/suggestion-navigation';
import type { OverlaySettings } from '../overlay-settings';
import type { DefaultSearchEngine } from '../../shared/search-panel/default-engine';

// Row is a suggestion row, Provider a site search provider and Theme a
// suggestion theme; this module only passes them along.
interface SettingsSyncState<Row, Provider> {
  settings: OverlaySettings;
  overlay: HTMLElement | null;
  suggestionsContainer: HTMLElement | null;
  overlayViewportSizeSync: { apply(overlayElement: HTMLElement | null): void };
  overlayNoticeLayer: { sync(overlayElement: HTMLElement | null): void };
  inputModeController: { refreshModeMenu(): void } | null;
  latestOverlayQuery: string;
  // The rows of the last answer, to rebuild the list when a setting changes.
  lastSuggestionResponse: Row[];
  tabs: OverlayTab[];
  openTabsSearchModeActive: boolean;
  siteSearchState: Provider | null;
  localSearchScopeState: LocalSearchScope | null;
  documentPipEnabled: boolean;
}

interface SettingsSyncDeps<Row, Provider, Theme> {
  SUGGESTION_NAVIGATION: Pick<typeof SuggestionNavigation, 'cancelNumberShortcuts'>;
  updateSearchSuggestions(rows: Row[], query: string, options?: { forceFullRerender?: boolean }): void;
  requestOverlaySearchSuggestions(query: string): void;
  applyOverlayTheme(mode: ThemeMode): void;
  applyOverlayFontFamily(): void;
  searchEngine: DefaultSearchEngine;
  clearLocalSearchScope(): void;
  shouldShowOpenTabsForEmptyQuery(): boolean;
  renderTabSuggestions(tabs: OverlayTab[]): void;
  filterTabsForOverlay(tabs: OverlayTab[], query: string): OverlayTab[];
  requestTabsAndRender(query?: string): void;
  clearDefaultOpenTabsSuggestions(): void;
  refreshOverlayFaviconsForPolicyChange(): void;
  setSiteSearchPrefix(provider: Provider, theme: Theme, options: { animate: boolean }): void;
  getImmediateThemeForSuggestion(suggestion: { provider: Provider }): Theme;
  documentPipSupported: boolean;
  overlayState: SettingsSyncState<Row, Provider>;
}

// What the panel does when an overlay setting changes while it is open;
// the panel's modules read the settings themselves. The returned promise
// settles once the theme, the size and the fonts the session read are
// applied.
function createSettingsSync<Row, Provider, Theme>(deps: SettingsSyncDeps<Row, Provider, Theme>): Promise<void> {
  const {
    updateSearchSuggestions,
    applyOverlayTheme,
    searchEngine,
    clearLocalSearchScope,
    requestOverlaySearchSuggestions,
    shouldShowOpenTabsForEmptyQuery,
    renderTabSuggestions,
    filterTabsForOverlay,
    SUGGESTION_NAVIGATION,
    refreshOverlayFaviconsForPolicyChange,
    setSiteSearchPrefix,
    getImmediateThemeForSuggestion,
    requestTabsAndRender,
    clearDefaultOpenTabsSuggestions,
    documentPipSupported,
    applyOverlayFontFamily
  } = deps;

  // The panel state object shared with search-panel.ts and the other modules.
  const overlayState = deps.overlayState;
  const settings = overlayState.settings;
  const loaded = settings.loaded;

  function applyOverlaySize(): void {
    overlayState.overlayViewportSizeSync.apply(overlayState.overlay);
    overlayState.overlayNoticeLayer.sync(overlayState.overlay);
  }

  function refreshOverlaySuggestionsFromLastResponse(): void {
    if (overlayState.latestOverlayQuery) {
      updateSearchSuggestions(overlayState.lastSuggestionResponse, overlayState.latestOverlayQuery);
    }
  }

  function showsOpenTabs(): boolean {
    return overlayState.openTabsSearchModeActive ||
      (!overlayState.latestOverlayQuery && shouldShowOpenTabsForEmptyQuery());
  }

  function redrawRows(options?: { forceFullRerender?: boolean }): void {
    if (showsOpenTabs()) {
      renderTabSuggestions(filterTabsForOverlay(overlayState.tabs, overlayState.latestOverlayQuery));
      return;
    }
    if (overlayState.latestOverlayQuery) {
      updateSearchSuggestions(overlayState.lastSuggestionResponse, overlayState.latestOverlayQuery, options);
    }
  }

  settings.follow([themeMode, overlayPageThemeAdaptationEnabled], () => applyOverlayTheme(settings.get(themeMode)));

  searchEngine.store.subscribe(refreshOverlaySuggestionsFromLastResponse);

  settings.follow([searchResultPriority, searchBlacklist, overlayTabPriority], refreshOverlaySuggestionsFromLastResponse);
  settings.follow(searchResultSourceTypes, () => {
    const scope = overlayState.localSearchScopeState;
    if (scope && !settings.get(searchResultSourceTypes).some((type) => type === scope.sourceType)) {
      clearLocalSearchScope();
    }
    if (overlayState.latestOverlayQuery) {
      requestOverlaySearchSuggestions(overlayState.latestOverlayQuery);
    }
  });
  settings.follow(searchResultDisplayLimit, () => redrawRows());
  settings.follow(numberShortcutInstantEnabled, () => {
    SUGGESTION_NAVIGATION.cancelNumberShortcuts(overlayState.suggestionsContainer);
  });
  settings.follow(simpleModeEnabled, () => redrawRows({ forceFullRerender: true }));

  settings.follow([faviconEnhancedFetchEnabled, faviconRequestBlacklist], () => {
    refreshOverlayFaviconsForPolicyChange();
    if (overlayState.inputModeController) {
      const provider = overlayState.siteSearchState;
      if (provider) {
        setSiteSearchPrefix(provider, getImmediateThemeForSuggestion({ provider }), { animate: false });
      }
      overlayState.inputModeController.refreshModeMenu();
    }
  });

  settings.follow(overlayOpenTabsDefaultVisible, () => {
    if (overlayState.latestOverlayQuery || overlayState.openTabsSearchModeActive) {
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
    overlayState.documentPipEnabled = documentPipSupported && settings.get(documentPipEnabled);
    refreshOverlaySuggestionsFromLastResponse();
  }
  settings.follow(documentPipEnabled, readDocumentPip);

  settings.follow([overlaySizeMode, overlayWidth], applyOverlaySize);
  // The fonts are this device's own choice (installed faces).
  settings.follow([overlayFontFamily, overlayFontFallback], applyOverlayFontFamily);

  settings.follow(tabRankScoreDebug, () => {
    if (!overlayState.latestOverlayQuery || !overlayState.latestOverlayQuery.trim()) {
      requestTabsAndRender();
    }
  });

  return loaded.then(() => {
    readDocumentPip();
    applyOverlayTheme(settings.get(themeMode));
    applyOverlaySize();
    applyOverlayFontFamily();
  });
}

export { createSettingsSync };
export type { SettingsSyncDeps, SettingsSyncState };
