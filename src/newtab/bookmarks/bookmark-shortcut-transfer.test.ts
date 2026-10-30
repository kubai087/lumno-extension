import { describe, expect, it } from 'vitest';
import { createBookmarkShortcutTransfer } from './bookmark-shortcut-transfer';
import { createBookmarksRuntime } from './bookmarks-runtime';
import { createBookmarkMoveHistory } from './bookmark-move-history';
import { BookmarkSectionParts } from './bookmark-section-parts';
import { MoveHistoryLock } from './move-history-lock';
import { ShortcutList } from '../shortcuts/shortcut-list';
import { createShortcutRecord, isShortcutFolder } from '../../domain/shortcuts/normalize';
import { createBookmarksFake } from '../../../tests/fakes/bookmarks';
import { required } from '../../../tests/fakes/dom';

// A bookmark dropped on the shortcuts: copied while the shortcuts have no
// WebDAV backup, moved while they do, and put back by undo.

const SITE = { id: '10', title: 'Example', url: 'https://example.com/' };

async function setUp(webdavBackup = false) {
  const bookmarks = createBookmarksFake({ bar: [SITE, { id: '20', title: 'Folder', children: [] }] });
  const runtime = createBookmarksRuntime({ chromeApi: { bookmarks: bookmarks.api, runtime: { lastError: null } } });
  await runtime.ensureReady(true);
  const toasts: string[] = [];
  const layoutNotes: string[] = [];
  const shortcutList = new ShortcutList();
  const historyLock = new MoveHistoryLock();
  const history = createBookmarkMoveHistory();
  const transfer = createBookmarkShortcutTransfer({
    bookmarksRuntime: runtime,
    getShortcutStoreOptions: () => ({}),
    getShortcutFolderId: (item) => String('folderId' in item ? item.folderId : ''),
    bookmarkMoveHistory: history,
    shortcutFolderRuntime: { bind() {}, flush: () => Promise.resolve() },
    updateFolderItemIcons: () => Promise.resolve({}),
    persistShortcuts: (items) => {
      shortcutList.replaceItems(items.slice());
      return Promise.resolve(true);
    },
    refreshShortcutFolderReferences: () => Promise.resolve(),
    isWebDavBackingUpShortcuts: () => Promise.resolve(webdavBackup),
    layoutAnimation: {
      queue: (id) => {
        layoutNotes.push(String(id));
      },
      drop: () => {
        layoutNotes.push('dropped');
      }
    },
    showToast: (message) => {
      toasts.push(message);
    },
    t: (_key, fallback) => fallback,
    formatMessage: (_key, fallback) => fallback,
    shortcutList,
    bookmarkParts: new BookmarkSectionParts(),
    historyLock
  });
  const siteRecord = required(createShortcutRecord({ title: SITE.title, url: SITE.url }));
  return { bookmarks, runtime, transfer, historyLock, shortcutList, history, toasts, layoutNotes, siteRecord };
}

describe('bookmark shortcut transfer', () => {
  it('copies a bookmark into the shortcuts while they have no backup', async () => {
    const { bookmarks, transfer, historyLock, history, toasts, layoutNotes, siteRecord, shortcutList } = await setUp();
    await expect(transfer.moveBookmarkToShortcuts({ bookmarkId: SITE.id }, { record: siteRecord, index: 0, groupId: '' })).resolves.toBe(true);
    expect(shortcutList.items.map((item) => (isShortcutFolder(item) ? ['folder'] : [item.url, item.fromBookmark]))).toEqual([[SITE.url, true]]);
    expect(bookmarks.find(SITE.id)).not.toBeNull();
    expect(toasts).toEqual(['Shortcut added']);
    expect(layoutNotes).toEqual([SITE.id]);
    expect(history.peekUndo()).not.toBeNull();
    expect(historyLock.busy).toBe(false);
  });

  it('moves a bookmark into the shortcuts while a backup keeps them, and undo puts it back where it was', async () => {
    const { bookmarks, runtime, transfer, history, siteRecord, shortcutList } = await setUp(true);
    await expect(transfer.moveBookmarkToShortcuts({ bookmarkId: SITE.id }, { record: siteRecord, index: 0, groupId: '' })).resolves.toBe(true);
    expect(shortcutList.items.map((item) => (isShortcutFolder(item) ? ['folder'] : [item.url, item.fromBookmark]))).toEqual([[SITE.url, undefined]]);
    expect(bookmarks.find(SITE.id)).toBeNull();
    const record = required(history.peekUndo());
    if (record.kind !== 'transfer') throw new Error('Expected a transfer record.');
    await expect(transfer.applyBookmarkShortcutTransfer(record, true)).resolves.toBe(true);
    expect(shortcutList.items).toEqual([]);
    await runtime.ensureReady(true);
    const restored = required(required(bookmarks.find('1')).children).find((node) => node.url === SITE.url);
    expect(required(restored).index).toBe(0);
  });

  it('starts nothing while another change runs', async () => {
    const { transfer, historyLock, siteRecord, shortcutList } = await setUp();
    historyLock.hold();
    await expect(transfer.moveBookmarkToShortcuts({ bookmarkId: SITE.id }, { record: siteRecord, index: 0, groupId: '' })).resolves.toBe(false);
    expect(shortcutList.items).toEqual([]);
  });

  it('adds a bookmark folder as a folder shortcut, and no website as one', async () => {
    const { transfer, toasts, shortcutList } = await setUp();
    expect(transfer.hasShortcutForBookmarkFolder('20')).toBe(false);
    await expect(transfer.addBookmarkFolderToShortcuts('20')).resolves.toBe(true);
    expect(shortcutList.items.map((item) => item.type)).toEqual(['folder']);
    expect(toasts).toEqual(['Folder added to shortcuts']);
    await expect(transfer.addBookmarkFolderToShortcuts(SITE.id)).resolves.toBe(false);
  });
});
