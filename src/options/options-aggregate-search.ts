// Aggregate searches on the Options page: the state coordinator that keeps
// edits from racing storage, and the rules for saving one aggregate search.
// Validation results name a locale message key in `error`.
import * as AggregateSearchStore from '../domain/search/aggregate-search-store';
import type { AggregateSearch } from '../domain/search/aggregate-search-store';
import type { SiteSearchProvider } from '../domain/search/types';

// An aggregate search the editor built. It keeps the tab group flag only
// when it replaces one that had it; storage fills in the rest.
type AggregateSearchItem = Omit<AggregateSearch, 'autoCreateTabGroup'> & { autoCreateTabGroup?: boolean };

// The list as loaded holds T; a mutation may hand save() items of the wider
// type S, which storage normalizes back to T.
interface AggregateSearchCoordinatorConfig<T extends S, S> {
  load(): unknown;
  normalize(value: unknown): T[];
  getCurrent(): T[];
  apply(items: T[]): void;
  save(items: S[]): unknown;
  onLoadError?(error: unknown): void;
}

interface LoadToken {
  changeGeneration: number;
  loadGeneration: number;
}

// The editor's fields.
interface AggregateSearchDraft {
  key?: string;
  name?: string;
  sourceRefs?: unknown;
}

interface AggregateSearchBuildContext {
  // The current list, for the item being edited.
  items?: readonly AggregateSearch[];
  hasKeyConflict(key: string, id: string): boolean;
  availableProviders?: readonly SiteSearchProvider[];
  createId(): string;
}

type AggregateSearchBuildResult = { ok: false; error: string } | { ok: true; item: AggregateSearchItem };

type AggregateSearchMergeResult<T> = { ok: false; error: string } | { ok: true; items: Array<T | AggregateSearchItem> };

