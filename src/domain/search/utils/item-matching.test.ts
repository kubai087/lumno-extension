import { describe, expect, it } from 'vitest';
import { getSearchHostNameLabels } from './item-matching';
import { promoteStrongNavigationMatch } from './navigation-matching';
import { matchesSearchQueryText } from './query-intent';
import { calculateSearchRelevanceScore } from './relevance-score';
import { buildSearchQueryContext } from './selection-stats';
import { createSearchTextMatcher } from './text-matching';
import { pinyin } from 'pinyin-pro';
import { HAN_VARIANT_PAIRS } from '../han-variants.generated';
import { installHanVariantPairs } from '../han-variants';
import { readSearchTitleHanReadings, readSearchUsualHanReadings } from '../pinyin-api';
import type { PinyinApi } from '../pinyin-api';

// Where a page shows a query: the title, the labels that name its host and
// its path, never its top-level domain, "www" or query string, and inside a
// word only for a term of four letters or more.

installHanVariantPairs(HAN_VARIANT_PAIRS);

const pinyinApi: PinyinApi = { pinyin: (text, options) => pinyin(text, options) };
const options = {
  titleMatcher: createSearchTextMatcher({
    getHanReadings: (text, characters) => readSearchTitleHanReadings(
      pinyinApi, text, characters, (character) => readSearchUsualHanReadings(pinyinApi, character)
    )
  })
};

function matches(query: string, title: string, url: string): boolean {
  return matchesSearchQueryText({ title, url }, buildSearchQueryContext(query), options);
}

function score(query: string, title: string, url: string): number {
  return calculateSearchRelevanceScore({ title, url }, 'history', buildSearchQueryContext(query), {
    ...options,
    isLocalNetworkHost: () => false,
    isOwnExtensionUrl: () => false
  });
}

