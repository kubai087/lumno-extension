// The General tab's search results section, shared by the webpage overlay
// and the New Tab search box: where result tabs open, which result comes
// first, the browser content types shown and their order, how many results
// show, and fuzzy pinyin.
import { useMemo } from 'react';
import type { SearchSourceType } from '../../../domain/search/types';
import {
  searchFuzzyPinyinEnabled,
  searchResultDisplayLimit,
  searchResultPriority,
  searchResultSourceTypes,
  searchResultTabPosition
} from '../../../domain/settings/search';
import { useSetting } from '../../../shared/react/use-setting';
import { useStore } from '../../../shared/react/use-store';
import { useMessages, useOptionsPage } from '../../app/context';
import { saveSetting } from '../../app/save-setting';
import type { GetMessage } from '../../options-types';
import { SettingsRows, type SettingsRowModel, type SettingsRowsHandlers } from '../../react/settings-rows-view';

// The browser content a search can show, by its type.
const SOURCE_TYPES: ReadonlyArray<{ value: SearchSourceType; id: string; labelKey: string }> = [
  { value: 'topSite', id: '_x_extension_search_result_source_top_site_2026_unique_', labelKey: 'search_tag_top_site' },
  { value: 'bookmark', id: '_x_extension_search_result_source_bookmark_2026_unique_', labelKey: 'search_tag_bookmark' },
  { value: 'history', id: '_x_extension_search_result_source_history_2026_unique_', labelKey: 'search_tag_history' }
];

interface SearchValues {
  tabPosition: string;
  priority: string;
  displayLimit: number;
  fuzzyPinyin: boolean;
  selected: ReadonlySet<string>;
  // The source types in their shown order.
  ordered: readonly string[];
  localOrderIsDefault: boolean;
}

function getSearchRows(t: GetMessage, values: SearchValues): SettingsRowModel[] {
  const { selected } = values;
  const labels: Record<SearchSourceType, string> = {
    topSite: t('search_tag_top_site', '常用'),
    bookmark: t('search_tag_bookmark', '书签'),
    history: t('search_tag_history', '历史')
  };
  return [
    { type: 'header', key: 'header', title: t('settings_search_results_section_title', '搜索结果设置') },
    {
      type: 'select',
      key: searchResultTabPosition.key,
      title: {
        text: t('settings_search_result_tab_position_title', '搜索结果标签页打开位置'),
        id: '_x_extension_search_result_tab_position_select_2026_unique__title'
      },
      select: {
        id: '_x_extension_search_result_tab_position_select_2026_unique_',
        labelledBy: '_x_extension_search_result_tab_position_select_2026_unique__title',
        value: values.tabPosition,
        items: [
          { value: 'end', labelKey: 'search_result_tab_position_end', label: t('search_result_tab_position_end', '标签栏最右侧（最下方）') },
          { value: 'afterCurrent', labelKey: 'search_result_tab_position_after_current', label: t('search_result_tab_position_after_current', '当前标签页右侧（下方）') },
          { value: 'beforeCurrent', labelKey: 'search_result_tab_position_before_current', label: t('search_result_tab_position_before_current', '当前标签页左侧（上方）') }
        ]
      }
    },
    {
      type: 'segmented',
      key: searchResultPriority.key,
      title: { text: t('settings_search_result_priority_title', '搜索结果首位优先级') },
      groupId: '_x_extension_search_result_priority_tabs_wrap_2026_unique_',
      ariaLabel: t('settings_search_result_priority_title', '搜索结果首位优先级'),
      segmented: {
        activeValue: values.priority,
        dataAttribute: 'data-search-result-priority',
        items: [
          { value: 'autocomplete', labelKey: 'search_result_priority_autocomplete', label: t('search_result_priority_autocomplete', '补全优先') },
          { value: 'search', labelKey: 'search_result_priority_search', label: t('search_result_priority_search', '搜索优先') }
        ],
        select: { id: '_x_extension_search_result_priority_select_2026_unique_' }
      }
    },
    {
      type: 'checkbox-group',
      key: searchResultSourceTypes.key,
      title: { text: t('settings_search_result_sources_title', '显示结果类型') },
      groupId: searchResultSourceTypes.key,
      ariaLabel: t('settings_search_result_sources_title', '显示结果类型'),
      checkboxes: {
        required: true,
        sortable: true,
        items: values.ordered.flatMap((type) => {
          const item = SOURCE_TYPES.find((entry) => entry.value === type);
          return item ? [{
            value: item.value,
            id: item.id,
            checked: selected.has(item.value),
            label: labels[item.value],
            labelKey: item.labelKey
          }] : [];
        })
      },
      reset: {
        id: '_x_extension_search_result_source_types_reset_2026_unique_',
        label: t('settings_search_result_sources_reset', '恢复默认'),
        hidden: selected.size >= SOURCE_TYPES.length && values.localOrderIsDefault
      }
    },
    {
      type: 'slider',
      key: searchResultDisplayLimit.key,
      rowId: '_x_extension_search_result_display_limit_setting_row_2026_unique_',
      title: { text: t('settings_search_result_display_limit_title', '最多显示结果') },
      hostId: '_x_extension_search_result_display_limit_control_2026_unique_',
      slider: {
        ariaLabel: t('settings_search_result_display_limit_title', '最多显示结果'),
        id: '_x_extension_search_result_display_limit_slider_2026_unique_',
        min: 5,
        max: 10,
        step: 1,
        ticks: [
          { align: 'start', label: '5' },
          { align: 'end', label: '10' }
        ],
        value: values.displayLimit
      }
    },
    {
      type: 'toggle',
      key: searchFuzzyPinyinEnabled.key,
      title: { text: t('settings_search_fuzzy_pinyin_title', '拼音模糊音') },
      toggle: {
        id: '_x_extension_search_fuzzy_pinyin_toggle_2026_unique_',
        checked: values.fuzzyPinyin,
        ariaLabel: t('settings_search_fuzzy_pinyin_title', '拼音模糊音')
      }
    }
  ];
}

