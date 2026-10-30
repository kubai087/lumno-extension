import { afterEach, describe, expect, it, vi } from 'vitest';
import * as COMMUNITY_LINKS from '../platform/community-links';
import { buildFeedbackSupportModel, getFeedbackSupportWebLocale } from './options-feedback-support';

const links = {
  ...COMMUNITY_LINKS.FALLBACK_LINKS,
  wechatQr: 'https://example.com/qr.png',
  githubIssue: 'https://github.com/example/issues/new',
  x: 'https://x.com/example',
  licenses: 'https://example.com/notices'
};

function buildModel(webLocale: string, helpCenterSearchEnabled: boolean, from = links) {
  return buildFeedbackSupportModel({
    communityLinks: COMMUNITY_LINKS,
    getMessage: (key, fallback) => `${key}|${fallback}`,
    helpCenterSearchEnabled,
    helpIconUrl: 'icon.png',
    links: from,
    webLocale
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Options feedback support model', () => {
  it('maps the page locale to the website locale, English for any other', () => {
    expect(['zh_CN', 'zh_TW', 'ja', 'de'].map(getFeedbackSupportWebLocale)).toEqual(['zh-CN', 'zh-TW', 'ja', 'en']);
  });

  it('gives Chinese readers the WeChat group as a card beside the Help Center, with its QR code', () => {
    const zh = buildModel('zh-CN', true);
    expect(zh.cards?.map((card) => card.key)).toEqual(['community']);
    expect(zh.cards?.[0]?.href).toBe(links.wechatQr);
    expect(zh.cards?.[0]?.qr?.imageUrl).toBe(links.wechatQr);
    expect(zh.items.map((item) => item.key)).toEqual(['chrome-review', 'github-issue', 'contact-author']);
    expect(zh.help?.href).toBe(COMMUNITY_LINKS.getHelpUrl('zh-CN'));
    expect(zh.help?.ask?.iconUrl).toBe('icon.png');
    expect(buildModel('zh-TW', true).cards?.[0]?.key).toBe('community');
  });

  it('makes contacting the author on X the community entry elsewhere', () => {
    const en = buildModel('en', false);
    expect(en.cards).toEqual([]);
    expect(en.items.map((item) => item.key)).toEqual(['chrome-review', 'github-issue', 'contact-author']);
  });

  it('leaves out the ask-in-the-search-box demo while the Help Center site search is off', () => {
    expect(buildModel('en', false).help?.ask).toBeNull();
  });

  it('opens the review page of the store this copy came from', () => {
    const reviewHref = () => buildModel('en', false).items.find((item) => item.key === 'chrome-review')?.href;
    vi.stubGlobal('chrome', { runtime: { id: 'nggfkkbmogmadfoikakkfegkoilfcfao' } });
    expect(reviewHref()).toBe(links.chromeReview);
    vi.stubGlobal('chrome', { runtime: { id: 'lumno@kubai087' } });
    expect(reviewHref()).toBe('https://addons.mozilla.org/firefox/addon/lumno-command-bar-new-tab/reviews/');
  });

  it('takes the bundled links until the remote ones load', () => {
    expect(buildModel('zh-CN', true, COMMUNITY_LINKS.FALLBACK_LINKS).cards?.[0]?.href).toBe(COMMUNITY_LINKS.FALLBACK_LINKS.wechatQr);
    expect(buildModel('zh-CN', true).cards?.[0]?.href).toBe(links.wechatQr);
  });
});
