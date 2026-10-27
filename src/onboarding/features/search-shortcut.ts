// The shortcut that opens Lumno's search, as the browser has it bound; the
// platform default until the browser answers or when it binds none. The
// browser owns it, so it is read again whenever the page comes back into
// view. The copy shows it and the page answers it with the demo overlay.
import { createStore } from '../../shared/state/store';
import type { Store } from '../../shared/state/store';

const SHOW_SEARCH_COMMAND_NAME = 'show-search';

function isMacPlatform(): boolean {
  return /Mac|iPhone|iPad|iPod/i.test(String(navigator.platform || ''));
}

function getDefaultShortcut(): string {
  return isMacPlatform() ? 'Command+Shift+K' : 'Ctrl+Shift+K';
}

class SearchShortcut {
  readonly store: Store<{ shortcut: string }> = createStore({ shortcut: getDefaultShortcut() });

  load(): void {
    const apply = (shortcut: string) => this.store.setState({ shortcut: shortcut || getDefaultShortcut() });
    if (typeof chrome === 'undefined' || !chrome.commands || typeof chrome.commands.getAll !== 'function') {
      apply('');
      return;
    }
    try {
      chrome.commands.getAll((commands) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          apply('');
          return;
        }
        const command = (Array.isArray(commands) ? commands : []).find((item) => item && item.name === SHOW_SEARCH_COMMAND_NAME);
        apply(command && typeof command.shortcut === 'string' ? command.shortcut : '');
      });
    } catch (error) {
      apply('');
    }
  }

  follow(win: Window, doc: Document): void {
    this.load();
    win.addEventListener('focus', () => this.load(), true);
    doc.addEventListener('visibilitychange', () => {
      if (doc.visibilityState === 'visible') {
        this.load();
      }
    }, true);
  }
}

export { SearchShortcut, isMacPlatform };
