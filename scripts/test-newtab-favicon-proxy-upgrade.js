const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const suggestionsViewSource = fs.readFileSync('react-src/search/suggestions.tsx', 'utf8');
assert.match(
  suggestionsViewSource,
  /options\.preloadIcon\(\s*String\(tab\.favIconUrl\),\s*String\(tab\.url \|\| ''\)\s*\)/,
  'open-tab favicon preloads should include the page URL so path-specific exclusions are enforced'
);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createFakeImage() {
  const attributes = new Map();
  const listeners = new Map();
  return {
    src: '',
    complete: false,
    naturalWidth: 16,
    naturalHeight: 16,
    isConnected: true,
    style: {
      setProperty() {},
      removeProperty() {}
    },
    classList: {
      contains() {
        return false;
      }
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    removeAttribute(name) {
      attributes.delete(name);
    },
    addEventListener(type, listener) {
      if (!listeners.has(type)) {
        listeners.set(type, new Set());
      }
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) {
      const set = listeners.get(type);
      if (set) {
        set.delete(listener);
      }
    },
    dispatchEvent(type) {
      if (type === 'load') {
        this.complete = true;
        this.naturalWidth = this.naturalWidth || 16;
        this.naturalHeight = this.naturalHeight || 16;
      }
      const set = listeners.get(type);
      if (!set) {
        return;
      }
      Array.from(set).forEach((listener) => listener());
    }
  };
}

const preloadedIconUrls = [];
const warmedIconLists = [];
const attachedDataRequests = [];

const sandbox = {
  console: {
    ...console,
    warn() {}
  },
  setTimeout,
  clearTimeout,
  URL
};
sandbox.globalThis = sandbox;
sandbox.LumnoFaviconViewCore = {
  createFallbackIconPresenter: require('../src/shared/favicon-view-core.js').createFallbackIconPresenter,
  createFaviconViewCore(options) {
    const config = options || {};
    return {
      setFallbackNodeVisible() {},
      setFaviconLoadState() {},
      applyFaviconOpticalShift() {},
      applyFaviconOpticalAlignment(img) {
        img.setAttribute('width', '128');
        img.setAttribute('height', '128');
      },
      requestFaviconData() {
        return typeof config.requestFaviconData === 'function'
          ? config.requestFaviconData.apply(null, arguments)
          : Promise.resolve(null);
      },
      setFaviconSrcWithAnimation(img, nextSrc, optionsArg) {
        img.setAttribute('width', '128');
        img.setAttribute('height', '128');
        const shouldDeferResolve = Boolean(optionsArg && optionsArg.deferResolve);
        const currentSrc = img.getAttribute('data-favicon-current-src') || '';
        const isFallbackVisible = img.getAttribute('data-fallback-icon') === 'true';
        const isPlaceholderVisible = img.getAttribute('data-favicon-placeholder') === 'true';
        if (currentSrc === nextSrc) {
          if ((isFallbackVisible || isPlaceholderVisible) && img.complete && img.naturalWidth > 0) {
            if (!shouldDeferResolve && typeof config.showResolvedFavicon === 'function') {
              config.showResolvedFavicon(img);
            }
            return false;
          }
          if (!isFallbackVisible && !isPlaceholderVisible) {
            return false;
          }
        }
        if (typeof config.showPendingFallbackIcon === 'function') {
          config.showPendingFallbackIcon(img);
        }
        img._xFaviconLoadToken = (img._xFaviconLoadToken || 0) + 1;
        const token = img._xFaviconLoadToken;
        const finalize = () => {
          if (token !== img._xFaviconLoadToken) {
            return;
          }
          if (!shouldDeferResolve && typeof config.showResolvedFavicon === 'function') {
            config.showResolvedFavicon(img);
          }
          img.setAttribute('data-favicon-current-src', nextSrc);
        };
        img.addEventListener('load', finalize, { once: true });
        img.complete = false;
        img.src = nextSrc;
        return true;
      },
      canReuseCurrentFavicon(img, nextSrc) {
        const currentSrc = img.getAttribute('data-favicon-current-src') || img.src || '';
        if (currentSrc !== nextSrc) {
          return false;
        }
        if (img.getAttribute('data-fallback-icon') === 'true' || img.getAttribute('data-favicon-placeholder') === 'true') {
          return false;
        }
        return true;
      },
      getLastWorkingFaviconSrc(img) {
        return img ? (img.getAttribute('data-favicon-current-src') || '') : '';
      },
      restoreWorkingFaviconOrFallback(img, _previousSrc, options) {
        const previousSrc = String(_previousSrc || '');
        if (previousSrc) {
          img.src = previousSrc;
          img.setAttribute('data-favicon-current-src', previousSrc);
          img.removeAttribute('data-fallback-icon');
          img.removeAttribute('data-favicon-placeholder');
          return true;
        }
        if (options && typeof options.applyFallbackIcon === 'function') {
          options.applyFallbackIcon(img);
        }
        return false;
      },
      attachFaviconData(_img, url, _hostOverride, pageUrlArg) {
        attachedDataRequests.push({ url, pageUrl: pageUrlArg || '' });
      },
      preloadIcon(url) {
        preloadedIconUrls.push(url);
      },
      warmIconCache(list) {
        warmedIconLists.push(list);
      },
      detectDefaultExtensionFavicon(img, url) {
        return typeof config.detectDefaultExtensionFavicon === 'function'
          ? config.detectDefaultExtensionFavicon(img, url)
          : Promise.resolve(false);
      }
    };
  }
};

vm.runInNewContext(fs.readFileSync('src/shared/favicon-utils.js', 'utf8'), sandbox, {
  filename: 'src/shared/favicon-utils.js'
});

vm.runInNewContext(fs.readFileSync('src/newtab/favicon-view.js', 'utf8'), sandbox, {
  filename: 'src/newtab/favicon-view.js'
});

const pageUrl = 'https://m2.futurecomm.cn/#/center';
const primaryUrl = 'https://m2.futurecomm.cn/favicon.ico';
const extensionUrl = `chrome-extension://abc/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=128&fallbackToHost=0`;
const gstaticUrl = `https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=${encodeURIComponent(pageUrl)}&size=128`;
const browserPageUrl = 'chrome://extensions/';
const browserPagePrimaryUrl = `chrome-extension://abc/_favicon/?pageUrl=${encodeURIComponent(browserPageUrl)}&size=128`;
const browserPageFallbackUrl = `chrome://favicon2/?pageUrl=${encodeURIComponent(browserPageUrl)}&size=128`;

function createRuntime(options) {
  const config = options || {};
  return sandbox.LumnoNewtabFaviconView.createFaviconViewRuntime({
    document: config.document || {
      querySelectorAll() {
        return [];
      }
    },
    windowObj: config.windowObj || {
      setTimeout,
      clearTimeout,
      requestAnimationFrame(callback) {
        return setTimeout(callback, 0);
      }
    },
    chromeApi: {
      runtime: {
        getURL(path) {
          return `chrome-extension://abc${path}`;
        }
      }
    },
    getRiSvg() {
      return '';
    },
    getExtensionFaviconUrl(targetPageUrl) {
      return `chrome-extension://abc/_favicon/?pageUrl=${encodeURIComponent(targetPageUrl)}&size=128` +
        (/^https?:\/\//i.test(targetPageUrl) ? '&fallbackToHost=0' : '');
    },
    getGstaticFaviconUrl(targetPageUrl) {
      return `https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=${encodeURIComponent(targetPageUrl)}&size=128`;
    },
    getHostFromUrl(url) {
      return new URL(url).hostname;
    },
    isFaviconProxyUrl(url) {
      return /_favicon\/|gstatic\.cn\/faviconV2/i.test(String(url || ''));
    },
    shouldBlockFaviconForHost() {
      return false;
    },
    isEnhancedFaviconFetchEnabled(targetPageUrl) {
      if (config.excludedPageUrl && targetPageUrl === config.excludedPageUrl) {
        return false;
      }
      return config.enhancedFaviconFetchEnabled !== false;
    },
    getStrictFaviconReason(targetPageUrl) {
      return config.excludedPageUrl === targetPageUrl ? 'exclusion'
        : (config.enhancedFaviconFetchEnabled === false ? 'global-off' : '');
    },
    isBlockedLocalFaviconUrl() {
      return false;
    },
    getPersistedFaviconEntry: config.getPersistedFaviconEntry,
    getPersistedFaviconDataEntry: config.getPersistedFaviconDataEntry,
    setPersistedFaviconUrl: config.setPersistedFaviconUrl,
    setPersistedFaviconData: config.setPersistedFaviconData,
    detectDefaultExtensionFavicon(_img, url) {
      if (typeof config.detectDefaultExtensionFavicon === 'function') {
        return config.detectDefaultExtensionFavicon(_img, url);
      }
      return Promise.resolve(url === extensionUrl);
    },
    requestFaviconData: config.requestFaviconData,
    preloadThemeFromFavicon() {},
    faviconCandidateLoadTimeoutMs: 1000
  });
}

(async () => {
  const unreachablePageUrl = 'https://unreachable.example/';
  const unreachableImg = createFakeImage();
  let unreachableSrc = '';
  let unreachableSrcAssignments = 0;
  Object.defineProperty(unreachableImg, 'src', {
    get() {
      return unreachableSrc;
    },
    set(value) {
      unreachableSrc = String(value || '');
      if (unreachableSrc) {
        unreachableSrcAssignments += 1;
        setTimeout(() => unreachableImg.dispatchEvent('error'), 0);
      }
    }
  });
  const unreachableRuntime = createRuntime({
    document: {
      querySelectorAll() {
        return unreachableImg.getAttribute('data-fallback-icon') === 'true' ? [unreachableImg] : [];
      }
    },
    windowObj: {
      setTimeout: (callback, ms) => setTimeout(callback, Math.ceil((Number(ms) || 0) / 50)),
      clearTimeout,
      requestAnimationFrame(callback) {
        return setTimeout(callback, 0);
      }
    },
    requestFaviconData() {
      return Promise.resolve(null);
    }
  });
  unreachableRuntime.attachFaviconWithFallbacks(unreachableImg, unreachablePageUrl, 'unreachable.example');
  await wait(300);
  const settledAssignments = unreachableSrcAssignments;
  await wait(300);
  assert.strictEqual(unreachableSrcAssignments, settledAssignments,
    'a favicon that never loads must stop being retried instead of polling forever');
  assert.strictEqual(unreachableImg.getAttribute('data-fallback-icon'), 'true');

  const nestedPageUrl = 'https://chrome.google.com/webstore/devconsole?hl=zh-CN';
  const rootBrowserUrl = 'chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fchrome.google.com%2F&size=128&fallbackToHost=0';
  const nestedPageImage = createFakeImage();
  createRuntime({
    getPersistedFaviconEntry: () => ({ url: rootBrowserUrl })
  }).attachFaviconWithFallbacks(nestedPageImage, nestedPageUrl, 'chrome.google.com', {
    primaryUrl: rootBrowserUrl
  });
  assert.strictEqual(new URL(nestedPageImage.src).searchParams.get('pageUrl'), nestedPageUrl,
    'newtab search and bookmark rendering must skip stale origin-scoped favicon candidates');
  assert.strictEqual(new URL(nestedPageImage.src).searchParams.get('fallbackToHost'), '0');

  const previousPageData = 'data:image/png;base64,cHJldmlvdXNwYWdl';
  for (const previousPageUrl of ['https://chrome.google.com/', '', nestedPageUrl]) {
    const reusedImage = createFakeImage();
    reusedImage.src = previousPageData;
    reusedImage.setAttribute('data-favicon-current-src', previousPageData);
    if (previousPageUrl) {
      reusedImage.setAttribute('data-x-nt-favicon-page-url', previousPageUrl);
    }
    createRuntime({ enhancedFaviconFetchEnabled: false }).attachFaviconWithFallbacks(
      reusedImage, nestedPageUrl, 'chrome.google.com'
    );
    reusedImage._xThemeFaviconErrorHandler();
    reusedImage._xThemeFaviconErrorHandler();
    assert.strictEqual(reusedImage.src === previousPageData, previousPageUrl === nestedPageUrl,
      'failed acquisition may restore opaque image bytes only when the previous page is the same document');
  }

  const shortcutSnapshot = 'data:image/png;base64,c25hcHNob3Q=';
  const shortcutImage = createFakeImage();
  const stableShortcutRuntime = createRuntime({
    document: { querySelectorAll: () => [shortcutImage] }
  });
  stableShortcutRuntime.attachFaviconWithFallbacks(shortcutImage, pageUrl, 'futurecomm.cn', {
    primaryUrl: extensionUrl,
    pageSpecificUrl: shortcutSnapshot,
    skipPersisted: true,
    sourceProfile: 'shortcut'
  });
  assert.strictEqual(shortcutImage.src, shortcutSnapshot);
  shortcutImage.dispatchEvent('load');
  stableShortcutRuntime.refreshThemeAwareFavicons();
  assert.strictEqual(shortcutImage.src, shortcutSnapshot,
    'policy/theme refreshes must retain a shortcut snapshot instead of switching to Chrome');
  const oldBrowserImage = createFakeImage();
  oldBrowserImage.src = extensionUrl;
  oldBrowserImage.setAttribute('data-favicon-current-src', extensionUrl);
  stableShortcutRuntime.attachFaviconWithFallbacks(oldBrowserImage, pageUrl, 'futurecomm.cn', {
    skipPersisted: true, sourceProfile: 'shortcut'
  });
  assert.strictEqual(oldBrowserImage.getAttribute('data-fallback-icon'), 'true',
    'shortcut recovery must not restore a previously displayed live Chrome icon');

  const persistedDataUrl = 'data:image/png;base64,cGVyc2lzdGVk';
  const persistedWrites = [];
  const pageCacheKey = 'page:https://m2.futurecomm.cn/';
  const persistedRuntime = createRuntime({
    getPersistedFaviconEntry(cacheKey) {
      assert.strictEqual(cacheKey, pageCacheKey);
      return { url: primaryUrl, updatedAt: Date.now() - 1 };
    },
    getPersistedFaviconDataEntry(cacheKey) {
      assert.strictEqual(cacheKey, pageCacheKey);
      return { dataUrl: persistedDataUrl, updatedAt: Date.now() };
    },
    setPersistedFaviconUrl(cacheKey, url) {
      persistedWrites.push({ cacheKey, type: 'url', value: url });
    },
    setPersistedFaviconData(cacheKey, dataUrl) {
      persistedWrites.push({ cacheKey, type: 'data', value: dataUrl });
    }
  });
  const persistedImg = createFakeImage();
  persistedRuntime.attachFaviconWithFallbacks(
    persistedImg,
    pageUrl,
    'futurecomm.cn',
    { primaryUrl }
  );
  assert.strictEqual(
    persistedImg.src,
    persistedDataUrl,
    'theme-aware shortcut favicons should render local persisted data before network candidates'
  );
  assert.strictEqual(
    persistedImg.getAttribute('data-x-nt-favicon-cache-key'),
    pageCacheKey,
    'theme-aware favicons should keep a stable page cache key'
  );
  persistedImg.dispatchEvent('load');
  await wait(4);
  assert.deepStrictEqual(
    persistedWrites[0],
    { cacheKey: pageCacheKey, type: 'data', value: persistedDataUrl },
    'confirmed persisted favicon data should refresh its local cache entry'
  );

  const profilePageUrl = 'https://x.com/creator';
  const homePageUrl = 'https://x.com/home';
  const profileCacheKey = `page:${profilePageUrl}`;
  const homeCacheKey = `page:${homePageUrl}`;
  const profileIcon = 'data:image/png;base64,cHJvZmlsZQ==';
  const homeIcon = 'data:image/png;base64,aG9tZQ==';
  const sameHostCacheReads = [];
  const sameHostRuntime = createRuntime({
    getPersistedFaviconEntry(cacheKey) {
      sameHostCacheReads.push(cacheKey);
      return null;
    },
    getPersistedFaviconDataEntry(cacheKey) {
      sameHostCacheReads.push(cacheKey);
      if (cacheKey === profileCacheKey) {
        return { dataUrl: profileIcon, updatedAt: Date.now() };
      }
      if (cacheKey === homeCacheKey) {
        return { dataUrl: homeIcon, updatedAt: Date.now() };
      }
      if (cacheKey === 'x.com') {
        return { dataUrl: profileIcon, updatedAt: Date.now() };
      }
      return null;
    }
  });
  const profileImg = createFakeImage();
  const homeImg = createFakeImage();
  sameHostRuntime.attachFaviconWithFallbacks(profileImg, profilePageUrl, 'x.com');
  sameHostRuntime.attachFaviconWithFallbacks(homeImg, homePageUrl, 'x.com');
  assert.strictEqual(profileImg.src, profileIcon);
  assert.strictEqual(homeImg.src, homeIcon);
  assert.deepStrictEqual(
    sameHostCacheReads,
    [profileCacheKey, profileCacheKey, homeCacheKey, homeCacheKey],
    'same-host pages should never read the legacy shared host favicon entry'
  );

  const shortcutCachedDataUrl = 'data:image/png;base64,c2hvcnRjdXQtY2FjaGU=';
  const shortcutPersistedWrites = [];
  const shortcutRuntime = createRuntime({
    getPersistedFaviconEntry() {
      throw new Error('shortcut rendering should not read the shared host URL cache');
    },
    getPersistedFaviconDataEntry() {
      throw new Error('shortcut rendering should not read the shared host data cache');
    },
    setPersistedFaviconUrl(cacheKey, url) {
      shortcutPersistedWrites.push({ cacheKey, type: 'url', value: url });
    },
    setPersistedFaviconData(cacheKey, dataUrl) {
      shortcutPersistedWrites.push({ cacheKey, type: 'data', value: dataUrl });
    }
  });
  const shortcutImg = createFakeImage();
  shortcutRuntime.attachFaviconWithFallbacks(shortcutImg, pageUrl, 'futurecomm.cn', {
    primaryUrl: extensionUrl,
    pageSpecificUrl: shortcutCachedDataUrl,
    skipPersisted: true
  });
  assert.strictEqual(
    shortcutImg.src,
    shortcutCachedDataUrl,
    'shortcut tiles should prefer an exact page icon over browser and shared host caches'
  );
  shortcutImg.dispatchEvent('load');
  await wait(4);
  assert.deepStrictEqual(
    shortcutPersistedWrites,
    [],
    'shortcut page icons should not write into the shared host favicon cache'
  );

  const privatePageUrl = 'https://foo.example.com/private';
  const publicPageUrl = 'https://foo.example.com/public';
  const matrixDirectUrl = 'https://foo.example.com/favicon.ico';
  const privateExtensionUrl = `chrome-extension://abc/_favicon/?pageUrl=${encodeURIComponent(privatePageUrl)}&size=128&fallbackToHost=0`;
  const privateGstaticUrl = `https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=${encodeURIComponent(privatePageUrl)}&size=128`;
  const publicGstaticUrl = `https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=${encodeURIComponent(publicPageUrl)}&size=128`;
  const matrixRuntime = createRuntime({
    enhancedFaviconFetchEnabled: true,
    excludedPageUrl: privatePageUrl
  });
  const preloadStart = preloadedIconUrls.length;
  const warmStart = warmedIconLists.length;
  const dataStart = attachedDataRequests.length;
  const privateImg = createFakeImage();
  matrixRuntime.attachFaviconWithFallbacks(privateImg, privatePageUrl, 'foo.example.com', {
    primaryUrl: matrixDirectUrl
  });
  assert.strictEqual(privateImg.src, privateExtensionUrl, 'excluded newtab matrix path should render only Lumno browser cache');
  privateImg._xThemeFaviconErrorHandler();
  assert.notStrictEqual(privateImg.src, privateGstaticUrl, 'excluded newtab matrix path should not fall through to gstatic');
  matrixRuntime.preloadIcon(matrixDirectUrl, privatePageUrl);
  matrixRuntime.preloadIcon(privateGstaticUrl, privatePageUrl);
  matrixRuntime.preloadIcon(privateExtensionUrl, privatePageUrl);
  matrixRuntime.attachFaviconData(createFakeImage(), matrixDirectUrl, 'foo.example.com', privatePageUrl);
  matrixRuntime.warmIconCache([{ url: privatePageUrl, favicon: matrixDirectUrl }]);
  assert.deepStrictEqual(
    Array.from(new Set(preloadedIconUrls.slice(preloadStart))),
    [privateExtensionUrl],
    'excluded newtab matrix path should not preload direct or gstatic sources'
  );
  assert.deepStrictEqual(attachedDataRequests.slice(dataStart), [], 'excluded newtab matrix path should not attach direct favicon data');
  assert.strictEqual(warmedIconLists[warmStart][0].favicon, privateExtensionUrl, 'excluded paths should replace warm-cache URLs with browser cache');

  const publicImg = createFakeImage();
  matrixRuntime.attachFaviconWithFallbacks(publicImg, publicPageUrl, 'foo.example.com', {
    primaryUrl: matrixDirectUrl
  });
  assert.strictEqual(publicImg.src, `chrome-extension://abc/_favicon/?pageUrl=${encodeURIComponent(publicPageUrl)}&size=128&fallbackToHost=0`, 'enhanced-on paths should prefer browser cache');
  matrixRuntime.preloadIcon(matrixDirectUrl, publicPageUrl);
  matrixRuntime.preloadIcon(publicGstaticUrl, publicPageUrl);
  matrixRuntime.attachFaviconData(createFakeImage(), matrixDirectUrl, 'foo.example.com', publicPageUrl);
  matrixRuntime.warmIconCache([{ url: publicPageUrl, favicon: matrixDirectUrl }]);
  assert.strictEqual(preloadedIconUrls.includes(matrixDirectUrl), false, 'enhanced-on paths must not preload website icons');
  assert.strictEqual(preloadedIconUrls.includes(publicGstaticUrl), false, 'preloading should prefer browser cache before third-party fallback');
  assert.deepStrictEqual(attachedDataRequests.slice(dataStart), [], 'automatic direct sources must not reach the data loader');
  assert.strictEqual(
    warmedIconLists[warmedIconLists.length - 1][0].favicon,
    `chrome-extension://abc/_favicon/?pageUrl=${encodeURIComponent(publicPageUrl)}&size=128&fallbackToHost=0`,
    'enhanced-on warm-cache sources should use Chrome'
  );

  const excludedRuntime = createRuntime({
    enhancedFaviconFetchEnabled: true,
    excludedPageUrl: pageUrl
  });
  const excludedImg = createFakeImage();
  excludedRuntime.attachFaviconWithFallbacks(excludedImg, pageUrl, 'futurecomm.cn', {
    primaryUrl
  });
  assert.strictEqual(
    excludedImg.src,
    extensionUrl,
    'enhanced-on excluded newtab paths should skip the direct target favicon'
  );
  excludedImg._xThemeFaviconErrorHandler();
  assert.strictEqual(
    excludedImg.src,
    extensionUrl,
    'enhanced-on excluded newtab paths should not retry gstatic after browser-cache failure'
  );
  excludedRuntime.preloadIcon(primaryUrl, pageUrl);
  excludedRuntime.preloadIcon(extensionUrl, pageUrl);
  assert.deepStrictEqual(
    preloadedIconUrls.slice(-1),
    [extensionUrl],
    'excluded newtab paths should not preload direct target icons'
  );
  excludedRuntime.warmIconCache([{ url: pageUrl, favicon: primaryUrl }]);
  assert.strictEqual(
    warmedIconLists[warmedIconLists.length - 1][0].favicon,
    extensionUrl,
    'excluded newtab paths should warm browser cache instead of network icons'
  );
  const excludedStaleImg = createFakeImage();
  excludedStaleImg.src = primaryUrl;
  excludedStaleImg.setAttribute('data-favicon-current-src', primaryUrl);
  excludedRuntime.attachFaviconWithFallbacks(excludedStaleImg, pageUrl, 'futurecomm.cn', { primaryUrl });
  excludedStaleImg._xThemeFaviconErrorHandler();
  assert.notStrictEqual(
    excludedStaleImg.src,
    primaryUrl,
    'excluded newtab paths should not restore a previously working direct favicon after strict candidates fail'
  );

  const runtime = createRuntime({
    requestFaviconData(url) {
      return Promise.resolve(url === gstaticUrl ? 'data:image/png;base64,real' : null);
    }
  });
  const img = createFakeImage();
  runtime.attachFaviconWithFallbacks(img, pageUrl, 'futurecomm.cn', {
    primaryUrl,
    allowRemoteImage: true
  });
  assert.strictEqual(img.src, primaryUrl);

  img._xThemeFaviconErrorHandler();
  assert.strictEqual(img.src, extensionUrl);

  img.dispatchEvent('load');
  await wait(4);
  assert.strictEqual(img.src, gstaticUrl);
  assert.strictEqual(/google\.com\/s2\/favicons|favicon\.is\//i.test(img.src), false);

  img.dispatchEvent('load');
  await wait(4);
  assert.strictEqual(img.getAttribute('data-favicon-placeholder'), null);
  assert.strictEqual(img.getAttribute('data-fallback-icon'), null);

  const realExtensionRuntime = createRuntime({
    detectDefaultExtensionFavicon() {
      return Promise.resolve(false);
    },
    requestFaviconData() {
      return Promise.resolve(null);
    }
  });
  const realExtensionImg = createFakeImage();
  realExtensionRuntime.attachFaviconWithFallbacks(realExtensionImg, pageUrl, 'futurecomm.cn', {
    primaryUrl,
    allowRemoteImage: true
  });
  assert.strictEqual(realExtensionImg.src, primaryUrl);

  realExtensionImg._xThemeFaviconErrorHandler();
  assert.strictEqual(realExtensionImg.src, extensionUrl);
  assert.strictEqual(realExtensionImg.getAttribute('data-favicon-placeholder'), 'true');

  realExtensionImg.dispatchEvent('load');
  await wait(4);
  assert.strictEqual(realExtensionImg.src, extensionUrl);
  assert.strictEqual(realExtensionImg.getAttribute('data-favicon-placeholder'), null);
  assert.strictEqual(realExtensionImg.getAttribute('data-fallback-icon'), null);

  let resolveExtensionDefaultCheck = null;
  const delayedExtensionRuntime = createRuntime({
    detectDefaultExtensionFavicon(_img, url) {
      if (url !== extensionUrl) {
        return Promise.resolve(false);
      }
      return new Promise((resolve) => {
        resolveExtensionDefaultCheck = resolve;
      });
    },
    requestFaviconData(url) {
      return Promise.resolve(url === gstaticUrl ? 'data:image/png;base64,real' : null);
    }
  });
  const delayedExtensionImg = createFakeImage();
  delayedExtensionRuntime.attachFaviconWithFallbacks(delayedExtensionImg, pageUrl, 'futurecomm.cn', {
    primaryUrl,
    allowRemoteImage: true
  });
  assert.strictEqual(delayedExtensionImg.src, primaryUrl);

  delayedExtensionImg._xThemeFaviconErrorHandler();
  assert.strictEqual(delayedExtensionImg.src, extensionUrl);
  assert.strictEqual(delayedExtensionImg.getAttribute('data-favicon-placeholder'), 'true');

  delayedExtensionImg.dispatchEvent('load');
  await wait(4);
  assert.strictEqual(delayedExtensionImg.src, extensionUrl);
  assert.strictEqual(delayedExtensionImg.getAttribute('data-favicon-placeholder'), 'true');
  resolveExtensionDefaultCheck(true);
  await wait(4);
  assert.strictEqual(delayedExtensionImg.src, gstaticUrl);

  const placeholderRuntime = createRuntime({
    requestFaviconData() {
      return Promise.resolve(null);
    }
  });
  const placeholderImg = createFakeImage();
  placeholderRuntime.attachFaviconWithFallbacks(placeholderImg, pageUrl, 'futurecomm.cn', {
    primaryUrl,
    allowRemoteImage: true
  });
  assert.strictEqual(placeholderImg.src, primaryUrl);

  placeholderImg._xThemeFaviconErrorHandler();
  assert.strictEqual(placeholderImg.src, extensionUrl);

  placeholderImg._xThemeFaviconErrorHandler();
  assert.strictEqual(placeholderImg.src, gstaticUrl);

  placeholderImg.dispatchEvent('load');
  await wait(4);
  assert.strictEqual(placeholderImg.getAttribute('data-fallback-icon'), 'true');
  assert.strictEqual(placeholderImg.getAttribute('data-favicon-placeholder'), null);

  let unavailableCount = 0;
  const unavailableRuntime = createRuntime({
    requestFaviconData() {
      return Promise.resolve(null);
    }
  });
  const unavailableImg = createFakeImage();
  unavailableRuntime.attachFaviconWithFallbacks(
    unavailableImg,
    pageUrl,
    'futurecomm.cn',
    {
      primaryUrl,
      allowRemoteImage: true,
      onUnavailable() {
        unavailableCount += 1;
      }
    }
  );
  unavailableImg._xThemeFaviconErrorHandler();
  unavailableImg._xThemeFaviconErrorHandler();
  unavailableImg.dispatchEvent('load');
  await wait(4);
  assert.strictEqual(
    unavailableCount,
    1,
    'provider favicon consumers should be able to replace the generic fallback with their own glyph'
  );

  let resolveGstaticData = null;
  const delayedGstaticRuntime = createRuntime({
    requestFaviconData(url) {
      if (url !== gstaticUrl) {
        return Promise.resolve(null);
      }
      return new Promise((resolve) => {
        resolveGstaticData = resolve;
      });
    }
  });
  const delayedGstaticImg = createFakeImage();
  delayedGstaticRuntime.attachFaviconWithFallbacks(delayedGstaticImg, pageUrl, 'futurecomm.cn', {
    primaryUrl,
    allowRemoteImage: true
  });
  assert.strictEqual(delayedGstaticImg.src, primaryUrl);

  delayedGstaticImg._xThemeFaviconErrorHandler();
  assert.strictEqual(delayedGstaticImg.src, extensionUrl);

  delayedGstaticImg._xThemeFaviconErrorHandler();
  assert.strictEqual(delayedGstaticImg.src, gstaticUrl);
  assert.strictEqual(delayedGstaticImg.getAttribute('data-favicon-placeholder'), 'true');

  delayedGstaticImg.dispatchEvent('load');
  await wait(4);
  assert.strictEqual(delayedGstaticImg.src, gstaticUrl);
  assert.strictEqual(delayedGstaticImg.getAttribute('data-favicon-placeholder'), 'true');
  resolveGstaticData(null);
  await wait(4);
  assert.strictEqual(delayedGstaticImg.getAttribute('data-fallback-icon'), 'true');

  const staleRuntime = createRuntime({
    requestFaviconData() {
      return Promise.resolve(null);
    }
  });
  const staleImg = createFakeImage();
  staleImg.src = gstaticUrl;
  staleImg.setAttribute('data-favicon-current-src', gstaticUrl);
  staleRuntime.attachFaviconWithFallbacks(staleImg, pageUrl, 'futurecomm.cn', {
    primaryUrl,
    allowRemoteImage: true
  });
  assert.strictEqual(staleImg.src, primaryUrl);

  staleImg._xThemeFaviconErrorHandler();
  assert.strictEqual(staleImg.src, extensionUrl);

  staleImg._xThemeFaviconErrorHandler();
  assert.strictEqual(staleImg.src, gstaticUrl);

  staleImg.dispatchEvent('load');
  await wait(4);
  assert.strictEqual(staleImg.getAttribute('data-fallback-icon'), 'true');

  const browserPageRuntime = createRuntime({
    detectDefaultExtensionFavicon(_img, url) {
      return Promise.resolve(url === browserPagePrimaryUrl);
    },
    requestFaviconData() {
      return Promise.resolve(null);
    }
  });
  const browserPageImg = createFakeImage();
  browserPageRuntime.attachFaviconWithFallbacks(browserPageImg, browserPageUrl, '', {
    primaryUrl: browserPagePrimaryUrl
  });
  assert.strictEqual(browserPageImg.src, browserPagePrimaryUrl);
  assert.strictEqual(
    browserPageImg.getAttribute('data-favicon-placeholder'),
    'true',
    'browser page primary favicon proxy should stay hidden while default proxy detection runs'
  );

  browserPageImg.dispatchEvent('load');
  await wait(4);
  assert.strictEqual(
    browserPageImg.src,
    browserPageFallbackUrl,
    'browser page default primary proxy should fall through to the browser favicon candidate'
  );

  browserPageImg._xThemeFaviconErrorHandler();
  assert.strictEqual(browserPageImg.getAttribute('data-fallback-icon'), 'true');
  console.log('newtab favicon candidate order tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
