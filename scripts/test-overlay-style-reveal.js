const assert = require('assert');
const fs = require('fs');
const path = require('path');

const overlaySiteFixes = require('../src/overlay/site-fixes.js');

const repoRoot = path.resolve(__dirname, '..');

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
}

function testBootstrapDisablesRightButtonTransitions() {
  const overlayShellSource = fs.readFileSync(
    path.join(repoRoot, 'react-src/overlay/shell.tsx'),
    'utf8'
  );
  const searchInputCss = fs.readFileSync(
    path.join(repoRoot, 'src/shared/search-input.css'),
    'utf8'
  );
  const suggestionsCss = fs.readFileSync(
    path.join(repoRoot, 'src/overlay/suggestions-view.css'),
    'utf8'
  );
  const searchPanelSource = fs.readFileSync(
    path.join(repoRoot, 'src/overlay/search-panel.js'),
    'utf8'
  );
  const backgroundSource = fs.readFileSync(
    path.join(repoRoot, 'src/background/background.js'),
    'utf8'
  );

  assert.match(
    searchInputCss,
    /#_x_extension_overlay_2024_unique_\[data-lumno-site-fix-reveal\]\s+\.x-lumno-search-input__right-icon\s*\{\s*transition:\s*none\s*!important;/,
    'the settings button must not transition from the native ButtonFace during reveal'
  );
  assert.match(
    suggestionsCss,
    /#_x_extension_overlay_2024_unique_\[data-lumno-site-fix-reveal\]\s+\.x-ov-close-other-tabs\s*\{\s*transition:\s*none\s*!important;/,
    'the close-tabs button must not transition from the native ButtonFace during reveal'
  );
  assert.match(
    overlayShellSource,
    /:where\(#_x_extension_overlay_2024_unique_\)\s+:where\(\.x-ov-suggestion-switch-button\)\s*\{[\s\S]*?background:\s*var\(--x-ov-suggestion-action-button-bg,\s*transparent\);[\s\S]*?border-radius:\s*6px;[\s\S]*?font:\s*inherit;[\s\S]*?font-size:\s*12px;[\s\S]*?height:\s*var\(--x-ov-suggestion-action-height,\s*26px\);/,
    'switch actions must keep their themed pill shape and 12px type before their deferred stylesheet loads'
  );
  assert.doesNotMatch(
    overlayShellSource,
    /#_x_extension_overlay_2024_unique_\s+\.x-ov-suggestion-switch-button/,
    'the bootstrap fallback must stay lower-specificity than the complete suggestion stylesheet'
  );
  assert.match(
    overlayShellSource,
    /:where\(#_x_extension_overlay_2024_unique_\)\s+:where\(\.x-lumno-search-input,\s+\.x-lumno-search-input__container\)\s*\{[\s\S]*?all:\s*unset;[\s\S]*?width:\s*100%;/,
    'the input must have a zero-specificity structural fallback before its stylesheet arrives'
  );
  assert.match(
    overlayShellSource,
    /:where\(#_x_extension_overlay_2024_unique_\[data-lumno-site-fix-style-fallback\]\)\s+:where\(\.x-ov-suggestions-container\)\s*\{\s*visibility:\s*hidden;/,
    'late result CSS must hide rows instead of exposing unstyled HTML'
  );
  const fallbackHiddenControls = overlayShellSource.match(
    /:where\(#_x_extension_overlay_2024_unique_\[data-lumno-site-fix-style-fallback\]\)\s+:where\(\s*\n(\s*\.x-lumno-search-input-mode__prefix,[\s\S]*?)\n\s*\)\s*\{\s*display:\s*none;/
  );
  assert(fallbackHiddenControls, 'the late input fallback should hide only deferred mode controls');
  assert.match(
    fallbackHiddenControls[1],
    /\.x-lumno-search-input-mode__prefix,[\s\S]*?\.x-lumno-search-input-mode__badge,[\s\S]*?\.x-lumno-search-input-mode__tab-hint/,
    'the deferred mode controls should remain hidden until their stylesheet is ready'
  );
  assert.doesNotMatch(
    fallbackHiddenControls[1],
    /x-lumno-search-input__right-icon|x-ov-close-other-tabs/,
    'cached Remix SVGs should keep the action icons visible during the fallback'
  );
  assert.match(
    overlayShellSource,
    /getRemixIconMaskCss\(searchIconUrl\)[\s\S]*?getRemixIconMaskCss\(settingsIconUrl\)[\s\S]*?getRemixIconMaskCss\(brush2IconUrl\)/,
    'the fallback should use all cached Remix SVGs instead of drawing substitute glyphs'
  );
  assert.match(
    overlayShellSource,
    /after the delayed icon-font stylesheet[\s\S]*?Overlay's light\/dark theme token[\s\S]*?background-color:\s*currentColor;/,
    'cached SVG masks should inherit the existing light or dark theme icon color'
  );
  assert.match(
    overlayShellSource,
    /:where\(#_x_extension_overlay_2024_unique_\)\s+:where\(\.x-lumno-search-input__icon\)::before/,
    'the cached search SVG should remain active even after component CSS has arrived'
  );
  assert.doesNotMatch(
    overlayShellSource,
    /border:\s*1\.5px solid currentColor|transform:\s*rotate\(45deg\)/,
    'the fallback must not retain the hand-drawn magnifier geometry'
  );
  assert.match(
    searchPanelSource,
    /focusOverlayInputForReveal\(\);[\s\S]*?const reduceMotion = revealOptions\.forceInstant === true \|\|[\s\S]*?overlayFrameTracker\.runEnterAnimation/,
    'the input should become focusable before waiting through entry animation frames'
  );
  assert.match(
    searchPanelSource,
    /forceInstant:\s*!styleGateResult \|\| styleGateResult\.ok !== true \|\|[\s\S]*?shouldSkipOverlayEntryMotionForSlowStartup\(\)/,
    'slow first-frame or style-fallback paths should skip stuttering entry motion'
  );
  assert.match(
    backgroundSource,
    /const overlayOpenStartedAt = Date\.now\(\);[\s\S]*?openedAt:\s*overlayOpenStartedAt/,
    'the renderer should receive the actual command-start timestamp for adaptive entry motion'
  );
  assert.match(
    backgroundSource,
    /const shouldInjectOverlayCodexDebugSurface = Boolean\([\s\S]*?codexDebugBridge\.isEnabled\(\)[\s\S]*?\.\.\.\(shouldInjectOverlayCodexDebugSurface \? \['src\/shared\/codex-debug-surface\.js'\] : \[\]\)/,
    'the development-only debug surface must stay out of the production critical injection list'
  );
}

Promise.resolve()
  .then(testOrdinarySitesWaitForCriticalOverlayStyles)
  .then(testAlreadyLoadedStylesDoNotDelayReveal)
  .then(testTimeoutKeepsSafeFallbackUntilStylesFinish)
  .then(testBootstrapDisablesRightButtonTransitions)
  .then(() => {
    console.log('Overlay critical style reveal tests passed.');
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
