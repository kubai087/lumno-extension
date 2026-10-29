const assert = require('assert');
const vm = require('vm');
const path = require('path');
const { moduleScript } = require('../helpers/module-script');

function TestCustomEvent(type) {
  this.type = type;
}

path.resolve(__dirname, '..', '..');

function createFakeImage() {
  const attributes = new Map();
  const listeners = new Map();
  return {
    src: '',
    complete: false,
    naturalWidth: 0,
    naturalHeight: 0,
    isConnected: true,
    style: {
      setProperty() {},
      removeProperty() {}
    },
    parentElement: null,
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
      const set = listeners.get(type);
      if (!set) {
        return;
      }
      Array.from(set).forEach((listener) => listener.call(this, { type, target: this }));
    }
  };
}

// The fallback icon the suggestion row draws right after its image, shown
// as it is while the icon is still pending.
function attachFakeFallbackNode(img) {
  const attributes = new Map([['data-visible', 'true']]);
  const node = {
    nodeType: 1,
    namespaceURI: 'http://www.w3.org/1999/xhtml',
    classList: {
      contains: (name) => name === '_x_extension_overlay_favicon_fallback_2026_unique_'
    },
    style: { setProperty() {}, removeProperty() {} },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    }
  };
  img.nextElementSibling = node;
  return node;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Web pages cannot load _favicon URLs; the background answers them with image
// bytes, which this stands in for (one distinct data: URL per source).
function browserCacheDataUrl(url) {
  return `data:image/png;base64,${Buffer.from(String(url)).toString('base64')}`;
}

function answerBrowserCacheRequests(url) {
  return Promise.resolve(/^chrome-extension:\/\/[^/]+\/_favicon\//i.test(String(url || ''))
    ? browserCacheDataUrl(url)
    : null);
}

// The favicon source an image shows: the background-fetched source behind a
// data: URL, or the URL it loads directly.
function renderedSource(img) {
  return img.getAttribute('data-favicon-data-source') || img.src;
}

