import { describe, expect } from 'vitest';
import * as SETTINGS from '../../src/domain/settings';
import {
  OVERLAY_HOST_ID,
  OVERLAY_INPUT,
  defineFlows,
  delay,
  dispatchCommand,
  focusTab,
  getText,
  openOverlay,
  strings,
  type ElementReader
} from './flow';

const flow = defineFlows();

const inputValue: ElementReader = function value() {
  return 'value' in this ? this.value : null;
};

// Stands in for keyboard extensions such as Surfingkeys: a window capture
// listener added before the overlay's that takes single keys unless their
// target is editable, blurs an editable that takes focus before any click,
// and keeps the Escape keydown that blurs an editable.
const KEY_GRABBER = `(() => {
  window.grabbedKeys = [];
  const isEditable = (element) => Boolean(element) && (element.isContentEditable ||
    ['input', 'textarea', 'select'].includes(element.localName));
  addEventListener('focus', (event) => {
    if (isEditable(event.target)) event.target.blur();
  }, true);
  addEventListener('keydown', (event) => {
    if (isEditable(event.target) && event.key === 'Escape') {
      event.target.blur();
      event.preventDefault();
      event.stopImmediatePropagation();
    } else if (!isEditable(event.target) && event.key.length === 1) {
      window.grabbedKeys.push(event.key);
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
})()`;

describe('search overlay', () => {
  flow('opens on a web page with its input focused, lists open tabs and closes on Escape', async ({ browser, fixtures }) => {
    await browser.openPage(fixtures.url('/fixture.html'));
    const web = await browser.openPage(fixtures.url('/page.html'));
    await focusTab(browser, web);
    await openOverlay(browser, web);
    await web.type('Lumno fixture');
    await web.waitForShadow(OVERLAY_HOST_ID, '.x-ov-suggestion-item', getText,
      (texts) => strings(texts).some((text) => text.includes('Lumno fixture page')),
      { message: 'the overlay did not list the open fixture tab' });
    await web.press('Escape');
    await web.waitFor(`!document.getElementById('${OVERLAY_HOST_ID}')`, { message: 'Escape did not close the overlay' });
  });

  // The overlay keeps its focus and its typed keys under a page's key
  // grabber, and one Escape still closes it (#127).
  flow('keeps its focus and typed keys under a page key grabber, and closes on one Escape', async ({ browser, fixtures }) => {
    const web = await browser.openPage(fixtures.url('/page.html'));
    await web.evaluate(KEY_GRABBER);
    await focusTab(browser, web);
    await openOverlay(browser, web);
    await web.typeKeys('jk');
    await web.waitForShadow(OVERLAY_HOST_ID, OVERLAY_INPUT, inputValue, (values) => values[0] === 'jk',
      { message: 'the overlay input did not receive the typed keys' });
    expect(await web.evaluate('window.grabbedKeys'), 'the page took keys typed into the overlay').toEqual([]);
    await web.press('Escape');
    await web.waitFor(`!document.getElementById('${OVERLAY_HOST_ID}')`, { message: 'Escape did not close the overlay' });
  });

  // With the overlay set to open results in the current tab, Enter loads a
  // typed address in the page's own tab and Option/Alt+Enter opens a new
  // one; a pinned tab is kept and Enter opens a new tab instead.
  flow('opens typed addresses in the current tab, a new one with Alt+Enter, and a new one from a pinned tab', async ({ browser, fixtures }) => {
    // The page opens first, so the worker is running before it is asked.
    const web = await browser.openPage(fixtures.url('/page.html'));
    const key = JSON.stringify(SETTINGS.overlayOpenInCurrentTab.key);
    await browser.worker.evaluate(`Promise.all([
      chrome.storage.sync.set({ ${key}: true }),
      chrome.storage.local.set({ ${key}: true })
    ])`);
    const tabCount = async () => Number(await browser.worker.evaluate('chrome.tabs.query({}).then((tabs) => tabs.length)'));
    const openOverlayAndType = async (text: string) => {
      await focusTab(browser, web);
      await openOverlay(browser, web);
      await web.type(text);
      await delay(800);
    };
    const before = await tabCount();
    const target = fixtures.url('/target.html');
    await openOverlayAndType(target);
    await web.press('Enter');
    await web.waitFor(`location.href === ${JSON.stringify(target)}`, { message: 'Enter did not load the address in the current tab' });
    expect(await tabCount(), 'Enter opened a tab').toBe(before);

    const fixture = fixtures.url('/fixture.html');
    await openOverlayAndType(fixture);
    await web.press('Enter', { modifiers: ['Alt'] });
    await browser.worker.waitFor(`chrome.tabs.query({}).then((tabs) => tabs.some((tab) => tab.url === ${JSON.stringify(fixture)}))`,
      { message: 'Option/Alt+Enter did not open the address in a new tab' });
    expect(await web.evaluate('location.href'), 'Option/Alt+Enter navigated the current tab').toBe(target);
    expect(await tabCount()).toBe(before + 1);

    // A pinned tab is kept: Enter opens a new tab there.
    await browser.worker.evaluate(`chrome.tabs.query({}).then((tabs) => {
      const tab = tabs.find((candidate) => candidate.url === ${JSON.stringify(target)});
      return chrome.tabs.update(tab.id, { pinned: true });
    })`);
    const pinnedTarget = fixtures.url('/page.html');
    await openOverlayAndType(pinnedTarget);
    await web.press('Enter');
    await browser.worker.waitFor(`chrome.tabs.query({}).then((tabs) => tabs.some((tab) => tab.url === ${JSON.stringify(pinnedTarget)}))`,
      { message: 'Enter on a pinned tab did not open a new tab' });
    expect(await web.evaluate('location.href'), 'Enter navigated the pinned tab').toBe(target);
    expect(await tabCount()).toBe(before + 2);
  });

  // The onboarding page's demo overlay is the overlay the worker injects
  // into web pages: the search shortcut on the onboarding page imports it
  // there and opens it.
  flow('opens as the onboarding demo from the search shortcut', async ({ browser }) => {
    const onboarding = await browser.openPage(browser.extensionUrl('src/onboarding/onboarding.html'));
    await focusTab(browser, onboarding);
    await onboarding.waitFor(`Boolean(document.getElementById('onboarding-root'))`, { message: 'onboarding did not render' });
    await dispatchCommand(browser, 'show-search');
    await onboarding.waitFor(`Boolean(document.getElementById('${OVERLAY_HOST_ID}'))`, {
      timeout: 5000,
      message: 'the search shortcut did not open the demo overlay'
    });
  });
});
