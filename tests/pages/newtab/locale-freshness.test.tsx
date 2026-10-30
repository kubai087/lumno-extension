import { describe, it } from 'vitest';
import { createBrowserFake } from '../../fakes/browser';
import { expectFreshLocaleFetches } from '../../fakes/locale-fetches';
import { fetchPackaged } from '../../fakes/packaged-fetch';
import { bootReadyNewtab } from './boot';

describe('New Tab language file', () => {
  it('reads its language file past the HTTP cache', async () => {
    await bootReadyNewtab(createBrowserFake({
      sync: { _x_extension_language_2024_unique_: 'ja' },
      tabs: [{ id: 1, windowId: 1, index: 0, url: 'chrome://newtab/', title: 'New Tab', active: true, pinned: false }]
    }), { fetch: fetchPackaged });

    expectFreshLocaleFetches();
  });
});
