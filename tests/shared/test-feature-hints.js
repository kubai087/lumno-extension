const assert = require('assert');
const fs = require('fs');
const path = require('path');

const featureHintsCss = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src/shared/ui/feature-hints.css'),
  'utf8'
);

assert.match(
  featureHintsCss,
  /--x-lumno-feature-hint-arrow-border:\s*#d8dde4;/,
  'feature hints should define an opaque arrow border color for the light surface'
);
assert.strictEqual(
  (featureHintsCss.match(/solid var\(--x-lumno-feature-hint-arrow-border\)/g) || []).length,
  4,
  'every arrow side should use the shared arrow border color'
);
assert.match(
  featureHintsCss,
  /\.x-lumno-feature-hint__arrow-tip\s*\{[^}]*background:\s*var\(--x-lumno-feature-hint-arrow-border\);/s,
  'the rounded arrow tip should use the same shared border color as the triangle'
);
assert.strictEqual(
  (featureHintsCss.match(/--x-lumno-feature-hint-arrow-border:\s*#3a4150;/g) || []).length,
  2,
  'both dark feature-hint theme entry points should use the opaque composited arrow border color'
);
assert.doesNotMatch(
  featureHintsCss,
  /x-lumno-feature-hint--newtab-webdav-sync[^{}]*\{[^}]*--x-lumno-feature-hint-arrow-border:/s,
  'the dark arrow fix should stay at the shared component level'
);

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.attributes = {};
    this.listeners = {};
    this.blurred = false;
    this.inert = false;
    this.id = '';
    this.className = '';
    this.type = '';
    this.innerHTML = '';
    this.textContent = '';
  }

  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
    return child;
  }

  addEventListener(type, listener) {
    this.listeners[type] = listener;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return this.attributes[name];
  }

  getBoundingClientRect() {
    return { width: 0, height: 0 };
  }

  contains(target) {
    if (target === this) {
      return true;
    }
    return this.children.some((child) => child && typeof child.contains === 'function' && child.contains(target));
  }

  blur() {
    this.blurred = true;
  }
}

function createFakeDocument() {
  const fakeDocument = {
    activeElement: null,
    defaultView: null,
    createElement(tagName) {
      const element = new FakeElement(tagName);
      element.ownerDocument = fakeDocument;
      return element;
    }
  };
  return fakeDocument;
}

const featureHintView = {
  implementation: 'react-test-double',
  createFeatureHintView(options) {
    const documentObj = options.documentObj;
    const model = options.model;
    const element = documentObj.createElement('span');
    element.id = model.elementId;
    element.className = ['x-lumno-feature-hint', model.className || '']
      .filter(Boolean)
      .join(' ');
    element.setAttribute('data-react-island', 'feature-hint');
    element.setAttribute('data-rounded-arrow-tip', model.roundedArrowTip ? 'true' : 'false');
    element.setAttribute('data-visible', 'false');
    element.setAttribute('data-dismissed', 'false');
    element.setAttribute('aria-hidden', 'true');
    let arrowTip = null;
    if (model.roundedArrowTip) {
      arrowTip = documentObj.createElement('span');
      arrowTip.className = 'x-lumno-feature-hint__arrow-tip';
      arrowTip.setAttribute('aria-hidden', 'true');
      element.appendChild(arrowTip);
    }
    const badge = documentObj.createElement('span');
    badge.className = 'x-lumno-feature-hint__badge';
    element.appendChild(badge);
    const text = documentObj.createElement('span');
    text.id = model.textId;
    text.className = 'x-lumno-feature-hint__text';
    element.appendChild(text);
    let linkButton = null;
    if (model.hasLink) {
      linkButton = documentObj.createElement('button');
      linkButton.className = 'x-lumno-feature-hint__link';
      element.appendChild(linkButton);
    }
    const closeButton = documentObj.createElement('button');
    closeButton.className = 'x-lumno-feature-hint__close';
    element.appendChild(closeButton);
    // Shows the copy the hint sets in its store.
    const applyLabels = ({ labels }) => {
        badge.setAttribute('aria-label', labels.badge);
        text.textContent = labels.text;
        closeButton.setAttribute('aria-label', labels.close);
        if (linkButton) {
          linkButton.setAttribute('aria-label', labels.link || '');
        }
    };
    applyLabels(options.labels.getSnapshot());
    options.labels.subscribe(() => applyLabels(options.labels.getSnapshot()));
    return {
      arrowTip,
      badge,
      closeButton,
      destroy() {},
      element,
      linkButton,
      text
    };
  }
};

