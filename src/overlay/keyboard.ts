// The overlay's mount: its shadow host, its panel and their document.
interface OverlayKeyMount {
  document?: Document | null;
  host?: EventTarget | null;
  panel?: EventTarget | null;
}

// The overlay's state queries and actions the router calls.
interface OverlayKeyRouterHandlers {
  isTrustedEvent?(event: KeyboardEvent): boolean;
  isOverlayConnected?(): boolean;
  // Another Lumno surface (the tab switcher over the overlay) holds the keyboard.
  isKeyboardYielded?(): boolean;
  getMount?(): OverlayKeyMount | null;
  isSearchInputActive?(): boolean;
  shouldHandleModeMenuKey?(event: KeyboardEvent): boolean;
  isImeComposition?(event: KeyboardEvent): boolean;
  syncModifiers?(event: KeyboardEvent): void;
  handleNumberShortcut?(event: KeyboardEvent): boolean;
  getSuggestionNavigationKey?(event: KeyboardEvent): string;
  handleInputKeydown?(event: KeyboardEvent): void;
  handleModeMenuKey?(event: KeyboardEvent): boolean;
  handleTab?(event: KeyboardEvent): void;
  handleOverlayKeydown?(event: KeyboardEvent): void;
  handleOverlayKeyup?(event: KeyboardEvent): void;
  onKeyUp?(event: KeyboardEvent): void;
  onEscapeOutside?(event: KeyboardEvent): void;
  // An Escape keyup arrived without its keydown: a listener ahead of the
  // router took it.
  onEscapeTaken?(event: KeyboardEvent): void;
  onBlur?(): void;
}

function isTrustedKeyEvent(event: KeyboardEvent | null): boolean {
  return event !== null && event.isTrusted === true;
}

function ignoreKey(): void {}

// What the router does for a handler the overlay leaves out: trusts only
// trusted events, owns no key and acts on none.
const DEFAULT_HANDLERS: Required<OverlayKeyRouterHandlers> = {
  isTrustedEvent: isTrustedKeyEvent,
  isOverlayConnected: () => false,
  isKeyboardYielded: () => false,
  getMount: () => null,
  isSearchInputActive: () => false,
  shouldHandleModeMenuKey: () => false,
  isImeComposition: () => false,
  syncModifiers: ignoreKey,
  handleNumberShortcut: () => false,
  getSuggestionNavigationKey: () => '',
  handleInputKeydown: ignoreKey,
  handleModeMenuKey: () => false,
  handleTab: ignoreKey,
  handleOverlayKeydown: ignoreKey,
  handleOverlayKeyup: ignoreKey,
  onKeyUp: ignoreKey,
  onEscapeOutside: ignoreKey,
  onEscapeTaken: ignoreKey,
  onBlur: ignoreKey
};

// A document from any window, recognized by its node type.
function isDocumentLike(value: unknown): value is Document {
  return typeof value === 'object' && value !== null && 'nodeType' in value && value.nodeType === 9;
}

function getOwnerDocument(target: EventTarget | null): Document | null {
  if (!target || !('ownerDocument' in target)) {
    return null;
  }
  const ownerDocument = target.ownerDocument;
  return isDocumentLike(ownerDocument) ? ownerDocument : null;
}

// Whether the key comes from inside the overlay's mount host or panel.
function isFromOverlayMount(event: KeyboardEvent, mount: OverlayKeyMount): boolean {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  return Boolean((mount.host && path.includes(mount.host)) || (mount.panel && path.includes(mount.panel)));
}

// Whether the page's body or root element takes typing itself.
function isEditableRoot(doc: Document, root: HTMLElement): boolean {
  const editableAttribute = typeof root.getAttribute === 'function'
    ? root.getAttribute('contenteditable')
    : null;
  return root.isContentEditable === true ||
    String(doc.designMode || '').toLowerCase() === 'on' ||
    (editableAttribute !== null && editableAttribute.toLowerCase() !== 'false');
}

