const assert = require('assert');
const vm = require('vm');
const { moduleScript } = require('../helpers/module-script');

// The search shortcut on New Tab focuses Lumno's input even with input
// auto-focus off. When the address bar holds keyboard focus, the page reopens
// on the focus route instead, because focus() cannot take it from there.

const ACTION = 'lumno:newtab-focus-input';

function bootPage(options = {}) {
  const href = options.href || 'chrome-extension://abc/newtab.html';
  const listeners = [];
  const sentMessages = [];
  const replacedUrls = [];
  const preparedAt = [];
  const windowListeners = {};
  const timers = [];
  const input = {
    value: '',
    selected: 0,
    focus() { document.activeElement = input; },
    select() { input.selected += 1; }
  };
  const body = { getAttribute: () => '1' };
  const document = {
    activeElement: body,
    body,
    documentElement: {},
    visibilityState: 'visible',
    hasFocus: () => options.pageHasFocus === true,
    addEventListener() {}
  };
  const url = new URL(href);
  const window = {
    location: {
      href,
      protocol: url.protocol,
      search: url.search,
      hash: url.hash,
      replace: (next) => replacedUrls.push(next)
    },
    history: { state: null, replaceState() {} },
    addEventListener: (name, listener) => { windowListeners[name] = listener; },
    MutationObserver: undefined
  };
  const chrome = {
    runtime: {
      lastError: null,
      onMessage: { addListener: (listener) => listeners.push(listener) },
      sendMessage(message, callback) {
        sentMessages.push(message);
        if (typeof callback === 'function') {
          callback(message.action === 'getShowSearchShortcut' ? { shortcut: 'Ctrl+Shift+K' } : { ok: true });
        }
      }
    },
    tabs: {
      getCurrent: (callback) => callback({ id: options.tabId === undefined ? 7 : options.tabId })
    }
  };
  const context = vm.createContext({
    window,
    document,
    chrome,
    URL,
    Promise,
    setTimeout: (fn) => { timers.push(fn); return timers.length; },
    globalThis: null
  });
  context.globalThis = context;
  vm.runInContext(moduleScript('src/newtab/input-focus.ts', 'LumnoNewtabInputFocus'), context);
  // The search box's mounted input.
  const searchBox = {
    inputParts: { input },
    focusInput() {
      input.focus();
      return document.activeElement === input;
    }
  };
  context.LumnoNewtabInputFocus.createInputFocus({
    // The page's settings: only the auto-focus choice is read here.
    settings: { get: () => options.autoFocusEnabled === true },
    searchBox,
    SHORTCUT_KEY_MATCHER: { parseShortcut: () => null, eventMatchesShortcut: () => false },
    focusResume: { prepareFocusReload: () => preparedAt.push(replacedUrls.length) },
    refreshTabsIfIdle() {},
    initialNewtabInputAutoFocusReadyTask: Promise.resolve(),
    isImeCompositionEvent: () => false
  });
  return {
    document,
    input,
    replacedUrls,
    preparedAt,
    sentMessages,
    send(message) {
      const responses = [];
      const result = listeners[0]({ action: ACTION, ...message }, {}, (value) => responses.push(value));
      return { result, responses };
    },
    async runTimers() {
      await Promise.resolve();
      await Promise.resolve();
      while (timers.length) {
        timers.shift()();
      }
    },
    setPageFocus(value) { options.pageHasFocus = value; }
  };
}

async function main() {
  // Address bar focused: only the addressed tab reopens on the focus route.
  {
    const page = bootPage();
    const { result, responses } = page.send({ source: 'commands', tabId: 7 });
    assert.strictEqual(result, true, 'the listener answers asynchronously after checking its tab');
    assert.deepStrictEqual(page.replacedUrls, ['chrome-extension://abc/newtab.html?focus=1']);
    assert.deepStrictEqual(page.preparedAt, [0], 'the search is saved before the page reloads');
    assert.strictEqual(responses[0].reopened, true);
  }
  {
    const page = bootPage({ tabId: 9 });
    const { responses } = page.send({ source: 'commands', tabId: 7 });
    assert.deepStrictEqual(page.replacedUrls, [], 'another window must not reload');
    assert.deepStrictEqual(page.preparedAt, []);
    assert.strictEqual(responses.length, 0, 'another window must not answer');
    assert.notStrictEqual(page.document.activeElement, page.input);
  }
  {
    const page = bootPage();
    page.send({ source: 'commands-prefill', tabId: 7 });
    assert.strictEqual(page.replacedUrls.length, 1, 'the prefill shortcut also reaches the input');
  }

  // Page already focused: focus the input in place without reloading.
  {
    const page = bootPage({ pageHasFocus: true });
    const { result, responses } = page.send({ source: 'commands', tabId: 7 });
    assert.strictEqual(result, false);
    assert.deepStrictEqual(page.replacedUrls, []);
    assert.strictEqual(page.document.activeElement, page.input);
    assert.strictEqual(page.input.selected, 1, 'the shortcut selects the current query');
    assert.strictEqual(responses[0].ok, true);
  }

  // The toolbar popup holds focus while it asks, so it never reloads the page.
  {
    const page = bootPage();
    page.send({ source: 'popup', tabId: 7 });
    assert.deepStrictEqual(page.replacedUrls, []);
  }

  // Firefox keeps URL-bar focus through same-tab navigation; swap the tab.
  {
    const page = bootPage({ href: 'moz-extension://abc/newtab.html' });
    page.send({ source: 'commands', tabId: 7 });
    assert.deepStrictEqual(page.replacedUrls, []);
    assert(page.sentMessages.some((message) => message.action === 'swapNewtabForFocus'));
    assert.deepStrictEqual(page.preparedAt, [0], 'the swapped-in tab gets the search too');
  }

  // The reopened page focuses the input once although auto-focus is off.
  {
    const page = bootPage({ href: 'chrome-extension://abc/newtab.html?focus=1', pageHasFocus: true });
    await page.runTimers();
    assert.strictEqual(page.document.activeElement, page.input);
  }
  {
    const page = bootPage({ pageHasFocus: true });
    await page.runTimers();
    assert.notStrictEqual(page.document.activeElement, page.input,
      'without the hint, auto-focus off still leaves the input alone');
  }

  console.log('newtab shortcut focus route tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
