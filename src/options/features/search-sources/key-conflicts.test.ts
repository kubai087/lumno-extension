import { describe, expect, it } from 'vitest';
import type { AggregateSearch } from '../../../domain/search/aggregate-search-store';
import type { SiteSearchProvider } from '../../../domain/search/types';
import type { SiteSearchProvidersState } from '../site-search/providers';
import { hasSearchKeyConflict } from './key-conflicts';

const shenma: SiteSearchProvider = { key: 'sm', name: '神马', template: 'https://m.sm.cn/s?q={query}' };
const zhihu: SiteSearchProvider = { key: 'zh', name: '知乎', template: 'https://www.zhihu.com/search?q={query}' };

function state(overrides: Partial<SiteSearchProvidersState>): SiteSearchProvidersState {
  return {
    defaults: [shenma, zhihu],
    custom: [],
    disabledKeys: new Set<string>(),
    loaded: true,
    customIdsReady: true,
    ...overrides
  };
}

const aggregates: AggregateSearch[] = [
  { id: 'agg-1', key: 'tech', name: 'Tech', sourceRefs: [], autoCreateTabGroup: false }
];

describe('hasSearchKeyConflict', () => {
  it('reports a key held by a built-in that is on', () => {
    expect(hasSearchKeyConflict(state({}), aggregates, 'SM')).toBe(true);
  });

  it('frees the key of a built-in whose edited copy uses another key', () => {
    const providers = state({
      custom: [{ ...shenma, id: 'c1', key: 'shm', builtinKey: 'sm' }],
      disabledKeys: new Set(['sm'])
    });
    expect(hasSearchKeyConflict(providers, aggregates, 'sm')).toBe(false);
    expect(hasSearchKeyConflict(providers, aggregates, 'shm')).toBe(true);
  });

  it('frees the key of a built-in that was removed', () => {
    expect(hasSearchKeyConflict(state({ disabledKeys: new Set(['sm']) }), aggregates, 'sm')).toBe(false);
  });

  it('still reports aggregate search keys, except the one being edited', () => {
    expect(hasSearchKeyConflict(state({}), aggregates, 'tech')).toBe(true);
    expect(hasSearchKeyConflict(state({}), aggregates, 'tech', '', 'agg-1')).toBe(false);
  });
});
