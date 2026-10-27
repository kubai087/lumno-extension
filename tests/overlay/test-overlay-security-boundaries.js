const assert = require('assert');
const { JSDOM } = require('jsdom');
const { OverlayKeyRouter } = require('../../src/overlay/keyboard.ts');
const { createOverlayPage } = require('../helpers/overlay-runtime-harness');
const { createTabSwitcherPage, switcherTabs } = require('../helpers/tab-switcher-page');

// What a web page cannot do to Lumno's surfaces in it: reach into their
// shadow roots, or drive privileged actions with synthetic events.

async function testOverlayIsClosedToThePage() {
  const page = await createOverlayPage({
    stylesheetsLoad: true,
    settings: { _x_extension_overlay_open_tabs_default_visible_2026_unique_: true },
    respond(message) {
      if (message.action === 'getTabsForOverlay') {
        return { tabs: [{ id: 1, title: 'One', url: 'https://one.test/' }, { id: 2, title: 'Two', url: 'https://two.test/' }], currentTabId: 1 };
      }
      if (message.action === 'closeOtherTabsForOverlay') return { ok: true };
      return undefined;
    }
  });
  const root = await page.open();
  assert.strictEqual(page.host().shadowRoot, null, 'the overlay should mount in a closed shadow root');
  await page.waitFor(() => root.querySelector('.x-ov-close-other-tabs'), 'the close-other-tabs action should show with the open tabs');

  const closeRequests = () => page.messages.filter((message) => message.action === 'closeOtherTabsForOverlay').length;
  const button = root.querySelector('.x-ov-close-other-tabs');
  page.trusted(button, 'click', { button: 0 });
  await page.settle(30);
  const dialog = root.getElementById(button.getAttribute('aria-controls'));
  assert.strictEqual(dialog.getAttribute('data-open'), 'true', 'the action should ask for confirmation first');
  const confirm = Array.from(dialog.querySelectorAll('button')).at(-1);
  confirm.dispatchEvent(new page.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await page.settle(30);
  assert.strictEqual(closeRequests(), 0, 'a synthetic click on the confirmation should not close any tab');
  page.trusted(confirm, 'click', { button: 0 });
  await page.settle(30);
  assert.strictEqual(closeRequests(), 1, 'a real click on the confirmation should close the other tabs');
  page.close();
}

async function testTabSwitcherIgnoresSyntheticInput() {
  const page = createTabSwitcherPage();
  page.open({ tabs: switcherTabs(3), shortcut: 'Alt+Q' });
  assert.strictEqual(page.host().shadowRoot, null, 'the tab switcher should mount in a closed shadow root');
  ['keydown', 'keyup'].forEach((type) => {
    page.window.dispatchEvent(new page.window.KeyboardEvent(type, { key: type === 'keydown' ? 'Enter' : 'Alt', bubbles: true }));
  });
  page.cards()[1].dispatchEvent(new page.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await page.settle(30);
  assert.deepStrictEqual(page.messages.filter((message) => message.action === 'switchToTab'), [],
    'synthetic keys and clicks should never switch tabs');
  page.close();
}

// The capture router swallows synthetic keys before the page sees them and
// never hands them to the overlay; the same router acts on trusted keys.
function testKeyRouterSwallowsSyntheticKeys() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const { window } = dom;
  const { document } = window;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const shadowRoot = host.attachShadow({ mode: 'closed' });
  const input = document.createElement('input');
  shadowRoot.appendChild(input);
  input.focus();
  const calls = [];
  const record = (name) => (event) => {
    calls.push(`${name}:${event && event.key}`);
    return true;
  };
  const router = new OverlayKeyRouter(window, {
    getMount: () => ({ document, host, panel: input }),
    isOverlayConnected: () => true,
    isSearchInputActive: () => true,
    handleInputKeydown: record('input'),
    handleTab: record('tab'),
    handleOverlayKeydown: record('overlay-keydown'),
    handleOverlayKeyup: record('overlay-keyup'),
    handleNumberShortcut: () => false,
    onEscapeOutside: record('escape')
  });
  router.start();
  const pageKeys = [];
  document.addEventListener('keydown', (event) => pageKeys.push(event.key));
  ['Enter', 'Tab', 'ArrowDown', 'Escape'].forEach((key) => {
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, composed: true }));
    document.body.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true }));
    document.body.dispatchEvent(new window.KeyboardEvent('keyup', { key, bubbles: true }));
  });
  assert.deepStrictEqual(calls, [], 'synthetic keys must not reach any overlay key handler');
  assert.deepStrictEqual(pageKeys, [], 'the page-facing capture should swallow synthetic keys instead of acting on them');
  router.stop();

  const trustedRouter = new OverlayKeyRouter(window, {
    isTrustedEvent: () => true,
    getMount: () => ({ document, host, panel: input }),
    isOverlayConnected: () => true,
    isSearchInputActive: () => true,
    handleInputKeydown: record('input'),
    handleNumberShortcut: () => false
  });
  trustedRouter.start();
  input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
  trustedRouter.stop();
  assert.deepStrictEqual(calls, ['input:Enter']);
  window.close();
}

(async () => {
  await testOverlayIsClosedToThePage();
  await testTabSwitcherIgnoresSyntheticInput();
  testKeyRouterSwallowsSyntheticKeys();
  console.log('overlay security boundary tests passed');
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
