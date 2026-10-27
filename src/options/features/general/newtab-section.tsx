// The General tab's New Tab section: progress tracking for pinned series
// and which New Tab surfaces open their links in a new tab. Both are shown
// as stored; Options never rewrites them on its own.
import { useMemo } from 'react';
import { newtabOpenInNewTab, progressTrackingEnabled } from '../../../domain/settings';
import type { NewtabOpenInNewTabSurface } from '../../../domain/settings/newtab-page';
import { useSetting } from '../../../shared/react/use-setting';
import { useMessages, useOptionsPage } from '../../app/context';
import { saveSetting } from '../../app/save-setting';
import type { GetMessage } from '../../options-types';
import { SettingsRows, type SettingsRowsHandlers } from '../../react/settings-rows-view';

// Each surface's checkbox, in the order the group shows them.
const OPEN_IN_NEW_TAB_SURFACES: ReadonlyArray<{ surface: NewtabOpenInNewTabSurface; id: string; labelKey: string }> = [
  { surface: 'search', id: '_x_extension_newtab_open_in_new_tab_search_2026_unique_', labelKey: 'settings_newtab_open_in_new_tab_search' },
  { surface: 'shortcuts', id: '_x_extension_newtab_open_in_new_tab_shortcuts_2026_unique_', labelKey: 'settings_newtab_open_in_new_tab_shortcuts' },
  { surface: 'bookmarks', id: '_x_extension_newtab_open_in_new_tab_bookmarks_2026_unique_', labelKey: 'settings_newtab_open_in_new_tab_bookmarks' },
  { surface: 'recentSites', id: '_x_extension_newtab_open_in_new_tab_recent_sites_2026_unique_', labelKey: 'settings_newtab_open_in_new_tab_recent_sites' }
];

function surfaceTitle(t: GetMessage, surface: NewtabOpenInNewTabSurface): string {
  switch (surface) {
    case 'search':
      return t('settings_newtab_open_in_new_tab_search', '搜索结果');
    case 'shortcuts':
      return t('settings_newtab_open_in_new_tab_shortcuts', '快捷方式');
    case 'bookmarks':
      return t('settings_newtab_open_in_new_tab_bookmarks', '书签');
    default:
      return t('settings_newtab_open_in_new_tab_recent_sites', '站点卡片');
  }
}

export function GeneralNewtabSection() {
  const { settingsStore } = useOptionsPage();
  const t = useMessages();
  const progressTracking = useSetting(settingsStore, progressTrackingEnabled);
  const surfaces = useSetting(settingsStore, newtabOpenInNewTab);
  const handlers = useMemo<SettingsRowsHandlers>(() => ({
    onToggle(key, checked) {
      if (key === progressTrackingEnabled.key) {
        saveSetting(settingsStore, progressTrackingEnabled, checked);
      }
    },
    onCheck(key, values) {
      if (key !== newtabOpenInNewTab.key) {
        return;
      }
      const next = Object.fromEntries(OPEN_IN_NEW_TAB_SURFACES.map(({ surface }) => [surface, values.includes(surface)]));
      saveSetting(settingsStore, newtabOpenInNewTab, newtabOpenInNewTab.parse(next));
    },
    onSelect() {}
  }), [settingsStore]);
  return (
    <SettingsRows
      handlers={handlers}
      rows={[
        { type: 'header', key: 'header', title: t('settings_general_newtab_section_title', '新标签页设置') },
        {
          type: 'toggle',
          key: progressTrackingEnabled.key,
          title: { text: t('settings_progress_tracking_title', '置顶剧集、小说时自动更新进度'), badge: 'Beta' },
          toggle: { id: '_x_extension_progress_tracking_toggle_2026_unique_', checked: progressTracking }
        },
        {
          type: 'checkbox-group',
          key: newtabOpenInNewTab.key,
          title: {
            text: t('settings_newtab_open_in_new_tab_title', '点击后在新标签页打开'),
            info: t('settings_newtab_open_in_new_tab_desc', '不勾选的在当前页打开，按住 Option/Alt 可临时换成另一种')
          },
          groupId: newtabOpenInNewTab.key,
          ariaLabel: t('settings_newtab_open_in_new_tab_title', '点击后在新标签页打开'),
          checkboxes: {
            items: OPEN_IN_NEW_TAB_SURFACES.map(({ surface, id, labelKey }) => ({
              checked: surfaces[surface],
              id,
              label: surfaceTitle(t, surface),
              labelKey,
              value: surface
            }))
          }
        }
      ]}
    />
  );
}
