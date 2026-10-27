// The popup's page actions and links. Each action runs on the tab the popup
// showed, not whatever is active later; while one runs the others wait, and
// its outcome is told by Lumno's top toast or by a notice in the popup.
import { forceExitPiPInMainWorld } from '../shared/pip-main-world/exit.main-world';
import { siteTryEnterPiPInMainWorld } from '../shared/pip-main-world/site-enter.main-world';
import { createStore } from '../shared/state/store';
import type { Store } from '../shared/state/store';
import type { PopupActionId, PopupLinkId, PopupNoticeModel } from './react/popup-view';
import type { PopupPorts } from './browser';
import type { PopupRecentPin, PopupTab, Translate } from './model';
import type { PopupPageFacts } from './page-facts';

interface PopupActionsState {
  busyAction: PopupActionId | '';
  notice: PopupNoticeModel | null;
  // Pinning changes it while the popup is still open.
  recentPin: PopupRecentPin | null;
}

// A success toast shown in the popup stays this long before the popup closes.
const CLOSE_AFTER_TOAST_MS = 1400;

// Shows a success message in the popup, for pages that cannot show one.
interface PopupToastLike {
  show(message: string, duration: number): void;
}

class PopupActions {
  readonly store: Store<PopupActionsState>;
  private readonly ports: PopupPorts;
  private readonly facts: Pick<PopupPageFacts, 'tab' | 'pip' | 'recentPin'>;
  private readonly t: Translate;
  private readonly toast: PopupToastLike;
  private closeTimer = 0;

  constructor(ports: PopupPorts, facts: Pick<PopupPageFacts, 'tab' | 'pip' | 'recentPin'>, t: Translate, toast: PopupToastLike) {
    this.ports = ports;
    this.facts = facts;
    this.t = t;
    this.toast = toast;
    this.store = createStore<PopupActionsState>({ busyAction: '', notice: null, recentPin: facts.recentPin });
  }

  async run(id: PopupActionId): Promise<void> {
    const tab = this.facts.tab;
    if (!tab || this.store.getSnapshot().busyAction) return;
    this.store.setState({ busyAction: id, notice: null });
    if (id === 'clip' || id === 'search') {
      await this.ports.sendMessage({
        action: id === 'clip' ? 'popupOpenDocumentPipPicker' : 'popupShowSearch',
        tabId: tab.id
      });
      this.ports.closePopup();
    } else if (id === 'pip') {
      await this.runPictureInPicture(tab);
    } else if (id === 'copy') {
      await this.copyLink(tab);
    } else if (id === 'pin') {
      await this.togglePin(tab);
    } else if (id === 'shortcut') {
      await this.addShortcut(tab);
    }
  }

  openLink(id: PopupLinkId): void {
    const reply = id === 'shortcuts'
      ? this.ports.sendMessage({ action: 'openExtensionShortcutsPage' })
      : id === 'release'
        ? this.ports.sendMessage({ action: 'openReleasePage', reason: 'manual' })
        : this.ports.sendMessage({
          action: 'openOptionsPage',
          ...(id === 'feedback' ? { hash: 'general' } : id === 'sync' ? { hash: 'account' } : {})
        });
    reply.then(() => this.ports.closePopup());
  }

  // Runs in the page from this click, so the request carries the popup's
  // user activation. Lumno's own helper picks the playing or largest video.
  private async runPictureInPicture(tab: PopupTab): Promise<void> {
    const exiting = this.facts.pip.active;
    const result = await this.ports.executeInTab(tab.id, {
      world: 'MAIN',
      func: exiting ? forceExitPiPInMainWorld : siteTryEnterPiPInMainWorld
    });
    if (result && result.after === !exiting) {
      this.ports.closePopup();
      return;
    }
    this.showError(this.t('popup_pip_failed', 'This video can’t play picture-in-picture.'));
  }

  private async copyLink(tab: PopupTab): Promise<void> {
    try {
      await this.ports.writeClipboard(String(tab.url || ''));
    } catch (error) {
      this.showError(this.t('popup_copy_failed', 'Couldn’t copy the link. Try again.'));
      return;
    }
    await this.announceInPage(tab, this.t('copy_page_url_success', 'Current page URL copied'));
  }

  private async togglePin(tab: PopupTab): Promise<void> {
    const t = this.t;
    const result = await this.ports.sendMessage({ action: 'popupToggleRecentPin', tabId: tab.id });
    const status = result && result.status;
    if (!result || (status !== 'pinned' && status !== 'unpinned')) {
      this.showError(status === 'limit'
        ? t('recent_pin_limit_toast', 'You can pin up to 3 cards.')
        : t('toast_error', 'Action failed. Try again.'));
      return;
    }
    const recentPin = this.store.getSnapshot().recentPin;
    this.store.setState({ recentPin: { full: recentPin ? recentPin.full : false, pinned: status === 'pinned' } });
    let message = t('popup_recent_unpinned', 'Unpinned from Recent');
    if (status === 'pinned') {
      message = result.tracking === true
        ? t('recent_progress_auto_toast', 'Pinned and tracking progress. Click the radar icon on the card to stop.')
        : t('popup_recent_pinned', 'Pinned to Recent on your New Tab');
    }
    await this.announceInPage(tab, message);
  }

  private async addShortcut(tab: PopupTab): Promise<void> {
    const result = await this.ports.sendMessage({ action: 'popupAddPageShortcut', tabId: tab.id });
    const status = result && result.status;
    if (result && (status === 'added' || status === 'exists')) {
      this.announceSuccess(result.message, result.toastShown === true);
      return;
    }
    this.showError((result && result.message) || this.t('toast_error', 'Action failed. Try again.'));
  }

  // Asks the page to show the toast, then tells the success either way.
  private async announceInPage(tab: PopupTab, message: string): Promise<void> {
    const shown = await this.ports.sendMessage({ action: 'popupShowPageToast', tabId: tab.id, message });
    this.announceSuccess(message, Boolean(shown && shown.ok));
  }

  // Every success is told by Lumno's top toast: the page's when it showed
  // one, so the popup gets out of the way, otherwise the popup's own.
  private announceSuccess(message: string, shownInPage: boolean): void {
    this.store.setState({ busyAction: '' });
    if (shownInPage || !message) {
      this.ports.closePopup();
      return;
    }
    this.toast.show(message, CLOSE_AFTER_TOAST_MS);
    window.clearTimeout(this.closeTimer);
    this.closeTimer = window.setTimeout(() => this.ports.closePopup(), CLOSE_AFTER_TOAST_MS);
  }

  private showError(text: string): void {
    this.store.setState({ busyAction: '', notice: { text, tone: 'error' } });
  }
}

export { PopupActions };
export type { PopupActionsState };