// Loads, applies and mutates the aggregate search list. Mutations run one at
// a time against freshly loaded items; a storage change or a newer load
// makes older loads stale, and a mutation whose load went stale reloads.
function createAggregateSearchStateCoordinator<T extends S, S>(options: AggregateSearchCoordinatorConfig<T, S>) {
  const { normalize, getCurrent } = options;
  let changeGeneration = 0;
  let loadGeneration = 0;
  let mutationQueue: Promise<unknown> = Promise.resolve();

  function startLoad(): { promise: Promise<T[]>; token: LoadToken } {
    const token = {
      changeGeneration,
      loadGeneration: ++loadGeneration
    };
    let result: unknown;
    try {
      result = options.load();
    } catch (error) {
      result = Promise.reject(error);
    }
    return {
      promise: Promise.resolve(result).then(normalize),
      token
    };
  }

  function isLoadCurrent(token: LoadToken): boolean {
    return token.changeGeneration === changeGeneration &&
      token.loadGeneration === loadGeneration;
  }

  function refresh(): Promise<T[]> {
    const pending = startLoad();
    return pending.promise.then((items) => {
      if (!isLoadCurrent(pending.token)) {
        return getCurrent();
      }
      options.apply(items);
      return items;
    }).catch((error: unknown) => {
      if (isLoadCurrent(pending.token) && options.onLoadError) {
        options.onLoadError(error);
      }
      throw error;
    });
  }

  function loadLatestForMutation(): Promise<T[]> {
    const pending = startLoad();
    return pending.promise.then((items) => {
      if (!isLoadCurrent(pending.token)) {
        return loadLatestForMutation();
      }
      return items;
    });
  }

  // A result with items is saved, and comes back with the items as stored.
  function enqueueMutation<R extends { items?: S[] }>(mutate: (items: T[]) => R): Promise<R> {
    const operation = mutationQueue.then(() => loadLatestForMutation()).then((items): R | Promise<R> => {
      const result = mutate(items);
      const nextItems = result.items;
      if (!nextItems) {
        return result;
      }
      const changeGenerationAtWrite = changeGeneration;
      loadGeneration += 1;
      return Promise.resolve().then(() => options.save(nextItems)).then((savedItems) => {
        const normalizedItems = normalize(savedItems);
        loadGeneration += 1;
        if (changeGenerationAtWrite === changeGeneration) {
          options.apply(normalizedItems);
        }
        return { ...result, items: normalizedItems };
      });
    });
    // The caller gets this mutation's own result; the queue only needs to
    // know it settled.
    mutationQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  function applyStorageChange(value: unknown): T[] {
    changeGeneration += 1;
    loadGeneration += 1;
    const items = normalize(value);
    options.apply(items);
    return items;
  }

  return {
    applyStorageChange,
    enqueueMutation,
    refresh
  };
}

function createAggregateSearchModel() {
  const store = AggregateSearchStore;
  const limits = Object.freeze({
    maxItems: store.MAX_AGGREGATE_COUNT,
    maxKeyLength: store.MAX_KEY_LENGTH,
    maxNameLength: store.MAX_NAME_LENGTH,
    maxSources: store.MAX_SOURCE_COUNT,
    minSources: store.MIN_SOURCE_COUNT
  });

  // Installs from before the global switch kept it per aggregate search: on
  // when there were none yet, or when any of them had it on.
  function deriveLegacyAutoGroupEnabled(value: unknown): boolean {
    const items = store.normalizeAggregateSearches(value);
    return items.length === 0 || items.some((item) => item.autoCreateTabGroup === true);
  }

  // Checks a draft from the editor and builds the item to save.
  function buildAggregateSearchItem(
    id: string | null,
    draft: AggregateSearchDraft | null,
    context: AggregateSearchBuildContext
  ): AggregateSearchBuildResult {
    const currentId = String(id || '').trim();
    const keyRaw = String(draft && draft.key ? draft.key : '').trim().slice(0, limits.maxKeyLength);
    if (!keyRaw) {
      return { ok: false, error: 'shortcuts_error_key' };
    }
    if (/\s/.test(keyRaw)) {
      return { ok: false, error: 'shortcuts_error_key_space' };
    }
    const key = store.normalizeAggregateSearchKey(keyRaw);
    if (!key) {
      return { ok: false, error: 'shortcuts_error_key' };
    }
    if (context.hasKeyConflict(key, currentId)) {
      return { ok: false, error: 'shortcuts_error_key_duplicate' };
    }
    const name = String(draft && draft.name ? draft.name : '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, limits.maxNameLength);
    const sourceRefs = store.normalizeSourceRefs(draft && draft.sourceRefs);
    if (!name) {
      return { ok: false, error: 'aggregate_search_name_required_error' };
    }
    if (sourceRefs.length < limits.minSources) {
      return { ok: false, error: 'aggregate_search_min_sources_error' };
    }
    if (sourceRefs.length > limits.maxSources) {
      return { ok: false, error: 'aggregate_search_max_sources_error' };
    }
    const previousItem = currentId
      ? (context.items || []).find((item) => item.id === currentId)
      : null;
    const item: AggregateSearchItem = {
      id: currentId || context.createId(),
      key,
      name,
      sourceRefs,
      ...(previousItem
        ? { autoCreateTabGroup: previousItem.autoCreateTabGroup === true }
        : {})
    };
    const availability = store.getAggregateSearchAvailability(item, context.availableProviders);
    if (!availability.available) {
      return { ok: false, error: 'aggregate_search_source_selection_unavailable_error' };
    }
    return { ok: true, item };
  }

  // Puts a built item into the freshly loaded list, replacing the one being
  // edited, unless the list is full or its name or trigger is taken.
  function mergeAggregateSearchItem<T extends AggregateSearchItem>(
    items: readonly T[],
    item: AggregateSearchItem,
    id: string | null
  ): AggregateSearchMergeResult<T> {
    const currentId = String(id || '').trim();
    if (!currentId && items.length >= limits.maxItems) {
      return { ok: false, error: 'aggregate_search_max_items_error' };
    }
    const others = items.filter((entry) => String(entry.id || '') !== currentId);
    if (others.some((entry) => (
      String(entry.name || '').trim().toLocaleLowerCase() === item.name.toLocaleLowerCase()
    ))) {
      return { ok: false, error: 'aggregate_search_name_duplicate_error' };
    }
    if (others.some((entry) => String(entry.key || '').trim().toLowerCase() === item.key)) {
      return { ok: false, error: 'shortcuts_error_key_duplicate' };
    }
    return {
      items: currentId
        ? items.map((entry): T | AggregateSearchItem => String(entry.id || '') === currentId ? item : entry)
        : [...items, item],
      ok: true
    };
  }

  return Object.freeze({
    buildAggregateSearchItem,
    deriveLegacyAutoGroupEnabled,
    limits,
    mergeAggregateSearchItem
  });
}

export { createAggregateSearchModel, createAggregateSearchStateCoordinator };
export type {
  AggregateSearchBuildContext,
  AggregateSearchBuildResult,
  AggregateSearchCoordinatorConfig,
  AggregateSearchDraft,
  AggregateSearchItem,
  AggregateSearchMergeResult
};
