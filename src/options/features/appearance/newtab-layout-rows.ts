// The rows of the New Tab layout in the Appearance tab, from their values:
// whether the search box takes focus, the shortcuts and their size, the
// bookmark rows, the recent site cards and the page buttons.
import {
  newtabInputAutoFocusEnabled,
  newtabShortcutsVisible,
  newtabShortcutAddVisible,
  newtabShortcutDockMagnificationEnabled,
  newtabShortcutColumns,
  newtabShortcutSize,
  newtabShortcutGap,
  bookmarkCount,
  bookmarkColumns,
  bookmarkFolderIconsVisible,
  newtabFeedbackButtonVisible,
  newtabAppearanceButtonVisible,
  NEWTAB_SHORTCUT_COLUMNS_MIN,
  NEWTAB_SHORTCUT_COLUMNS_MAX,
  NEWTAB_SHORTCUT_SIZE_MIN,
  NEWTAB_SHORTCUT_SIZE_MAX,
  NEWTAB_SHORTCUT_SIZE_DEFAULT,
  NEWTAB_SHORTCUT_GAP_MIN,
  NEWTAB_SHORTCUT_GAP_MAX,
  NEWTAB_SHORTCUT_GAP_DEFAULT
} from '../../../domain/settings';
import type { GetMessage } from '../../options-types';
import type { RecentSitesRowModel } from '../../react/appearance-newtab-layout-section';
import type { SettingsRowModel } from '../../react/settings-rows-view';

interface NewtabLayoutValues {
  autoFocus: boolean;
  shortcutsVisible: boolean;
  shortcutAdd: boolean;
  shortcutDock: boolean;
  shortcutColumns: number;
  shortcutSize: number;
  shortcutGap: number;
  bookmarkCount: number;
  bookmarkColumns: number;
  folderIcons: boolean;
  recentCount: number;
  recentMode: 'latest' | 'most';
  feedbackButton: boolean;
  appearanceButton: boolean;
}

