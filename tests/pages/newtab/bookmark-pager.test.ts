import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { parsePageCss } from '../../fakes/css';
import { getElement, getElements, getTags } from '../../fakes/dom';
import { openDragPage } from './drag-page';

// The bookmarks pager on New Tab: previous / next / bookmark manager buttons
// with the page's own tooltips (no native title), unavailable pages marked
// with aria-disabled so the buttons stay hoverable, and the display mode
// menu after them. In top bar mode the bar holds the manager button and the
// mode menu. The recent sites heading is its mode switch.

const MODE_KEY = '_x_extension_bookmark_view_mode_2026_unique_';
const MODE_MENU_ID = '_x_extension_newtab_bookmark_mode_2026_unique_';
const GRID_ID = '_x_extension_newtab_bookmarks_grid_2024_unique_';
const BAR = Array.from({ length: 30 }, (_, index) => ({ id: String(100 + index), title: `Bookmark ${index}`, url: `https://b${index}.test/` }));

const click = (element: Element) => element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));

describe('the bookmarks pager', () => {
  it('explains each button with the page\'s tooltip and keeps the buttons hoverable', async () => {
    const newtab = await openDragPage({ unplaced: true, bookmarks: BAR });
    const pager = getElement(document, '.x-nt-bookmarks-pager');
    const [prev, next, manager, modeMenu] = Array.from(pager.children);
    const buttons = getTags(pager, ':scope > button', 'button').slice(0, 3);
    expect(buttons).toEqual([prev, next, manager]);
    expect(buttons.map((button) => button.getAttribute('data-tooltip'))).toEqual(['Previous page', 'Next page', 'Open bookmark manager']);
    buttons.forEach((button) => {
      expect(button.hasAttribute('title')).toBe(false);
      expect(button.disabled).toBe(false);
    });
    expect(modeMenu.classList.contains('_x_extension_select_wrap_2024_unique_')).toBe(true);
    expect([prev.getAttribute('aria-disabled'), next.getAttribute('aria-disabled')]).toEqual(['true', 'false']);

    click(next);
    await newtab.advance(200);
    expect(prev.getAttribute('aria-disabled')).toBe('false');

    click(manager);
    await newtab.advance(60);
    expect(newtab.browser.runtime.sendMessage.mock.calls.some((call) => JSON.stringify(call[0]).includes('"openBookmarkManager"'))).toBe(true);
  });

  it('gives way to the recent sites mode switch for their heading', async () => {
    await openDragPage({ unplaced: true, bookmarks: BAR });
    expect(getElement(document, '.x-nt-recent-heading').hidden).toBe(true);
    expect(document.querySelector('.x-nt-recent-header-bar .x-nt-recent-mode-switch')).not.toBeNull();
  });

  it('moves the manager button and mode menu to the top bar, and back when leaving top bar mode', async () => {
    const newtab = await openDragPage({ unplaced: true, bookmarks: BAR, sync: { [MODE_KEY]: 'top' } });
    const actions = getElement(document, '.x-nt-bookmarks-topbar-actions');
    const pager = getElement(document, '.x-nt-bookmarks-pager');
    expect(getElements(actions, '.x-nt-bookmarks-pager-btn').map((button) => button.getAttribute('data-tooltip'))).toEqual(['Open bookmark manager']);
    expect(actions.querySelector(`#${MODE_MENU_ID}`)).not.toBeNull();
    expect(pager.querySelectorAll('.x-nt-bookmarks-pager-btn')).toHaveLength(2);
    expect(document.querySelectorAll(`#${MODE_MENU_ID}`)).toHaveLength(1);
    expect(document.querySelector(`.x-nt-bookmarks-topbar-items #${GRID_ID}`)).not.toBeNull();

    await act(async () => newtab.browser.storage.sync.externalSet({ [MODE_KEY]: 'folder' }));
    await newtab.advance(400);
    expect(actions.children).toHaveLength(0);
    expect(pager.querySelector(`#${MODE_MENU_ID}`)).not.toBeNull();
    expect(document.querySelector(`.x-nt-bookmarks-header + #${GRID_ID}`)).not.toBeNull();
  });
});

describe('the bookmarks pager look', () => {
  const css = parsePageCss('newtab.html');
  const selectors = css.selectors();

  it('styles unavailable buttons as such and skips their hover', () => {
    expect(selectors).toContain('.x-nt-bookmarks-pager-btn:hover:not([aria-disabled="true"])');
    expect(selectors).toContain('.x-nt-bookmarks-pager-btn[aria-disabled="true"]');
  });

  it('lets mode menu icons take the colour around them, on the top bar and over a wallpaper', () => {
    expect(css.rule('.x-nt-bookmarks-topbar .x-nt-section-mode-select ._x_extension_select_trigger_2024_unique_ ._x_extension_select_icon_2024_unique_')?.get('color')).toBe('inherit');
    expect(css.rule('body[data-wallpaper-active="true"] .x-nt-section-mode-select ._x_extension_select_trigger_2024_unique_ ._x_extension_select_icon_2024_unique_')?.get('color')).toBe('inherit');
  });

  it('collapses the recent mode switch to the current mode, at the start of its row', () => {
    expect(css.rule('.x-nt-recent-mode-switch[data-expanded="false"] .x-nt-recent-mode-switch-option[aria-checked="false"]')?.get('width')).toBe('0');
    expect(css.rule('.x-nt-recent-header-bar .x-nt-recent-mode-switch')?.get('margin-left')).not.toBe('auto');
  });
});
