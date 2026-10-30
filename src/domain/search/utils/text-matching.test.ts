import { describe, expect, it } from 'vitest';
import { collectSearchMatches } from './navigation-matching';
import { matchesSearchQueryText } from './query-intent';
import { calculateSearchRelevanceScore } from './relevance-score';
import { buildSearchQueryContext } from './selection-stats';
import { createSearchTextMatcher, getSearchTitleHighlightRanges } from './text-matching';
import { expandSearchFuzzyPinyinReadings, splitSearchTitleTokens } from './text-normalize';
import { pinyin } from 'pinyin-pro';
import { HAN_VARIANT_PAIRS } from '../han-variants.generated';
import { installHanVariantPairs } from '../han-variants';

// How local search matches a title: short terms, pinyin, initials and words
// spelled across spaces, pieces, fuzzy pinyin, Han queries against
// addresses, and titles in other scripts. The surfaces' use of it is tested
// in tests/pages/search/.

installHanVariantPairs(HAN_VARIANT_PAIRS);

const RANKING = { isLocalNetworkHost: () => false, isOwnExtensionUrl: () => false };

function score(item: { title: string; url: string }, query: string, sourceType = 'history'): number {
  return calculateSearchRelevanceScore(item, sourceType, buildSearchQueryContext(query), RANKING);
}

const readings = (character: string): string[] => pinyin(character, { toneType: 'none', type: 'array', multiple: true, v: true });
const pinyinOptions = {
  titleMatcher: createSearchTextMatcher({ getHanReadings: (_text, characters) => characters.map(readings) })
};
const fuzzyOptions = {
  titleMatcher: createSearchTextMatcher({
    getHanReadings: (_text, characters) => characters.map((character) => expandSearchFuzzyPinyinReadings(readings(character)))
  })
};

function matchesWithPinyin(query: string, title: string, options = pinyinOptions): boolean {
  return matchesSearchQueryText({ title, url: 'https://example.com/page' }, buildSearchQueryContext(query), options);
}

function highlightWithPinyin(query: string, title: string): string[] {
  return getSearchTitleHighlightRanges(title, buildSearchQueryContext(query), pinyinOptions)
    .map(([start, end]) => title.slice(start, end));
}

const matchesFuzzy = (query: string, title: string) => matchesWithPinyin(query, title, fuzzyOptions);

const hostSpellingContext = (query: string, spellings: string[]) => ({
  ...buildSearchQueryContext(query),
  queryHostSpellings: spellings
});

const pinyinScore = (query: string, title: string) => calculateSearchRelevanceScore(
  { title, url: 'https://example.com/page' },
  'history',
  buildSearchQueryContext(query),
  { ...pinyinOptions, ...RANKING }
);

