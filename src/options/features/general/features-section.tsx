// The General tab's Features section: picture-in-picture, the tab switcher
// and its window option, link preview, pinned tab recovery, and the
// selection toolbar with its provider and grouping.
import { useMemo } from 'react';
import {
  autoPipEnabled,
  linkPreviewEnabled,
  pinnedTabRecoveryEnabled,
  selectionQuickActionsEnabled,
  selectionQuickActionsGroupEnabled,
  selectionQuickActionsProvider,
  tabSwitcherCurrentWindowOnly,
  tabSwitcherEnabled
} from '../../../domain/settings';
import type { Setting } from '../../../domain/settings/define';
import * as COMMUNITY_LINKS from '../../../platform/community-links';
import { useSetting } from '../../../shared/react/use-setting';
import { useStore } from '../../../shared/react/use-store';
import { useMessages, useOptionsPage } from '../../app/context';
import { saveSetting } from '../../app/save-setting';
import { SettingsRows, type SettingsRowModel, type SettingsRowsHandlers } from '../../react/settings-rows-view';
import { formatShortcut, getCtrlTabLink, type CtrlTabLink } from '../shortcuts/shortcut-copy';
import type { GetMessage } from '../../options-types';

// The AI sites the selection toolbar can open first, with their bundled tiles.
const SELECTION_PROVIDERS: ReadonlyArray<{ value: string; labelKey: string; fallback: string }> = [
  { value: 'gpt', labelKey: 'site_search_name_chatgpt', fallback: 'ChatGPT' },
  { value: 'gm', labelKey: 'site_search_name_gemini', fallback: 'Gemini' },
  { value: 'dbai', labelKey: 'site_search_name_doubao', fallback: 'Doubao' },
  { value: 'qw', labelKey: 'site_search_name_qianwen', fallback: 'Qwen' },
  { value: 'yb', labelKey: 'site_search_name_yuanbao', fallback: 'Yuanbao' },
  { value: 'mx', labelKey: 'site_search_name_minimax', fallback: 'MiniMax' },
  { value: 'ds', labelKey: 'site_search_name_deepseek', fallback: 'DeepSeek' },
  { value: 'kimi', labelKey: 'site_search_name_kimi', fallback: 'Kimi' },
  { value: 'cp', labelKey: 'site_search_name_copilot', fallback: 'Copilot' },
  { value: 'grok', labelKey: 'site_search_name_grok', fallback: 'Grok' },
  { value: 'qwen', labelKey: 'site_search_name_qwen_chat', fallback: 'Qwen Chat' },
  { value: 'ais', labelKey: 'site_search_name_ai_studio', fallback: 'Google AI Studio' }
];

// Picture-in-picture for web pages needs requestPictureInPicture, which Firefox lacks.
const AUTO_PIP_UNSUPPORTED_BROWSER = 'firefox';

const TOGGLES: readonly Setting<boolean>[] = [
  autoPipEnabled,
  tabSwitcherEnabled,
  tabSwitcherCurrentWindowOnly,
  linkPreviewEnabled,
  pinnedTabRecoveryEnabled,
  selectionQuickActionsEnabled,
  selectionQuickActionsGroupEnabled
];

interface FeatureValues {
  autoPip: boolean;
  autoPipUnsupported: boolean;
  tabSwitcher: boolean;
  tabSwitcherShortcut: string;
  ctrlTabLink: CtrlTabLink | null;
  currentWindowOnly: boolean;
  linkPreview: boolean;
  pinnedTabRecovery: boolean;
  selectionQuickActions: boolean;
  selectionProvider: string;
  selectionGroup: boolean;
}

