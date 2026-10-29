// Copying a bookmark's or a search result's URL to the clipboard (with
// the textarea fallback where the async clipboard is unavailable) and the
// page toast that confirms it.
import { copyTextThroughSelection } from './dom/clipboard';
import type { ToastController, ToastTask } from '../shared/ui/toast-screen';
import type { ShowToast, Translate } from './newtab-types';

interface ClipboardActionsDeps {
  t: Translate;
  toastController: Pick<ToastController, 'show' | 'hide' | 'begin'>;
}

function createClipboardActions(deps: ClipboardActionsDeps) {
  const {
    t,
    toastController
  } = deps;

  function hideToast(): void {
    toastController.hide();
  }

  const showToast: ShowToast = (message, isError, options) => {
    toastController.show(message, {
      ...options,
      error: Boolean(isError)
    });
  };

  // A task that may run long: its loading Toast turns into the result in place.
  function beginToast(message: string): ToastTask {
    return toastController.begin(message);
  }


  function copyTextToClipboard(text: unknown): Promise<unknown> {
    const value = String(text || '');
    const clipboard = window.navigator && window.navigator.clipboard;
    if (clipboard && typeof clipboard.writeText === 'function') {
      return Promise.resolve(clipboard.writeText(value)).catch((error) => {
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

  function copyBookmarkUrl(url: unknown): Promise<boolean> {
    const value = String(url || '').trim();
    if (!value) {
      showToast(t('bookmarks_copy_url_failed', 'Couldn’t copy the link. Try again.'), true);
      return Promise.resolve(false);
    }
    return copyTextToClipboard(value).then(() => {
      showToast(t('bookmarks_copy_url_success', 'Bookmark link copied'));
      return true;
    }).catch(() => {
      showToast(t('bookmarks_copy_url_failed', 'Couldn’t copy the link. Try again.'), true);
      return false;
    });
  }

  function copySearchResultUrl(url: unknown): Promise<boolean> {
    const value = String(url || '').trim();
    if (!value) {
      showToast(t('search_copy_url_failed', 'Couldn’t copy the result link. Try again.'), true);
      return Promise.resolve(false);
    }
    return copyTextToClipboard(value).then(() => {
      showToast(t('search_copy_url_success', 'Result link copied'));
      return true;
    }).catch(() => {
      showToast(t('search_copy_url_failed', 'Couldn’t copy the result link. Try again.'), true);
      return false;
    });
  }

  return {
    hideToast,
    showToast,
    beginToast,
    copyBookmarkUrl,
    copySearchResultUrl
  };
}

type ClipboardActions = ReturnType<typeof createClipboardActions>;

export { createClipboardActions };
export type { ClipboardActions, ClipboardActionsDeps };
