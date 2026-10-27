const assert = require('assert');
const aggregateSearchStore = require('../../src/domain/search/aggregate-search-store');
const { createAggregateSearchModel } = require('../../src/options/options-aggregate-search');

const model = createAggregateSearchModel();
const { limits } = model;
assert.deepStrictEqual(
  [limits.maxItems, limits.minSources, limits.maxSources],
  [aggregateSearchStore.MAX_AGGREGATE_COUNT, aggregateSearchStore.MIN_SOURCE_COUNT, aggregateSearchStore.MAX_SOURCE_COUNT]
);

const providers = [
  { id: 'source-a', key: 'a', name: 'A', template: 'https://a/{query}' },
  { id: 'source-b', key: 'b', name: 'B', template: 'https://b/{query}' },
  { id: 'source-c', key: 'c', name: 'C', template: 'https://c/{query}' }
];
const refs = providers.map((provider) => aggregateSearchStore.getProviderSourceRef(provider));
let nextId = 0;
const baseContext = {
  availableProviders: providers,
  createId: () => `aggregate-${++nextId}`,
  hasKeyConflict: () => false,
  items: []
};
const build = (id, draft, context) => model.buildAggregateSearchItem(id, draft, Object.assign({}, baseContext, context));

// Legacy installs had the tab-group switch per aggregate search.
assert.strictEqual(model.deriveLegacyAutoGroupEnabled(undefined), true, 'on when there were none');
assert.strictEqual(model.deriveLegacyAutoGroupEnabled([
  { id: 'x', key: 'x', name: 'X', sourceRefs: refs.slice(0, 2), autoCreateTabGroup: false }
]), false);
assert.strictEqual(model.deriveLegacyAutoGroupEnabled([
  { id: 'x', key: 'x', name: 'X', sourceRefs: refs.slice(0, 2), autoCreateTabGroup: false },
  { id: 'y', key: 'y', name: 'Y', sourceRefs: refs.slice(0, 2), autoCreateTabGroup: true }
]), true);

// Draft validation, in the order the editor reports problems.
[
  [{ key: '' }, 'shortcuts_error_key'],
  [{ key: 'a b' }, 'shortcuts_error_key_space'],
  [{ key: 'tech', name: 'Tech', sourceRefs: refs }, 'shortcuts_error_key_duplicate', { hasKeyConflict: () => true }],
  [{ key: 'tech', name: '  ', sourceRefs: refs }, 'aggregate_search_name_required_error'],
  [{ key: 'tech', name: 'Tech', sourceRefs: refs.slice(0, 1) }, 'aggregate_search_min_sources_error'],
  [{ key: 'tech', name: 'Tech', sourceRefs: refs.concat(['custom:missing']) }, 'aggregate_search_source_selection_unavailable_error']
].forEach(([draft, error, context]) => {
  assert.deepStrictEqual(build('', draft, context), { ok: false, error }, `${JSON.stringify(draft)} -> ${error}`);
});
{
  const checks = [];
  const built = build('', { key: ' Tech ', name: '  Tech   news ', sourceRefs: refs.slice(0, 2) }, {
    hasKeyConflict: (key, id) => { checks.push([key, id]); return false; }
  });
  assert.strictEqual(built.ok, true);
  assert.deepStrictEqual(checks, [['tech', '']], 'the normalized trigger is checked against every search');
  assert.strictEqual(built.item.key, 'tech');
  assert.strictEqual(built.item.name, 'Tech news', 'inner whitespace collapses');
  assert.match(built.item.id, /^aggregate-/);
  assert(!Object.prototype.hasOwnProperty.call(built.item, 'autoCreateTabGroup'));

  const edited = build('agg-1', { key: 'tech', name: 'Tech', sourceRefs: refs.slice(1) }, {
    items: [{ id: 'agg-1', key: 'old', name: 'Old', sourceRefs: refs.slice(0, 2), autoCreateTabGroup: true }]
  });
  assert.strictEqual(edited.item.id, 'agg-1', 'an edit keeps its id');
  assert.strictEqual(edited.item.autoCreateTabGroup, true, 'an edit keeps its legacy tab-group flag');
}

// Merging into the latest stored list.
{
  const existing = [
    { id: 'agg-1', key: 'tech', name: 'Tech', sourceRefs: refs.slice(0, 2) },
    { id: 'agg-2', key: 'news', name: 'News', sourceRefs: refs.slice(1) }
  ];
  const item = (overrides) => Object.assign({ id: 'new', key: 'fresh', name: 'Fresh', sourceRefs: refs.slice(0, 2) }, overrides);
  assert.deepStrictEqual(model.mergeAggregateSearchItem(existing, item({ name: 'tech' }), ''), {
    ok: false,
    error: 'aggregate_search_name_duplicate_error'
  }, 'names are unique regardless of case');
  assert.deepStrictEqual(model.mergeAggregateSearchItem(existing, item({ key: 'news' }), ''), {
    ok: false,
    error: 'shortcuts_error_key_duplicate'
  });
  const full = Array.from({ length: limits.maxItems }, (_, index) => ({ id: `f${index}`, key: `k${index}`, name: `N${index}` }));
  assert.deepStrictEqual(model.mergeAggregateSearchItem(full, item(), ''), {
    ok: false,
    error: 'aggregate_search_max_items_error'
  });
  assert.strictEqual(model.mergeAggregateSearchItem(full, item({ id: 'f0', key: 'k0', name: 'N0' }), 'f0').ok, true,
    'editing works even when the list is full');
  const added = model.mergeAggregateSearchItem(existing, item(), '');
  assert.deepStrictEqual(added.items.map((entry) => entry.id), ['agg-1', 'agg-2', 'new']);
  const replaced = model.mergeAggregateSearchItem(existing, item({ id: 'agg-1', key: 'tech', name: 'Tech' }), 'agg-1');
  assert.deepStrictEqual(replaced.items.map((entry) => entry.key), ['tech', 'news'], 'an edit may keep its own name and trigger');
}

console.log('Options aggregate search model tests passed.');
