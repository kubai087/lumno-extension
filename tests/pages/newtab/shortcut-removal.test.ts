import { describe, expect, it } from 'vitest';
import { getElement } from '../../fakes/dom';
import { openDragPage, type DragPage } from './drag-page';

// Removing a New Tab shortcut can be undone (⌘Z) and redone (⇧⌘Z), in the
// same history as bookmark moves.

const CONTEXT_MENU = '#_x_extension_newtab_shortcut_context_menu_2026_unique__menu';

async function openNewtab() {
  const newtab = await openDragPage({
    shortcuts: [
      { url: 'https://one.example/', title: 'One' },
      { type: 'folder', folderId: '42', title: 'Folder' },
      { url: 'https://two.example/', title: 'Two' }
    ],
    bookmarks: [{ id: '42', title: 'Folder', children: [{ id: '43', title: 'X', url: 'https://x.example/' }] }]
  });
  return {
    ...newtab,
    async remove(title: string) {
      newtab.tile(title).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20, button: 2 }));
      await newtab.advance(150);
      const option = getElement(document, `${CONTEXT_MENU} [role="menuitem"][data-value="remove"]`);
      option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
      option.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
      await newtab.advance(200);
    }
  };
}

type Newtab = Awaited<ReturnType<typeof openNewtab>> & DragPage;

describe('removing a New Tab shortcut', () => {
  it('can be undone and redone, putting the shortcut back where it was', async () => {
    const newtab: Newtab = await openNewtab();

    await newtab.remove('One');
    expect(newtab.shortcuts()).toEqual(['Folder', 'Two']);
    expect(newtab.toast()).toMatch(/⌘Z/);
    await newtab.undo();
    expect(newtab.shortcuts()).toEqual(['One', 'Folder', 'Two']);
    expect(newtab.toast()).toMatch(/⇧⌘Z/);
    await newtab.redo();
    expect(newtab.shortcuts()).toEqual(['Folder', 'Two']);
    await newtab.undo();
    expect(newtab.shortcuts()).toEqual(['One', 'Folder', 'Two']);
  });

  it('removes and restores a folder shortcut without touching its bookmarks', async () => {
    const newtab = await openNewtab();

    await newtab.remove('Folder');
    await newtab.undo();
    expect(newtab.shortcuts()).toEqual(['One', 'Folder', 'Two']);
    expect(newtab.bookmarks.changes()).toEqual([]);
  });

  it('goes back one removal at a time, and a new removal clears what could be redone', async () => {
    const newtab = await openNewtab();

    await newtab.remove('One');
    await newtab.remove('Two');
    await newtab.undo();
    expect(newtab.shortcuts()).toEqual(['Folder', 'Two']);
    await newtab.undo();
    expect(newtab.shortcuts()).toEqual(['One', 'Folder', 'Two']);
    await newtab.remove('Folder');
    await newtab.redo();
    expect(newtab.shortcuts()).toEqual(['One', 'Two']);
  });

  it('does not happen when it cannot be saved, and leaves nothing to undo', async () => {
    const newtab = await openNewtab();

    newtab.failWrites(true);
    await newtab.remove('One');
    expect(newtab.shortcuts()).toEqual(['One', 'Folder', 'Two']);
    await newtab.undo();
    expect(newtab.shortcuts()).toEqual(['One', 'Folder', 'Two']);
  });

  it('keeps an undo that cannot be saved available to try again', async () => {
    const newtab = await openNewtab();

    await newtab.remove('One');
    newtab.failWrites(true);
    await newtab.undo();
    expect(newtab.shortcuts()).toEqual(['Folder', 'Two']);
    newtab.failWrites(false);
    await newtab.undo();
    expect(newtab.shortcuts()).toEqual(['One', 'Folder', 'Two']);
  });
});
