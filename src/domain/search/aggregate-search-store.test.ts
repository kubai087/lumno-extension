import { describe, expect, it } from 'vitest';
import * as store from './aggregate-search-store';

const PROVIDERS = [
  { key: 'gg', name: 'Google' },
  { key: 'gh', id: 'custom-1', name: 'GitHub custom', _xIsCustom: true },
  { key: 'goog', builtinKey: 'bi', id: 'custom-2', name: 'Bing override', _xIsCustom: true },
  { key: 'legacy', name: 'Legacy custom', _xIsCustom: true }
];

interface CustomProvider {
  id?: string;
  key: string;
  name: string;
  template?: string;
  aliases?: string[];
}

function present<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('Expected a value.');
  return value;
}

const DEFINITION = {
  id: 'research',
  key: 'research',
  name: 'Research Search',
  sourceRefs: ['builtin:gg', 'custom:custom-1'],
  autoCreateTabGroup: true
};

function definition() {
  return store.normalizeAggregateSearch({
    id: 'research',
    key: 'Research',
    name: '  Research   Search ',
    sourceRefs: ['builtin:gg', 'custom:custom-1', 'builtin:gg'],
    autoCreateTabGroup: true
  });
}

describe('aggregate search definitions', () => {
  it('refers to built-in, custom and legacy custom sources by a stable reference', () => {
    expect(PROVIDERS.map((provider) => store.getProviderSourceRef(provider))).toEqual([
      'builtin:gg', 'custom:custom-1', 'builtin:bi', 'custom-key:legacy'
    ]);
  });

  it('normalizes a definition: lower-case trigger, collapsed name, no duplicate sources', () => {
    expect(definition()).toEqual(DEFINITION);
  });

  it('resolves its sources, legacy custom ones included, and names the missing ones', () => {
    const resolved = store.resolveAggregateSearchSources(DEFINITION, PROVIDERS);
    expect(resolved.providers.map((item) => item.name)).toEqual(['Google', 'GitHub custom']);
    expect(resolved.unavailableSourceRefs).toEqual([]);

    const legacy = store.resolveAggregateSearchSources({
      id: 'legacy-custom',
      name: 'Legacy custom source',
      sourceRefs: ['builtin:gg', 'custom-key:legacy'],
      autoCreateTabGroup: false
    }, PROVIDERS);
    expect(legacy.providers.map((item) => item.name)).toEqual(['Google', 'Legacy custom']);
    expect(legacy.unavailableSourceRefs).toEqual([]);

    const missing = store.resolveAggregateSearchSources({ ...DEFINITION, sourceRefs: ['builtin:gg', 'custom:missing'] }, PROVIDERS);
    expect(missing.providers.map((item) => item.key)).toEqual(['gg']);
    expect(missing.unavailableSourceRefs).toEqual(['custom:missing']);
  });

  it('is available only when every configured source resolves', () => {
    const state = store.getAggregateSearchAvailability({ ...DEFINITION, sourceRefs: ['builtin:gg', 'custom:missing'] }, PROVIDERS);
    expect(state).toMatchObject({ available: false, requiredSourceCount: 2, availableSourceCount: 1, unavailableSourceCount: 1 });
    expect(store.isAggregateSearchAvailable(DEFINITION, PROVIDERS)).toBe(true);
  });

  it('becomes a scope provider that leaves the tab-group preference to the global setting', () => {
    const provider = present(store.createScopeProvider(DEFINITION));
    expect(store.isAggregateSearchProvider(provider)).toBe(true);
    expect(provider.aggregateId).toBe('research');
    expect(provider.key).toBe('research');
    expect(Object.hasOwn(provider, 'autoCreateTabGroup')).toBe(false);
    expect(provider.sourceRefs).toEqual(DEFINITION.sourceRefs);
  });

  it('stores only valid definitions, at schema version 2', () => {
    const serialized = store.serializeAggregateSearches([
      DEFINITION,
      { id: 'invalid', name: 'Only one', sourceRefs: ['builtin:gg'] }
    ]);
    expect(serialized.version).toBe(2);
    expect(serialized.items).toEqual([DEFINITION]);
  });

  it('keeps a legacy aggregate without a trigger selectable from the scope menu', () => {
    const legacy = present(store.normalizeAggregateSearch({
      id: 'legacy-range-only',
      name: 'Legacy range-only aggregate',
      sourceRefs: ['builtin:gg', 'custom:custom-1']
    }));
    expect(legacy.key).toBe('');
    expect(present(store.createScopeProvider(legacy)).key).toBe('aggregate-legacy-range-only');

    const triggers = store.mergeTriggerProviders(PROVIDERS, [
      DEFINITION,
      { ...DEFINITION, id: 'duplicate-normal', key: 'gg' },
      { ...DEFINITION, id: 'duplicate-aggregate', key: 'research' },
      legacy
    ]);
    expect(triggers.filter(store.isAggregateSearchProvider).map((item) => item.key)).toEqual(['research']);
  });
});

