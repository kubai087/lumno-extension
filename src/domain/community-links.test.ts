import { describe, expect, it } from 'vitest';
import {
  COMMUNITY_LINKS_URL,
  EDGE_ADDONS_EXTENSION_ID,
  FALLBACK_LINKS,
  getCommunityChannel,
  getCommunityUrl,
  getHelpSearchIndexUrl,
  getHelpSearchSynonymsUrl,
  getHelpUrl,
  getReviewUrl,
  getStoreListing,
  isFirefoxInstall,
  normalizeHttpsUrl,
  normalizeLinksPayload
} from './community-links';

const CHROME_STORE_ID = 'nggfkkbmogmadfoikakkfegkoilfcfao';
const GECKO_ID = 'lumno@kubai087';

describe('community links', () => {
  it('reads every surface from one remote list', () => {
    expect(COMMUNITY_LINKS_URL).toBe('https://lumno.kubai.design/community-links.json');
  });

  it('opens the help center in the UI language at its first article', () => {
    expect(['zh-CN', 'zh_TW', 'ja', 'en', 'fr'].map((locale) => getHelpUrl(locale))).toEqual([
      'https://lumno.kubai.design/help/what-is-lumno/',
      'https://lumno.kubai.design/zh-tw/help/what-is-lumno/',
      'https://lumno.kubai.design/ja/help/what-is-lumno/',
      'https://lumno.kubai.design/en/help/what-is-lumno/',
      'https://lumno.kubai.design/en/help/what-is-lumno/'
    ]);
  });

  it('links to a help article and to a section of one', () => {
    expect(getHelpUrl('zh-CN', 'newtab-wallpaper')).toBe('https://lumno.kubai.design/help/newtab-wallpaper/');
    expect(getHelpUrl('en', 'tab-switcher', 'ctrl-tab')).toBe('https://lumno.kubai.design/en/help/tab-switcher/#ctrl-tab');
  });

  it('rejects insecure remote links', () => {
    expect(normalizeHttpsUrl('http://example.com/qr.webp')).toBe('');
    expect(normalizeLinksPayload({ links: { edgeReview: 'http://example.com' } }).edgeReview).toBe(FALLBACK_LINKS.edgeReview);
    expect(normalizeLinksPayload({ links: { firefoxReview: 'http://example.com' } }).firefoxReview).toBe(FALLBACK_LINKS.firefoxReview);
  });

  it('accepts the remote QR spellings the website uses', () => {
    const links = normalizeLinksPayload({
      links: { chrome_rating: 'https://example.com/review', wechat_qr: 'https://cdn.example.com/latest-qr.webp' },
      community_by_locale: { zh_CN: 'wechat', en: 'discord' }
    });
    expect(links.wechatQr).toBe('https://cdn.example.com/latest-qr.webp');
  });

  it('sends Chinese locales to WeChat and every other locale to X', () => {
    const links = normalizeLinksPayload({
      links: { wechat_qr: 'https://cdn.example.com/latest-qr.webp' },
      community_by_locale: { zh_CN: 'wechat', en: 'discord' }
    });
    expect(['zh-CN', 'zh_TW', 'zh-HK', 'zh-SG'].map((locale) => getCommunityChannel(links, locale)))
      .toEqual(['wechat', 'wechat', 'wechat', 'wechat']);
    // An older "discord" value from the website means X.
    expect(getCommunityChannel(links, 'en-US')).toBe('x');
    expect(getCommunityUrl(links, 'zh-TW')).toBe('https://cdn.example.com/latest-qr.webp');
    expect(getCommunityUrl(links, 'ja')).toBe(FALLBACK_LINKS.x);
  });

  it('keeps Traditional Chinese on WeChat when the remote locale map is stale', () => {
    const links = normalizeLinksPayload({ links: { x: 'https://x.example/someone' }, community_by_locale: { zh_TW: 'x' } });
    expect(getCommunityChannel(links, 'zh-HK')).toBe('wechat');
    expect(getCommunityUrl(links, 'zh-HK')).toBe(FALLBACK_LINKS.wechatQr);
  });

  it('reviews on the store the extension was installed from', () => {
    expect(EDGE_ADDONS_EXTENSION_ID).toBe('pfbklkaefmfamjpibfiapaiihlddhchc');
    expect(getReviewUrl(FALLBACK_LINKS, CHROME_STORE_ID)).toBe(FALLBACK_LINKS.chromeReview);
    expect(getReviewUrl(FALLBACK_LINKS, EDGE_ADDONS_EXTENSION_ID))
      .toBe('https://microsoftedge.microsoft.com/addons/detail/pfbklkaefmfamjpibfiapaiihlddhchc');
    expect(getReviewUrl(null, '')).toBe(FALLBACK_LINKS.chromeReview);
    expect(getReviewUrl(FALLBACK_LINKS, GECKO_ID)).toBe('https://addons.mozilla.org/firefox/addon/lumno-command-bar-new-tab/reviews/');
    expect(getReviewUrl(null, GECKO_ID)).toBe(FALLBACK_LINKS.firefoxReview);
  });

  it('takes the Chrome and Edge review pages from the remote list', () => {
    const remote = normalizeLinksPayload({
      links: { chrome_review: 'https://example.com/chrome-review', edge_review: 'https://example.com/edge-review' }
    });
    expect(getReviewUrl(remote, CHROME_STORE_ID)).toBe('https://example.com/chrome-review');
    expect(getReviewUrl(remote, EDGE_ADDONS_EXTENSION_ID)).toBe('https://example.com/edge-review');
    expect(getReviewUrl(remote, GECKO_ID)).toBe(FALLBACK_LINKS.firefoxReview);
  });

  it.each(['firefoxReview', 'firefox_review', 'firefox_addons_review'])('takes the Firefox review page from the remote %s', (key) => {
    const remote = normalizeLinksPayload({ links: { [key]: 'https://example.com/firefox-review' } });
    expect(getReviewUrl(remote, GECKO_ID)).toBe('https://example.com/firefox-review');
  });

  it('opens the listing of the store the extension was installed from', () => {
    expect(getStoreListing(CHROME_STORE_ID).url).toBe(
      'https://chromewebstore.google.com/detail/lumno-%E8%81%9A%E7%84%A6%E6%90%9C%E7%B4%A2%E6%96%B0%E6%A0%87%E7%AD%BE%E9%A1%B5/nggfkkbmogmadfoikakkfegkoilfcfao?utm_source=item-share-cb'
    );
    expect(getStoreListing(EDGE_ADDONS_EXTENSION_ID)).toEqual({
      id: 'edge',
      name: 'Microsoft Edge Add-ons',
      host: 'microsoftedge.microsoft.com',
      url: 'https://microsoftedge.microsoft.com/addons/detail/pfbklkaefmfamjpibfiapaiihlddhchc'
    });
    expect(getStoreListing(GECKO_ID)).toEqual({
      id: 'firefox',
      name: 'Firefox Add-ons',
      host: 'addons.mozilla.org',
      url: 'https://addons.mozilla.org/firefox/addon/lumno-command-bar-new-tab/'
    });
  });

  it('knows Firefox installs by their Gecko ids', () => {
    expect(isFirefoxInstall(GECKO_ID)).toBe(true);
    expect(isFirefoxInstall('{3f2a1b4c-0d5e-4f6a-8b7c-9d0e1f2a3b4c}')).toBe(true);
    expect(isFirefoxInstall(CHROME_STORE_ID)).toBe(false);
    expect(isFirefoxInstall(EDGE_ADDONS_EXTENSION_ID)).toBe(false);
  });
});

describe('help center search files', () => {
  it('reads the search index and synonyms of the UI language, Simplified Chinese at the root and English otherwise', () => {
    expect(getHelpSearchSynonymsUrl('zh_TW')).toBe('https://lumno.kubai.design/zh-tw/help/search-synonyms.json');
    expect(['zh_CN', 'zh_TW', 'ja', 'fr'].map((locale) => getHelpSearchIndexUrl(locale))).toEqual([
      'https://lumno.kubai.design/help/search-index.json',
      'https://lumno.kubai.design/zh-tw/help/search-index.json',
      'https://lumno.kubai.design/ja/help/search-index.json',
      'https://lumno.kubai.design/en/help/search-index.json'
    ]);
  });
});
