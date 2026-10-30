import { describe, expect, it } from 'vitest';
import { getPageUrlFromFaviconProxyUrl } from './canonical';
import { getFaviconIsUrl } from './candidate-urls';
import { createFaviconUrlResolver } from './resolver';

const getRuntimeUrl = (path: string) => `chrome-extension://abc${path}`;
const BUNDLED_TILE = 'chrome-extension://abc/assets/images/site-search/tile-ddg.png';
const PAGE = 'https://foo.example.com/account';
const PAGE_ICON = 'https://foo.example.com/favicon.ico?unread=3';
const CUSTOM_PROVIDER_ICON = 'https://cdn.example.com/custom-search.png';
const NESTED_PAGE = 'https://chrome.google.com/webstore/devconsole?hl=zh-CN';
const DIFFERENT_PAGES = [
  'https://chrome.google.com/',
  'https://chrome.google.com/webstore/',
  'https://chrome.google.com/webstore/devconsole?hl=en',
  'https://chrome.google.com/webstore/devconsole/?hl=zh-CN',
  'https://chrome.google.com/webstore%2Fdevconsole?hl=zh-CN',
  'http://chrome.google.com/webstore/devconsole?hl=zh-CN',
  'https://chrome.google.com:8443/webstore/devconsole?hl=zh-CN',
  'https://www.chrome.google.com/webstore/devconsole?hl=zh-CN'
];

function createStrictResolver(enhanced: boolean) {
  return { resolver: createFaviconUrlResolver({ getRuntimeUrl, isEnhancedFaviconFetchEnabled: () => enhanced }) };
}

function urls(candidates: Array<{ url: string }>): string[] {
  return candidates.map((candidate) => candidate.url);
}

describe('favicon resolver with enhanced fetching off', () => {
  it('plans the browser cache and the approved service, never the site\'s own icon file', () => {
    const { resolver } = createStrictResolver(false);
    expect(urls(resolver.buildFaviconCandidatePlan({ pageUrl: 'https://foo.example.com/', primaryUrl: 'https://foo.example.com/favicon.ico' })))
      .toEqual([
        'chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Ffoo.example.com%2F&size=128&fallbackToHost=0',
        'https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=https%3A%2F%2Ffoo.example.com%2F&size=128'
      ]);
  });

  it('keeps Lumno\'s own _favicon endpoint and bundled artwork, and drops other extensions\' endpoints', () => {
    const { resolver } = createStrictResolver(false);
    const own = 'chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Ffoo.example.com%2F&fallbackToHost=0';
    expect(resolver.getSafeFaviconCandidateUrl(own, 'https://foo.example.com/', 'browser-cache')).toBe(own);
    expect(resolver.getSafeFaviconCandidateUrl(BUNDLED_TILE, BUNDLED_TILE, 'bundled-provider')).toBe(BUNDLED_TILE);
    expect(resolver.getSafeFaviconCandidateUrl('chrome-extension://other/_favicon/?pageUrl=https%3A%2F%2Ffoo.example.com%2F',
      'https://foo.example.com/', 'browser-cache')).toBe('');
  });
});

