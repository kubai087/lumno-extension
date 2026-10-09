const assert = require('assert');
const { readStylesheet } = require('./helpers/css-tokens');
const fs = require('fs');
const path = require('path');
const { readPageSource } = require('./helpers/page-source');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

require('../src/shared/suggestions-height-layout.js');
require('../src/newtab/layout.js');

const layoutRuntime = globalThis.LumnoNewtabLayout;
const repoRoot = path.resolve(__dirname, '..');
const newtabHtml = readPageSource('newtab.html');
const newtabSource = readNewtabRuntimeSource();
const wallpaperSource = fs.readFileSync(path.join(repoRoot, 'src/newtab/wallpaper.js'), 'utf8');
const newtabRedirectSource = fs.readFileSync(
  path.join(repoRoot, 'src/newtab/lumno-newtab.js'),
  'utf8'
);
const sharedSearchInputCss = readStylesheet('src/shared/search-input.css');
const featureHintsCss = fs.readFileSync(
  path.join(repoRoot, 'src/shared/feature-hints.css'),
  'utf8'
);
const dockReactSource = fs.readFileSync(path.join(repoRoot, 'react-src/newtab/dock.tsx'), 'utf8');

function getCssBlock(source, marker) {
  const markerIndex = source.indexOf(marker);
  assert.ok(markerIndex >= 0, `missing CSS block: ${marker}`);
  const openIndex = source.indexOf('{', markerIndex);
  assert.ok(openIndex >= 0, `missing CSS block opening brace: ${marker}`);
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === '{') {
      depth += 1;
    } else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(markerIndex, index + 1);
      }
    }
  }
  assert.fail(`missing CSS block closing brace: ${marker}`);
}

