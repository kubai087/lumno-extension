import { describe, expect, it } from 'vitest';
import { getBrowserPageFaviconUrl, getChromeFaviconUrl, getExtensionFaviconUrl, getGstaticFaviconUrl } from './candidate-urls';

const RUNTIME = { getRuntimeUrl: (path: string) => `chrome-extension://abc${path}` };

describe('favicon candidate URLs', () => {
  it('asks the extension endpoint about the exact page', () => {
    expect(getExtensionFaviconUrl('https://example.com/a b', RUNTIME))
      .toBe('chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fexample.com%2Fa+b&size=128&fallbackToHost=0');
    expect(getExtensionFaviconUrl('chrome://extensions/', RUNTIME)).toBe('');
  });

  it('tells the third-party service only the site origin', () => {
    expect(getGstaticFaviconUrl('https://example.com/a b'))
      .toBe('https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=https%3A%2F%2Fexample.com%2F&size=128');
    expect(new URL(getGstaticFaviconUrl('https://user:pw@wiki.corp.example:8443/doc/42?token=secret#part')).searchParams.get('url'))
      .toBe('https://wiki.corp.example:8443/');
    expect(getGstaticFaviconUrl('file:///Users/someone/a.html')).toBe('');
  });

  it('uses chrome://favicon2 for browser pages only, and the extension endpoint for web pages', () => {
    expect(getChromeFaviconUrl('chrome://newtab/')).toBe('chrome://favicon2/?pageUrl=chrome%3A%2F%2Fnewtab%2F&size=128');
    expect(getChromeFaviconUrl('http://192.168.1.8/dashboard')).toBe('');
    expect(getChromeFaviconUrl('http://192.168.1.8/dashboard', RUNTIME))
      .toBe('chrome-extension://abc/_favicon/?pageUrl=http%3A%2F%2F192.168.1.8%2Fdashboard&size=128&fallbackToHost=0');
    expect(getChromeFaviconUrl('')).toBe('');
  });

  it('gives a browser page the extension endpoint when it can, chrome://favicon2 otherwise, and nothing to a web page', () => {
    const viaExtension = getBrowserPageFaviconUrl('chrome://extensions/', RUNTIME);
    expect(viaExtension).toBe('chrome-extension://abc/_favicon/?pageUrl=chrome%3A%2F%2Fextensions%2F&size=128');
    expect(viaExtension.startsWith('data:')).toBe(false);
    expect(getBrowserPageFaviconUrl('chrome://extensions/')).toBe('chrome://favicon2/?pageUrl=chrome%3A%2F%2Fextensions%2F&size=128');
    expect(getBrowserPageFaviconUrl('https://example.com/')).toBe('');
  });
});
