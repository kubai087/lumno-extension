import { describe, expect, it } from 'vitest';
import { shortcutFolderItemIcons } from '../../../src/domain/settings/newtab-shortcuts';
import { expectElement, getElement, getElements, getTag } from '../../fakes/dom';
import { openDragPage, type DragPage } from './drag-page';

// On New Tab: a website inside a bookmark folder opened from a shortcut can
// be given its own icon in the edit dialog, which the folder's menu then
// shows instead of the site's favicon.

const KEY = shortcutFolderItemIcons.key;
const BACKDROP = '.x-nt-shortcut-dialog-backdrop';
const BOOKMARK_MENU = '#_x_extension_newtab_bookmark_context_menu_2026_unique__menu';
const png = (text: string) => `data:image/png;base64,${Buffer.from(text).toString('base64')}`;

function click(element: Element): void {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
}

function press(element: Element): void {
  element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
  click(element);
}

// Runs the page until `check` holds; the editor's module loads on first use.
async function until(newtab: DragPage, check: () => boolean, message: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (check()) return;
    await new Promise((resolve) => setImmediate(resolve));
    await newtab.advance(20);
  }
  throw new Error(message);
}

async function openFolderPage(savedIcons: Record<string, unknown>) {
  const newtab = await openDragPage({
    shortcuts: [{ type: 'folder', folderId: '10', title: 'Docs' }],
    bookmarks: [{ id: '10', title: 'Docs', children: [
      { id: '11', title: 'MDN', url: 'https://developer.mozilla.org/' },
      { id: '12', title: 'Sub', children: [] }
    ] }],
    local: { [KEY]: savedIcons }
  });
  const dialog = () => getElement(document, BACKDROP);
  const openFolder = async () => {
    if (!document.querySelector('.x-nt-bookmark-cascade-item')) {
      click(getElement(document, '.x-nt-shortcut-tile--folder'));
      await newtab.advance(200);
    }
    return getElements(document, '.x-nt-bookmark-cascade-item');
  };
  return {
    ...newtab,
    openFolder,
    dialog,
    saved: () => new Map<string, unknown>(Object.entries(Object(newtab.browser.storage.local.values[KEY]))),
    async edit(index: number) {
      const item = (await openFolder())[index];
      item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20, button: 2 }));
      await newtab.advance(150);
      press(getElement(document, `${BOOKMARK_MENU} [data-value="edit"]`));
      await until(newtab, () => document.querySelector(BACKDROP) !== null, 'The editor did not open');
      await newtab.advance(400);
      return dialog();
    },
    async pickIconSource(value: string) {
      const trigger = getElement(dialog(), '.x-nt-shortcut-icon-source-select ._x_extension_select_trigger_2024_unique_');
      click(trigger);
      await newtab.advance(60);
      const menu = document.getElementById(String(trigger.getAttribute('aria-controls')).replace(/_listbox$/, '_menu')) ||
        document.querySelector('[role="listbox"][data-open="true"], [data-open="true"][role="menu"]');
      press(getElement(expectElement(menu, 'the icon source menu'), `[role="option"][data-value="${value}"]`));
      await newtab.advance(60);
    },
    async setUrl(url: string) {
      const input = getTag(dialog(), '#_x_extension_newtab_shortcut_dialog_2026_unique__url', 'input');
      // React tracks its inputs' values; set it the way typing does.
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, url);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await newtab.advance(30);
    },
    async save() {
      const submits = getElements(dialog(), 'button[type="submit"]');
      click(submits[submits.length - 1]);
      await newtab.advance(300);
    }
  };
}

describe('icons for websites in a shortcut folder', () => {
  it('shows the chosen icon in the folder menu and keeps an unchanged choice with its image', async () => {
    const mine = png('mine');
    const folder = await openFolderPage({ 11: { iconSource: 'custom', dataUrl: mine } });
    const [site] = await folder.openFolder();
    expect(getTag(site, 'img', 'img').src).toBe(mine);

    const dialog = await folder.edit(0);
    expect(dialog.querySelector('.x-nt-shortcut-icon-field')).not.toBeNull();
    expect(getTag(dialog, '.x-nt-shortcut-icon-source-select select', 'select').value).toBe('custom');
    await folder.save();
    expect(folder.saved().get('11')).toEqual({ iconSource: 'custom', dataUrl: mine });
  });

  it('saves the built-in icon when it is chosen', async () => {
    const folder = await openFolderPage({ 11: { iconSource: 'custom', dataUrl: png('mine') } });
    await folder.edit(0);
    await folder.pickIconSource('builtin');
    await folder.save();

    expect(folder.saved().get('11')).toEqual({ iconSource: 'builtin' });
  });

  it('lets a subfolder be edited, without an icon editor', async () => {
    const folder = await openFolderPage({});
    const dialog = await folder.edit(1);

    expect(dialog.querySelector('.x-nt-shortcut-icon-field')).toBeNull();
  });

  it('drops an image fetched for the old address when the website gets a new one', async () => {
    const moved = await openFolderPage({ 11: { iconSource: 'service', dataUrl: png('old') } });
    await moved.edit(0);
    await moved.setUrl('https://moved.example/');
    await moved.save();

    expect(moved.bookmarks.calls.some((call) => call.name === 'update' &&
      typeof call.args[1] === 'object' && call.args[1] !== null && 'url' in call.args[1] && call.args[1].url === 'https://moved.example/')).toBe(true);
    expect(moved.saved().has('11')).toBe(false);
  });
});
