// The page width and the recent and bookmark section settings: drawn once
// read, and again whenever they or a dragged slider's value change.
import type { BookmarkPager } from '../../bookmarks/bookmark-pager';
import type { PageLayout } from '../../page-layout';
import type { SectionLoaders } from './section-loaders';
import type { SettingsStore } from '../../../platform/settings-store';
import { newtabSearchWidth, newtabWidthMode } from '../../../domain/settings/newtab-page';
import { bookmarkColumns, bookmarkCount, bookmarkFolderIconsVisible } from '../../../domain/settings/bookmarks';
import { progressTrackingEnabled, recentCount, recentMode } from '../../../domain/settings/recent-sites';
import type { SettingPreview } from '../../setting-preview';
import type { RecentSitesShown } from '../../recent/recent-sites-shown';
import type { BookmarksShown } from '../../bookmarks/bookmarks-shown';
import type { BookmarkSectionParts } from '../../bookmarks/bookmark-section-parts';

const SECTION_SETTINGS = [recentCount, recentMode, bookmarkCount, bookmarkColumns, bookmarkFolderIconsVisible, progressTrackingEnabled];


interface StartupPreferencesDeps extends
  Pick<PageLayout,
    'getBookmarkLimit' | 'applyNewtabWidthMode' | 'applyRecentGridColumns' |
    'applyBookmarkGridColumns' | 'keepBookmarkPageAnchorAfterLimitChange' | 'updateBookmarkSectionPosition'> {
  settings: Pick<SettingsStore, 'get' | 'include' | 'subscribe'>;
  preview: Pick<SettingPreview, 'get' | 'store'>;
  renderRecentSites: SectionLoaders['renderRecentSites'];
  markRecentDataDirty: SectionLoaders['markRecentDataDirty'];
  loadRecentSites: SectionLoaders['loadRecentSites'];
  renderCurrentBookmarkPage: BookmarkPager['renderCurrentBookmarkPage'];
  updateBookmarkGridHeightLock: BookmarkPager['updateBookmarkGridHeightLock'];
  markBookmarkDataDirty: SectionLoaders['markBookmarkDataDirty'];
  loadBookmarks: SectionLoaders['loadBookmarks'];
  recentShown: Pick<RecentSitesShown, 'forgetSignature' | 'items' | 'loadedOnce'>;
  bookmarksShown: Pick<BookmarksShown, 'loadedOnce' | 'showPage'>;
  bookmarkParts: Pick<BookmarkSectionParts, 'view'>;
}

function createStartupPreferences(deps: StartupPreferencesDeps) {
  const {
    bookmarkParts,
    bookmarksShown,
    recentShown,
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
    markBookmarkDataDirty,
    loadBookmarks
  } = deps;

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
    if (bookmarkColumnsChanged && (!first || bookmarksShown.loadedOnce)) {
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
    if (next.recentCount !== previous.recentCount || next.recentMode !== previous.recentMode ||
        (first && !recentShown.loadedOnce)) {
      markRecentDataDirty();
      void loadRecentSites({ force: !first });
    }
    if (next.progressTrackingEnabled !== previous.progressTrackingEnabled) {
      recentShown.forgetSignature();
      renderRecentSites(recentShown.items);
    }
    if (next.bookmarkFolderIconsVisible !== previous.bookmarkFolderIconsVisible && bookmarkParts.view) {
      bookmarkParts.view.setFolderIconsVisible(next.bookmarkFolderIconsVisible);
    }
    if (next.bookmarkCount !== previous.bookmarkCount || (first && !bookmarksShown.loadedOnce)) {
      if (!first) {
        bookmarksShown.showPage(0);
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
export type { StartupPreferences, StartupPreferencesDeps };