function createRuntime(options) {
  const config = options || {};
  const preloadedUrls = [];
  const attachedDataUrls = [];
  const attachedDataRequestPages = [];
  const warmedIconLists = [];
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    URL,
    CustomEvent: TestCustomEvent
  };
  sandbox.globalThis = sandbox;
  sandbox.LumnoFaviconViewCore = {
    createFallbackIconPresenter: require('../../src/shared/favicon/favicon-view-core.ts').createFallbackIconPresenter,
    createFaviconViewCore(config) {
      return {
        setFallbackNodeVisible() {},
        setFaviconLoadState() {},
        applyFaviconOpticalShift() {},
        applyFaviconOpticalAlignment(img) {
          img.setAttribute('width', '128');
          img.setAttribute('height', '128');
        },
        cacheFaviconData() {},
        requestFaviconData() {
          return typeof config.requestFaviconData === 'function'
            ? config.requestFaviconData.apply(null, arguments)
            : Promise.resolve(null);
        },
        setFaviconSrcWithAnimation(img, nextSrc, optionsArg) {
          if (config.isBlockedLocalFaviconUrl(nextSrc)) {
            return false;
          }
          img.src = nextSrc;
          img.setAttribute('data-favicon-current-src', nextSrc);
          if (String(nextSrc || '').startsWith('data:') && optionsArg && optionsArg.sourceUrl) {
            img.setAttribute('data-favicon-data-source', optionsArg.sourceUrl);
          } else {
            img.removeAttribute('data-favicon-data-source');
          }
          return true;
        },
        canReuseCurrentFavicon() {
          return false;
        },
        getLastWorkingFaviconSrc(img) {
          return img ? (img.getAttribute('data-favicon-current-src') || '') : '';
        },
        restoreWorkingFaviconOrFallback(img, previousSrc, options) {
          if (previousSrc) {
            img.src = previousSrc;
            img.setAttribute('data-favicon-current-src', previousSrc);
            return true;
          }
          if (options && typeof options.onFailed === 'function') {
            options.onFailed();
          }
          return false;
        },
        attachFaviconData(_img, url, _hostOverride, pageUrlArg) {
          attachedDataUrls.push(url);
          attachedDataRequestPages.push(pageUrlArg || '');
        },
        preloadIcon(url) {
          preloadedUrls.push(url);
        },
        warmIconCache(list) {
          warmedIconLists.push(list);
        },
        detectDefaultExtensionFavicon() {
          return Promise.resolve(false);
        }
      };
    }
  };
  vm.runInNewContext(moduleScript('tests/helpers/favicon-utils.ts', 'LumnoFaviconUtils', null, { 'src/shared/favicon/favicon-view-core.ts': 'LumnoFaviconViewCore' }), sandbox, {
    filename: 'tests/helpers/favicon-utils.ts'
  });
  vm.runInNewContext(moduleScript('src/overlay/favicon-view.ts', 'LumnoOverlayFaviconView', null, { 'src/shared/favicon/favicon-view-core.ts': 'LumnoFaviconViewCore' }), sandbox, {
    filename: 'src/overlay/favicon-view.ts'
  });

  const localPageUrl = 'http://127.0.0.1:4321/';
  const extensionUrl = `chrome-extension://abc/_favicon/?pageUrl=${encodeURIComponent(localPageUrl)}&size=128&fallbackToHost=0`;
  `https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=${encodeURIComponent(localPageUrl)}&size=128`;
  const browserPageUrl = 'chrome://extensions/';
  const browserPageExtensionUrl = `chrome-extension://abc/_favicon/?pageUrl=${encodeURIComponent(browserPageUrl)}&size=128`;
  const browserPageFavicon2Url = `chrome://favicon2/?pageUrl=${encodeURIComponent(browserPageUrl)}&size=128`;
  const vpnPageUrl = 'https://foo.example.com/';
  const vpnDirectFaviconUrl = 'https://foo.example.com/favicon.ico';
  const vpnExtensionUrl = `chrome-extension://abc/_favicon/?pageUrl=${encodeURIComponent(vpnPageUrl)}&size=128&fallbackToHost=0`;
  const vpnGstaticUrl = `https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=${encodeURIComponent(vpnPageUrl)}&size=128`;

  return {
    localPageUrl,
    extensionUrl,
    browserPageUrl,
    browserPageExtensionUrl,
    browserPageFavicon2Url,
    vpnPageUrl,
    vpnDirectFaviconUrl,
    vpnExtensionUrl,
    vpnGstaticUrl,
    preloadedUrls,
    attachedDataUrls,
    attachedDataRequestPages,
    warmedIconLists,
    runtime: sandbox.LumnoOverlayFaviconView.createOverlayFaviconViewRuntime({
      document: {
        createElement() {
          const attributes = new Map();
          return {
            className: '',
            innerHTML: '',
            isConnected: false,
            parentElement: null,
            parentNode: null,
            setAttribute(name, value) {
              attributes.set(name, String(value));
            },
            getAttribute(name) {
              return attributes.has(name) ? attributes.get(name) : null;
            },
            removeAttribute(name) {
              attributes.delete(name);
            }
          };
        }
      },
      windowObj: {
        setTimeout,
        clearTimeout
      },
      chromeApi: {
        runtime: {
          id: 'abc',
          getURL(path) {
            return `chrome-extension://abc${path}`;
          }
        }
      },
      requestFaviconData: Object.prototype.hasOwnProperty.call(config, 'requestFaviconData')
        ? config.requestFaviconData
        : answerBrowserCacheRequests,
      getHostFromUrl(url) {
        try {
          return new URL(url).hostname.toLowerCase();
        } catch (e) {
          return '';
        }
      },
      getExtensionFaviconUrl(url) {
        return `chrome-extension://abc/_favicon/?pageUrl=${encodeURIComponent(url)}&size=128` +
          (/^https?:\/\//i.test(url) ? '&fallbackToHost=0' : '');
      },
      getGstaticFaviconUrl(url) {
        return `https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=${encodeURIComponent(url)}&size=128`;
      },
      getChromeFaviconUrl(url) {
        return `chrome://favicon2/?pageUrl=${encodeURIComponent(url)}&size=128`;
      },
      shouldBlockFaviconForHost() {
        return false;
      },
      shouldBlockOverlayFaviconForHost(hostname) {
        if (typeof config.shouldBlockOverlayFaviconForHost === 'function') {
          return config.shouldBlockOverlayFaviconForHost(hostname);
        }
        const host = String(hostname || '').toLowerCase();
        return host === '127.0.0.1' || host === 'localhost';
      },
      isEnhancedFaviconFetchEnabled(pageUrl) {
        if (config.excludedPageUrl && pageUrl === config.excludedPageUrl) {
          return false;
        }
        return Object.prototype.hasOwnProperty.call(config, 'enhancedFaviconFetchEnabled')
          ? config.enhancedFaviconFetchEnabled
          : true;
      },
      isBlockedLocalFaviconUrl() {
        return false;
      },
      isFaviconProxyUrl(url) {
        return /_favicon\/|gstatic\.cn\/faviconV2/i.test(String(url || ''));
      },
      preloadThemeFromFavicon() {},
      faviconDataCache: config.faviconDataCache,
      getOverlayPanel: config.getOverlayPanel,
      getSuggestionRowsRoot: config.getSuggestionRowsRoot,
      getStrictFaviconReason(pageUrl) {
        return config.excludedPageUrl === pageUrl ? 'exclusion'
          : (config.enhancedFaviconFetchEnabled === false ? 'global-off' : '');
      },
      faviconCandidateLoadTimeoutMs: config.faviconCandidateLoadTimeoutMs === undefined
        ? 1000 : config.faviconCandidateLoadTimeoutMs
    })
  };
}

