import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBrowserFake } from '../../tests/fakes/browser';

describe('New Tab preload', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-nt-focus-route-pending');
    vi.doUnmock('./dom/wallpaper-preload');
    vi.unstubAllGlobals();
  });

  it('holds the page for its focus route before the wallpaper preload paints', async () => {
    // Storage answers in a later task than the preload's own, as in the browser.
    const browser = createBrowserFake();
    vi.spyOn(browser.storage.local, 'get').mockReturnValue(undefined);
    vi.spyOn(browser.storage.sync, 'get').mockReturnValue(undefined);
    vi.stubGlobal('chrome', browser);
    const heldAtWallpaper: Array<string | null> = [];
    vi.resetModules();
    vi.doMock('./dom/wallpaper-preload', () => {
      heldAtWallpaper.push(document.documentElement.getAttribute('data-nt-focus-route-pending'));
      return {};
    });
    await import('./newtab-preload-entry');

    expect(heldAtWallpaper).toEqual(['true']);
  });
});
