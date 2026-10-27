// The rows of the New Tab look in the Appearance tab, from their values:
// the material and its light or dark choice, the content width, what sits
// above the search box, and the clock's face, weight, size, opacity, color
// and format.
import {
  NEWTAB_TIME_FONTS,
  NEWTAB_TIME_FONT_SIZE_DEFAULT,
  NEWTAB_TIME_FONT_SIZE_MAX,
  NEWTAB_TIME_FONT_SIZE_MIN,
  NEWTAB_TIME_OPACITY_DEFAULT,
  NEWTAB_TIME_OPACITY_MAX,
  NEWTAB_TIME_OPACITY_MIN,
  getNewtabTimeFont,
  newtabGlassStyle,
  newtabGlassTheme,
  newtabTime12Hour,
  newtabTimeFont,
  newtabTimeFontSize,
  newtabTimeFontWeight,
  newtabTimeInk,
  newtabTimeOpacity,
  newtabTimeSecondsVisible,
  newtabTopContentMode,
  newtabWidthMode,
  resolveNewtabTimeFontWeight
} from '../../../domain/settings';
import type { NewtabGlassStyle, NewtabGlassTheme, NewtabWidthMode } from '../../../domain/settings/newtab-page';
import type { NewtabTimeInk, NewtabTopContentMode } from '../../../domain/settings/newtab-time';
import type { GetMessage } from '../../options-types';
import type { SegmentedControlItemModel } from '../../react/segmented-control';
import type { SelectControlItemModel } from '../../react/select-control';
import type { SettingsRowModel } from '../../react/settings-rows-view';

interface NewtabLookValues {
  glassStyle: NewtabGlassStyle;
  glassTheme: NewtabGlassTheme;
  widthMode: NewtabWidthMode;
  topContent: NewtabTopContentMode;
  timeFont: string;
  timeFontWeight: number | null;
  timeFontSize: number;
  timeOpacity: number;
  timeInk: NewtabTimeInk;
  timeSeconds: boolean;
  time12Hour: boolean;
}

function getGlassStyleItems(t: GetMessage): SelectControlItemModel[] {
  const styles: readonly NewtabGlassStyle[] = ['none', 'frosted', 'liquid'];
  return styles.map((style) => {
    switch (style) {
      case 'none':
        return { value: style, labelKey: 'settings_newtab_glass_style_none', label: t('settings_newtab_glass_style_none', '默认') };
      case 'frosted':
        return {
          value: style,
          labelKey: 'settings_newtab_glass_style_frosted',
          label: t('settings_newtab_glass_style_frosted', '亚克力'),
          badge: 'Beta'
        };
      case 'liquid':
        return {
          value: style,
          labelKey: 'settings_newtab_glass_style_liquid',
          label: t('settings_newtab_glass_style_liquid', '液态玻璃'),
          badge: 'Beta'
        };
    }
  });
}

function getGlassThemeItems(t: GetMessage): SegmentedControlItemModel[] {
  const themes: readonly NewtabGlassTheme[] = ['follow', 'light', 'dark'];
  return themes.map((theme) => {
    switch (theme) {
      case 'follow':
        return { value: theme, labelKey: 'settings_newtab_glass_theme_follow', label: t('settings_newtab_glass_theme_follow', '自动') };
      case 'light':
        return { value: theme, labelKey: 'settings_newtab_glass_theme_light', label: t('settings_newtab_glass_theme_light', '浅色') };
      case 'dark':
        return { value: theme, labelKey: 'settings_newtab_glass_theme_dark', label: t('settings_newtab_glass_theme_dark', '深色') };
    }
  });
}

function getWidthItems(t: GetMessage): SegmentedControlItemModel[] {
  const modes: readonly NewtabWidthMode[] = ['standard', 'wide'];
  return modes.map((mode) => (mode === 'standard'
    ? { value: mode, labelKey: 'newtab_width_standard', label: t('newtab_width_standard', '标准') }
    : { value: mode, labelKey: 'newtab_width_wide', label: t('newtab_width_wide', '宽屏（推荐）') }));
}

function getTopContentItems(t: GetMessage): SegmentedControlItemModel[] {
  const modes: readonly NewtabTopContentMode[] = ['brand', 'time', 'off'];
  return modes.map((mode) => {
    switch (mode) {
      case 'brand':
        return { value: mode, labelKey: 'newtab_top_content_brand', label: t('newtab_top_content_brand', '品牌标识') };
      case 'time':
        return { value: mode, labelKey: 'newtab_top_content_time', label: t('newtab_top_content_time', '时间') };
      case 'off':
        return { value: mode, labelKey: 'newtab_top_content_off', label: t('newtab_top_content_off', '隐藏') };
    }
  });
}

function getTimeInkItems(t: GetMessage): SegmentedControlItemModel[] {
  const inks: readonly NewtabTimeInk[] = ['auto', 'light', 'dark'];
  return inks.map((ink) => {
    switch (ink) {
      case 'auto':
        return { value: ink, labelKey: 'newtab_time_ink_auto', label: t('newtab_time_ink_auto', '自动') };
      case 'light':
        return { value: ink, labelKey: 'newtab_time_ink_light', label: t('newtab_time_ink_light', '浅色') };
      case 'dark':
        return { value: ink, labelKey: 'newtab_time_ink_dark', label: t('newtab_time_ink_dark', '深色') };
    }
  });
}

