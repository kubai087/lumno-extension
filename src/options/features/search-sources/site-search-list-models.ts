// The Search sources tab's site search lists, from the providers' state:
// custom providers, then the built-in sites, AI searches and engines that
// are on, each in the order the reader gave it.
import type { SiteSearchProvider } from '../../../domain/search/types';
import * as SearchSiteSearchProviders from '../../../domain/search/utils/site-search-providers';
import { getActiveBuiltinSiteSearchProviders } from '../../options-site-search';
import type { GetMessage } from '../../options-types';
import type { ReorderCopyModel } from '../../react/reorder-buttons';
import type { SiteSearchListCopyModel, SiteSearchListRenderModel, SiteSearchProviderItemModel } from '../../react/site-search-list';
import type { SiteSearchProvidersState } from '../site-search/providers';
import { getProviderIconUrl, getProviderName, type ListedSiteSearchProvider } from './provider-display';

// Sorts a list's items into the reader's order for that list.
type SortList = <T extends { key?: unknown } | null>(items: readonly T[], listId: string, getKey?: (item: T) => unknown) => T[];

type SiteSearchListName = 'custom' | 'sites' | 'ai' | 'engines';

interface SiteSearchListModels {
  lists: Record<SiteSearchListName, SiteSearchListRenderModel>;
  // The keys each list shows, in order, by the source order's list id;
  // the move buttons move by them.
  keys: Record<string, string[]>;
}

function getSiteSearchListCopy(t: GetMessage): SiteSearchListCopyModel {
  return {
    aliasLabel: t('shortcuts_label_alias', '别名'),
    aliasPlaceholder: t('shortcuts_placeholder_alias', '选填，例如 小破站、油管等'),
    cancelLabel: t('shortcuts_cancel', '取消'),
    categoryLabel: t('shortcuts_label_display_group', '显示位置'),
    confirmLabel: t('confirm_ok', '确认'),
    confirmMessage: t('confirm_remove_item', '确认移除该项？'),
    confirmMessageKey: 'confirm_remove_item',
    editLabel: t('shortcuts_edit', '编辑'),
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
    removeLabel: t('shortcuts_remove', '移除'),
    saveLabel: t('shortcuts_save', '保存修改'),
    searchEngineCategoryLabel: t(
      'search_scope_group_engines',
      '搜索引擎'
    ),
    siteCategoryLabel: t('search_scope_group_sites', '站内搜索'),
    templateHelp: t(
      'shortcuts_template_help',
      '1.打开你想添加的网站\n2.输入任一搜索词，触发搜索\n3.将搜索结果页面 url 粘贴在此处\n4.将关键词替换为{query}'
    ),
    templateLabel: t('shortcuts_label_template', '搜索模板')
  };
}

// A row's badges: what kind of provider it is, and for a custom one where
// it shows; a built-in engine is marked built-in beside its group.
function getBadges(t: GetMessage, item: ListedSiteSearchProvider, isCustom: boolean, isSearchEngine: boolean) {
  if (isCustom) {
    return {
      badgeText: t('shortcuts_badge_custom', '自定义'),
      secondaryBadgeText: isSearchEngine ? t('search_scope_group_engines', '搜索引擎') : t('search_scope_group_sites', '站内搜索')
    };
  }
  if (isSearchEngine) {
    return { badgeText: t('search_scope_group_engines', '搜索引擎'), secondaryBadgeText: t('shortcuts_badge_builtin', '内置') };
  }
  return {
    badgeText: SearchSiteSearchProviders.isAiSiteSearchProvider(item) ? t('shortcuts_badge_ai', 'AI 搜索') : t('shortcuts_badge_builtin', '内置'),
    secondaryBadgeText: ''
  };
}

