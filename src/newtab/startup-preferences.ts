// Reads the stored New Tab preferences once at startup (language, clock,
// sections, shortcuts, pinned and hidden recent sites, appearance) and
// applies them before the first reveal.
import type * as ProgressHistory from '../domain/progress-history';
import type { ProgressHistoryMap } from '../domain/progress-history';
import type * as LumnoSettings from '../domain/settings';
import type { StorageAreaLike } from '../domain/storage-port';
import type { BookmarkDisplaySettings } from './bookmarks/bookmark-display-settings';
import type { BookmarkPager } from './bookmarks/bookmark-pager';
import type { PageLayout } from './page-layout';
import type { PagePreferences } from './page-preferences';
import type { BookmarksViewController } from './react/bookmarks';
import type { RecentSitesController } from './recent/recent-sites-controller';
import type { SectionHeaders } from './section-headers';
import type { SectionLoaders } from './section-loaders';
import { progressHistory } from '../domain/settings/recent-sites';
import type { HiddenRecentSite, RecentSite } from '../domain/recent-sites-store';
import * as SettingsStorage from '../platform/settings-storage';
import type { SettingsStore } from '../platform/settings-store';
import { newtabSearchWidth, newtabWidthMode } from '../domain/settings/newtab-page';

interface StartupPreferencesState {
  progressTrackingEnabled: boolean;
  progressHistoryMap: ProgressHistoryMap;
  recentSourceItems: RecentSite[];
  recentRenderSignature: string;
  recentLoadedOnce: boolean;
  pinnedRecentSites: RecentSite[];
  hiddenRecentSites: HiddenRecentSite[];
  // Settle once the stored pinned and hidden recent sites are read.
  initialPinnedRecentSitesReadyTask: Promise<RecentSite[]>;
  initialHiddenRecentSitesReadyTask: Promise<HiddenRecentSite[]>;
  currentRecentCount: number;
  currentRecentMode: string;
  bookmarkLoadedOnce: boolean;
  bookmarkFolderIconsVisible: boolean;
  bookmarksView: Pick<BookmarksViewController, 'setFolderIconsVisible'> | null;
  currentBookmarkCount: number;
  currentBookmarkColumns: number;
}

interface StartupPreferencesDeps extends
  Pick<PagePreferences,
    'getBookmarkLimit' | 'normalizeBookmarkFolderIconsVisible' | 'normalizeBookmarkCount' |
    'normalizeBookmarkColumns'>,
  Pick<RecentSitesController, 'readPinnedRecentSites' | 'readHiddenRecentSites'>,
  Pick<PageLayout,
    'normalizeRecentCount' | 'normalizeRecentMode' | 'applyNewtabWidthMode' | 'applyRecentGridColumns' |
    'applyBookmarkGridColumns' | 'keepBookmarkPageAnchorAfterLimitChange' | 'updateBookmarkSectionPosition'>,
  Pick<BookmarkDisplaySettings,
    'loadInitialBookmarkViewMode' | 'loadInitialBookmarkTopbarSurfaceColors' |
    'loadInitialBookmarkTopbarSurfaceMode'> {
  settings: Pick<SettingsStore, 'get' | 'include' | 'subscribe'>;
  storageArea: StorageAreaLike | null;
  localStorageArea: StorageAreaLike | null;
  settingsRuntimeApi: Pick<typeof LumnoSettings,
    'progressTrackingEnabled' | 'progressTrackingEnabled'>;
  PROGRESS_HISTORY: Pick<typeof ProgressHistory, 'normalizeHistoryMap'>;
  renderRecentSites: SectionLoaders['renderRecentSites'];
  markRecentDataDirty: SectionLoaders['markRecentDataDirty'];
  loadRecentSites: SectionLoaders['loadRecentSites'];
  updateRecentModeMenu: SectionHeaders['updateRecentModeMenu'];
  renderCurrentBookmarkPage: BookmarkPager['renderCurrentBookmarkPage'];
  updateBookmarkGridHeightLock: BookmarkPager['updateBookmarkGridHeightLock'];
  markBookmarkDataDirty: SectionLoaders['markBookmarkDataDirty'];
  loadBookmarks: SectionLoaders['loadBookmarks'];
  RECENT_COUNT_STORAGE_KEY: string;
  RECENT_MODE_STORAGE_KEY: string;
  BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY: string;
  BOOKMARK_COUNT_STORAGE_KEY: string;
  BOOKMARK_COLUMNS_STORAGE_KEY: string;
  pageState: StartupPreferencesState;
}

