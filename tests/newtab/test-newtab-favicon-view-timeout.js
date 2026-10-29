const assert = require('assert');
const vm = require('vm');
const { moduleScript } = require('../helpers/module-script');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
    }
  };
}

const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  URL
};
sandbox.globalThis = sandbox;
sandbox.LumnoFaviconViewCore = {
  createFallbackIconPresenter: require('../../src/shared/favicon/favicon-view-core.ts').createFallbackIconPresenter,
  createFaviconViewCore() {
    return {
      createImage() {
        return createFakeImage();
      },
      setFallbackNodeVisible() {},
      setFaviconLoadState() {},
      applyFaviconOpticalShift() {},
      applyFaviconOpticalAlignment() {},
      requestFaviconData() {
        return Promise.resolve(null);
      },
      setFaviconSrcWithAnimation(img, nextSrc) {
        img._xFaviconLoadToken = (img._xFaviconLoadToken || 0) + 1;
        img.src = nextSrc;
        return true;
      },
      canReuseCurrentFavicon() {
        return false;
      },
      getLastWorkingFaviconSrc() {
        return '';
      },
      restoreWorkingFaviconOrFallback() {
        return false;
      },
      attachFaviconData() {},
      preloadIcon() {},
      warmIconCache() {},
      dedupeFaviconCandidateUrls(urls) {
        const seen = new Set();
        return (urls || []).filter((url) => {
          if (!url || seen.has(url)) {
            return false;
          }
          seen.add(url);
          return true;
        });
      }
    };
  }
};

vm.runInNewContext(moduleScript('tests/helpers/favicon-utils.ts', 'LumnoFaviconUtils', null, { 'src/shared/favicon/favicon-view-core.ts': 'LumnoFaviconViewCore' }), sandbox, {
  filename: 'tests/helpers/favicon-utils.ts'
});

vm.runInNewContext(moduleScript('src/newtab/dom/favicon-view.ts', 'LumnoNewtabFaviconView', null, { 'src/shared/favicon/favicon-view-core.ts': 'LumnoFaviconViewCore' }), sandbox, {
  filename: 'src/newtab/dom/favicon-view.ts'
});

const runtime = sandbox.LumnoNewtabFaviconView.createFaviconViewRuntime({
  document: {
    querySelectorAll() {
      return [];
    }
  },
  windowObj: {
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
  getExtensionFaviconUrl(pageUrl) {
    return `chrome-extension://abc/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=128`;
  },
  getGstaticFaviconUrl(pageUrl) {
    return `https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=${encodeURIComponent(pageUrl)}&size=128`;
  },
  getChromeFaviconUrl(pageUrl) {
    return `chrome://favicon2/?pageUrl=${encodeURIComponent(pageUrl)}&size=128`;
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
  isBlockedLocalFaviconUrl() {
    return false;
  },
  isChromeMonogramFaviconUrl() {
    return false;
  },
  preloadThemeFromFavicon() {},
  faviconCandidateLoadTimeoutMs: 12
});

(async () => {
  const img = createFakeImage();
  runtime.attachFaviconWithFallbacks(img, 'https://example.test/page', 'example.test');
  assert.strictEqual(img.src, 'chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fexample.test%2Fpage&size=128&fallbackToHost=0');
  const browserImg = createFakeImage();
  runtime.attachFaviconWithFallbacks(browserImg, 'chrome://newtab/', 'newtab');
  assert.strictEqual(browserImg.src, 'chrome://favicon2/?pageUrl=chrome%3A%2F%2Fnewtab%2F&size=128');
  browserImg._xThemeFaviconSession += 1;
  await wait(18);
  assert.strictEqual(img.src, 'https://t2.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE%2CSIZE%2CURL&url=https%3A%2F%2Fexample.test%2Fpage&size=128');
  img._xThemeFaviconSession += 1;
  await wait(20);
  console.log('newtab favicon view timeout ok');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
