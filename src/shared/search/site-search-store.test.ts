import { describe, expect, it, vi } from 'vitest';
import * as store from './site-search-store';
import type { StorageItems } from '../../domain/storage-port';

const BASE_PROVIDERS = [
  { key: 'yt', name: 'YouTube', template: 'https://youtube.com/results?search_query={query}' },
  { key: 'gm', name: 'Gemini', template: 'https://gemini.google.com/app', action: 'openAndSubmit', submitStrategy: 'geminiPrompt' }
];

// A worker that answers getSiteSearchProviders with `reply`.
function runtimeAnswering(reply: object) {
  return {
    runtime: {
      getURL: (path: string) => path,
      sendMessage(_message: unknown, callback?: (response: unknown) => void) {
        if (callback) callback(reply);
      }
    }
  };
}

describe('site search store', () => {
  it('lets a custom provider override a built-in one of its key, keeping how it submits', () => {
    const merged = store.mergeStoredProviders(
      BASE_PROVIDERS,
      [{ key: 'gm', name: 'My Gemini', template: 'https://gemini.google.com/app' }],
      ['yt'],
      null
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ key: 'gm', action: 'openAndSubmit', submitStrategy: 'geminiPrompt', _xIsCustom: true });
  });

  it('keeps a renamed built-in from duplicating its disabled origin', () => {
    const merged = store.mergeStoredProviders(
      BASE_PROVIDERS,
      [{ key: 'gmx', builtinKey: 'gm', name: 'Gemini Renamed', template: 'https://gemini.google.com/app' }],
      ['gm'],
      null
    );
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ key: 'gmx', builtinKey: 'gm', action: 'openAndSubmit', submitStrategy: 'geminiPrompt' });
    expect(merged.some((item) => item.key === 'gm')).toBe(false);
  });

  it('uses the worker list when the worker answers with one', async () => {
    const items = [{ key: 'rd', name: 'Reddit', template: 'https://reddit.com/search?q={query}' }];
    await expect(store.loadSiteSearchProviders({
      chromeApi: runtimeAnswering({ items }),
      defaultProviders: BASE_PROVIDERS
    })).resolves.toEqual(items);
  });

  it('otherwise merges the bundled list, read through the caller URL resolver, with stored custom and disabled providers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ items: BASE_PROVIDERS }) })));
    const stored: StorageItems = {
      [store.STORAGE_KEYS.custom]: [{ key: 'gm', name: 'Gemini Custom', template: 'https://gemini.google.com/app' }],
      [store.STORAGE_KEYS.disabled]: ['yt']
    };
    const getResourceUrl = vi.fn((path: string) => `https://example.test/${path}`);
    const loaded = await store.loadSiteSearchProviders({
      chromeApi: runtimeAnswering({}),
      storageArea: {
        get(keys, callback) {
          const key = Array.isArray(keys) ? keys[0] : keys;
          if (callback && typeof key === 'string') callback({ [key]: stored[key] });
        },
        set() {}
      },
      defaultProviders: BASE_PROVIDERS,
      getResourceUrl
    });
    vi.unstubAllGlobals();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({ key: 'gm', action: 'openAndSubmit', submitStrategy: 'geminiPrompt', _xIsCustom: true });
    expect(getResourceUrl).toHaveBeenCalledWith('assets/data/site-search.json');
  });
});
