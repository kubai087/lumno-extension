
// Stylesheet for the toolbar's closed shadow root.
const SELECTION_SURFACE_STYLES = `
    :host {
      all: initial;
      position: fixed;
      z-index: 2147483647;
      display: block;
      box-sizing: border-box;
      width: max-content;
      height: max-content;
      margin: 0;
      padding: 0;
      border: 0;
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
      transform: none;
      filter: none;
      overflow: visible;
      isolation: isolate;
      mix-blend-mode: normal;
      contain: layout style;
      color-scheme: light dark;
      font-family: "Open Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    :host([hidden]) { display: none; }
    :host::before,
    :host::after {
      content: none !important;
      display: none !important;
    }
    .lumno-selection-surface {
      --lumno-selection-surface-radius: 13px;
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: flex-start;
      gap: 0;
      height: 38px;
      padding: 3px;
      border: 1px solid transparent;
      border-radius: var(--lumno-selection-surface-radius);
      background: transparent;
      color: light-dark(#18181b, #e7e8eb);
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
      box-shadow: none;
      opacity: 0;
      transform: translateY(-3px) scale(0.96);
      transition: opacity 140ms ease, transform 160ms ease;
      box-sizing: border-box;
      overflow: visible;
      contain: layout style;
    }
    .lumno-selection-material {
      position: absolute;
      inset: 0 auto 0 0;
      z-index: 0;
      width: 100%;
      box-sizing: border-box;
      overflow: hidden;
      border: 1px solid light-dark(rgba(15, 23, 42, 0.12), rgba(255, 255, 255, 0.13));
      border-radius: inherit;
      background: light-dark(rgba(244, 245, 247, 0.94), rgba(26, 27, 31, 0.92));
      -webkit-backdrop-filter: blur(14px) saturate(130%);
      backdrop-filter: blur(14px) saturate(130%);
      box-shadow:
        inset 0 0 0 1px light-dark(rgba(255, 255, 255, 0.3), transparent),
        0 8px 24px light-dark(rgba(15, 23, 42, 0.14), rgba(0, 0, 0, 0.38)),
        0 2px 6px light-dark(rgba(15, 23, 42, 0.08), rgba(0, 0, 0, 0.24));
      pointer-events: none;
    }
    .lumno-selection-material::before {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: calc(var(--lumno-selection-surface-radius) - 1px);
      background:
        radial-gradient(125% 165% at 50% -38%, light-dark(rgba(255, 255, 255, 0.76), rgba(255, 255, 255, 0.16)) 0%, transparent 72%),
        radial-gradient(115% 145% at 50% 138%, light-dark(rgba(255, 255, 255, 0.28), rgba(255, 255, 255, 0.08)) 0%, transparent 78%);
      pointer-events: none;
    }
    .lumno-selection-surface > * {
      position: relative;
      z-index: 1;
    }
    .lumno-selection-surface > .lumno-selection-material {
      position: absolute;
      z-index: 0;
    }
    .lumno-selection-surface[data-icon-only="true"] {
      height: auto;
      padding: 0;
      border: 0;
      background: transparent;
      box-shadow: none;
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
      overflow: visible;
    }
    .lumno-selection-surface[data-icon-only="true"] .lumno-selection-material { display: none; }
    .lumno-selection-surface[data-icon-only="true"] .lumno-selection-content {
      flex: 0 0 auto;
      overflow: visible;
    }
    .lumno-selection-surface[data-icon-only="false"] {
      padding-inline-end: 1px;
    }
    :host([data-visible="true"]) .lumno-selection-surface {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    button {
      appearance: none;
      border: 0;
      margin: 0;
      padding: 0 8px;
      min-height: 30px;
      border-radius: 9px;
      corner-shape: superellipse(1.25);
      background: transparent;
      color: inherit;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      font: 400 12px/1.2 "Open Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      white-space: nowrap;
      cursor: pointer;
    }
    button:hover, button:focus-visible {
      background: light-dark(rgba(15, 23, 42, 0.065), rgba(255, 255, 255, 0.1));
      outline: none;
    }
    button:focus-visible {
      box-shadow: inset 0 0 0 1px light-dark(rgba(15, 23, 42, 0.2), rgba(255, 255, 255, 0.28));
    }
    button:disabled { opacity: 0.56; cursor: default; }
    .lumno-selection-main[data-icon-only="true"] {
      position: relative;
      width: 18px;
      min-height: 18px;
      padding: 0;
      border-radius: 5px;
      background: rgba(255, 255, 255, 0.86);
      box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.1), 0 1px 3px rgba(15, 23, 42, 0.16);
      -webkit-backdrop-filter: blur(10px) saturate(150%);
      backdrop-filter: blur(10px) saturate(150%);
      opacity: 0;
      transform: translateY(2px) scale(0.9);
      transition: background 120ms ease, backdrop-filter 120ms ease,
        opacity 160ms ease, transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    .lumno-selection-main[data-icon-only="true"]::before {
      content: "";
      position: absolute;
      inset: -5px;
    }
    .lumno-selection-main[data-icon-only="true"] .lumno-selection-label { display: none; }
    .lumno-selection-main[data-icon-only="false"] {
      width: 30px;
      min-height: 30px;
      padding: 0;
    }
    .lumno-selection-main[data-icon-only="false"] .lumno-selection-label { display: none; }
    .lumno-selection-main[data-icon-only="false"],
    .lumno-selection-primary-divider,
    .lumno-selection-toolbar {
      flex: 0 0 auto;
    }
    .lumno-selection-logo { width: 17px; height: 17px; display: block; }
    .lumno-selection-main[data-icon-only="true"] .lumno-selection-logo {
      width: 12px;
      height: 12px;
      filter: brightness(0.28) contrast(1.18);
      opacity: 0.9;
    }
    .lumno-selection-surface[data-icon-only="true"] .lumno-selection-main {
      transition: background 120ms ease, backdrop-filter 120ms ease,
        opacity 160ms ease, transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    .lumno-selection-surface[data-icon-only="true"] .lumno-selection-main:hover {
      background: rgba(255, 255, 255, 0.94);
      -webkit-backdrop-filter: blur(10px) saturate(140%);
      backdrop-filter: blur(10px) saturate(140%);
    }
    .lumno-selection-surface[data-icon-only="true"] .lumno-selection-main:focus-visible {
      background: rgba(255, 255, 255, 0.94);
    }
    :host([data-visible="true"]) .lumno-selection-main[data-icon-only="true"] {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    :host([data-entry-contrast="dark"]) .lumno-selection-main[data-icon-only="true"] {
      background: rgba(19, 22, 28, 0.32);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.09), 0 1px 3px rgba(0, 0, 0, 0.18);
    }
    :host([data-entry-contrast="dark"]) .lumno-selection-main[data-icon-only="true"] .lumno-selection-logo {
      filter: brightness(1.45) contrast(0.88) drop-shadow(0 0 1px rgba(0, 0, 0, 0.2));
      opacity: 0.84;
    }
    :host([data-entry-contrast="mixed"]) .lumno-selection-main[data-icon-only="true"] {
      background: rgba(250, 250, 250, 0.3);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18), 0 1px 3px rgba(0, 0, 0, 0.14);
    }
    :host([data-entry-contrast="mixed"]) .lumno-selection-main[data-icon-only="true"] .lumno-selection-logo {
      filter: brightness(0.62) contrast(1.05) drop-shadow(0 0 1px rgba(255, 255, 255, 0.72));
      opacity: 0.86;
    }
    .lumno-selection-content {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      flex: 0 1 auto;
      min-width: 0;
      border-radius: 2px;
      overflow: hidden;
    }
    .lumno-selection-toolbar {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      transform-origin: left center;
      gap: 0;
    }
    .lumno-selection-primary-divider {
      display: block;
      width: 1px;
      height: 18px;
      margin-inline: 3px;
      background: light-dark(rgba(15, 23, 42, 0.12), rgba(255, 255, 255, 0.16));
      pointer-events: none;
    }
    .lumno-selection-actions-viewport {
      display: flex;
      align-items: center;
      flex: 0 1 auto;
      min-width: 0;
      justify-content: flex-end;
      overflow: hidden;
    }
    .lumno-selection-toolbar:focus {
      outline: none;
    }
    .lumno-selection-toolbar button {
      position: relative;
    }
    .lumno-selection-toolbar button + button {
      margin-inline-start: 7px;
    }
    .lumno-selection-toolbar button + button::before {
      content: "";
      position: absolute;
      inset-inline-start: -4px;
      top: 50%;
      width: 1px;
      height: 18px;
      background: light-dark(rgba(15, 23, 42, 0.12), rgba(255, 255, 255, 0.16));
      transform: translateY(-50%);
      pointer-events: none;
    }
    .lumno-selection-toolbar:hover button:focus-visible:not(:hover) {
      background: transparent;
      box-shadow: none;
    }
    .lumno-selection-toolbar[hidden],
    .lumno-selection-main[hidden],
    .lumno-selection-primary-divider[hidden],
    .lumno-selection-actions-viewport[hidden] { display: none; }
    .lumno-selection-action-icon {
      width: 16px;
      height: 16px;
      flex: 0 0 auto;
      display: block;
      color: currentColor;
    }
    .lumno-selection-action-label {
      display: block;
      overflow: hidden;
    }
    .lumno-selection-surface[data-toolbar-entrance-mode="fallback"] .lumno-selection-material {
      transition: width 240ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    .lumno-selection-surface[data-toolbar-entrance-mode="fallback"][data-toolbar-entrance-state="from"] .lumno-selection-material {
      width: 0;
    }
    .lumno-selection-surface[data-toolbar-entrance-mode="fallback"][data-toolbar-entrance-state="to"] .lumno-selection-material {
      width: var(--lumno-toolbar-expanded-width);
    }
    .lumno-selection-surface[data-toolbar-entrance-mode="fallback"] .lumno-selection-content {
      transition: width 260ms cubic-bezier(0.22, 1, 0.36, 1) 20ms;
    }
    .lumno-selection-surface[data-toolbar-entrance-mode="fallback"][data-toolbar-entrance-state="from"] .lumno-selection-content {
      width: 0;
    }
    .lumno-selection-surface[data-toolbar-entrance-mode="fallback"][data-toolbar-entrance-state="to"] .lumno-selection-content {
      width: var(--lumno-toolbar-content-width);
    }
    .lumno-selection-surface[data-toolbar-entrance-mode="fallback"] .lumno-selection-toolbar {
      transition:
        transform 280ms cubic-bezier(0.22, 1, 0.36, 1) 30ms,
        opacity 180ms ease-out 50ms;
    }
    .lumno-selection-surface[data-toolbar-entrance-mode="fallback"][data-toolbar-entrance-state="from"] .lumno-selection-toolbar {
      opacity: 0.72;
      transform: translateX(calc(-1 * var(--lumno-toolbar-content-offset)));
    }
    .lumno-selection-surface[data-toolbar-entrance-mode="fallback"][data-toolbar-entrance-state="to"] .lumno-selection-toolbar {
      opacity: 1;
      transform: translateX(0);
    }
    @supports (corner-shape: superellipse(1.25)) {
      .lumno-selection-surface,
      .lumno-selection-material,
      .lumno-selection-material::before {
        corner-shape: superellipse(1.25);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .lumno-selection-surface,
      .lumno-selection-main[data-icon-only="true"] {
        transition: none;
      }
      .lumno-selection-surface[data-toolbar-entrance-mode="fallback"] .lumno-selection-material,
      .lumno-selection-surface[data-toolbar-entrance-mode="fallback"] .lumno-selection-content,
      .lumno-selection-surface[data-toolbar-entrance-mode="fallback"] .lumno-selection-toolbar {
        transition: none;
      }
    }
  `;

export {
  SELECTION_SURFACE_STYLES
};
