// The General tab's Shortcuts section: the way to the browser's shortcuts
// page, the search shortcut's chip, what the shortcut does on restricted
// pages, the list of shortcuts, and quick tab switching.
import { useMemo } from 'react';
import { overlayTabPriority, restrictedAction, restrictedActionAutoBrowserSettingDone } from '../../../domain/settings';
import * as LumnoMessaging from '../../../platform/messaging';
import { useSetting } from '../../../shared/react/use-setting';
import { useStore } from '../../../shared/react/use-store';
import { useMessages, useOptionsPage } from '../../app/context';
import { saveSetting } from '../../app/save-setting';
import {
  GeneralShortcutsSection as GeneralShortcutsView,
  type GeneralShortcutsSectionHandlers
} from '../../react/general-shortcuts-section';
import { buildShortcutReference, getSearchShortcutLabel } from '../shortcuts/shortcut-copy';

export function GeneralShortcutsSection() {
  const { settingsStore, commands, isMacPlatform, showToast } = useOptionsPage();
  const t = useMessages();
  const action = useSetting(settingsStore, restrictedAction);
  const commandsState = useStore(commands.store);

  const handlers = useMemo<GeneralShortcutsSectionHandlers>(() => ({
    onOpenShortcutsPage() {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'openExtensionShortcutsPage' }, (response) => {
        if (chrome.runtime.lastError || !response || response.ok === false) {
          showToast(t('toast_error', '操作失败，请重试。'), true);
        }
      });
    },
    // Choosing an action also marks the one-time browser setting step done.
    onRestrictedAction(value) {
      void settingsStore.setMany([
        [restrictedAction, restrictedAction.parse(value)],
        [restrictedActionAutoBrowserSettingDone, true]
      ]).catch(() => {});
    },
    // Quick tab switching stays on: the switch always shows on and saves on.
    onQuickSwitch() {
      saveSetting(settingsStore, overlayTabPriority, true);
    }
  }), [settingsStore, showToast, t]);

  return (
    <GeneralShortcutsView
      handlers={handlers}
      model={{
        title: t('settings_shortcuts_section_title', '快捷键设置'),
        description: {
          prefix: t('settings_shortcuts_browser_desc_prefix', '需在 '),
          extensions: t('settings_shortcuts_browser_desc_path_extensions', '「扩展程序」'),
          shortcuts: t('settings_shortcuts_browser_desc_path_shortcuts', '「键盘快捷键」'),
          suffix: t('settings_shortcuts_browser_desc_suffix', ' 修改快捷键')
        },
        openLabel: t('settings_shortcuts_action', '前往快捷键设置'),
        search: {
          title: t('settings_shortcuts_title', '唤起聚焦搜索窗口'),
          diaTag: t('settings_shortcuts_dia_tag', '在 Dia 中使用'),
          diaTooltip: t(
            'settings_shortcuts_dia_tooltip',
            'Dia 不允许扩展替换新标签页，所以 Lumno 的新标签页在 Dia 中暂不可用，聚焦搜索可以正常使用。\n\n想用 ⌘T 唤起聚焦搜索：Dia 自带快捷键的优先级更高，请先在 Dia 的 Settings → Shortcuts 中，把「New Tab」的 ⌘T 改成其他按键，再点击下方右侧按钮，将「Open command bar」设为 ⌘T。\n\n若快捷键在 Dia 中没有反应，请将其作用范围从 In Dia 改成 Global。'
          ),
          status: getSearchShortcutLabel(commandsState, isMacPlatform, t)
        },
        restricted: {
          title: t('settings_restricted_title', '在受限页行为'),
          info: t(
            'settings_restricted_tooltip',
            '受限页（如 chrome://、扩展商店、部分 file:// 页面）无法开启聚焦搜索；按下快捷键将按此处规则处理。'
          ),
          segmented: {
            activeValue: action,
            dataAttribute: 'data-restricted-action',
            items: [
              { value: 'default', labelKey: 'restricted_action_default', label: t('restricted_action_default', '前往 Lumno 新标签页') },
              { value: 'none', labelKey: 'restricted_action_none', label: t('restricted_action_none', '遵循浏览器设置') }
            ],
            select: { id: '_x_extension_restricted_action_select_2024_unique_' }
          }
        },
        referenceLabel: t('shortcut_reference_title', '快捷键列表'),
        reference: commandsState.read ? buildShortcutReference(commandsState, isMacPlatform, t) : null,
        quickSwitch: {
          title: t('settings_overlay_tab_priority_title', '快速切换已开启标签页'),
          toggle: { id: '_x_extension_overlay_tab_quick_switch_2024_unique_', checked: true }
        }
      }}
    />
  );
}
