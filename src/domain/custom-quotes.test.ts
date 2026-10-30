import { describe, expect, it } from 'vitest';
import { MAX_BYTES, normalizeLibrary, parseMarkdown, parseQuotes, select, type QuoteLibrary } from './custom-quotes';

// A user's own quote collection from a .txt or .md file: one quote per line,
// plain text only, within limits, and the daily pick and shuffle over it.
describe('custom quotes', () => {
  it('reads each Markdown line as its own quote, as plain text, leaving out headings and code', () => {
    const parsed = parseMarkdown('# 我的句库\n\n> **千里之行**，始于足下。\n紧邻的第二行。\n- Keep learning.\n- [Be curious](https://example.com/).\n\n```js\nalert(1)\n```');

    expect(parsed).toHaveLength(4);
    expect(parsed[0]).toEqual({ text: '千里之行，始于足下。', author: '' });
    expect(parsed[1].text).toBe('紧邻的第二行。');
    expect(parsed[3].text).toBe('Be curious.');
    expect(parseQuotes('````js\n```\nignored\n````\nVisible', 'md').map((quote) => quote.text)).toEqual(['Visible']);
  });

  it('reads each non-empty text line, duplicates included, across CRLF, CR and a BOM, keeping markup as text', () => {
    expect(parseQuotes('﻿  第一行🙂  \r\n第二行\r\n \r\n第三行\r第四行', 'txt').map((quote) => quote.text)).toEqual(['第一行🙂', '第二行', '第三行', '第四行']);
    expect(parseQuotes('Same\nSame', 'txt').map((quote) => quote.text)).toEqual(['Same', 'Same']);
    expect(parseQuotes('a_b *literal* <b>plain text</b>', 'txt')[0].text).toBe('a_b *literal* <b>plain text</b>');
  });

  it('limits each line, the number of quotes and the file size, and refuses an empty file', () => {
    expect(parseQuotes(`${'a'.repeat(300)}\n${'b'.repeat(300)}`, 'md')).toHaveLength(2);
    expect(() => parseQuotes(' \r\n\t', 'txt')).toThrow(/empty/);
    expect(() => parseMarkdown('# Empty\n```\ncode\n```')).toThrow(/empty/);
    expect(() => parseMarkdown('a'.repeat(501))).toThrow(/limit/);
    expect(() => parseMarkdown('a'.repeat(MAX_BYTES + 1))).toThrow(/too-large/);
    expect(() => parseMarkdown(Array.from({ length: 1001 }, (_, index) => `- Quote ${index}`).join('\n'))).toThrow(/limit/);
  });

  it('picks one quote a day and shuffles to another, which then stays', () => {
    const library: QuoteLibrary = { version: 1, filename: 'quotes.md', revision: 7, quotes: parseMarkdown('One.\nTwo.\nThree.\nFour.') };
    const today = new Date(2026, 9, 14);
    const selected = select(library, today, null, false);

    expect(select(library, today, null, false)).toEqual(selected);
    const shuffled = select(library, today, selected.pick, true);
    expect(shuffled.pick.index).not.toBe(selected.pick.index);
    expect(select(library, today, shuffled.pick, false)).toEqual(shuffled);
    expect(normalizeLibrary({ version: 1, quotes: [] })).toBeNull();
  });

  it('never shuffles back to the quote on screen, drawing from the rest of the collection', () => {
    const pool: QuoteLibrary = { version: 1, filename: 'pool.txt', revision: 7, quotes: ['a', 'b', 'c', 'd'].map((text) => ({ text, author: '' })) };
    const day = new Date(2026, 9, 18);
    const first = select(pool, day, null, false);

    [0, 0.4, 0.999].forEach((draw) => expect(select(pool, day, first.pick, true, () => draw).pick.index).not.toBe(first.pick.index));
    expect(select(pool, day, first.pick, true, () => 0).pick.index).not.toBe(select(pool, day, first.pick, true, () => 0.999).pick.index);
    expect(select(pool, day, null, false).pick.index).toBe(first.pick.index);
  });
});
