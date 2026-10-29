const { moduleScript } = require('./module-script');

// The modules the runtime imports that tests may hand in as context globals,
// so test doubles can replace their functions.
const WALLPAPER_DEPENDENCY_GLOBALS = Object.freeze({
  'src/domain/settings/index.ts': 'LumnoSettings',
  'src/newtab/remote-content.ts': 'LumnoNewtabRemoteContent',
  'src/newtab/wallpaper/wallpaper-adaptive-tone.ts': 'LumnoNewtabWallpaperAdaptiveTone',
  'src/newtab/wallpaper/wallpaper-effects.ts': 'LumnoNewtabWallpaperEffects',
  'src/shared/wallpaper-local-store.ts': 'LumnoNewtabWallpaperLocalStore',
  'src/shared/wallpaper-caches.ts': 'LumnoNewtabWallpaperLocalStore',
  'src/newtab/react/wallpaper-view.tsx': 'LumnoNewtabWallpaperViewModule',
  'src/shared/react/feature-hint-view.tsx': 'LumnoFeatureHintViewModule',
  'src/newtab/app/portals.ts': 'LumnoNewtabPortalsModule'
});

// The runtime as the page runs it, for evaluating in a test context: a
// script that leaves the wallpaper module's exports on LumnoNewtabWallpaper.
// With stubs (such as WALLPAPER_DEPENDENCY_GLOBALS), those imports read the
// context's globals instead.
function readWallpaperRuntimeSource(stubs) {
  return moduleScript('src/newtab/wallpaper/wallpaper.ts', 'LumnoNewtabWallpaper', null, stubs);
}

module.exports = {
  WALLPAPER_DEPENDENCY_GLOBALS,
  readWallpaperRuntimeSource
};