async function testOverlayResolvesLocalFaviconThroughDataUrl() {
  const requestedUrls = [];
  const dataUrl = 'data:image/png;base64,bG9jYWw=';
  const { runtime, localPageUrl, extensionUrl } = createRuntime({
    requestFaviconData(url, pageUrl) {
      requestedUrls.push({ url, pageUrl: pageUrl || '' });
      return Promise.resolve(url === extensionUrl ? dataUrl : null);
    }
  });
  const img = createFakeImage();
  let failed = false;

  runtime.attachResolvedFaviconWithFallbacks(
    img,
    localPageUrl,
    '127.0.0.1',
    extensionUrl,
    () => {
      failed = true;
    }
  );

  await wait(0);

  assert.strictEqual(failed, false, 'local overlay favicon should not fall back when background returns data');
  assert.deepStrictEqual(
    requestedUrls,
    [{ url: extensionUrl, pageUrl: localPageUrl }],
    'local overlay favicon should preserve page-rule context when requesting data through background'
  );
  assert.strictEqual(img.src, dataUrl, 'local overlay favicon should only render the returned data URL');
  assert.strictEqual(
    img.getAttribute('data-favicon-data-source'),
    extensionUrl,
    'data URL should keep the unsafe source only as metadata'
  );
  assert.strictEqual(
    /127\.0\.0\.1|localhost/.test(img.src),
    false,
    'page-visible image src should never contain the local URL'
  );
}

async function testOverlayFallsBackWhenLocalFaviconDataUnavailable() {
  const { runtime, localPageUrl, extensionUrl } = createRuntime({ requestFaviconData: () => Promise.resolve(null) });
  const img = createFakeImage();
  const fallbackNode = attachFakeFallbackNode(img);
  let failed = false;
  let fallbackVisibleWhenRowTakesOver = null;

  runtime.attachResolvedFaviconWithFallbacks(
    img,
    localPageUrl,
    '127.0.0.1',
    extensionUrl,
    () => {
      failed = true;
      fallbackVisibleWhenRowTakesOver = fallbackNode.getAttribute('data-visible');
    }
  );

  await wait(0);

  assert.strictEqual(failed, true, 'local overlay favicon should fall back immediately');
  assert.strictEqual(
    fallbackVisibleWhenRowTakesOver,
    'false',
    'the row\'s pending fallback should be hidden before the row draws its failed icon'
  );
  assert.strictEqual(img.src, '', 'local overlay favicon should not assign a page-visible image src');
}

async function testOverlaySkipsRootIconProbeWhenEnhancedFetchDisabled() {
  const requestedUrls = [];
  const { runtime, localPageUrl, extensionUrl } = createRuntime({
    enhancedFaviconFetchEnabled: false,
    requestFaviconData(url) {
      requestedUrls.push(url);
      return Promise.resolve(null);
    }
  });
  const img = createFakeImage();
  let failed = false;

  runtime.attachResolvedFaviconWithFallbacks(
    img,
    localPageUrl,
    '127.0.0.1',
    extensionUrl,
    () => {
      failed = true;
    }
  );

  await wait(4);

  assert.strictEqual(failed, true, 'disabled enhanced favicon fetching should still fall back cleanly');
  assert.deepStrictEqual(
    requestedUrls,
    [extensionUrl, `https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=${encodeURIComponent(localPageUrl)}&size=128`],
    'disabled enhanced fetching may request the public service but must not probe website icon files'
  );
}

async function testOverlayDisabledFetchKeepsWebsiteImagesOutOfPage() {
  const requestedUrls = [];
  const {
    runtime,
    vpnPageUrl,
    vpnDirectFaviconUrl,
    vpnExtensionUrl,
    vpnGstaticUrl,
    preloadedUrls,
    attachedDataUrls
  } = createRuntime({
    enhancedFaviconFetchEnabled: false,
    requestFaviconData(url) {
      requestedUrls.push(url);
      return Promise.resolve(null);
    }
  });
  const img = createFakeImage();

  runtime.attachFaviconData(img, vpnDirectFaviconUrl, 'foo.example.com');
  runtime.preloadIcon(vpnDirectFaviconUrl);
  runtime.preloadIcon(vpnGstaticUrl);
  runtime.preloadIcon(vpnExtensionUrl);
  runtime.attachResolvedFaviconWithFallbacks(
    img,
    vpnPageUrl,
    'foo.example.com',
    vpnDirectFaviconUrl
  );

  await wait(0);

  assert.deepStrictEqual(attachedDataUrls, [], 'strict mode should not request direct favicon data for a VPN hostname');
  assert.deepStrictEqual(preloadedUrls, [], 'the page should not preload any favicon URL itself');
  assert.deepStrictEqual(Array.from(new Set(requestedUrls)), [vpnGstaticUrl, vpnExtensionUrl],
    'only the approved public service and the browser cache may be fetched, in the background');
  assert.strictEqual(img.src.includes('_favicon'), false, 'the page must never load the _favicon endpoint');
  assert.strictEqual(img.src.includes('foo.example.com/favicon.ico'), false, 'strict mode should not assign the direct favicon');
  assert.strictEqual(img.src.includes('gstatic'), false, 'strict mode should not assign a third-party proxy favicon');
}

