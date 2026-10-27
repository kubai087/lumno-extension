// The rows of the daily quote in the Appearance tab, from its preferences,
// this device's custom collection and what the section is busy with.
import type { QuoteLibrary } from '../../../domain/custom-quotes';
import {
  NEWTAB_QUOTE_FONTS,
  NEWTAB_QUOTE_FONT_SIZE_DEFAULT,
  NEWTAB_QUOTE_FONT_SIZE_MAX,
  NEWTAB_QUOTE_FONT_SIZE_MIN
} from '../../../domain/settings';
import type { NewtabQuotePosition, NewtabQuotePrefs } from '../../../domain/settings/newtab-quote';
import type { GetMessage } from '../../options-types';
import type { QuoteLibraryRowModel } from '../../react/daily-quote-section';
import type { SelectControlItemModel } from '../../react/select-control';
import type { SettingsRowModel } from '../../react/settings-rows-view';

const POSITIONS: readonly NewtabQuotePosition[] = Object.freeze(['top', 'input', 'search', 'bottom']);

interface DailyQuoteState {
  prefs: NewtabQuotePrefs;
  // Null until a collection is imported.
  library: QuoteLibrary | null;
  importing: boolean;
  shuffling: boolean;
  // Why the last import failed.
  importError: string;
}

function getPositionItems(t: GetMessage): SelectControlItemModel[] {
  return POSITIONS.map((position) => {
    switch (position) {
      case 'top':
        return { value: position, labelKey: 'newtab_quote_top', label: t('newtab_quote_top', '输入框上方') };
      case 'input':
        return { value: position, labelKey: 'newtab_quote_input', label: t('newtab_quote_input', '输入框下方') };
      case 'search':
        return { value: position, labelKey: 'newtab_quote_search', label: t('newtab_quote_search', '快捷方式下方') };
      case 'bottom':
        return { value: position, labelKey: 'newtab_quote_bottom', label: t('newtab_quote_bottom', '页面底部') };
    }
  });
}

function getLibraryRow(t: GetMessage, state: DailyQuoteState): QuoteLibraryRowModel {
  // The import button names what it does now.
  const importLabel = state.importing
    ? t('newtab_quote_importing', 'Importing…')
    : (state.library ? t('newtab_quote_replace', 'Replace file') : t('newtab_quote_import', 'Import file'));
  return {
    title: t('newtab_quote_library', '句库'),
    hint: t(
      'newtab_quote_import_hint',
      '每天自动换一句，也可以点「换一句」手动更换。支持 TXT / MD，每个非空正文行作为一句；文件最大 1 MB，最多 1,000 句，每句不超过 500 字。保存在本机，不走浏览器同步；开启 WebDAV 后会随之同步。'
    ),
    count: state.library
      ? {
        label: t('newtab_quote_count', '{count} quotes').replace('{count}', String(state.library.quotes.length)),
        filename: state.library.filename
      }
      : null,
    canShuffle: Boolean(state.library && state.library.quotes.length >= 2),
    busy: state.importing || state.shuffling,
    importing: state.importing,
    importLabel,
    shuffleLabel: t('newtab_quote_shuffle_button', '换一句'),
    error: state.importError
  };
}

