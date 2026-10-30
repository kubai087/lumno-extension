import { describe, expect, it } from 'vitest';
import { isFaviconSourceAllowedByEnhancedFetchPolicy as isAllowed } from './enhanced-fetch-policy';

const GSTATIC = 'https://t2.gstatic.cn/faviconV2?url=https%3A%2F%2Ffoo.example.com%2F';
const OWN = { ownExtensionId: 'abc' };

describe('enhanced favicon fetch policy', () => {
  it('rejects direct site icons with enhanced fetching off but keeps approved services', () => {
    expect(isAllowed('https://foo.example.com/favicon.ico', false)).toBe(false);
    expect(isAllowed(GSTATIC, false)).toBe(true);
  });

  it('rejects icon services for an excluded site', () => {
    expect(isAllowed(GSTATIC, false, { allowThirdPartyFetch: false })).toBe(false);
  });

  it('rejects even an explicitly configured website image with enhanced fetching off', () => {
    expect(isAllowed('https://cdn.example.com/icon.png', false, { allowRemoteImage: true })).toBe(false);
  });

  it('fails closed before the setting loads while keeping data URLs', () => {
    expect(isAllowed(GSTATIC, undefined)).toBe(false);
    expect(isAllowed('https://foo.example.com/favicon.ico', undefined)).toBe(false);
    expect(isAllowed('data:image/png;base64,c2FmZQ==', undefined)).toBe(true);
  });

  it('keeps Lumno\'s own _favicon endpoint and rejects other extensions\' in either mode', () => {
    expect(isAllowed('chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Ffoo.example.com%2F&fallbackToHost=0', false, OWN)).toBe(true);
    expect(isAllowed('chrome-extension://other/_favicon/?pageUrl=https%3A%2F%2Ffoo.example.com%2F', false, OWN)).toBe(false);
    expect(isAllowed('chrome-extension://other/_favicon/?pageUrl=https%3A%2F%2Ffoo.example.com%2F', true, OWN)).toBe(false);
  });

  it('keeps Lumno\'s own icon and bundled site-search artwork', () => {
    expect(isAllowed('chrome-extension://abc/assets/images/lumno.png', false, OWN)).toBe(true);
    expect(isAllowed('chrome-extension://abc/assets/images/site-search/tile-gg.png', false, OWN)).toBe(true);
    expect(isAllowed('chrome-extension://abc/assets/images/site-search/tile-ddg.png', false, OWN)).toBe(true);
  });

  it('rejects other extensions\' assets and own pages outside the approved artwork', () => {
    expect(isAllowed('chrome-extension://other/assets/images/site-search/tile-ddg.png', true, OWN)).toBe(false);
    expect(isAllowed('chrome-extension://abc/assets/images/site-search/duckduckgo.html', true, OWN)).toBe(false);
    expect(isAllowed('chrome-extension://other/assets/images/icon.png', false, OWN)).toBe(false);
    expect(isAllowed('chrome-extension://abc/src/options/options.html', false, OWN)).toBe(false);
    expect(isAllowed('chrome-extension://abc/src/options/options.html', true, OWN)).toBe(false);
  });

  it('does not let a website URL pass for an approved service', () => {
    for (const spoof of [
      'https://example.com/gstatic.cn/faviconV2',
      'https://gstatic.cn.example.com/faviconV2',
      'https://example.com/?icon=https://www.google.com/s2/favicons',
      'https://t2.gstatic.cn/other.png'
    ]) {
      expect(isAllowed(spoof, true), spoof).toBe(false);
    }
  });
});
