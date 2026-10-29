// Headings, mode menus, pager labels and breadcrumbs for the bookmark and
// recent-site sections.
import type { SelectMenuOption } from '../shared/react/select-menu/menu-options';
import type { BookmarkCascadeActions } from './bookmarks/bookmark-cascade-actions';
import type { Translate } from './newtab-types';
import type { PageLayout } from './page-layout';
import type { BookmarkHeaderStore } from './react/bookmark-header';
import type { TooltipBindings } from './tooltip-bindings';
import { newtabZenMode } from '../domain/settings/newtab-page';
import type { SettingsStore } from '../platform/settings-store';
import type { SettingPreview } from './setting-preview';
import { bookmarkCount, bookmarkViewMode } from '../domain/settings/bookmarks';
import type { BookmarksShown } from './bookmarks/bookmarks-shown';
import type { BookmarkSectionParts } from './bookmarks/bookmark-section-parts';
import { getNewtabViewportTopPaddingPx } from './dom/top-inset';
import type { SurfaceLocale } from '../shared/i18n/surface-locale';
import { bookmarkSectionEvents } from './bookmarks/bookmark-section-events';

// Matches the id the display mode menu has always had, which tests and styles may name.
const BOOKMARK_MODE_MENU_ID = '_x_extension_newtab_bookmark_mode_2026_unique_';

interface SectionHeadersDeps extends
  Pick<PageLayout, 'updateSearchEntryLayout' | 'setContentSectionVisible'>,
  Pick<BookmarkCascadeActions, 'closeBookmarkCascadeMenu'>,
  Pick<TooltipBindings, 'showTopActionTooltip' | 'hideTopActionTooltip'> {
  preview: Pick<SettingPreview, 'get'>;
  settings: Pick<SettingsStore, 'get' | 'include' | 'set' | 'subscribe'>;
  t: Translate;
  bookmarkSection: HTMLElement | null;
  bookmarkCards: readonly HTMLElement[];
  bookmarkHeaderStore: BookmarkHeaderStore;
  getBookmarkModeMenuOptions(): SelectMenuOption[];
  handleBookmarkModeMenuAction(action: string): void;
  openBookmarkManager(): void;
  bookmarksShown: Pick<BookmarksShown, 'folderPath' | 'forgetSignature' | 'loadedOnce' | 'openFolder' | 'pagerAvailability' | 'rootFolderId' | 'showPage'>;
  bookmarkParts: Pick<BookmarkSectionParts, 'cascade' | 'topbar'>;
  bookmarkGrid: HTMLElement;
  locale: Pick<SurfaceLocale, 'store'>;
}

function createSectionHeaders(deps: SectionHeadersDeps) {
  const {
    bookmarkGrid,
    bookmarkParts,
    bookmarksShown,
    preview,
    settings,
    t,
    updateSearchEntryLayout,
    setContentSectionVisible,
    bookmarkSection,
    bookmarkCards,
    closeBookmarkCascadeMenu,
    showTopActionTooltip,
    hideTopActionTooltip,
    bookmarkHeaderStore,
    getBookmarkModeMenuOptions,
    handleBookmarkModeMenuAction,
    openBookmarkManager,
    locale
  } = deps;



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
    if (bookmarkParts.cascade && bookmarkParts.cascade.isOpen()) {
      bookmarkParts.cascade.positionLevels();
    }
  }

  // In top bar mode the bar holds the bookmarks and the section's actions.
  function syncBookmarkSurfaceMode(): void {
    const topbar = bookmarkParts.topbar;
    if (topbar && settings.get(bookmarkViewMode) === 'top') {
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
    if (settings.get(bookmarkViewMode) === 'top') {
      setContentSectionVisible(bookmarkSection, false);
      if (bookmarkParts.topbar) {
        bookmarkParts.topbar.setVisible(nextVisible && !settings.get(newtabZenMode));
      }
      return;
    }
    if (bookmarkParts.topbar) {
      bookmarkParts.topbar.setVisible(false);
    }
    setContentSectionVisible(bookmarkSection, nextVisible);
  }

  function updateBookmarkModeMenu(): void {
    if (bookmarkGrid) {
      bookmarkGrid.setAttribute('data-view-mode', settings.get(bookmarkViewMode));
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
      if (first && !bookmarksShown.loadedOnce) {
        bookmarksShown.showPage(0);
        bookmarksShown.forgetSignature();
        bookmarkSectionEvents.emit('shownChanged', { force: false });
      }
      return;
    }
    shownBookmarkViewMode = mode;
    closeBookmarkCascadeMenu();
    if (mode === 'top') {
      bookmarksShown.openFolder(bookmarksShown.rootFolderId);
    } else {
      bookmarksShown.showPage(0);
      bookmarksShown.forgetSignature();
    }
    updateBookmarkModeMenu();
    bookmarkSectionEvents.emit('shownChanged', { force: !first });
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
    bookmarksShown.openFolder(id);
    bookmarkSectionEvents.emit('shownChanged', { force: true });
  }

  function updateBookmarkHeader(): void {
    const rootLabel = t('bookmarks_heading', '书签');
    const path = Array.isArray(bookmarksShown.folderPath) ? bookmarksShown.folderPath : [];
    const menuTitle = t('display_mode_title', 'Display mode');
    const topbar = bookmarkParts.topbar;
    bookmarkHeaderStore.setState({ model: {
      heading: rootLabel,
      rootFolderId: String(bookmarksShown.rootFolderId || '1'),
      crumbs: path.length > 1
        ? path.slice(1).map((crumb) => ({
          id: String(crumb && crumb.id ? crumb.id : ''),
          title: String(crumb && crumb.title ? crumb.title : '').trim() || rootLabel
        }))
        : [],
      previous: {
        label: t('bookmarks_page_prev', '上一页'),
        enabled: bookmarksShown.pagerAvailability.previous
      },
      next: {
        label: t('bookmarks_page_next', '下一页'),
        enabled: bookmarksShown.pagerAvailability.next
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
      onPage: (step) => bookmarkSectionEvents.emit('pageRequested', { step }),
      onOpenManager: openBookmarkManager,
      showTooltip: (target, label, placement) => showTopActionTooltip(target, label, { placement }),
      hideTooltip: hideTopActionTooltip,
      onMenuBeforeOpen: hideTopActionTooltip,
      getMenuViewportTopInset: getNewtabViewportTopPaddingPx
    } });
  }


  // The display mode menu reads its labels in the page's language.
  locale.store.subscribe(() => updateBookmarkModeMenu());

  // The top bar's layout sets how much of the top the page keeps clear, and
  // the display menu shows the bar's layout and background as they are.
  bookmarkSectionEvents.on('topbarStyled', ({ layout, menu }) => {
    setNewtabTopLayout(layout);
    if (menu) {
      updateBookmarkModeMenu();
    }
  });
  return {
    updateBookmarkHeader,
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
export type { SectionHeaders, SectionHeadersDeps };
