// The link preview surface, injected into a tab's top frame by
// src/background/link-preview.ts. It shows a link in a small window over
// the page: a screenshot of the page recedes (scales down and blurs) behind
// it, the window springs open from the click, and buttons outside the
// window close it or move the page to a tab.
//
// The background first sends "prewarm" on mousedown: the window is built
// invisible and its frame starts loading. "show" follows on click with the
// screenshot and plays the opening.
import { toPreviewFrameUrl } from '../domain/link-preview-frame-url';
import * as TOAST from '../shared/ui/toast';
import { createToastStyleGate } from '../shared/ui/toast-style-gate';
import { createLinkPreviewView } from '../shared/react/link-preview-view';
import { readStartCommand } from '../domain/injected-commands';
import type { LinkPreviewElements, LinkPreviewViewModel } from '../shared/react/link-preview-view';
import { isNavigateEvent, readPageNavigation } from '../platform/page-navigation';
import { copyLink, focusPreviewedPage, goBack, handleFrameLoad, handleFrameMessage, moveToTab, reload } from './link-preview-frame';
import { close, decodeImage, playOpening } from './link-preview-motion';
import { paintVeil } from './link-preview-veil';
import { STYLES } from './link-preview-styles';
import { getMessage, isRecord, listenTarget, listenWindow, readOrigin, send, surface, teardown, update } from './link-preview-surface';
import type { LinkPreview, ShowRequest } from './link-preview-surface';


const HOST_ID = '_x_extension_link_preview_host_2026_unique_';
// A prewarmed window the click never claimed (the page kept the click).
const PREWARM_TTL_MS = 4500;

function readHostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (_error) {
    return '';
  }
}

function applyHostStyle(host: HTMLElement): void {
  // Inline and important, so page rules for div or [popover] cannot move it.
  host.style.cssText = [
    'all: initial',
    'display: block',
    'position: fixed',
    'inset: 0',
    'width: 100vw',
    'height: 100vh',
    'max-width: none',
    'max-height: none',
    'margin: 0',
    'padding: 0',
    'border: 0',
    'background: transparent',
    'overflow: visible',
    'z-index: 2147483647'
  ].map((declaration) => `${declaration} !important`).join('; ');
}

function build(token: string, url: string): LinkPreview | null {
  const host = document.createElement('div');
  host.id = HOST_ID;
  host.setAttribute('translate', 'no');
  applyHostStyle(host);
  const supportsPopover = typeof host.showPopover === 'function';
  if (supportsPopover) {
    host.setAttribute('popover', 'manual');
  }
  const shadow = host.attachShadow({ mode: 'closed' });
  // The frame's address is part of the first draw: a frame connected
  // without one loads about:blank first, and that load would count as the
  // page's (see handleFrameLoad). The host joins the page afterwards.
  const model: LinkPreviewViewModel = {
    state: 'prewarm',
    motion: null,
    loaded: null,
    blocked: null,
    shot: null,
    shotVisible: false,
    backVisible: false,
    panelColor: '',
    viewport: null,
    veilMargin: null,
    scrollbars: null,
    closing: false,
    frameUrl: toPreviewFrameUrl(url),
    placeholder: readHostLabel(url),
    labels: {
      close: getMessage('link_preview_close', 'Close'),
      openInTab: getMessage('link_preview_open_in_tab', 'Open in new tab'),
      copyLink: getMessage('link_preview_copy_link', 'Copy link'),
      reload: getMessage('link_preview_reload', 'Reload'),
      back: getMessage('link_preview_back', 'Back'),
      blocked: getMessage('link_preview_blocked', 'This page can’t be shown in a preview')
    }
  };
  let preview: LinkPreview | null = null;
  const view = createLinkPreviewView(shadow, {
    onClose: () => close(preview),
    onOpenInTab: () => { if (preview) moveToTab(preview); },
    onCopyLink: () => { if (preview) copyLink(preview); },
    onReload: () => { if (preview) reload(preview); },
    onBack: () => { if (preview) goBack(preview); },
    onFrameLoad: () => { if (preview) handleFrameLoad(preview); }
  }, model, { styles: STYLES, toastStylesheetUrl: chrome.runtime.getURL('src/shared/ui/toast.css') });
  if (!view) {
    return null;
  }
  const elements: LinkPreviewElements = view.elements;
  const built: LinkPreview = {
    token,
    url,
    currentUrl: url,
    frameUrl: model.frameUrl,
    frameSecret: '',
    host,
    view,
    model,
    ...elements,
    toastGate: createToastStyleGate(elements.toastElement, { stylesheetElement: elements.toastStylesheet, windowObj: window }),
    toast: TOAST.createToastController(elements.toastElement, { windowObj: window }),
    supportsPopover,
    shown: false,
    closing: false,
    loadCount: 0,
    aliveSinceLoad: false,
    prewarmTimer: 0,
    restoreFocus: null,
    shotDecode: null,
    pageReported: false,
    cleanups: []
  };
  preview = built;

  listenWindow(built, 'message', (event) => handleFrameMessage(built, event));
  listenWindow(built, 'keydown', (event) => {
    if (built.shown && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(built);
    }
  }, true);
  listenWindow(built, 'pagehide', () => {
    send({ action: 'linkPreviewClose', token: built.token });
  });

  // Until the click claims it, the invisible window must not take the
  // press: the click has to land on the link that started it.
  host.style.setProperty('pointer-events', 'none', 'important');
  document.documentElement.append(host);
  if (supportsPopover) {
    host.showPopover();
  }
  return built;
}

