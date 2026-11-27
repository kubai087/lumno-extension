// The General tab's webpage focus overlay section: whether the search bar
// opened on a webpage opens results in a new tab, asked as the New Tab
// section asks it, whether it lists every open tab before anything is
// typed, and in which order. All are shown as stored; Options never
// rewrites them on its own.
import { useMemo } from 'react';
import {
  overlayOpenInCurrentTab,
  overlayOpenTabsDefaultVisible,
  overlayOpenTabsOrder
} from '../../../domain/settings/overlay-panel';
import { useSetting } from '../../../shared/react/use-setting';
import { useMessages, useOptionsPage } from '../../app/context';
import { saveSetting } from '../../app/save-setting';
import { SettingsRows, type SettingsRowsHandlers } from '../../react/settings-rows-view';

export function GeneralOverlaySection() {
  const { settingsStore } = useOptionsPage();
  const t = useMessages();
  const openInCurrentTab = useSetting(settingsStore, overlayOpenInCurrentTab);
  const openTabsDefault = useSetting(settingsStore, overlayOpenTabsDefaultVisible);
  const openTabsOrder = useSetting(settingsStore, overlayOpenTabsOrder);
  // The switch says "open in a new tab", the reverse of what is stored.
  const handlers = useMemo<SettingsRowsHandlers>(() => ({
    onToggle(key, checked) {
      if (key === overlayOpenInCurrentTab.key) {
        saveSetting(settingsStore, overlayOpenInCurrentTab, !checked);
      } else if (key === overlayOpenTabsDefaultVisible.key) {
        saveSetting(settingsStore, overlayOpenTabsDefaultVisible, checked);
      }
    },
    onSelect(key, value) {
      if (key === overlayOpenTabsOrder.key) {
        saveSetting(settingsStore, overlayOpenTabsOrder, overlayOpenTabsOrder.parse(value));
      }
    }
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
            info: t('settings_overlay_open_in_current_tab_desc', '关闭后在当前页打开（固定标签页除外），按住 Shift 可临时换成另一种，按住 Option/Alt 分屏打开')
          },
          toggle: { id: '_x_extension_overlay_open_in_new_tab_toggle_2026_unique_', checked: !openInCurrentTab }
        },
        {
          type: 'toggle',
          key: overlayOpenTabsDefaultVisible.key,
          title: { text: t('settings_overlay_open_tabs_default_title', '默认展示所有已打开标签页') },
          toggle: { id: '_x_extension_overlay_open_tabs_default_visible_toggle_2026_unique_', checked: openTabsDefault }
        },
        {
          type: 'segmented',
          key: overlayOpenTabsOrder.key,
          title: {
            text: t('settings_overlay_open_tabs_order_title', '已打开标签页排序'),
            info: t('settings_overlay_open_tabs_order_desc', '未输入时列出的标签页顺序，按最近使用排序时不列出当前标签页')
          },
          groupId: '_x_extension_overlay_open_tabs_order_tabs_wrap_2026_unique_',
          ariaLabel: t('settings_overlay_open_tabs_order_title', '已打开标签页排序'),
          segmented: {
            activeValue: openTabsOrder,
            dataAttribute: 'data-overlay-open-tabs-order',
            items: [
              { value: 'recent', labelKey: 'overlay_open_tabs_order_recent', label: t('overlay_open_tabs_order_recent', '最近使用') },
              { value: 'frequent', labelKey: 'overlay_open_tabs_order_frequent', label: t('overlay_open_tabs_order_frequent', '最常使用') }
            ],
            select: { id: '_x_extension_overlay_open_tabs_order_select_2026_unique_' }
          }
        }
      ]}
    />
  );
}
