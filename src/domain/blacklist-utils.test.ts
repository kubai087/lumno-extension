import { describe, expect, it } from 'vitest';
import { isUrlBlocked, normalizeItems, normalizeMatchModes, normalizePattern } from './blacklist-utils';

describe('blacklist rules', () => {
  it('falls back to prefix matching only when asked to', () => {
    expect(normalizeMatchModes([], 'prefix')).toEqual(['prefix']);
    expect(normalizeMatchModes([], null)).toEqual([]);
  });

  it('normalizes an exact pattern by lowercasing the host and dropping the hash', () => {
    expect(normalizePattern('https://Example.com/settings?tab=1#hash', ['exact'], null)).toBe('example.com/settings?tab=1');
  });

  it('accepts a prefix pattern written without a scheme', () => {
    expect(normalizePattern('example.com/docs/', ['prefix'], null)).toBe('example.com/docs/');
  });

  it('turns a pasted host or URL into the site domain for a whole-site rule', () => {
    expect(normalizePattern('www.baidu.com/news', ['suffix'], null)).toBe('baidu.com');
    expect(normalizePattern('https://example.com/settings', ['suffix'], null)).toBe('example.com');
  });

  it('keeps one rule per pattern and match mode', () => {
    expect(normalizeItems([
      'example.com/a',
      { pattern: 'example.com/a', matchModes: ['prefix'] },
      { pattern: 'example.com/a', matchModes: ['exact'] }
    ], 'prefix')).toEqual([
      { pattern: 'example.com/a', matchModes: ['prefix'] },
      { pattern: 'example.com/a', matchModes: ['exact'] }
    ]);
  });

  it('matches a prefix rule against the URL without its hash', () => {
    expect(isUrlBlocked('https://example.com/docs/article#section', [{ pattern: 'example.com/docs/', matchModes: ['prefix'] }])).toBe(true);
  });

  it('matches an exact rule whatever the scheme', () => {
    expect(isUrlBlocked('http://example.com/a', [{ pattern: 'example.com/a', matchModes: ['exact'] }])).toBe(true);
  });

  it('treats the bare and the www host as the same page for an exact rule', () => {
    expect(isUrlBlocked('https://www.baidu.com/', [{ pattern: 'baidu.com/', matchModes: ['exact'] }])).toBe(true);
    expect(isUrlBlocked('https://baidu.com/settings?tab=1', [{ pattern: 'www.baidu.com/settings?tab=1', matchModes: ['exact'] }])).toBe(true);
  });

  it('does not match a deeper path with an exact rule', () => {
    expect(isUrlBlocked('https://www.baidu.com/search?wd=test', [{ pattern: 'baidu.com/', matchModes: ['exact'] }])).toBe(false);
  });

  it('treats the bare and the www host as the same site for a prefix rule, both ways', () => {
    expect(isUrlBlocked('https://www.baidu.com/docs/article', [{ pattern: 'baidu.com/docs/', matchModes: ['prefix'] }])).toBe(true);
    expect(isUrlBlocked('https://baidu.com/docs/article', [{ pattern: 'www.baidu.com/docs/', matchModes: ['prefix'] }])).toBe(true);
  });

  it('matches subdomains of the site with a whole-site rule, even one saved with www', () => {
    expect(isUrlBlocked('https://m.baidu.com/', [{ pattern: 'baidu.com', matchModes: ['suffix'] }])).toBe(true);
    expect(isUrlBlocked('https://tieba.baidu.com/f', [{ pattern: 'www.baidu.com', matchModes: ['suffix'] }])).toBe(true);
  });

  it('does not match browser pages or another registrable domain with a whole-site rule', () => {
    expect(isUrlBlocked('chrome://extensions', [{ pattern: 'extensions', matchModes: ['suffix'] }])).toBe(false);
    expect(isUrlBlocked('https://baidu.net/', [{ pattern: 'baidu.com', matchModes: ['suffix'] }])).toBe(false);
  });
});
