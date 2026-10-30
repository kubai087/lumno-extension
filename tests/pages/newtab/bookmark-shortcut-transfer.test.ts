import { describe, expect, it, vi } from 'vitest';
import { loadShortcuts } from '../../../src/platform/shortcut-storage';
import { isShortcutFolder } from '../../../src/domain/shortcuts/normalize';
import { required } from '../../fakes/dom';
import { openDragPage, type DragPage, type DragPageOptions } from './drag-page';

// Dragging between New Tab's bookmarks, shortcuts and recent sites, and the
// undo (⌘Z) / redo (⇧⌘Z) history those drags share. With a WebDAV backup
// covering the shortcuts, a bookmark dragged to the shortcuts moves there;
// without one it is copied.

const FOLDER_ITEM_ICONS_KEY = '_x_extension_shortcut_folder_item_icons_2026_unique_';
const SHORTCUT_ICONS_KEY = '_x_extension_newtab_shortcut_icons_2026_unique_';
const SHORTCUTS = [{ url: 'https://one.example/', title: 'One' }, { url: 'https://two.example/', title: 'Two' }];
const BOOKMARKS = [
  { id: '20', title: 'Start', url: 'https://start.example/' },
  { id: 'link', title: 'Link', url: 'https://link.example/' },
  { id: 'folder', title: 'Folder', children: [{ id: 'child', title: 'Child', url: 'https://child.example/' }] }
];
const ICON = 'data:image/png;base64,iVBORw0KGgo=';

function open(options: DragPageOptions = {}): Promise<DragPage> {
  return openDragPage({ shortcuts: SHORTCUTS, bookmarks: BOOKMARKS, ...options });
}

const state = (newtab: DragPage) => [newtab.shortcuts(), newtab.bar()];

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? Object.fromEntries(Object.entries(value)) : {};
}

async function storedShortcut(newtab: DragPage, title: string) {
  const loading = loadShortcuts(newtab.browser.storage.sync);
  await newtab.advance(0);
  const found = required((await loading).find((item) => item.title === title), `the shortcut ${title}`);
  if (isShortcutFolder(found)) throw new Error(`Expected ${title} to be a website shortcut.`);
  return found;
}

describe('a bookmark dragged to the shortcuts', () => {
  it('moves there with a backup, silently, and undo and redo replay it', async () => {
    const newtab = await open({ webdavBackup: true });
    await newtab.dragTo(newtab.card('link'), newtab.shortcutSlot(1));
    expect(state(newtab)).toEqual([['One', 'Link', 'Two'], ['Start', 'Folder']]);
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await newtab.undo();
      expect(state(newtab)).toEqual([['One', 'Two'], ['Start', 'Link', 'Folder']]);
      await newtab.redo();
      expect(state(newtab)).toEqual([['One', 'Link', 'Two'], ['Start', 'Folder']]);
    }
    expect(newtab.toast()).toBe('');
  });

  it('is copied without a backup, leaving the bookmarks untouched through undo and redo', async () => {
    const newtab = await open();
    await newtab.dragTo(newtab.card('link'), newtab.shortcutSlot(1));
    expect(state(newtab)).toEqual([['One', 'Link', 'Two'], ['Start', 'Link', 'Folder']]);
    expect(newtab.toast()).toBe('Shortcut added');
    expect(newtab.bookmarks.changes()).toEqual([]);
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await newtab.undo();
      expect(state(newtab)).toEqual([['One', 'Two'], ['Start', 'Link', 'Folder']]);
      await newtab.redo();
      expect(newtab.shortcuts()).toEqual(['One', 'Link', 'Two']);
    }
    expect(newtab.bookmarks.changes()).toEqual([]);
  });

  it('moves the shortcut that has its website already rather than adding another', async () => {
    const newtab = await open({
      webdavBackup: true,
      bookmarks: [{ id: '20', title: 'Start', url: 'https://start.example/' }, { id: 'dup', title: 'One again', url: 'https://one.example/' }]
    });
    await newtab.dragTo(newtab.card('dup'), newtab.shortcutSlot(2));
    expect(newtab.shortcuts()).toEqual(['Two', 'One']);
    await newtab.undo();
    expect(state(newtab)).toEqual([['One', 'Two'], ['Start', 'One again']]);
  });
});

