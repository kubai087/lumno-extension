// An open tab switcher: its selection, the keys and clicks that move it,
// the switch to the selected tab, closing tabs from their cards, and the
// cleanup when it closes. The page bridge and the next toggle reach it
// through the functions it puts on its host.
import type { TabSwitcherViewController } from '../react/tab-switcher';
import type { TabSwitcherTab } from '../react/tab-switcher-options';
import * as LumnoMessaging from '../../platform/messaging';
import { getMessage } from './card-text';
import type { TabSwitcherHost, TabSwitcherReply } from './host';
import { clampSelectedIndex, isRecord, normalizeAdvanceOffset, readThumbnailUpdate } from './open-context';
import type { OpenContext } from './open-context';
import { getSwitcherMountParent, placeSwitcherPanel, showSwitcherHostInTopLayer } from './placement';
import { isCommitModifierPressed, isShortcutTriggerEvent } from './shortcut';
import type { ParsedShortcut } from './shortcut';
import { SwitcherThemeFollower } from './switcher-theme';
import { createSwitcherToast } from './switcher-toast';
import { createFullscreenEscapeLock } from '../ui/fullscreen-escape-lock';
import type { SwitcherToast } from './switcher-toast';

const TAB_SWITCHER_ADVANCE_EVENT = '_x_extension_tab_switcher_advance_command_2026_unique_';

// The selection step of each arrow key.
const ARROW_OFFSETS: Readonly<Record<string, number>> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

interface SwitcherSessionParts {
  host: TabSwitcherHost;
  shadow: ShadowRoot;
  view: TabSwitcherViewController;
  panel: HTMLElement;
  context: OpenContext;
  shortcut: ParsedShortcut;
}

function stopHandledKeyEvent(event: Event | null): void {
  if (!event) {
    return;
  }
  event.preventDefault();
  if (typeof event.stopImmediatePropagation === 'function') {
    event.stopImmediatePropagation();
  }
  event.stopPropagation();
}

class SwitcherSession {
  private selectedIndex: number;
  private didRequestSwitch = false;
  // A click relayed from the shortcut's release counts as trusted.
  private allowRelayedActivation = false;
  // The press that opened the switcher may still auto-repeat.
  private suppressInitialAdvance: boolean;
  private readonly closingTabIds = new Set<number>();
  private view: TabSwitcherViewController | null;
  private readonly host: TabSwitcherHost;
  private readonly panel: HTMLElement;
  private readonly tabs: TabSwitcherTab[];
  private readonly context: OpenContext;
  private readonly shortcut: ParsedShortcut;
  private readonly toast: SwitcherToast;
  private readonly theme: SwitcherThemeFollower;
  private readonly visualViewport: VisualViewport | null;
  // Over a fullscreen video, the first Escape closes the switcher.
  private readonly fullscreenEscapeLock = createFullscreenEscapeLock(window);

  constructor(parts: SwitcherSessionParts, selectedIndex: number) {
    this.host = parts.host;
    this.view = parts.view;
    this.panel = parts.panel;
    this.context = parts.context;
    this.tabs = parts.context.tabs;
    this.shortcut = parts.shortcut;
    this.selectedIndex = selectedIndex;
    this.suppressInitialAdvance = parts.context.suppressInitialShortcutAdvance;
    this.toast = createSwitcherToast(parts.shadow);
    this.theme = new SwitcherThemeFollower(parts.view, this.toast.element);
    this.visualViewport = window.visualViewport && typeof window.visualViewport.addEventListener === 'function'
      ? window.visualViewport
      : null;
  }

