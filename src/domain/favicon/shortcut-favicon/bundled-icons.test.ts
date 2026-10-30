import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDefaultSiteSearchProviders } from '../../search/utils/site-search-providers';
import { siteSearchIconCache } from '../../settings/search';
import { setCachedIcon, SITE_SEARCH_CACHE_OPTIONS } from './persisted';
import {
  GOOGLE_BRAND_ICON_URL,
  SHORTCUT_PINNED_ICON_ASSETS,
  SITE_SEARCH_PINNED_ICON_ASSETS,
  createSiteSearchProviderIconHydrator,
  getBundledShortcutIconAssetPath,
  getSiteSearchPinnedIconAssetPath,
  getSiteSearchProviderIcon,
  getSiteSearchProviderPageUrl,
  isSiteSearchPinnedIconAssetUrl,
  shouldHydrateSiteSearchProviderIcon
} from './bundled-icons';

const NOW = 1_800_000_000_000;
const providers = getDefaultSiteSearchProviders();
const resolveAssetUrl = (path: string) => `chrome-extension://test/${path}`;
const googleProvider = { key: 'gg', template: 'https://www.google.com/search?q={query}', iconUrl: GOOGLE_BRAND_ICON_URL };
const youtubeProvider = { key: 'yt', template: 'https://www.youtube.com/results?search_query={query}' };

describe('bundled shortcut artwork', () => {
  it('gives supported hosts their bundled glyph, whatever www alias or query', () => {
    expect(getBundledShortcutIconAssetPath('https://github.com/kubai087/lumno-extension', providers)).toBe('assets/images/site-search/glyph-gh.svg');
    expect(getBundledShortcutIconAssetPath('https://www.xiaohongshu.com/explore?unread=3', providers)).toBe('assets/images/site-search/glyph-xhs.png');
    expect(getBundledShortcutIconAssetPath('https://xiaohongshu.com/explore?unread=8', providers)).toBe('assets/images/site-search/glyph-xhs.png');
    [
      ['https://www.bilibili.com/', 'glyph-bb.svg'],
      ['https://space.bilibili.com/123', 'glyph-bb.svg'],
      ['https://www.taobao.com/', 'glyph-tb.png'],
      ['https://weibo.com/u/1', 'glyph-wb.png'],
      ['https://www.jd.com/', 'glyph-jd.png'],
      ['https://twitter.com/home', 'glyph-tw.svg'],
      ['https://cn.bing.com/', 'glyph-bi.svg'],
      ['https://www.google.com/', 'glyph-gg.svg'],
      ['https://www.google.com/maps/@31.2,121.4,12z', 'glyph-maps.png'],
      ['https://maps.google.com/', 'glyph-maps.png'],
      ['https://www.google.com/mapsearch', 'glyph-gg.svg']
    ].forEach(([pageUrl, glyph]) => {
      expect(getBundledShortcutIconAssetPath(pageUrl, providers), pageUrl).toBe(`assets/images/site-search/${glyph}`);
    });
  });

  it('gives unrelated hosts no bundled brand icon', () => {
    expect(getBundledShortcutIconAssetPath('https://xiaohongshu.com.example.com/', providers)).toBe('');
    expect(getBundledShortcutIconAssetPath('https://bilibili.com.example.com/', providers)).toBe('');
  });

  it('covers the whole built-in catalog on both surfaces with artwork that ships', () => {
    expect(Object.keys(SHORTCUT_PINNED_ICON_ASSETS)).toEqual(Object.keys(SITE_SEARCH_PINNED_ICON_ASSETS));
    Object.values(SHORTCUT_PINNED_ICON_ASSETS).forEach((assetPath) => {
      expect(existsSync(resolve(process.cwd(), assetPath)), assetPath).toBe(true);
    });
  });
});

