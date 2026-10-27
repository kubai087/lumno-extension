// The aggregate search list: available providers, item models, saving,
// removing and clearing aggregate searches, and their error copy.
import type * as AggregateSearchStore from '../domain/search/aggregate-search-store';
import type { AggregateSearch } from '../domain/search/aggregate-search-store';
import type { SiteSearchProvider } from '../domain/search/types';
import * as LumnoAggregateSearchStorage from '../platform/aggregate-search-storage';
import { aggregateSearches } from '../domain/settings/search';
import type { SettingsStore } from '../platform/settings-store';
import type * as AggregateSearchModule from './options-aggregate-search';
import type { AggregateSearchItem } from './options-aggregate-search';
import type { createSearchSourceOrderController } from './options-search-source-order';
import type { FormatTemplate, GetMessage } from './options-types';
import type {
  AggregateSearchCopyModel,
  AggregateSearchDraft,
  AggregateSearchItemModel,
  AggregateSearchListRenderModel,
  AggregateSearchProviderOptionModel,
  AggregateSearchSaveResult
} from './react/aggregate-search-list';
import type { ReorderCopyModel } from './react/reorder-buttons';
import * as SearchSiteSearchProviders from '../domain/search/utils/site-search-providers';
import { getSiteSearchErrorMessage } from './features/site-search/error-copy';
import { getAggregateSearchProviders } from './features/site-search/providers';
import type { SiteSearchProviders } from './features/site-search/providers';
import { createPersistentId } from './persistent-id';

interface AggregateSearchListState {
  aggregateSearches: AggregateSearch[];
  searchSourceOrderController: Pick<ReturnType<typeof createSearchSourceOrderController>, 'sortList'>;
  settingsStore: SettingsStore;
}

interface AggregateSearchListDeps {
  AGGREGATE_SEARCH_STORE: Pick<typeof AggregateSearchStore,
    'normalizeAggregateSearches' | 'getProviderSourceRef' | 'getAggregateSearchAvailability' |
    'serializeAggregateSearches' | 'getSerializedStorageByteLength' | 'SYNC_ITEM_BYTE_BUDGET'>;
  aggregateSearchModel: ReturnType<typeof AggregateSearchModule.createAggregateSearchModel>;
  providers: Pick<SiteSearchProviders, 'store'>;
  getMessage: GetMessage;
  getSiteSearchItemIconUrl(item: SiteSearchProvider | null): string;
  getLocalizedBuiltinProviderName(item: SiteSearchProvider | null): string;
  formatTemplate: FormatTemplate;
  aggregateSearchListController: { render(model: AggregateSearchListRenderModel): void } | null;
  // The keys each list shows right now, in order, for the move buttons.
  renderedSearchSourceKeys: Record<string, string[]>;
  getSearchSourceReorderCopy(): ReorderCopyModel;
  getActivePrimaryAreaName(): string;
  AGGREGATE_SEARCH: Pick<typeof AggregateSearchModule, 'createAggregateSearchStateCoordinator'>;
  showToast(message: string, isError?: boolean): void;
  findSiteSearchKeyConflict(key: string, allowedKey?: string, allowedAggregateId?: string): unknown;
  optionsState: AggregateSearchListState;
}

interface AggregateProviderGroup {
  group: string;
  label: string;
}

