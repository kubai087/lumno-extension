import { describe, expect, it } from 'vitest';
import { readLocaleMessages } from './repository';

// The New Tab shortcut copy, in the locales its tests have always checked.

const LOCALES = ['zh_CN', 'zh_TW', 'en', 'ja'];

const SHORTCUT_MESSAGES = [
  'newtab_shortcuts_add',
  'newtab_shortcuts_hide_add',
  'newtab_shortcuts_add_hidden',
  'newtab_shortcuts_dialog_title',
  'newtab_shortcuts_name_label',
  'newtab_shortcuts_url_label',
  'newtab_shortcuts_icon_label',
  'newtab_shortcuts_icon_info_label',
  'newtab_shortcuts_icon_info',
  'newtab_shortcuts_icon_choose',
  'newtab_shortcuts_icon_replace',
  'newtab_shortcuts_icon_remove',
  'newtab_shortcuts_icon_unsupported',
  'newtab_shortcuts_icon_dimensions_too_large',
  'newtab_shortcuts_icon_invalid',
  'newtab_shortcuts_icon_storage_error',
  'newtab_shortcuts_cancel',
  'newtab_shortcuts_done',
  'newtab_shortcuts_save',
  'newtab_shortcuts_invalid_url',
  'newtab_shortcuts_added',
  'newtab_shortcuts_sync_limit_reached',
  'newtab_shortcuts_edited',
  'newtab_shortcuts_removed',
  'newtab_shortcuts_edit_dialog_title',
  'newtab_shortcuts_context_menu_label',
  'newtab_open_in_new_tab',
  'settings_newtab_shortcuts_title',
  'settings_newtab_shortcut_add_title',
  'settings_newtab_shortcut_dock_magnification_title',
  'settings_newtab_shortcut_columns_title',
  'settings_newtab_shortcut_size_title',
  'settings_newtab_shortcut_gap_title',
  'settings_newtab_shortcut_size_reset',
  'settings_newtab_shortcut_gap_reset',
  'shortcuts_edit',
  'shortcuts_remove'
];

describe('New Tab shortcut messages', () => {
  it.each(LOCALES)('are all translated in %s', (locale) => {
    const messages = readLocaleMessages(locale);
    expect(SHORTCUT_MESSAGES.filter((key) => !(messages[key] || '').trim())).toEqual([]);
  });

  it('tell where new shortcuts stay when sync is full, and how WebDAV syncs them', () => {
    expect(readLocaleMessages('zh_CN').newtab_shortcuts_sync_limit_reached)
      .toBe('快捷方式超出了浏览器同步空间，新加的只保存在本机。在设置中开启 WebDAV 后可以同步到其他设备。');
  });
});
