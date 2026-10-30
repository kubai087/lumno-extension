import { describe, expect, it } from 'vitest';
import { getFaviconHostPolicy, getFaviconUrlPolicy, isBlockedLocalFaviconUrl, shouldAvoidDirectFaviconForHost, shouldBlockDirectFaviconHost, shouldBlockFaviconForHost } from './host-policy';

describe('favicon host policy', () => {
  it('blocks no host outright', () => {
    ['localhost', '192.168.1.8', 'service.internal', 'example.com'].forEach((host) => {
      expect(shouldBlockFaviconForHost(host), host).toBe(false);
    });
  });

  it('avoids direct icon requests to local and internal hosts', () => {
    ['localhost', '192.168.1.8', '10.1.2.3', 'service.internal'].forEach((host) => {
      expect(shouldAvoidDirectFaviconForHost(host), host).toBe(true);
    });
    expect(shouldAvoidDirectFaviconForHost('example.com')).toBe(false);
    expect(getFaviconHostPolicy('192.168.1.8')).toMatchObject({ hardBlocked: false, avoidDirect: true });
    expect(shouldBlockDirectFaviconHost('service.internal')).toBe(true);
  });

  it('lets a proxy ask about a local page', () => {
    expect(getFaviconUrlPolicy('https://t2.gstatic.cn/faviconV2?url=http%3A%2F%2F192.168.1.8%2F&size=128'))
      .toMatchObject({ hardBlocked: false, avoidDirect: false });
  });

  it('blocks icon files on local hosts and URLs that point at one', () => {
    expect(isBlockedLocalFaviconUrl('https://127.0.0.1/favicon.ico')).toBe(true);
    expect(isBlockedLocalFaviconUrl('http://192.168.1.8/favicon.ico')).toBe(true);
    expect(isBlockedLocalFaviconUrl('https://service.internal/favicon.svg')).toBe(true);
    expect(isBlockedLocalFaviconUrl('https://example.com/icon.png?pageUrl=http%3A%2F%2F192.168.1.8%2F')).toBe(true);
  });

  it('does not block extension assets, browser endpoints, proxies or public icons', () => {
    [
      'chrome-extension://abc/assets/images/lumno.png',
      'chrome://favicon2/?url=http%3A%2F%2F192.168.1.8%2F',
      'chrome://favicon2/?url=localhost',
      'chrome://favicon2/?url=https%3A%2F%2Fexample.com%2F',
      'chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fexample.com%2F&size=128&fallbackToHost=0',
      'chrome-extension://abc/_favicon/?pageUrl=http%3A%2F%2F192.168.1.8%2F&size=128&fallbackToHost=0',
      'https://t2.gstatic.cn/faviconV2?url=http%3A%2F%2F192.168.1.8%2F&size=128',
      'https://example.com/favicon.ico'
    ].forEach((url) => {
      expect(isBlockedLocalFaviconUrl(url), url).toBe(false);
    });
  });
});