async function testOverlayFailsClosedBeforePolicyStateLoads() {
  const {
    runtime,
    vpnPageUrl,
    vpnDirectFaviconUrl,
    vpnExtensionUrl
  } = createRuntime({ enhancedFaviconFetchEnabled: undefined });
  const img = createFakeImage();

  runtime.attachResolvedFaviconWithFallbacks(
    img,
    vpnPageUrl,
    'foo.example.com',
    vpnDirectFaviconUrl
  );

  await wait(0);

  assert.strictEqual(renderedSource(img), vpnExtensionUrl, 'unloaded favicon policy should be treated as strict mode');
}

async function testOverlayExcludedPathUsesStrictCandidatesWhileEnhancedIsOn() {
  const requestedUrls = [];
  const {
    runtime,
    vpnPageUrl,
    vpnDirectFaviconUrl,
    vpnExtensionUrl,
    vpnGstaticUrl,
    preloadedUrls,
    attachedDataUrls,
    warmedIconLists
  } = createRuntime({
    enhancedFaviconFetchEnabled: true,
    excludedPageUrl: 'https://foo.example.com/',
    requestFaviconData(url) {
      requestedUrls.push(url);
      return answerBrowserCacheRequests(url);
    }
  });
  const img = createFakeImage();

  runtime.preloadIcon(vpnDirectFaviconUrl, vpnPageUrl);
  runtime.preloadIcon(vpnGstaticUrl, vpnPageUrl);
  runtime.preloadIcon(vpnExtensionUrl, vpnPageUrl);
  runtime.attachFaviconData({}, vpnDirectFaviconUrl, 'foo.example.com', vpnPageUrl);
  runtime.warmIconCache([{ url: vpnPageUrl, favicon: vpnDirectFaviconUrl }]);
  runtime.attachResolvedFaviconWithFallbacks(
    img,
    vpnPageUrl,
    'foo.example.com',
    vpnDirectFaviconUrl
  );

  await wait(0);

  assert.deepStrictEqual(preloadedUrls, [], 'the page should not preload any favicon URL itself');
  assert.deepStrictEqual(attachedDataUrls, [], 'excluded overlay paths should not request direct favicon data');
  assert.strictEqual(warmedIconLists[0][0].favicon, '',
    'the shared warmer should not receive the browser-cache URL, which the page cannot load');
  assert.deepStrictEqual(Array.from(new Set(requestedUrls)), [vpnExtensionUrl],
    'excluded overlay paths should fetch only the browser cache, never direct, proxy, or root candidates');
  assert.strictEqual(renderedSource(img), vpnExtensionUrl, 'excluded paths should keep only local and browser-cache candidates');
  assert.ok(img.src.startsWith('data:image/'));

  const staleImg = createFakeImage();
  staleImg.src = vpnDirectFaviconUrl;
  staleImg.setAttribute('data-favicon-current-src', vpnDirectFaviconUrl);
  runtime.attachResolvedFaviconWithFallbacks(staleImg, vpnPageUrl, 'foo.example.com', vpnDirectFaviconUrl);
  staleImg._xOverlayThemeFaviconErrorHandler();
  await wait(0);
  assert.notStrictEqual(
    staleImg.src,
    vpnDirectFaviconUrl,
    'excluded overlay paths should not restore a previously working direct favicon after strict candidates fail'
  );

  const publicImg = createFakeImage();
  const publicRuntime = createRuntime({ enhancedFaviconFetchEnabled: true });
  publicRuntime.runtime.attachResolvedFaviconWithFallbacks(
    publicImg,
    publicRuntime.vpnPageUrl,
    'foo.example.com',
    publicRuntime.vpnDirectFaviconUrl
  );
  await wait(0);
  assert.strictEqual(renderedSource(publicImg), publicRuntime.vpnExtensionUrl, 'enhanced-on paths must also prefer browser cache');
}

