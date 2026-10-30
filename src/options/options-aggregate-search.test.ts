import { describe, expect, it } from 'vitest';
import * as AggregateSearchStore from '../domain/search/aggregate-search-store';
import type { AggregateSearch } from '../domain/search/aggregate-search-store';
import { createAggregateSearchModel, createAggregateSearchStateCoordinator } from './options-aggregate-search';

const model = createAggregateSearchModel();
const { limits } = model;

const providers = [
  { id: 'source-a', key: 'a', name: 'A', template: 'https://a/{query}' },
  { id: 'source-b', key: 'b', name: 'B', template: 'https://b/{query}' },
  { id: 'source-c', key: 'c', name: 'C', template: 'https://c/{query}' }
];
const refs = providers.map((provider) => AggregateSearchStore.getProviderSourceRef(provider));

function aggregate(overrides: Partial<AggregateSearch>): AggregateSearch {
  return { id: 'x', key: 'x', name: 'X', sourceRefs: refs.slice(0, 2), autoCreateTabGroup: false, ...overrides };
}

let nextId = 0;
function build(
  id: string,
  draft: { key?: string; name?: string; sourceRefs?: string[] },
  context: { hasKeyConflict?: (key: string, id: string) => boolean; items?: AggregateSearch[] } = {}
) {
  return model.buildAggregateSearchItem(id, draft, {
    availableProviders: providers,
    createId: () => `aggregate-${++nextId}`,
    hasKeyConflict: () => false,
    items: [],
    ...context
  });
}

function builtItem(result: ReturnType<typeof build>) {
  if (!result.ok) {
    throw new Error(`Expected the aggregate search to build, got ${result.error}`);
  }
  return result.item;
}

