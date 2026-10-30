import { afterEach, describe, expect, it } from 'vitest';
import { bootOverlayPage, settle, type OverlayPage } from './boot';
import { getElement } from '../../fakes/dom';

let page: OverlayPage | null = null;

// The overlay's closing messages are answered while the page still runs.
afterEach(async () => {
  if (page && page.host()) {
    page.toggle();
    await settle(2000);
  }
  page = null;
});

describe('Overlay settings icon', () => {
  it('keeps New Tab’s hover colours out of the overlay', async () => {
    page = await bootOverlayPage();
    const root = await page.open();

    expect(getElement(root, '.x-lumno-search-input__right-icon').getAttribute('style') || '').not.toMatch(/--x-nt-settings-action-hover/);
  });
});
