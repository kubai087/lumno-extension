import { describe, expect, it } from 'vitest';
import { compareProgressPages, looksLikeSeriesPage, shouldAdvance } from './progress-match';
import type { ProgressComparison, ProgressPage } from './progress-match';
import { readTitle } from './progress-title-compare';

const page = (url: string, title = ''): ProgressPage => ({ url, title });

type Case = [string, ProgressPage, ProgressPage, Partial<ProgressComparison>];

function expectComparison(current: ProgressPage, candidate: ProgressPage, expected: Partial<ProgressComparison>): ProgressComparison {
  const actual = compareProgressPages(current, candidate);
  expect(actual).toMatchObject(expected);
  return actual;
}

const forwardHigh: Partial<ProgressComparison> = { match: true, confidence: 'high', direction: 'forward' };
const forwardMedium: Partial<ProgressComparison> = { match: true, confidence: 'medium', direction: 'forward' };

describe('progress matching', () => {
  const urlCases: Case[] = [
    ['the next vidhub3 episode', page('https://vidhub3.top/vodplay/55357-1-1.html'), page('https://vidhub3.top/vodplay/55357-1-2.html'), forwardHigh],
    ['bilibili p=2 after the first part', page('https://www.bilibili.com/video/BV11LEA6eEuj/'), page('https://www.bilibili.com/video/BV11LEA6eEuj?p=2'), forwardHigh],
    ['bilibili p=2 to p=3', page('https://www.bilibili.com/video/BV11LEA6eEuj?p=2'), page('https://www.bilibili.com/video/BV11LEA6eEuj?p=3'), forwardHigh],
    ['bilibili with sharing parameters', page('https://www.bilibili.com/video/BV11LEA6eEuj?p=2&spm_id_from=333.788'), page('https://www.bilibili.com/video/BV11LEA6eEuj?p=3&vd_source=abc&t=42'), forwardHigh],
    ['the next shencou chapter of the same book', page('https://m.shencou.com/chapter.php?aid=993&cid=53107'), page('https://m.shencou.com/chapter.php?aid=993&cid=53108'), forwardHigh],
    ['the second page of a bilinovel chapter', page('https://www.bilinovel.com/novel/2013/72035.html'), page('https://www.bilinovel.com/novel/2013/72035_2.html'), forwardHigh],
    ['the next bilinovel chapter without titles', page('https://www.bilinovel.com/novel/2013/72035_3.html'), page('https://www.bilinovel.com/novel/2013/72036.html'), { match: false, reason: 'insufficient' }],
    ['the next bilinovel chapter with the work in the title',
      page('https://www.bilinovel.com/novel/2013/72035_3.html', '某轻小说 第一章 开端（3/3）_哔哩轻小说'),
      page('https://www.bilinovel.com/novel/2013/72036.html', '某轻小说 第二章 转折_哔哩轻小说'), forwardMedium],
    ['opaque faxiantv share ids with matching titles',
      page('https://faxiantv.cc/player.php?share=aae5ca3dda55', '某剧 第1集 - 发现TV'),
      page('https://faxiantv.cc/player.php?share=f3a3ce602a22', '某剧 第2集 - 发现TV'), forwardMedium]
  ];

  it.each(urlCases)('follows %s', (_name, current, candidate, expected) => {
    expectComparison(current, candidate, expected);
  });

  const samePageCases: Case[] = [
    ['Emby, which keeps one URL for every episode',
      page('https://media.nijigem.by/web/index.html#!/videoosd/videoosd.html', 'Emby'),
      page('https://media.nijigem.by/web/index.html#!/videoosd/videoosd.html', 'Emby'), { match: false, reason: 'same-page' }],
    ['WeRead, which keeps one URL for the whole book',
      page('https://weread.qq.com/web/reader/ce7325b0813ab9558g014d3a'),
      page('https://weread.qq.com/web/reader/ce7325b0813ab9558g014d3a'), { match: false, reason: 'same-page' }],
    ['an Emby hash route, which is a page rather than an anchor',
      page('https://media.nijigem.by/web/index.html#!/videoosd/videoosd.html'),
      page('https://media.nijigem.by/web/index.html#!/home.html'), { match: false }]
  ];

  it.each(samePageCases)('has nothing to move the card to on %s', (_name, current, candidate, expected) => {
    expectComparison(current, candidate, expected);
  });

  const otherWorkCases: Case[] = [
    ['another work with the same URL template',
      page('https://vidhub3.top/vodplay/55357-1-2.html', '某剧 第2集'),
      page('https://vidhub3.top/vodplay/60001-1-1.html', '另一部剧 第1集'), { match: false, reason: 'insufficient' }],
    ['another book on shencou',
      page('https://m.shencou.com/chapter.php?aid=993&cid=53107', '书A 第一章'),
      page('https://m.shencou.com/chapter.php?aid=1000&cid=60000', '书B 第一章'), { match: false }],
    ['a recommended bilibili video',
      page('https://www.bilibili.com/video/BV11LEA6eEuj?p=2', '合集名 P2 第二集_哔哩哔哩_bilibili'),
      page('https://www.bilibili.com/video/BV1xx411c7mD', '完全无关的视频_哔哩哔哩_bilibili'), { match: false }],
    ['the site home page', page('https://www.bilibili.com/video/BV11LEA6eEuj?p=2'), page('https://www.bilibili.com/'), { match: false, reason: 'structure-mismatch' }],
    ['the detail page of the same work', page('https://vidhub3.top/vodplay/55357-1-1.html'), page('https://vidhub3.top/voddetail/55357.html'), { match: false }],
    ['a search page with a text query', page('https://vidhub3.top/vodplay/55357-1-1.html'), page('https://vidhub3.top/vodplay/55357-1-1.html?wd=柯南'), { match: false, reason: 'structure-mismatch' }],
    ['opaque ids with one generic title',
      page('https://faxiantv.cc/player.php?share=aae5ca3dda55', '发现TV 在线播放'),
      page('https://faxiantv.cc/player.php?share=f3a3ce602a22', '发现TV 在线播放'), { match: false }],
    ['another site', page('https://vidhub3.top/vodplay/55357-1-1.html'), page('https://vidhub4.top/vodplay/55357-1-2.html'), { match: false, reason: 'site-mismatch' }],
    ['the next GitHub issue',
      page('https://github.com/Kubai087/lumno-extension/issues/123', 'Fix the bug · Issue #123'),
      page('https://github.com/Kubai087/lumno-extension/issues/124', 'Add a feature · Issue #124'), { match: false }],
    ['a jump from episode 3 to 57 with nothing but the URL', page('https://vidhub3.top/vodplay/55357-1-3.html'), page('https://vidhub3.top/vodplay/55357-1-57.html'), { match: false }]
  ];

  it.each(otherWorkCases)('does not match %s', (_name, current, candidate, expected) => {
    expectComparison(current, candidate, expected);
  });

  it('matches a collection whose episodes are separate videos by their titles', () => {
    expectComparison(
      page('https://www.bilibili.com/video/BV11LEA6eEuj', '合集名 第1集_哔哩哔哩_bilibili'),
      page('https://www.bilibili.com/video/BV1xx411c7mD', '合集名 第2集_哔哩哔哩_bilibili'),
      forwardMedium
    );
  });

  it('treats the www host as the same site', () => {
    expectComparison(page('https://bilibili.com/video/BV11LEA6eEuj?p=2'), page('https://www.bilibili.com/video/BV11LEA6eEuj?p=3'), { match: true, confidence: 'high' });
  });

  it('matches a big jump when the titles name the same show', () => {
    expectComparison(
      page('https://vidhub3.top/vodplay/55357-1-3.html', '某剧 第3集'),
      page('https://vidhub3.top/vodplay/55357-1-57.html', '某剧 第57集'),
      { match: true, direction: 'forward' }
    );
  });

  it('keeps an issue or a forum thread put even when clicked from the card', () => {
    const link = { fromCurrent: true, transition: 'link' };
    expect(compareProgressPages(
      page('https://github.com/Kubai087/lumno-extension/issues/123', 'Fix the bug · Issue #123'),
      page('https://github.com/Kubai087/lumno-extension/issues/124', 'Add a feature · Issue #124'),
      link
    ).match).toBe(false);
    expect(compareProgressPages(
      page('https://www.v2ex.com/t/1012345', '如何选择笔记本 - V2EX'),
      page('https://www.v2ex.com/t/1012346', '另一个帖子 - V2EX'),
      link
    ).match).toBe(false);
  });

  it('continues with an opaque next page clicked from the card, but not with one typed or reached elsewhere', () => {
    const current = page('https://faxiantv.cc/player.php?share=aae5ca3dda55', '发现TV 在线播放');
    const candidate = page('https://faxiantv.cc/player.php?share=f3a3ce602a22', '发现TV 在线播放');
    const clicked = compareProgressPages(current, candidate, { fromCurrent: true, transition: 'link' });
    expect(clicked.match).toBe(true);
    expect(clicked.factors.some((factor) => factor.signal === 'navigated-from-card')).toBe(true);
    expect(compareProgressPages(current, candidate, { fromCurrent: true, transition: 'typed' }).match).toBe(false);
    expect(compareProgressPages(current, candidate, { fromCurrent: false }).match).toBe(false);
  });

  it('does not continue with a recommended show clicked from the card', () => {
    expect(compareProgressPages(
      page('https://vidhub3.top/vodplay/55357-1-2.html', '某剧 第2集'),
      page('https://vidhub3.top/vodplay/60001-1-1.html', '另一部剧 第1集'),
      { fromCurrent: true, transition: 'link' }
    ).match).toBe(false);
  });

  it('follows the page links even when the URL shape changes', () => {
    const next = compareProgressPages(
      page('https://www.bilinovel.com/novel/2013/72035_3.html', '第一章'),
      page('https://www.bilinovel.com/novel/2013/vol2/1.html', '第二卷 第一章'),
      { currentHints: { nextUrls: ['https://www.bilinovel.com/novel/2013/vol2/1.html#top'] } }
    );
    expect(next).toMatchObject(forwardHigh);

    const viaPrevious = compareProgressPages(
      page('https://faxiantv.cc/player.php?share=aae5ca3dda55', '发现TV 在线播放'),
      page('https://faxiantv.cc/player.php?share=f3a3ce602a22', '发现TV 在线播放'),
      { candidateHints: { prevUrls: ['https://faxiantv.cc/player.php?share=aae5ca3dda55'] } }
    );
    expect(viaPrevious).toMatchObject({ match: true, direction: 'forward' });
  });

  it('recognises following the previous link but never rewinds the card', () => {
    const back = compareProgressPages(
      page('https://faxiantv.cc/player.php?share=f3a3ce602a22', '发现TV 在线播放'),
      page('https://faxiantv.cc/player.php?share=aae5ca3dda55', '发现TV 在线播放'),
      { currentHints: { prevUrls: ['https://faxiantv.cc/player.php?share=aae5ca3dda55'] } }
    );
    expect(back.match).toBe(true);
    expect(shouldAdvance(back)).toBe(false);
  });

  it('reads the work from structured metadata, which outweighs a click', () => {
    const current = page('https://faxiantv.cc/player.php?share=aae5ca3dda55', '发现TV 在线播放');
    const candidate = page('https://faxiantv.cc/player.php?share=f3a3ce602a22', '发现TV 在线播放');
    expect(compareProgressPages(current, candidate, {
      currentHints: { seriesName: '某剧' }, candidateHints: { seriesName: '某剧', episode: 2 }, currentEpisode: 1
    }).direction).toBe('forward');
    expect(compareProgressPages(current, candidate, {
      currentHints: { seriesName: '某剧' }, candidateHints: { seriesName: '另一部剧' }, fromCurrent: true
    }).match).toBe(false);
  });

  it('follows titles that lead with the episode', () => {
    expectComparison(
      page('https://faxiantv.cc/player.php?share=aae5ca3dda55', '第2集 消失的约定 - 某剧 - 发现TV'),
      page('https://faxiantv.cc/player.php?share=f3a3ce602a22', '第3集 新的开始 - 某剧 - 发现TV'),
      { match: true, direction: 'forward' }
    );
  });

  it('recognises going back to an earlier episode, page or titled episode without advancing the card', () => {
    const backward: Partial<ProgressComparison> = { match: true, direction: 'backward' };
    const rewatch = expectComparison(page('https://vidhub3.top/vodplay/55357-1-12.html'), page('https://vidhub3.top/vodplay/55357-1-3.html'), backward);
    const reread = expectComparison(page('https://www.bilinovel.com/novel/2013/72035_2.html'), page('https://www.bilinovel.com/novel/2013/72035.html'), backward);
    const titleRewind = expectComparison(
      page('https://faxiantv.cc/player.php?share=f3a3ce602a22', '某剧 第十二集'),
      page('https://faxiantv.cc/player.php?share=aae5ca3dda55', '某剧 第三集'),
      backward
    );
    expect(shouldAdvance(rewatch)).toBe(false);
    expect(shouldAdvance(reread)).toBe(false);
    expect(shouldAdvance(titleRewind)).toBe(false);
  });

  it('advances the card to the next episode', () => {
    expect(shouldAdvance(compareProgressPages(page('https://vidhub3.top/vodplay/55357-1-1.html'), page('https://vidhub3.top/vodplay/55357-1-2.html')))).toBe(true);
  });
});

