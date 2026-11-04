// The search backplate, outline and rows are separate fixed layers. Animate
// them together without changing the list's measured layout or its hit tests.
type Layers = { surface: HTMLElement | null; outline: HTMLElement | null; content: HTMLElement };
type Snapshot = { height: number; contentOpacity: string; contentTransform: string; contentClip: string; surfaceOpacity: string };

function createSuggestionsMotion(win: Window, doc: Document) {
  let running: Animation[] = [];
  let mode: 'visibility' | 'resize' | null = null;
  let stopWatching: (() => void) | null = null;
  let generation = 0;

  function enabled(layers: Layers): boolean {
    return doc.documentElement.getAttribute('data-lumno-motion-effects') !== 'off' &&
      !(typeof win.matchMedia === 'function' && win.matchMedia('(prefers-reduced-motion: reduce)').matches) &&
      typeof layers.content.animate === 'function' && Boolean(layers.surface && layers.outline &&
        typeof layers.surface.animate === 'function' && typeof layers.outline.animate === 'function');
  }

  function capture(layers: Layers): Snapshot | null {
    if (!running.length || !layers.surface) return null;
    const contentStyle = win.getComputedStyle(layers.content);
    return {
      height: layers.surface.getBoundingClientRect().height,
      contentOpacity: contentStyle.opacity,
      contentTransform: contentStyle.transform === 'none' ? 'translateY(0px)' : contentStyle.transform,
      contentClip: contentStyle.clipPath === 'none' ? 'inset(0 0 0% 0)' : contentStyle.clipPath,
      surfaceOpacity: win.getComputedStyle(layers.surface).opacity
    };
  }

  function clearWatch(): void {
    if (stopWatching) stopWatching();
    stopWatching = null;
  }

  function cancel(): void {
    generation += 1;
    clearWatch();
    running.forEach((animation) => animation.cancel());
    running = [];
    mode = null;
  }

  function finish(): void {
    clearWatch();
    running = [];
    mode = null;
  }

  // A user can change the motion preference while the panel is moving.
  // Listen only for the duration of the animation.
  function watchMotionPreference(layers: Layers): void {
    const media = typeof win.matchMedia === 'function' ? win.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const onChange = () => { if (!enabled(layers)) cancel(); };
    if (media && typeof media.addEventListener === 'function') media.addEventListener('change', onChange);
    const observer = typeof MutationObserver === 'function' ? new MutationObserver(onChange) : null;
    observer?.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-lumno-motion-effects'] });
    stopWatching = () => {
      if (media && typeof media.removeEventListener === 'function') media.removeEventListener('change', onChange);
      observer?.disconnect();
    };
  }

  function play(open: boolean, layers: Layers, collapsedHeight: number, previous: Snapshot | null): void {
    cancel();
    if (!enabled(layers) || !layers.surface || !layers.outline || collapsedHeight <= 0) return;
    mode = 'visibility';
    const currentGeneration = generation;
    try {
      const duration = open ? 260 : 190;
      const easing = open ? 'cubic-bezier(0.16, 1, 0.3, 1)' : 'cubic-bezier(0.4, 0, 0.8, 0.4)';
      const targetHeight = Number.parseFloat(layers.surface.style.getPropertyValue('--x-nt-suggestions-motion-height')) || collapsedHeight;
      const frameFrom = previous ? `${previous.height}px` : (open ? `${collapsedHeight}px` : `${targetHeight}px`);
      const frameTo = open ? `${targetHeight}px` : `${collapsedHeight}px`;
      const surfaceFrom = previous?.surfaceOpacity || '1';
      [layers.surface, layers.outline].forEach((element) => {
        if (!element) return;
        const animation = element.animate([
          { height: frameFrom, opacity: surfaceFrom, visibility: 'visible', ...(open ? {} : { zIndex: '11' }) },
          { height: frameTo, opacity: open ? '1' : '0', visibility: 'visible', ...(open ? {} : { zIndex: '11' }) }
        ], { duration, easing });
        running.push(animation);
      });
      const content = layers.content.animate([
        { opacity: previous?.contentOpacity || (open ? '0' : '1'),
          transform: previous?.contentTransform || (open ? 'translateY(-6px)' : 'translateY(0px)'),
          clipPath: previous?.contentClip || (open ? 'inset(0 0 100% 0)' : 'inset(0 0 0% 0)'), visibility: 'visible' },
        { opacity: open ? '1' : '0', transform: open ? 'translateY(0px)' : 'translateY(-4px)',
          clipPath: open ? 'inset(0 0 0% 0)' : 'inset(0 0 100% 0)', visibility: 'visible' }
      ], { duration, easing });
      running.push(content);
      content.onfinish = () => { if (generation === currentGeneration) finish(); };
      watchMotionPreference(layers);
    } catch (_error) {
      // Older browser implementations may reject a keyframe; keep search usable.
      cancel();
    }
  }

  // Retarget an in-flight reveal from its drawn geometry. Mutating a CSS
  // variable in a running height keyframe would otherwise jump to the new end.
  function retargetReveal(layers: Layers, fromHeight: number, toHeight: number, anchorHeight: number): void {
    if (running.length !== 3 || !layers.surface) return;
    const [surfaceAnimation, outlineAnimation, contentAnimation] = running;
    const effects = running.map((animation) => animation.effect);
    if (typeof KeyframeEffect !== 'function' || !effects.every((effect) => effect instanceof KeyframeEffect)) {
      const previous = capture(layers);
      if (previous) {
        previous.height = fromHeight;
        previous.contentClip = `inset(0 0 ${Math.max(0, toHeight - fromHeight)}px 0)`;
        play(true, layers, anchorHeight, previous);
      }
      return;
    }
    const contentStyle = win.getComputedStyle(layers.content);
    const clipped = Math.max(0, Math.min(toHeight - anchorHeight, toHeight - fromHeight));
    [surfaceAnimation, outlineAnimation].forEach((animation) => {
      if (!(animation.effect instanceof KeyframeEffect)) return;
      animation.effect.setKeyframes([
        { height: `${fromHeight}px`, opacity: '1', visibility: 'visible' },
        { height: `${toHeight}px`, opacity: '1', visibility: 'visible' }
      ]);
      animation.effect.updateTiming({ duration: 160, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
      animation.currentTime = 0;
    });
    if (contentAnimation.effect instanceof KeyframeEffect) {
      contentAnimation.effect.setKeyframes([
        { opacity: contentStyle.opacity, transform: contentStyle.transform === 'none' ? 'translateY(0px)' : contentStyle.transform,
          clipPath: `inset(0 0 ${clipped}px 0)`, visibility: 'visible' },
        { opacity: '1', transform: 'translateY(0px)', clipPath: 'inset(0 0 0px 0)', visibility: 'visible' }
      ]);
      contentAnimation.effect.updateTiming({ duration: 160, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
      contentAnimation.currentTime = 0;
    }
  }

  // A new result batch may change the frame's natural height. Keep the rows
  // already visible, and reveal only the space newly added below them.
  function resize(layers: Layers, fromHeight: number, toHeight: number, anchorHeight: number): void {
    if (!enabled(layers) || !layers.surface || !layers.outline || fromHeight <= 0 || toHeight <= 0) return;
    if (mode === 'visibility') {
      try { retargetReveal(layers, fromHeight, toHeight, anchorHeight); } catch (_error) { cancel(); }
      return;
    }
    if (Math.abs(toHeight - fromHeight) < 1) {
      cancel();
      return;
    }
    const previous = capture(layers);
    const startHeight = previous?.height || fromHeight;
    cancel();
    mode = 'resize';
    const currentGeneration = generation;
    try {
      const timing = { duration: 160, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };
      [layers.surface, layers.outline].forEach((element) => {
        if (!element) return;
        running.push(element.animate([
          { height: `${startHeight}px` }, { height: `${toHeight}px` }
        ], timing));
      });
      if (toHeight > startHeight) {
        const clipped = Math.max(0, Math.min(toHeight - anchorHeight, toHeight - startHeight));
        running.push(layers.content.animate([
          { clipPath: `inset(0 0 ${clipped}px 0)` },
          { clipPath: 'inset(0 0 0% 0)' }
        ], timing));
      }
      const last = running[running.length - 1];
      if (last) {
        last.onfinish = () => { if (generation === currentGeneration) finish(); };
        watchMotionPreference(layers);
      }
    } catch (_error) {
      cancel();
    }
  }

  return { capture, cancel, play, resize };
}

export { createSuggestionsMotion };
