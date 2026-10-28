// The page width and the recent and bookmark section settings: drawn once
// read, and again whenever they or a dragged slider's value change.
import type { BookmarkPager } from './bookmarks/bookmark-pager';
import type { PageLayout } from './page-layout';
import type { PagePreferences } from './page-preferences';
import type { BookmarksViewController } from './react/bookmarks';
import type { RecentHistoryDialogController } from './react/recent-history-dialog';
import type { SectionHeaders } from './section-headers';
import type { SectionLoaders } from './section-loaders';
import type { RecentSite } from '../domain/recent-sites-store';
import type { SettingsStore } from '../platform/settings-store';
import { newtabSearchWidth, newtabWidthMode } from '../domain/settings/newtab-page';
import { bookmarkColumns, bookmarkCount, bookmarkFolderIconsVisible } from '../domain/settings/bookmarks';
import { progressTrackingEnabled, recentCount, recentMode } from '../domain/settings/recent-sites';
import type { SettingPreview } from './setting-preview';

const SECTION_SETTINGS = [recentCount, recentMode, bookmarkCount, bookmarkColumns, bookmarkFolderIconsVisible, progressTrackingEnabled];

interface StartupPreferencesState {
  recentHistoryDialogController: Pick<RecentHistoryDialogController, 'close'> | null;
  bookmarkCurrentPage: number;
  recentSourceItems: RecentSite[];
  recentRenderSignature: string;
  recentLoadedOnce: boolean;
  bookmarkLoadedOnce: boolean;
  bookmarksView: Pick<BookmarksViewController, 'setFolderIconsVisible'> | null;
}

interface StartupPreferencesDeps extends
  Pick<PagePreferences,
    'getBookmarkLimit'>,
  Pick<PageLayout,
    'applyNewtabWidthMode' | 'applyRecentGridColumns' |
    'applyBookmarkGridColumns' | 'keepBookmarkPageAnchorAfterLimitChange' | 'updateBookmarkSectionPosition'> {
  settings: Pick<SettingsStore, 'get' | 'include' | 'subscribe'>;
  preview: Pick<SettingPreview, 'get' | 'store'>;
  renderRecentSites: SectionLoaders['renderRecentSites'];
  markRecentDataDirty: SectionLoaders['markRecentDataDirty'];
  loadRecentSites: SectionLoaders['loadRecentSites'];
  updateRecentModeMenu: SectionHeaders['updateRecentModeMenu'];
  renderCurrentBookmarkPage: BookmarkPager['renderCurrentBookmarkPage'];
  updateBookmarkGridHeightLock: BookmarkPager['updateBookmarkGridHeightLock'];
  markBookmarkDataDirty: SectionLoaders['markBookmarkDataDirty'];
  loadBookmarks: SectionLoaders['loadBookmarks'];
  pageState: StartupPreferencesState;
}

function createStartupPreferences(deps: StartupPreferencesDeps) {
  const {
    settings,
    preview,
    renderRecentSites,
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
    updateRecentModeMenu,
    markBookmarkDataDirty,
    loadBookmarks
  } = deps;
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

  // The recent and bookmark sections follow their settings and a dragged
  // slider's value: a new count or mode loads the section again, new
  // columns keep the bookmark page in place. Until a section has loaded,
  // the first read loads it.
  let shown = readSectionPreferences();
  function readSectionPreferences() {
    return {
      recentCount: preview.get(recentCount),
      recentMode: settings.get(recentMode),
      bookmarkCount: preview.get(bookmarkCount),
      bookmarkColumns: preview.get(bookmarkColumns),
      bookmarkFolderIconsVisible: preview.get(bookmarkFolderIconsVisible),
      progressTrackingEnabled: settings.get(progressTrackingEnabled)
    };
  }
  function applySectionPreferences(first: boolean): void {
    const previous = shown;
    const next = readSectionPreferences();
    shown = next;
    if (first || next.recentMode !== previous.recentMode) {
      updateRecentModeMenu();
    }
    if (next.recentCount !== previous.recentCount || next.recentMode !== previous.recentMode ||
        (first && !pageState.recentLoadedOnce)) {
      markRecentDataDirty();
      void loadRecentSites({ force: !first });
    }
    if (next.progressTrackingEnabled !== previous.progressTrackingEnabled) {
      if (!next.progressTrackingEnabled && pageState.recentHistoryDialogController) {
        pageState.recentHistoryDialogController.close({ restoreFocus: false });
      }
      pageState.recentRenderSignature = '';
      renderRecentSites(pageState.recentSourceItems);
    }
    if (next.bookmarkFolderIconsVisible !== previous.bookmarkFolderIconsVisible && pageState.bookmarksView) {
      pageState.bookmarksView.setFolderIconsVisible(next.bookmarkFolderIconsVisible);
    }
    if (next.bookmarkCount !== previous.bookmarkCount || (first && !pageState.bookmarkLoadedOnce)) {
      if (!first) {
        pageState.bookmarkCurrentPage = 0;
      }
      markBookmarkDataDirty();
      void loadBookmarks({ force: !first });
    }
    if (first || next.bookmarkColumns !== previous.bookmarkColumns) {
      if (!first) {
        keepBookmarkPageAnchorAfterLimitChange(getBookmarkLimit(previous.bookmarkColumns));
      }
      applyBookmarkGridColumns();
      if (!first) {
        renderCurrentBookmarkPage();
      }
      updateBookmarkGridHeightLock();
      updateBookmarkSectionPosition();
    }
  }
  settings.subscribe(SECTION_SETTINGS, () => applySectionPreferences(false));
  preview.store.subscribe(() => applySectionPreferences(false));
  void settings.include(SECTION_SETTINGS).then(() => applySectionPreferences(true));

}

type StartupPreferences = ReturnType<typeof createStartupPreferences>;

export { createStartupPreferences };
export type { StartupPreferences, StartupPreferencesDeps, StartupPreferencesState };
