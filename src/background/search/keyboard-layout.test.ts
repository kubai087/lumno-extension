import { describe, expect, it } from 'vitest';
import { bootSearchWorker } from '../../../tests/fakes/worker-search';

// A query typed on the wrong keyboard layout finds the pages its reading on
// another layout names, only when the query as typed finds nothing. The
// readings themselves are unit-tested beside
// src/domain/search/utils/keyboard-layouts.ts.

function page(now: number, title: string, url: string, visitCount = 3) {
  return { title, url, visitCount, typedCount: 0, lastVisitTime: now - 60 * 1000 };
}

function pages(now: number) {
  return [
    page(now, 'Москва — Википедия', 'https://ru.wikipedia.org/wiki/Moscow'),
    page(now, 'Привет мир', 'https://example.ru/hello'),
    page(now, 'Київ — столиця України', 'https://uk.wikipedia.org/wiki/Kyiv'),
    page(now, 'שלום עולם', 'https://example.co.il/hello'),
    page(now, 'مرحبا بالعالم', 'https://example.ae/hello'),
    page(now, '삼성전자', 'https://www.samsung.com/sec/'),
    page(now, 'GitHub', 'https://github.com/', 20),
    page(now, '微信读书', 'https://weread.qq.com/', 6)
  ];
}

// The query a row's title highlight belongs to, and the parts it marks.
function readHighlight(row: Record<string, unknown> | undefined): { query: unknown; marked: string } {
  const highlight: unknown = row ? row.titleHighlight : undefined;
  if (typeof highlight !== 'object' || highlight === null) return { query: undefined, marked: '' };
  const text = String(Reflect.get(highlight, 'text') || '');
  const ranges: unknown = Reflect.get(highlight, 'ranges');
  const marked = (Array.isArray(ranges) ? ranges : [])
    .map((range: unknown) => (Array.isArray(range) ? text.slice(Number(range[0]), Number(range[1])) : ''))
    .join('|');
  return { query: Reflect.get(highlight, 'query'), marked };
}

describe('keyboard layout search in the worker', () => {
  it.each([
    ['vjcrdf', 'ru', 'https://ru.wikipedia.org/wiki/Moscow', 'Москва'],
    ['ghbdtn vbh', 'ru', 'https://example.ru/hello', 'Привет мир'],
    ['rb]d', 'uk', 'https://uk.wikipedia.org/wiki/Kyiv', 'Київ'],
    ['akuo', 'he', 'https://example.co.il/hello', 'שלום'],
    ['lvpfh', 'ar', 'https://example.ae/hello', 'مرحبا'],
    ['tkatjd', 'ko', 'https://www.samsung.com/sec/', '삼성'],
    ['tkatj', 'ko', 'https://www.samsung.com/sec/', '삼성'],
    ['пшерги', 'en', 'https://github.com/', 'GitHub'],
    ['햐소ㅕㅠ', 'en', 'https://github.com/', 'GitHub']
  ])('finds %s through the %s layout and marks what its reading matched', async (query, layout, url, mark) => {
    const { search } = await bootSearchWorker({ history: pages });
    const results = await search.getSearchSuggestions(query);
    const hit = results.find((item) => item.url === url);
    expect(hit).toBeDefined();
    expect(hit?.keyboardLayout).toBe(layout);
    expect(readHighlight(hit)).toEqual({ query, marked: mark });
    expect(results.every((item) => item.keyboardLayout)).toBe(true);
  });

  it('ranks a reading below a match of the query itself', async () => {
    const { search } = await bootSearchWorker({ history: pages });
    const direct = (await search.getSearchSuggestions('москва')).find((item) => item.url?.includes('Moscow'));
    const converted = (await search.getSearchSuggestions('vjcrdf')).find((item) => item.url?.includes('Moscow'));
    expect(direct?.keyboardLayout).toBeFalsy();
    expect(Number(converted?.score)).toBeLessThan(Number(direct?.score));
  });

  it.each([['github', 'https://github.com/'], ['wxds', 'https://weread.qq.com/'], ['微信', 'https://weread.qq.com/']])(
    'never reads %s again when it matches as typed, even where a reading would reach another page', async (query, url) => {
      const { search } = await bootSearchWorker({
        history: (now) => pages(now).concat([
          page(now, 'пшерги заметки', 'https://example.ru/notes-1'),
          page(now, 'цчвы заметки', 'https://example.ru/notes-2'),
          page(now, 'ㅈㅌㅇㄴ 메모', 'https://example.kr/notes-3')
        ])
      });
      const results = await search.getSearchSuggestions(query);
      expect(results.some((item) => item.url === url)).toBe(true);
      expect(results.every((item) => !item.keyboardLayout)).toBe(true);
      expect(results.some((item) => /notes-/.test(String(item.url)))).toBe(false);
    }
  );

  it('does not search a reading in a script no local title uses', async () => {
    const { search } = await bootSearchWorker({ history: (now) => pages(now).filter((item) => !/[֐-׿]/.test(item.title)) });
    expect(await search.getSearchSuggestions('akuo')).toHaveLength(0);
    expect((await search.getSearchSuggestions('vjcrdf')).some((item) => item.keyboardLayout === 'ru')).toBe(true);
  });

  it('finds nothing when no reading does, and reads a query only once', async () => {
    const { search } = await bootSearchWorker({ history: pages });
    expect(await search.getSearchSuggestions('zzqqxx')).toHaveLength(0);
    expect(await search.getSearchSuggestions('vjcrdf', { keyboardLayoutRetry: false })).toHaveLength(0);
  });
});
