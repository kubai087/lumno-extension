import type { CSSProperties } from 'react';
import { EmptyStateArt } from './empty-state-art';
import { createReactRootController, type ReactRootController } from './root-controller';

// The link preview window over a page: the receded page behind it, the
// frame, the notice for a page that refuses to be framed, the buttons
// outside the window, and a toast of its own (the window is in the top
// layer, so the page's toast would stay under it). The content script drives
// the opening and closing motion on the elements this draws.

type LinkPreviewIconName = 'close' | 'openInTab' | 'copyLink' | 'reload' | 'back';

export const LINK_PREVIEW_FRAME_NAME = 'lumno-link-preview';
const FRAME_SANDBOX = [
  'allow-downloads',
  'allow-forms',
  'allow-modals',
  'allow-pointer-lock',
  'allow-popups',
  'allow-popups-to-escape-sandbox',
  'allow-presentation',
  'allow-same-origin',
  'allow-scripts',
  'allow-storage-access-by-user-activation'
].join(' ');
const FRAME_ALLOW = 'autoplay; clipboard-read; clipboard-write; encrypted-media; fullscreen; picture-in-picture; web-share';
const ICON_PATHS: Readonly<Record<LinkPreviewIconName, string>> = {
  close: 'M12 10.586l4.95-4.95 1.414 1.414-4.95 4.95 4.95 4.95-1.414 1.414-4.95-4.95-4.95 4.95-1.414-1.414 4.95-4.95-4.95-4.95L7.05 5.636z',
  openInTab: 'M10 6v2H5v11h11v-5h2v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6zm11-3v8h-2V6.413l-7.793 7.794-1.414-1.414L17.585 5H13V3h8z',
  copyLink: 'M7 6V3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3v3c0 .552-.45 1-1.007 1H4.007A1.001 1.001 0 0 1 3 21l.003-14c0-.552.45-1 1.007-1H7zM5.003 8L5 20h10V8H5.003zM9 6h8v10h2V4H9v2z',
  reload: 'M5.463 4.433A9.961 9.961 0 0 1 12 2c5.523 0 10 4.477 10 10 0 2.136-.67 4.116-1.81 5.74L17 12h3A8 8 0 0 0 6.46 6.228l-.997-1.795zm13.074 15.134A9.961 9.961 0 0 1 12 22C6.477 22 2 17.523 2 12c0-2.136.67-4.116 1.81-5.74L7 12H4a8 8 0 0 0 13.54 5.772l.997 1.795z',
  back: 'M7.828 11H20v2H7.828l5.364 5.364-1.414 1.414L4 12l7.778-7.778 1.414 1.414z'
};

export interface LinkPreviewViewModel {
  state: 'prewarm' | 'open';
  // Null until the opening or closing motion first sets it.
  motion: 'moving' | 'still' | null;
  // Null until the frame first loads.
  loaded: boolean | null;
  blocked: boolean | null;
  // The receded page shows the screenshot, or nothing when there is none.
  shot: 'image' | 'none' | null;
  shotVisible: boolean;
  backVisible: boolean;
  // The previewed page's own background, shown before it paints.
  panelColor: string;
  viewport: { width: number; height: number } | null;
  // How far the veil reaches past the page on each side, in CSS pixels;
  // null until it is painted.
  veilMargin: { x: number; y: number } | null;
  // The page's scrollbars, cut off the screenshot, in CSS pixels; null
  // until the veil is painted.
  scrollbars: { left: number; right: number; bottom: number } | null;
  // The window lets presses through to the page while it closes.
  closing: boolean;
  frameUrl: string;
  placeholder: string;
  labels: {
    close: string;
    openInTab: string;
    copyLink: string;
    reload: string;
    back: string;
    blocked: string;
  };
}

export interface LinkPreviewViewHandlers {
  onClose(): void;
  onOpenInTab(): void;
  onCopyLink(): void;
  onReload(): void;
  onBack(): void;
  onFrameLoad(): void;
}

// The elements the content script moves, paints and focuses.
export interface LinkPreviewElements {
  root: HTMLDivElement;
  page: HTMLDivElement;
  shot: HTMLImageElement;
  veil: HTMLCanvasElement;
  scrim: HTMLDivElement;
  windowElement: HTMLDivElement;
  panel: HTMLDivElement;
  controls: HTMLDivElement;
  frame: HTMLIFrameElement;
  toastElement: HTMLDivElement;
  toastStylesheet: HTMLLinkElement;
}

type ElementRefs = { [K in keyof LinkPreviewElements]: LinkPreviewElements[K] | null };

// One ref callback per element, made once so redraws keep them attached.
type RefSetters = { [K in keyof LinkPreviewElements]: (element: LinkPreviewElements[K] | null) => (() => void) | void };

