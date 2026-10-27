const assert = require('assert');
const { JSDOM } = require('jsdom');
const { OverlayKeyRouter } = require('../../src/overlay/keyboard.ts');

// The real overlay key router runs here. JSDOM cannot create trusted events,
// so the router's trust predicate is swapped for one that accepts them; the
// security test covers the untrusted path with the default predicate.
const dom = new JSDOM('<!doctype html><div id="overlay"></div><div id="lumno-host"></div>');
const { window } = dom;
const { document } = window;
const overlay = document.getElementById('overlay');
const host = document.getElementById('lumno-host');
const suggestionsContainer = document.createElement('div');
overlay.appendChild(suggestionsContainer);
const shadowRoot = host.attachShadow({ mode: 'open' });
const searchInput = document.createElement('input');
const modeMenu = document.createElement('div');
modeMenu.tabIndex = -1;
shadowRoot.append(searchInput, modeMenu);

const handledInputKeys = [];
const handledModeMenuKeys = [];
const hostPageKeys = [];
const hostPageKeyups = [];
const activatedSuggestionIndexes = [];
const suggestionItems = Array.from({ length: 3 }, (_, index) => ({
  click() {
    activatedSuggestionIndexes.push(index);
  }
}));
const numberShortcutSignals = [];
let imeKeyUpCount = 0;
let macosCtrlNavigationEnabled = false;
let keyboardYielded = false;
const takenEscapes = [];
const SUGGESTION_NAVIGATION = require('../../src/shared/search/suggestion-navigation.ts');
const numberShortcutOptions = {
  primaryModifier: 'meta',
  holdDurationMs: 5,
  timeoutMs: 50,
  onHoldStart() {
    numberShortcutSignals.push('toast-show');
  },
  onHoldEnd() {
    numberShortcutSignals.push('toast-hide');
  }
};
const keyRouter = new OverlayKeyRouter(window, {
  isTrustedEvent: (event) => Boolean(event),
  getMount: () => ({ document, host, panel: overlay }),
  isOverlayConnected: () => overlay.isConnected,
  isKeyboardYielded: () => keyboardYielded,
  isSearchInputActive: () => document.activeElement === searchInput ||
    shadowRoot.activeElement === searchInput,
  shouldHandleModeMenuKey: () => shadowRoot.activeElement === modeMenu,
  handleModeMenuKey(event) {
    handledModeMenuKeys.push(event.key);
    event.preventDefault();
    if (event.key === 'Tab') {
      searchInput.focus();
    }
    return true;
  },
  isImeComposition: (event) => Boolean(event && event.isComposing),
  handleInputKeydown(event) {
    handledInputKeys.push(event.key);
    if (event.key === 'Tab') {
      event.preventDefault();
    }
  },
  syncModifiers: () => {},
  handleNumberShortcut: (event) => SUGGESTION_NAVIGATION.handleNumberShortcutKeyEvent(
    event,
    suggestionItems,
    suggestionsContainer,
    numberShortcutOptions
  ),
  getSuggestionNavigationKey: (event) =>
    macosCtrlNavigationEnabled && event.ctrlKey && event.key.toLowerCase() === 'n'
      ? 'ArrowDown'
      : '',
  onKeyUp() {
    imeKeyUpCount += 1;
  },
  onEscapeTaken(event) {
    takenEscapes.push(event.type);
  }
});
keyRouter.start();
document.addEventListener('keydown', (event) => {
  hostPageKeys.push({ key: event.key, targetTag: event.target.tagName });
});
document.addEventListener('keyup', (event) => {
  hostPageKeyups.push({ key: event.key, targetTag: event.target.tagName });
});

