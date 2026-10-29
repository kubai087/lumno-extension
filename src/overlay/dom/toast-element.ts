// The overlay's toast element in the panel's shadow root, and the toast
// stylesheet the root already holds.
interface OverlayToastElement {
  element: HTMLDivElement;
  stylesheet: HTMLElement | null;
}

function createOverlayToastElement(doc: Document, styleRoot: ShadowRoot): OverlayToastElement {
  const element = doc.createElement('div');
  element.id = '_x_extension_overlay_toast_2026_unique_';
  element.className = '_x_extension_overlay_toast_2026_unique_ x-lumno-toast';
  element.style.setProperty('--x-lumno-toast-top', 'max(24px, calc(20vh - 48px))');
  element.style.setProperty('--x-lumno-toast-z-index', '2147483647');
  element.setAttribute('data-show', 'false');
  element.setAttribute('role', 'status');
  element.setAttribute('aria-live', 'polite');
  return {
    element,
    stylesheet: styleRoot.getElementById('_x_extension_toast_style_2026_unique_')
  };
}

export { createOverlayToastElement };
export type { OverlayToastElement };
