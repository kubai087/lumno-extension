const assert = require('assert');
const fs = require('fs');
const { readStylesheet } = require('../helpers/css-tokens');
const { parseCss, parsePageCss } = require('../helpers/css-rules');

require('../../src/shared/search/suggestions-height-layout.ts');
const LumnoNewtabLayout = require('../../src/newtab/dom/layout.ts');

const layoutRuntime = LumnoNewtabLayout;
const layoutMotionRuntime = require('../../src/newtab/layout-motion.ts');
const newtabCss = parsePageCss('newtab.html');
const sharedSearchInputCss = parseCss(readStylesheet('src/shared/search/search-input.css'));
const featureHintsCss = parseCss(fs.readFileSync('src/shared/ui/feature-hints.css', 'utf8'));

// Asserts the declarations `selector` gets (inside an @media / @supports
// block matching `condition`, when given). Expected values are exact
// strings or RegExps.
function expectRule(selector, expected, message, condition, css) {
  const rule = (css || newtabCss).rule(selector, condition);
  assert.ok(rule, `${message} (no rule for ${selector})`);
  Object.entries(expected).forEach(([name, value]) => {
    const actual = rule.get(name);
    if (value instanceof RegExp) {
      assert.match(String(actual), value, `${message} (${selector} ${name}: ${actual})`);
    } else {
      assert.strictEqual(actual, value, `${message} (${selector} ${name})`);
    }
  });
}



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
    this.nodeType = 1;
    this.namespaceURI = 'http://www.w3.org/1999/xhtml';
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
    documentElement,
    querySelectorAll() {
      return config.cornerControls || [];
    }
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
  sectionSafeCorridor.parentElement = config.scroller || null;
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

function testBottomDockScrollbarClearsCornerControls() {
  const scroller = new FakeElement({
    rect: { left: 36, right: 1094, top: 480, width: 1058, height: 420, bottom: 900 }
  });
  scroller.offsetWidth = 1058;
  scroller.clientWidth = 1048;
  const overBar = new FakeElement({
    rect: { left: 1060, right: 1098, top: 806, width: 38, height: 38, bottom: 844 }
  });
  const besideBar = new FakeElement({
    rect: { left: 1110, right: 1148, top: 760, width: 38, height: 38, bottom: 798 }
  });
  const { controller } = createFixture({ scroller, cornerControls: [overBar, besideBar] });

  controller.updateBottomDockLayout();

  assert.strictEqual(
    scroller.style.getPropertyValue('--x-nt-bottom-dock-scrollbar-gutter'),
    '10px',
    'the dock should hand its scrollbar gutter back to CSS so the cards keep the dock width'
  );
  assert.strictEqual(
    scroller.style.getPropertyValue('--x-nt-bottom-dock-scrollbar-end-inset'),
    '102px',
    'the scrollbar track should end 8px above a corner control that covers it and ignore controls beside it'
  );

  scroller.setRect({ top: 820, height: 80, bottom: 900 });
  controller.updateBottomDockLayout();
  assert.strictEqual(
    scroller.style.getPropertyValue('--x-nt-bottom-dock-scrollbar-end-inset'),
    '8px',
    'a very short dock should keep a usable scrollbar track rather than clear the controls'
  );
}

testBottomDockScrollbarClearsCornerControls();

function testBottomDockScrollbarInsetsWithoutGutter() {
  const scroller = new FakeElement({
    rect: { left: 36, right: 1094, top: 480, width: 1058, height: 420, bottom: 900 }
  });
  scroller.offsetWidth = 1058;
  scroller.clientWidth = 1058;
  const overBar = new FakeElement({
    rect: { left: 1060, right: 1098, top: 806, width: 38, height: 38, bottom: 844 }
  });
  const { controller } = createFixture({ scroller, cornerControls: [overBar] });

  controller.updateBottomDockLayout();

  assert.strictEqual(scroller.style.getPropertyValue('--x-nt-bottom-dock-scrollbar-gutter'), '0px');
  assert.strictEqual(
    scroller.style.getPropertyValue('--x-nt-bottom-dock-scrollbar-end-inset'),
    '0px',
    'overlay scrollbars take no gutter and need no track inset'
  );
}

testBottomDockScrollbarInsetsWithoutGutter();

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

