import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShortcutDrag } from './shortcut-drag';
import { ShortcutList } from './shortcut-list';
import { DragSessions } from '../drag-sessions';
import { MoveHistoryLock } from '../bookmarks/move-history-lock';
import { BookmarkSectionParts } from '../bookmarks/bookmark-section-parts';
import type { ShortcutItem } from '../../domain/shortcuts/types';
import type { HistoryRecord } from '../bookmarks/bookmark-move-history';

// Alt+Arrow on a focused shortcut moves it one place and saves it the way a
// drop does: one undoable reorder record, and the tile keeps focus.

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const grids: HTMLElement[] = [];

afterEach(() => {
  // Ends a press a test left down.
  document.dispatchEvent(new MouseEvent('pointercancel', { bubbles: true }));
  grids.splice(0).forEach((grid) => grid.remove());
});

function createFixture(shortcuts: Array<{ id: string; groupId: string }>) {
  const shortcutList = new ShortcutList();
  shortcutList.replaceItems(shortcuts.map((item): ShortcutItem => ({ ...item, title: item.id, url: `https://${item.id}.example/`, host: '' })));
  const dragSessions = new DragSessions();
  const historyLock = new MoveHistoryLock();
  const saved: string[][] = [];
  const history: HistoryRecord[] = [];
  const order = () => shortcutList.items.map((item) => `${item.groupId || ''}:${item.id}`);
  // The grid draws the tiles group by group.
  const shortcutGrid = document.createElement('div');
  document.body.appendChild(shortcutGrid);
  grids.push(shortcutGrid);
  const renderShortcuts = vi.fn(() => {
    shortcutGrid.replaceChildren(...shortcutList.items.map((item) => {
      const tile = document.createElement('div');
      tile.className = 'x-nt-shortcut-tile';
      tile.tabIndex = 0;
      tile.setAttribute('data-shortcut-id', item.id);
      tile.setAttribute('data-shortcut-group-id', item.groupId || '');
      return tile;
    }));
  });
  renderShortcuts();
  renderShortcuts.mockClear();
  const drag = createShortcutDrag({
    shortcutTiles: [],
    shortcutAreaScroll: { area: () => null, step: () => false },
    shortcutLayoutAnimation: { change: (apply) => apply(), measure: () => new Map(), shift() {} },
    renderShortcuts,
    flushDeferredShortcutRender: vi.fn(),
    resetShortcutDockHover: vi.fn(),
    persistShortcuts: async (items) => {
      saved.push(items.map((item) => `${item.groupId || ''}:${item.id}`));
      return true;
    },
    bookmarkMoveHistory: {
      push: (record) => {
        if (record) history.push(record);
        return true;
      }
    },
    hideCursorTooltip: vi.fn(),
    closeBookmarkCascadeMenu: vi.fn(),
    hideShortcutTooltip: vi.fn(),
    isEmptyBookmarkRootHidden: vi.fn(),
    renderCurrentBookmarkPage: vi.fn(),
    getExternalBookmarkSurfacePoint: vi.fn(),
    isPointOverShortcutDropSurface: vi.fn(),
    clearBookmarkDragPageSwitch: vi.fn(),
    clearBookmarkDragFolderSwitch: vi.fn(),
    clearDragDropTarget: vi.fn(),
    getBookmarkDragPageSwitchDirection: vi.fn(),
    scheduleBookmarkDragPageSwitch: vi.fn(),
    getShortcutFolderDropTargetAt: vi.fn(),
    getExternalBookmarkDropTarget: vi.fn(),
    setDragDropTarget: vi.fn(),
    scheduleBookmarkDragFolderSwitch: vi.fn(),
    getShortcutById: (id) => shortcutList.items.find((item) => item.id === id) || null,
    isValidExternalBookmarkDropTarget: vi.fn(),
    bookmarksRuntime: { getNode: vi.fn(), getFolderItems: vi.fn() },
    getShortcutFolderId: () => '',
    bookmarkLayoutAnimation: { queue: vi.fn() },
    applyBookmarkShortcutTransfer: vi.fn(),
    applyShortcutStack: vi.fn(),
    getFolderItemIconForShortcut: vi.fn(),
    showToast: vi.fn(),
    hideToast: vi.fn(),
    t: (_key, fallback) => fallback || '',
    formatMessage: (_key, fallback) => fallback || '',
    refreshShortcutFolderReferences: async () => undefined,
    isShortcutContextMenuNode: () => false,
    closeShortcutContextMenu: vi.fn(),
    moveShortcutGroupToIndex: async () => false,
    fitShortcutGroupColumns: () => false,
    shortcutList,
    shortcutGrid,
    bookmarkParts: new BookmarkSectionParts(),
    bookmarkGrid: document.createElement('div'),
    historyLock,
    dragSessions,
    getAddShortcutButton: () => null,
    settings: { get: (setting) => setting.default }
  });
  return {
    drag,
    historyLock,
    saved,
    history,
    order,
    renderShortcuts,
    tile: (id: string) => shortcutGrid.querySelector(`[data-shortcut-id="${id}"]`)
  };
}

