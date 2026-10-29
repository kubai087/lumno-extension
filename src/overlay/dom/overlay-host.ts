// The overlay's host element in the page, made outside React: the closed
// shadow root's host, kept out of the page's styles.
import type { OverlayShellOptions } from './overlay-styles';
import { OVERLAY_HOST_ID } from '../../domain/injected-commands';

function createOverlayHost(
  doc: Document,
  options: OverlayShellOptions
): HTMLElement {
  const host = doc.createElement('div');
  host.id = String(
    options.hostId || '_x_extension_overlay_host_2026_unique_'
  );
  host.dataset.lumnoOverlayHost = 'true';
  host.setAttribute('popover', 'manual');
  host.style.cssText = `
    all: initial !important;
    position: fixed !important;
    inset: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    overflow: visible !important;
    transform: none !important;
    filter: none !important;
    clip: auto !important;
    clip-path: none !important;
    mask: none !important;
    -webkit-mask: none !important;
    content-visibility: visible !important;
    isolation: isolate !important;
    z-index: 2147483647 !important;
    pointer-events: none !important;
    contain: layout style paint !important;
    background: transparent !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    box-sizing: border-box !important;
    color: initial !important;
    font-family: 'Lumno Open Sans', 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
    font-size: 16px !important;
    font-style: normal !important;
    font-variant: normal !important;
    font-weight: 400 !important;
    letter-spacing: normal !important;
    line-height: 1 !important;
    text-align: initial !important;
    text-decoration: none !important;
    text-shadow: none !important;
    text-transform: none !important;
    word-spacing: normal !important;
  `;
  return host;
}

// Key handlers outside the panel see the closed shadow host, not the input in
// it, as the target of the keys typed there, and run their single-key
// shortcuts unless that target is editable (Surfingkeys, #127). The host is
// editable while focus is in the panel, turning so only after each focus
// event has passed the page: Surfingkeys blurs an editable that takes focus
// before the user clicks the page.
function markHostEditableWhileFocused(host: HTMLElement, shadowRoot: ShadowRoot): void {
  shadowRoot.addEventListener('focus', () => {
    host.setAttribute('contenteditable', 'plaintext-only');
  }, true);
  shadowRoot.addEventListener('blur', () => {
    host.removeAttribute('contenteditable');
  }, true);
}

// An element by its id in a page or a shadow root.
function getElementInRoot(root: Document | ShadowRoot | null, id: string): HTMLElement | null {
  return root ? root.getElementById(id) : null;
}

// The overlay's host, while it is in the page.
function isOverlayHostInPage(doc: Document): boolean {
  const host = doc.getElementById(OVERLAY_HOST_ID);
  return Boolean(host && host.isConnected);
}

export { createOverlayHost, getElementInRoot, isOverlayHostInPage, markHostEditableWhileFocused };