function createAggregateSearchList(deps: AggregateSearchListDeps) {
  const {
    AGGREGATE_SEARCH_STORE,
    aggregateSearchModel,
    providers,
    getMessage,
    getSiteSearchItemIconUrl,
    getLocalizedBuiltinProviderName,
    formatTemplate,
    aggregateSearchListController,
    renderedSearchSourceKeys,
    getSearchSourceReorderCopy,
    getActivePrimaryAreaName,
    AGGREGATE_SEARCH,
    showToast,
    findSiteSearchKeyConflict
  } = deps;
  const { isAiSiteSearchProvider, isSearchEngineSiteSearchProvider } = SearchSiteSearchProviders;

  // The page state object shared with options.js and the other modules.
  const optionsState = deps.optionsState;

  let aggregateSearchesReady = false;
  let aggregateSearchStateCoordinator: ReturnType<typeof AggregateSearchModule.createAggregateSearchStateCoordinator<
    AggregateSearch,
    AggregateSearchItem
  >> | null = null;

  function normalizeAggregateSearches(value: unknown): AggregateSearch[] {
    return AGGREGATE_SEARCH_STORE.normalizeAggregateSearches(value);
  }

  function deriveLegacyAggregateSearchAutoGroupEnabled(value: unknown): boolean {
    return aggregateSearchModel.deriveLegacyAutoGroupEnabled(value);
  }

  function getAggregateSearchProviderSourceRef(provider: SiteSearchProvider): string {
    return AGGREGATE_SEARCH_STORE.getProviderSourceRef(provider);
  }

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
      const sourceRef = getAggregateSearchProviderSourceRef(provider);
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
      optionsState.aggregateSearches.flatMap((item) => item.sourceRefs)
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
    const providers = getAggregateSearchAvailableProviders();
    const availability = AGGREGATE_SEARCH_STORE.getAggregateSearchAvailability(item, providers);
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
      optionsState.aggregateSearches,
      'aggregate',
      (item) => item.id
    );
    renderedSearchSourceKeys.aggregate = ordered.map((item) => item.id);
    aggregateSearchListController.render({
      copy: getAggregateSearchListCopy(),
      items: ordered.map((item) => getAggregateSearchItemModel(item)),
      reorder: getSearchSourceReorderCopy(),
      maxKeyLength: aggregateSearchModel.limits.maxKeyLength,
      maxNameLength: aggregateSearchModel.limits.maxNameLength,
      maxSourceCount: aggregateSearchModel.limits.maxSources,
      minSourceCount: aggregateSearchModel.limits.minSources,
      providers: getAggregateSearchProviderModels()
    });
  }

  function saveAggregateSearches(items: AggregateSearchItem[]): Promise<AggregateSearch[]> {
    const serialized = AGGREGATE_SEARCH_STORE.serializeAggregateSearches(items);
    const serializedBytes = AGGREGATE_SEARCH_STORE.getSerializedStorageByteLength(
      serialized,
      aggregateSearches.key
    );
    const byteBudget = AGGREGATE_SEARCH_STORE.SYNC_ITEM_BYTE_BUDGET;
    if (getActivePrimaryAreaName() === 'sync' && serializedBytes > byteBudget) {
      return Promise.reject(new Error('aggregate-search-sync-item-quota-exceeded'));
    }
    return optionsState.settingsStore.set(aggregateSearches, serialized).then(() => serialized.items);
  }

  function getAggregateSearchStateCoordinator() {
    if (!aggregateSearchStateCoordinator) {
      aggregateSearchStateCoordinator = AGGREGATE_SEARCH.createAggregateSearchStateCoordinator<
        AggregateSearch,
        AggregateSearchItem
      >({
        apply(items) {
          optionsState.aggregateSearches = items;
          aggregateSearchesReady = true;
          renderAggregateSearchList();
        },
        getCurrent() {
          return optionsState.aggregateSearches;
        },
        load() {
          return LumnoAggregateSearchStorage.readAggregateSearches(optionsState.settingsStore);
        },
        normalize: normalizeAggregateSearches,
        onLoadError(error) {
          aggregateSearchesReady = false;
          console.warn('[Lumno] Could not load aggregate searches.', error);
          showToast(getMessage('toast_error', '操作失败，请重试。'), true);
        },
        save: saveAggregateSearches
      });
    }
    return aggregateSearchStateCoordinator;
  }

  function refreshAggregateSearches(): Promise<AggregateSearch[]> {
    return getAggregateSearchStateCoordinator().refresh();
  }

  function handleAggregateSearchSave(id: string | null, draft: AggregateSearchDraft): Promise<AggregateSearchSaveResult> {
    if (!aggregateSearchesReady) {
      return Promise.resolve({ ok: false, error: getAggregateSearchErrorMessage('storage_unavailable') });
    }
    const built = aggregateSearchModel.buildAggregateSearchItem(id, draft, {
      availableProviders: getAggregateSearchAvailableProviders(),
      createId: () => createPersistentId('aggregate'),
      hasKeyConflict: (key, currentId) => Boolean(findSiteSearchKeyConflict(key, '', currentId)),
      items: optionsState.aggregateSearches
    });
    if (built.ok === false) {
      return Promise.resolve({ ok: false, error: getAggregateSearchErrorMessage(built.error) });
    }
    const builtItem = built.item;
    return getAggregateSearchStateCoordinator().enqueueMutation((items): {
      ok: boolean;
      error?: string;
      items?: AggregateSearchItem[];
    } => {
      const merged = aggregateSearchModel.mergeAggregateSearchItem(items, builtItem, id);
      return merged.ok === false ? { ok: false, error: getAggregateSearchErrorMessage(merged.error) } : merged;
    }).then((result): AggregateSearchSaveResult => {
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      showToast(getMessage('toast_saved', '已保存'), false);
      return { ok: true };
    }).catch(() => {
      const error = getMessage('toast_error', '操作失败，请重试。');
      showToast(error, true);
      return { ok: false, error };
    });
  }

  function getAggregateSearchErrorMessage(errorKey: string): string {
    switch (errorKey) {
      case 'storage_unavailable':
        return getMessage(
          'aggregate_search_storage_unavailable_error',
          'Aggregate searches could not be loaded. Reload Settings and try again.'
        );
      case 'aggregate_search_name_required_error':
        return getMessage('aggregate_search_name_required_error', '请填写聚合搜索名称。');
      case 'aggregate_search_min_sources_error':
        return getMessage('aggregate_search_min_sources_error', '请至少选择 2 个搜索源。');
      case 'aggregate_search_max_sources_error':
        return getMessage('aggregate_search_max_sources_error', '最多可选择 10 个搜索源。');
      case 'aggregate_search_source_selection_unavailable_error':
        return getMessage(
          'aggregate_search_source_selection_unavailable_error',
          'Remove unavailable sources and select at least two available sources.'
        );
      case 'aggregate_search_max_items_error':
        return getMessage('aggregate_search_max_items_error', '最多可创建 8 个聚合搜索。');
      case 'aggregate_search_name_duplicate_error':
        return getMessage('aggregate_search_name_duplicate_error', '已存在同名的聚合搜索。');
      default:
        return getSiteSearchErrorMessage(getMessage, errorKey);
    }
  }

  function handleAggregateSearchRemove(id: string): Promise<void> {
    if (!aggregateSearchesReady) {
      showToast(getAggregateSearchErrorMessage('storage_unavailable'), true);
      return Promise.resolve();
    }
    return getAggregateSearchStateCoordinator().enqueueMutation((items) => ({
      items: items.filter((item) => item.id !== id),
      ok: true
    })).then(() => {
      showToast(getMessage('toast_removed', '已移除'), false);
    }).catch(() => {
      showToast(getMessage('toast_error', '操作失败，请重试。'), true);
    });
  }

  function handleAggregateSearchClear(): Promise<void> {
    if (!aggregateSearchesReady) {
      showToast(getAggregateSearchErrorMessage('storage_unavailable'), true);
      return Promise.resolve();
    }
    return getAggregateSearchStateCoordinator().enqueueMutation(() => ({
      items: [],
      ok: true
    })).then(() => {
      showToast(getMessage('toast_cleared', '已清空'), false);
    }).catch(() => {
      showToast(getMessage('toast_error', '操作失败，请重试。'), true);
    });
  }

  return {
    deriveLegacyAggregateSearchAutoGroupEnabled,
    renderAggregateSearchList,
    getAggregateSearchStateCoordinator,
    refreshAggregateSearches,
    handleAggregateSearchSave,
    handleAggregateSearchRemove,
    handleAggregateSearchClear
  };
}

export { createAggregateSearchList };
export type { AggregateSearchListDeps, AggregateSearchListState };
