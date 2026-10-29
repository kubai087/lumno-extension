const assert = require('assert');
const { createSettingsStore } = require('../../src/platform/settings-store.ts');
// The module under test draws through this stand-in for its React view.
global.__lumnoTestModuleStubs = Object.assign(global.__lumnoTestModuleStubs || {}, {
  'src/shared/react/feature-hint-view.tsx': { createFeatureHintView: (options) => featureHintView.createFeatureHintView(options) }
});
const fs = require('fs');
const { readStylesheet } = require('../helpers/css-tokens');
const { parseCss } = require('../helpers/css-rules');
const { createNewtabPage } = require('../helpers/newtab-page');
const { engagementStorage } = require('../helpers/newtab-notices');
const featureSettings = require('../../src/domain/settings/features.ts');

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

  removeEventListener(type, listener) {
    if (this.listeners[type] === listener) {
      delete this.listeners[type];
    }
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
    const badge = documentObj.createElement('span');
    badge.className = 'x-lumno-feature-hint__badge';
    if (model.badgeIconText) {
      const badgeIcon = documentObj.createElement('span');
      badgeIcon.className = 'x-lumno-feature-hint__badge-icon';
      badgeIcon.textContent = model.badgeIconText;
      badgeIcon.setAttribute('data-icon-type', 'text');
      badge.appendChild(badgeIcon);
    }
    const badgeText = documentObj.createElement('span');
    badgeText.className = 'x-lumno-feature-hint__badge-text';
    badge.appendChild(badgeText);
    element.appendChild(badge);
    const text = documentObj.createElement('span');
    text.id = model.textId;
    text.className = 'x-lumno-feature-hint__text';
    element.appendChild(text);
    let linkButton = null;
    if (model.hasLink) {
      linkButton = documentObj.createElement('button');
      linkButton.className = 'x-lumno-feature-hint__link';
      const linkText = documentObj.createElement('span');
      linkText.className = 'x-lumno-feature-hint__link-text';
      linkButton.appendChild(linkText);
      linkButton.addEventListener('click', options.onLinkClick);
      linkButton.addEventListener('auxclick', (event) => {
        if (event && Number(event.button) === 1) {
          options.onLinkClick(event);
        }
      });
      element.appendChild(linkButton);
    }
    const closeButton = documentObj.createElement('button');
    closeButton.className = 'x-lumno-feature-hint__close';
    element.appendChild(closeButton);
    // Shows the copy the hint sets in its store.
    const applyLabels = ({ labels }) => {
        badge.setAttribute('aria-label', labels.badge);
        badgeText.textContent = labels.badge;
        text.textContent = labels.text;
        closeButton.setAttribute('aria-label', labels.close);
        if (linkButton) {
          linkButton.setAttribute('aria-label', labels.link || '');
          linkButton.children[0].textContent = labels.link || '';
        }
    };
    applyLabels(options.labels.getSnapshot());
    options.labels.subscribe(() => applyLabels(options.labels.getSnapshot()));
    return {
      arrowTip: null,
      badge,
      closeButton,
      destroy() {},
      element,
      linkButton,
      text
    };
  }
};

const featureHints = require('../helpers/feature-hints.ts');
const updateNotice = require('../../src/shared/update-notice.ts');
const settingsStorage = require('../helpers/settings-storage.ts');

function createOnChangedEmitter() {
  const listeners = [];
  return {
    addListener(listener) {
      listeners.push(listener);
    },
    removeListener(listener) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    },
    emit(changes, areaName) {
      listeners.slice().forEach((listener) => listener(changes, areaName));
    },
    get count() {
      return listeners.length;
    }
  };
}

function createStorageArea(store, areaName, onChanged) {
  return {
    get(keys, callback) {
      const result = {};
      keys.forEach((key) => {
        result[key] = store[key];
      });
      callback(result);
    },
    set(values, callback) {
      const changes = {};
      Object.keys(values).forEach((key) => {
        changes[key] = {
          oldValue: store[key],
          newValue: values[key]
        };
      });
      Object.assign(store, values);
      onChanged.emit(changes, areaName);
      if (typeof callback === 'function') {
        callback();
      }
    }
  };
}

function createStorageBackedChrome(localStore, syncStore, version) {
  const onChanged = createOnChangedEmitter();
  return {
    runtime: {
      lastError: null,
      getManifest() {
        return { version };
      }
    },
    storage: {
      onChanged,
      local: createStorageArea(localStore, 'local', onChanged),
      sync: createStorageArea(syncStore, 'sync', onChanged)
    }
  };
}

