import { describe, expect, it } from 'vitest';
import { hostHasExplicitDarkFavicon, isNeutralThemeColor, isPlaceholderFaviconColor, parseCssThemeColor, parseHtmlThemeColorCandidates, pickBestThemeColorCandidate } from './theme-color';

describe('site theme colors', () => {
  it('parses CSS colors', () => {
    expect(parseCssThemeColor('#0f8')).toEqual([0, 255, 136]);
    expect(parseCssThemeColor('rgba(10, 20, 30, 0.5)')).toEqual([10, 20, 30]);
    expect(parseCssThemeColor('transparent')).toBeNull();
  });

  it('tells neutral and placeholder colors from brand colors', () => {
    expect(isNeutralThemeColor([255, 255, 255])).toBe(true);
    expect(isNeutralThemeColor([31, 35, 39])).toBe(true);
    expect(isNeutralThemeColor([234, 100, 217])).toBe(false);
    [[95, 99, 104], [100, 103, 110], [154, 160, 166]].forEach((rgb) => {
      expect(isPlaceholderFaviconColor(rgb), rgb.join(',')).toBe(true);
    });
    expect(isPlaceholderFaviconColor([36, 41, 46])).toBe(false);
    expect(isPlaceholderFaviconColor([255, 36, 66])).toBe(false);
    expect(isPlaceholderFaviconColor(null)).toBe(false);
  });

  it('knows hosts that ship a dark icon', () => {
    expect(hostHasExplicitDarkFavicon('gist.github.com')).toBe(true);
  });

  it('prefers the theme color meant for the theme and finds the manifest', () => {
    const candidates = parseHtmlThemeColorCandidates(`
      <meta name="theme-color" content="#112233" media="(prefers-color-scheme: dark)">
      <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
      <link rel="manifest" href="/site.webmanifest">
    `, 'https://example.com/docs/page', 'dark');
    expect(candidates[0]).toMatchObject({ accentRgb: [17, 34, 51], score: 108 });
    expect(candidates).toContainEqual(expect.objectContaining({ manifestUrl: 'https://example.com/site.webmanifest' }));
    expect(pickBestThemeColorCandidate(candidates)).toMatchObject({ accentRgb: [17, 34, 51] });
  });

  it('prefers a mask icon\'s brand color over a neutral theme color', () => {
    const candidates = parseHtmlThemeColorCandidates(`
      <meta name="theme-color" content="#FFFFFF">
      <link href="https://cdn.dribbble.com/assets/dribbble-vector-ball.svg" rel="mask-icon" color="#EA64D9">
      <link href="https://cdn.dribbble.com/assets/favicon.svg" rel="icon" type="image/svg+xml">
    `, 'https://dribbble.com/', 'light');
    expect(pickBestThemeColorCandidate(candidates)).toMatchObject({ source: 'mask-icon', accentRgb: [234, 100, 217], confidence: 'color' });
    expect(candidates.find((candidate) => candidate.source === 'meta')).toMatchObject({ confidence: 'neutral' });
  });
});
