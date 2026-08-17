import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';

type OverlayShellOptions = Record<string, unknown> & {
  cursorTooltipCssUrl?: string;
  featureHintsCssUrl?: string;
  hostId?: string;
  id?: string;
  maxHeightVh?: number;
  openSansCssUrl?: string;
  overlaySuggestionsCssUrl?: string;
  remixBrush2IconSvgUrl?: string;
  remixIconCssUrl?: string;
  remixSearchIconSvgUrl?: string;
  remixSettingsIconSvgUrl?: string;
  root?: Document | DocumentFragment | HTMLElement | ShadowRoot | null;
  searchInputCssUrl?: string;
  toastCssUrl?: string;
  tooltipCssUrl?: string;
  width?: number;
};

interface OverlayMount {
  host: HTMLElement;
  panel: HTMLElement;
  root: ShadowRoot | null;
}

function findById(
  rootNode: OverlayShellOptions['root'],
  id: string
): HTMLElement | null {
  if (!rootNode || !id) {
    return null;
  }
  if ('getElementById' in rootNode) {
    return rootNode.getElementById(id);
  }
  return rootNode.querySelector<HTMLElement>(
    `[id="${id.replace(/["\\]/g, '\\$&')}"]`
  );
}

function appendStylesheet(
  doc: Document,
  rootNode: NonNullable<OverlayShellOptions['root']>,
  id: string,
  href: unknown
): void {
  const url = String(href || '');
  if (!url || findById(rootNode, id)) {
    return;
  }
  const link = doc.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = url;
  rootNode.appendChild(link);
}

function getRuntimeAssetUrl(path: string): string {
  const chromeApi = (
    globalThis as typeof globalThis & {
      chrome?: { runtime?: { getURL?(assetPath: string): string } };
    }
  ).chrome;
  return chromeApi?.runtime?.getURL?.(path) || '';
}

function getRemixIconAssetUrl(
  configuredUrl: unknown,
  assetPath: string
): string {
  return String(configuredUrl || '') || getRuntimeAssetUrl(assetPath);
}

function getCssUrl(value: string): string {
  const url = String(value || '').trim();
  if (!url) {
    return '';
  }
  return `url("${url.replace(/["\\\\\n\r\f]/g, '\\$&')}")`;
}

function getRemixIconMaskCss(url: string): string {
  const cssUrl = getCssUrl(url);
  if (!cssUrl) {
    return 'display: none;';
  }
  return `
      -webkit-mask-image: ${cssUrl};
      mask-image: ${cssUrl};
      -webkit-mask-position: center;
      mask-position: center;
      -webkit-mask-repeat: no-repeat;
      mask-repeat: no-repeat;
      -webkit-mask-size: contain;
      mask-size: contain;
  `;
}

