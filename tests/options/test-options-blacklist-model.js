const assert = require('assert');
const { createBlacklistModel } = require('../../src/options/options-blacklist');

const model = createBlacklistModel();

assert.strictEqual(model.getMatchTone(['exact', 'suffix']), 'exact');
assert.strictEqual(model.getMatchTone(['suffix']), 'suffix');
assert.strictEqual(model.getMatchTone([]), 'prefix', 'rules default to path-prefix matching');

assert.strictEqual(model.formatPatternForDisplay({ pattern: 'example.com', matchModes: ['suffix'] }), 'example.com');
assert.strictEqual(model.formatPatternForDisplay({ pattern: 'example.com/a', matchModes: ['prefix'] }), 'http(s)://example.com/a');
assert.strictEqual(model.formatPatternForDisplay(null), '');

assert.deepStrictEqual(model.getInputConfig(['suffix']), {
  labelKey: 'blacklist_label_url',
  labelFallback: 'URL rule',
  placeholderKey: 'blacklist_placeholder_domain',
  placeholderFallback: 'baidu.com',
  prefixText: ''
});
assert.strictEqual(model.getInputConfig(['exact']).placeholderKey, 'blacklist_placeholder_exact');
assert.strictEqual(model.getInputConfig(['exact']).prefixText, 'http(s)://');
assert.strictEqual(model.getInputConfig(['prefix']).placeholderKey, 'blacklist_placeholder_prefix');

assert.deepStrictEqual(model.buildRuleDraft('example.com', []), { error: 'blacklist_error_match_mode' });
assert.deepStrictEqual(model.buildRuleDraft('', ['suffix']), { error: 'blacklist_error_domain' });
assert.deepStrictEqual(model.buildRuleDraft('', ['prefix']), { error: 'blacklist_error_url' });
const draft = model.buildRuleDraft('https://Example.com/search?q=1', ['prefix']);
assert(draft.item && draft.item.pattern, 'a URL becomes a rule pattern');
assert.deepStrictEqual(draft.item.matchModes, ['prefix']);

// A saved rule goes first and replaces the edited rule and any equal rule.
{
  const a = { pattern: 'a.com', matchModes: ['suffix'] };
  const b = { pattern: 'b.com', matchModes: ['suffix'] };
  const c = { pattern: 'c.com', matchModes: ['suffix'] };
  const next = model.upsertItems([a, b, c], { pattern: 'c.com', matchModes: ['suffix'] }, model.buildItemKey(a));
  assert.deepStrictEqual(next.map((item) => item.pattern), ['c.com', 'b.com']);
}

console.log('Options blacklist model tests passed.');