async function testOverlayUnifiedPathRuleMatrix() {
  const privatePageUrl = 'https://foo.example.com/private';
  const publicPageUrl = 'https://foo.example.com/public';
  const directUrl = 'https://foo.example.com/favicon.ico';
  const privateExtensionUrl = `chrome-extension://abc/_favicon/?pageUrl=${encodeURIComponent(privatePageUrl)}&size=128&fallbackToHost=0`;
  const publicExtensionUrl = `chrome-extension://abc/_favicon/?pageUrl=${encodeURIComponent(publicPageUrl)}&size=128&fallbackToHost=0`;
  const privateGstaticUrl = `https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=${encodeURIComponent(privatePageUrl)}&size=128`;
  const publicGstaticUrl = `https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=${encodeURIComponent(publicPageUrl)}&size=128`;
  const requestedUrls = [];
  const {
    runtime,
    preloadedUrls,
    attachedDataUrls,
    attachedDataRequestPages,
    warmedIconLists
  } = createRuntime({
    enhancedFaviconFetchEnabled: true,
    excludedPageUrl: privatePageUrl,
    requestFaviconData(url, pageUrl) {
      requestedUrls.push({ url, pageUrl: pageUrl || '' });
      return answerBrowserCacheRequests(url);
    }
  });

  const privateImg = createFakeImage();
  runtime.attachResolvedFaviconWithFallbacks(privateImg, privatePageUrl, 'foo.example.com', directUrl);
  await wait(0);
  assert.strictEqual(renderedSource(privateImg), privateExtensionUrl, 'excluded overlay matrix path should render only Lumno browser cache');
  privateImg._xOverlayThemeFaviconErrorHandler();
  assert.notStrictEqual(privateImg.src, privateGstaticUrl, 'excluded overlay matrix path should not fall through to gstatic');
  runtime.preloadIcon(directUrl, privatePageUrl);
  runtime.preloadIcon(privateGstaticUrl, privatePageUrl);
  runtime.preloadIcon(privateExtensionUrl, privatePageUrl);
  runtime.attachFaviconData(createFakeImage(), directUrl, 'foo.example.com', privatePageUrl);
  runtime.warmIconCache([{ url: privatePageUrl, favicon: directUrl }]);
  await wait(0);
  assert.deepStrictEqual(preloadedUrls, [], 'the page should not preload any favicon URL itself');
  assert.deepStrictEqual(attachedDataUrls, [], 'excluded overlay matrix path should not attach direct favicon data');
  assert.deepStrictEqual(Array.from(new Set(requestedUrls.map((entry) => entry.url))), [privateExtensionUrl],
    'excluded overlay matrix path should request only browser-cache data, never page, root, manifest, direct, or proxy data');
  assert.strictEqual(warmedIconLists[0][0].favicon, '', 'excluded matrix paths should warm browser cache in the background');

  const publicImg = createFakeImage();
  runtime.attachResolvedFaviconWithFallbacks(publicImg, publicPageUrl, 'foo.example.com', directUrl);
  await wait(0);
  assert.strictEqual(renderedSource(publicImg), publicExtensionUrl, 'enhanced-on paths should prefer browser cache');
  runtime.preloadIcon(directUrl, publicPageUrl);
  runtime.preloadIcon(publicGstaticUrl, publicPageUrl);
  runtime.attachFaviconData(createFakeImage(), directUrl, 'foo.example.com', publicPageUrl);
  runtime.warmIconCache([{ url: publicPageUrl, favicon: directUrl }]);
  await wait(0);
  assert.strictEqual(preloadedUrls.includes(directUrl), false, 'automatic sources must not preload website icons');
  assert.strictEqual(requestedUrls.some((entry) => entry.url === publicGstaticUrl), false, 'preloading should prefer browser cache');
  assert.deepStrictEqual(attachedDataUrls, [], 'automatic website icons must not reach the data loader');
  assert.deepStrictEqual(attachedDataRequestPages, [], 'blocked website icons must not reach background data requests');
  assert.ok(requestedUrls.some((entry) => entry.url === publicExtensionUrl && entry.pageUrl === publicPageUrl),
    'enhanced-on paths should warm browser cache');
}

async function testOverlayStrictModeReusesCachedFaviconData() {
  const faviconDataCache = new Map();
  const cachedDataUrl = 'data:image/png;base64,Y2FjaGVk';
  const {
    runtime,
    vpnPageUrl,
    vpnDirectFaviconUrl
  } = createRuntime({
    enhancedFaviconFetchEnabled: false,
    faviconDataCache
  });
  faviconDataCache.set(vpnDirectFaviconUrl, cachedDataUrl);
  const img = createFakeImage();

  runtime.attachResolvedFaviconWithFallbacks(
    img,
    vpnPageUrl,
    'foo.example.com',
    vpnDirectFaviconUrl
  );

  await wait(0);

  assert.strictEqual(img.src, cachedDataUrl, 'strict mode should prefer cached data without reusing its direct URL');
}

