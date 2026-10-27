// The rows of the Appearance tab's webpage overlay section, from its values:
// the size, width and opening animation, the local font rows, and whether
// the overlay adapts to each page's colors.
import {
  OVERLAY_WIDTH_MAX,
  OVERLAY_WIDTH_MIN,
  getOverlaySizePreset,
  overlayEnterAnimation,
  overlayFontFallback,
  overlayFontFamily,
  overlayPageThemeAdaptationEnabled,
  overlaySizeMode,
  overlayWidth
} from '../../../domain/settings/overlay-panel';
import type { OverlayEnterAnimation, OverlaySizeMode } from '../../../domain/settings/overlay-panel';
import { formatTemplate } from '../../format-template';
import type { GetMessage } from '../../options-types';
import type { AppearanceOverlaySectionModel, OverlayFontRowModel } from '../../react/appearance-overlay-section';
import type { SegmentedControlItemModel } from '../../react/segmented-control';
import type { SelectControlItemModel } from '../../react/select-control';
import type { ThemeMode } from '../../react/theme-picker';

const SIZE_MODES: readonly OverlaySizeMode[] = ['compact', 'standard', 'large'];

interface OverlayValues {
  sizeMode: OverlaySizeMode;
  // Null follows the size's own width.
  width: number | null;
  enterAnimation: OverlayEnterAnimation;
  pageThemeAdaptation: boolean;
  fontFamily: string;
  fontFallback: string;
  // The fonts' names as the device that chose them showed them, by family.
  fontLabels: Record<string, string>;
  // The installed fonts by name; null until read, and when the read failed.
  installedFonts: ReadonlyMap<string, string> | null;
  // Adaptation only applies while the color mode follows the system.
  themeMode: ThemeMode;
  fontsUnsupported: boolean;
}

function getFontLabel(values: Pick<OverlayValues, 'installedFonts' | 'fontLabels'>, family: string): string {
  return (values.installedFonts && values.installedFonts.get(family)) || values.fontLabels[family] || family;
}

function getSizeItems(t: GetMessage): SegmentedControlItemModel[] {
  return SIZE_MODES.map((mode) => {
    switch (mode) {
      case 'compact':
        return { value: mode, labelKey: 'overlay_size_compact', label: t('overlay_size_compact', '小') };
      case 'standard':
        return { value: mode, labelKey: 'overlay_size_standard', label: t('overlay_size_standard', '标准') };
      case 'large':
        return { value: mode, labelKey: 'overlay_size_large', label: t('overlay_size_large', '大') };
    }
  });
}

function getAnimationItems(t: GetMessage): SegmentedControlItemModel[] {
  return [
    { value: 'elastic', labelKey: 'overlay_enter_animation_elastic', label: t('overlay_enter_animation_elastic', '弹性') },
    { value: 'fade', labelKey: 'overlay_enter_animation_fade', label: t('overlay_enter_animation_fade', '淡入') }
  ];
}

// The default first, then the installed fonts by name. A chosen family
// missing from the list (synced from another device, or the list not read
// yet) still shows, rather than reading as the default.
function getFontItems(values: OverlayValues, current: string, defaultItem: SelectControlItemModel): SelectControlItemModel[] {
  const installed = values.installedFonts ? Array.from(values.installedFonts) : [];
  installed.sort((left, right) => left[1].localeCompare(right[1], undefined, { sensitivity: 'base' }));
  const items: SelectControlItemModel[] = [
    defaultItem,
    // The menu previews each face with the face itself.
    ...installed.map(([family, label]) => ({ value: family, label, labelKey: '', fontFamily: family }))
  ];
  if (current && !items.some((item) => item.value === current)) {
    items.push({ value: current, label: getFontLabel(values, current), labelKey: '', fontFamily: current });
  }
  return items;
}

// A chosen face this device does not have: the overlay already falls back,
// and the row says which font is missing.
function isFontMissing(values: OverlayValues, family: string): boolean {
  return Boolean(values.installedFonts && family && !values.installedFonts.has(family));
}

