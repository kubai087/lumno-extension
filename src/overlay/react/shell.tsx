import { useCallback, useRef } from 'react';
import { createStore, type Store } from '../../shared/state/store';
import { useStore } from '../../shared/react/use-store';
import { createOverlayHost, getElementInRoot, markHostEditableWhileFocused } from '../dom/overlay-host';
import { appendOverlayStyleNodes } from '../dom/overlay-styles';
import type { OverlayShellOptions } from '../dom/overlay-styles';
import { PortalHost } from '../../shared/react/portal-host';

export interface OverlayMount {
  host: HTMLElement;
  // The panel's one React root, which draws its input and results too.
  portals: PortalHost;
  panel: HTMLElement;
  // Where the search input mounts, and the results list below it.
  inputContainer: HTMLDivElement;
  suggestionsContainer: HTMLDivElement;
  root: ShadowRoot;
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

type StyleDeclaration = [property: string, value: string, priority?: 'important'];

// The panel's own look and place. Its motion (transform, opacity,
// transition, will-change) starts at rest here and is the session's after.
function getPanelDeclarations(options: OverlayShellOptions, supportsSuperellipse: boolean): StyleDeclaration[] {
  const width = Number(options.width) || 760;
  const maxHeightVh = Number(options.maxHeightVh) || 75;
  const important = 'important';
  const declarations: StyleDeclaration[] = [
    ['all', 'unset'],
    ['position', 'fixed', important],
    ['top', '20vh', important],
    ['left', '50%', important],
    ['transform', OVERLAY_PANEL_REST_TRANSFORM, important],
    ['transform-origin', 'top center', important],
    ['width', `${width}px`, important],
    ['max-width', 'calc(100vw - 24px)', important],
    ['max-height', `${maxHeightVh}vh`, important],
    ['--x-ov-panel-radius', '26px'],
    ['background', 'var(--x-ov-bg, rgba(255, 255, 255, 0.95))', important],
    ['backdrop-filter', 'blur(var(--x-ov-blur, 24px)) saturate(var(--x-ov-saturate, 165%))', important],
    ['-webkit-backdrop-filter', 'blur(var(--x-ov-blur, 24px)) saturate(var(--x-ov-saturate, 165%))', important],
    ['border', '1px solid var(--x-ov-border, var(--x-lumno-search-shell-border-light, rgba(0, 0, 0, 0.14)))', important],
    ['border-radius', 'var(--x-ov-panel-radius)', important],
    ['box-shadow', 'var(--x-ov-shadow, inset 0 1px 0 rgba(255, 255, 255, 0.72), 0 1px 2px rgba(15, 23, 42, 0.06), 0 10px 24px -6px rgba(15, 23, 42, 0.12), 0 36px 84px -12px rgba(15, 23, 42, 0.22), 0 96px 220px -16px rgba(15, 23, 42, 0.3), 0 0 140px 8px rgba(15, 23, 42, 0.08))', important],
    ['z-index', '2147483647', important],
    ['font-family', 'var(--lumno-font-sans, sans-serif)', important],
    ['display', 'flex', important],
    ['flex-direction', 'column', important],
    ['align-items', 'center', important],
    ['pointer-events', 'auto', important],
    ['contain', 'layout style', important],
    ['box-sizing', 'border-box', important],
    ['margin', '0', important],
    ['padding', '0', important],
    ['line-height', '1', important],
    ['text-decoration', 'none', important],
    ['list-style', 'none', important],
    ['outline', 'none', important],
    ['color', 'var(--x-ov-text, #111827)', important],
    ['font-size', '16px', important],
    ['font-style', 'normal', important],
    ['font-variant', 'normal', important],
    ['font-weight', '400', important],
    ['letter-spacing', 'normal', important],
    ['word-spacing', 'normal', important],
    ['text-transform', 'none', important],
    ['text-shadow', 'none', important],
    ['vertical-align', 'baseline', important],
    ['opacity', '0', important],
    ['filter', 'none', important],
    ['will-change', 'auto', important],
    ['transition', 'none', important]
  ];
  if (supportsSuperellipse) {
    declarations.push(['corner-shape', 'superellipse(1.25)', important]);
  }
  return declarations;
}

// The panel's theme: its scheme and the custom properties it draws with.
export interface OverlayPanelModel {
  theme: string;
  vars: Readonly<Partial<Record<`--${string}`, string>>>;
}

// The panel's parts once it mounted.
interface OverlayPanelParts {
  panel: HTMLDivElement;
  inputContainer: HTMLDivElement;
  suggestionsContainer: HTMLDivElement;
}

function OverlayPanel({
  id,
  suggestionsContainerId,
  declarations,
  onMount,
  store
}: {
  id: string;
  suggestionsContainerId: string;
  declarations: StyleDeclaration[];
  onMount(parts: OverlayPanelParts): void;
  store: Store<OverlayPanelModel>;
}) {
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const suggestionsContainerRef = useRef<HTMLDivElement>(null);
  const model = useStore(store);
  // Runs once: the static look goes on beside the theme's properties.
  const mountPanel = useCallback((panel: HTMLDivElement | null) => {
    if (!panel) {
      return;
    }
    declarations.forEach(([property, value, priority]) => {
      panel.style.setProperty(property, value, priority || '');
    });
    // Children attach their refs before their parent does.
    const inputContainer = inputContainerRef.current;
    const suggestionsContainer = suggestionsContainerRef.current;
    if (inputContainer && suggestionsContainer) {
      onMount({ panel, inputContainer, suggestionsContainer });
    }
  }, [declarations, onMount]);
  return (
    <div
      data-lumno-overlay-panel="true"
      data-react-island="overlay-shell"
      data-theme={model.theme || undefined}
      id={id}
      ref={mountPanel}
      style={model.vars}
    >
      {/* The search input mounts its own React root here. */}
      <div data-lumno-overlay-input="" ref={inputContainerRef} />
      <div
        className="x-ov-suggestions-container"
        id={suggestionsContainerId}
        ref={suggestionsContainerRef}
      />
    </div>
  );
}

// The panel carries its host and shadow root for the content scripts, which
// read them back by name.
interface OverlayPanelElement extends HTMLDivElement {
  _lumnoOverlayHost?: HTMLElement;
  _lumnoOverlayRoot?: ShadowRoot | null;
}

// The page's mounted panels: each host's portal root and panel, so the
// session can find the panel again and tear its root down.
const hosts = new WeakMap<HTMLElement, PortalHost>();
const panels = new WeakMap<HTMLElement, HTMLElement>();

// `look` is the panel's theme, as its owner sets it.
export function createOverlayMount(
  doc: Document,
  options: OverlayShellOptions = {},
  look: Store<OverlayPanelModel> = createStore<OverlayPanelModel>({ theme: '', vars: {} })
): OverlayMount | null {
  if (!doc || typeof doc.createElement !== 'function') {
    return null;
  }
  const host = createOverlayHost(doc, options);
  // Every supported browser has closed shadow roots, so page styles never
  // reach the panel and its own never reach the page.
  const shadowRoot = host.attachShadow({ mode: 'closed' });
  markHostEditableWhileFocused(host, shadowRoot);
  appendOverlayStyleNodes(doc, {
    ...options,
    root: shadowRoot
  });

  const mounted: { parts: OverlayPanelParts | null } = { parts: null };
  const registerPanel = (parts: OverlayPanelParts) => {
    mounted.parts = parts;
  };
  const portals = new PortalHost(shadowRoot);
  portals.show(shadowRoot, (
    <OverlayPanel
      declarations={getPanelDeclarations(options, supportsCornerShape(doc))}
      id={String(
        options.id || '_x_extension_overlay_2024_unique_'
      )}
      onMount={registerPanel}
      store={look}
      suggestionsContainerId={String(
        options.suggestionsContainerId || '_x_extension_suggestions_container_2024_unique_'
      )}
    />
  ));
  const parts = mounted.parts;
  if (!parts) {
    portals.destroy();
    return null;
  }

  const mountedPanel: OverlayPanelElement = parts.panel;
  mountedPanel._lumnoOverlayHost = host;
  mountedPanel._lumnoOverlayRoot = shadowRoot;
  hosts.set(host, portals);
  panels.set(host, mountedPanel);
  return {
    host,
    portals,
    panel: mountedPanel,
    inputContainer: parts.inputContainer,
    suggestionsContainer: parts.suggestionsContainer,
    root: shadowRoot
  };
}

export function destroyOverlayMount(host: HTMLElement | null): void {
  if (!host) {
    return;
  }
  const portals = hosts.get(host);
  if (portals) {
    portals.destroy();
    hosts.delete(host);
  }
  panels.delete(host);
}

export function findOverlayPanel(
  doc: Document,
  options: OverlayShellOptions = {}
): HTMLElement | null {
  const panelId = String(
    options.id || '_x_extension_overlay_2024_unique_'
  );
  const hostId = String(
    options.hostId || '_x_extension_overlay_host_2026_unique_'
  );
  const host = getElementInRoot(doc, hostId);
  if (host) {
    return getElementInRoot(host.shadowRoot, panelId) || panels.get(host) || null;
  }
  return getElementInRoot(doc, panelId);
}