function getTimeRows(t: GetMessage, values: NewtabLookValues): SettingsRowModel[] {
  // The weight slider spans the range the chosen face draws well.
  const face = getNewtabTimeFont(values.timeFont);
  const sizeMin = NEWTAB_TIME_FONT_SIZE_MIN;
  const sizeMax = NEWTAB_TIME_FONT_SIZE_MAX;
  const sizeDefault = NEWTAB_TIME_FONT_SIZE_DEFAULT;
  const opacityMin = NEWTAB_TIME_OPACITY_MIN;
  const opacityMax = NEWTAB_TIME_OPACITY_MAX;
  const fontTitle = t('newtab_time_font_title', '时间字体');
  const inkTitle = t('newtab_time_ink_title', '时间颜色');
  const secondsTitle = t('newtab_time_show_seconds_title', '显示秒数');
  const twelveHourTitle = t('newtab_time_12_hour_title', '12 小时制');
  return [
    {
      type: 'select',
      key: newtabTimeFont.key,
      rowId: '_x_extension_newtab_time_font_row_2026_unique_',
      subrow: true,
      title: { id: '_x_extension_newtab_time_font_select_2026_unique__title', text: fontTitle },
      select: {
        id: '_x_extension_newtab_time_font_select_2026_unique_',
        // Face names are proper names, so the list comes straight from settings.
        items: NEWTAB_TIME_FONTS.map((font) => ({ value: font.id, label: font.label, labelKey: '' })),
        labelledBy: '_x_extension_newtab_time_font_select_2026_unique__title',
        value: values.timeFont
      }
    },
    {
      type: 'slider',
      key: newtabTimeFontWeight.key,
      rowId: '_x_extension_newtab_time_font_weight_row_2026_unique_',
      subrow: true,
      title: { text: t('newtab_time_font_weight_title', '时间字重') },
      hostId: '_x_extension_newtab_time_font_weight_control_2026_unique_',
      slider: {
        ariaLabel: t('newtab_time_font_weight_title', 'Time font weight'),
        defaultValue: face.defaultWeight,
        id: '_x_extension_newtab_time_font_weight_slider_2026_unique_',
        min: face.minWeight,
        max: face.maxWeight,
        resetAriaLabel: t('newtab_time_font_weight_reset', 'Reset time font weight'),
        resetButtonId: '_x_extension_newtab_time_font_weight_reset_2026_unique_',
        step: 1,
        ticks: [
          { align: 'start', label: String(face.minWeight) },
          { label: String(Math.round((face.minWeight + face.maxWeight) / 2)) },
          { align: 'end', label: String(face.maxWeight) }
        ],
        value: resolveNewtabTimeFontWeight(face.id, values.timeFontWeight)
      }
    },
    {
      type: 'slider',
      key: newtabTimeFontSize.key,
      rowId: '_x_extension_newtab_time_font_size_row_2026_unique_',
      subrow: true,
      title: { text: t('newtab_time_font_size_title', '时间字号') },
      hostId: '_x_extension_newtab_time_font_size_control_2026_unique_',
      slider: {
        ariaLabel: t('newtab_time_font_size_title', 'Time size'),
        defaultValue: sizeDefault,
        id: '_x_extension_newtab_time_font_size_slider_2026_unique_',
        min: sizeMin,
        max: sizeMax,
        resetAriaLabel: t('newtab_time_font_size_reset', 'Reset time size'),
        resetButtonId: '_x_extension_newtab_time_font_size_reset_2026_unique_',
        step: 1,
        ticks: [
          { align: 'start', label: String(sizeMin) },
          { label: String(sizeDefault), percent: ((sizeDefault - sizeMin) / (sizeMax - sizeMin)) * 100 },
          { align: 'end', label: String(sizeMax) }
        ],
        value: values.timeFontSize,
        valueSuffix: ' px'
      }
    },
    {
      type: 'slider',
      key: newtabTimeOpacity.key,
      rowId: '_x_extension_newtab_time_opacity_row_2026_unique_',
      subrow: true,
      title: { text: t('newtab_time_opacity_title', '时间不透明度') },
      hostId: '_x_extension_newtab_time_opacity_control_2026_unique_',
      slider: {
        ariaLabel: t('newtab_time_opacity_title', 'Time opacity'),
        defaultValue: NEWTAB_TIME_OPACITY_DEFAULT,
        id: '_x_extension_newtab_time_opacity_slider_2026_unique_',
        min: opacityMin,
        max: opacityMax,
        resetAriaLabel: t('newtab_time_opacity_reset', 'Reset time opacity'),
        resetButtonId: '_x_extension_newtab_time_opacity_reset_2026_unique_',
        step: 1,
        ticks: [
          { align: 'start', label: `${opacityMin}%` },
          { label: `${Math.round((opacityMin + opacityMax) / 2)}%` },
          { align: 'end', label: `${opacityMax}%` }
        ],
        value: values.timeOpacity,
        valueSuffix: '%'
      }
    },
    {
      type: 'segmented',
      key: newtabTimeInk.key,
      rowId: '_x_extension_newtab_time_ink_row_2026_unique_',
      subrow: true,
      title: { text: inkTitle },
      groupId: '_x_extension_newtab_time_ink_tabs_wrap_2026_unique_',
      ariaLabel: inkTitle,
      segmented: { activeValue: values.timeInk, dataAttribute: 'data-newtab-time-ink', items: getTimeInkItems(t) }
    },
    {
      type: 'toggle',
      key: newtabTimeSecondsVisible.key,
      rowId: '_x_extension_newtab_time_seconds_row_2026_unique_',
      subrow: true,
      title: { text: secondsTitle },
      toggle: {
        id: '_x_extension_newtab_time_seconds_toggle_2026_unique_',
        checked: values.timeSeconds,
        ariaLabel: secondsTitle,
        ariaLabelKey: 'newtab_time_show_seconds_title'
      }
    },
    {
      type: 'toggle',
      key: newtabTime12Hour.key,
      rowId: '_x_extension_newtab_time_12_hour_row_2026_unique_',
      subrow: true,
      title: { text: twelveHourTitle },
      toggle: {
        id: '_x_extension_newtab_time_12_hour_toggle_2026_unique_',
        checked: values.time12Hour,
        ariaLabel: twelveHourTitle,
        ariaLabelKey: 'newtab_time_12_hour_title'
      }
    }
  ];
}

