// A bookmarks tree with one synced folder, "灵感", holding one bookmark,
// on the bookmarks bar; the folder and root ids and the root's title vary as
// they do between devices.
import type { BookmarkNode } from '../../src/domain/bookmark-folder-reference';

export function folderTree(folderId = '42', rootId = '1', rootTitle = '书签栏'): BookmarkNode[] {
  return [{
    id: '0',
    children: [{
      id: rootId,
      parentId: '0',
      title: rootTitle,
      folderType: 'bookmarks-bar',
      syncing: true,
      children: [{
        id: folderId,
        parentId: rootId,
        title: '灵感',
        children: [{ id: `${folderId}-url`, parentId: folderId, title: 'Design', url: 'https://example.com/design' }]
      }]
    }]
  }];
}

// The bookmarks bar of a tree made by folderTree.
export function barOf(tree: BookmarkNode[]): BookmarkNode {
  const bar = tree[0].children?.[0];
  if (!bar) throw new Error('Expected the tree to have a bookmarks bar.');
  return bar;
}

// The first folder on the bar of a tree made by folderTree.
export function folderOf(tree: BookmarkNode[]): BookmarkNode {
  const folder = barOf(tree).children?.[0];
  if (!folder) throw new Error('Expected the bar to hold a folder.');
  return folder;
}
