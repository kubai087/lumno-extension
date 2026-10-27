// What the Blacklist tab shows, from its rule lists and the enhanced icon
// fetching switch: each match mode's name and help, the rule rows, the add
// forms and the clear buttons.
import type { BlacklistRule, MatchMode } from '../../../domain/blacklist-utils';
import { createBlacklistModel } from '../../options-blacklist';
import type { BlacklistRuleDraft } from '../../options-blacklist';
import type { GetMessage } from '../../options-types';
import type { BlacklistListCopyModel, BlacklistListItemModel } from '../../react/blacklist-list';
import type { BlacklistClearModel, BlacklistGroupModel, BlacklistTabModel } from '../../react/blacklist-tab';
import type { BlacklistFormModeCopyModel, BlacklistFormRenderModel } from '../../react/settings-forms';

// A rule list and the add form beside it; the form closes whenever its
// reset version moves on.
interface RuleList {
  items: BlacklistRule[];
  formResetVersion: number;
}

interface BlacklistValues {
  search: RuleList;
  favicon: RuleList;
  enhancedFetch: boolean;
}

// A match mode's name and what it hides, with the message keys they come from.
interface BlacklistModeCopy {
  mode: MatchMode;
  labelKey: string;
  label: string;
  tooltipKey: string;
  tooltip: string;
}

// The edit form offers the widest match first, the add form the narrowest.
const LIST_MODE_ORDER: readonly MatchMode[] = ['suffix', 'exact', 'prefix'];
const FORM_MODE_ORDER: readonly MatchMode[] = ['exact', 'prefix', 'suffix'];

const blacklistModel = createBlacklistModel();

function getModeCopy(t: GetMessage, mode: MatchMode): BlacklistModeCopy {
  switch (mode) {
    case 'exact':
      return {
        mode,
        labelKey: 'blacklist_match_exact',
        label: t('blacklist_match_exact', '当前页面'),
        tooltipKey: 'blacklist_match_exact_tooltip',
        tooltip: t(
          'blacklist_match_exact_tooltip',
          '只屏蔽这一页\n────────\n例如，填 x.com/home 后，只有这一页不会出现，其他页面不受影响。'
        )
      };
    case 'suffix':
      return {
        mode,
        labelKey: 'blacklist_match_suffix',
        label: t('blacklist_match_suffix', '整个网站'),
        tooltipKey: 'blacklist_match_suffix_tooltip',
        tooltip: t(
          'blacklist_match_suffix_tooltip',
          '屏蔽这个网站的所有页面，也包括它的子网站\n────────\n例如，填 baidu.com 后，baidu.com/search 和 tieba.baidu.com 都不会出现。'
        )
      };
    default:
      return {
        mode,
        labelKey: 'blacklist_match_prefix',
        label: t('blacklist_match_prefix', '当前站点路径'),
        tooltipKey: 'blacklist_match_prefix_tooltip',
        tooltip: t(
          'blacklist_match_prefix_tooltip',
          '只屏蔽这个站点下这一路径的页面\n────────\n例如，填 baidu.com/search 后，baidu.com/search 和 baidu.com/search/1 不会出现，但 baidu.com/news 不受影响。'
        )
      };
  }
}


function getMatchBadge(t: GetMessage, modes: unknown): { tone: MatchMode; text: string } {
  const tone = blacklistModel.getMatchTone(modes);
  return { tone, text: getModeCopy(t, tone).label };
}


function buildRuleDraft(t: GetMessage, inputValue: string, matchModes: MatchMode[]): BlacklistRuleDraft {
  const draft = blacklistModel.buildRuleDraft(inputValue, matchModes);
  if (draft.item) {
    return draft;
  }
  if (draft.error === 'blacklist_error_match_mode') {
    return { error: t('blacklist_error_match_mode', '请选择至少一种匹配方式') };
  }
  return {
    error: draft.error === 'blacklist_error_domain'
      ? t('blacklist_error_domain', '请输入网站域名。')
      : t('blacklist_error_url', '请输入站点域名或完整 URL。')
  };
}


