// Keeps an open New Tab in step with settings changed elsewhere (Settings,
// another tab, sync): one listener per storage key on the shared change
// registry, and the runtime messages that ask the page to refresh a section.
import type { SiteSearchProvider } from '../domain/search/types';
import type * as LumnoSettings from '../domain/settings';
import type { InputModeController } from '../shared/search/search-input-mode';
import type { BookmarkDisplaySettings } from './bookmarks/bookmark-display-settings';
import type { BookmarksViewController } from './react/bookmarks';
import type { RecentHistoryDialogController } from './react/recent-history-dialog';
import type { SuggestionsController } from './search/suggestions-controller';
import type { SectionLoaders } from './section-loaders';
import type { ShortcutIconMap } from './shortcuts/shortcut-icon-store';
import * as LumnoNewtabStorageChangeRegistry from './storage-change-registry';
import type { WallpaperRuntime } from './wallpaper/wallpaper';
import { bingDailyCache } from '../domain/settings/newtab-wallpaper';
import type { CachedIconMap } from '../domain/favicon/shortcut-favicon/types';
import type { RecentSite } from '../domain/recent-sites-store';
import * as ProviderStorage from '../platform/provider-storage';
import { tabRankScoreDebug } from '../domain/settings/search';
import type { SettingsStore } from '../platform/settings-store';

interface SettingsSyncState {
  bookmarkCurrentPage: number;
  bookmarksView: Pick<BookmarksViewController, 'setFolderIconsVisible'> | null;
  recentSourceItems: RecentSite[];
  recentRenderSignature: string;
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
    'markBookmarkDataDirty' | 'loadBookmarks' | 'markRecentDataDirty' | 'loadRecentSites'>,
  Pick<SuggestionsController, 'requestTabsAndRender'> {
  settings: Pick<SettingsStore, 'subscribe'>;
  registerBookmarkDisplayStorageChanges: BookmarkDisplaySettings['registerStorageChangeHandlers'];
  settingsRuntimeApi: Pick<typeof LumnoSettings,
    'assetRevision' | 'progressTrackingEnabled' | 'progressTrackingEnabled'>;
  // Whether changes in this storage area are this page's settings.
  isPrimaryStorageAreaName(areaName: string): boolean;
  NEWTAB_LOCAL_WALLPAPER_STORAGE_KEY: string;
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
    registerBookmarkDisplayStorageChanges,
    NEWTAB_LOCAL_WALLPAPER_STORAGE_KEY,
    settingsRuntimeApi,
    requestTabsAndRender
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

  registerBookmarkDisplayStorageChanges(storageChanges);
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
  settings.subscribe(tabRankScoreDebug, () => {
    if (!pageState.latestQuery || !pageState.latestQuery.trim()) {
      requestTabsAndRender();
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