  // Shows the switcher and starts following the keys, the pointer and the
  // viewport.
  open(): void {
    const host = this.host;
    this.placePanel();
    this.theme.start();
    host._lumnoTabSwitcherAdvance = (offset?: unknown): boolean => this.advanceFromShortcut(normalizeAdvanceOffset(offset));
    host._lumnoTabSwitcherCommitFromShortcutRelease = (): boolean => this.clickSelectedCard();
    host._lumnoTabSwitcherUpdateThumbnail = (update: unknown): TabSwitcherReply => this.updateThumbnail(update);
    getSwitcherMountParent(document).appendChild(host);
    showSwitcherHostInTopLayer(host);
    host._lumnoTabSwitcherCleanup = () => this.cleanup();
    window.addEventListener('keydown', this.handleKeydown, true);
    window.addEventListener('keyup', this.handleKeyup, true);
    this.fullscreenEscapeLock.start();
    if (this.visualViewport) {
      this.visualViewport.addEventListener('resize', this.placePanel, { passive: true });
      this.visualViewport.addEventListener('scroll', this.placePanel, { passive: true });
    }
    document.addEventListener('pointerdown', this.handlePointerDown, true);
    document.addEventListener(TAB_SWITCHER_ADVANCE_EVENT, this.handleExternalAdvance, true);
    this.renderSelection();
  }

  readonly select = (index: number): void => {
    this.selectedIndex = index;
    this.renderSelection();
  };

  readonly activate = (index: number, event: Event | null | undefined): void => {
    if (!event || (event.isTrusted !== true && !this.allowRelayedActivation)) {
      return;
    }
    stopHandledKeyEvent(event);
    this.selectedIndex = index;
    this.switchToSelected();
  };

  readonly closeFromCard = (index: number, event: Event | null | undefined): void => {
    if (event && event.isTrusted === true) {
      this.closeTabAt(index);
    }
  };

  private readonly placePanel = (): void => {
    placeSwitcherPanel(this.panel, this.context.tabZoomFactor, window);
  };

  private renderSelection(): void {
    if (this.view) {
      this.view.updateSelection(this.selectedIndex);
    }
  }

  private selectByOffset(offset: number): void {
    this.selectedIndex = clampSelectedIndex(this.selectedIndex + offset, this.tabs.length);
    this.renderSelection();
  }

  private advanceFromShortcut(offset: number): boolean {
    this.suppressInitialAdvance = false;
    this.selectByOffset(offset);
    return true;
  }

  private updateThumbnail(update: unknown): TabSwitcherReply {
    return this.view ? this.view.updateThumbnail(readThumbnailUpdate(update)) : { ok: false };
  }

  private close(): void {
    const cleanup = this.host._lumnoTabSwitcherCleanup;
    if (typeof cleanup === 'function') {
      cleanup();
    }
    this.host.remove();
  }