describe('favicon resolver matching a source to its page', () => {
  it('rejects root-page browser artwork for another page and reacquires the exact page', () => {
    const { resolver } = createStrictResolver(true);
    const stale = resolver.getExtensionFaviconUrl('https://foo.example.com/');
    expect(resolver.getSafeFaviconCandidateUrl(stale, PAGE)).toBe('');
    expect(resolver.resolveFaviconSource(stale, PAGE)).toBe(resolver.getExtensionFaviconUrl(PAGE));
  });

  it('shares browser-cache artwork only between fragments of one document', () => {
    const { resolver } = createStrictResolver(true);
    for (const getSource of [(page: string) => resolver.getExtensionFaviconUrl(page), (page: string) => resolver.getChromeFaviconUrl(page)]) {
      DIFFERENT_PAGES.forEach((page) => {
        expect(resolver.getSafeFaviconCandidateUrl(getSource(page), NESTED_PAGE), page).toBe('');
      });
      expect(resolver.getSafeFaviconCandidateUrl(getSource(`${NESTED_PAGE}#intro`), NESTED_PAGE)).toBeTruthy();
    }
  });

  it('shares service artwork within an origin but never across schemes, ports or subdomains', () => {
    const { resolver } = createStrictResolver(true);
    DIFFERENT_PAGES.forEach((page) => {
      const sameOrigin = new URL(page).origin === new URL(NESTED_PAGE).origin;
      expect(Boolean(resolver.getSafeFaviconCandidateUrl(resolver.getGstaticFaviconUrl(page), NESTED_PAGE)), page).toBe(sameOrigin);
    });
    expect(resolver.getSafeFaviconCandidateUrl(
      `https://t2.gstatic.cn/faviconV2?url=${encodeURIComponent('https://chrome.google.com/webstore/')}`, NESTED_PAGE)).toBe('');
  });

  it('replaces an old chrome://favicon2 source with the exact-page extension endpoint', () => {
    const { resolver } = createStrictResolver(true);
    const old = `chrome://favicon2/?url=${encodeURIComponent(NESTED_PAGE)}&fallbackToHost=1`;
    const normalized = new URL(resolver.getSafeFaviconCandidateUrl(old, NESTED_PAGE));
    expect(normalized.protocol).toBe('chrome-extension:');
    expect(normalized.searchParams.get('pageUrl')).toBe(NESTED_PAGE);
    expect(normalized.searchParams.has('url')).toBe(false);
    expect(normalized.searchParams.get('fallbackToHost')).toBe('0');
  });

  it('keeps the requested page when callers supply their own source URLs, but tells the service only the origin', () => {
    const { resolver: strict } = createStrictResolver(true);
    const overridden = createFaviconUrlResolver({
      getRuntimeUrl,
      getExtensionFaviconUrl: () => strict.getExtensionFaviconUrl('https://foo.example.com/'),
      getChromeFaviconUrl: () => strict.getChromeFaviconUrl('https://foo.example.com/'),
      getGstaticFaviconUrl: () => strict.getGstaticFaviconUrl('https://foo.example.com/')
    });
    expect(getPageUrlFromFaviconProxyUrl(overridden.getExtensionFaviconUrl(PAGE))).toBe(PAGE);
    expect(getPageUrlFromFaviconProxyUrl(overridden.getChromeFaviconUrl(PAGE))).toBe(PAGE);
    expect(getPageUrlFromFaviconProxyUrl(overridden.getGstaticFaviconUrl(PAGE))).toBe('https://foo.example.com/');
  });
});

