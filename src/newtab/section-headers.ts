// Headings, mode menus, pager labels and breadcrumbs for the bookmark and
// recent-site sections.
import type { SelectMenuOption } from '../shared/react/select-menu/menu-options';
import type { BookmarkCascadeActions } from './bookmarks/bookmark-cascade-actions';
import type { BookmarkCascadeRuntime } from './bookmarks/bookmark-cascade-menu';
import type { BookmarkDisplaySettings, BookmarkViewMode } from './bookmarks/bookmark-display-settings';
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
import { bookmarkCount } from '../domain/settings/bookmarks';

// Matches the id the display mode menu has always had, which tests and styles may name.
const BOOKMARK_MODE_MENU_ID = '_x_extension_newtab_bookmark_mode_2026_unique_';

interface BookmarkViewModeOptions {
  // Applies only while the view mode is still at this revision.
  expectedRevision?: number;
  // Loads the bookmarks when the mode stays the same but none are loaded yet.
  ensureLoaded?: boolean;
  force?: boolean;
  persist?: boolean;
}

interface BookmarkViewModeResult {
  applied: boolean;
  changed: boolean;
  mode: BookmarkViewMode;
  revision: number;
}

interface SectionHeadersState {
  recentModeMenu: { update(): void } | null;
  bookmarkGrid: HTMLElement | null;
  bookmarkCascadeRuntime: Pick<BookmarkCascadeRuntime, 'positionLevels' | 'isOpen'> | null;
  bookmarkTopbarRuntime: Pick<BookmarksTopbarRuntime, 'activate' | 'deactivate' | 'setVisible' | 'isActive'> | null;
  // Which pager buttons lead anywhere from the current page.
  bookmarkPagerAvailability: { previous: boolean; next: boolean };
  currentBookmarkViewMode: BookmarkViewMode;
  bookmarkViewModeRevision: number;
  bookmarkCurrentFolderId: string;
  bookmarkRootFolderId: string;
  bookmarkFolderPath: BookmarkPathEntry[];
  bookmarkCurrentPage: number;
  bookmarkRenderSignature: string;
  bookmarkLoadedOnce: boolean;
}

interface SectionHeadersDeps extends
  Pick<PageLayout, 'updateSearchEntryLayout' | 'setContentSectionVisible'>,
  Pick<BookmarkDisplaySettings, 'normalizeBookmarkViewMode' | 'persistBookmarkViewMode'>,
  Pick<BookmarkCascadeActions, 'closeBookmarkCascadeMenu'>,
  Pick<TooltipBindings, 'showTopActionTooltip' | 'hideTopActionTooltip'>,
  Pick<ViewportInsets, 'getNewtabVisualViewportInsets'> {
  preview: Pick<SettingPreview, 'get'>;
  settings: Pick<SettingsStore, 'get' | 'set'>;
  t: Translate;
  markBookmarkDataDirty: SectionLoaders['markBookmarkDataDirty'];
  loadBookmarks: SectionLoaders['loadBookmarks'];
  BOOKMARK_TOPBAR_HEIGHT_PX: number;
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
    BOOKMARK_TOPBAR_HEIGHT_PX,
    updateSearchEntryLayout,
    setContentSectionVisible,
    bookmarkSection,
    bookmarkCards,
    normalizeBookmarkViewMode,
    markBookmarkDataDirty,
    loadBookmarks,
    closeBookmarkCascadeMenu,
    persistBookmarkViewMode,
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
    return pageState.currentBookmarkViewMode === 'top';
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
      pageState.bookmarkGrid.setAttribute('data-view-mode', pageState.currentBookmarkViewMode);
    }
    if (document.body) {
      document.body.setAttribute('data-bookmark-view-mode', pageState.currentBookmarkViewMode);
    }
    syncBookmarkSurfaceMode();
  }

  function applyBookmarkViewMode(
    nextMode: unknown,
    options?: BookmarkViewModeOptions | null
  ): BookmarkViewModeResult {
    const config: BookmarkViewModeOptions = options && typeof options === 'object' ? options : {};
    if (Object.prototype.hasOwnProperty.call(config, 'expectedRevision') &&
        config.expectedRevision !== pageState.bookmarkViewModeRevision) {
      return {
        applied: false,
        changed: false,
        mode: pageState.currentBookmarkViewMode,
        revision: pageState.bookmarkViewModeRevision
      };
    }
    const mode = normalizeBookmarkViewMode(nextMode);
    const changed = pageState.currentBookmarkViewMode !== mode;
    if (!changed) {
      updateBookmarkModeMenu();
      if (config.ensureLoaded === true && !pageState.bookmarkLoadedOnce) {
        pageState.bookmarkCurrentPage = 0;
        pageState.bookmarkRenderSignature = '';
        markBookmarkDataDirty();
        void loadBookmarks(config.force === true ? { force: true } : undefined);
      }
      return {
        applied: true,
        changed: false,
        mode,
        revision: pageState.bookmarkViewModeRevision
      };
    }
    closeBookmarkCascadeMenu();
    pageState.currentBookmarkViewMode = mode;
    pageState.bookmarkViewModeRevision += 1;
    if (mode === 'top') {
      pageState.bookmarkCurrentFolderId = pageState.bookmarkRootFolderId;
    }
    pageState.bookmarkCurrentPage = 0;
    pageState.bookmarkRenderSignature = '';
    updateBookmarkModeMenu();
    if (config.persist === true) {
      persistBookmarkViewMode(mode);
    }
    markBookmarkDataDirty();
    void loadBookmarks(config.force === true ? { force: true } : undefined);
    return {
      applied: true,
      changed: true,
      mode,
      revision: pageState.bookmarkViewModeRevision
    };
  }

  function setBookmarkViewMode(nextMode: unknown): BookmarkViewModeResult {
    return applyBookmarkViewMode(nextMode, {
      persist: true,
      force: true
    });
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
        value: pageState.currentBookmarkViewMode,
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
    applyBookmarkViewMode,
    setBookmarkViewMode,
    navigateBookmarkFolder
  };
}

type SectionHeaders = ReturnType<typeof createSectionHeaders>;

export { createSectionHeaders };
export type { BookmarkViewModeOptions, BookmarkViewModeResult, SectionHeaders, SectionHeadersDeps, SectionHeadersState };
