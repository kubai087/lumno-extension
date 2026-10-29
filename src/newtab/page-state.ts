// The New Tab's shared page state, with the initial value of every property
// that starts as a constant. newtab.js creates it first and hands the same
// object to every module as `pageState`; properties whose first value
// depends on settings or other modules are set where that value exists.
import type { AppearanceModesState } from './appearance-modes';
import type { BookmarkActionsState } from './bookmarks/bookmark-actions';
import type { BookmarkCascadeActionsState } from './bookmarks/bookmark-cascade-actions';
import type { BookmarkContextMenuState } from './bookmarks/bookmark-context-menu';
import type { BookmarkDisplaySettingsState } from './bookmarks/bookmark-display-settings';
import type { BookmarkDragControllerState } from './bookmarks/bookmark-drag-controller';
import type { BookmarkPagerState } from './bookmarks/bookmark-pager';
import type { BookmarkSectionState } from './bookmarks/bookmark-section';
import type { BottomDockRuntimeState } from './shortcuts/bottom-dock-runtime';
import type { FolderColorsState } from './bookmarks/folder-colors';
import type { InputFocusState } from './input-focus';
import type { ModeCommandsState } from './mode-commands';
import type { PageFaviconsState } from './theme/page-favicons';
import type { PageKeyboardState } from './page-keyboard';
import type { PageLayoutState } from './page-layout';
import type { PageResizeState } from './page-resize';
import type { RecentCardDrag, RecentCardDragState } from './recent/recent-card-drag';
import type { RecentSectionState } from './recent/recent-section';
import type { RecentSitesControllerState } from './recent/recent-sites-controller';
import type { RecentSourcesState } from './recent/recent-sources';
import type { SearchSettingsSyncState } from './search/search-settings-sync';
import type { SectionHeadersState } from './section-headers';
import type { SectionLoadersState } from './section-loaders';
import type { SectionReloadState } from './section-reload';
import type { ShortcutContextMenuState } from './shortcuts/shortcut-context-menu';
import type { ShortcutDockState } from './shortcuts/shortcut-dock';
import type { ShortcutDragState } from './shortcuts/shortcut-drag';
import type { ShortcutPageActionsState } from './shortcuts/shortcut-page-actions';
import type { ShortcutsControllerState } from './shortcuts/shortcuts-controller';
import type { StartupPreferencesState } from './startup-preferences';
import type { SiteThemeResolverState } from './theme/site-theme-resolver';
import type { SuggestionsLayoutState } from './search/suggestions-layout';
import type { TooltipBindingsState } from './tooltip-bindings';
import type { TopContentState } from './top-content/top-content';
import type { WallpaperPageState } from './wallpaper/wallpaper-page';

// The page state newtab.ts reads and writes itself, beyond what it hands
// the modules.
interface PageCoreState {
  recentCardDragRuntime: RecentCardDrag | null;
}

// Every module's view of the page state, together.
type NewtabPageState =
  PageCoreState &
  AppearanceModesState &
  BookmarkActionsState &
  BookmarkCascadeActionsState &
  BookmarkContextMenuState &
  BookmarkDisplaySettingsState &
  BookmarkDragControllerState &
  BookmarkPagerState &
  BookmarkSectionState &
  BottomDockRuntimeState &
  FolderColorsState &
  InputFocusState &
  ModeCommandsState &
  PageFaviconsState &
  PageKeyboardState &
  PageLayoutState &
  PageResizeState &
  RecentCardDragState &
  RecentSectionState &
  RecentSitesControllerState &
  RecentSourcesState &
  SearchSettingsSyncState &
  SectionHeadersState &
  SectionLoadersState &
  SectionReloadState &
  ShortcutContextMenuState &
  ShortcutDockState &
  ShortcutDragState &
  ShortcutPageActionsState &
  ShortcutsControllerState &
  StartupPreferencesState &
  SiteThemeResolverState &
  SuggestionsLayoutState &
  TooltipBindingsState &
  TopContentState &
  WallpaperPageState;

function createPageState(): NewtabPageState {
  return {

    recentSourceItems: [],
    layoutController: null,
    layoutMotion: null,
    bottomDockScroller: null,
    faviconViewRuntime: null,

    topContentContainer: null,
    topContentController: null,
    wordmarkImageEl: null,
    bookmarkCurrentPage: 0,
    bookmarkAllItems: [],
    bookmarkCurrentFolderId: '1',
    bookmarkRootFolderId: '1',
    bookmarkFolderPath: [],
    bookmarkRootTotalCount: 0,
    bookmarkRootVisibleCount: 0,
    bookmarkTitleWrap: null,
    bookmarkGrid: null,
    recentHeader: null,
    recentModeMenu: null,
    recentGrid: null,
    bookmarkPagerPrevButton: null,
    bookmarkPagerNextButton: null,
    bookmarkPagerAvailability: { previous: false, next: false },
    bookmarkPageAnimating: false,
    bookmarkMoveHistoryBusy: false,
    recentSitesView: null,
    bookmarksView: null,
    newtabShortcutIcons: {},
    newtabShortcutFavicons: {},
    shortcutPersistenceInFlightCount: 0,
    shortcutDragState: null,

    shortcutFaviconPolicyRevision: 0,
    shortcutFaviconPendingCacheEntries: {},



    recentCardDragRuntime: null,
    faviconCacheRuntime: null,
    requestFaviconData: null,
    faviconDataCache: new Map(),
    bookmarkContextMenu: null,
    bookmarkContextMenuSelectController: null,
    bookmarkContextMenuTarget: null,
    bookmarkCascadeRuntime: null,
    bookmarkDragState: null,
    bookmarkTopbarRuntime: null,
    shortcutSection: null,
    shortcutGrid: null,
    addShortcutButton: null,
    recentSection: null,
    folderColorPicker: null,
    recentContextMenu: null,
    recentContextMenuSelectController: null,
    recentContextMenuTarget: null,
    recentHistoryDialogController: null,
    startupRecentSourceReads: null,
    firefoxBrowserIcons: null,
    firefoxBrowserIconsReady: Promise.resolve(null),
    shortcutContextMenu: null,
    shortcutContextMenuSelectController: null,
    shortcutContextMenuTarget: null,
    shortcutPlateColorPicker: null,
    shortcutPlateColorPick: null,
    shortcutDialogController: null,

    bookmarkLoadedOnce: false,
    bookmarkRenderSignature: '',
    sectionDataRevision: 0,
    newtabShortcuts: [],
    recentLoadedOnce: false,
    recentRenderSignature: '',
    shortcutDockPendingPointerX: Number.NaN
  };
}

export { createPageState };
export type { NewtabPageState };
