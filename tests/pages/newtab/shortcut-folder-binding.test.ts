import { describe, expect, it } from 'vitest';
import { buildNodeMap, describe as describeFolder } from '../../../src/domain/bookmark-folder-reference';
import type { BookmarkNode } from '../../../src/domain/bookmark-folder-reference';
import { DEFAULT_MAX_SHORTCUTS } from '../../../src/domain/shortcuts/constants';
import { shortcutFolderBindings } from '../../../src/domain/settings/newtab-shortcuts';
import { loadShortcuts } from '../../../src/platform/shortcut-storage';
import { barOf, folderOf, folderTree } from '../../fakes/bookmark-folder-tree';
import { getElement } from '../../fakes/dom';
import { openDragPage, type DragPage } from './drag-page';

// A shortcut folder synced from another device names its bookmark folder by
// a portable reference; this device binds it to one of its own folders.

async function storedIds(page: DragPage): Promise<string[]> {
  return (await loadShortcuts(page.browser.storage.sync)).map((row) => row.id);
}

function twin(id: string) {
  return { id, title: '灵感', children: [{ id: `${id}-url`, title: 'Design', url: 'https://example.com/design' }] };
}

describe('New Tab shortcut folders', () => {
  it('hides a folder entry this device cannot open and keeps it in place when the visible shortcuts move', async () => {
    const folderRef = describeFolder('42', buildNodeMap(folderTree()));
    const page = await openDragPage({
      shortcuts: [
        { id: 'before', url: 'https://before.example/', title: 'Before' },
        { id: 'entry-a', type: 'folder', title: '灵感', folderRef },
        { id: 'after', url: 'https://after.example/', title: 'After' }
      ],
      bookmarks: [{ id: '200', title: 'Docs', url: 'https://docs.example/' }]
    });
    expect(page.shortcuts()).toEqual(['Before', 'After']);
    expect(await storedIds(page)).toEqual(['before', 'entry-a', 'after']);

    await page.dragTo(page.tile('After'), page.shortcutSlot(0));

    expect(page.shortcuts()).toEqual(['After', 'Before']);
    expect(await storedIds(page)).toEqual(['after', 'before', 'entry-a']);
  });

  it('binds the folder dragged in, even beside an identical sibling, and keeps one entry for a repeat drop', async () => {
    const page = await openDragPage({ shortcuts: [{ id: 'x', url: 'https://x.example/', title: 'X' }], bookmarks: [twin('117'), twin('118')] });

    await page.dragTo(page.card('118'), page.shortcutSlot(0));

    expect(page.toast()).toBe('Folder added to shortcuts');
    const [added] = await loadShortcuts(page.browser.storage.sync);
    expect(added).toHaveProperty('folderRef');
    expect(added).not.toHaveProperty('folderId');
    expect(page.browser.storage.local.values[shortcutFolderBindings.key]).toMatchObject({ [added.id]: { folderId: '118' } });

    await page.dragTo(page.card('118'), page.shortcutSlot(0));
    expect(await storedIds(page)).toEqual([added.id, 'x']);
  });

  describe('with every entry hidden', () => {
    // Folders that exist on another device only.
    const elsewhere = (() => {
      const tree = folderTree('unused');
      const bar = barOf(tree);
      Array.from({ length: DEFAULT_MAX_SHORTCUTS }, (_, index) => {
        const folder: BookmarkNode = { ...folderOf(folderTree(`f${index}`)), title: `f${index}` };
        bar.children?.push(folder);
        return folder;
      });
      return buildNodeMap(tree);
    })();
    const unbound = (count: number) => Array.from({ length: count }, (_, index) => ({
      id: `hidden-${index}`, type: 'folder', title: `f${index}`, folderRef: describeFolder(`f${index}`, elsewhere)
    }));
    const sectionVisible = async (count: number) => {
      await openDragPage({ shortcuts: unbound(count), bookmarks: [] });
      return getElement(document, '.x-nt-shortcuts-section').getAttribute('data-visible');
    };

    it('shows no empty shortcut row at capacity', async () => {
      expect(await sectionVisible(DEFAULT_MAX_SHORTCUTS)).toBe('false');
    });

    it('keeps the add button below capacity', async () => {
      expect(await sectionVisible(2)).toBe('true');
    });
  });
});
