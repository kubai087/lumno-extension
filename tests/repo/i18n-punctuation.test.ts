import { describe, expect, it } from 'vitest';
import { readLocaleMessages, type LocaleMessages } from './repository';

// Punctuation rules for UI copy:
// - Labels, titles, buttons, placeholders and aria labels never end with a period.
// - A line that already contains more than one sentence ends with a period
//   (or a colon / ellipsis when it leads into what follows).
// - zh_CN and zh_TW agree on whether each line ends with a period.
// - Ellipses use "…", and English copy never uses full-width punctuation.

const LOCALES = ['zh_CN', 'zh_TW', 'en', 'ja'];
const FRAGMENT_KEY_PATTERN = /_(title|label|placeholder|aria|button)$/;
const SENTENCE_END_PATTERN = /[。.？?！!:：…]$/;
// Lead-ins that are completed by surrounding UI (links, buttons) rather than by the copy itself.
const SENTENCE_LEAD_IN_KEYS = new Set(['engagement_notice_text']);

const messages: Record<string, LocaleMessages> = Object.fromEntries(LOCALES.map((locale) => [locale, readLocaleMessages(locale)]));

function lines(text: string | undefined): string[] {
  return String(text || '').split('\n').map((line) => line.trimEnd());
}

function endsWithPeriod(line: string): boolean {
  return /[。.]$/.test(line) && !/(\.\.\.|…)$/.test(line);
}

function hasInnerSentenceBreak(locale: string, line: string): boolean {
  if (/^\d+\.\s?/.test(line)) {
    return false;
  }
  const body = line.slice(0, -1);
  if (locale === 'en') {
    return /[.?!]\s+[A-Z“"]/.test(body.replace(/\b(e\.g|i\.e)\./g, ''));
  }
  return /[。？！]/.test(body);
}

// Every line of copy a locale has for a key zh_CN has, with where it is.
function eachMessage(): Array<[string, string, string]> {
  return Object.keys(messages.zh_CN).flatMap((key) => LOCALES
    .filter((locale) => key in messages[locale])
    .map((locale): [string, string, string] => [locale, key, messages[locale][key]]));
}

describe('UI copy punctuation', () => {
  it('writes ellipses as "…"', () => {
    expect(eachMessage().filter(([, , text]) => /\.\.\.$/.test(text)).map(([locale, key]) => `${locale}.${key}`)).toEqual([]);
  });

  it('keeps full-width punctuation out of English copy', () => {
    expect(eachMessage().filter(([locale, , text]) => locale === 'en' && /[。，：；（）！？]/.test(text))
      .map(([locale, key, text]) => `${locale}.${key}: ${text}`)).toEqual([]);
  });

  it('ends no label, title, button, placeholder or aria label with a period', () => {
    expect(eachMessage().filter(([locale, key, text]) => FRAGMENT_KEY_PATTERN.test(key) && !text.includes('\n') &&
      !hasInnerSentenceBreak(locale, text) && endsWithPeriod(text))
      .map(([locale, key, text]) => `${locale}.${key}: ${text}`)).toEqual([]);
  });

  it('ends a line of several sentences with a period', () => {
    expect(eachMessage().flatMap(([locale, key, text]) => lines(text)
      .filter((line) => line && !SENTENCE_LEAD_IN_KEYS.has(key) && hasInnerSentenceBreak(locale, line) &&
        !SENTENCE_END_PATTERN.test(line))
      .map((line) => `${locale}.${key}: ${line}`))).toEqual([]);
  });

  it('agrees between zh_CN and zh_TW on every trailing period', () => {
    const disagreements = Object.keys(messages.zh_CN).flatMap((key) => {
      const zhCN = lines(messages.zh_CN[key]);
      const zhTW = lines(messages.zh_TW[key]);
      if (zhCN.length !== zhTW.length) {
        return [];
      }
      return zhCN.flatMap((line, index) => (endsWithPeriod(line) !== endsWithPeriod(zhTW[index])
        ? [`${key}: ${line} vs ${zhTW[index]}`]
        : []));
    });
    expect(disagreements).toEqual([]);
  });
});