async function testOverlayPolicyEnableRecoversReplacedStrictFallback() {
  let replacementVisible = false;
  let rerenderCount = 0;
  let currentImg = createFakeImage();
  let runtime = null;
  let created = null;
  const suggestionRowsRoot = {
    contains(img) {
      return img === currentImg;
    },
    querySelectorAll() {
      return replacementVisible ? [failedSlot] : [];
    }
  };
  const requestedUrls = [];
  let browserCacheAvailable = false;
  const runtimeOptions = {
    enhancedFaviconFetchEnabled: false,
    requestFaviconData(url) {
      requestedUrls.push(url);
      return browserCacheAvailable ? answerBrowserCacheRequests(url) : Promise.resolve(null);
    },
    getOverlayPanel() {
      return {
        querySelectorAll() {
          return currentImg && currentImg.isConnected ? [currentImg] : [];
        }
      };
    },
    getSuggestionRowsRoot() {
      return suggestionRowsRoot;
    }
  };
  const replaceFailedImage = () => {
    replacementVisible = true;
    currentImg.isConnected = false;
  };
  const failedSlot = {
    dispatchEvent(event) {
      assert.strictEqual(event.type, 'lumno-favicon-retry');
      replacementVisible = false;
      rerenderCount += 1;
      currentImg = createFakeImage();
      runtime.attachResolvedFaviconWithFallbacks(
        currentImg,
        created.vpnPageUrl,
        'foo.example.com',
        created.vpnDirectFaviconUrl,
        replaceFailedImage
      );
    }
  };
  created = createRuntime(runtimeOptions);
  runtime = created.runtime;

  runtime.attachResolvedFaviconWithFallbacks(
    currentImg,
    created.vpnPageUrl,
    'foo.example.com',
    created.vpnDirectFaviconUrl,
    replaceFailedImage
  );
  assert.strictEqual(requestedUrls[0], created.vpnExtensionUrl, 'strict mode should initially try only the virtual favicon');
  assert.notStrictEqual(
    currentImg.src,
    created.vpnDirectFaviconUrl,
    'strict mode should not make the direct favicon retryable before the policy is enabled'
  );

  await wait(0);
  await wait(0);
  assert.strictEqual(replacementVisible, true, 'virtual favicon failure should replace the strict-mode image');

  browserCacheAvailable = true;
  runtimeOptions.enhancedFaviconFetchEnabled = true;
  runtime.refreshOverlayFaviconsForPolicyChange();
  await wait(0);

  assert.strictEqual(rerenderCount, 1, 'enabling enhanced fetching should rerender the replaced row once');
  assert.strictEqual(replacementVisible, false, 'the replacement should be consumed by the recovery rerender');
  assert.strictEqual(
    renderedSource(currentImg),
    created.vpnExtensionUrl,
    'enabling enhanced fetching should keep browser cache as the first candidate'
  );

  runtimeOptions.enhancedFaviconFetchEnabled = false;
  runtime.refreshOverlayFaviconsForPolicyChange();
  await wait(0);

  assert.strictEqual(rerenderCount, 1, 'disabling should refresh a surviving row without an unnecessary rerender');
  assert.strictEqual(renderedSource(currentImg), created.vpnExtensionUrl, 'disabling should restore the strict virtual favicon source');
  assert.strictEqual(currentImg.src.includes('favicon.ico'), false, 'disabling should not retain the direct target candidate');
  assert.strictEqual(currentImg.src.includes('gstatic'), false, 'disabling should not introduce a third-party fallback');
}

async function testOverlayOpenTabPolicyRecoveryIsSafeInBothDirections() {
  let replacementVisible = false;
  let rerenderCount = 0;
  let currentImg = createFakeImage();
  let runtime = null;
  let created = null;
  const suggestionRowsRoot = {
    contains(img) {
      return img === currentImg;
    },
    querySelectorAll() {
      return replacementVisible ? [failedSlot] : [];
    }
  };
  const requestedUrls = [];
  let browserCacheAvailable = false;
  const runtimeOptions = {
    enhancedFaviconFetchEnabled: false,
    requestFaviconData(url) {
      requestedUrls.push(url);
      return browserCacheAvailable ? answerBrowserCacheRequests(url) : Promise.resolve(null);
    },
    getOverlayPanel() {
      return {
        querySelectorAll() {
          return currentImg && currentImg.isConnected ? [currentImg] : [];
        }
      };
    },
    getSuggestionRowsRoot() {
      return suggestionRowsRoot;
    }
  };
  const replaceFailedImage = () => {
    replacementVisible = true;
    currentImg.isConnected = false;
  };
  const failedSlot = {
    dispatchEvent(event) {
      assert.strictEqual(event.type, 'lumno-favicon-retry');
      replacementVisible = false;
      rerenderCount += 1;
      currentImg = createFakeImage();
      runtime.attachResolvedFaviconWithFallbacks(
        currentImg,
        created.vpnPageUrl,
        'foo.example.com',
        created.vpnDirectFaviconUrl,
        replaceFailedImage
      );
    }
  };
  created = createRuntime(runtimeOptions);
  runtime = created.runtime;

  runtime.attachResolvedFaviconWithFallbacks(
    currentImg,
    created.vpnPageUrl,
    'foo.example.com',
    created.vpnDirectFaviconUrl,
    replaceFailedImage
  );
  assert.strictEqual(requestedUrls[0], created.vpnExtensionUrl, 'strict open-tab rows should start with the virtual favicon');

  await wait(0);
  await wait(0);
  assert.strictEqual(replacementVisible, true, 'failed strict open-tab favicons should expose a recoverable fallback');

  browserCacheAvailable = true;
  runtimeOptions.enhancedFaviconFetchEnabled = true;
  runtime.refreshOverlayFaviconsForPolicyChange();
  await wait(0);

  assert.strictEqual(rerenderCount, 1, 'enabling should rebuild a replaced open-tab row once');
  assert.strictEqual(renderedSource(currentImg), created.vpnExtensionUrl, 'enabled open-tab rows should retry browser cache');

  runtimeOptions.enhancedFaviconFetchEnabled = false;
  runtime.refreshOverlayFaviconsForPolicyChange();
  await wait(0);

  assert.strictEqual(rerenderCount, 1, 'disabling should refresh the surviving open-tab image without rebuilding it');
  assert.strictEqual(renderedSource(currentImg), created.vpnExtensionUrl, 'disabling should restore the open-tab virtual favicon');
  assert.strictEqual(currentImg.src.includes('favicon.ico'), false, 'strict open-tab rows should not retain a direct candidate');
  assert.strictEqual(currentImg.src.includes('gstatic'), false, 'strict open-tab rows should not introduce a third-party proxy');
}

