import { describe, expect, it } from 'vitest';
import { getSearchKeyboardLayoutQueries } from './keyboard-layouts';

// A query typed on the wrong keyboard layout, read as each other layout
// would have typed it. How the worker searches with these readings is
// tested beside src/background/search/keyboard-layout.ts.

function readings(query: string) {
  return getSearchKeyboardLayoutQueries(query);
}

function readingFor(query: string, layout: string): string | null {
  const match = readings(query).find((item) => item.layout === layout);
  return match ? match.query : null;
}

describe('keyboard layout readings', () => {
  it("reads each layout from US keys, and back", () => {
    // Each layout read from US keys, and back.
    const pairs: Array<[string, string, string]> = [
      ['ru', 'vjcrdf', 'москва'],
      ['ru', 'ghbdtn vbh', 'привет мир'],
      ['uk', 'rb]d', 'київ'],
      ['uk', 'erhf]yf', 'україна'],
      ['he', 'akuo', 'שלום'],
      ['ar', 'lvpfh', 'مرحبا'],
      ['ko', 'tkatjd', '삼성'],
      ['ko', 'dkssudgktpdy', '안녕하세요'],
      ['ko', 'rkskek 123', '가나다 123']
    ];
    pairs.forEach(([layout, typed, meant]) => {
      expect(readingFor(typed, layout), `${typed} should read as ${meant} on ${layout}`).toBe(meant);
      expect(readingFor(meant, 'en'), `${meant} should read back as ${typed} on US keys`).toBe(typed);
    });
  });

  it("reads letters typed for an English word back as US keys, shifted ones and Arabic lam-alef included", () => {
    expect(readingFor('пшерги', 'en'), 'Cyrillic typed for an English word reads as US keys').toBe('github');
    expect(readingFor('ьшскщыщае', 'en')).toBe('microsoft');
    expect(readingFor('햐소ㅕㅠ', 'en'), 'loose jamo still read back as keys').toBe('github');
    expect(readingFor('لهفاعلا', 'en'), 'Arabic لا reads back as the b key').toBe('github');
    expect(readingFor('أهلا', 'en'), 'shifted Arabic letters read as their key').toBe('hib');
  });

  it("reads Shift as a doubled Korean consonant or a capital, and composes a half-typed syllable", () => {
    // Shift doubles Korean consonants, and a capital may be just a capital.
    expect(readings('Tkatjd').some((item) => item.query === '삼성')).toBeTruthy();
    expect(readings('Tkatjd').some((item) => item.query === '쌈성')).toBeTruthy();
    // A half-typed last syllable still composes; the matcher completes it.
    expect(readingFor('tkatj', 'ko')).toBe('삼서');
  });

  it("gives ordinary English, pinyin, addresses, Han text and mixed scripts no reading", () => {
    // Queries that stay as typed: ordinary English and pinyin give no Korean or
    // Hebrew reading (their keys make no syllables or misplace final forms).
    ['github', 'wxds', 'weixin', 'zhihu', 'bilibili', 'google', 'chatgpt'].forEach((query) => {
      const layouts = readings(query).map((item) => item.layout);
      expect(!layouts.includes('ko'), `${query} should not read as Korean`).toBeTruthy();
      expect(!layouts.includes('en'), `${query} is already US keys`).toBeTruthy();
    });
    ['github', 'bilibili', 'weixin'].forEach((query) => {
      expect(!readings(query).some((item) => item.layout === 'he'), `${query} should not read as Hebrew`).toBeTruthy();
    });
    expect(!readings('wxds').some((item) => /[ㄱ-ㆎ]/.test(item.query)), 'pinyin initials are not Korean initials').toBeTruthy();
    [
      'google.com',
      'https://github.com/',
      'ab',
      'tk',
      '微信读书',
      '小红书',
      'github 中文',
      'москва github',
      '',
      'x'.repeat(80)
    ].forEach((query) => {
      expect(readings(query), `${query || '(empty)'} should give no layout reading`).toEqual([]);
    });
  });

  it("follows how words of each language may start", () => {
    expect(readingFor('sdfg', 'ru'), 'Russian words never start with ы').toBe(null);
    expect(readingFor('sdfg', 'uk'), 'Ukrainian words may start with і').toBe('івап');
  });

});
