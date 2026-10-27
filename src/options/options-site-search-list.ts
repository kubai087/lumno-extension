// The site search lists: built-in, custom and AI providers with their
// icons and copy, drawn from the site search providers' store.
import type { SiteSearchProvider } from '../domain/search/types';
import type { ScrollToTargetOptions } from './options-navigation';
import type { createSearchSourceOrderController } from './options-search-source-order';
import { getActiveBuiltinSiteSearchProviders } from './options-site-search';
import type { GetMessage } from './options-types';
import type { ReorderCopyModel } from './react/reorder-buttons';
import * as BundledIcons from '../domain/favicon/shortcut-favicon/bundled-icons';
import type {
  SiteSearchListCopyModel,
  SiteSearchListRenderModel,
  SiteSearchProviderItemModel
} from './react/site-search-list';
import * as SearchSiteSearchProviders from '../domain/search/utils/site-search-providers';
import type { SiteSearchProviders } from './features/site-search/providers';

// A provider as a list shows it: built-in or custom.
type ListedSiteSearchProvider = SiteSearchProvider & { _xIsCustom: boolean };

type SiteSearchListControllerRef = { render(model: SiteSearchListRenderModel): void } | null;

interface SiteSearchListState {
  searchSourceOrderController: Pick<ReturnType<typeof createSearchSourceOrderController>, 'sortList'>;
  siteSearchEngineBuiltinListController: SiteSearchListControllerRef;
  siteSearchCustomListController: SiteSearchListControllerRef;
  siteSearchBuiltinListController: SiteSearchListControllerRef;
  siteSearchAiBuiltinListController: SiteSearchListControllerRef;
  // A linked setting to scroll to once the lists have rendered.
  pendingOptionsScrollTarget: string;
}

interface SiteSearchListDeps {
  providers: Pick<SiteSearchProviders, 'store'>;
  getMessage: GetMessage;
  // The keys each list shows right now, in order, for the move buttons.
  renderedSearchSourceKeys: Record<string, string[]>;
  initTooltips(): void;
  scrollToOptionsTarget(targetKey: string, options?: ScrollToTargetOptions): boolean;
  optionsState: SiteSearchListState;
}

