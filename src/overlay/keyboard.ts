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
  // An Escape keyup arrived without its keydown: a listener ahead of the router took it.
  onEscapeTaken?(event: KeyboardEvent): void;
  onBlur?(): void;
}

function isTrustedKeyEvent(event: KeyboardEvent | null): boolean {
  return event !== null && event.isTrusted === true;
}

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

// A page-level key listener must only act on keys meant for the overlay:
// keys from inside its mount host, or keys sent while nothing on the page
// holds focus (they then target the body or the document). A focused
// host-page control - including an editable body - keeps its own keys.
function isOverlayKeyEvent(event: KeyboardEvent | null, mount: OverlayKeyMount | null | undefined): boolean {
  if (!event) {
    return false;
  }
  const config: OverlayKeyMount = mount && typeof mount === 'object' ? mount : {};
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  if ((config.host && path.includes(config.host)) ||
      (config.panel && path.includes(config.panel))) {
    return true;
  }
  const target = event.target;
  const doc = config.document || getOwnerDocument(target);
  if (!target || target === doc || (doc && target === doc.defaultView)) {
    return true;
  }
  if (doc && (target === doc.body || target === doc.documentElement)) {
    const root = target === doc.body ? doc.body : doc.documentElement;
    const editableAttribute = typeof root.getAttribute === 'function'
      ? root.getAttribute('contenteditable')
      : null;
    const editable = root.isContentEditable === true ||
      String(doc.designMode || '').toLowerCase() === 'on' ||
      (editableAttribute !== null && editableAttribute.toLowerCase() !== 'false');
    return !editable;
  }
  return false;
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
// - an Escape keyup whose keydown never reached the router: a listener added
//   before the router's took the keydown (Surfingkeys leaves its insert mode
//   on Escape and keeps the key, #127), and the overlay closes all the same;
// - window blur: modifier tracking resets.
// While another Lumno surface holds the keyboard (the tab switcher opened over
// the overlay), every key passes untouched so that surface sees its arrows,
// Enter, Escape and the modifier release that commits it.
// Synthetic (untrusted) events never drive the overlay. `handlers` supplies
// the overlay's state queries and actions.
function createOverlayKeyRouter(win: Window, handlers?: OverlayKeyRouterHandlers | null) {
  const doc = win.document;
  const config: OverlayKeyRouterHandlers = handlers && typeof handlers === 'object' ? handlers : {};
  const isTrustedEvent = typeof config.isTrustedEvent === 'function'
    ? config.isTrustedEvent
    : isTrustedKeyEvent;
  let started = false;
  let escapeKeydownSeen = false;

  // Whether this Escape keyup lost its keydown to an earlier listener.
  function isTakenEscapeKeyup(event: KeyboardEvent): boolean {
    if (event.key !== 'Escape') {
      return false;
    }
    if (event.type === 'keydown') {
      escapeKeydownSeen = true;
      return false;
    }
    if (event.type !== 'keyup') {
      return false;
    }
    const taken = !escapeKeydownSeen;
    escapeKeydownSeen = false;
    return taken;
  }

  function handleCapturedKey(event: KeyboardEvent): void {
    if (!isTrustedEvent(event)) {
      if (event && typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
      return;
    }
    // Tracked before the checks below, so a keydown another Lumno surface
    // used still counts as seen.
    const escapeTaken = isTakenEscapeKeyup(event);
    if (!config.isOverlayConnected?.() || config.isKeyboardYielded?.()) {
      return;
    }
    if (escapeTaken) {
      config.onEscapeTaken?.(event);
      return;
    }
    if (event.type === 'keyup') {
      config.onKeyUp?.(event);
    }
    const searchInputActive = Boolean(config.isSearchInputActive?.());
    const modeMenuActive = Boolean(config.shouldHandleModeMenuKey?.(event));
    if (!searchInputActive && !modeMenuActive) {
      return;
    }
    if (config.isImeComposition?.(event)) {
      event.stopImmediatePropagation();
      return;
    }
    config.syncModifiers?.(event);
    if ((event.type === 'keydown' || event.type === 'keyup') &&
        config.handleNumberShortcut?.(event)) {
      event.stopImmediatePropagation();
      return;
    }
    if (event.type === 'keydown' && searchInputActive &&
        config.getSuggestionNavigationKey?.(event)) {
      config.handleInputKeydown?.(event);
      event.stopImmediatePropagation();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) {
      // A keypress carries no browser shortcut, so the page never needs it.
      // Some pages refocus their own editor on any keypress while the
      // focused element is not a native input - the closed shadow host
      // never is - and would take the paste of Cmd+V (ChatGPT).
      if (event.type === 'keypress') {
        event.stopImmediatePropagation();
      }
      return;
    }
    if (event.type === 'keydown') {
      if (!modeMenuActive || config.handleModeMenuKey?.(event) !== true) {
        config.handleInputKeydown?.(event);
      }
    } else if (event.type === 'keyup') {
      config.syncModifiers?.(event);
    }
    event.stopImmediatePropagation();
  }

  function handleCapturedTab(event: KeyboardEvent): void {
    if (!isTrustedEvent(event) || event.key !== 'Tab') {
      return;
    }
    if (config.isKeyboardYielded?.() || !config.isSearchInputActive?.()) {
      return;
    }
    config.handleTab?.(event);
  }

  function handleDocumentKeydown(event: KeyboardEvent): void {
    if (!isTrustedEvent(event) || config.isKeyboardYielded?.()) {
      return;
    }
    if (!isOverlayKeyEvent(event, config.getMount?.())) {
      if (event.key === 'Escape') {
        config.onEscapeOutside?.(event);
      }
      return;
    }
    config.handleOverlayKeydown?.(event);
  }

  function handleDocumentKeyup(event: KeyboardEvent): void {
    if (!isTrustedEvent(event) || config.isKeyboardYielded?.() ||
        !isOverlayKeyEvent(event, config.getMount?.())) {
      return;
    }
    config.handleOverlayKeyup?.(event);
  }

  function handleBlur(): void {
    config.onBlur?.();
  }

  function start(): void {
    if (started) {
      return;
    }
    started = true;
    escapeKeydownSeen = false;
    win.addEventListener('keydown', handleCapturedKey, true);
    win.addEventListener('keypress', handleCapturedKey, true);
    win.addEventListener('keyup', handleCapturedKey, true);
    doc.addEventListener('keydown', handleCapturedTab, true);
    doc.addEventListener('keydown', handleDocumentKeydown);
    doc.addEventListener('keyup', handleDocumentKeyup);
    win.addEventListener('blur', handleBlur);
  }

  function stop(): void {
    if (!started) {
      return;
    }
    started = false;
    win.removeEventListener('keydown', handleCapturedKey, true);
    win.removeEventListener('keypress', handleCapturedKey, true);
    win.removeEventListener('keyup', handleCapturedKey, true);
    doc.removeEventListener('keydown', handleCapturedTab, true);
    doc.removeEventListener('keydown', handleDocumentKeydown);
    doc.removeEventListener('keyup', handleDocumentKeyup);
    win.removeEventListener('blur', handleBlur);
  }

  return Object.freeze({
    start,
    stop,
    get active() { return started; }
  });
}

export { createOverlayKeyRouter, isOverlayKeyEvent };
export type { OverlayKeyMount, OverlayKeyRouterHandlers };