// A page-level key listener must only act on keys meant for the overlay:
// keys from inside its mount host, or keys sent while nothing on the page
// holds focus (they then target the body or the document). A focused
// host-page control - including an editable body - keeps its own keys.
function isOverlayKeyEvent(event: KeyboardEvent | null, mount: OverlayKeyMount | null | undefined): boolean {
  if (!event) {
    return false;
  }
  const config: OverlayKeyMount = mount && typeof mount === 'object' ? mount : {};
  if (isFromOverlayMount(event, config)) {
    return true;
  }
  const target = event.target;
  const doc = config.document || getOwnerDocument(target);
  if (!target || target === doc || (doc && target === doc.defaultView)) {
    return true;
  }
  if (doc && (target === doc.body || target === doc.documentElement)) {
    return !isEditableRoot(doc, target === doc.body ? doc.body : doc.documentElement);
  }
  return false;
}

// Pairs each Escape keyup with its keydown. A listener added before the
// router's can keep an Escape keydown from it (Surfingkeys leaves its
// insert mode on Escape and keeps the key); the keyup still arrives.
class EscapeKeyPairs {
  private keydownSeen = false;
  private lastKeyupUnpaired = false;

  reset(): void {
    this.keydownSeen = false;
    this.lastKeyupUnpaired = false;
  }

  // Records an Escape keydown or keyup; other keys leave the pairing alone.
  note(event: KeyboardEvent): void {
    if (event.key !== 'Escape') {
      return;
    }
    if (event.type === 'keydown') {
      this.keydownSeen = true;
    } else if (event.type === 'keyup') {
      this.lastKeyupUnpaired = !this.keydownSeen;
      this.keydownSeen = false;
    }
  }

  // Whether this event is an Escape keyup whose keydown never arrived.
  isUnpairedKeyup(event: KeyboardEvent): boolean {
    return event.key === 'Escape' && event.type === 'keyup' && this.lastKeyupUnpaired;
  }
}

// Routes page-level keyboard events while the overlay is open:
// - window capture keydown/keypress/keyup: keys typed into the overlay input
//   or its scope panel run Lumno's handling and are then kept away from the
//   host page and other extensions (modifier keydown/keyup pass so browser,
//   system and Lumno's own input shortcuts work; modifier keypress does not,
//   since pages use it to pull focus into their own editor);
// - document capture keydown: Tab in the input (the double-Tab scope
//   shortcut) runs before page handlers;
// - document keydown/keyup: keys that reach the page while the overlay owns
//   the keyboard (focus inside the overlay, or nowhere); a focused host-page
//   control keeps its keys, except Escape, which closes the overlay;
// - an Escape keyup whose keydown never reached the router closes the
//   overlay all the same (see EscapeKeyPairs);
// - window blur: modifier tracking resets.
// While another Lumno surface holds the keyboard (the tab switcher opened over
// the overlay), every key passes untouched so that surface sees its arrows,
// Enter, Escape and the modifier release that commits it.
// Synthetic (untrusted) events never drive the overlay. `handlers` supplies
// the overlay's state queries and actions.
class OverlayKeyRouter {
  private readonly win: Window;
  private readonly doc: Document;
  private readonly config: Required<OverlayKeyRouterHandlers>;
  private readonly escapes = new EscapeKeyPairs();
  private started = false;

