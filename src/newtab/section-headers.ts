// Headings, mode menus, pager labels and breadcrumbs for the bookmark and
// recent-site sections.
import type { SelectMenuOption } from '../shared/react/select-menu/menu-options';
import type { BookmarkCascadeActions } from './bookmarks/bookmark-cascade-actions';
import type { BookmarkCascadeRuntime } from './bookmarks/bookmark-cascade-menu';
import type { BookmarkPathEntry } from './bookmarks/bookmarks-store';
import type { Translate } from './newtab-types';
import type { PageLayout } from './page-layout';
import type { BookmarkHeaderModel } from './react/bookmark-header';
import type { BookmarksTopbarRuntime } from './react/bookmarks-topbar';
import type { SectionLoaders } from './section-loaders';
import type { TooltipBindings } from './tooltip-bindings';
import type { ViewportInsets } from './viewport-insets';
import { newtabZenMode } from '../domain/settings/newtab-page';
import type { SettingsStore } from '../platform/settings-store';
import type { SettingPreview } from './setting-preview';
import { recentMode } from '../domain/settings/recent-sites';
import { bookmarkCount, bookmarkViewMode } from '../domain/settings/bookmarks';
import { BOOKMARK_TOPBAR_HEIGHT_PX } from './react/bookmarks-topbar';

// Matches the id the display mode menu has always had, which tests and styles may name.
const BOOKMARK_MODE_MENU_ID = '_x_extension_newtab_bookmark_mode_2026_unique_';

interface SectionHeadersState {
  recentModeMenu: { update(): void } | null;
  bookmarkGrid: HTMLElement | null;
  bookmarkCascadeRuntime: Pick<BookmarkCascadeRuntime, 'positionLevels' | 'isOpen'> | null;
  bookmarkTopbarRuntime: Pick<BookmarksTopbarRuntime, 'activate' | 'deactivate' | 'setVisible' | 'isActive'> | null;
  // Which pager buttons lead anywhere from the current page.
  bookmarkPagerAvailability: { previous: boolean; next: boolean };
  bookmarkCurrentFolderId: string;
  bookmarkRootFolderId: string;
  bookmarkFolderPath: BookmarkPathEntry[];
  bookmarkCurrentPage: number;
  bookmarkRenderSignature: string;
  bookmarkLoadedOnce: boolean;
}

interface SectionHeadersDeps extends
  Pick<PageLayout, 'updateSearchEntryLayout' | 'setContentSectionVisible'>,
  Pick<BookmarkCascadeActions, 'closeBookmarkCascadeMenu'>,
  Pick<TooltipBindings, 'showTopActionTooltip' | 'hideTopActionTooltip'>,
  Pick<ViewportInsets, 'getNewtabVisualViewportInsets'> {
  preview: Pick<SettingPreview, 'get'>;
  settings: Pick<SettingsStore, 'get' | 'include' | 'set' | 'subscribe'>;
  t: Translate;
  markBookmarkDataDirty: SectionLoaders['markBookmarkDataDirty'];
  loadBookmarks: SectionLoaders['loadBookmarks'];
  bookmarkSection: HTMLElement | null;
  bookmarkCards: readonly HTMLElement[];
  renderBookmarkHeader(model: BookmarkHeaderModel): void;
  getBookmarkModeMenuOptions(): SelectMenuOption[];
  handleBookmarkModeMenuAction(action: string): void;
  goToBookmarkPage(step: -1 | 1): void;
  openBookmarkManager(): void;
  pageState: SectionHeadersState;
}

