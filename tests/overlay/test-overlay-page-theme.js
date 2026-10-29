const assert = require('assert');

const { JSDOM } = require('jsdom');

const pageTheme = require('../../src/overlay/dom/page-theme.ts');
const color = require('../../src/domain/color.ts');
const { createOverlayPage, HOST_ID } = require('../helpers/overlay-runtime-harness');

function createElement(config) {
  const element = {
    id: config.id || '',
    nodeType: 1,
    parentElement: config.parentElement || null,
    children: [],
    _style: {
      backgroundColor: config.backgroundColor || 'rgba(0, 0, 0, 0)',
      color: config.color || 'rgb(17, 24, 39)',
      opacity: config.opacity || '1',
      display: config.display || 'block',
      visibility: config.visibility || 'visible'
    },
    hasAttribute(name) {
      return Boolean(config.attributes && Object.prototype.hasOwnProperty.call(config.attributes, name));
    },
    getAttribute(name) {
      if (name === 'id') {
        return this.id;
      }
      return config.attributes && Object.prototype.hasOwnProperty.call(config.attributes, name)
        ? config.attributes[name]
        : null;
    }
  };
  if (element.parentElement && element.parentElement.children) {
    element.parentElement.children.push(element);
  }
  return element;
}

function createDocumentWithSamples(samples, options) {
  const docEl = createElement({
    backgroundColor: options && options.rootBackgroundColor
      ? options.rootBackgroundColor
      : 'rgba(0, 0, 0, 0)'
  });
  const body = createElement({
    parentElement: docEl,
    backgroundColor: options && options.bodyBackgroundColor
      ? options.bodyBackgroundColor
      : 'rgba(0, 0, 0, 0)'
  });
  const document = {
    documentElement: docEl,
    body,
    elementFromPoint(x, y) {
      if (typeof samples === 'function') {
        return samples(x, y);
      }
      return samples.shift() || null;
    }
  };
  const window = {
    innerWidth: 1000,
    innerHeight: 800,
    getComputedStyle(element) {
      return element && element._style ? element._style : {};
    }
  };
  return { document, window, docEl, body };
}

function testVisualThemeUsesVisibleDarkSurfaces() {
  const { document, window, body } = createDocumentWithSamples([], {
    rootBackgroundColor: 'rgb(250, 250, 250)',
    bodyBackgroundColor: 'rgba(0, 0, 0, 0)'
  });
  const darkSurface = createElement({
    parentElement: body,
    backgroundColor: 'rgb(18, 18, 18)',
    color: 'rgb(238, 238, 238)'
  });
  document.elementFromPoint = () => darkSurface;

  assert.strictEqual(
    pageTheme.detectPageVisualTheme({ document, window }),
    'dark',
    'visible dark app surfaces should override a transparent body/root fallback'
  );
}

function testVisualThemeReturnsNullForAmbiguousSurfaces() {
  const { document, window, body } = createDocumentWithSamples([], {});
  const middleSurface = createElement({
    parentElement: body,
    backgroundColor: 'rgb(128, 128, 128)',
    color: 'rgb(96, 96, 96)'
  });
  document.elementFromPoint = () => middleSurface;

  assert.strictEqual(
    pageTheme.detectPageVisualTheme({ document, window }),
    null,
    'ambiguous mid-tone surfaces should not force a theme'
  );
}

function testVisualThemeUsesLightTextWhenBackgroundIsTransparent() {
  const { document, window, body } = createDocumentWithSamples([], {
    rootBackgroundColor: 'rgba(0, 0, 0, 0)',
    bodyBackgroundColor: 'rgba(0, 0, 0, 0)'
  });
  const transparentDarkUiSurface = createElement({
    parentElement: body,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    color: 'rgb(245, 245, 245)'
  });
  document.elementFromPoint = () => transparentDarkUiSurface;

  assert.strictEqual(
    pageTheme.detectPageVisualTheme({ document, window }),
    'dark',
    'light text on transparent sampled surfaces should count as a dark UI signal'
  );
}

function testVisualThemeIgnoresLumnoOverlayElements() {
  const { document, window, body } = createDocumentWithSamples([], {});
  const overlayPanel = createElement({
    id: '_x_extension_overlay_2024_unique_',
    parentElement: body,
    backgroundColor: 'rgb(20, 20, 20)',
    color: 'rgb(238, 238, 238)'
  });
  const lightSurface = createElement({
    parentElement: body,
    backgroundColor: 'rgb(255, 255, 255)',
    color: 'rgb(17, 24, 39)'
  });
  let calls = 0;
  document.elementFromPoint = () => {
    calls += 1;
    return calls <= 2 ? overlayPanel : lightSurface;
  };

  assert.strictEqual(
    pageTheme.detectPageVisualTheme({ document, window }),
    'light',
    'theme sampling should ignore Lumno overlay elements to avoid self-reinforcing detection'
  );
}

