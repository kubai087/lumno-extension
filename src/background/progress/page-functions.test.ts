import { afterEach, describe, expect, it, vi } from 'vitest';
import { readProgressPageHints } from './page-functions';

// Runs the page function as scripting would, in a page at url.
function read(html: string, url: string) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  document.head.replaceChildren(...Array.from(parsed.head.childNodes, (node) => document.importNode(node, true)));
  document.body.replaceChildren(...Array.from(parsed.body.childNodes, (node) => document.importNode(node, true)));
  vi.stubGlobal('location', new URL(url));
  return readProgressPageHints();
}

afterEach(() => {
  document.head.replaceChildren();
  vi.unstubAllGlobals();
});

describe('reading what a page says about its episode', () => {
  it('finds the next and previous chapters by their links and words', () => {
    const chapter = read(`
      <link rel="prev" href="/novel/2013/72034.html">
      <a href="/novel/2013/72036.html">下一章</a>
      <a href="/novel/2013/">目录</a>
      <a href="/novel/2013/72034.html">上一章</a>`, 'https://www.bilinovel.com/novel/2013/72035.html');

    expect(chapter.nextUrls).toEqual(['https://www.bilinovel.com/novel/2013/72036.html']);
    expect(chapter.prevUrls).toEqual(['https://www.bilinovel.com/novel/2013/72034.html']);
    expect(chapter.episodeNavigation).toBe(true);
  });

  it('reads the series and episode from structured data', () => {
    const show = read(`
      <meta property="og:type" content="video.episode">
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"TVEpisode","episodeNumber":3,"partOfSeries":{"@type":"TVSeries","name":"某剧"}}]}</script>
      <a href="/play/2">Next episode ›</a>`, 'https://video.example.com/play/1');

    expect(show).toMatchObject({ seriesName: '某剧', episode: 3, nextUrls: ['https://video.example.com/play/2'], episodeNavigation: true });
  });

  it('drops links that are not web pages', () => {
    expect(read('<a href="?page=2">下一页</a><a href="javascript:void 0">下一集</a>', 'https://example.com/list').nextUrls)
      .toEqual(['https://example.com/list?page=2']);
  });

  it('says nothing about an ordinary page', () => {
    expect(read('<a href="/about">About</a>', 'https://example.com/')).toEqual({
      nextUrls: [], prevUrls: [], episodeNavigation: false, seriesName: '', episode: 0, media: null
    });
  });
});
