import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import * as settings from '../../../src/domain/settings';
import { createBrowserFake } from '../../fakes/browser';
import { getElement, getElementById, getElements } from '../../fakes/dom';
import { bootOptionsPage, settle } from './boot';

// What Settings draws and writes: old local choices move into sync instead
// of losing to defaults, a picked theme is saved as the global theme, info
// affordances are the shared InfoButton, and the page measures on one
// resize listener.

type Values = Record<string, unknown>;

const INFO = '._x_extension_info_button_2026_unique_';

async function openOptions(stored: { sync?: Values; local?: Values } = {}) {
  const browser = createBrowserFake({ sync: { [settings.language.key]: 'en', ...stored.sync }, local: stored.local });
  const syncWrites = vi.spyOn(browser.storage.sync, 'set');
  await bootOptionsPage(browser);
  await vi.waitFor(() => {
    expect(document.documentElement.getAttribute('data-lumno-options-ready')).toBe('true');
  });
  return { browser, syncWrites: () => syncWrites.mock.calls.map((call) => call[0]) };
}

describe('Options settings storage', () => {
  it('moves an old local bookmark view mode into sync', async () => {
    const { browser } = await openOptions({ local: { [settings.bookmarkViewMode.key]: 'top' } });

    await vi.waitFor(() => {
      expect(browser.storage.sync.values[settings.bookmarkViewMode.key]).toBe('top');
    });
  });

  it('moves an old local opening animation into sync instead of saving the default over it, and shows it', async () => {
    const { browser } = await openOptions({ local: { [settings.overlayEnterAnimation.key]: 'fade' } });

    await vi.waitFor(() => {
      expect(browser.storage.sync.values[settings.overlayEnterAnimation.key]).toBe('fade');
      expect(getElement(document, '[data-overlay-enter-animation="fade"]').getAttribute('aria-checked')).toBe('true');
    });
  });

  it('saves a picked theme through the shared global theme update', async () => {
    const { syncWrites } = await openOptions({ sync: { [settings.themeMode.key]: 'light' } });
    const before = syncWrites().length;

    await act(async () => getElement(document, '._x_extension_theme_option_2024_unique_[data-mode="dark"]').click());
    await settle();

    const themeWrites = syncWrites().slice(before)
      .filter((write) => Object.hasOwn(write, settings.themeMode.key) || Object.hasOwn(write, settings.newtabThemeMode.key));
    expect(themeWrites).toEqual([settings.createGlobalThemeModeStorageUpdate('dark')]);
  });
});

describe('Options page', () => {
  it('draws its tabs', async () => {
    await openOptions();

    expect(getElements(document, '._x_extension_section_title_2024_unique_').length).toBeGreaterThan(5);
  });

  it.each([
    ['_x_extension_restricted_action_info_2026_unique_', 'the restricted action hint'],
    ['_x_extension_blacklist_form_2026_unique_', 'the search exclusion form'],
    ['_x_extension_favicon_blacklist_form_2026_unique_', 'the icon exclusion form'],
    ['_x_extension_site_search_builtin_list_2024_unique_', 'the site search list'],
    ['_x_extension_overlay_page_theme_adaptation_row_2026_unique_', 'the webpage theme adaptation row'],
    ['_x_extension_bookmark_rows_setting_row_2026_unique_', 'the bookmark rows row'],
    ['_x_extension_bookmark_columns_setting_row_2026_unique_', 'the bookmarks per row row']
  ])('reuses the shared InfoButton in %s (%s)', async (id) => {
    await openOptions();

    await vi.waitFor(() => {
      expect(getElementById(id).querySelector(INFO)).not.toBeNull();
    });
  });

  it('measures on one coordinated resize listener', async () => {
    // The boot's own listener tracking steps aside for this spy, so the
    // test takes the page's window listeners down itself.
    const added = vi.spyOn(window, 'addEventListener');
    try {
      await openOptions();

      expect(added.mock.calls.filter(([type]) => type === 'resize')).toHaveLength(1);
    } finally {
      added.mock.calls.forEach(([type, listener, options]) => window.removeEventListener(type, listener, options));
    }
  });
});
