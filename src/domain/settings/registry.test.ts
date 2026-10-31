import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_SETTINGS, BROWSER_SYNC_KEYS, WEBDAV_ONLY_KEYS, getSetting } from './registry';

// The keys browser sync carried in the last release. Older devices read and
// write exactly these, so the list only ever grows.
const RELEASED_BROWSER_SYNC_KEYS: readonly string[] = [
  '_x_extension_theme_mode_2024_unique_',
  '_x_extension_language_2024_unique_',
  '_x_extension_recent_mode_2024_unique_',
  '_x_extension_recent_count_2024_unique_',
  '_x_extension_newtab_width_mode_2026_unique_',
  '_x_extension_newtab_search_width_2026_unique_',
  '_x_extension_newtab_input_auto_focus_enabled_2026_unique_',
  '_x_extension_newtab_quote_prefs_2026_unique_',
  '_x_extension_newtab_theme_mode_2026_unique_',
  '_x_extension_newtab_theme_scope_2026_unique_',
  '_x_extension_newtab_zen_mode_2026_unique_',
  '_x_extension_newtab_wallpaper_2026_unique_',
  '_x_extension_newtab_online_wallpaper_2026_unique_',
  '_x_extension_newtab_link_wallpapers_2026_unique_',
  '_x_extension_newtab_daily_wallpaper_picks_2026_unique_',
  '_x_extension_newtab_curated_mix_excluded_2026_unique_',
  '_x_extension_newtab_wallpaper_overlay_2026_unique_',
  '_x_extension_newtab_wallpaper_effect_2026_unique_',
  '_x_extension_newtab_favicon_2026_unique_',
  '_x_extension_overlay_size_mode_2026_unique_',
  '_x_extension_overlay_width_2026_unique_',
  '_x_extension_overlay_enter_animation_2026_unique_',
  '_x_extension_overlay_page_theme_adaptation_enabled_2026_unique_',
  '_x_extension_bookmark_count_2024_unique_',
  '_x_extension_bookmark_columns_2024_unique_',
  '_x_extension_bookmark_view_mode_2026_unique_',
  '_x_extension_bookmark_folder_icons_visible_2026_unique_',
  '_x_extension_bookmark_folder_color_refs_2026_unique_',
  '_x_extension_bookmark_folder_color_presets_2026_unique_',
  '_x_extension_newtab_pinned_recent_sites_2026_unique_',
  '_x_extension_newtab_hidden_recent_sites_2026_unique_',
  '_x_extension_newtab_shortcuts_2026_unique_',
  '_x_extension_newtab_shortcuts_chunk_2_2026_unique_',
  '_x_extension_newtab_shortcuts_chunk_3_2026_unique_',
  '_x_extension_newtab_shortcuts_v2_2026_unique_',
  '_x_extension_newtab_shortcuts_v2_chunk_2_2026_unique_',
  '_x_extension_newtab_shortcuts_v2_chunk_3_2026_unique_',
  '_x_extension_newtab_shortcuts_visible_2026_unique_',
  '_x_extension_newtab_shortcut_add_visible_2026_unique_',
  '_x_extension_newtab_shortcut_dock_magnification_enabled_2026_unique_',
  '_x_extension_newtab_feedback_button_visible_2026_unique_',
  '_x_extension_newtab_appearance_button_visible_2026_unique_',
  '_x_extension_newtab_glass_style_2026_unique_',
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
  '_x_extension_tab_switcher_current_window_only_2026_unique_',
  '_x_extension_document_pip_enabled_2026_unique_',
  '_x_extension_pinned_tab_recovery_enabled_2026_unique_',
  '_x_extension_link_preview_enabled_2026_unique_',
  '_x_extension_selection_quick_actions_enabled_2026_unique_',
  '_x_extension_selection_quick_actions_provider_2026_unique_',
  '_x_extension_selection_quick_actions_group_enabled_2026_unique_',
  '_x_extension_overlay_tab_priority_2024_unique_',
  '_x_extension_newtab_wordmark_visible_2026_unique_',
  '_x_extension_newtab_time_font_weight_2026_unique_',
  '_x_extension_newtab_time_font_size_2026_unique_',
  '_x_extension_newtab_time_opacity_2026_unique_',
  '_x_extension_newtab_time_ink_2026_unique_',
  '_x_extension_newtab_time_font_2026_unique_',
  '_x_extension_newtab_time_seconds_visible_2026_unique_',
  '_x_extension_newtab_time_12_hour_2026_unique_',
  '_x_extension_restricted_action_2024_unique_',
  '_x_extension_search_result_priority_2026_unique_',
  '_x_extension_search_result_source_types_2026_unique_',
  '_x_extension_search_result_display_limit_2026_unique_',
  '_x_extension_search_result_tab_position_2026_unique_',
  '_x_extension_search_fuzzy_pinyin_enabled_2026_unique_',
  '_x_extension_overlay_open_tabs_default_visible_2026_unique_',
  '_x_extension_overlay_open_in_current_tab_2026_unique_',
  '_x_extension_fallback_hotkey_2024_unique_',
  '_x_extension_site_search_custom_2024_unique_',
  '_x_extension_site_search_disabled_2024_unique_',
  '_x_extension_aggregate_searches_2026_unique_',
  '_x_extension_aggregate_search_auto_group_enabled_2026_unique_',
  '_x_extension_search_source_order_2026_unique_',
  '_x_extension_progress_tracking_enabled_2026_unique_',
  '_x_extension_newtab_open_in_new_tab_2026_unique_',
  '_x_extension_search_blacklist_2026_unique_',
  '_x_extension_favicon_request_blacklist_2026_unique_',
  '_x_extension_favicon_enhanced_fetch_enabled_2026_unique_',
  '_x_extension_default_search_engine_2024_unique_'
];

const ROOT = process.cwd();

function listSourceFiles(directory: string): string[] {
  return readdirSync(join(ROOT, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return listSourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('settings registry', () => {
  it('gives every setting its own key', () => {
    const keys = ALL_SETTINGS.map((setting) => setting.key);
    expect(keys.filter((key, index) => keys.indexOf(key) !== index)).toEqual([]);
  });

  it('keeps every key browser sync carried in the last release', () => {
    expect(RELEASED_BROWSER_SYNC_KEYS.filter((key) => !BROWSER_SYNC_KEYS.includes(key))).toEqual([]);
    expect(BROWSER_SYNC_KEYS.filter((key) => !RELEASED_BROWSER_SYNC_KEYS.includes(key))).toEqual([
      '_x_extension_bookmark_topbar_layout_2026_unique_'
    ]);
  });

  it('carries only preferences through browser sync and only device values through WebDAV alone', () => {
    BROWSER_SYNC_KEYS.forEach((key) => expect(getSetting(key)?.area).toBe('preferences'));
    WEBDAV_ONLY_KEYS.forEach((key) => expect(getSetting(key)?.area).toBe('device'));
  });

  it('spells each key only in its declaration', () => {
    const outside = listSourceFiles('src')
      .filter((path) => !path.startsWith('src/domain/settings/'))
      .flatMap((path) => {
        const text = readFileSync(join(ROOT, path), 'utf8');
        return ALL_SETTINGS.filter((setting) => text.includes(`'${setting.key}'`) || text.includes(`"${setting.key}"`))
          .map((setting) => `${path}: ${setting.key}`);
      });
    expect(outside).toEqual([]);
  });

  it('reads nothing stored as the default', () => {
    ALL_SETTINGS.forEach((setting) => expect(setting.parse(undefined)).toEqual(setting.default));
  });
});
