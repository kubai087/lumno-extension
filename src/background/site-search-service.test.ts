import { describe, expect, it } from 'vitest';
import { bootWorker, installWorkerFake, jsonResponse, settleWorker } from '../../tests/fakes/worker';
import { serializeAggregateSearches } from '../domain/search/aggregate-search-store';
import { aggregateSearchAutoGroupEnabled, aggregateSearches, siteSearchCustom } from '../domain/settings/search';

const SOURCE = { id: 10, index: 0, windowId: 1, url: 'https://page.test/' };
const SENDER: chrome.runtime.MessageSender = {
  tab: {
    ...SOURCE,
    active: true,
    pinned: false,
    highlighted: true,
    incognito: false,
    selected: true,
    discarded: false,
    autoDiscardable: true,
    frozen: false,
    groupId: -1,
    lastAccessed: 0
  },
  url: SOURCE.url
};

describe('aggregate search in the worker', () => {
  it('reads the auto-group setting on each run, so a change in Settings applies to the next search', async () => {
    const definition = { id: 'research', key: 'research', name: 'Research', sourceRefs: ['builtin:gg', 'builtin:bi'] };
    const fake = await bootWorker({
      tabs: [{ ...SOURCE }],
      sync: {
        [aggregateSearches.key]: serializeAggregateSearches([definition]),
        [aggregateSearchAutoGroupEnabled.key]: false
      }
    });
    const run = (query: string) => fake.sendMessage(
      { action: 'runAggregateSearchQuery', aggregateId: 'research', query, disposition: 'newTab' }, SENDER, 1500);

    await run('hello');
    await settleWorker(50);
    expect(fake.chrome.tabs.create.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(fake.chrome.tabs.group).not.toHaveBeenCalled();

    fake.storage.sync.externalSet({ [aggregateSearchAutoGroupEnabled.key]: true });
    await run('world');
    await settleWorker(50);
    expect(fake.chrome.tabs.group).toHaveBeenCalledTimes(1);
  });
});

describe('site search messages', () => {
  it('answers with the bundled providers when the stored ones cannot be read', async () => {
    const fake = installWorkerFake();
    const read = fake.chrome.storage.sync.get.getMockImplementation();
    fake.chrome.storage.sync.get.mockImplementation((keys, callback) => {
      const list = Array.isArray(keys) ? keys : [keys];
      if (list.includes(siteSearchCustom.key) && callback) {
        setTimeout(() => Reflect.apply(callback, undefined, [undefined]), 0);
        return undefined;
      }
      return read ? read(keys, callback) : undefined;
    });
    await import('./background');
    await settleWorker();
    const response = await fake.sendMessage({ action: 'getSiteSearchProviders' });

    expect(response).toMatchObject({ items: expect.arrayContaining([expect.anything()]) });
    expect(response).not.toHaveProperty('reason');
  });

  it('never opens providers or addresses a page supplies with an aggregate search', async () => {
    const fake = await bootWorker({ tabs: [{ ...SOURCE }] });
    await fake.sendMessage({
      action: 'runAggregateSearchQuery',
      aggregateId: 'missing-definition',
      query: 'hello',
      disposition: 'newTab',
      provider: { template: 'https://evil.test/?q={query}' },
      providers: [{ template: 'https://evil.test/?q={query}' }],
      urls: ['https://evil.test/']
    }, SENDER, 300);
    const opened = [...fake.chrome.tabs.create.mock.calls, ...fake.chrome.tabs.update.mock.calls].map((call) => JSON.stringify(call));

    expect(opened.some((call) => call.includes('evil.test'))).toBe(false);
  });
});

describe('help center search in the worker', () => {
  // A language without a synonym list (404) is remembered as having none.
  it('searches the index once loaded, and asks for a missing synonym list only once', async () => {
    const fetched: string[] = [];
    const fake = await bootWorker({
      fetch: async (url) => {
        fetched.push(url);
        if (/search-index\.json$/.test(url)) {
          return jsonResponse([{ title: 'Wallpapers', href: '/help/wallpaper/', sections: [], text: 'Change the New Tab wallpaper' }]);
        }
        return jsonResponse({}, 404);
      }
    });
    const items = (reply: unknown): unknown[] => {
      const list: unknown = typeof reply === 'object' && reply !== null ? Reflect.get(reply, 'items') : undefined;
      return Array.isArray(list) ? list : [];
    };
    const first = items(await fake.sendMessage({ action: 'getHelpCenterSearchResults', query: 'wallpaper', locale: 'en' }, undefined, 3000));
    const second = items(await fake.sendMessage({ action: 'getHelpCenterSearchResults', query: 'wallpapers', locale: 'en' }, undefined, 3000));
    expect(first).toEqual(expect.arrayContaining([expect.objectContaining({ url: expect.stringMatching(/\/help\/wallpaper\//) })]));
    expect(second.length).toBeGreaterThan(0);
    expect(fetched.filter((url) => /search-synonyms\.json$/.test(url))).toHaveLength(1);
    expect(fetched.filter((url) => /search-index\.json$/.test(url))).toHaveLength(1);
  });
});
