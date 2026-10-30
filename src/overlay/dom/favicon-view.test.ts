import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOverlayFaviconViewRuntime, type OverlayFaviconViewOptions } from './favicon-view';
import type { FaviconViewCoreOptions } from '../../shared/favicon/favicon-view-core';
import { required } from '../../../tests/fakes/dom';

// Which icon sources the overlay's rows try, and how: on a web page the
// overlay renders only bytes the worker fetched (never a _favicon, service or
// local-network URL), keeps excluded pages to the browser's own cache, and
// gets failed rows to try again when the policy allows more. The view core
// is replaced by one that records what it is asked to load and shows a
// source at once (JSDOM loads no image); how the overlay wires this runtime
// into its rows is covered by tests/pages/overlay/favicon-policy.test.ts.

const core = vi.hoisted(() => {
  const preloaded: string[] = [];
  const attachedData: string[] = [];
  const attachedDataPages: string[] = [];
  const warmed: Array<ReadonlyArray<{ favicon?: string } | null>> = [];
  return { preloaded, attachedData, attachedDataPages, warmed };
});

vi.mock('../../shared/favicon/favicon-view-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/favicon/favicon-view-core')>();
  return {
    ...actual,
    createFaviconViewCore: (config: FaviconViewCoreOptions) => ({
      setFallbackNodeVisible() {},
      setFaviconLoadState() {},
      applyFaviconOpticalShift() {},
      applyFaviconOpticalAlignment(img: HTMLImageElement) {
        img.setAttribute('width', '128');
        img.setAttribute('height', '128');
      },
      cacheFaviconData() {},
      requestFaviconData: (url: string, pageUrl?: string) => (typeof config.requestFaviconData === 'function'
        ? config.requestFaviconData(url, pageUrl)
        : Promise.resolve(null)),
      setFaviconSrcWithAnimation(img: HTMLImageElement, nextSrc: string, options?: { sourceUrl?: string } | null) {
        if (config.isBlockedLocalFaviconUrl && config.isBlockedLocalFaviconUrl(nextSrc)) {
          return false;
        }
        img.src = nextSrc;
        img.setAttribute('data-favicon-current-src', nextSrc);
        if (nextSrc.startsWith('data:') && options && options.sourceUrl) {
          img.setAttribute('data-favicon-data-source', options.sourceUrl);
        } else {
          img.removeAttribute('data-favicon-data-source');
        }
        return true;
      },
      canReuseCurrentFavicon: () => false,
      getLastWorkingFaviconSrc: (img: HTMLImageElement | null) => (img ? img.getAttribute('data-favicon-current-src') || '' : ''),
      restoreWorkingFaviconOrFallback(img: HTMLImageElement, previousSrc: string, options?: { onFailed?(): void } | null) {
        if (previousSrc) {
          img.src = previousSrc;
          img.setAttribute('data-favicon-current-src', previousSrc);
          return true;
        }
        options?.onFailed?.();
        return false;
      },
      attachFaviconData(_img: unknown, url: string, _host?: string, pageUrl?: string) {
        core.attachedData.push(url);
        core.attachedDataPages.push(pageUrl || '');
      },
      preloadIcon: (url: string) => core.preloaded.push(url),
      warmIconCache: (list: ReadonlyArray<{ favicon?: string } | null>) => core.warmed.push(list),
      detectDefaultExtensionFavicon: () => Promise.resolve(false)
    })
  };
});