function testVisualThemeSamplesOverlayFootprint() {
  const { document, window, body } = createDocumentWithSamples([], {
    bodyBackgroundColor: 'rgb(18, 18, 18)'
  });
  const darkSurface = createElement({
    parentElement: body,
    backgroundColor: 'rgb(18, 18, 18)',
    color: 'rgb(238, 238, 238)'
  });
  let sampleCount = 0;
  document.elementFromPoint = () => {
    sampleCount += 1;
    return darkSurface;
  };

  assert.strictEqual(pageTheme.detectPageVisualTheme({ document, window }), 'dark');
  assert.ok(
    sampleCount >= 24,
    'visual theme sampling should cover the overlay footprint with more than a tiny set of points'
  );
}

function testTransparentCssColorsDoNotBecomeDarkThemeSignals() {
  assert.strictEqual(
    pageTheme.getCssColorThemeSignal('rgba(0, 0, 0, 0)', 0.78),
    null,
    'a fully transparent root background should not count as a black page surface'
  );
  assert.strictEqual(
    pageTheme.getCssColorThemeSignal('rgba(0, 0, 0, 0.1)', 0.78).theme,
    'light',
    'a faint translucent black surface should be composited over the page canvas before classification'
  );
}

function testWappalyzerLikeLightPageSignalsResolveLight() {
  const signals = [
    { theme: 'light', confidence: 0.74, weight: 0.48 },
    { theme: 'light', confidence: 0.62, weight: 0.26 },
    pageTheme.getCssColorThemeSignal('#4608ad', 0.72),
    pageTheme.getCssColorThemeSignal('rgba(0, 0, 0, 0)', 0.78),
    pageTheme.getCssColorThemeSignal('rgba(0, 0, 0, 0)', 0.58),
    { theme: 'light', confidence: 0.62, weight: 1.05 }
  ];
  assert.strictEqual(
    pageTheme.resolvePageThemeSignals(signals),
    'light',
    'explicit light mode and a mostly light viewport should beat a dark brand theme-color'
  );
}

function createThemedPage(html, options) {
  const settings = options || {};
  const dom = new JSDOM(`<!doctype html><html${settings.htmlAttributes || ''}><head>${settings.head || ''}</head><body${settings.bodyAttributes || ''}>${html || ''}</body></html>`, {
    pretendToBeVisual: true
  });
  const { window } = dom;
  if (settings.visualSample) {
    // JSDOM has no layout; let every viewport sample land on one element.
    const sample = window.document.createElement('div');
    sample.style.backgroundColor = settings.visualSample.backgroundColor;
    sample.style.color = settings.visualSample.color;
    sample.style.opacity = '1';
    window.document.body.appendChild(sample);
    window.document.elementFromPoint = () => sample;
  }
  return window;
}

function detectTheme(window) {
  return pageTheme.detectPageTheme({
    document: window.document,
    window,
    parseThemeColorRgb: color.parseCssColor
  });
}

function testPageThemeFusesThemeColorWithVisualSignals() {
  const darkBrandOnLightPage = createThemedPage('', {
    head: '<meta name="theme-color" content="#1a0b3d">',
    visualSample: { backgroundColor: 'rgb(255, 255, 255)', color: 'rgb(17, 24, 39)' },
    bodyAttributes: ' style="background-color: rgb(255, 255, 255)"'
  });
  assert.strictEqual(detectTheme(darkBrandOnLightPage), 'light',
    'a dark brand theme-color must not override a visibly light page');
  darkBrandOnLightPage.close();

  const themeColorOnly = createThemedPage('', {
    head: '<meta name="theme-color" content="#111111">'
  });
  assert.strictEqual(detectTheme(themeColorOnly), 'dark',
    'theme-color still counts as a weighted signal when nothing else speaks');
  themeColorOnly.close();

  const transparentThemeColor = createThemedPage('', {
    head: '<meta name="theme-color" content="transparent">'
  });
  assert.strictEqual(detectTheme(transparentThemeColor), null,
    'an unparseable theme-color adds no signal');
  transparentThemeColor.close();
}