// On New Tab a pending update notice sits below the search box, outside its
// layer, counts one exposure once shown, wears the butterfly in the badge's
// text slot and opens the release page with the click's disposition.
async function testOnNewTab() {
  const version = JSON.parse(fs.readFileSync('manifest.json', 'utf8')).version;
  const storage = engagementStorage({
    updateNotice: true,
    sync: { [featureSettings.updateNoticeState.key]: { version, previousVersion: '0.0.1', reason: 'update', updatedAt: 1 } }
  });
  const page = await createNewtabPage(storage);
  await page.settle(600);
  const notice = Array.from(page.document.querySelectorAll('.x-lumno-feature-hint--update-notice'))
    .find((element) => !element.hasAttribute('data-engagement-surface'));
  assert.strictEqual(notice && notice.getAttribute('data-visible'), 'true', 'a pending update should show its notice');
  const searchRoot = page.document.getElementById('_x_extension_newtab_root_2024_unique_');
  assert.ok(!searchRoot.contains(notice) && notice.parentNode === page.document.body,
    'newtab update notice should not be appended inside the search layer');
  assert.ok(searchRoot.compareDocumentPosition(notice) & 4, 'newtab update notice should come after the input search layer');
  const countKey = updateNotice.getUpdateNoticeDisplayCountKey(version);
  const count = page.storage.sync.data[countKey] !== undefined ? page.storage.sync.data[countKey] : page.storage.local.data[countKey];
  assert.strictEqual(count, 1, 'newtab should count one exposure once the notice is mounted');
  const badgeIcon = notice.querySelector('.x-lumno-feature-hint__badge-icon[data-icon-type="text"]');
  assert.strictEqual(badgeIcon && badgeIcon.textContent, '🦋', 'update notice butterfly should use the component badge icon slot');
  const details = Array.from(notice.querySelectorAll('button')).find((button) => /changelog/i.test(button.textContent));
  details.dispatchEvent(new page.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, metaKey: true }));
  await page.settle(50);
  const release = page.messages.find((message) => message.action === 'openReleasePage');
  assert.ok(release && release.reason === 'notice' && release.disposition === 'backgroundTab',
    `the update notice should forward background-opening modifiers: ${JSON.stringify(release)}`);
  page.close();
}

// The notice's styles, through the CSSOM.
function testStyles() {
  const css = parseCss(readStylesheet('src/shared/ui/feature-hints.css'));
  const rule = (selector, condition) => {
    const found = css.rule(selector, condition);
    assert.ok(found, `missing ${selector}`);
    return found;
  };
  const overlay = rule('.x-lumno-feature-hint--update-notice-overlay');
  assert.strictEqual(overlay.get('position'), 'fixed', 'update notice should use fixed overlay placement');
  assert.ok(css.entries.some((entry) => entry.selectors.some((selector) => selector.startsWith('.x-lumno-feature-hint--update-notice')) &&
    entry.style.getPropertyValue('border-radius') === '999px'), 'and capsule styling');
  const mounting = rule('.x-lumno-feature-hint--update-notice-overlay[data-overlay-mounting="true"]');
  assert.deepStrictEqual([mounting.get('filter'), mounting.get('pointer-events')], ['blur(8px)', 'none'],
    'overlay update notice should blur in, untouchable, while it is mounted');
  const singleRow = rule('.x-lumno-feature-hint--update-notice[data-width-mode="container"]');
  const title = rule('.x-lumno-feature-hint--update-notice .x-lumno-feature-hint__text');
  assert.deepStrictEqual(
    [singleRow.get('flex-wrap'), singleRow.get('white-space'), title.get('overflow'), title.get('overflow-wrap'), title.get('text-overflow'), title.get('white-space')],
    ['nowrap', 'nowrap', 'hidden', 'normal', 'ellipsis', 'nowrap'],
    'update notice title should stay on one row and truncate with an ellipsis'
  );
  const textIcon = rule('.x-lumno-feature-hint__badge-icon[data-icon-type="text"]');
  assert.deepStrictEqual([textIcon.get('width'), textIcon.get('padding-inline-start'), textIcon.get('justify-content')], ['22px', '4px', 'flex-end'],
    'text badge icons should reserve visual space before wide emoji glyphs');
  assert.ok(rule('.x-lumno-feature-hint--update-notice .x-lumno-feature-hint__badge').has('--x-lumno-feature-hint-badge-bg'),
    'light update notice badge should own scoped material tokens');
  assert.ok(rule('body[data-theme="dark"] .x-lumno-feature-hint--update-notice .x-lumno-feature-hint__badge').has('--x-lumno-feature-hint-badge-gloss'),
    'dark update notice badge should override the light badge material on the badge element');
  assert.ok(rule('body[data-theme="dark"] .x-lumno-feature-hint--update-notice').has('--x-lumno-feature-hint-sweep-core'),
    'dark update notice should own a scoped badge sweep override');
}

