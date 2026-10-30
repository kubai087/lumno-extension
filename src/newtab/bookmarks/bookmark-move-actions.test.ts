import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBookmarkMoveActions } from './bookmark-move-actions';
import { createBookmarksRuntime } from './bookmarks-runtime';
import { createBookmarkMoveHistory, createShortcutAddRecord } from './bookmark-move-history';
import { BookmarkSectionParts } from './bookmark-section-parts';
import { BookmarksShown } from './bookmarks-shown';
import { MoveHistoryLock } from './move-history-lock';
import { ShortcutList } from '../shortcuts/shortcut-list';
import { createSession } from '../dom/bookmark-drag';
import type { FolderDropTarget } from '../cross-surface-drag';
import { createShortcutRecord } from '../../domain/shortcuts/normalize';
import { createBookmarksFake } from '../../../tests/fakes/bookmarks';
import { required } from '../../../tests/fakes/dom';

// Bookmark moves and deletes go on the move history; undo and redo replay
// them, and the shortcut changes that share the history.

async function setUp() {
  const bookmarks = createBookmarksFake({
    bar: [
      { id: '10', title: 'Alpha', url: 'https://alpha.example/' },
      { id: '11', title: 'Beta', url: 'https://beta.example/' },
      { id: '20', title: 'Folder', children: [] }
    ]
  });
  const runtime = createBookmarksRuntime({ chromeApi: { bookmarks: bookmarks.api, runtime: { lastError: null } } });
  // The bookmark calls answer on a timer.
  const reload = async () => {
    const ready = runtime.ensureReady(true);
    await vi.advanceTimersByTimeAsync(1);
    await ready;
  };
  await reload();
  const toasts: string[] = [];
  const shortcutList = new ShortcutList();
  const historyLock = new MoveHistoryLock();
  const history = createBookmarkMoveHistory();
  const actions = createBookmarkMoveActions({
    bookmarksRuntime: runtime,
    bookmarkMoveHistory: history,
    transfer: {
      applyBookmarkShortcutTransfer: () => Promise.resolve(false),
      applyShortcutStack: () => Promise.resolve(false)
    },
    applyShortcutGroupDeleteRecord: () => Promise.resolve(false),
    persistShortcuts: (items) => {
      shortcutList.replaceItems(items.slice());
      return Promise.resolve(true);
    },
    refreshShortcutFolderReferences: () => Promise.resolve(),
    layoutAnimation: { queue() {}, drop() {} },
    showToast: (message) => {
      toasts.push(message);
    },
    t: (_key, fallback) => fallback,
    formatMessage: (_key, fallback, params) => fallback.replace('{shortcut}', String(params ? params.shortcut : '')),
    shortcutList,
    bookmarksShown: new BookmarksShown(),
    bookmarkParts: new BookmarkSectionParts(),
    historyLock
  });
  // Lets the bookmark calls answer and the runtime read the tree again.
  const settle = async () => {
    await vi.advanceTimersByTimeAsync(20);
    await reload();
  };
  return { bookmarks, runtime, actions, historyLock, shortcutList, history, toasts, settle, bar: () => bookmarks.titles('1') };
}

describe('bookmark move actions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deletes a bookmark, puts it back where it was on undo, and deletes it again on redo', async () => {
    const { actions, history, toasts, bar, settle } = await setUp();
    expect(actions.getBookmarkUndoShortcutLabel()).toBe('⌘Z');
    expect(actions.deleteBookmarkFromContextTarget({ bookmarkId: '10' })).toBe(true);
    await settle();
    expect(bar()).toEqual(['Beta', 'Folder']);
    expect(history.peekUndo()).not.toBeNull();

    expect(actions.performBookmarkMoveHistoryAction('undo')).toBe(true);
    await settle();
    expect(bar()).toEqual(['Alpha', 'Beta', 'Folder']);
    expect(toasts).toEqual(['Deletion undone · ⇧⌘Z to delete again']);

    expect(actions.performBookmarkMoveHistoryAction('redo')).toBe(true);
    await settle();
    expect(bar()).toEqual(['Beta', 'Folder']);
    expect(actions.performBookmarkMoveHistoryAction('redo')).toBe(false);
  });

  it('moves a dragged bookmark into a folder, and undo moves it back', async () => {
    const { actions, bookmarks, history, bar, settle } = await setUp();
    const session = createSession({
      card: document.createElement('div'),
      bookmarkId: '10',
      parentId: '1',
      bookmarkItem: { id: '10', index: 0, title: 'Alpha', type: 'bookmark' }
    });
    const folder: FolderDropTarget = { kind: 'card', surface: 'folder', folderId: '20', title: 'Folder', element: document.createElement('div') };
    const moving = actions.persistBookmarkCrossLevelMove(session, folder);
    await vi.advanceTimersByTimeAsync(20);
    await expect(moving).resolves.toBe(true);
    expect(bookmarks.titles('20')).toEqual(['Alpha']);
    expect(history.peekUndo()).not.toBeNull();
    await settle();
    actions.performBookmarkMoveHistoryAction('undo');
    await settle();
    expect(bar()).toEqual(['Alpha', 'Beta', 'Folder']);
    await expect(actions.persistBookmarkCrossLevelMove(session, { kind: 'blocked', surface: 'folder' })).resolves.toBe(false);
  });

  it('replays a shortcut addition on the same history, and nothing while a change runs', async () => {
    const { actions, historyLock, history, toasts, shortcutList, settle } = await setUp();
    const snapshot = required(createShortcutRecord({ id: 's1', title: 'Alpha', url: 'https://alpha.example/' }));
    shortcutList.replaceItems([snapshot]);
    history.push(createShortcutAddRecord({ snapshot, index: 0 }));
    actions.performBookmarkMoveHistoryAction('undo');
    await settle();
    expect(shortcutList.items).toEqual([]);
    expect(toasts).toEqual(['Shortcut add undone · ⇧⌘Z to redo']);
    actions.performBookmarkMoveHistoryAction('redo');
    await settle();
    expect(shortcutList.items.map((item) => item.id)).toEqual(['s1']);
    historyLock.hold();
    expect(actions.performBookmarkMoveHistoryAction('undo')).toBe(false);
  });
});
