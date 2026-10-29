const assert = require('assert');
const fs = require('fs');
const path = require('path');

const overlaySiteFixes = require('../../src/overlay/dom/site-fixes.ts');
const { parseCss } = require('../helpers/css-rules');
const { createOverlayPage } = require('../helpers/overlay-runtime-harness');

const repoRoot = path.resolve(__dirname, '..', '..');

function createStyle() {
  const values = new Map();
  return {
    getPropertyValue(name) {
      return values.get(name) || '';
    },
    removeProperty(name) {
      values.delete(name);
    },
    setProperty(name, value, priority) {
      values.set(name, priority ? `${value} !${priority}` : value);
    }
  };
}

function createOverlay() {
  const attributes = new Map();
  return {
    style: createStyle(),
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    hasAttribute(name) {
      return attributes.has(name);
    },
    removeAttribute(name) {
      attributes.delete(name);
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    }
  };
}

function createStylesheet(id, loaded) {
  const listeners = new Map();
  const link = {
    dataset: {},
    id,
    rel: 'stylesheet',
    sheet: loaded ? {} : null,
    addEventListener(type, listener) {
      const callbacks = listeners.get(type) || [];
      callbacks.push(listener);
      listeners.set(type, callbacks);
    },
    getAttribute(name) {
      if (name === 'rel') {
        return this.rel;
      }
      return null;
    },
    removeEventListener(type, listener) {
      const callbacks = listeners.get(type) || [];
      listeners.set(type, callbacks.filter((callback) => callback !== listener));
    },
    dispatch(type) {
      (listeners.get(type) || []).slice().forEach((listener) => listener());
    }
  };
  return link;
}

function createStyleRoot(links) {
  const byId = new Map(links.map((link) => [link.id, link]));
  return {
    getElementById(id) {
      return byId.get(id) || null;
    }
  };
}

function createWindow(hostname) {
  let nextFrameId = 0;
  const frameCallbacks = new Map();
  return {
    location: { hostname },
    clearTimeout,
    cancelAnimationFrame(frameId) {
      frameCallbacks.delete(frameId);
    },
    requestAnimationFrame(callback) {
      nextFrameId += 1;
      frameCallbacks.set(nextFrameId, callback);
      return nextFrameId;
    },
    runNextAnimationFrame() {
      const nextEntry = frameCallbacks.entries().next();
      if (nextEntry.done) {
        return false;
      }
      const [frameId, callback] = nextEntry.value;
      frameCallbacks.delete(frameId);
      callback(Date.now());
      return true;
    },
    setTimeout
  };
}

function waitForQueuedPromiseHandlers() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function testOrdinarySitesWaitForCriticalOverlayStyles() {
  const inputStyle = createStylesheet(
    overlaySiteFixes.OVERLAY_STYLE_IDS.input,
    false
  );
  const suggestionsStyle = createStylesheet(
    overlaySiteFixes.OVERLAY_STYLE_IDS.suggestions,
    false
  );
  const overlay = createOverlay();
  const win = createWindow('github.com');
  const gate = overlaySiteFixes.createOverlayRevealGate(
    win,
    {
      overlay,
      styleRoot: createStyleRoot([inputStyle, suggestionsStyle]),
      maxWaitMs: 100
    }
  );

  assert.strictEqual(gate.active, true, 'critical style gating should apply to every site');
  assert.strictEqual(
    overlay.style.getPropertyValue('visibility'),
    'hidden !important',
    'the overlay should remain hidden while native input and button styles could paint'
  );
  assert.strictEqual(
    overlay.getAttribute('data-lumno-site-fix-reveal'),
    overlaySiteFixes.OVERLAY_STYLE_REVEAL_POLICY.id
  );
  assert.deepStrictEqual(
    overlaySiteFixes.OVERLAY_STYLE_REVEAL_POLICY.styleIds,
    [
      overlaySiteFixes.OVERLAY_STYLE_IDS.input,
      overlaySiteFixes.OVERLAY_STYLE_IDS.suggestions
    ],
    'both input controls and result rows must be treated as critical first-frame styles'
  );

  let settled = false;
  const ready = gate.waitUntilReady().then((result) => {
    settled = true;
    return result;
  });
  await Promise.resolve();
  assert.strictEqual(settled, false, 'the reveal should wait while styles are still loading');

  inputStyle.sheet = {};
  inputStyle.dispatch('load');
  await waitForQueuedPromiseHandlers();
  assert.strictEqual(settled, false, 'all critical styles must be ready before reveal');

  suggestionsStyle.sheet = {};
  suggestionsStyle.dispatch('load');
  const result = await ready;
  assert.deepStrictEqual(result, {
    ok: true,
    reason: 'loaded',
    fixId: overlaySiteFixes.OVERLAY_STYLE_REVEAL_POLICY.id
  });
  assert.strictEqual(
    win.runNextAnimationFrame(),
    false,
    'the style gate should not add frames before the entry animation'
  );

  gate.release();
  assert.strictEqual(overlay.style.getPropertyValue('visibility'), '');
  assert.strictEqual(overlay.hasAttribute('data-lumno-site-fix-reveal'), false);
  assert.strictEqual(
    overlay.getAttribute('data-lumno-site-fix-style-fallback'),
    null,
    'a fully styled first frame should not retain fallback-only behavior'
  );
}

