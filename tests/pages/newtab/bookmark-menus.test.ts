import { describe, expect, it } from 'vitest';
import { describeFolderIcon } from '../../../src/newtab/bookmarks/bookmark-folder-icon';
import { createSvgElement } from '../../../src/shared/ui/svg-tree';
import type { FakeBookmarkNode } from '../../fakes/bookmarks';
import { expectElement, getElement, getElementById, getElements, required } from '../../fakes/dom';
import { openDragPage, waitUntil, type DragPage } from './drag-page';

// New Tab's bookmark menus: a folder shortcut opens its folder as a cascade
// menu whose subfolders open on hover; right-clicking a bookmark offers its
// actions, deleting it with undo (⌘Z) and redo (⇧⌘Z), adding it to the
// shortcuts, or opening a folder as a tab group.

const MENU = '#_x_extension_newtab_bookmark_context_menu_2026_unique__menu';
const TOAST_ID = '_x_extension_toast_2024_unique_';

const click = (element: Element) => element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));

async function openFolderMenu(newtab: DragPage): Promise<void> {
  click(getElement(document, '.x-nt-shortcut-tile--folder'));
  await newtab.advance(200);
}

const rootRows = () => getElements(document, '.x-nt-bookmark-cascade-level[data-level="0"] .x-nt-bookmark-cascade-item');
const rootTitles = () => rootRows().map((item) => (item.textContent || '').trim());
const rootRow = (title: string) => expectElement(rootRows().find((item) => (item.textContent || '').trim() === title), `the row ${title}`);

// Right-clicks `element` and lists the menu's options as [value, disabled, label].
async function contextMenu(newtab: DragPage, element: Element): Promise<Array<[string | null, boolean, string]>> {
  element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20, button: 2 }));
  await newtab.advance(150);
  return getElements(document, `${MENU} [role="menuitem"]`)
    .map((option) => [option.getAttribute('data-value'), option.getAttribute('aria-disabled') === 'true', (option.textContent || '').trim()]);
}

async function choose(newtab: DragPage, value: string): Promise<void> {
  const option = getElement(document, `${MENU} [data-value="${value}"]`);
  option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
  click(option);
  await newtab.advance(250);
}

async function escape(newtab: DragPage): Promise<void> {
  await newtab.key({ key: 'Escape' });
}

describe('a folder shortcut\'s cascade menu', () => {
  it('shows subfolders with the animated folder icon, which opens with its submenu on hover', async () => {
    const newtab = await openDragPage({
      unplaced: true,
      shortcuts: [{ type: 'folder', folderId: '10', title: 'Docs' }],
      bookmarks: [{ id: '10', title: 'Docs', children: [
        { id: '11', title: 'MDN', url: 'https://developer.mozilla.org/' },
        { id: '12', title: 'Sub', children: [{ id: '13', title: 'C', url: 'https://c.example/' }] }
      ] }]
    });
    await openFolderMenu(newtab);
    const sub = expectElement(getElements(document, '.x-nt-bookmark-cascade-item').find((item) => /Sub/.test(item.textContent || '')), 'the Sub row');
    const icon = getElement(sub, '.x-nt-bookmark-cascade-icon--folder');
    expect(icon.querySelector('svg path[data-folder-part]')).not.toBeNull();
    expect(sub.querySelector('.ri-arrow-right-s-line')).not.toBeNull();
    const shape = () => Array.from(icon.querySelectorAll('path'), (path) => path.getAttribute('d')).join('|');
    const closed = shape();

    sub.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    sub.dispatchEvent(new MouseEvent('pointerenter'));
    sub.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    sub.dispatchEvent(new MouseEvent('mouseenter'));
    await newtab.advance(400);
    expect(sub.getAttribute('aria-expanded')).toBe('true');
    expect(shape()).not.toBe(closed);
    expect(document.querySelectorAll('.x-nt-bookmark-cascade-level')).toHaveLength(2);
  });

  it('draws the folder shortcut with the shared folder icon', async () => {
    await openDragPage({
      unplaced: true,
      shortcuts: [{ type: 'folder', folderId: '10', title: 'Docs' }],
      bookmarks: [{ id: '10', title: 'Docs', children: [] }]
    });
    const tile = getElement(document, '.x-nt-shortcut-tile--folder');
    const parts = (root: Element) => Array.from(root.querySelectorAll('svg path[data-folder-part], path[data-folder-part]'),
      (part) => part.getAttribute('data-folder-part'));
    const drawn = parts(tile);
    expect(drawn.length).toBeGreaterThan(0);
    const probe = document.createElement('div');
    probe.appendChild(createSvgElement(document, describeFolderIcon('probe', '10')));
    expect(drawn).toEqual(parts(probe));
  });
});