const encode = encodeURIComponent;
const extensionUrl = (pageUrl: string) => `chrome-extension://abc/_favicon/?pageUrl=${encode(pageUrl)}&size=128` +
  (/^https?:\/\//i.test(pageUrl) ? '&fallbackToHost=0' : '');
const gstaticUrl = (pageUrl: string) =>
  `https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=${encode(pageUrl)}&size=128`;
const favicon2Url = (pageUrl: string) => `chrome://favicon2/?pageUrl=${encode(pageUrl)}&size=128`;

const LOCAL_PAGE = 'http://127.0.0.1:4321/';
const BROWSER_PAGE = 'chrome://extensions/';
const PAGE = 'https://foo.example.com/';
const DIRECT_ICON = 'https://foo.example.com/favicon.ico';

// The worker answers browser-cache (_favicon) requests with image bytes, one
// distinct data: URL per source; web pages cannot load those URLs.
const browserCacheData = (url: string) => `data:image/png;base64,${Buffer.from(url).toString('base64')}`;
const answerBrowserCache = (url: string) => Promise.resolve(/^chrome-extension:\/\/[^/]+\/_favicon\//i.test(url) ? browserCacheData(url) : null);

interface RuntimeOptions {
  requestFaviconData?(url: string, pageUrl?: string): Promise<string | null>;
  // Unset means the policy has not loaded yet.
  enhanced?: boolean;
  excludedPageUrl?: string;
  blockHost?(host: string): boolean;
  faviconDataCache?: Map<string, string>;
  getOverlayPanel?(): Element | null;
  getSuggestionRowsRoot?(): Element | null;
  timeoutMs?: number;
}

function createRuntime(options: RuntimeOptions = {}) {
  const config: OverlayFaviconViewOptions = {
    document,
    windowObj: window,
    chromeApi: { runtime: { id: 'abc', getURL: (path: string) => `chrome-extension://abc${path}`, sendMessage: () => undefined } },
    requestFaviconData: options.requestFaviconData || answerBrowserCache,
    getHostFromUrl(url) {
      try {
        return new URL(url).hostname.toLowerCase();
      } catch {
        return '';
      }
    },
    getExtensionFaviconUrl: extensionUrl,
    getGstaticFaviconUrl: gstaticUrl,
    getChromeFaviconUrl: favicon2Url,
    shouldBlockFaviconForHost: () => false,
    shouldBlockOverlayFaviconForHost: options.blockHost || ((host) => host === '127.0.0.1' || host === 'localhost'),
    isEnhancedFaviconFetchEnabled: (pageUrl) => (pageUrl === options.excludedPageUrl ? false : options.enhanced === true),
    isBlockedLocalFaviconUrl: () => false,
    isFaviconProxyUrl: (url) => /_favicon\/|gstatic\.cn\/faviconV2/i.test(url),
    faviconDataCache: options.faviconDataCache,
    getOverlayPanel: options.getOverlayPanel,
    getSuggestionRowsRoot: options.getSuggestionRowsRoot,
    getStrictFaviconReason: (pageUrl) => (pageUrl === options.excludedPageUrl ? 'exclusion' : (options.enhanced === false ? 'global-off' : '')),
    faviconCandidateLoadTimeoutMs: options.timeoutMs ?? 1000
  };
  return createOverlayFaviconViewRuntime(config);
}

function createImage(parent: Element = document.body): HTMLImageElement {
  return parent.appendChild(document.createElement('img'));
}

// The fallback icon a row draws right after its image, showing while the
// icon is pending.
function attachFallback(img: HTMLImageElement): HTMLElement {
  const fallback = document.createElement('span');
  fallback.className = '_x_extension_overlay_favicon_fallback_2026_unique_';
  fallback.setAttribute('data-visible', 'true');
  img.after(fallback);
  return fallback;
}

const srcOf = (img: HTMLImageElement) => img.getAttribute('src') || '';
// The source an image shows: the worker-fetched source behind a data: URL,
// or the URL it loads itself.
const renderedSource = (img: HTMLImageElement) => img.getAttribute('data-favicon-data-source') || srcOf(img);
const flush = (ms = 0) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => {
  vi.useFakeTimers();
  core.preloaded.length = 0;
  core.attachedData.length = 0;
  core.attachedDataPages.length = 0;
  core.warmed.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Overlay favicons on local-network pages', () => {
  it('render the browser cache bytes the worker returns, keeping the page URL for its rules', async () => {
    const requests: Array<{ url: string; pageUrl: string }> = [];
    const dataUrl = 'data:image/png;base64,bG9jYWw=';
    const runtime = createRuntime({
      requestFaviconData: (url, pageUrl) => {
        requests.push({ url, pageUrl: pageUrl || '' });
        return Promise.resolve(url === extensionUrl(LOCAL_PAGE) ? dataUrl : null);
      }
    });
    const img = createImage();
    const onFailed = vi.fn();

    runtime.attachResolvedFaviconWithFallbacks(img, LOCAL_PAGE, '127.0.0.1', extensionUrl(LOCAL_PAGE), onFailed);
    await flush();
    expect(onFailed).not.toHaveBeenCalled();
    expect(requests).toEqual([{ url: extensionUrl(LOCAL_PAGE), pageUrl: LOCAL_PAGE }]);
    expect(srcOf(img)).toBe(dataUrl);
    expect(img.getAttribute('data-favicon-data-source')).toBe(extensionUrl(LOCAL_PAGE));
    expect(srcOf(img)).not.toMatch(/127\.0\.0\.1|localhost/);
  });

  it('fall back at once without data, hiding the pending fallback before the row draws its own', async () => {
    const runtime = createRuntime({ requestFaviconData: () => Promise.resolve(null) });
    const img = createImage();
    const fallback = attachFallback(img);
    let fallbackWhenFailed: string | null = null;

    runtime.attachResolvedFaviconWithFallbacks(img, LOCAL_PAGE, '127.0.0.1', extensionUrl(LOCAL_PAGE), () => {
      fallbackWhenFailed = fallback.getAttribute('data-visible');
    });
    await flush();
    expect(fallbackWhenFailed).toBe('false');
    expect(srcOf(img)).toBe('');
  });

  it('ask the public service but probe no website icon file while enhanced fetching is off', async () => {
    const requests: string[] = [];
    const runtime = createRuntime({
      enhanced: false,
      requestFaviconData: (url) => {
        requests.push(url);
        return Promise.resolve(null);
      }
    });
    const onFailed = vi.fn();
    runtime.attachResolvedFaviconWithFallbacks(createImage(), LOCAL_PAGE, '127.0.0.1', extensionUrl(LOCAL_PAGE), onFailed);
    await flush(4);
    expect(onFailed).toHaveBeenCalled();
    expect(requests).toEqual([extensionUrl(LOCAL_PAGE), gstaticUrl(LOCAL_PAGE)]);
  });
});

describe('Overlay favicons with enhanced fetching off', () => {
  it('keep website images out of the page, fetching only the service and the browser cache in the worker', async () => {
    const requests: string[] = [];
    const runtime = createRuntime({
      enhanced: false,
      requestFaviconData: (url) => {
        requests.push(url);
        return Promise.resolve(null);
      }
    });
    const img = createImage();
    runtime.attachFaviconData(img, DIRECT_ICON, 'foo.example.com');
    runtime.preloadIcon(DIRECT_ICON);
    runtime.preloadIcon(gstaticUrl(PAGE));
    runtime.preloadIcon(extensionUrl(PAGE));
    runtime.attachResolvedFaviconWithFallbacks(img, PAGE, 'foo.example.com', DIRECT_ICON);
    await flush();

    expect(core.attachedData).toEqual([]);
    expect(core.preloaded).toEqual([]);
    expect(Array.from(new Set(requests))).toEqual([gstaticUrl(PAGE), extensionUrl(PAGE)]);
    expect(srcOf(img)).not.toContain('_favicon');
    expect(srcOf(img)).not.toContain('foo.example.com/favicon.ico');
    expect(srcOf(img)).not.toContain('gstatic');
  });

  it('treat a policy that has not loaded yet as strict', async () => {
    const runtime = createRuntime();
    const img = createImage();
    runtime.attachResolvedFaviconWithFallbacks(img, PAGE, 'foo.example.com', DIRECT_ICON);
    await flush();
    expect(renderedSource(img)).toBe(extensionUrl(PAGE));
  });

  it('prefer cached data without using its direct URL', async () => {
    const cachedDataUrl = 'data:image/png;base64,Y2FjaGVk';
    const runtime = createRuntime({ enhanced: false, faviconDataCache: new Map([[DIRECT_ICON, cachedDataUrl]]) });
    const img = createImage();
    runtime.attachResolvedFaviconWithFallbacks(img, PAGE, 'foo.example.com', DIRECT_ICON);
    await flush();
    expect(srcOf(img)).toBe(cachedDataUrl);
  });
});

describe('Overlay favicons on excluded pages', () => {
  it('fetch only the browser cache, even with enhanced fetching on, and never restore a direct icon', async () => {
    const requests: string[] = [];
    const runtime = createRuntime({
      enhanced: true,
      excludedPageUrl: PAGE,
      requestFaviconData: (url) => {
        requests.push(url);
        return answerBrowserCache(url);
      }
    });
    const img = createImage();
    runtime.preloadIcon(DIRECT_ICON, PAGE);
    runtime.preloadIcon(gstaticUrl(PAGE), PAGE);
    runtime.preloadIcon(extensionUrl(PAGE), PAGE);
    runtime.attachFaviconData(createImage(), DIRECT_ICON, 'foo.example.com', PAGE);
    runtime.warmIconCache([{ url: PAGE, favicon: DIRECT_ICON }]);
    runtime.attachResolvedFaviconWithFallbacks(img, PAGE, 'foo.example.com', DIRECT_ICON);
    await flush();

    expect(core.preloaded).toEqual([]);
    expect(core.attachedData).toEqual([]);
    // The page cannot load the browser cache URL, so the warmer never gets it.
    expect(required(core.warmed[0][0], 'the warmed item').favicon).toBe('');
    expect(Array.from(new Set(requests))).toEqual([extensionUrl(PAGE)]);
    expect(renderedSource(img)).toBe(extensionUrl(PAGE));
    expect(srcOf(img)).toMatch(/^data:image\//);

    const stale = createImage();
    stale.src = DIRECT_ICON;
    stale.setAttribute('data-favicon-current-src', DIRECT_ICON);
    runtime.attachResolvedFaviconWithFallbacks(stale, PAGE, 'foo.example.com', DIRECT_ICON);
    stale.dispatchEvent(new Event('error'));
    await flush();
    expect(srcOf(stale)).not.toBe(DIRECT_ICON);
  });

  it('prefer the browser cache on pages that are not excluded too', async () => {
    const runtime = createRuntime({ enhanced: true });
    const img = createImage();
    runtime.attachResolvedFaviconWithFallbacks(img, PAGE, 'foo.example.com', DIRECT_ICON);
    await flush();
    expect(renderedSource(img)).toBe(extensionUrl(PAGE));
  });

  it('follow one rule per path: an excluded path gets the browser cache only, its sibling warms in the worker', async () => {
    const privatePage = 'https://foo.example.com/private';
    const publicPage = 'https://foo.example.com/public';
    const requests: Array<{ url: string; pageUrl: string }> = [];
    const runtime = createRuntime({
      enhanced: true,
      excludedPageUrl: privatePage,
      requestFaviconData: (url, pageUrl) => {
        requests.push({ url, pageUrl: pageUrl || '' });
        return answerBrowserCache(url);
      }
    });

    const privateImg = createImage();
    runtime.attachResolvedFaviconWithFallbacks(privateImg, privatePage, 'foo.example.com', DIRECT_ICON);
    await flush();
    expect(renderedSource(privateImg)).toBe(extensionUrl(privatePage));
    privateImg.dispatchEvent(new Event('error'));
    expect(srcOf(privateImg)).not.toBe(gstaticUrl(privatePage));
    runtime.preloadIcon(DIRECT_ICON, privatePage);
    runtime.preloadIcon(gstaticUrl(privatePage), privatePage);
    runtime.preloadIcon(extensionUrl(privatePage), privatePage);
    runtime.attachFaviconData(createImage(), DIRECT_ICON, 'foo.example.com', privatePage);
    runtime.warmIconCache([{ url: privatePage, favicon: DIRECT_ICON }]);
    await flush();
    expect(core.preloaded).toEqual([]);
    expect(core.attachedData).toEqual([]);
    expect(Array.from(new Set(requests.map((request) => request.url)))).toEqual([extensionUrl(privatePage)]);
    expect(required(core.warmed[0][0], 'the warmed item').favicon).toBe('');

    const publicImg = createImage();
    runtime.attachResolvedFaviconWithFallbacks(publicImg, publicPage, 'foo.example.com', DIRECT_ICON);
    await flush();
    expect(renderedSource(publicImg)).toBe(extensionUrl(publicPage));
    runtime.preloadIcon(DIRECT_ICON, publicPage);
    runtime.preloadIcon(gstaticUrl(publicPage), publicPage);
    runtime.attachFaviconData(createImage(), DIRECT_ICON, 'foo.example.com', publicPage);
    runtime.warmIconCache([{ url: publicPage, favicon: DIRECT_ICON }]);
    await flush();
    expect(core.preloaded).not.toContain(DIRECT_ICON);
    expect(requests.some((request) => request.url === gstaticUrl(publicPage))).toBe(false);
    expect(core.attachedData).toEqual([]);
    expect(core.attachedDataPages).toEqual([]);
    expect(requests).toContainEqual({ url: extensionUrl(publicPage), pageUrl: publicPage });
  });
});

describe('Overlay favicons after a policy change', () => {
  // A row that, when its icon fails, swaps the image for a failed slot, and
  // draws a fresh image when asked to try again (as the suggestion rows do).
  function createRows(attach: (img: HTMLImageElement, onFailed: () => void) => void) {
    const panel = document.body.appendChild(document.createElement('div'));
    const rowsRoot = panel.appendChild(document.createElement('div'));
    const state = { img: createImage(rowsRoot), rerenders: 0 };
    const failedSlot = document.createElement('span');
    failedSlot.setAttribute('data-favicon-failed', 'true');
    const replaceFailedImage = () => {
      state.img.replaceWith(failedSlot);
    };
    failedSlot.addEventListener('lumno-favicon-retry', () => {
      state.rerenders += 1;
      state.img = document.createElement('img');
      failedSlot.replaceWith(state.img);
      attach(state.img, replaceFailedImage);
    });
    return { panel, rowsRoot, state, failedSlot, replaceFailedImage };
  }

  it.each(['search result', 'open tab'])('lets a failed %s row try again once allowed, and keeps it strict once disallowed', async () => {
    const requests: string[] = [];
    let browserCacheAvailable = false;
    const policy: RuntimeOptions = {
      enhanced: false,
      requestFaviconData: (url) => {
        requests.push(url);
        return browserCacheAvailable ? answerBrowserCache(url) : Promise.resolve(null);
      },
      getOverlayPanel: () => rows.panel,
      getSuggestionRowsRoot: () => rows.rowsRoot
    };
    const runtime = createRuntime(policy);
    const attach = (img: HTMLImageElement, onFailed: () => void) =>
      runtime.attachResolvedFaviconWithFallbacks(img, PAGE, 'foo.example.com', DIRECT_ICON, onFailed);
    const rows = createRows(attach);

    attach(rows.state.img, rows.replaceFailedImage);
    expect(requests[0]).toBe(extensionUrl(PAGE));
    expect(srcOf(rows.state.img)).not.toBe(DIRECT_ICON);
    await flush();
    await flush();
    expect(rows.failedSlot.isConnected).toBe(true);

    browserCacheAvailable = true;
    policy.enhanced = true;
    runtime.refreshOverlayFaviconsForPolicyChange();
    await flush();
    expect(rows.state.rerenders).toBe(1);
    expect(rows.failedSlot.isConnected).toBe(false);
    expect(renderedSource(rows.state.img)).toBe(extensionUrl(PAGE));

    policy.enhanced = false;
    runtime.refreshOverlayFaviconsForPolicyChange();
    await flush();
    expect(rows.state.rerenders).toBe(1);
    expect(renderedSource(rows.state.img)).toBe(extensionUrl(PAGE));
    expect(srcOf(rows.state.img)).not.toContain('favicon.ico');
    expect(srcOf(rows.state.img)).not.toContain('gstatic');
  });
});

describe('Overlay favicons for browser pages', () => {
  const blockHost = (host: string) => ['127.0.0.1', 'localhost', 'extensions'].includes(host);

  it('render chrome://favicon2 directly, without a worker request first', async () => {
    const requests: string[] = [];
    const runtime = createRuntime({
      blockHost,
      requestFaviconData: (url) => {
        requests.push(url);
        return Promise.resolve(null);
      }
    });
    const img = createImage();
    const onFailed = vi.fn();
    runtime.attachResolvedFaviconWithFallbacks(img, BROWSER_PAGE, 'extensions', favicon2Url(BROWSER_PAGE), onFailed);
    await flush();
    expect(onFailed).not.toHaveBeenCalled();
    expect(srcOf(img)).toBe(favicon2Url(BROWSER_PAGE));
    expect(requests).toEqual([]);
  });

  it('use the browser cache before chrome://favicon2 when no icon was given', async () => {
    const runtime = createRuntime({ blockHost });
    const img = createImage();
    const onFailed = vi.fn();
    runtime.attachResolvedFaviconWithFallbacks(img, BROWSER_PAGE, 'extensions', '', onFailed);
    await flush();
    expect(onFailed).not.toHaveBeenCalled();
    expect(renderedSource(img)).toBe(`chrome-extension://abc/_favicon/?pageUrl=${encode(BROWSER_PAGE)}&size=128`);
  });
});

describe('Overlay favicon sources', () => {
  it('skip a root-page icon for a nested page', async () => {
    const pageUrl = 'https://chrome.google.com/webstore/devconsole?hl=zh-CN';
    const rootSource = 'chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fchrome.google.com%2F&size=128&fallbackToHost=0';
    const runtime = createRuntime({ faviconDataCache: new Map([[rootSource, 'data:image/png;base64,d3Jvbmdyb290']]) });
    const img = createImage();
    runtime.attachResolvedFaviconWithFallbacks(img, pageUrl, 'chrome.google.com', rootSource);
    await flush();
    expect(srcOf(img)).toMatch(/^data:image\//);
    const source = new URL(renderedSource(img));
    expect(source.searchParams.get('pageUrl')).toBe(pageUrl);
    expect(source.searchParams.get('fallbackToHost')).toBe('0');
  });

  it.each([
    ['another page', 'https://chrome.google.com/', false],
    ['an unknown page', '', false],
    ['the same page', 'https://chrome.google.com/webstore/devconsole?hl=zh-CN', true]
  ])('restore the image data shown before only when it was for the same page (%s)', async (_label, previousPage, restores) => {
    const pageUrl = 'https://chrome.google.com/webstore/devconsole?hl=zh-CN';
    const previousData = 'data:image/png;base64,cHJldmlvdXNwYWdl';
    const img = createImage();
    img.src = previousData;
    img.setAttribute('data-favicon-current-src', previousData);
    if (previousPage) {
      img.setAttribute('data-x-ov-favicon-page-url', previousPage);
    }
    const runtime = createRuntime({ enhanced: false, requestFaviconData: () => Promise.resolve(null) });
    const onFailed = vi.fn();
    runtime.attachResolvedFaviconWithFallbacks(img, pageUrl, 'chrome.google.com', '', onFailed);
    // Candidates load as worker bytes; until one does the old image is only
    // remembered, so a restore has to put it back.
    img.src = '';
    await flush();
    await flush();
    expect(srcOf(img) === previousData).toBe(restores);
    expect(onFailed.mock.calls.length > 0).toBe(!restores);
  });

  it.each([true, false])('render service artwork only as worker bytes, after the browser cache (enhanced %s)', async (enhanced) => {
    const dataUrl = 'data:image/png;base64,c2VydmljZQ==';
    const requests: Array<{ url: string; pageUrl?: string }> = [];
    const runtime = createRuntime({
      enhanced,
      // The browser has no icon for the page, so the service is asked next.
      requestFaviconData: (url, pageUrl) => {
        requests.push({ url, pageUrl });
        return Promise.resolve(url === gstaticUrl(PAGE) ? dataUrl : null);
      }
    });
    const img = createImage();
    runtime.attachResolvedFaviconWithFallbacks(img, PAGE, 'foo.example.com', '');
    expect(srcOf(img)).not.toBe(extensionUrl(PAGE));
    expect(srcOf(img)).not.toBe(gstaticUrl(PAGE));
    await flush();
    await flush();
    expect(srcOf(img)).toBe(dataUrl);
    expect(img.getAttribute('data-favicon-data-source')).toBe(gstaticUrl(PAGE));
    expect(requests).toEqual([{ url: extensionUrl(PAGE), pageUrl: PAGE }, { url: gstaticUrl(PAGE), pageUrl: PAGE }]);

    runtime.preloadIcon(gstaticUrl(PAGE));
    runtime.warmIconCache([{ favicon: gstaticUrl(PAGE) }]);
    await flush();
    expect(core.preloaded).not.toContain(gstaticUrl(PAGE));
    expect(required(core.warmed[0][0], 'the warmed item').favicon).toBe('');
  });

  it.each([true, false])('never ask the service for an excluded page (enhanced %s)', async (enhanced) => {
    const requests: string[] = [];
    const runtime = createRuntime({
      enhanced,
      excludedPageUrl: PAGE,
      requestFaviconData: (url) => {
        requests.push(url);
        return Promise.resolve('data:image/png;base64,c2VydmljZQ==');
      }
    });
    const img = createImage();
    runtime.attachResolvedFaviconWithFallbacks(img, PAGE, 'foo.example.com', '');
    img.dispatchEvent(new Event('error'));
    runtime.preloadIcon(gstaticUrl(PAGE), PAGE);
    await flush();
    expect(requests.filter((url) => url.includes('gstatic'))).toEqual([]);
  });

  it.each([
    ['times out', false],
    ['is replaced by another page', true]
  ])('drop late service bytes once the row %s', async (_label, replaceSession) => {
    const pending = new Map<string, (value: string) => void>();
    const onFailed = vi.fn();
    const runtime = createRuntime({
      enhanced: false,
      timeoutMs: 10,
      requestFaviconData: (url) => new Promise((resolve) => {
        pending.set(url, resolve);
      })
    });
    const img = createImage();
    runtime.attachResolvedFaviconWithFallbacks(img, PAGE, 'foo.example.com', '', onFailed);
    img.dispatchEvent(new Event('error'));
    expect(pending.has(gstaticUrl(PAGE))).toBe(true);
    if (replaceSession) {
      runtime.attachResolvedFaviconWithFallbacks(img, 'https://other.example.com/page', 'other.example.com', '');
    } else {
      await flush(20);
      expect(onFailed).toHaveBeenCalled();
    }
    const current = srcOf(img);
    required(pending.get(extensionUrl(PAGE)), 'the browser cache request')('data:image/png;base64,c3RhbGVjYWNoZQ==');
    required(pending.get(gstaticUrl(PAGE)), 'the service request')('data:image/png;base64,c3RhbGU=');
    await flush();
    expect(srcOf(img)).toBe(current);
  });
});