function appendOverlayStyleNodes(
  doc: Document,
  options: OverlayShellOptions = {}
): void {
  const styleRoot =
    options.root || doc.head || doc.documentElement;
  if (!styleRoot) {
    return;
  }
  const searchIconUrl = getRemixIconAssetUrl(
    options.remixSearchIconSvgUrl,
    'assets/remixicon/icons/search-line.svg'
  );
  const settingsIconUrl = getRemixIconAssetUrl(
    options.remixSettingsIconSvgUrl,
    'assets/remixicon/icons/settings-line.svg'
  );
  const brush2IconUrl = getRemixIconAssetUrl(
    options.remixBrush2IconSvgUrl,
    'assets/remixicon/icons/brush-2-line.svg'
  );

  appendStylesheet(
    doc,
    styleRoot,
    '_x_extension_open_sans_shadow_css_2026_unique_',
    options.openSansCssUrl
  );
  appendStylesheet(
    doc,
    styleRoot,
    '_x_extension_remixicon_shadow_css_2026_unique_',
    options.remixIconCssUrl
  );
  appendStylesheet(
    doc,
    styleRoot,
    '_x_extension_input_component_style_2026_unique_',
    options.searchInputCssUrl
  );
  appendStylesheet(
    doc,
    styleRoot,
    '_x_extension_feature_hints_style_2026_unique_',
    options.featureHintsCssUrl
  );
  appendStylesheet(
    doc,
    styleRoot,
    '_x_extension_tooltip_component_style_2026_unique_',
    options.tooltipCssUrl
  );
  appendStylesheet(
    doc,
    styleRoot,
    '_x_extension_cursor_tooltip_component_style_2026_unique_',
    options.cursorTooltipCssUrl
  );
  appendStylesheet(
    doc,
    styleRoot,
    '_x_extension_toast_style_2026_unique_',
    options.toastCssUrl
  );
  appendStylesheet(
    doc,
    styleRoot,
    '_x_extension_overlay_suggestions_style_2026_unique_',
    options.overlaySuggestionsCssUrl
  );

  if (
    findById(styleRoot, '_x_extension_scrollbar_style_2024_unique_') ||
    findById(styleRoot, '_x_extension_overlay_theme_style_2024_unique_')
  ) {
    return;
  }

  const scrollbarStyle = doc.createElement('style');
  scrollbarStyle.id = '_x_extension_scrollbar_style_2024_unique_';
  scrollbarStyle.textContent = `
    #_x_extension_overlay_2024_unique_ *::-webkit-scrollbar {
      display: none;
    }
    #_x_extension_overlay_2024_unique_ * {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
  `;
  styleRoot.appendChild(scrollbarStyle);

  const overlayThemeStyle = doc.createElement('style');
  overlayThemeStyle.id = '_x_extension_overlay_theme_style_2024_unique_';
  overlayThemeStyle.textContent = `
    /*
      First-frame safety net for the dynamically loaded component stylesheets.
      These selectors deliberately have zero specificity, so the complete
      component styles take over as soon as their links are ready.
    */
    :where(#_x_extension_overlay_2024_unique_) :where(.x-lumno-search-input, .x-lumno-search-input__container) {
      all: unset;
      position: relative;
      display: block;
      width: 100%;
      flex-shrink: 0;
      box-sizing: border-box;
      overflow: hidden;
      background: transparent;
      color: inherit;
      font: inherit;
      line-height: 1;
      border-radius: var(--x-ext-search-input-corners, 28px 28px 0 0);
    }
    :where(#_x_extension_overlay_2024_unique_) :where(.x-lumno-search-input__field) {
      all: unset;
      display: block;
      width: 100%;
      box-sizing: border-box;
      min-height: 56px;
      padding: 0 92px 0 50px;
      border: 0;
      outline: 0;
      background: transparent;
      color: var(--x-ext-input-text, #1F2937);
      caret-color: var(--x-ext-input-caret, #7DB7FF);
      cursor: text;
      font: 500 16px/1.3 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      text-align: left;
    }
    :where(#_x_extension_overlay_2024_unique_) :where(.x-lumno-search-input__icon) {
      all: unset;
      position: absolute;
      top: 50%;
      left: 13px;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 6px 0;
      color: var(--x-ext-input-icon, #9CA3AF);
      line-height: 1;
      transform: translateY(-50%);
      pointer-events: none;
    }
    :where(#_x_extension_overlay_2024_unique_) :where(.x-lumno-search-input__divider) {
      all: unset;
      position: absolute;
      right: var(--x-ext-input-divider-inset, 20px);
      bottom: 0;
      left: var(--x-ext-input-divider-inset, 20px);
      display: block;
      height: 1px;
      background: var(--x-ext-input-underline, #E5E7EB);
      opacity: var(--x-ext-input-divider-opacity, 0.55);
      pointer-events: none;
    }
    :where(#_x_extension_overlay_2024_unique_) :where(.x-lumno-search-input__right-icon, .x-ov-close-other-tabs) {
      all: unset;
      position: absolute;
      top: var(--x-ext-input-right-icon-inset, 13px);
      z-index: 2;
      display: inline-flex;
      width: 30px;
      height: 30px;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      border: 0;
      border-radius: var(--x-ext-input-right-icon-radius, 16px);
      padding: 0;
      background: transparent;
      color: var(--x-ext-input-icon, #9CA3AF);
      cursor: pointer;
      font-size: 0;
      line-height: 1;
    }
    :where(#_x_extension_overlay_2024_unique_) :where(.x-lumno-search-input__right-icon) {
      right: var(--x-ext-input-right-icon-inset, 13px);
    }
    :where(#_x_extension_overlay_2024_unique_) :where(.x-ov-close-other-tabs) {
      right: calc(var(--x-ext-input-right-icon-inset, 13px) + 36px);
    }
    :where(#_x_extension_overlay_2024_unique_[data-lumno-site-fix-style-fallback]) :where(.x-ov-suggestions-container) {
      visibility: hidden;
    }
    :where(#_x_extension_overlay_2024_unique_[data-lumno-site-fix-style-fallback]) :where(.x-lumno-search-input__icon) {
      width: 16px;
      height: 16px;
      padding: 0;
    }
    :where(#_x_extension_overlay_2024_unique_) :where(
      .x-lumno-search-input__icon .ri-icon,
      .x-lumno-search-input__right-icon .ri-icon,
      .x-ov-close-other-tabs .ri-icon
    ) {
      visibility: hidden;
    }
    /* Cached official Remix SVG masks keep these controls icon-ready before or
       after the delayed icon-font stylesheet. currentColor inherits the
       Overlay's light/dark theme token. */
    :where(#_x_extension_overlay_2024_unique_) :where(.x-lumno-search-input__icon)::before {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 16px;
      height: 16px;
      background-color: currentColor;
      content: '';
      transform: translate(-50%, -50%);
      ${getRemixIconMaskCss(searchIconUrl)}
    }
    :where(#_x_extension_overlay_2024_unique_) :where(.x-lumno-search-input__right-icon)::before {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 16px;
      height: 16px;
      background-color: currentColor;
      content: '';
      transform: translate(-50%, -50%);
      ${getRemixIconMaskCss(settingsIconUrl)}
    }
    :where(#_x_extension_overlay_2024_unique_) :where(.x-ov-close-other-tabs)::before {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 16px;
      height: 16px;
      background-color: currentColor;
      content: '';
      transform: translate(-50%, -50%);
      ${getRemixIconMaskCss(brush2IconUrl)}
    }
    :where(#_x_extension_overlay_2024_unique_[data-lumno-site-fix-style-fallback]) :where(
      .x-lumno-search-input-mode__prefix,
      .x-lumno-search-input-mode__badge,
      .x-lumno-search-input-mode__tab-hint
    ) {
      display: none;
    }
    #_x_extension_overlay_2024_unique_ .ri-icon {
      width: var(--ri-size, 16px);
      height: var(--ri-size, 16px);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      font-size: var(--ri-size, 16px);
      flex-shrink: 0;
      font-style: normal;
      font-variant: normal;
      text-transform: none;
    }
    #_x_extension_overlay_2024_unique_ button:not(:disabled),
    #_x_extension_overlay_2024_unique_ a[href],
    #_x_extension_overlay_2024_unique_ [role="button"]:not([aria-disabled="true"]),
    #_x_extension_overlay_2024_unique_ [role="menuitem"]:not([aria-disabled="true"]),
    #_x_extension_overlay_2024_unique_ [role="option"]:not([aria-disabled="true"]) {
      cursor: pointer;
    }
    :where(#_x_extension_overlay_2024_unique_) :where(.x-ov-suggestion-switch-button) {
      -webkit-appearance: none;
      appearance: none;
      background: var(--x-ov-suggestion-action-button-bg, transparent);
      border: 0;
      border-radius: 6px;
      box-sizing: border-box;
      color: var(--x-ov-suggestion-action-button-text, var(--x-ov-subtext, #9CA3AF));
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font: inherit;
      font-size: 12px;
      line-height: 1;
      height: var(--x-ov-suggestion-action-height, 26px);
      padding: 0 var(--x-ov-suggestion-action-icon-end, 7px) 0 var(--x-ov-suggestion-action-button-start, 10px);
    }
    #_x_extension_overlay_2024_unique_ button *,
    #_x_extension_overlay_2024_unique_ a[href] *,
    #_x_extension_overlay_2024_unique_ [role="button"] *,
    #_x_extension_overlay_2024_unique_ [role="menuitem"] *,
    #_x_extension_overlay_2024_unique_ [role="option"] *,
    #_x_extension_overlay_2024_unique_ .x-ov-suggestion-item * {
      cursor: inherit;
    }
    #_x_extension_overlay_2024_unique_ button .ri-icon,
    #_x_extension_overlay_2024_unique_ a[href] .ri-icon,
    #_x_extension_overlay_2024_unique_ [role="button"] .ri-icon,
    #_x_extension_overlay_2024_unique_ .x-ov-suggestion-item .ri-icon {
      pointer-events: none;
    }
    #_x_extension_overlay_2024_unique_ button:disabled,
    #_x_extension_overlay_2024_unique_ [role="button"][aria-disabled="true"],
    #_x_extension_overlay_2024_unique_ [role="menuitem"][aria-disabled="true"],
    #_x_extension_overlay_2024_unique_ [role="option"][aria-disabled="true"] {
      cursor: not-allowed;
    }
    #_x_extension_overlay_2024_unique_ button[aria-busy="true"]:disabled,
    #_x_extension_overlay_2024_unique_ [role="button"][aria-busy="true"] {
      cursor: progress;
    }
    #_x_extension_overlay_2024_unique_ [role="img"][data-tooltip] {
      cursor: help;
    }
    #_x_extension_overlay_2024_unique_ .ri-icon::before {
      font-style: normal;
      font-variant: normal;
      text-transform: none;
    }
    #_x_extension_overlay_2024_unique_ .ri-size-8 { --ri-size: 8px; }
    #_x_extension_overlay_2024_unique_ .ri-size-12 { --ri-size: 12px; }
    #_x_extension_overlay_2024_unique_ .ri-size-16 { --ri-size: 16px; }
    #_x_extension_overlay_2024_unique_ .ri-size-20 { --ri-size: 20px; }
    #_x_extension_overlay_2024_unique_ .ri-size-24 { --ri-size: 24px; }
    #_x_extension_search_input_2024_unique_ {
      text-align: left;
    }
    #_x_extension_search_input_2024_unique_::placeholder {
      color: var(--x-ov-placeholder, #9CA3AF);
      opacity: 0.68;
      text-align: left;
    }
    #_x_extension_search_input_2024_unique_::-webkit-input-placeholder {
      color: var(--x-ov-placeholder, #9CA3AF);
      opacity: 0.68;
    }
    #_x_extension_search_input_2024_unique_::selection {
      background: #CFE8FF;
      color: #1E3A8A;
    }
  `;
  styleRoot.appendChild(overlayThemeStyle);
}

