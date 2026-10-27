// The settings tabs, in their order on the page, and how a link names one.
import type { GetMessage } from '../../options-types';
import type { SettingsNavigationItemModel } from '../../react/settings-navigation';

type SettingsTabKey = 'general' | 'account' | 'appearance' | 'shortcuts' | 'blacklist' | 'labs';

const SETTINGS_TAB_KEYS: readonly SettingsTabKey[] = Object.freeze([
  'general',
  'account',
  'appearance',
  'shortcuts',
  'blacklist',
  'labs'
]);

// A tab key from a link or a click; the General tab when it names none.
function normalizeSettingsTabKey(value: unknown): SettingsTabKey {
  return SETTINGS_TAB_KEYS.find((key) => key === value) || 'general';
}

function getTabItems(t: GetMessage): SettingsNavigationItemModel[] {
  return [
    { key: 'general', labelKey: 'settings_tab_general', label: t('settings_tab_general', '常规'), iconName: 'ri-command-fill' },
    { key: 'account', labelKey: 'settings_tab_account', label: t('settings_tab_account', '账号与同步'), iconName: 'ri-user-3-line' },
    { key: 'appearance', labelKey: 'settings_tab_appearance', label: t('settings_tab_appearance', '外观'), iconName: 'ri-moon-clear-fill' },
    { key: 'shortcuts', labelKey: 'settings_tab_shortcuts', label: t('settings_tab_shortcuts', '搜索源'), iconName: 'ri-search-line' },
    { key: 'blacklist', labelKey: 'settings_tab_blacklist', label: t('settings_tab_blacklist', '黑名单'), iconName: 'ri-forbid-2-fill' },
    { key: 'labs', labelKey: 'settings_tab_labs', label: t('settings_tab_labs', '实验室功能'), iconName: 'ri-test-tube-fill' }
  ];
}

export { SETTINGS_TAB_KEYS, getTabItems, normalizeSettingsTabKey };
export type { SettingsTabKey };