function createSiteSearchList(deps: SiteSearchListDeps) {
  const { providers, getMessage, renderedSearchSourceKeys, initTooltips, scrollToOptionsTarget } = deps;
  const { normalizeSiteSearchTemplate, isSearchEngineSiteSearchProvider, isAiSiteSearchProvider } = SearchSiteSearchProviders;

  // The page state object shared with options.js and the other modules.
  const optionsState = deps.optionsState;

  function getLocalizedBuiltinProviderName(item: SiteSearchProvider | null): string {
    if (!item || item._xIsCustom) {
      return item ? (item.name || item.key) : '';
    }
    const mapping = SearchSiteSearchProviders.getSiteSearchProviderDisplayNameMessage(item);
    if (!mapping) {
      return item.name || item.key;
    }
    return getMessage(mapping.messageKey, mapping.fallback);
  }

  function getSiteSearchItemIconUrl(item: SiteSearchProvider | null): string {
    if (!item) {
      return '';
    }
    const localIconAsset = !item._xIsCustom
      ? BundledIcons.getSiteSearchPinnedIconAssetPath(item)
      : '';
    if (localIconAsset) {
      return chrome.runtime.getURL(localIconAsset);
    }
    if (item.icon) {
      return item.icon.trim();
    }
    if (item.iconUrl) {
      return item.iconUrl.trim();
    }
    try {
      const template = normalizeSiteSearchTemplate(String(item.template || '').trim());
      const url = template.replace(/\{query\}/g, 'test');
      const hostname = new URL(url).hostname;
      return hostname
        ? `https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=${encodeURIComponent(`https://${hostname}/`)}&size=64`
        : '';
    } catch (error) {
      return '';
    }
  }

  function getSiteSearchListCopy(): SiteSearchListCopyModel {
    return {
      aliasLabel: getMessage('shortcuts_label_alias', '别名'),
      aliasPlaceholder: getMessage('shortcuts_placeholder_alias', '选填，例如 小破站、油管等'),
      cancelLabel: getMessage('shortcuts_cancel', '取消'),
      categoryLabel: getMessage('shortcuts_label_display_group', '显示位置'),
      confirmLabel: getMessage('confirm_ok', '确认'),
      confirmMessage: getMessage('confirm_remove_item', '确认移除该项？'),
      confirmMessageKey: 'confirm_remove_item',
      editLabel: getMessage('shortcuts_edit', '编辑'),
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
      removeLabel: getMessage('shortcuts_remove', '移除'),
      saveLabel: getMessage('shortcuts_save', '保存修改'),
      searchEngineCategoryLabel: getMessage(
        'search_scope_group_engines',
        '搜索引擎'
      ),
      siteCategoryLabel: getMessage('search_scope_group_sites', '站内搜索'),
      templateHelp: getMessage(
        'shortcuts_template_help',
        '1.打开你想添加的网站\n2.输入任一搜索词，触发搜索\n3.将搜索结果页面 url 粘贴在此处\n4.将关键词替换为{query}'
      ),
      templateLabel: getMessage('shortcuts_label_template', '搜索模板')
    };
  }

  function getSiteSearchProviderItemModel(
    item: ListedSiteSearchProvider,
    builtinTemplateSet: ReadonlySet<string>
  ): SiteSearchProviderItemModel {
    const normalizedTemplate = normalizeSiteSearchTemplate(String(item.template || '').trim());
    const isCustom = item._xIsCustom;
    const isSearchEngine = isSearchEngineSiteSearchProvider(item);
    const duplicate = isCustom && Boolean(normalizedTemplate) && builtinTemplateSet.has(normalizedTemplate);
    return {
      aliasesText: Array.isArray(item.aliases) ? item.aliases.join(',') : '',
      badgeText: isCustom
        ? getMessage('shortcuts_badge_custom', '自定义')
        : isSearchEngine
          ? getMessage('search_scope_group_engines', '搜索引擎')
          : isAiSiteSearchProvider(item)
            ? getMessage('shortcuts_badge_ai', 'AI 搜索')
            : getMessage('shortcuts_badge_builtin', '内置'),
      category: isSearchEngine ? 'searchEngine' : 'site',
      duplicateLabel: duplicate
        ? getMessage('shortcuts_duplicate_tag', '与内置重复')
        : '',
      duplicateTemplate: duplicate ? normalizedTemplate : '',
      duplicateTooltip: duplicate
        ? getMessage('shortcuts_duplicate_action', '定位内置项')
        : '',
      iconUrl: getSiteSearchItemIconUrl(item),
      id: `${isCustom ? 'custom' : 'builtin'}:${String(item.key || '')}`,
      isBuiltin: !isCustom,
      key: String(item.key || ''),
      meta: `${item.key || ''} · ${item.template || ''}`,
      name: getLocalizedBuiltinProviderName(item),
      normalizedTemplate,
      secondaryBadgeText: isCustom
        ? (isSearchEngine
            ? getMessage('search_scope_group_engines', '搜索引擎')
            : getMessage('search_scope_group_sites', '站内搜索'))
        : isSearchEngine
          ? getMessage('shortcuts_badge_builtin', '内置')
          : '',
      template: String(item.template || ''),
      templateEditable: isCustom
    };
  }

  function getSearchSourceReorderCopy(): ReorderCopyModel {
    return {
      moveDownLabel: getMessage('settings_search_source_move_down', '下移'),
      moveUpLabel: getMessage('settings_search_source_move_up', '上移')
    };
  }

  function renderSiteSearchListController(
    controller: SiteSearchListControllerRef,
    items: ListedSiteSearchProvider[],
    placeholder: string,
    builtinTemplateSet: ReadonlySet<string>,
    listId: string
  ): boolean {
    if (!controller) {
      return false;
    }
    const ordered = optionsState.searchSourceOrderController.sortList(items, listId, (item) => item.key);
    renderedSearchSourceKeys[listId] = ordered.map((item) => String(item.key || '').toLowerCase());
    controller.render({
      copy: getSiteSearchListCopy(),
      items: ordered.map(
        (item) => getSiteSearchProviderItemModel(item, builtinTemplateSet)
      ),
      placeholder: placeholder || '',
      reorder: getSearchSourceReorderCopy()
    });
    return true;
  }

  function locateBuiltinSiteSearchProvider(normalizedTemplate: string): void {
    const targetRow = Array.from(document.querySelectorAll(
      '[data-type="builtin"][data-template]'
    )).find((row) => row.getAttribute('data-template') === normalizedTemplate);
    if (!targetRow) {
      return;
    }
    targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    targetRow.removeAttribute('data-flash');
    // Reading the layout restarts the animation when the attribute returns.
    void targetRow.getBoundingClientRect();
    targetRow.setAttribute('data-flash', 'true');
    const onFlashEnd = () => {
      targetRow.removeAttribute('data-flash');
      targetRow.removeEventListener('animationend', onFlashEnd);
    };
    targetRow.addEventListener('animationend', onFlashEnd);
  }

  function renderSiteSearchList(): void {
    const { defaults, custom, disabledKeys } = providers.store.getSnapshot();
    const customKeys = new Set(
      custom.map((item) =>
        String(item.key || '').toLowerCase()
      )
    );
    const displayDefaults = defaults.filter((item) => {
      const key = String(item.key || '').toLowerCase();
      return Boolean(key) && !customKeys.has(key) && !disabledKeys.has(key);
    });
    const displayEngineDefaults = displayDefaults.filter((item) => isSearchEngineSiteSearchProvider(item));
    const displayAiDefaults = displayDefaults.filter((item) => isAiSiteSearchProvider(item));
    const displaySearchDefaults = displayDefaults.filter(
      (item) => (
        !isSearchEngineSiteSearchProvider(item) && !isAiSiteSearchProvider(item)
      )
    );
    const builtinTemplateSet = new Set(
      getActiveBuiltinSiteSearchProviders(defaults, custom, disabledKeys)
        .map((item) =>
          normalizeSiteSearchTemplate(String(item.template || '').trim())
        )
        .filter(Boolean)
    );
    const customItems: ListedSiteSearchProvider[] = custom.map((item) => ({
      ...item,
      _xIsCustom: true
    }));
    const engineItems: ListedSiteSearchProvider[] = displayEngineDefaults.map((item) => ({
      ...item,
      _xIsCustom: false
    }));
    const searchItems: ListedSiteSearchProvider[] = displaySearchDefaults.map((item) => ({
      ...item,
      _xIsCustom: false
    }));
    const aiItems: ListedSiteSearchProvider[] = displayAiDefaults.map((item) => ({
      ...item,
      _xIsCustom: false
    }));

    renderSiteSearchListController(
      optionsState.siteSearchEngineBuiltinListController,
      engineItems,
      getMessage('shortcuts_empty_engines', '暂无内置搜索引擎'),
      builtinTemplateSet,
      'engine'
    );
    renderSiteSearchListController(
      optionsState.siteSearchCustomListController,
      customItems,
      '',
      builtinTemplateSet,
      'custom'
    );
    renderSiteSearchListController(
      optionsState.siteSearchBuiltinListController,
      searchItems,
      getMessage('shortcuts_empty_builtin', '暂无内置站内搜索'),
      builtinTemplateSet,
      'site'
    );
    renderSiteSearchListController(
      optionsState.siteSearchAiBuiltinListController,
      aiItems,
      getMessage('shortcuts_empty_ai', '暂无内置 AI 搜索'),
      builtinTemplateSet,
      'ai'
    );
    initTooltips();
    if (
      optionsState.pendingOptionsScrollTarget &&
      scrollToOptionsTarget(optionsState.pendingOptionsScrollTarget, { behavior: 'auto' })
    ) {
      optionsState.pendingOptionsScrollTarget = '';
    }
  }

  return {
    getLocalizedBuiltinProviderName,
    getSiteSearchItemIconUrl,
    getSearchSourceReorderCopy,
    locateBuiltinSiteSearchProvider,
    renderSiteSearchList
  };
}

export { createSiteSearchList };
export type { ListedSiteSearchProvider, SiteSearchListDeps, SiteSearchListState };
