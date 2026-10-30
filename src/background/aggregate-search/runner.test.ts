import { describe, expect, it, vi } from 'vitest';
import * as aggregateStore from '../../domain/search/aggregate-search-store';
import type { AggregateSearch, AggregateSearchAvailability } from '../../domain/search/aggregate-search-store';
import type { SiteSearchProvider } from '../../domain/search/types';
import { aggregateSearches } from '../../domain/settings/search';
import { loadAggregateSearches } from '../../platform/aggregate-search-storage';
import { createAggregateSearchQueryRunner, resolveAggregateSearchAutoGroupEnabled } from './runner';
import type { AggregateSearchOpenOptions, AggregateSearchStoreLike } from './types';

const google: SiteSearchProvider = { key: 'google', template: 'https://www.google.com/search?q={query}' };
const docs: SiteSearchProvider = {
  id: 'docs',
  key: 'docs',
  name: 'Docs',
  template: 'https://docs.example.test/?q={query}',
  _xIsCustom: true
};

const sourceTab: chrome.tabs.Tab = {
  id: 88,
  windowId: 7,
  index: 0,
  active: true,
  pinned: false,
  highlighted: true,
  incognito: false,
  selected: true,
  discarded: false,
  autoDiscardable: true,
  frozen: false,
  groupId: -1,
  lastAccessed: 0
};
const sender: chrome.runtime.MessageSender = { tab: sourceTab };

function getEntryUrl(provider: SiteSearchProvider, query: string): string {
  return String(provider.template || '').replace('{query}', encodeURIComponent(query));
}

// Aggregate searches as stored in settings.
function storedAggregateSearches(definitions: unknown[]) {
  const stored = aggregateStore.serializeAggregateSearches(definitions);
  return () => loadAggregateSearches({
    get(_keys, callback) {
      if (callback) callback({ [aggregateSearches.key]: stored });
    },
    set() {}
  }, aggregateSearches.key, { runtime: { lastError: null } });
}

function definition(id: string, autoCreateTabGroup: boolean): AggregateSearch {
  return { id, key: '', name: id, sourceRefs: [], autoCreateTabGroup };
}

// A store that finds every definition available with the providers it is
// given, and reads its grouping choice as autoCreateTabGroup.
function availableStore(autoCreateTabGroup: boolean) {
  const store: AggregateSearchStoreLike = {
    getAggregateSearchAvailability: vi.fn((found: unknown, providers: readonly SiteSearchProvider[] | null | undefined): AggregateSearchAvailability => {
      const id = found && typeof found === 'object' && 'id' in found ? String(found.id) : '';
      const available = Array.from(providers || []);
      return {
        available: true,
        definition: definition(id, autoCreateTabGroup),
        providers: available,
        unavailableSourceRefs: [],
        requiredSourceCount: available.length,
        availableSourceCount: available.length,
        unavailableSourceCount: 0
      };
    })
  };
  return store;
}

function openRecorder() {
  return vi.fn(async (_chromeApi: unknown, options: AggregateSearchOpenOptions) => ({
    ok: true,
    openedCount: (options.providers || []).length
  }));
}

describe('the aggregate search grouping setting', () => {
  it('groups by default when neither the setting nor any definition says otherwise', () => {
    expect(resolveAggregateSearchAutoGroupEnabled(undefined, [])).toBe(true);
    expect(resolveAggregateSearchAutoGroupEnabled(undefined, [{ id: 'new-definition' }])).toBe(true);
  });

  it('follows the definitions saved before grouping was one setting', () => {
    expect(resolveAggregateSearchAutoGroupEnabled(undefined, [{ id: 'legacy-off', autoCreateTabGroup: false }])).toBe(false);
    expect(resolveAggregateSearchAutoGroupEnabled(undefined, [
      { id: 'legacy-off', autoCreateTabGroup: false },
      { id: 'legacy-on', autoCreateTabGroup: true }
    ])).toBe(true);
  });

  it('lets a stored setting override the definitions', () => {
    expect(resolveAggregateSearchAutoGroupEnabled(false, [{ id: 'legacy-on', autoCreateTabGroup: true }])).toBe(false);
  });
});

