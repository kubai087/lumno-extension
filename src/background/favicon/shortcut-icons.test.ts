import { Blob } from 'node:buffer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCachedIconSource, isCachedIconForPage, normalizePageUrl } from '../../domain/favicon/shortcut-favicon/persisted';
import { isFaviconIsUrl, isFaviconProxyUrl } from '../../domain/favicon/url-kinds';
import { faviconEnhancedFetchEnabled, faviconRequestBlacklist } from '../../domain/settings';
import { createBrowserFake } from '../../../tests/fakes/browser';
import { createFaviconNetwork, dataUrl, png, type FaviconNetworkOptions } from '../../../tests/fakes/favicon-network';
import { required } from '../../../tests/fakes/dom';

// How the worker acquires a shortcut's icon: from the browser cache or an
// icon service, under the favicon policy, over a fake network.

const PAGE = 'https://developer.chrome.com/docs/extensions/?view=read#intro';
const NORMALIZED_PAGE = normalizePageUrl(PAGE);
const isBrowserUrl = (url: string) => url.startsWith('chrome-extension://lumno/_favicon/');

interface FirefoxIcons {
  tabs?: Array<{ url: string; favIconUrl: string }>;
  topSites?: Array<{ url: string; favicon: string }>;
  images: Record<string, Uint8Array>;
}

interface WorkerOptions extends FaviconNetworkOptions {
  enhanced?: boolean;
  excluded?: boolean;
  firefox?: FirefoxIcons;
}

