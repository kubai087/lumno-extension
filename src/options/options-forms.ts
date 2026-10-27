// The site search add form's copy, and the template formatting the page's
// messages use.
import type { GetMessage } from './options-types';
import type { SiteSearchFormRenderModel } from './react/settings-forms';

interface FormsState {
  // Made once the page has mounted its React views.
  siteSearchFormController: { render(model: SiteSearchFormRenderModel): void } | null;
}

interface FormsDeps {
  getMessage: GetMessage;
  optionsState: FormsState;
}

function createForms(deps: FormsDeps) {
  const { getMessage } = deps;

  // The page state object shared with options.js and the other modules.
  const optionsState = deps.optionsState;

  function formatTemplate(text: string, params: Record<string, string | number>): string {
    return String(text || '').replace(/\{(\w+)\}/g, (match, key: string) => {
      if (params && Object.prototype.hasOwnProperty.call(params, key)) {
        return String(params[key]);
      }
      return match;
    });
  }

  function getSiteSearchFormRenderModel(): SiteSearchFormRenderModel {
    return {
      copy: {
        addLabel: getMessage('shortcuts_add', '添加自定义搜索'),
        aliasLabel: getMessage('shortcuts_label_alias', '别名'),
        aliasPlaceholder: getMessage(
          'shortcuts_placeholder_alias',
          '选填，例如 小破站、油管等'
        ),
        cancelLabel: getMessage('shortcuts_cancel', '取消'),
        categoryLabel: getMessage('shortcuts_label_display_group', '显示位置'),
        keyLabel: getMessage('shortcuts_label_key', '触发词'),
        keyPlaceholder: getMessage(
          'shortcuts_placeholder_required',
          '必填，如有多个用英文逗号分隔，如 jd,bili'
        ),
        nameLabel: getMessage('shortcuts_label_name', '显示名称'),
        namePlaceholder: getMessage(
          'shortcuts_placeholder_optional_default',
          '选填，默认使用触发词'
        ),
        queryInsertLabel: getMessage('shortcuts_insert_query', '插入查询变量'),
        searchEngineCategoryLabel: getMessage(
          'search_scope_group_engines',
          '搜索引擎'
        ),
        siteCategoryLabel: getMessage('search_scope_group_sites', '站内搜索'),
        templateHelp: getMessage(
          'shortcuts_template_help',
          '1.打开你想添加的网站\n2.输入任一搜索词，触发搜索\n3.将搜索结果页面 url 粘贴在此处\n4.将关键词替换为{query}'
        ),
        templateLabel: getMessage('shortcuts_label_template', '搜索模板'),
        templatePlaceholder: getMessage(
          'shortcuts_placeholder_template',
          'https://example.com/search?q={query}'
        )
      }
    };
  }

  function renderSettingsForms(): void {
    if (optionsState.siteSearchFormController) {
      optionsState.siteSearchFormController.render(getSiteSearchFormRenderModel());
    }
  }

  return {
    formatTemplate,
    renderSettingsForms
  };
}

export { createForms };
export type { FormsDeps, FormsState };