describe('progress title reading', () => {
  it('reads the work and the episode from a title', () => {
    expect({ ...readTitle('名侦探柯南 第1128集_高清在线观看') }).toEqual({ workName: '名侦探柯南', episode: 1128, hasMarker: true });
    expect(readTitle('某剧 第二十三集').episode).toBe(23);
    expect(readTitle('Some Show - Episode 4 | Site').workName).toBe('some show');
  });
});

describe('series pages', () => {
  const seriesPages: Array<[string, string]> = [
    ['https://vidhub3.top/vodplay/55357-1-1.html', ''],
    ['https://www.bilibili.com/video/BV11LEA6eEuj?p=2', ''],
    ['https://www.bilibili.com/video/BV11LEA6eEuj/', '饼干童子军 第1集'],
    ['https://www.bilibili.com/bangumi/play/ep123456', ''],
    ['https://m.shencou.com/chapter.php?aid=993&cid=53107', ''],
    ['https://www.bilinovel.com/novel/2013/72035.html', ''],
    ['https://www.bilinovel.com/novel/2013/72035_2.html', ''],
    ['https://faxiantv.cc/player.php?share=aae5ca3dda55', '某剧 第2集 - 发现TV'],
    ['https://example.com/watch?v=abc', 'Show Name S01E02'],
    ['https://example.com/manga/one-piece/chapter-1100', 'One Piece Chapter 1100'],
    ['https://example.com/video/123', 'Episode 4: Return'],
    ['https://example.com/read/42', '某小说 第十二章 归来'],
    ['https://example.com/v/9', '某动画 12話'],
    ['https://example.com/v/9', '某剧 大结局'],
    ['https://example.com/course/7', 'Python 入门 第3课']
  ];
  const otherPages: Array<[string, string]> = [
    ['https://faxiantv.cc/player.php?share=aae5ca3dda55', '发现TV 在线播放'],
    ['https://github.com/Kubai087/lumno-extension/issues/123', 'Fix the bug · Issue #123'],
    ['https://github.com/', 'GitHub'],
    ['https://www.v2ex.com/t/1012345', '如何选择笔记本 - V2EX'],
    ['https://item.jd.com/100012345678.html', '某商品'],
    ['https://news.example.com/2026/10/07/some-article', 'Some article'],
    ['https://example.com/docs/getting-started', 'Getting started'],
    ['https://example.com/list?page=2', 'Results page 2'],
    ['https://example.com/blog/my-top-10-tips', 'My top 10 tips'],
    ['chrome://settings/', '设置']
  ];

  it.each(seriesPages)('starts tracking a pinned %s %s', (url, title) => {
    expect(looksLikeSeriesPage({ url, title })).toBe(true);
  });

  it.each(otherPages)('does not track a pinned %s %s', (url, title) => {
    expect(looksLikeSeriesPage({ url, title })).toBe(false);
  });
});
