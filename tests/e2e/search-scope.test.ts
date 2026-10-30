import { describe, expect } from 'vitest';
import {
  NEWTAB_INPUT_ID,
  OVERLAY_HOST_ID,
  defineFlows,
  elementCenter,
  focusTab,
  getText,
  openOverlay,
  type ElementReader
} from './flow';

const flow = defineFlows();

const MENU = '[data-search-input-mode-menu]';
const TILE = `${MENU} [role="menuitemradio"]`;

const isHidden: ElementReader = function isHidden() {
  return 'hidden' in this && this.hidden === true;
};

describe('search scope panel', () => {
  // The panel opens on a double Tab, in the New Tab search box and in the
  // overlay; a click on a scope tags the input with it, and Escape closes
  // the panel only.
  flow('opens on a double Tab on New Tab and in the overlay, tags the input with a clicked scope, and closes alone on Escape', async ({ browser, fixtures }) => {
    const newtab = await browser.openPage(browser.extensionUrl('newtab.html'));
    await focusTab(browser, newtab);
    await newtab.waitFor(`Boolean(document.getElementById('${NEWTAB_INPUT_ID}'))`, { message: 'no search box' });
    await newtab.evaluate(`document.getElementById('${NEWTAB_INPUT_ID}').focus()`);
    await newtab.press('Tab');
    await newtab.press('Tab');
    await newtab.waitFor(`(() => {
      const menu = document.querySelector('${MENU}');
      return Boolean(menu && !menu.hidden && menu.dataset.open === 'true' &&
        menu.querySelectorAll('[role="menuitemradio"]').length > 1);
    })()`, { message: 'double Tab did not open the scope panel' });
    const label = JSON.stringify(await newtab.evaluate(`Array.from(document.querySelectorAll('${TILE}'))
      .find((tile) => tile.getAttribute('aria-checked') !== 'true').getAttribute('aria-label')`));
    const center = await elementCenter(newtab, `Array.from(document.querySelectorAll('${TILE}'))
      .find((tile) => tile.getAttribute('aria-label') === ${label})`);
    await newtab.click(center.x, center.y);
    await newtab.waitFor(`(() => {
      const prefix = document.querySelector('[data-search-input-mode-prefix]');
      return Boolean(prefix && prefix.checkVisibility() && prefix.textContent.includes(${label}));
    })()`, { message: 'the chosen scope did not tag the input' });
    await newtab.press('Escape');
    await newtab.waitFor(`document.querySelector('${MENU}').hidden`, { message: 'Escape did not close the scope panel' });

    const web = await browser.openPage(fixtures.url('/page.html'));
    await focusTab(browser, web);
    await openOverlay(browser, web);
    await web.press('Tab');
    await web.press('Tab');
    await web.waitForShadow(OVERLAY_HOST_ID, TILE, getText, (texts) => texts.length > 1,
      { message: 'double Tab did not open the overlay scope panel' });
    await web.press('Escape');
    await web.waitForShadow(OVERLAY_HOST_ID, MENU, isHidden, (results) => results.length === 1 && results[0] === true,
      { message: 'Escape did not close the overlay scope panel' });
    expect(await web.evaluate(`Boolean(document.getElementById('${OVERLAY_HOST_ID}'))`), 'Escape on the panel closed the overlay').toBe(true);
  });
});