describe('a shortcut dragged to the bookmarks', () => {
  it('becomes a bookmark where it lands, silently, and undo brings the shortcut back', async () => {
    const newtab = await open();
    await newtab.dragTo(newtab.tile('One'), newtab.bookmarkSlot(1));
    expect(state(newtab)).toEqual([['Two'], ['Start', 'One', 'Link', 'Folder']]);
    expect(newtab.toast()).toBe('');
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await newtab.undo();
      expect(state(newtab)).toEqual([['One', 'Two'], ['Start', 'Link', 'Folder']]);
      await newtab.redo();
      expect(state(newtab)).toEqual([['Two'], ['Start', 'One', 'Link', 'Folder']]);
    }
  });
});

describe('folders between the bookmarks and the shortcuts', () => {
  it('become a folder shortcut, and move back whole without recreating anything', async () => {
    const newtab = await open();
    await newtab.dragTo(newtab.card('folder'), newtab.shortcutSlot(2));
    expect(state(newtab)).toEqual([['One', 'Two', 'Folder'], ['Start', 'Link', 'Folder']]);
    expect(newtab.toast()).toMatch(/Folder added to shortcuts/);
    expect(newtab.bookmarks.changes()).toEqual([]);
    await newtab.undo();
    expect(newtab.shortcuts()).toEqual(['One', 'Two']);
    await newtab.redo();

    newtab.bookmarks.calls.length = 0;
    await newtab.dragTo(newtab.tile('Folder'), newtab.bookmarkSlot(0));
    expect(newtab.bar()).toEqual(['Folder', 'Start', 'Link']);
    expect(newtab.bookmarks.titles('folder')).toEqual(['Child']);
    expect(newtab.bookmarks.changes()).toEqual(['move']);
    await newtab.undo();
    expect([newtab.bar(), newtab.shortcuts()]).toEqual([['Start', 'Link', 'Folder'], ['One', 'Two', 'Folder']]);
  });
});

describe('a site of a shortcut folder', () => {
  // The folder shortcut here holds the bookmarks bar, whose sites the grid
  // shows; a shortcut for the bar itself draws no tile.
  it('moves out of the folder to the row with its icon, and back with it', async () => {
    const newtab = await open({
      shortcuts: [...SHORTCUTS, { type: 'folder', folderId: '1', title: 'Bar' }],
      local: { [FOLDER_ITEM_ICONS_KEY]: { link: { iconSource: 'custom', dataUrl: ICON } } }
    });
    const local = newtab.browser.storage.local.values;
    const shortcutIcons = () => record(local[SHORTCUT_ICONS_KEY]);
    const folderIcon = (title: string) => {
      const node = newtab.bookmarks.find('1')?.children?.find((item) => item.title === title);
      return node ? record(local[FOLDER_ITEM_ICONS_KEY])[node.id] : undefined;
    };

    await newtab.dragTo(newtab.card('link'), newtab.shortcutSlot(1));
    expect(state(newtab)).toEqual([['One', 'Link', 'Two'], ['Start', 'Folder']]);
    const shortcut = await storedShortcut(newtab, 'Link');
    expect(shortcut.iconSource).toBe('custom');
    expect(shortcutIcons()[shortcut.id]).toBe(ICON);

    await newtab.undo();
    expect(state(newtab)).toEqual([['One', 'Two'], ['Start', 'Link', 'Folder']]);
    expect(folderIcon('Link')).toEqual({ iconSource: 'custom', dataUrl: ICON });

    await newtab.redo();
    expect(shortcutIcons()[shortcut.id]).toBe(ICON);

    await newtab.dragTo(newtab.tile('Link'), newtab.bookmarkSlot(1));
    expect(state(newtab)).toEqual([['One', 'Two'], ['Start', 'Link', 'Folder']]);
    expect(folderIcon('Link')).toEqual({ iconSource: 'custom', dataUrl: ICON });
  });

  it('brings back the icon source and plate a shortcut had before its trip into the folder', async () => {
    const newtab = await open({
      shortcuts: [
        { url: 'https://one.example/', title: 'One', iconSource: 'service', iconPlate: 'on', iconPlateColor: '#FFE4A0' },
        { url: 'https://two.example/', title: 'Two' },
        { type: 'folder', folderId: '1', title: 'Bar' }
      ]
    });
    await newtab.dragTo(newtab.tile('One'), newtab.bookmarkSlot(1));
    expect(state(newtab)).toEqual([['Two'], ['Start', 'One', 'Link', 'Folder']]);
    const moved = required(newtab.bookmarks.find('1')?.children?.[1], 'the moved bookmark');
    await newtab.dragTo(newtab.card(moved.id), newtab.shortcutSlot(0));
    expect(state(newtab)).toEqual([['One', 'Two'], ['Start', 'Link', 'Folder']]);
    const one = await storedShortcut(newtab, 'One');
    expect([one.iconSource, one.iconPlate, one.iconPlateColor]).toEqual(['service', 'on', '#FFE4A0']);
  });
});

