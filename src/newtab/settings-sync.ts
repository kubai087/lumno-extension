// Keeps an open New Tab in step with settings changed elsewhere (Settings,
// another tab, sync): one listener per storage key on the shared change
// registry, and the runtime messages that ask the page to refresh a section.
import * as ShortcutIconCache from '../domain/favicon/shortcut-favicon/persisted';
import type { SiteSearchIconCache } from '../shared/search/site-search-icon-cache';
import type * as ProgressHistory from '../domain/progress-history';
import type { ProgressHistoryMap } from '../domain/progress-history';
import type { SiteSearchProvider } from '../domain/search/types';
import type * as LumnoSettings from '../domain/settings';
import type { NewtabWidthMode, ThemeMode } from '../domain/settings';
import type { StorageAreaLike } from '../domain/storage-port';
import type { FolderBindingRuntime } from '../platform/bookmark-folder-bindings';
import type { ThemeVariant } from '../shared/favicon/favicon-theme';
import type { InputModeController } from '../shared/search/search-input-mode';
import type { AppearanceModes } from './appearance-modes';
import type { BookmarkDisplaySettings } from './bookmarks/bookmark-display-settings';
import type * as BookmarkFolderIcon from './bookmarks/bookmark-folder-icon';
import type { FolderColorRefs } from './bookmarks/bookmark-folder-icon';
import type { BookmarkPager } from './bookmarks/bookmark-pager';
import type { FolderColors } from './bookmarks/folder-colors';
import type { ModeCommands } from './mode-commands';
import type { NewtabThemeMode, NewtabThemeScope } from './newtab-types';
import type { PageLayout } from './page-layout';
import type { PagePreferences } from './page-preferences';
import type { BookmarksViewController } from './react/bookmarks';
import type { RecentHistoryDialogController } from './react/recent-history-dialog';
import type { RecentSitesController } from './recent/recent-sites-controller';
import type { SearchBoxControls } from './search/search-box-controls';
import type { SearchModeController } from './search/search-mode-controller';
import type { SuggestionsController } from './search/suggestions-controller';
import type { SectionHeaders } from './section-headers';
import type { SectionLoaders } from './section-loaders';
import type { ShortcutDock } from './shortcuts/shortcut-dock';
import type * as ShortcutIconStore from './shortcuts/shortcut-icon-store';
import type { ShortcutIconMap } from './shortcuts/shortcut-icon-store';
import type { ShortcutsController } from './shortcuts/shortcuts-controller';
import * as LumnoNewtabStorageChangeRegistry from './storage-change-registry';
import type { GlassSurfaces } from './theme/glass-surfaces';
import type { SiteThemeResolver } from './theme/site-theme-resolver';
import type { WallpaperRuntime } from './wallpaper/wallpaper';
import type { WallpaperPage } from './wallpaper/wallpaper-page';
import { shortcutFolderBindings } from '../domain/settings/newtab-shortcuts';
import { bingDailyCache } from '../domain/settings/newtab-wallpaper';
import { progressHistory } from '../domain/settings/recent-sites';
import type { CachedIconMap } from '../domain/favicon/shortcut-favicon/types';
import type { HiddenRecentSite, RecentSite } from '../domain/recent-sites-store';
import * as ProviderStorage from '../platform/provider-storage';
import * as SettingsStorage from '../platform/settings-storage';
import { tabRankScoreDebug } from '../domain/settings/search';
import type { SettingsStore } from '../platform/settings-store';

interface SettingsSyncState {
  currentBookmarkCount: number;
  currentBookmarkColumns: number;
  bookmarkCurrentPage: number;
  bookmarkFolderIconsVisible: boolean;
  bookmarksView: Pick<BookmarksViewController, 'setFolderIconsVisible'> | null;
  folderColorRefs: FolderColorRefs;
  currentRecentCount: number;
  currentRecentMode: string;
  pinnedRecentSites: RecentSite[];
  hiddenRecentSites: HiddenRecentSite[];
  recentSourceItems: RecentSite[];
  recentRenderSignature: string;
  progressTrackingEnabled: boolean;
  progressHistoryMap: ProgressHistoryMap;
  recentHistoryDialogController: Pick<RecentHistoryDialogController, 'close'> | null;
  newtabShortcutIcons: ShortcutIconMap;
  newtabShortcutFavicons: CachedIconMap;
  // Favicons fetched on this page and not stored yet.
  shortcutFaviconPendingCacheEntries: CachedIconMap;
  shortcutPersistenceInFlightCount: number;
  siteSearchState: SiteSearchProvider | null;
  inputModeController: Pick<InputModeController, 'refreshModeMenu'> | null;
  latestQuery: string;
  wallpaperRuntime: Pick<WallpaperRuntime, 'handleStorageChange' | 'updateSearchWidthUi'> | null;
  globalThemeMode: ThemeMode;
  newtabThemeMode: NewtabThemeMode;
  newtabThemeScope: NewtabThemeScope;
  newtabInputAutoFocusEnabled: boolean;
  currentNewtabWidthMode: NewtabWidthMode;
  currentNewtabSearchWidth: number | null;
  newtabFeedbackButtonVisible: boolean;
  newtabAppearanceButtonVisible: boolean;
  zenModeEnabled: boolean;
  newtabShortcutsVisible: boolean;
  newtabShortcutAddVisible: boolean;
  newtabShortcutDockMagnificationEnabled: boolean;
  newtabShortcutColumns: number;
  newtabShortcutSize: number;
  newtabShortcutGap: number;
}

