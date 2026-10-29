// What the page does when a search setting changes while it is open; the
// search modules read the settings themselves.
import type { SiteSearchProvider } from '../../domain/search/types';
import { simpleModeEnabled } from '../../domain/settings/appearance';
import { overlayTabPriority } from '../../domain/settings/overlay-panel';
import {
  faviconEnhancedFetchEnabled,
  faviconRequestBlacklist,
  numberShortcutInstantEnabled,
  searchBlacklist,
  searchResultDisplayLimit,
  searchResultPriority,
  searchResultSourceTypes
} from '../../domain/settings/search';
import type { SettingsStore } from '../../platform/settings-store';
import type { Suggestion } from '../../shared/react/search/suggestion-list/types';
import type { DefaultSearchEngine } from '../../shared/search-panel/default-engine';
import * as SuggestionNavigation from '../../shared/search/suggestion-navigation';
import type { InputModeTheme } from '../../shared/search/input-mode/types';
import type { RenderSuggestions, RequestSuggestions } from './search-types';
import type { SearchQuery } from '../../shared/search-panel/search-query';
import type { SearchMode } from '../../shared/search-panel/search-mode';
import type { SearchResults } from '../../shared/search-panel/search-results';
import type { SearchModeActions } from '../../shared/search-panel/mode-actions';
import type { SearchBoxParts } from './search-box-parts';


interface SearchSettingsSyncDeps {
  modeActions: SearchModeActions<SiteSearchProvider>;
  searchResults: SearchResults<Suggestion>;
  searchMode: SearchMode<SiteSearchProvider>;
  searchQuery: SearchQuery;
  settings: Pick<SettingsStore, 'get' | 'subscribe'>;
  searchEngine: Pick<DefaultSearchEngine, 'store'>;
  renderSuggestions: RenderSuggestions;
  requestSuggestions: RequestSuggestions;
  markRecentDataDirty(): void;
  scheduleRecentReloadIfVisible(): void;
  scheduleBookmarkReloadIfVisible(): void;
  refreshThemeAwareFavicons?(): void;
  getImmediateThemeForSuggestion(suggestion: { provider: SiteSearchProvider }): InputModeTheme;
  searchBox: Pick<SearchBoxParts, 'modeController'>;
  suggestionsContainer: HTMLElement;
}

function createSearchSettingsSync(deps: SearchSettingsSyncDeps): void {
  const {
    suggestionsContainer,
    searchBox,
    modeActions,
    searchResults,
    searchMode,
    searchQuery,
    settings,
    searchEngine,
    renderSuggestions,
    requestSuggestions,
    markRecentDataDirty,
    scheduleRecentReloadIfVisible,
    scheduleBookmarkReloadIfVisible,
    refreshThemeAwareFavicons,
    getImmediateThemeForSuggestion
  } = deps;


  function redrawSuggestions(): void {
    if (searchQuery.text) {
      renderSuggestions(searchResults.lastResponse, searchQuery.text);
    }
  }

  // These settings change which suggestions show, so they refresh at once.
  function refreshSuggestions(): void {
    if (searchQuery.text && searchQuery.text.trim()) {
      requestSuggestions(searchQuery.text, { immediate: true });
    }
  }

  settings.subscribe(searchResultSourceTypes, () => {
    const scope = searchMode.local;
    if (scope && !settings.get(searchResultSourceTypes).includes(scope.sourceType)) {
      modeActions.clearLocalSearchScope();
    }
  });
  settings.subscribe([searchResultDisplayLimit, simpleModeEnabled], redrawSuggestions);
  settings.subscribe(numberShortcutInstantEnabled, () => {
    SuggestionNavigation.cancelNumberShortcuts(suggestionsContainer);
  });
  settings.subscribe(searchBlacklist, () => {
    markRecentDataDirty();
    scheduleRecentReloadIfVisible();
  });
  settings.subscribe([faviconRequestBlacklist, faviconEnhancedFetchEnabled], () => {
    markRecentDataDirty();
    scheduleRecentReloadIfVisible();
    scheduleBookmarkReloadIfVisible();
    if (refreshThemeAwareFavicons) {
      refreshThemeAwareFavicons();
    }
    if (searchBox.modeController) {
      if (searchMode.site) {
        modeActions.setSiteSearchPrefix(searchMode.site, getImmediateThemeForSuggestion({ provider: searchMode.site }), { animate: false });
      }
      searchBox.modeController.refreshModeMenu();
    }
  });
  searchEngine.store.subscribe(refreshSuggestions);
  settings.subscribe([
    searchResultPriority,
    searchResultSourceTypes,
    overlayTabPriority,
    searchBlacklist,
    faviconRequestBlacklist,
    faviconEnhancedFetchEnabled
  ], refreshSuggestions);
}

export { createSearchSettingsSync };
export type { SearchSettingsSyncDeps };