async function run() {
searchInput.focus();

const imeKeydown = new window.KeyboardEvent('keydown', {
  bubbles: true,
  composed: true,
  key: 'f',
  code: 'KeyF',
  isComposing: true
});
searchInput.dispatchEvent(imeKeydown);

assert.strictEqual(
  imeKeydown.defaultPrevented,
  false,
  'IME isolation should not prevent the browser from updating the composition'
);
assert.deepStrictEqual(
  handledInputKeys,
  [],
  'IME keys should not run Lumno search input shortcuts'
);
assert.deepStrictEqual(
  hostPageKeys,
  [],
  'IME keys from the Shadow DOM input should not reach host-page player shortcuts'
);

const regularKeydown = new window.KeyboardEvent('keydown', {
  bubbles: true,
  composed: true,
  key: 'x',
  code: 'KeyX'
});
searchInput.dispatchEvent(regularKeydown);

assert.deepStrictEqual(
  handledInputKeys,
  ['x'],
  'regular text keys should continue through Lumno input handling'
);
assert.deepStrictEqual(
  hostPageKeys,
  [],
  'regular text keys should remain isolated from host-page shortcuts'
);

const doubleTabEvents = [0, 1].map(() => new window.KeyboardEvent('keydown', {
  bubbles: true,
  cancelable: true,
  composed: true,
  key: 'Tab',
  code: 'Tab'
}));
doubleTabEvents.forEach((event) => {
  searchInput.dispatchEvent(event);
  searchInput.dispatchEvent(new window.KeyboardEvent('keyup', {
    bubbles: true,
    composed: true,
    key: 'Tab',
    code: 'Tab'
  }));
});

assert.deepStrictEqual(
  handledInputKeys,
  ['x', 'Tab', 'Tab'],
  'both presses of the double-Tab shortcut should stay in Lumno input handling'
);
assert.ok(
  doubleTabEvents.every((event) => event.defaultPrevented),
  'both Tab presses should keep focus inside the Lumno input'
);
assert.deepStrictEqual(
  hostPageKeys,
  [],
  'double-Tab keydown events should not reach host-page shortcuts'
);
assert.deepStrictEqual(
  hostPageKeyups,
  [],
  'double-Tab keyup events should not reach host-page shortcuts'
);

const disabledMacCtrlNavigationEvent = new window.KeyboardEvent('keydown', {
  bubbles: true,
  cancelable: true,
  composed: true,
  key: 'n',
  code: 'KeyN',
  ctrlKey: true
});
searchInput.dispatchEvent(disabledMacCtrlNavigationEvent);
assert.deepStrictEqual(
  hostPageKeys,
  [{ key: 'n', targetTag: 'DIV' }],
  'Ctrl+N should remain untouched while the Labs experiment is off'
);
hostPageKeys.length = 0;

macosCtrlNavigationEnabled = true;
const enabledMacCtrlNavigationEvent = new window.KeyboardEvent('keydown', {
  bubbles: true,
  cancelable: true,
  composed: true,
  key: 'n',
  code: 'KeyN',
  ctrlKey: true
});
searchInput.dispatchEvent(enabledMacCtrlNavigationEvent);
assert.strictEqual(
  handledInputKeys.filter((key) => key === 'n').length,
  1,
  'enabled Ctrl+N should run the Overlay input handler exactly once'
);
assert.deepStrictEqual(
  hostPageKeys,
  [],
  'enabled Ctrl+N should not leak to the host page'
);
macosCtrlNavigationEnabled = false;

const enterNumberModeEvent = new window.KeyboardEvent('keydown', {
  bubbles: true,
  cancelable: true,
  composed: true,
  key: 'Meta',
  code: 'MetaLeft',
  metaKey: true
});
searchInput.dispatchEvent(enterNumberModeEvent);
assert.strictEqual(
  suggestionsContainer.getAttribute('data-number-shortcuts-active'),
  null,
  'the Overlay capture handler should keep number badges hidden during the hold'
);
assert.strictEqual(enterNumberModeEvent.defaultPrevented, false);
assert.deepStrictEqual(
  hostPageKeys,
  [{ key: 'Meta', targetTag: 'DIV' }],
  'the initial modifier press should remain available to browser and host shortcuts'
);
await new Promise((resolve) => setTimeout(resolve, 10));
assert.deepStrictEqual(numberShortcutSignals, ['toast-show']);
assert.strictEqual(
  suggestionsContainer.getAttribute('data-number-shortcuts-scroll-locked'),
  'true',
  'the Overlay should lock result scrolling after the long-hold threshold'
);
const releaseNumberModeEvent = new window.KeyboardEvent('keyup', {
  bubbles: true,
  cancelable: true,
  composed: true,
  key: 'Meta',
  code: 'MetaLeft'
});
searchInput.dispatchEvent(releaseNumberModeEvent);
assert.strictEqual(
  suggestionsContainer.getAttribute('data-number-shortcuts-active'),
  'true',
  'releasing the modifier should reveal number jump mode'
);
assert.strictEqual(releaseNumberModeEvent.defaultPrevented, true);
assert.deepStrictEqual(numberShortcutSignals, ['toast-show', 'toast-hide']);
hostPageKeys.length = 0;

const chooseNumberEvent = new window.KeyboardEvent('keydown', {
  bubbles: true,
  cancelable: true,
  composed: true,
  key: '2',
  code: 'Digit2'
});
searchInput.dispatchEvent(chooseNumberEvent);
assert.deepStrictEqual(
  activatedSuggestionIndexes,
  [2],
  'a plain number should activate the mapped Overlay result'
);
assert.strictEqual(
  suggestionsContainer.getAttribute('data-number-shortcuts-active'),
  null,
  'the Overlay number jump mode should close after selection'
);
assert.strictEqual(chooseNumberEvent.defaultPrevented, true);
assert.deepStrictEqual(
  hostPageKeys,
  [],
  'number jump mode keys should not reach host-page shortcuts'
);

modeMenu.focus();
['ArrowDown', 'Enter', 'Tab'].forEach((key) => {
  modeMenu.dispatchEvent(new window.KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    composed: true,
    key
  }));
  const keyupTarget = key === 'Tab' ? searchInput : modeMenu;
  keyupTarget.dispatchEvent(new window.KeyboardEvent('keyup', {
    bubbles: true,
    composed: true,
    key
  }));
});