function testPageThemeDoesNotShortCircuitExplicitHints() {
  const darkClassOnLightPage = createThemedPage('', {
    htmlAttributes: ' class="dark"',
    visualSample: { backgroundColor: 'rgb(255, 255, 255)', color: 'rgb(17, 24, 39)' },
    bodyAttributes: ' style="background-color: rgb(255, 255, 255)"'
  });
  assert.strictEqual(detectTheme(darkClassOnLightPage), 'light',
    'an explicit dark class hint is weighed against a visibly light page, not returned outright');
  darkClassOnLightPage.close();

  const explicitDark = createThemedPage('', { htmlAttributes: ' data-theme="dark"' });
  assert.strictEqual(detectTheme(explicitDark), 'dark',
    'an explicit theme attribute decides when nothing contradicts it');
  explicitDark.close();

  const schemeMeta = createThemedPage('', { head: '<meta name="color-scheme" content="dark">' });
  assert.strictEqual(detectTheme(schemeMeta), 'dark', 'a dark color-scheme meta becomes a signal');
  schemeMeta.close();

  const lightSchemeOnDarkPage = createThemedPage('', {
    head: '<meta name="color-scheme" content="light">',
    visualSample: { backgroundColor: 'rgb(18, 18, 18)', color: 'rgb(240, 240, 240)' },
    bodyAttributes: ' style="background-color: rgb(18, 18, 18)"'
  });
  assert.strictEqual(detectTheme(lightSchemeOnDarkPage), 'dark',
    'a light color-scheme hint must not short-circuit a visibly dark page');
  lightSchemeOnDarkPage.close();
}

function testPageThemeIgnoresBusinessClassNames() {
  assert.strictEqual(pageTheme.getThemeClassTokenTheme('light-rays'), null);
  assert.strictEqual(pageTheme.getThemeClassTokenTheme('dark-veil'), null);
  assert.strictEqual(pageTheme.getThemeClassTokenTheme('theme-dark'), 'dark');
  assert.strictEqual(pageTheme.getThemeClassTokenTheme('light-mode'), 'light');
  assert.strictEqual(pageTheme.getThemeClassTokenTheme('night'), 'dark');
  const businessClasses = createThemedPage('<div class="light-rays dark-veil"></div>', {
    bodyAttributes: ' class="dark-veil"'
  });
  assert.strictEqual(detectTheme(businessClasses), null,
    'business class names must not be read as theme switches');
  businessClasses.close();
}

function testPageThemeObserverBatchesChangesPerFrame() {
  const window = createThemedPage('');
  const frames = [];
  window.requestAnimationFrame = (callback) => {
    frames.push(callback);
    return frames.length;
  };
  window.cancelAnimationFrame = (id) => {
    frames[id - 1] = null;
  };
  const changes = [];
  const observer = pageTheme.createPageThemeObserver(window, (change) => {
    changes.push(change);
  });
  observer.start();
  observer.start();
  assert.strictEqual(observer.active, true);
  assert.strictEqual(frames.length, 1, 'starting schedules one initial sync');
  frames.shift()();
  assert.deepStrictEqual(changes, [{ pageChanged: false }], 'the initial sync should not claim the page changed');
  observer.stop();
  assert.strictEqual(observer.active, false);
  window.close();
}

async function testPageThemeObserverReactsToThemeAttributes() {
  const window = createThemedPage('');
  window.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  window.cancelAnimationFrame = (id) => clearTimeout(id);
  const changes = [];
  const observer = pageTheme.createPageThemeObserver(window, (change) => {
    changes.push(change);
  });
  observer.start();
  await new Promise((resolve) => setTimeout(resolve, 5));
  const afterStart = changes.length;
  window.document.documentElement.setAttribute('data-theme', 'dark');
  window.document.documentElement.setAttribute('data-color-mode', 'dark');
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.strictEqual(changes.length, afterStart + 1, 'theme attribute bursts collapse into one sync');
  assert.deepStrictEqual(changes[afterStart], { pageChanged: true }, 'a sync after a mutation should say the page changed');
  window.document.documentElement.setAttribute('aria-label', 'unrelated');
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.strictEqual(changes.length, afterStart + 1, 'unrelated attributes are ignored');
  observer.stop();
  window.document.documentElement.setAttribute('data-theme', 'light');
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.strictEqual(changes.length, afterStart + 1, 'a stopped observer stays quiet');
  window.close();
}

