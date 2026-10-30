import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canFetchPageForFavicon,
  canOpenOverlayOnUrl,
  canOpenUrlFromWebPageContext,
  isBrowserExtensionProtocol,
  isBrowserInternalUrl,
  isBrowserNewtabUrl,
  isRestrictedUrl
} from './url-guards';

const OWN_BASE = 'chrome-extension://lumno-id/';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('URL guards', () => {
  it('knows the extension protocols', () => {
    expect(isBrowserExtensionProtocol('chrome-extension:')).toBe(true);
    expect(isBrowserExtensionProtocol('https:')).toBe(false);
  });

  it('restricts the Firefox add-ons site only in Firefox', () => {
    expect(isRestrictedUrl('https://addons.mozilla.org/firefox/')).toBe(false);
    vi.stubGlobal('chrome', { runtime: { getURL: () => 'moz-extension://uuid/' } });
    expect(isRestrictedUrl('https://addons.mozilla.org/firefox/')).toBe(true);
  });

  it('tells the browser New Tab pages from other browser pages', () => {
    expect(isBrowserNewtabUrl('chrome://newtab/')).toBe(true);
    expect(isBrowserNewtabUrl('chrome://new-tab-page/')).toBe(true);
    expect(isBrowserNewtabUrl('edge://newtab/')).toBe(true);
    expect(isBrowserNewtabUrl('chrome://extensions/')).toBe(false);
  });

  it('knows the browser internal pages', () => {
    expect(isBrowserInternalUrl('chrome://extensions/')).toBe(true);
    expect(isBrowserInternalUrl('about:blank')).toBe(true);
    expect(isBrowserInternalUrl('https://example.com/')).toBe(false);
  });

  it('restricts browser, extension and store pages', () => {
    expect(isRestrictedUrl('chrome://extensions/')).toBe(true);
    expect(isRestrictedUrl('chrome-extension://abc/newtab.html')).toBe(true);
    expect(isRestrictedUrl('https://chromewebstore.google.com/detail/example/abc')).toBe(true);
    expect(isRestrictedUrl('https://chrome.google.com/webstore/detail/example/abc')).toBe(true);
    expect(isRestrictedUrl('https://microsoftedge.microsoft.com/addons/detail/example/abc')).toBe(true);
    expect(isRestrictedUrl('https://example.com/release/')).toBe(false);
  });

  it('opens the overlay on files and web pages but not on a store', () => {
    expect(canOpenOverlayOnUrl('file:///Users/kevinxu/test.html')).toBe(true);
    expect(canOpenOverlayOnUrl('https://x.com/home')).toBe(true);
    expect(canOpenOverlayOnUrl('https://chromewebstore.google.com/detail/example/abc')).toBe(false);
  });

  it('fetches only ordinary web pages for a favicon', () => {
    expect(canFetchPageForFavicon('https://example.com/')).toBe(true);
    expect(canFetchPageForFavicon('https://chromewebstore.google.com/detail/example/abc')).toBe(false);
    expect(canFetchPageForFavicon('https://chrome.google.com/webstore/devconsole/abc')).toBe(false);
    expect(canFetchPageForFavicon('file:///Users/kevinxu/test.html')).toBe(false);
  });

  it.each([
    'https://example.com/path?q=1',
    'http://intranet.local/',
    'file:///Users/someone/report.pdf',
    'mailto:someone@example.com',
    'chrome://settings/',
    'about:blank',
    'view-source:https://example.com/',
    `${OWN_BASE}src/options/options.html#search`
  ])('lets a web page context open %s', (url) => {
    expect(canOpenUrlFromWebPageContext(url, OWN_BASE)).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    ' JavaScript:alert(1)',
    'data:text/html,<form>',
    'vbscript:msgbox',
    'view-source:data:text/html,x',
    'chrome-extension://another-id/options.html',
    'moz-extension://another-uuid/page.html',
    'not a url',
    ''
  ])('does not let a web page context open %j', (url) => {
    expect(canOpenUrlFromWebPageContext(url, OWN_BASE)).toBe(false);
  });

  it('treats no extension page as its own without a known base', () => {
    expect(canOpenUrlFromWebPageContext(`${OWN_BASE}newtab.html`, '')).toBe(false);
  });
});