describe('Options aggregate search model', () => {
  it('takes its limits from the aggregate search store', () => {
    expect([limits.maxItems, limits.minSources, limits.maxSources]).toEqual([
      AggregateSearchStore.MAX_AGGREGATE_COUNT,
      AggregateSearchStore.MIN_SOURCE_COUNT,
      AggregateSearchStore.MAX_SOURCE_COUNT
    ]);
  });

  it('derives the tab-group switch from the per-search flags older installs kept', () => {
    expect(model.deriveLegacyAutoGroupEnabled(undefined)).toBe(true);
    expect(model.deriveLegacyAutoGroupEnabled([aggregate({ autoCreateTabGroup: false })])).toBe(false);
    expect(model.deriveLegacyAutoGroupEnabled([
      aggregate({ autoCreateTabGroup: false }),
      aggregate({ id: 'y', key: 'y', name: 'Y', autoCreateTabGroup: true })
    ])).toBe(true);
  });

  it.each([
    [{ key: '' }, 'shortcuts_error_key', undefined],
    [{ key: 'a b' }, 'shortcuts_error_key_space', undefined],
    [{ key: 'tech', name: 'Tech', sourceRefs: refs }, 'shortcuts_error_key_duplicate', () => true],
    [{ key: 'tech', name: '  ', sourceRefs: refs }, 'aggregate_search_name_required_error', undefined],
    [{ key: 'tech', name: 'Tech', sourceRefs: refs.slice(0, 1) }, 'aggregate_search_min_sources_error', undefined],
    [{ key: 'tech', name: 'Tech', sourceRefs: refs.concat(['custom:missing']) }, 'aggregate_search_source_selection_unavailable_error', undefined]
  ])('reports %j as %s', (draft, error, hasKeyConflict) => {
    expect(build('', draft, hasKeyConflict ? { hasKeyConflict } : {})).toEqual({ ok: false, error });
  });

  it('normalizes a new search and checks its trigger against every search', () => {
    const checks: Array<[string, string]> = [];
    const item = builtItem(build('', { key: ' Tech ', name: '  Tech   news ', sourceRefs: refs.slice(0, 2) }, {
      hasKeyConflict: (key, id) => {
        checks.push([key, id]);
        return false;
      }
    }));
    expect(checks).toEqual([['tech', '']]);
    expect(item.key).toBe('tech');
    expect(item.name).toBe('Tech news');
    expect(item.id).toMatch(/^aggregate-/);
    expect(item).not.toHaveProperty('autoCreateTabGroup');
  });

  it('keeps the id and the legacy tab-group flag of the search it edits', () => {
    const item = builtItem(build('agg-1', { key: 'tech', name: 'Tech', sourceRefs: refs.slice(1) }, {
      items: [aggregate({ id: 'agg-1', key: 'old', name: 'Old', autoCreateTabGroup: true })]
    }));
    expect(item.id).toBe('agg-1');
    expect(item.autoCreateTabGroup).toBe(true);
  });

  describe('merging into the latest stored list', () => {
    const existing = [
      aggregate({ id: 'agg-1', key: 'tech', name: 'Tech', sourceRefs: refs.slice(0, 2) }),
      aggregate({ id: 'agg-2', key: 'news', name: 'News', sourceRefs: refs.slice(1) })
    ];
    const item = (overrides: Partial<AggregateSearch>) => ({ id: 'new', key: 'fresh', name: 'Fresh', sourceRefs: refs.slice(0, 2), ...overrides });

    it('refuses a name that differs only in case and a trigger already taken', () => {
      expect(model.mergeAggregateSearchItem(existing, item({ name: 'tech' }), ''))
        .toEqual({ ok: false, error: 'aggregate_search_name_duplicate_error' });
      expect(model.mergeAggregateSearchItem(existing, item({ key: 'news' }), ''))
        .toEqual({ ok: false, error: 'shortcuts_error_key_duplicate' });
    });

    it('refuses a new search when the list is full but still allows an edit', () => {
      const full = Array.from({ length: limits.maxItems }, (_, index) => aggregate({ id: `f${index}`, key: `k${index}`, name: `N${index}` }));
      expect(model.mergeAggregateSearchItem(full, item({}), ''))
        .toEqual({ ok: false, error: 'aggregate_search_max_items_error' });
      expect(model.mergeAggregateSearchItem(full, item({ id: 'f0', key: 'k0', name: 'N0' }), 'f0').ok).toBe(true);
    });

    it('appends a new search and replaces an edited one in place', () => {
      const added = model.mergeAggregateSearchItem(existing, item({}), '');
      expect(added.ok && added.items.map((entry) => entry.id)).toEqual(['agg-1', 'agg-2', 'new']);
      // An edit may keep its own name and trigger.
      const replaced = model.mergeAggregateSearchItem(existing, item({ id: 'agg-1', key: 'tech', name: 'Tech' }), 'agg-1');
      expect(replaced.ok && replaced.items.map((entry) => entry.key)).toEqual(['tech', 'news']);
    });
  });
});

interface Item {
  id: string;
  name: string;
}

function isItem(value: unknown): value is Item {
  return typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string' &&
    'name' in value && typeof value.name === 'string';
}

function cloneItems(items: unknown): Item[] {
  return (Array.isArray(items) ? items : []).filter(isItem).map((item) => ({ ...item }));
}

function createDeferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function flushTasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const ids = (items: readonly Item[]) => items.map((item) => item.id);