function testNewtabRedirectFocusHintIsConsumedOnce() {
  assert.match(
    newtabRedirectSource,
    /target\.searchParams\.set\('focus', '1'\);[\s\S]*?window\.location\.replace\(target\.href\);/,
    'the redirect shell should keep the explicit focus handoff for the real New Tab page'
  );
  const recoverySource = newtabSource.slice(
    newtabSource.indexOf('function scheduleAutoFocusRecovery()'),
    newtabSource.indexOf('scheduleAutoFocusRecovery();')
  );
  assert.match(
    recoverySource,
    /let forceInitialFocusPending = hasExplicitFocusHint;[\s\S]*?const focused = tryFocusSearchInput\(forceInitialFocusPending\);[\s\S]*?if \(focused\) \{[\s\S]*?forceInitialFocusPending = false;/,
    'the explicit New Tab focus hint should be consumed after the first successful input focus'
  );
  assert.match(
    recoverySource,
    /url\.searchParams\.delete\('focus'\);[\s\S]*?window\.history\.replaceState\([\s\S]*?if \(consumedExplicitFocusHint\) \{\s*clearExplicitFocusQuery\(\);/,
    'the consumed focus hint should be removed without a second navigation'
  );
  assert.doesNotMatch(
    recoverySource,
    /tryFocusSearchInput\(hasExplicitFocusHint\)/,
    'New Tab retries and lifecycle events should not permanently force focus back to the input'
  );
  assert.match(
    recoverySource,
    /if \(!newtabInputAutoFocusEnabled\) \{\s*return;/,
    'New Tab focus recovery should respect the user-controlled auto-focus preference'
  );
  assert.match(
    newtabSource,
    /initialNewtabInputAutoFocusReadyTask\.then\(\(\) => \{\s*scheduleAutoFocusRecovery\(\);/,
    'New Tab should load the persisted auto-focus preference before scheduling focus recovery'
  );
  assert.match(
    recoverySource,
    /new window\.MutationObserver\([\s\S]*?data-nt-ready[\s\S]*?setTimeout\(attemptFocusIfVisible, 0\)/,
    'New Tab should retry automatic focus when a readiness-gated destination becomes visible'
  );
  const preferenceLoadSource = newtabSource.slice(
    newtabSource.indexOf('function loadNewtabInputAutoFocusEnabled()'),
    newtabSource.indexOf('const initialNewtabInputAutoFocusReadyTask')
  );
  assert.doesNotMatch(
    preferenceLoadSource,
    /storageArea\.set/,
    'loading a missing auto-focus preference should not persist the new default over existing users'
  );
  const preferenceChangeSource = newtabSource.slice(
    newtabSource.indexOf('if (changes[NEWTAB_INPUT_AUTO_FOCUS_ENABLED_STORAGE_KEY])'),
    newtabSource.indexOf('if (changes[RECENT_COUNT_STORAGE_KEY])')
  );
  assert.doesNotMatch(
    preferenceChangeSource,
    /storageArea\.set/,
    'removing the auto-focus preference should restore the default without writing it back'
  );
}

testNewtabRedirectFocusHintIsConsumedOnce();

class FakeStyle {
  constructor() {
    this.props = new Map();
  }

  setProperty(name, value) {
    this.props.set(name, String(value));
  }

  getPropertyValue(name) {
    return this.props.get(name) || '';
  }

  removeProperty(name) {
    this.props.delete(name);
  }
}

class FakeClassList {
  constructor() {
    this.names = new Set();
  }

  add(...names) {
    names.forEach((name) => this.names.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.names.delete(name));
  }

  toggle(name, enabled) {
    if (enabled) {
      this.names.add(name);
    } else {
      this.names.delete(name);
    }
  }

  contains(name) {
    return this.names.has(name);
  }
}

class FakeElement {
  constructor(options) {
    const config = options || {};
    this.style = new FakeStyle();
    this.classList = new FakeClassList();
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.id = '';
    this.className = '';
    this.rect = {
      left: 0,
      top: 0,
      width: 0,
      height: 0,
      bottom: 0,
      ...(config.rect || {})
    };
    this.scrollHeight = Number(config.scrollHeight) || this.rect.height || 0;
    this.computed = {
      display: config.display || 'block',
      'padding-top': config.paddingTop || '0px',
      'padding-bottom': config.paddingBottom || '0px',
      'border-top-width': config.borderTop || '0px',
      'border-bottom-width': config.borderBottom || '0px',
      'margin-top': config.marginTop || '0px',
      'margin-bottom': config.marginBottom || '0px',
      'min-height': config.minHeight || '0px',
      ...(config.computed || {})
    };
    this.computedStyle = {
      get display() {
        return config.display || 'block';
      },
      getPropertyValue: (name) => (
        this.style.getPropertyValue(name) || this.computed[name] || ''
      )
    };
  }

  getBoundingClientRect() {
    const rect = {
      ...this.rect
    };
    rect.bottom = Number.isFinite(rect.bottom) && rect.bottom !== 0
      ? rect.bottom
      : (Number(rect.top) || 0) + (Number(rect.height) || 0);
    return rect;
  }

  setRect(rect) {
    this.rect = {
      ...this.rect,
      ...(rect || {})
    };
    if (Object.prototype.hasOwnProperty.call(rect || {}, 'height')) {
      this.scrollHeight = Number(rect.height) || 0;
    }
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  appendChild(child) {
    if (!child) {
      return child;
    }
    if (child.parentNode && Array.isArray(child.parentNode.children)) {
      child.parentNode.children = child.parentNode.children.filter((item) => item !== child);
    }
    this.children.push(child);
    child.parentNode = this;
    return child;
  }

  addEventListener(type, listener, options) {
    this._listeners = this._listeners || [];
    this._listeners.push({ type, listener, options });
  }

  removeEventListener(type, listener) {
    this._listeners = (this._listeners || []).filter((entry) => (
      entry.type !== type || entry.listener !== listener
    ));
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }
}

function createFixture(options) {
  const config = options || {};
  let animationFrameId = 0;
  let timerId = 0;
  const animationFrames = new Map();
  const timers = new Map();
  const body = new FakeElement({ display: 'flex' });
  const documentElement = new FakeElement();
  const documentObj = {
    body,
    documentElement
  };
  const windowObj = {
    innerHeight: Number(config.innerHeight) || 900,
    innerWidth: Number(config.innerWidth) || 1280,
    visualViewport: null,
    getComputedStyle(element) {
      return element.computedStyle;
    },
    requestAnimationFrame(callback) {
      animationFrameId += 1;
      if (config.deferAnimationFrame) {
        animationFrames.set(animationFrameId, callback);
        return animationFrameId;
      }
      callback();
      return animationFrameId;
    },
    cancelAnimationFrame(id) {
      animationFrames.delete(id);
    },
    setTimeout(callback) {
      timerId += 1;
      timers.set(timerId, callback);
      return timerId;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    matchMedia() {
      return { matches: false };
    }
  };

  const root = new FakeElement({
    rect: { left: 180, top: 200, width: 720, height: 55, ...(config.rootRect || {}) },
    paddingTop: '4px',
    paddingBottom: '4px',
    borderTop: '1px',
    borderBottom: '1px',
    minHeight: '55px'
  });
  const searchLayer = new FakeElement({
    rect: { left: 180, top: 200, width: 720, height: 45 },
    borderTop: '1px',
    borderBottom: '1px',
    minHeight: '45px'
  });
  const inputContainer = new FakeElement({
    rect: { left: 184, top: 204, width: 712, height: 45 }
  });
  const wordmark = new FakeElement({
    rect: { left: 180, top: 98, width: 720, height: 74 },
    marginBottom: '28px',
    scrollHeight: 74
  });
  wordmark.setAttribute('data-visible', 'true');

  const bottomDock = new FakeElement({
    rect: { left: 80, top: 680, width: 920, height: 220 }
  });
  const shortcutSection = new FakeElement({
    rect: { left: 420, top: 270, width: 240, height: 72, ...(config.shortcutRect || {}) }
  });
  const bookmarkSection = new FakeElement();
  const recentSection = new FakeElement();
  const sectionSafeCorridor = new FakeElement();
  shortcutSection.setAttribute('data-visible', config.shortcutVisible ? 'true' : 'false');
  bookmarkSection.setAttribute('data-visible', 'true');
  recentSection.setAttribute('data-visible', 'true');

  const suggestionsContainer = new FakeElement({
    rect: { left: 180, top: 255, width: 720, height: 0 },
    paddingTop: '8px',
    paddingBottom: '12px'
  });
  const suggestionsSurface = new FakeElement();
  const suggestionsOutline = new FakeElement();

  const controller = layoutRuntime.createLayoutController({
    documentObj,
    windowObj,
    root,
    searchLayer,
    inputParts: { container: inputContainer },
    topContentContainer: wordmark,
    shortcutSection,
    bottomDock,
    bookmarkSection,
    recentSection,
    sectionSafeCorridor,
    suggestionsContainer,
    suggestionsSurface,
    suggestionsOutline,
    getTopInsetPx: () => Number(config.topInsetPx) || 0,
    constants: {
      minTopPx: 28,
      minBottomPx: 20,
      upshiftRatio: 0.06,
      upshiftMinPx: 24,
      upshiftMaxPx: 80,
      contentSectionsExtraUpshiftPx: 20,
      emptySectionsExtraUpshiftPx: 96,
      ...(config.constants || {})
    }
  });

  return {
    body,
    bottomDock,
    shortcutSection,
    suggestionsContainer,
    suggestionsSurface,
    suggestionsOutline,
    controller,
    windowObj,
    flushAnimationFrames() {
      const pendingFrames = Array.from(animationFrames.entries());
      animationFrames.clear();
      pendingFrames.forEach(([, callback]) => callback());
    },
    pendingTimerCount() {
      return timers.size;
    },
    pendingAnimationFrameCount() {
      return animationFrames.size;
    }
  };
}

function testPreservesSearchTopDuringRestoreLayoutPass() {
  const { body, bottomDock, controller } = createFixture();

  controller.updateBottomDockLayout();
  const initialTop = body.style.getPropertyValue('padding-top');
  assert.ok(initialTop.endsWith('px'), 'initial layout should set a pixel top');

  bottomDock.setRect({ height: 260 });
  controller.updateBottomDockLayout({ preserveSearchEntryLayout: true });

  assert.strictEqual(
    body.style.getPropertyValue('padding-top'),
    initialTop,
    'restore-time section refreshes should not move the logo/search entry'
  );
}

testPreservesSearchTopDuringRestoreLayoutPass();

function testOccupiedTopSurfaceShiftsMinimumSearchInset() {
  const { body, controller } = createFixture({
    innerHeight: 460,
    topInsetPx: 36,
    constants: {
      shortViewportMaxHeightPx: 680,
      shortMinTopPx: 44
    }
  });

  controller.updateSearchEntryLayout();

  assert.ok(
    Number.parseFloat(body.style.getPropertyValue('padding-top')) >= 80,
    'short viewports should reserve the occupied top surface plus the normal search gap'
  );
}

testOccupiedTopSurfaceShiftsMinimumSearchInset();

function testOccupiedTopSurfaceUpshiftsDesktopSearchPosition() {
  const regular = createFixture({
    innerHeight: 900
  });
  const withTopbar = createFixture({
    innerHeight: 900,
    topInsetPx: 36
  });

  regular.controller.updateSearchEntryLayout();
  withTopbar.controller.updateSearchEntryLayout();

  assert.strictEqual(
    Number.parseFloat(regular.body.style.getPropertyValue('padding-top')) -
      Number.parseFloat(withTopbar.body.style.getPropertyValue('padding-top')),
    36,
    'a desktop top bar should pull the logo and search entry upward by its capped occupied height'
  );
}

testOccupiedTopSurfaceUpshiftsDesktopSearchPosition();

function testNarrowTopInsetTransitionsWithoutBreakpointJump() {
  function getSearchTop(viewportWidth) {
    const { body, controller } = createFixture({
      innerWidth: viewportWidth,
      innerHeight: 900,
      constants: {
        narrowViewportMinWidthPx: 520,
        narrowViewportMaxWidthPx: 1440,
        narrowTopInsetPx: 16,
        narrowTopInsetTransitionPx: 64
      }
    });
    controller.updateSearchEntryLayout();
    return Number.parseFloat(body.style.getPropertyValue('padding-top'));
  }

  const boundaryTops = [1441, 1440, 1439, 1438, 1437, 1436]
    .map(getSearchTop);
  for (let index = 1; index < boundaryTops.length; index += 1) {
    assert.ok(
      Math.abs(boundaryTops[index] - boundaryTops[index - 1]) <= 1,
      'narrow desktop entry should move by at most one pixel per viewport pixel near the breakpoint'
    );
  }
  assert.strictEqual(
    getSearchTop(1376) - getSearchTop(1441),
    16,
    'narrow desktop entry should still receive the full inset after the transition band'
  );
}

testNarrowTopInsetTransitionsWithoutBreakpointJump();

function testSuggestionResultsCommitNaturalHeightWithoutTween() {
  const {
    controller,
    suggestionsContainer,
    suggestionsOutline,
    suggestionsSurface
  } = createFixture();
  suggestionsContainer.setAttribute('data-height-clipped', 'true');
  suggestionsContainer.setAttribute('data-input-height-locked', 'true');
  suggestionsContainer.setAttribute('data-resizing', 'true');
  suggestionsContainer.style.setProperty('height', '236px');
  suggestionsContainer.style.setProperty('overflow-y', 'hidden');
  suggestionsContainer.style.setProperty('padding-top', '8px');
  suggestionsContainer.style.setProperty('padding-bottom', '12px');
  suggestionsContainer.style.setProperty('transition', 'height 180ms ease');
  suggestionsContainer.style.setProperty('will-change', 'height');
  suggestionsSurface.style.setProperty('transition', 'height 180ms ease');
  suggestionsSurface.style.setProperty('will-change', 'height');
  suggestionsOutline.style.setProperty('transition', 'height 180ms ease');
  suggestionsOutline.style.setProperty('will-change', 'height');

  assert.strictEqual(
    controller.commitSuggestionsNaturalHeightAfterRender(),
    true,
    'rendered New Tab results should publish their natural height in the same commit'
  );
  ['data-height-clipped', 'data-input-height-locked', 'data-resizing']
    .forEach((attribute) => {
      assert.strictEqual(suggestionsContainer.getAttribute(attribute), null);
    });
  ['height', 'overflow-y', 'padding-top', 'padding-bottom', 'will-change']
    .forEach((property) => {
      assert.strictEqual(
        suggestionsContainer.style.getPropertyValue(property),
        '',
        `${property} should not constrain the natural result height`
      );
    });
  assert.strictEqual(
    suggestionsContainer.style.getPropertyValue('transition'),
    'none',
    'New Tab should explicitly reject a result-container height tween'
  );
  [suggestionsSurface, suggestionsOutline].forEach((element) => {
    assert.strictEqual(element.style.getPropertyValue('transition'), '');
    assert.strictEqual(element.style.getPropertyValue('will-change'), '');
  });
}

testSuggestionResultsCommitNaturalHeightWithoutTween();

assert.match(
  newtabHtml,
  /max-height:\s*min\([\s\S]*?--x-nt-suggestions-max-height[\s\S]*?--x-nt-suggestions-viewport-fit-max-height[\s\S]*?--x-nt-suggestions-menu-fit-max-height/,
  'new-tab suggestions should combine content, viewport, and open scope-panel height limits'
);

assert.match(
  newtabSource,
  /function shouldPreserveSearchModeResults\(rawQuery\) \{\s*return Boolean\(String\(rawQuery \|\| ''\)\.trim\(\)\);\s*\}[\s\S]*?const preserveResults = shouldPreserveSearchModeResults\(rawQuery\)/,
  'scope switches should keep old rows until the replacement renders without starting a height session'
);
assert.match(
  newtabSource,
  /const preserveResults = shouldPreserveSearchModeResults\(rawQuery\);[\s\S]*?activateLocalSearchScope\([\s\S]*?\{ preserveResults \}[\s\S]*?activateSiteSearch\(item\.provider, \{ preserveResults \}\)/,
  'every non-empty scope switch should preserve the old result frame until the target renders'
);
assert.match(
  newtabSource,
  /function activateLocalSearchScope\(scope, activationOptions\)[\s\S]*?if \(options\.preserveResults !== true\) \{\s*clearSearchSuggestions\(\);\s*\}[\s\S]*?function activateSiteSearch\(provider, activationOptions\)[\s\S]*?if \(options\.preserveResults !== true\) \{\s*clearSearchSuggestions\(\);\s*\}/,
  'local and provider activation should both avoid clearing a preserved result frame'
);
assert.doesNotMatch(
  `${newtabSource}\n${fs.readFileSync(path.join(repoRoot, 'src/newtab/layout.js'), 'utf8')}`,
  /beginSuggestionsInputSession|captureSuggestionsResizeState|animateSuggestionsResize|holdSuggestionsInputHeight|settleHeightAfterRemoteMix|setSuggestionsResizeLifecycle/,
  'New Tab should not capture, lock, defer, or animate result height'
);


function testNewtabLoadsAndUsesDockRuntime() {
  const newtabJs = readNewtabRuntimeSource();
  assert.ok(
    !newtabHtml.includes('<script src="dock.js"></script>') &&
      newtabHtml.includes('data-react-entry="../react/newtab-islands.js"'),
    'New Tab should receive its dock implementation from the React entry'
  );
  assert.match(
    newtabJs,
    /const bottomDockRuntime = NEWTAB_DOCK\.createBottomDockRuntime\(/,
    'the browser adapter should create the bottom dock through the React API'
  );
  assert.match(
    dockReactSource,
    /export function createBottomDockRuntime\([\s\S]*?bottomDock\.dataset\.reactIsland = 'newtab-bottom-dock'/,
    'React should own the bottom dock structure and diagnostic marker'
  );
  assert.doesNotMatch(
    newtabJs,
    /document\.createElement\('div'\);\s*bottomDock\.id = '_x_extension_newtab_bottom_dock_2024_unique_'/,
    'newtab should not manually construct bottom dock DOM outside the component runtime'
  );
}

testNewtabLoadsAndUsesDockRuntime();

function testNewtabContainsRootOverscroll() {
  assert.match(
    newtabHtml,
    /html,\s*body\s*\{[\s\S]*?height:\s*100%;[\s\S]*?overscroll-behavior:\s*none;/,
    'newtab root should suppress viewport rubber-band overscroll'
  );
  assert.match(
    newtabHtml,
    /body\s*\{[\s\S]*?overflow-x:\s*hidden;[\s\S]*?overflow-y:\s*auto;/,
    'newtab should retain document scrolling as the initialization and mobile-flow fallback'
  );
  assert.match(
    newtabHtml,
    /body\.x-nt-bottom-layout:not\(\.x-nt-mobile-flow\)\s*\{[\s\S]*?overflow-y:\s*hidden;/,
    'desktop bottom layout should prevent a competing page scrollbar while the dock owns vertical overflow'
  );
  assert.match(
    newtabHtml,
    /\.x-nt-bookmarks-topbar-viewport\s*\{[\s\S]*?overflow-x:\s*auto;[\s\S]*?overscroll-behavior:\s*contain;/,
    'newtab root isolation should preserve topbar scrolling without chaining wheel input to the page'
  );
  assert.match(
    newtabHtml,
    /#_x_extension_newtab_bottom_dock_scroller_2024_unique_\s*\{[\s\S]*?overflow-y:\s*auto;[\s\S]*?overscroll-behavior:\s*contain;/,
    'newtab root isolation should preserve intentional vertical scrolling inside the bottom dock'
  );
}

testNewtabContainsRootOverscroll();

function testTopbarBookmarkTitlesStayReadableUntilWallpaperToneIsReady() {
  assert.match(
    newtabSource,
    /surface:\s*'topbar',[\s\S]*?preferOverlayPolarity:\s*getEffectiveBookmarkTopbarSurfaceMode\(\) === 'adaptive',[\s\S]*?disabled:/,
    'only the default adaptive topbar material should let a meaningful mask define its material polarity'
  );
  assert.match(
    newtabHtml,
    /body\[data-wallpaper-active="true"\] \.x-nt-bookmarks-topbar\[data-surface-mode="adaptive"\],[\s\S]*?--x-nt-bookmarks-topbar-ink:\s*var\(--x-nt-bookmark-title,\s*#111827\);/,
    'topbar bookmark titles should use the theme foreground before wallpaper sampling finishes'
  );
  assert.match(
    newtabHtml,
    /\.x-nt-bookmarks-topbar\[data-wallpaper-ink\]\[data-surface-mode="adaptive"\],[\s\S]*?--x-nt-bookmarks-topbar-ink:\s*var\(--x-nt-wallpaper-adaptive-ink,/,
    'topbar bookmark titles should switch to sampled wallpaper ink once it is available'
  );
}

testTopbarBookmarkTitlesStayReadableUntilWallpaperToneIsReady();

function testBookmarkNavigationHoverSpacingIsOpticallyBalanced() {
  assert.match(
    newtabHtml,
    /\.x-nt-bookmarks-heading\.x-nt-bookmarks-heading--link\s*\{[\s\S]*?padding:\s*3px 5px;[\s\S]*?margin-left:\s*-5px;[\s\S]*?margin-right:\s*-5px;/,
    'the nested bookmark heading should use symmetric inline padding without shifting adjacent controls'
  );
  assert.match(
    newtabHtml,
    /\.x-nt-bookmarks-crumb\s*\{[\s\S]*?padding:\s*0 5px 0 7px;/,
    'bookmark breadcrumb hover targets should use the same optical inline padding compensation'
  );
}

testBookmarkNavigationHoverSpacingIsOpticallyBalanced();

function testCompactDockKeepsSearchEntryClearOnShortViewports() {
  const { bottomDock, controller } = createFixture({
    innerHeight: 620,
    rootRect: { top: 200, height: 55 },
    constants: {
      bottomDockTopReservePx: 240,
      compactDockViewportMaxHeightPx: 800,
      compactDockSearchGapPx: 30,
      compactDockMinTopReservePx: 168
    }
  });

  controller.updateBottomDockLayout();

  assert.strictEqual(
    bottomDock.style.getPropertyValue('max-height'),
    '335px',
    'short viewports should reserve space below the search entry instead of using the fixed 240px dock reserve'
  );
  assert.strictEqual(
    bottomDock.getAttribute('data-density'),
    'compact',
    'short viewports with limited dock space should mark the dock compact'
  );
}

function testTinyDockDensityForVeryShortViewports() {
  const { body, bottomDock, controller } = createFixture({
    innerHeight: 460,
    rootRect: { top: 190, height: 55 },
    constants: {
      bottomDockTopReservePx: 240,
      compactDockViewportMaxHeightPx: 800,
      compactDockSearchGapPx: 30,
      compactDockMinTopReservePx: 168
    }
  });

  controller.updateBottomDockLayout();

  assert.strictEqual(bottomDock.getAttribute('data-density'), 'tiny', 'very short viewports should use the tiny dock density');
  assert.strictEqual(
    body.getAttribute('data-nt-bottom-dock-density'),
    'tiny',
    'body should expose bottom dock density for CSS and future UI affordances'
  );
}

function testShortDockReservesVisibleShortcutRow() {
  const { bottomDock, controller } = createFixture({
    innerHeight: 520,
    rootRect: { top: 93, height: 56 },
    shortcutRect: { top: 161, height: 72 },
    shortcutVisible: true,
    constants: {
      bottomDockTopReservePx: 240,
      compactDockViewportMaxHeightPx: 800,
      compactDockSearchGapPx: 30,
      compactDockShortcutGapPx: 8,
      compactDockMinTopReservePx: 168
    }
  });

  controller.updateBottomDockLayout();

  assert.strictEqual(
    bottomDock.style.getPropertyValue('max-height'),
    '279px',
    'short viewports should reserve room for the visible shortcut row before the bottom dock'
  );
  assert.strictEqual(
    bottomDock.getAttribute('data-density'),
    'compact',
    'reserving shortcut space should still drive dock density from the remaining height'
  );
}

function testWrappedShortcutsDoNotOscillateDockDensity() {
  const {
    bottomDock,
    controller,
    shortcutSection,
    flushAnimationFrames,
    windowObj
  } = createFixture({
    innerHeight: 620,
    rootRect: { top: 120, height: 55 },
    shortcutVisible: true,
    deferAnimationFrame: true,
    constants: {
      bottomDockTopReservePx: 240,
      compactDockViewportMaxHeightPx: 800,
      compactDockSearchGapPx: 30,
      compactDockShortcutGapPx: 8,
      compactDockMinTopReservePx: 168
    }
  });
  shortcutSection.getBoundingClientRect = () => {
    const density = bottomDock.getAttribute('data-density') || 'default';
    const bottom = density === 'compact' ? 240 : 270;
    return {
      left: 420,
      top: 160,
      width: 240,
      height: bottom - 160,
      bottom
    };
  };

  controller.updateBottomDockLayout();
  const densities = [bottomDock.getAttribute('data-density')];
  flushAnimationFrames();
  densities.push(bottomDock.getAttribute('data-density'));
  flushAnimationFrames();
  densities.push(bottomDock.getAttribute('data-density'));

  assert.deepStrictEqual(
    densities,
    ['compact', 'compact', 'compact'],
    'a wrapped default shortcut row must not alternate compact and default dock density'
  );

  controller.updateBottomDockLayout();
  assert.strictEqual(
    bottomDock.getAttribute('data-density'),
    'compact',
    'routine layout refreshes should retain the stabilized density for the same shortcut layout'
  );

  const settledDensities = [];
  controller.updateBottomDockLayout({ releaseDockDensityLock: true });
  settledDensities.push(bottomDock.getAttribute('data-density'));
  flushAnimationFrames();
  settledDensities.push(bottomDock.getAttribute('data-density'));
  flushAnimationFrames();
  settledDensities.push(bottomDock.getAttribute('data-density'));
  assert.deepStrictEqual(
    settledDensities,
    ['compact', 'compact', 'compact'],
    'resize settle should not briefly promote and then compact the dock across painted frames'
  );

  windowObj.innerHeight = 760;
  controller.updateBottomDockLayout();
  flushAnimationFrames();
  assert.strictEqual(
    bottomDock.getAttribute('data-density'),
    'default',
    'a meaningful viewport change should release the density lock when default sizing fits'
  );
}

function testContinuousResizeKeepsDockDensityStableUntilSettle() {
  const {
    bottomDock,
    controller,
    shortcutSection,
    flushAnimationFrames,
    windowObj
  } = createFixture({
    innerHeight: 630,
    rootRect: { top: 120, height: 55 },
    shortcutVisible: true,
    deferAnimationFrame: true,
    constants: {
      bottomDockTopReservePx: 240,
      compactDockViewportMaxHeightPx: 800,
      compactDockSearchGapPx: 30,
      compactDockShortcutGapPx: 8,
      compactDockMinTopReservePx: 168
    }
  });
  shortcutSection.getBoundingClientRect = () => {
    const density = bottomDock.getAttribute('data-density') || 'default';
    const bottom = density === 'compact' ? 240 : 270;
    return {
      left: 420,
      top: 160,
      width: 240,
      height: bottom - 160,
      bottom
    };
  };

  controller.updateBottomDockLayout();
  flushAnimationFrames();
  assert.strictEqual(
    bottomDock.getAttribute('data-density'),
    'compact',
    'the wrapped shortcut layout should stabilize at compact density before resizing'
  );

  const resizeDensities = [];
  for (let index = 0; index < 8; index += 1) {
    windowObj.innerWidth -= 1;
    controller.updateBottomDockLayout({ stabilizeDockDensity: true });
    resizeDensities.push(bottomDock.getAttribute('data-density'));
    flushAnimationFrames();
    resizeDensities.push(bottomDock.getAttribute('data-density'));
  }
  assert.deepStrictEqual(
    resizeDensities,
    Array(resizeDensities.length).fill('compact'),
    'continuous resize frames should not alternate compact and default density'
  );

  windowObj.innerHeight = 760;
  windowObj.innerWidth -= 1;
  controller.updateBottomDockLayout({ stabilizeDockDensity: true });
  flushAnimationFrames();
  assert.strictEqual(
    bottomDock.getAttribute('data-density'),
    'compact',
    'live resize should keep the last compact density even after the viewport grows'
  );

  controller.updateBottomDockLayout({ releaseDockDensityLock: true });
  flushAnimationFrames();
  assert.strictEqual(
    bottomDock.getAttribute('data-density'),
    'default',
    'resize settle should release the density lock and apply the final fitting density once'
  );

  assert.match(
    newtabSource,
    /function handleNewtabResize\(\)[\s\S]*?updateBookmarkSectionPosition\(\{[\s\S]*?preserveSearchEntryLayout:\s*true,[\s\S]*?stabilizeDockDensity:\s*true[\s\S]*?\}\)/,
    'live new-tab resize frames should preserve the search anchor while stabilizing density promotions'
  );
  assert.match(
    newtabSource,
    /preserveSearchEntryLayout:\s*Boolean\(layoutOptions\.preserveSearchEntryLayout\)\s*\|\|\s*newtabResizeLayoutLocked\s*\|\|\s*shouldPreserveSearchEntryLayout\(\)/,
    'all layout refreshes during resize should inherit the search-entry position lock'
  );
  assert.match(
    newtabSource,
    /newtabResizeLayoutLocked\s*=\s*true;[\s\S]*?newtabResizeSettleTimer\s*=\s*window\.setTimeout\([\s\S]*?newtabResizeLayoutLocked\s*=\s*false;[\s\S]*?releaseDockDensityLock:\s*true[\s\S]*?NEWTAB_RESIZE_DENSITY_SETTLE_MS/,
    'new-tab resize should release the search anchor and density stabilization only after resize events settle'
  );
  assert.match(
    newtabSource,
    /const NEWTAB_INITIAL_VIEWPORT_SETTLE_MS = 32;[\s\S]*?const startupViewport = getSearchEntryViewportSnapshot\(\);[\s\S]*?function scheduleNewtabReadyAfterViewportSettle\(\)[\s\S]*?const revealAfterViewportSettles = \(\) => \{[\s\S]*?updateBookmarkSectionPosition\(\{ releaseDockDensityLock: true \}\);[\s\S]*?requestAnimationFrame\(\(\) => \{[\s\S]*?setAttribute\('data-nt-ready', '1'\)[\s\S]*?\};[\s\S]*?if \(viewportRevision === 0 &&\s*!(?:pageState\.)?newtabResizeLayoutLocked &&\s*!hasSearchEntryViewportChanged\(startupViewport\)\) \{\s*revealAfterViewportSettles\(\);\s*return;\s*\}\s*newtabReadySettleTimer = window\.setTimeout\(revealAfterViewportSettles, NEWTAB_INITIAL_VIEWPORT_SETTLE_MS\);/,
    'new-tab content should skip the settle window when the viewport never changed while loading, and still wait one paint frame'
  );
  assert.match(
    newtabSource,
    /window\.addEventListener\('resize',[\s\S]*?newtabReadyViewportRevision\s*\+=\s*1;[\s\S]*?newtabReadyRequested[\s\S]*?scheduleNewtabReadyAfterViewportSettle\(\)/,
    'a browser-chrome resize before first paint should restart the new-tab readiness gate'
  );
}

function testInitialEntryMotionIsStaggeredAndTransient() {
  assert.match(
    newtabSource,
    /const initialLayoutStorageReadyTask = startupStorageReadBatch[\s\S]*?startupStorageReadBatch\.ready[\s\S]*?const initialFontsReadyTask = document\.fonts[\s\S]*?document\.fonts\.ready[\s\S]*?const initialVisualReadyPromise = Promise\.all\(\[[\s\S]*?initialLanguageReadyTask,[\s\S]*?sectionPolicyReadyPromise,[\s\S]*?initialShortcutsReadyTask,[\s\S]*?initialPinnedRecentSitesReadyTask,[\s\S]*?initialHiddenRecentSitesReadyTask,[\s\S]*?initialLayoutStorageReadyTask,[\s\S]*?initialFontsReadyTask[\s\S]*?sectionDataRevision \+= 1;[\s\S]*?loadRecentSites\(\{[\s\S]*?force: true,[\s\S]*?sectionDataRevision: initialSectionDataRevision[\s\S]*?loadBookmarks\(\{[\s\S]*?force: true,[\s\S]*?sectionDataRevision: initialSectionDataRevision[\s\S]*?Promise\.all\(\[recentSitesReadyTask, bookmarksReadyTask\]\)[\s\S]*?markNewtabReady\(\)/,
    'all layout preferences, fonts, shortcuts, and authoritative section data should settle before New Tab becomes visible'
  );
  assert.match(
    newtabSource,
    /function loadBookmarks\(options\)[\s\S]*?requestedSectionDataRevision[\s\S]*?requestedSectionDataRevision !== sectionDataRevision[\s\S]*?function loadRecentSites\(options\)[\s\S]*?requestedSectionDataRevision[\s\S]*?requestedSectionDataRevision !== sectionDataRevision/,
    'late section requests from provisional startup preferences should not overwrite the authoritative first layout'
  );
  assert.doesNotMatch(
    newtabSource,
    /hydrateSectionsFromCache|_x_extension_newtab_(?:recent|bookmark)_cache_2024_unique_/,
    'stale section caches should not paint a provisional dock geometry before authoritative data'
  );
  assert.match(
    newtabSource,
    /function markInitialWallpaperVisualReady\(\)[\s\S]*?setAttribute\('data-nt-wallpaper-ready', '1'\)/,
    'the focused-route wallpaper gate should release independently from full New Tab readiness'
  );
  assert.match(
    newtabHtml,
    /body:not\(\[data-nt-enter="done"\]\) \.x-nt-wallpaper-effect-canvas,\s*body:not\(\[data-nt-enter="done"\]\)::after\s*\{\s*transition:\s*none;/,
    'wallpaper effect layers should stay transition-free throughout the initial entry sequence'
  );
  assert.match(
    newtabHtml,
    /body:not\(\[data-nt-ready="1"\]\) \.x-nt-wallpaper-control,\s*body:not\(\[data-nt-ready="1"\]\) \.x-nt-feedback-control,\s*body:not\(\[data-nt-ready="1"\]\) \.x-nt-bookmark-cascade-debug-control\s*\{\s*visibility:\s*hidden;\s*\}/,
    'corner controls should stay hidden until their entrance animation state is installed'
  );
  assert.doesNotMatch(
    newtabHtml,
    /x-nt-initial-background-veil|_x_nt_background_reveal_2026_unique_/,
    'the initial page should not overlay an extra wallpaper reveal that can flash during entry'
  );
  assert.match(
    wallpaperSource,
    /function createWallpaperTransitionLayer\(\)\s*\{\s*if \(!document\.body \|\|\s*document\.body\.getAttribute\('data-nt-enter'\) !== 'done' \|\|\s*shouldReduceMotion\(\)\)/,
    'wallpaper crossfades should be disabled until the initial entry sequence is complete'
  );
  assert.match(
    wallpaperSource,
    /shouldAnimateTransition:\s*\(\) => Boolean\(\s*documentObj\.body &&\s*documentObj\.body\.getAttribute\('data-nt-enter'\) === 'done'\s*\)/,
    'wallpaper effect rerenders should not fade the background during the initial entry sequence'
  );
  assert.match(
    newtabHtml,
    /body\[data-nt-enter="run"\]\[data-nt-ready="1"\] \.x-nt-bookmarks-topbar\[data-visible="true"\]\s*\{\s*animation:\s*_x_nt_topbar_entry_2026_unique_ 200ms ease-out 20ms both;[\s\S]*?@keyframes _x_nt_topbar_entry_2026_unique_[\s\S]*?opacity:\s*0\.88;[\s\S]*?opacity:\s*1;/,
    'the in-page bookmarks top bar should enter with a restrained opacity transition'
  );
  assert.match(
    newtabSource,
    /function finishNewtabEntryAnimation\(\)[\s\S]*?setAttribute\('data-nt-enter', 'done'\)[\s\S]*?root\.setAttribute\('data-lumno-search-entry', 'done'\)[\s\S]*?function startNewtabEntryAnimation\(\)[\s\S]*?const reduceMotion = shouldSkipNewtabEntryMotion\(\);[\s\S]*?const entryState = reduceMotion \? 'done' : 'run';[\s\S]*?setAttribute\('data-nt-enter', entryState\)[\s\S]*?root\.setAttribute\('data-lumno-search-entry', entryState\)[\s\S]*?window\.setTimeout\(\s*finishNewtabEntryAnimation,[\s\S]*?NEWTAB_ENTRY_ANIMATION_TOTAL_MS/,
    'new-tab entrance motion should drive the shared search-entry state and release it after the sequence'
  );
  // The gate promise lives in newtab.js; the entry motion that resolves it is split out.
  const autoFocusGateMessage =
    'the New Tab feature hint gate should release after normal, interrupted, or reduced-motion entry completion';
  assert.match(newtabSource, /const newtabEntryAnimationReadyPromise = new Promise/, autoFocusGateMessage);
  assert.match(
    newtabSource,
    /function finishNewtabEntryAnimation\(\)[\s\S]*?resolveNewtabEntryAnimationReady\(\)[\s\S]*?function startNewtabEntryAnimation\(\)[\s\S]*?if \(reduceMotion\)[\s\S]*?resolveNewtabEntryAnimationReady\(\)/,
    autoFocusGateMessage
  );
  assert.match(newtabSource, /featureHintVisibilityGate:\s*newtabEntryAnimationReadyPromise/, autoFocusGateMessage);
  assert.match(newtabSource, /definition: 'newtab-webdav-sync',\s*visibilityGate: newtabEntryAnimationReadyPromise/, autoFocusGateMessage);
  assert.match(
    newtabSource,
    /setAttribute\('data-nt-ready', '1'\);\s*startNewtabEntryAnimation\(\);/,
    'the entrance sequence should start only after the viewport-stable ready frame'
  );
  assert.match(
    newtabSource,
    /window\.addEventListener\('keydown', finishNewtabEntryAnimation, true\);\s*window\.addEventListener\('pointerdown', finishNewtabEntryAnimation, true\);/,
    'the initial entrance sequence should yield immediately to keyboard or pointer interaction'
  );
  assert.match(
    newtabHtml,
    /<div id="_x_extension_newtab_root_2024_unique_" class="x-lumno-search-entry"><\/div>/,
    'the new-tab search surface should opt into the shared entry motion'
  );
  assert.match(
    sharedSearchInputCss,
    /\.x-lumno-search-entry\[data-lumno-search-entry="run"\]\s*\{[\s\S]*?animation:\s*_x_lumno_search_entry_2026_unique_[\s\S]*?var\(--x-lumno-search-entry-duration, 240ms\)[\s\S]*?var\(--x-lumno-search-entry-delay, 20ms\) both;[\s\S]*?transform-origin:\s*center center;/,
    'the shared search entry should lead with the new-tab timing and ease-out motion'
  );
  const searchEntryKeyframes = sharedSearchInputCss.match(
    /@keyframes _x_lumno_search_entry_2026_unique_ \{([\s\S]*?)\n\}\n\n@media \(prefers-reduced-motion: reduce\)/
  );
  assert.ok(searchEntryKeyframes, 'the shared search entry keyframes should be present');
  assert.match(
    searchEntryKeyframes[1],
    /0%[\s\S]*?scale:\s*var\(--x-lumno-search-entry-scale-start, 0\.97\) 1;[\s\S]*?100%[\s\S]*?scale:\s*1;/,
    'the search field should expand subtly from the center'
  );
  assert.doesNotMatch(
    newtabHtml,
    /@keyframes _x_(?:nt|lumno)_search_entry_2026_unique_/,
    'the new-tab page should not duplicate the shared search entry keyframes'
  );
  assert.doesNotMatch(
    searchEntryKeyframes[1],
    /translate:/,
    'the search field should not move upward during entry'
  );
  assert.doesNotMatch(
    searchEntryKeyframes[1],
    /filter:\s*blur/,
    'the backdrop-filtered search panel should stay on compositor-only opacity and scale motion'
  );
  [
    '_x_nt_wordmark_enter_2026_unique_',
    '_x_nt_shortcut_entry_2026_unique_',
    '_x_nt_content_section_entry_2026_unique_',
    '_x_nt_corner_control_entry_2026_unique_'
  ].forEach((name) => {
    assert.doesNotMatch(
      getCssBlock(newtabHtml, `@keyframes ${name}`),
      /translate(?:3d|Y)?\s*[:(]/,
      `${name} should preserve its final vertical position throughout entry`
    );
  });
  [
    ['.x-lumno-feature-hint--newtab-wallpaper', 'translateY(-50%)'],
    ['.x-lumno-feature-hint--newtab-ai-quick-jump', 'translateX(-50%)'],
    ['.x-lumno-feature-hint--newtab-tab-switcher', ''],
    ['.x-lumno-feature-hint--newtab-webdav-sync', ''],
    ['.x-lumno-feature-hint--update-notice-newtab', '']
  ].forEach(([selector, allowedPositionTransform]) => {
    const block = getCssBlock(featureHintsCss, selector);
    const transforms = block.match(/translate(?:X|Y)?\([^)]*\)/g) || [];
    assert.deepStrictEqual(
      transforms,
      allowedPositionTransform ? [allowedPositionTransform] : [],
      `${selector} should keep only its fixed positioning transform during entry`
    );
  });
  assert.match(
    newtabHtml,
    /\.x-nt-wallpaper-control:has\(> \.x-lumno-feature-hint\[data-visible="true"\]\)\s*\{\s*z-index:\s*20;/,
    'a visible appearance-button hint should sit above the neighbouring feedback button'
  );
  assert.match(
    newtabHtml,
    /body\[data-nt-enter="run"\] \.x-nt-shortcuts-section\[data-visible="true"\] \.x-nt-shortcut-tile\s*\{[\s\S]*?calc\(80ms \+ \(var\(--x-nt-shortcut-enter-index\) \* 18ms\)\) both;/,
    'shortcut tiles should enter with a tight 18ms stagger'
  );
  assert.match(
    newtabHtml,
    /#_x_extension_newtab_bookmarks_2024_unique_\[data-visible="true"\],\s*body\[data-nt-enter="run"\] #_x_extension_newtab_recent_sites_2024_unique_\[data-visible="true"\]\s*\{[\s\S]*?80ms both;/,
    'bottom content sections should enter together with the shortcut sequence'
  );
  ['const NEWTAB_ENTRY_ANIMATION_TOTAL_MS = 460;', 'const WORDMARK_ENTRY_ANIMATION_TOTAL_MS = 380;'].forEach((budget) => {
    assert.ok(
      newtabSource.includes(budget),
      'the initial entrance choreography should complete within a compact motion budget'
    );
  });
  assert.match(
    sharedSearchInputCss,
    /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.x-lumno-search-entry\[data-lumno-search-entry\]\s*\{[\s\S]*?animation:\s*none;[\s\S]*?filter:\s*none;[\s\S]*?opacity:\s*1;[\s\S]*?scale:\s*1;/,
    'the shared search entrance should be disabled for reduced-motion users'
  );
}

testInitialEntryMotionIsStaggeredAndTransient();

function testMobileViewportReleasesFixedDockLayout() {
  const { body, bottomDock, controller } = createFixture({
    innerWidth: 375,
    innerHeight: 667,
    constants: {
      mobileFlowBreakpointPx: 640
    }
  });
  body.style.setProperty('padding-top', '120px');
  bottomDock.style.setProperty('max-height', '427px');

  controller.updateBottomDockLayout();

  assert.strictEqual(body.classList.contains('x-nt-mobile-flow'), true);
  assert.strictEqual(body.getAttribute('data-nt-bottom-dock-density'), 'mobile');
  assert.strictEqual(bottomDock.getAttribute('data-layout'), 'flow');
  assert.strictEqual(bottomDock.style.getPropertyValue('max-height'), '');
  // Logo 74 + search 57, centered in 667 - 220 dock and lifted 4% of that space.
  assert.strictEqual(
    body.style.getPropertyValue('padding-top'),
    `${Math.round(((667 - 220) - (74 + 57)) / 2 - (667 - 220) * 0.04)}px`,
    'mobile should center the logo and search in the space above the dock'
  );
}

function testMobileSearchEntryCountsShortcutsAndFallsBackToMinimumTop() {
  const { body, controller } = createFixture({
    innerWidth: 375,
    innerHeight: 667,
    shortcutVisible: true,
    shortcutRect: { height: 220 },
    constants: {
      mobileFlowBreakpointPx: 640
    }
  });

  controller.updateBottomDockLayout();

  const withShortcuts = Number.parseFloat(body.style.getPropertyValue('padding-top'));
  assert.strictEqual(
    withShortcuts,
    48,
    'mobile content taller than the space above the dock should fall back to the minimum top'
  );
}

function testMobileSearchEntryReservesOccupiedTopSurface() {
  const { body, controller } = createFixture({
    innerWidth: 375,
    innerHeight: 667,
    topInsetPx: 52,
    shortcutVisible: true,
    shortcutRect: { height: 220 },
    constants: {
      mobileFlowBreakpointPx: 640
    }
  });

  controller.updateBottomDockLayout();

  assert.strictEqual(
    body.style.getPropertyValue('padding-top'),
    '64px',
    'mobile minimum top should clear the bookmark top bar plus a gap'
  );
}

function testMobileSearchEntryHoldsStillWhileSuggestionsAreOpen() {
  const { body, bottomDock, controller } = createFixture({
    innerWidth: 375,
    innerHeight: 667,
    constants: {
      mobileFlowBreakpointPx: 640
    }
  });

  controller.updateBottomDockLayout();
  const initialTop = body.style.getPropertyValue('padding-top');
  body.setAttribute('data-nt-suggestions-open', 'true');
  bottomDock.setRect({ height: 120 });
  controller.updateSearchEntryLayout();

  assert.strictEqual(
    body.style.getPropertyValue('padding-top'),
    initialTop,
    'the soft keyboard and suggestions should not move the search entry'
  );
}

function testResizeOutOfMobileRestoresFixedDockLayout() {
  const { body, bottomDock, controller, windowObj } = createFixture({
    innerWidth: 375,
    innerHeight: 667,
    constants: {
      mobileFlowBreakpointPx: 640
    }
  });

  controller.updateBottomDockLayout();
  windowObj.innerWidth = 1024;
  controller.updateBottomDockLayout();

  assert.strictEqual(body.classList.contains('x-nt-mobile-flow'), false);
  assert.strictEqual(bottomDock.getAttribute('data-layout'), 'fixed');
  assert.match(bottomDock.style.getPropertyValue('max-height'), /^\d+px$/);
  assert.match(body.style.getPropertyValue('padding-top'), /^\d+px$/);
}

function testBottomDockCssDefinesAdaptiveDensityVariables() {
  assert.match(
    newtabHtml,
    /#_x_extension_newtab_bottom_dock_2024_unique_\s*\{[\s\S]*?--x-nt-dock-bookmark-card-height:\s*51px;[\s\S]*?--x-nt-dock-recent-inner-height:\s*104px;/,
    'bottom dock should define default adaptive sizing tokens'
  );
  assert.match(
    newtabHtml,
    /#_x_extension_newtab_bottom_dock_2024_unique_\[data-density="compact"\]\s*\{[\s\S]*?--x-nt-dock-bookmark-card-height:\s*44px;[\s\S]*?--x-nt-dock-recent-inner-height:\s*86px;/,
    'compact bottom dock density should reduce recent and bookmark card heights'
  );
  assert.match(
    newtabHtml,
    /#_x_extension_newtab_bottom_dock_2024_unique_\[data-density="tiny"\]\s*\{[\s\S]*?--x-nt-dock-bookmark-card-height:\s*40px;[\s\S]*?--x-nt-dock-recent-inner-height:\s*72px;/,
    'tiny bottom dock density should aggressively reduce card heights'
  );
  assert.match(
    newtabHtml,
    /\.x-nt-bookmark-card\s*\{[\s\S]*?height:\s*var\(--x-nt-dock-bookmark-card-height,\s*51px\);[\s\S]*?padding:\s*var\(--x-nt-dock-bookmark-card-padding,\s*13px 15px\);/,
    'bookmark cards should consume adaptive dock sizing tokens'
  );
  assert.match(
    newtabHtml,
    /\.x-nt-folder-preview\s*\{[\s\S]*?margin-right:\s*-2px;[\s\S]*?\.x-nt-bookmark-card--folder\.x-nt-bookmark-card--folder-expanded \.x-nt-folder-preview\s*\{[\s\S]*?padding:\s*2px 0 2px 3px;/,
    'folder preview favicons should align their right edge while preserving left-side rotation clearance'
  );
  assert.match(
    newtabHtml,
    /\.x-nt-recent-inner\s*\{[\s\S]*?padding:\s*var\(--x-nt-dock-recent-inner-padding,\s*13px 13px 14px 15px\);[\s\S]*?height:\s*var\(--x-nt-dock-recent-inner-height,\s*104px\);/,
    'recent cards should consume adaptive dock sizing tokens'
  );
  assert.match(
    newtabHtml,
    /body\[data-nt-bottom-dock-density="compact"\]\s*\{[\s\S]*?--x-nt-shortcuts-reserved-height:\s*54px;[\s\S]*?--x-nt-shortcut-icon-size:\s*min\(var\(--x-nt-shortcut-user-icon-size\),\s*36px\);/,
    'compact dock density should also reduce the shortcut dock footprint'
  );
  assert.match(
    newtabHtml,
    /body\[data-nt-bottom-dock-density="tiny"\]\s*\{[\s\S]*?--x-nt-shortcuts-reserved-height:\s*42px;[\s\S]*?--x-nt-shortcut-icon-size:\s*min\(var\(--x-nt-shortcut-user-icon-size\),\s*28px\);/,
    'tiny dock density should aggressively reduce shortcut dock footprint'
  );
  assert.match(
    newtabHtml,
    /@media \(max-width:\s*520px\)[\s\S]*?#_x_extension_newtab_bookmarks_2024_unique_,\s*#_x_extension_newtab_recent_sites_2024_unique_\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?width:\s*min\(96vw, var\(--x-nt-content-max-width,\s*1040px\)\);/,
    'phone viewports should not force 500px content sections that create horizontal scrolling'
  );
  assert.match(
    newtabHtml,
    /@media \(max-width:\s*640px\)[\s\S]*?body\.x-nt-mobile-flow\s*\{[\s\S]*?min-height:\s*100dvh;[\s\S]*?padding-inline:[\s\S]*?safe-area-inset-left[\s\S]*?overflow-y:\s*auto;/,
    'mobile flow should use one safe-area-aware document scroller'
  );
  assert.match(
    newtabHtml,
    /@media \(max-width:\s*640px\)[\s\S]*?#_x_extension_newtab_bottom_dock_2024_unique_\s*\{[\s\S]*?position:\s*static;[\s\S]*?transform:\s*none;[\s\S]*?max-height:\s*none;/,
    'mobile bottom dock should participate in document flow'
  );
  assert.match(
    newtabHtml,
    /@media \(max-width:\s*640px\)[\s\S]*?#_x_extension_newtab_bottom_dock_scroller_2024_unique_\s*\{[\s\S]*?max-height:\s*none;[\s\S]*?overflow:\s*visible;[\s\S]*?overscroll-behavior:\s*auto;/,
    'mobile dock content should release its nested scroll container'
  );
  assert.match(
    newtabHtml,
    /@media \(max-width:\s*640px\)[\s\S]*?#_x_extension_newtab_bookmarks_grid_2024_unique_\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
    'mobile bookmarks should render two columns'
  );
  assert.match(
    newtabHtml,
    /@media \(max-width:\s*640px\)[\s\S]*?#_x_extension_newtab_recent_sites_grid_2024_unique_\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
    'mobile recent sites should render two columns'
  );
  assert.match(
    newtabHtml,
    /@media \(max-width:\s*640px\)[\s\S]*?\.x-nt-wallpaper-button,\s*\.x-nt-feedback-button\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/,
    'mobile utility controls should meet the 44px touch target'
  );
  assert.match(
    newtabHtml,
    /@media \(hover:\s*none\)[\s\S]*?\.x-nt-recent-card:hover\s*\{[\s\S]*?transform:\s*none;/,
    'touch input should not retain hover-only recent-card movement'
  );
  assert.match(
    newtabHtml,
    /@media \(hover:\s*none\)[\s\S]*?\.x-nt-recent-card:hover \.x-nt-recent-card-visual\s*\{[\s\S]*?transform:\s*none;[\s\S]*?box-shadow:\s*var\(--x-nt-recent-card-shadow\);/,
    'touch input should keep the recent-card visual layer stationary'
  );
  assert.match(
    newtabHtml,
    /@media \(hover:\s*none\)[\s\S]*?\.x-nt-recent-card:hover \.x-nt-recent-inner\s*\{[\s\S]*?height:\s*var\(--x-nt-dock-recent-inner-height,\s*104px\);[\s\S]*?transform:\s*none;[\s\S]*?margin-bottom:\s*0;/,
    'touch input should not retain hover-only recent-card expansion'
  );
  assert.match(
    newtabHtml,
    /@media \(hover:\s*none\)[\s\S]*?\.x-nt-wallpaper-button,\s*\.x-nt-feedback-button\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/,
    'touch input should keep fixed utility controls at least 44px square'
  );
  assert.match(
    newtabHtml,
    /@media \(min-width:\s*641px\) and \(max-width:\s*900px\) and \(max-height:\s*560px\)[\s\S]*?body\[data-nt-bottom-dock-density="tiny"\]\s*\{[\s\S]*?--x-nt-shortcuts-reserved-height:\s*50px;[\s\S]*?--x-nt-shortcut-tile-size:\s*min\(var\(--x-nt-shortcut-user-tile-size\),\s*44px\);[\s\S]*?#_x_extension_newtab_bottom_dock_2024_unique_\[data-density="tiny"\]\s*\{[\s\S]*?--x-nt-dock-bookmark-card-height:\s*44px;[\s\S]*?\.x-nt-wallpaper-button,\s*\.x-nt-feedback-button\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/,
    'narrow landscape should not let tiny density shrink interactive rows below 44px'
  );
  assert.match(
    newtabHtml,
    /@media \(max-width:\s*640px\)[\s\S]*?:root\s*\{[\s\S]*?--x-nt-section-inner-gap:\s*10px;[\s\S]*?--x-nt-grid-row-gap:\s*8px;[\s\S]*?--x-nt-bottom-dock-section-gap:\s*10px;[\s\S]*?--x-nt-bottom-dock-corridor-size:\s*0px;[\s\S]*?--x-nt-bottom-dock-top-padding:\s*12px;[\s\S]*?--x-nt-bottom-dock-bottom-padding:\s*calc\(72px \+ env\(safe-area-inset-bottom\)\);/,
    'mobile flow should use the compact vertical spacing budget'
  );
  assert.match(
    newtabHtml,
    /@media \(max-width:\s*640px\)[\s\S]*?body\.x-nt-mobile-flow\s*\{[\s\S]*?padding-top:\s*max\([\s\S]*?48px,[\s\S]*?var\(--x-nt-top-occupied-inset,[\s\S]*?env\(safe-area-inset-top\)[\s\S]*?\);[\s\S]*?padding-inline:\s*max\(24px,\s*env\(safe-area-inset-left\)\)\s*max\(24px,\s*env\(safe-area-inset-right\)\);/,
    'mobile flow should keep its touch inset while respecting an occupied top surface'
  );
  assert.match(
    newtabHtml,
    /@media \(max-width:\s*640px\)[\s\S]*?:root\s*\{[\s\S]*?--x-nt-shortcuts-reserved-height:\s*64px;[\s\S]*?--x-nt-shortcuts-section-margin-top:\s*10px;[\s\S]*?--x-nt-shortcut-tile-size:\s*min\(var\(--x-nt-shortcut-user-tile-size\),\s*52px\);[\s\S]*?--x-nt-shortcut-icon-size:\s*min\(var\(--x-nt-shortcut-user-icon-size\),\s*40px\);/,
    'mobile shortcuts should use the compact touch-safe footprint'
  );
  assert.match(
    newtabHtml,
    /@media \(max-width:\s*640px\)[\s\S]*?#_x_extension_newtab_bottom_dock_2024_unique_\s*\{[\s\S]*?margin-top:\s*auto;/,
    'mobile dock should rest at the bottom of the first screen'
  );
  assert.match(
    newtabHtml,
    /#_x_extension_newtab_bottom_dock_2024_unique_\[data-density="mobile"\]\s*\{[\s\S]*?--x-nt-dock-bookmark-card-height:\s*44px;[\s\S]*?--x-nt-dock-recent-card-padding:\s*6px 6px 8px;[\s\S]*?--x-nt-dock-recent-card-gap:\s*6px;[\s\S]*?--x-nt-dock-recent-inner-height:\s*82px;[\s\S]*?--x-nt-dock-recent-inner-hover-height:\s*82px;/,
    'mobile density should compact cards without dropping below touch size'
  );
  assert.match(
    newtabHtml,
    /@media \(max-width:\s*640px\)[\s\S]*?\.x-nt-wallpaper-control,\s*\.x-nt-feedback-control\s*\{[\s\S]*?bottom:\s*max\(10px,\s*env\(safe-area-inset-bottom\)\);/,
    'mobile utility controls should clear the bottom safe area'
  );
  assert.match(
    newtabHtml,
    /@media \(max-width:\s*640px\)[\s\S]*?\.x-nt-wallpaper-button\s*\{[\s\S]*?background:\s*var\(--control-bg\);[\s\S]*?border-color:\s*var\(--tab-border\);[\s\S]*?backdrop-filter:\s*blur\(16px\);/,
    'mobile appearance trigger should stay visually distinct over wallpaper content'
  );
  assert.match(
    newtabHtml,
    /@media \(max-width:\s*640px\)[\s\S]*?\.x-nt-wallpaper-panel\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?left:\s*max\(12px,\s*env\(safe-area-inset-left\)\);[\s\S]*?right:\s*max\(12px,\s*env\(safe-area-inset-right\)\);[\s\S]*?bottom:\s*calc\(max\(12px,\s*env\(safe-area-inset-bottom\)\) \+ 56px\);[\s\S]*?width:\s*auto;[\s\S]*?max-width:\s*none;[\s\S]*?max-height:\s*min\([\s\S]*?calc\(100dvh - 100px - var\(--x-nt-top-safe-inset\) - var\(--x-nt-bottom-safe-inset\)\),[\s\S]*?calc\(100dvh - 80px - var\(--x-nt-top-occupied-inset\) - var\(--x-nt-bottom-safe-inset\)\)[\s\S]*?\);[\s\S]*?padding:\s*16px;[\s\S]*?\.x-nt-wallpaper-panel-scroll\s*\{[\s\S]*?scrollbar-gutter:\s*auto;/,
    'mobile wallpaper panel should be safe-area aware and independently scrollable'
  );
}

testCompactDockKeepsSearchEntryClearOnShortViewports();
testTinyDockDensityForVeryShortViewports();
testShortDockReservesVisibleShortcutRow();
testWrappedShortcutsDoNotOscillateDockDensity();
testContinuousResizeKeepsDockDensityStableUntilSettle();
testMobileViewportReleasesFixedDockLayout();
testMobileSearchEntryCountsShortcutsAndFallsBackToMinimumTop();
testMobileSearchEntryReservesOccupiedTopSurface();
testMobileSearchEntryHoldsStillWhileSuggestionsAreOpen();
testResizeOutOfMobileRestoresFixedDockLayout();
testBottomDockCssDefinesAdaptiveDensityVariables();

function testAdaptiveGridUsesMobileTierBeforeCompactTier() {
  const config = {
    mobileBreakpointPx: 640,
    mobileColumns: 1,
    compactBreakpointPx: 860,
    compactColumns: 2,
    contentMaxWidth: 1040,
    targetColumnWidth: 248,
    gap: 12,
    minColumns: 4,
    maxColumns: 6
  };

  assert.strictEqual(
    layoutRuntime.getAdaptiveGridColumnCount({ ...config, viewportWidth: 375 }),
    1,
    'phone viewports should use one data column'
  );
  assert.strictEqual(
    layoutRuntime.getAdaptiveGridColumnCount({ ...config, viewportWidth: 768 }),
    2,
    'compact tablet viewports should retain two data columns'
  );
}

testAdaptiveGridUsesMobileTierBeforeCompactTier();

function testNewtabUsesDistinctMobileGridColumns() {
  const newtabJs = readNewtabRuntimeSource();
  const bookmarkColumnsSource = newtabJs.slice(
    newtabJs.indexOf('function getBookmarkGridColumnCount()'),
    newtabJs.indexOf('function getNewtabWidthModeBaseConfig()')
  );
  const recentColumnsSource = newtabJs.slice(
    newtabJs.indexOf('function getRecentGridColumnCount()'),
    newtabJs.indexOf('function clearPageNoticeQueryParam()')
  );

  assert.match(bookmarkColumnsSource, /mobileColumns:\s*2,/);
  assert.match(recentColumnsSource, /mobileColumns:\s*2,/);
}

testNewtabUsesDistinctMobileGridColumns();

function testBookmarkPagerSharesAdaptiveToneWithItsModeTrigger() {
  const adaptiveTargetsSource = newtabSource.slice(
    newtabSource.indexOf('function createWallpaperAdaptiveToneTargets()'),
    newtabSource.indexOf('  wallpaperRuntime = NEWTAB_WALLPAPER.createWallpaperRuntime({')
  );
  assert.doesNotMatch(
    adaptiveTargetsSource,
    /element:\s*bookmarkModeMenu\s*&&\s*bookmarkModeMenu\.control/,
    'bookmark mode trigger should not get an independent wallpaper tone target'
  );
  assert.match(
    adaptiveTargetsSource,
    /element:\s*bookmarkPager,[\s\S]*?sampleElement:\s*bookmarkPager,[\s\S]*?iconButton:\s*true/,
    'bookmark pager should remain the shared adaptive tone target for its controls'
  );
  assert.match(
    newtabHtml,
    /\[data-wallpaper-icon-bg="true"\] \.x-nt-section-mode-select\s+\.\_x_extension_select_trigger_2024_unique_/,
    'mode trigger should inherit the shared wallpaper tone from its ancestor surface'
  );
}

testBookmarkPagerSharesAdaptiveToneWithItsModeTrigger();

function testBookmarkColumnPreferenceRemainsAnAdaptiveMaximum() {
  const config = {
    mobileBreakpointPx: 640,
    mobileColumns: 2,
    compactBreakpointPx: 860,
    compactColumns: 2,
    contentMaxWidth: 1548,
    targetColumnWidth: 154,
    gap: 12,
    minColumns: 2,
    maxColumns: 7
  };

  assert.strictEqual(
    layoutRuntime.getAdaptiveGridColumnCount({ ...config, viewportWidth: 1600 }),
    7,
    'wide screens should use the selected maximum when it fits'
  );
  assert.strictEqual(
    layoutRuntime.getAdaptiveGridColumnCount({ ...config, viewportWidth: 1000 }),
    5,
    'medium screens should reduce the selected maximum to the available width'
  );
  assert.strictEqual(
    layoutRuntime.getAdaptiveGridColumnCount({ ...config, viewportWidth: 390 }),
    2,
    'phone screens should keep the mobile adaptive tier'
  );
}

testBookmarkColumnPreferenceRemainsAnAdaptiveMaximum();

function testBookmarkGridDefaultsToSixColumns() {
  const optionsJs = fs.readFileSync(path.join(repoRoot, 'src/options/options.js'), 'utf8');
  const optionsHtml = readPageSource('src/options/options.html');
  const settingsSource = fs.readFileSync(path.join(repoRoot, 'src/shared/settings.js'), 'utf8');
  const onboardingHtml = readPageSource('src/onboarding/onboarding.html');

  assert.match(newtabSource, /let currentBookmarkColumns = 6;/);
  assert.match(
    newtabSource,
    /function normalizeBookmarkColumns\(value\) \{[\s\S]*?SETTINGS\.normalizeBookmarkColumns/
  );
  assert.match(
    newtabHtml,
    /--x-nt-bookmark-columns, 6\)/
  );
  assert.match(
    optionsJs,
    /function normalizeBookmarkColumns\(value\) \{[\s\S]*?SETTINGS\.normalizeBookmarkColumns/
  );
  assert.match(
    optionsHtml,
    /id="_x_extension_bookmark_columns_control_2026_unique_"/
  );
  assert.match(
    optionsHtml,
    /id="_x_extension_bookmark_rows_setting_row_2026_unique_"[\s\S]*?data-i18n="settings_bookmarks_title">书签行数<[\s\S]*?id="_x_extension_bookmark_rows_info_2026_unique_"[\s\S]*?id="_x_extension_bookmark_rows_control_2026_unique_"/
  );
  assert.doesNotMatch(optionsHtml, /id="_x_extension_bookmark_count_select_2024_unique_"/);
  assert.match(
    optionsHtml,
    /id="_x_extension_bookmark_columns_setting_row_2026_unique_"[\s\S]*?data-i18n="settings_bookmark_columns_title">书签每行数量<[\s\S]*?id="_x_extension_bookmark_columns_info_2026_unique_"[\s\S]*?id="_x_extension_bookmark_columns_control_2026_unique_"/
  );
  assert.strictEqual(
    (optionsHtml.match(/id="_x_extension_bookmark_(?:rows|columns)_info_2026_unique_"/g) || []).length,
    2,
    'both bookmark count settings should mount the shared info component'
  );
  assert.doesNotMatch(optionsHtml, /data-i18n="settings_bookmark_columns_desc"/);
  assert.match(settingsSource, /parsed >= 4 && parsed <= 8/);
  assert.match(
    optionsJs,
    /kind:\s*'bookmark-rows',[\s\S]*?id:\s*'_x_extension_bookmark_rows_slider_2026_unique_'[\s\S]*?min:\s*0,[\s\S]*?max:\s*8,[\s\S]*?step:\s*1/
  );
  assert.match(settingsSource, /parsed >= 0 && parsed <= 32 && parsed % 4 === 0/);
  assert.match(optionsJs, /min:\s*4,[\s\S]*?max:\s*8,[\s\S]*?step:\s*1/);
  assert.match(onboardingHtml, /--x-nt-bookmark-columns: 6;/);
}

testBookmarkGridDefaultsToSixColumns();

function testRecentResizeReusesLoadedDataWithoutReloadFlash() {
  const resizeHandlerSource = newtabSource.slice(
    newtabSource.indexOf('function handleNewtabResize()'),
    newtabSource.indexOf("window.addEventListener('resize', () =>", newtabSource.indexOf('function handleNewtabResize()'))
  );
  assert.match(
    resizeHandlerSource,
    /recentColumnsChanged\s*&&\s*recentLoadedOnce[\s\S]*?renderRecentSites\(recentSourceItems\)[\s\S]*?animateRecentResizeLayout\(recentLayoutBefore\)/,
    'recent-site resize should synchronously reuse the rendered source and animate surviving cards'
  );
  assert.doesNotMatch(
    resizeHandlerSource,
    /markRecentDataDirty\(\)|loadRecentSites\(/,
    'recent-site column changes should not start an async reload that can flash after resize'
  );

  const sourceLimitSource = newtabSource.slice(
    newtabSource.indexOf('function getRecentSourceLimit()'),
    newtabSource.indexOf('function applyBookmarkGridColumns()')
  );
  assert.match(
    sourceLimitSource,
    /recentMaxColumns[\s\S]*?return rows \* maxColumns;/,
    'recent-site loading should keep enough source items for every column count in the active width mode'
  );
  assert.match(
    newtabSource,
    /getRecentSites\(recentSourceLimit \+ MAX_PINNED_RECENT_SITES, currentRecentMode\)/,
    'recent-site loading should fill the stable resize source buffer'
  );
}

testRecentResizeReusesLoadedDataWithoutReloadFlash();

function testResizeSettleAnimatesSearchPositionChange() {
  const resizeListenerSource = newtabSource.slice(
    newtabSource.indexOf("window.addEventListener('resize', () =>"),
    newtabSource.indexOf('handleTabKey = function')
  );
  assert.match(
    resizeListenerSource,
    /captureTopContentLayout\(\)[\s\S]*?cancelTopContentLayoutAnimations\(\)[\s\S]*?newtabResizeLayoutLocked\s*=\s*false;[\s\S]*?updateBookmarkSectionPosition\(\{ releaseDockDensityLock: true \}\);[\s\S]*?animateTopContentLayout\(fromLayout\)/,
    'resize settle should animate the search and content from the locked position to the final layout'
  );
  assert.match(
    newtabSource,
    /function getTopContentMotionElements\(\)[\s\S]*?topContentContainer,[\s\S]*?root,/,
    'wordmark and search input should move together during a resize layout transition'
  );
  assert.match(
    newtabSource,
    /function animateLayoutShift\([\s\S]*?deltaX[\s\S]*?deltaY[\s\S]*?translate:\s*`\$\{deltaX\}px \$\{deltaY\}px`/,
    'layout shifts should animate both horizontal and vertical position changes'
  );
}

testResizeSettleAnimatesSearchPositionChange();

function testWideRecentGridCanReachMaximumColumns() {
  assert.strictEqual(
    layoutRuntime.getGridContentWidthForColumns(6, 248, 12),
    1548,
    'six recent cards plus five gaps should define the wide content max width'
  );

  assert.strictEqual(
    layoutRuntime.getAdaptiveGridColumnCount({
      viewportWidth: 1920,
      compactBreakpointPx: 860,
      compactColumns: 2,
      contentMaxWidth: 1548,
      targetColumnWidth: 248,
      gap: 12,
      minColumns: 4,
      maxColumns: 6
    }),
    6,
    'wide desktop viewports should render the maximum recent-site columns'
  );

  assert.strictEqual(
    layoutRuntime.getAdaptiveGridColumnCount({
      viewportWidth: 1280,
      compactBreakpointPx: 860,
      compactColumns: 2,
      contentMaxWidth: 1548,
      targetColumnWidth: 248,
      gap: 12,
      minColumns: 4,
      maxColumns: 6
    }),
    4,
    'medium desktop viewports should keep recent-site rows compact'
  );
}

function testNewtabWideModeUsesRecentGridMaximumWidth() {
  const newtabJs = readNewtabRuntimeSource();
  assert.match(
    newtabJs,
    /contentMaxWidth:\s*RECENT_WIDE_CONTENT_MAX_WIDTH_PX[\s\S]*?recentMaxColumns:\s*RECENT_WIDE_MAX_COLUMNS/,
    'newtab wide mode should size content from the maximum recent grid width'
  );
}

testWideRecentGridCanReachMaximumColumns();
testNewtabWideModeUsesRecentGridMaximumWidth();

console.log('newtab layout tests passed');
