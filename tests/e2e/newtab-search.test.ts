import { describe, expect } from 'vitest';
import { NEWTAB_INPUT_ID, defineFlows, delay, elementCenter, focusTab, readNumbers, readPoint, type Session } from './flow';

const flow = defineFlows();

const MENU = '[data-search-input-mode-menu]';
const PREFIX = '[data-search-input-mode-prefix]';
const CONTAINER = '_x_extension_newtab_suggestions_container_2024_unique_';
const SURFACE = '_x_extension_newtab_suggestions_surface_2026_unique_';

// Types into the New Tab search box until `expression` finds a visible
// result: text typed before the page has wired the box lists nothing.
async function searchNewtab(newtab: Session, query: string, expression: string) {
  for (let attempt = 1; ; attempt += 1) {
    await newtab.evaluate(`(() => {
      const input = document.getElementById('${NEWTAB_INPUT_ID}');
      input.focus();
      input.select();
    })()`);
    await newtab.type(query);
    try {
      return await elementCenter(newtab, expression);
    } catch (error) {
      if (attempt >= 3) throw error;
    }
  }
}

describe('New Tab search', () => {
  flow('lists an open tab and switches to it', async ({ browser, fixtures }) => {
    const fixture = await browser.openPage(fixtures.url('/fixture.html'));
    const newtab = await browser.openPage(browser.extensionUrl('newtab.html'));
    await focusTab(browser, newtab);
    await newtab.waitFor(`Boolean(document.getElementById('${NEWTAB_INPUT_ID}'))`, { message: 'no search box' });
    const item = `Array.from(document.querySelectorAll('.x-nt-suggestion-item'))
      .find((element) => element.innerText.includes('Lumno fixture page'))`;
    const center = await searchNewtab(newtab, 'Lumno fixture', item);
    await newtab.click(center.x, center.y);
    const expected = JSON.stringify(await fixture.evaluate('location.href'));
    await browser.worker.waitFor(`chrome.tabs.query({ active: true, lastFocusedWindow: true })
      .then(([tab]) => tab && tab.url === ${expected})`, { message: 'the open tab did not become active' });
  });

  // After picking a search scope from the menu over a site search's results,
  // Escape closes the menu only, and the frame around the results follows
  // the list back to its full height (#121); a second Escape leaves the
  // scope and lists the query's ordinary results.
  flow('closes the scope menu on Escape with the results framed, and leaves the scope on a second Escape', async ({ browser }) => {
    const newtab = await browser.openPage(browser.extensionUrl('newtab.html'));
    await focusTab(browser, newtab);
    await newtab.waitFor(`Boolean(document.getElementById('${NEWTAB_INPUT_ID}'))`, { message: 'no search box' });
    await newtab.evaluate(`document.getElementById('${NEWTAB_INPUT_ID}').focus()`);
    await newtab.type('gemini');
    await delay(500);
    await newtab.press('Tab');
    await newtab.waitFor(`document.querySelector('${PREFIX}').textContent.includes('Gemini')`, { message: 'Tab did not start a Gemini search' });
    await newtab.type('linear');
    await newtab.waitFor(`document.querySelectorAll('.x-nt-suggestion-item').length > 0`, { message: 'no Gemini row' });
    await newtab.press('Tab');
    await newtab.waitFor(`(() => {
      const menu = document.querySelector('${MENU}');
      return Boolean(menu && !menu.hidden && menu.querySelectorAll('[role="menuitemradio"]').length > 1);
    })()`, { message: 'Tab did not open the scope menu' });
    await delay(1000);
    // The Gemini row stays whole above the menu, and the menu fits below it (#126).
    const stacked = readNumbers(await newtab.evaluate(`(() => {
      const row = document.querySelector('.x-nt-suggestion-item').getBoundingClientRect();
      const list = document.getElementById('${CONTAINER}').getBoundingClientRect();
      const menu = document.querySelector('${MENU}').getBoundingClientRect();
      return { row: Math.round(row.bottom), list: Math.round(list.bottom), menu: Math.round(menu.top),
        menuBottom: Math.round(menu.bottom), viewport: innerHeight };
    })()`));
    expect(stacked.row, `the scope menu does not sit below the whole row: ${JSON.stringify(stacked)}`).toBeLessThanOrEqual(stacked.list);
    expect(stacked.list).toBeLessThanOrEqual(stacked.menu);
    expect(stacked.menuBottom).toBeLessThanOrEqual(stacked.viewport);
    // Scrolls the menu's own list, not the page, to the ChatGPT tile.
    const center = readPoint(await newtab.evaluate(`(() => {
      const tile = Array.from(document.querySelectorAll('${MENU} [role="menuitemradio"]'))
        .find((element) => element.getAttribute('aria-label') === 'ChatGPT');
      let list = tile.parentElement;
      while (list && !(list.scrollHeight > list.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(list).overflowY))) {
        list = list.parentElement;
      }
      if (list) {
        list.scrollTop += tile.getBoundingClientRect().top - list.getBoundingClientRect().top - 40;
      }
      const rect = tile.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    })()`));
    await delay(300);
    await newtab.click(center.x, center.y);
    await newtab.waitFor(`document.querySelector('${PREFIX}').textContent.includes('ChatGPT')`, { message: 'the ChatGPT tile did not take the scope' });

    await newtab.press('Escape');
    await newtab.waitFor(`document.querySelector('${MENU}').hidden`, { message: 'Escape did not close the scope menu' });
    await delay(500);
    expect(await newtab.evaluate(`document.querySelector('${PREFIX}').textContent.includes('ChatGPT')`),
      'Escape on the open menu left the ChatGPT scope').toBe(true);
    const frame = readNumbers(await newtab.evaluate(`(() => {
      const list = document.getElementById('${CONTAINER}').getBoundingClientRect();
      const surface = document.getElementById('${SURFACE}').getBoundingClientRect();
      return { list: Math.round(list.bottom), surface: Math.round(surface.bottom) };
    })()`));
    expect(frame.surface, `the frame stops above the results: ${JSON.stringify(frame)}`).toBeGreaterThanOrEqual(frame.list - 1);

    await newtab.press('Escape');
    await newtab.waitFor(`!document.querySelector('${PREFIX}').textContent.includes('ChatGPT')`, { message: 'a second Escape did not leave the scope' });
    await newtab.waitFor(`Array.from(document.querySelectorAll('.x-nt-suggestion-item')).every((row) => !row.innerText.includes('ChatGPT'))`,
      { message: 'the ChatGPT row stayed after leaving the scope' });
  });
});
