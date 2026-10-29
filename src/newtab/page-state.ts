// The New Tab's shared page state, with the initial value of every property
// that starts as a constant. newtab.js creates it first and hands the same
// object to every module as `pageState`; properties whose first value
// depends on settings or other modules are set where that value exists.
import type { AppearanceModesState } from './appearance-modes';
import type { PageFaviconsState } from './theme/page-favicons';
import type { SiteThemeResolverState } from './theme/site-theme-resolver';

// Every module's view of the page state, together.
type NewtabPageState =
  AppearanceModesState &
  PageFaviconsState &
  SiteThemeResolverState;

function createPageState(): NewtabPageState {
  return {
    faviconViewRuntime: null,
    faviconCacheRuntime: null,
    requestFaviconData: null,
    faviconDataCache: new Map()
  };
}

export { createPageState };
export type { NewtabPageState };
