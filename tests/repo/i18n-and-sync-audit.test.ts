import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import * as settings from '../../src/domain/settings';
import { REPO_ROOT, readLocaleMessages } from './repository';

// The i18n audit, the copy that explains browser sync, and what syncs.
// (How the pages and the worker move old local choices into sync is checked
// in tests/pages and beside the worker's startup.)

const LOCALES = ['en', 'ja', 'zh_CN', 'zh_TW'];
const messages = Object.fromEntries(LOCALES.map((locale) => [locale, readLocaleMessages(locale)]));

const BROWSER_SYNC_COPY: Record<string, { description: string; hint: string; unavailable: string }> = {
  en: {
    description: 'Settings sync automatically through your current browser\'s built-in sync service',
    hint: 'Lumno settings sync automatically through your current browser\'s built-in sync service. Sync works across devices signed in to the same browser account, but not across different browsers.',
    unavailable: 'Sync unavailable: check whether your current browser supports built-in sync and has it turned on.'
  },
  ja: {
    description: '現在のブラウザの標準同期サービスで設定を自動的に同期します',
    hint: 'Lumno の設定は、現在のブラウザの標準同期サービスで自動的に同期されます。同じブラウザアカウントでログインしている端末間のみ同期でき、異なるブラウザ間では同期できません。',
    unavailable: '同期できません。現在のブラウザが標準同期に対応し、同期が有効になっているか確認してください。'
  },
  zh_CN: {
    description: '配置通过当前浏览器的内置同步服务自动同步',
    hint: 'Lumno 配置通过当前浏览器的内置同步服务自动同步，仅支持同一浏览器账号下的设备，不支持跨浏览器同步。',
    unavailable: '同步不可用：请检查当前浏览器是否支持并已开启内置同步。'
  },
  zh_TW: {
    description: '設定會透過目前瀏覽器的內建同步服務自動同步',
    hint: 'Lumno 設定會透過目前瀏覽器的內建同步服務自動同步；僅支援同一瀏覽器帳號下的裝置，不支援跨瀏覽器同步。',
    unavailable: '同步無法使用：請檢查目前瀏覽器是否支援並已開啟內建同步。'
  }
};

// Labels the React views draw from their locale messages.
const LABEL_KEYS = [
  'settings_overlay_open_tabs_default_visible_title',
  'bookmark_topbar_surface_title',
  'bookmark_topbar_surface_adaptive',
  'bookmark_topbar_surface_clear',
  'bookmark_topbar_surface_transparent',
  'bookmark_topbar_surface_custom',
  'bookmark_topbar_color_pick',
  'bookmark_topbar_color_reset',
  'bookmark_topbar_color_picked',
  'bookmark_topbar_color_reset_done',
  'bookmark_topbar_color_unsupported',
  'bookmark_topbar_color_failed',
  'settings_bookmark_folder_icons_visible_title',
  'settings_newtab_shortcut_add_title',
  'newtab_shortcuts_hide_add',
  'newtab_shortcuts_add_hidden',
  'settings_newtab_shortcut_dock_magnification_title'
];

describe('i18n audit', () => {
  it('leaves no unreviewed candidate', () => {
    const output = execFileSync(process.execPath, ['scripts/check/audit-i18n.js'], { cwd: REPO_ROOT, encoding: 'utf8' });
    const count = output.match(/i18n audit candidate count=(\d+)/);

    expect(count, 'the i18n audit should print a candidate count').not.toBeNull();
    expect(count ? Number(count[1]) : NaN, output).toBe(0);
  });

  it.each(LOCALES)('explains browser sync in %s as the current browser, not Chrome, within one browser account', (locale) => {
    expect(messages[locale].settings_sync_desc).toBe(BROWSER_SYNC_COPY[locale].description);
    expect(messages[locale].sync_status_hint).toBe(BROWSER_SYNC_COPY[locale].hint);
    expect(messages[locale].sync_status_unavailable_hint).toBe(BROWSER_SYNC_COPY[locale].unavailable);
  });

  it.each(LOCALES)('localizes the labels the React views draw in %s', (locale) => {
    expect(LABEL_KEYS.filter((key) => !String(messages[locale][key] || '').trim())).toEqual([]);
  });
});

// What browser sync, WebDAV and settings export carry, and what stays on
// this device.
describe('the sync contract', () => {
  it.each([
    ['_x_extension_overlay_enter_animation_2026_unique_', settings.overlayEnterAnimation],
    ['_x_extension_bookmark_view_mode_2026_unique_', settings.bookmarkViewMode],
    ['_x_extension_bookmark_folder_icons_visible_2026_unique_', settings.bookmarkFolderIconsVisible],
    ['_x_extension_bookmark_topbar_layout_2026_unique_', settings.bookmarkTopbarLayout],
    ['_x_extension_newtab_shortcuts_2026_unique_', settings.newtabShortcutsLegacy],
    ['_x_extension_newtab_shortcut_add_visible_2026_unique_', settings.newtabShortcutAddVisible],
    ['_x_extension_newtab_shortcut_dock_magnification_enabled_2026_unique_', settings.newtabShortcutDockMagnificationEnabled]
  ])('syncs, exports and imports %s', (key, setting) => {
    expect(setting.key).toBe(key);
    expect(settings.BROWSER_SYNC_KEYS).toContain(key);
  });

  it('carries custom site searches and bookmark folder colors', () => {
    [settings.siteSearchCustom, settings.bookmarkFolderColorRefs, settings.bookmarkFolderColorPresets]
      .forEach((setting) => expect(settings.BROWSER_SYNC_KEYS).toContain(setting.key));
  });

  it('keeps the regenerable provider-icon cache and the bookmark bar material on this device', () => {
    expect(settings.BROWSER_SYNC_KEYS).not.toContain(settings.siteSearchIconCache.key);
    expect(settings.BOOKMARK_TOPBAR_SURFACE_KEYS.filter((key) => settings.BROWSER_SYNC_KEYS.includes(key))).toEqual([]);
  });
});
