// Builds the bookmark section around the page structure's header and grid:
// the bookmark view, the cascade menu runtime and the top bar runtime.
import * as LumnoMenuSurface from '../../shared/ui/menu-surface';
import type { TooltipController } from '../../shared/ui/tooltip';
import type * as CrossSurfaceDrag from '../cross-surface-drag';
import type { DismissStack } from '../dismiss-stack';
import type { BindCursorTooltip, FormatMessage, Translate } from '../newtab-types';
import type { BookmarkCardElement, BookmarksViewController, BookmarksViewOptions } from '../react/bookmarks';
import type { createBookmarksTopbarApi } from '../react/bookmarks-topbar';
import type { BookmarksTopbarRuntime } from '../react/bookmarks-topbar';
import type { PageStructureRuntime } from '../react/page-structure';
import * as NEWTAB_BOOKMARK_CASCADE_MENU from './bookmark-cascade-menu';
import type { BookmarkCascadeRuntime, CascadeItemEventDetail } from './bookmark-cascade-menu';
import * as NEWTAB_BOOKMARK_CASCADE_POSITION from './bookmark-cascade-position';
import type { PointLike } from './bookmark-cascade-position';
import type { BookmarkItemContextMenuEvent } from './bookmark-context-menu';
import type * as FolderIcon from './bookmark-folder-icon';
import type { BookmarksRuntime } from './bookmarks-runtime';
import { getBookmarksViewApi } from '../react/bookmarks';
import { getBookmarkCascadeViewApi } from '../react/bookmark-cascade-view';
import type { SettingPreview } from '../setting-preview';
import { bookmarkFolderIconsVisible } from '../../domain/settings/bookmarks';

type ViewOption<K extends keyof BookmarksViewOptions> = NonNullable<BookmarksViewOptions[K]>;

interface BookmarkSectionState {
  bookmarkTitleWrap: HTMLElement | null;
  currentBookmarkViewMode: string;
  bookmarkPagerPrevButton: HTMLElement | null;
  bookmarkPagerNextButton: HTMLElement | null;
  bookmarkGrid: HTMLElement | null;
  bookmarksView: BookmarksViewController | null;
  bookmarkCascadeRuntime: BookmarkCascadeRuntime | null;
  bookmarkTopbarRuntime: BookmarksTopbarRuntime | null;
  bookmarkRootFolderId: string;
  bookmarkRenderSignature: string;
  sectionDataRevision: number;
  bookmarkLoadedOnce: boolean;
}

interface BookmarkSectionDeps {
  preview: Pick<SettingPreview, 'get'>;
  setContentSectionVisible(section: HTMLElement | null, visible: boolean): void;
  bookmarkSection: HTMLElement | null;
  pageStructureRuntime: PageStructureRuntime;
  t: Translate;
  handleBookmarkDragPointerDown(event: PointerEvent): void;
  applyBookmarkGridColumns(): void;
  bookmarkCards: BookmarkCardElement[];
  formatMessage: FormatMessage;
  sanitizeDisplayText(value: unknown): string;
  getHostFromUrl(url: string): string;
  getSiteDisplayName(host: string, title?: string): string;
  getUrlDisplay(url: string): string;
  initFolderPathMorph: typeof FolderIcon.initFolderPathMorph;
  playFolderPathMorph: typeof FolderIcon.playFolderPathMorph;
  stableHashCode: ViewOption<'stableHashCode'>;
  normalizeHost(host: string): string;
  attachFaviconWithFallbacks(
    image: HTMLImageElement,
    url: string,
    host: string,
    candidates?: { primaryUrl?: string; browserUrl?: string }
  ): void;
  isLocalNetworkHost(host: string): boolean;
  getChromeFaviconUrl(url: string): string;
  getBrowserPageFaviconUrl(url: string): string;
  getImmediateThemeForSuggestion: ViewOption<'getImmediateThemeForSuggestion'>;
  queueThemeForTarget: ViewOption<'queueThemeForTarget'>;
  applyBookmarkCardTheme: ViewOption<'applyCardTheme'>;
  shouldDelayBookmarkHoverFromRecent: ViewOption<'shouldDelayHoverFromRecent'>;
  shouldSuppressBookmarkHover(target: Element, event?: Event | PointLike | null): boolean;
  bindCursorTooltip: BindCursorTooltip;
  hideCursorTooltip(): void;
  openBookmarkFolder: ViewOption<'openFolder'>;
  openBookmarkCascadeMenu: ViewOption<'openFolderMenu'>;
  copyBookmarkUrl: ViewOption<'copyUrl'>;
  handleBookmarkItemContextMenu(payload: BookmarkItemContextMenuEvent): void;
  isCardActivationSuppressed(): boolean;
  navigateToUrl(url?: string): void;
  openUrlFromNewtabCard(
    url: string | undefined,
    options: { openInBackgroundTab?: boolean; openInOtherTab?: boolean; anchor?: HTMLElement | null; surface: string }
  ): unknown;
  dismissStack: DismissStack;
  NEWTAB_CROSS_SURFACE_DRAG: typeof CrossSurfaceDrag;
  isShortcutFolderAnchor(anchor: HTMLElement | null | undefined): boolean;
  getFolderItemIconUrl(bookmarkId: string, url: string): string;
  bookmarksRuntime: BookmarksRuntime;
  bookmarkCascadeCopyTooltipController: TooltipController;
  hideTopActionTooltip(): void;
  handleBookmarkCascadeItemPointerDown(detail: CascadeItemEventDetail<PointerEvent>): void;
  isBookmarkContextMenuNode(node: EventTarget | null): boolean;
  getBookmarkCascadeViewportTopPaddingPx(): number;
  NEWTAB_BOOKMARKS_TOPBAR: Pick<ReturnType<typeof createBookmarksTopbarApi>, 'createBookmarksTopbar'>;
  setNewtabTopOccupied(occupied: boolean): void;
  syncBookmarkTopbarSurfaceAppearance(options?: { updateMenu?: boolean; scheduleTone?: boolean }): unknown;
  syncBookmarkSurfaceMode(): void;
  pageState: BookmarkSectionState;
}

