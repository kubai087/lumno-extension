import { copyTextThroughSelection } from '../../shared/dom/clipboard';
import type { OverlayToast } from './overlay-toast';
import type { Translate } from './types';

interface CopyActionsDeps {
  overlayToast: Pick<OverlayToast, 'show'>;
  t: Translate;
}

// Copying a result's URL to the clipboard, told in the overlay's toast.
function createCopyActions(deps: CopyActionsDeps) {
  const {
    overlayToast,
    t
  } = deps;



  function copyTextToClipboard(text: string): Promise<void | boolean> {
    const value = String(text || '');
    const clipboard = window.navigator && window.navigator.clipboard;
    if (clipboard && typeof clipboard.writeText === 'function') {
      return Promise.resolve(clipboard.writeText(value)).catch((error: unknown) => {
        if (copyTextThroughSelection(value)) {
          return true;
        }
        throw error;
      });
    }
    return copyTextThroughSelection(value)
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
