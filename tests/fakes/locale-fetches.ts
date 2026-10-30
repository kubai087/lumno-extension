import { expect, vi } from 'vitest';

// The language files a page fetched through the stubbed fetch, with the
// cache mode it asked for.
export function readLocaleFetches(): Array<{ url: string; cache: unknown }> {
  const fetch = globalThis.fetch;
  if (!vi.isMockFunction(fetch)) {
    throw new Error('Expected fetch to be stubbed.');
  }
  return fetch.mock.calls
    .map(([url, init]: unknown[]) => ({
      url: String(url),
      cache: typeof init === 'object' && init !== null && 'cache' in init ? init.cache : undefined
    }))
    .filter((call) => call.url.includes('_locales/'));
}

// After an update the packaged language files change in place, so a page
// reads them past the HTTP cache instead of showing the last version's copy.
export function expectFreshLocaleFetches(): void {
  const fetches = readLocaleFetches();
  expect(fetches.length).toBeGreaterThan(0);
  fetches.forEach((fetch) => expect(fetch, fetch.url).toMatchObject({ cache: 'no-store' }));
}
