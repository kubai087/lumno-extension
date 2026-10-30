import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBrowserFake } from '../../../tests/fakes/browser';
import { required } from '../../../tests/fakes/dom';

const FAVICON_KEY = '_x_extension_newtab_favicon_2026_unique_';
const FAVICON_PRELOAD_KEY = '_x_extension_newtab_favicon_preload_2026_unique_';

async function runFaviconPreload(): Promise<void> {
  vi.resetModules();
  await import('./favicon-preload');
}

function faviconLink(): HTMLLinkElement | null {
  return document.head.querySelector('link[data-lumno-newtab-favicon="true"]');
}

afterEach(() => {
  document.head.replaceChildren();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('the favicon preload', () => {
  it('shows the alternate favicon cached on this device before the page\'s scripts run', async () => {
    vi.stubGlobal('chrome', createBrowserFake());
    localStorage.setItem(FAVICON_PRELOAD_KEY, 'alternate');

    await runFaviconPreload();

    const link = required(faviconLink(), 'the favicon link');
    expect(link.getAttribute('rel')).toBe('icon');
    expect(link.getAttribute('type')).toBe('image/svg+xml');
    expect(link.getAttribute('sizes')).toBe('any');
    expect(link.getAttribute('data-newtab-favicon-id')).toBe('alternate');
    expect(link.getAttribute('href')).toBe('chrome-extension://lumno/assets/images/lumno-newtab-favicon.svg');
  });

  it('then shows the stored choice and caches it for the next page', async () => {
    vi.stubGlobal('chrome', createBrowserFake({ sync: { [FAVICON_KEY]: 'default' } }));
    localStorage.setItem(FAVICON_PRELOAD_KEY, 'alternate');

    await runFaviconPreload();
    await vi.waitFor(() => expect(required(faviconLink()).getAttribute('data-newtab-favicon-id')).toBe('default'));

    const link = required(faviconLink());
    expect(link.getAttribute('type')).toBe('image/png');
    expect(link.hasAttribute('sizes')).toBe(false);
    expect(localStorage.getItem(FAVICON_PRELOAD_KEY)).toBe('default');
  });
});
