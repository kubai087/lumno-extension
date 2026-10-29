// The names of the appearance modes the panel offers. In the home scope,
// "system" follows the global setting instead and says so.
import type { Translate } from '../../newtab-types';
import type { AppearanceMode } from './wallpaper-runtime-types';

function getAppearanceModeLabel(t: Translate, mode: string, themeScope: string): string {
  if (mode === 'light') {
    return t('settings_theme_light', 'Light');
  }
  if (mode === 'dark') {
    return t('settings_theme_dark', 'Dark');
  }
  if (themeScope === 'home') {
    return t('newtab_theme_follow_global', 'Follow "Global"');
  }
  return t('settings_theme_system', 'Follow system');
}

function getAppearanceModeLabels(t: Translate, themeScope: string): Record<AppearanceMode, string> {
  return {
    system: getAppearanceModeLabel(t, 'system', themeScope),
    light: getAppearanceModeLabel(t, 'light', themeScope),
    dark: getAppearanceModeLabel(t, 'dark', themeScope)
  };
}

export { getAppearanceModeLabel, getAppearanceModeLabels };