describe('favicon resolver with enhanced fetching on', () => {
  it('resolves a tab\'s icon URL through the browser and never uses the site\'s file', () => {
    const { resolver } = createStrictResolver(true);
    expect(resolver.resolveFaviconSource(PAGE_ICON, PAGE)).toBe(resolver.getExtensionFaviconUrl(PAGE));
    expect(resolver.getSafeFaviconCandidateUrl(PAGE_ICON, PAGE)).toBe('');
    expect(resolver.getProviderFaviconUrl(PAGE, CUSTOM_PROVIDER_ICON)).toBe(CUSTOM_PROVIDER_ICON);
  });

  it('plans cached bytes first, then the browser, then a service, and no old site icon URL', () => {
    const { resolver } = createStrictResolver(true);
    const plan = resolver.buildFaviconCandidatePlan({
      pageUrl: PAGE,
      primaryUrl: PAGE_ICON,
      persistedUrl: PAGE_ICON,
      persistedDataUrl: 'data:image/png;base64,Y2FjaGVk'
    });
    expect(plan[0].url).toBe('data:image/png;base64,Y2FjaGVk');
    expect(plan[1].url).toBe(resolver.getExtensionFaviconUrl(PAGE));
    expect(urls(plan)).not.toContain(PAGE_ICON);
    expect(plan[2].url).toContain('gstatic.cn/faviconV2');
    expect(urls(resolver.buildFaviconCandidatePlan({ pageUrl: 'https://foo.example.com/', primaryUrl: 'https://foo.example.com/favicon.ico' })))
      .toContainEqual(expect.stringContaining('gstatic.cn/faviconV2'));
  });

  it('renders a shortcut from its saved image only, with no live browser or remote fallback', () => {
    const { resolver } = createStrictResolver(true);
    const browserUrl = resolver.getExtensionFaviconUrl(PAGE);
    expect(urls(resolver.buildFaviconCandidatePlan({
      pageUrl: PAGE,
      sourceProfile: 'shortcut',
      skipPersisted: true,
      primaryUrl: browserUrl,
      pageSpecificUrl: 'data:image/png;base64,c25hcHNob3Q='
    }))).toEqual(['data:image/png;base64,c25hcHNob3Q=']);
    expect(resolver.buildFaviconCandidatePlan({ pageUrl: PAGE, sourceProfile: 'shortcut', skipPersisted: true })).toHaveLength(0);
    const bundled = 'chrome-extension://abc/assets/images/site-search/tile-xhs.png';
    expect(resolver.getShortcutFaviconCandidateUrl(PAGE, bundled)).toBe(bundled);
    expect(resolver.getShortcutFaviconCandidateUrl(PAGE, browserUrl)).toBe('');
  });

  it('acquires a shortcut icon from the exact-page browser cache first, then the service told only the origin', () => {
    const { resolver } = createStrictResolver(true);
    expect(new URL(resolver.getShortcutFaviconFetchUrl(`${PAGE}?unread=3#section`)).searchParams.get('url')).toBe('https://foo.example.com/');
    expect(new URL(resolver.getExtensionFaviconUrl(PAGE)).searchParams.get('fallbackToHost')).toBe('0');
    expect(resolver.getShortcutFaviconFetchCandidates(PAGE).map((candidate) => candidate.kind)).toEqual(['browser-cache', 'proxy']);
  });

  it('asks Favicon.is for the host only, and accepts its answer for that host alone', () => {
    const { resolver } = createStrictResolver(true);
    const candidates = resolver.getShortcutFaviconFetchCandidates(`${PAGE}?private=1#section`, 'favicon-is');
    expect(urls(candidates)).toEqual(['https://favicon.is/foo.example.com?larger=true']);
    const faviconIs = candidates[0].url;
    expect(resolver.getSafeFaviconCandidateUrl(faviconIs, PAGE)).toBe('');
    expect(resolver.getSafeFaviconCandidateUrl(faviconIs, PAGE, 'shortcut-snapshot', { allowDomainProxy: true })).toBe(faviconIs);
    expect(resolver.getSafeFaviconCandidateUrl('https://favicon.is/other.example.com?larger=true', PAGE, 'shortcut-snapshot',
      { allowDomainProxy: true })).toBe('');
    expect(resolver.getSafeFaviconCandidateUrl(resolver.getExtensionFaviconUrl('https://foo.example.com/'), PAGE, 'shortcut-snapshot',
      { allowDomainProxy: true })).toBe('');
    expect(resolver.getShortcutFaviconFetchCandidates('chrome://settings/', 'favicon-is')).toHaveLength(0);
  });

  it('respects host blocks for Favicon.is', () => {
    const blocked = createFaviconUrlResolver({ shouldBlockFaviconForHost: (host) => host === 'foo.example.com' });
    expect(blocked.getShortcutFaviconFetchCandidates(PAGE, 'favicon-is')).toHaveLength(0);
  });
});

describe('favicon resolver acquiring shortcut icons with enhanced fetching off', () => {
  it('keeps the approved services for shortcut acquisition, after the browser cache', () => {
    const { resolver } = createStrictResolver(false);
    expect(resolver.getShortcutFaviconFetchCandidates(PAGE, 'favicon-is')).toHaveLength(1);
    expect(resolver.getShortcutFaviconFetchUrl(PAGE).startsWith('https://t2.gstatic.cn/')).toBe(true);
    expect(urls(resolver.getShortcutFaviconFetchCandidates(PAGE)))
      .toEqual([resolver.getExtensionFaviconUrl(PAGE), resolver.getShortcutFaviconFetchUrl(PAGE)]);
  });

  it('keeps bundled artwork and local bytes but not custom remote artwork', () => {
    const { resolver } = createStrictResolver(false);
    const bundled = 'chrome-extension://abc/assets/images/site-search/tile-xhs.png';
    expect(resolver.getShortcutFaviconCandidateUrl(PAGE, bundled)).toBe(bundled);
    expect(resolver.getProviderFaviconUrl(PAGE, CUSTOM_PROVIDER_ICON)).toBe(resolver.getExtensionFaviconUrl(PAGE));
    expect(resolver.getProviderFaviconUrl(PAGE, BUNDLED_TILE)).toBe(BUNDLED_TILE);
    expect(resolver.resolveFaviconSource('data:image/png;base64,Y2FjaGVk', PAGE)).toBe('data:image/png;base64,Y2FjaGVk');
  });
});