interface SettingsSyncDeps extends
  Pick<PagePreferences,
    'normalizeBookmarkCount' | 'normalizeBookmarkColumns' | 'getBookmarkLimit' | 'normalizeBookmarkFolderIconsVisible' |
    'normalizeNewtabInputAutoFocusEnabled' | 'updateNewtabInputAutoFocusUi' | 'normalizeNewtabWidthMode' |
    'normalizeNewtabSearchWidth' | 'normalizeNewtabFeedbackButtonVisible' |
    'normalizeNewtabAppearanceButtonVisible' | 'normalizeZenModeEnabled' | 'normalizeNewtabShortcutsVisible' |
    'updateNewtabShortcutPreferencesUi' | 'normalizeNewtabShortcutAddVisible' |
    'normalizeNewtabShortcutDockMagnificationEnabled' | 'normalizeNewtabShortcutColumns' |
    'normalizeNewtabShortcutSize' | 'normalizeNewtabShortcutGap'>,
  Pick<SectionLoaders,
    'markBookmarkDataDirty' | 'loadBookmarks' | 'markRecentDataDirty' | 'loadRecentSites' | 'renderRecentSites'>,
  Pick<PageLayout,
    'keepBookmarkPageAnchorAfterLimitChange' | 'applyBookmarkGridColumns' | 'updateBookmarkSectionPosition' |
    'normalizeRecentCount' | 'normalizeRecentMode' | 'applyNewtabWidthMode' | 'applyRecentGridColumns' |
    'updateNewtabSearchWidthLayout' | 'applyNewtabShortcutsVisibility' | 'applyNewtabShortcutColumns' |
    'applyNewtabShortcutLayoutPreferences'>,
  Pick<BookmarkPager, 'renderCurrentBookmarkPage' | 'updateBookmarkGridHeightLock'>,
  Pick<BookmarkDisplaySettings,
    'normalizeBookmarkViewMode' | 'shouldRepairBookmarkViewModeStorageValue' | 'persistBookmarkViewMode'>,
  Pick<SectionHeaders, 'updateRecentModeMenu' | 'applyBookmarkViewMode'>,
  Pick<RecentSitesController, 'normalizePinnedRecentSites' | 'normalizeHiddenRecentSites'>,
  Pick<ShortcutsController, 'renderShortcuts' | 'isShortcutSyncStorageActive' | 'scheduleShortcutStorageReload'>,
  Pick<ShortcutDock, 'applyNewtabShortcutDockMagnification'>,
  Pick<FolderColors, 'syncFolderColorsWithBookmarks'>,
  Pick<SearchModeController, 'setSiteSearchPrefix'>,
  Pick<SiteThemeResolver, 'getThemeForProvider'>,
  Pick<SuggestionsController, 'requestSuggestions' | 'requestTabsAndRender'>,
  Pick<AppearanceModes,
    'normalizeThemeMode' | 'isNewtabThemeFollowingGlobal' | 'applyScopedThemeMode' | 'normalizeNewtabThemeMode' |
    'normalizeNewtabThemeScope' | 'applyLanguageMode'>,
  Pick<WallpaperPage, 'updateWallpaperAppearanceSelectionUi' | 'updateWallpaperLanguageStrings'>,
  Pick<ModeCommands, 'updateModeCommandSuggestions' | 'updateZenCommandSuggestions' | 'applyZenMode'>,
  Pick<GlassSurfaces, 'applyNewtabGlassStyle' | 'applyNewtabGlassTheme'>,
  Pick<SearchBoxControls, 'applyNewtabActionButtonVisibility'> {
  settings: Pick<SettingsStore, 'subscribe'>;
  registerBookmarkDisplayStorageChanges: BookmarkDisplaySettings['registerStorageChangeHandlers'];
  settingsRuntimeApi: Pick<typeof LumnoSettings,
    'assetRevision' | 'progressTrackingEnabled' | 'progressTrackingEnabled'>;
  storageArea: StorageAreaLike | null;
  // Whether changes in this storage area are this page's settings.
  isPrimaryStorageAreaName(areaName: string): boolean;
  shortcutFolderRuntime: Pick<FolderBindingRuntime, 'accept'>;
  NEWTAB_BOOKMARK_FOLDER_ICON: Pick<typeof BookmarkFolderIcon, 'normalizeFolderColorRefs'>;
  NEWTAB_SHORTCUT_ICON_STORE: Pick<typeof ShortcutIconStore, 'normalizeIconMap'>;
  defaultTheme: ThemeVariant;
  PROGRESS_HISTORY: Pick<typeof ProgressHistory, 'normalizeHistoryMap'>;
  NEWTAB_SHORTCUTS_STORAGE_KEYS: readonly string[];
  FOLDER_COLOR_REFS_STORAGE_KEY: string;
  NEWTAB_SHORTCUT_ICONS_STORAGE_KEY: string;
  NEWTAB_SHORTCUT_FAVICON_CACHE_STORAGE_KEY: string;
  siteSearchIconCache: Pick<SiteSearchIconCache, 'storageKey' | 'applyStored'>;
  NEWTAB_SHORTCUTS_LOCAL_OVERFLOW_STORAGE_KEY: string;
  NEWTAB_LOCAL_WALLPAPER_STORAGE_KEY: string;
  THEME_STORAGE_KEY: string;
  NEWTAB_THEME_MODE_STORAGE_KEY: string;
  NEWTAB_THEME_SCOPE_STORAGE_KEY: string;
  LANGUAGE_STORAGE_KEY: string;
  NEWTAB_INPUT_AUTO_FOCUS_ENABLED_STORAGE_KEY: string;
  RECENT_COUNT_STORAGE_KEY: string;
  NEWTAB_WIDTH_MODE_STORAGE_KEY: string;
  NEWTAB_SEARCH_WIDTH_STORAGE_KEY: string;
  NEWTAB_GLASS_STYLE_STORAGE_KEY: string;
  NEWTAB_GLASS_THEME_STORAGE_KEY: string;
  NEWTAB_FEEDBACK_BUTTON_VISIBLE_STORAGE_KEY: string;
  NEWTAB_APPEARANCE_BUTTON_VISIBLE_STORAGE_KEY: string;
  NEWTAB_ZEN_MODE_STORAGE_KEY: string;
  NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY: string;
  NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY: string;
  NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY: string;
  NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY: string;
  NEWTAB_SHORTCUT_SIZE_STORAGE_KEY: string;
  NEWTAB_SHORTCUT_GAP_STORAGE_KEY: string;
  RECENT_MODE_STORAGE_KEY: string;
  BOOKMARK_VIEW_MODE_STORAGE_KEY: string;
  BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY: string;
  BOOKMARK_COUNT_STORAGE_KEY: string;
  BOOKMARK_COLUMNS_STORAGE_KEY: string;
  PINNED_RECENT_SITES_STORAGE_KEY: string;
  HIDDEN_RECENT_SITES_STORAGE_KEY: string;
  pageState: SettingsSyncState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function createSettingsSync(deps: SettingsSyncDeps) {
  const {
    settings,
    normalizeBookmarkCount,
    markBookmarkDataDirty,
    loadBookmarks,
    normalizeBookmarkColumns,
    getBookmarkLimit,
    keepBookmarkPageAnchorAfterLimitChange,
    applyBookmarkGridColumns,
    renderCurrentBookmarkPage,
    updateBookmarkGridHeightLock,
    updateBookmarkSectionPosition,
    normalizeBookmarkFolderIconsVisible,
    normalizeRecentCount,
    markRecentDataDirty,
    loadRecentSites,
    storageArea,
    isPrimaryStorageAreaName,
    shortcutFolderRuntime,
    renderShortcuts,
    FOLDER_COLOR_REFS_STORAGE_KEY,
    NEWTAB_BOOKMARK_FOLDER_ICON,
    syncFolderColorsWithBookmarks,
    NEWTAB_SHORTCUT_ICONS_STORAGE_KEY,
    NEWTAB_SHORTCUT_ICON_STORE,
    NEWTAB_SHORTCUT_FAVICON_CACHE_STORAGE_KEY,
    siteSearchIconCache,
    setSiteSearchPrefix,
    defaultTheme,
    getThemeForProvider,
    requestSuggestions,
    NEWTAB_SHORTCUTS_LOCAL_OVERFLOW_STORAGE_KEY,
    isShortcutSyncStorageActive,
    scheduleShortcutStorageReload,
    registerBookmarkDisplayStorageChanges,
    PROGRESS_HISTORY,
    NEWTAB_LOCAL_WALLPAPER_STORAGE_KEY,
    settingsRuntimeApi,
    THEME_STORAGE_KEY,
    normalizeThemeMode,
    isNewtabThemeFollowingGlobal,
    applyScopedThemeMode,
    updateWallpaperAppearanceSelectionUi,
    updateModeCommandSuggestions,
    NEWTAB_THEME_MODE_STORAGE_KEY,
    normalizeNewtabThemeMode,
    NEWTAB_THEME_SCOPE_STORAGE_KEY,
    normalizeNewtabThemeScope,
    updateWallpaperLanguageStrings,
    LANGUAGE_STORAGE_KEY,
    applyLanguageMode,
    NEWTAB_INPUT_AUTO_FOCUS_ENABLED_STORAGE_KEY,
    normalizeNewtabInputAutoFocusEnabled,
    updateNewtabInputAutoFocusUi,
    RECENT_COUNT_STORAGE_KEY,
    NEWTAB_WIDTH_MODE_STORAGE_KEY,
    normalizeNewtabWidthMode,
    applyNewtabWidthMode,
    applyRecentGridColumns,
    NEWTAB_SEARCH_WIDTH_STORAGE_KEY,
    normalizeNewtabSearchWidth,
    updateNewtabSearchWidthLayout,
    NEWTAB_GLASS_STYLE_STORAGE_KEY,
    applyNewtabGlassStyle,
    NEWTAB_GLASS_THEME_STORAGE_KEY,
    applyNewtabGlassTheme,
    NEWTAB_FEEDBACK_BUTTON_VISIBLE_STORAGE_KEY,
    normalizeNewtabFeedbackButtonVisible,
    applyNewtabActionButtonVisibility,
    NEWTAB_APPEARANCE_BUTTON_VISIBLE_STORAGE_KEY,
    normalizeNewtabAppearanceButtonVisible,
    NEWTAB_ZEN_MODE_STORAGE_KEY,
    normalizeZenModeEnabled,
    applyZenMode,
    updateZenCommandSuggestions,
    NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY,
    normalizeNewtabShortcutsVisible,
    applyNewtabShortcutsVisibility,
    updateNewtabShortcutPreferencesUi,
    NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY,
    normalizeNewtabShortcutAddVisible,
    NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY,
    normalizeNewtabShortcutDockMagnificationEnabled,
    applyNewtabShortcutDockMagnification,
    NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY,
    normalizeNewtabShortcutColumns,
    applyNewtabShortcutColumns,
    NEWTAB_SHORTCUT_SIZE_STORAGE_KEY,
    normalizeNewtabShortcutSize,
    applyNewtabShortcutLayoutPreferences,
    NEWTAB_SHORTCUT_GAP_STORAGE_KEY,
    normalizeNewtabShortcutGap,
    RECENT_MODE_STORAGE_KEY,
    normalizeRecentMode,
    updateRecentModeMenu,
    BOOKMARK_VIEW_MODE_STORAGE_KEY,
    normalizeBookmarkViewMode,
    shouldRepairBookmarkViewModeStorageValue,
    persistBookmarkViewMode,
    applyBookmarkViewMode,
    BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY,
    BOOKMARK_COUNT_STORAGE_KEY,
    BOOKMARK_COLUMNS_STORAGE_KEY,
    requestTabsAndRender,
    PINNED_RECENT_SITES_STORAGE_KEY,
    normalizePinnedRecentSites,
    renderRecentSites,
    HIDDEN_RECENT_SITES_STORAGE_KEY,
    normalizeHiddenRecentSites,
    NEWTAB_SHORTCUTS_STORAGE_KEYS
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  function addStorageChangeListener(listener: Parameters<typeof ProviderStorage.addStorageChangeListener>[1]) {
    return ProviderStorage.addStorageChangeListener(chrome, listener);
  }

  // Bookmark and site-card preferences arrive from storage (Options page, other tabs) and from
  // the appearance panel, which previews a value here before saving it; an unchanged value
  // leaves the section alone.
  function applyBookmarkCountPreference(value: unknown): void {
    const nextCount = normalizeBookmarkCount(value);
    if (nextCount === pageState.currentBookmarkCount) {
      return;
    }
    pageState.currentBookmarkCount = nextCount;
    pageState.bookmarkCurrentPage = 0;
    markBookmarkDataDirty();
    void loadBookmarks({ force: true });
  }

  function applyBookmarkColumnsPreference(value: unknown): void {
    const nextColumns = normalizeBookmarkColumns(value);
    if (nextColumns === pageState.currentBookmarkColumns) {
      return;
    }
    const previousLimit = getBookmarkLimit();
    pageState.currentBookmarkColumns = nextColumns;
    keepBookmarkPageAnchorAfterLimitChange(previousLimit);
    applyBookmarkGridColumns();
    renderCurrentBookmarkPage();
    updateBookmarkGridHeightLock();
    updateBookmarkSectionPosition();
  }

  function applyBookmarkFolderIconsVisiblePreference(value: unknown): void {
    pageState.bookmarkFolderIconsVisible = normalizeBookmarkFolderIconsVisible(value);
    if (pageState.bookmarksView) {
      pageState.bookmarksView.setFolderIconsVisible(pageState.bookmarkFolderIconsVisible);
    }
  }

  function applyRecentCountPreference(value: unknown): void {
    const nextCount = normalizeRecentCount(value);
    if (nextCount === pageState.currentRecentCount) {
      return;
    }
    pageState.currentRecentCount = nextCount;
    markRecentDataDirty();
    void loadRecentSites({ force: true });
  }

  function setSectionPreference<T>(
    storageKey: string,
    value: T,
    apply: (value: T) => void,
    options?: { persist?: boolean } | null
  ): void {
    apply(value);
    if (options && options.persist === true && storageArea) {
      void storageArea.set({ [storageKey]: value });
    }
  }

  // Every storage change the page reacts to goes through this registry;
  // each part registers the keys it owns (see storage-change-registry.ts).
  const storageChanges = LumnoNewtabStorageChangeRegistry.createStorageChangeRegistry({
    isPrimaryArea: isPrimaryStorageAreaName
  });
  addStorageChangeListener(storageChanges.dispatch);

  storageChanges.on(shortcutFolderBindings.key, (changes) => {
    shortcutFolderRuntime.accept(changes[shortcutFolderBindings.key].newValue);
    renderShortcuts();
  }, { area: 'local' });
  storageChanges.on(FOLDER_COLOR_REFS_STORAGE_KEY, (changes) => {
    pageState.folderColorRefs = NEWTAB_BOOKMARK_FOLDER_ICON.normalizeFolderColorRefs(changes[FOLDER_COLOR_REFS_STORAGE_KEY].newValue);
    void syncFolderColorsWithBookmarks(false).catch(() => {});
  });
  storageChanges.on(NEWTAB_SHORTCUT_ICONS_STORAGE_KEY, (changes) => {
    pageState.newtabShortcutIcons = NEWTAB_SHORTCUT_ICON_STORE.normalizeIconMap(
      changes[NEWTAB_SHORTCUT_ICONS_STORAGE_KEY].newValue
    );
    renderShortcuts();
  }, { area: 'local' });
  storageChanges.on(NEWTAB_SHORTCUT_FAVICON_CACHE_STORAGE_KEY, (changes) => {
    const storedFavicons = changes[NEWTAB_SHORTCUT_FAVICON_CACHE_STORAGE_KEY].newValue;
    pageState.newtabShortcutFavicons = ShortcutIconCache.normalizeCacheMap({
      ...(isRecord(storedFavicons) ? storedFavicons : {}),
      ...pageState.shortcutFaviconPendingCacheEntries
    });
    renderShortcuts();
  }, { area: 'local' });
  storageChanges.on(siteSearchIconCache.storageKey, (changes) => {
    siteSearchIconCache.applyStored(changes[siteSearchIconCache.storageKey].newValue);
    if (pageState.siteSearchState && pageState.inputModeController) {
      const activeProvider = pageState.siteSearchState;
      setSiteSearchPrefix(activeProvider, defaultTheme);
      void getThemeForProvider(activeProvider).then((theme) => {
        if (pageState.siteSearchState === activeProvider) {
          setSiteSearchPrefix(activeProvider, theme);
        }
      }).catch(() => {});
    }
    if (pageState.inputModeController) {
      pageState.inputModeController.refreshModeMenu();
    }
    if (pageState.latestQuery) {
      requestSuggestions(pageState.latestQuery, { immediate: true });
    }
  }, { area: 'local' });
  storageChanges.on(NEWTAB_SHORTCUTS_LOCAL_OVERFLOW_STORAGE_KEY, () => {
    if (isShortcutSyncStorageActive() && pageState.shortcutPersistenceInFlightCount === 0) {
      scheduleShortcutStorageReload();
    }
  }, { area: 'local' });
  registerBookmarkDisplayStorageChanges(storageChanges);
  storageChanges.on(progressHistory.key, (changes) => {
    pageState.progressHistoryMap = PROGRESS_HISTORY.normalizeHistoryMap(changes[progressHistory.key].newValue);
  }, { area: 'local' });
  // With settings in sync, wallpaper files and caches still change in local.
  storageChanges.on([
    NEWTAB_LOCAL_WALLPAPER_STORAGE_KEY,
    settingsRuntimeApi.assetRevision.key,
    bingDailyCache.key
  ], (changes) => {
    if (pageState.wallpaperRuntime) {
      pageState.wallpaperRuntime.handleStorageChange(changes);
    }
  }, { area: (areaName) => areaName === 'local' && !isPrimaryStorageAreaName(areaName) });
  storageChanges.on(THEME_STORAGE_KEY, (changes) => {
    pageState.globalThemeMode = normalizeThemeMode(changes[THEME_STORAGE_KEY].newValue);
    if (isNewtabThemeFollowingGlobal()) {
      applyScopedThemeMode();
    } else {
      updateWallpaperAppearanceSelectionUi();
      updateModeCommandSuggestions();
    }
  });
  storageChanges.on(NEWTAB_THEME_MODE_STORAGE_KEY, (changes) => {
    pageState.newtabThemeMode = normalizeNewtabThemeMode(changes[NEWTAB_THEME_MODE_STORAGE_KEY].newValue);
    applyScopedThemeMode();
  });
  storageChanges.on(NEWTAB_THEME_SCOPE_STORAGE_KEY, (changes) => {
    pageState.newtabThemeScope = normalizeNewtabThemeScope(changes[NEWTAB_THEME_SCOPE_STORAGE_KEY].newValue);
    updateWallpaperLanguageStrings();
    updateModeCommandSuggestions();
  });
  storageChanges.onAny((changes) => {
    if (pageState.wallpaperRuntime) {
    pageState.wallpaperRuntime.handleStorageChange(changes);
    }
  });
  storageChanges.on(LANGUAGE_STORAGE_KEY, (changes) => {
    applyLanguageMode(changes[LANGUAGE_STORAGE_KEY].newValue || 'system');
  });
  storageChanges.on(NEWTAB_INPUT_AUTO_FOCUS_ENABLED_STORAGE_KEY, (changes) => {
    const rawValue = changes[NEWTAB_INPUT_AUTO_FOCUS_ENABLED_STORAGE_KEY].newValue;
    pageState.newtabInputAutoFocusEnabled = normalizeNewtabInputAutoFocusEnabled(rawValue);
    SettingsStorage.cacheNewtabInputAutoFocusEnabled(pageState.newtabInputAutoFocusEnabled);
    updateNewtabInputAutoFocusUi();
  });
  storageChanges.on(RECENT_COUNT_STORAGE_KEY, (changes) => {
    applyRecentCountPreference(changes[RECENT_COUNT_STORAGE_KEY].newValue);
  });
  storageChanges.on(NEWTAB_WIDTH_MODE_STORAGE_KEY, (changes) => {
    const previousBookmarkLimit = getBookmarkLimit();
    const rawMode = changes[NEWTAB_WIDTH_MODE_STORAGE_KEY].newValue;
    const nextMode = normalizeNewtabWidthMode(rawMode);
    pageState.currentNewtabWidthMode = nextMode;
    if (storageArea && rawMode !== nextMode) {
      void storageArea.set({ [NEWTAB_WIDTH_MODE_STORAGE_KEY]: nextMode });
    }
    applyNewtabWidthMode();
    if (pageState.wallpaperRuntime) {
      pageState.wallpaperRuntime.updateSearchWidthUi();
    }
    const recentColumnsChanged = applyRecentGridColumns();
    const bookmarkColumnsChanged = applyBookmarkGridColumns();
    if (recentColumnsChanged) {
      markRecentDataDirty();
      void loadRecentSites({ force: true });
    }
    if (bookmarkColumnsChanged) {
      keepBookmarkPageAnchorAfterLimitChange(previousBookmarkLimit);
      renderCurrentBookmarkPage();
    }
    updateBookmarkGridHeightLock();
    updateBookmarkSectionPosition();
  });
  storageChanges.on(NEWTAB_SEARCH_WIDTH_STORAGE_KEY, (changes) => {
    const rawWidth = changes[NEWTAB_SEARCH_WIDTH_STORAGE_KEY].newValue;
    pageState.currentNewtabSearchWidth = normalizeNewtabSearchWidth(rawWidth, { allowNull: true });
    updateNewtabSearchWidthLayout();
    if (pageState.wallpaperRuntime) {
      pageState.wallpaperRuntime.updateSearchWidthUi();
    }
  });
  storageChanges.on(NEWTAB_GLASS_STYLE_STORAGE_KEY, (changes) => {
    applyNewtabGlassStyle(changes[NEWTAB_GLASS_STYLE_STORAGE_KEY].newValue);
  });
  storageChanges.on(NEWTAB_GLASS_THEME_STORAGE_KEY, (changes) => {
    applyNewtabGlassTheme(changes[NEWTAB_GLASS_THEME_STORAGE_KEY].newValue);
  });
  storageChanges.on(NEWTAB_FEEDBACK_BUTTON_VISIBLE_STORAGE_KEY, (changes) => {
    const raw = changes[NEWTAB_FEEDBACK_BUTTON_VISIBLE_STORAGE_KEY].newValue;
    pageState.newtabFeedbackButtonVisible = normalizeNewtabFeedbackButtonVisible(raw);
    if (storageArea && raw !== pageState.newtabFeedbackButtonVisible) {
      void storageArea.set({
        [NEWTAB_FEEDBACK_BUTTON_VISIBLE_STORAGE_KEY]: pageState.newtabFeedbackButtonVisible
      });
    }
    applyNewtabActionButtonVisibility();
  });
  storageChanges.on(NEWTAB_APPEARANCE_BUTTON_VISIBLE_STORAGE_KEY, (changes) => {
    const raw = changes[NEWTAB_APPEARANCE_BUTTON_VISIBLE_STORAGE_KEY].newValue;
    pageState.newtabAppearanceButtonVisible = normalizeNewtabAppearanceButtonVisible(raw);
    if (storageArea && raw !== pageState.newtabAppearanceButtonVisible) {
      void storageArea.set({
        [NEWTAB_APPEARANCE_BUTTON_VISIBLE_STORAGE_KEY]: pageState.newtabAppearanceButtonVisible
      });
    }
    applyNewtabActionButtonVisibility();
  });
  storageChanges.on(NEWTAB_ZEN_MODE_STORAGE_KEY, (changes) => {
    pageState.zenModeEnabled = normalizeZenModeEnabled(changes[NEWTAB_ZEN_MODE_STORAGE_KEY].newValue);
    applyZenMode();
    updateZenCommandSuggestions();
  });
  storageChanges.on(NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY, (changes) => {
    const raw = changes[NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY].newValue;
    const nextValue = normalizeNewtabShortcutsVisible(raw);
    pageState.newtabShortcutsVisible = nextValue;
    if (storageArea && raw !== nextValue) {
      void storageArea.set({ [NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY]: nextValue });
    }
    applyNewtabShortcutsVisibility();
    updateNewtabShortcutPreferencesUi();
  });
  storageChanges.on(NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY, (changes) => {
    const raw = changes[NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY].newValue;
    const nextValue = normalizeNewtabShortcutAddVisible(raw);
    pageState.newtabShortcutAddVisible = nextValue;
    if (storageArea && raw !== nextValue) {
      void storageArea.set({ [NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY]: nextValue });
    }
    renderShortcuts();
    updateNewtabShortcutPreferencesUi();
  });
  storageChanges.on(NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY, (changes) => {
    const raw = changes[NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY].newValue;
    const nextValue = normalizeNewtabShortcutDockMagnificationEnabled(raw);
    pageState.newtabShortcutDockMagnificationEnabled = nextValue;
    if (storageArea && raw !== nextValue) {
      void storageArea.set({ [NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY]: nextValue });
    }
    applyNewtabShortcutDockMagnification();
    updateNewtabShortcutPreferencesUi();
  });
  storageChanges.on(NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY, (changes) => {
    const raw = changes[NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY].newValue;
    const nextValue = normalizeNewtabShortcutColumns(raw);
    pageState.newtabShortcutColumns = nextValue;
    if (storageArea && raw !== nextValue) {
      void storageArea.set({ [NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY]: nextValue });
    }
    applyNewtabShortcutColumns();
    updateBookmarkSectionPosition({
      preserveSearchEntryLayout: true,
      stabilizeDockDensity: true
    });
    updateNewtabShortcutPreferencesUi();
  });
  storageChanges.on(NEWTAB_SHORTCUT_SIZE_STORAGE_KEY, (changes) => {
    const raw = changes[NEWTAB_SHORTCUT_SIZE_STORAGE_KEY].newValue;
    const nextValue = normalizeNewtabShortcutSize(raw);
    pageState.newtabShortcutSize = nextValue;
    if (storageArea && raw !== nextValue) {
      void storageArea.set({ [NEWTAB_SHORTCUT_SIZE_STORAGE_KEY]: nextValue });
    }
    applyNewtabShortcutLayoutPreferences();
    updateBookmarkSectionPosition({
      preserveSearchEntryLayout: true,
      stabilizeDockDensity: true
    });
    updateNewtabShortcutPreferencesUi();
  });
  storageChanges.on(NEWTAB_SHORTCUT_GAP_STORAGE_KEY, (changes) => {
    const raw = changes[NEWTAB_SHORTCUT_GAP_STORAGE_KEY].newValue;
    const nextValue = normalizeNewtabShortcutGap(raw);
    pageState.newtabShortcutGap = nextValue;
    if (storageArea && raw !== nextValue) {
      void storageArea.set({ [NEWTAB_SHORTCUT_GAP_STORAGE_KEY]: nextValue });
    }
    applyNewtabShortcutLayoutPreferences();
    updateBookmarkSectionPosition({
      preserveSearchEntryLayout: true,
      stabilizeDockDensity: true
    });
    updateNewtabShortcutPreferencesUi();
  });
  storageChanges.on(RECENT_MODE_STORAGE_KEY, (changes) => {
    const nextMode = normalizeRecentMode(changes[RECENT_MODE_STORAGE_KEY].newValue, 'latest');
    if (pageState.currentRecentMode === nextMode) {
      updateRecentModeMenu();
    } else {
      pageState.currentRecentMode = nextMode;
      updateRecentModeMenu();
      markRecentDataDirty();
      void loadRecentSites({ force: true });
    }
  });
  storageChanges.on(BOOKMARK_VIEW_MODE_STORAGE_KEY, (changes) => {
    const rawMode = changes[BOOKMARK_VIEW_MODE_STORAGE_KEY].newValue;
    const nextMode = normalizeBookmarkViewMode(rawMode);
    if (shouldRepairBookmarkViewModeStorageValue(rawMode, nextMode)) {
      persistBookmarkViewMode(nextMode);
    }
    applyBookmarkViewMode(nextMode, { force: true });
  });
  storageChanges.on(BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY, (changes) => {
    const raw = changes[BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY].newValue;
    const nextValue = normalizeBookmarkFolderIconsVisible(raw);
    if (storageArea && raw !== nextValue) {
      void storageArea.set({ [BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY]: nextValue });
    }
    applyBookmarkFolderIconsVisiblePreference(nextValue);
  });
  storageChanges.on(BOOKMARK_COUNT_STORAGE_KEY, (changes) => {
    const raw = changes[BOOKMARK_COUNT_STORAGE_KEY].newValue;
    const nextCount = normalizeBookmarkCount(raw);
    if (storageArea && raw !== nextCount) {
      void storageArea.set({ [BOOKMARK_COUNT_STORAGE_KEY]: nextCount });
    }
    applyBookmarkCountPreference(nextCount);
  });
  storageChanges.on(BOOKMARK_COLUMNS_STORAGE_KEY, (changes) => {
    const raw = changes[BOOKMARK_COLUMNS_STORAGE_KEY].newValue;
    const nextColumns = normalizeBookmarkColumns(raw);
    if (storageArea && raw !== nextColumns) {
      void storageArea.set({ [BOOKMARK_COLUMNS_STORAGE_KEY]: nextColumns });
    }
    applyBookmarkColumnsPreference(nextColumns);
  });
  settings.subscribe(tabRankScoreDebug, () => {
    if (!pageState.latestQuery || !pageState.latestQuery.trim()) {
      requestTabsAndRender();
    }
  });
  storageChanges.on(PINNED_RECENT_SITES_STORAGE_KEY, (changes) => {
    pageState.pinnedRecentSites = normalizePinnedRecentSites(changes[PINNED_RECENT_SITES_STORAGE_KEY].newValue);
    pageState.recentRenderSignature = '';
    renderRecentSites(pageState.recentSourceItems);
  });
  storageChanges.on(settingsRuntimeApi.progressTrackingEnabled.key, (changes) => {
    pageState.progressTrackingEnabled = settingsRuntimeApi.progressTrackingEnabled.parse(
      changes[settingsRuntimeApi.progressTrackingEnabled.key].newValue
    );
    if (!pageState.progressTrackingEnabled && pageState.recentHistoryDialogController) {
      pageState.recentHistoryDialogController.close({ restoreFocus: false });
    }
    pageState.recentRenderSignature = '';
    renderRecentSites(pageState.recentSourceItems);
  });
  storageChanges.on(HIDDEN_RECENT_SITES_STORAGE_KEY, (changes) => {
    pageState.hiddenRecentSites = normalizeHiddenRecentSites(changes[HIDDEN_RECENT_SITES_STORAGE_KEY].newValue);
    pageState.recentRenderSignature = '';
    renderRecentSites(pageState.recentSourceItems);
  });
  storageChanges.on(NEWTAB_SHORTCUTS_STORAGE_KEYS, () => {
    if (pageState.shortcutPersistenceInFlightCount === 0) {
      scheduleShortcutStorageReload();
    }
  });

  if (chrome && chrome.runtime && chrome.runtime.onMessage && typeof chrome.runtime.onMessage.addListener === 'function') {
    chrome.runtime.onMessage.addListener((message: unknown) => {
      if (!isRecord(message)) {
        return;
      }
      if (message.action !== 'lumno:newtab-refresh-sections') return;
      const section = message.section || 'all';
      if (section === 'recent' || section === 'all') {
        markRecentDataDirty();
        void loadRecentSites({ force: true });
      }
      if (section === 'bookmarks' || section === 'all') {
        markBookmarkDataDirty();
        void loadBookmarks({ force: true });
      }
    });
  }

  return {
    applyBookmarkCountPreference,
    applyBookmarkColumnsPreference,
    applyBookmarkFolderIconsVisiblePreference,
    applyRecentCountPreference,
    setSectionPreference,
    storageChanges
  };
}

type SettingsSync = ReturnType<typeof createSettingsSync>;

export { createSettingsSync };
export type { SettingsSync, SettingsSyncDeps, SettingsSyncState };
