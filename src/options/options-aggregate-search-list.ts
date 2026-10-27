// The aggregate search list: the providers an aggregate search can include
// and each aggregate search's row, drawn from the aggregate searches' and
// the site search providers' stores.
import * as AggregateSearchStore from '../domain/search/aggregate-search-store';
import type { AggregateSearch } from '../domain/search/aggregate-search-store';
import type { SiteSearchProvider } from '../domain/search/types';
import type { createSearchSourceOrderController } from './options-search-source-order';
import type { FormatTemplate, GetMessage } from './options-types';
import type {
  AggregateSearchCopyModel,
  AggregateSearchItemModel,
  AggregateSearchListRenderModel,
  AggregateSearchProviderOptionModel
} from './react/aggregate-search-list';
import type { ReorderCopyModel } from './react/reorder-buttons';
import * as SearchSiteSearchProviders from '../domain/search/utils/site-search-providers';
import type { AggregateSearches } from './features/aggregate-search/searches';
import { getAggregateSearchProviders } from './features/site-search/providers';
import type { SiteSearchProviders } from './features/site-search/providers';

interface AggregateSearchListState {
  searchSourceOrderController: Pick<ReturnType<typeof createSearchSourceOrderController>, 'sortList'>;
}

interface AggregateSearchListDeps {
  aggregates: Pick<AggregateSearches, 'store' | 'limits'>;
  providers: Pick<SiteSearchProviders, 'store'>;
  getMessage: GetMessage;
  getSiteSearchItemIconUrl(item: SiteSearchProvider | null): string;
  getLocalizedBuiltinProviderName(item: SiteSearchProvider | null): string;
  formatTemplate: FormatTemplate;
  aggregateSearchListController: { render(model: AggregateSearchListRenderModel): void } | null;
  // The keys each list shows right now, in order, for the move buttons.
  renderedSearchSourceKeys: Record<string, string[]>;
  getSearchSourceReorderCopy(): ReorderCopyModel;
  optionsState: AggregateSearchListState;
}

interface AggregateProviderGroup {
  group: string;
  label: string;
}

