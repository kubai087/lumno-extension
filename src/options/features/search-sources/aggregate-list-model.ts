// The Search sources tab's aggregate search list, from the aggregate
// searches and the providers they can include: each search's row, and the
// providers the editor offers, with any a search names that are gone.
import * as AggregateSearchStore from '../../../domain/search/aggregate-search-store';
import type { AggregateSearch } from '../../../domain/search/aggregate-search-store';
import type { SiteSearchProvider } from '../../../domain/search/types';
import * as SearchSiteSearchProviders from '../../../domain/search/utils/site-search-providers';
import { formatTemplate } from '../../format-template';
import type { GetMessage } from '../../options-types';
import type {
  AggregateSearchCopyModel,
  AggregateSearchItemModel,
  AggregateSearchListRenderModel,
  AggregateSearchProviderOptionModel
} from '../../react/aggregate-search-list';
import type { AggregateSearches } from '../aggregate-search/searches';
import { getAggregateSearchProviders, type SiteSearchProvidersState } from '../site-search/providers';
import { getProviderIconUrl, getProviderName } from './provider-display';
import { getReorderCopy, type SortList } from './site-search-list-models';

interface AggregateProviderGroup {
  group: string;
  label: string;
}

function getProviderGroup(t: GetMessage, provider: SiteSearchProvider): AggregateProviderGroup {
  if (SearchSiteSearchProviders.isAiSiteSearchProvider(provider)) {
    return {
      group: 'aiSearch',
      label: t('shortcuts_group_ai', 'AI 搜索')
    };
  }
  if (SearchSiteSearchProviders.isSearchEngineSiteSearchProvider(provider)) {
    return {
      group: 'searchEngine',
      label: t('search_scope_group_engines', '搜索引擎')
    };
  }
  return {
    group: 'site',
    label: t('search_scope_group_sites', '站内搜索')
  };
}

function getAggregateListCopy(t: GetMessage): AggregateSearchCopyModel {
  return {
    addLabel: t('aggregate_search_add', '添加聚合搜索'),
    cancelLabel: t('shortcuts_cancel', '取消'),
    confirmLabel: t('confirm_ok', '确认'),
    confirmMessage: t('confirm_remove_item', '确认移除该项？'),
    confirmMessageKey: 'confirm_remove_item',
    defaultNameBase: t('aggregate_search_default_name', '聚合搜索'),
    editLabel: t('shortcuts_edit', '编辑'),
    groupBadge: t('aggregate_search_badge', '聚合'),
    keyLabel: t('shortcuts_label_key', '触发词'),
    keyPlaceholder: t('aggregate_search_key_placeholder', '例如 tech'),
    keyRequiredError: t('shortcuts_error_key', '请填写触发词。'),
    keySpaceError: t('shortcuts_error_key_space', '触发词不能包含空格。'),
    maxSourcesError: t(
      'aggregate_search_max_sources_error',
      '最多可选择 10 个搜索源。'
    ),
    minSourcesError: t(
      'aggregate_search_min_sources_error',
      '请至少选择 2 个搜索源。'
    ),
    nameLabel: t('aggregate_search_name_label', '名称'),
    nameRequiredError: t(
      'aggregate_search_name_required_error',
      '请填写聚合搜索名称。'
    ),
    removeLabel: t('shortcuts_remove', '移除'),
    saveLabel: t('shortcuts_save', '保存修改'),
    selectedCountLabel: t('aggregate_search_selected_count', '已选 {count}/{max}'),
    sourcesLabel: t('aggregate_search_sources_label', '搜索源'),
    unavailableGroupLabel: t(
      'aggregate_search_unavailable_group',
      '不可用的搜索源'
    ),
    unavailableSourceLabel: t(
      'aggregate_search_unavailable_name',
      '不可用的搜索源（{source}）'
    )
  };
}

function getProviderOptions(t: GetMessage, items: readonly AggregateSearch[], available: readonly SiteSearchProvider[]): AggregateSearchProviderOptionModel[] {
  const availableRefs = new Set<string>();
  const models: AggregateSearchProviderOptionModel[] = [];
  available.forEach((provider) => {
    const sourceRef = AggregateSearchStore.getProviderSourceRef(provider);
    if (!sourceRef) {
      return;
    }
    availableRefs.add(sourceRef);
    const grouping = getProviderGroup(t, provider);
    models.push({
      available: true,
      group: grouping.group,
      groupLabel: grouping.label,
      iconUrl: getProviderIconUrl(provider),
      name: getProviderName(t, provider),
      sourceRef
    });
  });
  const unavailableRefs = Array.from(new Set(
    items.flatMap((item) => item.sourceRefs)
  )).filter((ref) => !availableRefs.has(ref));
  unavailableRefs.forEach((sourceRef) => {
    models.push({
      available: false,
      group: 'unavailable',
      groupLabel: t('aggregate_search_unavailable_group', '不可用的搜索源'),
      name: formatTemplate(
        t('aggregate_search_unavailable_name', '不可用的搜索源（{source}）'),
        { source: sourceRef }
      ),
      sourceRef
    });
  });
  return models;
}

function getItemModel(t: GetMessage, item: AggregateSearch, available: readonly SiteSearchProvider[]): AggregateSearchItemModel {
  const count = item.sourceRefs.length;
  const availability = AggregateSearchStore.getAggregateSearchAvailability(item, available);
  if (!availability.available) {
    return {
      id: item.id,
      key: item.key,
      name: item.name,
      sourceRefs: item.sourceRefs.slice(),
      sourceSummary: formatTemplate(
        t(
          'aggregate_search_source_summary_unavailable',
          '{count} sources · {unavailable} unavailable · Update required'
        ),
        {
          count,
          unavailable: availability.unavailableSourceCount
        }
      )
    };
  }
  return {
    id: item.id,
    key: item.key,
    name: item.name,
    sourceRefs: item.sourceRefs.slice(),
    sourceSummary: formatTemplate(
      t('aggregate_search_source_summary', '{count} sources'),
      { count }
    )
  };
}

function getAggregateListModel(
  t: GetMessage,
  items: readonly AggregateSearch[],
  providers: SiteSearchProvidersState,
  sortList: SortList,
  limits: AggregateSearches['limits']
): { list: AggregateSearchListRenderModel; keys: string[] } {
  const available = getAggregateSearchProviders(providers);
  const ordered = sortList(items, 'aggregate', (item) => item.id);
  return {
    keys: ordered.map((item) => item.id),
    list: {
      copy: getAggregateListCopy(t),
      items: ordered.map((item) => getItemModel(t, item, available)),
      reorder: getReorderCopy(t),
      maxKeyLength: limits.maxKeyLength,
      maxNameLength: limits.maxNameLength,
      maxSourceCount: limits.maxSources,
      minSourceCount: limits.minSources,
      providers: getProviderOptions(t, items, available)
    }
  };
}

export { getAggregateListModel };
