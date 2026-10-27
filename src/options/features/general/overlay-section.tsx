// The General tab's webpage focus overlay section: whether the search bar
// opened on a webpage opens results in a new tab, asked as the New Tab
// section asks it, and whether it lists every open tab before anything is
// typed. Both are shown as stored; Options never rewrites them on its own.
import { useMemo } from 'react';
import { overlayOpenInCurrentTab, overlayOpenTabsDefaultVisible } from '../../../domain/settings/overlay-panel';
import { useSetting } from '../../../shared/react/use-setting';
import { useMessages, useOptionsPage } from '../../app/context';
import { saveSetting } from '../../app/save-setting';
import { SettingsRows, type SettingsRowsHandlers } from '../../react/settings-rows-view';

export function GeneralOverlaySection() {
  const { settingsStore } = useOptionsPage();
  const t = useMessages();
  const openInCurrentTab = useSetting(settingsStore, overlayOpenInCurrentTab);
  const openTabsDefault = useSetting(settingsStore, overlayOpenTabsDefaultVisible);
  // The switch says "open in a new tab", the reverse of what is stored.
  const handlers = useMemo<SettingsRowsHandlers>(() => ({
    onToggle(key, checked) {
      if (key === overlayOpenInCurrentTab.key) {
        saveSetting(settingsStore, overlayOpenInCurrentTab, !checked);
      } else if (key === overlayOpenTabsDefaultVisible.key) {
        saveSetting(settingsStore, overlayOpenTabsDefaultVisible, checked);
      }
    },
    onSelect() {}
  }), [settingsStore]);
  return (
    <SettingsRows
      handlers={handlers}
      rows={[
        { type: 'header', key: 'header', title: t('settings_webpage_focus_overlay_section_title', '网页聚焦搜索浮层') },
        {
          type: 'toggle',
          key: overlayOpenInCurrentTab.key,
          title: {
            text: t('settings_newtab_open_in_new_tab_title', '点击后在新标签页打开'),
            info: t('settings_overlay_open_in_current_tab_desc', '关闭后在当前页打开（固定标签页除外），按住 Option/Alt 可临时换成另一种')
          },
          toggle: { id: '_x_extension_overlay_open_in_new_tab_toggle_2026_unique_', checked: !openInCurrentTab }
        },
        {
          type: 'toggle',
          key: overlayOpenTabsDefaultVisible.key,
          title: { text: t('settings_overlay_open_tabs_default_title', '默认展示所有已打开标签页') },
          toggle: { id: '_x_extension_overlay_open_tabs_default_visible_toggle_2026_unique_', checked: openTabsDefault }
        }
      ]}
    />
  );
}
