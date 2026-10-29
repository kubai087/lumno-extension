// Mirrors the visual viewport's insets (an on-screen keyboard) into CSS
// custom properties the layout reads. A pinch zoom is left alone: the page
// just zooms like any other, with nothing re-fitted to the zoomed-in view.
function isPinchZoomed(visualViewport: Pick<VisualViewport, 'scale'> | null | undefined): boolean {
  const scale = Number(visualViewport && visualViewport.scale);
  return Number.isFinite(scale) && Math.abs(scale - 1) > 0.001;
}

// The insets the visual viewport leaves at the top and bottom of the layout.
function getNewtabVisualViewportInsets(): { top: number; bottom: number } {
  const visualViewport = window.visualViewport;
  if (!visualViewport || isPinchZoomed(visualViewport)) {
    return { top: 0, bottom: 0 };
  }
  const top = Number.isFinite(Number(visualViewport.offsetTop))
    ? Math.max(0, Number(visualViewport.offsetTop))
    : 0;
  const viewportHeight = Number.isFinite(Number(visualViewport.height))
    ? Math.max(0, Number(visualViewport.height))
    : Math.max(0, Number(window.innerHeight) || 0);
  const layoutHeight = Math.max(0, Number(window.innerHeight) || viewportHeight);
  const bottom = Math.max(0, layoutHeight - top - viewportHeight);
  return { top, bottom };
}

function syncNewtabVisualViewportInsets(): void {
  if (!document.documentElement || !document.documentElement.style) {
    return;
  }
  const insets = getNewtabVisualViewportInsets();
  document.documentElement.style.setProperty(
    '--x-nt-visual-viewport-top-inset',
    `${Math.round(insets.top)}px`
  );
  document.documentElement.style.setProperty(
    '--x-nt-visual-viewport-bottom-inset',
    `${Math.round(insets.bottom)}px`
  );
}

// Keeps the CSS insets current from now on.
function followNewtabVisualViewportInsets(): void {
  syncNewtabVisualViewportInsets();
  window.addEventListener('resize', syncNewtabVisualViewportInsets, { passive: true });
  if (window.visualViewport &&
      typeof window.visualViewport.addEventListener === 'function') {
    window.visualViewport.addEventListener(
      'resize',
      syncNewtabVisualViewportInsets,
      { passive: true }
    );
    window.visualViewport.addEventListener(
      'scroll',
      syncNewtabVisualViewportInsets,
      { passive: true }
    );
  }
}

export { followNewtabVisualViewportInsets, getNewtabVisualViewportInsets, isPinchZoomed };
