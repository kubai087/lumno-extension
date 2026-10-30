import { describe, expect, it } from 'vitest';
import type { BlacklistRule } from '../domain/blacklist-utils';
import { createBlacklistModel } from './options-blacklist';

const model = createBlacklistModel();

describe('Options blacklist model', () => {
  it('names a rule\'s tone by its widest match, path prefix by default', () => {
    expect(model.getMatchTone(['exact', 'suffix'])).toBe('exact');
    expect(model.getMatchTone(['suffix'])).toBe('suffix');
    expect(model.getMatchTone([])).toBe('prefix');
  });

  it('shows site rules as typed and URL rules with their scheme', () => {
    expect(model.formatPatternForDisplay({ pattern: 'example.com', matchModes: ['suffix'] })).toBe('example.com');
    expect(model.formatPatternForDisplay({ pattern: 'example.com/a', matchModes: ['prefix'] })).toBe('http(s)://example.com/a');
    expect(model.formatPatternForDisplay(null)).toBe('');
  });

  it('labels the editor input for the chosen match', () => {
    expect(model.getInputConfig(['suffix'])).toEqual({
      labelKey: 'blacklist_label_url',
      labelFallback: 'URL rule',
      placeholderKey: 'blacklist_placeholder_domain',
      placeholderFallback: 'baidu.com',
      prefixText: ''
    });
    expect(model.getInputConfig(['exact']).placeholderKey).toBe('blacklist_placeholder_exact');
    expect(model.getInputConfig(['exact']).prefixText).toBe('http(s)://');
    expect(model.getInputConfig(['prefix']).placeholderKey).toBe('blacklist_placeholder_prefix');
  });

  it('builds a rule from the input or says what is missing', () => {
    expect(model.buildRuleDraft('example.com', [])).toEqual({ error: 'blacklist_error_match_mode' });
    expect(model.buildRuleDraft('', ['suffix'])).toEqual({ error: 'blacklist_error_domain' });
    expect(model.buildRuleDraft('', ['prefix'])).toEqual({ error: 'blacklist_error_url' });
    const draft = model.buildRuleDraft('https://Example.com/search?q=1', ['prefix']);
    expect(draft.item?.pattern).toBeTruthy();
    expect(draft.item?.matchModes).toEqual(['prefix']);
  });

  it('puts a saved rule first, replacing the edited rule and any equal one', () => {
    const a: BlacklistRule = { pattern: 'a.com', matchModes: ['suffix'] };
    const b: BlacklistRule = { pattern: 'b.com', matchModes: ['suffix'] };
    const c: BlacklistRule = { pattern: 'c.com', matchModes: ['suffix'] };
    const next = model.upsertItems([a, b, c], { pattern: 'c.com', matchModes: ['suffix'] }, model.buildItemKey(a));
    expect(next.map((item) => item.pattern)).toEqual(['c.com', 'b.com']);
  });
});