function supportsCornerShape(doc: Document): boolean {
  const win = doc.defaultView;
  return Boolean(
    win?.CSS &&
      typeof win.CSS.supports === 'function' &&
      win.CSS.supports('corner-shape', 'superellipse(1.25)')
  );
}

const OVERLAY_PANEL_REST_TRANSFORM =
  'translateX(-50%) translateY(0) scale(var(--x-ov-visible-scale, 1))';

function getPanelStyle(options: OverlayShellOptions): string {
  const width = Number(options.width) || 760;
  const maxHeightVh = Number(options.maxHeightVh) || 75;
  return `
    all: unset;
    position: fixed !important;
    top: 20vh !important;
    left: 50% !important;
    transform: ${OVERLAY_PANEL_REST_TRANSFORM} !important;
    transform-origin: top center !important;
    width: ${width}px !important;
    max-width: calc(100vw - 24px) !important;
    max-height: ${maxHeightVh}vh !important;
    --x-ov-panel-radius: 28px;
    background: var(--x-ov-bg, rgba(255, 255, 255, 0.95)) !important;
    backdrop-filter: blur(var(--x-ov-blur, 24px)) saturate(var(--x-ov-saturate, 165%)) !important;
    -webkit-backdrop-filter: blur(var(--x-ov-blur, 24px)) saturate(var(--x-ov-saturate, 165%)) !important;
    border: 1px solid var(--x-ov-border, rgba(0, 0, 0, 0.08)) !important;
    border-radius: var(--x-ov-panel-radius) !important;
    box-shadow: var(--x-ov-shadow, inset 0 1px 0 rgba(255, 255, 255, 0.72), 0 2px 5px -2px rgba(15, 23, 42, 0.11), 0 16px 42px -12px rgba(15, 23, 42, 0.17), 0 48px 112px -30px rgba(15, 23, 42, 0.19)) !important;
    z-index: 2147483647 !important;
    font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    pointer-events: auto !important;
    contain: layout style !important;
    box-sizing: border-box !important;
    margin: 0 !important;
    padding: 0 !important;
    line-height: 1 !important;
    text-decoration: none !important;
    list-style: none !important;
    outline: none !important;
    color: var(--x-ov-text, #111827) !important;
    font-size: 16px !important;
    font-style: normal !important;
    font-variant: normal !important;
    font-weight: 400 !important;
    letter-spacing: normal !important;
    word-spacing: normal !important;
    text-transform: none !important;
    text-shadow: none !important;
    vertical-align: baseline !important;
    opacity: 0 !important;
    filter: none !important;
    will-change: auto !important;
    transition: none !important;
  `;
}

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
    font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
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