describe('search item matching', () => {
  it('names a host by its own labels, without www, m or its public suffix', () => {
    expect(getSearchHostNameLabels('www.google.com')).toEqual(['google']);
    expect(getSearchHostNameLabels('www.bbc.co.uk')).toEqual(['bbc']);
    expect(getSearchHostNameLabels('gwbn.net.cn')).toEqual(['gwbn']);
    expect(getSearchHostNameLabels('m.example.com')).toEqual(['example']);
    expect(getSearchHostNameLabels('docs.spring.io')).toEqual(['docs', 'spring']);
    expect(getSearchHostNameLabels('dev.to')).toEqual(['dev']);
    expect(getSearchHostNameLabels('localhost')).toEqual(['localhost']);
    expect(getSearchHostNameLabels('192.168.1.10')).toEqual(['192', '168', '1', '10']);
  });

  it('does not match a top-level domain, www or the scheme', () => {
    [
      ['co', 'Google', 'https://www.google.com/', 'a .com site for "co"'],
      ['com', 'YouTube', 'https://www.youtube.com/', 'a .com site for "com"'],
      ['ai', 'Claude', 'https://claude.ai/new', 'a .ai site for "ai"'],
      ['dev', 'Learn React', 'https://react.dev/learn', 'a .dev site for "dev"'],
      ['org', 'Coursera', 'https://www.coursera.org/', 'a .org site for "org"'],
      ['uk', 'BBC News', 'https://www.bbc.co.uk/news', 'a country code'],
      ['www', 'Google', 'https://www.google.com/', 'the www label'],
      ['http', 'Google', 'https://www.google.com/', 'the scheme']
    ].forEach(([query, title, url, label]) => {
      expect(matches(query, title, url), `"${query}" should not match ${url} (${label})`).toBe(false);
    });
    expect(matches('dev', 'Mastering Async JavaScript', 'https://dev.to/async'), 'a label that names the site should match').toBe(true);
    expect(matches('bbc', 'News', 'https://www.bbc.co.uk/news'), 'the name in front of a registry suffix should match').toBe(true);
  });

  it('does not match a query string, and reads a single-page route as the path', () => {
    expect(matches('map', 'The Best Coffee', 'https://blog.example.net/coffee?utm_campaign=map'), 'a query string parameter should not match').toBe(false);
    expect(matches('abc', 'Order confirmation', 'https://shop.example.com/orders/1?ref=email_abc123'), 'a tracking value should not match').toBe(false);
    expect(matches('inbox', 'Mail', 'https://app.example.com/#/inbox'), 'a "#/" route should match as the path').toBe(true);
    expect(matches('48213', 'Order', 'https://shop.example.com/orders/48213'), 'a number in the path should match').toBe(true);
    expect(matches('en', 'Reference', 'https://developer.example.org/en-US/docs/'), 'a two-letter path word should not match').toBe(false);
  });

  it('matches inside a word only for four letters or more', () => {
    [
      ['art', 'Education Department', 'https://www.ed.gov/'],
      ['ear', 'Learn React', 'https://react.dev/learn'],
      ['ing', 'Spring Boot Reference', 'https://docs.spring.io/spring-boot/'],
      ['cat', 'Location settings', 'https://example.org/settings/location'],
      ['hub', 'Repositories', 'https://github.com/']
    ].forEach(([query, title, url]) => {
      expect(matches(query, title, url), `"${query}" should not match inside a word of "${title}" or ${url}`).toBe(false);
    });
    expect(matches('tube', 'Home', 'https://www.youtube.com/'), 'four letters inside a host label should match').toBe(true);
    expect(matches('mail', 'Gmail', 'https://example.com/'), 'four letters inside a title word should match').toBe(true);
    expect(matches('hub', 'GitHub', 'https://github.com/'), 'a camel-case word start should match').toBe(true);
    expect(matches('how to center', 'how to center a div - Google 搜索', 'https://www.google.com/search?q=x'), 'a phrase at a word start should match').toBe(true);
  });

  it('matches an address as typed, from the start of the host or a path segment', () => {
    expect(matches('github.com/kub', 'Pull requests', 'https://github.com/Kubai087/lumno-extension/pulls'), 'a typed address prefix should match').toBe(true);
    expect(matches('https://github.com', 'GitHub', 'https://github.com/'), 'a typed scheme should be read past').toBe(true);
    expect(matches('localhost:3000', 'Dashboard', 'http://localhost:3000/dashboard'), 'a host and port should match').toBe(true);
    expect(matches('3000', 'Dashboard', 'http://localhost:3000/'), 'a port should match').toBe(true);
    expect(matches('ub.com', 'GitHub', 'https://github.com/'), 'an address fragment inside a label should not match').toBe(false);
  });

  it('reads a Han character as it is said in the title or as usually said, not by rare readings', () => {
    expect(matches('heping', '和平精英官网', 'https://gp.qq.com/'), 'the reading in the title should match').toBe(true);
    expect(matches('hp', '和平精英官网', 'https://gp.qq.com/'), 'its initials should match').toBe(true);
    expect(matches('huping', '和平精英官网', 'https://gp.qq.com/'), 'a rare reading should not match').toBe(false);
    expect(matches('cenkao', '参考资料', 'https://example.cn/'), 'a third reading should not match').toBe(false);
    expect(matches('chongqing', '重庆火锅', 'https://example.cn/'), 'the reading in the title should match').toBe(true);
    expect(matches('zhongqing', '重庆火锅', 'https://example.cn/'), 'the usual reading should match').toBe(true);
    expect(matches('yinxing', '中国银行', 'https://www.boc.cn/'), 'the usual reading of 行 should match').toBe(true);
    expect(matches('yinhang', '中国银行', 'https://www.boc.cn/'), 'the reading of 行 in 银行 should match').toBe(true);
  });

  it('keeps a polyphone\'s second usual reading for words pinyin-pro reads wrong', () => {
    expect(matches('huankuan', '信用卡还款计划', 'https://example.cn/'), '还 in 还款 should read huan').toBe(true);
    expect(matches('chailv', '差旅报销', 'https://example.cn/'), '差 in 差旅 should read chai').toBe(true);
    expect(matches('hangzhang', '行长讲话', 'https://example.cn/'), '长 in 行长 should read zhang').toBe(true);
    expect(matches('haikuan', '信用卡还款计划', 'https://example.cn/'), 'the usual reading should still match').toBe(true);
  });

  it('matches a number whole, or from the start of the host', () => {
    expect(matches('163', 'Music', 'https://music.163.com/'), 'a number label should match whole').toBe(true);
    expect(matches('16', 'Music', 'https://music.163.com/'), 'a number should not match the start of a later label').toBe(false);
    expect(matches('19', 'Router', 'http://192.168.1.1/'), 'a number should match the start of an IP address').toBe(true);
    expect(matches('16', 'Router', 'http://192.168.1.1/'), 'a number should not match inside an IP address').toBe(false);
    expect(matches('168', 'Router', 'http://192.168.1.1/'), 'a number should not match a later part of an IP address').toBe(false);
    expect(matches('1234', 'Zoom', 'https://us02web.zoom.us/j/123456789'), 'a number should not match the start of a path ID').toBe(false);
  });

  it('does not match an extension ID or a query of punctuation alone', () => {
    expect(matches('a', 'Options', 'chrome-extension://abcdefghijklmnopabcdefghijklmnop/options.html'), 'an extension ID should not match').toBe(false);
    expect(matches('options', 'Settings', 'chrome-extension://abcdefghijklmnopabcdefghijklmnop/options.html'), 'an extension page should match by its path').toBe(true);
    ['-', '?', '/', '|'].forEach((query) => {
      expect(matches(query, 'GitHub - Pull requests | Repo?', 'https://github.com/a/b'), `"${query}" should match nothing`).toBe(false);
    });
  });

  it('does not run initials across punctuation, only whole words', () => {
    expect(matches('dd', 'Dribbble - Discover the World', 'https://example.com/'), 'initials should not run across " - "').toBe(false);
    expect(matches('cl', '天猫tmall.com--理想生活', 'https://example.com/'), 'initials should not run across "--"').toBe(false);
    expect(matches('wifi', 'Wi-Fi settings', 'https://example.com/'), 'whole words should run across a hyphen').toBe(true);
    expect(matches('gpt4', 'GPT-4 Technical Report', 'https://example.com/'), 'a word and a number should run across a hyphen').toBe(true);
    expect(matches('wxds', '微信读书 - 正版书籍', 'https://example.com/'), 'initials before the punctuation should still match').toBe(true);
  });

  it('gives a page found only inside its words no lift as the site the query names', () => {
    const insideRoot = score('sign', 'Dribbble - Discover the World’s Top Designers', 'https://dribbble.com/');
    const wordPage = score('sign', 'Sign up for the newsletter', 'https://example.com/newsletter/subscribe');
    expect(insideRoot < wordPage, 'a site root showing "sign" inside a word should rank below a page whose title starts with it').toBe(true);
    const list = [
      { type: 'history', title: 'Dribbble - Discover the World', url: 'https://dribbble.com/' },
      { type: 'history', title: 'Release notes', url: 'https://example.com/notes/overview-2' }
    ];
    expect(promoteStrongNavigationMatch(list, 'over'), 'a title holding the query inside a word should not be promoted').toBe(null);
  });
});
