import { describe, expect, it } from 'vitest';
import { isMachineTranslatedLocale, localeToHtmlLang, normalizeLocale, resolveSupportedLocale } from './locale';

describe('interface language', () => {
  it('maps browser tags onto the _locales folders', () => {
    expect(['', 'en-US', 'ja-JP', 'zh-CN', 'zh-HK', 'zh-Hant-TW'].map(normalizeLocale)).toEqual(['en', 'en', 'ja', 'zh_CN', 'zh_TW', 'zh_TW']);
    expect(['de-AT', 'pt', 'pt-PT', 'es-419', 'ko-KR', 'ru'].map(normalizeLocale)).toEqual(['de', 'pt_BR', 'pt_BR', 'es', 'ko', 'ru']);
  });

  it('falls back to English for a language Lumno has no copy in', () => {
    expect(normalizeLocale('ar')).toBe('en');
    expect(normalizeLocale('it-IT')).toBe('en');
    expect(['he-IL', 'nl', 'system'].map(resolveSupportedLocale)).toEqual(['', '', '']);
  });

  it('gives the page its HTML language tag', () => {
    expect(['en-US', 'ja-JP', 'zh-CN', 'zh-HK', 'pt_BR'].map(localeToHtmlLang)).toEqual(['en', 'ja', 'zh-CN', 'zh-TW', 'pt-BR']);
  });

  it('knows which languages are machine translated', () => {
    expect(isMachineTranslatedLocale('de')).toBe(true);
    expect(isMachineTranslatedLocale('zh-TW')).toBe(false);
  });
});