function getShortcutRows(t: GetMessage, values: NewtabLayoutValues): SettingsRowModel[] {
  // The shortcut options stay in place, dimmed, while shortcuts are off.
  const disabled = !values.shortcutsVisible;
  const sizeMin = NEWTAB_SHORTCUT_SIZE_MIN;
  const sizeMax = NEWTAB_SHORTCUT_SIZE_MAX;
  const sizeDefault = NEWTAB_SHORTCUT_SIZE_DEFAULT;
  const shortcutsTitle = t('settings_newtab_shortcuts_title', '快捷方式');
  const addTitle = t('settings_newtab_shortcut_add_title', '展示「+」');
  const dockTitle = t('settings_newtab_shortcut_dock_magnification_title', '仿 macOS Dock 程序坞缩放效果');
  return [
    {
      type: 'toggle',
      key: newtabShortcutsVisible.key,
      title: { text: shortcutsTitle },
      toggle: {
        id: '_x_extension_newtab_shortcuts_toggle_2026_unique_',
        checked: values.shortcutsVisible,
        ariaLabel: shortcutsTitle,
        ariaLabelKey: 'settings_newtab_shortcuts_title'
      }
    },
    {
      type: 'toggle',
      key: newtabShortcutAddVisible.key,
      rowId: '_x_extension_newtab_shortcut_add_row_2026_unique_',
      subrow: true,
      disabled,
      title: { text: addTitle },
      toggle: {
        id: '_x_extension_newtab_shortcut_add_toggle_2026_unique_',
        checked: values.shortcutAdd,
        disabled,
        ariaLabel: addTitle,
        ariaLabelKey: 'settings_newtab_shortcut_add_title'
      }
    },
    {
      type: 'toggle',
      key: newtabShortcutDockMagnificationEnabled.key,
      rowId: '_x_extension_newtab_shortcut_dock_magnification_row_2026_unique_',
      subrow: true,
      disabled,
      title: { text: dockTitle },
      toggle: {
        id: '_x_extension_newtab_shortcut_dock_magnification_toggle_2026_unique_',
        checked: values.shortcutDock,
        disabled,
        ariaLabel: dockTitle,
        ariaLabelKey: 'settings_newtab_shortcut_dock_magnification_title'
      }
    },
    {
      type: 'slider',
      key: newtabShortcutColumns.key,
      rowId: '_x_extension_newtab_shortcut_columns_setting_row_2026_unique_',
      subrow: true,
      disabled,
      title: { text: t('settings_newtab_shortcut_columns_title', '快捷方式每行数量') },
      hostId: '_x_extension_newtab_shortcut_columns_control_2026_unique_',
      slider: {
        ariaLabel: t('settings_newtab_shortcut_columns_title', 'Shortcuts per row'),
        disabled,
        id: '_x_extension_newtab_shortcut_columns_slider_2026_unique_',
        min: NEWTAB_SHORTCUT_COLUMNS_MIN,
        max: NEWTAB_SHORTCUT_COLUMNS_MAX,
        step: 1,
        ticks: [
          { align: 'start', label: '4', percent: 0 },
          { label: '8', percent: 100 / 3 },
          { label: '12', percent: 200 / 3 },
          { align: 'end', label: '16', percent: 100 }
        ],
        value: values.shortcutColumns
      }
    },
    {
      type: 'slider',
      key: newtabShortcutSize.key,
      rowId: '_x_extension_newtab_shortcut_size_setting_row_2026_unique_',
      subrow: true,
      disabled,
      title: { text: t('settings_newtab_shortcut_size_title', '快捷方式大小') },
      hostId: '_x_extension_newtab_shortcut_size_control_2026_unique_',
      slider: {
        ariaLabel: t('settings_newtab_shortcut_size_title', 'Shortcut size'),
        defaultValue: sizeDefault,
        disabled,
        id: '_x_extension_newtab_shortcut_size_slider_2026_unique_',
        min: sizeMin,
        max: sizeMax,
        resetAriaLabel: t('settings_newtab_shortcut_size_reset', 'Reset shortcut size'),
        resetButtonId: '_x_extension_newtab_shortcut_size_reset_2026_unique_',
        step: 1,
        ticks: [
          { align: 'start', label: String(sizeMin), percent: 0 },
          { label: String(sizeDefault), percent: ((sizeDefault - sizeMin) / (sizeMax - sizeMin)) * 100 },
          { align: 'end', label: String(sizeMax), percent: 100 }
        ],
        value: values.shortcutSize,
        valueSuffix: ' px'
      }
    },
    {
      type: 'slider',
      key: newtabShortcutGap.key,
      rowId: '_x_extension_newtab_shortcut_gap_setting_row_2026_unique_',
      subrow: true,
      disabled,
      title: { text: t('settings_newtab_shortcut_gap_title', '快捷方式间距') },
      hostId: '_x_extension_newtab_shortcut_gap_control_2026_unique_',
      slider: {
        ariaLabel: t('settings_newtab_shortcut_gap_title', 'Shortcut spacing'),
        defaultValue: NEWTAB_SHORTCUT_GAP_DEFAULT,
        disabled,
        id: '_x_extension_newtab_shortcut_gap_slider_2026_unique_',
        min: NEWTAB_SHORTCUT_GAP_MIN,
        max: NEWTAB_SHORTCUT_GAP_MAX,
        resetAriaLabel: t('settings_newtab_shortcut_gap_reset', 'Reset shortcut spacing'),
        resetButtonId: '_x_extension_newtab_shortcut_gap_reset_2026_unique_',
        step: 1,
        ticks: [
          { align: 'start', label: '0', percent: 0 },
          { label: '8', percent: 100 / 3 },
          { label: '16', percent: 200 / 3 },
          { align: 'end', label: '24', percent: 100 }
        ],
        value: values.shortcutGap,
        valueSuffix: ' px'
      }
    }
  ];
}

