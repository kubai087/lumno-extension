import { afterEach, describe, expect, it, vi } from 'vitest';

// The standalone fallback page sends its tab to the maintained New Tab,
// asking for focus and keeping the rest of its address.
async function redirectFrom(href: string): Promise<unknown[]> {
  const url = new URL(href);
  const replace = vi.fn();
  vi.stubGlobal('location', { href: url.href, search: url.search, hash: url.hash, replace });
  vi.resetModules();
  await import('./lumno-newtab');
  return replace.mock.calls.map((call) => call[0]);
}

describe('standalone Lumno New Tab', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('replaces itself with the focused New Tab, keeping its query and hash', async () => {
    expect(await redirectFrom('chrome-extension://abc/src/newtab/lumno-newtab.html?focus=1&notice=file-access#search'))
      .toEqual(['chrome-extension://abc/newtab.html?focus=1&notice=file-access#search']);
  });

  it('asks for focus on a bare address', async () => {
    expect(await redirectFrom('chrome-extension://abc/src/newtab/lumno-newtab.html')).toEqual(['chrome-extension://abc/newtab.html?focus=1']);
  });
});
