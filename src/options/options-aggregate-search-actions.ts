// What the aggregate search list does: each edit asks the aggregate
// searches to change, then tells the outcome in a toast or in the editor.
import { getSiteSearchErrorMessage } from './features/site-search/error-copy';
import { getAggregateSearchProviders } from './features/site-search/providers';
import type { SiteSearchProviders } from './features/site-search/providers';
import type { AggregateEditOutcome, AggregateKeyConflictCheck, AggregateSearches } from './features/aggregate-search/searches';
import type { GetMessage } from './options-types';
import type { AggregateSearchDraft, AggregateSearchSaveResult } from './react/aggregate-search-list';

interface AggregateSearchActionsDeps {
  aggregates: AggregateSearches;
  providers: Pick<SiteSearchProviders, 'store'>;
  getMessage: GetMessage;
  showToast(message: string, isError?: boolean): void;
  hasKeyConflict: AggregateKeyConflictCheck;
}

function getAggregateSearchErrorMessage(getMessage: GetMessage, errorKey: string): string {
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

function createAggregateSearchActions(deps: AggregateSearchActionsDeps) {
  const { aggregates, providers, getMessage, showToast, hasKeyConflict } = deps;

  // A removal or clearing is told by a toast either way.
  function tellChange(outcome: AggregateEditOutcome, successMessage: string): void {
    if (outcome.ok) {
      showToast(successMessage, false);
    } else if (outcome.saveFailed) {
      showToast(getMessage('toast_error', '操作失败，请重试。'), true);
    } else {
      showToast(getAggregateSearchErrorMessage(getMessage, outcome.error), true);
    }
  }

  async function saveAggregateSearch(id: string | null, draft: AggregateSearchDraft): Promise<AggregateSearchSaveResult> {
    const available = getAggregateSearchProviders(providers.store.getSnapshot());
    const outcome = await aggregates.save(id, draft, available, hasKeyConflict);
    if (outcome.ok) {
      showToast(getMessage('toast_saved', '已保存'), false);
      return { ok: true };
    }
    if (outcome.saveFailed) {
      const error = getMessage('toast_error', '操作失败，请重试。');
      showToast(error, true);
      return { ok: false, error };
    }
    return { ok: false, error: getAggregateSearchErrorMessage(getMessage, outcome.error) };
  }

  async function removeAggregateSearch(id: string): Promise<void> {
    tellChange(await aggregates.remove(id), getMessage('toast_removed', '已移除'));
  }

  async function clearAggregateSearches(): Promise<void> {
    tellChange(await aggregates.clear(), getMessage('toast_cleared', '已清空'));
  }

  return { saveAggregateSearch, removeAggregateSearch, clearAggregateSearches };
}

export { createAggregateSearchActions };
export type { AggregateSearchActionsDeps };
