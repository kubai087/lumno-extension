import { describe, expect, it, vi } from 'vitest';
import { createStore, normalizeEntry } from './folder-item-icons';
import { shortcutFolderItemIcons } from '../../domain/settings/newtab-shortcuts';
import { createBrowserFake } from '../../../tests/fakes/browser';

// The icons websites inside a shortcut folder are given in the edit dialog,
// kept by bookmark id in local storage.

const png = (text: string) => `data:image/png;base64,${Buffer.from(text).toString('base64')}`;
const KEY = shortcutFolderItemIcons.key;

describe('folder item icon entries', () => {
  it('resolve the built-in icon from the URL and keep the image of every other source', () => {
    expect(normalizeEntry({ iconSource: 'builtin', dataUrl: png('x') })).toEqual({ iconSource: 'builtin' });
    expect(normalizeEntry({ iconSource: 'custom', dataUrl: png('x') })).toEqual({ iconSource: 'custom', dataUrl: png('x') });
  });

  it('are dropped without a data image or with an unknown source', () => {
    // Online sources need their image.
    expect(normalizeEntry({ iconSource: 'service' })).toBeNull();
    expect(normalizeEntry({ iconSource: 'custom', dataUrl: 'https://x.example/a.png' })).toBeNull();
    expect(normalizeEntry({ iconSource: 'other', dataUrl: png('x') })).toBeNull();
  });
});

describe('the folder item icon store', () => {
  function createFixture() {
    const browser = createBrowserFake({ local: { [KEY]: { a: { iconSource: 'custom', dataUrl: png('a') }, bad: { iconSource: 'service' } } } });
    const area = browser.storage.local;
    const set = vi.spyOn(area, 'set');
    return { area, set, store: createStore({ storageArea: area, chrome: browser }) };
  }

  it('reads the valid icons it holds', async () => {
    const { store } = createFixture();
    await store.ready;

    expect(store.get('a')).toEqual({ iconSource: 'custom', dataUrl: png('a') });
    expect(store.get('bad')).toBeNull();
  });

  it('applies changes, drops the icons of removed bookmarks and leaves unchanged icons unwritten', async () => {
    const { area, set, store } = createFixture();

    await store.update({ b: { iconSource: 'builtin' }, a: null });
    expect(area.values[KEY]).toEqual({ b: { iconSource: 'builtin' } });
    await store.update({ c: { iconSource: 'favicon-is', dataUrl: png('c') } }, (id) => id !== 'b');
    expect(Object.keys(Object(area.values[KEY]))).toEqual(['c']);

    const writes = set.mock.calls.length;
    await store.update({ c: { iconSource: 'favicon-is', dataUrl: png('c') } });
    expect(set).toHaveBeenCalledTimes(writes);
  });
});