async function testOverlayUsesChromeFavicon2ForBrowserInternalPages() {
  const requestedUrls = [];
  const {
    runtime,
    browserPageUrl,
    browserPageFavicon2Url
  } = createRuntime({
    requestFaviconData(url) {
      requestedUrls.push(url);
      return Promise.resolve(null);
    },
    shouldBlockOverlayFaviconForHost(hostname) {
      const host = String(hostname || '').toLowerCase();
      return host === '127.0.0.1' || host === 'localhost' || host === 'extensions';
    }
  });
  const img = createFakeImage();
  let failed = false;

  runtime.attachResolvedFaviconWithFallbacks(
    img,
    browserPageUrl,
    'extensions',
    browserPageFavicon2Url,
    () => {
      failed = true;
    }
  );

  await wait(0);

  assert.strictEqual(failed, false, 'browser internal pages should not use the local-network fallback path');
  assert.strictEqual(
    img.src,
    browserPageFavicon2Url,
    'browser internal pages should render chrome://favicon2 directly'
  );
  assert.deepStrictEqual(
    requestedUrls,
    [],
    'browser internal favicon2 should not be converted into a background data request first'
  );
}

async function testOverlayUsesExtensionFaviconProxyForBrowserInternalPagesWithoutExplicitIcon() {
  const {
    runtime,
    browserPageUrl,
    browserPageExtensionUrl
  } = createRuntime({
    shouldBlockOverlayFaviconForHost(hostname) {
      const host = String(hostname || '').toLowerCase();
      return host === '127.0.0.1' || host === 'localhost' || host === 'extensions';
    }
  });
  const img = createFakeImage();
  let failed = false;

  runtime.attachResolvedFaviconWithFallbacks(
    img,
    browserPageUrl,
    'extensions',
    '',
    () => {
      failed = true;
    }
  );

  await wait(0);

  assert.strictEqual(failed, false, 'browser internal pages should not fall back when no explicit icon was supplied');
  assert.strictEqual(
    renderedSource(img),
    browserPageExtensionUrl,
    'browser internal pages should use the extension _favicon proxy before chrome://favicon2'
  );
}

async function // How the overlay wires this runtime into its rows is covered by
// test-overlay-favicon-policy.js.
testOverlayRejectsRootFaviconForNestedPage() {
  const img = createFakeImage();
  const pageUrl = 'https://chrome.google.com/webstore/devconsole?hl=zh-CN';
  const rootSource = 'chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fchrome.google.com%2F&size=128&fallbackToHost=0';
  const { runtime } = createRuntime({
    faviconDataCache: new Map([[rootSource, 'data:image/png;base64,d3Jvbmdyb290']])
  });
  runtime.attachResolvedFaviconWithFallbacks(img, pageUrl, 'chrome.google.com', rootSource);
  await wait(0);
  assert.ok(img.src.startsWith('data:image/'), 'the page renders background image bytes, never a _favicon URL');
  assert.strictEqual(new URL(renderedSource(img)).searchParams.get('pageUrl'), pageUrl,
    'overlay search and tab rendering must skip a root-page favicon for a nested URL');
  assert.strictEqual(new URL(renderedSource(img)).searchParams.get('fallbackToHost'), '0');
}

async function testOverlayDoesNotRestoreAnotherPagesImageData() {
  const pageUrl = 'https://chrome.google.com/webstore/devconsole?hl=zh-CN';
  const previousPageData = 'data:image/png;base64,cHJldmlvdXNwYWdl';
  for (const previousPageUrl of ['https://chrome.google.com/', '', pageUrl]) {
    const img = createFakeImage();
    img.src = previousPageData;
    img.setAttribute('data-favicon-current-src', previousPageData);
    if (previousPageUrl) {
      img.setAttribute('data-x-ov-favicon-page-url', previousPageUrl);
    }
    const { runtime } = createRuntime({
      enhancedFaviconFetchEnabled: false,
      requestFaviconData: () => Promise.resolve(null)
    });
    let failed = false;
    runtime.attachResolvedFaviconWithFallbacks(img, pageUrl, 'chrome.google.com', '', () => {
      failed = true;
    });
    // Candidates load as background bytes; until one does the old image is
    // only remembered, so a restore has to put it back explicitly.
    img.src = '';
    await wait(0);
    await wait(0);
    assert.strictEqual(img.src === previousPageData, previousPageUrl === pageUrl,
      'overlay acquisition may restore image data only for the same previous document');
    assert.strictEqual(failed, previousPageUrl !== pageUrl);
  }
}