// The selection toolbar's switch, and its provider and grouping, which wait
// while the toolbar is off.
function getSelectionRows(t: GetMessage, values: FeatureValues): SettingsRowModel[] {
  const selectionOff = !values.selectionQuickActions;
  return [
    {
      type: 'toggle',
      key: selectionQuickActionsEnabled.key,
      title: {
        text: t('settings_selection_quick_actions_title', '划词快捷操作'),
        info: t('settings_selection_quick_actions_desc', '选中文字后显示 AI 操作')
      },
      toggle: { id: '_x_extension_selection_quick_actions_toggle_2026_unique_', checked: values.selectionQuickActions }
    },
    {
      type: 'reveal',
      key: 'selection-quick-actions-subrows',
      id: '_x_extension_selection_quick_actions_subrows_2026_unique_',
      expanded: !selectionOff,
      rows: [
        {
          type: 'select',
          key: selectionQuickActionsProvider.key,
          rowId: '_x_extension_selection_quick_actions_provider_row_2026_unique_',
          subrow: true,
          className: '_x_extension_selection_provider_row_2026_unique_',
          disabled: selectionOff,
          title: {
            text: t('settings_selection_quick_actions_provider_title', '优先 Provider'),
            id: '_x_extension_selection_quick_actions_provider_select_2026_unique__title'
          },
          select: {
            id: '_x_extension_selection_quick_actions_provider_select_2026_unique_',
            disabled: selectionOff,
            labelledBy: '_x_extension_selection_quick_actions_provider_select_2026_unique__title',
            value: values.selectionProvider,
            items: SELECTION_PROVIDERS.map((item) => ({
              value: item.value,
              labelKey: item.labelKey,
              label: t(item.labelKey, item.fallback),
              iconUrl: chrome.runtime.getURL(`assets/images/site-search/tile-${item.value}.png`)
            }))
          }
        },
        {
          type: 'toggle',
          key: selectionQuickActionsGroupEnabled.key,
          rowId: '_x_extension_selection_quick_actions_group_row_2026_unique_',
          subrow: true,
          disabled: selectionOff,
          title: {
            text: t('settings_selection_quick_actions_group_title', '在后台查询'),
            info: t('settings_selection_quick_actions_group_desc', '所有 AI 网页皆归入「AI 查询」标签组')
          },
          toggle: {
            id: '_x_extension_selection_quick_actions_group_toggle_2026_unique_',
            checked: values.selectionGroup,
            disabled: selectionOff
          }
        }
      ]
    }
  ];
}

function getFeatureRows(t: GetMessage, values: FeatureValues): SettingsRowModel[] {
  return [
    { type: 'header', key: 'header', title: t('settings_features_section_title', '功能') },
    {
      type: 'toggle',
      key: autoPipEnabled.key,
      title: {
        text: t('settings_auto_pip_title', '视频自动画中画'),
        info: t('settings_auto_pip_desc', '在网页上播放视频时，若切换至其他标签页，则正在播放中的视频将以浮窗的形式播放')
      },
      unsupported: {
        browser: AUTO_PIP_UNSUPPORTED_BROWSER,
        reasonKey: 'settings_auto_pip_unsupported_tooltip',
        active: values.autoPipUnsupported
      },
      // Stays off without touching the synced value other browsers use.
      toggle: {
        id: '_x_extension_auto_pip_toggle_2024_unique_',
        checked: values.autoPipUnsupported ? false : values.autoPip,
        disabled: values.autoPipUnsupported
      }
    },
    {
      type: 'toggle',
      key: tabSwitcherEnabled.key,
      title: {
        text: t('settings_tab_switcher_title', '标签切换器'),
        info: t('settings_tab_switcher_desc', '快速切换最近标签页，默认 {shortcut}，可自定义').replace('{shortcut}', values.tabSwitcherShortcut)
      },
      toggle: { id: '_x_extension_tab_switcher_toggle_2026_unique_', checked: values.tabSwitcher },
      link: values.ctrlTabLink
        ? { ...values.ctrlTabLink, id: '_x_extension_tab_switcher_ctrl_tab_link_2026_unique_', browserOnly: 'chromium' }
        : null
    },
    {
      type: 'reveal',
      key: 'tab-switcher-subrows',
      id: '_x_extension_tab_switcher_subrows_2026_unique_',
      expanded: values.tabSwitcher,
      rows: [{
        type: 'toggle',
        key: tabSwitcherCurrentWindowOnly.key,
        subrow: true,
        title: {
          text: t('settings_tab_switcher_current_window_only_title', '只显示当前窗口的标签页'),
          info: t('settings_tab_switcher_current_window_only_desc', '适用于把每个空间放在独立窗口的浏览器，避免列出其他空间的标签页')
        },
        toggle: {
          id: '_x_extension_tab_switcher_current_window_only_toggle_2026_unique_',
          checked: values.currentWindowOnly,
          ariaLabel: t('settings_tab_switcher_current_window_only_title', '只显示当前窗口的标签页')
        }
      }]
    },
    {
      type: 'toggle',
      key: linkPreviewEnabled.key,
      title: {
        text: t('settings_link_preview_title', '网页预览'),
        badge: 'Beta',
        info: t('settings_link_preview_desc', '按住 Shift 点击链接，在页面上的小窗中预览，可随时关闭或移到新标签页')
      },
      toggle: { id: '_x_extension_link_preview_toggle_2026_unique_', checked: values.linkPreview }
    },
    {
      type: 'toggle',
      key: pinnedTabRecoveryEnabled.key,
      title: {
        text: t('settings_pinned_tab_recovery_title', '重启后恢复置顶标签页'),
        info: t('settings_pinned_tab_recovery_desc', '记录可恢复的置顶网页标签页，在浏览器重启后自动补回')
      },
      toggle: { id: '_x_extension_pinned_tab_recovery_toggle_2026_unique_', checked: values.pinnedTabRecovery }
    },
    ...getSelectionRows(t, values)
  ];
}

