const assert = require('assert');
const fs = require('fs');

delete globalThis.LumnoOverlayLifecycle;
require('../src/overlay/lifecycle.js');

const lifecycle = globalThis.LumnoOverlayLifecycle;
const lifecycleSource = fs.readFileSync('src/overlay/lifecycle.js', 'utf8');
const shellSource = fs.readFileSync('react-src/overlay/shell.tsx', 'utf8');
const searchPanelSource = fs.readFileSync('src/overlay/search-panel.js', 'utf8');
const sharedSearchInputSource = fs.readFileSync(
  'src/shared/search-input.css',
  'utf8'
);
const suggestionsViewSource = fs.readFileSync(
  'src/overlay/suggestions-view.css',
  'utf8'
);

function createStyleSink() {
  const values = new Map();
  return {
    setProperty(name, value, priority) {
      values.set(name, {
        value: String(value),
        priority: priority || ''
      });
    },
    getPropertyValue(name) {
      return values.has(name) ? values.get(name).value : '';
    },
    getPropertyPriority(name) {
      return values.has(name) ? values.get(name).priority : '';
    },
    removeProperty(name) {
      const oldValue = this.getPropertyValue(name);
      values.delete(name);
      return oldValue;
    }
  };
}

function createOverlayElement() {
  return {
    isConnected: true,
    style: createStyleSink()
  };
}

function createFakeWindow(options) {
  const settings = options || {};
  const windowListeners = new Map();
  const visualViewportListeners = new Map();
  const win = {
    devicePixelRatio: Number(settings.devicePixelRatio) || 1,
    innerWidth: Number(settings.innerWidth) || 1200,
    innerHeight: Number(settings.innerHeight) || 800,
    document: {
      documentElement: {
        clientWidth: Number(settings.innerWidth) || 1200,
        clientHeight: Number(settings.innerHeight) || 800
      }
    },
    addEventListener(type, handler) {
      windowListeners.set(type, handler);
    },
    removeEventListener(type, handler) {
      if (windowListeners.get(type) === handler) {
        windowListeners.delete(type);
      }
    },
    visualViewport: {
      width: Number(settings.visualWidth) || Number(settings.innerWidth) || 1200,
      height: Number(settings.visualHeight) || Number(settings.innerHeight) || 800,
      scale: Number(settings.visualScale) || 1,
      offsetLeft: Number(settings.visualOffsetLeft) || 0,
      offsetTop: Number(settings.visualOffsetTop) || 0,
      addEventListener(type, handler) {
        visualViewportListeners.set(type, handler);
      },
      removeEventListener(type, handler) {
        if (visualViewportListeners.get(type) === handler) {
          visualViewportListeners.delete(type);
        }
      }
    },
    triggerWindowResize() {
      const handler = windowListeners.get('resize');
      if (handler) {
        handler();
      }
    },
    triggerVisualViewportResize() {
      const handler = visualViewportListeners.get('resize');
      if (handler) {
        handler();
      }
    },
    triggerVisualViewportScroll() {
      const handler = visualViewportListeners.get('scroll');
      if (handler) {
        handler();
      }
    }
  };
  return win;
}

