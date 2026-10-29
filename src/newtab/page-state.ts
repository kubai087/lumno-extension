// The New Tab's shared page state, with the initial value of every property
// that starts as a constant. newtab.js creates it first and hands the same
// object to every module as `pageState`; properties whose first value
// depends on settings or other modules are set where that value exists.
import type { AppearanceModesState } from './appearance-modes';
import type { BookmarkContextMenuState } from './bookmarks/bookmark-context-menu';
import type { BookmarkDragControllerState } from './bookmarks/bookmark-drag-controller';
import type { BottomDockRuntimeState } from './shortcuts/bottom-dock-runtime';
import type { FolderColorsState } from './bookmarks/folder-colors';
import type { InputFocusState } from './input-focus';
import type { PageFaviconsState } from './theme/page-favicons';
import type { PageKeyboardState } from './page-keyboard';
import type { RecentCardDrag, RecentCardDragState } from './recent/recent-card-drag';
import type { RecentSectionState } from './recent/recent-section';
import type { SectionLoadersState } from './section-loaders';
import type { ShortcutDragState } from './shortcuts/shortcut-drag';
import type { ShortcutsControllerState } from './shortcuts/shortcuts-controller';
import type { SiteThemeResolverState } from './theme/site-theme-resolver';
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
  BookmarkContextMenuState &
  BookmarkDragControllerState &
  BottomDockRuntimeState &
  FolderColorsState &
  InputFocusState &
  PageFaviconsState &
  PageKeyboardState &
  RecentCardDragState &
  RecentSectionState &
  SectionLoadersState &
  ShortcutDragState &
  ShortcutsControllerState &
  SiteThemeResolverState &
  TopContentState &
  WallpaperPageState;

function createPageState(): NewtabPageState {
  return {

    faviconViewRuntime: null,

    topContentContainer: null,
    topContentController: null,
    wordmarkImageEl: null,
    bookmarkMoveHistoryBusy: false,
    shortcutDragState: null,




    recentCardDragRuntime: null,
    faviconCacheRuntime: null,
    requestFaviconData: null,
    faviconDataCache: new Map(),
    bookmarkDragState: null,
    folderColorPicker: null
  };
}

export { createPageState };
export type { NewtabPageState };
