const assert = require('assert');

const LumnoOverlayLifecycle = require('../../src/overlay/dom/lifecycle.ts');

const lifecycle = LumnoOverlayLifecycle;

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
// The overlay's entry motion, rest transform and radii are covered by
// test-overlay-entry-motion.js.

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