assert.ok(
  lifecycle && typeof lifecycle.createViewportSizeSync === 'function',
  'overlay lifecycle should expose viewport size synchronization'
);
assert.doesNotMatch(
  lifecycleSource,
  /setProperty\('zoom'/,
  'overlay viewport compensation should not use CSS zoom because it shifts fixed-position anchors'
);
assert.match(
  shellSource,
  /scale\(var\(--x-ov-visible-scale,\s*1\)\)/,
  'overlay shell should compose viewport compensation into transform scale'
);
assert.match(
  searchPanelSource,
  /translateX\(-50%\) translateY\(0\) scale\(var\(--x-ov-visible-scale,\s*1\)\) scaleX\(1\)/,
  'overlay reveal state should preserve viewport scale while completing the centered horizontal stretch'
);
assert.match(
  searchPanelSource,
  /const OVERLAY_ENTER_MOTION = Object\.freeze\(\{[\s\S]*?elastic:[\s\S]*?opacityDurationMs: 130,[\s\S]*?panelDelayMs: 0,[\s\S]*?panelDurationMs: 210,[\s\S]*?panelEasing: 'cubic-bezier\(0\.18, 1\.32, 0\.32, 1\)'[\s\S]*?fade:[\s\S]*?panelDelayMs: 0,[\s\S]*?panelDurationMs: 340,[\s\S]*?panelEasing: 'cubic-bezier\(0\.2, 1, 0\.36, 1\)'[\s\S]*?function applyOverlayEnterAnimationInitialState\(overlayElement\)[\s\S]*?--x-lumno-search-entry-scale-start',[\s\S]*?String\(getOverlayElasticEntryScaleStart\(\)\)[\s\S]*?motion\.panelDurationMs[\s\S]*?motion\.panelDelayMs/,
  'elastic entry should stay short and overshooting while fade keeps its softer timing'
);
assert.match(
  searchPanelSource,
  /const OVERLAY_ELASTIC_ENTRY_SCALE_START = 0\.88;[\s\S]*?const OVERLAY_ELASTIC_OPEN_TABS_ENTRY_SCALE_START = 0\.94;[\s\S]*?function getOverlayElasticEntryScaleStart\(\) \{[\s\S]*?overlayOpenTabsDefaultVisibleLoaded && overlayOpenTabsDefaultVisible[\s\S]*?OVERLAY_ELASTIC_OPEN_TABS_ENTRY_SCALE_START[\s\S]*?OVERLAY_ELASTIC_ENTRY_SCALE_START;/,
  'showing open tabs by default should halve the elastic horizontal stretch from 12% to 6%'
);
assert.match(
  searchPanelSource,
  /const revealTransform = getOverlayEnterAnimationRevealTransform\(\);[\s\S]*?if \(reduceMotion\) \{[\s\S]*?setProperty\('transform', revealTransform, 'important'\)[\s\S]*?runEnterAnimation\(overlay, \(\) => \{[\s\S]*?playOverlayPanelEnterAnimation\(overlay, revealTransform\)/,
  'overlay reveal should start an explicit panel animation in the visible frame and skip it for reduced motion'
);
assert.match(
  searchPanelSource,
  /function getOverlayEnterAnimationStartTransform\(\)[\s\S]*?if \(overlayEnterAnimation === 'fade'\)[\s\S]*?translateY\(16px\)[\s\S]*?scale\(0\.985\)[\s\S]*?function playOverlayPanelEnterAnimation[\s\S]*?duration: motion\.panelDurationMs,[\s\S]*?duration: motion\.opacityDurationMs,/,
  'fade mode should retain its position and opacity entrance motion through explicit keyframes'
);
assert.match(
  searchPanelSource,
  /Promise\.all\(\[[\s\S]*?revealReady[\s\S]*?initialOverlayThemeReady,[\s\S]*?initialOverlaySizeReady,[\s\S]*?initialOverlayEnterAnimationReady[\s\S]*?initialMotionEffectsReady[\s\S]*?applyOverlayEnterAnimationInitialState\(overlay\);[\s\S]*?const styleGateResult = readyStates\[0\];[\s\S]*?revealOverlay\(\{[\s\S]*?forceInstant:/,
  'overlay reveal should wait only for critical styles and stable visual preferences, then skip stuttering entry motion when startup is late'
);
const overlayRevealBlock = searchPanelSource.slice(
  searchPanelSource.lastIndexOf('const revealReady =')
);
assert.doesNotMatch(
  overlayRevealBlock,
  /initialLanguageReady|initialOverlayContentReady|initialFaviconEnhancedFetchReady/,
  'language, open-tab content, and favicon policy should hydrate without blocking the visible input shell'
);
assert.doesNotMatch(
  searchPanelSource,
  /setTimeout\(\(\) => searchInput\.focus/,
  'overlay focus should follow the visible reveal state instead of an unrelated wall-clock timer'
);
assert.match(
  shellSource,
  /const OVERLAY_PANEL_REST_TRANSFORM =\s*'translateX\(-50%\) translateY\(0\) scale\(var\(--x-ov-visible-scale, 1\)\)';[\s\S]*?all: unset;[\s\S]*?transform: \$\{OVERLAY_PANEL_REST_TRANSFORM\} !important;[\s\S]*?filter: none !important;[\s\S]*?will-change: auto !important;[\s\S]*?transition: none !important;/,
  'the React shell should provide a passive centered rest state while search-panel owns entry timing'
);
assert.doesNotMatch(
  shellSource,
  /all: unset !important/,
  'the Shadow DOM shell reset must not outrank its own animated longhands or panel surface declarations'
);
assert.doesNotMatch(
  shellSource,
  /OVERLAY_PANEL_ENTRY_TRANSFORM|OVERLAY_PANEL_TRANSITION/,
  'the React shell should not duplicate search-panel entry state or timing'
);
assert.ok(
  searchPanelSource.includes("shadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.72), 0 2px 5px -2px rgba(15, 23, 42, 0.11), 0 16px 42px -12px rgba(15, 23, 42, 0.17), 0 48px 112px -30px rgba(15, 23, 42, 0.19)'") &&
    shellSource.includes('box-shadow: var(--x-ov-shadow, inset 0 1px 0 rgba(255, 255, 255, 0.72), 0 2px 5px -2px rgba(15, 23, 42, 0.11), 0 16px 42px -12px rgba(15, 23, 42, 0.17), 0 48px 112px -30px rgba(15, 23, 42, 0.19))'),
  'the active light theme and passive shell fallback should share the same soft layered elevation shadow'
);
assert.ok(
  searchPanelSource.includes("shadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 2px 6px -2px rgba(0, 0, 0, 0.28), 0 18px 48px -14px rgba(0, 0, 0, 0.42), 0 52px 124px -34px rgba(0, 0, 0, 0.52)'"),
  'the dark theme should keep a soft neutral elevation without a hard contact edge or colored glow'
);
assert.ok(
  searchPanelSource.includes('function trackOverlayPanelEnterAnimation(overlayElement, animations)') &&
    searchPanelSource.includes('primaryAnimation.onfinish = () =>') &&
    searchPanelSource.includes("event.propertyName !== 'transform'") &&
    /cleanupDelayMs = motion\.panelDelayMs \+[\s\S]*?motion\.panelDurationMs \+ OVERLAY_ENTER_CLEANUP_BUFFER_MS[\s\S]*?overlayEnterCleanupTimer = setTimeout/.test(searchPanelSource),
  'the panel entry transaction should finish from its primary animation, retain transitionend fallback, and use a bounded watchdog'
);
assert.match(
  searchPanelSource,
  /function finishOverlayPanelEnterAnimation\(overlayElement, animationRevision\)[\s\S]*?removeProperty\('transition'\)[\s\S]*?setProperty\('will-change', 'auto'[\s\S]*?function applyOverlayEnterAnimationInitialState[\s\S]*?data-lumno-overlay-entry', 'prepared'[\s\S]*?function playOverlayPanelEnterAnimation[\s\S]*?trackOverlayPanelEnterAnimation\([\s\S]*?transformAnimation, opacityAnimation/,
  'one panel entry owner should prepare, reveal, and release temporary compositor state'
);
const overlayPanelEntryFunction = searchPanelSource.match(
  /function applyOverlayEnterAnimationInitialState\(overlayElement\) \{[\s\S]*?\n  \}\n\n  function playOverlayPanelEnterAnimation/
);
assert.ok(overlayPanelEntryFunction, 'overlay panel entry function should remain available');
assert.doesNotMatch(
  overlayPanelEntryFunction[0],
  /style\.setProperty\('filter'/,
  'the backdrop-filtered overlay shell should not animate CSS filter because it can flash an offscreen compositing surface'
);
assert.match(
  searchPanelSource,
  /function getOverlayEnterAnimationDeltaTransform\(\)[\s\S]*?translateY\(16px\) scale\(0\.985\)[\s\S]*?translateY\(12px\) scaleX\(\$\{getOverlayElasticEntryScaleStart\(\)\}\)[\s\S]*?function playOverlayPanelEnterAnimation\(overlayElement, revealTransform\)[\s\S]*?style\.setProperty\('opacity', '1'\);[\s\S]*?style\.setProperty\('transform', revealTransform\);[\s\S]*?overlayElement\.animate\(\[[\s\S]*?transform: deltaTransform[\s\S]*?transform: 'none'[\s\S]*?composite: 'add'[\s\S]*?fill: 'backwards'[\s\S]*?overlayElement\.animate\(\[[\s\S]*?opacity: 0[\s\S]*?opacity: 1/,
  'WAAPI should replay an additive motion delta without replacing the panel centering transform when the hidden host becomes visible'
);
assert.match(
  searchPanelSource,
  /WAAPI animation values sit below author !important declarations[\s\S]*?style\.setProperty\('will-change', 'transform, opacity', 'important'\);[\s\S]*?style\.setProperty\('opacity', '1'\);[\s\S]*?style\.setProperty\('transform', revealTransform\);/,
  'the animation transaction should release only the animated longhands while retaining a bounded compositor hint'
);
assert.doesNotMatch(
  searchPanelSource,
  /style\.setProperty\('all',\s*'unset'/,
  'entry playback and cleanup must never rewrite the whole panel reset'
);
assert.match(
  searchPanelSource,
  /function finishOverlayPanelEnterAnimation\(overlayElement, animationRevision\)[\s\S]*?setProperty\('opacity', '1', 'important'\)[\s\S]*?getOverlayEnterAnimationRevealTransform\(\)[\s\S]*?setProperty\('will-change', 'auto'/,
  'the protected important rest state should be restored after the keyframe transaction'
);
assert.doesNotMatch(
  searchPanelSource,
  /OverlayInputEnterAnimation|overlayInputEnterCleanup|inputBlurPx|inputDurationMs/,
  'overlay entry should not add a paint-bound filter animation to the input surface'
);
assert.match(
  searchPanelSource,
  /const overlayThemeTokens = \{[\s\S]*?light:[\s\S]*?blur: '14px'[\s\S]*?dark:[\s\S]*?blur: '28px'/,
  'the translucent dark panel should cap its expensive backdrop blur radius'
);
assert.doesNotMatch(
  searchPanelSource,
  /OverlayEntryBlurProxy|overlayEntryBlurProxy|entry-blur-proxy|OVERLAY_ENTRY_PROXY/,
  'overlay entry should not crossfade a separate blur proxy into the backdrop-filtered panel'
);
assert.match(
  sharedSearchInputSource,
  /--x-lumno-search-entry-scale-start:\s*0\.97;[\s\S]*?--x-lumno-search-entry-easing:\s*cubic-bezier\(0\.16, 1, 0\.3, 1\);/,
  'overlay and new-tab should retain a shared fallback token definition'
);
assert.match(
  sharedSearchInputSource,
  /\.x-lumno-search-input-mode__menu:not\(\[hidden\]\) \{[\s\S]*?transition: opacity 170ms ease,[\s\S]*?transform 360ms cubic-bezier\(0\.2, 1\.45, 0\.35, 1\) !important;/,
  'ordinary scope-menu entry should retain the shared spring-like transform transition'
);
assert.doesNotMatch(
  sharedSearchInputSource,
  /_x_lumno_search_mode_menu_entry_2026_unique_|\.x-lumno-search-input-mode__menu\[data-open="true"\][\s\S]*?animation:/,
  'scope-menu transform must not be owned by a competing keyframe and transition at the same time'
);
assert.match(
  sharedSearchInputSource,
  /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.x-lumno-search-input-mode__menu \{[\s\S]*?animation: none !important;[\s\S]*?transition: none !important;/,
  'search-mode panel motion should respect reduced-motion preferences'
);
assert.match(
  shellSource,
  /--x-ov-panel-radius:\s*28px;[\s\S]*?border-radius:\s*var\(--x-ov-panel-radius\)\s*!important;/,
  'overlay shell should use the smaller 28px radius on every outer corner'
);
assert.doesNotMatch(
  shellSource,
  /--x-ov-panel-top-radius/,
  'overlay shell should expose one shared outer-corner radius token'
);
assert.match(
  searchPanelSource,
  /setOverlayPanelScopedStyle\([\s\S]*?'border-radius',[\s\S]*?'var\(--x-ov-panel-radius, 28px\)'[\s\S]*?\);/,
  'collapsed and expanded overlays should keep the same 28px radius on all four outer corners'
);
assert.match(
  searchPanelSource,
  /shouldCollapse\s*\?\s*'var\(--x-ov-content-radius, 27px\)'\s*:\s*'var\(--x-ov-content-radius, 27px\) var\(--x-ov-content-radius, 27px\) 0 0'/,
  'the input should follow the 27px radius inside the shell border while its expanded seam stays square'
);
assert.match(
  suggestionsViewSource,
  /border-radius:\s*0 0 var\(--x-ov-content-radius,\s*27px\) var\(--x-ov-content-radius,\s*27px\);/,
  'overlay results should follow the 27px radius inside the shell border at the lower corners'
);
assert.match(
  searchPanelSource,
  /function applyInstantSuggestionsHeightLayout\(container\)[\s\S]*?removeAttribute\('data-height-clipped'\)[\s\S]*?'height'[\s\S]*?'padding-top'[\s\S]*?'transition'[\s\S]*?setProperty\('transition', 'none', 'important'\)/,
  'overlay results should clear fixed-height styles and explicitly disable container transitions'
);
assert.match(
  searchPanelSource,
  /reactView\.render\(\{[\s\S]*?setOverlayResultsCollapsed\(false, \{\s*deferLayoutSync: true\s*\}\);[\s\S]*?commitSuggestionsNaturalHeightAfterRender\(\);/,
  'every result renderer should publish the new natural height directly after rendering rows'
);
assert.match(
  searchPanelSource,
  /function commitSuggestionsNaturalHeightAfterRender\(\) \{\s*applyInstantSuggestionsHeightLayout\(suggestionsContainer\);\s*syncSearchModeMenuResultOffset\(\);/,
  'the scope-menu offset should synchronize with the same direct height commit'
);
assert.doesNotMatch(
  searchPanelSource,
  /captureSuggestionsHeightState|deferCappedShrink|suggestionsHeightInputSettleTimer|scheduleStandaloneSuggestionsHeightTransition|settleHeightAfterRemoteMix/,
  'overlay typing and remote mixing should not capture, lock, defer, or animate result height'
);
assert.match(
  searchPanelSource,
  /handleSearchInputCompositionEnd\(event\)[\s\S]*?if \(query\.length > 0\) \{[\s\S]*?requestOverlaySearchSuggestions\(query\)/,
  'overlay composition input should request results without starting a height session'
);
assert.match(
  searchPanelSource,
  /handleSearchInputEvent\(event\)[\s\S]*?if \(query\.length > 0\) \{[\s\S]*?requestOverlaySearchSuggestions\(query\)/,
  'overlay input should request results without starting a height session'
);
assert.match(
  searchPanelSource,
  /updateSearchSuggestions\(localSuggestions, requestQuery, \{\s*remoteMixState\s*\}\);[\s\S]*?remoteMixState\.settled = true;[\s\S]*?updateSearchSuggestions\(remoteResponse\.suggestions, requestQuery, \{\s*remoteMixState,\s*finalRemoteMix: true\s*\}\);/,
  'local and remote result sets should each use an ordinary direct render commit'
);
assert.match(
  searchPanelSource,
  /if \(siteSearchState && requestQuery\) \{\s*updateSearchSuggestions\(\[\], requestQuery\);\s*return;\s*\}/,
  'active site-search queries should render their deterministic single result without waiting for remote suggestion mixing'
);
assert.match(
  searchPanelSource,
  /if \(isPaste \|\| getDirectUrlSuggestion\(query\)\) \{\s*updatePendingSearchSuggestions\(query\);\s*\}/,
  'an immediate URL preview should render without a height-deferral option'
);
assert.match(
  searchPanelSource,
  /!finalRemoteMix && remoteMixState &&[\s\S]*?remoteMixState\.settled && remoteMixState\.hasFinalSuggestions[\s\S]*?return;/,
  'a late local render should not overwrite an already completed remote mix'
);
assert.doesNotMatch(
  searchPanelSource,
  /function animateSuggestionsGrowth\(/,
  'overlay should not keep the append-only growth animation that caused repeated flashes while typing'
);

for (const tabZoomFactor of [0.8, 1.25, 1.5]) {
  const win = createFakeWindow({
    innerWidth: 1200,
    innerHeight: 800,
    visualWidth: 1200,
    visualHeight: 800,
    visualScale: 1
  });
  const overlay = createOverlayElement();
  const sync = lifecycle.createViewportSizeSync(win, {
    getSizePreset: () => ({ width: 760, maxHeightVh: 75, uiScale: 1 }),
    getRequestedTabZoomFactor: () => tabZoomFactor
  });

  sync.start(overlay);

  assert.strictEqual(
    overlay.style.getPropertyValue('left'),
    '600px',
    `overlay should remain horizontally centered at ${tabZoomFactor * 100}% tab zoom`
  );
  assert.strictEqual(
    overlay.style.getPropertyValue('top'),
    '160px',
    `overlay should retain its 20vh anchor at ${tabZoomFactor * 100}% tab zoom`
  );
  assert.strictEqual(
    Number(overlay.style.getPropertyValue('--x-ov-visible-scale')),
    1 / tabZoomFactor,
    `overlay should compensate its visual size at ${tabZoomFactor * 100}% tab zoom`
  );
}

{
  const win = createFakeWindow({
    innerWidth: 1200,
    innerHeight: 800,
    visualWidth: 600,
    visualHeight: 400,
    visualScale: 2,
    visualOffsetLeft: 120,
    visualOffsetTop: 40
  });
  const overlay = createOverlayElement();
  const sync = lifecycle.createViewportSizeSync(win, {
    getSizePreset: () => ({ width: 760, maxHeightVh: 75, uiScale: 1 }),
    getRequestedTabZoomFactor: () => 1.25
  });

  sync.start(overlay);

  assert.strictEqual(
    overlay.style.getPropertyValue('--x-ov-visible-scale'),
    '0.4',
    'overlay should combine tab zoom and pinch zoom for visual size compensation'
  );
  assert.strictEqual(
    overlay.style.getPropertyValue('left'),
    '420px',
    'tab zoom should not move the centered anchor inside a shifted visual viewport'
  );
  assert.strictEqual(
    overlay.style.getPropertyValue('top'),
    '120px',
    'tab zoom should not move the vertical anchor inside a shifted visual viewport'
  );
}

{
  const win = createFakeWindow({
    innerWidth: 1200,
    innerHeight: 800,
    visualWidth: 600,
    visualHeight: 400,
    visualScale: 2,
    visualOffsetLeft: 120,
    visualOffsetTop: 40
  });
  const overlay = createOverlayElement();
  const sync = lifecycle.createViewportSizeSync(win, {
    getSizePreset: () => ({ width: 760, maxHeightVh: 75, uiScale: 1 }),
    getRequestedTabZoomFactor: () => 1
  });

  sync.start(overlay);

  assert.strictEqual(
    overlay.style.getPropertyValue('--x-ov-visible-scale'),
    '0.5',
    'overlay should reverse visual viewport pinch zoom so cmd+wheel does not magnify it'
  );
  assert.strictEqual(
    overlay.style.getPropertyValue('zoom'),
    '',
    'overlay should avoid CSS zoom so fixed-position centering stays stable'
  );
  assert.strictEqual(
    overlay.style.getPropertyValue('left'),
    '420px',
    'overlay should keep its original 50vw screen position inside the shifted visual viewport'
  );
  assert.strictEqual(
    overlay.style.getPropertyValue('top'),
    '120px',
    'overlay should keep its original 20vh screen position inside the shifted visual viewport'
  );
  assert.strictEqual(
    overlay.style.getPropertyValue('max-width'),
    '1176px',
    'overlay max-width should use the scaled visual viewport width so pinch zoom does not shrink the panel'
  );
}

{
  const win = createFakeWindow({
    innerWidth: 1200,
    innerHeight: 800,
    visualWidth: 1200,
    visualHeight: 800,
    visualScale: 1
  });
  const overlay = createOverlayElement();
  const sync = lifecycle.createViewportSizeSync(win, {
    getSizePreset: () => ({ width: 760, maxHeightVh: 75, uiScale: 1 }),
    getRequestedTabZoomFactor: () => 1
  });

  sync.start(overlay);
  assert.strictEqual(overlay.style.getPropertyValue('--x-ov-visible-scale'), '1');

  win.visualViewport.width = 600;
  win.visualViewport.height = 400;
  win.visualViewport.scale = 2;
  win.visualViewport.offsetLeft = 240;
  win.visualViewport.offsetTop = 80;
  win.triggerVisualViewportResize();

  assert.strictEqual(
    overlay.style.getPropertyValue('--x-ov-visible-scale'),
    '0.5',
    'overlay should resync when cmd+wheel changes visual viewport scale after mounting'
  );
  assert.strictEqual(
    overlay.style.getPropertyValue('left'),
    '540px',
    'overlay should resync the original vw position when the visual viewport offset changes'
  );
  assert.strictEqual(
    overlay.style.getPropertyValue('top'),
    '160px',
    'overlay should resync the original vh position when the visual viewport offset changes'
  );

  win.visualViewport.offsetTop = 100;
  win.triggerVisualViewportScroll();
  assert.strictEqual(
    overlay.style.getPropertyValue('top'),
    '180px',
    'overlay should follow visual viewport scrolling without waiting for a resize'
  );
}

console.log('overlay viewport size sync tests passed');
