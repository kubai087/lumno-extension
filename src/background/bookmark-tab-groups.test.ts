import { describe, expect, it } from 'vitest';
import type { BookmarkNodeLike, BookmarkTabGroupChromeApi } from './bookmark-tab-groups';
import { collectBookmarkUrls, openBookmarkFolderInNewTabGroup } from './bookmark-tab-groups';
import { browserTab } from '../../tests/fakes/worker';

const folderTree: BookmarkNodeLike = {
  title: 'Research',
  children: [
    { url: 'https://a.example/' },
    {
      title: 'Nested',
      children: [
        { url: 'https://a.example/' },
        { url: 'javascript:alert(1)' },
        { url: 'https://b.example/' }
      ]
    }
  ]
};

interface StubOptions {
  tree?: BookmarkNodeLike;
  failUrl?: string;
}

function createBookmarkStub(options: StubOptions = {}) {
  const created: chrome.tabs.CreateProperties[] = [];
  const grouped: number[][] = [];
  const updated: { groupId: number; title: string }[] = [];
  const folders: string[] = [];
  const runtime: { lastError: { message: string } | null } = { lastError: null };
  let nextTabId = 100;
  const withLastError = (message: string, callback: () => void) => {
    runtime.lastError = message ? { message } : null;
    callback();
    runtime.lastError = null;
  };
  const chromeApi: BookmarkTabGroupChromeApi = {
    runtime,
    bookmarks: {
      getSubTree(folderId, callback) {
        folders.push(folderId);
        callback([options.tree || folderTree]);
      }
    },
    tabs: {
      create(properties, callback) {
        created.push({ ...properties });
        if (properties.url === options.failUrl) {
          withLastError('create failed', () => callback(browserTab({ id: -1 })));
          return;
        }
        nextTabId += 1;
        callback(browserTab({ id: nextTabId }));
      },
      group(properties, callback) {
        grouped.push([...properties.tabIds]);
        callback(44);
      }
    },
    tabGroups: {
      update(groupId, properties, callback) {
        updated.push({ groupId, ...properties });
        callback();
      }
    }
  };
  return { chromeApi, created, grouped, updated, folders };
}

describe('opening a bookmark folder in a new tab group', () => {
  it('collects every link depth first, without bookmarklets', () => {
    expect(collectBookmarkUrls(folderTree)).toEqual(['https://a.example/', 'https://a.example/', 'https://b.example/']);
  });

  it('opens the links in the background from the insert index and names the group after the folder', async () => {
    const stub = createBookmarkStub();
    const result = await openBookmarkFolderInNewTabGroup(stub.chromeApi, {
      folderId: 'folder-1', title: 'Research', windowId: 7, insertIndex: 3
    });

    expect(result).toEqual({ ok: true, requestedCount: 3, openedCount: 3, failedCount: 0, groupId: 44, reason: '' });
    expect(stub.folders).toEqual(['folder-1']);
    expect(stub.created).toEqual([
      { url: 'https://a.example/', active: false, windowId: 7, index: 3 },
      { url: 'https://a.example/', active: false, windowId: 7, index: 4 },
      { url: 'https://b.example/', active: false, windowId: 7, index: 5 }
    ]);
    expect(stub.grouped).toEqual([[101, 102, 103]]);
    expect(stub.updated).toEqual([{ groupId: 44, title: 'Research' }]);
  });

  it('groups the tabs that opened when some fail', async () => {
    const stub = createBookmarkStub({ failUrl: 'https://a.example/' });
    const result = await openBookmarkFolderInNewTabGroup(stub.chromeApi, { folderId: 'folder-1', title: 'Research' });

    expect(result).toMatchObject({ ok: false, requestedCount: 3, openedCount: 1, failedCount: 2, groupId: 44 });
    expect(stub.grouped).toEqual([[101]]);
  });

  it('opens nothing for an empty folder', async () => {
    const stub = createBookmarkStub({ tree: { title: 'Empty', children: [] } });
    const result = await openBookmarkFolderInNewTabGroup(stub.chromeApi, { folderId: 'folder-1' });

    expect(result.reason).toBe('empty-folder');
    expect(stub.created).toEqual([]);
  });

  it('answers without the bookmarks API', async () => {
    expect((await openBookmarkFolderInNewTabGroup({}, { folderId: 'folder-1' })).reason).toBe('bookmarks-api-unavailable');
  });
});