async function testOverlayServicesRenderOnlyBackgroundImageData() {
  const dataUrl = 'data:image/png;base64,c2VydmljZQ==';
  for (const enhancedFaviconFetchEnabled of [true, false]) {
    const requested = [];
    const { runtime, vpnPageUrl, vpnExtensionUrl, vpnGstaticUrl, preloadedUrls, warmedIconLists } = createRuntime({
      enhancedFaviconFetchEnabled,
      requestFaviconData(url, pageUrl) {
        requested.push({ url, pageUrl });
        // The browser has no icon for the page (the background reports its
        // default globe as no data), so the service is asked next.
        return Promise.resolve(url === vpnGstaticUrl ? dataUrl : null);
      }
    });
    const img = createFakeImage();
    runtime.attachResolvedFaviconWithFallbacks(img, vpnPageUrl, 'foo.example.com', '');
    assert.notStrictEqual(img.src, vpnExtensionUrl, 'the page must never load the _favicon endpoint');
    assert.notStrictEqual(img.src, vpnGstaticUrl, 'the page must never load the remote service URL');
    await wait(0);
    await wait(0);
    assert.strictEqual(img.src, dataUrl, 'service artwork must arrive as local image bytes');
    assert.strictEqual(img.getAttribute('data-favicon-data-source'), vpnGstaticUrl);
    assert.deepStrictEqual(requested, [
      { url: vpnExtensionUrl, pageUrl: vpnPageUrl },
      { url: vpnGstaticUrl, pageUrl: vpnPageUrl }
    ], 'Chrome cache must precede the service, both through the background');

    runtime.preloadIcon(vpnGstaticUrl);
    runtime.warmIconCache([{ favicon: vpnGstaticUrl }]);
    await wait(0);
    assert.strictEqual(preloadedUrls.includes(vpnGstaticUrl), false,
      'service preloading must not create a remote image in the page');
    assert.strictEqual(warmedIconLists[0][0].favicon, '',
      'the shared warmer must not receive a remote service image URL');
  }

  for (const enhancedFaviconFetchEnabled of [true, false]) {
    const requested = [];
    const { runtime, vpnPageUrl, vpnGstaticUrl } = createRuntime({
      enhancedFaviconFetchEnabled,
      excludedPageUrl: 'https://foo.example.com/',
      requestFaviconData(url) { requested.push(url); return Promise.resolve(dataUrl); }
    });
    const img = createFakeImage();
    runtime.attachResolvedFaviconWithFallbacks(img, vpnPageUrl, 'foo.example.com', '');
    img.dispatchEvent('error');
    runtime.preloadIcon(vpnGstaticUrl, vpnPageUrl);
    await wait(0);
    assert.deepStrictEqual(requested.filter((url) => url.includes('gstatic')), [],
      'exclusions must block service fetching regardless of the global switch');
  }
}

async function testOverlayServiceTimeoutAndStaleResponses() {
  for (const replaceSession of [false, true]) {
    const pendingRequests = new Map();
    let failed = false;
    const { runtime, vpnPageUrl, vpnExtensionUrl, vpnGstaticUrl } = createRuntime({
      enhancedFaviconFetchEnabled: false,
      faviconCandidateLoadTimeoutMs: 10,
      requestFaviconData(url) { return new Promise((resolve) => { pendingRequests.set(url, resolve); }); }
    });
    const img = createFakeImage();
    runtime.attachResolvedFaviconWithFallbacks(img, vpnPageUrl, 'foo.example.com', '', () => { failed = true; });
    img.dispatchEvent('error');
    assert.strictEqual(typeof pendingRequests.get(vpnGstaticUrl), 'function');
    if (replaceSession) {
      runtime.attachResolvedFaviconWithFallbacks(img, 'https://other.example.com/page', 'other.example.com', '');
    } else {
      await wait(20);
      assert.strictEqual(failed, true, 'an unresponsive service must release the row to its fallback');
    }
    const currentSource = img.src;
    pendingRequests.get(vpnExtensionUrl)('data:image/png;base64,c3RhbGVjYWNoZQ==');
    pendingRequests.get(vpnGstaticUrl)('data:image/png;base64,c3RhbGU=');
    await wait(0);
    assert.strictEqual(img.src, currentSource, 'late service bytes must not replace a newer page or a timed-out fallback');
  }
}

testOverlayRejectsRootFaviconForNestedPage()
  .then(testOverlayServicesRenderOnlyBackgroundImageData)
  .then(testOverlayServiceTimeoutAndStaleResponses)
  .then(testOverlayDoesNotRestoreAnotherPagesImageData)
  .then(testOverlayResolvesLocalFaviconThroughDataUrl)
  .then(testOverlayFallsBackWhenLocalFaviconDataUnavailable)
  .then(testOverlaySkipsRootIconProbeWhenEnhancedFetchDisabled)
  .then(testOverlayDisabledFetchKeepsWebsiteImagesOutOfPage)
  .then(testOverlayFailsClosedBeforePolicyStateLoads)
  .then(testOverlayExcludedPathUsesStrictCandidatesWhileEnhancedIsOn)
  .then(testOverlayUnifiedPathRuleMatrix)
  .then(testOverlayStrictModeReusesCachedFaviconData)
  .then(testOverlayPolicyEnableRecoversReplacedStrictFallback)
  .then(testOverlayOpenTabPolicyRecoveryIsSafeInBothDirections)
  .then(testOverlayUsesChromeFavicon2ForBrowserInternalPages)
  .then(testOverlayUsesExtensionFaviconProxyForBrowserInternalPagesWithoutExplicitIcon)
  .then(() => {
    console.log('overlay favicon view tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
