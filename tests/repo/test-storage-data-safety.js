const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const settings = require('../../src/shared/settings.js');
const shortcutFavicon = require('../../src/shared/favicon/shortcut-favicon.js');
const repoRoot = path.join(__dirname, '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'manifest.json'), 'utf8'));
const expectedDevelopmentExtensionId = 'kkcjcneagmlhpeaafngjdlpcfjakejgb';
const expectedSyncKeys = [
  '_x_extension_theme_mode_2024_unique_',
  '_x_extension_language_2024_unique_',
  '_x_extension_recent_mode_2024_unique_',
  '_x_extension_recent_count_2024_unique_',
  '_x_extension_newtab_width_mode_2026_unique_',
  '_x_extension_newtab_search_width_2026_unique_',
  '_x_extension_newtab_input_auto_focus_enabled_2026_unique_',
  // Additive preference: missing values leave daily quotes disabled.
  '_x_extension_newtab_quote_prefs_2026_unique_',
  '_x_extension_newtab_theme_mode_2026_unique_',
  '_x_extension_newtab_theme_scope_2026_unique_',
  '_x_extension_newtab_zen_mode_2026_unique_',
  '_x_extension_newtab_wallpaper_2026_unique_',
  '_x_extension_newtab_online_wallpaper_2026_unique_',
  '_x_extension_newtab_link_wallpapers_2026_unique_',
  '_x_extension_newtab_daily_wallpaper_picks_2026_unique_',
  // Additive preference: an absent value keeps every category in the random mix.
  '_x_extension_newtab_curated_mix_excluded_2026_unique_',
  '_x_extension_newtab_wallpaper_overlay_2026_unique_',
  '_x_extension_newtab_wallpaper_effect_2026_unique_',
  '_x_extension_newtab_favicon_2026_unique_',
  '_x_extension_overlay_size_mode_2026_unique_',
  '_x_extension_overlay_enter_animation_2026_unique_',
  '_x_extension_overlay_page_theme_adaptation_enabled_2026_unique_',
  '_x_extension_bookmark_count_2024_unique_',
  '_x_extension_bookmark_columns_2024_unique_',
  '_x_extension_bookmark_view_mode_2026_unique_',
  '_x_extension_bookmark_folder_icons_visible_2026_unique_',
  // Added with an explicit migration: new tab moves the device-only id-keyed
  // folder colors into the path-keyed map, and background startup copies saved
  // colors from local storage into sync.
  '_x_extension_bookmark_folder_color_refs_2026_unique_',
  '_x_extension_bookmark_folder_color_presets_2026_unique_',
  '_x_extension_newtab_pinned_recent_sites_2026_unique_',
  '_x_extension_newtab_hidden_recent_sites_2026_unique_',
  '_x_extension_newtab_shortcuts_2026_unique_',
  '_x_extension_newtab_shortcuts_chunk_2_2026_unique_',
  '_x_extension_newtab_shortcuts_chunk_3_2026_unique_',
  // Grouped shortcut state; the three keys above stay readable for migration.
  '_x_extension_newtab_shortcuts_v2_2026_unique_',
  '_x_extension_newtab_shortcuts_v2_chunk_2_2026_unique_',
  '_x_extension_newtab_shortcuts_v2_chunk_3_2026_unique_',
  '_x_extension_newtab_shortcuts_visible_2026_unique_',
  '_x_extension_newtab_shortcut_add_visible_2026_unique_',
  '_x_extension_newtab_shortcut_dock_magnification_enabled_2026_unique_',
  '_x_extension_newtab_feedback_button_visible_2026_unique_',
  '_x_extension_newtab_appearance_button_visible_2026_unique_',
  // Additive preference: a missing value keeps the original New Tab surfaces.
  '_x_extension_newtab_glass_style_2026_unique_',
  // Additive preference: a missing value follows the New Tab's own theme.
  '_x_extension_newtab_glass_theme_2026_unique_',
  '_x_extension_newtab_shortcut_width_2026_unique_',
  '_x_extension_newtab_shortcut_columns_2026_unique_',
  '_x_extension_newtab_shortcut_size_2026_unique_',
  '_x_extension_newtab_shortcut_gap_2026_unique_',
  '_x_extension_update_notice_enabled_2026_unique_',
  '_x_extension_motion_effects_enabled_2026_unique_',
  '_x_extension_simple_mode_enabled_2026_unique_',
  '_x_extension_number_shortcut_instant_enabled_2026_unique_',
  '_x_extension_macos_ctrl_suggestion_navigation_enabled_2026_unique_',
  '_x_extension_auto_pip_enabled_2026_unique_',
  '_x_extension_tab_switcher_enabled_2026_unique_',
  // New opt-in preference: a missing key keeps existing focus navigation.
  '_x_extension_tab_switcher_shift_tab_enabled_2026_unique_',
  '_x_extension_document_pip_enabled_2026_unique_',
  '_x_extension_pinned_tab_recovery_enabled_2026_unique_',
  '_x_extension_link_preview_enabled_2026_unique_',
  '_x_extension_selection_quick_actions_enabled_2026_unique_',
  '_x_extension_selection_quick_actions_provider_2026_unique_',
  '_x_extension_selection_quick_actions_group_enabled_2026_unique_',
  '_x_extension_overlay_tab_priority_2024_unique_',
  '_x_extension_newtab_wordmark_visible_2026_unique_',
  '_x_extension_newtab_time_font_weight_2026_unique_',
  // Additive preferences: absent values keep the 54px clock at full opacity.
  '_x_extension_newtab_time_font_size_2026_unique_',
  '_x_extension_newtab_time_opacity_2026_unique_',
  // Additive preference: an absent value keeps the automatic clock ink.
  '_x_extension_newtab_time_ink_2026_unique_',
  // Additive preference: an absent value keeps the Open Sans clock.
  '_x_extension_newtab_time_font_2026_unique_',
  '_x_extension_newtab_time_seconds_visible_2026_unique_',
  // Additive preference: an absent value keeps the 24-hour clock.
  '_x_extension_newtab_time_12_hour_2026_unique_',
  '_x_extension_restricted_action_2024_unique_',
  '_x_extension_search_result_priority_2026_unique_',
  '_x_extension_search_result_source_types_2026_unique_',
  '_x_extension_search_result_display_limit_2026_unique_',
  // Additive preference: absent values preserve the original browser tab-opening paths.
  '_x_extension_search_result_tab_position_2026_unique_',
  // Additive preference: a missing value keeps exact pinyin matching.
  '_x_extension_search_fuzzy_pinyin_enabled_2026_unique_',
  '_x_extension_overlay_open_tabs_default_visible_2026_unique_',
  '_x_extension_fallback_hotkey_2024_unique_',
  '_x_extension_site_search_custom_2024_unique_',
  '_x_extension_site_search_disabled_2024_unique_',
  '_x_extension_aggregate_searches_2026_unique_',
  '_x_extension_aggregate_search_auto_group_enabled_2026_unique_',
  // Additive preference: the reader's order for the Search sources lists and
  // the search scope groups. An absent value keeps the usual order.
  '_x_extension_search_source_order_2026_unique_',
  '_x_extension_progress_tracking_enabled_2026_unique_',
  '_x_extension_newtab_open_in_new_tab_2026_unique_',
  '_x_extension_search_blacklist_2026_unique_',
  '_x_extension_favicon_request_blacklist_2026_unique_',
  '_x_extension_favicon_enhanced_fetch_enabled_2026_unique_',
  '_x_extension_default_search_engine_2024_unique_'
];

function getExtensionIdFromManifestKey(key) {
  const digest = crypto
    .createHash('sha256')
    .update(Buffer.from(String(key || ''), 'base64'))
    .digest('hex')
    .slice(0, 32);
  return Array.from(digest, (character) =>
    String.fromCharCode('a'.charCodeAt(0) + Number.parseInt(character, 16))
  ).join('');
}

assert.strictEqual(
  getExtensionIdFromManifestKey(manifest.key),
  expectedDevelopmentExtensionId,
  'the manifest key is the development installation identity and must not change accidentally'
);
assert(
  Array.isArray(manifest.permissions) && manifest.permissions.includes('storage'),
  'the extension must retain its storage permission'
);

assert.deepStrictEqual(
  settings.CHROME_SYNC_STORAGE_KEYS,
  expectedSyncKeys,
  'sync storage keys are a persisted data contract; changes require an explicit migration'
);

const sourceFiles = [];
// Reviewed contracts below are written with POSIX separators. Windows returns
// backslashes from path.relative(), so normalize before comparing instead of
// reporting every path as an unreviewed removal.
function toPosixPath(file) {
  return path.relative(repoRoot, file).split(path.sep).join('/');
}
function collectSourceFiles(directory) {
  fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(entryPath);
    } else if (entry.isFile() && /\.(?:js|ts|tsx)$/.test(entry.name)) {
      sourceFiles.push(entryPath);
    }
  });
}
collectSourceFiles(path.join(repoRoot, 'src'));