describe('favicon resolver with a page excluded', () => {
  const PRIVATE = 'https://foo.example.com/private';
  const excluded = createFaviconUrlResolver({
    getRuntimeUrl,
    isEnhancedFaviconFetchEnabled: (pageUrl) => pageUrl !== PRIVATE,
    getStrictFaviconReason: (pageUrl) => (pageUrl === PRIVATE ? 'exclusion' : '')
  });

  it('asks no service about the excluded page', () => {
    expect(excluded.getShortcutFaviconFetchUrl(PRIVATE)).toBe('');
    expect(excluded.getShortcutFaviconFetchCandidates(PRIVATE, 'favicon-is')).toHaveLength(0);
  });

  it('keeps only the browser cache for the excluded path and everything for the other paths', () => {
    expect(urls(excluded.buildFaviconCandidatePlan({ pageUrl: PRIVATE, primaryUrl: 'https://foo.example.com/favicon.ico' })))
      .toEqual(['chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Ffoo.example.com%2Fprivate&size=128&fallbackToHost=0']);
    expect(urls(excluded.buildFaviconCandidatePlan({ pageUrl: 'https://foo.example.com/public', primaryUrl: 'https://foo.example.com/favicon.ico' })))
      .toContainEqual(expect.stringContaining('gstatic.cn/faviconV2'));
  });
});

describe('favicon resolver for pages and extension pages', () => {
  const resolver = createFaviconUrlResolver({
    getRuntimeUrl,
    shouldBlockFaviconForHost: (host) => ['extensions', '127.0.0.1'].includes(String(host || '').toLowerCase())
  });

  it('prefers the extension endpoint for web pages and the browser-page endpoint for browser pages', () => {
    const docs = 'chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fexample.com%2Fdocs&size=128&fallbackToHost=0';
    expect(resolver.getExtensionFaviconUrl('https://example.com/docs')).toBe(docs);
    expect(resolver.getPageFaviconCandidateUrl('https://example.com/docs')).toBe(docs);
    expect(resolver.getPageFaviconCandidateUrl('chrome://extensions/')).toBe('chrome-extension://abc/_favicon/?pageUrl=chrome%3A%2F%2Fextensions%2F&size=128');
    expect(resolver.getPageFaviconRenderCandidates('chrome://extensions/', '')).toEqual({
      primaryUrl: 'chrome-extension://abc/_favicon/?pageUrl=chrome%3A%2F%2Fextensions%2F&size=128',
      browserUrl: 'chrome://favicon2/?pageUrl=chrome%3A%2F%2Fextensions%2F&size=128'
    });
  });

  it('shows the Lumno icon for Lumno\'s pages and a generic fallback for other extensions\' pages', () => {
    expect(resolver.getPageFaviconCandidateUrl('chrome-extension://abc/src/options/options.html')).toBe('chrome-extension://abc/assets/images/lumno.png');
    expect(resolver.getPageFaviconCandidateUrl('chrome-extension://abc/newtab.html')).toBe('chrome-extension://abc/assets/images/lumno.png');
    expect(resolver.getPageFaviconCandidateUrl('chrome-extension://other/src/options/options.html')).toBe('');
    expect(resolver.getPageFaviconRenderCandidates('chrome-extension://other/src/options/options.html',
      'chrome://favicon2/?pageUrl=chrome-extension%3A%2F%2Fother%2Fsrc%2Foptions%2Foptions.html')).toEqual({ primaryUrl: '', browserUrl: '' });
  });

  it('blocks by the host a candidate asks about, not by a browser page\'s synthetic host', () => {
    expect(resolver.isBlockedFaviconUrl('chrome-extension://abc/_favicon/?pageUrl=chrome%3A%2F%2Fextensions%2F&size=128')).toBe(false);
    expect(resolver.getSafeFaviconCandidateUrl('chrome-extension://abc/_favicon/?pageUrl=http%3A%2F%2F127.0.0.1%2F&size=128&fallbackToHost=0')).toBe('');
  });

  it('drops the duplicate the chrome://favicon2 replacement makes and names each source\'s check', () => {
    const plan = resolver.buildFaviconCandidatePlan({
      primaryUrl: 'chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fexample.com%2Fdocs&size=128&fallbackToHost=0',
      browserUrl: 'chrome://favicon2/?pageUrl=https%3A%2F%2Fexample.com%2Fdocs&size=128',
      pageUrl: 'https://example.com/docs'
    });
    expect(plan.map((candidate) => candidate.kind)).toEqual(['primary', 'gstatic']);
    expect(resolver.getFaviconProxyCheckKind(plan[0])).toBe('extension');
    expect(resolver.getFaviconProxyCheckKind(plan[1])).toBe('gstatic');
  });

  it('puts a page\'s own icon before the browser and the service, and reads no shared host cache', () => {
    const plan = resolver.buildFaviconCandidatePlan({
      pageUrl: 'https://x.com/home',
      pageSpecificUrl: 'data:image/png;base64,eA==',
      persistedDataUrl: 'data:image/jpeg;base64,c3RhbGU=',
      persistedUrl: 'https://x.com/stale.ico',
      primaryUrl: 'chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fx.com%2Fhome&size=128&fallbackToHost=0',
      skipPersisted: true
    });
    expect(plan.map((candidate) => candidate.kind)).toEqual(['page-specific', 'primary', 'gstatic']);
    expect(plan[0].url).toBe('data:image/png;base64,eA==');
  });
});

