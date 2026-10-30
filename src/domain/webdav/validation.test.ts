import { describe, expect, it } from 'vitest';
import * as settings from '../settings';
import { createShortcutRecord } from '../shortcuts/normalize';
import { LOCAL_PREFERENCE_KEYS } from './state-base';
import { validateState } from './validation';

const theme = settings.themeMode.key;
const empty = (data: Record<string, unknown> = {}) => ({ version: 1, data, groups: [], shortcuts: [], icons: {}, wallpapers: [], assets: {} });
const firstShortcut = createShortcutRecord({ id: 'first', title: 'First', url: 'https://example.com/' }, { now: 100 });
const portableFolder = createShortcutRecord({ id: 'folder-sync-entry', type: 'folder', title: 'Design',
  folderRef: { version: 1, root: 'bookmarks-bar', scope: 'account', path: ['Design'], fingerprint: '0123456789abcdef' }
}, { now: 100 });

describe('reading a state from the server', () => {
  it('keeps only the settings it knows', () => {
    const malicious: unknown = JSON.parse(JSON.stringify(empty({ password: 'never-import-this', [theme]: 'dark' })));

    expect(validateState(malicious).data).toEqual({ [theme]: 'dark' });
  });

  it('carries the custom quote collection through WebDAV only', () => {
    const customQuotes = '_x_extension_custom_quotes_2026_unique_';

    expect(LOCAL_PREFERENCE_KEYS).toContain(customQuotes);
    expect(settings.BROWSER_SYNC_KEYS).not.toContain(customQuotes);
  });

  it('refuses versions it does not know and a malformed writer list', () => {
    expect(() => validateState({ ...empty(), version: 100 })).toThrow(/invalid-state/);
    expect(() => validateState({ ...empty(), version: 4 })).toThrow(/invalid-state/);
    expect(() => validateState({ ...empty(), keys: [1] })).toThrow(/invalid-state/);
  });

  it('takes portable folders only in version 2 and later, and never a local bookmark id', () => {
    expect(() => validateState({ ...empty(), shortcuts: [portableFolder] })).toThrow(/invalid-shortcuts/);
    expect(() => validateState({ ...empty(), version: 2, shortcuts: [{ ...portableFolder, folderId: '42' }] })).toThrow(/invalid-shortcuts/);
  });

  it('requires a grouped state to name its groups once each, and every shortcut a known group', () => {
    expect(() => validateState({ ...empty(), version: 3 })).toThrow(/invalid-shortcuts/);
    expect(() => validateState({ ...empty(), version: 3, groups: [{ id: 'g0', title: '' }],
      shortcuts: [{ ...firstShortcut, groupId: 'missing' }] })).toThrow(/invalid-shortcuts/);
    expect(() => validateState({ ...empty(), version: 3, groups: [{ id: 'g0', title: '' }, { id: 'g0', title: 'Twice' }] }))
      .toThrow(/invalid-shortcuts/);
  });

  it('keeps an ungrouped state within the limit older versions accept', () => {
    const longList = Array.from({ length: 60 }, (_, index) => createShortcutRecord({
      id: `long-${index}`, title: 'Long shortcut', url: `https://example.com/${'x'.repeat(1000)}?id=${index}`
    }, { now: 100 }));

    expect(() => validateState({ ...empty(), shortcuts: longList.concat(firstShortcut) })).toThrow(/state-too-large/);
  });
});
