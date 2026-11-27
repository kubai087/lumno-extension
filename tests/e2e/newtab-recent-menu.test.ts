import { describe, expect } from 'vitest';
import * as SETTINGS from '../../src/domain/settings';
import { recordAt, stringAt } from './driver/cdp';
import { defineFlows, delay, readPoint, type Browser, type PageSession, type Point } from './flow';

const flow = defineFlows();

const SITES = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'].map((name) => `https://${name}.example/`);
const CARD = '.x-nt-recent-card';
const MENU = '.x-nt-recent-context-menu-portal';

// A New Tab whose recent cards are sites that were never opened, so a card
// that opens navigates away from the page.
async function openNewtabWithCards(browser: Browser, fixtures: { url(path: string): string }): Promise<PageSession> {
  const page = await browser.openPage(fixtures.url('/fixture.html'));
  await page.goto(browser.extensionUrl('newtab.html'));
  await page.evaluate(`(async () => {
    for (const url of ${JSON.stringify(SITES)}) {
      for (let visit = 0; visit < 3; visit += 1) await chrome.history.addUrl({ url: url + '?visit=' + visit });
    }
    await chrome.storage.sync.set(${JSON.stringify({ [SETTINGS.recentCount.key]: 8 })});
  })()`);
  await page.goto(browser.extensionUrl('newtab.html'));
  await browser.cdp.send('Page.bringToFront', {}, page.sessionId);
  await page.waitFor(`document.querySelectorAll('${CARD}').length >= 4`, { timeout: 10000, message: 'the recent cards did not show' });
  await delay(800);
  return page;
}

function cardLabel(page: PageSession, index: number): Promise<unknown> {
  return page.evaluate(`document.querySelectorAll('${CARD}')[${index}]?.getAttribute('aria-label')`);
}

async function mouse(browser: Browser, page: PageSession, type: string, point: Point, button = 'none', buttons = 0): Promise<void> {
  await browser.cdp.send('Input.dispatchMouseEvent', { type, x: point.x, y: point.y, button, buttons, clickCount: 1 }, page.sessionId);
}

// Right-clicks the card as a mouse does; CDP's right press does not always
// fire contextmenu, so it is sent when the menu did not open.
async function openCardMenu(browser: Browser, page: PageSession, index: number): Promise<Point> {
  const center = readPoint(await page.evaluate(`(() => {
    const rect = document.querySelectorAll('${CARD}')[${index}].getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  })()`));
  await mouse(browser, page, 'mouseMoved', center);
  await mouse(browser, page, 'mousePressed', center, 'right', 2);
  await delay(30);
  await page.evaluate(`(() => {
    if (document.querySelector('${MENU}[data-open="true"]')) return;
    document.elementFromPoint(${center.x}, ${center.y}).dispatchEvent(new MouseEvent('contextmenu',
      { bubbles: true, cancelable: true, clientX: ${center.x}, clientY: ${center.y}, button: 2 }));
  })()`);
  await mouse(browser, page, 'mouseReleased', center, 'right', 0);
  await page.waitFor(`document.querySelector('${MENU}[data-open="true"]') !== null`, { message: 'the card menu did not open' });
  await delay(400);
  return readPoint(await page.evaluate(`(() => {
    const rect = document.querySelector('${MENU} [data-value="remove"]').getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  })()`));
}

async function click(browser: Browser, page: PageSession, point: Point): Promise<void> {
  await mouse(browser, page, 'mouseMoved', point);
  await mouse(browser, page, 'mousePressed', point, 'left', 1);
  await delay(60);
  await mouse(browser, page, 'mouseReleased', point, 'left', 0);
}

async function pageUrl(browser: Browser, page: PageSession): Promise<string> {
  const info = await browser.cdp.send('Target.getTargetInfo', { targetId: page.targetId });
  return stringAt(recordAt(info, 'targetInfo'), 'url');
}

// #151: on macOS the click that brings the window to the front gives the
// focused card its focus back first, which closed the menu, so the click
// opened the card instead of removing it.
describe('New Tab recent card menu', () => {
  flow('removes the card when focus comes back to it while its menu is open', async ({ browser, fixtures }) => {
    const page = await openNewtabWithCards(browser, fixtures);
    const removed = JSON.stringify(await cardLabel(page, 1));
    const remove = await openCardMenu(browser, page, 1);
    // The window losing focus and coming to the front again.
    await page.evaluate(`(() => { const card = document.activeElement; card.blur(); card.focus(); })()`);
    expect(await page.evaluate(`document.querySelector('${MENU}').dataset.open`)).toBe('true');
    await click(browser, page, remove);
    await page.waitFor(`![...document.querySelectorAll('${CARD}')].some((card) => card.getAttribute('aria-label') === ${removed})`,
      { message: 'the card was not removed' });
    expect(await pageUrl(browser, page)).toContain('newtab.html');
  });

  flow('does not open the card under a menu that closed itself and is still fading out', async ({ browser, fixtures }) => {
    const page = await openNewtabWithCards(browser, fixtures);
    const remove = await openCardMenu(browser, page, 1);
    // Focus moving to the search box closes the menu without a press.
    await page.evaluate(`document.querySelector('input').focus()`);
    await click(browser, page, remove);
    await delay(1500);
    expect(await pageUrl(browser, page)).toContain('newtab.html');
    expect(await page.evaluate(`document.querySelector('[data-recent-context-menu-open]')`)).toBe(null);
  });
});