const persistedRemoveCalls = [];
sourceFiles.forEach((file) => {
  const source = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(
    source,
    /chrome\.storage\.(?:sync|local)\.clear\s*\(/,
    `${toPosixPath(file)} must not clear a persisted storage area`
  );
  assert.doesNotMatch(
    source,
    /\b(?:syncArea|localArea|bookmarkTopbarSurfaceStorageArea)\.clear\s*\(/,
    `${toPosixPath(file)} must not clear an aliased persisted storage area`
  );
  const removeCallPattern = /\b(chrome\.storage\.(?:sync|local)|syncArea|localArea|bookmarkTopbarSurfaceStorageArea)\.remove\s*\(\s*([A-Za-z_$][\w$]*)/g;
  let removeCallMatch = removeCallPattern.exec(source);
  while (removeCallMatch) {
    persistedRemoveCalls.push(
      `${toPosixPath(file)}:${removeCallMatch[1]}:${removeCallMatch[2]}`
    );
    removeCallMatch = removeCallPattern.exec(source);
  }
});

assert.deepStrictEqual(
  persistedRemoveCalls.sort(),
  [
    'src/background/background.js:chrome.storage.sync:BOOKMARK_TOPBAR_LOCAL_STORAGE_KEYS',
    'src/background/background.js:chrome.storage.sync:LANGUAGE_MESSAGES_STORAGE_KEY',
    'src/background/background.js:chrome.storage.sync:OVERLAY_FONT_LOCAL_STORAGE_KEYS',
    'src/background/background.js:localArea:REMOVED_AI_LOCAL_STORAGE_KEYS',
    'src/background/background.js:syncArea:REMOVED_AI_SYNC_STORAGE_KEYS',
    'src/background/favicon-service.js:localArea:legacyKeys',
    'src/newtab/bookmarks/bookmark-display-settings.js:bookmarkTopbarSurfaceStorageArea:BOOKMARK_TOPBAR_SURFACE_COLOR_STORAGE_KEY',
    'src/newtab/bookmarks/bookmark-display-settings.js:localArea:BOOKMARK_TOPBAR_SURFACE_COLOR_STORAGE_KEY',
    'src/newtab/bookmarks/bookmark-display-settings.js:syncArea:cleanupKeys'
  ],
  'persisted storage removals must remain limited to the reviewed legacy cleanup paths'
);
assert.strictEqual(
  settings.BOOKMARK_TOPBAR_LOCAL_STORAGE_KEYS.some((key) => expectedSyncKeys.includes(key)),
  false,
  'legacy bookmark topbar cleanup keys must never overlap active sync settings'
);
// The overlay font keys never shipped in Chrome Sync (only development builds
// wrote them there), so clearing those copies removes no released setting.
assert.strictEqual(
  settings.OVERLAY_FONT_LOCAL_STORAGE_KEYS.some((key) => expectedSyncKeys.includes(key)),
  false,
  'device-local overlay font keys must never overlap active sync settings'
);
assert.strictEqual(
  shortcutFavicon.SITE_SEARCH_LEGACY_STORAGE_KEYS.some((key) => expectedSyncKeys.includes(key)),
  false,
  'legacy site-search icon cache keys must never overlap active sync settings'
);
[
  '_x_extension_ai_search_mode_2026_unique_',
  '_x_extension_ai_provider_2026_unique_',
  '_x_extension_ai_entitlement_cache_2026_unique_',
  '_x_extension_ai_api_key_2026_unique_',
  '_x_extension_language_messages_2024_unique_'
].forEach((legacyKey) => {
  assert.strictEqual(
    expectedSyncKeys.includes(legacyKey),
    false,
    `reviewed legacy cleanup key ${legacyKey} must not become an active sync setting`
  );
});

// Background and New Tab move local settings into sync through one shared
// helper. It never removes anything and treats grouped shortcuts as one save.
{
  const [V2_HEAD, V2_CHUNK_2] = settings.NEWTAB_SHORTCUTS_V2_STORAGE_KEYS;
  const PLAIN_KEY = settings.THEME_STORAGE_KEY;
  function runMigration(sync, local, keys, syncAfterFirstRead) {
    const writes = [];
    let syncReads = 0;
    const forbidden = () => { throw new Error('migration must not remove or clear data'); };
    const syncArea = {
      get(requested, callback) {
        syncReads += 1;
        callback(syncReads > 1 && syncAfterFirstRead ? { ...sync, ...syncAfterFirstRead } : { ...sync });
      },
      set(payload) { writes.push(payload); },
      remove: forbidden,
      clear: forbidden
    };
    const localArea = { get(requested, callback) { callback({ ...local }); }, remove: forbidden, clear: forbidden };
    settings.migrateLocalSettingsToSync(localArea, syncArea, keys);
    return writes;
  }
  const allKeys = [PLAIN_KEY, ...settings.NEWTAB_SHORTCUTS_V2_STORAGE_KEYS];
  assert.deepStrictEqual(runMigration({}, { [PLAIN_KEY]: 'dark' }, allKeys), [{ [PLAIN_KEY]: 'dark' }]);
  assert.deepStrictEqual(runMigration({ [PLAIN_KEY]: 'light' }, { [PLAIN_KEY]: 'dark' }, allKeys), [],
    'a value already in sync is kept');
  assert.deepStrictEqual(runMigration({}, { [PLAIN_KEY]: 'dark' }, allKeys, { [PLAIN_KEY]: 'light' }), [],
    'a value synced after the first read is not overwritten');
  assert.deepStrictEqual(runMigration({}, { [V2_CHUNK_2]: ['b'] }, allKeys), [],
    'a local chunk without its head never moves on its own');
  assert.deepStrictEqual(
    runMigration({ [V2_CHUNK_2]: ['stray'] }, { [V2_HEAD]: { v: 2 }, [V2_CHUNK_2]: ['b'] }, allKeys),
    [{ [V2_HEAD]: { v: 2 }, [V2_CHUNK_2]: ['b'] }],
    'the whole local grouped save moves with its head, replacing a stray chunk in sync'
  );
  assert.deepStrictEqual(
    runMigration({ [V2_HEAD]: { v: 3 } }, { [V2_HEAD]: { v: 2 }, [V2_CHUNK_2]: ['b'] }, allKeys),
    [],
    'no local chunk moves next to a head sync already has'
  );
  assert.deepStrictEqual(
    runMigration({}, { [V2_HEAD]: { v: 2 }, [V2_CHUNK_2]: ['b'], [PLAIN_KEY]: 'dark' }, allKeys, { [V2_HEAD]: { v: 3 } }),
    [{ [PLAIN_KEY]: 'dark' }],
    'once another device syncs a grouped save, none of the local one moves'
  );
}

console.log('storage data safety tests passed');