function createBookmarkSection(deps: BookmarkSectionDeps) {
  const {
    preview,
    setContentSectionVisible,
    bookmarkSection,
    pageStructureRuntime,
    t,
    handleBookmarkDragPointerDown,
    applyBookmarkGridColumns,
    bookmarkCards,
    formatMessage,
    sanitizeDisplayText,
    getHostFromUrl,
    getSiteDisplayName,
    getUrlDisplay,
    initFolderPathMorph,
    playFolderPathMorph,
    stableHashCode,
    normalizeHost,
    attachFaviconWithFallbacks,
    isLocalNetworkHost,
    getChromeFaviconUrl,
    getBrowserPageFaviconUrl,
    getImmediateThemeForSuggestion,
    queueThemeForTarget,
    applyBookmarkCardTheme,
    shouldDelayBookmarkHoverFromRecent,
    shouldSuppressBookmarkHover,
    bindCursorTooltip,
    hideCursorTooltip,
    openBookmarkFolder,
    openBookmarkCascadeMenu,
    copyBookmarkUrl,
    handleBookmarkItemContextMenu,
    isCardActivationSuppressed,
    navigateToUrl,
    openUrlFromNewtabCard,
    dismissStack,
    NEWTAB_CROSS_SURFACE_DRAG,
    isShortcutFolderAnchor,
    getFolderItemIconUrl,
    bookmarksRuntime,
    bookmarkCascadeCopyTooltipController,
    hideTopActionTooltip,
    handleBookmarkCascadeItemPointerDown,
    isBookmarkContextMenuNode,
    getBookmarkCascadeViewportTopPaddingPx,
    NEWTAB_BOOKMARKS_TOPBAR,
    setNewtabTopOccupied,
    syncBookmarkTopbarSurfaceAppearance,
    syncBookmarkSurfaceMode
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  // Set by the New Tab's React islands entry, which loads first.
  const NEWTAB_BOOKMARKS_VIEW = getBookmarksViewApi();
  const NEWTAB_BOOKMARK_CASCADE_VIEW =
    getBookmarkCascadeViewApi();
  if (!NEWTAB_BOOKMARKS_VIEW || !NEWTAB_BOOKMARK_CASCADE_VIEW) {
    return {};
  }
  const bookmarkCardElementCache = new Map<string, BookmarkCardElement>();
  const BOOKMARK_HOVER_DELAY_FROM_RECENT_MS = 56;

  setContentSectionVisible(bookmarkSection, false);
  pageState.bookmarkTitleWrap = pageStructureRuntime.bookmark.titleWrap;
  // The drag controller pages through the grid over these buttons.
  pageState.bookmarkPagerPrevButton = pageStructureRuntime.bookmark.previousButton;
  pageState.bookmarkPagerNextButton = pageStructureRuntime.bookmark.nextButton;
  const bookmarkGrid = pageStructureRuntime.bookmark.grid;
  pageState.bookmarkGrid = bookmarkGrid;
  bookmarkGrid.setAttribute('data-view-mode', pageState.currentBookmarkViewMode);
  bookmarkGrid.addEventListener('pointerdown', handleBookmarkDragPointerDown, true);
  applyBookmarkGridColumns();
  pageState.bookmarksView = NEWTAB_BOOKMARKS_VIEW.createBookmarksView({
    documentObj: document,
    windowObj: window,
    grid: bookmarkGrid,
    cards: bookmarkCards,
    cardElementCache: bookmarkCardElementCache,
    folderIconsVisible: preview.get(bookmarkFolderIconsVisible),
    t,
    formatMessage,
    sanitizeDisplayText,
    getHostFromUrl,
    getSiteDisplayName,
    getUrlDisplay,
    initFolderPathMorph,
    playFolderPathMorph,
    stableHashCode,
    normalizeHost,
    attachFaviconWithFallbacks,
    isLocalNetworkHost,
    getChromeFaviconUrl,
    getBrowserPageFaviconUrl,
    getImmediateThemeForSuggestion,
    queueThemeForTarget,
    applyCardTheme: applyBookmarkCardTheme,
    shouldDelayHoverFromRecent: shouldDelayBookmarkHoverFromRecent,
    hoverDelayFromRecentMs: BOOKMARK_HOVER_DELAY_FROM_RECENT_MS,
    shouldSuppressHover: shouldSuppressBookmarkHover,
    bindCursorTooltip,
    hideCursorTooltip,
    openFolder: openBookmarkFolder,
    openFolderMenu: openBookmarkCascadeMenu,
    copyUrl: copyBookmarkUrl,
    onItemContextMenu: handleBookmarkItemContextMenu,
    isActivationSuppressed: isCardActivationSuppressed,
    navigateToUrl,
    openUrl: (url, options) => openUrlFromNewtabCard(url, { ...options, surface: 'bookmarks' })
  });
  pageState.bookmarkCascadeRuntime = NEWTAB_BOOKMARK_CASCADE_MENU.createBookmarkCascadeMenuRuntime({
    documentObj: document,
    windowObj: window,
    dismissStack,
    positionUtils: NEWTAB_BOOKMARK_CASCADE_POSITION,
    crossSurfaceDrag: NEWTAB_CROSS_SURFACE_DRAG,
    menuSurface: LumnoMenuSurface,
    t,
    sanitizeDisplayText,
    getHostFromUrl,
    getSiteDisplayName,
    getUrlDisplay,
    initFolderPathMorph,
    playFolderPathMorph,
    attachFaviconWithFallbacks,
    getItemIconUrl: (item, anchor) => isShortcutFolderAnchor(anchor) && item.url
      ? getFolderItemIconUrl(item.id, item.url) : '',
    isLocalNetworkHost,
    getChromeFaviconUrl,
    getBrowserPageFaviconUrl,
    ensureReady: (forceReload) => bookmarksRuntime.ensureReady(forceReload),
    getItems: (folderId) => {
      return bookmarksRuntime.getFolderItems(folderId);
    },
    navigateToUrl,
    // Folder shortcuts open their bookmarks as shortcuts.
    openUrl: (url, options) => openUrlFromNewtabCard(url, {
      ...options,
      surface: isShortcutFolderAnchor(options && options.anchor) ? 'shortcuts' : 'bookmarks'
    }),
    shouldSuppressHover: shouldSuppressBookmarkHover,
    bindCursorTooltip,
    hideCursorTooltip,
    copyUrl: copyBookmarkUrl,
    copyTooltipController: bookmarkCascadeCopyTooltipController,
    hideTopActionTooltip,
    onItemPointerDown: handleBookmarkCascadeItemPointerDown,
    onItemContextMenu: handleBookmarkItemContextMenu,
    isActivationSuppressed: isCardActivationSuppressed,
    shouldKeepOpenForExternalNode: isBookmarkContextMenuNode,
    getViewportTopPadding: getBookmarkCascadeViewportTopPaddingPx,
    view: NEWTAB_BOOKMARK_CASCADE_VIEW
  });
  pageState.bookmarkTopbarRuntime = NEWTAB_BOOKMARKS_TOPBAR.createBookmarksTopbar({
    documentObj: document,
    windowObj: window,
    grid: bookmarkGrid,
    headerStore: pageStructureRuntime.bookmark.headerStore,
    ariaLabel: t('bookmark_view_mode_top', 'Top bookmarks bar'),
    onVisibilityChange: setNewtabTopOccupied
  });
  syncBookmarkTopbarSurfaceAppearance({ updateMenu: false, scheduleTone: false });
  syncBookmarkSurfaceMode();
  pageState.bookmarkRenderSignature = '';
  pageState.sectionDataRevision = 0;
  pageState.bookmarkLoadedOnce = false;

  return {};
}

export { createBookmarkSection };
export type { BookmarkSectionDeps, BookmarkSectionState };
