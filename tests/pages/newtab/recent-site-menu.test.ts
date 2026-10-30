import { describe, expect, it, vi } from 'vitest';
import { hiddenRecentSites } from '../../../src/domain/settings/recent-sites';
import { parsePageCss, readRepoFile } from '../../fakes/css';
import { getElement, getElements } from '../../fakes/dom';
import { openDragPage, type DragPage } from './drag-page';

// Right-clicking a recent site on New Tab opens the shared context menu: open
// in a new tab, add to shortcuts, and (set apart) remove. Nothing changes
// until an item is chosen.

const MENU = '#_x_extension_newtab_recent_context_menu_2026_unique__menu';
const NOW = Date.now();
const HISTORY = Array.from({ length: 4 }, (_, index) => ({
  title: `Site ${index}`, url: `https://site${index}.test/`, lastVisitTime: NOW - index * 1000, visitCount: 5
}));

const cards = () => getElements(document, '#_x_extension_newtab_recent_sites_2024_unique_ .x-nt-recent-card');

async function open() {
  const newtab = await openDragPage({ unplaced: true, recent: HISTORY });
  const writes = [vi.spyOn(newtab.browser.storage.sync, 'set'), vi.spyOn(newtab.browser.storage.local, 'set')];
  const written = () => writes.flatMap((spy) => spy.mock.calls.map((call) => call[0]));
  return { newtab, written };
}

async function openMenu(newtab: DragPage, card: Element): Promise<HTMLElement> {
  card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10, button: 2 }));
  await newtab.advance(80);
  return getElement(document, MENU);
}

async function choose(newtab: DragPage, value: string): Promise<void> {
  const option = getElement(document, `${MENU} [role="menuitem"][data-value="${value}"]`);
  option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
  option.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  await newtab.advance(120);
}

const optionStates = (menu: Element) =>
  getElements(menu, '[role="menuitem"]').map((option) => [option.getAttribute('data-value'), option.getAttribute('aria-disabled') === 'true']);

describe('a recent site\'s context menu', () => {
  it('opens with Remove last, changing nothing until an item is chosen', async () => {
    const { newtab, written } = await open();
    const [first] = cards();
    expect(first.getAttribute('aria-label')).toBe('Open Site 0');
    const menu = await openMenu(newtab, first);
    expect(menu.getAttribute('data-open')).toBe('true');
    expect(optionStates(menu).map(([value]) => value)).toEqual(['open-in-new-tab', 'add-shortcut', 'track-progress', 'remove']);
    expect(first.getAttribute('data-recent-context-menu-open')).toBe('true');
    expect(cards()).toHaveLength(4);
    expect(written().filter((items) => Object.hasOwn(items, hiddenRecentSites.key))).toHaveLength(0);
  });

  it('opens the site in a new tab', async () => {
    const { newtab } = await open();
    await openMenu(newtab, cards()[0]);
    await choose(newtab, 'open-in-new-tab');
    const opened = [
      ...newtab.browser.tabs.create.mock.calls.map((call) => call[0]),
      ...newtab.browser.runtime.sendMessage.mock.calls.map((call) => call[0])
    ];
    expect(JSON.stringify(opened)).toContain('https://site0.test/');
  });

  it('removes the site from the list and remembers it as hidden', async () => {
    const { newtab, written } = await open();
    await openMenu(newtab, cards()[1]);
    await choose(newtab, 'remove');
    expect(cards().map((card) => card.getAttribute('aria-label'))).toEqual(['Open Site 0', 'Open Site 2', 'Open Site 3']);
    expect(written().filter((items) => Object.hasOwn(items, hiddenRecentSites.key))).toHaveLength(1);
  });

  it('adds the site to the shortcuts, and does not offer it again', async () => {
    const { newtab, written } = await open();
    await openMenu(newtab, cards()[0]);
    await choose(newtab, 'add-shortcut');
    expect(written().some((items) => JSON.stringify(items).includes('site0.test'))).toBe(true);
    const menu = await openMenu(newtab, cards()[0]);
    expect(optionStates(menu).find(([value]) => value === 'add-shortcut')).toEqual(['add-shortcut', true]);
  });
});

describe('the recent site menu look and copy', () => {
  it('keeps the card under an open menu visibly active, and has no old dismiss button', () => {
    const selectors = parsePageCss('newtab.html').selectors();
    expect(selectors.some((selector) => selector.includes('[data-recent-context-menu-open="true"]'))).toBe(true);
    expect(selectors.some((selector) => selector.includes('.x-nt-recent-dismiss'))).toBe(false);
  });

  it('has the menu messages in every language checked', () => {
    ['en', 'zh_CN', 'zh_TW', 'ja'].forEach((locale) => {
      const messages: Record<string, { message?: string }> = JSON.parse(readRepoFile(`_locales/${locale}/messages.json`));
      ['newtab_open_in_new_tab', 'recent_context_menu_label', 'recent_add_to_shortcuts', 'newtab_shortcuts_already_added']
        .forEach((key) => expect(String(messages[key]?.message || '').trim(), `${locale} ${key}`).not.toBe(''));
    });
  });
});