describe('favicon resolver checks and plans', () => {
  const resolver = createFaviconUrlResolver({ getRuntimeUrl });

  it('names the proxy check by the candidate kind, or by the URL of a primary, page or saved URL candidate', () => {
    expect(resolver.getFaviconProxyCheckKind(null)).toBe('');
    expect(resolver.getFaviconProxyCheckKind({ kind: 'extension', url: '' })).toBe('');
    expect(resolver.getFaviconProxyCheckKind({ kind: 'extension', url: 'data:x' })).toBe('extension');
    expect(resolver.getFaviconProxyCheckKind({ kind: 'gstatic', url: 'data:x' })).toBe('gstatic');
    expect(resolver.getFaviconProxyCheckKind({ kind: 'browser', url: 'chrome-extension://abc/_favicon/?x=1' })).toBe('');
    const urlKinds: ReadonlyArray<'primary' | 'page-specific' | 'persisted-url'> = ['primary', 'page-specific', 'persisted-url'];
    for (const kind of urlKinds) {
      expect(resolver.getFaviconProxyCheckKind({ kind, url: ' chrome-extension://abc/_favicon/?x=1' })).toBe('extension');
      expect(resolver.getFaviconProxyCheckKind({ kind, url: 'https://t2.gstatic.cn/faviconV2?url=x' })).toBe('gstatic');
      expect(resolver.getFaviconProxyCheckKind({ kind, url: 'https://example.com/favicon.ico' })).toBe('');
    }
    expect(resolver.getFaviconProxyCheckKind({ kind: 'persisted-data', url: 'https://t2.gstatic.com/favicon' })).toBe('');
  });

  it("does not count other extensions' pages or Lumno's _favicon endpoint as Lumno pages", () => {
    const lumnoIcon = 'chrome-extension://abc/assets/images/lumno.png';
    expect(resolver.getPageFaviconRenderCandidates('chrome-extension://abc/options.html', '')).toEqual({ primaryUrl: lumnoIcon, browserUrl: '' });
    expect(resolver.getPageFaviconRenderCandidates('chrome-extension://other/popup.html', 'data:image/png;base64,QQ=='))
      .toEqual({ primaryUrl: '', browserUrl: '' });
    expect(resolver.getPageFaviconCandidateUrl('moz-extension://other/popup.html')).toBe('');
    expect(resolver.getSafeFaviconCandidateUrl('data:image/png;base64,QQ==', 'chrome-extension://other/popup.html')).toBe('');
    expect(resolver.getPageFaviconCandidateUrl('chrome-extension://abc/_favicon/?pageUrl=x')).not.toBe(lumnoIcon);
    expect(createFaviconUrlResolver({}).getPageFaviconCandidateUrl('chrome-extension://abc/newtab.html')).toBe('');
  });

  it("accepts the service's answer for the page's origin, and Favicon.is only when the caller opts in", () => {
    const page = 'https://docs.example.com/guide';
    const samePage = resolver.getGstaticFaviconUrl(page);

    expect(new URL(samePage).searchParams.get('url')).toBe('https://docs.example.com/');
    expect(resolver.getSafeFaviconCandidateUrl(samePage, page)).toBe(samePage);
    expect(resolver.getSafeFaviconCandidateUrl(resolver.getGstaticFaviconUrl('https://docs.example.com/'), page)).toBe(samePage);
    expect(resolver.getSafeFaviconCandidateUrl(resolver.getGstaticFaviconUrl('https://api.example.com/'), page)).toBe('');
    expect(resolver.getSafeFaviconCandidateUrl('https://favicon.is/docs.example.com', page)).toBe('');
    expect(resolver.getSafeFaviconCandidateUrl('https://favicon.is/docs.example.com', page, 'explicit', { allowDomainProxy: true }))
      .toBe('https://favicon.is/docs.example.com');
    expect(resolver.getSafeFaviconCandidateUrl('https://favicon.is/other.example.com', page, 'explicit', { allowDomainProxy: true })).toBe('');
  });

  it('acquires a shortcut icon from the sources its icon source names, each with its placeholder probe', () => {
    const blocking = createFaviconUrlResolver({ getRuntimeUrl, shouldBlockFaviconForHost: (host) => host === 'blocked.example.com' });
    const page = 'https://shop.example.com/cart#top';
    const kinds = (iconSource?: string) => blocking.getShortcutFaviconFetchCandidates(page, iconSource).map((candidate) => candidate.kind);

    expect(kinds()).toEqual(['browser-cache', 'proxy']);
    expect(kinds('service')).toEqual(['proxy']);
    expect(kinds('cache')).toEqual(['browser-cache']);
    const [faviconIs] = blocking.getShortcutFaviconFetchCandidates(page, 'favicon-is');
    expect(faviconIs).toMatchObject({ kind: 'favicon-is', url: getFaviconIsUrl(page), placeholderUrl: getFaviconIsUrl('https://lumno.invalid/') });
    const [browserCache, proxy] = blocking.getShortcutFaviconFetchCandidates(page);
    expect(browserCache.placeholderUrl).toContain('__favicon_placeholder_probe__');
    expect(proxy.placeholderUrl).toContain('lumno.invalid');
    expect(new URL(proxy.url).searchParams.get('url')).not.toContain('#');
    expect(blocking.getShortcutFaviconFetchCandidates('https://blocked.example.com/', 'service')).toEqual([]);
    expect(blocking.getShortcutFaviconFetchCandidates('chrome://settings/')).toEqual([]);
  });

  it('plans local artwork, then data:, then the browser cache, then remote services, with an opted-in remote primary beside data:', () => {
    const page = 'https://news.example.com/';
    expect(resolver.buildFaviconCandidatePlan({
      pageUrl: page,
      persistedDataUrl: 'data:image/png;base64,QQ==',
      primaryUrl: 'chrome-extension://abc/assets/images/site-search/tile.png'
    }).map((candidate) => candidate.kind)).toEqual(['primary', 'persisted-data', 'extension', 'gstatic']);
    expect(resolver.buildFaviconCandidatePlan({
      pageUrl: page,
      primaryUrl: 'https://cdn.example.net/logo.png',
      persistedDataUrl: 'data:image/png;base64,QQ==',
      allowRemoteImage: true
    }).map((candidate) => candidate.kind)).toEqual(['persisted-data', 'primary', 'extension', 'gstatic']);
  });
});