describe('failures during a transfer', () => {
  it('keeps the shortcut when its bookmark cannot be created, leaving nothing to undo', async () => {
    const newtab = await open();
    newtab.bookmarks.fail('create');
    await newtab.dragTo(newtab.tile('One'), newtab.bookmarkSlot(1));
    expect(state(newtab)).toEqual([['One', 'Two'], ['Start', 'Link', 'Folder']]);
    await newtab.undo();
    expect(newtab.shortcuts()).toEqual(['One', 'Two']);
  });

  it('keeps the bookmark where it was when the shortcuts cannot be saved', async () => {
    const newtab = await open({ webdavBackup: true });
    newtab.failWrites(true);
    await newtab.dragTo(newtab.card('link'), newtab.shortcutSlot(1));
    newtab.failWrites(false);
    expect(state(newtab)).toEqual([['One', 'Two'], ['Start', 'Link', 'Folder']]);
  });

  it('changes nothing on an undo whose bookmark cannot be removed, and lets it be tried again', async () => {
    const newtab = await open();
    await newtab.dragTo(newtab.tile('One'), newtab.bookmarkSlot(1));
    newtab.bookmarks.fail('remove');
    await newtab.undo();
    expect(state(newtab)).toEqual([['Two'], ['Start', 'One', 'Link', 'Folder']]);
    await newtab.undo();
    expect(state(newtab)).toEqual([['One', 'Two'], ['Start', 'Link', 'Folder']]);
  });
});

describe('sorting the shortcuts', () => {
  it('reorders a shortcut dragged sideways, silently, and dragging back where it started saves nothing', async () => {
    const newtab = await open();
    await newtab.dragTo(newtab.tile('Two'), newtab.shortcutSlot(0));
    expect(newtab.shortcuts()).toEqual(['Two', 'One']);
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await newtab.undo();
      expect(newtab.shortcuts()).toEqual(['One', 'Two']);
      await newtab.redo();
      expect(newtab.shortcuts()).toEqual(['Two', 'One']);
    }
    expect(newtab.toast()).toBe('');
    const saves = vi.spyOn(newtab.browser.storage.sync, 'set');
    await newtab.drag(newtab.tile('One'), [[newtab.shortcutSlot(0)[0], 420], [newtab.shortcutSlot(2)[0] + 30, 432]]);
    await newtab.advance(200);
    expect(newtab.shortcuts()).toEqual(['Two', 'One']);
    expect(saves).not.toHaveBeenCalled();
  });
});

describe('a recent site dragged away', () => {
  const recent = [{ title: 'Recent', url: 'https://recent.example/', lastVisitTime: Date.now(), visitCount: 3 }];

  it('is only bookmarked when dropped on the bookmarks', async () => {
    const newtab = await open({ recent });
    await newtab.dragTo(newtab.recentCard('Recent'), newtab.bookmarkSlot(0));
    expect([newtab.bar(), newtab.shortcuts()]).toEqual([['Recent', 'Start', 'Link', 'Folder'], ['One', 'Two']]);
    for (let cycle = 0; cycle < 2; cycle += 1) {
      await newtab.undo();
      expect(newtab.bar()).toEqual(['Start', 'Link', 'Folder']);
      await newtab.redo();
      expect(newtab.bar()).toEqual(['Recent', 'Start', 'Link', 'Folder']);
    }
  });

  it('adds a shortcut when dropped on the shortcuts, and undo takes it out', async () => {
    const newtab = await open({ recent });
    await newtab.dragTo(newtab.recentCard('Recent'), newtab.shortcutSlot(0));
    expect(newtab.shortcuts()).toEqual(['Recent', 'One', 'Two']);
    await newtab.undo();
    expect(newtab.shortcuts()).toEqual(['One', 'Two']);
  });
});