describe('site search provider icons', () => {
  it('names each provider\'s bundled tile, also for a renamed built-in provider', () => {
    expect(getSiteSearchPinnedIconAssetPath({ key: 'gh' })).toBe('assets/images/site-search/tile-gh.png');
    expect(getSiteSearchPinnedIconAssetPath(youtubeProvider)).toBe('assets/images/site-search/tile-yt.png');
    expect(getSiteSearchPinnedIconAssetPath({ ...youtubeProvider, key: 'video', builtinKey: 'YT' })).toBe('assets/images/site-search/tile-yt.png');
  });

  it('draws bundled tiles directly and hydrates only remote custom artwork', () => {
    const tile = 'chrome-extension://lumno/assets/images/site-search/tile-yt.png';
    expect(isSiteSearchPinnedIconAssetUrl(tile)).toBe(true);
    expect(shouldHydrateSiteSearchProviderIcon(tile)).toBe(false);
    expect(shouldHydrateSiteSearchProviderIcon('https://custom.example/favicon.ico')).toBe(true);
    const hydrated: unknown[][] = [];
    const hydrate = createSiteSearchProviderIconHydrator((...args: [object, string, string]) => { hydrated.push(args); });
    expect(hydrate({}, tile, 'youtube.com')).toBe(false);
    const customIcon = {};
    expect(hydrate(customIcon, 'https://custom.example/favicon.ico', 'custom.example')).toBe(true);
    expect(hydrated).toEqual([[customIcon, 'https://custom.example/favicon.ico', 'custom.example']]);
  });

  it('never lets a mismatched Google cache entry replace the pinned brand icon', () => {
    const page = getSiteSearchProviderPageUrl(googleProvider);
    const wrong = setCachedIcon({}, page, 'data:image/png;base64,Z29vZ2xl', 'https://www.google.com/favicon.ico', NOW, SITE_SEARCH_CACHE_OPTIONS);
    expect(getSiteSearchProviderIcon(wrong, googleProvider, NOW, SITE_SEARCH_CACHE_OPTIONS)).toBe(GOOGLE_BRAND_ICON_URL);
    const matching = setCachedIcon({}, page, 'data:image/png;base64,Z29vZ2xl', GOOGLE_BRAND_ICON_URL, NOW, SITE_SEARCH_CACHE_OPTIONS);
    expect(getSiteSearchProviderIcon(matching, googleProvider, NOW, SITE_SEARCH_CACHE_OPTIONS)).toBe('data:image/png;base64,Z29vZ2xl');
  });

  it('reuses a provider\'s saved icon on every surface', () => {
    const youtube = setCachedIcon({}, getSiteSearchProviderPageUrl(youtubeProvider), 'data:image/png;base64,eW91dHViZQ==',
      'https://www.youtube.com/img/favicon_144x144.png', NOW, SITE_SEARCH_CACHE_OPTIONS);
    expect(getSiteSearchProviderIcon(youtube, youtubeProvider, NOW, SITE_SEARCH_CACHE_OPTIONS)).toBe('data:image/png;base64,eW91dHViZQ==');
  });

  it('resolves the built-in providers to their bundled tile without a cache lookup', () => {
    expect(getSiteSearchProviderIcon({}, { ...youtubeProvider, key: 'video', builtinKey: 'yt' }, NOW, { ...SITE_SEARCH_CACHE_OPTIONS, resolveAssetUrl }))
      .toBe('chrome-extension://test/assets/images/site-search/tile-yt.png');
    const builtins: Array<[{ key: string; template: string; iconUrl?: string }, string]> = [
      [youtubeProvider, 'tile-yt.png'],
      [{ key: 'bd', template: 'https://www.baidu.com/s?wd={query}' }, 'tile-bd.png'],
      [{ key: 'bi', template: 'https://www.bing.com/search?q={query}' }, 'tile-bi.png'],
      [googleProvider, 'tile-gg.png'],
      [{ key: 'zh', template: 'https://www.zhihu.com/search?q={query}' }, 'tile-zh.png'],
      [{ key: 'db', template: 'https://www.douban.com/search?q={query}' }, 'tile-db.png'],
      [{ key: 'wx', template: 'https://weixin.sogou.com/weixin?query={query}' }, 'tile-wx.png'],
      [{ key: 'tb', template: 'https://s.taobao.com/search?q={query}' }, 'tile-tb.png'],
      [{ key: 'rd', template: 'https://www.reddit.com/search/?q={query}' }, 'tile-rd.png'],
      [{ key: 'wb', template: 'https://s.weibo.com/weibo?q={query}' }, 'tile-wb.png'],
      [{ key: 'dy', template: 'https://www.douyin.com/search/{query}' }, 'tile-dy.png'],
      [{ key: 'jd', template: 'https://search.jd.com/Search?keyword={query}' }, 'tile-jd.png']
    ];
    builtins.forEach(([provider, assetName]) => {
      expect(existsSync(resolve(process.cwd(), 'assets/images/site-search', assetName)), assetName).toBe(true);
      expect(getSiteSearchProviderIcon({}, provider, NOW, { ...SITE_SEARCH_CACHE_OPTIONS, resolveAssetUrl }), provider.key)
        .toBe(`chrome-extension://test/assets/images/site-search/${assetName}`);
    });
  });

  it('keeps the provider icons under the canonical cache key', () => {
    expect(siteSearchIconCache.key).toMatch(/canonical/);
  });
});
