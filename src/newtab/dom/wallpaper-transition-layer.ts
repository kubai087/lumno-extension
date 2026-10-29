// A copy of the wallpaper on screen that fades out over a change, so the
// next wallpaper or filter cross-fades in instead of cutting over.
import { shouldReduceMotion } from '../wallpaper/runtime/motion';

const WALLPAPER_VISUAL_TRANSITION_MS = 220;
const WALLPAPER_FILTER_TRANSITION_MS = 180;

// Null while the page is still entering or motion is reduced.
function createWallpaperTransitionLayer(document: Document, window: Window): HTMLDivElement | null {
  if (!document.body ||
      document.body.getAttribute('data-nt-enter') !== 'done' ||
      shouldReduceMotion(window)) {
    return null;
  }
  const computedStyle = window.getComputedStyle(document.body);
  const layer = document.createElement('div');
  layer.className = 'x-nt-wallpaper-transition-layer';
  layer.style.backgroundColor = computedStyle.backgroundColor;
  if (document.body.getAttribute('data-wallpaper-effect') === 'blur') {
    layer.setAttribute('data-wallpaper-effect', 'blur');
    layer.style.backgroundImage =
      computedStyle.getPropertyValue('--x-nt-wallpaper-image').trim() || 'none';
    layer.style.backgroundSize =
      computedStyle.getPropertyValue('--x-nt-wallpaper-size').trim() || 'cover';
    layer.style.backgroundPosition =
      computedStyle.getPropertyValue('--x-nt-wallpaper-position').trim() || 'center center';
    [
      '--x-nt-wallpaper-blur-overscan',
      '--x-nt-wallpaper-blur-radius',
      '--x-nt-wallpaper-blur-saturate',
      '--x-nt-wallpaper-blur-brightness',
      '--x-nt-wallpaper-blur-contrast'
    ].forEach((propertyName) => {
      const propertyValue = computedStyle.getPropertyValue(propertyName).trim();
      if (propertyValue) {
        layer.style.setProperty(propertyName, propertyValue);
      }
    });
  } else {
    layer.style.backgroundImage = computedStyle.backgroundImage;
    layer.style.backgroundSize = computedStyle.backgroundSize;
    layer.style.backgroundPosition = computedStyle.backgroundPosition;
  }
  layer.style.backgroundRepeat = computedStyle.backgroundRepeat;
  layer.style.backgroundAttachment = 'fixed';
  document.body.insertBefore(layer, document.body.firstChild);
  return layer;
}

function releaseWallpaperTransitionLayer(window: Window, layer: HTMLElement | null | undefined): void {
  if (!layer || !layer.parentNode) {
    return;
  }
  window.requestAnimationFrame(() => {
    layer.setAttribute('data-exit', 'true');
    window.setTimeout(() => {
      if (layer.parentNode) {
        layer.parentNode.removeChild(layer);
      }
    }, (layer.getAttribute('data-wallpaper-filter-transition') === 'true'
      ? WALLPAPER_FILTER_TRANSITION_MS
      : WALLPAPER_VISUAL_TRANSITION_MS) + 80);
  });
}

export {
  WALLPAPER_FILTER_TRANSITION_MS,
  WALLPAPER_VISUAL_TRANSITION_MS,
  createWallpaperTransitionLayer,
  releaseWallpaperTransitionLayer
};