// The real overlay is themed and its input shielded from page extensions
// before its host joins the page, and focus only follows once it is shown.
async function testOverlayIsReadyBeforeItJoinsThePage() {
  const atMount = [];
  const page = await createOverlayPage({
    darkSystem: true,
    setup(window) {
      const attachShadow = window.Element.prototype.attachShadow;
      window.Element.prototype.attachShadow = function(init) {
        const root = attachShadow.call(this, init);
        this.__testRoot = root;
        return root;
      };
      const appendChild = window.Node.prototype.appendChild;
      window.Node.prototype.appendChild = function(child) {
        if (child && child.id === HOST_ID && child.__testRoot) {
          const root = child.__testRoot;
          const input = root.querySelector('#_x_extension_search_input_2024_unique_');
          atMount.push({
            theme: root.getElementById('_x_extension_overlay_2024_unique_').getAttribute('data-theme'),
            input: input && Object.fromEntries(Object.keys(INPUT_ISOLATION).map((name) => [name, input.getAttribute(name)])),
            focused: root.activeElement === input
          });
        }
        return appendChild.call(this, child);
      };
    }
  });
  await page.open();
  assert.strictEqual(atMount.length, 1, 'the overlay host should join the page once');
  assert.strictEqual(atMount[0].theme, 'dark', 'the system theme should apply before the overlay is shown');
  assert.deepStrictEqual(atMount[0].input, INPUT_ISOLATION,
    'password managers, grammar checkers and writing suggestions should be told to skip the input before it mounts');
  assert.strictEqual(atMount[0].focused, false, 'focus should wait for the reveal');
  assert.strictEqual(page.root().activeElement, page.input(), 'the revealed overlay should focus its input');
  page.close();
}

// Sampling the page hit-tests points across it, which forces a full style
// and layout pass once the page has pending changes, and every font face the
// overlay adds to the page restyles all of it. So each open samples the page
// once, before it adds anything, and adds its faces together; only a page
// theme change samples again.
async function testOverlaySamplesThePageOnceBeforeChangingIt() {
  const FONT_FACES_ID = '_x_extension_overlay_font_faces_2026_unique_';
  const CJK_FACES_ID = '_x_extension_overlay_cjk_font_faces_2026_unique_';
  const samples = [];
  const atMount = [];
  const page = await createOverlayPage({
    settings: { _x_extension_language_2024_unique_: 'system' },
    setup(window) {
      window.chrome.i18n.getUILanguage = () => 'zh-CN';
      const doc = window.document;
      doc.elementFromPoint = () => {
        samples.push({
          hostMounted: Boolean(doc.getElementById(HOST_ID)),
          fontFaces: Boolean(doc.getElementById(FONT_FACES_ID))
        });
        return doc.body;
      };
      const appendChild = window.Node.prototype.appendChild;
      window.Node.prototype.appendChild = function(child) {
        if (child && child.id === HOST_ID) {
          atMount.push({
            fontFaces: Boolean(doc.getElementById(FONT_FACES_ID)),
            cjkFaces: Boolean(doc.getElementById(CJK_FACES_ID))
          });
        }
        return appendChild.call(this, child);
      };
    }
  });
  const cjkStyle = () => page.document.getElementById(CJK_FACES_ID);
  await page.open();
  const perOpen = samples.length;
  assert.ok(perOpen > 0, 'the overlay should sample the page');
  assert.ok(samples.every((sample) => !sample.hostMounted && !sample.fontFaces),
    'the page should be sampled before the overlay adds its fonts or host');
  assert.deepStrictEqual(atMount, [{ fontFaces: true, cjkFaces: true }],
    'the CJK face should join the other faces before the host mounts');
  const cjkCss = cjkStyle().textContent;
  assert.match(cjkCss, /PingFangSC-Medium/);

  page.document.documentElement.setAttribute('data-theme', 'dark');
  await page.waitFor(() => samples.length === perOpen * 2, 'a page theme change should sample the page again');
  await page.settle(60);
  assert.strictEqual(samples.length, perOpen * 2, 'one theme change should sample the page once');
  assert.strictEqual(cjkStyle().textContent, cjkCss, 'the language setting should keep the matching CJK face');
  page.close();
}

const INPUT_ISOLATION = {
  'data-1p-ignore': 'true',
  'data-op-ignore': 'true',
  'data-lpignore': 'true',
  'data-bwignore': 'true',
  'data-form-type': 'other',
  'data-gramm': 'false',
  'data-lt-active': 'false',
  spellcheck: 'false',
  writingsuggestions: 'false'
};

testVisualThemeUsesVisibleDarkSurfaces();
testVisualThemeReturnsNullForAmbiguousSurfaces();
testVisualThemeUsesLightTextWhenBackgroundIsTransparent();
testVisualThemeIgnoresLumnoOverlayElements();
testVisualThemeSamplesOverlayFootprint();
testTransparentCssColorsDoNotBecomeDarkThemeSignals();
testWappalyzerLikeLightPageSignalsResolveLight();
testPageThemeFusesThemeColorWithVisualSignals();
testPageThemeDoesNotShortCircuitExplicitHints();
testPageThemeIgnoresBusinessClassNames();
testPageThemeObserverBatchesChangesPerFrame();

testPageThemeObserverReactsToThemeAttributes()
  .then(testOverlayIsReadyBeforeItJoinsThePage)
  .then(testOverlaySamplesThePageOnceBeforeChangingIt)
  .then(() => {
    console.log('overlay page theme tests passed');
    process.exit(0);
  }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
