const assert = require('assert');
const fs = require('fs');

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

global.LumnoFeatureHintView = {
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
    return {
      arrowTip: null,
      badge,
      closeButton,
      destroy() {},
      element,
      linkButton,
      text,
      updateLabels(labels) {
        badge.setAttribute('aria-label', labels.badge);
        badgeText.textContent = labels.badge;
        text.textContent = labels.text;
        closeButton.setAttribute('aria-label', labels.close);
        if (linkButton) {
          linkButton.setAttribute('aria-label', labels.link || '');
          linkButton.children[0].textContent = labels.link || '';
        }
      }
    };
  }
};

const featureHints = require('../src/shared/feature-hints.js');
const updateNotice = require('../src/shared/update-notice.js');

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

function flushMicrotasks() {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

(async () => {
  assert.strictEqual(updateNotice.normalizeVersionTag('0.9.10'), 'v0.9.10');
  assert.strictEqual(updateNotice.normalizeVersionTag('v0.9.10'), 'v0.9.10');
  assert.strictEqual(updateNotice.formatVersionLabel('v0.9.10'), '0.9.10');

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
          publishWrites.push(values[updateNotice.UPDATE_NOTICE_STORAGE_KEY]);
          if (typeof callback === 'function') {
            callback();
          }
        }
      }
    }
  };
  await updateNotice.publishUpdateNotice({
    chromeApi: publishChromeApi,
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

  const newtabSource = fs.readFileSync('src/newtab/newtab.js', 'utf8');
  assert.strictEqual(
    newtabSource.includes('searchLayer.appendChild(updateNoticeController.element)'),
    false,
    'newtab update notice should not be appended inside the search layer'
  );
  const newtabRootAppendIndex = newtabSource.indexOf('root.appendChild(searchLayer)');
  const newtabNoticeInsertIndex = newtabSource.indexOf('document.body.insertBefore(updateNoticeController.element, newtabUpdateNoticeAnchor)');
  assert(
    newtabRootAppendIndex !== -1 &&
      newtabNoticeInsertIndex !== -1 &&
      newtabRootAppendIndex < newtabNoticeInsertIndex,
    'newtab update notice should be appended below the input search layer and outside it'
  );
  const overlaySource = fs.readFileSync('src/overlay/search-panel.js', 'utf8');
  assert.match(
    overlaySource,
    /onDetailsClick\(_notice, event\)[\s\S]*action: 'openReleasePage',[\s\S]*disposition: getOpenDisposition\(event, 'newTab'\)/,
    'overlay update notice should forward background-opening modifiers'
  );
  assert.strictEqual(
    overlaySource.includes('overlay.appendChild(overlayUpdateNoticeController.element)'),
    false,
    'overlay update notice should not be appended inside the overlay panel'
  );
  const overlayNoticeAppendIndex = overlaySource.indexOf('overlayStyleRoot.insertBefore(noticeElement, overlay)');
  const overlayInputAppendIndex = overlaySource.indexOf('overlay.appendChild(inputContainer)');
  const overlayRevealIndex = overlaySource.indexOf('const revealOverlay = (options) =>');
  const overlayScheduledMountIndex = overlaySource.indexOf('scheduleOverlayUpdateNoticeMount(360)');
  const overlayMountingSetIndex = overlaySource.indexOf("noticeElement.setAttribute('data-overlay-mounting', 'true')");
  const overlayMountingFinishIndex = overlaySource.indexOf('finishOverlayUpdateNoticeMountAnimation(noticeElement)');
  assert(
    overlayNoticeAppendIndex !== -1 &&
      overlayInputAppendIndex !== -1 &&
      overlayNoticeAppendIndex < overlayInputAppendIndex,
    'overlay update notice should be mounted outside and above the overlay panel'
  );
  assert(
    overlayRevealIndex !== -1 &&
      overlayScheduledMountIndex !== -1 &&
      overlayRevealIndex < overlayScheduledMountIndex,
    'overlay update notice should be mounted after the overlay enter animation starts'
  );
  assert(
    overlayMountingSetIndex !== -1 &&
      overlayMountingFinishIndex !== -1 &&
      overlayMountingSetIndex < overlayNoticeAppendIndex,
    'overlay update notice should enter with a temporary mount animation state before insertion'
  );
  const updateNoticeCss = fs.readFileSync('src/shared/feature-hints.css', 'utf8');
  assert(
    updateNoticeCss.includes('.x-lumno-feature-hint--update-notice-overlay') &&
      updateNoticeCss.includes('position: fixed;') &&
      updateNoticeCss.includes('border-radius: 999px;'),
    'update notice should use fixed overlay placement and capsule styling'
  );
  assert(
    updateNoticeCss.includes('transform: translateX(-50%) translateY(calc(-100% + 2px)) scale(var(--x-ov-visible-scale, 1)) scale(0.985);') &&
      updateNoticeCss.includes('transform: translateX(-50%) translateY(calc(-100% - 14px)) scale(var(--x-ov-visible-scale, 1));') &&
      updateNoticeCss.includes('filter: blur(6px);'),
    'overlay update notice should use viewport-compensated blur/scale enter motion above the overlay'
  );
  assert(
    updateNoticeCss.includes('.x-lumno-feature-hint--update-notice-overlay[data-overlay-mounting="true"]') &&
      updateNoticeCss.includes('filter: blur(8px);') &&
      updateNoticeCss.includes('pointer-events: none;'),
    'overlay update notice should blur in when it is mounted'
  );
  const updateNoticeSingleRowRuleMatch = updateNoticeCss.match(
    /\.x-lumno-feature-hint--update-notice\[data-width-mode="container"\] \{([\s\S]*?)\n\}/
  );
  const updateNoticeTitleRuleMatch = updateNoticeCss.match(
    /\.x-lumno-feature-hint--update-notice \.x-lumno-feature-hint__text \{([\s\S]*?)\n\}/
  );
  assert(
    updateNoticeSingleRowRuleMatch &&
      updateNoticeSingleRowRuleMatch[1].includes('flex-wrap: nowrap;') &&
      updateNoticeSingleRowRuleMatch[1].includes('white-space: nowrap;') &&
      updateNoticeTitleRuleMatch &&
      updateNoticeTitleRuleMatch[1].includes('overflow: hidden;') &&
      updateNoticeTitleRuleMatch[1].includes('overflow-wrap: normal;') &&
      updateNoticeTitleRuleMatch[1].includes('text-overflow: ellipsis;') &&
      updateNoticeTitleRuleMatch[1].includes('white-space: nowrap;'),
    'update notice title should stay on one row and truncate with an ellipsis'
  );
  assert(
    updateNoticeCss.includes('gap: 3px;') &&
      updateNoticeCss.includes('padding: 2px 10px 2px 2px;'),
    'update notice badge should keep the badge left inset equal to its vertical inset'
  );
  assert(
    updateNoticeCss.includes('linear-gradient(180deg, var(--x-lumno-feature-hint-badge-gloss) 0%, transparent 48%)') &&
      updateNoticeCss.includes('border: 1px solid var(--x-lumno-feature-hint-badge-border);') &&
      updateNoticeCss.includes('box-shadow: var(--x-lumno-feature-hint-badge-shadow);'),
    'update notice badge should use layered gloss, a hairline border, and depth shadow'
  );
  const lightUpdateNoticeBadgeRuleMatch = updateNoticeCss.match(
    /\.x-lumno-feature-hint--update-notice \.x-lumno-feature-hint__badge \{([\s\S]*?)\n\}/
  );
  assert(lightUpdateNoticeBadgeRuleMatch, 'light update notice badge should own scoped material tokens');
  const lightUpdateNoticeBadgeRule = lightUpdateNoticeBadgeRuleMatch[1];
  assert(
    lightUpdateNoticeBadgeRule.includes('--x-lumno-feature-hint-badge-bg: rgba(75, 84, 95, 0.055);') &&
      lightUpdateNoticeBadgeRule.includes('--x-lumno-feature-hint-badge-gloss: rgba(255, 255, 255, 0.28);') &&
      lightUpdateNoticeBadgeRule.includes('--x-lumno-feature-hint-badge-border: rgba(75, 84, 95, 0.09);') &&
      lightUpdateNoticeBadgeRule.includes('0 1px 1px rgba(17, 24, 39, 0.04);'),
    'light update notice badge should keep the material subtle, not pillowy'
  );
  const darkUpdateNoticeSweepRuleMatch = updateNoticeCss.match(
    /body\[data-theme="dark"\] \.x-lumno-feature-hint--update-notice,[\s\S]*?\.x-lumno-feature-hint--update-notice-overlay\[data-theme="dark"\] \{([\s\S]*?)\n\}/
  );
  assert(darkUpdateNoticeSweepRuleMatch, 'dark update notice should own a scoped badge sweep override');
  const darkUpdateNoticeSweepRule = darkUpdateNoticeSweepRuleMatch[1];
  assert(
    darkUpdateNoticeSweepRule.includes('--x-lumno-feature-hint-sweep-edge: rgba(255, 255, 255, 0.025);') &&
      darkUpdateNoticeSweepRule.includes('--x-lumno-feature-hint-sweep-core: rgba(255, 255, 255, 0.09);') &&
      darkUpdateNoticeSweepRule.includes('--x-lumno-feature-hint-sweep-line: rgba(255, 255, 255, 0.14);'),
    'dark update notice badge sweep should be subtler than the generic dark feature hint sweep'
  );
  const darkUpdateNoticeBadgeRuleMatch = updateNoticeCss.match(
    /body\[data-theme="dark"\] \.x-lumno-feature-hint--update-notice \.x-lumno-feature-hint__badge,[\s\S]*?\.x-lumno-feature-hint--update-notice-overlay\[data-theme="dark"\] \.x-lumno-feature-hint__badge \{([\s\S]*?)\n\}/
  );
  assert(darkUpdateNoticeBadgeRuleMatch, 'dark update notice badge should override the light badge material on the badge element');
  const darkUpdateNoticeBadgeRule = darkUpdateNoticeBadgeRuleMatch[1];
  assert(
    darkUpdateNoticeBadgeRule.includes('--x-lumno-feature-hint-badge-gloss: rgba(255, 255, 255, 0.07);') &&
      darkUpdateNoticeBadgeRule.includes('--x-lumno-feature-hint-badge-border: rgba(255, 255, 255, 0.1);') &&
      darkUpdateNoticeBadgeRule.includes('0 1px 1px rgba(0, 0, 0, 0.14);'),
    'dark update notice badge should keep material contrast without making the sweep brighter'
  );
  assert(
    updateNoticeCss.includes('.x-lumno-feature-hint__badge-icon[data-icon-type="text"]') &&
      updateNoticeCss.includes('width: 22px;') &&
      updateNoticeCss.includes('padding-inline-start: 4px;') &&
      updateNoticeCss.includes('justify-content: flex-end;'),
    'text badge icons should reserve visual space before wide emoji glyphs'
  );
  const featureHintsSource = fs.readFileSync('src/shared/feature-hints.js', 'utf8');
  const featureHintViewSource = fs.readFileSync('react-src/shared/feature-hint-view.tsx', 'utf8');
  const updateNoticeSource = fs.readFileSync('src/shared/update-notice.js', 'utf8');
  assert(
    updateNoticeSource.includes("badgeIconText: '🦋'") &&
      featureHintsSource.includes('definition.badgeIconText') &&
      featureHintViewSource.includes('data-icon-type="text"'),
    'update notice butterfly should use the component badge icon slot'
  );

  const firstDismissKey = updateNotice.getUpdateNoticeDismissKey(featureHints, '0.9.10');
  const nextDismissKey = updateNotice.getUpdateNoticeDismissKey(featureHints, '0.9.11');
  assert.strictEqual(
    updateNotice.UPDATE_NOTICE_ENABLED_STORAGE_KEY,
    '_x_extension_update_notice_enabled_2026_unique_',
    'update notice module should expose the synced enablement preference key'
  );
  assert(firstDismissKey.includes('update_notice'), 'dismiss key should be scoped to the update notice');
  assert.notStrictEqual(firstDismissKey, nextDismissKey, 'dismiss key should change per version');

  const syncStore = {
    [updateNotice.UPDATE_NOTICE_STORAGE_KEY]: normalized
  };
  const chromeApi = createStorageBackedChrome({}, syncStore, '0.9.10');
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
    getRiSvg() {
      return '';
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
    getRiSvg() {
      return '';
    }
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
    getRiSvg() {
      return '';
    }
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
    [updateNotice.UPDATE_NOTICE_STORAGE_KEY]: normalized,
    [updateNotice.UPDATE_NOTICE_ENABLED_STORAGE_KEY]: false
  };
  const disabledChromeApi = createStorageBackedChrome({}, disabledStore, '0.9.10');
  const disabledController = updateNotice.createUpdateNotice({
    documentObj: createFakeDocument(),
    featureHints,
    chromeApi: disabledChromeApi,
    t(key, fallback) {
      return fallback;
    },
    getRiSvg() {
      return '';
    }
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
  disabledChromeApi.storage.sync.set({ [updateNotice.UPDATE_NOTICE_ENABLED_STORAGE_KEY]: true }, () => {});
  await flushMicrotasks();
  await flushMicrotasks();
  assert.strictEqual(
    disabledController.element.getAttribute('data-visible'),
    'true',
    'turning the global prompt switch back on should show the current update notice'
  );
  disabledChromeApi.storage.sync.set({ [updateNotice.UPDATE_NOTICE_ENABLED_STORAGE_KEY]: false }, () => {});
  await flushMicrotasks();
  assert.strictEqual(
    disabledController.element.getAttribute('data-visible'),
    'false',
    'turning the global prompt switch off should hide a visible update notice'
  );

  const oldChromeApi = createStorageBackedChrome({}, {
    [updateNotice.UPDATE_NOTICE_STORAGE_KEY]: normalized
  }, '0.9.9');
  const oldController = updateNotice.createUpdateNotice({
    documentObj: createFakeDocument(),
    featureHints,
    chromeApi: oldChromeApi,
    t(key, fallback) {
      return fallback;
    },
    getRiSvg() {
      return '';
    }
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
    [updateNotice.UPDATE_NOTICE_STORAGE_KEY]: updateNotice.normalizeUpdateNoticePayload({
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
    getRiSvg() {
      return '';
    }
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
    missingTitleStore[updateNotice.UPDATE_NOTICE_STORAGE_KEY].title,
    'Minor Bug Fixes',
    'hydrated release title should be persisted for all surfaces'
  );

  firstController.destroy();
  secondController.destroy();
  laterSessionController.destroy();
  disabledController.destroy();
  oldController.destroy();
  hydratedController.destroy();
  assert.strictEqual(chromeApi.storage.onChanged.count, 0, 'destroy should detach storage listeners');

  console.log('update notice tests passed');
})();
