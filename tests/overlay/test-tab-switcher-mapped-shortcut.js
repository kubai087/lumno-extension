const assert = require('assert');
const { moduleScript } = require('../helpers/module-script');
const { JSDOM } = require('jsdom');
const { loadBackground } = require('../helpers/background-harness');
const settings = require('../../src/shared/settings');

const SHIFT_TAB_KEY = settings.TAB_SWITCHER_SHIFT_TAB_ENABLED_STORAGE_KEY;
const MASTER_KEY = settings.TAB_SWITCHER_ENABLED_STORAGE_KEY;
const HOST_ID = '_x_extension_tab_switcher_host_2026_unique_';
const read = (file) => moduleScript(file);

function loadPage({ enabled = false, extensionPage = false } = {}) {
  const dom = new JSDOM('<!doctype html><body><button id="link">Page</button></body>', {
    runScripts: 'outside-only',
    url: extensionPage ? 'chrome-extension://lumno/newtab.html' : 'https://example.test/'
  });
  const { window } = dom;
  const messages = [];
  const listeners = { keydown: new Set(), keyup: new Set(), storage: new Set(), runtime: new Set() };
  const nativeAdd = window.addEventListener.bind(window);
  const nativeRemove = window.removeEventListener.bind(window);
  window.addEventListener = (type, listener, options) => {
    listeners[type]?.add(listener);
    nativeAdd(type, listener, options);
  };
  window.removeEventListener = (type, listener, options) => {
    listeners[type]?.delete(listener);
    nativeRemove(type, listener, options);
  };
  const chromeEvent = (set) => ({ addListener: (fn) => set.add(fn), removeListener: (fn) => set.delete(fn) });
  window.chrome = {
    runtime: {
      id: 'lumno',
      connect: extensionPage ? () => ({
        postMessage() {},
        onMessage: { addListener() {} },
        onDisconnect: { addListener() {} }
      }) : undefined,
      getURL: (file) => `chrome-extension://lumno/${file}`,
      onMessage: chromeEvent(listeners.runtime),
      sendMessage(message, callback) {
        messages.push(message);
        callback?.(message.action === 'getShowSearchShortcut'
          ? { shortcut: 'Command+Shift+K', tabSwitcherShiftTabEnabled: enabled }
          : { ok: true });
      }
    },
    tabs: { getCurrent: (callback) => callback({ id: 17 }) },
    storage: { onChanged: chromeEvent(listeners.storage) }
  };
  const runtimeFile = extensionPage
    ? 'src/overlay/tab-switcher-page-bridge.js'
    : 'src/content/shortcut-key-observer.js';
  // A development reload can reinject into a frame with an older matcher.
  window.LumnoShortcutKeyMatcher = { parseShortcut() {} };
  window.eval(read(runtimeFile));
  messages.length = 0;
  return {
    window, dom, messages,
    key(type, overrides = {}) {
      const event = {
        isTrusted: true, key: 'Tab', code: 'Tab', ctrlKey: true,
        target: window.document.body,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() {},
        ...overrides
      };
      event.composedPath ||= () => [event.target];
      listeners[type].forEach((fn) => fn(event));
      return event;
    },
    configure(next) {
      enabled = next;
      listeners.storage.forEach((fn) => fn({ [SHIFT_TAB_KEY]: { newValue: next } }, 'sync'));
    },
    arm(startedAt = Date.now()) {
      listeners.runtime.forEach((fn) => fn({
        action: 'armTabSwitcherShortcutRelease', keys: ['Control'], shortcut: 'Ctrl+Tab', commandStartedAt: startedAt
      }, {}, () => {}));
    },
    reinject() { window.eval(read(runtimeFile)); }
  };
}