// A freshly started worker. `enhanced: false` turns enhanced fetching off,
// `excluded` adds the page's site to the favicon request exclusions and
// `firefox` runs it as Firefox with the icons Firefox reports.
async function startWorker(options: WorkerOptions = {}) {
  const firefox = options.firefox;
  const network = createFaviconNetwork(firefox ? { images: firefox.images } : options);
  const browser = createBrowserFake({
    sync: {
      [faviconEnhancedFetchEnabled.key]: options.enhanced !== false,
      ...(options.excluded ? { [faviconRequestBlacklist.key]: [{ pattern: 'chrome.com', matchModes: ['suffix'] }] } : {})
    }
  });
  vi.stubGlobal('chrome', firefox ? {
    ...browser,
    runtime: { ...browser.runtime, getURL: (path: string) => `moz-extension://lumno/${path.replace(/^\//, '')}` },
    tabs: { ...browser.tabs, query: async () => firefox.tabs || [] },
    topSites: { get: async () => firefox.topSites || [] }
  } : browser);
  vi.stubGlobal('fetch', vi.fn(network.fetch));
  vi.resetModules();
  const service = await import('./shortcut-icons');
  return {
    network,
    calls: () => network.state.calls,
    icon: (pageUrl: string, refresh = false, iconSource = '') => service.fetchShortcutFaviconData(pageUrl, '', '', refresh, iconSource)
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('shortcut icons from the icon services', () => {
  it('tells the service only the site origin, with no credentials, referrer or redirects', async () => {
    const worker = await startWorker();
    const result = required(await worker.icon(PAGE, false, 'service'));
    expect(new URL(result.sourceUrl).searchParams.get('url')).toBe(`${new URL(NORMALIZED_PAGE).origin}/`);
    expect(worker.calls()).toHaveLength(1);
    worker.calls().forEach((call) => {
      expect([call.options.credentials, call.options.referrerPolicy, call.options.redirect]).toEqual(['omit', 'no-referrer', 'error']);
    });
  });

  it('answers later reads from memory and lets a manual refresh revalidate the HTTP cache', async () => {
    const worker = await startWorker();
    const first = required(await worker.icon(PAGE, false, 'service'));
    worker.network.state.proxyImage = png(128, 9);
    expect(await worker.icon(PAGE, false, 'service')).toEqual(first);
    const refreshed = required(await worker.icon(PAGE, true, 'service'));
    expect(refreshed.data).not.toBe(first.data);
    expect(worker.calls()[1].options.cache).toBe('reload');
  });

  it('keeps valid small service artwork', async () => {
    const worker = await startWorker({ proxyImage: png(32) });
    expect(required(await worker.icon(PAGE, false, 'service')).width).toBe(32);
  });

  it('keeps each source to its own requests and its own memory cache', async () => {
    const worker = await startWorker();
    const cacheOnly = required(await worker.icon(PAGE, false, 'cache'));
    expect(isBrowserUrl(cacheOnly.sourceUrl)).toBe(true);
    expect(worker.calls().every((call) => call.url.startsWith('chrome-extension:'))).toBe(true);
    expect(new URL(cacheOnly.sourceUrl).searchParams.get('pageUrl')).toBe(NORMALIZED_PAGE);

    worker.calls().length = 0;
    const serviceOnly = required(await worker.icon(PAGE, false, 'service'));
    expect(isFaviconProxyUrl(serviceOnly.sourceUrl)).toBe(true);
    expect(worker.calls().every((call) => isFaviconProxyUrl(call.url))).toBe(true);
    expect(isCachedIconForPage(serviceOnly, NORMALIZED_PAGE)).toBe(true);
    expect(isCachedIconForPage(serviceOnly, 'https://other.chrome.com/docs/')).toBe(false);
    expect(isCachedIconForPage(cacheOnly, 'https://developer.chrome.com/')).toBe(false);

    worker.calls().length = 0;
    worker.network.state.proxyImage = png(128, 25);
    const faviconIs = required(await worker.icon(PAGE, false, 'favicon-is'));
    expect(isFaviconIsUrl(faviconIs.sourceUrl)).toBe(true);
    expect(faviconIs.data).not.toBe(serviceOnly.data);
    expect(worker.calls().every((call) => isFaviconIsUrl(call.url))).toBe(true);
    expect(new URL(faviconIs.sourceUrl).pathname).toBe('/developer.chrome.com');
    expect(new URL(faviconIs.sourceUrl).search).toBe('?larger=true');
    expect(getCachedIconSource(faviconIs)).toBe('favicon-is');
    expect(isCachedIconForPage(faviconIs, NORMALIZED_PAGE)).toBe(true);
    expect(isCachedIconForPage(faviconIs, 'https://other.chrome.com/docs/')).toBe(false);

    worker.calls().length = 0;
    worker.network.state.proxyMode = 'error';
    expect(await worker.icon(PAGE, true, 'service')).toBeNull();
    expect(worker.calls().every((call) => isFaviconProxyUrl(call.url))).toBe(true);
  });

  it('reports a failing Favicon.is without falling back to another source', async () => {
    const worker = await startWorker({ proxyMode: 'error' });
    expect(await worker.icon(PAGE, true, 'favicon-is')).toBeNull();
    expect(worker.calls().every((call) => isFaviconIsUrl(call.url))).toBe(true);
  });

  it('gives up on a Favicon.is that does not answer, without falling back to another source', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const worker = await startWorker({ proxyMode: 'timeout' });
    const pending = worker.icon(PAGE, true, 'favicon-is');
    await vi.advanceTimersByTimeAsync(7000);
    expect(await pending).toBeNull();
    expect(worker.calls().every((call) => isFaviconIsUrl(call.url))).toBe(true);
  });

  it('rejects Favicon.is placeholders even at the requested large size', async () => {
    const worker = await startWorker({ proxyImage: png(128, 0), placeholderImage: png(128, 0) });
    expect(await worker.icon(PAGE, false, 'favicon-is')).toBeNull();
  });

  it.each([{ excluded: true }, { enhanced: false, excluded: true }])('asks Favicon.is nothing for an excluded site (%o)', async (options) => {
    const worker = await startWorker(options);
    expect(await worker.icon(PAGE, false, 'favicon-is')).toBeNull();
    expect(worker.calls()).toHaveLength(0);
  });

  it.each(['service', 'favicon-is'])('keeps %s available with enhanced fetching off', async (iconSource) => {
    const worker = await startWorker({ enhanced: false });
    expect(required(await worker.icon(PAGE, false, iconSource)).data.startsWith('data:image/png;base64,')).toBe(true);
    expect(worker.calls().every((call) => isFaviconProxyUrl(call.url))).toBe(true);
  });

  it('rejects the service\'s generic placeholder and responses that are no icon', async () => {
    expect(await (await startWorker({ proxyImage: png(16, 0) })).icon(PAGE, false, 'service')).toBeNull();
    expect(await (await startWorker({ proxyImage: new TextEncoder().encode('<html>not an icon</html>') })).icon(PAGE, false, 'service')).toBeNull();
  });
});

describe('shortcut icons acquired automatically', () => {
  it('falls back to the service when the browser has no image, even with enhanced fetching off', async () => {
    const worker = await startWorker({ enhanced: false, browserImage: null });
    expect(required(await worker.icon(PAGE)).sourceUrl.startsWith('https://t2.gstatic.cn/')).toBe(true);
  });

  it.each(['error', 'timeout'] as const)('uses the exact-page browser icon and asks no service when it is there (service %s)', async (proxyMode) => {
    const worker = await startWorker({ proxyMode });
    const result = required(await worker.icon(PAGE));
    expect(isBrowserUrl(result.sourceUrl)).toBe(true);
    expect(result.width).toBe(32);
    expect(worker.calls().every((call) => call.url.startsWith('chrome-extension:'))).toBe(true);
  });

  it('still reads the browser cache for an excluded site', async () => {
    const worker = await startWorker({ excluded: true });
    expect(isBrowserUrl(required(await worker.icon(PAGE)).sourceUrl)).toBe(true);
    expect(worker.calls().every((call) => call.url.startsWith('chrome-extension:'))).toBe(true);
  });

  it('does not keep the browser\'s placeholder globe, and retries once real artwork is there', async () => {
    const worker = await startWorker({ enhanced: false, browserImage: png(16, 0), proxyImage: null });
    expect(await worker.icon(PAGE)).toBeNull();
    worker.network.state.browserImage = png(16, 8);
    expect(await worker.icon(PAGE)).toBeTruthy();
  });

  it('asks the service about the origin when the browser has no icon for the page', async () => {
    const worker = await startWorker({ browserImage: png(16, 0) });
    expect(required(await worker.icon(PAGE)).sourceUrl.startsWith('https:')).toBe(true);
  });
});

// Same-host pages keep their own browser artwork; the service, told only
// the origin, answers once for all of them.
describe('shortcut icons of pages on one host', () => {
  const pages = ['https://chrome.google.com/', 'https://chrome.google.com/webstore/devconsole?hl=zh-cn',
    'https://chrome.google.com/webstore/devconsole?hl=en', 'https://chrome.google.com/webstore/',
    'https://chrome.google.com/webstore', 'https://chrome.google.com/apps%2Fpreview'];
  const pageImages = Object.fromEntries(pages.map((url, index) => [url, { browser: png(32, index + 10), proxy: png(128, index + 20) }]));

  it('keeps separate browser artwork for paths, queries, trailing slashes and encoded slashes', async () => {
    const worker = await startWorker({ pageImages });
    const results = (await Promise.all(pages.map((url) => worker.icon(url, false, 'cache')))).map((result) => required(result));
    expect(new Set(results.map((result) => result.data)).size).toBe(pages.length);
    results.forEach((result, index) => {
      expect(new URL(result.sourceUrl).searchParams.get('pageUrl')).toBe(pages[index]);
    });
  });

  it('shares the service artwork between the pages of one origin', async () => {
    const worker = await startWorker({ pageImages });
    const results = (await Promise.all(pages.map((url) => worker.icon(url, false, 'service')))).map((result) => required(result));
    expect(new Set(results.map((result) => result.data)).size).toBe(1);
    results.forEach((result) => {
      expect(new URL(result.sourceUrl).searchParams.get('url')).toBe('https://chrome.google.com/');
    });
  });
});

// Firefox has no _favicon endpoint: its cache source reads the data: icons
// Firefox reports for open tabs and top sites, and never contacts the site.
describe('shortcut icons from Firefox\'s icon cache', () => {
  const page = 'https://example.com/';

  it('prefers an open tab\'s current icon over top sites on the same site', async () => {
    const tabIcon = dataUrl(png(32, 5));
    const worker = await startWorker({ firefox: {
      tabs: [{ url: 'https://www.example.com/docs', favIconUrl: tabIcon }],
      topSites: [{ url: 'https://example.com/blog', favicon: 'data:image/png;base64,AAAA' }],
      images: { [tabIcon]: png(32, 5) }
    } });
    const result = required(await worker.icon(page, false, 'cache'));
    expect(worker.calls().map((call) => call.url)).toEqual([tabIcon]);
    expect(getCachedIconSource(result)).toBe('cache');
    expect(isCachedIconForPage(result, page)).toBe(true);
  });

  it('reads a top site\'s icon', async () => {
    const topSiteIcon = dataUrl(png(32, 6));
    const worker = await startWorker({ firefox: { topSites: [{ url: page, favicon: topSiteIcon }], images: { [topSiteIcon]: png(32, 6) } } });
    expect(await worker.icon(page, false, 'cache')).toBeTruthy();
    expect(worker.calls().map((call) => call.url)).toEqual([topSiteIcon]);
  });

  it('makes no request to the site when only a remote icon URL is known', async () => {
    const worker = await startWorker({ firefox: {
      tabs: [{ url: page, favIconUrl: 'https://example.com/favicon.ico' }],
      images: { 'https://example.com/favicon.ico': png(32, 7) }
    } });
    expect(await worker.icon(page, false, 'cache')).toBeNull();
    expect(worker.calls()).toEqual([]);
  });
});

// A worker whose network answers each icon request with `answer(url)`: an
// image, null for a failed request, or a promise of either. Icons are told
// apart by their marker byte; the placeholder probe answers with its own.
async function startPolicyWorker() {
  const browser = createBrowserFake({ sync: { [faviconEnhancedFetchEnabled.key]: true } });
  const requests: string[] = [];
  const network = { answer: (_url: string): Uint8Array | null | Promise<Uint8Array | null> => png(64, 1) };
  vi.stubGlobal('chrome', browser);
  vi.stubGlobal('fetch', vi.fn(async (input: unknown) => {
    const url = String(input);
    if (url.includes('/_locales/')) throw new Error('offline');
    requests.push(url);
    const image = await (url.includes('lumno.invalid') ? png(16, 0) : network.answer(url));
    return { ok: Boolean(image), url, headers: { get: () => '' }, blob: async () => new Blob(image ? [image] : [], { type: 'image/png' }) };
  }));
  vi.resetModules();
  const service = await import('./shortcut-icons');
  return {
    network,
    requests,
    async marker(pageUrl: string, refresh = false): Promise<number | null> {
      const result = await service.fetchShortcutFaviconData(pageUrl, '', '', refresh);
      return result ? Buffer.from(result.data.split(',')[1], 'base64')[24] : null;
    },
    change: (values: Record<string, unknown>) => browser.storage.sync.externalSet(values),
    asked: (count: number) => vi.waitFor(() => expect(requests.length).toBeGreaterThanOrEqual(count))
  };
}

function deferred() {
  let resolve: (image: Uint8Array) => void = () => {};
  const promise = new Promise<Uint8Array>((done) => { resolve = done; });
  return { promise, resolve: (image: Uint8Array) => resolve(image) };
}

// The worker caches shortcut icons by page. A miss is not cached, a hit is,
// and changing the favicon policy drops what it has, including answers
// still in flight. An explicit refresh never joins an older request.
describe('the worker\'s shortcut icon cache', () => {
  it('retries a miss, answers a hit from the cache, and drops it when the favicon policy changes', async () => {
    const worker = await startPolicyWorker();
    worker.network.answer = () => null;
    expect(await worker.marker('https://temporary-miss.example/')).toBeNull();
    worker.network.answer = () => png(64, 2);
    expect(await worker.marker('https://temporary-miss.example/')).toBe(2);
    const afterHit = worker.requests.length;
    expect(await worker.marker('https://temporary-miss.example/')).toBe(2);
    expect(worker.requests).toHaveLength(afterHit);

    worker.network.answer = () => png(64, 3);
    worker.change({ [faviconRequestBlacklist.key]: [] });
    expect(await worker.marker('https://temporary-miss.example/')).toBe(3);
    worker.network.answer = () => png(64, 4);
    worker.change({ [faviconEnhancedFetchEnabled.key]: false });
    expect(await worker.marker('https://temporary-miss.example/')).toBe(4);
  });

  it('does not let an answer from before a policy change into the cache', async () => {
    const worker = await startPolicyWorker();
    const old = deferred();
    worker.network.answer = () => old.promise;
    const stale = worker.marker('https://stale.example/');
    await worker.asked(1);
    worker.change({ [faviconRequestBlacklist.key]: ['policy-1.example'] });
    worker.network.answer = () => png(64, 5);
    expect(await worker.marker('https://stale.example/')).toBe(5);
    old.resolve(png(64, 6));
    await stale;
    expect(await worker.marker('https://stale.example/')).toBe(5);

    const lone = deferred();
    worker.network.answer = () => lone.promise;
    const before = worker.requests.length;
    const loneRequest = worker.marker('https://lone.example/');
    await worker.asked(before + 1);
    worker.change({ [faviconRequestBlacklist.key]: ['policy-2.example'] });
    lone.resolve(png(64, 9));
    await loneRequest;
    worker.network.answer = () => png(64, 10);
    expect(await worker.marker('https://lone.example/')).toBe(10);
  });

  it('does not join an older request on refresh, nor let its late answer overwrite the refreshed icon', async () => {
    const worker = await startPolicyWorker();
    const automatic = deferred();
    worker.network.answer = () => automatic.promise;
    const beforeRefresh = worker.marker('https://refresh.example/');
    await worker.asked(1);
    worker.network.answer = () => png(64, 7);
    expect(await worker.marker('https://refresh.example/', true)).toBe(7);
    automatic.resolve(png(64, 8));
    await beforeRefresh;
    expect(await worker.marker('https://refresh.example/')).toBe(7);
  });
});

describe('shortcut icons and redirects', () => {
  it('fetches only approved sources, never a URL the page supplied, and gives no icon for a source that redirects', async () => {
    const calls: { url: string; redirect?: RequestRedirect }[] = [];
    vi.stubGlobal('chrome', createBrowserFake({ sync: { [faviconEnhancedFetchEnabled.key]: true } }));
    vi.stubGlobal('fetch', vi.fn(async (input: unknown, init?: RequestInit) => {
      calls.push({ url: String(input), redirect: init && init.redirect });
      if (!init || init.redirect !== 'error') return { ok: true, url: 'http://127.0.0.1/internal' };
      throw new TypeError('redirect blocked');
    }));
    vi.resetModules();
    const service = await import('./shortcut-icons');

    expect(await service.fetchShortcutFaviconData('https://public.example/', '', 'http://127.0.0.1/internal', true, 'service')).toBeNull();
    expect(calls.length).toBeGreaterThan(0);
    calls.forEach((call) => {
      expect(call.redirect).toBe('error');
      expect(call.url).toMatch(/^(chrome-extension:\/\/lumno\/_favicon\/|https:\/\/t2\.gstatic\.cn\/faviconV2|https:\/\/favicon\.is\/)/);
    });
  });
});
