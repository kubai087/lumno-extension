import { describe, expect, it } from 'vitest';
import { BOOKMARK_TOPBAR_SURFACE_KEYS } from './bookmarks';
import { SETTINGS_MIGRATIONS, SETTINGS_SCHEMA_VERSION, applySettingsPatch, getSettingsMigrationReads, planSettingsMigrations } from './migrations';
import type { SettingsMigration, SettingsSnapshot } from './migrations';
import { OVERLAY_FONT_KEYS } from './overlay-panel';
import { BROWSER_SYNC_KEYS } from './registry';
import { LANGUAGE_MESSAGES_KEY, LEGACY_SITE_SEARCH_ICON_KEYS, REMOVED_AI_LOCAL_KEYS, REMOVED_AI_SYNC_KEYS } from './removed';
import { settingsSchemaVersion } from './sync-state';
import { AI_SEARCH_LOCAL, AI_SEARCH_SYNC, BOOKMARK_TOPBAR_SYNC, LANGUAGE_MESSAGES_CACHE, LEGACY_ICON_CACHES, OVERLAY_FONT_SYNC, SHARED_SYNC_PREFERENCES } from '../../../tests/fakes/older-device-settings';

const EMPTY: SettingsSnapshot = { sync: {}, local: {} };

describe('settings migrations', () => {
  it('numbers the migrations 1, 2, 3... so every device runs each once, and says why each exists', () => {
    const versions = SETTINGS_MIGRATIONS.map((migration) => migration.version);
    expect(versions).toEqual(versions.map((_, index) => index + 1));
    expect(SETTINGS_SCHEMA_VERSION).toBe(versions[versions.length - 1]);
    SETTINGS_MIGRATIONS.forEach((migration) => {
      expect(migration.summary.length, `migration ${migration.version}`).toBeGreaterThan(0);
    });
  });

  it('never removes a preference the current version syncs, nor the version record', () => {
    const plan = planSettingsMigrations(0, EMPTY);
    const live = new Set(BROWSER_SYNC_KEYS);
    expect(plan.patch.sync.remove.filter((key) => live.has(key))).toEqual([]);
    expect(plan.patch.local.remove).not.toContain(settingsSchemaVersion.key);
  });

  it('cleans up what older versions left on an old device and leaves shared preferences alone', () => {
    const plan = planSettingsMigrations(undefined, {
      sync: { ...SHARED_SYNC_PREFERENCES, ...AI_SEARCH_SYNC, ...BOOKMARK_TOPBAR_SYNC, ...OVERLAY_FONT_SYNC },
      local: { [LANGUAGE_MESSAGES_KEY]: LANGUAGE_MESSAGES_CACHE, ...AI_SEARCH_LOCAL, ...LEGACY_ICON_CACHES }
    });
    expect(plan.version).toBe(SETTINGS_SCHEMA_VERSION);
    expect(plan.patch.sync.set).toEqual({});
    expect(plan.patch.local.set).toEqual({});
    expect(new Set(plan.patch.sync.remove)).toEqual(new Set([
      LANGUAGE_MESSAGES_KEY, ...REMOVED_AI_SYNC_KEYS, ...BOOKMARK_TOPBAR_SURFACE_KEYS, ...OVERLAY_FONT_KEYS
    ]));
    expect(new Set(plan.patch.local.remove)).toEqual(new Set([
      LANGUAGE_MESSAGES_KEY, ...REMOVED_AI_LOCAL_KEYS, ...LEGACY_SITE_SEARCH_ICON_KEYS
    ]));
    Object.keys(SHARED_SYNC_PREFERENCES).forEach((key) => {
      expect(plan.patch.sync.remove).not.toContain(key);
    });
  });

  it('skips what a device already ran and changes nothing on a current device', () => {
    const partial = planSettingsMigrations(3, EMPTY);
    expect(partial.version).toBe(SETTINGS_SCHEMA_VERSION);
    expect(partial.patch.local.remove).toEqual([]);
    expect(planSettingsMigrations(SETTINGS_SCHEMA_VERSION, EMPTY).patch).toEqual({ sync: { set: {}, remove: [] }, local: { set: {}, remove: [] } });
  });

  it('keeps the version of a device that ran a newer release', () => {
    expect(planSettingsMigrations(99, EMPTY).version).toBe(99);
  });

  it('reads only a whole stored version', () => {
    expect(settingsSchemaVersion.parse('3')).toBe(0);
    expect(settingsSchemaVersion.parse(2.5)).toBe(0);
  });

  it('runs each migration on the data the ones before it left, without changing its input', () => {
    const chain: SettingsMigration[] = [
      {
        version: 1,
        summary: 'rename',
        reads: { sync: ['old'], local: [] },
        migrate: (snapshot) => ({
          sync: { set: { renamed: snapshot.sync.old }, remove: ['old'] },
          local: { set: { scratch: 1 }, remove: [] }
        })
      },
      {
        version: 2,
        summary: 'convert',
        reads: { sync: ['renamed'], local: ['scratch'] },
        migrate: (snapshot) => ({
          sync: { set: { converted: `${String(snapshot.sync.renamed)}!` }, remove: [] },
          local: { set: {}, remove: ['scratch'] }
        })
      }
    ];
    expect(getSettingsMigrationReads(chain)).toEqual({ sync: ['old', 'renamed'], local: ['scratch'] });
    const snapshot: SettingsSnapshot = { sync: { old: 'value', kept: true }, local: {} };
    const plan = planSettingsMigrations(0, snapshot, chain);
    expect(plan.version).toBe(2);
    expect(plan.patch).toEqual({
      sync: { set: { renamed: 'value', converted: 'value!' }, remove: ['old'] },
      local: { set: {}, remove: ['scratch'] }
    });
    expect(applySettingsPatch(snapshot, plan.patch)).toEqual({ sync: { kept: true, renamed: 'value', converted: 'value!' }, local: {} });
    expect(snapshot).toEqual({ sync: { old: 'value', kept: true }, local: {} });
    expect(planSettingsMigrations(1, snapshot, chain).patch.sync.set.converted).toBe('undefined!');
  });
});