function createStartupPreferences(deps: StartupPreferencesDeps) {
  const {
    settings,
    storageArea,
    settingsRuntimeApi,
    renderRecentSites,
    localStorageArea,
    PROGRESS_HISTORY,
    readPinnedRecentSites,
    readHiddenRecentSites,
    RECENT_COUNT_STORAGE_KEY,
    normalizeRecentCount,
    markRecentDataDirty,
    loadRecentSites,
    getBookmarkLimit,
    applyNewtabWidthMode,
    applyRecentGridColumns,
    applyBookmarkGridColumns,
    keepBookmarkPageAnchorAfterLimitChange,
    renderCurrentBookmarkPage,
    updateBookmarkGridHeightLock,
    updateBookmarkSectionPosition,
    RECENT_MODE_STORAGE_KEY,
    normalizeRecentMode,
    updateRecentModeMenu,
    loadInitialBookmarkViewMode,
    loadInitialBookmarkTopbarSurfaceColors,
    loadInitialBookmarkTopbarSurfaceMode,
    BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY,
    normalizeBookmarkFolderIconsVisible,
    BOOKMARK_COUNT_STORAGE_KEY,
    normalizeBookmarkCount,
    markBookmarkDataDirty,
    loadBookmarks,
    BOOKMARK_COLUMNS_STORAGE_KEY,
    normalizeBookmarkColumns
  } = deps;
  // Writes the normalized value back for a missing or invalid stored one,
  // leaving a missing one alone while this device's local copy migrates in.
  const repairStoredSetting = (key: string, stored: unknown, value: unknown): void => {
    if (stored !== value) {
      SettingsStorage.writeSettingRepairs(chrome, storageArea, { [key]: value }, { [key]: stored });
    }
  };

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  // A new width moves the recent and bookmark grids: the recent sites load
  // again for the new column count, and the bookmarks keep their page.
  let shownWidthMode = settings.get(newtabWidthMode);
  function applyWidthMode(first: boolean): void {
    const previousBookmarkLimit = getBookmarkLimit();
    const changed = settings.get(newtabWidthMode) !== shownWidthMode;
    shownWidthMode = settings.get(newtabWidthMode);
    applyNewtabWidthMode();
    const recentColumnsChanged = applyRecentGridColumns();
    const bookmarkColumnsChanged = applyBookmarkGridColumns();
    if ((first && changed) || recentColumnsChanged) {
      markRecentDataDirty();
      loadRecentSites({ force: true });
    }
    if (bookmarkColumnsChanged && (!first || pageState.bookmarkLoadedOnce)) {
      keepBookmarkPageAnchorAfterLimitChange(previousBookmarkLimit);
      renderCurrentBookmarkPage();
    }
    updateBookmarkGridHeightLock();
    updateBookmarkSectionPosition();
  }
  settings.subscribe(newtabWidthMode, () => applyWidthMode(false));
  void settings.include([newtabWidthMode, newtabSearchWidth]).then(() => applyWidthMode(true));

  if (storageArea) {
    void storageArea.get([settingsRuntimeApi.progressTrackingEnabled.key], (result) => {
      pageState.progressTrackingEnabled = settingsRuntimeApi.progressTrackingEnabled.parse(
        result && result[settingsRuntimeApi.progressTrackingEnabled.key]
      );
      if (pageState.progressTrackingEnabled && pageState.recentSourceItems.length > 0) {
        pageState.recentRenderSignature = '';
        renderRecentSites(pageState.recentSourceItems);
      }
    });
    if (localStorageArea) {
      void localStorageArea.get([progressHistory.key], (result) => {
        pageState.progressHistoryMap = PROGRESS_HISTORY.normalizeHistoryMap(result && result[progressHistory.key]);
      });
    }
    pageState.initialPinnedRecentSitesReadyTask = readPinnedRecentSites().then((items) => {
      pageState.pinnedRecentSites = items;
      if (pageState.recentSourceItems.length > 0) {
        pageState.recentRenderSignature = '';
        renderRecentSites(pageState.recentSourceItems);
      }
      return items;
    }).catch(() => {
      pageState.pinnedRecentSites = [];
      return pageState.pinnedRecentSites;
    });
    pageState.initialHiddenRecentSitesReadyTask = readHiddenRecentSites().then((items) => {
      pageState.hiddenRecentSites = items;
      if (pageState.recentSourceItems.length > 0) {
        pageState.recentRenderSignature = '';
        renderRecentSites(pageState.recentSourceItems);
      }
      return items;
    }).catch(() => {
      pageState.hiddenRecentSites = [];
      return pageState.hiddenRecentSites;
    });

    void storageArea.get([RECENT_COUNT_STORAGE_KEY], (result) => {
      if (!result) {
        return;
      }
      const stored = result[RECENT_COUNT_STORAGE_KEY];
      const count = normalizeRecentCount(stored);
      const changed = pageState.currentRecentCount !== count;
      pageState.currentRecentCount = count;
      repairStoredSetting(RECENT_COUNT_STORAGE_KEY, stored, count);
      if (changed || !pageState.recentLoadedOnce) {
        markRecentDataDirty();
        loadRecentSites();
      }
    });
    void storageArea.get([RECENT_MODE_STORAGE_KEY], (result) => {
      if (!result) {
        return;
      }
      const stored = result[RECENT_MODE_STORAGE_KEY];
      const hasStored = stored === 'latest' || stored === 'most';
      const mode = normalizeRecentMode(stored, 'most');
      const changed = pageState.currentRecentMode !== mode;
      pageState.currentRecentMode = mode;
      updateRecentModeMenu();
      if (!hasStored) {
        repairStoredSetting(RECENT_MODE_STORAGE_KEY, stored, mode);
      }
      if (changed || !pageState.recentLoadedOnce) {
        markRecentDataDirty();
        loadRecentSites();
      }
    });
    loadInitialBookmarkViewMode();
    loadInitialBookmarkTopbarSurfaceColors();
    loadInitialBookmarkTopbarSurfaceMode();
    void storageArea.get([BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY], (result) => {
      if (!result) {
        return;
      }
      const raw = result[BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY];
      const nextValue = normalizeBookmarkFolderIconsVisible(raw);
      pageState.bookmarkFolderIconsVisible = nextValue;
      repairStoredSetting(BOOKMARK_FOLDER_ICONS_VISIBLE_STORAGE_KEY, raw, nextValue);
      if (pageState.bookmarksView) {
        pageState.bookmarksView.setFolderIconsVisible(nextValue);
      }
    });
    void storageArea.get([BOOKMARK_COUNT_STORAGE_KEY], (result) => {
      if (!result) {
        return;
      }
      const stored = result[BOOKMARK_COUNT_STORAGE_KEY];
      const count = normalizeBookmarkCount(stored);
      const changed = pageState.currentBookmarkCount !== count;
      pageState.currentBookmarkCount = count;
      repairStoredSetting(BOOKMARK_COUNT_STORAGE_KEY, stored, count);
      if (changed || !pageState.bookmarkLoadedOnce) {
        markBookmarkDataDirty();
        loadBookmarks();
      }
    });
    void storageArea.get([BOOKMARK_COLUMNS_STORAGE_KEY], (result) => {
      if (!result) {
        return;
      }
      const stored = result[BOOKMARK_COLUMNS_STORAGE_KEY];
      const columns = normalizeBookmarkColumns(stored);
      pageState.currentBookmarkColumns = columns;
      repairStoredSetting(BOOKMARK_COLUMNS_STORAGE_KEY, stored, columns);
      applyBookmarkGridColumns();
      updateBookmarkGridHeightLock();
      updateBookmarkSectionPosition();
    });
  }
}

type StartupPreferences = ReturnType<typeof createStartupPreferences>;

export { createStartupPreferences };
export type { StartupPreferences, StartupPreferencesDeps, StartupPreferencesState };
