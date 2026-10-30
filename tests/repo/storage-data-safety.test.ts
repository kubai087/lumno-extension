import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOOKMARK_TOPBAR_SURFACE_KEYS, BROWSER_SYNC_KEYS, OVERLAY_FONT_KEYS } from '../../src/domain/settings';
import { planSettingsMigrations } from '../../src/domain/settings/migrations';
import {
  LANGUAGE_MESSAGES_KEY,
  LEGACY_SITE_SEARCH_ICON_KEYS,
  REMOVED_AI_LOCAL_KEYS,
  REMOVED_AI_SYNC_KEYS
} from '../../src/domain/settings/removed';
import { extensionIdFromManifestKey, isStringArray, listRepoFiles, readRepoJson, repoPath } from './repository';

// What keeps the user's stored data safe across releases. (The keys browser
// sync carries are pinned in src/domain/settings/registry.test.ts.)

const EXPECTED_DEVELOPMENT_EXTENSION_ID = 'kkcjcneagmlhpeaafngjdlpcfjakejgb';

describe('stored data safety', () => {
  it('keeps the development installation identity and the storage permission', () => {
    const manifest = readRepoJson('manifest.json');

    expect(extensionIdFromManifestKey(manifest.key)).toBe(EXPECTED_DEVELOPMENT_EXTENSION_ID);
    expect(isStringArray(manifest.permissions) && manifest.permissions.includes('storage')).toBe(true);
  });

  // Repository rule (no lint covers it): persisted storage is never cleared,
  // and is removed only through the settings store, one setting at a time.
  it('clears no persisted storage area and removes nothing from one directly', () => {
    const sources = listRepoFiles('src', /\.(?:js|ts|tsx)$/).filter((file) => !/\.test\.tsx?$/.test(file)).map((file) => ({ file, source: readFileSync(repoPath(file), 'utf8') }));
    const removals = sources.flatMap(({ file, source }) => [
      ...source.matchAll(/\b(chrome\.storage\.(?:sync|local)|syncArea|localArea|bookmarkTopbarSurfaceStorageArea)\.remove\s*\(\s*([A-Za-z_$][\w$.]*)/g)
    ].map((match) => `${file}:${match[1]}:${match[2]}`));

    expect(sources.filter(({ source }) => /chrome\.storage\.(?:sync|local)\.clear\s*\(/.test(source)).map(({ file }) => file)).toEqual([]);
    expect(sources.filter(({ source }) => /\b(?:syncArea|localArea|bookmarkTopbarSurfaceStorageArea)\.clear\s*\(/.test(source))
      .map(({ file }) => file)).toEqual([]);
    expect(removals).toEqual([]);
  });

  // The settings migrations remove what older versions left behind; these
  // are every key they may remove.
  it('lets the settings migrations remove only the reviewed keys', () => {
    const { patch } = planSettingsMigrations(0, { sync: {}, local: {} });

    expect(patch.sync.remove.slice().sort()).toEqual([
      LANGUAGE_MESSAGES_KEY,
      ...REMOVED_AI_SYNC_KEYS,
      ...BOOKMARK_TOPBAR_SURFACE_KEYS,
      ...OVERLAY_FONT_KEYS
    ].sort());
    expect(patch.local.remove.slice().sort()).toEqual([
      LANGUAGE_MESSAGES_KEY,
      ...REMOVED_AI_LOCAL_KEYS,
      ...LEGACY_SITE_SEARCH_ICON_KEYS
    ].sort());
  });

  // The overlay font keys never shipped in Chrome Sync (only development
  // builds wrote them there), so clearing those copies removes no released
  // setting.
  it('removes no key the current version syncs', () => {
    const removed = [
      ...BOOKMARK_TOPBAR_SURFACE_KEYS,
      ...OVERLAY_FONT_KEYS,
      ...LEGACY_SITE_SEARCH_ICON_KEYS,
      ...REMOVED_AI_SYNC_KEYS,
      ...REMOVED_AI_LOCAL_KEYS,
      LANGUAGE_MESSAGES_KEY
    ];

    expect(removed.filter((key) => BROWSER_SYNC_KEYS.includes(key))).toEqual([]);
  });
});