expectRule('#_x_extension_newtab_suggestions_container_2024_unique_', {
  'max-height': /^min\(.*--x-nt-suggestions-max-height.*--x-nt-suggestions-viewport-fit-max-height.*--x-nt-suggestions-menu-fit-max-height/
}, 'new-tab suggestions should combine content, viewport, and open scope-panel height limits');




function testNewtabContainsRootOverscroll() {
  ['html', 'body'].forEach((selector) => {
    expectRule(selector, { height: '100%', 'overscroll-behavior': 'none' }, 'newtab root should suppress viewport rubber-band overscroll');
  });
  expectRule('body', { 'overflow-x': 'hidden', 'overflow-y': 'auto' },
    'newtab should retain document scrolling as the initialization and mobile-flow fallback');
  expectRule('body.x-nt-bottom-layout:not(.x-nt-mobile-flow)', { 'overflow-y': 'hidden' },
    'desktop bottom layout should prevent a competing page scrollbar while the dock owns vertical overflow');
  const scroller = '#_x_extension_newtab_bottom_dock_scroller_2024_unique_';
  const scrollbarMessage = 'the bottom dock should draw the thin translucent scrollbar instead of the system one when bookmarks and recents overflow';
  // Overlay scrollbars (macOS) keep the system bar.
  const classic = ':root:not([data-lumno-scrollbars="overlay"])';
  expectRule(`${classic} ${scroller}::-webkit-scrollbar`, { width: '10px' }, scrollbarMessage);
  expectRule(`${classic} ${scroller}::-webkit-scrollbar-track`, {
    background: 'transparent',
    'margin-bottom': 'max(10px, var(--x-nt-bottom-dock-scrollbar-end-inset, 0px))'
  }, scrollbarMessage);
  expectRule(`${classic} ${scroller}::-webkit-scrollbar-thumb`, { 'border-radius': '999px' }, scrollbarMessage);
  assert.ok(newtabCss.rule(`${classic} body[data-theme="dark"] ${scroller}::-webkit-scrollbar-thumb`), scrollbarMessage);
  expectRule(scroller, { 'scrollbar-width': 'thin' }, scrollbarMessage, /not selector\(::-webkit-scrollbar\)/);
  expectRule(scroller, {
    '--x-nt-bottom-dock-shadow-bleed-end': '14px',
    'scrollbar-gutter': 'stable',
    'overflow-y': 'auto',
    'overscroll-behavior': 'contain'
  }, 'the dock scrollbar should sit 14px beside the cards in a stable gutter, scrolling inside the dock');
  assert.ok(newtabCss.rule(scroller).names().some((name) => /var\(--x-nt-bottom-dock-scrollbar-gutter,\s*0px\)/.test(newtabCss.rule(scroller).get(name))),
    'the cards should not give up width to the scrollbar gutter');
  expectRule('.x-nt-bookmarks-topbar-viewport', { 'overflow-x': 'auto', 'overscroll-behavior': 'contain' },
    'newtab root isolation should preserve topbar scrolling without chaining wheel input to the page');
}
testNewtabContainsRootOverscroll();

function testTopbarBookmarkTitlesStayReadableUntilWallpaperToneIsReady() {
  expectRule('body[data-wallpaper-active="true"] .x-nt-bookmarks-topbar[data-surface-mode="adaptive"]', {
    '--x-nt-bookmarks-topbar-ink': 'var(--x-nt-bookmark-title, #111827)'
  }, 'topbar bookmark titles should use the theme foreground before wallpaper sampling finishes');
  expectRule('body[data-wallpaper-active="true"] .x-nt-bookmarks-topbar[data-wallpaper-ink][data-surface-mode="adaptive"]', {
    '--x-nt-bookmarks-topbar-ink': /^var\(--x-nt-wallpaper-adaptive-ink,/
  }, 'topbar bookmark titles should switch to sampled wallpaper ink once it is available');
}
testTopbarBookmarkTitlesStayReadableUntilWallpaperToneIsReady();

function testBookmarkNavigationHoverSpacingIsOpticallyBalanced() {
  expectRule('.x-nt-bookmarks-heading.x-nt-bookmarks-heading--link', {
    padding: '3px 5px',
    'margin-left': '-5px',
    'margin-right': '-5px'
  }, 'the nested bookmark heading should use symmetric inline padding without shifting adjacent controls');
  expectRule('.x-nt-bookmarks-crumb', { padding: '0 5px 0 7px' },
    'bookmark breadcrumb hover targets should use the same optical inline padding compensation');
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
  controller.updateBottomDockLayout();
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

  controller.updateBottomDockLayout();
  flushAnimationFrames();
  assert.strictEqual(
    bottomDock.getAttribute('data-density'),
    'default',
    'resize settle should release the density lock and apply the final fitting density once'
  );

}

// The entrance's styles. Its sequence on the page is in
// test-newtab-page-layout.js.
function testInitialEntryMotionIsStaggeredAndTransient() {
  ['body:not([data-nt-enter="done"]) .x-nt-wallpaper-effect-canvas', 'body:not([data-nt-enter="done"])::after'].forEach((selector) => {
    expectRule(selector, { transition: 'none' }, 'wallpaper effect layers should stay transition-free throughout the initial entry sequence');
  });
  ['.x-nt-wallpaper-control', '.x-nt-feedback-control', '.x-nt-bookmark-cascade-debug-control'].forEach((control) => {
    expectRule(`body:not([data-nt-ready="1"]) ${control}`, { visibility: 'hidden' },
      'corner controls should stay hidden until their entrance animation state is installed');
  });
  expectRule('body[data-nt-enter="run"][data-nt-ready="1"] .x-nt-bookmarks-topbar[data-visible="true"]', {
    animation: '_x_nt_topbar_entry_2026_unique_ 220ms cubic-bezier(0.16, 1, 0.3, 1) both'
  }, 'the docked bookmarks top bar should unroll on entry');
  const unroll = newtabCss.keyframes('_x_nt_topbar_entry_2026_unique_');
  assert.deepStrictEqual(
    unroll && ['0%', '85%', '100%'].map((frame) => unroll[frame].getPropertyValue('clip-path')),
    ['inset(0 0 100% 0)', 'inset(0 0 0 0)', 'inset(0 0 -32px 0)'],
    'the docked bookmarks top bar should unroll from the top edge without moving off its final position'
  );
  expectRule('body[data-nt-enter="run"][data-nt-ready="1"] .x-nt-bookmarks-topbar[data-visible="true"][data-layout="floating"]', {
    'animation-name': '_x_nt_topbar_floating_entry_2026_unique_',
    'transform-origin': '50% 0'
  }, 'the floating bookmarks top bar should settle in from its top edge');
  const settle = newtabCss.keyframes('_x_nt_topbar_floating_entry_2026_unique_');
  assert.deepStrictEqual(settle && [settle['0%'].getPropertyValue('opacity'), settle['0%'].getPropertyValue('scale')], ['0', '0.96']);
  expectRule('body:not([data-nt-ready="1"]) .x-nt-bookmarks-topbar', {
    visibility: 'hidden',
    'backdrop-filter': 'none'
  }, 'the hidden bookmarks top bar should not draw its filtered wallpaper as a bare strip before the reveal');

  expectRule('.x-lumno-search-entry[data-lumno-search-entry="run"]', {
    animation: /^_x_lumno_search_entry_2026_unique_ .*var\(--x-lumno-search-entry-duration, 240ms\).*var\(--x-lumno-search-entry-delay, 20ms\) both$/,
    'transform-origin': 'center center'
  }, 'the shared search entry should lead with the new-tab timing and ease-out motion', undefined, sharedSearchInputCss);
  const searchEntry = sharedSearchInputCss.keyframes('_x_lumno_search_entry_2026_unique_');
  assert.ok(searchEntry, 'the shared search entry keyframes should be present');
  assert.deepStrictEqual([searchEntry['0%'].getPropertyValue('scale'), searchEntry['100%'].getPropertyValue('scale')],
    ['var(--x-lumno-search-entry-scale-start, 0.97) 1', '1'], 'the search field should expand subtly from the center');
  Object.values(searchEntry).forEach((frame) => {
    assert.strictEqual(frame.getPropertyValue('translate'), '', 'the search field should not move upward during entry');
    assert.doesNotMatch(frame.getPropertyValue('filter'), /blur/,
      'the backdrop-filtered search panel should stay on compositor-only opacity and scale motion');
  });
  assert.strictEqual(newtabCss.keyframes('_x_lumno_search_entry_2026_unique_') || newtabCss.keyframes('_x_nt_search_entry_2026_unique_'), null,
    'the new-tab page should not duplicate the shared search entry keyframes');
  expectRule('.x-lumno-search-entry[data-lumno-search-entry]', { animation: 'none', filter: 'none', opacity: '1', scale: '1' },
    'the shared search entrance should be disabled for reduced-motion users', /prefers-reduced-motion:\s*reduce/, sharedSearchInputCss);

  [
    ['.x-lumno-feature-hint--newtab-wallpaper', 'translateY(-50%)'],
    ['.x-lumno-feature-hint--newtab-ai-quick-jump', 'translateX(-50%)'],
    ['.x-lumno-feature-hint--newtab-tab-switcher', ''],
    ['.x-lumno-feature-hint--newtab-webdav-sync', ''],
    ['.x-lumno-feature-hint--update-notice-newtab', '']
  ].forEach(([selector, allowedPositionTransform]) => {
    const rule = featureHintsCss.rule(selector, '*');
    assert.ok(rule, `missing feature hint rule ${selector}`);
    const transforms = rule.names().flatMap((name) => rule.get(name).match(/translate(?:X|Y)?\([^)]*\)/g) || []);
    assert.deepStrictEqual(
      transforms,
      allowedPositionTransform ? [allowedPositionTransform] : [],
      `${selector} should keep only its fixed positioning transform during entry`
    );
  });
  expectRule('.x-nt-wallpaper-control:has(> .x-lumno-feature-hint[data-visible="true"])', { 'z-index': '20' },
    'a visible appearance-button hint should sit above the neighbouring feedback button');
  expectRule('body[data-nt-enter="run"] .x-nt-shortcuts-section[data-visible="true"] .x-nt-shortcut-tile', {
    animation: /calc\(20ms \+ \(var\(--x-nt-shortcut-enter-index\) \* 10ms\)\) both$/
  }, 'shortcut tiles should enter with a tight 10ms stagger');
  expectRule('body[data-nt-enter="run"] #_x_extension_newtab_recent_sites_2024_unique_[data-visible="true"]', {
    animation: /40ms both$/
  }, 'bottom content sections should enter together with the shortcut sequence');
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
  const dock = '#_x_extension_newtab_bottom_dock_2024_unique_';
  const scroller = '#_x_extension_newtab_bottom_dock_scroller_2024_unique_';
  const phone = /max-width:\s*640px/;
  const narrowLandscape = /min-width:\s*641px\) and \(max-width:\s*900px\) and \(max-height:\s*560px/;
  const touch = /hover:\s*none/;
  [
    [dock, '51px', '104px', 'bottom dock should define default adaptive sizing tokens'],
    [`${dock}[data-density="compact"]`, '44px', '86px', 'compact bottom dock density should reduce recent and bookmark card heights'],
    [`${dock}[data-density="tiny"]`, '40px', '72px', 'tiny bottom dock density should aggressively reduce card heights']
  ].forEach(([selector, cardHeight, recentHeight, message]) => {
    expectRule(selector, { '--x-nt-dock-bookmark-card-height': cardHeight, '--x-nt-dock-recent-inner-height': recentHeight }, message);
  });
  expectRule('.x-nt-bookmark-card', {
    height: 'var(--x-nt-dock-bookmark-card-height, 51px)',
    padding: 'var(--x-nt-dock-bookmark-card-padding, 13px 15px)'
  }, 'bookmark cards should consume adaptive dock sizing tokens');
  expectRule('.x-nt-folder-preview', { 'margin-right': '-2px' }, 'folder preview favicons should align their right edge');
  expectRule('.x-nt-bookmark-card--folder.x-nt-bookmark-card--folder-expanded .x-nt-folder-preview', { padding: '2px 0 2px 3px' },
    'folder previews should preserve left-side rotation clearance');
  expectRule('.x-nt-recent-inner', {
    padding: 'var(--x-nt-dock-recent-inner-padding, 13px 13px 14px 15px)',
    height: 'var(--x-nt-dock-recent-inner-height, 104px)'
  }, 'recent cards should consume adaptive dock sizing tokens');
  expectRule('body[data-nt-bottom-dock-density="compact"]', {
    '--x-nt-shortcuts-reserved-height': '54px',
    '--x-nt-shortcuts-section-margin-top': '8px'
  }, 'compact dock density should tighten the space around the shortcuts');
  expectRule('body[data-nt-bottom-dock-density="tiny"]', {
    '--x-nt-shortcuts-reserved-height': '42px',
    '--x-nt-shortcuts-section-margin-top': '6px'
  }, 'tiny dock density should tighten the space around the shortcuts further');
  ['#_x_extension_newtab_bookmarks_2024_unique_', '#_x_extension_newtab_recent_sites_2024_unique_'].forEach((section) => {
    expectRule(section, { 'min-width': '0', width: 'min(96vw, var(--x-nt-content-max-width, 1040px))' },
      'phone viewports should not force 500px content sections that create horizontal scrolling', /max-width:\s*520px/);
  });
  expectRule('body.x-nt-mobile-flow', {
    'min-height': '100dvh',
    'overflow-y': 'auto',
    'padding-top': /^max\(.*48px.*var\(--x-nt-top-occupied-inset,.*env\(safe-area-inset-top\)/,
    'padding-inline': 'max(24px, env(safe-area-inset-left)) max(24px, env(safe-area-inset-right))'
  }, 'mobile flow should use one safe-area-aware document scroller that respects an occupied top surface', phone);
  expectRule(dock, { position: 'static', transform: 'none', 'max-height': 'none', 'margin-top': 'auto' },
    'mobile bottom dock should join the document flow and rest at the bottom of the first screen', phone);
  expectRule(scroller, { 'max-height': 'none', overflow: 'visible', 'overscroll-behavior': 'auto' },
    'mobile dock content should release its nested scroll container', phone);
  ['#_x_extension_newtab_bookmarks_grid_2024_unique_', '#_x_extension_newtab_recent_sites_grid_2024_unique_'].forEach((grid) => {
    expectRule(grid, { 'grid-template-columns': 'repeat(2, minmax(0, 1fr))' }, 'narrow viewports should render two columns', /max-width:\s*860px/);
  });
  ['.x-nt-wallpaper-button', '.x-nt-feedback-button'].forEach((button) => {
    expectRule(button, { width: /^var\(--x-nt-corner-size/, height: /^var\(--x-nt-corner-size/ }, 'corner buttons should take the corner size');
  });
  [[phone, 'mobile'], [touch, 'touch'], [narrowLandscape, 'narrow landscape']].forEach(([condition, label]) => {
    assert.ok(newtabCss.entries.some((entry) => entry.conditions.some((text) => condition.test(text)) &&
      entry.style.getPropertyValue('--x-nt-corner-size').trim() === '44px'),
    `${label} utility controls should meet the 44px touch target`);
  });
  expectRule('.x-nt-recent-card:hover', { transform: 'none' }, 'touch input should not retain hover-only recent-card movement', touch);
  expectRule('.x-nt-recent-card:hover .x-nt-recent-card-visual', { transform: 'none', 'box-shadow': 'var(--x-nt-recent-card-shadow)' },
    'touch input should keep the recent-card visual layer stationary', touch);
  expectRule('.x-nt-recent-card:hover .x-nt-recent-inner', {
    height: 'var(--x-nt-dock-recent-inner-height, 104px)',
    transform: 'none',
    'margin-bottom': '0'
  }, 'touch input should not retain hover-only recent-card expansion', touch);
  expectRule('body[data-nt-bottom-dock-density="tiny"]', { '--x-nt-shortcuts-reserved-height': '50px' },
    'narrow landscape should not let tiny density shrink the shortcut row', narrowLandscape);
  expectRule(`${dock}[data-density="tiny"]`, { '--x-nt-dock-bookmark-card-height': '44px' },
    'narrow landscape should not let tiny density shrink interactive rows below 44px', narrowLandscape);
  expectRule(':root', {
    '--x-nt-section-inner-gap': '10px',
    '--x-nt-grid-row-gap': '8px',
    '--x-nt-bottom-dock-section-gap': '10px',
    '--x-nt-bottom-dock-corridor-size': '0px',
    '--x-nt-bottom-dock-top-padding': '12px',
    '--x-nt-bottom-dock-bottom-padding': 'calc(72px + env(safe-area-inset-bottom))',
    '--x-nt-shortcuts-reserved-height': '64px',
    '--x-nt-shortcuts-section-margin-top': '10px',
    '--x-nt-shortcut-tile-size': 'min(var(--x-nt-shortcut-user-tile-size), 52px)',
    '--x-nt-shortcut-icon-size': 'min(var(--x-nt-shortcut-user-icon-size), 40px)'
  }, 'mobile flow should use the compact vertical spacing budget and touch-safe shortcuts', phone);
  expectRule(`${dock}[data-density="mobile"]`, {
    '--x-nt-dock-bookmark-card-height': '44px',
    '--x-nt-dock-recent-card-padding': '6px 6px 8px',
    '--x-nt-dock-recent-card-gap': '6px',
    '--x-nt-dock-recent-inner-height': '82px',
    '--x-nt-dock-recent-inner-hover-height': '82px'
  }, 'mobile density should compact cards without dropping below touch size');
  assert.ok(newtabCss.entries.some((entry) => entry.conditions.some((text) => phone.test(text)) &&
    entry.style.getPropertyValue('--x-nt-corner-inset-y').replace(/\s+/g, ' ').trim() === 'max(10px, env(safe-area-inset-bottom))'),
  'mobile utility controls should clear the bottom safe area');
  expectRule('.x-nt-wallpaper-button', {
    background: 'var(--control-bg)',
    'border-color': 'var(--tab-border)',
    'backdrop-filter': 'blur(16px)'
  }, 'mobile appearance trigger should stay visually distinct over wallpaper content', phone);
  expectRule('.x-nt-wallpaper-panel', {
    position: 'fixed',
    left: 'max(12px, env(safe-area-inset-left))',
    right: 'max(12px, env(safe-area-inset-right))',
    bottom: 'calc(max(12px, env(safe-area-inset-bottom)) + 56px)',
    width: 'auto',
    'max-width': 'none',
    'max-height': 'calc(100dvh - 80px - var(--x-nt-top-bar-max-inset) - var(--x-nt-bottom-safe-inset))',
    '--x-nt-panel-padding': '16px'
  }, 'mobile wallpaper panel should be safe-area aware', phone);
  expectRule('.x-nt-wallpaper-panel-scroll', { 'scrollbar-gutter': 'auto' }, 'and independently scrollable', phone);
  expectRule(':root', { '--x-nt-top-bar-max-inset': 'calc(48px + var(--x-nt-top-safe-inset))' },
    'the top bar reserve should match the floating bookmarks bar');
  const panelMaxHeights = newtabCss.entries
    .filter((entry) => entry.selectors.includes('.x-nt-wallpaper-panel') && entry.style.getPropertyValue('max-height'))
    .map((entry) => entry.style.getPropertyValue('max-height'));
  assert.ok(panelMaxHeights.length > 0, 'appearance panel should cap its height');
  panelMaxHeights.forEach((value) => {
    assert.match(value, /var\(--x-nt-top-bar-max-inset\)/, `appearance panel height should always leave room for the top bar: ${value}`);
    assert.doesNotMatch(value, /--x-nt-top-occupied-inset/,
      `appearance panel should not resize when the top bookmarks bar shows or changes layout: ${value}`);
  });
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

// The search width slider's range and snap points are defined once and run
// from the narrowest setting to the content column.
function testSearchWidthConfigSpansStandardToContentWidth() {
  const config = layoutRuntime.SEARCH_WIDTH_CONFIG;
  assert.strictEqual(config.min, 640);
  assert.strictEqual(config.max, layoutRuntime.CONTENT_MAX_WIDTH_PX);
  assert.deepStrictEqual(Array.from(config.snapPoints), [640, 720, 920, 1040]);
  assert.ok(config.snapPoints.includes(layoutRuntime.STANDARD_SEARCH_MAX_WIDTH_PX),
    'the standard search width is one of the snap points');
  assert.ok(config.snapPoints.includes(config.fallback), 'the default width is a snap point');
  assert.ok(Object.isFrozen(config) && Object.isFrozen(config.snapPoints));
}
testSearchWidthConfigSpansStandardToContentWidth();

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


function testBookmarkPagerSharesAdaptiveToneWithItsModeTrigger() {
  assert.ok(newtabCss.selectors().includes('body[data-wallpaper-active="true"] [data-wallpaper-icon-bg="true"] .x-nt-section-mode-select ._x_extension_select_trigger_2024_unique_'),
    'mode trigger should inherit the shared wallpaper tone from its ancestor surface');
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




function createLayoutMotionFixture(options) {
  const config = options || {};
  const viewport = { width: 1440, height: 900 };
  const played = [];
  const createElement = (top, parentElement) => {
    const element = {
      top,
      left: 40,
      width: 320,
      isConnected: true,
      parentElement: parentElement || null,
      scrollLeft: 0,
      scrollTop: 0,
      translate: 'none',
      getBoundingClientRect() {
        const offset = layoutMotionRuntime.parseTranslate(element.translate);
        const ancestorScroll = element.parentElement ? element.parentElement.scrollTop : 0;
        return { left: element.left + offset.x, top: element.top + offset.y - ancestorScroll, width: element.width, height: 48 };
      },
      animate(keyframes, timing) {
        element.translate = keyframes[0].translate;
        const animation = {
          cancel() {
            element.translate = 'none';
            if (animation.oncancel) animation.oncancel();
          }
        };
        played.push({ element, keyframes, timing, animation });
        return animation;
      }
    };
    return element;
  };
  const search = createElement(156);
  const dock = createElement(400);
  const bookmarks = createElement(408, dock);
  const recent = createElement(650, dock);
  let allowed = true;
  const motion = layoutMotionRuntime.createLayoutMotion({
    documentObj: { body: null },
    windowObj: {
      get innerWidth() { return viewport.width; },
      get innerHeight() { return viewport.height; },
      scrollX: 0,
      scrollY: 0,
      getComputedStyle: (element) => ({ translate: element.translate })
    },
    getTargets: () => [
      { key: 'search', element: search },
      { key: 'bookmarks', element: bookmarks, mover: dock },
      { key: 'recent', element: recent, mover: dock }
    ].filter((target) => !(config.hidden || []).includes(target.key)),
    canAnimate: () => allowed
  });
  return {
    motion,
    played,
    search,
    dock,
    bookmarks,
    recent,
    viewport,
    setAllowed(value) { allowed = value; }
  };
}

function testLayoutMotionEasesShiftedBlocks() {
  assert.strictEqual(layoutMotionRuntime.LAYOUT_MOTION_EASING, 'cubic-bezier(0.65, 0, 0.35, 1)',
    'layout motion should ease in and out');

  const fixture = createLayoutMotionFixture();
  fixture.motion.commit();
  assert.strictEqual(fixture.played.length, 0, 'the first pass only records where the blocks sit');

  fixture.search.top = 263;
  fixture.motion.commit();
  assert.strictEqual(fixture.played.length, 1, 'a block that moved should ease to its new place');
  assert.strictEqual(fixture.played[0].element, fixture.search);
  assert.deepStrictEqual(fixture.played[0].keyframes, [{ translate: '0px -107px' }, { translate: '0px 0px' }],
    'the move should start where the block was drawn');
  assert.strictEqual(fixture.played[0].timing.easing, layoutMotionRuntime.LAYOUT_MOTION_EASING);

  // A second pass halfway through picks up from where the block is drawn.
  fixture.search.translate = '0px -50px';
  fixture.search.top = 156;
  fixture.motion.commit();
  assert.deepStrictEqual(fixture.played[1].keyframes[0], { translate: '0px 57px' },
    'a pass during a move should continue from the drawn position');
}

testLayoutMotionEasesShiftedBlocks();

function testLayoutMotionMovesTheDockOnlyWhenItsSectionsShiftAlike() {
  const fixture = createLayoutMotionFixture();
  fixture.motion.commit();
  fixture.bookmarks.top = 678;
  fixture.recent.top = 920;
  fixture.motion.commit();
  assert.strictEqual(fixture.played.length, 1, 'sections sliding together should move the dock once');
  assert.strictEqual(fixture.played[0].element, fixture.dock, 'the dock moves, not a section its scroller clips');
  assert.deepStrictEqual(fixture.played[0].keyframes[0], { translate: '0px -270px' });

  const mixed = createLayoutMotionFixture();
  mixed.motion.commit();
  mixed.bookmarks.top = 338;
  mixed.motion.commit();
  assert.strictEqual(mixed.played.length, 0, 'sections shifting apart should leave the dock in place');

  const scrolled = createLayoutMotionFixture();
  scrolled.motion.commit();
  scrolled.dock.scrollTop = 120;
  scrolled.motion.commit();
  assert.strictEqual(scrolled.played.length, 0, 'scrolling the dock is not a layout move');
}

testLayoutMotionMovesTheDockOnlyWhenItsSectionsShiftAlike();

function testLayoutMotionLetsCenteredBlocksResizeInPlace() {
  // A shortcut size step narrows the centered shortcut row; its left edge
  // moves but the row has not, so nothing eases it back from the old edge.
  const fixture = createLayoutMotionFixture();
  fixture.motion.commit();
  fixture.search.left = 120;
  fixture.search.width = 160;
  fixture.motion.commit();
  assert.strictEqual(fixture.played.length, 0, 'a block resized around its center should not move');

  fixture.search.left = 160;
  fixture.motion.commit();
  assert.deepStrictEqual(fixture.played[0].keyframes[0], { translate: '-40px 0px' },
    'a block whose center shifted should still ease sideways');
}

testLayoutMotionLetsCenteredBlocksResizeInPlace();

function testLayoutMotionHoldsStillWhenItMayNotAnimate() {
  const blocked = createLayoutMotionFixture();
  blocked.motion.commit();
  blocked.setAllowed(false);
  blocked.search.top = 263;
  blocked.motion.commit();
  blocked.setAllowed(true);
  blocked.motion.commit();
  assert.strictEqual(blocked.played.length, 0, 'a pass that may not animate still records the new place');

  const resized = createLayoutMotionFixture();
  resized.motion.commit();
  resized.viewport.height = 760;
  resized.search.top = 120;
  resized.motion.commit();
  assert.strictEqual(resized.played.length, 0, 'a new viewport size jumps to its layout');
}

testLayoutMotionHoldsStillWhenItMayNotAnimate();

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

function attachShortcutGrid(section, gridHeight) {
  const grid = new FakeElement();
  grid.offsetHeight = gridHeight;
  section.querySelector = (selector) => (selector === '.x-nt-shortcuts-grid' ? grid : null);
  section.offsetWidth = 260;
  section.clientWidth = 240;
  section.scrollTop = 0;
  section.clientHeight = 200;
  section.scrollHeight = gridHeight;
  return grid;
}

// Shortcuts taller than the room above the bottom dock scroll inside their
// section instead of running under the dock, which takes their pointer events.
function testTallShortcutsScrollAboveTheBottomDock() {
  const { bottomDock, shortcutSection, controller } = createFixture({
    shortcutRect: { top: 270, height: 600 },
    shortcutVisible: true
  });
  const grid = attachShortcutGrid(shortcutSection, 600);
  controller.updateBottomDockLayout();
  assert.strictEqual(shortcutSection.getAttribute('data-shortcuts-scrollable'), 'true');
  assert.strictEqual(shortcutSection.style.getPropertyValue('--x-nt-shortcuts-max-height'), '402px',
    'the section stops a gap above the dock');
  assert.strictEqual(shortcutSection.style.getPropertyValue('--x-nt-shortcuts-scrollbar-gutter'), '20px',
    'a classic scrollbar widens the section instead of taking a column');
  assert.strictEqual(shortcutSection.getAttribute('data-shortcuts-more-below'), 'true');
  assert.strictEqual(shortcutSection.getAttribute('data-shortcuts-more-above'), 'false');

  bottomDock.firstElementChild = new FakeElement({ rect: { top: 650, height: 250 } });
  controller.updateBottomDockLayout();
  assert.strictEqual(shortcutSection.style.getPropertyValue('--x-nt-shortcuts-max-height'), '372px',
    'the dock scroller reaching above the dock counts as the dock');

  grid.offsetHeight = 300;
  shortcutSection.scrollHeight = 300;
  controller.updateBottomDockLayout();
  assert.strictEqual(shortcutSection.getAttribute('data-shortcuts-scrollable'), null,
    'shortcuts that fit lose the limit and scroll as before');
  assert.strictEqual(shortcutSection.style.getPropertyValue('--x-nt-shortcuts-max-height'), '');
}

function testShortcutAreaLeavesTheDockRoomOnShortScreens() {
  const { shortcutSection, controller } = createFixture({
    innerHeight: 600,
    rootRect: { top: 93, height: 56 },
    shortcutRect: { top: 161, height: 500 },
    shortcutVisible: true,
    constants: {
      bottomDockTopReservePx: 240,
      compactDockViewportMaxHeightPx: 800,
      compactDockSearchGapPx: 30,
      compactDockShortcutGapPx: 8,
      compactDockMinTopReservePx: 168
    }
  });
  attachShortcutGrid(shortcutSection, 500);
  controller.updateBottomDockLayout();
  assert.strictEqual(shortcutSection.style.getPropertyValue('--x-nt-shortcuts-max-height'), '219px',
    'short screens keep the dock its minimum room and the shortcuts scroll above it');
}

// Leaving the bookmarks top bar moves the search entry, and the shortcuts
// with it, in the same pass that measures the dock; the dock's height
// follows where the shortcuts end up, not where they were.
function testDockFollowsShortcutsWhenTheSearchEntryMoves() {
  const { body, bottomDock, shortcutSection, controller } = createFixture({
    shortcutVisible: true
  });
  shortcutSection.getBoundingClientRect = () => {
    const top = (Number.parseFloat(body.style.getPropertyValue('padding-top')) || 0) + 140;
    return { left: 420, top, width: 240, height: 72, bottom: top + 72 };
  };
  controller.updateBottomDockLayout();
  body.style.setProperty('padding-top', '300px');
  controller.updateBottomDockLayout();
  const searchEntryTop = Number.parseFloat(body.style.getPropertyValue('padding-top'));
  assert.notStrictEqual(searchEntryTop, 300, 'the search entry should move to its centered place');
  assert.strictEqual(bottomDock.style.getPropertyValue('max-height'), `${900 - (searchEntryTop + 140 + 72 + 8)}px`,
    'the dock should stop a gap below the shortcuts at their new place');
}

function testMobileFlowShortcutsKeepTheirHeight() {
  const { shortcutSection, controller } = createFixture({
    innerWidth: 500,
    shortcutRect: { top: 270, height: 900 },
    shortcutVisible: true,
    constants: { mobileFlowBreakpointPx: 640 }
  });
  attachShortcutGrid(shortcutSection, 900);
  controller.updateBottomDockLayout();
  assert.strictEqual(shortcutSection.getAttribute('data-shortcuts-scrollable'), null,
    'on mobile the page scrolls, so the shortcuts keep their full height');
}

testWideRecentGridCanReachMaximumColumns();
testTallShortcutsScrollAboveTheBottomDock();
testShortcutAreaLeavesTheDockRoomOnShortScreens();
testDockFollowsShortcutsWhenTheSearchEntryMoves();
testMobileFlowShortcutsKeepTheirHeight();

console.log('newtab layout tests passed');
