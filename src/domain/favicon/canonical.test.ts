import { describe, expect, it } from 'vitest';
import { getCanonicalFaviconHost, getCanonicalPageUrlForFavicon, getFaviconPersistCacheKey, getPageUrlFromFaviconProxyUrl } from './canonical';

const LOVART_GSTATIC = 'https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=https%3A%2F%2Fwww.lovart.ai%2Fhome&size=128';

describe('canonical favicon pages', () => {
  it('reads the page a proxy URL asks about', () => {
    expect(getPageUrlFromFaviconProxyUrl(LOVART_GSTATIC)).toBe('https://www.lovart.ai/home');
    expect(getPageUrlFromFaviconProxyUrl('chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fwww.lovart.ai%2Fhome&size=128&fallbackToHost=0'))
      .toBe('https://www.lovart.ai/home');
  });

  it('reads a Favicon.is target from its domain path, not from a query parameter', () => {
    expect(getPageUrlFromFaviconProxyUrl('https://favicon.is/example.com?larger=true&url=https://wrong.example/')).toBe('https://example.com/');
  });

  it('resolves a proxy URL to its page and host, and keeps a page as it is', () => {
    expect(getCanonicalPageUrlForFavicon(LOVART_GSTATIC)).toBe('https://www.lovart.ai/home');
    expect(getCanonicalPageUrlForFavicon('https://example.com/docs')).toBe('https://example.com/docs');
    expect(getCanonicalFaviconHost(LOVART_GSTATIC)).toBe('lovart.ai');
  });

  it('keys persisted icons by web page without the fragment, and other pages by their fallback key', () => {
    expect(getFaviconPersistCacheKey('https://Example.com/docs?mode=compact#section', 'example.com')).toBe('page:https://example.com/docs?mode=compact');
    expect(getFaviconPersistCacheKey('chrome://extensions/', 'extensions')).toBe('extensions');
  });
});
