// New Tab shortcuts: how the grid is laid out, and where the shortcut list,
// its icons and its folder links are stored. The list's own format (groups
// spread over three sync items, and the older flat list) belongs to
// domain/shortcuts-store.ts.
import { defineSetting } from './define';
import { flag, integer, opaque } from './schema';

// Bounds for a stored number: values are held within min and max, and a
// missing or invalid value becomes the fallback.
interface RangeOptions {
  min?: number;
  max?: number;
  fallback?: number;
}

interface ShortcutColumnsFromWidthOptions {
  widthMin?: number;
  widthMax?: number;
  columnsMin?: number;
  columnsMax?: number;
}

const NEWTAB_SHORTCUT_WIDTH_MIN = 360;
const NEWTAB_SHORTCUT_WIDTH_MAX = 1440;
const NEWTAB_SHORTCUT_WIDTH_DEFAULT = 920;
const NEWTAB_SHORTCUT_COLUMNS_MIN = 4;
const NEWTAB_SHORTCUT_COLUMNS_MAX = 16;
const NEWTAB_SHORTCUT_COLUMNS_DEFAULT = 10;
const NEWTAB_SHORTCUT_SIZE_MIN = 48;
const NEWTAB_SHORTCUT_SIZE_MAX = 112;
const NEWTAB_SHORTCUT_SIZE_DEFAULT = 64;
const NEWTAB_SHORTCUT_GAP_MIN = 0;
const NEWTAB_SHORTCUT_GAP_MAX = 24;
const NEWTAB_SHORTCUT_GAP_DEFAULT = 4;

const newtabShortcutsVisible = defineSetting({
  key: '_x_extension_newtab_shortcuts_visible_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: flag(true)
});

const newtabShortcutAddVisible = defineSetting({
  key: '_x_extension_newtab_shortcut_add_visible_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: flag(true)
});

const newtabShortcutDockMagnificationEnabled = defineSetting({
  key: '_x_extension_newtab_shortcut_dock_magnification_enabled_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: flag(true)
});

// The grid width older versions stored; the column count replaced it and is
// inferred from it when only the width is stored.
const newtabShortcutWidth = defineSetting({
  key: '_x_extension_newtab_shortcut_width_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: integer({ min: NEWTAB_SHORTCUT_WIDTH_MIN, max: NEWTAB_SHORTCUT_WIDTH_MAX, fallback: NEWTAB_SHORTCUT_WIDTH_DEFAULT })
});

const newtabShortcutColumns = defineSetting({
  key: '_x_extension_newtab_shortcut_columns_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: integer({ min: NEWTAB_SHORTCUT_COLUMNS_MIN, max: NEWTAB_SHORTCUT_COLUMNS_MAX, fallback: NEWTAB_SHORTCUT_COLUMNS_DEFAULT })
});

const newtabShortcutSize = defineSetting({
  key: '_x_extension_newtab_shortcut_size_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: integer({ min: NEWTAB_SHORTCUT_SIZE_MIN, max: NEWTAB_SHORTCUT_SIZE_MAX, fallback: NEWTAB_SHORTCUT_SIZE_DEFAULT })
});

const newtabShortcutGap = defineSetting({
  key: '_x_extension_newtab_shortcut_gap_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: integer({ min: NEWTAB_SHORTCUT_GAP_MIN, max: NEWTAB_SHORTCUT_GAP_MAX, fallback: NEWTAB_SHORTCUT_GAP_DEFAULT })
});

// The grouped shortcut list, spread over three browser sync items.
const newtabShortcutsGroupHead = defineSetting({
  key: '_x_extension_newtab_shortcuts_v2_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: opaque()
});

const newtabShortcutsGroupChunk2 = defineSetting({
  key: '_x_extension_newtab_shortcuts_v2_chunk_2_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: opaque()
});

const newtabShortcutsGroupChunk3 = defineSetting({
  key: '_x_extension_newtab_shortcuts_v2_chunk_3_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: opaque()
});

// The flat list older versions keep writing, in three items.
const newtabShortcutsLegacy = defineSetting({
  key: '_x_extension_newtab_shortcuts_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: opaque()
});

const newtabShortcutsLegacyChunk2 = defineSetting({
  key: '_x_extension_newtab_shortcuts_chunk_2_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: opaque()
});

const newtabShortcutsLegacyChunk3 = defineSetting({
  key: '_x_extension_newtab_shortcuts_chunk_3_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: opaque()
});

// Shortcuts past what browser sync holds, kept on this device.
const newtabShortcutsLocalOverflow = defineSetting({
  key: '_x_extension_newtab_shortcuts_local_overflow_2026_unique_',
  area: 'device',
  schema: opaque()
});

// Icons the reader chose or uploaded, by shortcut. WebDAV carries them as
// image assets (domain/webdav-contract.ts).
const newtabShortcutIcons = defineSetting({
  key: '_x_extension_newtab_shortcut_icons_2026_unique_',
  area: 'device',
  schema: opaque()
});

const newtabShortcutFaviconCache = defineSetting({
  key: '_x_extension_newtab_shortcut_favicon_cache_2026_unique_',
  area: 'cache',
  schema: opaque()
});

// Icons of the sites inside bookmark folder shortcuts.
const shortcutFolderItemIcons = defineSetting({
  key: '_x_extension_shortcut_folder_item_icons_2026_unique_',
  area: 'cache',
  schema: opaque()
});

// Which bookmark folder each folder shortcut opens on this device.
const shortcutFolderBindings = defineSetting({
  key: '_x_extension_shortcut_folder_bindings_2026_unique_',
  area: 'device',
  schema: opaque()
});

