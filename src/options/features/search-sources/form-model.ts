// The copy of the form that adds a custom site search.
import type { GetMessage } from '../../options-types';
import type { SiteSearchFormRenderModel } from '../../react/settings-forms';

function getSiteSearchFormModel(t: GetMessage): SiteSearchFormRenderModel {
  return {
    copy: {
      addLabel: t('shortcuts_add', '添加自定义搜索'),
      aliasLabel: t('shortcuts_label_alias', '别名'),
      aliasPlaceholder: t(
        'shortcuts_placeholder_alias',
        '选填，例如 小破站、油管等'
      ),
      cancelLabel: t('shortcuts_cancel', '取消'),
      categoryLabel: t('shortcuts_label_display_group', '显示位置'),
      keyLabel: t('shortcuts_label_key', '触发词'),
      keyPlaceholder: t(
        'shortcuts_placeholder_required',
        '必填，如有多个用英文逗号分隔，如 jd,bili'
      ),
      nameLabel: t('shortcuts_label_name', '显示名称'),
      namePlaceholder: t(
        'shortcuts_placeholder_optional_default',
        '选填，默认使用触发词'
      ),
      queryInsertLabel: t('shortcuts_insert_query', '插入查询变量'),
      searchEngineCategoryLabel: t(
        'search_scope_group_engines',
        '搜索引擎'
      ),
      siteCategoryLabel: t('search_scope_group_sites', '站内搜索'),
      templateHelp: t(
        'shortcuts_template_help',
        '1.打开你想添加的网站\n2.输入任一搜索词，触发搜索\n3.将搜索结果页面 url 粘贴在此处\n4.将关键词替换为{query}'
      ),
      templateLabel: t('shortcuts_label_template', '搜索模板'),
      templatePlaceholder: t(
        'shortcuts_placeholder_template',
        'https://example.com/search?q={query}'
      )
    }
  };
}

export { getSiteSearchFormModel };
