import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newtabLocaleCache, newtabStartupStorageKeys } from '../domain/settings/page-cache';
import { readBootValue } from '../platform/boot-handoff';
import { createBrowserFake } from '../../tests/fakes/browser';

// The preload runs once per page; each case runs it fresh against what the
// last New Tab left in localStorage, and reads what it handed to the page.
async function runPrefetch(cache: Record<string, string>) {
  Object.entries(cache).forEach(([key, value]) => window.localStorage.setItem(key, value));
  const fetch = vi.fn(async (_url: string, _options?: RequestInit) => ({ json: async () => ({}) }));
  vi.stubGlobal('fetch', fetch);
  vi.resetModules();
  await import('./newtab-storage-prefetch');
  return { fetch, prefetch: readBootValue('localePrefetch') };
}

describe('New Tab storage prefetch', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', createBrowserFake());
  });

  afterEach(() => {
    window.localStorage.clear();
    Reflect.deleteProperty(globalThis, '__lumnoBoot');
    vi.unstubAllGlobals();
  });

  it('fetches the last locale messages uncached and hands them to the page', async () => {
    const { fetch, prefetch } = await runPrefetch({ [newtabLocaleCache.key]: 'zh_CN' });

    expect(prefetch?.locale).toBe('zh_CN');
    expect(fetch.mock.calls).toEqual([['chrome-extension://lumno/_locales/zh_CN/messages.json', { cache: 'no-store' }]]);
    await expect(prefetch?.messages).resolves.toEqual({});
  });

  it('fetches nothing for a cached locale it does not know', async () => {
    const { fetch, prefetch } = await runPrefetch({ [newtabLocaleCache.key]: '../evil' });

    expect(prefetch).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fetches nothing without a cached locale', async () => {
    const { fetch, prefetch } = await runPrefetch({});

    expect(prefetch).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('starts the read of the last startup keys only for a clean list of keys', async () => {
    await runPrefetch({ [newtabStartupStorageKeys.key]: JSON.stringify(['a', 'b']) });
    expect(readBootValue('storageReadPrefetches')).toBeDefined();

    Reflect.deleteProperty(globalThis, '__lumnoBoot');
    await runPrefetch({ [newtabStartupStorageKeys.key]: JSON.stringify(['a', 1]) });
    expect(readBootValue('storageReadPrefetches')).toBeUndefined();
  });
});