function getFontRows(t: GetMessage, values: OverlayValues): OverlayFontRowModel[] {
  const unsupported = { browser: 'firefox', reasonKey: 'settings_overlay_font_unsupported_tooltip', active: values.fontsUnsupported };
  const family = '_x_extension_overlay_font_select_2026_unique_';
  const fallback = '_x_extension_overlay_font_fallback_select_2026_unique_';
  return [
    {
      key: overlayFontFamily.key,
      rowId: '_x_extension_overlay_font_row_2026_unique_',
      title: { id: `${family}_title`, text: t('settings_overlay_font_title', '本地字体') },
      description: t('settings_overlay_font_desc', '读取这台电脑已安装的字体，只对这台设备生效，不会同步'),
      unsupported,
      select: {
        disabled: values.fontsUnsupported,
        emptyLabel: t('settings_overlay_font_no_results', ''),
        id: family,
        items: getFontItems(values, values.fontFamily, {
          value: '',
          label: t('settings_overlay_font_default', '默认'),
          labelKey: 'settings_overlay_font_default'
        }),
        labelledBy: `${family}_title`,
        searchPlaceholder: t('settings_overlay_font_search_placeholder', ''),
        value: values.fontFamily
      },
      missing: {
        id: '_x_extension_overlay_font_missing_2026_unique_',
        text: isFontMissing(values, values.fontFamily)
          ? formatTemplate(t('settings_overlay_font_missing', ''), { font: getFontLabel(values, values.fontFamily) })
          : '',
        actionLabel: t('settings_overlay_font_missing_reset', '恢复默认'),
        hidden: !isFontMissing(values, values.fontFamily)
      }
    },
    {
      key: overlayFontFallback.key,
      rowId: '_x_extension_overlay_font_fallback_row_2026_unique_',
      title: { id: `${fallback}_title`, text: t('settings_overlay_font_fallback_title', '本地回退字体') },
      description: t('settings_overlay_font_fallback_desc', '主字体缺少字形时使用，例如英文字体下的中文'),
      unsupported,
      select: {
        disabled: values.fontsUnsupported,
        emptyLabel: t('settings_overlay_font_no_results', ''),
        id: fallback,
        items: getFontItems(values, values.fontFallback, {
          value: '',
          label: t('settings_overlay_font_fallback_none', '无'),
          labelKey: 'settings_overlay_font_fallback_none'
        }),
        labelledBy: `${fallback}_title`,
        searchPlaceholder: t('settings_overlay_font_search_placeholder', ''),
        value: values.fontFallback
      },
      missing: {
        id: '_x_extension_overlay_font_fallback_missing_2026_unique_',
        text: isFontMissing(values, values.fontFallback)
          ? formatTemplate(t('settings_overlay_font_fallback_missing', ''), { font: getFontLabel(values, values.fontFallback) })
          : '',
        actionLabel: t('settings_overlay_font_fallback_missing_reset', '清除'),
        hidden: !isFontMissing(values, values.fontFallback)
      }
    }
  ];
}

function getOverlayModel(t: GetMessage, values: OverlayValues): AppearanceOverlaySectionModel {
  const sizeTitle = t('settings_overlay_size_title', '尺寸');
  const animationTitle = t('settings_overlay_enter_animation_title', '进入动画');
  const sizeWidth = getOverlaySizePreset(values.sizeMode).width;
  // Like the New Tab search width, the marks are the named widths (each
  // size's own) and a drag settles on them.
  const sizeWidths = SIZE_MODES.map((mode) => getOverlaySizePreset(mode).width);
  return {
    rows: [
      { type: 'header', key: 'header', title: t('settings_webpage_focus_overlay_section_title', '网页聚焦搜索浮层') },
      {
        type: 'segmented',
        key: overlaySizeMode.key,
        compact: false,
        title: { text: sizeTitle },
        groupId: '_x_extension_overlay_size_tabs_wrap_2026_unique_',
        ariaLabel: sizeTitle,
        segmented: { activeValue: values.sizeMode, dataAttribute: 'data-overlay-size', items: getSizeItems(t) }
      },
      {
        type: 'slider',
        key: overlayWidth.key,
        rowId: '_x_extension_overlay_width_setting_row_2026_unique_',
        title: { text: t('settings_overlay_width_title', '宽度') },
        hostId: '_x_extension_overlay_width_control_2026_unique_',
        slider: {
          ariaLabel: t('settings_overlay_width_title', '宽度'),
          defaultValue: sizeWidth,
          id: '_x_extension_overlay_width_slider_2026_unique_',
          min: OVERLAY_WIDTH_MIN,
          max: OVERLAY_WIDTH_MAX,
          resetAriaLabel: t('settings_overlay_width_reset', 'Match the size setting'),
          resetButtonId: '_x_extension_overlay_width_reset_2026_unique_',
          snapPoints: sizeWidths,
          snapThreshold: 14,
          step: 1,
          ticks: sizeWidths.map((value) => ({
            label: String(value),
            percent: ((value - OVERLAY_WIDTH_MIN) / (OVERLAY_WIDTH_MAX - OVERLAY_WIDTH_MIN)) * 100
          })),
          value: values.width || sizeWidth,
          valueSuffix: ' px'
        }
      },
      {
        type: 'segmented',
        key: overlayEnterAnimation.key,
        compact: false,
        title: { text: animationTitle },
        groupId: '_x_extension_overlay_enter_animation_tabs_wrap_2026_unique_',
        ariaLabel: animationTitle,
        segmented: { activeValue: values.enterAnimation, dataAttribute: 'data-overlay-enter-animation', items: getAnimationItems(t) }
      },
      { type: 'slot', key: overlayFontFamily.key },
      { type: 'slot', key: overlayFontFallback.key },
      {
        type: 'toggle',
        key: overlayPageThemeAdaptationEnabled.key,
        rowId: '_x_extension_overlay_page_theme_adaptation_row_2026_unique_',
        hidden: values.themeMode !== 'system',
        title: {
          text: t('settings_overlay_page_theme_adaptation_title', '基于网页色彩自动变更主题色'),
          info: t(
            'settings_overlay_page_theme_adaptation_tooltip',
            '仅在“深浅色模式”=“跟随系统”时显示，关闭后将不再基于网页主题色变更深浅模式。'
          )
        },
        toggle: { id: '_x_extension_overlay_page_theme_adaptation_toggle_2026_unique_', checked: values.pageThemeAdaptation }
      }
    ],
    fonts: getFontRows(t, values)
  };
}

export { getFontLabel, getOverlayModel };
export type { OverlayValues };
