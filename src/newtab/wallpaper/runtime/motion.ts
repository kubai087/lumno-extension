// Paint and load timing, and the reduced-motion preference the runtime's
// animations follow.

// Runs once the next frame has painted: the first frame's callback still runs
// before that frame paints, so it takes two.
function afterNextPaint(windowObj: Window, callback: () => void): void {
  windowObj.requestAnimationFrame(() => {
    windowObj.requestAnimationFrame(callback);
  });
}

// Settles once the page has loaded, so network images wait behind it.
function waitForDocumentLoad(document: Document, window: Window): Promise<void> {
  if (!document || typeof document.readyState !== 'string' || document.readyState === 'complete') {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    window.addEventListener('load', () => resolve(), { once: true });
  });
}

function shouldReduceMotion(windowObj: Window): boolean {
  return Boolean(windowObj.matchMedia &&
    windowObj.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

// Plays an element's `state` animation (data-motion) once.
function playEnterMotion(windowObj: Window, element: HTMLElement | null | undefined, state?: string): void {
  if (!element) {
    return;
  }
  const nextState = state || 'enter';
  if (shouldReduceMotion(windowObj)) {
    element.removeAttribute('data-motion');
    return;
  }
  element.setAttribute('data-motion', nextState);
  afterNextPaint(windowObj, () => {
    if (element.getAttribute('data-motion') === nextState) {
      element.removeAttribute('data-motion');
    }
  });
}

export { afterNextPaint, playEnterMotion, shouldReduceMotion, waitForDocumentLoad };
