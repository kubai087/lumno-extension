import { describe, expect, it } from 'vitest';
import { BROWSER_SYNC_KEYS } from './registry';
import {
  NEWTAB_SHORTCUT_COLUMNS_DEFAULT,
  NEWTAB_SHORTCUT_COLUMNS_MAX,
  NEWTAB_SHORTCUT_COLUMNS_MIN,
  NEWTAB_SHORTCUT_GAP_DEFAULT,
  NEWTAB_SHORTCUT_GAP_MAX,
  NEWTAB_SHORTCUT_GAP_MIN,
  NEWTAB_SHORTCUT_SIZE_DEFAULT,
  NEWTAB_SHORTCUT_SIZE_MAX,
  NEWTAB_SHORTCUT_SIZE_MIN,
  inferNewtabShortcutColumnsFromWidth,
  newtabShortcutColumns,
  newtabShortcutWidth
} from './newtab-shortcuts';
import { NEWTAB_SHORTCUT_WIDTH_DEFAULT, NEWTAB_SHORTCUT_WIDTH_MAX, NEWTAB_SHORTCUT_WIDTH_MIN, newtabShortcutAddVisible, newtabShortcutDockMagnificationEnabled, newtabShortcutGap, newtabShortcutSize, newtabShortcutsVisible } from './newtab-shortcuts';

// How many shortcuts a New Tab row holds, and their size and spacing.
describe('the shortcut grid settings', () => {
  it('keep the old width readable and synced, so existing data can seed the column count once', () => {
    expect(newtabShortcutWidth.key).toBe('_x_extension_newtab_shortcut_width_2026_unique_');
    expect(BROWSER_SYNC_KEYS).toContain(newtabShortcutWidth.key);
    expect(newtabShortcutWidth.parse(undefined)).toBe(920);
  });

  it('hold four to sixteen shortcuts per row, ten by default, synced', () => {
    expect(newtabShortcutColumns.key).toBe('_x_extension_newtab_shortcut_columns_2026_unique_');
    expect(BROWSER_SYNC_KEYS).toContain(newtabShortcutColumns.key);
    expect([NEWTAB_SHORTCUT_COLUMNS_MIN, NEWTAB_SHORTCUT_COLUMNS_MAX, NEWTAB_SHORTCUT_COLUMNS_DEFAULT]).toEqual([4, 16, 10]);
    expect(newtabShortcutColumns.parse(undefined)).toBe(10);
    expect(newtabShortcutColumns.parse(3)).toBe(4);
    expect(newtabShortcutColumns.parse(10.6)).toBe(11);
    expect(newtabShortcutColumns.parse(17)).toBe(16);
  });

  it('read a column count from an old pixel width', () => {
    expect(inferNewtabShortcutColumnsFromWidth(360)).toBe(4);
    expect(inferNewtabShortcutColumnsFromWidth(920)).toBe(10);
    expect(inferNewtabShortcutColumnsFromWidth(1440)).toBe(16);
  });

  it('size tiles from 48 to 112 px and space them 0 to 24 px apart', () => {
    expect([NEWTAB_SHORTCUT_SIZE_MIN, NEWTAB_SHORTCUT_SIZE_MAX, NEWTAB_SHORTCUT_SIZE_DEFAULT]).toEqual([48, 112, 64]);
    expect([NEWTAB_SHORTCUT_GAP_MIN, NEWTAB_SHORTCUT_GAP_MAX, NEWTAB_SHORTCUT_GAP_DEFAULT]).toEqual([0, 24, 4]);
  });
});

describe('the shortcut section settings', () => {
  it('shows the shortcuts, the add tile and the dock magnification unless turned off', () => {
    [newtabShortcutsVisible, newtabShortcutAddVisible, newtabShortcutDockMagnificationEnabled].forEach((setting) => {
      expect([false, true, undefined, 'false'].map((value) => setting.parse(value))).toEqual([false, true, true, true]);
    });
    expect(newtabShortcutAddVisible.key).toBe('_x_extension_newtab_shortcut_add_visible_2026_unique_');
    expect(newtabShortcutDockMagnificationEnabled.key).toBe('_x_extension_newtab_shortcut_dock_magnification_enabled_2026_unique_');
  });

  it('keeps the old width within 360 to 1440 px, rounded', () => {
    expect([NEWTAB_SHORTCUT_WIDTH_MIN, NEWTAB_SHORTCUT_WIDTH_MAX, NEWTAB_SHORTCUT_WIDTH_DEFAULT]).toEqual([360, 1440, 920]);
    expect([359, 920, 1441, 720.5].map((value) => newtabShortcutWidth.parse(value))).toEqual([360, 920, 1440, 721]);
  });

  it('rounds half a column up and keeps tile size and spacing within range', () => {
    expect(newtabShortcutColumns.parse(10.5)).toBe(11);
    expect([undefined, 47, 113].map((value) => newtabShortcutSize.parse(value))).toEqual([64, 48, 112]);
    expect([undefined, -1, 25].map((value) => newtabShortcutGap.parse(value))).toEqual([4, 0, 24]);
  });
});