function flushMicrotasks() {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

(async () => {
  assert.strictEqual(updateNotice.normalizeVersionTag('0.9.10'), 'v0.9.10');
  assert.strictEqual(updateNotice.normalizeVersionTag('v0.9.10'), 'v0.9.10');
  assert.strictEqual(updateNotice.formatVersionLabel('v0.9.10'), '0.9.10');
  assert.strictEqual(updateNotice.UPDATE_NOTICE_MAX_DISPLAY_COUNT, 3);
  assert.strictEqual(updateNotice.normalizeUpdateNoticeDisplayCount(undefined), 0);
  assert.strictEqual(updateNotice.normalizeUpdateNoticeDisplayCount(2.9), 2);
  assert.strictEqual(updateNotice.normalizeUpdateNoticeDisplayCount(10), 3);

  const normalized = updateNotice.normalizeUpdateNoticePayload({
    version: '0.9.10',
    previousVersion: '0.9.9',
    title: 'Release title from GitHub',
    releaseUrl: 'https://example.com/release/?version=v0.9.10',
    reason: 'update',
    updatedAt: 10
  });
  assert.strictEqual(normalized.version, 'v0.9.10');
  assert.strictEqual(normalized.title, 'Release title from GitHub');
  assert.strictEqual(updateNotice.shouldShowUpdateNotice(normalized, '0.9.10'), true);
  assert.strictEqual(updateNotice.shouldShowUpdateNotice(normalized, '0.9.9'), false);
  const fetchedTitle = await updateNotice.fetchReleaseTitle('0.9.10', {
    fetchImpl(url, init) {
      assert.strictEqual(
        url,
        'https://api.github.com/repos/kubai087/lumno-extension/releases/tags/0.9.10'
      );
      assert.strictEqual(init.headers.Accept, 'application/vnd.github+json');
      return Promise.resolve({
        ok: true,
        json() {
          return Promise.resolve({ tag_name: 'v0.9.10', name: 'Release title from GitHub' });
        }
      });
    }
  });
  assert.strictEqual(fetchedTitle, 'Release title from GitHub', 'release title should come from the GitHub release');
  const fallbackRequests = [];
  const fallbackTitle = await updateNotice.fetchReleaseTitle('v0.9.10', {
    fetchImpl(url) {
      fallbackRequests.push(url);
      if (url.endsWith('/v0.9.10')) {
        return Promise.resolve({
          ok: false,
          json() {
            return Promise.resolve({});
          }
        });
      }
      if (url.endsWith('/0.9.10')) {
        return Promise.resolve({
          ok: true,
          json() {
            return Promise.resolve({ tag_name: '0.9.10', name: 'Minor Bug Fixes' });
          }
        });
      }
      throw new Error(`unexpected release URL ${url}`);
    }
  });
  assert.strictEqual(fallbackTitle, 'Minor Bug Fixes', 'release title lookup should support tags without a v prefix');
  assert.deepStrictEqual(
    fallbackRequests,
    [
      'https://api.github.com/repos/kubai087/lumno-extension/releases/tags/v0.9.10',
      'https://api.github.com/repos/kubai087/lumno-extension/releases/tags/0.9.10'
    ],
    'release title lookup should try the normalized tag and then the bare version tag'
  );
  const htmlFallbackTitle = await updateNotice.fetchReleaseTitle('v0.9.10', {
    fetchImpl(url) {
      if (url.startsWith('https://api.github.com/')) {
        return Promise.resolve({
          ok: false,
          json() {
            return Promise.resolve({});
          }
        });
      }
      if (url.endsWith('/v0.9.10')) {
        return Promise.resolve({
          ok: false,
          text() {
            return Promise.resolve('');
          }
        });
      }
      if (url.endsWith('/0.9.10')) {
        return Promise.resolve({
          ok: true,
          text() {
            return Promise.resolve('<title>Release Minor Bug Fixes · kubai087/lumno-extension · GitHub</title>');
          }
        });
      }
      throw new Error(`unexpected release URL ${url}`);
    }
  });
  assert.strictEqual(
    htmlFallbackTitle,
    'Minor Bug Fixes',
    'release title lookup should fall back to the GitHub release page title when the API is unavailable'
  );
  const publishWrites = [];
  const publishChromeApi = {
    runtime: {
      lastError: null,
      getManifest() {
        return { version: '0.9.10' };
      }
    },
    storage: {
      sync: {
        get(keys, callback) {
          const result = {};
          keys.forEach((key) => {
            result[key] = undefined;
          });
          callback(result);
        },
        set(values, callback) {
          publishWrites.push(values[featureSettings.updateNoticeState.key]);
          if (typeof callback === 'function') {
            callback();
          }
        }
      }
    }
  };
  await updateNotice.publishUpdateNotice({
    chromeApi: publishChromeApi,
    settingsStore: createSettingsStore({ chromeApi: publishChromeApi, settings: [] }),
    version: 'v0.9.10',
    previousVersion: '0.9.9',
    reason: 'update',
    fetchImpl() {
      return Promise.resolve({
        ok: true,
        json() {
          return Promise.resolve({ tag_name: '0.9.10', name: 'Minor Bug Fixes' });
        }
      });
    }
  });
  assert.strictEqual(publishWrites.length, 1, 'update notice publishing should write once after title lookup');
  assert.strictEqual(
    publishWrites[0].title,
    'Minor Bug Fixes',
    'published update notice should include the GitHub release title'
  );

  await testOnNewTab();
  testStyles();

  const firstDismissKey = updateNotice.getUpdateNoticeDismissKey('0.9.10');
  const nextDismissKey = updateNotice.getUpdateNoticeDismissKey('0.9.11');
  assert.strictEqual(
    featureSettings.updateNoticeEnabled.key,
    '_x_extension_update_notice_enabled_2026_unique_',
    'update notice module should expose the synced enablement preference key'
  );
  assert(firstDismissKey.includes('update_notice'), 'dismiss key should be scoped to the update notice');
  assert.notStrictEqual(firstDismissKey, nextDismissKey, 'dismiss key should change per version');
  assert.notStrictEqual(
    updateNotice.getUpdateNoticeDisplayCountKey('0.9.10'),
    updateNotice.getUpdateNoticeDisplayCountKey('0.9.11'),
    'display count should reset for each update version'
  );

  const syncStore = {
    [featureSettings.updateNoticeState.key]: normalized
  };
  const chromeApi = createStorageBackedChrome({}, syncStore, '0.9.10');
  // The page's settings storage runtime keeps one storage-mode listener for
  // the page's lifetime; only the notices' own listeners must go on destroy.
  settingsStorage.createProviderStorageRuntime(chromeApi);
  const pageStorageListenerCount = chromeApi.storage.onChanged.count;
  const detailsClicks = [];
  let sessionSlotClaims = 0;
  const firstController = updateNotice.createUpdateNotice({
    documentObj: createFakeDocument(),
    featureHints,
    chromeApi,
    t(key, fallback) {
      if (key === 'update_notice_badge') {
        return '🦋 已更新至 {version}';
      }
      return fallback;
    },
    onSessionSlotClaimed() {
      sessionSlotClaims += 1;
    },
    onDetailsClick(notice, event) {
      detailsClicks.push({ notice, event });
    }
  });
  const secondController = updateNotice.createUpdateNotice({
    documentObj: createFakeDocument(),
    featureHints,
    chromeApi,
    t(key, fallback) {
      return fallback;
    },
  });

  assert(firstController, 'first update notice should be created');
  assert(secondController, 'second update notice should be created');
  assert.strictEqual(
    firstController.hasSessionSlot(),
    false,
    'the update prompt should not claim the shared slot before async state is ready'
  );
  const firstSessionClaimed = await firstController.ready;
  await flushMicrotasks();
  await flushMicrotasks();

  assert.strictEqual(
    firstController.element.getAttribute('data-visible'),
    'true',
    'current update notice should become visible'
  );
  assert.strictEqual(firstSessionClaimed, true, 'ready should resolve after the visible update claims the slot');
  assert.strictEqual(firstController.hasSessionSlot(), true, 'the visible update should own the session slot');
  assert.strictEqual(sessionSlotClaims, 1, 'the session slot callback should fire only on the first claim');
  assert.strictEqual(firstController.element.children[0].children[0].textContent, '🦋');
  assert.strictEqual(firstController.element.children[0].children[1].textContent, '已更新至 0.9.10');
  assert.strictEqual(firstController.element.children[1].textContent, 'Release title from GitHub');
  assert.strictEqual(firstController.element.children[2].children[0].textContent, '更新日志');

  firstController.element.children[2].listeners.click({
    preventDefault() {},
    stopPropagation() {}
  });
  assert.strictEqual(detailsClicks.length, 1, 'details button should call the details handler');
  assert.strictEqual(detailsClicks[0].notice.version, 'v0.9.10');

  firstController.element.children[2].listeners.auxclick({
    button: 1,
    preventDefault() {},
    stopPropagation() {}
  });
  assert.strictEqual(detailsClicks.length, 2, 'middle-click should call the details handler once');
  assert.strictEqual(detailsClicks[1].event.button, 1, 'middle-click event should reach the surface disposition handler');

  firstController.dismiss();
  await flushMicrotasks();
  assert.strictEqual(
    firstController.hasSessionSlot(),
    true,
    'dismissing an update should not release the rating slot again in the same page session'
  );
  assert.strictEqual(
    syncStore[firstDismissKey],
    true,
    'dismissing should persist the current version dismiss marker'
  );
  assert.strictEqual(
    secondController.element.getAttribute('data-visible'),
    'false',
    'dismissing one update notice should hide the other current-version instance'
  );
  const laterSessionController = updateNotice.createUpdateNotice({
    documentObj: createFakeDocument(),
    featureHints,
    chromeApi,
    t(key, fallback) {
      return fallback;
    },
  });
  assert(laterSessionController, 'a later-session update controller should still be creatable');
  assert.strictEqual(
    await laterSessionController.ready,
    false,
    'a previously dismissed update should leave the rating slot open on later pages'
  );
  assert.strictEqual(
    laterSessionController.hasSessionSlot(),
    false,
    'stored update dismissal must not permanently starve the rating prompt'
  );

  const disabledStore = {
    [featureSettings.updateNoticeState.key]: normalized,
    [featureSettings.updateNoticeEnabled.key]: false
  };
  const disabledChromeApi = createStorageBackedChrome({}, disabledStore, '0.9.10');
  const disabledController = updateNotice.createUpdateNotice({
    documentObj: createFakeDocument(),
    featureHints,
    chromeApi: disabledChromeApi,
    t(key, fallback) {
      return fallback;
    },
  });
  assert(disabledController, 'disabled update notice controller should still be created');
  await flushMicrotasks();
  await flushMicrotasks();
  assert.strictEqual(
    disabledController.element.getAttribute('data-visible'),
    'false',
    'update notice should stay hidden when the global prompt switch is off'
  );
  assert.strictEqual(
    await disabledController.ready,
    false,
    'a disabled update notice should leave the session slot available'
  );
  disabledChromeApi.storage.sync.set({ [featureSettings.updateNoticeEnabled.key]: true }, () => {});
  await flushMicrotasks();
  await flushMicrotasks();
  assert.strictEqual(
    disabledController.element.getAttribute('data-visible'),
    'true',
    'turning the global prompt switch back on should show the current update notice'
  );
  disabledChromeApi.storage.sync.set({ [featureSettings.updateNoticeEnabled.key]: false }, () => {});
  await flushMicrotasks();
  assert.strictEqual(
    disabledController.element.getAttribute('data-visible'),
    'false',
    'turning the global prompt switch off should hide a visible update notice'
  );

  const oldChromeApi = createStorageBackedChrome({}, {
    [featureSettings.updateNoticeState.key]: normalized
  }, '0.9.9');
  const oldController = updateNotice.createUpdateNotice({
    documentObj: createFakeDocument(),
    featureHints,
    chromeApi: oldChromeApi,
    t(key, fallback) {
      return fallback;
    },
  });
  assert(oldController, 'old-version update notice controller should still be creatable');
  await flushMicrotasks();
  await flushMicrotasks();
  assert.strictEqual(
    oldController.element.getAttribute('data-visible'),
    'false',
    'notice should not show when the stored update is for a different version'
  );

  const missingTitleStore = {
    [featureSettings.updateNoticeState.key]: updateNotice.normalizeUpdateNoticePayload({
      version: '0.9.10',
      previousVersion: '0.9.9',
      reason: 'update',
      updatedAt: 11
    })
  };
  const missingTitleChromeApi = createStorageBackedChrome({}, missingTitleStore, '0.9.10');
  const hydratedController = updateNotice.createUpdateNotice({
    documentObj: createFakeDocument(),
    featureHints,
    chromeApi: missingTitleChromeApi,
    fetchImpl() {
      return Promise.resolve({
        ok: true,
        json() {
          return Promise.resolve({ tag_name: '0.9.10', name: 'Minor Bug Fixes' });
        }
      });
    },
    t(key, fallback) {
      return fallback;
    },
  });
  assert(hydratedController, 'missing-title update notice controller should be created');
  await flushMicrotasks();
  await flushMicrotasks();
  await flushMicrotasks();
  assert.strictEqual(
    hydratedController.element.children[1].textContent,
    'Minor Bug Fixes',
    'visible update notice should hydrate a missing release title'
  );
  assert.strictEqual(
    missingTitleStore[featureSettings.updateNoticeState.key].title,
    'Minor Bug Fixes',
    'hydrated release title should be persisted for all surfaces'
  );

  const cappedStore = {
    [featureSettings.updateNoticeState.key]: normalized
  };
  const cappedChromeApi = createStorageBackedChrome({}, cappedStore, '0.9.10');
  const displayCountKey = updateNotice.getUpdateNoticeDisplayCountKey('0.9.10');
  const cappedDismissKey = updateNotice.getUpdateNoticeDismissKey('0.9.10');
  async function createMountedCappedController(surface) {
    const controller = updateNotice.createUpdateNotice({
      documentObj: createFakeDocument(),
      featureHints,
      chromeApi: cappedChromeApi,
      surface,
      t(key, fallback) {
        return fallback;
      },
    });
    assert(controller, `${surface} capped update notice should be created`);
    const exposureRecorded = controller.recordExposure();
    await controller.ready;
    const recorded = await exposureRecorded;
    await flushMicrotasks();
    return { controller, recorded };
  }

  const cappedFirst = await createMountedCappedController('newtab');
  assert.strictEqual(cappedFirst.recorded, true, 'the first newtab display should count');
  assert.strictEqual(cappedStore[displayCountKey], 1);
  assert.strictEqual(
    await cappedFirst.controller.recordExposure(),
    false,
    'one mounted instance should not count more than once'
  );
  assert.strictEqual(cappedStore[displayCountKey], 1);
  cappedFirst.controller.destroy();

  const cappedSecond = await createMountedCappedController('overlay');
  assert.strictEqual(cappedSecond.recorded, true, 'the overlay display should share the same count');
  assert.strictEqual(cappedStore[displayCountKey], 2);
  cappedSecond.controller.destroy();

  const cappedThird = await createMountedCappedController('newtab');
  assert.strictEqual(cappedThird.recorded, true, 'the third cross-surface display should count');
  assert.strictEqual(cappedStore[displayCountKey], 3);
  assert.strictEqual(
    cappedStore[cappedDismissKey],
    true,
    'the third display should persist the normal per-version dismissal'
  );
  assert.strictEqual(
    cappedThird.controller.element.getAttribute('data-visible'),
    'true',
    'the third exposure should remain visible instead of disappearing immediately'
  );
  cappedThird.controller.destroy();

  const cappedFourth = await createMountedCappedController('overlay');
  assert.strictEqual(cappedFourth.recorded, false, 'a fourth display should be suppressed');
  assert.strictEqual(cappedFourth.controller.getDisplayCount(), 3);
  assert.strictEqual(
    cappedFourth.controller.element.getAttribute('data-visible'),
    'false',
    'later newtab and overlay instances should stay closed after three displays'
  );
  cappedFourth.controller.destroy();

  firstController.destroy();
  secondController.destroy();
  laterSessionController.destroy();
  disabledController.destroy();
  oldController.destroy();
  hydratedController.destroy();
  assert.strictEqual(chromeApi.storage.onChanged.count, pageStorageListenerCount, 'destroy should detach storage listeners');

  console.log('update notice tests passed');
})();
