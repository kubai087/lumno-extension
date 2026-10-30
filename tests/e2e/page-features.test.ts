import { describe, expect } from 'vitest';
import * as SETTINGS from '../../src/domain/settings';
import {
  LINK_PREVIEW_HOST_ID,
  LINK_PREVIEW_TOGGLE_ID,
  TAB_SWITCHER_HOST_ID,
  activeTabUrl,
  defineFlows,
  delay,
  dispatchCommand,
  elementCenter,
  focusTab,
  getText,
  strings,
  type ElementReader,
  type Session
} from './flow';

const flow = defineFlows();

const frameSource: ElementReader = function frameSource() {
  return 'src' in this ? this.src : '';
};

async function shiftClickLink(page: Session): Promise<void> {
  const center = await elementCenter(page, `document.getElementById('target-link')`);
  await page.keyDown('Shift', { modifiers: ['Shift'] });
  await page.click(center.x, center.y, { modifiers: ['Shift'] });
  await page.keyUp('Shift');
}

describe('features on web pages', () => {
  flow('the tab switcher lists the open tabs and switches to the previously used one on Enter', async ({ browser, fixtures }) => {
    const first = await browser.openPage(fixtures.url('/fixture.html'));
    const second = await browser.openPage(fixtures.url('/page.html'));
    await focusTab(browser, first);
    await delay(300);
    await focusTab(browser, second);
    await dispatchCommand(browser, 'show-tab-switcher');
    await second.waitForShadow(TAB_SWITCHER_HOST_ID, '.x-tab-switcher-card', getText,
      (texts) => strings(texts).some((text) => text.includes('Lumno fixture page')) && strings(texts).some((text) => text.includes('Lumno web page')),
      { message: 'the tab switcher did not list both tabs' });
    await second.press('Enter');
    const expected = await first.evaluate('location.href');
    await browser.worker.waitFor(`chrome.tabs.query({ active: true, lastFocusedWindow: true })
      .then(([tab]) => tab && tab.url === ${JSON.stringify(expected)})`, { message: 'Enter did not switch to the previous tab' });
    expect(await activeTabUrl(browser)).toBe(expected);
  });

  flow('Shift+click previews a link on the page until link preview is turned off in Settings', async ({ browser, fixtures }) => {
    const web = await browser.openPage(fixtures.url('/page.html'));
    await focusTab(browser, web);
    await delay(500);
    await shiftClickLink(web);
    const target = fixtures.url('/target.html');
    await web.waitForShadow(LINK_PREVIEW_HOST_ID, 'iframe', frameSource, (sources) => sources.includes(target),
      { timeout: 8000, message: 'Shift+click did not preview the link' });
    expect(await web.evaluate('location.pathname'), 'the page should stay where it was').toBe('/page.html');

    const options = await browser.openPage(browser.extensionUrl('src/options/options.html'));
    await focusTab(browser, options);
    await options.waitFor(`document.documentElement.getAttribute('data-lumno-options-ready') === 'true'`, {
      timeout: 8000,
      message: 'Settings did not finish loading'
    });
    expect(await options.evaluate(`document.getElementById('${LINK_PREVIEW_TOGGLE_ID}').checked`), 'link preview should start on').toBe(true);
    const toggle = await elementCenter(options, `document.querySelector('label[for="${LINK_PREVIEW_TOGGLE_ID}"]')`);
    await options.click(toggle.x, toggle.y);
    await options.waitFor(`document.getElementById('${LINK_PREVIEW_TOGGLE_ID}').checked === false`, {
      message: 'the switch did not turn off'
    });
    const key = JSON.stringify(SETTINGS.linkPreviewEnabled.key);
    await browser.worker.waitFor(`Promise.all([chrome.storage.sync.get(null), chrome.storage.local.get(null)])
      .then(([sync, local]) => sync[${key}] === false || local[${key}] === false)`, {
      message: 'the switch did not save the setting'
    });

    await web.goto(fixtures.url('/page.html'));
    await focusTab(browser, web);
    await delay(500);
    await shiftClickLink(web);
    await delay(1500);
    expect(await web.evaluate(`Boolean(document.getElementById('${LINK_PREVIEW_HOST_ID}'))`),
      'Shift+click should not preview once link preview is off').toBe(false);
  });

  // The worker injects the copy-URL listener into a page the first time the
  // command runs there; the page then confirms with its toast.
  flow('the copy-URL command confirms with a toast in the page', async ({ browser, fixtures }) => {
    const web = await browser.openPage(fixtures.url('/page.html'));
    await focusTab(browser, web);
    await dispatchCommand(browser, 'show-search-prefill-v');
    await web.waitFor(`Boolean(document.getElementById('_x_extension_page_toast_2026_unique_'))`, {
      message: 'the copy-URL command did not show its toast in the page'
    });
  });

  flow('"Add to Lumno New Tab" in the page menu shows its toast in the page', async ({ browser, fixtures }) => {
    const web = await browser.openPage(fixtures.url('/page.html'));
    await focusTab(browser, web);
    const href = JSON.stringify(await web.evaluate('location.href'));
    await browser.worker.evaluate(`(async () => {
      const [tab] = (await chrome.tabs.query({})).filter((candidate) => candidate.url === ${href});
      chrome.contextMenus.onClicked.dispatch({ menuItemId: 'lumno-add-page-shortcut', pageUrl: ${href} }, tab);
    })()`);
    await web.waitFor(`Boolean(document.getElementById('__lumno_page_shortcut_toast_2026__'))`, {
      message: 'adding the page did not show the toast in it'
    });
  });
});
