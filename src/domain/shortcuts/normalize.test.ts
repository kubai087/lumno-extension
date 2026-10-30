import { describe, expect, it } from 'vitest';
import { DEFAULT_MAX_SHORTCUTS, DEFAULT_MAX_SHORTCUT_GROUPS, SHORTCUT_GROUP_TITLE_MAX_LENGTH } from './constants';
import {
  createShortcutRecord,
  getDefaultShortcutState,
  isDefaultShortcutGroupLayout,
  normalizeShortcutItem,
  normalizeShortcutState,
  normalizeShortcutUrl,
  normalizeShortcuts
} from './normalize';
import { buildNodeMap, describe as describeFolder } from '../bookmark-folder-reference';
import { folderTree } from '../../../tests/fakes/bookmark-folder-tree';
import { required } from '../../../tests/fakes/dom';

function createShortcutInputs(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `shortcut-${index + 1}`,
    title: `Shortcut ${index + 1}`,
    url: `https://shortcut-${index + 1}.example/`
  }));
}

describe('shortcut records', () => {
  it('creates a shortcut from a loose URL with a short id and no timestamps', () => {
    const shortcut = createShortcutRecord({ title: ' Lumno ', url: 'lumno.kubai.design' }, {
      now: 42,
      sanitizeDisplayText: (value) => String(value || '').trim()
    });

    // Sync would only spend bytes on timestamps.
    expect(shortcut).toEqual({ id: 's163q8b', title: 'Lumno', url: 'https://lumno.kubai.design/', host: 'lumno.kubai.design' });
  });

  it('falls back to the host for an empty title', () => {
    const shortcut = createShortcutRecord({ title: '', url: 'https://www.example.com/tools?q=1' }, {
      now: 7,
      normalizeHost: (host) => String(host || '').replace(/^www\./, '')
    });

    expect(shortcut).toMatchObject({ title: 'example.com', host: 'example.com' });
  });

  it('creates shortcuts to browser pages', () => {
    expect(createShortcutRecord({ title: 'Inspect devices', url: ' chrome://inspect/#devices ' }, { now: 42 }))
      .toMatchObject({ title: 'Inspect devices', url: 'chrome://inspect/#devices', host: 'inspect' });
    ['chrome', 'edge', 'brave', 'vivaldi', 'opera'].forEach((scheme) => {
      expect(normalizeShortcutUrl(`${scheme.toUpperCase()}://SETTINGS`)).toBe(`${scheme}://settings/`);
      expect(normalizeShortcutUrl(`${scheme}://settings/content?search=camera#permissions`))
        .toBe(`${scheme}://settings/content?search=camera#permissions`);
    });
    expect(createShortcutRecord({ url: 'chrome://extensions/' })).toMatchObject({ title: 'extensions' });
  });

  it.each([
    '',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///tmp/example.html',
    'chrome-extension://example/options.html',
    'custom://settings/',
    'chrome://',
    'chrome:settings',
    'chrome:///settings',
    'chrome://user@settings/',
    'chrome://user:password@settings/',
    'chrome://settings:80/'
  ])('does not accept %j as a shortcut URL', (url) => {
    expect(createShortcutRecord({ title: 'Bad', url })).toBeNull();
  });

  it('refers to a bookmark folder by its id, never by a URL', () => {
    const folder = createShortcutRecord({ type: 'folder', folderId: '42', title: 'Design' }, { now: 9 });

    expect(folder).toMatchObject({ id: 'shortcut-folder-42' });
    expect(folder && 'url' in folder ? folder.url : undefined).toBeUndefined();
    expect(normalizeShortcutItem({ type: 'folder', folderId: '0' })).toBeNull();
  });

  it('keeps a portable folder entry free of this device’s bookmark id, with an identity of its own', () => {
    const folderRef = describeFolder('42', buildNodeMap(folderTree()));
    const entry = required(createShortcutRecord({ id: 'entry-a', type: 'folder', title: '灵感', folderRef }, { now: 1 }), 'the folder entry');
    expect(Object.hasOwn(entry, 'folderId')).toBe(false);

    const generated = required(createShortcutRecord({ type: 'folder', folderRef }), 'the generated entry');
    expect(generated.id.startsWith('shortcut-folder-')).toBe(true);
    expect(normalizeShortcuts([generated])).toEqual([generated]);
    // An id made up on every read would bind a new folder each time.
    expect(normalizeShortcutItem({ ...entry, id: '' })).toBeNull();
  });
});

