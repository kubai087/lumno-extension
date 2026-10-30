import { describe, expect, it } from 'vitest';
import { isFaviconIsUrl, isFaviconProxyUrl, isSafeVirtualFaviconRequestUrl, normalizeFaviconHost } from './url-kinds';

describe('favicon URL kinds', () => {
  it('normalizes a host to its site', () => {
    expect(normalizeFaviconHost('www.Example.com')).toBe('example.com');
    expect(normalizeFaviconHost('app.feishu.cn')).toBe('feishu.cn');
  });

  it('recognizes the icon services and the browser endpoints as proxies', () => {
    expect(isFaviconProxyUrl('https://www.google.com/s2/favicons?domain=example.com')).toBe(true);
    expect(isFaviconProxyUrl('chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fexample.com%2F&fallbackToHost=0')).toBe(true);
    expect(isFaviconProxyUrl('https://t2.gstatic.cn/faviconV2?url=https%3A%2F%2Fexample.com%2F')).toBe(true);
    expect(isFaviconProxyUrl('https://favicon.is/example.com?larger=true')).toBe(true);
    expect(isFaviconProxyUrl('https://example.com/favicon.ico')).toBe(false);
  });

  it('identifies a proxy by its actual host and path', () => {
    for (const spoof of [
      'https://example.com/gstatic.cn/faviconV2',
      'https://gstatic.cn.example.com/faviconV2',
      'https://example.com/?icon=https://www.google.com/s2/favicons',
      'https://t2.gstatic.cn/other.png'
    ]) {
      expect(isFaviconProxyUrl(spoof), spoof).toBe(false);
    }
  });

  it('accepts only the documented HTTPS domain endpoint of Favicon.is', () => {
    for (const spoof of ['https://favicon.is.evil.test/example.com', 'http://favicon.is/example.com',
      'https://favicon.is/https://example.com/', 'https://favicon.is/example.com%2Fprivate', 'https://favicon.is/']) {
      expect(isFaviconIsUrl(spoof), spoof).toBe(false);
    }
  });

  it('treats only the browser favicon endpoints as safe virtual requests', () => {
    expect(isSafeVirtualFaviconRequestUrl('chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fexample.com%2F&fallbackToHost=0')).toBe(true);
    expect(isSafeVirtualFaviconRequestUrl('chrome://favicon2/?pageUrl=https%3A%2F%2Fexample.com%2F')).toBe(true);
    expect(isSafeVirtualFaviconRequestUrl('https://t2.gstatic.cn/faviconV2?url=https%3A%2F%2Fexample.com%2F')).toBe(false);
    expect(isSafeVirtualFaviconRequestUrl('https://example.com/favicon.ico')).toBe(false);
  });
});
