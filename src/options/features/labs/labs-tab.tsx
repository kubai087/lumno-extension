// The Labs tab: experiments that stay off until turned on. One the browser
// cannot honor shows off and disabled, without touching the synced value
// other browsers use.
import { useCallback } from 'react';
import { documentPipEnabled, macosCtrlSuggestionNavigationEnabled, numberShortcutInstantEnabled } from '../../../domain/settings';
import type { Setting } from '../../../domain/settings/define';
import { useSetting } from '../../../shared/react/use-setting';
import { useMessages, useOptionsPage } from '../../app/context';
import { saveSetting } from '../../app/save-setting';
import { SettingToggleRows } from '../../react/setting-rows';

// Web clip needs Document Picture-in-Picture, which Firefox does not ship.
const DOCUMENT_PIP_UNSUPPORTED_BROWSER = 'firefox';

// Each row's setting by key, and the browser family that cannot honor it.
const EXPERIMENTS: ReadonlyArray<{ key: string; setting: Setting<boolean>; unsupportedBrowser?: string }> = [
  { key: 'documentPip', setting: documentPipEnabled, unsupportedBrowser: DOCUMENT_PIP_UNSUPPORTED_BROWSER },
  { key: 'numberShortcutInstant', setting: numberShortcutInstantEnabled },
  { key: 'macosCtrlSuggestionNavigation', setting: macosCtrlSuggestionNavigationEnabled }
];

export const LABS_TAB_SETTINGS: readonly Setting<unknown>[] = EXPERIMENTS.map((entry) => entry.setting);

export function LabsTab() {
  const { settingsStore, browserFamily } = useOptionsPage();
  const t = useMessages();
  const documentPip = useSetting(settingsStore, documentPipEnabled);
  const numberShortcutInstant = useSetting(settingsStore, numberShortcutInstantEnabled);
  const macosCtrlNavigation = useSetting(settingsStore, macosCtrlSuggestionNavigationEnabled);
  const documentPipUnsupported = browserFamily === DOCUMENT_PIP_UNSUPPORTED_BROWSER;
  const onChange = useCallback((key: string, checked: boolean) => {
    const experiment = EXPERIMENTS.find((entry) => entry.key === key);
    if (experiment && experiment.unsupportedBrowser !== browserFamily) {
      saveSetting(settingsStore, experiment.setting, checked);
    }
  }, [settingsStore, browserFamily]);
  const beta = 'Beta';
  return (
    <SettingToggleRows
      model={{
        rows: [
          {
            key: 'documentPip',
            id: '_x_extension_document_pip_row_2026_unique_',
            title: t('settings_document_pip_title', '网页剪裁'),
            badge: beta,
            description: t('settings_document_pip_desc', '把网页里的局部内容单独剪出来悬浮查看，可用于参考、对照'),
            toggle: {
              id: '_x_extension_document_pip_toggle_2026_unique_',
              checked: documentPipUnsupported ? false : documentPip,
              disabled: documentPipUnsupported
            },
            unsupported: {
              browser: DOCUMENT_PIP_UNSUPPORTED_BROWSER,
              reasonKey: 'settings_document_pip_unsupported_tooltip',
              active: documentPipUnsupported
            }
          },
          {
            key: 'numberShortcutInstant',
            title: t('settings_number_shortcut_instant_title', '单按 Command 显示数字跳转'),
            badge: beta,
            info: t(
              'settings_number_shortcut_instant_desc',
              '开启后，命令栏与搜索建议中单按 Command/Ctrl 即显示数字跳转标记；「在后台新开」不再占用 Command（鼠标中键仍可后台打开）'
            ),
            toggle: { id: '_x_extension_number_shortcut_instant_toggle_2026_unique_', checked: numberShortcutInstant, disabled: false }
          },
          {
            key: 'macosCtrlSuggestionNavigation',
            title: t('settings_macos_ctrl_suggestion_navigation_title', 'Mac 键盘导航'),
            badge: beta,
            info: t('settings_macos_ctrl_suggestion_navigation_tooltip', '在 macOS 的新标签页和命令栏中可用。感谢 @wanghanzhen 的贡献。'),
            description: t('settings_macos_ctrl_suggestion_navigation_desc', '用 Ctrl+N / Ctrl+P 选择下一项 / 上一项'),
            toggle: { id: '_x_extension_macos_ctrl_suggestion_navigation_toggle_2026_unique_', checked: macosCtrlNavigation, disabled: false }
          }
        ]
      }}
      onChange={onChange}
    />
  );
}
