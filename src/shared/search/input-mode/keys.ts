// Tab and Backspace on the mode: a double Tab in the empty input opens the
// mode menu, Tab on a mode tag opens it for that mode, and Backspace in the
// empty input removes the tag (asking once more while the menu is open).
// The keys read the menu and the tag through queries and let go of a
// pending double Tab or removal when either reports a change.

// The parts of a keydown event these keys read.
interface ModeKeyEvent {
  key?: string;
  defaultPrevented?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  repeat?: boolean;
  preventDefault?: () => void;
}

// The window whose timers time the double Tab and the removal confirmation.
interface TimerWindow {
  setTimeout(handler: () => void, timeout: number): number;
  clearTimeout(id: number): void;
}

interface ModeTabKeysConfig {
  modeTagRemovalConfirmationDuration?: number;
  onModeTagRemovalConfirmation?: (details: { duration: number }) => void;
  onModeTagRemovalConfirmationReset?: () => void;
}

// What the keys read of the input, the menu and the tag.
interface ModeTabKeysQueries {
  isDestroyed(): boolean;
  inputValue(): string;
  isMenuOpen(): boolean;
  isMenuOpenOrPending(): boolean;
  hasModeTag(): boolean;
}

// How long a first Tab waits for the second that opens the mode menu.
const DOUBLE_TAB_DURATION = 700;
const DEFAULT_REMOVAL_CONFIRMATION_DURATION = 2200;

function hasModifier(event: ModeKeyEvent): boolean {
  return Boolean(event.shiftKey || event.metaKey || event.ctrlKey || event.altKey);
}

function isPlainTab(event: ModeKeyEvent | null | undefined): event is ModeKeyEvent {
  return Boolean(event) && event?.key === 'Tab' && !event.defaultPrevented;
}

function preventKeyDefault(event: ModeKeyEvent): void {
  if (typeof event.preventDefault === 'function') {
    event.preventDefault();
  }
}

function readDuration(configured: number | undefined, fallback: number): number {
  const duration = Number(configured);
  return Number.isFinite(duration) ? Math.max(0, duration) : fallback;
}

// A first key press waiting a while for its second.
class PendingKey {
  pending = false;
  private timer = 0;
  private readonly win: TimerWindow | null | undefined;

  constructor(win: TimerWindow | null | undefined) {
    this.win = win;
  }

  // Waits the duration, then lets go.
  arm(duration: number, onExpire: () => void): void {
    this.pending = true;
    const win = this.win;
    if (win && typeof win.setTimeout === 'function' && duration > 0) {
      this.timer = win.setTimeout(() => {
        this.timer = 0;
        onExpire();
      }, duration);
    }
  }

  // Lets go; true when a press was waiting.
  reset(): boolean {
    const wasPending = this.pending;
    const win = this.win;
    if (this.timer && win && typeof win.clearTimeout === 'function') {
      win.clearTimeout(this.timer);
    }
    this.timer = 0;
    this.pending = false;
    return wasPending;
  }
}

class ModeTabKeys {
  private readonly config: ModeTabKeysConfig;
  private readonly queries: ModeTabKeysQueries;
  private readonly doubleTab: PendingKey;
  private readonly removal: PendingKey;

  constructor(win: TimerWindow | null | undefined, config: ModeTabKeysConfig, queries: ModeTabKeysQueries) {
    this.config = config;
    this.queries = queries;
    this.doubleTab = new PendingKey(win);
    this.removal = new PendingKey(win);
  }

  resetDoubleTab(): boolean {
    return this.doubleTab.reset();
  }

  resetRemovalConfirmation(): boolean {
    const wasPending = this.removal.reset();
    if (wasPending && typeof this.config.onModeTagRemovalConfirmationReset === 'function') {
      this.config.onModeTagRemovalConfirmationReset();
    }
    return wasPending;
  }

  // The first Tab in the empty input arms the double Tab; the second opens.
  shouldOpenMenuOnDoubleTab(event: ModeKeyEvent | null | undefined): boolean {
    if (this.queries.isDestroyed() || !isPlainTab(event)) {
      return false;
    }
    if (this.blocksDoubleTab(event) || this.queries.hasModeTag()) {
      this.doubleTab.reset();
      return false;
    }
    if (event.repeat) {
      if (this.doubleTab.pending) {
        preventKeyDefault(event);
      }
      return false;
    }
    preventKeyDefault(event);
    if (this.doubleTab.pending) {
      this.doubleTab.reset();
      return true;
    }
    this.doubleTab.arm(DOUBLE_TAB_DURATION, () => {
      this.doubleTab.reset();
    });
    return false;
  }

  // The second Tab of a double Tab the surface armed itself.
  shouldCompleteMenuDoubleTab(event: ModeKeyEvent | null | undefined): boolean {
    if (this.queries.isDestroyed() || !this.doubleTab.pending || !isPlainTab(event)) {
      return false;
    }
    if (this.blocksDoubleTab(event)) {
      this.doubleTab.reset();
      return false;
    }
    preventKeyDefault(event);
    if (event.repeat) {
      return false;
    }
    this.doubleTab.reset();
    return true;
  }

  // Tab on a mode tag opens the menu for its mode.
  shouldOpenMenuForActiveModeOnTab(event: ModeKeyEvent | null | undefined): boolean {
    if (this.queries.isDestroyed() || !isPlainTab(event)) {
      return false;
    }
    if (hasModifier(event) || event.repeat || this.queries.isMenuOpenOrPending()) {
      this.doubleTab.reset();
      return false;
    }
    if (!this.queries.hasModeTag()) {
      return false;
    }
    preventKeyDefault(event);
    this.doubleTab.reset();
    return true;
  }

  // Backspace in the empty input removes the tag; with the menu open it
  // asks first, and a second Backspace in time confirms.
  shouldRemoveTagOnBackspace(event?: ModeKeyEvent | null): boolean {
    if (this.queries.isDestroyed() || this.queries.inputValue() !== '') {
      this.resetRemovalConfirmation();
      return false;
    }
    if (!this.queries.isMenuOpen()) {
      this.resetRemovalConfirmation();
      return true;
    }
    if (event && event.repeat) {
      return false;
    }
    if (this.removal.pending) {
      this.resetRemovalConfirmation();
      return true;
    }
    const duration = readDuration(this.config.modeTagRemovalConfirmationDuration, DEFAULT_REMOVAL_CONFIRMATION_DURATION);
    this.removal.arm(duration, () => {
      this.resetRemovalConfirmation();
    });
    if (typeof this.config.onModeTagRemovalConfirmation === 'function') {
      this.config.onModeTagRemovalConfirmation({ duration });
    }
    return false;
  }

  // Whether the double Tab cannot open the menu: a modifier is held, the
  // input has text, or the menu is already open or opening.
  private blocksDoubleTab(event: ModeKeyEvent): boolean {
    return hasModifier(event) || this.queries.inputValue() !== '' || this.queries.isMenuOpenOrPending();
  }
}

export type { ModeKeyEvent, ModeTabKeysConfig, ModeTabKeysQueries };
export { ModeTabKeys };
