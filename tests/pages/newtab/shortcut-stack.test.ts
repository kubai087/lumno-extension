import { describe, expect, it, vi } from 'vitest';
import { getElement, required } from '../../fakes/dom';
import type { BookmarkInput, FakeBookmarkNode } from '../../fakes/bookmarks';
import { openDragPage } from './drag-page';

// Dropping one website shortcut onto the middle of another stacks them into a
// new bookmarks-bar folder, shown as a folder shortcut, with undo (⌘Z) and
// redo (⇧⌘Z). The drags run through New Tab's pointer handling.

const site = (id: string) => ({ url: `https://${id}.example/`, title: id[0].toUpperCase() + id.slice(1) });

async function openNewtab(options: { shortcuts?: object[]; bookmarks?: BookmarkInput[] } = {}) {
  const newtab = await openDragPage({
    shortcuts: options.shortcuts || [site('one'), site('two'), site('three')],
    bookmarks: [{ id: '50', title: 'Existing', url: 'https://existing.example/' }, ...(options.bookmarks || [])]
  });
  const barNodes = (): FakeBookmarkNode[] => required(newtab.bookmarks.find('1'), 'the bookmarks bar').children || [];
  return {
    ...newtab,
    barNodes,
    folder: () => barNodes().find((node) => !node.url) || null,
    // Drags `source` to `fraction` across `target`'s box and releases.
    async drop(source: string, target: string, fraction = 0.5) {
      const box = newtab.tile(target).getBoundingClientRect();
      await newtab.drag(newtab.tile(source), [[box.left + box.width * fraction, box.top + box.height / 2]]);
      await newtab.advance(200);
    }
  };
}

describe('stacking shortcuts', () => {
  it('keeps reordering on the outer quarter of a tile', async () => {
    const newtab = await openNewtab();
    await newtab.drop('Three', 'Two', 0.1);

    expect(newtab.folder()).toBeNull();
    expect(newtab.shortcuts()).toHaveLength(3);
  });

  it('does not stack a folder shortcut; a folder tile takes a site in instead', async () => {
    const newtab = await openNewtab({
      shortcuts: [{ type: 'folder', folderId: '60', title: 'Docs' }, site('two'), site('three')],
      bookmarks: [{ id: '60', title: 'Docs', children: [] }]
    });

    await newtab.drop('Docs', 'Two');
    expect(newtab.barNodes().filter((node) => !node.url)).toHaveLength(1);
    await newtab.drop('Three', 'Docs');
    expect(newtab.barNodes().filter((node) => !node.url).map((node) => node.title)).toEqual(['Docs']);
    expect((newtab.bookmarks.find('60')?.children || []).some((node) => node.url === 'https://three.example/')).toBe(true);
  });

  it('stacks two sites into a new folder at the end of the bookmarks bar, in the target\'s place', async () => {
    const newtab = await openNewtab();
    await newtab.drop('Three', 'Two');
    const created = required(newtab.folder(), 'the stacked folder');

    expect([created.title, created.parentId, created.index]).toEqual(['New folder', '1', 1]);
    // The site dropped onto comes first.
    expect((created.children || []).map((node) => node.url)).toEqual(['https://two.example/', 'https://three.example/']);
    expect(newtab.shortcuts()).toEqual(['One', 'New folder']);
    expect(newtab.toast()).toMatch(/^Folder created · ⌘Z to undo$/);
  });

  it('undoes and redoes the stack, again and again', async () => {
    const newtab = await openNewtab();
    await newtab.drop('Three', 'Two');

    for (let cycle = 0; cycle < 3; cycle += 1) {
      await newtab.undo();
      expect(newtab.shortcuts()).toEqual(['One', 'Two', 'Three']);
      expect(newtab.bar()).toEqual(['Existing']);
      await newtab.redo();
      expect(newtab.shortcuts()).toEqual(['One', 'New folder']);
      expect((newtab.folder()?.children || []).map((node) => node.title)).toEqual(['Two', 'Three']);
    }
  });

  it('redoes the folder under the name and at the place it was left', async () => {
    const newtab = await openNewtab();
    await newtab.drop('One', 'Three');
    const folder = required(newtab.folder(), 'the stacked folder');
    await newtab.bookmarks.api.update(folder.id, { title: 'Reading' });
    await newtab.bookmarks.api.move(folder.id, { parentId: '1', index: 0 });
    await newtab.advance(150);

    await newtab.undo();
    await newtab.redo();
    expect([newtab.folder()?.title, newtab.folder()?.index]).toEqual(['Reading', 0]);
  });

  it('never deletes bookmarks added to the folder later when undone', async () => {
    const newtab = await openNewtab();
    await newtab.drop('Three', 'Two');
    await newtab.bookmarks.api.create({ parentId: required(newtab.folder(), 'the stacked folder').id, title: 'Later', url: 'https://later.example/' });
    await newtab.advance(150);

    await newtab.undo();
    expect(newtab.folder()?.children).toHaveLength(3);
    expect(newtab.shortcuts()).toEqual(['One', 'New folder']);
  });

  it.each([
    ['the folder cannot be made', 1],
    ['a site cannot go into the folder', 3]
  ])('leaves the shortcuts as they were, with no folder and nothing to undo, when %s', async (_name, failingCall) => {
    const newtab = await openNewtab();
    const create = newtab.bookmarks.api.create;
    let calls = 0;
    vi.spyOn(newtab.bookmarks.api, 'create').mockImplementation((details, callback) => {
      calls += 1;
      if (calls === failingCall) newtab.bookmarks.fail('create');
      return create(details, callback);
    });
    await newtab.drop('Three', 'Two');

    expect(newtab.shortcuts()).toEqual(['One', 'Two', 'Three']);
    expect(newtab.folder()).toBeNull();
    await newtab.undo();
    expect(newtab.shortcuts()).toEqual(['One', 'Two', 'Three']);
  });

  it('keeps the stack when undo cannot remove the folder, and can try again', async () => {
    const newtab = await openNewtab();
    await newtab.drop('Three', 'Two');
    newtab.bookmarks.fail('remove');

    await newtab.undo();
    expect(newtab.shortcuts()).toEqual(['One', 'New folder']);
    expect(newtab.folder()).not.toBeNull();
    await newtab.undo();
    expect(newtab.shortcuts()).toEqual(['One', 'Two', 'Three']);
  });

  it('leaves a plain click on a folder tile to open its menu', async () => {
    const newtab = await openNewtab({
      shortcuts: [{ type: 'folder', folderId: '60', title: 'Docs' }, site('two')],
      bookmarks: [{ id: '60', title: 'Docs', children: [{ id: '61', title: 'A', url: 'https://a.example/' }] }]
    });
    const tile = getElement(document, '.x-nt-shortcut-tile--folder');
    const box = tile.getBoundingClientRect();
    const [x, y] = [box.left + 20, box.top + 20];
    newtab.pointer('pointerdown', x, y);
    newtab.pointer('pointerup', x, y);
    tile.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y }));
    await newtab.advance(200);

    expect(document.querySelector('.x-nt-bookmark-cascade-level[data-open="true"]')).not.toBeNull();
  });
});
