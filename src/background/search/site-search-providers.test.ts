import { describe, expect, it } from 'vitest';
import { installWorkerFake, jsonResponse } from '../../../tests/fakes/worker';
import type { FakeResponse } from '../../../tests/fakes/worker';

interface HeldRead {
  resolve(response: FakeResponse): void;
  reject(error: Error): void;
}

// The worker's provider loader, with the bundled provider list
// (assets/data/site-search.json) answered one request at a time.
async function loadProvidersOneReadAtATime() {
  const reads: HeldRead[] = [];
  installWorkerFake({
    fetch: (url) => {
      if (!url.endsWith('/assets/data/site-search.json')) throw new Error('network disabled');
      return new Promise((resolve, reject) => {
        reads.push({ resolve, reject });
      });
    }
  });
  const providers = await import('./site-search-providers');
  return { reads, load: providers.loadSiteSearchProviders, invalidate: providers.invalidateSiteSearchProviderCache };
}

function providerList(key: string): FakeResponse {
  return jsonResponse({ items: [{ key, name: key, template: `https://${key}.test/?q={query}` }] });
}

describe('the site search provider cache', () => {
  it('shares one load between concurrent reads', async () => {
    const { reads, load } = await loadProvidersOneReadAtATime();

    expect(load()).toBe(load());
    expect(reads).toHaveLength(1);
  });

  it('never lets an obsolete load replace the providers a newer one published', async () => {
    const { reads, load, invalidate } = await loadProvidersOneReadAtATime();
    const firstLoad = load();
    invalidate();
    const secondLoad = load();

    expect(secondLoad).not.toBe(firstLoad);
    expect(reads).toHaveLength(2);
    reads[1].resolve(providerList('new-provider'));
    expect((await secondLoad)[0].key).toBe('new-provider');

    reads[0].resolve(providerList('obsolete-provider'));
    expect((await firstLoad)[0].key).toBe('new-provider');
    expect((await load())[0].key).toBe('new-provider');
    expect(reads).toHaveLength(2);
  });

  it('keeps the latest providers when an obsolete load fails last', async () => {
    const { reads, load, invalidate } = await loadProvidersOneReadAtATime();
    const staleLoad = load();
    invalidate();
    const latestLoad = load();

    reads[1].resolve(providerList('latest-provider'));
    await latestLoad;
    reads[0].reject(new Error('stale provider list unavailable'));
    await staleLoad;

    expect((await load())[0].key).toBe('latest-provider');
    expect(reads).toHaveLength(2);
  });
});