export function GeneralFeaturesSection() {
  const { settingsStore, commands, locale, isMacPlatform, browserFamily, getViewportTopInset } = useOptionsPage();
  const t = useMessages();
  const autoPipUnsupported = browserFamily === AUTO_PIP_UNSUPPORTED_BROWSER;
  const autoPip = useSetting(settingsStore, autoPipEnabled);
  const tabSwitcher = useSetting(settingsStore, tabSwitcherEnabled);
  const currentWindowOnly = useSetting(settingsStore, tabSwitcherCurrentWindowOnly);
  const linkPreview = useSetting(settingsStore, linkPreviewEnabled);
  const pinnedTabRecovery = useSetting(settingsStore, pinnedTabRecoveryEnabled);
  const selectionQuickActions = useSetting(settingsStore, selectionQuickActionsEnabled);
  const selectionProvider = useSetting(settingsStore, selectionQuickActionsProvider);
  const selectionGroup = useSetting(settingsStore, selectionQuickActionsGroupEnabled);
  const commandsState = useStore(commands.store);
  const { locale: pageLocale } = useStore(locale.store);
  // The tab switcher's guide to Ctrl+Tab, which the browser's shortcuts
  // page cannot bind; Chromium only.
  const ctrlTabLink = getCtrlTabLink(commandsState, isMacPlatform, t, COMMUNITY_LINKS.getHelpUrl(pageLocale, 'tab-switcher', 'ctrl-tab'));
  const tabSwitcherShortcut = formatShortcut('Alt+Q', isMacPlatform) || (isMacPlatform ? '⌥Q' : 'Alt+Q');

  const handlers = useMemo<SettingsRowsHandlers>(() => ({
    onToggle(key, checked) {
      const target = TOGGLES.find((setting) => setting.key === key);
      if (target && !(target === autoPipEnabled && autoPipUnsupported)) {
        saveSetting(settingsStore, target, checked);
      }
    },
    onSelect(key, value) {
      if (key === selectionQuickActionsProvider.key) {
        saveSetting(settingsStore, selectionQuickActionsProvider, selectionQuickActionsProvider.parse(value));
      }
    },
    getViewportTopInset
  }), [settingsStore, autoPipUnsupported, getViewportTopInset]);

  const rows = getFeatureRows(t, {
    autoPip,
    autoPipUnsupported,
    tabSwitcher,
    tabSwitcherShortcut,
    ctrlTabLink,
    currentWindowOnly,
    linkPreview,
    pinnedTabRecovery,
    selectionQuickActions,
    selectionProvider,
    selectionGroup
  });
  return <SettingsRows handlers={handlers} rows={rows} />;
}