describe('aggregate search storage budget', () => {
  it('fits the largest normal payload in one sync item', () => {
    const items = Array.from({ length: store.MAX_AGGREGATE_COUNT + 1 }, (_unused, index) => ({
      id: `aggregate-${String(index).padStart(2, '0')}-${'a'.repeat(33)}`,
      key: `aggregate-${index}`,
      name: '😀'.repeat(store.MAX_NAME_LENGTH),
      sourceRefs: Array.from({ length: store.MAX_SOURCE_COUNT }, (_source, sourceIndex) => (
        `custom:source-${String(sourceIndex).padStart(2, '0')}-${'b'.repeat(33)}`
      )),
      autoCreateTabGroup: true
    }));
    const payload = store.serializeAggregateSearches(items);
    expect(payload.items).toHaveLength(store.MAX_AGGREGATE_COUNT);
    expect(store.getSerializedStorageByteLength(payload)).toBeLessThan(store.SYNC_ITEM_QUOTA_BYTES);
  });

  it('keeps every accepted payload, JSON-escaped ones too, inside the sync safety budget', () => {
    const worstCase = store.serializeAggregateSearches(Array.from({ length: store.MAX_AGGREGATE_COUNT }, (_unused, index) => ({
      id: `${index}${'a'.repeat(store.MAX_ID_BYTES - 1)}`,
      key: '中'.repeat(store.MAX_KEY_LENGTH),
      name: '中'.repeat(store.MAX_NAME_LENGTH),
      sourceRefs: Array.from({ length: store.MAX_SOURCE_COUNT }, (_source, sourceIndex) => (
        `custom:${index}${sourceIndex}${'b'.repeat(store.MAX_SOURCE_REF_BYTES - 9)}`
      )),
      autoCreateTabGroup: true
    })));
    expect(store.getSerializedStorageByteLength(worstCase)).toBeLessThanOrEqual(store.SYNC_ITEM_BYTE_BUDGET);
    expect(store.SYNC_ITEM_BYTE_BUDGET).toBeLessThan(store.SYNC_ITEM_QUOTA_BYTES);

    const escaped = store.serializeAggregateSearches(Array.from({ length: store.MAX_AGGREGATE_COUNT }, (_unused, index) => ({
      id: `${index}${'\\'.repeat(store.MAX_ID_BYTES)}`,
      key: '\\'.repeat(store.MAX_KEY_LENGTH),
      name: '\\'.repeat(store.MAX_NAME_LENGTH),
      sourceRefs: Array.from({ length: store.MAX_SOURCE_COUNT }, (_source, sourceIndex) => `custom:${index}${sourceIndex}${'\\'.repeat(80)}`),
      autoCreateTabGroup: true
    })));
    expect(store.getSerializedStorageByteLength(escaped)).toBeLessThanOrEqual(store.SYNC_ITEM_BYTE_BUDGET);
  });
});

describe('custom provider ids', () => {
  const ids = (items: Array<{ id?: unknown }>) => items.map((item) => item.id);

  it('gives providers without an id one and keeps existing ids', () => {
    const migrated = store.ensureCustomProviderIds<CustomProvider>([
      { key: 'legacy', name: 'Legacy' },
      { id: 'kept-id', key: 'kept', name: 'Kept' }
    ], (_item, index) => `source-${index + 1}`);
    expect(migrated.changed).toBe(true);
    expect(ids(migrated.items)).toEqual(['source-1', 'kept-id']);

    const renamed = store.ensureCustomProviderIds([
      { ...migrated.items[0], key: 'renamed', name: 'Renamed' },
      migrated.items[1]
    ], () => 'should-not-be-used');
    expect(renamed.changed).toBe(false);
    expect(renamed.items[0]?.id).toBe('source-1');
    expect(store.resolveAggregateSearchSources({
      id: 'stable-reference',
      name: 'Stable reference',
      sourceRefs: ['custom:source-1', 'custom:kept-id']
    }, renamed.items.map((item) => ({ ...item, _xIsCustom: true }))).providers).toHaveLength(2);
  });

  it('migrates legacy providers to the same ids on every device, whatever their labels', () => {
    const legacy: CustomProvider[] = [
      { key: 'docs', name: 'Docs', template: 'https://example.test/search?q={query}', aliases: ['documentation'] },
      { key: 'docs-copy', name: 'Docs copy', template: 'https://example.test/search?q={query}' }
    ];
    const first = store.ensureCustomProviderIds(legacy, store.createDeterministicCustomProviderId);
    const second = store.ensureCustomProviderIds(legacy, store.createDeterministicCustomProviderId);
    expect(ids(first.items)).toEqual(ids(second.items));
    expect(new Set(ids(first.items)).size).toBe(2);
    expect(store.createDeterministicCustomProviderId(
      { key: 'docs', template: 'https://example.test/search?q={query}', name: 'Docs' }, 0, 0
    )).toBe(store.createDeterministicCustomProviderId(
      { key: 'docs', template: 'https://example.test/search?q={query}', name: '文档', aliases: ['different locale'] }, 0, 0
    ));
    const duplicates = store.ensureCustomProviderIds<CustomProvider>([
      { key: 'duplicate', name: 'Duplicate' },
      { key: 'duplicate', name: 'Duplicate' }
    ], store.createDeterministicCustomProviderId);
    expect(new Set(ids(duplicates.items)).size).toBe(2);
  });

  it('shortens an overlong id the same way stored references are shortened', () => {
    const overlong = 'x'.repeat(200);
    const normalized = store.ensureCustomProviderIds<CustomProvider>([{ id: overlong, key: 'overlong', name: 'Overlong' }], store.createDeterministicCustomProviderId);
    expect(normalized.changed).toBe(true);
    const provider = normalized.items[0];
    expect(store.getJsonStringContentByteLength(provider?.id)).toBeLessThanOrEqual(store.MAX_ID_BYTES);
    expect(store.getProviderSourceRef({ ...provider, _xIsCustom: true })).toBe(store.normalizeSourceRefs([`custom:${overlong}`])[0]);
  });
});
