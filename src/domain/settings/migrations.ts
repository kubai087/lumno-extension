// Versioned migrations of what this device keeps in storage. Each device
// records the schema version it has reached in its local area; the
// background runs the migrations past that version, in order, once.
//
// Synced preferences are not rewritten here: devices on older versions
// share them and keep writing their older shapes, so the normalizers in
// schemas in this folder read every shape back instead. The migrations clean up and
// convert data this device's own older versions left behind.
import type { StorageItems } from '../storage-port';
import { BOOKMARK_TOPBAR_SURFACE_SETTINGS } from './bookmarks';
import { newtabGlassAdaptive, newtabGlassStyle, newtabThemeMode, newtabThemeScope } from './newtab-page';
import { OVERLAY_FONT_SETTINGS } from './overlay-panel';
import {
  LANGUAGE_MESSAGES_KEY,
  LEGACY_SITE_SEARCH_ICON_KEYS,
  NEWTAB_GLASS_THEME_KEY,
  REMOVED_AI_LOCAL_KEYS,
  REMOVED_AI_SYNC_KEYS
} from './removed';
import { settingsSchemaVersion } from './sync-state';

type SettingsArea = 'sync' | 'local';

// What the migrations read: the values of their keys in each area.
type SettingsSnapshot = Record<SettingsArea, StorageItems>;

// Changes to one area: values to write and keys to remove. A key is in at
// most one of the two.
interface SettingsAreaPatch {
  set: StorageItems;
  remove: string[];
}

type SettingsPatch = Record<SettingsArea, SettingsAreaPatch>;

interface SettingsMigration {
  // The schema version the device is at after this migration.
  version: number;
  // Why the data changes, for the people reading this list.
  summary: string;
  // The keys whose values migrate() reads.
  reads: Readonly<Record<SettingsArea, readonly string[]>>;
  migrate(snapshot: SettingsSnapshot): SettingsPatch;
}

interface SettingsMigrationPlan {
  // The version the device reaches once the patch is written.
  version: number;
  patch: SettingsPatch;
}

const NO_READS: Readonly<Record<SettingsArea, readonly string[]>> = Object.freeze({ sync: [], local: [] });

function createEmptyPatch(): SettingsPatch {
  return { sync: { set: {}, remove: [] }, local: { set: {}, remove: [] } };
}

// A patch that removes keys, whether or not they are stored.
function removeKeys(keys: Partial<Record<SettingsArea, readonly string[]>>): SettingsPatch {
  const patch = createEmptyPatch();
  patch.sync.remove = (keys.sync || []).slice();
  patch.local.remove = (keys.local || []).slice();
  return patch;
}

// A material held light or dark kept the whole New Tab in that theme and stopped the glass
// from turning dark over a dark wallpaper. The page keeps that theme as its own, shown as such
// in the Appearance panel, and the glass stays out of the wallpaper's way. Preferences live in
// browser sync or, when the user keeps them on this device, in the local area, so each area
// converts what it holds.
function convertNewtabGlassTheme(values: StorageItems, patch: SettingsAreaPatch): void {
  const held = values[NEWTAB_GLASS_THEME_KEY];
  if (held !== 'light' && held !== 'dark') {
    return;
  }
  patch.set[newtabGlassAdaptive.key] = false;
  if (newtabGlassStyle.parse(values[newtabGlassStyle.key]) !== 'none') {
    patch.set[newtabThemeMode.key] = held;
    patch.set[newtabThemeScope.key] = 'home';
  }
}

function migrateNewtabGlassTheme(snapshot: SettingsSnapshot): SettingsPatch {
  const patch = removeKeys({ sync: [NEWTAB_GLASS_THEME_KEY], local: [NEWTAB_GLASS_THEME_KEY] });
  convertNewtabGlassTheme(snapshot.sync, patch.sync);
  convertNewtabGlassTheme(snapshot.local, patch.local);
  return patch;
}