describe('shortcut lists', () => {
  it('drops a URL or id seen before, so icons and folders keyed by id stay unambiguous', () => {
    const shortcuts = normalizeShortcuts([
      { id: 'one', title: 'One', url: 'https://one.example/' },
      { id: 'dupe', title: 'Duplicate', url: 'one.example' },
      { id: 'bad', title: 'Bad', url: 'javascript:alert(1)' },
      { id: 'two', title: 'Two', url: 'https://two.example/' },
      { id: 'two', title: 'Same id', url: 'https://three.example/' }
    ], { maxShortcuts: 8 });

    expect(shortcuts.map((shortcut) => shortcut.title)).toEqual(['One', 'Two']);
  });

  it('keeps two hundred shortcuts by default', () => {
    const shortcuts = normalizeShortcuts(createShortcutInputs(201));

    expect(DEFAULT_MAX_SHORTCUTS).toBe(200);
    expect(shortcuts).toHaveLength(200);
    expect(shortcuts[0].id).toBe('shortcut-1');
    expect(shortcuts[199].id).toBe('shortcut-200');
  });

  it('starts with the Lumno shortcut in one untitled group', () => {
    const state = getDefaultShortcutState();

    expect(state.groups).toEqual([{ id: 'g0', title: '' }]);
    expect(state.items).toEqual([{
      id: 'shortcut-lumno-default',
      groupId: 'g0',
      title: 'Lumno',
      url: 'https://lumno.kubai.design/',
      host: 'lumno.kubai.design'
    }]);
    expect(isDefaultShortcutGroupLayout(state.groups)).toBe(true);
  });
});

describe('shortcut groups', () => {
  it('drops duplicate and malformed groups and puts every item in a known group', () => {
    const longTitle = '一二三四五六七八九十一二三四五六七八九十一二三四五六七八';
    const state = normalizeShortcutState({
      groups: [
        { id: 'work', title: ` ${longTitle} ` },
        { id: 'work', title: 'Duplicate' },
        { id: 'bad id!', title: 'Invalid' },
        { id: 'play', title: 'Play' }
      ],
      items: [
        { id: 'a', title: 'A', url: 'https://a.example/', groupId: 'play' },
        { id: 'b', title: 'B', url: 'https://b.example/' },
        { id: 'c', title: 'C', url: 'https://c.example/', groupId: 'work' },
        { id: 'd', title: 'D', url: 'https://d.example/', groupId: 'missing' }
      ]
    });

    expect(state.groups.map((group) => group.id)).toEqual(['work', 'play']);
    expect(Array.from(state.groups[0].title)).toHaveLength(SHORTCUT_GROUP_TITLE_MAX_LENGTH);
    // Items follow group order and keep their order inside a group; one
    // without a known group joins the one before it.
    expect(state.items.map((item) => [item.id, item.groupId])).toEqual([['c', 'work'], ['d', 'work'], ['a', 'play'], ['b', 'play']]);
  });

  it('caps the number of groups and always keeps one to put shortcuts in', () => {
    const capped = normalizeShortcutState({
      groups: Array.from({ length: 25 }, (_, index) => ({ id: `g${index + 1}`, title: `${index + 1}` }))
    });

    expect(capped.groups).toHaveLength(DEFAULT_MAX_SHORTCUT_GROUPS);
    expect(normalizeShortcutState({ groups: [] }).groups).toEqual([{ id: 'g0', title: '' }]);
  });
});