function createAggregateSearchList(deps: AggregateSearchListDeps) {
  const {
    aggregates,
    providers,
    getMessage,
    getSiteSearchItemIconUrl,
    getLocalizedBuiltinProviderName,
    formatTemplate,
    aggregateSearchListController,
    renderedSearchSourceKeys,
    getSearchSourceReorderCopy
  } = deps;
  const { isAiSiteSearchProvider, isSearchEngineSiteSearchProvider } = SearchSiteSearchProviders;

  // The page state object shared with options.js and the other modules.
  const optionsState = deps.optionsState;

  function getAggregateSearchAvailableProviders(): SiteSearchProvider[] {
    return getAggregateSearchProviders(providers.store.getSnapshot());
  }

  function getAggregateSearchProviderGroup(provider: SiteSearchProvider): AggregateProviderGroup {
    if (isAiSiteSearchProvider(provider)) {
      return {
        group: 'aiSearch',
        label: getMessage('shortcuts_group_ai', 'AI 搜索')
      };
    }
    if (isSearchEngineSiteSearchProvider(provider)) {
      return {
        group: 'searchEngine',
        label: getMessage('search_scope_group_engines', '搜索引擎')
      };
    }
    return {
      group: 'site',
      label: getMessage('search_scope_group_sites', '站内搜索')
    };
  }

  function getAggregateSearchListCopy(): AggregateSearchCopyModel {
    return {
      addLabel: getMessage('aggregate_search_add', '添加聚合搜索'),
      cancelLabel: getMessage('shortcuts_cancel', '取消'),
      confirmLabel: getMessage('confirm_ok', '确认'),
      confirmMessage: getMessage('confirm_remove_item', '确认移除该项？'),
      confirmMessageKey: 'confirm_remove_item',
      defaultNameBase: getMessage('aggregate_search_default_name', '聚合搜索'),
      editLabel: getMessage('shortcuts_edit', '编辑'),
      groupBadge: getMessage('aggregate_search_badge', '聚合'),
      keyLabel: getMessage('shortcuts_label_key', '触发词'),
      keyPlaceholder: getMessage('aggregate_search_key_placeholder', '例如 tech'),
      keyRequiredError: getMessage('shortcuts_error_key', '请填写触发词。'),
      keySpaceError: getMessage('shortcuts_error_key_space', '触发词不能包含空格。'),
      maxSourcesError: getMessage(
        'aggregate_search_max_sources_error',
        '最多可选择 10 个搜索源。'
      ),
      minSourcesError: getMessage(
        'aggregate_search_min_sources_error',
        '请至少选择 2 个搜索源。'
      ),
      nameLabel: getMessage('aggregate_search_name_label', '名称'),
      nameRequiredError: getMessage(
        'aggregate_search_name_required_error',
        '请填写聚合搜索名称。'
      ),
      removeLabel: getMessage('shortcuts_remove', '移除'),
      saveLabel: getMessage('shortcuts_save', '保存修改'),
      selectedCountLabel: getMessage('aggregate_search_selected_count', '已选 {count}/{max}'),
      sourcesLabel: getMessage('aggregate_search_sources_label', '搜索源'),
      unavailableGroupLabel: getMessage(
        'aggregate_search_unavailable_group',
        '不可用的搜索源'
      ),
      unavailableSourceLabel: getMessage(
        'aggregate_search_unavailable_name',
        '不可用的搜索源（{source}）'
      )
    };
  }

  function getAggregateSearchProviderModels(): AggregateSearchProviderOptionModel[] {
    const providers = getAggregateSearchAvailableProviders();
    const availableRefs = new Set<string>();
    const models: AggregateSearchProviderOptionModel[] = [];
    providers.forEach((provider) => {
      const sourceRef = AggregateSearchStore.getProviderSourceRef(provider);
      if (!sourceRef) {
        return;
      }
      availableRefs.add(sourceRef);
      const grouping = getAggregateSearchProviderGroup(provider);
      models.push({
        available: true,
        group: grouping.group,
        groupLabel: grouping.label,
        iconUrl: getSiteSearchItemIconUrl(provider),
        name: getLocalizedBuiltinProviderName(provider),
        sourceRef
      });
    });
    const unavailableRefs = Array.from(new Set(
      aggregates.store.getSnapshot().items.flatMap((item) => item.sourceRefs)
    )).filter((ref) => !availableRefs.has(ref));
    unavailableRefs.forEach((sourceRef) => {
      models.push({
        available: false,
        group: 'unavailable',
        groupLabel: getMessage('aggregate_search_unavailable_group', '不可用的搜索源'),
        name: formatTemplate(
          getMessage('aggregate_search_unavailable_name', '不可用的搜索源（{source}）'),
          { source: sourceRef }
        ),
        sourceRef
      });
    });
    return models;
  }

  function getAggregateSearchItemModel(item: AggregateSearch): AggregateSearchItemModel {
    const count = item.sourceRefs.length;
    const available = getAggregateSearchAvailableProviders();
    const availability = AggregateSearchStore.getAggregateSearchAvailability(item, available);
    if (!availability.available) {
      return {
        id: item.id,
        key: item.key,
        name: item.name,
        sourceRefs: item.sourceRefs.slice(),
        sourceSummary: formatTemplate(
          getMessage(
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
        getMessage('aggregate_search_source_summary', '{count} sources'),
        { count }
      )
    };
  }

  function renderAggregateSearchList(): void {
    if (!aggregateSearchListController) {
      return;
    }
    const ordered = optionsState.searchSourceOrderController.sortList(
      aggregates.store.getSnapshot().items,
      'aggregate',
      (item) => item.id
    );
    renderedSearchSourceKeys.aggregate = ordered.map((item) => item.id);
    aggregateSearchListController.render({
      copy: getAggregateSearchListCopy(),
      items: ordered.map((item) => getAggregateSearchItemModel(item)),
      reorder: getSearchSourceReorderCopy(),
      maxKeyLength: aggregates.limits.maxKeyLength,
      maxNameLength: aggregates.limits.maxNameLength,
      maxSourceCount: aggregates.limits.maxSources,
      minSourceCount: aggregates.limits.minSources,
      providers: getAggregateSearchProviderModels()
    });
  }

  return { renderAggregateSearchList };
}

export { createAggregateSearchList };
export type { AggregateSearchListDeps, AggregateSearchListState };
