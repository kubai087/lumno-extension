import { describe, expect, it } from 'vitest';
import { siteSearchDisabled } from '../../../src/domain/settings/search';
import { bundledSiteSearchProviders } from '../overlay/boot';
import { SURFACES, openSearchSurface, type SearchSurface, type SurfaceName } from './surfaces';

// The provider list a search surface asks for at startup can arrive after a
// newer one: Settings may disable a provider meanwhile, and the page reloads
// its list from storage. The late startup answer must not bring the old list
// back.

function menuHas(surface: SearchSurface, key: string): boolean {
  return surface.root().querySelector(`.x-lumno-search-input-mode__menu-item[data-mode-id="provider:${key}"]`) !== null;
}

async function openWithHeldProviders(name: SurfaceName) {
  let answer: (value: unknown) => void = () => {};
  const startup = new Promise((resolve) => {
    answer = resolve;
  });
  let asked = 0;
  const surface = await openSearchSurface(name, {
    // The overlay opens without providers, so it loads them itself.
    openContext: { siteSearchProviders: undefined },
    respond(message) {
      if (message.action === 'getSiteSearchProviders') {
        asked += 1;
        return startup;
      }
      return undefined;
    }
  });
  await surface.settle(60);
  return { surface, answer: () => answer({ items: bundledSiteSearchProviders() }), asked: () => asked };
}

describe.each(SURFACES)('%s site search providers at startup', (name) => {
  it('keeps a provider disabled while the startup answer was pending', async () => {
    const { surface, answer, asked } = await openWithHeldProviders(name);
    expect(asked()).toBeGreaterThan(0);
    surface.changeSetting(siteSearchDisabled.key, ['yt']);
    await surface.settle(80);
    answer();
    await surface.settle(80);
    await surface.openScopeMenu();
    expect(menuHas(surface, 'yt')).toBe(false);
    expect(menuHas(surface, 'gh')).toBe(true);
  });

  it('replaces the startup list on a later Settings change', async () => {
    const { surface, answer } = await openWithHeldProviders(name);
    answer();
    await surface.settle(60);
    surface.changeSetting(siteSearchDisabled.key, ['yt']);
    await surface.settle(80);
    await surface.openScopeMenu();
    expect(menuHas(surface, 'yt')).toBe(false);
  });
});