async function testAlreadyLoadedStylesDoNotDelayReveal() {
  const inputStyle = createStylesheet(
    overlaySiteFixes.OVERLAY_STYLE_IDS.input,
    true
  );
  const suggestionsStyle = createStylesheet(
    overlaySiteFixes.OVERLAY_STYLE_IDS.suggestions,
    true
  );
  const win = createWindow('example.com');
  const overlay = createOverlay();
  const gate = overlaySiteFixes.createOverlayRevealGate(
    win,
    {
      overlay,
      styleRoot: createStyleRoot([inputStyle, suggestionsStyle])
    }
  );

  const result = await gate.waitUntilReady();
  assert.strictEqual(
    win.runNextAnimationFrame(),
    false,
    'cached styles should not add frames before the entry animation'
  );
  assert.strictEqual(
    overlay.style.getPropertyValue('visibility'),
    'hidden !important'
  );
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.reason, 'already-loaded');
}

async function testTimeoutKeepsSafeFallbackUntilStylesFinish() {
  const inputStyle = createStylesheet(
    overlaySiteFixes.OVERLAY_STYLE_IDS.input,
    false
  );
  const suggestionsStyle = createStylesheet(
    overlaySiteFixes.OVERLAY_STYLE_IDS.suggestions,
    false
  );
  const overlay = createOverlay();
  const gate = overlaySiteFixes.createOverlayRevealGate(
    createWindow('slow.example'),
    {
      overlay,
      styleRoot: createStyleRoot([inputStyle, suggestionsStyle]),
      maxWaitMs: 8
    }
  );

  const result = await gate.waitUntilReady();
  assert.deepStrictEqual(result, {
    ok: false,
    reason: 'timeout',
    fixId: overlaySiteFixes.OVERLAY_STYLE_REVEAL_POLICY.id
  });
  assert.strictEqual(gate.isReady(), false, 'the gate should report styles still loading after its budget');
  gate.release();
  assert.strictEqual(
    overlay.getAttribute('data-lumno-site-fix-style-fallback'),
    overlaySiteFixes.OVERLAY_STYLE_REVEAL_POLICY.id,
    'a timed-out stylesheet must reveal only the safe inline fallback'
  );

  inputStyle.sheet = {};
  inputStyle.dispatch('load');
  await waitForQueuedPromiseHandlers();
  assert.strictEqual(
    overlay.getAttribute('data-lumno-site-fix-style-fallback'),
    overlaySiteFixes.OVERLAY_STYLE_REVEAL_POLICY.id,
    'result rows should remain protected until their stylesheet is also ready'
  );

  suggestionsStyle.sheet = {};
  suggestionsStyle.dispatch('load');
  await waitForQueuedPromiseHandlers();
  assert.strictEqual(
    overlay.getAttribute('data-lumno-site-fix-style-fallback'),
    null,
    'late component styles should upgrade the visible fallback automatically'
  );
  assert.strictEqual(gate.isReady(), true, 'the gate should report styles that loaded after its budget');
}