  constructor(win: Window, handlers?: OverlayKeyRouterHandlers | null) {
    this.win = win;
    this.doc = win.document;
    this.config = { ...DEFAULT_HANDLERS, ...(handlers && typeof handlers === 'object' ? handlers : {}) };
  }

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.escapes.reset();
    this.win.addEventListener('keydown', this.handleCapturedKey, true);
    this.win.addEventListener('keypress', this.handleCapturedKey, true);
    this.win.addEventListener('keyup', this.handleCapturedKey, true);
    this.doc.addEventListener('keydown', this.handleCapturedTab, true);
    this.doc.addEventListener('keydown', this.handleDocumentKeydown);
    this.doc.addEventListener('keyup', this.handleDocumentKeyup);
    this.win.addEventListener('blur', this.handleBlur);
  }

  stop(): void {
    if (!this.started) {
      return;
    }
    this.started = false;
    this.win.removeEventListener('keydown', this.handleCapturedKey, true);
    this.win.removeEventListener('keypress', this.handleCapturedKey, true);
    this.win.removeEventListener('keyup', this.handleCapturedKey, true);
    this.doc.removeEventListener('keydown', this.handleCapturedTab, true);
    this.doc.removeEventListener('keydown', this.handleDocumentKeydown);
    this.doc.removeEventListener('keyup', this.handleDocumentKeyup);
    this.win.removeEventListener('blur', this.handleBlur);
  }

  private readonly handleCapturedKey = (event: KeyboardEvent): void => {
    const config = this.config;
    if (!config.isTrustedEvent(event)) {
      if (event && typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
      return;
    }
    // Every trusted Escape counts, so a keydown another Lumno surface used
    // still pairs with its keyup.
    this.escapes.note(event);
    if (!config.isOverlayConnected() || config.isKeyboardYielded()) {
      return;
    }
    if (this.escapes.isUnpairedKeyup(event)) {
      config.onEscapeTaken(event);
      return;
    }
    if (event.type === 'keyup') {
      config.onKeyUp(event);
    }
    const searchInputActive = config.isSearchInputActive();
    const modeMenuActive = config.shouldHandleModeMenuKey(event);
    if ((searchInputActive || modeMenuActive) && this.routeTypedKey(event, searchInputActive, modeMenuActive)) {
      event.stopImmediatePropagation();
    }
  };

  // Runs Lumno's handling of a key typed into the input or the scope panel;
  // returns whether the key is then kept from the page.
  private routeTypedKey(event: KeyboardEvent, searchInputActive: boolean, modeMenuActive: boolean): boolean {
    const config = this.config;
    if (config.isImeComposition(event)) {
      return true;
    }
    config.syncModifiers(event);
    if (event.type !== 'keypress' && config.handleNumberShortcut(event)) {
      return true;
    }
    if (event.type === 'keydown' && searchInputActive && config.getSuggestionNavigationKey(event)) {
      config.handleInputKeydown(event);
      return true;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) {
      // A keypress carries no browser shortcut, so the page never needs it.
      // Some pages refocus their own editor on any keypress while the
      // focused element is not a native input - the closed shadow host
      // never is - and would take the paste of Cmd+V (ChatGPT).
      return event.type === 'keypress';
    }
    if (event.type === 'keydown') {
      if (!modeMenuActive || !config.handleModeMenuKey(event)) {
        config.handleInputKeydown(event);
      }
    } else if (event.type === 'keyup') {
      config.syncModifiers(event);
    }
    return true;
  }

  private readonly handleCapturedTab = (event: KeyboardEvent): void => {
    if (!this.config.isTrustedEvent(event) || event.key !== 'Tab') {
      return;
    }
    if (this.config.isKeyboardYielded() || !this.config.isSearchInputActive()) {
      return;
    }
    this.config.handleTab(event);
  };

  private readonly handleDocumentKeydown = (event: KeyboardEvent): void => {
    if (!this.config.isTrustedEvent(event) || this.config.isKeyboardYielded()) {
      return;
    }
    if (!isOverlayKeyEvent(event, this.config.getMount())) {
      if (event.key === 'Escape') {
        this.config.onEscapeOutside(event);
      }
      return;
    }
    this.config.handleOverlayKeydown(event);
  };

  private readonly handleDocumentKeyup = (event: KeyboardEvent): void => {
    if (!this.config.isTrustedEvent(event) || this.config.isKeyboardYielded() ||
        !isOverlayKeyEvent(event, this.config.getMount())) {
      return;
    }
    this.config.handleOverlayKeyup(event);
  };

  private readonly handleBlur = (): void => {
    this.config.onBlur();
  };
}

export { OverlayKeyRouter, isOverlayKeyEvent };
export type { OverlayKeyMount, OverlayKeyRouterHandlers };
