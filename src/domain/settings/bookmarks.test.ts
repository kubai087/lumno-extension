import { describe, expect, it } from 'vitest';
import { bookmarkColumns, bookmarkCount } from './bookmarks';
import { BOOKMARK_TOPBAR_SURFACE_KEYS, BOOKMARK_TOPBAR_WEBDAV_KEYS, bookmarkFolderIconsVisible } from './bookmarks';

describe('bookmark grid settings', () => {
  it('reads four to eight bookmarks per row, six otherwise', () => {
    expect(bookmarkColumns.parse(undefined)).toBe(6);
    expect([3, 4, 8, 9, 5.5].map((value) => bookmarkColumns.parse(value))).toEqual([6, 4, 8, 6, 6]);
  });

  it('reads the bookmark count in steps of four up to eight rows, eight otherwise', () => {
    expect([0, 4, 32, 36, 6].map((value) => bookmarkCount.parse(value))).toEqual([0, 4, 32, 8, 8]);
  });
});

describe('bookmark bar settings', () => {
  it('syncs the bar material through WebDAV only, without the migrated single color', () => {
    expect(BOOKMARK_TOPBAR_SURFACE_KEYS).toEqual([
      '_x_extension_bookmark_topbar_surface_mode_2026_unique_',
      '_x_extension_bookmark_topbar_surface_color_light_2026_unique_',
      '_x_extension_bookmark_topbar_surface_color_dark_2026_unique_',
      '_x_extension_bookmark_topbar_surface_color_2026_unique_'
    ]);
    expect(BOOKMARK_TOPBAR_WEBDAV_KEYS).toEqual(BOOKMARK_TOPBAR_SURFACE_KEYS.slice(0, 3));
  });

  it('shows folder icons unless turned off, under its stored key', () => {
    expect(bookmarkFolderIconsVisible.key).toBe('_x_extension_bookmark_folder_icons_visible_2026_unique_');
    expect([false, true, undefined, 'false'].map((value) => bookmarkFolderIconsVisible.parse(value))).toEqual([false, true, true, true]);
  });

  it('reads every allowed bookmark count and column count, including a numeric string', () => {
    expect([8, 12, 20, 28, 2, 12.5].map((value) => bookmarkCount.parse(value))).toEqual([8, 12, 20, 28, 8, 8]);
    expect(['5', 6, 7].map((value) => bookmarkColumns.parse(value))).toEqual([5, 6, 7]);
  });
});
