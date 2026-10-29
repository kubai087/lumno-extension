// The New Tab's shared page state, with the initial value of every property
// that starts as a constant. newtab.js creates it first and hands the same
// object to every module as `pageState`; properties whose first value
// depends on settings or other modules are set where that value exists.
import type { AppearanceModesState } from './appearance-modes';
import type { BottomDockRuntimeState } from './shortcuts/bottom-dock-runtime';
import type { FolderColorsState } from './bookmarks/folder-colors';
import type { InputFocusState } from './input-focus';
import type { PageFaviconsState } from './theme/page-favicons';
import type { PageKeyboardState } from './page-keyboard';
import type { SiteThemeResolverState } from './theme/site-theme-resolver';
import type { TopContentState } from './top-content/top-content';
import type { WallpaperPageState } from './wallpaper/wallpaper-page';

// Every module's view of the page state, together.
type NewtabPageState =
  AppearanceModesState &
  BottomDockRuntimeState &
  FolderColorsState &
  InputFocusState &
  PageFaviconsState &
  PageKeyboardState &
  SiteThemeResolverState &
  TopContentState &
  WallpaperPageState;

function createPageState(): NewtabPageState {
  return {

    faviconViewRuntime: null,

    topContentContainer: null,
    topContentController: null,
    wordmarkImageEl: null,




    faviconCacheRuntime: null,
    requestFaviconData: null,
    faviconDataCache: new Map(),
    folderColorPicker: null
  };
}

export { createPageState };
export type { NewtabPageState };
