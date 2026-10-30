import { describe, expect, it } from 'vitest';
import { parsePageCss, readRepoFile } from '../../fakes/css';

// New Tab's bookmark menus as the stylesheets ship them, and their copy.

const css = parsePageCss('newtab.html');
const selectors = css.selectors();

// A layer value: a number, or calc(number + number) once tokens resolve.
function layer(value: string | null | undefined): number {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  const sum = text.match(/^calc\((-?\d+) \+ (\d+)\)$/);
  return sum ? Number(sum[1]) + Number(sum[2]) : Number.parseInt(text, 10);
}

describe('the bookmark menu look', () => {
  it('sizes folder icons in menus like the cards, with the open layer hidden at first', () => {
    expect(selectors.some((selector) => selector.startsWith('.x-nt-bookmark-cascade-icon--folder svg'))).toBe(true);
    expect(selectors.some((selector) => selector.startsWith('.x-nt-bookmark-cascade-icon--folder .x-nt-folder-shape--hover'))).toBe(true);
  });

  it('keeps favicon corners compact and rows still on hover', () => {
    expect(css.rule('.x-nt-bookmark-cascade-icon')?.get('border-radius')).toBe('4px');
    expect(css.entries.filter((entry) => entry.selectors.some((selector) => selector.includes('.x-nt-bookmark-cascade-item')) &&
      /translateY/.test(entry.style.getPropertyValue('transform')))).toEqual([]);
  });

  it('fades row text while the hover background appears at once, and suppresses hover inside a safe triangle', () => {
    expect(css.rule('.x-nt-bookmark-cascade-item')?.get('transition')).toBe('color 120ms ease');
    expect(selectors.some((selector) => selector.startsWith('.x-nt-bookmark-cascade-item[data-hover-suppressed="true"]:hover'))).toBe(true);
  });

  it('draws the bookmark cursor tooltip above the menus', () => {
    expect(layer(css.rule('.x-nt-bookmark-cursor-tooltip')?.get('--x-extension-tooltip-z-index')))
      .toBeGreaterThan(layer(css.rule('.x-nt-bookmark-cascade-menu')?.get('z-index')));
  });

  it('marks keyboard focus with the selected row background, not an outline', () => {
    expect(css.entries.some((entry) => entry.selectors.includes('.x-nt-bookmark-cascade-item:focus-visible') &&
      /^2px solid/.test(entry.style.getPropertyValue('outline')))).toBe(false);
  });

  it('keeps the item under an open context menu visibly active', () => {
    expect(selectors.some((selector) => selector.includes('[data-bookmark-context-menu-open="true"]'))).toBe(true);
  });

  it('has the menu and delete messages in every language checked', () => {
    ['en', 'zh_CN', 'zh_TW', 'ja'].forEach((locale) => {
      const messages: Record<string, { message?: string }> = JSON.parse(readRepoFile(`_locales/${locale}/messages.json`));
      [
        'bookmarks_delete', 'newtab_open_in_new_tab', 'bookmarks_open_in_new_tab_group', 'bookmarks_open_group_confirm_title',
        'bookmarks_open_group_confirm_description', 'bookmarks_open_group_confirm_button', 'bookmarks_open_group_partial_failed',
        'bookmarks_open_group_failed', 'bookmarks_context_menu_label', 'bookmarks_delete_undone', 'bookmarks_delete_redone',
        'bookmarks_delete_failed'
      ].forEach((key) => expect(messages[key]?.message, `${locale} ${key}`).toBeTruthy());
    });
  });
});
