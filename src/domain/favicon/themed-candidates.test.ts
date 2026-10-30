import { describe, expect, it } from 'vitest';
import { getKnownThemedFaviconCandidateScores, getKnownThemedFaviconCandidateUrls, getRootFaviconCandidateScores, getRootFaviconCandidateUrls, getThemeFaviconCandidateUrls, hasThemeTokenInUrl, parseHtmlIconCandidateScores, shouldSkipThemeUpgradeCandidate } from './themed-candidates';

describe('themed favicon candidates', () => {
  it('reads a theme from an icon URL and skips upgrades that do not fit the theme', () => {
    expect(hasThemeTokenInUrl('https://example.com/favicon-dark.svg', 'dark')).toBe(true);
    expect(shouldSkipThemeUpgradeCandidate('https://example.com/favicon-light.svg', 'dark', '')).toBe(true);
    expect(shouldSkipThemeUpgradeCandidate('https://example.com/favicon.svg', 'dark', 'https://example.com/favicon-dark.svg')).toBe(true);
  });

  it('knows GitHub\'s themed icons', () => {
    expect(getKnownThemedFaviconCandidateUrls('github.com', 'dark')[0]).toBe('https://github.githubassets.com/favicons/favicon-dark.svg');
    expect(getKnownThemedFaviconCandidateScores('github.com', '').map((candidate) => candidate.score)).toEqual([52, 52, 36]);
  });

  it('ranks the root icon files for the theme', () => {
    const scores = getRootFaviconCandidateScores('www.Example.com', 'dark');
    expect(scores[0].url).toBe('https://example.com/favicon-dark.svg');
    expect(scores.map((candidate) => candidate.score)).toEqual([34, 28, 16, 24, 16]);
    const urls = getRootFaviconCandidateUrls('www.Example.com', 'dark');
    expect(urls.slice(0, 5)).toEqual([
      'https://example.com/favicon-dark.svg',
      'https://example.com/favicon.svg',
      'https://example.com/favicon.png',
      'https://example.com/favicon.ico',
      'https://example.com/favicon-32x32.png'
    ]);
    expect(urls).toContain('https://example.com/apple-touch-icon-precomposed.png');
  });

  it('scores the page\'s icon links and their themed variants', () => {
    const candidates = parseHtmlIconCandidateScores(`
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="32x32" media="(prefers-color-scheme: dark)" data-base-href="/assets/favicon">
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">
    `, 'https://example.com/page', 'dark');
    expect(candidates[0]).toMatchObject({ url: 'https://example.com/favicon.svg', score: 88 });
    expect(candidates).toContainEqual(expect.objectContaining({ url: 'https://example.com/favicon-dark.svg', score: 102 }));
    expect(candidates.map((candidate) => candidate.url)).toContain('https://example.com/assets/favicon-dark.svg');
  });

  it('puts site artwork before browser and service icons and drops chrome://favicon2 and duplicates', () => {
    expect(getThemeFaviconCandidateUrls([
      'chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fmp.weixin.qq.com%2F&size=128&fallbackToHost=0',
      'https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=https%3A%2F%2Fmp.weixin.qq.com%2F&size=128',
      'chrome://favicon2/?url=https%3A%2F%2Fmp.weixin.qq.com%2F',
      'https://res.wx.qq.com/a/wx_fed/assets/res/OTE0YTAw.png',
      'https://res.wx.qq.com/a/wx_fed/assets/res/OTE0YTAw.png'
    ])).toEqual([
      'https://res.wx.qq.com/a/wx_fed/assets/res/OTE0YTAw.png',
      'chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fmp.weixin.qq.com%2F&size=128&fallbackToHost=0',
      'https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=https%3A%2F%2Fmp.weixin.qq.com%2F&size=128'
    ]);
  });
});