function Icon({ name }: { name: LinkPreviewIconName }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

function Control({ name, label, className, hidden, onClick }: {
  name: LinkPreviewIconName;
  label: string;
  className?: string;
  hidden?: boolean;
  onClick(): void;
}) {
  return (
    <button
      aria-label={label}
      className={className ? `control ${className}` : 'control'}
      hidden={hidden}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon name={name} />
    </button>
  );
}

// The page under the preview must not scroll while the preview is up.
function blockScroll(event: Event): void {
  event.preventDefault();
}

function LinkPreviewView({ model, handlers, refs, styles, toastStylesheetUrl }: {
  model: LinkPreviewViewModel;
  handlers: LinkPreviewViewHandlers;
  refs: RefSetters;
  styles: string;
  toastStylesheetUrl: string;
}) {
  const rootStyle: CSSProperties = {
    ...(model.viewport
      ? { '--lp-window-width': `${model.viewport.width}px`, '--lp-window-height': `${model.viewport.height}px` }
      : {}),
    ...(model.veilMargin
      ? { '--lp-veil-margin-x': `${model.veilMargin.x}px`, '--lp-veil-margin-y': `${model.veilMargin.y}px` }
      : {}),
    ...(model.scrollbars
      ? {
        '--lp-scrollbar-left': `${model.scrollbars.left}px`,
        '--lp-scrollbar-right': `${model.scrollbars.right}px`,
        '--lp-scrollbar-bottom': `${model.scrollbars.bottom}px`
      }
      : {}),
    ...(model.closing ? { pointerEvents: 'none' } : {})
  };
  const flag = (value: boolean | null): string | undefined => (value === null ? undefined : String(value));
  return (
    <>
      <style>{styles}</style>
      <link href={toastStylesheetUrl} ref={refs.toastStylesheet} rel="stylesheet" />
      <div
        aria-modal="true"
        className="root"
        data-blocked={flag(model.blocked)}
        data-loaded={flag(model.loaded)}
        data-motion={model.motion || undefined}
        data-shot={model.shot || undefined}
        data-state={model.state}
        ref={refs.root}
        role="dialog"
        style={rootStyle}
        tabIndex={-1}
      >
        {/* A press outside the window closes it. */}
        <div className="stage" onClick={handlers.onClose}>
          <div className="page" hidden={!model.shotVisible} ref={refs.page}>
            {/* The screenshot fades out from over its blurred copy. */}
            <canvas className="veil" ref={refs.veil} />
            <img alt="" className="shot" ref={refs.shot} />
          </div>
          <div className="scrim" ref={refs.scrim} />
        </div>
        <div className="window" ref={refs.windowElement}>
          <div
            className="panel"
            ref={refs.panel}
            style={model.panelColor ? { backgroundColor: model.panelColor } : undefined}
          >
            <div className="placeholder">{model.placeholder}</div>
            <iframe
              allow={FRAME_ALLOW}
              name={LINK_PREVIEW_FRAME_NAME}
              onLoad={handlers.onFrameLoad}
              ref={refs.frame}
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox={FRAME_SANDBOX}
              src={model.frameUrl}
            />
            <div className="notice">
              <span>
                <EmptyStateArt name="blockedPage" size={176} />
              </span>
              <div>{model.labels.blocked}</div>
              <button onClick={handlers.onOpenInTab} type="button">{model.labels.openInTab}</button>
            </div>
          </div>
          <div className="controls" ref={refs.controls}>
            <Control className="control-close" label={model.labels.close} name="close" onClick={handlers.onClose} />
            <Control label={model.labels.openInTab} name="openInTab" onClick={handlers.onOpenInTab} />
            <Control label={model.labels.copyLink} name="copyLink" onClick={handlers.onCopyLink} />
            <Control label={model.labels.reload} name="reload" onClick={handlers.onReload} />
            {/* Last, so it comes and goes without moving the others. */}
            <Control hidden={!model.backVisible} label={model.labels.back} name="back" onClick={handlers.onBack} />
          </div>
        </div>
        <div
          aria-live="polite"
          className="x-lumno-toast"
          data-show="false"
          ref={refs.toastElement}
          role="status"
          style={{ '--x-lumno-toast-top': 'max(24px, calc(env(safe-area-inset-top) + 12px))' }}
        />
      </div>
    </>
  );
}

export interface LinkPreviewViewController extends ReactRootController<LinkPreviewViewModel> {
  readonly elements: LinkPreviewElements;
}

// Draws the preview into its shadow root and hands back the elements it drew.
// Its styles come from the content script, so the overlay bundle does not
// carry them for every overlay.
export function createLinkPreviewView(
  shadowRoot: ShadowRoot,
  handlers: LinkPreviewViewHandlers,
  model: LinkPreviewViewModel,
  assets: { styles: string; toastStylesheetUrl: string }
): LinkPreviewViewController | null {
  const refs: ElementRefs = {
    root: null, page: null, shot: null, veil: null, scrim: null, windowElement: null,
    panel: null, controls: null, frame: null, toastElement: null, toastStylesheet: null
  };
  const setters: RefSetters = {
    root(element) {
      refs.root = element;
      if (!element) {
        return undefined;
      }
      // Not passive, so the scroll can be refused.
      element.addEventListener('wheel', blockScroll, { passive: false });
      element.addEventListener('touchmove', blockScroll, { passive: false });
      return () => {
        element.removeEventListener('wheel', blockScroll);
        element.removeEventListener('touchmove', blockScroll);
      };
    },
    page(element) { refs.page = element; },
    shot(element) { refs.shot = element; },
    veil(element) { refs.veil = element; },
    scrim(element) { refs.scrim = element; },
    windowElement(element) { refs.windowElement = element; },
    panel(element) { refs.panel = element; },
    controls(element) { refs.controls = element; },
    frame(element) { refs.frame = element; },
    toastElement(element) { refs.toastElement = element; },
    toastStylesheet(element) { refs.toastStylesheet = element; }
  };
  const view = createReactRootController(shadowRoot, (next: LinkPreviewViewModel) => (
    <LinkPreviewView
      handlers={handlers}
      model={next}
      refs={setters}
      styles={assets.styles}
      toastStylesheetUrl={assets.toastStylesheetUrl}
    />
  ));
  view.render(model);
  const { root, page, shot, veil, scrim, windowElement, panel, controls, frame, toastElement, toastStylesheet } = refs;
  if (!root || !page || !shot || !veil || !scrim || !windowElement || !panel || !controls ||
      !frame || !toastElement || !toastStylesheet) {
    view.destroy();
    return null;
  }
  return Object.freeze({
    render: view.render,
    destroy: view.destroy,
    elements: { root, page, shot, veil, scrim, windowElement, panel, controls, frame, toastElement, toastStylesheet }
  });
}