describe('moving a shortcut with the keyboard', () => {
  it('swaps a tile with its neighbor in its group, saving one undoable reorder and keeping focus', async () => {
    const fixture = createFixture([{ id: 'a', groupId: 'g1' }, { id: 'b', groupId: 'g1' }, { id: 'c', groupId: 'g1' }]);

    expect(fixture.drag.moveShortcutByKeyboard('a', 1)).toBe(true);
    expect(fixture.order()).toEqual(['g1:b', 'g1:a', 'g1:c']);
    await settle();
    expect(fixture.saved).toEqual([['g1:b', 'g1:a', 'g1:c']]);
    expect(fixture.history.map((record) => record.kind)).toEqual(['shortcut-reorder']);
    expect(fixture.renderShortcuts).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(fixture.tile('a'));

    expect(fixture.drag.moveShortcutByKeyboard('a', -1)).toBe(true);
    expect(fixture.order()).toEqual(['g1:a', 'g1:b', 'g1:c']);
    await settle();
  });

  it('moves the first and last tiles no further', async () => {
    const fixture = createFixture([{ id: 'a', groupId: 'g1' }, { id: 'b', groupId: 'g1' }]);

    expect(fixture.drag.moveShortcutByKeyboard('a', -1)).toBe(false);
    expect(fixture.drag.moveShortcutByKeyboard('b', 1)).toBe(false);
    await settle();
    expect(fixture.saved).toEqual([]);
  });

  it('joins the neighboring group at a group\'s edge', async () => {
    const fixture = createFixture([{ id: 'a', groupId: 'g1' }, { id: 'b', groupId: 'g1' }, { id: 'c', groupId: 'g2' }]);

    expect(fixture.drag.moveShortcutByKeyboard('b', 1)).toBe(true);
    // First in the next group.
    expect(fixture.order()).toEqual(['g1:a', 'g2:b', 'g2:c']);
    await settle();
    expect(fixture.drag.moveShortcutByKeyboard('b', -1)).toBe(true);
    // Last in the previous group.
    expect(fixture.order()).toEqual(['g1:a', 'g1:b', 'g2:c']);
    await settle();
    expect(fixture.history).toHaveLength(2);
  });

  it('moves nothing while another history action or a drag runs', () => {
    const fixture = createFixture([{ id: 'a', groupId: 'g1' }, { id: 'b', groupId: 'g1' }]);

    fixture.historyLock.hold();
    expect(fixture.drag.moveShortcutByKeyboard('a', 1)).toBe(false);
    fixture.historyLock.release();
    // A press on a tile starts a shortcut drag session.
    fixture.tile('b')?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10 }));
    expect(fixture.drag.moveShortcutByKeyboard('a', 1)).toBe(false);
    expect(fixture.order()).toEqual(['g1:a', 'g1:b']);
  });
});