// The fallback styles the real overlay puts in its shadow root before its
// component stylesheets arrive, read through the CSS object model.
async function testBootstrapFallbackStyles() {
  const page = await createOverlayPage();
  const root = await page.open();
  const shell = parseCss(Array.from(root.querySelectorAll('style')).map((style) => style.textContent).join('\n'));
  page.close();
  const overlay = '#_x_extension_overlay_2024_unique_';
  const rule = (selector) => {
    const found = shell.rule(selector);
    assert.ok(found, `the overlay should style ${selector} before its stylesheets load`);
    return found;
  };
  const switchButton = rule(`:where(${overlay}) :where(.x-ov-suggestion-switch-button)`);
  assert.deepStrictEqual(
    [switchButton.get('background'), switchButton.get('border-radius'), switchButton.get('font'), switchButton.get('font-size'), switchButton.get('height')],
    ['var(--x-ov-suggestion-action-button-bg, transparent)', '6px', 'inherit', '12px', 'var(--x-ov-suggestion-action-height, 26px)'],
    'switch actions should keep their themed pill shape and 12px type before their stylesheet loads'
  );
  assert.ok(!shell.selectors().some((selector) => selector === `${overlay} .x-ov-suggestion-switch-button`),
    'the fallback must stay lower-specificity than the complete suggestion stylesheet');
  const inputFallback = rule(`:where(${overlay}) :where(.x-lumno-search-input, .x-lumno-search-input__container)`);
  assert.deepStrictEqual([inputFallback.get('all'), inputFallback.get('width')], ['unset', '100%'],
    'the input should have a zero-specificity structural fallback');
  assert.strictEqual(rule(`:where(${overlay}[data-lumno-site-fix-style-fallback]) :where(.x-ov-suggestions-container)`).get('visibility'), 'hidden',
    'late result CSS should hide rows instead of exposing unstyled HTML');
  const hiddenControls = shell.entries.find((entry) => entry.style.getPropertyValue('display') === 'none' &&
    entry.selectors.some((selector) => selector.startsWith(`:where(${overlay}[data-lumno-site-fix-style-fallback])`) && selector.includes('mode__prefix')));
  assert.ok(hiddenControls, 'the late input fallback should hide the deferred mode controls');
  const hiddenText = hiddenControls.selectors.join(' ');
  ['mode__prefix', 'mode__badge', 'mode__tab-hint'].forEach((part) => assert.ok(hiddenText.includes(part), `${part} should wait for its stylesheet`));
  ['search-input__right-icon', 'x-ov-close-other-tabs'].forEach((part) => assert.ok(!hiddenText.includes(part), `${part} should stay visible`));
  ['.x-lumno-search-input__icon', '.x-lumno-search-input__right-icon', '.x-ov-close-other-tabs'].forEach((icon) => {
    const mask = rule(`:where(${overlay}) :where(${icon})::before`);
    assert.match(mask.get('mask-image'), /^url\("chrome-extension:\/\/[^/]+\/assets\/remixicon\/.+\.svg"\)$/,
      `${icon} should draw from a cached Remix SVG while the icon font loads`);
    assert.strictEqual(mask.get('background-color'), 'currentColor', `${icon} should take the theme icon color`);
    assert.strictEqual(mask.has('border'), false, 'the fallback should not hand-draw the icon');
  });

  const transitionsOff = (file, control) => {
    const css = parseCss(fs.readFileSync(path.join(repoRoot, file), 'utf8'));
    const found = css.rule(`${overlay}[data-lumno-site-fix-reveal] ${control}`);
    assert.deepStrictEqual(found && [found.get('transition'), found.priority('transition')], ['none', 'important'],
      `${control} should not transition from the native ButtonFace while the overlay reveals`);
  };
  transitionsOff('src/shared/search/search-input.css', '.x-lumno-search-input__right-icon');
  transitionsOff('src/overlay/suggestions-view.css', '.x-ov-close-other-tabs');
}

Promise.resolve()
  .then(testOrdinarySitesWaitForCriticalOverlayStyles)
  .then(testAlreadyLoadedStylesDoNotDelayReveal)
  .then(testTimeoutKeepsSafeFallbackUntilStylesFinish)
  .then(testBootstrapFallbackStyles)
  .then(() => {
    console.log('Overlay critical style reveal tests passed.');
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
