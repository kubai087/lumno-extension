// Keeps an open New Tab in step with settings changed elsewhere (Settings,
// another tab, sync): one listener per storage key on the shared change
// registry, and the runtime messages that ask the page to refresh a section.
import * as ShortcutIconCache from '../domain/favicon/shortcut-favicon/persisted';
import type { SiteSearchIconCache } from '../shared/search/site-search-icon-cache';
import type * as ProgressHistory from '../domain/progress-history';
import type { ProgressHistoryMap } from '../domain/progress-history';
import type { SiteSearchProvider } from '../domain/search/types';
import type * as LumnoSettings from '../domain/settings';
import type { FolderBindingRuntime } from '../platform/bookmark-folder-bindings';
import type { ThemeVariant } from '../shared/favicon/favicon-theme';
import type { InputModeController } from '../shared/search/search-input-mode';
import type { BookmarkDisplaySettings } from './bookmarks/bookmark-display-settings';
import type * as BookmarkFolderIcon from './bookmarks/bookmark-folder-icon';
import type { FolderColorRefs } from './bookmarks/bookmark-folder-icon';
import type { FolderColors } from './bookmarks/folder-colors';
import type { BookmarksViewController } from './react/bookmarks';
import type { RecentHistoryDialogController } from './react/recent-history-dialog';
import type { RecentSitesController } from './recent/recent-sites-controller';
import type { SearchModeController } from './search/search-mode-controller';
import type { SuggestionsController } from './search/suggestions-controller';
import type { SectionHeaders } from './section-headers';
import type { SectionLoaders } from './section-loaders';
import type * as ShortcutIconStore from './shortcuts/shortcut-icon-store';
import type { ShortcutIconMap } from './shortcuts/shortcut-icon-store';
import type { ShortcutsController } from './shortcuts/shortcuts-controller';
import * as LumnoNewtabStorageChangeRegistry from './storage-change-registry';
import type { SiteThemeResolver } from './theme/site-theme-resolver';
import type { WallpaperRuntime } from './wallpaper/wallpaper';
import { shortcutFolderBindings } from '../domain/settings/newtab-shortcuts';
import { bingDailyCache } from '../domain/settings/newtab-wallpaper';
import { progressHistory } from '../domain/settings/recent-sites';
import type { CachedIconMap } from '../domain/favicon/shortcut-favicon/types';
import type { HiddenRecentSite, RecentSite } from '../domain/recent-sites-store';
import * as ProviderStorage from '../platform/provider-storage';
import { tabRankScoreDebug } from '../domain/settings/search';
import type { SettingsStore } from '../platform/settings-store';

interface SettingsSyncState {
  bookmarkCurrentPage: number;
  bookmarksView: Pick<BookmarksViewController, 'setFolderIconsVisible'> | null;
  folderColorRefs: FolderColorRefs;
  pinnedRecentSites: RecentSite[];
  hiddenRecentSites: HiddenRecentSite[];
  recentSourceItems: RecentSite[];
  recentRenderSignature: string;
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
  wallpaperRuntime: Pick<WallpaperRuntime, 'handleStorageChange'> | null;
}

interface SettingsSyncDeps extends
  Pick<SectionLoaders,
    'markBookmarkDataDirty' | 'loadBookmarks' | 'markRecentDataDirty' | 'loadRecentSites' | 'renderRecentSites'>,
  Pick<BookmarkDisplaySettings,
    'normalizeBookmarkViewMode' | 'shouldRepairBookmarkViewModeStorageValue' | 'persistBookmarkViewMode'>,
  Pick<SectionHeaders, 'applyBookmarkViewMode'>,
  Pick<RecentSitesController, 'normalizePinnedRecentSites' | 'normalizeHiddenRecentSites'>,
  Pick<ShortcutsController, 'renderShortcuts' | 'isShortcutSyncStorageActive' | 'scheduleShortcutStorageReload'>,
  Pick<FolderColors, 'syncFolderColorsWithBookmarks'>,
  Pick<SearchModeController, 'setSiteSearchPrefix'>,
  Pick<SiteThemeResolver, 'getThemeForProvider'>,
  Pick<SuggestionsController, 'requestSuggestions' | 'requestTabsAndRender'> {
  settings: Pick<SettingsStore, 'subscribe'>;
  registerBookmarkDisplayStorageChanges: BookmarkDisplaySettings['registerStorageChangeHandlers'];
  settingsRuntimeApi: Pick<typeof LumnoSettings,
    'assetRevision' | 'progressTrackingEnabled' | 'progressTrackingEnabled'>;
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
  BOOKMARK_VIEW_MODE_STORAGE_KEY: string;
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
    markBookmarkDataDirty,
    loadBookmarks,
    markRecentDataDirty,
    loadRecentSites,
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
    BOOKMARK_VIEW_MODE_STORAGE_KEY,
    normalizeBookmarkViewMode,
    shouldRepairBookmarkViewModeStorageValue,
    persistBookmarkViewMode,
    applyBookmarkViewMode,
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
  storageChanges.onAny((changes) => {
    if (pageState.wallpaperRuntime) {
    pageState.wallpaperRuntime.handleStorageChange(changes);
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
    storageChanges
  };
}

type SettingsSync = ReturnType<typeof createSettingsSync>;

export { createSettingsSync };
export type { SettingsSync, SettingsSyncDeps, SettingsSyncState };
