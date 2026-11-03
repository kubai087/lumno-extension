// The previewed page in the window's frame: what it reports, pages it
// refuses, and the window's buttons that act on it.
import { toPreviewFrameUrl } from '../domain/link-preview-frame-url';
import { PREVIEW_SURFACE_SOURCE, readPreviewFrameMessage } from '../domain/link-preview-frame-messages';
import type { PreviewSurfaceCommand } from '../domain/link-preview-frame-messages';
import type { ToastShowOptions } from '../shared/ui/toast-screen';
import { close } from './link-preview-motion';
import { getMessage, send, surface, update } from './link-preview-surface';
import type { LinkPreview } from './link-preview-surface';

// How long after the frame's load event a page may still report in; the
// report is posted at document start, so it nearly always arrives first.
const ALIVE_GRACE_MS = 250;


// Sends the frame to another address in place of its current entry, so
// Back does not return to the error page it replaces.
function replaceFrameLocation(preview: LinkPreview, url: string): void {
  try {
    const frameWindow = preview.frame.contentWindow;
    if (!frameWindow) {
      throw new Error('The preview frame has no window.');
    }
    frameWindow.location.replace(url);
  } catch (_error) {
    preview.frame.src = url;
  }
}

// Copies the address the preview is on now, which follows links taken
// inside it. The page's clipboard API needs a secure page; elsewhere a
// selected field inside the window copies instead, so focus stays here.
function copyLink(preview: LinkPreview): void {
  const url = preview.currentUrl || preview.url;
  const clipboard = navigator.clipboard;
  const copied: Promise<boolean> = clipboard && typeof clipboard.writeText === 'function'
    ? Promise.resolve(clipboard.writeText(url)).then(() => true, () => copyWithSelection(preview, url))
    : Promise.resolve(copyWithSelection(preview, url));
  copied.then((ok) => {
    if (preview.closing) {
      return;
    }
    if (ok) {
      showToast(preview, getMessage('link_preview_link_copied', 'Link copied'));
    } else {
      showToast(preview, getMessage('copy_page_url_failed_retry', 'Copy failed. Please try again.'), { error: true });
    }
  });
}

function copyWithSelection(preview: LinkPreview, text: string): boolean {
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.setAttribute('aria-hidden', 'true');
  field.style.cssText = 'position: fixed; left: -9999px; top: 0; opacity: 0;';
  preview.root.append(field);
  field.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch (_error) {
    copied = false;
  }
  field.remove();
  return copied;
}

function showToast(preview: LinkPreview, message: string, options?: ToastShowOptions): void {
  const dark = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (dark) {
    preview.toastElement.setAttribute('data-theme', 'dark');
  } else {
    preview.toastElement.removeAttribute('data-theme');
  }
  preview.toast.show(message, options);
}

function postToFrame(preview: LinkPreview, command: PreviewSurfaceCommand): void {
  try {
    const frameWindow = preview.frame.contentWindow;
    if (frameWindow) {
      frameWindow.postMessage({ source: PREVIEW_SURFACE_SOURCE, ...command }, '*');
    }
  } catch (_error) {
    // The frame may be between documents.
  }
}

// Back steps through the frame's own history only; the button shows while
// the previewed page reports it has somewhere to go back to.
function goBack(preview: LinkPreview): void {
  update(preview, { loaded: false });
  postToFrame(preview, { type: 'back' });
}

// A page that reported in reloads itself, keeping its place in the
// frame's history; Chrome's error page has no script, so it is loaded
// again from its address.
function reload(preview: LinkPreview): void {
  update(preview, { loaded: false });
  if (preview.pageReported && preview.model.blocked !== true) {
    postToFrame(preview, { type: 'reload' });
  } else {
    preview.frame.src = toPreviewFrameUrl(preview.currentUrl || preview.url);
  }
}


// Keys go to the preview window until the previewed page has reported in,
// then to the page. A frame still on its initial empty document (a slow
// site) has nothing listening, and Escape would not close the preview.
function focusPreviewedPage(preview: LinkPreview): void {
  if (!preview.shown || preview.closing || !preview.pageReported || !preview.root.matches(':focus')) {
    return;
  }
  try {
    preview.frame.focus();
  } catch (_error) {
    // Focus stays on the window; Escape still closes from there.
  }
}

function handleFrameMessage(preview: LinkPreview, event: MessageEvent): void {
  if (event.source !== preview.frame.contentWindow) {
    return;
  }
  const message = readPreviewFrameMessage(event.data);
  if (!message) {
    return;
  }
  if (message.type === 'alive') {
    preview.aliveSinceLoad = true;
    preview.pageReported = true;
    focusPreviewedPage(preview);
    // Until the page moves on, the link keeps its own address where the
    // frame loads it through another (see toPreviewFrameUrl).
    preview.currentUrl = message.url === preview.frameUrl ? preview.url : message.url;
    update(preview, { blocked: false, backVisible: message.canGoBack });
    // Only this window holds the frame, so only the frame's page hears
    // the secret; its content script hands it to the background, which
    // then takes that frame's reports as the preview's.
    if (preview.frameSecret) {
      postToFrame(preview, { type: 'bind', secret: preview.frameSecret });
    }
  } else if (message.type === 'background') {
    update(preview, { panelColor: message.color });
  } else if (message.type === 'loading') {
    update(preview, { loaded: false });
  } else if (message.type === 'loaded') {
    update(preview, { loaded: true });
  } else if (message.type === 'escape' && preview.shown) {
    close(preview);
  }
}

// Every document that really loads in the frame reports in before its load
// event. A load nothing reported is Chrome's error page: the site refused
// to be framed (or failed). The window says so and offers a tab; moving the
// link to a tab on its own read as the preview being cut off by a jump.
function handleFrameLoad(preview: LinkPreview): void {
  preview.loadCount += 1;
  const loadNumber = preview.loadCount;
  window.setTimeout(() => {
    if (surface.current !== preview || preview.closing || loadNumber !== preview.loadCount) {
      return;
    }
    const alive = preview.aliveSinceLoad;
    preview.aliveSinceLoad = false;
    if (alive) {
      update(preview, { loaded: true });
      return;
    }
    retryRefusedPage(preview, loadNumber);
  }, ALIVE_GRACE_MS);
}

// The preview frames the previewed site's domains only. A refused page may
// be one it went to from there (a link that redirects, or a link followed
// in the preview): the background allows that domain if it may and the
// frame tries once more; otherwise the window says the page is refused.
function retryRefusedPage(preview: LinkPreview, loadNumber: number): void {
  send({ action: 'linkPreviewFrameRefused', token: preview.token }, (response) => {
    if (surface.current !== preview || preview.closing || loadNumber !== preview.loadCount) {
      return;
    }
    if (response && response.retry === true && typeof response.url === 'string' &&
        /^https?:\/\//i.test(response.url)) {
      replaceFrameLocation(preview, response.url);
      return;
    }
    update(preview, { loaded: true, blocked: true });
  });
}


// Moves the page to a tab next to this one, or with `split` into a split
// view beside it.
function moveToTab(preview: LinkPreview, options?: { split?: boolean }): void {
  const url = preview.currentUrl || preview.url;
  send({ action: 'linkPreviewOpenInTab', url, ...(options && options.split ? { split: true } : {}) });
  close(preview, { instant: true });
}

export {
  ALIVE_GRACE_MS,
  copyLink,
  copyWithSelection,
  focusPreviewedPage,
  goBack,
  handleFrameLoad,
  handleFrameMessage,
  moveToTab,
  postToFrame,
  reload,
  replaceFrameLocation,
  retryRefusedPage,
  showToast
};
