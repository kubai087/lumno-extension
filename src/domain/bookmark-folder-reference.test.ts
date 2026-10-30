import { describe as describeTests, expect, it } from 'vitest';
import { buildNodeMap, describe, normalizeReference, resolveReference } from './bookmark-folder-reference';
import type { BookmarkNode } from './bookmark-folder-reference';
import { barOf, folderOf, folderTree } from '../../tests/fakes/bookmark-folder-tree';
import { required } from '../../tests/fakes/dom';

const homeMap = buildNodeMap(folderTree());
const reference = required(describe('42', homeMap), 'the folder reference');

describeTests('bookmark folder references', () => {
  it('finds the folder on another device, whose root label and ids differ', () => {
    expect(resolveReference(reference, buildNodeMap(folderTree('117', '900', 'Bookmarks bar')))?.id).toBe('117');
  });

  it('finds a Chrome folder in Firefox, whose roots use GUIDs', () => {
    const firefox: BookmarkNode[] = [{
      id: 'root________',
      children: [{
        id: 'toolbar_____', parentId: 'root________', title: 'Bookmarks Toolbar',
        children: [{
          id: 'ffFolder0001', parentId: 'toolbar_____', title: '灵感',
          children: [{ id: 'ffBookmark01', parentId: 'ffFolder0001', title: 'Design', url: 'https://example.com/design' }]
        }]
      }]
    }];
    const firefoxMap = buildNodeMap(firefox);
    expect(resolveReference(reference, firefoxMap)?.id).toBe('ffFolder0001');
    expect(describe('ffFolder0001', firefoxMap)?.root).toBe('bookmarks-bar');
    expect(describe('root________', firefoxMap)).toBeNull();
  });

  it('gives a Firefox menu folder a root other clients accept, since references sync through WebDAV', () => {
    const menu: BookmarkNode[] = [{
      id: 'root________',
      children: [{ id: 'menu________', parentId: 'root________', title: 'Bookmarks Menu', children: [{ id: 'ffMenuFold01', parentId: 'menu________', title: 'Reading', children: [] }] }]
    }];
    expect(describe('ffMenuFold01', buildNodeMap(menu))?.root).toBe('other');
  });

  it('rejects a malformed reference and finds nothing in an empty tree', () => {
    expect(normalizeReference({ ...reference, path: ['x'.repeat(1025)] })).toBeNull();
    expect(normalizeReference({ ...reference, fingerprint: 'invalid' })).toBeNull();
    expect(resolveReference(reference, new Map())).toBeNull();
  });

  it('hides identical candidates and lets the contents tell duplicates apart', () => {
    const duplicate = folderTree('117');
    const bar = barOf(duplicate);
    const twin: BookmarkNode = { ...structuredClone(folderOf(duplicate)), id: '118' };
    bar.children?.push(twin);
    expect(resolveReference(reference, buildNodeMap(duplicate))).toBeNull();

    const twinBookmark = required(twin.children?.[0], 'the twin bookmark');
    twinBookmark.url = 'https://different.example/';
    expect(resolveReference(reference, buildNodeMap(duplicate))?.id).toBe('117');
  });

  it('never attaches a device-only folder to another device by matching names', () => {
    const localTree = folderTree();
    barOf(localTree).syncing = false;
    expect(resolveReference(describe('42', buildNodeMap(localTree)), homeMap)).toBeNull();
  });

  it('does not depend on the order of the folder’s items', () => {
    const reordered = folderTree();
    const folder = folderOf(reordered);
    folder.children?.push({ id: 'another', title: 'Other', url: 'https://other.example/' });
    const before = describe('42', buildNodeMap(reordered));
    folder.children?.reverse();
    expect(describe('42', buildNodeMap(reordered))).toEqual(before);
  });
});
