import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBrowserFake } from '../../tests/fakes/browser';
import { installFontFaceApi, removeFontFaceApi } from '../../tests/fakes/font-faces';

// The observer every frame runs at document start registers the overlay's
// font faces in the top frame of a loading Document only.

async function loadObserver(readyState: DocumentReadyState, options: { subframe?: boolean } = {}) {
  const added = installFontFaceApi();
  vi.spyOn(document, 'readyState', 'get').mockReturnValue(readyState);
  if (options.subframe) {
    vi.spyOn(window, 'top', 'get').mockReturnValue(null);
  }
  const browser = createBrowserFake();
  vi.spyOn(browser.i18n, 'getUILanguage').mockReturnValue('ja');
  vi.stubGlobal('chrome', browser);
  vi.resetModules();
  await import('./shortcut-key-observer');
  return added;
}

afterEach(() => {
  removeFontFaceApi();
});

describe('shortcut key observer font faces', () => {
  it('registers the faces while the top frame loads, once', async () => {
    const added = await loadObserver('loading');
    expect(added.size).toBe(5);
    expect(Array.from(added)[4].source).toMatch(/HiraginoSans-W5/);
    expect(document.querySelector('style')).toBeNull();
    // A replacement observer injected later does not register again.
    vi.resetModules();
    await import('./shortcut-key-observer');
    expect(added.size).toBe(5);
  });

  it('leaves a page that already shows to the overlay', async () => {
    const added = await loadObserver('complete');
    expect(added.size).toBe(0);
  });

  it('registers nothing in a subframe, where it still observes keys', async () => {
    const added = await loadObserver('loading', { subframe: true });
    expect(globalThis.__lumnoContent?.claimed['shortcut-key-observer']).toBe(true);
    expect(added.size).toBe(0);
  });
});
