import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFaviconViewRuntime, type FaviconViewRuntimeOptions, type ThemeFaviconImage } from './favicon-view';
import type { FaviconImage } from '../../shared/favicon/favicon-pixels';
import type { FaviconViewCoreOptions, FaviconWarmItem } from '../../shared/favicon/favicon-view-core';

// The order a New Tab favicon tries its sources in, what it falls back to,
// and what it keeps or writes to the persisted caches. The favicon view core
// is replaced by one that records what it is asked to load: an image counts
// as loaded once the test fires its load event.

const core = vi.hoisted(() => {
  const preloaded: string[] = [];
  const warmed: Array<ReadonlyArray<FaviconWarmItem | null | undefined>> = [];
  const dataRequests: Array<{ url: string; pageUrl: string }> = [];
  // Images whose current source finished loading.
  const loaded = new WeakSet<HTMLImageElement>();

  function create(options?: FaviconViewCoreOptions | null) {
    const config = options || {};
    return {
      setFallbackNodeVisible() {},
      setFaviconLoadState() {},
      applyFaviconOpticalShift() {},
      applyFaviconOpticalAlignment(img: FaviconImage) {
        img.setAttribute('width', '128');
        img.setAttribute('height', '128');
      },
      requestFaviconData(url: string, pageUrl?: string): Promise<string | null> {
        return Promise.resolve(config.requestFaviconData ? config.requestFaviconData(url, pageUrl) : null);
      },
      setFaviconSrcWithAnimation(img: FaviconImage, nextSrc: string, setOptions?: { deferResolve?: boolean }): boolean {
        img.setAttribute('width', '128');
        img.setAttribute('height', '128');
        const deferResolve = Boolean(setOptions && setOptions.deferResolve);
        const currentSrc = img.getAttribute('data-favicon-current-src') || '';
        const fallbackVisible = img.getAttribute('data-fallback-icon') === 'true';
        const placeholderVisible = img.getAttribute('data-favicon-placeholder') === 'true';
        if (currentSrc === nextSrc) {
          if ((fallbackVisible || placeholderVisible) && img.complete && img.naturalWidth > 0) {
            if (!deferResolve && config.showResolvedFavicon) {
              config.showResolvedFavicon(img);
            }
            return false;
          }
          if (!fallbackVisible && !placeholderVisible) {
            return false;
          }
        }
        if (config.showPendingFallbackIcon) {
          config.showPendingFallbackIcon(img);
        }
        img._xFaviconLoadToken = (img._xFaviconLoadToken || 0) + 1;
        const token = img._xFaviconLoadToken;
        img.addEventListener('load', () => {
          if (token !== img._xFaviconLoadToken) {
            return;
          }
          if (!deferResolve && config.showResolvedFavicon) {
            config.showResolvedFavicon(img);
          }
          img.setAttribute('data-favicon-current-src', nextSrc);
        }, { once: true });
        loaded.delete(img);
        img.src = nextSrc;
        return true;
      },
      canReuseCurrentFavicon(img: FaviconImage, nextSrc: string): boolean {
        const currentSrc = img.getAttribute('data-favicon-current-src') || img.src || '';
        return currentSrc === nextSrc && img.getAttribute('data-fallback-icon') !== 'true' &&
          img.getAttribute('data-favicon-placeholder') !== 'true';
      },
      getLastWorkingFaviconSrc(img: FaviconImage | null): string {
        return img ? (img.getAttribute('data-favicon-current-src') || '') : '';
      },
      restoreWorkingFaviconOrFallback(img: FaviconImage, previous: string, restoreOptions?: { applyFallbackIcon?(img: FaviconImage): void }): boolean {
        const previousSrc = String(previous || '');
        if (previousSrc) {
          img.src = previousSrc;
          img.setAttribute('data-favicon-current-src', previousSrc);
          img.removeAttribute('data-fallback-icon');
          img.removeAttribute('data-favicon-placeholder');
          return true;
        }
        if (restoreOptions && restoreOptions.applyFallbackIcon) {
          restoreOptions.applyFallbackIcon(img);
        }
        return false;
      },
      attachFaviconData(_img: FaviconImage, url: string, _host?: string, pageUrl?: string) {
        dataRequests.push({ url, pageUrl: pageUrl || '' });
      },
      preloadIcon(url: string) {
        preloaded.push(url);
      },
      warmIconCache(list: ReadonlyArray<FaviconWarmItem | null | undefined>) {
        warmed.push(list);
      },
      detectDefaultExtensionFavicon(img: HTMLImageElement, url: string): Promise<unknown> {
        return Promise.resolve(config.detectDefaultExtensionFavicon ? config.detectDefaultExtensionFavicon(img, url) : false);
      }
    };
  }

  return { preloaded, warmed, dataRequests, loaded, create };
});

