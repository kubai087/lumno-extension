// The extension's keyboard commands as the browser has them bound. The
// browser owns them, so the page reads them again whenever it comes back
// into view; the shortcut chip, the shortcut list and the tab switcher's
// Ctrl+Tab link all follow this store.
import { createStore } from '../../../shared/state/store';
import type { Store } from '../../../shared/state/store';

interface BrowserCommandsState {
  // Undefined until the browser answers, and in browsers without the
  // commands API or when the read fails.
  commands: chrome.commands.Command[] | undefined;
  read: boolean;
}

class BrowserCommands {
  readonly store: Store<BrowserCommandsState> = createStore<BrowserCommandsState>({ commands: undefined, read: false });

  load(): void {
    // Not every browser has the commands API.
    if (!chrome.commands || typeof chrome.commands.getAll !== 'function') {
      this.store.setState({ commands: undefined, read: true });
      return;
    }
    chrome.commands.getAll((commands) => {
      this.store.setState({ commands: chrome.runtime.lastError ? undefined : commands, read: true });
    });
  }

  // Reads again whenever the page regains focus or is shown, since the
  // shortcuts are changed on the browser's own page.
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

export { BrowserCommands };
export type { BrowserCommandsState };