export function GeneralSearchSection() {
  const { settingsStore, sourceOrder, hideTooltip, getViewportTopInset } = useOptionsPage();
  const t = useMessages();
  const tabPosition = useSetting(settingsStore, searchResultTabPosition);
  const priority = useSetting(settingsStore, searchResultPriority);
  const displayLimit = useSetting(settingsStore, searchResultDisplayLimit);
  const fuzzyPinyin = useSetting(settingsStore, searchFuzzyPinyinEnabled);
  const sourceTypes = useSetting(settingsStore, searchResultSourceTypes);
  // The types in their shown order, which the search source order keeps.
  useStore(sourceOrder.store);
  const ordered = sourceOrder.sortLocalSourceTypes(SOURCE_TYPES.map((item) => item.value));

  const handlers = useMemo<SettingsRowsHandlers>(() => {
    const orderedTypes = () => sourceOrder.sortLocalSourceTypes(SOURCE_TYPES.map((item) => item.value));
    return {
      onToggle(key, checked) {
        if (key === searchFuzzyPinyinEnabled.key) {
          saveSetting(settingsStore, searchFuzzyPinyinEnabled, checked);
        }
      },
      onSelect(key, value) {
        if (key === searchResultTabPosition.key) {
          saveSetting(settingsStore, searchResultTabPosition, searchResultTabPosition.parse(value));
        } else if (key === searchResultPriority.key) {
          saveSetting(settingsStore, searchResultPriority, searchResultPriority.parse(value));
        }
      },
      onSlide(key, value) {
        if (key === searchResultDisplayLimit.key) {
          saveSetting(settingsStore, searchResultDisplayLimit, searchResultDisplayLimit.parse(value));
        }
      },
      onCheck(key, values) {
        if (key === searchResultSourceTypes.key) {
          saveSetting(settingsStore, searchResultSourceTypes, searchResultSourceTypes.parse(values));
        }
      },
      onMove(key, fromIndex, toIndex) {
        if (key === searchResultSourceTypes.key) {
          void sourceOrder.moveLocal(orderedTypes(), fromIndex, toIndex);
        }
      },
      // Every type back on and in its usual order; the order step can be undone.
      onReset(key) {
        if (key !== searchResultSourceTypes.key) {
          return;
        }
        void sourceOrder.resetLocal();
        saveSetting(settingsStore, searchResultSourceTypes, SOURCE_TYPES.map((item) => item.value));
        hideTooltip();
      },
      attachDrag: (key, dragHost) => (key === searchResultSourceTypes.key ? sourceOrder.attachLocalDrag(dragHost) : () => {}),
      getViewportTopInset
    };
  }, [settingsStore, sourceOrder, hideTooltip, getViewportTopInset]);

  const rows = getSearchRows(t, {
    tabPosition,
    priority,
    displayLimit,
    fuzzyPinyin,
    selected: new Set<string>(sourceTypes),
    ordered,
    localOrderIsDefault: sourceOrder.isLocalDefault()
  });
  return <SettingsRows handlers={handlers} rows={rows} />;
}
