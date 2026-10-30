import { describe, expect, it } from 'vitest';
import * as settings from '../settings';
import { createShortcutRecord } from '../shortcuts/normalize';
import { adoptRemote, mergeInitialWallpapers, mergeStates } from './merge';
import { KNOWN_KEYS, LOCAL_WALLPAPER_KEY, WALLPAPER_KEY, sameContent } from './state-base';
import type { WebDavState } from './types';
import { validateState } from './validation';

const theme = settings.themeMode.key;
const language = settings.language.key;
const customSearch = settings.siteSearchCustom.key;
const engine = (name: string) => [{ name, url: `https://${name}.example/?q=%s` }];
const hashOf = (character: string) => character.repeat(64);

function state(input: Record<string, unknown> = {}): WebDavState {
  return validateState({ version: 1, data: {}, groups: [], shortcuts: [], icons: {}, wallpapers: [], assets: {}, ...input });
}

const empty = (data: Record<string, unknown> = {}) => state({ data });

describe('merging two devices against the state they last shared', () => {
  const base = empty({ [theme]: 'light', [language]: 'en' });

  it('keeps the change each side made', () => {
    const merged = mergeStates(base, empty({ ...base.data, [theme]: 'dark' }), empty({ ...base.data, [language]: 'ja' }));

    expect(merged.conflicts).toEqual([]);
    expect(merged.state.data).toEqual({ [theme]: 'dark', [language]: 'ja' });
  });

  it('lets only the side that changed a setting decide it', () => {
    const offline = mergeStates(base, base, empty({ ...base.data, [theme]: 'dark' }));
    const localOnly = mergeStates(base, empty({ ...base.data, [theme]: 'dark' }), base);

    expect([offline.conflicts, offline.state.data[theme]]).toEqual([[], 'dark']);
    expect([localOnly.conflicts, localOnly.state.data[theme]]).toEqual([[], 'dark']);
  });

  it('reports a setting both sides changed apart, and resolves it by the chosen side', () => {
    const local = empty({ ...base.data, [theme]: 'dark' });
    const remote = empty({ ...base.data, [theme]: 'system' });

    expect(mergeStates(base, local, remote).conflicts).toEqual([theme]);
    expect(mergeStates(base, local, remote, 'remote').state.data[theme]).toBe('system');
    expect(mergeStates(base, local, empty({ ...base.data, [theme]: 'dark' })).conflicts).toEqual([]);
    expect(mergeStates(empty({ [customSearch]: engine('base') }), empty({ [customSearch]: engine('a') }),
      empty({ [customSearch]: engine('b') })).conflicts).toEqual([customSearch]);
  });

  it('keeps unrelated edits of both sides when a conflict is resolved', () => {
    const conflictBase = empty({ [theme]: 'light', [language]: 'en', [customSearch]: engine('base') });
    const conflictLocal = empty({ [theme]: 'dark', [language]: 'ja', [customSearch]: engine('local') });
    const conflictRemote = empty({ [theme]: 'system', [language]: 'en', [customSearch]: engine('remote'), [settings.simpleModeEnabled.key]: true });

    expect(mergeStates(conflictBase, conflictLocal, conflictRemote, 'remote').state.data).toEqual({
      [theme]: 'system', [language]: 'ja', [customSearch]: engine('remote'), [settings.simpleModeEnabled.key]: true
    });
  });

  it('removes a setting one side deleted', () => {
    expect(Object.hasOwn(mergeStates(base, empty({ [language]: 'en' }), base).state.data, theme)).toBe(false);
  });

  describe('field-merged records', () => {
    const quote = settings.newtabQuotePrefs.key;
    const quoteBase = empty({ [quote]: { enabled: true, position: 'search', category: 'literature', fontSize: 16 } });
    const quoteLocal = empty({ [quote]: { enabled: true, position: 'search', category: 'literature', fontSize: 20 } });
    const quoteRemote = empty({ [quote]: { enabled: true, position: 'bottom', category: 'literature', fontSize: 16 } });
    const quoteBoth = empty({ [quote]: { enabled: true, position: 'bottom', category: 'poetry', fontSize: 18 } });

    it('merges different fields without a conflict', () => {
      const merged = mergeStates(quoteBase, quoteLocal, quoteRemote);

      expect(merged.conflicts).toEqual([]);
      expect(merged.state.data[quote]).toEqual({ enabled: true, position: 'bottom', category: 'literature', fontSize: 20 });
    });

    it('lets the chosen side decide only the fields both changed', () => {
      expect(mergeStates(quoteBase, quoteLocal, quoteBoth).conflicts).toEqual([quote]);
      expect(mergeStates(quoteBase, quoteLocal, quoteBoth, 'local').state.data[quote])
        .toEqual({ enabled: true, position: 'bottom', category: 'poetry', fontSize: 20 });
      expect(mergeStates(quoteBase, quoteLocal, quoteBoth, 'remote').state.data[quote])
        .toEqual({ enabled: true, position: 'bottom', category: 'poetry', fontSize: 18 });
    });

    it('treats deleting a record as a whole-value change, and a missing base record as empty', () => {
      expect(Object.hasOwn(mergeStates(quoteBase, empty(), quoteRemote).state.data, quote)).toBe(false);
      expect(mergeStates(empty(), quoteLocal, quoteBoth).conflicts).toEqual([quote]);
      expect(mergeStates(empty(), quoteLocal, quoteBoth, 'local').state.data[quote]).toEqual(quoteLocal.data[quote]);
    });

    it('lets devices color different bookmark folders', () => {
      const folderColors = settings.bookmarkFolderColorRefs.key;
      const workRef = 'a'.repeat(16);
      const homeRef = 'b'.repeat(16);
      const colorBase = empty({ [folderColors]: { [workRef]: { color: '#5393FF', dateAdded: 1 } } });
      const colorLocal = empty({ [folderColors]: { [workRef]: { color: '#22C55E', dateAdded: 1 } } });
      const colorRemote = empty({ [folderColors]: { [workRef]: { color: '#5393FF', dateAdded: 1 }, [homeRef]: { color: '#EF4444', dateAdded: 2 } } });
      const merged = mergeStates(colorBase, colorLocal, colorRemote);

      expect(merged.conflicts).toEqual([]);
      expect(merged.state.data[folderColors]).toEqual({
        [homeRef]: { color: '#EF4444', dateAdded: 2 }, [workRef]: { color: '#22C55E', dateAdded: 1 }
      });
    });
  });

  // Chrome sync delivers the shared wallpaper key before WebDAV delivers the
  // local-only selection.
  it('does not take a wallpaper edit that arrived in halves for a conflict', () => {
    const merged = mergeStates(empty({ [WALLPAPER_KEY]: { light: 'default' }, [LOCAL_WALLPAPER_KEY]: { light: 'custom-wallpaper-1' } }),
      empty({ [WALLPAPER_KEY]: { light: 'aurora' }, [LOCAL_WALLPAPER_KEY]: { light: 'custom-wallpaper-1' } }),
      empty({ [WALLPAPER_KEY]: { light: 'aurora' }, [LOCAL_WALLPAPER_KEY]: { light: null } }));

    expect(merged.conflicts).toEqual([]);
    expect(merged.state.data[LOCAL_WALLPAPER_KEY]).toEqual({ light: null });
  });

  describe('shortcuts and their icons', () => {
    const media = { [hashOf('a')]: { mime: 'image/webp', size: 10 }, [hashOf('b')]: { mime: 'image/png', size: 10 },
      [hashOf('c')]: { mime: 'image/png', size: 10 }, [hashOf('d')]: { mime: 'image/png', size: 10 } };
    const shortcutA = { id: 'a', type: 'link', title: 'A', url: 'https://a.example/' };
    const shortcutB = { id: 'b', type: 'link', title: 'B', url: 'https://b.example/' };
    const withIcon = (icons: Record<string, string>, list = [shortcutA, shortcutB]) => state({ shortcuts: list, icons, assets: media });

    it('does not take a shortcut that arrived before its icon for a conflict', () => {
      const merged = mergeStates(state({ shortcuts: [shortcutA] }), state({ shortcuts: [shortcutA, shortcutB] }),
        state({ shortcuts: [shortcutA, shortcutB], icons: { b: hashOf('b') }, assets: media }));

      expect(merged.conflicts).toEqual([]);
      expect(merged.state.icons).toEqual({ b: hashOf('b') });
    });

    it('merges icons per shortcut', () => {
      const iconBase = withIcon({ a: hashOf('b') });

      expect(mergeStates(iconBase, iconBase, withIcon({ a: hashOf('c') })).state.icons).toEqual({ a: hashOf('c') });
      expect(mergeStates(iconBase, withIcon({ a: hashOf('c') }), withIcon({ a: hashOf('d') })).conflicts).toEqual(['shortcuts']);
      expect(mergeStates(iconBase, withIcon({ a: hashOf('c') }), withIcon({ a: hashOf('d') }), 'remote').state.icons).toEqual({ a: hashOf('d') });
      const removed = mergeStates(iconBase, withIcon({}, [shortcutB]), withIcon({ a: hashOf('d') }));
      expect([removed.conflicts, removed.state.icons]).toEqual([[], {}]);
    });

    it('reports a wallpaper library both sides changed apart', () => {
      const libraryItem = (id: string, name: string) => ({ id, name, width: 10, height: 10, updatedAt: 1, image: hashOf('a'), thumbnail: hashOf('a') });
      const library = (...items: ReturnType<typeof libraryItem>[]) => state({ wallpapers: items, assets: media });

      expect(mergeStates(library(libraryItem('custom-wallpaper-1', 'One')),
        library(libraryItem('custom-wallpaper-1', 'One'), libraryItem('custom-wallpaper-2', 'Two')), library()).conflicts).toEqual(['wallpapers']);
    });

    const groups = [{ id: 'g0', title: '' }, { id: 'work', title: '工作' }];
    const link = (id: string, groupId?: string) => createShortcutRecord({ id, title: id, url: `https://${id}.example/`, groupId });

    it('does not read timestamps a baseline from before groups still has as a local edit', () => {
      const oldBase = { ...empty(), shortcuts: [{ ...link('home'), createdAt: 1, updatedAt: 2 }] };
      const merged = mergeStates(oldBase, state({ shortcuts: [link('home')] }), state({ shortcuts: [link('home'), link('new')] }));

      expect(merged.conflicts).toEqual([]);
      expect(merged.state.shortcuts.map((item) => item.id)).toEqual(['home', 'new']);
    });

    it('reports groups both devices changed as a shortcut conflict', () => {
      const groupBase = state({ version: 3, groups, shortcuts: [link('home', 'g0')] });
      const localGroups = state({ ...groupBase, groups: [groups[0], { id: 'work', title: 'Local' }] });
      const remoteGroups = state({ ...groupBase, groups: [groups[0], { id: 'work', title: 'Remote' }] });

      expect(mergeStates(groupBase, localGroups, remoteGroups).conflicts).toEqual(['shortcuts']);
      expect(mergeStates(groupBase, localGroups, remoteGroups, 'remote').state.groups[1].title).toBe('Remote');
      const merged = mergeStates(groupBase, groupBase, state({ ...groupBase, shortcuts: [link('home', 'g0'), link('docs', 'work')] }));
      expect(merged.conflicts).toEqual([]);
      expect(merged.state.shortcuts.map((item) => item.groupId)).toEqual(['g0', 'work']);
    });
  });
});