// In version order. A released migration never changes: a device that ran
// it does not run it again. A new one takes the next version.
const SETTINGS_MIGRATIONS: readonly SettingsMigration[] = Object.freeze([
  {
    version: 1,
    summary: 'Drop the language messages older versions cached in storage.',
    reads: NO_READS,
    migrate: () => removeKeys({ sync: [LANGUAGE_MESSAGES_KEY], local: [LANGUAGE_MESSAGES_KEY] })
  },
  {
    version: 2,
    summary: 'Drop the settings of the removed AI search, including its API key.',
    reads: NO_READS,
    migrate: () => removeKeys({ sync: REMOVED_AI_SYNC_KEYS, local: REMOVED_AI_LOCAL_KEYS })
  },
  {
    version: 3,
    summary: 'Drop the site search icon caches the canonical cache replaced.',
    reads: NO_READS,
    migrate: () => removeKeys({ local: LEGACY_SITE_SEARCH_ICON_KEYS })
  },
  {
    version: 4,
    summary: 'Take the bookmark bar material out of browser sync: it is chosen against this ' +
      'device\'s wallpaper, which browser sync does not carry.',
    reads: NO_READS,
    migrate: () => removeKeys({ sync: BOOKMARK_TOPBAR_SURFACE_SETTINGS.map((setting) => setting.key) })
  },
  {
    version: 5,
    summary: 'Take the overlay fonts out of browser sync, where development builds kept them: ' +
      'they name this computer\'s installed faces.',
    reads: NO_READS,
    migrate: () => removeKeys({ sync: OVERLAY_FONT_SETTINGS.map((setting) => setting.key) })
  },
  {
    version: 6,
    summary: 'Replace the New Tab material theme with the glass adaptive switch: a material held ' +
      'light or dark becomes the New Tab\'s own theme, over which the glass no longer adapts.',
    reads: {
      sync: [NEWTAB_GLASS_THEME_KEY, newtabGlassStyle.key],
      local: [NEWTAB_GLASS_THEME_KEY, newtabGlassStyle.key]
    },
    migrate: migrateNewtabGlassTheme
  }
]);

const SETTINGS_SCHEMA_VERSION = SETTINGS_MIGRATIONS.reduce((latest, migration) => Math.max(latest, migration.version), 0);


function getPendingSettingsMigrations(
  version: unknown,
  migrations: readonly SettingsMigration[] = SETTINGS_MIGRATIONS
): SettingsMigration[] {
  const current = settingsSchemaVersion.parse(version);
  return migrations.filter((migration) => migration.version > current);
}

// The keys to read from each area before planning these migrations.
function getSettingsMigrationReads(migrations: readonly SettingsMigration[]): Record<SettingsArea, string[]> {
  const sync = new Set<string>();
  const local = new Set<string>();
  for (const migration of migrations) {
    migration.reads.sync.forEach((key) => sync.add(key));
    migration.reads.local.forEach((key) => local.add(key));
  }
  return { sync: [...sync], local: [...local] };
}

function applyAreaPatch(values: StorageItems, patch: SettingsAreaPatch): StorageItems {
  const next: StorageItems = { ...values };
  for (const key of patch.remove) {
    delete next[key];
  }
  return Object.assign(next, patch.set);
}

// The snapshot as it reads after the patch is written.
function applySettingsPatch(snapshot: SettingsSnapshot, patch: SettingsPatch): SettingsSnapshot {
  return {
    sync: applyAreaPatch(snapshot.sync, patch.sync),
    local: applyAreaPatch(snapshot.local, patch.local)
  };
}

// One patch with the effect of `first` followed by `second`.
function mergeAreaPatches(first: SettingsAreaPatch, second: SettingsAreaPatch): SettingsAreaPatch {
  const set: StorageItems = { ...first.set };
  const remove = new Set(first.remove);
  for (const key of second.remove) {
    delete set[key];
    remove.add(key);
  }
  for (const [key, value] of Object.entries(second.set)) {
    remove.delete(key);
    set[key] = value;
  }
  return { set, remove: [...remove] };
}

// The changes the migrations past `version` make to `snapshot`, in order:
// each one sees the data as the ones before it left it.
function planSettingsMigrations(
  version: unknown,
  snapshot: SettingsSnapshot,
  migrations: readonly SettingsMigration[] = SETTINGS_MIGRATIONS
): SettingsMigrationPlan {
  const current = settingsSchemaVersion.parse(version);
  let working = snapshot;
  let patch = createEmptyPatch();
  let reached = current;
  for (const migration of getPendingSettingsMigrations(current, migrations)) {
    const step = migration.migrate(working);
    working = applySettingsPatch(working, step);
    patch = {
      sync: mergeAreaPatches(patch.sync, step.sync),
      local: mergeAreaPatches(patch.local, step.local)
    };
    reached = migration.version;
  }
  return { version: reached, patch };
}

export {
  SETTINGS_MIGRATIONS,
  SETTINGS_SCHEMA_VERSION,
  applySettingsPatch,
  getPendingSettingsMigrations,
  getSettingsMigrationReads,
  planSettingsMigrations
};
export type {
  SettingsArea,
  SettingsAreaPatch,
  SettingsMigration,
  SettingsMigrationPlan,
  SettingsPatch,
  SettingsSnapshot
};