function getListCopy(t: GetMessage): BlacklistListCopyModel {
  return {
    cancelLabel: t('shortcuts_cancel', '取消'),
    confirmLabel: t('confirm_ok', '确认'),
    confirmMessage: t('confirm_remove_item', '确认移除该项？'),
    confirmMessageKey: 'confirm_remove_item',
    editLabel: t('shortcuts_edit', '编辑'),
    matchLabel: t('blacklist_match_label', '匹配方式'),
    modeOptions: LIST_MODE_ORDER.map((mode) => {
      const copy = getModeCopy(t, mode);
      return { mode, label: copy.label, tooltip: copy.tooltip };
    }),
    placeholderDomain: t('blacklist_placeholder_domain', 'baidu.com'),
    placeholderExact: t('blacklist_placeholder_exact', 'example.com/path'),
    placeholderPrefix: t('blacklist_placeholder_prefix', 'baidu.com or baidu.com/search'),
    removeLabel: t('shortcuts_remove', '移除'),
    saveLabel: t('shortcuts_save', '保存修改'),
    urlLabel: t('blacklist_label_url', 'URL rule')
  };
}

function getListItem(t: GetMessage, item: BlacklistRule): BlacklistListItemModel {
  const badge = getMatchBadge(t, item.matchModes);
  return {
    key: blacklistModel.buildItemKey(item),
    badgeText: badge.text,
    badgeTone: badge.tone,
    displayPattern: blacklistModel.formatPatternForDisplay(item),
    inputValue: blacklistModel.getPatternInputValue(item),
    matchModes: blacklistModel.normalizeMatchModes(item.matchModes)
  };
}

function getFormModel(t: GetMessage, addLabel: string): BlacklistFormRenderModel {
  return {
    copy: {
      addLabel,
      cancelLabel: t('shortcuts_cancel', '取消'),
      matchLabel: t('blacklist_match_label', '匹配方式'),
      modes: FORM_MODE_ORDER.map((mode): BlacklistFormModeCopyModel => {
        const copy = getModeCopy(t, mode);
        const presentation = blacklistModel.getInputConfig([mode]);
        return {
          label: copy.label,
          labelKey: copy.labelKey,
          mode,
          placeholder: t(presentation.placeholderKey, presentation.placeholderFallback),
          prefix: presentation.prefixText,
          tooltip: copy.tooltip,
          tooltipKey: copy.tooltipKey,
          urlLabel: t(presentation.labelKey, presentation.labelFallback),
          urlLabelKey: presentation.labelKey
        };
      })
    }
  };
}

function getClearModel(t: GetMessage, label: string, confirmMessageKey: string, confirmMessage: string): BlacklistClearModel {
  return {
    label,
    confirmMessage,
    confirmMessageKey,
    cancelLabel: t('confirm_cancel', '取消'),
    confirmLabel: t('confirm_ok', '确认')
  };
}

function getGroupModel(
  t: GetMessage,
  list: RuleList,
  editable: boolean,
  description: string,
  form: BlacklistFormRenderModel,
  clear: BlacklistClearModel
): BlacklistGroupModel {
  return {
    description,
    list: { copy: getListCopy(t), editable, items: list.items.map((item) => getListItem(t, item)) },
    form,
    formResetVersion: list.formResetVersion,
    clear
  };
}

function getBlacklistTabModel(t: GetMessage, values: BlacklistValues): BlacklistTabModel {
  return {
    search: {
      title: t('blacklist_group_custom', '全局禁用'),
      ...getGroupModel(
        t,
        values.search,
        true,
        t('blacklist_section_desc', '添加需要从搜索结果和新标签页中隐藏的网址。'),
        getFormModel(t, t('blacklist_add', '添加')),
        getClearModel(
          t,
          t('blacklist_clear', '清空隐藏规则'),
          'confirm_clear_blacklist',
          t('confirm_clear_blacklist', '确认清空隐藏规则？')
        )
      )
    },
    favicon: {
      enabled: values.enhancedFetch,
      ...getGroupModel(
        t,
        values.favicon,
        false,
        t('favicon_blacklist_section_desc', '按网站排除'),
        getFormModel(t, t('favicon_blacklist_add', '添加排除规则')),
        getClearModel(
          t,
          t('favicon_blacklist_clear', '清空排除规则'),
          'confirm_clear_favicon_blacklist',
          t('confirm_clear_favicon_blacklist', '确认清空排除规则？')
        )
      )
    },
    enhancedFetch: {
      title: t('settings_favicon_enhanced_fetch_title', '增强图标与主题色获取'),
      info: t(
        'settings_favicon_enhanced_fetch_desc',
        '若遇到本地网络访问权限提示，可关闭此功能。关闭后不直接加载网站图片，仍可使用浏览器缓存、内置图标和第三方图标服务。'
      ),
      toggle: { id: '_x_extension_favicon_enhanced_fetch_toggle_2026_unique_', checked: values.enhancedFetch }
    }
  };
}

export { blacklistModel, buildRuleDraft, getBlacklistTabModel };
export type { BlacklistValues, RuleList };