function getSiteSearchProviderItemModel(
  t: GetMessage,
  item: ListedSiteSearchProvider,
  builtinTemplateSet: ReadonlySet<string>
): SiteSearchProviderItemModel {
  const normalizedTemplate = SearchSiteSearchProviders.normalizeSiteSearchTemplate(String(item.template || '').trim());
  const isCustom = item._xIsCustom === true;
  const isSearchEngine = SearchSiteSearchProviders.isSearchEngineSiteSearchProvider(item);
  const duplicate = isCustom && Boolean(normalizedTemplate) && builtinTemplateSet.has(normalizedTemplate);
  return {
    aliasesText: Array.isArray(item.aliases) ? item.aliases.join(',') : '',
    ...getBadges(t, item, isCustom, isSearchEngine),
    category: isSearchEngine ? 'searchEngine' : 'site',
    duplicateLabel: duplicate
      ? t('shortcuts_duplicate_tag', '与内置重复')
      : '',
    duplicateTemplate: duplicate ? normalizedTemplate : '',
    duplicateTooltip: duplicate
      ? t('shortcuts_duplicate_action', '定位内置项')
      : '',
    iconUrl: getProviderIconUrl(item),
    id: `${isCustom ? 'custom' : 'builtin'}:${String(item.key || '')}`,
    isBuiltin: !isCustom,
    key: String(item.key || ''),
    meta: `${item.key || ''} · ${item.template || ''}`,
    name: getProviderName(t, item),
    normalizedTemplate,
    template: String(item.template || ''),
    templateEditable: isCustom
  };
}

function getReorderCopy(t: GetMessage): ReorderCopyModel {
  return {
    moveDownLabel: t('settings_search_source_move_down', '下移'),
    moveUpLabel: t('settings_search_source_move_up', '上移')
  };
}

function asListed(items: readonly SiteSearchProvider[], isCustom: boolean): ListedSiteSearchProvider[] {
  return items.map((item) => ({ ...item, _xIsCustom: isCustom }));
}

function getSiteSearchListModels(t: GetMessage, state: SiteSearchProvidersState, sortList: SortList): SiteSearchListModels {
  const { defaults, custom, disabledKeys } = state;
  const { isAiSiteSearchProvider, isSearchEngineSiteSearchProvider, normalizeSiteSearchTemplate } = SearchSiteSearchProviders;
  const customKeys = new Set(custom.map((item) => String(item.key || '').toLowerCase()));
  const shownDefaults = defaults.filter((item) => {
    const key = String(item.key || '').toLowerCase();
    return Boolean(key) && !customKeys.has(key) && !disabledKeys.has(key);
  });
  // Custom providers that repeat an active built-in's template say so.
  const builtinTemplates = new Set(
    getActiveBuiltinSiteSearchProviders(defaults, custom, disabledKeys)
      .map((item) => normalizeSiteSearchTemplate(String(item.template || '').trim()))
      .filter(Boolean)
  );
  const keys: Record<string, string[]> = {};
  const copy = getSiteSearchListCopy(t);
  const reorder = getReorderCopy(t);
  const list = (items: ListedSiteSearchProvider[], placeholder: string, listId: string): SiteSearchListRenderModel => {
    const ordered = sortList(items, listId, (item) => item.key);
    keys[listId] = ordered.map((item) => String(item.key || '').toLowerCase());
    return {
      copy,
      items: ordered.map((item) => getSiteSearchProviderItemModel(t, item, builtinTemplates)),
      placeholder,
      reorder
    };
  };
  const lists = {
    engines: list(asListed(shownDefaults.filter(isSearchEngineSiteSearchProvider), false), t('shortcuts_empty_engines', '暂无内置搜索引擎'), 'engine'),
    custom: list(asListed(custom, true), '', 'custom'),
    sites: list(
      asListed(shownDefaults.filter((item) => !isSearchEngineSiteSearchProvider(item) && !isAiSiteSearchProvider(item)), false),
      t('shortcuts_empty_builtin', '暂无内置站内搜索'),
      'site'
    ),
    ai: list(asListed(shownDefaults.filter(isAiSiteSearchProvider), false), t('shortcuts_empty_ai', '暂无内置 AI 搜索'), 'ai')
  };
  return { lists, keys };
}

export { getReorderCopy, getSiteSearchListModels };
export type { SiteSearchListModels, SortList };