assert.deepStrictEqual(
  handledModeMenuKeys,
  ['ArrowDown', 'Enter', 'Tab'],
  'scope-panel navigation and selection should run through the isolated handler'
);
assert.strictEqual(
  shadowRoot.activeElement,
  searchInput,
  'scope-panel Tab should return focus to the Lumno input'
);
assert.deepStrictEqual(
  hostPageKeys,
  [],
  'scope-panel keydown events should not reach host-page shortcuts'
);
assert.deepStrictEqual(
  hostPageKeyups,
  [],
  'scope-panel keyup events should not reach host-page shortcuts'
);
assert.ok(
  imeKeyUpCount > 0,
  'overlay keyups should end the IME commit-Enter window'
);

// ChatGPT focuses its composer on a window keypress (Cmd+V included) whenever
// document.activeElement is not a native input - which the shadow host never
// is - so the paste would land in the page. Modifier keypresses stay inside.
searchInput.focus();
const hostPageKeypresses = [];
const recordHostKeypress = (event) => {
  hostPageKeypresses.push(event.key);
};
window.addEventListener('keypress', recordHostKeypress);
const pasteKeydown = new window.KeyboardEvent('keydown', {
  bubbles: true,
  cancelable: true,
  composed: true,
  key: 'v',
  code: 'KeyV',
  metaKey: true
});
searchInput.dispatchEvent(pasteKeydown);
['meta', 'ctrl', 'alt'].forEach((modifier) => {
  searchInput.dispatchEvent(new window.KeyboardEvent('keypress', {
    bubbles: true,
    cancelable: true,
    composed: true,
    key: 'v',
    code: 'KeyV',
    [`${modifier}Key`]: true
  }));
});
window.removeEventListener('keypress', recordHostKeypress);
assert.deepStrictEqual(hostPageKeypresses, [],
  'modifier keypresses from the overlay input should not reach the host page');
assert.strictEqual(pasteKeydown.defaultPrevented, false,
  'Cmd+V keydown should still paste into the overlay input');
assert.deepStrictEqual(hostPageKeys.slice(-1), [{ key: 'v', targetTag: 'DIV' }],
  'modifier keydowns should still pass for browser and system shortcuts');
hostPageKeys.length = 0;

// The tab switcher can open over the overlay while its input keeps focus. The
// switcher listens on the window after the router, so the router must let it
// see its navigation keys and the modifier release that commits it.
keyboardYielded = true;
searchInput.focus();
const switcherKeys = [];
const recordSwitcherKey = (event) => {
  switcherKeys.push(`${event.type}:${event.key}`);
};
window.addEventListener('keydown', recordSwitcherKey, true);
window.addEventListener('keyup', recordSwitcherKey, true);
const handledInputKeyCount = handledInputKeys.length;
['ArrowRight', 'Enter', 'Escape', 'Tab'].forEach((key) => {
  searchInput.dispatchEvent(new window.KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    composed: true,
    key
  }));
});
searchInput.dispatchEvent(new window.KeyboardEvent('keyup', {
  bubbles: true,
  cancelable: true,
  composed: true,
  key: 'Alt',
  code: 'AltLeft'
}));
window.removeEventListener('keydown', recordSwitcherKey, true);
window.removeEventListener('keyup', recordSwitcherKey, true);
assert.deepStrictEqual(switcherKeys, [
  'keydown:ArrowRight',
  'keydown:Enter',
  'keydown:Escape',
  'keydown:Tab',
  'keyup:Alt'
], 'the tab switcher should see every key while it holds the keyboard');
assert.strictEqual(handledInputKeys.length, handledInputKeyCount,
  'the overlay input should not act on keys meant for the tab switcher');
keyboardYielded = false;
hostPageKeys.length = 0;
hostPageKeyups.length = 0;

// An Escape keyup whose keydown never reached the router (Surfingkeys took
// it, #127) closes the overlay; one after a keydown the router saw - even one
// the tab switcher used - does not.
const escapeEvent = (type) => new window.KeyboardEvent(type, {
  bubbles: true,
  cancelable: true,
  composed: true,
  key: 'Escape',
  code: 'Escape'
});
searchInput.focus();
searchInput.dispatchEvent(escapeEvent('keydown'));
searchInput.dispatchEvent(escapeEvent('keyup'));
assert.deepStrictEqual(takenEscapes, [], 'an Escape the router saw go down is not a taken one');
keyboardYielded = true;
searchInput.dispatchEvent(escapeEvent('keydown'));
keyboardYielded = false;
searchInput.dispatchEvent(escapeEvent('keyup'));
assert.deepStrictEqual(takenEscapes, [], 'an Escape the tab switcher used is not a taken one');
searchInput.dispatchEvent(escapeEvent('keyup'));
assert.deepStrictEqual(takenEscapes, ['keyup'], 'an Escape keyup without its keydown should close the overlay');
hostPageKeys.length = 0;

keyRouter.stop();
const afterStopKeydown = new window.KeyboardEvent('keydown', {
  bubbles: true,
  composed: true,
  key: 'y'
});
searchInput.focus();
searchInput.dispatchEvent(afterStopKeydown);
assert.deepStrictEqual(hostPageKeys, [{ key: 'y', targetTag: 'DIV' }],
  'a stopped router no longer isolates input keys');

console.log('overlay input extension isolation tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
