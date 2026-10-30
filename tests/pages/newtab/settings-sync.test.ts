import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import * as settings from '../../../src/domain/settings';
import enMessages from '../../../_locales/en/messages.json';
import { createBrowserFake, type BrowserFake, type FakeBookmark } from '../../fakes/browser';
import { getElement } from '../../fakes/dom';
import { bootReadyNewtab, settle, waitFor } from './boot';
import { pause } from './search-page';

// What New Tab reads from and writes to browser sync and this device's own
// storage: old local choices move into sync instead of losing to defaults,
// the bookmark bar's material stays on this device, and values another
// device synced are applied without writing back.

type Values = Record<string, unknown>;

const DEFAULT_SYNC: Values = {
  [settings.language.key]: 'en',
  [settings.motionEffectsEnabled.key]: false
};

interface StockOptions {
  sync?: Values;
  local?: Values;
  bookmarksBar?: FakeBookmark[];
}

// A New Tab whose storage writes are recorded, area by area.
async function openNewtab(options: StockOptions = {}) {
  const browser: BrowserFake = createBrowserFake({
    sync: { ...DEFAULT_SYNC, ...options.sync },
    local: options.local,
    bookmarksBar: options.bookmarksBar
  });
  const syncWrites = vi.spyOn(browser.storage.sync, 'set');
  const localWrites = vi.spyOn(browser.storage.local, 'set');
  await bootReadyNewtab(browser);
  const writesOf = (spy: typeof syncWrites, key: string) => spy.mock.calls.map((call) => call[0]).filter((write) => Object.hasOwn(write, key));
  return {
    browser,
    sync: browser.storage.sync.values,
    syncWritesOf: (key: string) => writesOf(syncWrites, key),
    localWritesOf: (key: string) => writesOf(localWrites, key),
    async changeElsewhere(area: 'sync' | 'local', values: Values) {
      await act(async () => browser.storage[area].externalSet(values));
      await settle();
    }
  };
}

const LEGACY_CHOICE_KEYS = [
  settings.newtabFeedbackButtonVisible.key,
  settings.newtabAppearanceButtonVisible.key,
  settings.bookmarkFolderIconsVisible.key,
  settings.recentCount.key
];

describe('New Tab settings storage', () => {
  it('moves old local choices into sync instead of saving defaults over them, and shows them', async () => {
    const page = await openNewtab({ local: Object.fromEntries(LEGACY_CHOICE_KEYS.map((key, index) => [key, index === 3 ? 0 : false])) });

    await waitFor(() => LEGACY_CHOICE_KEYS.every((key) => key in page.sync), 'New Tab did not move the old choices into sync');
    expect(LEGACY_CHOICE_KEYS.map((key) => page.sync[key])).toEqual([false, false, false, 0]);
    expect(getElement(document, '.x-nt-feedback-control').hidden).toBe(true);
  });

  it('saves the defaults on a device without old choices', async () => {
    const page = await openNewtab();

    await waitFor(() => LEGACY_CHOICE_KEYS.every((key) => key in page.sync), 'New Tab did not save the defaults');
    expect(LEGACY_CHOICE_KEYS.map((key) => page.sync[key])).toEqual([true, true, true, 4]);
  });

  it('recovers this device’s last bookmark view mode when sync has none, and writes it back', async () => {
    const page = await openNewtab({ local: { [settings.bookmarkViewMode.key]: 'top' } });

    await waitFor(() => page.sync[settings.bookmarkViewMode.key] === 'top', 'the recovered mode was not written back to sync');
    expect(document.body.getAttribute('data-bookmark-view-mode')).toBe('top');
  });

  it('moves nothing into browser sync on a device whose source is WebDAV', async () => {
    const page = await openNewtab({ local: { [settings.localPrimary.key]: true, [settings.bookmarkViewMode.key]: 'top' } });
    await pause(300);

    expect(page.syncWritesOf(settings.bookmarkViewMode.key)).toEqual([]);
  });

  it('applies folder colors another device synced without writing them back', async () => {
    const page = await openNewtab({
      bookmarksBar: [{ id: 'f1', title: 'Work', children: [{ id: 'u1', title: 'U', url: 'https://u.example/' }] }]
    });
    await pause(200);
    const before = page.syncWritesOf(settings.bookmarkFolderColorRefs.key).length;

    await page.changeElsewhere('sync', { [settings.bookmarkFolderColorRefs.key]: { 'Bookmarks bar/Work': 'blue' } });
    await pause(300);

    expect(page.syncWritesOf(settings.bookmarkFolderColorRefs.key)).toHaveLength(before);
  });

  it('names its shortcut settings in the appearance panel in the page language', async () => {
    await openNewtab();

    await act(async () => getElement(document, '.x-nt-wallpaper-button').click());
    await waitFor(() => document.querySelector('.x-nt-wallpaper-panel') !== null, 'the appearance panel did not open');

    const text = getElement(document, '.x-nt-wallpaper-panel').textContent;
    expect(text).toContain(enMessages.settings_newtab_shortcut_add_title.message);
    expect(text).toContain(enMessages.settings_newtab_shortcut_dock_magnification_title.message);
  });
});

// The bookmark top bar's material stays on this device.
describe('New Tab bookmark bar material', () => {
  const [MODE_KEY, LIGHT_KEY, DARK_KEY, LEGACY_KEY] = settings.BOOKMARK_TOPBAR_SURFACE_KEYS;

  async function openTopbar() {
    const page = await openNewtab({
      local: { [settings.bookmarkViewMode.key]: 'top', [MODE_KEY]: 'custom', [LIGHT_KEY]: '#112233' },
      sync: {
        [settings.bookmarkViewMode.key]: 'top',
        [MODE_KEY]: 'adaptive',
        [LIGHT_KEY]: '#aabbcc',
        [DARK_KEY]: '#ddeeff',
        [LEGACY_KEY]: '#445566'
      },
      bookmarksBar: [{ id: 'u1', title: 'U', url: 'https://u.example/' }]
    });
    await waitFor(() => document.querySelector('.x-nt-bookmarks-topbar') !== null, 'the bookmark top bar did not draw');
    return { page, topbar: getElement(document, '.x-nt-bookmarks-topbar') };
  }

  it('loads only this device’s values and never imports synced ones', async () => {
    const { page, topbar } = await openTopbar();
    await pause(200);

    expect(topbar.getAttribute('data-surface-mode')).toBe('custom');
    expect(topbar.style.getPropertyValue('--x-nt-bookmarks-topbar-surface')).toBe('#112233');
    expect(settings.BOOKMARK_TOPBAR_SURFACE_KEYS.flatMap(page.localWritesOf)).toEqual([]);
  });

  it('ignores live material changes from sync and follows this device', async () => {
    const { page, topbar } = await openTopbar();

    await page.changeElsewhere('sync', { [MODE_KEY]: 'transparent' });
    expect(topbar.getAttribute('data-surface-mode')).toBe('custom');

    await page.changeElsewhere('local', { [MODE_KEY]: 'transparent' });
    await waitFor(() => topbar.getAttribute('data-surface-mode') === 'transparent', 'the top bar did not follow this device');
  });
});
