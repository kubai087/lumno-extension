import { afterEach, describe, expect, it, vi } from 'vitest';

describe('New Tab route redirect', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the previous New Tab path to the short route with its query and hash', async () => {
    const replace = vi.fn();
    vi.stubGlobal('location', {
      href: 'chrome-extension://abc/src/newtab/newtab.html?focus=1&notice=file-access#search',
      search: '?focus=1&notice=file-access',
      hash: '#search',
      replace
    });
    vi.resetModules();
    await import('./newtab-route-redirect');

    expect(replace.mock.calls).toEqual([['chrome-extension://abc/newtab.html?focus=1&notice=file-access#search']]);
  });
});
