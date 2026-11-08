// The keys typed while the search overlay is still opening. Between the
// shortcut and the overlay's input taking focus (its module loads, then its
// stylesheets), typed keys reach whatever the page had focused: a Google
// Sheets cell took the first letters of a search (#140). Once the shortcut
// is pressed or the worker starts opening the overlay, this keeps the
// printable keys from the page and holds them for the overlay, which puts
// them in its input when it takes focus.
//
// It holds keys only in the top frame, where the overlay opens, and only for
// a short while: the overlay that opens takes them, the worker cancels when
// it does not open, and a click or leaving the page ends it too. Keys with
// Ctrl, Alt or Cmd, IME composition, Escape and the arrow keys still reach
// the page.

// How long one arm holds keys without the overlay taking them.
const TYPE_AHEAD_HOLD_MS = 1500;
// Held text older than this is dropped instead of handed over.
const TYPE_AHEAD_MAX_AGE_MS = 5000;
// Keys that would submit or edit what the page has focused. While holding
// they are kept from it; they add nothing to the held text.
const PAGE_EDITING_KEYS: ReadonlySet<string> = new Set(['Enter', 'Tab', 'Backspace', 'Delete']);

interface OverlayTypeAheadOptions {
  // Whether the overlay is already open; a shortcut then closes it.
  isOverlayOpen(): boolean;
  now?(): number;
}

class OverlayTypeAhead {
  private readonly win: Window;
  private readonly options: OverlayTypeAheadOptions;
  private readonly now: () => number;
  private text = '';
  private armedAt = 0;
  private holding = false;
  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;

  constructor(win: Window, options: OverlayTypeAheadOptions) {
    this.win = win;
    this.options = options;
    this.now = options.now || (() => Date.now());
  }

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.win.addEventListener('keydown', this.handleKeydown, true);
    this.win.addEventListener('pointerdown', this.handleLeave, true);
    this.win.addEventListener('blur', this.handleLeave);
    this.win.addEventListener('pagehide', this.handleLeave);
  }

  // Starts holding keys for an overlay about to open; a second arm while
  // holding keeps what was typed and extends the hold.
  arm(): void {
    if (this.options.isOverlayOpen()) {
      return;
    }
    if (!this.holding) {
      this.text = '';
    }
    this.holding = true;
    this.armedAt = this.now();
    this.clearHoldTimer();
    this.holdTimer = setTimeout(() => {
      this.holdTimer = null;
      this.holding = false;
    }, TYPE_AHEAD_HOLD_MS);
  }

  // The overlay is not opening: what was held is dropped.
  cancel(): void {
    this.stop();
    this.text = '';
  }

  // Hands the held text to the overlay and stops holding.
  take(): string {
    const text = this.now() - this.armedAt <= TYPE_AHEAD_MAX_AGE_MS ? this.text : '';
    this.cancel();
    return text;
  }

  isHolding(): boolean {
    return this.holding;
  }

  private stop(): void {
    this.holding = false;
    this.clearHoldTimer();
  }

  private clearHoldTimer(): void {
    if (this.holdTimer !== null) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
  }

  private readonly handleKeydown = (event: KeyboardEvent): void => {
    if (!this.holding || event.isTrusted !== true || event.isComposing ||
        event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (event.key === 'Backspace' && this.text) {
      this.text = Array.from(this.text).slice(0, -1).join('');
    } else if (typeof event.key === 'string' && Array.from(event.key).length === 1) {
      this.text += event.key;
    } else if (!PAGE_EDITING_KEYS.has(event.key)) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  // Clicking somewhere or leaving the page means the keys are not for an
  // overlay any more; what was already held still goes to it. Element blur
  // does not bubble, so the bubbling blur listener hears only the window.
  private readonly handleLeave = (): void => {
    this.stop();
  };
}

export { OverlayTypeAhead, TYPE_AHEAD_HOLD_MS, TYPE_AHEAD_MAX_AGE_MS };
export type { OverlayTypeAheadOptions };
