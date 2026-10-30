import { describe, expect, it } from 'vitest';
import { bootSearchWorker, visit, wait } from '../../../tests/fakes/worker-search';
import type { SearchWorker } from '../../../tests/fakes/worker-search';

const WEREAD = 'https://weread.qq.com/';
const FUZZY_PINYIN_KEY = '_x_extension_search_fuzzy_pinyin_enabled_2026_unique_';

async function finds(worker: SearchWorker, query: string, url: string): Promise<boolean> {
  return (await worker.search.getSearchSuggestions(query)).some((item) => item.url === url);
}

describe('matching Chinese titles', () => {
  it('matches a title by its pinyin initials and highlights the characters they spell', async () => {
    const worker = await bootSearchWorker();

    const suggestion = (await worker.search.getSearchSuggestions('wxds')).find((item) => item.url === WEREAD);

    expect(suggestion && suggestion.titleHighlight).toEqual({ text: '微信读书', query: 'wxds', ranges: [[0, 4]] });
  });

  it('matches a simplified title from traditional characters', async () => {
    expect(await finds(await bootSearchWorker(), '微信讀書', WEREAD)).toBe(true);
  });

  it('matches a title holding the query in pieces', async () => {
    const worker = await bootSearchWorker();

    const suggestion = (await worker.search.getSearchSuggestions('读书微信')).find((item) => item.url === WEREAD);

    expect(suggestion && suggestion.titleHighlight).toEqual({ text: '微信读书', query: '读书微信', ranges: [[0, 4]] });
  });

  it('matches full pinyin mixed with initials', async () => {
    expect(await finds(await bootSearchWorker(), 'weixinds', WEREAD)).toBe(true);
  });

  it('finds a page whose address spells a Han query in pinyin', async () => {
    const worker = await bootSearchWorker({
      extraHistory: (now) => [visit('Zhihu - Have a question', 'https://www.zhihu.com/question/1', 3, 0, now - 5_500)]
    });

    expect(await finds(worker, '知乎', 'https://www.zhihu.com/question/1')).toBe(true);
  });
});

describe('fuzzy pinyin', () => {
  const bank = (now: number) => [visit('中国银行', 'https://www.boc.cn/', 2, 0, now - 5_600)];

  it('keeps z and zh apart until it is turned on, then indexes the titles again', async () => {
    const worker = await bootSearchWorker({ extraHistory: bank });

    expect(await finds(worker, 'zongguoyinhang', 'https://www.boc.cn/')).toBe(false);
    worker.fake.storage.sync.externalSet({ [FUZZY_PINYIN_KEY]: true });
    expect(await finds(worker, 'zongguoyinhang', 'https://www.boc.cn/')).toBe(true);
  });

  it('applies a stored choice from the first search', async () => {
    const worker = await bootSearchWorker({ extraHistory: bank, sync: { [FUZZY_PINYIN_KEY]: true } });

    expect(await finds(worker, 'zongguoyinhang', 'https://www.boc.cn/')).toBe(true);
  });
});

describe('Han titles older than the recent history', () => {
  // The browser's own history search cannot read pinyin, so Han titles are
  // kept from further back than the recent list.
  const olderHistory = (now: number) => [
    ...Array.from({ length: 400 }, (_, index) =>
      visit(`Older Filler ${index + 1}`, `https://older-filler.example.com/${index + 1}`, 1, 0, now - 30_000 - index)),
    visit('飞书云文档', 'https://feishu.example.com/drive', 2, 0, now - 40_000)
  ];

  async function findsOlderFeishu(worker: SearchWorker): Promise<boolean> {
    await worker.search.getSearchSuggestions('feishuwendang');
    await wait(20);
    return finds(worker, 'feishuwendang', 'https://feishu.example.com/drive');
  }

  it('are found by pinyin, and leave once their history is removed', async () => {
    const worker = await bootSearchWorker({ extraHistory: olderHistory });

    expect(await findsOlderFeishu(worker)).toBe(true);
    worker.fake.chrome.history.onVisitRemoved.fire({ allHistory: false, urls: ['https://feishu.example.com/drive'] });
    expect(await findsOlderFeishu(worker)).toBe(false);
  });
});