describe('a bookmark menu row\'s context menu', () => {
  const openDocs = () => openDragPage({
    unplaced: true,
    shortcuts: [{ type: 'folder', folderId: '10', title: 'Docs' }],
    bookmarks: [{ id: '10', title: 'Docs', children: [
      { id: '11', title: 'Link A', url: 'https://example.com/a' },
      { id: '12', title: 'Folder B', children: [
        { id: '13', title: 'Link B', url: 'https://example.com/b' },
        { id: '15', title: 'Deep', children: [{ id: '16', title: 'Link C', url: 'https://example.com/c' }] }
      ] },
      { id: '14', title: 'Empty', children: [] }
    ] }]
  });
  const describeTree = (node: FakeBookmarkNode): string | Record<string, unknown[]> =>
    (node.url ? node.title : { [node.title]: (node.children || []).map(describeTree) });
  const tree = (newtab: DragPage) => (required(newtab.bookmarks.find('10')).children || []).map(describeTree);
  const toast = () => getElementById(TOAST_ID).textContent || '';

  it('opens in a new tab first and deletes last for a website', async () => {
    const newtab = await openDocs();
    await openFolderMenu(newtab);
    const options = await contextMenu(newtab, rootRow('Link A'));
    expect(options[0][0]).toBe('open-in-new-tab');
    expect(options[options.length - 1][0]).toBe('remove');
  });

  it('offers a folder its actions, keeping the row marked and the folder menu open behind it', async () => {
    const newtab = await openDocs();
    await openFolderMenu(newtab);
    const options = await contextMenu(newtab, rootRow('Folder B'));
    expect(options.map(([value]) => value)).toEqual(['open-in-new-tab-group', 'add-shortcut', 'folder-color', 'edit', 'remove']);
    expect(rootRow('Folder B').getAttribute('data-bookmark-context-menu-open')).toBe('true');
    expect(document.querySelector('.x-nt-bookmark-cascade-level[data-open="true"]')).not.toBeNull();
    await escape(newtab);
    const empty = await contextMenu(newtab, rootRow('Empty'));
    expect([empty[0][0], empty[0][1]]).toEqual(['open-in-new-tab-group', true]);
  });

  it('opens a folder as a tab group after confirming how many tabs, subfolders included', async () => {
    const newtab = await openDocs();
    await openFolderMenu(newtab);
    await contextMenu(newtab, rootRow('Folder B'));
    await choose(newtab, 'open-in-new-tab-group');
    await waitUntil(() => /Open 2 tabs\?/.test(document.body.textContent || ''), 'the confirmation should say how many tabs open');
    const confirm = expectElement(getElements(document, 'button').find((button) => (button.textContent || '').trim() === 'Open'), 'the Open button');
    click(confirm);
    await newtab.advance(150);
    const actions = newtab.browser.runtime.sendMessage.mock.calls.map((call) => {
      const message: unknown = call[0];
      return typeof message === 'object' && message !== null && 'action' in message ? message.action : undefined;
    });
    expect(actions).toContain('openBookmarkFolderInNewTabGroup');
  });

  it('deletes a folder with everything in it, silently; undo restores it where it was and redo deletes it again', async () => {
    const newtab = await openDocs();
    const original = tree(newtab);
    await openFolderMenu(newtab);
    await contextMenu(newtab, rootRow('Folder B'));
    await choose(newtab, 'remove');
    expect(rootTitles()).toEqual(['Link A', 'Empty']);
    expect(tree(newtab)).toEqual(['Link A', { Empty: [] }]);
    expect(toast()).toBe('');

    await newtab.undo();
    expect(tree(newtab)).toEqual(original);
    if (!rootRows().length) await openFolderMenu(newtab);
    expect(rootTitles()).toEqual(['Link A', 'Folder B', 'Empty']);
    expect(toast()).toMatch(/Deletion undone · ⇧⌘Z/);

    await newtab.redo();
    expect(tree(newtab)).toEqual(['Link A', { Empty: [] }]);
    expect(toast().length).toBeGreaterThan(0);
  });
});

describe('a bookmark card\'s context menu', () => {
  it('adds a website or a folder to the shortcuts once, leaving the bookmark in place', async () => {
    const newtab = await openDragPage({
      unplaced: true,
      shortcuts: [{ url: 'https://already.example/', title: 'Already' }, { type: 'folder', folderId: '9', title: 'Added' }],
      bookmarks: [
        { id: '7', title: 'Example', url: 'https://example.com/' },
        { id: '6', title: 'Already', url: 'https://already.example/' },
        { id: '8', title: 'Folder', children: [] },
        { id: '9', title: 'Added', children: [] }
      ]
    });
    const site = await contextMenu(newtab, newtab.card('7'));
    expect(site.map(([value]) => value)).toEqual(['open-in-new-tab', 'add-shortcut', 'edit', 'remove']);
    expect(site[1]).toEqual(['add-shortcut', false, 'Add to shortcuts']);
    await escape(newtab);
    expect((await contextMenu(newtab, newtab.card('6'))).find(([value]) => value === 'add-shortcut')).toEqual(['add-shortcut', true, 'Already in shortcuts']);
    await escape(newtab);
    const folder = await contextMenu(newtab, newtab.card('8'));
    expect(folder.map(([value]) => value)).toEqual(['open-in-new-tab-group', 'add-shortcut', 'folder-color', 'edit', 'remove']);
    expect(folder[1][2]).toBe('Add to shortcuts');
    await escape(newtab);
    expect((await contextMenu(newtab, newtab.card('9'))).find(([value]) => value === 'add-shortcut')).toEqual(['add-shortcut', true, 'Already in shortcuts']);

    await escape(newtab);
    await contextMenu(newtab, newtab.card('7'));
    await choose(newtab, 'add-shortcut');
    expect(newtab.shortcuts()).toContain('Example');
    expect(newtab.bar()).toEqual(['Example', 'Already', 'Folder', 'Added']);
  });
});