vi.mock('../../shared/favicon/favicon-view-core', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../shared/favicon/favicon-view-core')>(),
  createFaviconViewCore: core.create
}));

const pageUrl = 'https://m2.futurecomm.cn/#/center';
const primaryUrl = 'https://m2.futurecomm.cn/favicon.ico';
const extensionFor = (url: string) => `chrome-extension://abc/_favicon/?pageUrl=${encodeURIComponent(url)}&size=128` +
  (/^https?:\/\//i.test(url) ? '&fallbackToHost=0' : '');
const gstaticFor = (url: string) => 'https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=' +
  `${encodeURIComponent(url)}&size=128`;
const extensionUrl = extensionFor(pageUrl);
const gstaticUrl = gstaticFor(pageUrl);

// The document the images are drawn in, apart from the one a runtime
// searches when it refreshes or rescues icons.
let page: Document;

beforeEach(() => {
  vi.useFakeTimers();
  page = document.implementation.createHTMLDocument('');
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockImplementation(function isComplete(this: HTMLImageElement) {
    return core.loaded.has(this);
  });
  vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(16);
});

afterEach(() => {
  vi.useRealTimers();
});

function createImage(owner: Document = page): ThemeFaviconImage {
  const img = owner.createElement('img');
  owner.body.appendChild(img);
  return img;
}

// The image's source finishes loading.
function load(img: HTMLImageElement): void {
  core.loaded.add(img);
  img.dispatchEvent(new Event('load'));
}

function fail(img: HTMLImageElement): void {
  img.dispatchEvent(new Event('error'));
}

async function wait(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

interface RuntimeOptions extends Partial<FaviconViewRuntimeOptions> {
  enhancedFaviconFetchEnabled?: boolean;
  excludedPageUrl?: string;
}

function createRuntime(options: RuntimeOptions = {}) {
  const { enhancedFaviconFetchEnabled, excludedPageUrl, ...overrides } = options;
  return createFaviconViewRuntime({
    document: document.implementation.createHTMLDocument(''),
    windowObj: window,
    chromeApi: { runtime: { getURL: (path) => `chrome-extension://abc${path}`, sendMessage: vi.fn() } },
    getExtensionFaviconUrl: extensionFor,
    getGstaticFaviconUrl: gstaticFor,
    getHostFromUrl: (url) => new URL(url).hostname,
    shouldBlockFaviconForHost: () => false,
    isEnhancedFaviconFetchEnabled: (targetPageUrl) => !(excludedPageUrl && targetPageUrl === excludedPageUrl) &&
      enhancedFaviconFetchEnabled !== false,
    getStrictFaviconReason: (targetPageUrl) => (excludedPageUrl === targetPageUrl ? 'exclusion'
      : (enhancedFaviconFetchEnabled === false ? 'global-off' : '')),
    isBlockedLocalFaviconUrl: () => false,
    detectDefaultExtensionFavicon: (_img, url) => Promise.resolve(url === extensionUrl),
    preloadThemeFromFavicon() {},
    faviconCandidateLoadTimeoutMs: 1000,
    ...overrides
  });
}

describe('New Tab favicon candidates', () => {
  it('stops retrying a favicon that never loads instead of polling forever', async () => {
    const img = createImage();
    let assignments = 0;
    vi.spyOn(img, 'src', 'set').mockImplementation((value: string) => {
      img.setAttribute('src', value);
      if (value) {
        assignments += 1;
        setTimeout(() => fail(img), 0);
      }
    });
    createRuntime({ document: page, requestFaviconData: () => Promise.resolve(null) })
      .attachFaviconWithFallbacks(img, 'https://unreachable.example/', 'unreachable.example');

    await wait(15000);
    const settled = assignments;
    expect(settled).toBeGreaterThan(1);
    await wait(15000);
    expect(assignments).toBe(settled);
    expect(img.getAttribute('data-fallback-icon')).toBe('true');
  });

  it('skips a stale origin-wide candidate for a nested page', () => {
    const nestedPageUrl = 'https://chrome.google.com/webstore/devconsole?hl=zh-CN';
    const rootBrowserUrl = 'chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fchrome.google.com%2F&size=128&fallbackToHost=0';
    const img = createImage();
    createRuntime({ getPersistedFaviconEntry: () => ({ url: rootBrowserUrl, updatedAt: Date.now() }) })
      .attachFaviconWithFallbacks(img, nestedPageUrl, 'chrome.google.com', { primaryUrl: rootBrowserUrl });

    expect(new URL(img.src).searchParams.get('pageUrl')).toBe(nestedPageUrl);
    expect(new URL(img.src).searchParams.get('fallbackToHost')).toBe('0');
  });

  it.each([
    ['the site root', 'https://chrome.google.com/', false],
    ['an unknown page', '', false],
    ['the same page', 'https://chrome.google.com/webstore/devconsole?hl=zh-CN', true]
  ])('restores image bytes after a failed acquisition only when they showed the same page (%s)', (_name, previousPageUrl, restored) => {
    const nestedPageUrl = 'https://chrome.google.com/webstore/devconsole?hl=zh-CN';
    const previousPageData = 'data:image/png;base64,cHJldmlvdXNwYWdl';
    const img = createImage();
    img.src = previousPageData;
    img.setAttribute('data-favicon-current-src', previousPageData);
    if (previousPageUrl) {
      img.setAttribute('data-x-nt-favicon-page-url', previousPageUrl);
    }
    createRuntime({ enhancedFaviconFetchEnabled: false }).attachFaviconWithFallbacks(img, nestedPageUrl, 'chrome.google.com');
    fail(img);
    fail(img);

    expect(img.src === previousPageData).toBe(restored);
  });

  it('keeps a shortcut snapshot through a theme refresh, and never restores a live Chrome icon for a shortcut', () => {
    const snapshot = 'data:image/png;base64,c25hcHNob3Q=';
    const img = createImage();
    const runtime = createRuntime({ document: page });
    runtime.attachFaviconWithFallbacks(img, pageUrl, 'futurecomm.cn', {
      primaryUrl: extensionUrl, pageSpecificUrl: snapshot, skipPersisted: true, sourceProfile: 'shortcut'
    });
    expect(img.src).toBe(snapshot);
    load(img);
    runtime.refreshThemeAwareFavicons();
    expect(img.src).toBe(snapshot);

    const oldBrowserImage = createImage(document.implementation.createHTMLDocument(''));
    oldBrowserImage.src = extensionUrl;
    oldBrowserImage.setAttribute('data-favicon-current-src', extensionUrl);
    runtime.attachFaviconWithFallbacks(oldBrowserImage, pageUrl, 'futurecomm.cn', { skipPersisted: true, sourceProfile: 'shortcut' });
    expect(oldBrowserImage.getAttribute('data-fallback-icon')).toBe('true');
  });

  it('shows persisted page data before network candidates and refreshes it once confirmed', async () => {
    const persistedDataUrl = 'data:image/png;base64,cGVyc2lzdGVk';
    const pageCacheKey = 'page:https://m2.futurecomm.cn/';
    const reads: string[] = [];
    const writes: Array<{ cacheKey: string; type: string; value: string }> = [];
    const img = createImage();
    createRuntime({
      getPersistedFaviconEntry(cacheKey) {
        reads.push(cacheKey);
        return { url: primaryUrl, updatedAt: Date.now() - 1 };
      },
      getPersistedFaviconDataEntry(cacheKey) {
        reads.push(cacheKey);
        return { dataUrl: persistedDataUrl, updatedAt: Date.now() };
      },
      setPersistedFaviconUrl: (cacheKey, value) => writes.push({ cacheKey, type: 'url', value }),
      setPersistedFaviconData: (cacheKey, value) => writes.push({ cacheKey, type: 'data', value })
    }).attachFaviconWithFallbacks(img, pageUrl, 'futurecomm.cn', { primaryUrl });

    expect(reads.every((key) => key === pageCacheKey)).toBe(true);
    expect(img.src).toBe(persistedDataUrl);
    // Under a stable page cache key.
    expect(img.getAttribute('data-x-nt-favicon-cache-key')).toBe(pageCacheKey);
    load(img);
    await wait(4);
    expect(writes[0]).toEqual({ cacheKey: pageCacheKey, type: 'data', value: persistedDataUrl });
  });

  it('never reads the legacy shared host entry for pages on the same host', () => {
    const profileKey = 'page:https://x.com/creator';
    const homeKey = 'page:https://x.com/home';
    const profileIcon = 'data:image/png;base64,cHJvZmlsZQ==';
    const homeIcon = 'data:image/png;base64,aG9tZQ==';
    const reads: string[] = [];
    const dataByKey = new Map([[profileKey, profileIcon], [homeKey, homeIcon], ['x.com', profileIcon]]);
    const runtime = createRuntime({
      getPersistedFaviconEntry(cacheKey) {
        reads.push(cacheKey);
        return null;
      },
      getPersistedFaviconDataEntry(cacheKey) {
        reads.push(cacheKey);
        const dataUrl = dataByKey.get(cacheKey);
        return dataUrl ? { dataUrl, updatedAt: Date.now() } : null;
      }
    });
    const profileImg = createImage();
    const homeImg = createImage();
    runtime.attachFaviconWithFallbacks(profileImg, 'https://x.com/creator', 'x.com');
    runtime.attachFaviconWithFallbacks(homeImg, 'https://x.com/home', 'x.com');

    expect(profileImg.src).toBe(profileIcon);
    expect(homeImg.src).toBe(homeIcon);
    expect(reads).toEqual([profileKey, profileKey, homeKey, homeKey]);
  });

  it('prefers a shortcut\'s exact page icon and keeps it out of the shared host caches', async () => {
    const cachedDataUrl = 'data:image/png;base64,c2hvcnRjdXQtY2FjaGU=';
    const writes: string[] = [];
    const img = createImage();
    createRuntime({
      getPersistedFaviconEntry() {
        throw new Error('shortcut rendering should not read the shared host URL cache');
      },
      getPersistedFaviconDataEntry() {
        throw new Error('shortcut rendering should not read the shared host data cache');
      },
      setPersistedFaviconUrl: (cacheKey) => writes.push(cacheKey),
      setPersistedFaviconData: (cacheKey) => writes.push(cacheKey)
    }).attachFaviconWithFallbacks(img, pageUrl, 'futurecomm.cn', {
      primaryUrl: extensionUrl, pageSpecificUrl: cachedDataUrl, skipPersisted: true
    });

    expect(img.src).toBe(cachedDataUrl);
    load(img);
    await wait(4);
    expect(writes).toEqual([]);
  });
});

describe('New Tab favicons with enhanced fetching off for a page', () => {
  const privatePageUrl = 'https://foo.example.com/private';
  const publicPageUrl = 'https://foo.example.com/public';
  const directUrl = 'https://foo.example.com/favicon.ico';

  it('use only the browser cache on an excluded page, for display, preloads, data and warming', () => {
    const runtime = createRuntime({ enhancedFaviconFetchEnabled: true, excludedPageUrl: privatePageUrl });
    const preloadStart = core.preloaded.length;
    const dataStart = core.dataRequests.length;
    const warmStart = core.warmed.length;
    const img = createImage();
    runtime.attachFaviconWithFallbacks(img, privatePageUrl, 'foo.example.com', { primaryUrl: directUrl });

    expect(img.src).toBe(extensionFor(privatePageUrl));
    fail(img);
    expect(img.src).not.toBe(gstaticFor(privatePageUrl));
    runtime.preloadIcon(directUrl, privatePageUrl);
    runtime.preloadIcon(gstaticFor(privatePageUrl), privatePageUrl);
    runtime.preloadIcon(extensionFor(privatePageUrl), privatePageUrl);
    runtime.attachFaviconData(createImage(), directUrl, 'foo.example.com', privatePageUrl);
    runtime.warmIconCache([{ url: privatePageUrl, favicon: directUrl }]);
    expect(Array.from(new Set(core.preloaded.slice(preloadStart)))).toEqual([extensionFor(privatePageUrl)]);
    expect(core.dataRequests.slice(dataStart)).toEqual([]);
    expect(core.warmed[warmStart][0]).toMatchObject({ favicon: extensionFor(privatePageUrl) });
  });

  it('prefer the browser cache and never preload website or third-party icons on other pages', () => {
    const runtime = createRuntime({ enhancedFaviconFetchEnabled: true, excludedPageUrl: privatePageUrl });
    const dataStart = core.dataRequests.length;
    const img = createImage();
    runtime.attachFaviconWithFallbacks(img, publicPageUrl, 'foo.example.com', { primaryUrl: directUrl });

    expect(img.src).toBe(extensionFor(publicPageUrl));
    runtime.preloadIcon(directUrl, publicPageUrl);
    runtime.preloadIcon(gstaticFor(publicPageUrl), publicPageUrl);
    runtime.attachFaviconData(createImage(), directUrl, 'foo.example.com', publicPageUrl);
    runtime.warmIconCache([{ url: publicPageUrl, favicon: directUrl }]);
    expect(core.preloaded).not.toContain(directUrl);
    expect(core.preloaded).not.toContain(gstaticFor(publicPageUrl));
    // Automatic direct sources never reach the data loader.
    expect(core.dataRequests.slice(dataStart)).toEqual([]);
    expect(core.warmed[core.warmed.length - 1][0]).toMatchObject({ favicon: extensionFor(publicPageUrl) });
  });

  it('skip the direct icon on an excluded page and do not retry gstatic after the browser cache fails', () => {
    const runtime = createRuntime({ enhancedFaviconFetchEnabled: true, excludedPageUrl: pageUrl });
    const img = createImage();
    runtime.attachFaviconWithFallbacks(img, pageUrl, 'futurecomm.cn', { primaryUrl });

    expect(img.src).toBe(extensionUrl);
    fail(img);
    expect(img.src).toBe(extensionUrl);
    runtime.preloadIcon(primaryUrl, pageUrl);
    runtime.preloadIcon(extensionUrl, pageUrl);
    expect(core.preloaded.slice(-1)).toEqual([extensionUrl]);
    runtime.warmIconCache([{ url: pageUrl, favicon: primaryUrl }]);
    expect(core.warmed[core.warmed.length - 1][0]).toMatchObject({ favicon: extensionUrl });
  });

  it('do not restore a direct icon that worked before once the strict candidates fail', () => {
    const runtime = createRuntime({ enhancedFaviconFetchEnabled: true, excludedPageUrl: pageUrl });
    const img = createImage();
    img.src = primaryUrl;
    img.setAttribute('data-favicon-current-src', primaryUrl);
    runtime.attachFaviconWithFallbacks(img, pageUrl, 'futurecomm.cn', { primaryUrl });
    fail(img);

    expect(img.src).not.toBe(primaryUrl);
  });
});

describe('New Tab favicon proxies', () => {
  it('moves from the site icon to the browser cache to gstatic, and shows gstatic once it has real data', async () => {
    const img = createImage();
    createRuntime({ requestFaviconData: (url) => Promise.resolve(url === gstaticUrl ? 'data:image/png;base64,real' : null) })
      .attachFaviconWithFallbacks(img, pageUrl, 'futurecomm.cn', { primaryUrl, allowRemoteImage: true });
    expect(img.src).toBe(primaryUrl);

    fail(img);
    expect(img.src).toBe(extensionUrl);
    // The browser cache answers with its blank stand-in.
    load(img);
    await wait(4);
    expect(img.src).toBe(gstaticUrl);
    expect(img.src).not.toMatch(/google\.com\/s2\/favicons|favicon\.is\//i);

    load(img);
    await wait(4);
    expect(img.getAttribute('data-favicon-placeholder')).toBeNull();
    expect(img.getAttribute('data-fallback-icon')).toBeNull();
  });

  it('keeps the browser cache icon hidden until it proves to be real, then shows it', async () => {
    const img = createImage();
    createRuntime({ detectDefaultExtensionFavicon: () => Promise.resolve(false), requestFaviconData: () => Promise.resolve(null) })
      .attachFaviconWithFallbacks(img, pageUrl, 'futurecomm.cn', { primaryUrl, allowRemoteImage: true });
    expect(img.src).toBe(primaryUrl);

    fail(img);
    expect(img.src).toBe(extensionUrl);
    expect(img.getAttribute('data-favicon-placeholder')).toBe('true');
    load(img);
    await wait(4);
    expect(img.src).toBe(extensionUrl);
    expect(img.getAttribute('data-favicon-placeholder')).toBeNull();
    expect(img.getAttribute('data-fallback-icon')).toBeNull();
  });

  it('waits for a slow blank-icon check before moving on to gstatic', async () => {
    let answerCheck: (isDefault: boolean) => void = () => {};
    const img = createImage();
    createRuntime({
      detectDefaultExtensionFavicon: (_img, url) => (url === extensionUrl
        ? new Promise((resolve) => {
          answerCheck = resolve;
        })
        : Promise.resolve(false)),
      requestFaviconData: (url) => Promise.resolve(url === gstaticUrl ? 'data:image/png;base64,real' : null)
    }).attachFaviconWithFallbacks(img, pageUrl, 'futurecomm.cn', { primaryUrl, allowRemoteImage: true });
    expect(img.src).toBe(primaryUrl);

    fail(img);
    expect(img.src).toBe(extensionUrl);
    expect(img.getAttribute('data-favicon-placeholder')).toBe('true');
    load(img);
    await wait(4);
    expect(img.src).toBe(extensionUrl);
    expect(img.getAttribute('data-favicon-placeholder')).toBe('true');
    answerCheck(true);
    await wait(4);
    expect(img.src).toBe(gstaticUrl);
  });

  it('shows the fallback icon when gstatic has no data either', async () => {
    const img = createImage();
    createRuntime({ requestFaviconData: () => Promise.resolve(null) })
      .attachFaviconWithFallbacks(img, pageUrl, 'futurecomm.cn', { primaryUrl, allowRemoteImage: true });
    expect(img.src).toBe(primaryUrl);

    fail(img);
    expect(img.src).toBe(extensionUrl);
    fail(img);
    expect(img.src).toBe(gstaticUrl);
    load(img);
    await wait(4);
    expect(img.getAttribute('data-fallback-icon')).toBe('true');
    expect(img.getAttribute('data-favicon-placeholder')).toBeNull();
  });

  it('lets a consumer put its own glyph in place of the generic fallback, once', async () => {
    const onUnavailable = vi.fn();
    const img = createImage();
    createRuntime({ requestFaviconData: () => Promise.resolve(null) })
      .attachFaviconWithFallbacks(img, pageUrl, 'futurecomm.cn', { primaryUrl, allowRemoteImage: true, onUnavailable });
    fail(img);
    fail(img);
    load(img);
    await wait(4);

    expect(onUnavailable).toHaveBeenCalledTimes(1);
  });

  it('keeps gstatic hidden while its data is on the way, and falls back when it has none', async () => {
    let answerData: (dataUrl: string | null) => void = () => {};
    const img = createImage();
    createRuntime({
      requestFaviconData: (url) => (url === gstaticUrl
        ? new Promise((resolve) => {
          answerData = resolve;
        })
        : Promise.resolve(null))
    }).attachFaviconWithFallbacks(img, pageUrl, 'futurecomm.cn', { primaryUrl, allowRemoteImage: true });
    expect(img.src).toBe(primaryUrl);

    fail(img);
    expect(img.src).toBe(extensionUrl);
    fail(img);
    expect(img.src).toBe(gstaticUrl);
    expect(img.getAttribute('data-favicon-placeholder')).toBe('true');
    load(img);
    await wait(4);
    expect(img.src).toBe(gstaticUrl);
    expect(img.getAttribute('data-favicon-placeholder')).toBe('true');
    answerData(null);
    await wait(4);
    expect(img.getAttribute('data-fallback-icon')).toBe('true');
  });

  it('starts over from the site icon when gstatic showed before, and falls back the same way', async () => {
    const img = createImage();
    img.src = gstaticUrl;
    img.setAttribute('data-favicon-current-src', gstaticUrl);
    createRuntime({ requestFaviconData: () => Promise.resolve(null) })
      .attachFaviconWithFallbacks(img, pageUrl, 'futurecomm.cn', { primaryUrl, allowRemoteImage: true });
    expect(img.src).toBe(primaryUrl);

    fail(img);
    expect(img.src).toBe(extensionUrl);
    fail(img);
    expect(img.src).toBe(gstaticUrl);
    load(img);
    await wait(4);
    expect(img.getAttribute('data-fallback-icon')).toBe('true');
  });

  it('hides a browser page\'s blank cache icon while it is checked, then tries the browser\'s own icon', async () => {
    const browserPageUrl = 'chrome://extensions/';
    const browserPagePrimaryUrl = `chrome-extension://abc/_favicon/?pageUrl=${encodeURIComponent(browserPageUrl)}&size=128`;
    const img = createImage();
    createRuntime({
      getChromeFaviconUrl: (url) => `chrome://favicon2/?pageUrl=${encodeURIComponent(url)}&size=128`,
      detectDefaultExtensionFavicon: (_img, url) => Promise.resolve(url === browserPagePrimaryUrl),
      requestFaviconData: () => Promise.resolve(null)
    }).attachFaviconWithFallbacks(img, browserPageUrl, '', { primaryUrl: browserPagePrimaryUrl });

    expect(img.src).toBe(browserPagePrimaryUrl);
    expect(img.getAttribute('data-favicon-placeholder')).toBe('true');
    load(img);
    await wait(4);
    expect(img.src).toBe(`chrome://favicon2/?pageUrl=${encodeURIComponent(browserPageUrl)}&size=128`);
    fail(img);
    expect(img.getAttribute('data-fallback-icon')).toBe('true');
  });
});

describe('New Tab favicon load timeouts', () => {
  function createTimedRuntime() {
    return createRuntime({
      getExtensionFaviconUrl: (url) => `chrome-extension://abc/_favicon/?pageUrl=${encodeURIComponent(url)}&size=128`,
      getChromeFaviconUrl: (url) => `chrome://favicon2/?pageUrl=${encodeURIComponent(url)}&size=128`,
      requestFaviconData: () => Promise.resolve(null),
      faviconCandidateLoadTimeoutMs: 12
    });
  }

  it('starts web pages on the browser cache without its host fallback, and browser pages on the browser\'s icon', () => {
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(0);
    const runtime = createTimedRuntime();
    const img = createImage();
    const browserImg = createImage();
    runtime.attachFaviconWithFallbacks(img, 'https://example.test/page', 'example.test');
    runtime.attachFaviconWithFallbacks(browserImg, 'chrome://newtab/', 'newtab');

    expect(img.src).toBe('chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fexample.test%2Fpage&size=128&fallbackToHost=0');
    expect(browserImg.src).toBe('chrome://favicon2/?pageUrl=chrome%3A%2F%2Fnewtab%2F&size=128');
  });

  it('moves on to the next candidate when one takes too long to load', async () => {
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(0);
    const img = createImage();
    createTimedRuntime().attachFaviconWithFallbacks(img, 'https://example.test/page', 'example.test');
    await wait(10);
    expect(img.src).toMatch(/^chrome-extension:/);
    await wait(8);

    expect(img.src).toBe(gstaticFor('https://example.test/page'));
  });

  it('leaves an image alone once a newer attach replaced the one that timed out', async () => {
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(0);
    const browserImg = createImage();
    createTimedRuntime().attachFaviconWithFallbacks(browserImg, 'chrome://newtab/', 'newtab');
    const shown = browserImg.src;
    browserImg._xThemeFaviconSession = (browserImg._xThemeFaviconSession || 0) + 1;
    await wait(18);

    expect(browserImg.src).toBe(shown);
  });
});
