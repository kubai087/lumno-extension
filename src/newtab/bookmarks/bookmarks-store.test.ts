import { describe, expect, it } from 'vitest';
import { required } from '../../../tests/fakes/dom';
import {
  buildBookmarkFolderCache,
  buildBookmarkFolderPath,
  collectFolderBookmarkUrls,
  findBookmarksBarNode,
  getBookmarkPageItems,
  type BookmarkNode
} from './bookmarks-store';

function link(id: string, title: string, url: string): BookmarkNode {
  return { id, title, url, syncing: false };
}

function folder(id: string, title: string, children: BookmarkNode[], parentId?: string): BookmarkNode {
  return { id, title, children, syncing: false, ...(parentId ? { parentId } : {}) };
}

const tree = [folder('0', '', [folder('10', '書籤欄', [
  link('11', 'OpenAI', 'https://openai.com/'),
  link('12', 'Duplicate OpenAI', 'https://openai.com/'),
  folder('13', 'Design', [
    link('14', 'Figma', 'https://figma.com/files'),
    link('15', 'Lumno', 'https://lumno.kubai.design/')
  ])
])])];

describe('New Tab bookmarks store', () => {
  it('finds the bookmarks bar, and Firefox’s toolbar by its fixed id', () => {
    expect(findBookmarksBarNode(tree)?.id).toBe('10');
    const firefoxTree = [folder('root________', '', [
      folder('menu________', 'Bookmarks Menu', [], 'root________'),
      folder('toolbar_____', 'Bookmarks Toolbar', [], 'root________'),
      folder('unfiled_____', 'Other Bookmarks', [], 'root________')
    ])];
    expect(findBookmarksBarNode(firefoxTree)?.id).toBe('toolbar_____');
  });

  it('caches each folder’s cards, one per bookmark even when URLs match, with a folder’s previews', () => {
    const cache = buildBookmarkFolderCache(tree, { normalizeHost: (host) => String(host || '').toLowerCase().replace(/^www\./, '') });
    const items = required(cache.folderItemsCache.get('10'), 'the bar items');

    expect(cache.rootFolderId).toBe('10');
    expect(cache.nodeMap).toBeInstanceOf(Map);
    expect(items.map((item) => item.id)).toEqual(['11', '12', '13']);
    expect(items.find((item) => item.type === 'bookmark')).toMatchObject({ parentId: '10', index: 0 });
    expect(items.find((item) => item.type === 'folder')).toMatchObject({
      parentId: '10',
      index: 2,
      themeUrl: 'https://figma.com/files',
      previewUrls: ['https://figma.com/files', 'https://lumno.kubai.design/']
    });
  });

  it('collects a folder’s URLs in tree order, keeping duplicates and leaving out JavaScript bookmarks', () => {
    expect(collectFolderBookmarkUrls(folder('folder-recursive', '', [
      link('a', '', 'https://first.example/'),
      folder('nested', '', [
        link('duplicate', '', 'https://first.example/'),
        link('script', '', '  JaVaScRiPt:alert(1)  '),
        link('b', '', 'https://second.example/')
      ])
    ]))).toEqual(['https://first.example/', 'https://first.example/', 'https://second.example/']);
    expect(collectFolderBookmarkUrls(folder('empty', '', []))).toEqual([]);
  });

  it('builds a folder’s path from the bar and pages its items', () => {
    const cache = buildBookmarkFolderCache(tree);
    const path = buildBookmarkFolderPath('13', { nodeMap: cache.nodeMap, rootId: cache.rootFolderId, rootTitle: '书签' });

    expect(path.map((item) => item.title)).toEqual(['书签', 'Design']);
    expect(getBookmarkPageItems([1, 2, 3, 4, 5], 1, 2)).toEqual([3, 4]);
  });

  it('keeps a bookmark moved up a level even when its URL is already there', () => {
    const moved = { ...link('23', 'Moved card', 'https://same.example/'), parentId: '20', index: 2 };
    const crossLevelTree = [folder('0', '', [folder('20', 'Bookmarks bar', [
      link('21', 'Existing destination card', 'https://same.example/'),
      folder('22', 'Source folder', []),
      moved
    ])])];

    expect(buildBookmarkFolderCache(crossLevelTree).folderItemsCache.get('20')?.map((item) => item.id)).toEqual(['21', '22', '23']);
  });
});