// The module under test draws through this stand-in for its React view.
global.__lumnoTestModuleStubs = Object.assign(global.__lumnoTestModuleStubs || {}, {
  'src/shared/react/feature-hint-view.tsx': { createFeatureHintView: (options) => featureHintView.createFeatureHintView(options) }
});
require('../../src/domain/shortcut-display.ts');
const featureHints = require('../helpers/feature-hints.ts');

function createStorageArea(store) {
  return {
    get(keys, callback) {
      const result = {};
      keys.forEach((key) => {
        result[key] = store[key];
      });
      callback(result);
    },
    set(values, callback) {
      Object.assign(store, values);
      if (typeof callback === 'function') {
        callback();
      }
    }
  };
}

function createStorageBackedChrome(localStore, syncStore) {
  const local = createStorageArea(localStore);
  const sync = createStorageArea(syncStore);
  return {
    runtime: { lastError: null },
    storage: { local, sync }
  };
}

function flushMicrotasks() {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

(async () => {
  assert.strictEqual(
    featureHints.normalizeDismissStorage('local'),
    'local',
    'local dismiss storage should be supported'
  );
  assert.strictEqual(
    featureHints.normalizeDismissStorage('sync'),
    'sync',
    'sync dismiss storage should be supported'
  );

  const localStore = {};
  const syncStore = {};
  const chromeApi = createStorageBackedChrome(localStore, syncStore);
  let resizeObserverDisconnects = 0;
  const fakeWindow = {
    ResizeObserver: class FakeResizeObserver {
      observe() {}
      disconnect() {
        resizeObserverDisconnects += 1;
      }
    }
  };
  const localKey = featureHints.getFeatureHintLocalDismissKey('newtab-ai-quick-jump');
  const sessionKey = featureHints.getFeatureHintSessionDismissKey('newtab-ai-quick-jump');
  const syncKey = featureHints.getFeatureHintSyncDismissKey('newtab-ai-quick-jump');
  assert.notStrictEqual(localKey, sessionKey, 'local and session dismiss keys should not collide');
  assert.notStrictEqual(syncKey, localKey, 'sync and local dismiss keys should not collide');
  assert.notStrictEqual(syncKey, sessionKey, 'sync and session dismiss keys should not collide');

  const tabSwitcherHint = featureHints.getFeatureHint('newtab-tab-switcher');
  assert(tabSwitcherHint, 'newtab tab switcher feature hint should be registered');
  assert.strictEqual(
    tabSwitcherHint.introducedIn,
    '0.9.13',
    'newtab tab switcher feature hint should be keyed to the release version'
  );
  assert.strictEqual(
    tabSwitcherHint.placement,
    'newtab settings icon',
    'newtab tab switcher feature hint should anchor to the settings icon'
  );
  assert.strictEqual(
    tabSwitcherHint.className,
    'x-lumno-feature-hint--newtab-tab-switcher',
    'newtab tab switcher feature hint should expose a dedicated placement class'
  );
  assert.match(
    tabSwitcherHint.textFallback,
    /\{shortcut\}[\s\S]*tab switcher/i,
    'newtab tab switcher feature hint fallback should use a platform shortcut placeholder'
  );

  const webdavHint = featureHints.getFeatureHint('newtab-webdav-sync');
  assert(webdavHint, 'newtab WebDAV feature hint should be registered');
  assert.strictEqual(
    webdavHint.introducedIn,
    '0.9.58',
    'newtab WebDAV feature hint should be keyed to the release version'
  );
  assert.strictEqual(
    webdavHint.placement,
    'above newtab settings button',
    'newtab WebDAV feature hint should point to the settings button'
  );
  assert.strictEqual(
    webdavHint.arrowAlign,
    'end',
    'newtab WebDAV feature hint should point to the right-side settings button'
  );
  assert.strictEqual(
    webdavHint.widthMode,
    'content',
    'newtab WebDAV feature hint should prefer a single content-width row'
  );
  assert.strictEqual(
    webdavHint.badgeFallback,
    'Beta',
    'the WebDAV feature hint should mark the feature as a beta'
  );
  assert.strictEqual(
    webdavHint.className,
    'x-lumno-feature-hint--newtab-webdav-sync',
    'newtab WebDAV feature hint should expose a dedicated placement class'
  );
  assert.strictEqual(
    webdavHint.rememberOnFirstShow,
    false,
    'WebDAV hint should wait for user acknowledgement before remembering dismissal'
  );
  assert.strictEqual(webdavHint.linkKey, 'newtab_webdav_feature_hint_link',
    'the WebDAV hint should link to its settings');

  const helpCenterAskHint = featureHints.getFeatureHint('newtab-help-center-ask');
  assert(helpCenterAskHint, 'the Help Center ask hint should be registered');
  assert.strictEqual(helpCenterAskHint.introducedIn, '1.0.0',
    'the Help Center ask hint should reach everyone updating to the release that added it');
  assert.strictEqual(helpCenterAskHint.placement, 'above search input');
  assert.strictEqual(helpCenterAskHint.arrowSide, 'bottom', 'the Help Center ask hint should point down at the input');
  assert.strictEqual(helpCenterAskHint.arrowAlign, 'start', 'the Help Center ask hint should point where typing starts');
  assert.strictEqual(helpCenterAskHint.dismissStorage, 'sync');
  assert.strictEqual(helpCenterAskHint.rememberOnFirstShow, false,
    'the Help Center ask hint should stay until it is closed or used');
  assert.strictEqual(helpCenterAskHint.linkKey, 'newtab_help_center_ask_feature_hint_link',
    'the Help Center ask hint should offer to enter the Help Center search');

  const wallpaperSourcesHint = featureHints.getFeatureHint('newtab-wallpaper-sources');
  assert(wallpaperSourcesHint, 'the new wallpapers hint should be registered');
  assert.strictEqual(wallpaperSourcesHint.introducedIn, '0.9.58');
  assert.strictEqual(wallpaperSourcesHint.placement, 'bottom-right wallpaper control');
  assert.strictEqual(wallpaperSourcesHint.arrowSide, 'right', 'the new wallpapers hint should point at the appearance button');

  const macHintController = featureHints.createFeatureHint({
    documentObj: createFakeDocument(),
    definition: 'newtab-tab-switcher',
    dismissStorage: 'none',
    navigatorLike: {
      userAgentData: { platform: 'macOS' }
    },
    t: (key, fallback) => fallback
  });
  const windowsHintController = featureHints.createFeatureHint({
    documentObj: createFakeDocument(),
    definition: 'newtab-tab-switcher',
    dismissStorage: 'none',
    navigatorLike: {
      userAgentData: { platform: 'Windows' }
    },
    t: (key, fallback) => fallback
  });
  assert(macHintController, 'macOS tab switcher hint should be created');
  assert(windowsHintController, 'Windows tab switcher hint should be created');
  const macHintText = macHintController.element.children.find(
    (child) => child.className === 'x-lumno-feature-hint__text'
  );
  const windowsHintText = windowsHintController.element.children.find(
    (child) => child.className === 'x-lumno-feature-hint__text'
  );
  assert.match(
    macHintText ? macHintText.textContent : '',
    /⌥Q/,
    'macOS feature hint should use the Option symbol'
  );
  assert.match(
    windowsHintText ? windowsHintText.textContent : '',
    /Alt\+Q/,
    'Windows feature hint should retain Alt+Q'
  );

  const firstDocument = createFakeDocument();
  const firstController = featureHints.createFeatureHint({
    documentObj: firstDocument,
    definition: 'newtab-ai-quick-jump',
    chromeApi,
    windowObj: fakeWindow,
    t: (key, fallback) => fallback
  });
  assert(firstController, 'first feature hint should be created');
  assert(firstController.ready instanceof Promise, 'feature hints should expose async visibility readiness');
  assert.strictEqual(
    await firstController.ready,
    true,
    'feature hint readiness should resolve with its final stored-dismissal visibility'
  );
  await flushMicrotasks();

  assert.strictEqual(
    firstController.element.getAttribute('data-visible'),
    'true',
    'first feature hint should become visible after storage loads'
  );
  assert.strictEqual(
    firstController.element.getAttribute('data-rounded-arrow-tip'),
    'true',
    'new feature hint should opt into component-rendered rounded arrow tip'
  );
  assert.strictEqual(
    firstController.element.children[0].className,
    'x-lumno-feature-hint__arrow-tip',
    'rounded arrow tip should be rendered as a component child'
  );
  assert.strictEqual(
    firstController.element.children[0].getAttribute('aria-hidden'),
    'true',
    'rounded arrow tip should stay hidden from assistive technology'
  );
  assert.strictEqual(
    syncStore[syncKey],
    true,
    'first visible render should persist a sync dismissal marker'
  );
  assert.strictEqual(localStore[localKey], undefined, 'sync dismiss should not write the legacy local marker');
  assert.strictEqual(firstController.element.inert, false, 'visible feature hint should not be inert');

  const closeButton = firstController.element.children[firstController.element.children.length - 1];
  firstDocument.activeElement = closeButton;
  firstController.dismiss();
  assert.strictEqual(closeButton.blurred, true, 'focused feature hint control should blur on dismiss');
  assert.strictEqual(firstController.element.inert, true, 'dismissed feature hint should become inert');
  assert.strictEqual(resizeObserverDisconnects, 1, 'dismissed feature hint should disconnect layout observer');

  const secondController = featureHints.createFeatureHint({
    documentObj: createFakeDocument(),
    definition: 'newtab-ai-quick-jump',
    chromeApi,
    t: (key, fallback) => fallback
  });
  assert(secondController, 'second feature hint should be created');
  assert.strictEqual(
    await secondController.ready,
    false,
    'a previously dismissed feature hint should resolve readiness as hidden'
  );
  await flushMicrotasks();

  assert.strictEqual(
    secondController.element.getAttribute('data-visible'),
    'false',
    'second feature hint should stay hidden after the first one was remembered'
  );
  assert.strictEqual(
    secondController.element.getAttribute('data-dismissed'),
    'true',
    'second feature hint should load the sync dismissed state'
  );

  const webdavSyncKey = featureHints.getFeatureHintSyncDismissKey(
    'newtab-webdav-sync'
  );
  const previousWebdavSyncKey = featureHints.getFeatureHintSyncDismissKey({
    id: 'newtab-webdav-sync',
    introducedIn: '0.9.57'
  });
  const webdavSyncStore = {
    [previousWebdavSyncKey]: true
  };
  const webdavController = featureHints.createFeatureHint({
    documentObj: createFakeDocument(),
    definition: 'newtab-webdav-sync',
    chromeApi: createStorageBackedChrome({}, webdavSyncStore),
    t: (key, fallback) => fallback
  });
  assert(webdavController, 'WebDAV feature hint should be created');
  assert.strictEqual(
    await webdavController.ready,
    true,
    'an upgrade from 0.9.57 should expose the new 0.9.58 WebDAV hint'
  );
  await flushMicrotasks();
  assert.strictEqual(
    webdavController.element.getAttribute('data-visible'),
    'true',
    'the 0.9.58 WebDAV hint should become visible without a current dismissal'
  );
  assert.strictEqual(
    webdavSyncStore[webdavSyncKey],
    undefined,
    'becoming visible should not remember the WebDAV hint before acknowledgement'
  );
  webdavController.setVisible(false);
  webdavController.setVisible(true);
  assert.strictEqual(
    webdavSyncStore[webdavSyncKey],
    undefined,
    'an interrupted visible state should not remember the WebDAV hint'
  );
  webdavController.dismiss();
  assert.strictEqual(
    webdavSyncStore[webdavSyncKey],
    true,
    'actively dismissing the WebDAV hint should persist acknowledgement'
  );

  const acknowledgedWebdavController = featureHints.createFeatureHint({
    documentObj: createFakeDocument(),
    definition: 'newtab-webdav-sync',
    chromeApi: createStorageBackedChrome({}, webdavSyncStore),
    t: (key, fallback) => fallback
  });
  assert.strictEqual(
    await acknowledgedWebdavController.ready,
    false,
    'an acknowledged WebDAV hint should stay hidden on later New Tabs'
  );
  assert.strictEqual(
    acknowledgedWebdavController.element.getAttribute('data-dismissed'),
    'true',
    'a later New Tab should load the acknowledged WebDAV hint state'
  );

  let releaseVisibilityGate = null;
  const gatedWebdavController = featureHints.createFeatureHint({
    documentObj: createFakeDocument(),
    definition: 'newtab-webdav-sync',
    dismissStorage: 'none',
    visibilityGate: new Promise((resolve) => {
      releaseVisibilityGate = resolve;
    }),
    t: (key, fallback) => fallback
  });
  assert(gatedWebdavController, 'gated WebDAV feature hint should be created');
  assert.strictEqual(
    gatedWebdavController.element.getAttribute('data-visible'),
    'false',
    'a feature hint should stay hidden while its component visibility gate is pending'
  );
  let gatedReadySettled = false;
  gatedWebdavController.ready.then(() => {
    gatedReadySettled = true;
  });
  await flushMicrotasks();
  assert.strictEqual(
    gatedReadySettled,
    false,
    'feature hint readiness should wait for the component visibility gate'
  );
  releaseVisibilityGate();
  assert.strictEqual(
    await gatedWebdavController.ready,
    true,
    'the feature hint should become visible only after its visibility gate resolves'
  );
  assert.strictEqual(
    gatedWebdavController.element.getAttribute('data-visible'),
    'true',
    'the feature hint should run its own entrance after the anchor entrance gate settles'
  );

  const legacyLocalStore = { [localKey]: true };
  const migratedSyncStore = {};
  const legacyController = featureHints.createFeatureHint({
    documentObj: createFakeDocument(),
    definition: 'newtab-ai-quick-jump',
    chromeApi: createStorageBackedChrome(legacyLocalStore, migratedSyncStore),
    t: (key, fallback) => fallback
  });
  assert(legacyController, 'legacy feature hint should be created');
  await flushMicrotasks();

  assert.strictEqual(
    legacyController.element.getAttribute('data-dismissed'),
    'true',
    'sync feature hint should honor legacy local dismissed state'
  );
  assert.strictEqual(
    migratedSyncStore[syncKey],
    true,
    'legacy local dismissed state should migrate into sync'
  );

  const plainController = featureHints.createFeatureHint({
    documentObj: createFakeDocument(),
    definition: {
      id: 'plain-feature-hint',
      introducedIn: '0.0.0',
      surface: 'test',
      placement: 'test',
      arrowSide: 'bottom',
      arrowAlign: 'center',
      dismissStorage: 'none',
      badgeFallback: 'New',
      textFallback: 'Plain feature hint',
      closeLabelFallback: 'Dismiss plain feature hint'
    },
    t: (key, fallback) => fallback
  });
  assert(plainController, 'plain feature hint should be created');
  assert.strictEqual(
    plainController.element.getAttribute('data-rounded-arrow-tip'),
    'false',
    'rounded arrow tip should stay opt-in at the component definition level'
  );
  assert.notStrictEqual(
    plainController.element.children[0].className,
    'x-lumno-feature-hint__arrow-tip',
    'plain feature hints should not render a rounded arrow tip child'
  );

  let resolveDeferredStorage = null;
  const deferredController = featureHints.createFeatureHint({
    documentObj: createFakeDocument(),
    definition: 'newtab-ai-quick-jump',
    chromeApi: {
      runtime: { lastError: null },
      storage: {
        local: createStorageArea({}),
        sync: {
          get(_keys, callback) {
            resolveDeferredStorage = () => callback({});
          },
          set(_values, callback) {
            if (callback) callback();
          }
        }
      }
    },
    t: (key, fallback) => fallback
  });
  assert(deferredController, 'a feature hint with deferred storage should be created');
  deferredController.destroy();
  assert.strictEqual(
    await deferredController.ready,
    false,
    'destroying before storage resolves should settle readiness without showing the hint'
  );
  assert(resolveDeferredStorage, 'the deferred storage callback should be captured');
  resolveDeferredStorage();
  await flushMicrotasks();
  assert.strictEqual(
    deferredController.element.getAttribute('data-visible'),
    'false',
    'late storage results should not mutate a destroyed feature hint'
  );

  console.log('feature hint tests passed');
})();
