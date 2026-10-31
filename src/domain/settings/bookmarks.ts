// New Tab bookmarks: the grid, the view, folder icons and colors, and the
// bookmark bar's layout and material.
import { defineSetting } from './define';
import { custom, flag, opaque } from './schema';

type BookmarkViewMode = 'folder' | 'list' | 'top';

// How many bookmarks the grid shows: rows of four, up to eight rows; 0 hides
// them.
const bookmarkCount = defineSetting({
  key: '_x_extension_bookmark_count_2024_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: custom((value) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 32 && parsed % 4 === 0 ? parsed : 8;
  })
});

const bookmarkColumns = defineSetting({
  key: '_x_extension_bookmark_columns_2024_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: custom((value) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 4 && parsed <= 8 ? parsed : 6;
  })
});

const bookmarkViewMode = defineSetting({
  key: '_x_extension_bookmark_view_mode_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: custom((value): BookmarkViewMode => (value === 'list' || value === 'top' ? value : 'folder'))
});

const bookmarkFolderIconsVisible = defineSetting({
  key: '_x_extension_bookmark_folder_icons_visible_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: flag(true)
});

// Shows the bookmark folder menu's layout guides (a developer aid).
const bookmarkCascadeDebug = defineSetting({
  key: '_x_extension_bookmark_cascade_debug_2026_unique_',
  area: 'preferences',
  schema: flag(false)
});

// Folder colors are keyed by bookmark path, not the device-only bookmark id;
// the format belongs to newtab/bookmarks/bookmark-folder-icon.ts.
const bookmarkFolderColorRefs = defineSetting({
  key: '_x_extension_bookmark_folder_color_refs_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: opaque()
});

const bookmarkFolderColorPresets = defineSetting({
  key: '_x_extension_bookmark_folder_color_presets_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: opaque()
});

// Folder colors by this device's bookmark ids, as older versions kept them;
// moved into the synced references on first read.
const bookmarkFolderColorsLegacy = defineSetting({
  key: '_x_extension_bookmark_folder_colors_2026_unique_',
  area: 'device',
  schema: opaque()
});

// The bookmark bar's material is chosen against the wallpaper. Browser sync
// carries no custom wallpapers, so these stay on the device; WebDAV carries
// them with the wallpapers.
const bookmarkTopbarSurfaceMode = defineSetting({
  key: '_x_extension_bookmark_topbar_surface_mode_2026_unique_',
  area: 'device',
  sync: 'webdav',
  schema: opaque()
});

const bookmarkTopbarSurfaceColorLight = defineSetting({
  key: '_x_extension_bookmark_topbar_surface_color_light_2026_unique_',
  area: 'device',
  sync: 'webdav',
  schema: opaque()
});

const bookmarkTopbarSurfaceColorDark = defineSetting({
  key: '_x_extension_bookmark_topbar_surface_color_dark_2026_unique_',
  area: 'device',
  sync: 'webdav',
  schema: opaque()
});

// The single color older versions stored; each device migrates it into the
// light and dark colors.
const bookmarkTopbarSurfaceColorLegacy = defineSetting({
  key: '_x_extension_bookmark_topbar_surface_color_2026_unique_',
  area: 'device',
  schema: opaque()
});

const bookmarkTopbarLayout = defineSetting({
  key: '_x_extension_bookmark_topbar_layout_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: opaque()
});

const BOOKMARK_TOPBAR_SURFACE_SETTINGS = Object.freeze([
  bookmarkTopbarSurfaceMode,
  bookmarkTopbarSurfaceColorLight,
  bookmarkTopbarSurfaceColorDark,
  bookmarkTopbarSurfaceColorLegacy
]);

const BOOKMARK_TOPBAR_SURFACE_KEYS: readonly string[] = Object.freeze(BOOKMARK_TOPBAR_SURFACE_SETTINGS.map((setting) => setting.key));
const BOOKMARK_TOPBAR_WEBDAV_KEYS: readonly string[] = Object.freeze(
  BOOKMARK_TOPBAR_SURFACE_SETTINGS.filter((setting) => setting.sync === 'webdav').map((setting) => setting.key)
);

export {
  BOOKMARK_TOPBAR_SURFACE_KEYS,
  BOOKMARK_TOPBAR_SURFACE_SETTINGS,
  BOOKMARK_TOPBAR_WEBDAV_KEYS,
  bookmarkCascadeDebug,
  bookmarkColumns,
  bookmarkCount,
  bookmarkFolderColorPresets,
  bookmarkFolderColorRefs,
  bookmarkFolderColorsLegacy,
  bookmarkFolderIconsVisible,
  bookmarkTopbarLayout,
  bookmarkTopbarSurfaceColorDark,
  bookmarkTopbarSurfaceColorLegacy,
  bookmarkTopbarSurfaceColorLight,
  bookmarkTopbarSurfaceMode,
  bookmarkViewMode
};
export type { BookmarkViewMode };
