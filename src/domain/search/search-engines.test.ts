import { describe, expect, it } from 'vitest';
import { findSearchEngineByHostname, findSearchEngineById, isSearchEngineResultUrl, searchTemplateOn } from './search-engines';

describe('search engine result pages', () => {
  it.each([
    'https://www.google.com/search?q=test',
    'https://www.google.com/search/?q=test',
    'https://www.google.co.jp/search?q=test',
    'https://www.google.com.hk/search?q=test',
    'https://kagi.com/search?q=test',
    'https://www.bing.com/search?q=test',
    'https://cn.bing.com/search?q=test',
    'https://www.baidu.com/s?wd=test',
    'https://duckduckgo.com/?q=test',
    'https://search.yahoo.com/search?p=test',
    'https://yandex.com/search/?text=test',
    'https://yandex.ru/search/?text=test',
    'https://yandex.tm/search/?text=test',
    'https://yandex.com.tr/search/?text=test',
    'https://ya.ru/search/?text=test',
    'https://www.sogou.com/web?query=test',
    'https://m.sm.cn/s?q=test'
  ])('recognizes %s as a result page', (url) => {
    expect(isSearchEngineResultUrl(url)).toBe(true);
  });

  it.each([
    'https://chrome.google.com/webstore/devconsole/test-dashboard?hl=zh-CN',
    'https://chrome.google.com/webstore/devconsole/test-dashboard?q=test',
    'https://chromewebstore.google.com/detail/example/example-id',
    'https://www.google.com/webmasters/',
    'https://www.google.com/support/',
    'https://www.google.com/sheets/',
    'https://www.google.com/search-console?q=test',
    'https://www.google.com/search/docs?q=test',
    'https://www.google.com/search',
    'https://www.google.com/search?q=',
    'https://www.google.com/?q=test',
    'https://www.sogou.com/webstore?query=test',
    'https://www.baidu.com/support?wd=test',
    'https://www.google.com.example.test/search?q=test',
    'https://notbing.com/search?q=test',
    'https://yandex.tm/maps/?text=test',
    'https://notyandex.ru/search/?text=test',
    'https://yandex.ru.example.test/search/?text=test',
    'https://bing.com.example.test/search?q=test',
    'https://example.test/search?q=test',
    'chrome://history/',
    'invalid-url'
  ])('keeps %s an ordinary page', (url) => {
    expect(isSearchEngineResultUrl(url)).toBe(false);
  });
});

describe("Yandex's regional sites", () => {
  it.each(['yandex.ru', 'yandex.tm', 'yandex.com.tr', 'ya.ru', 'www.yandex.kz'])('knows %s as Yandex', (hostname) => {
    expect(findSearchEngineByHostname(hostname)?.id).toBe('yandex');
  });

  it('searches on the regional site a result page came from', () => {
    const yandex = findSearchEngineById('yandex');
    if (!yandex) throw new Error('no Yandex engine');

    expect(searchTemplateOn(yandex, 'yandex.tm')).toBe('https://yandex.tm/search/?text={query}');
    expect(searchTemplateOn(yandex, 'notyandex.ru')).toBe(yandex.searchTemplate);
  });

  it('keeps an engine without regional sites on its own site', () => {
    const google = findSearchEngineByHostname('www.google.co.jp');
    if (!google) throw new Error('no Google engine');

    expect(google.id).toBe('google');
    expect(searchTemplateOn(google, 'www.google.co.jp')).toBe('https://www.google.com/search?q={query}');
  });
});
