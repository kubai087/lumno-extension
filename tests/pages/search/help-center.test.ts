import { describe, expect, it } from 'vitest';
import { readRepoFile } from '../../fakes/css';
import { SURFACES, openSearchSurface, suggestionOf, type SurfaceMessage } from './surfaces';

// With the Help Center scope active, both surfaces list matching help pages
// under the scope's search row. The search itself is unit-tested in
// src/domain/search/help-center/ and the worker's side beside
// src/background/site-search-service.ts.

const PAGE = 'https://lumno.kubai.design/help/wallpaper/';

describe.each(SURFACES)('%s Help Center scope', (name) => {
  it('lists matching help pages after the scope search row', async () => {
    const surface = await openSearchSurface(name, {
      respond: (message: SurfaceMessage) => (message.action === 'getHelpCenterSearchResults'
        ? { items: [{ title: 'Change the wallpaper', url: PAGE }] }
        : undefined)
    });
    await surface.chooseScope('provider:lm');
    await surface.type('wallpaper');
    await surface.settle(200);
    const rows = surface.suggestions().map(suggestionOf);
    expect(rows[0]?.type).toBe('siteSearch');
    expect(rows.slice(1).some((row) => row.url === PAGE)).toBe(true);
  });
});

describe('Help Center scope name', () => {
  it.each(['en', 'ja', 'zh_CN', 'zh_TW'])('names the Lumno Help Center in %s', (locale) => {
    const messages: unknown = JSON.parse(readRepoFile(`_locales/${locale}/messages.json`));
    expect(messages).toMatchObject({ site_search_name_lumno_help: { message: expect.stringMatching(/^Lumno /) } });
  });
});
