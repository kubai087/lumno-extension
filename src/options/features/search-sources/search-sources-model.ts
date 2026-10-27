// The Search sources tab's own copy around its lists: the search panel
// group order, each group's title and clear or reset button, and the
// aggregate searches' auto-group switch.
import type { GetMessage } from '../../options-types';
import type { AggregateSearchListRenderModel } from '../../react/aggregate-search-list';
import type { SiteSearchFormRenderModel } from '../../react/settings-forms';
import type { SearchGroupChipModel, ShortcutsTabModel } from '../../react/shortcuts-tab';
import type { SiteSearchListRenderModel } from '../../react/site-search-list';

interface SearchSourcesParts {
  groups: SearchGroupChipModel[];
  lists: Record<'custom' | 'sites' | 'ai' | 'engines', SiteSearchListRenderModel>;
  aggregateList: AggregateSearchListRenderModel;
  form: SiteSearchFormRenderModel;
  autoGroup: boolean;
}

function getConfirmCopy(t: GetMessage, label: string, confirmMessageKey: string, confirmMessage: string) {
  return {
    label,
    confirmMessage,
    confirmMessageKey,
    cancelLabel: t('confirm_cancel', '取消'),
    confirmLabel: t('confirm_ok', '确认')
  };
}

function getSearchSourcesModel(t: GetMessage, parts: SearchSourcesParts): ShortcutsTabModel {
  return {
    order: {
      title: t('settings_search_source_group_order_title', '搜索面板顺序'),
      info: t(
        'settings_search_source_group_order_desc',
        '拖动调整 Tab 搜索面板的分组顺序，不影响结果排序。Ctrl/⌘ + Z 撤销。'
      ),
      keyboardHint: t('settings_search_source_order_keyboard_hint', '按 Alt + 左右方向键调整位置'),
      groups: parts.groups
    },
    custom: {
      title: t('shortcuts_group_custom', '自定义'),
      clear: getConfirmCopy(
          t,
        t('shortcuts_clear_custom', '清空自定义'),
        'confirm_clear_custom',
        t('confirm_clear_custom', '确认清空自定义搜索？')
      ),
      list: parts.lists.custom
    },
    form: parts.form,
    aggregate: {
      title: t('aggregate_search_group_title', '聚合搜索'),
      clear: getConfirmCopy(
          t,
        t('aggregate_search_clear', '清空聚合搜索'),
        'confirm_clear_aggregate_search',
        t('confirm_clear_aggregate_search', '确认清空聚合搜索？')
      ),
      autoGroup: {
        title: t('settings_aggregate_search_auto_group_short_title', '自动创建标签页组'),
        info: t(
          'settings_aggregate_search_auto_group_desc',
          '开启后，聚合搜索打开的所有标签页会归入同一组，并以“聚合名称：搜索关键词”命名'
        ),
        toggle: {
          id: '_x_extension_aggregate_search_auto_group_toggle_2026_unique_',
          checked: parts.autoGroup,
          ariaLabel: t('settings_aggregate_search_auto_group_title', '聚合搜索自动创建标签页组')
        }
      },
      list: parts.aggregateList
    },
    sites: {
      title: t('search_scope_group_sites', '站内搜索'),
      reset: getConfirmCopy(
          t,
        t('shortcuts_reset_builtin', '重置为初始列表'),
        'confirm_reset_builtin',
        t('confirm_reset_builtin', '确认重置内置列表？')
      ),
      list: parts.lists.sites
    },
    ai: {
      title: t('shortcuts_group_ai', 'AI 搜索'),
      info: t(
        'shortcuts_group_ai_desc',
        '输入关键词，按下 Tab 并键入内容（Prompt）后，可跳转至以下 AI 网站并自动填入（需先登录对应网站）'
      ),
      list: parts.lists.ai
    },
    engines: {
      title: t('search_scope_group_engines', '搜索引擎'),
      list: parts.lists.engines
    }
  };
}

export { getSearchSourcesModel };
export type { SearchSourcesParts };