function createSectionHeaders(deps: SectionHeadersDeps) {
  const {
    preview,
    settings,
    t,
    getNewtabVisualViewportInsets,
    updateSearchEntryLayout,
    setContentSectionVisible,
    bookmarkSection,
    bookmarkCards,
    markBookmarkDataDirty,
    loadBookmarks,
    closeBookmarkCascadeMenu,
    showTopActionTooltip,
    hideTopActionTooltip,
    renderBookmarkHeader,
    getBookmarkModeMenuOptions,
    handleBookmarkModeMenuAction,
    goToBookmarkPage,
    openBookmarkManager
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  const NEWTAB_FLOATING_TOP_GAP_PX = 12;
  const BOOKMARK_CASCADE_TOPBAR_GAP_PX = 4;
  // Matches the floating bar's 8px top offset and 40px height in styles/bookmarks-topbar.css.
  const BOOKMARK_TOPBAR_FLOATING_OCCUPIED_PX = 48;

  function updateRecentModeMenu(): void {
    if (pageState.recentModeMenu) {
      pageState.recentModeMenu.update();
    }
  }

  // The follow in startup-preferences loads the recent sites again.
  function setRecentMode(nextMode: unknown): void {
    void settings.set(recentMode, recentMode.parse(nextMode)).catch(() => {});
    updateRecentModeMenu();
  }

  function canDismissRecentCard(): boolean {
    return true;
  }

  function isBookmarkTopbarMode(): boolean {
    return settings.get(bookmarkViewMode) === 'top';
  }

  function getNewtabTopOccupiedInsetPx(): number {
    const visualViewportTopInset = getNewtabVisualViewportInsets().top;
    const body = document.body;
    const bookmarkTopbarInset = body && body.getAttribute('data-nt-top-occupied') === 'true'
      ? (body.getAttribute('data-nt-top-layout') === 'floating'
        ? BOOKMARK_TOPBAR_FLOATING_OCCUPIED_PX
        : BOOKMARK_TOPBAR_HEIGHT_PX)
      : 0;
    return visualViewportTopInset + bookmarkTopbarInset;
  }

  function getNewtabViewportTopPaddingPx(): number {
    return getNewtabTopOccupiedInsetPx() + Math.min(8, NEWTAB_FLOATING_TOP_GAP_PX);
  }

  function getBookmarkCascadeViewportTopPaddingPx(): number {
    const occupiedTopInset = getNewtabTopOccupiedInsetPx();
    return occupiedTopInset > 0
      ? occupiedTopInset + BOOKMARK_CASCADE_TOPBAR_GAP_PX
      : 8;
  }

  function setNewtabTopOccupied(occupied: unknown): void {
    if (!document.body) {
      return;
    }
    const nextValue = occupied === true ? 'true' : 'false';
    if (document.body.getAttribute('data-nt-top-occupied') === nextValue) {
      return;
    }
    document.body.setAttribute('data-nt-top-occupied', nextValue);
    refreshTopOccupiedLayout();
  }

  function setNewtabTopLayout(layout: unknown): void {
    if (!document.body) {
      return;
    }
    const nextValue = layout === 'floating' ? 'floating' : 'docked';
    if (document.body.getAttribute('data-nt-top-layout') === nextValue) {
      return;
    }
    document.body.setAttribute('data-nt-top-layout', nextValue);
    if (document.body.getAttribute('data-nt-top-occupied') === 'true') {
      refreshTopOccupiedLayout();
    }
  }

  function refreshTopOccupiedLayout(): void {
    updateSearchEntryLayout();
    if (pageState.bookmarkCascadeRuntime && pageState.bookmarkCascadeRuntime.isOpen()) {
      pageState.bookmarkCascadeRuntime.positionLevels();
    }
  }

  // In top bar mode the bar holds the bookmarks and the section's actions.
  function syncBookmarkSurfaceMode(): void {
    const topbar = pageState.bookmarkTopbarRuntime;
    if (topbar && isBookmarkTopbarMode()) {
      topbar.activate();
      setContentSectionVisible(bookmarkSection, false);
      topbar.setVisible(bookmarkCards.length > 0 && preview.get(bookmarkCount) > 0);
    } else if (topbar) {
      topbar.deactivate();
      setContentSectionVisible(
        bookmarkSection,
        bookmarkCards.length > 0 && preview.get(bookmarkCount) > 0
      );
    }
    updateBookmarkHeader();
  }

  function setBookmarkSurfaceVisible(visible: unknown): void {
    const nextVisible = visible === true;
    if (isBookmarkTopbarMode()) {
      setContentSectionVisible(bookmarkSection, false);
      if (pageState.bookmarkTopbarRuntime) {
        pageState.bookmarkTopbarRuntime.setVisible(nextVisible && !settings.get(newtabZenMode));
      }
      return;
    }
    if (pageState.bookmarkTopbarRuntime) {
      pageState.bookmarkTopbarRuntime.setVisible(false);
    }
    setContentSectionVisible(bookmarkSection, nextVisible);
  }

  function updateBookmarkModeMenu(): void {
    if (pageState.bookmarkGrid) {
      pageState.bookmarkGrid.setAttribute('data-view-mode', settings.get(bookmarkViewMode));
    }
    if (document.body) {
      document.body.setAttribute('data-bookmark-view-mode', settings.get(bookmarkViewMode));
    }
    syncBookmarkSurfaceMode();
  }

  // The page draws the stored view mode: a new one starts the bookmarks
  // over at the first page, at the root for the bar.
  let shownBookmarkViewMode = settings.get(bookmarkViewMode);
  function showBookmarkViewMode(first: boolean): void {
    const mode = settings.get(bookmarkViewMode);
    if (mode === shownBookmarkViewMode) {
      updateBookmarkModeMenu();
      if (first && !pageState.bookmarkLoadedOnce) {
        pageState.bookmarkCurrentPage = 0;
        pageState.bookmarkRenderSignature = '';
        markBookmarkDataDirty();
        void loadBookmarks();
      }
      return;
    }
    shownBookmarkViewMode = mode;
    closeBookmarkCascadeMenu();
    if (mode === 'top') {
      pageState.bookmarkCurrentFolderId = pageState.bookmarkRootFolderId;
    }
    pageState.bookmarkCurrentPage = 0;
    pageState.bookmarkRenderSignature = '';
    updateBookmarkModeMenu();
    markBookmarkDataDirty();
    void loadBookmarks(first ? undefined : { force: true });
  }

  // Settles once the stored view mode is drawn.
  function followBookmarkViewMode(): Promise<void> {
    settings.subscribe(bookmarkViewMode, () => showBookmarkViewMode(false));
    return settings.include(bookmarkViewMode).then(() => showBookmarkViewMode(true));
  }

  function setBookmarkViewMode(nextMode: unknown): void {
    void settings.set(bookmarkViewMode, bookmarkViewMode.parse(nextMode)).catch(() => {});
  }

  function navigateBookmarkFolder(targetId: unknown): void {
    const id = String(targetId || '').trim();
    if (!id) {
      return;
    }
    closeBookmarkCascadeMenu();
    pageState.bookmarkCurrentFolderId = id;
    pageState.bookmarkCurrentPage = 0;
    pageState.bookmarkRenderSignature = '';
    void loadBookmarks({ force: true });
  }

  function updateBookmarkHeader(): void {
    const rootLabel = t('bookmarks_heading', '书签');
    const path = Array.isArray(pageState.bookmarkFolderPath) ? pageState.bookmarkFolderPath : [];
    const menuTitle = t('display_mode_title', 'Display mode');
    const topbar = pageState.bookmarkTopbarRuntime;
    renderBookmarkHeader({
      heading: rootLabel,
      rootFolderId: String(pageState.bookmarkRootFolderId || '1'),
      crumbs: path.length > 1
        ? path.slice(1).map((crumb) => ({
          id: String(crumb && crumb.id ? crumb.id : ''),
          title: String(crumb && crumb.title ? crumb.title : '').trim() || rootLabel
        }))
        : [],
      previous: {
        label: t('bookmarks_page_prev', '上一页'),
        enabled: pageState.bookmarkPagerAvailability.previous
      },
      next: {
        label: t('bookmarks_page_next', '下一页'),
        enabled: pageState.bookmarkPagerAvailability.next
      },
      managerLabel: t('bookmarks_open_manager', '打开书签管理页'),
      modeMenu: {
        id: BOOKMARK_MODE_MENU_ID,
        title: menuTitle,
        value: settings.get(bookmarkViewMode),
        options: getBookmarkModeMenuOptions(),
        onChange: (mode) => {
          setBookmarkViewMode(mode);
        },
        onAction: handleBookmarkModeMenuAction
      },
      actionsInTopbar: Boolean(topbar && topbar.isActive()),
      onNavigate: navigateBookmarkFolder,
      onPage: goToBookmarkPage,
      onOpenManager: openBookmarkManager,
      showTooltip: (target, label, placement) => showTopActionTooltip(target, label, { placement }),
      hideTooltip: hideTopActionTooltip,
      onMenuBeforeOpen: hideTopActionTooltip,
      getMenuViewportTopInset: getNewtabViewportTopPaddingPx
    });
  }

  return {
    updateRecentModeMenu,
    setRecentMode,
    canDismissRecentCard,
    updateBookmarkHeader,
    isBookmarkTopbarMode,
    getNewtabTopOccupiedInsetPx,
    getNewtabViewportTopPaddingPx,
    getBookmarkCascadeViewportTopPaddingPx,
    setNewtabTopOccupied,
    setNewtabTopLayout,
    syncBookmarkSurfaceMode,
    setBookmarkSurfaceVisible,
    updateBookmarkModeMenu,
    followBookmarkViewMode,
    setBookmarkViewMode,
    navigateBookmarkFolder
  };
}

type SectionHeaders = ReturnType<typeof createSectionHeaders>;

export { createSectionHeaders };
export type { SectionHeaders, SectionHeadersDeps, SectionHeadersState };
