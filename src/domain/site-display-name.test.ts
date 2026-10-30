import { describe, expect, it } from 'vitest';
import { getSiteDisplayName } from './site-display-name';

describe('site display names', () => {
  it('names a known brand by its stable name, on its subdomains too', () => {
    expect(getSiteDisplayName('www.github.com', 'Repository')).toBe('GitHub');
    expect(getSiteDisplayName('docs.github.com', 'Documentation')).toBe('GitHub');
  });

  it('keeps the shared brand names locale-neutral', () => {
    expect(getSiteDisplayName('weibo.com', 'Home')).toBe('Weibo');
  });

  it('prefers a concise title part on a noisy subdomain', () => {
    expect(getSiteDisplayName('login.example.co.uk', 'Example Account | Sign in')).toBe('Sign in');
  });

  it('keeps the registrable label under a multi-part public suffix', () => {
    expect(getSiteDisplayName('product.example.com.cn', 'Example Product')).toBe('Example');
  });

  it('falls back to the page title without a host', () => {
    expect(getSiteDisplayName('', 'Fallback Title')).toBe('Fallback Title');
  });

  it('lets a caller localize a known brand', () => {
    expect(getSiteDisplayName('mp.weixin.qq.com', 'Article', {
      getBrandName: (host, fallback) => (host === 'mp.weixin.qq.com' ? 'WeChat Official' : fallback)
    })).toBe('WeChat Official');
  });
});
