// Builds the bookmark section around the page structure's header and grid:
// the bookmark view, the cascade menu runtime and the top bar runtime.
import * as LumnoMenuSurface from '../../shared/ui/menu-surface';
import type { TooltipController } from '../../shared/ui/tooltip';
import type { DismissStack } from '../dismiss-stack';
import type { BindCursorTooltip, FormatMessage, Translate } from '../newtab-types';
import type { BookmarkCardElement, BookmarksViewOptions } from '../react/bookmarks';
import type { PageStructureRuntime } from '../react/page-structure';
import * as NEWTAB_BOOKMARK_CASCADE_MENU from './bookmark-cascade-menu';
import type { CascadeItemEventDetail } from './bookmark-cascade-menu';
import * as NEWTAB_BOOKMARK_CASCADE_POSITION from './bookmark-cascade-position';
import type { PointLike } from './bookmark-cascade-position';
import type { BookmarkItemContextMenuEvent } from './bookmark-context-menu';
import type * as FolderIcon from './bookmark-folder-icon';
import type { BookmarksRuntime } from './bookmarks-runtime';
import { createBookmarksView } from '../react/bookmarks';
import type { SettingPreview } from '../setting-preview';
import { bookmarkFolderIconsVisible, bookmarkViewMode } from '../../domain/settings/bookmarks';
import type { SettingsStore } from '../../platform/settings-store';
import * as NEWTAB_CROSS_SURFACE_DRAG from '../cross-surface-drag';
import { createBookmarksTopbar } from '../react/bookmarks-topbar';
import type { BookmarkSectionParts } from './bookmark-section-parts';

type ViewOption<K extends keyof BookmarksViewOptions> = NonNullable<BookmarksViewOptions[K]>;


interface BookmarkSectionDeps {
  settings: Pick<SettingsStore, 'get'>;
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
  isShortcutFolderAnchor(anchor: HTMLElement | null | undefined): boolean;
  getFolderItemIconUrl(bookmarkId: string, url: string): string;
  bookmarksRuntime: BookmarksRuntime;
  bookmarkCascadeCopyTooltipController: TooltipController;
  hideTopActionTooltip(): void;
  handleBookmarkCascadeItemPointerDown(detail: CascadeItemEventDetail<PointerEvent>): void;
  isBookmarkContextMenuNode(node: EventTarget | null): boolean;
  getBookmarkCascadeViewportTopPaddingPx(): number;
  setNewtabTopOccupied(occupied: boolean): void;
  syncBookmarkTopbarSurfaceAppearance(options?: { updateMenu?: boolean; scheduleTone?: boolean }): unknown;
  syncBookmarkSurfaceMode(): void;
  bookmarkParts: Pick<BookmarkSectionParts, 'mount'>;
}

function createBookmarkSection(deps: BookmarkSectionDeps) {
  const {
    settings,
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
    isShortcutFolderAnchor,
    getFolderItemIconUrl,
    bookmarksRuntime,
    bookmarkCascadeCopyTooltipController,
    hideTopActionTooltip,
    handleBookmarkCascadeItemPointerDown,
    isBookmarkContextMenuNode,
    getBookmarkCascadeViewportTopPaddingPx,
    setNewtabTopOccupied,
    syncBookmarkTopbarSurfaceAppearance,
    syncBookmarkSurfaceMode,
    bookmarkParts
  } = deps;


  const bookmarkCardElementCache = new Map<string, BookmarkCardElement>();
  const BOOKMARK_HOVER_DELAY_FROM_RECENT_MS = 56;

  setContentSectionVisible(bookmarkSection, false);
  const bookmarkGrid = pageStructureRuntime.bookmark.grid;
  bookmarkGrid.setAttribute('data-view-mode', settings.get(bookmarkViewMode));
  bookmarkGrid.addEventListener('pointerdown', handleBookmarkDragPointerDown, true);
  applyBookmarkGridColumns();
  const view = createBookmarksView({
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
  const cascade = NEWTAB_BOOKMARK_CASCADE_MENU.createBookmarkCascadeMenuRuntime({
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
    getViewportTopPadding: getBookmarkCascadeViewportTopPaddingPx
  });
  const topbar = createBookmarksTopbar({
    documentObj: document,
    windowObj: window,
    grid: bookmarkGrid,
    headerStore: pageStructureRuntime.bookmark.headerStore,
    ariaLabel: t('bookmark_view_mode_top', 'Top bookmarks bar'),
    onVisibilityChange: setNewtabTopOccupied
  });
  bookmarkParts.mount({ view, cascade, topbar });
  syncBookmarkTopbarSurfaceAppearance({ updateMenu: false, scheduleTone: false });
  syncBookmarkSurfaceMode();

  return {};
}

export { createBookmarkSection };
export type { BookmarkSectionDeps };