function getNewtabLookRows(t: GetMessage, values: NewtabLookValues): SettingsRowModel[] {
  const glassThemeTitle = t('settings_newtab_glass_theme_title', '材质深浅色');
  const widthTitle = t('settings_newtab_width_title', '新标签页内容宽度');
  const topContentTitle = t('settings_newtab_wordmark_title', '搜索框上方内容');
  return [
    { type: 'header', key: 'header', title: t('settings_newtab_section_title', '新标签页') },
    {
      type: 'select',
      key: newtabGlassStyle.key,
      compact: false,
      title: { id: '_x_extension_newtab_glass_style_select_2026_unique__title', text: t('settings_newtab_glass_style_title', '材质') },
      description: t('settings_newtab_glass_style_desc', '更换新标签页 UI 元素的材质'),
      select: {
        id: '_x_extension_newtab_glass_style_select_2026_unique_',
        items: getGlassStyleItems(t),
        labelledBy: '_x_extension_newtab_glass_style_select_2026_unique__title',
        value: values.glassStyle
      }
    },
    {
      // The material's light/dark choice only matters while a glass material is on.
      type: 'reveal',
      key: 'glass-theme',
      id: '_x_extension_newtab_glass_theme_subrows_2026_unique_',
      expanded: values.glassStyle !== 'none',
      rows: [{
        type: 'segmented',
        key: newtabGlassTheme.key,
        rowId: '_x_extension_newtab_glass_theme_row_2026_unique_',
        compact: false,
        subrow: true,
        title: { text: glassThemeTitle },
        description: t(
          'settings_newtab_glass_theme_desc',
          '「自动」：跟随深浅色模式，壁纸较暗时改用深色材质，让文字保持清晰。\n「浅色」「深色」：固定材质，并让新标签页使用同样的深浅色。'
        ),
        groupId: '_x_extension_newtab_glass_theme_tabs_wrap_2026_unique_',
        ariaLabel: glassThemeTitle,
        segmented: { activeValue: values.glassTheme, dataAttribute: 'data-newtab-glass-theme', items: getGlassThemeItems(t) }
      }]
    },
    {
      type: 'segmented',
      key: newtabWidthMode.key,
      compact: false,
      title: { text: widthTitle },
      groupId: '_x_extension_newtab_width_tabs_wrap_2026_unique_',
      ariaLabel: widthTitle,
      segmented: {
        activeValue: values.widthMode,
        dataAttribute: 'data-newtab-width',
        items: getWidthItems(t),
        select: { id: '_x_extension_newtab_width_select_2026_unique_' }
      }
    },
    {
      type: 'segmented',
      key: newtabTopContentMode.key,
      title: { text: topContentTitle },
      groupId: '_x_extension_newtab_top_content_tabs_wrap_2026_unique_',
      ariaLabel: topContentTitle,
      groupClassName: '_x_extension_top_content_tabs_2026_unique_',
      segmented: { activeValue: values.topContent, dataAttribute: 'data-newtab-top-content', items: getTopContentItems(t) }
    },
    {
      // The clock's own options only matter while New Tab shows the time.
      type: 'reveal',
      key: 'time',
      id: '_x_extension_newtab_time_subrows_2026_unique_',
      expanded: values.topContent === 'time',
      rows: getTimeRows(t, values)
    }
  ];
}

export { getNewtabLookRows };
export type { NewtabLookValues };
