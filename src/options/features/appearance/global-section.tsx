// The Appearance tab's global section: the color mode gallery, motion
// effects and simple mode.
import { useMemo } from 'react';
import { motionEffectsEnabled, simpleModeEnabled } from '../../../domain/settings';
import { useSetting } from '../../../shared/react/use-setting';
import { useStore } from '../../../shared/react/use-store';
import { useMessages, useOptionsPage } from '../../app/context';
import { saveSetting } from '../../app/save-setting';
import { playThemeOptionClickEffect } from './theme-click-effect';
import {
  AppearanceGlobalSection as AppearanceGlobalView,
  type AppearanceGlobalSectionHandlers
} from '../../react/appearance-global-section';

const THEME_PREVIEWS = Object.freeze({
  system: '../../assets/images/system.svg',
  light: '../../assets/images/light.svg',
  dark: '../../assets/images/dark.svg'
});

export function AppearanceGlobalSection() {
  const { settingsStore, pageTheme } = useOptionsPage();
  const t = useMessages();
  const { mode } = useStore(pageTheme.store);
  const motionEffects = useSetting(settingsStore, motionEffectsEnabled);
  const simpleMode = useSetting(settingsStore, simpleModeEnabled);
  const handlers = useMemo<AppearanceGlobalSectionHandlers>(() => ({
    onTheme(next, button) {
      playThemeOptionClickEffect(button, window);
      pageTheme.choose(next);
    },
    rows: {
      onToggle(key, checked) {
        const setting = [motionEffectsEnabled, simpleModeEnabled].find((entry) => entry.key === key);
        if (setting) {
          saveSetting(settingsStore, setting, checked);
        }
      },
      onSelect() {}
    }
  }), [settingsStore, pageTheme]);
  return (
    <AppearanceGlobalView
      handlers={handlers}
      model={{
        title: t('settings_appearance_global_section_title', '全局'),
        theme: {
          title: t('settings_theme_title', '深浅色模式'),
          picker: {
            activeMode: mode,
            options: [
              { mode: 'system', labelKey: 'settings_theme_system', label: t('settings_theme_system', '跟随系统设置'), previewSrc: THEME_PREVIEWS.system },
              { mode: 'light', labelKey: 'settings_theme_light', label: t('settings_theme_light', '浅色'), previewSrc: THEME_PREVIEWS.light },
              { mode: 'dark', labelKey: 'settings_theme_dark', label: t('settings_theme_dark', '深色'), previewSrc: THEME_PREVIEWS.dark }
            ]
          }
        },
        rows: [
          {
            type: 'toggle',
            key: motionEffectsEnabled.key,
            title: {
              text: t('settings_motion_effects_title', '动态效果'),
              info: t('settings_motion_effects_desc', '如遇卡顿，或倾向于更利落的唤起方式，可关闭')
            },
            toggle: { id: '_x_extension_motion_effects_toggle_2026_unique_', checked: motionEffects }
          },
          {
            type: 'toggle',
            key: simpleModeEnabled.key,
            title: { text: t('settings_simple_mode_title', '简洁模式') },
            description: t('settings_simple_mode_desc', '移除更多提示元素，使搜索框更简洁'),
            toggle: { id: '_x_extension_simple_mode_toggle_2026_unique_', checked: simpleMode }
          }
        ]
      }}
    />
  );
}
