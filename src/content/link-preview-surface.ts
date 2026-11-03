// The preview on this page and what every part of the surface uses on it:
// its shape, messages to the worker, its listeners and its teardown.
import type { BackgroundAction, BackgroundReply, BackgroundRequest, LinkPreviewOrigin } from '../domain/messages';
import type { ToastController } from '../shared/ui/toast-screen';
import type { ToastStyleGate } from '../shared/ui/toast-style-gate';
import type {
  LinkPreviewElements,
  LinkPreviewViewController,
  LinkPreviewViewModel
} from '../shared/react/link-preview-view';
import * as LumnoMessaging from '../platform/messaging';
import type { ListenerTarget } from '../platform/page-navigation';

// One preview: its elements, and where it is between prewarm and close.
interface LinkPreview extends LinkPreviewElements {
  token: string;
  url: string;
  // The address now, following links taken inside the preview.
  currentUrl: string;
  frameUrl: string;
  // Handed to the frame once its page reports in (see linkPreviewFrameBind).
  frameSecret: string;
  host: HTMLDivElement;
  view: LinkPreviewViewController;
  // What the view shows now.
  model: LinkPreviewViewModel;
  toastGate: Readonly<ToastStyleGate>;
  toast: Readonly<ToastController>;
  supportsPopover: boolean;
  shown: boolean;
  closing: boolean;
  loadCount: number;
  // A page reported in since the frame's last load event.
  aliveSinceLoad: boolean;
  prewarmTimer: number;
  restoreFocus: Element | null;
  shotDecode: Promise<boolean> | null;
  // A real page has reported in at least once.
  pageReported: boolean;
  cleanups: Array<() => void>;
}

interface ShowRequest {
  token: string;
  url: string;
  frameSecret: string;
  screenshot: string;
  origin: LinkPreviewOrigin | null;
  // Whether the browser can move the preview into a split view.
  splitView: boolean;
}


function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function readOrigin(value: unknown): LinkPreviewOrigin | null {
  return isRecord(value) && typeof value.x === 'number' && typeof value.y === 'number'
    ? { x: value.x, y: value.y }
    : null;
}

// HTML, SVG and MathML elements have focus(); other elements do not.
function isFocusable(element: Element): element is Element & HTMLOrSVGElement {
  return 'focus' in element && typeof element.focus === 'function';
}


// The preview on this page, from prewarm until it is torn down.
const surface: { current: LinkPreview | null } = { current: null };


function getMessage(key: string, fallback: string): string {
  try {
    const value = chrome.i18n && chrome.i18n.getMessage ? chrome.i18n.getMessage(key) : '';
    return value || fallback;
  } catch (_error) {
    return fallback;
  }
}

function send<A extends BackgroundAction>(
  message: BackgroundRequest<A>,
  callback?: (response: BackgroundReply<A> | undefined) => void
): void {
  try {
    LumnoMessaging.sendBackgroundMessage(chrome.runtime, message, (response) => {
      void (chrome.runtime && chrome.runtime.lastError);
      if (typeof callback === 'function') {
        callback(response);
      }
    });
  } catch (_error) {
    // Ignore an extension context invalidated during reload or navigation.
    if (typeof callback === 'function') {
      callback(undefined);
    }
  }
}


// Shows a change in the view at once, so the motion that follows starts
// from it.
function update(preview: LinkPreview, patch: Partial<LinkPreviewViewModel>): void {
  preview.model = { ...preview.model, ...patch };
  preview.view.render(preview.model);
}


function listenWindow<K extends keyof WindowEventMap>(
  preview: LinkPreview,
  type: K,
  listener: (event: WindowEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions
): void {
  window.addEventListener(type, listener, options);
  preview.cleanups.push(() => window.removeEventListener(type, listener, options));
}

function listenTarget(preview: LinkPreview, target: ListenerTarget, type: string, listener: (event: Event) => void): void {
  target.addEventListener(type, listener);
  preview.cleanups.push(() => target.removeEventListener(type, listener));
}


function teardown(preview: LinkPreview): void {
  window.clearTimeout(preview.prewarmTimer);
  preview.toast.destroy();
  preview.toastGate.destroy();
  preview.cleanups.splice(0).forEach((cleanup) => cleanup());
  preview.frame.removeAttribute('src');
  preview.view.destroy();
  preview.host.remove();
  if (surface.current === preview) {
    surface.current = null;
  }
}

export {
  getMessage,
  isFocusable,
  isRecord,
  listenTarget,
  listenWindow,
  readOrigin,
  send,
  surface,
  teardown,
  update
};
export type {
  LinkPreview,
  ShowRequest
};