function OverlayPanel({
  id,
  maxHeightVh,
  onMount,
  styleText,
  supportsSuperellipse,
  width
}: {
  id: string;
  maxHeightVh: number;
  onMount(panel: HTMLDivElement): void;
  styleText: string;
  supportsSuperellipse: boolean;
  width: number;
}) {
  const mountPanel = (panel: HTMLDivElement | null) => {
    if (!panel) {
      return;
    }
    panel.setAttribute('style', styleText);
    // JSDOM discards the declaration block because it does not understand
    // every Chromium-only value. Re-applying the layout contract also keeps
    // these critical values explicit for hostile-page style isolation.
    panel.style.setProperty('position', 'fixed', 'important');
    panel.style.setProperty('width', `${width}px`, 'important');
    panel.style.setProperty('max-height', `${maxHeightVh}vh`, 'important');
    panel.style.setProperty(
      'transform',
      OVERLAY_PANEL_REST_TRANSFORM,
      'important'
    );
    panel.style.setProperty('transition', 'none', 'important');
    panel.style.setProperty('filter', 'none', 'important');
    panel.style.setProperty('will-change', 'auto', 'important');
    if (supportsSuperellipse) {
      panel.style.setProperty(
        'corner-shape',
        'superellipse(1.25)',
        'important'
      );
    }
    onMount(panel);
  };
  return (
    <div
      data-lumno-overlay-panel="true"
      data-react-island="overlay-shell"
      id={id}
      ref={mountPanel}
    />
  );
}

