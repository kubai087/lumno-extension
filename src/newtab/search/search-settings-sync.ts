// Search settings that can change while the page is open: the default
// engine, result priority, sources and limit, open-in-new-tab, number
// shortcuts, simple mode and the search and favicon blacklists.
import type { BlacklistRule } from '../../domain/blacklist-utils';
import type { SearchSourceType, SiteSearchProvider } from '../../domain/search/types';
import type * as Settings from '../../domain/settings';
import type { NewtabOpenInNewTab, SearchResultPriority } from '../../domain/settings';
import type { Suggestion } from '../../shared/react/search/suggestion-list/types';
import type * as SuggestionNavigation from '../../shared/search/suggestion-navigation';
import type { InputModeController } from '../../shared/search/search-input-mode';
import type { InputModeTheme } from '../../shared/search/input-mode/types';
import type { StorageChangeRegistry } from '../storage-change-registry';
import type { DefaultSearchEngine } from '../../shared/search-panel/default-engine';
import type { SearchModeController } from './search-mode-controller';
import type { ActiveLocalScope, RenderSuggestions, RequestSuggestions } from './search-types';

interface SearchSettingsSyncState {
  searchResultPriorityMode: string;
  enabledSearchResultSourceTypes: SearchSourceType[];
  localSearchScopeState: ActiveLocalScope | null;
  searchResultDisplayLimit: number;
  latestQuery: string;
  lastSuggestionResponse: Suggestion[];
  newtabOpenInNewTab: NewtabOpenInNewTab;
  numberShortcutInstantEnabled: boolean;
  suggestionsContainer: HTMLElement | null;
  macosCtrlSuggestionNavigationEnabled: boolean;
  simpleModeEnabled: boolean;
  openTabQuickSwitchEnabled: boolean;
  searchBlacklistItems: BlacklistRule[];
  faviconRequestBlacklistItems: BlacklistRule[];
  faviconEnhancedFetchEnabled: boolean;
  // Bumped when the favicon policy changes, so requests made before it are
  // dropped.
  shortcutFaviconPolicyRevision: number;
  inputModeController: Pick<InputModeController, 'refreshModeMenu'> | null;
  siteSearchState: SiteSearchProvider | null;
}

interface SearchSettingsSyncDeps {
  searchEngine: Pick<DefaultSearchEngine, 'store'>;
  storageChanges: Pick<StorageChangeRegistry, 'on'>;
  SEARCH_RESULT_PRIORITY_STORAGE_KEY: string;
  normalizeSearchResultPriority(value: unknown): SearchResultPriority;
  SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY: string;
  normalizeEnabledSearchResultSourceTypes(value: unknown): SearchSourceType[];
  clearLocalSearchScope(): boolean;
  SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY: string;
  normalizeSearchResultDisplayLimit(value: unknown): number;
  renderSuggestions: RenderSuggestions;
  NEWTAB_OPEN_IN_NEW_TAB_STORAGE_KEY: string;
  SETTINGS: Pick<typeof Settings, 'newtabOpenInNewTab'>;
  NUMBER_SHORTCUT_INSTANT_ENABLED_STORAGE_KEY: string;
  normalizeNumberShortcutInstantEnabled(value: unknown): boolean;
  SUGGESTION_NAVIGATION: Pick<typeof SuggestionNavigation, 'cancelNumberShortcuts'>;
  MACOS_CTRL_SUGGESTION_NAVIGATION_ENABLED_STORAGE_KEY: string;
  normalizeMacosCtrlSuggestionNavigationEnabled(value: unknown): boolean;
  SIMPLE_MODE_ENABLED_STORAGE_KEY: string;
  normalizeSimpleModeEnabled(value: unknown): boolean;
  OVERLAY_TAB_PRIORITY_STORAGE_KEY: string;
  normalizeOverlayTabPriorityMode(value: unknown): boolean;
  requestSuggestions: RequestSuggestions;
  SEARCH_BLACKLIST_STORAGE_KEY: string;
  normalizeSearchBlacklistItems(value: unknown): BlacklistRule[];
  markRecentDataDirty(): void;
  scheduleRecentReloadIfVisible(): void;
  FAVICON_REQUEST_BLACKLIST_STORAGE_KEY: string;
  normalizeFaviconRequestBlacklistItems(value: unknown): BlacklistRule[];
  scheduleBookmarkReloadIfVisible(): void;
  refreshThemeAwareFavicons?(): void;
  FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY: string;
  normalizeFaviconEnhancedFetchEnabled(value: unknown): boolean;
  renderShortcuts(): void;
  setSiteSearchPrefix: SearchModeController['setSiteSearchPrefix'];
  getImmediateThemeForSuggestion(suggestion: { provider: SiteSearchProvider }): InputModeTheme;
  pageState: SearchSettingsSyncState;
}

