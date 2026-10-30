import { describe, it } from 'vitest';
import { createBrowserFake } from '../../fakes/browser';
import { expectFreshLocaleFetches } from '../../fakes/locale-fetches';
import { bootOptionsPage } from './boot';

describe('Settings language file', () => {
  it('reads its language file past the HTTP cache', async () => {
    await bootOptionsPage(createBrowserFake({ sync: { _x_extension_language_2024_unique_: 'ja' } }));

    expectFreshLocaleFetches();
  });
});