function getBookmarkRows(t: GetMessage, values: NewtabLayoutValues): SettingsRowModel[] {
  const adaptiveCount = t(
    'settings_bookmark_adaptive_count_tooltip',
    '该值为宽度充足时的最大数量，实际显示数量会根据可用空间自适应。'
  );
  const folderIconsTitle = t('settings_bookmark_folder_icons_visible_title', '展示书签文件夹内图标');
  return [
    {
      type: 'slider',
      key: bookmarkCount.key,
      rowId: '_x_extension_bookmark_rows_setting_row_2026_unique_',
      compact: false,
      title: { text: t('settings_bookmarks_title', '书签行数'), info: adaptiveCount },
      hostId: '_x_extension_bookmark_rows_control_2026_unique_',
      slider: {
        ariaLabel: t('settings_bookmarks_title', 'Bookmark rows'),
        id: '_x_extension_bookmark_rows_slider_2026_unique_',
        min: 0,
        max: 8,
        step: 1,
        ticks: [
          { align: 'start', label: '0' },
          { label: '4' },
          { align: 'end', label: '8' }
        ],
        value: values.bookmarkCount / 4
      }
    },
    {
      // How the bookmarks lay out only matters while there are some.
      type: 'reveal',
      key: 'bookmark-subrows',
      id: '_x_extension_bookmark_subrows_2026_unique_',
      expanded: values.bookmarkCount > 0,
      rows: [
        {
          type: 'slider',
          key: bookmarkColumns.key,
          rowId: '_x_extension_bookmark_columns_setting_row_2026_unique_',
          compact: false,
          subrow: true,
          title: { text: t('settings_bookmark_columns_title', '书签每行数量'), info: adaptiveCount },
          hostId: '_x_extension_bookmark_columns_control_2026_unique_',
          slider: {
            ariaLabel: t('settings_bookmark_columns_title', 'Bookmarks per row'),
            id: '_x_extension_bookmark_columns_slider_2026_unique_',
            min: 4,
            max: 8,
            step: 1,
            ticks: [
              { align: 'start', label: '4' },
              { label: '6' },
              { align: 'end', label: '8' }
            ],
            value: values.bookmarkColumns
          }
        },
        {
          type: 'toggle',
          key: bookmarkFolderIconsVisible.key,
          rowId: '_x_extension_bookmark_folder_icons_visible_row_2026_unique_',
          subrow: true,
          title: { text: folderIconsTitle },
          toggle: {
            id: '_x_extension_bookmark_folder_icons_visible_toggle_2026_unique_',
            checked: values.folderIcons,
            ariaLabel: folderIconsTitle,
            ariaLabelKey: 'settings_bookmark_folder_icons_visible_title'
          }
        }
      ]
    }
  ];
}

function getRecentRow(t: GetMessage, values: NewtabLayoutValues): RecentSitesRowModel {
  const count = values.recentCount;
  return {
    title: t('settings_recent_sites_title', '站点卡片'),
    count: {
      ariaLabel: t('settings_recent_sites_title', 'Recent site cards'),
      id: '_x_extension_recent_count_slider_2026_unique_',
      min: 0,
      max: 2,
      step: 1,
      ticks: [
        { align: 'start', label: '0' },
        { label: '1' },
        { align: 'end', label: '2' }
      ],
      value: count / 4
    },
    mode: count > 0
      ? {
        activeValue: values.recentMode,
        dataAttribute: 'data-recent-mode',
        items: [
          { value: 'latest', labelKey: 'recent_mode_latest', label: t('recent_mode_latest', '最近访问') },
          { value: 'most', labelKey: 'recent_mode_most', label: t('recent_mode_most', '最常访问') }
        ],
        select: { id: '_x_extension_recent_mode_select_2024_unique_' }
      }
      : null
  };
}

function getNewtabLayoutRows(t: GetMessage, values: NewtabLayoutValues): SettingsRowModel[] {
  const autoFocusTitle = t('newtab_input_auto_focus_title', '输入框自动聚焦');
  const feedbackTitle = t('settings_newtab_feedback_button_visible_title', '展示反馈按钮');
  const appearanceTitle = t('settings_newtab_appearance_button_visible_title', '展示外观按钮');
  return [
    {
      type: 'toggle',
      key: newtabInputAutoFocusEnabled.key,
      title: { text: autoFocusTitle },
      toggle: {
        id: '_x_extension_newtab_input_auto_focus_toggle_2026_unique_',
        checked: values.autoFocus,
        ariaLabel: autoFocusTitle,
        ariaLabelKey: 'newtab_input_auto_focus_title'
      }
    },
    ...getShortcutRows(t, values),
    ...getBookmarkRows(t, values),
    { type: 'slot', key: 'recent' },
    { type: 'label', key: 'page-buttons', group: true, title: { text: t('settings_newtab_page_buttons_title', '页面按钮') } },
    {
      type: 'toggle',
      key: newtabFeedbackButtonVisible.key,
      subrow: true,
      title: { text: feedbackTitle },
      toggle: {
        id: '_x_extension_newtab_feedback_button_visible_toggle_2026_unique_',
        checked: values.feedbackButton,
        ariaLabel: feedbackTitle,
        ariaLabelKey: 'settings_newtab_feedback_button_visible_title'
      }
    },
    {
      type: 'toggle',
      key: newtabAppearanceButtonVisible.key,
      subrow: true,
      title: { text: appearanceTitle },
      toggle: {
        id: '_x_extension_newtab_appearance_button_visible_toggle_2026_unique_',
        checked: values.appearanceButton,
        ariaLabel: appearanceTitle,
        ariaLabelKey: 'settings_newtab_appearance_button_visible_title'
      }
    }
  ];
}

export { getNewtabLayoutRows, getRecentRow };
export type { NewtabLayoutValues };