// An older version drops the settings it does not know whenever it saves;
// that must not read as removing them.
describe('states written by older versions', () => {
  const glass = settings.newtabGlassStyle.key;
  const size = settings.newtabTimeFontSize.key;
  const ink = settings.newtabTimeInk.key;
  const twelveHour = settings.newtabTime12Hour.key;
  const quotes = '_x_extension_custom_quotes_2026_unique_';
  const shared = '_x_extension_recent_count_2024_unique_';
  const own = (data: Record<string, unknown>) => state({ data, keys: KNOWN_KEYS });
  const mine = own({ [shared]: 1, [glass]: 'liquid', [size]: 72, [ink]: 'light', [twelveHour]: true, [quotes]: { v: 1, items: ['a'] } });

  it("keeps the settings an older writer never knew and takes that writer's own change", () => {
    const legacy = empty({ [shared]: 2 });
    const merged = mergeStates(mine, mine, legacy);

    expect(validateState(mine).keys).toHaveLength(KNOWN_KEYS.length);
    expect(merged.conflicts).toEqual([]);
    expect(merged.state.data).toMatchObject({ [shared]: 2, [glass]: 'liquid', [size]: 72, [ink]: 'light', [twelveHour]: true, [quotes]: { v: 1, items: ['a'] } });
    expect(sameContent(merged.state, legacy)).toBe(false);
    expect(adoptRemote(mine, legacy).data).toEqual({ [shared]: 2, [glass]: 'liquid', [size]: 72, [ink]: 'light', [twelveHour]: true, [quotes]: { v: 1, items: ['a'] } });
  });

  it('removes a setting a writer that knew it left out', () => {
    const removed = own({ [shared]: 1, [size]: 72, [ink]: 'light', [twelveHour]: true, [quotes]: { v: 1, items: ['a'] } });

    expect(Object.hasOwn(mergeStates(mine, mine, removed).state.data, glass)).toBe(false);
  });

  it('does not rewrite the server for a writer list alone', () => {
    const newer = state({ ...mine, keys: [...KNOWN_KEYS, '_x_extension_future_2030_unique_'] });

    expect(sameContent(mergeStates(mine, mine, newer).state, newer)).toBe(true);
  });
});

describe('merging wallpapers on a first join', () => {
  it('fails instead of dropping links past the browser sync item limit', () => {
    const links = settings.newtabLinkWallpapers.key;
    const bigLinks = Array.from({ length: 40 }, (_, index) => ({ id: `link-big${index}xx`, url: `https://big.example/${'x'.repeat(200)}/${index}.jpg`, addedAt: index }));

    expect(() => mergeInitialWallpapers(empty({ [links]: bigLinks.slice(20) }), empty({ [links]: bigLinks.slice(0, 20) }))).toThrow(/merge-too-large/);
  });
});
