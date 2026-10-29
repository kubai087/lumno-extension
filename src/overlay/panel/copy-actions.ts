import type { OverlayToast } from './overlay-toast';
import type { Translate } from './types';

interface CopyActionsDeps {
  overlayToast: Pick<OverlayToast, 'show'>;
  t: Translate;
}

// HTML, SVG and MathML elements have focus(); other elements do not.
function isFocusable(element: Element): element is Element & HTMLOrSVGElement {
  return 'focus' in element && typeof element.focus === 'function';
}

// Copying a result's URL to the clipboard, told in the overlay's toast.
function createCopyActions(deps: CopyActionsDeps) {
  const {
    overlayToast,
    t
  } = deps;



  // Copies through a hidden text field where the Clipboard API is refused.
  function fallbackCopyText(text: string): boolean {
    if (!document || !document.body || typeof document.execCommand !== 'function') {
      return false;
    }
    const activeElement = document.activeElement;
    const textarea = document.createElement('textarea');
    textarea.value = String(text || '');
    textarea.setAttribute('readonly', '');
    textarea.style.setProperty('position', 'fixed');
    textarea.style.setProperty('left', '-9999px');
    textarea.style.setProperty('top', '0');
    document.body.appendChild(textarea);
    textarea.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch (_error) {
      copied = false;
    }
    textarea.remove();
    if (activeElement && isFocusable(activeElement)) {
      activeElement.focus({ preventScroll: true });
    }
    return copied;
  }

  function copyTextToClipboard(text: string): Promise<void | boolean> {
    const value = String(text || '');
    const clipboard = window.navigator && window.navigator.clipboard;
    if (clipboard && typeof clipboard.writeText === 'function') {
      return Promise.resolve(clipboard.writeText(value)).catch((error: unknown) => {
        if (fallbackCopyText(value)) {
          return true;
        }
        throw error;
      });
    }
    return fallbackCopyText(value)
      ? Promise.resolve(true)
      : Promise.reject(new Error('clipboard-write-failed'));
  }

  // Copies a result's address and says whether it worked; true on success.
  function copySearchResultUrl(url: string): Promise<boolean> {
    const value = String(url || '').trim();
    if (!value) {
      overlayToast.show(t(
        'search_copy_url_failed',
        'Couldn’t copy the result link. Try again.'
      ), true);
      return Promise.resolve(false);
    }
    return copyTextToClipboard(value).then(() => {
      overlayToast.show(t(
        'search_copy_url_success',
        'Result link copied'
      ));
      return true;
    }).catch(() => {
      overlayToast.show(t(
        'search_copy_url_failed',
        'Couldn’t copy the result link. Try again.'
      ), true);
      return false;
    });
  }

  return {
    copySearchResultUrl
  };
}

export { createCopyActions };
export type { CopyActionsDeps };
