const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function createFakeImage() {
  const attributes = new Map();
  const listeners = new Map();
  let currentSrc = '';
  const img = {
    complete: false,
    naturalWidth: 0,
    naturalHeight: 0,
    isConnected: true,
    style: {
      setProperty() {},
      removeProperty() {}
    },
    set src(value) {
      currentSrc = String(value || '');
      this.complete = true;
      this.naturalWidth = 16;
      this.naturalHeight = 16;
      const handlers = Array.from(listeners.get('load') || []);
      handlers.forEach((entry) => {
        entry.listener.call(this);
        if (entry.once) {
          listeners.get('load').delete(entry);
        }
      });
    },
    get src() {
      return currentSrc;
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      if (name === 'src') {
        return currentSrc;
      }
      return attributes.has(name) ? attributes.get(name) : null;
    },
    removeAttribute(name) {
      if (name === 'src') {
        currentSrc = '';
        return;
      }
      attributes.delete(name);
    },
    addEventListener(type, listener, options) {
      if (!listeners.has(type)) {
        listeners.set(type, new Set());
      }
      listeners.get(type).add({
        listener,
        once: Boolean(options && options.once)
      });
    },
    removeEventListener(type, listener) {
      const set = listeners.get(type);
      if (!set) {
        return;
      }
      Array.from(set).forEach((entry) => {
        if (entry.listener === listener) {
          set.delete(entry);
        }
      });
    }
  };
  return img;
}

const pendingCallbacks = new Map();
const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  URL,
  Image: function Image() {
    return createFakeImage();
  }
};
sandbox.globalThis = sandbox;

vm.runInNewContext(fs.readFileSync('src/shared/favicon-utils.js', 'utf8'), sandbox, {
  filename: 'src/shared/favicon-utils.js'
});
vm.runInNewContext(fs.readFileSync('src/shared/favicon-view-core.js', 'utf8'), sandbox, {
  filename: 'src/shared/favicon-view-core.js'
});

const core = sandbox.LumnoFaviconViewCore.createFaviconViewCore({
  windowObj: sandbox,
  chromeApi: {
    runtime: {
      sendMessage(message, callback) {
        if (message && message.action === 'getFaviconData') {
          pendingCallbacks.set(message.url, callback);
        }
      }
    }
  },
  showResolvedFavicon() {},
  showPendingFallbackIcon() {},
  getPersistCacheKey() {
    return 'light::futurecomm.cn';
  },
  setPersistedFaviconUrl() {},
  setPersistedFaviconData() {}
});

(async () => {
  const img = createFakeImage();
  const proxyUrl = 'chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fm2.futurecomm.cn%2F&size=128';
  const realUrl = 'https://m2.futurecomm.cn/favicon.ico';
  const proxyDataUrl = 'data:image/png;base64,ZmFrZS1wcm94eS1mYWxsYmFjaw==';

  img.loading = 'lazy';
  img.setAttribute('loading', 'lazy');
  assert.strictEqual(core.setFaviconSrcWithAnimation(img, proxyUrl), true);
  assert.strictEqual(
    img.loading,
    'eager',
    'placeholder favicons must opt out of lazy loading so hidden images still start loading'
  );
  assert.strictEqual(img.getAttribute('loading'), 'eager');
  assert.strictEqual(img.getAttribute('width'), '128');
  assert.strictEqual(img.getAttribute('height'), '128');
  core.attachFaviconData(img, proxyUrl, 'futurecomm.cn');
  assert.strictEqual(core.setFaviconSrcWithAnimation(img, realUrl), true);
  assert.strictEqual(img.src, realUrl);

  pendingCallbacks.get(proxyUrl)({ data: proxyDataUrl });
  await Promise.resolve();

  assert.strictEqual(
    img.src,
    realUrl,
    'stale favicon data responses must not replace the currently rendered favicon'
  );

  {
    // A failed live candidate (e.g. _favicon in Firefox) can stay the rendered
    // src after an interrupted reveal; restoring the remembered icon must swap
    // it back and end the blurred priming state.
    const stuck = createFakeImage();
    const workingData = 'data:image/png;base64,d29ya2luZy1pY29u';
    stuck.setAttribute('data-favicon-current-src', workingData);
    stuck.setAttribute('data-favicon-has-appeared', 'true');
    stuck.setAttribute('data-favicon-load-state', 'priming');
    stuck.src = 'moz-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fexample.com%2F';
    assert.strictEqual(core.restoreWorkingFaviconOrFallback(stuck, workingData), true);
    assert.strictEqual(stuck.src, workingData, 'the remembered working icon is rendered again');
    assert.strictEqual(stuck.getAttribute('data-favicon-load-state'), 'loaded', 'the blurred priming state ends');
  }

  console.log('favicon data race tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
