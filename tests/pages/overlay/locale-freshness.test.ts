import { describe, expect, it } from 'vitest';
import { expectFreshLocaleFetches } from '../../fakes/locale-fetches';
import { bootOverlayPage } from './boot';

const LANGUAGE_KEY = '_x_extension_language_2024_unique_';
const SYNCED_MESSAGES_KEY = '_x_extension_language_messages_2024_unique_';

describe('Overlay language file', () => {
  it('reads its language file from the package past the HTTP cache, not from a synced copy', async () => {
    const page = await bootOverlayPage({ settings: { [LANGUAGE_KEY]: 'ja' } });
    await page.open();

    expectFreshLocaleFetches();
    expect(page.storageReads.flatMap((read) => read.keys)).not.toContain(SYNCED_MESSAGES_KEY);
  });
});
