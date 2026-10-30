import { describe, expect, it } from 'vitest';
import {
  MAX_FOLDER_COLOR_REFS,
  describeFolderIcon,
  importFolderColorMap,
  normalizeFolderColorMap,
  normalizeFolderColorRefs,
  resolveFolderColors,
  setFolderColorRef,
  type FolderColorRefs
} from './bookmark-folder-icon';
import type { BookmarkNode } from './bookmarks-store';
import { createSvgElement } from '../../shared/ui/svg-tree';
import { required } from '../../../tests/fakes/dom';

interface DeviceIds {
  work: string;
  dev: string;
  twinA: string;
  twinB: string;
}

// A device's bookmarks: Work holding Dev, and two same-name Twin folders, on
// the bar. Two devices share folders through bookmark sync but not their ids.
function tree(ids: DeviceIds, options: { workTitle?: string; moved?: boolean } = {}): Map<string, BookmarkNode> {
  const folder = (id: string, parentId: string, title: string, dateAdded: number, children: BookmarkNode[] = []): BookmarkNode =>
    ({ id, parentId, title, dateAdded, syncing: false, children });
  const work = (parentId: string) => folder(ids.work, parentId, options.workTitle || 'Work', 1000, [folder(ids.dev, ids.work, 'Dev', 2000)]);
  const twins = [folder(ids.twinA, '1', 'Twin', 3000), folder(ids.twinB, '1', 'Twin', 4000)];
  const bar: BookmarkNode = { id: '1', parentId: '0', title: 'Bookmarks bar', folderType: 'bookmarks-bar', syncing: false,
    children: options.moved ? twins : [work('1'), ...twins] };
  const other: BookmarkNode = { id: '2', parentId: '0', title: 'Other', folderType: 'other', syncing: false,
    children: options.moved ? [work('2')] : [] };
  const map = new Map<string, BookmarkNode>();
  const visit = (node: BookmarkNode) => {
    map.set(node.id, node);
    (node.children || []).forEach(visit);
  };
  visit({ id: '0', title: '', syncing: false, children: [bar, other] });
  return map;
}

const deviceA = tree({ work: '10', dev: '11', twinA: '12', twinB: '13' });
const deviceBIds = { work: '90', dev: '91', twinA: '92', twinB: '93' };
const deviceB = tree(deviceBIds);

function syncedRefs(): FolderColorRefs {
  const refs = required(setFolderColorRef({}, '11', '#22c55e', deviceA));
  return required(setFolderColorRef(refs, '13', '#EF4444', deviceA));
}

describe('folder colors', () => {
  it('keeps valid colors by folder id, uppercased', () => {
    expect(normalizeFolderColorMap(JSON.parse('{"1":"#aabbcc", "2":"#FF0000", "3":"bad-value", "__proto__":"#ffffff", "invalid id":"#ffffff"}')))
      .toEqual({ 1: '#AABBCC', 2: '#FF0000' });
  });

  it('syncs colors under keys that carry no device bookmark ids', () => {
    const refs = syncedRefs();
    expect(Object.values(refs)).toEqual([{ color: '#22C55E', dateAdded: 2000 }, { color: '#EF4444', dateAdded: 4000 }]);
    expect(Object.keys(refs).every((ref) => /^[a-f0-9]{16}$/.test(ref))).toBe(true);
  });

  it('resolves colors to another device\'s ids, telling same-name siblings apart', () => {
    expect(resolveFolderColors(syncedRefs(), deviceB)).toEqual({ colors: { 91: '#22C55E', 93: '#EF4444' }, refs: syncedRefs(), changed: false });
  });

  it('cannot color a missing folder, and clearing a color removes its entry', () => {
    const refs = syncedRefs();
    expect(setFolderColorRef(refs, 'missing', '#000000', deviceA)).toBeNull();
    expect(resolveFolderColors(setFolderColorRef(refs, '11', null, deviceA), deviceA).colors).toEqual({ 13: '#EF4444' });
  });

  it('finds a renamed and moved folder again by its creation time, and resolving again changes nothing', () => {
    const renamed = tree(deviceBIds, { workTitle: 'Jobs', moved: true });
    const healed = resolveFolderColors(syncedRefs(), renamed);
    expect(healed.changed).toBe(true);
    expect(healed.colors).toEqual({ 91: '#22C55E', 93: '#EF4444' });
    expect(resolveFolderColors(healed.refs, renamed)).toEqual({ colors: healed.colors, refs: healed.refs, changed: false });
  });

  it('keeps the remaining twin\'s own color when the first twin is deleted', () => {
    const bothTwins = setFolderColorRef(syncedRefs(), '12', '#8B5CF6', deviceA);
    const shifted = tree(deviceBIds);
    const bar = required(shifted.get('1'));
    bar.children = (bar.children || []).filter((node) => node.id !== '92');
    shifted.delete('92');
    const afterDelete = resolveFolderColors(bothTwins, shifted);
    expect(afterDelete.colors).toEqual({ 91: '#22C55E', 93: '#EF4444' });
    expect(Object.keys(afterDelete.refs)).toHaveLength(2);
  });

  it('finds folders by their path without matching creation times', () => {
    const undated = tree(deviceBIds);
    undated.forEach((node) => {
      node.dateAdded = 7;
    });
    expect(resolveFolderColors(syncedRefs(), undated)).toEqual({ colors: { 91: '#22C55E', 93: '#EF4444' }, refs: syncedRefs(), changed: false });
  });

  it('migrates legacy id-keyed colors without replacing colors already synced', () => {
    const legacy = importFolderColorMap({ 10: '#aabbcc', 11: '#000000', gone: '#FFFFFF' }, syncedRefs(), deviceA);
    expect(resolveFolderColors(legacy, deviceB).colors).toEqual({ 90: '#AABBCC', 91: '#22C55E', 93: '#EF4444' });
  });

  it('keeps the newest entries under the cap, within the sync item quota', () => {
    const many = Object.fromEntries(Array.from({ length: MAX_FOLDER_COLOR_REFS + 5 }, (_, index) =>
      [index.toString(16).padStart(16, '0'), { color: '#123456', dateAdded: index + 1 }]));
    const capped = normalizeFolderColorRefs(many);
    expect(Object.keys(capped)).toHaveLength(MAX_FOLDER_COLOR_REFS);
    expect(new TextEncoder().encode(JSON.stringify(capped)).length).toBeLessThan(7680);
    expect(normalizeFolderColorRefs({ bad: { color: '#FFFFFF' }, ['a'.repeat(16)]: { color: 'nope' } })).toEqual({});
  });
});

describe('folder icon description', () => {
  const idsOf = (suffix: string) =>
    Array.from(createSvgElement(document, describeFolderIcon(suffix)).querySelectorAll('[id]'), (element) => element.id);

  it('makes its ids unique by a sanitized suffix', () => {
    const firstIds = idsOf('folder one');
    expect(firstIds).toContain('x-nt-folder-filter-lower-base-folder_one');
    expect(idsOf('folder/two')).toContain('x-nt-folder-filter-lower-base-folder_two');
    expect(firstIds.every((id) => !id.includes(' '))).toBe(true);
  });
});