function getDailyQuoteRows(t: GetMessage, state: DailyQuoteState): SettingsRowModel[] {
  const isCustom = state.prefs.provider === 'custom';
  const title = t('newtab_quote_title', '每日名句');
  const sourceTitle = t('newtab_quote_source', '句子来源');
  const categoryTitle = t('newtab_quote_category', '名句类型');
  const min = NEWTAB_QUOTE_FONT_SIZE_MIN;
  const max = NEWTAB_QUOTE_FONT_SIZE_MAX;
  return [
    {
      type: 'toggle',
      key: 'enabled',
      title: {
        text: title,
        info: isCustom
          ? t('newtab_quote_provider_custom', 'Custom collection · on this device, syncs with WebDAV')
          : t('newtab_quote_provider', '由一言提供服务')
      },
      toggle: { id: '_x_extension_newtab_quote_toggle_2026_unique_', checked: state.prefs.enabled, ariaLabel: title, ariaLabelKey: 'newtab_quote_title' }
    },
    {
      type: 'reveal',
      key: 'quote-subrows',
      id: '_x_extension_newtab_quote_subrows_2026_unique_',
      expanded: state.prefs.enabled,
      rows: [
        {
          type: 'segmented',
          key: 'provider',
          rowId: '_x_extension_newtab_quote_source_row_2026_unique_',
          subrow: true,
          title: { text: sourceTitle },
          groupId: '_x_extension_newtab_quote_source_tabs_wrap_2026_unique_',
          ariaLabel: sourceTitle,
          segmented: {
            activeValue: state.prefs.provider,
            dataAttribute: 'data-quote-provider',
            items: [
              { value: 'hitokoto', labelKey: 'newtab_quote_hitokoto', label: t('newtab_quote_hitokoto', '一言') },
              { value: 'custom', labelKey: 'newtab_quote_custom', label: t('newtab_quote_custom', '自定义') }
            ]
          }
        },
        // The collection belongs to the custom source, the category to Hitokoto.
        {
          type: 'reveal',
          key: 'library-subrows',
          id: '_x_extension_newtab_quote_library_subrows_2026_unique_',
          expanded: isCustom,
          rows: [{ type: 'slot', key: 'library' }]
        },
        {
          type: 'reveal',
          key: 'category-subrows',
          id: '_x_extension_newtab_quote_category_subrows_2026_unique_',
          expanded: !isCustom,
          rows: [{
            type: 'segmented',
            key: 'category',
            rowId: '_x_extension_newtab_quote_category_row_2026_unique_',
            subrow: true,
            title: { text: categoryTitle },
            groupId: '_x_extension_newtab_quote_category_tabs_wrap_2026_unique_',
            ariaLabel: categoryTitle,
            segmented: {
              activeValue: state.prefs.category,
              dataAttribute: 'data-quote-category',
              items: [
                { value: 'literature', labelKey: 'newtab_quote_literature', label: t('newtab_quote_literature', '文学') },
                { value: 'poetry', labelKey: 'newtab_quote_poetry', label: t('newtab_quote_poetry', '诗词') }
              ]
            }
          }]
        },
        {
          type: 'select',
          key: 'position',
          rowId: '_x_extension_newtab_quote_position_row_2026_unique_',
          subrow: true,
          title: { id: '_x_extension_newtab_quote_position_select_2026_unique__title', text: t('newtab_quote_position', '名句位置') },
          select: {
            id: '_x_extension_newtab_quote_position_select_2026_unique_',
            items: getPositionItems(t),
            labelledBy: '_x_extension_newtab_quote_position_select_2026_unique__title',
            value: POSITIONS.includes(state.prefs.position) ? state.prefs.position : 'search'
          }
        },
        {
          type: 'select',
          key: 'font',
          rowId: '_x_extension_newtab_quote_font_row_2026_unique_',
          subrow: true,
          title: { id: '_x_extension_newtab_quote_font_select_2026_unique__title', text: t('newtab_quote_font', '字体') },
          select: {
            id: '_x_extension_newtab_quote_font_select_2026_unique_',
            items: NEWTAB_QUOTE_FONTS.map((font) => ({
              value: font.id,
              labelKey: font.labelKey,
              label: t(font.labelKey, font.label)
            })),
            labelledBy: '_x_extension_newtab_quote_font_select_2026_unique__title',
            value: state.prefs.font
          }
        },
        {
          type: 'slider',
          key: 'fontSize',
          rowId: '_x_extension_newtab_quote_font_size_row_2026_unique_',
          subrow: true,
          title: { text: t('newtab_quote_font_size', '字号') },
          hostId: '_x_extension_newtab_quote_font_size_control_2026_unique_',
          slider: {
            ariaLabel: t('newtab_quote_font_size_label', 'Quote font size'),
            defaultValue: NEWTAB_QUOTE_FONT_SIZE_DEFAULT,
            id: '_x_extension_newtab_quote_font_size_slider_2026_unique_',
            min,
            max,
            resetAriaLabel: t('newtab_quote_font_size_reset', 'Reset quote font size'),
            resetButtonId: '_x_extension_newtab_quote_font_size_reset_2026_unique_',
            step: 1,
            ticks: [
              { align: 'start', label: String(min) },
              { label: String(Math.round((min + max) / 2)) },
              { align: 'end', label: String(max) }
            ],
            value: state.prefs.fontSize
          }
        }
      ]
    }
  ];
}

export { POSITIONS, getDailyQuoteRows, getLibraryRow };
export type { DailyQuoteState };
