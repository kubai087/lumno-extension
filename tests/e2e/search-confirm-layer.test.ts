import { expect } from 'vitest';
import { defineFlows, delay, elementCenter, focusTab, NEWTAB_INPUT_ID } from './flow';

const flow = defineFlows();

flow('keeps the close-tabs confirmation above visible search results', async ({ browser }) => {
  const page = await browser.openPage(browser.extensionUrl('newtab.html'));
  await focusTab(browser, page);
  await page.waitFor(`Boolean(document.getElementById('${NEWTAB_INPUT_ID}'))`);
  await page.evaluate(`document.getElementById('${NEWTAB_INPUT_ID}').focus()`);
  await page.type('example');
  await page.waitFor(`document.querySelectorAll('.x-nt-suggestion-item').length > 0`);
  const trigger = await elementCenter(page, `document.getElementById('_x_extension_newtab_close_other_tabs_2026_unique_')`);
  await page.click(trigger.x, trigger.y);
  await page.waitFor(`Boolean(document.querySelector('.x-lumno-search-input__popconfirm[data-open="true"]'))`);
  await delay(250);
  const hit = await page.evaluate(`(() => {
    const bubble = document.querySelector('.x-lumno-search-input__popconfirm[data-open="true"]');
    const button = bubble.querySelector('button');
    const rect = button.getBoundingClientRect();
    const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    const parents = []; let node = bubble;
    while (node && node !== document.body) { const s = getComputedStyle(node); parents.push([node.id || node.className, s.overflow, s.zIndex, s.transform]); node = node.parentElement; }
    return { matches: button.contains(target), target: target && (target.id || target.className), parents };
  })()`);
  expect(hit, JSON.stringify(hit)).toMatchObject({ matches: true });
  await page.press('Escape');
  await page.waitFor(`Boolean(document.querySelector('.x-lumno-search-input__popconfirm[data-open="false"]'))`);
  expect(await page.evaluate(`getComputedStyle(document.getElementById('_x_extension_newtab_root_2024_unique_')).zIndex`)).toBe('22');
  await page.evaluate(`(() => {
    const original = chrome.runtime.sendMessage.bind(chrome.runtime);
    window.__closeOthersRequests = 0;
    chrome.runtime.sendMessage = function(message, callback) {
      if (message?.action === 'closeOtherTabsForOverlay') {
        window.__closeOthersRequests++;
        callback({ ok: true });
        return;
      }
      return original(...arguments);
    };
  })()`);
  await page.click(trigger.x, trigger.y);
  await page.waitFor(`Boolean(document.querySelector('.x-lumno-search-input__popconfirm[data-open="true"]'))`);
  await delay(200);
  const confirm = await elementCenter(page, `document.querySelector('.x-lumno-search-input__popconfirm[data-open="true"] button')`);
  await page.click(confirm.x, confirm.y);
  await page.waitFor(`window.__closeOthersRequests === 1`);
  expect(await page.evaluate(`document.getElementById('${NEWTAB_INPUT_ID}').value`)).toBe('example');
  await delay(1000);
});