// The page under the preview cannot be used while it is up, so a new
// navigation it starts by itself (a site acting late on the press the
// preview took, or a same-site page in the preview reaching out to it)
// is held back, a scripted reload included. Back, Forward, the user's own
// reload and the page replacing its own address in place still go through.
function holdPageNavigation(preview: LinkPreview): void {
  const navigation = readPageNavigation(window);
  if (!navigation) {
    return;
  }
  listenTarget(preview, navigation, 'navigate', (event) => {
    if (!isNavigateEvent(event)) {
      return;
    }
    const sameDocument = Boolean(event.destination && event.destination.sameDocument);
    const held = event.navigationType === 'push' ||
      (event.navigationType === 'replace' && !sameDocument) ||
      (event.navigationType === 'reload' && !event.userInitiated);
    if (held && event.cancelable && !event.downloadRequest && !preview.closing) {
      event.preventDefault();
    }
  });
}

function fitPageToWindow(preview: LinkPreview): void {
  update(preview, { viewport: { width: window.innerWidth, height: window.innerHeight } });
}

// The page under the preview keeps its scroll position while the preview
// is open, and gets it back when the preview goes: anything that scrolls
// it meanwhile (the previewed page chaining its scroll past its edge, a
// script) happens out of sight behind the screenshot.
function holdPageScroll(preview: LinkPreview): void {
  const left = window.scrollX;
  const top = window.scrollY;
  const restore = (): void => {
    if (window.scrollX !== left || window.scrollY !== top) {
      window.scrollTo({ left, top, behavior: 'instant' });
    }
  };
  listenWindow(preview, 'scroll', restore, { passive: true });
  preview.cleanups.push(restore);
}

function prewarm(token: string, url: string, frameSecret: string): boolean {
  if (surface.current && !surface.current.shown) {
    teardown(surface.current);
  }
  if (surface.current) {
    // A preview is already on screen; the page under it cannot be pressed.
    return false;
  }
  const preview = build(token, url);
  if (!preview) {
    return false;
  }
  preview.frameSecret = frameSecret;
  surface.current = preview;
  preview.prewarmTimer = window.setTimeout(() => {
    if (surface.current === preview && !preview.shown) {
      teardown(preview);
    }
  }, PREWARM_TTL_MS);
  return true;
}

// The screenshot usually arrives while the button is still down, so a
// large one is decoded and its veil painted before the click, and the
// opening starts at once.
function acceptScreenshot(preview: LinkPreview, dataUrl: string): void {
  if (!dataUrl) {
    return;
  }
  preview.shotDecode = decodeImage(preview.shot, dataUrl)
    .then((decoded) => decoded && paintVeil(preview))
    .then((painted) => {
      if (painted && surface.current === preview && !preview.closing) {
        showShot(preview);
      }
      return painted;
    });
}

// The picture joins the invisible window as soon as it is ready, so it is
// decoded for the GPU and uploaded before the click instead of on the
// opening's first frame.
function showShot(preview: LinkPreview): void {
  update(preview, {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    shot: 'image',
    shotVisible: true
  });
}

