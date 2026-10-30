import { describe, expect, it } from 'vitest';
import { getElement, getElementById, getElements, getTag, getTags } from '../../fakes/dom';
import { openDragPage, type DragPage } from './drag-page';

// A shortcut's context menu and editor on New Tab: the folder icon that opens
// under the menu, the editor built when first needed and reused, and the add
// tile asking what to add.

const CONTEXT_MENU = '#_x_extension_newtab_shortcut_context_menu_2026_unique__menu';
const BACKDROP = '.x-nt-shortcut-dialog-backdrop';
const SEARCH_INPUT_ID = '_x_extension_newtab_search_input_2024_unique_';

function click(element: Element): void {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
}

function press(element: Element): void {
  element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
  click(element);
}

// Runs the page until `check` holds. The editor's module loads on first use,
// which takes real time as well as the page's timers.
async function until(newtab: DragPage, check: () => boolean, message: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (check()) return;
    await new Promise((resolve) => setImmediate(resolve));
    await newtab.advance(20);
  }
  throw new Error(message);
}

async function openMenu(newtab: DragPage, title: string): Promise<void> {
  newtab.tile(title).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20, button: 2 }));
  await newtab.advance(120);
}

// Types into a React-controlled input the way typing does: past the value
// React tracks on the element.
function type(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('a folder shortcut under its context menu', () => {
  async function openFolders() {
    const newtab = await openDragPage({
      shortcuts: [
        { type: 'folder', folderId: '10', title: 'Docs' },
        { type: 'folder', folderId: '20', title: 'Tools' },
        { url: 'https://site.example/', title: 'Site' }
      ],
      bookmarks: [
        { id: '10', title: 'Docs', children: [{ id: '11', title: 'A', url: 'https://a.example/' }] },
        { id: '20', title: 'Tools', children: [{ id: '21', title: 'B', url: 'https://b.example/' }] }
      ]
    });
    // Whether the tile shows its menu open, and its folder icon open.
    const state = (title: string) => [
      newtab.tile(title).hasAttribute('data-shortcut-context-menu-open'),
      newtab.tile(title).hasAttribute('data-shortcut-folder-open')
    ];
    return { newtab, state };
  }

  it('opens its icon, and releases it when the menu moves to another shortcut', async () => {
    const { newtab, state } = await openFolders();

    await openMenu(newtab, 'Docs');
    expect(state('Docs')).toEqual([true, true]);
    expect(state('Tools')).toEqual([false, false]);
    await openMenu(newtab, 'Tools');
    expect(state('Docs')).toEqual([false, false]);
    expect(state('Tools')).toEqual([true, true]);
    await openMenu(newtab, 'Site');
    expect(state('Tools')).toEqual([false, false]);
    // A website shortcut has no folder icon to open.
    expect(state('Site')).toEqual([true, false]);
  });

  it.each([
    ['a click outside', () => document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 600, clientY: 600 }))],
    ['Escape', () => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))],
    ['focus moving away', () => getElementById(SEARCH_INPUT_ID).dispatchEvent(new FocusEvent('focusin', { bubbles: true }))]
  ])('stays open while the menu is used and closes with the menu on %s', async (_how, dismiss) => {
    const { newtab, state } = await openFolders();

    await openMenu(newtab, 'Docs');
    const option = getElement(document, `${CONTEXT_MENU} [role="menuitem"]`);
    option.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    option.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await newtab.advance(40);
    expect(state('Docs')).toEqual([true, true]);
    dismiss();
    await newtab.advance(120);
    expect(state('Docs')).toEqual([false, false]);
  });
});

describe('the shortcut editor', () => {
  it('is built only when first needed, shared by quick opens and reused', async () => {
    const newtab = await openDragPage({ shortcuts: [{ url: 'https://one.example/', title: 'One' }, { url: 'https://two.example/', title: 'Two' }] });
    const chooseEdit = () => press(getElement(document, `${CONTEXT_MENU} [role="menuitem"][data-value="edit"]`));
    const titleField = () => getTag(document, `${BACKDROP} input._x_extension_shortcut_input_2024_unique_`, 'input');
    expect(document.querySelectorAll(BACKDROP)).toHaveLength(0);

    // Ask for the editor, then straight away for another shortcut.
    click(getElement(document, '.x-nt-shortcut-tile--add'));
    newtab.tile('Two').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20, button: 2 }));
    await newtab.advance(150);
    chooseEdit();
    await until(newtab, () => document.querySelector(BACKDROP) !== null, 'The editor did not open');
    await newtab.advance(400);
    expect(document.querySelectorAll(BACKDROP)).toHaveLength(1);
    // It shows what was asked for last.
    expect(titleField().value).toBe('Two');

    titleField().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await newtab.advance(200);
    await openMenu(newtab, 'One');
    await newtab.advance(30);
    chooseEdit();
    await newtab.advance(300);
    expect(document.querySelectorAll(BACKDROP)).toHaveLength(1);
    expect(titleField().value).toBe('One');
  });

  it('adds a site from the add tile, opening from the side of the tile with the Settings fields and Lumno buttons', async () => {
    const newtab = await openDragPage({ shortcuts: [{ url: 'https://one.example/', title: 'One' }] });
    click(getElement(document, '.x-nt-shortcut-tile--add'));
    await newtab.advance(150);
    press(getElement(document, `${CONTEXT_MENU} [data-value="shortcut-add"]`));
    await until(newtab, () => document.querySelector(BACKDROP) !== null, 'The editor did not open');
    await newtab.advance(400);
    const backdrop = getElement(document, BACKDROP);
    const dialog = getElement(backdrop, '.x-nt-shortcut-dialog');

    expect(backdrop.getAttribute('data-open')).toBe('true');
    expect(dialog.style.getPropertyValue('--x-nt-shortcut-dialog-enter-x')).not.toBe('');
    const [name, url] = getTags(dialog, 'input._x_extension_shortcut_input_2024_unique_', 'input');
    expect(url.closest('._x_extension_shortcut_input_affix_2026_unique_[data-has-prefix="false"]')).not.toBeNull();
    const buttons = getElements(dialog, 'button.x-lumno-action-button');
    expect(buttons.some((button) => button.classList.contains('x-lumno-action-button--primary'))).toBe(true);
    expect(buttons.some((button) => button.classList.contains('x-lumno-action-button--secondary'))).toBe(true);

    type(name, 'Docs');
    type(url, 'docs.example');
    getElement(dialog, 'form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await until(newtab, () => newtab.shortcuts().includes('Docs'), 'The shortcut was not added');
    expect(newtab.toast()).toMatch(/Shortcut added/);
  });
});

describe('the add tile', () => {
  it('has no right-click menu, and a click asks whether to add a site or a group in the shared menu', async () => {
    const newtab = await openDragPage({ shortcuts: [{ url: 'https://one.example/', title: 'One' }] });
    const add = getElement(document, '.x-nt-shortcut-tile--add');

    add.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: 600, clientY: 430 }));
    await newtab.advance(100);
    expect(document.querySelectorAll('[role="menu"][data-open="true"]')).toHaveLength(0);
    click(add);
    await newtab.advance(150);
    const menu = getElement(document, CONTEXT_MENU);
    expect(getElements(menu, '[role="menuitem"]').map((option) => option.getAttribute('data-value'))).toEqual(['shortcut-add', 'group-create']);
    expect(menu.classList.contains('_x_extension_select_menu_2024_unique_')).toBe(true);
  });
});
