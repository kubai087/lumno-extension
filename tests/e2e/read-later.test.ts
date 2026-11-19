import { describe, expect } from 'vitest';
import { defineFlows, focusTab } from './flow';
import { readLaterPages, recentMode, pinnedRecentSites } from '../../src/domain/settings/recent-sites';

const flow = defineFlows();
describe('Read later', () => {
  flow('saves the popup target, shows it across modes, persists, and removes it manually', async ({ browser, fixtures }) => {
    const url = fixtures.url('/fixture.html');
    await browser.openPage(url);
    const newtab = await browser.openPage(browser.extensionUrl('newtab.html'));
    await focusTab(browser, newtab);
    const result = await newtab.evaluate(`chrome.tabs.query({}).then((tabs) => {
      const tab = tabs.find((item) => item.url === ${JSON.stringify(url)});
      return chrome.runtime.sendMessage({ action: 'readLaterAdd', tabId: tab.id });
    })`);
    expect(result).toEqual({ status: 'added' });
    await newtab.waitFor(`document.querySelectorAll('.x-nt-read-later-tag').length === 1`);
    for (const mode of ['latest', 'most', 'readLater']) {
      await newtab.evaluate(`chrome.storage.sync.set({ ${JSON.stringify(recentMode.key)}: ${JSON.stringify(mode)} })`);
      await newtab.waitFor(`Boolean(document.querySelector('[data-recent-mode="${mode}"][data-react-island="recent-sites"] .x-nt-read-later-tag'))`);
    }
    const next = await browser.openPage(browser.extensionUrl('newtab.html'));
    await focusTab(browser, next);
    await next.waitFor(`document.querySelectorAll('.x-nt-read-later-tag').length === 1`);
    const popup = await browser.openPage(browser.extensionUrl('src/popup/popup.html'));
    // An extension page cannot be saved; the action still renders safely.
    await popup.waitFor(`Boolean(document.querySelector('[data-action="readLater"]'))`);
    await focusTab(browser, next);
    await next.evaluate(`document.querySelector('.x-nt-recent-card').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 600, clientY: 400 }))`);
    await next.waitFor(`Boolean(document.querySelector('[data-value="remove"]'))`);
    await next.evaluate(`document.querySelector('[data-value="remove"]').click()`);
    await next.waitFor(`document.querySelectorAll('.x-nt-read-later-tag').length === 0`);
    expect(await next.evaluate(`document.getElementById('_x_extension_newtab_recent_sites_2024_unique_').dataset.visible`)).toBe('true');
    expect(await next.evaluate(`Boolean(document.querySelector('.x-nt-recent-mode-switch'))`)).toBe(true);
    expect(await next.evaluate(`chrome.storage.local.get(${JSON.stringify(readLaterPages.key)}).then((data) => data[${JSON.stringify(readLaterPages.key)}].length)`)).toBe(0);
    expect(await next.evaluate(`chrome.storage.sync.get(${JSON.stringify(pinnedRecentSites.key)}).then((data) => data[${JSON.stringify(pinnedRecentSites.key)}].length)`)).toBe(0);
  });
});