const NEWTAB_SHORTCUTS_GROUP_SETTINGS = Object.freeze([
  newtabShortcutsGroupHead,
  newtabShortcutsGroupChunk2,
  newtabShortcutsGroupChunk3
]);
const NEWTAB_SHORTCUTS_LEGACY_SETTINGS = Object.freeze([
  newtabShortcutsLegacy,
  newtabShortcutsLegacyChunk2,
  newtabShortcutsLegacyChunk3
]);

// Every item the shortcut list is stored in, the older flat list included.
const NEWTAB_SHORTCUT_LIST_SETTINGS = Object.freeze([...NEWTAB_SHORTCUTS_GROUP_SETTINGS, ...NEWTAB_SHORTCUTS_LEGACY_SETTINGS]);
const NEWTAB_SHORTCUTS_GROUP_KEYS: readonly string[] = Object.freeze(NEWTAB_SHORTCUTS_GROUP_SETTINGS.map((setting) => setting.key));
const NEWTAB_SHORTCUTS_LEGACY_KEYS: readonly string[] = Object.freeze(NEWTAB_SHORTCUTS_LEGACY_SETTINGS.map((setting) => setting.key));

function getNumberOption(value: unknown, fallback: number): number {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

// A whole number within the range, or the fallback held to it.
function clampToRange(value: unknown, options: RangeOptions | null | undefined, defaults: Required<RangeOptions>): number {
  const config = options || {};
  const min = getNumberOption(config.min, defaults.min);
  const max = getNumberOption(config.max, defaults.max);
  const fallback = getNumberOption(config.fallback, defaults.fallback);
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return Math.min(max, Math.max(min, Math.round(fallback)));
  }
  return Math.min(max, Math.max(min, Math.round(number)));
}

// The column count an older version's stored grid width stands for.
function inferNewtabShortcutColumnsFromWidth(value: unknown, options?: ShortcutColumnsFromWidthOptions | null): number {
  const config = options || {};
  const widthMin = getNumberOption(config.widthMin, NEWTAB_SHORTCUT_WIDTH_MIN);
  const widthMax = getNumberOption(config.widthMax, NEWTAB_SHORTCUT_WIDTH_MAX);
  const columnsMin = getNumberOption(config.columnsMin, NEWTAB_SHORTCUT_COLUMNS_MIN);
  const columnsMax = getNumberOption(config.columnsMax, NEWTAB_SHORTCUT_COLUMNS_MAX);
  const width = clampToRange(value, { min: widthMin, max: widthMax, fallback: NEWTAB_SHORTCUT_WIDTH_DEFAULT }, {
    min: NEWTAB_SHORTCUT_WIDTH_MIN,
    max: NEWTAB_SHORTCUT_WIDTH_MAX,
    fallback: NEWTAB_SHORTCUT_WIDTH_DEFAULT
  });
  const range = Math.max(1, widthMax - widthMin);
  const ratio = (width - widthMin) / range;
  return clampToRange(columnsMin + ratio * (columnsMax - columnsMin), {
    min: columnsMin,
    max: columnsMax,
    fallback: NEWTAB_SHORTCUT_COLUMNS_DEFAULT
  }, {
    min: NEWTAB_SHORTCUT_COLUMNS_MIN,
    max: NEWTAB_SHORTCUT_COLUMNS_MAX,
    fallback: NEWTAB_SHORTCUT_COLUMNS_DEFAULT
  });
}

// The settings that shape the shortcut grid.
const NEWTAB_SHORTCUT_GRID_SETTINGS = [
  newtabShortcutsVisible,
  newtabShortcutAddVisible,
  newtabShortcutDockMagnificationEnabled,
  newtabShortcutColumns,
  newtabShortcutSize,
  newtabShortcutGap
];

export {
  NEWTAB_SHORTCUT_GRID_SETTINGS,
  NEWTAB_SHORTCUT_LIST_SETTINGS,
  NEWTAB_SHORTCUTS_GROUP_KEYS,
  NEWTAB_SHORTCUTS_GROUP_SETTINGS,
  NEWTAB_SHORTCUTS_LEGACY_KEYS,
  NEWTAB_SHORTCUTS_LEGACY_SETTINGS,
  NEWTAB_SHORTCUT_COLUMNS_DEFAULT,
  NEWTAB_SHORTCUT_COLUMNS_MAX,
  NEWTAB_SHORTCUT_COLUMNS_MIN,
  NEWTAB_SHORTCUT_GAP_DEFAULT,
  NEWTAB_SHORTCUT_GAP_MAX,
  NEWTAB_SHORTCUT_GAP_MIN,
  NEWTAB_SHORTCUT_SIZE_DEFAULT,
  NEWTAB_SHORTCUT_SIZE_MAX,
  NEWTAB_SHORTCUT_SIZE_MIN,
  NEWTAB_SHORTCUT_WIDTH_DEFAULT,
  NEWTAB_SHORTCUT_WIDTH_MAX,
  NEWTAB_SHORTCUT_WIDTH_MIN,
  clampToRange,
  inferNewtabShortcutColumnsFromWidth,
  newtabShortcutAddVisible,
  newtabShortcutColumns,
  newtabShortcutDockMagnificationEnabled,
  newtabShortcutFaviconCache,
  newtabShortcutGap,
  newtabShortcutIcons,
  newtabShortcutSize,
  newtabShortcutWidth,
  newtabShortcutsGroupChunk2,
  newtabShortcutsGroupChunk3,
  newtabShortcutsGroupHead,
  newtabShortcutsLegacy,
  newtabShortcutsLegacyChunk2,
  newtabShortcutsLegacyChunk3,
  newtabShortcutsLocalOverflow,
  newtabShortcutsVisible,
  shortcutFolderBindings,
  shortcutFolderItemIcons
};
export type { RangeOptions, ShortcutColumnsFromWidthOptions };