async function show(message: ShowRequest): Promise<boolean> {
  if (surface.current && surface.current.shown) {
    if (surface.current.token === message.token) {
      return true;
    }
    return false;
  }
  if (!surface.current || surface.current.token !== message.token || surface.current.url !== message.url) {
    prewarm(message.token, message.url, message.frameSecret);
  }
  const preview = surface.current;
  if (!preview) {
    return false;
  }
  window.clearTimeout(preview.prewarmTimer);
  preview.shown = true;
  preview.restoreFocus = document.activeElement;
  holdPageScroll(preview);
  holdPageNavigation(preview);
  fitPageToWindow(preview);
  listenWindow(preview, 'resize', () => fitPageToWindow(preview));
  acceptScreenshot(preview, message.screenshot);
  const hasShot = await (preview.shotDecode || Promise.resolve(false));
  if (surface.current !== preview || preview.closing) {
    return true;
  }
  if (hasShot) {
    showShot(preview);
  } else {
    update(preview, { shot: 'none', shotVisible: false });
  }
  update(preview, { state: 'open' });
  preview.host.style.removeProperty('pointer-events');
  playOpening(preview, message.origin);
  preview.root.focus({ preventScroll: true });
  focusPreviewedPage(preview);
  return true;
}

type PageMessage = Record<string, unknown>;
type Respond = (reply: unknown) => void;

function readToken(message: PageMessage): string {
  return String(message.token || '');
}

function handleScreenshotMessage(message: PageMessage, sendResponse: Respond): boolean {
  const screenshot = typeof message.screenshot === 'string' ? message.screenshot : '';
  const preview = surface.current;
  const accepted = preview !== null && !preview.shown && preview.token === readToken(message) && screenshot.length > 0;
  if (preview && accepted) {
    acceptScreenshot(preview, screenshot);
  }
  sendResponse(accepted);
  return false;
}

function handleShowMessage(message: PageMessage, sendResponse: Respond): boolean {
  show({
    token: readToken(message),
    url: String(message.url || ''),
    frameSecret: String(message.frameSecret || ''),
    screenshot: typeof message.screenshot === 'string' ? message.screenshot : '',
    origin: readOrigin(message.origin)
  }).then(sendResponse, () => sendResponse(false));
  return true;
}

// The press ended away from the link: the click will not come.
function handleDiscardMessage(message: PageMessage, sendResponse: Respond): boolean {
  const preview = surface.current;
  const discarded = preview !== null && !preview.shown && preview.token === readToken(message);
  if (preview && discarded) {
    teardown(preview);
  }
  sendResponse(discarded);
  return false;
}

// Messages from the background; each answers what its PageMessages entry
// says, and returns true when it answers later.
const PAGE_MESSAGE_HANDLERS: Record<string, (message: PageMessage, sendResponse: Respond) => boolean> = {
  lumnoLinkPreviewPrewarm(message, sendResponse) {
    sendResponse(prewarm(readToken(message), String(message.url || ''), String(message.frameSecret || '')));
    return false;
  },
  lumnoLinkPreviewScreenshot: handleScreenshotMessage,
  lumnoLinkPreviewShow: handleShowMessage,
  lumnoLinkPreviewDiscard: handleDiscardMessage,
  lumnoLinkPreviewPing(_message, sendResponse) {
    // Answers for a preview still opening too: its own frame loading can
    // make the background ask before the click reaches this surface.
    const preview = surface.current;
    sendResponse({ token: preview && !preview.closing ? preview.token : '' });
    return false;
  }
};

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse: Respond) => {
  if (!isRecord(message) || typeof message.action !== 'string' ||
      !Object.prototype.hasOwnProperty.call(PAGE_MESSAGE_HANDLERS, message.action)) {
    return false;
  }
  return PAGE_MESSAGE_HANDLERS[message.action](message, sendResponse);
});

// The worker loads this module once per page (src/platform/injection.ts) and
// then talks to it through messages; run() confirms it is listening.
function run(command: unknown): { ok: boolean; reason?: string } {
  return readStartCommand(command) ? { ok: true } : { ok: false, reason: 'invalid-command' };
}

export { run };
