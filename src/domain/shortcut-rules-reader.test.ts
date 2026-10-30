import { describe, expect, it } from 'vitest';
import { readShortcutRules, shortcutRuleMatches } from './shortcut-rules-reader';

describe('shortcut rule matching', () => {
  const rule = { type: 'browserPage', keys: ['ext ', 'extensions '], path: 'extensions' };

  it('matches a query that is one of the rule words, ignoring case and spacing', () => {
    expect(shortcutRuleMatches(rule, 'ext')).toBe(true);
    expect(shortcutRuleMatches(rule, ' EXT ')).toBe(true);
    expect(shortcutRuleMatches({ keys: ['browser history'] }, 'browser   history')).toBe(true);
  });

  it('leaves a query with more words, a longer word or nothing to the search', () => {
    expect(shortcutRuleMatches(rule, 'ext lumno')).toBe(false);
    expect(shortcutRuleMatches(rule, 'extra')).toBe(false);
    expect(shortcutRuleMatches(rule, '')).toBe(false);
    expect(shortcutRuleMatches(rule, '   ')).toBe(false);
  });

  it('matches nothing for a rule without words', () => {
    expect(shortcutRuleMatches({ type: 'url', url: 'https://lumno.app' }, 'lumno')).toBe(false);
    expect(shortcutRuleMatches(null, 'ext')).toBe(false);
  });
});

describe('reading shortcut rules', () => {
  it('keeps the known fields of each rule and leaves malformed entries out', () => {
    expect(readShortcutRules({
      items: [
        { type: 'browserPage', keys: ['ext ', 3], path: 'extensions', extra: true },
        'not a rule',
        { type: 'url', keys: ['lumno '], url: 'https://lumno.app', searchSourceType: 'site' }
      ]
    })).toEqual([
      { type: 'browserPage', keys: ['ext '], path: 'extensions' },
      { type: 'url', keys: ['lumno '], url: 'https://lumno.app', searchSourceType: 'site' }
    ]);
  });

  it('reads a file without a rule list as no rules', () => {
    expect(readShortcutRules({ items: 'not-an-array' })).toEqual([]);
    expect(readShortcutRules(null)).toEqual([]);
  });
});
