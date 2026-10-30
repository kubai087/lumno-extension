import { describe, expect, it } from 'vitest';
import { matchesSearchQueryText } from './query-intent';
import { buildSearchQueryContext } from './selection-stats';
import { createSearchTextMatcher, getSearchTitleHighlightRanges } from './text-matching';
import { compactSearchQuery, splitSearchTerms } from './text-normalize';
import { pinyin } from 'pinyin-pro';
import { HAN_VARIANT_PAIRS } from '../han-variants.generated';
import { installHanVariantPairs } from '../han-variants';

// How local search reads titles in other languages: letters a reader sees
// as the same, marks that can or cannot be left out, words and initials in
// every script that writes words apart, Japanese kana and Korean jamo.

installHanVariantPairs(HAN_VARIANT_PAIRS);

const options = {
  titleMatcher: createSearchTextMatcher({
    getHanReadings: (_text, characters) => characters.map((character) => (
      pinyin(character, { toneType: 'none', type: 'array', multiple: true, v: true })
    ))
  })
};

function matches(query: string, title: string): boolean {
  return matchesSearchQueryText({ title, url: 'https://example.com/page' }, buildSearchQueryContext(query), options);
}

function marked(query: string, title: string): string[] {
  return getSearchTitleHighlightRanges(title, buildSearchQueryContext(query), options)
    .map(([start, end]) => title.slice(start, end));
}

describe('search title matching in other languages', () => {
  it("matches or keeps apart the spellings each language reads as one", () => {
    const cases: Array<[string, string, boolean, string]> = [
      // English
      ['doc', 'Google Docs', true, 'a word prefix'],
      ['gh', 'GitHub', true, 'camel-case initials'],
      ['re', 'Pull requests', true, 'a short term at a word start'],
      ['qu', 'Pull requests', false, 'a short term inside a word'],
      // Latin letters spelled several ways
      ['muller', 'Müller GmbH', true, 'an umlaut without its dots'],
      ['mueller', 'Müller GmbH', true, 'ue for ü'],
      ['groesse', 'Größe', true, 'oe for ö and ss for ß'],
      ['strasse', 'Hauptstraße 5', true, 'ss for ß'],
      ['cafe', 'Café de Flore', true, 'an accent left out'],
      ['espana', 'España', true, 'ñ without its tilde'],
      ['oe', 'Œuvre complète', true, 'Œ as OE at a word start'],
      ['lodz', 'Łódź', true, 'ł, a letter with no decomposition'],
      ['oslo sor', 'Oslo Sør', true, 'ø as o'],
      ['dang', 'Đặng Thái Sơn', true, 'đ as d'],
      ['tieng viet', 'Tiếng Việt', true, 'Vietnamese tones left out'],
      ['istanbul', 'İstanbul', true, 'the dotted capital I'],
      ['aesir', 'Æsir', true, 'æ as ae'],
      // Cyrillic and Greek
      ['москва', 'Москва — столица', true, 'a Cyrillic word'],
      ['ёлка', 'Елка новогодняя', true, 'ё as е'],
      ['елка', 'Ёлка', true, 'е as ё'],
      ['мой', 'Мои документы', false, 'й, a letter of its own, not и'],
      ['мгу', 'Московский государственный университет', true, 'Cyrillic initials'],
      ['да', 'Когда придёт', false, 'a short Cyrillic term inside a word'],
      ['αθηνα', 'Αθήνα', true, 'Greek accents left out'],
      ['οδοσ', 'Οδός', true, 'the final sigma as σ'],
      // Arabic, Persian and Hebrew
      ['احمد', 'أحمد علي', true, 'alef with hamza as alef'],
      ['مدرسة', 'مدرسه', true, 'ta marbuta as ha'],
      ['كتاب', 'كِتَاب', true, 'Arabic vowel signs left out'],
      ['كتاب', 'کتاب', true, 'the Persian kaf'],
      ['שלום', 'שָׁלוֹם', true, 'Hebrew points left out'],
      // Marks that change a word stay
      ['भारत', 'भारत सरकार', true, 'a Devanagari word'],
      ['भारत', 'भरत सिंह', false, 'a Devanagari vowel sign that changes the word'],
      ['กิน', 'กนก', false, 'a Thai vowel sign that changes the word'],
      ['ไก่', 'ไก', false, 'a Thai tone mark'],
      ['กรุงเทพ', 'กรุงเทพมหานคร', true, 'Thai, written without spaces'],
      // Japanese
      ['ポケモン', 'ポケモン公式サイト', true, 'katakana'],
      ['ぽけもん', 'ポケモン公式サイト', true, 'hiragana for katakana'],
      ['ｶﾀｶﾅ', 'カタカナ表', true, 'half-width katakana'],
      ['東京', '東京タワー', true, 'kanji'],
      ['機械', '機械学習入門', true, 'kanji the variant table also folds'],
      ['dong', '東京タワー', false, 'Chinese pinyin read into a Japanese title'],
      ['the', 'その他の設定', false, 'an English word against kana'],
      // Korean
      ['서울', '서울특별시', true, 'Hangul'],
      ['ㅅㅇ', '서울특별시', true, 'initial consonants (초성)'],
      ['ㄱㅅ', '네이버 검색', true, 'initial consonants after a space'],
      ['ㄷㅂ', '네이버 검색', false, 'initial consonants the title does not have'],
      ['삼서', '삼성전자', true, 'the last syllable still being typed'],
      ['간', '가나다라', true, 'a final consonant that becomes the next initial'],
      ['서울시', '서울 특별시', false, 'pieces are for Han text only'],
      // Digits
      ['2024', '٢٠٢٤ تقرير', true, 'Arabic-Indic digits'],
      ['2024', '２０２４年', true, 'full-width digits'],
      // Out of scope: these would need dictionaries or transliteration tables
      ['tokyo', '東京タワー', false, 'romaji for kanji'],
      ['bharat', 'भारत सरकार', false, 'romanized Devanagari']
    ];

    cases.forEach(([query, title, expected, label]) => {
      expect(matches(query, title), `"${query}" ${expected ? 'should' : 'should not'} match "${title}" (${label})`).toBe(expected);
    });
  });

  it("marks the letters a match used, keeping the marks that join them", () => {
    const highlights: Array<[string, string, string[], string]> = [
      ['كتاب', 'كِتَاب', ['كِتَاب'], 'an Arabic highlight should keep its vowel signs so the letters stay joined'],
      ['שלום', 'שָׁלוֹם', ['שָׁלוֹם'], 'a Hebrew highlight should keep its points'],
      ['mueller', 'Müller GmbH', ['Müller'], 'a second spelling should mark the word it spelled'],
      ['мгу', 'Московский государственный университет', ['М', 'г', 'у'], 'Cyrillic initials should mark each initial'],
      ['ぽけもん', 'ポケモン公式サイト', ['ポケモン'], 'hiragana should mark the katakana it matched'],
      ['ㅅㅇ', '서울특별시', ['서울'], 'initial consonants should mark their syllables'],
      ['간', '가나다라', ['가나'], 'a carried final consonant should mark both syllables']
    ];
    highlights.forEach(([query, title, expected, label]) => {
      expect(marked(query, title), label).toEqual(expected);
    });
  });

  it("keeps the marks that change a word when compacting and splitting a query", () => {
    expect(compactSearchQuery('भारत'), 'compacting a query should keep the marks that change a word').toBe('भारत');
    expect(splitSearchTerms('भारत सरकार'), 'splitting terms should keep a Devanagari word whole').toEqual(['भारत', 'सरकार']);
  });

});
