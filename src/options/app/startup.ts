// When the page is ready: once the settings its tabs show are read, and the
// frame that paints them has passed, changes from then on may animate. The
// document carries the ready mark and how long it took, and the page leaves
// performance marks for diagnostics.
const RUNTIME_START_MARK = 'lumno-options-runtime-start';
const READY_MARK = 'lumno-options-ready';

function mark(name: string): void {
  try {
    if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
      performance.mark(name);
    }
  } catch (error) {
    // Performance marks are diagnostics only.
  }
}

function now(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}

// The start of the page's own script; returns when it started.
function markRuntimeStart(doc: Document): number {
  mark(RUNTIME_START_MARK);
  doc.documentElement.setAttribute('data-lumno-options-runtime-started', 'true');
  return now();
}

function markReady(doc: Document, startedAt: number): void {
  const root = doc.documentElement;
  if (root.getAttribute('data-lumno-options-ready') === 'true') {
    return;
  }
  const readyAt = now();
  root.setAttribute('data-lumno-options-ready', 'true');
  root.setAttribute('data-lumno-options-ready-ms', Math.max(0, readyAt - startedAt).toFixed(2));
  root.setAttribute('data-lumno-options-ready-navigation-ms', Math.max(0, readyAt).toFixed(2));
  mark(READY_MARK);
  try {
    if (typeof performance !== 'undefined' && typeof performance.measure === 'function') {
      performance.measure('lumno-options-startup', RUNTIME_START_MARK, READY_MARK);
    }
  } catch (error) {
    // Performance measures are diagnostics only.
  }
}

// Ready waits for the frame that paints the read values. A hidden page gets
// no frames until it is shown and has nothing on screen to animate, so it is
// ready as soon as the values are in.
function markReadyOnceRead(read: Promise<unknown>, doc: Document, win: Window, startedAt: number): void {
  void read.then(() => {
    if (doc.visibilityState === 'hidden' || typeof win.requestAnimationFrame !== 'function') {
      markReady(doc, startedAt);
      return;
    }
    win.requestAnimationFrame(() => {
      win.requestAnimationFrame(() => markReady(doc, startedAt));
    });
  });
}

export { markReadyOnceRead, markRuntimeStart };
