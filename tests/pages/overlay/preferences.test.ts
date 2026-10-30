import { describe, expect, it } from 'vitest';
import * as settings from '../../../src/domain/settings';
import { bootOverlayPage, settle, waitFor } from './boot';

// The overlay reads its preferences as it opens and follows them while open:
// the opening animation, simple mode, and the global theme /mode writes.
describe('Overlay preferences', () => {
  it('reads the synchronized opening animation in its batched startup read', async () => {
    const page = await bootOverlayPage();

    await page.open();

    expect(page.storageReads.some((read) => read.keys.length > 1 && read.keys.includes(settings.overlayEnterAnimation.key))).toBe(true);
  });

  it('shows simple-mode rows from the first results and decorated ones once it is turned off', async () => {
    const page = await bootOverlayPage({ settings: { [settings.simpleModeEnabled.key]: true } });
    await page.open();

    await page.type('cats');
    await waitFor(() => page.suggestions().length > 0, 'the overlay showed no results');
    expect(page.suggestions().map((row) => row.getAttribute('data-simple-mode'))).toEqual(page.suggestions().map(() => 'true'));

    page.changeSetting(settings.simpleModeEnabled.key, false);
    await settle(100);
    await page.type('cats!');
    await waitFor(() => page.suggestions().length > 0 && page.suggestions().every((row) => row.getAttribute('data-simple-mode') === 'false'),
      'turning simple mode off did not show the decorated rows again');
  });

  it('writes the global theme with /mode, leaves New Tab’s own theme alone, and shows it', async () => {
    const THEME = settings.themeMode.key;
    const NEWTAB_THEME = settings.newtabThemeMode.key;
    const page = await bootOverlayPage({ settings: { [THEME]: 'light', [NEWTAB_THEME]: 'light' } });
    const root = await page.open();
    await page.type('/mode');
    await waitFor(() => page.suggestions().length > 0, '/mode offered no theme');
    const before = page.storageWrites.length;

    page.press('Enter');
    await settle(150);

    expect(page.storageWrites.slice(before).filter((write) => Object.hasOwn(write, THEME) || Object.hasOwn(write, NEWTAB_THEME)))
      .toEqual([settings.createGlobalThemeModeStorageUpdate('dark')]);
    expect(root.querySelector('[data-theme]')?.getAttribute('data-theme')).toBe('dark');
  });
});