describe('search title matching', () => {
  it("matches a short ASCII term only at a word, an initial or an embedded run, which splits into title tokens", () => {
    const shortAsciiContext = buildSearchQueryContext('x');
    expect(matchesSearchQueryText({ title: 'Example Docs', url: 'https://example.com/docs' }, shortAsciiContext), 'short ASCII terms should not match by loose contains').toBe(false);
    expect(matchesSearchQueryText({ title: 'X Home', url: 'https://example.com/' }, shortAsciiContext), 'short ASCII terms should still match title tokens').toBe(true);
    expect(matchesSearchQueryText(
        { title: 'Final Cut Camera', url: 'https://apps.apple.com/final-cut-camera' },
        buildSearchQueryContext('fcc')
      ), 'short ASCII terms should match multi-word title initials').toBe(true);
    expect(matchesSearchQueryText(
        { title: 'SwitchBot', url: 'https://switchbot.example.com/' },
        buildSearchQueryContext('sb')
      ), 'short ASCII terms should match camel-case title initials').toBe(true);
    expect(matchesSearchQueryText(
        { title: 'Final Cut Camera', url: 'https://apps.apple.com/final-cut-camera' },
        buildSearchQueryContext('fcx')
      ), 'title initials should not match unrelated letter combinations').toBe(false);
    expect(matchesSearchQueryText(
        { title: '移动4A平台', url: 'https://portal.example.com/' },
        buildSearchQueryContext('4A')
      ), 'short letter-digit terms should match a run embedded in Chinese titles').toBe(true);
    expect(matchesSearchQueryText(
        { title: '中国移动5G套餐', url: 'https://example.com/plans' },
        buildSearchQueryContext('5g')
      ), 'short letter-digit terms should match a mid-title run between Chinese characters').toBe(true);
    expect(matchesSearchQueryText(
        { title: '移动14A平台', url: 'https://portal.example.com/' },
        buildSearchQueryContext('4a')
      ), 'embedded runs should match from their start, not anywhere inside').toBe(false);
    expect(score({ title: '移动4A平台', url: 'https://portal.example.com/' }, '4A', 'bookmark') > 0, 'a Chinese title with an embedded short term should score as a match').toBeTruthy();
    expect(splitSearchTitleTokens('移动4a平台 home'), 'title tokens should keep whole tokens and add runs embedded in Chinese text').toEqual(['移动4a平台', 'home', '4a', '4', 'a']);
  });

  it("matches pinyin, initials and words spelled across spaces, case and digits", () => {
    [
      ['wxds', '微信读书', 'pinyin initials'],
      ['wxdushu', '微信读书', 'initials followed by full pinyin'],
      ['weixinds', '微信读书', 'full pinyin followed by initials'],
      ['txsp', '腾讯视频', 'initials of every character'],
      ['shipin', '腾讯视频', 'full pinyin in the middle of a title'],
      ['zhongq', '重庆火锅', 'full pinyin followed by the next initial'],
      ['xs', 'Google 学术', 'initials after a space before Han text'],
      ['台湾', '臺灣銀行', 'simplified characters for a traditional title'],
      ['臺灣', '台湾银行', 'traditional characters for a simplified title'],
      ['wysj', '網頁設計教程', 'pinyin initials of traditional characters'],
      ['lvse', '绿色出行', 'ü typed as v'],
      ['luse', '绿色出行', 'ü typed as u'],
      ['zhongqing', '重庆火锅', 'any reading of a polyphone'],
      ['chongqing', '重庆火锅', 'the usual reading of a polyphone'],
      ['wx读书', '微信读书', 'pinyin mixed with Han characters'],
      ['gh ck', 'GitHub 仓库设置', 'Latin initials followed by pinyin initials'],
      ['ck github', 'GitHub 仓库设置', 'separate terms in any order'],
      ['bz', 'B站 哔哩哔哩', 'a Latin letter next to a Han character'],
      ['yd4a', '移动4A平台', 'pinyin initials followed by an embedded run'],
      ['iphone15', 'iPhone 15 Pro', 'a word and digits typed without the space'],
      ['iphone 15', 'iPhone15 Pro', 'a word and digits typed with a space'],
      ['ps5', 'PS 5 游戏', 'letters and a digit across a space'],
      ['vscode', 'Visual Studio Code', 'initials followed by a whole word'],
      ['ai', 'OpenAI ChatGPT', 'a short term at a camel-case word'],
      ['ｇｉｔｈｕｂ', 'GitHub', 'full-width letters'],
      ['cafe', 'Café Paris', 'letters without their accents'],
      ['微信读书', '微信 读书', 'Han characters across a space']
    ].forEach(([query, title, label]) => {
      expect(matchesWithPinyin(query, title), `"${query}" should match "${title}" (${label})`).toBe(true);
    });
  });

  it("does not match inside a syllable or a word, or initials that skip", () => {
    [
      ['ai', '我在杭州开会', 'a short query inside a syllable'],
      ['an', '看电影', 'a short query inside a syllable'],
      ['de', '我的世界', 'a short syllable in the middle of a title'],
      ['ai', 'Detail page', 'a short term inside a word'],
      ['ouba', '豆包书签', 'pinyin that starts inside a syllable'],
      ['wd', '微信读书', 'initials that skip a character'],
      ['vsc', 'Download Visual Studio Code', 'Latin initials in the middle of a phrase'],
      ['sp', '腾讯视频', 'initials in the middle of a title'],
      ['js', '前端技术分享', 'English initials that read as Han initials'],
      ['cs', '自动化测试', 'English initials that read as Han initials'],
      ['pin', '中文拼音', 'a lone syllable in the middle of a title'],
      ['the', '他和她', 'an English word read as an initial and a syllable'],
      ['and', '我按的时候', 'an English word read as a syllable and an initial inside a title']
    ].forEach(([query, title, label]) => {
      expect(matchesWithPinyin(query, title), `"${query}" should not match "${title}" (${label})`).toBe(false);
    });
  });

  it("matches a query found in the title only in pieces, and marks each piece", () => {
    [
      ['飞书文档', '飞书云文档', 'Han pieces with a character between them'],
      ['飞书文档', '文档 - 飞书', 'Han pieces in the other order'],
      ['飛書文檔', '飞书云文档', 'traditional pieces'],
      ['feishuwendang', '飞书云文档', 'pinyin pieces'],
      ['飞书wendang', '飞书云文档', 'a Han piece and a pinyin piece'],
      ['中国银行', '中国建设银行', 'pieces around another word'],
      ['zhongguoyinhang', '中国建设银行', 'pinyin pieces around another word'],
      ['docs飞书', '飞书 Docs', 'a Latin piece next to a Han piece']
    ].forEach(([query, title, label]) => {
      expect(matchesWithPinyin(query, title), `"${query}" should match "${title}" (${label})`).toBe(true);
    });
    [
      ['飞书文档', '飞机书籍文档', 'single characters scattered through a title'],
      ['中国银行', '美国银行', 'a query character the title does not have'],
      ['飞书云文档', '飞书文档', 'a query character the title does not have'],
      ['哔哩哔哩', '哔哩 bilibili', 'two pieces that would share the same characters'],
      ['fswd', '飞书云文档', 'an initials piece inside a phrase'],
      ['notebook', 'Book notes', 'English words without spaces']
    ].forEach(([query, title, label]) => {
      expect(matchesWithPinyin(query, title), `"${query}" should not match "${title}" (${label})`).toBe(false);
    });
    expect(highlightWithPinyin('飞书文档', '飞书云文档'), 'a match in pieces should mark each piece').toEqual(['飞书', '文档']);
  });

  it("reads the sounds fuzzy pinyin treats as one only when it is on", () => {
    expect(expandSearchFuzzyPinyinReadings(['zhong', 'lan', 'ning']), 'fuzzy pinyin should swap z/zh, n/l and an/ang, in/ing while keeping ong').toEqual(['zhong', 'zong', 'lan', 'lang', 'nan', 'nang', 'ning', 'nin', 'ling', 'lin']);
    expect(matchesFuzzy('zongguo', '中国银行'), 'fuzzy pinyin should read zh as z').toBe(true);
    expect(matchesFuzzy('xingyongka', '信用卡'), 'fuzzy pinyin should read in as ing').toBe(true);
    expect(matchesFuzzy('lanjing', '南京路'), 'fuzzy pinyin should read n as l and an as an').toBe(true);
    expect(matchesWithPinyin('zongguo', '中国银行'), 'exact pinyin should keep z and zh apart').toBe(false);
  });

  it("matches a Han query against an address spelled in its pinyin or initials, as a whole label", () => {
    expect(matchesSearchQueryText(
        { title: 'Zhihu', url: 'https://www.zhihu.com/' },
        hostSpellingContext('知乎', ['zhihu', 'zh']),
        pinyinOptions
      ), 'a Han query should match a site address spelled in its pinyin').toBe(true);
    expect(matchesSearchQueryText(
        { title: 'JD.com', url: 'https://www.jd.com/' },
        hostSpellingContext('京东', ['jingdong', 'jd']),
        pinyinOptions
      ), 'a Han query should match a site address spelled in its initials').toBe(true);
    expect(matchesSearchQueryText(
        { title: 'Zhihu Daily', url: 'https://daily.zhihuapp.com/' },
        hostSpellingContext('知乎', ['zhihu', 'zh']),
        pinyinOptions
      ), 'a Han query should only match a whole address label').toBe(false);
  });

  it("marks what a match spelled", () => {
    expect(matchesWithPinyin('vsc', 'Home - Visual Studio Code'), 'Latin initials should match from the start of a title segment').toBe(true);
    expect(highlightWithPinyin('shipin', '腾讯视频 - 在线视频'), 'a pinyin match should mark the characters it spelled').toEqual(['视频']);
    expect(highlightWithPinyin('台湾', '臺灣銀行'), 'a simplified query should mark the traditional characters it matched').toEqual(['臺灣']);
    expect(highlightWithPinyin('gh ck', 'GitHub 仓库设置'), 'a mixed initials match should mark each letter and character it used').toEqual(['G', 'H', '仓库']);
    expect(highlightWithPinyin('ai', 'Detail of OpenAI'), 'a short term should be marked only where a word starts').toEqual(['AI']);
    expect(highlightWithPinyin('ｇｉｔ', 'GitHub'), 'folded query text should mark the original characters').toEqual(['Git']);
  });

  it("ranks one run over pieces, the title start over its middle, and gains nothing for a literal match", () => {
    expect(pinyinScore('飞书文档', '飞书文档 - 协作') > pinyinScore('飞书文档', '飞书云文档') &&
        pinyinScore('飞书文档', '飞书云文档') > pinyinScore('飞书文档', '文档 - 飞书'), 'one run should outrank pieces, and pieces in order should outrank pieces out of order').toBeTruthy();
    expect(pinyinScore('wxds', '微信读书') > pinyinScore('wxds', '我的微信读书笔记'), 'a pinyin match at the start of a title should outrank one in its middle').toBeTruthy();
    expect(pinyinScore('github', 'GitHub') === score({ title: 'GitHub', url: 'https://example.com/page' }, 'github'), 'a title that holds the query as typed should gain nothing from unit matching').toBeTruthy();
  });

  it("looks up no pinyin for a query of Han characters", () => {
    let hanReadingLookups = 0;
    const countingMatcher = createSearchTextMatcher({
      getHanReadings: (text, characters) => {
        hanReadingLookups += 1;
        return characters.map(() => []);
      }
    });
    collectSearchMatches(
      [{ title: '微信 读书', url: 'https://example.com/' }],
      buildSearchQueryContext('微信读书'),
      [],
      { titleMatcher: countingMatcher }
    );
    expect(hanReadingLookups, 'a query of Han characters should not look up pinyin readings').toBe(0);

    expect(splitSearchTitleTokens('OpenAI iPhone15 HTMLParser'), 'title tokens should add the camel-case words and digit runs inside each token').toEqual(['openai', 'iphone15', 'htmlparser', 'open', 'ai', 'i', 'phone', '15', 'html', 'parser']);
  });

});