describe('running a stored aggregate search', () => {
  it('opens the stored sources next to the asking tab, once for repeated requests', async () => {
    let now = 1000;
    const loadSiteSearchProviders = vi.fn(async () => [google, docs]);
    const openSearch = openRecorder();
    const resolveTabPlacement = vi.fn(async () => ({ windowId: 7, index: 4 }));
    const run = createAggregateSearchQueryRunner({
      aggregateSearchStore: aggregateStore,
      loadAggregateSearches: storedAggregateSearches([{
        id: 'research',
        name: 'Research',
        sourceRefs: ['builtin:google', 'custom:docs'],
        autoCreateTabGroup: true
      }]),
      loadSiteSearchProviders,
      loadAggregateSearchAutoGroupEnabled: async () => false,
      resolveTabPlacement,
      openAggregateSearch: openSearch,
      getEntryUrl,
      now: () => now,
      dedupeWindowMs: 1000
    });

    const first = run('research', 'stored trust boundary', sender, 'currentTab');
    const duplicate = run('research', 'stored trust boundary', sender, 'currentTab');

    expect(duplicate).toBe(first);
    expect((await first).ok).toBe(true);
    expect(loadSiteSearchProviders).toHaveBeenCalledTimes(1);
    expect(resolveTabPlacement).toHaveBeenCalledWith(sourceTab);
    expect(openSearch).toHaveBeenCalledTimes(1);
    expect(openSearch.mock.calls[0][1]).toMatchObject({
      providers: [google, docs],
      autoCreateTabGroup: false,
      windowId: 7,
      insertIndex: 4
    });

    await run('research', 'stored trust boundary', sender, 'currentTab');
    expect(openSearch).toHaveBeenCalledTimes(1);
    now += 1001;
    await run('research', 'stored trust boundary', sender, 'currentTab');
    expect(openSearch).toHaveBeenCalledTimes(2);
  });

  it('opens nothing when a source of the aggregate search is missing', async () => {
    const openSearch = openRecorder();
    const run = createAggregateSearchQueryRunner({
      aggregateSearchStore: aggregateStore,
      loadAggregateSearches: storedAggregateSearches([{
        id: 'broken',
        name: 'Broken',
        sourceRefs: ['builtin:google', 'custom:missing'],
        autoCreateTabGroup: false
      }]),
      loadSiteSearchProviders: async () => [google],
      openAggregateSearch: openSearch,
      getEntryUrl
    });

    expect(await run('broken', 'must stay complete', sender, 'currentTab')).toMatchObject({
      ok: false,
      reason: 'aggregate-search-sources-unavailable',
      requiredSourceCount: 2,
      availableSourceCount: 1,
      unavailableSourceCount: 1
    });
    expect(openSearch).not.toHaveBeenCalled();
  });

  it('takes the store availability as its only rule, and the stored setting over a definition', async () => {
    const store = availableStore(false);
    const openSearch = openRecorder();
    const run = createAggregateSearchQueryRunner({
      loadAggregateSearches: async () => [definition('delegated', false)],
      aggregateSearchStore: store,
      loadSiteSearchProviders: async () => [google],
      loadAggregateSearchAutoGroupEnabled: async () => true,
      openAggregateSearch: openSearch
    });

    expect((await run('delegated', 'single source delegated rule', sender, 'currentTab')).ok).toBe(true);
    expect(store.getAggregateSearchAvailability).toHaveBeenCalledTimes(1);
    expect(openSearch).toHaveBeenCalledTimes(1);
    expect(openSearch.mock.calls[0][1].autoCreateTabGroup).toBe(true);
  });

  it('falls back to the definition grouping when the setting cannot be read', async () => {
    const openSearch = openRecorder();
    const run = createAggregateSearchQueryRunner({
      loadAggregateSearches: async () => [{ id: 'legacy-group', key: '', name: 'Legacy group', sourceRefs: [], autoCreateTabGroup: true }],
      aggregateSearchStore: availableStore(true),
      loadSiteSearchProviders: async () => [google],
      loadAggregateSearchAutoGroupEnabled: () => Promise.reject(new Error('temporary setting failure')),
      openAggregateSearch: openSearch
    });

    expect((await run('legacy-group', 'fallback to legacy setting', sender, 'currentTab')).ok).toBe(true);
    expect(openSearch.mock.calls[0][1].autoCreateTabGroup).toBe(true);
  });

  it('runs a request again after reading the aggregate searches failed', async () => {
    const loadDefinitions = vi.fn<() => Promise<AggregateSearch[]>>()
      .mockRejectedValueOnce(new Error('temporary storage failure'))
      .mockResolvedValue([definition('storage-retry', false)]);
    const run = createAggregateSearchQueryRunner({
      loadAggregateSearches: loadDefinitions,
      aggregateSearchStore: availableStore(false),
      loadSiteSearchProviders: async () => [google, docs],
      openAggregateSearch: openRecorder()
    });

    await expect(run('storage-retry', 'retry', sender, 'currentTab')).rejects.toThrow(/temporary storage failure/);
    expect((await run('storage-retry', 'retry', sender, 'currentTab')).ok).toBe(true);
    expect(loadDefinitions).toHaveBeenCalledTimes(2);
  });

  it('runs a request again after loading the providers failed', async () => {
    const loadProviders = vi.fn<() => Promise<SiteSearchProvider[]>>()
      .mockRejectedValueOnce(new Error('temporary provider failure'))
      .mockResolvedValue([google, docs]);
    const run = createAggregateSearchQueryRunner({
      loadAggregateSearches: async () => [definition('provider-retry', false)],
      aggregateSearchStore: availableStore(false),
      loadSiteSearchProviders: loadProviders,
      openAggregateSearch: openRecorder()
    });

    await expect(run('provider-retry', 'retry', sender, 'currentTab')).rejects.toThrow(/temporary provider failure/);
    expect((await run('provider-retry', 'retry', sender, 'currentTab')).ok).toBe(true);
    expect(loadProviders).toHaveBeenCalledTimes(2);
  });
});
