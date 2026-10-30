import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { language, motionEffectsEnabled, simpleModeEnabled } from '../../../src/domain/settings';
import { createBrowserFake } from '../../fakes/browser';
import { settle } from './boot';
import { openSearchPage } from './search-page';

// New Tab renders results with the live simple-mode preference: resolved
// before the first results show, and followed when it changes. (What simple
// mode removes from a row is covered by src/shared/react/search/suggestions.test.tsx.)
describe('New Tab simple mode', () => {
  it('applies from the first results, shows the plain query as the search row, and follows the setting off', async () => {
    const browser = createBrowserFake({ sync: { [language.key]: 'en', [motionEffectsEnabled.key]: false, [simpleModeEnabled.key]: true } });
    const search = await openSearchPage(browser);

    await search.type('cats');
    await search.waitForRows();
    expect(search.rows().map((row) => row.getAttribute('data-simple-mode'))).toEqual(search.rows().map(() => 'true'));
    expect(search.rows()[0].querySelector('.x-nt-suggestion-title, [class*="suggestion-title"]')?.textContent?.trim()).toBe('cats');

    await act(async () => browser.storage.sync.externalSet({ [simpleModeEnabled.key]: false }));
    await settle();
    await search.type('cats!');
    await search.waitForRows((rows) => rows.length > 0 && rows.every((row) => row.getAttribute('data-simple-mode') === 'false'),
      'turning simple mode off did not show the decorated rows again');
  });
});