export function createOverlayShellApi() {
  const roots = new WeakMap<HTMLElement, Root>();
  const panels = new WeakMap<HTMLElement, HTMLElement>();

  function createOverlayMount(
    doc: Document,
    options: OverlayShellOptions = {}
  ): OverlayMount | null {
    if (!doc || typeof doc.createElement !== 'function') {
      return null;
    }
    const host = createOverlayHost(doc, options);
    const shadowRoot =
      typeof host.attachShadow === 'function'
        ? host.attachShadow({ mode: 'closed' })
        : null;
    const renderRoot = shadowRoot || host;
    appendOverlayStyleNodes(doc, {
      ...options,
      root: shadowRoot || doc.head || doc.documentElement
    });

    let panel: HTMLDivElement | null = null;
    const registerPanel = (nextPanel: HTMLDivElement) => {
      panel = nextPanel;
    };
    const reactRoot = createRoot(renderRoot);
    flushSync(() => {
      reactRoot.render(
        <OverlayPanel
          id={String(
            options.id || '_x_extension_overlay_2024_unique_'
          )}
          maxHeightVh={Number(options.maxHeightVh) || 75}
          onMount={registerPanel}
          styleText={getPanelStyle(options)}
          supportsSuperellipse={supportsCornerShape(doc)}
          width={Number(options.width) || 760}
        />
      );
    });
    if (!panel) {
      reactRoot.unmount();
      return null;
    }

    const mountedPanel = panel as HTMLElement & {
      _lumnoOverlayHost?: HTMLElement;
      _lumnoOverlayRoot?: ShadowRoot | null;
    };
    mountedPanel._lumnoOverlayHost = host;
    mountedPanel._lumnoOverlayRoot = shadowRoot;
    roots.set(host, reactRoot);
    panels.set(host, mountedPanel);
    return { host, panel: mountedPanel, root: shadowRoot };
  }

  return Object.freeze({
    appendOverlayStyleNodes,
    createOverlayMount,
    destroyOverlayMount(host: HTMLElement | null) {
      if (!host) {
        return;
      }
      const root = roots.get(host);
      if (root) {
        flushSync(() => root.unmount());
        roots.delete(host);
      }
      panels.delete(host);
    },
    findOverlayPanel(
      doc: Document,
      options: OverlayShellOptions = {}
    ): HTMLElement | null {
      const panelId = String(
        options.id || '_x_extension_overlay_2024_unique_'
      );
      const hostId = String(
        options.hostId || '_x_extension_overlay_host_2026_unique_'
      );
      const host = doc.getElementById(hostId);
      if (host) {
        return (
          host.shadowRoot?.getElementById(panelId) ||
          panels.get(host) ||
          null
        );
      }
      return doc.getElementById(panelId);
    },
    implementation: 'react'
  });
}