function testPageHotkey(extensionPage) {
  const page = loadPage({ extensionPage });
  assert.strictEqual(page.key('keydown').defaultPrevented, undefined, 'off by default: preserve backward focus');
  assert.strictEqual(page.messages.length, 0);
  page.configure(true);
  page.messages.length = 0;
  const startedAt = Date.now();
  assert.strictEqual(page.key('keydown').defaultPrevented, true);
  assert.strictEqual(page.messages.length, 1, 'one physical chord sends one open request');
  assert.strictEqual(page.messages[0].action, 'triggerTabSwitcherFromCtrlTab');
  if (extensionPage) assert.strictEqual(page.messages[0].tabId, 17);
  page.messages.length = 0;
  assert.strictEqual(page.key('keydown', { key: 'q', code: 'KeyQ' }).defaultPrevented, true);
  assert.strictEqual(page.messages[0].action, 'triggerTabSwitcherFromCtrlTab', 'Pawgic Ctrl+Q alias opens the switcher');
  page.messages.length = 0;
  for (const override of [
    { ctrlKey: false }, { key: 'Escape' }, { altKey: true }, { metaKey: true },
    { isTrusted: false }, { isComposing: true }, { repeat: true }
  ]) {
    assert.strictEqual(page.key('keydown', override).defaultPrevented, undefined);
  }
  assert.strictEqual(page.messages.filter((m) => m.action === 'triggerTabSwitcherFromCtrlTab').length, 0);
  for (const html of ['<input>', '<textarea></textarea>', '<select></select>',
    '<div contenteditable="true"><span>Editor</span></div>', '<div role="textbox"></div>']) {
    const container = page.window.document.createElement('div');
    container.innerHTML = html;
    page.window.document.body.append(container);
    const target = container.querySelector('span') || container.firstElementChild;
    assert.strictEqual(page.key('keydown', { target }).defaultPrevented, undefined, html);
    container.remove();
  }
  const editor = page.window.document.createElement('input');
  assert.strictEqual(page.key('keydown', { composedPath: () => [editor, page.window.document.body] }).defaultPrevented, undefined,
    'a retargeted shadow input keeps its focus navigation');
  editor.id = '_x_extension_newtab_search_input_2024_unique_';
  assert.strictEqual(page.key('keydown', { target: editor }).defaultPrevented, extensionPage ? true : undefined,
    'the own New Tab search input supports the switcher with auto-focus on; website inputs still keep focus navigation');
  const searchHost = page.window.document.createElement('div');
  searchHost.id = '_x_extension_overlay_host_2026_unique_';
  assert.strictEqual(page.key('keydown', { target: searchHost }).defaultPrevented, undefined,
    'Lumno command-bar input in a closed shadow root keeps its own keyboard handling');
  const host = page.window.document.createElement('div');
  host.id = HOST_ID;
  page.window.document.body.append(host);
  assert.strictEqual(page.key('keydown').defaultPrevented, undefined, 'an open panel owns cycling; do not send a second advance');
  host.remove();
  page.messages.length = 0;
  page.key('keyup', { key: 'Control', code: 'ControlLeft', ctrlKey: false });
  if (!extensionPage) page.reinject();
  page.arm(startedAt);
  const releases = page.messages.filter((m) => m.action === 'notifyTabSwitcherShortcutModifierReleased');
  assert.strictEqual(releases.length, 1, 'a quick Shift release is replayed once after async opening, including observer reinjection');
  assert.strictEqual(releases[0].key, 'Control');
  assert.strictEqual(releases[0].shortcut, 'Ctrl+Tab', 'the relay must verify Control rather than the regular Alt+Q modifier');
  page.configure(false);
  assert.strictEqual(page.key('keydown').defaultPrevented, undefined, 'disabling takes effect in already-open documents');
  page.dom.window.close();
}

async function testBackground() {
  const tab = { id: 17, windowId: 1, active: true, url: 'https://example.test/' };
  for (const [saved, expected] of [[{}, false], [{ [SHIFT_TAB_KEY]: true }, true],
    [{ [SHIFT_TAB_KEY]: 'true' }, false], [{ [SHIFT_TAB_KEY]: true, [MASTER_KEY]: false }, false]]) {
    const harness = loadBackground({ sync: saved, tabs: [tab] });
    const config = await harness.sendMessage({ action: 'getShowSearchShortcut' }, { tab });
    assert.strictEqual(config.tabSwitcherShiftTabEnabled, expected);
    const result = await harness.sendMessage({ action: 'triggerTabSwitcherFromCtrlTab', observedAt: 1234 }, { tab });
    assert.strictEqual(result.ok, expected, 'the worker rechecks both settings at trigger time');
    if (expected) {
      const extensionResult = await harness.sendMessage({ action: 'triggerTabSwitcherFromCtrlTab', tabId: 17 });
      assert.strictEqual(extensionResult.ok, true, 'own extension pages resolve their registered tab');
      const invalid = await harness.sendMessage({ action: 'triggerTabSwitcherFromCtrlTab', tabId: 17 }, { url: 'https://example.test/' });
      assert.strictEqual(invalid.ok, false, 'web pages cannot supply another tab ID');
      const release = await harness.sendMessage({ action: 'notifyTabSwitcherShortcutModifierReleased', tabId: 17, key: 'Control', shortcut: 'Ctrl+Tab' }, { url: 'https://example.test/' });
      assert.strictEqual(release.committed, false, 'a web sender cannot relay a release for a forged tab');
    }
  }
  for (const reverse of [false, true]) {
    let received;
    const advanced = new Promise((resolve) => { received = resolve; });
    const harness = loadBackground({
      sync: { [SHIFT_TAB_KEY]: true }, tabs: [tab],
      configureChrome(chromeApi) {
        chromeApi.tabs.sendMessage = (_tabId, message, optionsOrCallback, maybeCallback) => {
          const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
          if (message.action === 'advanceOpenTabSwitcherFromCommand') {
            received(message.offset);
            callback?.({ ok: true, advanced: true });
          } else callback?.({ ok: true });
        };
      }
    });
    await harness.sendMessage({ action: 'triggerTabSwitcherFromCtrlTab', reverse }, { tab });
    assert.strictEqual(await advanced, reverse ? -1 : 1, 'relayed events preserve direction in an already-open switcher');
  }

}

(async () => {
  testPageHotkey(false);
  testPageHotkey(true);
  await testBackground();
  console.log('Ctrl+Tab switcher tests passed: opt-in, forms, shadow DOM, live settings, release replay, extension pages and sender validation');
})().catch((error) => { console.error(error); process.exitCode = 1; });