describe('Options aggregate search state coordinator', () => {
  it('runs one mutation at a time, each against the list the one before saved', async () => {
    let storedItems: Item[] = [{ id: 'a', name: 'A' }];
    let renderedItems = cloneItems(storedItems);
    const saveCalls: Array<{ deferred: ReturnType<typeof createDeferred<Item[]>>; items: Item[] }> = [];
    let loadCount = 0;
    const coordinator = createAggregateSearchStateCoordinator<Item, Item>({
      apply: (items) => { renderedItems = cloneItems(items); },
      getCurrent: () => renderedItems,
      load: () => {
        loadCount += 1;
        return Promise.resolve(cloneItems(storedItems));
      },
      normalize: cloneItems,
      save: (items) => {
        const deferred = createDeferred<Item[]>();
        saveCalls.push({ deferred, items: cloneItems(items) });
        return deferred.promise;
      }
    });

    const adding = coordinator.enqueueMutation((items) => ({ items: items.concat({ id: 'b', name: 'B' }), ok: true }));
    const removing = coordinator.enqueueMutation((items) => ({ items: items.filter((item) => item.id !== 'a'), ok: true }));
    await flushTasks();
    expect(saveCalls).toHaveLength(1);
    expect(ids(saveCalls[0].items)).toEqual(['a', 'b']);

    storedItems = cloneItems(saveCalls[0].items);
    saveCalls[0].deferred.resolve(cloneItems(storedItems));
    await adding;
    await flushTasks();
    expect(saveCalls).toHaveLength(2);
    expect(ids(saveCalls[1].items)).toEqual(['b']);

    storedItems = cloneItems(saveCalls[1].items);
    saveCalls[1].deferred.resolve(cloneItems(storedItems));
    await removing;
    // Each mutation reloads the latest stored list.
    expect(loadCount).toBe(2);
    expect(ids(renderedItems)).toEqual(['b']);
  });

  it('reloads for a mutation whose read a storage change overtook', async () => {
    let renderedItems: Item[] = [{ id: 'old', name: 'Old' }];
    const loadCalls: Array<ReturnType<typeof createDeferred<Item[]>>> = [];
    const saveCalls: Item[][] = [];
    const coordinator = createAggregateSearchStateCoordinator<Item, Item>({
      apply: (items) => { renderedItems = cloneItems(items); },
      getCurrent: () => renderedItems,
      load: () => {
        const deferred = createDeferred<Item[]>();
        loadCalls.push(deferred);
        return deferred.promise;
      },
      normalize: cloneItems,
      save: (items) => {
        saveCalls.push(cloneItems(items));
        return Promise.resolve(cloneItems(items));
      }
    });

    const mutation = coordinator.enqueueMutation((items) => ({ items: items.concat({ id: 'added', name: 'Added' }), ok: true }));
    await flushTasks();
    expect(loadCalls).toHaveLength(1);

    coordinator.applyStorageChange([{ id: 'new', name: 'New' }]);
    loadCalls[0].resolve([{ id: 'old', name: 'Old' }]);
    await flushTasks();
    expect(loadCalls).toHaveLength(2);
    loadCalls[1].resolve([{ id: 'new', name: 'New' }]);
    await mutation;

    expect(ids(saveCalls[0])).toEqual(['new', 'added']);
    expect(ids(renderedItems)).toEqual(['new', 'added']);
  });

  it('keeps a newer storage change or load over a read that finishes late', async () => {
    let renderedItems: Item[] = [];
    let loadErrorCount = 0;
    const loadCalls: Array<ReturnType<typeof createDeferred<Item[]>>> = [];
    const coordinator = createAggregateSearchStateCoordinator<Item, Item>({
      apply: (items) => { renderedItems = cloneItems(items); },
      getCurrent: () => renderedItems,
      load: () => {
        const deferred = createDeferred<Item[]>();
        loadCalls.push(deferred);
        return deferred.promise;
      },
      normalize: cloneItems,
      onLoadError: () => { loadErrorCount += 1; },
      save: (items) => Promise.resolve(cloneItems(items))
    });

    const initialRefresh = coordinator.refresh();
    coordinator.applyStorageChange([{ id: 'changed', name: 'Changed' }]);
    loadCalls[0].resolve([{ id: 'initial', name: 'Initial' }]);
    await initialRefresh;
    expect(ids(renderedItems)).toEqual(['changed']);
    expect(loadErrorCount).toBe(0);

    const olderRefresh = coordinator.refresh();
    const newerRefresh = coordinator.refresh();
    loadCalls[2].resolve([{ id: 'newest', name: 'Newest' }]);
    await newerRefresh;
    loadCalls[1].resolve([{ id: 'stale', name: 'Stale' }]);
    await olderRefresh;
    expect(ids(renderedItems)).toEqual(['newest']);
  });
});