function createSearchSettingsSync(deps: SearchSettingsSyncDeps): void {
  const {
    searchEngine,
    storageChanges,
    SEARCH_RESULT_PRIORITY_STORAGE_KEY,
    normalizeSearchResultPriority,
    SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY,
    normalizeEnabledSearchResultSourceTypes,
    clearLocalSearchScope,
    SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY,
    normalizeSearchResultDisplayLimit,
    renderSuggestions,
    NEWTAB_OPEN_IN_NEW_TAB_STORAGE_KEY,
    SETTINGS,
    NUMBER_SHORTCUT_INSTANT_ENABLED_STORAGE_KEY,
    normalizeNumberShortcutInstantEnabled,
    SUGGESTION_NAVIGATION,
    MACOS_CTRL_SUGGESTION_NAVIGATION_ENABLED_STORAGE_KEY,
    normalizeMacosCtrlSuggestionNavigationEnabled,
    SIMPLE_MODE_ENABLED_STORAGE_KEY,
    normalizeSimpleModeEnabled,
    OVERLAY_TAB_PRIORITY_STORAGE_KEY,
    normalizeOverlayTabPriorityMode,
    requestSuggestions,
    SEARCH_BLACKLIST_STORAGE_KEY,
    normalizeSearchBlacklistItems,
    markRecentDataDirty,
    scheduleRecentReloadIfVisible,
    FAVICON_REQUEST_BLACKLIST_STORAGE_KEY,
    normalizeFaviconRequestBlacklistItems,
    scheduleBookmarkReloadIfVisible,
    refreshThemeAwareFavicons,
    FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY,
    normalizeFaviconEnhancedFetchEnabled,
    renderShortcuts,
    setSiteSearchPrefix,
    getImmediateThemeForSuggestion
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  storageChanges.on(SEARCH_RESULT_PRIORITY_STORAGE_KEY, (changes) => {
    pageState.searchResultPriorityMode = normalizeSearchResultPriority(changes[SEARCH_RESULT_PRIORITY_STORAGE_KEY].newValue);
  });
  storageChanges.on(SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY, (changes) => {
    pageState.enabledSearchResultSourceTypes = normalizeEnabledSearchResultSourceTypes(
      changes[SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY].newValue
    );
    if (pageState.localSearchScopeState &&
        !pageState.enabledSearchResultSourceTypes.includes(pageState.localSearchScopeState.sourceType)) {
      clearLocalSearchScope();
    }
  });
  storageChanges.on(SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY, (changes) => {
    pageState.searchResultDisplayLimit = normalizeSearchResultDisplayLimit(
      changes[SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY].newValue
    );
    if (pageState.latestQuery) {
      renderSuggestions(pageState.lastSuggestionResponse, pageState.latestQuery);
    }
  });
  storageChanges.on(NEWTAB_OPEN_IN_NEW_TAB_STORAGE_KEY, (changes) => {
    pageState.newtabOpenInNewTab = SETTINGS.newtabOpenInNewTab.parse(
      changes[NEWTAB_OPEN_IN_NEW_TAB_STORAGE_KEY].newValue
    );
  });
  storageChanges.on(NUMBER_SHORTCUT_INSTANT_ENABLED_STORAGE_KEY, (changes) => {
    pageState.numberShortcutInstantEnabled = normalizeNumberShortcutInstantEnabled(
      changes[NUMBER_SHORTCUT_INSTANT_ENABLED_STORAGE_KEY].newValue
    );
    SUGGESTION_NAVIGATION.cancelNumberShortcuts(pageState.suggestionsContainer);
  });
  storageChanges.on(MACOS_CTRL_SUGGESTION_NAVIGATION_ENABLED_STORAGE_KEY, (changes) => {
    pageState.macosCtrlSuggestionNavigationEnabled = normalizeMacosCtrlSuggestionNavigationEnabled(
      changes[MACOS_CTRL_SUGGESTION_NAVIGATION_ENABLED_STORAGE_KEY].newValue
    );
  });
  storageChanges.on(SIMPLE_MODE_ENABLED_STORAGE_KEY, (changes) => {
    pageState.simpleModeEnabled = normalizeSimpleModeEnabled(
      changes[SIMPLE_MODE_ENABLED_STORAGE_KEY].newValue
    );
    if (pageState.latestQuery) {
      renderSuggestions(pageState.lastSuggestionResponse, pageState.latestQuery);
    }
  });
  storageChanges.on(OVERLAY_TAB_PRIORITY_STORAGE_KEY, (changes) => {
    pageState.openTabQuickSwitchEnabled = normalizeOverlayTabPriorityMode(changes[OVERLAY_TAB_PRIORITY_STORAGE_KEY].newValue);
    if (pageState.latestQuery) {
      requestSuggestions(pageState.latestQuery, { immediate: true });
    }
  });
  storageChanges.on(SEARCH_BLACKLIST_STORAGE_KEY, (changes) => {
    pageState.searchBlacklistItems = normalizeSearchBlacklistItems(changes[SEARCH_BLACKLIST_STORAGE_KEY].newValue);
    markRecentDataDirty();
    scheduleRecentReloadIfVisible();
  });
  storageChanges.on(FAVICON_REQUEST_BLACKLIST_STORAGE_KEY, (changes) => {
    pageState.faviconRequestBlacklistItems = normalizeFaviconRequestBlacklistItems(changes[FAVICON_REQUEST_BLACKLIST_STORAGE_KEY].newValue);
    markRecentDataDirty();
    scheduleRecentReloadIfVisible();
    scheduleBookmarkReloadIfVisible();
    if (refreshThemeAwareFavicons) {
      refreshThemeAwareFavicons();
    }
  });
  storageChanges.on(FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY, (changes) => {
    pageState.faviconEnhancedFetchEnabled = normalizeFaviconEnhancedFetchEnabled(
      changes[FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY].newValue
    );
    markRecentDataDirty();
    scheduleRecentReloadIfVisible();
    scheduleBookmarkReloadIfVisible();
    if (refreshThemeAwareFavicons) {
      refreshThemeAwareFavicons();
    }
  });
  storageChanges.on([FAVICON_REQUEST_BLACKLIST_STORAGE_KEY, FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY], () => {
    pageState.shortcutFaviconPolicyRevision += 1;
    renderShortcuts();
    if (pageState.inputModeController) {
      if (pageState.siteSearchState) {
        setSiteSearchPrefix(pageState.siteSearchState, getImmediateThemeForSuggestion({ provider: pageState.siteSearchState }), { animate: false });
      }
      pageState.inputModeController.refreshModeMenu();
    }
  });
  // These settings change which suggestions show, so they refresh at once.
  const refreshSuggestions = () => {
    if (pageState.latestQuery && pageState.latestQuery.trim()) {
      requestSuggestions(pageState.latestQuery, { immediate: true });
    }
  };
  searchEngine.store.subscribe(refreshSuggestions);
  storageChanges.on([
    SEARCH_RESULT_PRIORITY_STORAGE_KEY,
    SEARCH_RESULT_SOURCE_TYPES_STORAGE_KEY,
    SEARCH_BLACKLIST_STORAGE_KEY,
    FAVICON_REQUEST_BLACKLIST_STORAGE_KEY,
    FAVICON_ENHANCED_FETCH_ENABLED_STORAGE_KEY
  ], refreshSuggestions);
}

export { createSearchSettingsSync };
export type { SearchSettingsSyncDeps, SearchSettingsSyncState };
