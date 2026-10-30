import { describe, expect, it, vi } from 'vitest';
import * as settings from '../domain/settings';
import { LANGUAGE_MESSAGES_KEY } from '../domain/settings/removed';
import { siteSearchIconCache } from '../domain/settings/search';
import { bootWorker } from '../../tests/fakes/worker';

// The worker moves this device's legacy local settings into browser sync on
// startup, and drops from sync what must not live there.
describe('worker startup settings', () => {
  it('moves the local settings into sync and drops the language cache and the bookmark bar material from it', async () => {
    const topbarSync = Object.fromEntries(settings.BOOKMARK_TOPBAR_SURFACE_KEYS.map((key) => [key, key.includes('mode') ? 'clear' : '#aabbcc']));
    const fake = await bootWorker({
      local: {
        [settings.overlayEnterAnimation.key]: 'fade',
        [settings.bookmarkViewMode.key]: 'top',
        [settings.bookmarkFolderIconsVisible.key]: false
      },
      sync: { [LANGUAGE_MESSAGES_KEY]: { hello: 'world' }, ...topbarSync }
    });
    const sync = fake.storage.sync.values;

    await vi.waitFor(() => {
      expect([sync[settings.overlayEnterAnimation.key], sync[settings.bookmarkViewMode.key], sync[settings.bookmarkFolderIconsVisible.key]])
        .toEqual(['fade', 'top', false]);
      expect(Object.hasOwn(sync, LANGUAGE_MESSAGES_KEY)).toBe(false);
      expect(settings.BOOKMARK_TOPBAR_SURFACE_KEYS.filter((key) => Object.hasOwn(sync, key))).toEqual([]);
    });
  });
});

describe('worker startup site search icons', () => {
  it('warms the provider icons as soon as it starts, from the canonical icon cache', async () => {
    const fake = await bootWorker();
    await vi.waitFor(() => {
      const readKeys = fake.storage.local.get.mock.calls.flatMap(([keys]) => (Array.isArray(keys) ? keys : [keys]));
      expect(readKeys).toContain(siteSearchIconCache.key);
    });
  });
});

// The worker entry runs its service modules before its own code; none may
// touch a binding of another before it is initialized.
describe('the worker entry', () => {
  it('boots with its message router ready and answering', async () => {
    const fake = await bootWorker({ tabs: [{ id: 3, windowId: 1, index: 0, active: true, url: 'https://example.com/', title: 'Example' }] });
    const { backgroundMessageRouter } = await import('./background');

    expect(backgroundMessageRouter.has('getSearchSuggestions')).toBe(true);
    expect(await fake.sendMessage({ action: 'getShowSearchShortcut' })).toMatchObject({ shortcut: expect.any(String) });
  });
});