  private switchToSelected(): boolean {
    if (this.didRequestSwitch) {
      return false;
    }
    const selected = this.tabs[this.selectedIndex];
    if (!selected || typeof selected.id !== 'number') {
      this.close();
      return false;
    }
    this.didRequestSwitch = true;
    LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
      action: 'switchToTab',
      tabId: selected.id,
      windowId: typeof selected.windowId === 'number' ? selected.windowId : null
    }, () => {
      this.close();
    });
    return true;
  }

  // Clicks the selected card, so the switch runs as a trusted click would.
  private clickSelectedCard(): boolean {
    const buttons = this.view && Array.isArray(this.view.buttons) ? this.view.buttons : [];
    const selectedButton = buttons[this.selectedIndex];
    if (!selectedButton || typeof selectedButton.click !== 'function') {
      return this.switchToSelected();
    }
    const wasRequested = this.didRequestSwitch;
    this.allowRelayedActivation = true;
    try {
      selectedButton.click();
    } finally {
      this.allowRelayedActivation = false;
    }
    return !wasRequested && this.didRequestSwitch;
  }

  private closeTabAt(index: number): void {
    const tab = this.tabs[index];
    if (this.didRequestSwitch || !tab || typeof tab.id !== 'number' || this.closingTabIds.has(tab.id) || !this.view) {
      return;
    }
    const tabId = tab.id;
    this.closingTabIds.add(tabId);
    this.view.setTabClosing(tabId, true);
    LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'closeTabFromTabSwitcher', tabId }, (response) => {
      const lastError = chrome.runtime && chrome.runtime.lastError;
      this.closingTabIds.delete(tabId);
      if (!this.view) {
        return;
      }
      if (lastError || !response || response.ok !== true) {
        this.view.setTabClosing(tabId, false);
        this.toast.show(getMessage('tab_switcher_close_failed', "Couldn't close this tab"), true);
        return;
      }
      this.removeClosedTab(this.view, tabId);
    });
  }

  private removeClosedTab(view: TabSwitcherViewController, tabId: number): void {
    const tabs = this.tabs;
    const closedIndex = tabs.findIndex((item) => item.id === tabId);
    if (closedIndex >= 0) {
      tabs.splice(closedIndex, 1);
    }
    if (!tabs.length) {
      this.close();
      return;
    }
    if (closedIndex >= 0 && closedIndex < this.selectedIndex) {
      this.selectedIndex -= 1;
    }
    this.selectedIndex = Math.min(this.selectedIndex, tabs.length - 1);
    view.removeTab(tabId);
    this.renderSelection();
    this.toast.show(getMessage('tab_switcher_tab_closed', 'Tab closed'), false);
  }

  private readonly handleExternalAdvance = (event: Event): void => {
    if (this.didRequestSwitch) {
      return;
    }
    const detail: unknown = 'detail' in event ? event.detail : null;
    this.advanceFromShortcut(normalizeAdvanceOffset(isRecord(detail) ? detail.offset : undefined));
  };

  // The opening shortcut's key moves the selection; adding or dropping
  // Shift relative to the shortcut reverses.
  private handleTriggerKey(event: KeyboardEvent): void {
    stopHandledKeyEvent(event);
    // Only auto-repeat belongs to the press that opened the switcher; a
    // quick press can be released before the panel exists to see it.
    if (this.suppressInitialAdvance && event.repeat === true && isCommitModifierPressed(this.shortcut, event)) {
      return;
    }
    this.suppressInitialAdvance = false;
    const openedDirection = this.context.reverse ? -1 : 1;
    this.selectByOffset(event.shiftKey === this.shortcut.hasShift ? openedDirection : -openedDirection);
  }

  private readonly handleKeydown = (event: KeyboardEvent): void => {
    if (!event || event.isTrusted !== true) {
      return;
    }
    if (isShortcutTriggerEvent(this.shortcut, event)) {
      this.handleTriggerKey(event);
      return;
    }
    const key = event.key;
    if (key === 'Tab' || Object.prototype.hasOwnProperty.call(ARROW_OFFSETS, key)) {
      stopHandledKeyEvent(event);
      this.selectByOffset(key === 'Tab' ? (event.shiftKey ? -1 : 1) : ARROW_OFFSETS[key]);
    } else if (key === 'Enter') {
      stopHandledKeyEvent(event);
      this.switchToSelected();
    } else if (key === 'Escape') {
      stopHandledKeyEvent(event);
      this.close();
    }
  };

  private readonly handleKeyup = (event: KeyboardEvent): void => {
    if (!event || event.isTrusted !== true) {
      return;
    }
    if (isShortcutTriggerEvent(this.shortcut, event)) {
      this.suppressInitialAdvance = false;
      stopHandledKeyEvent(event);
      return;
    }
    if (this.shortcut.commitModifierEventKey && event.key === this.shortcut.commitModifierEventKey) {
      this.suppressInitialAdvance = false;
      stopHandledKeyEvent(event);
      this.clickSelectedCard();
    }
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    const path = event && typeof event.composedPath === 'function' ? event.composedPath() : [];
    const target = event.target;
    if (!path.includes(this.host) && !(target instanceof Node && this.panel.contains(target))) {
      this.close();
    }
  };

  private cleanup(): void {
    const host = this.host;
    this.fullscreenEscapeLock.stop();
    window.removeEventListener('keydown', this.handleKeydown, true);
    window.removeEventListener('keyup', this.handleKeyup, true);
    if (this.visualViewport && typeof this.visualViewport.removeEventListener === 'function') {
      this.visualViewport.removeEventListener('resize', this.placePanel);
      this.visualViewport.removeEventListener('scroll', this.placePanel);
    }
    document.removeEventListener('pointerdown', this.handlePointerDown, true);
    document.removeEventListener(TAB_SWITCHER_ADVANCE_EVENT, this.handleExternalAdvance, true);
    this.theme.destroy();
    this.toast.destroy();
    if (this.view) {
      this.view.destroy();
      this.view = null;
    }
    delete host._lumnoTabSwitcherUpdateThumbnail;
    delete host._lumnoTabSwitcherCommitFromShortcutRelease;
  }
}

export { SwitcherSession };
